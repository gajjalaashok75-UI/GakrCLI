import { feature } from 'bun:bundle';
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import {
  isLocalProviderUrl,
  resolveCodexApiCredentials,
  resolveProviderRequest,
} from '../services/api/providerConfig.js'
import {
  applyProfileEnvToProcessEnv,
  buildStartupEnvFromProfile,
  redactSecretValueForDisplay,
} from '../utils/providerProfile.js'
import { getProviderValidationError } from '../utils/providerValidation.js';

// Load .env file if it exists (Node.js 20.10+ has built-in loadEnvFile, but for compatibility
// we manually load it). This must happen BEFORE any model selection or provider logic.
// eslint-disable-next-line custom-rules/no-top-level-side-effects
{
  const __dirname = join(pathToFileURL(fileURLToPath(import.meta.url)).pathname, '..', '..')
  const envPath = join(__dirname, '..', '.env')

  if (existsSync(envPath)) {
    try {
      // Use Node.js 20.10+ built-in loadEnvFile if available, otherwise manually load
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(envPath)
      } else {
        // Fallback: manually parse .env file
        const { readFileSync } = await import('fs')
        const envContent = readFileSync(envPath, 'utf-8')
        for (const line of envContent.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const [key, ...valueParts] = trimmed.split('=')
          if (key) {
            const value = valueParts.join('=').trim()
            // Remove quotes if present
            const unquoted = value.startsWith('"') && value.endsWith('"')
              ? value.slice(1, -1)
              : value.startsWith("'") && value.endsWith("'")
                ? value.slice(1, -1)
                : value
            process.env[key.trim()] ??= unquoted
          }
        }
      }
    } catch (error) {
      // Silently fail if .env loading fails - don't break the CLI
      // User may have .env with invalid format, but that's their responsibility
      void error
    }
  }
}

// Gakrcli: disable experimental API betas by default.
// Tool search (defer_loading), global cache scope, and context management
// require internal API support not available to external accounts → 500.
// Users can opt-in with GAKR_CODE_DISABLE_EXPERIMENTAL_BETAS=false.
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.GAKR_CODE_DISABLE_EXPERIMENTAL_BETAS ??= 'true'

// Bugfix for corepack auto-pinning, which adds yarnpkg to peoples' package.jsons
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.COREPACK_ENABLE_AUTO_PIN = '0';

// Set max heap size for child processes in CCR environments (containers have 16GB)
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level, custom-rules/safe-env-boolean-check
if (process.env.GAKR_CODE_REMOTE === 'true') {
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  const existing = process.env.NODE_OPTIONS || '';
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  process.env.NODE_OPTIONS = existing ? `${existing} --max-old-space-size=8192` : '--max-old-space-size=8192';
}

// Harness-science L0 ablation baseline. Inlined here (not init.ts) because
// BashTool/AgentTool/PowerShellTool capture DISABLE_BACKGROUND_TASKS into
// module-level consts at import time — init() runs too late. feature() gate
// DCEs this entire block from external builds.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (feature('ABLATION_BASELINE') && process.env.GAKR_CODE_ABLATION_BASELINE) {
  for (const k of ['GAKR_CODE_SIMPLE', 'GAKR_CODE_DISABLE_THINKING', 'DISABLE_INTERLEAVED_THINKING', 'DISABLE_COMPACT', 'DISABLE_AUTO_COMPACT', 'GAKR_CODE_DISABLE_AUTO_MEMORY', 'GAKR_CODE_DISABLE_BACKGROUND_TASKS']) {
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    process.env[k] ??= '1';
  }
}

/**
 * Bootstrap entrypoint - checks for special flags before loading the full CLI.
 * All imports are dynamic to minimize module evaluation for fast paths.
 * Fast-path for --version has zero imports beyond this file.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Fast-path for --version/-v: zero module loading needed
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')) {
    // MACRO.VERSION is inlined at build time
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`${MACRO.DISPLAY_VERSION ?? MACRO.VERSION} (Gakrcli)`);
    return;
  }

  // --provider: set provider env vars early so saved-profile resolution,
  // validation, and the startup banner all see the intended provider/model.
  if (args.includes('--provider')) {
    const { applyProviderFlagFromArgs } = await import('../utils/providerFlag.js');
    const result = applyProviderFlagFromArgs(args);
    if (result?.error) {
      // biome-ignore lint/suspicious/noConsole:: intentional error output
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  }

  {
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()
    const { applySafeConfigEnvironmentVariables } = await import('../utils/managedEnv.js')
    applySafeConfigEnvironmentVariables()
    const { hydrateGithubModelsTokenFromSecureStorage } = await import('../utils/githubModelsCredentials.js')
    hydrateGithubModelsTokenFromSecureStorage()
  }

  // Initialize user directories on first run
  try {
    const { initUserDirs } = await import('../utils/initUserDirs.js')
    initUserDirs()
  } catch (initError) {
    // Non-fatal: if directory creation fails, continue anyway
    console.warn('Warning: could not initialize user directories:', initError)
  }

  const startupEnv = await buildStartupEnvFromProfile({
    processEnv: process.env,
  })
  if (startupEnv !== process.env) {
    const startupProfileError = getProviderValidationError(startupEnv)
    if (startupProfileError) {
      console.error(
        `Warning: ignoring saved provider profile. ${startupProfileError}`,
      )
    } else {
      applyProfileEnvToProcessEnv(process.env, startupEnv)
    }
  }

  // Print the gradient startup screen before the Ink UI loads
  const { printStartupScreen } = await import('../components/StartupScreen.js')
  printStartupScreen()

  // For all other paths, load the startup profiler
  const {
    profileCheckpoint
  } = await import('../utils/startupProfiler.js');
  profileCheckpoint('cli_entry');

  // Fast-path for --dump-system-prompt: output the rendered system prompt and exit.
  // Used for prompt sensitivity evals to extract the system prompt at a specific commit.
  // Ant-only: eliminated from external builds via feature flag.
  if (feature('DUMP_SYSTEM_PROMPT') && args[0] === '--dump-system-prompt') {
    profileCheckpoint('cli_dump_system_prompt_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      getMainLoopModel
    } = await import('../utils/model/model.js');
    const modelIdx = args.indexOf('--model');
    const model = modelIdx !== -1 && args[modelIdx + 1] || getMainLoopModel();
    const {
      getSystemPrompt
    } = await import('../constants/prompts.js');
    const prompt = await getSystemPrompt([], model);
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(prompt.join('\n'));
    return;
  }
  if (process.argv[2] === '--gakrcli-in-chrome-mcp') {
    profileCheckpoint('cli_gakrcli_in_chrome_mcp_path');
    const {
      rungakrcliInChromeMcpServer
    } = await import('../utils/gakrcliInChrome/mcpServer.js');
    await rungakrcliInChromeMcpServer();
    return;
  } else if (process.argv[2] === '--chrome-native-host') {
    profileCheckpoint('cli_chrome_native_host_path');
    const {
      runChromeNativeHost
    } = await import('../utils/gakrcliInChrome/chromeNativeHost.js');
    await runChromeNativeHost();
    return;
  } else if (feature('CHICAGO_MCP') && process.argv[2] === '--computer-use-mcp') {
    profileCheckpoint('cli_computer_use_mcp_path');
    const {
      runComputerUseMcpServer
    } = await import('../utils/computerUse/mcpServer.js');
    await runComputerUseMcpServer();
    return;
  }

  // Fast-path for `--daemon-worker=<kind>` (internal — supervisor spawns this).
  // Must come before the daemon subcommand check: spawned per-worker, so
  // perf-sensitive. No enableConfigs(), no analytics sinks at this layer —
  // workers are lean. If a worker kind needs configs/auth (assistant will),
  // it calls them inside their run() fn.
  if (feature('DAEMON') && args[0] === '--daemon-worker') {
    const {
      runDaemonWorker
    } = await import('../daemon/workerRegistry.js');
    await runDaemonWorker(args[1]);
    return;
  }

  // Fast-path for `gakrcli remote-control` (also accepts legacy `gakrcli remote` / `gakrcli sync` / `gakrcli bridge`):
  // serve local machine as bridge environment.
  // feature() must stay inline for build-time dead code elimination;
  // isBridgeEnabled() checks the runtime GrowthBook gate.
  if (feature('BRIDGE_MODE') && (args[0] === 'remote-control' || args[0] === 'rc' || args[0] === 'remote' || args[0] === 'sync' || args[0] === 'bridge')) {
    profileCheckpoint('cli_bridge_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      getBridgeDisabledReason,
      checkBridgeMinVersion
    } = await import('../bridge/bridgeEnabled.js');
    const {
      BRIDGE_LOGIN_ERROR
    } = await import('../bridge/types.js');
    const {
      bridgeMain
    } = await import('../bridge/bridgeMain.js');
    const {
      exitWithError
    } = await import('../utils/process.js');

    // Auth check must come before the GrowthBook gate check — without auth,
    // GrowthBook has no user context and would return a stale/default false.
    // getBridgeDisabledReason awaits GB init, so the returned value is fresh
    // (not the stale disk cache), but init still needs auth headers to work.
    const {
      getgakrcliAIOAuthTokens
    } = await import('../utils/auth.js');
    if (!getgakrcliAIOAuthTokens()?.accessToken) {
      exitWithError(BRIDGE_LOGIN_ERROR);
    }
    const disabledReason = await getBridgeDisabledReason();
    if (disabledReason) {
      exitWithError(`Error: ${disabledReason}`);
    }
    const versionError = checkBridgeMinVersion();
    if (versionError) {
      exitWithError(versionError);
    }

    // Bridge is a remote control feature - check policy limits
    const {
      waitForPolicyLimitsToLoad,
      isPolicyAllowed
    } = await import('../services/policyLimits/index.js');
    await waitForPolicyLimitsToLoad();
    if (!isPolicyAllowed('allow_remote_control')) {
      exitWithError("Error: Remote Control is disabled by your organization's policy.");
    }
    await bridgeMain(args.slice(1));
    return;
  }

  // Fast-path for `gakrcli daemon [subcommand]`: long-running supervisor.
  if (feature('DAEMON') && args[0] === 'daemon') {
    profileCheckpoint('cli_daemon_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      initSinks
    } = await import('../utils/sinks.js');
    initSinks();
    const {
      daemonMain
    } = await import('../daemon/main.js');
    await daemonMain(args.slice(1));
    return;
  }

  // Fast-path for `gakrcli ps|logs|attach|kill` and `--bg`/`--background`.
  // Session management against the ~/.gakrcli/sessions/ registry. Flag
  // literals are inlined so bg.js only loads when actually dispatching.
  if (feature('BG_SESSIONS') && (args[0] === 'ps' || args[0] === 'logs' || args[0] === 'attach' || args[0] === 'kill' || args.includes('--bg') || args.includes('--background'))) {
    profileCheckpoint('cli_bg_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const bg = await import('../cli/bg.js');
    switch (args[0]) {
      case 'ps':
        await bg.psHandler(args.slice(1));
        break;
      case 'logs':
        await bg.logsHandler(args[1]);
        break;
      case 'attach':
        await bg.attachHandler(args[1]);
        break;
      case 'kill':
        await bg.killHandler(args[1]);
        break;
      default:
        await bg.handleBgFlag(args);
    }
    return;
  }

  // Fast-path for template job commands.
  if (feature('TEMPLATES') && (args[0] === 'new' || args[0] === 'list' || args[0] === 'reply')) {
    profileCheckpoint('cli_templates_path');
    const {
      templatesMain
    } = await import('../cli/handlers/templateJobs.js');
    await templatesMain(args);
    // process.exit (not return) — mountFleetView's Ink TUI can leave event
    // loop handles that prevent natural exit.
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0);
  }

  // Fast-path for `gakrcli environment-runner`: headless BYOC runner.
  // feature() must stay inline for build-time dead code elimination.
  if (feature('BYOC_ENVIRONMENT_RUNNER') && args[0] === 'environment-runner') {
    profileCheckpoint('cli_environment_runner_path');
    const {
      environmentRunnerMain
    } = await import('../environment-runner/main.js');
    await environmentRunnerMain(args.slice(1));
    return;
  }

  // Fast-path for `gakrcli self-hosted-runner`: headless self-hosted-runner
  // targeting the SelfHostedRunnerWorkerService API (register + poll; poll IS
  // heartbeat). feature() must stay inline for build-time dead code elimination.
  if (feature('SELF_HOSTED_RUNNER') && args[0] === 'self-hosted-runner') {
    profileCheckpoint('cli_self_hosted_runner_path');
    const {
      selfHostedRunnerMain
    } = await import('../self-hosted-runner/main.js');
    await selfHostedRunnerMain(args.slice(1));
    return;
  }

  // Fast-path for --worktree --tmux: exec into tmux before loading full CLI
  const hasTmuxFlag = args.includes('--tmux') || args.includes('--tmux=classic');
  if (hasTmuxFlag && (args.includes('-w') || args.includes('--worktree') || args.some(a => a.startsWith('--worktree=')))) {
    profileCheckpoint('cli_tmux_worktree_fast_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      isWorktreeModeEnabled
    } = await import('../utils/worktreeModeEnabled.js');
    if (isWorktreeModeEnabled()) {
      const {
        execIntoTmuxWorktree
      } = await import('../utils/worktree.js');
      const result = await execIntoTmuxWorktree(args);
      if (result.handled) {
        return;
      }
      // If not handled (e.g., error), fall through to normal CLI
      if (result.error) {
        const {
          exitWithError
        } = await import('../utils/process.js');
        exitWithError(result.error);
      }
    }
  }

  // Redirect common update flag mistakes to the update subcommand
  if (args.length === 1 && (args[0] === '--update' || args[0] === '--upgrade')) {
    process.argv = [process.argv[0]!, process.argv[1]!, 'update'];
  }

  // --bare: set SIMPLE early so gates fire during module eval / commander
  // option building (not just inside the action handler).
  if (args.includes('--bare')) {
    process.env.GAKR_CODE_SIMPLE = '1';
  }

  // No special flags detected, load and run the full CLI
  if (
    process.env.GAKR_DISABLE_EARLY_INPUT !== '1' &&
    process.env.OPENGAKR_DISABLE_EARLY_INPUT !== '1'
  ) {
    const {
      startCapturingEarlyInput
    } = await import('../utils/earlyInput.js');
    startCapturingEarlyInput();
  }
  profileCheckpoint('cli_before_main_import');
  const {
    main: cliMain
  } = await import('../main.js');
  profileCheckpoint('cli_after_main_import');
  await cliMain();
  profileCheckpoint('cli_after_main_complete');
}

// eslint-disable-next-line custom-rules/no-top-level-side-effects
main().catch((error) => {
  console.error('Fatal error during CLI initialization:', error);
  process.exit(1);
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwicHJvY2VzcyIsImVudiIsIkNPUkVQQUNLX0VOQUJMRV9BVVRPX1BJTiIsIkNMQVVERV9DT0RFX1JFTU9URSIsImV4aXN0aW5nIiwiTk9ERV9PUFRJT05TIiwiQ0xBVURFX0NPREVfQUJMQVRJT05fQkFTRUxJTkUiLCJrIiwibWFpbiIsIlByb21pc2UiLCJhcmdzIiwiYXJndiIsInNsaWNlIiwibGVuZ3RoIiwiY29uc29sZSIsImxvZyIsIk1BQ1JPIiwiVkVSU0lPTiIsInByb2ZpbGVDaGVja3BvaW50IiwiZW5hYmxlQ29uZmlncyIsImdldE1haW5Mb29wTW9kZWwiLCJtb2RlbElkeCIsImluZGV4T2YiLCJtb2RlbCIsImdldFN5c3RlbVByb21wdCIsInByb21wdCIsImpvaW4iLCJydW5DbGF1ZGVJbkNocm9tZU1jcFNlcnZlciIsInJ1bkNocm9tZU5hdGl2ZUhvc3QiLCJydW5Db21wdXRlclVzZU1jcFNlcnZlciIsInJ1bkRhZW1vbldvcmtlciIsImdldEJyaWRnZURpc2FibGVkUmVhc29uIiwiY2hlY2tCcmlkZ2VNaW5WZXJzaW9uIiwiQlJJREdFX0xPR0lOX0VSUk9SIiwiYnJpZGdlTWFpbiIsImV4aXRXaXRoRXJyb3IiLCJnZXRDbGF1ZGVBSU9BdXRoVG9rZW5zIiwiYWNjZXNzVG9rZW4iLCJkaXNhYmxlZFJlYXNvbiIsInZlcnNpb25FcnJvciIsIndhaXRGb3JQb2xpY3lMaW1pdHNUb0xvYWQiLCJpc1BvbGljeUFsbG93ZWQiLCJpbml0U2lua3MiLCJkYWVtb25NYWluIiwiaW5jbHVkZXMiLCJiZyIsInBzSGFuZGxlciIsImxvZ3NIYW5kbGVyIiwiYXR0YWNoSGFuZGxlciIsImtpbGxIYW5kbGVyIiwiaGFuZGxlQmdGbGFnIiwidGVtcGxhdGVzTWFpbiIsImV4aXQiLCJlbnZpcm9ubWVudFJ1bm5lck1haW4iLCJzZWxmSG9zdGVkUnVubmVyTWFpbiIsImhhc1RtdXhGbGFnIiwic29tZSIsImEiLCJzdGFydHNXaXRoIiwiaXNXb3JrdHJlZU1vZGVFbmFibGVkIiwiZXhlY0ludG9UbXV4V29ya3RyZWUiLCJyZXN1bHQiLCJoYW5kbGVkIiwiZXJyb3IiLCJDTEFVREVfQ09ERV9TSU1QTEUiLCJzdGFydENhcHR1cmluZ0Vhcmx5SW5wdXQiLCJjbGlNYWluIl0sInNvdXJjZXMiOlsiY2xpLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcblxuLy8gQnVnZml4IGZvciBjb3JlcGFjayBhdXRvLXBpbm5pbmcsIHdoaWNoIGFkZHMgeWFybnBrZyB0byBwZW9wbGVzJyBwYWNrYWdlLmpzb25zXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLXRvcC1sZXZlbC1zaWRlLWVmZmVjdHNcbnByb2Nlc3MuZW52LkNPUkVQQUNLX0VOQUJMRV9BVVRPX1BJTiA9ICcwJ1xuXG4vLyBTZXQgbWF4IGhlYXAgc2l6ZSBmb3IgY2hpbGQgcHJvY2Vzc2VzIGluIENDUiBlbnZpcm9ubWVudHMgKGNvbnRhaW5lcnMgaGF2ZSAxNkdCKVxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby10b3AtbGV2ZWwtc2lkZS1lZmZlY3RzLCBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1lbnYtdG9wLWxldmVsXG5pZiAocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfUkVNT1RFIG09PSAndHJ1ZScpIHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby10b3AtbGV2ZWwtc2lkZS1lZmZlY3RzLCBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1lbnYtdG9wLWxldmVsXG4gIGNvbnN0IGV4aXN0aW5nID0gcHJvY2Vzcy5lbnYuTk9ERV9PUFRJT05TIHx8ICcnXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tdG9wLWxldmVsLXNpZGUtZWZmZWN0cywgY3VzdG9tLXJ1bGVzL25vLXByb2Nlc3MtZW52LXRvcC1sZXZlbFxuICBwcm9jZXNzLmVudi5OT0RFX09QVFJPTlMgPSBleGlzdGluZ1xuICAgID8gYCR7ZXhpc3RpbmdfIX0gLS1tYXgvb2xkLXNwYWNlLXNpemU+ODE5MmBcbiAgICA6ICctLWFyZ3MtJyArIGV4aXN0aW5nXG59XG5cbi8qKiBcbg==
// Source map truncated - full map in dist/...
// ...

// Vist "./dist/cli.js" to run the compiled code.
