// The loading screen over the 3D view: a noir card with a thin brass progress bar, shown while a scene fetches its models, builds
// the city and compiles its shaders (so none of that work shows as stutter). It only appears if the wait lasts a moment, then fades out.
import { t } from './i18n.js';

let current = null;                                   // one loading screen at a time: the scene picks up the one app.js raised while the game state was still on its way
export function createLoading(container, label = 'Loading…') {
  if (current && !current.done && current.container === container) return current;
  const el = document.createElement('div');
  el.className = 'scene-loading';
  el.innerHTML = '<div class="sl-box"><div class="sl-title"></div><div class="sl-bar"><i></i></div><div class="sl-step"></div></div>';
  const title = el.querySelector('.sl-title'), bar = el.querySelector('i'), step = el.querySelector('.sl-step');
  title.textContent = t(label);
  el.style.opacity = '1';
  container.append(el);
  let frac = 0, shown = 0, done = false;
  return current = {
    container,
    // f: 0…1 overall; text: what is happening now (translated by the caller)
    set(f, text) {
      frac = Math.max(frac, Math.min(1, f));
      bar.style.transform = `scaleX(${frac})`;
      if (text) step.textContent = text;
    },
    end() {
      if (done) return;
      done = true;
      bar.style.transform = 'scaleX(1)';
      el.classList.add('out');
      setTimeout(() => el.remove(), 700);
    },
    get done() { return done; },
  };
}
