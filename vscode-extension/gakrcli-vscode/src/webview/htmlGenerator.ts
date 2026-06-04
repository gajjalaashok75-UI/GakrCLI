import type * as VSCode from 'vscode';
import * as crypto from 'crypto';
import { vscode } from '../vscodeCompat';

/** Generate a cryptographic nonce for Content Security Policy. */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Escape a string for use in an HTML attribute value.
 * Prevents XSS via data attributes (e.g., initial prompt injection).
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Detect the current VS Code color theme kind.
 * Maps vscode.ColorThemeKind to a simple string the webview can use.
 */
export function getThemeKind(): 'dark' | 'light' | 'high-contrast' {
  const kind = vscode.window.activeColorTheme.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light:
    case vscode.ColorThemeKind.HighContrastLight:
      return 'light';
    case vscode.ColorThemeKind.HighContrast:
      return 'high-contrast';
    case vscode.ColorThemeKind.Dark:
    default:
      return 'dark';
  }
}

/** Read font configuration from VS Code settings. */
export function getFontConfig(): {
  editorFontFamily: string;
  editorFontSize: number;
  editorFontWeight: string;
  chatFontSize: number;
  chatFontFamily: string;
} {
  const editorConfig = vscode.workspace.getConfiguration('chat.editor');
  let editorFontFamily = editorConfig.get<string>('fontFamily') || 'default';
  if (editorFontFamily === 'default') {
    editorFontFamily = 'monospace';
  }
  const editorFontSize = editorConfig.get<number>('fontSize') || 12;
  const editorFontWeight = editorConfig.get<string>('fontWeight') || 'normal';

  const chatConfig = vscode.workspace.getConfiguration('chat');
  const chatFontSize = chatConfig.get<number>('fontSize') || 13;
  let chatFontFamily = chatConfig.get<string>('fontFamily') || 'default';
  if (chatFontFamily === 'default') {
    chatFontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif";
  }

  return { editorFontFamily, editorFontSize, editorFontWeight, chatFontSize, chatFontFamily };
}

export interface HtmlGeneratorOptions {
  webview: VSCode.Webview;
  extensionUri: VSCode.Uri;
  isSidebar: boolean;
  isFullEditor?: boolean;
  isSessionListOnly?: boolean;
  initialSessionId?: string;
  initialPrompt?: string;
}

/**
 * Generate the full HTML for a webview panel.
 *
 * Key patterns preserved:
 * - Nonce-based CSP (no 'unsafe-eval', no external URLs)
 * - CSS custom properties for font config
 * - data-* attributes on #root for initial state
 * - Window globals for panel type (IS_SIDEBAR, IS_FULL_EDITOR, IS_SESSION_LIST_ONLY)
 * - Script loaded as type="module" with nonce
 */
export function generateWebviewHtml(options: HtmlGeneratorOptions): string {
  const { webview, extensionUri, isSidebar, isFullEditor, isSessionListOnly, initialSessionId, initialPrompt } = options;

  const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.css'));

  const nonce = generateNonce();
  const fonts = getFontConfig();
  const theme = getThemeKind();

  const styleSrc = `style-src ${webview.cspSource} 'unsafe-inline'`;
  const fontSrc = `font-src ${webview.cspSource}`;
  const imgSrc = `img-src ${webview.cspSource} data:`;
  const workerSrc = `worker-src ${webview.cspSource}`;

  // Build data attributes for #root
  let dataAttrs = '';
  if (initialPrompt) {
    dataAttrs += ` data-initial-prompt="${escapeHtmlAttribute(initialPrompt)}"`;
  }
  if (initialSessionId) {
    dataAttrs += ` data-initial-session="${escapeHtmlAttribute(initialSessionId)}"`;
  }
  dataAttrs += ` data-theme="${escapeHtmlAttribute(theme)}"`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <!--
    Use a content security policy to only allow loading images from our extension directory or data URIs,
    and only allow scripts that have a specific nonce.
    Note: External https: URLs are blocked to prevent data exfiltration via markdown image URLs.
  -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${styleSrc}; ${fontSrc}; ${imgSrc}; script-src 'nonce-${nonce}'; ${workerSrc};">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <style>
    :root {
      --vscode-editor-font-family: ${fonts.editorFontFamily} !important;
      --vscode-editor-font-size: ${fonts.editorFontSize}px !important;
      --vscode-editor-font-weight: ${fonts.editorFontWeight} !important;
      --vscode-chat-font-size: ${fonts.chatFontSize}px;
      --vscode-chat-font-family: ${fonts.chatFontFamily};
    }
  </style>
</head>
<body>
  <pre id="gakrcli-error"></pre>
  <div id="root"${dataAttrs}></div>
  <script nonce="${nonce}">
    window.IS_SIDEBAR = ${isSidebar ? 'true' : 'false'};
    window.IS_FULL_EDITOR = ${isFullEditor ? 'true' : 'false'};
    window.IS_SESSION_LIST_ONLY = ${isSessionListOnly ? 'true' : 'false'};
  </script>
  <script nonce="${nonce}" src="${scriptUri}" type="module"></script>
</body>
</html>`;
}
