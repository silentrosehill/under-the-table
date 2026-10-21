// Physics dice. Each throw is simulated with cannon-es first, then played back; the visible die
// is turned (by a cube symmetry) so the face that physically ends up on top shows the server's
// roll. The game logic decides the numbers, physics only decides how they get there.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'cannon-es';

const SIZE = 0.48;                 // 19 mm casino-size dice (1 unit = 4 cm)
const G = 9.82 * 25;               // gravity in units/s²
const STEP = 1 / 120;
// face values on the +x, -x, +y, -y, +z, -z sides (opposite faces sum to 7)
const FACE_VALUES = [2, 5, 1, 6, 3, 4];
const FACE_NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => new THREE.Vector3(...v));
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

function faceMaps(v) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, N, N);
  const n = document.createElement('canvas'); n.width = n.height = N;
  const ng = n.getContext('2d');
  const img = ng.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { img.data[i * 4] = 128; img.data[i * 4 + 1] = 128; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255; }
  const r = v === 1 ? 30 : 22;
  for (const [px, py] of PIPS[v]) {
    const cx = N / 2 + px * 64, cy = N / 2 + py * 64;
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 2, cx, cy, r);
    gr.addColorStop(0, v === 1 ? '#6e1410' : '#14110f'); gr.addColorStop(1, v === 1 ? '#a3241d' : '#2c2622');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    // a spherical dimple in the normal map
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / r; if (d > 1) continue;
      const k = ((cy + y) * N + (cx + x)) * 4, s = 0.85 * Math.sin(d * Math.PI / 2);
      img.data[k] = 128 - (x / (r * d || 1)) * s * 127; img.data[k + 1] = 128 + (y / (r * d || 1)) * s * 127;
    }
  }
  ng.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const normalMap = new THREE.CanvasTexture(n);
  return { map, normalMap };
}

export function createDice(scene, { surfaceY = 0, area = 4.3, sfx }) {
  const mats = FACE_VALUES.map(v => { const { map, normalMap } = faceMaps(v); return new THREE.MeshPhysicalMaterial({ map, normalMap, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }); });
  const geo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, SIZE * 0.14);
  const dice = [0, 1].map(() => {
    const pivot = new THREE.Group();                         // follows the simulated body
    const mesh = new THREE.Mesh(geo, mats);                  // turned so the right number ends up on top
    mesh.castShadow = mesh.receiveShadow = true;
    pivot.add(mesh);
    scene.add(pivot);
    return { pivot, mesh };
  });

  // a value on top at rest, with a random spin
  const faceUpQuat = v => new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[FACE_VALUES.indexOf(v)], new THREE.Vector3(0, 1, 0));
  function place(values, spots = [[-0.5, 1.2], [0.55, 1.4]]) {
    dice.forEach((d, k) => {
      d.mesh.quaternion.identity();
      d.pivot.position.set(spots[k][0], surfaceY + SIZE / 2, spots[k][1]);
      d.pivot.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6).multiply(faceUpQuat(values[k])));
    });
  }

  function simulate(from) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -G, 0) });
    world.allowSleep = true;
    const felt = new CANNON.Material('board'), die = new CANNON.Material('die');
    world.addContactMaterial(new CANNON.ContactMaterial(felt, die, { friction: 0.32, restitution: 0.38 }));
    world.addContactMaterial(new CANNON.ContactMaterial(die, die, { friction: 0.2, restitution: 0.45 }));
    const ground = new CANNON.Body({ mass: 0, material: felt, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); ground.position.y = surfaceY;
    world.addBody(ground);
    for (const [x, z, ry] of [[area, 0, -Math.PI / 2], [-area, 0, Math.PI / 2], [0, area, Math.PI], [0, -area, 0]]) {   // invisible walls
      const w = new CANNON.Body({ mass: 0, material: felt, shape: new CANNON.Plane() });
      w.quaternion.setFromEuler(0, ry, 0); w.position.set(x, 0, z);
      world.addBody(w);
    }
    const side = new THREE.Vector3(-from.z, 0, from.x);
    const bodies = [0, 1].map(k => {
      const b = new CANNON.Body({ mass: 0.004, material: die, shape: new CANNON.Box(new CANNON.Vec3(SIZE / 2, SIZE / 2, SIZE / 2)), linearDamping: 0.08, angularDamping: 0.12, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.25 });
      const p = from.clone().multiplyScalar(area - 0.6).addScaledVector(side, (k - 0.5) * 1.2 + (Math.random() - 0.5) * 0.6);
      b.position.set(p.x, surfaceY + 2.2 + k * 0.3, p.z);
      const v = from.clone().multiplyScalar(-(26 + Math.random() * 14)).addScaledVector(side, (Math.random() - 0.5) * 10);
      b.velocity.set(v.x, 2 + Math.random() * 4, v.z);
      b.angularVelocity.set((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 60);
      b.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      world.addBody(b);
      return b;
    });
    const frames = [], hits = [];
    let lastHit = -1;
    bodies.forEach(b => b.addEventListener('collide', e => {
      const t = frames.length * STEP, speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (speed > 3 && t - lastHit > 0.045) { hits.push([t, Math.min(1, speed / 40)]); lastHit = t; }
    }));
    for (let i = 0; i < 6 / STEP; i++) {
      world.step(STEP);
      frames.push(bodies.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
      if (i > 60 && bodies.every(b => b.sleepState === CANNON.Body.SLEEPING)) break;
    }
    return { frames, hits };
  }

  let play = null;
  function roll(values, from = new THREE.Vector3(0, 0, 1)) {
    const sim = simulate(from.clone().setY(0).normalize());
    const last = sim.frames[sim.frames.length - 1];
    dice.forEach((d, k) => {
      const q = new THREE.Quaternion(last[k][3], last[k][4], last[k][5], last[k][6]);
      // which face physically ended up on top?
      let best = 0, bestY = -2;
      FACE_NORMALS.forEach((n, i) => { const y = n.clone().applyQuaternion(q).y; if (y > bestY) { bestY = y; best = i; } });
      d.mesh.quaternion.setFromUnitVectors(FACE_NORMALS[FACE_VALUES.indexOf(values[k])], FACE_NORMALS[best]);
    });
    play = { t0: performance.now(), ...sim, hitIdx: 0 };
    return sim.frames.length * STEP * 1000;
  }

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function update(now) {
    if (!play) return;
    const t = (now - play.t0) / 1000, f = t / STEP;
    const i = Math.min(play.frames.length - 1, Math.floor(f)), j = Math.min(play.frames.length - 1, i + 1), a = f - Math.floor(f);
    dice.forEach((d, k) => {
      const A = play.frames[i][k], B = play.frames[j][k];
      d.pivot.position.set(A[0] + (B[0] - A[0]) * a, A[1] + (B[1] - A[1]) * a, A[2] + (B[2] - A[2]) * a);
      qa.set(A[3], A[4], A[5], A[6]); qb.set(B[3], B[4], B[5], B[6]);
      d.pivot.quaternion.slerpQuaternions(qa, qb, a);
    });
    while (play.hitIdx < play.hits.length && play.hits[play.hitIdx][0] <= t) { sfx && sfx.click && sfx.click(play.hits[play.hitIdx][1]); play.hitIdx++; }
    if (i >= play.frames.length - 1) play = null;
  }

  return { place, roll, update, get rolling() { return !!play; }, center: () => dice[0].pivot.position.clone().lerp(dice[1].pivot.position, 0.5) };
}
