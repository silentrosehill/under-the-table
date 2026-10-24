# Patch notes

<!-- Data for the in-game "What's new" page lives in public/patchnotes.json.
Schema: [{ version, date (YYYY-MM-DD), title, highlights: string[],
changes: { added: string[], changed: string[], fixed: string[] } }], newest first.
Keep this file and the JSON in sync. -->

## 1.3.0 · Daylight (2026-10-25)

- New Lighting setting: play by night or on a sunny afternoon.

### Added

- Lighting: Night / Day in Settings → Display. Day lets sunlight in through a window: the frame's shadow falls across the table, with light shafts and floating dust.
- In City Mode by day, lit windows, street lamps and neon fade down and the streets dry.
- Daytime ambience: the rain gives way to a soft street murmur.

### Changed

- Colour grading adapts to the time of day (warmer, brighter whites by day).

## 1.2.0 · Noir pieces (2026-10-23)

- New die-cast pewter pieces: 1950s sedan, fedora, pocket watch and briefcase.
- Deep, muted player colours: dark red, blue, green and purple.
- The announcer waits until things actually happen, and tile names stand out.

### Added

- Announcer position setting (Top or Bottom) in Settings → Info.
- Tile names are highlighted in the announcer and the event log, in their district's colour.

### Changed

- Tokens replaced with noir die-cast metal pieces with a coloured enamel detail.
- Player colours are now deep dark red, blue, green and purple; names use a lighter tint so they stay readable.
- Team colours toned down to match.
- Announcer and event log lines only appear once what they describe is visible: after the token arrives, the card flips or the wheel stops.
- Every window you interact with (prompts, pickers) now opens in the centre of the screen.
- The GitHub repository is now silentrosehill/under-the-table; the app checks for updates there.

### Fixed

- Results no longer show in the announcer or log before the card or wheel reveals them.

## 1.1.0 · Under The Table (2026-10-23)

- The game is now called Under The Table.
- Event animations, a centre announcer and a better-looking board.
- Choose your own Mafia loan terms.
- Much faster and lighter: far fewer draw calls, smaller server updates, about 15 bug fixes.
- The desktop app can now check for updates.

### Added

- Event animations: casino spins, global wheel results, cards and rent now play out on the board.
- Centre announcer that tells you what just happened. Choose Less, Normal or More in the settings.
- Hover highlight and an info bubble on any tile, with reliable tile picking in both views.
- Player-chosen Mafia loan terms: when you go broke you pick the amount, the number of turns and the interest within the host limits.
- Global wheel is now a 3D wheel that spins on the table.
- Road tiles in City Mode, with name plates and rent painted directly on the road.
- Desktop app: Check for updates button, a quiet daily check at launch, and the current version shown in the launcher.
- Recorded sound effects for every card and event (explosions, sirens, cell doors, a billionaire's laugh, cash registers and more).
- Game speed setting in the lobby: Relaxed (default), Normal or Fast.
- Top-down camera: a high diagonal view of the whole board.
- New settings panel (gear button) with Display, Sound, Info and More tabs, plus a What's new page.
- Custom icon set replacing emoji across the HUD and the casino wheel.
- Check for updates button in the desktop app.
- Player names appear when hovering a token.

### Changed

- Renamed from Monopoly Party to Under The Table (app, window titles and docs).
- Bigger board with more room between the tiles.
- Taxi is now mandatory when you land on a taxi square.
- Casino events now affect only the player who landed there.
- Performance pass: about 70 to 80% fewer draw calls, cached shadows and a fixed memory leak, so long games stay smooth.
- Server efficiency: game updates are about 12 times smaller, which helps online play on slow connections.
- Four new tokens (car, top hat, Scottie dog, whiskey glass), bigger and painted in the player's colour.
- Solid, clearer HUD, announcer and event log; each can be turned off.
- Squatters can only be evicted after one full turn, and evicting costs 50% of the tile's value.
- Station rents doubled ($50K–$400K) and utility rents doubled (dice × $8K / × $20K).

### Fixed

- About 15 bugs fixed across turns, events, rent and the 3D views, including tiles that were hard to click.
- Text-size slider no longer jumps while dragging.
- macOS: the app is now self-signed, so it no longer shows as "damaged" (see install steps).
- The announcer no longer shows behind the casino wheel.

## 1.0.1 · Privacy and packaging (2026-10-21)

- Fonts are bundled, so the game makes no requests to Google Fonts.
- Stricter privacy defaults for hosted games.

### Added

- Custom gold-and-burgundy dice icon for macOS and Windows.
- PRIVACY.md and a desktop guide (DESKTOP.md) with hosting details.

### Changed

- Player reconnection tokens are sent in headers instead of the address.
- API responses are no longer cached and referrers are suppressed.
- Stricter static-file boundaries on the built-in server.
- Published source no longer includes local settings, logs, screenshots or raw asset downloads.

## 1.0.0 · Desktop Edition (2026-10-21)

- First desktop release for macOS Apple Silicon and Windows x64.
- Host on Wi-Fi or online with an invite link; friends join from the app or any browser.
- Two ways to see the same game: the back-room table or a miniature noir city.

### Added

- Property game for 2 to 4 players with bots, online or on the same Wi-Fi, no accounts needed.
- Table Mode and City Mode, each with its own look and sound. Each player picks their own view.
- Property levels from L1 to Max with district rents, buyouts and set bonuses.
- Casino squares with event spins, plus a hand of attack and counter cards.
- 2v2 team mode with adjustable rent sharing.
- Eight districts, each with its own buildings, street lamps and pavement.
- Global wheel that triggers a random city event every few rounds.
- Optional Mafia loan when you cannot pay a debt.
- Money shown in the $60K / $1.2M style; the host can set the starting cash.
- English and French.
- Bundled server, graphics, physics, fonts and Cloudflare tunnel, so players need no extra install.
