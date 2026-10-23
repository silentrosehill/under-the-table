// Timed effects from the casino (and later events): { id, kind, pos?, group?, owner?, mult, until, label }.
// One place for the rent maths and the little tags, shared by the HUD (app.js) and City Mode (cityScene.js)
// so a tile's label, the turn card and the deed always agree.
import { t } from './i18n.js';

export const EFFECT_ICON = { police: '🚓', mayor: '🎩', gang: '🔪', squatters: '🛏', crime: '🚨', protection: '🛡', gift: '🎁', 'shootout-win': '🚔', 'shootout-loss': '🕳' };
const SHORT = { police: 'CLOSED', mayor: '×2', gang: 'GANG', squatters: 'SQUATTERS', crime: '−40%', gift: '×3', 'shootout-win': '×1.5', 'shootout-loss': '×0.5' };

// Station and utility rent (mirrors server.js): stations $50K x2 per extra one owned; a utility asks dice x $8K (one owned) or x $20K (both).
export const RAIL_RENT = 50000, UTIL_RENT = [8000, 20000];
export const railRent = n => RAIL_RENT * 2 ** (Math.max(1, n) - 1);
export const utilPerPip = n => UTIL_RENT[n >= 2 ? 1 : 0];
export const ownedOfType = (S, owner, type) => (S.board || []).filter(s => s.type === type && S.props[s.i] && S.props[s.i].owner === owner).length;

// effects still running this round
export const activeEffects = S => (S && Array.isArray(S.effects) ? S.effects : []).filter(e => e && (e.until == null || S.round < e.until));

// the effects that touch a square (by square, or by colour group; `owner` restricts to one player's tiles)
export function tileEffects(S, sp) {
  const st = S.props && S.props[sp.i];
  return activeEffects(S).filter(e => {
    if (e.pos != null ? e.pos !== sp.i : e.city ? sp.type !== 'property' : !(e.group != null && sp.group && e.group === sp.group)) return false;
    return e.owner == null || (st && st.owner === e.owner);
  });
}

// what multiplies the rent of this square right now (0 = closed)
export const effectMult = (S, sp) => tileEffects(S, sp).reduce((m, e) => m * (typeof e.mult === 'number' ? e.mult : 1), 1);

// small label tag: "🚓 CLOSED · 2 rds"
export function effectTags(S, sp) {
  return tileEffects(S, sp).map(e => {
    const n = Math.max(1, (e.until != null ? e.until : S.round + 1) - S.round);
    const word = SHORT[e.kind] || (e.mult === 0 ? 'CLOSED' : e.mult != null && e.mult !== 1 ? `×${+e.mult.toFixed(2)}` : String(e.label || e.kind).toUpperCase());
    const tail = e.untilTurnOf != null ? t('next turn') : t('{n} rds', { n });
    return { kind: e.kind, icon: EFFECT_ICON[e.kind] || '✦', text: `${EFFECT_ICON[e.kind] || '✦'} ${t(word)} · ${tail}`, tone: (e.mult == null || e.mult >= 1) ? 'good' : 'bad', n, turnOf: e.untilTurnOf != null };
  });
}
export const effectTagText = (S, sp) => effectTags(S, sp).map(x => x.text).join('  ');
