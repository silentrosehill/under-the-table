// The art-deco business district's six levels (size classes as in bowery.js: limestone, bronze spandrels, brass):
//   0  a boarded newsstand with a shoe-shine stand beside it, its green awning fallen
//   1  a small deco bank-branch pavilion: a stepped crown, brass canopy, fins
//   2  a 3-storey deco office block with one setback
//   3  a big deco office tower with two setbacks and limestone fins
//   4  an imposing deco skyscraper: four setbacks, a brass spire, a marble lobby under a brass canopy, brass fins, uplit
import * as THREE from 'three';
import { building, ARCH } from './archetypes.js';
import { adder, boxGeo, cyl, tilted, sphere, cone, Glow, lamps, lightUp, steps, railing, course, board, wedge, spireTop } from './lvlkit.js';

// one tier of a stepped block: its own building, stacked from y; the first one has the lobby
const tier = (g, glow, o, style, x, y, z, w, d, h, extra = {}) => g.add(building(style, { roof: 'flat', roofMat: 'limestone', parapet: false, lit: 1, glowKey: glow, ...o, x, y, z, w, d, h, ...extra }, glow));
// a vertical fin: a thin limestone blade proud of the front, from y0 up h
const fins = (add, xs, y0, h, zf, mat = 'limestone') => xs.forEach(fx => add(boxGeo(0.014, h, 0.02, fx, y0, zf - 0.01), mat));

// ------------------------------------------------------------------ L0
export function newsstand(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group(), add = adder(h);
  const w = 0.2, d = 0.2, wh = 0.17;
  h.add(building('news', { x: 0, z: 0, w, d, h: wh, roof: 'flat', roofMat: 'concrete', parapet: false, boarded: true, dim: 1, sides: true }, null));
  add(boxGeo(w + 0.03, 0.014, d + 0.03, 0, wh, d / 2), 'limestone');
  board(h, { text: 'NEWS', x: 0, y: wh + 0.014, z: -0.01, w: 0.16, h: 0.05, bg: '#1d2a24', fg: '#7d775f', rim: '#6a5a34' });
  add(tilted(boxGeo(0.15, 0.006, 0.09, 0.0, 0.1, -0.04), 0.65, 0, 0.1, -0.04), 'green');             // the awning, fallen to one side
  add(boxGeo(0.13, 0.05, 0.012, 0, 0.04, -0.008), 'dark');                                           // the counter, boarded
  add(boxGeo(0.1, 0.012, 0.07, w / 2 + 0.085, 0, -0.02), 'wood'); add(boxGeo(0.05, 0.05, 0.012, w / 2 + 0.085, 0.012, -0.012), 'iron');   // a shoe-shine stand: a step, a seat
  add(boxGeo(0.045, 0.035, 0.03, w / 2 + 0.085, 0.012, -0.05), 'iron');
  add(boxGeo(0.05, 0.03, 0.04, -w / 2 - 0.05, 0, -0.03), 'cream'); add(boxGeo(0.05, 0.02, 0.04, -w / 2 - 0.045, 0.03, -0.03), 'cream');   // old papers
  h.position.set(x, 0, z); h.rotation.set(0, -0.08, 0.03);
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.014, zf: z };
  return g;
}

// ------------------------------------------------------------------ L1
export function branch(o) {
  const glow = o.glowKey, { x = 0, z = 0.12 } = o, g = new THREE.Group(), add = adder(g), w = 0.37, d = 0.5, wh = 0.43;
  tier(g, glow, o, 'deco', x, 0, z, w, d, wh, { ground: 'lobby', gn: 1, gh: 0.26, cornice: true, lit: 0.8 });
  add(boxGeo(0.33, 0.03, 0.44, x, wh, z + 0.03), 'limestone'); add(boxGeo(0.25, 0.03, 0.34, x, wh + 0.03, z + 0.08), 'brass');   // stepped crown
  fins(add, [x - 0.14, x - 0.07, x + 0.07, x + 0.14], 0.26, wh - 0.26, z);
  for (const s of [-1, 1]) add(boxGeo(0.03, wh, 0.03, x + s * (w / 2 - 0.015), 0, z - 0.012), 'limestone');   // corner piers
  g.add(ARCH.canopy({ x, y: 0.06, z: z - 0.0, w: 0.22, d: 0.1 }));
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.03, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2
export function office(o) {
  const glow = o.glowKey, { x = 0, z = 0.1 } = o, g = new THREE.Group(), add = adder(g), w = 0.55, d = 0.62;
  tier(g, glow, o, 'deco', x, 0, z, w, d, 0.43, { ground: 'lobby', gn: 2, gh: 0.26, cornice: true, lit: 0.6 });
  tier(g, glow, o, 'deco', x, 0.43, z + 0.04, 0.45, 0.54, 0.17, { sides: true, lit: 0.6, cornice: true });
  add(boxGeo(0.37, 0.025, 0.46, x, 0.6, z + 0.09), 'limestone'); add(boxGeo(0.26, 0.012, 0.34, x, 0.625, z + 0.14), 'brass');
  fins(add, [-0.2, -0.1, 0.1, 0.2].map(c => x + c), 0.26, 0.17, z);
  for (const s of [-1, 1]) add(boxGeo(0.03, 0.43, 0.03, x + s * (w / 2 - 0.015), 0, z - 0.012), 'limestone');
  g.add(ARCH.canopy({ x, y: 0.06, z, w: 0.26, d: 0.1 }));
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: 0.43 + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3
export function tower(o) {
  const glow = o.glowKey, { x = 0, z = 0.06 } = o, g = new THREE.Group(), add = adder(g), w = 0.8, d = 0.72;
  tier(g, glow, o, 'deco', x, 0, z, w, d, 0.6, { ground: 'lobby', gn: 3, gh: 0.26, cornice: true });
  tier(g, glow, o, 'deco', x, 0.6, z + 0.06, 0.64, 0.6, 0.34, { sides: true, cornice: true });
  tier(g, glow, o, 'deco', x, 0.94, z + 0.13, 0.46, 0.46, 0.24, { sides: true, cornice: true });
  add(boxGeo(0.36, 0.03, 0.36, x, 1.18, z + 0.18), 'limestone'); add(boxGeo(0.24, 0.02, 0.24, x, 1.21, z + 0.24), 'brass');
  add(cyl(0.004, 0.007, 0.22, x, 1.23, z + 0.36, 5), 'brass');
  fins(add, Array.from({ length: 7 }, (_, k) => x - 0.3 + k * 0.1), 0.26, 0.34, z);                                   // fins up the first tiers
  fins(add, Array.from({ length: 5 }, (_, k) => x - 0.25 + k * 0.125), 0.6, 0.34, z + 0.06);
  fins(add, Array.from({ length: 4 }, (_, k) => x - 0.15 + k * 0.1), 0.94, 0.24, z + 0.13);
  for (const s of [-1, 1]) add(boxGeo(0.035, 0.6, 0.03, x + s * (w / 2 - 0.0175), 0, z - 0.012), 'limestone');
  g.add(ARCH.canopy({ x, y: 0.06, z, w: 0.3, d: 0.1 }));
  g.userData.roof = { x0: x - 0.23, x1: x + 0.23, top: 1.18 + 0.03, zf: z + 0.13 };
  return g;
}

// ------------------------------------------------------------------ L4: the skyscraper
export function skyscraper(o) {
  const glow = o.glowKey, { x = 0, z = 0.22 } = o, g = new THREE.Group(), add = adder(g);
  const w = 0.84, d = 0.6, cz = z - 0.14;
  tier(g, glow, o, 'deco4', x, 0, z, w, d, 0.77, { ground: 'lobby', gn: 1, gh: 0.3, cornice: true });
  tier(g, glow, o, 'deco4', x, 0.77, z + 0.05, 0.66, 0.5, 0.34, { sides: true, cornice: true });
  tier(g, glow, o, 'deco4', x, 1.11, z + 0.1, 0.48, 0.4, 0.34, { sides: true, cornice: true });
  tier(g, glow, o, 'deco4', x, 1.45, z + 0.15, 0.3, 0.3, 0.17, { sides: true, cornice: true });
  add(boxGeo(0.34, 0.025, 0.34, x, 1.62, z + 0.13), 'greenmarble');
  spireTop(add, x, 1.645, z + 0.3, 0.2, 0.55);
  // brass fins over the whole height, bronze-capped piers at the corners
  fins(add, Array.from({ length: 9 }, (_, k) => x - 0.4 + k * 0.1), 0.3, 0.47, z, 'brass');
  fins(add, Array.from({ length: 7 }, (_, k) => x - 0.3 + k * 0.1), 0.77, 0.34, z + 0.05, 'greenmarble');
  fins(add, Array.from({ length: 5 }, (_, k) => x - 0.2 + k * 0.1), 1.11, 0.34, z + 0.1, 'brass');
  for (const s of [-1, 1]) { add(boxGeo(0.04, 0.77, 0.03, x + s * (w / 2 - 0.02), 0, z - 0.014), 'greenmarble'); add(boxGeo(0.045, 0.02, 0.035, x + s * (w / 2 - 0.02), 0.77, z - 0.014), 'brass'); }
  // the entrance: a wide brass canopy lit from below, steps, a marble landing
  add(boxGeo(0.56, 0.022, 0.15, x, 0.34, cz + 0.075), 'brass'); add(boxGeo(0.58, 0.014, 0.012, x, 0.345, cz - 0.003), 'gold');
  for (const s of [-1, 1]) add(cyl(0.007, 0.007, 0.34, x + s * 0.26, 0, cz + 0.01, 8), 'brass');
  new Glow('#ffd48a', 1.5).add(boxGeo(0.5, 0.004, 0.11, x, 0.335, cz + 0.075)).flush(g);
  add(boxGeo(0.6, 0.02, 0.14, x, 0, cz + 0.07), 'greenmarble'); steps(add, x, cz - 0.0, 0.62, 2, 'greenmarble');
  for (const s of [-1, 1]) { add(boxGeo(0.06, 0.09, 0.06, x + s * 0.3, 0.02, cz + 0.03), 'greenmarble'); add(sphere(0.02, x + s * 0.3, 0.12, cz + 0.03, 8), 'brass'); }
  lamps(g, [-0.39, -0.33, 0.33, 0.39].map(c => [x + c, cz - 0.04]), { h: 0.3, style: 'globe', color: '#ffe0a8', post: 'brass' });
  lightUp(g, { x, w: w - 0.04, h: 0.67, wz: z - 0.035, fx: [-0.3, 0.3].map(c => x + c), fz: cz + 0.02, pz: cz - 0.1, pw: 0.85, pd: 0.3 });
  g.userData.roof = { x0: x - 0.15, x1: x + 0.15, top: 1.62 + 0.025, zf: z + 0.15 };
  return g;
}

export const CANAL_ARCH = { cnews: newsstand, cbranch: branch, coffice: office, ctower: tower, cskyscraper: skyscraper };
