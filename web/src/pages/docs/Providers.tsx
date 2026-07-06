import DocsLayout from '../../components/DocsLayout'
import { providers } from '../../data/providers'

const toc = [
  { id: 'how-it-works', label: 'how provider setup works' },
  { id: 'supported-providers', label: 'supported providers' },
  { id: 'env-setup', label: 'env-var setup' },
]

export default function Providers() {
  return (
    <DocsLayout
      title="gakrcli providers — OpenAI, Gemini, Ollama & 13+ backends"
      description="Connect gakrcli to any model provider: Anthropic, OpenAI-compatible APIs, OpenRouter, Gemini, GitHub Models, Codex OAuth, Ollama, LM Studio, Bedrock, Vertex, and more."
      heading="model providers"
      lede="One agent, every backend. Wire a provider once and switch models mid-session."
      toc={toc}
    >
      <h2 id="how-it-works">how provider setup works</h2>
      <p>Run <code>/provider</code> inside a session for guided setup. It walks you through auth, lets you pick a model, and saves the result as a profile so future sessions — and other clones of the repo — boot the same way. You can also configure everything through <a href="/docs/configuration/">environment variables</a>, which is handy for CI and scripted <code>--print</code> runs.</p>
      <p>Switch models any time with <code>/model</code>, or pass <code>--provider</code> / <code>--model</code> on the command line — see the <a href="/docs/cli-reference/">CLI reference</a>.</p>

      <h2 id="supported-providers">supported providers</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">provider</th>
              <th scope="col">setup</th>
              <th scope="col">notes</th>
            </tr>
          </thead>
          <tbody>
            {providers.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td><code>{p.setup}</code></td>
                <td>{p.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="env-setup">env-var setup</h2>
      <p>Set the right environment variable and gakrcli picks up the provider on next launch. The full list of supported env vars is on the <a href="/docs/configuration/">configuration page</a>.</p>
    </DocsLayout>
  )
}
