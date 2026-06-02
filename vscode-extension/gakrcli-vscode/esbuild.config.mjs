import * as esbuild from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isWatch = process.argv.includes('--watch');
const extensionRoot = dirname(fileURLToPath(import.meta.url));

const buildOptions = {
  absWorkingDir: extensionRoot,
  entryPoints: [resolve(extensionRoot, 'src/extension.ts')],
  bundle: true,
  outfile: resolve(extensionRoot, 'dist/extension.js'),
  external: ['vscode', '@gakr-gakr/gakrcli/sdk'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Extension built successfully');
}
