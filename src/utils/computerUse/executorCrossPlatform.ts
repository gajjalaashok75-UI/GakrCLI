/**
 * Cross-platform (Windows/Linux) ComputerExecutor implementation.
 *
 * Unlike the macOS executor which uses @ant native modules + drainRunLoop +
 * CGEventTap, this executor delegates everything to src/utils/computerUse/platforms/.
 *
 * All operations go through the platform abstraction:
 * - Input: SendMessage (HWND-bound, no focus steal)
 * - Screenshot: PrintWindow (per-window JPEG)
 * - Display: platform-native enumeration
 * - Apps: platform-native listing/launching
 *
 * No drainRunLoop, no CGEventTap, no pbcopy/pbpaste, no @ant packages.
 *
 * ── Coordinate model (bound-window mode) ─────────────────────────────────
 *
 * When an HWND is bound, screenshots come from PrintWindow (the bound window),
 * NOT from the display. This means:
 *   - Image pixel coords ARE window coords (1:1 after scaleCoord)
 *   - displayWidth/displayHeight are set to the IMAGE dimensions so scaleCoord
 *     returns raw image coords unchanged
 *   - originX/originY are 0 (not the display origin)
 *   - For clicks, we subtract the non-client area offset (title bar + border)
 *     so WM_LBUTTONDOWN receives client-relative coords
 */

import { bunSpawn, bunSpawnSync } from './bunCompat.js'

import type {
  ComputerExecutor,
  DisplayGeometry,
  FrontmostApp,
  InstalledApp,
  ResolvePrepareCaptureResult,
  RunningApp,
  ScreenshotResult,
} from '@ant/computer-use-mcp'

import { logForDebugging } from '../debug.js'
import { sleep } from '../sleep.js'
import {
  bridgeToAccessibilityNodes,
  formatForModel,
  type BridgeUiaNode,
} from './win32/bridgeUia.js'
import { CLI_CU_CAPABILITIES, CLI_HOST_BUNDLE_ID } from './common.js'
import { validateHwnd } from './win32/shared.js'
import { loadPlatform } from './platforms/index.js'

// ---------------------------------------------------------------------------
// Helpers for HWND-bound mode
// ---------------------------------------------------------------------------

/** Get the bound HWND string, or null */
function getBoundHwndStr(): string | null {
  if (process.platform !== 'win32') return null
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    return getBoundHwnd()
  } catch {
    return null
  }
}

/** Check if we're in HWND-bound mode (Windows only) */
function isBound(): boolean {
  return getBoundHwndStr() !== null
}

/**
 * Get the non-client area offset (title bar height, left border width).
 * Returns {dx, dy} to subtract from window coords → client coords.
 * For WinUI apps with custom title bars, this may be (0, 0).
 */
function getNonClientOffset(): { dx: number; dy: number } {
  if (process.platform !== 'win32') return { dx: 0, dy: 0 }
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    const hwnd = getBoundHwnd()
    if (!hwnd) return { dx: 0, dy: 0 }

    validateHwnd(hwnd)

    const result = bunSpawnSync({
      cmd: [
        'powershell',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class NcCalc {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
'@
$h = [IntPtr]::new([long]${hwnd})
$wr = New-Object NcCalc+RECT
$cr = New-Object NcCalc+RECT
[NcCalc]::GetWindowRect($h, [ref]$wr) | Out-Null
[NcCalc]::GetClientRect($h, [ref]$cr) | Out-Null
$pt = New-Object NcCalc+POINT
$pt.X = 0; $pt.Y = 0
[NcCalc]::ClientToScreen($h, [ref]$pt) | Out-Null
"$($pt.X - $wr.L),$($pt.Y - $wr.T)"
`,
      ],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = new TextDecoder().decode(result.stdout).trim()
    const [dxStr, dyStr] = out.split(',')
    const dx = Number(dxStr) || 0
    const dy = Number(dyStr) || 0
    return { dx, dy }
  } catch {
    return { dx: 0, dy: 0 }
  }
}

// Cache non-client offset (recalculate on bind change)
let _ncOffset: { dx: number; dy: number } | null = null
let _ncOffsetHwnd: string | null = null

function getCachedNcOffset(): { dx: number; dy: number } {
  if (process.platform !== 'win32') return { dx: 0, dy: 0 }
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    const hwnd = getBoundHwnd()
    if (!hwnd) return { dx: 0, dy: 0 }
    if (_ncOffset && _ncOffsetHwnd === hwnd) return _ncOffset
    _ncOffset = getNonClientOffset()
    _ncOffsetHwnd = hwnd
    return _ncOffset
  } catch {
    return { dx: 0, dy: 0 }
  }
}

/**
 * Capture the accessibility tree for the bound window (Windows only).
 * Cached for 500ms so back-to-back screenshots don't re-walk the tree.
 * Returns compact text for the model, or undefined if not available.
 */
let lastAccessibilityFetch = 0
let lastAccessibilityText: string | undefined

/**
 * Invalidate the 500ms accessibility-text cache. The TTL alone can serve a
 * tree captured against a DIFFERENT window across a bind/unbind/rebind or a
 * window-state change, so the cache is cleared at the same sites that reset
 * the NC-offset cache.
 */
function resetAccessibilityCache(): void {
  lastAccessibilityFetch = 0
  lastAccessibilityText = undefined
}
async function getAccessibilityText(): Promise<string | undefined> {
  if (process.platform !== 'win32' || !isBound()) return undefined
  const now = Date.now()
  if (lastAccessibilityText !== undefined && now - lastAccessibilityFetch < 500) {
    return lastAccessibilityText
  }
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    const hwnd = getBoundHwnd()
    if (!hwnd) return undefined
    const { call } =
      require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
    const raw = (await call('accessibility_snapshot', {
      hwnd,
      max_depth: 6,
    })) as BridgeUiaNode[] | null
    if (!raw || !Array.isArray(raw)) return undefined
    const nodes = bridgeToAccessibilityNodes(raw)
    const text = formatForModel(nodes)
    lastAccessibilityFetch = now
    lastAccessibilityText = text
    return text
  } catch {
    return undefined
  }
}

/**
 * Augment a raw screenshot result with the metadata scaleCoord needs.
 * When HWND-bound: set displayWidth = imageWidth so coords map 1:1.
 * Also captures accessibility snapshot on Windows for GUI element awareness.
 */
async function augmentScreenshot(
  raw: { base64: string; width: number; height: number },
  display: { width: number; height: number; displayId?: number },
): Promise<ScreenshotResult> {
  if (isBound()) {
    let accessibilityText = await getAccessibilityText()
    // Surface user-driven window-state changes (title/minimize/move) that
    // happened since the last capture — one-shot note, cleared on read.
    try {
      const { consumeStateTransitionNote } =
        require('./platforms/win32.js') as typeof import('./platforms/win32.js')
      const note = consumeStateTransitionNote()
      if (note) {
        accessibilityText = `Window state changed since last capture: ${note}` +
          (accessibilityText ? `\n${accessibilityText}` : '')
      }
    } catch {
      // never let diagnostics break the capture path
    }
    return {
      base64: raw.base64,
      width: raw.width,
      height: raw.height,
      displayWidth: raw.width,
      displayHeight: raw.height,
      originX: 0,
      originY: 0,
      accessibilityText,
    }
  }
  return {
    base64: raw.base64,
    width: raw.width,
    height: raw.height,
    displayWidth: display.width,
    displayHeight: display.height,
    originX: 0,
    originY: 0,
  }
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export function createCrossPlatformExecutor(_opts: {
  getMouseAnimationEnabled: () => boolean
  getHideBeforeActionEnabled: () => boolean
}): ComputerExecutor {
  const platform = loadPlatform()

  logForDebugging(
    `[computer-use] cross-platform executor for ${process.platform}`,
  )

  return {
    capabilities: {
      ...CLI_CU_CAPABILITIES,
      hostBundleId: CLI_HOST_BUNDLE_ID,
    },

    // ── Pre-action (no-op on non-macOS) ──────────────────────────────────

    async prepareForAction(): Promise<string[]> {
      return []
    },

    async previewHideSet(): Promise<
      Array<{ bundleId: string; displayName: string }>
    > {
      return []
    },

    // ── Display ──────────────────────────────────────────────────────────

    async getDisplaySize(displayId?: number): Promise<DisplayGeometry> {
      const d = platform.display.getSize(displayId)
      return {
        ...d,
        scaleFactor: d.scaleFactor ?? 1,
        displayId: d.displayId ?? 0,
        originX: 0,
        originY: 0,
      }
    },

    async listDisplays(): Promise<DisplayGeometry[]> {
      return platform.display
        .listAll()
        .map(d => ({ ...d, originX: 0, originY: 0 }))
    },

    async findWindowDisplays(
      bundleIds: string[],
    ): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
      return bundleIds.map(b => ({ bundleId: b, displayIds: [0] }))
    },

    // ── Screenshot ───────────────────────────────────────────────────────

    async resolvePrepareCapture(opts: {
      allowedBundleIds: string[]
      preferredDisplayId?: number
      autoResolve: boolean
      doHide?: boolean
    }): Promise<ResolvePrepareCaptureResult> {
      const d = platform.display.getSize(opts.preferredDisplayId)
      const raw = await platform.screenshot.captureScreen(
        opts.preferredDisplayId,
      )
      const shot = await augmentScreenshot(raw, d)
      return {
        ...shot,
        hidden: [],
        displayId: opts.preferredDisplayId ?? d.displayId ?? 0,
      }
    },

    async screenshot(opts: {
      allowedBundleIds: string[]
      displayId?: number
    }): Promise<ScreenshotResult> {
      const d = platform.display.getSize(opts.displayId)
      const raw = await platform.screenshot.captureScreen(opts.displayId)
      return augmentScreenshot(raw, d)
    },

    async zoom(
      regionLogical: { x: number; y: number; w: number; h: number },
      _allowedBundleIds: string[],
      _displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }> {
      return platform.screenshot.captureRegion(
        regionLogical.x,
        regionLogical.y,
        regionLogical.w,
        regionLogical.h,
      )
    },

    // ── Keyboard ─────────────────────────────────────────────────────────

    async key(keySequence: string, repeat?: number): Promise<void> {
      const parts = keySequence.split('+').filter(p => p.length > 0)
      const n = repeat ?? 1

      // Modifier chords on a bound Windows window go through the bridge's
      // keybd_event path: PostMessageW(WM_KEYDOWN) never updates the global
      // key state that TranslateAccelerator consults, so ctrl+t /
      // ctrl+shift+tab etc. were silently treated as the plain key. The
      // bridge briefly foregrounds the bound window, injects the chord, and
      // restores the user's foreground. Works on-screen and off-screen alike.
      // Failure or an old bridge asset falls through to the legacy
      // PostMessage path.
      if (process.platform === 'win32' && isBound() && parts.length > 1) {
        let delivered: number | null = null
        try {
          const { getBoundHwnd } =
            require('./platforms/win32.js') as typeof import('./platforms/win32.js')
          const hwnd = getBoundHwnd()
          if (hwnd) {
            const { call } =
              require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
            delivered = 0
            while (delivered < n) {
              const ok = await call('send_key_chord', { hwnd, keys: parts })
              if (ok !== true) break
              delivered++
            }
          }
        } catch {
          // Bridge unavailable/refused: `delivered` keeps its partial count
          // (or stays null if we never got a bound HWND). Handled below.
        }
        if (delivered !== null) {
          if (delivered === n) return
          // Partial delivery: send only the remainder through the legacy
          // path, which drops modifiers — re-sending delivered chords would
          // inject the plain key a second time. The remainder loop runs
          // OUTSIDE the try above so a legacy throw cannot re-enter it.
          for (let i = delivered; i < n; i++) {
            if (i > 0) await sleep(8)
            await platform.input.keys(parts)
          }
          return
        }
        // delivered === null: getBoundHwnd returned nothing although
        // isBound() was just true — treat the chord as unattempted and let
        // the generic loop below run exactly once for the full count.
      }

      for (let i = 0; i < n; i++) {
        if (i > 0) await sleep(8)
        await platform.input.keys(parts)
      }
    },

    async holdKey(keyNames: string[], durationMs: number): Promise<void> {
      for (const k of keyNames) {
        await platform.input.key(k, 'press')
      }
      await sleep(durationMs)
      for (const k of [...keyNames].reverse()) {
        await platform.input.key(k, 'release')
      }
    },

    async type(text: string, _opts: { viaClipboard: boolean }): Promise<void> {
      await platform.input.typeText(text)
    },

    async readClipboard(): Promise<string> {
      if (process.platform === 'win32') {
        const result = bunSpawnSync({
          cmd: ['powershell', '-NoProfile', '-Command', 'Get-Clipboard'],
          stdout: 'pipe',
        })
        return new TextDecoder().decode(result.stdout).trim()
      }
      // Linux
      const result = bunSpawnSync({
        cmd: ['xclip', '-selection', 'clipboard', '-o'],
        stdout: 'pipe',
      })
      return new TextDecoder().decode(result.stdout).trim()
    },

    async writeClipboard(text: string): Promise<void> {
      if (process.platform === 'win32') {
        const escaped = text.replace(/'/g, "''")
        bunSpawnSync({
          cmd: [
            'powershell',
            '-NoProfile',
            '-Command',
            `Set-Clipboard -Value '${escaped}'`,
          ],
        })
        return
      }
      // Linux
      const proc = bunSpawn(['xclip', '-selection', 'clipboard'], {
        stdin: 'pipe',
      })
      proc.stdin.write(text)
      proc.stdin.end()
      await proc.exited
    },

    // ── Mouse ────────────────────────────────────────────────────────────

    async moveMouse(x: number, y: number): Promise<void> {
      await platform.input.moveMouse(x, y)
    },

    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void> {
      let clickX = Math.round(x)
      let clickY = Math.round(y)

      // When HWND-bound: scaleCoord gives us window coords (1:1 from image).
      // Subtract non-client offset to get client-area coords for WM_LBUTTONDOWN.
      if (isBound()) {
        const nc = getCachedNcOffset()
        clickX -= nc.dx
        clickY -= nc.dy
        logForDebugging(
          `[computer-use] click(${Math.round(x)},${Math.round(y)}) → client(${clickX},${clickY}) [nc offset: ${nc.dx},${nc.dy}]`,
        )

        // Bridge path when on Windows: one call handles count (real
        // WM_*BUTTONDBLCLK for double/triple — N separate down/up pairs do
        // not register as multi-clicks) and modifier MK_ flags, which the
        // per-iteration platform path below drops on the floor. Failure or
        // an old bridge asset falls through to the legacy loop.
        if (process.platform === 'win32') {
          try {
            const { getBoundHwnd } =
              require('./platforms/win32.js') as typeof import('./platforms/win32.js')
            const hwnd = getBoundHwnd()
            const { call } =
              require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
            if (hwnd && (count > 1 || (modifiers && modifiers.length > 0))) {
              const ok = await call('send_multi_click', {
                hwnd,
                x: clickX,
                y: clickY,
                button: button === 'middle' ? 'middle' : button,
                count,
                modifiers: modifiers ?? [],
              })
              if (ok === true) return
            }
          } catch {
            // fall through to the legacy per-iteration path
          }
        }
      }

      for (let i = 0; i < count; i++) {
        await platform.input.click(clickX, clickY, button)
      }
    },

    async mouseDown(): Promise<void> {
      if (isBound() && process.platform === 'win32') {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (hwnd) {
          const { sendMouseDown } =
            require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
          const pos = await platform.input.mouseLocation()
          sendMouseDown(hwnd, pos.x, pos.y)
          return
        }
      }
      // Unbound: SendInput with MOUSEEVENTF_LEFTDOWN
      if (process.platform === 'win32') {
        bunSpawnSync({
          cmd: [
            'powershell',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Add-Type -Language CSharp @'
using System; using System.Runtime.InteropServices;
public class MDown { [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public int mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(4)] public MOUSEINPUT mi; }
[DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] i, int cb); }
'@
$i = New-Object MDown+INPUT; $i.type=0; $i.mi.dwFlags=0x0002; [MDown]::SendInput(1, @($i), [Runtime.InteropServices.Marshal]::SizeOf($i)) | Out-Null`,
          ],
        })
        return
      }
    },

    async mouseUp(): Promise<void> {
      if (isBound() && process.platform === 'win32') {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (hwnd) {
          const { sendMouseUp } =
            require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
          const pos = await platform.input.mouseLocation()
          sendMouseUp(hwnd, pos.x, pos.y)
          return
        }
      }
      // Unbound: SendInput with MOUSEEVENTF_LEFTUP
      if (process.platform === 'win32') {
        bunSpawnSync({
          cmd: [
            'powershell',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Add-Type -Language CSharp @'
using System; using System.Runtime.InteropServices;
public class MUp { [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public int mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(4)] public MOUSEINPUT mi; }
[DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] i, int cb); }
'@
$i = New-Object MUp+INPUT; $i.type=0; $i.mi.dwFlags=0x0004; [MUp]::SendInput(1, @($i), [Runtime.InteropServices.Marshal]::SizeOf($i)) | Out-Null`,
          ],
        })
        return
      }
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      return platform.input.mouseLocation()
    },

    async drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void> {
      if (isBound() && process.platform === 'win32') {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (hwnd) {
          const { sendMouseDown, sendMouseMove, sendMouseUp } =
            require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
          const nc = getCachedNcOffset()
          if (from) {
            const fx = Math.round(from.x) - nc.dx
            const fy = Math.round(from.y) - nc.dy
            sendMouseDown(hwnd, fx, fy)
          }
          await sleep(50)
          const tx = Math.round(to.x) - nc.dx
          const ty = Math.round(to.y) - nc.dy
          sendMouseMove(hwnd, tx, ty)
          await sleep(16)
          sendMouseUp(hwnd, tx, ty)
          return
        }
      }
      // Unbound: press at from, move to to, release
      if (from) {
        await platform.input.moveMouse(from.x, from.y)
        await sleep(16)
      }
      // mouseDown
      await (this as any).mouseDown()
      await sleep(50)
      await platform.input.moveMouse(to.x, to.y)
      await sleep(16)
      // mouseUp
      await (this as any).mouseUp()
    },

    async scroll(
      _x: number,
      _y: number,
      dx: number,
      dy: number,
    ): Promise<void> {
      if (dy !== 0) await platform.input.scroll(dy, 'vertical')
      if (dx !== 0) await platform.input.scroll(dx, 'horizontal')
    },

    // ── App management ───────────────────────────────────────────────────

    async getFrontmostApp(): Promise<FrontmostApp | null> {
      // When HWND is bound, return a synthetic identity
      // so the frontmost gate passes (operations target bound window, not foreground)
      if (isBound()) {
        return { bundleId: 'cu-bound-window', displayName: 'Bound Window' }
      }
      const info = platform.apps.getFrontmostApp()
      if (!info) return null
      return { bundleId: info.id, displayName: info.appName }
    },

    async appUnderPoint(
      _x: number,
      _y: number,
    ): Promise<{ bundleId: string; displayName: string } | null> {
      return null
    },

    async listInstalledApps(): Promise<InstalledApp[]> {
      return (await platform.apps.listInstalled()).map(a => ({
        bundleId: a.id,
        displayName: a.displayName,
        path: a.path,
        exePath: a.exePath,
      }))
    },

    async getAppIcon(_path: string): Promise<string | undefined> {
      return undefined
    },

    async listRunningApps(): Promise<RunningApp[]> {
      return platform.apps.listRunning().map(w => ({
        bundleId: w.id,
        displayName: w.title,
      }))
    },

    async openApp(bundleId: string): Promise<void> {
      await platform.apps.open(bundleId)
      // Invalidate NC offset cache on new bind
      _ncOffset = null
      _ncOffsetHwnd = null
      resetAccessibilityCache()
    },

    // ── Window management (Windows only) ──────────────────────────────
    async manageWindow(action: string, opts?): Promise<boolean> {
      if (!platform.windowManagement) return false
      const result = platform.windowManagement.manageWindow(action as any, opts)
      // Invalidate NC offset cache on window state change
      _ncOffset = null
      _ncOffsetHwnd = null
      resetAccessibilityCache()
      return result
    },

    async getWindowRect(): Promise<{
      x: number
      y: number
      width: number
      height: number
    } | null> {
      if (!platform.windowManagement) return null
      return platform.windowManagement.getWindowRect()
    },

    // ── Open terminal + launch agent ─────────────────────────────────
    async openTerminal(opts: {
      agent: 'gakrcli' | 'codex' | 'gemini' | 'custom'
      command?: string
      terminal?: 'wt' | 'powershell' | 'cmd'
      workingDirectory?: string
    }): Promise<{ hwnd: string; title: string; launched: boolean } | null> {
      if (process.platform !== 'win32') return null
      try {
        const { listWindows: enumWindows } =
          require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
        const { bindWindow } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')

        const agentCmd: Record<string, string> = {
          gakrcli: 'gakrcli',
          codex: 'codex',
          gemini: 'gemini',
          custom: opts.command ?? '',
        }
        const cmd = agentCmd[opts.agent]
        if (!cmd) return null

        // Snapshot current windows
        const beforeHwnds = new Set(enumWindows().map(w => w.hwnd))
        const cwd = opts.workingDirectory ?? process.cwd()
        const escapedCwd = cwd.replace(/'/g, "''")

        // Start-Process powershell opens a NEW visible PowerShell window
        bunSpawnSync({
          cmd: [
            'powershell',
            '-Command',
            `Start-Process powershell -ArgumentList '-NoExit','-Command','cd ''${escapedCwd}''; ${cmd}'`,
          ],
          stdout: 'ignore',
          stderr: 'ignore',
        })

        // Poll for new terminal window (up to 5s)
        let newHwnd: string | null = null
        let newTitle = ''
        for (let i = 0; i < 25; i++) {
          await sleep(200)
          for (const w of enumWindows()) {
            if (!beforeHwnds.has(w.hwnd)) {
              const t = w.title.toLowerCase()
              if (
                t.includes('terminal') ||
                t.includes('powershell') ||
                t.includes('cmd') ||
                t.includes(cmd.toLowerCase())
              ) {
                newHwnd = w.hwnd
                newTitle = w.title
                break
              }
            }
          }
          if (newHwnd) break
        }
        if (!newHwnd) return null

        // Bind to new terminal
        const win = enumWindows().find(w => w.hwnd === newHwnd)
        bindWindow(newHwnd, win?.pid)
        _ncOffset = null
        _ncOffsetHwnd = null
        resetAccessibilityCache()

        // Wait for agent to initialize
        await sleep(2000)
        return { hwnd: newHwnd, title: newTitle, launched: true }
      } catch {
        return null
      }
    },

    // ── Window binding (Windows only) ───────────────────────────────
    async bindToWindow(query: { hwnd?: string; title?: string; pid?: number }) {
      if (process.platform !== 'win32') return null
      const { bindWindow } =
        require('./platforms/win32.js') as typeof import('./platforms/win32.js')
      const { listWindows: enumWindows } =
        require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
      const windows = enumWindows()

      let target: { hwnd: string; pid: number; title: string } | undefined
      if (query.hwnd) {
        target = windows.find(w => w.hwnd === query.hwnd)
      } else if (query.title) {
        const lower = query.title.toLowerCase()
        target = windows.find(w => w.title.toLowerCase().includes(lower))
      } else if (query.pid) {
        target = windows.find(w => w.pid === query.pid)
      }

      if (!target) return null
      bindWindow(target.hwnd, target.pid)
      _ncOffset = null
      _ncOffsetHwnd = null
      resetAccessibilityCache()
      return target
    },

    async unbindFromWindow() {
      if (process.platform !== 'win32') return
      const { unbindWindow } =
        require('./platforms/win32.js') as typeof import('./platforms/win32.js')
      unbindWindow()
      _ncOffset = null
      _ncOffsetHwnd = null
      resetAccessibilityCache()
    },

    async hasBoundWindow() {
      return isBound()
    },

    async getBindingStatus() {
      if (process.platform !== 'win32') return null
      const { getBoundHwnd } =
        require('./platforms/win32.js') as typeof import('./platforms/win32.js')
      const hwnd = getBoundHwnd()
      if (!hwnd) return { bound: false }
      const { listWindows: enumWindows, getProcessImagePath } =
        require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
      const windows = enumWindows()
      const win = windows.find(w => w.hwnd === hwnd)
      const rect = platform.windowManagement?.getWindowRect() ?? undefined
      // Executable path is the authorization identity — a window title is
      // attacker-settable, so it must never decide which grant a bound window
      // matches. May be null for elevated/undescribable processes; the gate
      // treats a missing identity as "not granted".
      const exePath = win?.pid ? getProcessImagePath(win.pid) : null
      return {
        bound: true,
        hwnd,
        title: win?.title,
        pid: win?.pid,
        exePath: exePath ?? undefined,
        rect: rect ?? undefined,
      }
    },

    async listVisibleWindows() {
      if (process.platform !== 'win32') return []
      const { listWindows: enumWindows } =
        require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
      return enumWindows()
    },

    // ── Status indicator ──────────────────────────────────────────────
    async statusIndicator(
      action: 'show' | 'hide' | 'status',
      message?: string,
    ) {
      if (process.platform !== 'win32') return { active: false }
      try {
        const ind =
          require('./win32/inputIndicator.js') as typeof import('./win32/inputIndicator.js')
        if (action === 'show' && message) {
          ind.updateIndicator(message)
          return { active: true, message }
        }
        if (action === 'hide') {
          ind.hideIndicator()
          return { active: false }
        }
        // status
        return { active: isBound() }
      } catch {
        return { active: false }
      }
    },

    // ── Virtual keyboard (PostMessage to bound window only) ────────────
    // Key events use PostMessage + correct lParam (scan code via MapVirtualKeyW).
    // This is required for Windows Terminal / ConPTY to correctly translate
    // WM_KEYDOWN/WM_KEYUP into console input events.
    async virtualKeyboard(opts: {
      action: 'type' | 'combo' | 'press' | 'release' | 'hold'
      text: string
      duration?: number
      repeat?: number
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const hwnd = getBoundHwndStr()
        if (!hwnd) return false
        const wm =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        const { VK_MAP } =
          require('./win32/shared.js') as typeof import('./win32/shared.js')
        const repeat = opts.repeat ?? 1

        for (let r = 0; r < repeat; r++) {
          if (r > 0) await sleep(30)

          switch (opts.action) {
            case 'type':
              wm.sendText(hwnd, opts.text)
              break

            case 'combo': {
              const parts = opts.text
                .split('+')
                .map(k => k.trim())
                .filter(Boolean)
              // Modifier chords must update the global key state that
              // TranslateAccelerator consults, which PostMessage cannot do.
              // Prefer the bridge's keybd_event chord (same delivery as
              // executor.key()); PostMessage remains the fallback for an
              // unavailable bridge. A single non-modifier key still goes
              // through PostMessage — window-targeted, no foreground steal.
              // One chord per outer-loop iteration: `repeat` is handled by
              // the enclosing for-loop, not here.
              if (parts.length > 1 && process.platform === 'win32') {
                try {
                  const hwndForChord = getBoundHwndStr()
                  if (hwndForChord) {
                    const { call } =
                      require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
                    const sent = await call('send_key_chord', {
                      hwnd: hwndForChord,
                      keys: parts,
                    })
                    if (sent === true) break
                  }
                } catch {
                  // fall through to the PostMessage path
                }
              }
              wm.sendKeys(hwnd, parts)
              break
            }

            case 'press': {
              const lower = opts.text.toLowerCase()
              const vk =
                VK_MAP[lower] ??
                (opts.text.length === 1 ? opts.text.charCodeAt(0) : 0)
              if (vk) wm.sendKey(hwnd, vk, 'down')
              break
            }

            case 'release': {
              const lower = opts.text.toLowerCase()
              const vk =
                VK_MAP[lower] ??
                (opts.text.length === 1 ? opts.text.charCodeAt(0) : 0)
              if (vk) wm.sendKey(hwnd, vk, 'up')
              break
            }

            case 'hold': {
              const parts = opts.text
                .split('+')
                .map(k => k.trim())
                .filter(Boolean)
              // Press all keys
              for (const k of parts) {
                const lower = k.toLowerCase()
                const vk =
                  VK_MAP[lower] ?? (k.length === 1 ? k.charCodeAt(0) : 0)
                if (vk) wm.sendKey(hwnd, vk, 'down')
              }
              // Hold
              await sleep((opts.duration ?? 1) * 1000)
              // Release in reverse
              for (const k of [...parts].reverse()) {
                const lower = k.toLowerCase()
                const vk =
                  VK_MAP[lower] ?? (k.length === 1 ? k.charCodeAt(0) : 0)
                if (vk) wm.sendKey(hwnd, vk, 'up')
              }
              break
            }
          }
        }
        return true
      } catch {
        return false
      }
    },

    // ── Virtual mouse (SendMessageW to bound window only) ─────────────
    async virtualMouse(opts: {
      action:
        | 'click'
        | 'double_click'
        | 'right_click'
        | 'move'
        | 'drag'
        | 'down'
        | 'up'
      x: number
      y: number
      startX?: number
      startY?: number
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const hwnd = getBoundHwndStr()
        if (!hwnd) return false
        const wm =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        const vc =
          require('./win32/virtualCursor.js') as typeof import('./win32/virtualCursor.js')
        const x = Math.round(opts.x)
        const y = Math.round(opts.y)

        switch (opts.action) {
          case 'click':
            vc.moveVirtualCursor(x, y, true)
            wm.sendClick(hwnd, x, y, 'left')
            break
          case 'double_click':
            vc.moveVirtualCursor(x, y, true)
            wm.sendClick(hwnd, x, y, 'left')
            await sleep(50)
            wm.sendClick(hwnd, x, y, 'left')
            break
          case 'right_click':
            vc.moveVirtualCursor(x, y, true)
            wm.sendClick(hwnd, x, y, 'right')
            break
          case 'move':
            vc.moveVirtualCursor(x, y)
            wm.sendMouseMove(hwnd, x, y)
            break
          case 'drag': {
            const sx = Math.round(opts.startX ?? x)
            const sy = Math.round(opts.startY ?? y)
            vc.moveVirtualCursor(sx, sy, true)
            wm.sendMouseDown(hwnd, sx, sy)
            await sleep(16)
            wm.sendMouseMove(hwnd, x, y)
            vc.moveVirtualCursor(x, y)
            await sleep(16)
            wm.sendMouseUp(hwnd, x, y)
            break
          }
          case 'down':
            vc.moveVirtualCursor(x, y, true)
            wm.sendMouseDown(hwnd, x, y)
            break
          case 'up':
            vc.moveVirtualCursor(x, y)
            wm.sendMouseUp(hwnd, x, y)
            break
        }
        return true
      } catch {
        return false
      }
    },

    // ── Mouse wheel scroll (WM_MOUSEWHEEL, works on Excel/browsers) ──
    async mouseWheel(
      x: number,
      y: number,
      delta: number,
      horizontal?: boolean,
    ): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const hwnd = getBoundHwndStr()
        if (!hwnd) return false
        // Try bridge first (via bridgeClient directly)
        try {
          const bridge =
            require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
          const result = bridge.callSync<boolean>('send_mouse_wheel', {
            hwnd,
            x: Math.round(x),
            y: Math.round(y),
            delta,
            horizontal: horizontal ?? false,
          })
          if (result !== null) return true
        } catch {}
        // Fallback: windowMessage.ts (PowerShell)
        const { sendMouseWheel } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        return sendMouseWheel(
          hwnd,
          Math.round(x),
          Math.round(y),
          delta,
          horizontal ?? false,
        )
      } catch {
        return false
      }
    },

    // ── Window activation + prompt interaction ────────────────────────
    async activateWindow(clickX?: number, clickY?: number): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        // Focus: restore if minimized, bring to foreground
        if (platform.windowManagement) {
          platform.windowManagement.manageWindow('focus')
        }
        // Click to ensure keyboard focus inside the window
        const { sendClick } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        if (clickX !== undefined && clickY !== undefined) {
          sendClick(hwnd, clickX, clickY, 'left')
        } else {
          // Click center of client area
          const rect = platform.windowManagement?.getWindowRect()
          if (rect) {
            const nc = getCachedNcOffset()
            const cx = Math.round(rect.width / 2) - nc.dx
            const cy = Math.round(rect.height / 2) - nc.dy
            sendClick(hwnd, cx, cy, 'left')
          }
        }
        return true
      } catch {
        return false
      }
    },

    async respondToPrompt(opts: {
      responseType: 'yes' | 'no' | 'enter' | 'escape' | 'select' | 'type'
      arrowDirection?: 'up' | 'down'
      arrowCount?: number
      text?: string
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        const wm =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')

        const VK_RETURN = 0x0d
        const VK_ESCAPE = 0x1b
        const VK_UP = 0x26
        const VK_DOWN = 0x28

        switch (opts.responseType) {
          case 'yes':
            wm.sendChar(hwnd, 'y')
            await sleep(50)
            wm.sendKey(hwnd, VK_RETURN, 'down')
            wm.sendKey(hwnd, VK_RETURN, 'up')
            break
          case 'no':
            wm.sendChar(hwnd, 'n')
            await sleep(50)
            wm.sendKey(hwnd, VK_RETURN, 'down')
            wm.sendKey(hwnd, VK_RETURN, 'up')
            break
          case 'enter':
            wm.sendKey(hwnd, VK_RETURN, 'down')
            wm.sendKey(hwnd, VK_RETURN, 'up')
            break
          case 'escape':
            wm.sendKey(hwnd, VK_ESCAPE, 'down')
            wm.sendKey(hwnd, VK_ESCAPE, 'up')
            break
          case 'select': {
            const vk =
              (opts.arrowDirection ?? 'down') === 'down' ? VK_DOWN : VK_UP
            const count = opts.arrowCount ?? 1
            for (let i = 0; i < count; i++) {
              wm.sendKey(hwnd, vk, 'down')
              wm.sendKey(hwnd, vk, 'up')
              await sleep(30)
            }
            await sleep(50)
            wm.sendKey(hwnd, VK_RETURN, 'down')
            wm.sendKey(hwnd, VK_RETURN, 'up')
            break
          }
          case 'type':
            if (opts.text) {
              wm.sendText(hwnd, opts.text)
              await sleep(50)
            }
            wm.sendKey(hwnd, VK_RETURN, 'down')
            wm.sendKey(hwnd, VK_RETURN, 'up')
            break
        }
        return true
      } catch {
        return false
      }
    },

    // ── Element-targeted actions (Windows UIA) ──────────────────────────────
    async clickElement(query: {
      name?: string
      role?: string
      automationId?: string
      /** Per-snapshot node id from the accessibility tree (most precise). */
      nodeId?: number
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        const { call } =
          require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
        const raw = (await call('accessibility_snapshot', {
          hwnd,
          max_depth: 6,
        })) as BridgeUiaNode[] | null
        if (!raw || !Array.isArray(raw)) return false
        const { findNodeInSnapshot } =
          require('./win32/accessibilitySnapshot.js') as typeof import('./win32/accessibilitySnapshot.js')
        const node = findNodeInSnapshot(bridgeToAccessibilityNodes(raw), query)
        if (!node) return false

        // Preferred: RuntimeId-targeted InvokePattern through the bridge
        // (Phase 2.2). The node's RuntimeId is re-resolved bridge-side with a
        // bounded DFS — no title matching and no automationId-string lookup,
        // which fails on empty/duplicated ids. An old bridge without the
        // method rejects -> treated as "not handled" so the paths below run.
        if (node.runtimeId?.length) {
          const invoked = await (async () => {
            try {
              const r = await call('uia_invoke_id', {
                hwnd,
                rid: node.runtimeId,
              })
              return r === true
            } catch {
              return false
            }
          })()
          if (invoked) return true
        }

        // Fallback 1: InvokePattern by automationId (pre-bridge-id path).
        if (node.automationId) {
          const invoked = await (async () => {
            try {
              const r = await call('uia_invoke', {
                hwnd,
                automation_id: node.automationId,
              })
              return r === true
            } catch {
              return false
            }
          })()
          if (invoked) return true
        }

        // Fallback 2: click the center of the element's bounding rect. The
        // snapshot reports PHYSICAL screen coords, so the conversion to
        // client coords happens bridge-side (click_element_center) where
        // per-monitor-v2 DPI awareness keeps everything physical and the NC
        // offset is measured with the same physical APIs (Phase 2.4). The
        // previous TS-side screen-minus-NC-offset math was only correct at
        // 100% scaling.
        const cx = node.bounds.x + Math.round(node.bounds.w / 2)
        const cy = node.bounds.y + Math.round(node.bounds.h / 2)
        try {
          const r = await call('click_element_center', {
            hwnd,
            x: cx,
            y: cy,
          })
          if (r === true) return true
        } catch {
          // Old bridge asset without the method -> legacy path below.
        }
        const nc = getCachedNcOffset()
        const { sendClick } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        const editHwnd = require('./win32/windowMessage.js').findEditChild(hwnd)
        sendClick(editHwnd ?? hwnd, cx - nc.dx, cy - nc.dy, 'left')
        return true
      } catch {
        return false
      }
    },

    async typeIntoElement(
      query: { name?: string; role?: string; automationId?: string; nodeId?: number },
      text: string,
    ): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        const { call } =
          require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')

        // Preferred: RuntimeId-targeted ValuePattern (Phase 2.2) after
        // locating the node in a fresh snapshot. Node targeting avoids the
        // empty/duplicated-automationId trap entirely.
        const raw = (await call('accessibility_snapshot', {
          hwnd,
          max_depth: 6,
        })) as BridgeUiaNode[] | null
        const nodes = raw && Array.isArray(raw) ? bridgeToAccessibilityNodes(raw) : []
        const { findNodeInSnapshot } =
          require('./win32/accessibilitySnapshot.js') as typeof import('./win32/accessibilitySnapshot.js')
        const node = findNodeInSnapshot(nodes, query)

        if (node?.runtimeId?.length) {
          try {
            const r = await call('uia_set_value_id', {
              hwnd,
              rid: node.runtimeId,
              value: text,
            })
            if (r === true) return true
          } catch {
            // Old bridge without the method -> fall through.
          }
        }

        // Fallback 1: ValuePattern by automationId (pre-bridge-id path).
        const bridgeSetValue = async (automationId: string): Promise<boolean> => {
          try {
            const r = await call('uia_set_value', { hwnd, automation_id: automationId, value: text })
            return r === true
          } catch {
            return false
          }
        }
        if (node?.automationId && (await bridgeSetValue(node.automationId))) return true
        if (!node && query.automationId && (await bridgeSetValue(query.automationId)))
          return true

        if (!node) return false

        // Fallback 2: focus the element, then sendText. The center click
        // goes through the bridge's physical-coordinate conversion (Phase
        // 2.4); the legacy NC-offset math stays as the old-bridge fallback.
        const cx = node.bounds.x + Math.round(node.bounds.w / 2)
        const cy = node.bounds.y + Math.round(node.bounds.h / 2)
        try {
          const r = await call('click_element_center', { hwnd, x: cx, y: cy })
          if (r !== true) throw new Error('center click not handled')
        } catch {
          const nc = getCachedNcOffset()
          const { sendClick: legacyClick } =
            require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
          legacyClick(hwnd, cx - nc.dx, cy - nc.dy, 'left')
        }
        await sleep(50)
        const { sendText } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        return sendText(hwnd, text)
      } catch {
        return false
      }
    },

    // ── Pattern interactions (Phase 3.1) ──────────────────────────────────
    async interactElement(
      query: { name?: string; role?: string; automationId?: string; nodeId?: number },
      action: 'expand' | 'collapse' | 'toggle' | 'select' | 'scroll_into_view' | 'set_range',
      value?: number,
    ): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        const { call } =
          require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
        const raw = (await call('accessibility_snapshot', {
          hwnd,
          max_depth: 6,
        })) as BridgeUiaNode[] | null
        if (!raw || !Array.isArray(raw)) return false
        const { findNodeInSnapshot } =
          require('./win32/accessibilitySnapshot.js') as typeof import('./win32/accessibilitySnapshot.js')
        const node = findNodeInSnapshot(bridgeToAccessibilityNodes(raw), query)
        if (!node?.runtimeId?.length) return false
        const method = {
          expand: 'expand_id',
          collapse: 'expand_id',
          toggle: 'toggle_id',
          select: 'select_id',
          scroll_into_view: 'scroll_into_view_id',
          set_range: 'set_range_id',
        }[action]
        const params: Record<string, unknown> = { hwnd, rid: node.runtimeId }
        if (action === 'collapse') params.expand = false
        if (action === 'set_range') params.value = value ?? 0
        const r = await call(method, params)
        return r === true
      } catch {
        return false
      }
    },

    async getCurrentState(): Promise<Record<string, unknown> | null> {
      if (process.platform !== 'win32' || !isBound()) return null
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return null
        const { call } =
          require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
        const state = (await call('get_current_state', {
          hwnd,
        })) as Record<string, unknown> | null
        return state ?? null
      } catch {
        return null
      }
    },
  }
}

/**
 * Module-level unhide — no-op on non-macOS (we don't hide apps).
 */
export async function unhideComputerUseAppsCrossPlatform(
  _bundleIds: readonly string[],
): Promise<void> {
  // No-op: Windows/Linux don't use hide/unhide
}
