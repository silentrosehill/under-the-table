// Paris' six levels (size classes as in bowery.js: pale stone, zinc mansards, cabaret gilt):
//   0  a crooked, boarded newspaper kiosk under a sagging green cap
//   1  a small café house with a striped awning and two pavement tables
//   2  a 3-storey building with balconies and a mansard
//   3  a big Haussmann block, café arcade below, two long balconies, a mansard with lit dormers, cabaret neon (districts.js adds the signs)
//   4  a gilded opera-style cabaret palace: pale marble, gold, a lit marquee on a pedimented pavilion and a small copper dome
import * as THREE from 'three';
import { building } from './archetypes.js';
import { adder, boxGeo, cyl, tilted, sphere, cone, Glow, lamps, lightUp, columns, pediment, steps, balustrade, railing, course, awning, dome } from './lvlkit.js';

// ------------------------------------------------------------------ L0
export function kiosk(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group(), add = adder(h);
  const w = 0.2, d = 0.2, wh = 0.16;
  h.add(building('kiosk', { x: 0, z: 0, w, d, h: wh, roof: 'none', boarded: true, dim: 1, sides: true }, null));
  add(new THREE.ConeGeometry(0.15, 0.075, 6).rotateY(0.3).translate(0, wh + 0.037, d / 2), 'green');          // the cap, sagging
  add(sphere(0.012, 0, wh + 0.085, d / 2, 6), 'brass');
  add(boxGeo(w + 0.03, 0.012, d + 0.03, 0, wh, d / 2), 'sooty');
  add(boxGeo(0.12, 0.05, 0.02, 0, 0.05, -0.02), 'wood');                                                       // the counter flap, shut
  add(tilted(boxGeo(0.014, 0.17, 0.03, w / 2 + 0.035, 0, -0.03), 0.4, w / 2 + 0.035, 0, -0.03), 'plank');     // a prop plank
  add(tilted(boxGeo(0.08, 0.05, 0.03, -w / 2 - 0.05, 0, -0.03), -0.1, -w / 2 - 0.05, 0, -0.03), 'cream');     // a bundle of old papers
  add(boxGeo(0.06, 0.03, 0.03, -w / 2 - 0.045, 0.05, -0.04), 'cloth');
  h.position.set(x, 0, z); h.rotation.set(0, 0.12, 0.06);
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L1
export function cafe(o) {
  const glow = o.glowKey, { x = 0, z = 0.12 } = o, g = new THREE.Group(), add = adder(g), w = 0.37, d = 0.5, wh = 0.45;
  g.add(building('haussmann', { x, z, w, d, h: wh, ground: 'cafe', gn: 1, gh: 0.24, roof: 'mansard', rh: 0.12, cornice: true, lit: 0.8, glowKey: glow, ...o }, glow));
  awning(g, { x, y: 0.225, z, w: w - 0.03, d: 0.11, drop: 0.055, a: '#a3241c', b: '#d9d1bd' });                 // the striped awning
  for (const tx of [-0.08, 0.09]) {                                                                           // two pavement tables, two chairs each
    add(cyl(0.004, 0.006, 0.04, x + tx, 0, z - 0.17, 5), 'iron'); add(cyl(0.026, 0.026, 0.006, x + tx, 0.04, z - 0.17, 12), 'iron');
    for (const cx of [-0.045, 0.045]) { add(boxGeo(0.022, 0.016, 0.022, x + tx + cx, 0.018, z - 0.17), 'wood'); add(boxGeo(0.022, 0.03, 0.005, x + tx + cx, 0.034, z - 0.185), 'wood'); }
  }
  course(add, x, 0.235, w + 0.02, z - 0.012, 'portland', 0.014, 0.03);
  add(boxGeo(0.05, 0.1, 0.05, x + 0.12, wh + 0.08, z + 0.34, 2, 2), 'brick');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2
export function balconied(o) {
  const glow = o.glowKey, { x = 0, z = 0.1 } = o, g = new THREE.Group(), add = adder(g), w = 0.55, d = 0.62, wh = 0.6;
  g.add(building('haussmann', { x, z, w, d, h: wh, ground: 'cafe', gn: 2, gh: 0.24, roof: 'mansard', rh: 0.15, cornice: true, lit: 0.6, glowKey: glow, ...o }, glow));
  for (const s of [-1, 1]) awning(g, { x: x + s * 0.139, y: 0.225, z, w: 0.25, d: 0.1, drop: 0.05, a: '#1c3a52', b: '#d9d1bd' });
  course(add, x, 0.235, w + 0.02, z - 0.012, 'portland', 0.014, 0.03);
  add(boxGeo(w - 0.02, 0.012, 0.05, x, 0.24 - 0.006 + 0.0, z - 0.02), 'portland');                           // a stone balcony ledge on the first floor
  railing(add, x - w / 2 + 0.03, x + w / 2 - 0.03, 0.246, z - 0.042, 0.045, 0.03);
  for (const s of [-0.16, 0.16]) add(boxGeo(0.05, 0.11, 0.05, x + s, wh + 0.07, z + 0.42, 2, 2), 'brick');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3
export function haussmann(o) {
  const glow = o.glowKey, { x = 0, z = 0.06 } = o, g = new THREE.Group(), add = adder(g), w = 0.8, d = 0.72, wh = 1.08;
  g.add(building('haussmann', { x, z, w, d, h: wh, ground: 'cafe', gn: 3, gh: 0.24, roof: 'mansard', rh: 0.17, cornice: true, lit: 1, glowKey: glow, ...o }, glow));
  for (const k of [-1, 0, 1]) awning(g, { x: x + k * 0.267, y: 0.225, z, w: 0.24, d: 0.1, drop: 0.05, a: '#4a1620', b: '#c9bfa8' });
  course(add, x, 0.235, w + 0.02, z - 0.012, 'portland', 0.014, 0.03);
  for (const yb of [0.24, 0.66]) {                                                                           // the two long balconies: a stone slab, an iron rail
    add(boxGeo(w - 0.02, 0.012, 0.05, x, yb - 0.006, z - 0.02), 'portland');
    railing(add, x - w / 2 + 0.03, x + w / 2 - 0.03, yb + 0.006, z - 0.042, 0.045, 0.03);
  }
  course(add, x, 0.45, w + 0.012, z - 0.006, 'portland', 0.01, 0.02); course(add, x, 0.87, w + 0.012, z - 0.006, 'portland', 0.01, 0.02);
  for (const s of [-1, 1]) add(boxGeo(0.035, wh - 0.24, 0.016, x + s * (w / 2 - 0.0175), 0.24, z - 0.008), 'portland');
  for (const s of [-0.28, -0.09, 0.1, 0.29]) add(boxGeo(0.055, 0.12, 0.055, x + s, wh + 0.1, z + 0.5, 2, 2), 'brick');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L4: the cabaret palace
export function palace(o) {
  const glow = o.glowKey, { x = 0, z = 0.22 } = o, g = new THREE.Group(), add = adder(g);
  const w = 0.84, d = 0.6, top = 1.1, pw = 0.46, pd = 0.12, pz = z - pd, ptop = 1.2, my = 0.33;
  g.add(building('opera', { x, z, w, d, h: top, ground: 'lobby', gn: 1, gh: 0.3, roof: 'flat', roofMat: 'rosemarble', parapet: false, lit: 1, glowKey: glow, ...o }, glow));
  g.add(building('opera', { ...o, x, z: pz, w: pw, d: pd + 0.01, y: 0.3, h: ptop - 0.3, roof: 'flat', roofMat: 'rosemarble', parapet: false, sides: true, lit: 1, glowKey: glow }, glow));   // the pavilion, standing over the entrance
  // gilt and marble at the top: cornice, balustrade, urns
  add(boxGeo(w + 0.06, 0.04, 0.1, x, top - 0.03, z - 0.05), 'rosemarble'); add(boxGeo(w + 0.04, 0.012, 0.11, x, top - 0.05, z - 0.05), 'gold');
  balustrade(add, x - w / 2, x + w / 2, top + 0.01, z - 0.08, 'rosemarble', 20);
  add(boxGeo(pw + 0.06, 0.04, pd + 0.05, x, ptop - 0.03, z - pd / 2 - 0.03), 'rosemarble'); add(boxGeo(pw + 0.04, 0.012, pd + 0.06, x, ptop - 0.05, z - pd / 2 - 0.03), 'gold');
  pediment(add, x, ptop + 0.01, pz - 0.03, pd + 0.04, pw + 0.06, 0.1, 'rosemarble');
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 16).rotateX(Math.PI / 2).translate(x, ptop + 0.05, pz - 0.034), 'gold');
  for (const s of [-1, 1]) { add(sphere(0.02, x + s * (pw / 2 + 0.01), ptop + 0.04, pz + 0.01, 8), 'gold'); add(sphere(0.022, x + s * (w / 2 - 0.03), top + 0.06, z - 0.07, 8), 'rosemarble'); }
  // marquee: a slab of gilt on slim posts with a ring of bulbs (districts.js hangs the lit CABARET board on its face)
  const mw = 0.52, mz = pz - 0.1;
  add(boxGeo(mw, 0.06, 0.2, x, my, mz + 0.1), 'gold'); add(boxGeo(mw + 0.02, 0.014, 0.21, x, my + 0.06, mz + 0.1), 'rosemarble');
  const bulbs = new Glow('#ffe2a8', 1.6);
  for (let k = 0; k <= 12; k++) bulbs.add(sphere(0.0085, x - mw / 2 + k * mw / 12, my - 0.002, mz - 0.002, 6));
  for (let k = 1; k <= 4; k++) for (const s of [-1, 1]) bulbs.add(sphere(0.0085, x + s * mw / 2, my - 0.002, mz + k * 0.04, 6));
  bulbs.flush(g);
  for (const s of [-1, 1]) add(cyl(0.007, 0.007, my - 0.0, x + s * (mw / 2 - 0.02), 0, mz + 0.02, 6), 'gold');
  steps(add, x, mz - 0.0, 0.5, 3, 'rosemarble');
  const neon = new Glow('#ff4fa0', 2.2);                                                           // pink neon: a tube along the marquee front and one under the pavilion cornice
  neon.add(boxGeo(mw + 0.03, 0.008, 0.008, x, my - 0.012, mz - 0.012)).add(boxGeo(pw + 0.03, 0.008, 0.008, x, ptop - 0.065, pz - 0.04)).add(boxGeo(0.008, 0.2, 0.008, x - pw / 2 - 0.02, 0.62, pz - 0.03)).add(boxGeo(0.008, 0.2, 0.008, x + pw / 2 + 0.02, 0.62, pz - 0.03)).flush(g);
  // gilded door surrounds and the lit fanlights
  for (const dx of [-0.1, 0, 0.1]) { add(boxGeo(0.07, 0.19, 0.006, x + dx, 0.04, z - 0.008), 'wine'); add(boxGeo(0.085, 0.012, 0.01, x + dx, 0.23, z - 0.01), 'gold'); }
  new Glow('#ffd89a', 1.4).add(boxGeo(0.3, 0.025, 0.004, x, 0.262, z - 0.014)).flush(g);
  for (const s of [-1, 1]) columns(add, [x + s * 0.17], 0.3, 0.9, pz + 0.03, { r: 0.012, shaft: 'rosemarble', cap: 'gold', w: 0.04 });   // slim marble columns up the pavilion
  // the small dome behind the pavilion
  dome(add, x, top, z + 0.3, 0.12, { drum: 0.1, mat: 'copper', drumMat: 'rosemarble', trim: 'gold' });
  lamps(g, [-0.38, -0.3, 0.3, 0.38].map(c => [x + c, mz - 0.0]), { h: 0.26, style: 'globe', color: '#ffd9a8', post: 'gold' });
  lightUp(g, { x, w: w - 0.04, h: top - 0.1, wz: z - 0.035, fx: [-0.3, 0.3].map(c => x + c), fz: mz + 0.03, pz: mz - 0.1, pw: 0.85, pd: 0.34 });
  g.userData.roof = { x0: x - pw / 2, x1: x + pw / 2, top: ptop + 0.0, zf: pz - 0.03 };
  return g;
}

export const PARIS_ARCH = { pkiosk: kiosk, pcafe: cafe, pbalcony: balconied, phauss: haussmann, ppalace: palace };
