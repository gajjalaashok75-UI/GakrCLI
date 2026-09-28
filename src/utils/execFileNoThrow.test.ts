import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function importFreshExecFileNoThrowModule() {
  return import(`./execFileNoThrow.ts?ts=${Date.now()}-${Math.random()}`)
}

test('execFileNoThrowWithCwd rejects shell-like executable names', async () => {
  const { execFileNoThrowWithCwd } = await importFreshExecFileNoThrowModule()
  const result = await execFileNoThrowWithCwd('gakrcli && whoami', [])

  expect(result.code).toBe(1)
  expect(result.error).toContain('Unsafe executable')
})

test('execFileNoThrowWithCwd rejects cwd values with control characters', async () => {
  const { execFileNoThrowWithCwd } = await importFreshExecFileNoThrowModule()
  const result = await execFileNoThrowWithCwd(process.execPath, ['--version'], {
    cwd: 'C:\\repo\nmalicious',
  })

  expect(result.code).toBe(1)
  expect(result.error).toContain('Unsafe working directory')
})

test('execFileNoThrowWithCwd rejects arguments with control characters', async () => {
  const { execFileNoThrowWithCwd } = await importFreshExecFileNoThrowModule()
  const result = await execFileNoThrowWithCwd(process.execPath, [
    '--version\nmalicious',
  ])

  expect(result.code).toBe(1)
  expect(result.error).toContain('Unsafe argument')
})

test('execFileNoThrowWithCwd rejects environment entries with control characters', async () => {
  const { execFileNoThrowWithCwd } = await importFreshExecFileNoThrowModule()
  const result = await execFileNoThrowWithCwd(process.execPath, ['--version'], {
    env: {
      ...process.env,
      BAD_ENV: 'line1\nline2',
    },
  })

  expect(result.code).toBe(1)
  expect(result.error).toContain('Unsafe environment')
})

test('execFileNoThrowWithCwd preserves Windows .cmd compatibility', async () => {
  if (process.platform !== 'win32') {
    return
  }
  const { execFileNoThrowWithCwd } = await importFreshExecFileNoThrowModule()

  const dir = mkdtempSync(join(tmpdir(), 'gakrcli-execfile-'))
  try {
    const file = join(dir, 'hello.cmd')
    writeFileSync(file, '@echo off\r\necho hello\r\n')

    const result = await execFileNoThrowWithCwd(file, [])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('hello')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('execFileNoThrowWithCwd resolves (never throws) for a missing binary', async () => {
  const { execFileNoThrowWithCwd } = await importFreshExecFileNoThrowModule()

  // ENOENT must surface as a normal handled result — callers probe optional
  // binaries (gh, clip, ...) and treat code!==0 as "not available".
  const result = await execFileNoThrowWithCwd('gakrcli-definitely-not-a-binary', [
    '--version',
  ])

  expect(result.code).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.error).toContain('ENOENT')
})
