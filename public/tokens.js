// The four playing pieces: a vintage car, a top hat, a Scottie dog and a tumbler of whiskey. Each one is painted in the
// player's colour (glossy enamel, a little self-lit so it reads in the dark) and stands on a pewter puck with a fat colour band.
// Underneath it lies a glowing disc with a bright ring in the same colour and a soft contact shadow, so the colour of every piece
// is plain at a glance, over dark asphalt and over the cream board alike. The car is Kenney's CC0 sedan (its body is repainted in
// the player's colour); the others are modelled here from turned (lathe) and extruded, bevelled profiles.
// Figures face +x (their direction of travel). Units: 1 unit = 4 cm.
import * as THREE from 'three';
import { loadModel } from './assets.js';

const pewter = new THREE.MeshPhysicalMaterial({ color: '#a9adb1', metalness: 1, roughness: 0.3, clearcoat: 0.15, clearcoatRoughness: 0.4 });
const darkPewter = new THREE.MeshPhysicalMaterial({ color: '#6f7377', metalness: 1, roughness: 0.45 });
let paints = [];                                   // weak: a scene's pieces may be thrown away at any time (new game, mode switch)
let envTex = null;
export function setTokenEnvironment(tex) {
  envTex = tex;
  paints = paints.filter(r => r.deref());
  for (const m of [pewter, darkPewter]) { m.envMap = tex; m.envMapIntensity = 1.6; m.needsUpdate = true; }
  for (const r of paints) { const m = r.deref(); if (m) { m.envMap = tex; m.envMapIntensity = 1.1; m.needsUpdate = true; } }
}

// the pieces on offer (server.js has the same list); anything else, e.g. a piece from before the cull, becomes the nearest of these
export const TOKEN_KINDS = ['car', 'hat', 'dog', 'glass'];
const LEGACY = { ship: 'car', rocket: 'car', dino: 'dog', cat: 'dog', crown: 'hat' };
export const tokenKind = k => (TOKEN_KINDS.includes(k) ? k : LEGACY[k] || 'hat');

const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const mesh = (geo, mat = pewter) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
function extrudeShape(draw, depth, bevel = 0.025) {
  const s = new THREE.Shape(); draw(s);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 4, curveSegments: 18 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
// the player's colour as glossy enamel (one per piece, recoloured by the scene)
function paintMaterial(color) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, emissive: color, emissiveIntensity: 0.34 });
  if (envTex) { m.envMap = envTex; m.envMapIntensity = 1.1; }
  paints.push(new WeakRef(m));
  return m;
}

// ------------------------------------------------------------------ figures (each takes the paint material)

function topHat(paint) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.36, 0], [0.385, 0.016], [0.37, 0.04], [0.225, 0.05], [0.205, 0.07], [0.22, 0.5], [0.235, 0.525], [0.22, 0.54], [0, 0.54]]), paint));
  g.add(mesh(lathe([[0.208, 0.08], [0.226, 0.08], [0.236, 0.18], [0.218, 0.18]]), pewter));          // a pewter hat band
  return g;
}

function dog(paint) {
  const g = new THREE.Group();
  const body = mesh(extrudeShape(s => {                                                             // a classic Scottie
    s.moveTo(-0.26, 0.02); s.lineTo(-0.22, 0.02); s.lineTo(-0.2, 0.12); s.lineTo(0.12, 0.12); s.lineTo(0.14, 0.02); s.lineTo(0.18, 0.02);
    s.lineTo(0.2, 0.2); s.lineTo(0.3, 0.2); s.quadraticCurveTo(0.34, 0.24, 0.3, 0.3);               // snout & beard
    s.lineTo(0.24, 0.33); s.lineTo(0.25, 0.44); s.lineTo(0.19, 0.36);                                // ear
    s.lineTo(0.13, 0.36); s.lineTo(0.12, 0.44); s.lineTo(0.08, 0.34);                                // second ear
    s.lineTo(0.06, 0.28); s.lineTo(-0.2, 0.28);                                                      // back
    s.lineTo(-0.26, 0.4); s.lineTo(-0.28, 0.38); s.lineTo(-0.25, 0.24);                              // tail
    s.lineTo(-0.27, 0.12); s.closePath();
  }, 0.14, 0.04), paint);
  g.add(body);
  for (const z of [-0.085, 0.085]) { const eye = mesh(new THREE.SphereGeometry(0.02, 10, 8), darkPewter); eye.position.set(0.2, 0.3, z); g.add(eye); }
  const collar = mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 24), pewter); collar.position.set(0.12, 0.24, 0); collar.rotation.y = Math.PI / 2; collar.scale.set(1, 1.4, 1);
  g.add(collar);
  g.scale.setScalar(1.1);
  return g;
}

// a short tumbler: thick glass, the player's colour as the whiskey, one ice cube, a pewter rim
const GLASS = new THREE.MeshPhysicalMaterial({ color: '#9db3c4', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.2, depthWrite: false });
function glass(paint) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(lathe([[0, 0.002], [0.2, 0.002], [0.225, 0.02], [0.27, 0.46], [0.255, 0.46], [0.205, 0.1], [0, 0.1]]), GLASS);
  shell.renderOrder = 2; g.add(shell);
  const whiskey = mesh(lathe([[0, 0.1], [0.203, 0.1], [0.257, 0.34], [0, 0.34]]), paint); whiskey.castShadow = false; g.add(whiskey);
  const top = mesh(new THREE.CircleGeometry(0.257, 36), paint); top.rotation.x = -Math.PI / 2; top.position.y = 0.341; top.castShadow = false; g.add(top);
  const ice = mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), new THREE.MeshPhysicalMaterial({ color: '#f4fbff', roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.66, depthWrite: false }));
  ice.position.set(0.02, 0.37, -0.02); ice.rotation.set(0.3, 0.7, 0.2); ice.castShadow = false; ice.renderOrder = 3; g.add(ice);
  const rim = mesh(new THREE.TorusGeometry(0.263, 0.012, 8, 40), pewter); rim.rotation.x = Math.PI / 2; rim.position.y = 0.46; g.add(rim);
  return g;
}

// Kenney's sedan: the red-orange paint of the body (found by the colour its texture gives each triangle) is split into its own mesh
// and takes the player's colour; tyres, glass and lights keep their own look. Wheels turn to a pewter-grey hub-cap finish.
function car(paint) {
  const g = new THREE.Group();
  loadModel('token_car').then(m => {
    let src = null;
    m.traverse(o => { if (o.isMesh && !src) src = o; });
    if (!src) return;
    const img = src.material.map && src.material.map.image;
    const geo = src.geometry, uv = geo.attributes.uv, idx = geo.index;
    let isPaint = () => false;
    if (img && img.width) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
      const px = cx.getImageData(0, 0, c.width, c.height).data, flip = src.material.map.flipY;
      isPaint = (u, v) => {
        const p = (Math.min(c.height - 1, Math.floor((flip ? 1 - v : v) * c.height)) * c.width + Math.min(c.width - 1, Math.floor(u * c.width))) * 4;
        return px[p] > 190 && px[p] - px[p + 2] > 90;                 // the saturated red-orange of the bodywork
      };
    }
    const bodyIdx = [], restIdx = [];
    for (let i = 0; i < idx.count; i += 3) {
      let u = 0, v = 0;
      for (let k = 0; k < 3; k++) { u += uv.getX(idx.getX(i + k)); v += uv.getY(idx.getX(i + k)); }
      (isPaint(u / 3, v / 3) ? bodyIdx : restIdx).push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    }
    const make = (list, mat) => { const gg = geo.clone(); gg.setIndex(list); const mm = new THREE.Mesh(gg, mat); mm.castShadow = mm.receiveShadow = true; return mm; };
    const root = new THREE.Group();
    const rest = src.material.clone(); rest.metalness = 0.4; rest.roughness = 0.45;
    root.add(make(bodyIdx, paint), make(restIdx, rest));
    root.position.copy(src.position); root.quaternion.copy(src.quaternion); root.scale.copy(src.scale);
    const wrap = new THREE.Group(); wrap.add(root);
    const box = new THREE.Box3().setFromObject(wrap);
    const size = box.getSize(new THREE.Vector3());
    const s = 0.7 / Math.max(size.x, size.z);
    wrap.scale.setScalar(s);
    if (size.z > size.x) wrap.rotation.y = Math.PI / 2;           // nose along +x
    const b2 = new THREE.Box3().setFromObject(wrap);
    wrap.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
    g.add(wrap);
  });
  return g;
}

const FIGURES = { car, hat: topHat, dog, glass };

// ------------------------------------------------------------------ the piece

const LIFT = 0.05;                                                                                   // the puck floats a hair above its glow
const PUCK_GEO = lathe([[0, 0.012], [0.27, 0.012], [0.29, 0.03], [0.29, 0.07], [0.262, 0.088], [0, 0.088]]);
const BAND_GEO = lathe([[0.286, 0.022], [0.306, 0.028], [0.306, 0.066], [0.286, 0.074]]);            // a fat painted band round the puck
const DISC_R = 0.46;                                                                                 // half-size of the glow plane; its bright ring sits at 0.8 of it

// two shared canvas textures: a glowing disc with a crisp ring, and a soft contact shadow
let glowTex = null, shadowTex = null, discGeo = null;
function groundTextures() {
  if (glowTex) return;
  const mk = draw => { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  glowTex = mk(g => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,.42)'); gr.addColorStop(0.55, 'rgba(255,255,255,.3)'); gr.addColorStop(0.76, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 9; g.beginPath(); g.arc(128, 128, 102, 0, Math.PI * 2); g.stroke();       // the crisp ring (0.8 of the radius)
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 16; g.beginPath(); g.arc(128, 128, 102, 0, Math.PI * 2); g.stroke();
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
export function makePewterToken(kind, color) {
  groundTextures();
  kind = tokenKind(kind);
  const g = new THREE.Group();
  const enamel = paintMaterial(color);
  const puck = mesh(PUCK_GEO, darkPewter), band = mesh(BAND_GEO, enamel);
  const fig = FIGURES[kind](enamel);
  fig.position.y = 0.088;
  g.add(puck, band, fig);
  g.position.y = LIFT;

  const ground = new THREE.Group();
  const felt = new THREE.MeshBasicMaterial({ color, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const glowMesh = new THREE.Mesh(discGeo, felt); glowMesh.scale.setScalar(DISC_R * 2); glowMesh.position.y = 0.01; glowMesh.renderOrder = 1;
  const blobMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const blob = new THREE.Mesh(discGeo, blobMat); blob.scale.setScalar(0.92); blob.position.y = 0.006; blob.renderOrder = 0;
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), new THREE.MeshBasicMaterial()); hit.position.y = 0.4; hit.visible = false;
  hit.userData.tokenHit = true;
  ground.add(blob, glowMesh, hit);
  return { group: g, ground, enamel, felt, hit };
}
export const TOKEN_TAG_Y = 0.78;                                                                     // the name tag floats this high above the base (token units)

// ------------------------------------------------------------------ the name tag shown when the mouse rests on a piece
// A small noir plaque in the player's colour over the piece. Plain HTML over the canvas, placed every frame; the same in both modes.
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
      el.style.setProperty('--tc', color); el.style.setProperty('--tcg', color + '66');
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
