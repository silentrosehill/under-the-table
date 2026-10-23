# Gameplay & UI update — approved plan

Status: all 7 steps done (2026-10-19). Balance: `node tools/sim.cjs` — bot games last ~31–37 rounds, first bankruptcy around round 14–20, 13–28% reach the 50-round cap.

All amounts are shown the Business Tour way: `$60K`, `$1.2M`.

## 0. Upgrade button bug — cause

The "Build" button in the property drawer (`public/app.js` ~line 883) is disabled unless you own the **whole colour set** (classic Monopoly rule, `server.js` `build()`), and the only reason given is a hover tooltip, which you never see on touch or in the noir button style. Even with the set it can still fail silently on the server (mortgaged tile in the set, "build evenly"). So it isn't broken code; it's a hidden rule. The new level system below removes the set requirement, and every disabled upgrade will show its reason as text under the button.

## 1. Economy (×1000 of today, start bumped)

| Item | Now | Proposed |
|---|---|---|
| Starting cash | 1,500 | **$2M** (host can set $1M–$5M) |
| Passing Payday (GO) | 200 | **$200K** (Golden GO event: $400K) |
| Jail fine | 50 | **$50K** |
| Taxes (Protection Money / The Vig) | 200 / 100 | **$200K / $100K** |
| Stations | 200; rent 25/50/100/200 | **$200K**; rent **$25K/50K/100K/200K** by number owned |
| Utilities | 150; 4×/10× dice | **$150K**; rent **dice × $4K / $10K** |
| Mortgage | half price | half price (unchanged) |
| Existing round events (Payday, Lottery…) | 100/250/50 | **$100K / $250K / $50K** |

### Property levels (price → each level's rent)

Buying a tile = level 1. Each further level costs the group's upgrade cost. Rents reuse the classic tables (L1 = classic "1 house" … Max = classic "hotel"), ×1000. Ranges cover the 2–3 tiles of each set.

| Group | Price | Upgrade / level | L1 | L2 | L3 | L4 | Max |
|---|---|---|---|---|---|---|---|
| Brown | 60K | 50K | 10–20K | 30–60K | 90–180K | 160–320K | 250–450K |
| Light blue | 100–120K | 50K | 30–40K | 90–100K | 270–300K | 400–450K | 550–600K |
| Pink | 140–160K | 100K | 50–60K | 150–180K | 450–500K | 625–700K | 750–900K |
| Orange | 180–200K | 100K | 70–80K | 200–220K | 550–600K | 750–800K | 950K–1M |
| Red | 220–240K | 150K | 90–100K | 250–300K | 700–750K | 875–925K | 1.05–1.1M |
| Yellow | 260–280K | 150K | 110–120K | 330–360K | 800–850K | 975K–1.03M | 1.15–1.2M |
| Green | 300–320K | 200K | 130–150K | 390–450K | 0.9–1M | 1.1–1.2M | 1.28–1.4M |
| Dark blue | 350–400K | 200K | 175–200K | 500–600K | 1.1–1.4M | 1.3–1.7M | 1.5–2M |

**New rules this needs (game logic — please confirm):**
- **No colour-set requirement to upgrade.** Owning the whole set gives **rent ×1.5** at every level (instead of ×2 on bare land only).
- **When you can upgrade:** when buying (straight to L1, L2 or L3 if affordable) and whenever you **land on your own tile** (any jump up to L4). **Max** is only reachable from L4, on a later landing. Total cost shown before confirming.
- **Buyout (new):** after paying rent on an enemy tile below Max, you may buy it for **2× its total value** (price + upgrades), paid to the owner. Max tiles can't be bought out. Teammates can't buy each other out.
- Selling a level refunds half its cost (as today). Table Mode shows L1–L4 as 0–3 houses and Max as the hotel.
- **Game length:** upgrades now only happen on landing, so growth is slower early but rents bite harder later. Keep the 50-round cap. I'll run 20 bot-only games and report average length and bankruptcies before finalising.

## 2. Casino (replaces Tip-Off at squares 22 and 36; Tip-Off at 7 stays)

The board has 3 Tip-Off and 3 Under the Table squares, not 4 Tip-Off, so I propose turning 2 of the 3 Tip-Offs into casinos.

| Event | Chance | Values |
|---|---|---|
| Billionaire's Whim | 22.5% | random player gets +25% of their own cash (minimum $50K) |
| Police Investigation | 22.5% | random owned building: **no rent for 3 rounds** |
| Mayor's Favor | 22.5% | random owned building: **rent ×2 for 3 rounds** |
| Gang Turf | 22.5% | random district: **rent ×0.5 for 3 rounds** |
| Building Bombing | 5% | random owned building destroyed, back to unowned (works on Max) |
| Economic Boom | 5% | **every player gets $300K** |

## 3. Cards — X values

Attack and counter cards go **into your hand** (max 3) and are played on your own turn from a new hand tray; the others resolve immediately. Classic cards stay in the decks, scaled ×1000, so the new cards appear about one draw in two.

| Card | Values |
|---|---|
| Hire a Gang | costs a random **$150K–$400K** (shown before you confirm), destroys **1–3 levels** (random) on an enemy tile below Max |
| Send the Squatters | enemy tile pays **no rent for 3 rounds**, or until the owner evicts them |
| Eviction (any squatters) | owner pays **25% of the tile's price + upgrades** on their turn to evict now |
| Police Protection | hidden on one of your tiles until triggered. On a Gang attack, the gang's levels are not destroyed and a shootout runs: **50% rent ×1.5** or **50% rent ×0.5**, both **for 5 rounds** |
| Squatters Move In | one of your tiles at random: no rent for **3 rounds** or until evicted |
| Crime Wave | one district (**10% chance: whole city**): your rents there **×0.6**. Fades after **3 rounds**; or pay police **$100K per affected tile** to clear it now. Paying puts you **under audit for 5 rounds**: each time you pass Payday, 30% chance to pay **10% of your cash** |
| Shady Billionaire | **+$300K**, or **+$600K** if you evicted squatters in your last 3 turns |
| Mayor's Gift | one of your tiles: **rent ×3 until your next turn** ("current turn" would never trigger, since nobody lands on your tiles during your own turn) |

## 4. 2v2 rent sharing

Each team gets a slider, **0–100% in 10% steps, default 0%**, which either teammate can change on their turn. Enemy rent on either teammate's tile is split owner/mate, and the turn card shows the split, e.g. "Rent $300K → Ana $210K · Ben $90K". The existing "teammate lands on mate's tile" setting stays as is.

## 5. Districts — one archetype each, tells apart at a glance

| Group | Board names | Style |
|---|---|---|
| Brown | Five Points, Bowery | **Tenements & pawn shops**: soot-black walk-ups, PAWN / LOANS signs, boarded fronts |
| Light blue | Whitechapel, Seven Dials, Limehouse | **Brick rowhouses**: red-brown terraces, chimneys, stoops |
| Pink | Pigalle, Barbès, Saint-Denis | **Cabaret & nightlife**: Haussmann fronts, cabaret neon, café awnings |
| Orange | Kabukichō, Roppongi, Kamagasaki | **Neon alleys**: thin towers stacked with vertical signs |
| Red | Hell's Kitchen, Tenderloin, Levee | **Commercial street**: shops, diners, cinema marquee |
| Yellow | Kowloon, Wan Chai, El Raval | **Industrial / docks**: warehouses, cranes, containers, water |
| Green | Reeperbahn, De Wallen, Quartieri Spagnoli | **Art-deco business**: stepped limestone offices, brass-lit lobbies |
| Dark blue | Monte Carlo, The Strip | **Marble towers & grand hotels**: white stone, gold trim, casino signs |

Each district also gets its own street-lamp model and pavement colour, so it reads even from far away.

## 6. Levels in City Mode

- **L0 (unowned):** dark empty lot or a boarded, fenced shell, with no lit windows.
- **L1–L4:** each level adds and improves buildings (taller, more lit windows, signs).
- **Max:** same buildings as L4, plus a soft vertical light beam in the owner's colour (additive cone with a slow shimmer that fits the noir bloom).
- **Ownership:** owner colour on the label, a coloured band on the tile kerb, and an owner-colour trim strip on the buildings.

## 7. Card art & animation

- **Art:** original SVG illustrations I author by hand: flat ink silhouettes plus an "ink-wash" filter (turbulence and displacement, grain), monochrome with one type-colour accent. No external images, so CREDITS.md only gets a line saying they are original. This reads as stylised noir poster art, not painterly.
- **Animation:** deck → flip → slide to centre → effect (gold light or cold red light) → resolve.
- **Sound:** synthesised, one sting per card (cash register, brass hit, siren, glass, roulette tick…).

## 8. Plan

1. **Upgrade button:** reasons shown as text. [Opus] cause found. Fix lands with step 2.
2. **Economy, levels, multi-level buy, buyout:**
   - [Opus] data model (`st.level` 1–5 replaces houses), money formatting.
   - [Sonnet] server + bots + Table Mode mapping.
   - [Sonnet] bot-only balance runs.
   - [Opus] review numbers.
3. **Clarity:**
   - [Sonnet] permanent labels with price/rent/level, corner player panels with effects and turn highlight, event log, centred upgrade prompt.
   - [Opus] screenshot review.
4. **District styles:**
   - [Sonnet] retune the 8 districts and the level visuals (L0 abandoned → L4, Max beam, owner trim).
   - [Opus] screenshot review.
5. **Casino:**
   - [Sonnet] server events + timed-effect system.
   - [Sonnet] casino tile (neon, roulette).
   - [Opus] review.
6. **Cards:**
   - [Opus] card engine design (hand, targets, hidden counter).
   - [Sonnet] logic.
   - [Sonnet] SVG art + animation + sounds.
   - [Opus] art review.
   - [Haiku] CREDITS + i18n audit.
7. **2v2 rent split:** [Sonnet] slider + split display. [Opus] review.

Every step ends with screenshots checked for readability and the noir style. French translations are added as I go.
