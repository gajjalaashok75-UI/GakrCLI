import React, { useState } from 'react';
import { type OptionWithDescription, Select } from '../../components/CustomSelect/select.js';
import TextInput from '../../components/TextInput.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { Box, Text, useInput } from '../../ink.js';
import { useAppState } from '../../state/AppState.js';
import { isGakrCLIAISubscriber } from '../../utils/auth.js';
import { openBrowser } from '../../utils/browser.js';
import { GAKR_IN_CHROME_MCP_SERVER_NAME, openInChrome } from '../../utils/gakrcliInChrome/common.js';
import { CHROME_EXTENSION_ZIP_URL, GAKR_IN_CHROME_DOCS_URL } from '../../utils/gakrcliInChrome/extensionId.js';
import { type GakrCLIInChromeStatus, getGakrCLIInChromeStatus } from '../../utils/gakrcliInChrome/preflight.js';
import { refreshChromeNativeHostManifest, resolveChromeExtensionIdInput, saveChromeExtensionId } from '../../utils/gakrcliInChrome/setup.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
import { env } from '../../utils/env.js';
import { isRunningOnHomespace } from '../../utils/envUtils.js';

/** Steps for loading the side-loaded extension; there is no Web Store listing. */
const INSTALL_STEPS = ['Download the extension bundle (a .zip).', 'Unzip it to a folder you will keep, e.g. ~/gakrcli-in-chrome.', 'Open chrome://extensions and turn on Developer mode.', 'Click "Load unpacked" and select the unzipped folder.', 'Copy the extension ID from the extension\'s card.', 'Choose "Set Chrome extension ID" here and paste it.'];

/** The two ways to use the extension, quoted verbatim in the dialog. */
const TERMINAL_USAGE = 'gakrcli --chrome';
const SIDE_PANEL_USAGE = 'gakrcli --chrome-extension';

type MenuAction = 'install-extension' | 'set-extension-id' | 'register-native-host' | 'toggle-default';
type View = 'menu' | 'install' | 'set-id';

type Props = {
  onDone: (result?: string) => void;
  status: GakrCLIInChromeStatus;
  configEnabled: boolean | undefined;
  isGakrCLIAISubscriber: boolean;
  isWSL: boolean;
};

function StatusLine({ label, children }: { label: string; children: React.ReactNode }): React.ReactNode {
  return (
    <Text>
      {label}: {children}
    </Text>
  );
}

function GakrCLIInChromeMenu({
  onDone,
  status: initialStatus,
  configEnabled,
  isGakrCLIAISubscriber,
  isWSL
}: Props): React.ReactNode {
  const mcpClients = useAppState(s => s.mcp.clients);
  const [status, setStatus] = useState(initialStatus);
  const [view, setView] = useState<View>('menu');
  const [selectKey, setSelectKey] = useState(0);
  const [enabledByDefault, setEnabledByDefault] = useState(configEnabled ?? false);
  const [idValue, setIdValue] = useState(initialStatus.extensionId ?? '');
  const [cursorOffset, setCursorOffset] = useState((initialStatus.extensionId ?? '').length);
  const [idError, setIdError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isHomespace = process.env.USER_TYPE === 'ant' && isRunningOnHomespace();

  const chromeClient = mcpClients.find(c => c.name === GAKR_IN_CHROME_MCP_SERVER_NAME);
  const isConnected = chromeClient?.type === 'connected';
  const isExtensionInstalled = status.extensionInstalled;

  function openUrl(url: string): void {
    if (isHomespace) {
      void openBrowser(url);
    } else {
      void openInChrome(url);
    }
  }

  function backToMenu(): void {
    setSelectKey(k => k + 1);
    setView('menu');
  }

  async function refreshStatus(): Promise<void> {
    try {
      setStatus(await getGakrCLIInChromeStatus('terminal'));
    } catch {
      // Keep the previous status; the dialog is not the place to report it.
    }
  }

  /**
   * Save the id, then rewrite the native-messaging manifest. The id is useless
   * on its own: Chrome only starts the native host for origins listed in
   * `allowed_origins`, so the manifest has to learn the new id before
   * `gakrcli --chrome` can reach the extension.
   */
  async function submitExtensionId(): Promise<void> {
    const result = resolveChromeExtensionIdInput(idValue);
    if (!result.ok) {
      setIdError(result.error);
      return;
    }
    setIdError(null);
    setIsSaving(true);
    saveChromeExtensionId(result.id);
    try {
      await refreshChromeNativeHostManifest();
      setNote(`Extension id set to ${result.id}. Native host manifest updated. Restart with ${TERMINAL_USAGE} for the terminal, or ${SIDE_PANEL_USAGE} for the Chrome side panel.`);
    } catch (error) {
      setNote(`Extension id saved, but the native host manifest could not be rewritten: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
      backToMenu();
      await refreshStatus();
    }
  }

  function handleAction(action: MenuAction): void {
    switch (action) {
      case 'install-extension':
        setSelectKey(k => k + 1);
        setView('install');
        openUrl(GAKR_IN_CHROME_DOCS_URL);
        break;
      case 'set-extension-id':
        setSelectKey(k => k + 1);
        setIdError(null);
        setIdValue(status.extensionId ?? '');
        setCursorOffset((status.extensionId ?? '').length);
        setView('set-id');
        break;
      case 'register-native-host':
        setSelectKey(k => k + 1);
        setNote(null);
        void refreshChromeNativeHostManifest().then(async () => {
          setNote('Native host manifest rewritten for the current extension id.');
          await refreshStatus();
        }).catch((error: unknown) => {
          setNote(`Could not rewrite the native host manifest: ${error instanceof Error ? error.message : String(error)}`);
        });
        break;
      case 'toggle-default': {
        const newValue = !enabledByDefault;
        saveGlobalConfig(current => ({
          ...current,
          gakrcliInChromeDefaultEnabled: newValue
        }));
        setEnabledByDefault(newValue);
        break;
      }
    }
  }

  // Enter closes the install view; the guide was opened when the item was
  // selected. Inactive while the id field is focused so the input keeps its own
  // Enter handling, and Escape is left to Dialog's onCancel.
  useInput((_input, key) => {
    if (key.return) {
      onDone();
    }
  }, { isActive: view === 'install' });

  const options: OptionWithDescription<MenuAction>[] = [];
  const requiresExtensionSuffix = isExtensionInstalled ? '' : ' (not detected)';

  options.push({
    label: 'Install Chrome extension (download + steps)',
    value: 'install-extension'
  }, {
    label: (
      <>
        <Text>Set Chrome extension ID</Text>
        {!status.extensionId && <Text dimColor> (required for unpacked installs)</Text>}
      </>
    ),
    value: 'set-extension-id'
  }, {
    label: (
      <>
        <Text>Re-register native host</Text>
        <Text dimColor>{requiresExtensionSuffix}</Text>
      </>
    ),
    value: 'register-native-host'
  }, {
    label: `Enabled by default: ${enabledByDefault ? 'Yes' : 'No'}`,
    value: 'toggle-default'
  });

  const isDisabled = isWSL || ((process.env.USER_TYPE as string) !== 'ant' && !isGakrCLIAISubscriber);
  const isEditing = view === 'set-id';

  return (
    <Dialog title="GakrCLI in Chrome (Beta)" onCancel={() => onDone()} color="chromeYellow" isCancelActive={!isEditing}>
      <Box flexDirection="column" gap={1}>
        <Text>
          GakrCLI in Chrome works with the Chrome extension to let you control your browser directly from GakrCLI Code.
          Navigate websites, fill forms, capture screenshots, record GIFs, and debug with console logs and network
          requests.
        </Text>

        {isWSL && <Text color="error">GakrCLI in Chrome is not supported in WSL at this time.</Text>}

        {(process.env.USER_TYPE as string) !== 'ant' && !isGakrCLIAISubscriber && (
          <Text color="error">GakrCLI in Chrome requires a gakrcli.ai subscription.</Text>
        )}

        {!isDisabled && (
          <>
            {!isHomespace && (
              <Box flexDirection="column">
                <StatusLine label="Status">
                  {isConnected ? <Text color="success">Enabled</Text> : <Text color="inactive">Disabled</Text>}
                </StatusLine>
                <StatusLine label="Extension ID">
                  {status.extensionId ? (
                    <Text color="success">
                      {status.extensionId}
                      <Text dimColor>{status.extensionIdSource === 'env' ? ' (from GAKR_CHROME_EXTENSION_ID)' : ' (from ~/.gakrcli.json)'}</Text>
                    </Text>
                  ) : (
                    <Text color="warning">Not set</Text>
                  )}
                </StatusLine>
                <StatusLine label="Extension">
                  {isExtensionInstalled ? <Text color="success">Installed</Text> : <Text color="warning">Not detected</Text>}
                </StatusLine>
                <StatusLine label="Native host">
                  {status.nativeHostReachable === null ? (
                    status.nativeHostManifestPath ? (
                      <Text color="success">Registered</Text>
                    ) : (
                      <Text color="warning">Manifest missing</Text>
                    )
                  ) : status.nativeHostReachable ? (
                    <Text color="success">Connected</Text>
                  ) : (
                    <Text color="warning">Not connected — is Chrome open?</Text>
                  )}
                </StatusLine>
                <StatusLine label="Terminal backend">
                  {status.terminalBackendRunning ? (
                    <Text color="success">Running</Text>
                  ) : (
                    <Text color="inactive">Stopped (gakrcli --chrome-extension)</Text>
                  )}
                </StatusLine>
              </Box>
            )}

            {status.warnings.map((warning, index) => (
              <Box flexDirection="column" key={`${warning.message}-${index}`}>
                <Text color={warning.level === 'error' ? 'error' : 'warning'}>{warning.message}</Text>
                {warning.fix && <Text dimColor>→ {warning.fix}</Text>}
              </Box>
            ))}

            {view === 'menu' && <Select key={selectKey} options={options} onChange={handleAction} hideIndexes />}

            {view === 'install' && (
              <Box flexDirection="column">
                <Text bold>Load the extension (not on the Chrome Web Store)</Text>
                {INSTALL_STEPS.map((step, index) => (
                  <Text key={step}>
                    <Text dimColor>{index + 1}. </Text>
                    {step}
                  </Text>
                ))}
                <Text>
                  Download: <Text color="chromeYellow">{CHROME_EXTENSION_ZIP_URL}</Text>
                </Text>
                <Text dimColor>
                  Chrome assigns an id from the folder you load, so it differs per machine — that is why the CLI has to
                  be told which id you got.
                </Text>
              </Box>
            )}

            {view === 'set-id' && (
              <Box flexDirection="column">
                <Text bold>Chrome extension ID</Text>
                <Text dimColor>chrome://extensions → enable Developer mode → copy the ID on the extension's card.</Text>
                <Box marginTop={1}>
                  <TextInput value={idValue} onChange={setIdValue} onSubmit={submitExtensionId} placeholder="32 characters, a-p" columns={80} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} focus showCursor multiline={false} />
                </Box>
                {isSaving && <Text dimColor>Updating the native host manifest…</Text>}
                {idError && <Text color="error">{idError}</Text>}
              </Box>
            )}

            {note && <Text color="success">{note}</Text>}

            <Text>
              Then restart: <Text bold>{TERMINAL_USAGE}</Text> for browser tools in this terminal, or{' '}
              <Text bold>{SIDE_PANEL_USAGE}</Text> for the Chrome side panel.
            </Text>

            <Text dimColor>
              Site-level permissions are inherited from the Chrome extension. Manage permissions in the Chrome extension
              settings to control which sites GakrCLI can browse, click, and type on.
            </Text>
          </>
        )}
        <Text dimColor>Guide: {GAKR_IN_CHROME_DOCS_URL}</Text>
      </Box>
    </Dialog>
  );
}

export const call = async function (onDone: (result?: string) => void): Promise<React.ReactNode> {
  const status = await getGakrCLIInChromeStatus('terminal');
  const config = getGlobalConfig();
  const isSubscriber = isGakrCLIAISubscriber();
  const isWSL = env.isWslEnvironment();

  return (
    <GakrCLIInChromeMenu
      onDone={onDone}
      status={status}
      configEnabled={config.gakrcliInChromeDefaultEnabled}
      isGakrCLIAISubscriber={isSubscriber}
      isWSL={isWSL}
    />
  );
};
