// Pewter playing pieces. Each figure stands on a turned base with an enamel band in the
// player's colour. The car is Kenney's CC0 sedan; the others are modelled here from turned
// (lathe) and extruded, heavily bevelled profiles — the way small metal tokens are made.
// Figures face +x (their direction of travel). Units: 1 unit = 4 cm.
import * as THREE from 'three';
import { loadModel } from './assets.js';

const pewter = new THREE.MeshPhysicalMaterial({ color: '#a9adb1', metalness: 1, roughness: 0.3, clearcoat: 0.15, clearcoatRoughness: 0.4 });
const darkPewter = new THREE.MeshPhysicalMaterial({ color: '#6f7377', metalness: 1, roughness: 0.45 });
export function setTokenEnvironment(tex) {
  for (const m of [pewter, darkPewter]) { m.envMap = tex; m.envMapIntensity = 1.6; m.needsUpdate = true; }
}

const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const mesh = (geo, mat = pewter) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
function extrudeShape(draw, depth, bevel = 0.025) {
  const s = new THREE.Shape(); draw(s);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 4, curveSegments: 18 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// ------------------------------------------------------------------ figures

function topHat() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.3, 0], [0.325, 0.014], [0.31, 0.034], [0.19, 0.042], [0.172, 0.06], [0.19, 0.42], [0.205, 0.44], [0.19, 0.452], [0, 0.452]])));
  g.add(mesh(lathe([[0.176, 0.07], [0.186, 0.07], [0.195, 0.15], [0.184, 0.15]]), darkPewter));      // hat band
  return g;
}

function crown() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.2, 0], [0.235, 0.02], [0.235, 0.14], [0.22, 0.16], [0, 0.16]])));
  const cushion = mesh(new THREE.SphereGeometry(0.17, 24, 16), darkPewter); cushion.scale.y = 0.75; cushion.position.y = 0.16;
  g.add(cushion);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const spike = mesh(new THREE.ConeGeometry(0.055, 0.2, 12)); spike.position.set(Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2);
    const ball = mesh(new THREE.SphereGeometry(0.035, 12, 10)); ball.position.set(Math.cos(a) * 0.2, 0.36, Math.sin(a) * 0.2);
    g.add(spike, ball);
  }
  const cross = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03)); cross.position.y = 0.36;
  const bar = mesh(new THREE.BoxGeometry(0.08, 0.03, 0.03)); bar.position.y = 0.38;
  g.add(cross, bar);
  return g;
}

function rocket() {
  const g = new THREE.Group();
  const body = mesh(lathe([[0, 0.04], [0.07, 0.04], [0.11, 0.09], [0.13, 0.22], [0.122, 0.4], [0.085, 0.52], [0.035, 0.6], [0, 0.62]]));
  g.add(body);
  const fin = extrudeShape(s => { s.moveTo(0, 0); s.lineTo(0.15, -0.04); s.lineTo(0.15, 0.04); s.lineTo(0.02, 0.22); s.closePath(); }, 0.02, 0.01);
  for (let k = 0; k < 3; k++) {
    const f = mesh(fin); f.position.y = 0.06;
    f.rotation.y = (k / 3) * Math.PI * 2;
    f.position.x = Math.cos(-f.rotation.y) * 0.1; f.position.z = Math.sin(-f.rotation.y) * 0.1;
    g.add(f);
  }
  const port = mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 24), darkPewter); port.position.set(0.122, 0.34, 0); port.rotation.y = Math.PI / 2;
  g.add(port);
  g.rotation.z = -0.35;                     // leaning forward, in flight
  return g;
}

function ship() {
  const g = new THREE.Group();
  const hull = mesh(extrudeShape(s => {
    s.moveTo(-0.3, 0.12); s.lineTo(0.36, 0.14); s.quadraticCurveTo(0.3, 0.02, 0.18, 0); s.lineTo(-0.22, 0); s.quadraticCurveTo(-0.3, 0.02, -0.3, 0.12);
  }, 0.14, 0.03));
  g.add(hull);
  const deck = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.12), darkPewter); deck.position.y = 0.135;
  g.add(deck);
  for (const [x, h] of [[0.05, 0.52], [-0.16, 0.4]]) {
    const mast = mesh(new THREE.CylinderGeometry(0.012, 0.014, h, 8)); mast.position.set(x, 0.14 + h / 2, 0);
    const sail = mesh(extrudeShape(s => { s.moveTo(0, 0); s.quadraticCurveTo(-0.05, h * 0.4, 0, h * 0.75); s.lineTo(0.2, h * 0.7); s.quadraticCurveTo(0.24, h * 0.35, 0.2, 0.02); s.closePath(); }, 0.012, 0.006));
    sail.position.set(x - 0.1, 0.2, 0.02); sail.rotation.y = -0.15;
    g.add(mast, sail);
  }
  return g;
}

// a classic Scottie, sitting cat and little T. rex, as bevelled metal silhouettes
function dog() {
  return mesh(extrudeShape(s => {
    s.moveTo(-0.26, 0.02); s.lineTo(-0.22, 0.02); s.lineTo(-0.2, 0.12); s.lineTo(0.12, 0.12); s.lineTo(0.14, 0.02); s.lineTo(0.18, 0.02);
    s.lineTo(0.2, 0.2); s.lineTo(0.3, 0.2); s.quadraticCurveTo(0.34, 0.24, 0.3, 0.3);               // snout & beard
    s.lineTo(0.24, 0.33); s.lineTo(0.25, 0.44); s.lineTo(0.19, 0.36);                                // ear
    s.lineTo(0.13, 0.36); s.lineTo(0.12, 0.44); s.lineTo(0.08, 0.34);                                // second ear
    s.lineTo(0.06, 0.28); s.lineTo(-0.2, 0.28);                                                      // back
    s.lineTo(-0.26, 0.4); s.lineTo(-0.28, 0.38); s.lineTo(-0.25, 0.24);                              // tail
    s.lineTo(-0.27, 0.12); s.closePath();
  }, 0.12, 0.035));
}
function cat() {
  return mesh(extrudeShape(s => {
    s.moveTo(-0.16, 0.02); s.quadraticCurveTo(-0.24, 0.16, -0.12, 0.28); s.quadraticCurveTo(-0.06, 0.34, -0.02, 0.34);
    s.lineTo(-0.04, 0.46); s.lineTo(0.04, 0.38); s.lineTo(0.1, 0.38); s.lineTo(0.16, 0.46); s.lineTo(0.15, 0.33);   // ears
    s.quadraticCurveTo(0.2, 0.27, 0.13, 0.22); s.quadraticCurveTo(0.14, 0.1, 0.1, 0.02);
    s.lineTo(0.2, 0.02); s.quadraticCurveTo(0.3, 0.06, 0.26, 0.16); s.quadraticCurveTo(0.24, 0.05, 0.14, 0.04);       // tail curl
    s.lineTo(-0.16, 0.02);
  }, 0.14, 0.035));
}
function dino() {
  return mesh(extrudeShape(s => {
    s.moveTo(-0.36, 0.14); s.quadraticCurveTo(-0.15, 0.2, -0.08, 0.2);                             // tail
    s.lineTo(-0.1, 0.02); s.lineTo(-0.04, 0.02); s.lineTo(0.0, 0.16);                                // back leg
    s.lineTo(0.06, 0.16); s.lineTo(0.04, 0.02); s.lineTo(0.1, 0.02); s.lineTo(0.14, 0.22);           // front leg
    s.lineTo(0.18, 0.2); s.lineTo(0.2, 0.24);                                                        // little arm
    s.lineTo(0.16, 0.28); s.lineTo(0.18, 0.36); s.lineTo(0.34, 0.36); s.lineTo(0.36, 0.31); s.lineTo(0.24, 0.3); s.lineTo(0.3, 0.27);   // head & jaw
    s.lineTo(0.2, 0.26); s.quadraticCurveTo(0.12, 0.34, -0.04, 0.3); s.quadraticCurveTo(-0.2, 0.24, -0.36, 0.14);
  }, 0.12, 0.035));
}

function car() {
  const g = new THREE.Group();
  loadModel('token_car').then(m => {
    m.traverse(o => { if (o.isMesh) { o.material = pewter; o.castShadow = o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const s = 0.62 / Math.max(size.x, size.z);
    m.scale.setScalar(s);
    if (size.z > size.x) m.rotation.y = Math.PI / 2;           // nose along +x
    const b2 = new THREE.Box3().setFromObject(m);
    m.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
    g.add(m);
  });
  return g;
}

const FIGURES = { car, hat: topHat, dog, ship, dino, rocket, cat, crown };

// ------------------------------------------------------------------ the piece

const BASE_GEO = lathe([[0, 0.012], [0.27, 0.012], [0.29, 0.024], [0.29, 0.056], [0.265, 0.07], [0, 0.07]]);
const BAND_GEO = lathe([[0.288, 0.016], [0.304, 0.02], [0.304, 0.058], [0.288, 0.062]]);     // a broad painted band round the base
const PAD_GEO = lathe([[0, 0], [0.345, 0], [0.352, 0.006], [0.345, 0.012], [0, 0.012]]);      // a felt pad under it, same colour
// Every piece is pewter with the player's colour on its base: enamel band (slightly self-lit so it reads from afar) + felt pad.
export function makePewterToken(kind, color) {
  const g = new THREE.Group();
  const base = mesh(BASE_GEO);
  const enamel = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, emissive: color, emissiveIntensity: 0.28 });
  const felt = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  const band = mesh(BAND_GEO, enamel), pad = mesh(PAD_GEO, felt);
  pad.castShadow = false;
  const fig = (FIGURES[kind] || topHat)();
  fig.position.y = 0.07;
  if (kind === 'dog' || kind === 'cat' || kind === 'dino') fig.rotation.y = 0;   // silhouettes face +x already
  g.add(pad, base, band, fig);
  return { group: g, enamel, felt };
}
