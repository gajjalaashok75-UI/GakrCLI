/**
 * Quick Panel UI primitives.
 *
 * Provides the shadow-DOM host, panel shell, AI chat panel, message renderer,
 * search input, quick entries, and stylesheet.
 */

// ============================================================
// Shadow DOM host
// ============================================================

export {
  mountQuickPanelShadowHost,
  type QuickPanelShadowHostElements,
  type QuickPanelShadowHostManager,
  type QuickPanelShadowHostOptions,
} from './shadow-host';

// ============================================================
// Panel shell (unified container)
// ============================================================

export {
  mountQuickPanelShell,
  type QuickPanelShellElements,
  type QuickPanelShellManager,
  type QuickPanelShellOptions,
} from './panel-shell';

// ============================================================
// AI Chat
// ============================================================

export {
  mountQuickPanelAiChatPanel,
  type QuickPanelAiChatPanelManager,
  type QuickPanelAiChatPanelOptions,
  type QuickPanelAiChatPanelState,
} from './ai-chat-panel';

export { createQuickPanelMessageRenderer } from './message-renderer';
export type {
  QuickPanelMessageRenderer,
  QuickPanelMessageRendererOptions,
} from './message-renderer';

// ============================================================
// Search UI
// ============================================================

export {
  createSearchInput,
  type SearchInputManager,
  type SearchInputOptions,
  type SearchInputState,
} from './search-input';

export { createQuickEntries } from './quick-entries';
export type { QuickEntriesManager, QuickEntriesOptions } from './quick-entries';

// ============================================================
// Styles
// ============================================================

export { QUICK_PANEL_STYLES } from './styles';
