import capitalize from 'lodash-es/capitalize.js';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { has1mContext } from '../utils/context.js';
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { FAST_MODE_MODEL_DISPLAY, isFastModeAvailable, isFastModeCooldown, isFastModeEnabled } from 'src/utils/fastMode.js';
import { Box, Text } from '../ink.js';
import { useKeybinding, useKeybindings } from '../keybindings/useKeybinding.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import { convertEffortValueToLevel, type EffortLevel, getAvailableEffortLevels, getDefaultEffortForModel, modelSupportsEffort, modelSupportsMaxEffort, modelSupportsXHighEffort, resolvePickerEffortPersistence, toPersistableEffort } from '../utils/effort.js';
import { isModelAllowed } from '../utils/model/modelAllowlist.js';
import { getDefaultMainLoopModel, type ModelSetting, modelDisplayString, parseUserSpecifiedModel } from '../utils/model/model.js';
import { getModelOptions, type ModelOption, parseSwitchProfileValue, resolveSelectedSwitchProfileId, SWITCH_PROFILE_VALUE_PREFIX } from '../utils/model/modelOptions.js';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js';
import { Select } from './CustomSelect/index.js';
import { Byline } from './design-system/Byline.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Pane } from './design-system/Pane.js';
import { effortLevelToSymbol } from './EffortIndicator.js';
import TextInput from './TextInput.js';
export type ModelPickerDiscoveryState = {
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
};
export type Props = {
  initial: string | null;
  sessionModel?: ModelSetting;
  /**
   * `switchToProfileId` is the marker of the selected cross-profile option.
   * It is defined only when the picked option is a genuine "switch profile"
   * entry, so consumers must gate profile activation on this marker rather
   * than re-parsing the encoded value — a literal custom model id that merely
   * starts with `__switch_profile__:` arrives with it undefined.
   */
  onSelect: (
    model: string | null,
    effort: EffortLevel | undefined,
    switchToProfileId?: string,
  ) => void;
  onCancel?: () => void;
  isStandaloneCommand?: boolean;
  showFastModeNotice?: boolean;
  /** Overrides the dim header line below "Select model". */
  headerText?: string;
  /**
   * When true, skip writing effortLevel to userSettings on selection.
   * Used by the assistant installer wizard where the model choice is
   * project-scoped (written to the assistant's .gakrcli/settings.json via
   * install.ts) and should not leak to the user's global ~/.gakrcli/settings.
   */
  skipSettingsWrite?: boolean;
  optionsOverride?: ModelOption[];
  discoveryState?: ModelPickerDiscoveryState;
  onRefresh?: () => void;
  /**
   * Appends an "Enter model name" row as the last option. Selecting it swaps
   * the list for a free-text field so the user can name a model the catalog
   * does not know about — the common case for custom / unlisted providers,
   * where discovery cannot enumerate the route and the picker would otherwise
   * only offer the configured default. Off by default so embedded pickers
   * (onboarding, /config) keep their fixed choice sets.
   */
  allowCustomModelInput?: boolean;
  /**
   * Allow cross-profile "switch profile" options to appear in the list. These
   * carry an encoded `__switch_profile__:<id>:<model>` value that only the
   * `/model` command's onSelect knows how to activate. Inline pickers (prompt
   * hotkey, Settings) that write the raw value to `mainLoopModel` must leave
   * this off so they never surface an option they cannot honor.
   */
  allowProfileSwitch?: boolean;
};

const NO_PREFERENCE = '__NO_PREFERENCE__';
const CUSTOM_MODEL_INPUT = '__CUSTOM_MODEL_INPUT__';
function mapDiscoveryToneToColor(tone: ModelPickerDiscoveryState['tone']): 'error' | 'warning' | 'success' | 'subtle' {
  switch (tone) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    case 'info':
    default:
      return 'subtle';
  }
}
export function ModelPicker({
  initial,
  sessionModel,
  onSelect,
  onCancel,
  isStandaloneCommand,
  showFastModeNotice,
  headerText,
  skipSettingsWrite,
  optionsOverride,
  discoveryState,
  onRefresh,
  allowCustomModelInput,
  allowProfileSwitch
}: Props): React.ReactNode {
  const setAppState = useSetAppState();
  const exitState = useExitOnCtrlCDWithKeybindings();
  const maxVisible = 10;

  const [customInputActive, setCustomInputActive] = useState(false);
  const [customInputError, setCustomInputError] = useState<string | undefined>(undefined);

  const initialValue = initial === null ? NO_PREFERENCE : initial;
  const [focusedValue, setFocusedValue] = useState<string | undefined>(initialValue);

  const isFastMode = useAppState(s => (isFastModeEnabled() ? s.fastMode : false));

  const [marked1MValues, setMarked1MValues] = useState<Set<string>>(
    () => new Set(has1mContext(initialValue) ? [initialValue.replace(/\[1m\]/i, '')] : []),
  );

  const handleToggle1M = useCallback(() => {
    if (!focusedValue || focusedValue === NO_PREFERENCE || focusedValue === CUSTOM_MODEL_INPUT) return;
    // Key on the base value so lookups in handleSelect / is1MMarked match the
    // initializer — predefined 1M options arrive with a `[1m]` suffix in
    // `focusedValue`, which would diverge from the base-value key set.
    const baseKey = focusedValue.replace(/\[1m\]/i, '');
    setMarked1MValues(prev => {
      const next = new Set(prev);
      if (next.has(baseKey)) {
        next.delete(baseKey);
      } else {
        next.add(baseKey);
      }
      return next;
    });
  }, [focusedValue]);

  const [hasToggledEffort, setHasToggledEffort] = useState(false);
  const effortValue = useAppState(s => s.effortValue);
  const [effort, setEffort] = useState<EffortLevel | undefined>(
    effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined,
  );

  // Memoize all derived values to prevent re-renders
  // When optionsOverride is provided (e.g., from /model command with
  // provider-discovered models), it takes precedence over the default
  // getModelOptions() so provider-specific models appear in the picker.
  const defaultModelOptions = useMemo(() => getModelOptions(isFastMode ?? false), [isFastMode]);
  const modelOptionsBase = useMemo(
    () => optionsOverride ?? defaultModelOptions,
    [optionsOverride, defaultModelOptions],
  );
  // Cross-profile switch options can only be honored by the /model command's
  // onSelect, which decodes the value and activates the target profile. Strip
  // them for inline pickers (allowProfileSwitch falsy) so a hotkey/Settings
  // selection never writes the raw `__switch_profile__:...` value as a model.
  // Key on the `switchToProfileId` marker, not the raw value prefix, so a real
  // custom model id that merely starts with `__switch_profile__:` is not hidden.
  const modelOptions = useMemo(
    () =>
      allowProfileSwitch
        ? modelOptionsBase
        : modelOptionsBase.filter(opt => opt.switchToProfileId === undefined),
    [modelOptionsBase, allowProfileSwitch],
  );

  // Ensure the initial value is in the options list
  // This handles edge cases where the user's current model (e.g., 'haiku' for 3P users)
  // is not in the base options but should still be selectable and shown as selected
  const optionsWithInitial = useMemo(() => {
    if (initial !== null && !modelOptions.some(opt => opt.value === initial)) {
      return [
        ...modelOptions,
        {
          value: initial,
          label: modelDisplayString(initial),
          description: 'Current model',
        },
      ];
    }
    return modelOptions;
  }, [modelOptions, initial]);

  const selectOptions = useMemo(() => {
    const mapped = optionsWithInitial.map(opt => ({
      ...opt,
      value: opt.value === null ? NO_PREFERENCE : opt.value,
    }));
    if (!allowCustomModelInput) {
      return mapped;
    }
    // Always last, after every discovered/static entry, so the catalog stays
    // the primary answer and the manual field is the explicit fallback.
    return [
      ...mapped,
      {
        value: CUSTOM_MODEL_INPUT,
        label: 'Enter model name…',
        description: 'Type a model name manually — for custom or unlisted providers',
      },
    ];
  }, [optionsWithInitial, allowCustomModelInput]);
  const initialFocusValue = useMemo(
    () => (selectOptions.some(_ => _.value === initialValue) ? initialValue : (selectOptions[0]?.value ?? undefined)),
    [selectOptions, initialValue],
  );
  const visibleCount = Math.min(maxVisible, selectOptions.length);
  const hiddenCount = Math.max(0, selectOptions.length - visibleCount);

  const focusedModelName = selectOptions.find(opt => opt.value === focusedValue)?.label;
  const focusedModel = resolveOptionModel(focusedValue);
  const is1MMarked =
    focusedValue !== undefined &&
    focusedValue !== NO_PREFERENCE &&
    marked1MValues.has(focusedValue.replace(/\[1m\]/i, ''));
  const focusedSupportsEffort = focusedModel ? modelSupportsEffort(focusedModel) : false;
  const focusedSupportsXhigh = focusedModel ? modelSupportsXHighEffort(focusedModel) : false;
  const focusedSupportsMax = focusedModel ? modelSupportsMaxEffort(focusedModel) : false;
  const focusedDefaultEffort = getDefaultEffortLevelForOption(focusedValue);
  // Clamp display when selected effort isn't supported by the focused model.
  // resolveAppliedEffort() does the same downgrade at API-send time.
  const displayEffort =
    effort === 'max' && !focusedSupportsMax
      ? focusedSupportsXhigh
        ? 'xhigh'
        : 'high'
      : effort === 'xhigh' && !focusedSupportsXhigh
        ? 'high'
        : effort;

  const handleFocus = useCallback(
    (value: string) => {
      setFocusedValue(value);
      if (!hasToggledEffort && effortValue === undefined) {
        setEffort(getDefaultEffortLevelForOption(value));
      }
    },
    [hasToggledEffort, effortValue],
  );

  // Effort level cycling keybindings
  const handleCycleEffort = useCallback(
    (direction: 'left' | 'right') => {
      if (!focusedSupportsEffort) return;
      setEffort(prev =>
        cycleEffortLevel(prev ?? focusedDefaultEffort, direction, focusedSupportsXhigh, focusedSupportsMax),
      );
      setHasToggledEffort(true);
    },
    [focusedSupportsEffort, focusedSupportsXhigh, focusedSupportsMax, focusedDefaultEffort],
  );

  useKeybindings(
    {
      'modelPicker:decreaseEffort': () => handleCycleEffort('left'),
      'modelPicker:increaseEffort': () => handleCycleEffort('right'),
      'modelPicker:toggle1M': () => handleToggle1M(),
      'modelPicker:refresh': () => onRefresh?.(),
    },
    // Left/right/Space/r belong to the text field while it is open, otherwise
    // typing a model name would silently cycle effort or trigger a refresh
    // instead of inserting the character.
    { context: 'ModelPicker', isActive: !customInputActive },
  );

  function handleSelect(value: string): void {
    if (value === CUSTOM_MODEL_INPUT) {
      setCustomInputActive(true);
      return;
    }
    logEvent('tengu_model_command_menu_effort', {
      effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    });
    if (!skipSettingsWrite) {
      // Prior comes from userSettings on disk — NOT merged settings (which
      // includes project/policy layers that must not leak into the user's
      // global ~/.gakrcli/settings.json), and NOT AppState.effortValue (which
      // includes session-ephemeral sources like --effort CLI flag).
      // See resolvePickerEffortPersistence JSDoc.
      const effortLevel = resolvePickerEffortPersistence(
        effort,
        getDefaultEffortLevelForOption(value),
        getSettingsForSource('userSettings')?.effortLevel,
        hasToggledEffort,
      );
      const persistable = toPersistableEffort(effortLevel);
      if (persistable !== undefined) {
        updateSettingsForSource('userSettings', { effortLevel: persistable });
      }
      setAppState(prev => ({ ...prev, effortValue: effortLevel }));
    }

    const selectedModel = resolveOptionModel(value);
    const selectedEffort = hasToggledEffort && selectedModel && modelSupportsEffort(selectedModel) ? effort : undefined;
    if (value === NO_PREFERENCE) {
      onSelect(null, selectedEffort);
      return;
    }
    // Apply or strip [1m] suffix based on user toggle. marked1MValues is keyed
    // on the base value (see initializer + handleToggle1M), so look up with the
    // base form — not `value`, which may carry a `[1m]` suffix from predefined
    // 1M options and would never match.
    const baseValue = value.replace(/\[1m\]/i, '');
    const wants1M = marked1MValues.has(baseValue);
    const finalValue = wants1M ? `${baseValue}[1m]` : baseValue;
    // Thread the presented option's cross-profile marker so the /model command
    // activates a provider only for a genuine switch option, never for a
    // literal custom id that merely starts with the prefix. selectOptions is
    // the actual presented list and its entries spread the source ModelOption's
    // `switchToProfileId`. If two options share the selected value (a literal
    // custom id colliding with an encoded switch value), the selection is
    // ambiguous — the Select cannot tell them apart — so treat it as NOT a
    // switch rather than letting the literal borrow another option's marker.
    const selectedSwitchProfileId = resolveSelectedSwitchProfileId(selectOptions, value);
    onSelect(finalValue, selectedEffort, selectedSwitchProfileId);
  }

  function handleCustomModelSubmit(raw: string): void {
    const trimmed = raw.trim();
    if (!trimmed) {
      // Empty submit is the guaranteed way back to the list, even if this
      // render tree has no keybinding context for Esc.
      setCustomInputActive(false);
      setCustomInputError(undefined);
      return;
    }
    // A free-text field is the one path into the picker that bypasses the
    // option list, so the org allowlist has to be enforced here. Rejecting
    // inline keeps the field open to retype — the callers that check after
    // selection can only close the picker with an error.
    if (!isModelAllowed(trimmed)) {
      setCustomInputError(
        `'${trimmed}' is not available. Your organization restricts model selection.`,
      );
      return;
    }
    handleSelect(trimmed);
  }

  if (customInputActive) {
    const customContent = (
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color="remember" bold>
            Enter model name
          </Text>
          <Text dimColor>
            Type the model name exactly as your provider expects it (for example{' '}
            <Text bold>deepseek-chat</Text> or <Text bold>meta-llama/Llama-3.3-70B-Instruct</Text>
            ).
          </Text>
        </Box>
        <CustomModelNameInput
          error={customInputError}
          onDirty={() => setCustomInputError(undefined)}
          onSubmit={handleCustomModelSubmit}
          onCancel={() => {
            setCustomInputActive(false);
            setCustomInputError(undefined);
          }}
        />
        <Box marginTop={1}>
          <Text dimColor italic>
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <KeyboardShortcutHint shortcut="Esc" action="back to model list" />
            </Byline>
          </Text>
        </Box>
      </Box>
    );
    return isStandaloneCommand ? <Pane color="permission">{customContent}</Pane> : customContent;
  }

  const content = (
    <Box flexDirection="column">
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color="remember" bold>
            Select model
          </Text>
          <Text dimColor>
            {headerText ??
              'Choose a model for this and future sessions. Use ← → to adjust effort, Space to toggle 1M context.'}
          </Text>
          {sessionModel && (
            <Text dimColor>
              Currently using {modelDisplayString(sessionModel)} for this session (set by plan mode). Selecting a model
              will undo this.
            </Text>
          )}
          {discoveryState && (
            <Text color={mapDiscoveryToneToColor(discoveryState.tone)}>{discoveryState.message}</Text>
          )}
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="column">
            <Select
              defaultValue={initialValue}
              defaultFocusValue={initialFocusValue}
              options={selectOptions}
              onChange={handleSelect}
              onFocus={handleFocus}
              onCancel={onCancel ?? (() => {})}
              visibleOptionCount={visibleCount}
            />
          </Box>
          {hiddenCount > 0 && (
            <Box paddingLeft={3}>
              <Text dimColor>and {hiddenCount} more…</Text>
            </Box>
          )}
        </Box>

        <Box marginBottom={1} flexDirection="column">
          {focusedSupportsEffort ? (
            <Text dimColor>
              <EffortLevelIndicator effort={displayEffort} /> {capitalize(displayEffort)} effort
              {displayEffort === focusedDefaultEffort ? ` (default)` : ``} <Text color="subtle">← → to adjust</Text>
            </Text>
          ) : (
            <Text color="subtle">
              <EffortLevelIndicator effort={undefined} /> Effort not supported
              {focusedModelName ? ` for ${focusedModelName}` : ''}
            </Text>
          )}
          {is1MMarked ? (
            <Text dimColor>
              <EffortLevelIndicator effort={'high'} /> 1M context on
              <Text color="subtle"> · Space to toggle</Text>
            </Text>
          ) : (
            <Text color="subtle">
              <EffortLevelIndicator effort={undefined} /> 1M context off
              {focusedModelName ? ` for ${focusedModelName}` : ''}
              <Text color="subtle"> · Space to toggle</Text>
            </Text>
          )}
        </Box>

        {isFastModeEnabled() ? (
          showFastModeNotice ? (
            <Box marginBottom={1}>
              <Text dimColor>
                Fast mode is <Text bold>ON</Text> and available with {FAST_MODE_MODEL_DISPLAY} only (/fast). Switching
                to other models turn off fast mode.
              </Text>
            </Box>
          ) : isFastModeAvailable() && !isFastModeCooldown() ? (
            <Box marginBottom={1}>
              <Text dimColor>
                Use <Text bold>/fast</Text> to turn on Fast mode ({FAST_MODE_MODEL_DISPLAY} only).
              </Text>
            </Box>
          ) : null
        ) : null}
      </Box>

      {isStandaloneCommand && (
        <Text dimColor italic>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              {onRefresh ? (
                <ConfigurableShortcutHint
                  action="modelPicker:refresh"
                  context="ModelPicker"
                  fallback="r"
                  description="refresh models"
                />
              ) : null}
              <ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" />
            </Byline>
          )}
        </Text>
      )}
    </Box>
  );

  if (!isStandaloneCommand) {
    return content;
  }

  return <Pane color="permission">{content}</Pane>;
}

// A picker value is a genuine cross-profile switch only when the option with
// that exact value carries the `switchToProfileId` marker. A literal custom
// model id that merely starts with `__switch_profile__:` is a plain option with
// no marker and must NOT be decoded — otherwise the display resolver would
// strip a real model id down to its `:`-tail. getModelOptions() is the
// authority for the switch options (they only appear in the base list, never in
// a discovery override, and discovered ids never carry the prefix). If two
// options share the value (a literal id colliding with an encoded switch
// value), the match is ambiguous, so require exactly one option and treat that
// lone option's marker as authoritative.
//
// Values that don't start with the switch prefix can never match a switch
// option (switch values are always prefix-encoded), so short-circuit before
// rebuilding the full getModelOptions() list — this runs on every render and
// every focus change while the picker is open, and the rebuild is the dominant
// cost with large model catalogs (e.g. hundreds of discovered/catalogued
// models).
export function isGenuineSwitchProfileValue(value: string): boolean {
  if (!value.startsWith(SWITCH_PROFILE_VALUE_PREFIX)) {
    return false;
  }
  return resolveSelectedSwitchProfileId(getModelOptions(), value) !== undefined;
}

function resolveOptionModel(value?: string): string | undefined {
  if (!value) return undefined;
  if (value === CUSTOM_MODEL_INPUT) return undefined;
  if (value === NO_PREFERENCE) return getDefaultMainLoopModel();
  // Cross-profile entries from /model encode the picker value as
  // `__switch_profile__:<profileId>:<model>`. Effort / display logic needs the
  // bare target model id (e.g. `gpt-5.4`) — otherwise `modelSupportsEffort`
  // sees the prefixed string and reports "Effort not supported" even for
  // reasoning-capable models. Decode only when the value is a genuine
  // marker-backed switch option, not any prefixed id.
  const switched = isGenuineSwitchProfileValue(value)
    ? parseSwitchProfileValue(value)
    : null;
  return parseUserSpecifiedModel(switched ? switched.model : value);
}

function CustomModelNameInput({
  error,
  onDirty,
  onSubmit,
  onCancel,
}: {
  error?: string;
  onDirty: () => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}): React.ReactNode {
  const [value, setValue] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const { columns: terminalColumns } = useTerminalSize();
  const inputColumns = Math.max(20, Math.min(80, terminalColumns - 8));

  // Esc is owned here rather than by BaseTextInput's double-press flow so a
  // single press returns to the list instead of first clearing the field.
  useKeybinding('confirm:no', onCancel, { context: 'ModelPicker' });

  const handleChange = useCallback(
    (next: string) => {
      setValue(next);
      onDirty();
    },
    [onDirty],
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Model › </Text>
        <TextInput
          value={value}
          onChange={handleChange}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
          columns={inputColumns}
          placeholder="model-name"
          onSubmit={onSubmit}
          disableEscapeDoublePress
        />
      </Box>
      {error ? <Text color="error">{error}</Text> : null}
    </Box>
  );
}

function EffortLevelIndicator({ effort }: { effort?: EffortLevel }): React.ReactNode {
  return <Text color={effort ? 'gakrcli' : 'subtle'}>{effortLevelToSymbol(effort ?? 'low')}</Text>;
}

function cycleEffortLevel(
  current: EffortLevel,
  direction: 'left' | 'right',
  includeXhigh: boolean,
  includeMax: boolean,
): EffortLevel {
  const levels: EffortLevel[] = [
    'low',
    'medium',
    'high',
    ...(includeXhigh ? (['xhigh'] as const) : []),
    ...(includeMax ? (['max'] as const) : []),
  ];
  // If the current level isn't in the cycle (e.g. 'max' after switching to a
  // non-max model), clamp to 'high'.
  const idx = levels.indexOf(current);
  const currentIndex = idx !== -1 ? idx : levels.indexOf('high');
  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!;
  } else {
    return levels[(currentIndex - 1 + levels.length) % levels.length]!;
  }
}

function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel();
  const defaultValue = getDefaultEffortForModel(resolved);
  return defaultValue !== undefined ? convertEffortValueToLevel(defaultValue) : 'high';
}
