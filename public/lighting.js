// The room's lighting: Night (the hanging bulb, the default) or Day (sun through the window). A per-viewer preference (mono.lighting).
// `k` is the eased blend, 0 night … 1 day; it is a pure function of time, so every scene just reads it each frame and a switch glides over
// about 1.5 s with no reload. `?lighting=day` forces it (screenshots, tests).
const KEY = 'mono.lighting', DUR = 1500;
const read = () => {
  const q = new URLSearchParams(location.search).get('lighting');
  let s = null; try { s = localStorage.getItem(KEY); } catch {}
  return (q || s) === 'day' ? 'day' : 'night';
};
let mode = read(), from = mode === 'day' ? 1 : 0, to = from, t0 = -1e9;
const listeners = new Set();
const ease = x => x * x * (3 - 2 * x);

export const lighting = {
  get mode() { return mode; },
  get k() { const q = Math.min(1, (performance.now() - t0) / DUR); return from + (to - from) * ease(q); },
  set(next) {
    next = next === 'day' ? 'day' : 'night';
    if (next === mode) return;
    from = this.k; mode = next; to = next === 'day' ? 1 : 0; t0 = performance.now();
    try { localStorage.setItem(KEY, mode); } catch {}
    listeners.forEach(f => f(mode));
  },
  onChange(f) { listeners.add(f); return () => listeners.delete(f); },
};
