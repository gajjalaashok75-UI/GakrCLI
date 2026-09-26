/**
 * Window enumeration using Win32 EnumWindows API.
 * Returns visible windows with their HWND, PID, and title.
 */

import { bunSpawnSync } from '../bunCompat.js'

export interface WindowInfo {
  hwnd: string
  pid: number
  title: string
}

const ENUM_WINDOWS_PS = `
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class WinEnum {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    public static List<string> results = new List<string>();

    public static void Run() {
        results.Clear();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            if (!IsWindowVisible(hWnd)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len == 0) return true;
            StringBuilder sb = new StringBuilder(len + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();
            if (string.IsNullOrWhiteSpace(title)) return true;
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            results.Add(hWnd.ToInt64() + "|" + pid + "|" + title);
            return true;
        }, IntPtr.Zero);
    }
}
'@
[WinEnum]::Run()
[WinEnum]::results | ForEach-Object { $_ }
`

const PROCESS_IMAGE_PS = (pid: number) => `
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class CuProcImage {
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder sb, ref uint size);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool CloseHandle(IntPtr h);
    public static string Get(uint pid) {
        // PROCESS_QUERY_LIMITED_INFORMATION (0x1000) is granted for
        // higher-integrity processes too, unlike PROCESS_QUERY_INFORMATION.
        IntPtr h = OpenProcess(0x1000, false, pid);
        if (h == IntPtr.Zero) return "";
        try {
            uint size = 1024;
            StringBuilder sb = new StringBuilder((int)size);
            if (!QueryFullProcessImageName(h, 0, sb, ref size)) return "";
            return sb.ToString();
        } finally { CloseHandle(h); }
    }
}
'@
[CuProcImage]::Get(${pid})
`

/**
 * Full executable path of a PID, or null when it can't be read (elevated
 * process without rights, exited process). This is the authorization identity
 * for bound windows: unlike a window title, it cannot be set by page content.
 */
// Deliberately uncached. An exe path is stable for a process's lifetime, but a
// PID can be recycled, so a cached entry could authorize a *different* process
// after the original exits. Authorization correctness is worth the extra
// PowerShell spawn, which is the same order of cost as the window enumeration
// this already performs.
export function getProcessImagePath(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null
  try {
    const result = bunSpawnSync({
      cmd: [
        'powershell',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        PROCESS_IMAGE_PS(pid),
      ],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const raw = new TextDecoder().decode(result.stdout).trim()
    return raw || null
  } catch {
    return null
  }
}

/**
 * List all visible windows with non-empty titles.
 * Returns HWND, PID, and window title for each.
 */
export function listWindows(): WindowInfo[] {
  const result = bunSpawnSync({
    cmd: [
      'powershell',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      ENUM_WINDOWS_PS,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const raw = new TextDecoder().decode(result.stdout).trim()
  if (!raw) return []

  return raw
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const trimmed = line.trim()
      const firstPipe = trimmed.indexOf('|')
      const secondPipe = trimmed.indexOf('|', firstPipe + 1)
      if (firstPipe === -1 || secondPipe === -1) return null

      const hwnd = trimmed.slice(0, firstPipe)
      const pid = Number(trimmed.slice(firstPipe + 1, secondPipe))
      const title = trimmed.slice(secondPipe + 1)

      if (!hwnd || isNaN(pid) || !title) return null
      return { hwnd, pid, title }
    })
    .filter((item): item is WindowInfo => item !== null)
}
