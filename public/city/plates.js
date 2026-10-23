// Street name plates and road dividers. A small dark enamel plaque lies on the pavement in front of every lot, its name in cream
// lettering under a band of the district colour (city small underneath for Underworld names), price or owner/level/rent on a second
// line, the owner's colour along the foot and the effect tag (🚓 CLOSED …) in the band. All the plates share one canvas atlas and one
// material (one draw per square). The same mesh carries the worn paint line across the carriageway at the square's boundary and a
// tick on each kerb, so the two stay level with the square when it lifts. "Floating signs" mode swaps the plate out of the
// geometry and leaves only the paint.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D, ROAD, CARRIAGE, LOT, BASE_H, TW } from './layout.js';

const COLS = 5, CW = 512, CH = 204, AW = COLS * CW, ROWS = 17, AH = ROWS * CH, GUT = 3;
const TILT = 40 * Math.PI / 180;                                        // the plates stand up like placards, leaning back
const KERB = -D / 2 + ROAD, SIDE = (ROAD - CARRIAGE) / 2;
const PW = 0.80, PT = 0.02;                                            // plate: width (the face is PW × PW·CH/CW), thickness
const cell = n => ({ x: (n % COLS) * CW, y: Math.floor(n / COLS) * CH });
const RENT0 = 45, RW = 0.78, RD = 0.34;                                 // the rent cells (one per square) follow the paint cells; the lettering lies on the carriageway
const PAINT = cell(40), TICK = { x: PAINT.x + 64, y: PAINT.y }, SKIRT = { x: PAINT.x + 128, y: PAINT.y };       // the paint cells in the spare bottom row

export function createPlates() {
  const canvas = document.createElement('canvas'); canvas.width = AW; canvas.height = AH;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.4, roughness: 0.55, metalness: 0.1, transparent: true });
  let dirty = false, items = [], style = 'street', near = [0];   // near: the side indexes of the rows nearest the viewer (one for the seat view, the two rows at the corner for the diagonal top-down view)

  // ------------------------------------------------------------ the paint cells
  function paintCells() {
    g.clearRect(PAINT.x, PAINT.y, 3 * 64 * 2, CH);
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    // worn road paint: cream, eaten away in specks and along the edges
    g.fillStyle = '#d9cfb4'; g.fillRect(PAINT.x + 8, PAINT.y, 48, CH);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(0,0,0,${0.35 + rnd() * 0.65})`; g.fillRect(PAINT.x + 6 + rnd() * 52, PAINT.y + rnd() * CH, 1 + rnd() * 7, 1 + rnd() * 5); }
    for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(PAINT.x + 6 + rnd() * 52, PAINT.y + rnd() * CH, 2 + rnd() * 9, 6 + rnd() * 22); }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#c9bd9c'; g.fillRect(TICK.x + 8, TICK.y, 48, CH);
    g.fillStyle = '#0d0b09'; g.fillRect(SKIRT.x, SKIRT.y, 64, CH);
    g.fillStyle = '#1b1612'; g.fillRect(SKIRT.x, SKIRT.y, 64, 6);
  }
  paintCells(); dirty = true;

  // ------------------------------------------------------------ geometry
  const uvOf = (c, nu, nv, inset = GUT) => [(c.x + inset + nu * (CW - 2 * inset)) / AW, 1 - (c.y + inset + nv * (CH - 2 * inset)) / AH];
  // The viewer's near row (side `near`, side 0 for the +z home camera) faces the home camera from the outer edge of its lot, so no building stands in front of it; the other sides stand on the
  // road-side pavement facing the street (the far row, seen from the home camera, and the side rows, seen from the middle of the board)
  function plateGeo(n, f) {
    const corner = f.corner, flip = !near.includes(f.side), w = corner ? 1.1 : PW, d = w * CH / CW;
    const geo = new THREE.BoxGeometry(w, PT, d);
    const pos = geo.attributes.position, uv = geo.attributes.uv, c = cell(n);
    for (let v = 0; v < pos.count; v++) {
      if (geo.attributes.normal.getY(v) > 0.9) {
        let nu = pos.getX(v) / w + 0.5, nv = pos.getZ(v) / d + 0.5;
        if (flip) { nu = 1 - nu; nv = 1 - nv; }
        const [a, b] = uvOf(c, nu, nv); uv.setXY(v, a, b);
      } else { const [a, b] = uvOf(SKIRT, 0.5, 0.5, 20); uv.setXY(v, a, b); }
    }
    geo.rotateX(flip ? -TILT : TILT);
    geo.computeBoundingBox();
    const bb = geo.boundingBox, x = corner ? ROAD / 2 : 0;
    const z = near.includes(f.side) ? (corner ? f.d / 2 - 0.03 : KERB + LOT - 0.02) - bb.max.z : (corner ? -f.d / 2 + ROAD + 0.02 : KERB - 0.145) - bb.min.z;
    geo.translate(x, BASE_H + 0.002 - bb.min.y, z);
    return geo;
  }
  function quad(c, w, d, x, y, z, nuw = 1, nvh = 1) {                       // a flat quad (facing up) mapped to a paint cell
    const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const nu = pos.getX(v) / w + 0.5, nv = pos.getZ(v) / d + 0.5;
      const [a, b] = uvOf(c, (8 + nu * 48) / CW, nv, 0); uv.setXY(v, a, b);
    }
    return geo.translate(x, y, z);
  }
  function paintGeos(f) {
    if (f.corner) return [];
    const list = [], xs = [TW / 2 - 0.016];
    if (f.k === 9) xs.push(-TW / 2 + 0.016);                                 // the last square before a corner is also bounded at its far end
    const zc = -D / 2 + SIDE + CARRIAGE / 2;
    for (const x of xs) {
      list.push(quad(PAINT, 0.03, CARRIAGE - 0.01, x, BASE_H + 0.0036, zc));
      for (const s of [-1, 1]) list.push(quad(TICK, 0.03, 0.075, x, BASE_H + 0.0232, zc + s * (CARRIAGE / 2 + 0.05)));
    }
    const zr = -D / 2 + SIDE + CARRIAGE / 2, geo = new THREE.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), uv = geo.attributes.uv, pos = geo.attributes.position, flip = !near.includes(f.side);
    for (let v = 0; v < pos.count; v++) {
      let nu = pos.getX(v) / RW + 0.5, nv = pos.getZ(v) / RD + 0.5;
      if (flip) { nu = 1 - nu; nv = 1 - nv; }
      const [a, b] = uvOf(cell(RENT0 + f.i), nu, nv, 1); uv.setXY(v, a, b);
    }
    list.push(geo.translate(0, BASE_H + 0.0046, zr));                        // the rent, painted on the road
    return list;
  }

  // one mesh per square: plate + paint (or paint alone)
  function geos(i, f) {
    const paint = paintGeos(f), pl = plateGeo(i, f);
    const full = mergeGeometries([pl, ...paint]), lean = paint.length ? mergeGeometries(paint) : null;
    pl.dispose(); paint.forEach(p => p.dispose());
    return { full, lean };
  }
  function make(i, f) {
    const { full, lean } = geos(i, f);
    const mesh = new THREE.Mesh(style === 'street' ? full : lean || new THREE.BufferGeometry(), mat);
    mesh.userData = { full, lean, i, f }; mesh.receiveShadow = true;
    items[i] = { mesh, key: '' };
    return mesh;
  }
  // turn the plates to the viewer's seat: a one-off rebuild of the geometry (no per-frame cost)
  function setNear(n) {
    n = [].concat(n);
    if (n.join() === near.join()) return;
    near = n;
    for (const it of items) if (it) {
      const u = it.mesh.userData, old = it.mesh.geometry;
      u.full.dispose(); if (u.lean) u.lean.dispose();
      Object.assign(u, geos(u.i, u.f));
      it.mesh.geometry = style === 'street' ? u.full : u.lean || new THREE.BufferGeometry();
    }
  }

  // ------------------------------------------------------------ the lettering
  function fit(font, text, maxW, size, min = 18) {
    for (; size > min; size -= 2) { g.font = font(size); if (g.measureText(text).width <= maxW) break; }
    g.font = font(size);
    return size;
  }
  // overview lettering: the name big (on two lines when that lets it be bigger), the price or level and rent below, tag in a pill on top
  function draw(i, { name = '', short = '', sub = '', accent, owner, mortgaged, tag, tagTone }) {
    const c = cell(i), line = short || sub, FONT = s => `600 ${s}px Oswald, "Arial Narrow", sans-serif`, MONO = s => `${s}px "Special Elite", monospace`;
    g.save(); g.beginPath(); g.rect(c.x, c.y, CW, CH); g.clip(); g.translate(c.x, c.y);
    g.fillStyle = '#0b0908'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = accent || '#6b5a3c'; g.fillRect(8, 8, CW - 16, 16);                                 // the district band, on the road side
    if (owner) { g.fillStyle = owner; g.fillRect(8, CH - 22, CW - 16, 14); }                          // the owner's colour along the foot
    g.strokeStyle = '#f0e3c6'; g.lineWidth = 4; g.strokeRect(4, 4, CW - 8, CH - 8);                    // thin bright rim
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const top = 28, bot = line ? CH - (owner ? 26 : 12) - 52 : CH - (owner ? 26 : 12), maxW = CW - 40, text = name.toUpperCase();
    // one line or two?
    g.letterSpacing = '1px';
    const words = text.split(' ');
    let best = { size: fit(FONT, text, maxW, Math.min(110, bot - top), 20), lines: [text] };
    if (words.length > 1) {
      let split = null;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
        g.font = FONT(60); const m = Math.max(g.measureText(a).width, g.measureText(b).width);
        if (!split || m < split.m) split = { a, b, m };
      }
      g.font = FONT(60);
      const wide = g.measureText(split.a).width > g.measureText(split.b).width ? split.a : split.b;
      const sz = fit(FONT, wide, maxW, Math.min(76, (bot - top) / 2.1), 20);
      if (sz > best.size * 1.12) best = { size: sz, lines: [split.a, split.b] };
    }
    g.font = FONT(best.size); g.fillStyle = '#fff1d0'; g.strokeStyle = '#fff1d0'; g.lineWidth = Math.max(1.5, best.size / 28); g.lineJoin = 'round';
    const lh = best.size * 1.04, y0 = (top + bot) / 2 - (best.lines.length - 1) * lh / 2 + best.size * 0.04;
    best.lines.forEach((t, k) => { g.strokeText(t, CW / 2, y0 + k * lh); g.fillText(t, CW / 2, y0 + k * lh); });
    g.letterSpacing = '0px';
    if (line) { g.fillStyle = owner ? '#f0e3c6' : '#e8c46c'; fit(MONO, line, maxW, 40, 16); g.fillText(line, CW / 2, CH - (owner ? 26 : 12) - 24); }
    if (tag) {                                                                                          // the effect tag: a dark pill over the band
      g.font = '600 26px Oswald, "Arial Narrow", sans-serif'; g.letterSpacing = '1px';
      const tw = Math.min(CW - 24, g.measureText(tag).width + 22);
      g.fillStyle = 'rgba(8,6,5,.95)'; g.beginPath(); g.roundRect(CW / 2 - tw / 2, 6, tw, 40, 9); g.fill();
      g.fillStyle = tagTone === 'bad' ? '#ff8a7a' : '#f2cf7c'; g.textAlign = 'center'; g.fillText(tag, CW / 2, 27);
      g.letterSpacing = '0px';
    }
    if (mortgaged) { g.fillStyle = 'rgba(30,30,30,.55)'; g.fillRect(0, 0, CW, CH); }
    g.restore();
    dirty = true;
  }

  // the rent, in white road paint: bold condensed lettering, worn away in specks and along the edges
  const rents = [];
  function drawRent(i, text, small) {
    const c = cell(RENT0 + i);
    g.clearRect(c.x, c.y, CW, CH);
    if (!text) { dirty = true; return; }
    const FONT = s => `600 ${s}px Oswald, "Arial Narrow", sans-serif`;
    g.save(); g.beginPath(); g.rect(c.x, c.y, CW, CH); g.clip(); g.translate(c.x, c.y);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '3px'; g.lineJoin = 'round';
    const sz = fit(FONT, text, CW - 40, small ? 84 : 176, 20);
    g.fillStyle = g.strokeStyle = '#f4f1ea'; g.lineWidth = Math.max(2, sz / 16);
    g.strokeText(text, CW / 2, CH / 2 + sz * 0.05); g.fillText(text, CW / 2, CH / 2 + sz * 0.05);
    let s = 11 + i * 977;                                                   // the same wear each time for a square
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 420; k++) { g.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.7})`; g.fillRect(rnd() * CW, rnd() * CH, 1 + rnd() * 5, 1 + rnd() * 3); }
    for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(rnd() * CW, rnd() * CH, 6 + rnd() * 26, 2 + rnd() * 4); }
    g.globalCompositeOperation = 'source-over';
    g.letterSpacing = '0px'; g.restore();
    dirty = true;
  }
  function setRent(i, text, small = false) {
    const key = text ? text + (small ? '|s' : '') : '';
    if (rents[i] === key || (rents[i] === undefined && !key)) return;
    rents[i] = key; drawRent(i, text, small);
  }

  function set(i, info) {
    const it = items[i];
    if (!it) return;
    const key = [info.name, info.short, info.sub, info.accent, info.owner, info.mortgaged, info.tag, info.tagTone].join('|');
    if (key === it.key) return;
    it.key = key; it.info = info;
    draw(i, info);
  }

  return {
    mat, make, set, setRent, setNear,
    begin() { items = []; rents.length = 0; g.clearRect(0, cell(RENT0).y, AW, AH); dirty = true; },
    redrawAll() { items.forEach((it, i) => { if (it && it.info) draw(i, it.info); }); rents.forEach((k, i) => { if (k) { const sm = k.endsWith('|s'); drawRent(i, sm ? k.slice(0, -2) : k, sm); } }); },       // e.g. once the web fonts have arrived
    setStyle(s) {
      style = s;
      for (const it of items) if (it) { const u = it.mesh.userData; it.mesh.geometry = s === 'street' ? u.full : u.lean || new THREE.BufferGeometry(); }
    },
    get style() { return style; },
    update() { if (dirty) { tex.needsUpdate = true; dirty = false; } },
    dispose() { tex.dispose(); mat.dispose(); },
  };
}
