/**
 * Source-contract tests for the Windows Computer Use input fixes.
 *
 * Static inspection (same rationale as noDirectBunGlobals.test.ts): the
 * failing code paths are win32-gated and never execute in CI on Linux, so
 * only reading the source catches a regression. What is locked in:
 *
 * 1. key/hold_key are NOT rerouted to virtual_keyboard in bound mode —
 *    the combo reroute posted bare WM_KEYDOWN/UP, which never updates the
 *    global key state TranslateAccelerator consults, so modifier chords
 *    (ctrl+t, ctrl+n, ...) degraded to the plain key.
 * 2. Chords reach the bridge's send_key_chord from BOTH executor.key()
 *    and virtual_keyboard('combo').
 * 3. Unbound win32 key/keys/typeText have global fallbacks (they used to
 *    throw "requires a bound window").
 * 4. screenshot_window forces a repaint before PrintWindow (stale GDI
 *    surface on offscreen-parked windows).
 * 5. get_current_state tab selection runs an exact pass first and elects
 *    at most one containment winner (multi-selected:true quirk).
 */
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const CU_ROOT = resolve(import.meta.dirname, '..')
const VENDOR_TOOLCALLS = resolve(
  CU_ROOT,
  '../../../vendor/computer-use-mcp/src/toolCalls.ts',
)
const EXECUTOR = join(CU_ROOT, 'executorCrossPlatform.ts')
const PLATFORM = join(CU_ROOT, 'platforms/win32.ts')
const BRIDGE = join(CU_ROOT, 'win32/bridge.py')

function read(path: string): string {
  // Normalize CRLF so multi-line assertions are checkout-agnostic.
  return readFileSync(path, 'utf-8').replace(/\r\n/g, '\n')
}

test('bound-mode key/hold_key are not rerouted to virtual_keyboard', () => {
  const src = read(VENDOR_TOOLCALLS)
  // The old reroute mapped case 'key'/'hold_key' to handleVirtualKeyboard
  // inside the bound-window auto-routing switch.
  expect(src).not.toMatch(/case 'key':\s*\n\s*if \(typeof a\.text === 'string'\)\s*\n\s*return handleVirtualKeyboard/)
  expect(src).not.toMatch(/case 'hold_key':\s*\n\s*if \(typeof a\.text === 'string'\)\s*\n\s*return handleVirtualKeyboard/)
  // And the deliberate-omission rationale is documented where the cases
  // used to be, so the reroute is not "helpfully" restored.
  expect(src).toContain('deliberately NOT rerouted')
})

test('chords reach send_key_chord from executor.key() and virtual_keyboard', () => {
  const exec = read(EXECUTOR)
  // executor.key() bound-chord path
  expect(exec).toContain("call('send_key_chord'")
  // virtual_keyboard('combo') parity path
  expect(exec.match(/send_key_chord/g)?.length).toBeGreaterThanOrEqual(2)
  // The bridge implements it and registers it in METHODS.
  const py = read(BRIDGE)
  expect(py).toContain('def send_key_chord')
  expect(py).toContain("'send_key_chord': lambda p: send_key_chord(p['hwnd'], p['keys'])")
})

test('unbound win32 key/keys/typeText have global fallbacks', () => {
  const src = read(PLATFORM)
  // key(): keybd_event fallback instead of throwing when unbound
  expect(src).toContain('VkKeyScan')
  // keys(): modifier-down → key down/up → modifiers-up script
  expect(src).toContain('async keys(parts)')
  // typeText(): escaped SendKeys fallback (specials become {...} literals)
  expect(src).toContain('SENDKEYS_SPECIALS')
  expect(src).toContain('SendKeys]::SendWait')
  // No bound-window-required throws remain in the input surface.
  expect(src).not.toContain("key requires a bound window HWND")
  expect(src).not.toContain("keys requires a bound window HWND")
  expect(src).not.toContain('typeText requires a bound window or file')
})

test('screenshot_window forces a repaint before PrintWindow', () => {
  const py = read(BRIDGE)
  expect(py).toContain('def screenshot_window')
  // RDW_INVALIDATE | RDW_ALLCHILDREN | RDW_UPDATENOW before capture
  expect(py).toContain('RedrawWindow(hwnd, None, None,')
  expect(py).toContain('RDW_UPDATENOW')
  // PW_RENDERFULLCONTENT still in use.
  expect(py).toContain('PrintWindow(hwnd, hdc_mem, 2)')
})

test('get_current_state tab selection is exact-first with one winner', () => {
  const py = read(BRIDGE)
  // Pass 1 runs with containment disabled.
  expect(py).toContain('_names_match(it[\'title\'], selected_names,\n                                          exact_only=True)')
  // _names_match honors exact_only.
  expect(py).toContain('def _names_match(title, candidates, exact_only=False)')
  // Pass 2 elects a single winner via identity comparison.
  expect(py).toContain("it['selected'] = it is best_item")
})
