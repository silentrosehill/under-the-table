// The Harbour's six levels (size classes as in bowery.js: rust, tar, brick, sodium light):
//   0  a rusty tin shed on the quay: a leaning door sheet, oil drums, a coil of rope
//   1  a fisherman's hut and net store: nets drying on a frame, lobster pots, an upturned dinghy
//   2  a 3-storey brick warehouse with a hoist over the loft door
//   3  a big brick factory: saw-tooth roof, a small jib crane, (and a tall chimney, hchimney, placed beside it)
//   4  the shipping line's headquarters / customs house: grey stone, arched doors with brass lanterns, a clock tower, copper cap
import * as THREE from 'three';
import { building } from './archetypes.js';
import { adder, boxGeo, cyl, tilted, sphere, cone, torus, Glow, lamps, lightUp, steps, balustrade, railing, course, wedge, rooftop, net, arch, clockFace } from './lvlkit.js';

// ------------------------------------------------------------------ L0
export function tinshed(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group(), add = adder(h);
  const w = 0.23, d = 0.26, wh = 0.14;
  h.add(building('tinshed', { x: 0, z: 0, w, d, h: wh, roof: 'gable', rh: 0.06, roofMat: 'rust', boarded: true, dim: 1, sides: true }, null));
  add(tilted(boxGeo(0.12, 0.05, 0.008, w / 2 + 0.01, 0, -0.04), 0.5, w / 2 + 0.01, 0, -0.04), 'tinold');   // a door sheet leaning on the wall
  add(tilted(boxGeo(0.1, 0.006, 0.07, -0.03, wh + 0.045, d * 0.35), -0.4, -0.03, wh + 0.045, d * 0.35), 'tin');   // a rusted sheet curling off the roof
  add(cyl(0.022, 0.022, 0.058, -w / 2 - 0.04, 0, -0.04, 10), 'rust'); add(cyl(0.022, 0.022, 0.058, -w / 2 - 0.07, 0, 0.02, 10), 'tinold');
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.058, 10).rotateZ(Math.PI / 2).translate(-w / 2 - 0.045, 0.022, 0.07), 'rust');   // one drum on its side
  add(torus(0.03, 0.008, w / 2 + 0.07, 0.008, 0.06, -Math.PI / 2, 0), 'ochre');                       // a coil of rope
  add(cyl(0.012, 0.016, 0.05, w / 2 + 0.05, 0, -0.1, 8), 'black');                                    // a mooring bollard
  h.position.set(x, 0, z); h.rotation.set(0, 0.1, -0.04);
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.01, zf: z };
  return g;
}

// ------------------------------------------------------------------ L1
export function hut(o) {
  const glow = o.glowKey, { x = 0, z = 0.12 } = o, g = new THREE.Group(), add = adder(g), w = 0.37, d = 0.5, wh = 0.4;
  g.add(building('fisher', { x, z, w, d, h: wh, ground: 'door', gn: 1, gh: 0.2, roof: 'gable', rh: 0.15, roofMat: 'tar', lit: 0.8, stacks: [x + 0.12], glowKey: glow, ...o }, glow));
  for (const s of [-1, 1]) add(boxGeo(0.012, 0.2, 0.012, x + 0.27 + s * 0.1, 0, z - 0.02), 'wood');          // the net frame, a net hung between two posts
  add(boxGeo(0.22, 0.012, 0.012, x + 0.27, 0.19, z - 0.02), 'wood');
  net(g, { x: x + 0.27, y: 0.04, z: z - 0.02, w: 0.2, h: 0.15, tilt: -0.12 });
  for (const [dx, dz] of [[0.0, -0.1], [0.05, -0.12], [-0.02, -0.15]]) { add(cyl(0.022, 0.026, 0.035, x - 0.2 + dx, 0, z + dz, 8), 'wood'); add(new THREE.SphereGeometry(0.024, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x - 0.2 + dx, 0.035, z + dz), 'wood'); }   // lobster pots
  add(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.7, 0.7, 0.8).translate(x - 0.02, 0, z - 0.1), 'plank');   // an upturned dinghy
  add(boxGeo(0.1, 0.008, 0.012, x - 0.02, 0.043, z - 0.1), 'wood');
  add(boxGeo(0.008, 0.07, 0.008, x + w / 2 - 0.04, 0.17, z - 0.03), 'iron'); add(boxGeo(0.04, 0.006, 0.006, x + w / 2 - 0.055, 0.236, z - 0.03), 'iron');
  new Glow('#ff9a3c', 1.5).add(sphere(0.012, x + w / 2 - 0.075, 0.22, z - 0.03, 7)).flush(g);               // a storm lantern by the door
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2
export function warehouse(o) {
  const glow = o.glowKey, { x = 0, z = 0.1 } = o, g = new THREE.Group(), add = adder(g), w = 0.55, d = 0.62, wh = 0.62;
  g.add(building('brickwh', { x, z, w, d, h: wh, ground: 'garage', gn: 2, gh: 0.22, roof: 'gable', rh: 0.1, roofMat: 'slate', lit: 0.6, glowKey: glow, ...o }, glow));
  add(boxGeo(0.1, 0.13, 0.008, x, 0.42, z - 0.006), 'dark'); add(boxGeo(0.12, 0.012, 0.012, x, 0.55, z - 0.012), 'wood');   // the loft door, its lintel
  for (const s of [-1, 1]) add(boxGeo(0.008, 0.13, 0.012, x + s * 0.056, 0.42, z - 0.01), 'wood');
  add(boxGeo(0.014, 0.014, 0.16, x, 0.6, z - 0.075), 'iron'); add(boxGeo(0.014, 0.14, 0.014, x, 0.52, z - 0.01), 'iron');    // the hoist beam over the loft door, and its post
  add(torus(0.016, 0.004, x + 0.008, 0.6, z - 0.155, 0, Math.PI / 2), 'iron');
  add(boxGeo(0.003, 0.14, 0.003, x, 0.46, z - 0.155), 'iron'); add(boxGeo(0.024, 0.016, 0.024, x, 0.446, z - 0.155), 'iron');
  course(add, x, 0.22, w + 0.03, z - 0.012, 'concrete', 0.016, 0.03);
  for (const [dx, c] of [[-0.2, 'wood'], [-0.15, 'wood'], [0.2, 'rust']]) add(cyl(0.024, 0.024, 0.05, x + dx, 0, z - 0.06, 10), c);   // barrels on the quay
  add(boxGeo(0.06, 0.04, 0.05, x + 0.15, 0, z - 0.07), 'plank'); add(boxGeo(0.06, 0.04, 0.05, x + 0.2, 0, z - 0.1), 'plank');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.0, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3
export function factory(o) {
  const glow = o.glowKey, { x = 0, z = 0.06 } = o, g = new THREE.Group(), add = adder(g), w = 0.8, d = 0.72, wh = 1.0;
  g.add(building('brickwh', { x, z, w, d, h: wh, ground: 'garage', gn: 3, gh: 0.22, roof: 'saw', rh: 0.13, teeth: 3, roofMat: 'tar', cornice: true, corniceMat: 'concrete', lit: 1, glowKey: glow, ...o }, glow));
  course(add, x, 0.22, w + 0.03, z - 0.012, 'concrete', 0.016, 0.03); course(add, x, 0.62, w + 0.012, z - 0.006, 'concrete', 0.012, 0.02);
  // a small jib crane on the roof's front corner: a lattice mast, a boom reaching over the street, a hook
  const cx = x + 0.32, cz = z + 0.1, top = wh + 0.13 * 0.4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(boxGeo(0.008, 0.2, 0.008, cx + sx * 0.02, top, cz + sz * 0.02), 'rust');
  for (const yy of [0.06, 0.12, 0.18]) { add(boxGeo(0.044, 0.006, 0.006, cx, top + yy, cz - 0.02), 'steel'); add(boxGeo(0.044, 0.006, 0.006, cx, top + yy, cz + 0.02), 'steel'); }
  add(boxGeo(0.02, 0.02, 0.26, cx, top + 0.2, cz - 0.09), 'rust'); add(boxGeo(0.008, 0.008, 0.28, cx, top + 0.225, cz - 0.09), 'steel');
  add(boxGeo(0.05, 0.03, 0.05, cx, top + 0.2, cz + 0.06), 'tin');
  add(boxGeo(0.003, 0.12, 0.003, cx, top + 0.08, cz - 0.2), 'iron'); add(boxGeo(0.02, 0.014, 0.02, cx, top + 0.066, cz - 0.2), 'iron');
  rooftop(add, x - 0.2, wh + 0.13 * 0.5, z + 0.5, { vent: true });
  for (const k of [-1, 1]) add(boxGeo(0.02, 0.02, 0.012, x + k * 0.2, 0.34, z - 0.014), 'iron');
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.012, zf: z };
  return g;
}
export function chimney(o) {                                         // a tall tapering brick stack with a concrete cap (o.smoke: the smoke rises from it)
  const { x = 0.3, z = 0.6 } = o, g = new THREE.Group(), add = adder(g);
  add(boxGeo(0.12, 0.05, 0.12, x, 0, z), 'concrete');
  add(cyl(0.03, 0.05, 1.2, x, 0.05, z, 12), 'brick');
  add(cyl(0.038, 0.034, 0.03, x, 1.25, z, 12), 'concrete');
  for (const yy of [0.4, 0.8, 1.1]) add(cyl(0.04, 0.04, 0.008, x, yy, z, 12), 'iron');
  g.userData.roof = null;
  return g;
}

// ------------------------------------------------------------------ L4: the customs house
export function customs(o) {
  const glow = o.glowKey, { x = 0, z = 0.22 } = o, g = new THREE.Group(), add = adder(g);
  const w = 0.84, d = 0.6, top = 1.1, tw = 0.24, tz = z + 0.1, tbase = top, tH = 0.42;
  g.add(building('customs', { x, z, w, d, h: top, ground: 'lobby', gn: 1, gh: 0.3, roof: 'gable', rh: 0.14, roofMat: 'copper', lit: 1, glowKey: glow, ...o }, glow));
  g.add(building('customs', { ...o, x, z: tz, w: tw, d: 0.26, y: tbase, h: tH, roof: 'flat', parapet: false, sides: true, lit: 1, glowKey: glow }, glow));      // the clock tower
  for (const s of [-1, 1]) add(boxGeo(0.05, top - 0.3, 0.02, x + s * (w / 2 - 0.025), 0.3, z - 0.01), 'portland');      // heavy stone corners
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) add(boxGeo(0.06, 0.03, 0.028, x + s * (w / 2 - 0.03), 0.34 + k * 0.12, z - 0.012), 'limestone');   // quoin blocks
  course(add, x, 0.3, w + 0.03, z - 0.014, 'portland', 0.025, 0.05); course(add, x, 0.74, w + 0.01, z - 0.008, 'portland', 0.014, 0.03);
  add(boxGeo(w + 0.07, 0.045, 0.1, x, top - 0.03, z - 0.05), 'portland'); add(boxGeo(w + 0.04, 0.014, 0.11, x, top - 0.065, z - 0.05), 'limestone');
  // a stone loggia of three arched doors with brass lanterns in them, steps across the front
  const P = 0.1, pz = z - P;
  add(boxGeo(0.62, 0.3, P, x, 0, pz + P / 2), 'portland');
  add(boxGeo(0.66, 0.025, P + 0.02, x, 0.3, pz + P / 2), 'limestone');
  for (const dx of [-0.2, 0, 0.2]) arch(add, x + dx, 0.03, pz - 0.0, 0.1, 0.22, 'limestone', 'dark');
  const lan = new Glow('#ffb25e', 1.7);
  for (const dx of [-0.2, 0, 0.2]) { lan.add(boxGeo(0.02, 0.035, 0.02, x + dx, 0.15, pz - 0.014)); add(boxGeo(0.004, 0.05, 0.004, x + dx, 0.19, pz - 0.014), 'brass'); }
  lan.flush(g);
  new Glow('#ffb25e', 1.2).add(boxGeo(0.5, 0.006, 0.004, x, 0.285, pz - 0.006)).flush(g);
  steps(add, x, pz - 0.0, 0.7, 3, 'portland');
  // the tower: cornice, a clock, a copper pyramid, a weathervane
  clockFace(g, { x, y: tbase + 0.22, z: tz - 0.004, r: 0.075 });
  add(boxGeo(tw + 0.04, 0.025, 0.3, x, tbase + tH, tz + 0.12), 'portland');
  add(new THREE.ConeGeometry(0.2, 0.2, 4).rotateY(Math.PI / 4).translate(x, tbase + tH + 0.025 + 0.1, tz + 0.12), 'copper');
  add(cyl(0.003, 0.004, 0.14, x, tbase + tH + 0.2, tz + 0.12, 4), 'brass'); add(boxGeo(0.08, 0.02, 0.004, x, tbase + tH + 0.3, tz + 0.12), 'brass');
  // flags on the cornice corners
  for (const s of [-1, 1]) { add(cyl(0.003, 0.004, 0.22, x + s * 0.4, top, z - 0.04, 4), 'iron'); add(boxGeo(0.002, 0.04, 0.07, x + s * 0.4, top + 0.17, z - 0.07), 'cloth'); }
  lamps(g, [-0.39, 0.39].map(c => [x + c, pz - 0.1]).concat([[x - 0.3, pz - 0.1], [x + 0.3, pz - 0.1]]), { h: 0.26, style: 'lantern', color: '#ff9a3c', post: 'iron' });
  lightUp(g, { x, w: w - 0.04, h: top - 0.1, wz: z - 0.035, fx: [-0.3, 0.3].map(c => x + c), fz: pz + 0.0, pz: pz - 0.12, pw: 0.85, pd: 0.3 });
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: top + 0.014, zf: z - 0.08 };
  return g;
}

export const HARBOUR_ARCH = { hshed: tinshed, hhut: hut, hwarehouse: warehouse, hfactory: factory, hchimney: chimney, hcustoms: customs };
