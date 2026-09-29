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

**Symptom:** Plain keys via `mcp__computer-use__key` mostly work (`key("a")`
inserts an `a`), but the result is non-deterministic: sometimes no
character is inserted, sometimes multiple characters, sometimes the
wrong ones. Modifier shortcuts (`Ctrl+T`, `Ctrl+N`, `Ctrl+A`,
`Ctrl+Shift+T`) have no effect — no new tab, no new window, no
Select All, no shortcut action.

**Evidence (live, 2026-09-29, HWND 657172, fresh `Untitled - Notepad`,
rect `-26214,-26214`, `is_iconic=false`, `cloaked=0` throughout):**

Sequence of `key()` calls and document text after each:

| Call | Title before | Title after | Chars added |
|---|---|---|---|
| `key("a")` | `Untitled` | `*a` | `a` (1) |
| `key("A")` | `*a` | `*a` | (0) |
| `key("ctrl+a")` | `*a` | `*aaa` | `aa` (2) |
| `key("ctrl+t")` | `*aaa` | `*aaa` | (0) |
| `key("ctrl+n")` | `*aaa` | `*aaa` | (0) |
| `key("t")` | `*aaa` | `*aaa` | (0) |
| `key("a")` | `*aaa` | `*aaatnta` | `tnt` + `a` (4) |

Two distinct anomalies:

1. **Plain keys are non-deterministic.** `key("a")` adds 1 char, then
   `key("A")` adds 0, then `key("ctrl+a")` adds 2 (the Ctrl was
   completely ignored and `a` was inserted twice), then `key("t")` adds
   0, then `key("a")` adds 4 chars including a `tnt` substring that
   came from nowhere.

2. **All modifier combinations are completely ignored.** `Ctrl+T`,
   `Ctrl+N`, `Ctrl+A` do nothing. The character is not inserted, the
   shortcut does not fire. Ctrl is dropped on the floor.

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

**Root cause:** Two interacting issues.

**Issue A — Modifier state never registered.** Both `type` and `key`
already target the bound HWND directly — neither uses `SendInput`. The
trace:

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
treats the `T` `WM_KEYDOWN` as a plain `T`. The WndProc's character
handler may insert a `t`, but the modifier-conditional shortcut path
never fires.

**Issue B — `PostMessageW` is non-deterministic on offscreen windows.**
The character insertion counts (1, 0, 2, 0, 0, 4) suggest the WndProc
is processing the queued `PostMessageW` events asynchronously, with
possible unpaired `WM_KEYDOWN` events being interpreted as autorepeat
keystrokes (the WndProc's default `WM_KEYDOWN` handler generates
`WM_CHAR` based on the held-key state). The interleaving between
modifier-down, key-down, key-up, modifier-up messages and the WndProc's
own message pump produces non-deterministic insertion counts.

The `key("a") → tnt` interleaving is the smoking gun: the user
sent `key("t")` (which posted `t` down, `t` up) and `key("ctrl+n")`
(which posted `Ctrl` down, `n` down, `n` up, `Ctrl` up). Then later
`key("a")` was sent, and between the prior call and this one, `tnt`
appeared in the document. The WndProc appears to be reprocessing
`WM_KEYDOWN` events from the queue as autorepeat, generating
additional `WM_CHAR` insertions asynchronously.

**Why this is hard to fix without changing the design:**

The 2026-09-29 prior session (commit `1e9d79f`) hypothesized only
Issue A. The 2026-09-29 follow-up test exposed Issue B as well: even
plain keys (no modifiers) have non-deterministic insertion counts.
This means the underlying `PostMessageW`-only design is broken for
all keystroke delivery to offscreen bound windows, not just for
modifier combinations.

The original design constraint — "Global SendInput/keybd_event is
DISABLED to avoid interfering with user" (`platforms/win32.ts:266-271`)
and `PostMessageW` over `SendMessageW` for Windows Terminal / ConPTY
compatibility (`windowMessage.ts:295-298`) — predates the diagnostic
instrumentation that revealed these issues. The constraint made sense
for terminals but is wrong for normal app keystrokes.

**Smallest fix:** Replace the offscreen-Win32 input path with a hybrid
that uses the right delivery mechanism per target:

1. **`SendMessageW(WM_CHAR, cp)` for printable text** — synchronous,
   per-codepoint, no autorepeat. Already the existing `sendText` path
   (`windowMessage.ts:285-292`). Works on the offscreen bound Notepad
   per the `type()` success in prior sessions.
2. **`SendInput` for synthetic keystrokes** when the bound HWND's
   thread is not actively pumping messages (i.e. the offscreen case).
   This updates the global keyboard input state (`GetKeyState` /
   `GetAsyncKeyState`) so accelerator tables fire correctly. Single
   `keybd_event` for modifier down/up + `WM_KEYDOWN/UP` for the main
   key (or full `SendInput` for the whole combo).
3. **Keep `PostMessageW` for terminal / ConPTY targets** behind a
   per-target detection path (e.g. `IsWindowClass("ConsoleWindowClass")`).

The trade-off: `SendInput` does update global state, so other apps on
the same desktop briefly see the synthetic modifier held for ~10 ms.
For a headless agent scenario where the user is not actively typing,
this is negligible. The current prohibition exists to prevent the
agent from "stealing" the user's keyboard, but the user has already
granted the app via `request_access` for the session.

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

---

## UIA investigation (2026-09-29) — accessibility tree quality

Live measurement against the bound Notepad (HWND `1508120`,
rect `(-26214, -26214)`, fresh `Untitled - Notepad` with the
`aaatnta` leftover from G2 testing). All measurements taken via
pywinauto `backend='uia'` directly so the bridge's own walk is
isolated for comparison.

### Capability summary

| Dimension | Available via UIA | Visible to MCP via `accessibility_snapshot` |
|---|---|---|
| Total descendants | 107 | 6 |
| `Document` (text area) | 1 (named "Text editor", `(-31992, -31907, 774x835)`) | **0** |
| `Tab` (tab strip) | 1 (`automationId='Tabs'`) | **0** |
| `TabItem` (open tabs) | 34 across 4 visible tabs | **0** |
| `Button` (toolbar) | 13 incl. `AddButton`, `RewriteDropDownButton`, `OverflowButton` | **0** |
| `MenuItem` (File/Edit/View) | 4 | **0** |
| Status bar `Text` blocks | 6 (Line/Col, char count, encoding, line endings, Zoom) | **0** |
| Tab selection | 1 (name="aaatnta. Modified.") | **0** |
| Document text via `TextPattern` | "aaatnta" (7 chars) | not returned |
| Document selection | `sel[0]` empty (collapsed caret at column 8) | not returned |

### G-UIA-1 — `accessibility_snapshot` drops every interactive element when window is offscreen

**Symptom:** The bridge's `walk` function in
`src/utils/computerUse/win32/bridge.py:434-472` filters every child
whose `rect.left < -10000`. The bound Notepad's HWND is at
`(-26214, -26214)`. Every direct child of the top-level window has
`rect.left` in the `-31000` to `-32000` range, so the entire
non-TitleBar subtree is dropped on the first iteration of the walk.

**Evidence (live, 2026-09-29):**
- `accessibility_snapshot(hwnd='1508120', max_depth=4)` returned
  only the 6 nodes shown in the table above
- The agent's view of the bound Notepad via the MCP is: TitleBar
  (empty name), System MenuBar, Minimize/Maximize/Close buttons
- The agent cannot see: the document, the tabs, the toolbar, the
  menu bar contents, the status bar
- A real `pywinauto` walk on the same HWND returns 107 descendants
  with 32 interactive elements

**Root cause:** Line 450:
```python
if w <= 0 or h <= 0 or rect.left < -10000:
    continue
```
The `< -10000` heuristic is intended to skip window-minimization
artifacts but is applied at every depth, including the top level
where the bound window itself is at `(-26214, -26214)`.

**Smallest fix:** Apply the offscreen check only when the bound
HWND itself is on-screen (i.e. not in the `move_offscreen` mode).
For the bound-window case, the right comparison is "is the element
visible relative to the parent's visible region," not "is the
element's left edge above a fixed threshold." Two-line change: only
apply `rect.left < -10000` when `bound_hwnd_is_onscreen == True`
(track this from `manage_window move_offscreen` calls).

### G-UIA-2 — No `Selection`/`Text`/cursor info returned in tree

**Symptom:** The bridge's tree nodes carry `role`, `name`, `id`,
`x/y/w/h`, `on`, `v`, and `c` — but not the document selection,
the caret position, or the focus path. The model has to call
`accessibility_snapshot` and infer the active tab from
positional guesses.

**Evidence (live, 2026-09-29):**
- `iface_text.DocumentRange.GetText(200)` returns `"aaatnta"`
- `iface_text.GetSelection()` returns one empty range (collapsed
  caret at column 8)
- `iface_selection.GetCurrentSelection()` on the `Tabs` element
  returns 1 item, name `"aaatnta. Modified."`
- The Status bar's `ContentTextBlock` reads
  `"Line 1,\nColumn 8"` — the cursor position is right there
  in UIA, not returned by the bridge

**Root cause:** The `walk` function in
`bridge.py:434-472` doesn't call any of the UIA patterns. It only
reads `element_info` (name, automation_id, control_type, rect,
enabled, value). Patterns like `TextPattern` (`GetText`,
`GetSelection`), `SelectionPattern` (`GetCurrentSelection`),
`SelectionItemPattern`, and `InvokePattern` are not exercised.

**Smallest fix:** For `Document` and `Edit` control types, call
`TextPattern.DocumentRange.GetText(max_chars)` and include as
`text` field. For `Tab` controls, call
`SelectionPattern.GetCurrentSelection()` and include selected
`TabItem` names as `selected`. For any control with a `Selection`
pattern, include the count. This is a per-control-type
post-process in `walk`.

### G-UIA-3 — No `get_current_state` endpoint; full tree is the only observation source

**Symptom:** Every state observation costs a full tree walk +
`PrintWindow` + `get_window_state` = 3 round-trips. The model
asks the same questions on every step: "Where is the caret?
What tab is active? What does the document say? Is the
Save dialog open?"

**Evidence (live, 2026-09-29):**
- The 6 status-bar `ContentTextBlock` values (Line/Col, char
  count, encoding, line endings, zoom) are individually
  retrievable but the model must ask for the full tree to get
  any one of them
- The Document text is available via `TextPattern` but requires
  a separate find+query path

**Root cause:** The MCP exposes `accessibility_snapshot` and
`screenshot_window` but no compact state endpoint.

**Smallest fix:** Add a `get_current_state(hwnd_str)` bridge
method that returns a flat dict:
```python
{
  'window': {'title': ..., 'class': ..., 'rect': ...},
  'focused': {'name': ..., 'type': ..., 'auto_id': ...},
  'document': {
    'text': '...',          # TextPattern.DocumentRange.GetText
    'selection_text': '...',# TextPattern.GetSelection
    'caret': {'line': 1, 'col': 8},  # parsed from status bar
  },
  'tabs': {'selected': 'aaatnta. Modified.', 'count': 4},
  'status_bar': {'line_col': 'Line 1, Column 8', 'chars': '7', ...},
  'actionable': [{'role': ..., 'name': ..., 'id': ..., 'rect': ...}, ...],
}
```
This is a single UIA pass with no recursion and no `PrintWindow`.
Cost: ~10× less than a full tree dump.

### G-UIA-4 — Focused element not retrievable while window is offscreen

**Symptom:** `UIA.GetFocusedElement()` from the top-level
`CUIAutomation` returns the user's foreground app (here: a
top-level "View" with `hasFocus=0`), not the bound Notepad's
focused descendant. The bound window has no OS-level foreground
rights, so its UIA subtree reports `CurrentHasKeyboardFocus=False`
on every element.

**Evidence (live, 2026-09-29):**
- `IUIAutomation.GetFocusedElement()` returned a Chrome
  WebView's "View" element with `hasFocus=0` — not the
  Notepad's Document
- Walking the bound Notepad's `descendants()`, no element has
  `hasFocus=True` (Document, Tabs, TabItem, etc. all show `False`)
- The OS foreground is whichever app the user last clicked

**Root cause:** `CurrentHasKeyboardFocus` reflects OS-foreground
focus, not logical UIA focus. When the bound window is offscreen
and not foregrounded, the UIA tree is logically "focused" (the
caret is at column 8, "aaatnta" is the active document) but
OS-level focus is elsewhere.

**Smallest fix:** Replace the focus signal with the
"logically-focused" element derived from:
- `Tabs` element's `SelectionPattern.GetCurrentSelection()` →
  active tab
- That tab's `Document` child's `TextPattern.GetSelection()` →
  caret position
- The Document's enclosing window's title → window-level state

This is what the model actually wants: "where would input go
if I sent it?" not "which window does the OS think is
foregrounded?"

### Priority re-ranking after UIA investigation

G-UIA findings change the priority order because UIA-based
navigation **replaces** the keyboard-shortcut path that G1+G2
are trying to fix.

| Gap | Original priority | After UIA finding |
|---|---|---|
| G1 (offscreen blocking) | 1 | **deferred** — G-UIA-1 already lets the agent operate without ever moving the window |
| G2 (key/type) | 1 | **lowered** — `key("a")` works for single keys; the modifier-shortcut problem is real but the agent can avoid it via UIA clicks on `Tabs`/`AddButton` |
| G3 (substring match) | 2 | 2 (unchanged) |
| G4 (stale GDI) | 3 | 3 (unchanged) |
| G5 (caret unknown) | 4 | **subsumed by G-UIA-3** — `get_current_state` reports caret |
| G6, G7 (UX) | 5 | 5 (unchanged) |
| **G-UIA-1** (tree filter) | new | **1** — one-line fix unblocks 32 currently-hidden interactive elements |
| **G-UIA-2** (patterns) | new | **2** — Document/Tab patterns make the snapshot actually useful |
| **G-UIA-3** (state endpoint) | new | **3** — single new bridge method, large UX improvement |
| **G-UIA-4** (logical focus) | new | 4 — only needed if G-UIA-3 still wants a focus signal |

**Recommended next commit:** G-UIA-1 + G-UIA-2 as a single
diagnostic-and-fix commit. G-UIA-1 is the one-line filter fix;
G-UIA-2 is a per-control-type post-process in `walk`. Both
are read-only from the user's perspective (the bridge already
has the data; the filter just drops it). After that, measure
again — if the agent can drive Notepad entirely via UIA clicks,
G1+G2 keyboard work drops to medium priority.

---

## Status of all gaps (post UIA investigation)

- G1: deferred — likely subsumed by G-UIA fixes
- G2: lowered — modifier shortcuts still broken, but the agent
  has a UIA-based workaround for the common cases (tab switch,
  new tab, menu, save)
- G3–G7: unchanged
- G-UIA-1 through G-UIA-4: documented above, G-UIA-1 + G-UIA-2
  recommended as the next commit

