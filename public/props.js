// Things people leave on a card table at 2 a.m. Placed around the board, never on it.
// Units: 1 unit = 4 cm. Real models from Poly Haven (see CREDITS.md); simple real-world shapes
// (glass, ashtray, chips, paper) are modelled here with proper PBR materials.
import * as THREE from 'three';
import { loadModel, loadTexture } from './assets.js';
import { BULB_COLOR, UNITS_PER_M } from './room.js';
import { sfx } from './sfx.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// ------------------------------------------------------------------ whiskey

function whiskeyGlass() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0.03, thickness: 0.35, ior: 1.5, metalness: 0, specularIntensity: 1, envMapIntensity: 9, side: THREE.DoubleSide });
  const outer = [[0, 0], [0.92, 0], [0.98, 0.05], [1.0, 0.2], [1.04, 2.2], [1.0, 2.24], [0.96, 2.2], [0.92, 0.5], [0, 0.5]];
  const cup = new THREE.Mesh(lathe(outer), glass);
  const whiskey = new THREE.MeshPhysicalMaterial({ color: '#d9893a', transmission: 1, roughness: 0.02, thickness: 1.2, ior: 1.36, attenuationColor: '#7a3608', attenuationDistance: 0.9 });
  const liquid = new THREE.Mesh(lathe([[0, 0], [0.915, 0], [0.945, 0.69], [0, 0.69]]), whiskey);   // scaled in y as the level drops
  liquid.position.y = 0.51;
  const cubes = [];
  const ice = new THREE.MeshPhysicalMaterial({ color: '#f4fbff', transmission: 1, roughness: 0.14, thickness: 0.6, ior: 1.31, envMapIntensity: 6 });
  const cubeGeo = new THREE.BoxGeometry(0.7, 0.62, 0.7, 2, 2, 2);
  { const p = cubeGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rand(0.92, 1.05), p.getY(i) * rand(0.92, 1.05), p.getZ(i) * rand(0.92, 1.05)); cubeGeo.computeVertexNormals(); }
  for (const [x, y, z, r] of [[-0.22, 1.16, 0.1, 0.4], [0.28, 1.08, -0.18, 1.2], [0.05, 1.4, 0.28, 2.1]]) {
    const c = new THREE.Mesh(cubeGeo, ice);
    c.position.set(x, y, z); c.rotation.set(r, r * 1.7, r * 0.6);
    c.userData.dy = y - 1.2;
    cubes.push(c);
    g.add(c);
  }
  g.add(cup, liquid);
  g.userData = { liquid, cubes };
  return shadowed(g);
}

// ------------------------------------------------------------------ ashtray, cigarette, smoke

const BUTT_MATS = {
  filter: new THREE.MeshStandardMaterial({ color: '#c58a4e', roughness: 0.8 }),
  paper: new THREE.MeshStandardMaterial({ color: '#e9e3d6', roughness: 0.9 }),
  burnt: new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 1 }),
};
const ASH_LIGHT = new THREE.MeshStandardMaterial({ color: '#8a847c', roughness: 1 });
function ashtray() {
  const g = new THREE.Group();
  const amber = new THREE.MeshPhysicalMaterial({ color: '#c99a62', transmission: 0.85, roughness: 0.08, thickness: 0.6, ior: 1.5, attenuationColor: '#4a2a10', attenuationDistance: 0.7, envMapIntensity: 6 });
  g.add(new THREE.Mesh(lathe([[0, 0], [1.5, 0], [1.6, 0.08], [1.62, 0.48], [1.56, 0.55], [1.28, 0.55], [1.16, 0.26], [0, 0.23]]), amber));
  const ashMat = new THREE.MeshStandardMaterial({ color: '#5f5a55', roughness: 1 });
  const ash = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), ashMat);
  ash.rotation.x = -Math.PI / 2; ash.position.y = 0.25;
  g.add(ash);
  for (let k = 0; k < 14; k++) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.05, 0.13), 0), pick([ashMat, new THREE.MeshStandardMaterial({ color: '#8a847c', roughness: 1 })]));
    b.position.set(rand(-0.7, 0.7), 0.27, rand(-0.7, 0.7)); b.scale.y = 0.45;
    g.add(b);
  }
  const addButt = () => {
    const butt = new THREE.Group();
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 16), BUTT_MATS.filter); f.position.y = 0.27;
    const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.22, 16), BUTT_MATS.paper); pp.position.y = 0.65; pp.scale.x = 0.8;  // crushed
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.06, 16), BUTT_MATS.burnt); e.position.y = 0.78;
    butt.add(f, pp, e);
    const a = rand(0, 6.28), r = rand(0.2, 0.75);
    butt.rotation.set(Math.PI / 2 - rand(0.05, 0.3), rand(0, 6.28), rand(-0.3, 0.3));
    butt.position.set(Math.cos(a) * r, 0.36 + g.userData.butts * 0.03, Math.sin(a) * r);
    g.userData.butts++;
    g.add(shadowed(butt));
  };
  const addAsh = n => {
    for (let k = 0; k < n; k++) {
      const b2 = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.05, 0.14), 0), Math.random() < 0.5 ? ashMat : ASH_LIGHT);
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 0.85;
      b2.position.set(Math.cos(a) * r, 0.27 + Math.random() * 0.03, Math.sin(a) * r); b2.scale.y = 0.45;
      g.add(b2);
    }
  };
  g.userData = { butts: 0, addButt, addAsh };
  addButt(); addButt();
  return shadowed(g);
}

function smokeTexture() {
  return canvasTex(128, 128, (g, w) => {
    for (let k = 0; k < 26; k++) {
      const x = 64 + rand(-26, 26), y = 64 + rand(-26, 26), r = rand(14, 40);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${rand(0.05, 0.16)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }
  }, false);
}

// a thin trail that curls upward, widens, drifts, and lights up inside the bulb's beam
function smoke(count = 200) {
  // The raw quad sits far below the floor: passes that re-render the scene with their own material
  // (ambient occlusion, depth of field) would otherwise see it standing at the board centre.
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, -500, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const seed = new Float32Array(count);
  for (let k = 0; k < count; k++) seed[k] = k / count + rand(0, 0.5 / count);
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      time: { value: 0 }, origin: { value: new THREE.Vector3() }, apex: { value: new THREE.Vector3(0, 13, 0) }, tanA: { value: Math.tan(0.62) },
      map: { value: smokeTexture() }, tint: { value: BULB_COLOR.clone() }, density: { value: 0.9 },
    },
    vertexShader: /* glsl */`
      uniform float time, tanA; uniform vec3 origin, apex;
      attribute float seed;
      varying vec2 vUv; varying float vA; varying float vLit;
      void main() {
        float t = fract(time / 9.0 + seed);                       // ~9 s from ember to ceiling
        float rise = t * 11.0 + t * t * 4.0;
        vec3 p = origin + vec3(
          sin(t * 6.0 + seed * 31.0) * 0.7 * t + sin(time * 0.5 + t * 7.0) * 0.5 * t + sin(time * 0.21 + t * 3.0) * 1.4 * t * t,
          rise,
          cos(t * 5.0 + seed * 17.0) * 0.7 * t + cos(time * 0.43 + t * 6.0) * 0.5 * t + 0.6 * t * t + sin(time * 0.17 + t * 4.0) * 0.8 * t * t);
        float size = mix(0.05, 1.9, pow(t, 1.25)) * (0.6 + 0.8 * fract(seed * 7.13));
        float ang = seed * 40.0 + t * 1.5;
        vec2 c = vec2(cos(ang), sin(ang));
        vec2 corner = vec2(position.x, position.y + 500.0);
        vec2 q = vec2(corner.x * c.x - corner.y * c.y, corner.x * c.y + corner.y * c.x) * size * vec2(1.0, 1.6);   // stretched upward
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        mv.xy += q;
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vA = smoothstep(0.0, 0.04, t) * pow(1.0 - t, 2.0) * 0.32;
        float dy = apex.y - p.y;
        float R = max(dy, 0.0) * tanA;
        vLit = 0.25 + 1.1 * (dy > 0.0 ? smoothstep(R, R * 0.4, length(p.xz - apex.xz)) : 0.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec3 tint; uniform float density;
      varying vec2 vUv; varying float vA; varying float vLit;
      void main() {
        float a = texture2D(map, vUv).r * vA * density;
        gl_FragColor = vec4(mix(vec3(0.55, 0.53, 0.52), tint, 0.45) * vLit, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  return mesh;
}

// ------------------------------------------------------------------ poker chips

const CHIP_COLORS = [['#9e2b25', '#efe4c8'], ['#1e1b1a', '#d9b444'], ['#2e5d3f', '#efe4c8'], ['#2f4b7c', '#efe4c8'], ['#e7dcc6', '#9e2b25']];
const chipMats = CHIP_COLORS.map(([base, spot]) => {
  const side = canvasTex(256, 32, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = spot; for (let k = 0; k < 8; k++) g.fillRect(k * 32 + 10, 0, 12, h); });
  const top = canvasTex(256, 256, (g, w) => {
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    g.fillStyle = spot; for (let k = 0; k < 8; k++) { g.save(); g.translate(128, 128); g.rotate(k * Math.PI / 4); g.fillRect(-10, -128, 20, 30); g.restore(); }
    g.strokeStyle = spot; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 70, 0, 7); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(128, 128, 66, 0, 7); g.fill();
  });
  const m = o => new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3, ...o });
  return [m({ map: side }), m({ map: top }), m({ map: top })];
});
const CHIP_GEO = new THREE.CylinderGeometry(0.49, 0.49, 0.13, 40);
function chipStacks(n = 3) {
  const g = new THREE.Group();
  for (let s = 0; s < n; s++) {
    const mats = pick(chipMats), h = Math.floor(rand(3, 13));
    const bx = (s % 2) * 1.05 + rand(-0.06, 0.06), bz = Math.floor(s / 2) * 1.05 + rand(-0.06, 0.06);
    for (let k = 0; k < h; k++) {
      const c = new THREE.Mesh(CHIP_GEO, mats);
      c.position.set(bx + rand(-0.035, 0.035), 0.065 + k * 0.132, bz + rand(-0.035, 0.035));
      c.rotation.y = rand(0, 6);
      g.add(c);
    }
  }
  for (let k = 0; k < 3; k++) {             // a few loose ones
    const c = new THREE.Mesh(CHIP_GEO, pick(chipMats));
    c.position.set(rand(-0.6, 1.8), 0.065, rand(1.1, 2.0)); c.rotation.set(0, rand(0, 6), 0);
    g.add(c);
  }
  return shadowed(g);
}

// ------------------------------------------------------------------ game money (clearly fictional)

const DENOMS = [[1, '#e9e4d8'], [5, '#e3b8c0'], [10, '#e8d79a'], [20, '#b9d3a9'], [50, '#a9c3dc'], [100, '#d8c7a1'], [500, '#e8b48a']];
const billMats = DENOMS.map(([v, tint]) => {
  const map = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,40,40,.55)'; g.lineWidth = 3; g.strokeRect(12, 12, w - 24, h - 24);
    g.lineWidth = 1; g.strokeStyle = 'rgba(40,40,40,.25)';
    for (let k = 0; k < 18; k++) { g.beginPath(); for (let x = 20; x < w - 20; x += 4) g.lineTo(x, h / 2 + Math.sin(x * 0.05 + k * 0.7) * (60 - k * 2.5)); g.stroke(); }
    g.fillStyle = 'rgba(40,40,40,.18)'; g.beginPath(); g.ellipse(w / 2, h / 2, 62, 78, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,40,40,.8)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 26px Oswald, sans-serif'; g.fillText('THE UNDERWORLD RESERVE', w / 2, 38);
    g.font = '500 16px Oswald, sans-serif'; g.fillText('GAME MONEY · NO CASH VALUE', w / 2, h - 30);
    g.font = '400 64px "Abril Fatface", serif';
    for (const [x, y] of [[62, 72], [w - 62, 72], [62, h - 70], [w - 62, h - 70]]) g.fillText(String(v), x, y);
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85, side: THREE.DoubleSide, normalMap: loadTexture('paper_normal', { repeat: [1, 1] }), normalScale: new THREE.Vector2(0.4, 0.4) });
});
const BILL_GEOS = Array.from({ length: 5 }, () => {
  const geo = new THREE.PlaneGeometry(3.2, 1.6, 14, 7);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, a = rand(0, 6), b = rand(0, 6), curl = rand(-0.06, 0.12);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, 0.025 * Math.sin(x * 2.1 + a) * Math.cos(z * 3 + b) + curl * (x / 1.6) ** 2 + 0.012 * Math.sin(x * 9 + z * 7));
  }
  geo.computeVertexNormals();
  return geo;
});
export function moneyPile(count = 26) {
  const g = new THREE.Group();
  for (let k = 0; k < count; k++) {
    const m = new THREE.Mesh(pick(BILL_GEOS), billMats[Math.min(DENOMS.length - 1, Math.floor(Math.random() ** 1.6 * DENOMS.length))]);
    const spread = k < count * 0.6 ? 0.5 : 1.4;
    m.position.set(rand(-spread, spread), 0.05 + k * 0.016, rand(-spread * 0.6, spread * 0.6));
    m.rotation.y = rand(-0.5, 0.5) + (k % 5 === 0 ? rand(-1.2, 1.2) : 0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// ------------------------------------------------------------------ the letter nobody wants

function finalNotice() {
  const map = canvasTex(820, 1160, (g, w, h) => {
    g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(120,100,70,${rand(0.01, 0.05)})`; g.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 4)); }
    g.fillStyle = '#1e1712'; g.textAlign = 'left';
    g.font = '600 42px Oswald, sans-serif'; g.fillText('CONSOLIDATED LOAN & TRUST CO.', 70, 110);
    g.fillRect(70, 130, w - 140, 3);
    g.font = '24px "Special Elite", "Courier New", monospace';
    const lines = ['Dear Sir,', '', 'Our records show your account remains', 'unpaid despite repeated reminders.', '', 'Unless the full balance is settled', 'within SEVEN (7) days, we shall be', 'obliged to take possession of all', 'property, holdings and furnishings.', '', 'This is your last warning.', '', 'Respectfully,', 'The Collections Department'];
    lines.forEach((l, k) => g.fillText(l, 80, 230 + k * 44));
    g.save(); g.translate(w / 2 + 40, 540); g.rotate(-0.22);
    g.strokeStyle = '#9e2b25'; g.lineWidth = 10; g.strokeRect(-250, -70, 500, 140);
    g.fillStyle = '#9e2b25'; g.font = '600 92px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FINAL NOTICE', 0, 6);
    g.restore();
    g.strokeStyle = 'rgba(60,40,20,.25)'; g.lineWidth = 3;
    for (const y of [h / 3, 2 * h / 3]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  // tri-folded letter, opened most of the way: the bottom third still lifts off the table
  const W = 4.6, H = 6.5;
  const geo = new THREE.PlaneGeometry(W, H, 12, 30);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = 0.02 * Math.sin(x * 3 + z * 2) + 0.015 * Math.cos(z * 7);          // crumpled
    const fold = z - H / 6;                                                    // lower third rises
    if (fold > 0) { y += Math.sin(0.5) * fold; p.setZ(i, H / 6 + Math.cos(0.5) * fold); }
    if (Math.abs(z + H / 6) < 0.12) y += 0.03;                                  // crease ridge
    p.setY(i, y + 0.05);                                                     // crumple never dips into the table
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.9, side: THREE.DoubleSide, normalMap: loadTexture('paper_normal', { repeat: [2, 2] }), normalScale: new THREE.Vector2(0.5, 0.5) }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// scribbled scores on the legal pad
function scoreSheet() {
  const map = canvasTex(512, 640, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30,40,90,.85)'; g.fillStyle = 'rgba(30,40,90,.85)';
    g.font = '34px Caveat, "Segoe Script", cursive';
    const rows = [['LEO', '1500', '1340', '980'], ['RITA', '1500', '1720', '2105'], ['BERNIE', '1500', '1210', '640'], ['SAL', '1500', '0 — OUT']];
    rows.forEach((r, i) => r.forEach((c, j) => g.fillText(c, 30 + j * 115, 90 + i * 70 + rand(-3, 3))));
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(140, 300); g.lineTo(240, 296); g.stroke();      // crossed out
    g.beginPath(); g.moveTo(255, 230); g.lineTo(360, 228); g.stroke();
    g.font = '30px Caveat, cursive'; g.fillText('owes me 200!!', 60, 420);
    g.beginPath(); g.ellipse(150, 412, 110, 32, -0.05, 0, 7); g.stroke();
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.8), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

// ------------------------------------------------------------------ layout

// Seats around the table, clockwise from you: front, left, across, right.
// money/chips/letter positions in table coordinates; yaw turns things to face that player.
const SEAT_LAYOUT = [
  { money: [-3.6, 8.7], chips: [2.4, 8.6], letter: [8.2, 9.8], yaw: 0 },
  { money: [-10.8, -1.4], chips: [-10.6, 2.0], letter: [-15.2, -0.8], yaw: -Math.PI / 2 },
  { money: [3.2, -9.8], chips: [-3.0, -10.2], letter: [8.6, -10.8], yaw: Math.PI },
  { money: [10.8, 1.2], chips: [10.2, -3.0], letter: [15.4, 0.8], yaw: Math.PI / 2 },
];
const SEATS_FOR = { 1: [0], 2: [0, 2], 3: [0, 1, 3], 4: [0, 1, 2, 3] };
// The angle (about the vertical axis) from the +z side of the table to the viewer's seat, snapped to a quarter turn; 0 for spectators.
export function viewYaw(S) {
  if (!S || !S.you) return 0;
  const k = S.players.slice(0, 4).findIndex(p => p.id === S.you);
  if (k < 0) return 0;
  const seat = SEAT_LAYOUT[(SEATS_FOR[Math.min(4, S.players.length)] || [])[k]];
  return seat ? Math.round(seat.yaw / (Math.PI / 2)) * (Math.PI / 2) : 0;
}
const DOLLARS_PER_BILL = 60000, MAX_BILLS = 60, DEBT_LINE = 200000;
const CIG_ROUNDS = 10, WHISKEY_ROUNDS = 14;

export function createProps(scene, { tableY }) {
  const group = new THREE.Group();
  group.position.y = tableY;
  scene.add(group);
  const place = (obj, x, z, ry = 0) => { obj.position.set(x, obj.position.y, z); obj.rotation.y += ry; group.add(obj); return obj; };

  // tiny animation runner (props animate independently of the board)
  const anims = [];
  const animate = (dur, step, done) => anims.push({ t0: performance.now(), dur, step, done });

  // ---- whiskey
  const glass = place(whiskeyGlass(), 9.4, 4.6);
  const wet = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.08, 48), new THREE.MeshStandardMaterial({ color: '#1a0e06', transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }));
  wet.rotation.x = -Math.PI / 2; wet.position.set(9.7, 0.006, 4.9);
  group.add(wet);
  let level = 1, levelTarget = 1;          // 1 = freshly poured, 0.15 = nearly gone

  // ---- ashtray & the cigarette burning in it
  const tray = place(ashtray(), -8.8, 6.4);
  const cig = new THREE.Group();
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: '#3a1a10', emissive: '#ff5a1f', emissiveIntensity: 6, roughness: 1 }));
  const ashTip = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.1, 0.32, 16), new THREE.MeshStandardMaterial({ color: '#77716b', roughness: 1 }));
  cig.add(ember, ashTip);
  group.add(cig);
  const emberLight = new THREE.PointLight('#ff6a2a', 0.6, 3, 2);
  cig.add(emberLight);
  const burnPlane = new THREE.Plane();      // clips away the burnt part of the paper
  let cigLen = 0, burn = 0, burnTarget = 0, cigRound = null;
  loadModel('cigarette_pack').then(packModel => {
    let loose = null;
    packModel.traverse(o => { if (o.isMesh && /cigarette$/i.test(o.name)) loose = o; });
    const pack = packModel.clone(true);
    pack.traverse(o => { if (o.isMesh && /cigarette$/i.test(o.name)) o.visible = false; });
    pack.scale.setScalar(UNITS_PER_M); pack.rotation.x = -Math.PI / 2; pack.position.y = 0.6;
    place(shadowed(pack), -12.2, -6.2, 0.5);
    if (!loose) return;
    // re-centre the model: tobacco end at the origin, filter along +y
    const c = loose.clone();
    c.material = c.material.clone();
    c.material.clippingPlanes = [burnPlane];
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.setScalar(UNITS_PER_M);
    const box = new THREE.Box3().setFromObject(c);
    cigLen = box.max.y - box.min.y;
    c.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    cig.add(shadowed(c));
    emberLight.position.set(0, -0.1, 0);
    // rest it across the rim: filter outside, lit end over the ash, tilted down into the tray
    const phi = -0.6, dir = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
    cig.rotation.set(0, phi, -Math.PI / 2 + 0.13, 'XYZ');
    const rim = new THREE.Vector3(-8.8, 0.62, 6.4).addScaledVector(dir, 1.5);
    cig.position.copy(rim).addScaledVector(dir, -0.55 * cigLen).add(new THREE.Vector3(0, -0.55 * cigLen * Math.sin(0.13), 0));
    setBurn(burn);
  });
  function setBurn(b) {                     // b: 0 fresh … 1 down to the filter
    if (!cigLen) return;
    const cut = b * 0.62 * cigLen;
    ashTip.position.set(0, cut - 0.15, 0); ember.position.set(0, cut - 0.01, 0); ember.scale.set(1, 0.35, 1);
    emberLight.position.set(0, cut - 0.1, 0);
    cig.updateMatrixWorld(true);
    const a = cig.localToWorld(new THREE.Vector3(0, cut, 0)), f = cig.localToWorld(new THREE.Vector3(0, cigLen, 0));
    burnPlane.setFromNormalAndCoplanarPoint(f.sub(a).normalize(), a);
  }
  const plume = smoke();
  scene.add(plume);

  // ---- the rest of the clutter
  loadModel('vintage_lighter').then(l => { l.scale.setScalar(UNITS_PER_M); l.rotation.x = -Math.PI / 2; l.position.y = 0.18; place(shadowed(l), -9.6, -7.2, 2.2); });
  loadModel('round_spectacles').then(s => { s.scale.setScalar(UNITS_PER_M); s.position.y = 0.58; place(shadowed(s), 12.0, -6.4, 2.6); });
  let secondHand = null, minuteHand = null, hourHand = null;
  loadModel('vintage_pocket_watch').then(w => {
    w.scale.setScalar(UNITS_PER_M); w.rotation.x = -Math.PI / 2; w.position.y = 0.17;
    w.traverse(o => { if (/second_hand/.test(o.name)) secondHand = o; if (/minute_hand/.test(o.name)) minuteHand = o; if (/hour_hand/.test(o.name)) hourHand = o; });
    place(shadowed(w), 12.8, 4.6, -0.7);
  });
  loadModel('office_notepads').then(n => {
    let pad = null;
    n.traverse(o => { if (o.isMesh && /yellow_pad/.test(o.name)) pad = o; });
    if (!pad) return;
    const pd = pad.clone(); pd.position.set(0, 0, 0); pd.scale.setScalar(UNITS_PER_M * 0.75);
    const holder = new THREE.Group();
    holder.add(shadowed(pd));
    const box = new THREE.Box3().setFromObject(pd);
    const sheet = scoreSheet();
    sheet.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.01, (box.min.z + box.max.z) / 2 + 0.3);
    holder.add(sheet);
    place(holder, -6.4, -11.0, 0.35);
  });

  // ---- seats: a money pile, chips and (when it gets bad) a debt letter for each player
  const seats = SEAT_LAYOUT.map(L => {
    const pile = new THREE.Group();
    pile.position.set(L.money[0], 0, L.money[1]); pile.rotation.y = L.yaw + rand(-0.3, 0.3);
    const chips = chipStacks(Math.floor(rand(2, 5)));
    chips.position.set(L.chips[0], 0, L.chips[1]); chips.rotation.y = rand(0, 6);
    const letter = finalNotice();
    letter.visible = false;
    group.add(pile, chips, letter);
    pile.visible = chips.visible = false;
    return { L, pile, chips, letter, bills: [], player: null, letterOn: false };
  });
  // where bill k sits in a pile: a tidy stack that spreads out as it grows
  const slot = k => {
    const spread = Math.min(1.5, 0.35 + k * 0.03);
    return { x: rand(-spread, spread), y: 0.05 + k * 0.016, z: rand(-spread * 0.55, spread * 0.55), ry: rand(-0.5, 0.5) + (k % 6 === 0 ? rand(-1.1, 1.1) : 0) };
  };
  const newBill = () => {
    const m = new THREE.Mesh(pick(BILL_GEOS), billMats[Math.min(DENOMS.length - 1, Math.floor(Math.random() ** 1.6 * DENOMS.length))]);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  function addBill(seat, from = null) {
    const k = seat.bills.length, s = slot(k), m = from || newBill();
    const target = new THREE.Vector3(s.x, s.y, s.z);
    seat.pile.add(m);
    seat.bills.push(m);
    if (from) {                               // a bill flying over from someone else's pile
      const start = seat.pile.worldToLocal(from.userData.world.clone());
      animate(rand(650, 900), q => {
        m.position.lerpVectors(start, target, q);
        m.position.y += Math.sin(Math.PI * q) * 2.4;
        m.rotation.set(Math.sin(q * 9) * 0.5 * (1 - q), s.ry + (1 - q) * 3, Math.cos(q * 7) * 0.4 * (1 - q));
      }, () => { m.position.copy(target); m.rotation.set(0, s.ry, 0); });
    } else {                                  // the bank drops it on the pile
      m.position.set(s.x, s.y + 2.5, s.z); m.rotation.set(rand(-0.6, 0.6), s.ry, rand(-0.6, 0.6));
      animate(rand(500, 750), q => {
        m.position.y = s.y + 2.5 * (1 - q) ** 2;
        m.rotation.x *= 0.9; m.rotation.z *= 0.9;
      }, () => { m.position.y = s.y; m.rotation.set(0, s.ry, 0); });
    }
  }
  function takeBill(seat) {
    const m = seat.bills.pop();
    if (!m) return null;
    m.userData.world = m.getWorldPosition(new THREE.Vector3());
    seat.pile.remove(m);
    return m;
  }
  function flyAway(m, to) {                   // paid to the bank: off toward the middle of the board, then gone
    group.add(m);
    const start = group.worldToLocal(m.userData.world.clone()), end = to.clone().add(new THREE.Vector3(rand(-1, 1), 0.3, rand(-1, 1)));
    m.material = m.material.clone(); m.material.transparent = true;
    animate(rand(700, 950), q => {
      m.position.lerpVectors(start, end, q); m.position.y += Math.sin(Math.PI * q) * 2;
      m.rotation.y += 0.05; m.material.opacity = 1 - Math.max(0, q - 0.6) / 0.4;
    }, () => { group.remove(m); m.material.dispose(); });
  }
  function showLetter(seat, on) {
    if (seat.letterOn === on) return;
    seat.letterOn = on;
    const { L, letter } = seat;
    const rest = new THREE.Vector3(L.letter[0], 0, L.letter[1]);
    const out = rest.clone().add(new THREE.Vector3(Math.sin(L.yaw), 0, Math.cos(L.yaw)).multiplyScalar(9));   // off the table edge
    const yaw = L.yaw - 0.5 + rand(-0.15, 0.15);
    letter.visible = true;
    if (on && synced) sfx.paper();
    const from = on ? out : rest, to = on ? rest : out;
    animate(on ? 1100 : 800, q => {
      const e = on ? 1 - (1 - q) ** 3 : q * q;
      letter.position.lerpVectors(from, to, e);
      letter.rotation.y = yaw + (1 - e) * (on ? 0.6 : -0.4);
    }, () => { if (!on) letter.visible = false; });
  }

  const billsFor = p => (p.bankrupt ? 0 : Math.min(MAX_BILLS, Math.max(0, Math.round(p.money / DOLLARS_PER_BILL))));
  let synced = false, lastRound = 0;

  function sync(S) {
    // who sits where: in turn order, each player on their own side (the camera turns to the viewer's seat, see viewYaw)
    const n = Math.min(4, S.players.length);
    const order = S.players.slice(0, n);
    const seatIds = SEATS_FOR[n] || [];
    seats.forEach(s => { s.player = null; });
    order.forEach((p, k) => { seats[seatIds[k]].player = p; });
    for (const s of seats) { s.pile.visible = s.chips.visible = !!s.player; if (!s.player) { s.bills.forEach(b => s.pile.remove(b)); s.bills = []; showLetter(s, false); } }

    // money: losers' bills fly to the winners; the bank covers the rest
    const live = seats.filter(s => s.player);
    if (!synced) {
      for (const s of live) for (let k = 0, w = billsFor(s.player); k < w; k++) {
        addBill(s); const m = s.bills[s.bills.length - 1]; const sl = slot(k); m.position.set(sl.x, sl.y, sl.z); m.rotation.set(0, sl.ry, 0);
      }
      anims.length = 0;
    } else {
      const flying = [];
      for (const s of live) for (let d = s.bills.length - billsFor(s.player); d > 0; d--) { const m = takeBill(s); if (m) flying.push(m); }
      for (const s of live) for (let d = billsFor(s.player) - s.bills.length; d > 0; d--) addBill(s, flying.length ? flying.shift() : null);
      for (const m of flying) flyAway(m, new THREE.Vector3(0, 0.3, 0));
    }
    for (const s of live) showLetter(s, S.phase === 'playing' && !s.player.bankrupt && s.player.money < DEBT_LINE);

    // the night wears on: cigarettes burn down, the whiskey goes
    const round = Math.max(1, S.round || 1);
    const cigIdx = Math.floor((round - 1) / CIG_ROUNDS);
    if (cigRound !== null && cigIdx > cigRound) { tray.userData.addButt(); burn = 0; setBurn(0); sfx.lighter(); }   // stubbed out, a fresh one lit
    if (cigRound !== null && round > lastRound) tray.userData.addAsh(2);
    cigRound = cigIdx;
    burnTarget = ((round - 1) % CIG_ROUNDS) / CIG_ROUNDS;
    const pour = ((round - 1) % WHISKEY_ROUNDS) / WHISKEY_ROUNDS;
    const newLevel = 1 - 0.85 * pour;
    if (synced && round > lastRound) { const refill = newLevel > levelTarget; setTimeout(() => (refill ? sfx.pour() : sfx.ice()), 1600); }   // a refill, or a sip
    levelTarget = newLevel;
    if (!synced) { burn = burnTarget; level = levelTarget; setBurn(burn); tray.userData.addAsh(Math.min(30, (round - 1) * 2)); }
    lastRound = round;
    synced = true;
  }

  const emberWorld = new THREE.Vector3();
  return {
    group, sync,
    // which way a player sits (unit vector from the board centre toward them) and where their pile is
    seatDir(id) { const s = seats.find(x => x.player && x.player.id === id); return s ? new THREE.Vector3(Math.sin(s.L.yaw), 0, Math.cos(s.L.yaw)) : null; },
    seatPosition(id) { const s = seats.find(x => x.player && x.player.id === id); return s ? s.pile.getWorldPosition(new THREE.Vector3()) : null; },
    update(time, bulbWorld) {
      const now = performance.now();
      for (let k = anims.length - 1; k >= 0; k--) {
        const a = anims[k], q = Math.min(1, (now - a.t0) / a.dur);
        a.step(q);
        if (q >= 1) { anims.splice(k, 1); a.done && a.done(); }
      }
      if (Math.abs(burn - burnTarget) > 0.001) { burn += (burnTarget - burn) * 0.02; setBurn(burn); }
      if (Math.abs(level - levelTarget) > 0.001) {
        level += (levelTarget - level) * (levelTarget > level ? 0.05 : 0.01);    // refills pour fast, sipping is slow
        const { liquid, cubes } = glass.userData;
        liquid.scale.y = Math.max(0.02, level);
        const top = 0.51 + 0.69 * level;
        for (const c of cubes) { c.position.y = top + c.userData.dy * level - 0.05; c.scale.setScalar(0.55 + 0.45 * level); }   // ice melts as it goes
      }
      const f = 0.8 + 0.2 * Math.sin(time * 3.1) * Math.sin(time * 1.7) + 0.1 * Math.sin(time * 13);
      ember.material.emissiveIntensity = 5 * f;
      emberLight.intensity = 0.5 * f;
      ember.getWorldPosition(emberWorld);
      plume.material.uniforms.time.value = time;
      plume.material.uniforms.origin.value.copy(emberWorld);
      if (bulbWorld) plume.material.uniforms.apex.value.copy(bulbWorld);
      const d = new Date();
      if (secondHand) secondHand.rotation.z = -d.getSeconds() / 60 * Math.PI * 2;
      if (minuteHand) minuteHand.rotation.z = -d.getMinutes() / 60 * Math.PI * 2;
      if (hourHand) hourHand.rotation.z = -(d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2;
    },
  };
}
