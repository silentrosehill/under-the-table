// City Mode: every Kenney kit paints its models from one 512² palette of shaded swatches.
// Each district gets its own copy of that palette with a few swatches swapped (London: white
// walls → brick, green roofs → slate), plus one shared mask that marks the window swatches so
// windows can light up. Swatch shading is kept by scaling each channel by target / original.
//   node tools/city-palettes.mjs        (also run by tools/build-assets.mjs)
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KITS = ['city-kit-suburban', 'city-kit-commercial', 'city-kit-industrial', 'city-kit-roads', 'fantasy-town-kit', 'train-kit', 'watercraft-kit', 'car-kit'];

// [original swatch colour, new colour]: matched on the top-left pixel of each 64×128 swatch.
// Night-time noir: soot and charcoal, dark glass (windows only light up through the glow mask),
// and every bright Kenney colour pushed down to brass, oxblood, navy or tarnished green.
const MUTED = [
  ['#ffc044', '#7d6234'], ['#ff7e44', '#6a3a26'], ['#cf534f', '#5a2422'], ['#fd6c40', '#5e3022'],
  ['#6794d9', '#2b3647'], ['#a878e8', '#3a3242'], ['#f378f0', '#47293a'], ['#61cb8b', '#34433a'],
  ['#d0e8ff', '#262b33'], ['#9bbdec', '#1e232a'], ['#b5ccec', '#272c33'],
  ['#f1976c', '#5c4436'], ['#b06041', '#4a2e22'], ['#f2bf99', '#6b5a4a'], ['#fde4c7', '#77705f'],
  ['#c3495c', '#4f2228'], ['#51b296', '#2f3f39'], ['#ca707b', '#4d2a2e'],
  ['#eeba88', '#4a3a2c'], ['#f0c59d', '#4f4031'], ['#c58262', '#3f2c22'], ['#9a5942', '#33231b'], ['#dd9f79', '#4a3628'], ['#d07b56', '#45291d'],
  ['#f8d6ae', '#5d5546'], ['#e76047', '#4f2420'], ['#5f74ca', '#252f3e'], ['#8158cf', '#2e2838'], ['#cc77eb', '#3b2638'], ['#3da679', '#2a352f'], ['#41a479', '#2a352f'], ['#51b985', '#2c3a32'],
];
// walls, cream/second walls, trim, side walls, roofs (the greys of the kits' darker swatches follow the trim/side/roof colours)
const mk = (white, cream, trim, side, roof, extra = []) => [
  ['#ffffff', white], ['#dcdce9', cream], ['#a0a8c9', trim], ['#868ba1', side], ['#4f5260', roof],
  ['#8e95b3', trim], ['#666b80', side], ...extra, ...MUTED,
];
export const DISTRICTS = {
  london: [                                 // soot-black London stock brick, wet slate, dirty Portland stone
    ['#ffffff', '#5a3328'], ['#dcdce9', '#4c2c23'], ['#a0a8c9', '#6c6458'], ['#868ba1', '#3b3734'],
    ['#4f5260', '#25262a'], ...MUTED,
  ],
  noir: [                                   // the rest of the city for now: grimy concrete and charcoal
    ['#ffffff', '#5f5a54'], ['#dcdce9', '#524d48'], ['#a0a8c9', '#4a4743'], ['#868ba1', '#383634'],
    ['#4f5260', '#232427'], ...MUTED,
  ],
  bowery: mk('#4d2b22', '#43251d', '#4e4640', '#33302d', '#2a211d',          // skid row: sooty red-brown brick, rusty dark iron
    [['#cf534f', '#4a2018'], ['#ff7e44', '#5a3020']]),
  paris: mk('#5e584e', '#544f46', '#6a6458', '#47433c', '#2a3340',            // Haussmann: dark cream-grey stone, zinc-blue roofs, oxblood awnings
    [['#cf534f', '#4a181c'], ['#c3495c', '#4a181c'], ['#ff7e44', '#4a181c']]),
  tokyo: mk('#55575a', '#4a4c50', '#3e4247', '#303338', '#1f2023'),            // bare cold concrete
  downtown: mk('#4d3326', '#42291f', '#5e5246', '#35302b', '#222022'),         // brownstone and dark brick
  harbour: mk('#474c47', '#3d423d', '#3a4a42', '#4a3a2c', '#2b2420',           // damp concrete, tarnished green trim, rust
    [['#ff7e44', '#5a3322'], ['#cf534f', '#4a2a20']]),
  canal: mk('#8d8670', '#7a735f', '#8a6d38', '#6c6654', '#38383a',             // art deco: dark limestone, brass trim
    [['#ffc044', '#9a7a3c'], ['#cf534f', '#5a2a24'], ['#e76047', '#5a2a24'], ['#c3495c', '#5a2a24']]),
  luxe: mk('#a6a298', '#918d83', '#b0894a', '#75716a', '#2a2a30',              // white marble, gold trim
    [['#ffc044', '#b0894a']]),
};
const WINDOWS = ['#d0e8ff', '#9bbdec', '#b5ccec'];

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 24;

for (const kit of KITS) {
  const src = join(root, 'public/assets/city', kit, 'Textures/colormap.png');
  if (!existsSync(src)) { console.warn('missing', src); continue; }
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, at = (x, y) => (y * W + x) * 3;
  const swatches = [];                                   // 8 columns × 3 bands under the black header
  for (let band = 1; band < 4; band++) for (let col = 0; col < 8; col++) {
    const x0 = col * 64, y0 = band * 128, i = at(x0 + 2, y0 + 2);
    swatches.push({ x0, y0, top: [data[i], data[i + 1], data[i + 2]] });
  }
  for (const [name, swaps] of Object.entries(DISTRICTS)) {
    const out = Buffer.from(data);
    for (const sw of swatches) {
      const swap = swaps.find(([from]) => near(sw.top, rgb(from)));
      if (!swap) continue;
      const from = rgb(swap[0]), to = rgb(swap[1]);
      for (let y = sw.y0; y < sw.y0 + 128; y++) for (let x = sw.x0; x < sw.x0 + 64; x++) {
        const i = at(x, y);
        for (let c = 0; c < 3; c++) out[i + c] = Math.min(255, Math.round(data[i + c] * to[c] / Math.max(1, from[c])));
      }
    }
    await sharp(out, { raw: info }).png().toFile(join(root, 'public/assets/city', kit, `Textures/${name}.png`));
  }
  const mask = Buffer.alloc(data.length);
  for (const sw of swatches) if (WINDOWS.some(h => near(sw.top, rgb(h))))
    for (let y = sw.y0; y < sw.y0 + 128; y++) for (let x = sw.x0; x < sw.x0 + 64; x++) mask.fill(255, at(x, y), at(x, y) + 3);
  await sharp(mask, { raw: info }).png().toFile(join(root, 'public/assets/city', kit, 'Textures/windows.png'));
  console.log('palettes', kit);
}
