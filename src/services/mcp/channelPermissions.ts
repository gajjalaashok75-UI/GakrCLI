/**
 * Permission prompts over channels (Telegram, iMessage, Discord).
 *
 * Mirrors `BridgePermissionCallbacks` — when CC hits a permission dialog,
 * it ALSO sends the prompt via active channels and races the reply against
 * local UI / bridge / hooks / classifier. First resolver wins via claim().
 *
 * Inbound is a structured event: the server parses the user's "yes tbxkq"
 * reply and emits notifications/gakrcli/channel/permission with
 * {request_id, behavior}. CC never sees the reply as text — approval
 * requires the server to deliberately emit that specific event, not just
 * relay content. Servers opt in by declaring
 * capabilities.experimental['gakrcli/channel/permission'].
 *
 * Kenneth's "would this let GakrCLI self-approve?": the approving party is
 * the human via the channel, not GakrCLI. But the trust boundary isn't the
 * terminal — it's the allowlist (tengu_harbor_ledger). A compromised
 * channel server CAN fabricate "yes <id>" without the human seeing the
 * prompt. Accepted risk: a compromised channel already has unlimited
 * conversation-injection turns (social-engineer over time, wait for
 * acceptEdits, etc.); inject-then-self-approve is faster, not more
 * capable. The dialog slows a compromised channel; it doesn't stop one.
 * See PR discussion 2956440848.
 */

import { jsonStringify } from '../../utils/slowOperations.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'
import { jsonRedactor, redactSensitiveInfo } from '../../utils/redaction.js'

/**
 * GrowthBook runtime gate — separate from the channels gate (tengu_harbor)
 * so channels can ship without permission-relay riding along (Kenneth: "no
 * bake time if it goes out tomorrow"). Default false; flip without a release.
 * Checked once at useManageMCPConnections mount — mid-session flag changes
 * don't apply until restart.
 */
export function isChannelPermissionRelayEnabled(): boolean {
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_harbor_permissions', false)
}

export type ChannelPermissionResponse = {
  behavior: 'allow' | 'deny'
  /** Which channel server the reply came from (e.g., "plugin:telegram:tg"). */
  fromServer: string
}

export type ChannelPermissionCallbacks = {
  /** Register a resolver for a request ID. Returns unsubscribe. */
  onResponse(
    requestId: string,
    handler: (response: ChannelPermissionResponse) => void,
  ): () => void
  /** Resolve a pending request from a structured channel event
   *  (notifications/gakrcli/channel/permission). Returns true if the ID
   *  was pending — the server parsed the user's reply and emitted
   *  {request_id, behavior}; we just match against the map. */
  resolve(
    requestId: string,
    behavior: 'allow' | 'deny',
    fromServer: string,
  ): boolean
}

/**
 * Reply format spec for channel servers to implement:
 *   /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i
 *
 * 5 lowercase letters, no 'l' (looks like 1/I). Case-insensitive (phone
 * autocorrect). No bare yes/no (conversational). No prefix/suffix chatter.
 *
 * CC generates the ID and sends the prompt. The SERVER parses the user's
 * reply and emits notifications/gakrcli/channel/permission with {request_id,
 * behavior} — CC doesn't regex-match text anymore. Exported so plugins can
 * import the exact regex rather than hand-copying it.
 */
export const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i

// 25-letter alphabet: a-z minus 'l' (looks like 1/I). 25^5 ≈ 9.8M space.
const ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyz'

// Substring blocklist — 5 random letters can spell things (Kenneth, in the
// launch thread: "this is why i bias to numbers, hard to have anything worse
// than 80085"). Non-exhaustive, covers the send-to-your-boss-by-accident
// tier. If a generated ID contains any of these, re-hash with a salt.
// prettier-ignore
const ID_AVOID_SUBSTRINGS = [
  'fuck',
  'shit',
  'cunt',
  'cock',
  'dick',
  'twat',
  'piss',
  'crap',
  'bitch',
  'whore',
  'ass',
  'tit',
  'cum',
  'fag',
  'dyke',
  'nig',
  'kike',
  'rape',
  'nazi',
  'damn',
  'poo',
  'pee',
  'wank',
  'anus',
]

function hashToId(input: string): string {
  // FNV-1a → uint32, then base-25 encode. Not crypto, just a stable
  // short letters-only ID. 32 bits / log2(25) ≈ 6.9 letters of entropy;
  // taking 5 wastes a little, plenty for this.
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h = h >>> 0
  let s = ''
  for (let i = 0; i < 5; i++) {
    s += ID_ALPHABET[h % 25]
    h = Math.floor(h / 25)
  }
  return s
}

/**
 * Short ID from a toolUseID. 5 letters from a 25-char alphabet (a-z minus
 * 'l' — looks like 1/I in many fonts). 25^5 ≈ 9.8M space, birthday
 * collision at 50% needs ~3K simultaneous pending prompts, absurd for a
 * single interactive session. Letters-only so phone users don't switch
 * keyboard modes (hex alternates a-f/0-9 → mode toggles). Re-hashes with
 * a salt suffix if the result contains a blocklisted substring — 5 random
 * letters can spell things you don't want in a text message to your phone.
 * toolUseIDs are `toolu_` + base64-ish; we hash rather than slice.
 */
export function shortRequestId(toolUseID: string): string {
  // 7 length-3 × 3 positions × 25² + 15 length-4 × 2 × 25 + 2 length-5
  // ≈ 13,877 blocked IDs out of 9.8M — roughly 1 in 700 hits the blocklist.
  // Cap at 10 retries; (1/700)^10 is negligible.
  let candidate = hashToId(toolUseID)
  for (let salt = 0; salt < 10; salt++) {
    if (!ID_AVOID_SUBSTRINGS.some(bad => candidate.includes(bad))) {
      return candidate
    }
    candidate = hashToId(`${toolUseID}:${salt}`)
  }
  return candidate
}

// ---------------------------------------------------------------------------
//                        Redaction utilities
// ---------------------------------------------------------------------------

const SENSITIVE_FIELD_SUBSTRINGS = [
  'token',
  'apikey',
  'secret',
  'password',
  'authorization',
  'cookie',
  'credential',
  'bearer',
  'privatekey',
] as const

const AUTH_WHOLE_WORDS = new Set(['auth', 'xauth'])

const X_API_KEY_PATTERN =
  /(["']?x-api-key["']?\s*[:=]\s*["']?)[^"',\n&#;]+/gi

const GENERIC_CREDENTIAL_ENV_PATTERN =
  /(?<![A-Za-z0-9_-])((?:[A-Za-z0-9_]*_)?(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)\s*[=:]\s*)["']?[^"',\n&#;]+["']?/gi

const GENERIC_HEADER_FIELD_PATTERN =
  /(["']?(?:x-api-key|x[-_]?auth|authorization|auth|bearer|api[-_]?key|token|access[-_]?token|refresh[-_]?token|secret|password|cookie|set[-_]?cookie|id[-_]?token|exchanged[-_]?api[-_]?key|trusted[-_]?device[-_]?token|private[-_]?key)["']?\s*[:=]\s*["']?)(?:bearer\s+)?([^"',\n&#;]+)/gi

const SENSITIVE_URL_QUERY_PARAM_TOKENS = [
  'api_key',
  'apikey',
  'key',
  'token',
  'access_token',
  'refresh_token',
  'signature',
  'sig',
  'secret',
  'password',
  'passwd',
  'pwd',
  'auth',
  'authorization',
  'cookie',
  'set-cookie',
] as const

function shouldRedactUrlQueryParam(name: string): boolean {
  const lower = name.toLowerCase()
  return SENSITIVE_URL_QUERY_PARAM_TOKENS.some((token) =>
    lower.includes(token),
  )
}

function redactSensitiveQuerySegments(query: string): string {
  return query.replace(
    /(^|[&;])([^&=;]+)(?:=([^&;]*))?/g,
    (match, delim, rawKey) => {
      let key: string
      try {
        key = decodeURIComponent(rawKey)
      } catch {
        key = rawKey
      }
      if (shouldRedactUrlQueryParam(key)) {
        return `${delim}${rawKey}=redacted`
      }
      return match
    },
  )
}

function redactUrlForDisplay(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.username) {
      parsed.username = 'redacted'
    }
    if (parsed.password) {
      parsed.password = 'redacted'
    }

    const hashIdx = rawUrl.indexOf('#')
    const qsStart = rawUrl.indexOf('?')
    if (qsStart !== -1 && (hashIdx === -1 || qsStart < hashIdx)) {
      const rawQuery =
        hashIdx === -1
          ? rawUrl.slice(qsStart + 1)
          : rawUrl.slice(qsStart + 1, hashIdx)
      parsed.search = redactSensitiveQuerySegments(rawQuery)
    }

    parsed.hash = ''
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

function redactSensitiveInfo(text: string): string {
  let redacted = text

  // x-api-key header values
  redacted = redacted.replace(X_API_KEY_PATTERN, '$1[REDACTED_API_KEY]')

  // Generic *_API_KEY / *_SECRET / *_TOKEN / *_PASSWORD env vars
  redacted = redacted.replace(
    GENERIC_CREDENTIAL_ENV_PATTERN,
    '$1[REDACTED]',
  )

  // Catch-all: any of the standard credential field names with a value
  redacted = redacted.replace(
    GENERIC_HEADER_FIELD_PATTERN,
    (match, prefix, value) => {
      if (value === '[REDACTED]') return match
      return `${prefix}[REDACTED]`
    },
  )

  // Redact sensitive query params in https?:// URLs embedded in text
  redacted = redacted.replace(
    /(?:https?:)?\/\/[^\s"',)}>]+/gi,
    (url) => redactUrlForDisplay(url),
  )

  // Post-processing: absorb &<text> or ;<text> segments trailing a
  // redacted placeholder — catches "&horse=battery" after
  // DATABASE_PASSWORD=[REDACTED]
  redacted = redacted.replace(
    /(\[REDACTED(?:_[A-Z_]+)?\])([&;][^\s"'&;]+)*/g,
    '$1',
  )

  return redacted
}

function jsonRedactor(key: string, value: unknown): unknown {
  const normalizedKey = key.toLowerCase().replace(/[-_]/g, '')

  const EXCLUDED_KEYS = [
    'inputtokens',
    'outputtokens',
    'tokens',
    'cachereadinputtokens',
    'cachecreationinputtokens',
    'maxtokens',
    'tokensremaining',
    'tokencount',
    'totaltokens',
    'prompttokens',
    'completiontokens',
  ]
  if (EXCLUDED_KEYS.includes(normalizedKey)) {
    if (typeof value === 'number') return value
    return '[REDACTED]'
  }

  if (AUTH_WHOLE_WORDS.has(normalizedKey)) {
    return '[REDACTED]'
  }

  if (SENSITIVE_FIELD_SUBSTRINGS.some((s) => normalizedKey.includes(s))) {
    return '[REDACTED]'
  }

  if (typeof value === 'string') {
    const urlRedacted = /^(?:https?:)?\/\//i.test(value)
      ? redactUrlForDisplay(value)
      : value
    return redactSensitiveInfo(urlRedacted)
  }

  return value
}

/**
 * Truncate tool input to a phone-sized JSON preview. 200 chars is
 * roughly 3 lines on a narrow phone screen. Full input is in the local
 * terminal dialog; the channel gets a summary so Write(5KB-file) doesn't
 * flood your texts. Server decides whether/how to show it.
 */
export function truncateForPreview(input: unknown): string {
  try {
    const structurallyRedacted = JSON.parse(
      JSON.stringify(input, jsonRedactor),
    )
    const s = jsonStringify(structurallyRedacted)
    const redacted = redactSensitiveInfo(s)
    return redacted.length > 200 ? redacted.slice(0, 200) + '…' : redacted
  } catch {
    return '(unserializable)'
  }
}

/**
 * Filter MCP clients down to those that can relay permission prompts.
 * Three conditions, ALL required: connected + in the session's --channels
 * allowlist + declares BOTH capabilities. The second capability is the
 * server's explicit opt-in — a relay-only channel never becomes a
 * permission surface by accident (Kenneth's "users may be unpleasantly
 * surprised"). Centralized here so a future fourth condition lands once.
 */
export function filterPermissionRelayClients<
  T extends {
    type: string
    name: string
    capabilities?: { experimental?: Record<string, unknown> }
    config?: { pluginSource?: string }
  },
>(
  clients: readonly T[],
  isInAllowlist: (name: string, pluginSource?: string) => boolean,
): (T & { type: 'connected' })[] {
  return clients.filter(
    (c): c is T & { type: 'connected' } =>
      c.type === 'connected' &&
      isInAllowlist(c.name, c.config?.pluginSource) &&
      Boolean(c.capabilities?.experimental?.['gakrcli/channel']) &&
      Boolean(c.capabilities?.experimental?.['gakrcli/channel/permission']),
  )
}

/**
 * Factory for the callbacks object. The pending Map is closed over — NOT
 * module-level (per src/GAKRCLI.md), NOT in AppState (functions-in-state
 * causes issues with equality/serialization). Same lifetime pattern as
 * `replBridgePermissionCallbacks`: constructed once per session inside
 * a React hook, stable reference stored in AppState.
 *
 * resolve() is called from the dedicated notification handler
 * (notifications/gakrcli/channel/permission) with the structured payload.
 * The server already parsed "yes tbxkq" → {request_id, behavior}; we just
 * match against the pending map. No regex on CC's side — text in the
 * general channel can't accidentally approve anything.
 */
export function createChannelPermissionCallbacks(): ChannelPermissionCallbacks {
  const pending = new Map<
    string,
    (response: ChannelPermissionResponse) => void
  >()

  return {
    onResponse(requestId, handler) {
      // Lowercase here too — resolve() already does; asymmetry means a
      // future caller passing a mixed-case ID would silently never match.
      // shortRequestId always emits lowercase so this is a noop today,
      // but the symmetry makes the contract explicit.
      const key = requestId.toLowerCase()
      pending.set(key, handler)
      return () => {
        pending.delete(key)
      }
    },

    resolve(requestId, behavior, fromServer) {
      const key = requestId.toLowerCase()
      const resolver = pending.get(key)
      if (!resolver) return false
      // Delete BEFORE calling — if resolver throws or re-enters, the
      // entry is already gone. Also handles duplicate events (second
      // emission falls through — server bug or network dup, ignore).
      pending.delete(key)
      resolver({ behavior, fromServer })
      return true
    },
  }
}
