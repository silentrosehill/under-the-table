// City Mode: what a timed effect looks like on a square. Cheap, built the first time it's needed and
// faded in and out: police = police tape across the lot and a slow blue/red glow; mayor = a warm gold
// uplight; gang = a dim, dirty-red stain with spray-paint scrawls on the ground. Other kinds have no look (yet).
import * as THREE from 'three';

let tapeMap = null, stainMap = null;
function tapeTexture() {
  if (tapeMap) return tapeMap;
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e8c21a'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#16130e';
  for (let x = -32; x < 288; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 - 16, 32); g.lineTo(x - 16, 32); g.closePath(); g.fill(); }
  tapeMap = new THREE.CanvasTexture(c); tapeMap.colorSpace = THREE.SRGBColorSpace; tapeMap.wrapS = THREE.RepeatWrapping; tapeMap.repeat.set(5, 1);
  return tapeMap;
}
function stainTexture() {
  if (stainMap) return stainMap;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, 'rgba(120,20,14,.7)'); gr.addColorStop(1, 'rgba(70,10,8,.25)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(190,40,28,.75)'; g.lineWidth = 5; g.lineCap = 'round';
  for (let k = 0; k < 5; k++) {                              // spray scrawls
    g.beginPath(); let x = 30 + Math.random() * 190, y = 30 + Math.random() * 190; g.moveTo(x, y);
    for (let n = 0; n < 4; n++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  g.lineWidth = 7; g.beginPath(); g.moveTo(90, 90); g.lineTo(170, 170); g.moveTo(170, 90); g.lineTo(90, 170); g.stroke();   // a crossed-out mark
  stainMap = new THREE.CanvasTexture(c); stainMap.colorSpace = THREE.SRGBColorSpace;
  return stainMap;
}

export function createTileFx({ dot, makeBeam, BASE_H, KERB, LOT }) {
  const additive = (color, scale) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.scale.setScalar(scale);
    return s;
  };

  const make = {
    police(tile) {
      const g = new THREE.Group();
      g.position.set(0, BASE_H, KERB + 0.09);
      const ribbon = new THREE.MeshStandardMaterial({ map: tapeTexture(), emissive: '#e8c21a', emissiveMap: tapeTexture(), emissiveIntensity: 0.12, roughness: 0.7, side: THREE.DoubleSide });
      [[0.1, 0.02], [0.155, -0.015]].forEach(([y, rz]) => { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.03), ribbon); r.position.y = y; r.rotation.z = rz; g.add(r); });
      const lights = [];
      for (const [sx, col] of [[-1, '#4f86ff'], [1, '#ff3b30']]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.22, 6), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 }));
        post.position.set(sx * 0.48, 0.11, 0); g.add(post);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: '#101820', emissive: col, emissiveIntensity: 0 }));
        bulb.position.set(sx * 0.48, 0.235, 0); g.add(bulb); lights.push(bulb);
      }
      const blue = additive('#4a78ff', 1.2), red = additive('#ff2e22', 1.2);       // slow wash on the lot, alternating
      blue.position.set(-0.22, 0.28, 0.5); red.position.set(0.22, 0.28, 0.5);
      g.add(blue, red);
      return { group: g, update(time, k) {
        const a = 0.5 + 0.5 * Math.sin(time * 2.4);
        blue.material.opacity = k * 0.5 * a; red.material.opacity = k * 0.5 * (1 - a);
        lights[0].material.emissiveIntensity = k * 3 * a; lights[1].material.emissiveIntensity = k * 3 * (1 - a);
      } };
    },
    mayor(tile) {
      const beam = makeBeam(tile.f);                       // the owner's pillar of light, but short and golden
      beam.visible = true;
      beam.children[0].scale.set(3.4, 1.7, 3.4);
      const mats = beam.userData.mats;
      const glow = additive('#ffc65c', 1.3); glow.position.set(0, BASE_H + 0.3, KERB + 0.62);
      return { group: new THREE.Group().add(beam, glow), update(time, k) {
        for (const m of mats) { m.uniforms.opacity.value = k * 0.9; m.uniforms.time.value = time; }
        glow.material.opacity = k * (0.22 + 0.04 * Math.sin(time * 1.3));
      } };
    },
    gang(tile) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ map: stainTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tile.f.w - 0.08, LOT - 0.1), mat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = (tile.i % 4) * Math.PI / 2; m.position.set(0, BASE_H + 0.006, KERB + LOT / 2);
      g.add(m);
      return { group: g, update(time, k) { mat.opacity = k * 0.62; } };
    },
  };

  // the card engine's effects reuse these looks, with their own colours
  make.gift = make.mayor;                                   // gold uplight
  make['shootout-win'] = make.police;                       // the police own the block
  make['shootout-loss'] = make.gang;                        // bullet-scarred stain
  make.crime = tile => {                                    // police-tape yellow stain and tape across the lot
    const base = make.gang(tile), tape = make.police(tile);
    base.group.children[0].material.color.set('#e8c21a');
    tape.group.children.forEach(c => { if (c.isSprite) c.visible = false; });
    base.group.add(tape.group);
    return { group: base.group, update(time, k) { base.update(time, k * 0.75); tape.update(time, k * 0.4); } };
  };
  make.squatters = tile => {                                // boarded up: a dim brown tint and a candle flickering in a window
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#2a1608', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(tile.f.w - 0.08, LOT - 0.1), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(0, BASE_H + 0.006, KERB + LOT / 2);
    const flames = [[-0.16, 0.22], [0.14, 0.16]].map(([x, y]) => { const s = additive('#ff9a3c', 0.34); s.position.set(x, BASE_H + y, KERB + 0.42); g.add(s); return s; });
    g.add(m);
    return { group: g, update(time, k) {
      mat.opacity = k * 0.5;
      flames.forEach((f, n) => { f.material.opacity = k * Math.max(0, 0.45 + 0.25 * Math.sin(time * (9 + n * 3.1)) + 0.15 * Math.sin(time * 23 + n)); });
    } };
  };

  return {
    // kinds: the set of effect kinds on this tile right now
    sync(tile, kinds) {
      tile.fx ||= {};
      for (const kind of Object.keys(make)) {
        const want = kinds.has(kind);
        let f = tile.fx[kind];
        if (!f && !want) continue;
        if (!f) { f = tile.fx[kind] = { ...make[kind](tile), k: 0 }; tile.lift.add(f.group); }
        f.want = want ? 1 : 0;
        if (want) f.group.visible = true;
      }
    },
    update(tile, time, dt) {
      if (!tile.fx) return;
      for (const f of Object.values(tile.fx)) {
        if (!f.group.visible) continue;
        f.k += (f.want - f.k) * Math.min(1, dt * 2.2);
        f.update(time, f.k);
        if (!f.want && f.k < 0.01) { f.update(time, 0); f.group.visible = false; }
      }
    },
  };
}
