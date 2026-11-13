/**
 * Side panel composables.
 *
 * The side panel is a terminal: it streams I/O to a real `gakrcli --chrome`
 * PTY through the `gakrcli --chrome-extension` backend. The only composables
 * left are the terminal client and the shared theme.
 */
export { useTerminalBackend } from './useTerminalBackend';
export type {
  UseTerminalBackend,
  UseTerminalBackendHandlers,
  TerminalBackendRole,
  TerminalConnectionState,
  TerminalHistoryChunk,
} from './useTerminalBackend';

export { useAgentTheme, preloadAgentTheme, THEME_LABELS } from './useAgentTheme';
export type { AgentThemeId, UseAgentTheme } from './useAgentTheme';
