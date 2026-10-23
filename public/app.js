// Under The Table client (3D)
import { createScene } from './scene3d.js';
import { moodForRound } from './palette.js';
import { sfx } from './sfx.js';
import { splitName, slug } from './board.js';
import { spinEventWheel } from './eventWheel.js';
import { fmtMoney } from './money.js';
import { t, tr, lang, setLang, applyStatic, chaosName, chaosDesc, cardText, casinoText, effectLabel, globalTitle, globalText } from './i18n.js';
import { effectMult, effectTags, activeEffects, EFFECT_ICON, railRent, utilPerPip } from './effects.js';
import { createEventFx } from './eventfx.js';
import { ms as slow, setSpeed, speed } from './speed.js';
import { initInfo, infoAttr, tipAttr, openGuide, closeGuide, guideOpen } from './info.js';
import { ic, emo, deEmoji, keyOfEmoji, TOKEN_ICON, TONE, stripEmoji } from './icons.js';
import { createSettings } from './settings.js';

const TOKEN_EMOJI = { car: '🚗', hat: '🎩', dog: '🐕', glass: '🥃', ship: '🚗', dino: '🐕', rocket: '🚗', cat: '🐕', crown: '🎩' };   // (the last five are retired pieces, shown as the one they became)
const MAP_INFO = {
  underworld: ['🕴️', 'Infamous districts of New York, Paris, Tokyo, London and more'],
  random: ['🎲', 'A brand-new random board every game'],
  classic: ['🏙️', 'The original streets & railroads'],
  world: ['✈️', 'Jet-set across famous cities'],
  galaxy: ['🪐', 'Colonize planets, warp between gates'],
  candy: ['🍭', 'A sweet, sugary kingdom'],
};

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let S = null;
let secret = safeGet('mono.secret');
let scene = null, sceneKey = null, sceneGid = null;
const evfx = createEventFx({ getS: () => S, getScene: () => scene, t, sfx, splitName });   // event animations on squares and player cards (eventfx.js)
let lastRollId = null, lastTurnKey = null, lastLogN = 0, lastEventSeq = null, podiumShown = false;
let selectedPos = null;
const moneyShown = {}, moneyTarget = {}, moneyDelta = {};

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }

// ---------------------------------------------------------------- networking

// Long-polling loop: the server answers as soon as the game changes (or after ~25s).
// To keep answers small we tell the server what we already hold (game id, last log line / move / event, static-data and board versions);
// it then leaves those out or sends only what is new, and mergeState() rebuilds the complete state object the rest of the app expects.
let pollGen = 0;
const STATIC_KEYS = ['maps', 'tokens', 'colors', 'maxPlayers', 'teams', 'emotes'];
const CAPS = { log: 150, moves: 40, events: 30 };
function syncQuery() {
  if (!S) return '';
  const last = S.log && S.log.length ? S.log[S.log.length - 1].n : 0;
  return `&g=${S.gid}&l=${last || 0}&m=${S.moveSeq || 0}&e=${S.eventSeq || 0}&sv=${S.sv || ''}&bv=${S.bv}`;
}
function mergeState(next, prev) {
  if (prev) {
    for (const k of STATIC_KEYS) if (next[k] === undefined) next[k] = prev[k];
    if (next.sv === undefined) next.sv = prev.sv;
    if (next.board === undefined) { next.board = prev.board; next.meta = prev.meta; }
    if (next.dl) for (const k of ['log', 'moves', 'events']) next[k] = (prev[k] || []).concat(next[k] || []).slice(-CAPS[k]);
  }
  return next;
}
async function connect() {
  const gen = ++pollGen;
  let v = -1;
  while (gen === pollGen) {
    try {
      const r = await fetch(`/poll?v=${v}${syncQuery()}`, { cache: 'no-store', headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      if (gen !== pollGen) return;
      v = data.v;
      S = mergeState(data.state, S);
      if (secret && !S.you) { secret = null; safeSet('mono.secret', null); connect(); return; }
      render();
    } catch {
      await new Promise(res => setTimeout(res, 1500)); // server restarting or network blip
    }
  }
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { toast(data.error || t('Something went wrong')); throw new Error(data.error); }
  return data;
}
const act = (type, extra = {}) => post('/api/action', { secret, type, ...extra }).catch(() => {});

let toastTimer;
function toast(msg) {
  const box = $('#toast'); box.textContent = msg; box.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (box.hidden = true), 3200);
}

// ---------------------------------------------------------------- helpers

const me = () => S && S.players.find(p => p.id === S.you);
const pById = id => S.players.find(p => p.id === id);
const cur = () => S.players[S.turn];
// the host starts the next game; when the host has left, any other player may (mirrors the newGame rule in server.js)
const canNewGame = () => { if (!S.you) return false; if (S.hostId === S.you) return true; const h = pById(S.hostId); return !!h && !h.bot && !h.connected; };
const meta = () => S.meta || S.maps[S.settings.map];
const cash = n => fmtMoney(n, meta().currency);
const JAIL_FINE = 50000;
const fullSet = (sp, ownerId) => S.board.filter(s => s.group === sp.group).every(s => S.props[s.i] && S.props[s.i].owner === ownerId);
const rentAt = (sp, level, ownerId) => { const b = sp.rent[level]; return fullSet(sp, ownerId) ? Math.round(b * 1.5) : b; };
// what a rent costs right now, with this round's Rent Boom / Market Crash
const rentMult = () => { const ev = S.event && S.event.round === S.round ? S.event.key : null; return ev === 'boom' ? 1.5 : ev === 'crash' ? 0.5 : 1; };
const levelName = n => (n >= 5 ? t('Max') : t('Level {n}', { n }));
const needMore = (p, cost) => t('Need {amount} more', { amount: cash(cost - p.money) });

// the three choices a player can be offered on a tile: buy (at a level), upgrade their own, buy out a rival's
function buyOptions(sp, p) {
  return (sp.type === 'property' ? [1, 2, 3] : [1]).map(level => {
    const cost = sp.price + (level - 1) * (sp.houseCost || 0);
    const label = sp.type !== 'property' ? t('Buy for {price}', { price: cash(cost) })
      : level === 1 ? t('Buy · Level 1 — {price}', { price: cash(cost) }) : t('Level {n} — {price}', { n: level, price: cash(cost) });
    return { arg: { level }, label, ok: p.money >= cost, reason: p.money >= cost ? '' : needMore(p, cost) };
  });
}
function upgradeOptions(sp, st, p) {
  const out = [];
  for (let to = st.level + 1; to <= 5; to++) {
    const cost = (to - st.level) * sp.houseCost;
    const reason = to === 5 && st.level < 4 ? t('Reach level 4 first') : p.money < cost ? needMore(p, cost) : '';
    out.push({ arg: { to }, label: t('{lvl} — {cost} · rent {rent}', { lvl: levelName(to), cost: cash(cost), rent: cash(Math.round(rentAt(sp, to, p.id) * effectMult(S, sp))) }), ok: !reason, reason });
  }
  return out;
}
function buyoutOption(sp, p) {
  const owner = pById(S.props[sp.i].owner), cost = S.pending.cost;
  return { label: t('Buy out {tile} from {owner} — {cost}', { tile: splitName(sp.name)[0], owner: owner.name, cost: cash(cost) }), ok: p.money >= cost, reason: p.money >= cost ? '' : needMore(p, cost) };
}
const myTurn = () => S.phase === 'playing' && cur() && cur().id === S.you;
const badge = p => `<span class="token-badge" style="--pc:${p.color}" ${tipAttr(p.name)}><i>${ic(TOKEN_ICON[p.token] || 'user')}</i></span>`;

// graphics quality (the scene has one fixed look: the bulb)
function currentMood() { return 'night'; }
function applyTheme() { document.body.dataset.theme = 'noir'; }
const quality = () => safeGet('mono.quality') || 'auto';
function setQuality(q) {
  safeSet('mono.quality', q);
  if (scene) scene.setQuality(q);
  toast(t('Graphics: {q}', { q: t(q.charAt(0).toUpperCase() + q.slice(1)) }));
}
applyStatic();
initInfo();

// ---- per-viewer text size (85%-140%), applied through --ui-scale on the root; every font size in style.css multiplies it.
// Dragging only writes the CSS variable (once per frame) and the readouts; the panels are re-measured once, shortly after the
// last change, and the value is saved when the drag ends. (The old slider sat in the right-aligned top bar, sized in em: it moved
// under the pointer as the text grew and its label vanished at 115%, so the thumb jumped around and fed itself new values.)
const snapScale = pct => Math.max(85, Math.min(140, Math.round(Number(pct) / 5) * 5 || 100));
let scalePct = snapScale(safeGet('mono.uiScale') || 100), scaleRaf = 0, scaleTimer = 0;
function paintScale(commit) {
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(scalePct / 100));
  if (commit) root.style.setProperty('--st-scale', String(scalePct / 100));     // the settings panel itself only grows once you let go
  root.classList.toggle('ui-big', scalePct >= 115);
  document.querySelectorAll('.ui-scale-range').forEach(r => { if (r !== document.activeElement) r.value = scalePct; });
  document.querySelectorAll('.ui-scale-out').forEach(o => { o.textContent = scalePct + '%'; });
}
function setUiScale(pct, commit) {
  scalePct = snapScale(pct);
  if (!scaleRaf) scaleRaf = requestAnimationFrame(() => { scaleRaf = 0; paintScale(false); });
  clearTimeout(scaleTimer);
  scaleTimer = setTimeout(() => {                                     // debounced re-layout of everything that measures itself
    paintScale(true);
    if (typeof placeEventLog === 'function') placeEventLog();
    if (S && S.phase !== 'lobby') { renderHand(); }
  }, commit ? 0 : 160);
  if (commit) safeSet('mono.uiScale', String(scalePct));
}
paintScale(true);
document.querySelectorAll('.ui-scale-range').forEach(r => { r.oninput = () => setUiScale(r.value, false); r.onchange = () => setUiScale(r.value, true); });

// ---- icons: every [data-ic] element gets its SVG; icon-only buttons get their accessible name from the info text
function hydrateIcons(rootEl = document) {
  rootEl.querySelectorAll('[data-ic]:not([data-ic-done])').forEach(n => { n.dataset.icDone = '1'; n.insertAdjacentHTML('afterbegin', ic(n.dataset.ic)); });
}
function labelTools() {
  document.querySelectorAll('.tool[data-tipinfo], .pop-x').forEach(b => {
    const k = b.dataset.tipinfo;
    b.setAttribute('aria-label', b.classList.contains('pop-x') ? t('Close') : t(INFO_TITLE[k] || k));
  });
}
const INFO_TITLE = { 'tool-reset': 'Camera', 'tool-emote': 'Reactions', 'tool-drawer': 'Log & chat', 'tool-mute': 'Volume', 'tool-sound': 'Volume', 'tool-quit': 'Quit', 'tool-settings': 'Settings' };
hydrateIcons();
labelTools();

// ---- the card & event guide (lobby button, drawer button)
const openGuideNow = () => openGuide({ cash: n => { try { return cash(n); } catch { return String(n); } }, settings: (S && S.settings) || {} });
$('#guideBtn').onclick = $('#guideBtn2').onclick = () => { settings.close(); openGuideNow(); };
$('#newsBtn').onclick = () => settings.openNews();

// short typed captions ("Your move.") and, for chaos events, a newspaper headline
function flash(text, cls = 'caption', kicker = '') {
  const f = $('#flash');
  f.className = ''; void f.offsetWidth;
  f.innerHTML = kicker ? `<small>${esc(kicker)}</small><span>${esc(text)}</span>` : esc(text);
  f.className = 'show ' + cls;
}

// ---------------------------------------------------------------- render root

// A new game on the same table (lobby again, or Start pressed): forget everything that belonged to the last one.
let renderedGid = null;
function resetForNewGame() {
  lastRollId = null; lastTurnKey = null; lastLogN = 0; feedKey = ''; lastEventSeq = null; podiumShown = false; selectedPos = null;
  for (const m of [moneyShown, moneyTarget, moneyDelta]) for (const k of Object.keys(m)) delete m[k];
  seenHand.clear(); handKey = null; pick = null; turnCard = null;
  lastBribeKey = lastGiftKey = lastCasinoId = lastGlobalId = playKey = evKey = null;
  playQueue = []; evLines = []; seenTrades.clear();
  if (modalKind) closeModal();
}

function render() {
  setSpeed(S.settings && S.settings.speedMult);
  document.documentElement.style.setProperty('--spd', String(speed()));   // CSS animation durations follow the game speed
  if (S.gid !== renderedGid) { if (renderedGid !== null) resetForNewGame(); renderedGid = S.gid; }
  applyTheme();
  const joined = !!S.you;
  const showJoin = !joined && S.phase === 'lobby';
  $('#joinScreen').hidden = !showJoin;
  $('#lobbyScreen').hidden = !(joined && S.phase === 'lobby');
  $('#gameScreen').hidden = S.phase === 'lobby';
  document.body.classList.toggle('in-game', S.phase !== 'lobby');
  if (showJoin) renderJoin();
  else if (S.phase === 'lobby') renderLobby();
  else renderGame();
}

// ---------------------------------------------------------------- join

function renderJoin() {
  $('#joinPlayers').innerHTML = S.players.map(p => badge(p)).join('');
  const full = S.players.length >= S.maxPlayers;
  $('#joinMsg').textContent = full ? t('This game is full.') : t('{n}/{max} players waiting', { n: S.players.length, max: S.maxPlayers });
  $('#joinForm button').disabled = full;
}
$('#nameInput').value = safeGet('mono.name') || '';
$('#joinForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('#nameInput').value.trim();
  safeSet('mono.name', name);
  try {
    const { secret: s } = await post('/api/join', { name });
    secret = s; safeSet('mono.secret', s); connect();
  } catch {}
};

// ---------------------------------------------------------------- lobby

const teamsMode = () => S.settings.mode === 'teams';
const teamTag = p => (teamsMode() && S.teams ? `<span class="team-dot" style="background:${S.teams[p.team].color}"${tipAttr(S.teams[p.team].name)}></span>` : '');

function lobbyPlayerRow(p, isHost) {
  return `<div class="lp">${badge(p)}<span class="name">${esc(p.name)}</span>
      ${p.bot ? `<span class="tag bot">${t('BOT')}</span>` : ''}${p.id === S.hostId ? `<span class="tag">${t('HOST')}</span>` : ''}${p.id === S.you ? `<span class="tag">${t('YOU')}</span>` : ''}
      ${!p.connected ? `<span class="tag">${t('offline')}</span>` : ''}
      ${isHost && p.id !== S.you ? `<button class="btn small ghost icon-btn" data-kick="${p.id}"${tipAttr(t('Remove'))} aria-label="${esc(t('Remove'))}">${ic('close')}</button>` : ''}
    </div>`;
}

function renderLobby() {
  const isHost = S.hostId === S.you;
  const my = me();
  const teams = teamsMode();
  $('#playerCount').textContent = `${S.players.length}/${S.maxPlayers}`;

  document.querySelectorAll('#modeSwitch button').forEach(b => {
    b.classList.toggle('sel', b.dataset.mode === S.settings.mode);
    b.disabled = !isHost;
    b.onclick = () => act('settings', { mode: b.dataset.mode });
  });

  const lp = $('#lobbyPlayers');
  if (teams) {
    lp.innerHTML = [0, 1].map(k => {
      const team = S.teams[k], members = S.players.filter(p => p.team === k);
      const canJoin = my.team !== k && members.length < 2;
      return `<div class="team-box" style="--tc:${team.color}">
        <div class="team-head"><span>${esc(team.name)}</span>${canJoin ? `<button class="btn small" data-team="${k}">${t('Join')}</button>` : ''}</div>
        ${members.map(p => lobbyPlayerRow(p, isHost)).join('') || `<p class="muted small">${t('Empty seat')}</p>`}
        ${members.length === 1 ? `<p class="muted small">${t('1 seat left')}</p>` : ''}
      </div>`;
    }).join('');
    lp.querySelectorAll('[data-team]').forEach(b => b.onclick = () => act('profile', { team: Number(b.dataset.team) }));
  } else {
    lp.innerHTML = S.players.map(p => lobbyPlayerRow(p, isHost)).join('');
  }
  lp.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => act('kick', { playerId: b.dataset.kick }));
  $('#addBotBtn').hidden = !isHost || S.players.length >= S.maxPlayers;
  $('#shuffleBtn').hidden = !isHost || !teams;

  const tp = $('#tokenPicker'); tp.innerHTML = '';
  for (const tok of S.tokens) {
    const taken = S.players.some(p => p.token === tok && p.id !== S.you);
    const b = el('button', `pick${my.token === tok ? ' sel' : ''}${taken ? ' taken' : ''}`, ic(TOKEN_ICON[tok] || 'user'));
    b.dataset.tip = tok; b.setAttribute('aria-label', tok); b.disabled = taken;
    b.onclick = () => act('profile', { token: tok });
    tp.append(b);
  }
  const cp = $('#colorPicker'); cp.innerHTML = '';
  for (const c of S.colors) {
    const taken = S.players.some(p => p.color === c && p.id !== S.you);
    const b = el('button', `pick swatch${my.color === c ? ' sel' : ''}${taken ? ' taken' : ''}`);
    b.style.background = c; b.disabled = taken;
    b.onclick = () => act('profile', { color: c });
    cp.append(b);
  }

  const mp = $('#mapPicker'); mp.innerHTML = '';
  const order = k => (k === 'underworld' ? 0 : k === 'random' ? 1 : 2);
  const keys = Object.keys(S.maps).sort((a, b) => order(a) - order(b));
  for (const k of keys) {
    const m = S.maps[k], [icon, desc] = MAP_INFO[k] || ['🗺️', ''];
    const b = el('button', `map-opt${S.settings.map === k ? ' sel' : ''}${k === 'random' ? ' random' : ''}`, `<b>${esc(m.title)}</b><small>${t(desc)}</small>`);
    b.disabled = !isHost;
    b.onclick = () => act('settings', { map: k });
    mp.append(b);
  }

  $('#teamSettings').hidden = !teams;
  const slider = $('#teamTax');
  if (document.activeElement !== slider) slider.value = S.settings.teamTax;
  slider.disabled = !isHost;
  showTaxExample(Number(slider.value));
  $('#teamRent').value = S.settings.teamRent;
  $('#teamRent').disabled = !isHost;

  $('#startMoney').value = String(S.settings.startMoney);
  $('#maxRounds').value = String(S.settings.maxRounds || 0);
  $('#gameSpeed').value = S.settings.speed || 'relaxed';
  const ge = $('#globalEvery');
  if (!ge.options.length) for (let n = 0; n <= 10; n++) ge.append(new Option(n === 0 ? t('Off') : n === 1 ? t('every round') : t('every {n} rounds', { n }), String(n)));
  ge.value = String(S.settings.globalEvery == null ? 5 : S.settings.globalEvery);
  $('#events').checked = S.settings.events;
  $('#jackpot').checked = S.settings.jackpot;
  for (const id of ['#startMoney', '#maxRounds', '#gameSpeed', '#globalEvery', '#events', '#jackpot', '#mafia']) $(id).disabled = !isHost;
  $('#mafia').checked = !!S.settings.mafia;

  const teamsReady = !teams || (S.players.length === 4 && S.players.filter(p => p.team === 0).length === 2);
  $('#startBtn').hidden = !isHost;
  $('#startBtn').disabled = S.players.length < 2 || !teamsReady;
  const inv = $('#invite');
  if (S.inviteUrl) {
    inv.innerHTML = `<h3>${t('Invite friends')}</h3><div class="invite-row"><input class="modal-input" readonly value="${esc(S.inviteUrl)}"><button class="btn small">${t('Copy')}</button></div>`;
    inv.querySelector('button').onclick = () => navigator.clipboard.writeText(S.inviteUrl).then(() => toast(t('Link copied.')), () => inv.querySelector('input').select());
  } else {
    inv.innerHTML = isHost && ['localhost', '127.0.0.1'].includes(location.hostname)
      ? `<p class="muted">${t('Friends at home? Restart the server with {cmd} to get a link.', { cmd: '<code>node server.js --online</code>' })}</p>` : '';
  }
  $('#hostNote').textContent = !isHost
    ? t('Waiting for {name} to start the game.', { name: pById(S.hostId)?.name || t('the host') })
    : S.players.length < 2 ? t('Invite a friend or add a bot to start.')
    : !teamsReady ? t('2v2 needs 4 players, 2 per team. Fill empty seats with bots!')
    : t('Everyone ready? Start when you like.');
}

const range = (a, b, step) => { const o = []; for (let n = a; n <= b; n += step) o.push(n); return o; };
function fillSelect(sel, values, label, cur) {
  if (sel.options.length !== values.length) { sel.innerHTML = ''; values.forEach(v => sel.append(new Option('', String(v)))); }
  values.forEach((v, k) => { sel.options[k].textContent = label(v); });
  if (cur != null && document.activeElement !== sel) sel.value = String(cur);
}

function showTaxExample(tax) {
  $('#teamTaxLabel').textContent = tax + '%';
  const cur = (S && S.maps[S.settings.map].currency) || '$';
  $('#teamTaxExample').textContent = t('Send {a} → your teammate gets {b}. {rest}', { a: fmtMoney(100000, cur), b: fmtMoney(100000 * (1 - tax / 100), cur), rest: t(tax ? 'The rest goes to the bank.' : 'No fee!') });
}
$('#teamTax').oninput = e => showTaxExample(Number(e.target.value));
$('#teamTax').onchange = e => act('settings', { teamTax: Number(e.target.value) });
$('#teamRent').onchange = e => act('settings', { teamRent: e.target.value });
$('#maxRounds').onchange = e => act('settings', { maxRounds: Number(e.target.value) });
$('#gameSpeed').onchange = e => act('settings', { speed: e.target.value });
$('#globalEvery').onchange = e => act('settings', { globalEvery: Number(e.target.value) });
$('#events').onchange = e => act('settings', { events: e.target.checked });
$('#addBotBtn').onclick = () => act('addBot');
$('#shuffleBtn').onclick = () => act('shuffleTeams');
$('#startMoney').onchange = e => act('settings', { startMoney: Number(e.target.value) });
$('#jackpot').onchange = e => act('settings', { jackpot: e.target.checked });
$('#mafia').onchange = e => act('settings', { mafia: e.target.checked });
$('#startBtn').onclick = () => act('start');
$('#leaveBtn').onclick = async () => { await act('leave'); secret = null; safeSet('mono.secret', null); connect(); };

// ---------------------------------------------------------------- 3D scene

// two ways to look at the same game: the table in the back room, or the miniature city.
// Each player picks their own; switching swaps the renderer and keeps the game as it is.
let view = safeGet('mono.view') === 'city' ? 'city' : 'table';
let cityModule = null;
const loadCity = () => (cityModule ? Promise.resolve(cityModule) : import('./city/cityScene.js').then(m => (cityModule = m)));
async function setView(v) {
  v = v === 'city' ? 'city' : 'table';
  if (v === 'city') { try { await loadCity(); } catch (e) { console.error(e); toast(t('Something went wrong')); v = 'table'; } }
  view = v; safeSet('mono.view', v);
  document.body.classList.toggle('view-city', v === 'city');
  if (scene) { scene.destroy(); scene = null; sceneKey = null; }
  sfx.setScene(v);
  syncTools();
  if (S && S.phase !== 'lobby') render();
}
document.body.classList.toggle('view-city', view === 'city');
// City labels: names on the street (plates on the pavement, default) or the floating enamel signs
const labelStyle = () => safeGet('mono.labelStyle') === 'signs' ? 'signs' : 'street';
// camera: 'cinematic' follows the tokens with dice push-ins and close-ups, 'fixed' keeps the whole board in the seat view, 'topdown' shows it all from a corner as a diamond (per viewer)
const CAMS = ['cinematic', 'fixed', 'topdown'];
const camMode = () => { const m = safeGet('mono.camera') || (safeGet('mono.follow') === '0' ? 'fixed' : 'cinematic'); return CAMS.includes(m) ? m : 'cinematic'; };
const camFollow = m => (m === 'topdown' ? 'topdown' : m === 'cinematic');      // what scene.setFollow() takes: true | false | 'topdown'
function setCamMode(m, announce) {
  if (!CAMS.includes(m)) m = 'cinematic';
  safeSet('mono.camera', m);
  safeSet('mono.follow', m === 'fixed' ? '0' : '1');
  if (scene) { scene.setFollow(camFollow(m)); if (m !== 'cinematic') scene.resetView(); }
  if (announce) toast(t(m === 'fixed' ? 'Camera: Fixed' : m === 'topdown' ? 'Camera: Top-down' : 'Camera: Cinematic'));
  syncTools();
}
// the camera modes the settings panel offers (the scenes take them all through setFollow)
const camOptions = () => CAMS.slice();
const setLabelStyle = v => { safeSet('mono.labelStyle', v); scene && scene.setLabelStyle && scene.setLabelStyle(labelStyle()); syncTools(); };
sfx.setScene(view);

function ensureScene() {
  // a new game (same table, same players): start from a fresh scene so no token, prop or animation state leaks over from the last one
  if (scene && sceneGid !== null && S.gid !== sceneGid) { scene.destroy(); scene = null; sceneKey = null; }
  sceneGid = S.gid;
  if (!scene) {
    const opts = { emoji: TOKEN_EMOJI, onTileClick: i => { if (!pickTile(i)) openSpace(i); }, onCard: (card, pid) => showCard(card, pid) };
    scene = view === 'city' && cityModule ? cityModule.createCityScene($('#scene'), opts) : createScene($('#scene'), opts);
    if (/[?&]debug\b/.test(location.search)) window.__scene = scene;       // (test harness: screen positions of squares)
    scene.setFollow(camFollow(camMode()));
    if (camMode() !== 'cinematic') scene.resetView();
    if (scene.setLabels) scene.setLabels(safeGet('mono.labels') === '1');
    if (scene.setLabelStyle) scene.setLabelStyle(labelStyle());
    scene.setBroadcast(safeGet('mono.broadcast') === '1');
  }
  const key = [S.settings.map, meta().title, S.board.map(s => s.name + s.price).join()].join('|');
  if (key !== sceneKey) {
    sceneKey = key;
    scene.setBoard(S.board, meta(), S.settings.map);
  }
  scene.setMood(currentMood());
}

// ---------------------------------------------------------------- cards
// The card engine's client: faces (cardface.js, loaded lazily so the game never waits on it), the draw
// animation, the hand tray, the target picker and the little banners for what other players play.
let CF = null;
import('./cardface.js').then(m => { CF = m; if (S && S.phase !== 'lobby') renderHand(); }).catch(() => {});

// short rules text for the face (the full sentence from the server goes under the card) and the picker's effect line
const CARD_INFO = {
  gang: { name: 'Hire a Gang', face: 'Wreck 1–3 levels of a rival tile.', does: 'Wrecks 1–3 levels.', none: 'No rival tile at level 2–4.' },
  squatters: { name: 'Send the Squatters', face: 'A rival tile earns no rent for 3 rounds.', does: 'No rent for 3 rounds.', none: 'No rival tile to target.' },
  protection: { name: 'Police Protection', face: 'Secretly guard one of your tiles.', does: 'Secret: a gang attack there becomes a shootout.', none: 'No unprotected tile of yours.' },
  squattersin: { name: 'Squatters Move In', face: 'Squatters take one of your tiles. No rent for 3 rounds.' },
  crime: { name: 'Crime Wave', face: 'Your rents drop 40% for 3 rounds.' },
  billionaire: { name: 'Shady Billionaire', face: 'A briefcase of cash from a shady donor.' },
  bribe: { name: 'Bribe the Police', face: 'Frame an opponent: they go straight to jail.' },
  gift: { name: 'Mayor’s Gift', face: 'Triple the rent on one tile until your next turn.' },
};
const CARD_LABEL = { attack: 'ATTACK', counter: 'COUNTER', negative: 'NEGATIVE', positive: 'POSITIVE', classic: 'CARD', mafia: 'THE FAMILY' };
const esc2 = esc;
// cardFace() plus the bits it doesn't do: classic cards, translated type label, a plain fallback while it loads
function faceHtml({ key, type, title, text, value }, size) {
  if (!CF) return `<div class="cf-fallback cf-${type}" style="${size ? `width:${size}px` : ''}"><b>${esc2(title)}</b><span>${esc2(text)}</span></div>`;
  let h = CF.cardFace({ key: type === 'classic' ? '' : key === 'squattersin' ? 'squatters_in' : key, type: type === 'classic' ? 'attack' : type, title, text, value, size });
  if (type === 'classic') h = h.replace('cf-attack', 'cf-classic');
  return h.replace(/<span class="cf-label">([^<]*)<\/span>/, (m, l) => `<span class="cf-label">${esc2(t(type === 'classic' ? 'CARD' : CARD_LABEL[type] || l))}</span>`);
}
const backHtml = (deck, size) => (CF ? CF.cardBack(deck, size) : `<div class="cf-fallback cf-back" style="${size ? `width:${size}px` : ''}"></div>`);
const handFace = c => faceHtml({ key: c.key, type: c.type, title: t(CARD_INFO[c.key].name), text: t(CARD_INFO[c.key].face), value: c.cost ? cash(c.cost) : '' }, 84);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const done = (a, ms) => Promise.race([a.finished.catch(() => {}), sleep(ms + 400)]);
let cardSeq = 0, cardBusy = false, cardTimer = null;

// a drawn card: slides off the deck (top centre), turns over, comes to the middle, plays its beat, then goes away
// (attack / counter cards fly to their owner: the hand tray for you, the player's panel for everyone else)
async function showCard(card, pid) {
  const who = pById(pid);
  if (!who) return;
  const lc = S.lastCard && S.lastCard.player === pid && S.lastCard.deck === card.deck && S.lastCard.text === card.text ? S.lastCard : null;
  const key = lc && lc.key && CARD_INFO[lc.key] ? lc.key : 'classic', type = key === 'classic' ? 'classic' : lc.type;
  const info = CARD_INFO[key], mine = pid === S.you;
  const face = { key, type, title: info ? t(info.name) : card.title, text: info ? t(info.face) : cardText(card.text), value: lc && lc.cost ? cash(lc.cost) : '' };
  const box = $('#cardFx'), cardEl = box.querySelector('.cfx-card'), inner = box.querySelector('.cfx-inner');
  const my = ++cardSeq;
  clearTimeout(cardTimer);
  [cardEl, inner].forEach(e => e.getAnimations().forEach(a => a.cancel()));
  cardEl.style.opacity = '';
  const W = Math.round(Math.min(270, innerWidth * 0.6, innerHeight * 0.42));
  box.style.setProperty('--W', W + 'px');
  box.dataset.tone = type === 'classic' ? 'classic' : type === 'positive' ? 'good' : type === 'negative' ? 'bad' : type;
  box.querySelector('.cfx-back').innerHTML = backHtml(card.deck);
  box.querySelector('.cfx-front').innerHTML = faceHtml(face);
  box.querySelector('.cfx-who').textContent = t('{name} drew {deck}', { name: who.name, deck: card.title });
  const txt = box.querySelector('.cfx-text');
  txt.textContent = cardText(card.text); txt.style.opacity = 0;
  const ok = box.querySelector('button');
  ok.hidden = !mine; ok.style.opacity = 0;
  box.querySelector('.cfx-who').style.opacity = 0;
  box.classList.remove('beat', 'out'); box._leaving = false; box.hidden = false; cardBusy = true;
  const y0 = 64 - innerHeight * 0.46;
  const finish = (mode) => dismissCard(mode, my, { pid, type, mine });
  ok.onclick = () => finish('go');
  box._finish = finish;

  if (card.casino) {                               // dealt at a casino: the dealer shuffles a fan of card backs, then deals one forward
    box.querySelector('.cfx-who').textContent = t('The dealer deals…'); box.querySelector('.cfx-who').style.opacity = 1;
    if (!await shuffleIntro(box, cardEl, inner, card.deck, W, () => my !== cardSeq)) return;
    box.querySelector('.cfx-who').textContent = t('{name} drew {deck}', { name: who.name, deck: card.title });
  } else {
    sfx.cardDraw();
    const a1 = cardEl.animate([{ transform: `translate(0, ${y0}px) scale(.28)`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: `translate(0, ${y0 * 0.3}px) scale(.62)`, opacity: 1 }], { duration: slow(560), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    await done(a1, slow(560));
    if (my !== cardSeq) return;
    sfx.cardFlip();
    const a2 = cardEl.animate([{ transform: `translate(0, ${y0 * 0.3}px) scale(.62)` }, { transform: 'translate(0, 0) scale(1)' }], { duration: slow(640), easing: 'cubic-bezier(.3,1.2,.4,1)', fill: 'forwards' });
    const a3 = inner.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], { duration: slow(640), easing: 'ease-in-out', fill: 'forwards' });
    await Promise.all([done(a2, slow(640)), done(a3, slow(640))]);
    if (my !== cardSeq) return;
  }
  box.classList.add('beat');                       // the effect beat: warm gold or cold red light, and the sting
  sfx.cardSting(key);
  txt.style.transition = box.querySelector('.cfx-who').style.transition = ok.style.transition = 'opacity .4s';
  txt.style.opacity = 1; ok.style.opacity = 1; box.querySelector('.cfx-who').style.opacity = 1;
  cardTimer = setTimeout(() => finish('go'), slow(mine ? 14000 : 5000));
}

// the casino dealer: a deck of card backs fans out in the middle of the screen, is riffled three times, and the top card
// is dealt forward and turned over (the real #cardFx card takes over from the deck's top). Resolves false if cancelled.
async function shuffleIntro(box, cardEl, inner, deck, W, cancelled) {
  box.querySelectorAll('.cfx-deck').forEach(e => e.remove());
  const N = 9, mid = (N - 1) / 2, wrap = document.createElement('div');
  wrap.className = 'cfx-deck';
  wrap.innerHTML = Array.from({ length: N }, () => `<div class="cfx-dk">${backHtml(deck)}</div>`).join('');
  box.insertBefore(wrap, cardEl);
  const cards = [...wrap.children];
  const still = i => `translate(${(i - mid) * 0.8}px, ${-i * 1.4}px) rotate(${(i % 3 - 1) * 0.6}deg)`;
  const play = (ms, frames) => Promise.all(cards.map((c, i) => done(c.animate(frames(i), { duration: slow(ms.d), delay: slow(ms.stag ? i * ms.stag : 0), easing: ms.e || 'ease-in-out', fill: 'forwards' }), slow(ms.d + (ms.stag || 0) * N))));
  cards.forEach((c, i) => { c.style.transform = still(i); });
  sfx.shuffle();
  wrap.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: slow(260), easing: 'ease-out', fill: 'forwards' });
  await play({ d: 420, e: 'cubic-bezier(.3,1.3,.5,1)' }, i => [{ transform: still(i) }, { transform: `rotate(${(i - mid) * 9}deg) translate(0, ${-Math.abs(i - mid) * 2}px)` }]);     // fan out
  if (cancelled()) return wrap.remove();
  await play({ d: 220 }, i => [{ transform: `rotate(${(i - mid) * 9}deg)` }, { transform: still(i) }]);                                                                          // and square up
  for (let r = 0; r < 3; r++) {                                                       // riffle: halves split, then interleave card by card
    if (cancelled()) return wrap.remove();
    const side = i => (i % 2 ? 1 : -1);
    await play({ d: 150, e: 'ease-out' }, i => [{ transform: still(i) }, { transform: `translate(${side(i) * W * 0.42}px, ${-i * 1.4}px) rotate(${side(i) * 7}deg)` }]);
    await play({ d: 230, stag: 16, e: 'cubic-bezier(.4,0,.2,1)' }, i => [{ transform: `translate(${side(i) * W * 0.42}px, ${-i * 1.4}px) rotate(${side(i) * 7}deg)` }, { transform: `translate(${(i - mid) * 0.8}px, ${-i * 1.4 - W * 0.06}px) rotate(0deg)`, offset: 0.6 }, { transform: still(i) }]);
  }
  if (cancelled()) return wrap.remove();
  // deal: the top card of the pile slides forward and flips into the drawn card
  cardEl.style.opacity = 1;
  cards[N - 1].style.visibility = 'hidden';
  cardEl.animate([{ transform: `translate(0, ${-(N - 1) * 1.4}px) scale(1)`, opacity: 1 }, { transform: `translate(0, ${-W * 0.1}px) scale(1.08)`, opacity: 1, offset: 0.5 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }], { duration: slow(640), easing: 'ease-in-out', fill: 'forwards' });
  wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: slow(520), delay: slow(160), fill: 'forwards' });
  sfx.cardFlip();
  const a3 = inner.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], { duration: slow(640), easing: 'ease-in-out', fill: 'forwards' });
  await done(a3, slow(640));
  wrap.remove();
  return !cancelled();
}

async function dismissCard(mode, my, c) {
  const box = $('#cardFx');
  if (my !== cardSeq || box.hidden || box._leaving) return;
  clearTimeout(cardTimer);
  box._leaving = true;
  const cardEl = box.querySelector('.cfx-card');
  box.classList.add('out');
  let tx = 0, ty = -40, sc = 0.9;
  if (c && (c.type === 'attack' || c.type === 'counter')) {      // into the owner's hand
    const target = c.mine ? ($('#handTray').hidden ? $('#handBtn') : $('#handTray')) : $(`.pcard[data-pid="${c.pid}"]`);
    const r = target && target.getBoundingClientRect();
    if (r && r.width) {
      const cr = cardEl.getBoundingClientRect();
      tx = r.left + r.width / 2 - (cr.left + cr.width / 2); ty = r.top + r.height / 2 - (cr.top + cr.height / 2);
      sc = Math.max(0.1, Math.min(0.4, (c.mine ? 84 : 40) / cr.width));
    }
  }
  if (mode === 'go') sfx.cardDraw();
  const a = cardEl.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${tx}px, ${ty}px) scale(${sc})`, opacity: tx || ty > -40 ? 0.9 : 0 }], { duration: mode === 'quick' ? 160 : slow(520), easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' });
  await done(a, slow(520));
  if (my !== cardSeq) return;
  box.hidden = true; box._leaving = false; cardBusy = false;
  if (S) renderHand(true);
}
const dismissCardNow = () => { const b = $('#cardFx'); if (!b.hidden && b._finish) b._finish('quick'); };

// the casino's verdict: a cream card with a framed art slot (casino-<key> art from cardface.js), shown to everyone once the wheel stops.

// ---------------------------------------------------------------- the hand
// up to three cards, fanned above your corner panel (a "Cards (n)" button on narrow screens); a new card
// only joins once its draw animation has delivered it
const seenHand = new Set();
let handKey = null, holdDeadline = 0;
const evictCost = sp => Math.max(10000, Math.round(0.5 * (sp.price + (S.props[sp.i].level - 1) * (sp.houseCost || 0)) / 10000) * 10000);
const squattersAt = pos => activeEffects(S).find(e => e.kind === 'squatters' && e.pos === pos);
const squattedAt = pos => !!squattersAt(pos);

function holdingNew(fresh) {
  if (!fresh.length) return false;
  if (!holdDeadline) holdDeadline = performance.now() + slow(9000);
  return performance.now() < holdDeadline && (cardBusy || (scene && !scene.isIdle()));
}
function renderHand(release) {
  const tray = $('#handTray'), btn = $('#handBtn');
  const hand = (S && S.mine && S.mine.hand) || [];
  if (!S || S.phase === 'lobby' || !S.you) { tray.hidden = btn.hidden = true; return; }
  if (handKey === null) hand.forEach(c => seenHand.add(c.id));            // first sync: everything is already in your hand
  const fresh = hand.filter(c => !seenHand.has(c.id));
  if (!holdingNew(fresh)) { fresh.forEach(c => seenHand.add(c.id)); holdDeadline = 0; }
  const shown = hand.filter(c => seenHand.has(c.id) && CARD_INFO[c.key]);
  for (const id of [...seenHand]) if (!hand.some(c => c.id === id)) seenHand.delete(id);
  const narrow = innerWidth < 900;
  const reasons = shown.map(c => playReason(c));
  const key = [shown.map(c => c.id).join(), reasons.join('|'), narrow, lang, pick && pick.card && pick.card.id, CF ? 1 : 0].join('#');
  handKey = key;
  // sit just above the bottom-left panel
  const slot = document.querySelector('#hudPlayers .pcard.slot3');
  tray.style.setProperty('--hb', (slot && innerWidth > 760 ? slot.offsetHeight + 22 : 12) + 'px');
  tray.hidden = narrow; btn.hidden = !narrow || !shown.length;
  tray.classList.toggle('empty', !shown.length);
  btn.innerHTML = ic('cards') + esc(t('Cards ({n})', { n: shown.length }));
  btn.onclick = openHandModal;
  if (tray._key === key) return;
  tray._key = key;
  tray.innerHTML = '';
  shown.forEach((c, k) => {
    const b = el('button', `hc${reasons[k] ? ' off' : ''}${pick && pick.card && pick.card.id === c.id ? ' up' : ''}`, handFace(c));
    b.style.setProperty('--k', k); b.style.setProperty('--r', ((k - (shown.length - 1) / 2) * 7) + 'deg');
    b.dataset.tip = `${t(CARD_INFO[c.key].name)}${reasons[k] ? ' — ' + reasons[k] : ''}`;
    b.onclick = () => openCardPlay(c.id);
    tray.append(b);
  });
}
addEventListener('resize', () => { if (S && S.phase !== 'lobby') renderHand(); });
function openHandModal() {
  const hand = (S.mine && S.mine.hand) || [];
  openModal('hand', `<h2 class="title" style="font-size:calc(var(--ui-scale,1)*26px)">${t('Your cards')} <button class="info-q"${infoAttr('hand-mine', { n: hand.length })} aria-label="${esc(t('What is this?'))}">?</button></h2>
    <div class="hand-modal">${hand.filter(c => CARD_INFO[c.key]).map(c => `<button class="hc big${playReason(c) ? ' off' : ''}" data-id="${c.id}">${faceHtml({ key: c.key, type: c.type, title: t(CARD_INFO[c.key].name), text: t(CARD_INFO[c.key].face), value: c.cost ? cash(c.cost) : '' }, 120)}</button>`).join('')}</div>
    <div class="modal-actions"><button class="btn ghost" id="mClose">${t('Close')}</button></div>`);
  $('#mClose').onclick = closeModal;
  $('#modalBox').querySelectorAll('.hc').forEach(b => b.onclick = () => { closeModal(); openCardPlay(b.dataset.id); });
}

// ---------------------------------------------------------------- playing a card (target picker)
let pick = null;                       // { mode: 'card' | 'gift' | 'bribe' | 'taxi', card?, sel }
const tileLine = i => splitName(S.board[i].name)[0];
const protectedMine = i => !!(S.mine && S.mine.protected && S.mine.protected.includes(i));
const canPlayNow = () => myTurn() && ['roll', 'end'].includes(S.turnState) && !S.pending;
function cardTargets(c) {
  const my = me();
  if (!my) return [];
  return S.board.filter(sp => {
    const st = S.props[sp.i];
    if (!st) return false;
    if (c.key === 'protection') return st.owner === S.you && sp.type === 'property' && !protectedMine(sp.i);
    if (st.owner === S.you) return false;
    const o = pById(st.owner);
    if (teamsMode() && o && o.team === my.team) return false;
    if (c.key === 'gang') return sp.type === 'property' && st.level >= 2 && st.level < 5;
    if (c.key === 'squatters') return !st.mortgaged;
    return false;
  }).map(sp => sp.i);
}
function playReason(c) {
  const my = me();
  if (!my || my.bankrupt) return t('You are out of the game');
  if (!myTurn()) return t('Wait for your turn');
  if (!canPlayNow()) return t('Finish what you are doing first');
  if (c.cost && my.money < c.cost) return needMore(my, c.cost);
  if (!cardTargets(c).length) return t(CARD_INFO[c.key].none);
  return '';
}
// the rent a tile charges right now (for the picker's rows)
function rentNow(sp) {
  const st = S.props[sp.i], owner = st && pById(st.owner);
  if (!owner || st.mortgaged) return 0;
  if (sp.type === 'property') return Math.round(rentAt(sp, st.level, owner.id) * rentMult() * effectMult(S, sp));
  if (sp.type === 'railroad') return Math.round(railRent(S.board.filter(s => s.type === 'railroad' && S.props[s.i] && S.props[s.i].owner === owner.id).length) * rentMult() * effectMult(S, sp));
  return 0;
}
function openCardPlay(id) {
  const c = ((S.mine && S.mine.hand) || []).find(x => x.id === id);
  if (!c || !CARD_INFO[c.key]) return;
  closeModalIf('hand');
  pick = { mode: 'card', card: c, sel: null };
  sfx.cardDraw();
  renderPick();
}
function openGiftPick() {
  if (!(myTurn() && S.turnState === 'gift' && S.pending)) return;
  pick = { mode: 'gift', sel: null };
  renderPick();
}
function openBribePick() {
  if (!(myTurn() && S.turnState === 'bribe' && S.pending)) return;
  pick = { mode: 'bribe', sel: null };
  renderPick();
}
// Taxi Company: ride to any square but the depot itself
const TAXI_POS = 20;
const taxiReady = () => myTurn() && S.turnState === 'roll' && !S.pending && !S.extraRoll && (me() || {}).taxi && !(me() || {}).inJail;
function openTaxiPick() {
  if (!taxiReady()) return;
  pick = { mode: 'taxi', sel: null };
  renderPick();
}
function taxiMeta(sp) {
  const st = S.props[sp.i], owner = st && pById(st.owner);
  if (['property', 'railroad', 'utility'].includes(sp.type)) {
    if (!owner) return t('For sale') + ' · ' + cash(sp.price);
    if (owner.id === S.you) return t('Yours') + (st.mortgaged ? ' · ' + t('Mortgaged') : sp.type === 'property' ? ' · ' + levelName(st.level) : '');
    return esc(owner.name) + ' · ' + (st.mortgaged ? t('Mortgaged') : sp.type === 'utility' ? t('Rent here: {amount} × the dice', { amount: cash(utilPerPip(S.board.filter(s => s.type === 'utility' && S.props[s.i] && S.props[s.i].owner === owner.id).length)) }) : t('rent {amount}', { amount: cash(rentNow(sp)) }));
  }
  if (sp.type === 'tax') return t('Pay') + ' ' + cash(sp.amount);
  return { go: t('Collect {amount} every time you pass.', { amount: cash(200000) }), casino: t('Casino'), chance: t('Card'), chest: t('Card'), jail: t('Just visiting… unless you got sent here.'), gotojail: t('Go directly to {jail}.', { jail: S.board[10].name }) }[sp.type] || '';
}
function renderTaxiPick(box) {
  const my = me();
  const list = S.board.map(sp => sp.i).filter(i => i !== TAXI_POS && i !== (my || {}).pos);
  if (pick.sel != null && !list.includes(pick.sel)) pick.sel = null;
  scene && scene.setTargets && scene.setTargets(list);
  scene && scene.select(pick.sel != null ? pick.sel : -1);
  const rows = list.map(i => {
    const sp = S.board[i];
    return `<button class="cp-row${pick.sel === i ? ' sel' : ''}" data-pos="${i}">
      <span class="chip" style="--gc:${sp.color || '#555'}"></span><b>${esc(tileLine(i))}</b>
      <span class="cp-meta">${taxiMeta(sp)}</span></button>`;
  }).join('');
  let confirm = '';
  if (pick.sel != null) {
    const sp = S.board[pick.sel], pays = pick.sel < my.pos;
    confirm = `<div class="cp-confirm"><p>${esc(t('Take a cab to {tile}.', { tile: tileLine(pick.sel) }))}${pays ? ' ' + esc(t('You pass {go} on the way.', { go: splitName(S.board[0].name)[0] })) : ''}</p><button class="btn big" id="cpGo">${t('Ride there')}</button></div>`;
  }
  const html = `<div class="cp-head"><span class="cp-ico">${ic('taxi')}</span>
      <div><b>${esc(t('Take the taxi'))}</b><small>${esc(t('Pick any square on the board or in the list.'))}</small></div>
      <button class="btn ghost small" id="cpX">${t('Cancel')}</button></div>
    <div class="cp-list">${rows}</div>${confirm}`;
  box.hidden = false;
  if (box._html !== html) {
    const sc = box.querySelector('.cp-list');
    const top = sc ? sc.scrollTop : 0;
    box.innerHTML = box._html = html;
    const l2 = box.querySelector('.cp-list'); if (l2) l2.scrollTop = top;
    const sr = box.querySelector('.cp-row.sel'); if (sr && l2) { const r = sr.getBoundingClientRect(), q = l2.getBoundingClientRect(); if (r.top < q.top || r.bottom > q.bottom) l2.scrollTop += r.top - q.top - q.height / 2 + r.height / 2; }
    box.querySelectorAll('.cp-row').forEach(b => { b.onclick = () => pickTile(Number(b.dataset.pos)); b.onmouseenter = () => scene && scene.select(Number(b.dataset.pos)); b.onmouseleave = () => scene && scene.select(pick && pick.sel != null ? pick.sel : -1); });
    $('#cpX').onclick = closePick;
    const go = $('#cpGo');
    if (go) go.onclick = async () => {
      const sel = pick.sel;
      go.disabled = true;
      await act('taxiRide', { to: sel });
      pick = null; renderPick();
    };
  }
}
function closePick() {
  pick = null;
  renderPick();
}
function pickList() {
  if (!pick) return [];
  if (pick.mode === 'taxi') return S.board.map(sp => sp.i).filter(i => i !== TAXI_POS && i !== (me() || {}).pos);
  return pick.mode === 'bribe' ? (S.pending && S.pending.options) || [] : pick.mode === 'gift' ? (S.pending && S.pending.options) || [] : cardTargets(pick.card);
}
function pickTile(i) {                 // a click on the board while the picker is open; true = handled
  if (!pick || pick.mode === 'bribe') return !!pick && pick.mode === 'bribe';   // the bribe list is players, not tiles
  const list = pickList();
  if (pick.reason) { toast(pick.reason); return true; }
  if (!list.includes(i)) { toast(t('Not a valid target')); return true; }
  pick.sel = i; renderPick();
  return true;
}
function renderPick() {
  const box = $('#cardPick');
  document.body.classList.toggle('picking', !!pick);
  if (pick && pick.mode === 'card' && !((S.mine && S.mine.hand) || []).some(c => c.id === pick.card.id)) pick = null;   // played, or lost
  if (pick && pick.mode === 'gift' && !(myTurn() && S.turnState === 'gift' && S.pending)) pick = null;
  if (pick && pick.mode === 'bribe' && !(myTurn() && S.turnState === 'bribe' && S.pending)) pick = null;
  if (pick && pick.mode === 'taxi' && !taxiReady()) pick = null;
  if (!pick) {
    box.hidden = true; box._html = null;
    scene && scene.setTargets && scene.setTargets([]);
    if (selectedPos == null && scene) scene.select(-1);
    return;
  }
  if (pick.mode === 'bribe') return renderBribePick(box);
  if (pick.mode === 'taxi') return renderTaxiPick(box);
  const gift = pick.mode === 'gift', c = pick.card;
  pick.reason = gift ? '' : playReason(c);
  const list = pick.reason ? [] : pickList();
  if (pick.sel != null && !list.includes(pick.sel)) pick.sel = null;
  scene && scene.setTargets && scene.setTargets(list);
  scene && scene.select(pick.sel != null ? pick.sel : -1);
  const rows = list.map(i => {
    const sp = S.board[i], st = S.props[i], owner = pById(st.owner), rent = rentNow(sp);
    return `<button class="cp-row${pick.sel === i ? ' sel' : ''}" data-pos="${i}">
      <span class="chip" style="--gc:${sp.color || '#555'}"></span><b>${esc(tileLine(i))}</b>
      <span class="cp-meta">${owner && owner.id !== S.you ? esc(owner.name) + ' · ' : ''}${sp.type === 'property' ? levelName(st.level) + ' · ' : ''}${t('rent {amount}', { amount: cash(rent) })}${gift ? ` → <b>${cash(rent * 3)}</b>` : ''}${protectedMine(i) ? ' ' + ic('shield', { cls: 'ic-inline' }) : ''}</span></button>`;
  }).join('');
  let confirm = '';
  if (pick.sel != null) {
    const tile = tileLine(pick.sel), cost = gift ? 0 : c.cost || 0;
    const line = gift ? t('Bless {tile}: rent {from} → {to} until your next turn.', { tile, from: cash(rentNow(S.board[pick.sel])), to: cash(rentNow(S.board[pick.sel]) * 3) })
      : c.key === 'gang' ? t('Hire a Gang on {tile} — {cost}. {does}', { tile, cost: cash(cost), does: t(CARD_INFO.gang.does) })
      : c.key === 'squatters' ? t('Send the Squatters into {tile}. {does}', { tile, does: t(CARD_INFO.squatters.does) })
      : t('Guard {tile} with Police Protection. {does}', { tile, does: t(CARD_INFO.protection.does) });
    confirm = `<div class="cp-confirm"><p>${esc(line)}</p><button class="btn big" id="cpGo">${gift ? t('Bless it') : t('Play the card')}</button></div>`;
  }
  const html = `<div class="cp-head">
      ${gift ? `<span class="cp-ico">${ic('gift')}</span>` : `<div class="cp-mini">${faceHtml({ key: c.key, type: c.type, title: t(CARD_INFO[c.key].name), text: '', value: c.cost ? cash(c.cost) : '' }, 54)}</div>`}
      <div><b>${esc(gift ? t('Mayor’s Gift') : t(CARD_INFO[c.key].name))}</b><small>${esc(gift ? t('Pick one of your tiles: triple rent until your next turn.') : pick.reason || t('Pick a target on the board or in the list.'))}</small></div>
      <button class="btn ghost small" id="cpX">${gift ? t('Hide') : t('Cancel')}</button></div>
    ${rows ? `<div class="cp-list">${rows}</div>` : ''}${confirm}`;
  box.hidden = false;
  if (box._html !== html) {
    const sc = box.querySelector('.cp-list');
    const top = sc ? sc.scrollTop : 0;
    box.innerHTML = box._html = html;
    const l2 = box.querySelector('.cp-list'); if (l2) l2.scrollTop = top;
    box.querySelectorAll('.cp-row').forEach(b => { b.onclick = () => pickTile(Number(b.dataset.pos)); b.onmouseenter = () => scene && scene.select(Number(b.dataset.pos)); b.onmouseleave = () => scene && scene.select(pick && pick.sel != null ? pick.sel : -1); });
    $('#cpX').onclick = closePick;
    const go = $('#cpGo');
    if (go) go.onclick = async () => {
      const sel = pick.sel;
      go.disabled = true;
      if (gift) await act('chooseGift', { pos: sel }); else await act('playCard', { cardId: c.id, target: sel });
      pick = null; renderPick();
    };
  }
}

// Bribe the Police: the card resolves on draw — pick the opponent who goes to jail (players, not tiles)
function renderBribePick(box) {
  const list = ((S.pending && S.pending.options) || []).map(pById).filter(Boolean);
  if (pick.sel != null && !list.some(o => o.id === pick.sel)) pick.sel = null;
  scene && scene.setTargets && scene.setTargets([]);
  scene && scene.select(-1);
  const jail = S.board[10] ? splitName(S.board[10].name)[0] : '';
  const rows = list.map(o => `<button class="cp-row${pick.sel === o.id ? ' sel' : ''}" data-pid="${esc(o.id)}">
      <span class="chip" style="--gc:${esc(o.color || '#555')}"></span><b>${esc(o.name)}</b>
      <span class="cp-meta">${cash(o.money)}</span></button>`).join('');
  const sel = pick.sel != null && pById(pick.sel);
  const confirm = sel ? `<div class="cp-confirm"><p>${esc(t('Bribe the police: {name} is hauled off to {jail}.', { name: sel.name, jail }))}</p><button class="btn big" id="cpGo">${t('Frame {name}', { name: esc(sel.name) })}</button></div>` : '';
  const card = (S.lastCard && S.lastCard.key === 'bribe') ? S.lastCard : { type: 'positive' };
  const html = `<div class="cp-head">
      <div class="cp-mini">${faceHtml({ key: 'bribe', type: card.type, title: t(CARD_INFO.bribe.name), text: '' }, 54)}</div>
      <div><b>${esc(t(CARD_INFO.bribe.name))}</b><small>${esc(t('Pick the opponent who goes to jail.'))}</small></div></div>
    <div class="cp-list">${rows}</div>${confirm}`;
  box.hidden = false;
  if (box._html !== html) {
    box.innerHTML = box._html = html;
    box.querySelectorAll('.cp-row').forEach(b => { b.onclick = () => { pick.sel = b.dataset.pid; renderPick(); }; });
    const go = $('#cpGo');
    if (go) go.onclick = async () => {
      go.disabled = true;
      await act('chooseBribe', { target: pick.sel });
      pick = null; renderPick();
    };
  }
}
let lastBribeKey = null;
function handleBribePrompt() {
  if (!(myTurn() && S.turnState === 'bribe' && S.pending)) { if (!S.pending) lastBribeKey = null; return; }
  const key = S.round + ':' + S.turn + ':' + S.pending.options.join();
  if (key === lastBribeKey) return;
  lastBribeKey = key;
  scene.whenIdle(() => { if (myTurn() && S.turnState === 'bribe' && !pick) openBribePick(); });
}

// ---------------------------------------------------------------- what other people play
// New log lines about cards (a bot's gang, an eviction, an audit…) get a small banner and their sting.
const PLAY_RE = /^(🔫|🏚|🚔|🛏|🛡|🧹|🧾|🗑|🚓) (?!.*is closed by the police|Police Investigation|Squatters moved into)(.+)$/u;
const PLAY_STING = { '🔫': 'gang', '🚔': 'shootout', '🛡': 'protection', '🧹': 'evict', '🧾': 'audit' };
let playKey = null, playQueue = [], playBusy = false;
function handlePlays() {
  if (!S.log) return;
  const keyOf = l => l.t + '|' + l.text;
  let from = 0;
  if (playKey) { for (let k = S.log.length - 1; k >= 0; k--) if (keyOf(S.log[k]) === playKey) { from = k + 1; break; } }
  const first = !playKey || from === 0;
  if (S.log.length) playKey = keyOf(S.log[S.log.length - 1]);
  if (first) return;                                                    // first sync: don't replay history
  for (const l of S.log.slice(from)) {
    if (l.chat) continue;
    const m = PLAY_RE.exec(l.text);
    if (m) playQueue.push({ icon: m[1], text: tr(l.text).replace(/^\S+\s/u, ''), sting: m[1] === '🛏' && / sent squatters /.test(l.text) ? 'squatters' : PLAY_STING[m[1]] });
  }
  if (!playBusy) nextPlay();
}
async function nextPlay() {
  const p = playQueue.shift(), box = $('#playBanner');
  if (!p) { playBusy = false; box.hidden = true; return; }
  playBusy = true;
  const run = () => {
    box.innerHTML = `<i>${emo(p.icon)}</i><span>${deEmoji(esc(p.text))}</span>`;
    box.hidden = false; box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    if (p.sting) sfx.cardSting(p.sting);
    setTimeout(nextPlay, slow(3200));
  };
  scene ? scene.whenIdle(run) : run();
}

// ---------------------------------------------------------------- crime wave / mayor's gift prompts
function crimeOptions(p) {
  const cost = S.pending.cost;
  return [
    { act: 'payPolice', label: t('Pay the police {cost} now (audit risk for 5 rounds)', { cost: cash(cost) }), ok: p.money >= cost, reason: p.money >= cost ? '' : needMore(p, cost) },
    { act: 'pass', label: t('Let it fade (3 rounds, rents −40% there)'), ok: true, reason: '' },
  ];
}
function evictOption(sp, p, withTile) {
  const cost = evictCost(sp);
  const sq = squattersAt(sp.i);
  const reason = sq && !sq.canEvict ? t('Squatters can be evicted after one full turn of yours') : !myTurn() ? t('Wait for your turn') : !canPlayNow() ? t('Finish what you are doing first') : p.money < cost ? needMore(p, cost) : '';
  return { arg: { pos: sp.i }, label: withTile ? t('Evict the squatters at {tile} — {cost}', { tile: tileLine(sp.i), cost: cash(cost) }) : t('Evict the squatters — {cost}', { cost: cash(cost) }), ok: !reason, reason };
}
const squattedMine = () => S.board.filter(sp => S.props[sp.i] && S.props[sp.i].owner === S.you && squattedAt(sp.i));
let lastGiftKey = null;
function handleGiftPrompt() {
  if (!(myTurn() && S.turnState === 'gift' && S.pending)) { if (!S.pending) lastGiftKey = null; return; }
  const key = S.round + ':' + S.turn + ':' + S.pending.options.join();
  if (key === lastGiftKey) return;
  lastGiftKey = key;
  scene.whenIdle(() => { if (myTurn() && S.turnState === 'gift' && !pick) openGiftPick(); });
}


const CASINO_SYM = { whim: '💵', police: '🚓', mayor: '🎩', gang: '🔪', bombing: '💣', boom: '🎉', onetoomany: '🥃' };
const CASINO_TITLE = { whim: 'Billionaire’s Whim', police: 'Police Investigation', mayor: 'Mayor’s Favor', gang: 'Gang Turf', bombing: 'Building Bombing', boom: 'Economic Boom', onetoomany: 'One Too Many' };
const CASINO_GOOD = new Set(['whim', 'mayor', 'boom']);
function showCasino(c) {
  const box = $('#casinoPopup'), who = pById(c.player);
  const key = CASINO_SYM[c.key] ? c.key : 'whim';
  box.dataset.key = key;
  box.dataset.tone = CASINO_GOOD.has(key) ? 'good' : 'bad';
  box.querySelector('.cc-icon').innerHTML = emo(CASINO_SYM[key]);
  box.querySelector('.cc-where').textContent = (who ? who.name + ' · ' : '') + splitName(S.board[c.pos] ? S.board[c.pos].name : t('Casino'))[0];
  box.querySelector('.cc-title').textContent = t(CASINO_TITLE[key]);
  const art = box.querySelector('.cc-art');
  art.dataset.art = 'casino-' + key;
  const artSrc = CF && CF.ART['casino-' + key];
  art.innerHTML = artSrc ? `<img src="${artSrc}" alt="" draggable="false">` : `<span class="cc-sym">${emo(CASINO_SYM[key])}</span>`;
  box.querySelector('.cc-text').textContent = casinoText(c.text);
  box.classList.remove('show'); box.hidden = false; void box.offsetWidth; box.classList.add('show');
  sfx.casinoEvent && sfx.casinoEvent(key);
  clearTimeout(box._t); box._t = setTimeout(() => (box.hidden = true), slow(c.player === S.you ? 10000 : 6000));
}
$('#casinoPopup').querySelectorAll('.pop-x, .cc-ok').forEach(b => { b.onclick = () => { clearTimeout($('#casinoPopup')._t); $('#casinoPopup').hidden = true; }; });
const WHEEL_SEGS = () => [['whim', 'good'], ['police', 'bad'], ['mayor', 'good'], ['gang', 'bad'], ['onetoomany', 'bad'], ['boom', 'good'], ['bombing', 'bad']]
  .map(([key, tone]) => ({ key, tone, icon: CASINO_SYM[key], label: t(CASINO_TITLE[key]) }));
let lastCasinoId = null;
function handleCasino() {
  const c = S.lastCasino;
  if (lastCasinoId === null || !c) { lastCasinoId = c ? c.id : 0; return; }   // first sync: don't replay an old spin
  if (c.id === lastCasinoId) return;
  lastCasinoId = c.id;
  if (c.stale || c.mode === 'card') return;       // a dealt card plays through the card animation (showCard), not here
  const where = S.board[c.pos] ? splitName(S.board[c.pos].name)[0] : t('Casino');
  const start = () => {
    scene.hold && scene.hold(6600);                // the wheel turns ~4 s, rests, then the verdict: later effects wait
    for (const q of ['#casinoPopup', '#globalPopup']) { clearTimeout($(q)._t); $(q).hidden = true; }   // an earlier verdict never sits under the new wheel
    spinEventWheel({ segments: WHEEL_SEGS(), target: c.key, title: where, duration: slow(3800), onTick: f => sfx.wheelTick(f) })
      .then(seg => { if (!seg) return; showCasino(c); evfx.casino(c); });
  };
  if (scene.casino) scene.casino(c, null, start);
  else scene.whenIdle(start);
}

if (/[?&]debug\b/.test(location.search)) window.__hud = { wheel: key => spinEventWheel({ segments: WHEEL_SEGS(), target: key, title: 'Club Lucky Seven', duration: slow(3800), onTick: f => sfx.wheelTick(f) }), announce: (icon, text) => announce({ icon, text }) };   // (test harness)
// ---------------------------------------------------------------- global wheel (every N rounds, hits everyone)
const GLOBAL_SEGS = () => [
  ['squatters', '🛏', 'bad', 'Squatters', 'squatters_in'], ['police', '🚓', 'bad', 'Police Raids', 'casino-police'], ['mayor', '🎩', 'good', "Mayor's Favor", 'casino-mayor'],
  ['gang', '🔪', 'bad', 'Gang Turf', 'casino-gang'], ['crime', '🚨', 'bad', 'Crime Wave', 'crime'], ['gangwar', '💥', 'bad', 'Gang War', 'gang'],
  ['whim', '💵', 'good', "Billionaire's Whim", 'casino-whim'], ['boom', '🎉', 'good', 'Economic Boom', 'casino-boom'], ['audit', '🧾', 'bad', 'Tax Audit', null],
  ['onetoomany', '🥃', 'bad', 'One Too Many', 'casino-onetoomany'], ['protection', '🛡', 'good', 'Police Protection', 'protection'],
].map(([key, icon, tone, title, art]) => ({ key, icon, tone, title, art, label: globalTitle(title) }));
const GLOBAL_SND = new Set(['gang', 'police', 'mayor', 'whim', 'boom', 'onetoomany', 'crime', 'squatters', 'protection', 'audit', 'gangwar']);
function showGlobal(gl) {
  const box = $('#globalPopup'), seg = (GLOBAL_SEGS().find(x => x.key === gl.key) || GLOBAL_SEGS()[0]);
  box.dataset.key = seg.key;
  box.dataset.tone = seg.tone;
  box.querySelector('.cc-title').textContent = seg.label;
  box.querySelector('.cc-icon').innerHTML = emo(seg.icon);
  const art = box.querySelector('.cc-art'), artSrc = seg.art && CF && CF.ART[seg.art];
  art.innerHTML = artSrc ? `<img src="${artSrc}" alt="" draggable="false">` : `<span class="cc-sym">${emo(seg.icon)}</span>`;
  box.querySelector('.gl-rows').innerHTML = gl.results.map(r => {
    const p = pById(r.player);
    return p ? `<li><i style="background:${esc(p.color)}"></i><b>${esc(p.name)}</b><span>${deEmoji(esc(globalText(r.text)))}</span></li>` : '';
  }).join('');
  box.classList.remove('show'); box.hidden = false; void box.offsetWidth; box.classList.add('show');
  sfx.casinoEvent && sfx.casinoEvent(GLOBAL_SND.has(seg.key) ? seg.key : 'whim');   // every global event has its own sound; 'whim' only for an unknown key
  clearTimeout(box._t); box._t = setTimeout(() => (box.hidden = true), slow(8000));
}
$('#globalPopup').querySelectorAll('.pop-x, .btn').forEach(b => { b.onclick = () => { clearTimeout($('#globalPopup')._t); $('#globalPopup').hidden = true; }; });
let lastGlobalId = null;
function handleGlobal() {
  const gl = S.lastGlobal;
  if (lastGlobalId === null || !gl) { lastGlobalId = gl ? gl.id : 0; return; }   // first sync: don't replay an old spin
  if (gl.id === lastGlobalId) return;
  lastGlobalId = gl.id;
  scene.whenIdle(() => {
    scene.hold && scene.hold(7800);                // fade-in, ~5 s of spin, the highlight: the first turn waits
    wheelBusy = performance.now() + 9000;
    if (scene.globalWheel) { scene.globalWheel(GLOBAL_SEGS(), gl.key).then(() => { wheelBusy = 0; showGlobal(gl); evfx.global(gl); }); return; }   // modelled wheel on the board
    spinEventWheel({ segments: GLOBAL_SEGS(), target: gl.key, title: t('GLOBAL EVENT'), duration: slow(5200), big: true, onTick: f => sfx.wheelTick(f) })
      .then(seg => { if (seg) { showGlobal(gl); evfx.global(gl); } });
  });
}

// tools
function syncTools() {
  $('#muteBtn').classList.toggle('off', sfx.muted);
  $('#topSoundBtn').classList.toggle('off', sfx.muted);
  for (const b of [$('#muteBtn'), $('#topSoundBtn')]) { const k = sfx.muted ? 'speakerOff' : 'speaker'; if (b.dataset.icNow !== k) { b.dataset.icNow = k; b.innerHTML = ic(k); } }
  $('#settingsBtn').classList.toggle('on', settings.isOpen);
  settings.sync();
}
$('#resetViewBtn').onclick = () => scene && scene.resetView();
// the 1960s broadcast look: near black-and-white with soft scanlines
const broadcastOn = () => safeGet('mono.broadcast') === '1';
function setBroadcast(on) {
  safeSet('mono.broadcast', on ? '1' : '0');
  scene && scene.setBroadcast(on);
  syncTools();
}
const labelsAll = () => safeGet('mono.labels') === '1';
function setLabelsAll(on) { safeSet('mono.labels', on ? '1' : '0'); scene && scene.setLabels && scene.setLabels(on); syncTools(); }
// the speaker button mutes at once; volume and record are in the settings panel
$('#muteBtn').onclick = $('#topSoundBtn').onclick = () => { sfx.toggle(); syncTools(); };
$('#drawerBtn').onclick = () => document.body.classList.toggle('drawer-open');
if (innerWidth >= 1400) document.body.classList.add('drawer-open');

// ---- the settings panel (gear)
const sideLogOn = () => safeGet('mono.sideLog') !== '0';
const hoverOn = () => safeGet('mono.hover') !== '0';
const settings = createSettings({
  view: () => view, setView: v => setView(v),
  cam: () => camMode(), setCam: m => setCamMode(m, false), camOptions,
  isCity: () => view === 'city', labelStyle, setLabelStyle, labelsAll, setLabelsAll,
  quality, setQuality, broadcast: broadcastOn, setBroadcast,
  lang: () => lang, setLang: l => { setLang(l); labelTools(); syncTools(); if (S) render(); },
  ann: annLevel, setAnn: v => { safeSet('mono.annLevel', v); if (v === 'off') clearAnnouncer(); syncTools(); },
  sideLog: sideLogOn, setSideLog: on => { safeSet('mono.sideLog', on ? '1' : '0'); if (S) renderEventLog(); syncTools(); },
  hover: hoverOn, setHover: on => { safeSet('mono.hover', on ? '1' : '0'); syncTools(); },
  scale: () => scalePct, setScale: (pct, commit) => setUiScale(pct, commit),
  sfx, openGuide: () => openGuideNow(), after: () => syncTools(),
});
$('#settingsBtn').onclick = e => { e.stopPropagation(); settings.toggle(); syncTools(); };
$('#settingsBtn').addEventListener('keydown', e => { if (e.key === 'Escape' && settings.isOpen) { settings.close(); syncTools(); } });

// money counters animate toward their target
(function tickMoney() {
  requestAnimationFrame(tickMoney);
  document.querySelectorAll('.money[data-pid]').forEach(e => {
    const id = e.dataset.pid;
    if (moneyTarget[id] == null) return;
    let v = moneyShown[id] ?? moneyTarget[id];
    const d = moneyTarget[id] - v;
    v = Math.abs(d) < 1 ? moneyTarget[id] : v + d * 0.12;
    moneyShown[id] = v;
    e.textContent = cash(Math.round(v));
    e.classList.toggle('neg', v < 0);
  });
})();

// ---------------------------------------------------------------- game HUD

function renderGame() {
  ensureScene();
  scene.update(S);
  handleGlobal();
  handleCasino();                                   // queued first, so the wheel runs before money / turn card effects play

  // money: jump straight there the first time, then animate once moves finish
  for (const p of S.players) {
    if (moneyTarget[p.id] == null) moneyTarget[p.id] = moneyShown[p.id] = p.money;
    else {
      const m = p.money;
      scene.whenIdle(() => {
        const d = m - moneyTarget[p.id];
        if (d) { moneyDelta[p.id] = { d, at: performance.now() }; renderPlayers(); evfx.money(p.id, d); }
        moneyTarget[p.id] = m;
      });
    }
  }

  // dice result & turn banners
  if (lastRollId !== null && S.rollId !== lastRollId) {
    const rollId = S.rollId;
    scene.whenIdle(() => openTurnCard(rollId));
  }
  lastRollId = S.rollId;
  const turnKey = S.phase + ':' + S.turn + ':' + (cur() && cur().id);
  if (lastTurnKey !== null && turnKey !== lastTurnKey && myTurn()) scene.whenIdle(() => { flash(t('Your move.')); sfx.turn(); });
  lastTurnKey = turnKey;

  handleEvents();
  evfx.process();                                   // new log lines / timed effects → square and name-card animations
  handlePlays();
  handleGiftPrompt();
  handleBribePrompt();
  renderTopCenter();
  renderActions();
  renderTurnCard();
  renderPlayers();
  renderTurnBanner();
  renderHand();
  renderPick();
  renderEventLog();
  renderTradeBanner();
  renderFeed();
  $('#chatForm').hidden = !S.you;
  $('#emoteBtn').hidden = !S.you;
  $('#quitBtn').hidden = !S.you || S.phase !== 'playing' || (me().bankrupt && S.hostId !== S.you);
  if (modalKind === 'space') openSpace(selectedPos, true);
  if (S.phase === 'over' && !podiumShown) { podiumShown = true; scene.whenIdle(() => setTimeout(showPodium, slow(900))); }
  if (S.phase !== 'over') podiumShown = false;
}

// one-off happenings: money gifts, emotes, chaos events
function handleEvents() {
  const seq = S.eventSeq || 0;
  if (lastEventSeq === null || seq < lastEventSeq) { lastEventSeq = seq; return; }
  for (const e of S.events || []) {
    if (e.seq <= lastEventSeq) continue;
    if (e.type === 'emote') scene.emote(e.player, e.emoji);
    else if (e.type === 'gift') {
      scene.gift(e.from, e.to);
      const a = pById(e.from), b = pById(e.to);
      toast(t('{a} slid {amount} across the table. {b} got {got}.', { a: a?.name, b: b?.name, amount: cash(e.amount), got: cash(e.received) }));
    } else if (e.type === 'chaos') {
      scene.whenIdle(() => { flash(chaosName(e.name), 'headline', t('Extra! Extra!')); scene.chaos(e.key); toast(chaosDesc(e.desc)); });
    } else if (e.type === 'mafia') {
      if (e.kind === 'note' && e.player === S.you) scene.whenIdle(() => showMafiaNote());
      else if (e.kind === 'collect') scene.whenIdle(() => { evfx.mafiaCollect(e); showMafiaCollect(e); });
    }
  }
  lastEventSeq = seq;
}

function renderTopCenter() {
  const max = S.settings.maxRounds;
  const every = S.settings.globalEvery || 0, rd = S.round || 1, nextG = every ? (Math.floor(rd / every) + 1) * every : 0;
  const gHint = every && (!max || nextG <= max) ? (nextG - rd === 1 ? t('Global wheel next round') : t('Global wheel in {n} rounds', { n: nextG - rd })) : '';
  const chip = $('#roundChip');
  const roundTxt = (max ? t('Round {n} of {max}', { n: rd, max }) : t('Round {n}', { n: rd })) + (teamsMode() ? '  ·  2v2' : '');
  chip.innerHTML = `<span class="rc-main"${infoAttr('round', { text: roundTxt + (gHint ? ' · ' + gHint : '') })}>${ic('hourglass')}${esc(roundTxt)}</span>` + (gHint && nextG - rd <= 2 ? `<span class="rc-global"${infoAttr('global', { hint: gHint, every })}>${ic('roulette')}${nextG - rd}</span>` : '');
  const ev = S.event && S.event.round === S.round ? S.event : null;
  const b = $('#eventBanner');
  b.hidden = !ev;
  if (ev) b.innerHTML = `<b>${esc(chaosName(ev.name))}</b><span>${esc(chaosDesc(ev.desc))}</span>`;
}

// emote tray
$('#emoteBtn').onclick = () => {
  settings.close();
  const tray = $('#emoteTray');
  if (!tray.hidden) { tray.hidden = true; return; }
  tray.innerHTML = '';
  for (const e of (S && S.emotes) || []) {
    const b = el('button', 'emote', e);
    b.onclick = () => { act('emote', { emoji: e }); tray.hidden = true; };
    tray.append(b);
  }
  tray.hidden = false;
};

$('#quitBtn').onclick = () => {
  const my = me(), isHost = S.hostId === S.you;
  if (!my || S.phase !== 'playing') return;
  openModal('quit', `
    <h2 class="title" style="font-size:calc(var(--ui-scale,1)*26px)">${t('Leave the table?')}</h2>
    ${my.bankrupt ? '' : `<p>${t("<b>Quit</b>: you're out of the game. Your properties go back to the bank and the others keep playing{mate}.", { mate: teamsMode() ? t(' (your teammate plays on alone)') : '' })}</p>`}
    ${isHost ? `<p>${t('<b>End game for everyone</b>: stops the game now. The player or team with the highest net worth wins, and everyone sees the results.')}</p>` : ''}
    <div class="modal-actions">
      <button class="btn ghost" id="mClose">${t('Keep playing')}</button>
      ${my.bankrupt ? '' : `<button class="btn danger" id="quitMe">${t('Quit')}</button>`}
      ${isHost ? `<button class="btn" id="endAll">${t('End game for everyone')}</button>` : ''}
    </div>`);
  $('#mClose').onclick = closeModal;
  if ($('#quitMe')) $('#quitMe').onclick = () => { closeModal(); act('quit'); };
  if ($('#endAll')) $('#endAll').onclick = () => { closeModal(); act('endGame'); };
};

function openSendMoney() {
  const my = me(), mate = S.players.find(p => p.id !== my.id && p.team === my.team && !p.bankrupt);
  if (!mate) return;
  const tax = S.settings.teamTax, max = Math.max(0, my.money);
  openModal('gift', `
    <h2 class="title" style="font-size:calc(var(--ui-scale,1)*26px)">${t('Slide money to {name}', { name: esc(mate.name) })}</h2>
    <p class="muted">${t('Your team pays a {tax}% transfer fee. Your teammate has {money}', { tax, money: `<b>${cash(mate.money)}</b>` })}${mate.money < 0 ? t(' — they are in debt!') : '.'}</p>
    <input type="range" id="giftRange" min="0" max="${max}" step="${max >= 50000 ? 1000 : 1}" value="${Math.min(max, mate.money < 0 ? Math.ceil(-mate.money / (1 - tax / 100)) : Math.round(max / 4))}">
    <div class="gift-row">
      <label>${t('You send')} <input class="modal-input" type="number" id="giftAmount" min="1" max="${max}" step="1000"></label>
      <div class="gift-arrow">→</div>
      <div><small class="muted">${t('{name} receives', { name: esc(mate.name) })}</small><div id="giftReceived" class="gift-received"></div></div>
    </div>
    <div class="modal-actions"><button class="btn ghost" id="mClose">${t('Cancel')}</button><button class="btn" id="giftSend">${t('Send')}</button></div>`);
  const range = $('#giftRange'), input = $('#giftAmount');
  const sync = v => {
    v = Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    range.value = v; input.value = v;
    $('#giftReceived').textContent = cash(v - Math.round(v * tax / 100));
  };
  range.oninput = () => sync(range.value);
  input.oninput = () => sync(input.value);
  sync(range.value);
  $('#mClose').onclick = closeModal;
  $('#giftSend').onclick = async () => { await act('teamGift', { amount: Number(input.value) }); closeModal(); };
}

function showPodium() {
  if (S.phase !== 'over') return;
  const out = S.outOrder || [];
  const winners = S.winnerTeam != null ? S.players.filter(p => p.team === S.winnerTeam) : S.players.filter(p => p.id === S.winner);
  const ranked = [...S.players].sort((a, b) => {
    const wa = winners.includes(a) ? 1 : 0, wb = winners.includes(b) ? 1 : 0;
    if (wa !== wb) return wb - wa;
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    if (a.bankrupt) return out.indexOf(b.id) - out.indexOf(a.id);
    return b.worth - a.worth;
  });
  const award = (key, label) => {
    const best = [...S.players].sort((a, b) => (b.stats?.[key] || 0) - (a.stats?.[key] || 0))[0];
    return best && best.stats?.[key] ? `<div class="award"><b>${t(label)}</b><span>${esc(best.name)}</span></div>` : '';
  };
  const medals = ['1st', '2nd', '3rd', '4th'];
  const title = S.winnerTeam != null ? t('{name} take the pot.', { name: esc(S.teams[S.winnerTeam].name) }) : t('{name} takes the pot.', { name: esc(pById(S.winner)?.name || t('Nobody')) });
  openModal('podium', `
    <h2 class="title podium-title">${title}</h2>
    <div class="podium">${ranked.map((p, k) => `
      <div class="podium-row${winners.includes(p) ? ' win' : ''}">
        <span class="medal">${t(medals[k] || '')}</span>${badge(p)}
        <span class="pn">${esc(p.name)} ${teamTag(p)}</span>
        <span class="pw">${p.bankrupt ? t('bankrupt') : cash(p.worth)}</span>
      </div>`).join('')}</div>
    <div class="awards">
      ${award('rentEarned', 'The landlord')}${award('bought', 'Big spender')}${award('doubles', 'Loaded dice')}${award('jail', 'Jailbird')}${teamsMode() ? award('gifted', 'Loyal partner') : ''}
    </div>
    <div class="modal-actions">${canNewGame() ? `<button class="btn" id="podiumLobby">${t('Back to lobby')}</button>` : ''}<button class="btn ghost" id="mClose">${t('Look at the table')}</button></div>`);
  $('#mClose').onclick = closeModal;
  const back = $('#podiumLobby');
  if (back) back.onclick = () => { closeModal(); act('newGame'); };
}

// ---- the Mafia loan (optional rule)
const MAFIA_MIN = 200000, MAFIA_MAX = 3000000, MAFIA_STEP = 50000;   // mirrors server.js
const mafiaOffered = p => !!(S.settings.mafia && S.phase === 'playing' && p && !p.bankrupt && p.money < 0 && !p.loan && (p.loans || 0) < 2 && MAFIA_MAX + p.money >= 0);
const mafiaDue = (amount, turns) => Math.round(amount * (1 + 0.10 + 0.04 * turns + 0.02 * (amount / 250000)) / 10000) * 10000;
const mafiaOfferText = () => t('Borrow from the Mafia');
const declareBankruptcy = () => confirmBox(t('Declare bankruptcy? You will be out of the game.'), () => act('bankrupt'));

const mafiaCardW = () => (innerWidth < 600 ? 140 : 210);
function openBorrow(fromBankrupt) {
  const my = me();
  if (!mafiaOffered(my)) { if (fromBankrupt) declareBankruptcy(); return; }
  const lo = Math.max(MAFIA_MIN, Math.ceil(-my.money / MAFIA_STEP) * MAFIA_STEP);
  sfx.mafia();
  openModal('mafia-borrow', `
    <div class="mafia-modal">
      <div class="mafia-card">${faceHtml({ key: 'mafia-table', type: 'mafia', title: t('A Favour'), text: t('The Family can help. For a price.') }, mafiaCardW())}</div>
      <div class="mafia-terms">
        <h2 class="title" style="font-size:calc(var(--ui-scale,1)*24px)">${t('Borrow from the Mafia')}</h2>
        <label class="mf-sl">${t('Loan amount')}: <b id="mfAmt"></b><input type="range" id="mfAmount" min="${lo}" max="${MAFIA_MAX}" step="${MAFIA_STEP}" value="${Math.min(MAFIA_MAX, Math.max(lo, 1000000))}"></label>
        <label class="mf-sl">${t('Turns to repay')}: <b id="mfTurns"></b><input type="range" id="mfTurnsR" min="3" max="10" step="1" value="5"></label>
        <ul>
          <li>${t('Interest')}: <b id="mfPct"></b></li>
          <li>${t('You owe {due}', { due: '<b id="mfDue"></b>' })}</li>
          <li class="bad">${t('Miss it and they take your best property.')}</li>
        </ul>
        <small class="muted" id="mfEx"></small><br>
        <small class="muted">${t('Loans taken: {n} of 2', { n: my.loans || 0 })}</small>
        <p class="bad" id="mfWhy" hidden></p>
      </div>
    </div>
    <div class="modal-actions"><button class="btn ghost" id="mafiaNo">${t('Walk away')}</button><button class="btn danger" id="mafiaYes">${t('Take the money')}</button></div>`);
  const ra = $('#mfAmount'), rt = $('#mfTurnsR');
  const sync = () => {
    const amount = Number(ra.value), turns = Number(rt.value), due = mafiaDue(amount, turns), pct = Math.round((due / amount - 1) * 100);
    $('#mfAmt').textContent = cash(amount);
    $('#mfTurns').textContent = t('{n} turns', { n: turns });
    $('#mfPct').textContent = pct + '%';
    $('#mfDue').textContent = cash(due);
    $('#mfEx').textContent = t('Borrow {amount} for {n} turns → repay {due} ({pct}%)', { amount: cash(amount), n: turns, due: cash(due), pct });
    const short = my.money + amount < 0;
    $('#mfWhy').hidden = !short;
    $('#mfWhy').textContent = short ? t('This amount does not cover your debt.') : '';
    $('#mafiaYes').disabled = short;
  };
  ra.oninput = rt.oninput = sync;
  sync();
  $('#mafiaNo').onclick = () => { closeModal(); if (fromBankrupt) declareBankruptcy(); };
  $('#mafiaYes').onclick = () => { const amount = Number(ra.value), turns = Number(rt.value); closeModal(); act('borrowMafia', { amount, turns }); };
}

function openRepay() {
  const my = me(), L = my && my.loan;
  if (!L) return;
  const max = Math.max(0, Math.min(my.money, L.due));
  const reason = !myTurn() ? t('Only on your turn.') : !['roll', 'end'].includes(S.turnState) || S.pending ? t('Finish your move first.') : my.money <= 0 ? t('You have no cash to repay with.') : '';
  const step = max >= 50000 ? 10000 : 1000;
  openModal('mafia-repay', `
    <h2 class="title" style="font-size:calc(var(--ui-scale,1)*26px)">${ic('fedora', { cls: 'ic-title' })} ${t('Repay the Mafia')} <button class="info-q"${infoAttr('mafia', { due: cash(L.due), left: L.turnsLeft === 1 ? t('1 turn') : t('{n} turns', { n: L.turnsLeft }) })} aria-label="${esc(t('What is this?'))}">?</button></h2>
    <p>${t('You owe {due}. You have {cash}.', { due: `<b>${cash(L.due)}</b>`, cash: `<b>${cash(my.money)}</b>` })} ${L.turnsLeft === 1 ? t('1 turn') : t('{n} turns', { n: L.turnsLeft })} ${t('left')}.</p>
    <input type="range" id="repRange" min="0" max="${max}" step="${step}" value="${max}" ${reason ? 'disabled' : ''}>
    <div class="gift-row"><label>${t('You pay')} <input class="modal-input" type="number" id="repAmount" min="0" max="${max}" step="${step}" ${reason ? 'disabled' : ''}></label><div><small class="muted">${t('Still owed')}</small><div id="repLeft" class="gift-received"></div></div></div>
    ${reason ? `<p class="bad" id="repReason">${esc(reason)}</p>` : ''}
    ${!reason && my.money < L.due ? `<small class="muted">${t('You can only pay part of it for now.')}</small>` : ''}
    <div class="modal-actions"><button class="btn ghost" id="mClose">${t('Cancel')}</button><button class="btn ghost" id="repFull" ${reason || my.money < L.due ? 'disabled' : ''}>${t('Pay it all ({amount})', { amount: cash(L.due) })}</button><button class="btn" id="repGo" ${reason ? 'disabled' : ''}>${t('Pay')}</button></div>`);
  const rg = $('#repRange'), inp = $('#repAmount');
  const sync = v => {
    v = Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    rg.value = v; inp.value = v;
    $('#repLeft').textContent = cash(L.due - v);
    $('#repGo').disabled = !!reason || v <= 0;
  };
  rg.oninput = () => sync(rg.value);
  inp.oninput = () => sync(inp.value);
  sync(max);
  $('#mClose').onclick = closeModal;
  $('#repFull').onclick = () => { closeModal(); act('repayMafia'); };
  $('#repGo').onclick = () => { const v = Number(inp.value); closeModal(); act('repayMafia', { amount: v }); };
}

// an envelope slides under a door at the bottom of the screen, then the note card
function showMafiaNote() {
  const my = me(), L = my && my.loan;
  const door = el('div', 'mafia-door', '<div class="md-door"><i class="md-knob"></i></div><div class="md-floor"></div><div class="md-env"><span></span></div>');
  document.body.append(door);
  sfx.mafiaNote();
  const env = door.querySelector('.md-env');
  door.animate([{ opacity: 0 }, { opacity: 1 }], { duration: slow(350), fill: 'forwards' });
  env.animate([{ transform: 'translate(0, -4px) rotate(-5deg)' }, { transform: 'translate(0, 46px) rotate(-3deg)' }], { duration: slow(1500), delay: slow(500), easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
  setTimeout(() => {
    door.animate([{ opacity: 1 }, { opacity: 0 }], { duration: slow(500), fill: 'forwards' }).finished.then(() => door.remove(), () => door.remove());
    if (!$('#modal').hidden && modalKind !== 'mafia-note') return;
    openModal('mafia-note', `
      <div class="mafia-modal"><div class="mafia-card">${faceHtml({ key: 'mafia-note', type: 'mafia', title: t('Two turns.'), text: t('— The Family') }, mafiaCardW())}</div>
      <div class="mafia-terms"><p>${L ? t('Repay {due} before your loan runs out.', { due: `<b>${cash(L.due)}</b>` }) : ''}</p><small class="muted">${deEmoji(esc(t('Use the 🎩 on your panel to repay.')))}</small></div></div>
      <div class="modal-actions"><button class="btn" id="mClose">${t('OK')}</button></div>`);
    $('#mClose').onclick = closeModal;
  }, slow(2300));
}

// everyone sees what the Mafia took
function showMafiaCollect(e) {
  const who = pById(e.player), name = e.pos != null && S.board[e.pos] ? S.board[e.pos].name : e.name;
  const line = e.out ? t('The Mafia came to collect — {name} is out.', { name: who ? who.name : '?' })
    : name ? t('The Mafia came to collect: {name} lost {tile}.', { name: who ? who.name : '?', tile: splitName(name)[0] })
    : t('The Mafia collected {amount} from {name}. The debt is settled.', { amount: cash(e.paid || 0), name: who ? who.name : '?' });
  sfx.mafia();
  if (modalKind && !$('#modal').hidden) { toast(line); return; }
  openModal('mafia-collect', `
    <div class="mafia-modal"><div class="mafia-card">${faceHtml({ key: 'mafia-table', type: 'mafia', title: e.out || name ? t('The Family collects') : t('Paid in full'), text: line }, mafiaCardW())}</div>
    <div class="mafia-terms"><p>${ic('gun', { cls: 'ic-inline' })} ${esc(line)}</p></div></div>
    <div class="modal-actions"><button class="btn" id="mClose">${t('OK')}</button></div>`);
  $('#mClose').onclick = closeModal;
  setTimeout(() => { if (modalKind === 'mafia-collect') closeModal(); }, slow(9000));
}

const debtText = my => t('You owe {amount}. Tap your properties to mortgage or sell levels{mate}.', { amount: cash(-my.money), mate: teamsMode() ? t(', or ask your teammate to send you money') : '' });

function renderActions() {
  const status = $('#status'), actions = $('#actions');
  actions.innerHTML = '';
  if (S.phase === 'playing' && myTurn() && scene && !scene.isIdle()) {
    // let the dice land and the token finish walking before showing choices
    status.textContent = '…';
    scene.whenIdle(() => renderActions());
    return;
  }
  const my = me();
  const add = (label, fn, cls = '') => { const b = el('button', 'btn ' + cls, label); b.onclick = fn; actions.append(b); return b; };
  const addOpt = (o, fn, cls = '') => {            // a choice with its reason written under it when it can't be taken
    const box = el('div', 'opt'), b = el('button', 'btn ' + cls, esc(o.label));
    b.onclick = fn; b.disabled = !o.ok; box.append(b);
    if (!o.ok && o.reason) box.append(el('small', 'opt-reason', esc(o.reason)));
    actions.append(box);
  };

  if (S.phase === 'over') {
    const w = pById(S.winner);
    status.innerHTML = S.winnerTeam != null ? t('{name} take the pot.', { name: esc(S.teams[S.winnerTeam].name) }) : w ? t('{name} takes the pot.', { name: esc(w.name) }) : t('Game over.');
    add(t('Results'), showPodium, 'ghost');
    if (canNewGame()) add(t('Back to lobby'), () => act('newGame'), 'big');
    $('#jackpotInfo').textContent = '';
    return;
  }
  const c = cur();
  if (!myTurn()) {
    status.innerHTML = `${badge(c)} <span>${t('{name} is playing{jail}…', { name: esc(c.name), jail: c.inJail ? t(' (in jail)') : '' })}</span>`;
  } else {
    status.textContent = c.inJail ? t("You're stuck in {jail}. Try {n} of 3.", { jail: S.board[10].name, n: c.jailTurns + 1 }) : t('Your move.');
    if (S.turnState === 'roll') {
      if (c.inJail) {
        add(t('Roll for doubles'), () => act('roll'), 'big roll').disabled = c.money < 0;
        add(t('Pay {amount}', { amount: cash(JAIL_FINE) }), () => act('payJail'), 'ghost').disabled = c.money < JAIL_FINE;
        if (c.jailCards) add(t('Use free card ({n})', { n: c.jailCards }), () => act('jailCard'), 'ghost');
      } else {
        if (taxiReady()) add(ic('taxi') + t('Take the taxi'), openTaxiPick, 'big').disabled = c.money < 0;   // the cab replaces the dice this turn
        else add(t('Roll the dice'), () => act('roll'), 'big roll').disabled = c.money < 0;
      }
    } else if (S.turnState === 'buy' && S.pending) {
      const sp = S.board[S.pending.pos];
      status.textContent = t('Buy {name}?', { name: sp.name });
      buyOptions(sp, c).forEach((o, k) => addOpt(o, () => act('buy', o.arg), k === 0 ? 'big' : ''));
      add(t('Pass'), () => act('pass'), 'ghost');
      add(t('Details'), () => openSpace(sp.i), 'ghost small');
    } else if (S.turnState === 'upgrade' && S.pending) {
      const sp = S.board[S.pending.pos];
      status.textContent = t('Upgrade {name}?', { name: sp.name });
      upgradeOptions(sp, S.props[sp.i], c).forEach(o => addOpt(o, () => act('upgrade', o.arg)));
      add(t('Skip'), () => act('pass'), 'ghost');
    } else if (S.turnState === 'buyout' && S.pending) {
      const sp = S.board[S.pending.pos], o = buyoutOption(sp, c);
      status.textContent = t('Buy out {name}?', { name: sp.name });
      addOpt(o, () => act('buyout'), 'big');
      add(t('No thanks'), () => act('pass'), 'ghost');
    } else if (S.turnState === 'crime' && S.pending) {
      status.textContent = t('A crime wave hits your tiles!');
      crimeOptions(c).forEach((o, k) => addOpt(o, () => act(o.act), k === 0 ? 'big' : 'ghost'));
    } else if (S.turnState === 'gift' && S.pending) {
      status.textContent = t('Mayor’s Gift: pick a tile to bless.');
      add(t('Choose a tile'), openGiftPick, 'big');
    } else if (S.turnState === 'bribe' && S.pending) {
      status.textContent = t('Bribe the police: pick who goes to jail.');
      add(t('Choose an opponent'), openBribePick, 'big');
    } else if (S.turnState === 'end') {
      add(t('End turn'), () => act('endTurn'), 'big').disabled = c.money < 0;
    }
  }
  if (turnCard && turnCard.collapsed && turnCardLive()) add(t('Show'), () => { turnCard.collapsed = false; renderTurnCard(); }, 'ghost small');
  if (my && my.money < 0 && !my.bankrupt) {
    actions.append(el('div', 'debt', debtText(my)));
    if (mafiaOffered(my)) add(mafiaOfferText(), () => openBorrow(false));
    add(t('Declare bankruptcy'), () => (mafiaOffered(my) ? openBorrow(true) : declareBankruptcy()), 'danger small');
  }
  $('#jackpotInfo').textContent = S.settings.jackpot ? t('{name} jackpot: {amount}', { name: S.board[20].name, amount: cash(S.jackpot) }) : '';
}

// ---------------------------------------------------------------- the turn card
// After every roll, once the dice and the piece have stopped, a card in the middle of the screen
// says who rolled what, where they landed, what it did to them and, on your turn, what you can do.
let photos = {};
fetch('/assets/photos/index.json').then(r => (r.ok ? r.json() : {})).then(j => { photos = j || {}; }).catch(() => {});
let turnCard = null;                       // { rollId, player, at, html, collapsed }
const LINGER = 4500;                       // others' cards stay readable a moment after their turn ends

// the latest dice roll in the log, and who made it (a quick bot may already have ended its turn)
function lastRoll() {
  for (let k = S.log.length - 1; k >= 0; k--) {
    const l = S.log[k], m = !l.chat && /^(.+) rolled \d+ \+ \d+/.exec(l.text);
    if (m) return { k, player: S.players.find(p => p.name === m[1]) };
  }
  return null;
}
function openTurnCard(rollId) {
  if (!S || S.phase !== 'playing' || S.rollId !== rollId) return;
  const roll = lastRoll();
  if (!roll || !roll.player) return;
  dismissCardNow();                        // a drawn card's text is in the story
  turnCard = { rollId, player: roll.player.id, at: performance.now(), collapsed: false };
  renderTurnCard();
}
const turnCardLive = () => turnCard && S.phase === 'playing' && cur() && cur().id === turnCard.player && S.rollId === turnCard.rollId;

// what happened after this roll, up to the end of that player's turn (the landing is the header)
function rollStory() {
  const roll = lastRoll();
  if (!roll) return [];
  const out = [];
  for (const l of S.log.slice(roll.k + 1)) {
    if (l.chat) continue;
    if (String(l.text).startsWith('—')) break;
    if (!/ landed on |^\S+ (Payday|Golden GO|Rent Boom|Market Crash|Lottery|Tax Day|Lucky Doubles|Storm)! /.test(l.text)) out.push(l.text);
  }
  return out;
}

// the facts of the square: who owns it, what it costs, what it charges
function tileFacts(sp) {
  const st = S.props[sp.i], owner = st && pById(st.owner), facts = [];
  const kind = { property: t('Property'), railroad: meta().rail || 'Railroad', utility: t('Utility'), tax: t('Tax'), chance: t('Card'), chest: t('Card'), casino: t('Casino') }[sp.type] || t('Corner');
  if (['property', 'railroad', 'utility'].includes(sp.type)) {
    if (!owner) {
      facts.push(`<b>${t('For sale')}</b> · ${cash(sp.price)}`);
      if (sp.type === 'property') facts.push(t('Rent {amount} · ×1.5 with the full set', { amount: cash(sp.rent[1]) }));
    } else {
      facts.push(`<b>${owner.id === S.you ? t('Yours') : t('Owned by {name}', { name: esc(owner.name) })}</b>`);
      if (st.mortgaged) facts.push(t('Mortgaged'));
      else if (sp.type === 'property') {
        facts.push(`${levelName(st.level)} · ` + t('Rent here: {amount}', { amount: cash(Math.round(rentAt(sp, st.level, owner.id) * rentMult() * effectMult(S, sp))) }));
      } else if (sp.type === 'railroad') {
        const n = S.board.filter(s => s.type === 'railroad' && S.props[s.i] && S.props[s.i].owner === owner.id).length;
        facts.push(t('Rent here: {amount}', { amount: cash(Math.round(railRent(n) * rentMult() * effectMult(S, sp))) }));
      } else {
        const n = S.board.filter(s => s.type === 'utility' && S.props[s.i] && S.props[s.i].owner === owner.id).length;
        facts.push(t('Rent here: {amount} × the dice', { amount: cash(utilPerPip(n)) }));
      }
    }
  } else if (sp.type === 'tax') facts.push(`${t('Pay')} ${cash(sp.amount)}`);
  else if (sp.type === 'casino') facts.push(t('Try your luck: a card from the dealer, or a spin of the wheel.'));
  for (const e of effectTags(S, sp)) facts.push(fxTagHtml(e, sp));
  return { kind, facts };
}

const waitLine = p => (S.turnState === 'crime' ? t('{name} is facing a crime wave…', { name: esc(p.name) })
  : S.turnState === 'gift' ? t('{name} is choosing a tile to bless…', { name: esc(p.name) })
  : S.turnState === 'bribe' ? t('{name} is bribing the police…', { name: esc(p.name) })
  : S.turnState === 'upgrade' ? t('{name} is choosing upgrades…', { name: esc(p.name) })
  : S.turnState === 'buyout' ? t('{name} is weighing a buyout…', { name: esc(p.name) }) : t('Waiting for {name}…', { name: esc(p.name) }));

function turnCardHtml(p, mine, live) {
  const sp = S.board[p.pos], [a, b] = S.dice;
  const [name, city] = splitName(sp.name);
  const photo = photos[slug(sp.name)];
  const band = sp.color || (sp.type === 'railroad' ? '#2a221b' : '');
  const { kind, facts } = tileFacts(sp);
  let lastRent = null;
  const story = rollStory().map(x => {
    let m = /^(.+) paid (.+) rent to (.+)\.$/.exec(x);
    if (m) lastRent = m[2];
    if (lastRent && (m = /^⚖ Rent split: (.+) keeps (.+), (.+) gets (.+) \(\d+%\)\.$/.exec(x))) return `<li>${ic('scales', { cls: 'ic-inline' })} ${esc(t('Rent {total} → {a} {x} · {b} {y}', { total: lastRent, a: m[1], x: m[2], b: m[3], y: m[4] }))}</li>`;
    return `<li>${deEmoji(esc(tr(x)))}</li>`;
  }).join('');
  let acts = '', note = '';
  if (mine) {
    const opt = (o, tc, cls = '') => `<div class="tc-opt"><button class="btn ${cls}" data-tc="${tc}" ${Object.entries(o.arg || {}).map(([k, v]) => `data-${k}="${v}"`).join(' ')} ${o.ok ? '' : 'disabled'}>${esc(o.label)}</button>${!o.ok && o.reason ? `<small class="opt-reason">${esc(o.reason)}</small>` : ''}</div>`;
    const bp = S.pending && S.board[S.pending.pos];
    if (S.turnState === 'buy' && bp) {
      const opts = buyOptions(bp, p);
      acts = opts.map((o, k) => opt(o, 'buy', k === 0 ? 'big' : '')).join('')
        + `<button class="btn ghost" data-tc="pass">${t('Pass')}</button><button class="btn ghost small" data-tc="details">${t('Details')}</button>`;
      if (!opts[0].ok) note = t('Not enough cash. Mortgage something first, or pass.');
    } else if (S.turnState === 'upgrade' && bp) {
      note = t('{lvl} now · upgrade cost {cost} per level', { lvl: levelName(S.props[bp.i].level), cost: cash(bp.houseCost) });
      acts = upgradeOptions(bp, S.props[bp.i], p).map(o => opt(o, 'upgrade')).join('') + `<button class="btn ghost" data-tc="pass">${t('Skip')}</button>`;
    } else if (S.turnState === 'buyout' && bp) {
      acts = opt(buyoutOption(bp, p), 'buyout', 'big') + `<button class="btn ghost" data-tc="pass">${t('No thanks')}</button>`;
    } else if (S.turnState === 'crime' && S.pending) {
      note = t('A crime wave hits your tiles!');
      acts = crimeOptions(p).map((o, k) => opt({ ...o, arg: null }, o.act, k === 0 ? 'big' : 'ghost')).join('');
    } else if (S.turnState === 'gift' && S.pending) {
      note = t('Mayor’s Gift: pick a tile to bless.');
      acts = `<button class="btn big" data-tc="giftpick">${t('Choose a tile')}</button>`;
    } else if (S.turnState === 'bribe' && S.pending) {
      note = t('Bribe the police: pick who goes to jail.');
      acts = `<button class="btn big" data-tc="bribepick">${t('Choose an opponent')}</button>`;
    } else if (S.turnState === 'end') acts = `<button class="btn big" data-tc="endTurn">${t('End turn')}</button>`;
    else if (S.turnState === 'roll' && !p.inJail) acts = taxiReady() ? `<button class="btn big" data-tc="taxipick">${ic('taxi')}${t('Take the taxi')}</button>` : `<button class="btn big roll" data-tc="roll">${t('Roll again')}</button>`;
    if (['roll', 'end'].includes(S.turnState) && !S.pending) acts += squattedMine().slice(0, 3).map(sp => opt(evictOption(sp, p, true), 'evict', 'ghost')).join('');
    if (p.money < 0) note = debtText(p);
    if (mafiaOffered(p)) acts += `<button class="btn" data-tc="borrow">${esc(mafiaOfferText())}</button>`;
  }
  return `
    ${band ? `<div class="tc-band" style="background:${band}"></div>` : ''}
    ${photo ? `<div class="tc-photo" style="background-image:url('/assets/photos/${photo}')"></div>` : ''}
    <button class="tc-hide" data-tc="hide">${t('Hide')}</button>
    <div class="tc-body">
      <div class="tc-kicker">${badge(p)}<span>${esc(p.name)} · ${t('rolled {a} + {b} = {sum}', { a, b, sum: a + b })}${a === b ? ' · ' + t('doubles') : ''}</span></div>
      <div class="tc-type">${esc(kind)}</div>
      <div class="tc-name">${esc(name)}</div>${city ? `<div class="tc-city">${esc(city)}</div>` : ''}
      ${facts.length ? `<div class="tc-facts">${facts.join('<br>')}</div>` : ''}
      ${story ? `<ul class="tc-story">${story}</ul>` : ''}
      ${note ? `<div class="tc-note">${esc(note)}</div>` : ''}
      ${acts ? `<div class="tc-actions">${acts}</div>` : mine || !live ? '' : `<div class="tc-wait">${waitLine(p)}</div>`}
    </div>`;
}

let lingerTimer = null;
function renderTurnCard() {
  const box = $('#turnCard');
  const live = turnCardLive(), now = performance.now();
  if (live || (turnCard && !turnCard.html)) {   // a turn that already ended still gets its card, read-only
    const p = pById(turnCard.player), mine = live && p.id === S.you;
    turnCard.mine = mine;
    turnCard.html = turnCardHtml(p, mine, live);
    if (scene) scene.select(p.pos);
  }
  const linger = turnCard && !live && !turnCard.mine && S.rollId === turnCard.rollId && now - turnCard.at < slow(LINGER) && S.phase === 'playing';
  const show = !!(turnCard && (live || linger) && !turnCard.collapsed && turnCard.html);
  box.hidden = !show;
  const my = me();
  document.body.classList.toggle('turncard-mine', show && live && turnCard.mine && my && my.money >= 0);
  document.body.classList.toggle('turncard-centre', show && live && turnCard.mine && S.turnState === 'upgrade');   // the upgrade choice always sits in the middle
  if (!show) { if (scene && selectedPos == null) scene.select(-1); return; }
  if (box._html !== turnCard.html) {
    box.innerHTML = box._html = turnCard.html;
    box.querySelectorAll('[data-tc]').forEach(b => b.onclick = () => {
      const a = b.dataset.tc;
      if (a === 'hide') { turnCard.collapsed = true; renderTurnCard(); renderActions(); }
      else if (a === 'details') openSpace(S.pending ? S.pending.pos : cur().pos);
      else if (a === 'giftpick') openGiftPick();
      else if (a === 'taxipick') openTaxiPick();
      else if (a === 'bribepick') openBribePick();
      else if (a === 'borrow') openBorrow(false);
      else act(a, b.dataset.level ? { level: Number(b.dataset.level) } : b.dataset.to ? { to: Number(b.dataset.to) } : b.dataset.pos ? { pos: Number(b.dataset.pos) } : {});
    });
  }
  if (linger) { clearTimeout(lingerTimer); lingerTimer = setTimeout(renderTurnCard, slow(LINGER) - (now - turnCard.at) + 30); }
}

// the last change to a player's cash, typed beside it for a few seconds (survives re-renders)
function deltaTag(id) {
  const m = moneyDelta[id], age = m ? performance.now() - m.at : 1e9;
  if (age > 3500) return '';
  return `<span class="delta ${m.d > 0 ? 'up' : 'down'}" style="animation-delay:-${Math.round(age)}ms">${m.d > 0 ? '+' : '−'}${fmtMoney(Math.abs(m.d), '')}</span>`;
}

// the small labelled chips under a player's money. Built from one list so later rules (police shutdown,
// gang, mayor bonus, squatters, audit…) only need to put entries in p.effects or S.effects[p.id]:
// each is a string or { key, label, icon, tone }.
// a timed-effect tag on a tile (turn card, deed): hover for the hint, click for the full card
const fxTagHtml = (e, sp) => `<span class="fx-tag ${e.tone}"${infoAttr(INFO_FX.has(e.kind) ? 'fx-' + e.kind : 'fx-generic', { tile: splitName(sp.name)[0].replace(/,.*$/, ''), left: e.turnOf ? t('until their next turn') : e.n === 1 ? t('1 round left') : t('{n} rounds left', { n: e.n }), label: stripEmoji(e.text) })}>${deEmoji(esc(e.text))}</span>`;
const INFO_FX = new Set(['police', 'mayor', 'gang', 'squatters', 'crime', 'gift', 'shootout-win', 'shootout-loss']);
function playerEffects(p) {
  const out = [];
  if (p.bankrupt) out.push({ key: 'bankrupt', icon: '💀', label: t('Bankrupt'), tone: 'bad', info: { key: 'bankrupt' } });
  else {
    if (p.drunk) out.push({ key: 'drunk', icon: '🥃', label: t('Next roll ½'), short: '½', tone: 'bad', info: { key: 'drunk' } });
    if (p.taxi) out.push({ key: 'taxi', icon: '🚕', label: t('Taxi ready'), short: t('ready'), tone: 'good', info: { key: 'taxi' } });
    if (p.inJail) out.push({ key: 'jail', icon: '⛓', label: t('In jail'), tone: 'bad', info: { key: 'jail', p: { fine: cash(JAIL_FINE) } } });
    if (p.money < 0) out.push({ key: 'debt', icon: '💸', label: t('In debt'), tone: 'bad', info: { key: 'debt' } });
    const mort = S.board.filter(sp => S.props[sp.i] && S.props[sp.i].owner === p.id && S.props[sp.i].mortgaged).length;
    if (mort) out.push({ key: 'mortgaged', icon: '🔒', label: t('Mortgaged ×{n}', { n: mort }), short: String(mort), tone: 'warn', info: { key: 'mortgaged', p: { n: mort } } });
  }
  // timed effects (casino…): on a tile they own, or on a colour group where they own tiles
  const owned = S.board.filter(sp => S.props[sp.i] && S.props[sp.i].owner === p.id);
  for (const e of activeEffects(S)) {
    if (e.owner != null && e.owner !== p.id) continue;
    const hit = e.pos != null ? owned.filter(sp => sp.i === e.pos) : e.city ? owned.filter(sp => sp.type === 'property') : e.group != null ? owned.filter(sp => sp.group === e.group) : [];
    if (!hit.length) continue;
    const n = Math.max(1, e.until - S.round);
    const where = e.pos != null ? splitName(hit[0].name)[0].replace(/,.*$/, '') : effectLabel(e.label || e.kind).replace(/^.*?:\s*/, '');
    const label = e.kind === 'police' ? t('Police: {tile}', { tile: where }) : e.kind === 'mayor' ? t('Mayor: {tile}', { tile: where }) : e.kind === 'gang' ? t('Gang: {group}', { group: where }) : e.pos != null ? effectLabel(e.label || e.kind).replace(/\s?:.*$/, ': ' + where) : effectLabel(e.label || e.kind);
    const left = e.untilTurnOf != null ? t('until their next turn') : n === 1 ? t('1 round left') : t('{n} rounds left', { n });
    out.push({ key: 'fx' + e.id, info: { key: INFO_FX.has(e.kind) ? 'fx-' + e.kind : 'fx-generic', p: { tile: where, left, label } }, icon: EFFECT_ICON[e.kind] || '✦', label: `${label} · ${e.untilTurnOf != null ? t('next turn') : t('{n} rds', { n })}`, short: e.untilTurnOf != null ? t('next') : String(n), tone: e.mult === 0 ? 'bad' : e.mult > 1 ? 'good' : 'warn', raw: true });
  }
  if (!p.bankrupt && p.auditUntil > S.round) out.push({ key: 'audit', icon: '🧾', label: t('Audit · {n} rds', { n: p.auditUntil - S.round }), short: String(p.auditUntil - S.round), tone: 'warn', info: { key: 'audit', p: { n: p.auditUntil - S.round } } });
  const extra = [...(Array.isArray(p.effects) ? p.effects : []), ...(S.effects && !Array.isArray(S.effects) && Array.isArray(S.effects[p.id]) ? S.effects[p.id] : [])];
  for (const e of extra) { const o = typeof e === 'string' ? { key: e, label: t(e), tone: 'warn' } : { tone: 'warn', ...e, label: t(e.label || e.key) }; o.info = { key: 'fx-generic', p: { label: o.label } }; out.push(o); }
  return out;
}

// 2v2 rent sharing: every panel shows its team's share; my own panel (and the drawer on phones) has the slider
let shareDrag = false;
function shareRow(p, inDrawer) {
  if (!teamsMode() || !S.teamShare || S.phase !== 'playing' || p.bankrupt) return '';
  const pct = S.teamShare[p.team] || 0, mine = p.id === S.you && !inDrawer;
  const my = me(), canSet = !!my && !my.bankrupt && S.turn === S.players.indexOf(my);
  const head = `<span class="sh-l"${infoAttr('share', { pct })}>${ic('scales')}${t('Share to mate')}</span><b class="sh-v">${pct}%</b>`;
  if (!mine && !inDrawer) return `<div class="pc-share">${head}</div>`;
  return `<div class="pc-share has-ctl"><div class="sh-top">${head}</div>
    <input type="range" class="sh-range" min="0" max="100" step="10" value="${pct}" ${canSet ? '' : 'disabled'} aria-label="${esc(t('Share to mate'))}">
    ${canSet ? '' : `<small class="sh-why">${t('On your turn')}</small>`}</div>`;
}
function wireShare(root) {
  const r = root.querySelector('.sh-range');
  if (!r) return;
  const v = root.querySelector('.sh-v');
  r.oninput = () => { if (v) v.textContent = r.value + '%'; };
  r.onpointerdown = () => { shareDrag = true; };
  const done = () => { shareDrag = false; };
  r.onchange = () => { done(); act('setShare', { pct: Number(r.value) }); };
  r.onpointerup = r.onpointercancel = r.onblur = done;
}
function renderShareDrawer() {
  const box = $('#shareCtl'); if (!box) return;
  const my = me();
  const html = my && teamsMode() ? shareRow(my, true) : '';
  box.hidden = !html;
  if (shareDrag && box._html) return;
  if (box._html !== html) { box.innerHTML = box._html = html; wireShare(box); }
}

function playerCard(p, idx, isHost) {
  const my = me();
  const owned = S.board.filter(sp => S.props[sp.i] && S.props[sp.i].owner === p.id);
  const turn = S.phase === 'playing' && idx === S.turn && !p.bankrupt;
  const card = el('div', `pcard slot${idx % 4}${turn ? ' turn' : ''}${turn && p.id === S.you ? ' mine' : ''}${p.bankrupt ? ' out' : ''}`);
  card.style.setProperty('--pc', p.color); card.dataset.pid = p.id;
  const team = teamsMode() && S.teams && S.teams[p.team];
  const fx = playerEffects(p).map(e => `<span class="fx ${e.tone || ''}"${infoAttr(e.info.key, e.info.p)}><i>${emo(e.icon || '✦')}</i>${e.short ? `<b>${esc(e.short)}</b>` : ''}</span>`).join('');
  const loan = !p.bankrupt && p.loan && typeof p.loan === 'object' ? p.loan : null;   // mafia debt
  const loanLeft = loan ? Math.max(0, Math.round(Number(loan.turnsLeft) || 0)) : 0;
  const loanBtn = !!loan && p.id === S.you && myTurn();   // on your own turn the slot opens the repay modal
  const loanLeftTxt = loanLeft === 1 ? t('1 turn') : t('{n} turns', { n: loanLeft });
  const loanInfo = loan ? { due: cash(loan.due != null ? loan.due : loan.amount), left: loanLeftTxt } : null;
  const loanHtml = loan ? `<${loanBtn ? 'button' : 'div'} class="pc-debt${loanLeft <= 2 ? ' urgent' : ''}${loanBtn ? ' btn-slot' : ''}"${infoAttr(loanBtn ? 'mafia-mine' : 'mafia', loanInfo, loanBtn ? 'tip' : 'info')}><i>${ic('fedora')}</i><span>${t('Mafia: {amount} due', { amount: cash(loan.due != null ? loan.due : loan.amount) })}</span><b>${loanLeft === 1 ? t('1 turn') : t('{n} turns', { n: loanLeft })}</b></${loanBtn ? 'button' : 'div'}>` : '';
  const fxN = playerEffects(p).length;
  const hand = p.id === S.you ? ((S.mine && S.mine.hand) || []).length : (p.handCount || 0);
  const handHtml = hand ? (p.id === S.you ? `<button class="hc-n mine"${infoAttr('hand-mine', { n: hand }, 'tip')}>${ic('cards')}${hand}</button>` : `<span class="hc-n"${infoAttr('hand', { n: hand })}>${ic('cards')}${hand}</span>`) : '';
  card.innerHTML = `
    <div class="pc-head">
      ${badge(p)}
      <div class="pname"><span class="pn">${esc(p.name)}</span><span class="dot${p.connected ? '' : ' off'}"${infoAttr(p.connected ? 'online' : 'offline')}></span>
        ${p.bot ? `<span class="you"${infoAttr('bot')}>${t('bot')}</span>` : ''}${p.id === S.you ? `<span class="you"${infoAttr('you')}>${t('you')}</span>` : ''}${team ? `<span class="you team" style="--tc:${team.color}"${infoAttr('team', { name: team.name, rent: t(S.settings.teamRent === 'full' ? 'full rent' : S.settings.teamRent === 'none' ? 'no rent' : 'half rent') })}>${esc(team.name)}</span>` : ''}</div>
    </div>
    ${turn ? `<span class="turn-tag"${infoAttr('turn', { name: p.name })}>${p.id === S.you ? t('YOUR TURN') : t("{name}'S TURN", { name: esc(p.name) })}</span>` : ''}
    <div class="pc-money"><span class="money" data-pid="${p.id}">${cash(Math.round(moneyShown[p.id] ?? p.money))}</span>${deltaTag(p.id)}<span class="pc-mini">${fxN ? `<em${infoAttr('fxcount', { n: fxN })}>${ic('sparkle')}${fxN}</em>` : ''}${loan ? `<em class="mf${loanLeft <= 2 ? ' urgent' : ''}"${infoAttr('mafia', loanInfo)}>${ic('fedora')}</em>` : ''}</span><span class="worth"${infoAttr('worth', { amount: cash(p.worth || 0) })}>${t('worth {amount}', { amount: cash(p.worth || 0) })}</span></div>
    <div class="pc-props"><span class="pc-pn"${infoAttr('props', { n: owned.length })}>${ic('house')}${owned.length}</span><span class="sub"></span>${handHtml}</div>
    ${loanHtml}
    ${fx ? `<div class="pc-fx">${fx}</div>` : ''}
    ${shareRow(p)}
    <div class="pc-btns"></div>
    ${p.bankrupt ? `<div class="stamp">${t('Bankrupt')}</div>` : ''}`;
  const hb = card.querySelector('.hc-n.mine'); if (hb) hb.onclick = openHandModal;
  const lb = card.querySelector('button.pc-debt'); if (lb) lb.onclick = openRepay;
  const sub = card.querySelector('.sub'), btns = card.querySelector('.pc-btns');
  wireShare(card);
  for (const sp of owned) {
    const chip = el('span', 'chip' + (S.props[sp.i].mortgaged ? ' m' : ''));
    chip.style.setProperty('--gc', sp.color || (sp.type === 'railroad' ? '#333' : '#aaa'));
    chip.dataset.tip = sp.name;
    chip.onclick = () => openSpace(sp.i);
    sub.append(chip);
  }
  if (p.jailCards) sub.append(el('span', 'muted', t(' free card ×{n}', { n: p.jailCards })));
  const playing = S.phase === 'playing' && my && !my.bankrupt && !p.bankrupt;
  if (playing && p.id !== S.you && teamsMode() && p.team === my.team) {
    const g = el('button', 'btn small send', t('Send')); g.dataset.tip = t('Send money to {name}', { name: p.name }); g.onclick = openSendMoney; btns.append(g);
  }
  if (playing && p.id !== S.you) {
    const b = el('button', 'btn small ghost', t('Trade')); b.onclick = () => openTrade(p.id); btns.append(b);
  }
  if (S.phase === 'playing' && isHost && p.id !== S.you && !p.bankrupt && !p.connected) {
    const k = el('button', 'btn small ghost', t('Remove')); k.dataset.tip = t('Remove disconnected player');
    k.onclick = () => confirmBox(t('Remove {name}? Their properties return to the bank.', { name: p.name }), () => act('kick', { playerId: p.id }));
    btns.append(k);
  }
  if (!sub.children.length) sub.hidden = true;
  if (!btns.children.length) btns.hidden = true;
  return card;
}

// top-centre banner in the active player's colour
function renderTurnBanner() {
  const box = $('#turnBanner'), p = S && S.phase === 'playing' ? cur() : null;
  if (!p || p.bankrupt) { box.hidden = true; box._k = null; return; }
  const k = p.id + '|' + (p.id === S.you) + '|' + p.color + '|' + lang;
  box.hidden = false;
  if (box._k === k) return;
  box._k = k;
  box.style.setProperty('--pc', p.color);
  box.innerHTML = `${badge(p)}<span>${p.id === S.you ? t('YOUR TURN') : t("{name}'S TURN", { name: esc(p.name) })}</span>`;
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
}

// one compact panel per player, in the screen corners (the CSS places them by slot)
function renderPlayers() {
  renderShareDrawer();
  if (shareDrag) return;
  const panel = $('#hudPlayers'); panel.innerHTML = '';
  const isHost = S.hostId === S.you;
  S.players.forEach((p, idx) => panel.append(playerCard(p, idx, isHost)));
  placeEventLog();
}

// ---------------------------------------------------------------- event log
// The last few things that happened, newest on top, as short lines with an icon badge in the event's tone; derived from the
// new lines of the game log (the full log stays in the drawer). Each line is { icon (a key of icons.js), text }.
const EVENT_MAX = 5, CHAOS_RE = /^(?:\S+ )?(Payday|Golden GO|Rent Boom|Market Crash|Lottery|Tax Day|Lucky Doubles|Storm)! /;
let evLines = [], evKey = null;
const bare = text => text.replace(/^\S+\s/u, '');
function eventLine(text) {
  let m;
  if ((m = CHAOS_RE.exec(text))) return { icon: 'bolt', text: chaosName(m[1]) };
  if (/^🎡 Global wheel: /.test(text)) return { icon: 'roulette', text: bare(tr(text)) };
  if (/ rolled \d+ \+ \d+/.test(text)) return { icon: 'dice', text: tr(text) };
  if ((m = /^(🎩|✉|🔫) (?=.*(Mafia|A note slides))(.+)$/u.exec(text))) return { icon: m[1] === '🎩' ? 'fedora' : keyOfEmoji(m[1]), text: bare(tr(text)) };
  if ((m = /^(.+) landed on (.+)\.$/.exec(text))) return { icon: 'arrow', text: `${m[1]} → ${splitName(m[2])[0]}` };
  if ((m = /^⚖ Rent split: (.+) keeps (.+), (.+) gets (.+) \((\d+)%\)\.$/.exec(text))) return { icon: 'scales', text: t('{a} {x} · {b} {y}', { a: m[1], x: m[2], b: m[3], y: m[4] }) };
  if ((m = /^⚖ (.+) set their team's rent share to (\d+)% for the teammate\.$/.exec(text))) return { icon: 'scales', text: tr(text).replace(/^⚖\s/, '') };
  if ((m = /^(.+) paid (.+) rent to (.+)\.$/.exec(text))) return { icon: 'coins', text: t('{a} paid {amount} to {b}', { a: m[1], amount: m[2], b: m[3] }) };
  if ((m = /^(🚨|💼|🎁) (.+)$/u.exec(text))) return { icon: keyOfEmoji(m[1]), text: bare(tr(text)) };
  if ((m = /^(.+) drew (.+?): /.exec(text))) return { icon: 'card', text: t('{a} drew {card}', { a: m[1], card: m[2] }) };
  if (/ (bought|upgraded) | bought out /.test(text)) return { icon: 'crane', text: tr(text) };
  if ((m = /^(🎰|💵|🚓|🎩|🔪|💣|🎉|🥃|⌛) (?=.+ spins the wheel at |One Too Many: |Billionaire's Whim: |Police Investigation: |Mayor's Favor: |Gang Turf: |Building Bombing: |Economic Boom: |.+ is closed by the police — |.+ has ended\.$)(.+)$/u.exec(text))) return { icon: keyOfEmoji(m[1]), text: casinoText(m[2]) };
  if ((m = PLAY_RE.exec(text))) return { icon: keyOfEmoji(m[1]), text: bare(tr(text)) };
  if (/ went bankrupt!/.test(text)) return { icon: 'skull', text: tr(text) };
  if (/ was sent to | stays in | rolled out of | to get out\.$| fine after 3 tries\.$|speeding!$|Get-Out-Free/.test(text)) return { icon: 'handcuffs', text: tr(text) };
  return null;
}
// an event sentence as HTML: players' names bold in their colour, amounts picked out, leftover emoji turned into icons
const AMT_RE = /[-−+]?[$€£₡¢¥]\d[\d.,]*[KM]?/g;
function richLine(text) {
  const ps = S ? S.players.filter(p => p.name).sort((a, b) => b.name.length - a.name.length) : [];
  let h = esc(text);
  if (ps.length) {
    const re = new RegExp(ps.map(p => esc(p.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    h = h.replace(re, n => { const p = ps.find(q => esc(q.name) === n); return `<b class="who" style="color:${p ? esc(p.color) : 'inherit'}">${n}</b>`; });
  }
  return deEmoji(h.replace(AMT_RE, m => (m.includes('<') ? m : `<mark class="amt">${m}</mark>`)));
}
const toneOf = icon => TONE[icon] || 'neutral';
function renderEventLog() {
  const box = $('#eventLog');
  if (!S || S.phase !== 'playing') { evLines = []; evKey = null; box.hidden = true; return; }
  const keyOf = l => l.t + '|' + l.text;
  let from = 0;
  if (evKey) { for (let k = S.log.length - 1; k >= 0; k--) if (keyOf(S.log[k]) === evKey) { from = k + 1; break; } }
  if (!evKey || from === 0) from = Math.max(0, S.log.length - 12);
  for (const l of S.log.slice(from)) {
    if (l.chat) continue;
    const e = eventLine(l.text);
    if (e) { evLines.push(e); if (evKey && from > 0) announce(e); }
  }
  if (S.log.length) evKey = keyOf(S.log[S.log.length - 1]);
  evLines = evLines.slice(-EVENT_MAX);
  const on = sideLogOn();
  const html = on ? evLines.slice().reverse().map((e, k) => `<div class="ev tone-${toneOf(e.icon)}" data-age="${k}"><span class="ev-ic">${ic(e.icon)}</span><span class="ev-tx">${richLine(e.text)}</span></div>`).join('') : '';
  box.hidden = !on || !evLines.length;
  if (box._html !== html) box.innerHTML = box._html = html;
  placeEventLog();
}
// ---- centre announcer: each new event as one plaque in the middle of the screen, one at a time
const ANN_SKIP = new Set(['card', 'roulette', 'chip', 'cash', 'siren', 'tophat', 'fedora', 'knife', 'bomb', 'confetti', 'whiskey', 'hourglass', 'envelope', 'gun']); // these already get their own pop-up
const ANN_BIG = new Set(['coins', 'crane', 'skull', 'handcuffs', 'bolt']);
let annQ = [], annCur = null, annTimer = null, annHold = 0;
// how much goes in the middle: off = nothing; less = only money, property, jail, bankruptcy and round events; normal adds card plays, taxi rides,
// rent splits and the like (no dice or moves); more = every line
const ANN_LEVELS = ['off', 'less', 'normal', 'more'];
const ANN_ROUTINE = new Set(['dice', 'arrow']);
function annLevel() { const v = safeGet('mono.annLevel'); return ANN_LEVELS.includes(v) ? v : safeGet('mono.announcer') === '0' ? 'less' : 'normal'; }
function annOn() { return annLevel() !== 'off'; }
function clearAnnouncer() { annQ = []; annCur = null; const b = $('#announcer'); b.classList.remove('show'); b.hidden = true; clearInterval(annTimer); annTimer = null; }
function announce(e) {
  if (!annOn() || ANN_SKIP.has(e.icon)) return;
  const lv = annLevel();
  if (lv === 'less' && !ANN_BIG.has(e.icon)) return;
  if (lv === 'normal' && ANN_ROUTINE.has(e.icon)) return;
  const p = S.players.filter(q => e.text.includes(q.name)).sort((a, b) => b.name.length - a.name.length)[0];
  const big = ANN_BIG.has(e.icon);
  if (big) annQ = annQ.filter(q => q.big);
  annQ.push({ e, p, big });
  annQ = annQ.slice(-3);
  if (!annTimer) annTimer = setInterval(annTick, 150);
}
let wheelBusy = 0;                                   // set while the 3D global wheel is up (see handleGlobal)
function annBusy() {
  return !!document.querySelector('.ew') || performance.now() < wheelBusy || !$('#modal').hidden || !$('#settings').hidden || ['#cardPick', '#casinoPopup', '#globalPopup', '#cardFx'].some(q => { const n = $(q); return n && !n.hidden && n.children.length; });
}
function annTick() {
  const box = $('#announcer');
  if (!S || S.phase !== 'playing' || !annOn()) { clearAnnouncer(); return; }
  if (annBusy()) { box.classList.remove('show'); if (annCur) annCur.until += 150; if (annQ.length > 1) annQ = annQ.slice(-1); annHold = Date.now() + slow(500); return; }   // paused: only the newest line survives
  const now = Date.now();
  if (annCur && now < annCur.until) { box.classList.add('show'); return; }
  if (annCur) { box.classList.remove('show'); annCur = null; annHold = now + slow(420); }      // let the plaque fade out before the next one comes in
  if (now < annHold) return;
  const q = annQ.shift();
  if (!q) { box.hidden = true; clearInterval(annTimer); annTimer = null; return; }
  const { e, p, big } = q;
  box.hidden = false;
  box.style.setProperty('--pc', p ? p.color : '#c9a24f');
  box.dataset.tone = toneOf(e.icon);
  box.innerHTML = `<span class="ann-ic">${ic(e.icon)}</span><span class="ann-tx">${richLine(e.text)}</span>`;
  box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  annCur = { until: now + slow((big ? 2800 : 2100) * (annQ.length >= 2 ? .6 : 1)) };
}
// the log flows under the top-left panel (measured) and stops above the hand tray / bottom-left panel
function placeEventLog() {
  const box = $('#eventLog'), p0 = document.querySelector('#hudPlayers .pcard.slot0');
  if (!box || box.hidden || !p0) return;
  const top = p0.getBoundingClientRect().bottom + 10;
  box.style.top = Math.round(top) + 'px';
  let limit = innerHeight - 8;
  for (const sel of ['#hudPlayers .pcard.slot3', '#handTray:not([hidden])']) { const e = document.querySelector(sel); if (e) limit = Math.min(limit, e.getBoundingClientRect().top - 8); }
  for (const c of box.children) c.style.display = '';
  for (const c of [...box.children].reverse()) { if (box.getBoundingClientRect().bottom > limit) c.style.display = 'none'; }
}
addEventListener('resize', () => placeEventLog());

function renderTradeBanner() {
  const b = $('#tradeBanner'); b.innerHTML = '';
  const tr = S.trade;
  if (!tr || S.phase !== 'playing') { closeModalIf('trade-incoming'); return; }
  const from = pById(tr.from), to = pById(tr.to);
  if (tr.from === S.you) {
    b.innerHTML = esc(t('Waiting for {name} to answer your trade… ', { name: to.name }));
    const c = el('button', 'btn small ghost', t('Cancel')); c.onclick = () => act('tradeCancel'); b.append(c);
  } else if (tr.to === S.you) {
    b.innerHTML = t('{name} sent you a trade offer! ', { name: `<b>${esc(from.name)}</b>` });
    const v = el('button', 'btn small', t('View')); v.onclick = () => showIncomingTrade(); b.append(v);
    if (!seenTrades.has(tr.id)) { seenTrades.add(tr.id); showIncomingTrade(); }
  } else {
    b.innerHTML = `<span class="muted">${esc(t('{a} is offering a trade to {b}…', { a: from.name, b: to.name }))}</span>`;
  }
}

let feedKey = '';
function renderFeed() {
  const feed = $('#feed');
  const newest = S.log[S.log.length - 1];
  const lastN = newest ? newest.n || S.log.length : 0;
  const key = `${S.gid}|${lastN}|${S.log.length}|${lang}`;
  if (key === feedKey) return;                              // nothing new: don't rebuild the whole list on every poll
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  feed.innerHTML = S.log.map(l => {
    if (l.chat) { const p = pById(l.from); return `<div class="chat"><b>${esc(p ? p.name : '?')}:</b> ${esc(l.text)}</div>`; }
    return `<div class="${l.text.startsWith('—') ? 'turnline' : ''}">${deEmoji(esc(tr(l.text)))}</div>`;
  }).join('');
  if (atBottom || lastN !== lastLogN) feed.scrollTop = feed.scrollHeight;
  if (lastLogN && lastN > lastLogN && newest && newest.chat && newest.from !== S.you && !document.body.classList.contains('drawer-open')) {
    toast(`${pById(newest.from)?.name || '?'}: ${newest.text}`);
  }
  lastLogN = lastN;
  feedKey = key;
}
$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const v = $('#chatInput').value.trim();
  if (!v || !S.you) return;
  act('chat', { text: v }); $('#chatInput').value = '';
};

// ---------------------------------------------------------------- modals

let modalKind = null;
const seenTrades = new Set();
function openModal(kind, html) {
  modalKind = kind;
  $('#modalBox').innerHTML = `<button class="m-x" type="button" aria-label="${esc(t('Close'))}">${ic('close')}</button>` + html;
  $('#modalBox').querySelector('.m-x').onclick = closeModal;
  $('#modal').hidden = false;
}
function closeModal() {
  $('#modal').hidden = true; modalKind = null;
  if (selectedPos != null) { selectedPos = null; scene && scene.select(-1); }
}
function closeModalIf(kind) { if (modalKind && modalKind.startsWith(kind)) closeModal(); }
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === ' ' && e.target === document.body && S && myTurn()) { // space bar = main action
    e.preventDefault();
    const b = $('#turnCard:not([hidden]) .btn.big') || $('#actions .btn.big'); b && !b.disabled && b.click();
  }
});

function confirmBox(text, yes) {
  openModal('confirm', `<p style="font-size:calc(var(--ui-scale,1)*17px)">${esc(text)}</p><div class="modal-actions"><button class="btn ghost" id="mNo">${t('Cancel')}</button><button class="btn danger" id="mYes">${t('Yes')}</button></div>`);
  $('#mNo').onclick = closeModal;
  $('#mYes').onclick = () => { closeModal(); yes(); };
}

function openSpace(pos, refresh) {
  const sp = S.board[pos];
  if (!sp) return;
  if (refresh && modalKind !== 'space') return;
  selectedPos = pos;
  scene && scene.select(pos);
  const st = S.props[pos];
  const owner = st && pById(st.owner);
  const buyable = ['property', 'railroad', 'utility'].includes(sp.type);
  let rows = '';
  if (sp.type === 'property') {
    rows = [1, 2, 3, 4, 5].map(k => `<tr class="${st && st.level === k ? 'cur' : ''}"><td>${levelName(k)}</td><td>${cash(Math.round(sp.rent[k] * effectMult(S, sp)))}</td></tr>`).join('')
      + `<tr><td colspan="2">${t('Full color set: rent ×1.5')}</td></tr><tr><td>${t('Upgrade cost / level')}</td><td>${cash(sp.houseCost)}</td></tr>`;
  } else if (sp.type === 'railroad') {
    rows = [1, 2, 3, 4].map(n => `<tr><td>${t('Own {n}', { n })}</td><td>${cash(railRent(n))}</td></tr>`).join('');
  } else if (sp.type === 'utility') {
    rows = `<tr><td>${t('Own {n}', { n: 1 })}</td><td>${t('{amount} × dice', { amount: cash(utilPerPip(1)) })}</td></tr><tr><td>${t('Own {n}', { n: 2 })}</td><td>${t('{amount} × dice', { amount: cash(utilPerPip(2)) })}</td></tr>`;
  } else if (sp.type === 'tax') {
    rows = `<tr><td>${t('Pay')}</td><td>${cash(sp.amount)}</td></tr>`;
  } else {
    const desc = { go: t('Collect {amount} every time you pass.', { amount: cash(200000) }), jail: t('Just visiting… unless you got sent here.'), taxi: t(S.settings.jackpot ? 'Call a cab for your next turn, and win the jackpot!' : 'Call a cab: next turn you can ride to any square.'), gotojail: t('Go directly to {jail}.', { jail: S.board[10].name }), chance: t('Draw a card.'), chest: t('Draw a card.'), casino: t('Try your luck: a card from the dealer, or a spin of the wheel.') }[sp.type];
    rows = `<tr><td colspan="2">${esc(desc || '')}</td></tr>`;
  }
  for (const e of effectTags(S, sp)) rows += `<tr><td colspan="2">${fxTagHtml(e, sp)}</td></tr>`;
  if (protectedMine(pos) && S.phase === 'playing') rows += `<tr><td colspan="2"><span${infoAttr('protection')}>${ic('shield', { cls: 'ic-inline' })} ${t('Police protection (only you know)')}</span></td></tr>`;
  if (buyable) rows += `<tr><td>${t('Mortgage value')}</td><td>${cash(sp.price / 2)}</td></tr>`;

  let btns = '', info = '';
  const mine = st && st.owner === S.you && S.phase === 'playing';
  if (mine) {
    if (sp.type === 'property') {
      info = st.level >= 5 ? t("Max level — can't be bought out.") : t('Upgrade by landing on this tile.');
      const why = t('Already at level 1');
      btns += `<div class="opt"><button class="btn ghost" data-a="sell" ${st.level <= 1 ? 'disabled' : ''}>${t('Sell a level (+{amount})', { amount: cash(sp.houseCost / 2) })}</button>${st.level <= 1 ? `<small class="opt-reason">${why}</small>` : ''}</div>`;
    }
    if (squattedAt(pos)) {
      const o = evictOption(sp, me(), false);
      btns += `<div class="opt"><button class="btn" data-a="evict" ${o.ok ? '' : 'disabled'}>${esc(o.label)}</button>${!o.ok && o.reason ? `<small class="opt-reason">${esc(o.reason)}</small>` : ''}</div>`;
    }
    const noMortgage = sp.type === 'property' && st.level > 1;
    btns += st.mortgaged
      ? `<button class="btn ghost" data-a="unmortgage">${t('Unmortgage ({amount})', { amount: cash(Math.ceil(sp.price / 2 * 1.1)) })}</button>`
      : `<div class="opt"><button class="btn ghost" data-a="mortgage" ${noMortgage ? 'disabled' : ''}>${t('Mortgage (+{amount})', { amount: cash(sp.price / 2) })}</button>${noMortgage ? `<small class="opt-reason">${t('Sell extra levels first')}</small>` : ''}</div>`;
  }
  const html = `
    <div class="deed" style="--gc:${sp.color || (sp.type === 'railroad' ? '#333' : '#777')}">
      <div class="dhead">${esc(sp.name)}
        <small>${sp.price ? t('Price {amount}', { amount: cash(sp.price) }) : ''} ${owner ? t('· Owned by {name}', { name: esc(owner.name) }) : buyable ? t('· For sale') : ''}${st && st.mortgaged ? t(' · MORTGAGED') : ''}</small></div>
      <table>${rows}</table>
    </div>
    ${info ? `<p class="muted" style="font-size:calc(var(--ui-scale,1)*13px)">${info}</p>` : ''}
    <div class="modal-actions">${btns}<button class="btn ghost" id="mClose">${t('Close')}</button></div>`;
  openModal('space', html);
  $('#mClose').onclick = closeModal;
  $('#modalBox').querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a, { pos }));
}

function tradablePropsOf(pid) {
  return S.board.filter(sp => {
    const st = S.props[sp.i];
    if (!st || st.owner !== pid) return false;
    if (sp.type !== 'property') return true;
    return S.props[sp.i].level === 1;
  });
}
const propLine = (sp, name) => `<label class="tprop"><input type="checkbox" name="${name}" value="${sp.i}"><span class="chip" style="--gc:${sp.color || '#555'}"></span>${esc(sp.name)}${S.props[sp.i].mortgaged ? ` <span class="muted">${t('(mortgaged)')}</span>` : ''}</label>`;

function openTrade(otherId) {
  if (S.trade) return toast(t('A trade is already pending.'));
  const other = pById(otherId), my = me();
  const mine = tradablePropsOf(S.you), theirs = tradablePropsOf(otherId);
  openModal('trade-new', `
    <h2 class="title" style="font-size:calc(var(--ui-scale,1)*26px)">${t('Trade with {name}', { name: esc(other.name) })}</h2>
    <div class="trade-cols">
      <div><h4>${t('You give')}</h4>${mine.map(sp => propLine(sp, 'give')).join('') || `<p class="muted">${t('No tradable properties')}</p>`}
        <label class="row">${t('Cash')} <input class="modal-input" type="number" id="tGiveMoney" min="0" max="${Math.max(0, my.money)}" step="1000" value="0"></label></div>
      <div><h4>${t('You get')}</h4>${theirs.map(sp => propLine(sp, 'get')).join('') || `<p class="muted">${t('No tradable properties')}</p>`}
        <label class="row">${t('Cash')} <input class="modal-input" type="number" id="tGetMoney" min="0" max="${Math.max(0, other.money)}" step="1000" value="0"></label></div>
    </div>
    <p class="muted" style="font-size:calc(var(--ui-scale,1)*12px)">${t("Properties above level 1 can't be traded.")}</p>
    <div class="modal-actions"><button class="btn ghost" id="mClose">${t('Cancel')}</button><button class="btn" id="tSend">${t('Send offer')}</button></div>`);
  $('#mClose').onclick = closeModal;
  $('#tSend').onclick = async () => {
    const val = n => [...document.querySelectorAll(`input[name=${n}]:checked`)].map(i => Number(i.value));
    await act('tradePropose', { to: otherId, giveProps: val('give'), getProps: val('get'), giveMoney: Number($('#tGiveMoney').value) || 0, getMoney: Number($('#tGetMoney').value) || 0 });
    if (S.trade && S.trade.from === S.you) closeModal();
  };
}

function showIncomingTrade() {
  const offer = S.trade; if (!offer) return;
  const from = pById(offer.from);
  const list = (props, m) => (props.map(i => `<div class="tprop"><span class="chip" style="--gc:${S.board[i].color || '#555'}"></span>${esc(S.board[i].name)}</div>`).join('') + (m ? `<div class="tprop">${ic('cash', { cls: 'ic-inline' })} ${cash(m)}</div>` : '')) || `<p class="muted">${t('Nothing')}</p>`;
  openModal('trade-incoming', `
    <h2 class="title" style="font-size:calc(var(--ui-scale,1)*26px)">${t('Trade offer from {name}', { name: esc(from.name) })}</h2>
    <div class="trade-cols">
      <div><h4>${t('You get')}</h4>${list(offer.giveProps, offer.giveMoney)}</div>
      <div><h4>${t('You give')}</h4>${list(offer.getProps, offer.getMoney)}</div>
    </div>
    <div class="modal-actions"><button class="btn ghost" id="mLater">${t('Decide later')}</button><button class="btn danger" id="tNo">${t('Decline')}</button><button class="btn" id="tYes">${t('Accept')}</button></div>`);
  $('#mLater').onclick = closeModal;
  $('#tNo').onclick = () => { closeModal(); act('tradeRespond', { accept: false }); };
  $('#tYes').onclick = () => { closeModal(); act('tradeRespond', { accept: true }); };
}

// Initialize the toolbar after all settings constants (including ANN_LEVELS) exist.
syncTools();
(view === 'city' ? loadCity().catch(() => { view = 'table'; }) : Promise.resolve()).then(connect);
