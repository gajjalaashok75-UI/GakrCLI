import DocsLayout from '../../components/DocsLayout'
import { flagGroups, subcommands } from '../../data/cliFlags'

const toc = [
  { id: 'usage', label: 'usage' },
  ...flagGroups.map(g => ({ id: g.id, label: g.label })),
  { id: 'subcommands', label: 'subcommands' },
]

export default function CliReference() {
  return (
    <DocsLayout
      title="gakrcli CLI reference — flags & subcommands"
      description="Full reference for the gakrcli command line: every flag (model, I/O formats, sessions, permissions, MCP) and subcommands like mcp and ssh."
      heading="CLI reference"
      lede="Every documented flag of the gakrcli binary, grouped by purpose. Slash commands you type inside a session are documented separately."
      toc={toc}
    >
      <h2 id="usage">usage</h2>
      <pre><code>{`gakrcli [options] [prompt]

# interactive session in the current repo
gakrcli

# non-interactive: print the result and exit
gakrcli -p "explain the build pipeline" --output-format json`}</code></pre>
      <p>Looking for <code>/commands</code> you type inside the session? See the <a href="/docs/slash-commands/">slash commands reference</a>.</p>

      {flagGroups.map(group => (
        <section key={group.id}>
          <h2 id={group.id}>{group.label}</h2>
          {group.intro && <p>{group.intro}</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">flag</th>
                  <th scope="col">description</th>
                </tr>
              </thead>
              <tbody>
                {group.flags.map(f => (
                  <tr key={f.flag}>
                    <td><code>{f.flag}{f.arg ? ` ${f.arg}` : ''}</code></td>
                    <td>{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2 id="subcommands">subcommands</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">subcommand</th>
              <th scope="col">description</th>
            </tr>
          </thead>
          <tbody>
            {subcommands.map(s => (
              <tr key={s.name}>
                <td><code>{s.usage}</code></td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Defaults for most of these flags can be persisted in settings files — see <a href="/docs/configuration/">configuration</a>.</p>
    </DocsLayout>
  )
}
