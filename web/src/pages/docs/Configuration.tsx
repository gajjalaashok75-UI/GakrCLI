import DocsLayout from '../../components/DocsLayout'
import { settingsFiles, settingOptions, envVars } from '../../data/configuration'

const toc = [
  { id: 'settings-files', label: 'settings files' },
  { id: 'common-options', label: 'common options' },
  { id: 'memory', label: 'memory & auto-dream' },
  { id: 'environment-variables', label: 'environment variables' },
  { id: 'project-instructions', label: 'project instructions' },
]

export default function Configuration() {
  return (
    <DocsLayout
      title="gakrcli configuration — settings.json & env vars"
      description="Configure gakrcli with settings.json files, project profiles, and environment variables like ANTHROPIC_API_KEY and OPENAI_API_KEY. Full options reference."
      heading="configuration"
      lede="Layered settings files for defaults, environment variables for auth and CI, and project instructions for context."
      toc={toc}
    >
      <h2 id="settings-files">settings files</h2>
      <p>Settings merge in order: user → project → local, with later layers overriding earlier ones. Open the interactive panel with <code>/config</code>, or edit the files directly.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">file</th>
              <th scope="col">scope</th>
              <th scope="col">notes</th>
            </tr>
          </thead>
          <tbody>
            {settingsFiles.map(f => (
              <tr key={f.path}>
                <td><code>{f.path}</code></td>
                <td>{f.scope}</td>
                <td>{f.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="common-options">common options</h2>
      <p>A few of the most-used keys in <code>settings.json</code>:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">key</th>
              <th scope="col">what it does</th>
            </tr>
          </thead>
          <tbody>
            {settingOptions.map(o => (
              <tr key={o.key}>
                <td><code>{o.key}</code></td>
                <td>{o.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>One-off overrides beat files: <code>--settings</code> accepts a path or inline JSON, and <code>--setting-sources</code> restricts which layers load — see the <a href="/docs/cli-reference/#config">CLI reference</a>.</p>

      <h2 id="memory">memory &amp; auto-dream</h2>
      <p>
        GakrCLI maintains a per-project auto-memory: markdown files the agent writes as it
        learns about your codebase (conventions, gotchas, architecture notes), plus a
        session summary per conversation. Everything is stored locally under
        <code>~/.gakrcli/</code> — nothing leaves the machine.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">key</th>
              <th scope="col">what it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>autoMemoryEnabled</code></td>
              <td>Set to <code>false</code> to disable auto-memory reads and writes for a project (e.g. regulated or client-sensitive repos). If both this and its alias are set, the more restrictive value wins.</td>
            </tr>
            <tr>
              <td><code>autoMemoryDirectory</code></td>
              <td>Override where the memory directory lives (defaults beside the project&rsquo;s git root so worktrees share one memory).</td>
            </tr>
            <tr>
              <td><code>autoDreamEnabled</code></td>
              <td>Enable background memory consolidation (&ldquo;auto-dream&rdquo;): once enough time and new sessions have accumulated, a forked subagent runs the /dream prompt to review, merge, and prune memory files automatically.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Memory is searchable: relevant notes are recalled into context automatically, and
        the model can search on demand with the <code>memory_recall</code> tool (enabled
        whenever auto-memory is on). Edit memory directly with <code>/memory</code>, or run
        consolidation manually with <code>/dream</code>. You can also disable all
        non-essential traffic with <code>GAKR_CODE_DISABLE_NONESSENTIAL_TRAFFIC</code>.
      </p>

      <h2 id="environment-variables">environment variables</h2>
      <p>Auth and transport are driven by environment variables, which makes CI and <code>--print</code> scripting straightforward:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">variable</th>
              <th scope="col">purpose</th>
            </tr>
          </thead>
          <tbody>
            {envVars.map(v => (
              <tr key={v.name}>
                <td><code>{v.name}</code></td>
                <td>{v.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Provider-specific setup recipes live on the <a href="/docs/providers/">providers page</a>.</p>

      <h2 id="project-instructions">project instructions</h2>
      <p><code>GAKRCLI.md</code> (or <code>.gakrcli/GAKRCLI.md</code>) is loaded into context at session start — build commands, conventions, and anything the agent should always know about the repo. Generate a starting point with <code>/init</code>, and edit persistent memory with <code>/memory</code>.</p>
    </DocsLayout>
  )
}
