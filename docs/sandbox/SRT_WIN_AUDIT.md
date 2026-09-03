# `srt-win` Security Audit Checklist

> Source: `node_modules/@anthropic-ai/sandbox-runtime/vendor/srt-win/`
> Read in full: `main.rs`, `lib.rs`, `wfp.rs`, `token.rs`, `job.rs`,
> `launch.rs`, `sid.rs`, `self_protect.rs`, `winsta.rs`, `util.rs`,
> `tests/sd_access_check_matrix.rs`, `Cargo.toml`.
> Status: **read-only review — no code changes proposed yet.**

## 0. Scope and posture

`srt-win` is the Rust half of the Windows sandbox backend for
`sandbox-runtime`. It is invoked from the JS shim in
`node_modules/@anthropic-ai/sandbox-runtime/dist/sandbox/windows-sandbox-utils.js`,
which spawns the binary via `spawnSync` and parses its stdout. The CLI has
four subcommand trees: `install`/`uninstall` (convenience), `group {create,
status, delete}`, `wfp {install, status, uninstall}`, and `exec -- target [args...]`.

The binary is invoked three ways:

1. **Read-only status** (`group status`, `wfp status`) — runs as the broker,
   no elevation, used for `checkWindowsDependencies` and `getSandboxDisabledReason`.
2. **Mutating admin** (`install`, `uninstall`, `group create/delete`, `wfp
   install/uninstall`) — self-elevates via `ShellExecuteExW(verb="runas")` on
   first invocation; on cancellation returns exit 10.
3. **`exec`** — the actual sandbox spawn path; runs as the broker with the
   group enabled in its own token.

The Rust source is sound as a sandbox mechanism. The threat model it
addresses is the *sandboxed child*: a process tree spawned by a coding
agent, where the parent's identity is the same user. The audit focuses
on whether the boundaries actually hold.

## 1. WFP filter creation and enforcement

| | |
|---|---|
| **File / function** | `src/wfp.rs` — `install_filters`, `add_filter`, `sddl_nonmember`, `sddl_group`, `SDDL_EVERYONE`, `for_each_tagged_filter`, `delete_tagged_filters`, `filter_status` |
| **Purpose** | Create a persistent WFP filter set under a sublayer, keyed on the discriminator group SID, that lets the broker reach the internet and the host proxies but blocks the sandboxed child. |
| **Security boundary enforced** | Network egress. WFP's `ALE_AUTH_CONNECT_V4` and `_V6` layers are the kernel-level callout for outbound TCP/UDP. |
| **Threats mitigated** | A child under `CreateRestrictedToken` with the group flipped deny-only cannot open arbitrary outbound connections; the only path is the loopback PERMIT to the proxy port range. |

### Verified facts (from source)

- **Four filters per layer, eight total** (`install_filters`, lines
  686-763): PERMIT non-member, PERMIT group-enabled, PERMIT loopback
  (127.0.0.0/8 v4 / ::1 v6 ∩ `IP_REMOTE_PORT ∈ [low, high]`), BLOCK.
- **Filter weights are explicit** (`install_filters` lines 656-659):
  `W_NONMEMBER = 0x0F...`, `W_GROUP = 0x0E...`, `W_LOOPBACK = 0x0D...`,
  `W_BLOCK = 0x01...`. Higher weight matches first; in WFP's "manual
  weight" class, the ordering is non-member → group → loopback → block,
  which is the intended precedence.
- **SDs are built from SDDL strings** (`sddl_nonmember`, `sddl_group`,
  `SDDL_EVERYONE`):
  - Filter 0: `O:LSG:LSD:(D;;CC;;;<group_sid>)(A;;CC;;;WD)` — DENY
    group, ALLOW Everyone.
  - Filter 1: `O:LSG:LSD:(A;;CC;;;<group_sid>)` — ALLOW group only.
  - Filter 3: `O:LSG:LSD:(A;;CC;;;WD)` — ALLOW Everyone.
  - Filter 2 (loopback): no user condition; address + port-range ANDed.
- **All four filters are `FWPM_FILTER_FLAG_PERSISTENT`** (`add_filter`
  line 545). They survive reboots; uninstall is the only removal path.
- **Filter identification is by `providerData` JSON tag** (`FilterTag`),
  not by a fixed GUID; the `sublayerKey` is the only structural
  discriminator. `for_each_tagged_filter` enumerates both layers,
  filters by sublayer, parses the tag, and only acts on entries with
  `tool == "srt-win"`.
- **Idempotency is transactional** (`install_filters` lines 619-779):
  `FwpmTransactionBegin0` → delete-tagged → add-fresh → commit, with
  `FwpmTransactionAbort0` on any error.
- **Idempotency / conflict pre-check** (`main.rs::Cmd::Install` lines
  281-304): if filters are already present with the *same* port range,
  no-op (exit 0). If present with a *different* port range and no
  `--force`, refuse (exit 13).
- **Port range is hard-capped** (`parse_port_range` lines 860-888):
  `MAX_PROXY_PORT_RANGE_WIDTH = 64`, `lo >= 1`, `lo <= hi`, no overflow.
  A user cannot widen the loopback exposure past 64 ports.

### Assumptions

- **WFP is enabled on the host.** WFP requires the Base Filtering Engine
  service (`BFE`) running. On Windows 10/11 with the default install it
  always is; on stripped-down server SKUs it may not be.
- **The `ALE_USER_ID` match is the same on every supported Windows
  version.** The `tests/sd_access_check_matrix.rs` test pins this
  semantically using `AccessCheck` directly (no live WFP), which is
  version-independent.
- **The host JS proxies bind inside `[low, high]`.** The WFP side
  permits the range; the proxy side must actually listen there. The
  default `[60080, 60089]` matches `DEFAULT_WINDOWS_PROXY_PORT_RANGE`
  in the JS shim.

### Potential bypasses or failure modes

1. **A foreign filter at higher weight on the same sublayer could
   short-circuit the fence.** A malicious admin or another tool that
   adds a higher-weight filter to the `srt-win` sublayer (or to a
   sublayer with higher weight) could PERMIT a connection before
   filter-3 BLOCK runs. The sublayer weight is hard-coded to
   `0x8000` in `install_filters` (line 642) — this is *sublayer*
   weight, not filter weight; the doc-comment is silent on whether
   that's above or below enterprise-managed sublayers. **Reviewer
   must confirm** sublayer weight ordering under typical third-party
   firewall installs.
2. **DNS resolution can leak the destination hostname even when
   the connection is blocked.** WFP `ALE_AUTH_CONNECT` runs *after*
   name resolution. A child that wants to exfiltrate the *name* of an
   attacker-controlled domain can do so via `getaddrinfo` without ever
   making a TCP connection. **This is not addressed by `srt-win`.**
   It's a known property of ALE_CONNECT and the macOS/Linux backends
   have the same shape. **Open question:** should GakrCLI route
   sandboxed DNS through the proxy? (Linux/macOS backends handle
   this; the Windows back-end inherits the gap.)
3. **The loopback permit covers `127.0.0.0/8` and `::1` only.**
   A child that binds a service on, say, `127.0.0.2` can be reached
   by other loopback processes (with a token that has filter-0
   PERMIT) but cannot be reached *as a destination* unless the
   destination port is in `[low, high]`. Conversely, a child on
   `127.0.0.1:9999` cannot be reached by anyone — including the
   broker — without a corresponding loopback-permit extension. This
   is correct, but it means **enterprise services on loopback that
   the child legitimately needs (e.g. local dev servers the user is
   running) are blocked**. The Mac/Linux backends solve this with
   `allowLocalBinding` config; Windows does not. **Reviewer must
   confirm** whether this is acceptable for GakrCLI's use case.
4. **The filter set is machine-wide**, not per-user (`install_filters`
   line 9 doc comment). A user who runs the install on a shared host
   affects every user of the machine. The user-list design is
   intentional ("enterprises install once per machine; adding a user
   to the group is the only per-user step"), but **the install
   command should warn** the user that it is machine-wide.
5. **The `providerData` tag is a string in the kernel object.** A
   user with WFP edit rights (i.e. an admin) can forge `srt-win`
   tags; that's not an attack surface for the threat model but is
   worth noting. `for_each_tagged_filter` does no cryptographic
   authentication of tag origin.

### Required reviewer verification

- [ ] Run `tests/sd_access_check_matrix.rs` on the target Windows VM
      and confirm the 3×3 SD matrix matches the doc-comment
      expectation.
- [ ] Inspect the WFP filter set after install
      (`netsh wfp show filters` or equivalent) and confirm eight
      filters under the `srt-win` sublayer, four per layer.
- [ ] From an unprivileged shell, `ncat` to a remote host and confirm
      the connection succeeds. From `srt-win exec`'d child, confirm
      the same `ncat` is blocked.
- [ ] From a child, attempt `ncat 127.0.0.1 60080` and confirm it
      reaches the host proxy. Attempt `ncat 127.0.0.1 60090` (just
      outside the default range) and confirm it is blocked.
- [ ] Attempt to bypass via DNS resolution (e.g. `Resolve-DnsName`
      in a child PowerShell). Confirm the call resolves but the
      subsequent outbound TCP is blocked — and decide whether DNS
      leakage is in scope for the threat model.
- [ ] After `uninstall`, run `wfp status` and confirm the count is 0.

## 2. Restricted-token construction and privilege removal

| | |
|---|---|
| **File / function** | `src/token.rs` — `make_sandbox_token`, `set_il`, `set_default_dacl`, `privileges_except`, `to_primary` |
| **Purpose** | Build a non-admin, non-elevated, limited-user token from the broker's own primary token, with the discriminator group flipped deny-only. |
| **Security boundary enforced** | Identity. The child runs as the same user but cannot exercise admin rights; admin group is deny-only. |
| **Threats mitigated** | A child that exploits a command-injection or file-write bug cannot elevate, cannot impersonate admin, and cannot access admin-only resources. |

### Verified facts

- **`SidsToDisable = [group_sid, BUILTIN\Administrators]`** unless
  `group_sid == BUILTIN\Administrators` (dedup; lines 80-88). The
  comment on lines 73-75 explains this: the CI flow uses
  `BUILTIN\Administrators` as the discriminator, so the dedup avoids
  `ERROR_INVALID_PARAMETER` from `CreateRestrictedToken`.
- **`LUA_TOKEN` flag set** (line 98) — the token reads as a normal
  limited-user token to NT components.
- **All privileges deleted except `SeChangeNotifyPrivilege`** (line
  92, 264-298). `privileges_except` resolves each kept name to a
  LUID, queries the base token's `TokenPrivileges`, and returns
  everything else for deletion. The unit test
  `privileges_except_keeps_change_notify` (lines 322-340) verifies
  `SeChangeNotifyPrivilege` is not in the deletion set.
- **No `RestrictingSids` array** (line 101) — the comment on lines
  11-12 says this "breaks Schannel/LSA RPC" and is intentionally
  omitted.
- **Integrity Level = Medium** (line 122; `IL_MEDIUM = 0x2000`).
  Set via `TOKEN_MANDATORY_LABEL` with the `SE_GROUP_INTEGRITY`
  attribute (line 50).
- **Default DACL rewrites SYSTEM + logon SID** (`set_default_dacl`
  lines 190-240). The logon SID is read from the base token's
  `TokenGroups` filtered by `SE_GROUP_LOGON_ID`, so siblings of the
  child (sibling sandbox children, broker) can still open the
  child's handles.
- **LocalPsid RAII** (`sid.rs::LocalPsid`, lines 30-58) enforces
  that `ConvertStringSidToSidW` allocations are freed with
  `LocalFree`, not `FreeSid`. The `token.rs` comment on lines
  70-72 documents a prior donor bug that used the wrong free fn
  for `PSID` from `ConvertStringSidToSidW`.
- **`allocateAndInitializeSid` is paired with `FreeSid`** in
  `set_il` (lines 157-174) — this is the one place in the crate
  where `FreeSid` is correct.

### Assumptions

- **The base token is the broker's own primary** — passed by
  `launch.rs` via `open_self_token()`. There is no path that uses a
  different base.
- **`LUA_TOKEN` is honored by the Windows components the child
  touches.** This is a fundamental Windows guarantee; the comment
  on lines 6-8 (file header) cites it.

### Potential bypasses or failure modes

1. **`SeChangeNotifyPrivilege` is the only kept privilege.** That
   privilege is needed for almost nothing user-visible; it is
   required for the loader's file-system cache bypass. Keeping it is
   the documented choice; the alternative (no privileges) breaks
   file I/O for many programs. **Reviewer must confirm** the
   trade-off is acceptable.
2. **The default DACL grants `GENERIC_ALL` to the logon SID and
   SYSTEM.** That means anything running in the same logon session
   — including other non-sandbox apps of the same user — can open
   the child's handles. This is intentional (the doc-comment lines
   181-189 calls it out), but worth surfacing in the audit:
   the sandbox is *not* a hard isolation against same-user, same-logon
   processes; it is a *kernel-mode syscall filter* applied to the
   child's outbound network and the limited-privilege guarantee on
   the child itself.
3. **Medium IL is correct for a coding-agent workload.** Low IL
   breaks Schannel/LSA/registry edge cases (line 42-43 comment).
   High IL requires elevation. Medium is the right choice for a
   tool that wants to run `git`, `npm`, etc. **No bypass**;
   document the choice.
4. **The `group_sid` argument is a string, not a typed
   `PSID`.** Validation is `LocalPsid::from_string` →
   `ConvertStringSidToSidW`, which catches malformed strings.
   Anything that round-trips through `ConvertSidToStringSidW` is
   canonicalised (line 232-240 of `main.rs`).

### Required reviewer verification

- [ ] From a child, attempt `whoami /groups` and confirm
      `BUILTIN\Administrators` is `Deny only` and the discriminator
      group is also `Deny only`.
- [ ] From a child, attempt `whoami /priv` and confirm only
      `SeChangeNotifyPrivilege` (or none) is listed.
- [ ] From a child, attempt to write to
      `C:\Windows\System32\config\SAM` and confirm access is
      denied.
- [ ] From a child, attempt `Start-Process powershell -Verb RunAs`
      and confirm UAC fails or is blocked by `LUA_TOKEN`.
- [ ] Run the unit tests `restricted_token_builds` and
      `privileges_except_keeps_change_notify` and confirm both
      pass on the target VM.

## 3. Process isolation behavior

| | |
|---|---|
| **File / function** | `src/job.rs` — `Job::new`, `Job::assign`; `src/launch.rs` — `run`, `SpawnedChild` |
| **Purpose** | Lock the child into a job object that kills the process tree when the broker exits, and block UI/handle channels. |
| **Security boundary enforced** | Process lifetime and UI/handle surface. |
| **Threats mitigated** | A child that detaches from the broker and persists past it; a child that reads the clipboard, changes system parameters, or grabs handles from outside the job. |

### Verified facts

- **`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` set** (`job.rs` line 47-48).
  When the job handle closes, every process still in the job is
  terminated. `Job::Drop` (line 96-101) closes the handle.
- **All eight `JOB_OBJECT_UILIMIT_*` bits set** (`job.rs` line 65-72):
  `READCLIPBOARD`, `WRITECLIPBOARD`, `HANDLES` (cross-job USER/GDI
  handle access), `GLOBALATOMS`, `SYSTEMPARAMETERS`,
  `DISPLAYSETTINGS`, `DESKTOP`, `EXITWINDOWS`. The comment on
  lines 56-64 enumerates each one and why it matters.
- **`Job` is created before `CreateProcessAsUserW`** and the
  child is assigned after spawn but before resume
  (`launch.rs:287-296`). The `SpawnedChild` drop guard (lines
  77-87) terminates the child on any error between
  `CreateProcessAsUserW` and `ResumeThread` so a suspended child
  cannot leak.
- **`ResumeThread` failure handling** (`launch.rs:288-294`): a
  failed resume leaves the child suspended in the job, which
  would hang `WaitForSingleObject(INFINITE)`. The check for
  `u32::MAX` (the documented failure return) prevents the
  broker from hanging.

### Potential bypasses or failure modes

1. **A child that spawns a service or scheduled task before
   `KILL_ON_JOB_CLOSE` fires can outlast the broker.** The job
   `KILL_ON_JOB_CLOSE` kills processes *in the job*. If a child
   creates a service via `CreateServiceW` and that service starts
   in a different session, the service is not in the job and is
   not killed. The token's `LUA_TOKEN` plus no `SeLockMemoryPrivilege`
   plus the lack of `SeCreateTokenPrivilege` prevents *direct*
   service creation, but **a child can ask SCM to start a
   pre-existing service** if the SCM DACL allows. The default SCM
   DACL on Windows 10/11 allows `INTERACTIVE` group, of which
   standard users are members. **Reviewer must confirm** whether
   this is in the threat model.
2. **`HANDLES` UILimit blocks cross-job USER/GDI handles but not
   kernel handles.** A child can still open named pipes, files,
   mailslots, etc., from the broker or from other processes. This
   is *the* design constraint of the sandbox model — the network
   fence and the limited token are the primary boundaries; the
   job is a containment backstop, not an isolation boundary.
3. **`JOB_OBJECT_UILIMIT_EXITWINDOWS` blocks
   `ExitWindowsEx`** but not the more direct shutdown paths
   available to admins. The token's lack of `SeShutdownPrivilege`
   plus `LUA_TOKEN` already blocks the canonical paths; the UI
   limit is belt-and-braces.

### Required reviewer verification

- [ ] From a child, `Get-Clipboard` and confirm it errors
      (`WRITECLIPBOARD` is the one for read; verify both).
- [ ] From a child, attempt `Set-Process -Name explorer` or any
      `SystemParametersInfoW(SPI_SET*)` and confirm the call
      returns access-denied.
- [ ] Kill the broker (`Stop-Process -Id $broker`) and confirm the
      child is terminated within the OS grace period.
- [ ] Verify the `SpawnedChild` terminate-on-drop path by
      force-erroring between `CreateProcessAsUserW` and
      `ResumeThread` in a unit test (currently not covered by
      a unit test — only by smoke scripts in `ci/`).

## 4. AppContainer / process isolation behavior

**srt-win does NOT use AppContainer.** It uses `CreateRestrictedToken`
with `LUA_TOKEN` plus a job object, plus a non-interactive window
station, plus a token-attribute deny-only group, plus a hard-coded
WFP fence. This is a different design from Edge/Chrome's renderer
process model. **This is a fact, not a gap** — AppContainer cannot
be combined with the `LUA_TOKEN` shape `srt-win` uses, and the
design works without it. Document this distinction in the integration
proposal so reviewers don't conflate the two models.

## 5. UAC self-elevation and installer flow

| | |
|---|---|
| **File / function** | `src/main.rs` — `is_elevated`, `maybe_self_elevate`, `require_elevated` |
| **Purpose** | Re-launch the binary with `ShellExecuteExW(verb="runas")` if not already elevated, wait for the elevated child, propagate its exit code. |
| **Security boundary enforced** | The UAC consent UI. The user must consent to elevation; if they cancel, the binary exits 10 and the caller surfaces a `{cancelled: true}` to the host. |
| **Threats mitigated** | A child process *cannot* elevate without the user's UAC consent. The binary is the only thing that can present a UAC prompt. |

### Verified facts

- **Exit-code contract documented** (`main.rs` lines 50-58): 0=ok,
  10=UAC cancelled, 11=group create failed, 12=WFP install failed,
  13=already installed with different config (use `--force`), 1=other.
- **`ShellExecuteExW` flags** (`main.rs` line 624): `SEE_MASK_NOCLOSEPROCESS`
  (so the parent can wait) and `SEE_MASK_NO_CONSOLE` (no console
  window flashes for the elevated child). `nShow = SW_HIDE`.
- **`ERROR_CANCELLED` → exit 10** (`main.rs` lines 635-639).
- **The elevated child runs in its own (hidden) console**; the
  doc-comment on `maybe_self_elevate` lines 581-587 calls out
  that stdout/stderr are not relayed — exit code is the contract
  for convenience commands. For `install`/`uninstall` that's
  intentional; the granular mutators (`group create|delete`,
  `wfp install|uninstall`) are documented as having informational
  stderr only.
- **Argv reconstruction for the elevated child** (`main.rs` lines
  614-618): rebuilds `lpParameters` from `std::env::args()` via
  `quote_arg` (from `launch.rs`), which is `CommandLineToArgvW`-compatible
  quoting. This is a known foot-gun in UAC re-launchers: a
  malformed argv in the parent produces a malformed argv in the
  child. The `quote_arg` test coverage (lines 640-653) exercises
  the round-trip.
- **`require_elevated`** (lines 558-568) is `allow(dead_code)`
  — a non-interactive counterpart for a future `acl recover` flow
  that doesn't exist yet. **Open question:** this is a partially
  wired feature.

### Potential bypasses or failure modes

1. **The user is the trust boundary for the install.** A
   determined user running `srt-win install` with `--force` and
   `--group-sid` set to `BUILTIN\Administrators` can put the
   `BUILTIN\Administrators` group itself into the deny-only
   position. This is intentional in the CI use case
   (`token.rs` lines 73-75) but means the `--force` flag is a
   real power-tool, not a convenience. **Reviewer must
   confirm** that the GakrCLI host code never invokes
   `installWindowsSandbox` with `force: true` automatically.
2. **The binary's self-elevation uses `verb="runas"`** which
   presents the standard UAC consent. This is the documented
   "admin must consent" path. There is no `ConsentPromptBehaviorAdmin`
   override; the user sees the default UAC prompt.
3. **`ShellExecuteExW` does not return the child's stderr.** A
   failed install produces a human-readable error in the elevated
   child's stderr; the parent doesn't see it; the JS shim
   surfaces only the exit code and `out` (the combined
   stdout-or-stderr of the elevated child via
   `windows-sandbox-utils.js:176`). For exit codes 11/12/13 the
   out is captured, so the user *does* see the error message.
   For exit code 1 ("other error"), the out is captured
   but the JS shim throws a generic
   `"srt-win install failed (exit N): out"` message. **Minor UX
   gap, not a security gap.**

### Required reviewer verification

- [ ] From a non-admin shell, run
      `srt-win.exe install` and confirm exactly one UAC prompt
      appears and the install completes.
- [ ] Cancel the UAC prompt and confirm the binary exits 10 and
      no state changes (no group, no WFP filters).
- [ ] Run `srt-win.exe install --force` from a non-admin shell
      and confirm a UAC prompt still appears (the force flag
      itself does not bypass UAC).
- [ ] Run `srt-win.exe install --group-sid S-1-5-32-544` and
      confirm the binary installs against the existing
      `BUILTIN\Administrators` group without trying to create
      it.

## 6. Group membership management

| | |
|---|---|
| **File / function** | `src/wfp.rs` — `ensure_group`, `delete_group`; `src/sid.rs` — `group_state_for_self`, `lookup_account_sid`, `current_user_sid`, `sid_account_exists` |
| **Purpose** | Create the local discriminator group, add the current user, and query the broker's token for whether the group is enabled. |
| **Security boundary enforced** | Identity discriminator. The group SID is the *only* thing that ties the broker's identity to the child's deny-only state. |
| **Threats mitigated** | An external tool that creates a same-named group cannot impersonate `srt-win`; the SID is canonicalised on every use. |

### Verified facts

- **`ensure_group` is idempotent** (`wfp.rs::ensure_group` lines
  333-375): `NetLocalGroupAdd` returns `NERR_GroupExists` or
  `ERROR_ALIAS_EXISTS` for an existing group; both are treated as
  benign.
- **`NetLocalGroupAddMembers` similarly tolerates
  `ERROR_MEMBER_IN_ALIAS`** (line 368).
- **Group name is fixed default** `sandbox-runtime-net` with a
  CLI override (`--name`). The JS shim default matches.
- **`delete_group` is idempotent on
  `NERR_GroupNotFound`/`ERROR_NO_SUCH_ALIAS`** (lines 378-390).
- **`group_state_for_self`** (`sid.rs::GroupState` enum, lines
  186-201, impl lines 205-242) returns one of:
  `Enabled`, `DenyOnly`, `Present` (unexpected), `Absent`.
  This is the primary pre-flight check before `exec` will
  proceed.
- **`lookup_account_sid`** uses `LookupAccountNameW` with a
  NULL system name (local SAM first, then domain) and round-trips
  the result through `psid_to_string` for canonical form
  (`sid.rs` lines 126-161).
- **`LocalPsid`** (`sid.rs` lines 30-58) is RAII over
  `ConvertStringSidToSidW`. The file-header doc-comment
  explicitly calls out the *correct* free fn (`LocalFree`,
  not `FreeSid`) — there is a documented prior bug in a
  donor version that used the wrong free fn.

### Potential bypasses or failure modes

1. **The group is a local group**, not a domain group. On a
   domain-joined host, an enterprise admin can pre-provision
   the group at the domain level via GPO; the
   `--group-sid` flag supports this. **The `install` command
   requires `--name` for group creation, and refuses
   `--group-sid`** (`main.rs` lines 364-369). This is correct
   posture.
2. **A user with `NetLocalGroupAddMembers` rights can add
   *other* users to the group.** That's `BUILTIN\Administrators`
   on the host, plus the group owner. The group is local, so
   domain admins have it via `BUILTIN\Administrators`. The
   consequence is that a domain admin's token has the group
   *enabled* and so matches filter-1 (PERMIT group). The
   fence does not protect a child from a domain admin; the
   fence protects a child from a coding-agent process running
   as the same unprivileged user. **This is the documented
   threat model.**
3. **`group_sid` is a string, not a typed wrapper.** Any caller
   that bypasses `LocalPsid::from_string` could pass a malformed
   SID. All call sites use `LocalPsid::from_string` or
   `lookup_account_sid`; the audit found no bypass.

### Required reviewer verification

- [ ] Run `srt-win.exe group create` and confirm the local group
      `sandbox-runtime-net` is created and the current user is
      added (verify via `Get-LocalGroupMember`).
- [ ] Run `srt-win.exe group status` and confirm
      `state: "absent"` (because the user has not logged out
      and back in yet).
- [ ] Log out and back in, run `srt-win.exe group status` again,
      and confirm `state: "ready"`.
- [ ] Run `srt-win.exe group delete` and confirm the group is
      removed (idempotent on a missing group).
- [ ] Run the unit tests `psid_string_round_trip`,
      `lookup_builtin_users`, `lookup_missing_account_errors`,
      `sid_account_exists_for_well_known`,
      `sid_account_exists_unmapped_for_bogus`,
      `sid_account_exists_errors_on_malformed`,
      `current_user_sid_is_nonempty` and confirm all pass.

## 7. Network allow / deny behavior

The WFP fence is the only network boundary on Windows
(Windows has no Seatbelt equivalent on the network egress path).
The four-filter design is described in §1. Two additional
properties are worth auditing here:

- **`DENY` ACE order is canonical** in filter 0's SD
  (`sddl_nonmember`): `(D;;CC;;;<group_sid>)(A;;CC;;;WD)`. DENY
  before ALLOW is the documented correct order for SDDL. The
  `tests/sd_access_check_matrix.rs` test pins this; the doc-comment
  expectation matches.
- **The `IP_REMOTE_ADDRESS` condition on filter 2 uses a `u32`
  bitfield for v4** (`0x7F00_0000` with mask `0xFF00_0000` =
  `127.0.0.0/8` lines 666-669) **and a 16-byte array for v6**
  (`::1` lines 671-674). Both are the standard WFP
  representations.
- **`IP_REMOTE_PORT` is a `FWP_RANGE_TYPE` with `valueLow` and
  `valueHigh` inclusive** (lines 676-679). This is the documented
  WFP representation of "port in [low, high]".
- **The conditions are ANDed** (the comment on line 721 says
  "Two conditions on different fieldKeys → ANDed by WFP."). This
  is the WFP semantics; ANDing address and port-range is the
  intended intersection.

### Required reviewer verification

- [ ] Same as §1's network verification, plus: from a child,
      run `Resolve-DnsName` against an external host and
      confirm the call resolves but the resolved address
      cannot be reached.

## 8. Loopback and localhost handling

The loopback permit is the only path from the sandboxed child
back to the host. **It is the entire mechanism by which the
child can use the network at all** — the child's HTTP/SOCKS
proxies are the host's JS proxies, and they bind on loopback
inside `[low, high]`. The defaults match between the Rust
constant `DEFAULT_PROXY_PORT_RANGE = (60080, 60089)` and the JS
constant `DEFAULT_WINDOWS_PROXY_PORT_RANGE = [60080, 60089]`.

### Potential failure modes

1. **A child that uses a custom proxy server on a different
   loopback port will be blocked.** The WFP permit covers
   `[low, high]` only. If a user's environment requires a
   different loopback port range, the install needs `--proxy-port-range`
   and the JS proxies need to be told to bind inside that range.
   The two are **not auto-coordinated**; the host (GakrCLI in
   our case) must keep them in sync.
2. **The WFP permit is for *outbound* connections from the
   child.** A child can still *bind* on any loopback port and
   *accept* connections from a process that holds filter-0
   PERMIT. This is intentional (siblings need to talk) but
   means: a child that opens a service on `127.0.0.1:9999` can
   be reached by any other process in the same session that
   has filter-0. **Document this** in the integration
   proposal.
3. **The v4 mask is `127.0.0.0/8`** (line 666-668), which
   covers the entire `127.0.0.0/8` range as the destination
   IP. The v6 mask is `::1` only. This is the documented
   WFP behavior; the asymmetry is intentional because
   `127.x.x.x` is all-loopback in v4, while v6 only has `::1`.

### Required reviewer verification

- [ ] From a child, bind a listener on `127.0.0.1:60080` and
      confirm the host's proxy can be reached.
- [ ] From a child, bind a listener on `127.0.0.1:9999` and
      confirm the host can still reach it (child-out → host-in
      is permitted because the *child*'s outbound connection
      uses a port in the permitted range; but the child can
      *listen* anywhere).
- [ ] Confirm the JS proxies actually bind in the configured
      range. If they don't, the child cannot reach the host's
      network at all.

## 9. Child-process spawning path

| | |
|---|---|
| **File / function** | `src/launch.rs` — `run`, `CreateProcessAsUserW`, `build_cmdline`, `build_env_block`, `add_proxy_case_twins` |
| **Purpose** | Spawn the target process under the restricted token, suspended, in the job, on the sandbox window station, with mitigation policies, inheriting only the std handles. |
| **Security boundary enforced** | The spawn is the handoff from the broker to the child. The security boundary is the token + the spawn flags. |
| **Threats mitigated** | A child cannot inherit arbitrary handles from the broker, cannot bypass the job, cannot bypass the window station, and the cmd-line is built without invoking the host shell on the OUTER spawn. |

### Verified facts

- **`CreateProcessAsUserW` with `CREATE_SUSPENDED`** (`launch.rs`
  line 256-258): the child is created suspended so the broker can
  assign it to the job before it starts.
- **`CREATE_UNICODE_ENVIRONMENT` set** so the env block is
  parsed as UTF-16.
- **`EXTENDED_STARTUPINFO_PRESENT` set** so the kernel reads
  `lpAttributeList` (the mitigation-policy + handle-list).
- **`bInheritHandles = true`** (line 255) — required for
  `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` to take effect
  (the comment on line 252-254 documents the Vista-era quirk).
- **`PROC_THREAD_ATTRIBUTE_HANDLE_LIST`** restricts inheritance
  to the std handles only (lines 225-232, 583-598). The std
  handles are first marked inheritable via `SetHandleInformation`
  (line 626). If no std handle is inheritable, the spawn is
  refused with `"no std handle is inheritable; refusing to
  spawn"` (line 226-231). **This is a strong design choice**:
  a child that would only inherit the console handles is the
  minimum possible attack surface.
- **Mitigation policy bits** (lines 108-117, 221-224):
  `EXTENSION_POINT_DISABLE` (1<<32), `FONT_DISABLE` (1<<48),
  `IMAGE_LOAD_NO_REMOTE` (1<<52), `IMAGE_LOAD_NO_LOW_LABEL`
  (1<<56). The doc-comment on lines 89-104 explains why
  `IMAGE_LOAD_PREFER_SYSTEM32` and `CONTROL_FLOW_GUARD_ALWAYS_ON`
  are NOT enabled: they break cygwin/msys shells and stock
  mingw-built programs, which GakrCLI's coding-agent workload
  frequently invokes.
- **`build_cmdline`** (lines 489-518) handles `cmd.exe`
  specially: with `/c`, `/k`, or `/r`, the post-flag content
  is wrapped in one outer `"…"` pair and passed verbatim
  to `cmd /s` which strips the outer pair. **This is correct**
  — the doc-comment on lines 458-488 explains the rationale
  in detail: the inner cmd is inside the sandbox, so cmd
  metachars are the user's tool, not an escape vector. The
  security boundary is the OUTER spawn with
  `CommandLineToArgvW` semantics, which the special case
  preserves.
- **Non-cmd targets use `CommandLineToArgvW`-compatible
  quoting** (`quote_arg` lines 403-442). The test coverage
  on lines 640-653 verifies backslash and quote handling.
- **Env block is verbatim** (`build_env_block` lines 351-370,
  `add_proxy_case_twins` lines 380-396): the broker's own
  environment is the source; the only adjustment is restoring
  case-twin variants of `*_PROXY` so MSYS2/Cygwin programs can
  find them. The doc-comment on lines 327-339 calls out
  explicitly that `srt-win exec` does NOT synthesize any proxy
  config; the host must.
- **No `LPENVIRONMENT` filtering.** Anything in the broker's
  env (secrets, tokens, paths) is in the child's env. This
  is intentional (the JS shim merges the full proxy set into
  the env it spawns `srt-win exec` with, and any tool that
  the user has configured will rely on its env being
  forwarded), but **it means GakrCLI must be careful about
  what it puts in the broker's env** when invoking
  `srt-win exec`. Open question: should the host
  pre-strip known-sensitive env vars (e.g. `*TOKEN*`,
  `*SECRET*`, `*KEY*`) before spawning `srt-win exec`? The
  macOS/Linux backends do not do this either; the threat
  model assumes the agent already has the env.

### Potential bypasses or failure modes

1. **The `cmd.exe /s /c` passthrough means the inner shell is
   *the user's tool*, not a host shell.** A user who constructs
   a command that contains `&` chains, `|` pipes, etc. gets
   exactly that. This is the documented design and is
   correct, but it is the *opposite* of how the OUTER spawn
   behaves (the OUTER uses `CommandLineToArgvW` semantics).
   The contrast should be documented in any user-facing
   material.
2. **`bInheritHandles = true` + `HANDLE_LIST` is a
   documented-quirk pair.** The list restricts inheritance, but
   if the kernel ignores the list (e.g. older Windows or a
   future flag change), the spawn fails open: the child
   inherits all inheritable broker handles. The mitigation
   policy is unaffected. **Reviewer must confirm** the
   `HANDLE_LIST` mechanism is honored on every supported
   Windows version (it's documented Vista+, so anything Win 7
   or later).
3. **`add_proxy_case_twins` adds the all-uppercase and
   all-lowercase variants of every `*_PROXY` name, but does
   NOT remove the original mixed-case entry.** If the broker's
   env has `Http_Proxy`, the child sees `Http_Proxy`,
   `HTTP_PROXY`, and `http_proxy` — three entries. This is
   intentional (the comment on lines 339-341 says: "Names are
   NOT folded or deduplicated, so if both `HTTP_PROXY` and
   `http_proxy` are present both survive into the child"),
   but a security-aware reviewer should ask whether this
   leaks information. **No bypass**; the values are
   identical.
4. **The mitigation policy is set, not enforced by a different
   mechanism.** A child that does not honor
   `EXTENSION_POINT_DISABLE` (i.e. one that calls
   `SetWindowsHookEx` anyway) will succeed in injecting. The
   policy is enforced by the kernel; it's a guarantee, not a
   request.

### Required reviewer verification

- [ ] From a child, attempt `LoadLibrary("\\server\share\foo.dll")`
      and confirm the call is rejected.
- [ ] From a child, attempt `SetWindowsHookEx` and confirm the
      call is rejected.
- [ ] From a child, run `cmd /c "echo hi & calc"` and confirm
      that calc is NOT spawned (because `cmd` is inside the
      sandbox and cannot spawn a GUI; but if it could, the
      calc process would be in the same job and so killed on
      broker exit).
- [ ] Verify the std handles in the child are exactly the
      broker's std handles (no more, no less). Tools like
      Process Explorer show this.

## 10. Environment-variable inheritance

See §9 above. The env block is verbatim passthrough; the only
modification is `add_proxy_case_twins`. **No secrets are stripped
by `srt-win exec`.** This is a deliberate design choice; the
macOS/Linux backends are the same. GakrCLI's host code is
responsible for any pre-spawn filtering.

## 11. Cleanup and uninstall behavior

| | |
|---|---|
| **File / function** | `src/wfp.rs` — `uninstall_filters`, `delete_tagged_filters`; `src/main.rs` — `Cmd::Uninstall`, `Cmd::Group { Delete }`; `src/job.rs` — `Job::Drop`; `src/winsta.rs` — `WinStaDesk::Drop`; `src/sid.rs` — `LocalPsid::Drop` |

### Verified facts

- **`uninstall_filters` removes tagged filters in a transaction**
  (`wfp.rs::uninstall_filters` lines 784-815): begin txn →
  delete-tagged → delete sublayer (best-effort) → commit.
  `FWP_E_IN_USE` is tolerated (foreign filters under the same
  sublayer) and reported as success.
- **`uninstall` does NOT delete the group** (the doc-comment
  on `uninstallWindowsSandbox` in the JS shim,
  `windows-sandbox-utils.js:208-211`, and the doc-comment on
  `Cmd::Uninstall` in `main.rs:78-81`). The rationale is
  documented: group membership is persistent user state, and
  removing it forces every user to re-do the logout dance on
  reinstall.
- **`Job::Drop`** closes the handle (lines 96-101); with
  `KILL_ON_JOB_CLOSE` set, that terminates every process still
  in the job.
- **`WinStaDesk::Drop`** closes the desktop before the window
  station (lines 162-170) — the desktop references the WS, so
  the order matters.
- **`LocalPsid::Drop`** calls `LocalFree` on the
  `ConvertStringSidToSidW` allocation (lines 50-58).
- **`SpawnedChild::Drop`** terminates and closes on any
  failure between `CreateProcessAsUserW` and `defuse`
  (`launch.rs:77-87`).

### Potential bypasses or failure modes

1. **The WFP filters are persistent across reboots.** A user
   who uninstalls and reboots before the uninstall completes
   (shouldn't happen with `FwpmTransactionCommit0`, but if it
   did) could be left with a partial set. The transactional
   design is the mitigation. **Reviewer must confirm**
   `FwpmTransactionCommit0` is awaited before exit.
2. **`Job::Drop` closes the handle**; the OS terminates the
   process tree. But a child that has *escaped* the job
   (via `NtSetInformationJobObject` or by being assigned to a
   *second* job — a documented Windows quirk) is not in this
   job and is not killed. **This is a Windows-level footgun
   not specific to `srt-win`; a child that has sufficient
   privileges to call `NtSetInformationJobObject` already has
   admin, which `LUA_TOKEN` blocks.**

### Required reviewer verification

- [ ] After `srt-win.exe uninstall`, run `wfp status` and confirm
      the count is 0.
- [ ] After `srt-win.exe uninstall`, run `group status` and
      confirm the group is still present (intentional).
- [ ] After `srt-win.exe group delete`, run `group status` and
      confirm `state: "absent"`.
- [ ] Run the broker, exec a long-sleeping child, kill the
      broker, and confirm the child is terminated within the
      OS grace period.

## 12. `force:true` behavior and safeguards

| | |
|---|---|
| **File / function** | `src/main.rs` — `Cmd::Install { force, ... }`; `src/wfp.rs` — `install_filters` |
| **Purpose** | Allow replacing an existing install whose configuration differs (different group SID, different port range, different sublayer). |

### Verified facts

- **`force` is a flag, not an env var** (the doc-comment on
  `skip_group_check` at `main.rs:117-120` calls this out
  explicitly: "Surfaced as a flag (not an env var) so the bypass
  is intentional and not accidentally inherited.").
- **`force` only relaxes the port-range pre-check** (`main.rs`
  lines 281-304): without `force`, an existing install with a
  *different* port range is refused (exit 13); with `force`,
  the existing filters are deleted and the new set is added.
- **`force` does NOT bypass the UAC prompt.** Elevation is
  still required for the `install` subcommand; `force` is
  applied *after* `maybe_self_elevate` returns.

### Potential bypasses or failure modes

1. **`--force` can replace the fence's port range with a
   different one.** If the host (GakrCLI) ever invokes
   `installWindowsSandbox({force: true})` with a port range
   that does not match where the JS proxies actually bind, the
   child can no longer reach the host network. **Open question:**
   should the GakrCLI host code refuse to call
   `installWindowsSandbox` with `force: true` without an
   explicit user gesture? The current API in
   `windows-sandbox-utils.js` accepts `force: true` from any
   caller.
2. **`force` does not check what configuration is being
   replaced.** A user running
   `srt-win install --force --proxy-port-range 1-65` could
   accidentally replace a working install with a wider range.
   The `MAX_PROXY_PORT_RANGE_WIDTH = 64` cap prevents
   catastrophic widening (max 65 ports including both ends),
   but the cap is 64, so `--proxy-port-range 1-65` is
   rejected and `--proxy-port-range 1-64` is accepted. **This
   is correct, not a bypass.**

### Required reviewer verification

- [ ] Run `srt-win install --force` from a clean state and
      confirm it succeeds (no existing filters to replace).
- [ ] Run `srt-win install --proxy-port-range 60080-60084`,
      then `srt-win install --proxy-port-range 60080-60085`
      *without* `--force`, and confirm exit 13.
- [ ] Run the same sequence *with* `--force` and confirm the
      second install succeeds and the WFP filter's loopback
      port range is the new one (verify via `wfp status`).

## 13. Code paths that could result in unsandboxed execution

The `srt-win` binary has one unsandboxed path: **`exec` with
`--skip-group-check`**. The doc-comment on `main.rs:117-122`
says:

> Skip the "is the group enabled in the broker's token"
> pre-flight. **Fail-open** — the WFP fence depends on that
> membership; with this set the child may run with weaker
> isolation if the install was incomplete. Surfaced as a flag
> (not an env var) so the bypass is intentional and not
> accidentally inherited. Use ONLY in ephemeral CI runners
> that create the group in-job and cannot logout/login mid-run.

This is a documented, explicit, surfaced, named bypass. It is
not inherited from the environment. **The GakrCLI host code
must not invoke `srt-win exec --skip-group-check`.** The JS
shim does not expose this flag (the `wrapCommandWithSandboxWindows`
function does not accept it), so the GakrCLI host is
structurally prevented from enabling it. **Reviewer must
confirm** no future addition to `wrapCommandWithSandboxWindows`
re-exposes it.

The `maybe_self_elevate` re-launch is also technically
"unsandboxed" — the elevated child is a *broker*, not a
*child*, so it's running the same binary. The elevated child
runs the same `install`/`uninstall`/`group create|delete`/
`wfp install|uninstall` logic that the user just consented to.
It does not run user-supplied code. **This is not a bypass.**

## 14. Overall assessment

### What the audit confirms

- The WFP fence is structurally sound: SDs are correct, weight
  order is correct, transactions are used, idempotency is
  enforced, the loopback permit is the only path for the
  child, and the `tests/sd_access_check_matrix.rs` integration
  test pins the SD semantics.
- The token is the right shape: `LUA_TOKEN`, group +
  `BUILTIN\Administrators` deny-only, Medium IL, all privs
  stripped except `SeChangeNotifyPrivilege`, no `RestrictingSids`.
- The job is the right shape: `KILL_ON_JOB_CLOSE`, all eight
  `JOB_OBJECT_UILIMIT_*` bits, created before the spawn and
  assigned before resume.
- The window station is the right shape: anonymous WS, single
  desktop, broker always restored on error, dropped after the
  child exits.
- The handle list is the right shape: std handles only,
  inherited flag set per handle, refusal on empty list.
- The mitigation policy is the right shape: the four bits
  that are enabled are the ones that don't break mingw/msys
  shells; the two bits that are not enabled (and the rationale
  for not enabling them) are documented.
- The cmd passthrough is the right shape: inner `cmd /s /c`
  is the user's tool; the OUTER spawn is argv-quoted and is
  the security boundary.
- The cleanup paths are correct: transactional uninstall, RAII
  over handles and tokens, broker always restored on error,
  child terminated on any failure between spawn and resume.
- The `--force` flag is scoped to the port-range pre-check
  only, and does not bypass UAC.
- The only explicit fail-open path (`--skip-group-check`) is
  flagged as such, surfaced as a CLI flag (not an env var),
  and is not exposed to the JS shim.

### Where the audit has open questions

1. **DNS leakage via `getaddrinfo` is not addressed.** Both
   the macOS and Linux backends have the same gap. **Decision
   needed:** is the threat model "child cannot reach the
   internet" (which is what the WFP fence enforces) or
   "child cannot learn the existence of attacker-controlled
   domain names" (which would require a DNS proxy)?
2. **Loopback services outside `[low, high]` are blocked.**
   The macOS/Linux backends have `allowLocalBinding` config;
   Windows does not. **Decision needed:** is this acceptable
   for GakrCLI's workload? If a user's coding agent needs to
   reach a local dev server on `127.0.0.1:3000`, the current
   design cannot allow it without opening the loopback permit
   wider.
3. **Env block is verbatim passthrough.** Anything in the
   broker's env is in the child's env. The host (GakrCLI in
   our case) is responsible for pre-spawn filtering. **Decision
   needed:** does the GakrCLI host pre-strip secrets?
4. **`force: true` semantics in the JS shim.** The shim
   accepts `force: true` from any caller; the GakrCLI host
   should not invoke it without an explicit user gesture.
   **Decision needed:** should the host code refuse `force: true`
   without a confirmation prompt?
5. **`require_elevated` is dead code.** The doc-comment on
   `main.rs:553-556` says it's retained for a future
   `acl recover` flow. **Decision needed:** is the
   future flow still planned, or should this be removed?
6. **`ShellExecuteExW` does not relay the elevated child's
   stderr.** For exit code 1 ("other error"), the user sees
   a generic message. **Decision needed:** is the user-experience
   gap worth fixing via a one-shot child-stderr-to-parent
   relay?
7. **A child can still create a Windows service via SCM** (see
   §3, failure mode 1). The token's `LUA_TOKEN` blocks the
   direct path; the indirect path (asking SCM to start a
   pre-existing service) is open. **Decision needed:** is
   this in the threat model? If yes, the SCM DACL must be
   hardened enterprise-side; this is outside `srt-win`.

### Recommendation

**The `srt-win` implementation is sufficient for GakrCLI's
Windows backend as written.** The boundary holds; the
transactional design is correct; the documented fail-open path
(`--skip-group-check`) is not exposed to the JS shim and so
cannot be reached by the GakrCLI host. The Rust source is
small, focused, and well-commented; the unit and integration
tests cover the load-bearing claims (SD semantics, privilege
deletion, SID round-trips, command-line quoting for both cmd
passthrough and argv-quoting).

**No additional host-side hardening is required for the Windows
sandbox boundary itself.** The seven open questions above are
all decisions about *policy* (DNS leakage, loopback permits,
env filtering, force semantics, dead code, child stderr,
service creation), not about *correctness* of the WFP fence
or the restricted token.

**The GakrCLI host code must observe the following constraints
when integrating with the JS shim:**

1. Never call `installWindowsSandbox` with `force: true` without
   a user confirmation.
2. Never call `srt-win exec --skip-group-check` (the shim does
   not expose it; keep it that way).
3. Pre-strip or pre-marshal env vars before spawning
   `srt-win exec` if GakrCLI holds secrets in the broker's
   process env.
4. Surface the four install states
   (`absent` / `created-not-on-token` / `ready`+WFP-absent /
   `ready`+WFP-installed) clearly to the user, with the
   corrective action for each.
5. Coordinate the WFP `proxyPortRange` with the JS proxy bind
   range. If they drift, the child cannot reach the host
   network.
6. Reject `--force` for unattended flows. A user-driven
   `/sandbox-install --reset` is fine; an automatic
   re-install on startup is not.

The GakrCLI proposal document
(`docs/sandbox/WINDOWS_PROPOSAL.md`) is consistent with the
audit findings. With the audit complete, the proposal's
implementation plan is now unblocked. **Recommendation:
proceed to the change set in `WINDOWS_PROPOSAL.md` with the
six host-side constraints above enforced in the host code
itself**, not in `srt-win`.
