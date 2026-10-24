// The settings panel (gear button) and the "What's new" page.
//   Display: view, camera, labels, graphics, language, text size · Sound: volume, record, mute · Info: announcer, side log, hover bubbles
//   · More: what's new, the cards & events guide.
// Everything that is a plain per-viewer preference lives in localStorage under the same keys the rest of the app reads (mono.*); the host
// object app.js passes in does the things only app.js can do (swap the renderer, move the camera, change the volume…).
//
//   const st = createSettings({ ...host });  st.open(); st.sync();
//   host: { view(), setView(v), cam(), setCam(m), camOptions(), labelStyle(), setLabelStyle(v), labelsAll(), setLabelsAll(b), isCity(),
//           quality(), setQuality(q), broadcast(), setBroadcast(b), lighting(), setLighting(m), lang(), setLang(l), ann(), setAnn(l), annPos(), setAnnPos(p), sideLog(), setSideLog(b),
//           hover(), setHover(b), scale(), setScale(pct, commit), sfx, openGuide() }

import { t, lang as curLang, onLang } from './i18n.js';
import { ic } from './icons.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (root, s) => root.querySelector(s);

export const CAM_LABEL = { cinematic: 'Cinematic', fixed: 'Fixed', topdown: 'Top-down' };
const CAM_ICON = { cinematic: 'video', fixed: 'camera', topdown: 'map' };

export function createSettings(host) {
  const root = document.getElementById('settings');
  let tab = 'display', isOpen = false, lastFocus = null;

  // ---- markup helpers
  const seg = (pref, opts, extra = '') => `<div class="seg" role="radiogroup" data-pref="${pref}"${extra}>${opts.map(o => `<button type="button" role="radio" data-v="${esc(o.v)}">${o.icon ? ic(o.icon) : ''}<span>${esc(o.label)}</span></button>`).join('')}</div>`;
  const onOff = pref => seg(pref, [{ v: '1', label: t('On') }, { v: '0', label: t('Off') }]);
  const row = (key, icon, label, ctl, hint = '', cls = '') => `<div class="st-row ${cls}" data-row="${key}"><div class="st-lab">${ic(icon)}<div><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div></div><div class="st-ctl">${ctl}</div></div>`;
  const slider = (id, icon, label, outId, min, max, step, hint = '') => `<div class="st-row st-slide" data-row="${id}"><div class="st-lab">${ic(icon)}<div><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div><output id="${outId}"></output></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" aria-label="${esc(label)}"></div>`;

  function html() {
    const cams = host.camOptions().map(k => ({ v: k, label: t(CAM_LABEL[k] || k), icon: CAM_ICON[k] }));
    const tabs = [['display', 'monitor', 'Display'], ['sound', 'speaker', 'Sound'], ['info', 'info', 'Info'], ['more', 'book', 'More']];
    return `<div class="st-scrim" data-close></div>
<div class="st-box" role="dialog" aria-modal="true" aria-label="${esc(t('Settings'))}">
  <header class="st-head">${ic('gear')}<h2>${esc(t('Settings'))}</h2><button class="st-x" type="button" data-close aria-label="${esc(t('Close'))}">${ic('close')}</button></header>
  <nav class="st-tabs" role="tablist">${tabs.map(([k, i, n]) => `<button type="button" role="tab" data-tab="${k}">${ic(i)}<span>${esc(t(n))}</span></button>`).join('')}</nav>
  <div class="st-body">
    <section class="st-sec" data-sec="display">
      ${row('view', 'building', t('View'), seg('view', [{ v: 'table', label: t('Table'), icon: 'dice' }, { v: 'city', label: t('City'), icon: 'building' }]), t('Table: the back-room board. City: the miniature noir city.'))}
      ${row('cam', 'video', t('Camera'), seg('cam', cams), t('Cinematic follows the action; Fixed keeps the whole board in view.'), 'stack')}
      ${row('labelStyle', 'tag', t('Labels'), seg('labelStyle', [{ v: 'street', label: t('Names on the street') }, { v: 'signs', label: t('Floating signs') }]), '', 'city-only stack')}
      ${row('labelsAll', 'tag', t('Sign density'), seg('labelsAll', [{ v: '0', label: t('Quiet') }, { v: '1', label: t('All') }]), t('Show every street label, or only the busy ones.'), 'city-only signs-only')}
      ${row('quality', 'sliders', t('Graphics'), seg('quality', [{ v: 'auto', label: t('Auto') }, { v: 'high', label: t('High') }, { v: 'medium', label: t('Medium') }, { v: 'low', label: t('Low') }]), t('Lower it if the game stutters.'), 'stack')}
      ${row('broadcast', 'tv', t('Broadcast look'), onOff('broadcast'), t('1960s black-and-white broadcast, with scanlines.'))}
      ${row('lighting', 'sparkle', t('Lighting'), seg('lighting', [{ v: 'night', label: t('Night') }, { v: 'day', label: t('Day') }]), t('Night: the hanging bulb. Day: sunlight through the window.'))}
      ${row('lang', 'globe', t('Language'), seg('lang', [{ v: 'en', label: 'English' }, { v: 'fr', label: 'Français' }]))}
      <div class="st-row st-slide" data-row="scale"><div class="st-lab">${ic('textsize')}<div><b>${esc(t('Text size'))}</b></div><output class="ui-scale-out"></output></div>
        <input type="range" class="ui-scale-range" id="stScale" min="85" max="140" step="5" aria-label="${esc(t('Text size'))}">
        <div class="st-ticks"><span>85%</span><button type="button" class="st-reset" data-reset-scale>${esc(t('Reset'))}</button><span>140%</span></div></div>
    </section>
    <section class="st-sec" data-sec="sound">
      ${slider('stVol', 'speaker', t('Volume'), 'stVolOut', 0, 100, 1)}
      ${slider('stMus', 'record', t('Record'), 'stMusOut', 0, 100, 1, t('The background record player.'))}
      ${row('mute', 'speakerOff', t('Mute everything'), onOff('mute'))}
      ${row('music', 'music', t('Record player'), onOff('music'))}
    </section>
    <section class="st-sec" data-sec="info">
      ${row('ann', 'megaphone', t('Announcer'), seg('ann', [{ v: 'off', label: t('Off') }, { v: 'less', label: t('Less') }, { v: 'normal', label: t('Normal') }, { v: 'more', label: t('More') }]), t('What the announcer plaque says: Less is money, property, jail and bankruptcy; More is every move.'), 'stack')}
      ${row('annPos', 'megaphone', t('Announcer position'), seg('annPos', [{ v: 'top', label: t('Top') }, { v: 'bottom', label: t('Bottom') }]), t('Where the plaque sits: under the top bar, or above the action bar.'))}
      ${row('sideLog', 'log', t('Side event log'), onOff('sideLog'), t('The last few events, down the left edge.'))}
      ${row('hover', 'eye', t('Hover bubbles'), onOff('hover'), t('A small card over any square you rest the mouse on.'))}
    </section>
    <section class="st-sec" data-sec="more">
      <button class="st-link" type="button" data-act="news">${ic('newspaper')}<div><b>${esc(t("What's new"))}</b><small>${esc(t('Versions, highlights and what is still being finished.'))}</small></div>${ic('chevron')}</button>
      <button class="st-link" type="button" data-act="guide">${ic('book')}<div><b>${esc(t('Cards & events'))}</b><small>${esc(t('Every card and event, explained.'))}</small></div>${ic('chevron')}</button>
    </section>
  </div>
</div>`;
  }

  // ---- state -> controls
  const val = {
    view: () => host.view(), cam: () => host.cam(), labelStyle: () => host.labelStyle(), labelsAll: () => (host.labelsAll() ? '1' : '0'),
    quality: () => host.quality(), broadcast: () => (host.broadcast() ? '1' : '0'), lighting: () => host.lighting(), lang: () => host.lang(), ann: () => host.ann(), annPos: () => host.annPos(),
    sideLog: () => (host.sideLog() ? '1' : '0'), hover: () => (host.hover() ? '1' : '0'),
    mute: () => (host.sfx.muted ? '1' : '0'), music: () => (host.sfx.music ? '1' : '0'),
  };
  function sync() {
    if (!isOpen) return;
    root.querySelectorAll('.seg').forEach(g => {
      const v = val[g.dataset.pref] ? String(val[g.dataset.pref]()) : '';
      g.querySelectorAll('button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    });
    root.querySelectorAll('.city-only').forEach(r => { r.hidden = !host.isCity() || (r.classList.contains('signs-only') && host.labelStyle() !== 'signs'); });
    const sc = $(root, '#stScale');
    if (sc && document.activeElement !== sc) sc.value = host.scale();
    root.querySelectorAll('.ui-scale-out').forEach(o => { o.textContent = host.scale() + '%'; });
    const vol = $(root, '#stVol'), mus = $(root, '#stMus'), sfx = host.sfx;
    if (vol && document.activeElement !== vol) vol.value = Math.round(sfx.volume * 100);
    if (mus && document.activeElement !== mus) mus.value = Math.round(sfx.musicVolume * 100);
    const vo = $(root, '#stVolOut'), mo = $(root, '#stMusOut');
    if (vo) vo.textContent = sfx.muted ? t('muted') : Math.round(sfx.volume * 100) + '%';
    if (mo) mo.textContent = !sfx.music ? t('off') : Math.round(sfx.musicVolume * 100) + '%';
    root.querySelectorAll('.st-tabs button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    root.querySelectorAll('.st-sec').forEach(s => { s.hidden = s.dataset.sec !== tab; });
  }

  function render() {
    root.innerHTML = html();
    sync();
  }

  function setTab(k) { tab = k; sync(); const b = $(root, '.st-body'); if (b) b.scrollTop = 0; }

  // ---- events (delegated, so re-rendering never loses a handler)
  const apply = (pref, v) => {
    switch (pref) {
      case 'view': host.setView(v); break;
      case 'cam': host.setCam(v); break;
      case 'labelStyle': host.setLabelStyle(v); break;
      case 'labelsAll': host.setLabelsAll(v === '1'); break;
      case 'quality': host.setQuality(v); break;
      case 'broadcast': host.setBroadcast(v === '1'); break;
      case 'lighting': host.setLighting(v); break;
      case 'lang': host.setLang(v); break;
      case 'ann': host.setAnn(v); break;
      case 'annPos': host.setAnnPos(v); break;
      case 'sideLog': host.setSideLog(v === '1'); break;
      case 'hover': host.setHover(v === '1'); break;
      case 'mute': if (host.sfx.muted !== (v === '1')) host.sfx.toggle(); break;
      case 'music': if (host.sfx.music !== (v === '1')) host.sfx.toggleMusic(); break;
    }
    sync();
    host.after && host.after();
  };
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return close();
    const tb = e.target.closest('.st-tabs button'); if (tb) return setTab(tb.dataset.tab);
    const sb = e.target.closest('.seg button'); if (sb) return apply(sb.parentElement.dataset.pref, sb.dataset.v);
    if (e.target.closest('[data-reset-scale]')) { host.setScale(100, true); sync(); return; }
    const a = e.target.closest('[data-act]');
    if (a) { close(); if (a.dataset.act === 'news') openNews(); else host.openGuide(); }
  });
  root.addEventListener('input', e => {
    const r = e.target;
    if (r.id === 'stScale') { host.setScale(Number(r.value), false); root.querySelectorAll('.ui-scale-out').forEach(o => { o.textContent = r.value + '%'; }); }
    else if (r.id === 'stVol') { if (host.sfx.muted) host.sfx.toggle(); host.sfx.setVolume(r.value / 100); sync(); host.after && host.after(); }
    else if (r.id === 'stMus') { if (!host.sfx.music) host.sfx.toggleMusic(); host.sfx.setMusicVolume(r.value / 100); sync(); }
  });
  root.addEventListener('change', e => {
    const r = e.target;
    if (r.id === 'stScale') host.setScale(Number(r.value), true);
    else if (r.id === 'stVol') host.sfx.ice && host.sfx.ice();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) { close(); e.stopImmediatePropagation(); } }, true);
  document.addEventListener('pointerdown', e => {
    if (isOpen && !e.target.closest('#settings .st-box, #settingsBtn')) close();
  }, true);
  onLang(() => { if (isOpen) render(); if (newsOpen()) renderNews(); });

  function open(which) {
    if (which) tab = which;
    lastFocus = document.activeElement;
    isOpen = true; render(); root.hidden = false;
    document.body.classList.add('settings-open');
    const b = $(root, '.st-tabs button.on'); b && b.focus({ preventScroll: true });
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; root.hidden = true; root.innerHTML = '';
    document.body.classList.remove('settings-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  const toggle = () => (isOpen ? close() : open());

  // ---------------------------------------------------------------- what's new
  const news = document.getElementById('news');
  let notes = null;
  const newsOpen = () => !news.hidden;
  const fmtDate = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString(curLangTag(), { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return d; } };
  const curLangTag = () => (document.documentElement.lang === 'fr' ? 'fr-FR' : 'en-GB');
  const list = (items, icon) => (items && items.length ? `<ul>${items.map(x => `<li>${ic(icon)}<span>${esc(t(x))}</span></li>`).join('')}</ul>` : '');
  function version(v, k) {
    const wip = v.status === 'in-progress';
    const ch = v.changes || {};
    const block = (cls, label, icon, items) => (items && items.length ? `<div class="nw-blk ${cls}"><h4>${esc(t(label))}</h4>${list(items, icon)}</div>` : '');
    return `<details class="nw-ver${wip ? ' wip' : ''}"${k === 0 ? ' open' : ''}>
      <summary><span class="nw-v">v${esc(v.version)}</span><span class="nw-t">${esc(t(v.title))}</span>${wip ? `<em class="nw-pill">${esc(t('In progress'))}</em>` : ''}<time>${esc(fmtDate(v.date))}</time>${ic('chevron', { cls: 'nw-chev' })}</summary>
      <div class="nw-in">
        ${v.highlights && v.highlights.length ? `<div class="nw-blk hl"><h4>${esc(t('Highlights'))}</h4>${list(v.highlights, 'star')}</div>` : ''}
        ${block('add', 'Added', 'plus', ch.added)}${block('chg', 'Changed', 'sparkle', ch.changed)}${block('fix', 'Bugs fixed', 'check', ch.fixed)}
        ${v.wip && v.wip.length ? `<div class="nw-blk wp"><h4>${esc(t('Still being finished'))}</h4>${list(v.wip, 'hourglass')}</div>` : ''}
      </div></details>`;
  }
  function renderNews() {
    news.innerHTML = `<div class="nw-scrim" data-nclose></div><div class="nw-box" role="dialog" aria-modal="true" aria-label="${esc(t("What's new"))}">
      <header class="st-head">${ic('newspaper')}<h2>${esc(t("What's new"))}</h2><button class="st-x" type="button" data-nclose aria-label="${esc(t('Close'))}">${ic('close')}</button></header>
      <div class="nw-body">${notes ? notes.map(version).join('') : `<p class="nw-empty">${esc(t('Loading…'))}</p>`}</div></div>`;
  }
  function openNews() {
    renderNews(); news.hidden = false; document.body.classList.add('settings-open');
    if (!notes) fetch('patchnotes.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(j => { notes = Array.isArray(j) ? j : []; if (!news.hidden) renderNews(); }).catch(() => { notes = []; if (!news.hidden) renderNews(); });
  }
  function closeNews() { news.hidden = true; news.innerHTML = ''; if (!isOpen) document.body.classList.remove('settings-open'); }
  news.addEventListener('click', e => { if (e.target.closest('[data-nclose]')) closeNews(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && newsOpen()) { closeNews(); e.stopImmediatePropagation(); } }, true);

  return { open, close, toggle, sync, openNews, closeNews, get isOpen() { return isOpen; } };
}
