import { commands } from './content-commands'

function Commands() {
  return (
    <div className="page commands">
      <header className="page-header">
        <p className="eyebrow">// commands</p>
        <h1>Common commands and keyboard toggles.</h1>
      </header>

      <div className="table-wrap">
        <table className="commands-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>Description</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {commands.map(command => (
              <tr key={command.id}>
                <td><code>{command.command}</code></td>
                <td>{command.description}</td>
                <td>{command.shortcut || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Commands
