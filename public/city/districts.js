// What every square looks like in City Mode: a 1960s city at night. Districts follow the colour
// groups (so any map works); the Underworld names add each place's own touch. A property's lot
// grows with its buildings: growth[0] is the empty lot, growth[1…4] one to four houses, growth[5]
// the hotel (the district's grand building). Lots hold two narrow plots side by side.
// Lot coordinates: x across the tile (−0.46…0.46), z from the kerb (0) to the back of the lot (1.36).
// Placement options: s (or sx/sy/sz) scale, x/y/z, ry, glow (window lights on this piece),
// palette (override), smoke (a chimney on top), tint (darken a piece the palette can't reach).
import * as THREE from 'three';
import { make, glowColors } from './kit.js';

export const SUB = 'city-kit-suburban', COM = 'city-kit-commercial', IND = 'city-kit-industrial', ROADS = 'city-kit-roads',
  FAN = 'fantasy-town-kit', NAT = 'nature-kit', CAR = 'car-kit', BOAT = 'watercraft-kit', TRAIN = 'train-kit';

const L = -0.235, Rx = 0.235;                     // the two plots of a lot
const z0 = 0.4;                                   // building centre: fronts sit on the pavement line

// the empty lot of a poor street: hoarding along the pavement, rubble, a skip
const emptyLot = [
  [ROADS, 'construction-fence', { s: 1.7, x: -0.3, z: 0.06, ry: Math.PI / 2 }],
  [ROADS, 'construction-fence', { s: 1.7, x: 0.0, z: 0.06, ry: Math.PI / 2 }],
  [ROADS, 'construction-fence', { s: 1.7, x: 0.3, z: 0.06, ry: Math.PI / 2 }],
  [ROADS, 'dumpster', { s: 0.9, x: 0.25, z: 0.6, ry: 0.3 }],
  [FAN, 'planks', { s: 0.22, x: -0.22, z: 0.65, ry: 0.5 }],
  [FAN, 'rock-small', { s: 0.18, x: -0.05, z: 0.6 }],
];

// the old buildings at the back of every lot, so the city is dense before anyone builds
const backRow = (a, b) => [
  [COM, a, { sx: 0.5, sy: 0.95, sz: 0.38, x: L, z: 1.15, glow: true }],
  [COM, b, { sx: 0.5, sy: 0.85, sz: 0.38, x: Rx, z: 1.15, glow: true, smoke: true }],
];


// footprints (w × h × d at scale 1) of the models placed by B(), so districts can say how big a building should be
const DIM = {
  'a': [0.88, 1.29, 0.94], 'b': [0.98, 1.29, 0.94], 'c': [0.88, 0.89, 1.10], 'd': [0.84, 1.29, 0.90], 'f': [0.84, 1.69, 1.03], 'g': [0.98, 1.69, 0.92],
  'h': [0.88, 1.29, 1.0], 'i': [1.24, 1.68, 1.30], 'j': [2.08, 1.69, 1.34], 'k': [2.08, 1.47, 0.94], 'l': [1.38, 2.27, 1.40], 'm': [1.24, 3.15, 1.24], 'n': [2.32, 2.48, 1.82],
  'skyscraper-a': [1.36, 2.88, 1.36], 'skyscraper-b': [1.36, 4.48, 1.36], 'skyscraper-c': [1.28, 4.08, 1.38], 'skyscraper-d': [1.28, 5.47, 1.38], 'skyscraper-e': [1.30, 4.08, 1.24],
};
// a commercial building sized in lot units: width, height, depth; front on the pavement line unless z is given
const B = (name, w, h, d, x, o = {}) => {
  const [mw, mh, md] = DIM[name];
  return [COM, 'building-' + name, { sx: w / mw, sy: h / mh, sz: d / md, x, z: d / 2 + 0.01, ...o }];
};
// a row of blocks stacked on each other, each a little narrower and shifted (harbour: uneven, piled-up concrete)
const stack = (x, w, d, hs, names, o = {}) => {
  let y = 0;
  return hs.map((h, k) => {
    const p = B(names[k % names.length], w - 0.025 * k, h, d - 0.03 * k, x + (k % 2 ? 0.025 : -0.015), { y, z: (o.z ?? d / 2 + 0.01) + (k % 2 ? 0.02 : 0), glow: true, ...(o.smoke && k === hs.length - 1 ? { smoke: true } : {}) });
    y += h - 0.01;
    return p;
  });
};
const aw = (x, w = 0.4, o = {}) => [COM, 'detail-awning-wide', { s: w / 0.8, x, y: 0.14, z: 0.01 + 0.1 * (w / 0.8), ry: Math.PI, ...o }];   // an awning over the ground floor
const open = list => Object.assign(list, { noBack: true });   // a landmark that replaces the lot's back row
const tower = (x, y, z = 0.55) => [IND, 'water-tower', { s: 0.12, x, y, z }];
// façade details (cityScene extras): an iron fire escape on a front of height h, a stone cornice ledge at height y, a small shop board
const fe = (x, h, w = 0.44) => ['fireescape', '', { x, h, w, z: 0.01 }];
const cor = (x, y, w = 0.46) => ['cornice', '', { x, y, w, z: 0.01 }];
const shop = (text, x, y = 0.27, w = 0.2) => ['shopsign', text, { x, y, z: -0.015, w }];
const boarded = x => [                                           // a boarded plot: hoarding, planks, a skip
  [ROADS, 'construction-fence', { s: 1.7, x, z: 0.06, ry: Math.PI / 2 }], [FAN, 'planks', { s: 0.24, x, z: 0.14, ry: Math.PI / 2 }],
  [ROADS, 'dumpster', { s: 0.9, x, z: 0.62, ry: 0.2 }],
];
// ------------------------------------------------------------ archetype helpers (code-built buildings: archetypes.js)
// bld(style, o): a textured building; dead(o): the same abandoned (boarded, unlit, darker); sgn: a lit board on a façade
const bld = (style, o) => ['bld', style, { glow: true, ...o }];
const dead = o => ({ glow: false, boarded: true, dim: 0.58, ...o });
const sgn = (text, x, y, w, o = {}) => ['sign', text, { w, x, y, z: -0.014, ...o }];
const vsgn = (stack, x, y, w, h, z = -0.03) => ['vsign', '', { stack, w, h, x, y, z }];     // a column of small signs, hung over the street
// a fenced, rubble-strewn empty plot between x0 and x1 (dim: darker for abandoned lots)
const fenceLot = (x0, x1, seed = 1, dim = 1) => [['fence', '', { x0, x1, z: 0.05, dim }], ['rubble', '', { x: (x0 + x1) / 2, z: 0.45, seed }],
  [ROADS, 'dumpster', { s: 0.9, x: (x0 + x1) / 2 + 0.08, z: 0.66, ry: 0.4 }]];
const BZ = 0.96, BD = 0.38;                       // the back row: z of its fronts, depth

// ---- brown / bowery: soot-black walk-ups, pawn shops
const GH = 0.22, FL = 0.19;
const ten = (x, n, ground, o = {}) => bld('tenement', { x, w: 0.44, d: 0.8, h: GH + n * FL, ground, roof: 'flat', roofMat: 'tar', parapetMat: 'brick', parapetH: 0.045, ...o });
const tenB = (x, n, o = {}) => ten(x, n, 'door', { z: BZ, d: BD, lit: 0.55, ...o });
const feT = (x, n, w = 0.4) => ['fireescape', '', { x, h: GH + n * FL, w, fl: FL, y0: GH - 0.03, z: 0.01 }];
// the six levels are single code-built buildings (bowery.js); the back row stays low so they read in front of it
const bz = (kind, o = {}) => [kind, '', { glow: true, ...o }];
const BOWERY = {
  back: [[tenB(L, 3), tenB(Rx, 3)], [tenB(L, 3), tenB(Rx, 4, { roof: 'flat' })], [tenB(L, 3), tenB(Rx, 3), tower(Rx, 0.8, 1.1)]],
  growth: [
    [['bshack', '', { x: -0.14, z: 0.2 }], ['bsale', '', { x: 0.2, z: 0.1 }]],                                                              // 0: a shack and a FOR SALE board
    [bz('bcottage', { x: 0, z: 0.12 })],                                                                                                  // 1: the cottage
    [bz('bwalkup', { x: 0, z: 0.1 }), sgn('PAWN', 0, GH + 0.05, 0.3, { icon: 'pawn', z: 0.086 }), ['pawnballs', '', { x: -0.3, y: GH + 0.13, z: 0.1 }]],   // 2: the pawn walk-up
    [bz('bblock', { x: 0, z: 0.06 }), sgn('PAWN', -0.2, GH + 0.05, 0.24, { icon: 'pawn', z: 0.046 }), sgn('LOANS', 0.2, GH + 0.05, 0.22, { z: 0.046 }),
     ['pawnballs', '', { x: -0.43, y: GH + 0.13, z: 0.06 }], ['fireescape', '', { x: 0.2, h: GH + 5 * FL, w: 0.4, fl: FL, y0: GH - 0.03, z: 0.06 }],
     ['fireescape', '', { x: -0.2, h: GH + 5 * FL, w: 0.4, fl: FL, y0: GH - 0.03, z: 0.06 }], [IND, 'water-tower', { s: 0.19, x: 0.2, y: GH + 5 * FL + 0.07, z: 0.4 }]],         // 3: the tenement block
    [bz('bbank', { x: 0, z: 0.22 }), sgn('BANK', 0, 0.853, 0.3, { tone: 'gold', calm: 0.3, z: 0.07 })],                          // 4: the savings bank
  ],
};

// ---- lightblue / london: continuous brick terraces of narrow identical houses
const U = 0.23, LH = 0.2;
const terr = (x0, n, fl, o = {}) => bld('brick', { x: x0 + n * U / 2, w: n * U, d: 0.78, h: LH + fl * LH, ground: 'door', roof: 'gable', rh: 0.13, stoop: true,
  stacks: Array.from({ length: n + 1 }, (_, k) => x0 + k * U + (k === 0 ? 0.03 : k === n ? -0.03 : 0)), ...o });
const pub = (x, fl, o = {}) => bld('brick', { x, w: U, d: 0.78, h: LH + fl * LH, ground: 'shop', roof: 'gable', rh: 0.13, stacks: [x - 0.04, x + 0.04], ...o });
const terrB = (x0, n, fl, o = {}) => terr(x0, n, fl, { z: BZ, d: BD, lit: 0.55, stoop: false, ...o });
// the six levels are single code-built buildings (london.js); the back row stays low so they read in front of it
const LONDON = {
  back: [[terrB(-0.46, 4, 2)], [terrB(-0.46, 4, 1)], [terrB(-0.46, 2, 2), terrB(0, 2, 1)]],
  growth: [
    [bz('lshed', { x: -0.14, z: 0.2 }), ['bsale', '', { x: 0.2, z: 0.1 }]],                                                                  // 0: a coal shed and a FOR SALE board
    [bz('lcottage', { x: 0, z: 0.12 })],                                                                                                     // 1: the cottage
    [bz('lterrace', { x: 0, z: 0.1 }), sgn('TOBACCO', 0.1375, LH + 0.045, 0.2, { tone: 'green', z: 0.086 })],                                // 2: the terrace pair and its corner shop
    [bz('lmansion', { x: 0, z: 0.06 })],                                      // 3: the mansion block
    [bz('lclub', { x: 0, z: 0.22 })],                                                                                                         // 4: the gentlemen's club
  ],
};

// ---- pink / paris: pale Haussmann fronts, mansards, café awnings, cabaret neon
const PH = 0.24, PF = 0.21;
const hauss = (x, n, o = {}) => bld('haussmann', { x, w: 0.44, d: 0.8, h: PH + n * PF, ground: 'cafe', roof: 'mansard', rh: 0.16, cornice: true, ...o });
const haussB = (x, n, o = {}) => hauss(x, n, { z: BZ, d: BD, lit: 0.55, ...o });
const awP = x => aw(x, 0.4, { y: 0.07, z: 0.012 });
const PARIS = {
  back: [[haussB(L, 2), haussB(Rx, 3)], [haussB(L, 3), haussB(Rx, 2)], [haussB(L, 2), haussB(Rx, 2)]],
  growth: [
    [bz('pkiosk', { x: -0.12, z: 0.2 }), ['bsale', '', { x: 0.2, z: 0.1 }]],                                                                  // 0: a kiosk and a FOR SALE board
    [bz('pcafe', { x: 0, z: 0.12 }), sgn('CAFE', 0, 0.3, 0.2, { tone: 'red', calm: 0.45, z: 0.106 })],                                        // 1: the café house
    [bz('pbalcony', { x: 0, z: 0.1 }), sgn('BAR', 0, 0.3, 0.2, { tone: 'pink', calm: 0.45, z: 0.086 })],                                      // 2: balconies and a mansard
    [bz('phauss', { x: 0, z: 0.06 }), sgn('CABARET', 0, 0.3, 0.3, { tone: 'pink', calm: 0.5, z: 0.046 }), sgn('CAFE', -0.267, 0.3, 0.2, { tone: 'red', calm: 0.4, z: 0.046 }),
     sgn('BAR', 0.267, 0.3, 0.2, { tone: 'amber', calm: 0.45, z: 0.046 }), vsgn([['CABARET', 'pink'], ['REVUE', 'amber']], 0.43, 0.55, 0.07, 0.4, 0.03)],   // 3: the Haussmann block
    [bz('ppalace', { x: 0, z: 0.22 }), sgn('CABARET', 0, 0.445, 0.4, { tone: 'pink', icon: 'marquee', calm: 0.5, z: 0.088 })],                  // 4: the cabaret palace
  ],
};

// ---- orange / tokyo: thin towers crammed together, stacks of small vertical signs
const TW = 0.151, tx = k => -0.46 + TW / 2 + k * (0.92 - TW) / 5;
const tw = (k, fl, o = {}) => bld('tokyo', { x: tx(k), w: TW, d: 0.75, h: 0.2 + fl * 0.1, ground: 'arcade', roof: 'flat', parapetH: 0.025, parapetMat: 'concrete', ...o });
const twB = (k, fl, o = {}) => tw(k, fl, { z: BZ, d: BD, lit: 0.6, ground: null, ...o });
const SAKE = [['BAR', 'pink'], ['SAKE', 'amber'], ['CLUB', 'cyan']], KARA = [['KARAOKE', 'pink'], ['BAR', 'amber']], PACH = [['PACHINKO', 'red'], ['CLUB', 'cyan'], ['BAR', 'amber']];
const TOKYO = {
  back: [[twB(0, 6), twB(1, 8), twB(2, 7), twB(3, 9), twB(4, 6), twB(5, 8)], [twB(0, 8), twB(1, 6), twB(2, 9), twB(3, 7), twB(4, 8), twB(5, 6)], [twB(0, 6), twB(1, 9), twB(2, 7), twB(3, 6), twB(4, 8), twB(5, 7)]],
  growth: [
    [bz('tyatai', { x: -0.12, z: 0.2 }), ['bsale', '', { x: 0.2, z: 0.1 }]],                                                                  // 0: a tin yatai and a FOR SALE board
    [bz('thouse', { x: 0, z: 0.12 }), sgn('SAKE', 0.05, 0.24, 0.16, { tone: 'amber', calm: 0.4, z: 0.1 })],                                    // 1: the wooden house
    [bz('tshop', { x: 0, z: 0.1 }), vsgn([['BAR', 'pink'], ['SAKE', 'amber']], 0.255, 0.42, 0.075, 0.3, 0.06), vsgn([['CLUB', 'cyan']], -0.18, 0.28, 0.065, 0.16, 0.06)],   // 2: the shop-house
    [bz('ttower', { x: 0, z: 0.06 }), vsgn(SAKE, -0.2, 0.62, 0.075, 0.5, 0.02), vsgn(PACH, 0.19, 0.85, 0.075, 0.55, 0.02), vsgn(KARA, -0.34, 0.5, 0.07, 0.4, 0.02),
     vsgn(PACH, 0.34, 0.42, 0.07, 0.36, 0.02), sgn('CLUB', 0, 0.3, 0.3, { tone: 'pink', calm: 0.45, z: 0.046 }), sgn('BAR', -0.315, 0.28, 0.14, { tone: 'cyan', calm: 0.4, z: 0.046 })],   // 3: the neon tower
    [bz('tstore', { x: 0, z: 0.22 }), sgn('TAKARA', 0, 1.46, 0.5, { tone: 'gold', calm: 0.3, z: 0.3 }), vsgn([['SALE', 'red']], -0.43, 0.7, 0.06, 0.2, 0.18), vsgn([['SALE', 'red']], 0.43, 0.7, 0.06, 0.2, 0.18)],   // 4: the department store
  ],
};

// ---- red / downtown: two-storey shop fronts under awnings, a chrome diner, a cinema marquee
const DH = 0.22, DF = 0.2;
const shopB = (x, w, n, o = {}) => bld('shopfront', { x, w, d: 0.8, h: DH + n * DF, ground: 'shop', roof: 'flat', cornice: true, ...o });
const shopBB = (x, n, o = {}) => shopB(x, 0.44, n, { z: BZ, d: BD, lit: 0.55, ...o });
const awD = (x, w) => aw(x, w, { y: 0.07, z: 0.012 });
const DOWNTOWN = {
  back: [[shopBB(L, 2), shopBB(Rx, 2)], [shopBB(L, 1), shopBB(Rx, 2)], [shopBB(L, 2), shopBB(Rx, 1)]],
  growth: [
    [bz('dstand', { x: -0.12, z: 0.2 }), ['bsale', '', { x: 0.2, z: 0.1 }]],                                                                  // 0: a hot-dog stand and a FOR SALE board
    [bz('dcorner', { x: 0, z: 0.12 }), sgn('GROCERY', 0, 0.27, 0.26, { tone: 'red', calm: 0.45, z: 0.106 })],                                  // 1: the corner store
    [bz('ddiner', { x: 0, z: 0.1 }), sgn('DINER', 0, 0.33, 0.4, { tone: 'red', calm: 0.5, z: 0.086 })],                                        // 2: the diner block
    [bz('dstore', { x: 0, z: 0.06 }), sgn('CINEMA', 0, 0.52, 0.44, { icon: 'marquee', calm: 0.5, z: 0.03 }), vsgn([['CINEMA', 'amber'], ['OPEN', 'red']], 0.43, 0.8, 0.07, 0.45, 0.02),
     sgn('SHOES', -0.267, 0.27, 0.2, { tone: 'red', z: 0.046 }), sgn('RADIO', 0.267, 0.27, 0.2, { tone: 'amber', z: 0.046 })],                // 3: the department store / cinema
    [bz('dpalace', { x: 0, z: 0.22 }), sgn('PALACE', 0, 0.55, 0.52, { icon: 'marquee', calm: 0.5, z: 0.18 }), vsgn([['PALACE', 'red'], ['MOVIES', 'amber']], 0, 1.3, 0.1, 0.4, 0.2)],   // 4: the movie palace
  ],
};

// ---- yellow / harbour: sawtooth warehouses, containers, cranes, dark water, sodium lamps
const wh = (x, w, h, o = {}) => bld('warehouse', { x, w, d: 0.8, h, ground: 'garage', roof: 'saw', rh: 0.13, teeth: 3, ...o });
const whB = (x, w, h, o = {}) => wh(x, w, h, { z: BZ, d: BD, lit: 0.55, teeth: 2, ...o });
const quay = (x = 0) => [['water', '', { x, z: 1.28, w: 0.92, d: 0.16 }], [FAN, 'wall-block', { sx: 0.92, sy: 0.04, sz: 0.03, x, z: 1.2 }]];
const HARBOUR = {
  back: [[whB(L, 0.44, 0.34), whB(Rx, 0.44, 0.4), ...quay()],
    [['containers', '', { x: L, z: 1.1, n: 2, high: 3, seed: 1 }], ['containers', '', { x: Rx, z: 1.1, n: 2, high: 2, seed: 3 }], ['crane', '', { x: 0, z: 1.1, h: 0.7, w: 0.5, boom: 0.4 }], ...quay()],
    [whB(L, 0.44, 0.4), [IND, 'detail-tank-large', { s: 0.2, x: 0.12, z: 1.08 }], [IND, 'detail-tank-large', { s: 0.2, x: 0.36, z: 1.08 }], ...quay()]],
  growth: [
    [bz('hshed', { x: -0.12, z: 0.2 }), ['bsale', '', { x: 0.2, z: 0.1 }]],                                                                    // 0: a tin shed and a FOR SALE board
    [bz('hhut', { x: 0, z: 0.12 })],                                                                                                         // 1: the fisherman's hut
    [bz('hwarehouse', { x: 0, z: 0.1 }), sgn('FISH', 0, 0.255, 0.2, { tone: 'amber', calm: 0.4, z: 0.086 })],                                  // 2: the brick warehouse
    [bz('hfactory', { x: 0, z: 0.06 }), ['hchimney', '', { x: 0.3, z: 0.62, smoke: true }], sgn('CANNERY', 0, 0.27, 0.3, { tone: 'amber', calm: 0.4, z: 0.046 })],   // 3: the factory
    [bz('hcustoms', { x: 0, z: 0.22 }), sgn('CUSTOMS', 0, 0.45, 0.36, { tone: 'gold', calm: 0.3, z: 0.19 })],                                  // 4: the customs house
  ],
};

// ---- green / canal (now art deco): stepped limestone office blocks, brass lobbies, a spire on the biggest
// deco(x, w, tiers [[floors]…], o): each tier steps in, the first has the lobby; returns the placements and the top y
const decoTier = (x, y, w, z, d, h, o) => bld('deco', { x, y, w, z, d, h, roof: 'flat', roofMat: 'limestone', parapet: false, ...o });
const deco = (x, w, tiers, o = {}) => {
  const out = []; let y = 0, ww = w, z = o.z ?? 0.01, d = o.d ?? 0.8;
  const step = d < 0.5 ? 0.03 : 0.06;
  tiers.forEach(([fl], k) => {
    const h = (k === 0 ? 0.26 : 0) + fl * 0.17;
    out.push(decoTier(x, y, ww, z, d, h, { ground: k === 0 ? 'lobby' : null, cornice: k === 0, ...o, z, d }));
    y += h; ww = Math.max(0.12, ww - 0.08); z += step; d -= step * 1.6;
  });
  out.top = y; out.zc = z + d / 2; out.ww = ww;
  return out;
};
const spireOn = (t, x, w, h = 0.5) => ['spire', '', { x, y: t.top, z: t.zc, w, h }];
const decoCanopy = (x, w = 0.24) => ['canopy', '', { x, y: 0.06, w, d: 0.1 }];
const DECO_BACK = (x, tiers, w = 0.44) => deco(x, w, tiers, { z: BZ, d: BD, lit: 0.55 });
const D4 = deco(0, 0.56, [[4], [3], [3], [2]], { lit: 1 });
const CANAL = {
  back: [[...DECO_BACK(L, [[3]]), ...DECO_BACK(Rx, [[2], [1]])], [...DECO_BACK(L, [[2], [2]]), ...DECO_BACK(Rx, [[3]])], [...DECO_BACK(L, [[3]]), ...DECO_BACK(Rx, [[2], [2]])]],
  growth: [
    [bz('cnews', { x: -0.12, z: 0.2 }), ['bsale', '', { x: 0.2, z: 0.1 }]],                                                                   // 0: a newsstand and a FOR SALE board
    [bz('cbranch', { x: 0, z: 0.12 }), sgn('BANK', 0, 0.305, 0.18, { tone: 'gold', calm: 0.3, z: 0.106 })],                                    // 1: the bank branch
    [bz('coffice', { x: 0, z: 0.1 }), sgn('TRUST', 0, 0.305, 0.2, { tone: 'gold', calm: 0.3, z: 0.086 })],                                     // 2: the office block
    [bz('ctower', { x: 0, z: 0.06 }), sgn('EXCHANGE', 0, 0.305, 0.3, { tone: 'gold', calm: 0.3, z: 0.046 })],                                  // 3: the office tower
    [bz('cskyscraper', { x: 0, z: 0.22 }), sgn('BANK', 0, 0.47, 0.34, { tone: 'gold', calm: 0.3, z: 0.19 })],                                  // 4: the skyscraper
  ],
};

// ---- darkblue / luxe: white marble towers and grand hotels, gold trim, canopies
const mb = (x, w, n, o = {}) => bld('marble', { x, w, d: 0.8, h: 0.27 + n * 0.19, ground: 'lobby', roof: 'flat', roofMat: 'marble', parapetMat: 'marble', parapetH: 0.04, cornice: true, corniceMat: 'gold', ...o });
const mbB = (x, n, w = 0.44, o = {}) => mb(x, w, n, { z: BZ, d: BD, lit: 0.55, ...o });
const mbCanopy = (x, w = 0.26) => ['canopy', '', { x, y: 0.07, w, d: 0.1, mat: 'gold' }];
const LUXE = {
  back: [[mbB(L, 2), mbB(Rx, 3)], [mbB(L, 3), mbB(Rx, 2)], [mbB(L, 2), mbB(Rx, 2)]],
  growth: [
    [bz('lbooth', { x: -0.12, z: 0.2 }), ['bsale', '', { x: 0.2, z: 0.1 }]],                                                                  // 0: a valet booth and a FOR SALE board
    [bz('lvilla', { x: 0, z: 0.12 })],                                                                                                       // 1: the boutique villa
    [bz('lhotel2', { x: 0, z: 0.1 }), vsgn([['HOTEL', 'gold']], 0.24, 0.45, 0.07, 0.26, 0.06)],                                                 // 2: the boutique hotel
    [bz('lhotel3', { x: 0, z: 0.06 }), ['roofsign', 'HOTEL', { x: 0, y: 1.22, z: 0.11, w: 0.4 }]],                                             // 3: the hotel tower
    [bz('lcasino', { x: 0, z: 0.22 }), sgn('CASINO', 0, 0.52, 0.36, { tone: 'gold', icon: 'marquee', calm: 0.4, z: 0.19 })],                   // 4: the casino palace
  ],
};

export const DISTRICTS = {
  london: {
    name: 'Old London', palette: 'london', road: 'cobble', lamp: 'gas',
    ground: '#38342f', pave: '#4d4944', side: '#1d1b19', accent: '#8fb7c9',
    back: LONDON.back, growth: LONDON.growth,
  },
  noir: {
    name: 'City', palette: 'noir', road: 'asphalt',
    ground: '#2a2826', side: '#1b1a18', accent: null,
    back: [backRow('building-g', 'building-h'), backRow('building-c', 'building-g'), backRow('building-h', 'building-d')],
    growth: [
      emptyLot,
      [[COM, 'building-d', { sx: 0.52, sy: 0.66, sz: 0.85, x: L, z: z0, glow: true }],
       [ROADS, 'construction-fence', { s: 1.7, x: Rx, z: 0.06, ry: Math.PI / 2 }], [ROADS, 'dumpster', { s: 0.9, x: Rx, z: 0.7 }]],
      [[COM, 'building-d', { sx: 0.52, sy: 0.66, sz: 0.85, x: L, z: z0, glow: true }],
       [COM, 'building-c', { sx: 0.5, sy: 0.7, sz: 0.8, x: Rx, z: z0, glow: true, smoke: true }]],
      [[COM, 'building-g', { sx: 0.5, sy: 0.72, sz: 0.85, x: L, z: z0, glow: true, smoke: true }],
       [COM, 'building-h', { sx: 0.5, sy: 0.8, sz: 0.85, x: Rx, z: z0, glow: true }]],
      [[COM, 'building-j', { sx: 0.23, sy: 0.75, sz: 0.6, x: L, z: z0 + 0.05, glow: true }],
       [COM, 'building-l', { sx: 0.34, sy: 0.78, sz: 0.62, x: Rx, z: z0 + 0.05, glow: true, smoke: true }],
       [IND, 'water-tower', { s: 0.12, x: L - 0.06, y: 1.35, z: 0.6 }]],
      [[COM, 'building-skyscraper-c', { sx: 0.68, sy: 0.62, sz: 0.6, x: 0, z: 0.42, glow: true }]],
    ],
  },
  // brown: skid row. Soot-black walk-up tenements, pawn shops, boarded fronts, bare bulbs
  bowery: {
    name: 'The Bowery', palette: 'bowery', road: 'worn', lamp: 'bare',
    ground: '#26231f', pave: '#2e2a27', side: '#1c1a18', accent: '#7a5a42',
    back: BOWERY.back, growth: BOWERY.growth,
  },
  // pink: pale Haussmann fronts, mansard roofs, café awnings and cabaret neon
  paris: {
    name: 'Paris', palette: 'paris', road: 'cobble', lamp: 'ornate',
    ground: '#4a443a', pave: '#6b6458', side: '#1f1d1b', accent: '#8a5568',
    back: PARIS.back, growth: PARIS.growth,
  },
  // orange: neon alleys. Thin towers crammed together under stacks of small vertical signs
  tokyo: {
    name: 'Tokyo', palette: 'tokyo', road: 'asphalt', lamp: 'pole',
    ground: '#2c3239', pave: '#3c444d', side: '#18181a', accent: '#8a5a30',
    back: TOKYO.back, growth: TOKYO.growth,
  },
  // red: a commercial street. Shop fronts under awnings, a chrome diner, a cinema marquee
  downtown: {
    name: 'Downtown', palette: 'downtown', road: 'asphalt', lamp: 'cobra',
    ground: '#35322f', pave: '#4a4745', side: '#1c1817', accent: '#8a3a36',
    back: DOWNTOWN.back, growth: DOWNTOWN.growth,
  },
  // yellow: the docks. Sawtooth warehouses, containers, cranes, black water, sodium-orange light
  harbour: {
    name: 'Harbour', palette: 'harbour', road: 'worn', lamp: 'mast', glowColor: '#ff9a3c',
    ground: '#272f2a', pave: '#323d37', side: '#171a18', accent: '#7f723a',
    back: HARBOUR.back, growth: HARBOUR.growth,
  },
  // green: art-deco business district. Stepped limestone blocks, vertical fins, brass-lit lobbies, a spire
  canal: {
    name: 'Art Deco', palette: 'canal', road: 'asphalt', lamp: 'deco', glowColor: '#ffc46a',
    ground: '#4d4638', pave: '#6e6451', side: '#191b18', accent: '#c9a24f',
    back: CANAL.back, growth: CANAL.growth,
  },
  // darkblue: white marble towers and grand hotels, gold trim, canopies
  luxe: {
    name: 'Grand Avenue', palette: 'luxe', road: 'asphalt', lamp: 'candle', glossy: true,
    ground: '#2b303c', pave: '#3a4152', side: '#121316', accent: '#2f4770',
    back: LUXE.back, growth: LUXE.growth,
  },
};
export const GROUP_DISTRICT = { lightblue: 'london', brown: 'bowery', pink: 'paris', orange: 'tokyo', red: 'downtown', yellow: 'harbour', green: 'canal', darkblue: 'luxe' };
Object.values(DISTRICTS).forEach(d => { if (d.glowColor) glowColors[d.palette] = d.glowColor; });
export const districtOf = sp => DISTRICTS[GROUP_DISTRICT[sp.group]] || (sp.type === 'property' ? DISTRICTS.noir : null);

// each place's own touch beside its buildings (Underworld names; other maps get the district look)
export const LANDMARKS = {
  whitechapel: [[FAN, 'cart', { s: 0.13, x: 0.38, z: -0.03, ry: 1.3 }]],           // a costermonger's barrow left out on the pavement
  seven_dials: [[FAN, 'pillar-stone', { s: 0.42, x: -0.42, z: -0.04 }]],           // the sundial pillar, on the pavement
  limehouse: [[BOAT, 'cargo-container-a', { s: 0.08, x: 0.38, z: 0.86, ry: 0.15 }],  // crates waiting on the wharf, behind the building
    [BOAT, 'cargo-container-c', { s: 0.08, x: 0.38, y: 0.09, z: 0.86, ry: 0.2 }]],
  // brown
  five_points: [[ROADS, 'dumpster', { s: 1, x: -0.36, z: -0.04, ry: 0.3 }], [ROADS, 'construction-barrier', { s: 2, x: 0.3, z: -0.05 }], ['lamp', '', { x: 0.4, z: 0.02 }]],
  the_bowery: [[ROADS, 'dumpster', { s: 1, x: 0.34, z: -0.04, ry: -0.2 }], ['sign', 'BAR', { w: 0.26, x: -0.3, y: 0.62, z: 0.93 }]],
  // pink
  pigalle: [['lamp', '', { x: -0.42, z: 0.03 }], [FAN, 'pillar-stone', { s: 0.4, x: 0.42, z: -0.05 }]],     // a stone post and a lamp (the old gantry sign hid the building)
  barbes: [[FAN, 'stall', { s: 0.3, x: 0.34, z: -0.07 }]],                        // a market stall left out
  rue_saint_denis: [['lamp', '', { x: -0.4, z: 0.03 }]],
  // orange
  kabukicho: [['sign', 'NEON', { w: 0.3, x: -0.3, y: 0.58, z: 0.93 }], ['sign', 'CLUB', { w: 0.3, x: 0.3, y: 0.44, z: 0.93 }]],
  roppongi: [['sign', 'CLUB', { w: 0.3, x: 0, y: 0.6, z: 0.93 }], ['sign', 'BAR', { w: 0.24, x: 0.32, y: 0.42, z: 0.93 }]],
  kamagasaki: [[ROADS, 'dumpster', { s: 1.1, x: 0.33, z: -0.05, ry: 0.4 }], ['sign', 'BAR', { w: 0.2, x: -0.32, y: 0.6, z: 0.93 }]],
  // red
  hells_kitchen: [[ROADS, 'dumpster', { s: 1, x: 0.36, z: -0.04, ry: 0.3 }], ['lamp', '', { x: -0.4, z: 0.03 }]],
  the_tenderloin: [['lamp', '', { x: -0.4, z: 0.03 }], [ROADS, 'construction-barrier', { s: 2, x: 0.32, z: -0.05 }]],
  the_levee: [[ROADS, 'dumpster', { s: 1, x: -0.34, z: -0.04, ry: -0.3 }], [ROADS, 'construction-barrier', { s: 2, x: 0.3, z: -0.05 }]],
  // yellow: a lot with no back row of its own gets its own back (open())
  kowloon_walled_city: open([                                                     // container city: four towers of stacked boxes
    ['containers', '', { x: -0.33, z: 1.15, n: 1, high: 6, seed: 1 }], ['containers', '', { x: -0.11, z: 1.15, n: 1, high: 5, seed: 2 }],
    ['containers', '', { x: 0.11, z: 1.15, n: 1, high: 7, seed: 3 }], ['containers', '', { x: 0.33, z: 1.15, n: 1, high: 5, seed: 4 }],
    [IND, 'detail-tank', { s: 0.14, x: 0.11, y: 0.66, z: 1.15 }]]),
  wan_chai: open([                                                                // the back of the lot is the harbour
    ['water', '', { x: 0, z: 1.18, w: 0.92, d: 0.4 }], [FAN, 'wall-block', { sx: 0.92, sy: 0.05, sz: 0.04, x: 0, z: 0.97 }],
    [BOAT, 'boat-tug-a', { s: 0.09, x: -0.1, z: 1.2, ry: Math.PI / 2, tint: 0.6 }], ['lamp', '', { x: 0.4, z: 0.93 }]]),
  el_raval: open([                                                                // a row of warehouses
    wh(-0.235, 0.44, 0.46, { z: BZ, d: BD, lit: 0.55, teeth: 2 }), wh(0.235, 0.44, 0.38, { z: BZ, d: BD, lit: 0.55, teeth: 2 }), ...quay()]),
  // green (art deco business district)
  reeperbahn: [['lamp', '', { x: -0.42, z: 0.03 }]],                                 // (the gantry sign hid the building)
  de_wallen: open([                                                               // the exchange: a tall stepped block with a spire beside a lower one
    ...deco(-0.25, 0.4, [[3]], { z: BZ, d: BD, lit: 0.6 }), ...deco(0.27, 0.34, [[2], [1]], { z: BZ, d: BD, lit: 0.6 })]),
  quartieri_spagnoli: [['lamp', '', { x: -0.4, z: -0.05 }], ['lamp', '', { x: 0.4, z: -0.05 }]],
  // darkblue
  monte_carlo: [['lamp', '', { x: -0.44, z: 0.03 }]],
  the_strip: [['lamp', '', { x: -0.44, z: 0.03 }], [FAN, 'pillar-stone', { s: 0.4, x: 0.42, z: -0.05 }]],
};
export const slugName = name => String(name).split(',')[0].normalize('NFD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_');

// special squares. Corner lots use the same coordinates, with x across the corner's open area.
// 'sign' entries become lit lettering (cityScene.js); 'lamp' a street lamp; 'booth' a phone box…
// a flat stone slab for the heavy civic pieces: centre x/z, floor y, size w × h × d (all dark, tint darkens further)
const slab = (x, y, z, w, h, d, tint = 0.5) => [FAN, 'wall-block', { sx: w, sy: h, sz: d, x, y, z, tint }];
// a wall panel with a window (or door) on a front face at z; faces the street (−z). w wide, h high, centre x, floor y
const panel = (name, x, y, w, h, zFront, o = {}) => [FAN, name, { sx: 0.3, sy: h, sz: w, x, y, z: zFront + 0.4 * 0.3, ry: Math.PI / 2, ...o }];

export const SPECIALS = {
  go: [                                                  // the city gate: two heavy stone piers, a lintel under the lit PAYDAY sign
    slab(0.12, 0, 0.55, 0.3, 0.1, 0.38), slab(0.88, 0, 0.55, 0.3, 0.1, 0.38),                 // plinths
    slab(0.12, 0.1, 0.55, 0.24, 0.85, 0.3, 0.42), slab(0.88, 0.1, 0.55, 0.24, 0.85, 0.3, 0.42),   // the piers
    slab(0.12, 0.95, 0.55, 0.3, 0.05, 0.34, 0.5), slab(0.88, 0.95, 0.55, 0.3, 0.05, 0.34, 0.5),   // pier caps
    slab(0.5, 0.95, 0.55, 0.8, 0.25, 0.3, 0.42), slab(0.5, 1.2, 0.55, 1.06, 0.05, 0.36, 0.5),     // lintel and its cornice
    [FAN, 'pillar-stone', { s: 0.14, x: 0.12, y: 1.25, z: 0.55, tint: 0.5 }], [FAN, 'pillar-stone', { s: 0.14, x: 0.88, y: 1.25, z: 0.55, tint: 0.5 }],
    ['sign', 'PAYDAY', { w: 0.62, x: 0.5, y: 1.075, z: 0.39 }], ['lamp', '', { x: 0.28, z: 0.08 }],
  ],
  jail: [                                                // a stone precinct jail behind a wall; the yard (x 0.1–0.7, z 0.2–0.55) stays open
    slab(0.65, 0, 1.0, 1.0, 0.66, 0.5, 0.4), slab(0.65, 0.66, 1.0, 1.06, 0.05, 0.56, 0.5),       // the cell block and its coping
    ['barred', '', { x: 0.65, y: 0.14, z: 0.745, cols: 5, rows: 3, dx: 0.15, dy: 0.17 }],
    slab(0.65, 0, 0.1, 1.2, 0.24, 0.05, 0.4), slab(0.04, 0, 0.62, 0.05, 0.28, 1.05, 0.4), slab(1.24, 0, 0.62, 0.05, 0.28, 1.05, 0.4),   // perimeter wall
    slab(1.1, 0, 0.8, 0.2, 1.0, 0.2, 0.4), slab(1.1, 1.0, 0.8, 0.32, 0.14, 0.32, 0.45),           // the guard tower: shaft, cabin
    panel('wall-window-small', 1.1, 1.0, 0.2, 0.14, 0.64, { glow: true }),                         // its one lit window
    [FAN, 'roof-flat', { sx: 0.36, sy: 1, sz: 0.36, x: 1.1, y: 1.14, z: 0.8, tint: 0.4 }], ['lamp', '', { x: 0.98, z: 0.55 }],
  ],
  taxi: [                                                // a 1960s cab depot: a dark garage with a lit TAXI sign and a checker band, two cabs out front
    slab(0.6, 0, 0.95, 0.96, 0.66, 0.55, 0.9), [FAN, 'roof-flat', { sx: 1.02, sy: 1, sz: 0.62, x: 0.6, y: 0.66, z: 0.95, tint: 0.6 }],
    slab(0.6, 0, 0.665, 0.46, 0.28, 0.02, 0.08), slab(0.6, 0.28, 0.66, 0.52, 0.03, 0.03, 0.45),        // the open bay, dark inside, and its lintel
    panel('wall-window-small', 0.6, 0.06, 0.24, 0.2, 0.655, { glow: true }),                           // a light left on in the bay
    panel('wall-window-small', 0.2, 0.38, 0.12, 0.16, 0.655, { glow: true }), panel('wall-window-small', 1.0, 0.38, 0.12, 0.16, 0.655, { glow: true }),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => slab(0.15 + k * 0.1, 0.31, 0.66, 0.1, 0.06, 0.02, k % 2 ? 1 : 0.1)),   // the checker band
    ['sign', 'TAXI', { w: 0.5, x: 0.6, y: 0.47, z: 0.64 }],
    [CAR, 'taxi', { s: 0.14, x: 0.2, z: 0.55, ry: Math.PI / 2 + 0.08, palette: null, tint: 0.8 }],
    [CAR, 'taxi', { s: 0.14, x: 1.02, z: 0.55, ry: -Math.PI / 2 - 0.1, palette: null, tint: 0.8 }],
    slab(0.1, 0, 0.62, 0.04, 0.05, 0.9, 0.5), ['lamp', '', { x: 1.1, z: 0.12 }], ['lamp', '', { x: 0.05, z: 0.12 }],
  ],
  gotojail: [                                            // the police station: stone, steps, blue globes; the squad car out front
    slab(0.6, 0, 0.95, 0.9, 0.7, 0.55, 0.45), [FAN, 'roof-flat', { sx: 0.96, sy: 1, sz: 0.62, x: 0.6, y: 0.7, z: 0.95, tint: 0.4 }],
    [FAN, 'stairs-stone', { sx: 0.26, sy: 0.12, sz: 0.5, x: 0.6, z: 0.6, ry: Math.PI, tint: 0.5 }], slab(0.6, 0.12, 0.67, 0.14, 0.2, 0.02, 0.12),   // steps, the door
    panel('wall-window-small', 0.33, 0.34, 0.14, 0.17, 0.67, { glow: true }), panel('wall-window-small', 0.87, 0.34, 0.14, 0.17, 0.67, { glow: true }),
    ['globe', '', { x: 0.41, z: 0.63 }], ['globe', '', { x: 0.79, z: 0.63 }],
    [CAR, 'police', { s: 0.14, x: 0.45, z: 0.24, ry: Math.PI / 2, palette: null }],
    ['sign', 'POLICE', { w: 0.42, x: 0.6, y: 0.6, z: 0.66, blue: true }], ['lamp', '', { x: 1.1, z: 0.12 }],
  ],
  chance: [                                              // a newspaper kiosk under a lit NEWS board, and a phone box
    slab(-0.12, 0, 0.55, 0.26, 0.28, 0.2, 0.4), slab(-0.12, 0.28, 0.55, 0.32, 0.03, 0.26, 0.5),
    slab(-0.12, 0.31, 0.58, 0.32, 0.12, 0.02, 0.25), ['sign', 'NEWS', { w: 0.3, x: -0.12, y: 0.37, z: 0.567 }],
    panel('wall-window-small', -0.12, 0.08, 0.14, 0.12, 0.445, { glow: true }),
    ['booth', '', { x: 0.3, z: 0.25 }],
  ],
  chest: [                                               // city hall: wide dark stone, a colonnade under a pediment, wide steps
    slab(0, 0, 0.78, 0.64, 0.78, 0.55, 0.42), slab(-0.33, 0, 0.78, 0.26, 0.55, 0.5, 0.42), slab(0.33, 0, 0.78, 0.26, 0.55, 0.5, 0.42),
    [FAN, 'roof-flat', { sx: 0.7, sy: 1, sz: 0.62, x: 0, y: 0.78, z: 0.78, tint: 0.4 }],
    [FAN, 'roof-flat', { sx: 0.3, sy: 1, sz: 0.58, x: -0.33, y: 0.55, z: 0.78, tint: 0.4 }], [FAN, 'roof-flat', { sx: 0.3, sy: 1, sz: 0.58, x: 0.33, y: 0.55, z: 0.78, tint: 0.4 }],
    slab(0, 0.16, 0.42, 0.7, 0.04, 0.34, 0.45),                                               // the portico floor
    ...[-0.275, -0.165, -0.055, 0.055, 0.165, 0.275].map(x => [FAN, 'pillar-stone', { s: 0.5, x, y: 0.2, z: 0.35, tint: 0.55 }]),
    slab(0, 0.7, 0.4, 0.72, 0.07, 0.26, 0.45),                                                // the entablature
    [FAN, 'roof-gable', { sx: 0.72 / 1.1, sy: 0.35, sz: 0.3 / 1.07, x: 0, y: 0.77, z: 0.4, tint: 0.5 }],     // the pediment
    [FAN, 'stairs-wide-stone', { sx: 0.7, sy: 0.16, sz: 0.3, x: 0, z: 0.17, ry: Math.PI }],
    panel('wall-window-small', -0.33, 0.2, 0.16, 0.2, 0.53, { glow: true }), panel('wall-window-small', 0.33, 0.2, 0.16, 0.2, 0.53, { glow: true }),
  ],
  tax: [                                                 // a cold government block: columns, a clock, a severe tower, all symmetrical
    [COM, 'building-n', { sx: 0.9 / DIM.n[0], sy: 0.85 / DIM.n[1], sz: 0.7 / DIM.n[2], x: 0, z: 0.65, glow: true }],
    [COM, 'building-skyscraper-e', { sx: 0.44 / DIM['skyscraper-e'][0], sy: 1.8 / DIM['skyscraper-e'][1], sz: 0.44 / DIM['skyscraper-e'][2], x: 0, y: 0.84, z: 0.72, glow: true }],
    ...[-0.3, -0.1, 0.1, 0.3].map(x => [FAN, 'pillar-stone', { s: 0.48, x, y: 0.05, z: 0.25, tint: 0.55 }]),
    slab(0, 0.53, 0.25, 0.8, 0.05, 0.14, 0.45), slab(0, 0, 0.3, 0.86, 0.05, 0.1, 0.45),
    [FAN, 'stairs-wide-stone', { sx: 0.6, sy: 0.1, sz: 0.2, x: 0, z: 0.1, ry: Math.PI }],
    ['clock', '', { x: 0, y: 0.7, z: 0.295 }],
  ],
  casino: [['casino', '', {}]],                          // the casino: neon board, canopy of bulbs, a roulette wheel on the forecourt (casino.js)
  railroad: [                                            // a night platform: canopy, track, a waiting carriage
    [TRAIN, 'railroad-rail-straight', { s: 0.3, x: 0.6, y: 0.3, z: 1.0, ry: -Math.PI / 2 }],   // the model's rails sit below its origin: lift them onto the ground
    [TRAIN, 'train-electric-city-a', { s: 0.26, x: 0, y: 0.03, z: 1.0, ry: Math.PI / 2, tint: 0.35 }],
    ['platform', '', { x: 0, z: 0.55 }], ['sign', 'STATION', { w: 0.5, x: 0, y: 0.5, z: 0.32 }],
  ],
  utility: [                                             // the works: a chimney stack, a brick hall, tanks
    [IND, 'building-a', { s: 0.36, x: -0.08, z: 0.85, glow: true }],
    [IND, 'chimney-large', { s: 0.4, x: 0.24, z: 0.9 }], [IND, 'chimney-medium', { s: 0.36, x: 0.24, y: 0.68, z: 0.9, smoke: true }],
    [IND, 'detail-tank-large', { s: 0.2, x: -0.28, z: 0.36, ry: 0.2 }], [IND, 'detail-tank-large', { s: 0.2, x: 0.05, z: 0.36, ry: -0.1 }],
    slab(-0.08, 0, 0.5, 0.6, 0.03, 0.03, 0.3),
  ],
};
// named special squares (the Underworld map's waterworks): a water tower over a low pump house
LANDMARKS.city_waterworks = [
  [IND, 'water-tower', { s: 0.36, x: 0.05, z: 1.0 }],
  [IND, 'building-b', { s: 0.36, x: -0.02, z: 0.55, glow: true }],
  [IND, 'detail-tank-large', { s: 0.2, x: -0.28, z: 0.2, ry: 0.15 }], [IND, 'detail-tank', { s: 0.28, x: 0.25, z: 0.22 }],
  ['lamp', '', { x: 0.38, z: 0.08 }],
];

// every model City Mode may place (preloaded before the first tile is built)
export function modelList() {
  const set = new Set();
  const add = arr => arr.forEach(([kit, name]) => { if (kit.includes('-')) set.add(kit + '|' + name); });
  Object.values(DISTRICTS).forEach(d => { d.growth.forEach(add); d.back.forEach(add); });
  Object.values(LANDMARKS).forEach(add);
  Object.values(SPECIALS).forEach(add);
  add([[FAN, 'fountain-round-detail'], [FAN, 'pillar-stone'], [ROADS, 'construction-fence'], [ROADS, 'construction-cone']]);
  return [...set].map(k => k.split('|'));
}

// build one placement list into a group; models take the district palette (police car excepted)
// road-kit and street props the palettes can't fully reach: dimmed to sit in the night
const NIGHT_DIM = { 'construction-fence': 0.3, 'construction-barrier': 0.3, 'construction-cone': 0.4, dumpster: 0.5, 'stairs-wide-stone': 0.5, 'wall-block': 0.7 };
const tintCache = new Map();           // one darkened copy per material and tint, so tinted pieces still merge
const tinted = (mat, tint) => {
  const key = mat.uuid + '|' + tint;
  if (!tintCache.has(key)) { const c = mat.clone(); c.color.multiplyScalar(tint); tintCache.set(key, c); }
  return tintCache.get(key);
};
export function placeAll(list, { palette, glowKey, extras } = {}) {
  const g = new THREE.Group();
  const chimneys = [];
  let tallest = null;                                  // the highest code-built roof: where the owner's cornice line goes
  list.forEach(([kit, name, o = {}], k) => {
    const glow = o.glow ? `${glowKey}_${k % 2}` : null;     // windows share two light groups per lot: few draw calls, still switching on in steps
    if (!kit.includes('-')) {                           // code-built pieces: building, sign, lamp, booth…
      if (!extras) return;
      const obj = extras(kit, name, o, glow);
      g.add(obj);
      if (o.smoke) chimneys.push(obj);                  // a code-built chimney that smokes (harbour)
      const r = obj.userData.roof;
      if (r && (!tallest || r.top > tallest.top)) tallest = r;
      return;
    }
    const pal = o.palette !== undefined ? o.palette : palette;
    const obj = make(kit, name, { ...o, palette: pal, glow });
    if (o.sx) obj.scale.set(o.sx, o.sy || o.sx, o.sz || o.sx);
    const tint = o.tint || NIGHT_DIM[name];
    if (tint) obj.traverse(m => { if (m.isMesh) m.material = tinted(m.material, tint); });   // a piece still too pale for the night
    if (o.smoke) chimneys.push(obj);
    g.add(obj);
  });
  g.userData.chimneys = chimneys;
  g.userData.tallest = tallest;
  return g;
}
