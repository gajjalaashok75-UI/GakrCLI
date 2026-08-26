import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import treeKill from 'tree-kill'

const repoRoot = resolve(import.meta.dir, '..', '..')
const cliEntrypoint = join(repoRoot, 'src', 'entrypoints', 'cli.tsx')
// Each case cold-starts the CLI from source, which costs ~10s on Windows
// (module-graph transpile + AV scan). This watchdog only exists to stop a
// genuine hang from wedging the suite — it is not a latency assertion, so keep
// it far above the real startup cost.
const cliTimeoutMs = 60_000

async function readStream(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  const cancel = () => void reader.cancel().catch(() => {})
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

async function runSkillsList(args: string[]): Promise<{
  exitCode: number
  stderr: string
  stdout: string
}> {
  const root = mkdtempSync(join(tmpdir(), 'gakrcli-skills-cli-'))
  try {
    const homeDir = join(root, 'home')
    // The project dir must live UNDER the fake home. getProjectDirsUpToHome()
    // walks cwd upwards and stops at homedir(); if cwd is not inside the fake
    // home the walk runs past it to the filesystem root. On Windows tmpdir() is
    // itself inside the real profile, so that walk reaches C:\Users\<user> and
    // loads the developer's own .gakrcli/.claude skills — the "Skills: 0
    // enabled" assertions then see every skill installed on the machine.
    const projectDir = join(homeDir, 'project')
    const configDir = join(root, 'config')
    mkdirSync(projectDir, { recursive: true })

    const proc = Bun.spawn({
      cmd: [process.execPath, cliEntrypoint, ...args],
      cwd: projectDir,
      env: {
      ...process.env,
      GAKR_CODE_USE_OPENAI: '1',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_API_KEY: '',
      GAKR_CONFIG_DIR: configDir,
      HOME: homeDir,
      // os.homedir() reads USERPROFILE on Windows and ignores HOME, so setting
      // HOME alone leaves homedir() pointing at the real profile and the
      // upward project walk above never terminates. Same both-vars pattern as
      // skills/loadSkillsDir.test.ts.
      USERPROFILE: homeDir,
      GAKR_DISABLE_EARLY_INPUT: '1',
      },
      stderr: 'pipe',
      stdout: 'pipe',
    })

    const streamAbort = new AbortController()
    let exited = false
    const processExit = proc.exited.finally(() => {
      exited = true
    })
    let termination: Promise<void> | undefined
    const terminate = (): Promise<void> => {
      if (termination) return termination
      streamAbort.abort()
      termination = new Promise(resolve => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          resolve()
        }
        const fallback = setTimeout(() => {
          try {
            proc.kill('SIGKILL')
          } catch {
            // The process may already have exited while tree-kill was running.
          } finally {
            finish()
          }
        }, 500)
        treeKill(proc.pid, 'SIGKILL', error => {
          clearTimeout(fallback)
          if (error && !exited) {
            try {
              proc.kill('SIGKILL')
            } catch {
              // The process may have exited between tree-kill and the fallback.
            }
          }
          finish()
        })
      })
      return termination
    }
    let watchdog: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      watchdog = setTimeout(() => {
        void terminate().finally(() => {
          reject(new Error(`skills CLI timed out after ${cliTimeoutMs}ms`))
        })
      }, cliTimeoutMs)
    })
    try {
      const [stdout, stderr, exitCode] = await Promise.race([
        Promise.all([
          readStream(proc.stdout, streamAbort.signal),
          readStream(proc.stderr, streamAbort.signal),
          processExit,
        ]),
        timeout,
      ])

      return { exitCode, stderr, stdout }
    } finally {
      if (watchdog) clearTimeout(watchdog)
      if (!exited) {
        await terminate()
        await Promise.race([
          processExit.catch(() => undefined),
          new Promise(resolve => setTimeout(resolve, 1_000)),
        ])
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// initUserDirs() seeds assets/skills into a fresh config home on every start,
// so a pristine GAKR_CONFIG_DIR legitimately lists the bundled skills. These
// cases are about the skills subcommand running at all without provider
// startup validation, so match the listing header rather than an exact count.
// Only --bare, which skips auto-discovery, can assert an empty listing.
//
// The negative cases must also match on this pattern, not on a literal
// "Skills: 0 enabled": with seeded assets that literal never appears, so
// not.toContain() would hold even if the subcommand had wrongly run.
const SKILLS_LISTING = /Skills: \d+ enabled/

test('skills list bypasses provider startup validation', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList(['skills', 'list'])

  expect(exitCode).toBe(0)
  expect(stdout).toMatch(SKILLS_LISTING)
  expect(stderr).not.toContain('OPENAI_API_KEY is required')
}, 90_000)

test('skills list bypasses provider startup validation after --bare', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList([
    '--bare',
    'skills',
    'list',
  ])

  expect(exitCode).toBe(0)
  // Leading --bare must reach the loader even though the skills fast path
  // rewrites argv and drops leading flags (cli.tsx sets GAKR_CODE_SIMPLE first).
  expect(stdout).toContain('Skills: 0 enabled')
  expect(stdout).toContain('No installed skills found.')
  expect(stderr).not.toContain('OPENAI_API_KEY is required')
}, 90_000)

test('skills list bypasses provider startup validation after --settings', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList([
    '--settings',
    '{}',
    'skills',
    'list',
  ])

  expect(exitCode).toBe(0)
  expect(stdout).toMatch(SKILLS_LISTING)
  expect(stderr).not.toContain('OPENAI_API_KEY is required')
}, 90_000)

test('skills list bypasses provider startup validation after --setting-sources', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList([
    '--setting-sources',
    'user,project',
    'skills',
    'list',
  ])

  expect(exitCode).toBe(0)
  expect(stdout).toMatch(SKILLS_LISTING)
  expect(stderr).not.toContain('OPENAI_API_KEY is required')
}, 90_000)

test('skills list honors --add-dir before provider startup validation', async () => {
  const addDirRoot = mkdtempSync(join(tmpdir(), 'gakrcli-skills-add-dir-'))
  const skillDir = join(addDirRoot, '.gakrcli', 'skills', 'addon')
  try {
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\ndescription: Skill loaded from add-dir.\n---\n# Addon\n`,
      'utf8',
    )

    const { exitCode, stderr, stdout } = await runSkillsList([
      '--add-dir',
      addDirRoot,
      'skills',
      'list',
    ])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('addon')
    expect(stderr).not.toContain('OPENAI_API_KEY is required')
  } finally {
    rmSync(addDirRoot, { recursive: true, force: true })
  }
}, 90_000)

test('skills list accepts equals-form global flags before provider startup validation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gakrcli-skills-cli-flags-'))
  const providerEnvFile = join(root, 'provider.env')
  const pluginDir = join(root, 'plugin')
  try {
    writeFileSync(providerEnvFile, '', 'utf8')
    mkdirSync(pluginDir, { recursive: true })

    const { exitCode, stderr, stdout } = await runSkillsList([
      `--provider-env-file=${providerEnvFile}`,
      `--plugin-dir=${pluginDir}`,
      '--mcp-config={}',
      'skills',
      'list',
    ])

    expect(exitCode).toBe(0)
    expect(stdout).toMatch(SKILLS_LISTING)
    expect(stderr).not.toContain('OPENAI_API_KEY is required')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 90_000)

test('--print keeps skills as a prompt instead of the management subcommand', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList([
    '--print',
    'skills',
    'list',
  ])

  expect(exitCode).toBe(1)
  expect(stdout).not.toMatch(SKILLS_LISTING)
  expect(stderr).toContain('OPENAI_API_KEY')
}, 90_000)

test('--print with intervening global flags keeps skills as prompt text', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList([
    '--print',
    '--model',
    'gpt-4',
    'skills',
    'list',
  ])

  expect(exitCode).toBe(1)
  expect(stdout).not.toMatch(SKILLS_LISTING)
  expect(stderr).toContain('OPENAI_API_KEY')
}, 90_000)

test('--continue keeps skills as prompt text instead of the management subcommand', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList([
    '--continue',
    'skills',
    'list',
  ])

  expect(exitCode).toBe(1)
  expect(stdout).not.toMatch(SKILLS_LISTING)
  expect(stderr).toContain('OPENAI_API_KEY')
}, 90_000)

test('skills list accepts trailing global flags', async () => {
  const { exitCode, stderr, stdout } = await runSkillsList([
    'skills',
    'list',
    '--bare',
  ])

  expect(exitCode).toBe(0)
  expect(stdout).toContain('Skills: 0 enabled')
  expect(stderr).not.toContain('Unknown skills option')
}, 90_000)

test('skills list honors trailing --add-dir', async () => {
  const addDirRoot = mkdtempSync(join(tmpdir(), 'gakrcli-skills-add-dir-'))
  const skillDir = join(addDirRoot, '.gakrcli', 'skills', 'addon')
  try {
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\ndescription: Skill loaded from trailing add-dir.\n---\n# Addon\n`,
      'utf8',
    )

    const { exitCode, stderr, stdout } = await runSkillsList([
      'skills',
      'list',
      '--add-dir',
      addDirRoot,
    ])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('addon')
    expect(stderr).not.toContain('Unknown skills option')
  } finally {
    rmSync(addDirRoot, { recursive: true, force: true })
  }
}, 90_000)
