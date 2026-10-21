// Grand Avenue's six levels (size classes as in bowery.js: white marble, gold trim, canopies):
//   0  a crumbling valet / ticket booth, a chipped corner, a fallen velvet rope
//   1  a small boutique villa with a gold canopy and clipped topiary
//   2  a 3-storey boutique hotel
//   3  a big marble hotel tower with a penthouse and a roof sign
//   4  a grand casino-hotel palace: gold trim, a porte-cochere with a ring of bulbs, domed corner towers, a red carpet
import * as THREE from 'three';
import { building, ARCH } from './archetypes.js';
import { adder, boxGeo, cyl, tilted, sphere, cone, torus, Glow, lamps, lightUp, columns, steps, balustrade, railing, course, board, dome } from './lvlkit.js';

// ------------------------------------------------------------------ L0
export function booth(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group(), add = adder(h);
  const w = 0.2, d = 0.2, wh = 0.17;
  h.add(building('booth', { x: 0, z: 0, w, d, h: wh, roof: 'flat', roofMat: 'marble', parapet: false, boarded: true, dim: 0.9, sides: true }, null));
  add(boxGeo(w + 0.04, 0.014, d + 0.04, 0, wh, d / 2), 'marble'); add(boxGeo(w + 0.045, 0.006, d + 0.045, 0, wh + 0.014, d / 2), 'ochre');
  add(boxGeo(w + 0.012, 0.008, 0.012, 0, 0.1, -0.006), 'ochre');                                      // a tarnished brass band
  add(tilted(boxGeo(0.08, 0.014, 0.05, -w / 2 - 0.02, 0.0, -0.08), 0.5, -w / 2 - 0.02, 0, -0.08), 'marble');   // chunks fallen off the corner
  add(boxGeo(0.035, 0.025, 0.03, -w / 2 - 0.05, 0, -0.06), 'concrete'); add(boxGeo(0.02, 0.015, 0.02, -w / 2 - 0.02, 0, -0.1), 'concrete');
  board(h, { text: 'VALET', x: 0, y: wh + 0.02, z: -0.03, w: 0.15, h: 0.055, bg: '#262a34', fg: '#8a7650', rim: '#6a5230' });
  add(boxGeo(0.12, 0.05, 0.012, 0, 0.04, -0.008), 'dark');                                           // the ticket window, boarded
  add(cyl(0.007, 0.01, 0.1, w / 2 + 0.07, 0, -0.07, 8), 'ochre'); add(sphere(0.012, w / 2 + 0.07, 0.108, -0.07, 7), 'ochre');   // a rope post still standing
  add(new THREE.CylinderGeometry(0.007, 0.01, 0.1, 8).rotateZ(Math.PI / 2).translate(w / 2 + 0.17, 0.01, -0.07), 'ochre');   // one has fallen
  add(boxGeo(0.1, 0.006, 0.006, w / 2 + 0.12, 0.003, -0.07), 'wine');
  h.position.set(x, 0, z); h.rotation.set(0, 0.1, -0.035);
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.02, zf: z };
  return g;
}

// ------------------------------------------------------------------ L1
export function villa(o) {
  const glow = o.glowKey, { x = 0, z = 0.12 } = o, g = new THREE.Group(), add = adder(g), w = 0.37, d = 0.5, wh = 0.46;
  g.add(building('marble', { x, z, w, d, h: wh, ground: 'lobby', gn: 1, gh: 0.27, roof: 'mansard', rh: 0.13, cornice: true, corniceMat: 'gold', lit: 0.8, glowKey: glow, ...o }, glow));
  g.add(ARCH.canopy({ x, y: 0.05, z, w: 0.22, d: 0.1, mat: 'gold' }));
  for (const s of [-1, 1]) {                                                                           // clipped topiary in terracotta pots
    add(cyl(0.02, 0.016, 0.035, x + s * 0.15, 0, z - 0.09, 8), 'terracotta'); add(sphere(0.03, x + s * 0.15, 0.065, z - 0.09, 9), 'leaf');
  }
  railing(add, x - w / 2 + 0.02, x - 0.08, 0, z - 0.14, 0.045, 0.03, 'gold'); railing(add, x + 0.08, x + w / 2 - 0.02, 0, z - 0.14, 0.045, 0.03, 'gold');
  railing(add, x - 0.12, x + 0.12, 0.27, z - 0.03, 0.04, 0.03, 'gold');                               // a gilt rail on the first-floor balcony
  add(boxGeo(0.26, 0.01, 0.05, x, 0.265, z - 0.02), 'marble');
  new Glow('#fff0cc', 1.3).add(sphere(0.012, x - 0.12, 0.2, z - 0.012, 7)).add(sphere(0.012, x + 0.12, 0.2, z - 0.012, 7)).flush(g);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2
export function hotel2(o) {
  const glow = o.glowKey, { x = 0, z = 0.1 } = o, g = new THREE.Group(), add = adder(g), w = 0.55, d = 0.62, wh = 0.62;
  g.add(building('marble', { x, z, w, d, h: wh, ground: 'lobby', gn: 2, gh: 0.27, roof: 'flat', roofMat: 'marble', parapetMat: 'marble', parapetH: 0.04, cornice: true, corniceMat: 'gold', lit: 0.6, glowKey: glow, ...o }, glow));
  g.add(ARCH.canopy({ x, y: 0.05, z, w: 0.3, d: 0.12, mat: 'gold' }));
  for (const s of [-1, 1]) { add(boxGeo(0.07, 0.04, 0.04, x + s * 0.2, 0, z - 0.07), 'marble'); add(boxGeo(0.06, 0.02, 0.03, x + s * 0.2, 0.04, z - 0.07), 'leaf'); }
  course(add, x, 0.27, w + 0.02, z - 0.01, 'gold', 0.01, 0.03);
  for (const s of [-1, 1]) add(boxGeo(0.03, wh, 0.02, x + s * (w / 2 - 0.015), 0, z - 0.01), 'marble');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.04, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3
export function hotel3(o) {
  const glow = o.glowKey, { x = 0, z = 0.06 } = o, g = new THREE.Group(), add = adder(g), w = 0.8, d = 0.72, wh = 1.17;
  g.add(building('marble', { x, z, w, d, h: wh, ground: 'lobby', gn: 3, gh: 0.27, roof: 'flat', roofMat: 'marble', parapetMat: 'marble', parapetH: 0.04, cornice: true, corniceMat: 'gold', lit: 1, glowKey: glow, ...o }, glow));
  g.add(building('marble', { ...o, x, z: z + 0.1, w: 0.5, d: 0.5, y: wh, h: 0.19, roof: 'flat', roofMat: 'marble', parapetMat: 'marble', parapetH: 0.03, cornice: true, corniceMat: 'gold', sides: true, lit: 1, glowKey: glow }, glow));
  g.add(ARCH.canopy({ x, y: 0.05, z, w: 0.46, d: 0.14, mat: 'gold' }));
  course(add, x, 0.27, w + 0.02, z - 0.01, 'gold', 0.01, 0.03); course(add, x, 0.65, w + 0.01, z - 0.006, 'gold', 0.008, 0.02);
  for (const s of [-1, 1]) add(boxGeo(0.035, wh, 0.02, x + s * (w / 2 - 0.0175), 0, z - 0.01), 'marble');
  for (const s of [-1, 1]) { add(boxGeo(0.07, 0.04, 0.045, x + s * 0.33, 0, z - 0.08), 'marble'); add(boxGeo(0.06, 0.02, 0.035, x + s * 0.33, 0.04, z - 0.08), 'leaf'); }
  g.userData.roof = { x0: x - 0.25, x1: x + 0.25, top: wh + 0.19 + 0.03, zf: z + 0.1 };
  return g;
}

// ------------------------------------------------------------------ L4: the casino palace
export function casino(o) {
  const glow = o.glowKey, { x = 0, z = 0.22 } = o, g = new THREE.Group(), add = adder(g);
  const w = 0.84, d = 0.6, top = 1.1, tx = 0.335, ttop = 1.4;
  g.add(building('marble4', { x, z, w, d, h: top, ground: 'lobby', gn: 1, gh: 0.3, roof: 'flat', roofMat: 'whitemarble', parapet: false, cornice: true, corniceMat: 'gold', lit: 1, glowKey: glow, ...o }, glow));
  for (const s of [-1, 1]) {                                                                         // the corner towers and their gold domes
    g.add(building('marble4', { ...o, x: x + s * tx, z: z - 0.02, w: 0.17, d: 0.54, y: top, h: ttop - top, roof: 'flat', roofMat: 'whitemarble', parapet: false, sides: true, lit: 1, glowKey: glow }, glow));
    add(boxGeo(0.2, 0.02, 0.57, x + s * tx, top - 0.01, z + 0.25), 'gold');
    dome(add, x + s * tx, ttop, z + 0.25, 0.075, { drum: 0.04, mat: 'gold', drumMat: 'whitemarble', trim: 'brass', seg: 16 });
  }
  g.add(building('marble4', { ...o, x, z: z + 0.06, w: 0.34, d: 0.44, y: top, h: 0.22, roof: 'flat', roofMat: 'whitemarble', parapet: false, sides: true, lit: 1, glowKey: glow }, glow));   // the central block
  add(boxGeo(0.38, 0.025, 0.48, x, top + 0.22, z + 0.06), 'gold'); add(boxGeo(0.26, 0.04, 0.34, x, top + 0.245, z + 0.1), 'whitemarble');
  add(cyl(0.004, 0.006, 0.22, x, top + 0.285, z + 0.2, 5), 'gold'); add(sphere(0.012, x, top + 0.51, z + 0.2, 7), 'gold');
  for (let k = 0; k <= 6; k++) add(boxGeo(0.012, top - 0.3, 0.018, x - 0.42 + k * 0.14, 0.3, z - 0.009), 'gold');   // gold fins between the bays
  add(boxGeo(w + 0.06, 0.04, 0.08, x, top - 0.03, z - 0.04), 'whitemarble'); add(boxGeo(w + 0.05, 0.012, 0.085, x, top - 0.05, z - 0.04), 'gold');
  course(add, x, 0.3, w + 0.03, z - 0.012, 'gold', 0.014, 0.04); course(add, x, 0.7, w + 0.012, z - 0.006, 'gold', 0.01, 0.02);
  // the porte-cochere: a deep gold canopy on four slim columns, a ring of bulbs, a lit underside, a red carpet to the kerb
  const mw = 0.66, mz = z - 0.22, my = 0.35;
  add(boxGeo(mw, 0.045, 0.22, x, my, mz + 0.11), 'gold'); add(boxGeo(mw + 0.02, 0.012, 0.23, x, my + 0.045, mz + 0.11), 'whitemarble');
  const bulbs = new Glow('#fff0cc', 1.7);
  for (let k = 0; k <= 17; k++) bulbs.add(sphere(0.008, x - mw / 2 + k * mw / 17, my + 0.002, mz - 0.002, 6));
  for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) bulbs.add(sphere(0.008, x + s * mw / 2, my + 0.002, mz + k * 0.04, 6));
  bulbs.flush(g);
  new Glow('#ffe0a8', 1.4).add(boxGeo(mw - 0.06, 0.004, 0.18, x, my - 0.003, mz + 0.11)).flush(g);
  for (const s of [-1, 1]) for (const zz of [0.03, 0.19]) add(cyl(0.008, 0.01, my, x + s * (mw / 2 - 0.025), 0, mz + zz, 8), 'gold');
  add(boxGeo(0.14, 0.004, 0.34, x, 0.002, mz + 0.12), 'wine');
  steps(add, x, mz - 0.0, 0.66, 2, 'whitemarble');
  for (const dx of [-0.12, 0, 0.12]) { add(boxGeo(0.08, 0.2, 0.006, x + dx, 0.03, z - 0.008), 'gold'); add(boxGeo(0.09, 0.012, 0.01, x + dx, 0.23, z - 0.01), 'whitemarble'); }
  lamps(g, [-0.4, -0.32, 0.32, 0.4].map(c => [x + c, mz - 0.03]), { h: 0.26, style: 'globe', color: '#fff0cc', post: 'gold' });
  lightUp(g, { x, w: w - 0.04, h: top - 0.1, wz: z - 0.035, fx: [-0.34, 0.34].map(c => x + c), fz: mz + 0.04, pz: mz - 0.1, pw: 0.9, pd: 0.32 });
  g.userData.roof = { x0: x - 0.19, x1: x + 0.19, top: top + 0.22 + 0.025, zf: z + 0.06 };
  return g;
}

export const LUXE_ARCH = { lbooth: booth, lvilla: villa, lhotel2: hotel2, lhotel3: hotel3, lcasino: casino };
