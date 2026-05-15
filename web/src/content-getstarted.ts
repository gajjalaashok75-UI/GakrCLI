export const getStartedSections = [
  {
    id: 'installation',
    title: 'Installation',
    subsections: [
      {
        id: 'how-to-install',
        title: 'How to install',
        content: 'Run `npm install -g @gakr-gakr/gakrcli` or use Bun with `bun add -g @gakr-gakr/gakrcli`.',
      },
      {
        id: 'pre-requirements',
        title: 'Pre-requirements',
        content: 'Node 20 or newer, a supported shell such as bash, zsh, PowerShell, or CMD, and internet access for hosted provider APIs.',
      },
      {
        id: 'windows',
        title: 'Windows',
        content: 'Open PowerShell or CMD, then run the install command. Make sure the Node installation directory and npm global bin directory are in PATH.',
      },
      {
        id: 'linux',
        title: 'Linux',
        content: 'Install Node with your package manager, then run the install command. Add the npm global bin directory to PATH if your shell cannot find `gakrcli`.',
      },
      {
        id: 'android',
        title: 'Android with Termux',
        content: 'Install Termux, run `pkg install nodejs`, then run the npm install command inside Termux.',
      },
      {
        id: 'debugging',
        title: 'Debugging in GakrCLI',
        content: 'Set `GAKRCLI_DEBUG=1` to see verbose logs. You can also launch with `gakrcli --log-level debug`.',
      },
      {
        id: 'log-location',
        title: 'Log file locations',
        content: 'Logs are written to `$HOME/.gakrcli/logs/` on macOS and Linux, or `%USERPROFILE%\\.gakrcli\\logs\\` on Windows.',
      },
      {
        id: 'expected-output',
        title: 'Expected output',
        content: 'After installation, `gakrcli --version` should print the installed version and `gakrcli --help` should print the help text.',
      },
      {
        id: 'common-issues',
        title: 'Common issues',
        content: '- `command not found`: ensure the npm global bin directory is in PATH.\n- SSL errors: configure `NODE_EXTRA_CA_CERTS`, or use local insecure options only for testing.',
      },
      {
        id: 'uninstall',
        title: 'How to uninstall',
        content: 'Run `npm uninstall -g @gakr-gakr/gakrcli` or `bun remove -g @gakr-gakr/gakrcli`. Remove `$HOME/.gakrcli` if you want a clean local configuration.',
      },
      {
        id: 'usage-setup',
        title: 'Usage and setup',
        content: 'Run `gakrcli` inside any project folder. The tool detects the repo and loads project-specific rules when they exist.',
      },
      {
        id: 'start-commands',
        title: 'How to start',
        content: '`gakrcli` starts interactive mode.\n`gakrcli <prompt>` runs a one-off command.\n`gakrcli --provider openai` specifies a provider at launch.',
      },
      {
        id: 'config-provider',
        title: 'Configure provider',
        content: 'Edit `$HOME/.gakrcli/settings.json` to set the provider field, or use the `/provider` slash command.',
      },
      {
        id: 'multiple-ways',
        title: 'Multiple ways to set provider',
        content: 'Use `GAKRCLI_PROVIDER`, the settings file, or the provider selector inside GakrCLI.',
      },
      {
        id: 'credentials-setup',
        title: 'Credentials required',
        content: 'Provide API keys for hosted providers through environment variables such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`.',
      },
      {
        id: 'switch-provider',
        title: 'Switch active provider',
        content: 'Use the `/provider` command, or edit the settings file and restart the session.',
      },
      {
        id: 'config-location',
        title: 'Where to change config',
        content: 'Configuration lives under `$HOME/.gakrcli/` on macOS and Linux, or `%USERPROFILE%\\.gakrcli` on Windows. Common files include `settings.json`, `hooks.json`, and `memory/`.',
      },
    ],
  },
] as const
