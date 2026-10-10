import DocsLayout from '../../components/DocsLayout'
import { flagGroups, subcommands } from '../../data/cliFlags'

const toc = [
  { id: 'usage', label: 'usage' },
  ...flagGroups.map(g => ({ id: g.id, label: g.label })),
  { id: 'subcommands', label: 'subcommands' },
  { id: 'daemon', label: 'daemon & background sessions' },
  { id: 'grpc', label: 'gRPC server' },
  { id: 'sdk', label: 'SDK' },
  { id: 'auto-updates', label: 'auto-updates' },
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

      <h2 id="daemon">daemon & background sessions</h2>
      <p>
        GakrCLI can detach work from your terminal. A background daemon keeps sessions
        running after you close the shell — useful for long builds, unattended fixes, or
        agents you check in on later.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">command</th>
              <th scope="col">description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>gakrcli daemon status</code></td>
              <td>Show the daemon and its background sessions (default when run with no subcommand).</td>
            </tr>
            <tr>
              <td><code>gakrcli daemon start / stop</code></td>
              <td>Start or stop the daemon process.</td>
            </tr>
            <tr>
              <td><code>gakrcli daemon bg</code></td>
              <td>Move the current session into the background.</td>
            </tr>
            <tr>
              <td><code>gakrcli daemon attach</code></td>
              <td>Interactively re-attach to a background session (CLI only — not available inside a running REPL).</td>
            </tr>
            <tr>
              <td><code>gakrcli daemon logs</code></td>
              <td>Tail a background session&rsquo;s log.</td>
            </tr>
            <tr>
              <td><code>gakrcli daemon kill</code></td>
              <td>Terminate a background session.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Inside a session, <code>/tasks</code> lists running background shells and delegated
        agents, and <code>/daemon</code> manages the same daemon surface. Delegated agents
        (see <a href="/docs/agents/">agents</a>) can run in the background and report back.
      </p>

      <h2 id="grpc">gRPC server</h2>
      <p>
        For embedding GakrCLI in other applications, CI pipelines, or custom UIs, the
        engine can run as a headless gRPC service with bidirectional streaming — real-time
        text chunks, tool calls, and permission requests over the wire.
      </p>
      <pre><code>{`# terminal 1 — start the server (listens on localhost:50051)
npm run dev:grpc

# terminal 2 — drive it with the bundled CLI client
npm run dev:grpc:cli`}</code></pre>
      <ul>
        <li><code>GRPC_PORT</code> — port to listen on (default <code>50051</code>).</li>
        <li><code>GRPC_HOST</code> — bind address (default <code>localhost</code>; use <code>0.0.0.0</code> only behind your own auth).</li>
        <li>Protobuf definitions live in <code>src/proto/gakrcli.proto</code> — generate clients for Python, Go, Rust, or anything else.</li>
      </ul>

      <h2 id="sdk">SDK</h2>
      <p>
        The same engine is shipped as a Node.js SDK for embedding GakrCLI in apps, IDE
        integrations, automation workers, or test harnesses — without the terminal UI.
        It is bundled separately (<code>dist/sdk.mjs</code>) and imports from the
        package&rsquo;s <code>./sdk</code> subpath:
      </p>
      <pre><code>{`import { query, unstable_v2_createSession } from '@gakr-gakr/gakrcli/sdk'`}</code></pre>
      <ul>
        <li><strong>Headless queries</strong> — <code>query()</code> / <code>queryAsync()</code> run one prompt or an async stream of prompts and yield typed messages (assistant output, tool progress, permission events, retries, results).</li>
        <li><strong>Sessions</strong> — the <code>unstable_v2_*</code> session API gives persistent multi-turn conversations; transcript helpers list, read, rename, tag, fork, and delete sessions.</li>
        <li><strong>Permissions</strong> — callbacks let the host app decide which tool calls are allowed.</li>
        <li><strong>MCP</strong> — attach MCP servers (stdio, SSE, HTTP, or in-process SDK-defined tools) to SDK-run agents.</li>
      </ul>
      <p>Always pass <code>options.cwd</code>, and run <code>/gakrcli-api</code> in a session for guided SDK development.</p>

      <h2 id="auto-updates">auto-updates</h2>
      <p>
        GakrCLI can keep itself current. On startup it checks the release channel and
        applies updates in the background; <code>/update</code> (or
        <code>/update stable</code>, <code>/update &lt;version&gt;</code>) forces a specific
        channel or version, with <code>--force</code> to override.
      </p>
      <ul>
        <li><code>allowAutoUpdates</code> (settings.json) — disable the auto-updater entirely.</li>
        <li><code>autoUpdatesChannel</code> (settings.json) — <code>latest</code> (default) or <code>stable</code>.</li>
      </ul>
    </DocsLayout>
  )
}
