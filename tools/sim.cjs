// Headless bot-only balance simulation.  Usage: node tools/sim.cjs [games4 games3 games2v2]   (default 200 200 100)
// Loads the real server.js with SIM=1 (no HTTP, no timers) and drives botWants()/actions directly.
process.env.SIM = '1';
const S = require('../server.js');
const N = process.argv.slice(2).map(Number);
const MAF = process.env.MAFIA === '1' ? { mafia: true } : {};   // MAFIA=1 node tools/sim.cjs  -> the optional Mafia loan rule on
const configs = [
  { name: '4 players FFA', n: 4, games: N[0] || 200, set: MAF },
  { name: '3 players FFA', n: 3, games: N[1] || 200, set: MAF },
  { name: '2v2 teams', n: 4, games: N[2] || 100, set: { mode: 'teams', ...MAF } },
];
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x, d = 1) => (Number.isNaN(x) ? '-' : x.toFixed(d));
const K = x => (Number.isNaN(x) ? '-' : (x / 1000).toFixed(0) + 'K');

function play(cfg) {
  const g = S.newGame(cfg.n, cfg.set);
  g.casinoStats = {};
  g.globalStats = {};
  g.cardStats = {};
  g.mafiaStats = {};
  const r = { buyouts: 0, upgrades: 0, taxi: 0, firstBk: null, cash10: [], cash25: [], rent: [[0, 0], [0, 0], [0, 0]], bk: [], errors: {}, stalled: false, buy: [0, 0, 0, 0, 0, 0] };
  const band = rd => (rd <= 10 ? 0 : rd <= 25 ? 1 : 2);
  let snap10 = false, snap25 = false, steps = 0, lastRentSum = 0;
  const rentSum = () => g.players.reduce((s, p) => s + p.stats.rentPaid, 0);
  while (g.phase === 'playing') {
    if (++steps > 100000) { r.stalled = true; break; }
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
        if (++b.botErrors > 4 || !(b.botErrors = (b.botErrors || 0) + 1)) { b.lastCreditor = null; S.goBankrupt(b); }
      }
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
  if (MAF.mafia) { const m = {}; for (const r of R) for (const [k, v] of Object.entries(r.mafia || {})) m[k] = (m[k] || 0) + v; console.log(`mafia (totals over ${R.length} games): loans ${m.loans || 0}, repaid in full ${m.repaid || 0}, settled in cash at deadline ${m.settled || 0}, property collected ${m.collected || 0}, eliminated by mafia ${m.eliminated || 0}; bankruptcies ${R.reduce((s, r) => s + r.bkCount, 0)}`); }
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
  const st = R.find(r => r.stalled); if (st) console.log('STALL example:', JSON.stringify(st.stallInfo));
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(0);
