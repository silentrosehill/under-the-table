# Correction & new features — approved values (2026-10-19)

- Casino on squares 7, 22, 36 (all Tip-Off). Landing: 50% card from the casino deck (old Tip-Off deck), 50% event wheel.
  Wheel: Whim 20, Police 20, Mayor 20, Gang 20, One Too Many 10, Bombing 5, Boom 5.
- Bribe the Police: 2 in the casino deck, played at once, any opponent (not a teammate) to prison.
- One Too Many: next dice total halved, rounded down.
- Global wheel: Off / every 1–10 rounds, default 5. Events (equal weight): Squatters (1 random tile each, 3 rds), Police raids (1 random tile closed 2 rds), Mayor's Favor (best tile ×2, 2 rds), Gang Turf (own main district ×0.5, 2 rds), Crime Wave (main district ×0.6, 2 rds, no pay-off), Gang War (best non-Max tile −1 level), Whim (+10% cash, min $50K), Boom (+$200K), Tax Audit (−10% cash), One Too Many (next roll halved), Free protection (hidden on best tile). Never: prison / Bribe.
- Mafia loan (setting, default off): $1M (500K–3M), 5 turns (3–10), 30% total interest (10–100%). Offered only on bankruptcy; must cover the debt; 1 at a time, max 2 per game; repay any turn; deadline collects cash; note under the door 2 turns before. Unpaid → option A: mafia takes your best property and clears the debt; no property → eliminated.
- Board ~15% bigger; see-through 35% for buildings blocking the road/tokens.

## Building levels (same size everywhere, style per district)
| Level | Building | Footprint (of lot width) | Height |
|---|---|---|---|
| 0 | tiny shabby shack/kiosk/hut + FOR SALE sign | ~25% | ~1 low storey |
| 1 | small house | ~40% | 1–2 storeys |
| 2 | small building | ~60% | 2–3 floors |
| 3 | big building | ~85% | 5–6 floors, many lit windows |
| 4 | rich, imposing, detailed, lit entrance | ~90% | tallest, ornate |
| Max | level 4 + 4 corner spotlights beaming up in the owner colour | | |
- All 7 steps done (2026-10-20). TEMP-DEBUG hook removed. Test env hooks left in server.js (harmless when unset): CASINO_FORCE, CARD_FORCE, EVENT_FORCE, GLOBAL_FORCE, GLOBAL_EVERY, MAFIA_TEST, BOT_FAST.
