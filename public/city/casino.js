// City Mode: the casino square. A smoky 1960s gambling house: a dark front with a red neon CASINO board
// that stutters now and then, a canopy of chasing bulbs over the door, a lit window, and out on the
// forecourt a roulette wheel on a brass stand. The wheel turns slowly on its own and spins up with a
// ball when the casino pays out (spin()). Everything is built here from primitives so it keeps its own
// materials (the square merges the rest of its decor into one mesh).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3]);

// the wheel seen from above: red and black pockets round a green zero, a wooden track, a brass hub
let wheelMap = null;
function wheelTexture() {
  if (wheelMap) return wheelMap;
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), m = s / 2;
  g.fillStyle = '#24160d'; g.beginPath(); g.arc(m, m, m, 0, TAU); g.fill();
  const a0 = -Math.PI / 2 - Math.PI / 37;
  ORDER.forEach((n, k) => {
    const a = a0 + k * TAU / 37, b = a + TAU / 37;
    g.fillStyle = n === 0 ? '#1d6b3a' : REDS.has(n) ? '#b3261e' : '#14120f';
    g.beginPath(); g.arc(m, m, 246, a, b); g.arc(m, m, 186, b, a, true); g.closePath(); g.fill();
    g.strokeStyle = '#d4af5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(m + Math.cos(a) * 186, m + Math.sin(a) * 186); g.lineTo(m + Math.cos(a) * 246, m + Math.sin(a) * 246); g.stroke();
    g.save(); g.translate(m + Math.cos((a + b) / 2) * 216, m + Math.sin((a + b) / 2) * 216); g.rotate((a + b) / 2 + Math.PI / 2);
    g.fillStyle = '#f0e6c8'; g.font = '600 20px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 0, 0); g.restore();
  });
  g.strokeStyle = '#d4af5a'; g.lineWidth = 5;
  for (const r of [248, 186, 150]) { g.beginPath(); g.arc(m, m, r, 0, TAU); g.stroke(); }
  const wood = g.createRadialGradient(m, m, 60, m, m, 186);                  // the sloped wooden bowl
  wood.addColorStop(0, '#4a2c16'); wood.addColorStop(1, '#2b180c');
  g.fillStyle = wood; g.beginPath(); g.arc(m, m, 184, 0, TAU); g.arc(m, m, 152, 0, TAU, true); g.fill('evenodd');
  const hub = g.createRadialGradient(m, m, 6, m, m, 150);
  hub.addColorStop(0, '#6a4a22'); hub.addColorStop(1, '#2a190c');
  g.fillStyle = hub; g.beginPath(); g.arc(m, m, 150, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(212,175,90,.35)'; g.lineWidth = 2;
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; g.beginPath(); g.moveTo(m + Math.cos(a) * 30, m + Math.sin(a) * 30); g.lineTo(m + Math.cos(a) * 148, m + Math.sin(a) * 148); g.stroke(); }
  wheelMap = new THREE.CanvasTexture(c); wheelMap.colorSpace = THREE.SRGBColorSpace; wheelMap.anisotropy = 8;
  return wheelMap;
}

export function buildCasino({ sign, std, iron, brass, goldM, dot, name = 'CASINO' }) {
  const g = new THREE.Group();
  g.userData.live = true;
  const shadowed = m => { m.castShadow = m.receiveShadow = true; return m; };
  const box = (w, h, d, mat, x, y, z) => { const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); g.add(m); return m; };
  const cyl = (r0, r1, h, mat, x, y, z, seg = 10) => { const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat)); m.position.set(x, y, z); g.add(m); return m; };
  const wall = std('#1b1214', { roughness: 0.8 }), trim = std('#6d1c17', { roughness: 0.6 });

  // the house: a dark block with a brass cornice, a parapet, and a recess for the door
  const FZ = 0.62;                                                         // the front wall
  box(0.96, 0.72, 0.7, wall, 0, 0.36, FZ + 0.35);
  box(1.0, 0.035, 0.74, std('#8a6d38', { roughness: 0.4, metalness: 0.7 }), 0, 0.735, FZ + 0.35);
  box(0.96, 0.06, 0.7, std('#120d0e'), 0, 0.78, FZ + 0.35);
  box(0.96, 0.02, 0.02, trim, 0, 0.1, FZ - 0.005);
  const board = sign(name, { w: 0.84, tone: 'red', icon: 'marquee' });
  board.position.set(0, 0.53, FZ - 0.012); board.rotation.y = Math.PI; g.add(board);
  for (const sx of [-1, 1]) box(0.02, 0.5, 0.025, goldM(), sx * 0.455, 0.35, FZ - 0.008);     // gold pilasters

  // the big window on the left, a warm light behind it
  const glassMat = new THREE.MeshStandardMaterial({ color: '#1a0e08', emissive: '#ff9a4a', emissiveIntensity: 0.5, roughness: 0.3 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), glassMat);
  glass.position.set(-0.22, 0.2, FZ - 0.004); glass.rotation.y = Math.PI; g.add(glass);
  box(0.36, 0.012, 0.02, brass(), -0.22, 0.325, FZ - 0.01); box(0.36, 0.012, 0.02, brass(), -0.22, 0.075, FZ - 0.01);
  for (const x of [-0.39, -0.22, -0.05]) box(0.01, 0.25, 0.015, iron(), x, 0.2, FZ - 0.01);
  box(0.36, 0.01, 0.015, iron(), -0.22, 0.2, FZ - 0.01);

  // the entrance: a lit doorway under a canopy of chasing bulbs, a worn carpet out to the kerb
  const doorMat = new THREE.MeshStandardMaterial({ color: '#0a0706', emissive: '#ffb257', emissiveIntensity: 0.55, roughness: 0.5 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.26), doorMat);
  door.position.set(0.25, 0.14, FZ - 0.006); door.rotation.y = Math.PI; g.add(door);
  box(0.34, 0.03, 0.32, trim, 0.25, 0.31, FZ - 0.15);
  box(0.36, 0.012, 0.34, goldM(), 0.25, 0.33, FZ - 0.15);
  for (const sx of [-1, 1]) cyl(0.008, 0.01, 0.31, brass(), 0.25 + sx * 0.155, 0.155, FZ - 0.3, 6);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.58), std('#5d1814', { roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0.25, 0.003, FZ - 0.3); carpet.receiveShadow = true; g.add(carpet);
  const bulbA = new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: '#ffd27a', emissiveIntensity: 1 });
  const bulbB = bulbA.clone();
  const bulbGeo = new THREE.SphereGeometry(0.011, 8, 6);
  const bulbs = [];
  for (let k = 0; k < 8; k++) bulbs.push([0.25 - 0.17 + k * 0.34 / 7, FZ - 0.32]);                      // along the front edge
  for (const sx of [-1, 1]) for (let k = 1; k <= 3; k++) bulbs.push([0.25 + sx * 0.17, FZ - 0.32 + k * 0.08]);   // and down both sides
  bulbs.forEach(([x, z], k) => { const b = new THREE.Mesh(bulbGeo, k % 2 ? bulbA : bulbB); b.position.set(x, 0.32, z); g.add(b); });

  // the roulette wheel out front: a brass stand, a tilted wooden bowl, the spinning disc, a hub and a ball
  const R = 0.235, WX = -0.255, WZ = 0.3;
  cyl(0.12, 0.14, 0.03, goldM(), WX, 0.015, WZ, 20); cyl(0.04, 0.07, 0.15, brass(), WX, 0.105, WZ, 14);
  const tilt = new THREE.Group(); tilt.position.set(WX, 0.2, WZ); tilt.rotation.x = -0.34; g.add(tilt);
  const bowl = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.03, 40), std('#2a1a10', { roughness: 0.35, metalness: 0.1 })));
  bowl.position.y = -0.012; tilt.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.022, 0.012, 8, 40), goldM()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.006; tilt.add(rim);
  const wheel = new THREE.Group(); wheel.position.y = 0.006; tilt.add(wheel);
  const map = wheelTexture();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.016, 40), [std('#2a1a10'), new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.4 }), std('#2a1a10')]);
  wheel.add(disc);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 14), goldM()); hub.position.y = 0.04; wheel.add(hub);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), goldM()); knob.position.y = 0.07; wheel.add(knob);
  for (let k = 0; k < 4; k++) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.006), goldM()); arm.position.y = 0.036; arm.rotation.y = k * Math.PI / 2 + Math.PI / 4; arm.position.x = 0; wheel.add(arm); }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), new THREE.MeshStandardMaterial({ color: '#f4f0e6', emissive: '#fff4d8', emissiveIntensity: 0.5, roughness: 0.2 }));
  tilt.add(ball);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ffb25e', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22 }));
  halo.position.set(WX, 0.32, WZ - 0.05); halo.scale.setScalar(0.7); g.add(halo);

  // state of the wheel: its own slow turn, a spin-up, and the ball
  let wAngle = Math.random() * TAU, bAngle = 0, bLocal = 1, bR = 0.15, bY = 0, spinT0 = -1, settled = true;
  const SPIN = 2500;
  function placeBall() {
    const a = bAngle;
    ball.position.set(Math.cos(a) * bR * R / 0.2, 0.016 + bY, Math.sin(a) * bR * R / 0.2);
  }
  bAngle = wAngle + bLocal; placeBall();

  let nextFlicker = 2 + Math.random() * 5, flickerUntil = 0;
  const boardMat = board.material;
  function update(time, dt, awake = 0) {
    // the neon: steady with a faint hum, and every few seconds a short, irregular stutter
    if (time > nextFlicker) { flickerUntil = time + 0.25 + Math.random() * 0.4; nextFlicker = time + 3 + Math.random() * 8; }
    let k = 1;
    if (time < flickerUntil) k = Math.sin(time * 61) * Math.sin(time * 27.3 + 1) > -0.15 ? 1 : 0.12;
    boardMat.emissiveIntensity = (0.85 + awake * 0.85) * k * (0.93 + 0.07 * Math.sin(time * 3.3));
    const phase = Math.sin(time * 5.5) > 0;
    const lvl = 0.5 + awake * 0.8;
    bulbA.emissiveIntensity = (phase ? 1.6 : 0.25) * lvl; bulbB.emissiveIntensity = (phase ? 0.25 : 1.6) * lvl;
    glassMat.emissiveIntensity = (0.4 + awake * 0.35 + 0.06 * Math.sin(time * 1.7)) * (time < flickerUntil ? 0.75 : 1);
    doorMat.emissiveIntensity = 0.45 + awake * 0.4;
    halo.material.opacity = 0.16 + awake * 0.14;

    let w = 0.14;                                                       // idle: a slow, lazy turn
    if (spinT0 >= 0) {
      const q = Math.min(1, (performance.now() - spinT0) / SPIN);
      w += 11 * (1 - q) ** 2;                                           // spun up hard, slowing right down
      if (q < 0.82) {                                                   // the ball races the other way round the rim
        bAngle -= (14 * (1 - q) ** 1.4 + 2.2) * dt;
        bR = 0.178 - 0.01 * q; bY = 0;
        if (q > 0.7) bR = 0.17 - (q - 0.7) * 0.2;
      } else {                                                          // it drops into a pocket, hops, and rides with the wheel
        if (settled === false) { bLocal = bAngle - wAngle; settled = true; }
        bR += (0.165 - bR) * Math.min(1, dt * 8);
        bY = Math.max(0, Math.sin((q - 0.82) * 38) * 0.012 * (1 - q) * 5);
        bAngle = wAngle + bLocal;
      }
      if (q >= 1) spinT0 = -1;
    } else { bR += (0.165 - bR) * Math.min(1, dt * 4); bAngle = wAngle + bLocal; bY = 0; }
    wAngle += w * dt;
    wheel.rotation.y = -wAngle;
    placeBall();
  }
  function spin() { spinT0 = performance.now(); settled = false; bR = 0.178; }

  g.userData.casino = { update, spin, haze: [new THREE.Vector3(0.25, 0.36, FZ - 0.2), new THREE.Vector3(-0.25, 0.3, 0.4), new THREE.Vector3(0.05, 0.5, FZ - 0.1)] };
  return g;
}
