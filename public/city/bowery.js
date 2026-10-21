// The Bowery's six levels: ONE main building per level, same size class everywhere (docs/CORRECTION_PLAN.md).
//   0  a crooked plank shack, ~25% of the lot, with a FOR SALE board planted in front
//   1  a clapboard workman's cottage, ~40%, pitched roof, a stoop
//   2  a narrow walk-up with a pawn shop at street level, ~60%, three floors
//   3  a big tenement block, ~85%, six floors, fire escapes (districts.js adds them) and a water tank
//   4  the grand old savings bank, ~90%, tallest: limestone, a columned portico, a dome, a lit entrance
// Each piece is a code-built Group (like archetypes.js) so a lot still bakes into a few meshes. Lot coordinates as in
// districts.js: x across, z from the kerb to the back, fronts face −z. userData.roof tells cityScene where the owner's cornice goes.
import * as THREE from 'three';
import { building, solid, boxGeo, mesh, V, Soup, canvasTexture } from './archetypes.js';
import { groundClip } from './kit.js';

export const cyl = (r0, r1, h, x, y, z, seg = 10) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y + h / 2, z);
export const tilted = (geo, rz, px, py, pz) => geo.translate(-px, -py, -pz).rotateZ(rz).translate(px, py, pz);   // lean a piece about a point

// ------------------------------------------------------------------ L0: the shack and its sign
export function shack(o) {
  const { x = -0.12, z = 0.2 } = o, g = new THREE.Group(), h = new THREE.Group();
  const w = 0.23, d = 0.26, wh = 0.14;
  h.add(building('shack', { x: 0, z: 0, w, d, h: wh, roof: 'gable', rh: 0.07, roofMat: 'rust', boarded: true, dim: 1, sides: true }, null));
  const dk = solid('dark'), tin = solid('tin'), pl = solid('plank');
  h.add(mesh(boxGeo(0.052, 0.098, 0.012, -0.055, 0, -0.012), dk));                                    // the door, hanging off its hinge
  h.add(mesh(tilted(boxGeo(0.07, 0.01, 0.01, -0.055, 0.045, -0.02), 0.5, -0.055, 0.045, -0.02), pl));  // two boards nailed across it
  h.add(mesh(tilted(boxGeo(0.07, 0.01, 0.01, -0.055, 0.05, -0.02), -0.45, -0.055, 0.05, -0.02), pl));
  h.add(mesh(tilted(boxGeo(0.13, 0.008, 0.07, 0.03, wh + 0.012, d * 0.5 - 0.02), 0.2, 0.03, wh, 0), tin));   // a sheet of tin patching the roof
  h.add(mesh(tilted(cyl(0.011, 0.011, 0.11, 0.07, wh + 0.03, d * 0.7), -0.24, 0.07, wh + 0.03, d * 0.7), tin));   // a stovepipe, leaning
  h.add(mesh(tilted(boxGeo(0.014, 0.17, 0.03, w / 2 + 0.03, 0, 0.04), 0.35, w / 2 + 0.03, 0, 0.04), pl));   // a plank propping the wall
  h.add(mesh(boxGeo(0.06, 0.04, 0.05, w / 2 + 0.08, 0, -0.04), pl));                                  // a crate
  h.add(mesh(cyl(0.022, 0.02, 0.06, -w / 2 - 0.05, 0, -0.03, 8), solid('rust')));                      // a battered bin
  h.position.set(x, 0, z);
  h.rotation.set(0, 0.1, 0.045);                                                                       // sagging towards one corner
  g.add(h);
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.01, zf: z };
  return g;
}

let saleMat = null;
const saleMaterial = () => saleMat ||= (() => {
  const map = canvasTexture(256, 192, (g, W, H) => {
    g.fillStyle = '#d9d1bd'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(60,45,30,${Math.random() * 0.12})`; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 14, 2 + Math.random() * 6); }
    g.strokeStyle = '#a3241c'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = '#a3241c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 78px Oswald, Impact, "Arial Narrow", sans-serif'; g.fillText('FOR', W / 2, H * 0.3);
    g.font = 'bold 96px Oswald, Impact, "Arial Narrow", sans-serif'; g.fillText('SALE', W / 2, H * 0.7);
  });
  return new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.4, roughness: 0.7 });
})();
export function forsale(o) {                              // a board on two posts, planted behind the shack (the street's name plate lies in front), a little crooked
  const { x = 0.22, z = 0.1 } = o, g = new THREE.Group(), h = new THREE.Group();
  const bw = 0.32, bh = 0.24, by = 0.2, iron = solid('iron'), pl = solid('plank');
  for (const sx of [-1, 1]) h.add(mesh(boxGeo(0.014, by + 0.06, 0.014, sx * bw * 0.36, 0, 0), pl));
  h.add(mesh(boxGeo(bw + 0.02, bh + 0.02, 0.01, 0, by, 0.004), iron));
  const front = new THREE.PlaneGeometry(bw, bh).rotateY(Math.PI).translate(0, by + bh / 2, -0.003);
  h.add(mesh(front, saleMaterial()));
  h.add(mesh(new THREE.PlaneGeometry(bw, bh).translate(0, by + bh / 2, 0.011), saleMaterial()));
  h.position.set(x, 0, z + 0.5);
  h.rotation.set(0, 0.12, -0.1);
  g.add(h);
  return g;
}

// ------------------------------------------------------------------ L1: the cottage
export function cottage(o) {
  const glow = o.glowKey;
  const { x = 0, z = 0.12 } = o, g = new THREE.Group(), w = 0.37, d = 0.5, gh = 0.19, wh = gh + 0.17;
  g.add(building('cottage', { x, z, w, d, h: wh, ground: 'door', gh, roof: 'gable', rh: 0.17, roofMat: 'slate', lit: 0.8, stacks: [x + w * 0.3], glowKey: glow, ...o }, glow));
  const lime = solid('limestone'), iron = solid('iron'), dx = x - w / 2 + w * 0.21;           // the door is a fifth along the front
  for (let k = 0; k < 3; k++) g.add(mesh(boxGeo(0.12 + 0.02 * k, 0.02, 0.04, dx, k * 0.02, z - 0.02 - k * 0.04, 2, 1), lime));   // the stoop
  for (const sx of [-1, 1]) g.add(mesh(boxGeo(0.006, 0.07, 0.1, dx + sx * 0.065, 0.02, z - 0.07), iron));   // its rails
  g.add(mesh(cyl(0.022, 0.02, 0.065, x + w / 2 - 0.04, 0, z - 0.06, 8), solid('rust')));        // a dented bin by the step
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh, zf: z };
  return g;
}

// ------------------------------------------------------------------ L2: the pawn walk-up
export function walkup(o) {
  const glow = o.glowKey;
  const { x = 0, z = 0.1 } = o, g = new THREE.Group(), w = 0.55, d = 0.62, wh = 0.22 + 2 * 0.19;
  g.add(building('tenement', { x, z, w, d, h: wh, ground: 'pawn', gn: 1, roof: 'flat', roofMat: 'tar', parapetMat: 'brick', parapetH: 0.045, cornice: true, lit: 0.75, ...o }, glow));
  const brick = solid('brick');
  g.add(mesh(boxGeo(0.07, 0.14, 0.08, x + w * 0.28, wh, z + d * 0.55, 2, 2), brick));          // a chimney stack
  g.add(mesh(boxGeo(0.12, 0.05, 0.1, x - w * 0.22, wh, z + d * 0.4, 2, 2), solid('tin')));     // a roof vent
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.045, zf: z };
  return g;
}

// ------------------------------------------------------------------ L3: the tenement block
export function block(o) {
  const glow = o.glowKey;
  const { x = 0, z = 0.06 } = o, g = new THREE.Group(), w = 0.8, d = 0.72, wh = 0.22 + 5 * 0.19;
  g.add(building('tenement', { x, z, w, d, h: wh, ground: 'shop', gn: 2, roof: 'flat', roofMat: 'tar', parapetMat: 'brick', parapetH: 0.06, cornice: true, lit: 1, ...o }, glow));
  const brick = solid('brick'), lime = solid('limestone');
  g.add(mesh(boxGeo(w + 0.04, 0.02, 0.05, x, 0.22 - 0.01, z - 0.02), lime));                  // a string course over the shops
  g.add(mesh(boxGeo(0.1, 0.18, 0.1, x - 0.2, wh, z + d * 0.5, 2, 2), brick));                 // stair bulkhead
  g.add(mesh(boxGeo(0.07, 0.22, 0.07, x + 0.3, wh, z + d * 0.7, 2, 2), brick));               // chimney
  g.userData.roof = { x0: x - w / 2, x1: x + w / 2, top: wh + 0.06, zf: z };
  return g;
}

// ------------------------------------------------------------------ L4: the savings bank
let lampMat = null, washTex = null, poolTex = null;
export const lampMaterial = () => lampMat ||= new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: '#ffcf8a', emissiveIntensity: 1.8, roughness: 0.4, clippingPlanes: [groundClip] });
export const washMaterial = () => {                                // warm light thrown up the front from uplights at the foot of the steps
  washTex ||= canvasTexture(8, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,196,120,.9)'); gr.addColorStop(0.5, 'rgba(255,170,90,.32)'); gr.addColorStop(1, 'rgba(255,150,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  return new THREE.MeshBasicMaterial({ map: washTex, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: [groundClip] });
};
export const poolMaterial = () => {
  poolTex ||= canvasTexture(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,190,110,.8)'); gr.addColorStop(1, 'rgba(255,150,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  return new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: [groundClip] });
};
export function bank(o) {
  const glow = o.glowKey;
  const { x = 0, z = 0.22 } = o, g = new THREE.Group();
  const w = 0.84, d = 0.6, top1 = 1.15, atticH = 0.25, P = 0.14;       // main block width/depth/height, attic, how far the portico stands out
  const lime = solid('sootstone'), mar = solid('sootmarble'), gold = solid('gold'), brass = solid('brass'), iron = solid('iron'), cop = solid('copper');   // soot-black stone, brass and a verdigris dome
  g.add(building('bank', { x, z, w, d, h: top1, ground: 'lobby', gn: 1, gh: 0.32, roof: 'flat', roofMat: 'tar', parapet: false, lit: 1, ...o }, glow));
  g.add(building('bank', { x, z: z + 0.05, w: 0.62, d: d - 0.12, y: top1, h: atticH, roof: 'flat', roofMat: 'tar', parapet: false, sides: true, lit: 1, ...o }, glow));
  const add = (geo, m) => g.add(mesh(geo, m));
  // pilasters at the corners and a heavy cornice, then a balustrade along the roof
  for (const s of [-1, 1]) add(boxGeo(0.05, top1 - 0.32, 0.02, x + s * (w / 2 - 0.025), 0.32, z - 0.01), lime);
  add(boxGeo(w + 0.08, 0.05, 0.1, x, top1 - 0.03, z - 0.05), lime);
  add(boxGeo(w + 0.04, 0.02, 0.12, x, top1 - 0.075, z - 0.05), mar);
  add(boxGeo(w + 0.02, 0.012, 0.012, x, top1 + 0.02 + 0.03, z - 0.09), lime);
  for (let k = 0; k <= 20; k++) add(cyl(0.007, 0.007, 0.04, x - w / 2 + 0.02 + k * (w - 0.04) / 20, top1 + 0.002, z - 0.085, 5), mar);
  add(boxGeo(0.62, 0.02, 0.03, x, top1 + atticH - 0.02, z + 0.01), lime);                        // the attic's cornice
  // steps and the portico: giant columns, an entablature carrying the name, a pediment
  const pz = z - P;                                                                              // the portico's front
  for (let k = 0; k < 3; k++) add(boxGeo(0.66 - 0.03 * k, 0.02, 0.055, x, k * 0.02, pz - 0.055 + k * 0.022, 3, 1), lime);
  add(boxGeo(0.64, 0.06, P + 0.02, x, 0, pz + P / 2, 3, 1), lime);                               // the floor of the portico
  const ch = 0.72, cy0 = 0.06;
  for (const cx of [-0.31, -0.115, 0.115, 0.31]) {
    add(boxGeo(0.06, 0.02, 0.06, x + cx, cy0, pz + 0.04), mar);
    add(cyl(0.021, 0.025, ch - 0.06, x + cx, cy0 + 0.02, pz + 0.04, 12), mar);
    add(boxGeo(0.07, 0.04, 0.07, x + cx, cy0 + ch - 0.04, pz + 0.04), mar);
    add(boxGeo(0.085, 0.016, 0.085, x + cx, cy0 + ch - 0.004, pz + 0.04), lime);
  }
  const ey = cy0 + ch + 0.008, eh = 0.13, ew = 0.74;
  add(boxGeo(ew, eh, P + 0.02, x, ey, pz + P / 2, 3, 1), lime);                                  // entablature
  add(boxGeo(ew + 0.04, 0.02, P + 0.06, x, ey + eh, pz + P / 2 - 0.02, 3, 1), mar);
  add(boxGeo(ew + 0.01, 0.012, 0.012, x, ey + 0.002, pz - 0.006), gold);                         // a gold line under the name
  const ph = 0.15, py = ey + eh + 0.02, s = new Soup();                                           // pediment: two faces and a sloping cap
  const L = V(x - ew / 2 - 0.02, py, pz), R = V(x + ew / 2 + 0.02, py, pz), T = V(x, py + ph, pz), Lb = L.clone().setZ(pz + P), Rb = R.clone().setZ(pz + P), Tb = T.clone().setZ(pz + P);
  s.tri(L, R, T, V(0, 0, -1), 3, 3); s.tri(Lb, Rb, Tb, V(0, 0, 1), 3, 3);
  s.quad(L, T, Tb, Lb, V(-0.5, 1, 0), 3, 3); s.quad(T, R, Rb, Tb, V(0.5, 1, 0), 3, 3);
  add(s.geo(), lime);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16).rotateX(Math.PI / 2).translate(x, py + ph * 0.38, pz - 0.004), gold);   // a gilt roundel in the pediment
  // the entrance: a brass canopy between the inner columns, a gilt door surround
  add(boxGeo(0.2, 0.016, 0.09, x, 0.34, pz + 0.045), brass);
  add(boxGeo(0.21, 0.02, 0.008, x, 0.33, pz + 0.002), gold);
  for (const sx of [-1, 1]) add(boxGeo(0.006, 0.2, 0.006, x + sx * 0.095, 0.14, pz + 0.04), gold);
  // a dome behind: a drum, the copper dome, a lantern and a finial
  const dz = z + d * 0.52, dy = top1 + atticH;
  add(cyl(0.16, 0.17, 0.12, x, dy, dz, 20), lime);
  add(cyl(0.165, 0.165, 0.014, x, dy + 0.12, dz, 20), mar);
  add(new THREE.SphereGeometry(0.155, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, dy + 0.134, dz), cop);
  add(cyl(0.032, 0.036, 0.09, x, dy + 0.134 + 0.15, dz, 10), brass);
  add(new THREE.ConeGeometry(0.04, 0.07, 10).translate(x, dy + 0.134 + 0.15 + 0.09 + 0.035, dz), gold);
  add(cyl(0.004, 0.004, 0.07, x, dy + 0.134 + 0.15 + 0.16, dz, 4), gold);
  for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.022, 8, 6).translate(x + sx * 0.3, top1 + atticH + 0.03, z + 0.06), lime);   // urns on the attic corners
  // lamps at the foot of the steps, warm uplights, and the glow they throw up the front and onto the pavement
  for (const sx of [-1, 1]) {
    const lx = x + sx * 0.33, lz = pz - 0.1;
    add(cyl(0.012, 0.018, 0.04, lx, 0, lz, 8), iron); add(cyl(0.005, 0.008, 0.2, lx, 0.04, lz, 6), iron);
    const globe = mesh(new THREE.SphereGeometry(0.026, 10, 8).translate(lx, 0.27, lz), lampMaterial()); globe.userData.keep = true; g.add(globe);
    add(boxGeo(0.05, 0.012, 0.03, x + sx * 0.2, 0, pz + 0.01), iron);
    const up = mesh(boxGeo(0.045, 0.01, 0.02, x + sx * 0.2, 0.012, pz + 0.01), lampMaterial()); up.userData.keep = true; g.add(up);
  }
  const wash = mesh(new THREE.PlaneGeometry(w - 0.04, top1 - 0.1).rotateY(Math.PI).translate(x, (top1 - 0.1) / 2 + 0.05, z - 0.03), washMaterial());
  wash.userData.keep = true; g.add(wash);
  const pool = mesh(new THREE.PlaneGeometry(0.8, 0.34).rotateX(-Math.PI / 2).translate(x, 0.004, pz - 0.1), poolMaterial());
  pool.userData.keep = true; g.add(pool);
  g.userData.roof = { x0: x - ew / 2, x1: x + ew / 2, top: ey + eh + 0.02, zf: pz };
  return g;
}

export const BOWERY_ARCH = { bshack: shack, bsale: forsale, bcottage: cottage, bwalkup: walkup, bblock: block, bbank: bank };
