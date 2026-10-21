// A small enamel street sign above every square: dark plate, cream lettering, a thin line of the
// colour group. Plain HTML over the canvas, so the text stays crisp at any zoom; each frame the signs
// follow their squares on screen. Always visible: name, price or owner/level/rent. They shrink with
// camera distance and the far row fades back (never below 70%); a hovered, selected or occupied
// square's sign is lifted forward.
import * as THREE from 'three';

export function createBubbles(container) {
  const layer = document.createElement('div');
  layer.className = 'city-labels';
  container.append(layer);
  let items = [];
  let showAll = false;
  const v = new THREE.Vector3();

  function build(count) {
    layer.innerHTML = '';
    items = Array.from({ length: count }, (_, i) => {
      const el = document.createElement('div');
      el.className = 'cb';
      el.innerHTML = '<div class="cb-card"><span class="cb-acc"></span><b class="cb-name"></b><span class="cb-sub"></span><span class="cb-tag" hidden></span></div>';
      layer.append(el);
      return { el, card: el.firstChild, acc: el.querySelector('.cb-acc'), name: el.querySelector('.cb-name'), sub: el.querySelector('.cb-sub'), tag: el.querySelector('.cb-tag'),
        anchor: new THREE.Vector3(), dist: 0, full: false, key: '', phase: i * 0.7 };
    });
  }

  // text and accent colour; only touches the DOM when something changed
  function set(i, { name, sub, accent, owner, mortgaged, tag, tagTone }) {
    const it = items[i];
    if (!it) return;
    const key = [name, sub, accent, owner, mortgaged, tag, tagTone].join('|');
    if (key === it.key) return;
    it.key = key;
    it.w = 0;                                                        // re-measure on the next frame
    it.name.textContent = name;
    it.sub.textContent = sub || '';
    it.sub.hidden = !sub;
    it.tag.textContent = tag || ''; it.tag.hidden = !tag; it.tag.className = 'cb-tag ' + (tagTone || '');
    it.acc.style.background = accent || 'transparent';
    it.acc.hidden = !accent;
    it.card.style.setProperty('--owner', owner || 'transparent');
    it.el.classList.toggle('owned', !!owner);
    it.el.classList.toggle('mort', !!mortgaged);
  }

  function update(camera, time, isFull) {
    const w = container.clientWidth, h = container.clientHeight;
    const camPos = camera.position;
    let near = Infinity, far = 0;
    for (const it of items) { const d = it.anchor.distanceTo(camPos); it.dist = d; if (d < near) near = d; if (d > far) far = d; }
    const narrow = w < 900;
    const shown = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      v.copy(it.anchor);
      const dist = it.dist;
      v.project(camera);
      const off = v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.3;
      it.el.style.display = off ? 'none' : '';
      if (off) continue;
      const full = showAll || isFull(i);
      if (full !== it.full) { it.full = full; it.el.classList.toggle('full', full); }
      // shrink with distance (and on narrow screens); the back row dims to 70% at most
      const sc = Math.max(0.7, Math.min(1.05, 11 / Math.max(dist, 1))) * (narrow ? 0.86 : 1) * (full ? 1.12 : 1);
      const back = far > near ? (dist - near) / (far - near) : 0;
      it.card.style.setProperty('--s', sc.toFixed(3));
      it.sx = (v.x + 1) / 2 * w; it.sy = (1 - v.y) / 2 * h; it.sc = sc; it.op = full ? 1 : 0.96 - 0.26 * back;
      it.el.style.transform = `translate3d(${it.sx.toFixed(1)}px, ${it.sy.toFixed(1)}px, 0)`;
      it.el.style.zIndex = String(full ? 2000 - Math.round(dist * 10) : 1000 - Math.round(dist * 10));
      shown.push(it);
    }
    declutter(shown);
  }

  // signs that would cover each other: the nearest (or the highlighted one) keeps its place, the others
  // step up above it, and if there's no room either way they fade right back so the front one reads
  function declutter(shown) {
    shown.sort((a, b) => (b.full - a.full) || (a.dist - b.dist));
    const placed = [];
    for (const it of shown) {
      if (!it.w) { it.w = it.card.offsetWidth || 80; it.h = it.card.offsetHeight || 28; }
      const bw = it.w * it.sc, bh = it.h * it.sc + 2;
      let dy = 0, ok = false;
      for (let k = 0; k < 3 && !ok; k++) {
        dy = -k * bh;
        const x0 = it.sx - bw / 2, x1 = it.sx + bw / 2, y1 = it.sy - 6 + dy, y0 = y1 - bh;
        ok = !placed.some(r => x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0);
        if (ok) placed.push({ x0, x1, y0, y1 });
      }
      if (!ok) dy = 0;
      it.card.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      it.card.style.opacity = (ok ? it.op : 0.18).toFixed(2);
    }
  }

  return {
    build, set, update,
    anchor: i => items[i] && items[i].anchor,
    setShowAll(on) { showAll = on; },
    setHidden(h) { layer.style.display = h ? 'none' : ''; items.forEach(it => { it.key = ''; }); },
    get showAll() { return showAll; },
    dispose() { layer.remove(); },
  };
}
