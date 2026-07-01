import DocsLayout from '../../components/DocsLayout'
import { SITE } from '../../data/site'

const toc = [
  { id: 'start', label: 'start the agent' },
  { id: 'pick-a-provider', label: 'pick a provider' },
  { id: 'first-task', label: 'give it a task' },
  { id: 'review', label: 'review the changes' },
  { id: 'next-steps', label: 'next steps' },
]

export default function Quickstart() {
  return (
    <DocsLayout
      title="gakrcli quickstart — first session in 5 minutes"
      description="Run your first gakrcli session: start the agent in a repo, pick a model provider, give it a task, and review the diff. From install to working agent in minutes."
      heading="quickstart"
      lede="From a fresh install to a reviewed diff in about five minutes."
      toc={toc}
    >
      <h2 id="start">1. start the agent</h2>
      <p>Run it inside any repository (or empty directory):</p>
      <pre><code>cd your-repo
gakrcli</code></pre>
      <p>If you haven't <a href="/docs/installation/">installed it</a> yet: <code>{SITE.installCommand}</code></p>

      <h2 id="pick-a-provider">2. pick a provider</h2>
      <p>Inside the session, type <code>/provider</code> for guided setup with saved profiles. It can wire up OpenAI, OpenRouter, Gemini, local Ollama, and a dozen other backends — see the <a href="/docs/providers/">provider guide</a> for the full list.</p>
      <p>Prefer environment variables? The fastest OpenAI-compatible setup:</p>
      <pre><code>export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

gakrcli</code></pre>
      <p>For GitHub Models, run <code>/onboard-github</code> for interactive OAuth onboarding.</p>

      <h2 id="first-task">3. give it a task</h2>
      <p>Write a task the way you'd brief a teammate:</p>
      <pre><code>&gt; add retry with exponential backoff to the fetch client, then run the tests</code></pre>
      <p>The agent streams its plan, tool calls, and file diffs live to your terminal. You'll see every command it runs and every edit it makes, in real time.</p>

      <h2 id="review">4. review the changes</h2>
      <p>When the agent finishes, review the diff directly in the session. Run the tests, check the output — everything stays visible. Accept the changes when you're satisfied.</p>

      <h2 id="next-steps">next steps</h2>
      <ul>
        <li><strong><a href="/docs/slash-commands/">Slash commands</a></strong> — Learn /compact, /branch, /rewind, /model, /mcp, and 65+ more</li>
        <li><strong><a href="/docs/configuration/">Configuration</a></strong> — Settings files, env vars, and project instructions</li>
        <li><strong><a href="/docs/cli-reference/">CLI reference</a></strong> — All flags for non-interactive runs, SSH sessions, and setup</li>
      </ul>
    </DocsLayout>
  )
}
