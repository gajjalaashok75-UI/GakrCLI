/**
 * Inert stub for inter-GakrCLI (peer session) messaging over the REPL bridge.
 *
 * The real implementation is not part of this source tree; the bundler
 * noop-stubs this specifier in builds where `feature('UDS_INBOX')` is
 * disabled. This module preserves that behavior: no bridge traffic is sent
 * and no import-time side effects occur.
 */

/** Result of attempting to post a message to a peer session. */
export type PostInterGakrCLIMessageResult = {
  ok: boolean
  error?: string
}

/**
 * Post a message to another GakrCLI session via the REPL bridge.
 * Inert: delivery is impossible without the real bridge client, so this
 * always resolves with a failure result (callers surface `error` to the
 * model rather than throwing).
 */
export async function postInterGakrCLIMessage(
  _target: string,
  _message: string,
): Promise<PostInterGakrCLIMessageResult> {
  return {
    ok: false,
    error: 'inter-session messaging is unavailable in this build',
  }
}
