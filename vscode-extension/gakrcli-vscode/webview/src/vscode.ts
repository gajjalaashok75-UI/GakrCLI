/**
 * Typed VS Code API wrapper for the webview side.
 *
 * This wraps the acquireVsCodeApi() singleton and provides:
 * - Typed postMessage sending (WebviewToHostMessage)
 * - State persistence via getState/setState
 * - Message listening with type filtering
 *
 * The VS Code API can only be acquired once — this module caches it.
 *
 * Pattern from VS Code webviews:
 *   vscode.postMessage({ type: 'ready' });
 *   vscode.postMessage({ type: 'comment', id: N.id, ... });
 */

// Import types from the shared type definitions
// During build, these are resolved by Vite's alias config
// At runtime, the extension host defines the message contract

/** Message types the webview can send to the extension host */
export interface WebviewToHostMessageBase {
  type: string;
  [key: string]: unknown;
}

/** Message types the extension host can send to the webview */
export interface HostToWebviewMessageBase {
  type: string;
  [key: string]: unknown;
}

/** Webview persisted state shape */
export interface WebviewPersistedState {
  /** Scroll position of the message list */
  scrollTop?: number;
  /** Draft text in the input field */
  draftText?: string;
  /** Current session ID */
  sessionId?: string;
  /** Whether the user has scrolled up (paused auto-scroll) */
  isScrollPaused?: boolean;
  /** Collapsed tool call block IDs */
  collapsedToolCalls?: string[];
  /** Custom data from components */
  [key: string]: unknown;
}

type MessageListener = (message: HostToWebviewMessageBase) => void;

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): WebviewPersistedState | undefined;
  setState(state: WebviewPersistedState): void;
}

class VSCodeAPIWrapper {
  private readonly api: VSCodeApi | undefined;
  private listeners: Map<string, Set<MessageListener>> = new Map();
  private globalListeners: Set<MessageListener> = new Set();

  constructor() {
    // acquireVsCodeApi is injected by VS Code into the webview context
    if (typeof acquireVsCodeApi === 'function') {
      this.api = acquireVsCodeApi() as VSCodeApi;
    }

    // Listen for messages from the extension host
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as HostToWebviewMessageBase;
      if (!message || typeof message.type !== 'string') return;

      // Dispatch to type-specific listeners
      const typeListeners = this.listeners.get(message.type);
      if (typeListeners) {
        for (const listener of typeListeners) {
          try {
            listener(message);
          } catch (err) {
            console.error(`Error in message listener for '${message.type}':`, err);
          }
        }
      }

      // Dispatch to global listeners
      for (const listener of this.globalListeners) {
        try {
          listener(message);
        } catch (err) {
          console.error('Error in global message listener:', err);
        }
      }
    });
  }

  /**
   * Send a typed message to the extension host.
   */
  postMessage(message: WebviewToHostMessageBase): void {
    if (this.api) {
      this.api.postMessage(message);
    } else {
      console.log('[GakrCLI] VS Code API not available, message:', message);
    }
  }

  /**
   * Listen for a specific message type from the extension host.
   * Returns an unsubscribe function.
   */
  onMessage(type: string, listener: MessageListener): () => void {
    let typeSet = this.listeners.get(type);
    if (!typeSet) {
      typeSet = new Set();
      this.listeners.set(type, typeSet);
    }
    typeSet.add(listener);

    return () => {
      typeSet!.delete(listener);
      if (typeSet!.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Listen for ALL messages from the extension host.
   * Returns an unsubscribe function.
   */
  onAnyMessage(listener: MessageListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Get persisted webview state.
   * This survives the webview being hidden and re-shown (retainContextWhenHidden),
   * and also survives VS Code restarts (via WebviewPanelSerializer).
   */
  getState(): WebviewPersistedState | undefined {
    return this.api?.getState();
  }

  /**
   * Persist webview state.
   * Call this when the user types in the input, scrolls, etc.
   */
  setState(state: WebviewPersistedState): void {
    this.api?.setState(state);
  }

  /**
   * Update a single key in the persisted state without overwriting other keys.
   */
  updateState(partial: Partial<WebviewPersistedState>): void {
    const current = this.getState() || {};
    this.setState({ ...current, ...partial });
  }

  /**
   * Check if we're running inside a VS Code webview.
   */
  get isVSCode(): boolean {
    return this.api !== undefined;
  }
}

// Singleton — acquireVsCodeApi can only be called once
export const vscode = new VSCodeAPIWrapper();
