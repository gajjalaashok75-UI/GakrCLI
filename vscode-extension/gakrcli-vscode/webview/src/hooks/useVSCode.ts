import { useEffect, useCallback, useRef, useState } from 'react';
import { vscode, type HostToWebviewMessageBase, type WebviewPersistedState } from '../vscode';

/**
 * React hook for interacting with the VS Code extension host.
 *
 * Provides:
 * - sendMessage(): typed message sending
 * - useMessageListener(): subscribe to specific message types
 * - state persistence via getState/setState
 */
export function useVSCode() {
  const sendMessage = useCallback((type: string, payload?: Record<string, unknown>) => {
    vscode.postMessage({ type, ...payload });
  }, []);

  const getState = useCallback((): WebviewPersistedState | undefined => {
    return vscode.getState();
  }, []);

  const setState = useCallback((state: WebviewPersistedState) => {
    vscode.setState(state);
  }, []);

  const updateState = useCallback((partial: Partial<WebviewPersistedState>) => {
    vscode.updateState(partial);
  }, []);

  return { sendMessage, getState, setState, updateState, isVSCode: vscode.isVSCode };
}

/**
 * React hook that subscribes to a specific message type from the extension host.
 * Automatically unsubscribes on unmount.
 *
 * Usage:
 *   useMessageListener('init_state', (msg) => { setTheme(msg.theme); });
 */
export function useMessageListener<T extends HostToWebviewMessageBase>(
  type: string,
  handler: (message: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = vscode.onMessage(type, (message) => {
      handlerRef.current(message as T);
    });
    return unsubscribe;
  }, [type]);
}

/**
 * React hook that subscribes to ALL messages from the extension host.
 */
export function useAnyMessageListener(
  handler: (message: HostToWebviewMessageBase) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = vscode.onAnyMessage((message) => {
      handlerRef.current(message);
    });
    return unsubscribe;
  }, []);
}

/**
 * React hook that persists a value in webview state.
 * Like useState, but the value survives the webview being hidden and re-shown.
 *
 * Usage:
 *   const [draft, setDraft] = usePersistedState('draftText', '');
 */
export function usePersistedState<K extends keyof WebviewPersistedState>(
  key: K,
  defaultValue: NonNullable<WebviewPersistedState[K]>,
): [NonNullable<WebviewPersistedState[K]>, (value: NonNullable<WebviewPersistedState[K]>) => void] {
  const [value, setValueInternal] = useState<NonNullable<WebviewPersistedState[K]>>(() => {
    const saved = vscode.getState();
    if (saved && key in saved && saved[key] !== undefined) {
      return saved[key] as NonNullable<WebviewPersistedState[K]>;
    }
    return defaultValue;
  });

  const setValue = useCallback(
    (newValue: NonNullable<WebviewPersistedState[K]>) => {
      setValueInternal(newValue);
      vscode.updateState({ [key]: newValue } as Partial<WebviewPersistedState>);
    },
    [key],
  );

  return [value, setValue];
}
