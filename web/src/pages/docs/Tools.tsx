import DocsLayout from '../../components/DocsLayout'
import {
  toolGroups,
  browserActions,
  browserFeatures,
} from '../../data/tools'

const toc = [
  ...toolGroups.map(g => ({ id: g.id, label: g.label })),
  { id: 'webbrowser', label: 'WebBrowser tool' },
  { id: 'browser-actions', label: 'browser actions' },
  { id: 'browser-features', label: 'browser features' },
  { id: 'permissions', label: 'permissions & control' },
]

export default function Tools() {
  return (
    <DocsLayout
      title="gakrcli tools — every built-in tool the agent can use"
      description="Complete reference for gakrcli's built-in tools: file read/write/edit, Bash, Grep/Glob, WebFetch/WebSearch, the WebBrowser automation tool, subagents, memory recall, planning, scheduling, MCP integrations, and worktree isolation."
      heading="tools"
      lede="Every built-in tool the agent can call during a session — what each one does, when it is used, and how you control it."
      toc={toc}
    >
      <p>Tools are the agent's hands: it picks them per turn based on your request and its description of each tool. You can restrict the set with <code>--tools</code>, allow/deny individual tools with <code>--allowed-tools</code> / <code>--disallowed-tools</code> or <a href="/docs/configuration/">permission rules</a>, and MCP servers add more. Type <code>/permissions</code> in a session to manage rules interactively.</p>

      {toolGroups.map(group => (
        <section key={group.id}>
          <h2 id={group.id}>{group.label}</h2>
          {group.intro && <p>{group.intro}</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">tool</th>
                  <th scope="col">what it does</th>
                </tr>
              </thead>
              <tbody>
                {group.tools.map(t => (
                  <tr key={t.name}>
                    <td><code>{t.name}</code></td>
                    <td>{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2 id="webbrowser">WebBrowser tool</h2>
      <p>
        The <code>WebBrowser</code> tool gives the agent a real Chromium browser it can
        drive end to end — open pages, click, type, fill forms, read the result, and
        verify what happened. It is the tool behind “open the site, walk through the
        flow, and tell me what breaks” style requests.
      </p>
      <p>
        The model works against a numbered snapshot of the page: <code>get_state</code>{' '}
        returns every interactive element with an index, and that index is what you
        pass to <code>click</code> or <code>type</code> — no CSS-selector guessing.
      </p>

      <h3 id="browser-actions">browser actions</h3>
      <p>One tool, many actions — the model picks an <code>action</code> and its parameters:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">action</th>
              <th scope="col">description</th>
            </tr>
          </thead>
          <tbody>
            {browserActions.map(a => (
              <tr key={a.action}>
                <td><code>{a.action}</code></td>
                <td>{a.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 id="browser-features">browser features</h3>
      <ul>
        {browserFeatures.map(f => (
          <li key={f.title}>
            <strong>{f.title}</strong> — {f.body}
          </li>
        ))}
      </ul>

      <h2 id="permissions">permissions & control</h2>
      <ul>
        <li><strong>Read-only vs mutating</strong> — read-style calls (<code>get_state</code>, <code>get_content</code>, <code>screenshot</code>, <code>read_console_messages</code>, …) are treated as read-only; navigation, clicks, typing, and storage writes go through the normal permission flow.</li>
        <li><strong>Allow/deny rules</strong> — control the browser (and every other tool) from <code>settings.json</code> or <code>/permissions</code>; rules like <code>WebBrowser</code> or <code>Bash(git:*)</code> match by tool name and content pattern.</li>
        <li><strong>Scratch data</strong> — anything the browser writes to disk (screenshots, recordings) lands under <code>.agent_tmp/</code> in your project, so it never pollutes the repo (add it to .gitignore if you commit aggressively).</li>
        <li><strong>Configuration</strong> — headless/headed mode, window size, and window position are configurable in <a href="/docs/configuration/">settings.json</a> under the browser options.</li>
      </ul>
    </DocsLayout>
  )
}
