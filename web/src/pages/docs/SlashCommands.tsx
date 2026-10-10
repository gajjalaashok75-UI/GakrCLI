import DocsLayout from '../../components/DocsLayout'
import { commandCategories, commands, commandsByCategory } from '../../data/commands'

const toc = [
  ...commandCategories.map(c => ({ id: c.id, label: c.label })),
  { id: 'proactive-goals', label: 'proactive goals' },
]

export default function SlashCommands() {
  return (
    <DocsLayout
      title={`gakrcli slash commands reference — all ${commands.length}+ commands`}
      description={`Complete reference for every gakrcli slash command: /init, /config, /mcp, /review, /compact, /resume, /goal and ${commands.length}+ more, grouped by category with descriptions and usage details.`}
      heading="slash commands reference"
      ogImage="/og/commands.png"
      lede={`All ${commands.length} built-in slash commands, grouped by what they do. Type / inside a session to autocomplete any of them; plugins and skills can add more.`}
      toc={toc}
    >
      <p>Commands run inside an interactive session and start with <code>/</code>. For flags you pass when launching the binary, see the <a href="/docs/cli-reference/">CLI reference</a> instead. You can also extend this list with your own <a href="/docs/skills/">skills</a>.</p>

      {commandCategories.map(cat => (
        <section key={cat.id}>
          <h2 id={cat.id}>{cat.label}</h2>
          <p>{cat.blurb}</p>
          {commandsByCategory(cat.id).map(cmd => (
            <div className="cmd-entry" key={cmd.name}>
              <h3 id={`cmd-${cmd.name}`}>
                <code>/{cmd.name}{cmd.args ? ` ${cmd.args}` : ''}</code>
                <a className="anchor-link" href={`#cmd-${cmd.name}`} aria-label={`link to /${cmd.name}`}>#</a>
              </h3>
              <p>{cmd.description}</p>
              {cmd.details && <p>{cmd.details}</p>}
            </div>
          ))}
        </section>
      ))}

      <section>
        <h2 id="proactive-goals">proactive goals</h2>
        <p>
          A goal turns a session from “ask and wait” into “set an outcome and let the
          agent drive until it is reached.” Two commands work together:
        </p>
        <ol>
          <li>
            <strong><code>/goal &lt;condition&gt;</code></strong> — set a natural-language
            completion condition, e.g. <code>/goal all integration tests pass and the PR is open</code>.
            After every turn, an evaluator (a model call) judges whether the condition is
            met. If not, the agent is automatically instructed to keep going — with the
            evaluator&rsquo;s reason and a next instruction — instead of stopping at the
            end of a turn. It stops early when you are needed (a permission prompt or
            question) or when the agent reports it is blocked.
          </li>
          <li>
            <strong><code>/proactive</code></strong> — toggle autonomous tick-driven mode.
            Between your inputs the agent receives periodic ticks and keeps working,
            pacing itself with built-in sleep/wake. Combine it with <code>/goal</code> so
            the autonomy is steered at a concrete condition rather than drifting.
          </li>
        </ol>
        <p>
          Safety rails: goals run at most 50 turns before pausing (the goal is never lost —
          resume with <code>/goal resume</code>), the evaluator&rsquo;s reasoning is shown in
          <code>/goal status</code>, and every tool call still goes through the normal
          permission system — a goal can never auto-approve something you have not allowed.
        </p>
        <pre><code>{`# set the outcome, then let it run
/goal all tests green and changes committed

# check on it mid-run
/goal status

# pause / resume / clear
/goal pause
/goal resume
/goal clear

# go fully autonomous between turns as well
/proactive`}</code></pre>
        <p>
          Background work pairs well with goals: delegated agents and shells show up under
          <code>/tasks</code>, and detached sessions live under <code>/daemon</code>.
        </p>
      </section>
    </DocsLayout>
  )
}
