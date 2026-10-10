import DocsLayout from '../../components/DocsLayout'
import CopyCommand from '../../components/CopyCommand'

const toc = [
  { id: 'what', label: 'what agents are' },
  { id: 'builtin', label: 'built-in agents' },
  { id: 'custom', label: 'custom agents' },
  { id: 'spawn', label: 'spawning agents' },
  { id: 'coordination', label: 'coordination & teams' },
  { id: 'scheduled', label: 'scheduled agents' },
]

export default function Agents() {
  return (
    <DocsLayout
      title="gakrcli agents — subagents & custom agents"
      description="Use gakrcli agents: specialized subagents with their own context window, custom agent definitions in .gakrcli/agents/, coordinator mode, teams, and scheduled remote agents."
      heading="agents"
      lede="Agents are subagents with their own context window, tool subset, and persona. Use them to parallelize work, keep your main context clean, or encode a repeatable way of working."
      toc={toc}
    >
      <h2 id="what">what agents are</h2>
      <p>
        When the main agent delegates a task, it spawns a subagent: a fresh conversation
        with the same tools (optionally a subset) that works independently and reports
        back a summary instead of dumping every intermediate step into your context.
        Delegation happens through the <code>Agent</code> tool — you can also ask for it
        explicitly (“use an Explore agent to map the auth flow”).
      </p>

      <h2 id="builtin">built-in agents</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">agent</th>
              <th scope="col">role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>general-purpose</code></td>
              <td>The default: full tool access, researches and executes multi-step tasks.</td>
            </tr>
            <tr>
              <td><code>Explore</code></td>
              <td>Fast read-only search agent for answering “where/what/how” questions without burning main-context tokens.</td>
            </tr>
            <tr>
              <td><code>Plan</code></td>
              <td>Read-only architect agent: reads the codebase and produces implementation plans.</td>
            </tr>
            <tr>
              <td><code>verification</code></td>
              <td>Read-only agent used to verify that a change actually does what it claims (tests, behavior checks).</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="custom">custom agents</h2>
      <p>
        Define your own agents as markdown files with YAML frontmatter. Put project agents
        in <code>.gakrcli/agents/</code> (committed with the repo) or user-wide agents in{' '}
        <code>~/.gakrcli/agents/</code>:
      </p>
      <pre><code>{`---
name: code-reviewer
description: Reviews changed code for bugs, security issues, and style drift.
tools:
  - Read
  - Grep
  - Glob
  - Bash
model: sonnet
---

You are a senior code reviewer. Read the diff, verify each finding against
the actual code, and report only issues you can point at concretely.`}</code></pre>
      <ul>
        <li><strong>name</strong> — the identifier used as <code>subagent_type</code>.</li>
        <li><strong>description</strong> — what the agent is for; the model uses this to decide when to delegate to it.</li>
        <li><strong>tools</strong> — optional allowlist of tools the agent may use.</li>
        <li><strong>model</strong> — optional model override (e.g. a cheaper model for search agents).</li>
        <li><strong>skills</strong> — optional skills to preload for the agent.</li>
        <li><strong>mcp servers</strong> — optional required MCP servers; the agent only becomes available when they are configured.</li>
      </ul>
      <p>Manage agents interactively with <code>/agents</code>, pass one for a whole session with <code>--agent &lt;name&gt;</code>, or set a default via the <code>agent</code> setting in <a href="/docs/configuration/">settings.json</a>.</p>

      <h2 id="spawn">spawning agents</h2>
      <ul>
        <li><strong>Delegation</strong> — the model calls the <code>Agent</code> tool with a <code>subagent_type</code> and a briefing. Brief it like a colleague who has not seen the conversation: what to do, why it matters, what “done” means.</li>
        <li><strong>Forking</strong> — omitting <code>subagent_type</code> forks the current conversation instead: the child inherits full context, which is ideal when the intermediate tool output is not worth keeping in the parent.</li>
        <li><strong>Background</strong> — delegated agents can run in the background; check on them with <code>/tasks</code> and read output via the <code>TaskOutput</code> tool.</li>
        <li><strong>Worktrees</strong> — pair delegation with git worktree isolation (the <code>EnterWorktree</code>/<code>ExitWorktree</code> tools, or <code>--worktree</code>) so parallel agents never fight over the same files.</li>
      </ul>

      <h2 id="coordination">coordination & teams</h2>
      <p>
        For multi-agent sessions, coordinator mode lets a lead agent decompose the work and
        talk to workers through the <code>SendMessage</code> tool, and{' '}
        <code>TeamCreate</code>/<code>TeamDelete</code> manage a team of cooperating agents.
        This is how <a href="/docs/skills/">/batch</a>-style runs fan out across 5–30
        isolated worktree agents that each open a PR.
      </p>

      <h2 id="scheduled">scheduled agents</h2>
      <p>
        Agents are not limited to live sessions. Cron-style scheduling
        (<code>CronCreate</code>/<code>CronList</code>/<code>CronDelete</code> in-session,
        or the <code>/schedule</code> skill for remote triggers) lets you register agents
        that run on a schedule — nightly dependency audits, weekly report generation, or a
        recurring check that CI is green. Use <code>/loop</code> to run a prompt on a fixed
        interval within the current session.
      </p>
      <CopyCommand command={'gakrcli --agent code-reviewer "review the diff on this branch"'} />
      <p style={{ marginTop: 16 }}>Learn more on the <a href="/docs/tools/">tools page</a> (Agent, TaskOutput, Monitor) and the <a href="/docs/slash-commands/">slash commands reference</a> (/agents, /tasks, /goal).</p>
    </DocsLayout>
  )
}
