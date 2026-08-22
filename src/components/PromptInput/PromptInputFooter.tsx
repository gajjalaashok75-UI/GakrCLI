import { feature } from 'bun:bundle';
import * as React from 'react';
import { memo, type ReactNode, useMemo, useRef, useState } from 'react';
import { isBridgeEnabled } from '../../bridge/bridgeEnabled.js';
import { getBridgeStatus } from '../../bridge/bridgeStatusUtil.js';
import { useSetPromptOverlay } from '../../context/promptOverlayContext.js';
import type { VerificationStatus } from '../../hooks/useApiKeyVerification.js';
import type { IDESelection } from '../../hooks/useIdeSelection.js';
import { type ReadonlySettings, useSettings } from '../../hooks/useSettings.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, Text, useInput } from '../../ink.js';
import type { MCPServerConnection } from '../../services/mcp/types.js';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import type { ToolPermissionContext } from '../../Tool.js';
import type { Message } from '../../types/message.js';
import type { PromptInputMode, VimMode } from '../../types/textInputTypes.js';
import type { AutoUpdaterResult } from '../../utils/autoUpdater.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import { getGlobalConfig } from '../../utils/config.js';
import { BuiltinStatusLine, builtinStatusLineShouldDisplay } from '../BuiltinStatusLine.js';
import { getPipeDisplayRole, isPipeControlled } from '../../utils/pipeTransport.js';
import { CoordinatorTaskPanel, useCoordinatorTaskCount } from '../CoordinatorAgentStatus.js';
import { getLastAssistantMessageId, StatusLine, statusLineShouldDisplay } from '../StatusLine.js';
import { Notifications } from './Notifications.js';
import { KeepMounted } from './KeepMounted.js';
import { PromptInputFooterLeftSide } from './PromptInputFooterLeftSide.js';

// Inline pipe status is shown only after /pipes sets pipeIpc.statusVisible.
import { PromptInputFooterSuggestions, type SuggestionItem } from './PromptInputFooterSuggestions.js';
import { PromptInputHelpMenu } from './PromptInputHelpMenu.js';
/**
 * Which status line, if any, the footer renders below the prompt: the
 * configured custom command wins over the built-in one, and neither renders
 * when the row's guards fail (non-prompt mode, short fullscreen, exit
 * message showing, paste in progress). The `? for shortcuts` hint is
 * suppressed only when this returns non-null, so the hint never disappears
 * in states where no status line actually renders.
 */
export function resolveFooterStatusLine(settings: ReadonlySettings, guards: {
  isPromptMode: boolean;
  isShort: boolean;
  exitMessageShown: boolean;
  isPasting: boolean;
}, config?: Parameters<typeof builtinStatusLineShouldDisplay>[1]): 'custom' | 'builtin' | null {
  if (!guards.isPromptMode || guards.isShort || guards.exitMessageShown || guards.isPasting) return null;
  if (statusLineShouldDisplay(settings)) return 'custom';
  if (builtinStatusLineShouldDisplay(settings, config)) return 'builtin';
  return null;
}

export function resolveConfiguredFooterStatusLine(settings: ReadonlySettings): 'custom' | 'builtin' | null {
  return resolveFooterStatusLine(settings, {
    isPromptMode: true,
    isShort: false,
    exitMessageShown: false,
    isPasting: false
  });
}

export const SHORTCUTS_HINT_STARTUP_GRACE = 10;
export function shouldSuppressShortcutsHint(args: {
  suppressedByCaller: boolean;
  footerStatusLine: 'custom' | 'builtin' | null;
  isSearching: boolean;
  numStartups: number;
}): boolean {
  if (args.suppressedByCaller || args.isSearching) return true;
  if (args.footerStatusLine === 'custom') return true;
  return args.footerStatusLine === 'builtin' && args.numStartups > SHORTCUTS_HINT_STARTUP_GRACE;
}

type Props = {
  apiKeyStatus: VerificationStatus;
  debug: boolean;
  exitMessage: {
    show: boolean;
    key?: string;
  };
  vimMode: VimMode | undefined;
  mode: PromptInputMode;
  autoUpdaterResult: AutoUpdaterResult | null;
  isAutoUpdating: boolean;
  verbose: boolean;
  onAutoUpdaterResult: (result: AutoUpdaterResult) => void;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  suggestions: SuggestionItem[];
  selectedSuggestion: number;
  maxColumnWidth?: number;
  toolPermissionContext: ToolPermissionContext;
  helpOpen: boolean;
  suppressHint: boolean;
  isLoading: boolean;
  tasksSelected: boolean;
  teamsSelected: boolean;
  bridgeSelected: boolean;
  tmuxSelected: boolean;
  bagelSelected: boolean;
  teammateFooterIndex?: number;
  ideSelection: IDESelection | undefined;
  mcpClients?: MCPServerConnection[];
  isPasting?: boolean;
  isInputWrapped?: boolean;
  messages: Message[];
  isSearching: boolean;
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  historyFailedMatch: boolean;
  onOpenTasksDialog?: (taskId?: string) => void;
};

function PromptInputFooter({
  apiKeyStatus,
  debug,
  exitMessage,
  vimMode,
  mode,
  autoUpdaterResult,
  isAutoUpdating,
  verbose,
  onAutoUpdaterResult,
  onChangeIsUpdating,
  suggestions,
  selectedSuggestion,
  maxColumnWidth,
  toolPermissionContext,
  helpOpen,
  suppressHint: suppressHintFromProps,
  isLoading,
  tasksSelected,
  teamsSelected,
  bridgeSelected,
  tmuxSelected,
  bagelSelected,
  teammateFooterIndex,
  ideSelection,
  mcpClients,
  isPasting = false,
  isInputWrapped = false,
  messages,
  isSearching,
  historyQuery,
  setHistoryQuery,
  historyFailedMatch,
  onOpenTasksDialog,
}: Props): ReactNode {
  const settings = useSettings();
  const { columns, rows } = useTerminalSize();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const lastAssistantMessageId = useMemo(() => getLastAssistantMessageId(messages), [messages]);
  const isNarrow = columns < 80;
  // In fullscreen the bottom slot is flexShrink:0, so every row here is a row
  // stolen from the ScrollBox. Drop the optional StatusLine first. Non-fullscreen
  // has terminal scrollback to absorb overflow, so we never hide StatusLine there.
  const isFullscreen = isFullscreenEnvEnabled();
  const isShort = isFullscreen && rows < 24;

  // Pill highlights when tasks is the active footer item AND no specific
  // agent row is selected. When coordinatorTaskIndex >= 0 the pointer has
  // moved into CoordinatorTaskPanel, so the pill should un-highlight.
  // coordinatorTaskCount === 0 covers the bash-only case (no agent rows
  // exist, pill is the only selectable item).
  const coordinatorTaskCount = useCoordinatorTaskCount();
  const coordinatorTaskIndex = useAppState(s => s.coordinatorTaskIndex);
  const pillSelected = tasksSelected && (coordinatorTaskCount === 0 || coordinatorTaskIndex < 0);

  const footerStatusLine = resolveFooterStatusLine(settings, {
    isPromptMode: mode === 'prompt',
    isShort,
    exitMessageShown: exitMessage.show,
    isPasting
  });
    const configuredFooterStatusLine = resolveConfiguredFooterStatusLine(settings);
  // Hide `? for shortcuts` during ctrl-r search, or — for established users
  // only — when a status line actually renders below (display setting AND
  // render guards). See shouldSuppressShortcutsHint.
  const suppressHint = shouldSuppressShortcutsHint({
    suppressedByCaller: suppressHintFromProps,
    footerStatusLine,
    isSearching,
    numStartups: getGlobalConfig().numStartups
  });
  // Fullscreen: portal data to FullscreenLayout — see promptOverlayContext.tsx
  const overlayData = useMemo(
    () => (isFullscreen && suggestions.length ? { suggestions, selectedSuggestion, maxColumnWidth } : null),
    [isFullscreen, suggestions, selectedSuggestion, maxColumnWidth],
  );
  useSetPromptOverlay(overlayData);

  const showInlineSuggestions = suggestions.length > 0 && !isFullscreen;
  // History search owns the footer while active; otherwise suggestions beat
  // help (see resolveFooterOverlay).
  const footerOverlay = isSearching
    ? null
    : showInlineSuggestions
      ? 'suggestions'
      : helpOpen
        ? 'help'
        : null;
  const hideRegularFooter = footerOverlay !== null;

  return (
    <>
    <KeepMounted hidden={hideRegularFooter}>
      <Box
        flexDirection={isNarrow ? 'column' : 'row'}
        justifyContent={isNarrow ? 'flex-start' : 'space-between'}
        paddingX={2}
        gap={isNarrow ? 0 : 1}
      >
        <Box flexDirection="column" flexShrink={isNarrow ? 0 : 1}>
          <KeepMounted hidden={footerStatusLine === null}>
          {configuredFooterStatusLine === 'custom' ? <StatusLine messagesRef={messagesRef} lastAssistantMessageId={lastAssistantMessageId} vimMode={vimMode} />
            : configuredFooterStatusLine === 'builtin' ? <BuiltinStatusLine messagesRef={messagesRef} lastAssistantMessageId={lastAssistantMessageId} /> : null}
          </KeepMounted>
          <PipeStatusInline />
          <PromptInputFooterLeftSide
            active={!hideRegularFooter}
            exitMessage={exitMessage}
            vimMode={vimMode}
            mode={mode}
            toolPermissionContext={toolPermissionContext}
            suppressHint={suppressHint}
            isLoading={isLoading}
            tasksSelected={pillSelected}
            teamsSelected={teamsSelected}
            teammateFooterIndex={teammateFooterIndex}
            tmuxSelected={tmuxSelected}
            bagelSelected={bagelSelected}
            isPasting={isPasting}
            isSearching={isSearching}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            historyFailedMatch={historyFailedMatch}
            onOpenTasksDialog={onOpenTasksDialog}
          />
        </Box>
        <Box flexShrink={1} gap={1}>
          {isFullscreen ? null : (
            <Notifications
              apiKeyStatus={apiKeyStatus}
              autoUpdaterResult={autoUpdaterResult}
              debug={debug}
              isAutoUpdating={isAutoUpdating}
              verbose={verbose}
              messages={messages}
              onAutoUpdaterResult={onAutoUpdaterResult}
              onChangeIsUpdating={onChangeIsUpdating}
              ideSelection={ideSelection}
              mcpClients={mcpClients}
              isInputWrapped={isInputWrapped}
              isNarrow={isNarrow}
            />
          )}
          <BridgeStatusIndicator bridgeSelected={bridgeSelected} />
        </Box>
      </Box>
    </KeepMounted>
    {footerOverlay === 'suggestions' ? <Box paddingX={2} paddingY={0}>
        <PromptInputFooterSuggestions suggestions={suggestions} selectedSuggestion={selectedSuggestion} maxColumnWidth={maxColumnWidth} />
      </Box> : footerOverlay === 'help' ? <PromptInputHelpMenu dimColor={true} fixedWidth={true} paddingX={2} /> : null}
  </>);
}

export default memo(PromptInputFooter);

type BridgeStatusProps = {
  bridgeSelected: boolean;
};

function BridgeStatusIndicator({ bridgeSelected }: BridgeStatusProps): React.ReactNode {
  if (!feature('BRIDGE_MODE')) return null;

  const enabled = useAppState(s => s.replBridgeEnabled);
  const connected = useAppState(s => s.replBridgeConnected);
  const sessionActive = useAppState(s => s.replBridgeSessionActive);
  const reconnecting = useAppState(s => s.replBridgeReconnecting);
  const explicit = useAppState(s => s.replBridgeExplicit);

  // Failed state is surfaced via notification (useReplBridge), not a footer pill.
  if (!isBridgeEnabled() || !enabled) return null;

  const status = getBridgeStatus({
    error: undefined,
    connected,
    sessionActive,
    reconnecting,
  });

  // For implicit (config-driven) remote, only show the reconnecting state
  if (!explicit && status.label !== 'Remote Control reconnecting') {
    return null;
  }

  return (
    <Text color={bridgeSelected ? 'background' : status.color} inverse={bridgeSelected} wrap="truncate">
      {status.label}
      {bridgeSelected && <Text dimColor> · Enter to view</Text>}
    </Text>
  );
}

/**
 * Inline pipe status panel with interactive checkbox selection.
 *
 * Shows after /pipes sets statusVisible. Displays:
 * - Header: own pipe info (collapsed mode)
 * - Ctrl+P: toggle expanded mode with sub list + checkboxes
 * - Expanded: ↑↓ to move cursor, Space to toggle, Enter/Esc to collapse
 *
 * Only uses AppState + Ink — no heavy external imports.
 */
function PipeStatusInline(): React.ReactNode {
  if (!feature('UDS_INBOX')) return null;
  // All hooks must be called before any conditional return to maintain
  // consistent hook count across renders (React rules of hooks).
  const pipeIpc = useAppState(s => s.pipeIpc);
  const setAppState = useSetAppState();
  const [cursorIndex, setCursorIndex] = useState(0);

  const isVisible = !!pipeIpc?.statusVisible && !!pipeIpc?.serverName;
  const selectorOpen: boolean = !!pipeIpc?.selectorOpen;

  const slaves = pipeIpc?.slaves ?? {};
  const slaveNames = Object.keys(slaves);
  const discovered: ReadonlyArray<{ pipeName: string; role: string; ip: string; hostname: string }> =
    pipeIpc?.discoveredPipes ?? [];
  const allPipes = [...new Set([...slaveNames, ...discovered.map(d => d.pipeName)])].filter(
    n => n !== pipeIpc?.serverName,
  );
  const selectedPipes: readonly string[] = pipeIpc?.selectedPipes ?? [];
  const displayRole = pipeIpc ? getPipeDisplayRole(pipeIpc) : 'main';
  const routeMode: 'selected' | 'local' = pipeIpc?.routeMode ?? 'selected';
  const selectedRouteActive = routeMode !== 'local' && selectedPipes.length > 0;
  const setRouteMode = (mode: 'selected' | 'local') => {
    setAppState((prev: any) => {
      const pIpc = prev.pipeIpc ?? {};
      return { ...prev, pipeIpc: { ...pIpc, routeMode: mode } };
    });
  };

  // Register as modal overlay when selector is open.
  // This sets isModalOverlayActive=true in PromptInput → TextInput focus=false
  // → TextInput's useInput is deactivated → ↑↓ no longer trigger history navigation.
  // Same mechanism used by BackgroundTasksDialog, FuzzyPicker, etc.
  useRegisterOverlay('pipe-selector', isVisible && selectorOpen);

  // Keyboard handler — must be called every render (hooks rules).
  // ↑↓ navigate list, Space toggles selection, ←/→ or m switches route mode, Enter/Esc close selector.
  // No conflict with history nav: useRegisterOverlay above disables TextInput when open.
  useInput((_input, key) => {
    if (!isVisible) return;

    // When collapsed: only ←/→ arrow keys toggle route mode (no overlay,
    // so printable keys like 'm' would leak into the TextInput).
    // When expanded: ←/→ and 'm' all work (overlay blocks TextInput).
    if (selectedPipes.length > 0) {
      const arrowToggle = key.leftArrow || key.rightArrow;
      const mToggle = selectorOpen && _input.toLowerCase() === 'm';
      if (arrowToggle || mToggle) {
        setRouteMode(routeMode === 'local' ? 'selected' : 'local');
        return;
      }
    }

    if (!selectorOpen) return;

    if (key.downArrow) {
      setCursorIndex(i => Math.min(i + 1, allPipes.length - 1));
    } else if (key.upArrow) {
      setCursorIndex(i => Math.max(i - 1, 0));
    } else if (_input === ' ') {
      const pipeName = allPipes[cursorIndex];
      if (pipeName) {
        setAppState((prev: any) => {
          const pIpc = prev.pipeIpc ?? {};
          const sel: string[] = pIpc.selectedPipes ?? [];
          const newSel = sel.includes(pipeName) ? sel.filter((n: string) => n !== pipeName) : [...sel, pipeName];
          return { ...prev, pipeIpc: { ...pIpc, selectedPipes: newSel } };
        });
      }
    } else if (key.return || key.escape) {
      setAppState((prev: any) => {
        const pIpc = prev.pipeIpc ?? {};
        return { ...prev, pipeIpc: { ...pIpc, selectorOpen: false } };
      });
    }
  });

  // Early return AFTER all hooks
  if (!isVisible) return null;

  if (!selectorOpen) {
    return (
      <Box height={1} gap={1}>
        <Text dimColor>pipe:</Text>
        <Text bold>{pipeIpc.serverName}</Text>
        <Text dimColor>({displayRole})</Text>
        {pipeIpc.localIp && <Text dimColor>{pipeIpc.localIp}</Text>}
        {allPipes.length > 0 && (
          <Text color={selectedRouteActive ? 'success' : undefined} dimColor={selectedPipes.length === 0}>
            {selectedPipes.length}/{allPipes.length} selected
          </Text>
        )}
        {pipeIpc && isPipeControlled(pipeIpc) && pipeIpc.attachedBy && (
          <Text color="warning">
            {'→ '}
            {pipeIpc.attachedBy}
          </Text>
        )}
        {allPipes.length > 0 && (
          <Text color={selectedRouteActive ? 'success' : undefined} dimColor={!selectedRouteActive}>
            {selectedPipes.length > 0
              ? `${routeMode === 'local' ? 'local main' : 'selected pipes only'} · ←/→ switch · Shift+↓ edit`
              : 'local main · Shift+↓ select'}
          </Text>
        )}
      </Box>
    );
  }

  // Expanded mode: header + pipe list with checkboxes
  return (
    <Box flexDirection="column">
      <Box height={1} gap={1}>
        <Text dimColor>pipe:</Text>
        <Text bold>{pipeIpc.serverName}</Text>
        <Text dimColor>({displayRole})</Text>
        {pipeIpc.localIp && <Text dimColor>{pipeIpc.localIp}</Text>}
        <Text color="warning">↑↓ move Space select ←/→ or m route Enter/Esc close Shift+↓ toggle</Text>
      </Box>
      <Box height={1} paddingLeft={2}>
        <Text dimColor>
          {selectedPipes.length > 0
            ? `当前普通 prompt 走 ${routeMode === 'local' ? '本地 main' : '已选 sub'}；切换不会清空选择`
            : '当前未选择 pipe；普通 prompt 会在本地 main 对话执行'}
        </Text>
      </Box>
      {allPipes.map((name, idx) => {
        const isSelected = selectedPipes.includes(name);
        const isCursor = idx === cursorIndex;
        const isConnected = !!slaves[name];
        const disc = discovered.find(d => d.pipeName === name);
        const label = disc ? `${disc.role} ${disc.hostname}/${disc.ip}` : '';

        return (
          <Box key={name} height={1} paddingLeft={2}>
            <Text
              inverse={isCursor}
              color={isSelected ? 'success' : isConnected ? undefined : 'error'}
              dimColor={!isConnected && !isCursor}
            >
              {isSelected ? '☑' : '☐'} {name}
              {isConnected ? '' : ' [offline]'}
              {label ? ` (${label})` : ''}
            </Text>
          </Box>
        );
      })}
      {allPipes.length === 0 && (
        <Box height={1} paddingLeft={2}>
          <Text dimColor>No other pipes found. Start another instance.</Text>
        </Box>
      )}
    </Box>
  );
}
