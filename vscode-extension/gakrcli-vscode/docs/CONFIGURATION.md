# Configuration Reference

GakrCLI settings are in VS Code's settings under `gakrcli.*`. Open Settings (`Ctrl+,`) and search for "GakrCLI" to browse them.

## General Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `gakrcli.selectedProvider` | string | `"auto"` | The AI provider. `"auto"` means "don't override — use the CLI's own config." |
| `gakrcli.selectedModel` | string | `"default"` | The AI model to use. |
| `gakrcli.apiKey` | string | `""` | API key for the selected provider. |
| `gakrcli.baseUrl` | string | `""` | Base URL for the provider (for custom/OpenAI-compatible endpoints). |
| `gakrcli.environmentVariables` | array | `[]` | Environment variables to set when launching the CLI. Array of `{ name, value }` objects. |

## Permission Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `gakrcli.initialPermissionMode` | enum | `"default"` | Initial permission mode for new conversations. Options: `default`, `acceptEdits`, `plan`, `bypassPermissions`, `fullAccess`. |
| `gakrcli.allowDangerouslySkipPermissions` | boolean | `false` | Allow Bypass and Full Access modes. Recommended only for sandboxes with no internet access. |

## UI Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `gakrcli.preferredLocation` | enum | `"panel"` | Where GakrCLI opens: `"sidebar"` (right sidebar) or `"panel"` (new tab). Auto-updates when you move the panel. |
| `gakrcli.useTerminal` | boolean | `false` | Launch GakrCLI in a terminal instead of the webview UI. |
| `gakrcli.useCtrlEnterToSend` | boolean | `false` | Require `Ctrl+Enter` to send prompts. When enabled, `Enter` creates new lines. |
| `gakrcli.hideOnboarding` | boolean | `false` | Hide the onboarding checklist. |
| `gakrcli.enableNewConversationShortcut` | boolean | `false` | Enable `Ctrl+N` / `Cmd+N` to start a new conversation when GakrCLI is focused. |

## Editor Integration

| Setting | Type | Default | Description |
|---|---|---|---|
| `gakrcli.autosave` | boolean | `true` | Automatically save files before the AI reads or writes them. |
| `gakrcli.respectGitIgnore` | boolean | `true` | Respect `.gitignore` patterns when performing file searches. |
| `gakrcli.usePythonEnvironment` | boolean | `true` | Auto-activate the workspace Python environment. Requires the VS Code Python extension. |

## Advanced Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `gakrcli.disableLoginPrompt` | boolean | `false` | Never prompt for login/authentication. Use when auth is handled externally. |
| `gakrcli.gakrcliProcessWrapper` | string | `""` | Custom executable path to launch the CLI process. |
| `gakrcli.useTerminal` | boolean | `false` | Launch in terminal mode. |

## Example settings.json

```json
{
  "gakrcli.selectedProvider": "openai",
  "gakrcli.selectedModel": "gpt-4o",
  "gakrcli.apiKey": "sk-...",
  "gakrcli.initialPermissionMode": "acceptEdits",
  "gakrcli.preferredLocation": "panel",
  "gakrcli.autosave": true,
  "gakrcli.useCtrlEnterToSend": false
}
```

## Environment Variables

The CLI also respects these environment variables (set in your shell profile or via `gakrcli.environmentVariables`):

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI provider API key |
| `OPENAI_MODEL` | OpenAI model name |
| `OPENAI_BASE_URL` | Custom OpenAI-compatible base URL |
| `ANTHROPIC_API_KEY` | Anthropic provider API key |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Gemini model name |
| `GAKR_CODE_USE_OPENAI` | Force OpenAI provider |
| `GAKR_CODE_USE_GEMINI` | Force Gemini provider |
| `GAKR_CODE_USE_BEDROCK` | Force AWS Bedrock provider |
| `AWS_REGION` | AWS region for Bedrock |

## CLI Settings File

The CLI has its own settings at `~/.gakrcli/settings.json` and `~/.gakrcli/settings.local.json`. These are managed by the CLI itself, but the extension can sync certain values (like provider and model). See the [GakrCLI documentation](https://github.com/gajjalaashok75-UI/gakrcli) for CLI-specific settings.
