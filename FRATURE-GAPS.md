# FRATURE-GAPS.md

Live-verification gaps in the GakrCLI computer-use MCP observed during the
2026-09-29 sessions (commits `8719a65` → `ca28449`).

Each gap is a behavior the model reasonably expected to work, but the
current implementation cannot deliver it. Each gap lists the reproducer,
the observed evidence, and the smallest possible code change that would
close it.

---

## G1 — Offscreen window position blocks user bring-to-front

**Symptom:** After `mcp__computer-use__open_application("Notepad")`, the
bound window is positioned at `(-26214, -26214)` (the `(-32000, -32000)`
source code intent, with Windows clamping on the right/bottom). The
window appears in the taskbar but clicking the taskbar 5 times has no
visible effect. `SetForegroundWindow` reports success but the window
stays at the offscreen coordinates.

**Evidence (live, 2026-09-29):**
- Post-bind `is_iconic=false`, `cloaked=0`, `rect=(-26214,-26214 632x781)`
- After 5 taskbar clicks: `is_iconic=true`, `rect=(-25600,-25600 159x27)` (minimized)
- `cloaked` remains 0 — DWM is not cloaking the window

**Root cause:**
- The launch path calls `SetWindowPos(hwnd, ..., -32000, -32000, ...)`
  with `SWP_NOACTIVATE` (`src/utils/computerUse/platforms/win32.ts:795-808`)
- The launching PowerShell process never calls `AllowSetForegroundWindow(ASFW_ANY)`
  before `Start-Process`
- Windows 11 foreground-activation lock rejects the user's taskbar
  `SetForegroundWindow` because the calling thread doesn't own the
  foreground rights
- Without foreground rights, taskbar clicks fall back to toggling
  the minimize state instead of restoring

**Smallest fix:** Call `AllowSetForegroundWindow(-1)` in the launch
script before `Start-Process`, and either drop the `SetWindowPos(-32000, -32000)`
or move it to a real on-screen position (e.g. `CW_USEDEFAULT`).

---

## G2 — `mcp__computer-use__key` with modifier combinations cannot trigger accelerators

**Symptom:** Plain keys via `mcp__computer-use__key` work (`key("a")` inserts
an `a`), but `key("ctrl+t")`, `key("ctrl+n")`, `key("ctrl+shift+n")` have
no effect — no new tab, no new window, no shortcut action.

**Evidence (live, 2026-09-29):**
- `mcp__computer-use__key("a")` on a fresh `Untitled - Notepad` (HWND
  657172, PID 23872, rect `-26214,-26214`): title bar changed to
  `*a - Notepad`, screenshot shows a single `a` in the document. **WORKS.**
- `mcp__computer-use__key("ctrl+t")` on the same bound Notepad: no new
  tab, no state change, `cloaked=0`, `is_iconic=false` throughout.
  `key("ctrl+n")` and `key("ctrl+shift+t")` likewise. **FAILS.**
- `mcp__computer-use__key("ctrl+n")` after `manage_window focus`:
  `SetForegroundWindow` reports success but the keystroke still does
  nothing. **FAILS even with focus attempt.**

**Root cause:** Both `type` and `key` already target the bound HWND
directly — neither uses `SendInput`. The trace:

```
mcp__computer-use__key("ctrl+t")
  → vendor toolCalls.ts: handleKey (2766)
    → adapter.executor.key("ctrl+t")
      → executorCrossPlatform.ts:298 key()
        → platform.input.keys(["ctrl","t"])
          → platforms/win32.ts:362 keys()
            → getWm().sendKeys(boundHwnd, ["ctrl","t"])
              → windowMessage.ts:319 sendKeys() — PostMessageW × 4
                (ctrl down, t down, t up, ctrl up)
```

The implementation posts four `PostMessageW(WM_KEYDOWN/WM_KEYUP)`
messages to the bound HWND. `PostMessageW` queues messages but
**does not update the global keyboard input state** that accelerator
tables query via `GetKeyState(VK_CONTROL)` / `GetAsyncKeyState(VK_*)`.
When Notepad's `TranslateAccelerator` runs, it sees "Ctrl not held" and
treats the `T` `WM_KEYDOWN` as a plain `T` (which would insert a `t`),
but in practice the modifier release message may already have been
flushed in the same pump cycle, leaving the WndProc with no net effect.

The 2026-09-29 `key("a")` test confirms the WndProc receives the
events — the problem is specifically that the **modifier state never
gets registered with the global input system**, so accelerator-driven
shortcuts (Ctrl+T → NewTab) cannot fire. Plain keys work because they
go directly to the WndProc's `WM_CHAR` handler without an accelerator
check.

This is a deliberate design constraint — `platforms/win32.ts:266-271`
explicitly disables global `SendInput`/`keybd_event`:

> "Global SendInput/keybd_event is DISABLED to avoid interfering with
> user. NO global API (SetCursorPos/SendInput/keybd_event/SendKeys) is
> used."

— and `windowMessage.ts:295-298` chose `PostMessageW` over `SendMessageW`
specifically for Windows Terminal / ConPTY compatibility (where
`SendMessage` doesn't reach the raw console input buffer). The
constraint makes sense for terminals but is wrong for normal app
shortcuts.

**Smallest fix:** Three options, in order of surgical scope:

1. **Hybrid: post modifier events via `SendInput` (global) and the
   main key via `SendMessageW` to the bound HWND.** This updates the
   global keyboard state for the modifier (so accelerators fire) while
   keeping the main key bound. Requires re-enabling a tightly-scoped
   `SendInput` path for modifier events only. Side effect: briefly
   sets the global Ctrl/Shift/Alt state, which other apps on the same
   desktop would see — minimal in practice because the modifier is
   held for milliseconds.
2. **Move `key` and `type` to a single `SendMessageW`-only path for
   non-terminal apps.** Breaks terminal compatibility for `Ctrl+C` /
   `Ctrl+V` paste into Windows Terminal — would need a per-target
   detection path.
3. **Use `sendInput` for the entire combo, with a virtual keyboard
   that scopes its events to the bound HWND's process.** Requires
   more work (input scoping via `AttachThreadInput`).

Option 1 is the smallest, most direct fix that preserves both
terminal compatibility and the user's "no global input" guarantee
for non-modifier events. Recommend it.

---

## G3 — `findExistingWindow` substring reuse binds to wrong window

**Symptom:** `mcp__computer-use__open_application("Notepad")` does a
case-insensitive substring match on the visible window title. Any
window whose title contains "notepad" matches — including a Chrome
tab titled "Investigate Offscreen Notepad Behavior".

**Evidence (live, 2026-09-29):**
- `open_application("Notepad")` returned `"Opened \"Notepad\""`
- The bound HWND was actually a Chrome window
  (`hwnd=591598 pid=25260 title="(104) Ghost - Mary On A Cross..."`)
- A real Notepad process was NOT launched
- The Chrome tab happened to have "Notepad" in its title

**Root cause:** `src/utils/computerUse/platforms/win32.ts:519-532`
matches only on the title substring. No process-name check, no
exe-path check, no PID match against the requested app.

**Smallest fix:** Add an `opt-in` parameter (default `false`) to
`findExistingWindow` reuse, and verify the matching window's
`MainModule.FileName` (or `GetModuleFileNameEx`) starts with the
expected exe path. If reuse is not opt-in, fall through to
`Start-Process` for a fresh instance.

---

## G4 — `mcp__computer-use__screenshot` returns stale GDI surface when window is offscreen

**Symptom:** `PrintWindow` returns TRUE (verified) but the captured
JPEG is dominated by the initial paint of the window, not the current
logical state.

**Evidence (live, 2026-09-29):**
- Bound Notepad at `(-26214, -26214)`, `cloaked=0`, `is_iconic=false`
- `screenshot_window` → `print_window_result=true`, `pw_err=0`,
  `cloaked=0`
- Capture is 99.7% white, 0.32% dark pixels — the initial empty
  Notepad paint, not the current document content
- `RedrawWindow(RDW_INVALIDATE|RDW_UPDATENOW|RDW_ALLCHILDREN)` returns
  TRUE but the subsequent capture is byte-different but visually
  identical

**Root cause:** When the window is offscreen, the OS shell never
triggers a repaint on input. `SendMessageW` updates the window's
logical state but doesn't request a paint. `PrintWindow` reads the
last painted GDI surface. The combination gives a stale capture.

**Note:** This is **NOT** the prior hypothesis of "DWM cloaking."
DWM's cloak state is `0` throughout. The actual mechanism is
"no repaint scheduled because no on-screen visibility demand."

**Smallest fix:** Before every `screenshot_window` call, call
`RedrawWindow(hwnd, NULL, NULL, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN)`
in the bridge (the `force_repaint` method is already wired in
`bridge.py:99-116` and registered in `METHODS` — just call it from
`captureWindow` before the `screenshot_window` call). Note: this
works only when the window's WndProc will respond to `WM_PAINT`. If
the window is fully offscreen, even forced repaint may produce a
blank surface — in which case the fix is G1+G2 (move on-screen).

---

## G5 — No accessibility tree / caret position read

**Symptom:** The model has no way to know where the text caret is in
a bound Edit control. `SendMessageW(EM_GETSEL)` is not called.
`UIA_TextPattern.GetSelection()` is not called. The model is
effectively blind to insertion-point state.

**Evidence (live, 2026-09-29):**
- `mcp__computer-use__type` typed text at the *existing* caret
  position from the prior session, not at the document start
- No way for the model to discover this without reading the captured
  JPEG and guessing

**Root cause:** `bridge.py`'s `send_text` uses `WM_CHAR` which
inserts at the caret. No `EM_GETSEL`/`EM_SETSEL` round-trip exists.
The TS-side `handleType` in the vendor computer-use MCP doesn't add
this either.

**Smallest fix:** Before `send_text`, call `EM_GETSEL` on the bound
HWND's Edit child (find via `FindWindowEx` with class `Edit` or
`RichEdit20W`) to read the current caret position. If the model
wants a known position, call `EM_SETSEL` first. This requires
child-window enumeration on the bound HWND, which is a new code
path.

---

## G6 — No "is the user currently interacting?" signal

**Symptom:** The model has no way to detect when the user has
minimized, moved, or otherwise changed the bound HWND's state between
two MCP calls.

**Evidence (live, 2026-09-29):**
- After 5 taskbar clicks, `is_iconic` flipped from `false` to `true`
- The state transition was only discoverable by re-calling
  `get_window_state` between MCP calls
- The model never knew the user had touched the window

**Workaround landed in commit `ca28449`:** A module-scope
`lastSeenState` cache keyed by HWND compares the prior capture's
diagnostics against the current one, and emits a
`[computer-use] state_transition hwnd=... <changes>` line to stderr
whenever any tracked field changes. This is operator-visible only
(no model-visible change). The model can be informed by reading its
own log if a parser is added.

**Smallest fix (proper):** Add a model-visible notification channel
or include the diff in the next screenshot's response when a
transition has happened since the last response.

---

## G7 — `mcp__computer-use__screenshot` (full-display) returns black on session 0

**Symptom:** `mcp__computer-use__screenshot` (no `save_to_disk`, no
bound window) returns a fully black image when the MCP runs in
session 0 / non-interactive desktop.

**Evidence (live, 2026-09-29):**
- `screenshot` (full display) called via the MCP returned an all-black
  image
- `bridge.py:screenshot_full` uses `mss` to grab the primary display,
  which reads the active session's desktop
- In session 0 (services, MCP servers without an interactive user),
  the active desktop is the Service-0 desktop which is often
  black/unreadable

**Root cause:** The MCP server's process doesn't have access to the
user's interactive desktop. The `mss` library reads the calling
process's window station, which is the Service-0 window station.

**Smallest fix:** Detect the session 0 case and either (a) refuse
the full-display screenshot with a clear error, or (b) fall back to
bound-window capture if a window is bound, or (c) document the
limitation in the tool's description.

---

## Status of the fixes

None of the gaps above have been fixed yet. The diagnostic
instrumentation in commits `8719a65` and `ca28449` is purely
observational. The `force_repaint` method in `bridge.py:99-116` is
wired but not called by `captureWindow` — the G4 fix would be a
two-line change in `win32.ts`.

Recommended next steps, in priority order:
1. **G1 + G2** as a single commit — fixes the user-visible "I can't
   see the window" and "type goes elsewhere" reports. Smallest
   behavioral change with the highest user impact.
2. **G3** as a single-line fix in `findExistingWindow` — flips
   default reuse to off.
3. **G4** as a one-line addition to `captureWindow` to call
   `force_repaint` before `screenshot_window`.
4. **G5** is a larger change requiring child-window enumeration.
5. **G6, G7** are documentation/UX fixes.
