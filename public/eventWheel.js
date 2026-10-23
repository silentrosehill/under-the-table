// A big noir wheel of fortune in the middle of the screen: dark lacquer, brass, ivory lettering, a pointer at the top.
// Reusable: give it a list of segments and the key it must stop on; it returns a promise for the segment that won.
//
//   import { spinEventWheel } from './eventWheel.js';
//   const seg = await spinEventWheel({
//     segments: [{ key, label, icon, tone: 'good'|'bad'|'neutral', weight? }, ...],   // weight (default 1) sizes the slice
//     target: 'boom',                       // segment key to land on (the server decides, the wheel only shows it)
//     title: 'Club Lucky Seven',            // small line above the wheel (optional)
//     duration: 3800,                       // ms of spinning (fast start, long ease-out)
//     onTick: final => sfx.wheelTick(final),// a peg passed the pointer; final = true for the clack at the stop
//     big: true,                            // a larger wheel and title (global events)
//     onStop: seg => {},                    // the wheel came to rest (the highlight starts)
//   });
// Styles are in style.css (.ew-*). Calling it again cancels a wheel still on screen.

import { ms as slow } from './speed.js';
import { ic, keyOfEmoji, iconDataUrl } from './icons.js';

// the slice icons are the HUD's line icons (icons.js), drawn from small images; a slice repaints itself when its image has loaded
const IMGS = {};
function iconImg(icon, color) {
  const key = ICON_KEY(icon); if (!key) return null;
  const id = key + color;
  if (!IMGS[id]) { const im = new Image(); im.src = iconDataUrl(key, color, 1.7); IMGS[id] = im; }
  return IMGS[id];
}
const ICON_KEY = icon => (icon && /^[a-zA-Z]+$/.test(icon) ? icon : keyOfEmoji(icon));

const TAU = 360;
let current = null;

export function spinEventWheel({ segments, target, title = '', duration = 3800, onTick, onStop, host = document.body, big = false } = {}) {
  if (current) current.cancel();
  const list = (segments || []).filter(Boolean);
  if (!list.length) return Promise.resolve(null);
  let idx = list.findIndex(s => s.key === target);
  if (idx < 0) idx = 0;

  // slice angles, clockwise from the top
  const total = list.reduce((s, x) => s + (x.weight || 1), 0);
  let acc = 0;
  const arcs = list.map(s => { const a0 = acc, a1 = acc + (s.weight || 1) / total * TAU; acc = a1; return { a0, a1, mid: (a0 + a1) / 2 }; });

  const size = big ? Math.round(Math.max(260, Math.min(640, innerWidth * 0.92, innerHeight * 0.72))) : Math.round(Math.max(240, Math.min(400, innerWidth * 0.86, innerHeight * 0.5)));
  const root = document.createElement('div');
  root.className = big ? 'ew ew-big' : 'ew';
  root.style.setProperty('--ew', size + 'px');
  root.innerHTML = `<div class="ew-shade"></div>
<div class="ew-box">
  <div class="ew-title"></div>
  <div class="ew-stage">
    <div class="ew-glow"></div>
    <div class="ew-rot"><canvas class="ew-face"></canvas><canvas class="ew-hi"></canvas></div>
    <div class="ew-hub"></div>
    <svg class="ew-pointer" viewBox="0 0 40 56" aria-hidden="true"><path d="M20 54 L5 18 Q20 -6 35 18 Z" fill="#c9a24f" stroke="#0b0908" stroke-width="2.5"/><path d="M20 46 L11 20 Q20 6 29 20 Z" fill="#efe4c8" opacity=".85"/><circle cx="20" cy="18" r="4.5" fill="#0b0908"/></svg>
  </div>
  <div class="ew-result"></div>
</div>`;
  root.querySelector('.ew-title').textContent = title;
  const face = root.querySelector('.ew-face'), hi = root.querySelector('.ew-hi'), rot = root.querySelector('.ew-rot');
  const pointer = root.querySelector('.ew-pointer'), result = root.querySelector('.ew-result');
  const late = new Set();
  const drawFace = () => paint(face, list, arcs, size, false, late);
  drawFace();
  paint(hi, list, arcs, size, idx);
  late.forEach(im => im.addEventListener('load', drawFace, { once: true }));
  host.appendChild(root);

  // where the wheel must stop: the target slice's middle (a little off-centre, so it never looks rigged) under the pointer
  const a = arcs[idx], span = a.a1 - a.a0;
  const aim = a.mid + (Math.random() - 0.5) * span * 0.5;
  const start = Math.random() * TAU;
  const final = start + TAU * (5 + Math.floor(Math.random() * 2)) + ((TAU - aim) - start % TAU + TAU) % TAU;   // clockwise rotation R so that -R == aim (mod 360)
  // pegs: the rotation values at which a slice edge passes the pointer
  const pegs = [];
  for (let lap = 0; lap <= Math.ceil(final / TAU); lap++) for (const x of arcs) { const r = lap * TAU + ((TAU - x.a0) % TAU); if (r > start && r <= final) pegs.push(r); }
  pegs.sort((p, q) => p - q);

  let raf = 0, done = false, resolveFn;
  const promise = new Promise(res => { resolveFn = res; });
  const ease = x => 1 - Math.pow(1 - x, 3.4);
  const setRot = r => { rot.style.transform = `rotate(${r}deg)`; };
  setRot(start);
  const kick = () => {
    if (!pointer.animate) return;
    pointer.animate([{ transform: 'rotate(-16deg)' }, { transform: 'rotate(0deg)' }], { duration: 120, easing: 'ease-out' });
  };
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.classList.add('out');
    setTimeout(() => { root.remove(); if (current === handle) current = null; }, 320);
    resolveFn(list[idx]);
  };
  const handle = { cancel() { if (done) return; done = true; cancelAnimationFrame(raf); root.remove(); current = null; resolveFn(null); } };
  current = handle;

  requestAnimationFrame(() => root.classList.add('in'));
  const t0 = performance.now() + slow(250);                    // let the overlay fade in before the wheel moves
  let fired = 0;
  const frame = now => {
    if (done) return;
    const q = Math.max(0, Math.min(1, (now - t0) / duration));
    const r = start + (final - start) * ease(q);
    setRot(r);
    while (fired < pegs.length && pegs[fired] <= r) { fired++; if (onTick) onTick(false); kick(); }
    if (q < 1) { raf = requestAnimationFrame(frame); return; }
    setRot(final);
    root.classList.add('stopped');
    result.innerHTML = (ICON_KEY(list[idx].icon) ? ic(ICON_KEY(list[idx].icon)) : '') + `<span>${String(list[idx].label).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`;
    result.dataset.tone = list[idx].tone || 'neutral';
    if (onTick) onTick(true);
    if (onStop) onStop(list[idx]);
    setTimeout(finish, slow(1500));                            // the highlight, a beat for the eye, then hand over
  };
  raf = requestAnimationFrame(frame);
  return promise;
}

const TONE = { good: '#d4af5a', bad: '#a8322a', neutral: '#efe4c8' };

// draw the wheel (hl === false) or just the winning slice's glow (hl === its index)
function paint(canvas, list, arcs, size, hl, late) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.round(size * dpr);
  canvas.width = canvas.height = px;
  const g = canvas.getContext('2d'), m = px / 2, k = px / 440;
  const pt = (deg, r) => [m + Math.sin(deg * Math.PI / 180) * r, m - Math.cos(deg * Math.PI / 180) * r];
  const wedge = (i, r0, r1) => {
    const A = (arcs[i].a0 - 90) * Math.PI / 180, B = (arcs[i].a1 - 90) * Math.PI / 180;
    g.beginPath(); g.arc(m, m, r1, A, B); g.arc(m, m, r0, B, A, true); g.closePath();
  };
  const R = m - 2;
  if (hl !== false) {
    wedge(hl, 52 * k, 206 * k);
    const gr = g.createRadialGradient(m, m, 60 * k, m, m, 210 * k);
    gr.addColorStop(0, 'rgba(255,214,120,.05)'); gr.addColorStop(1, 'rgba(255,214,120,.75)');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = '#ffe9a8'; g.lineWidth = 4 * k; g.stroke();
    return;
  }
  // outer brass ring with studs
  const ring = g.createLinearGradient(0, 0, px, px);
  ring.addColorStop(0, '#f1d98c'); ring.addColorStop(0.5, '#8a6a2c'); ring.addColorStop(1, '#e2c36e');
  g.fillStyle = ring; g.beginPath(); g.arc(m, m, R, 0, 7); g.fill();
  g.fillStyle = '#0b0908'; g.beginPath(); g.arc(m, m, 214 * k, 0, 7); g.fill();
  // slices
  list.forEach((s, i) => {
    wedge(i, 52 * k, 208 * k);
    const dark = i % 2 ? '#2f1511' : '#16110f';
    const gr = g.createRadialGradient(m, m, 40 * k, m, m, 208 * k);
    gr.addColorStop(0, dark); gr.addColorStop(1, i % 2 ? '#4a1d17' : '#26201c');
    g.fillStyle = gr; g.fill();
    wedge(i, 196 * k, 208 * k);                           // a coloured band on the rim: gold = good, red = bad, ivory = neutral
    g.fillStyle = TONE[s.tone] || TONE.neutral; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
  });
  // brass dividers
  g.strokeStyle = '#c9a24f'; g.lineWidth = 3 * k;
  arcs.forEach(x => { const [x0, y0] = pt(x.a0, 52 * k), [x1, y1] = pt(x.a0, 208 * k); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); });
  g.beginPath(); g.arc(m, m, 208 * k, 0, 7); g.stroke();
  g.lineWidth = 1.5 * k; g.beginPath(); g.arc(m, m, 195 * k, 0, 7); g.stroke();
  // studs between slices
  g.fillStyle = '#f5e7b4';
  arcs.forEach(x => { const [sx, sy] = pt(x.a0, 214 * k + (R - 214 * k) / 2); g.beginPath(); g.arc(sx, sy, 3.2 * k, 0, 7); g.fill(); });
  // icons and ivory lettering, set radially
  list.forEach((s, i) => {
    const mid = arcs[i].mid, narrow = arcs[i].a1 - arcs[i].a0 < 38;
    g.save(); g.translate(m, m); g.rotate(mid * Math.PI / 180);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const im = iconImg(s.icon, '#efe4c8');
    if (im) {
      const d = (narrow ? 22 : 29) * k;
      if (im.complete && im.naturalWidth) { g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 4 * k; g.drawImage(im, -d / 2, -178 * k - d / 2, d, d); g.shadowBlur = 0; }
      else if (late) late.add(im);
    }
    // the label runs along the radius, reading outward-in from the rim; shrink to fit
    let size2 = (narrow ? 15 : 19) * k;
    const text = String(s.label || '').toUpperCase();
    g.font = `600 ${size2}px Oswald, "Arial Narrow", sans-serif`;
    const maxLen = 94 * k, wdt = g.measureText(text).width;
    if (wdt > maxLen) { size2 *= maxLen / wdt; g.font = `600 ${size2}px Oswald, "Arial Narrow", sans-serif`; }
    g.rotate(-Math.PI / 2);
    g.fillStyle = '#efe4c8'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 4 * k;
    g.textAlign = 'left'; g.fillText(text, 62 * k, 0);     // from the hub outwards... drawn after the -90deg turn, so x runs along the radius
    g.restore();
  });
  g.shadowBlur = 0;
}
