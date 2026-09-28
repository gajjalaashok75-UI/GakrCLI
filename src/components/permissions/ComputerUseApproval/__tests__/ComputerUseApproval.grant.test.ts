import { describe, expect, it } from 'bun:test';
import type { InstalledApp } from '@ant/computer-use-mcp/types';
import { toGrant } from '../ComputerUseApproval.js';

const NOTEPAD: InstalledApp = {
  bundleId: 'Microsoft.WindowsNotepad_8wekyb3d8bbwe',
  displayName: 'Notepad',
  exePath: 'C:\\Program Files\\WindowsApps\\Notepad\\Notepad.exe',
};

describe('ComputerUseApproval.toGrant', () => {
  it('carries exePath, the bound-window authorization identity', () => {
    // Regression: the grant was built without exePath, so a dialog-approved
    // app could never match a bound window's process image and every input
    // call was rejected with "not in the allowed applications".
    const grant = toGrant(NOTEPAD, 1000);
    expect(grant.exePath).toBe('C:\\Program Files\\WindowsApps\\Notepad\\Notepad.exe');
  });

  it('preserves the identity fields the host keys grants on', () => {
    const grant = toGrant(NOTEPAD, 1000);
    expect(grant.bundleId).toBe('Microsoft.WindowsNotepad_8wekyb3d8bbwe');
    expect(grant.displayName).toBe('Notepad');
    expect(grant.grantedAt).toBe(1000);
  });

  it('does not invent an exePath the host never resolved', () => {
    // macOS grants legitimately have no executable path; leaving it undefined
    // is correct and must not be coerced into a match-anything value.
    const grant = toGrant({ bundleId: 'com.apple.Safari', displayName: 'Safari' }, 1000);
    expect(grant.exePath).toBeUndefined();
  });
});
