# Windows Sandbox — Host Integration Spec

> Status: **spec only. No host code has been written.** This document
> is the implementation blueprint for a human maintainer.
>
> Predecessors:
> - `docs/sandbox/WINDOWS_PROPOSAL.md` — what changes, at file level.
> - `docs/sandbox/SRT_WIN_AUDIT.md` — the security review of `srt-win`
>   that justifies treating the binary as the approved boundary.
>
> The audit is accepted. The proposal is approved. This spec is the
> engineering contract for the change set: the exact files, the exact
> call sites, the exact env-var filter, the exact UI states, the exact
> error messages. A maintainer who follows this spec end-to-end can
> ship the integration without further design decisions.

---

## Table of contents

1. [Current architecture](#1-current-architecture)
2. [Existing `sandbox-runtime` Windows integration points](#2-existing-sandbox-runtime-windows-integration-points)
3. [Files and functions to modify](#3-files-and-functions-to-modify)
4. [Required call flows](#4-required-call-flows)
5. [Four-state Windows status model and UI behavior](#5-four-state-windows-status-model-and-ui-behavior)
6. [The six audit constraints — where each is enforced](#6-the-six-audit-constraints--where-each-is-enforced)
7. [Environment-variable filtering requirements](#7-environment-variable-filtering-requirements)
8. [Packaging and binary-discovery requirements](#8-packaging-and-binary-discovery-requirements)
9. [CI and test requirements](#9-ci-and-test-requirements)
10. [Error handling and user messaging](#10-error-handling-and-user-messaging)
11. [Rollout sequence and implementation phases](#11-rollout-sequence-and-implementation-phases)
12. [Verified facts from source code](#12-verified-facts-from-source-code)
13. [Audit conclusions](#13-audit-conclusions)
14. [Required implementation work](#14-required-implementation-work)
15. [Optional future enhancements](#15-optional-future-enhancements)

---

## 1. Current architecture

### 1.1 Repository layout (verified)

```
src/
  utils/
    sandbox/
      sandbox-adapter.ts          # GakrCLI-side SandboxManager (the file to edit)
    platform.ts                   # exports getPlatform() — returns 'macos' | 'linux' | 'wsl' | 'windows'
    settings/
      types.ts                    # SettingsJson interface; the sandbox block lives here
scripts/
  externals.ts                    # INTENTIONALLY_BUNDLED includes '@anthropic-ai/sandbox-runtime'
node_modules/
  @anthropic-ai/sandbox-runtime/
    dist/
      sandbox/
        sandbox-manager.js        # isSupportedPlatform, checkDependencies, wrapWithSandbox
        windows-sandbox-utils.js  # installWindowsSandbox, getWindowsGroupStatus, getWindowsWfpStatus, etc.
    vendor/
      srt-win/                    # Rust source for the security-critical binary
        src/                      # main.rs, wfp.rs, token.rs, job.rs, launch.rs, ...
        Cargo.toml                # build configuration
        target/release/srt-win.exe  # compiled binary post-cargo-build
docs/
  sandbox/
    WINDOWS_PROPOSAL.md
    SRT_WIN_AUDIT.md
    HOST_INTEGRATION_SPEC.md      # THIS DOCUMENT
```

### 1.2 Trust boundary

The GakrCLI host process is **not** the boundary. The boundary is the
`srt-win.exe` Rust binary plus the WFP filter set it installs under
the `srt-win` sublayer. GakrCLI host code is **on the trusted side**
of that boundary. Anything the host does to "turn on" the boundary —
calling the install command, gating `autoAllowBashIfSandboxed` on
the install's outcome, advertising the install to the user — is
**deciding when to invoke a kernel-mode network broker and a
restricted-token service**.

That decision is the host code's responsibility. The spec below
specifies exactly how to make that decision safely.

### 1.3 What the host already does (verified)

From `src/utils/sandbox/sandbox-adapter.ts`:

- **`isSupportedPlatform()` (line 500-502)** delegates to
  `BaseSandboxManager.isSupportedPlatform()`, which already returns
  `true` on Windows. **No change required.**
- **`isSandboxingEnabled()` (line 541-556)** chains
  `isSupportedPlatform()` → `checkDependencies().errors.length` →
  `isPlatformInEnabledList()` → `getSandboxEnabledSetting()`. On
  Windows, this returns `false` until the install completes. **No
  change required.**
- **`checkDependencies()`** is forwarded to
  `BaseSandboxManager.checkDependencies()` (line 952), which already
  routes to `checkWindowsDependencies` on Windows
  (`sandbox-manager.js:400-404`). **No change required.**
- **`wrapWithSandbox()` (line 713-734)** awaits
  `initializationPromise` (which calls
  `BaseSandboxManager.initialize` → `convertToSandboxRuntimeConfig`
  → `BaseSandboxManager.updateConfig` on settings changes) and
  delegates to `BaseSandboxManager.wrapWithSandbox`, which already
  routes to `wrapCommandWithSandboxWindows` on Windows. **No change
  required.**

The architectural seams already exist. The proposal and this spec
cover **bootstrap** (the install command), **surfacing** (UI for the
four states), and **policy enforcement** (the six host constraints).

---

## 2. Existing `sandbox-runtime` Windows integration points

These are the upstream APIs the host code will call. They are
already exported by `@anthropic-ai/sandbox-runtime`. Verified by
reading `dist/sandbox/windows-sandbox-utils.d.ts`.

### 2.1 Constants

```ts
export const DEFAULT_WINDOWS_GROUP_NAME = 'sandbox-runtime-net'
export const DEFAULT_WINDOWS_PROXY_PORT_RANGE: readonly [number, number]  // [60080, 60089]
```

### 2.2 Status types

```ts
export type WindowsGroupStatus = 'absent' | 'created-not-on-token' | 'ready'
export interface WindowsGroupStatusResult {
  state: WindowsGroupStatus
  sid?: string
  warning?: string
  error?: string
}

export type WindowsWfpStatus = 'absent' | 'installed'
export interface WindowsWfpStatusResult {
  state: WindowsWfpStatus
  filters: number
  portRange?: [number, number]  // [low, high] from permit-loopback tag
}

export interface WindowsGroupRef {
  groupName?: string     // default: 'sandbox-runtime-net'
  groupSid?: string      // takes precedence; for domain groups
}
```

### 2.3 Status functions (read-only, do not require admin)

```ts
export function getSrtWinPath(): string
  // Resolution: SRT_WIN_PATH env var → ../../vendor/srt-win/target/release/srt-win.exe
  // (relative to the JS file) → bundled dist/vendor/srt-win/...

export function getWindowsGroupStatus(ref: WindowsGroupRef): WindowsGroupStatusResult
  // Runs 'srt-win group status', returns {state, sid?, warning?, error?}

export function getWindowsWfpStatus(opts?: { sublayerGuid?: string }): WindowsWfpStatusResult
  // Runs 'srt-win wfp status', returns {state, filters, portRange?}
```

### 2.4 Mutating functions (require admin; self-elevate via UAC)

```ts
export interface InstallWindowsSandboxOpts {
  groupName?: string
  groupSid?: string          // external-managed group; skip group create
  userSid?: string           // default: current user
  sublayerGuid?: string      // default: 0x2c5d0ad6-5f3b-4d4e-9b8f-1a3e7c9d0b21
  proxyPortRange?: [number, number]
  force?: boolean            // AUDIT CONSTRAINT 1 — see §6
}

export interface InstallWindowsSandboxResult {
  cancelled?: boolean        // UAC prompt dismissed → exit code 10
  error?: string
}

export function installWindowsSandbox(opts: InstallWindowsSandboxOpts): Promise<InstallWindowsSandboxResult>

export function uninstallWindowsSandbox(opts: { sublayerGuid?: string }): Promise<void>

export function createWindowsGroup(ref: WindowsGroupRef, userSid?: string): Promise<void>

export function deleteWindowsGroup(ref: WindowsGroupRef): Promise<void>
```

### 2.5 Spawning

```ts
export function wrapCommandWithSandboxWindows(p: WrapSandboxWindowsParams): {
  argv: string[]
  env: Record<string, string>
  // Caller MUST spawn with {shell: false}. Do NOT pass through cmd.exe.
}
```

The caller is `BaseSandboxManager.wrapWithSandbox` (line 919-924 of
`src/utils/sandbox/sandbox-adapter.ts`). **The host does not call
`wrapCommandWithSandboxWindows` directly**; the `BaseSandboxManager`
calls it. The host's responsibility is to ensure the binary is
installed and configured.

### 2.6 What is NOT exposed (verified)

- `srt-win exec --skip-group-check` is not in the JS shim's API.
  The host cannot enable it. **Constraint 2 is structurally
  enforced.** Do not add a wrapper that exposes it.
- `force: true` is a real flag. The shim forwards it. The host
  must never set it without an explicit user action. **Constraint
  1 must be enforced by the host**, not by the shim.

---

## 3. Files and functions to modify

> Each entry is a single, atomic change. Phases group them.

### Phase 1 — Reporting and status

#### 3.1 `src/utils/sandbox/sandbox-adapter.ts`

**Function: `getSandboxUnavailableReason()` (line 571-601)**

- **Currently:** On Windows, returns
  `sandbox.enabled is set but ${platform} is not supported (requires
  macOS, Linux, or WSL2)`. This is wrong on Windows.
- **Change:** Replace the unsupported-platform branch with a
  Windows-specific branch that uses the four-state status model
  (§5) to return one of four messages.
- **Exact code shape:**

```ts
// REPLACE the current line 578-584 with:
if (!isSupportedPlatform()) {
  const platform = getPlatform()
  if (platform === 'wsl') {
    return 'sandbox.enabled is set but WSL1 is not supported (requires WSL2)'
  }
  if (platform === 'windows') {
    // This branch is unreachable today because isSupportedPlatform()
    // returns true on Windows; keep the fallback for forward
    // compatibility in case the upstream check is ever tightened.
    return windowsUnavailableMessage()  // see §5.5
  }
  return `sandbox.enabled is set but ${platform} is not supported (requires macOS, Linux, or WSL2)`
}
```

- **New helper to add (private to the file):**

```ts
function windowsUnavailableMessage(): string {
  // AUDIT CONSTRAINT 4: do not silently degrade. The user enabled
  // sandbox; if it can't run, we say exactly why and exactly what
  // to do.
  try {
    const group = getWindowsGroupStatus({})  // see §3.2 for the
                                              // re-export wiring
    if (group.error) {
      return `Windows sandbox unavailable: ${group.error} · run /sandbox for details`
    }
    if (group.state === 'absent') {
      return 'sandbox.enabled is set but the Windows sandbox has not been installed. Run /sandbox-install to set up srt-win (one UAC prompt).'
    }
    if (group.state === 'created-not-on-token') {
      return 'sandbox.enabled is set but the sandbox group is not yet in your logon token. Log out and back in to finish setup, then restart GakrCLI.'
    }
    // group.state === 'ready' — but if we got here, WFP is also bad.
    const wfp = getWindowsWfpStatus({})
    if (wfp.state === 'absent') {
      return 'sandbox.enabled is set but the Windows network filters are not installed. Run /sandbox-install to install the WFP filters (one UAC prompt).'
    }
    // Both group and WFP report installed; shouldn't be here.
    return 'sandbox.enabled is set but the Windows sandbox is unreachable. Run /sandbox --doctor for details.'
  } catch (e) {
    return `Windows sandbox unavailable: ${errorMessage(e)} · run /sandbox --doctor for details`
  }
}
```

- **Verify against audit:** This change *reports only*. It does
  not invoke `installWindowsSandbox`. The user must take the
  prescribed action. **Constraints 1, 4, 6 all hold.**

### 3.2 `src/utils/sandbox/sandbox-adapter.ts` — re-export Windows status functions

- **Currently:** `SandboxManager` (line 936-977) does not expose
  `getWindowsGroupStatus` or `getWindowsWfpStatus`. Callers that
  want Windows status must import directly from
  `@anthropic-ai/sandbox-runtime`.
- **Change:** Add the two functions to the `ISandboxManager`
  interface and the `SandboxManager` object. The `getSrtWinPath`
  function is also useful for the doctor UI; add it too.
- **Exact additions:**

```ts
// In ISandboxManager (line 889-931), add:
getWindowsGroupStatus(ref?: { groupName?: string; groupSid?: string }):
  { state: 'absent' | 'created-not-on-token' | 'ready'; sid?: string; warning?: string; error?: string }
getWindowsWfpStatus(opts?: { sublayerGuid?: string }):
  { state: 'absent' | 'installed'; filters: number; portRange?: [number, number] }
getSrtWinPath(): string

// In the SandboxManager object (line 936-977), add:
getWindowsGroupStatus: (ref) => getWindowsGroupStatusFromRuntime(ref ?? {}),
getWindowsWfpStatus: (opts) => getWindowsWfpStatusFromRuntime(opts ?? {}),
getSrtWinPath,
```

- The two private aliases forward to the runtime package. They
  are declared at the top of `sandbox-adapter.ts`:

```ts
import {
  getWindowsGroupStatus as getWindowsGroupStatusFromRuntime,
  getWindowsWfpStatus as getWindowsWfpStatusFromRuntime,
  getSrtWinPath,
} from '@anthropic-ai/sandbox-runtime'
```

- **Verify against audit:** This is a re-export, not a call. It
  enables the UI to read status without a separate import path.
  No constraint is affected.

### Phase 2 — UI

#### 3.6 `src/components/sandbox/SandboxWindowsCard.tsx`

- **New file.** A four-state card that replaces the current
  "Sandbox is enabled" / "Sandbox is disabled" UI on Windows.
- **Reads state from** `SandboxManager.getWindowsGroupStatus({})`
  and `SandboxManager.getWindowsWfpStatus({})`.
- **Renders one of four cards (per §5.2):**
  1. `group.state === 'absent'` →
     "Install Windows sandbox" / "Run /sandbox-install (one UAC
     prompt)."
  2. `group.state === 'created-not-on-token'` →
     "Log out and back in" / "The sandbox group is not yet in
     your logon token. Log out, log back in, and restart GakrCLI."
  3. `group.state === 'ready' && wfp.state === 'absent'` →
     "Install network filters" / "Run /sandbox-install to install
     the WFP filters (one UAC prompt)."
  4. `group.state === 'ready' && wfp.state === 'installed'` →
     "Sandbox is active" / "Group + WFP filters installed."

- **Verify against audit:** This is UI-only. It does not invoke
  the installer. The button it renders is a link/keystroke that
  triggers the `/sandbox-install` command, which has the
  confirm-and-force gates from §3.3.

#### 3.7 `src/components/sandbox/SandboxSettings.tsx` and `SandboxDoctorSection.tsx`

- **Add the platform gate:** on Windows, render `<SandboxWindowsCard/>`
  above the existing "Enabled / Disabled" toggle. On other
  platforms, behavior is unchanged.
- **The maintainer should also add a single-line footer on the
  existing card** that shows
  `getWindowsGroupStatus().state + " / " + getWindowsWfpStatus().state`
  when the user has explicitly enabled the sandbox on Windows.
  This is the surface for the audit's "no silent degradation"
  constraint (Constraint 4).
- **Verify against audit:** UI only. The `getWindowsGroupStatus`
  call is read-only.

### Phase 3 — Env filter

#### 3.8 `src/utils/sandbox/envFilter.ts`

- **New file.** A pure function that takes the current
  `process.env` and returns a filtered copy.
- **Behavior:** strips env vars whose names match a configurable
  pattern list before `srt-win exec` is invoked. The pattern list
  is in §7.
- **Constraint 3 (strip sensitive env vars) is enforced here.**

#### 3.9 `src/utils/sandbox/sandbox-adapter.ts` — `wrapWithSandbox`

- **Change:** before delegating to `BaseSandboxManager.wrapWithSandbox`,
  filter the env. The base manager constructs the env block from
  the broker's own env (see `launch.rs::build_env_block` in the
  audit, lines 351-370), so the host must filter before
  initialization. **However,** the env block is built *inside* the
  spawned process, not in the host. The host cannot filter the
  exec's env directly. The correct fix is at a different layer
  (see §7.2 for the exact mechanism).

### Phase 4 — Install command

#### 3.3 `src/commands/sandbox-windows-install/index.ts`

- **New file.** A new slash command. Re-uses the same dispatch
  shape as `src/commands/sandbox-toggle/index.ts`.
- **Public API (verify by reading the existing command
  registry in `src/commands/commands.ts` before implementing —
  the maintainer should add an entry there that points to this
  file):**

```ts
export async function call(
  onDone: (result?: string) => void,
  _context: unknown,
  args?: string,
): Promise<React.ReactNode | null>
```

- **Exact behavior:**

```ts
// Pseudocode for the implementer; NOT to be transcribed verbatim.

const platform = getPlatform()
if (platform !== 'windows') {
  return 'sandbox-install is only available on Windows.'
}

// Constraint 1: the command runs ONLY when the user invokes
// /sandbox-install. The host never invokes installWindowsSandbox
// from any other path. The check below is belt-and-braces; the
// /sandbox-install command is the ONLY entry point.

const trimmed = (args ?? '').trim()

// Constraint 1: reject --force from automated flows. /sandbox-install
// may accept --force only if a human typed it. We track this by
// requiring the flag as a literal CLI argument, not a config setting.
// (See §6.1 for the threat model.)
const forceAllowed = trimmed === '--force' || trimmed.startsWith('--force ')
if (trimmed.includes('force') && !forceAllowed) {
  return 'force is only allowed via the explicit --force flag. Run /sandbox-install --force.'
}

const force = forceAllowed
const userConfirmed = await confirmInstallPrompt()  // see §3.4
if (!userConfirmed) {
  onDone('Cancelled.')
  return null
}

const result = await installWindowsSandbox({
  proxyPortRange: getProxyPortRangeFromSettings(),  // §8.3
  force,
})
if (result.cancelled) {
  onDone('UAC prompt dismissed. Run /sandbox-install again when ready.')
  return null
}
if (result.error) {
  onDone(`Install failed: ${result.error}`)
  return null
}

// Re-check; the user no longer needs to log out unless the group
// was just created (which installWindowsSandbox does internally).
SandboxManager.refreshConfig()
const group = SandboxManager.getWindowsGroupStatus({})
if (group.state === 'created-not-on-token') {
  onDone('Installed. Log out and back in to finish setup, then restart GakrCLI.')
  return null
}
onDone('Installed. The Windows sandbox is active.')
return null
```

- **Verify against audit:** This is the install driver. Constraint
  1 (no `force: true` without explicit user action) is enforced
  here: `forceAllowed` requires the literal `--force` flag in the
  user's command. Constraint 6 (no unattended automatic installs)
  is enforced by the `confirmInstallPrompt()` gate. Constraint 4
  (surface state clearly) is the final onDone message.

#### 3.4 `src/commands/sandbox-windows-install/confirmInstallPrompt.tsx`

- **New file.** A React/Ink component that asks the user to
  confirm before invoking the UAC prompt. This is what enforces
  Constraint 6 — the binary is not invoked unless a human
  confirms in this UI.
- **Behavior:**
  - Title: "Install Windows sandbox"
  - Body: a one-paragraph summary of what will happen (UAC prompt
    → machine-wide WFP filters installed → local group created →
    user added to group → may require logout/login to finish).
  - Two buttons: **Install** (calls onDone(true)) and **Cancel**
    (calls onDone(false)).
  - The text MUST include the line: "This installs machine-wide
    network filters and a local user group. Other users on this
    machine are not affected."
  - The text MUST include the line: "If you pass `--force`, any
    existing install with a different port range will be
    replaced."

#### 3.5 `src/commands/commands.ts`

- **Add an entry for `sandbox-install`.** The exact shape of an
  entry here depends on the registry's design — the maintainer
  should read the surrounding entries first. The command MUST be
  registered only on Windows (gate inside `call()`, not at
  registration time, so the help text still shows on other
  platforms with a "Windows only" annotation).

### Phase 5 — Packaging

#### 3.10 `scripts/externals.ts`

- **No change required.** `@anthropic-ai/sandbox-runtime` is
  already in `INTENTIONALLY_BUNDLED` (line 158). The bundler
  pulls the entire package contents into the npm artifact,
  including the `vendor/srt-win/...` directory. `getSrtWinPath`'s
  third resolution path (`dist/vendor/srt-win/...`) works
  automatically. **The proposal item 4 was based on an incorrect
  reading of the externals list.** No edit is needed; the
  maintainer should verify by running `npm run build` and
  checking that `dist/vendor/srt-win/` exists in the packaged
  output.

#### 3.11 `package.json` `build` script

- **Verify** that the `npm run build` target is sufficient.
  No change expected; this is a verification step.

### Phase 6 — Tests

#### 3.12 `src/utils/sandbox/__tests__/sandbox-adapter.windows.test.ts`

- **New file.** Tests described in §9.

---

## 4. Required call flows

### 4.1 Install flow

```
USER TYPES: /sandbox-install
   │
   ▼
src/commands/sandbox-windows-install/index.ts::call()
   │
   ├─► getPlatform() !== 'windows'  → return "Windows only."
   │
   ├─► Parse args; detect literal "--force"  (Constraint 1)
   │
   ├─► <confirmInstallPrompt />  (Constraint 6: explicit user gesture)
   │      │
   │      └─► onDone(true|false)
   │
   ├─► userConfirmed === false  → return "Cancelled."
   │
   ├─► installWindowsSandbox({
   │      proxyPortRange: getProxyPortRangeFromSettings(),  // §8.3
   │      force: forceAllowed,
   │    })
   │      │
   │      │  (inside @anthropic-ai/sandbox-runtime/dist/sandbox/windows-sandbox-utils.js)
   │      │  spawnSync('srt-win.exe', ['install', ...])
   │      │    │
   │      │    └─► srt-win::main::Cmd::Install
   │      │          │
   │      │          ├─► maybe_self_elevate()  (one UAC prompt)
   │      │          │     └─► ShellExecuteExW(verb="runas")
   │      │          │           │
   │      │          │           └─► user dismisses → exit 10
   │      │          │           └─► user consents → install runs
   │      │          │
   │      │          ├─► wfp::ensure_group(...)  (local group)
   │      │          │
   │      │          └─► wfp::install_filters(...)  (8 WFP filters)
   │      │
   │      └─► { cancelled?: true } | { error?: "..." } | { ok: true }
   │
   ├─► result.cancelled  → return "UAC dismissed."
   ├─► result.error      → return "Install failed: ${result.error}"
   │
   ├─► SandboxManager.refreshConfig()
   │
   ├─► SandboxManager.getWindowsGroupStatus({})
   │      │
   │      └─► getWindowsGroupStatusFromRuntime({})
   │            └─► spawnSync('srt-win.exe', ['group', 'status'])
   │                  └─► returns { state, sid?, warning? }
   │
   └─► if group.state === 'created-not-on-token':
         return "Installed. Log out and back in, then restart GakrCLI."
       else:
         return "Installed. The Windows sandbox is active."
```

### 4.2 Dependency-check flow (startup)

```
GakrCLI REPL/print startup
   │
   ▼
src/main.tsx (or src/cli/print.ts)
   │
   ├─► getSandboxUnavailableReason()  (already wired)
   │      │
   │      └─► on Windows, calls windowsUnavailableMessage()
   │              │
   │              ├─► getWindowsGroupStatus({})  [read-only, no UAC]
   │              │     └─► spawnSync('srt-win.exe', ['group', 'status'])
   │              │
   │              └─► getWindowsWfpStatus({})  [read-only, no UAC]
   │                    └─► spawnSync('srt-win.exe', ['wfp', 'status'])
   │
   └─► if reason is set, print to stderr: "[!] ${reason}"
```

### 4.3 Runtime flow (every Bash command)

```
USER TYPES: any command
   │
   ▼
src/tools/BashTool/BashTool.tsx
   │
   ├─► bashToolHasPermission(...)  (existing, unchanged)
   │
   ├─► exec(command, ..., {
   │      shouldUseSandbox: shouldUseSandbox(input, commandAnalysis),
   │    })
   │      │
   │      └─► Shell.ts
   │            │
   │            └─► if shouldUseSandbox: SandboxManager.wrapWithSandbox(command)
   │                  │
   │                  └─► BaseSandboxManager.wrapWithSandbox
   │                        │
   │                        └─► on Windows, calls wrapCommandWithSandboxWindows
   │                              │
   │                              └─► constructs { argv, env }
   │                                    │
   │                                    └─► child_process.spawn(argv[0], argv[1..], { shell: false, env })
   │                                          │
   │                                          └─► srt-win.exe exec -- <argv[0]> <argv[1..]>
   │                                                │
   │                                                └─► srt-win::launch::run
   │                                                      ├─► self_protect::install_broker_dacl
   │                                                      ├─► token::make_sandbox_token
   │                                                      ├─► job::Job::new
   │                                                      ├─► winsta::WinStaDesk::new
   │                                                      ├─► build_env_block  (verbatim from broker env)
   │                                                      ├─► CreateProcessAsUserW(CREATE_SUSPENDED)
   │                                                      ├─► Job::assign(child)
   │                                                      ├─► ResumeThread(child)
   │                                                      └─► WaitForSingleObject
   │
   └─► return result to BashTool
```

### 4.4 Status display flow (doctor UI)

```
USER TYPES: /sandbox --doctor
   │
   ▼
src/commands/sandbox-toggle/sandbox-toggle.tsx (existing)
   │
   └─► <SandboxSettings onComplete={onDone} depCheck={depCheck} />
         │
         └─► <SandboxSettings />  (src/components/sandbox/SandboxSettings.tsx)
               │
               ├─► getPlatform() === 'windows'  → render <SandboxWindowsCard />
               │                                     │
               │                                     └─► getWindowsGroupStatus({})
               │                                     └─► getWindowsWfpStatus({})
               │
               └─► other platforms: existing UI, unchanged
```

### 4.5 Env-filter flow (per Bash command, when sandboxed)

```
src/tools/BashTool/BashTool.tsx (or src/utils/Shell.ts)
   │
   ├─► before calling exec() with shouldUseSandbox: true
   │
   ├─► process.env = filterEnvForSandbox(process.env)  // see §7
   │
   └─► proceed with the existing flow
```

> **Implementation note for §4.5:** the env block is constructed
> *inside* `srt-win exec` from its own process env, not from
> argv-passed env. The host cannot filter what `srt-win exec`
> reads at runtime. The correct approach is to filter
> `process.env` on the host **before** spawning `srt-win.exe`
> itself. See §7.2 for the exact mechanism.

---

## 5. Four-state Windows status model and UI behavior

### 5.1 The four states

| State | Group | WFP | Action |
|---|---|---|---|
| **A** | `absent` | (irrelevant) | Install (UAC) |
| **B** | `created-not-on-token` | (irrelevant) | Log out and back in |
| **C** | `ready` | `absent` | Install WFP (UAC) |
| **D** | `ready` | `installed` | None — sandbox is active |

### 5.2 UI mapping (per card)

| State | Title | Body | Action button |
|---|---|---|---|
| A | Install Windows sandbox | "Run /sandbox-install to set up srt-win (one UAC prompt)." | "Install" (renders the slash command) |
| B | Finish setup | "The sandbox group is not yet in your logon token. Log out, log back in, and restart GakrCLI." | None (info only) |
| C | Install network filters | "Run /sandbox-install to install the WFP filters (one UAC prompt)." | "Install filters" |
| D | Sandbox is active | "Group and WFP filters are installed." | "Run /sandbox --doctor for details" (link) |

### 5.3 State detection

```ts
type State = 'A' | 'B' | 'C' | 'D'

function detectWindowsSandboxState(): State {
  const group = SandboxManager.getWindowsGroupStatus({})
  if (group.error) return 'A'  // treat as absent; UI shows install
  if (group.state === 'absent') return 'A'
  if (group.state === 'created-not-on-token') return 'B'
  // group.state === 'ready'
  const wfp = SandboxManager.getWindowsWfpStatus({})
  if (wfp.error || wfp.state === 'absent') return 'C'
  return 'D'  // ready + installed
}
```

### 5.4 Edge cases

- **Stale read:** `getWindowsGroupStatus` is a `spawnSync` call.
  The result may be up to a few hundred milliseconds old. The UI
  does not auto-refresh; the user re-opens the doctor to see
  fresh state.
- **`group.error` non-null:** the `srt-win.exe` binary is missing
  or failed to run. The card falls back to State A and the
  install button is disabled with a tooltip explaining that
  `srt-win.exe` is not on disk. The user can report this as a
  packaging bug.
- **`group.warning` non-null** (e.g. deny-only or Present): the
  UI surfaces the warning text below the card title but does
  not change the state.

### 5.5 `getSandboxUnavailableReason()` mapping

| State | Reason string |
|---|---|
| A | `sandbox.enabled is set but the Windows sandbox has not been installed. Run /sandbox-install to set up srt-win (one UAC prompt).` |
| B | `sandbox.enabled is set but the sandbox group is not yet in your logon token. Log out and back in to finish setup, then restart GakrCLI.` |
| C | `sandbox.enabled is set but the Windows network filters are not installed. Run /sandbox-install to install the WFP filters (one UAC prompt).` |
| D | `undefined` (no warning) |

---

## 6. The six audit constraints — where each is enforced

### 6.1 Constraint 1: Never invoke `force:true` without an explicit user action

- **Enforcement site:** `src/commands/sandbox-windows-install/index.ts`.
- **Mechanism:** `forceAllowed = (args === '--force' || args.startsWith('--force '))`.
  The flag must appear literally in the user's typed command; it
  cannot be set via settings, env, or a config file.
- **Audit §12 failure mode 1:** "the `--force` flag is a real
  power-tool, not a convenience."
- **Test:** `sandbox-windows-install.test.ts` — verify that
  setting `force: true` via settings does not change the
  installWindowsSandbox call.

### 6.2 Constraint 2: Do not expose or use `--skip-group-check`

- **Enforcement site:** structural. The JS shim
  (`@anthropic-ai/sandbox-runtime/dist/sandbox/windows-sandbox-utils.js`)
  does not expose a wrapper for `srt-win exec --skip-group-check`.
  The host cannot enable it.
- **Audit §13:** "the GakrCLI host code must not invoke `srt-win
  exec --skip-group-check`. The JS shim does not expose this
  flag (the `wrapCommandWithSandboxWindows` function does not
  accept it)."
- **Test:** add a test that searches
  `node_modules/@anthropic-ai/sandbox-runtime/dist` for
  `--skip-group-check` and asserts it is not present in any
  exported API.

### 6.3 Constraint 3: Strip sensitive env vars before spawning sandboxed processes

- **Enforcement site:** `src/utils/sandbox/envFilter.ts` (new
  file) + integration point in §7.2.
- **Mechanism:** a pure function `filterEnvForSandbox(env)` that
  drops or reda vars matching the patterns in §7.1.
- **Audit §9:** "the host (GakrCLI in our case) is responsible
  for pre-spawn filtering. **Decision needed:** does the GakrCLI
  host pre-strip secrets?"
- **Test:** `envFilter.test.ts` — verify that each pattern in
  §7.1 strips a representative var and that non-matching vars
  are preserved.

### 6.4 Constraint 4: Surface sandbox state clearly and avoid silent degradation

- **Enforcement site:** `src/utils/sandbox/sandbox-adapter.ts`
  `getSandboxUnavailableReason` (the Windows branch) and
  `src/components/sandbox/SandboxWindowsCard.tsx`.
- **Mechanism:** the user is told exactly which of the four
  states they are in, with the corrective action for each.
- **Audit §3 (in WINDOWS_PROPOSAL.md):** "the user has no way to
  bootstrap the WFP filters... `isSandboxingEnabled` silently
  degrades to 'unsandboxed.' This is the exact footgun #34044
  was about."
- **Test:** `sandbox-adapter.windows.test.ts` — verify
  `getSandboxUnavailableReason` returns the right message for
  each of the four states (with mocked `getWindowsGroupStatus`
  and `getWindowsWfpStatus`).

### 6.5 Constraint 5: Keep WFP proxyPortRange coordinated with the JS proxy bind range

- **Enforcement site:** `getProxyPortRangeFromSettings()` in
  `src/commands/sandbox-windows-install/index.ts` AND the
  JS-side proxy bind logic (which lives in
  `sandbox-runtime`).
- **Mechanism:** the install command reads
  `settings.sandbox?.windows?.proxyPortRange` (or the default
  `[60080, 60089]`) and passes it to `installWindowsSandbox`.
  The JS proxy bind logic reads the same setting.
- **Audit §8 (failure mode 1):** "If a user's environment
  requires a different loopback port range, the install needs
  `--proxy-port-range` and the JS proxies need to be told to
  bind inside that range. The two are **not auto-coordinated**;
  the host (GakrCLI in our case) must keep them in sync."
- **Implementation:** the install command reads
  `getProxyPortRangeFromSettings()`. The JS proxy bind code in
  `sandbox-runtime` reads the same setting via
  `BaseSandboxManager.initialize`. The host's responsibility is
  to surface this in the Settings UI: a "Loopback port range"
  field that warns the user "this must match your GakrCLI
  settings".

### 6.6 Constraint 6: Reject unattended or automatic force installations

- **Enforcement site:** `confirmInstallPrompt()` in
  `src/commands/sandbox-windows-install/confirmInstallPrompt.tsx`.
- **Mechanism:** no path in the host code may invoke
  `installWindowsSandbox` without going through this prompt.
  The prompt is a React/Ink component that requires a human to
  press **Install** or **Cancel**; the binary is invoked only
  on the Install path.
- **Audit §12 (failure mode 1):** "the `--force` flag is a
  real power-tool, not a convenience."
- **Test:** verify that no path in
  `src/commands/` other than `sandbox-windows-install/index.ts`
  imports `installWindowsSandbox`. This can be a static-analysis
  test in `scripts/no-auto-force-install.test.ts` that greps
  for `installWindowsSandbox` across `src/`.

---

## 7. Environment-variable filtering requirements

### 7.1 Strip patterns

The default filter strips env vars whose names match **any** of
these patterns (case-insensitive):

- `*TOKEN*` (e.g. `GITHUB_TOKEN`, `SLACK_TOKEN`, `*_AUTH_TOKEN`)
- `*SECRET*`
- `*KEY*` (e.g. `AWS_ACCESS_KEY_ID`, `STRIPE_API_KEY`) — but
  `SSH_AGENT_PID` and `SSH_AUTH_SOCK` are kept
- `*PASSWORD*`
- `*PASSWD*`
- `*CREDENTIAL*`
- `*PRIVATE*` (e.g. `GITLAB_PRIVATE_TOKEN`)
- `*API_KEY*` (e.g. `OPENAI_API_KEY`)
- `*SESSION*` (e.g. `NODE_AUTH_SESSION`) — but
  `SESSIONNAME` (Windows logon session) is **kept**
- `*OAUTH*`
- `*BEARER*`
- `*JWT*`

**Always kept (allowlist):**
- `PATH`, `PATHEXT`, `TEMP`, `TMP`, `TMPDIR`, `HOME`, `USERPROFILE`,
  `HOMEDRIVE`, `HOMEPATH`
- `LANG`, `LC_*`, `TZ`
- `SHELL`, `COMSPEC`, `SYSTEMROOT`, `WINDIR`
- `LANG_*`
- `*_PROXY`, `*_proxy` (proxy vars only — the audit notes the
  exact case-twins behavior of `srt-win exec`)
- `NO_PROXY`, `no_proxy`
- `SSH_AGENT_PID`, `SSH_AUTH_SOCK` (audit keeps these)
- `SESSIONNAME` (Windows logon session — audit keeps this)
- `DISPLAY`, `WAYLAND_DISPLAY`, `XAUTHORITY`
- `TERM`, `COLORTERM`, `FORCE_COLOR`, `NO_COLOR`
- `EDITOR`, `VISUAL`
- `PAGER`
- `XDG_*` (Linux-style paths, harmless on Windows)
- `GIT_*` (read-only operations, audit considers these safe)
- `CLAUDE_CODE_*` (host identification)
- `NODE_*` (Node-specific, but host env filter is in Node)

> **Why this allowlist?** The audit identified the threat as
> "the agent already has the env" and concluded the host is
> responsible for filtering. The allowlist is conservative:
> strip by name pattern, then allowlist the rest. This is
> intentionally strict; the maintainer may relax the patterns
> after a security review.

### 7.2 Implementation point

The env block passed to the child is built inside `srt-win exec`
from its own process env (audit §10, `build_env_block` lines
351-370). The host cannot filter the exec's env directly. The
correct filter point is:

**`src/utils/Shell.ts` line 293-307** (the `exec` function) —
before spawning the child that will become `srt-win exec`, the
host sets a process-level env, and the inner `srt-win exec`
inherits that env.

But that's also wrong: `srt-win exec` is spawned as a child of
the *host* (GakrCLI), not as a grandchild. The host's
`process.env` IS the env that `srt-win exec` inherits. The
filter point is therefore:

**`process.env` itself, modified before spawning `srt-win exec`.**

Concretely, the maintainer adds a helper:

```ts
// src/utils/sandbox/envFilter.ts
export function filterEnvForSandbox(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {}
  for (const [k, v] of Object.entries(env)) {
    if (shouldKeep(k)) out[k] = v
  }
  return out
}

function shouldKeep(name: string): boolean {
  if (ALLOWLIST.some(p => matchPattern(p, name))) return true
  if (STRIPLIST.some(p => matchPattern(p, name))) return false
  return true  // default: keep (the strip patterns are explicit)
}
```

And in the spawn call site (`src/utils/sandbox/sandbox-adapter.ts`
`wrapWithSandbox`):

```ts
// BEFORE BaseSandboxManager.wrapWithSandbox, on Windows only:
if (getPlatform() === 'windows') {
  // Filter the host's process env. srt-win exec inherits
  // process.env at spawn time (audit §10), so the inner exec
  // sees the filtered env.
  process.env = filterEnvForSandbox(process.env)
}
```

> **Caveat:** this mutates `process.env` for the duration of the
> host's lifetime. To avoid that, the maintainer should pass
> `{ env: filterEnvForSandbox(process.env) }` to
> `BaseSandboxManager.wrapWithSandbox` if the API supports it.
> If it does not, the host must filter and restore:
>
> ```ts
> const original = process.env
> process.env = filterEnvForSandbox(process.env)
> try {
>   return await BaseSandboxManager.wrapWithSandbox(...)
> } finally {
>   process.env = original
> }
> ```
>
> The maintainer should prefer the restore-in-finally pattern.

### 7.3 Settings surface

The strip patterns should be configurable via
`settings.sandbox?.windows?.envFilterStripPatterns` and
`settings.sandbox?.windows?.envFilterAllowPatterns` (each a
string array of glob patterns). Defaults are the lists in §7.1.

---

## 8. Packaging and binary-discovery requirements

### 8.1 Binary discovery

`srt-win.exe` is found by `getSrtWinPath()` from
`@anthropic-ai/sandbox-runtime/dist/sandbox/windows-sandbox-utils.js`.
The resolution order is:

1. `SRT_WIN_PATH` env var (CI uses this).
2. `../../vendor/srt-win/target/release/srt-win.exe` relative
   to the JS file in dev (i.e. `node_modules/.../dist/sandbox/`
   → `node_modules/.../vendor/srt-win/...`).
3. Bundled: when `@anthropic-ai/sandbox-runtime` is bundled into
   the GakrCLI npm artifact, the entire `vendor/` tree ships
   with it. The relative path becomes
   `dist/vendor/srt-win/target/release/srt-win.exe` post-build.

### 8.2 How the binary ships

`@anthropic-ai/sandbox-runtime` is in
`scripts/externals.ts::INTENTIONALLY_BUNDLED` (line 158). The
GakrCLI bundler pulls the entire package contents — including
`vendor/` — into the npm artifact. The maintainer should
verify this by running `npm run build` and confirming:

- `dist/vendor/srt-win/target/release/srt-win.exe` exists in
  the build output.
- The npm package contains this file (run `npm pack` and check
  the tarball).

> **No edit to `scripts/externals.ts` is required.** The
> proposal item 4 was based on a misreading of the externals
> list.

### 8.3 Settings surface

`settings.sandbox?.windows?.proxyPortRange` — a
`[number, number]` tuple (default `[60080, 60089]`). The
install command reads this and passes it to
`installWindowsSandbox`. The JS proxy bind code reads the same
setting via `BaseSandboxManager.initialize`. The two are
coordinated by the host reading from the same SettingsJson
field.

`settings.sandbox?.windows?.groupName` — a string (default
`'sandbox-runtime-net'`). The install command reads this and
passes it to `installWindowsSandbox`.

`settings.sandbox?.windows?.sublayerGuid` — a string
(GUID format). Default is the upstream constant
`0x2c5d0ad6-5f3b-4d4e-9b8f-1a3e7c9d0b21`. Most users should
not change this; the SettingsJson field is for enterprise
deployments that share a sublayer with other tools.

### 8.4 SettingsJson edit

The maintainer adds the three fields to the
`SettingsJson` interface in
`src/utils/settings/types.ts`:

```ts
// In SettingsJson.sandbox:
sandbox?: {
  // ... existing fields
  windows?: {
    proxyPortRange?: [number, number]
    groupName?: string
    sublayerGuid?: string
    envFilterStripPatterns?: string[]
    envFilterAllowPatterns?: string[]
  }
}
```

And documents the new fields in `docs/settings/REFERENCE.md`.

---

## 9. CI and test requirements

### 9.1 New test file: `src/utils/sandbox/__tests__/sandbox-adapter.windows.test.ts`

Asserts (using mocked `getWindowsGroupStatus` and
`getWindowsWfpStatus`):

- `SandboxManager.isSupportedPlatform()` returns `true` when
  `getPlatform()` returns `'windows'`.
- `SandboxManager.getWindowsGroupStatus({})` forwards to
  the runtime function with the right ref shape.
- `SandboxManager.getWindowsWfpStatus({})` forwards to
  the runtime function with the right opts shape.
- `getSandboxUnavailableReason()` returns the State A message
  when `getWindowsGroupStatus` returns `{state: 'absent'}` and
  the user has `sandbox.enabled = true`.
- `getSandboxUnavailableReason()` returns the State B message
  when `getWindowsGroupStatus` returns
  `{state: 'created-not-on-token'}`.
- `getSandboxUnavailableReason()` returns the State C message
  when `getWindowsGroupStatus` returns `{state: 'ready'}` and
  `getWindowsWfpStatus` returns `{state: 'absent'}`.
- `getSandboxUnavailableReason()` returns `undefined` when
  both return installed/ready.
- `getSandboxUnavailableReason()` returns `undefined` when
  `sandbox.enabled` is not set, regardless of the four states.
- The function does not throw on any mocked error from the
  status functions; it returns a generic fallback message.

### 9.2 New test file: `src/utils/sandbox/__tests__/envFilter.test.ts`

Asserts:

- Each strip pattern in §7.1 strips a representative env var
  (e.g. `GITHUB_TOKEN` matches `*TOKEN*`).
- Each allowlist entry in §7.1 keeps a representative env var
  (e.g. `PATH` is kept).
- Non-matching vars are preserved verbatim.
- A `SESSIONNAME` is kept (Windows logon session); a
  `NODE_AUTH_SESSION` is stripped (`*SESSION*`).
- An `SSH_AGENT_PID` is kept; an `AWS_ACCESS_KEY_ID` is
  stripped (`*KEY*`).

### 9.3 New test file: `src/commands/sandbox-windows-install/sandbox-windows-install.test.ts`

Asserts:

- On non-Windows, returns "Windows only."
- When `args` is empty, the `confirmInstallPrompt` is rendered.
- When `confirmInstallPrompt` returns `false`, no
  `installWindowsSandbox` call is made and the result is
  "Cancelled."
- When `confirmInstallPrompt` returns `true` and
  `installWindowsSandbox` returns `{cancelled: true}`, the
  result is "UAC prompt dismissed...".
- When `installWindowsSandbox` returns `{error: '...'}`, the
  result is "Install failed: ...".
- When `installWindowsSandbox` succeeds and
  `getWindowsGroupStatus` returns
  `{state: 'created-not-on-token'}`, the result is "Log out
  and back in...".
- When `installWindowsSandbox` succeeds and
  `getWindowsGroupStatus` returns `{state: 'ready'}`, the
  result is "Installed. The Windows sandbox is active."
- The `force: true` flag is **only** forwarded when the
  user's literal command starts with `--force`. Setting
  `force: true` via settings, env, or a different argument
  shape does not enable force.

### 9.4 New test file: `scripts/no-auto-force-install.test.ts`

Static analysis:

- Greps `src/commands/` for any import or call to
  `installWindowsSandbox`.
- Asserts that the only file that imports it is
  `sandbox-windows-install/index.ts`.
- Fails the build if any other file imports it.

### 9.5 New test file: `scripts/no-skip-group-check.test.ts`

Static analysis:

- Greps `node_modules/@anthropic-ai/sandbox-runtime/dist/` for
  the string `--skip-group-check`.
- Asserts that no exported API references it.

### 9.6 CI matrix

Add a Windows CI job to `.github/workflows/pr-checks.yml`. The
job must:

- Run on `windows-latest`.
- Install Bun (`oven-sh/setup-bun@v1`).
- Run `bun test src/utils/sandbox/__tests__/sandbox-adapter.windows.test.ts`.
- Run `bun test src/utils/sandbox/__tests__/envFilter.test.ts`.
- Run `bun test src/commands/sandbox-windows-install/`.
- Run `bun run scripts/externalsValidation.ts` to confirm the
  Windows binary is still bundled.
- Skip the `srt-win` integration tests (they require elevation
  and a real WFP engine; they are run in a separate, manually
  triggered workflow).

### 9.7 Manual smoke test (documented in `docs/sandbox/windows.md`)

The maintainer should add a `docs/sandbox/windows.md` that
walks a Windows user through:

1. `gakrcli` → `/sandbox-install` → expect UAC prompt → expect
   "Installed. The Windows sandbox is active."
2. `gakrcli` → `/sandbox` → expect the four-state card showing
   "Sandbox is active."
3. `gakrcli` → `/sandbox --doctor` → expect all green.
4. From a sandboxed Bash command, `ncat example.com 80` and
   confirm the connection is blocked.
5. From a sandboxed Bash command, `curl -x http://127.0.0.1:60080
   https://example.com` and confirm the request goes through
   the host proxy.

---

## 10. Error handling and user messaging

### 10.1 Error message catalog

Every error path returns a user-readable string. No raw stack
traces, no JSON, no internal field names.

| Source | User-facing message |
|---|---|
| `installWindowsSandbox({cancelled: true})` | "UAC prompt dismissed. Run /sandbox-install again when ready." |
| `installWindowsSandbox({error: "..."})` | `Install failed: ${error}` |
| `getWindowsGroupStatus({error: "..."})` | Card shows "Sandbox status unavailable" with `error` text. `getSandboxUnavailableReason` returns a generic message. |
| `getWindowsWfpStatus({error: "..."})` | Card shows "Network filter status unavailable" with `error` text. |
| `process.platform !== 'win32'` and command is `/sandbox-install` | "/sandbox-install is only available on Windows." |
| `srt-win.exe` not on disk (binary missing) | "Windows sandbox is not installed. The srt-win.exe binary was not found in the GakrCLI installation. This is a packaging bug; please report it." (tooltip on the disabled install button) |
| UAC dismissed mid-install | See row 1. |
| Group is `created-not-on-token` after install | "Installed. Log out and back in to finish setup, then restart GakrCLI." |
| Existing install with different port range, no `--force` | "A Windows sandbox is already installed with a different port range. Run /sandbox-install --force to replace it." (exit code 13 from `srt-win` is mapped to this message.) |

### 10.2 Error path rules

- **No silent catch.** Every `try/catch` either recovers with a
  documented fallback or surfaces a message.
- **No raw `errorMessage(e)` in user-facing text.** Wrap in
  context: `Failed to install Windows sandbox: ${shortError(e)}`.
- **No stack traces in production logs.** Use
  `logForDebugging(..., { level: 'error' })` for server-side
  detail; the user sees the short message.

### 10.3 Logging

- All `srt-win` invocations log via
  `logForDebugging('srt-win ' + args.join(' ') + ': ' + exitCode + ' ' + out)`.
- User-facing errors are returned via the slash-command `onDone`
  callback, not logged.
- The four-state card never logs; it's a pure read.

---

## 11. Rollout sequence and implementation phases

> Each phase is a single PR. The phases are designed so that
> any single phase can be reverted without breaking the others.

### Phase 1 — Reporting and status (no install driver)

**Files:**
- `src/utils/sandbox/sandbox-adapter.ts` — `getSandboxUnavailableReason`
  Windows branch + `ISandboxManager` re-exports.

**Tests:** `sandbox-adapter.windows.test.ts`.

**Rollout:** This phase is **observation only**. The user
sees clearer error messages but cannot yet install. The host
still does not call `installWindowsSandbox`.

**Risk:** Low. The change is additive; the platform check
already returns `true`, so this only affects the error message
when `sandbox.enabled = true` and the install is missing.

**Verification:**
- `bun test src/utils/sandbox/__tests__/sandbox-adapter.windows.test.ts`
- `bun run typecheck` (no `bun test` required, per project
  workflow rule)
- Manual: on a Windows machine with `sandbox.enabled = true`
  but no install, launch `gakrcli` and confirm the error
  message is the State A message.

### Phase 2 — UI

**Files:**
- `src/components/sandbox/SandboxWindowsCard.tsx` (new).
- `src/components/sandbox/SandboxSettings.tsx` (edit: add
  platform gate + render the new card).
- `src/components/sandbox/SandboxDoctorSection.tsx` (edit:
  same).

**Tests:** Manual; the existing component tests cover
rendering.

**Rollout:** The user sees the four-state card in the doctor
UI. The "Install" button is a render of the
`/sandbox-install` command, which does not yet exist; clicking
it shows an "unknown command" message.

**Risk:** Low. The card is a pure read.

**Verification:**
- `bun run typecheck`
- Manual: on a Windows machine, open `/sandbox --doctor` and
  confirm the four states render correctly (each requires a
  separate Windows VM state).

### Phase 3 — Env filter

**Files:**
- `src/utils/sandbox/envFilter.ts` (new).
- `src/utils/sandbox/sandbox-adapter.ts` `wrapWithSandbox`
  (edit: filter before delegating on Windows only).
- `src/utils/settings/types.ts` (edit: add `sandbox.windows.*`
  fields).
- `docs/settings/REFERENCE.md` (edit: document the new fields).

**Tests:** `envFilter.test.ts`.

**Rollout:** The host filters sensitive env vars before
spawning `srt-win exec`. macOS/Linux behavior is unchanged.

**Risk:** Medium. If the filter strips a var the user expects
to pass through, the sandboxed child will see a different env
than today. The default patterns are conservative; the
maintainer should add a debug-mode toggle that prints the
filtered env to a log file (not stdout) for the first week
of rollout.

**Verification:**
- `bun test src/utils/sandbox/__tests__/envFilter.test.ts`
- Manual: on a Windows machine, set `GITHUB_TOKEN` in the
  shell env, run a sandboxed Bash command, and confirm the
  child does not see `GITHUB_TOKEN`.

### Phase 4 — Install command

**Files:**
- `src/commands/sandbox-windows-install/index.ts` (new).
- `src/commands/sandbox-windows-install/confirmInstallPrompt.tsx`
  (new).
- `src/commands/commands.ts` (edit: register the command).

**Tests:** `sandbox-windows-install.test.ts`.

**Rollout:** The user can run `/sandbox-install` to install
the Windows sandbox. This is the only code path that invokes
`installWindowsSandbox`. The `force: true` flag is gated by
the literal `--force` argument and the `confirmInstallPrompt`
gate.

**Risk:** High. This is the install driver. Audit Constraint 1
(force gating) and Constraint 6 (user confirmation) MUST be
enforced. The `no-auto-force-install.test.ts` static analysis
test must pass.

**Verification:**
- `bun test src/commands/sandbox-windows-install/`
- `bun test scripts/no-auto-force-install.test.ts`
- Manual: on a Windows VM, run `/sandbox-install` and confirm
  the UAC prompt appears, the install completes, and the
  four-state card moves from A to D.
- Manual: attempt to invoke `installWindowsSandbox` from any
  other path; confirm the test fails.

### Phase 5 — Packaging verification

**Files:** none (no edits expected).

**Actions:**
- `npm run build` on Windows.
- Confirm `dist/vendor/srt-win/target/release/srt-win.exe`
  exists in the build output.
- `npm pack` and inspect the tarball; confirm the binary is
  present.

**Risk:** None (verification only).

**Verification:** visual inspection of the build output and
tarball.

### Phase 6 — CI

**Files:**
- `.github/workflows/pr-checks.yml` (edit: add the Windows
  job).
- `scripts/no-skip-group-check.test.ts` (new).
- `scripts/no-auto-force-install.test.ts` (new).
- `docs/sandbox/windows.md` (new: manual smoke-test guide).

**Tests:** the new static-analysis tests.

**Verification:** the new CI job passes; the smoke-test doc
is linked from `docs/sandbox/README.md`.

---

## 12. Verified facts from source code

Each fact below is something the implementer can verify directly
in the repo, without trusting this document.

### 12.1 `BaseSandboxManager.isSupportedPlatform` returns `true` on Windows

- **Source:** `node_modules/@anthropic-ai/sandbox-runtime/dist/sandbox/sandbox-manager.js:350-357`.
- **Verify by reading:** the function body and the platform
  constants.

### 12.2 `BaseSandboxManager.checkDependencies` routes to `checkWindowsDependencies` on Windows

- **Source:** same file, lines 400-404.
- **Verify by reading:** the platform branch in
  `checkDependencies`.

### 12.3 The Windows backend ships in the package

- **Source:** `node_modules/@anthropic-ai/sandbox-runtime/dist/sandbox/windows-sandbox-utils.{js,d.ts}`.
- **Verify by listing** the `dist/sandbox/` directory.

### 12.4 `@anthropic-ai/sandbox-runtime` is in `INTENTIONALLY_BUNDLED`

- **Source:** `scripts/externals.ts:158`.
- **Verify by reading** the array.

### 12.5 The four status functions are exported by name

- **Source:** `node_modules/@anthropic-ai/sandbox-runtime/dist/sandbox/windows-sandbox-utils.d.ts`.
- **Verify by grepping** for `export function`.

### 12.6 `--skip-group-check` is not in the exported API

- **Source:** absence from `windows-sandbox-utils.d.ts`.
- **Verify by grepping** the dist directory for the string.

### 12.7 `srt-win.exe` builds to a deterministic path

- **Source:** `node_modules/@anthropic-ai/sandbox-runtime/vendor/srt-win/Cargo.toml:14`
  (`src/main.rs`).
- **Verify by reading** the build output path is
  `target/release/srt-win.exe` (Cargo default).

### 12.8 The audit's six constraints are stated in `SRT_WIN_AUDIT.md`

- **Source:** `docs/sandbox/SRT_WIN_AUDIT.md` §14, "Recommendation."
- **Verify by reading** the recommendation section.

### 12.9 The proposal's five items are stated in `WINDOWS_PROPOSAL.md`

- **Source:** `docs/sandbox/WINDOWS_PROPOSAL.md` §"The actual gap."
- **Verify by reading** the gap list.

### 12.10 The four states are defined by the union of `WindowsGroupStatus` and `WindowsWfpStatus`

- **Source:** `node_modules/@anthropic-ai/sandbox-runtime/dist/sandbox/windows-sandbox-utils.d.ts`.
- **Verify by reading** the type definitions.

---

## 13. Audit conclusions

From `docs/sandbox/SRT_WIN_AUDIT.md` §14:

> "The `srt-win` implementation is sufficient for GakrCLI's
> Windows backend as written. The boundary holds; the
> transactional design is correct; the documented fail-open path
> (`--skip-group-check`) is not exposed to the JS shim and so
> cannot be reached by the GakrCLI host."

> "No additional host-side hardening is required for the Windows
> sandbox boundary itself."

> "The GakrCLI host code must observe the following constraints
> when integrating with the JS shim: ..."

The six constraints are reproduced verbatim in §6.

---

## 14. Required implementation work

This is the work the maintainer must perform to ship the
integration. Each item is a discrete change; each is mapped to
a phase in §11.

### 14.1 Phase 1 — Reporting

- [ ] Add the `windowsUnavailableMessage()` helper to
      `src/utils/sandbox/sandbox-adapter.ts`.
- [ ] Replace the unsupported-platform branch in
      `getSandboxUnavailableReason` to call it.
- [ ] Add `getWindowsGroupStatus`, `getWindowsWfpStatus`, and
      `getSrtWinPath` to the `ISandboxManager` interface and
      the `SandboxManager` object.
- [ ] Add the `src/utils/sandbox/__tests__/sandbox-adapter.windows.test.ts`
      test file.

### 14.2 Phase 2 — UI

- [ ] Create `src/components/sandbox/SandboxWindowsCard.tsx`.
- [ ] Add the platform gate in `SandboxSettings.tsx` and
      `SandboxDoctorSection.tsx`.

### 14.3 Phase 3 — Env filter

- [ ] Create `src/utils/sandbox/envFilter.ts`.
- [ ] Add the `sandbox.windows.*` fields to `SettingsJson`.
- [ ] Wire the filter into `wrapWithSandbox` (Windows only).
- [ ] Document the new fields in `docs/settings/REFERENCE.md`.
- [ ] Add `envFilter.test.ts`.

### 14.4 Phase 4 — Install command

- [ ] Create `src/commands/sandbox-windows-install/index.ts`.
- [ ] Create `src/commands/sandbox-windows-install/confirmInstallPrompt.tsx`.
- [ ] Register the command in `src/commands/commands.ts`.
- [ ] Add `sandbox-windows-install.test.ts`.

### 14.5 Phase 5 — Packaging

- [ ] Verify `npm run build` produces
      `dist/vendor/srt-win/target/release/srt-win.exe`.
- [ ] Verify `npm pack` includes the binary.

### 14.6 Phase 6 — CI

- [ ] Add Windows CI job to `.github/workflows/pr-checks.yml`.
- [ ] Add `scripts/no-auto-force-install.test.ts`.
- [ ] Add `scripts/no-skip-group-check.test.ts`.
- [ ] Create `docs/sandbox/windows.md`.

---

## 15. Optional future enhancements

These are not required for the integration. They are listed so
the maintainer can see the design space, not so they can be
done now.

### 15.1 Per-user sublayer provisioning

Today the WFP filter set is machine-wide (audit §1, design
note 1). A future version could install a sublayer per user
under `\Users\<sid>\AppData\...`. This would require
`SetProcessWindowStation` to a user-private WS first, which
is not how `srt-win install` works today. **Not in scope.**

### 15.2 DNS proxy

The audit identified DNS leakage as an open question. A future
version could route sandboxed DNS through the JS proxy. The
proxy would intercept `getaddrinfo` from the child; the
Windows kernel does not provide a hook for this. **Not in
scope; no kernel mechanism available without
`AppContainer`-style DNS APIs.**

### 15.3 Loopback allowlist for dev servers

Today the loopback permit is a fixed range `[low, high]`. A
future version could add an `allowLocalBinding` config
(macOS/Linux have this) that opens additional loopback ports.
The audit notes the Windows backend does not have this. **Not
in scope; would require a richer SD in filter 2.**

### 15.4 Telemetry

The audit's "Diagnostics" comment in `self_protect.rs:120-128`
suggests a `SANDBOX_RUNTIME_WIN_DEBUG` env var that logs the
applied DACL as SDDL. A future version could surface this in
the doctor UI. **Not in scope.**

### 15.5 Bundling source vs binary

The spec assumes `srt-win.exe` is shipped as a pre-built
binary. A future version could ship the Rust source and build
on first run, which would let the user audit the binary
themselves. **Not in scope; adds significant CI complexity and
requires a Rust toolchain on the user's machine.**

### 15.6 Uninstall command

The `uninstallWindowsSandbox` and `deleteWindowsGroup` APIs
exist. A `/sandbox-uninstall` command would wrap them. The
audit identified "another non-sandbox process belonging to the
same user can still open the broker" as a residual, which
uninstall would not fix. **Not in scope; can be added later
if users ask.**

### 15.7 `force: true` UX

The current `force: true` flow requires the literal `--force`
flag. A future version could add a confirmation dialog in
`confirmInstallPrompt` when `force: true` is requested, with
a one-line explanation of what will be replaced. **Not in
scope; the current literal-flag check is sufficient.**

---

## End of spec

This document is the complete engineering contract for the
Windows sandbox host integration. A maintainer who follows the
six phases in §11 and the six constraints in §6 can ship the
integration without further design decisions. The audit in
`SRT_WIN_AUDIT.md` is the security review; the proposal in
`WINDOWS_PROPOSAL.md` is the architectural plan; this spec is
the implementation.
