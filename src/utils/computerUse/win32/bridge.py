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
WM_RBUTTONDOWN = 0x0204
WM_RBUTTONUP = 0x0205
WM_MOUSEMOVE = 0x0200

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

def send_click(hwnd_str, x, y, button='left'):
    hwnd = int(hwnd_str)
    lp = make_lparam(x, y)
    if button == 'left':
        SendMessageW(hwnd, WM_LBUTTONDOWN, 0, lp)
        SendMessageW(hwnd, WM_LBUTTONUP, 0, lp)
    elif button == 'right':
        SendMessageW(hwnd, WM_RBUTTONDOWN, 0, lp)
        SendMessageW(hwnd, WM_RBUTTONUP, 0, lp)
    return True

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
# Accessibility snapshot (UI Automation via comtypes)
# ---------------------------------------------------------------------------
_uia_client = None

def _get_uia():
    global _uia_client
    if _uia_client is None:
        try:
            import comtypes.client
            comtypes.client.GetModule('UIAutomationCore.dll')
            from comtypes.gen.UIAutomationClient import CUIAutomation
            _uia_client = comtypes.client.CreateObject(CUIAutomation)
        except Exception:
            # Fallback: use pywinauto
            pass
    return _uia_client

def accessibility_snapshot(hwnd_str, max_depth=6):
    """Get the accessibility tree using pywinauto (more reliable than raw comtypes)."""
    try:
        from pywinauto import Desktop
        from pywinauto.controls.uiawrapper import UIAWrapper

        hwnd = int(hwnd_str)
        app = Desktop(backend='uia')
        # Find window by handle
        win = None
        for w in app.windows():
            if w.handle == hwnd:
                win = w
                break
        if win is None:
            return None

        INTERACTIVE = {'Button', 'Edit', 'ComboBox', 'CheckBox', 'RadioButton',
                       'MenuItem', 'Menu', 'MenuBar', 'Hyperlink', 'Slider',
                       'Tab', 'TabItem', 'List', 'ListItem', 'Document',
                       'TreeItem', 'DataItem', 'ToolBar', 'SplitButton'}

        def walk(element, depth):
            if depth >= max_depth:
                return []
            nodes = []
            try:
                children = element.children()
            except Exception:
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
                    # here; visibility is checked separately via ct/name flags.
                    if w <= 0 or h <= 0:
                        continue
                    enabled = child.is_enabled()
                    value = None
                    try:
                        value = child.get_value()
                    except Exception:
                        pass
                    sub = walk(child, depth + 1)
                    if ct in INTERACTIVE or sub:
                        node = {
                            'role': ct, 'name': name, 'id': auto_id,
                            'x': rect.left, 'y': rect.top, 'w': w, 'h': h,
                            'on': enabled,
                        }
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
                                    node['selText'] = ''.join(parts)
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
                except Exception:
                    continue
            return nodes

        tree = walk(win, 0)
        return tree if tree else None
    except Exception as e:
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
def get_current_state(hwnd_str):
    """Return a flat dict describing the bound window's logical state.

    Cheaper than accessibility_snapshot for the common "where is the
    user, what's the document, what's the cursor, what tab is active"
    query pattern. Walks the UIA tree once but only collects targeted
    fields.
    """
    out = {'hwnd': int(hwnd_str)}
    try:
        from pywinauto import Desktop
        hwnd = int(hwnd_str)
        app = Desktop(backend='uia')
        win = None
        for w in app.windows():
            if w.handle == hwnd:
                win = w
                break
        if win is None:
            out['error'] = 'window not found'
            return out

        out['title'] = win.element_info.name or ''
        out['class'] = win.class_name() or ''
        try:
            r = win.rectangle()
            out['rect'] = {'left': r.left, 'top': r.top,
                           'width': r.width(), 'height': r.height()}
        except Exception:
            pass

        # Walk descendants once, find: Document, Tabs (SelectionPattern),
        # TabItems, status bar ContentTextBlocks, modified indicator.
        document = None
        tabs_root = None
        modified = None
        status_blocks = []
        # Track the bound window's PID so we can reject descendants that
        # belong to a different top-level window (pywinauto occasionally
        # surfaces off-subtree elements via UIA virtualization / IME, and
        # top_level_parent() is unreliable for HWND-less UIA elements like
        # Document / TabItem / MenuItem).
        _bound_pid = int(win.process_id())

        def _belongs_to_bound(elem):
            try:
                pid = elem.element_info.process_id
                if pid is None:
                    return True  # UIA didn't report a PID; be permissive
                return int(pid) == _bound_pid
            except Exception:
                return True

        for d in win.descendants():
            # Restrict to the bound window's process. pywinauto can surface
            # elements from sibling top-level windows through UIA
            # virtualization / IME popups, and we don't want to attribute
            # their state to the bound window.
            if not _belongs_to_bound(d):
                continue
            try:
                ct = d.element_info.control_type
            except Exception:
                continue
            if ct == 'Document' and document is None:
                document = d
            elif ct == 'Tab' and tabs_root is None:
                if (d.element_info.automation_id or '') == 'Tabs':
                    tabs_root = d
            elif ct == 'Text':
                nm = d.element_info.name or ''
                if nm and ('Modified' in nm or nm.lower() == 'modified'):
                    modified = nm
            if (d.element_info.automation_id or '') == 'ContentTextBlock':
                nm = d.element_info.name or ''
                if nm:
                    status_blocks.append(nm)

        # Document text + selection + caret
        if document is not None:
            try:
                tp = document.iface_text
                if tp is not None:
                    txt = tp.DocumentRange.GetText(2000) or ''
                    out['documentText'] = txt
                    sel = tp.GetSelection()
                    if sel and sel.Length:
                        try:
                            sel_text = sel.GetElement(0).GetText(500)
                            out['documentSelection'] = sel_text
                        except Exception:
                            pass
            except Exception:
                pass

        # Active tab + tab list
        if tabs_root is not None:
            try:
                sel = tabs_root.iface_selection.GetCurrentSelection()
                if sel and sel.Length:
                    raw = sel.GetElement(0).CurrentName or ''
                    # Notepad concatenates ". Modified." / ". Unmodified."
                    # onto the tab name; strip it so callers get the real name.
                    for suffix in ('. Modified.', '. Unmodified.'):
                        if raw.endswith(suffix):
                            raw = raw[:-len(suffix)]
                            break
                    out['selectedTab'] = raw
            except Exception:
                pass
            tab_names = []
            try:
                for c in tabs_root.children():
                    try:
                        if c.element_info.control_type == 'TabItem':
                            tname = c.element_info.name or ''
                            for suffix in ('. Modified.', '. Unmodified.'):
                                if tname.endswith(suffix):
                                    tname = tname[:-len(suffix)]
                                    break
                            tab_names.append(tname)
                    except Exception:
                        pass
            except Exception:
                pass
            if tab_names:
                out['tabs'] = tab_names

        if modified is not None:
            out['modified'] = 'Modified' in modified
        # Fallback: Notepad doesn't expose a UIA "Modified" Text element;
        # it encodes the dirty marker as a leading "*" in the window title.
        if 'modified' not in out:
            t = (out.get('title') or '').lstrip()
            if t.startswith('*'):
                out['modified'] = True
            elif t:
                out['modified'] = False

        # Caret from status bar "Line X, Column Y"
        for s in status_blocks:
            sl = s.lower().replace('\n', ' ')
            if 'line' in sl and 'col' in sl:
                try:
                    parts = s.replace('\n', ' ').split(',')
                    line_part = parts[0].strip()
                    col_part = parts[1].strip() if len(parts) > 1 else ''
                    out['caretLine'] = int(line_part.split()[-1])
                    out['caretColumn'] = int(col_part.split()[-1])
                except Exception:
                    pass
                break

        # Other status bar fields: character count, encoding, line endings,
        # file type. Notepad emits them as separate ContentTextBlock names.
        for s in status_blocks:
            sl = s.strip()
            if not sl or '\n' in sl:
                # skip multi-line caret+char strings like "Line 1,\nColumn 8"
                continue
            low = sl.lower()
            import re as _re
            m = _re.match(r'^(\d+)\s+characters?$', sl, _re.IGNORECASE)
            if m and 'characterCount' not in out:
                out['characterCount'] = int(m.group(1))
                continue
            if low.startswith('utf-') or low in ('ansi', 'unicode', 'utf-8', 'utf-16'):
                out['encoding'] = sl
                continue
            if low in ('windows (crlf)', 'unix (lf)', 'mac (cr)'):
                out['lineEndings'] = sl
                continue
            if 'plain text' in low or 'rich text' in low or low.endswith(' text'):
                out['fileType'] = sl
                continue

        # Actionable controls: buttons, tabs, menu items, list items with a
        # non-empty name. Same walk as above — collect during the descendant
        # pass to avoid a second tree traversal.
        actionable = []
        interactive_ct = {'Button', 'TabItem', 'MenuItem', 'ListItem',
                          'CheckBox', 'RadioButton', 'Hyperlink', 'ComboBox',
                          'Edit', 'SplitButton'}
        try:
            for d in win.descendants():
                # Same subtree guard as the first walk: keep only elements
                # that belong to the bound window's process.
                if not _belongs_to_bound(d):
                    continue
                # Secondary gate: many UIA-virtualized / HWND-less elements
                # (Documents, TabItems) have no process_id, so the PID check
                # can't authoritatively reject them. A degenerate rect
                # (0×0) is a strong signal that the element isn't a
                # clickable, on-subtree control — drop it.
                try:
                    r = d.rectangle()
                    if r.width() <= 0 or r.height() <= 0:
                        continue
                except Exception:
                    pass
                try:
                    ct = d.element_info.control_type
                    if ct not in interactive_ct:
                        continue
                    nm = d.element_info.name or ''
                    ai = d.element_info.automation_id or ''
                    if not (nm or ai):
                        continue
                    try:
                        rect = d.rectangle()
                        r = {'x': rect.left, 'y': rect.top,
                             'w': rect.width(), 'h': rect.height()}
                        cx = rect.left + rect.width() // 2
                        cy = rect.top + rect.height() // 2
                    except Exception:
                        r = None
                        cx = cy = None
                    actionable.append({
                        'name': nm,
                        'role': ct,
                        'id': ai,
                        'rect': r,
                        'center': [cx, cy] if cx is not None else None,
                    })
                except Exception:
                    continue
        except Exception:
            pass
        if actionable:
            out['actionable'] = actionable

        # Logical focus (G-UIA-4): derive from selectedTab + documentSelection
        # + caretLine/Column, never from UIA.GetFocusedElement (which returns
        # the user's actual foreground app and is wrong for a bound offscreen
        # window).
        focus = {}
        if 'selectedTab' in out:
            focus['tab'] = out['selectedTab']
        if 'documentSelection' in out and out['documentSelection']:
            focus['selection'] = out['documentSelection']
        if 'caretLine' in out:
            focus['position'] = {
                'line': out['caretLine'],
                'column': out['caretColumn'] if 'caretColumn' in out else None,
            }
        if focus:
            out['logicalFocus'] = focus

        # Other status bar fields
        if status_blocks:
            out['statusBar'] = status_blocks
    except Exception as e:
        out['error'] = str(e)
    return out


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
METHODS = {
    'screenshot': lambda p: screenshot_full(p.get('display_id', 0)),
    'screenshot_window': lambda p: screenshot_window(p['hwnd']),
    'list_windows': lambda p: list_windows(),
    'get_window_rect': lambda p: get_window_rect(p['hwnd']),
    'get_window_state': lambda p: get_window_state(p['hwnd']),
    'get_client_offset': lambda p: get_client_offset(p['hwnd']),
    'manage_window': lambda p: manage_window(p['hwnd'], p['action']),
    'send_click': lambda p: send_click(p['hwnd'], p['x'], p['y'], p.get('button', 'left')),
    'send_text': lambda p: send_text(p['hwnd'], p['text']),
    'send_key': lambda p: send_key(p['hwnd'], p['vk'], p.get('action', 'down')),
    'send_keys': lambda p: send_keys_combo(p['hwnd'], p['keys']),
    'send_mouse_down': lambda p: send_mouse_down(p['hwnd'], p['x'], p['y']),
    'send_mouse_up': lambda p: send_mouse_up(p['hwnd'], p['x'], p['y']),
    'send_mouse_move': lambda p: send_mouse_move(p['hwnd'], p['x'], p['y']),
    'paste_text': lambda p: paste_text(p['hwnd'], p['text']),
    'send_mouse_wheel': lambda p: send_mouse_wheel(p['hwnd'], p['x'], p['y'], p['delta'], p.get('horizontal', False)),
    'find_edit_child': lambda p: find_edit_child(p['hwnd']),
    'accessibility_snapshot': lambda p: accessibility_snapshot(p['hwnd'], p.get('max_depth', 6)),
    'get_current_state': lambda p: get_current_state(p['hwnd']),
    'ping': lambda p: {'ok': True, 'pid': os.getpid()},
}

def main():
    """Main loop: read JSON lines from stdin, dispatch, write JSON lines to stdout."""
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
                    resp = {'id': req_id, 'result': result}
                except Exception as e:
                    resp = {'id': req_id, 'error': str(e)}

            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + '\n')
            sys.stdout.flush()
        except json.JSONDecodeError as e:
            sys.stdout.write(json.dumps({'id': 0, 'error': f'invalid JSON: {e}'}) + '\n')
            sys.stdout.flush()

if __name__ == '__main__':
    main()
