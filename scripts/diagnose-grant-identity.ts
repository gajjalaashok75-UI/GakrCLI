/**
 * Windows grant-identity diagnostic — run ON A WINDOWS MACHINE.
 *
 *   bun run scripts/diagnose-grant-identity.ts
 *
 * Answers the pre-PR question "does a grant for <common app> actually carry an
 * exePath?", which decides whether bound-window input works at all for that
 * app. A grant without exePath is denied by design (identity is the
 * executable, not the window title), so a run of NO here is a real usability
 * bug, not a cosmetic one.
 *
 * Also reports, for each RUNNING process, the path the gate would read via
 * getProcessImagePath, so you can compare the grant side against the binding
 * side. Elevated processes are expected to differ.
 */
import { createCrossPlatformExecutor } from '../src/utils/computerUse/executorCrossPlatform.js'
import { getProcessImagePath } from '../src/utils/computerUse/win32/windowEnum.js'

const COMMON_APPS = [
  'Chrome',
  'Edge',
  'Firefox',
  'Visual Studio Code',
  'Notepad',
  'Windows Terminal',
  'Explorer',
]

if (process.platform !== 'win32') {
  console.error(`This diagnostic is Windows-only (running on ${process.platform}).`)
  process.exit(1)
}

const executor = createCrossPlatformExecutor({
  getMouseAnimationEnabled: () => false,
  getHideBeforeActionEnabled: () => false,
})
const installed = await executor.listInstalledApps()

console.log(`\n── Installed apps enumerated: ${installed.length} ──────────────\n`)
console.log('GRANT SIDE (what request_access would store as exePath)')
console.log('─'.repeat(78))
console.log('app'.padEnd(24) + 'exePath resolved?'.padEnd(18) + 'path')
console.log('─'.repeat(78))

let missing = 0
for (const requested of COMMON_APPS) {
  const needle = requested.toLowerCase().replace(/\.exe$/, '')
  const match = installed.find(
    a =>
      a.displayName.toLowerCase().includes(needle) ||
      needle.includes(a.displayName.toLowerCase()),
  )
  if (!match) {
    console.log(requested.padEnd(24) + 'NO (not found)'.padEnd(18) + '—')
    missing++
    continue
  }
  const ok = Boolean(match.exePath)
  if (!ok) missing++
  console.log(
    requested.padEnd(24) + (ok ? 'YES' : 'NO ← breaks bind').padEnd(18) + (match.exePath ?? '—'),
  )
}

console.log('─'.repeat(78))
console.log(
  missing === 0
    ? 'All common apps resolved an exePath.'
    : `${missing} common app(s) have NO exePath — bound input will deny for these.`,
)

console.log('\nBINDING SIDE (what getBindingStatus would read for a live PID)')
console.log('─'.repeat(78))
console.log('pid'.padEnd(10) + 'exePath')
console.log('─'.repeat(78))

for (const app of await executor.listRunningApps().catch(() => [])) {
  if (app.pid === undefined) continue
  const exe = getProcessImagePath(app.pid)
  console.log(String(app.pid).padEnd(10) + (exe ?? 'UNRESOLVED (elevated or exited)'))
  void app
}
console.log('─'.repeat(78))
console.log('\nElevated processes reporting UNRESOLVED is expected: the gate denies.')
console.log('UWP/Store apps (Settings, Calculator, Photos) have no exePath by design;')
console.log('their windows are owned by ApplicationFrameHost.exe, so they deny predictably.')
