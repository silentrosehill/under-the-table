// Old London's six levels (size classes as in bowery.js, brick and Portland stone):
//   0  a tumbledown coal shed, boarded up, a heap of coal at its foot
//   1  a tiny two-up-two-down brick cottage
//   2  a 3-storey brick terrace pair with a corner shop under a green awning
//   3  a big red-brick Victorian mansion block with bay windows
//   4  a grand Portland-stone gentlemen's club: a columned porch under a balcony, brass gas lamps, a lit entrance, a copper mansard
import * as THREE from 'three';
import { building, styleMat, wallQuads } from './archetypes.js';
import { adder, boxGeo, cyl, tilted, sphere, cone, torus, Glow, lamps, lightUp, columns, steps, balustrade, railing, course, awning, wedge } from './lvlkit.js';

// ------------------------------------------------------------------ L0
export function shed(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group(), add = adder(h);
  const w = 0.23, d = 0.26, wh = 0.15;
  h.add(building('coalshed', { x: 0, z: 0, w, d, h: wh, roof: 'none', boarded: true, dim: 1, sides: true }, null));
  wedge(add, 0, wh, 0, w, d, 0.012, 0.075, 'tinold', 'sooty', 0.025);                                  // a lean-to roof of tin, high at the back
  add(boxGeo(0.07, 0.1, 0.012, -0.05, 0, -0.012), 'dark');                                         // the coal door, boarded
  add(tilted(boxGeo(0.08, 0.01, 0.01, -0.05, 0.05, -0.02), 0.5, -0.05, 0.05, -0.02), 'plank');
  add(tilted(boxGeo(0.08, 0.01, 0.01, -0.05, 0.03, -0.02), -0.4, -0.05, 0.03, -0.02), 'plank');
  add(tilted(boxGeo(0.07, 0.006, 0.05, 0.02, wh + 0.04, d * 0.3), 0.7, 0.02, wh + 0.04, d * 0.3), 'tin');   // a sheet blown half off
  add(tilted(cyl(0.011, 0.012, 0.12, 0.07, wh + 0.07, d * 0.75), -0.22, 0.07, wh + 0.07, d * 0.75), 'iron');   // a bent flue
  add(cone(0.075, 0.06, w / 2 + 0.07, 0, -0.03, 7), 'black');                                      // the coal heap
  for (const [dx, dz, r] of [[0.03, -0.07, 0.014], [0.11, 0.0, 0.012], [0.0, 0.03, 0.011]]) add(sphere(r, w / 2 + dx, r * 0.6, dz, 5), 'black');
  add(boxGeo(0.05, 0.035, 0.03, -w / 2 - 0.05, 0, -0.06), 'sooty');                                // a sack
  add(torus(0.032, 0.006, -w / 2 - 0.04, 0.036, 0.02, 0, 1.2), 'plank');                            // a cart wheel against the wall
  h.position.set(x, 0, z); h.rotation.set(0, -0.12, -0.05);
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.02, zf: z };
  return g;
}

// ------------------------------------------------------------------ L1
export function cottage(o) {
  const glow = o.glowKey, { x = 0, z = 0.12 } = o, g = new THREE.Group(), add = adder(g), w = 0.37, d = 0.5, gh = 0.2, wh = 0.4;
  g.add(building('brick', { x, z, w, d, h: wh, ground: 'door', gn: 1, gh, roof: 'gable', rh: 0.16, roofMat: 'slate', lit: 0.8, stacks: [x - 0.13, x + 0.13], glowKey: glow, ...o }, glow));
  const dx = x - w / 2 + w * 0.21;                                                                 // the door is a fifth along the front
  steps(add, dx, z, 0.1, 2, 'limestone');
  railing(add, x - w / 2 + 0.01, dx - 0.07, 0, z - 0.1, 0.05); railing(add, dx + 0.07, x + w / 2 - 0.01, 0, z - 0.1, 0.05);   // area railings with a gap for the gate
  add(boxGeo(0.01, 0.06, 0.01, dx - 0.07, 0, z - 0.1), 'iron'); add(boxGeo(0.01, 0.06, 0.01, dx + 0.07, 0, z - 0.1), 'iron');
  add(boxGeo(0.12, 0.018, 0.03, x + 0.1, 0.1, z - 0.02), 'wood'); add(boxGeo(0.11, 0.012, 0.026, x + 0.1, 0.118, z - 0.02), 'leaf');   // a window box
  add(cyl(0.02, 0.018, 0.055, x + w / 2 - 0.03, 0, z - 0.07, 8), 'tin');                           // a dustbin
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2
export function terrace(o) {
  const glow = o.glowKey, { x = 0, z = 0.1 } = o, g = new THREE.Group(), add = adder(g), w = 0.55, hw = w / 2, d = 0.62, wh = 0.6;
  const common = { z, w: hw, d, h: wh, gh: 0.2, gn: 1, roof: 'gable', rh: 0.12, roofMat: 'slate', lit: 0.6, glowKey: glow, ...o };
  g.add(building('brick', { ...common, x: x - hw / 2, ground: 'door', stacks: [x - hw + 0.03, x] }, glow));
  g.add(building('brick', { ...common, x: x + hw / 2, ground: 'shop', stacks: [x + hw - 0.03] }, glow));
  steps(add, x - hw / 2 - 0.04, z, 0.09, 2, 'limestone');
  awning(g, { x: x + hw / 2, y: 0.18, z, w: hw - 0.02, d: 0.09, drop: 0.045, a: '#1f3a2e', b: '#c7bda4' });   // the corner shop's green awning
  add(boxGeo(hw, 0.012, 0.02, x + hw / 2, 0.19, z - 0.012), 'limestone');
  for (const [dx, dz, s] of [[0.05, 0.04, 1], [0.1, 0.04, 1]]) add(boxGeo(0.045 * s, 0.04, 0.04, x + hw + dx - 0.03, 0, z - 0.1 - dz * 0.2), 'wood');   // crates out front
  add(cyl(0.022, 0.024, 0.09, x + w / 2 + 0.07, 0, z - 0.03, 10), 'red'); add(sphere(0.022, x + w / 2 + 0.07, 0.09, z - 0.03, 10), 'red');   // a pillar box
  add(boxGeo(0.014, 0.007, 0.002, x + w / 2 + 0.07, 0.05, z - 0.053), 'black');
  g.userData.roof = { x0: x - hw, x1: x + hw, top: wh, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3
// an oriel bay: a brick core, the façade tile on its front, stone above and below
function bay(g, glow, lit, x, y, z, w, depth, floors) {
  const add = adder(g), h = floors * 0.2;
  add(boxGeo(w, h, depth, x, y, z - depth / 2), 'brick');
  wallQuads(g, styleMat('brick', glow, { dim: 1, lit }), 'brick', w, h, 1, floors, x, y, z - depth - 0.002, Math.PI);
  add(boxGeo(w + 0.03, 0.016, depth + 0.03, x, y + h, z - depth / 2), 'limestone');
  add(boxGeo(w + 0.03, 0.016, depth + 0.03, x, y - 0.016, z - depth / 2), 'limestone');
  add(boxGeo(0.02, 0.05, depth * 0.7, x - w / 2, y - 0.066, z - depth / 2), 'limestone'); add(boxGeo(0.02, 0.05, depth * 0.7, x + w / 2, y - 0.066, z - depth / 2), 'limestone');   // corbels
}
export function mansion(o) {
  const glow = o.glowKey, { x = 0, z = 0.06 } = o, g = new THREE.Group(), add = adder(g), w = 0.8, d = 0.72, wh = 1.0;
  g.add(building('brick', { x, z, w, d, h: wh, ground: 'door', gn: 3, gh: 0.2, roof: 'gable', rh: 0.16, roofMat: 'slate', cornice: true, corniceMat: 'limestone', lit: 1, stoop: true, stacks: [x - 0.3, x - 0.1, x + 0.1, x + 0.3], glowKey: glow, ...o }, glow));
  for (const s of [-1, 1]) bay(g, glow, 1, x + s * 0.22, 0.2, z, 0.2, 0.07, 3);                       // two bays three floors tall
  course(add, x, 0.19, w + 0.04, z - 0.02, 'limestone', 0.02, 0.05);                              // string courses over the doors and under the top floor
  course(add, x, 0.8, w + 0.03, z - 0.012, 'limestone', 0.016, 0.04);
  for (const s of [-1, 1]) add(boxGeo(0.04, wh, 0.02, x + s * (w / 2 - 0.02), 0, z - 0.01), 'limestone');   // stone quoins at the ends
  for (const s of [-1, 1]) { add(boxGeo(0.12, 0.02, 0.08, x + s * 0.22, wh + 0.002, z + 0.025), 'limestone'); }   // sills above the bays
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}

// ------------------------------------------------------------------ L4: the club
export function club(o) {
  const glow = o.glowKey, { x = 0, z = 0.22 } = o, g = new THREE.Group(), add = adder(g);
  const w = 0.84, d = 0.6, top = 1.12, rh = 0.25, P = 0.13, pz = z - P;
  g.add(building('portland', { x, z, w, d, h: top, ground: 'lobby', gn: 1, gh: 0.3, roof: 'mansard', rh, lit: 1, glowKey: glow, ...o }, glow));
  // stone dressing: quoins, string courses, a deep cornice
  for (const s of [-1, 1]) add(boxGeo(0.05, top - 0.3, 0.02, x + s * (w / 2 - 0.025), 0.3, z - 0.01), 'portland');
  course(add, x, 0.3, w + 0.03, z - 0.014, 'portland', 0.025, 0.05);
  course(add, x, 0.82, w + 0.02, z - 0.012, 'portland', 0.016, 0.04);
  add(boxGeo(w + 0.08, 0.045, 0.1, x, top - 0.03, z - 0.05), 'portland');
  add(boxGeo(w + 0.05, 0.016, 0.12, x, top - 0.07, z - 0.05), 'limestone');
  // the porch: four columns carrying a stone balcony, steps up from the pavement
  steps(add, x, pz - 0.0, 0.58, 3, 'portland');
  add(boxGeo(0.54, 0.05, P + 0.02, x, 0, pz + P / 2), 'portland');
  columns(add, [-0.2, -0.07, 0.07, 0.2].map(c => x + c), 0.05, 0.45, pz + 0.04, { r: 0.019, shaft: 'portland', cap: 'limestone', w: 0.055 });
  add(boxGeo(0.56, 0.03, P + 0.03, x, 0.5, pz + P / 2 - 0.005), 'portland');
  balustrade(add, x - 0.27, x + 0.27, 0.53, pz - 0.006, 'portland', 14);
  for (const s of [-1, 1]) add(boxGeo(0.012, 0.045, 0.1, x + s * 0.27, 0.53, pz + 0.05), 'portland');
  add(boxGeo(0.1, 0.2, 0.006, x, 0.06, z - 0.008), 'wine');                                       // the door under the porch
  add(boxGeo(0.12, 0.012, 0.012, x, 0.27, z - 0.012), 'gold');
  for (const s of [-1, 1]) add(boxGeo(0.008, 0.2, 0.01, x + s * 0.058, 0.06, z - 0.01), 'gold');
  new Glow('#ffd89a', 1.4).add(boxGeo(0.09, 0.04, 0.004, x, 0.285, z - 0.014)).flush(g);          // the lit fanlight
  // the roof: chimney stacks and a flagpole
  for (const s of [-0.3, -0.1, 0.1, 0.3]) { add(boxGeo(0.06, 0.13, 0.06, x + s, top + 0.12, z + 0.32, 2, 2), 'brick'); add(cyl(0.011, 0.014, 0.03, x + s - 0.012, top + 0.25, z + 0.32, 6), 'pot'); add(cyl(0.011, 0.014, 0.03, x + s + 0.012, top + 0.25, z + 0.32, 6), 'pot'); }
  add(cyl(0.003, 0.004, 0.3, x, top + rh - 0.01, z + 0.3, 4), 'iron'); add(boxGeo(0.07, 0.04, 0.003, x + 0.035, top + rh + 0.24, z + 0.3), 'cloth');
  // brass gas lamps by the steps, uplights and the wash they throw up the stone
  lamps(g, [-0.37, -0.29, 0.29, 0.37].map(c => [x + c, pz - 0.08]), { h: 0.26, style: 'lantern', color: '#ffd27a', post: 'brass' });
  lightUp(g, { x, w: w - 0.04, h: top - 0.12, wz: z - 0.035, fx: [-0.2, 0.2].map(c => x + c), fz: pz + 0.0, pz: pz - 0.1, pw: 0.8, pd: 0.3 });
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: top + 0.012, zf: z - 0.09 };
  return g;
}

export const LONDON_ARCH = { lshed: shed, lcottage: cottage, lterrace: terrace, lmansion: mansion, lclub: club };
