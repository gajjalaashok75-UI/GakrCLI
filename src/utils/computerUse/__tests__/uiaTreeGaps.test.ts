/**
 * Source-contract tests for the UIA accessibility-tree gap fixes
 * (win32-uia-ref/06-uia-tree-gap-fill-plan.md, Phases 0–3).
 *
 * Static inspection (same rationale as chordRouting.test.ts): the guarded
 * code paths are win32-gated and never execute in CI on Linux, so only
 * reading the source catches a regression. What is locked in:
 *
 * Phase 0:
 *  - dead _get_uia()/comtypes client is gone (the pywinauto path is the
 *    only real one)
 *  - bridge health: exit-code check + ping probe + write-failure respawn
 *  - the response accumulator is bounded (8 MB) with recycle-on-overflow
 *  - the 500ms accessibility cache is reset at rebind/unbind/state-change
 *    sites, not just by TTL
 *  - editChildCache entries are liveness-validated before use
 *  - bridge deps are declared and the install hint names them
 *
 * Phase 1:
 *  - the walk has a hard element budget with a model-facing truncation note
 *  - IsOffscreen is read per node and MARKED (never filtered), with an
 *    Edit/Document carve-out, and rendered as OFFSCREEN
 *  - one shared INTERACTIVE_ROLES set feeds both walk and flat fallback
 *  - COM is initialized (STA) before the dispatch loop
 *  - lone surrogates/PUA are repaired at the response boundary
 *  - per-node walk failures are tallied and reported to stderr, not swallowed
 *
 * Phase 2:
 *  - every snapshot node carries a per-snapshot id (k) + UIA RuntimeId (rid)
 *  - *_id bridge action methods re-resolve RuntimeIds via a bounded DFS with
 *    a cyclic-provider guard
 *  - the bridge process is per-monitor-v2 DPI aware BEFORE COM init, and the
 *    rect-center click fallback converts screen→client with physical APIs
 *  - a provider that ignores child navigation is locked (one-way) into the
 *    flat descendants() walk
 *
 * Phase 3:
 *  - pattern actions expand/collapse/toggle/select/scroll_into_view/set_range
 *    are exposed through the bridge and an interact_element tool
 *  - click_element / type_into_element accept a per-snapshot nodeId
 *  - the ambient ComputerExecutor declaration stays in sync with the vendor
 *    interface (an out-of-sync copy silently drops new methods from tsc)
 */
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const CU_ROOT = resolve(import.meta.dirname, '..')
const VENDOR_TOOLCALLS = resolve(
  CU_ROOT,
  '../../../vendor/computer-use-mcp/src/toolCalls.ts',
)
const VENDOR_TOOLS = resolve(
  CU_ROOT,
  '../../../vendor/computer-use-mcp/src/tools.ts',
)
const VENDOR_EXECUTOR = resolve(
  CU_ROOT,
  '../../../vendor/computer-use-mcp/src/executor.ts',
)
const OPTIONAL_MODULES_DTS = resolve(CU_ROOT, '../../optionalModules.d.ts')
const EXECUTOR = join(CU_ROOT, 'executorCrossPlatform.ts')
const BRIDGE_CLIENT = join(CU_ROOT, 'win32/bridgeClient.ts')
const BRIDGE_UIA = join(CU_ROOT, 'win32/bridgeUia.ts')
const WINDOW_MESSAGE = join(CU_ROOT, 'win32/windowMessage.ts')
const PLATFORM = join(CU_ROOT, 'platforms/win32.ts')
const BRIDGE = join(CU_ROOT, 'win32/bridge.py')

function read(path: string): string {
  // Normalize CRLF so multi-line assertions are checkout-agnostic.
  return readFileSync(path, 'utf-8').replace(/\r\n/g, '\n')
}

// ── Phase 0 ────────────────────────────────────────────────────────────────

test('dead _get_uia comtypes client is removed from bridge.py', () => {
  const py = read(BRIDGE)
  expect(py).not.toContain('_get_uia')
  expect(py).not.toContain('_uia_client')
})

test('bridge client has health handling: exit-code check, ping probe, respawn on write failure', () => {
  const src = read(BRIDGE_CLIENT)
  // Dead-handle detection instead of `if (bridgeProc) return true` forever.
  expect(src).toContain('exitCode')
  // Wire the ping method that existed unused since bridge.py added it.
  expect(src).toContain("call('ping'")
  // A broken pipe drops the handle so the next call respawns.
  expect(src).toContain('Bridge write failed')
  // stopBridge is called in the write-failure handler so the next call respawns.
  expect(src).toMatch(/pendingRequests\.delete\(id\)\n\s+\/\/ The handle is unusable[\s\S]*?stopBridge\(\)\n\s+reject\(new Error\(`Bridge write failed/)
})

test('response accumulator is bounded and recycles the bridge on overflow', () => {
  const src = read(BRIDGE_CLIENT)
  expect(src).toContain('MAX_OUTPUT_BUFFER')
  expect(src).toMatch(/outputBuffer\.length > MAX_OUTPUT_BUFFER/)
})

test('accessibility cache is reset on bind/unbind/window-state change sites', () => {
  const exec = read(EXECUTOR)
  expect(exec).toContain('function resetAccessibilityCache()')
  // Called from the NC-offset reset sites (openApp, manageWindow, openTerminal,
  // bindToWindow, unbindFromWindow) plus the definition.
  const uses = exec.match(/resetAccessibilityCache\(\)/g)?.length ?? 0
  expect(uses).toBeGreaterThanOrEqual(6)
})

test('editChildCache entries are liveness-validated before use', () => {
  const src = read(WINDOW_MESSAGE)
  expect(src).toContain('CheckAlive')
  expect(src).toContain('pruneDeadEditChildren')
  expect(src.match(/pruneDeadEditChildren\(\)/g)?.length).toBeGreaterThanOrEqual(2)
})

test('bridge dependencies are declared and the install hint names them', () => {
  const reqs = read(resolve(CU_ROOT, '../../../python/computerUse-requirements.txt'))
  for (const dep of ['pywinauto', 'comtypes', 'mss', 'Pillow']) {
    expect(reqs).toContain(dep)
  }
  const src = read(PLATFORM)
  expect(src).toContain('pip install -r python/computerUse-requirements.txt')
  expect(src).not.toContain('pip install mss Pillow')
})

// ── Phase 1 ────────────────────────────────────────────────────────────────

test('primary walk has a hard element budget with a model-facing truncation note', () => {
  const py = read(BRIDGE)
  expect(py).toContain('element_budget = [500]')
  expect(py).toContain("budget_hit[0] = True")
  expect(py).toContain("'Accessibility tree truncated: element budget (500) reached. '")
  // The note tells the model how to recover, not just that it was cut.
  expect(py).toContain('Use get_current_state for a')
})

test('IsOffscreen is read, marked (never filtered), with an Edit/Document carve-out', () => {
  const py = read(BRIDGE)
  expect(py).toContain('_UIA_IS_OFFSCREEN = 30007')
  expect(py).toContain('def _is_offscreen(elem)')
  expect(py).toContain("node['off'] = True")
  expect(py).toContain("ct not in ('Edit', 'Document')")
  // The old misleading comment is gone: visibility IS now checked separately.
  expect(py).not.toContain('visibility is checked separately via ct/name flags')
  // Marked, not filtered: no drop of offscreen nodes in the walk.
  expect(py).not.toContain('if off:')
})

test('one shared INTERACTIVE_ROLES set feeds walk and flat fallback', () => {
  const py = read(BRIDGE)
  expect(py).toContain('INTERACTIVE_ROLES = {')
  // The flat fallback no longer defines its own diverging set.
  expect(py).not.toMatch(/\bINTERACTIVE = \{/)
  expect(py).not.toContain('INTERACTIVE_EXTRA')
  expect(py).toContain('ct not in INTERACTIVE_ROLES')
  expect(py).toContain("node['role'] in INTERACTIVE_ROLES")
})

test('COM apartment is initialized before the dispatch loop', () => {
  const py = read(BRIDGE)
  expect(py).toContain('def _init_com()')
  expect(py).toContain('COINIT_APARTMENTTHREADED')
  expect(py).toContain('    _init_com()')
})

test('lone surrogates and PUA are repaired at the response boundary', () => {
  const py = read(BRIDGE)
  expect(py).toContain('def _repair_strings(obj)')
  expect(py).toContain("result': _repair_strings(result)")
})

test('walk failures are tallied and reported to stderr, not swallowed', () => {
  const py = read(BRIDGE)
  expect(py).toContain('walk_errors = []')
  expect(py).toContain('walk_errors.append')
  expect(py).toContain('[bridge] accessibility_snapshot')
  // The outer bare-swallow is gone: the failure reason reaches the tail.
  expect(py).toMatch(/except Exception as e:\n        # Diagnosed, not swallowed/)
})

test('offscreen flag flows through bridgeUia to the model as OFFSCREEN', () => {
  const src = read(BRIDGE_UIA)
  expect(src).toContain('off?: boolean')
  expect(src).toContain('offscreen: n.off === true || undefined')
  expect(src).toContain("if (node.offscreen) line += ' OFFSCREEN'")
})

test('the tree keeps named content/structure nodes, not just interactives', () => {
  const py = read(BRIDGE)
  // Content roles are a first-class part of the walk condition on BOTH
  // paths, so static text, cells, headers and images survive.
  expect(py).toContain('CONTENT_ROLES = {')
  expect(py).toContain('ct in CONTENT_ROLES and name')
  // The flat path no longer drops nodes that have no RuntimeId (they are
  // still usable by name/rect) and it marks offscreen state.
  expect(py).not.toContain('if rid is None:\n                return None')
  expect(py).toContain("node['off'] = True")
})

test('related top-level windows (menus/dialogs) are folded into the snapshot', () => {
  const py = read(BRIDGE)
  expect(py).toContain('def _related_popup_windows(hwnd):')
  expect(py).toContain('_RELATED_WINDOW_CAP = 5')
  // Owned popups and other same-process top-level windows are enumerated
  // and their trees appended as Window roots.
  expect(py).toContain('int(owner or 0) == int(hwnd) or (not owner and same_proc)')
  expect(py).toContain("'role': 'Window',")
  // The bound-window representation is decided BEFORE appending related
  // windows, so popups cannot mask a thin bound tree.
  expect(py).toMatch(/count_tree\(tree\) >= 10[\s\S]*?_related_popup_windows\(hwnd\)/)
})

test('real focus and expand/collapse state are carried on interactive nodes', () => {
  const py = read(BRIDGE)
  expect(py).toContain("node['focus'] = True")
  expect(py).toContain("node['exp'] = exp")
  const src = read(BRIDGE_UIA)
  expect(src).toContain('focus?: boolean')
  expect(src).toContain('exp?: number')
  expect(src).toContain('focused?: boolean')
  expect(src).toContain('expanded?: boolean')
  expect(src).toContain("if (node.focused) line += ' FOCUSED'")
  expect(src).toContain("line += ' EXPANDED'")
  expect(src).toContain("line += ' COLLAPSED'")
})

test('walk depth default is raised to 10 across the bridge and TS call sites', () => {
  const py = read(BRIDGE)
  expect(py).toContain('def accessibility_snapshot(hwnd_str, max_depth=10):')
  const exec = read(EXECUTOR)
  expect(exec).not.toContain('max_depth: 6,')
  expect(exec.match(/max_depth: 10,/g)?.length).toBeGreaterThanOrEqual(4)
})

test('vendor toolCalls still has no key/hold_key reroute and screenshot attaches a11y text', () => {
  const src = read(VENDOR_TOOLCALLS)
  // Regression guard carried over from chordRouting: the reroute stays gone
  // while the accessibility text attach path is untouched.
  expect(src).toContain('deliberately NOT rerouted')
  expect(src).toContain('GUI elements in this window:')
})

// ── Phase 2 ─────────────────────────────────────────────────────────────────

test('snapshot nodes carry a per-snapshot id (k) and a UIA RuntimeId (rid)', () => {
  const py = read(BRIDGE)
  // Raw RuntimeId property read (pywinauto 0.6.9 has no constant for it).
  expect(py).toContain('_UIA_RUNTIME_ID = 30000')
  // Walk nodes: counter-assigned k + rid, carried into the truncation note
  // as a non-element sentinel.
  expect(py).toContain('node_counter = [0]')
  expect(py).toContain("node_counter[0] += 1")
  expect(py).toContain("'k': node_counter[0]")
  expect(py).toContain("if rid:\n                            node['rid'] = rid")
  expect(py).toContain("'k': -1,  # sentinel: the truncation note is not a real element")
  // Flat fallback: ids assigned in final node order.
  expect(py).toContain("node['k'] = i")
})

test('*_id bridge methods re-resolve RuntimeIds with a bounded, cycle-guarded DFS', () => {
  const py = read(BRIDGE)
  expect(py).toContain('_RID_DFS_NODE_CAP = 10000')
  expect(py).toContain('def _element_runtime_id(elem)')
  expect(py).toContain('def _find_by_runtime_id(win, target_rid)')
  expect(py).toContain('def _resolve_by_rid(hwnd_str, rid)')
  // Cyclic-provider guard (Edge <select>-style self-parenting providers).
  expect(py).toContain('rid in ancestor_ids')
  // The re-resolution failure names the recovery path instead of
  // returning a bare False with no diagnosis.
  expect(py).toContain('re-capture accessibility_snapshot')
  // Wired into the dispatch table.
  expect(py).toContain("'uia_invoke_id':")
  expect(py).toContain("'uia_set_value_id':")
})

test('the bridge is per-monitor-v2 DPI aware before COM init, and center clicks stay physical', () => {
  const py = read(BRIDGE)
  expect(py).toContain('_DPI_CONTEXT_PER_MONITOR_AWARE_V2 = -4')
  expect(py).toContain('SetProcessDpiAwarenessContext')
  // Ordering matters: DPI awareness must be set before CoInitializeEx.
  expect(py).toMatch(
    /SetProcessDpiAwarenessContext[\s\S]*?CoInitializeEx/,
  )
  expect(py).toContain('def click_element_center(hwnd_str, x, y)')
  expect(py).toContain("'click_element_center':")
})

test('a provider that ignores child navigation gets a flat-walk cooldown, not a permanent lock', () => {
  const py = read(BRIDGE)
  // Per-hwnd cooldown map + retry interval. A one-way lock froze Chromium/
  // Electron into a hierarchy-less flat tree for the whole process lifetime,
  // even though their accessibility tree materializes asynchronously.
  expect(py).toContain('_FLAT_WALK_ONLY = {}')
  expect(py).toContain('_FLAT_WALK_RETRY_SECONDS = 5.0')
  // Set at the fallback take-over site and checked at snapshot entry.
  expect(py.match(/_FLAT_WALK_ONLY\./g)?.length).toBeGreaterThanOrEqual(2)
  // Healthy recursive walks clear a stale cooldown.
  expect(py).toContain('_FLAT_WALK_ONLY.pop(hwnd, None)')
})

// ── Phase 3 ─────────────────────────────────────────────────────────────────

test('pattern actions are exposed as bridge methods with stderr-diagnosed failures', () => {
  const py = read(BRIDGE)
  expect(py).toContain('def _pattern_act(hwnd_str, rid, act)')
  for (const iface of [
    'iface_expand_collapse',
    'iface_toggle',
    'iface_selection_item',
    'iface_scroll_item',
    'iface_range_value',
  ]) {
    expect(py).toContain(iface)
  }
  for (const method of [
    "'expand_id':",
    "'toggle_id':",
    "'select_id':",
    "'scroll_into_view_id':",
    "'set_range_id':",
  ]) {
    expect(py).toContain(method)
  }
})

test('node ids and RuntimeIds flow through bridgeUia and render as n=', () => {
  const src = read(BRIDGE_UIA)
  expect(src).toContain('k?: number')
  expect(src).toContain('rid?: number[]')
  expect(src).toContain('nodeId?: number')
  expect(src).toContain('runtimeId?: number[]')
  expect(src).toContain('nodeId: typeof n.k === \'number\' && n.k > 0 ? n.k : undefined')
  expect(src).toContain("line += ` n=${node.nodeId}`")
})

test('node lookup supports per-snapshot nodeId matching', () => {
  const src = read(join(CU_ROOT, 'win32/accessibilitySnapshot.ts'))
  expect(src).toContain('nodeId?: number')
  expect(src).toContain('query.nodeId !== undefined && node.nodeId !== query.nodeId')
  expect(src).toContain('export function findNodeById(')
})

test('executor prefers RuntimeId actions, keeps automationId fallbacks, and exposes interactElement', () => {
  const exec = read(EXECUTOR)
  // RuntimeId fast path before the automationId path in clickElement.
  expect(exec).toMatch(/uia_invoke_id[\s\S]*?uia_invoke'/)
  expect(exec).toContain("call('uia_set_value_id'")
  expect(exec).toContain("call('click_element_center'")
  expect(exec).toContain('async interactElement(')
  expect(exec).toContain("scroll_into_view: 'scroll_into_view_id'")
  // nodeId accepted on both element-targeted entry points.
  expect(exec.match(/nodeId/g)?.length).toBeGreaterThanOrEqual(2)
})

test('vendor surface: interact_element tool, nodeId selectors, and tier mapping', () => {
  const tools = read(VENDOR_TOOLS)
  expect(tools).toContain("name: 'interact_element'")
  expect(tools.match(/nodeId/g)?.length).toBeGreaterThanOrEqual(3)

  const vendorExec = read(VENDOR_EXECUTOR)
  expect(vendorExec).toContain('interactElement?(')
  expect(vendorExec.match(/nodeId/g)?.length).toBeGreaterThanOrEqual(3)

  const calls = read(VENDOR_TOOLCALLS)
  expect(calls).toContain('handleInteractElement')
  expect(calls).toContain("case 'interact_element':")
  // Tier mapping follows action risk: viewport-only < click-like < value-set.
  expect(calls).toMatch(
    /case 'interact_element': \{[\s\S]*?'mouse_position'[\s\S]*?'keyboard'[\s\S]*?'mouse'/,
  )
  // nodeId parsed in all three handlers.
  expect(calls.match(/Math\.trunc\(args\.nodeId\)/g)?.length).toBeGreaterThanOrEqual(3)
})

test('ambient ComputerExecutor declaration stays in sync with the vendor interface', () => {
  // optionalModules.d.ts shadows the real package types for tsc; when it
  // drifts, new executor methods vanish from typecheck while runtime keeps
  // working — the exact failure interact_element hit during development.
  const dts = read(OPTIONAL_MODULES_DTS)
  expect(dts).toContain('interactElement?(')
  expect(dts.match(/nodeId/g)?.length).toBeGreaterThanOrEqual(3)
})
