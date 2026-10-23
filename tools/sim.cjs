// Headless bot-only balance simulation.  Usage: node tools/sim.cjs [games4 games3 games2v2]   (default 200 200 100)
// Loads the real server.js with SIM=1 (no HTTP, no timers) and drives botWants()/actions directly.
process.env.SIM = '1';
const S = require('../server.js');
const N = process.argv.slice(2).map(Number);
const MAF = { ...(process.env.SQUAT === "1" ? { globalEvery: 1 } : {}), ...(process.env.MAFIA === '1' ? { mafia: true } : {}), ...(process.env.MAP ? { map: process.env.MAP } : {}), ...(process.env.GLOBAL_EVERY ? { globalEvery: Number(process.env.GLOBAL_EVERY) } : {}) };   // MAFIA=1 node tools/sim.cjs  -> the optional Mafia loan rule on
const configs = [
  { name: '4 players FFA', n: 4, games: N[0] || 200, set: MAF },
  { name: '3 players FFA', n: 3, games: N[1] || 200, set: MAF },
  { name: '2v2 teams', n: 4, games: N[2] || 100, set: { mode: 'teams', ...MAF } },
];
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x, d = 1) => (Number.isNaN(x) ? '-' : x.toFixed(d));
const K = x => (Number.isNaN(x) ? '-' : (x / 1000).toFixed(0) + 'K');


// ---- invariants: return a list of violated rules for the current game state
const GROUPS_OK = new Set(['classic', 'attack', 'counter']);
function invariants(g) {
  const bad = [];
  const ids = new Set(g.players.map(p => p.id));
  const alive = new Set(g.players.filter(p => !p.bankrupt).map(p => p.id));
  const fx = (c, m) => { if (!c) bad.push(m); };
  for (const p of g.players) {
    fx(Number.isInteger(p.money), `money not integer: ${p.name} ${p.money}`);
    fx(p.pos >= 0 && p.pos < 40 && Number.isInteger(p.pos), 'pos out of range');
    if (p.bankrupt) {
      fx(p.money === 0, 'bankrupt player has money ' + p.money);
      fx(!p.hand.length, 'bankrupt player still holds ' + p.hand.length + ' hand cards');
      fx(!p.jailCards.length, 'bankrupt player still holds jail cards');
      fx(!p.loan, 'bankrupt player has a loan');
      fx(!Object.values(g.props).some(s => s.owner === p.id), 'bankrupt player owns tiles');
      fx(!g.effects.some(e => e.owner === p.id), 'effect owned by bankrupt player');
    }
    fx(p.hand.length <= 3, 'hand > 3');
    for (const c of p.hand) fx(c.id && ['gang', 'squatters', 'protection'].includes(c.key), 'bad hand card ' + JSON.stringify(c));
    if (p.loan) fx(Number.isInteger(p.loan.due) && p.loan.due > 0 && p.loan.turnsLeft > 0, 'bad loan ' + JSON.stringify(p.loan));
    fx((p.loans || 0) <= 2, 'more than 2 loans');
  }
  for (const [pos, st] of Object.entries(g.props)) {
    const sp = g.board[pos];
    fx(sp && ['property', 'railroad', 'utility'].includes(sp.type), 'prop on non-ownable tile ' + pos);
    fx(alive.has(st.owner), `tile ${pos} owned by dead/unknown player ${st.owner}`);
    fx(Number.isInteger(st.level) && st.level >= 1 && st.level <= 5, `tile ${pos} level ${st.level}`);
    if (sp && sp.type !== 'property') fx(st.level === 1, 'non-property above level 1');
    if (st.mortgaged) fx(st.level === 1, `mortgaged tile ${pos} at level ${st.level}`);
  }
  for (const [pos, o] of Object.entries(g.protection || {})) fx(g.props[pos] && g.props[pos].owner === o, 'stale protection on ' + pos);
  const seen = new Set();
  for (const e of g.effects) {
    fx(e && typeof e.kind === 'string' && e.id != null && typeof e.label === 'string' && Number.isFinite(e.mult) && Number.isFinite(e.until), 'malformed effect ' + JSON.stringify(e));
    fx(e.until > g.round - 1 || e.untilTurnOf != null, `expired effect lingering ${e.kind} until ${e.until} round ${g.round}`);
    fx(e.until <= g.round + 6, 'effect too long ' + e.until);
    if (e.pos != null) fx(g.props[e.pos], `effect ${e.kind} on unowned tile ${e.pos}`);
    if (e.owner != null) fx(alive.has(e.owner), 'effect owner dead');
    fx(!seen.has(e.id), 'duplicate effect id'); seen.add(e.id);
    if (e.kind === 'squatters') fx(Number.isInteger(e.placedSeq) && e.placedSeq >= 1 && e.placedSeq <= g.turnSeq, 'squatters without a valid placedSeq ' + e.placedSeq);
  }
  if (g.phase === 'playing') {
    const c = g.players[g.turn];
    fx(c && !c.bankrupt, 'current player bankrupt/missing');
    fx(['roll', 'buy', 'upgrade', 'buyout', 'end', 'crime', 'gift', 'bribe'].includes(g.turnState), 'bad turnState ' + g.turnState);
    if (g.pending) {
      fx(g.turnState === (g.pending.kind || 'buy'), `turnState ${g.turnState} vs pending ${g.pending.kind}`);
      if (g.pending.kind === 'gift') fx(g.pending.options.some(i => g.props[i] && g.props[i].owner === c.id), 'gift pending with no valid option');
      if (g.pending.kind === 'bribe') fx(g.pending.options.some(i => alive.has(i)), 'bribe pending with no valid option');
      if (g.pending.pos != null && g.pending.kind !== 'buy') fx(g.props[g.pending.pos], 'pending on unowned tile');
    } else fx(['roll', 'end'].includes(g.turnState), 'no pending but turnState ' + g.turnState);
    fx(alive.size > 1, 'playing with <= 1 alive');
    if (g.trade) fx(alive.has(g.trade.from) && alive.has(g.trade.to), 'trade with dead player');
  } else if (g.phase === 'over') {
    fx(g.winner == null || ids.has(g.winner), 'bad winner');
  }
  // card conservation: decks + hands + jail cards + (pending none) must equal the original total
  if (g.decks) {
    const n = (k) => g.decks.chance.concat(g.decks.chest).filter(c => c.key === k).length
      + g.players.reduce((s, p) => s + p.hand.filter(c => c.key === k).length + (k === 'classic' ? p.jailCards.length : 0), 0);
    for (const k of ['gang', 'squatters', 'protection']) { if (g._cardTotals && g._cardTotals[k] != null) fx(n(k) === g._cardTotals[k], `card leak: ${k} ${n(k)} vs ${g._cardTotals[k]}`); }
    if (!g._cardTotals) { g._cardTotals = {}; for (const k of ['gang', 'squatters', 'protection']) g._cardTotals[k] = n(k); }
    const jc = g.players.reduce((s, p) => s + p.jailCards.length, 0) + g.decks.chance.concat(g.decks.chest).filter(c => c.jail).length;
    if (g._jailTotal == null) g._jailTotal = jc; else fx(jc === g._jailTotal, `jail card leak ${jc} vs ${g._jailTotal}`);
  }
  return bad;
}

// ---- squatters rules: an eviction must never succeed before one full turn of the owner has passed since the squatters arrived
const SQUAT = process.env.SQUAT === '1';   // SQUAT=1: squatters-heavy run (extra squatters dropped on random owned tiles all the time, global wheel every round)
const sq = { evicted: 0, blocked: 0, attempts: 0, placed: 0 };
let sqViolation = null;
const realEvict = S.actions.evict;
S.actions.evict = function (p, a) {
  const g = S.g, e = g.effects.find(x => x.kind === 'squatters' && x.pos === Number(a && a.pos) && g.round < x.until);
  const owner = e && g.props[e.pos] && g.players.find(q => q.id === g.props[e.pos].owner);
  sq.attempts++;
  const moneyBefore = p.money;
  try { realEvict.call(this, p, a); } catch (err) { if (e && owner === p && !S.canEvict(e, p)) sq.blocked++; throw err; }
  sq.evicted++;
  if (!e || !owner || owner !== p || !(p.doneSeq > e.placedSeq)) sqViolation = `evicted too early: placedSeq ${e && e.placedSeq}, doneSeq ${p.doneSeq}, turnSeq ${g.turnSeq}`;
  const sp = g.board[e.pos], st = g.props[e.pos];
  const want = Math.max(10000, Math.round(0.5 * (sp.price + (st.level - 1) * (sp.houseCost || 0)) / 10000) * 10000);
  if (moneyBefore - p.money !== want) sqViolation = `eviction cost ${moneyBefore - p.money} != ${want}`;
};
function dropSquatters(g) {
  if (!SQUAT || Math.random() > 0.2) return;
  const tiles = Object.keys(g.props).map(Number).filter(i => !g.props[i].mortgaged && !g.effects.some(e => e.kind === 'squatters' && e.pos === i));
  if (!tiles.length) return;
  const pos = tiles[Math.floor(Math.random() * tiles.length)];
  g.effects.push({ id: 'sq' + Math.random(), kind: 'squatters', pos, mult: 0, until: g.round + 3, label: 'Squatters: sim', placedSeq: g.turnSeq });
  sq.placed++;
}

// ---- fixed rent numbers (station / utility rent doubled)
(function rentSelfTest() {
  const g = S.newGame(2, {});
  const rails = g.board.filter(s => s.type === 'railroad').map(s => s.i), utils = g.board.filter(s => s.type === 'utility').map(s => s.i);
  const bad = [];
  rails.forEach((i, n) => { g.props[i] = { owner: g.players[0].id, level: 1, mortgaged: false }; const want = 50000 * 2 ** n; if (S.baseRent(i) !== want) bad.push(`station x${n + 1}: ${S.baseRent(i)} != ${want}`); });
  g.dice = [3, 4];
  utils.forEach((i, n) => { g.props[i] = { owner: g.players[0].id, level: 1, mortgaged: false }; const want = 7 * (n ? 20000 : 8000); if (S.baseRent(i) !== want) bad.push(`utility x${n + 1}: ${S.baseRent(i)} != ${want}`); if (n === 0 && S.baseRent(i, { utilMult: 20000 }) !== 140000) bad.push('utility card multiplier'); });
  if (S.SPEEDS.relaxed !== 1.6 || S.SPEEDS.normal !== 1 || S.SPEEDS.fast !== 0.65) bad.push('speed table');
  if (S.g.settings.speed !== 'relaxed') bad.push('default speed ' + S.g.settings.speed);
  const host = g.players[0];
  g.phase = 'lobby'; S.actions.settings(host, { speed: 'fast' }); if (g.settings.speed !== 'fast') bad.push('speed setting not stored');
  S.actions.settings(host, { speed: 'bogus' }); if (g.settings.speed !== 'fast') bad.push('bogus speed accepted');
  if (S.speedMult() !== 0.65) bad.push('speedMult fast');
  S.actions.settings(host, { speed: 'relaxed' });
  g.phase = 'playing';
  console.log(bad.length ? 'RENT/SPEED SELF-TEST FAILED:\n  ' + bad.join('\n  ') : 'rent + speed self-test: ok (stations 50/100/200/400K, utilities dice x 8K / x 20K, speed Relaxed/Normal/Fast)');
  if (bad.length) process.exitCode = 1;
})();

const FUZZ = process.env.FUZZ === '1';   // FUZZ=1: also fire random human-style actions (trades, cards, quits, kicks...) between bot moves
const chk = (g, r, tag) => { for (const m of invariants(g)) { const k = m.replace(/[0-9]+/g, '#'); if (!r.inv[k]) r.inv[k] = { n: 0, ex: m + '  [after ' + tag + ', round ' + g.round + ']' }; r.inv[k].n++; } };
const checkInv = chk;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
function fuzz(g, r) {
  if (g.phase !== 'playing' || Math.random() > 0.25) return;
  const ps = g.players, p = pick(ps);
  const props = Object.keys(g.props).map(Number);
  const mine = props.filter(i => g.props[i].owner === p.id);
  const other = pick(ps.filter(o => o !== p)) || p;
  const acts = [
    ['tradePropose', () => ({ to: other.id, giveProps: mine.length ? [pick(mine)] : [], getProps: Math.random() < 0.5 ? [pick(props)] : [], giveMoney: rnd(5) * 100000, getMoney: rnd(3) * 100000 })],
    ['tradeRespond', () => ({ accept: Math.random() < 0.6 })], ['tradeCancel', () => ({})],
    ['playCard', () => ({ cardId: p.hand.length ? pick(p.hand).id : 'x', target: pick(props.length ? props : [1]) })],
    ['evict', () => ({ pos: mine.length ? pick(mine) : 1 })], ['mortgage', () => ({ pos: pick(mine.length ? mine : [1]) })],
    ['unmortgage', () => ({ pos: pick(mine.length ? mine : [1]) })], ['sell', () => ({ pos: pick(mine.length ? mine : [1]) })],
    ['teamGift', () => ({ amount: rnd(600000) })], ['setShare', () => ({ pct: rnd(11) * 10 })],
    ['borrowMafia', () => ({ amount: 200000 + 50000 * rnd(20), turns: 3 + rnd(8) })], ['repayMafia', () => ({ amount: rnd(500000) })],
    ['payJail', () => ({})], ['jailCard', () => ({})], ['emote', () => ({ emoji: '😂' })], ['chat', () => ({ text: 'hi' })],
    ['pass', () => ({})], ['payPolice', () => ({})], ['chooseGift', () => ({ pos: pick(mine.length ? mine : [1]) })], ['chooseBribe', () => ({ target: other.id })],
    ['buy', () => ({ level: 1 + rnd(3) })], ['upgrade', () => ({ to: 2 + rnd(4) })], ['buyout', () => ({})], ['taxiRide', () => ({ to: rnd(40) })],
    ['roll', () => ({})], ['endTurn', () => ({})],
  ];
  if (Math.random() < 0.015) acts.push(['quit', () => ({})], ['bankrupt', () => ({})]);
  if (Math.random() < 0.015) acts.push(['kick', () => ({ playerId: other.id })], ['endGame', () => ({})]);
  const [type, mk] = pick(acts);
  const host = g.players.find(x => x.id === g.hostId) || ps[0];
  const who = (type === 'kick' || type === 'endGame') ? host : p;
  if (p.bankrupt && who === p && !['chat', 'emote'].includes(type) && Math.random() < 0.8) return;
  try { S.actions[type](who, mk()); }
  catch (e) { if (!(e instanceof Error) || e.constructor !== Error) { const k = 'fuzz ' + type + ': ' + e.constructor.name + ' ' + e.message; r.crashes[k] = (r.crashes[k] || 0) + 1; } }
  chk(g, r, 'fuzz:' + type);
}

function play(cfg) {
  const g = S.newGame(cfg.n, cfg.set);
  g.casinoStats = {};
  g.globalStats = {};
  g.cardStats = {};
  g.mafiaStats = {};
  const r = { inv: {}, crashes: {}, buyouts: 0, upgrades: 0, taxi: 0, firstBk: null, cash10: [], cash25: [], rent: [[0, 0], [0, 0], [0, 0]], bk: [], errors: {}, stalled: false, buy: [0, 0, 0, 0, 0, 0] };
  const band = rd => (rd <= 10 ? 0 : rd <= 25 ? 1 : 2);
  let snap10 = false, snap25 = false, steps = 0, lastRentSum = 0;
  const rentSum = () => g.players.reduce((s, p) => s + p.stats.rentPaid, 0);
  while (g.phase === 'playing') {
    if (++steps > 100000) { r.stalled = true; r.stallInfo = { why: 'steps', turn: g.turn, state: g.turnState, pending: g.pending, round: g.round }; break; }
    const sig = g.round + ':' + g.turn + ':' + g.turnState + ':' + (g.pending ? g.pending.kind : '');
    if (sig === r._sig) { if (++r._same > 60) { r.stalled = true; r.stallInfo = { why: 'stuck', sig, pending: g.pending }; break; } } else { r._sig = sig; r._same = 0; }
    let acted = false;
    for (const b of g.players) {
      if (b.bankrupt) continue;
      const want = S.botWants(b);
      if (!want) continue;
      if (want[0] === 'wait') { b.debtSince -= 30000; continue; }
      const roundBefore = g.round;
      const posBefore = b.pos;
      try {
        S.actions[want[0]](b, want[1]);
        if (want[0] === 'buyout') r.buyouts++;
        if (want[0] === 'upgrade') r.upgrades++;
        if (want[0] === 'taxiRide') r.taxi++;
        if (want[0] === 'buy' && want[1].level) r.buy[want[1].level]++;
      } catch (e) {
        const k = want[0] + ': ' + e.message; r.errors[k] = (r.errors[k] || 0) + 1;
        if (e.constructor !== Error) { const c = 'bot ' + k + ' ' + e.constructor.name; r.crashes[c] = (r.crashes[c] || 0) + 1; }
        if (++b.botErrors > 4 || !(b.botErrors = (b.botErrors || 0) + 1)) { b.lastCreditor = null; S.goBankrupt(b); }
      }
      checkInv(g, r, want[0]);
      dropSquatters(g);
      if (sqViolation) { r.inv[sqViolation.replace(/[0-9]+/g, '#')] = { n: 1, ex: sqViolation + ' [after ' + want[0] + ']' }; sqViolation = null; }
      if (FUZZ) fuzz(g, r);
      const rs = rentSum();
      if (rs > lastRentSum) { const k = band(roundBefore); r.rent[k][0] += rs - lastRentSum; r.rent[k][1]++; lastRentSum = rs; }
      // debt / bankruptcy diagnostics
      for (const p of g.players) {
        if (p.money < 0 && !p._debt) p._debt = { round: g.round, money: p.money, ...assets(g, p) };
        if (p.bankrupt && p._debt && !p._logged) { p._logged = true; r.bk.push({ round: g.round, ...p._debt }); }
        else if (p.bankrupt && !p._logged) { p._logged = true; r.bk.push({ round: g.round, money: 0, ...{ n: 0, lvl: 0, val: 0, mort: 0 } }); }
        if (p.money >= 0) p._debt = null;
      }
      if (r.firstBk == null && g.players.some(p => p.bankrupt)) r.firstBk = g.round;
      acted = true;
      break;
    }
    if (g.round >= 10 && !snap10) { snap10 = true; r.cash10.push(...g.players.filter(p => !p.bankrupt).map(p => p.money)); }
    if (g.round >= 25 && !snap25) { snap25 = true; r.cash25.push(...g.players.filter(p => !p.bankrupt).map(p => p.money)); }
    if (!acted) { r.stalled = true; r.stallInfo = { turn: g.turn, state: g.turnState, pending: g.pending, round: g.round }; break; }
  }
  chk(g, r, 'end');
  if (sqViolation) { r.inv[sqViolation.replace(/[0-9]+/g, '#')] = { n: 1, ex: sqViolation }; sqViolation = null; }
  r.casino = g.casinoStats;
  r.glob = g.globalStats;
  r.cards = g.cardStats;
  r.mafia = g.mafiaStats;
  r.bkCount = g.players.filter(p => p.bankrupt).length;
  r.rounds = g.round;
  r.splits = g.splitCount || 0;
  r.alive = g.players.filter(p => !p.bankrupt).length;
  r.capEnd = g.phase === 'over' && g.settings.maxRounds && g.round >= g.settings.maxRounds && (cfg.set.mode === 'teams' ? new Set(g.players.filter(p => !p.bankrupt).map(p => p.team)).size > 1 : r.alive > 1);
  r.lvl = [0, 0, 0, 0, 0, 0]; // [unowned, L1..L5]
  for (const s of g.board) if (s.type === 'property') { const st = g.props[s.i]; r.lvl[st ? st.level : 0]++; }
  r.props = g.board.filter(s => s.type === 'property').length;
  return r;
}
function assets(g, p) {
  let n = 0, lvl = 0, val = 0, mort = 0;
  for (const [pos, st] of Object.entries(g.props)) if (st.owner === p.id) { const sp = g.board[pos]; n++; lvl += st.level - 1; val += sp.price + (st.level - 1) * (sp.houseCost || 0); if (st.mortgaged) mort++; }
  return { n, lvl, val, mort };
}

const t0 = Date.now();
const TOTAL = { games: 0, stalls: 0, inv: 0, crash: 0 };
for (const cfg of configs) {
  const R = [];
  for (let i = 0; i < cfg.games; i++) R.push(play(cfg));
  const done = R.filter(r => !r.stalled);
  const bks = R.flatMap(r => r.bk);
  const lv = [0, 0, 0, 0, 0, 0]; let tot = 0;
  for (const r of R) { r.lvl.forEach((c, k) => { lv[k] += c; }); tot += r.props; }
  const errs = {}; for (const r of R) for (const [k, v] of Object.entries(r.errors)) errs[k] = (errs[k] || 0) + v;
  const rent = k => { const c = R.reduce((s, r) => s + r.rent[k][1], 0); return c ? R.reduce((s, r) => s + r.rent[k][0], 0) / c : NaN; };
  console.log(`\n== ${cfg.name}  (${cfg.games} games) ==`);
  console.log(`rounds avg/median:        ${f(avg(R.map(r => r.rounds)))} / ${f(med(R.map(r => r.rounds)))}`);
  if (cfg.set.mode === 'teams') console.log(`rent splits per game:      ${f(avg(R.map(r => r.splits)), 1)}`);
  console.log(`ended by cap / bankruptcy: ${f(100 * R.filter(r => r.capEnd).length / R.length)}% / ${f(100 * R.filter(r => !r.capEnd && !r.stalled).length / R.length)}%   stalled: ${R.filter(r => r.stalled).length}`);
  console.log(`median round of 1st bankruptcy: ${f(med(R.filter(r => r.firstBk != null).map(r => r.firstBk)))}  (games with any bankruptcy: ${R.filter(r => r.firstBk != null).length})`);
  console.log(`per game: buyouts ${f(avg(R.map(r => r.buyouts)), 2)}, upgrades ${f(avg(R.map(r => r.upgrades)), 2)}, taxi rides ${f(avg(R.map(r => r.taxi)), 2)}`);
  console.log(`property tiles at end: unowned ${f(100 * lv[0] / tot)}%  L1 ${f(100 * lv[1] / tot)}%  L2 ${f(100 * lv[2] / tot)}%  L3 ${f(100 * lv[3] / tot)}%  L4 ${f(100 * lv[4] / tot)}%  L5 ${f(100 * lv[5] / tot)}%`);
  console.log(`median cash (alive players) @round10: ${K(med(R.flatMap(r => r.cash10)))}  @round25: ${K(med(R.flatMap(r => r.cash25)))}`);
  console.log(`avg rent per rent payment: r1-10 ${K(rent(0))}  r11-25 ${K(rent(1))}  r26-50 ${K(rent(2))}`);
  const buys = [0, 0, 0, 0]; for (const r of R) for (let k = 1; k <= 3; k++) buys[k] += r.buy[k];
  console.log(`bot property buys by level: L1 ${buys[1]}  L2 ${buys[2]}  L3 ${buys[3]}`);
  console.log(`debt at time of bankruptcy (n=${bks.length}): avg props ${f(avg(bks.map(b => b.n)))}, avg extra levels ${f(avg(bks.map(b => b.lvl)))}, avg asset value ${K(avg(bks.map(b => b.val)))}, avg debt ${K(avg(bks.map(b => b.money)))}, mortgaged tiles ${f(avg(bks.map(b => b.mort)))}`);
  if (process.env.MAFIA === '1') { const m = {}; for (const r of R) for (const [k, v] of Object.entries(r.mafia || {})) m[k] = (m[k] || 0) + v; console.log(`mafia (totals over ${R.length} games): loans ${m.loans || 0}, repaid in full ${m.repaid || 0}, settled in cash at deadline ${m.settled || 0}, property collected ${m.collected || 0}, eliminated by mafia ${m.eliminated || 0}; bankruptcies ${R.reduce((s, r) => s + r.bkCount, 0)}`); }
  const cs = {}; for (const r of R) for (const [k, v] of Object.entries(r.casino || {})) cs[k] = (cs[k] || 0) + v;
  console.log('casino events per game:', Object.entries(cs).map(([k, v]) => `${k} ${f(v / R.length, 2)}`).join('  ') || 'none');
  const gs = {}; for (const r of R) for (const [k, v] of Object.entries(r.glob || {})) gs[k] = (gs[k] || 0) + v;
  console.log('global wheels per game:', Object.entries(gs).map(([k, v]) => `${k} ${f(v / R.length, 2)}`).join('  ') || 'none');
  const cd = {}; for (const r of R) for (const [k, v] of Object.entries(r.cards || {})) cd[k] = (cd[k] || 0) + v;
  const pc = (pre) => Object.entries(cd).filter(([k]) => k.startsWith(pre)).map(([k, v]) => `${k.slice(pre.length)} ${f(v / R.length, 2)}`).join('  ') || 'none';
  console.log('cards drawn per game:   ', pc('drew:'));
  console.log('cards played per game:  ', pc('played:'));
  console.log(`shootouts per game: win ${f((cd['shootout-win'] || 0) / R.length, 2)} loss ${f((cd['shootout-loss'] || 0) / R.length, 2)}  evictions ${f((cd.evict || 0) / R.length, 2)}  crime waves paid ${f((cd['crime-paid'] || 0) / R.length, 2)}  audits ${f((cd.audit || 0) / R.length, 2)}`);
  if (Object.keys(errs).length) console.log('bot action errors:', errs);
  const invs = {}, crs = {}; for (const r of R) { for (const [k, v] of Object.entries(r.inv)) { invs[k] = invs[k] || { n: 0, ex: v.ex }; invs[k].n += v.n; } for (const [k, v] of Object.entries(r.crashes)) crs[k] = (crs[k] || 0) + v; }
  TOTAL.games += R.length; TOTAL.stalls += R.filter(r => r.stalled).length; TOTAL.inv += Object.keys(invs).length; TOTAL.crash += Object.keys(crs).length;
  console.log(`invariant violations: ${Object.keys(invs).length ? '' : 'none'}   crashes: ${Object.keys(crs).length ? '' : 'none'}`);
  for (const [k, v] of Object.entries(invs)) console.log(`  INV x${v.n}: ${v.ex}`);
  for (const [k, v] of Object.entries(crs)) console.log(`  CRASH x${v}: ${k}`);
  const st = R.find(r => r.stalled); if (st) console.log('STALL example:', JSON.stringify(st.stallInfo));
}
console.log(`\nsquatters: evictions ${sq.evicted}, attempts ${sq.attempts}, rejected as too early ${sq.blocked}, extra squatters dropped by the sim ${sq.placed}`);
console.log(`\nTOTAL games ${TOTAL.games}, stalls ${TOTAL.stalls}, invariant kinds ${TOTAL.inv}, crash kinds ${TOTAL.crash}`);
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(0);
