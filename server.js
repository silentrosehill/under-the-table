// Monopoly LAN party server. Zero dependencies: `node server.js`
// Players on the same Wi-Fi open http://<host-ip>:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { MAPS, buildGame } = require('./maps');

const PORT = process.env.MONOPOLY_DESKTOP ? 0 : Number(process.env.PORT) || 3000;
const ONLINE = process.argv.includes('--online');
let inviteUrl = null; // public link when --online is used
const MAX_PLAYERS = 4;
const TOKENS = ['car', 'hat', 'watch', 'case'];     // the pieces on offer: a 1950s sedan, a fedora, a pocket watch, a briefcase (the client draws them in tokens.js)
const OLD_TOKENS = { ship: 'car', rocket: 'car', dino: 'watch', cat: 'watch', dog: 'watch', crown: 'hat', glass: 'case' };     // retired pieces: a player who still holds one gets the nearest, or the next free one
// every player holds one of the current pieces, each different (players carried in from an older game may still hold a retired one)
function fixTokens(list) {
  list.forEach((p, i) => {
    const taken = t => list.some((o, j) => j !== i && o.token === t && (j < i || TOKENS.includes(o.token)));
    if (TOKENS.includes(p.token) && !taken(p.token)) return;
    const want = OLD_TOKENS[p.token];
    p.token = (want && !taken(want) ? want : null) || TOKENS.find(t => !taken(t)) || TOKENS[0];
  });
}
const COLORS = ['#7a2626', '#2b4a7a', '#2f5d3a', '#4e2f6b'];     // deep, muted: oxblood, navy, bottle green, aubergine (the client lightens them for text and glows)
const OLD_COLORS = { '#e74c3c': COLORS[0], '#e67e22': COLORS[0], '#3498db': COLORS[1], '#2ecc71': COLORS[2], '#1abc9c': COLORS[2], '#9b59b6': COLORS[3], '#ff6fb5': COLORS[3] };     // the old bright set: each maps to its nearest deep colour
// every player holds one of the current colours, each different (players carried in from an older game may still hold a retired one)
function fixColors(list) {
  list.forEach((p, i) => {
    const taken = c => list.some((o, j) => j !== i && o.color === c && (j < i || COLORS.includes(o.color)));
    if (COLORS.includes(p.color) && !taken(p.color)) return;
    const want = OLD_COLORS[p.color];
    p.color = (want && !taken(want) ? want : null) || COLORS.find(c => !taken(c)) || COLORS[0];
  });
}
const GO_SALARY = 200000;
// Game speed (host setting, lobby only): clients stretch/shrink every animation and hold by this factor; the server paces bots with it.
const SPEEDS = { relaxed: 1.6, normal: 1, fast: 0.65 };
const speedMult = () => SPEEDS[g.settings.speed] || SPEEDS.relaxed;
// Rent of stations (by count owned, doubled in v1.3) and utilities (× dice). Mirrored in public/app.js, hovercard.js, cityScene.js.
const RAIL_RENT = 50000, UTIL_RENT = [8000, 20000];
const JAIL_POS = 10;
const TAXI_POS = 20;
const JAIL_FINE = 50000;

// ---------------------------------------------------------------- state

let g = null;
const GLOBAL_EVERY_DEFAULT = (e => (Number.isInteger(e) && e >= 0 && e <= 10 ? e : 5))(process.env.GLOBAL_EVERY != null && process.env.GLOBAL_EVERY !== '' ? Number(process.env.GLOBAL_EVERY) : NaN); // GLOBAL_EVERY=<n> is a test hook

let gidSeq = Date.now(), logSeq = 0;   // gidSeq: ids for "which game / which board" (clients use them to know what they already hold)
g = freshGame([]);
// Long-polling: each browser keeps one /poll request open; we answer it whenever the game changes.
// (Works through any proxy or tunnel, unlike streaming responses.)
let version = 0;
const waiters = new Set(); // { res, secret, timer }
const lastSeen = new Map(); // secret -> time of last poll
const POLL_HOLD_MS = 25000;
const OFFLINE_AFTER_MS = 35000;

function freshGame(players) {
  return {
    phase: 'lobby',
    gid: ++gidSeq, boardVer: 0,
    settings: g ? g.settings : { map: 'underworld', startMoney: 2000000, jackpot: false, mode: 'ffa', teamTax: 15, teamRent: 'half', events: true, maxRounds: 50, globalEvery: GLOBAL_EVERY_DEFAULT, mafia: false, speed: 'relaxed' },
    players: (list => { fixTokens(list); fixColors(list); return list; })(players.map(p => ({ ...p, ...playerDefaults() }))),
    hostId: (players.find(p => !p.bot) || players[0] || {}).id || null,
    board: null,
    meta: null,
    props: {},          // pos -> { owner, level 1..5, mortgaged }
    turn: 0,
    turnState: 'roll',  // roll | buy | upgrade | buyout | end
    dice: [1, 1],
    rollId: 0,
    doubles: 0,
    extraRoll: false,
    pending: null,
    jackpot: 0,
    decks: null,
    lastCard: null,
    lastCasino: null,
    lastGlobal: null,   // the latest global wheel: { id, round, key, title, results: [{ player, text }] }
    effects: [],        // timed effects { id, kind, pos?, group?, city?, owner?, mult, until, untilTurnOf?, label }
    protection: {},     // pos -> owner id: hidden Police Protection (never sent to clients as such)
    cardStats: null,    // sim only
    trade: null,
    moves: [],          // recent movement steps so clients can animate the exact path
    moveSeq: 0,
    events: [],         // gifts, emotes, chaos events — one-off effects for clients
    eventSeq: 0,
    round: 1,
    turnSeq: 1,         // counts every turn of the game (squatters: the owner may evict after one full turn of theirs)
    event: null,        // the chaos event running this round
    outOrder: [],
    log: [],
    winner: null,
    winnerTeam: null,
    teamShare: [0, 0], // 2v2: % of rent on a team's tiles that goes to the teammate
    splitCount: 0,     // sim only
  };
}

function playerDefaults() {
  return { money: 0, pos: 0, inJail: false, jailTurns: 0, jailCards: [], bankrupt: false, lastCreditor: null, debtSince: 0, loan: null, loans: 0,
    hand: [], lastEvict: null, doneSeq: 0, auditUntil: 0, drunk: false, taxi: false, botErrors: 0,
    stats: { rentEarned: 0, rentPaid: 0, bought: 0, doubles: 0, jail: 0, gifted: 0 } };
}

const byId = id => g.players.find(p => p.id === id);
const bySecret = s => g.players.find(p => p.secret === s);
const space = pos => g.board[pos];
const cur = () => g.players[g.turn];
const meta = () => g.meta || MAPS[g.settings.map];
// Compact money: $950, $60K, $12.5K, $1.2M, $1.25M. Same rules as cash() in public/app.js.
function fmtMoney(n, cur) {
  const a = Math.abs(n), sign = n < 0 ? '-' : '';
  const trim = (x, d) => String(Number(x.toFixed(d)));
  let body;
  if (a < 1000) body = String(Math.round(a));
  else if (Math.round(a / 100) / 10 < 1000) body = trim(a / 1000, 1) + 'K';
  else body = trim(a / 1e6, 2) + 'M';
  return `${sign}${cur}${body}`;
}
const money = n => fmtMoney(n, meta().currency);
const die = () => crypto.randomInt(1, 7); // cryptographically random, no patterns
const pickOne = arr => arr[crypto.randomInt(arr.length)];

// ---------------------------------------------------------------- teams, events, worth

const TEAMS = [{ name: 'Team Sun', emoji: '☀️', color: '#8a5f1a' }, { name: 'Team Moon', emoji: '🌙', color: '#2d6168' }];     // deep amber and deep teal (apart from the four player colours)
const EMOTES = ['😂', '😎', '😭', '😡', '🔥', '💸', '👏', '🤝', '🙏', '😈', '🤑', '🎉'];
const isTeams = () => g.settings.mode === 'teams';
const mateOf = p => (isTeams() ? g.players.find(o => o !== p && o.team === p.team && !o.bankrupt) : null);
const sameTeam = (a, b) => isTeams() && a && b && a.team === b.team;
const alivePlayers = () => g.players.filter(p => !p.bankrupt);
const eventActive = key => g.event && g.event.key === key && g.event.round === g.round;

function pushEvent(e) {
  g.events.push({ seq: ++g.eventSeq, ...e });
  if (g.events.length > 30) g.events.shift();
}

function botEmote(p, list, chance = 0.35) {
  if (p && p.bot && Math.random() < chance) pushEvent({ type: 'emote', player: p.id, emoji: pickOne(list) });
}

function netWorth(p) {
  let w = p.money;
  for (const [pos, st] of Object.entries(g.props)) {
    if (st.owner !== p.id) continue;
    const sp = space(pos);
    w += (st.mortgaged ? sp.price / 2 : sp.price) + (st.level - 1) * (sp.houseCost || 0);
  }
  return Math.round(w);
}

function smallerTeam(except) {
  const c = [0, 0];
  for (const o of g.players) if (o !== except && (o.team === 0 || o.team === 1)) c[o.team]++;
  return c[0] <= c[1] ? 0 : 1;
}

function balanceTeams() {
  for (const o of g.players) if (o.team !== 0 && o.team !== 1) o.team = smallerTeam(o);
  for (const t of [0, 1]) {
    const members = g.players.filter(o => o.team === t);
    while (members.length > 2) members.pop().team = 1 - t;
  }
}

// Chaos events: a random twist at the start of some rounds.
const CHAOS = [
  { key: 'payday', emoji: '💰', name: 'Payday', run: () => { alivePlayers().forEach(p => gain(p, 100000)); return `Everyone gets ${money(100000)}!`; } },
  { key: 'golden', emoji: '🌟', name: 'Golden GO', run: () => `Passing ${space(0).name} pays double this round.` },
  { key: 'boom', emoji: '📈', name: 'Rent Boom', run: () => 'All rents are +50% this round.' },
  { key: 'crash', emoji: '📉', name: 'Market Crash', run: () => 'All rents are −50% this round.' },
  { key: 'lottery', emoji: '🎰', name: 'Lottery', run: () => { const w = pickOne(alivePlayers()); gain(w, 250000); return `${w.name} wins ${money(250000)}!`; } },
  { key: 'taxday', emoji: '🧾', name: 'Tax Day', run: () => { alivePlayers().forEach(p => { const t = Math.floor(Math.max(0, p.money) * 0.1); if (t) charge(p, t); }); return 'Everyone pays 10% of their cash.'; } },
  { key: 'doubles', emoji: '🎲', name: 'Lucky Doubles', run: () => `Rolling doubles pays ${money(50000)} this round.` },
  {
    key: 'storm', emoji: '🌪️', name: 'Storm',
    ok: () => Object.values(g.props).some(st => st.level >= 2),
    run: () => {
      const [pos, st] = pickOne(Object.entries(g.props).filter(([, s]) => s.level >= 2));
      const sp = space(pos), owner = byId(st.owner), refund = sp.houseCost / 2;
      st.level--;
      gain(owner, refund);
      return `A storm blew a level off ${sp.name}! ${owner.name} gets ${money(refund)} back.`;
    },
  },
];

function startRound() {
  const gone = g.effects.filter(e => g.round >= e.until);
  if (gone.length) {
    g.effects = g.effects.filter(e => g.round < e.until);
    for (const e of gone) log(`⌛ ${e.label} has ended.`);
  }
  const every = g.settings.globalEvery;
  if (every > 0 && g.round > 1 && g.round % every === 0) runGlobalWheel();
  if (!g.settings.events || g.round < 2 || crypto.randomInt(100) >= 45) return;
  const ev = pickOne(CHAOS.filter(e => !e.ok || e.ok()));
  g.event = { key: ev.key, emoji: ev.emoji, name: ev.name, desc: ev.run(), round: g.round };
  log(`${ev.emoji} ${ev.name}! ${g.event.desc}`);
  pushEvent({ type: 'chaos', ...g.event });
}

function log(text) {
  g.log.push({ n: ++logSeq, t: Date.now(), text });
  if (g.log.length > 150) g.log.shift();
}

// ---------------------------------------------------------------- cards

function nearest(pos, type) {
  for (let k = 1; k <= 40; k++) {
    const i = (pos + k) % 40;
    if (space(i).type === type) return i;
  }
  return pos;
}

// Attack / counter cards go to the player's hand; the rest resolve when drawn.
const HAND_CARDS = {
  gang: { type: 'attack', name: 'Hire a Gang', text: 'Keep this card. Pay a gang to wreck 1–3 levels of a rival tile (level 2–4).' },
  squatters: { type: 'attack', name: 'Send the Squatters', text: 'Keep this card. Squatters move into a rival tile — no rent for 3 rounds.' },
  protection: { type: 'counter', name: 'Police Protection', text: 'Keep this card. Secretly guard one of your tiles against a gang.' },
};
const DRAWN_CARDS = {
  squattersin: { type: 'negative', name: 'Squatters Move In', text: 'Squatters move into one of your properties — no rent for 3 rounds.' },
  crime: { type: 'negative', name: 'Crime Wave', text: 'A crime wave hits — rents on your tiles drop by 40% for 3 rounds.' },
  billionaire: { type: 'positive', name: 'Shady Billionaire', text: 'A shady billionaire slips you a briefcase of cash.' },
  bribe: { type: 'positive', name: 'Bribe the Police', text: 'Slip the captain an envelope: an opponent of your choice is hauled off to jail.' },
  gift: { type: 'positive', name: "Mayor's Gift", text: 'The mayor blesses one of your properties — triple rent until your next turn.' },
};
const handTemplate = key => ({ key, type: HAND_CARDS[key].type, text: HAND_CARDS[key].text, hand: true });

function buildDecks() {
  const n = i => space(i).name;
  const cl = o => ({ key: 'classic', type: 'classic', ...o });
  const extra = (key, count) => Array.from({ length: count }, () => (HAND_CARDS[key] ? handTemplate(key) : { key, type: DRAWN_CARDS[key].type, text: DRAWN_CARDS[key].text }));
  const chance = [
    cl({ text: `Advance to ${n(0)}. Collect ${money(GO_SALARY)}.`, fn: p => moveTo(p, 0) }),
    cl({ text: `Advance to ${n(24)}.`, fn: p => moveTo(p, 24) }),
    cl({ text: `Advance to ${n(39)}.`, fn: p => moveTo(p, 39) }),
    cl({ text: `Advance to the nearest ${meta().rail}. If owned, pay double rent.`, fn: p => moveTo(p, nearest(p.pos, 'railroad'), { rentMult: 2 }) }),
    cl({ text: `Advance to the nearest utility. If owned, pay ${money(UTIL_RENT[1])} × the dice.`, fn: p => moveTo(p, nearest(p.pos, 'utility'), { utilMult: UTIL_RENT[1] }) }),
    cl({ text: `Get out of ${n(10)} free! Keep this card.`, jail: true }),
    cl({ text: `Go back 3 spaces.`, fn: p => { const from = p.pos; p.pos = (p.pos + 37) % 40; track(p, from, p.pos, 'back'); land(p); } }),
    cl({ text: `Your building loan matures. Collect ${money(150000)}.`, fn: p => gain(p, 150000) }),
    ...extra('gang', 3), ...extra('squatters', 2), ...extra('protection', 2), ...extra('gift', 2), ...extra('billionaire', 1), ...extra('bribe', 2), // bribe: casino deck only — never part of a global wheel
  ];
  const chest = [
    cl({ text: `Advance to ${n(0)}. Collect ${money(GO_SALARY)}.`, fn: p => moveTo(p, 0) }),
    cl({ text: `Bank error in your favor. Collect ${money(200000)}.`, fn: p => gain(p, 200000) }),
    cl({ text: `Get out of ${n(10)} free! Keep this card.`, jail: true }),
    cl({ text: `Holiday fund matures. Collect ${money(100000)}.`, fn: p => gain(p, 100000) }),
    cl({ text: `Life insurance matures. Collect ${money(100000)}.`, fn: p => gain(p, 100000) }),
    cl({ text: `You inherit ${money(100000)}.`, fn: p => gain(p, 100000) }),
    cl({ text: `Hospital fees. Pay ${money(100000)}.`, fn: p => charge(p, 100000) }),
    cl({ text: `School fees. Pay ${money(50000)}.`, fn: p => charge(p, 50000) }),
    cl({ text: `It's your birthday! Collect ${money(10000)} from every player.`, fn: p => eachOther(p, 10000) }),
    ...extra('gang', 2), ...extra('squatters', 2), ...extra('protection', 2), ...extra('squattersin', 2), ...extra('crime', 2), ...extra('billionaire', 2), ...extra('gift', 1),
  ];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { chance: shuffle(chance), chest: shuffle(chest) };
}

const cardCount = key => { if (g.cardStats) g.cardStats[key] = (g.cardStats[key] || 0) + 1; };
let uidSeq = 0;
const uid = () => Date.now() + (++uidSeq % 1000) / 1000; // unique numeric id (Date.now()+Math.random() collided inside one tick)
const newId = () => crypto.randomBytes(4).toString('hex');

function drawCard(p, deckName, casino) {
  const deck = g.decks[deckName];
  if (process.env.CARD_FORCE) { const i = deck.findIndex(c => c.key === process.env.CARD_FORCE); if (i > 0) deck.unshift(...deck.splice(i, 1)); } // test hook
  const card = deck.shift();
  const title = meta()[deckName];
  const name = (HAND_CARDS[card.key] || DRAWN_CARDS[card.key] || {}).name;
  const hc = card.hand ? { id: newId(), key: card.key, type: card.type, deck: deckName } : null;
  if (hc && card.key === 'gang') hc.cost = Math.round((150000 + crypto.randomInt(250001)) / 10000) * 10000;
  const text = hc && hc.cost ? `${card.text} Price: ${money(hc.cost)}.` : card.text;
  g.lastCard = { id: uid(), deck: deckName, title, text, player: p.id, key: card.key, type: card.type };
  if (name) g.lastCard.name = name;
  if (hc && hc.cost) g.lastCard.cost = hc.cost;
  if (casino) casino.cardId = g.lastCard.id;
  track(p, p.pos, p.pos, 'card', { deck: deckName, title, text, ...(casino ? { casino: true } : {}) });
  log(`${p.name} drew ${title}: ${name ? name + ' — ' : ''}${text}`);
  cardCount('drew:' + card.key);
  if (card.jail) {
    p.jailCards.push({ deck: deckName, card }); // removed from deck until used
  } else if (hc) {
    p.hand.push(hc);
    while (p.hand.length > 3) {
      const old = p.hand.shift();
      g.decks[old.deck].push(handTemplate(old.key));
      log(`🗑 ${p.name}'s hand was full — ${HAND_CARDS[old.key].name} went back to the deck.`);
    }
  } else {
    deck.push(card);
    if (card.fn) card.fn(p); else immediateCard(p, card.key);
  }
}

// Effects that carry a hidden/own-turn flavour of rent change.
function setEffect(e) { // replaces an existing effect of the same kind(s) on the same tile
  if (e.pos != null) g.effects = g.effects.filter(x => !(x.pos === e.pos && (x.kind === e.kind || (e.kind.startsWith('shootout') && x.kind.startsWith('shootout')))));
  addEffect(e);
}

function immediateCard(p, key) {
  const mine = () => Object.keys(g.props).map(Number).filter(i => g.props[i].owner === p.id && !g.props[i].mortgaged);
  if (key === 'squattersin') {
    const list = mine();
    if (!list.length) return log('The squatters found nothing of yours to take.');
    const pos = pickOne(list), name = space(pos).name;
    setEffect({ kind: 'squatters', pos, mult: 0, until: g.round + 3, label: `Squatters: ${name}` });
    log(`🛏 Squatters moved into ${name} — ${p.name} gets no rent for 3 rounds.`);
  } else if (key === 'crime') {
    const props = g.board.filter(s => s.type === 'property');
    const groups = [...new Set(props.map(s => s.group))];
    const city = crypto.randomInt(10) === 0;
    let group = null, label, tiles;
    if (city) { label = 'Crime wave: the whole city'; tiles = mine().filter(i => space(i).type === 'property'); }
    else {
      const ownedGroups = groups.filter(x => props.some(s => s.group === x && g.props[s.i] && g.props[s.i].owner === p.id));
      group = pickOne(ownedGroups.length ? ownedGroups : groups);
      label = `Crime wave: ${GROUP_WORD(group)} district`;
      tiles = mine().filter(i => space(i).group === group);
    }
    const e = { id: uid(), kind: 'crime', owner: p.id, mult: 0.6, until: g.round + 3, label };
    if (city) e.city = true; else e.group = group;
    g.effects.push(e);
    log(city ? `🚨 A crime wave sweeps the whole city — ${p.name}'s rents drop by 40% for 3 rounds.` : `🚨 A crime wave hits the ${GROUP_WORD(group)} district — ${p.name}'s rents there drop by 40% for 3 rounds.`);
    if (tiles.length) g.pending = { kind: 'crime', cost: 100000 * tiles.length, effectId: e.id };
  } else if (key === 'billionaire') {
    const bonus = p.lastEvict != null && g.round - p.lastEvict <= 3;
    const amt = bonus ? 600000 : 300000;
    gain(p, amt);
    log(bonus ? `💼 A shady billionaire pays ${p.name} ${money(amt)} — double, thanks to the recent eviction!` : `💼 A shady billionaire slips ${p.name} ${money(amt)}.`);
  } else if (key === 'gift') {
    const options = mine();
    if (!options.length) return log(`🎁 Mayor's Gift… but ${p.name} owns nothing to bless.`);
    g.pending = { kind: 'gift', options };
  } else if (key === 'bribe') {
    // resolves on draw: pick an alive opponent (not a teammate, not already in jail) to frame
    const options = alivePlayers().filter(o => o !== p && !sameTeam(p, o) && !o.inJail).map(o => o.id);
    if (!options.length) return log(`💰 ${p.name} bribed the police… but there's no one to frame.`);
    g.pending = { kind: 'bribe', options };
  }
}

// ---------------------------------------------------------------- money

function gain(p, amt) { p.money += amt; }

function charge(p, amt) { // pay the bank (or the jackpot)
  p.money -= amt;
  p.lastCreditor = null;
  if (g.settings.jackpot) g.jackpot += amt;
}

function pay(from, to, amt) {
  from.money -= amt;
  to.money += amt;
  from.lastCreditor = to.id;
}

function eachOther(p, amt) { // amt > 0: others pay p; amt < 0: p pays others
  for (const o of g.players) {
    if (o === p || o.bankrupt) continue;
    if (amt > 0) pay(o, p, amt); else pay(p, o, -amt);
  }
}

function repairs(p, perHouse, perHotel) {
  let total = 0;
  for (const [pos, st] of Object.entries(g.props)) {
    if (st.owner !== p.id) continue;
    total += st.level === 5 ? perHotel : (st.level - 1) * perHouse;
  }
  if (total) charge(p, total);
  log(`${p.name} paid ${money(total)} for repairs.`);
}

// ---------------------------------------------------------------- movement

function track(p, from, to, how, card) {
  g.moves.push({ seq: ++g.moveSeq, player: p.id, from, to, how, card });
  if (g.moves.length > 40) g.moves.shift();
}

function sendToJail(p) {
  track(p, p.pos, JAIL_POS, 'jail');
  p.pos = JAIL_POS;
  p.inJail = true;
  p.jailTurns = 0;
  p.stats.jail++;
  g.extraRoll = false;
  botEmote(p, ['😡', '😭']);
  log(`${p.name} was sent to ${space(JAIL_POS).name}!`);
}

function move(p, steps) {
  const to = (p.pos + steps) % 40;
  if (to < p.pos) passGo(p);
  track(p, p.pos, to, 'walk');
  p.pos = to;
  land(p);
}

function moveTo(p, to, opts) {
  if (to < p.pos) passGo(p);
  track(p, p.pos, to, 'walk');
  p.pos = to;
  land(p, opts);
}

function passGo(p) {
  const salary = GO_SALARY * (eventActive('golden') ? 2 : 1);
  gain(p, salary);
  log(`${p.name} passed ${space(0).name} and collected ${money(salary)}.`);
  if (g.round < p.auditUntil && crypto.randomInt(100) < 30) {
    const x = Math.floor(Math.max(0, p.money) * 0.1);
    if (x) { charge(p, x); log(`🧾 Tax audit! ${p.name} pays ${money(x)}.`); cardCount('audit'); }
  }
}

function ownedCount(ownerId, type) {
  return g.board.filter(s => s.type === type && g.props[s.i] && g.props[s.i].owner === ownerId).length;
}

function hasMonopoly(ownerId, group) {
  return g.board.filter(s => s.group === group).every(s => g.props[s.i] && g.props[s.i].owner === ownerId);
}

function effectMult(pos) {
  const sp = space(pos), st = g.props[pos];
  let m = 1;
  for (const e of g.effects) {
    if (g.round >= e.until) continue;
    if (e.owner != null && (!st || st.owner !== e.owner)) continue;
    if (e.pos != null ? e.pos === pos : e.city ? sp.type === 'property' : (e.group != null && sp.type === 'property' && sp.group === e.group)) m *= e.mult;
  }
  return m;
}

const policeShut = pos => g.effects.some(e => e.kind === 'police' && e.pos === pos && g.round < e.until);

function rentFor(pos, opts) {
  const mult = eventActive('boom') ? 1.5 : eventActive('crash') ? 0.5 : 1;
  return Math.round(baseRent(pos, opts) * mult * effectMult(pos));
}

function baseRent(pos, opts = {}) {
  const sp = space(pos), st = g.props[pos];
  if (!st || st.mortgaged) return 0;
  const diceTotal = g.dice[0] + g.dice[1];
  if (sp.type === 'property') {
    const base = sp.rent[st.level || 1];
    return hasMonopoly(st.owner, sp.group) ? Math.round(base * 1.5) : base;
  }
  if (sp.type === 'railroad') return RAIL_RENT * 2 ** (ownedCount(st.owner, 'railroad') - 1) * (opts.rentMult || 1);
  if (sp.type === 'utility') {
    const mult = opts.utilMult || (UTIL_RENT[ownedCount(st.owner, 'utility') === 2 ? 1 : 0]);
    return diceTotal * mult;
  }
  return 0;
}

function land(p, opts) {
  const sp = space(p.pos);
  log(`${p.name} landed on ${sp.name}.`);
  switch (sp.type) {
    case 'property': case 'railroad': case 'utility': {
      const st = g.props[p.pos];
      if (!st) { g.pending = { type: 'buy', kind: 'buy', pos: p.pos }; return; }
      if (st.owner === p.id) {
        if (sp.type === 'property' && !st.mortgaged && st.level < 5) g.pending = { kind: 'upgrade', pos: p.pos };
        return;
      }
      if (st.mortgaged) { log(`${sp.name} is mortgaged — no rent.`); return; }
      const owner = byId(st.owner);
      let rent = rentFor(p.pos, opts);
      if (sameTeam(p, owner)) {
        if (g.settings.teamRent === 'none') { log(`${owner.name} is ${p.name}'s teammate — no rent!`); return; }
        if (g.settings.teamRent === 'half') rent = Math.floor(rent / 2);
      }
      if (rent === 0 && policeShut(p.pos)) {
        log(`🚓 ${sp.name} is closed by the police — no rent.`);
      } else if (rent === 0 && g.effects.some(e => e.kind === 'squatters' && e.pos === p.pos && g.round < e.until)) {
        log(`🛏 Squatters have taken over ${sp.name} — no rent.`);
      } else {
        const mate = mateOf(owner);
        const pct = isTeams() && mate && !sameTeam(p, owner) ? g.teamShare[owner.team] || 0 : 0;
        const cut = pct > 0 ? Math.round(rent * pct / 100 / 1000) * 1000 : 0;
        if (cut > 0) pay(p, mate, cut); // owner is paid last so they stay the creditor
        pay(p, owner, rent - cut);
        p.stats.rentPaid += rent;
        owner.stats.rentEarned += rent - cut;
        log(`${p.name} paid ${money(rent)} rent to ${owner.name}.`);
        if (cut > 0) {
          mate.stats.rentEarned += cut;
          g.splitCount++;
          log(`⚖ Rent split: ${owner.name} keeps ${money(rent - cut)}, ${mate.name} gets ${money(cut)} (${pct}%).`);
        }
      }
      if (rent >= 150000) { botEmote(p, ['😭', '😡', '💸']); botEmote(owner, ['😎', '🤑', '😈']); }
      if (sp.type === 'property' && !sameTeam(p, owner) && st.level < 5 && !p.bankrupt && p.money >= 0) {
        g.pending = { kind: 'buyout', pos: p.pos, cost: buyoutCost(p.pos) };
      }
      return;
    }
    case 'tax':
      charge(p, sp.amount);
      log(`${p.name} paid ${money(sp.amount)} in ${sp.name}.`);
      return;
    case 'chance': case 'chest':
      drawCard(p, sp.type);
      return;
    case 'casino':
      spinCasino(p, sp);
      return;
    case 'gotojail':
      sendToJail(p);
      return;
    case 'taxi':
      if (g.settings.jackpot && g.jackpot > 0) {
        log(`${p.name} won the ${money(g.jackpot)} jackpot!`);
        gain(p, g.jackpot);
        g.jackpot = 0;
      }
      p.taxi = true;
      log(`🚕 ${p.name} calls a cab — next turn they can ride anywhere.`);
      return;
  }
}

// ---------------------------------------------------------------- casino

const GROUP_WORD = grp => (grp === 'darkblue' ? 'Dark blue' : grp === 'lightblue' ? 'Light blue' : grp[0].toUpperCase() + grp.slice(1));
const CASINO_EVENTS = [
  ['whim', 20], ['police', 20], ['mayor', 20], ['gang', 20], ['onetoomany', 10], ['bombing', 5], ['boom', 5],
];

// "One Too Many": the player's next roll is halved (movement only). Reusable by a later global wheel (apply to every player).
function applyOneTooMany(p) {
  p.drunk = true;
  log(`🥃 One Too Many: ${p.name} had one too many — their next roll is halved.`);
}

function addEffect(e) {
  g.effects.push({ id: uid(), until: g.round + 3, ...(e.kind === 'squatters' ? { placedSeq: g.turnSeq } : {}), ...e });
}
function dropEffectsAt(pos) {
  g.effects = g.effects.filter(e => e.pos !== Number(pos));
}

// A casino square: half the time the dealer deals a card from the casino deck, half the time the wheel spins.
// CASINO_FORCE=card|event is a test hook (harmless when unset).
function spinCasino(p, sp) {
  const force = process.env.CASINO_FORCE;
  const mode = force === 'card' || force === 'event' ? force : crypto.randomInt(2) ? 'card' : 'event';
  if (mode === 'card') {
    log(`🎰 ${p.name} tries their luck at ${sp.name}: the dealer deals a card.`);
    const c = { id: uid(), mode: 'card', player: p.id, pos: p.pos, key: 'card', title: 'The dealer deals', text: '', target: {} };
    g.lastCasino = c;
    if (g.casinoStats) g.casinoStats.card = (g.casinoStats.card || 0) + 1;
    drawCard(p, 'chance', c);
    return;
  }
  log(`🎰 ${p.name} tries their luck at ${sp.name}: the wheel spins.`);
  // Events hit the player who landed (except Bombing and Boom): their own tiles, their own cash.
  const hasFx = (kind, i) => g.effects.some(e => e.kind === kind && e.pos === i && g.round < e.until);
  const mine = kind => Object.keys(g.props).map(Number).filter(i => g.props[i].owner === p.id && !g.props[i].mortgaged && !hasFx(kind, i));
  const anyFree = () => Object.keys(g.props).map(Number).filter(i => space(i).type === 'property' && !g.props[i].mortgaged && !hasFx('bombing', i));
  // the district where the lander owns the most tiles (not already under their own gang)
  const turf = () => {
    const n = {};
    for (const i of Object.keys(g.props).map(Number)) if (g.props[i].owner === p.id && space(i).type === 'property') n[space(i).group] = (n[space(i).group] || 0) + 1;
    return Object.keys(n).filter(x => !g.effects.some(e => e.kind === 'gang' && e.group === x && e.owner === p.id && g.round < e.until)).sort((a, b) => n[b] - n[a])[0] || null;
  };
  const ok = {
    whim: () => true, boom: () => true, onetoomany: () => true,
    police: () => mine('police').length > 0,
    mayor: () => mine('mayor').length > 0,
    bombing: () => anyFree().length > 0,
    gang: () => !!turf(),
  };
  const opts = CASINO_EVENTS.filter(([k]) => ok[k]());
  let r = crypto.randomInt(Math.round(opts.reduce((s, [, w]) => s + w, 0) * 10)) / 10, key = opts[0][0];
  for (const [k, w] of opts) { if (r < w) { key = k; break; } r -= w; }
  if (process.env.EVENT_FORCE && opts.some(([k]) => k === process.env.EVENT_FORCE)) key = process.env.EVENT_FORCE; // test hook
  let title, text, target = {};
  const alive = alivePlayers();
  if (key === 'whim') {
    const amt = Math.max(50000, Math.round(0.25 * Math.max(0, p.money)));
    gain(p, amt);
    title = "Billionaire's Whim"; text = `${p.name} receives ${money(amt)} (25% of their cash).`;
    target = { player: p.id, amount: amt };
    log(`💵 Billionaire's Whim: ${p.name} receives ${money(amt)}.`);
  } else if (key === 'police') {
    const pos = pickOne(mine('police')), tsp = space(pos);
    addEffect({ kind: 'police', pos, mult: 0, label: `Police shutdown: ${tsp.name}` });
    title = 'Police Investigation'; text = `${p.name}'s ${tsp.name} is shut down for 3 rounds — no rent.`;
    target = { pos, player: p.id };
    log(`🚓 Police Investigation: ${p.name}'s ${tsp.name} is shut down for 3 rounds — no rent.`);
  } else if (key === 'mayor') {
    const pos = mine('mayor').sort((a, b) => rentFor(b) - rentFor(a) || a - b)[0], tsp = space(pos);
    addEffect({ kind: 'mayor', pos, mult: 2, label: `Mayor's Favor: ${tsp.name}` });
    title = "Mayor's Favor"; text = `Rent on ${p.name}'s ${tsp.name} is doubled for 3 rounds.`;
    target = { pos, player: p.id };
    log(`🎩 Mayor's Favor: rent on ${p.name}'s ${tsp.name} is doubled for 3 rounds.`);
  } else if (key === 'gang') {
    const group = turf(), word = GROUP_WORD(group);
    addEffect({ kind: 'gang', group, owner: p.id, mult: 0.5, label: `Gang turf: ${word} district` });
    title = 'Gang Turf'; text = `A gang took over ${p.name}'s ${word} tiles — their rent is halved for 3 rounds.`;
    target = { group, player: p.id };
    log(`🔪 Gang Turf: a gang took over ${p.name}'s ${word} tiles — their rent is halved for 3 rounds.`);
  } else if (key === 'onetoomany') {
    applyOneTooMany(p);
    title = 'One Too Many'; text = `${p.name} had one too many — their next roll is halved.`;
    target = { player: p.id };
  } else if (key === 'bombing') {
    const pos = pickOne(anyFree()), tsp = space(pos), owner = byId(g.props[pos].owner);
    delete g.props[pos];
    dropEffectsAt(pos);
    title = 'Building Bombing'; text = `${tsp.name} was destroyed — ${owner.name} lost it.`;
    target = { pos, player: owner.id };
    log(`💣 Building Bombing: ${tsp.name} was destroyed — ${owner.name} lost it.`);
  } else {
    for (const t of alive) gain(t, 300000);
    title = 'Economic Boom'; text = `Everyone receives ${money(300000)}.`;
    target = { amount: 300000 };
    log(`🎉 Economic Boom: everyone receives ${money(300000)}.`);
  }
  g.lastCasino = { id: uid(), mode: 'event', player: p.id, pos: p.pos, key, title, text, target };
  if (g.casinoStats) g.casinoStats[key] = (g.casinoStats[key] || 0) + 1;
}

// ---------------------------------------------------------------- global wheel
// Every N rounds (setting globalEvery) one event hits EVERY alive player. Never prison / Bribe the Police.
// GLOBAL_FORCE=<key> is a test hook (harmless when unset).
const GLOBAL_EVENTS = [
  ['squatters', 'Squatters'], ['police', 'Police Raids'], ['mayor', "Mayor's Favor"], ['gang', 'Gang Turf'], ['crime', 'Crime Wave'],
  ['gangwar', 'Gang War'], ['whim', "Billionaire's Whim"], ['boom', 'Economic Boom'], ['audit', 'Tax Audit'], ['onetoomany', 'One Too Many'],
  ['protection', 'Police Protection'],
];

function runGlobalWheel() {
  const alive = alivePlayers();
  let [key, title] = pickOne(GLOBAL_EVENTS);
  const forced = GLOBAL_EVENTS.find(([k]) => k === process.env.GLOBAL_FORCE);
  if (forced) [key, title] = forced;
  const props = p => Object.keys(g.props).map(Number).filter(i => g.props[i].owner === p.id);
  const free = p => props(p).filter(i => !g.props[i].mortgaged);
  const best = list => list.slice().sort((a, b) => rentFor(b) - rentFor(a) || a - b)[0];
  // the district (group) where p owns the most tiles
  const mainGroup = p => {
    const n = {};
    for (const i of props(p)) if (space(i).type === 'property') n[space(i).group] = (n[space(i).group] || 0) + 1;
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
  };
  const results = [];
  const nothing = (p, text = 'nothing happened') => results.push({ player: p.id, text });
  let summary = null;
  for (const p of alive) {
    if (key === 'squatters' || key === 'police' || key === 'mayor') {
      const list = free(p);
      if (!list.length) { nothing(p, 'nothing to target'); continue; }
      const pos = key === 'mayor' ? best(list) : pickOne(list), name = space(pos).name;
      if (key === 'squatters') {
        setEffect({ kind: 'squatters', pos, mult: 0, until: g.round + 3, label: `Squatters: ${name}` });
        results.push({ player: p.id, text: `${name} occupied by squatters (3 rds)` });
      } else if (key === 'police') {
        setEffect({ kind: 'police', pos, mult: 0, until: g.round + 2, label: `Police shutdown: ${name}` });
        results.push({ player: p.id, text: `${name} shut down by police (2 rds)` });
      } else {
        setEffect({ kind: 'mayor', pos, mult: 2, until: g.round + 2, label: `Mayor's Favor: ${name}` });
        results.push({ player: p.id, text: `${name} rent doubled (2 rds)` });
      }
    } else if (key === 'gang' || key === 'crime') {
      const group = mainGroup(p);
      if (!group) { nothing(p, 'no district to hit'); continue; }
      const word = GROUP_WORD(group);
      g.effects = g.effects.filter(e => !(e.kind === key && e.owner === p.id && e.group === group));
      if (key === 'gang') {
        addEffect({ kind: 'gang', group, owner: p.id, mult: 0.5, until: g.round + 2, label: `Gang turf: ${word} district` });
        results.push({ player: p.id, text: `gang took the ${word} district (rent ×0.5, 2 rds)` });
      } else { // no pay-off prompt for the global version
        addEffect({ kind: 'crime', group, owner: p.id, mult: 0.6, until: g.round + 2, label: `Crime wave: ${word} district` });
        results.push({ player: p.id, text: `crime wave in the ${word} district (rent ×0.6, 2 rds)` });
      }
    } else if (key === 'gangwar') {
      const list = props(p).filter(i => space(i).type === 'property' && !g.props[i].mortgaged && g.props[i].level >= 2 && g.props[i].level < 5);
      if (!list.length) { nothing(p, 'nothing to raid'); continue; }
      const pos = best(list);
      g.props[pos].level--;
      results.push({ player: p.id, text: `${space(pos).name} lost a level` });
    } else if (key === 'whim') {
      const amt = Math.max(50000, Math.round(0.1 * Math.max(0, p.money) / 10000) * 10000);
      gain(p, amt);
      results.push({ player: p.id, text: `+${money(amt)}` });
    } else if (key === 'boom') {
      gain(p, 200000);
      results.push({ player: p.id, text: `+${money(200000)}` });
    } else if (key === 'audit') {
      const t = Math.floor(Math.max(0, p.money) * 0.1);
      if (!t) { nothing(p, 'nothing to tax'); continue; }
      charge(p, t);
      results.push({ player: p.id, text: `-${money(t)}` });
    } else if (key === 'onetoomany') {
      p.drunk = true;
      results.push({ player: p.id, text: 'next roll halved' });
    } else if (key === 'protection') {
      const list = props(p).filter(i => space(i).type === 'property' && !g.protection[i]);
      if (!list.length) { nothing(p, 'nothing to protect'); continue; }
      g.protection[best(list)] = p.id; // hidden: only the owner sees it (mine.protected)
      results.push({ player: p.id, text: 'received police protection' });
    }
  }
  if (key === 'onetoomany') summary = '🥃 Everyone had one too many — next rolls are halved.';
  log(`🎡 Global wheel: ${title}!`);
  if (summary) log(summary);
  else for (const r of results) log(`🎡 ${byId(r.player).name}: ${r.text}`);
  g.lastGlobal = { id: uid(), round: g.round, key, title, results };
  if (g.globalStats) g.globalStats[key] = (g.globalStats[key] || 0) + 1;
  botWaitUntil = Math.max(botWaitUntil, Date.now() + 15000 * speedMult()); // let clients play the wheel + summary first
}

function evictCost(pos) {
  const sp = space(pos), st = g.props[pos];
  return Math.max(10000, Math.round(0.5 * (sp.price + (st.level - 1) * (sp.houseCost || 0)) / 10000) * 10000);
}

// The owner may evict only after one FULL turn of theirs has passed since the squatters arrived
// (not the arrival turn, and not their very next turn start either): their last finished turn must be newer than the arrival turn.
const canEvict = (e, owner) => owner.doneSeq > (e.placedSeq || 0);

function buyoutCost(pos) {
  const sp = space(pos), st = g.props[pos];
  return 2 * (sp.price + (st.level - 1) * sp.houseCost);
}

function afterMove() {
  const p = cur();
  if (g.pending) { g.turnState = g.pending.kind || 'buy'; return; }
  g.turnState = g.extraRoll && !p.inJail && !p.bankrupt ? 'roll' : 'end';
}

function nextTurn() {
  g.doubles = 0;
  g.extraRoll = false;
  g.pending = null;
  const n = g.players.length, prev = g.turn;
  for (let k = 1; k <= n; k++) {
    const i = (g.turn + k) % n;
    if (!g.players[i].bankrupt) { g.turn = i; break; }
  }
  g.turnState = 'roll';
  if (g.players[prev]) g.players[prev].doneSeq = g.turnSeq; // their turn is over: a full turn has passed (squatters)
  g.turnSeq++;
  const blessed = g.effects.filter(e => e.untilTurnOf === cur().id);
  if (blessed.length) {
    g.effects = g.effects.filter(e => e.untilTurnOf !== cur().id);
    for (const e of blessed) log(`⌛ ${e.label} has ended.`);
  }
  log(`— ${cur().name}'s turn —`);
  if (g.turn <= prev) {
    g.round++;
    if (g.settings.maxRounds && g.round > g.settings.maxRounds) return endByWorth();
    startRound();
  }
  mafiaTick(cur());
}

// ---------------------------------------------------------------- the Mafia loan (optional rule)

const mafiaStat = k => { if (g.mafiaStats) g.mafiaStats[k] = (g.mafiaStats[k] || 0) + 1; };

// A player in debt may borrow once the loan covers the debt: at most 2 loans per game, one at a time.
function mafiaOffer(p) {
  const s = g.settings;
  return !!(s.mafia && g.phase === 'playing' && !p.bankrupt && p.money < 0 && !p.loan && (p.loans || 0) < 2 && MAFIA_MAX + p.money >= 0);
}
// The player picks the terms. rate = 10% + 4% per turn + 2% per $250K; mirrored in public/app.js and info.js.
const MAFIA_MIN = 200000, MAFIA_MAX = 3000000, MAFIA_STEP = 50000;
const mafiaDueFor = (amount, turns) => Math.round(amount * (1 + 0.10 + 0.04 * turns + 0.02 * (amount / 250000)) / 10000) * 10000;
const mafiaMinFor = p => Math.max(MAFIA_MIN, Math.ceil(-p.money / MAFIA_STEP) * MAFIA_STEP);

// Start of the borrower's own turn: count down, warn at 2, collect at 0.
function mafiaTick(p) {
  const L = p.loan;
  if (!L || p.bankrupt || g.phase !== 'playing') return;
  L.turnsLeft -= 1;
  if (L.turnsLeft > 0) {
    if (L.turnsLeft <= 2 && !L.warned) {
      L.warned = true;
      log(`✉ A note slides under ${p.name}'s door: "Two turns. Don't make us come back."`);
      pushEvent({ type: 'mafia', kind: 'note', player: p.id });
    }
    return;
  }
  const paid = Math.min(Math.max(p.money, 0), L.due);
  p.money -= paid;
  L.due -= paid;
  p.loan = null;
  if (L.due <= 0) { mafiaStat('settled'); log(`🎩 The Mafia collected ${money(paid)} from ${p.name}. The debt is settled.`); pushEvent({ type: 'mafia', kind: 'collect', player: p.id, paid, pos: null }); return; }
  const mine = ownedBy(p).sort((a, b) => (b.sp.price + (b.st.level - 1) * (b.sp.houseCost || 0)) - (a.sp.price + (a.st.level - 1) * (a.sp.houseCost || 0)) || b.st.level - a.st.level)[0];
  if (!mine) {
    mafiaStat('eliminated');
    log(`🔫 The Mafia came to collect — ${p.name} is out.`);
    pushEvent({ type: 'mafia', kind: 'collect', player: p.id, paid, pos: null, out: true });
    p.lastCreditor = null;
    goBankrupt(p);
    return;
  }
  mafiaStat('collected');
  const pos = mine.sp.i;
  delete g.props[pos];
  dropEffectsAt(pos);
  if (g.protection) delete g.protection[pos];
  log(`🔫 The Mafia came to collect: ${p.name} lost ${mine.sp.name}.`);
  pushEvent({ type: 'mafia', kind: 'collect', player: p.id, paid, pos, name: mine.sp.name });
}

// ---------------------------------------------------------------- bankruptcy

function goBankrupt(p) {
  // Sell all extra levels back to the bank at half price first
  for (const [pos, st] of Object.entries(g.props)) {
    if (st.owner === p.id && st.level > 1) { p.money += (st.level - 1) * space(pos).houseCost / 2; st.level = 1; }
  }
  const creditor = p.lastCreditor && byId(p.lastCreditor);
  if (creditor && !creditor.bankrupt) {
    creditor.money += p.money; // reverses any overpayment already credited
    for (const st of Object.values(g.props)) if (st.owner === p.id) st.owner = creditor.id;
    creditor.jailCards.push(...p.jailCards);
    log(`${p.name} went bankrupt! Everything goes to ${creditor.name}.`);
  } else {
    for (const [pos, st] of Object.entries(g.props)) if (st.owner === p.id) { delete g.props[pos]; dropEffectsAt(pos); }
    for (const jc of p.jailCards) g.decks[jc.deck].push(jc.card);
    log(`${p.name} went bankrupt! Their properties return to the bank.`);
  }
  p.jailCards = [];
  for (const c of p.hand) g.decks[c.deck].push(handTemplate(c.key)); // unplayed hand cards go back into their decks
  p.hand = [];
  g.effects = g.effects.filter(e => e.owner !== p.id); // gang / crime effects bound to the bankrupt owner
  p.money = 0;
  p.loan = null;
  p.drunk = false;
  p.taxi = false;
  p.bankrupt = true;
  g.outOrder.push(p.id);
  if (g.protection) pruneProtection();
  if (g.trade && (g.trade.from === p.id || g.trade.to === p.id)) g.trade = null;

  const alive = alivePlayers();
  if (alive.length <= 1 || (isTeams() && new Set(alive.map(x => x.team)).size <= 1)) {
    g.phase = 'over';
    g.trade = null;
    g.winner = alive[0] ? alive[0].id : null;
    g.winnerTeam = isTeams() && alive[0] ? alive[0].team : null;
    if (g.winnerTeam != null) log(`🏆 ${TEAMS[g.winnerTeam].emoji} ${TEAMS[g.winnerTeam].name} wins the game!`);
    else if (alive[0]) log(`🏆 ${alive[0].name} wins the game!`);
    return;
  }
  if (cur() === p) nextTurn();
  else fixPending();
}

// A pending choice can lose its options while it waits (a rival is kicked, a traded tile changes hands): drop it instead of stalling the turn.
function fixPending() {
  const pd = g.pending;
  if (!pd || g.phase !== 'playing') return;
  const c = cur();
  if (pd.kind === 'bribe') pd.options = pd.options.filter(id => { const o = byId(id); return o && !o.bankrupt && !o.inJail; });
  else if (pd.kind === 'gift') pd.options = pd.options.filter(i => g.props[i] && g.props[i].owner === c.id && !g.props[i].mortgaged);
  else if (pd.kind === 'upgrade') {
    const st = g.props[pd.pos];
    if (!st || st.owner !== c.id || st.mortgaged || st.level >= 5) { g.pending = null; afterMove(); }
    return;
  } else if (pd.kind === 'buyout') {
    const st = g.props[pd.pos];
    if (!st || st.owner === c.id || st.level >= 5) { g.pending = null; afterMove(); } else pd.cost = buyoutCost(pd.pos);
    return;
  } else return;
  if (pd.options.length) return;
  g.pending = null;
  log(`${c.name} has nothing left to choose — the card fizzles.`);
  afterMove();
}

function endByWorth(early = false) {
  if (!early) g.round = g.settings.maxRounds;
  const lead = early ? '🛑 The host ended the game.' : "⏰ Time's up!";
  g.phase = 'over';
  g.trade = null;
  const alive = alivePlayers();
  if (isTeams()) {
    const total = t => alive.filter(p => p.team === t).reduce((s, p) => s + netWorth(p), 0);
    g.winnerTeam = total(0) >= total(1) ? 0 : 1;
    g.winner = (alive.filter(p => p.team === g.winnerTeam).sort((a, b) => netWorth(b) - netWorth(a))[0] || {}).id || null;
    log(`${lead} ${TEAMS[g.winnerTeam].emoji} ${TEAMS[g.winnerTeam].name} wins with the highest net worth!`);
  } else {
    const best = alive.sort((a, b) => netWorth(b) - netWorth(a))[0];
    g.winner = best ? best.id : null;
    if (best) log(`${lead} ${best.name} wins with a net worth of ${money(netWorth(best))}!`);
  }
}

// ---------------------------------------------------------------- property management

function groupOf(pos) { return g.board.filter(s => s.group && s.group === space(pos).group); }

function mustOwn(p, pos) {
  const st = g.props[pos];
  if (!st || st.owner !== p.id) throw new Error("You don't own that.");
  return st;
}

function canTrade(pos) {
  const sp = space(pos);
  if (sp.type !== 'property') return true;
  return g.props[pos].level === 1;
}

function validateTrade(t) {
  const from = byId(t.from), to = byId(t.to);
  if (!from || !to || from.bankrupt || to.bankrupt) throw new Error('Invalid trade partner.');
  for (const pos of t.giveProps) { if (!g.props[pos] || g.props[pos].owner !== from.id) throw new Error('Trade includes a property the proposer no longer owns.'); }
  for (const pos of t.getProps) { if (!g.props[pos] || g.props[pos].owner !== to.id) throw new Error('Trade includes a property the partner no longer owns.'); }
  for (const pos of [...t.giveProps, ...t.getProps]) if (!canTrade(pos)) throw new Error(`Sell the extra levels on ${space(pos).name} before trading it.`);
  if (t.giveMoney > Math.max(0, from.money)) throw new Error(`${from.name} doesn't have that much cash.`);
  if (t.getMoney > Math.max(0, to.money)) throw new Error(`${to.name} doesn't have that much cash.`);
}

// ---------------------------------------------------------------- actions

function requireTurn(p) {
  if (g.phase !== 'playing') throw new Error('Game is not running.');
  if (cur() !== p) throw new Error("It's not your turn.");
}

const actions = {
  // ---- lobby
  profile(p, { name, token, color, team }) {
    if (g.phase !== 'lobby') throw new Error('Game already started.');
    if (team === 0 || team === 1) {
      if (g.players.filter(o => o !== p && o.team === team).length >= 2) throw new Error('That team is full.');
      p.team = team;
    }
    if (name) p.name = String(name).slice(0, 16).trim() || p.name;
    if (token && TOKENS.includes(token)) {
      if (g.players.some(o => o !== p && o.token === token)) throw new Error('Token taken.');
      p.token = token;
    }
    if (color && COLORS.includes(color)) {
      if (g.players.some(o => o !== p && o.color === color)) throw new Error('Color taken.');
      p.color = color;
    }
  },
  settings(p, s) {
    if (p.id !== g.hostId) throw new Error('Only the host can change settings.');
    if (g.phase !== 'lobby') throw new Error('Game already started.');
    if (s.map && MAPS[s.map]) g.settings.map = s.map;
    if (s.startMoney) g.settings.startMoney = Math.max(1000000, Math.min(5000000, Number(s.startMoney) || 2000000));
    if (typeof s.jackpot === 'boolean') g.settings.jackpot = s.jackpot;
    if (typeof s.events === 'boolean') g.settings.events = s.events;
    if (s.mode === 'ffa' || s.mode === 'teams') { g.settings.mode = s.mode; if (s.mode === 'teams') balanceTeams(); }
    if (s.teamTax != null) g.settings.teamTax = Math.max(0, Math.min(50, Math.round(Number(s.teamTax) || 0)));
    if (['full', 'half', 'none'].includes(s.teamRent)) g.settings.teamRent = s.teamRent;
    if (s.globalEvery != null && Number.isFinite(Number(s.globalEvery))) g.settings.globalEvery = Math.max(0, Math.min(10, Math.round(Number(s.globalEvery))));
    if (s.maxRounds != null && [0, 20, 30, 50].includes(Number(s.maxRounds))) g.settings.maxRounds = Number(s.maxRounds);
    if (typeof s.mafia === 'boolean') g.settings.mafia = s.mafia;
    if (SPEEDS[s.speed]) g.settings.speed = s.speed;
  },
  addBot(p) {
    if (p.id !== g.hostId) throw new Error('Only the host can add bots.');
    if (g.phase !== 'lobby') throw new Error('Game already started.');
    if (g.players.length >= MAX_PLAYERS) throw new Error('The game is full.');
    g.players.push({
      id: crypto.randomBytes(4).toString('hex'),
      secret: 'bot-' + crypto.randomBytes(16).toString('hex'),
      name: BOT_NAMES.find(n => !g.players.some(o => o.name === n)) || 'Bot',
      token: TOKENS.find(t => !g.players.some(o => o.token === t)),
      color: COLORS.find(c => !g.players.some(o => o.color === c)),
      team: smallerTeam(), bot: true,
      ...playerDefaults(),
    });
  },
  shuffleTeams(p) {
    if (p.id !== g.hostId) throw new Error('Only the host can shuffle teams.');
    if (g.phase !== 'lobby') throw new Error('Game already started.');
    const order = [...g.players];
    for (let i = order.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    order.forEach((o, k) => { o.team = k % 2; });
  },
  leave(p) {
    if (g.phase !== 'lobby') throw new Error('Use bankruptcy to leave a running game.');
    g.players = g.players.filter(o => o !== p);
    if (g.hostId === p.id) g.hostId = (g.players.find(o => !o.bot) || {}).id || null;
    if (!g.players.some(o => !o.bot)) g.players = [];
  },
  start(p) {
    if (p.id !== g.hostId) throw new Error('Only the host can start.');
    if (g.phase !== 'lobby') throw new Error('Already started.');
    if (g.players.length < 2) throw new Error('Need at least 2 players.');
    if (isTeams()) {
      const A = g.players.filter(o => o.team === 0), B = g.players.filter(o => o.team === 1);
      if (g.players.length !== 4 || A.length !== 2 || B.length !== 2) throw new Error('2v2 needs exactly 4 players, 2 per team. Add bots to fill empty seats!');
      g.players = [A[0], B[0], A[1], B[1]]; // alternate teams around the table
    }
    ({ board: g.board, meta: g.meta } = buildGame(g.settings.map));
    g.decks = buildDecks();
    g.props = {};
    g.jackpot = 0;
    g.log = [];
    for (const pl of g.players) Object.assign(pl, playerDefaults(), { money: g.settings.startMoney });
    g.turn = crypto.randomInt(g.players.length);
    g.turnState = 'roll';
    g.phase = 'playing';
    Object.assign(g, { gid: ++gidSeq, boardVer: ++gidSeq, round: 1, turnSeq: 1, effects: [], protection: {}, lastCasino: null, lastGlobal: null, event: null, events: [], eventSeq: 0, outOrder: [], winner: null, winnerTeam: null, moves: [], moveSeq: 0, teamShare: [0, 0], splitCount: 0 });
    log(`Game started on ${meta().title}! ${cur().name} goes first.`);
    if (process.env.MAFIA_TEST) mafiaTestSetup(); // test hook, harmless when unset
  },

  // ---- turn
  roll(p) {
    requireTurn(p);
    if (g.turnState !== 'roll') throw new Error("You can't roll right now.");
    if (p.money < 0) throw new Error('Pay off your debt first (mortgage or sell).');
    if (p.taxi && !p.inJail && !g.extraRoll) throw new Error('Your cab is waiting: pick where to go.'); // the taxi replaces the roll
    const d1 = die(), d2 = die();
    g.dice = [d1, d2];
    let drunkLog = null;
    g.rollId++;
    g.lastCard = g.lastCard && { ...g.lastCard, stale: true };
    g.lastCasino = g.lastCasino && { ...g.lastCasino, stale: true };
    const dbl = d1 === d2;
    let steps = d1 + d2;
    if (p.drunk) { // One Too Many: dice as rolled, movement halved (doubles logic untouched)
      p.drunk = false;
      steps = Math.floor(steps / 2);
      cardCount('played:drunk');
      drunkLog = `🥃 ${p.name} is seeing double — moves only ${steps}.`;
    }
    log(`${p.name} rolled ${d1} + ${d2}${dbl ? ' (doubles!)' : ''}.`);
    if (drunkLog) log(drunkLog);
    if (dbl) {
      p.stats.doubles++;
      if (eventActive('doubles')) { gain(p, 50000); log(`🎲 Lucky Doubles! ${p.name} collects ${money(50000)}.`); }
    }

    if (p.inJail) {
      g.extraRoll = false;
      if (dbl) {
        p.inJail = false; p.jailTurns = 0;
        log(`${p.name} rolled out of ${space(JAIL_POS).name}!`);
        move(p, steps);
      } else if (++p.jailTurns >= 3) {
        charge(p, JAIL_FINE);
        p.inJail = false; p.jailTurns = 0;
        log(`${p.name} paid the ${money(JAIL_FINE)} fine after 3 tries.`);
        move(p, steps);
      } else {
        log(`${p.name} stays in ${space(JAIL_POS).name}.`);
      }
      return afterMove();
    }

    if (dbl && ++g.doubles === 3) {
      log(`${p.name} rolled doubles 3 times — speeding!`);
      sendToJail(p);
      return afterMove();
    }
    g.extraRoll = dbl;
    move(p, steps);
    afterMove();
  },
  // Taxi Company: on the turn after landing there, ride straight to any square (instead of rolling).
  taxiRide(p, { to } = {}) {
    requireTurn(p);
    if (g.turnState !== 'roll') throw new Error("You can't ride right now.");
    if (!p.taxi || p.inJail || g.extraRoll) throw new Error('No taxi waiting for you.');
    if (p.money < 0) throw new Error('Pay off your debt first (mortgage or sell).');
    to = Number(to);
    if (!Number.isInteger(to) || to < 0 || to >= 40 || to === TAXI_POS) throw new Error('Pick another square.');
    p.taxi = false;
    g.extraRoll = false;
    log(`🚕 ${p.name} takes a cab to ${space(to).name}.`);
    moveTo(p, to);
    afterMove();
  },
  buy(p, { level } = {}) {
    requireTurn(p);
    if (g.turnState !== 'buy' || !g.pending || g.pending.kind !== 'buy') throw new Error('Nothing to buy.');
    const sp = space(g.pending.pos);
    level = level == null ? 1 : Number(level);
    if (!Number.isInteger(level) || level < 1 || level > 3) throw new Error('Pick a level from 1 to 3.');
    if (sp.type !== 'property' && level !== 1) throw new Error('This can only be bought at level 1.');
    const cost = sp.price + (level - 1) * (sp.houseCost || 0);
    if (p.money < cost) throw new Error('Not enough cash. Mortgage something or pass.');
    p.money -= cost;
    g.props[sp.i] = { owner: p.id, level, mortgaged: false };
    p.stats.bought++;
    if (sp.type === 'property') log(`${p.name} bought ${sp.name} at level ${level} for ${money(cost)}.`);
    else log(`${p.name} bought ${sp.name} for ${money(cost)}.`);
    if (sp.group && hasMonopoly(p.id, sp.group)) { log(`🎉 ${p.name} owns the whole ${sp.group} set!`); botEmote(p, ['🤑', '😈', '🎉'], 0.9); }
    g.pending = null;
    afterMove();
  },
  upgrade(p, { to } = {}) {
    requireTurn(p);
    if (g.turnState !== 'upgrade' || !g.pending || g.pending.kind !== 'upgrade') throw new Error('Nothing to upgrade.');
    const sp = space(g.pending.pos), st = mustOwn(p, sp.i);
    to = Number(to);
    if (!Number.isInteger(to) || to <= st.level || to > 5) throw new Error('Pick a higher level.');
    if (to === 5 && st.level !== 4) throw new Error('Reach level 4 before going Max.');
    if (st.mortgaged) throw new Error('Unmortgage this first.');
    const cost = (to - st.level) * sp.houseCost;
    if (p.money < cost) throw new Error('Not enough cash.');
    p.money -= cost;
    st.level = to;
    log(to === 5 ? `${p.name} upgraded ${sp.name} to MAX level for ${money(cost)}.` : `${p.name} upgraded ${sp.name} to level ${to} for ${money(cost)}.`);
    g.pending = null;
    afterMove();
  },
  buyout(p) {
    requireTurn(p);
    if (g.turnState !== 'buyout' || !g.pending || g.pending.kind !== 'buyout') throw new Error('Nothing to buy out.');
    const sp = space(g.pending.pos), st = g.props[sp.i];
    if (!st || st.owner === p.id) throw new Error('Nothing to buy out.');
    if (st.level >= 5) throw new Error("A Max level tile can't be bought out.");
    const owner = byId(st.owner), cost = buyoutCost(sp.i);
    if (p.money < cost) throw new Error('Not enough cash.');
    p.money -= cost;
    owner.money += cost;
    st.owner = p.id;
    p.stats.bought++;
    log(`${p.name} bought out ${sp.name} from ${owner.name} for ${money(cost)}.`);
    if (sp.group && hasMonopoly(p.id, sp.group)) { log(`🎉 ${p.name} owns the whole ${sp.group} set!`); botEmote(p, ['🤑', '😈', '🎉'], 0.9); }
    g.pending = null;
    afterMove();
  },
  pass(p) {
    requireTurn(p);
    if (!['buy', 'upgrade', 'buyout', 'crime'].includes(g.turnState) || !g.pending) throw new Error('Nothing to pass on.');
    const k = g.pending.kind, name = g.pending.pos != null ? space(g.pending.pos).name : '';
    if (k === 'crime') log(`${p.name} left the crime wave alone.`);
    else if (k === 'upgrade') log(`${p.name} skipped upgrading ${name}.`);
    else if (k === 'buyout') log(`${p.name} declined to buy out ${name}.`);
    else log(`${p.name} passed on ${name}.`);
    g.pending = null;
    afterMove();
  },
  endTurn(p) {
    requireTurn(p);
    if (g.turnState !== 'end') throw new Error("You can't end your turn yet.");
    if (p.money < 0) throw new Error('You are in debt! Mortgage, sell, or declare bankruptcy.');
    nextTurn();
  },
  playCard(p, { cardId, target } = {}) {
    requireTurn(p);
    if (!['roll', 'end'].includes(g.turnState) || g.pending) throw new Error("You can't play a card right now.");
    const i = p.hand.findIndex(c => c.id === cardId);
    if (i < 0) throw new Error("You don't have that card.");
    const card = p.hand[i], cost = card.cost || 0;
    if (p.money < cost) throw new Error(`You need ${money(cost)} for that.`);
    const pos = Number(target), st = g.props[pos];
    if (!Number.isInteger(pos) || pos < 0 || pos > 39 || !st) throw new Error('Pick a property.');
    const sp = space(pos);
    if (card.key === 'protection') {
      if (st.owner !== p.id) throw new Error('Protect one of your own tiles.');
      if (g.protection[pos] === p.id) throw new Error('That tile is already protected.');
      g.protection[pos] = p.id;
      log(`🛡 ${p.name} quietly arranged police protection somewhere.`);
    } else {
      if (st.owner === p.id || sameTeam(p, byId(st.owner))) throw new Error("Pick a rival's property.");
      if (card.key === 'gang') {
        if (sp.type !== 'property' || st.level < 2) throw new Error('A gang only targets tiles at level 2 or higher.');
        if (st.level >= 5) throw new Error("A Max level tile can't be hit.");
        charge(p, cost);
        log(`🔫 ${p.name} hired a gang against ${sp.name} for ${money(cost)}.`);
        if (g.protection[pos]) {
          delete g.protection[pos];
          const win = crypto.randomInt(2) === 0;
          cardCount(win ? 'shootout-win' : 'shootout-loss');
          setEffect(win
            ? { kind: 'shootout-win', pos, mult: 1.5, until: g.round + 5, label: `Police guard: ${sp.name}` }
            : { kind: 'shootout-loss', pos, mult: 0.5, until: g.round + 5, label: `Shot-up: ${sp.name}` });
          log(win ? `🚔 A shootout at ${sp.name}! The police won — rent ×1.5 for 5 rounds.` : `🚔 A shootout at ${sp.name}! The police lost — rent halved for 5 rounds.`);
        } else {
          const n = 1 + crypto.randomInt(3), was = st.level;
          st.level = Math.max(1, st.level - n);
          log(`🏚 The gang wrecked ${was - st.level} level(s) on ${sp.name} (now level ${st.level}).`);
        }
      } else if (card.key === 'squatters') {
        if (st.mortgaged) throw new Error("Mortgaged tiles pay no rent anyway.");
        setEffect({ kind: 'squatters', pos, mult: 0, until: g.round + 3, label: `Squatters: ${sp.name}` });
        log(`🛏 ${p.name} sent squatters into ${sp.name} — no rent for 3 rounds.`);
      }
    }
    p.hand.splice(i, 1);
    g.decks[card.deck].push(handTemplate(card.key));
    cardCount('played:' + card.key);
  },
  evict(p, { pos } = {}) {
    requireTurn(p);
    if (!['roll', 'end'].includes(g.turnState) || g.pending) throw new Error("You can't do that right now.");
    pos = Number(pos);
    const st = g.props[pos];
    if (!st || st.owner !== p.id) throw new Error("You don't own that.");
    const sq = g.effects.find(e => e.kind === 'squatters' && e.pos === pos && g.round < e.until);
    if (!sq) throw new Error('No squatters there.');
    if (!canEvict(sq, p)) throw new Error('Squatters can be evicted from next turn.');
    const cost = evictCost(pos);
    if (p.money < cost) throw new Error(`You need ${money(cost)}.`);
    charge(p, cost);
    g.effects = g.effects.filter(e => !(e.kind === 'squatters' && e.pos === pos));
    p.lastEvict = g.round;
    cardCount('evict');
    log(`🧹 ${p.name} evicted the squatters from ${space(pos).name} for ${money(cost)}.`);
  },
  payPolice(p) {
    requireTurn(p);
    if (g.turnState !== 'crime' || !g.pending || g.pending.kind !== 'crime') throw new Error('Nothing to pay.');
    const cost = g.pending.cost;
    if (p.money < cost) throw new Error(`You need ${money(cost)}.`);
    charge(p, cost);
    g.effects = g.effects.filter(e => e.id !== g.pending.effectId);
    p.auditUntil = g.round + 5;
    cardCount('crime-paid');
    log(`🚓 ${p.name} paid the police ${money(cost)} to clear the crime wave — the taxman takes note.`);
    g.pending = null;
    afterMove();
  },
  chooseGift(p, { pos } = {}) {
    requireTurn(p);
    if (g.turnState !== 'gift' || !g.pending || g.pending.kind !== 'gift') throw new Error('No gift to give.');
    pos = Number(pos);
    if (!g.pending.options.includes(pos) || !g.props[pos] || g.props[pos].owner !== p.id) throw new Error('Pick one of your tiles.');
    const name = space(pos).name;
    setEffect({ kind: 'gift', pos, mult: 3, untilTurnOf: p.id, until: g.round + 2, label: `Mayor's Gift: ${name}` });
    log(`🎁 Mayor's Gift: rent on ${name} is tripled until ${p.name}'s next turn.`);
    g.pending = null;
    afterMove();
  },
  chooseBribe(p, { target } = {}) {
    requireTurn(p);
    if (g.turnState !== 'bribe' || !g.pending || g.pending.kind !== 'bribe') throw new Error('No one to bribe about.');
    const t = byId(target);
    if (!t || !g.pending.options.includes(t.id) || t.bankrupt || t.inJail) throw new Error('Pick an opponent to frame.');
    g.pending = null;
    cardCount('played:bribe');
    log(`💰 ${p.name} bribed the police — ${t.name} is hauled off to ${space(JAIL_POS).name}!`);
    const keep = g.extraRoll; // sendToJail clears the extra roll — it belongs to the briber, not the victim
    sendToJail(t);
    g.extraRoll = keep;
    afterMove();
  },
  payJail(p) {
    requireTurn(p);
    if (!p.inJail || g.turnState !== 'roll') throw new Error("You're not in jail.");
    if (p.money < JAIL_FINE) throw new Error('Not enough cash.');
    charge(p, JAIL_FINE);
    p.inJail = false; p.jailTurns = 0;
    log(`${p.name} paid ${money(JAIL_FINE)} to get out.`);
  },
  jailCard(p) {
    requireTurn(p);
    if (!p.inJail || g.turnState !== 'roll') throw new Error("You're not in jail.");
    const jc = p.jailCards.shift();
    if (!jc) throw new Error('No Get-Out-Free card.');
    g.decks[jc.deck].push(jc.card);
    p.inJail = false; p.jailTurns = 0;
    log(`${p.name} used a Get-Out-Free card.`);
  },
  bankrupt(p) {
    if (g.phase !== 'playing' || p.bankrupt) throw new Error('Not possible.');
    goBankrupt(p);
  },
  borrowMafia(p, { amount, turns } = {}) {
    if (!mafiaOffer(p)) throw new Error('The Mafia will not lend you money right now.');
    amount = Number(amount); turns = Number(turns);
    if (!Number.isInteger(amount) || amount % MAFIA_STEP || amount < mafiaMinFor(p) || amount > MAFIA_MAX) throw new Error('The Mafia will not lend that amount.');
    if (!Number.isInteger(turns) || turns < 3 || turns > 10) throw new Error('Pick 3 to 10 turns.');
    const due = mafiaDueFor(amount, turns);
    p.money += amount;
    p.loan = { amount, due, turnsLeft: turns, loans: ++p.loans };
    mafiaStat('loans');
    log(`🎩 ${p.name} borrowed ${money(amount)} from the Mafia — ${money(due)} due in ${turns} turns.`);
  },
  repayMafia(p, { amount } = {}) {
    requireTurn(p);
    if (!p.loan) throw new Error('You owe the Mafia nothing.');
    if (!['roll', 'end'].includes(g.turnState)) throw new Error("You can't repay right now.");
    if (p.money <= 0) throw new Error('You have no cash to repay with.');
    const want = amount == null ? p.loan.due : Math.round(Number(amount));
    if (!Number.isFinite(want) || want <= 0) throw new Error('Pick an amount to repay.');
    const pay = Math.min(want, p.money, p.loan.due);
    p.money -= pay;
    p.loan.due -= pay;
    if (p.loan.due <= 0) { p.loan = null; mafiaStat('repaid'); log(`🎩 ${p.name} paid off the Mafia.`); }
    else log(`🎩 ${p.name} paid the Mafia ${money(pay)} — ${money(p.loan.due)} still due.`);
  },

  // ---- property management (any time during the game; levels are bought by landing, see land())
  sell(p, { pos }) {
    if (g.phase !== 'playing') throw new Error('Game not running.');
    const st = mustOwn(p, pos), sp = space(pos);
    if (st.level <= 1) throw new Error('Already at level 1.');
    st.level--;
    p.money += sp.houseCost / 2;
    log(`${p.name} sold a level on ${sp.name} for ${money(sp.houseCost / 2)}.`);
  },
  mortgage(p, { pos }) {
    if (g.phase !== 'playing') throw new Error('Game not running.');
    const st = mustOwn(p, pos), sp = space(pos);
    if (st.mortgaged) throw new Error('Already mortgaged.');
    if (sp.type === 'property' && st.level > 1) throw new Error('Sell the extra levels on this tile first.');
    st.mortgaged = true;
    p.money += sp.price / 2;
    log(`${p.name} mortgaged ${sp.name} for ${money(sp.price / 2)}.`);
  },
  unmortgage(p, { pos }) {
    if (g.phase !== 'playing') throw new Error('Game not running.');
    const st = mustOwn(p, pos), sp = space(pos);
    if (!st.mortgaged) throw new Error('Not mortgaged.');
    const cost = Math.ceil(sp.price / 2 * 1.1);
    if (p.money < cost) throw new Error(`You need ${money(cost)}.`);
    p.money -= cost;
    st.mortgaged = false;
    log(`${p.name} unmortgaged ${sp.name} for ${money(cost)}.`);
  },

  // ---- trading
  tradePropose(p, { to, giveProps = [], getProps = [], giveMoney = 0, getMoney = 0 }) {
    if (g.phase !== 'playing' || p.bankrupt) throw new Error('Not possible.');
    if (g.trade) throw new Error('Another trade is already pending.');
    const t = {
      id: Date.now(), from: p.id, to,
      giveProps: giveProps.map(Number), getProps: getProps.map(Number),
      giveMoney: Math.max(0, Math.floor(Number(giveMoney) || 0)),
      getMoney: Math.max(0, Math.floor(Number(getMoney) || 0)),
    };
    if (to === p.id) throw new Error("You can't trade with yourself.");
    if (!t.giveProps.length && !t.getProps.length && !t.giveMoney && !t.getMoney) throw new Error('Empty trade.');
    validateTrade(t);
    g.trade = t;
    log(`${p.name} proposed a trade to ${byId(to).name}.`);
  },
  tradeRespond(p, { accept }) {
    const t = g.trade;
    if (!t || t.to !== p.id) throw new Error('No trade for you.');
    g.trade = null;
    const from = byId(t.from);
    if (!accept) { log(`${p.name} declined ${from.name}'s trade.`); return; }
    validateTrade(t);
    for (const pos of t.giveProps) g.props[pos].owner = p.id;
    for (const pos of t.getProps) g.props[pos].owner = from.id;
    from.money += t.getMoney - t.giveMoney;
    p.money += t.giveMoney - t.getMoney;
    log(`${p.name} accepted ${from.name}'s trade.`);
    fixPending();
  },
  tradeCancel(p) {
    if (!g.trade || g.trade.from !== p.id) throw new Error('No trade to cancel.');
    g.trade = null;
    log(`${p.name} cancelled their trade offer.`);
  },

  // ---- teams
  setShare(p, { pct }) {
    requireTurn(p);
    if (!isTeams()) throw new Error('Only in 2v2 games.');
    pct = Number(pct);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100 || pct % 10) throw new Error('Pick 0-100% in steps of 10.');
    if (g.teamShare[p.team] === pct) return;
    g.teamShare[p.team] = pct;
    log(`⚖ ${p.name} set their team's rent share to ${pct}% for the teammate.`);
  },
  teamGift(p, { amount }) {
    if (g.phase !== 'playing' || p.bankrupt) throw new Error('Not possible.');
    const mate = mateOf(p);
    if (!mate) throw new Error('You have no teammate to send money to.');
    amount = Math.floor(Number(amount) || 0);
    if (amount < 1) throw new Error('Enter an amount.');
    if (amount > p.money) throw new Error("You don't have that much cash.");
    const fee = Math.round(amount * g.settings.teamTax / 100);
    const received = amount - fee;
    p.money -= amount;
    mate.money += received;
    if (g.settings.jackpot) g.jackpot += fee;
    p.stats.gifted += amount;
    log(`💸 ${p.name} sent ${money(amount)} to ${mate.name}. After the ${g.settings.teamTax}% fee, ${mate.name} received ${money(received)}.`);
    pushEvent({ type: 'gift', from: p.id, to: mate.id, amount, received });
  },

  // ---- misc
  emote(p, { emoji }) {
    if (!EMOTES.includes(emoji)) throw new Error('Unknown emote.');
    const now = Date.now();
    if (now - (p.lastEmote || 0) < 1000) return;
    p.lastEmote = now;
    pushEvent({ type: 'emote', player: p.id, emoji });
  },
  chat(p, { text }) {
    text = String(text || '').trim().slice(0, 200);
    if (text) { g.log.push({ n: ++logSeq, t: Date.now(), chat: true, from: p.id, text }); if (g.log.length > 150) g.log.shift(); }
  },
  kick(p, { playerId }) {
    if (p.id !== g.hostId) throw new Error('Only the host can remove players.');
    const target = byId(playerId);
    if (!target || target === p) throw new Error('Invalid player.');
    if (g.phase === 'playing') { if (!target.bankrupt) { target.lastCreditor = null; goBankrupt(target); } }
    else { g.players = g.players.filter(o => o !== target); }
    log(`${target.name} was removed by the host.`);
  },
  quit(p) {
    if (g.phase === 'lobby') return actions.leave(p);
    if (g.phase !== 'playing' || p.bankrupt) throw new Error("You're not in this game anymore.");
    log(`🚪 ${p.name} left the game.`);
    p.lastCreditor = null; // their properties go back to the bank
    goBankrupt(p);
  },
  endGame(p) {
    if (p.id !== g.hostId) throw new Error('Only the host can end the game.');
    if (g.phase !== 'playing') throw new Error('The game is not running.');
    endByWorth(true);
  },
  newGame(p) {
    // the host starts the next game; if the host has left (offline once the game is over), any other human may take over
    const hostGone = g.phase === 'over' && g.players.every(o => o.id !== g.hostId || (!o.bot && !isOnline(o.secret)));
    if (p.id !== g.hostId && !(hostGone && !p.bot)) throw new Error('Only the host can do that.');
    const host = p.id;
    const players = g.players.map(({ id, secret, name, token, color, team, bot }) => ({ id, secret, name, token, color, team, bot }));
    g = freshGame(players);
    g.hostId = host;
  },
};

// Police Protection is lost when its tile changes hands, is bombed or goes back to the bank.
function pruneProtection() {
  for (const [pos, owner] of Object.entries(g.protection || {})) {
    const st = g.props[pos];
    if (!st || st.owner !== owner) delete g.protection[pos];
  }
}
for (const k of Object.keys(actions)) {
  const fn = actions[k];
  actions[k] = function (...a) { try { return fn.apply(this, a); } finally { if (g.protection) pruneProtection(); if (g.pending) fixPending(); } };
}

// MAFIA_TEST=1: the first human starts $100K in debt (holding two tiles) and loans are short.
function mafiaTestSetup() {
  Object.assign(g.settings, { mafia: true });
  const h = g.players.find(o => !o.bot);
  if (!h) return;
  h.money = -100000;
  [1, 3].forEach(pos => { g.props[pos] = { owner: h.id, level: 1, mortgaged: false }; });
  g.turn = g.players.indexOf(h);
}

// ---------------------------------------------------------------- bots

const BOT_NAMES = ['Robo Rita', 'Bot Bernard', 'Captain Chip', 'Lady Byte', 'Sir Glitch', 'Turbo Tina', 'Pixel Pete', 'Madame Modem'];
let botTimer = null, botWaitUntil = 0;
const BOT_FAST = process.env.BOT_FAST === '1'; // for automated tests: no animation pauses

const ownedBy = p => Object.entries(g.props).filter(([, st]) => st.owner === p.id).map(([pos, st]) => ({ sp: space(pos), st }));
const propValue = list => list.reduce((s, pos) => s + space(pos).price * (g.props[pos].mortgaged ? 0.5 : 1), 0);
function completesSet(player, gained) {
  return gained.some(pos => {
    const sp = space(pos);
    return sp.group && groupOf(pos).every(s => gained.includes(s.i) || (g.props[s.i] && g.props[s.i].owner === player.id));
  });
}

function botLikesTrade(b, t) {
  const from = byId(t.from);
  const gain = propValue(t.giveProps) + t.giveMoney + (completesSet(b, t.giveProps) ? 300000 : 0);
  const loss = propValue(t.getProps) + t.getMoney + (completesSet(from, t.getProps) ? 400000 : 0);
  return sameTeam(b, from) ? gain + 250000 >= loss : gain >= loss * 1.2;
}

function botRaise(b) {
  const mine = ownedBy(b);
  const built = mine.filter(x => x.st.level > 1).sort((x, y) => y.st.level - x.st.level)[0];
  if (built) return ['sell', { pos: built.sp.i }];
  const mortgageable = mine.filter(x => !x.st.mortgaged).sort((x, y) => x.sp.price - y.sp.price)[0];
  if (mortgageable) return ['mortgage', { pos: mortgageable.sp.i }];
  if (mafiaOffer(b)) return ['borrowMafia', { amount: Math.min(MAFIA_MAX, Math.max(MAFIA_MIN, Math.ceil((-b.money + 300000) / MAFIA_STEP) * MAFIA_STEP)), turns: 5 }];
  // last resort: give a human teammate a chance to bail us out
  const mate = mateOf(b);
  if (mate && !mate.bot && mate.money > 0) {
    if (!b.debtSince) { b.debtSince = Date.now(); pushEvent({ type: 'emote', player: b.id, emoji: '🙏' }); log(`🙏 ${b.name} needs ${money(-b.money)} — teammate ${mate.name}, help!`); broadcast(); }
    if (Date.now() - b.debtSince < 30000) return ['wait'];
  }
  return ['bankrupt', {}];
}

// Repay in full when comfortable; when the deadline is near, pay down to a 300K cushion.
function botRepay(b) {
  if (!b.loan || !['roll', 'end'].includes(g.turnState) || cur() !== b) return null;
  if (b.money - b.loan.due >= 300000) return ['repayMafia', {}];
  const part = Math.floor((b.money - 300000) / 10000) * 10000;
  if (b.loan.turnsLeft <= 2 && part > 0) return ['repayMafia', { amount: part }];
  return null;
}

function botManage(b) {
  const reserve = 350000;
  const mortgaged = ownedBy(b).find(x => x.st.mortgaged && b.money - Math.ceil(x.sp.price * 0.55) >= reserve + 300000);
  if (mortgaged) return ['unmortgage', { pos: mortgaged.sp.i }];
  return null;
}

// Pending buy / upgrade / buyout decisions for a bot on its turn.
function botDecide(b) {
  const pend = g.pending, sp = space(pend.pos), st = g.props[sp.i];
  if (pend.kind === 'upgrade') {
    const hi = st.level === 4 ? 5 : 4;
    for (let to = hi; to > st.level; to--) if (b.money - (to - st.level) * sp.houseCost >= 500000) return ['upgrade', { to }];
    return ['pass', {}];
  }
  const completes = sp.group && groupOf(sp.i).every(s => s.i === sp.i || (g.props[s.i] && g.props[s.i].owner === b.id));
  if (pend.kind === 'buyout') {
    return [b.money - pend.cost >= 600000 && (completes || pend.cost <= b.money * 0.35) ? 'buyout' : 'pass', {}];
  }
  if (sp.type === 'property') {
    // keep a cushion that grows with how far up we build: rent hits get big fast
    for (let level = 3; level >= 2; level--) {
      if (b.money - (sp.price + (level - 1) * sp.houseCost) >= 300000 * level) return ['buy', { level }];
    }
    return [b.money - sp.price >= (completes ? 0 : 100000) ? 'buy' : 'pass', { level: 1 }];
  }
  return [b.money - sp.price >= (completes ? 0 : 150000) ? 'buy' : 'pass', {}];
}

function botTradeIdea(b) {
  if (g.trade || (b.lastProposal || -9) > g.round - 3) return null;
  const mate = mateOf(b);
  for (const grp of [...new Set(g.board.map(s => s.group).filter(Boolean))]) {
    const props = g.board.filter(s => s.group === grp);
    if (props.some(s => !g.props[s.i] || g.props[s.i].level > 1)) continue;
    const mine = props.filter(s => g.props[s.i].owner === b.id);
    const others = props.filter(s => g.props[s.i].owner !== b.id);
    if (!mine.length || !others.length) continue;
    // teamwork: hand my pieces to a teammate who owns the rest of the set
    if (mate && others.every(s => g.props[s.i].owner === mate.id)) {
      b.lastProposal = g.round;
      return ['tradePropose', { to: mate.id, giveProps: mine.map(s => s.i) }];
    }
    // otherwise try to buy the one missing piece
    if (others.length === 1) {
      const owner = byId(g.props[others[0].i].owner);
      if (sameTeam(b, owner)) continue;
      const offer = Math.round(others[0].price * 1.7 / 10000) * 10000;
      if (b.money - offer < 300000) continue;
      b.lastProposal = g.round;
      return ['tradePropose', { to: owner.id, getProps: [others[0].i], giveMoney: offer }];
    }
  }
  return null;
}

// Hand cards, evictions, crime and gift choices for a bot (before it rolls).
function botCardPlay(b) {
  const enemies = Object.keys(g.props).map(Number).filter(i => {
    const o = byId(g.props[i].owner);
    return o && !o.bankrupt && o !== b && !sameTeam(b, o);
  });
  const hasFx = (kind, pos) => g.effects.some(e => e.kind === kind && e.pos === pos && g.round < e.until);
  const best = (list, score) => list.map(i => [i, score(i)]).sort((x, y) => y[1] - x[1])[0];
  for (const i of ownedBy(b).map(x => x.sp.i)) {
    const sq = g.effects.find(e => e.kind === 'squatters' && e.pos === i && g.round < e.until);
    if (!sq || !canEvict(sq, b)) continue;
    const cost = evictCost(i);
    if (b.money >= cost && (baseRent(i) >= 2 * cost || b.money >= 1500000)) return ['evict', { pos: i }];
  }
  if (b.cardRound === g.round) return null;
  for (const c of b.hand) {
    let t = null;
    if (c.key === 'gang') {
      if (b.money - (c.cost || 0) < 500000) continue;
      const hit = best(enemies.filter(i => space(i).type === 'property' && g.props[i].level >= 2 && g.props[i].level < 5), i => g.props[i].level * baseRent(i));
      t = hit && hit[0];
    } else if (c.key === 'squatters') {
      const hit = best(enemies.filter(i => !g.props[i].mortgaged && !hasFx('squatters', i)), i => rentFor(i));
      t = hit && hit[1] > 0 ? hit[0] : null;
    } else if (c.key === 'protection') {
      const mine = ownedBy(b).filter(x => x.sp.type === 'property' && g.protection[x.sp.i] !== b.id).sort((x, y) => y.st.level - x.st.level)[0];
      t = mine ? mine.sp.i : null;
    }
    if (t != null) { b.cardRound = g.round; return ['playCard', { cardId: c.id, target: t }]; }
  }
  return null;
}

// Taxi: ride to the best affordable unowned tile the bot would buy, else to an upgradeable tile of its own, else just roll.
function botTaxi(b) {
  let best = null, score = -1;
  const consider = (i, sc) => { if (i !== TAXI_POS && i !== b.pos && sc > score) { best = i; score = sc; } };
  for (const sp of g.board) {
    if (sp.type === 'property' || sp.type === 'railroad' || sp.type === 'utility') {
      if (!g.props[sp.i]) {
        const completes = sp.group && groupOf(sp.i).every(s => s.i === sp.i || (g.props[s.i] && g.props[s.i].owner === b.id));
        const cushion = sp.type === 'property' ? (completes ? 0 : 100000) : (completes ? 0 : 150000);
        if (b.money - sp.price >= cushion) {
          const have = sp.group ? groupOf(sp.i).filter(s => g.props[s.i] && g.props[s.i].owner === b.id).length : ownedCount(b.id, sp.type);
          consider(sp.i, 1000 + (completes ? 1000 : 0) + have * 100 + sp.price / 10000);
        }
      }
    }
  }
  if (best != null) return best;
  for (const x of ownedBy(b)) {
    if (x.sp.type === 'property' && !x.st.mortgaged && x.st.level < 5 && b.money - x.sp.houseCost >= 500000) consider(x.sp.i, baseRent(x.sp.i) / 1000 + (hasMonopoly(b.id, x.sp.group) ? 100 : 0));
  }
  if (best != null) return best;
  return b.pos !== 0 ? 0 : JAIL_POS;                 // nothing worth the ride: a safe square (Payday, or just visiting the jail)
}

function botWants(b) {
  if (b.bankrupt) return null;
  if (g.trade && g.trade.to === b.id) {
    let valid = true;                       // a tile may have been upgraded since the offer was made
    try { validateTrade(g.trade); } catch { valid = false; }
    return ['tradeRespond', { accept: valid && botLikesTrade(b, g.trade) }];
  }
  if (b.money < 0) return botRaise(b);
  b.debtSince = 0;
  const mate = mateOf(b);
  if (mate && mate.money < 0 && b.money > 300000) {
    const need = Math.ceil(-mate.money / (1 - g.settings.teamTax / 100));
    const amount = Math.min(need, b.money - 200000);
    if (amount > 0) return ['teamGift', { amount }];
  }
  if (cur() !== b) return null;
  if (g.turnState === 'crime' && g.pending) return [g.pending.cost <= b.money * 0.15 ? 'payPolice' : 'pass', {}];
  if (g.turnState === 'bribe' && g.pending) return ['chooseBribe', { target: g.pending.options.map(byId).sort((x, y) => netWorth(y) - netWorth(x))[0].id }];
  if (g.turnState === 'gift' && g.pending) return ['chooseGift', { pos: g.pending.options.slice().sort((x, y) => rentFor(y) - rentFor(x))[0] }];
  if (['buy', 'upgrade', 'buyout'].includes(g.turnState) && g.pending) return botDecide(b);
  const manage = botRepay(b) || botManage(b) || (g.turnState === 'roll' && botTradeIdea(b));
  if (manage) return manage;
  if (g.turnState === 'roll') {
    const card = botCardPlay(b);
    if (card) return card;
    if (mate && isTeams() && b.shareMark !== `${g.round}:${g.turn}`) {
      const cur = g.teamShare[b.team];
      const want = mate.money < 500000 && b.money > 1500000 ? 30 : mate.money > b.money ? 0 : cur;
      b.shareMark = `${g.round}:${g.turn}`;
      if (want !== cur) return ['setShare', { pct: want }];
    }
    if (b.taxi && !b.inJail && !g.extraRoll) return ['taxiRide', { to: botTaxi(b) }];
    if (b.inJail && b.jailCards.length) return ['jailCard', {}];
    if (b.inJail && (b.money >= 600000 || (b.jailTurns >= 1 && b.money >= 200000))) return ['payJail', {}];
    return ['roll', {}];
  }
  if (g.turnState === 'end') return ['endTurn', {}];
  return null;
}

// how long clients need to animate everything since `seq` (dice + hops + cards)
function animMs(seq) {
  let ms = 1600;
  for (const m of g.moves) {
    if (m.seq <= seq) continue;
    const fwd = (m.to - m.from + 40) % 40;
    ms += m.how === 'card' ? 1900 : m.how === 'jail' ? 1200 : m.how === 'back' ? 800 : fwd > 12 ? 1200 : fwd * 250;
  }
  return (ms + 700) * speedMult();
}

function scheduleBots(delay = 1000) {
  if (botTimer || g.phase !== 'playing' || !g.players.some(p => p.bot && !p.bankrupt)) return;
  botTimer = setTimeout(botTick, BOT_FAST ? 2 : Math.max(delay * speedMult(), botWaitUntil - Date.now()));
}

function botTick() {
  botTimer = null;
  if (g.phase !== 'playing') return;
  for (const b of g.players.filter(p => p.bot && !p.bankrupt)) {
    let want = null;
    try { want = botWants(b); } catch (e) { console.log(`  (bot ${b.name} could not decide: ${e.stack || e.message})`); if (++b.botErrors > 4) { b.lastCreditor = null; goBankrupt(b); broadcast(); scheduleBots(1100); return; } }
    if (!want) continue;
    if (want[0] === 'wait') { if (BOT_FAST) b.debtSince -= 30000; scheduleBots(2500); return; }
    const seq = g.moveSeq;
    try {
      actions[want[0]](b, want[1]);
      b.botErrors = 0;
    } catch (e) {
      console.log(`  (bot ${b.name} could not ${want[0]}: ${e.message})`);
      if (++b.botErrors > 4) { b.lastCreditor = null; goBankrupt(b); }
    }
    if (want[0] === 'roll') botWaitUntil = Date.now() + animMs(seq);
    broadcast();
    scheduleBots(want[0] === 'roll' ? 300 : 1100);
    return;
  }
}

// ---------------------------------------------------------------- network
//
// Protocol (long-poll):  GET /poll?v=<version>[&g=<gameId>&l=<lastLogN>&m=<moveSeq>&e=<eventSeq>&sv=<staticVer>&bv=<boardVer>]
// - Without the optional parameters (old clients) every answer is the complete state.
// - With them, the server leaves out what the client already holds: static lists (maps, tokens, colors, …) when sv matches,
//   the board/meta when bv matches, and sends only the NEW log lines / moves / events (state.dl = 1) when g matches.
//   The client merges these back into a full state object (see connect() in public/app.js).
// - JSON is gzip-compressed when the client accepts it, and the part that is the same for every viewer is built once per version.

const STATIC_VER = String(Date.now());
const FULL_LOG = 80; // log lines sent to a client that has none yet (the server keeps 150)

// Everything that is identical for every viewer, as the inside of a JSON object. Built at most once per version.
let sharedCache = null;
function sharedBody() {
  if (sharedCache && sharedCache.v === version) return sharedCache;
  const connected = onlineSecrets();
  const state = {
    inviteUrl,
    phase: g.phase,
    settings: { ...g.settings, speedMult: speedMult() },
    hostId: g.hostId,
    gid: g.gid, bv: g.boardVer,
    players: g.players.map(p => {
      const { secret, lastCreditor, jailCards, lastEmote, debtSince, botErrors, hand, cardRound, lastProposal, shareMark, ...rest } = p;
      return { ...rest, jailCards: jailCards.length, handCount: hand.length, connected: !!p.bot || connected.has(secret), worth: g.board ? netWorth(p) : p.money };
    }),
    props: g.props,
    turn: g.turn, turnState: g.turnState, extraRoll: !!g.extraRoll, dice: g.dice, rollId: g.rollId,
    pending: g.pending, jackpot: g.jackpot, lastCard: g.lastCard, lastCasino: g.lastCasino, lastGlobal: g.lastGlobal,
    effects: g.effects.map(e => (e.kind === 'squatters' ? { ...e, canEvict: !!(byId(g.props[e.pos] && g.props[e.pos].owner) && canEvict(e, byId(g.props[e.pos].owner))) } : e)),
    trade: g.trade, winner: g.winner, winnerTeam: g.winnerTeam, outOrder: g.outOrder,
    round: g.round, event: g.event, eventSeq: g.eventSeq,
    moveSeq: g.moveSeq, teamShare: g.teamShare,
  };
  const s = JSON.stringify(state);
  sharedCache = { v: version, body: s.slice(1, -1), parts: new Map(), gz: new Map() };
  return sharedCache;
}

// Static lists never change while the server runs.
const STATIC_JSON = (() => {
  const s = JSON.stringify({
    maps: Object.fromEntries(Object.entries(MAPS).map(([k, m]) => [k, { title: m.title, currency: m.currency, theme: m.theme }])),
    tokens: TOKENS, colors: COLORS, maxPlayers: MAX_PLAYERS, teams: TEAMS, emotes: EMOTES,
  });
  return s.slice(1, -1);
})();

// q: the client's optional sync parameters (all strings or undefined). Returns the JSON text of the state for that viewer.
function stateJson(forSecret, q = {}) {
  const me = bySecret(forSecret);
  const sh = sharedBody();
  const head = {
    you: me ? me.id : null,
    // private, per viewer: your hand and your secretly protected tiles
    mine: me ? { hand: me.hand.map(({ id, key, type, cost }) => (cost ? { id, key, type, cost } : { id, key, type })), protected: Object.keys(g.protection || {}).filter(k => g.protection[k] === me.id).map(Number) } : null,
  };
  const delta = q.g != null && q.g === String(g.gid);
  const parts = {};
  const wantBoard = q.bv !== String(g.boardVer);
  if (wantBoard) { parts.board = g.board; parts.meta = g.meta; }
  if (delta) {
    parts.dl = 1;
    const l = Number(q.l) || 0, m = Number(q.m) || 0, e = Number(q.e) || 0;
    parts.log = g.log.filter(x => x.n > l);
    parts.moves = g.moves.filter(x => x.seq > m);
    parts.events = g.events.filter(x => x.seq > e);
  } else {
    parts.log = g.log.slice(-FULL_LOG);
    parts.moves = g.moves;
    parts.events = g.events;
  }
  const key = (wantBoard ? 'B' : '-') + (q.sv === STATIC_VER ? '-' : 'S') + (delta ? 'd' : 'f') + parts.log.length + ':' + (parts.log.length ? parts.log[parts.log.length - 1].n : 0) + ':' + parts.moves.length + ':' + parts.events.length;
  let ext = sh.parts.get(key);
  if (ext === undefined) {
    const o = { log: parts.log, moves: parts.moves, events: parts.events };
    if (parts.dl) o.dl = 1;
    if (wantBoard) { o.board = parts.board; o.meta = parts.meta; }
    let s = JSON.stringify(o).slice(1, -1);
    if (q.sv !== STATIC_VER) s += ',' + STATIC_JSON + ',"sv":"' + STATIC_VER + '"';
    sh.parts.set(key, ext = s);
  }
  return '{' + JSON.stringify(head).slice(1, -1) + ',' + sh.body + ',' + ext + '}';
}

// Full state object (kept for tools/tests): same content as the old publicState().
function publicState(forSecret) { return JSON.parse(stateJson(forSecret)); }

function onlineSecrets() {
  const now = Date.now();
  const set = new Set([...waiters].map(w => w.secret));
  for (const [sec, t] of lastSeen) if (now - t < OFFLINE_AFTER_MS) set.add(sec);
  return set;
}
function isOnline(sec) {
  if (!sec) return true;
  for (const w of waiters) if (w.secret === sec) return true;
  const t = lastSeen.get(sec);
  return t != null && Date.now() - t < OFFLINE_AFTER_MS;
}
// Only real players are tracked (anything else, e.g. spectators or junk tokens, shares the '' slot) so the map cannot grow without bound.
function seen(sec) { lastSeen.set(bySecret(sec) ? sec : '', Date.now()); }

function answer(w) {
  clearTimeout(w.timer);
  waiters.delete(w);
  const res = w.res;
  if (res.destroyed || res.writableEnded) return;
  seen(w.secret);
  const text = `{"v":${version},"state":${stateJson(w.secret, w.q)}}`;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' };
  if (w.gzip && text.length > 600) {
    // viewers with identical needs (e.g. spectators) share one compressed copy per version
    const sh = sharedBody();
    const k = (w.secret || '') + '|' + JSON.stringify(w.q);
    let buf = sh.gz.get(k);
    if (!buf) sh.gz.set(k, buf = zlib.gzipSync(text, { level: 4 }));
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    return res.end(buf);
  }
  res.writeHead(200, headers);
  res.end(text);
}

// Several changes in one tick (an action plus the bot reacting) are answered with a single update.
let flushScheduled = false;
function broadcast() {
  version++;
  if (flushScheduled) return;
  flushScheduled = true;
  setImmediate(() => { flushScheduled = false; for (const w of [...waiters]) answer(w); });
}

// Refresh everyone when a player goes offline/online.
let lastOnlineKey = '';
const onlineTimer = setInterval(() => {
  const key = g.players.map(p => isOnline(p.secret) ? 1 : 0).join('');
  if (key !== lastOnlineKey) { lastOnlineKey = key; broadcast(); }
  const now = Date.now();
  for (const [sec, t] of lastSeen) if (now - t > 10 * 60 * 1000 || (sec && !bySecret(sec))) lastSeen.delete(sec);
}, 5000);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '', big = false;
    req.on('data', c => { if (big) return; data += c; if (data.length > 1e5) { big = true; data = ''; reject(new Error('Too large.')); req.destroy(); } });
    req.on('error', reject);
    req.on('close', () => reject(new Error('Closed.')));   // no-op once resolved
    req.on('end', () => { try { const o = data ? JSON.parse(data) : {}; resolve(o && typeof o === 'object' && !Array.isArray(o) ? o : {}); } catch (e) { reject(e); } });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.json', '.svg', '.txt', '.md', '.wasm', '.gltf']);
const PUBLIC = path.join(__dirname, 'public');
// compressed copies of static text files, keyed by file + mtime (so an edited file is recompressed on its next request)
const zipCache = new Map(); let zipBytes = 0;
function zipped(file, st, kind, data, cb) {
  const key = kind + '|' + file + '|' + st.mtimeMs + '|' + st.size;
  const hit = zipCache.get(key);
  if (hit) return cb(hit);
  const done = (err, buf) => {
    if (err) return cb(null);
    zipBytes += buf.length;
    zipCache.set(key, buf);
    for (const [k, v] of zipCache) { if (zipBytes <= 64 << 20) break; zipCache.delete(k); zipBytes -= v.length; }   // keep the cache bounded
    cb(buf);
  };
  if (kind === 'br') zlib.brotliCompress(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length } }, done);
  else zlib.gzip(data, { level: 6 }, done);
}

function serveStatic(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.resolve(PUBLIC, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(PUBLIC, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) { res.writeHead(403); return res.end(); }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    // Our own code and pages are re-validated on every load (ETag -> a cheap 304 when unchanged), so an update reaches players on a plain reload.
    // Third-party libraries and big assets (models, textures, fonts) may be cached for an hour.
    const code = ['.html', '.js', '.mjs', '.css', '.json'].includes(ext) && !relative.startsWith('vendor' + path.sep);
    const etag = `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
    const base = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': code ? 'no-cache' : 'public, max-age=3600', ETag: etag, 'Last-Modified': st.mtime.toUTCString(), Vary: 'Accept-Encoding' };
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some(x => x.trim().replace(/^W\//, '') === etag)) { res.writeHead(304, base); return res.end(); }
    const ae = String(req.headers['accept-encoding'] || '');
    const kind = COMPRESSIBLE.has(ext) && st.size > 1024 ? (/\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null) : null;
    const send = (buf, enc) => {
      const h = { ...base, 'Content-Length': buf.length };
      if (enc) h['Content-Encoding'] = enc;
      res.writeHead(200, h);
      res.end(req.method === 'HEAD' ? undefined : buf);
    };
    if (!kind) {
      if (st.size > 4 << 20 && req.method === 'GET') {   // big binaries: stream instead of loading into memory
        res.writeHead(200, { ...base, 'Content-Length': st.size });
        const rs = fs.createReadStream(file);
        rs.on('error', () => res.destroy());
        res.on('close', () => rs.destroy());
        return rs.pipe(res);
      }
      return fs.readFile(file, (e, data) => { if (e) { res.writeHead(404); return res.end('Not found'); } send(data, null); });
    }
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      zipped(file, st, kind, data, buf => (buf ? send(buf, kind === 'br' ? 'br' : 'gzip') : send(data, null)));
    });
  });
}

const server = http.createServer(async (req, res) => {
  try { await handle(req, res); }
  catch (e) { // never let a bad request take the game down
    console.log('  (request error:', e && e.message, ')');
    if (!res.headersSent) { try { res.writeHead(500, { 'Content-Type': 'application/json' }); } catch {} }
    try { res.end('{"error":"Server error."}'); } catch {}
  }
});
server.headersTimeout = 20000;

async function handle(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/poll') {
    // Legacy clients may still send s; updated clients keep tokens out of URLs.
    const sec = (req.headers.authorization || '').replace(/^Bearer /, '') || url.searchParams.get('s') || '';
    const sp = url.searchParams;
    const q = {};
    for (const k of ['g', 'l', 'm', 'e', 'sv', 'bv']) if (sp.has(k)) q[k] = sp.get(k);
    const w = { res, secret: sec.slice(0, 80), q, gzip: /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) };
    const wasOnline = isOnline(w.secret);
    seen(w.secret);
    if (Number(sp.get('v')) !== version) return answer(w);
    waiters.add(w);
    w.timer = setTimeout(() => answer(w), POLL_HOLD_MS);
    res.on('close', () => { clearTimeout(w.timer); waiters.delete(w); });
    if (!wasOnline) broadcast();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/join') {
    try {
      const { name } = await readBody(req);
      if (g.phase !== 'lobby') return json(res, 400, { error: 'Game already in progress.' });
      if (g.players.length >= MAX_PLAYERS) return json(res, 400, { error: 'Game is full (4 players).' });
      const p = {
        id: crypto.randomBytes(4).toString('hex'),
        secret: crypto.randomBytes(16).toString('hex'),
        name: String(name || 'Player').slice(0, 16).trim() || 'Player',
        token: TOKENS.find(t => !g.players.some(o => o.token === t)),
        color: COLORS.find(c => !g.players.some(o => o.color === c)),
        team: smallerTeam(),
        ...playerDefaults(),
      };
      g.players.push(p);
      if (!g.hostId) g.hostId = p.id;
      broadcast();
      return json(res, 200, { secret: p.secret });
    } catch (e) { return json(res, 400, { error: 'Bad request.' }); }
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Bad request.' }); }
    const p = bySecret(body.secret);
    if (!p) return json(res, 403, { error: 'Unknown player — please rejoin.' });
    const fn = Object.prototype.hasOwnProperty.call(actions, body.type) ? actions[body.type] : null;
    if (!fn) return json(res, 400, { error: 'Unknown action.' });
    try {
      fn(p, body);
      broadcast();
      scheduleBots();
      return json(res, 200, { ok: true });
    } catch (e) {
      if (!(e instanceof Error) || e.constructor !== Error) { console.log(`  (action ${body.type} crashed: ${e && e.stack || e})`); broadcast(); } // a crash may have left a half-applied action behind; plain rule errors change nothing
      return json(res, 400, { error: e instanceof Error && e.constructor === Error ? e.message : 'Something went wrong.' });
    }
  }

  serveStatic(req, res, url);
}


// A bug in one request or timer must never end a running game for everybody.
if (!process.env.SIM) process.on('uncaughtException', e => console.log('  (uncaught error:', e && e.stack || e, ')'));

server.on('error', err => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.log(`\n⚠️  Port ${PORT} is already in use — the game is probably already running in another terminal window.`);
  console.log('   Stop it there with Ctrl+C, or use another port:  PORT=3001 node server.js --online\n');
  process.exit(1);
});

// SIM=1: headless balance simulation (tools/sim.mjs) — no listening, just export the internals.
if (process.env.SIM) {
  module.exports = {
    actions, botWants, goBankrupt, nextTurn, netWorth, mafiaTick, baseRent, canEvict, evictCost, speedMult, SPEEDS, RAIL_RENT, UTIL_RENT,
    get g() { return g; },
    newGame(nBots, settings) { // an all-bot lobby, started
      const host = { id: 'h0', secret: 'bot-h0', name: 'Host Bot', token: TOKENS[0], color: COLORS[0], team: 0, bot: true };
      g = null; g = freshGame([host]);
      Object.assign(g.settings, settings || {});
      if (isTeams()) balanceTeams();
      for (let i = 1; i < nBots; i++) actions.addBot(g.players[0]);
      actions.start(g.players[0]);
      return g;
    },
  };
  clearInterval(onlineTimer);
} else server.listen(PORT, '0.0.0.0', () => {
  const listeningPort = server.address().port;
  if (process.parentPort) process.parentPort.postMessage({ type: 'ready', port: listeningPort });
  console.log('\n🎲  Under The Table is running!\n');
  console.log(`   On this computer:   http://localhost:${listeningPort}`);
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs || []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`   Friends on Wi-Fi:   http://${i.address}:${listeningPort}`);
    }
  }
  if (ONLINE) startTunnel();
  else if (!process.env.MONOPOLY_DESKTOP) console.log('\n   Want friends to join from their own homes? Run:  node server.js --online');
  console.log('\n   Press Ctrl+C to stop.\n');
});

// Opens a free Cloudflare quick tunnel so friends anywhere can join.
function startTunnel() {
  console.log('\n   Opening a public link for friends at home…');
  const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`]);
  const onData = buf => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !inviteUrl) {
      inviteUrl = m[0];
      console.log('\n   ┌──────────────────────────────────────────────────────────────');
      console.log(`   │  🌍 Send this link to your friends:  ${inviteUrl}`);
      console.log('   └──────────────────────────────────────────────────────────────');
      console.log('   (It can take ~20 seconds before the link starts working.)\n');
      broadcast();
    }
  };
  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
  tunnel.on('error', err => {
    if (err.code === 'ENOENT') {
      console.log('\n   ⚠️  cloudflared is not installed, so no public link was made.');
      console.log('      Install it once with:  brew install cloudflared');
      console.log('      Then run again:        node server.js --online\n');
    } else console.log('   ⚠️  Tunnel error:', err.message);
  });
  tunnel.on('exit', code => {
    if (inviteUrl) console.log(`\n   ⚠️  The public link closed (code ${code}). Restart with --online for a new one.`);
    inviteUrl = null;
    broadcast();
  });
  const stop = () => { tunnel.kill(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

// Desktop hosting publishes its link through the same state used by browser players.
if (process.env.MONOPOLY_DESKTOP && process.parentPort) {
  process.parentPort.on('message', ({ data }) => {
    if (data.type === 'invite') { inviteUrl = data.url; broadcast(); }
  });
}
