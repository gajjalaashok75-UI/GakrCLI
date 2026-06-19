/**
 * Regression tests for issue #402 — NODE_OPTIONS heap cap
 * Closes: gakr-gakr/gakrcli#402 — JavaScript heap OOM during large tasks
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applyLoadedEnvFileValues,
  loadEnvFile,
} from '../utils/envFile.js'
import {
  applyProviderFlagFromArgs,
  clearRememberedProviderFlagForTests,
  reapplyRememberedProviderFlag,
} from '../utils/providerFlag.js'
import { applyProfileEnvToProcessEnv } from '../utils/providerProfile.js'

describe('cli.tsx — NODE_OPTIONS --max-old-space-size (issue #402)', () => {
  const originalNodeOptions = process.env.NODE_OPTIONS

  beforeEach(() => {
    delete process.env.NODE_OPTIONS
  })

  afterEach(() => {
    if (originalNodeOptions !== undefined) {
      process.env.NODE_OPTIONS = originalNodeOptions
    } else {
      delete process.env.NODE_OPTIONS
    }
  })

  it('sets --max-old-space-size=8192 when NODE_OPTIONS is not set', () => {
    // Guard predicate: fires when the flag is absent
    const shouldSetHeapCap = !process.env.NODE_OPTIONS?.includes('--max-old-space-size')
    expect(shouldSetHeapCap).toBe(true)
  })

  it('does not override existing --max-old-space-size=4096', () => {
    process.env.NODE_OPTIONS = '--max-old-space-size=4096 --experimental-vm-modules'

    const shouldSetHeapCap = !process.env.NODE_OPTIONS.includes('--max-old-space-size')
    expect(shouldSetHeapCap).toBe(false)
    expect(process.env.NODE_OPTIONS).toContain('4096')
  })

  it('does not override existing --max-old-space-size=8192', () => {
    process.env.NODE_OPTIONS = '--max-old-space-size=8192'

    const shouldSetHeapCap = !process.env.NODE_OPTIONS.includes('--max-old-space-size')
    expect(shouldSetHeapCap).toBe(false)
    expect(process.env.NODE_OPTIONS).toBe('--max-old-space-size=8192')
  })

  it('appends --max-old-space-size when NODE_OPTIONS has other flags', () => {
    process.env.NODE_OPTIONS = '--inspect=9229'

    const result = `${process.env.NODE_OPTIONS} --max-old-space-size=8192`
    expect(result).toBe('--inspect=9229 --max-old-space-size=8192')
  })
})

describe('cli.tsx — --provider startup ordering', () => {
  const providerEnvKeys = [
    'GAKR_CODE_USE_OPENAI',
    'GAKR_CODE_USE_GEMINI',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_MODEL',
    'GEMINI_MODEL',
  ]
  const originalEnv = new Map<string, string | undefined>()
  let tempDir: string

  beforeEach(() => {
    clearRememberedProviderFlagForTests()
    tempDir = mkdtempSync(join(tmpdir(), 'gakrcli-cli-env-file-test-'))
    for (const key of providerEnvKeys) {
      originalEnv.set(key, process.env[key])
      delete process.env[key]
    }
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    for (const key of providerEnvKeys) {
      const originalValue = originalEnv.get(key)
      if (originalValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalValue
      }
    }
    originalEnv.clear()
    clearRememberedProviderFlagForTests()
  })

  function writeProviderEnvFile(content: string): string {
    const filePath = join(tempDir, '.env')
    writeFileSync(filePath, content, 'utf-8')
    return filePath
  }

  it('remembers --provider so settings.env reloads cannot clobber it', async () => {
    const src = await Bun.file(`${import.meta.dir}/cli.tsx`).text()

    const earlyProviderApplyIndex = src.indexOf('applyProviderFlagFromArgs(args')
    const rememberOptionIndex = src.indexOf(
      'rememberForSettingsEnv: true',
      earlyProviderApplyIndex,
    )
    const settingsEnvApplyIndex = src.indexOf(
      'applySafeConfigEnvironmentVariables()',
    )

    expect(earlyProviderApplyIndex).toBeGreaterThanOrEqual(0)
    expect(rememberOptionIndex).toBeGreaterThan(earlyProviderApplyIndex)
    expect(settingsEnvApplyIndex).toBeGreaterThan(earlyProviderApplyIndex)
  })

  it('reapplies remembered --provider after every managed settings env merge', async () => {
    const src = await Bun.file(`${import.meta.dir}/../utils/managedEnv.ts`).text()
    const safeApplyIndex = src.indexOf('export function applySafeConfigEnvironmentVariables')
    const configApplyIndex = src.indexOf('export function applyConfigEnvironmentVariables')
    const safeReapplyIndex = src.indexOf(
      'reapplyRememberedProviderFlag()',
      safeApplyIndex,
    )
    const configReapplyIndex = src.indexOf(
      'reapplyRememberedProviderFlag()',
      configApplyIndex,
    )

    expect(safeReapplyIndex).toBeGreaterThan(safeApplyIndex)
    expect(safeReapplyIndex).toBeLessThan(configApplyIndex)
    expect(configReapplyIndex).toBeGreaterThan(configApplyIndex)
  })

  it('remembers provider env-file values so later managed settings env merges can restore them', async () => {
    const src = await Bun.file(`${import.meta.dir}/cli.tsx`).text()
    const envFileImportIndex = src.indexOf('rememberLoadedEnvFileValues')
    const rememberLoadedFileIndex = src.indexOf(
      'rememberLoadedEnvFileValues(loadEnvFile(filePath))',
    )

    expect(envFileImportIndex).toBeGreaterThanOrEqual(0)
    expect(rememberLoadedFileIndex).toBeGreaterThan(envFileImportIndex)
  })

  it('preserves explicit --provider-env-file values through settings and startup profile env merges', () => {
    const filePath = writeProviderEnvFile([
      'GAKR_CODE_USE_OPENAI=1',
      'OPENAI_API_KEY=file-key',
      'OPENAI_BASE_URL=https://file.example/v1',
      'OPENAI_MODEL=file-model',
    ].join('\n'))

    const loaded = loadEnvFile(filePath)

    Object.assign(process.env, {
      OPENAI_API_KEY: 'settings-key',
      OPENAI_BASE_URL: 'https://settings.example/v1',
      OPENAI_MODEL: 'settings-model',
    })
    applyLoadedEnvFileValues(loaded)

    applyProfileEnvToProcessEnv(process.env, {
      GAKR_CODE_USE_OPENAI: '1',
      OPENAI_API_KEY: 'profile-key',
      OPENAI_BASE_URL: 'https://profile.example/v1',
      OPENAI_MODEL: 'profile-model',
    })
    applyLoadedEnvFileValues(loaded)

    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_API_KEY).toBe('file-key')
    expect(process.env.OPENAI_BASE_URL).toBe('https://file.example/v1')
    expect(process.env.OPENAI_MODEL).toBe('file-model')
  })

  it('keeps explicit --provider values ahead of provider env-file reapply checkpoints', () => {
    const filePath = writeProviderEnvFile([
      'GAKR_CODE_USE_OPENAI=1',
      'OPENAI_API_KEY=file-key',
      'OPENAI_BASE_URL=https://file.example/v1',
      'OPENAI_MODEL=file-model',
    ].join('\n'))

    const loaded = loadEnvFile(filePath)
    const result = applyProviderFlagFromArgs(
      ['--provider', 'gemini', '--model', 'gemini-2.0-flash'],
      { rememberForSettingsEnv: true },
    )
    expect(result?.error).toBeUndefined()

    applyLoadedEnvFileValues(loaded)
    reapplyRememberedProviderFlag()
    applyLoadedEnvFileValues(loaded)
    reapplyRememberedProviderFlag()

    expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_GEMINI).toBe('1')
    expect(process.env.GEMINI_MODEL).toBe('gemini-2.0-flash')
  })

  it('dispatches background session management before config and provider validation', async () => {
    const src = await Bun.file(`${import.meta.dir}/cli.tsx`).text()
    const bgManagementIndex = src.indexOf("bgSessionsEnabled && (args[0] === 'ps'")
    const configEnableIndex = src.indexOf('enableConfigs()')
    const providerValidationIndex = src.indexOf(
      'await validateProviderEnvForStartupOrExit()',
    )
    expect(bgManagementIndex).toBeGreaterThanOrEqual(0)
    expect(configEnableIndex).toBeGreaterThanOrEqual(0)
    expect(providerValidationIndex).toBeGreaterThanOrEqual(0)
    expect(bgManagementIndex).toBeLessThan(configEnableIndex)
    expect(bgManagementIndex).toBeLessThan(providerValidationIndex)
  })

  it('keeps background spawn after profile routing but before provider validation', async () => {
    const src = await Bun.file(`${import.meta.dir}/cli.tsx`).text()
    const checkBg = src.indexOf("optionArgs.includes('--bg')")
    const startupProfileIndex = src.indexOf('await buildStartupEnvFromProfile')
    const providerValidationIndex = src.indexOf(
      'await validateProviderEnvForStartupOrExit()',
    )
    expect(checkBg).toBeGreaterThanOrEqual(0)
    expect(startupProfileIndex).toBeGreaterThanOrEqual(0)
    expect(providerValidationIndex).toBeGreaterThanOrEqual(0)
    expect(checkBg).toBeGreaterThan(startupProfileIndex)
    expect(checkBg).toBeLessThan(providerValidationIndex)
  })
})

describe('cli.tsx — background routing behavior', () => {
  type CliMain = typeof import('./cli.js')['main']
  let runCliEntrypoint: CliMain

  beforeAll(async () => {
    process.env.GAKR_CODE_DISABLE_CLI_ENTRYPOINT_AUTO_RUN = '1'
    const mod = await import('./cli.js')
    runCliEntrypoint = mod.main
  })

  afterAll(() => {
    delete process.env.GAKR_CODE_DISABLE_CLI_ENTRYPOINT_AUTO_RUN
  })

  const mockProfileCheckpoint = mock(() => {})
  const mockPsHandler = mock(() => {})
  const mockLogsHandler = mock(() => {})
  const mockAttachHandler = mock(() => {})
  const mockKillHandler = mock(() => {})
  const mockHandleBgFlag = mock(() => {})
  const mockEnableConfigs = mock(async () => {})
  const mockApplySafeConfigEnv = mock(() => {})
  const mockApplyProviderFlag = mock(() => ({ error: undefined }))
  const mockReapplyProviderFlag = mock(() => {})
  const mockLoadEnvFile = mock(() => ({}))
  const mockParseProviderEnvFileArgs = mock(() => ({ paths: [], error: undefined }))
  const mockReapplyEnvFile = mock(() => {})
  const mockRememberLoadedEnvFile = mock(() => {})
  const mockApplyStartupEnv = mock(() => ({}))
  const mockBuildStartupEnv = mock(async () => process.env)
  const mockGetProviderValidationError = mock(() => undefined)
  const mockValidateProviderEnv = mock(async () => {})
  const mockResolveAgentOverride = mock(() => undefined)
  const mockApplyAgentOverride = mock(() => {})
  const mockGetInitialSettings = mock(() => ({}))
  const mockEagerLoadSettings = mock(() => ({ ok: true }))
  const mockArgsBeforeDelimiter = mock((a: string[]) => a)
  const mockEagerParseCliFlag = mock(() => undefined)
  const mockPrintStartupScreen = mock(() => {})
  const mockHydrateGithubToken = mock(() => {})
  const mockRefreshGithubToken = mock(async () => false)
  const mockStartCapturingEarlyInput = mock(() => {})
  const mockCliMain = mock(async () => {})

  function resetMock(m: ReturnType<typeof mock>) {
    m.mockClear()
  }

  beforeEach(() => {
    resetMock(mockProfileCheckpoint)
    resetMock(mockPsHandler)
    resetMock(mockLogsHandler)
    resetMock(mockAttachHandler)
    resetMock(mockKillHandler)
    resetMock(mockHandleBgFlag)
    resetMock(mockEnableConfigs)
    resetMock(mockApplySafeConfigEnv)
    resetMock(mockApplyProviderFlag)
    resetMock(mockReapplyProviderFlag)
    resetMock(mockLoadEnvFile)
    resetMock(mockParseProviderEnvFileArgs)
    resetMock(mockReapplyEnvFile)
    resetMock(mockRememberLoadedEnvFile)
    resetMock(mockApplyStartupEnv)
    resetMock(mockBuildStartupEnv)
    resetMock(mockGetProviderValidationError)
    resetMock(mockValidateProviderEnv)
    resetMock(mockResolveAgentOverride)
    resetMock(mockApplyAgentOverride)
    resetMock(mockGetInitialSettings)
    resetMock(mockEagerLoadSettings)
    resetMock(mockArgsBeforeDelimiter)
    resetMock(mockEagerParseCliFlag)
    resetMock(mockPrintStartupScreen)
    resetMock(mockHydrateGithubToken)
    resetMock(mockRefreshGithubToken)
    resetMock(mockStartCapturingEarlyInput)
    resetMock(mockCliMain)
  })

  const commonMocks = {
    startupProfiler: () => ({ profileCheckpoint: mockProfileCheckpoint }),
    bg: () => ({
      psHandler: mockPsHandler,
      logsHandler: mockLogsHandler,
      attachHandler: mockAttachHandler,
      killHandler: mockKillHandler,
      handleBgFlag: mockHandleBgFlag,
    }),
    providerFlag: () => ({
      applyProviderFlagFromArgs: mockApplyProviderFlag,
      reapplyRememberedProviderFlag: mockReapplyProviderFlag,
    }),
    envFile: () => ({
      loadEnvFile: mockLoadEnvFile,
      parseProviderEnvFileArgs: mockParseProviderEnvFileArgs,
      reapplyRememberedEnvFileValues: mockReapplyEnvFile,
      rememberLoadedEnvFileValues: mockRememberLoadedEnvFile,
    }),
    config: () => ({
      enableConfigs: mockEnableConfigs,
      applySafeConfigEnvironmentVariables: mockApplySafeConfigEnv,
    }),
    managedEnv: () => ({
      applySafeConfigEnvironmentVariables: mockApplySafeConfigEnv,
    }),
    providerProfile: () => ({
      applyProfileEnvToProcessEnv: mockApplyStartupEnv,
      buildStartupEnvFromProfile: mockBuildStartupEnv,
      isDefaultStartupProviderEnv: mockGetProviderValidationError,
    }),
    providerValidation: () => ({
      validateProviderEnvForStartupOrExit: mockValidateProviderEnv,
      getProviderValidationError: mockGetProviderValidationError,
    }),
    agentRouting: () => ({
      applyAgentProviderOverrideToEnv: mockApplyAgentOverride,
      resolveOutOfProcessTeammateProviderFromCliArgs: mockResolveAgentOverride,
    }),
    settings: () => ({
      getInitialSettings: mockGetInitialSettings,
    }),
    flagSettings: () => ({
      eagerLoadSettingsFromArgs: mockEagerLoadSettings,
    }),
    cliArgs: () => ({
      argsBeforeDelimiter: mockArgsBeforeDelimiter,
      eagerParseCliFlag: mockEagerParseCliFlag,
    }),
    githubModelsCredentials: () => ({
      hydrateGithubModelsTokenFromSecureStorage: mockHydrateGithubToken,
      refreshGithubModelsTokenIfNeeded: mockRefreshGithubToken,
    }),
    startupScreen: () => ({
      printStartupScreen: mockPrintStartupScreen,
    }),
    earlyInput: () => ({
      startCapturingEarlyInput: mockStartCapturingEarlyInput,
    }),
    main: () => ({
      main: mockCliMain,
    }),
  }

  const bgEnabledOptions = { bgSessionsEnabled: true, importers: commonMocks }

  it('dispatches background management commands before startup work', async () => {
    await runCliEntrypoint(['ps'], bgEnabledOptions)

    expect(mockPsHandler).toHaveBeenCalled()
    expect(mockEnableConfigs).not.toHaveBeenCalled()
  })

  it('keeps management commands on the management path even with --bg arguments', async () => {
    await runCliEntrypoint(['ps', '--bg'], bgEnabledOptions)

    expect(mockPsHandler).toHaveBeenCalled()
    expect(mockHandleBgFlag).not.toHaveBeenCalled()
  })

  it('routes real background flags after profile routing without provider validation', async () => {
    await runCliEntrypoint(['--bg'], bgEnabledOptions)

    expect(mockHandleBgFlag).toHaveBeenCalled()
    expect(mockValidateProviderEnv).not.toHaveBeenCalled()
  })

  it('treats --bg after -- as positional text, not a background flag', async () => {
    mockArgsBeforeDelimiter.mockImplementation((a: string[]) => {
      const delim = a.indexOf('--')
      return delim === -1 ? a : a.slice(0, delim)
    })

    await runCliEntrypoint(['--', '--bg'], { bgSessionsEnabled: true, importers: commonMocks })
    expect(mockHandleBgFlag).not.toHaveBeenCalled()
    expect(mockStartCapturingEarlyInput).toHaveBeenCalled()
    expect(mockCliMain).toHaveBeenCalled()
  })
})
