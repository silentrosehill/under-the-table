// Turns the raw downloads in assets-src/ into compact game assets in public/assets/.
//   node tools/build-assets.mjs
// Models: Meshopt geometry + WebP textures. Textures: resized WebP.
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = p => join(root, 'assets-src', p);
const out = p => { const f = join(root, 'public/assets', p); mkdirSync(dirname(f), { recursive: true }); return f; };

const MODELS = {
  hanging_industrial_lamp: 1024,
  lightbulb_01: 1024,
  WoodenChair_01: 1024,
  round_spectacles: 1024,
  vintage_lighter: 1024,
  vintage_pocket_watch: 1024,
  cigarette_pack: 1024,      // keep parts separate: the loose cigarette is used on its own
  office_notepads: 1024,
};

const TEXTURES = [
  // [source, output, size]
  ['wood_table_worn/wood_table_worn_diff_2k.jpg', 'textures/table_color.webp', 2048],
  ['wood_table_worn/wood_table_worn_nor_gl_2k.jpg', 'textures/table_normal.webp', 2048],
  ['wood_table_worn/wood_table_worn_arm_2k.jpg', 'textures/table_arm.webp', 2048],
  ['Rope001/x/Rope001_1K-JPG_Color.jpg', 'textures/rope_color.webp', 512],
  ['Rope001/x/Rope001_1K-JPG_NormalGL.jpg', 'textures/rope_normal.webp', 512],
  ['Cardboard004/x/Cardboard004_1K-JPG_Color.jpg', 'textures/cardboard_color.webp', 1024],
  ['Cardboard004/x/Cardboard004_1K-JPG_NormalGL.jpg', 'textures/cardboard_normal.webp', 1024],
  ['Cardboard004/x/Cardboard004_1K-JPG_Roughness.jpg', 'textures/cardboard_rough.webp', 1024],
  ['Paper003/x/Paper003_1K-JPG_Color.jpg', 'textures/paper_color.webp', 1024],
  ['Paper003/x/Paper003_1K-JPG_NormalGL.jpg', 'textures/paper_normal.webp', 1024],
  ['Paper003/x/Paper003_1K-JPG_Roughness.jpg', 'textures/paper_rough.webp', 1024],
];

const cli = join(root, 'node_modules/.bin/gltf-transform');
for (const [name, size] of Object.entries(MODELS)) {
  const input = src(`${name}/${name}.gltf`);
  if (!existsSync(input)) { console.warn('missing', input); continue; }
  const keepParts = ['cigarette_pack', 'vintage_pocket_watch'].includes(name);   // parts animated/used separately
  // (parts used on their own skip quantized compression, which would put dequantize transforms on each part)
  execFileSync(cli, ['optimize', input, out(`models/${name}.glb`), '--compress', keepParts ? 'false' : 'meshopt',
    '--texture-compress', 'webp', '--texture-size', String(size), '--simplify', 'false',
    ...(keepParts ? ['--join', 'false', '--flatten', 'false'] : [])], { stdio: 'inherit' });
}
for (const [from, to, size] of TEXTURES) {
  await sharp(src(from)).resize(size, size, { fit: 'inside' }).webp({ quality: 88 }).toFile(out(to));
  console.log('texture', to);
}
copyFileSync(src('fireplace/fireplace_2k.hdr'), out('hdri/fireplace_2k.hdr'));

// black & white tile photos (tools/photo-list.json, credited in CREDITS.md) + the manifest the board reads
const { MAPS } = createRequire(import.meta.url)('../maps.js');
const slug = n => n.split(',')[0].normalize('NFD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const manifest = {};
for (const p of JSON.parse(readFileSync(join(root, 'tools/photo-list.json'), 'utf8'))) {
  if (!p.raw) continue;
  const name = slug(MAPS.underworld.names[p.tile]);
  await sharp(join(root, p.raw)).resize(512, 400, { fit: 'cover' }).webp({ quality: 78 }).toFile(out(`photos/${name}.webp`));
  manifest[name] = `${name}.webp`;
}
writeFileSync(out('photos/index.json'), JSON.stringify(manifest, null, 1));
console.log('photos', Object.keys(manifest).length);

// City Mode: the Kenney kits (CC0) are served as they come (small GLBs sharing one palette texture per kit),
// then tools/city-palettes.mjs paints the district palettes and window masks next to them
const CITY_KITS = {
  'city-kit-roads': 'kenney-city-kit-roads', 'city-kit-suburban': 'kenney-city-kit-suburban', 'city-kit-commercial': 'kenney-city-kit-commercial',
  'city-kit-industrial': 'kenney-city-kit-industrial', 'car-kit': 'kenney-car-kit', 'mini-characters': 'kenney-mini-characters',
  'fantasy-town-kit': 'kenney-fantasy-town-kit', 'train-kit': 'kenney-train-kit', 'watercraft-kit': 'kenney-watercraft-kit',
};
const findDir = (dir, name) => { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) { if (e === name) return p; const f = findDir(p, name); if (f) return f; } } return null; };
const cityIndex = {};
for (const [kit, folder] of Object.entries(CITY_KITS)) {
  const from = findDir(src(folder), 'GLB format');
  if (!from) { console.warn('missing kit', folder); continue; }
  cpSync(from, out(`city/${kit}/.`), { recursive: true });
  cityIndex[kit] = readdirSync(from).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)).sort();
}
const natureFrom = join(src('kenney-nature-kit'), 'x/Models/GLTF format');
for (const f of readdirSync(natureFrom).filter(f => f.endsWith('.glb'))) copyFileSync(join(natureFrom, f), out(`city/nature-kit/${f}`));
cityIndex['nature-kit'] = readdirSync(natureFrom).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)).sort();
writeFileSync(out('city/index.json'), JSON.stringify(cityIndex));
execFileSync('node', [join(root, 'tools/city-palettes.mjs')], { stdio: 'inherit' });
console.log('done');
