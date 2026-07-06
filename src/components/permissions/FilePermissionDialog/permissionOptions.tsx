import { homedir } from 'os';
import { basename, join, sep } from 'path';
import React, { type ReactNode } from 'react';
import { getOriginalCwd } from '../../../bootstrap/state.js';
import { PRODUCT_DISPLAY_NAME } from '../../../constants/product.js';
import { Text } from '../../../ink.js';
import { getShortcutDisplay } from '../../../keybindings/shortcutFormat.js';
import type { ToolPermissionContext } from '../../../Tool.js';
import { expandPath, getDirectoryForPath } from '../../../utils/path.js';
import { normalizeCaseForComparison, pathInAllowedWorkingPath } from '../../../utils/permissions/filesystem.js';
import type { OptionWithDescription } from '../../CustomSelect/select.js';
/**
 * Check if a path is within the project's .gakrcli/ folder.
 * This is used to determine whether to show the special ".gakrcli folder" permission option.
 */
export function isInGakrCLIFolder(filePath: string): boolean {
  const absolutePath = expandPath(filePath);
  const gakrcliFolderPath = expandPath(`${getOriginalCwd()}/.gakrcli`);

  // Check if the path is within the project's .gakrcli folder
  const normalizedAbsolutePath = normalizeCaseForComparison(absolutePath);
  const normalizedGakrCLIFolderPath = normalizeCaseForComparison(gakrcliFolderPath);

  // Path must start with the .gakrcli folder path (and be inside it, not just the folder itself)
  return normalizedAbsolutePath.startsWith(normalizedGakrCLIFolderPath + sep.toLowerCase()) ||
  // Also match case where sep is / on posix systems
  normalizedAbsolutePath.startsWith(normalizedGakrCLIFolderPath + '/');
}

/**
 * Check if a path is within the global ~/.gakrcli/ folder, or the legacy
 * ~/.gakrcli/ folder during migration.
 * This is used to determine whether to show the special ".gakrcli folder" permission option
 * for files in the user's home directory.
 */
export function isInGlobalGakrCLIFolder(filePath: string): boolean {
  const absolutePath = expandPath(filePath);
  const normalizedAbsolutePath = normalizeCaseForComparison(absolutePath);
  const globalGakrCLIFolderPaths = [join(homedir(), '.gakrcli'), join(homedir(), '.gakrcli')];

  return globalGakrCLIFolderPaths.some(globalGakrCLIFolderPath => {
    const normalizedGlobalGakrCLIFolderPath = normalizeCaseForComparison(globalGakrCLIFolderPath);
    return normalizedAbsolutePath.startsWith(normalizedGlobalGakrCLIFolderPath + sep.toLowerCase()) || normalizedAbsolutePath.startsWith(normalizedGlobalGakrCLIFolderPath + '/');
  });
}
export type PermissionOption = {
  type: 'accept-once';
} | {
  type: 'accept-session';
  scope?: 'gakrcli-folder' | 'global-gakrcli-folder';
} | {
  type: 'accept-full-access';
} | {
  type: 'reject';
  withReason?: boolean;
};
export type PermissionOptionWithLabel = OptionWithDescription<string> & {
  option: PermissionOption;
};
export type FileOperationType = 'read' | 'write' | 'create';
export function getFilePermissionOptions({
  filePath,
  toolPermissionContext,
  operationType = 'write',
  onRejectFeedbackChange,
  onAcceptFeedbackChange,
  yesInputMode = false,
  noInputMode = false
}: {
  filePath: string;
  toolPermissionContext: ToolPermissionContext;
  operationType?: FileOperationType;
  onRejectFeedbackChange: (value: string) => void;
  onAcceptFeedbackChange?: (value: string) => void;
  yesInputMode?: boolean;
  noInputMode?: boolean;
}): PermissionOptionWithLabel[] {
  const options: PermissionOptionWithLabel[] = [];
  const modeCycleShortcut = getShortcutDisplay('chat:cycleMode', 'Chat', 'shift+tab');

  // When in input mode, show input field
  if (yesInputMode && onAcceptFeedbackChange) {
    options.push({
      type: 'input',
      label: 'Yes',
      value: 'yes',
      placeholder: `and tell ${PRODUCT_DISPLAY_NAME} what to do next`,
      onChange: onAcceptFeedbackChange,
      allowEmptySubmitToCancel: true,
      option: {
        type: 'accept-once'
      }
    });
  } else {
    options.push({
      label: 'Yes',
      value: 'yes',
      option: {
        type: 'accept-once'
      }
    });
  }
  const inAllowedPath = pathInAllowedWorkingPath(filePath, toolPermissionContext);
  const showFullAccessOption = toolPermissionContext.isBypassPermissionsModeAvailable;

  // Check if this is a .gakrcli/ folder path (project or global)
  const inGakrCLIFolder = isInGakrCLIFolder(filePath);
  const inGlobalGakrCLIFolder = isInGlobalGakrCLIFolder(filePath);

  // Option 2: For .gakrcli/ folder, show special option instead of generic session option
  // Note: Session-level options are always shown since they only affect in-memory state,
  // not persisted settings. The allowManagedPermissionRulesOnly setting only restricts
  // persisted permission rules.
  if ((inGakrCLIFolder || inGlobalGakrCLIFolder) && operationType !== 'read') {
    options.push({
      label: `Yes, and allow ${PRODUCT_DISPLAY_NAME} to edit its own settings for this session`,
      value: 'yes-gakrcli-folder',
      option: {
        type: 'accept-session',
        scope: inGlobalGakrCLIFolder ? 'global-gakrcli-folder' : 'gakrcli-folder'
      }
    });
  } else {
    // Option 2: Allow all changes/reads during session
    let sessionLabel: ReactNode;
    if (inAllowedPath) {
      // Inside working directory
      if (operationType === 'read') {
        sessionLabel = 'Yes, during this session';
      } else {
        sessionLabel = <Text>
            Yes, allow all edits during this session{' '}
            <Text bold>({modeCycleShortcut})</Text>
          </Text>;
      }
    } else {
      // Outside working directory - include directory name
      const dirPath = getDirectoryForPath(filePath);
      const dirName = basename(dirPath) || 'this directory';
      if (operationType === 'read') {
        sessionLabel = <Text>
            Yes, allow reading from <Text bold>{dirName}/</Text> during this
            session
          </Text>;
      } else {
        sessionLabel = <Text>
            Yes, allow all edits in <Text bold>{dirName}/</Text> during this
            session <Text bold>({modeCycleShortcut})</Text>
          </Text>;
      }
    }
    options.push({
      label: sessionLabel,
      value: 'yes-session',
      option: {
        type: 'accept-session'
      }
    });
  }
  if (showFullAccessOption) {
    options.push({
      label: <Text color="error">Yes, and enable Full Access for this session</Text>,
      value: 'yes-full-access',
      option: {
        type: 'accept-full-access'
      }
    });
  }

  options.push({
    type: 'input',
    label: 'No, provide reason',
    value: 'no-with-reason',
    placeholder: `tell ${PRODUCT_DISPLAY_NAME} what to do differently`,
    onChange: onRejectFeedbackChange,
    option: {
      type: 'reject',
      withReason: true
    }
  });

  // When in input mode, keep supporting the existing Tab-to-amend flow.
  if (noInputMode && onRejectFeedbackChange) {
    options.push({
      type: 'input',
      label: 'No',
      value: 'no',
      placeholder: `and tell ${PRODUCT_DISPLAY_NAME} what to do differently`,
      onChange: onRejectFeedbackChange,
      allowEmptySubmitToCancel: true,
      option: {
        type: 'reject'
      }
    });
  } else {
    options.push({
      label: 'No',
      value: 'no',
      option: {
        type: 'reject'
      }
    });
  }
  return options;
}
