/**
 * Global type declaration for the VS Code webview API.
 * This function is injected by VS Code into the webview's JavaScript context.
 * It can only be called once — subsequent calls throw an error.
 */
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

/**
 * Window globals set by the extension host in the HTML template.
 * See htmlGenerator.ts — these are set in a <script> tag before the main bundle.
 */
interface Window {
  IS_SIDEBAR: boolean;
  IS_FULL_EDITOR: boolean;
  IS_SESSION_LIST_ONLY: boolean;
}
