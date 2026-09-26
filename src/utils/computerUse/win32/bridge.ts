/**
 * TypeScript Bridge for Windows Computer Use.
 * Same JSON-line stdin/stdout protocol as the original Python bridge — same method
 * names/params, same capabilities. Long-lived process, no per-call subprocess spawning.
 *
 * Capabilities:
 *   - screenshot: full-screen or per-window (raw GDI capture, no external screenshot lib)
 *   - input: mouse click/move/drag, keyboard type/key (direct Win32 user32 calls via FFI)
 *   - windows: enumerate, find, get rect, manage (show/min/max/close)
 *   - accessibility: UI Automation tree snapshot (raw COM, via manual vtable calls)
 *
 * Protocol: one JSON object per line on stdin -> one JSON object per line on stdout.
 *   Request:  {"id": 1, "method": "screenshot", "params": {...}}
 *   Response: {"id": 1, "result": {...}}  or  {"id": 1, "error": "message"}
 *
 * ---------------------------------------------------------------------------
 * REQUIRED PACKAGES (this is the only file — install these two, nothing else):
 *   npm install koffi sharp
 *   npm install -D typescript @types/node
 * Run with: npx tsx bridge.ts   (or: tsc bridge.ts && node bridge.js)
 * Windows-only, same as the original (uses user32/gdi32/kernel32/ole32/oleaut32).
 *
 * NOTE ON THE ACCESSIBILITY SECTION:
 * accessibility_snapshot / find_edit_child talk to UI Automation directly over raw
 * COM (there is no maintained, install-and-go npm equivalent of pywinauto/comtypes).
 * The vtable slot numbers below are transcribed from the published UIAutomationClient
 * IDL and are consistent with widely-used raw-COM UIA samples, but — unlike every
 * other function in this file — they could not be exercised on a live Windows box
 * while writing this port. Every COM call is wrapped in try/catch and fails soft to
 * null/undefined, exactly like the except-blocks around these two functions in the
 * Python original, so a slot mismatch degrades this one feature rather than crashing
 * the bridge. If you hit an issue specifically here, it's the first place to look.
 * ---------------------------------------------------------------------------
 */

import koffi from 'koffi';
import sharp from 'sharp';
import * as readline from 'node:readline';

// =============================================================================
// Library loading
// =============================================================================
const user32 = koffi.load('user32.dll');
const gdi32 = koffi.load('gdi32.dll');
const kernel32 = koffi.load('kernel32.dll');
const ole32 = koffi.load('ole32.dll');
const oleaut32 = koffi.load('oleaut32.dll');

// =============================================================================
// Common type aliases
// Handles / pointers are carried as plain 64-bit integers throughout (rather than
// koffi "pointer" objects). On x64 a pointer occupies the same register/stack slot
// as a uint64_t, so this round-trips perfectly and lets us pass HWNDs that arrive
// as JSON strings straight into any Win32 call without manual pointer construction.
// =============================================================================
koffi.alias('HANDLE', 'uint64_t');
koffi.alias('HWND', 'uint64_t');
koffi.alias('HDC', 'uint64_t');
koffi.alias('HBITMAP', 'uint64_t');
koffi.alias('HGDIOBJ', 'uint64_t');
koffi.alias('HMONITOR', 'uint64_t');
koffi.alias('HMODULE', 'uint64_t');
koffi.alias('WPARAM', 'uint64_t');
koffi.alias('LPARAM', 'uint64_t');
koffi.alias('LRESULT', 'uint64_t');
koffi.alias('DWORD', 'uint32_t');
koffi.alias('BOOL', 'int32_t');
koffi.alias('UINT', 'uint32_t');
koffi.alias('LONG', 'int32_t');

const RECT = koffi.struct('RECT', {
  left: 'int32_t',
  top: 'int32_t',
  right: 'int32_t',
  bottom: 'int32_t',
});

const POINT = koffi.struct('POINT', {
  x: 'int32_t',
  y: 'int32_t',
});

const BITMAPINFOHEADER = koffi.struct('BITMAPINFOHEADER', {
  biSize: 'uint32_t',
  biWidth: 'int32_t',
  biHeight: 'int32_t',
  biPlanes: 'uint16_t',
  biBitCount: 'uint16_t',
  biCompression: 'uint32_t',
  biSizeImage: 'uint32_t',
  biXPelsPerMeter: 'int32_t',
  biYPelsPerMeter: 'int32_t',
  biClrUsed: 'uint32_t',
  biClrImportant: 'uint32_t',
});

// ---------------------------------------------------------------------------
// Win32 constants & types
// ---------------------------------------------------------------------------
const WM_CHAR = 0x0102;
const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const WM_CLOSE = 0x0010;
const WM_LBUTTONDOWN = 0x0201;
const WM_LBUTTONUP = 0x0202;
const WM_RBUTTONDOWN = 0x0204;
const WM_RBUTTONUP = 0x0205;
const WM_MOUSEMOVE = 0x0200;
const WM_MOUSEWHEEL = 0x020a;
const WM_MOUSEHWHEEL = 0x020e;

const SW_MINIMIZE = 6;
const SW_MAXIMIZE = 3;
const SW_RESTORE = 9;
const SW_SHOWMINNOACTIVE = 7;
const SW_SHOWNOACTIVATE = 4;

const SWP_NOSIZE = 0x0001;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;

const SRCCOPY = 0x00cc0020;
const CF_UNICODETEXT = 13;
const GMEM_MOVEABLE = 0x0002;

// ---------------------------------------------------------------------------
// Function bindings
// ---------------------------------------------------------------------------
const GetDC = user32.func('HDC __stdcall GetDC(HWND hWnd)');
const ReleaseDC = user32.func('int __stdcall ReleaseDC(HWND hWnd, HDC hDC)');
const GetWindowRect = user32.func('BOOL __stdcall GetWindowRect(HWND hWnd, _Out_ RECT *lpRect)');
const ClientToScreen = user32.func('BOOL __stdcall ClientToScreen(HWND hWnd, _Inout_ POINT *lpPoint)');
const IsWindow = user32.func('BOOL __stdcall IsWindow(HWND hWnd)');
const IsIconic = user32.func('BOOL __stdcall IsIconic(HWND hWnd)');
const ShowWindow = user32.func('BOOL __stdcall ShowWindow(HWND hWnd, int nCmdShow)');
const SetForegroundWindow = user32.func('BOOL __stdcall SetForegroundWindow(HWND hWnd)');
const SetWindowPos = user32.func(
  'BOOL __stdcall SetWindowPos(HWND hWnd, HWND hWndInsertAfter, int X, int Y, int cx, int cy, UINT uFlags)'
);
const IsWindowVisible = user32.func('BOOL __stdcall IsWindowVisible(HWND hWnd)');
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(HWND hWnd)');
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(HWND hWnd, _Out_ uint16_t *lpString, int nMaxCount)');
const GetWindowThreadProcessId = user32.func(
  'DWORD __stdcall GetWindowThreadProcessId(HWND hWnd, _Out_ DWORD *lpdwProcessId)'
);

const EnumWindowsProc = koffi.proto('BOOL __stdcall EnumWindowsProc(HWND hwnd, LPARAM lParam)');
const EnumWindows = user32.func('BOOL __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, LPARAM lParam)');

const MonitorEnumProc = koffi.proto(
  'BOOL __stdcall MonitorEnumProc(HMONITOR hMonitor, HDC hdcMonitor, RECT *lprcMonitor, LPARAM dwData)'
);
const EnumDisplayMonitors = user32.func(
  'BOOL __stdcall EnumDisplayMonitors(HDC hdc, const RECT *lprcClip, MonitorEnumProc *lpfnEnum, LPARAM dwData)'
);
const GetSystemMetrics = user32.func('int __stdcall GetSystemMetrics(int nIndex)');
const SM_XVIRTUALSCREEN = 76;
const SM_YVIRTUALSCREEN = 77;
const SM_CXVIRTUALSCREEN = 78;
const SM_CYVIRTUALSCREEN = 79;

const SendMessageW = user32.func('LRESULT __stdcall SendMessageW(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam)');

const CreateCompatibleDC = gdi32.func('HDC __stdcall CreateCompatibleDC(HDC hdc)');
const CreateCompatibleBitmap = gdi32.func('HBITMAP __stdcall CreateCompatibleBitmap(HDC hdc, int cx, int cy)');
const SelectObject = gdi32.func('HGDIOBJ __stdcall SelectObject(HDC hdc, HGDIOBJ h)');
const DeleteObject = gdi32.func('BOOL __stdcall DeleteObject(HGDIOBJ ho)');
const DeleteDC = gdi32.func('BOOL __stdcall DeleteDC(HDC hdc)');
const BitBlt = gdi32.func(
  'BOOL __stdcall BitBlt(HDC hdc, int x, int y, int cx, int cy, HDC hdcSrc, int x1, int y1, DWORD rop)'
);
const GetDIBits = gdi32.func(
  'int __stdcall GetDIBits(HDC hdc, HBITMAP hbm, UINT start, UINT lines, _Out_ uint8_t *lpvBits, _Inout_ BITMAPINFOHEADER *lpbmi, UINT usage)'
);
const PrintWindow = user32.func('BOOL __stdcall PrintWindow(HWND hwnd, HDC hdcBlt, UINT nFlags)');

const OpenClipboard = user32.func('BOOL __stdcall OpenClipboard(HWND hWndNewOwner)');
const EmptyClipboard = user32.func('BOOL __stdcall EmptyClipboard()');
const SetClipboardData = user32.func('HANDLE __stdcall SetClipboardData(UINT uFormat, HANDLE hMem)');
const CloseClipboard = user32.func('BOOL __stdcall CloseClipboard()');

const GlobalAlloc = kernel32.func('HANDLE __stdcall GlobalAlloc(UINT uFlags, size_t dwBytes)');
const GlobalLock = kernel32.func('uint64_t __stdcall GlobalLock(HANDLE hMem)');
const GlobalUnlock = kernel32.func('BOOL __stdcall GlobalUnlock(HANDLE hMem)');

// COM (used only by the accessibility section below)
const CoInitializeEx = ole32.func('int32_t __stdcall CoInitializeEx(void *pvReserved, uint32_t dwCoInit)');
const CoCreateInstance = ole32.func(
  'int32_t __stdcall CoCreateInstance(const GUID *rclsid, uint64_t pUnkOuter, uint32_t dwClsContext, const GUID *riid, _Out_ uint64_t *ppv)'
);
const SysFreeString = oleaut32.func('void __stdcall SysFreeString(uint64_t bstr)');

const GUID = koffi.struct('GUID', {
  Data1: 'uint32_t',
  Data2: 'uint16_t',
  Data3: 'uint16_t',
  Data4: koffi.array('uint8_t', 8),
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function toHandle(hwndStr: string | number | bigint): bigint {
  // Mirrors Python's int(hwnd_str) — hwnd is always passed through the JSON
  // protocol as a decimal string. Using BigInt (not Number) avoids any precision
  // loss for the full 64-bit range, exactly matching Python's arbitrary-precision int.
  if (typeof hwndStr === 'bigint') return hwndStr;
  if (typeof hwndStr === 'number') return BigInt(Math.trunc(hwndStr));
  return BigInt(hwndStr);
}

function makeLParam(x: number, y: number): number {
  return ((y & 0xffff) << 16) | (x & 0xffff);
}

// ---------------------------------------------------------------------------
// Screenshot
// ---------------------------------------------------------------------------

/** Swap B<->R and drop the padding/alpha byte: BGRA/BGRX raw buffer -> RGB buffer. */
function bgrxToRgb(buf: Buffer, width: number, height: number): Buffer {
  const out = Buffer.allocUnsafe(width * height * 3);
  const pixels = width * height;
  for (let i = 0; i < pixels; i++) {
    const s = i * 4;
    const d = i * 3;
    out[d] = buf[s + 2]; // R
    out[d + 1] = buf[s + 1]; // G
    out[d + 2] = buf[s]; // B
  }
  return out;
}

interface MonitorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function enumerateMonitors(): MonitorRect[] {
  const monitors: MonitorRect[] = [];
  const cb = (_hMonitor: number | bigint, _hdcMonitor: number | bigint, lprcMonitor: any, _dwData: number | bigint) => {
    monitors.push({
      left: lprcMonitor.left,
      top: lprcMonitor.top,
      right: lprcMonitor.right,
      bottom: lprcMonitor.bottom,
    });
    return 1;
  };
  EnumDisplayMonitors(0, null, cb, 0);
  return monitors;
}

async function screenshotFull(displayId = 0): Promise<{ base64: string; width: number; height: number }> {
  // monitors[0] mirrors mss's "all monitors combined" virtual-screen entry;
  // monitors[1..] are the individual physical monitors.
  const vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
  const vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
  const virtualScreen: MonitorRect = {
    left: vx,
    top: vy,
    right: vx + GetSystemMetrics(SM_CXVIRTUALSCREEN),
    bottom: vy + GetSystemMetrics(SM_CYVIRTUALSCREEN),
  };
  const physical = enumerateMonitors();
  const monitors = [virtualScreen, ...physical];

  const monitor = displayId < monitors.length - 1 ? monitors[displayId + 1] : monitors[1] ?? monitors[0];
  const x = monitor.left;
  const y = monitor.top;
  const w = monitor.right - monitor.left;
  const h = monitor.bottom - monitor.top;

  const hdcScreen = GetDC(0);
  let hdcMem = 0;
  let hbm = 0;
  try {
    hdcMem = CreateCompatibleDC(hdcScreen);
    hbm = CreateCompatibleBitmap(hdcScreen, w, h);
    SelectObject(hdcMem, hbm);
    BitBlt(hdcMem, 0, 0, w, h, hdcScreen, x, y, SRCCOPY);

    const pixelBuf = Buffer.alloc(w * h * 4);
    const bmi = {
      biSize: koffi.sizeof(BITMAPINFOHEADER),
      biWidth: w,
      biHeight: -h, // top-down
      biPlanes: 1,
      biBitCount: 32,
      biCompression: 0, // BI_RGB
      biSizeImage: 0,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0,
    };
    GetDIBits(hdcMem, hbm, 0, h, pixelBuf, bmi, 0);

    const rgb = bgrxToRgb(pixelBuf, w, h);
    const jpeg = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 75 }).toBuffer();

    return { base64: jpeg.toString('base64'), width: w, height: h };
  } finally {
    // Always release GDI resources, even if GetDIBits or JPEG encoding throws —
    // otherwise a failed screenshot would leak a DC/bitmap on every retry.
    if (hbm) DeleteObject(hbm);
    if (hdcMem) DeleteDC(hdcMem);
    ReleaseDC(0, hdcScreen);
  }
}

async function screenshotWindow(
  hwndStr: string
): Promise<{ base64: string; width: number; height: number } | null> {
  const hwnd = toHandle(hwndStr);
  if (!IsWindow(hwnd)) return null;

  const rect: any = {};
  GetWindowRect(hwnd, rect);
  let w = rect.right - rect.left;
  let h = rect.bottom - rect.top;
  if (w <= 0 || h <= 0) return null;

  const wasMinimized = IsIconic(hwnd);
  if (wasMinimized) {
    ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    await new Promise((r) => setTimeout(r, 100));
    const rect2: any = {};
    GetWindowRect(hwnd, rect2);
    w = rect2.right - rect2.left;
    h = rect2.bottom - rect2.top;
  }

  const hdcWindow = GetDC(hwnd);
  let hdcMem = 0;
  let hbm = 0;
  try {
    hdcMem = CreateCompatibleDC(hdcWindow);
    hbm = CreateCompatibleBitmap(hdcWindow, w, h);
    SelectObject(hdcMem, hbm);

    const result = PrintWindow(hwnd, hdcMem, 2); // PW_RENDERFULLCONTENT
    if (!result) {
      BitBlt(hdcMem, 0, 0, w, h, hdcWindow, 0, 0, SRCCOPY);
    }

    const pixelBuf = Buffer.alloc(w * h * 4);
    const bmi = {
      biSize: koffi.sizeof(BITMAPINFOHEADER),
      biWidth: w,
      biHeight: -h,
      biPlanes: 1,
      biBitCount: 32,
      biCompression: 0,
      biSizeImage: 0,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0,
    };
    GetDIBits(hdcMem, hbm, 0, h, pixelBuf, bmi, 0);

    const rgb = bgrxToRgb(pixelBuf, w, h);
    const jpeg = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 75 }).toBuffer();

    return { base64: jpeg.toString('base64'), width: w, height: h };
  } finally {
    if (hbm) DeleteObject(hbm);
    if (hdcMem) DeleteDC(hdcMem);
    ReleaseDC(hwnd, hdcWindow);
    if (wasMinimized) {
      ShowWindow(hwnd, SW_SHOWMINNOACTIVE);
    }
  }
}

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------
interface WindowInfo {
  hwnd: string;
  pid: number;
  title: string;
}

function listWindows(): WindowInfo[] {
  const windows: WindowInfo[] = [];
  const cb = (hwnd: number | bigint, _lParam: number | bigint) => {
    try {
      if (IsWindowVisible(hwnd)) {
        const length = GetWindowTextLengthW(hwnd);
        if (length > 0) {
          const buf = Buffer.alloc((length + 1) * 2);
          GetWindowTextW(hwnd, buf, length + 1);
          const title = buf.toString('utf16le').replace(/\0.*$/, '');
          const pidOut = [0];
          GetWindowThreadProcessId(hwnd, pidOut);
          windows.push({ hwnd: String(hwnd), pid: pidOut[0], title });
        }
      }
    } catch {
      // Skip this window rather than aborting the whole enumeration — a single
      // uncooperative window (e.g. one that vanishes mid-enumeration) shouldn't
      // take down list_windows for every other window.
    }
    return 1;
  };
  EnumWindows(cb, 0);
  return windows;
}

function getWindowRect(hwndStr: string): { x: number; y: number; width: number; height: number } | null {
  const hwnd = toHandle(hwndStr);
  const rect: any = {};
  if (GetWindowRect(hwnd, rect)) {
    return { x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top };
  }
  return null;
}

function getClientOffset(hwndStr: string): { dx: number; dy: number } {
  const hwnd = toHandle(hwndStr);
  const wr: any = {};
  GetWindowRect(hwnd, wr);
  const pt: any = { x: 0, y: 0 };
  ClientToScreen(hwnd, pt);
  return { dx: pt.x - wr.left, dy: pt.y - wr.top };
}

function manageWindow(hwndStr: string, action: string): boolean {
  const hwnd = toHandle(hwndStr);
  switch (action) {
    case 'minimize':
      return !!ShowWindow(hwnd, SW_SHOWMINNOACTIVE);
    case 'maximize':
      return !!ShowWindow(hwnd, SW_MAXIMIZE);
    case 'restore':
      return !!ShowWindow(hwnd, SW_RESTORE);
    case 'close':
      SendMessageW(hwnd, WM_CLOSE, 0, 0);
      return true;
    case 'focus':
      if (IsIconic(hwnd)) {
        ShowWindow(hwnd, SW_RESTORE);
      }
      SetForegroundWindow(hwnd);
      return true;
    case 'move_offscreen':
      SetWindowPos(hwnd, 0, -32000, -32000, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Input — all via SendMessageW (window-targeted, no global)
// ---------------------------------------------------------------------------
function sendClick(hwndStr: string, x: number, y: number, button = 'left'): boolean {
  const hwnd = toHandle(hwndStr);
  const lp = makeLParam(x, y);
  if (button === 'left') {
    SendMessageW(hwnd, WM_LBUTTONDOWN, 0, lp);
    SendMessageW(hwnd, WM_LBUTTONUP, 0, lp);
  } else if (button === 'right') {
    SendMessageW(hwnd, WM_RBUTTONDOWN, 0, lp);
    SendMessageW(hwnd, WM_RBUTTONUP, 0, lp);
  }
  return true;
}

function sendText(hwndStr: string, text: string): boolean {
  // JS strings are already UTF-16 code units, so iterating charCodeAt() sends
  // surrogate halves individually — the same effect as the manual surrogate-pair
  // splitting in the Python version, with no extra codepoint math needed.
  const hwnd = toHandle(hwndStr);
  for (let i = 0; i < text.length; i++) {
    SendMessageW(hwnd, WM_CHAR, text.charCodeAt(i), 0);
  }
  return true;
}

function sendKey(hwndStr: string, vk: number, action = 'down'): boolean {
  const hwnd = toHandle(hwndStr);
  const msg = action === 'down' ? WM_KEYDOWN : WM_KEYUP;
  SendMessageW(hwnd, msg, vk, 0);
  return true;
}

const VK: Record<string, number> = {
  ctrl: 0x11,
  control: 0x11,
  shift: 0x10,
  alt: 0x12,
  enter: 0x0d,
  return: 0x0d,
  tab: 0x09,
  escape: 0x1b,
  backspace: 0x08,
  delete: 0x2e,
  space: 0x20,
  left: 0x25,
  up: 0x26,
  right: 0x27,
  down: 0x28,
  home: 0x24,
  end: 0x23,
  pageup: 0x21,
  pagedown: 0x22,
  f1: 0x70,
  f2: 0x71,
  f3: 0x72,
  f4: 0x73,
  f5: 0x74,
  f6: 0x75,
  f7: 0x76,
  f8: 0x77,
  f9: 0x78,
  f10: 0x79,
  f11: 0x7a,
  f12: 0x7b,
};
const MODIFIERS = new Set(['ctrl', 'control', 'shift', 'alt']);

function sendKeysCombo(hwndStr: string, keys: string[]): boolean {
  const hwnd = toHandle(hwndStr);
  const mods: number[] = [];
  let mainKey: number | null = null;
  for (const k of keys) {
    const kl = k.toLowerCase();
    if (MODIFIERS.has(kl)) {
      mods.push(VK[kl] ?? 0);
    } else if (kl in VK) {
      mainKey = VK[kl];
    } else if (kl.length === 1) {
      mainKey = kl.toUpperCase().charCodeAt(0);
    }
  }
  if (mainKey === null) return false;
  for (const m of mods) SendMessageW(hwnd, WM_KEYDOWN, m, 0);
  SendMessageW(hwnd, WM_KEYDOWN, mainKey, 0);
  SendMessageW(hwnd, WM_KEYUP, mainKey, 0);
  for (const m of [...mods].reverse()) SendMessageW(hwnd, WM_KEYUP, m, 0);
  return true;
}

function sendMouseDown(hwndStr: string, x: number, y: number): boolean {
  const hwnd = toHandle(hwndStr);
  SendMessageW(hwnd, WM_LBUTTONDOWN, 0, makeLParam(x, y));
  return true;
}

function sendMouseUp(hwndStr: string, x: number, y: number): boolean {
  const hwnd = toHandle(hwndStr);
  SendMessageW(hwnd, WM_LBUTTONUP, 0, makeLParam(x, y));
  return true;
}

function sendMouseMove(hwndStr: string, x: number, y: number): boolean {
  const hwnd = toHandle(hwndStr);
  SendMessageW(hwnd, WM_MOUSEMOVE, 0, makeLParam(x, y));
  return true;
}

// ---------------------------------------------------------------------------
// Mouse wheel scroll (WM_MOUSEWHEEL / WM_MOUSEHWHEEL)
// ---------------------------------------------------------------------------
function sendMouseWheel(hwndStr: string, x: number, y: number, delta: number, horizontal = false): boolean {
  const hwnd = toHandle(hwndStr);
  const msg = horizontal ? WM_MOUSEHWHEEL : WM_MOUSEWHEEL;
  const wheelDelta = Math.trunc(delta) * 120;
  const pt: any = { x: Math.trunc(x), y: Math.trunc(y) };
  ClientToScreen(hwnd, pt);
  const wparam = (wheelDelta & 0xffff) << 16; // high word = delta, low word = modifiers (0)
  const lparam = ((pt.y & 0xffff) << 16) | (pt.x & 0xffff);
  SendMessageW(hwnd, msg, wparam >>> 0, lparam >>> 0);
  return true;
}

// ---------------------------------------------------------------------------
// Clipboard paste (for large text)
// ---------------------------------------------------------------------------
function pasteText(hwndStr: string, text: string): boolean {
  OpenClipboard(0);
  try {
    EmptyClipboard();
    const byteLen = Buffer.byteLength(text, 'utf16le') + 2; // + null terminator
    const hMem = GlobalAlloc(GMEM_MOVEABLE, byteLen);
    if (!hMem) return false;
    const ptr = GlobalLock(hMem);
    if (!ptr) return false;
    try {
      koffi.encode(ptr, 'str16', text);
    } finally {
      GlobalUnlock(hMem);
    }
    SetClipboardData(CF_UNICODETEXT, hMem);
  } finally {
    CloseClipboard();
  }
  sendKeysCombo(hwndStr, ['ctrl', 'v']);
  return true;
}

// ---------------------------------------------------------------------------
// Accessibility snapshot (UI Automation via raw COM) — see the file-level note
// at the top for the caveats specific to this section.
// ---------------------------------------------------------------------------
const CLSID_CUIAutomation = 'FF48DBA4-60EF-4201-AA87-54103EEF594E';
const IID_IUIAutomation = '30CBE57D-D9D0-452A-AB13-7AC5AC4825EE';
const CLSCTX_INPROC_SERVER = 1;
const TreeScope_Children = 2;

function guidToStruct(guid: string) {
  const hex = guid.replace(/-/g, '');
  const Data1 = parseInt(hex.slice(0, 8), 16);
  const Data2 = parseInt(hex.slice(8, 12), 16);
  const Data3 = parseInt(hex.slice(12, 16), 16);
  const Data4: number[] = [];
  for (let i = 16; i < 32; i += 2) Data4.push(parseInt(hex.slice(i, i + 2), 16));
  return { Data1, Data2, Data3, Data4 };
}

// Vtable slots (IUnknown occupies 0-2 on every interface).
const SLOT = {
  IUIAutomation_ElementFromHandle: 6,
  IUIAutomation_CreateTrueCondition: 21,
  IUIAutomationElement_FindAll: 6,
  IUIAutomationElement_GetCurrentPropertyValue: 10,
  IUIAutomationElement_get_CurrentControlType: 21,
  IUIAutomationElement_get_CurrentName: 23,
  IUIAutomationElement_get_CurrentIsEnabled: 28,
  IUIAutomationElement_get_CurrentAutomationId: 29,
  IUIAutomationElement_get_CurrentBoundingRectangle: 43,
  IUIAutomationElement_get_CurrentNativeWindowHandle: 36,
  IUIAutomationElementArray_get_Length: 3,
  IUIAutomationElementArray_GetElement: 4,
};

const UIA_ValueValuePropertyId = 30045;

// One-arg-out call shape: HRESULT Method(self, uint64_t* out)
const CALL_OUT_PTR = koffi.proto('int32_t CallOutPtr(uint64_t self, _Out_ uint64_t *out)');
const CALL_OUT_I32 = koffi.proto('int32_t CallOutI32(uint64_t self, _Out_ int32_t *out)');
const CALL_TWO_ARG_OUT_PTR = koffi.proto('int32_t CallTwoArgOutPtr(uint64_t self, int32_t a, uint64_t b, _Out_ uint64_t *out)');
const CALL_INT_OUT_I32 = koffi.proto('int32_t CallIntOutI32(uint64_t self, int32_t idx, _Out_ uint64_t *out)');
const CALL_OUT_RECT = koffi.proto('int32_t CallOutRect(uint64_t self, _Out_ double out[4])');
const CALL_OUT_VARIANT = koffi.proto('int32_t CallOutVariant(uint64_t self, int32_t propId, _Out_ uint8_t out[16])');
const CALL_RELEASE = koffi.proto('uint32_t CallRelease(uint64_t self)');

function vtableFn(self: bigint | number, slot: number): bigint {
  const vtable = koffi.decode(BigInt(self), 'void *') as unknown as bigint;
  return koffi.decode(vtable, slot * 8, 'void *') as unknown as bigint;
}

function comCallOutPtr(self: bigint, slot: number): bigint | null {
  const fn = vtableFn(self, slot);
  const out = [0n];
  const hr = koffi.call(fn, CALL_OUT_PTR, self, out);
  return hr === 0 ? BigInt(out[0]) : null;
}

function comCallOutI32(self: bigint, slot: number): number | null {
  const fn = vtableFn(self, slot);
  const out = [0];
  const hr = koffi.call(fn, CALL_OUT_I32, self, out);
  return hr === 0 ? out[0] : null;
}

function comRelease(self: bigint) {
  try {
    const fn = vtableFn(self, 2);
    koffi.call(fn, CALL_RELEASE, self);
  } catch {
    /* best-effort cleanup */
  }
}

function bstrToStringAndFree(bstr: bigint | null): string {
  if (!bstr || bstr === 0n) return '';
  try {
    const s = koffi.decode(bstr, 'str16') as unknown as string;
    SysFreeString(bstr);
    return s ?? '';
  } catch {
    return '';
  }
}

const CONTROL_TYPE_NAMES: Record<number, string> = {
  50000: 'Button',
  50002: 'CheckBox',
  50003: 'ComboBox',
  50004: 'Edit',
  50005: 'Hyperlink',
  50006: 'Image',
  50007: 'ListItem',
  50008: 'List',
  50009: 'Menu',
  50010: 'MenuBar',
  50011: 'MenuItem',
  50012: 'ProgressBar',
  50013: 'RadioButton',
  50014: 'ScrollBar',
  50015: 'Slider',
  50016: 'Spinner',
  50017: 'StatusBar',
  50018: 'Tab',
  50019: 'TabItem',
  50020: 'Text',
  50021: 'ToolBar',
  50022: 'ToolTip',
  50023: 'Tree',
  50024: 'TreeItem',
  50025: 'Custom',
  50026: 'Group',
  50027: 'Thumb',
  50028: 'DataGrid',
  50029: 'DataItem',
  50030: 'Document',
  50031: 'SplitButton',
  50032: 'Window',
  50033: 'Pane',
  50034: 'Header',
  50035: 'HeaderItem',
  50036: 'Table',
  50037: 'TitleBar',
  50038: 'Separator',
};

const INTERACTIVE = new Set([
  'Button', 'Edit', 'ComboBox', 'CheckBox', 'RadioButton',
  'MenuItem', 'Menu', 'MenuBar', 'Hyperlink', 'Slider',
  'Tab', 'TabItem', 'List', 'ListItem', 'Document',
  'TreeItem', 'DataItem', 'ToolBar', 'SplitButton',
]);

let comInitialized = false;
let uiAutomationPtr: bigint | null = null;

function ensureCom(): void {
  if (!comInitialized) {
    CoInitializeEx(null, 2); // COINIT_APARTMENTTHREADED
    comInitialized = true;
  }
}

function getUiAutomation(): bigint | null {
  ensureCom();
  if (uiAutomationPtr) return uiAutomationPtr;
  const clsid = guidToStruct(CLSID_CUIAutomation);
  const iid = guidToStruct(IID_IUIAutomation);
  const out = [0n];
  const hr = CoCreateInstance(clsid, 0, CLSCTX_INPROC_SERVER, iid, out);
  if (hr !== 0 || !out[0]) return null;
  uiAutomationPtr = BigInt(out[0]);
  return uiAutomationPtr;
}

interface AccessibilityNode {
  role: string;
  name: string;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
  v?: string;
  c?: AccessibilityNode[];
}

function elementFindAllChildren(elementPtr: bigint, uia: bigint): bigint[] {
  const conditionPtr = comCallOutPtr(uia, SLOT.IUIAutomation_CreateTrueCondition);
  if (!conditionPtr) return [];
  try {
    const fn = vtableFn(elementPtr, SLOT.IUIAutomationElement_FindAll);
    const out = [0n];
    const hr = koffi.call(fn, CALL_TWO_ARG_OUT_PTR, elementPtr, TreeScope_Children, conditionPtr, out);
    if (hr !== 0 || !out[0]) return [];
    const arrayPtr = BigInt(out[0]);
    const length = comCallOutI32(arrayPtr, SLOT.IUIAutomationElementArray_get_Length) ?? 0;
    const children: bigint[] = [];
    for (let i = 0; i < length; i++) {
      const fn2 = vtableFn(arrayPtr, SLOT.IUIAutomationElementArray_GetElement);
      const childOut = [0n];
      const hr2 = koffi.call(fn2, CALL_INT_OUT_I32, arrayPtr, i, childOut);
      if (hr2 === 0 && childOut[0]) children.push(BigInt(childOut[0]));
    }
    comRelease(arrayPtr);
    return children;
  } finally {
    comRelease(conditionPtr);
  }
}

function elementBoundingRect(elementPtr: bigint): { x: number; y: number; w: number; h: number } | null {
  try {
    const fn = vtableFn(elementPtr, SLOT.IUIAutomationElement_get_CurrentBoundingRectangle);
    const out = [0, 0, 0, 0];
    const hr = koffi.call(fn, CALL_OUT_RECT, elementPtr, out);
    if (hr !== 0) return null;
    return { x: out[0], y: out[1], w: out[2], h: out[3] };
  } catch {
    return null;
  }
}

function elementValue(elementPtr: bigint): string | undefined {
  try {
    const fn = vtableFn(elementPtr, SLOT.IUIAutomationElement_GetCurrentPropertyValue);
    const out = new Array(16).fill(0);
    const hr = koffi.call(fn, CALL_OUT_VARIANT, elementPtr, UIA_ValueValuePropertyId, out);
    if (hr !== 0) return undefined;
    const vt = out[0] | (out[1] << 8);
    if (vt !== 8 /* VT_BSTR */) return undefined;
    const dataBuf = Buffer.from(out.slice(8, 16));
    const bstr = dataBuf.readBigUInt64LE(0);
    const s = bstrToStringAndFree(bstr);
    return s ? s.slice(0, 100) : undefined;
  } catch {
    return undefined;
  }
}

function walkElement(elementPtr: bigint, uia: bigint, depth: number, maxDepth: number): AccessibilityNode[] {
  if (depth >= maxDepth) return [];
  const nodes: AccessibilityNode[] = [];
  let children: bigint[];
  try {
    children = elementFindAllChildren(elementPtr, uia);
  } catch {
    return [];
  }
  for (const child of children) {
    try {
      const controlTypeId = comCallOutI32(child, SLOT.IUIAutomationElement_get_CurrentControlType) ?? 0;
      const role = CONTROL_TYPE_NAMES[controlTypeId] ?? '';
      const nameBstr = comCallOutPtr(child, SLOT.IUIAutomationElement_get_CurrentName);
      const name = bstrToStringAndFree(nameBstr);
      const idBstr = comCallOutPtr(child, SLOT.IUIAutomationElement_get_CurrentAutomationId);
      const autoId = bstrToStringAndFree(idBstr);
      const rect = elementBoundingRect(child);
      if (!rect || rect.w <= 0 || rect.h <= 0 || rect.x < -10000) {
        // NOTE: do not release `child` here — the `finally` below already
        // releases it on every exit path (including `continue`). Releasing
        // it twice would double-decrement its COM refcount.
        continue;
      }
      const enabled = (comCallOutI32(child, SLOT.IUIAutomationElement_get_CurrentIsEnabled) ?? 0) !== 0;
      const value = elementValue(child);
      const sub = walkElement(child, uia, depth + 1, maxDepth);
      if (INTERACTIVE.has(role) || sub.length) {
        const node: AccessibilityNode = {
          role, name, id: autoId,
          x: rect.x, y: rect.y, w: rect.w, h: rect.h,
          on: enabled,
        };
        if (value) node.v = value;
        if (sub.length) node.c = sub;
        nodes.push(node);
      }
    } catch {
      /* skip this child, matches Python's per-child except-continue */
    } finally {
      comRelease(child);
    }
  }
  return nodes;
}

function accessibilitySnapshot(hwndStr: string, maxDepth = 4): AccessibilityNode[] | null {
  try {
    const uia = getUiAutomation();
    if (!uia) return null;
    const hwnd = toHandle(hwndStr);
    const rootPtr = comCallTwoArgHandleOut(uia, SLOT.IUIAutomation_ElementFromHandle, hwnd);
    if (!rootPtr) return null;
    try {
      const tree = walkElement(rootPtr, uia, 0, maxDepth);
      return tree.length ? tree : null;
    } finally {
      comRelease(rootPtr);
    }
  } catch {
    return null;
  }
}

// HRESULT Method(self, uint64_t handleArg, uint64_t* out) — used for ElementFromHandle
const CALL_HANDLE_OUT_PTR = koffi.proto('int32_t CallHandleOutPtr(uint64_t self, uint64_t handleArg, _Out_ uint64_t *out)');
function comCallTwoArgHandleOut(self: bigint, slot: number, handleArg: bigint): bigint | null {
  const fn = vtableFn(self, slot);
  const out = [0n];
  const hr = koffi.call(fn, CALL_HANDLE_OUT_PTR, self, handleArg, out);
  return hr === 0 ? BigInt(out[0]) : null;
}

// ---------------------------------------------------------------------------
// Find edit child (for text input targeting)
// ---------------------------------------------------------------------------
function findEditChildRecursive(elementPtr: bigint, uia: bigint, depth: number): string | null {
  if (depth > 8) return null; // safety bound, Python walks unbounded but this is defensive
  let children: bigint[];
  try {
    children = elementFindAllChildren(elementPtr, uia);
  } catch {
    return null;
  }
  for (const child of children) {
    try {
      const controlTypeId = comCallOutI32(child, SLOT.IUIAutomationElement_get_CurrentControlType) ?? 0;
      if (controlTypeId === 50004 /* Edit */ || controlTypeId === 50030 /* Document */) {
        const hwnd = comCallOutI32(child, SLOT.IUIAutomationElement_get_CurrentNativeWindowHandle);
        if (hwnd) {
          return String(hwnd);
        }
      }
      const found = findEditChildRecursive(child, uia, depth + 1);
      if (found) {
        return found;
      }
    } catch {
      /* continue scanning siblings */
    } finally {
      // Single release point for every exit path (normal fallthrough, both
      // early returns above, and the catch) — avoids double-releasing `child`.
      comRelease(child);
    }
  }
  return null;
}

function findEditChild(hwndStr: string): string | null {
  try {
    const uia = getUiAutomation();
    if (!uia) return null;
    const hwnd = toHandle(hwndStr);
    const rootPtr = comCallTwoArgHandleOut(uia, SLOT.IUIAutomation_ElementFromHandle, hwnd);
    if (!rootPtr) return null;
    try {
      return findEditChildRecursive(rootPtr, uia, 0);
    } finally {
      comRelease(rootPtr);
    }
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
type Params = Record<string, any>;
type MethodFn = (p: Params) => any;

const METHODS: Record<string, MethodFn> = {
  screenshot: (p) => screenshotFull(p.display_id ?? 0),
  screenshot_window: (p) => screenshotWindow(p.hwnd),
  list_windows: (_p) => listWindows(),
  get_window_rect: (p) => getWindowRect(p.hwnd),
  get_client_offset: (p) => getClientOffset(p.hwnd),
  manage_window: (p) => manageWindow(p.hwnd, p.action),
  send_click: (p) => sendClick(p.hwnd, p.x, p.y, p.button ?? 'left'),
  send_text: (p) => sendText(p.hwnd, p.text),
  send_key: (p) => sendKey(p.hwnd, p.vk, p.action ?? 'down'),
  send_keys: (p) => sendKeysCombo(p.hwnd, p.keys),
  send_mouse_down: (p) => sendMouseDown(p.hwnd, p.x, p.y),
  send_mouse_up: (p) => sendMouseUp(p.hwnd, p.x, p.y),
  send_mouse_move: (p) => sendMouseMove(p.hwnd, p.x, p.y),
  paste_text: (p) => pasteText(p.hwnd, p.text),
  send_mouse_wheel: (p) => sendMouseWheel(p.hwnd, p.x, p.y, p.delta, p.horizontal ?? false),
  find_edit_child: (p) => findEditChild(p.hwnd),
  accessibility_snapshot: (p) => accessibilitySnapshot(p.hwnd, p.max_depth ?? 4),
  ping: (_p) => ({ ok: true, pid: process.pid }),
};

// ---------------------------------------------------------------------------
// Main loop: read JSON lines from stdin, dispatch, write JSON lines to stdout.
// ---------------------------------------------------------------------------
async function handleLine(rawLine: string): Promise<void> {
  const line = rawLine.trim();
  if (!line) return;

  let req: any;
  try {
    req = JSON.parse(line);
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ id: 0, error: `invalid JSON: ${e.message}` }) + '\n');
    return;
  }

  const reqId = req.id ?? 0;
  const method: string = req.method ?? '';
  const params: Params = req.params ?? {};

  if (!(method in METHODS)) {
    process.stdout.write(JSON.stringify({ id: reqId, error: `unknown method: ${method}` }) + '\n');
    return;
  }

  try {
    const result = await METHODS[method](params);
    process.stdout.write(JSON.stringify({ id: reqId, result: result ?? null }) + '\n');
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ id: reqId, error: String(e?.message ?? e) }) + '\n');
  }
}

function main(): void {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  // Requests are chained strictly one-after-another (never processed concurrently).
  // This reproduces Python's `for line in sys.stdin` behavior, which blocks on each
  // request until its response is written before the next line is even read — so a
  // slow request (e.g. a screenshot) can never be overtaken by a faster one queued
  // behind it, and responses always come out in the same order requests arrived.
  let queue: Promise<void> = Promise.resolve();

  rl.on('line', (rawLine) => {
    queue = queue.then(() => handleLine(rawLine));
  });
}

main();
