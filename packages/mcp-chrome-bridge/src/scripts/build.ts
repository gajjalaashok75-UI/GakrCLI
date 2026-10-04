import fs from 'fs';
import path from 'path';
import { COMMAND_NAME } from './constant';

const rootDir = path.join(__dirname, '..', '..');
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');

// ============================================================
// Entry points — each gets bundled separately
// ============================================================
const entryPoints = [
  { src: 'index.ts', outdir: '' },
  { src: 'cli.ts', outdir: '' },
  { src: 'mcp/mcp-server-stdio.ts', outdir: 'mcp' },
  { src: 'scripts/postinstall.ts', outdir: 'scripts' },
  { src: 'scripts/register.ts', outdir: 'scripts' },
  { src: 'scripts/register-dev.ts', outdir: 'scripts' },
];

// ============================================================
// 1. Clean previous build
// ============================================================
console.log('Cleaning previous build...');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(distDir, 'mcp'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'logs'), { recursive: true });

// ============================================================
// 2. Bundle with Bun
// ============================================================
console.log('Bundling with Bun...');

for (const ep of entryPoints) {
  const entryPath = path.join(srcDir, ep.src);
  const outfileName = path.basename(ep.src, '.ts') + '.js';
  const outdir = path.join(distDir, ep.outdir);
  const outfile = path.join(outdir, outfileName);

  fs.mkdirSync(outdir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [entryPath],
    outdir,
    naming: `[name].[ext]`,
    target: 'node',
    format: 'cjs',
    minify: false,
    sourcemap: 'external',
    packages: 'bundle',
    external: [
      // Node.js built-ins — never bundle
      'node:*',
      // Heavy runtime deps — keep as node_modules
      '@modelcontextprotocol/*',
      'hono',
      '@hono/*',
      'commander',
    ],
  });

  if (!result.success) {
    console.error(`Failed to bundle ${ep.src}:`);
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log(`  ✓ ${ep.src} → ${path.relative(rootDir, outfile)}`);

  // Bun hardcodes __dirname to the source path at build time.
  // Replace it with runtime __dirname so scripts can locate dist/ correctly.
  let code = fs.readFileSync(outfile, 'utf8');
  code = code.replace(
    /var __dirname = ".*?";/g,
    'var __dirname = require("path").dirname(__filename);',
  );
  fs.writeFileSync(outfile, code);
}

// ============================================================
// 3. Copy non-TS assets
// ============================================================
console.log('Copying assets...');

// Shell / batch wrappers
const scriptsDir = path.join(srcDir, 'scripts');
for (const file of ['run_host.sh', 'run_host.bat']) {
  const src = path.join(scriptsDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
  }
}

// ============================================================
// 4. Set executable permissions
// ============================================================
console.log('Setting executable permissions...');
const executables = ['index.js', 'cli.js', 'run_host.sh'];
for (const file of executables) {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    fs.chmodSync(filePath, 0o755);
  }
}

// ============================================================
// 5. Write node_path.txt
// ============================================================
const nodePathFile = path.join(distDir, 'node_path.txt');
fs.writeFileSync(nodePathFile, process.execPath, 'utf8');
console.log(`Node.js path: ${process.execPath}`);

// ============================================================
// 6. Write README
// ============================================================
const packageJson = require(path.join(rootDir, 'package.json'));
fs.writeFileSync(
  path.join(distDir, 'README.md'),
  `# ${packageJson.name}

Chrome extension Native Messaging host.

## Install

\`\`\`
npm install -g ${packageJson.name}
${COMMAND_NAME} register
\`\`\`
`,
);

console.log('✅ Build complete');
