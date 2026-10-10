// Seeded from src/commands.ts, src/i18n/languages/en.ts, and per-command
// argumentHint fields in src/commands/*/index.ts in the CLI source.
// Hidden, ant-only, and feature-gated commands are intentionally excluded.

export type CommandCategory =
  | 'session'
  | 'context'
  | 'models'
  | 'workflow'
  | 'tools'
  | 'customization'
  | 'diagnostics'

export interface SlashCommand {
  name: string
  description: string
  category: CommandCategory
  /** argument hint, mirrors the CLI's autocomplete hint */
  args?: string
  /** extended "how it works" detail, shown under the entry */
  details?: string
}

export const commandCategories: { id: CommandCategory; label: string; blurb: string }[] = [
  {
    id: 'session',
    label: 'sessions & conversations',
    blurb: 'Start, resume, branch, and export conversations — and move them between devices.',
  },
  {
    id: 'context',
    label: 'context & memory',
    blurb: 'Control what the agent sees: working directories, context usage, memory, and project knowledge.',
  },
  {
    id: 'models',
    label: 'models & providers',
    blurb: 'Pick a model, wire up providers, sign in and out, and track usage limits.',
  },
  {
    id: 'workflow',
    label: 'code review & git',
    blurb: 'Review diffs and pull requests, run security reviews, and connect GitHub or Slack.',
  },
  {
    id: 'tools',
    label: 'tools & integrations',
    blurb: 'MCP servers, language servers, IDEs, plugins, skills, agents, and hooks.',
  },
  {
    id: 'customization',
    label: 'ui & customization',
    blurb: 'Themes, keybindings, vim mode, the status line, and editor ergonomics.',
  },
  {
    id: 'diagnostics',
    label: 'help & diagnostics',
    blurb: 'Check status, diagnose the installation, and inspect session statistics.',
  },
]

export const commands: SlashCommand[] = [
  // ── sessions & conversations ─────────────────────────────────────────
  { name: 'clear', description: 'Clear conversation history and free up context', category: 'session' },
  { name: 'compact', description: 'Clear conversation history but keep a summary in context', category: 'session', args: '[instructions]' },
  { name: 'resume', description: 'Resume a previous conversation', category: 'session', args: '[conversation id or search term]' },
  { name: 'rename', description: 'Rename the current conversation', category: 'session', args: '[name]' },
  { name: 'branch', description: 'Create a branch of the current conversation at this point', category: 'session', args: '[name]' },
  { name: 'rewind', description: 'Restore the code and/or conversation to a previous point', category: 'session' },
  { name: 'teleport', description: 'Resume a GakrCLI session from gakrcli.ai', category: 'session' },
  { name: 'export', description: 'Export the current conversation to a file or clipboard', category: 'session', args: '[filename]' },
  { name: 'copy', description: "Copy the agent's last response to clipboard (or /copy N for the Nth-latest)", category: 'session', args: '[N]' },
  { name: 'btw', description: 'Ask a quick side question without interrupting the main conversation', category: 'session', args: '<question>' },
  { name: 'goal', description: 'Set and manage a session completion goal', category: 'session', args: '[condition|status|pause|resume|clear]', details: '/goal <condition> sets a completion condition (e.g. "/goal all tests pass on main"). Once set, an evaluator checks after every turn whether the condition is met; if not, the agent is automatically instructed to keep working toward it — up to 50 turns before pausing. /goal status shows the current state (status, turn count, elapsed time, last evaluator reason); /goal pause and /goal resume suspend or restart automatic continuation; /goal clear (aliases: stop, off, reset, none, cancel) removes the goal. Permission checks are never bypassed: if a turn needs your approval, the run waits for you.' },
  { name: 'proactive', description: 'Toggle proactive (autonomous) mode — the agent keeps working between your inputs', category: 'session', details: 'When enabled, the agent receives periodic tick prompts and continues autonomously between user inputs instead of idling after each turn. SleepTool controls pacing between ticks. Combine with /goal so autonomy is steered toward a concrete completion condition.' },
  { name: 'tasks', description: 'List and manage background tasks', category: 'session', details: 'Shows every background shell and delegated agent currently running, with their status and output. Use it to inspect, read output from, or stop work running in the background (alias: /bashes).' },
  { name: 'daemon', description: 'Manage background sessions and the daemon', category: 'session', args: '[status|start|stop|bg|attach|logs|kill]', details: 'Runs and manages detached background sessions. /daemon status (default) shows the daemon and its sessions; start/stop control the daemon process itself; /daemon bg starts the current session as a background session; attach reconnects to one (run `gakrcli daemon attach` from the CLI — it is interactive); logs tails a background session’s log; kill terminates a session.' },
  { name: 'session', description: 'Show remote session URL and QR code', category: 'session' },
  { name: 'desktop', description: 'Continue the current session in Gakr Desktop', category: 'session' },
  { name: 'mobile', description: 'Show QR code to download the Gakr mobile app', category: 'session' },
  { name: 'exit', description: 'Exit the REPL', category: 'session' },

  // ── context & memory ─────────────────────────────────────────────────
  { name: 'context', description: 'Show current context usage', category: 'context' },
  { name: 'files', description: 'List all files currently in context', category: 'context' },
  { name: 'add-dir', description: 'Add a new working directory', category: 'context', args: '<path>' },
  { name: 'init', description: 'Initialize a new project instruction file with codebase documentation', category: 'context' },
  { name: 'memory', description: 'Edit persistent memory files', category: 'context', details: 'Opens the memory layer for editing: GAKRCLI.md project instructions plus the auto-memory files the agent writes as it learns about your project. Auto-memory is indexed into a local SQLite full-text index that powers recall and the memory_recall tool.' },
  { name: 'dream', description: 'Run memory consolidation — synthesize recent sessions into durable memories', category: 'context', details: 'Reviews, organizes, and prunes your auto-memory files: merges duplicates, drops stale entries, and promotes durable facts. Runs on demand; background consolidation (auto-dream) can also fire automatically once enough new sessions have accumulated — tune it with the autoDreamEnabled setting.' },
  { name: 'wiki', description: 'Initialize and inspect the GakrCLI project wiki', category: 'context', args: '[init|status]' },
  { name: 'cost', description: 'Show the total cost and duration of the current session', category: 'context' },
  { name: 'request-size', description: 'Show estimated request context load and top contributors', category: 'context' },
  { name: 'cache-stats', description: 'Show per-turn and session cache hit/miss stats (works across all providers)', category: 'context' },

  // ── models & providers ───────────────────────────────────────────────
  { name: 'model', description: 'Set the AI model for the session', category: 'models', args: '[model]' },
  { name: 'provider', description: 'Manage API provider profiles', category: 'models' },
  { name: 'effort', description: 'Set effort level for model usage', category: 'models', args: '[low|medium|high|max|auto]' },
  { name: 'login', description: 'Sign in with your Anthropic account', category: 'models' },
  { name: 'logout', description: 'Sign out from your Anthropic account', category: 'models' },
  { name: 'onboard-github', description: 'Interactive setup for GitHub Copilot: OAuth device login stored in secure storage', category: 'models' },
  { name: 'usage', description: 'Show plan usage limits', category: 'models' },
  { name: 'extra-usage', description: 'Configure extra usage to keep working when limits are hit', category: 'models' },

  // ── code review & git ────────────────────────────────────────────────
  { name: 'diff', description: 'View uncommitted changes and per-turn diffs', category: 'workflow' },
  { name: 'commit', description: 'Create a git commit', category: 'workflow', details: 'Has the agent write a commit message and create the commit for the current changes. Commit attribution (co-author line etc.) is configurable via /commit-message.' },
  { name: 'commit-push-pr', description: 'Commit, push, and open a pull request', category: 'workflow' },
  { name: 'autofix-pr', description: 'Auto-fix CI failures on a pull request', category: 'workflow' },
  { name: 'bughunter', description: 'Systematic four-phase bug hunt — map, hunt, skeptic pass, fix proposal', category: 'workflow', details: 'Runs a structured hunt: map the code, hunt for bugs, adversarially re-verify each finding (skeptic pass), then propose fixes. Specialized variants exist for security (/bughunter-security) and performance (/bughunter-perf).' },
  { name: 'review', description: 'Review a pull request', category: 'workflow' },
  { name: 'security-review', description: 'Complete a security review of the pending changes on the current branch', category: 'workflow' },
  { name: 'pr-comments', description: 'Get comments from a GitHub pull request', category: 'workflow' },
  { name: 'auto-fix', description: 'Configure auto-fix: run lint/test after AI edits', category: 'workflow' },
  { name: 'plan', description: 'Enable plan mode or view the current session plan', category: 'workflow', args: '[open|<description>]' },
  { name: 'install-github-app', description: 'Set up GitHub Actions integration for a repository', category: 'workflow' },
  { name: 'install-slack-app', description: 'Install the Slack app integration', category: 'workflow' },

  // ── tools & integrations ─────────────────────────────────────────────
  { name: 'mcp', description: 'Manage MCP servers', category: 'tools', args: '[enable|disable [server-name]]' },
  { name: 'lsp', description: 'Inspect and set up Language Server Protocol code intelligence', category: 'tools', args: 'status | recommend [path] | install <plugin-id> | uninstall <plugin-id> | restart' },
  { name: 'ide', description: 'Manage IDE integrations and show status', category: 'tools', args: '[open]' },
  { name: 'plugin', description: 'Manage GakrCLI plugins', category: 'tools' },
  { name: 'reload-plugins', description: 'Activate pending plugin changes in the current session', category: 'tools' },
  { name: 'skills', description: 'List available skills', category: 'tools' },
  { name: 'agents', description: 'Manage agent configurations', category: 'tools', details: 'Interactive manager for agent definitions: list built-in and custom agents, inspect their tools/model, and edit the markdown files under .gakrcli/agents/ or ~/.gakrcli/agents/. See the agents page.' },
  { name: 'workflows', description: 'Manage workflow scripts', category: 'tools', details: 'Workflow scripts in .gakrcli/workflows/ (YAML/Markdown) give the agent deterministic multi-step orchestration — loops, conditionals, and fan-out across subagents with caching and resume support.' },
  { name: 'web-tools', description: 'Configure web search and web fetch backends', category: 'tools' },
  { name: 'hooks', description: 'View hook configurations for tool events', category: 'tools' },
  { name: 'permissions', description: 'Manage allow & deny tool permission rules', category: 'tools' },

  // ── ui & customization ───────────────────────────────────────────────
  { name: 'config', description: 'Open the config panel', category: 'customization' },
  { name: 'theme', description: 'Change the theme', category: 'customization' },
  { name: 'logo', description: 'Change the startup logo color scheme', category: 'customization' },
  { name: 'color', description: 'Set the prompt bar color for this session', category: 'customization', args: '<color|default>' },
  { name: 'keybindings', description: 'Open or create your keybindings configuration file', category: 'customization' },
  { name: 'vim', description: 'Toggle between Vim and Normal editing modes', category: 'customization' },
  { name: 'statusline', description: "Set up GakrCLI's status line UI", category: 'customization' },
  { name: 'terminal-setup', description: 'Install the Shift+Enter key binding for newlines', category: 'customization' },
  { name: 'commit-message', description: 'Configure commit attribution text', category: 'customization', args: '[status|off|default|set "text"|co-author <name> <email>]' },
  { name: 'output-style', description: 'Deprecated: use /config to change output style', category: 'customization' },
  { name: 'stickers', description: 'Order GakrCLI stickers', category: 'customization' },

  // ── help & diagnostics ───────────────────────────────────────────────
  { name: 'help', description: 'Show help and available commands', category: 'diagnostics' },
  { name: 'status', description: 'Show status including version, model, account, API connectivity, and tool statuses', category: 'diagnostics' },
  { name: 'doctor', description: 'Diagnose and verify your GakrCLI installation and settings', category: 'diagnostics' },
  { name: 'stats', description: 'Show your usage statistics and activity', category: 'diagnostics' },
  { name: 'insights', description: 'Generate a report analyzing your GakrCLI sessions', category: 'diagnostics' },
  { name: 'release-notes', description: 'View release notes', category: 'diagnostics' },
  { name: 'update', description: 'Update GakrCLI to the latest version', category: 'diagnostics', args: '[latest|stable|<version>] [--force]', details: 'Downloads and installs a release channel or an explicit version. Auto-updates can be disabled with the allowAutoUpdates setting; the release channel defaults to latest and is configurable via autoUpdatesChannel.' },
  { name: 'env', description: 'Show current environment, runtime, and feature flags', category: 'diagnostics' },
  { name: 'feedback', description: 'Submit feedback about GakrCLI', category: 'diagnostics', args: '[report]' },
]

export function commandsByCategory(category: CommandCategory): SlashCommand[] {
  return commands.filter(c => c.category === category)
}
