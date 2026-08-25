// Type-only import: erased at compile time, so bundling this module does NOT
// pull @anthropic-ai/bedrock-sdk (and its static @aws-sdk/client-bedrock-runtime
// import) into the CLI bundle. The runtime class arrives as a parameter instead
// — see createBedrockClientClass below and the loader in
// services/api/client.ts.
import type { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk'

/**
 * Extends AnthropicBedrock to work around an upstream bug where the SDK
 * re-plants the `anthropic-beta` HTTP header value into the request body
 * as `anthropic_beta`. Bedrock's Opus 4.7 endpoint rejects any request with
 * `anthropic_beta` in the body with a 400 "invalid beta flag" error.
 *
 * Source of the bug (SDK 0.26.4, still present through 0.29.1):
 *   node_modules/@anthropic-ai/bedrock-sdk/client.js lines 122-127
 *   (TS source: packages/bedrock-sdk/src/client.ts lines 193-198)
 *
 * Related upstream issue: anthropics/gakrcli-code#49238 (opened 2026-04-16).
 *
 * Fix strategy: let super.buildRequest do its work, then strip
 * `body.anthropic_beta` from the resulting Request before the SDK computes
 * the AWS SigV4 signature (signing happens downstream of buildRequest, so
 * the signature hashes the cleaned body — no 403 risk). The `anthropic-beta`
 * HTTP header remains intact (base SDK placed it there from the `betas:`
 * parameter), so beta flags still reach the API the way Bedrock accepts them.
 *
 * Delivered as a factory over the base class rather than a plain
 * `class X extends AnthropicBedrock` because the SDK is loaded on demand
 * through importOptionalRuntimeModuleForClient; a static `extends` would need a
 * value import and defeat that.
 *
 * When upstream ships a fix, confirm the "BUG REPRO" case in
 * __tests__/bedrockClient.test.ts starts failing (i.e. the base class no longer
 * puts `anthropic_beta` in the body), then delete this module and change
 * `services/api/client.ts` to instantiate `AnthropicBedrock` directly.
 */
type BuildRequestArg = Parameters<AnthropicBedrock['buildRequest']>[0]
type BuildRequestRet = Awaited<ReturnType<AnthropicBedrock['buildRequest']>>

// One subclass per base class. Rebuilding it on every createClient() call would
// hand V8 a fresh prototype chain each time and break `instanceof` identity
// between clients.
const subclassCache = new WeakMap<object, typeof AnthropicBedrock>()

/**
 * Build the patched Bedrock client class from a runtime-loaded
 * `AnthropicBedrock`. Cached per base class, so repeated calls return the
 * identical constructor.
 */
export function createBedrockClientClass(
  Base: typeof AnthropicBedrock,
): typeof AnthropicBedrock {
  const cached = subclassCache.get(Base)
  if (cached) {
    return cached
  }

  class BedrockClient extends Base {
    async buildRequest(options: BuildRequestArg): Promise<BuildRequestRet> {
      const req = await super.buildRequest(options)

      const inner = (
        req as unknown as { req?: { body?: unknown; headers?: unknown } }
      )?.req
      if (!inner || typeof inner.body !== 'string' || inner.body.length === 0) {
        return req
      }

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(inner.body) as Record<string, unknown>
      } catch {
        return req
      }
      if (!('anthropic_beta' in parsed)) {
        return req
      }

      delete parsed.anthropic_beta
      const cleanedBody = JSON.stringify(parsed)
      inner.body = cleanedBody

      const byteLen = String(new TextEncoder().encode(cleanedBody).length)
      const h = inner.headers
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        if (h.has('content-length')) h.set('content-length', byteLen)
      } else if (h && typeof h === 'object') {
        const asDict = h as Record<string, string>
        if ('content-length' in asDict) asDict['content-length'] = byteLen
      }

      return req
    }
  }

  subclassCache.set(Base, BedrockClient)
  return BedrockClient
}
