/**
 * Guards the fix for the Windows Computer Use "not installed" bug.
 *
 * The backends must not call Bun globals directly: the supported runtime is
 * Node, where they are `undefined` and throw `ReferenceError: Bun is not
 * defined`. Those errors were swallowed and surfaced as "app not installed".
 * Every process/file access has to go through `bunCompat`, which delegates to
 * the real Bun APIs when running under Bun.
 *
 * A scanner (rather than a runtime check) because the failing call sites are
 * platform-gated — they never execute in CI on Linux, so only static
 * inspection catches a regression.
 */
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const COMPAT_FILE = join(ROOT, 'bunCompat.ts')

// Only the globals the compat layer replaces. `Bun.wrapAnsi`, `Bun.hash`, etc.
// are unrelated and used elsewhere with their own guards.
const GUARDED_GLOBALS = [
  'Bun.spawn',
  'Bun.spawnSync',
  'Bun.file',
  'Bun.embeddedFiles',
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'fixtures') continue
      out.push(...walk(full))
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

// Strip line comments so prose like "runs it via Bun.spawnSync" doesn't trip
// the scan.
function codeLines(source: string): Array<{ line: number; text: string }> {
  return source
    .split('\n')
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => {
      const t = text.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
}

test('computer-use backends do not call Bun globals directly', () => {
  const offenders: string[] = []

  for (const file of walk(ROOT)) {
    if (file === COMPAT_FILE) continue
    for (const { line, text } of codeLines(readFileSync(file, 'utf8'))) {
      for (const g of GUARDED_GLOBALS) {
        if (text.includes(g)) {
          offenders.push(`${file.replace(ROOT + '/', '')}:${line} → ${g}`)
        }
      }
    }
  }

  expect(offenders).toEqual([])
})
