// A square "comes to life" as atmosphere, not activity: when it's hovered or someone is standing on
// it, its windows switch on one by one, its street lamp brightens and throws a pool of warm light on
// the wet street, its sign flickers on, steam rises from the manhole and smoke from the chimneys.
// A calm square stays mostly dark: a few dim windows, the lamp low. Everything changes slowly.
// No people, no traffic, no birds: the only things that move on the streets are the players' pieces.
import * as THREE from 'three';
import { glowMaterials } from './kit.js';

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createLife(parent, { lights = 4 } = {}) {
  const squares = new Map();
  const puffs = [];
  const fx = new THREE.Group();
  parent.add(fx);
  const dot = softDot();
  // a few warm lights that go to the lamps of whichever squares are awake
  const pool = Array.from({ length: lights }, () => {
    const l = new THREE.PointLight('#ffb06a', 0, 2.4, 1.6);
    parent.add(l);
    return l;
  });

  const windowsOf = keys => keys.map((key, k) => ({ key, mats: null, at: k / Math.max(1, keys.length), calm: Math.random() < 0.45 ? 0.25 + Math.random() * 0.25 : 0.02, level: 0 }));
  // windows: one glow key per lit piece; some pieces glimmer even when the square is calm
  function add(i, group, { glowKeys = [], lamps = [], signs = [], steam = null, chimneys = [] } = {}) {
    squares.set(i, { i, group, windows: windowsOf(glowKeys), lamps, signs, growthSigns: [], steam, chimneys, haze: [], hazeClock: Math.random() * 2, awake: 0, want: 0, puffClock: Math.random(), steamClock: Math.random() });
  }
  function setGrowthSigns(i, list) { const st = squares.get(i); if (st) st.growthSigns = list; }     // signs on the lot's buildings (they change with the growth)
  function setChimneys(i, list) { const st = squares.get(i); if (st) st.chimneys = list; }
  function setHaze(i, list) { const st = squares.get(i); if (st) st.haze = list; }              // smoky places: slow warm haze that drifts even when calm
  function setWindows(i, keys) { const st = squares.get(i); if (st) st.windows = windowsOf(keys); }
  function wake(i, on) { const st = squares.get(i); if (st) st.want = on ? 1 : 0; }

  function puff(at, { steam, haze }) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: haze ? '#d9b58a' : steam ? '#d8d2c8' : '#5a5650', transparent: true, depthWrite: false, opacity: 0 }));
    s.position.copy(at);
    s.scale.setScalar(0.05);
    fx.add(s);
    puffs.push({ s, t: 0, life: haze ? 5 : steam ? 2.6 : 3.4, steam, haze, drift: new THREE.Vector3(0.025 + Math.random() * 0.02, haze ? 0.06 : steam ? 0.12 : 0.16, Math.random() * 0.02 - 0.01) });
  }

  const tmp = new THREE.Vector3();
  let last = performance.now();
  function update(time) {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const lit = [];
    for (const st of squares.values()) {
      st.awake += (st.want - st.awake) * Math.min(1, dt * (st.want ? 1.2 : 0.5));      // slow in, slower out
      // windows switch on one by one as the square wakes
      for (const w of st.windows) {
        if (!w.mats || !w.mats.length) w.mats = glowMaterials(w.key);
        const on = st.awake > w.at * 0.85 + 0.05 ? 1 : 0;
        const target = Math.max(w.calm, on * (0.9 + 0.1 * Math.sin(time * 0.7 + w.at * 9)));
        w.level += (target - w.level) * Math.min(1, dt * 2.5);
        for (const m of w.mats) m.emissiveIntensity = w.level * 1.1;
      }
      for (const lamp of st.lamps) lamp.material.emissiveIntensity = 1.2 + st.awake * 3.5;
      // signs flicker on: a few stutters, then steady (with the odd blink)
      for (const sg of [...st.signs, ...st.growthSigns]) {
        const flick = st.awake > 0.15 ? (Math.sin(time * 37 + sg.userData.id) > 0.92 - st.awake * 0.9 ? 1 : 0.25) : 0;
        const blink = Math.sin(time * 1.3 + sg.userData.id) > 0.985 ? 0.4 : 1;
        sg.material.emissiveIntensity = (sg.userData.calm || 0) + st.awake * flick * blink * 2.4;
      }
      if (st.haze.length) {
        st.hazeClock -= dt;
        if (st.hazeClock <= 0) {
          st.hazeClock = st.awake > 0.3 ? 0.9 : 1.8;
          puff(parent.worldToLocal(tmp.copy(st.haze[Math.floor(Math.random() * st.haze.length)]).applyMatrix4(st.group.matrixWorld)), { haze: true });
        }
      }
      if (st.awake > 0.05) {
        lit.push(st);
        st.steamClock -= dt;
        if (st.steam && st.steamClock <= 0) { st.steamClock = 0.5; puff(parent.worldToLocal(tmp.copy(st.steam).applyMatrix4(st.group.matrixWorld)), { steam: true }); }
        st.puffClock -= dt;
        if (st.chimneys.length && st.puffClock <= 0) {
          st.puffClock = 0.7;
          const c = st.chimneys[Math.floor(Math.random() * st.chimneys.length)];
          puff(parent.worldToLocal(tmp.copy(c).applyMatrix4(st.group.matrixWorld)), { steam: false });
        }
      }
    }
    // the warm pools of light go to the most awake squares' lamps
    lit.sort((a, b) => b.awake - a.awake);
    let k = 0;
    for (const st of lit) for (const lamp of st.lamps) {
      if (k >= pool.length) break;
      const l = pool[k++];
      lamp.getWorldPosition(l.position);
      parent.worldToLocal(l.position);
      l.intensity = st.awake * 1.6;
    }
    for (; k < pool.length; k++) pool[k].intensity = 0;
    for (let n = puffs.length - 1; n >= 0; n--) {
      const p = puffs[n]; p.t += dt;
      const q = p.t / p.life;
      p.s.position.addScaledVector(p.drift, dt);
      p.s.scale.setScalar(0.05 + q * (p.haze ? 0.34 : p.steam ? 0.16 : 0.22));
      p.s.material.opacity = Math.sin(Math.PI * Math.min(1, q)) * (p.haze ? 0.17 : p.steam ? 0.28 : 0.4);
      if (q >= 1) { fx.remove(p.s); p.s.material.dispose(); puffs.splice(n, 1); }
    }
  }

  return {
    add, setChimneys, setHaze, setGrowthSigns, setWindows, wake, update,
    awake: i => (squares.get(i) ? squares.get(i).awake : 0),
    clear() { squares.clear(); },
  };
}
