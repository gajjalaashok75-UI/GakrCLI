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

## G2 — Bound HWND's `mcp__computer-use__type`/`mcp__computer-use__key` go to the user's foreground, not the bound window

**Symptom:** `mcp__computer-use__type` and `mcp__computer-use__key` use
`SendInput` (real OS keystrokes). When the bound HWND is at
`(-26214, -26214)` and Windows 11 rejects `SetForegroundWindow`, the
keystrokes either (a) go to the user's actual foreground window (e.g.
Visual Studio Code, a browser tab), or (b) are silently dropped if no
window is foregrounded.

**Evidence (live, 2026-09-29):**
- `mcp__computer-use__type` on a bound offscreen Notepad: title bar
  does not update; document content may or may not change depending on
  what window the user's foreground is at that moment
- `mcp__computer-use__key ctrl+n` to open a new Notepad tab: no new
  tab appears (the keystroke went elsewhere)
- `mcp__computer-use__key ctrl+t`, `ctrl+shift+n`: same — no new tab

**Root cause:** Same as G1. The `mcp__computer-use__type` action
ultimately uses `SendInput` (`win32.ts:133-134`). For the keystrokes
to reach the bound HWND's WndProc, that HWND must be the OS-foreground
window, which is not achievable with the current `(-26214, -26214)`
positioning and missing `AllowSetForegroundWindow` call.

**Smallest fix:** Two options, in order of scope:
1. **Same as G1** — fix the foreground-activation path so
   `SetForegroundWindow` actually works, and `SendInput` routes correctly.
2. **Switch `mcp__computer-use__type`/`key` to use the bound HWND's
   `WndProc` via `SendMessageW`** (the `send_text` helper already
   exists in `bridge.py:343-356`). This bypasses `SendInput` entirely
   and works regardless of where the window is positioned, at the cost
   of breaking for windows that don't handle `WM_CHAR`/`WM_KEYDOWN`
   in their top-level WndProc (most modern Edit-based controls do,
   but some don't).

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
