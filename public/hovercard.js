// The hover bubble shared by City Mode and Table Mode: rest the mouse on a square for a beat and a small noir card
// pops up above it (name, owner, level, current rent, active effects, or what a special square does).
// Plain HTML over the canvas, anchored to the square every frame; hidden on mouse out and while the camera is dragged.
import * as THREE from 'three';
import { t } from './i18n.js';
import { fmtMoney } from './money.js';
import { effectMult, effectTags, railRent, utilPerPip } from './effects.js';
import { deEmoji } from './icons.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DWELL = 150;
const hoverOn = () => { try { return localStorage.getItem('mono.hover') !== '0'; } catch { return true; } };   // settings: hover bubbles on / off

// the rent an owned property or station asks right now (set bonus, round boom/crash and timed effects included): the same as the City labels
export function tileRent(S, board, sp, st, owner) {
  const ev = S.event && S.event.round === S.round ? S.event.key : null;
  const mult = (ev === 'boom' ? 1.5 : ev === 'crash' ? 0.5 : 1) * effectMult(S, sp);
  if (sp.type === 'property') {
    const full = board.filter(s => s.group === sp.group).every(s => S.props[s.i] && S.props[s.i].owner === owner.id);
    const base = sp.rent[st.level || 1];
    return Math.round((full ? Math.round(base * 1.5) : base) * mult);
  }
  return Math.round(railRent(board.filter(s => s.type === 'railroad' && S.props[s.i] && S.props[s.i].owner === owner.id).length) * mult);
}

// what the square says about itself (squares without a deed)
function note(S, sp, cur) {
  switch (sp.type) {
    case 'go': return t('Collect {amount} every time you pass.', { amount: fmtMoney(200000, cur) });
    case 'jail': return t('Just visiting… unless you got sent here.');
    case 'gotojail': return t('Go directly to {jail}.', { jail: S.board[10].name });
    case 'chance': case 'chest': return t('Draw a card.');
    case 'casino': return t('Spin the wheel when you land here.');
    case 'taxi': return t('Call a cab: ride to any square next turn.');
    case 'tax': return `${t('Pay')} ${fmtMoney(sp.amount, cur)}`;
    default: return '';
  }
}

export function hoverData(S, sp, cur = '$') {
  const board = S.board || [], st = S.props && S.props[sp.i], owner = st && S.players.find(p => p.id === st.owner);
  const k = String(sp.name).lastIndexOf(',');
  const d = { name: k > 0 ? sp.name.slice(0, k).trim() : sp.name, city: k > 0 ? sp.name.slice(k + 1).trim() : '', accent: sp.color || null, owner: null, sale: '', level: '', rent: '', mortgaged: false, effects: effectTags(S, sp), note: '' };
  if (sp.price) {
    if (!owner) d.sale = `${t('For sale')} · ${fmtMoney(sp.price, cur)}`;
    else {
      d.owner = { name: owner.name, color: owner.color };
      d.mortgaged = !!st.mortgaged;
      if (sp.type === 'property') d.level = st.level >= 5 ? t('MAX') : t('Lv {n}', { n: st.level || 1 });
      if (!d.mortgaged) d.rent = sp.type === 'utility'
        ? t('Rent here: {amount} × the dice', { amount: fmtMoney(utilPerPip(board.filter(s => s.type === 'utility' && S.props[s.i] && S.props[s.i].owner === owner.id).length) * effectMult(S, sp), cur) })
        : `${t('Rent')} ${fmtMoney(tileRent(S, board, sp, st, owner), cur)}`;
    }
  } else d.note = note(S, sp, cur);
  return d;
}

export function createHoverCard(container) {
  const el = document.createElement('div');
  el.className = 'hc';
  el.setAttribute('aria-hidden', 'true');
  container.append(el);
  let cur = -2, timer = 0, shown = false, shownKey = null, getFn = null, stampFn = null, w = 0, h = 0;
  const v = new THREE.Vector3();

  function render(d) {
    el.innerHTML = `<div class="hc-card"><span class="hc-acc" style="background:${d.accent ? esc(d.accent) : 'transparent'}"></span>`
      + `<div class="hc-head"><b>${esc(d.name)}</b>${d.city ? `<small>${esc(d.city)}</small>` : ''}</div>`
      + (d.owner ? `<div class="hc-row"><i class="hc-dot" style="background:${esc(d.owner.color)}"></i>${esc(d.owner.name)}${d.mortgaged ? ` · <em>${esc(t('Mortgaged'))}</em>` : ''}</div>` : '')
      + (d.sale ? `<div class="hc-row sale">${esc(d.sale)}</div>` : '')
      + (d.level || d.rent ? `<div class="hc-row">${[d.level, d.rent].filter(Boolean).map(esc).join(' · ')}</div>` : '')
      + (d.note ? `<div class="hc-row note">${esc(d.note)}</div>` : '')
      + d.effects.map(e => `<div class="hc-fx ${e.tone}">${deEmoji(esc(e.text))}</div>`).join('')
      + '</div>';
    w = h = 0;
  }

  return {
    // the pointer is over square i (-1: none). `get` builds the data when the dwell is up.
    request(i, get, stampOf) {
      if (i === cur) return;
      this.hide();
      cur = i;
      if (i < 0 || !hoverOn()) return;
      timer = setTimeout(() => { timer = 0; const d = get(i); if (!d) return; render(d); shown = true; shownKey = stampOf ? stampOf() : null; getFn = get; stampFn = stampOf; el.classList.add('on'); }, DWELL);
    },
    hide() { clearTimeout(timer); timer = 0; cur = -2; shown = false; el.classList.remove('on'); },
    get square() { return shown ? cur : -1; },
    // each frame: follow the square on screen, staying inside the view. `anchor(i, out)` gives the world point above it; the stamp (see request) changes when the game state does.
    update(camera, anchor) {
      if (!shown) return;
      const stamp = stampFn && stampFn();
      if (stamp !== shownKey) { shownKey = stamp; const d = getFn(cur); if (d) render(d); }
      anchor(cur, v);
      v.project(camera);
      const W = container.clientWidth, H = container.clientHeight;
      if (v.z > 1) { el.classList.remove('on'); return; }
      if (!w) { const c = el.firstChild; w = c ? c.offsetWidth : 0; h = c ? c.offsetHeight : 0; }
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      const x = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, sx)), below = sy - h - 22 < 62;       // no room above (the top bar): hang it below instead
      const y = below ? Math.min(H - h - 8, sy + 22) : sy - 16;
      el.classList.toggle('below', below);
      el.classList.add('on');
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    },
    dispose() { clearTimeout(timer); el.remove(); },
  };
}
