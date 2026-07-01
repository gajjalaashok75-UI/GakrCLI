import DocsLayout from '../../components/DocsLayout'
import { SITE } from '../../data/site'
import CopyCommand from '../../components/CopyCommand'

const toc = [
  { id: 'how-it-works', label: 'how it works' },
  { id: 'providers', label: 'provider support' },
  { id: 'features', label: 'features' },
]

export default function DocsHome() {
  return (
    <DocsLayout
      title="gakrcli docs — open-source coding agent CLI"
      description="Documentation for gakrcli: an open-source coding agent that runs in your terminal and connects to any AI model provider."
      heading="overview"
      lede="gakrcli is an open-source coding agent CLI that runs in your terminal and connects to any AI model provider."
      toc={toc}
    >
      <h2 id="how-it-works">how it works</h2>
      <p>Run it in any repository. The agent sees your file structure, reads and writes code, runs shell commands, and iterates on tasks autonomously — with every tool call and diff streamed to your terminal in real time.</p>
      <p>Type your goal in natural language: <code>add pagination to the user list, then run the tests</code>. The agent plans, executes, and presents a diff for you to review before any change is committed.</p>

      <h2 id="providers">provider support</h2>
      <p>gakrcli works with every major AI provider out of the box — no rewrites, no plugins, no platform lock-in:</p>
      <ul>
        <li><strong>OpenAI-compatible</strong> — OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio, and any other /v1 server</li>
        <li><strong>Google Gemini</strong> — API-key auth</li>
        <li><strong>GitHub Models</strong> — Interactive OAuth onboarding via <code>/onboard-github</code></li>
        <li><strong>Anthropic</strong> — API key or account login</li>
        <li><strong>Ollama</strong> — Local inference, no API key required</li>
        <li><strong>Bedrock / Vertex</strong> — Cloud enterprise routes</li>
        <li><strong>NEAR AI</strong> — Unified gateway with Claude, GPT, Gemini, and open models</li>
        <li><strong>Xiaomi MiMo</strong>, <strong>OpenCode Zen</strong>, <strong>Atomic Chat</strong>, <strong>Hicap</strong> — Plus many more</li>
      </ul>
      <p>Switch providers mid-session with <code>/provider</code> or set a default with environment variables. See the <a href="/docs/providers/">provider guide</a> for the full list.</p>

      <h2 id="features">features</h2>
      <ul>
        <li><strong>Real tools, not just chat</strong> — Bash, file edits, grep, glob, MCP servers, skills, and plugins — all wired into the agent loop</li>
        <li><strong>Streaming diffs</strong> — Watch the agent think, call tools, and produce diffs live. Every change stays reviewable</li>
        <li><strong>Non-interactive mode</strong> — <code>--print</code> mode with JSON and <code>stream-json</code> output, tool allowlists, budgets, and session control</li>
        <li><strong>Session management</strong> — Resume, branch, and rewind conversations. Background tasks, worktree isolation, remote session from your phone</li>
        <li><strong>Per-repo profiles</strong> — Save model, base URL, auth, and runtime defaults so every clone boots the same way</li>
        <li><strong>MCP + plugins</strong> — Extend the agent with MCP servers for web browsing, database queries, and custom toolchains</li>
        <li><strong>SSH remote sessions</strong> — Run gakrcli on a remote machine with local API auth tunnelled back over the SSH connection</li>
      </ul>

      <div style={{ marginTop: 32, padding: 24, background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
        <p style={{ fontWeight: 500, marginBottom: 12 }}>install gakrcli</p>
        <CopyCommand command={SITE.installCommand} />
      </div>
    </DocsLayout>
  )
}
