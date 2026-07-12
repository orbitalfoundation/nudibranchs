// Production build: bundle the app into a self-contained dist/ that serves as
// plain static files (no import map pointing at /node_modules, no CDN). This is
// what gets rsynced to the exe.dev VM.
//
// The bundle filename is CONTENT-HASHED (`app-<hash>.js`). That's the fix for the
// stale-page bug: the old build emitted a fixed `app.js` with a 1-hour cache, so a
// deploy could be shadowed for up to an hour by a browser's cached copy. With a
// hashed name a new build gets a new URL that can't collide with the cached old
// one; index.html (served no-cache — see deploy/Caddyfile) points at the current
// hash, so a deploy is picked up immediately.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// 1. Bundle JS (three, lil-gui, our modules) into one content-hashed file.
const result = await build({
  entryPoints: [join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  outdir: DIST,
  entryNames: 'app-[hash]',
  assetNames: 'asset-[hash]',
  logLevel: 'info',
  metafile: true,
});

const outFiles = Object.keys(result.metafile.outputs).map((f) => f.split('/').pop());
const jsFile = outFiles.find((f) => f.endsWith('.js') && !f.endsWith('.map'));
if (!jsFile) throw new Error('could not find bundled JS in esbuild output');

// 2. Rewrite index.html for production: inline lil-gui's CSS, drop the import map,
//    and point the module script at the hashed bundle.
let html = await readFile(join(ROOT, 'index.html'), 'utf8');
const guiCss = await readFile(join(ROOT, 'node_modules/lil-gui/dist/lil-gui.css'), 'utf8');

html = html
  .replace(
    '<link rel="stylesheet" href="/node_modules/lil-gui/dist/lil-gui.css" />',
    `<style>${guiCss}</style>`
  )
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace('<script type="module" src="/src/main.js"></script>', `<script type="module" src="./${jsFile}"></script>`);

await writeFile(join(DIST, 'index.html'), html);

// 3. Report size.
const bytes = Object.values(result.metafile.outputs).reduce((a, o) => a + o.bytes, 0);
console.log(`\n✓ dist/ built — ${(bytes / 1024 / 1024).toFixed(2)} MB total`);
console.log(`  files: index.html, ${jsFile} (+ .map)`);
