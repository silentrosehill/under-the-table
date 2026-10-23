// A modelled wheel of fortune lying flat on the board: lacquer red/black sectors, brass rim, hub and pointer.
// Built at radius 1 (the caller scales and places it); the pointer sits on the +z side, turn the group about y toward the viewer's seat.
//
//   const w = makeWheel3D(THREE, [{ key, label, icon }, ...]);
//   scene.add(w); await w.show(500); await w.spinTo('boom', 5200, f => sfx.wheelTick(f)); await w.hide(500);
// show/hide scale it up out of the board (and back); spinTo resolves once it has rested (after a small wobble).

import { ms as slow } from './speed.js';
import { keyOfEmoji, iconDataUrl } from './icons.js';

const ease = k => 1 - Math.pow(1 - k, 3.4);
const run = (ms, fn) => new Promise(res => {
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms); fn(k); k < 1 ? requestAnimationFrame(step) : res(); };
  requestAnimationFrame(step);
});

function faceTexture(THREE, segs) {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // the segment icons are the HUD's line icons (icons.js); the face is painted again once they have loaded
  const imgs = segs.map(s => { const k = keyOfEmoji(s.icon) || (/^[a-zA-Z]+$/.test(s.icon || '') ? s.icon : null); if (!k) return null; const im = new Image(); im.src = iconDataUrl(k, '#f2e8d0', 1.7); im.onload = () => { draw(); t.needsUpdate = true; }; return im; });
  const draw = () => {
  const g = c.getContext('2d'), R = N / 2, n = segs.length, A = Math.PI * 2 / n;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N, N);
  g.translate(R, R);
  segs.forEach((s, i) => {
    const a0 = i * A - Math.PI / 2, a1 = a0 + A;                  // clockwise from the top, as seen from above
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R * 0.97, a0, a1); g.closePath();
    g.fillStyle = i % 2 ? '#14100e' : '#8c1c16'; g.fill();
    g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.stroke();
    g.save(); g.rotate(a0 + A / 2);                                // x now points outward through the middle of the sector
    const flip = Math.cos(a0 + A / 2) < 0;                         // keep the lettering roughly upright on the left half
    if (flip) g.rotate(Math.PI);
    const sgn = flip ? -1 : 1;
    g.textBaseline = 'middle'; g.textAlign = flip ? 'right' : 'left';
    const im = imgs[i];
    if (im && im.complete && im.naturalWidth) { g.drawImage(im, sgn * R * 0.72 + (flip ? -68 : 0), -34, 68, 68); }
    let px = 40; g.font = `600 ${px}px Oswald, "Helvetica Neue", sans-serif`;
    const maxW = R * 0.5; while (g.measureText(s.label).width > maxW && px > 20) g.font = `600 ${--px}px Oswald, "Helvetica Neue", sans-serif`;
    g.fillStyle = '#f2e8d0'; g.fillText(s.label, sgn * R * 0.2, 0);
    g.restore();
  });
  };
  draw();
  return t;
}

export function makeWheel3D(THREE, segments) {
  const segs = (segments || []).filter(Boolean), n = Math.max(1, segs.length);
  const root = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.9, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.5 });
  const tex = faceTexture(THREE, segs);
  const disc = new THREE.Group(); root.add(disc);                  // the part that turns

  const face = new THREE.Mesh(new THREE.CircleGeometry(0.97, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.22 }));
  face.rotation.x = -Math.PI / 2; face.position.y = 0.075; disc.add(face);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.08, 96), dark); body.position.y = 0.035; body.castShadow = body.receiveShadow = true; disc.add(body);
  const bevel = new THREE.Mesh(new THREE.TorusGeometry(0.985, 0.03, 10, 96), brass); bevel.rotation.x = Math.PI / 2; bevel.position.y = 0.078; disc.add(bevel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.045, 12, 96), brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.06; rim.castShadow = true; root.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 32), brass); hub.position.y = 0.11; hub.castShadow = true; root.add(hub);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass); cap.position.y = 0.145; root.add(cap);
  const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 4), brass);   // flat arrow on the rim, tip toward the middle
  ptr.rotation.x = -Math.PI / 2; ptr.scale.set(1, 1, 0.5); ptr.position.set(0, 0.13, 1.1); ptr.castShadow = true; root.add(ptr);
  root.scale.setScalar(0.001); root.visible = false;

  const arc = 360 / n;
  const at = deg => Math.floor((((deg % 360) + 360) % 360) / arc) % n;       // segment under the pointer when the disc is turned by deg
  const spin = deg => (180 + deg);                                           // canvas angle (clockwise from the top) under the pointer

  root.show = ms => { root.visible = true; return run(ms, k => { const e = 1 - Math.pow(1 - k, 3); root.scale.setScalar(Math.max(0.001, e) * (root.userData.size || 1)); root.position.y = (root.userData.y0 || 0) - (1 - e) * 0.3 * (root.userData.size || 1); }); };
  root.hide = ms => run(ms, k => { const e = 1 - k * k; root.scale.setScalar(Math.max(0.001, e) * (root.userData.size || 1)); root.position.y = (root.userData.y0 || 0) - (1 - e) * 0.3 * (root.userData.size || 1); })
    .then(() => { root.visible = false; if (root.parent) root.parent.remove(root); tex.dispose(); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); });
  root.spinTo = (key, ms = 5000, onTick) => {
    let idx = segs.findIndex(s => s.key === key); if (idx < 0) idx = 0;
    const jitter = (Math.random() - 0.5) * arc * 0.5;                        // not always dead centre
    const stop = idx * arc + arc / 2 + jitter - 180;                        // disc angle (CCW from above) that puts the segment under the pointer
    const start = 0, end = 360 * 5 + (((stop % 360) + 360) % 360);
    let last = at(spin(start));
    return run(ms, k => {
      const d = start + (end - start) * ease(k);
      disc.rotation.y = d * Math.PI / 180;
      const i = at(spin(d)); if (i !== last) { last = i; onTick && onTick(false); }
    }).then(() => {
      onTick && onTick(true);
      return run(slow(900), k => { disc.rotation.y = (end + Math.sin(k * 14) * (1 - k) * 2.2) * Math.PI / 180; root.rotation.z = Math.sin(k * 11) * (1 - k) * 0.012; });
    });
  };
  return root;
}
