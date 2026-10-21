// Tokyo's six levels (size classes as in bowery.js: slim concrete towers, wood, tin, neon):
//   0  a ramshackle tin yatai: a handcart stall, torn noren, a dead lantern
//   1  a small wooden 2-storey house with a paper lantern and a vending machine
//   2  a narrow 3-storey shop-house with a slimmer neighbour (districts.js hangs the vertical signs)
//   3  a big narrow tower flanked by two slivers, stacked with neon
//   4  a luxury department-store tower: polished stone, brass fins, a lantern-lit entrance and an illuminated sign crown
import * as THREE from 'three';
import { building } from './archetypes.js';
import { adder, boxGeo, cyl, tilted, sphere, ellipsoid, cone, torus, Glow, lamps, lightUp, columns, steps, railing, course, wedge, rooftop } from './lvlkit.js';

// ------------------------------------------------------------------ L0
export function yatai(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group(), add = adder(h);
  const w = 0.22, d = 0.24, wh = 0.13;
  h.add(building('yatai', { x: 0, z: 0, w, d, h: wh, roof: 'none', boarded: true, dim: 1, sides: true }, null));
  wedge(add, 0, wh, 0, w, d, 0.012, 0.045, 'tinold', 'tinold', 0.03);                                // a tin lid, tilted
  add(tilted(boxGeo(0.12, 0.006, 0.09, 0.03, wh + 0.045, d * 0.4), -0.5, 0.03, wh + 0.045, d * 0.4), 'tin');   // a loose sheet
  for (const s of [-1, 1]) {                                                                         // cart wheels and handles
    add(torus(0.036, 0.006, s * (w / 2 + 0.014), 0.036, 0.07, 0, Math.PI / 2), 'wood');
    add(new THREE.BoxGeometry(0.008, 0.008, 0.2).rotateX(0.2).translate(s * 0.07, 0.04, -0.12), 'plank');
  }
  for (const [dx, c] of [[-0.035, 'wine'], [0, 'sooty'], [0.035, 'cloth']]) add(boxGeo(0.03, 0.065 - Math.abs(dx), 0.004, dx, 0.055, -0.022), c);   // torn noren strips
  add(sphere(0.02, -w / 2 - 0.0, 0.1, -0.05, 8), 'wine');                                            // a lantern that has gone out
  add(boxGeo(0.05, 0.04, 0.04, w / 2 + 0.07, 0, -0.04), 'ochre'); add(boxGeo(0.05, 0.04, 0.04, w / 2 + 0.07, 0.04, -0.04), 'ochre');   // beer crates
  h.position.set(x, 0, z); h.rotation.set(0, -0.1, 0.05);
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.045, zf: z };
  return g;
}

// ------------------------------------------------------------------ L1
export function house(o) {
  const glow = o.glowKey, { x = 0, z = 0.12 } = o, g = new THREE.Group(), add = adder(g), w = 0.37, d = 0.5, wh = 0.34;
  g.add(building('machiya', { x, z, w, d, h: wh, ground: 'door', gn: 1, gh: 0.17, roof: 'gable', rh: 0.14, roofMat: 'tile', lit: 0.8, glowKey: glow, ...o }, glow));
  add(boxGeo(w + 0.06, 0.01, 0.05, x, wh - 0.004, z - 0.03), 'wood');                                 // eaves
  add(boxGeo(w + 0.06, 0.008, 0.04, x, 0.17, z - 0.02), 'wood');                                      // the shop-front awning ledge
  const lan = new Glow('#ff7a3a', 1.5);
  lan.add(ellipsoid(0.02, 0.026, 0.02, x - w / 2 + 0.07, 0.15, z - 0.045, 9)); lan.add(sphere(0.014, x + 0.0, 0.2, z - 0.05, 8)); lan.flush(g);   // two paper lanterns
  add(boxGeo(0.07, 0.008, 0.008, x - w / 2 + 0.07, 0.185, z - 0.045), 'iron'); add(boxGeo(0.07, 0.008, 0.008, x, 0.235, z - 0.05), 'iron');
  add(boxGeo(0.05, 0.1, 0.04, x + w / 2 - 0.035, 0, z - 0.04), 'steel');                                // a drinks machine, lit
  new Glow('#cfe4ff', 1.2).add(boxGeo(0.034, 0.06, 0.004, x + w / 2 - 0.035, 0.03, z - 0.062)).flush(g);
  add(cyl(0.016, 0.014, 0.04, x - w / 2 + 0.03, 0, z - 0.1, 8), 'terracotta'); add(sphere(0.022, x - w / 2 + 0.03, 0.06, z - 0.1, 8), 'leaf');   // a potted shrub
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2
function acUnits(add, x, y, z, n, w) {                              // air-conditioner boxes hung on a façade
  for (let k = 0; k < n; k++) { const ux = x + (k % 2 ? 0.3 : -0.3) * w, uy = y + (k >> 1) * 0.2; add(boxGeo(0.035, 0.022, 0.03, ux, uy, z - 0.014), 'concrete'); add(boxGeo(0.028, 0.012, 0.004, ux, uy + 0.004, z - 0.03), 'dark'); }
}
export function shophouse(o) {
  const glow = o.glowKey, { x = 0, z = 0.1 } = o, g = new THREE.Group(), add = adder(g), d = 0.62;
  const mx = x + 0.095, nx = x - 0.18;                                                                // a 0.36 shop-house and a 0.19 sliver beside it
  const common = { z, d, roof: 'flat', roofMat: 'tar', parapetH: 0.025, parapetMat: 'concrete', ground: 'arcade', glowKey: glow, lit: 0.6, ...o };
  g.add(building('tokyo', { ...common, x: mx, w: 0.36, h: 0.62, gn: 2 }, glow));
  g.add(building('tokyo', { ...common, x: nx, w: 0.19, h: 0.46, gn: 1, d: 0.56, z: z + 0.02 }, glow));
  acUnits(add, mx, 0.28, z, 4, 0.36); acUnits(add, nx, 0.26, z + 0.02, 2, 0.19);
  add(boxGeo(0.01, 0.62, 0.01, mx + 0.17, 0, z - 0.012), 'iron');                                       // a drainpipe
  rooftop(add, mx, 0.62, z + 0.3, { tank: true, vent: false });
  rooftop(add, nx, 0.46, z + 0.3, { vent: true });
  g.userData.roof = { x0: x - 0.275, x1: x + 0.275, top: 0.62 + 0.025, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3
export function tower(o) {
  const glow = o.glowKey, { x = 0, z = 0.06 } = o, g = new THREE.Group(), add = adder(g);
  const common = { z, roof: 'flat', roofMat: 'tar', parapetH: 0.03, parapetMat: 'concrete', ground: 'arcade', gn: 1, glowKey: glow, lit: 1, ...o };
  g.add(building('tokyo', { ...common, x, w: 0.46, d: 0.72, h: 1.2, gn: 2 }, glow));                  // the tower
  g.add(building('tokyo', { ...common, x: x - 0.315, w: 0.17, d: 0.64, h: 0.9 }, glow));              // two slivers
  g.add(building('tokyo', { ...common, x: x + 0.315, w: 0.17, d: 0.6, h: 0.72 }, glow));
  acUnits(add, x, 0.34, z, 6, 0.46); acUnits(add, x - 0.315, 0.3, z, 4, 0.17); acUnits(add, x + 0.315, 0.3, z, 2, 0.17);
  rooftop(add, x, 1.2, z + 0.35, { tank: true, stack: false });
  add(cyl(0.004, 0.006, 0.28, x - 0.12, 1.2, z + 0.3, 5), 'iron'); add(boxGeo(0.07, 0.004, 0.004, x - 0.12, 1.4, z + 0.3), 'iron'); add(boxGeo(0.05, 0.004, 0.004, x - 0.12, 1.34, z + 0.3), 'iron');
  new Glow('#ff3a2a', 1.6).add(sphere(0.008, x - 0.12, 1.485, z + 0.3, 6)).flush(g);                    // the aircraft light, the only red up there
  rooftop(add, x - 0.315, 0.9, z + 0.3, { vent: true }); rooftop(add, x + 0.315, 0.72, z + 0.3, { vent: true, tank: true });
  g.userData.roof = { x0: x - 0.4, x1: x + 0.4, top: 1.2 + 0.03, zf: z };
  return g;
}

// ------------------------------------------------------------------ L4: the department store
export function store(o) {
  const glow = o.glowKey, { x = 0, z = 0.22 } = o, g = new THREE.Group(), add = adder(g);
  const w = 0.84, d = 0.6, top = 1.15, tw = 0.62, ttop = 1.35;
  g.add(building('dept', { x, z, w, d, h: top, ground: 'lobby', gn: 1, gh: 0.3, roof: 'flat', roofMat: 'polished', parapet: false, lit: 1, glowKey: glow, ...o }, glow));
  g.add(building('dept', { ...o, x, z: z + 0.07, w: tw, d: 0.46, y: top, h: ttop - top, roof: 'flat', roofMat: 'polished', parapet: false, sides: true, lit: 1, glowKey: glow }, glow));
  for (let k = 0; k <= 4; k++) add(boxGeo(0.014, top - 0.3, 0.02, x - 0.42 + k * 0.21, 0.3, z - 0.01), 'brass');       // brass fins between the glass bays
  add(boxGeo(w + 0.05, 0.03, 0.07, x, top - 0.02, z - 0.04), 'polished'); add(boxGeo(w + 0.05, 0.01, 0.075, x, top + 0.01, z - 0.04), 'brass');
  add(boxGeo(tw + 0.04, 0.02, 0.05, x, ttop - 0.01, z + 0.07 - 0.03), 'polished'); add(boxGeo(tw + 0.04, 0.008, 0.052, x, ttop + 0.01, z + 0.07 - 0.03), 'brass');
  new Glow('#ff5200', 2.1).add(boxGeo(w + 0.05, 0.012, 0.012, x, top + 0.02, z - 0.075)).add(boxGeo(tw + 0.04, 0.012, 0.012, x, ttop + 0.02, z + 0.07 - 0.06)).add(boxGeo(0.012, ttop - top, 0.012, x - tw / 2, top, z + 0.07 - 0.06)).add(boxGeo(0.012, ttop - top, 0.012, x + tw / 2, top, z + 0.07 - 0.06)).flush(g);       // the orange neon crown
  // the entrance: a deep brass canopy lit from beneath, three red-gold lanterns, two steps
  const cz = z - 0.14;
  add(boxGeo(0.52, 0.02, 0.14, x, 0.335, cz + 0.07), 'brass'); add(boxGeo(0.54, 0.014, 0.012, x, 0.34, cz - 0.003), 'gold');
  for (const s of [-1, 1]) add(cyl(0.006, 0.006, 0.335, x + s * 0.24, 0, cz + 0.01, 6), 'brass');
  new Glow('#ffe0a8', 1.5).add(boxGeo(0.46, 0.004, 0.1, x, 0.329, cz + 0.07)).flush(g);
  const lan = new Glow('#ff7a3a', 1.6);
  for (const lx of [-0.15, 0, 0.15]) lan.add(ellipsoid(0.019, 0.024, 0.019, x + lx, 0.28, cz + 0.05, 9));
  lan.flush(g);
  steps(add, x, cz - 0.0, 0.56, 2, 'polished');
  // the sign crown: a brass frame on the tower roof (districts.js sets the lit board in it)
  const fz = z + 0.07 + 0.02, fh = 0.22;
  for (const s of [-1, 1]) add(boxGeo(0.012, fh, 0.012, x + s * 0.27, ttop, fz), 'brass');
  add(boxGeo(0.56, 0.014, 0.014, x, ttop + fh, fz), 'brass'); add(boxGeo(0.56, 0.01, 0.014, x, ttop + 0.004, fz), 'brass');
  for (let k = 1; k < 4; k++) add(boxGeo(0.008, fh, 0.008, x - 0.27 + k * 0.135, ttop, fz + 0.01), 'brass');
  add(cyl(0.004, 0.006, 0.16, x + 0.2, ttop + fh, fz, 5), 'brass');
  lamps(g, [[x - 0.35, cz - 0.02], [x + 0.35, cz - 0.02]], { h: 0.24, style: 'lantern', color: '#ffe1b0', post: 'brass' });
  lightUp(g, { x, w: w - 0.04, h: top - 0.1, wz: z - 0.035, fx: [-0.3, 0.3].map(c => x + c), fz: cz - 0.03, pz: cz - 0.1, pw: 0.85, pd: 0.3 });
  g.userData.roof = { x0: x - tw / 2, x1: x + tw / 2, top: ttop + 0.012, zf: z + 0.07 - 0.03 };
  return g;
}

export const TOKYO_ARCH = { tyatai: yatai, thouse: house, tshop: shophouse, ttower: tower, tstore: store };
