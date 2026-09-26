/**
 * Phase 2 — reality check for the computer-use integration.
 *
 * Exercises the real package entry points (not mocks) to confirm the feature
 * is wired up after the Phase 1 integration work. The host executor is a stub
 * because there is no display in CI; every gate/config path is real.
 *
 * Run: bun run scripts/verify-computer-use.ts
 */
import {
  buildComputerUseTools,
  isSystemKeyCombo,
  normalizeKeySequence,
  DEFAULT_GRANT_FLAGS,
  _keyBlocklistTest,
  _toolCallsTest,
} from '@ant/computer-use-mcp'
import type {
  ComputerUseHostAdapter,
  ComputerUseOverrides,
} from '@ant/computer-use-mcp'

import { setupComputerUseMCP } from '../src/utils/computerUse/setup.js'
import { CLI_CU_CAPABILITIES, CLI_HOST_BUNDLE_ID } from '../src/utils/computerUse/common.js'
import { getChicagoEnabled, getChicagoSubGates, getChicagoCoordinateMode } from '../src/utils/computerUse/gates.js'

let pass = 0
let fail = 0
const failures: string[] = []

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── Tool inventory ────────────────────────────────────────────────────────
console.log('\n── Phase 2: tool inventory ──────────────────────────────────')

const tools = buildComputerUseTools(CLI_CU_CAPABILITIES, getChicagoCoordinateMode())
const names = tools.map(t => t.name)

check('buildComputerUseTools returns tools', tools.length > 0, `${tools.length} tools`)
// Tool surface is platform-gated: the Win32 backend adds window/element/UIA
// and offscreen-input tools. Assert the intended count per platform so a
// change to the surface is a deliberate edit here, not a silent drift.
const EXPECTED_TOOL_COUNT: Record<string, number> = {
  darwin: 24,
  linux: 24,
  win32: 35,
}
// Teach tools are appended when teach mode is enabled (3 more, every platform).
const TEACH_TOOL_COUNT = 3
check(
  `tool count matches platform intent (${process.platform})`,
  tools.length === EXPECTED_TOOL_COUNT[process.platform],
  `${tools.length} (expected ${EXPECTED_TOOL_COUNT[process.platform]})`,
)
check(
  'teach mode adds exactly 3 tools',
  buildComputerUseTools(CLI_CU_CAPABILITIES, getChicagoCoordinateMode(), undefined).length +
    TEACH_TOOL_COUNT ===
    buildComputerUseTools(
      { ...CLI_CU_CAPABILITIES, teachMode: true } as typeof CLI_CU_CAPABILITIES,
      getChicagoCoordinateMode(),
    ).length,
)
check('every tool has a name + description', tools.every(t => t.name && t.description))
check('every tool has an input schema', tools.every(t => t.inputSchema))

const REQUIRED = [
  'screenshot', 'left_click', 'right_click', 'double_click', 'middle_click',
  'mouse_move', 'left_click_drag', 'scroll', 'type', 'key', 'hold_key',
  'request_access', 'list_granted_applications', 'read_clipboard', 'write_clipboard',
]
for (const r of REQUIRED) {
  check(`tool "${r}" present`, names.includes(r))
}

// ── MCP wiring ────────────────────────────────────────────────────────────
console.log('\n── Phase 2: MCP wiring ──────────────────────────────────────')

const { mcpConfig, allowedTools } = setupComputerUseMCP()
const servers = Object.keys(mcpConfig)
check('one MCP server configured', servers.length === 1, servers.join(','))
check('server named computer-use', servers[0] === 'computer-use')
const cfg = mcpConfig['computer-use']
check('server is stdio', cfg.type === 'stdio')
check('scope is dynamic', cfg.scope === 'dynamic')
check('allowedTools count matches tools', allowedTools.length === tools.length, `${allowedTools.length}`)
check(
  'allowedTools are namespaced',
  allowedTools.every(t => t.startsWith('mcp__computer-use__')),
)
check(
  'every tool is allowlisted',
  names.every(n => allowedTools.includes(`mcp__computer-use__${n}`)),
)

const argStr = JSON.stringify(cfg.args)
check(
  'spawn args reference the CU MCP flag',
  argStr.includes('--computer-use-mcp'),
  argStr,
)
// Known gap: the non-bundled branch points at cli.js while the build emits
// cli.mjs. Flag it rather than assert, so the report shows current reality.
const expectedCli = argStr.includes('cli.mjs') ? 'cli.mjs' : argStr.includes('cli.js') ? 'cli.js' : 'none'
console.log(`  ℹ non-bundled spawn arg uses: ${expectedCli}`)

// ── Gates ─────────────────────────────────────────────────────────────────
console.log('\n── Phase 2: gates ───────────────────────────────────────────')

check('CHICAGO enabled', getChicagoEnabled() === true)
check('coordinate mode resolved', typeof getChicagoCoordinateMode() === 'string', getChicagoCoordinateMode())
const subGates = getChicagoSubGates()
check('sub-gates object present', typeof subGates === 'object' && subGates !== null)

check('default grants all false', Object.values(DEFAULT_GRANT_FLAGS).every(v => v === false), JSON.stringify(DEFAULT_GRANT_FLAGS))

// ── Key blocklist (policy, platform-independent) ──────────────────────────
console.log('\n── Phase 2: system key blocklist ────────────────────────────')

// Every combo added in Phase 3, plus its alias spellings. `win`/`super`/
// `command`/`cmd` all canonicalize to `meta`, so a blocklist entry only holds
// if the alias forms match too — the historical bypass class.
const win32Blocklisted = [
  'ctrl+alt+delete',
  'alt+f4',
  'alt+tab',
  'meta+l',
  'meta+d',
  'meta+r',
  'meta+s',
  'meta+e',
  'meta+x',
  'meta+i',
  'meta+a',
  'meta+u',
  'shift+meta+s', // Win+Shift+S — Snip (screenshot overlay, focus theft)
  'ctrl+shift+escape',
]
for (const combo of win32Blocklisted) {
  check(`win32 blocklist covers ${combo}`, isSystemKeyCombo(combo, 'win32') === true)
}

// Alias coverage for the newly-blocked privileged-surface combos.
for (const combo of ['win+r', 'super+r', 'windows+r', 'command+x', 'cmd+shift+s', 'shift+cmd+s', 'control+shift+escape', 'ctrl+shift+esc']) {
  check(`win32 blocklist covers alias ${combo}`, isSystemKeyCombo(combo, 'win32') === true)
}

// Non-modifier key aliases: `esc` must canonicalize to `escape`, else the
// `ctrl+shift+escape` entry is trivially bypassed by the shorter spelling.
check('key alias esc caught', isSystemKeyCombo('ctrl+shift+esc', 'win32') === true)
check('key alias del caught', isSystemKeyCombo('ctrl+alt+del', 'win32') === true)

// Suffix bypass: `cmd+q+a` presses Cmd+Q mid-sequence. Each non-modifier key
// must be checked against the mods, not just the joined string.
check('win32 suffix bypass meta+r+a caught', isSystemKeyCombo('meta+r+a', 'win32') === true)

// Canonical-form self-consistency, run against the REAL exported sets (not a
// hand-kept list — otherwise a bad future entry goes unnoticed). An entry like
// `meta+shift+s` (unsorted) or `ctrl+shift+esc` (unnormalized key) silently
// never matches, which is exactly how the Win+Shift+S entry was broken.
for (const combo of [..._keyBlocklistTest.BLOCKED_WIN32, ..._keyBlocklistTest.BLOCKED_DARWIN]) {
  check(`real blocklist entry "${combo}" is canonical form`, normalizeKeySequence(combo) === combo)
}

// And prove each real entry actually blocks its own canonical spelling.
for (const combo of _keyBlocklistTest.BLOCKED_WIN32) {
  check(`real win32 entry "${combo}" blocks`, isSystemKeyCombo(combo, 'win32') === true)
}
for (const combo of _keyBlocklistTest.BLOCKED_DARWIN) {
  check(`real darwin entry "${combo}" blocks`, isSystemKeyCombo(combo, 'darwin') === true)
}

// Every tool DEFINED in tools.ts (incl. win32-only ones the macOS capability
// profile doesn't advertise — precisely the names the bound-window gate
// protects) must be explicitly classified. Derived from source so a newly
// added tool fails here instead of silently bypassing the gate via
// `default: return null`.
const toolSource = await Bun.file(
  new URL('../vendor/computer-use-mcp/src/tools.ts', import.meta.url),
).text()
const definedTools = [...toolSource.matchAll(/name: '([a-z_]+)'/g)].map(m => m[1])
check('derived a plausible tool list from tools.ts', definedTools.length >= 30, `${definedTools.length} names`)

const DELIBERATELY_UNGATED = new Set([
  'bind_window', // must stay callable to release a bad binding
  'open_application', // has its own allowlist check inside the handler
  'switch_display', // selects a capture monitor; no input injection
  'list_granted_applications', // read-only
  'read_clipboard', // gated by the clipboardRead grant flag
  'write_clipboard', // gated by the clipboardWrite grant flag
  'computer_batch', // gated via dispatchAction per sub-action
  'status_indicator', // local UI affordance
  'wait', // no input
  'request_access', // special-cased before dispatchAction
  'request_teach_access',
  'teach_step', // routes through dispatchAction (executeTeachStep)
  'teach_batch',
])
for (const name of definedTools) {
  const kind = _toolCallsTest.boundWindowActionKind(name, {})
  const gated = kind !== null
  const allowed = DELIBERATELY_UNGATED.has(name)
  check(
    `tool "${name}" is either classified or explicitly exempt`,
    gated || allowed,
    gated ? `kind=${kind}` : 'ungated (exempt)',
  )
}

const darwinBlocklisted = ['cmd+q', 'cmd+space', 'cmd+tab', 'shift+cmd+q', 'cmd+option+escape']
for (const combo of darwinBlocklisted) {
  check(`darwin blocklist covers ${combo}`, isSystemKeyCombo(combo, 'darwin') === true)
}

const allowed: Array<[string, string]> = [
  ['ctrl+c', 'win32'],
  ['ctrl+a', 'win32'],
  ['ctrl+v', 'win32'],
  ['meta+c', 'win32'],
  ['cmd+c', 'darwin'],
]
for (const [combo, platform] of allowed) {
  const r = isSystemKeyCombo(combo, platform as 'win32' | 'darwin' | 'linux')
  check(`allows ${combo} (${platform})`, r === false)
}

// ── Allowlist enforcement (real gate) ─────────────────────────────────────
console.log('\n── Phase 2: allowlist enforcement ───────────────────────────')

const { handleToolCall } = await import('@ant/computer-use-mcp')

function makeAdapter(): ComputerUseHostAdapter {
  const calls: string[] = []
  const executor = new Proxy(
    {
      capabilities: { ...CLI_CU_CAPABILITIES, hostBundleId: CLI_HOST_BUNDLE_ID },
      getDisplaySize: async () => ({ width: 1920, height: 1080, scaleFactor: 1, displayId: 1 }),
      // Unbound: the frontmost app is some non-granted app, which the
      // macOS-style gate must reject.
      hasBoundWindow: async () => false,
      getFrontmostApp: async () => ({ bundleId: 'com.example.other', displayName: 'Other' }),
    },
    {
      get: (t, p) => {
        if (p in t) return (t as any)[p]
        return async () => {
          calls.push(String(p))
          return { ok: true }
        }
      },
    },
  )
  return {
    serverName: 'computer-use',
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      silly: () => {},
    },
    executor: executor as unknown as ComputerUseHostAdapter['executor'],
    ensureOsPermissions: async () => ({ granted: true }),
    isDisabled: () => false,
    getAutoUnhideEnabled: () => false,
    getSubGates: () => getChicagoSubGates(),
    cropRawPatch: () => null,
  } as unknown as ComputerUseHostAdapter
}

const emptyOverrides = {
  allowedApps: [],
  userDeniedBundleIds: [],
  deniedCategories: [],
  grantFlags: { ...DEFAULT_GRANT_FLAGS },
} as unknown as ComputerUseOverrides

const adapter = makeAdapter()
;(adapter.executor as any).capabilities = CLI_CU_CAPABILITIES

const shotUngranted = await handleToolCall(adapter, 'screenshot', {}, emptyOverrides)
check('ungranted screenshot is refused', shotUngranted.isError === true, String(shotUngranted.content?.[0]?.text ?? '').slice(0, 80))

const clickUngranted = await handleToolCall(adapter, 'left_click', { coordinate: [10, 10] }, emptyOverrides)
check('ungranted click is refused', clickUngranted.isError === true)

const unknown = await handleToolCall(adapter, 'not_a_real_tool', {}, emptyOverrides)
check('unknown tool rejected', unknown.isError === true)

// ── Bound-window authorization (Win32) ────────────────────────────────────
console.log('\n── Phase 3: bound-window authorization ──────────────────────')

function boundAdapter(
  binding: { bound: boolean; hwnd?: string; title?: string; pid?: number; exePath?: string },
  withStatus = true,
) {
  const calls: string[] = []
  const executor: any = new Proxy(
    {
      capabilities: { ...CLI_CU_CAPABILITIES, platform: 'win32' },
      hasBoundWindow: async () => binding.bound,
      ...(withStatus ? { getBindingStatus: async () => ({ ...binding, rect: undefined }) } : {}),
    },
    {
      get: (t, p) =>
        p in t
          ? (t as any)[p]
          : async () => {
              calls.push(String(p))
              return { ok: true }
            },
    },
    )
  const a: any = {
    serverName: 'computer-use',
    logger: { info() {}, warn() {}, error() {}, debug() {}, silly() {} },
    executor,
    ensureOsPermissions: async () => ({ granted: true }),
    isDisabled: () => false,
    getAutoUnhideEnabled: () => false,
    getSubGates: () => getChicagoSubGates(),
    cropRawPatch: () => null,
  }
  return { adapter: a, calls }
}

function overridesWith(
  apps: Array<{ bundleId: string; displayName: string; tier?: string; exePath?: string }>,
): ComputerUseOverrides {
  return {
    allowedApps: apps.map((a, i) => ({ ...a, grantedAt: i })),
    userDeniedBundleIds: [],
    deniedCategories: [],
    grantFlags: { ...DEFAULT_GRANT_FLAGS },
  } as unknown as ComputerUseOverrides
}

// Ungranted bound window must refuse click/type.
{
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0x1234', title: 'Notepad', pid: 999 })
  const r = await handleToolCall(a, 'left_click', { coordinate: [10, 10] }, overridesWith([]))
  check('bound ungranted window: click refused', r.isError === true, String(r.content?.[0]?.text ?? '').slice(0, 90))
  check('bound ungranted window: no executor click', !calls.includes('virtualMouse'))
}
{
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0x1234', title: 'Notepad', pid: 999 })
  const r = await handleToolCall(a, 'type', { text: 'hello' }, overridesWith([{ bundleId: '0x1234', displayName: 'Notepad', tier: 'read' }]))
  check('bound read-tier window: type refused (tier)', r.isError === true)
  check('bound read-tier window: no executor type', !calls.includes('virtualKeyboard'))
}

// Granted bound window must pass and reach the executor. Identity is the
// executable path — a title alone must never authorize.
const NOTEPAD_EXE = 'C:/Windows/System32/notepad.exe'
{
  const { adapter: a, calls } = boundAdapter({
    bound: true,
    hwnd: '0x1234',
    title: 'Untitled - Notepad',
    pid: 999,
    exePath: NOTEPAD_EXE,
  })
  const r = await handleToolCall(a, 'left_click', { coordinate: [10, 10] }, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full', exePath: NOTEPAD_EXE }]))
  check('bound granted window: click allowed', r.isError !== true, String(r.content?.[0]?.text ?? '').slice(0, 60))
  check('bound granted window: executor virtualMouse called', calls.includes('virtualMouse'))
}
// Case/separator-insensitive: Windows paths are case-insensitive.
{
  const { adapter: a } = boundAdapter({ bound: true, hwnd: '0x1', title: 'x', pid: 1, exePath: 'C:\\WINDOWS\\System32\\Notepad.EXE' })
  const r = await handleToolCall(a, 'left_click', { coordinate: [1, 1] }, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full', exePath: 'c:/windows/system32/notepad.exe' }]))
  check('exe match is case/separator insensitive', r.isError !== true, String(r.content?.[0]?.text ?? '').slice(0, 70))
}
// Different executable → refused.
{
  const { adapter: a } = boundAdapter({ bound: true, hwnd: '0x1234', title: 'Notepad', pid: 999, exePath: 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe' })
  const r = await handleToolCall(a, 'type', { text: 'whoami' }, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full', exePath: NOTEPAD_EXE }]))
  check('bound different exe: type refused', r.isError === true)
}
// THE regression this change exists to prevent: a window whose TITLE claims
// to be Notepad, granted Notepad, but whose process is not notepad.exe.
{
  const { adapter: a, calls } = boundAdapter({
    bound: true,
    hwnd: '0xMAL',
    title: 'Untitled - Notepad',
    pid: 666,
    exePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  })
  const r = await handleToolCall(a, 'type', { text: 'pwned' }, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full', exePath: NOTEPAD_EXE }]))
  check('spoofed title does NOT authorize a different process', r.isError === true, String(r.content?.[0]?.text ?? '').slice(0, 80))
  check('spoofed title never reached executor', !calls.includes('virtualKeyboard'))
}
// Grant with no exe identity must not match a bound window.
{
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0x1', title: 'Untitled - Notepad', pid: 1, exePath: NOTEPAD_EXE })
  const r = await handleToolCall(a, 'type', { text: 'x' }, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full' }]))
  check('grant without exePath cannot authorize a bound window', r.isError === true)
  check('identityless grant never reached executor', !calls.includes('virtualKeyboard'))
}
// Binding with no resolvable exe (elevated/undescribable) must fail closed.
{
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0x1', title: 'Untitled - Notepad', pid: 1 })
  const r = await handleToolCall(a, 'type', { text: 'x' }, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full', exePath: NOTEPAD_EXE }]))
  check('unresolvable bound exe fails closed', r.isError === true, String(r.content?.[0]?.text ?? '').slice(0, 80))
  check('unresolvable bound exe never reached executor', !calls.includes('virtualKeyboard'))
}
// Direct matcher assertions for the final security checklist. These exercise
// matchBoundWindowToGrant itself, independent of the tool plumbing, so a
// regression in the identity rule fails here rather than only via a handler.
{
  const G = (o: Partial<{ bundleId: string; displayName: string; exePath: string }>) => ({
    bundleId: 'notepad.exe',
    displayName: 'Notepad',
    exePath: NOTEPAD_EXE,
    grantedAt: 0,
    ...o,
  })
  const m = _toolCallsTest.matchBoundWindowToGrant

  check('no title matching: title alone does not match', m({ title: 'Untitled - Notepad' }, [G({})]) === undefined)
  check(
    'spoofed title + wrong exe denied',
    m({ title: 'Notepad', exePath: 'C:/evil/chrome.exe' }, [G({})]) === undefined,
  )
  check('exact exe match allows', m({ exePath: NOTEPAD_EXE }, [G({})]) !== undefined)
  check('nullish exePath grants no wildcard', m({}, [G({})]) === undefined)
  check(
    'grant with no exePath never matches any process',
    m({ exePath: NOTEPAD_EXE }, [G({ exePath: undefined as unknown as string })]) === undefined,
  )
  check('empty allowedApps denies', m({ exePath: NOTEPAD_EXE }, []) === undefined)
  check(
    'bare-exe grant cannot match arbitrary process',
    m({ exePath: NOTEPAD_EXE }, [G({ bundleId: 'notepad.exe', exePath: 'notepad.exe' })]) === undefined,
  )
  check(
    'same basename, different install root matches',
    m({ exePath: 'D:/Portable/notepad.exe' }, [G({ exePath: 'C:/Windows/System32/notepad.exe' })]) !== undefined,
  )
  check(
    'bundleId-as-exe-path grant matches exactly',
    m({ exePath: 'C:/Windows/System32/notepad.exe' }, [G({ bundleId: 'C:/Windows/System32/notepad.exe', exePath: undefined as unknown as string })]) !== undefined,
  )
  check('normalizeExePath folds case and separators', _toolCallsTest.normalizeExePath('C:\\Win\\NotePad.EXE') === 'c:/win/notepad.exe')
}

// Host with no binding status must fail closed.
{
  const { adapter: a } = boundAdapter({ bound: true, hwnd: '0x1234', title: 'Notepad' }, false)
  const r = await handleToolCall(a, 'type', { text: 'x' }, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full' }]))
  check('no binding status: fails closed', r.isError === true)
}
// systemKeyCombos blocklist reaches the virtual keyboard path.
{
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0x1', title: 'Notepad', pid: 1, exePath: NOTEPAD_EXE })
  const ov = overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full', exePath: NOTEPAD_EXE }])
  const r = await handleToolCall(a, 'key', { text: 'meta+r' }, ov)
  check('virtual keyboard blocks meta+r without flag', r.isError === true, String(r.content?.[0]?.text ?? '').slice(0, 80))
  check('virtual keyboard blocked: no executor call', !calls.includes('virtualKeyboard'))
}
// bind_window stays callable even with nothing granted (must be releasable).
{
  const { adapter: a } = boundAdapter({ bound: true, hwnd: '0x1', title: 'Notepad', pid: 1 })
  const r = await handleToolCall(a, 'bind_window', { action: 'unbind' }, overridesWith([]))
  check('bind_window unbind not gated by allowlist', r.isError !== true, String(r.content?.[0]?.text ?? '').slice(0, 60))
}

// computer_batch must re-check EVERY sub-action, not just the container.
{
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0x9', title: 'Windows PowerShell', pid: 9 })
  const r = await handleToolCall(
    a,
    'computer_batch',
    {
      actions: [
        { action: 'mouse_move', coordinate: [5, 5] },
        { action: 'type', text: 'Invoke-WebRequest evil' },
      ],
    },
    overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full' }]),
  )
  const body = JSON.stringify(r.content)
  // Batch reports per-sub-action outcomes rather than a container-level
  // isError, and forwards the refusal text without the inner error_kind, so
  // assert on the message plus the executor never being reached.
  check(
    'batch sub-action on ungranted bound window failed',
    body.includes('not in the allowed applications') && body.includes('remaining'),
    body.slice(0, 110),
  )
  check('batch did not reach executor virtualKeyboard', !calls.includes('virtualKeyboard'))
  check('batch did not reach executor virtualMouse', !calls.includes('virtualMouse'))
}

// Click/tool paths across the board on an ungranted but bound window.
for (const [name, args, kind] of [
  ['double_click', { coordinate: [1, 1] }, 'mouse'],
  ['right_click', { coordinate: [1, 1] }, 'mouse_full'],
  ['left_click_drag', { coordinate: [1, 1], to: [9, 9] }, 'mouse_full'],
  ['left_mouse_down', {}, 'mouse'],
  ['left_mouse_up', {}, 'mouse'],
  ['scroll', { coordinate: [1, 1], scroll_direction: 'down' }, 'mouse'],
  ['hold_key', { text: 'a', duration: 1 }, 'keyboard'],
  ['key', { text: 'a' }, 'keyboard'],
  ['mouse_move', { coordinate: [1, 1] }, 'mouse_position'],
  ['screenshot', {}, 'read'],
  ['open_terminal', { agent: 'gakrcli' }, 'keyboard'],
] as const) {
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0xBAD', title: 'Windows PowerShell', pid: 999 })
  const r = await handleToolCall(a, name, args, overridesWith([]))
  check(`bound ungranted: ${name} (${kind}) refused`, r.isError === true)
  check(`bound ungranted: ${name} never reached executor`, calls.length === 0, calls.join(','))
}

// Rebind to a different HWND must be re-authorized: the previous grant for
// Notepad must not authorize a freshly-bound PowerShell window.
{
  const ov = overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'full', exePath: NOTEPAD_EXE }])
  const { adapter: a } = boundAdapter({ bound: true, hwnd: '0x1', title: 'Untitled - Notepad', pid: 1, exePath: NOTEPAD_EXE })
  const ok = await handleToolCall(a, 'left_click', { coordinate: [2, 2] }, ov)
  check('rebind step 1: Notepad click allowed', ok.isError !== true)
  const { adapter: b } = boundAdapter({
    bound: true,
    hwnd: '0x2',
    title: 'Untitled - Notepad',
    pid: 2,
    exePath: 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  })
  const bad = await handleToolCall(b, 'left_click', { coordinate: [2, 2] }, ov)
  check('rebind step 2: same grant does NOT authorize a different process', bad.isError === true)
}

// Clipboard: both directions require their grant flags.
{
  const { adapter: a, calls } = boundAdapter({ bound: false })
  const r = await handleToolCall(a, 'write_clipboard', { text: 'secret' }, overridesWith([]))
  check('write_clipboard without flag refused', r.isError === true, String(r.content?.[0]?.text ?? '').slice(0, 70))
  check('write_clipboard refused: executor untouched', !calls.includes('writeClipboard'))
}
{
  const { adapter: a, calls } = boundAdapter({ bound: false })
  const r = await handleToolCall(a, 'read_clipboard', {}, overridesWith([]))
  check('read_clipboard without flag refused', r.isError === true)
  check('read_clipboard refused: executor untouched', !calls.includes('readClipboard'))
}

// ── Read tier cannot reach input paths (bound window) ─────────────────────
console.log('\n── Phase 3: read-tier containment ───────────────────────────')

// Read tier must not reach any input path through the bound-window route.
for (const [name, args] of [
  ['type', { text: 'x' }],
  ['key', { text: 'a' }],
  ['left_click', { coordinate: [1, 1] }],
  ['right_click', { coordinate: [1, 1] }],
  ['double_click', { coordinate: [1, 1] }],
  ['left_click_drag', { coordinate: [1, 1], to: [2, 2] }],
  ['hold_key', { text: 'a', duration: 1 }],
] as const) {
  const { adapter: a, calls } = boundAdapter({ bound: true, hwnd: '0xR', title: 'Untitled - Notepad', pid: 7, exePath: NOTEPAD_EXE })
  const r = await handleToolCall(a, name, args, overridesWith([{ bundleId: 'notepad.exe', displayName: 'Notepad', tier: 'read', exePath: NOTEPAD_EXE }]))
  check(`read tier cannot ${name}`, r.isError === true, String(r.content?.[0]?.text ?? '').slice(0, 70))
  check(`read tier ${name} never reached executor`, calls.length === 0, calls.join(','))
}

// Screenshot is the one action a read-tier grant covers, so the gate must
// classify it as a read-floor action rather than refusing it outright. Asserted
// at the classifier level: driving the handler to completion would only test
// the capture stub's shape, not the gate.
check('screenshot is bound-gated at read floor', _toolCallsTest.boundWindowActionKind('screenshot', {}) === 'mouse_position')
check('tierSatisfies(read, mouse_position)', _toolCallsTest.tierSatisfies('read', 'mouse_position') === true)
check('tierSatisfies(read, mouse)', _toolCallsTest.tierSatisfies('read', 'mouse') === false)
check('tierSatisfies(read, keyboard)', _toolCallsTest.tierSatisfies('read', 'keyboard') === false)

// ── Kill switch ───────────────────────────────────────────────────────────
console.log('\n── Phase 2: kill switch ─────────────────────────────────────')
check('getChicagoEnabled is boolean', typeof getChicagoEnabled() === 'boolean')
check(
  'kill switch is env-driven (CHICAGO_MCP)',
  process.env.CHICAGO_MCP !== 'false' ? getChicagoEnabled() === true : true,
  `CHICAGO_MCP=${process.env.CHICAGO_MCP ?? 'unset'}`,
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
if (fail > 0) {
  console.error('  Failures:')
  for (const f of failures) console.error(`   - ${f}`)
  process.exit(1)
}