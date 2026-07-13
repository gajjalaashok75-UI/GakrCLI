// src/auth/authStatusCheck.ts
//
// Checks whether the user is logged into gakrcli by shelling out to
// `gakrcli auth status --json` (documented in docs/gakrcli-subarguments.md,
// and confirmed against a real run, which returns e.g.:
//   { "loggedIn": true, "authMethod": "third_party", "apiProvider": "nvidia-nim" }

import { execFile } from 'child_process';

export interface AuthStatusResult {
  /** true = confirmed logged in, false = confirmed logged out, undefined = couldn't tell */
  loggedIn: boolean | undefined;
  authMethod?: string;
  apiProvider?: string;
  email?: string;
  raw?: unknown;
}

/**
 * Runs `<executable> auth status --json` as a short-lived one-off process
 * (completely separate from the main long-running NDJSON CLI process) and
 * tries to determine login state from the output.
 */
export function checkAuthStatus(executable: string, cwd: string, timeoutMs = 8000): Promise<AuthStatusResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: AuthStatusResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const child = execFile(
        executable,
        ['auth', 'status', '--json'],
        { cwd, timeout: timeoutMs, windowsHide: true },
        (error, stdout) => {
          if (error) {
            // Non-zero exit or spawn failure — could mean "not logged in"
            // (some CLIs exit non-zero for that) or could mean the command
            // doesn't exist / errored for an unrelated reason. Too ambiguous
            // to report either way without a confirmed example, so treat as
            // unknown rather than guessing.
            done({ loggedIn: undefined });
            return;
          }
          try {
            const parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
            done({
              loggedIn: interpretAuthStatusJson(parsed),
              authMethod: typeof parsed.authMethod === 'string' ? parsed.authMethod : undefined,
              apiProvider: typeof parsed.apiProvider === 'string' ? parsed.apiProvider : undefined,
              email: extractEmail(parsed),
              raw: parsed,
            });
          } catch {
            done({ loggedIn: undefined });
          }
        },
      );
      child.on('error', () => done({ loggedIn: undefined }));
    } catch {
      done({ loggedIn: undefined });
    }
  });
}

/**
 * Tries several plausible shapes for the JSON output. Only returns a
 * definite true/false when reasonably confident; otherwise undefined.
 */
function interpretAuthStatusJson(data: Record<string, unknown>): boolean | undefined {
  // Common explicit boolean fields
  for (const key of ['loggedIn', 'isLoggedIn', 'authenticated', 'isAuthenticated', 'loggedOut']) {
    const v = data[key];
    if (typeof v === 'boolean') {
      return key === 'loggedOut' ? !v : v;
    }
  }
  // Common explicit status strings
  const status = data.status;
  if (typeof status === 'string') {
    const s = status.toLowerCase();
    if (['authenticated', 'logged_in', 'loggedin', 'ok', 'active'].includes(s)) return true;
    if (['unauthenticated', 'logged_out', 'loggedout', 'not_authenticated', 'none'].includes(s)) return false;
  }
  // Heuristic: presence of account-identifying fields usually means logged in
  if (typeof data.email === 'string' && data.email) return true;
  if (typeof data.organization === 'string' && data.organization) return true;
  if (typeof data.apiKeySource === 'string' && data.apiKeySource) return true;

  return undefined;
}

function extractEmail(data: Record<string, unknown>): string | undefined {
  return typeof data.email === 'string' ? data.email : undefined;
}
