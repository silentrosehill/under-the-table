// Code-built buildings for the district archetypes (tenements, rowhouses, Haussmann fronts, neon slivers,
// shop fronts, deco towers, marble hotels…). Each building is a handful of textured quads: one canvas
// facade per style (a tile of bays: wall, windows, balconies), a separate ground-floor strip (shop window,
// door, boards) and a roof. The textures come in two passes (colour and a window-only emissive map) so the
// windows light up through the same glow keys as the Kenney pieces. Everything is shared per style/glow
// group, so a whole lot bakes into a few meshes (kit.js bake()).
// Lot coordinates as in districts.js: x across the tile, z from the kerb (0) to the back, fronts face −z.
import * as THREE from 'three';
import { procMaterial } from './kit.js';

const K = 900;                                           // texture pixels per city unit

function rng(seed) { let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const jit = (h, r, a) => `rgb(${rgb(h).map(v => Math.max(0, Math.min(255, Math.round(v + (r() - 0.5) * 2 * a)))).join(',')})`;
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h));
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ facade styles
// nc × nr bays per texture tile, bayW × bayH world units each. Window kinds: tall, sash, french, small, slit, grid, plate.
export const FACADES = {
  tenement: { kinds: ['door', 'shop', 'pawn'], nc: 3, nr: 2, bayW: 0.15, bayH: 0.19, wall: '#33201b', mortar: '#1a1210', pattern: 'brick',
    win: { kind: 'tall', w: 0.056, h: 0.115, dy: 0.04, frame: '#241c18', glass: '#0b0e12', lintel: '#4a423c', sill: '#4a423c' }, lit: ['#ffb25e', '#e89a4a', '#ffcb82'], litP: 0.32,
    gnd: { gw: 0.22, gh: 0.22, frame: '#1a1412', glass: '#0c0e10', door: '#3a2a20', lit: ['#ffc070', '#ffb25e'], fascia: '#17120f', accent: '#8a6d3b' } },
  brick: { kinds: ['door', 'shop'], nc: 1, nr: 2, bayW: 0.23, bayH: 0.2, wall: '#6a382a', mortar: '#35231c', pattern: 'brick',
    win: { kind: 'sash', w: 0.085, h: 0.105, dy: 0.05, frame: '#a39682', glass: '#0b0f13', lintel: '#7d7466', sill: '#8a8070' }, lit: ['#ffc272', '#ffb25e', '#ffd89a'], litP: 0.5,
    gnd: { gw: 0.23, gh: 0.2, frame: '#a39682', glass: '#0b0f13', door: '#2d4a3e', lit: ['#ffc272', '#ffb25e'], fascia: '#2c1c16', accent: '#a39682' } },
  haussmann: { kinds: ['cafe'], nc: 2, nr: 2, bayW: 0.22, bayH: 0.21, wall: '#84777a', mortar: '#554a4e', pattern: 'stone',
    win: { kind: 'french', w: 0.08, h: 0.15, dy: 0.02, frame: '#35322c', glass: '#0b0f13', lintel: '#948789', sill: '#948789', balcony: [0] }, lit: ['#ffb07a', '#ffc488', '#ff9a78'], litP: 0.5,
    gnd: { gw: 0.22, gh: 0.24, frame: '#2a2420', glass: '#0b0d12', door: '#4a1820', lit: ['#ffb07a', '#ff9a78'], fascia: '#1a1214', accent: '#c9567a' } },
  tokyo: { kinds: ['arcade'], nc: 3, nr: 3, bayW: 0.065, bayH: 0.1, wall: '#46494e', mortar: '#2c2e32', pattern: 'concrete',
    win: { kind: 'small', w: 0.038, h: 0.048, dy: 0.035, frame: '#222428', glass: '#0b0e12', lintel: null, sill: '#2e3034' }, lit: ['#ffdca0', '#cfe4ff', '#ffb87a', '#bfe8d8'], litP: 0.5,
    gnd: { gw: 0.2, gh: 0.2, frame: '#1a1b1e', glass: '#0a0c10', door: '#2a2c30', lit: ['#cfe4ff', '#ffb87a'], fascia: '#121316', accent: '#9a4a6a' } },
  shopfront: { kinds: ['shop', 'arcade'], nc: 2, nr: 1, bayW: 0.22, bayH: 0.2, wall: '#6a3024', mortar: '#2c1d16', pattern: 'brick',
    win: { kind: 'plate', w: 0.14, h: 0.11, dy: 0.045, frame: '#201a16', glass: '#0b0e12', lintel: '#6a5e50', sill: '#6a5e50' }, lit: ['#ffc272', '#ffb25e', '#ffd89a'], litP: 0.5,
    gnd: { gw: 0.22, gh: 0.22, frame: '#15110f', glass: '#0b0d10', door: '#3a2a20', lit: ['#ffd089', '#ffb25e'], fascia: '#17110e', accent: '#8a3a36' } },
  deco: { kinds: ['lobby'], nc: 2, nr: 1, bayW: 0.085, bayH: 0.17, wall: '#4b7562', mortar: '#2c4a3c', pattern: 'panel',
    win: { kind: 'slit', w: 0.036, h: 0.105, dy: 0.02, frame: '#8a6d38', glass: '#0c1118', lintel: null, sill: null, spandrel: '#4d412a' }, lit: ['#ffd48a', '#ffc46a', '#ffe0a8'], litP: 0.6,
    gnd: { gw: 0.2, gh: 0.26, frame: '#8a6d38', glass: '#0c1118', door: '#8a6d38', lit: ['#ffd48a', '#ffe0a8'], fascia: '#4d412a', accent: '#c9a24f' } },
  marble: { kinds: ['lobby'], nc: 2, nr: 1, bayW: 0.11, bayH: 0.19, wall: '#a0a9c4', mortar: '#6f7894', pattern: 'panel',
    win: { kind: 'tall', w: 0.05, h: 0.125, dy: 0.02, frame: '#b0894a', glass: '#0b0f16', lintel: null, sill: '#b0894a', band: '#b0894a' }, lit: ['#fff0cc', '#ffe3a8', '#ffd48a'], litP: 0.55,
    gnd: { gw: 0.22, gh: 0.27, frame: '#b0894a', glass: '#0b0f16', door: '#b0894a', lit: ['#fff0cc', '#ffe3a8'], fascia: '#2a2a30', accent: '#d8b45e' } },
  warehouse: { kinds: ['garage'], nc: 2, nr: 1, bayW: 0.2, bayH: 0.2, wall: '#68766c', mortar: '#2a2f2c', pattern: 'concrete',
    win: { kind: 'grid', w: 0.15, h: 0.1, dy: 0.07, frame: '#1d211e', glass: '#0b0f12', lintel: null, sill: '#2c312d' }, lit: ['#ff9a3c', '#ffb25e', '#ff8a2a'], litP: 0.75,
    gnd: { gw: 0.3, gh: 0.22, frame: '#1a1d1b', glass: '#0b0e11', door: '#4a3022', lit: ['#ff9a3c', '#ffb25e'], fascia: '#171a18', accent: '#7f723a' } },
  // Bowery levels (bowery.js): a plank shack, a clapboard cottage, a savings bank in dark limestone
  shack: { kinds: [], nc: 1, nr: 1, bayW: 0.23, bayH: 0.14, wall: '#74634b', mortar: '#2a2118', pattern: 'planks',
    win: { kind: 'small', w: 0.05, h: 0.052, dy: 0.05, frame: '#241c14', glass: '#0b0e12', lintel: null, sill: null }, lit: ['#ffb25e'], litP: 0, gnd: null },
  cottage: { kinds: ['door'], nc: 3, nr: 1, bayW: 0.12, bayH: 0.17, wall: '#3b2e28', mortar: '#1a1210', pattern: 'clapboard',
    win: { kind: 'sash', w: 0.05, h: 0.085, dy: 0.045, frame: '#6a6054', glass: '#0b0e12', lintel: '#5a5046', sill: '#5a5046' }, lit: ['#ffb25e', '#ffcb82'], litP: 0.34,
    gnd: { gw: 0.36, gh: 0.19, frame: '#6a6054', glass: '#0c0e10', door: '#4a2a1c', lit: ['#ffc070', '#ffb25e'], fascia: '#2a1f19', accent: '#8a6d3b' } },
  bank: { kinds: ['lobby'], nc: 3, nr: 1, bayW: 0.14, bayH: 0.23, wall: '#4b453e', mortar: '#26221e', pattern: 'stone',
    win: { kind: 'tall', w: 0.07, h: 0.15, dy: 0.04, frame: '#9a7a3c', glass: '#0c1118', lintel: '#6e675b', sill: '#6e675b' }, lit: ['#ffd48a', '#ffc46a', '#ffe0a8'], litP: 0.8,
    gnd: { gw: 0.84, gh: 0.32, frame: '#9a7a3c', glass: '#0c1118', door: '#9a7a3c', lit: ['#ffd48a', '#ffe0a8'], fascia: '#4d412a', accent: '#c9a24f' } },
  dormer: { nc: 1, nr: 1, bayW: 0.07, bayH: 0.07, wall: '#2a3340', mortar: '#2a3340', pattern: 'concrete',
    win: { kind: 'small', w: 0.036, h: 0.045, dy: 0.012, frame: '#6f695b', glass: '#0b0f13', lintel: null, sill: null }, lit: ['#ffb07a'], litP: 1, gnd: null },
};

// the other districts' six levels (london.js … luxe.js): derelict huts, small houses and the grand L4 façades
const hut = (wall, pattern, win = {}) => ({ kinds: [], nc: 1, nr: 1, bayW: 0.23, bayH: 0.14, wall, mortar: '#1f1a14', pattern,
  win: { kind: 'small', w: 0.05, h: 0.052, dy: 0.05, frame: '#241c14', glass: '#0b0e12', lintel: null, sill: null, ...win }, lit: ['#ffb25e'], litP: 0, gnd: null });
const gndOf = (frame, door, fascia, accent, lit, gw, gh) => ({ gw, gh, frame, glass: '#0c0e10', door, lit, fascia, accent });
Object.assign(FACADES, {
  coalshed: hut('#3a342d', 'planks'), kiosk: hut('#4d5446', 'posters'), yatai: hut('#5d6063', 'corrugated'), stand: hut('#6a3a2e', 'planks'),
  tinshed: hut('#74503a', 'corrugated'), news: hut('#34463c', 'planks'), booth: hut('#8d887c', 'panel', { frame: '#6a5230' }),
  machiya: { kinds: ['door'], nc: 3, nr: 2, bayW: 0.125, bayH: 0.16, wall: '#3a2b22', mortar: '#17110d', pattern: 'planks',
    win: { kind: 'grid', w: 0.075, h: 0.085, dy: 0.04, frame: '#6a5a44', glass: '#241f16', lintel: null, sill: '#4a3a2a' }, lit: ['#ffdca0', '#ffcb82', '#ffd89a'], litP: 0.5,
    gnd: gndOf('#6a5a44', '#4a2a1c', '#2a1f19', '#9a4a3a', ['#ffdca0', '#ffcb82'], 0.37, 0.17) },
  fisher: { kinds: ['door'], nc: 2, nr: 1, bayW: 0.185, bayH: 0.2, wall: '#4a554e', mortar: '#222a26', pattern: 'planks',
    win: { kind: 'sash', w: 0.06, h: 0.08, dy: 0.06, frame: '#2a2f2c', glass: '#0b0e12', lintel: null, sill: '#2a2f2c' }, lit: ['#ff9a3c', '#ffb25e'], litP: 0.6,
    gnd: gndOf('#2a2f2c', '#3a2a20', '#1c211e', '#7f723a', ['#ff9a3c', '#ffb25e'], 0.37, 0.2) },
  brickwh: { kinds: ['garage'], nc: 3, nr: 1, bayW: 0.2, bayH: 0.2, wall: '#7a5a28', mortar: '#2f2412', pattern: 'brick',
    win: { kind: 'grid', w: 0.13, h: 0.12, dy: 0.05, frame: '#1d211e', glass: '#0b0f12', lintel: '#7d7466', sill: '#6a6256' }, lit: ['#ff9a3c', '#ffb25e', '#ff8a2a'], litP: 0.6,
    gnd: gndOf('#1a1d1b', '#4a3022', '#171a18', '#7f723a', ['#ff9a3c', '#ffb25e'], 0.3, 0.22) },
  portland: { kinds: ['lobby'], nc: 3, nr: 1, bayW: 0.14, bayH: 0.23, wall: '#8c3a2a', mortar: '#3d2a24', pattern: 'brick',
    win: { kind: 'sash', w: 0.066, h: 0.15, dy: 0.04, frame: '#cfc8b4', glass: '#0c1118', lintel: '#b9b3a0', sill: '#b9b3a0' }, lit: ['#ffd48a', '#ffc46a', '#ffe0a8'], litP: 0.85,
    gnd: gndOf('#9a7a3c', '#2a1f16', '#2c2a24', '#c9a24f', ['#ffd48a', '#ffe0a8'], 0.84, 0.3) },
  opera: { kinds: ['lobby'], nc: 3, nr: 1, bayW: 0.14, bayH: 0.23, wall: '#b49ba1', mortar: '#7d676d', pattern: 'stone',
    win: { kind: 'french', w: 0.07, h: 0.16, dy: 0.03, frame: '#c9a24f', glass: '#0c1118', lintel: '#dcc8cb', sill: '#dcc8cb', balcony: [0] }, lit: ['#ffd48a', '#ffb07a', '#ff9a78'], litP: 0.85,
    gnd: gndOf('#c9a24f', '#4a1820', '#2a1218', '#c9567a', ['#ffd48a', '#ffb07a'], 0.84, 0.3) },
  dept: { kinds: ['lobby'], nc: 4, nr: 1, bayW: 0.21, bayH: 0.2, wall: '#15151b', mortar: '#0e0e13', pattern: 'panel',
    win: { kind: 'plate', w: 0.15, h: 0.11, dy: 0.045, frame: '#b0894a', glass: '#0b0e14', lintel: null, sill: '#b0894a' }, lit: ['#fff0cc', '#ffe3a8', '#ffd48a'], litP: 0.62,
    gnd: gndOf('#b0894a', '#b0894a', '#1d1f24', '#d8b45e', ['#fff0cc', '#ffe3a8'], 0.84, 0.3) },
  palace: { kinds: ['lobby'], nc: 6, nr: 1, bayW: 0.14, bayH: 0.2, wall: '#9d3b29', mortar: '#52261d', pattern: 'stone',
    win: { kind: 'slit', w: 0.05, h: 0.13, dy: 0.03, frame: '#a9b0b7', glass: '#0c1118', lintel: null, sill: null, spandrel: '#3a1a14' }, lit: ['#ffd48a', '#ffc46a', '#ffe0a8'], litP: 0.8,
    gnd: gndOf('#9a7a3c', '#9a7a3c', '#2f1f16', '#c9a24f', ['#ffd48a', '#ffe0a8'], 0.84, 0.3) },
  customs: { kinds: ['lobby'], nc: 3, nr: 1, bayW: 0.14, bayH: 0.23, wall: '#a2802c', mortar: '#4d3d1b', pattern: 'brick',
    win: { kind: 'tall', w: 0.07, h: 0.16, dy: 0.035, frame: '#3f7a68', glass: '#0c1118', lintel: '#c9bd90', sill: '#c9bd90' }, lit: ['#ff9a3c', '#ffb25e', '#ffc46a'], litP: 0.8,
    gnd: gndOf('#7a5a2c', '#2a1f16', '#2a2b2a', '#b0894a', ['#ffb25e', '#ffc46a'], 0.84, 0.3) },
});
FACADES.deco4 = { ...FACADES.deco, wall: '#2c7152', mortar: '#183d2c', gnd: { ...FACADES.deco.gnd, gw: 0.84, gh: 0.3 } };         // the skyscraper: green-black marble
FACADES.marble4 = { ...FACADES.marble, wall: '#2d4a96', mortar: '#18285a', gnd: { ...FACADES.marble.gnd, gw: 0.84, gh: 0.3 } };   // the casino: deep navy marble

// ------------------------------------------------------------------ painting
function paintWall(g, W, H, c, r) {
  g.fillStyle = c.mortar || c.wall; g.fillRect(0, 0, W, H);
  if (c.pattern === 'brick') {
    const bh = 0.016 * K, bw = 0.042 * K;
    for (let row = 0, y = 0; y < H; row++, y += bh) for (let x = (row % 2 ? -bw / 2 : 0); x < W; x += bw) { g.fillStyle = jit(c.wall, r, 14); g.fillRect(x + 1, y + 1, bw - 2, bh - 2); }
  } else if (c.pattern === 'stone') {
    const bh = 0.05 * K;
    for (let row = 0, y = 0; y < H; row++, y += bh) {
      const bw = (row % 2 ? 0.1 : 0.12) * K;
      for (let x = (row % 2 ? -bw * 0.4 : 0); x < W; x += bw) { g.fillStyle = jit(c.wall, r, 9); g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3); }
    }
  } else if (c.pattern === 'clapboard') {               // overlapping horizontal boards, soot-stained
    const bh = 0.021 * K;
    for (let y = 0; y < H; y += bh) {
      g.fillStyle = jit(c.wall, r, 10); g.fillRect(0, y, W, bh);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y + bh - 2, W, 2); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, y, W, 1.5);
    }
  } else if (c.pattern === 'planks') {                   // vertical boards, grey and split, with rust runs from the nails
    for (let x = 0; x < W;) {
      const bw = (0.024 + r() * 0.02) * K;
      g.fillStyle = jit(c.wall, r, 16); g.fillRect(x, 0, bw - 1.5, H);
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + bw - 1.5, 0, 1.5, H);
      if (r() < 0.5) { g.fillStyle = 'rgba(70,40,20,.35)'; g.fillRect(x + bw * 0.4, r() * H * 0.3, 2, H * (0.2 + r() * 0.5)); }
      x += bw;
    }
  } else if (c.pattern === 'corrugated') {              // tin sheeting: vertical ribs, rust bleeding down from the fixings
    g.fillStyle = c.wall; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 9) { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, 0, 2, H); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 4, 0, 3, H); }
    for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(${90 + r() * 40},${40 + r() * 20},20,${0.2 + r() * 0.3})`; g.fillRect(r() * W, r() * H * 0.4, 2 + r() * 4, H * (0.15 + r() * 0.5)); }
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(30,18,10,.55)'; g.beginPath(); g.ellipse(r() * W, r() * H, 6 + r() * 14, 4 + r() * 8, r() * 3, 0, 7); g.fill(); }
  } else if (c.pattern === 'posters') {                 // grey boards plastered with torn bills
    paintWall(g, W, H, { ...c, pattern: 'planks' }, r);
    for (let k = 0; k < 9; k++) { g.fillStyle = ['rgba(200,190,160,.5)', 'rgba(150,70,60,.45)', 'rgba(90,110,120,.4)'][k % 3]; g.fillRect(r() * W * 0.85, r() * H * 0.7, 0.025 * K + r() * 0.04 * K, 0.03 * K + r() * 0.05 * K); }
    return;
  } else if (c.pattern === 'panel') {
    g.fillStyle = c.wall; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 40; k++) {                       // marble veining
      g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(60,60,70,.12)'; g.lineWidth = 1 + r() * 1.4;
      let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y);
      for (let n = 0; n < 4; n++) { x += (r() - 0.3) * 70; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke();
    }
  } else {                                               // concrete: stains and grit
    g.fillStyle = c.wall; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 180; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 1 + r() * 14, 1 + r() * 14); }
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.1})`; g.fillRect(r() * W, r() * H * 0.5, 2 + r() * 3, H * (0.2 + r() * 0.5)); }
  }
  for (let k = 0; k < W * H / 900; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.18})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
}
function boards(g, x, y, w, h, r) {                     // planks nailed across an opening
  g.fillStyle = '#16110d'; g.fillRect(x, y, w, h);
  const n = Math.max(3, Math.round(h / (0.022 * K)));
  for (let k = 0; k < n; k++) {
    g.save(); g.translate(x + w / 2, y + (k + 0.5) * h / n); g.rotate((r() - 0.5) * 0.12);
    g.fillStyle = jit('#4a3a2a', r, 14); g.fillRect(-w / 2 - 3, -h / n * 0.46, w + 6, h / n * 0.92);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-w / 2 - 3, h / n * 0.34 - h / n * 0.46, w + 6, 2); g.restore();
  }
}
function drawWindow(g, c, x, y, w, h, row, boarded, r) {   // x,y = top-left of the glass in px
  const win = c.win;
  if (boarded) { boards(g, x - 2, y - 2, w + 4, h + 4, r); return; }
  const fw = Math.max(2, 0.006 * K);
  if (win.lintel) { g.fillStyle = win.lintel; g.fillRect(x - fw, y - 0.014 * K, w + 2 * fw, 0.014 * K); }
  if (win.sill) { g.fillStyle = win.sill; g.fillRect(x - fw * 1.6, y + h, w + fw * 3.2, 0.012 * K); }
  g.fillStyle = win.frame; g.fillRect(x - fw, y - fw, w + 2 * fw, h + 2 * fw);
  const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, win.glass); gr.addColorStop(0.5, '#1a2128'); gr.addColorStop(1, win.glass);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = win.frame;
  if (win.kind === 'sash' || win.kind === 'french' || win.kind === 'tall') { g.fillRect(x, y + h * 0.48, w, fw * 0.8); if (win.kind !== 'tall') g.fillRect(x + w / 2 - fw / 2, y, fw, h); }
  if (win.kind === 'plate') g.fillRect(x + w / 2 - fw / 2, y, fw, h);
  if (win.kind === 'grid') { for (let q = 1; q < 5; q++) g.fillRect(x + q * w / 5 - fw / 3, y, fw * 0.7, h); for (let q = 1; q < 3; q++) g.fillRect(x, y + q * h / 3 - fw / 3, w, fw * 0.7); }
  if (win.kind === 'french' && (win.balcony || []).includes(row)) {   // wrought-iron balcony rail across the bay
    const by = y + h * 0.72, bx = x - 0.018 * K, bw = w + 0.036 * K;
    g.fillStyle = '#17150f'; g.fillRect(bx, by, bw, 3); g.fillRect(bx, by + h * 0.28, bw, 4);
    for (let q = 0; q <= 9; q++) g.fillRect(bx + q * bw / 9, by, 2, h * 0.28);
  }
  if (win.band) { g.fillStyle = win.band; g.fillRect(x - 0.03 * K, y + h + 0.02 * K, w + 0.06 * K, 0.012 * K); }
}
function layoutBay(c, i, j, W, H) {                       // the window rect of bay (i, j), j counted from the bottom
  const bw = c.bayW * K, bh = c.bayH * K, win = c.win;
  return { x: i * bw + (bw - win.w * K) / 2, y: H - j * bh - (win.dy + win.h) * K, w: win.w * K, h: win.h * K, row: j };
}
// diffuse or emissive facade tile, painted into the region (ox, oy) of an atlas canvas
function paintFacade(g0, ox, oy, id, lit, boarded, litScale = 1) {
  const c = FACADES[id], W = c.nc * c.bayW * K, H = c.nr * c.bayH * K, r = rng(id + (boarded ? 'b' : ''));
  const body = (g, w, h) => {
    if (lit) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const lr = rng(id + 'lit');
      for (let j = 0; j < c.nr; j++) for (let i = 0; i < c.nc; i++) {
        const b = layoutBay(c, i, j, w, h);
        if (lr() > c.litP * litScale) continue;
        const col = c.lit[Math.floor(lr() * c.lit.length)];
        g.fillStyle = col; g.fillRect(b.x, b.y, b.w, b.h);
        if (lr() < 0.4) { g.fillStyle = '#000'; g.fillRect(b.x, b.y, b.w, b.h * (0.25 + lr() * 0.3)); }          // blinds half drawn
      }
      return;
    }
    paintWall(g, w, h, c, r);
    for (let j = 0; j < c.nr; j++) {
      if (c.win.spandrel) { g.fillStyle = c.win.spandrel; g.fillRect(0, h - (j + 1) * c.bayH * K, w, 0.045 * K); }   // deco: a bronze panel between floors
      for (let i = 0; i < c.nc; i++) { const b = layoutBay(c, i, j, w, h); drawWindow(g, c, b.x, b.y, b.w, b.h, b.row, boarded, r); }
    }
    if (c.win.kind === 'slit') {                       // deco: the stone piers stand proud of the glass
      g.fillStyle = 'rgba(255,255,255,.06)';
      for (let i = 0; i < c.nc; i++) g.fillRect(i * c.bayW * K, 0, 0.005 * K, h);
    }
  };
  g0.save(); g0.translate(ox, oy); g0.beginPath(); g0.rect(0, 0, W, H); g0.clip(); body(g0, W, H); g0.restore();
}

// ground-floor strip: one tile = one unit of gnd.gw × gnd.gh, painted into the region (ox, oy) of the atlas
function paintGround(g0, ox, oy, id, kind, lit, boarded, litScale = 1) {
  const c = FACADES[id], G = c.gnd, W = G.gw * K, H = G.gh * K, r = rng(id + kind + (boarded ? 'b' : '') + (lit ? 'l' : ''));
  const body = (g, w, h) => {
    const X = f => f * w, Y = f => h - f * h;          // fractions: x from the left, y from the bottom
    const lr = rng(id + kind + 'lit');
    const glass = (x0, y0, x1, y1, lights = true) => {
      const px = X(x0), py = Y(y1), pw = X(x1 - x0), ph = (y1 - y0) * h;
      if (lit) {
        if (!lights || lr() > 0.35 + 0.65 * litScale) return;
        g.fillStyle = G.lit[Math.floor(lr() * G.lit.length)]; g.fillRect(px, py, pw, ph);
        g.fillStyle = 'rgba(0,0,0,.3)'; for (let s = 1; s < 3; s++) g.fillRect(px, py + ph * s / 3, pw, 3);       // shelves / tables in the light
        return;
      }
      g.fillStyle = G.frame; g.fillRect(px - 4, py - 4, pw + 8, ph + 8);
      const gr = g.createLinearGradient(px, py, px + pw, py + ph); gr.addColorStop(0, G.glass); gr.addColorStop(0.5, '#1b2229'); gr.addColorStop(1, G.glass);
      g.fillStyle = gr; g.fillRect(px, py, pw, ph);
    };
    const door = (x0, x1, y1, fan = false) => {
      const px = X(x0), py = Y(y1), pw = X(x1 - x0), ph = y1 * h;
      if (lit) { if (fan) { g.fillStyle = G.lit[0]; g.fillRect(px + 3, py + 3, pw - 6, ph * 0.22); } return; }
      g.fillStyle = G.frame; g.fillRect(px - 4, py - 4, pw + 8, ph + 4);
      g.fillStyle = jit(G.door, r, 8); g.fillRect(px, py, pw, ph);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px + pw * 0.15, py + ph * 0.28, pw * 0.7, ph * 0.28); g.fillRect(px + pw * 0.15, py + ph * 0.62, pw * 0.7, ph * 0.3);
      if (fan) { g.fillStyle = '#10151a'; g.fillRect(px + 3, py + 3, pw - 6, ph * 0.2); }
      g.fillStyle = '#c9a24f'; g.fillRect(px + pw * 0.8, py + ph * 0.55, 4, 4);
    };
    if (lit) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
    else {
      paintWall(g, w, h, { ...c, nc: 1, nr: 1 }, r);
      g.fillStyle = G.fascia; g.fillRect(0, 0, w, h * 0.2);                         // the board over the shop
      g.fillStyle = G.accent; g.fillRect(0, h * 0.2 - 3, w, 3);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, h - 5, w, 5);                  // plinth
    }
    const bd = boarded;
    if (kind === 'door') { door(0.08, 0.34, 0.78, true); if (bd && !lit) boards(g, X(0.62), Y(0.62), X(0.28), 0.4 * h, r); else glass(0.58, 0.28, 0.9, 0.7); }
    else if (kind === 'shop') { if (bd && !lit) { boards(g, X(0.08), Y(0.66), X(0.6), 0.52 * h, r); boards(g, X(0.74), Y(0.74), X(0.18), 0.74 * h, r); } else { glass(0.08, 0.14, 0.66, 0.68); door(0.74, 0.92, 0.74); if (lit) { g.fillStyle = G.lit[0]; g.fillRect(X(0.76), Y(0.5), X(0.14), 0.18 * h); } } }
    else if (kind === 'pawn') {
      if (bd && !lit) { boards(g, X(0.06), Y(0.68), X(0.88), 0.58 * h, r); }
      else {
        for (const [a, b] of [[0.08, 0.42], [0.58, 0.92]]) {
          glass(a, 0.26, b, 0.64);
          const px = X(a), py = Y(0.64), pw = X(b - a), ph = 0.38 * h;
          if (!lit) { g.fillStyle = '#0a0908'; for (let q = 0; q <= 6; q++) g.fillRect(px + q * pw / 6 - 1.5, py, 3, ph); }
          else { g.fillStyle = '#ffe3a8'; for (let q = 0; q < 6; q++) g.fillRect(px + 8 + lr() * (pw - 24), py + 8 + lr() * (ph - 24), 6, 6); }     // glints of hocked brass
        }
        door(0.44, 0.56, 0.7);
      }
    }
    else if (kind === 'cafe') { if (bd && !lit) boards(g, X(0.06), Y(0.78), X(0.88), 0.66 * h, r); else { glass(0.06, 0.1, 0.46, 0.78); glass(0.54, 0.1, 0.94, 0.78); door(0.46, 0.54, 0.74); } }
    else if (kind === 'lobby') {
      if (bd && !lit) { boards(g, X(0.2), Y(0.8), X(0.6), 0.8 * h, r); }
      else {
        glass(0.3, 0.02, 0.7, 0.82); glass(0.07, 0.3, 0.2, 0.66); glass(0.8, 0.3, 0.93, 0.66);
        if (!lit) { g.fillStyle = G.frame; for (const x of [0.4, 0.5, 0.6]) g.fillRect(X(x) - 2, Y(0.82), 4, 0.8 * h); g.fillRect(X(0.3), Y(0.82), X(0.4), 6); }
      }
    }
    else if (kind === 'garage') {                                                   // a roller door and a small side door
      if (bd && !lit) boards(g, X(0.1), Y(0.8), X(0.55), 0.78 * h, r);
      else if (lit) { g.fillStyle = G.lit[0]; g.fillRect(X(0.8), Y(0.7), X(0.1), 0.2 * h); }
      else {
        g.fillStyle = '#2c2a26'; g.fillRect(X(0.1), Y(0.8), X(0.55), 0.78 * h);
        g.fillStyle = '#3d3a34'; for (let q = 0; q < 14; q++) g.fillRect(X(0.1), Y(0.8) + q * 0.78 * h / 14, X(0.55), 2);
        door(0.78, 0.9, 0.7);
      }
    }
    else if (kind === 'arcade') {                                                   // a shuttered shopfront with a bright slot of light
      if (bd && !lit) boards(g, X(0.06), Y(0.7), X(0.88), 0.6 * h, r);
      else if (lit) { g.fillStyle = G.lit[0]; g.fillRect(X(0.12), Y(0.62), X(0.76), 0.16 * h); g.fillStyle = G.lit[1]; g.fillRect(X(0.12), Y(0.4), X(0.76), 0.06 * h); }
      else {
        g.fillStyle = '#1b1c20'; g.fillRect(X(0.1), Y(0.7), X(0.8), 0.62 * h);
        g.fillStyle = '#2a2c31'; for (let q = 0; q < 12; q++) g.fillRect(X(0.1), Y(0.7) + q * 0.62 * h / 12, X(0.8), 2);
        g.fillStyle = '#0a0b0e'; g.fillRect(X(0.12), Y(0.62), X(0.76), 0.18 * h);
      }
    }
  };
  g0.save(); g0.translate(ox, oy); g0.beginPath(); g0.rect(0, 0, W, H); g0.clip(); body(g0, W, H); g0.restore();
}

// one atlas per style: the facade tile on top, a strip for each ground-floor kind below it (so a building is one material)
const GAP = 6;
const atlasLayout = id => {
  const c = FACADES[id], th = c.nr * c.bayH * K, rects = { facade: { x: 0, y: 0, w: c.nc * c.bayW * K, h: th } };
  let y = th + GAP, W = rects.facade.w;
  for (const kind of c.kinds || []) { rects[kind] = { x: 0, y, w: c.gnd.gw * K, h: c.gnd.gh * K }; y += c.gnd.gh * K + GAP; W = Math.max(W, c.gnd.gw * K); }
  return { rects, W: Math.ceil(W), H: Math.ceil(y) };
};
const layouts = {};
const layoutOf = id => (layouts[id] ||= atlasLayout(id));
function atlasTexture(id, lit, boarded, litScale) {
  const { rects, W, H } = layoutOf(id), c = FACADES[id];
  const t = canvasTexture(W, H, g => {
    g.fillStyle = lit ? '#000' : '#14110f'; g.fillRect(0, 0, W, H);
    paintFacade(g, 0, 0, id, lit, boarded, litScale);
    for (const kind of c.kinds || []) paintGround(g, rects[kind].x, rects[kind].y, id, kind, lit, boarded, litScale);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
// uv extents of a sub-rectangle of the atlas: bays c0…c1 across and rows r0…r1 (from the bottom) of the facade tile, or a whole strip
function uvOf(id, region, c0 = 0, c1 = null, r0 = 0, r1 = null) {
  const { rects, W, H } = layoutOf(id), c = FACADES[id], R = rects[region], e = 0.6;
  let x = R.x, y = R.y, w = R.w, h = R.h;
  if (region === 'facade') {
    const bw = c.bayW * K, bh = c.bayH * K; c1 ??= c.nc; r1 ??= c.nr;
    x = R.x + c0 * bw; w = (c1 - c0) * bw; y = R.y + R.h - r1 * bh; h = (r1 - r0) * bh;
  }
  return [(x + e) / W, 1 - (y + h - e) / H, (x + w - e) / W, 1 - (y + e) / H];   // u0, v0, u1, v1
}

// ------------------------------------------------------------------ materials
const dimColor = d => new THREE.Color(d, d, d);
function styleMat(id, glow, o) {                        // the style's atlas: facade, windows and every ground-floor kind in one material
  const dim = o.dim || 1, b = o.boarded ? 'b' : '', ls = o.lit ?? 1;
  return procMaterial(`a|${id}|${b}|${dim}|${ls}`, o.boarded ? null : glow, lit => {
    const m = new THREE.MeshStandardMaterial({ map: atlasTexture(id, false, o.boarded, ls), roughness: 0.88 });
    if (lit) { m.emissive = new THREE.Color('#ffc088'); m.emissiveMap = atlasTexture(id, true, false, ls); m.emissiveIntensity = 0; }
    m.color = dimColor(dim);
    return m;
  });
}
const SOLIDS = {                                          // roofs and trim: small noisy tiles
  slate: ['#26272c', 0.9, 0], tar: ['#1f1f21', 0.95, 0], zinc: ['#2d3945', 0.55, 0.3], tile: ['#4a2a22', 0.9, 0], stone: ['#7a7466', 0.85, 0],
  brass: ['#9a7a3c', 0.4, 0.7], gold: ['#c9a24f', 0.35, 0.8], chrome: ['#8e949a', 0.25, 0.9], iron: ['#1a1a1b', 0.5, 0.5], limestone: ['#8f8872', 0.85, 0],
  marble: ['#b2ada2', 0.5, 0], brick: ['#4a2a22', 0.9, 0], steel: ['#34383c', 0.6, 0.5], wood: ['#2c2118', 0.9, 0], rust: ['#4a3022', 0.8, 0.3],
  portland: ['#a8a28f', 0.8, 0], wine: ['#4a1620', 0.7, 0.1], green: ['#1f3a2e', 0.8, 0], navy: ['#17202e', 0.7, 0.1], black: ['#101012', 0.6, 0.2], polished: ['#2c2e34', 0.25, 0.2],
  tinold: ['#3f4144', 0.7, 0.35], rose: ['#7a3a50', 0.7, 0.1], sooty: ['#262422', 0.9, 0], terracotta: ['#6a3a2a', 0.85, 0], ochre: ['#6a5a38', 0.8, 0], leaf: ['#2a4a2a', 0.9, 0], cloth: ['#5a1c1c', 0.95, 0],
  pot: ['#7a3d24', 0.85, 0], sootstone: ['#4b453e', 0.9, 0], sootmarble: ['#5d564d', 0.55, 0], rosemarble: ['#c2a8ad', 0.5, 0], greenmarble: ['#2e6b4c', 0.45, 0.05], whitemarble: ['#cdd0d8', 0.4, 0], copper: ['#3f6b5f', 0.55, 0.35], dark: ['#0e0c0a', 0.9, 0], plank: ['#4a3a2a', 0.9, 0], tin: ['#5b5f62', 0.55, 0.5], concrete: ['#4a4b4d', 0.95, 0], red: ['#5a1f1c', 0.7, 0.1], cream: ['#7c735e', 0.8, 0],
};
export function solid(name, dim = 1) {                  // plain colours: they bake into the shared vertex-colour mesh (one draw call for all trim and roofs)
  const [col, rough, metal] = SOLIDS[name] || SOLIDS.tar;
  return procMaterial(`s|${name}|${dim}`, null, () => {
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal });
    m.color.multiplyScalar(dim);
    return m;
  });
}
function glassStripMat(glow, dim) {                       // the vertical glazing of a saw-tooth roof or a shopfront window band
  return procMaterial(`glaze|${dim}`, glow, lit => {
    const m = new THREE.MeshStandardMaterial({ map: canvasTexture(128, 64, (g, w, h) => { g.fillStyle = '#14191d'; g.fillRect(0, 0, w, h); g.fillStyle = '#0b0e11'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); g.fillRect(0, h / 2, w, 2); }), roughness: 0.4 });
    if (lit) { m.emissive = new THREE.Color('#ffc088'); m.emissiveMap = canvasTexture(128, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#d98a3a'; for (let x = 0; x < w; x += 16) if (((x / 16) * 7 + 3) % 5 !== 0) { g.fillRect(x + 2, 4, 13, h / 2 - 6); g.fillRect(x + 2, h / 2 + 4, 13, h / 2 - 8); } }); m.emissiveIntensity = 0; }
    m.color = dimColor(dim);
    return m;
  });
}

// ------------------------------------------------------------------ geometry helpers
function plane(w, h, ur, vr, x, y, z, ry = 0, rx = 0) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ur, uv.getY(i) * vr);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}
function boxGeo(w, h, d, x, y, z, ur = 1, vr = 1) {       // y = the bottom
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ur, uv.getY(i) * vr);
  g.translate(x, y + h / 2, z);
  return g;
}
// a soup of triangles with flat normals; each quad/tri is wound to face the given hint direction
const V = (x, y, z) => new THREE.Vector3(x, y, z);
class Soup {
  constructor() { this.p = []; this.uv = []; }
  tri(a, b, c, hint, su, sv) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(hint) < 0) [b, c] = [c, b];
    n.normalize();
    const ax = Math.abs(n.x), az = Math.abs(n.z);
    for (const v of [a, b, c]) {
      this.p.push(v.x, v.y, v.z);
      if (Math.abs(n.y) > 0.8) this.uv.push(v.x * su, v.z * sv);
      else if (ax > az) this.uv.push(v.z * su, v.y * sv);
      else this.uv.push(v.x * su, v.y * sv);
    }
  }
  quad(a, b, c, d, hint, su = 1, sv = 1) { this.tri(a, b, c, hint, su, sv); this.tri(a, c, d, hint, su, sv); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }
}
const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

// a wall of nb bays × nFl floors made of tile-sized quads cut from the atlas, standing at (px, py, pz) and facing ry (π: −z, 0: +z, ±π/2: sides)
function wallQuads(g, mat, id, wallW, upH, nb, nFl, px, py, pz, ry) {
  const c = FACADES[id], bw = wallW / nb, fh = upH / nFl;
  for (let r = 0; r < nFl;) {
    const full = c.nr > 1 && r % c.nr === 0 && r + c.nr <= nFl, rows = full ? c.nr : 1, j = r % c.nr;
    for (let b = 0; b < nb; b += c.nc) {
      const cols = Math.min(c.nc, nb - b), [u0, v0, u1, v1] = uvOf(id, 'facade', 0, cols, full ? 0 : j, full ? c.nr : j + 1);
      const geo = new THREE.PlaneGeometry(cols * bw, rows * fh), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      geo.translate(-wallW / 2 + (b + cols / 2) * bw, r * fh + rows * fh / 2, 0);
      if (ry) geo.rotateY(ry);
      geo.translate(px, py, pz);
      g.add(mesh(geo, mat));
    }
    r += rows;
  }
}
// the ground-floor strip: one unit quad per gnd.gw of width
function groundQuads(g, mat, id, kind, wallW, gh, px, py, pz, ry, units) {
  const n = units || Math.max(1, Math.round(wallW / FACADES[id].gnd.gw)), [u0, v0, u1, v1] = uvOf(id, kind);
  for (let k = 0; k < n; k++) {
    const geo = new THREE.PlaneGeometry(wallW / n, gh), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    geo.translate(-wallW / 2 + (k + 0.5) * wallW / n, gh / 2, 0);
    if (ry) geo.rotateY(ry);
    geo.translate(px, py, pz);
    g.add(mesh(geo, mat));
  }
}

// ------------------------------------------------------------------ the building
// o: x (centre), y (floor), z (front), w, d, h (total wall height), ground (shop|door|pawn|cafe|lobby|arcade|null), gh,
//    roof (flat|gable|mansard|saw|none), rh, boarded, dim, cornice, stacks [x…] (chimneys), stoop, sides:false
export function building(style, o, glow) {
  const c = FACADES[style];
  if (!c) throw new Error('no facade style ' + style);
  const { x = 0, y = 0, z = 0.01, w = 0.44, d = 0.8, h = 0.8, roof = 'flat', boarded = false, dim = 1 } = o;
  const G = c.gnd, gh = o.ground ? (o.gh || G.gh) : 0, up = Math.max(0.1, h - gh), g = new THREE.Group();
  const fm = styleMat(style, glow, { boarded, dim, lit: o.lit });
  const nbU = Math.max(1, Math.round(w / c.bayW)), nbD = Math.max(1, Math.round(d / c.bayW)), nFl = Math.max(1, Math.round(up / c.bayH)), yu = y + gh;
  wallQuads(g, fm, style, w, up, nbU, nFl, x, yu, z, Math.PI);                                // the street front
  if (o.sides !== false) { wallQuads(g, fm, style, d, up, nbD, nFl, x - w / 2, yu, z + d / 2, -Math.PI / 2); wallQuads(g, fm, style, d, up, nbD, nFl, x + w / 2, yu, z + d / 2, Math.PI / 2); }
  wallQuads(g, fm, style, w, up, nbU, nFl, x, yu, z + d, 0);
  if (o.ground) {
    groundQuads(g, fm, style, o.ground, w, gh, x, y, z, Math.PI, o.gn);
    if (o.sides !== false) for (const s of [-1, 1]) wallQuads(g, fm, style, d, gh, nbD, 1, x + s * w / 2, y, z + d / 2, s * Math.PI / 2);
    groundQuads(g, fm, style, o.ground, w, gh, x, y, z + d, 0, o.gn);
  }
  const top = y + h;
  // roofs
  const rm = name => solid(name, dim);
  if (roof === 'flat') {
    g.add(mesh(plane(w, d, w * 6, d * 6, x, top + 0.002, z + d / 2, 0, -Math.PI / 2), rm(o.roofMat || 'tar')));
    if (o.parapet !== false) {
      for (const [bw, bd, bx, bz] of [[w, 0.018, x, z + 0.009], [w, 0.018, x, z + d - 0.009], [0.018, d, x - w / 2 + 0.009, z + d / 2], [0.018, d, x + w / 2 - 0.009, z + d / 2]])
        g.add(mesh(boxGeo(bw, o.parapetH || 0.03, bd, bx, top, bz, bw * 8, 0.3), rm(o.parapetMat || 'stone')));
    }
  } else if (roof === 'gable') {                                                          // ridge along x
    const rh = o.rh || 0.14, s = new Soup(), xl = x - w / 2, xr = x + w / 2, zf = z - 0.012, zb = z + d + 0.012, zm = z + d / 2;
    s.quad(V(xl, top, zf), V(xr, top, zf), V(xr, top + rh, zm), V(xl, top + rh, zm), V(0, 1, -1), 7, 7);
    s.quad(V(xl, top, zb), V(xr, top, zb), V(xr, top + rh, zm), V(xl, top + rh, zm), V(0, 1, 1), 7, 7);
    g.add(mesh(s.geo(), rm(o.roofMat || 'slate')));
    const e = new Soup();
    e.tri(V(xl, top, z), V(xl, top, z + d), V(xl, top + rh, zm), V(-1, 0, 0), 3, 3); e.tri(V(xr, top, z), V(xr, top, z + d), V(xr, top + rh, zm), V(1, 0, 0), 3, 3);
    g.add(mesh(e.geo(), rm('brick')));
  } else if (roof === 'mansard') {                                                        // a steep zinc roof with lit dormers
    const rh = o.rh || 0.15, ins = Math.min(0.07, w * 0.16), s = new Soup(), xl = x - w / 2, xr = x + w / 2, zb = z + d;
    const a = [V(xl, top, z), V(xr, top, z), V(xr, top, zb), V(xl, top, zb)], b = [V(xl + ins, top + rh, z + ins), V(xr - ins, top + rh, z + ins), V(xr - ins, top + rh, zb - ins), V(xl + ins, top + rh, zb - ins)];
    s.quad(a[0], a[1], b[1], b[0], V(0, 0.6, -1), 6, 6); s.quad(a[1], a[2], b[2], b[1], V(1, 0.6, 0), 6, 6); s.quad(a[2], a[3], b[3], b[2], V(0, 0.6, 1), 6, 6); s.quad(a[3], a[0], b[0], b[3], V(-1, 0.6, 0), 6, 6);
    s.quad(b[0], b[1], b[2], b[3], V(0, 1, 0), 6, 6);
    g.add(mesh(s.geo(), rm('zinc')));
    if (o.dormers !== false) {
      const nd = Math.max(1, Math.round(w / 0.22)), dm = styleMat('dormer', glow, { dim, lit: o.lit });
      for (let k = 0; k < nd; k++) {
        const dx = xl + (k + 0.5) * w / nd, dz = z + ins * 0.5 + 0.012;
        { const [u0, v0, u1, v1] = uvOf('dormer', 'facade'), q = new THREE.PlaneGeometry(0.07, 0.07), uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); q.rotateY(Math.PI); q.translate(dx, top + rh * 0.42, dz - 0.006); g.add(mesh(q, dm)); }
        g.add(mesh(boxGeo(0.08, 0.012, 0.03, dx, top + rh * 0.42 + 0.07, dz + 0.004, 1, 1), rm('zinc')));
        g.add(mesh(boxGeo(0.008, 0.07, 0.04, dx - 0.04, top + rh * 0.42, dz + 0.01), rm('zinc'))); g.add(mesh(boxGeo(0.008, 0.07, 0.04, dx + 0.04, top + rh * 0.42, dz + 0.01), rm('zinc')));
      }
    }
  } else if (roof === 'saw') {                                                            // saw-tooth: glazed face towards the street
    const n = o.teeth || 3, rh = o.rh || 0.13, td = d / n, rs = new Soup(), es = new Soup(), xl = x - w / 2, xr = x + w / 2, gm = glassStripMat(glow, dim);
    for (let k = 0; k < n; k++) {
      const za = z + k * td, zb = z + (k + 1) * td;
      g.add(mesh(plane(w, rh, w * 6, 1, x, top + rh / 2, za, Math.PI), gm));
      rs.quad(V(xl, top + rh, za), V(xr, top + rh, za), V(xr, top, zb), V(xl, top, zb), V(0, 1, 1), 7, 7);
      es.tri(V(xl, top, za), V(xl, top + rh, za), V(xl, top, zb), V(-1, 0, 0), 3, 3); es.tri(V(xr, top, za), V(xr, top + rh, za), V(xr, top, zb), V(1, 0, 0), 3, 3);
    }
    g.add(mesh(rs.geo(), rm(o.roofMat || 'tar'))); g.add(mesh(es.geo(), rm('concrete')));
  }
  if (o.cornice) g.add(mesh(boxGeo(w + 0.03, 0.022, 0.045, x, top - 0.012, z - 0.016), rm(o.corniceMat || 'stone')));
  if (o.stacks) for (const sx of o.stacks) {                                              // chimney stacks with pots on the party walls
    g.add(mesh(boxGeo(0.045, 0.1, 0.06, sx, top + (o.rh || 0.14) * 0.55, z + d / 2, 3, 3), rm('brick')));
    for (const px of [-0.012, 0.012]) g.add(mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.035, 6).translate(sx + px, top + (o.rh || 0.14) * 0.55 + 0.115, z + d / 2), rm('pot')));
  }
  if (o.stoop) {                                                                          // front steps, one per house unit
    const gw = G.gw, n = Math.max(1, Math.round(w / gw));
    for (let k = 0; k < n; k++) {
      const sx = x - w / 2 + k * (w / n) + 0.065;
      g.add(mesh(boxGeo(0.085, 0.022, 0.05, sx, y, z - 0.025, 2, 1), rm('limestone'))); g.add(mesh(boxGeo(0.085, 0.022, 0.03, sx, y + 0.022, z - 0.015, 2, 1), rm('limestone')));
    }
  }
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: top, zf: z };
  return g;
}

// ------------------------------------------------------------------ other code-built pieces
export function spire(o) {                                // an art-deco crown: a stepped brass spire
  const g = new THREE.Group(), { x = 0, y = 0, z = 0.4, w = 0.14, h = 0.5 } = o;
  const brass = solid('brass'), lime = solid('limestone');
  g.add(mesh(boxGeo(w, h * 0.12, w, x, y, z, 2, 1), lime));
  g.add(mesh(boxGeo(w * 0.7, h * 0.12, w * 0.7, x, y + h * 0.12, z, 2, 1), lime));
  g.add(mesh(new THREE.ConeGeometry(w * 0.3, h * 0.55, 4).rotateY(Math.PI / 4).translate(x, y + h * 0.24 + h * 0.275, z), brass));
  g.add(mesh(new THREE.CylinderGeometry(0.003, 0.006, h * 0.28, 5).translate(x, y + h * 0.78 + h * 0.14, z), brass));
  g.userData.roof = null;
  return g;
}
export function canopy(o) {                               // an entrance canopy on two slim posts
  const g = new THREE.Group(), { x = 0, y = 0, z = 0.01, w = 0.3, d = 0.12, mat = 'brass' } = o, m = solid(mat);
  g.add(mesh(boxGeo(w, 0.014, d, x, y + 0.2, z - d / 2, 3, 1), m));
  g.add(mesh(boxGeo(w + 0.01, 0.022, 0.01, x, y + 0.19, z - d, 4, 1), solid('gold')));
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6).translate(x + s * (w / 2 - 0.012), y + 0.1, z - d + 0.008), solid('iron')));
  return g;
}
export function pawnballs(o) {                            // the three brass balls on a bracket
  const g = new THREE.Group(), { x = 0, y = 0.3, z = 0.0 } = o, gold = solid('gold');
  g.add(mesh(boxGeo(0.012, 0.012, 0.09, x, y, z - 0.045), solid('iron')));
  for (const [dx, dy] of [[-0.022, 0], [0.022, 0], [0, 0.04]]) g.add(mesh(new THREE.SphereGeometry(0.02, 8, 6).translate(x + dx, y + 0.02 + dy, z - 0.095), gold));
  return g;
}
export function diner(o) {                                // a chrome diner: a low silver box, a stainless band, big glass, a flat roof sign board
  const g = new THREE.Group(), { x = 0, z = 0.01, w = 0.3, d = 0.5, h = 0.26 } = o, glow = o.glowKey;
  const fm = procMaterial('diner', glow, lit => {
    const mk = emissive => canvasTexture(256, 128, (c, W, H) => {
      c.fillStyle = emissive ? '#000' : '#1c1d20'; c.fillRect(0, 0, W, H);
      if (!emissive) { c.fillStyle = '#9aa0a6'; c.fillRect(0, H * 0.04, W, H * 0.1); c.fillStyle = '#7a1c1c'; c.fillRect(0, H * 0.16, W, H * 0.07); c.fillStyle = '#c9ced2'; c.fillRect(0, H * 0.93, W, H * 0.05); }
      const x0 = W * 0.04, bw = W * 0.19;
      for (let i = 0; i < 4; i++) { if (emissive) { c.fillStyle = i === 2 ? '#ffe3a8' : '#ffd089'; c.fillRect(x0 + i * (bw + W * 0.03), H * 0.3, bw, H * 0.55); } else { c.fillStyle = '#0c0e10'; c.fillRect(x0 + i * (bw + W * 0.03) - 3, H * 0.3 - 3, bw + 6, H * 0.55 + 6); c.fillStyle = '#1b2229'; c.fillRect(x0 + i * (bw + W * 0.03), H * 0.3, bw, H * 0.55); } }
    });
    const m = new THREE.MeshStandardMaterial({ map: mk(false), roughness: 0.35, metalness: 0.5 });
    if (lit) { m.emissive = new THREE.Color('#fff'); m.emissiveMap = mk(true); m.emissiveIntensity = 0; }
    return m;
  });
  g.add(mesh(plane(w, h, 1, 1, x, h / 2, z, Math.PI), fm));
  g.add(mesh(plane(d, h, 1, 1, x - w / 2, h / 2, z + d / 2, -Math.PI / 2), fm)); g.add(mesh(plane(d, h, 1, 1, x + w / 2, h / 2, z + d / 2, Math.PI / 2), fm));
  g.add(mesh(plane(w, h, 1, 1, x, h / 2, z + d, 0), fm));
  g.add(mesh(boxGeo(w + 0.03, 0.02, d + 0.03, x, h, z + d / 2 - 0.0, w * 6, 1), solid('chrome')));
  g.add(mesh(boxGeo(w * 0.96, 0.012, 0.012, x, 0.04, z - 0.008), solid('chrome')));
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: h + 0.02, zf: z };
  return g;
}
export function crane(o) {                                // a dockside gantry crane: legs, a lattice boom reaching out over the water
  const g = new THREE.Group(), { x = 0, z = 1.0, h = 0.9, w = 0.34, boom = 0.5 } = o, m = solid('rust'), dk = solid('steel');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(boxGeo(0.018, h, 0.018, x + sx * w / 2, 0, z + sz * 0.1), m));
  for (let k = 1; k <= 3; k++) { const yy = h * k / 4; g.add(mesh(boxGeo(w, 0.012, 0.012, x, yy, z - 0.1), dk)); g.add(mesh(boxGeo(w, 0.012, 0.012, x, yy, z + 0.1), dk)); }
  g.add(mesh(boxGeo(w + 0.08, 0.05, 0.26, x, h, z, 2, 1), dk));                       // the cabin deck
  g.add(mesh(boxGeo(0.07, 0.07, 0.09, x - w / 2 + 0.05, h + 0.05, z, 1, 1), m));      // the driver's cab
  g.add(mesh(boxGeo(0.02, 0.026, boom, x, h + 0.02, z - boom / 2 + 0.1), m));         // the boom, pointing towards the street side (−z)
  g.add(mesh(boxGeo(0.01, 0.01, boom * 0.9, x - 0.012, h + 0.05, z - boom / 2 + 0.08), dk));
  g.add(mesh(boxGeo(0.004, 0.2, 0.004, x, h - 0.18, z - boom + 0.12), dk));            // the hoist cable and its hook block
  g.add(mesh(boxGeo(0.03, 0.02, 0.03, x, h - 0.2, z - boom + 0.12), m));
  g.userData.roof = null;
  return g;
}
const CTN = ['#7a3a2c', '#2f6a58', '#3a5088', '#8a7430', '#5a5c60'];
export function containers(o) {                           // a stack of corrugated shipping containers (x, z centre; rows × high)
  const g = new THREE.Group(), { x = 0, z = 0.5, n = 2, high = 2, ry = 0, dim = 1 } = o;
  const m = procMaterial(`ctn|${dim}`, null, () => {      // one atlas: a corrugated band per colour
    const mm = new THREE.MeshStandardMaterial({ map: canvasTexture(128, 64 * CTN.length, (c, W, H) => {
      CTN.forEach((col, k) => { const y = k * 64; c.fillStyle = col; c.fillRect(0, y, W, 64); c.fillStyle = 'rgba(0,0,0,.35)'; for (let q = 0; q < W; q += 8) c.fillRect(q, y, 3, 64); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, y, W, 3); });
    }), roughness: 0.7, metalness: 0.3 });
    mm.color = dimColor(dim); return mm;
  });
  for (let k = 0; k < n; k++) for (let j = 0; j < high; j++) {
    const ci = (k * 2 + j * 3 + (o.seed || 0)) % CTN.length;
    const bx = new THREE.BoxGeometry(0.1, 0.09, 0.22), uv = bx.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, (ci + uv.getY(i) * 0.9 + 0.05) / CTN.length);
    bx.rotateY(ry + (j % 2 ? 0.05 : 0)); bx.translate(x + (k - (n - 1) / 2) * 0.105, 0.045 + j * 0.091, z);
    g.add(mesh(bx, m));
  }
  return g;
}
export function fenceRun(o) {                             // a chain-link or board fence run along the pavement (x from..to)
  const g = new THREE.Group(), { x0 = -0.44, x1 = 0.44, z = 0.05, h = 0.14, mat = 'wood', dim = 1 } = o, m = solid(mat, dim);
  g.add(mesh(boxGeo(x1 - x0, 0.012, 0.012, (x0 + x1) / 2, h * 0.85, z), m)); g.add(mesh(boxGeo(x1 - x0, 0.012, 0.012, (x0 + x1) / 2, h * 0.3, z), m));
  const n = Math.round((x1 - x0) / 0.07);
  for (let k = 0; k <= n; k++) { const px = x0 + (x1 - x0) * k / n; g.add(mesh(boxGeo(0.014, h * (0.8 + ((k * 7) % 5) * 0.06), 0.01, px, 0, z, 1, 1), m)); }
  return g;
}
export function rubble(o) {                               // broken brick and plaster heaped on an empty plot
  const g = new THREE.Group(), { x = 0, z = 0.5, s = 1, seed = 1 } = o, r = rng('rubble' + seed), m = solid('brick', 0.7), c = solid('concrete', 0.8);
  for (let k = 0; k < 9; k++) {
    const b = boxGeo(0.03 + r() * 0.05, 0.02 + r() * 0.04, 0.03 + r() * 0.05, 0, 0, 0).rotateY(r() * 3);
    b.translate(x + (r() - 0.5) * 0.3 * s, 0, z + (r() - 0.5) * 0.24 * s);
    g.add(mesh(b, r() < 0.6 ? m : c));
  }
  return g;
}
export const ARCH = { bld: building, spire, canopy, pawnballs, diner, crane, containers, fence: fenceRun, rubble };
// helpers for the single-building levels (bowery.js)
export { boxGeo, mesh, plane, V, Soup, canvasTexture, rng, jit, glassStripMat, styleMat, wallQuads, groundQuads, uvOf };
