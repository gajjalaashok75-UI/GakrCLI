/**
 * Phase 1 verification: integration is reproducible from a clean checkout.
 *
 * Run: bun run scripts/verify-integration.ts
 */
import { existsSync } from 'fs'
import * as path from 'path'

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

const root = path.resolve(import.meta.dir, '..')

console.log('\n── Phase 1: integration ──────────────────────────────────────')

// 1. Vendored sources are tracked (not living in the gitignored node_modules).
for (const pkg of [
  'computer-use-mcp',
  'computer-use-swift',
  'computer-use-input',
]) {
  const pkgJson = path.join(root, 'vendor', pkg, 'package.json')
  check(`vendor/${pkg} present`, existsSync(pkgJson))
}

// 2. package.json declares them as file: deps so a clean clone installs them.
const pkg = await Bun.file(path.join(root, 'package.json')).json()
for (const name of [
  '@ant/computer-use-mcp',
  '@ant/computer-use-swift',
  '@ant/computer-use-input',
]) {
  const spec = pkg.dependencies?.[name]
  check(`${name} is a file: dependency`, typeof spec === 'string' && spec.startsWith('file:vendor/'), String(spec))
}

// 3. They resolve from node_modules after install.
for (const name of [
  '@ant/computer-use-mcp',
  '@ant/computer-use-swift',
  '@ant/computer-use-input',
]) {
  let resolved: string | null = null
  try {
    resolved = require.resolve(name, { paths: [root] })
  } catch {
    resolved = null
  }
  check(`${name} resolves`, loaded(resolved))
}

  // 4. bridge.js ships next to the bundle and is the real script.
  const distBridge = path.join(root, 'dist', 'computerUse', 'bridge.js')
  check('dist/computerUse/bridge.js exists', existsSync(distBridge))
  if (existsSync(distBridge)) {
    const text = await Bun.file(distBridge).text()
    check('bridge.js is the real script', text.includes('readline') && text.length > 1000, `${text.length} bytes`)
  }

  // 5. No build-machine absolute paths leaked into the bundle.
  const bundlePath = path.join(root, 'dist', 'cli.mjs')
  if (existsSync(bundlePath)) {
    const bundle = await Bun.file(bundlePath).text()
    const leaked = bundle.match(new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/src`, 'g'))
    check('no hardcoded src absolute paths in bundle', !leaked, leaked ? `${leaked.length} occurrences` : '')
    check(
      'bundle resolves bridge via distRoot',
      bundle.includes('computerUse') && !bundle.includes('join(__dirname, "bridge.py")'),
    )
  } else {
    check('dist/cli.mjs exists', false, 'run `bun run build` first')
  }

  // 6. Assets are copied by build.ts.
  const buildSrc = await Bun.file(path.join(root, 'scripts', 'build.ts')).text()
  check('build.ts compiles bridge.ts', buildSrc.includes('dist/computerUse/bridge.js'))

console.log(`\n  ${pass} passed, ${fail} failed\n`)
if (fail > 0) {
  console.error('  Failures:')
  for (const f of failures) console.error(`   - ${f}`)
  process.exit(1)
}

function loaded(p: string | null): boolean {
  return typeof p === 'string' && p.length > 0
}