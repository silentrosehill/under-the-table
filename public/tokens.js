// The four playing pieces, in the manner of die-cast Monopoly tokens but 1960s noir: a fedora, a 1950s sedan, a pocket watch on its
// chain and a briefcase. All are aged pewter (gunmetal, a little worn) standing on a pewter plinth, with the player's colour as a dark
// enamel inlay: the hat band, the car's paint, the watch's bezel ring, the case's leather, and a thin band round the plinth.
// Underneath lies a soft disc with a ring in a lightened tone of the same colour and a contact shadow, so each piece is easy to tell
// apart over dark asphalt and over the cream board alike. The watch is the CC0 Poly Haven model (re-finished in pewter, with a chain
// added); everything else is modelled here from turned (lathe), extruded and bevelled profiles.
// Figures face +x (their direction of travel). Units: 1 unit = 4 cm.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadModel } from './assets.js';
import { pcText, pcGlow } from './pcolor.js';

// ------------------------------------------------------------------ materials

// worn metal: a little mottling and fine scratches, shared by the map and the roughness map (scratches are bright, the rest dull)
let wearTex = null;
function wear() {
  if (wearTex) return wearTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) { const x = rnd() * 256, y = rnd() * 256, r = 8 + rnd() * 26, v = 185 + rnd() * 60 | 0; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},.32)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 5000; i++) { const v = 150 + rnd() * 105 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
  g.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI, l = 6 + rnd() * 30; g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,.55)' : 'rgba(90,90,90,.45)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  wearTex = new THREE.CanvasTexture(c); wearTex.wrapS = wearTex.wrapT = THREE.RepeatWrapping; wearTex.repeat.set(2, 2); wearTex.colorSpace = THREE.SRGBColorSpace; wearTex.anisotropy = 4;
  return wearTex;
}
const metal = (color, rough, intensity = 1.3) => { const m = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough, roughnessMap: wear(), map: wear(), envMapIntensity: intensity }); metals.push(m); return m; };
const metals = [];
const pewter = metal('#6d7a89', 0.5, 0.6);            // the main metal: cool aged pewter
const bright = metal('#8c97a5', 0.4, 0.75);       // polished edges: bumpers, bezels, latches
const gunmetal = metal('#3d444e', 0.55, 0.55);      // plinth, recesses, tyres' hubs
const rubber = new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.85, metalness: 0 });
const whitewall = new THREE.MeshStandardMaterial({ color: '#686866', roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
const archMat = new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
const glassDark = new THREE.MeshPhysicalMaterial({ color: '#0b0f14', roughness: 0.15, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 0.4, side: THREE.DoubleSide });
const lampMat = new THREE.MeshStandardMaterial({ color: '#aeb4bb', roughness: 0.2, metalness: 0.6 });
const tailMat = new THREE.MeshStandardMaterial({ color: '#4b1414', roughness: 0.35, metalness: 0.1, emissive: '#3a0b0b', emissiveIntensity: 0.7 });
let paints = [];                                   // weak: a scene's pieces may be thrown away at any time (new game, mode switch)
let envTex = null;
// the metal reflects a neutral studio room rather than the (orange) fireplace of the table room, so pewter stays grey
const studios = new WeakMap();
export function setTokenEnvironment(roomTex, renderer) {
  if (renderer && !studios.has(renderer)) {
    const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    studios.set(renderer, pm.fromScene(room, 0.04).texture); room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); pm.dispose();
  }
  const tex = (renderer && studios.get(renderer)) || roomTex;
  envTex = tex;
  paints = paints.filter(r => r.deref());
  for (const m of [...metals, glassDark]) { m.envMap = tex; m.needsUpdate = true; }
  for (const r of paints) { const m = r.deref(); if (m) { m.envMap = tex; m.envMapIntensity = 0.22; m.needsUpdate = true; } }
}

// the pieces on offer (server.js has the same list); anything else, e.g. a piece from before the change, becomes the nearest of these
export const TOKEN_KINDS = ['car', 'hat', 'watch', 'case'];
const LEGACY = { ship: 'car', rocket: 'car', dino: 'watch', cat: 'watch', dog: 'watch', crown: 'hat', glass: 'case' };
export const tokenKind = k => (TOKEN_KINDS.includes(k) ? k : LEGACY[k] || 'hat');

// the player's colour as deep satin enamel (one per piece, recoloured by the scene); a touch of the lightened tone is emissive so it
// still reads in the dark city
function paintMaterial(color, kind) {
  const leather = kind === 'case';
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color).multiplyScalar(ENAMEL_K), roughness: leather ? 0.75 : 0.55, metalness: 0, specularIntensity: leather ? 0.3 : 0.45, clearcoat: leather ? 0 : 0.12, clearcoatRoughness: 0.55, emissive: pcGlow(color), emissiveIntensity: 0.05 });
  if (leather) m.bumpMap = grain();
  if (leather) m.bumpScale = 0.9;
  if (envTex) { m.envMap = envTex; m.envMapIntensity = 0.22; }
  paints.push(new WeakRef(m));
  return m;
}
const ENAMEL_K = 0.62;                              // the enamel sits a shade below the nominal colour so lamplight doesn't wash it out
export function paintToken(enamel, color) { enamel.color.set(color).multiplyScalar(ENAMEL_K); enamel.emissive.set(pcGlow(color)); }

let grainTex = null;
function grain() {
  if (grainTex) return grainTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) { const v = rnd() < 0.5 ? 40 : 200; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 1.6, 0, Math.PI * 2); g.fill(); }
  grainTex = new THREE.CanvasTexture(c); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(3, 3);
  return grainTex;
}

// ------------------------------------------------------------------ geometry helpers (every shape is built once and shared)

const geos = new Map();
const G = (key, make) => { let g = geos.get(key); if (!g) { g = make(); geos.set(key, g); } return g; };
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const mesh = (geo, mat = pewter, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function extrude(shape, depth, bevel = 0.015, steps = 3) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: steps, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
// a closed polygon with rounded corners (radius r, or one per corner)
function roundedShape(pts, r) {
  const s = new THREE.Shape(), n = pts.length;
  pts.forEach((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], rr = Array.isArray(r) ? r[i] : r;
    const v1 = new THREE.Vector2(a[0] - p[0], a[1] - p[1]), v2 = new THREE.Vector2(b[0] - p[0], b[1] - p[1]);
    const d = Math.min(rr, v1.length() / 2, v2.length() / 2); v1.normalize(); v2.normalize();
    if (i === 0) s.moveTo(p[0] + v1.x * d, p[1] + v1.y * d); else s.lineTo(p[0] + v1.x * d, p[1] + v1.y * d);
    s.quadraticCurveTo(p[0], p[1], p[0] + v2.x * d, p[1] + v2.y * d);
  });
  s.closePath();
  return s;
}
// a smooth surface from a grid of points: fn(row, col) → [x, y, z]; the columns wrap round (a closed ring)
function gridSurface(rows, cols, fn, flip = false) {
  const pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const p = fn(i, j), k = i * cols + j;
    pos.set(p, k * 3); uv[k * 2] = p[0] * 2 + p[1] * 1.3; uv[k * 2 + 1] = p[2] * 2 + p[1] * 0.7;
  }
  const idx = [];
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) {
    const a = i * cols + j, b = i * cols + (j + 1) % cols, c = (i + 1) * cols + (j + 1) % cols, d = (i + 1) * cols + j;
    if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ figures (each takes the paint material)

// the fedora: an oval crown with a pinched front and a crease down the top, a snapped brim (down in front, up behind), the player's
// colour as the hat band
const HAT = { RX: 0.215, RZ: 0.18, H: 0.27, Y0: 0.045, SIDE: 16, TOP: 10, COLS: 72 };
const hatAngle = j => (j / HAT.COLS) * Math.PI * 2;
function crownRing(sy, a, grow = 0) {                          // the crown's outline at relative height sy (0..1), angle a (0 = front)
  const ca = Math.cos(a), sa = Math.sin(a), aa = Math.abs(Math.atan2(sa, ca)), front = Math.max(0, ca);
  const pinch = 1 - 0.2 * sy * sy * Math.exp(-Math.pow(aa - 0.85, 2) / 0.14);
  return [HAT.RX * (1 - 0.14 * sy - 0.2 * sy * sy * front * front) * ca * (1 + grow), HAT.RZ * (1 - 0.2 * sy) * pinch * sa * (1 + grow)];
}
function crownPoint(i, j) {
  const { RX, H, Y0, SIDE, TOP } = HAT, a = hatAngle(j);
  if (i <= SIDE) { const sy = i / SIDE, [x, z] = crownRing(sy, a); return [x, Y0 + sy * H, z]; }
  const t = Math.pow((i - SIDE) / TOP, 1.4), [rx, rz] = crownRing(1, a), x = rx * (1 - t), z = rz * (1 - t);
  const rim = 0.022 * Math.sin(Math.min(t / 0.2, 1) * Math.PI / 2);
  const crease = 0.075 * Math.exp(-Math.pow(z / 0.062, 2)) * (0.45 + 0.55 * Math.max(0, Math.min(1, (x + RX) / (2 * RX)))) * Math.min(1, t / 0.14);
  return [x, Y0 + H + rim - crease, z];
}
function brimPoint(i, j, rows) {
  const RBX = 0.315, RBZ = 0.28, half = rows >> 1, a = hatAngle(j);
  const top = i >= half, k = top ? rows - 1 - i : i;            // bottom rows run inward → out, then the top rows run back in
  const rho = 0.55 + 0.45 * (k / (half - 1)), x = RBX * rho * Math.cos(a), z = RBZ * rho * Math.sin(a), u = x / RBX;
  const curl = -0.055 * Math.pow(Math.max(0, u), 2) + 0.03 * Math.pow(Math.max(0, -u), 2) - 0.014 * Math.pow(Math.abs(z / RBZ), 2) * (0.4 + 0.6 * rho);
  const edge = k === half - 1 ? (top ? -0.003 : 0.003) : 0;      // a rounded rim
  return [x, 0.05 + curl + (top ? 0.016 + edge : edge), z];
}
function fedora(paint) {
  const g = new THREE.Group();
  g.add(mesh(G('hat-crown', () => gridSurface(HAT.SIDE + HAT.TOP + 1, HAT.COLS, (i, j) => crownPoint(i, j), true)), pewter));
  g.add(mesh(G('hat-band', () => gridSurface(7, HAT.COLS, (i, j) => { const sy = 0.05 + i * 0.045, [x, z] = crownRing(sy, hatAngle(j), 0.035); return [x, HAT.Y0 + sy * HAT.H, z]; }, true)), paint));
  g.add(mesh(G('hat-brim', () => { const rows = 16; return gridSurface(rows, HAT.COLS, (i, j) => brimPoint(i, j, rows), false); }), pewter));
  g.scale.setScalar(1.0);
  return g;
}

// a 1950s four-door sedan (a '50 Chevrolet Fleetline or a '49 Mercury at die-cast size): pontoon body in the player's paint, pewter
// bumpers, grille and hubcaps, whitewall tyres, a glasshouse of dark glass
// a flat quad on a sloping face of the cabin (in the xy plane: A to B up the slope, n the outward normal), for the windscreen glass
function slopeQuad(A, B, n, half, t0, t1, lift = 0.0015) {
  const P = t => [A[0] + (B[0] - A[0]) * t + n[0] * lift, A[1] + (B[1] - A[1]) * t + n[1] * lift];
  const p0 = P(t0), p1 = P(t1), pos = [p0[0], p0[1], -half, p0[0], p0[1], half, p1[0], p1[1], half, p1[0], p1[1], -half];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(n[0] > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
  return geo;
}
function sedan(paint) {
  const g = new THREE.Group();
  g.add(mesh(G('car-body', () => extrude(roundedShape([[-0.39, 0.1], [0.385, 0.1], [0.405, 0.14], [0.4, 0.19], [0.32, 0.215], [0.12, 0.225], [-0.22, 0.23], [-0.34, 0.225], [-0.395, 0.2], [-0.405, 0.14]], [0.03, 0.03, 0.025, 0.05, 0.06, 0.06, 0.05, 0.05, 0.035, 0.025]), 0.29, 0.02, 4)), paint));
  g.add(mesh(G('car-cabin', () => extrude(roundedShape([[-0.27, 0.215], [0.12, 0.215], [0.03, 0.345], [-0.2, 0.345]], [0.03, 0.03, 0.05, 0.07]), 0.225, 0.014, 3)), paint));
  const glass = (key, pts) => G(key, () => new THREE.ShapeGeometry(roundedShape(pts, 0.008)));
  const gf = glass('car-win-f', [[-0.035, 0.236], [0.098, 0.236], [0.032, 0.328], [-0.035, 0.328]]), gr = glass('car-win-r', [[-0.245, 0.236], [-0.075, 0.236], [-0.075, 0.328], [-0.195, 0.328]]);
  for (const s of [-1, 1]) for (const geo of [gf, gr]) { const w = mesh(geo, glassDark, false); w.position.z = s * 0.1315; g.add(w); }
  g.add(mesh(G('car-screen', () => slopeQuad([0.12, 0.215], [0.03, 0.345], [0.811, 0.584], 0.092, 0.12, 0.9)), glassDark, false));
  g.add(mesh(G('car-back', () => slopeQuad([-0.27, 0.215], [-0.2, 0.345], [-0.872, 0.488], 0.082, 0.12, 0.88)), glassDark, false));
  for (const s of [-1, 1]) {
    const side = 0.165 * s;
    const strip = mesh(G('car-strip', () => box(0.64, 0.011, 0.008)), bright); strip.position.set(0.02, 0.165, side); g.add(strip);
    for (const x of [-0.075, 0.175]) { const dl = mesh(G('car-doorline', () => box(0.004, 0.115, 0.005)), gunmetal, false); dl.position.set(x, 0.168, side); g.add(dl); }
    for (const x of [-0.035, 0.215]) { const dh = mesh(G('car-handle', () => box(0.03, 0.008, 0.01)), bright, false); dh.position.set(x, 0.19, side); g.add(dh); }
    for (const x of [0.27, -0.265]) {
      const w = wheel(); w.position.set(x, 0.088, s * 0.1445); w.rotation.y = s > 0 ? 0 : Math.PI; g.add(w);
      const arch = mesh(G('car-arch', () => lathe([[0.0, 0], [0.105, 0]], 32)), archMat, false); arch.rotation.x = Math.PI / 2; arch.position.set(x, 0.088, side - (s > 0 ? 0.0005 : -0.0005)); if (s < 0) arch.rotation.x = -Math.PI / 2; g.add(arch);
    }
    for (const x of [0.425, -0.43]) { const ov = mesh(G('car-ov', () => new THREE.SphereGeometry(0.02, 12, 10)), bright); ov.position.set(x, 0.118, s * 0.075); g.add(ov); }
    const lamp = mesh(G('car-lamp', () => new THREE.SphereGeometry(0.036, 14, 10).scale(0.55, 1, 1)), lampMat); lamp.position.set(0.392, 0.168, s * 0.115); g.add(lamp);
    const tail = mesh(G('car-tail', () => box(0.012, 0.034, 0.05)), tailMat, false); tail.position.set(-0.403, 0.172, s * 0.11); g.add(tail);
  }
  for (const x of [0.43, -0.436]) { const bum = mesh(G('car-bumper', () => new THREE.CapsuleGeometry(0.014, 0.29, 5, 10)), bright); bum.rotation.x = Math.PI / 2; bum.position.set(x, 0.118, 0); g.add(bum); }
  for (let k = 0; k < 3; k++) { const sl = mesh(G('car-grille', () => box(0.012, 0.013, 0.2)), bright); sl.position.set(0.4, 0.14 + k * 0.021, 0); g.add(sl); }
  const hood = mesh(G('car-ornament', () => new THREE.ConeGeometry(0.014, 0.05, 8)), bright); hood.rotation.z = -Math.PI / 2; hood.position.set(0.365, 0.232, 0); g.add(hood);
  g.scale.setScalar(0.86);
  return g;
}
function wheel() {
  const w = new THREE.Group();
  const tyre = mesh(G('car-tyre', () => lathe([[0.045, -0.028], [0.074, -0.028], [0.088, -0.017], [0.088, 0.017], [0.074, 0.028], [0.045, 0.028]], 28)), rubber); tyre.rotation.x = Math.PI / 2;
  const hub = mesh(G('car-hub', () => lathe([[0, 0.03], [0.032, 0.03], [0.044, 0.022]], 24)), bright, false); hub.rotation.x = Math.PI / 2;
  const wall = mesh(G('car-wall', () => lathe([[0.05, 0.0285], [0.07, 0.0285]], 28)), whitewall, false); wall.rotation.x = Math.PI / 2;
  w.add(tyre, hub, wall);
  return w;
}

// the pocket watch: Poly Haven's engraved watch (CC0) re-finished as gunmetal, reclined on the plinth so its face shows from above,
// a ring of enamel inlaid in the bezel, and its chain lying in loops at the foot
const WATCH = { S: 9.4, TILT: 1.0, R: 0.031 };
const watchQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), WATCH.TILT));
const watchAt = new THREE.Vector3(0.06, WATCH.R * WATCH.S * Math.cos(WATCH.TILT) + 0.035, 0);
const watchPoint = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(WATCH.S).applyQuaternion(watchQ).add(watchAt);
let watchMap = null;
function greyMap(src) {                                       // the brass texture, turned to cool pewter
  if (watchMap) return watchMap;
  const img = src.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const l = Math.min(255, (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) * 1.25); p[i] = l * 0.92; p[i + 1] = l * 0.96; p[i + 2] = l; }
  x.putImageData(d, 0, 0);
  watchMap = new THREE.CanvasTexture(c); watchMap.flipY = src.flipY; watchMap.colorSpace = THREE.SRGBColorSpace; watchMap.anisotropy = 8;
  return watchMap;
}
function chainGeometry() {
  const R = 0.2;
  const bow = watchPoint(0, 0.0475, 0);
  const curve = new THREE.CatmullRomCurve3([
    bow, new THREE.Vector3(bow.x - 0.07, bow.y - 0.06, 0.02), new THREE.Vector3(-0.3, 0.07, 0.07), new THREE.Vector3(-0.3, 0.02, 0.2),
    new THREE.Vector3(-0.12, 0.016, 0.3), new THREE.Vector3(0.14, 0.016, 0.27), new THREE.Vector3(0.28, 0.016, 0.1), new THREE.Vector3(0.26, 0.016, -0.14),
  ].map(v => v.clone().setZ(Math.min(0.31, v.z))), false, 'catmullrom', 0.5);
  const len = curve.getLength(), n = Math.floor(len / 0.034), parts = [], up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n);
    const link = new THREE.TorusGeometry(0.0155, 0.0052, 7, 16); link.scale(1.55, 1, 1);
    const side = new THREE.Vector3().crossVectors(tg, up).normalize();
    const m = new THREE.Matrix4().makeBasis(tg, i % 2 ? up : side, i % 2 ? side : up);
    if (i % 2) { /* the standing links: their plane is vertical */ }
    link.applyMatrix4(m); link.translate(p.x, p.y, p.z);
    parts.push(link);
  }
  const t = curve.getPointAt(1), bar = new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8).rotateX(Math.PI / 2).translate(t.x, t.y, t.z);
  parts.push(bar);
  return mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }));
}
function pocketWatch(paint) {
  const g = new THREE.Group();
  g.add(mesh(G('watch-chain', chainGeometry), bright));
  const bezel = mesh(G('watch-bezel', () => new THREE.RingGeometry(0.0208, 0.0233, 48)), paint, false);
  bezel.scale.setScalar(WATCH.S); bezel.position.copy(watchPoint(0, 0, 0.0057)); bezel.quaternion.copy(watchQ);
  g.add(bezel);
  loadModel('vintage_pocket_watch').then(w => {
    w.scale.setScalar(WATCH.S); w.quaternion.copy(watchQ); w.position.copy(watchAt);
    w.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      if (o.material.map) {
        const m = o.material.clone(); m.map = greyMap(o.material.map); m.color.set('#c6ccd2'); m.envMapIntensity = 0.7; if (envTex) m.envMap = envTex;
        o.material = m;
      }
    });
    g.add(w);
  });
  return g;
}

// an attaché case: leather in the player's colour (a fine grain), pewter corners, binding, handle and a pair of latches
function briefcase(paint) {
  const g = new THREE.Group();
  const W = 0.56, H = 0.34, D = 0.15, y0 = 0.004;
  const body = mesh(G('case-body', () => extrude(roundedShape([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]], 0.035), D, 0.014, 4)), paint);
  body.position.y = y0; g.add(body);
  const at = (geo, mat, x, y, z, shadow = true) => { const m = mesh(geo, mat, shadow); m.position.set(x, y + y0, z); g.add(m); return m; };
  for (const z of [-1, 1]) {
    const f = z * (D / 2 + 0.014);
    at(G('case-seam', () => box(W - 0.02, 0.006, 0.004)), gunmetal, 0, H * 0.62, f, false);        // the lid's seam
    for (const x of [-0.17, 0.17]) {                                                                    // latches
      at(G('case-latch', () => extrude(roundedShape([[-0.034, -0.026], [0.034, -0.026], [0.034, 0.026], [-0.034, 0.026]], 0.008), 0.008, 0.004, 2)), bright, x, H * 0.62, f + z * 0.004);
      at(G('case-slot', () => box(0.034, 0.008, 0.004)), gunmetal, x, H * 0.62, f + z * 0.0105, false);
    }
    at(G('case-plate', () => extrude(roundedShape([[-0.05, -0.022], [0.05, -0.022], [0.05, 0.022], [-0.05, 0.022]], 0.006), 0.004, 0.002, 2)), pewter, 0, H * 0.22, f + z * 0.002, false);  // a name plate
    for (const x of [-1, 1]) {                                                                          // binding along the vertical edges
      at(G('case-edge', () => box(0.012, H - 0.06, 0.006)), pewter, x * (W / 2 - 0.004), H / 2, f + z * 0.0005, false);
    }
    at(G('case-rim', () => box(W - 0.07, 0.01, 0.006)), pewter, 0, 0.012, f, false);
  }
  for (const x of [-1, 1]) for (const y of [0, 1]) {                                                    // corner guards
    const c = at(G('case-corner', () => extrude(roundedShape([[0, 0], [0.075, 0], [0.075, 0.016], [0.016, 0.016], [0.016, 0.075], [0, 0.075]], 0.004), D + 0.012, 0.004, 2)), pewter, x * W / 2, y * H, 0);
    c.scale.set(-x, y ? -1 : 1, 1);
  }
  // handle: a tube arch on two pewter mounts
  const arch = new THREE.CatmullRomCurve3([[-0.1, 0, 0], [-0.1, 0.045, 0], [-0.06, 0.075, 0], [0.06, 0.075, 0], [0.1, 0.045, 0], [0.1, 0, 0]].map(p => new THREE.Vector3(...p)));
  at(G('case-handle', () => new THREE.TubeGeometry(arch, 24, 0.0125, 8)), bright, 0, H, 0);
  for (const x of [-0.1, 0.1]) at(G('case-mount', () => box(0.04, 0.02, 0.05)), pewter, x, H + 0.005, 0);
  return g;
}

const FIGURES = { car: sedan, hat: fedora, watch: pocketWatch, case: briefcase };

// ------------------------------------------------------------------ the piece

const LIFT = 0.05;                                                                                   // the plinth floats a hair above its glow
const PUCK_PTS = [[0, 0.012], [0.265, 0.012], [0.285, 0.026], [0.292, 0.04], [0.292, 0.074], [0.282, 0.086], [0.25, 0.092], [0, 0.092]];
const BAND_PTS = [[0.2915, 0.042], [0.2955, 0.046], [0.2955, 0.068], [0.2915, 0.072]];                // the enamel inlay round the plinth
const DISC_R = 0.46;                                                                                 // half-size of the glow plane; its ring sits at 0.8 of it

// two shared canvas textures: a glowing disc with a crisp ring, and a soft contact shadow
let glowTex = null, shadowTex = null, discGeo = null;
function groundTextures() {
  if (glowTex) return;
  const mk = draw => { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  glowTex = mk(g => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(0.55, 'rgba(255,255,255,.26)'); gr.addColorStop(0.76, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 102, 0, Math.PI * 2); g.stroke();       // the crisp ring (0.8 of the radius)
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 15; g.beginPath(); g.arc(128, 128, 102, 0, Math.PI * 2); g.stroke();
  });
  shadowTex = mk(g => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(0.5, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  });
  discGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
}

// → { group (the piece: bobs and squashes), ground (glow disc, contact shadow and the hover proxy: stays on the street),
//     enamel (the paint, the player's colour), felt (the glow, the team's colour in a team game) }
// (recolour with paintToken(enamel, color) and tokenGlow(felt, color))
export function makePewterToken(kind, color) {
  groundTextures();
  kind = tokenKind(kind);
  const g = new THREE.Group();
  const enamel = paintMaterial(color, kind);
  const puck = mesh(G('puck', () => lathe(PUCK_PTS)), gunmetal), band = mesh(G('band', () => lathe(BAND_PTS)), enamel, false);
  const fig = FIGURES[kind](enamel);
  fig.position.y = 0.088;
  g.add(puck, band, fig);
  g.position.y = LIFT;

  const ground = new THREE.Group();
  const felt = new THREE.MeshBasicMaterial({ color: pcGlow(color), map: glowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const glowMesh = new THREE.Mesh(discGeo, felt); glowMesh.scale.setScalar(DISC_R * 2); glowMesh.position.y = 0.01; glowMesh.renderOrder = 1;
  const blobMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const blob = new THREE.Mesh(discGeo, blobMat); blob.scale.setScalar(0.92); blob.position.y = 0.006; blob.renderOrder = 0;
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), new THREE.MeshBasicMaterial()); hit.position.y = 0.4; hit.visible = false;
  hit.userData.tokenHit = true;
  ground.add(blob, glowMesh, hit);
  return { group: g, ground, enamel, felt, hit };
}
export const tokenGlow = (felt, color) => felt.color.set(pcGlow(color));                          // the disc and its ring take the lightened tone
export const TOKEN_TAG_Y = 0.78;                                                                     // the name tag floats this high above the base (token units)

// ------------------------------------------------------------------ the name tag shown when the mouse rests on a piece
// A small noir plaque in the (light tint of the) player's colour over the piece. Plain HTML over the canvas, placed every frame; the same in both modes.
let tagStyled = false;
export function createNameTag(container) {
  if (!tagStyled) {
    tagStyled = true;
    const st = document.createElement('style');
    st.textContent = `.tok-tag{position:absolute;left:0;top:0;z-index:5;pointer-events:none;opacity:0;transition:opacity .12s;will-change:transform}
.tok-tag.on{opacity:1}
.tok-tag b{display:block;font:600 14px/1 Oswald,'Arial Narrow',sans-serif;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap;padding:6px 11px 5px;background:#120e0b;color:var(--tc,#f0e3c6);border:2px solid var(--tc,#f0e3c6);border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,.7),0 0 12px var(--tcg,transparent);transform:translate(-50%,-100%)}
.tok-tag b::after{content:'';position:absolute;left:50%;top:100%;margin-left:-6px;border:6px solid transparent;border-top-color:var(--tc,#f0e3c6)}`;
    document.head.append(st);
  }
  const el = document.createElement('div'), label = document.createElement('b');
  el.className = 'tok-tag'; el.setAttribute('aria-hidden', 'true'); el.append(label);
  container.append(el);
  const v = new THREE.Vector3();
  let on = false, id = null;
  return {
    get id() { return id; },
    show(tid, name, color) {
      if (on && id === tid && label.textContent === name) return;
      on = true; id = tid; label.textContent = name;
      const tc = pcText(color);
      el.style.setProperty('--tc', tc); el.style.setProperty('--tcg', tc + '55');
    },
    hide() { on = false; id = null; el.classList.remove('on'); },
    // place the tag over the world point `at` (call every frame)
    update(camera, at) {
      if (!on) return;
      v.copy(at).project(camera);
      if (v.z > 1) { el.classList.remove('on'); return; }
      const W = container.clientWidth, H = container.clientHeight;
      el.style.transform = `translate3d(${Math.max(40, Math.min(W - 40, (v.x + 1) / 2 * W)).toFixed(1)}px, ${Math.max(40, (1 - v.y) / 2 * H - 12).toFixed(1)}px, 0)`;
      el.classList.add('on');
    },
    dispose() { el.remove(); },
  };
}
