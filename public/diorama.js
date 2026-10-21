// The world around the board: sky dome, floating island, scenery, cloud sea.
// Everything is procedural, soft and chunky (see palette.js).
import * as THREE from 'three';
import { P } from './palette.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

// ------------------------------------------------------------------ sky

export function createSky() {
  const uniforms = {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, horizon, bottom, sunDir, sunColor;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.45));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 90.0) * 1.6 + pow(s, 9.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 24), material);
  mesh.renderOrder = -10;

  // stars fade in at night
  const n = 1200, pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(0.04, 1), rand(-1, 1)).normalize().multiplyScalar(rand(110, 130));
    pos.set([v.x, v.y, v.z], k * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#FFF6E0', size: 0.6, fog: false, transparent: true, opacity: 0, depthWrite: false }));
  mesh.add(stars);
  return { mesh, uniforms, stars };
}

// ------------------------------------------------------------------ island

// A rounded floating island: grass top, overhanging lip, layered soil, rocky underside.
export function buildIsland(radius = 10.6, depth = 7.6) {
  const s = radius / 10.6, d = depth / 7.6;
  const profile = [
    [0, 0], [9.5, 0], [10.25, -0.06], [10.6, -0.28], [10.5, -0.55], [10.15, -0.78],
    [9.9, -1.2], [9.55, -1.9], [8.9, -2.7], [7.6, -3.7], [6.0, -4.7], [4.3, -5.7], [2.6, -6.6], [1.1, -7.3], [0, -7.6],
  ].map(([x, y]) => new THREE.Vector2(x * s, y * d));
  const geo = new THREE.LatheGeometry(profile, 72);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
  const band = (y, stops) => {               // y is in "unit island" space (0 → -7.6)
    for (let k = 0; k < stops.length - 1; k++) {
      const [y0, col0] = stops[k], [y1, col1] = stops[k + 1];
      if (y <= y0 && y >= y1) return c.copy(cA.set(col0)).lerp(cB.set(col1), (y0 - y) / (y0 - y1));
    }
    return c.set(stops[stops.length - 1][1]);
  };
  const stops = [
    [0.1, P.grass], [-0.12, P.grass], [-0.32, P.grassLight], [-0.62, P.grassDark], [-0.85, P.soil],
    [-1.5, P.soil], [-1.8, P.soilDark], [-2.2, P.soil], [-2.9, P.soilDark], [-3.6, P.rock], [-7.6, P.rockDark],
  ];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z), th = Math.atan2(z, x), uy = y / d;
    if (r > 0.05) {
      const below = uy < -0.3 ? 1 : 0.25;
      const n = 0.045 * Math.sin(3 * th + 1.3) + 0.03 * Math.sin(7 * th + 0.4) + 0.018 * Math.sin(13 * th + 2.1);
      const lumpy = uy < -1 ? 0.22 * Math.sin(5 * th + uy * 1.7) * s : 0;
      const nr = r * (1 + n * below) + lumpy;
      x = Math.cos(th) * nr; z = Math.sin(th) * nr;
      if (uy < -2) y += 0.3 * Math.sin(4 * th + uy) * d;
      p.setXYZ(i, x, y, z);
    }
    band(uy, stops).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// ------------------------------------------------------------------ props

export function makeTree(scale = 1, palette = [P.leaf, P.grass, P.leafDark]) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.8, 10), std(P.woodDeep));
  trunk.position.y = 0.4;
  g.add(trunk);
  const leaf = std(pick(palette), { roughness: 0.75 });
  const blobs = Math.random() < 0.5 ? [[0, 1.05, 0, 0.55]] : [[0, 1.0, 0, 0.5], [0.22, 1.32, 0.05, 0.36], [-0.18, 1.25, -0.08, 0.32]];
  for (const [x, y, z, r] of blobs) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), leaf);
    b.position.set(x, y, z);
    b.scale.y = 0.92;
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeBush(scale = 1) {
  const g = new THREE.Group();
  const m = std(pick([P.grassDark, P.leaf, P.leafDark]), { roughness: 0.8 });
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.18, 0.28), 14, 10), m);
    b.position.set(rand(-0.2, 0.2), 0.16, rand(-0.2, 0.2));
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeRock(scale = 1) {
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), std(pick([P.rock, P.stoneDark]), { roughness: 0.95 }));
  r.scale.set(scale * rand(0.8, 1.3), scale * rand(0.5, 0.9), scale * rand(0.8, 1.2));
  r.position.y = 0.08 * scale;
  return r;
}

// Street lamp; its bulb material is shared so moods can switch every lamp on at once.
export function makeLamp(bulbMat) {
  const g = new THREE.Group();
  const metal = std('#3D5A55', { roughness: 0.5, metalness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 12), metal);
  base.position.y = 0.06;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.25, 10), metal);
  pole.position.y = 0.68;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 12), metal);
  cap.position.y = 1.47;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), bulbMat);
  bulb.position.y = 1.33;
  g.add(base, pole, cap, bulb);
  return g;
}

// Instanced flowers sprinkled over a ring of grass.
export function makeFlowers(count, rMin, rMax, avoid) {
  const geo = new THREE.SphereGeometry(0.06, 8, 6);
  const mesh = new THREE.InstancedMesh(geo, std('#ffffff', { roughness: 0.6 }), count);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  let k = 0, guard = 0;
  while (k < count && guard++ < count * 10) {
    const a = Math.random() * Math.PI * 2, r = rand(rMin, rMax);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (avoid && avoid(x, z)) continue;
    m.makeTranslation(x, 0.06, z);
    mesh.setMatrixAt(k, m);
    mesh.setColorAt(k, col.set(pick([P.coral, P.sunflower, P.berry, '#FFFFFF', P.plum])));
    k++;
  }
  mesh.count = k;
  return mesh;
}

// A soft sea of clouds far below the island.
export function makeCloudSea(material) {
  const n = 70;
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), material, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, r = rand(8, 75);
    p.set(Math.cos(a) * r, rand(-15, -10), Math.sin(a) * r);
    sc.set(rand(3, 7), rand(1.2, 2.4), rand(3, 7));
    m.compose(p, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6)), sc);
    mesh.setMatrixAt(k, m);
  }
  return mesh;
}

export function makeCloud(material) {
  const c = new THREE.Group();
  for (let j = 0; j < 4; j++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.9, 1.5), 2), material);
    puff.position.set(j * 1.1 - 1.6, rand(-0.2, 0.4), rand(-0.4, 0.4));
    puff.scale.y = 0.72;
    c.add(puff);
  }
  return c;
}
