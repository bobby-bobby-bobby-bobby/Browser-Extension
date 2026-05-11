import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const outDir = resolve(root, 'dist');

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await import('node:fs/promises').then((fs) => fs.readdir(src, { withFileTypes: true }));
  for (const entry of entries) {
    const from = resolve(src, entry.name);
    const to = resolve(dest, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else await copyFile(from, to);
  }
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

await rm(outDir, { recursive: true, force: true });

await viteBuild({
  root,
  plugins: [react()],
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(root, 'src/popup/index.html'),
        options: resolve(root, 'src/settings/index.html')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});

await esbuild({
  entryPoints: [resolve(root, 'src/content/content.ts')],
  bundle: true,
  outfile: resolve(outDir, 'content.js'),
  platform: 'browser',
  format: 'iife',
  target: ['chrome110'],
  sourcemap: false,
  legalComments: 'none'
});

await esbuild({
  entryPoints: [resolve(root, 'src/background/service-worker.ts')],
  bundle: true,
  outfile: resolve(outDir, 'background.js'),
  platform: 'browser',
  format: 'esm',
  target: ['chrome110'],
  sourcemap: false,
  legalComments: 'none'
});

await copyFile(resolve(root, 'dist/src/popup/index.html'), resolve(outDir, 'popup.html'));
await copyFile(resolve(root, 'dist/src/settings/index.html'), resolve(outDir, 'options.html'));
await rm(resolve(outDir, 'src'), { recursive: true, force: true });

const manifest = JSON.parse(await readFile(resolve(root, 'public/manifest.json'), 'utf8'));
await writeFile(resolve(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
if (await exists(resolve(root, 'public/icons'))) await copyDir(resolve(root, 'public/icons'), resolve(outDir, 'icons'));

const required = ['manifest.json', 'popup.html', 'options.html', 'background.js', 'content.js'];
await Promise.all(required.map(async (file) => {
  if (!(await exists(resolve(outDir, file)))) throw new Error(`Missing required extension output: ${file}`);
}));
