/**
 * `<secret>key</secret>` placeholder substitution for WebBrowserTool.
 *
 * Ported from `references/browser-use-main/src/controller/registry/service.ts`'s
 * `replace_sensitive_data`. The LLM writes `<secret>key_name</secret>` in any
 * string-typed action parameter; this module walks the input tree, looks the
 * key up in `sensitive_data`, and substitutes the real value before
 * dispatching to the server. Keys ending in `bu_2fa_code` (or `totp`) get
 * a freshly generated TOTP code instead of the stored secret.
 *
 * Two-step filtering: each `sensitive_data` entry is either a flat key/value
 * or a domain-keyed object (`{ "example.com": { username: "...", password: "..." } }`).
 * When `currentUrl` is provided, only matching domain entries are exposed; flat
 * entries are always available.
 */
import { generateTotpCode } from './totp.js';

export type SensitiveDataMap = Record<string, string | Record<string, string>>;

const SECRET_TAG_PATTERN = /<secret>(.*?)<\/secret>/g;
const TOTP_SUFFIXES = ['bu_2fa_code', 'totp'] as const;

const isTotpKey = (key: string): boolean =>
  TOTP_SUFFIXES.some((suffix) => key.endsWith(suffix));

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, cloneValue(v)]),
    ) as unknown as T;
  }
  return value;
};

const hostMatches = (url: string, pattern: string): boolean => {
  if (!url || !pattern) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const p = pattern.toLowerCase();
    if (p === host) return true;
    if (p.startsWith('*.')) {
      const base = p.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return false;
  } catch {
    return false;
  }
};

/** Returns the subset of `sensitiveData` applicable to the given URL. */
export const selectApplicableSecrets = (
  sensitiveData: SensitiveDataMap | null | undefined,
  currentUrl: string | null | undefined,
): Record<string, string> => {
  const out: Record<string, string> = Object.create(null);
  if (!sensitiveData) return out;
  for (const [keyOrDomain, content] of Object.entries(sensitiveData)) {
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      if (currentUrl && hostMatches(currentUrl, keyOrDomain)) {
        Object.assign(out, content);
      }
    } else if (typeof content === 'string' && content) {
      out[keyOrDomain] = content;
    }
  }
  // Drop empty values so a missing secret gets reported rather than silently
  // substituting an empty string.
  for (const key of Object.keys(out)) {
    if (!out[key]) delete out[key];
  }
  return out;
};

export interface SecretSubstitutionResult<T> {
  /** The input with `<secret>key</secret>` placeholders resolved. */
  processed: T;
  /** Placeholders that appeared in the input but had no matching key. */
  missing: string[];
  /** Placeholders that were resolved (for telemetry/logging). */
  replaced: string[];
}

/**
 * Walk `input`, replace `<secret>key</secret>` tags inside any string-typed
 * field with values from `applicableSecrets`. Keys ending in `bu_2fa_code` or
 * `totp` resolve to a fresh TOTP code. Placeholders with no matching key are
 * left untouched (and tracked in `missing`).
 */
export const substituteSecrets = <T>(
  input: T,
  applicableSecrets: Record<string, string>,
): SecretSubstitutionResult<T> => {
  const processed = cloneValue(input);
  const missing: string[] = [];
  const replaced: string[] = [];
  const seenMissing = new Set<string>();

  const resolve = (placeholder: string): string => {
    replaced.push(placeholder);
    const value = applicableSecrets[placeholder];
    return isTotpKey(placeholder) ? generateTotpCode(value) : value;
  };

  const traverse = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const withTags = value.replace(SECRET_TAG_PATTERN, (_, placeholderRaw) => {
        const placeholder = String(placeholderRaw);
        if (placeholder in applicableSecrets) return resolve(placeholder);
        if (!seenMissing.has(placeholder)) {
          seenMissing.add(placeholder);
          missing.push(placeholder);
        }
        return `<secret>${placeholder}</secret>`;
      });
      // Literal placeholder: handles the LLM forgetting the tags but using
      // the exact key name.
      if (withTags in applicableSecrets && withTags.indexOf('<') === -1) {
        return resolve(withTags);
      }
      return withTags;
    }
    if (Array.isArray(value)) return value.map(traverse);
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        (value as Record<string, unknown>)[k] = traverse(v);
      }
    }
    return value;
  };

  traverse(processed);
  return { processed, missing, replaced };
};

/**
 * Redact a string so the contents of `applicableSecrets` never appear in
 * returned text, logs, or error messages. Empty/no-op when no secrets are
 * configured. Used to scrub observation text before returning to the LLM.
 */
export const redactSecretsFromString = (
  value: string,
  applicableSecrets: Record<string, string>,
): string => {
  const entries = Object.entries(applicableSecrets).sort(
    ([, a], [, b]) => b.length - a.length,
  );
  let out = value;
  for (const [, secret] of entries) {
    if (!secret) continue;
    out = out.split(secret).join('<redacted>');
  }
  return out;
};
