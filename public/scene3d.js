// 3D board, tokens, dice and effects (three.js). All art is procedural.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { sfx } from './sfx.js';
import { P, FONTS, groupColor } from './palette.js';
import { createPost } from './post.js';
import { disposeScene } from './dispose.js';
import { createRoom } from './room.js';
import { createProps, viewYaw } from './props.js';
import { makePewterToken, setTokenEnvironment, createNameTag, paintToken, tokenGlow, TOKEN_TAG_Y } from './tokens.js';
import { pcGlow } from './pcolor.js';
import { fitTopDown, squarePoints } from './topdown.js';
import { createDice } from './dice.js';
import { createHoverCard, hoverData } from './hovercard.js';
import { makeWheel3D } from './wheel3d.js';
import { fmtMoney } from './money.js';
import { ms as slow } from './speed.js';
import { createFx3d } from './fx3d.js';
import { createBoard, boardHeight, BOARD_T, makeHouse, makeHotel, makeOwnerChip, makeMortgageSlip } from './board.js';

const Y = new THREE.Vector3(0, 1, 0);
const TS = 1.1;     // the printed board is drawn this much bigger than its original 12.2 units (props.js keeps clear of it)
const HALF = 6.1 * TS;   // half board size (2 corners of 1.6 + 9 tiles of 1, times TS)
const TOKEN_S = 1.2;    // a piece's size on the board (1.5x the old 0.8)
const TH = 0.008;   // pieces rest just on the printed surface (plus the board's warp)
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TEXT_FONT = FONTS.display;

const ICONS = {
  go: '🏁', jail: '🚔', taxi: '🚕', gotojail: '👮', chance: '❓', chest: '🎁', tax: '💰', casino: '🎰',
  utility: ['⚡', '💧'],
  railroad: { classic: '🚂', world: '✈️', galaxy: '🛸', candy: '🍭', random: '🚀' },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pickR = arr => arr[Math.floor(Math.random() * arr.length)];
const easeOut = k => 1 - (1 - k) ** 3;
const easeInOut = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const elastic = k => (k === 0 || k === 1 ? k : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1);

// Where tile i sits: its center, rotation, and size. Local -z always points at the board center.
function tileFrame(i) {
  const s = Math.floor(i / 10), k = i % 10, corner = k === 0;
  const lx = corner ? HALF - 0.8 * TS : HALF - (2.1 + (k - 1)) * TS;   // 9 tiles fill the gap between the 1.6-wide corners
  const rot = -s * Math.PI / 2;
  return { pos: new THREE.Vector3(lx, 0, HALF - 0.8 * TS).applyAxisAngle(Y, rot), rot, w: (corner ? 1.6 : 1) * TS, d: 1.6 * TS, corner };
}
const toWorld = (fr, x, z, y = 0) => new THREE.Vector3(x, 0, z).applyAxisAngle(Y, fr.rot).add(fr.pos).setY(y);

export function iconFor(sp, mapKey) {
  if (sp.type === 'railroad') return ICONS.railroad[mapKey] || '🚂';
  if (sp.type === 'utility') return sp.i === 12 ? ICONS.utility[0] : ICONS.utility[1];
  return ICONS[sp.type] || '';
}

export function createScene(container, { onTileClick, onCard, emoji, teamColors = [] }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;   // the cigarette burns down via a clipping plane
  container.append(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(54, 1, 0.5, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minDistance = 6;
  controls.maxDistance = 55;
  controls.enablePan = true;

  // the whole scene is lit by one hanging bulb (room.js)
  const TABLE_Y = -BOARD_T - 0.003;
  const room = createRoom(scene, renderer, { tableY: TABLE_Y });
  const post = createPost(renderer, scene, camera, { onShadowSize: size => room.setShadowSize(size) });
  setTokenEnvironment(null, renderer);
  room.envReady.then(tex => setTokenEnvironment(tex, renderer));
  const baseExpo = renderer.toneMappingExposure;       // Top-down lifts it a little so the far rows stay readable
  let props = null;   // the clutter around the board (props.js); waits for its printed fonts
  Promise.all(['24px "Special Elite"', '600 40px Oswald', '400 40px "Abril Fatface"', '34px Caveat'].map(f => document.fonts.load(f)))
    .catch(() => {}).then(() => { props = createProps(scene, { tableY: TABLE_Y }); if (lastState) props.sync(lastState); });

  let world = new THREE.Group();   // board + decor, rebuilt when the board or skin changes
  scene.add(world);
  const fxGroup = new THREE.Group();
  scene.add(fxGroup);

  const theme = { tile: P.cream, side: P.creamShade, line: P.ink, text: P.ink, muted: P.inkSoft, accent: P.coral };
  let board = null, mapKey = 'classic', meta = null;
  let tiles = [];                   // board.js tiles: { sp, fr, group, pick, glow, bld, houses, chip, slip, owner, mortgaged }
  const tokens = new Map();         // playerId -> token
  const animated = [];              // decor that wiggles
  const tweens = [];
  let pendingFx = [];
  let fx3d = null, bombHold = null, lastBombId = null, rawState = null;
  // a Building Bombing: keep the target standing (as if still owned) until the explosion plays (fx 'bomb'), 8 s fallback
  function releaseBomb() { if (!bombHold) return; clearTimeout(bombHold.timer); bombHold = null; if (rawState) api.update(rawState); }
  function holdBomb(S0) {
    const c = S0.lastCasino;
    if (lastBombId === null) lastBombId = c ? c.id : 0;
    else if (c && c.id !== lastBombId) {
      lastBombId = c.id;
      const pos = c.target && c.target.pos;
      if (c.mode === 'event' && c.key === 'bombing' && !c.stale && pos != null && lastState && lastState.props[pos] && !S0.props[pos]) bombHold = { pos, prop: lastState.props[pos], timer: setTimeout(releaseBomb, slow(8500)) };
    }
    if (bombHold && !S0.props[bombHold.pos]) return { ...S0, props: { ...S0.props, [bombHold.pos]: bombHold.prop } };
    return S0;
  }
  let holdUntil = 0;
  let follow = true, userUntil = 0;
  let camMode = 'cinematic';        // 'cinematic' | 'fixed' | 'topdown' (see setFollow)
  let lastMoveSeq = null;
  let lastRollId = null, lastProps = null, lastMoney = {}, lastTurn = null, lastPhase = null;
  let hovered = -1, selected = -1, targets = new Set();   // targets: tiles a card can be played on (glow)
  let currentId = null;

  function tex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }

  // dur is stretched by the game speed (Relaxed / Normal / Fast); tweenRaw is for physics-style particles that integrate real time
  function tween(dur, update, done) { return tweenRaw(slow(dur), update, done); }
  function tweenRaw(dur, update, done) {
    const tw = { t0: performance.now(), dur, update, done };
    tweens.push(tw);
    return tw;
  }

  // ------------------------------------------------------------ tiles

  function wrap(g, text, maxW) {
    const words = String(text).toUpperCase().split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function fitText(g, text, maxW, size, maxLines) {
    let lines;
    for (let s = size; s >= 14; s -= 2) {
      g.font = `600 ${s}px ${TEXT_FONT}`;
      lines = wrap(g, text, maxW);
      if (lines.length <= maxLines && lines.every(l => g.measureText(l).width <= maxW)) return { lines, size: s };
    }
    return { lines, size: 14 };
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // wooden houses along the colour band; a hotel replaces all four
  function syncBuildings(t, houses, animate) {
    if (t.houses === houses) return;
    const grew = houses > t.houses;
    t.houses = houses;
    t.bld.clear();
    const items = houses === 5 ? [[makeHotel(), 0]] : Array.from({ length: houses }, (_, k) => [makeHouse(), -0.345 + k * 0.23]);
    items.forEach(([m, x], k) => {
      const w = toWorld(t.fr, x, -0.6);
      m.position.set(x, TH + boardHeight(w.x, w.z), -0.6);
      if (houses < 5) m.rotation.y = (Math.random() - 0.5) * 0.12;    // hand-placed, never perfectly square
      t.bld.add(m);
      if (animate && grew && k === items.length - 1) {
        closeUp(toWorld(t.fr, x, -0.4, 0.1), 1900, 3.4, 1.9);
        const y0 = m.position.y;
        m.position.y = y0 + 0.9;
        tween(520, q => {
          m.position.y = y0 + 0.9 * (1 - q) ** 2;                    // dropped onto the board…
          const sq = q > 0.8 ? Math.sin((q - 0.8) / 0.2 * Math.PI) * 0.18 : 0;
          m.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);             // …with a little squash on impact
        }, () => { m.position.y = y0; m.scale.set(1, 1, 1); dustPuff(toWorld(t.fr, x, -0.6, TH + 0.05)); sfx.build(); });
      }
    });
  }

  // a small puff of dust when a piece lands
  let puffTex = null;
  function dustPuff(at, n = 7) {
    puffTex ||= tex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,220,.9)'); gr.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    for (let k = 0; k < n; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#c9b49a', transparent: true, depthWrite: false, opacity: 0 }));
      const dir = new THREE.Vector3(Math.cos(k / n * 6.28), 0.25, Math.sin(k / n * 6.28));
      fxGroup.add(sp);
      tween(700 + Math.random() * 300, q => {
        sp.position.copy(at).addScaledVector(dir, easeOut(q) * 0.35);
        sp.scale.setScalar(0.12 + easeOut(q) * 0.3);
        sp.material.opacity = 0.45 * (1 - q);
      }, () => { fxGroup.remove(sp); sp.material.dispose(); });
    }
  }

  // ------------------------------------------------------------ world (board + scenery)

  const TRAY = new THREE.Vector3(0, 0, 1.1); // where the dice land

  const castAll = o => { o.traverse(m => { if (m.isMesh && !m.isInstancedMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

  function buildWorld() {
    scene.remove(world);
    world.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); });
    world = new THREE.Group();
    scene.add(world);
    animated.length = 0;
    tiles = [];
    if (!board) return;
    const physical = createBoard({ board, meta, tileFrame, HALF, K: TS, tex: (canvas, srgb) => {
      const t = new THREE.CanvasTexture(canvas);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      return t;
    } });
    world.add(physical.group);
    tiles = physical.tiles;
  }

  // ------------------------------------------------------------ tokens

  // the pieces (tokens.js): the player's colour on the body, a glowing disc under it, and a pulsing ring under whoever's turn it is
  function makeToken(p) {
    const group = new THREE.Group();
    const body = new THREE.Group();     // squash & stretch happens here
    const { group: piece, ground, enamel, felt, hit } = makePewterToken(p.token, p.color);
    body.add(piece);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 48), new THREE.MeshBasicMaterial({ color: pcGlow(p.color), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.014;
    group.add(body, ground, ring);
    group.scale.setScalar(TOKEN_S);
    const fr = tileFrame(p.pos);
    group.position.copy(fr.pos).setY(TH);
    group.rotation.y = Math.PI + fr.rot;
    scene.add(group);
    return { id: p.id, group, body, ring, hit, baseMat: enamel, felt, tile: p.pos, target: p.pos, queue: [], anim: null, jailed: p.inJail, out: false, rest: group.position.clone(), faceYaw: null, color: p.color, token: p.token, name: p.name, phase: tokens.size * 1.7 };
  }

  // where the n pieces sharing a square stand (the square's own frame): fanned out in a zigzag so none hides another
  function slotOffsets(i, jailed, n) {
    if (i === 10) return jailed ? [[-0.62, -0.62], [-0.08, -0.62], [-0.62, -0.08], [-0.08, -0.08]] : [[0.5, 0.5], [-0.05, 0.62], [0.62, -0.05], [0.55, -0.6]];
    if (i % 10 === 0) return Array.from({ length: n }, (_, k) => { const a = Math.PI / 4 + k * 2 * Math.PI / n; return [Math.cos(a) * 0.5, Math.sin(a) * 0.5]; });     // round the corner square: any two stay apart from every side
    return Array.from({ length: n }, (_, k) => [n === 1 ? 0 : k % 2 ? 0.21 : -0.21, 0.12 + (k - (n - 1) / 2) * 0.47]);
  }

  function layoutTokens() {
    const groups = {};
    for (const t of tokens.values()) {
      if (t.out) continue;
      const key = t.tile + (t.tile === 10 && t.jailed ? 'j' : '');
      (groups[key] ||= []).push(t);
    }
    for (const list of Object.values(groups)) {
      const slots = slotOffsets(list[0].tile, list[0].jailed, list.length);
      list.forEach((t, k) => {
        const [x, z] = slots[k % slots.length];
        const fr = tileFrame(t.tile);
        t.rest = toWorld(fr, x, z, 0);
        t.rest.y = TH + boardHeight(t.rest.x, t.rest.z);
      });
    }
  }

  function hop(t, to, step) {
    const from = t.group.position.clone();
    const dest = tileFrame(to).pos.clone(); dest.y = TH + boardHeight(dest.x, dest.z);
    t.faceYaw = Math.atan2(-(dest.z - from.z), dest.x - from.x);
    sfx.hop(step);
    t.anim = tween(230, k => {
      t.group.position.lerpVectors(from, dest, easeInOut(k));
      t.group.position.y = THREE.MathUtils.lerp(from.y, dest.y, k) + Math.sin(Math.PI * k) * 0.75;
      t.body.scale.set(1 - 0.12 * Math.sin(Math.PI * k), 1 + 0.25 * Math.sin(Math.PI * k), 1 - 0.12 * Math.sin(Math.PI * k));
    }, () => {
      t.tile = to;
      t.faceYaw = null;
      bounceTile(to);
      squash(t);
      t.anim = null;
    });
  }

  function fly(t, to, jail) {
    const from = t.group.position.clone();
    const dest = tileFrame(to).pos.clone(); dest.y = TH + boardHeight(dest.x, dest.z);
    jail ? sfx.jail() : sfx.fly();
    const spins = jail ? 3 : 2;
    t.anim = tween(1100, k => {
      t.group.position.lerpVectors(from, dest, easeInOut(k));
      t.group.position.y = THREE.MathUtils.lerp(from.y, dest.y, k) + Math.sin(Math.PI * k) * 4.5;
      t.body.rotation.y = easeInOut(k) * Math.PI * 2 * spins;
    }, () => {
      t.tile = to;
      t.body.rotation.y = 0;
      bounceTile(to);
      squash(t);
      sfx.land();
      t.anim = null;
    });
  }

  function squash(t) {
    tween(220, k => {
      const s = Math.sin(Math.PI * k) * 0.28;
      t.body.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);
    }, () => t.body.scale.set(1, 1, 1));
  }

  function bounceTile(i) {
    if (tiles[i]) tiles[i].pulse = 0.12;
  }

  const allIdle = () => [...tokens.values()].every(t => t.out || (!t.anim && !t.queue.length)) && performance.now() >= holdUntil;   // (a bankrupt piece never plays its queue)

  // ------------------------------------------------------------ dice

  const diceSys = createDice(scene, { surfaceY: TH + 0.004, area: 4.25, sfx });
  // throw from the current player's side of the table
  function throwDir() {
    const d = props && currentId ? props.seatDir(currentId) : null;
    return d || new THREE.Vector3(0, 0, 1);
  }

  // ------------------------------------------------------------ effects

  function burst(at, n = 90, power = 1, coins = false) {
    const geo = coins ? new THREE.CylinderGeometry(0.11, 0.11, 0.035, 16) : new THREE.PlaneGeometry(0.09, 0.14);
    const mat = coins ? new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.35 })
      : new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const parts = [];
    const palette = ['#e9dcc0', '#d8c9a6', '#b9a988', '#8a7d66', '#5b5246', '#9e2b25'];   // torn paper, newsprint, a little red ink
    const c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      parts.push({
        p: at.clone(),
        v: new THREE.Vector3(rand(-2.5, 2.5) * power, rand(3, 7) * power, rand(-2.5, 2.5) * power),
        r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
        w: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)),
      });
      if (!coins) mesh.setColorAt(k, c.set(pickR(palette)));
    }
    fxGroup.add(mesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    let last = performance.now();
    tweenRaw(2200, k => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      parts.forEach((pt, i) => {
        pt.v.y -= 9 * dt; pt.v.multiplyScalar(0.985);
        pt.p.addScaledVector(pt.v, dt);
        if (pt.p.y < TH) { pt.p.y = TH; pt.v.set(0, 0, 0); }
        pt.r.x += pt.w.x * dt; pt.r.y += pt.w.y * dt;
        m4.compose(pt.p, q.setFromEuler(pt.r), one.setScalar(1 - Math.max(0, k - 0.7) / 0.3));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }, () => { fxGroup.remove(mesh); geo.dispose(); mat.dispose(); });
  }

  // money changing hands: a small typed figure that drifts up out of the light and fades
  function floatText(at, text, color) {
    const map = tex(512, 128, (g, w, h) => {
      g.font = `400 64px "Special Elite", "Courier New", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 10;
      g.fillStyle = color; g.fillText(text, w / 2, h / 2);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, opacity: 0 }));
    s.renderOrder = 10;
    s.scale.set(1.5, 0.375, 1);
    s.position.copy(at);
    fxGroup.add(s);
    const y0 = at.y;
    tween(2600, k => {
      s.position.y = y0 + easeOut(k) * 0.9;
      s.material.opacity = k < 0.12 ? k / 0.12 * 0.9 : k < 0.65 ? 0.9 : 0.9 * (1 - (k - 0.65) / 0.35);
    }, () => { fxGroup.remove(s); map.dispose(); s.material.dispose(); });
  }

  function emoteFx(pid, e) {
    const t = tokens.get(pid);
    if (!t || t.out) return;
    const map = tex(256, 256, g => { g.font = `190px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.filter = 'sepia(.55) saturate(.7) brightness(.95)'; g.fillText(e, 128, 140); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
    sp.renderOrder = 11;
    fxGroup.add(sp);
    const dx = rand(-0.4, 0.4);
    sfx.pop();
    tween(2400, k => {
      const p = t.group.position;
      sp.position.set(p.x + dx * k, p.y + 1.9 + easeOut(k) * 1.3, p.z);
      sp.scale.setScalar(1.0 * (k < 0.2 ? elastic(k / 0.2) : 1));
      sp.material.opacity = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    }, () => { fxGroup.remove(sp); map.dispose(); sp.material.dispose(); });
  }

  function giftFx(fromId, toId) {
    const a = tokens.get(fromId), b = tokens.get(toId);
    if (!a || !b) return;
    const geo = new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20);
    const mat = new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.35 });
    sfx.coins();
    const N = 14;
    for (let k = 0; k < N; k++) {
      const coin = new THREE.Mesh(geo, mat);
      coin.castShadow = true; coin.visible = false;
      fxGroup.add(coin);
      const t0 = performance.now() + slow(k * 65), side = rand(-0.6, 0.6);
      tween(1000 + k * 65, () => {
        const q = Math.max(0, Math.min(1, (performance.now() - t0) / slow(1000)));
        coin.visible = q > 0 && q < 1;
        coin.position.lerpVectors(a.group.position, b.group.position, easeInOut(q));
        coin.position.y = 0.6 + Math.sin(Math.PI * q) * 2.6;
        coin.position.x += Math.sin(Math.PI * q) * side;
        coin.rotation.x = q * 14; coin.rotation.z = q * 9;
      }, () => {
        fxGroup.remove(coin);
        if (k === N - 1) { geo.dispose(); mat.dispose(); squash(b); burst(b.group.position.clone().setY(0.8), 25, 0.5, true); }
      });
    }
  }

  let shakeUntil = 0, shakePower = 0;
  function chaosFx(key) {
    const c = TRAY.clone().setY(0.6);
    if (key === 'storm' || key === 'crash' || key === 'taxday') { shakeUntil = performance.now() + 1100; shakePower = key === 'storm' ? 0.35 : 0.18; }
    if (key === 'payday' || key === 'lottery' || key === 'golden') burst(c, 70, 1.3, true);
    else burst(c, 120, 1.3);
    sfx.chaos();
  }

  // ------------------------------------------------------------ input

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const rayAt = ev => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  // the piece under the mouse (a piece wins over the square it stands on): its name shows on a small tag
  const nameTag = createNameTag(container);
  function pickToken(ev) {
    rayAt(ev);
    const live = [...tokens.values()].filter(t => !t.out && t.group.visible);
    const hit = ray.intersectObjects(live.map(t => t.hit), false)[0];
    return hit ? live.find(t => t.hit === hit.object) : null;
  }
  function pickTile(ev) {
    rayAt(ev);
    const hit = ray.intersectObjects(tiles.map(t => t.pick), false)[0];
    return hit ? hit.object.userData.tile : -1;
  }
  // hover bubble over the square the mouse rests on (hovercard.js); the square itself glows (see the frame loop)
  const hoverCard = createHoverCard(container);
  const hoverGet = i => (lastState && board && board[i] ? hoverData(lastState, board[i], (meta && meta.currency) || '$') : null);
  const hoverStamp = () => lastState;
  const hoverAnchor = (i, out) => (tiles[i] ? tiles[i].group.getWorldPosition(out).setY(0.45) : out.set(0, 0, 0));
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; hoverCard.hide(); });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const i = pickTile(e);
    if (i >= 0) onTileClick(i);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const tk = e.buttons ? null : pickToken(e);                  // (not while the camera is being dragged)
    if (tk) { hovered = -1; hoverCard.request(-1); nameTag.show(tk.id, tk.name, tk.color); renderer.domElement.style.cursor = 'pointer'; return; }
    nameTag.hide();
    hovered = e.buttons ? -1 : pickTile(e);
    hoverCard.request(hovered, hoverGet, hoverStamp);
    renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : 'grab';
  });
  renderer.domElement.addEventListener('pointerleave', () => { hovered = -1; hoverCard.request(-1); nameTag.hide(); });
  controls.addEventListener('start', () => { userUntil = performance.now() + (camMode === 'topdown' ? 3600e3 : 6000); hoverCard.hide(); nameTag.hide(); });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (camMode === 'topdown' && performance.now() >= userUntil) topView(controls.target, camera.position);   // the fit depends on the aspect: re-frame at once
  }
  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(container);

  // ------------------------------------------------------------ camera director
  // seat view → push in on the dice → follow the moving token → close-ups on big moments → back to the seat
  const shot = { until: 0, target: new THREE.Vector3(), pos: new THREE.Vector3() };
  const dT = new THREE.Vector3(), dP = new THREE.Vector3(), followT = new THREE.Vector3(), followP = new THREE.Vector3();
  let followUntil = 0;
  // everything the camera does is written for the +z side of the table, then turned about the vertical axis to the viewer's own seat
  let myYaw = 0;
  const UP = new THREE.Vector3(0, 1, 0);
  const seatTurn = v => v.applyAxisAngle(UP, myYaw);
  function seatView(T, P) {
    const portrait = container.clientWidth < container.clientHeight;
    P.set(0, portrait ? 30 : 12, portrait ? 30 : 18.4);                       // (a little nearer than before the board grew: it still has room)
    T.set(0, portrait ? 0 : 3.8, portrait ? 0 : -0.5);
    seatTurn(P); seatTurn(T);
  }
  function closeUp(at, ms = 2500, dist = 4.6, height = 2.6) {
    if (!follow) return;
    const out = at.clone().setY(0);
    if (out.lengthSq() < 0.01) out.set(0, 0, 1).applyAxisAngle(UP, myYaw);
    const dir = out.normalize().add(seatTurn(new THREE.Vector3(0, 0, 0.9))).normalize();     // from the outside, on our side of the table
    shot.target.copy(at).add(new THREE.Vector3(0, 0.25, 0));
    shot.pos.copy(at).addScaledVector(dir, dist).setY(at.y + height);
    shot.until = performance.now() + slow(ms);
  }
  // Top-down: the whole board from a corner as a diamond (topdown.js), steady like Fixed; the aim only drifts a little toward the moving piece
  let topKey = '';
  const topT = new THREE.Vector3(), topP = new THREE.Vector3(), topPts = squarePoints(HALF + 0.35, [0, 0.3]), ORIGIN = new THREE.Vector3();
  function topView(T, P) {
    const key = [container.clientWidth, container.clientHeight, myYaw].join();
    if (key !== topKey) {
      topKey = key;
      const d = fitTopDown({ pts: topPts, center: ORIGIN, fov: camera.fov, aspect: camera.aspect, yaw: myYaw, T: topT, P: topP });
      controls.maxDistance = Math.max(55, d * 1.4);
    }
    T.copy(topT); P.copy(topP);
  }
  const homeView = (T, P) => (camMode === 'topdown' ? topView(T, P) : seatView(T, P));
  function direct(now, dt) {
    if (camMode === 'fixed' || now < userUntil) return;
    if (camMode === 'topdown') {
      topView(dT, dP);
      const mover = [...tokens.values()].find(t => t.anim && !t.out);
      if (mover) { const q = mover.group.position; dT.x += q.x * 0.14; dT.z += q.z * 0.14; dP.x += q.x * 0.14; dP.z += q.z * 0.14; }
      const a = 1 - Math.exp(-(dt / 1000) * 1.2);
      controls.target.lerp(dT, a);
      camera.position.lerp(dP, a);
      return;
    }
    seatView(dT, dP);
    let k = 1.5;
    const mover = [...tokens.values()].find(t => t.anim || t.queue.length);
    if (now < shot.until) { dT.copy(shot.target); dP.copy(shot.pos); k = 2.2; }
    else if (diceSys.rolling) {                                   // lean in on the throw
      const c = diceSys.center();
      dT.lerp(c, 0.7);
      dP.lerp(c.clone().add(seatTurn(new THREE.Vector3(0, 7, 8.5))), 0.45);
    } else if (mover && now >= holdUntil) {                       // ride along with the moving piece
      const p = mover.group.position;
      followT.set(p.x, 0.5, p.z);
      const dir = new THREE.Vector3(p.x * 0.35, 0, p.z * 0.35).add(seatTurn(new THREE.Vector3(0, 0, 6))).normalize();
      followP.copy(followT).addScaledVector(dir, 8).setY(6.2);
      followUntil = now + slow(900);
      dT.copy(followT); dP.copy(followP); k = 2.0;
    } else if (now < followUntil) { dT.copy(followT); dP.copy(followP); }   // linger a beat after landing
    const a = 1 - Math.exp(-(dt / 1000) * k);
    controls.target.lerp(dT, a);
    camera.position.lerp(dP, a);
  }

  function resetView() {
    // seated at the table: eye level above the near edge, looking down across the board
    homeView(controls.target, camera.position);
    userUntil = 0;
    shot.until = 0;
  }

  // ------------------------------------------------------------ main loop

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  let lastFrame = performance.now();
  let alive = true;
  function frame() {
    if (!alive) return;
    requestAnimationFrame(frame);
    const now = performance.now(), time = clock.getElapsedTime();
    const dt = now - lastFrame; lastFrame = now;
    room.update(time);
    room.setDetail(post.tier);
    const dayK = room.dayK; post.setDay(dayK);
    renderer.toneMappingExposure += (baseExpo * (camMode === 'topdown' ? 1.45 : 1) * (1 + (room.dayExposure - 1) * dayK) - renderer.toneMappingExposure) * 0.08;
    diceSys.update(now);
    if (props) { props.setDetail(post.tier); props.update(time, room.bulbWorld); }
    for (let k = tweens.length - 1; k >= 0; k--) {
      const tw = tweens[k];
      const p = Math.min(1, (now - tw.t0) / tw.dur);
      tw.update(p);
      if (p >= 1) { tweens.splice(k, 1); tw.done && tw.done(); }
    }
    // token queues
    if (now >= holdUntil) {
      for (const t of tokens.values()) {
        if (t.anim || !t.queue.length) continue;
        const step = t.queue.shift();
        if (step.card) { sfx.card(); onCard && onCard(step.card, t.id); t.anim = tween(step.card.casino ? 5800 : 3800, () => {}, () => { t.anim = null; }); }
        else if (step.fly != null) fly(t, step.fly, step.jail);
        else hop(t, step.hop, step.n);
      }
    }
    layoutTokens();
    for (const t of tokens.values()) {
      if (!t.anim) t.group.position.lerp(t.rest, 0.18);
      const isCur = t.id === currentId;
      t.ring.visible = isCur && !t.out;
      if (isCur) { t.ring.material.opacity = 0.5 + 0.2 * Math.sin(time * 3); t.ring.scale.setScalar(1 + 0.05 * Math.sin(time * 3)); }
      // every piece hovers and bobs a little (the player to move more eagerly)
      t.body.position.y = t.anim ? 0 : 0.03 + Math.sin(time * 1.6 + t.phase) * 0.018 + (isCur ? Math.abs(Math.sin(time * 2)) * 0.035 : 0);
      // face the direction of travel (along the board edge when resting)
      const want = t.faceYaw != null ? t.faceYaw : Math.PI + tileFrame(t.tile).rot;
      let dy = want - t.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      t.group.rotation.y += dy * 0.18;
    }
    // printed tiles glow softly on hover/select (about 120 ms to fade in or out)
    const hlK = 1 - Math.exp(-dt / 45);
    tiles.forEach((t, i) => {
      const target = i === hovered ? 0.34 : i === selected ? 0.2 : 0;
      t.lift += (target + (t.pulse || 0) + (targets.has(i) ? 0.4 + 0.18 * Math.sin(time * 4) : 0) - t.lift) * hlK;
      t.pulse = (t.pulse || 0) * 0.92;
      t.glow.material.opacity = t.lift;
    });
    for (const a of animated) {
      if (a.kind === 'float') { a.obj.position.y = a.base + Math.sin(time * 1.2 + a.phase) * 0.35; a.obj.rotation.y = time * 0.6; }
      else if (a.kind === 'spin') a.obj.rotation.y += a.speed * 0.01;
      else if (a.kind === 'bob') a.obj.position.y = a.base + Math.sin(time * 0.8 + a.phase) * (a.amp || 0.08);
    }
    // queued effects wait for dice + movement to finish
    if (pendingFx.length && allIdle()) { const fx = pendingFx; pendingFx = []; while (fx.length) { fx.shift()(); if (!allIdle()) { pendingFx = fx.concat(pendingFx); break; } } }
    direct(now, dt);
    controls.update();
    post.setFocus(camera.position.distanceTo(controls.target));
    // handheld breathing, plus shake on impacts
    const off = new THREE.Vector3(Math.sin(time * 0.37) * 0.05 + Math.sin(time * 0.91) * 0.02, Math.sin(time * 0.53) * 0.04, Math.cos(time * 0.29) * 0.03);
    if (now < shakeUntil) { const k = (shakeUntil - now) / 1100 * shakePower; off.add(new THREE.Vector3(rand(-k, k), rand(-k, k), rand(-k, k))); }
    camera.position.add(off);
    hoverCard.update(camera, hoverAnchor);
    if (nameTag.id) { const tk = tokens.get(nameTag.id); if (tk && !tk.out) nameTag.update(camera, tmp.copy(tk.group.position).setY(tk.group.position.y + TOKEN_TAG_Y * TOKEN_S)); else nameTag.hide(); }
    post.render(dt, time);
    camera.position.sub(off);
  }
  resize();
  resetView();
  frame();

  // the board print uses Oswald + Abril Fatface; redraw once they've actually loaded
  let lastState = null;
  Promise.all(['500 40px Oswald', '600 40px Oswald', '400 40px "Abril Fatface"'].map(f => document.fonts.load(f))).then(() => {
    if (!board) return;
    buildWorld();
    lastProps = null;
    if (lastState) api.update(lastState);
  }).catch(() => {});

  // ------------------------------------------------------------ public API

  const api = {
    setBoard(newBoard, newMeta, newMapKey) {
      board = newBoard; meta = newMeta; mapKey = newMapKey;
      buildWorld();
      lastProps = null;
    },
    setMood() {},   // one fixed mood now: the bulb
    destroy() {     // switching to City Mode: stop drawing and free the GPU
      alive = false;
      resizeObs.disconnect();
      controls.dispose();
      post.dispose();
      hoverCard.dispose(); nameTag.dispose();
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
    setQuality: q => post.setQuality(q),
    setBroadcast: on => post.setBroadcast(on),
    get qualityMode() { return post.mode; },
    get quality() { return post.tier; },
    // v: true (Cinematic), false (Fixed) or 'topdown'
    setFollow(v) {
      camMode = v === 'topdown' ? 'topdown' : v ? 'cinematic' : 'fixed';
      follow = camMode === 'cinematic';
      if (camMode !== 'fixed') userUntil = 0;
      if (camMode === 'topdown') resetView();
    },
    resetView,
    select(i) { selected = i; },
    debugView(px, py, pz, tx = 0, ty = 0, tz = 0) { userUntil = performance.now() + 3600e3; camera.position.set(px, py, pz); controls.target.set(tx, ty, tz); controls.update(); },   // (test harness)
    tokenWorld: pid => tokens.get(pid).group.position.toArray(),      // (test harness)
    tokenScreen(pid) {                                                 // where a piece is on the page (test harness)
      const t = tokens.get(pid), r = renderer.domElement.getBoundingClientRect(), v = t.group.position.clone().setY(t.group.position.y + 0.4 * TOKEN_S).project(camera);
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    tileScreen(i, lx = 0, lz = 0, ly = TH) {                          // where a point of square i (its own frame) is on the page (test harness)
      const r = renderer.domElement.getBoundingClientRect(), v = toWorld(tiles[i].fr, lx, lz, ly).project(camera);
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    setTargets(list) {       // golden glow on the tiles a card can be played on (a brighter gold than the hover glow)
      const next = new Set(list || []);
      tiles.forEach((t, i) => {
        if (next.has(i) === targets.has(i)) return;
        t.glow.material.color.set(next.has(i) ? '#f2b23a' : '#f0a83c');
      });
      targets = next;
    },
    whenIdle(fn) { pendingFx.push(fn); },
    globalWheel(segments, key) {                       // the global event: a brass wheel rises out of the middle of the board, spins, stops, sinks
      const wheel = makeWheel3D(THREE, segments), R = 3.1, y = TH + boardHeight(0, 0) + 0.01;
      wheel.userData.size = R; wheel.userData.y0 = y; wheel.position.set(0, y, 0); wheel.rotation.y = myYaw;
      scene.add(wheel);
      holdUntil = Math.max(holdUntil, performance.now() + slow(7800));
      if (follow) { shot.target.set(0, y, 0); shot.pos.set(0, 11, 9); seatTurn(shot.pos); shot.until = performance.now() + slow(7600); }
      return wheel.show(slow(550)).then(() => wheel.spinTo(key, slow(4600), f => sfx.wheelTick(f))).then(() => new Promise(r => setTimeout(r, slow(500))))
        .then(() => { wheel.hide(slow(550)); });
    },
    hold(ms) { holdUntil = Math.max(holdUntil, performance.now() + slow(ms)); },
    isIdle: () => allIdle(),
    emote: emoteFx,
    gift: giftFx,
    chaos: chaosFx,
    // event animation on a square or a whole district (same API as City Mode): the shared fx3d.js sprites, hosted on the printed square
    fx(kind, o = {}) {
      fx3d ||= createFx3d({ dot: tex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }), tween });
      let list = o.positions || (o.pos != null ? [o.pos] : o.group ? tiles.filter(t => t.sp && t.sp.group === o.group).map(t => t.sp.i) : []);
      list = list.filter(i => tiles[i]);
      if (!list.length) return;
      const roots = [];
      const hosts = list.map(i => {
        const t = tiles[i], fr = t.fr, root = new THREE.Group();
        root.position.copy(fr.pos); root.rotation.y = fr.rot; fxGroup.add(root); roots.push(root);
        return { parent: root, y: TH + 0.05, cz: 0, w: fr.w * 0.9, d: fr.d * 0.9, shake: a => { t.pulse = Math.max(t.pulse || 0, a * 5); } };
      });
      fx3d.run(kind, hosts, o);
      if (kind === 'bomb' && bombHold && bombHold.pos === list[0]) { clearTimeout(bombHold.timer); bombHold.timer = setTimeout(releaseBomb, slow(500)); }
      setTimeout(() => roots.forEach(r => fxGroup.remove(r)), slow(8000));
    },
    celebrate() { for (let k = 0; k < 4; k++) setTimeout(() => burst(new THREE.Vector3(rand(-3, 3), 1, rand(-3, 3)), 140, 1.3), k * 400); sfx.win(); },

    update(S0) {
      rawState = S0;
      const S = holdBomb(S0);
      lastState = S;
      const yaw = viewYaw(S);
      if (yaw !== myYaw) { myYaw = yaw; resetView(); }
      // props follow the game once the pieces have finished moving (money changes hands after the landing)
      if (props) { const snap = S; pendingFx.push(() => props.sync(snap)); }
      currentId = S.phase === 'playing' ? S.players[S.turn]?.id : null;
      const firstSync = lastProps === null;

      // dice
      if (lastRollId === null) diceSys.place(S.dice);
      else if (S.rollId !== lastRollId) { sfx.dice(); holdUntil = performance.now() + diceSys.roll(S.dice, throwDir()) + 150; }
      lastRollId = S.rollId;

      // tokens & movement: replay the exact path the server recorded
      for (const p of S.players) if (!tokens.has(p.id)) tokens.set(p.id, makeToken(p));
      for (const [id, t] of tokens) if (!S.players.some(p => p.id === id)) { scene.remove(t.group); t.ring.geometry.dispose(); t.ring.material.dispose(); tokens.delete(id); t.baseMat.dispose(); t.felt.dispose(); }   // a finished game's pieces must not keep the scene "busy"
      if (lastMoveSeq !== null && (S.moveSeq || 0) < lastMoveSeq) lastMoveSeq = null; // a new game started
      if (lastMoveSeq !== null) {
        for (const m of S.moves || []) {
          if (m.seq <= lastMoveSeq) continue;
          const t = tokens.get(m.player);
          if (!t) continue;
          if (m.how === 'card') { t.queue.push({ card: m.card }); continue; }
          const fwd = (m.to - m.from + 40) % 40;
          if (m.how === 'jail') t.queue.push({ fly: m.to, jail: true });
          else if (m.how === 'back') for (let k = 1; k <= (40 - fwd) % 40; k++) t.queue.push({ hop: (m.from - k + 40) % 40, n: k });
          else if (fwd > 12) t.queue.push({ fly: m.to });
          else for (let k = 1; k <= fwd; k++) t.queue.push({ hop: (m.from + k) % 40, n: k });
          t.target = m.to;
        }
      }
      lastMoveSeq = S.moveSeq || 0;
      const teamsMode = S.settings.mode === 'teams';
      const gains = new Map(S.players.map(o => [o.id, o.money - (lastMoney[o.id] ?? o.money)]));
      for (const p of S.players) {
        const t = tokens.get(p.id);
        t.name = p.name; t.color = p.color; paintToken(t.baseMat, p.color); tokenGlow(t.felt, teamsMode && S.teams ? S.teams[p.team].color : p.color); t.ring.material.color.set(pcGlow(p.color));
        if (p.bankrupt && !t.out) {
          t.out = true;
          const where = (props && props.seatPosition(p.id)) || t.group.position.clone();
          pendingFx.push(() => { closeUp(where, 3400, 6, 4.2); shakeUntil = performance.now() + 900; shakePower = 0.25; });
          tween(600, k => t.group.scale.setScalar(TOKEN_S * (1 - k)), () => { t.group.visible = false; });
        }
        if (p.pos !== t.target) { t.queue.push({ fly: p.pos }); t.target = p.pos; } // safety net
        const jailedNow = p.inJail;
        if (jailedNow !== t.jailed) { if (jailedNow) pendingFx.push(() => { t.jailed = true; }); else t.jailed = false; }
        // floating money once everything has settled
        const before = lastMoney[p.id];
        if (before != null && before !== p.money && !firstSync) {
          const d = p.money - before;
          if (d <= -250 && S.players.some(o => o.id !== p.id && (gains.get(o.id) || 0) >= -d * 0.5)) {
            pendingFx.push(() => { closeUp(t.group.position.clone(), 2300, 4.2, 2.4); shakeUntil = performance.now() + 500; shakePower = 0.12; });   // a painful rent
          }
          pendingFx.push(() => {
            floatText(t.group.position.clone().setY(1.9), `${d > 0 ? '+' : '−'}${fmtMoney(Math.abs(d), (meta && meta.currency) || '$')}`, d > 0 ? '#e9dcc0' : '#d0584a');
            d > 0 ? sfx.cash() : sfx.pay();
          });
        }
        lastMoney[p.id] = p.money;
      }

      // tiles: owners, buildings, mortgages
      tiles.forEach((tile, i) => {
        const st = S.props[i];
        const owner = st && S.players.find(p => p.id === st.owner);
        const ownerColor = owner ? owner.color : null;
        if (ownerColor !== tile.owner) {
          if (tile.chip) { tile.group.remove(tile.chip); tile.chip = null; }
          if (ownerColor) {
            const chip = tile.chip = makeOwnerChip(ownerColor);
            const w = toWorld(tile.fr, 0.28, 0.25);
            const y0 = TH + boardHeight(w.x, w.z);
            chip.position.set(0.28, y0, 0.25);
            tile.group.add(chip);
            if (!firstSync) {                                           // dropped onto the tile
              chip.position.y = y0 + 0.7;
              tween(420, q => { chip.position.y = y0 + 0.7 * (1 - q) ** 2; chip.rotation.x = (1 - q) * 0.6; }, () => { chip.position.y = y0; chip.rotation.x = 0; });
            }
          }
          tile.owner = ownerColor;
        }
        const mort = !!(st && st.mortgaged);
        if (mort !== tile.mortgaged) {
          if (tile.slip) { tile.group.remove(tile.slip); tile.slip = null; }
          if (mort) {
            tile.slip = makeMortgageSlip();
            const w = toWorld(tile.fr, 0, 0.05);
            tile.slip.position.set((Math.random() - 0.5) * 0.08, TH + 0.004 + boardHeight(w.x, w.z), 0.05);
            tile.slip.rotation.y = (Math.random() - 0.5) * 0.3;
            tile.group.add(tile.slip);
          }
          tile.mortgaged = mort;
        }
        syncBuildings(tile, st ? (st.level === 5 ? 5 : st.level - 1) : 0, !firstSync);
        if (!firstSync && st && !(lastProps[i])) {
          pendingFx.push(() => { tile.pulse = 0.22; dustPuff(toWorld(tile.fr, 0.28, 0.25, TH + 0.04), 5); sfx.buy(); closeUp(toWorld(tile.fr, 0, 0.1, 0.05), 2400); });
        }
      });
      lastProps = { ...Object.fromEntries(Object.entries(S.props).map(([k, v]) => [k, { ...v }])) };

      if (S.phase === 'over' && lastPhase === 'playing') pendingFx.push(() => this.celebrate());
      lastPhase = S.phase;
      lastTurn = S.turn;
    },
  };
  return api;
}
