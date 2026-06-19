// src/uriHandler.ts
// Pure URI parsing helper for the GakrCLI URI handler.
// Handles: vscode://gajjalaashok75-UI.gakrcli-vscode/open?prompt=...&session=...

import type * as vscode from 'vscode';

export interface ParsedGakrCLIUri {
  prompt?: string;
  session?: string;
}

/**
 * Parse an GakrCLI deep-link URI and extract supported query parameters.
 * Throws if the URI is structurally malformed (e.g. unparseable query string).
 */
export function parseGakrCLIUri(uri: vscode.Uri): ParsedGakrCLIUri {
  const query = uri.query;
  if (!query) {
    return {};
  }

  const params = new URLSearchParams(query);
  const result: ParsedGakrCLIUri = {};

  const prompt = params.get('prompt');
  if (prompt !== null && prompt.trim() !== '') {
    result.prompt = prompt;
  }

  const session = params.get('session');
  if (session !== null && session.trim() !== '') {
    result.session = session;
  }

  return result;
}
