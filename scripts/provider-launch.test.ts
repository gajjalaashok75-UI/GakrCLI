import { captureSync } from './subprocess.ts'
import { describe, expect, test } from 'bun:test'
import { hasUsableOpenAILaunchCredential, runProcess } from './provider-launch.ts'

describe('provider-launch OpenAI credential validation', () => {
  test('accepts valid OPENAI_API_KEYS before placeholder OPENAI_API_KEY fallback', () => {
    expect(
      hasUsableOpenAILaunchCredential({
        OPENAI_API_KEYS: 'sk-openai-a,sk-openai-b',
        OPENAI_API_KEY: 'SUA_CHAVE',
      } as NodeJS.ProcessEnv),
    ).toBe(true)
  })

  test('rejects placeholder OPENAI_API_KEYS before singular fallback', () => {
    expect(
      hasUsableOpenAILaunchCredential({
        OPENAI_API_KEYS: 'sk-openai-a,SUA_CHAVE',
        OPENAI_API_KEY: 'sk-openai-single',
      } as NodeJS.ProcessEnv),
    ).toBe(false)
  })
})

describe('development process launches', () => {
  test('propagates nonzero exits and launch failures', async () => {
    expect(await runProcess(process.execPath, ['-e', 'process.exit(7)'], process.env)).toBe(7)
    expect(await runProcess('missing-development-command-l2', [], process.env)).toBe(1)
  })

  test('passes arguments, environment, and cwd literally', async () => {
    const literal = 'space ; $value & "quoted"'
    const code = await runProcess(process.execPath, ['-e', `
      process.exit(process.argv[1] === process.env.LAUNCH_LITERAL && process.cwd() === process.env.LAUNCH_CWD ? 0 : 9)
    `, literal], { ...process.env, LAUNCH_LITERAL: literal, LAUNCH_CWD: process.cwd() })
    expect(code).toBe(0)
  })

  test.skipIf(process.platform === 'win32')('maps a signaled child to the existing failure status', async () => {
    expect(await runProcess(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"], process.env)).toBe(1)
  })

  test('inherits both output streams', () => {
    const result = captureSync(process.execPath, ['-e', `
      const { runProcess } = await import(${JSON.stringify(import.meta.dir + '/provider-launch.ts')})
      process.exit(await runProcess(process.execPath, ['-e', "process.stdout.write('output'); process.stderr.write('diagnostic'); process.exit(7)"], process.env))
    `], { timeout: 15000 })
    expect(result.status).toBe(7)
    expect(result.stdout).toBe('output')
    expect(result.stderr).toBe('diagnostic')
  }, 20000)
})
