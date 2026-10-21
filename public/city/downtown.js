// Downtown's six levels (size classes as in bowery.js: brick shop fronts, chrome, bulbs, brass):
//   0  a shuttered hot-dog stand with a collapsed umbrella and a faded board
//   1  a small corner store under a striped awning with crates of produce
//   2  a 2–3 storey block over a chrome DINER that fills the street level
//   3  a big department store / cinema: stone pilasters, a bulb marquee (districts.js adds the lit boards), a rooftop tank
//   4  a grand art-deco movie palace: glazed terracotta, brass fins, a pylon with a stepped crown, a big lit marquee
import * as THREE from 'three';
import { building, ARCH } from './archetypes.js';
import { adder, boxGeo, cyl, tilted, sphere, cone, torus, Glow, lamps, lightUp, columns, steps, railing, course, awning, board, wedge, rooftop, spireTop } from './lvlkit.js';

// ------------------------------------------------------------------ L0
export function stand(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group(), add = adder(h);
  const w = 0.2, d = 0.2, wh = 0.15;
  h.add(building('stand', { x: 0, z: 0, w, d, h: wh, roof: 'none', boarded: true, dim: 1, sides: true }, null));
  add(boxGeo(w + 0.04, 0.012, d + 0.05, 0, wh, d / 2 - 0.0), 'tinold');
  add(boxGeo(0.15, 0.065, 0.008, 0, 0.045, -0.01), 'steel');                                           // the service hatch, shuttered
  for (let k = 0; k < 7; k++) add(boxGeo(0.15, 0.002, 0.01, 0, 0.05 + k * 0.009, -0.012), 'black');
  board(h, { text: 'HOT\nDOGS', x: 0, y: wh + 0.02, z: -0.026, w: 0.17, h: 0.09, bg: '#4a1c18', fg: '#a89878', rim: '#6a5a40' });   // a faded board on the front
  add(tilted(new THREE.ConeGeometry(0.11, 0.05, 8).translate(0, 0.025, 0), 1.2, 0, 0, 0).translate(w / 2 + 0.09, 0.04, 0.0), 'cloth');   // a collapsed umbrella on the ground
  add(tilted(cyl(0.004, 0.004, 0.2, w / 2 + 0.07, 0.01, 0.03, 4), 1.35, w / 2 + 0.07, 0.01, 0.03), 'iron');
  add(cyl(0.022, 0.018, 0.06, -w / 2 - 0.045, 0, -0.04, 8), 'iron');                                    // a bin
  add(boxGeo(0.05, 0.035, 0.04, -w / 2 - 0.05, 0, 0.05), 'plank');
  for (const s of [-1, 1]) add(torus(0.03, 0.006, s * (w / 2 + 0.012), 0.03, d * 0.7, 0, Math.PI / 2), 'iron');   // cart wheels
  h.position.set(x, 0, z); h.rotation.set(0, 0.1, -0.04);
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L1
export function corner(o) {
  const glow = o.glowKey, { x = 0, z = 0.12 } = o, g = new THREE.Group(), add = adder(g), w = 0.37, d = 0.5, wh = 0.42;
  g.add(building('shopfront', { x, z, w, d, h: wh, ground: 'shop', gn: 1, gh: 0.22, roof: 'flat', cornice: true, parapetH: 0.03, parapetMat: 'brick', lit: 0.8, glowKey: glow, ...o }, glow));
  awning(g, { x, y: 0.205, z, w: w - 0.03, d: 0.1, drop: 0.05, a: '#7a1c1c', b: '#d9d1bd' });
  for (const [dx, c] of [[-0.09, 'leaf'], [-0.03, 'terracotta'], [0.03, 'ochre']]) { add(boxGeo(0.05, 0.03, 0.04, x + dx, 0, z - 0.06), 'wood'); add(boxGeo(0.044, 0.01, 0.034, x + dx, 0.03, z - 0.06), c); }   // crates of fruit
  add(boxGeo(0.04, 0.07, 0.03, x + w / 2 - 0.04, 0, z - 0.04), 'steel');                               // a newspaper rack
  add(boxGeo(0.08, 0.01, 0.01, x, 0.215, z - 0.012), 'brass');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.03, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2
export function dinerblock(o) {
  const glow = o.glowKey, { x = 0, z = 0.1 } = o, g = new THREE.Group(), add = adder(g), w = 0.55, d = 0.62;
  g.add(ARCH.diner({ x, z, w, d: d - 0.02, h: 0.25, glowKey: glow }));
  g.add(building('shopfront', { ...o, x, z, w, d, y: 0.26, h: 0.36, roof: 'flat', cornice: true, parapetH: 0.04, parapetMat: 'stone', lit: 0.6, glowKey: glow }, glow));
  add(boxGeo(w + 0.02, 0.012, 0.03, x, 0.255, z - 0.016), 'chrome');
  add(boxGeo(0.07, 0.04, 0.06, x - 0.12, 0.62 + 0.04, z + 0.4, 2, 2), 'tin'); add(boxGeo(0.05, 0.1, 0.05, x + 0.15, 0.62 + 0.04, z + 0.32, 2, 2), 'brick');
  add(boxGeo(0.045, 0.035, 0.03, x + 0.2, 0.42, z - 0.014), 'concrete');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: 0.62 + 0.04, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3
export function dstore(o) {
  const glow = o.glowKey, { x = 0, z = 0.06 } = o, g = new THREE.Group(), add = adder(g), w = 0.8, d = 0.72, wh = 1.22;
  g.add(building('shopfront', { x, z, w, d, h: wh, ground: 'shop', gn: 3, gh: 0.22, roof: 'flat', cornice: true, parapetH: 0.06, parapetMat: 'stone', lit: 1, glowKey: glow, ...o }, glow));
  for (const s of [-1, 1]) add(boxGeo(0.045, wh, 0.02, x + s * (w / 2 - 0.0225), 0, z - 0.01), 'limestone');   // stone pilasters
  course(add, x, 0.22, w + 0.04, z - 0.02, 'limestone', 0.02, 0.05); course(add, x, 0.62, w + 0.01, z - 0.006, 'limestone', 0.012, 0.025); course(add, x, 0.82, w + 0.01, z - 0.006, 'limestone', 0.012, 0.025);
  // the theatre marquee over the middle shop: a red-lacquer slab on posts with a ring of bulbs (a lit board goes on its face)
  const mw = 0.5, mz = z - 0.16, my = 0.34;
  add(boxGeo(mw, 0.07, 0.2, x, my, mz + 0.1), 'wine'); add(boxGeo(mw + 0.02, 0.012, 0.21, x, my + 0.07, mz + 0.1), 'brass');
  const bulbs = new Glow('#ffe2a8', 1.6);
  for (let k = 0; k <= 14; k++) bulbs.add(sphere(0.0085, x - mw / 2 + k * mw / 14, my + 0.002, mz - 0.002, 6));
  for (let k = 1; k <= 4; k++) for (const s of [-1, 1]) bulbs.add(sphere(0.0085, x + s * mw / 2, my + 0.002, mz + k * 0.04, 6));
  bulbs.flush(g);
  for (const s of [-1, 1]) add(cyl(0.007, 0.007, my, x + s * (mw / 2 - 0.02), 0, mz + 0.02, 6), 'brass');
  steps(add, x, mz, 0.5, 2, 'limestone');
  rooftop(add, x + 0.08, wh + 0.06, z + 0.4, { tank: true, stack: true });
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.06, zf: z };
  return g;
}

// ------------------------------------------------------------------ L4: the movie palace
export function palace(o) {
  const glow = o.glowKey, { x = 0, z = 0.22 } = o, g = new THREE.Group(), add = adder(g);
  const w = 0.84, d = 0.6, top = 1.1, pw = 0.34, py = 1.5, pz = z + 0.02;
  g.add(building('palace', { x, z, w, d, h: top, ground: 'lobby', gn: 1, gh: 0.3, roof: 'flat', roofMat: 'terracotta', parapet: false, lit: 1, glowKey: glow, ...o }, glow));
  g.add(building('palace', { ...o, x, z: pz, w: pw, d: 0.36, y: top, h: py - top, roof: 'flat', roofMat: 'terracotta', parapet: false, sides: true, lit: 1, glowKey: glow }, glow));   // the pylon
  // deco: stepped crown, brass fins up the pylon and the wings, a heavy brass frieze
  add(boxGeo(pw + 0.06, 0.03, 0.4, x, py, pz + 0.18), 'chrome'); add(boxGeo(pw - 0.06, 0.06, 0.3, x, py + 0.03, pz + 0.18), 'terracotta'); add(boxGeo(pw - 0.16, 0.05, 0.2, x, py + 0.09, pz + 0.18), 'chrome');
  spireTop(add, x, py + 0.14, pz + 0.18, 0.12, 0.3);
  for (let k = -2; k <= 2; k++) add(boxGeo(0.012, py - top, 0.02, x + k * 0.07, top, pz - 0.01), 'chrome');
  for (let k = 0; k <= 6; k++) add(boxGeo(0.012, top - 0.3, 0.018, x - 0.42 + k * 0.14, 0.3, z - 0.009), 'chrome');
  add(boxGeo(w + 0.05, 0.03, 0.07, x, top - 0.02, z - 0.04), 'terracotta'); add(boxGeo(w + 0.05, 0.01, 0.075, x, top + 0.01, z - 0.04), 'chrome');
  for (const s of [-1, 1]) { add(boxGeo(0.07, 0.1, 0.07, x + s * (w / 2 - 0.04), top, z + 0.05), 'terracotta'); add(boxGeo(0.08, 0.012, 0.08, x + s * (w / 2 - 0.04), top + 0.1, z + 0.05), 'chrome'); }
  // the marquee: a deep brass slab over the entrance, bulbs round the lip, posts, a lit underside
  const mw = 0.64, mz = z - 0.2, my = 0.34;
  add(boxGeo(mw, 0.07, 0.22, x, my, mz + 0.11), 'chrome'); add(boxGeo(mw + 0.02, 0.012, 0.23, x, my + 0.07, mz + 0.11), 'gold');
  const bulbs = new Glow('#ffe2a8', 1.7);
  for (let k = 0; k <= 16; k++) bulbs.add(sphere(0.0085, x - mw / 2 + k * mw / 16, my + 0.002, mz - 0.002, 6));
  for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) bulbs.add(sphere(0.0085, x + s * mw / 2, my + 0.002, mz + k * 0.04, 6));
  bulbs.flush(g);
  new Glow('#ffe0a8', 1.4).add(boxGeo(mw - 0.06, 0.004, 0.18, x, my - 0.003, mz + 0.11)).flush(g);
  for (const s of [-1, 1]) add(cyl(0.008, 0.008, my, x + s * (mw / 2 - 0.02), 0, mz + 0.02, 8), 'chrome');
  steps(add, x, mz - 0.0, 0.64, 3, 'marble');
  lamps(g, [-0.4, -0.31, 0.31, 0.4].map(c => [x + c, mz - 0.02]), { h: 0.26, style: 'lantern', color: '#ffd89a', post: 'chrome' });
  lightUp(g, { x, w: w - 0.04, h: top - 0.1, wz: z - 0.035, fx: [-0.36, 0.36].map(c => x + c), fz: mz + 0.04, pz: mz - 0.1, pw: 0.9, pd: 0.32 });
  g.userData.roof = { x0: x - pw / 2, x1: x + pw / 2, top: py + 0.0, zf: pz - 0.01 };
  return g;
}

export const DOWNTOWN_ARCH = { dstand: stand, dcorner: corner, ddiner: dinerblock, dstore, dpalace: palace };
