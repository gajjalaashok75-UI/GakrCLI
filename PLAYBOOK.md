# GakrCLI Playbook — Version 0.4.9

Quick-reference for using GakrCLI with local models (Ollama, Atomic Chat) and cloud providers. Covers daily workflow, setup, troubleshooting, and command cheatsheet.

## 1. What You Have

- A terminal-first AI coding agent that can read/write files, run commands, search code, browse web, and execute multi-step workflows
- Support for 10+ LLM providers (OpenAI, Anthropic, Gemini, DeepSeek, Ollama, etc.)
- 30+ built-in tools for file operations, shell commands, web search, and more
- 100+ specialized skills covering development, DevOps, AI, and security
- 20+ specialized agents for different workflows (architect, code-reviewer, security-reviewer)
- MCP (Model Context Protocol) integration for external tools and services
- Plugin system with hot reloading and custom plugin support
- Provider profile system for project-specific configurations
- Runtime diagnostics and health checks

## 2. Daily Start (Fast Path)

In your project root, run:

```bash
gakrcli
```

Or with specific provider:

```bash
# Using environment variables
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_MODEL=gpt-4o
gakrcli

# Using Ollama (local)
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
gakrcli
```

For development builds:

```bash
bun run dev
```

## 3. One-Time Setup

### 3.1 Global Installation

```bash
npm install -g @gakr-gakr/gakrcli
```

### 3.2 Source Build (Development)

```bash
git clone https://github.com/gakr-gakr/gakrcli.git
cd gakrcli
bun install
bun run build
npm link  # Optional: makes gakrcli available globally
```

### 3.3 Provider Configuration

**OpenAI (Fastest Cloud Setup)**

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o
```

**Ollama (Local, No API Key)**

```bash
# First, install and start Ollama
ollama pull llama3.2:3b

# Then configure
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
```

**Anthropic (Claude)**

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
export ANTHROPIC_MODEL=claude-sonnet-4-5-20251014
```

**DeepSeek (Cost-Effective)**

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-deepseek-key
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-v4-flash
```

### 3.4 Project-Level Configuration

Create `.gakr-profile.json` in your project root:

```json
{
  "provider": "openai-compatible",
  "apiKey": "sk-...",
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 8000,
  "skills": ["typescript-expert", "react-atlas"],
  "agents": ["code-reviewer", "security-reviewer"]
}
```

## 4. Health and Diagnostics

### 4.1 System Checks

```bash
gakrcli doctor                    # Comprehensive system check
gakrcli doctor --json            # JSON output for automation
```

For development builds:

```bash
bun run doctor:runtime           # Runtime diagnostics
bun run doctor:runtime:json      # JSON output
bun run doctor:report            # Save to reports/
```

### 4.2 Privacy Verification

```bash
bun run verify:privacy           # Verify no telemetry/phone-home
```

### 4.3 Quick Smoke Test

```bash
gakrcli --version               # Version check
bun run smoke                   # Build + version check (dev)
```

## 5. Provider Setup Guide

### 5.1 Local Providers (No API Key)

**Ollama**

```bash
# Install Ollama
# macOS: brew install ollama
# Windows: winget install Ollama.Ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2:3b         # Fast, low memory
ollama pull qwen2.5-coder:7b    # Better for coding
ollama pull codellama:7b        # Code specialist

# Configure GakrCLI
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
gakrcli
```

**Atomic Chat (Apple Silicon)**

```bash
# Install and run Atomic Chat app
# Configure GakrCLI
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://127.0.0.1:1337/v1
export OPENAI_MODEL=<model-loaded-in-atomic-chat>
gakrcli
```

### 5.2 Cloud Providers

**OpenAI**

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_MODEL=gpt-4o      # or gpt-4.1, o3-mini
gakrcli
```

**Anthropic**

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key
export ANTHROPIC_MODEL=claude-sonnet-4-5-20251014
gakrcli

# Or use guided login
gakrcli auth login
```

**Google Gemini**

```bash
export GAKR_CODE_USE_GEMINI=1
export GEMINI_API_KEY=your-key
export GEMINI_MODEL=gemini-2.0-flash
gakrcli
```

**DeepSeek**

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-deepseek-key
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-v4-flash
gakrcli
```

**GitHub Models (Free)**

```bash
export GAKR_CODE_USE_GITHUB=1
export GITHUB_TOKEN=ghp-your-token
export OPENAI_MODEL=openai/gpt-4.1
gakrcli
```

**NVIDIA NIMs**

```bash
export GAKR_CODE_USE_NVIDIA=1
export NVIDIA_API_KEY=nvapi-your-key
export NVIDIA_MODEL=stepfun-ai/step-3.5-flash
gakrcli
```

## 6. Troubleshooting Matrix

### 6.1 "gakrcli: command not found"

**Cause:** GakrCLI not installed or not in PATH.

**Fix:**
```bash
npm install -g @gakr-gakr/gakrcli
# Or check PATH if using source build
```

### 6.2 "ripgrep (rg) not found"

**Cause:** Required dependency missing.

**Fix:**
- macOS: `brew install ripgrep`
- Ubuntu/Debian: `sudo apt-get install ripgrep`
- Windows: `winget install ripgrep`
- Verify: `rg --version`

### 6.3 "Connection refused" (Ollama)

**Cause:** Ollama service not running.

**Fix:**
```bash
ollama serve                    # Start Ollama server
ollama pull llama3.2:3b        # Ensure model is available
```

### 6.4 "Invalid API key"

**Cause:** Missing or incorrect API key.

**Fix:**
- Verify API key is correct and active
- Check environment variable name matches provider
- For local providers, ensure no API key is set

### 6.5 "Model not found"

**Cause:** Specified model not available.

**Fix:**
- Check model name spelling
- For Ollama: `ollama list` to see available models
- For cloud providers: check provider documentation

### 6.6 Windows Input Prompt Hang

**Cause:** Known issue in older versions.

**Fix:**
- Update to GakrCLI 0.4.9 or later
- Ensure all dependencies are installed
- Try running with `--debug` flag for more information

## 7. Recommended Models

### 7.1 Local Models (Ollama)

**For Speed (Low Memory)**
- `llama3.2:3b` — Fastest, 8GB+ RAM, good general purpose
- `qwen2.5:3b` — Alternative fast option

**For Code Quality**
- `qwen2.5-coder:7b` — Best coding model for size
- `codellama:7b` — Code specialist alternative
- `deepseek-coder:6.7b` — Another coding option

**For Best Quality (High Memory)**
- `qwen2.5-coder:14b` — Excellent coding, needs 16GB+ RAM
- `llama3.1:8b` — Good general purpose, needs 16GB+ RAM
- `codellama:13b` — Large code model, needs 24GB+ RAM

### 7.2 Cloud Models

**OpenAI**
- `gpt-4o` — Best overall, fast and capable
- `gpt-4.1` — Latest model with improved reasoning
- `o3-mini` — Cost-effective reasoning model

**Anthropic**
- `claude-sonnet-4-5-20251014` — Latest Sonnet, excellent for code
- `claude-3-7-sonnet` — Alternative Sonnet version

**Google Gemini**
- `gemini-2.0-flash` — Fast and capable
- `gemini-1.5-pro` — More capable, slower

**DeepSeek**
- `deepseek-v4-flash` — Very cost-effective, fast
- `deepseek-v4-pro` — Better quality, higher cost

## 8. Daily Usage Patterns

### 8.1 Code Understanding

```
Map this repository architecture and explain the execution flow from entrypoint to tool invocation.

Find the top 5 risky modules and explain why.

Analyze the dependencies and identify potential security issues.
```

### 8.2 Development Tasks

```
Refactor this module for clarity without behavior change, then run tests.

Add comprehensive error handling to this function.

Create unit tests for this component with edge cases.

Implement the missing authentication middleware.
```

### 8.3 Code Review

```
Review the changes in this PR and identify potential issues.

Check this code for security vulnerabilities.

Suggest performance improvements for this algorithm.
```

### 8.4 Debugging

```
Reproduce this bug, identify the root cause, and implement a fix.

Trace this error path and list likely failure points.

Add debugging logs to help diagnose this intermittent issue.
```

### 8.5 Documentation

```
Generate comprehensive API documentation for this module.

Create a README for this project with setup instructions.

Write inline comments explaining this complex algorithm.
```

## 9. Slash Commands Reference

### 9.1 Essential Commands

```bash
/help                   # Show all available commands
/provider              # Configure provider settings
/settings              # View and modify settings
/clear                 # Clear conversation history
/cost                  # Show token usage and costs
```

### 9.2 Skills and Agents

```bash
/skills                # Browse available skills
/agents                # List available agents
/typescript-expert     # Use TypeScript skill
/code-reviewer         # Use code review agent
/security-reviewer     # Use security review agent
```

### 9.3 Tools and Utilities

```bash
/mcp                   # Manage MCP servers
/plugin                # Manage plugins
/tasks                 # View background tasks
/status                # Show system status
/doctor                # Run diagnostics
```

### 9.4 Project Management

```bash
/init                  # Initialize project configuration
/onboard-github        # Set up GitHub integration
/git-push              # Stage, commit, and push changes
```

## 10. MCP Integration

### 10.1 Built-in MCP Servers

- **File System**: Access local files and directories
- **Git**: Git repository operations
- **Web**: HTTP requests and web scraping
- **Database**: SQL database connections

### 10.2 MCP Configuration

Add to `~/.gakrcli/settings.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    },
    "git": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-git", "--repository", "."]
    }
  }
}
```

### 10.3 MCP Commands

```bash
gakrcli mcp list       # List available MCP servers
gakrcli mcp install    # Install MCP servers
gakrcli mcp doctor     # Diagnose MCP issues
```

## 11. Agent Routing

Configure different agents to use different models:

```json
{
  "agentModels": {
    "deepseek-v4-flash": {
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-your-key"
    },
    "gpt-4o": {
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-your-key"
    }
  },
  "agentRouting": {
    "code-reviewer": "deepseek-v4-flash",
    "architect": "gpt-4o",
    "security-reviewer": "gpt-4o",
    "default": "deepseek-v4-flash"
  }
}
```

## 12. Quick Recovery Checklist

When something breaks, run in order:

```bash
gakrcli doctor                  # System diagnostics
gakrcli --version              # Verify installation
```

For development builds:

```bash
bun run doctor:runtime
bun run smoke
bun run verify:privacy
```

If local model is failing:

```bash
ollama --version
ollama serve
ollama list                    # Check available models
```

## 13. Performance Tips

### 13.1 Local Models

- Use smaller models (3B-7B) for faster responses
- Ensure sufficient RAM (8GB+ for 3B, 16GB+ for 7B)
- Use SSD storage for better model loading
- Close other memory-intensive applications

### 13.2 Cloud Models

- Use faster models (gpt-4o, deepseek-v4-flash) for interactive work
- Use cheaper models (deepseek-v4-flash) for batch processing
- Monitor token usage with `/cost` command
- Set appropriate context limits

## 14. Security Best Practices

- Store API keys in environment variables, not code
- Use project profiles to limit scope per project
- Review MCP servers before installation
- Use sandboxing and permission controls
- Monitor file access in sensitive directories
- Keep GakrCLI updated to latest version

## 15. Success Criteria

Your setup is healthy when:

- `gakrcli doctor` passes all checks
- `gakrcli --version` shows current version (0.4.9+)
- CLI starts and shows input prompt correctly
- Model shown in UI matches your configuration
- Tools and commands work as expected
