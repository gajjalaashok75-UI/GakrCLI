import CopyCommand from '../../components/CopyCommand'
import DocsLayout from '../../components/DocsLayout'
import { GAKR_IN_CHROME } from '../../data/gakrcliInChrome'

const toc = [
  { id: 'what-it-is', label: 'what it is' },
  { id: 'requirements', label: 'requirements' },
  { id: 'install-extension', label: 'install the extension' },
  { id: 'extension-id', label: 'set the extension id' },
  { id: 'use-it', label: 'use it' },
  { id: 'how-it-works', label: 'how the connection works' },
  { id: 'troubleshooting', label: 'troubleshooting' },
]

export default function GakrCLIInChrome() {
  return (
    <DocsLayout
      title="gakrcli in chrome — install the extension and control your browser"
      description="Install the gakrcli in chrome extension from the zip, load it in developer mode, set its extension id, and connect it to the gakrcli CLI with --chrome, --chrome-extension, or the stdio MCP server."
      heading="gakrcli in chrome"
      lede="Drive your real Chrome from the terminal: navigate, click, fill forms, screenshot, record GIFs, and read console logs and network requests — in the browser profile you are already signed into."
      toc={toc}
    >
      <h2 id="what-it-is">what it is</h2>
      <p>
        gakrcli in chrome is a Chrome extension plus a native host. The extension has the browser access (tabs, scripting,
        console, network, screenshots); the CLI speaks to it and exposes it to the agent as MCP tools named{' '}
        <code>mcp__gakrcli-in-chrome__*</code>. Because it runs in your own profile, it works with sites you are already
        logged into — unlike a headless browser.
      </p>

      <h2 id="requirements">requirements</h2>
      <ul>
        <li><strong>gakrcli 0.6.1+</strong> — installed with <code>{GAKR_IN_CHROME.installCommand}</code>.</li>
        <li><strong>Chrome or a Chromium-based browser</strong> — Chrome, Brave, Arc, Edge, Chromium, Vivaldi, or Opera. WSL is not supported.</li>
        <li>
          <strong>A gakrcli.ai subscription</strong> — the <code>gakrcli --chrome</code> integration and the
          <code>gakrcli-in-chrome</code> skill are gated on it in the CLI. The side-panel server and the stdio MCP server
          do not check it.
        </li>
      </ul>

      <h2 id="install-extension">install the extension</h2>
      <p>
        The extension is <strong>not on the Chrome Web Store</strong>. It ships as a zip you load yourself, which is why
        Chrome gives your copy its own id — see <a href="#extension-id">set the extension id</a>.
      </p>
      <p>
        <a className="button button-solid" href={GAKR_IN_CHROME.zipPath} download>
          download the extension (.zip)
        </a>
      </p>
      <ol>
        <li>Download the zip and unzip it to a folder you will keep, e.g. <code>~/gakrcli-in-chrome</code>. Do not delete the folder afterwards — Chrome loads from it on every start.</li>
        <li>Open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong> (top right).</li>
        <li>Click <strong>Load unpacked</strong> and select the unzipped folder (the one containing <code>manifest.json</code>).</li>
        <li>Copy the <strong>ID</strong> from the extension's card — 32 characters, <code>a</code>–<code>p</code>. You need it in the next step.</li>
      </ol>
      <p>
        The same works in the other Chromium browsers at <code>brave://extensions</code>, <code>edge://extensions</code>,
        and so on.
      </p>

      <h2 id="extension-id">set the extension id</h2>
      <p>
        Chrome derives an unpacked extension's id from the folder it was loaded from, so <strong>every install has a
        different id</strong>. The CLI has to be told which id yours has, in one of three ways:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">how</th>
              <th scope="col">where</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>the <code>/chrome</code> dialog</td>
              <td>choose <strong>Set Chrome extension ID</strong>, paste the id, press Enter. This also rewrites the native-host manifest for you.</td>
            </tr>
            <tr>
              <td>config file</td>
              <td><code>chromeExtensionId</code> in <code>~/.gakrcli.json</code></td>
            </tr>
            <tr>
              <td>environment</td>
              <td><code>GAKR_CHROME_EXTENSION_ID</code> — overrides the stored value, useful in scripts and CI</td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre><code>{GAKR_IN_CHROME.configSnippet}</code></pre>
      <p>
        Setting the id is not just bookkeeping: Chrome only starts the native host for the extension ids listed in the
        host manifest's <code>allowed_origins</code>, so a manifest that does not name your id cannot connect at all.
        The <code>/chrome</code> dialog and the startup preflight both say so if it is missing or mismatched.
      </p>

      <h2 id="use-it">use it</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">command</th>
              <th scope="col">what it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>gakrcli --chrome</code></td>
              <td>Starts a session with the browser tools available in the terminal. Restart gakrcli after changing the extension id.</td>
            </tr>
            <tr>
              <td><code>gakrcli --chrome-extension</code></td>
              <td>Runs the agent server the Chrome <strong>side panel</strong> talks to. The panel shows projects, sessions, and chat. Independent of <code>--chrome</code>; it does not start automatically.</td>
            </tr>
            <tr>
              <td><code>gakrcli --no-chrome</code></td>
              <td>Disables the integration for a session even if it is enabled by default.</td>
            </tr>
            <tr>
              <td><code>gakrcli --gakrcli-in-chrome-mcp</code></td>
              <td>Runs the same tools as a stdio MCP server, for other MCP clients.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Open the profile picker any time from the terminal:</p>
      <CopyCommand command="/chrome" />
      <p>
        All three surfaces expose the same tool set from one registry, so a tool that works in the terminal works in the
        side panel and over MCP too. The <code>/chrome</code> dialog also shows the live state: extension id, whether the
        extension was detected, whether the native host is connected, and whether the side-panel server is running.
      </p>
      <h2 id="chrome-tools">chrome browser tools</h2>
      <p>
        The <code>gakrcli --chrome</code> integration exposes the following tools to the agent. Each tool can be called via the
        MCP convention <code>mcp__gakrcli-in-chrome__<tool_name></code>.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">tool</th>
              <th scope="col">purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>get_windows_and_tabs</code></td>
              <td>Get all currently open browser windows and tabs</td>
            </tr>
            <tr>
              <td><code>chrome_navigate</code></td>
              <td>Navigate to a URL, refresh, or browse history (back/forward)</td>
            </tr>
            <tr>
              <td><code>chrome_read_page</code></td>
              <td>Get an accessibility tree of visible page elements. Use <code>depth</code> to limit traversal (0-30) and <code>filter: 'interactive'</code> for faster results on large pages</td>
            </tr>
            <tr>
              <td><code>chrome_keyboard</code></td>
              <td>Simulate keyboard input (single keys, combinations, or text)</td>
            </tr>
            <tr>
              <td><code>chrome_click_element</code></td>
              <td>Click on an element using ref from read_page, selector, or coordinates</td>
            </tr>
            <tr>
              <td><code>chrome_fill_or_select</code></td>
              <td>Fill form elements (input, textarea, select, checkbox, radio)</td>
            </tr>
            <tr>
              <td><code>chrome_screenshot</code></td>
              <td>Take screenshot of page or specific element</td>
            </tr>
            <tr>
              <td><code>chrome_get_web_content</code></td>
              <td>Fetch content from a web page or current tab</td>
            </tr>
            <tr>
              <td><code>chrome_history</code></td>
              <td>Retrieve and search browsing history</td>
            </tr>
            <tr>
              <td><code>chrome_bookmark_search/add/delete</code></td>
              <td>Manage Chrome bookmarks</td>
            </tr>
            <tr>
              <td><code>chrome_computer</code></td>
              <td>Comprehensive mouse/keyboard actions (click, type, scroll, resize, screenshot)</td>
            </tr>
            <tr>
              <td><code>performance_start_trace/stop_trace/analyze_insight</code></td>
              <td>Start/stop/analyze performance trace recording</td>
            </tr>
            <tr>
              <td><code>chrome_gif_recorder</code></td>
              <td>Record browser session as animated GIF</td>
            </tr>
            <tr>
              <td><code>chrome_handle_dialog</code></td>
              <td>Handle JavaScript dialogs (alert/confirm/prompt)</td>
            </tr>
            <tr>
              <td><code>chrome_network_request</code></td>
              <td>Send network request from browser with cookies</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2 id="how-it-works">how the connection works</h2>
      <ol>
        <li>The extension asks Chrome to start the native host (<code>com.gakr.chrome.bridge</code>), which must list your extension id in <code>allowed_origins</code>.</li>
        <li>The native host opens a local socket and the extension receives tool calls over it.</li>
        <li><code>gakrcli --chrome</code> connects to that socket and sends <code>call_tool</code> requests with a request id; the extension answers with the matching id.</li>
        <li>For the side panel it is the reverse: <code>gakrcli --chrome-extension</code> publishes its port, the native host hands it to the extension, and the panel talks HTTP to <code>127.0.0.1</code> on that port.</li>
      </ol>

      <h2 id="troubleshooting">troubleshooting</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">symptom</th>
              <th scope="col">cause and fix</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Extension shows <strong>Not detected</strong></td>
              <td>The id does not match the loaded folder, or the extension is disabled. Set the id from the extension's card on <code>chrome://extensions</code>.</td>
            </tr>
            <tr>
              <td>Native host <strong>Not connected</strong></td>
              <td>Chrome is closed, the extension is disabled, or the manifest's <code>allowed_origins</code> does not include your id. Open Chrome with the extension enabled, then choose <strong>Re-register native host</strong> in <code>/chrome</code>.</td>
            </tr>
            <tr>
              <td>Browser tools error immediately</td>
              <td>Nothing is listening on the native-host socket. Start Chrome with the extension enabled; if it persists, check that the native host binary path in the manifest still exists (reinstalling gakrcli moves it).</td>
            </tr>
            <tr>
              <td>Side panel says <strong>Service Not Started</strong></td>
              <td>That is the agent server, not the browser tools: run <code>gakrcli --chrome-extension</code>. <code>--chrome</code> does not start it.</td>
            </tr>
            <tr>
              <td>A tool call times out after 30s</td>
              <td>
                The extension did not answer — usually a page-level modal dialog blocking the browser, or the tab was closed. Dismiss the dialog or re-read the tabs.<br/><br/>
                <strong>Tip:</strong> Use the <code>depth</code> parameter with <code>chrome_read_page</code> to limit DOM traversal and improve performance on large pages. Start with <code>depth: 5</code> + <code>filter: 'interactive'</code> for fastest relevant results.<br/><br/>
                Available depth range: <code>0</code> (root only) to <code>30</code> (full DOM). Lower values reduce output size and can improve performance on complex pages.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        For a machine-readable report, run any of the three entry points and read the{' '}
        <code>[gakrcli-in-chrome]</code> lines it prints, or check the config value directly:
      </p>
      <pre><code>{GAKR_IN_CHROME.inspectCommand}</code></pre>
    </DocsLayout>
  )
}