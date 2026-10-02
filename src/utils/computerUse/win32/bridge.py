"""
Python Bridge for Windows Computer Use.

Long-lived subprocess communicating via stdin/stdout JSON lines.
Replaces per-call PowerShell spawning with a persistent process.

Capabilities:
  - screenshot: full-screen or per-window (mss + PrintWindow)
  - input: mouse click/move/drag, keyboard type/key (ctypes user32)
  - windows: enumerate, find, get rect, manage (show/min/max/close)
  - accessibility: UI Automation tree snapshot (comtypes + UIAutomation)

Protocol: one JSON object per line on stdin → one JSON object per line on stdout.
  Request:  {"id": 1, "method": "screenshot", "params": {...}}
  Response: {"id": 1, "result": {...}}  or  {"id": 1, "error": "message"}
"""

import sys
import json
import base64
import io
import ctypes
import ctypes.wintypes
import time
import os

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

# ---------------------------------------------------------------------------
# Win32 constants & types
# ---------------------------------------------------------------------------
WM_CHAR = 0x0102
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_CLOSE = 0x0010
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
WM_LBUTTONDBLCLK = 0x0203
WM_RBUTTONDOWN = 0x0204
WM_RBUTTONUP = 0x0205
WM_RBUTTONDBLCLK = 0x0206
WM_MBUTTONDOWN = 0x0207
WM_MBUTTONUP = 0x0208
WM_MBUTTONDBLCLK = 0x0209
WM_MOUSEMOVE = 0x0200

# wParam key-state flags for WM_*BUTTON* messages
MK_LBUTTON = 0x0001
MK_RBUTTON = 0x0002
MK_SHIFT = 0x0004
MK_CONTROL = 0x0008
MK_MBUTTON = 0x0010

SW_MINIMIZE = 6
SW_MAXIMIZE = 3
SW_RESTORE = 9
SW_SHOWMINNOACTIVE = 7

SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_NOZORDER = 0x0004
SWP_NOACTIVATE = 0x0010

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                ("right", ctypes.c_long), ("bottom", ctypes.c_long)]

class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

# SendMessageW
SendMessageW = user32.SendMessageW
SendMessageW.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]
SendMessageW.restype = ctypes.c_void_p

# ---------------------------------------------------------------------------
# Screenshot
# ---------------------------------------------------------------------------
def screenshot_full(display_id=0):
    """Full-screen screenshot via mss, returns JPEG base64."""
    import mss
    from PIL import Image
    with mss.mss() as sct:
        monitor = sct.monitors[display_id + 1] if display_id < len(sct.monitors) - 1 else sct.monitors[1]
        shot = sct.grab(monitor)
        img = Image.frombytes('RGB', shot.size, shot.bgra, 'raw', 'BGRX')
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=75)
        return {
            'base64': base64.b64encode(buf.getvalue()).decode(),
            'width': shot.width,
            'height': shot.height,
        }

def _cloaked(hwnd):
    """DWMWA_CLOAKED — 0 = not cloaked, 1 = cloaked by app, 2 = cloaked by shell.

    Read-only DWM attribute. -1 means the call failed (DWM not running or
    attribute unsupported on this platform).
    """
    try:
        v = ctypes.c_uint32(0)
        hr = ctypes.windll.dwmapi.DwmGetWindowAttribute(
            hwnd, 14, ctypes.byref(v), ctypes.sizeof(v)
        )  # DWMWA_CLOAKED = 14
        return int(v.value) if hr == 0 else -1
    except Exception:
        return -1

def _pid_for_hwnd(hwnd):
    pid = ctypes.c_uint32(0)
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return int(pid.value)

def _title_for_hwnd(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length <= 0:
        return ''
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value

def _rect_dict(hwnd):
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return {
        'x': int(rect.left), 'y': int(rect.top),
        'width': int(rect.right - rect.left),
        'height': int(rect.bottom - rect.top),
    }

def _window_diagnostics(hwnd):
    """Read-only window state snapshot for diagnostics.

    Intentionally does NOT call SetForegroundWindow, ShowWindow, or any
    state-mutating API. The whole point is to observe without altering.
    """
    return {
        'hwnd': str(hwnd),
        'pid': _pid_for_hwnd(hwnd),
        'title': _title_for_hwnd(hwnd),
        'is_window': bool(user32.IsWindow(hwnd)),
        'is_visible': bool(user32.IsWindowVisible(hwnd)),
        'is_iconic': bool(user32.IsIconic(hwnd)),
        'cloaked': _cloaked(hwnd),
        'rect': _rect_dict(hwnd),
    }

def get_window_state(hwnd_str):
    """Read-only window state — for bind-time diagnostics dump."""
    return _window_diagnostics(int(hwnd_str))

def screenshot_window(hwnd_str):
    """Window screenshot via PrintWindow. Captures PrintWindow return value
    and GetLastError() into a _diagnostics field. The TS bridge strips that
    field before the result is exposed to the model — operators see it via
    console.error logs."""
    from PIL import Image
    hwnd = int(hwnd_str)
    if not user32.IsWindow(hwnd):
        return None

    # Get window rect
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    if w <= 0 or h <= 0:
        return None

    # Handle minimized windows
    was_minimized = user32.IsIconic(hwnd)
    if was_minimized:
        user32.ShowWindow(hwnd, 4)  # SW_SHOWNOACTIVATE
        time.sleep(0.1)
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top

    # Ask the window to repaint synchronously before capturing. An
    # offscreen-parked window receives no OS-triggered repaints (nothing is
    # visible, so nothing schedules a paint), and PrintWindow reads the last
    # painted GDI surface — which can be a stale initial frame. RDW_UPDATENOW
    # forces the WndProc to paint now; combined with PW_RENDERFULLCONTENT
    # (flag 2 below) even DWM-composited content comes through current.
    try:
        RDW_INVALIDATE = 0x0001
        RDW_ALLCHILDREN = 0x0080
        RDW_UPDATENOW = 0x0100
        user32.RedrawWindow(hwnd, None, None,
                            RDW_INVALIDATE | RDW_ALLCHILDREN | RDW_UPDATENOW)
        time.sleep(0.02)
    except Exception:
        pass

    # Create DC and bitmap
    hdc_window = user32.GetDC(hwnd)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_window)
    hbm = gdi32.CreateCompatibleBitmap(hdc_window, w, h)
    gdi32.SelectObject(hdc_mem, hbm)

    # PrintWindow with PW_RENDERFULLCONTENT
    pw_result = ctypes.windll.user32.PrintWindow(hwnd, hdc_mem, 2)
    # GetLastError right after — the only place to read it before another
    # Win32 call clobbers the thread-local slot.
    pw_err = ctypes.get_last_error() if not pw_result else 0

    if not pw_result:
        # Fallback to BitBlt
        gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_window, 0, 0, 0x00CC0020)  # SRCCOPY

    # Extract bitmap bits
    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ('biSize', ctypes.c_uint32), ('biWidth', ctypes.c_int32),
            ('biHeight', ctypes.c_int32), ('biPlanes', ctypes.c_uint16),
            ('biBitCount', ctypes.c_uint16), ('biCompression', ctypes.c_uint32),
            ('biSizeImage', ctypes.c_uint32), ('biXPelsPerMeter', ctypes.c_int32),
            ('biYPelsPerMeter', ctypes.c_int32), ('biClrUsed', ctypes.c_uint32),
            ('biClrImportant', ctypes.c_uint32),
        ]

    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = w
    bmi.biHeight = -h  # top-down
    bmi.biPlanes = 1
    bmi.biBitCount = 32
    bmi.biCompression = 0  # BI_RGB

    buf_size = w * h * 4
    pixel_buf = ctypes.create_string_buffer(buf_size)
    gdi32.GetDIBits(hdc_mem, hbm, 0, h, pixel_buf, ctypes.byref(bmi), 0)

    # Cleanup GDI
    gdi32.DeleteObject(hbm)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(hwnd, hdc_window)

    if was_minimized:
        user32.ShowWindow(hwnd, SW_SHOWMINNOACTIVE)

    # Convert to JPEG
    img = Image.frombuffer('RGBA', (w, h), pixel_buf, 'raw', 'BGRA', 0, 1)
    img = img.convert('RGB')
    out = io.BytesIO()
    img.save(out, format='JPEG', quality=75)

    return {
        'base64': base64.b64encode(out.getvalue()).decode(),
        'width': w,
        'height': h,
        '_diagnostics': {
            'hwnd': str(hwnd),
            'pid': _pid_for_hwnd(hwnd),
            'title': _title_for_hwnd(hwnd),
            'print_window_result': bool(pw_result),
            'print_window_error': int(pw_err),
            'was_minimized_restored': was_minimized,
            'cloaked': _cloaked(hwnd),
            'rect': {
                'x': int(rect.left), 'y': int(rect.top),
                'width': int(rect.right - rect.left),
                'height': int(rect.bottom - rect.top),
            },
        },
    }

# ---------------------------------------------------------------------------
# Window management
# ---------------------------------------------------------------------------
def list_windows():
    """Enumerate all visible windows with title."""
    windows = []
    def cb(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                pid = ctypes.c_uint32()
                user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                windows.append({'hwnd': str(hwnd), 'pid': pid.value, 'title': buf.value})
        return True
    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return windows

def get_window_rect(hwnd_str):
    hwnd = int(hwnd_str)
    rect = RECT()
    if user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return {'x': rect.left, 'y': rect.top,
                'width': rect.right - rect.left, 'height': rect.bottom - rect.top}
    return None

def get_client_offset(hwnd_str):
    """Get non-client area offset (title bar height, border width)."""
    hwnd = int(hwnd_str)
    wr = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(wr))
    pt = POINT(0, 0)
    user32.ClientToScreen(hwnd, ctypes.byref(pt))
    return {'dx': pt.x - wr.left, 'dy': pt.y - wr.top}

def manage_window(hwnd_str, action):
    hwnd = int(hwnd_str)
    if action == 'minimize':
        return user32.ShowWindow(hwnd, SW_SHOWMINNOACTIVE)
    elif action == 'maximize':
        return user32.ShowWindow(hwnd, SW_MAXIMIZE)
    elif action == 'restore':
        return user32.ShowWindow(hwnd, SW_RESTORE)
    elif action == 'close':
        SendMessageW(hwnd, WM_CLOSE, 0, 0)
        return True
    elif action == 'focus':
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)
        return True
    elif action == 'move_offscreen':
        user32.SetWindowPos(hwnd, 0, -32000, -32000, 0, 0,
                           SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE)
        return True
    return False

# ---------------------------------------------------------------------------
# Input — all via SendMessageW (window-targeted, no global)
# ---------------------------------------------------------------------------
def make_lparam(x, y):
    return (y << 16) | (x & 0xFFFF)

_CLICK_MSGS = {
    'left': (WM_LBUTTONDOWN, WM_LBUTTONUP, WM_LBUTTONDBLCLK, MK_LBUTTON),
    'right': (WM_RBUTTONDOWN, WM_RBUTTONUP, WM_RBUTTONDBLCLK, MK_RBUTTON),
    'middle': (WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MBUTTONDBLCLK, MK_MBUTTON),
}

def _mk_flags(modifiers):
    """wParam key-state flags (MK_CONTROL/MK_SHIFT) for button messages."""
    flags = 0
    for m in (modifiers or []):
        ml = str(m).lower()
        if ml in ('ctrl', 'control'):
            flags |= MK_CONTROL
        elif ml == 'shift':
            flags |= MK_SHIFT
    return flags

def send_click(hwnd_str, x, y, button='left', modifiers=None):
    hwnd = int(hwnd_str)
    if not user32.IsWindow(hwnd):
        return False
    lp = make_lparam(x, y)
    down, up, _dbl, mk = _CLICK_MSGS.get(button, _CLICK_MSGS['left'])
    wp = _mk_flags(modifiers) | mk
    SendMessageW(hwnd, down, wp, lp)
    SendMessageW(hwnd, up, wp, lp)
    return True

def send_multi_click(hwnd_str, x, y, button='left', count=1, modifiers=None):
    """Multi-click at client coords. count>1 sends real WM_*BUTTONDBLCLK.

    N consecutive WM_LBUTTONDOWN/UP pairs do NOT register as a double-click:
    the target decides via GetDoubleClickTime, and synthesised pairs carry
    identical message timestamps. WM_*DBLCLK is what the WndProc actually
    switches on (word-select / line-select in editors), so double and
    triple clicks must be sent explicitly. Works identically for onscreen
    and offscreen-parked windows — everything is window-targeted.
    """
    if count <= 1:
        return send_click(hwnd_str, x, y, button, modifiers)
    hwnd = int(hwnd_str)
    if not user32.IsWindow(hwnd):
        return False
    lp = make_lparam(x, y)
    down, up, dbl, mk = _CLICK_MSGS.get(button, _CLICK_MSGS['left'])
    wp = _mk_flags(modifiers) | mk
    for i in range(int(count)):
        if i == 0:
            SendMessageW(hwnd, down, wp, lp)
        else:
            SendMessageW(hwnd, dbl, wp, lp)
        SendMessageW(hwnd, up, wp, lp)
        time.sleep(0.03)
    return True

def send_key_chord(hwnd_str, keys):
    """FRATURE-GAPS G2 fix — deliver a key combo with real keyboard state.

    PostMessageW(WM_KEYDOWN) queues messages but never updates the global
    key state that TranslateAccelerator consults via GetKeyState, so
    modifier chords (ctrl+t, ctrl+shift+tab, ...) are silently treated as
    the plain key. This path briefly brings the bound window to the
    foreground, injects the full chord via keybd_event (which updates that
    state), then restores the user's previous foreground window. Works the
    same for onscreen and offscreen-parked bound windows.
    """
    VK = {
        'ctrl': 0x11, 'control': 0x11, 'shift': 0x10, 'alt': 0x12, 'menu': 0x12,
        'enter': 0x0D, 'return': 0x0D, 'tab': 0x09, 'escape': 0x1B, 'esc': 0x1B,
        'backspace': 0x08, 'delete': 0x2E, 'del': 0x2E, 'insert': 0x2D,
        'ins': 0x2D, 'space': 0x20,
        'left': 0x25, 'up': 0x26, 'right': 0x27, 'down': 0x28,
        'home': 0x24, 'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22,
        'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74,
        'f6': 0x75, 'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79,
        'f11': 0x7A, 'f12': 0x7B,
    }
    MODIFIERS = {'ctrl', 'control', 'shift', 'alt', 'menu'}
    # Navigation keys emit the wrong character without Shift held.
    SHIFTED_NAV = {'left', 'up', 'right', 'down', 'home', 'end',
                   'pageup', 'pagedown', 'insert', 'ins', 'delete', 'del'}
    mods = []
    main_vk = None
    for k in keys:
        kl = str(k).lower()
        if kl in MODIFIERS:
            vk = VK[kl]
            if vk not in mods:
                mods.append(vk)
        elif kl in VK:
            main_vk = VK[kl]
            if kl in SHIFTED_NAV and 0x10 not in mods:
                mods.insert(0, 0x10)
        elif len(kl) == 1:
            main_vk = ord(kl.upper())
    if main_vk is None:
        return False
    hwnd = int(hwnd_str)
    # Refuse BEFORE touching global input: with a stale/invalid hwnd the
    # keybd_event chord below would land in whatever window the USER has
    # foreground. Window-targeted SendMessage paths degrade harmlessly on a
    # dead hwnd; global injection does not.
    if not user32.IsWindow(hwnd):
        return False
    prev_fg = user32.GetForegroundWindow()
    try:
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.05)
        # ALT tap: makes this thread eligible for SetForegroundWindow even
        # when the caller has no foreground rights.
        try:
            user32.keybd_event(0x12, 0, 0, 0)       # ALT down
            user32.keybd_event(0x12, 0, 0x0002, 0)  # ALT up
        except Exception:
            pass
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.05)
        KEYEVENTF_KEYUP = 0x0002
        for m in mods:
            user32.keybd_event(m, 0, 0, 0)
        user32.keybd_event(main_vk, 0, 0, 0)
        user32.keybd_event(main_vk, 0, KEYEVENTF_KEYUP, 0)
        for m in reversed(mods):
            user32.keybd_event(m, 0, KEYEVENTF_KEYUP, 0)
        time.sleep(0.05)
        # Give the user's foreground back — the chord must not steal it.
        try:
            if prev_fg and prev_fg != hwnd and user32.IsWindow(prev_fg):
                user32.SetForegroundWindow(prev_fg)
        except Exception:
            pass
        return True
    except Exception:
        return False

def send_text(hwnd_str, text):
    """Send text via WM_CHAR (Unicode). Handles surrogate pairs."""
    hwnd = int(hwnd_str)
    for ch in text:
        cp = ord(ch)
        if cp <= 0xFFFF:
            SendMessageW(hwnd, WM_CHAR, cp, 0)
        else:
            # Surrogate pair
            hi = ((cp - 0x10000) >> 10) + 0xD800
            lo = ((cp - 0x10000) & 0x3FF) + 0xDC00
            SendMessageW(hwnd, WM_CHAR, hi, 0)
            SendMessageW(hwnd, WM_CHAR, lo, 0)
    return True

def send_key(hwnd_str, vk, action='down'):
    hwnd = int(hwnd_str)
    msg = WM_KEYDOWN if action == 'down' else WM_KEYUP
    SendMessageW(hwnd, msg, vk, 0)
    return True

def send_keys_combo(hwnd_str, keys):
    """Send a key combination like ['ctrl', 's']."""
    VK = {
        'ctrl': 0x11, 'control': 0x11, 'shift': 0x10, 'alt': 0x12,
        'enter': 0x0D, 'return': 0x0D, 'tab': 0x09, 'escape': 0x1B,
        'backspace': 0x08, 'delete': 0x2E, 'space': 0x20,
        'left': 0x25, 'up': 0x26, 'right': 0x27, 'down': 0x28,
        'home': 0x24, 'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22,
        'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74,
        'f6': 0x75, 'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79,
        'f11': 0x7A, 'f12': 0x7B,
    }
    MODIFIERS = {'ctrl', 'control', 'shift', 'alt'}
    hwnd = int(hwnd_str)
    mods = []
    main_key = None
    for k in keys:
        kl = k.lower()
        if kl in MODIFIERS:
            mods.append(VK.get(kl, 0))
        elif kl in VK:
            main_key = VK[kl]
        elif len(kl) == 1:
            main_key = ord(kl.upper())
    if main_key is None:
        return False
    for m in mods:
        SendMessageW(hwnd, WM_KEYDOWN, m, 0)
    SendMessageW(hwnd, WM_KEYDOWN, main_key, 0)
    SendMessageW(hwnd, WM_KEYUP, main_key, 0)
    for m in reversed(mods):
        SendMessageW(hwnd, WM_KEYUP, m, 0)
    return True

def send_mouse_down(hwnd_str, x, y):
    hwnd = int(hwnd_str)
    SendMessageW(hwnd, WM_LBUTTONDOWN, 0, make_lparam(x, y))
    return True

def send_mouse_up(hwnd_str, x, y):
    hwnd = int(hwnd_str)
    SendMessageW(hwnd, WM_LBUTTONUP, 0, make_lparam(x, y))
    return True

def send_mouse_move(hwnd_str, x, y):
    hwnd = int(hwnd_str)
    SendMessageW(hwnd, WM_MOUSEMOVE, 0, make_lparam(x, y))
    return True

# ---------------------------------------------------------------------------
# Accessibility snapshot (UI Automation via pywinauto)
# ---------------------------------------------------------------------------

def snapshot_flat_fallback(win):
    """Flat accessibility snapshot built from a one-shot descendants() query.

    Chromium apps (Chrome, Electron VS Code) don't answer TreeScope_Children
    walks even after their accessibility tree is fully materialized, while a
    single TreeScope_Descendants find_all returns every element. Used only
    when the normal recursive walk comes back empty. Hierarchy is lost, but
    role/name/id/rect/pattern fields survive — everything click_element /
    type_into_element need for name-based targeting.
    """
    # Token budget: this text is embedded in every screenshot response.
    # Role filtering uses the shared module-level INTERACTIVE_ROLES set.
    MAX_NODES = 120

    try:
        descendants = win.descendants()
    except Exception:
        return None

    def build_node(d):
        try:
            ct = d.element_info.control_type or ''
            if ct not in INTERACTIVE_ROLES:
                return None
            rect = d.rectangle()
            w = rect.right - rect.left
            h = rect.bottom - rect.top
            if w <= 0 or h <= 0:
                return None
            # Phase 2.2: carry the RuntimeId so *_id bridge methods can
            # re-resolve THIS element later without relying on automation_id
            # strings (often empty or duplicated). `k` is assigned by the
            # caller in final node order.
            try:
                rid = [int(x) for x in (d.element_info.runtime_id or [])]
            except Exception:
                rid = None
            if rid is None:
                return None
            node = {
                'role': ct, 'name': d.element_info.name or '',
                'id': d.element_info.automation_id or '',
                'x': rect.left, 'y': rect.top, 'w': w, 'h': h,
                'on': d.is_enabled(),
                'rid': rid,
            }
            value = None
            try:
                value = d.get_value()
            except Exception:
                pass
            if value:
                node['v'] = str(value)[:100]
            # G-UIA-2 fields on the controls that carry them
            if ct in ('Document', 'Edit', 'Text'):
                try:
                    iface_text = d.iface_text
                except Exception:
                    iface_text = None
                if iface_text is not None:
                    try:
                        t = iface_text.DocumentRange.GetText(500)
                        if t:
                            node['text'] = t
                    except Exception:
                        pass
            if ct in ('Tab', 'List'):
                try:
                    iface_selection = d.iface_selection
                    cur = iface_selection.GetCurrentSelection()
                    if cur and cur.Length > 0:
                        sel_names = []
                        for i in range(min(cur.Length, 10)):
                            try:
                                sel_names.append(cur.GetElement(i).CurrentName)
                            except Exception:
                                pass
                        if sel_names:
                            node['selected'] = sel_names
                except Exception:
                    pass
            return node
        except Exception:
            return None

    interactive_nodes = []
    structural_nodes = []
    for d in descendants:
        node = build_node(d)
        if node is None:
            continue
        if node['role'] in INTERACTIVE_ROLES:
            interactive_nodes.append(node)
        else:
            structural_nodes.append(node)

    nodes = (interactive_nodes + structural_nodes)[:MAX_NODES]
    # Phase 2.2: per-snapshot node ids (1-based, unique within THIS snapshot).
    for i, node in enumerate(nodes, 1):
        node['k'] = i
    return nodes if nodes else None

def _nudge_suspended_uwp(hwnd, win):
    """Wake a suspended UWP/packaged app whose UIA tree has collapsed.

    Packaged apps are suspended when they lose focus; Windows then empties
    their UIA tree (descendants() -> 0). A brief SetForegroundWindow nudge
    resumes the process and the tree repopulates. Guarded so it can never
    steal focus from the user: only fires for windows that are visible and
    onscreen — never for offscreen-parked (bound) windows.
    """
    try:
        wr = get_window_rect(str(hwnd))
        if not wr:
            return False
        x, y, w, h = wr['x'], wr['y'], wr['width'], wr['height']
        # Offscreen-parked (-32000) or fully out of any monitor: leave it.
        if x <= -30000 or y <= -30000 or w <= 0 or h <= 0:
            return False
        if user32.IsIconic(hwnd):
            return False
        try:
            descendants = win.descendants()
        except Exception:
            return False
        # A suspended packaged app can expose a handful of chrome elements
        # while its real content tree is still collapsed, so "thin" (not just
        # empty) counts as suspended. Real windows have dozens of elements.
        if len(descendants) >= 5:
            return False  # tree already alive
        # Resume can take longer than a single 0.6 s wait; SetForegroundWindow
        # also fails silently when the caller lacks foreground rights. The
        # classic unlock is a bare ALT tap (keybd_event) which makes the OS
        # treat this thread as recent input; user focus is restored after.
        prev_fg = user32.GetForegroundWindow()
        try:
            user32.keybd_event(0x12, 0, 0, 0)       # ALT down
            user32.keybd_event(0x12, 0, 0x0002, 0)  # ALT up
        except Exception:
            pass
        woke = False
        for _attempt in range(3):
            user32.SetForegroundWindow(hwnd)
            time.sleep(0.6)
            try:
                if len(win.descendants()) >= 5:
                    woke = True
                    break
            except Exception:
                pass
        # Give the user's foreground back — the nudge must not steal it.
        try:
            if prev_fg and user32.IsWindow(prev_fg):
                user32.SetForegroundWindow(prev_fg)
        except Exception:
            pass
        return woke
    except Exception:
        return False

def resolve_top_window(hwnd):
    """Resolve a top-level hwnd to a pywinauto UIA wrapper.

    Normal path: match against Desktop(backend='uia').windows(). Fallback:
    some hosts (e.g. UWP apps inside ApplicationFrameHost) never appear in
    the desktop's top-level enumeration, so the handle match fails; wrap the
    hwnd directly via UIAWrapper — the element still exists and answers
    descendants()/children() normally.
    """
    try:
        from pywinauto import Desktop
        from pywinauto.controls.uiawrapper import UIAWrapper

        app = Desktop(backend='uia')
        for w in app.windows():
            if w.handle == hwnd:
                return w
    except Exception:
        pass
    try:
        from pywinauto.controls.uiawrapper import UIAWrapper
        from pywinauto.uia_element_info import UIAElementInfo
        return UIAWrapper(UIAElementInfo(hwnd))
    except Exception:
        return None

def accessibility_snapshot(hwnd_str, max_depth=6):
    """Snapshot the bound window's UIA tree as a pruned node list.

    Returns None when the tree cannot be walked at all (reason goes to
    stderr, where the TS client keeps a diagnostics tail). Per-node COM
    failures during the walk are skipped and tallied — never silent.
    A hard element budget caps the output; when it is hit, a marker node is
    appended that tells the model how to recover (scroll / get_current_state).
    """
    try:
        from pywinauto import Desktop
        from pywinauto.controls.uiawrapper import UIAWrapper

        hwnd = int(hwnd_str)
        win = resolve_top_window(hwnd)
        if win is None:
            return None
        # Suspended UWP apps expose an empty tree until resumed.
        _nudge_suspended_uwp(hwnd, win)

        # Walker-break lock: this hwnd's provider already failed child
        # navigation once (lock set below) — go straight to the flat path.
        if _FLAT_WALK_ONLY[0] == hwnd:
            flat = snapshot_flat_fallback(win)
            return flat if flat else None

        # Hard node budget (Windows-MCP-style TreeElementBudget): this text is
        # embedded in every screenshot response, so an unbounded walk on a
        # dense UI can flood it. When the budget is hit the walk stops early
        # and a truncation marker node is appended below.
        element_budget = [500]
        budget_hit = [False]
        walk_errors = []
        # Phase 2.2: per-snapshot node id counter — unique within THIS
        # snapshot; ids are never meaningful across snapshots.
        node_counter = [0]

        def walk(element, depth):
            if depth >= max_depth:
                return []
            nodes = []
            try:
                children = element.children()
            except Exception as e:
                walk_errors.append(f'{type(e).__name__} at depth {depth}')
                return []
            for child in children:
                try:
                    ct = child.element_info.control_type or ''
                    name = child.element_info.name or ''
                    auto_id = child.element_info.automation_id or ''
                    rect = child.rectangle()
                    w = rect.right - rect.left
                    h = rect.bottom - rect.top
                    # Skip zero-size elements (minimized, hidden, never-rendered).
                    # The previous < -10000 filter was also dropping legitimate
                    # elements of the bound window because the bound window
                    # itself is placed at (-32000, -32000), so every direct
                    # child inherited an offscreen left. Filter only on size
                    # here; per-node visibility is read via IsOffscreen below
                    # and MARKED (never filtered) so the agent can scroll to
                    # content that exists out of view.
                    if w <= 0 or h <= 0:
                        continue
                    if element_budget[0] <= 0:
                        budget_hit[0] = True
                        return nodes
                    element_budget[0] -= 1
                    enabled = child.is_enabled()
                    off = _is_offscreen(child)
                    value = None
                    try:
                        value = child.get_value()
                    except Exception:
                        pass
                    sub = walk(child, depth + 1)
                    if ct in INTERACTIVE_ROLES or sub:
                        # Phase 2.2: k identifies the node within THIS snapshot
                        # (per-snapshot identity — elements die between calls,
                        # so ids are never reused across snapshots); rid is the
                        # UIA RuntimeId, consumed by the *_id action methods.
                        node_counter[0] += 1
                        try:
                            rid = [int(x) for x in (child.element_info.runtime_id or [])]
                        except Exception:
                            rid = None
                        node = {
                            'k': node_counter[0],
                            'role': ct, 'name': name, 'id': auto_id,
                            'x': rect.left, 'y': rect.top, 'w': w, 'h': h,
                            'on': enabled,
                        }
                        if rid:
                            node['rid'] = rid
                        if off and ct not in ('Edit', 'Document'):
                            # Carve-outs: a focused Edit with a scrolled caret
                            # reports IsOffscreen while being the primary
                            # target; Document content is virtualized text.
                            node['off'] = True
                        if value:
                            node['v'] = str(value)[:100]
                        # G-UIA-2: pull UIA pattern data so the agent can read
                        # document state without a screenshot. TextPattern for
                        # Document/Edit, SelectionPattern for Tab/List controls.
                        try:
                            iface_text = child.iface_text
                        except Exception:
                            iface_text = None
                        if iface_text is not None:
                            try:
                                t = iface_text.DocumentRange.GetText(500)
                                if t:
                                    node['text'] = t
                            except Exception:
                                pass
                            try:
                                sel = iface_text.GetSelection()
                                if sel and sel.Length > 0:
                                    parts = []
                                    for i in range(min(sel.Length, 5)):
                                        try:
                                            parts.append(sel.GetElement(i).GetText(200))
                                        except Exception:
                                            pass
                                    # Caret-only selections report Length > 0 but no
                                    # text; sel='' is pure noise for the model.
                                    joined = ''.join(parts)
                                    if joined:
                                        node['selText'] = joined
                            except Exception:
                                pass
                        try:
                            iface_selection = child.iface_selection
                        except Exception:
                            iface_selection = None
                        if iface_selection is not None and ct in ('Tab', 'List', 'ListView', 'Tree'):
                            try:
                                cur = iface_selection.GetCurrentSelection()
                                if cur and cur.Length > 0:
                                    sel_names = []
                                    for i in range(min(cur.Length, 10)):
                                        try:
                                            sel_names.append(cur.GetElement(i).CurrentName)
                                        except Exception:
                                            pass
                                    if sel_names:
                                        node['selected'] = sel_names
                            except Exception:
                                pass
                        if sub:
                            node['c'] = sub
                        nodes.append(node)
                except Exception as e:
                    walk_errors.append(f'{type(e).__name__} on {ct or "?"} at depth {depth}')
                    continue
            return nodes

        def count_tree(nodes):
            return sum(1 + count_tree(n.get('c', [])) for n in nodes)

        tree = walk(win, 0)
        if walk_errors:
            sys.stderr.write(
                f'[bridge] accessibility_snapshot: {len(walk_errors)} nodes skipped: '
                + '; '.join(walk_errors[:5])
                + (' …' if len(walk_errors) > 5 else '') + '\n')
        if budget_hit[0]:
            tree.append({
                'k': -1,  # sentinel: the truncation note is not a real element
                'role': 'Note',
                'name': 'Accessibility tree truncated: element budget (500) reached. '
                        'Content below the cut is missing. Use get_current_state for a '
                        'derived summary, or scroll to bring more content onscreen, '
                        'then re-capture.',
                'id': '', 'x': 0, 'y': 0, 'w': 0, 'h': 0, 'on': True,
            })
        if count_tree(tree) >= 10:
            return tree
        # Thin-or-empty children() walk: Chromium apps (Chrome, Electron VS
        # Code) expose their window chrome but not the content tree to
        # TreeScope_Children navigation, while a one-shot descendants()
        # query returns everything. Use the flat rebuild when it finds more.
        flat = snapshot_flat_fallback(win)
        if flat and count_tree(flat) > count_tree(tree):
            # Phase 2.5: a window with real content (>= 5 elements via
            # descendants()) whose child walk came back thin is a broken
            # provider — lock this hwnd into the flat path for the rest of
            # the bridge process so future snapshots skip the doomed walk.
            try:
                if len(win.descendants()) >= 5:
                    _FLAT_WALK_ONLY[0] = hwnd
            except Exception:
                pass
            return flat
        return tree if tree else None
    except Exception as e:
        # Diagnosed, not swallowed: the TS client keeps a stderr tail and
        # operators read it when every snapshot comes back empty.
        sys.stderr.write(
            f'[bridge] accessibility_snapshot failed: {type(e).__name__}: {e}\n')
        return None

# ---------------------------------------------------------------------------
# Find edit child (for text input targeting)
# ---------------------------------------------------------------------------
def find_edit_child(hwnd_str):
    """Find the best edit control child using UI Automation."""
    try:
        from pywinauto import Desktop
        hwnd = int(hwnd_str)
        app = Desktop(backend='uia')
        for w in app.windows():
            if w.handle == hwnd:
                # Find first Edit or Document control
                for child in w.descendants():
                    try:
                        ct = child.element_info.control_type
                        if ct in ('Edit', 'Document'):
                            return str(child.handle) if child.handle else None
                    except Exception:
                        continue
                break
    except Exception:
        pass
    return None

# ---------------------------------------------------------------------------
# Element-targeted UIA actions (InvokePattern / ValuePattern)
# ---------------------------------------------------------------------------
def _uia_find_element(win, automation_id):
    """Find a descendant of `win` by exact automation_id (the same semantics
    as the old PowerShell AutomationIdProperty PropertyCondition lookup)."""
    for d in win.descendants():
        try:
            if (d.element_info.automation_id or '') == automation_id:
                return d
        except Exception:
            continue
    return None


# ---------------------------------------------------------------------------
# Element identity: RuntimeId re-resolution (Phase 2.2, Touchpoint tier-4 port)
# ---------------------------------------------------------------------------
# The snapshot in this process is one-shot and stateless: it cannot hand a
# live element pointer to the next call. Instead every snapshot node carries
# its UIA RuntimeId, and the *_id action methods below RE-RESOLVE that id by
# re-walking the bound window with a bounded DFS. Touchpoint's 4-tier chain
# (cache map + liveness probe + ElementFromHandle + bounded DFS) collapses
# into this single walk when there is no cross-call cache to consult.
_RID_DFS_NODE_CAP = 10000  # same bound as Touchpoint's re-resolution walk

# Phase 2.5: walker-break lock (Windows-MCP uia/controls.py port). Some
# providers (Chromium/Electron) answer a one-shot descendants() query but
# return nothing for TreeScope_Children navigation. Once a window proves
# broken that way, the bound hwnd is recorded here and every later snapshot
# of it skips the doomed recursive walk — a one-way, per-hwnd switch.
_FLAT_WALK_ONLY = [None]  # holds an int hwnd or None


def _element_runtime_id(elem):
    """Normalized RuntimeId ([int, ...]) or None when unreadable."""
    try:
        return [int(x) for x in (elem.element_info.runtime_id or [])]
    except Exception:
        return None


def _find_by_runtime_id(win, target_rid):
    """Bounded DFS from `win` matching the element whose RuntimeId equals
    `target_rid`. Walk order mirrors the snapshot walk so the id sequence is
    deterministic. Cyclic-provider guard (Phase 2.3): a child whose RuntimeId
    equals any ANCESTOR's is skipped — Edge <select> providers report
    themselves as their own parent and would recurse forever.
    """
    if not target_rid:
        return None
    target = [int(x) for x in target_rid]
    visited = 0

    def dfs(elem, ancestor_ids):
        nonlocal visited
        visited += 1
        if visited > _RID_DFS_NODE_CAP:
            raise StopIteration  # budget exceeded — abort the whole walk
        rid = _element_runtime_id(elem)
        if rid is not None and rid == target:
            return elem
        if rid is not None and rid in ancestor_ids:
            return None  # cyclic provider: never descend into yourself
        try:
            children = elem.children()
        except Exception:
            return None
        child_ancestors = ancestor_ids + ([rid] if rid else [])
        for c in children:
            found = dfs(c, child_ancestors)
            if found is not None:
                return found
        return None

    try:
        return dfs(win, [])
    except StopIteration:
        return None
    except Exception:
        return None


def _resolve_by_rid(hwnd_str, rid):
    """Resolve the bound window + the element identified by RuntimeId.
    Returns (win, elem) or (None, reason-string)."""
    try:
        hwnd = int(hwnd_str)
    except Exception:
        return None, 'invalid hwnd'
    win = resolve_top_window(hwnd)
    if win is None:
        return None, 'window not found'
    _nudge_suspended_uwp(hwnd, win)
    el = _find_by_runtime_id(win, rid)
    if el is None:
        return None, ('element with RuntimeId %s not found — the UI changed since '
                      'the last snapshot; re-capture accessibility_snapshot' % (rid,))
    return el, None


def _uia_invoke_rid(hwnd_str, rid):
    """InvokePattern.Invoke on the element with the given RuntimeId."""
    el, err = _resolve_by_rid(hwnd_str, rid)
    if el is None:
        sys.stderr.write(f'[bridge] uia_invoke_id failed: {err}\n')
        return False
    try:
        el.iface_invoke.Invoke()
        return True
    except Exception as e:
        sys.stderr.write(f'[bridge] uia_invoke_id: InvokePattern unavailable: {e}\n')
        return False


def _uia_set_value_rid(hwnd_str, rid, value):
    """ValuePattern.SetValue on the element with the given RuntimeId."""
    el, err = _resolve_by_rid(hwnd_str, rid)
    if el is None:
        sys.stderr.write(f'[bridge] uia_set_value_id failed: {err}\n')
        return False
    try:
        el.iface_value.SetValue(str(value))
        return True
    except Exception as e:
        sys.stderr.write(f'[bridge] uia_set_value_id: ValuePattern unavailable: {e}\n')
        return False


# ---------------------------------------------------------------------------
# Pattern interactions (Phase 3.1 — Touchpoint _PATTERN_MAP, the 5 we take)
# ---------------------------------------------------------------------------

def _pattern_act(hwnd_str, rid, act):
    """Run one pattern action on the element with the given RuntimeId.

    act is (attr-name, method-name, args) resolved on a pywinauto wrapper;
    a missing or failing pattern returns False with the reason on stderr
    (diagnosed, not swallowed).
    """
    el, err = _resolve_by_rid(hwnd_str, rid)
    if el is None:
        sys.stderr.write(f'[bridge] pattern action failed: {err}\n')
        return False
    attr, meth, args = act
    try:
        iface = getattr(el, attr)
        getattr(iface, meth)(*args)
        return True
    except AttributeError:
        sys.stderr.write(f'[bridge] pattern action: element has no {attr}\n')
        return False
    except Exception as e:
        sys.stderr.write(f'[bridge] pattern action {attr}.{meth} failed: {e}\n')
        return False


def _pattern_expand(hwnd_str, rid, expand):
    return _pattern_act(hwnd_str, rid, ('iface_expand_collapse',
                                        'Expand' if expand else 'Collapse', ()))


def _pattern_toggle(hwnd_str, rid):
    return _pattern_act(hwnd_str, rid, ('iface_toggle', 'Toggle', ()))


def _pattern_select(hwnd_str, rid):
    return _pattern_act(hwnd_str, rid, ('iface_selection_item', 'Select', ()))


def _pattern_scroll_into_view(hwnd_str, rid):
    return _pattern_act(hwnd_str, rid, ('iface_scroll_item', 'ScrollIntoView', ()))


def _pattern_set_range(hwnd_str, rid, value):
    return _pattern_act(hwnd_str, rid, ('iface_range_value', 'SetValue',
                                        (float(value),)))


def uia_invoke(hwnd_str, automation_id):
    """InvokePattern.Invoke on the descendant with the given automation_id.

    Replaces uiAutomation.ts's title-matched PowerShell clickElement: same
    long-lived process as every other UIA call, hwnd-addressed, no PS cold
    start and no fragile title lookup. Returns False when the window or the
    element cannot be resolved or carries no InvokePattern.
    """
    try:
        hwnd = int(hwnd_str)
        win = resolve_top_window(hwnd)
        if win is None:
            return False
        _nudge_suspended_uwp(hwnd, win)
        el = _uia_find_element(win, automation_id)
        if el is None:
            return False
        el.iface_invoke.Invoke()
        return True
    except Exception:
        return False


def click_element_center(hwnd_str, x, y):
    """Left-click at PHYSICAL screen coords inside the bound window.

    Used by clickElement's rect-center fallback: the accessibility snapshot
    exposes physical BoundingRect coordinates, and with per-monitor-v2 DPI
    active the WM_LBUTTONDOWN lParam must be client-relative PHYSICAL pixels.
    The legacy TS-side conversion (screen minus NC offset) is only correct at
    100% scaling; GetWindowRect/ClientToScreen pair stays physical under
    per-monitor-v2, so dividing the screen-space delta by the window's DPI
    scale would be wrong — instead the NC offset itself is measured here via
    the same physical APIs, keeping the whole chain physical.
    """
    hwnd = int(hwnd_str)
    if not user32.IsWindow(hwnd):
        return False
    wr = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(wr))
    pt = POINT(0, 0)
    user32.ClientToScreen(hwnd, ctypes.byref(pt))
    dx = pt.x - wr.left
    dy = pt.y - wr.top
    lp = make_lparam(int(x) - dx, int(y) - dy)
    SendMessageW(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lp)
    SendMessageW(hwnd, WM_LBUTTONUP, MK_LBUTTON, lp)
    return True


def uia_set_value(hwnd_str, automation_id, value):
    """ValuePattern.SetValue on the descendant with the given automation_id.

    Same rationale as uia_invoke: replaces uiAutomation.ts's title-matched
    PowerShell setValue. Returns False when no element matches or the match
    exposes no ValuePattern (read-only controls raise a COM error -> False).
    """
    try:
        hwnd = int(hwnd_str)
        win = resolve_top_window(hwnd)
        if win is None:
            return False
        _nudge_suspended_uwp(hwnd, win)
        el = _uia_find_element(win, automation_id)
        if el is None:
            return False
        el.iface_value.SetValue(str(value))
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Clipboard paste (for large text)
# ---------------------------------------------------------------------------
def paste_text(hwnd_str, text):
    """Set clipboard + send Ctrl+V via SendMessage."""
    import ctypes
    # Set clipboard
    CF_UNICODETEXT = 13
    user32.OpenClipboard(0)
    user32.EmptyClipboard()
    data = text.encode('utf-16-le') + b'\x00\x00'
    h = kernel32.GlobalAlloc(0x0002, len(data))  # GMEM_MOVEABLE
    ptr = kernel32.GlobalLock(h)
    ctypes.memmove(ptr, data, len(data))
    kernel32.GlobalUnlock(h)
    user32.SetClipboardData(CF_UNICODETEXT, h)
    user32.CloseClipboard()
    # Send Ctrl+V
    send_keys_combo(hwnd_str, ['ctrl', 'v'])
    return True

# ---------------------------------------------------------------------------
# Mouse wheel scroll (WM_MOUSEWHEEL / WM_MOUSEHWHEEL)
# ---------------------------------------------------------------------------
WM_MOUSEWHEEL = 0x020A
WM_MOUSEHWHEEL = 0x020E

# ClientToScreen for screen coords in lParam
user32.ClientToScreen.argtypes = [ctypes.c_void_p, ctypes.POINTER(POINT)]
user32.ClientToScreen.restype = ctypes.c_bool

def send_mouse_wheel(hwnd_str, x, y, delta, horizontal=False):
    """Send mouse wheel scroll at client coordinates (x, y).
    delta: positive = up/right, negative = down/left. In "clicks" (1 click = 120 units).
    """
    hwnd = int(hwnd_str)
    msg = WM_MOUSEHWHEEL if horizontal else WM_MOUSEWHEEL
    wheel_delta = int(delta) * 120
    # Convert client coords to screen coords for lParam
    pt = POINT(int(x), int(y))
    user32.ClientToScreen(hwnd, ctypes.byref(pt))
    # wParam: high word = delta (signed short), low word = modifier keys (0)
    wparam = ctypes.c_void_p(wheel_delta << 16)
    # lParam: screen coords
    lparam = ctypes.c_void_p((pt.y << 16) | (pt.x & 0xFFFF))
    SendMessageW(hwnd, msg, wparam, lparam)
    return True

# ---------------------------------------------------------------------------
# Compact current-state snapshot (G-UIA-3)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Generic structured UI state extraction.
#
# Everything below derives from UIA ControlTypes, patterns and properties
# only — there are deliberately NO application-name checks. The same code
# path serves Win32, WinUI/XAML, UWP, Electron, Chromium, terminal and
# document apps alike. Result fields are omitted when the UIA tree does
# not provide them; values are never fabricated.
# ---------------------------------------------------------------------------

# Dirty-marker suffixes some editors concatenate onto tab/window titles.
_TITLE_DIRTY_SUFFIXES = ('. Modified.', '. Unmodified.')

# UIA property IDs (pywinauto 0.6.9 does not expose them as constants)
_UIA_IS_SELECTED = 30022   # SelectionItemPattern.IsSelected
_UIA_EXPAND_STATE = 30051  # ExpandCollapsePattern.ExpandCollapseState

# Roles surfaced in the flat `actionable` target list.
_ACTIONABLE_ROLES = {'Button', 'TabItem', 'MenuItem', 'ListItem', 'CheckBox',
                     'RadioButton', 'Hyperlink', 'ComboBox', 'Edit', 'SplitButton',
                     'DataGrid', 'Calendar'}

# Single source of truth for "interactive" control types. Both the recursive
# walk (accessibility_snapshot) and the flat fallback (snapshot_flat_fallback)
# previously carried their own disagreeing literals; they must agree because
# a control clickable through one path but invisible to the other silently
# breaks click_element targeting.
INTERACTIVE_ROLES = {'Button', 'Edit', 'ComboBox', 'CheckBox', 'RadioButton',
                     'MenuItem', 'Menu', 'MenuBar', 'Hyperlink', 'Slider',
                     'Tab', 'TabItem', 'List', 'ListItem', 'Document',
                     'TreeItem', 'DataItem', 'ToolBar', 'SplitButton',
                     # Legacy/structural interactive types the pre-bridge
                     # PowerShell walker also surfaced. Without them a
                     # ScrollBar-heavy legacy app or a bare Tree/Spinner
                     # reported nothing until an interactive descendant
                     # existed beneath it.
                     'DataGrid', 'ScrollBar', 'Tree', 'Spinner',
                     'ToggleButton',
                     # Date pickers are clickable interactive surfaces.
                     'Calendar'}

_UIA_IS_OFFSCREEN = 30007  # IsOffscreen (UIA property id, not in pywinauto 0.6.9)

# RuntimeId property (UIA_RuntimeIdPropertyId) — element identity, Phase 2.2.
# Read raw like IsOffscreen because pywinauto 0.6.9 does not expose it either.
_UIA_RUNTIME_ID = 30000

# Per-monitor-v2 DPI awareness for the bridge process (Phase 2.4). The value
# is DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2; declared as a raw context
# handle because user32.SetProcessDpiAwarenessContext has no ctypes wart.
_DPI_CONTEXT_PER_MONITOR_AWARE_V2 = -4
user32.GetDpiForWindow = getattr(user32, 'GetDpiForWindow', None)
if user32.GetDpiForWindow is not None:
    user32.GetDpiForWindow.restype = ctypes.c_uint
    user32.GetDpiForWindow.argtypes = [ctypes.c_void_p]


def _window_scale(hwnd):
    """Physical→logical scale for the given window's monitor (96 dpi = 1.0).

    GetDpiForWindow needs Windows 10 1607+; on older systems GetDpiForSystem
    is tried, then a neutral 1.0. Only used by the rect-center click fallback
    below — elsewhere coordinates are already physical and consistent.
    """
    try:
        dpi = (user32.GetDpiForWindow(hwnd) if user32.GetDpiForWindow
               else user32.GetDpiForSystem())
        if dpi and dpi > 0:
            return dpi / 96.0
    except Exception:
        pass
    return 1.0


def _is_offscreen(elem):
    """IsOffscreen via the raw UIA property, guarded per element.

    Marked, never filtered: for a screenshot-driven agent "this tab exists
    but is scrolled out of view" is the actionable fact. A failed read must
    not kill the node (the zero-size filter remains the hard gate), so this
    catches broadly by design.
    """
    try:
        return bool(elem.element_info._element.GetCurrentPropertyValue(_UIA_IS_OFFSCREEN))
    except Exception:
        return False


def _repair_strings(obj):
    """Replace lone UTF-16 surrogates and private-use characters with U+FFFD.

    json.dumps escapes a lone surrogate into the response line and a
    downstream JSON parser then rejects the WHOLE response — one emoji in a
    window title would kill every bridge call. Repairing at the response
    boundary is cheaper than losing the call. PUA codepoints render as
    nothing useful to the model and are repaired alongside.
    """
    if isinstance(obj, str):
        out = []
        for ch in obj:
            cp = ord(ch)
            if 0xD800 <= cp <= 0xDFFF or 0xE000 <= cp <= 0xF8FF:
                out.append('\ufffd')
            else:
                out.append(ch)
        return ''.join(out)
    if isinstance(obj, dict):
        return {k: _repair_strings(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_repair_strings(v) for v in obj]
    return obj


def _strip_dirty_suffix(name):
    for suffix in _TITLE_DIRTY_SUFFIXES:
        if name.endswith(suffix):
            return name[:-len(suffix)]
    return name


def _is_selected(elem):
    """SelectionItemPattern.IsSelected via the raw UIA property."""
    try:
        return bool(elem.element_info._element.GetCurrentPropertyValue(_UIA_IS_SELECTED))
    except Exception:
        return False


def _expand_state(elem):
    """ExpandCollapsePattern.ExpandCollapseState (0=collapsed, 1=expanded)."""
    try:
        return int(elem.iface_expand_collapse.CurrentExpandCollapseState)
    except Exception:
        pass
    try:
        return int(elem.element_info._element.GetCurrentPropertyValue(_UIA_EXPAND_STATE))
    except Exception:
        return None


def _is_focused(elem):
    try:
        return bool(elem.has_keyboard_focus())
    except Exception:
        return False


def _rect_ok(elem):
    """True when the element reports a non-degenerate bounding rect."""
    try:
        r = elem.rectangle()
        return r.width() > 0 and r.height() > 0
    except Exception:
        return False


def extract_tabs(scan):
    """Tab strip state from TabItems (SelectionItemPattern), with a
    SelectionPattern container fallback for hosts that don't enumerate
    individual TabItems or don't set IsSelected on them."""
    items = [{'title': _strip_dirty_suffix(t['name']), 'selected': t['selected']}
             for t in scan['tab_items'][:30]]
    selected_names = [t['name'] for t in scan['tab_items'][:30] if t['selected']]
    if not selected_names:
        # Chromium/Electron set IsSelected=False on every TabItem but expose
        # the active tab through the Tab container's SelectionPattern.
        root = scan['tabs_root']
        if root is not None:
            try:
                sel = root.iface_selection.GetCurrentSelection()
                if sel and sel.Length:
                    for i in range(min(sel.Length, 10)):
                        try:
                            nm = sel.GetElement(i).CurrentName or ''
                            if nm:
                                selected_names.append(nm)
                        except Exception:
                            pass
            except Exception:
                pass
    if items and selected_names:
        # Pass 1 — exact normalized match only. UIA commonly reports several
        # TabItems as IsSelected=True (multi-select quirk on tab controls),
        # so the per-tab flag alone over-marks. Substring matching makes
        # this worse: short titles ("system_prompt = (") are contained in
        # many other titles. Exact matches are trustworthy as-is.
        exact = False
        for it in items:
            it['selected'] = _names_match(it['title'], selected_names,
                                          exact_only=True)
            if it['selected']:
                exact = True
        # Pass 2 — only when nothing matched exactly: allow containment,
        # but elect a single winner (the longest overlap with a selected
        # name) instead of marking every overlapping item.
        if not exact:
            import re as _re2
            norm = lambda s: _re2.sub(r'\s+', ' ', (s or '')).strip().lower()
            best_item = None
            best_overlap = 0
            for it in items:
                t = norm(it['title'])
                if not t:
                    continue
                for cn_raw in selected_names:
                    cn = norm(_strip_dirty_suffix(cn_raw))
                    if not cn:
                        continue
                    if t == cn or t in cn or cn in t:
                        overlap = min(len(t), len(cn))
                        if overlap > best_overlap:
                            best_overlap = overlap
                            best_item = it
            if best_item is not None:
                for it in items:
                    it['selected'] = it is best_item
    if items:
        selected_index = next((i for i, t in enumerate(items) if t['selected']), None)
        return {'tabCount': len(items), 'selectedTabIndex': selected_index, 'tabs': items}
    root = scan['tabs_root']
    if root is not None:
        try:
            sel = root.iface_selection.GetCurrentSelection()
            if sel and sel.Length:
                # GetCurrentSelection returns only the selected elements, so
                # every name here is genuinely selected.
                names = []
                for i in range(min(sel.Length, 30)):
                    try:
                        names.append(_strip_dirty_suffix(sel.GetElement(i).CurrentName or ''))
                    except Exception:
                        pass
                if names:
                    return {'tabCount': len(names), 'selectedTabIndex': 0,
                            'tabs': [{'title': n, 'selected': True} for n in names]}
        except Exception:
            pass
    return None


def _names_match(title, candidates, exact_only=False):
    """True when `title` equals (or, unless `exact_only`, overlaps) one of
    `candidates' after whitespace normalization.

    With exact_only=False this predicate is per-item and may match several
    candidates: UIA truncates long tab titles, so containment is the only
    way to bridge a truncated TabItem name to its full container-selection
    name. Callers that need a single selected tab must run an exact pass
    first and fall back to containment with their own winner election.
    """
    import re as _re
    norm = lambda s: _re.sub(r'\s+', ' ', (s or '').strip()).lower()
    t = norm(title)
    if not t:
        return False
    for c in candidates:
        cn = norm(_strip_dirty_suffix(c))
        if not cn:
            continue
        if t == cn:
            return True
        if not exact_only and (t in cn or cn in t):
            return True
    return False


def extract_inputs(scan):
    """Edit/ComboBox fields with current value, focus and enabled state."""
    out = []
    for entry in scan['inputs'][:12]:
        d = entry['el']
        value = None
        try:
            value = d.get_value()
        except Exception:
            pass
        try:
            enabled = d.is_enabled()
        except Exception:
            enabled = True
        out.append({
            'name': entry['name'],
            'id': entry['id'],
            'value': (str(value)[:200] if value else ''),
            'focused': _is_focused(d),
            'enabled': enabled,
        })
    return out or None


def extract_selection(scan):
    """Currently selected list/tree items (SelectionItemPattern.IsSelected)."""
    out = []
    for d in scan['list_items'] + scan['tree_items']:
        if len(out) >= 20:
            break
        if d['selected'] and d['name']:
            out.append({'name': d['name'], 'role': d['role']})
    return out or None


def extract_treeview(scan):
    """Tree items with expand/collapse state (ExpandCollapsePattern)."""
    out = []
    for d in scan['tree_items'][:30]:
        entry = {'name': d['name']}
        if d['expand'] is not None:
            entry['expanded'] = (d['expand'] == 1)
        out.append(entry)
    return out or None


def extract_menus(scan):
    """Menu bars, menus, menu items and toolbars visible in the window."""
    out = [{'name': d['name'], 'role': d['role'], 'id': d['id']}
           for d in scan['menus'][:20] if d['name'] or d['id']]
    return out or None


def extract_buttons(scan):
    """Named buttons with enabled state (InvokePattern carriers)."""
    out = [{'name': d['name'], 'id': d['id'], 'enabled': d['enabled']}
           for d in scan['buttons'][:30]]
    return out or None


def extract_document(scan):
    """Document text state: content, selection, caret, character count."""
    doc = scan['document']
    if doc is None:
        return None
    out = {}
    try:
        tp = doc.iface_text
        if tp is not None:
            txt = tp.DocumentRange.GetText(2000) or ''
            if txt:
                out['text'] = txt
            sel = tp.GetSelection()
            if sel and sel.Length:
                try:
                    sel_text = sel.GetElement(0).GetText(500)
                    if sel_text:
                        out['selection'] = sel_text
                except Exception:
                    pass
    except Exception:
        pass
    if scan['caretLine'] is not None:
        out['caretLine'] = scan['caretLine']
    if scan['caretColumn'] is not None:
        out['caretColumn'] = scan['caretColumn']
    if scan['characterCount'] is not None:
        out['characterCount'] = scan['characterCount']
    return out or None


def extract_status_bar(scan):
    return list(scan['status_blocks']) if scan['status_blocks'] else None


def _parse_status_fields(scan):
    """Derive caret position, character count, encoding, line endings and
    file type from status-bar text fields. Purely string-shape driven."""
    import re as _re

    for s in scan['status_blocks']:
        sl = s.lower().replace('\n', ' ')
        if 'line' in sl and 'col' in sl and scan['caretLine'] is None:
            try:
                parts = s.replace('\n', ' ').split(',')
                scan['caretLine'] = int(parts[0].strip().split()[-1])
                if len(parts) > 1:
                    scan['caretColumn'] = int(parts[1].strip().split()[-1])
            except Exception:
                pass
        sst = s.strip()
        if not sst or '\n' in s:
            continue
        low = sst.lower()
        m = _re.match(r'^(\d+)\s+characters?$', sst, _re.IGNORECASE)
        if m and scan['characterCount'] is None:
            scan['characterCount'] = int(m.group(1))
            continue
        if low.startswith('utf-') or low in ('ansi', 'unicode'):
            if 'encoding' not in scan:
                scan['encoding'] = sst
            continue
        if low in ('windows (crlf)', 'unix (lf)', 'mac (cr)'):
            if 'lineEndings' not in scan:
                scan['lineEndings'] = sst
            continue
        if 'plain text' in low or 'rich text' in low or low.endswith(' text'):
            if 'fileType' not in scan:
                scan['fileType'] = sst
            continue


def _scan_elements(win):
    """ONE descendants() pass classifying every element the extractors need."""
    scan = {
        'document': None, 'tabs_root': None, 'tab_items': [], 'inputs': [],
        'list_items': [], 'tree_items': [], 'menus': [], 'buttons': [],
        'status_blocks': [], 'actionable': [],
        'caretLine': None, 'caretColumn': None, 'characterCount': None,
    }
    _bound_pid = int(win.process_id())

    def _belongs(elem):
        try:
            pid = elem.element_info.process_id
            return pid is None or int(pid) == _bound_pid
        except Exception:
            return True

    for d in win.descendants():
        if not _belongs(d):
            continue
        try:
            ct = d.element_info.control_type
        except Exception:
            continue
        try:
            name = d.element_info.name or ''
            auto_id = d.element_info.automation_id or ''
        except Exception:
            name, auto_id = '', ''

        # Flat actionable target list (bounded): any interactive role with a
        # name or automationId and a non-degenerate rect.
        if ct in _ACTIONABLE_ROLES and (name or auto_id) and len(scan['actionable']) < 60:
            try:
                r = d.rectangle()
                if r.width() > 0 and r.height() > 0:
                    scan['actionable'].append({
                        'name': name, 'role': ct, 'id': auto_id,
                        'rect': {'x': r.left, 'y': r.top,
                                 'w': r.width(), 'h': r.height()},
                        'center': [r.left + r.width() // 2, r.top + r.height() // 2],
                    })
            except Exception:
                pass

        try:
            if ct == 'Document':
                if scan['document'] is None and _rect_ok(d):
                    scan['document'] = d
            elif ct == 'Tab':
                if scan['tabs_root'] is None:
                    scan['tabs_root'] = d
            elif ct == 'TabItem':
                scan['tab_items'].append({'name': name, 'selected': _is_selected(d)})
            elif ct in ('Edit', 'ComboBox'):
                if len(scan['inputs']) < 12 and _rect_ok(d):
                    scan['inputs'].append({'el': d, 'name': name, 'id': auto_id})
            elif ct == 'ListItem':
                scan['list_items'].append({'name': name, 'role': ct,
                                           'selected': _is_selected(d)})
            elif ct == 'TreeItem':
                scan['tree_items'].append({'name': name, 'role': ct,
                                           'selected': _is_selected(d),
                                           'expand': _expand_state(d)})
            elif ct in ('MenuItem', 'Menu', 'MenuBar', 'ToolBar'):
                scan['menus'].append({'name': name, 'role': ct, 'id': auto_id})
            elif ct == 'Button' and name and _rect_ok(d):
                try:
                    enabled = d.is_enabled()
                except Exception:
                    enabled = True
                scan['buttons'].append({'name': name, 'id': auto_id, 'enabled': enabled})
        except Exception:
            continue

        if auto_id == 'ContentTextBlock' and name:
            scan['status_blocks'].append(name)
        elif ct == 'StatusBar':
            try:
                for c in d.children():
                    cn = (c.element_info.name or '').strip()
                    if cn:
                        scan['status_blocks'].append(cn)
            except Exception:
                pass
    return scan


def get_current_state(hwnd_str):
    """Return the bound window's generic structured UI state.

    Built entirely from UIA ControlTypes and patterns — no application-name
    checks anywhere. Field groups (tabs, inputs, selectedItems, treeItems,
    menus, buttons, document, statusBar) are omitted when the UIA tree does
    not expose them.
    """
    out = {'hwnd': int(hwnd_str)}
    try:
        from pywinauto import Desktop
        hwnd = int(hwnd_str)
        win = resolve_top_window(hwnd)
        if win is None:
            out['error'] = 'window not found'
            return out
        _nudge_suspended_uwp(hwnd, win)

        out['title'] = win.element_info.name or ''
        out['class'] = win.class_name() or ''
        try:
            r = win.rectangle()
            if r.width() > 0 and r.height() > 0:
                out['rect'] = {'left': r.left, 'top': r.top,
                               'width': r.width(), 'height': r.height()}
        except Exception:
            pass
        if 'rect' not in out:
            # Offscreen-bound windows (parked at -32000) report a zero-size
            # UIA rect; Win32 GetWindowRect still knows the real geometry.
            wr = get_window_rect(hwnd_str)
            if wr:
                out['rect'] = {'left': wr['x'], 'top': wr['y'],
                               'width': wr['width'], 'height': wr['height']}
        if 'rect' in out and (out['rect'].get('left', 0) <= -30000
                              or out['rect'].get('top', 0) <= -30000):
            out['offscreen'] = True

        scan = _scan_elements(win)
        _parse_status_fields(scan)

        for key, val in (
            ('tabs', extract_tabs(scan)),
            ('inputs', extract_inputs(scan)),
            ('selectedItems', extract_selection(scan)),
            ('treeItems', extract_treeview(scan)),
            ('menus', extract_menus(scan)),
            ('buttons', extract_buttons(scan)),
            ('document', extract_document(scan)),
            ('statusBar', extract_status_bar(scan)),
        ):
            if val:
                out[key] = val

        for key in ('encoding', 'lineEndings', 'fileType'):
            if key in scan:
                out[key] = scan[key]

        # Dirty-marker: a leading '*' in the title is the conventional
        # unsaved-changes signal (UIA has no cross-app modified property).
        out['modified'] = (out.get('title') or '').lstrip().startswith('*')

        if scan['actionable']:
            out['actionable'] = scan['actionable']

        try:
            out['minimized'] = bool(user32.IsIconic(hwnd))
        except Exception:
            pass

        # Logical focus (G-UIA-4): derived from selection state, never from
        # UIA.GetFocusedElement (which reports the user's foreground app and
        # is wrong for a bound offscreen window).
        focus = {}
        tabs = out.get('tabs')
        if tabs and tabs.get('selectedTabIndex') is not None:
            sel_items = tabs.get('tabs') or []
            idx = tabs['selectedTabIndex']
            if 0 <= idx < len(sel_items):
                focus['tab'] = sel_items[idx]['title']
        doc = out.get('document') or {}
        if doc.get('selection'):
            focus['selection'] = doc['selection']
        if doc.get('caretLine') is not None:
            focus['position'] = {'line': doc['caretLine'],
                                 'column': doc.get('caretColumn')}
        if focus:
            out['logicalFocus'] = focus
    except Exception as e:
        out['error'] = str(e)
    return out


METHODS = {
    'screenshot': lambda p: screenshot_full(p.get('display_id', 0)),
    'screenshot_window': lambda p: screenshot_window(p['hwnd']),
    'list_windows': lambda p: list_windows(),
    'get_window_rect': lambda p: get_window_rect(p['hwnd']),
    'get_window_state': lambda p: get_window_state(p['hwnd']),
    'get_client_offset': lambda p: get_client_offset(p['hwnd']),
    'manage_window': lambda p: manage_window(p['hwnd'], p['action']),
    'send_click': lambda p: send_click(p['hwnd'], p['x'], p['y'], p.get('button', 'left'), p.get('modifiers')),
    'send_multi_click': lambda p: send_multi_click(p['hwnd'], p['x'], p['y'], p.get('button', 'left'), int(p.get('count', 1)), p.get('modifiers')),
    'send_text': lambda p: send_text(p['hwnd'], p['text']),
    'send_key': lambda p: send_key(p['hwnd'], p['vk'], p.get('action', 'down')),
    'send_keys': lambda p: send_keys_combo(p['hwnd'], p['keys']),
    'send_key_chord': lambda p: send_key_chord(p['hwnd'], p['keys']),
    'send_mouse_down': lambda p: send_mouse_down(p['hwnd'], p['x'], p['y']),
    'send_mouse_up': lambda p: send_mouse_up(p['hwnd'], p['x'], p['y']),
    'send_mouse_move': lambda p: send_mouse_move(p['hwnd'], p['x'], p['y']),
    'paste_text': lambda p: paste_text(p['hwnd'], p['text']),
    'send_mouse_wheel': lambda p: send_mouse_wheel(p['hwnd'], p['x'], p['y'], p['delta'], p.get('horizontal', False)),
    'find_edit_child': lambda p: find_edit_child(p['hwnd']),
    'uia_invoke': lambda p: uia_invoke(p['hwnd'], p['automation_id']),
    'uia_set_value': lambda p: uia_set_value(p['hwnd'], p['automation_id'], p.get('value', '')),
    # RuntimeId-targeted actions (Phase 2.2/3.1). rid = list of ints from a
    # snapshot node's `rid` field.
    'uia_invoke_id': lambda p: _uia_invoke_rid(p['hwnd'], p.get('rid')),
    'uia_set_value_id': lambda p: _uia_set_value_rid(p['hwnd'], p.get('rid'), p.get('value', '')),
    'expand_id': lambda p: _pattern_expand(p['hwnd'], p.get('rid'), bool(p.get('expand', True))),
    'toggle_id': lambda p: _pattern_toggle(p['hwnd'], p.get('rid')),
    'select_id': lambda p: _pattern_select(p['hwnd'], p.get('rid')),
    'scroll_into_view_id': lambda p: _pattern_scroll_into_view(p['hwnd'], p.get('rid')),
    'set_range_id': lambda p: _pattern_set_range(p['hwnd'], p.get('rid'), p.get('value', 0)),
    'click_element_center': lambda p: click_element_center(p['hwnd'], p['x'], p['y']),
    'accessibility_snapshot': lambda p: accessibility_snapshot(p['hwnd'], p.get('max_depth', 6)),
    'get_current_state': lambda p: get_current_state(p['hwnd']),
    'ping': lambda p: {'ok': True, 'pid': os.getpid()},
}

def _init_com():
    """Initialize the COM apartment for this thread (STA) before any UIA work.

    Without an explicit init, comtypes initializes lazily and a nested STA/MTA
    mismatch surfaces later as RPC_E_CHANGED_MODE — which every bare except
    on the walk path then swallowed as "no data". RPC_E_CHANGED_MODE here is
    benign (already initialized in another model) and is deliberately not an
    error. Runs once, at process start, before the dispatch loop.
    """
    # Phase 2.4: per-monitor-v2 DPI awareness BEFORE any UIA/window call.
    # Without it GetWindowRect/ClientToScreen are virtualized on scaled
    # monitors and every physical coordinate read is a lie. E_NOTIMPL /
    # already-set contexts are benign.
    try:
        hr = user32.SetProcessDpiAwarenessContext(
            ctypes.c_void_p(_DPI_CONTEXT_PER_MONITOR_AWARE_V2))
        if not hr:
            # Fallback for pre-1607 Windows: per-monitor v1, then system-aware.
            try:
                ctypes.windll.shcore.SetProcessDpiAwareness(2)
            except Exception:
                try:
                    user32.SetProcessDPIAware()
                except Exception:
                    pass
    except Exception:
        pass
    try:
        import pythoncom
        pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
    except ImportError:
        # pythoncom ships with pywin32; comtypes brings its own CoInitialize.
        try:
            import comtypes
            comtypes.CoInitializeEx(comtypes.COINIT_APARTMENTTHREADED)
        except Exception:
            pass
    except Exception:
        # RPC_E_CHANGED_MODE = already initialized with the other model — fine.
        pass


def main():
    """Main loop: read JSON lines from stdin, dispatch, write JSON lines to stdout."""
    _init_com()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get('id', 0)
            method = req.get('method', '')
            params = req.get('params', {})

            if method not in METHODS:
                resp = {'id': req_id, 'error': f'unknown method: {method}'}
            else:
                try:
                    result = METHODS[method](params)
                    # Surrogate/PUA repair at the response boundary: a lone
                    # surrogate in any result string would otherwise produce
                    # a response line the TS JSON parser rejects wholesale.
                    resp = {'id': req_id, 'result': _repair_strings(result)}
                except Exception as e:
                    resp = {'id': req_id, 'error': str(e)}

            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + '\n')
            sys.stdout.flush()
        except json.JSONDecodeError as e:
            sys.stdout.write(json.dumps({'id': 0, 'error': f'invalid JSON: {e}'}) + '\n')
            sys.stdout.flush()

if __name__ == '__main__':
    main()
