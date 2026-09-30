import { describe, expect, it } from 'bun:test';
import type { CuPermissionRequest, InstalledApp } from '@ant/computer-use-mcp/types';
import { buildAllowResponse, buildDenyResponse, toGrant } from '../ComputerUseApproval.js';

const NOTEPAD: InstalledApp = {
  bundleId: 'Microsoft.WindowsNotepad_8wekyb3d8bbwe',
  displayName: 'Notepad',
  exePath: 'C:\\Program Files\\WindowsApps\\Notepad\\Notepad.exe',
};

const REQUEST: CuPermissionRequest = {
  requestId: 'test',
  reason: 'Testing computer use functionality',
  apps: [
    { requestedName: 'notepad', resolved: NOTEPAD, alreadyGranted: false },
    { requestedName: 'ghost app', resolved: undefined, alreadyGranted: false },
  ],
  requestedFlags: {},
  screenshotFiltering: 'none',
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

describe('ComputerUseApproval deny/allow responses', () => {
  it('deny carries userConsented=false so the handler can tell the model the user refused', () => {
    // Regression: Deny produced {granted:[], denied:[]} — structurally
    // identical to Allow-of-nothing — so with a pre-existing allowlist the
    // tool returned a success result that read like an approval.
    const resp = buildDenyResponse(REQUEST);
    expect(resp.userConsented).toBe(false);
    expect(resp.granted).toHaveLength(0);
  });

  it('deny lists every requested app as denied, not an empty array', () => {
    const resp = buildDenyResponse(REQUEST);
    expect(resp.denied).toHaveLength(2);
    expect(resp.denied[0]).toEqual({
      bundleId: 'Microsoft.WindowsNotepad_8wekyb3d8bbwe',
      reason: 'user_denied',
    });
    expect(resp.denied[1]).toEqual({ bundleId: 'ghost app', reason: 'not_installed' });
  });

  it('allow carries userConsented=true and grants only checked resolved apps', () => {
    const resp = buildAllowResponse(REQUEST, new Set([NOTEPAD.bundleId]));
    expect(resp.userConsented).toBe(true);
    expect(resp.granted).toHaveLength(1);
    expect(resp.granted[0]?.bundleId).toBe(NOTEPAD.bundleId);
    expect(resp.granted[0]?.exePath).toBe(NOTEPAD.exePath);
    expect(resp.denied.map(d => d.bundleId)).toEqual(['ghost app']);
  });

  it('allow grants the requested flags', () => {
    const resp = buildAllowResponse(
      { ...REQUEST, requestedFlags: { systemKeyCombos: true } },
      new Set([NOTEPAD.bundleId]),
    );
    expect(resp.flags.systemKeyCombos).toBe(true);
    expect(resp.flags.clipboardRead).toBe(false);
  });
});
