// Shared bits for the six building levels of every district (bowery.js, london.js, paris.js, tokyo.js, downtown.js, harbour.js, canal.js, luxe.js).
// The Bowery is the size reference (docs/CORRECTION_PLAN.md): the same level is the same footprint and height class in every district, only the architecture changes.
// Lot coordinates as in districts.js: x across, z from the kerb to the back, fronts face −z. Every piece is a code-built Group so a lot bakes into a few meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { solid, boxGeo, mesh, V, Soup, canvasTexture } from './archetypes.js';
import { groundClip } from './kit.js';
import { cyl, tilted, lampMaterial, washMaterial, poolMaterial } from './bowery.js';

export { cyl, tilted, boxGeo, mesh, solid, V, Soup, canvasTexture };
export { forsale } from './bowery.js';

// width × depth × wall height of the main building per level (measured from the Bowery); L4 may carry a crown (dome, tower, spire) on top
export const SIZE = [{ w: 0.23, d: 0.26, h: 0.14 }, { w: 0.37, d: 0.5, h: 0.36 }, { w: 0.55, d: 0.62, h: 0.6 }, { w: 0.8, d: 0.72, h: 1.17 }, { w: 0.84, d: 0.6, h: 1.4 }];

// a mesh adder: add(geometry, 'brass' | material)
export const adder = g => (geo, m) => { const o = mesh(geo, typeof m === 'string' ? solid(m) : m); g.add(o); return o; };
export const roofOf = (x0, x1, top, zf) => ({ x0, x1, top, zf });
export const sphere = (r, x, y, z, seg = 10) => new THREE.SphereGeometry(r, seg, Math.max(5, seg - 2)).translate(x, y, z);
export const ellipsoid = (rx, ry, rz, x, y, z, seg = 10) => new THREE.SphereGeometry(1, seg, Math.max(5, seg - 2)).scale(rx, ry, rz).translate(x, y, z);
export const cone = (r, h, x, y, z, seg = 8) => new THREE.ConeGeometry(r, h, seg).translate(x, y + h / 2, z);
export const torus = (R, r, x, y, z, rx = 0, ryy = 0) => new THREE.TorusGeometry(R, r, 6, 14).rotateX(rx).rotateY(ryy).translate(x, y, z);

// ------------------------------------------------------------------ light that stays on (lamps, lanterns, lit door glass): one merged glowing mesh per colour
const glowMats = new Map();
export const glowMat = (color = '#ffcf8a', k = 1.8) => {
  const key = color + k;
  if (!glowMats.has(key)) glowMats.set(key, new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: color, emissiveIntensity: k, roughness: 0.4, clippingPlanes: [groundClip] }));
  return glowMats.get(key);
};
export class Glow {
  constructor(color, k) { this.color = color; this.k = k; this.geos = []; }
  add(geo) { this.geos.push(geo); return this; }
  flush(g) {
    if (!this.geos.length) return;
    const m = mesh(mergeGeometries(this.geos), glowMat(this.color, this.k));
    m.userData.keep = true; g.add(m); this.geos = [];
  }
}

// lamp posts: iron post and a glowing globe (or a lantern with a cap)
export function lamps(g, pts, { h = 0.2, style = 'globe', color = '#ffcf8a', post = 'iron' } = {}) {
  const add = adder(g), glow = new Glow(color);
  for (const [x, z] of pts) {
    add(cyl(0.012, 0.018, 0.04, x, 0, z, 8), post); add(cyl(0.005, 0.008, h, x, 0.04, z, 6), post);
    if (style === 'lantern') {
      add(boxGeo(0.036, 0.01, 0.036, x, 0.04 + h, z), post); glow.add(boxGeo(0.026, 0.04, 0.026, x, 0.05 + h, z));
      add(new THREE.ConeGeometry(0.028, 0.024, 4).rotateY(Math.PI / 4).translate(x, 0.09 + h + 0.012, z), post);
    } else glow.add(sphere(0.026, x, 0.04 + h + 0.03, z));
  }
  glow.flush(g);
}

// warm uplights at the foot of the façade, the glow they throw up the wall and the pool of light on the pavement
export function lightUp(g, { x = 0, w, h, wz, fx = [], fz = 0, pz = fz - 0.1, pw = 0.8, pd = 0.34 }) {
  const add = adder(g), glow = new Glow();
  for (const s of fx) { add(boxGeo(0.05, 0.012, 0.03, s, 0, fz), 'iron'); glow.add(boxGeo(0.045, 0.01, 0.02, s, 0.012, fz)); }
  glow.flush(g);
  const wash = mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(x, h / 2 + 0.05, wz), washMaterial());
  wash.userData.keep = true; g.add(wash);
  const pool = mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2).translate(x, 0.004, pz), poolMaterial());
  pool.userData.keep = true; g.add(pool);
}

// a lean-to roof wedge over a box: x centred, z from the front to the back, y = the wall top; heights hf (front) and hb (back); the top sheet in `top`
export function wedge(add, x, y, z, w, d, hf, hb, top = 'tin', side = 'sooty', over = 0.02) {
  const xl = x - w / 2 - over, xr = x + w / 2 + over, zf = z - over, zb = z + d + over, s = new Soup(), e = new Soup();
  s.quad(V(xl, y + hf, zf), V(xr, y + hf, zf), V(xr, y + hb, zb), V(xl, y + hb, zb), V(0, 1, -0.3), 8, 8);
  e.quad(V(xl, y, zf), V(xr, y, zf), V(xr, y + hf, zf), V(xl, y + hf, zf), V(0, 0, -1), 4, 4); e.quad(V(xl, y, zb), V(xr, y, zb), V(xr, y + hb, zb), V(xl, y + hb, zb), V(0, 0, 1), 4, 4);
  e.quad(V(xl, y, zf), V(xl, y, zb), V(xl, y + hb, zb), V(xl, y + hf, zf), V(-1, 0, 0), 4, 4); e.quad(V(xr, y, zf), V(xr, y, zb), V(xr, y + hb, zb), V(xr, y + hf, zf), V(1, 0, 0), 4, 4);
  add(s.geo(), top); add(e.geo(), side);
}

// ------------------------------------------------------------------ stone work
// columns of height h from y0: plinth, shaft, capital, abacus
export function columns(add, xs, y0, h, z, { r = 0.021, shaft = 'marble', cap = 'limestone', seg = 12, w = 0.06 } = {}) {
  for (const cx of xs) {
    add(boxGeo(w, 0.02, w, cx, y0, z), shaft);
    add(cyl(r, r * 1.2, h - 0.06, cx, y0 + 0.02, z, seg), shaft);
    add(boxGeo(w + 0.01, 0.04, w + 0.01, cx, y0 + h - 0.04, z), shaft);
    add(boxGeo(w + 0.025, 0.016, w + 0.025, cx, y0 + h - 0.004, z), cap);
  }
}
// a pediment on a portico: front and back face and the sloping cap, from z = zf to zf + depth
export function pediment(add, x, y, zf, depth, w, ph, mat = 'limestone') {
  const s = new Soup(), L = V(x - w / 2, y, zf), R = V(x + w / 2, y, zf), T = V(x, y + ph, zf), Lb = L.clone().setZ(zf + depth), Rb = R.clone().setZ(zf + depth), Tb = T.clone().setZ(zf + depth);
  s.tri(L, R, T, V(0, 0, -1), 3, 3); s.tri(Lb, Rb, Tb, V(0, 0, 1), 3, 3);
  s.quad(L, T, Tb, Lb, V(-0.5, 1, 0), 3, 3); s.quad(T, R, Rb, Tb, V(0.5, 1, 0), 3, 3);
  add(s.geo(), mat);
}
// stepped plinth: n steps stepping in, the lowest at zf
export function steps(add, x, zf, w, n = 3, mat = 'limestone', step = 0.02) {
  for (let k = 0; k < n; k++) add(boxGeo(w - 0.03 * k, step, 0.055, x, k * step, zf - 0.055 + k * 0.022, 3, 1), mat);
}
export function balustrade(add, x0, x1, y, z, mat = 'marble', n = Math.round((x1 - x0) / 0.04)) {
  add(boxGeo(x1 - x0, 0.012, 0.012, (x0 + x1) / 2, y + 0.04, z), mat);
  for (let k = 0; k <= n; k++) add(cyl(0.007, 0.007, 0.04, x0 + k * (x1 - x0) / n, y + 0.002, z, 5), mat);
}
// a wrought-iron rail along x (balcony, area railing, fence)
export function railing(add, x0, x1, y, z, h = 0.05, gap = 0.028, mat = 'iron') {
  add(boxGeo(x1 - x0, 0.006, 0.006, (x0 + x1) / 2, y + h, z), mat); add(boxGeo(x1 - x0, 0.006, 0.006, (x0 + x1) / 2, y + 0.006, z), mat);
  const n = Math.max(1, Math.round((x1 - x0) / gap));
  for (let k = 0; k <= n; k++) add(boxGeo(0.004, h, 0.004, x0 + k * (x1 - x0) / n, y, z), mat);
}
// a flat ledge or string course along the front
export const course = (add, x, y, w, z, mat = 'limestone', h = 0.02, d = 0.05) => add(boxGeo(w, h, d, x, y, z, Math.max(1, w * 6), 1), mat);

// ------------------------------------------------------------------ canvas things: striped awnings, painted boards, clock faces
const stripeMats = new Map();
const stripeMat = (a, b) => {
  const key = a + b;
  if (!stripeMats.has(key)) {
    const map = canvasTexture(32, 8, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w / 2, h); g.fillStyle = b; g.fillRect(w / 2, 0, w / 2, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w, 1); });
    stripeMats.set(key, new THREE.MeshStandardMaterial({ map, roughness: 0.92, side: THREE.DoubleSide, clippingPlanes: [groundClip] }));
  }
  return stripeMats.get(key);
};
// a sloped awning against the wall: top edge at (y, z), the valance hanging at z − d, striped across x
export function awning(g, { x, y, z, w, d = 0.1, drop = 0.05, a = '#7a1c1c', b = '#cfc6ae', val = 0.025 }) {
  const s = new Soup(), x0 = x - w / 2, x1 = x + w / 2, zf = z - d;
  s.quad(V(x0, y, z), V(x1, y, z), V(x1, y - drop, zf), V(x0, y - drop, zf), V(0, 1, -1), 20, 20);
  s.quad(V(x0, y - drop, zf), V(x1, y - drop, zf), V(x1, y - drop - val, zf), V(x0, y - drop - val, zf), V(0, 0, -1), 20, 20);
  s.tri(V(x0, y, z), V(x0, y - drop, zf), V(x0, y - drop - val, zf), V(-1, 0, 0), 20, 20); s.tri(V(x1, y, z), V(x1, y - drop, zf), V(x1, y - drop - val, zf), V(1, 0, 0), 20, 20);
  g.add(mesh(s.geo(), stripeMat(a, b)));
}
const boardMats = new Map();
// a painted board (no light) facing the street: text on a flat colour, w × h
export function board(g, { text, x, y, z, w, h, bg = '#1c1a17', fg = '#c9b88a', rim = null, rz = 0 }) {
  const key = [text, bg, fg, rim, Math.round(h / w * 100)].join('|');
  if (!boardMats.has(key)) {
    const W = 256, H = Math.round(256 * h / w);
    const map = canvasTexture(W, H, (c, cw, ch) => {
      c.fillStyle = bg; c.fillRect(0, 0, cw, ch);
      for (let k = 0; k < 90; k++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`; c.fillRect(Math.random() * cw, Math.random() * ch, 2 + Math.random() * 10, 1 + Math.random() * 4); }
      if (rim) { c.strokeStyle = rim; c.lineWidth = 5; c.strokeRect(5, 5, cw - 10, ch - 10); }
      c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      const lines = String(text).split('\n'), fs = Math.min(ch / lines.length * 0.7, cw * 1.5 / Math.max(...lines.map(l => l.length)));
      c.font = `bold ${fs}px Oswald, Impact, "Arial Narrow", sans-serif`;
      lines.forEach((l, i) => c.fillText(l, cw / 2, ch * (i + 0.5) / lines.length + 2));
    });
    boardMats.set(key, new THREE.MeshStandardMaterial({ map, roughness: 0.85, clippingPlanes: [groundClip] }));
  }
  const geo = new THREE.PlaneGeometry(w, h).rotateY(Math.PI);
  if (rz) geo.rotateZ(rz);
  g.add(mesh(geo.translate(x, y + h / 2, z), boardMats.get(key)));
}
let clockMat = null;
// a lit clock face on a wall facing the street (r = radius), with a brass rim
export function clockFace(g, { x, y, z, r = 0.07 }) {
  clockMat ||= (() => {
    const map = canvasTexture(128, 128, (c, w, h) => {
      c.fillStyle = '#e8dfc6'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1a1612'; c.lineWidth = 3;
      for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; c.beginPath(); c.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); c.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); c.stroke(); }
      c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(2.1) * 28, 64 - Math.cos(2.1) * 28); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(0.4) * 46, 64 - Math.cos(0.4) * 46); c.stroke();
    });
    return new THREE.MeshStandardMaterial({ map, emissive: '#ffe1b0', emissiveMap: map, emissiveIntensity: 0.4, roughness: 0.5, clippingPlanes: [groundClip] });
  })();
  const face = mesh(new THREE.CircleGeometry(r, 28).rotateY(Math.PI).translate(x, y, z), clockMat); face.userData.keep = true; g.add(face);
  g.add(mesh(new THREE.TorusGeometry(r, r * 0.1, 6, 28).translate(x, y, z + 0.002), solid('brass')));
}

let netMat = null;
// a fishing net hung on a frame: a plane of diamond mesh (cut out with alpha), a little off the vertical
export function net(g, { x, y, z, w, h, tilt = 0.15 }) {
  netMat ||= new THREE.MeshStandardMaterial({
    map: canvasTexture(128, 128, (c, W, H) => {
      c.clearRect(0, 0, W, H); c.strokeStyle = '#7a6a48'; c.lineWidth = 7;
      for (let k = -H; k < W + H; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + H, H); c.stroke(); c.beginPath(); c.moveTo(k, H); c.lineTo(k + H, 0); c.stroke(); }
    }), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, clippingPlanes: [groundClip] });
  const geo = new THREE.PlaneGeometry(w, h); geo.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? h : w) * 5; });
  g.add(mesh(geo.rotateX(tilt).translate(x, y + h / 2, z), netMat));
}
// a round-headed opening (door or window recess): a dark panel with a half-disc on top, framed in stone, x centred on the front plane z
export function arch(add, x, y, z, w, h, frame = 'portland', dark = 'dark') {
  const r = w / 2;
  add(boxGeo(w, h - r, 0.008, x, y, z - 0.004), dark);
  add(new THREE.CylinderGeometry(r, r, 0.008, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(x, y + h - r, z - 0.004), dark);
  add(new THREE.TorusGeometry(r + 0.006, 0.008, 5, 14, Math.PI).translate(x, y + h - r, z - 0.006), frame);
  for (const s of [-1, 1]) add(boxGeo(0.014, h - r, 0.014, x + s * (r + 0.006), y, z - 0.008), frame);
}

// a hemispherical dome on a drum with a lantern and finial: copper by default
export function dome(add, x, y, z, r, { drum = 0.12, mat = 'copper', drumMat = 'limestone', trim = 'gold', seg = 20 } = {}) {
  add(cyl(r + 0.005, r + 0.015, drum, x, y, z, seg), drumMat);
  add(cyl(r + 0.01, r + 0.01, 0.014, x, y + drum, z, seg), 'marble');
  add(new THREE.SphereGeometry(r, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + drum + 0.014, z), mat);
  add(cyl(r * 0.2, r * 0.23, r * 0.55, x, y + drum + 0.014 + r, z, 10), 'brass');
  add(cone(r * 0.26, r * 0.45, x, y + drum + 0.014 + r + r * 0.55, z, 10), trim);
  add(cyl(0.004, 0.004, r * 0.45, x, y + drum + 0.014 + r + r * 0.95, z, 4), trim);
}
// a stepped brass spire on a tower top
export function spireTop(add, x, y, z, w, h) {
  add(boxGeo(w, h * 0.1, w, x, y, z, 2, 1), 'limestone'); add(boxGeo(w * 0.72, h * 0.1, w * 0.72, x, y + h * 0.1, z, 2, 1), 'limestone');
  add(boxGeo(w * 0.48, h * 0.1, w * 0.48, x, y + h * 0.2, z, 2, 1), 'brass');
  add(new THREE.ConeGeometry(w * 0.24, h * 0.5, 4).rotateY(Math.PI / 4).translate(x, y + h * 0.3 + h * 0.25, z), 'brass');
  add(cyl(0.003, 0.006, h * 0.25, x, y + h * 0.75, z, 5), 'gold');
}
// a plain rooftop clutter set: stair bulkhead, vents, a water tank on legs
export function rooftop(add, x, top, z, { tank = false, stack = false, vent = true } = {}) {
  add(boxGeo(0.1, 0.08, 0.08, x - 0.12, top, z, 2, 2), 'concrete');
  if (vent) add(boxGeo(0.07, 0.04, 0.06, x + 0.1, top, z - 0.02, 2, 1), 'tin');
  if (stack) add(boxGeo(0.05, 0.14, 0.05, x + 0.2, top, z + 0.05, 2, 2), 'brick');
  if (tank) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(boxGeo(0.01, 0.07, 0.01, x + sx * 0.04, top, z + sz * 0.04), 'iron'); add(cyl(0.055, 0.055, 0.08, x, top + 0.07, z, 10), 'wood'); add(cone(0.06, 0.03, x, top + 0.15, z, 10), 'tar'); }
}
