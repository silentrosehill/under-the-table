// City Mode: the board as a model city someone built and plays on at night. It stands on the same
// worn table, in the same dark room, under the same hanging bulb as Table Mode (room.js, props.js,
// post.js), so the two modes share one atmosphere. Same game state and same API as scene3d.js, so
// app.js can swap one for the other at any time without touching the game.
// The loop: a raised square of city per board square, one narrow wet street running through all of
// them, a paved square in the middle where the dice land. The pieces are the pewter tokens.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPost } from '../post.js';
import { createRoom } from '../room.js';
import { createProps, viewYaw } from '../props.js';
import { createDice } from '../dice.js';
import { makeWheel3D } from '../wheel3d.js';
import { makePewterToken, setTokenEnvironment } from '../tokens.js';
import { BOARD_T } from '../board.js';
import { sfx } from '../sfx.js';
import { t as tr } from '../i18n.js';
import { fmtMoney } from '../money.js';
import { preload, make, bake, groundClip } from './kit.js';
import { tileFrame, lanePoint, roadPoint, yawOf, D, C, H, TW, ROAD, CARRIAGE, LOT, BASE_H, LANE } from './layout.js';
import { DISTRICTS, districtOf, LANDMARKS, SPECIALS, slugName, modelList, placeAll, FAN } from './districts.js';
import { createBubbles } from './bubbles.js';
import { createPlates } from './plates.js';
import { createLife } from './life.js';
import { ARCH } from './archetypes.js';
import { LEVEL_ARCH } from './levels.js';
import { buildCasino } from './casino.js';
const CASINO_SIGNS = { 7: 'ACE CLUB', 22: 'CASINO', 36: 'ROYALE' };     // the neon over each casino square
import { createTileFx } from './tilefx.js';
import { effectMult, effectTags, tileEffects as tileEffectsOf } from '../effects.js';

Object.assign(ARCH, LEVEL_ARCH);                   // the single-building levels of every district (bowery.js, london.js …)
const S = 1.15;                                  // city units → table units (the plinth, 14.1 across, still sits inside the 30-deep table; was 1.04 before the squares got narrower)
const CS = TW;                                   // the buildings of a side square are scaled with its frontage (1 → TW): footprints keep their ratios and stay inside the lot
const DEPTH_K = 0.8;                             // and squeezed front-to-back a little, so they stay clear of the name plates
const KS = S / 0.9;                              // the camera moves were tuned at S = 0.9
const TABLE_Y = -BOARD_T - 0.003;                // the table top, as in Table Mode
const PLINTH = 0.08;
const KERB = -D / 2 + ROAD;                      // where a side square's lot starts (local z)
const PLAZA_Y = BASE_H;                          // the square in the middle is level with the streets
const TOKEN_S = 0.5;
const easeInOut = k => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const rand = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------ painted surfaces (drawn once)
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
const noise = (g, n, alpha, light) => { for (let k = 0; k < n; k++) { g.fillStyle = `rgba(${light ? '255,255,255' : '0,0,0'},${Math.random() * alpha})`; g.fillRect(Math.random() * g.canvas.width, Math.random() * g.canvas.height, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
// wet asphalt: near black, grit, a faint worn centre line
const asphaltTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#1b1b1e'; g.fillRect(0, 0, s, s);
  noise(g, 5000, 0.12, true); noise(g, 3000, 0.4, false);
  g.fillStyle = 'rgba(200,190,160,.2)';
  for (let x = 6; x < s; x += 64) g.fillRect(x, s / 2 - 2, 34, 4);
});
// old setts, almost black, with mortar picking up the light
const cobbleTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#2b2824'; g.fillRect(0, 0, s, s);
  for (let row = 0; row < 14; row++) {
    let x = row % 2 ? -9 : 0;
    while (x < s) {
      const w = 13 + Math.random() * 8, y = row * (s / 14) + 1.2, l = 30 + Math.random() * 20 | 0;
      g.fillStyle = `rgb(${l + 6},${l + 3},${l})`;
      g.beginPath(); g.roundRect(x + 1.2, y, w - 2.4, s / 14 - 2.4, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.roundRect(x + 2.5, y + 1, w - 6, 4, 2); g.fill();
      x += w;
    }
  }
  noise(g, 2000, 0.25, false);
});
// cracked, patched dark asphalt: no centre line, pale repairs, tar seams
const wornTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#1e1c1b'; g.fillRect(0, 0, s, s);
  noise(g, 6000, 0.14, true); noise(g, 3500, 0.45, false);
  for (let k = 0; k < 5; k++) {                         // patches of newer, darker tar
    g.fillStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * s * 0.8, Math.random() * s * 0.8, 30 + Math.random() * 60, 18 + Math.random() * 40);
  }
  g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 1.4;
  for (let k = 0; k < 9; k++) {                         // cracks
    let x = Math.random() * s, y = Math.random() * s;
    g.beginPath(); g.moveTo(x, y);
    for (let n = 0; n < 6; n++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(160,150,130,.08)'; g.lineWidth = 1;
  for (let k = 0; k < 6; k++) { const y = Math.random() * s; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + (Math.random() - 0.5) * 8); g.stroke(); }
});
const pavementTex = () => canvasTex(128, (g, s) => {
  g.fillStyle = '#3a3631'; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2;
  for (let x = 0; x <= s; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
  for (let y = 0; y <= s; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
  noise(g, 900, 0.3, false); noise(g, 400, 0.06, true);
});
const groundTex = () => canvasTex(128, (g, s) => {
  g.fillStyle = '#2e2b27'; g.fillRect(0, 0, s, s);
  noise(g, 2500, 0.35, false); noise(g, 700, 0.07, true);
  g.fillStyle = 'rgba(0,0,0,.25)';
  for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 10 + Math.random() * 20, 6 + Math.random() * 10, Math.random() * 3, 0, 7); g.fill(); }
});

// lettering behind dark glass, lit from inside: station, kiosk, gate, police, shop boards, neon
// tones: [letters, border, glow]; icons: 'pawn' (three balls), 'marquee' (a ring of bulbs)
const TONES = {
  amber: ['#ffd9a0', '#8a6d3b', '#ffb257'], blue: ['#bcd6f2', '#5f7f9c', '#7fa6d6'], pink: ['#ffb3d9', '#d0608a', '#ff5fa8'], red: ['#ffb0a0', '#c04030', '#ff4a36'],
  green: ['#c8f0c0', '#4f8f5a', '#6fe08a'], cyan: ['#bff4ff', '#4f9fb0', '#58d8f0'], gold: ['#fff0c0', '#b0894a', '#ffd070'], white: ['#f4f0e8', '#8a8478', '#ffe9c4'],
};
const signTextures = new Map();
function signTexture(text, tone, icon) {
  const key = `${text}|${tone}|${icon || ''}`;
  if (signTextures.has(key)) return signTextures.get(key);
  const [ink, edge] = TONES[tone] || TONES.amber;
  const t = canvasTex(512, (g, s) => {
    g.fillStyle = icon === 'marquee' ? '#1a0d0c' : '#0d0c0b'; g.fillRect(0, s * 0.3, s, s * 0.4);
    g.strokeStyle = edge; g.lineWidth = 6; g.strokeRect(8, s * 0.3 + 8, s - 16, s * 0.4 - 16);
    if (icon === 'marquee') {                           // a ring of bulbs round the board
      g.fillStyle = '#ffe9b0';
      for (let x = 22; x < s - 10; x += 30) { g.beginPath(); g.arc(x, s * 0.3 + 20, 6, 0, 7); g.arc(x, s * 0.7 - 20, 6, 0, 7); g.fill(); }
      for (let y = s * 0.3 + 50; y < s * 0.7 - 30; y += 30) { g.beginPath(); g.arc(22, y, 6, 0, 7); g.arc(s - 22, y, 6, 0, 7); g.fill(); }
    }
    let cx = s / 2;
    if (icon === 'pawn') {                              // the pawnbroker's three balls
      g.fillStyle = '#e0b84f';
      for (const [x, y] of [[70, s * 0.5 + 24], [130, s * 0.5 + 24], [100, s * 0.5 - 28]]) { g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill(); }
      cx = s / 2 + 60;
    }
    const size = Math.min(icon === 'pawn' ? 100 : 120, (icon === 'pawn' ? 620 : 900) / text.length);
    g.font = `600 ${size}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.letterSpacing = '12px';
    g.fillStyle = ink;
    g.fillText(text, cx, s / 2 + 4);
  });
  signTextures.set(key, t);
  return t;
}
// a column of small boards, one under the other, each with its letters stacked: [[text, tone], …] → { map, aspect }
const vsignTextures = new Map();
function vsignTexture(stack) {
  const key = JSON.stringify(stack);
  if (vsignTextures.has(key)) return vsignTextures.get(key);
  const W = 96, cell = 66, pad = 18, H = stack.reduce((n, [t]) => n + t.length * cell + pad, 0);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); let y = 0;
  for (const [text, tone] of stack) {
    const [ink, edge] = TONES[tone] || TONES.amber, h = text.length * cell + pad;
    g.fillStyle = '#0d0c0b'; g.fillRect(3, y + 2, W - 6, h - 4);
    g.strokeStyle = edge; g.lineWidth = 4; g.strokeRect(6, y + 5, W - 12, h - 10);
    g.font = '600 50px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink;
    [...text].forEach((ch, k) => g.fillText(ch, W / 2, y + pad / 2 + (k + 0.5) * cell + 2));
    y += h;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const out = { map: t, aspect: H / W };
  vsignTextures.set(key, out);
  return out;
}
function clockTexture() {
  return canvasTex(128, g => {
    g.fillStyle = '#cfc4ab'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.strokeStyle = '#2a2420'; g.lineWidth = 5; g.stroke();
    g.lineWidth = 3;
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.beginPath(); g.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); g.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 28); g.stroke(); g.beginPath(); g.moveTo(64, 64); g.lineTo(90, 64); g.stroke();
  });
}

export function createCityScene(container, { onTileClick, onCard }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;               // buildings rise out of the ground; the cigarette burns down
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minDistance = 3;
  controls.maxDistance = 60;

  // the back room, exactly as in Table Mode: table, bulb, smoke, props
  const room = createRoom(scene, renderer, { tableY: TABLE_Y });
  const post = createPost(renderer, scene, camera, { onShadowSize: size => room.setShadowSize(size) });
  room.envReady.then(setTokenEnvironment);
  let props = null, lastState = null, alive = true;
  Promise.all(['24px "Special Elite"', '600 40px Oswald', '400 40px "Abril Fatface"', '34px Caveat'].map(f => document.fonts.load(f)))
    .catch(() => {}).then(() => { if (!alive) return; props = createProps(scene, { tableY: TABLE_Y }); if (lastState) props.sync(lastState); });

  // the model city: everything below is in city units inside this group
  const city = new THREE.Group();
  city.scale.setScalar(S);
  city.position.y = TABLE_Y + PLINTH * S;
  scene.add(city);
  groundClip.constant = -(city.position.y + (BASE_H - 0.002) * S);
  const world = new THREE.Group(); city.add(world);
  const fxGroup = new THREE.Group(); city.add(fxGroup);
  const bubbles = createBubbles(container);
  const plates = createPlates();
  let labelStyle = 'street';                          // 'street' (name plates on the pavement) | 'signs' (floating enamel signs)
  document.fonts.ready.then(() => plates.redrawAll()).catch(() => {});
  const life = createLife(city, { lights: 4 });
  const tex = { asphalt: asphaltTex(), cobble: cobbleTex(), worn: wornTex(), pavement: pavementTex(), ground: groundTex() };
  const mats = {};
  const matOf = (key, build) => (mats[key] ||= build());
  const std = (color, o = {}) => matOf(color + JSON.stringify(o), () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));
  const iron = () => std('#141414', { roughness: 0.5, metalness: 0.6 });

  // the plinth the model is built on: dark stained wood
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(2 * H + 0.3, PLINTH, 2 * H + 0.3, 2, 0.03), std('#1c1511', { roughness: 0.6 }));
  plinth.position.y = -PLINTH / 2; plinth.receiveShadow = plinth.castShadow = true;
  city.add(plinth);

  // ------------------------------------------------------------ small built pieces
  let signId = 0;
  // street lamps, one model per district (district.lamp): the bodies merge into one mesh, the bulb stays apart so it can glow
  const LAMPS = {
    cobra: { bulb: '#ffb36a', r: 0.011 }, bare: { bulb: '#ffd36a', r: 0.014 }, gas: { bulb: '#ffd27a', r: 0.012 }, ornate: { bulb: '#ffc9a0', r: 0.011 },
    pole: { bulb: '#cfe4ff', r: 0.008 }, mast: { bulb: '#ff8a2a', r: 0.013 }, deco: { bulb: '#ffe0a8', r: 0.017 }, candle: { bulb: '#fff0cc', r: 0.012 },
  };
  const brass = () => std('#8a6d38', { roughness: 0.4, metalness: 0.7 });
  const goldM = () => std('#c9a24f', { roughness: 0.35, metalness: 0.8 });
  const wood = () => std('#2a2118', { roughness: 0.9 });
  function lamp(kind = 'cobra') {
    const spec = LAMPS[kind] || LAMPS.cobra, parts = new THREE.Group(), bulbs = [];
    const add = (geo, x, y, z, mat, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); parts.add(m); return m; };
    const cyl = (r0, r1, h, seg = 6) => new THREE.CylinderGeometry(r0, r1, h, seg), box = (w, h, d) => new THREE.BoxGeometry(w, h, d), ball = r => new THREE.SphereGeometry(r, 8, 6);
    const bulbAt = (x, y, z, r = spec.r) => bulbs.push([x, y, z, r]);
    if (kind === 'bare') {                              // a bare bulb on a short bracket off a dark wooden pole
      add(cyl(0.008, 0.012, 0.46), 0, 0.23, 0, wood()); add(box(0.008, 0.008, 0.07), 0, 0.44, -0.035, iron()); add(cyl(0.004, 0.004, 0.03, 4), 0, 0.42, -0.07, iron());
      bulbAt(0, 0.4, -0.07);
    } else if (kind === 'gas') {                        // a fluted post with a ladder bar and a square glass lantern
      add(cyl(0.012, 0.016, 0.06), 0, 0.03, 0, iron()); add(cyl(0.006, 0.01, 0.4), 0, 0.26, 0, iron()); add(box(0.05, 0.005, 0.005), 0, 0.39, 0, iron());
      add(box(0.04, 0.01, 0.04), 0, 0.46, 0, iron()); add(new THREE.ConeGeometry(0.032, 0.03, 4).rotateY(Math.PI / 4), 0, 0.535, 0, iron());
      for (const [x, z] of [[-0.016, -0.016], [0.016, -0.016], [-0.016, 0.016], [0.016, 0.016]]) add(box(0.004, 0.06, 0.004), x, 0.495, z, iron());
      bulbAt(0, 0.495, 0);
    } else if (kind === 'ornate') {                     // scrolled base, curved arms, two frosted globes
      add(cyl(0.02, 0.026, 0.05, 8), 0, 0.025, 0, iron()); add(cyl(0.008, 0.013, 0.36, 8), 0, 0.23, 0, iron()); add(ball(0.014), 0, 0.42, 0, iron());
      for (const s of [-1, 1]) { add(box(0.07, 0.006, 0.006), s * 0.035, 0.42, 0, iron()); add(cyl(0.006, 0.01, 0.025, 6), s * 0.07, 0.43, 0, iron()); bulbAt(s * 0.07, 0.458, 0, 0.017); }
    } else if (kind === 'pole') {                       // a utility pole with a crossarm and a fluorescent tube
      add(cyl(0.007, 0.011, 0.54), 0, 0.27, 0, wood()); add(box(0.12, 0.008, 0.012), 0, 0.5, 0, wood());
      add(box(0.09, 0.008, 0.018), 0, 0.455, -0.045, iron()); add(box(0.008, 0.008, 0.05), 0, 0.47, -0.02, iron());
      bulbAt(0, 0.446, -0.045, 0.008);
    } else if (kind === 'mast') {                       // a tall mast with a caged sodium floodlight
      add(cyl(0.008, 0.014, 0.66), 0, 0.33, 0, iron()); add(box(0.008, 0.008, 0.08), 0, 0.65, -0.04, iron());
      add(box(0.05, 0.016, 0.05), 0, 0.655, -0.09, iron()); add(box(0.056, 0.004, 0.056), 0, 0.67, -0.09, iron());
      bulbAt(0, 0.64, -0.09, 0.016);
    } else if (kind === 'deco') {                       // a stepped brass post with one big frosted globe
      add(cyl(0.024, 0.03, 0.025, 8), 0, 0.012, 0, brass()); add(cyl(0.014, 0.02, 0.03, 8), 0, 0.04, 0, brass()); add(cyl(0.007, 0.011, 0.3, 8), 0, 0.2, 0, brass());
      add(cyl(0.02, 0.012, 0.014, 8), 0, 0.352, 0, brass());
      bulbAt(0, 0.385, 0);
    } else if (kind === 'candle') {                     // a gold candelabra: two lanterns on a crossbar
      add(cyl(0.02, 0.026, 0.04, 8), 0, 0.02, 0, goldM()); add(cyl(0.006, 0.01, 0.36, 8), 0, 0.22, 0, goldM()); add(box(0.1, 0.006, 0.006), 0, 0.4, 0, goldM());
      for (const s of [-1, 1]) { add(cyl(0.012, 0.008, 0.02, 6), s * 0.05, 0.415, 0, goldM()); add(cyl(0.004, 0.004, 0.014, 4), s * 0.05, 0.445, 0, goldM()); bulbAt(s * 0.05, 0.43, 0, 0.011); }
    } else {                                            // cobra head: pole, arm, a shaded head over the bulb
      add(cyl(0.007, 0.011, 0.5), 0, 0.25, 0, iron()); add(box(0.008, 0.008, 0.09), 0, 0.49, -0.04, iron()); add(cyl(0.012, 0.022, 0.03), 0, 0.475, -0.085, iron());
      bulbAt(0, 0.458, -0.085);
    }
    const g = new THREE.Group();
    g.add(bake(parts));
    const mat = new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: spec.bulb, emissiveIntensity: 1.2 });
    bulbs.forEach(([x, y, z, r], k) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat); b.position.set(x, y, z); g.add(b); if (!k) g.userData.bulb = b; });
    return g;
  }
  function sign(text, { w = 0.5, blue = false, tone = null, icon = null, calm = 0.12 } = {}) {
    tone = tone || (blue ? 'blue' : 'amber');
    const map = signTexture(text, tone, icon);
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: TONES[tone][2], emissiveIntensity: 0, transparent: true, alphaTest: 0.05, roughness: 0.6 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w), m);
    mesh.userData.id = signId++ * 7.3; mesh.userData.calm = calm;
    return mesh;
  }
  // code-built pieces named in districts.js
  function extras(kind, text, o, glow, dist, tileI) {
    if (ARCH[kind]) return kind === 'bld' ? ARCH.bld(text, o, glow) : ARCH[kind]({ ...o, glowKey: glow });      // archetype buildings and big pieces (archetypes.js)
    if (kind === 'casino') return buildCasino({ sign, std, iron, brass, goldM, dot: dotTex, name: CASINO_SIGNS[tileI] });
    const g = new THREE.Group();
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (kind === 'lamp') g.add(lamp(dist && dist.lamp));
    else if (kind === 'sign') { const s = sign(text, o); s.rotation.y = Math.PI; g.add(s); g.userData.sign = s; }
    else if (kind === 'roofsign') {                     // a lit sign standing on the roof on two iron legs
      const s = sign(text, { w: o.w || 0.5, tone: 'gold', calm: 0.4 }); s.rotation.y = Math.PI; s.position.y = (o.w || 0.5) * 0.2 + 0.05; g.add(s); g.userData.sign = s;
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.01), iron()); p.position.set(sx * (o.w || 0.5) * 0.36, 0.035, 0); g.add(p); }
    } else if (kind === 'vsign') {                      // a column of small signs: one face to the street, one blade across it
      const { map, aspect } = vsignTexture(o.stack), w = o.w || 0.06;
      const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0, transparent: true, alphaTest: 0.05, roughness: 0.6, side: THREE.DoubleSide });
      const geo = new THREE.PlaneGeometry(w, w * aspect);
      const face = new THREE.Mesh(geo, m); face.rotation.y = Math.PI; g.add(face);
      const blade = new THREE.Mesh(geo, m); blade.rotation.y = Math.PI / 2; blade.position.z = -0.0; g.add(blade);
      face.userData.id = signId++ * 7.3; face.userData.calm = 0.35; g.userData.sign = face;
    }
    else if (kind === 'water') {                        // a strip of dark water, a hair above the ground
      const w = new THREE.Mesh(new THREE.BoxGeometry(o.w || 0.9, 0.006, o.d || 0.4), std('#0a1217', { roughness: 0.15, metalness: 0.2 }));
      w.position.y = 0.003; w.receiveShadow = true; g.add(w);
    } else if (kind === 'booth') {                        // a phone box: dark frame, dirty glass, a dim light inside
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), std('#3a1714', { roughness: 0.5 }));
      frame.position.y = 0.12; frame.castShadow = true;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.17, 0.104), new THREE.MeshStandardMaterial({ color: '#1b1d1c', emissive: '#ffcc88', emissiveIntensity: 0.25, roughness: 0.2 }));
      glass.position.y = 0.12;
      g.add(frame, glass);
      g.userData.live = true;
    } else if (kind === 'bars') {                        // bars across the jail's ground floor
      for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), iron()); b.position.set(-0.24 + k * 0.06, 0.1, 0); g.add(b); }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.01, 0.01), iron()); rail.position.y = 0.2; g.add(rail);
    } else if (kind === 'lines') {                       // parking bays painted on old tarmac
      const tar = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.45 }));
      tar.rotation.x = -Math.PI / 2; tar.position.y = 0.002; tar.receiveShadow = true; g.add(tar);
      for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.32), std('#8f897b', { roughness: 0.6 })); l.rotation.x = -Math.PI / 2; l.position.set(-0.46 + k * 0.23, 0.004, -0.3); g.add(l); }
    } else if (kind === 'clock') {                       // a clock face over the door, faintly lit
      const map = clockTexture();
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), new THREE.MeshStandardMaterial({ map, emissive: '#ffe1b0', emissiveMap: map, emissiveIntensity: 0.18, roughness: 0.5 }));
      face.rotation.y = Math.PI;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 32), std('#7d6234', { metalness: 0.7, roughness: 0.35 }));
      g.add(face, rim);
      g.userData.live = true;
    } else if (kind === 'barred') {                      // rows of small windows: dark recesses behind iron bars (o.cols × o.rows, spaced o.dx × o.dy)
      const { cols = 4, rows = 2, dx = 0.14, dy = 0.15, ww = 0.07, wh = 0.1 } = o;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * dx, y = r * dy;
        const hole = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, 0.012), std('#050505', { roughness: 1 })); hole.position.set(x, y, -0.002);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.025, 0.01, 0.022), std('#3a3732')); sill.position.set(x, y - wh / 2 - 0.004, -0.008);
        const top = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.025, 0.01, 0.022), std('#3a3732')); top.position.set(x, y + wh / 2 + 0.004, -0.008);
        g.add(hole, sill, top);
        for (const bx of [-0.022, 0, 0.022]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.004, wh, 0.006), iron()); b.position.set(x + bx, y, -0.01); g.add(b); }
        const mid = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.004, 0.006), iron()); mid.position.set(x, y, -0.01); g.add(mid);
      }
    } else if (kind === 'globe') {                        // a police lamp: iron post, small blue glass globe
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, o.h || 0.26, 6), iron()); post.position.y = (o.h || 0.26) / 2; post.castShadow = true;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshStandardMaterial({ color: '#101820', emissive: '#4f86d8', emissiveIntensity: 1.4, roughness: 0.3 }));
      ball.position.y = (o.h || 0.26) + 0.018;
      g.add(post, ball);
      g.userData.live = true;
    } else if (kind === 'fireescape') {                   // iron landings and zig-zag stairs on a street front (o.h = building height, o.w = its width)
      const fl = o.fl || 0.26, y0 = o.y0 || 0, n = Math.max(1, Math.floor(((o.h || 0.8) - 0.08 - y0) / fl)), W = Math.min((o.w || 0.4) * 0.72, 0.4), mat = std('#222120', { roughness: 0.5, metalness: 0.5 });
      const add = (geo, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; g.add(m); return m; };
      for (let k = 1; k <= n; k++) {
        const y = y0 + k * fl;
        add(new THREE.BoxGeometry(W, 0.006, 0.06), 0, y, -0.03);
        add(new THREE.BoxGeometry(W, 0.004, 0.004), 0, y + 0.05, -0.06);
        add(new THREE.BoxGeometry(W, 0.003, 0.003), 0, y + 0.025, -0.06);
        for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.004, 0.05, 0.004), sx * W / 2, y + 0.025, -0.06);
        if (k < n) {                                       // the flight up to the next landing, alternating sides
          const dir = k % 2 ? 1 : -1, dx = (W - 0.06) * dir, len = Math.hypot(dx, fl);
          add(new THREE.BoxGeometry(len, 0.006, 0.03), 0, y + fl / 2, -0.045, Math.atan2(fl, dx));
        }
      }
      add(new THREE.BoxGeometry(0.01, fl + y0, 0.01), -W / 2 + 0.03, (fl + y0) / 2, -0.055);                  // the drop ladder to the pavement
      add(new THREE.BoxGeometry(0.01, fl + y0, 0.01), -W / 2 + 0.07, (fl + y0) / 2, -0.055);
    } else if (kind === 'cornice') {                      // a thin stone ledge across a building front (o.w wide, at o.y)
      const w = o.w || 0.46;
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.022, 0.05), std('#3a3631')); ledge.position.set(0, 0, -0.022);
      const under = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.012, 0.03), std('#2e2b27')); under.position.set(0, -0.016, -0.012);
      ledge.castShadow = true; g.add(ledge, under);
    } else if (kind === 'shopsign') {                     // a small board over the shop door: dim until the square wakes, then lit like any sign
      const s = sign(text, { w: o.w || 0.22 }); s.rotation.y = Math.PI; s.userData.calm = 0.03; g.add(s); g.userData.sign = s;
    } else if (kind === 'platform') {                    // a stone platform under an iron canopy
      const plat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.3), std('#3b3833')); plat.position.y = 0.025; plat.castShadow = plat.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.34), iron()); roof.position.y = 0.32; roof.castShadow = true;
      g.add(plat, roof);
      for (const x of [-0.4, 0, 0.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 5), iron()); p.position.set(x, 0.18, 0); g.add(p); }
    }
    return g;
  }

  // ------------------------------------------------------------ the streets: narrow, wet, empty
  // a district's own pavement and ground colour: the shared texture multiplied towards the target colour
  const towards = (target, base) => { const c = new THREE.Color(target), b = new THREE.Color(base); return c.setRGB(c.r / b.r, c.g / b.g, c.b / b.b); };
  const pavementMat = d => matOf('pave' + (d && d.pave || ''), () => new THREE.MeshStandardMaterial({ map: tex.pavement, roughness: d && d.glossy ? 0.3 : 0.7, metalness: d && d.glossy ? 0.15 : 0, color: d && d.pave ? towards(d.pave, '#3a3631') : '#ffffff' }));
  const groundMat = d => matOf('ground' + (d && d.ground || ''), () => new THREE.MeshStandardMaterial({ map: tex.ground, roughness: d && d.glossy ? 0.5 : 0.9, color: d && d.ground ? towards(d.ground, '#2e2b27') : '#ffffff' }));
  // the carriageway: wet dark asphalt. A tinted street carries the district's muted colour in its vertex colours: the shader multiplies the
  // (near black) texture by it and adds a faint emission of the same colour, so the hue holds up under the amber lamp light
  const carriageMat = (kind, tinted) => matOf('road-' + kind + (tinted ? '-tint' : ''), () => {
    const m = new THREE.MeshPhysicalMaterial({ map: tex[kind], vertexColors: !!tinted, roughness: 0.32, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    if (tinted) {
      m.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <color_fragment>', `diffuseColor.rgb *= vColor.rgb * ${(ROAD_DIFFUSE * (ROAD_GAIN[kind] || 1)).toFixed(2)};`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * ${ROAD_GLOW.toFixed(3)};`);
      };
      m.customProgramCacheKey = () => 'roadtint-' + kind;
    }
    return m;
  });
  const ROAD_GAIN = { asphalt: 1, worn: 0.85, cobble: 0.45 };            // the textures differ in brightness: the same wash should look the same on each
  const ROAD_DIFFUSE = 7, ROAD_GLOW = 0.055, SMOOTH = k => k * k * (3 - 2 * k);
  const washColor = hex => new THREE.Color(hex);
  const SIDE = (ROAD - CARRIAGE) / 2;
  // a vertex colour attribute from a weight function: w = 1 gives colour a, w = 0 colour b (a, b: THREE.Color or null for white)
  function paintVerts(geo, a, b, weight) {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), w0 = new THREE.Color(1, 1, 1), c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const w = weight(pos.getX(k), pos.getY(k));
      c.copy(b || w0).lerp(a || w0, w);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }
  // tint = { a, b, ha, hb }: wash colours (a: the earlier run along the street, b: the later one) and their hex for the painted kerb lines
  function streetStraight(kind, len = 1, d = null, tint = null) {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(len, CARRIAGE, 8, 1);
    paintVerts(geo, tint && tint.a, tint && tint.b, x => SMOOTH(Math.max(0, Math.min(1, (x + len / 4) / (len / 2)))));      // local +x runs against play: the earlier square is on the +x side
    const road = new THREE.Mesh(geo, carriageMat(kind, !!tint));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.002; road.receiveShadow = true;
    g.add(road);
    for (const s of [-1, 1]) {
      const pave = new THREE.Mesh(new THREE.BoxGeometry(len, 0.022, SIDE), pavementMat(d));
      pave.position.set(0, 0.011, s * (CARRIAGE + SIDE) / 2); pave.receiveShadow = pave.castShadow = true;
      g.add(pave);
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.024, 0.012), std('#4a4640', { roughness: 0.6 }));
      kerb.position.set(0, 0.012, s * CARRIAGE / 2); g.add(kerb);
      if (tint) for (const [h, x0] of [[tint.ha, 0.25], [tint.hb, -0.25]]) {               // a thin painted line along each kerb, in the district's colour (two halves, one per side of the seam)
        const line = new THREE.Mesh(new THREE.BoxGeometry(len / 2, 0.0016, 0.01), std(h, { roughness: 0.6 }));
        line.position.set(x0 * len * 2 / 2, 0.0028, s * (CARRIAGE / 2 - 0.016)); g.add(line);
      }
    }
    if (kind === 'asphalt') {                          // old tram rails, half buried
      for (const z of [-0.035, 0.035]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.004, 0.006), std('#5e5953', { metalness: 0.8, roughness: 0.3 })); rail.position.set(0, 0.004, z); g.add(rail); }
    }
    return g;
  }
  function streetBend(kind, d = null, tint = null) {                          // a quarter turn about the corner's inner point
    const g = new THREE.Group();
    const ring = (r0, r1, mat, y, paint) => {
      // the quarter between the two streets it joins: after the -90° tilt, ring angles -90°…0° land on +x/+z of the inner point (as roadPoint's bend)
      const geo = new THREE.RingGeometry(r0, r1, 24, 1, -Math.PI / 2, Math.PI / 2);
      if (paint) paintVerts(geo, tint && tint.a, tint && tint.b, (x, yy) => SMOOTH(Math.max(0, Math.min(1, (Math.atan2(yy, x) + Math.PI / 2 - Math.PI / 8) / (Math.PI / 4)))));
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; g.add(m);
    };
    ring(SIDE, SIDE + CARRIAGE, carriageMat(kind, !!tint), 0.002, true);
    ring(0.001, SIDE, pavementMat(d), 0.022);
    ring(SIDE + CARRIAGE, ROAD, pavementMat(d), 0.022);
    return g;
  }

  // ------------------------------------------------------------ the city square in the middle
  const squareLamps = [];
  function buildSquare() {
    const g = new THREE.Group();
    const inner = 2 * (H - D) - 0.04;
    const base = new THREE.Mesh(new RoundedBoxGeometry(inner, PLAZA_Y, inner, 2, 0.02), std('#211e1b'));
    base.position.y = PLAZA_Y / 2; base.receiveShadow = true;
    g.add(base);
    const t = cobbleTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9);
    const setts = new THREE.Mesh(new THREE.PlaneGeometry(inner - 0.08, inner - 0.08), new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
    setts.rotation.x = -Math.PI / 2; setts.position.y = PLAZA_Y + 0.002; setts.receiveShadow = true;
    g.add(setts);
    const circle = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.38, 64), std('#4a453e', { roughness: 0.5 }));
    circle.rotation.x = -Math.PI / 2; circle.position.set(0, PLAZA_Y + 0.004, 0.3);
    g.add(circle);
    // a dark fountain with a column behind the dice, lamps at the corners
    g.add(make(FAN, 'fountain-round-detail', { s: 0.42, x: 0, y: PLAZA_Y, z: -2.9, palette: 'noir' }));
    g.add(make(FAN, 'pillar-stone', { s: 1.4, x: 0, y: PLAZA_Y, z: -2.9, palette: 'noir' }));
    return g;
  }
  function squareFurniture() {
    const g = new THREE.Group();
    for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6], [-1.2, -2.9], [1.2, -2.9]]) {
      const l = lamp(); l.position.set(x, PLAZA_Y, z); l.scale.setScalar(1.25); g.add(l); squareLamps.push(l.userData.bulb);
    }
    return g;
  }

  // ------------------------------------------------------------ the Max beam: a soft column of the owner's colour
  const BEAM_H = 8.5;
  const beamGeo = new THREE.CylinderGeometry(0.035, 0.1, 1, 28, 1, true).translate(0, 0.5, 0);        // y 0…1: scaled to BEAM_H
  const discGeo = new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2);
  const beamShader = (disc) => ({
    vertexShader: `varying float vH; varying float vRim; varying float vNear; varying vec2 vUv;
      void main() { vUv = uv; vH = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vRim = ${disc ? '1.0' : 'pow(abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))), 2.6)'};
        vNear = smoothstep(2.5, 10.0, length(mv.xyz));                // up close the beam thins to a haze instead of a solid bar
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float time; uniform float opacity; uniform float seed; varying float vH; varying float vRim; varying float vNear; varying vec2 vUv;
      void main() {
        ${disc ? `float r = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2) * 0.5 * (0.9 + 0.1 * sin(time * 0.9 + seed));`
               : `float fade = pow(max(0.0, 1.0 - vH), 2.4); float foot = smoothstep(0.0, 0.03, vH);
                  float a = fade * foot * vRim * mix(0.05, 0.26, vNear) * (0.86 + 0.14 * sin(time * 1.1 + vH * 6.0 + seed));`}
        a *= opacity; gl_FragColor = vec4(color, a); }`,
  });
  function makeBeam(f) {
    const g = new THREE.Group();
    const mk = (geo, disc) => {
      const m = new THREE.ShaderMaterial({ ...beamShader(disc), uniforms: { color: { value: new THREE.Color('#c9a24f') }, time: { value: 0 }, opacity: { value: 0 }, seed: { value: Math.random() * 6 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 6; mesh.frustumCulled = false; return mesh;
    };
    const col = mk(beamGeo, false), disc = mk(discGeo, true);
    col.scale.y = BEAM_H; disc.position.y = 0.012;
    g.add(col, disc);
    g.userData.mats = [col.material, disc.material];
    g.position.set(0, BASE_H, f.corner ? 0 : KERB + 0.62);
    g.visible = false;
    return g;
  }

  // ------------------------------------------------------------ Max: four searchlights, one at each corner of the lot
  const SPOT_LEN = 9;
  const spotGeo = new THREE.CylinderGeometry(0.2, 0.014, 1, 24, 1, true).translate(0, 0.5, 0);   // y 0…1 along the beam: narrow at the lamp, wide at the sky
  const spotHousingGeo = mergeGeometries([new THREE.CylinderGeometry(0.03, 0.036, 0.05, 10).translate(0, 0.025, 0), new THREE.BoxGeometry(0.1, 0.02, 0.1).translate(0, -0.01, 0)], false);
  const UP = new THREE.Vector3(0, 1, 0), spotDir = new THREE.Vector3();
  function makeSpots(f) {
    const g = new THREE.Group();
    g.visible = false;
    if (f.corner) { g.userData = { mats: [], lens: new THREE.MeshBasicMaterial(), update() {} }; return g; }
    const mat = new THREE.ShaderMaterial({ ...beamShader(false), uniforms: { color: { value: new THREE.Color('#c9a24f') }, time: { value: 0 }, opacity: { value: 0 }, seed: { value: Math.random() * 6 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const lens = new THREE.MeshBasicMaterial({ color: '#c9a24f' });
    const spots = [];
    [[-1, KERB + 0.07, -1], [1, KERB + 0.07, -1], [-1, KERB + LOT - 0.07, 1], [1, KERB + LOT - 0.07, 1]].forEach(([sx, z, sz], k) => {
      const pivot = new THREE.Group(); pivot.position.set(sx * (f.w / 2 - 0.07), BASE_H, z);
      const housing = new THREE.Mesh(spotHousingGeo, iron()); housing.castShadow = true; pivot.add(housing);
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12).rotateX(-Math.PI / 2).translate(0, 0.052, 0), lens); pivot.add(eye);
      const cone = new THREE.Mesh(spotGeo, mat); cone.scale.y = SPOT_LEN; cone.position.y = 0.05; cone.renderOrder = 6; cone.frustumCulled = false; pivot.add(cone);
      g.add(pivot);
      spots.push({ pivot, az: Math.atan2(sz * 0.8, sx), ph: k * 1.7 });
    });
    g.userData = { mats: [mat], lens, update(time) {                 // a slow sweep: each lamp rocks about its outward bearing and leans a little in and out
      for (const sp of spots) {
        const th = sp.az + 0.5 * Math.sin(time * 0.33 + sp.ph), lean = 0.3 + 0.13 * Math.sin(time * 0.27 + sp.ph * 1.6);
        spotDir.set(Math.sin(lean) * Math.cos(th), Math.cos(lean), Math.sin(lean) * Math.sin(th));
        sp.pivot.quaternion.setFromUnitVectors(UP, spotDir);
      }
    } };
    return g;
  }

  // ------------------------------------------------------------ the squares
  let board = null, meta = null;
  let tiles = [];
  const ready = preload(modelList());

  // an "occluder": a piece of a lot that stands taller than the L0 shack and is broad enough to hide a street or a token (lamps and posts are not)
  const _bs = new THREE.Vector3();
  function bigBox(c) {
    const b = new THREE.Box3().setFromObject(c);
    if (!isFinite(b.max.y)) return null;
    b.getSize(_bs);
    return b.max.y > 0.2 && Math.max(_bs.x, _bs.z) > 0.12 ? b : null;
  }
  // bake a list of placed pieces into one group: lit signs, lamps, booths and clocks keep their own materials, the rest merges
  function bakeKids(kids) {
    const g = new THREE.Group();
    kids.forEach(k => g.add(k));
    const live = g.children.filter(c => c.userData.sign || c.userData.live || c.children.some(k => k.userData.bulb));
    live.forEach(c => g.remove(c));
    const out = bake(g);
    live.forEach(c => out.add(c));
    return out;
  }

  // each property's stretch of street is one solid "tile" in its district's colour; special squares and corners stay plain asphalt,
  // so the districts read as separate runs of coloured slabs. The hues are spread apart (pink, red and orange no longer blur in the amber light)
  const ROAD_HUES = { brown: '#8c5626', lightblue: '#3f9fe0', pink: '#d6409f', orange: '#e8891a', red: '#c8262b', yellow: '#d9bb22', green: '#27a359', darkblue: '#2d4cc8' };
  const roadHex = sp => ROAD_HUES[sp.group] || sp.color;
  const vividHex = (hex, l) => { const c = new THREE.Color(hex), h = c.getHSL({}, THREE.SRGBColorSpace); return '#' + c.setHSL(h.h, Math.min(1, h.s * 0.95), l, THREE.SRGBColorSpace).getHexString(); };
  function roadTint(i, kind) {
    const sp = board[i];
    if (sp.type !== 'property' || !sp.color) return null;
    const hex = roadHex(sp), wash = washColor(vividHex(hex, 0.5)), line = vividHex(hex, 0.6);
    return { a: wash, b: wash, ha: line, hb: line };
  }

  function buildTile(i) {
    const sp = board[i], f = tileFrame(i), dist = districtOf(sp) || DISTRICTS.noir;
    const special = sp.type !== 'property';
    const near = (special ? [board[i - 1], board[i + 1]].map(s => s && districtOf(s)).find(Boolean) : dist) || DISTRICTS.noir;
    const g = new THREE.Group();
    g.position.copy(f.pos); g.rotation.y = f.rotY;
    const lift = new THREE.Group(); g.add(lift);
    // the raised base and its ground: urban only (concrete, gravel, setts)
    const base = new THREE.Mesh(new RoundedBoxGeometry(f.w - 0.02, BASE_H, f.d - 0.03, 2, 0.015), std(near.side));
    base.position.y = BASE_H / 2; base.castShadow = base.receiveShadow = true;
    lift.add(base);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(f.w - 0.04, f.corner ? f.d - 0.04 : LOT - 0.02), groundMat(near));
    top.rotation.x = -Math.PI / 2; top.position.set(0, BASE_H + 0.001, f.corner ? 0 : KERB + LOT / 2); top.receiveShadow = true;
    lift.add(top);
    // a faint warm edge when the square wakes, instead of a bright outline
    const rim = new THREE.Mesh(new THREE.BoxGeometry(f.w - 0.02, 0.006, f.d - 0.03), new THREE.MeshBasicMaterial({ color: '#ffb46a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    rim.position.y = BASE_H * 0.15; rim.scale.set(1.012, 1, 1.012); rim.visible = false;
    lift.add(rim);
    // the street through it
    const tint = roadTint(i, near.road);
    const street = bake(f.corner ? streetBend(near.road, near, tint) : streetStraight(near.road, f.w, near, tint));
    if (f.corner) street.position.set(-C / 2, BASE_H, -C / 2);
    else street.position.set(0, BASE_H, -D / 2 + ROAD / 2);
    lift.add(street);
    // what stands on it
    const content = new THREE.Group();
    content.position.set(f.corner ? -C / 2 + ROAD : 0, BASE_H, f.corner ? -C / 2 + ROAD : KERB + 0.22);       // (side squares: the buildings stand behind the name plate)
    if (!f.corner) content.scale.set(CS, CS, CS * DEPTH_K);           // a little shallower too, so neither name plate (road side or outer edge) cuts into it
    lift.add(content);
    lift.add(plates.make(i, f));                                  // the name plate and the road paint
    const glowKey = 't' + i;
    const landmark = LANDMARKS[slugName(sp.name)] || [];
    const own = special && LANDMARKS[slugName(sp.name)];          // a named special square (the waterworks) has its own look
    const raw = placeAll(special ? own || SPECIALS[sp.type] || [] : [...(landmark.noBack ? [] : dist.back[i % dist.back.length]), ...landmark], { palette: near.palette, glowKey, extras: (k, t, o, gl) => extras(k, t, o, gl, near, i) });
    const lamps = [], signs = [];
    let casino = null;
    raw.traverse(o => { if (o.userData.bulb) lamps.push(o.userData.bulb); if (o.userData.sign) signs.push(o.userData.sign); if (o.userData.casino) casino = o.userData.casino; });
    const chimneys = raw.userData.chimneys;
    // the back row and landmark extras that stand taller than the L0 shack are baked apart from the low things: an unowned lot hides them (setGrowth)
    raw.updateMatrixWorld(true);
    const tallKids = [], lowKids = [], occDecor = [];
    for (const c of [...raw.children]) { const b = bigBox(c); if (b) { tallKids.push(c); occDecor.push(b); } else lowKids.push(c); }
    const decorLow = bakeKids(lowKids), decorTall = bakeKids(tallKids);
    content.add(decorLow, decorTall);
    // street furniture on the side squares: a lamp on every other kerb, a manhole now and then
    let steam = null;
    if (!f.corner) {
      if (i % 2 === 0 || special) { const l = lamp(near.lamp); l.position.set(TW / 2 - 0.03, BASE_H, KERB + 0.04); lift.add(l); lamps.push(l.userData.bulb); }
      if (i % 3 === 1) {
        const at = new THREE.Vector3(-0.2, BASE_H + 0.004, -D / 2 + ROAD / 2 + 0.06);
        const mh = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), std('#3a3631', { metalness: 0.7, roughness: 0.4 }));
        mh.rotation.x = -Math.PI / 2; mh.position.copy(at);
        lift.add(mh);
        steam = at.clone().sub(content.position).divideScalar(content.scale.x).setY(0.02);
      }
    }
    // the owner's mark: a thin trim along the back of the lot and a small enamel plate by the door
    // the owner's colour: a kerb band round the lot edge and a slim cornice line on the tallest building
    const ownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.5, metalness: 0.1 });
    const bandW = f.w - 0.02, bandD = f.d - 0.03, bt = 0.03, bh = 0.02;
    const bandGeos = [[bandW, bt, 0, -bandD / 2 + bt / 2], [bandW, bt, 0, bandD / 2 - bt / 2], [bt, bandD - 2 * bt, -bandW / 2 + bt / 2, 0], [bt, bandD - 2 * bt, bandW / 2 - bt / 2, 0]]
      .map(([w, d, x, z]) => new THREE.BoxGeometry(w, bh, d).translate(x, BASE_H + bh / 2 - 0.004, z));
    const band = new THREE.Mesh(mergeGeometries(bandGeos, false), ownMat);               // one mesh for the four kerb strips
    bandGeos.forEach(g => g.dispose());
    band.visible = false;
    lift.add(band);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1, 0.022, 0.02), ownMat);
    trim.position.set(0, BASE_H + 0.3, 0); trim.visible = false;
    lift.add(trim);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.006), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.2 }));
    plate.position.set(f.corner ? 0.6 : -0.34, BASE_H + 0.12, f.corner ? 0 : KERB + 0.14); plate.visible = false;
    lift.add(plate);
    const beam = makeSpots(f);
    lift.add(beam);
    const fxG = new THREE.Group(); fxG.position.copy(content.position); fxG.scale.copy(content.scale); lift.add(fxG);        // what is on its way out (the old building, scaffolding)
    // an invisible box for the mouse
    const pick = new THREE.Mesh(new THREE.BoxGeometry(f.w, 1.2, f.d), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = 0.6; pick.userData.tile = i;
    lift.add(pick);
    world.add(g);
    g.updateMatrix(); lift.updateMatrix(); content.updateMatrix();
    const toContent = new THREE.Matrix4().multiplyMatrices(g.matrix, new THREE.Matrix4().multiplyMatrices(lift.matrix, content.matrix)).invert();     // city space → the lot's own space
    const tile = { toContent, i, sp, f, g, lift, rim, content, fxG, decorTall, occDecor, occGrowth: [], tallH: Math.max(0.3, ...occDecor.map(b => b.max.y)) + 0.05, tallOn: true, fade: { v: 1, want: false, until: 0, list: [], on: false, mats: new Map() }, anim: null, growthH: 1, growth: null, houses: -1, trim, band, ownMat, plate, pick, dist, palette: near.palette, glowKey, special, beam, beamOn: false, max: false,
      casino, fx: null, fxKey: '', owner: null, mortgaged: false, anchorLocal: new THREE.Vector3(), barrier: null, decorChimneys: chimneys };
    life.add(i, content, { lamps, signs, steam });
    if (casino) life.setHaze(i, casino.haze);
    setGrowth(tile, 0, false);
    return tile;
  }

  // ------------------------------------------------------------ building, scaffolding, collapse
  // the box (in the tile's content space) that a baked group occupies
  const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _b = new THREE.Box3();
  function localBox(tile, obj) {
    obj.updateWorldMatrix(true, true);
    _inv.copy(tile.content.matrixWorld).invert();
    const box = new THREE.Box3();
    obj.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(_b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld)));
    });
    return box;
  }
  // thin dark poles, ledgers and planks round a building's front and sides: one mesh, cut at street level so it rises out of the ground
  const scaffMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, clippingPlanes: [groundClip] });
  function scaffold(box) {
    const x0 = box.min.x - 0.05, x1 = box.max.x + 0.05, zf = box.min.z - 0.06, zs = zf + 0.07, depth = Math.min(0.3, box.max.z - zf), H = Math.max(0.35, box.max.y) + 0.06;
    const geos = [], pole = new THREE.Color('#1a1613'), plank = new THREE.Color('#5a4630');
    const add = (w, h, d, x, y, z, c, rz = 0) => {
      const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); g.translate(x, y, z);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
    };
    const nb = Math.max(2, Math.ceil((x1 - x0) / 0.24)), lifts = [];
    for (let y = 0.17; y < H - 0.05; y += 0.22) lifts.push(y);
    for (let k = 0; k <= nb; k++) for (const z of [zf, zs]) add(0.008, H, 0.008, x0 + k * (x1 - x0) / nb, H / 2, z, pole);   // standards, a double row
    for (const y of lifts) {
      for (const z of [zf, zs]) add(x1 - x0, 0.006, 0.006, (x0 + x1) / 2, y, z, pole);                                // ledgers
      add(x1 - x0, 0.007, 0.075, (x0 + x1) / 2, y + 0.004, (zf + zs) / 2, plank);                                      // the working deck
    }
    for (const x of [x0, x1]) {                                                                                       // a return along each side, to the wall
      for (const z of [zf + depth]) add(0.008, H, 0.008, x, H / 2, z, pole);
      for (const y of lifts) add(0.006, 0.006, depth, x, y, zf + depth / 2, pole);
    }
    for (let k = 0; k < nb; k += 2) for (let j = 0; j + 1 < lifts.length; j += 2) {                                     // cross braces
      const dx = (x1 - x0) / nb, dy = lifts[j + 1] - lifts[j], len = Math.hypot(dx, dy);
      add(len, 0.005, 0.005, x0 + (k + 0.5) * dx, (lifts[j] + lifts[j + 1]) / 2, zf, pole, Math.atan2(dy, dx) * (j % 4 ? -1 : 1));
    }
    const m = new THREE.Mesh(mergeGeometries(geos, false), scaffMat);
    geos.forEach(g => g.dispose());
    m.castShadow = true; m.userData.height = H;
    return m;
  }
  const clamp01 = k => Math.max(0, Math.min(1, k));

  // the lot grows with its buildings, solidly: the old one sinks into a cloud of dust while scaffolding goes up, the new one rises through it, the scaffolding drops away.
  // A lower level (the gang wrecks it) is a short collapse and the smaller building rising out of the rubble.
  function setGrowth(tile, houses, animate) {
    if (tile.houses === houses && tile.growth !== null) return;
    if (tile.special) { tile.houses = 0; tile.growth = new THREE.Group(); tile.fade.stale = true; refreshTile(tile); return; }
    if (tile.anim) tile.anim.finish();
    const old = tile.growth, prev = tile.houses;
    const raw = placeAll(tile.dist.growth[Math.max(0, Math.min(4, houses))], { palette: tile.dist.palette, glowKey: tile.glowKey + 'h' + houses, extras: (k, t, o, gl) => extras(k, t, o, gl, tile.dist) });
    const chimneys = raw.userData.chimneys;
    raw.updateMatrixWorld(true);
    tile.occGrowth = raw.children.map(bigBox).filter(Boolean);
    tile.fade.stale = true;
    const live = raw.children.filter(c => c.userData.sign);          // lit signs keep their own material (and flicker with the square)
    live.forEach(c => raw.remove(c));
    const next = bake(raw);
    live.forEach(c => next.add(c));
    life.setGrowthSigns(tile.i, live.map(c => c.userData.sign));
    next.userData.chimneys = chimneys;
    next.userData.tallest = raw.userData.tallest;
    tile.houses = houses;
    tile.growth = next;
    tile.content.add(next);
    // L0 is the shack and its sign and nothing else: the tall back row and landmark pieces only stand while the lot is built on
    const showTall = houses > 0, tallMove = tile.tallOn !== showTall && animate && !!old;
    tile.tallOn = showTall;
    if (!tallMove) { tile.decorTall.visible = showTall; tile.decorTall.position.y = 0; }
    else { tile.decorTall.visible = true; tile.decorTall.position.y = showTall ? -tile.tallH : 0; }
    const box = localBox(tile, next), nextH = isFinite(box.max.y) ? Math.max(0.2, box.max.y) : 0.6, oldH = tile.growthH;
    tile.growthH = nextH;
    const trimA = { p: tile.trim.position.clone(), sx: tile.trim.scale.x };
    refreshTile(tile);                                               // the label and the cornice go to where the new building ends up
    if (!old || !animate) { if (old) tile.content.remove(old); return; }
    const trimB = { p: tile.trim.position.clone(), sx: tile.trim.scale.x };
    tile.content.remove(old); tile.fxG.add(old);
    const down = houses < prev, scaf = down ? null : scaffold(box);
    if (scaf) tile.fxG.add(scaf);
    next.position.y = -nextH - 0.05;
    if (down) { sfx.rumble && sfx.rumble(); dust(tile, 16); } else { sfx.construct && sfx.construct(); dust(tile, 10); }
    let puffed = false;
    const end = () => {
      tile.decorTall.visible = showTall; tile.decorTall.position.y = 0;
      tile.fxG.remove(old);
      if (scaf) { tile.fxG.remove(scaf); scaf.geometry.dispose(); }
      next.position.y = 0;
      tile.trim.position.copy(trimB.p); tile.trim.scale.x = trimB.sx;
      tile.anim = null;
    };
    const place = (t, y) => { tile.trim.position.set(t.p.x, t.p.y + y, t.p.z); tile.trim.scale.x = t.sx; };
    const tw = tween(down ? 1150 : 2000, q => {
      if (down) {
        const a = clamp01(q / 0.6), b = clamp01((q - 0.45) / 0.55);
        old.position.y = -(oldH + 0.05) * a * a; old.position.x = (Math.random() - 0.5) * 0.012 * (1 - a);
        next.position.y = -(nextH + 0.05) * (1 - easeInOut(b));
        if (tallMove) tile.decorTall.position.y = -tile.tallH * (showTall ? 1 - easeInOut(b) : a * a);
        if (q < 0.5) place(trimA, old.position.y); else place(trimB, next.position.y);
      } else {
        const a = clamp01(q / 0.3), b = clamp01((q - 0.3) / 0.5), c = clamp01((q - 0.8) / 0.2);
        old.position.y = -(oldH + 0.05) * easeInOut(a);
        scaf.scale.y = Math.max(0.02, easeInOut(clamp01(q / 0.35)));
        scaf.position.y = -(scaf.userData.height + 0.1) * easeInOut(c);
        next.position.y = -(nextH + 0.05) * (1 - easeInOut(b));
        if (tallMove) tile.decorTall.position.y = -tile.tallH * (showTall ? 1 - easeInOut(b) : easeInOut(a));
        if (q < 0.3) place(trimA, old.position.y); else place(trimB, next.position.y);
        if (q > 0.8 && !puffed) { puffed = true; dust(tile, 6); }
      }
    }, () => { end(); refreshTile(tile); });
    tile.anim = { finish() { const k = tweens.indexOf(tw); if (k >= 0) tweens.splice(k, 1); end(); refreshTile(tile); } };
  }

  // where the label floats, which windows can light up, where the chimneys smoke
  function refreshTile(tile) {
    tile.g.updateMatrixWorld(true);
    let topY = BASE_H + 0.3, tallest = null;
    tile.content.traverseVisible(o => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      if (isFinite(b.max.y) && b.max.y > -1) {
        const y = tile.g.worldToLocal(b.max.clone()).y;
        if (y > topY) { topY = y; tallest = b; }
      }
    });
    const tl = tile.growth && tile.growth.userData.tallest;
    if (tl) {                           // the owner's cornice line runs along the front edge of the lot's tallest roof
      const cs = tile.content.scale.x;
      const w = Math.max(0.12, Math.min((tl.x1 - tl.x0) * cs, tile.f.w - 0.1));
      tile.trim.scale.x = w;
      tile.trimY = tile.content.position.y + tl.top * cs + 0.004;
      tile.trim.position.set(tile.content.position.x + (tl.x0 + tl.x1) / 2 * cs, tile.trimY, tile.content.position.z + tl.zf * tile.content.scale.z - 0.012);
      topY = Math.max(topY, tile.content.position.y + tl.top * cs);
    } else if (tallest) {               // (no code-built building: the box of the highest mesh)
      const lo = tile.g.worldToLocal(tallest.min.clone()), hi = tile.g.worldToLocal(tallest.max.clone());
      const w = Math.max(0.12, Math.min(Math.abs(hi.x - lo.x), tile.f.w - 0.1));
      tile.trim.scale.x = w;
      tile.trimY = topY + 0.008;
      tile.trim.position.set((lo.x + hi.x) / 2, tile.trimY, Math.min(lo.z, hi.z) + 0.012);
    }
    const centre = tile.f.corner ? new THREE.Vector3(0.3, 0, 0.3) : new THREE.Vector3(0, 0, KERB + 0.55);
    tile.anchorLocal.set(centre.x, Math.max(topY, 0.5) + 0.18, centre.z);
    const keys = [];
    tile.content.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.glowKey && !keys.includes(o.material.userData.glowKey)) keys.push(o.material.userData.glowKey); });
    life.setWindows(tile.i, keys);
    const chim = [...((tile.growth && tile.growth.userData.chimneys) || []), ...(tile.special || tile.tallOn ? tile.decorChimneys || [] : [])].map(obj => {
      const b = new THREE.Box3().setFromObject(obj);
      return isFinite(b.max.y) ? tile.content.worldToLocal(new THREE.Vector3(b.min.x * 0.3 + b.max.x * 0.7, b.max.y + 0.02, (b.min.z + b.max.z) / 2)) : null;
    }).filter(Boolean);
    life.setChimneys(tile.i, chim);
  }

  // ------------------------------------------------------------ see-through buildings
  // Whatever stands between the camera and a token (or the stretch of street the camera is looking at) fades to ~35% and comes back
  // when the way is clear. A tile fades as a whole: its baked meshes swap to per-tile clones of their materials (so nothing else
  // changes) while it is below full opacity. Occluders are the boxes of the lot's taller pieces, tested as segments in city space.
  const FADE_TO = 0.35, FADE_MS = 250, HOLD_MS = 160;
  let roadPts = [], fadeFrameNo = 0;
  const _ray = new THREE.Ray(), _hit = new THREE.Vector3(), _o = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _cam = new THREE.Vector3(), _foc = new THREE.Vector3();
  const fadeTargets = [];
  function fadeMat(tile, orig) {
    let m = tile.fade.mats.get(orig);
    if (!m) {
      m = orig.clone();
      m.clippingPlanes = orig.clippingPlanes;
      m.transparent = true; m.depthWrite = false;
      m.userData.fadeBase = orig.opacity;
      tile.fade.mats.set(orig, m);
    }
    return m;
  }
  function fadeEnter(tile) {                                      // swap every mesh of the tile to its fade clone (idempotent: new meshes are picked up)
    const f = tile.fade; f.list.length = 0;
    tile.content.traverse(o => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      f.list.push(o);
      if (!o.userData.fadeOrig) {
        o.userData.fadeOrig = o.material;
        o.material = fadeMat(tile, o.material);
        if (o.material.emissiveIntensity !== undefined) o.material.emissiveIntensity = o.userData.fadeOrig.emissiveIntensity;
      }
    });
    f.stale = false; f.on = true;
  }
  function fadeExit(tile) {
    const f = tile.fade;
    for (const o of f.list) if (o.userData.fadeOrig) { o.material = o.userData.fadeOrig; o.userData.fadeOrig = null; }
    f.list.length = 0; f.on = false;
  }
  function fadeApply(tile) {
    const f = tile.fade;
    if (f.stale) fadeEnter(tile);
    for (const o of f.list) {
      const m = o.material, orig = o.userData.fadeOrig;
      if (!orig) continue;
      m.opacity = (m.userData.fadeBase ?? 1) * f.v;
      if (m.userData.windows) m.emissiveIntensity = orig.emissiveIntensity;     // window light is driven on the shared original (life.js)
    }
  }
  // does the segment cam → p cross a tall piece of this lot? (everything in the tile's content space, where the boxes are axis-aligned)
  function blocked(tile, cam, p) {
    const boxes = tile.tallOn || tile.special ? tile.occDecor.concat(tile.occGrowth) : tile.occGrowth;
    if (!boxes.length) return false;
    _o.copy(cam).applyMatrix4(tile.toContent); _p.copy(p).applyMatrix4(tile.toContent);
    _d.subVectors(_p, _o); const len = _d.length(); if (len < 1e-3) return false;
    _ray.set(_o, _d.divideScalar(len));
    for (const b of boxes) {
      if (b.containsPoint(_o)) continue;
      if (_ray.intersectBox(b, _hit) && _hit.distanceTo(_o) < len - 0.03) return true;
    }
    return false;
  }
  function updateFade(dt, now) {
    if (!tiles.length) return;
    if ((fadeFrameNo++ & 1) === 0) {                               // the visibility test every other frame
      city.worldToLocal(_cam.copy(camera.position));
      fadeTargets.length = 0;
      for (const tk of tokens.values()) if (!tk.out) { fadeTargets.push(tk.g.position.clone().add(new THREE.Vector3(0, 0.04, 0)), tk.g.position.clone().add(new THREE.Vector3(0, 0.22, 0))); }
      city.worldToLocal(_foc.copy(controls.target));
      let n = 0;
      for (const rp of roadPts) { if (n >= 14) break; if (Math.hypot(rp.x - _foc.x, rp.z - _foc.z) < 3.6) { fadeTargets.push(rp); n++; } }
      for (const tile of tiles) {
        let hit = false;
        for (const t of fadeTargets) if (blocked(tile, _cam, t)) { hit = true; break; }
        if (hit) tile.fade.until = now + HOLD_MS;
        tile.fade.want = now < tile.fade.until;
      }
    }
    const step = dt / FADE_MS * (1 - FADE_TO);
    for (const tile of tiles) {
      const f = tile.fade, to = f.want ? FADE_TO : 1;
      if (f.v !== to) f.v += Math.max(-step, Math.min(step, to - f.v));
      if (f.v < 0.999) { if (!f.on) fadeEnter(tile); fadeApply(tile); }
      else if (f.on) { f.v = 1; fadeExit(tile); }
    }
  }

  function buildWorld() {
    world.clear();
    life.clear();
    squareLamps.length = 0;
    world.add(bake(buildSquare()), squareFurniture());
    plates.begin();
    tiles = board.map((_, i) => buildTile(i));
    roadPts = []; for (let t = 0; t < 40; t += 0.5) roadPts.push(roadPoint(t).clone().setY(BASE_H + 0.05));
    bubbles.build(board.length);
    dice.place(lastDice || [3, 4]);
    syncTokensToState();
  }

  // ------------------------------------------------------------ dice on the square
  const diceY = city.position.y + (PLAZA_Y + 0.003) * S;
  const dice = createDice(scene, { surfaceY: diceY, area: 2.0 * S, sfx });
  let lastDice = null;

  // ------------------------------------------------------------ tokens: the pewter pieces, driving the streets
  const tokens = new Map();
  function makeToken(p) {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const { group: piece, enamel, felt } = makePewterToken(p.token, p.color);
    piece.scale.setScalar(TOKEN_S);
    piece.rotation.y = -Math.PI / 2;                  // figures face +x; here they face their heading (+z)
    body.add(piece);
    if (p.token === 'car') {                          // headlights
      for (const x of [-0.06, 0.06]) {
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: '#2a2418', emissive: '#ffe2a8', emissiveIntensity: 4 }));
        hl.position.set(x, 0.1, 0.17); body.add(hl);
      }
      const beam = new THREE.SpotLight('#ffe2a8', 0.5, 1.4, 0.5, 0.8, 1.5);
      beam.position.set(0, 0.1, 0.15); beam.target.position.set(0, 0, 0.8);
      body.add(beam, beam.target);
    }
    // a pulsing glow in the player's colour under the base shows whose turn it is (as in Table Mode)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.215, 40), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004;
    g.add(ring);
    g.traverse(o => { if (o.isMesh && o !== ring) o.castShadow = true; });
    city.add(g);
    return { id: p.id, g, body, ring, enamel, felt, t: p.pos, target: p.pos, queue: [], anim: null, jailed: p.inJail, out: false, tile: p.pos, snap: true };
  }

  const restPos = new THREE.Vector3(), restHead = new THREE.Vector3(), Yax = new THREE.Vector3(0, 1, 0);
  function rest(tk, slot, count) {
    if (tk.jailed) {                                    // waiting in the jail yard
      const f = tileFrame(10);
      restPos.set(-C / 2 + ROAD + 0.2 + slot * 0.2, BASE_H, -C / 2 + ROAD + 0.35).applyAxisAngle(Yax, f.rotY).add(f.pos);
      restHead.set(0, 0, 1).applyAxisAngle(Yax, f.rotY);
      return;
    }
    lanePoint(tk.t + (slot - (count - 1) / 2) * 0.3, slot % 2 ? -LANE : LANE, restPos, restHead);
  }
  function syncTokensToState() {
    if (!lastState) return;
    for (const p of lastState.players) {
      if (!tokens.has(p.id)) tokens.set(p.id, makeToken(p));
      const tk = tokens.get(p.id);
      if (!tk.anim && !tk.queue.length) { tk.t = p.pos; tk.target = p.pos; tk.tile = p.pos; tk.jailed = p.inJail; }
    }
  }

  // ------------------------------------------------------------ quiet effects
  const tweens = [];
  function tween(dur, update, done) { const tw = { t0: performance.now(), dur, update, done }; tweens.push(tw); return tw; }
  const dotTex = canvasTex(64, (g, s) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const tileFx = createTileFx({ dot: dotTex, makeBeam, BASE_H, KERB, LOT });
  function dust(tile, n = 8) {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: '#6b6359', transparent: true, depthWrite: false, opacity: 0.5 }));
      s.position.set(rand(-0.4, 0.4), 0.05, 0.6 + rand(-0.5, 0.5));
      s.scale.setScalar(0.1);
      tile.content.add(s);
      const v = new THREE.Vector3(rand(-0.1, 0.1), rand(0.05, 0.15), rand(-0.1, 0.1));
      tween(1800, q => { s.position.addScaledVector(v, 0.016); s.scale.setScalar(0.1 + q * 0.3); s.material.opacity = 0.5 * (1 - q); }, () => { tile.content.remove(s); s.material.dispose(); });
    }
  }
  function smokeAt(at, n = 12, color = '#5d5850') {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, depthWrite: false, opacity: 0 }));
      s.position.copy(at).add(new THREE.Vector3(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)));
      fxGroup.add(s);
      const v = new THREE.Vector3(rand(-0.05, 0.05), rand(0.1, 0.25), rand(-0.05, 0.05));
      tween(2600 + rand(0, 800), q => { s.position.addScaledVector(v, 0.016); s.scale.setScalar(0.15 + q * 0.5); s.material.opacity = Math.sin(Math.PI * q) * 0.35; }, () => { fxGroup.remove(s); s.material.dispose(); });
    }
  }
  function emoteAbove(tk, text) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.filter = 'sepia(.55) saturate(.7) brightness(.95)'; g.fillText(text, 64, 72);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, opacity: 0 }));
    s.renderOrder = 10;
    fxGroup.add(s);
    tween(2600, q => { s.position.copy(tk.g.position).add(new THREE.Vector3(0, 0.45 + q * 0.3, 0)); s.scale.setScalar(0.3); s.material.opacity = Math.sin(Math.PI * q) * 0.95; },
      () => { fxGroup.remove(s); s.material.map.dispose(); s.material.dispose(); });
    sfx.pop();
  }

  // ------------------------------------------------------------ input
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = -1, selected = -1, targets = new Set();   // targets: squares a card can be played on (glow)
  function pickTile(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(tiles.map(x => x.pick), false)[0];
    return hit ? hit.object.userData.tile : -1;
  }
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const i = pickTile(e);
    if (i >= 0) onTileClick(i);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const h = pickTile(e);
    if (h !== hovered) { hovered = h; sfx.place && sfx.place(h >= 0 ? placeSound(h) : null); }
    renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : 'grab';
  });
  renderer.domElement.addEventListener('pointerleave', () => { hovered = -1; sfx.place && sfx.place(null); });
  let userUntil = 0, follow = true;
  controls.addEventListener('start', () => { userUntil = performance.now() + 6000; });

  // the quiet sound of a place: a radio behind a window, the docks, the station, the works
  function placeSound(i) {
    const sp = board && board[i];
    if (!sp) return null;
    if (sp.type === 'railroad') return 'station';
    if (sp.type === 'utility') return 'works';
    if (slugName(sp.name) === 'limehouse') return 'docks';
    return 'street';
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    try { if (performance.now() >= userUntil) homeView(controls.target, camera.position); } catch {}   // the home framing depends on the aspect: re-frame at once, not by a slow glide
  }
  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(container);

  // ------------------------------------------------------------ camera: slow and deliberate, never a shake
  const shot = { until: 0, target: new THREE.Vector3(), pos: new THREE.Vector3() };
  const dT = new THREE.Vector3(), dP = new THREE.Vector3();
  const toWorld = v => v.multiplyScalar(S).add(city.position);
  // everything the camera does is written for the +z side of the table, then turned about the vertical axis to the viewer's own seat
  let myYaw = 0;
  const seatTurn = v => v.applyAxisAngle(Yax, myYaw);
  function homeView(T, P) { homeView0(T, P); seatTurn(T); seatTurn(P); }
  function homeView0(T, P) {
    const a = Math.max(0.2, container.clientWidth / Math.max(1, container.clientHeight));
    if (a < 1) { const d = KS * Math.max(1, 0.56 / a); P.set(0, 26 * d, 24 * d); T.set(0, 0, 0); return; }          // narrow layout: from high up, further back the narrower it gets
    const d = KS * 0.78 * Math.max(1, 1.7 / a);                                                                        // 16:9 is the reference; 4:3 and the like need more distance to fit the width
    T.set(0, 0, 2.5); P.set(0, 8.6 * d, 2.5 + 11.5 * d);       // (a little toward the near row so its plates clear the action panel)
  }
  function frameTile(i, ms = 3200) {
    if (!follow || !tiles[i]) return;
    const f = tiles[i].f;
    const at = toWorld(new THREE.Vector3(0, BASE_H + 0.35, f.corner ? 0.2 : KERB + 0.45).applyAxisAngle(Yax, f.rotY).add(f.pos));
    shot.target.copy(at);
    const l = at.clone().applyAxisAngle(Yax, -myYaw);             // the tile in the viewer's frame
    shot.pos.copy(at).add(seatTurn(new THREE.Vector3(l.x * -0.25, 2.6 * KS, (4.4 - l.z * 0.2) * KS)));   // from our side of the table, a little above
    shot.until = performance.now() + ms;
  }
  function direct(now, dt) {
    if (!follow || now < userUntil) return;
    homeView(dT, dP);
    let k = 0.9;
    const mover = [...tokens.values()].find(x => x.anim && !x.anim.wait);
    if (mover) {
      const p = mover.g.getWorldPosition(new THREE.Vector3());
      dT.set(p.x, p.y + 0.2, p.z);
      const dir = new THREE.Vector3(p.x * 0.25, 0, p.z * 0.25).add(seatTurn(new THREE.Vector3(0, 0, 6))).normalize();
      dP.copy(dT).addScaledVector(dir, 6.5 * KS).setY(p.y + 4.4 * KS);
      k = 1.2;
    } else if (now < shot.until) { dT.copy(shot.target); dP.copy(shot.pos); k = 1.0; }
    else if (dice.rolling) { dT.set(0, diceY, 0.4); dP.set(0, diceY + 6.5 * KS, 8.5 * KS); seatTurn(dT); seatTurn(dP); k = 0.9; }
    const a = 1 - Math.exp(-(dt / 1000) * k);
    controls.target.lerp(dT, a);
    camera.position.lerp(dP, a);
  }
  function resetView() { homeView(controls.target, camera.position); userUntil = 0; shot.until = 0; }

  // ------------------------------------------------------------ state → city
  let pendingFx = [];
  let holdUntil = 0;
  let lastMoveSeq = null, lastRollId = null, lastProps = null, lastPhase = null, currentId = null;
  const allIdle = () => !dice.rolling && performance.now() >= holdUntil && [...tokens.values()].every(x => !x.anim && !x.queue.length);

  function startStep(tk, step, now) {
    if (step.card) { sfx.card(); onCard && onCard(step.card, tk.id); tk.anim = { wait: true, start: now, dur: step.card.casino ? 5800 : 3800 }; return; }
    const n = step.n;
    if (!n) return;
    tk.jailed = false;
    tk.anim = { a: step.from, b: step.from + n, start: now, dur: Math.min(3600, Math.max(700, Math.abs(n) * (step.fast ? 150 : 380))), passed: Math.floor(step.from) };
    if (step.jail) sfx.jail();
  }

  // current rent of an owned property or station, formatted (set bonus, round boom/crash and effects included)
  function rentText(sp, st, owner, cur) {
    const ev = lastState.event && lastState.event.round === lastState.round ? lastState.event.key : null;
    const mult = (ev === 'boom' ? 1.5 : ev === 'crash' ? 0.5 : 1) * effectMult(lastState, sp);
    if (sp.type === 'property') {
      const full = board.filter(s => s.group === sp.group).every(s => lastState.props[s.i] && lastState.props[s.i].owner === owner.id);
      const base = sp.rent[st.level || 1];
      return fmtMoney(Math.round((full ? Math.round(base * 1.5) : base) * mult), cur);
    }
    return fmtMoney(Math.round(25000 * 2 ** (board.filter(s => s.type === 'railroad' && lastState.props[s.i] && lastState.props[s.i].owner === owner.id).length - 1) * mult), cur);
  }

  function bubbleInfo(i) {
    const sp = board[i], st = lastState && lastState.props[i];
    const owner = st && lastState.players.find(p => p.id === st.owner);
    const cur = (meta && meta.currency) || '$';
    const [name, ...rest] = String(sp.name).split(','), city = rest.join(',').trim();
    let sub = '', short = '';
    if (sp.price) {
      if (!owner) { sub = `${tr('For sale')} · ${fmtMoney(sp.price, cur)}`; short = fmtMoney(sp.price, cur); }
      else if (st.mortgaged) { sub = `${owner.name} · ${tr('Mortgaged')}`; short = tr('Mortgaged'); }
      else {
        let rent = rentText(sp, st, owner, cur), lvl = '';
        if (sp.type === 'property') lvl = (st.level >= 5 ? tr('MAX') : tr('Lv {n}', { n: st.level || 1 })) + ' · ';
        if (sp.type === 'utility') rent = '4–10×';
        sub = `${owner.name} · ${lvl}${rent}`; short = `${lvl}${rent}`;
      }
    } else if (sp.type === 'tax') { sub = `${tr('Pay')} ${fmtMoney(sp.amount, cur)}`; short = fmtMoney(sp.amount, cur); }
    const tags = effectTags(lastState, sp);
    return { city, short, name: (lastState.mine && lastState.mine.protected && lastState.mine.protected.includes(i) ? '🛡 ' : '') + name, sub, accent: sp.color || null, owner: owner ? owner.color : null, mortgaged: !!(st && st.mortgaged), tag: tags.map(x => x.text).join(' '), tagTone: tags.some(x => x.tone === 'bad') ? 'bad' : tags.length ? 'good' : '' };
  }

  // the rent as painted on the road: '' (nothing) for unowned squares and specials
  function roadRent(i) {
    const sp = board[i], st = lastState && lastState.props[i];
    if (!sp || !sp.price || !st || !st.owner) return { text: '' };
    if (st.mortgaged) return { text: tr('MORTGAGED'), small: true };
    const cur = (meta && meta.currency) || '$', sq = tileEffectsOf(lastState, sp).filter(e => e.mult === 0);
    if (sq.length) return { text: tr(sq.some(e => e.kind === 'squatters') ? 'SQUATTED' : 'CLOSED'), small: true };
    if (sp.type === 'utility') return { text: `${board.filter(s => s.type === 'utility' && lastState.props[s.i] && lastState.props[s.i].owner === st.owner).length === 2 ? 10 : 4}× ${tr('DICE')}` };
    return { text: rentText(sp, st, lastState.players.find(p => p.id === st.owner), cur) };
  }

  // owner colour on the kerb band and cornice: moderate emissive so it reads in the dark without blooming; mortgaged goes grey and dim
  function paintOwner(tile) {
    if (!tile.owner) return;
    const c = new THREE.Color(tile.owner);
    if (tile.mortgaged) { const l = c.getHSL({}).l; c.setHSL(0, 0, l * 0.5).multiplyScalar(0.7); }
    tile.ownMat.color.copy(c);
    tile.ownMat.emissive.copy(c);
    tile.ownMat.emissiveIntensity = tile.mortgaged ? 0.12 : 0.45;
    const bc = new THREE.Color(tile.owner);
    tile.beam.userData.mats.forEach(m => m.uniforms.color.value.copy(bc));
    tile.beam.userData.lens.color.copy(bc).multiplyScalar(1.6);
  }


  const queueFx = f => pendingFx.push(f);

  function applyState(st0) {
    currentId = st0.phase === 'playing' ? st0.players[st0.turn]?.id : null;
    const firstSync = lastProps === null;
    if (lastRollId === null) { dice.place(st0.dice); lastDice = st0.dice; }
    else if (st0.rollId !== lastRollId) {
      sfx.dice();
      const d = (props && currentId && props.seatDir(currentId)) || new THREE.Vector3(0, 0, 1);
      holdUntil = performance.now() + dice.roll(st0.dice, d) + 150;
      lastDice = st0.dice;
    }
    lastRollId = st0.rollId;
    for (const p of st0.players) if (!tokens.has(p.id)) tokens.set(p.id, makeToken(p));
    if (lastMoveSeq !== null && (st0.moveSeq || 0) < lastMoveSeq) lastMoveSeq = null;
    if (lastMoveSeq !== null) {
      for (const m of st0.moves || []) {
        if (m.seq <= lastMoveSeq) continue;
        const tk = tokens.get(m.player);
        if (!tk) continue;
        if (m.how === 'card') { tk.queue.push({ card: m.card }); continue; }
        const fwd = (m.to - m.from + 40) % 40;
        if (m.how === 'jail') tk.queue.push({ from: m.from, n: fwd || 40, jail: true, fast: true });
        else if (m.how === 'back') tk.queue.push({ from: m.from, n: -((40 - fwd) % 40) });
        else tk.queue.push({ from: m.from, n: fwd, fast: fwd > 12 });
        tk.target = m.to;
      }
    }
    lastMoveSeq = st0.moveSeq || 0;
    const teams = st0.settings.mode === 'teams' && st0.teams;
    for (const p of st0.players) {
      const tk = tokens.get(p.id);
      tk.enamel.color.set(p.color); tk.enamel.emissive.set(p.color); tk.felt.color.set(teams ? st0.teams[p.team].color : p.color); tk.ring.material.color.set(p.color);
      if (p.bankrupt && !tk.out) { tk.out = true; tween(900, q => tk.g.scale.setScalar(Math.max(0.001, 1 - q)), () => { tk.g.visible = false; }); }
      if (p.pos !== tk.target) { tk.queue.push({ from: tk.target, n: (p.pos - tk.target + 40) % 40, fast: true }); tk.target = p.pos; }
      if (p.inJail !== tk.jailedState) { tk.jailedState = p.inJail; if (p.inJail) pendingFx.push(() => { tk.jailed = true; }); else tk.jailed = false; }
    }
    tiles.forEach((tile, i) => {
      let st = st0.props[i];
      let owner = st && st0.players.find(p => p.id === st.owner);
      let oc = owner ? owner.color : null;
      if (oc !== tile.owner) {
        tile.owner = oc;
        tile.trim.visible = tile.band.visible = tile.plate.visible = !!oc;
        if (oc) {
          tile.plate.material.color.copy(new THREE.Color(oc).multiplyScalar(0.55));
          paintOwner(tile);
          if (!firstSync) pendingFx.push(() => { sfx.buy(); frameTile(i, 2800); });
        }
      }
      const mort = !!(st && st.mortgaged);
      if (mort !== tile.mortgaged) {
        tile.mortgaged = mort;
        paintOwner(tile);
        if (tile.barrier) { tile.content.remove(tile.barrier); tile.barrier = null; }
        if (mort) {                                     // boarded up
          tile.barrier = bake(placeAll([[FAN, 'planks', { s: 0.24, x: -0.2, z: 0.12, ry: Math.PI / 2 }], [FAN, 'planks', { s: 0.24, x: 0.2, z: 0.12, ry: Math.PI / 2 }]], { palette: tile.palette }));
          tile.content.add(tile.barrier);
        }
      }
      const max = !!(st && st.level >= 5 && oc && !mort);              // Max: a beam of the owner's colour (hidden while mortgaged)
      if (max !== tile.max && !tile.special) {
        tile.max = max;
        if (firstSync) tile.beamOn = max; else queueFx(() => { tile.beamOn = max; });
        if (max) tile.beam.visible = true;
      }
      const houses = st ? Math.min(st.level, 4) : 0;
      if (houses !== tile.houses && !tile.special) {
        if (firstSync) setGrowth(tile, houses, false);
        else queueFx(() => setGrowth(tile, houses, true));
      }
    });
    tiles.forEach(tile => {                               // timed effects: police tape, the mayor's light, gang stains
      const kinds = new Set(tileEffectsOf(st0, tile.sp).map(e => e.kind));
      const key = [...kinds].sort().join();
      if (key === tile.fxKey) return;
      const first = tile.fxKey === '' && firstSync;
      tile.fxKey = key;
      if (first) tileFx.sync(tile, kinds); else pendingFx.push(() => tileFx.sync(tile, kinds));
    });
    lastProps = st0.props;
    if (st0.phase === 'over' && lastPhase === 'playing') pendingFx.push(() => api.celebrate());
    lastPhase = st0.phase;
  }

  // ------------------------------------------------------------ main loop
  const clock = new THREE.Clock();
  let lastFrame = performance.now();
  const tmp = new THREE.Vector3(), head = new THREE.Vector3();
  function frame() {
    if (!alive) return;
    requestAnimationFrame(frame);
    const now = performance.now(), time = clock.getElapsedTime(), dt = now - lastFrame;
    lastFrame = now;
    room.update(time);
    dice.update(now);
    if (props) props.update(time, room.bulbWorld);
    for (let k = tweens.length - 1; k >= 0; k--) {
      const tw = tweens[k], q = Math.min(1, (now - tw.t0) / tw.dur);
      tw.update(q);
      if (q >= 1) { tweens.splice(k, 1); tw.done && tw.done(); }
    }
    const restCount = new Map();
    for (const tk of tokens.values()) if (!tk.anim && !tk.jailed) restCount.set(tk.tile, (restCount.get(tk.tile) || 0) + 1);
    const slots = new Map();
    for (const tk of tokens.values()) {
      if (tk.out) continue;
      if (!tk.anim && tk.queue.length && now >= holdUntil) startStep(tk, tk.queue.shift(), now);
      const a = tk.anim;
      if (a && a.wait) { if (now - a.start >= a.dur) tk.anim = null; }
      else if (a) {                                    // a heavy piece rolling along the street
        const q = Math.min(1, (now - a.start) / a.dur), e = easeInOut(q), tt = a.a + (a.b - a.a) * e;
        lanePoint(tt, LANE, tmp, head);
        tk.g.position.copy(tmp);
        tk.g.rotation.y = yawOf(head);
        tk.tile = ((Math.round(tt) % 40) + 40) % 40;
        const passed = Math.floor(tt);
        if (passed !== a.passed) { a.passed = passed; if (Math.abs(a.b - a.a) < 14) sfx.hop(passed); }
        if (q >= 1) {
          tk.anim = null; tk.t = ((a.b % 40) + 40) % 40; tk.tile = tk.t;
          sfx.land();
          if (!tk.queue.length) frameTile(tk.tile);
        }
      } else {
        const key = tk.jailed ? 'jail' : tk.tile, n = tk.jailed ? 1 : restCount.get(tk.tile) || 1, k = slots.get(key) || 0;
        slots.set(key, k + 1);
        rest(tk, k, n);
        const want = yawOf(restHead);
        if (tk.snap) { tk.snap = false; tk.g.position.copy(restPos); tk.g.rotation.y = want; }
        tk.g.position.lerp(restPos, 0.08);
        let d = want - tk.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        tk.g.rotation.y += d * 0.08;
      }
      const isCur = tk.id === currentId;
      tk.ring.material.opacity += ((isCur ? 0.55 + 0.2 * Math.sin(time * 3) : 0) - tk.ring.material.opacity) * 0.08;
      tk.ring.scale.setScalar(1 + (isCur ? 0.06 * Math.sin(time * 3) : 0));
    }
    // squares wake when hovered, selected or occupied; they lift only a hair
    const occupied = new Set([...tokens.values()].filter(x => !x.out).map(x => (x.jailed ? 10 : x.tile)));
    for (const tile of tiles) {
      const isTarget = targets.has(tile.i);
      const on = tile.i === hovered || tile.i === selected || occupied.has(tile.i) || isTarget;
      life.wake(tile.i, on);
      const aw = life.awake(tile.i);
      tile.lift.position.y = aw * 0.012 + (isTarget ? 0.012 : 0);
      tile.rim.material.opacity = isTarget ? 0.45 + 0.25 * Math.sin(time * 4) : aw * 0.22; tile.rim.visible = isTarget || aw > 0.01;
      tile.rim.material.color.set(isTarget ? '#ffe08a' : '#ffb46a');
      const anc = bubbles.anchor(tile.i);
      if (anc) anc.copy(tile.anchorLocal).applyMatrix4(tile.g.matrixWorld);
      if (lastState) { const info = bubbleInfo(tile.i); if (labelStyle === 'street') plates.set(tile.i, info); else bubbles.set(tile.i, info); const r = roadRent(tile.i); plates.setRent(tile.i, r.text, r.small); }
    }
    for (const tile of tiles) {                          // Max beams fade in and out, and shimmer slowly
      if (!tile.beam.visible) continue;
      const u = tile.beam.userData.mats;
      const next = u[0].uniforms.opacity.value + ((tile.beamOn ? 1 : 0) - u[0].uniforms.opacity.value) * Math.min(1, dt / 700);
      for (const m of u) { m.uniforms.opacity.value = next; m.uniforms.time.value = time; }
      tile.beam.userData.update(time);
      if (!tile.beamOn && next < 0.01) tile.beam.visible = false;
    }
    for (const tile of tiles) {                          // casino neon and wheel, effect lights
      if (tile.casino) tile.casino.update(time, dt / 1000, life.awake(tile.i));
      if (tile.fx) tileFx.update(tile, time, dt / 1000);
    }
    for (const b of squareLamps) b.material.emissiveIntensity = 1.6;
    life.update(time);
    updateFade(dt, now);
    if (pendingFx.length && allIdle()) { const list = pendingFx; pendingFx = []; while (list.length) { list.shift()(); if (!allIdle()) { pendingFx = list.concat(pendingFx); break; } } }
    direct(now, dt);
    controls.update();
    post.setFocus(camera.position.distanceTo(controls.target));
    if (labelStyle === 'signs') bubbles.update(camera, time, i => i === hovered || i === selected || occupied.has(i));
    plates.update();
    post.render(dt, time);
  }
  resize();
  resetView();
  frame();

  // ------------------------------------------------------------ public API (same as scene3d.js)
  const api = {
    setBoard(newBoard, newMeta) {
      board = newBoard; meta = newMeta;
      ready.then(() => { if (!alive) return; buildWorld(); lastProps = null; if (lastState) applyState(lastState); });
    },
    setMood() {},
    setQuality: q => post.setQuality(q),
    get qualityMode() { return post.mode; },
    get quality() { return post.tier; },
    setBroadcast: on => post.setBroadcast(on),
    setFollow(v) { follow = v; if (v) userUntil = 0; },
    resetView,
    select(i) { selected = i; },
    setTargets(list) { targets = new Set(list || []); },
    whenIdle(fn) { pendingFx.push(fn); },
    // the global event: a brass wheel rises out of the middle of the square, spins and stops on the key, then sinks away
    globalWheel(segments, key) {
      const wheel = makeWheel3D(THREE, segments), R = 2.3 * S, y = city.position.y + BASE_H * S + 0.01;
      wheel.userData.size = R; wheel.userData.y0 = y; wheel.position.set(0, y, 0.3 * S); wheel.rotation.y = myYaw;
      scene.add(wheel);
      holdUntil = Math.max(holdUntil, performance.now() + 7800);
      if (follow) { const at = new THREE.Vector3(0, y, 0.3 * S); shot.target.copy(at); shot.pos.copy(at).add(seatTurn(new THREE.Vector3(0, 8.5 * KS, 5.5 * KS))); shot.until = performance.now() + 7600; }
      return wheel.show(550).then(() => wheel.spinTo(key, 4600, f => sfx.wheelTick(f))).then(() => new Promise(r => setTimeout(r, 500)))
        .then(() => { wheel.hide(550); });
    },
    hold(ms) { holdUntil = Math.max(holdUntil, performance.now() + ms); },          // keep later effects (money, turn card…) waiting while an overlay plays
    isIdle: () => allIdle(),
    setLabels(all) { bubbles.setShowAll(all); },
    setLabelStyle(st) {
      labelStyle = st === 'signs' ? 'signs' : 'street';
      plates.setStyle(labelStyle);
      bubbles.setHidden(labelStyle !== 'signs');
    },
    get labelStyle() { return labelStyle; },
    get labels() { return bubbles.showAll; },
    emote(pid, e) { const tk = tokens.get(pid); if (tk && !tk.out) emoteAbove(tk, e); },
    gift() { sfx.coins(); },
    // the casino pays out: look in on the square and spin its roulette. With onStart the caller plays its own overlay (the event wheel):
    // onStart runs when the square is free, the roulette just turns in the background, and done is not needed.
    casino(c, done, onStart) {
      pendingFx.push(() => {
        const tile = tiles[c.pos];
        if (!onStart) sfx.roulette();
        if (tile) { frameTile(c.pos, onStart ? 7500 : 6500); if (tile.casino) tile.casino.spin(); }
        if (onStart) { onStart(); return; }
        tween(3100, () => {}, () => {
          done();
          if (c.key === 'bombing' && c.target && tiles[c.target.pos]) { const b = tiles[c.target.pos]; smokeAt(new THREE.Vector3(b.g.position.x, BASE_H + 0.2, b.g.position.z), 16, '#3a342e'); }
        });
      });
    },
    // the smoke of a bombing, once the verdict is out
    bomb(pos) { const b = tiles[pos]; if (b) smokeAt(new THREE.Vector3(b.g.position.x, BASE_H + 0.2, b.g.position.z), 16, '#3a342e'); },
    chaos() { smokeAt(new THREE.Vector3(0, PLAZA_Y + 0.1, 0.3), 16); sfx.chaos(); },
    celebrate() { smokeAt(new THREE.Vector3(0, PLAZA_Y + 0.1, 0.3), 20, '#8a7c66'); sfx.win(); },
    update(st0) {
      lastState = st0;
      const yaw = viewYaw(st0);
      if (yaw !== myYaw) { myYaw = yaw; plates.setNear(((-Math.round(yaw / (Math.PI / 2))) % 4 + 4) % 4); resetView(); }
      if (props) { const snap = st0; pendingFx.push(() => props.sync(snap)); }
      if (!tiles.length) return;
      applyState(st0);
    },
    destroy() {
      alive = false;
      resizeObs.disconnect();
      controls.dispose();
      post.dispose();
      bubbles.dispose(); plates.dispose();
      sfx.place && sfx.place(null);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
  return api;
}
