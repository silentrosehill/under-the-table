// The event-animation layer. Watches what just happened (new log lines, new timed effects, wheel verdicts, money moving) and plays it
// where it happened: scene.fx(kind, { pos | group | positions, color }) on the squares (City and Table Mode), and a CSS animation over
// the affected player's name card in the corner panel (panelFx). Nothing here changes game state; every call is timed after the pieces
// have stopped (scene.whenIdle) and after any pop-up (card, wheel verdict, modal) has gone, so it is never hidden behind one.

import { ms as slow, speed } from './speed.js';
import { ic } from './icons.js';
import { pcGlow } from './pcolor.js';
const beat = () => Math.max(0, (speed() - 1) * 500);   // Relaxed leaves a beat between the pieces stopping and the effect starting

const MAJOR = new Set(['jail', 'bribejail', 'drunk', 'audit', 'cashrain', 'taxi', 'loan', 'warning', 'bankrupt']);
const DURATION = { gain: 1500, loss: 1000, jail: 2300, bribejail: 2600, drunk: 1900, audit: 2400, cashrain: 2600, taxi: 1900, loan: 2200, warning: 2400, bankrupt: 2800, flashgood: 1100, flashbad: 1100 };
const BUSY_SEL = ['#cardPick', '#casinoPopup', '#globalPopup', '#cardFx'];

export function createEventFx({ getS, getScene, t, sfx, splitName }) {
  let logKey = null, seenFx = null, layer = null;
  const busyUntil = {}, live = new Set();
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const S = () => getS();
  const scene = () => getScene();
  const playerBy = id => S().players.find(p => p.id === id);
  const playerIn = text => S().players.filter(p => p.name && text.includes(p.name)).sort((a, b) => b.name.length - a.name.length)[0];
  const posOf = name => { const sp = S().board.find(s => s.name === name || splitName(s.name)[0] === name); return sp ? sp.i : null; };
  const ownerOf = pos => { const st = S().props[pos]; return st ? st.owner : null; };
  const colorOf = id => { const p = playerBy(id); return p ? p.color : null; };

  // ---- timing: when the scene is idle and no pop-up is covering things
  const covered = () => { const m = document.querySelector('#modal'); return (m && !m.hidden) || BUSY_SEL.some(q => { const n = document.querySelector(q); return n && !n.hidden && n.children.length; }); };
  function later(fn, extra = 0) {
    const sc = scene();
    const go = () => {
      let tries = 0;
      const wait = () => { if (covered() && tries++ < 40) return setTimeout(wait, 200); setTimeout(fn, slow(extra) + beat()); };
      wait();
    };
    sc && sc.whenIdle ? sc.whenIdle(go) : go();
  }
  const tileFx = (kind, o) => { const sc = scene(); if (sc && sc.fx) { try { sc.fx(kind, o); } catch (e) { console.warn('fx', kind, e); } } };

  // ---- the player cards
  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div'); layer.id = 'pfxLayer'; document.body.append(layer);
    return layer;
  }
  const cardOf = pid => [...document.querySelectorAll('#hudPlayers .pcard')].find(c => c.dataset.pid === pid);
  const coins = n => Array.from({ length: n }, (_, i) => { const a = (-70 + Math.random() * 140) * Math.PI / 180, d = 40 + Math.random() * 70; return `<s style="--dx:${(Math.sin(a) * d * 1.6).toFixed(0)}px;--dy:${(-Math.cos(a) * d * 0.9 + 14).toFixed(0)}px;--w:${(i * 40).toFixed(0)}ms"></s>`; }).join('');
  const rain = (n, ch) => Array.from({ length: n }, (_, i) => `<s style="left:${(4 + Math.random() * 92).toFixed(0)}%;--w:${(Math.random() * 900).toFixed(0)}ms;--r:${(Math.random() * 60 - 30).toFixed(0)}deg">${ch}</s>`).join('');
  const markup = kind => ({
    gain: `<div class="pfx-coins">${coins(9)}</div>`,
    loss: '',
    flashgood: '', flashbad: '',
    jail: `<div class="pfx-bars">${'<i></i>'.repeat(8)}</div>`,
    bribejail: `<div class="pfx-bars">${'<i></i>'.repeat(8)}</div><span class="pfx-icon">${ic('envelope')}</span>`,
    drunk: `<span class="pfx-icon">${ic('whiskey')}</span><span class="pfx-icon b">${ic('whiskey')}</span>`,
    audit: `<b class="pfx-stamp">${t('AUDIT')}</b>`,
    cashrain: `<div class="pfx-rain">${rain(16, ic('cash'))}</div>`,
    taxi: `<span class="pfx-cab">${ic('taxi')}</span>`,
    loan: `<div class="pfx-smoke"><s></s><s></s><s></s><s></s></div><span class="pfx-icon">${ic('fedora')}</span>`,
    warning: `<span class="pfx-env">${ic('envelope')}</span>`,
    bankrupt: `<svg class="pfx-crack" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M52 0 L46 12 L56 18 L44 27 L53 40 M46 12 L30 16 M56 18 L72 14 M44 27 L28 33"/></svg><b class="pfx-stamp">${t('Bankrupt')}</b>`,
  })[kind] || '';

  function panelFx(pid, kind) {
    const card = cardOf(pid);
    if (!card || !(kind in DURATION)) return;
    const now = performance.now();
    for (const r of live) if (r.pid === pid && r.el.classList.contains('pfx-' + kind) && r.end - now > DURATION[kind] * 0.6) return;   // already playing
    if ((kind === 'gain' || kind === 'loss') && (busyUntil[pid] || 0) > now) return;   // a bigger animation owns the card right now
    if (MAJOR.has(kind)) busyUntil[pid] = now + DURATION[kind] * 0.8;
    const el = document.createElement('div');
    el.className = `pfx pfx-${kind}${reduced() ? ' calm' : ''}`;
    el.innerHTML = markup(kind);
    ensureLayer().append(el);
    const dur = DURATION[kind];
    const rec = { el, pid, end: now + dur };
    live.add(rec);
    const place = () => {
      const c = cardOf(pid);
      if (!c) return;
      const r = c.getBoundingClientRect();
      el.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
    };
    place();
    const tick = () => { if (!live.has(rec)) return; if (performance.now() >= rec.end) { live.delete(rec); el.remove(); return; } place(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    if (!reduced()) {                                         // the card itself moves: a shake for losses, a wobble when drunk, a thump for the stamp
      const sh = (frames, ms) => { try { card.animate(frames, { duration: ms, easing: 'ease-out' }); } catch {} };
      if (kind === 'loss' || kind === 'flashbad') sh([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }], 420);
      if (kind === 'drunk') sh([{ transform: 'rotate(0)', filter: 'blur(0)' }, { transform: 'rotate(-2.2deg)', filter: 'blur(1.6px)' }, { transform: 'rotate(2deg)', filter: 'blur(1.2px)' }, { transform: 'rotate(-1.4deg)', filter: 'blur(1.6px)' }, { transform: 'rotate(1deg)', filter: 'blur(.8px)' }, { transform: 'rotate(0)', filter: 'blur(0)' }], 1700);
      if (kind === 'audit' || kind === 'bankrupt') sh([{ transform: 'scale(1)' }, { transform: 'scale(.97)', offset: .22 }, { transform: 'scale(1)' }], 520);
      if (kind === 'jail' || kind === 'bribejail') sh([{ transform: 'translateY(0)' }, { transform: 'translateY(3px)', offset: .3 }, { transform: 'translateY(0)' }], 500);
    }
  }

  // ---- money moving: a gold pulse and coins for a gain, a red flash and a shake for a loss
  function money(pid, d) { if (d > 0) panelFx(pid, 'gain'); else if (d < 0) panelFx(pid, 'loss'); }

  // ---- timed effects that appeared on the board (card plays, global results, mayor's gift …)
  function effectFx(e) {
    const owner = e.owner || (e.pos != null ? ownerOf(e.pos) : null);
    if (e.kind === 'shootout-win' || e.kind === 'shootout-loss') {
      later(() => { tileFx(e.kind, { pos: e.pos }); sfx.casinoEvent && sfx.casinoEvent('gang'); const o = ownerOf(e.pos); if (o) panelFx(o, e.kind === 'shootout-win' ? 'flashgood' : 'flashbad'); });
    } else if (e.kind === 'squatters') {
      later(() => { tileFx('squatters', { pos: e.pos }); const o = ownerOf(e.pos); if (o) panelFx(o, 'flashbad'); });
    } else if (e.kind === 'gift') {
      later(() => { tileFx('gift', { pos: e.pos }); sfx.casinoEvent && sfx.casinoEvent('mayor'); if (owner) panelFx(owner, 'flashgood'); });
    } else if (e.kind === 'crime') {
      later(() => { tileFx('crime', e.group ? { group: e.group } : { positions: S().board.filter(sp => sp.price && ownerOf(sp.i) === e.owner).map(sp => sp.i) }); sfx.casinoEvent && sfx.casinoEvent('gang'); });
    } else if (e.kind === 'police' || e.kind === 'mayor' || e.kind === 'gang') {
      later(() => { tileFx(e.kind, e.group ? { group: e.group } : { pos: e.pos }); sfx.casinoEvent && sfx.casinoEvent(e.kind === 'mayor' ? 'mayor' : e.kind); });
    }
  }

  // ---- log lines
  function line(text) {
    let m;
    if ((m = /^🏚 The gang wrecked \d+ level\(s\) on (.+) \(now level/u.exec(text))) {
      const pos = posOf(m[1]); if (pos == null) return;
      const o = ownerOf(pos);
      later(() => { tileFx('wreck', { pos }); sfx.rumble && sfx.rumble(); if (o) panelFx(o, 'loss'); });
    } else if ((m = /^🧹 .* evicted the squatters from (.+) for /u.exec(text))) {
      const pos = posOf(m[1]); if (pos != null) later(() => tileFx('evict', { pos }));
    } else if ((m = /^(.+) bought out (.+) from (.+) for /.exec(text))) {
      const pos = posOf(m[2]), b = S().players.find(p => p.name === m[1]);
      if (pos != null) later(() => { tileFx('buyout', { pos, color: b ? pcGlow(b.color) : null }); if (b) panelFx(b.id, 'loss'); const v = S().players.find(p => p.name === m[3]); if (v) panelFx(v.id, 'gain'); });
    } else if (/ bribed the police — (.+) is hauled off/u.test(text)) {
      const p = playerIn(text.replace(/^.*bribed the police — /u, '')); if (p) later(() => panelFx(p.id, 'bribejail'));
    } else if ((m = /^(.+) was sent to /.exec(text))) {
      const p = S().players.find(q => q.name === m[1]); if (p) later(() => panelFx(p.id, 'jail'));
    } else if ((m = /^🧾 Tax audit! (.+) pays/u.exec(text))) {
      const p = S().players.find(q => q.name === m[1]); if (p) later(() => panelFx(p.id, 'audit'));
    } else if (/^💼 A shady billionaire /u.test(text)) {
      const p = playerIn(text); if (p) later(() => panelFx(p.id, 'cashrain'));
    } else if ((m = /^🚕 (.+) takes a cab/u.exec(text))) {
      const p = S().players.find(q => q.name === m[1]); if (p) later(() => panelFx(p.id, 'taxi'));
    } else if ((m = /^🎩 (.+) borrowed /u.exec(text))) {
      const p = S().players.find(q => q.name === m[1]); if (p) later(() => panelFx(p.id, 'loan'));
    } else if (/^✉ A note slides under /u.test(text)) {
      const p = playerIn(text); if (p) later(() => panelFx(p.id, 'warning'));
    } else if ((m = /^(.+) went bankrupt!/.exec(text))) {
      const p = S().players.find(q => q.name === m[1]); if (p) later(() => panelFx(p.id, 'bankrupt'));
    } else if (/^🥃 One Too Many: /u.test(text) || /^(?:🎰|💵|🎉) /u.test(text)) {
      // casino / global verdicts are played by casino() / global() once the wheel has stopped
    }
  }

  // ---- wheel verdicts (called by app.js when the verdict pop-up appears)
  function casino(c) {
    const tg = c.target || {};
    switch (c.key) {
      case 'bombing': tileFx('bomb', { pos: tg.pos }); if (tg.player) setTimeout(() => panelFx(tg.player, 'flashbad'), slow(400)); break;
      case 'police': tileFx('police', { pos: tg.pos }); if (tg.player) panelFx(tg.player, 'flashbad'); break;
      case 'mayor': tileFx('mayor', { pos: tg.pos }); if (tg.player) panelFx(tg.player, 'flashgood'); break;
      case 'gang': tileFx('gang', { group: tg.group }); if (tg.player) panelFx(tg.player, 'flashbad'); break;
      case 'whim': if (tg.player) panelFx(tg.player, 'cashrain'); break;
      case 'boom': S().players.filter(p => !p.bankrupt).forEach(p => panelFx(p.id, 'cashrain')); break;
      case 'onetoomany': if (tg.player) panelFx(tg.player, 'drunk'); break;
    }
  }
  function global(gl) {
    const near = (S().effects || []).filter(e => Math.abs(e.id - gl.id) < 2500);
    for (const e of near) {
      if (e.kind === 'crime') tileFx('crime', e.group ? { group: e.group } : { positions: S().board.filter(sp => sp.price && ownerOf(sp.i) === e.owner).map(sp => sp.i) });
      else tileFx(e.kind, e.group ? { group: e.group } : { pos: e.pos });
    }
    for (const r of gl.results || []) {
      const txt = r.text || '';
      if (gl.key === 'whim' || gl.key === 'boom') panelFx(r.player, 'cashrain');
      else if (gl.key === 'audit') { if (/^-/.test(txt)) panelFx(r.player, 'audit'); }
      else if (gl.key === 'onetoomany') panelFx(r.player, 'drunk');
      else if (gl.key === 'gangwar') { const sp = S().board.find(s => s.name && txt.startsWith(s.name)); if (sp) tileFx('wreck', { pos: sp.i }); panelFx(r.player, 'flashbad'); }
      else if (gl.key === 'protection') panelFx(r.player, 'flashgood');
      else if (gl.key === 'police' || gl.key === 'squatters' || gl.key === 'gang' || gl.key === 'crime') panelFx(r.player, 'flashbad');
      else if (gl.key === 'mayor') panelFx(r.player, 'flashgood');
    }
  }
  function mafiaCollect(e) {
    if (e.pos != null) tileFx('seized', { pos: e.pos, label: t('SEIZED') });
    panelFx(e.player, e.out ? 'bankrupt' : 'loss');
  }

  // ---- called after every state sync
  function process() {
    const s = S();
    if (!s || s.phase !== 'playing') { logKey = null; seenFx = null; return; }
    const keyOf = l => l.t + '|' + l.text;
    const ids = new Set((s.effects || []).map(e => e.id));
    if (logKey === null || seenFx === null) { logKey = s.log.length ? keyOf(s.log[s.log.length - 1]) : ''; seenFx = ids; return; }   // first sync: don't replay history
    let from = 0;
    for (let k = s.log.length - 1; k >= 0; k--) if (keyOf(s.log[k]) === logKey) { from = k + 1; break; }
    const wheelIds = [s.lastCasino && s.lastCasino.mode === 'event' && !s.lastCasino.stale ? s.lastCasino.id : null, s.lastGlobal ? s.lastGlobal.id : null].filter(x => x != null);
    const claimed = n => wheelIds.some(w => Math.abs(w - n) < 2500);
    for (const l of s.log.slice(from)) { if (!l.chat && !claimed(l.t)) { try { line(l.text); } catch (e) { console.warn('fx line', e); } } }
    for (const e of s.effects || []) { if (!seenFx.has(e.id) && !claimed(e.id)) { try { effectFx(e); } catch (er) { console.warn('fx effect', er); } } }
    if (s.log.length) logKey = keyOf(s.log[s.log.length - 1]);
    seenFx = ids;
  }

  return { process, panelFx, money, casino, global, mafiaCollect };
}
