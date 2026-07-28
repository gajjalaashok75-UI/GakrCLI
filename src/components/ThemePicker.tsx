import { feature } from 'bun:bundle';
import type { StructuredPatchHunk } from 'diff';
import * as React from 'react';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { Box, Text, usePreviewTheme, useTheme, useThemeSetting } from '../ink.js';
import { useRegisterKeybindingContext } from '../keybindings/KeybindingContext.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import type { AppState } from '../state/AppStateStore.js';
import { gracefulShutdown } from '../utils/gracefulShutdown.js';
import { updateSettingsForSource } from '../utils/settings/settings.js';
import type { ThemeSetting } from '../utils/theme.js';
import { Select } from './CustomSelect/index.js';
import { Byline } from './design-system/Byline.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { getColorModuleUnavailableReason, getSyntaxTheme } from './StructuredDiff/colorDiff.js';
import { StructuredDiff } from './StructuredDiff.js';

type StructuredDiffComponent = React.ComponentType<{
  patch: StructuredPatchHunk
  dim: boolean
  filePath: string
  firstLine: string | null
  width: number
  skipHighlighting?: boolean
}>
const StructuredDiffView = StructuredDiff as StructuredDiffComponent

export type ThemePickerProps = {
  onThemeSelect: (setting: ThemeSetting) => void;
  showIntroText?: boolean;
  helpText?: string;
  showHelpTextBelow?: boolean;
  hideEscToCancel?: boolean;
  /** Skip exit handling when running in a context that already has it (e.g., onboarding) */
  skipExitHandling?: boolean;
  /** Called when the user cancels (presses Escape). If skipExitHandling is true and this is provided, it will be called instead of just saving the preview. */
  onCancel?: () => void;
};

const DEMO_PATCH: StructuredPatchHunk = {
  oldStart: 1,
  newStart: 1,
  oldLines: 3,
  newLines: 3,
  lines: [
    ' function greet() {',
    '-  console.log("Hello, World!");',
    '+  console.log("Hello, GakrCLI!");',
    ' }',
  ],
}

/**
 * Theme chooser with live preview. Implemented without react-compiler `_c` memo
 * caches so preview/subtree reconciliation cannot stick on stale element refs when
 * `setPreviewTheme` updates the resolved palette.
 */
export function ThemePicker({
  onThemeSelect,
  showIntroText = false,
  helpText = '',
  showHelpTextBelow = false,
  hideEscToCancel = false,
  skipExitHandling = false,
  onCancel: onCancelProp,
}: ThemePickerProps): React.ReactNode {
  const [theme] = useTheme();
  const themeSetting = useThemeSetting();
  const { columns } = useTerminalSize();
  const colorModuleUnavailableReason = getColorModuleUnavailableReason();
  const syntaxTheme = colorModuleUnavailableReason === null ? getSyntaxTheme(theme) : null;
  const { setPreviewTheme, savePreview, cancelPreview } = usePreviewTheme();
  const syntaxHighlightingDisabled = useAppState(s => s.settings.syntaxHighlightingDisabled) ?? false;
  const setAppState = useSetAppState();

  // Register ThemePicker context so its keybindings take precedence over Global
  useRegisterKeybindingContext("ThemePicker", true);

  const syntaxToggleShortcut = useShortcutDisplay('theme:toggleSyntaxHighlighting', 'ThemePicker', 'ctrl+t');

  useKeybinding(
    'theme:toggleSyntaxHighlighting',
    () => {
      if (colorModuleUnavailableReason === null) {
        const newValue = !syntaxHighlightingDisabled;
        updateSettingsForSource('userSettings', {
          syntaxHighlightingDisabled: newValue,
        });
        setAppState(prev => ({
          ...prev,
          settings: { ...prev.settings, syntaxHighlightingDisabled: newValue },
        }));
      }
    },
    { context: 'ThemePicker' },
  );
  // Always call the hook to follow React rules, but conditionally assign the exit handler
  const exitState = useExitOnCtrlCDWithKeybindings(skipExitHandling ? () => {} : undefined);

  const themeOptions: { label: string; value: ThemeSetting }[] = React.useMemo(
    () => [
    ...(feature('AUTO_THEME') 
    ? [{ label: 'Auto (match terminal)', value: 'auto' as const }] 
    : []), { 
        label: "Dark mode",
        value: "dark" as const 
      }, { 
        label: "Light mode",
        value: "light" as const 
      }, {
        label: "Dark mode (colorblind-friendly)",
        value: "dark-daltonized" as const,
      }, {
        label: "Light mode (colorblind-friendly)",
        value: "light-daltonized" as const,
      }, { 
        label: "Dark mode (ANSI colors only)",
        value: "dark-ansi" as const 
      }, {
        label: "Light mode (ANSI colors only)",
        value: "light-ansi" as const 
      },],
    [],
  )

  const handleRowFocus = React.useCallback(
    (setting: ThemeSetting) => {
      setPreviewTheme(setting)
    },
    [setPreviewTheme],
  )

  const handleSelect = React.useCallback(
    (setting: ThemeSetting) => {
      savePreview()
      onThemeSelect(setting)
    },
    [savePreview, onThemeSelect],
  )

  const handleCancel = React.useCallback(() => {
    cancelPreview()
    if (skipExitHandling) {
      onCancelProp?.()
    } else {
      void gracefulShutdown(0)
    }
  }, [cancelPreview, onCancelProp, skipExitHandling])

  const syntaxHint =
    colorModuleUnavailableReason === 'env'
      ? `Syntax highlighting disabled (via GAKR_CODE_SYNTAX_HIGHLIGHT=${process.env.GAKR_CODE_SYNTAX_HIGHLIGHT})`
      : syntaxHighlightingDisabled
        ? `Syntax highlighting disabled (${syntaxToggleShortcut} to enable)`
        : syntaxTheme
          ? `Syntax theme: ${syntaxTheme.theme}${syntaxTheme.source ? ` (from ${syntaxTheme.source})` : ''} (${syntaxToggleShortcut} to disable)`
          : `Syntax highlighting enabled (${syntaxToggleShortcut} to disable)`

  const header = showIntroText ? (
    <Text>{"Let's get started."}</Text>
  ) : (
    <Text bold color="permission">
      Theme
    </Text>
  )

  const introBlock = (
    <Box flexDirection="column">
      <Text bold>Choose the text style that looks best with your terminal</Text>
      {helpText && !showHelpTextBelow ? (
        <Text dimColor>{helpText}</Text>
      ) : null}
    </Box>
  )

  const content = (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" gap={1}>
        {showIntroText ? (
          <Text>Let&apos;s get started.</Text>
        ) : (
          <Text bold color="permission">
            Theme
          </Text>
        )}
        <Box flexDirection="column">
          <Text bold>Choose the text style that looks best with your terminal</Text>
          {helpText && !showHelpTextBelow && <Text dimColor>{helpText}</Text>}
        </Box>
        <Select
          options={themeOptions}
          onFocus={setting => {
            setPreviewTheme(setting as ThemeSetting);
          }}
          onChange={(setting: string) => {
            savePreview();
            onThemeSelect(setting as ThemeSetting);
          }}
          onCancel={
            skipExitHandling
              ? () => {
                  cancelPreview();
                  onCancelProp?.();
                }
              : async () => {
                  cancelPreview();
                  await gracefulShutdown(0);
                }
          }
          visibleOptionCount={themeOptions.length}
          defaultValue={themeSetting}
          defaultFocusValue={themeSetting}
        />
      </Box>
      <Box flexDirection="column" width="100%">
        <Box
          flexDirection="column"
          borderTop
          borderBottom
          borderLeft={false}
          borderRight={false}
          borderStyle="dashed"
          borderColor="subtle"
        >
          <StructuredDiff
            patch={{
              oldStart: 1,
              newStart: 1,
              oldLines: 3,
              newLines: 3,
              lines: [
                ' function greet() {',
                '-  console.log("Hello, World!");',
                '+  console.log("Hello, Gakr!");',
                ' }',
              ],
            }}
            dim={false}
            filePath="demo.js"
            firstLine={null}
            width={columns}
          />
        </Box>
        <Text dimColor>
          {' '}
          {colorModuleUnavailableReason === 'env'
            ? `Syntax highlighting disabled (via GAKR_CODE_SYNTAX_HIGHLIGHT=${process.env.GAKR_CODE_SYNTAX_HIGHLIGHT})`
            : syntaxHighlightingDisabled
              ? `Syntax highlighting disabled (${syntaxToggleShortcut} to enable)`
              : syntaxTheme
                ? `Syntax theme: ${syntaxTheme.theme}${syntaxTheme.source ? ` (from ${syntaxTheme.source})` : ''} (${syntaxToggleShortcut} to disable)`
                : `Syntax highlighting enabled (${syntaxToggleShortcut} to disable)`}
        </Text>
      </Box>
    </Box>
  );

  // Only wrap in a box when not in onboarding
  if (!showIntroText) {
    return (
      <>
        <Box flexDirection="column">{content}</Box>
        <Box marginTop={1}>
          {showHelpTextBelow && helpText && (
            <Box marginLeft={3}>
              <Text dimColor>{helpText}</Text>
            </Box>
          )}
          {!hideEscToCancel && (
            <Box>
              <Text dimColor italic>
                {exitState.pending ? (
                  <>Press {exitState.keyName} again to exit</>
                ) : (
                  <Byline>
                    <KeyboardShortcutHint shortcut="Enter" action="select" />
                    <KeyboardShortcutHint shortcut="Esc" action="cancel" />
                  </Byline>
                )}
              </Text>
            </Box>
          )}
        </Box>
      </>
    );
  }

  return content;
}
