// Regenerates the <link rel="modulepreload"> block in public/index.html from app.js's static import graph,
// so the browser fetches every module in parallel instead of discovering them one level at a time.
// Run after adding or removing a client module:  node tools/preload.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const seen = new Set();
(function walk(f) {
  if (seen.has(f)) return;
  seen.add(f);
  const src = readFileSync(join(pub, f), 'utf8');
  for (const m of src.matchAll(/^\s*import\s+(?:[^"']*?from\s+)?["']([^"']+)["']/gm)) {
    const t = m[1];                                              // relative, or a bare specifier from index.html's import map
    if (t.startsWith('.')) walk(normalize(join(dirname(f), t)));
    else if (t === 'three') walk('vendor/three/build/three.module.js');
    else if (t.startsWith('three/addons/')) walk('vendor/three/addons/' + t.slice(13));
    else if (t === 'cannon-es') walk('vendor/cannon-es.js');
  }
})('app.js');
seen.delete('app.js');

const links = [...seen].sort().map(f => `  <link rel="modulepreload" href="${f}">`).join('\n');
const file = join(pub, 'index.html'), html = readFileSync(file, 'utf8');
const A = '  <!-- preload:start (tools/preload.mjs) -->', B = '  <!-- preload:end -->';
const block = `${A}\n${links}\n${B}`;
const out = html.includes(A)
  ? html.slice(0, html.indexOf(A)) + block + html.slice(html.indexOf(B) + B.length)
  : html.replace('  <script type="module" src="app.js"></script>', `${block}\n  <script type="module" src="app.js"></script>`);
if (out === html && !html.includes(A)) throw new Error('app.js script tag not found in index.html');
writeFileSync(file, out);
console.log(`${seen.size} modules preloaded`);
