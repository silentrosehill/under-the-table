// Explains every icon, chip and badge in the interface, and the card & event guide.
//   - INFO: key -> { icon, title, short, long, dur, end, who, art }   (English; looked up through t() so FR lives in i18n.js)
//   - markup hooks: data-info="key" (hover tooltip + click opens the info card), data-tipinfo="key" (tooltip only, the old click
//     action stays), data-tip="plain text" (tooltip only); parameters go in data-p='{"n":2}' (see infoAttr()).
//   - one shared tooltip (#tip) and one info card (#infoCard) for the whole page, wired by event delegation.
import { t, lang, onLang } from './i18n.js';
import { cardFace } from './cardface.js';
import { ic, emo } from './icons.js';

const ART_DIR = 'art/cards/';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- the table
// {x} placeholders are filled from data-p. `short` is the tooltip line with the current value; the rest is the info card.
export const INFO = {
  // ----- status chips on a player's panel
  bankrupt: { icon: '💀', title: 'Bankrupt', short: 'Out of the game — everything went back to the bank.', long: 'This player ran out of money and things to sell. They can no longer roll, buy or trade, but the game goes on without them.', dur: 'Permanent.', end: 'Nothing brings a player back.', who: 'Only this player.' },
  drunk: { icon: '🥃', title: 'One Too Many', short: 'Next roll is halved.', long: 'A drink too many at the bar: the next dice roll only moves half the distance (rounded down). Doubles still count as doubles.', dur: 'Until their next roll.', end: 'It wears off by itself as soon as they roll.', who: 'This player only.', art: 'casino-onetoomany' },
  jail: { icon: '⛓', title: 'In jail', short: 'Roll doubles, use a free card or pay the fine.', long: 'Sent behind bars. On each turn you can roll for doubles to get out, pay the {fine} fine, or play a Get Out of Jail Free card. After three failed tries the fine is charged for you. No rent is lost: you still collect from your tiles.', dur: 'Up to 3 turns.', end: 'Roll doubles, pay the fine, or use a Get Out of Jail Free card.', who: 'This player only.' },
  debt: { icon: '💸', title: 'In debt', short: 'Cash is below zero.', long: 'Their cash is negative. They must raise money — mortgage a tile, sell buildings, trade — before the turn ends, or they go bankrupt. If the Mafia rule is on, the family may offer a loan.', dur: 'Until cash is back above zero.', end: 'Mortgage tiles, sell levels, trade, or borrow from the Mafia.', who: 'This player only.', art: 'mafia-table' },
  mortgaged: { icon: '🔒', title: 'Mortgaged tiles', short: '{n} mortgaged — they earn no rent.', long: 'A mortgaged tile pays its owner half its price in cash, but earns no rent and cannot be upgraded until the mortgage is lifted.', dur: 'Until the owner pays it back.', end: 'Open the tile and pay to lift the mortgage.', who: 'The tile owner (no rent), and anyone landing there (no rent to pay).' },
  audit: { icon: '🧾', title: 'Tax audit', short: 'Taxman on your back · {n} rounds left.', long: 'The taxman noted down the police pay-off. Each time this player passes GO there is a 30% chance of a 10% tax on their cash.', dur: '5 rounds after paying the police.', end: 'It expires by itself.', who: 'This player only.' },
  taxi: { icon: '🚕', title: 'Taxi ready', short: 'Next turn: ride to any square instead of rolling.', long: 'You landed on the Taxi Company. On your next turn there are no dice: you pick any square (except the depot itself) and ride straight there. Passing Payday on the way pays your salary, and the square you reach is played as usual. No extra roll on doubles. In jail it waits until you are free.', dur: 'Until your next turn.', end: 'Pick where the cab takes you.', who: 'This player only.' },
  // ----- timed effects (chips, deed tags)
  'fx-police': { icon: '🚓', title: 'Police shutdown', short: '{tile} earns no rent · {left}', long: 'The police closed the building during an investigation: nobody pays rent on this tile while it lasts.', dur: 'A fixed number of rounds (2 from the global wheel, 3 from the casino).', end: 'It lifts by itself when the timer ends. Nothing you can pay for it.', who: 'The tile owner loses the rent; visitors stay for free.', art: 'casino-police' },
  'fx-mayor': { icon: '🎩', title: "Mayor's Favor", short: '{tile} rent doubled · {left}', long: 'The mayor looks kindly on this building: rent here is doubled.', dur: 'A fixed number of rounds (2 from the global wheel, 3 from the casino).', end: 'It ends by itself when the timer runs out.', who: 'The tile owner earns double; visitors pay double.', art: 'casino-mayor' },
  'fx-gang': { icon: '🔪', title: 'Gang turf', short: '{tile} rent halved · {left}', long: 'A gang took over this district: every tile of that colour pays only half its rent.', dur: 'A fixed number of rounds.', end: 'It ends by itself when the timer runs out. Police Protection does not stop it.', who: 'Owners of tiles in that district (the global wheel hits each player\'s main district).', art: 'casino-gang' },
  'fx-squatters': { icon: '🛏', title: 'Squatters', short: '{tile} earns no rent · {left}', long: 'Squatters moved into this tile: it earns no rent while they stay.', dur: '3 rounds.', end: 'Evict them from the tile\'s deed on your turn (half the tile\'s value), once one full turn of yours has passed since they arrived — or wait it out. A recent eviction doubles a Shady Billionaire payout.', who: 'The tile owner loses the rent.', art: 'squatters_in' },
  'fx-crime': { icon: '🚨', title: 'Crime wave', short: 'Rents −40% on {tile} · {left}', long: 'A crime wave scares the customers away: rents on the affected tiles drop (by 40%).', dur: '2 to 3 rounds.', end: 'Pay the police when the card is drawn (and be audited afterwards), or wait for it to end.', who: 'The player who drew it, on one district — or on every tile in the city.', art: 'crime' },
  'fx-gift': { icon: '🎁', title: "Mayor's Gift", short: '{tile} rent ×3 · {left}', long: 'The mayor blessed one tile: triple rent until its owner\'s next turn.', dur: 'Until the owner\'s next turn.', end: 'It ends by itself.', who: 'The tile owner earns triple; visitors pay triple.', art: 'gift' },
  'fx-shootout-win': { icon: '🚔', title: 'Police guard', short: '{tile} rent ×1.5 · {left}', long: 'A gang hit a guarded tile and the police won the shootout. The tile now earns 50% more.', dur: '5 rounds.', end: 'It ends by itself.', who: 'The tile owner.', art: 'protection' },
  'fx-shootout-loss': { icon: '🕳', title: 'Shot-up building', short: '{tile} rent halved · {left}', long: 'A gang hit a guarded tile and the police lost the shootout. The building is shot to pieces: half rent.', dur: '5 rounds.', end: 'It ends by itself.', who: 'The tile owner.', art: 'gang' },
  'fx-generic': { icon: '✦', title: 'Timed effect', short: '{label}', long: 'A temporary effect is running here. It changes rents for a number of rounds and then wears off.', dur: 'See the timer.', end: 'It ends by itself.', who: 'The tile owner.' },
  protection: { icon: '🛡', title: 'Police protection', short: 'A secret guard — only you can see it.', long: 'One of your tiles is secretly guarded. If a rival hires a gang against it, there is a shootout instead of damage: the police win or lose with equal chances.', dur: 'Until a gang attacks it.', end: 'It is used up by the shootout.', who: 'You. Nobody else knows which tile it is.', art: 'protection' },
  fxcount: { icon: '✦', title: 'Active effects', short: '{n} timed effects running on this player.', long: 'How many timed effects (police, gang, squatters, mayor, audit…) currently touch this player. On wide screens each one has its own chip.', dur: 'Each effect has its own timer.', end: 'They end by themselves; some can be paid off (see each one).', who: 'This player.' },
  // ----- panel counters and tags
  props: { icon: '🏠', title: 'Properties', short: '{n} properties owned.', long: 'The number of tiles this player owns. Each coloured pip is one tile in its district colour (railroads and utilities are grey). Click a pip to open the tile.', dur: 'Until sold, lost or mortgaged.', end: 'Buy more tiles to complete a district: a full set pays +50% rent.', who: 'This player.' },
  hand: { icon: '🂠', title: 'Cards in hand', short: '{n} cards kept — contents are secret.', long: 'Attack and counter cards (Hire a Gang, Send the Squatters, Police Protection) are kept until played. The others only see how many you hold, never which ones.', dur: 'Until played.', end: 'Play them on your own turn.', who: 'This player.' },
  'hand-mine': { icon: '🂠', title: 'Your hand', short: '{n} cards — click to open your hand.', long: 'The cards you kept. Open your hand on your own turn to play one. Others only see how many you hold.', dur: 'Until played.', end: 'Play them on your own turn.', who: 'You.' },
  mafia: { icon: '🎩', title: 'Mafia loan', short: '{due} due · {left}', long: 'You borrowed from the Mafia on terms you chose (interest = 10% + 4% × turns + 2% per $250K). Repay before the deadline: when it hits zero the family collects what you still owe — taking cash, then your best tile, or knocking you out if you own nothing.', dur: 'A fixed number of your turns.', end: 'Repay (in full or in part) from the repay window.', who: 'This player only.', art: 'mafia-table' },
  'mafia-mine': { icon: '🎩', title: 'Mafia loan', short: '{due} due · {left} — click to repay.', long: 'You borrowed from the Mafia on terms you chose (interest = 10% + 4% × turns + 2% per $250K). Repay before the deadline: when it hits zero the family collects what you still owe — taking cash, then your best tile, or knocking you out if you own nothing.', dur: 'A fixed number of your turns.', end: 'Click the slot on your turn to repay, in full or in part.', who: 'You.', art: 'mafia-table' },
  turn: { icon: '▶', title: 'Whose turn', short: "{name}'s turn.", long: 'The highlighted panel is the player who is on the move. Everybody else waits (and can still trade or chat).', dur: 'Until they end their turn.', end: 'Doubles give an extra roll.', who: 'The active player.' },
  team: { icon: '⚑', title: 'Team {name}', short: 'Teammates share the win.', long: 'In 2v2 the team with the higher combined net worth wins. Teammates can send each other cash (with a fee) and pay each other {rent}.', dur: 'The whole game.', end: 'Teams are set in the lobby.', who: 'Both teammates.' },
  bot: { icon: '🤖', title: 'Computer player', short: 'A bot plays this seat.', long: 'This seat is played by the computer. Bots buy, build, trade and play cards on their own.', dur: 'The whole game.', end: 'The host can add or remove bots in the lobby.', who: 'This seat.' },
  you: { icon: '★', title: 'This is you', short: 'Your seat.', long: 'The panel marked YOU is your seat: your cash, your tiles and your hand.', dur: 'The whole game.', end: '', who: 'You.' },
  offline: { icon: '○', title: 'Offline', short: 'This player is disconnected.', long: 'This player lost their connection. They can come back with the same browser; the host can remove them from their panel.', dur: 'Until they reconnect.', end: 'The host can remove a missing player.', who: 'This player.' },
  online: { icon: '●', title: 'Online', short: 'Connected.', long: 'A green dot means this player is connected right now.', dur: '', end: '', who: 'This player.' },
  worth: { icon: '$', title: 'Net worth', short: 'Cash and assets: {amount}.', long: 'Cash plus the value of every tile and building owned. When the round limit is reached, the highest net worth wins.', dur: 'Changes all the time.', end: '', who: 'This player.' },
  share: { icon: '⚖', title: 'Share to mate', short: '{pct}% of rent goes to the teammate.', long: 'In 2v2, the share of the rents you earn that is paid straight to your teammate. Change it with the slider on your own turn.', dur: 'Until changed.', end: 'Move the slider on your own turn.', who: 'Both teammates.' },
  // ----- top centre
  speed: { icon: '⏳', title: 'Game speed', short: 'How fast the game plays: Relaxed, Normal or Fast.', long: 'Chosen by the host in the lobby. Relaxed (the default) gives every move, dice roll, card, wheel, pop-up and bot turn about 60% more time. Normal is the original pace. Fast is about a third quicker. It never changes the rules or the odds.', dur: 'The whole game.', end: 'Only the host can change it, before the game starts.', who: 'Everybody.' },
  round: { icon: '⏱', title: 'Round counter', short: '{text}', long: 'A round is one turn for every player. Timed effects (police, gangs, squatters…) count in rounds, and the game can end after a set number of rounds.', dur: '', end: '', who: 'Everybody.' },
  global: { icon: '🎡', title: 'Global wheel', short: '{hint}', long: 'Every few rounds the wheel spins and one event hits EVERY player at once: squatters, police raids, mayor favour, gang turf, crime wave, gang war, a windfall, a boom, a tax audit, One Too Many, or police protection. All eleven are equally likely. See the card guide for each.', dur: 'Every {every} rounds (host setting).', end: '', who: 'Every player.', art: 'casino-whim' },
  // ----- tool bar (hover only)
  'tool-sound': { icon: '🔊', title: 'Volume', short: 'Sound and record volume.', long: '', dur: '', end: '', who: '' },
  'tool-emote': { icon: '💬', title: 'Reactions', short: 'Send a quick emoji reaction.', long: '', dur: '', end: '', who: '' },
  'tool-follow': { icon: '🎥', title: 'Camera mode', short: 'Switch between the cinematic and the fixed camera.', long: '', dur: '', end: '', who: '' },
  'tool-camera': { icon: '🎥', title: 'Camera mode', short: 'Cinematic follows the action; Fixed keeps the whole board in view.', long: 'Cinematic: the camera follows the tokens, pushes in on the dice and closes up on big moments. Fixed: the camera stays on your seat view of the whole board and never moves by itself. You can still orbit and zoom by hand, and the reset button brings you back to the fixed view. Only for you.', dur: 'Saved on this device.', end: 'Change it here at any time.', who: 'Only you.' },
  'tool-labels': { icon: '🏷', title: 'Labels', short: 'Show every street label.', long: '', dur: '', end: '', who: '' },
  'tool-announcer': { icon: '📢', title: 'Announcer', short: 'How much shows in the middle of the screen: less, normal or more. Click to switch.', long: '', dur: '', end: '', who: '' },
  'tool-tv': { icon: '📺', title: 'Broadcast', short: '1960s broadcast look on or off.', long: '', dur: '', end: '', who: '' },
  'tool-reset': { icon: '🧭', title: 'Camera', short: 'Reset the camera.', long: '', dur: '', end: '', who: '' },
  'tool-music': { icon: '📀', title: 'Record player', short: 'Background record on or off.', long: '', dur: '', end: '', who: '' },
  'tool-mute': { icon: '🔊', title: 'Volume', short: 'Sound and record volume.', long: '', dur: '', end: '', who: '' },
  'tool-drawer': { icon: '📜', title: 'Log & chat', short: 'Game log, chat, and the card guide.', long: '', dur: '', end: '', who: '' },
  'tool-quit': { icon: '🚪', title: 'Quit', short: 'Leave or end the game.', long: '', dur: '', end: '', who: '' },
  'tool-settings': { icon: '⚙', title: 'Settings', short: 'Display, sound and information settings.', long: '', dur: '', end: '', who: '' },
  'tool-guide': { icon: '🂠', title: 'Cards & events', short: 'Every card and event, explained.', long: '', dur: '', end: '', who: '' },
};

// resolve one entry to display strings (translated, parameters filled in)
export function resolve(key, p = {}) {
  const d = INFO[key];
  if (!d) return null;
  const f = s => (s ? t(s, p) : '');
  return { key, icon: d.icon, title: f(d.title), short: f(d.short), long: f(d.long), dur: f(d.dur), end: f(d.end), who: f(d.who), art: d.art || '' };
}

// attribute string for markup: infoAttr('props', { n: 3 }) -> ' data-info="props" data-p="{...}"'. mode: 'info' (click opens the card) or 'tip' (tooltip only)
export function infoAttr(key, p, mode = 'info') {
  const a = mode === 'tip' ? 'data-tipinfo' : 'data-info';
  return ` ${a}="${esc(key)}"${p ? ` data-p="${esc(JSON.stringify(p))}"` : ''}`;
}
export const tipAttr = text => ` data-tip="${esc(text)}"`;

// ---------------------------------------------------------------- the shared tooltip
let tipEl = null, anchor = null, showTimer = 0, pressTimer = 0, suppressClick = 0, lastPt = { x: 0, y: 0 };

function paramsOf(node) { try { return node.dataset.p ? JSON.parse(node.dataset.p) : {}; } catch { return {}; } }
function tipSource(node) { return node.closest('[data-info],[data-tipinfo],[data-tip]'); }

function tipHtml(node) {
  if (node.dataset.tip != null) return `<b>${esc(node.dataset.tip)}</b>`;
  const key = node.dataset.info || node.dataset.tipinfo, r = resolve(key, paramsOf(node));
  if (!r) return '';
  return `<b><i>${emo(r.icon)}</i> ${esc(r.title)}</b>${r.short ? `<span>${esc(r.short)}</span>` : ''}`;
}

function placeTip(node) {
  const r = node.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, m = 8;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
  if (y < m) y = r.bottom + 8;
  if (y + h > innerHeight - m) y = Math.max(m, innerHeight - h - m);
  x = Math.max(m, Math.min(innerWidth - w - m, x));
  tipEl.style.left = Math.round(x) + 'px'; tipEl.style.top = Math.round(y) + 'px';
}
function showTip(node) {
  if (!node || !node.isConnected) return;
  const html = tipHtml(node);
  if (!html) return hideTip();
  anchor = node; tipEl.innerHTML = html; tipEl.hidden = false; tipEl.style.left = '0px'; tipEl.style.top = '0px';
  placeTip(node);
}
export function hideTip() { clearTimeout(showTimer); tipEl.hidden = true; anchor = null; }

// ---------------------------------------------------------------- the info card
let cardEl = null;
export function openInfo(key, p = {}) {
  const r = resolve(key, p);
  if (!r) return;
  hideTip();
  const rows = [[t('What it does'), r.long], [t('How long'), r.dur], [t('How to get rid of it'), r.end], [t('Who it affects'), r.who]].filter(x => x[1]);
  const art = r.art ? `<div class="ic-art"><img src="${ART_DIR + r.art}.svg" alt="" draggable="false"></div>` : `<div class="ic-icon">${emo(r.icon)}</div>`;
  cardEl.innerHTML = `<div class="ic-box" role="dialog" aria-modal="true">
    <button class="ic-x" aria-label="${esc(t('Close'))}">${ic('close')}</button>
    ${art}
    <h2 class="ic-title">${r.art ? `<i>${emo(r.icon)}</i> ` : ''}${esc(r.title)}</h2>
    ${r.short ? `<p class="ic-short">${esc(r.short)}</p>` : ''}
    ${rows.map(([h, v]) => `<h4>${esc(h)}</h4><p>${esc(v)}</p>`).join('')}
    <button class="btn small ic-ok">${esc(t('OK'))}</button></div>`;
  cardEl.hidden = false;
  const close = closeInfo;
  cardEl.querySelector('.ic-x').onclick = cardEl.querySelector('.ic-ok').onclick = close;
  cardEl.querySelector('.ic-ok').focus({ preventScroll: true });
}
export function closeInfo() { if (cardEl) cardEl.hidden = true; }
export const infoOpen = () => !!cardEl && !cardEl.hidden;

// ---------------------------------------------------------------- wiring
export function initInfo() {
  if (tipEl) return;
  tipEl = document.createElement('div'); tipEl.id = 'tip'; tipEl.hidden = true; tipEl.setAttribute('role', 'tooltip');
  cardEl = document.createElement('div'); cardEl.id = 'infoCard'; cardEl.hidden = true;
  document.body.append(tipEl, cardEl);
  cardEl.addEventListener('click', e => { if (e.target === cardEl) closeInfo(); });

  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const n = e.target.closest ? tipSource(e.target) : null;
    if (!n) { if (anchor) hideTip(); return; }
    if (n === anchor) return;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => showTip(n), anchor ? 0 : 140);
  });
  document.addEventListener('pointermove', e => { lastPt = { x: e.clientX, y: e.clientY }; });
  document.addEventListener('pointerout', e => { if (!e.relatedTarget && anchor) hideTip(); });
  document.addEventListener('scroll', hideTip, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (infoOpen()) { closeInfo(); e.stopImmediatePropagation(); e.preventDefault(); } hideTip(); } }, true);

  // touch: long-press shows the tooltip; the click that follows is swallowed
  document.addEventListener('pointerdown', e => {
    clearTimeout(pressTimer);
    if (e.pointerType !== 'touch') { hideTip(); return; }
    const n = e.target.closest ? tipSource(e.target) : null;
    if (!n) return hideTip();
    pressTimer = setTimeout(() => { suppressClick = Date.now() + 700; showTip(n); }, 450);
  }, true);
  const cancelPress = () => clearTimeout(pressTimer);
  document.addEventListener('pointerup', cancelPress, true);
  document.addEventListener('pointercancel', cancelPress, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest && tipSource(e.target) && e.pointerType === 'touch') e.preventDefault(); });

  // click on a [data-info] opens the card and never reaches the old handlers
  document.addEventListener('click', e => {
    if (Date.now() < suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    const n = e.target.closest ? e.target.closest('[data-info]') : null;
    if (!n || e.target.closest('#infoCard')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    openInfo(n.dataset.info, paramsOf(n));
  }, true);

  // the HUD is rebuilt on every state update: re-aim or drop a tooltip whose anchor vanished
  setInterval(() => {
    if (!anchor || tipEl.hidden) return;
    if (anchor.isConnected) return;
    const under = document.elementFromPoint(lastPt.x, lastPt.y), n = under && tipSource(under);
    n ? showTip(n) : hideTip();
  }, 250);
  onLang(() => { hideTip(); closeInfo(); });
}

// ---------------------------------------------------------------- card & event guide
// Every card and event in the game. `lang` strings go through t(); money is formatted by the caller's cash().
const D = {
  gang: { type: 'attack', name: 'Hire a Gang', face: 'Wreck 1–3 levels of a rival tile.', long: 'Kept in your hand. On your turn, pay a gang (the price is printed on the card) to wreck 1 to 3 levels of a rival tile at level 2–4. If that tile is secretly protected, there is a shootout instead.', deck: [3, 2] },
  squatters: { type: 'attack', name: 'Send the Squatters', face: 'A rival tile earns no rent for 3 rounds.', long: 'Kept in your hand. Squatters move into one rival tile: it earns no rent for 3 rounds, unless the owner pays to evict them (half the tile\'s value, and only after one full turn of theirs has passed).', deck: [2, 2] },
  protection: { type: 'counter', name: 'Police Protection', face: 'Secretly guard one of your tiles.', long: 'Kept in your hand. Secretly guard one of your tiles: if a rival hires a gang against it, the gang meets the police in a shootout (win: rent ×1.5, loss: rent ×0.5, for 5 rounds).', deck: [2, 2] },
  gift: { type: 'positive', name: 'Mayor’s Gift', face: 'Triple the rent on one tile until your next turn.', long: 'Played at once. Pick one of your tiles: it earns triple rent until your next turn.', deck: [2, 1] },
  billionaire: { type: 'positive', name: 'Shady Billionaire', face: 'A briefcase of cash from a shady donor.', long: 'Played at once. A shady billionaire hands you {c300} — double ({c600}) if you evicted squatters in the last 3 rounds.', deck: [1, 2] },
  bribe: { type: 'positive', name: 'Bribe the Police', face: 'Frame an opponent: they go straight to jail.', long: 'Played at once. Pick an opponent: the captain takes the envelope and they go straight to jail. Casino deck only.', deck: [2, 0] },
  squattersin: { type: 'negative', name: 'Squatters Move In', face: 'Squatters take one of your tiles. No rent for 3 rounds.', long: 'Bad luck. Squatters take over one of your tiles: no rent for 3 rounds, unless you pay to evict them (half the tile\'s value, and only after one full turn of yours has passed). Under the Table only.', deck: [0, 2] },
  crime: { type: 'negative', name: 'Crime Wave', face: 'Your rents drop 40% for 3 rounds.', long: 'Bad luck. A crime wave cuts your rents by 40% on one district (once in ten, the whole city) for 3 rounds. You may pay the police to clear it — then the taxman audits you for 5 rounds. Under the Table only.', deck: [0, 2] },
};
const CASINO_EV = [
  { k: 'whim', art: 'casino-whim', tone: 'pos', name: 'Billionaire’s Whim', pct: 20, face: 'The player who spun gets a windfall.', long: 'The player who spun the wheel receives a quarter of their own cash (at least {c50}).' },
  { k: 'police', art: 'casino-police', tone: 'neg', name: 'Police Investigation', pct: 20, face: 'One of your tiles is shut down for 3 rounds.', long: 'The police close one of the spinner\'s own tiles: no rent for 3 rounds.' },
  { k: 'mayor', art: 'casino-mayor', tone: 'pos', name: 'Mayor’s Favor', pct: 20, face: 'Your best tile earns double rent for 3 rounds.', long: 'The mayor favours the spinner\'s best tile (the one with the highest rent): its rent is doubled for 3 rounds.' },
  { k: 'gang', art: 'casino-gang', tone: 'neg', name: 'Gang Turf', pct: 20, face: 'Your main district pays half rent for 3 rounds.', long: 'A gang takes over the district where the spinner owns the most tiles: the spinner\'s rent there is halved for 3 rounds.' },
  { k: 'onetoomany', art: 'casino-onetoomany', tone: 'neg', name: 'One Too Many', pct: 10, face: 'Whoever spun has their next roll halved.', long: 'The player who spun the wheel has had one too many: their next roll is halved.' },
  { k: 'bombing', art: 'casino-bombing', tone: 'neg', name: 'Building Bombing', pct: 5, face: 'A random tile is destroyed.', long: 'A random owned tile is destroyed: its owner loses it and it goes back on the market.' },
  { k: 'boom', art: 'casino-boom', tone: 'pos', name: 'Economic Boom', pct: 5, face: 'Everyone receives {c300}.', long: 'Every player receives {c300}.' },
];
const GLOBAL_EV = [
  { k: 'squatters', icon: '🛏', art: 'squatters_in', name: 'Squatters', long: 'Squatters move into one random tile of every player: no rent there for 3 rounds.' },
  { k: 'police', icon: '🚓', art: 'casino-police', name: 'Police Raids', long: 'The police close one random tile of every player: no rent there for 2 rounds.' },
  { k: 'mayor', icon: '🎩', art: 'casino-mayor', name: 'Mayor’s Favor', long: 'The mayor doubles the rent of every player\'s best tile for 2 rounds.' },
  { k: 'gang', icon: '🔪', art: 'casino-gang', name: 'Gang Turf', long: 'A gang takes over each player\'s main district: rent halved there for 2 rounds.' },
  { k: 'crime', icon: '🚨', art: 'crime', name: 'Crime Wave', long: 'A crime wave hits each player\'s main district: rent ×0.6 there for 2 rounds (nothing to pay off).' },
  { k: 'gangwar', icon: '🔫', art: 'gang', name: 'Gang War', long: 'Every player\'s best built tile (level 2–4) loses one level.' },
  { k: 'whim', icon: '💵', art: 'casino-whim', name: 'Billionaire’s Whim', long: 'Everyone receives 10% of their cash (at least {c50}).' },
  { k: 'boom', icon: '🎉', art: 'casino-boom', name: 'Economic Boom', long: 'Everyone receives {c200}.' },
  { k: 'audit', icon: '🧾', art: '', name: 'Tax Audit', long: 'Everyone pays 10% of their cash to the bank.' },
  { k: 'onetoomany', icon: '🥃', art: 'casino-onetoomany', name: 'One Too Many', long: 'Everyone has had one too many: all next rolls are halved.' },
  { k: 'protection', icon: '🛡', art: 'protection', name: 'Police Protection', long: 'Every player secretly gets police protection on one of their tiles.' },
];
// the status chips, shown last in the guide
const STATUS_KEYS = ['drunk', 'jail', 'debt', 'mortgaged', 'audit', 'fx-police', 'fx-mayor', 'fx-gang', 'fx-squatters', 'fx-crime', 'fx-gift', 'fx-shootout-win', 'fx-shootout-loss', 'protection', 'taxi', 'mafia', 'props', 'hand', 'worth', 'share'];

export const GUIDE_DATA = { D, CASINO_EV, GLOBAL_EV, STATUS_KEYS };
const TYPE_NAME = { attack: 'ATTACK', counter: 'COUNTER', positive: 'POSITIVE', negative: 'NEGATIVE', casino: 'CASINO' };
const fillParams = { fine: '' };

function guideCard(face, size, body, extra = '') {
  return `<div class="g-item">${face}<div class="g-txt">${body}${extra}</div></div>`;
}

// html of the whole guide. opts: { cash, settings } (settings = S.settings, for the Mafia section)
export function guideHtml({ cash = n => String(n), settings = {} } = {}) {
  const P = { c50: cash(50000), c200: cash(200000), c300: cash(300000), c600: cash(600000) }, tp = s => t(s, P);
  const cardFaceHtml = k => {
    const d = D[k];
    return cardFace({ key: k === 'squattersin' ? 'squatters_in' : k, type: d.type, title: t(d.name), text: tp(d.face), size: 112 }).replace(/<span class="cf-label">[^<]*<\/span>/, `<span class="cf-label">${esc(t(TYPE_NAME[d.type]))}</span>`);
  };
  const deckLine = d => `<small class="g-deck">${t('In the decks')}: ${[d.deck[0] ? `${t('Casino')} ×${d.deck[0]}` : '', d.deck[1] ? `${t('Under the Table')} ×${d.deck[1]}` : ''].filter(Boolean).join(' · ')}</small>`;
  const cardsOf = keys => keys.map(k => guideCard(cardFaceHtml(k), 112, `<h4 class="g-t g-${D[k].type}">${esc(t(D[k].name))}</h4><p>${esc(tp(D[k].long))}</p>`, deckLine(D[k]))).join('');
  const evCard = e => cardFace({ key: e.art, type: 'casino', tone: e.tone, title: t(e.name), text: tp(e.face), value: `${e.pct}%`, size: 112 }).replace(/<span class="cf-label">[^<]*<\/span>/, `<span class="cf-label">${esc(t('CASINO'))}</span>`);
  const L = lang;   // re-render on language change is handled by the caller (it rebuilds the html)
  void L;
  const mafiaOn = !!settings.mafia;
  const every = settings.globalEvery || 0;
  const section = (id, icon, title, intro, body, cls = '') => `<section class="g-sec ${cls}" id="g-${id}"><h3><i>${emo(icon)}</i> ${esc(t(title))}</h3>${intro ? `<p class="g-intro">${intro}</p>` : ''}<div class="g-grid">${body}</div></section>`;
  return `
    <nav class="g-nav">${[['rule', 'Casino squares'], ['deck', 'Casino deck'], ['table', 'Under the Table'], ['wheel', 'Casino wheel'], ['taxi', 'Taxi Company'], ['global', 'Global wheel'], ['mafia', 'The Mafia'], ['status', 'Badges']].map(([id, n]) => `<a href="#g-${id}" data-g="${id}">${esc(t(n))}</a>`).join('')}</nav>
    <section class="g-sec" id="g-rule"><h3>${emo('🎰')} ${esc(t('Casino squares'))}</h3>
      <div class="g-rule"><div class="g-half"><b>50%</b><span>${esc(t('The dealer deals a card from the casino deck.'))}</span></div><div class="g-half"><b>50%</b><span>${esc(t('The wheel spins: one of seven events strikes.'))}</span></div></div>
      <p class="g-intro">${esc(t('The classic cards (advance to a square, collect or pay money, go back 3 spaces, Get Out of Jail Free…) are mixed into both decks.'))}</p></section>
    ${section('deck', '🂠', 'Casino deck', esc(t('Dealt when a casino square lands on “card”. Classic cards are mixed in.')), cardsOf(['gang', 'squatters', 'protection', 'gift', 'billionaire', 'bribe']))}
    ${section('table', '🂡', 'Under the Table', esc(t('The second deck, drawn from the Under the Table squares. Bribe the Police never appears here.')), cardsOf(['gang', 'squatters', 'protection', 'squattersin', 'crime', 'billionaire', 'gift']))}
    ${section('wheel', '🎡', 'Casino wheel', esc(t('The wheel affects only the player who landed, except Building Bombing and Economic Boom. If that player has nothing to hit (no tile to shut down, say), that slice is skipped and the odds are shared out again.')),
      CASINO_EV.map(e => guideCard(evCard(e), 112, `<h4 class="g-t g-casino">${esc(t(e.name))} <em>${e.pct}%</em></h4><p>${esc(tp(e.long))}</p>`)).join(''))}
    <section class="g-sec" id="g-taxi"><h3><i>${emo('🚕')}</i> ${esc(t('Taxi Company'))}</h3>
      <p class="g-intro">${esc(t('Landing on the Taxi Company (square 20) calls a cab. On your next turn there are no dice: you pick any square and ride straight there. Passing Payday pays your salary, the square you reach is played as usual, and there is no extra roll. If the Taxi Company jackpot is on, landing here still wins it.'))}</p></section>
    ${section('global', '🌍', 'Global wheel', esc(every ? t('Every {n} rounds the wheel hits every player. Eleven events, all equally likely (about 9% each).', { n: every }) : t('Switched off in this lobby. When on, it hits every player: eleven events, all equally likely (about 9% each).')),
      GLOBAL_EV.map(e => `<div class="g-item g-ev">${e.art ? `<div class="g-art"><img src="${ART_DIR + e.art}.svg" alt="" draggable="false"></div>` : `<div class="g-art g-noart">${emo(e.icon)}</div>`}<div class="g-txt"><h4 class="g-t g-casino"><i>${emo(e.icon)}</i> ${esc(t(e.name))} <em>9%</em></h4><p>${esc(tp(e.long))}</p></div></div>`).join(''))}
    <section class="g-sec" id="g-mafia"><h3><i>${ic('fedora')}</i> ${esc(t('The Mafia'))}</h3>
      <div class="g-item g-ev"><div class="g-art"><img src="${ART_DIR}mafia-table.svg" alt="" draggable="false"></div><div class="g-txt">
        <h4 class="g-t g-casino">${esc(t('Borrow from the Mafia'))} <em>${mafiaOn ? esc(t('ON')) : esc(t('OFF'))}</em></h4>
        <p>${esc(t('When your cash is below zero and the loan would cover the debt, the family offers you cash. You may borrow twice per game, one loan at a time. Repay before the deadline: otherwise they take your cash, then your best tile, or knock you out if you own nothing.'))}</p>
        <p>${esc(t('You choose the terms when you borrow: $200K to $3M (in $50K steps, at least enough to cover your debt) and 3 to 10 turns to repay.'))}</p>
        <p class="g-now">${esc(t('Interest = 10% + 4% × turns + 2% per $250K borrowed. Example: $1M for 5 turns → repay $1.38M (38%).'))} ${mafiaOn ? '' : esc(t('Not enabled in this lobby (host setting “Borrow from the Mafia”).'))}</p>
      </div></div></section>
    <section class="g-sec" id="g-status"><h3><i>${emo('🏷')}</i> ${esc(t('Badges'))}</h3><p class="g-intro">${esc(t('Hover any icon in the game for a quick hint, click it for the full story.'))}</p>
      <div class="g-grid g-small">${STATUS_KEYS.map(k => { const r = resolve(k, { ...fillParams, n: '–', pct: '–', tile: t('a tile'), left: t('a few rounds left'), due: '–', amount: '–', name: '–' }); return `<div class="g-badge"><i>${emo(r.icon)}</i><div><b>${esc(r.title)}</b><span>${esc(r.long)}</span></div></div>`; }).join('')}</div></section>`;
}

let guideEl = null, guideOpts = null;
export function openGuide(opts) {
  guideOpts = opts || guideOpts || {};
  if (!guideEl) {
    guideEl = document.createElement('div'); guideEl.id = 'guide'; guideEl.hidden = true;
    document.body.append(guideEl);
    guideEl.addEventListener('click', e => {
      if (e.target.closest('.g-close')) return closeGuide();
      const a = e.target.closest('.g-nav a');
      if (a) { e.preventDefault(); const s = guideEl.querySelector('#g-' + a.dataset.g); s && s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && guideEl && !guideEl.hidden && !infoOpen()) { closeGuide(); e.stopImmediatePropagation(); } }, true);
    onLang(() => { if (!guideEl.hidden) renderGuide(); });
  }
  renderGuide();
  guideEl.hidden = false;
  document.body.classList.add('guide-open');
  guideEl.querySelector('.g-body').scrollTop = 0;
}
function renderGuide() {
  guideEl.innerHTML = `<div class="g-wrap"><header class="g-head"><h2>${esc(t('Cards & events'))}</h2><button class="btn small g-close">${ic('close')}<span>${esc(t('Close'))}</span></button></header><div class="g-body">${guideHtml(guideOpts)}</div></div>`;
}
export function closeGuide() { if (guideEl) guideEl.hidden = true; document.body.classList.remove('guide-open'); }
export const guideOpen = () => !!guideEl && !guideEl.hidden;
