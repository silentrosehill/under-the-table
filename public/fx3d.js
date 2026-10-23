// Event animations on a square (shared by City Mode and Table Mode): bombing, police, mayor, gang turf, crime wave, wrecked levels,
// shootout, squatters, eviction, buyout, mafia seizure. Everything is a handful of pooled-geometry sprites / boxes in one small
// group that tweens itself and is removed (and its materials disposed) when it ends. Warm amber/gold for good, cold red/blue for bad.
//
// A host is one square: { parent, y, cz, w, d, shake(amp, ms) } - the effect group sits at (0, y, cz) inside parent (the tile's own
// frame, so it follows the tile's rotation). `run(kind, hosts, opts)`: hosts[0] is the target; districts sweep across all of them.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const BOX = new THREE.BoxGeometry(1, 1, 1);
const boxMats = new Map();
const boxMat = c => { if (!boxMats.has(c)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }); m.userData.shared = true; boxMats.set(c, m); } return boxMats.get(c); };

let tapeTex = null, pillarTex = null;
function tapeTexture() {
  if (tapeTex) return tapeTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e8c21a'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#16130e';
  for (let x = -32; x < 288; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x, 32); g.lineTo(x - 16, 32); g.closePath(); g.fill(); }
  tapeTex = new THREE.CanvasTexture(c); tapeTex.colorSpace = THREE.SRGBColorSpace;
  return tapeTex;
}
function pillarTexture() {
  if (pillarTex) return pillarTex;
  const c = document.createElement('canvas'); c.width = 8; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,214,120,.95)'); gr.addColorStop(0.5, 'rgba(255,196,90,.4)'); gr.addColorStop(1, 'rgba(255,190,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  pillarTex = new THREE.CanvasTexture(c);
  return pillarTex;
}
let tagTex = null;
function tagTexture() {
  if (tagTex) return tagTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(22, 100); g.bezierCurveTo(30, 20, 60, 20, 52, 70); g.bezierCurveTo(50, 100, 90, 30, 100, 24); g.stroke();   // a tag scrawl
  g.lineWidth = 5; g.beginPath(); g.moveTo(24, 40); g.lineTo(104, 92); g.moveTo(104, 40); g.lineTo(24, 92); g.stroke();                     // crossed out
  g.lineWidth = 3; for (let k = 0; k < 6; k++) { const x = 30 + k * 14; g.beginPath(); g.moveTo(x, 104); g.lineTo(x - 2, 118 + (k % 2) * 6); g.stroke(); }   // drips
  tagTex = new THREE.CanvasTexture(c);
  return tagTex;
}
function stampTexture(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.translate(128, 48); g.rotate(-0.1);
  g.strokeStyle = g.fillStyle = '#c4281c'; g.lineWidth = 7; g.strokeRect(-116, -34, 232, 68);
  g.font = '700 46px "Oswald","Impact",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = 214; let size = 46; while (g.measureText(text).width > w && size > 14) { size -= 2; g.font = `700 ${size}px "Oswald","Impact",sans-serif`; }
  g.fillText(text, 0, 3);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

export function createFx3d({ dot, tween }) {
  // one running effect: particles (sprites or boxes) integrated every frame, plus custom `ticks`
  function session(host, opts) {
    const g = new THREE.Group(); g.position.set(0, host.y, host.cz); host.parent.add(g);
    const parts = [], ticks = [], disp = [];
    let dur = 600;
    const api = {
      g, w: host.w, d: host.d, opts,
      // p: { add, color, pos[3], v[3], grav, floor, bounce, s0, s1, op, att, life, delay, box[3], spin, tex }
      p(o) {
        let obj, mat;
        if (o.box) { obj = new THREE.Mesh(BOX, boxMat(o.color)); obj.scale.set(...o.box); }
        else {
          mat = new THREE.SpriteMaterial({ map: o.tex || dot, color: o.color, transparent: true, depthWrite: false, opacity: 0, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
          obj = new THREE.Sprite(mat); disp.push(mat);
        }
        obj.visible = false; obj.position.set(...(o.pos || [0, 0, 0])); g.add(obj);
        const q = { o, obj, mat, v: new THREE.Vector3(...(o.v || [0, 0, 0])), delay: o.delay || 0, life: o.life || 800, last: 0, spin: o.spin ? new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(o.spin) : null };
        parts.push(q); dur = Math.max(dur, q.delay + q.life + 60);
        return q;
      },
      tick(fn, until) { ticks.push(fn); dur = Math.max(dur, until); },
      mesh(m, mat, until) { g.add(m); if (mat) disp.push(mat); dur = Math.max(dur, until); return m; },
      sprite(color, add) { const m = new THREE.SpriteMaterial({ map: dot, color, transparent: true, depthWrite: false, opacity: 0, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }); disp.push(m); const s = new THREE.Sprite(m); g.add(s); return s; },
      shake: (a, ms) => host.shake && host.shake(a, ms),
      start() {
        const total = dur;
        tween(total, k => {
          const e = k * total;
          for (const q of parts) {
            const el = e - q.delay;
            if (el < 0) continue;
            const f = el / q.life, o = q.o;
            if (f >= 1) { q.obj.visible = false; continue; }
            q.obj.visible = true;
            const dt = Math.min(0.05, Math.max(0, (el - q.last) / 1000)); q.last = el;
            if (o.grav) q.v.y += o.grav * dt;
            q.obj.position.addScaledVector(q.v, dt);
            if (o.floor != null && q.obj.position.y < o.floor) { q.obj.position.y = o.floor; q.v.y = o.bounce && Math.abs(q.v.y) > 0.4 ? -q.v.y * o.bounce : 0; q.v.x *= 0.6; q.v.z *= 0.6; }
            if (q.spin) { q.obj.rotation.x += q.spin.x * dt * 6; q.obj.rotation.y += q.spin.y * dt * 6; q.obj.rotation.z += q.spin.z * dt * 6; }
            const att = o.att == null ? 0.2 : o.att, env = f < att ? f / att : 1 - (f - att) / (1 - att);
            if (q.mat) { q.mat.opacity = (o.op == null ? 1 : o.op) * env; const s = (o.s0 || 0.2) + ((o.s1 == null ? o.s0 || 0.2 : o.s1) - (o.s0 || 0.2)) * f; q.obj.scale.set(s, s, 1); }
            else if (o.fade) q.obj.visible = f < 0.8 || Math.sin(f * 90) > 0;
          }
          for (const fn of ticks) fn(e);
        }, () => { host.parent.remove(g); g.traverse(c => { if (c.userData.tex) c.userData.tex.dispose(); if (c.isMesh && c.geometry !== BOX) c.geometry.dispose(); if (c.material && !c.material.userData.shared) c.material.dispose(); }); disp.forEach(m => m.dispose()); });
      },
    };
    return api;
  }

  const smoke = (s, color, n, o = {}) => {
    for (let i = 0; i < n; i++) s.p({ color, pos: [rand(-0.3, 0.3) * s.w, 0.1, rand(-0.3, 0.3) * s.d], v: [rand(-0.06, 0.06), o.rise || 0.4, rand(-0.06, 0.06)], s0: o.s0 || 0.3, s1: o.s1 || 1.3, life: o.life || 2600, delay: (o.delay || 0) + i * (o.gap || 130), op: o.op || 0.5, att: 0.25 });
  };

  const K = {
    bomb(s) {
      s.shake(0.03, 800);
      s.p({ add: true, color: '#fff3c8', pos: [0, 0.35, 0], s0: 0.8, s1: 5, life: 320, att: 0.08 });            // the flash
      s.p({ add: true, color: '#ffb347', pos: [0, 0.3, 0], s0: 0.7, s1: 3.6, life: 650, att: 0.1, op: 0.85 });
      for (let i = 0; i < 6; i++) s.p({ add: true, color: pick(['#ff9a2a', '#ff5a14', '#ffd060']), pos: [rand(-0.15, 0.15), rand(0.1, 0.4), rand(-0.15, 0.15)], v: [rand(-0.6, 0.6), rand(0.7, 1.7), rand(-0.6, 0.6)], s0: 0.6, s1: rand(1.6, 2.5), life: rand(800, 1300), delay: i * 30, op: 0.9, att: 0.15 });   // fireball
      for (let i = 0; i < 16; i++) s.p({ box: [1, 1, 1].map(() => rand(0.03, 0.08)), color: pick(['#6b5a48', '#8a7a66', '#3a3330', '#a8553a']), pos: [rand(-0.1, 0.1), 0.3, rand(-0.1, 0.1)], v: [rand(-1.5, 1.5), rand(2, 4), rand(-1.5, 1.5)], grav: -7.5, floor: 0.02, bounce: 0.3, spin: 3, life: rand(1200, 1700) });   // debris
      for (let i = 0; i < 12; i++) s.p({ add: true, color: '#ff8a2a', pos: [0, 0.3, 0], v: [rand(-1.4, 1.4), rand(1.2, 3), rand(-1.4, 1.4)], grav: -5, s0: 0.07, s1: 0.03, life: rand(700, 1200), op: 1 });             // embers
      smoke(s, '#2c2824', 22, { delay: 250, gap: 110, rise: 0.8, s0: 0.5, s1: 2.2, life: 3200, op: 0.6 });             // the rising column
      smoke(s, '#5d5850', 8, { delay: 200, gap: 160, rise: 0.3, s1: 1.2, life: 2400, op: 0.35 });
    },
    police(s) {
      const bar = new THREE.Group(); bar.position.set(0, 0.7, 0); bar.userData.k = 1.7;
      const mk = (x, c) => { const m = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({ color: '#101820', emissive: c, emissiveIntensity: 3 })); m.scale.set(0.17, 0.07, 0.09); m.position.x = x; bar.add(m); return m; };
      const bb = mk(-0.1, '#3f78ff'), rb = mk(0.1, '#ff3328');
      const base = new THREE.Mesh(BOX, boxMat('#14171c')); base.scale.set(0.4, 0.035, 0.12); base.position.y = -0.05; bar.add(base);
      s.mesh(bar, null, 4600); bar.userData.mats = [bb.material, rb.material];
      const hb = s.sprite('#4a78ff', true), hr = s.sprite('#ff2e22', true), wb = s.sprite('#3f6cff', true), wr = s.sprite('#ff2a1e', true);
      hb.position.set(-0.18, 0.78, 0); hr.position.set(0.18, 0.78, 0); wb.position.set(-0.2, 0.15, 0); wr.position.set(0.2, 0.15, 0);
      [hb, hr].forEach(h => h.scale.setScalar(1.5)); [wb, wr].forEach(h => h.scale.setScalar(3.2));
      const tapes = [0.3, 0.42].map((y, n) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 1.05, 0.09), new THREE.MeshBasicMaterial({ map: tapeTexture(), side: THREE.DoubleSide, transparent: true }));
        m.position.set(0, y, s.d * 0.32); m.rotation.z = n ? -0.12 : 0.1; m.scale.x = 0.001; s.mesh(m, m.material, 4600); return m;
      });
      s.p({ add: true, color: '#ffffff', pos: [0, 0.35, s.d * 0.32], s0: 0.5, s1: 1.4, life: 260, delay: 280, att: 0.1, op: 0.7 });       // the snap
      s.tick(e => {
        const on = Math.sin(e / 70) > 0, k = e < 300 ? e / 300 : e > 4000 ? Math.max(0, (4600 - e) / 600) : 1;
        bb.material.emissiveIntensity = on ? 3.5 : 0.2; rb.material.emissiveIntensity = on ? 0.2 : 3.5;
        hb.material.opacity = (on ? 0.9 : 0.1) * k; hr.material.opacity = (on ? 0.1 : 0.9) * k;
        wb.material.opacity = (on ? 0.8 : 0.08) * k; wr.material.opacity = (on ? 0.08 : 0.8) * k;
        bar.scale.setScalar(Math.min(1, e / 200) * 1.8);
        tapes.forEach((t, n) => { const q = Math.min(1, Math.max(0, (e - 220 - n * 90) / 220)); t.scale.x = Math.max(0.001, q < 1 ? q : 1 + 0.04 * Math.sin((e - 220) / 40) * Math.max(0, 1 - (e - 440) / 400)); t.material.opacity = e > 4000 ? Math.max(0, (4600 - e) / 600) : 1; });
      }, 4600);
    },
    mayor(s) {
      const geo = new THREE.CylinderGeometry(0.3, 0.34, 3, 28, 1, true); geo.translate(0, 1.5, 0);
      const mat = new THREE.MeshBasicMaterial({ map: pillarTexture(), color: '#ffa83a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
      const pil = new THREE.Mesh(geo, mat); s.mesh(pil, mat, 3800); pil.userData.geo = geo;
      const glow = s.sprite('#ffc65c', true); glow.position.y = 0.12; glow.scale.setScalar(1.6);
      s.tick(e => {
        const k = e < 3000 ? 1 : Math.max(0, (3800 - e) / 800);
        pil.scale.set(1, Math.min(1, e / 350), 1); mat.opacity = k * (0.62 + 0.08 * Math.sin(e / 90));
        glow.material.opacity = k * 0.6 * Math.min(1, e / 250);
      }, 3800);
      for (let i = 0; i < 34; i++) { const a = rand(0, 6.3), r = rand(0.05, 0.34); s.p({ add: true, color: pick(['#ffd878', '#ffc24a', '#fff0b8']), pos: [Math.cos(a) * r, rand(1.6, 2.6), Math.sin(a) * r], v: [0, rand(-0.5, -0.9), 0], grav: -0.5, floor: 0, s0: rand(0.06, 0.12), s1: 0.04, life: rand(1300, 1900), delay: rand(100, 2300), op: 1, att: 0.1 }); }
    },
    gang(s, hosts, o) {
      const crime = o && o.crime;
      hosts.forEach((h, i) => {
        const t = i === 0 ? s : session(h, o), delay = i * 380;
        t.shake(0.012, 500);
        const smk = crime ? ['#5a3a0c', '#2a1a08', '#6a0f0c'] : ['#5a0d0a', '#2c0605', '#7a1410', '#1a0404'];
        for (let n = 0; n < 26; n++) {
          const glow = n % 2 === 0, y = rand(0.2, 0.7);
          t.p({ add: glow, color: glow ? (crime ? '#8a5010' : '#7a120c') : pick(smk), pos: [-t.w * 0.75, y, rand(-0.38, 0.38) * t.d], v: [t.w / 1.1 + rand(-0.1, 0.1), rand(0.05, 0.3), rand(-0.08, 0.08)], s0: glow ? 0.8 : 0.7, s1: rand(1.5, 2.1), life: 1700, delay: delay + n * 55, op: glow ? 0.65 : 1, att: 0.22 });   // a dense oxblood wave rolling along the lots
        }
        t.p({ add: true, color: crime ? '#c47a14' : '#b0160e', pos: [0, 0.15, 0], s0: 2, s1: 3.2, life: 1500, delay, op: 0.55, att: 0.3 });
        // the kerb band flashes red
        const km = new THREE.MeshBasicMaterial({ color: crime ? '#e8a020' : '#d01810', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide });
        const kerb = new THREE.Mesh(new THREE.PlaneGeometry(t.w * 1.02, 0.13), km); kerb.rotation.x = -Math.PI / 2; kerb.position.set(0, 0.05, -t.d / 2 + 0.05); t.mesh(kerb, km, delay + 2300);
        // a couple of spray-paint tags pop onto the lot and fade
        const tags = [0, 1].map(n => { const tm = new THREE.MeshBasicMaterial({ map: tagTexture(), color: crime ? '#e8c21a' : '#a8120c', transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }); const m = new THREE.Mesh(new THREE.PlaneGeometry(t.w * 0.55, t.w * 0.55), tm); m.rotation.x = -Math.PI / 2; m.rotation.z = rand(-0.6, 0.6); m.position.set((n ? 0.2 : -0.2) * t.w, 0.045 + n * 0.002, (n ? 0.2 : -0.18) * t.d); t.mesh(m, tm, delay + 2500); return { m, tm, at: delay + 450 + n * 330 }; });
        t.tick(e => {
          const el = e - delay;
          km.opacity = el < 0 || el > 2000 ? 0 : (Math.sin(el / 55) > 0 ? 0.95 : 0.25) * (el > 1400 ? (2000 - el) / 600 : 1);
          tags.forEach(g => { const q = e - g.at; g.tm.opacity = q < 0 ? 0 : q < 120 ? q / 120 : Math.max(0, 1 - (q - 900) / 1100); g.m.scale.setScalar(q < 0 ? 0.01 : q < 120 ? 1.5 - 0.5 * q / 120 : 1); });
        }, delay + 2500);
        for (let n = 0; n < 18; n++) t.p({ add: n % 3 !== 0, color: pick(crime ? ['#e8c21a', '#d02a1c', '#ffffff'] : ['#a8120c', '#d02a1c', '#1a0404']), pos: [rand(-0.3, 0.3) * t.w, rand(0.05, 0.35), rand(-0.3, 0.3) * t.d], v: [rand(-0.8, 0.8), rand(0.4, 1.4), rand(-0.8, 0.8)], grav: -3.2, floor: 0.01, s0: 0.06, s1: 0.03, life: rand(500, 900), delay: delay + 100 + n * 50, op: 1, att: 0.1 });     // spray-paint flecks
        if (i) { t.start(); }
      });
    },
    wreck(s) {
      s.shake(0.022, 550);
      s.p({ add: true, color: '#e8d4b0', pos: [0, 0.3, 0], s0: 0.4, s1: 1.8, life: 260, att: 0.1, op: 0.5 });
      for (let i = 0; i < 14; i++) s.p({ color: pick(['#8a7d6c', '#6b6359', '#a09484']), pos: [rand(-0.3, 0.3) * s.w, 0.08, rand(-0.3, 0.3) * s.d], v: [rand(-0.5, 0.5), rand(0.1, 0.35), rand(-0.5, 0.5)], s0: 0.25, s1: rand(0.9, 1.4), life: rand(1500, 2300), delay: i * 30, op: 0.55, att: 0.18 });
      for (let i = 0; i < 12; i++) s.p({ box: [rand(0.05, 0.1), rand(0.035, 0.05), rand(0.04, 0.07)], color: pick(['#9a4a34', '#7a3a2a', '#b05a40', '#6b6359']), pos: [rand(-0.3, 0.3) * s.w, rand(0.8, 1.3), rand(-0.3, 0.3) * s.d], v: [rand(-0.3, 0.3), rand(-1, 0), rand(-0.3, 0.3)], grav: -8, floor: 0.02, bounce: 0.35, spin: 2.5, life: rand(1300, 1900), delay: rand(0, 600) });
    },
    shootout(s) {
      s.shake(0.01, 600);
      const bar = [s.sprite('#4a78ff', true), s.sprite('#ff2e22', true)];
      bar[0].position.set(-0.22, 0.7, 0); bar[1].position.set(0.22, 0.7, 0); bar.forEach(b => b.scale.setScalar(1.1));
      s.tick(e => { const on = Math.sin(e / 90) > 0, k = e > 2600 ? Math.max(0, (3200 - e) / 600) : Math.min(1, e / 150); bar[0].material.opacity = (on ? 0.85 : 0.1) * k; bar[1].material.opacity = (on ? 0.1 : 0.85) * k; }, 3200);
      for (let i = 0; i < 14; i++) {
        const at = [rand(-0.35, 0.35) * s.w, rand(0.12, 0.6), rand(-0.3, 0.3) * s.d], dl = 120 + i * 130 + rand(0, 60);
        s.p({ add: true, color: '#fff1a8', pos: at, s0: rand(0.25, 0.4), s1: 0.1, life: 110, delay: dl, att: 0.1 });                      // muzzle flash
        for (let n = 0; n < 4; n++) s.p({ add: true, color: '#ffb030', pos: at, v: [rand(-1.2, 1.2), rand(0.2, 1.4), rand(-1.2, 1.2)], grav: -4, floor: 0.01, s0: 0.04, s1: 0.02, life: rand(300, 600), delay: dl });   // sparks
      }
    },
    squatters(s) {
      const flames = [[-0.14, 0.22], [0.14, 0.16]].map(([x, y]) => { const f = s.sprite('#ff9a3c', true); f.position.set(x, y, -s.d * 0.12); f.scale.setScalar(0.4); return f; });
      s.tick(e => { const k = e > 3400 ? Math.max(0, (4200 - e) / 800) : Math.min(1, e / 250); flames.forEach((f, n) => { f.material.opacity = k * Math.max(0, 0.55 + 0.3 * Math.sin(e / (55 + n * 20)) + 0.15 * Math.sin(e / 23 + n)); }); }, 4200);
      s.p({ box: [0.36, 0.07, 0.2], color: '#8a7a58', pos: [-0.06, 1.5, s.d * 0.1], v: [0.1, 0, 0], grav: -9, floor: 0.04, bounce: 0.35, spin: 0.4, life: 3800, delay: 150 });                      // the mattress
      s.p({ box: [0.13, 0.12, 0.1], color: '#4a3a2a', pos: [0.18, 1.9, s.d * 0.14], v: [-0.12, 0, 0], grav: -9, floor: 0.06, bounce: 0.4, spin: 0.8, life: 3600, delay: 420 });             // a bundle
      for (let i = 0; i < 8; i++) s.p({ color: '#9a8f7c', pos: [rand(-0.2, 0.2), 0.05, s.d * 0.12], v: [rand(-0.4, 0.4), rand(0.05, 0.2), rand(-0.3, 0.3)], s0: 0.15, s1: 0.5, life: 1000, delay: 700 + i * 20, op: 0.45 });
    },
    evict(s) {
      s.shake(0.02, 380);
      const door = new THREE.Mesh(BOX, boxMat('#4a3322')); door.scale.set(0.26, 0.4, 0.03); door.position.set(0, 0.2, s.d * 0.42); s.mesh(door, null, 1400);
      s.tick(e => { door.rotation.y = e < 150 ? (1 - e / 150) * 1.2 : 0; door.visible = e < 1100; }, 1400);
      s.p({ add: true, color: '#fff3d0', pos: [0, 0.2, s.d * 0.42], s0: 0.3, s1: 0.9, life: 220, delay: 140, op: 0.6 });
      for (let i = 0; i < 12; i++) s.p({ color: '#9a8f7c', pos: [rand(-0.15, 0.15), 0.05, s.d * 0.42], v: [rand(-0.7, 0.7), rand(0.05, 0.25), rand(0.15, 0.6)], s0: 0.15, s1: rand(0.45, 0.8), life: rand(900, 1300), delay: 150 + i * 15, op: 0.5 });   // the door-slam puff
    },
    buyout(s, hosts, o) {
      const col = (o && o.color) || '#f2b23a';
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide });
      const wash = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.92, s.d * 0.92), mat); wash.rotation.x = -Math.PI / 2; wash.position.y = 0.03; s.mesh(wash, mat, 1500);
      const bmat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide });
      const band = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.18, s.d * 0.96), bmat); band.rotation.x = -Math.PI / 2; band.position.y = 0.04; s.mesh(band, bmat, 1500);
      s.tick(e => { const k = Math.min(1, e / 900); band.position.x = (k - 0.5) * s.w * 1.1; bmat.opacity = e < 900 ? 0.8 : Math.max(0, 1 - (e - 900) / 300) * 0.8; mat.opacity = Math.min(0.55, k * 0.7) * (e > 1000 ? Math.max(0, (1500 - e) / 500) : 1); }, 1500);
      for (let i = 0; i < 12; i++) s.p({ add: true, color: col, pos: [rand(-0.4, 0.4) * s.w, 0.05, rand(-0.4, 0.4) * s.d], v: [0, rand(0.4, 0.9), 0], s0: 0.09, s1: 0.03, life: 900, delay: i * 70, op: 1 });
    },
    seized(s, hosts, o) {
      s.shake(0.015, 400);
      smoke(s, '#0b0a0a', 22, { delay: 0, gap: 90, rise: 0.5, s1: 1.4, life: 2800, op: 0.7 });
      const tex = stampTexture((o && o.label) || 'SEIZED'), mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
      const st = new THREE.Sprite(mat); st.renderOrder = 12; st.position.y = 0.75; s.mesh(st, mat, 2800); st.userData.tex = tex;
      s.tick(e => {
        const k = Math.min(1, Math.max(0, (e - 350) / 140)), sc = 1 + (1 - k) * 1.3;
        st.scale.set(0.95 * sc, 0.36 * sc, 1); mat.opacity = e < 350 ? 0 : Math.min(1, k * 1.3) * (e > 2200 ? Math.max(0, (2800 - e) / 600) : 1);
        st.position.y = 0.75 + (e > 350 && e < 520 ? 0.04 : 0);
      }, 2800);
      s.p({ add: true, color: '#ffffff', pos: [0, 0.75, 0], s0: 0.4, s1: 1.2, life: 200, delay: 420, op: 0.5 });
    },
  };
  K.gift = K.favor = K.mayor;
  K.crime = (s, hosts, o) => K.gang(s, hosts, { ...o, crime: true });
  K['shootout-win'] = K['shootout-loss'] = K.shootout;
  K.investigation = K.police;

  return {
    kinds: Object.keys(K),
    // hosts: array of host objects (see the top); opts passes colour / label
    run(kind, hosts, opts = {}) {
      const fn = K[kind];
      if (!fn || !hosts || !hosts.length) return false;
      const s = session(hosts[0], opts);
      fn(s, hosts, opts);
      s.start();
      return true;
    },
  };
}
