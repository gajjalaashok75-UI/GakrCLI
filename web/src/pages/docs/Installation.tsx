import DocsLayout from '../../components/DocsLayout'
import { SITE } from '../../data/site'

const toc = [
  { id: 'requirements', label: 'requirements' },
  { id: 'install', label: 'install with npm' },
  { id: 'arch-linux', label: 'arch linux (aur)' },
  { id: 'verify', label: 'verify the install' },
  { id: 'update', label: 'update' },
  { id: 'troubleshooting', label: 'troubleshooting' },
]

export default function Installation() {
  return (
    <DocsLayout
      title="Install gakrcli — npm, macOS, Linux & Windows"
      description="How to install the gakrcli CLI with npm on macOS, Linux, and Windows. Requirements, global install, verifying the install, and updating to the latest version."
      heading="install gakrcli"
      lede="One npm command on macOS, Linux, or Windows. An AUR package exists for Arch."
      toc={toc}
    >
      <h2 id="requirements">requirements</h2>
      <ul>
        <li><strong>Node.js 18+</strong> — The CLI runs on Node.js 18 or later.</li>
        <li><strong>npm</strong> — Ships with Node.js, used for the global install.</li>
        <li><strong>git</strong> — Required for gakrcli to create commits and work with your repository.</li>
      </ul>

      <h2 id="install">install with npm</h2>
      <p>Install globally with npm:</p>
      <pre><code>{SITE.installCommand}</code></pre>
      <p>You may need <code>sudo</code> on macOS/Linux if your npm global prefix requires root. Consider using <a href="https://github.com/nvm-sh/nvm" rel="noopener">nvm</a> or <a href="https://volta.sh" rel="noopener">volta</a> to manage Node.js and avoid permission issues.</p>

      <h2 id="arch-linux">arch linux (aur)</h2>
      <p>Arch Linux users can install from the AUR:</p>
      <pre><code>yay -S gakrcli-bin</code></pre>

      <h2 id="verify">verify the install</h2>
      <p>Check the installed version:</p>
      <pre><code>gakrcli --version</code></pre>

      <h2 id="update">update</h2>
      <p>Re-run the install command to get the latest version. The auto-updater also checks for updates during session startup and can be managed with <code>/config</code>.</p>

      <h2 id="troubleshooting">troubleshooting</h2>
      <ul>
        <li><strong>Command not found</strong> — Ensure npm global bin is in your <code>$PATH</code>. Run <code>npm bin -g</code> to see where packages are installed.</li>
        <li><strong>Permission errors</strong> — Use a Node version manager (<code>nvm</code>, <code>volta</code>) or configure npm's prefix to a user-owned directory.</li>
      </ul>
    </DocsLayout>
  )
}
