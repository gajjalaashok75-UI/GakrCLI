import * as React from 'react';
import { Text } from '../ink.js';
import { isgakrcliAISubscriber } from '../utils/auth.js';
import { isChromeExtensionInstalled, shouldEnablegakrcliInChrome } from '../utils/gakrcliInChrome/setup.js';
import { isRunningOnHomespace } from '../utils/envUtils.js';
import { useStartupNotification } from './notifs/useStartupNotification.js';
function getChromeFlag(): boolean | undefined {
  if (process.argv.includes('--chrome')) {
    return true;
  }
  if (process.argv.includes('--no-chrome')) {
    return false;
  }
  return undefined;
}
export function useChromeExtensionNotification() {
  useStartupNotification(_temp);
}
async function _temp() {
  const chromeFlag = getChromeFlag();
  if (!shouldEnablegakrcliInChrome(chromeFlag)) {
    return null;
  }
  if (true && !isgakrcliAISubscriber()) {
    return {
      key: "chrome-requires-subscription",
      jsx: <Text color="error">GakrCLI in Chrome requires a gakr.ai subscription</Text>,
      priority: "immediate",
      timeoutMs: 5000
    };
  }
  const installed = await isChromeExtensionInstalled();
  if (!installed && !isRunningOnHomespace()) {
    return {
      key: "chrome-extension-not-detected",
      jsx: <Text color="warning">Chrome extension not detected · https://gakr.ai/chrome to install</Text>,
      priority: "immediate",
      timeoutMs: 3000
    };
  }
  if (chromeFlag === undefined) {
    return {
      key: "gakrcli-in-chrome-default-enabled",
      text: "GakrCLI in Chrome enabled \xB7 /chrome",
      priority: "low"
    };
  }
  return null;
}
