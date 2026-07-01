import DocsLayout from '../../components/DocsLayout'
import { keybindings } from '../../data/keybindings'

const toc = [
  { id: 'defaults', label: 'default keybindings' },
  { id: 'customize', label: 'customize keybindings' },
]

export default function Keybindings() {
  return (
    <DocsLayout
      title="gakrcli keybindings reference"
      description="Complete list of gakrcli keyboard shortcuts: interrupt, exit, search history, toggle views, paste images, edit in external editor, and more."
      heading="keybindings"
      lede="Keyboard shortcuts for the interactive session. Edit or add your own in ~/.gakrcli/keybindings.json."
      toc={toc}
    >
      <h2 id="defaults">default keybindings</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">keys</th>
              <th scope="col">action</th>
              <th scope="col">context</th>
            </tr>
          </thead>
          <tbody>
            {keybindings.map(k => (
              <tr key={k.keys}>
                <td><code>{k.keys}</code></td>
                <td>{k.action}</td>
                <td>{k.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="customize">customize keybindings</h2>
      <p>Run <code>/keybindings</code> to open or create your user keybindings file at <code>~/.gakrcli/keybindings.json</code>. You can rebind any key or add chord bindings. See the <a href="/docs/skills/">skills</a> page for the <code>/keybindings-help</code> skill that walks you through the format.</p>
    </DocsLayout>
  )
}
