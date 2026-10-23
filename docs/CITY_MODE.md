# City Mode

A second way to look at the same game: the board as a miniature town. Table Mode (the back room) is unchanged.

## 1. How the two modes share one game

```
server.js (rules, turns, money, multiplayer)  ──poll──▶  app.js (state S, HUD, turn card, menus)
                                                              │
                                    one renderer at a time, same API
                                 ┌────────────────────┴────────────────────┐
                        scene3d.js (Table Mode)                  city/cityScene.js (City Mode)
                        board.js, props.js, room.js…             layout.js, districts.js, kit.js,
                                                                 bubbles.js, life.js
```

- Both renderers expose the same API: `setBoard`, `update(S)`, `whenIdle`, `isIdle`, `select`, `emote`, `gift`, `chaos`, `celebrate`, `setQuality`, `setFollow`, `resetView`, `destroy`.
- They only read the state; neither sends anything to the server. **No game logic was changed.**
- Each player picks their own view (top bar: View → Table / City), saved in their browser. Switching mid-game destroys one renderer and builds the other from the current state, so nothing is lost; friends can use different views in the same game.
- Moves are replayed from the server's recorded path (`S.moves`), the same way Table Mode does, so tokens drive the exact route the rules took.
- Shared pieces: the physics dice (`dice.js`), the post-processing chain (`post.js`, with a per-mode look), the sound engine (`sfx.js`, which swaps the room tone for outdoor ambience), and every HTML overlay (HUD, turn card, menus, translations).

## 2. Art bible (noir revision)

- **Setting:** the model city stands on the same worn table, in the same dark room, under the same hanging bulb as Table Mode, with the same props around it (money, chips, ashtray, whiskey, letter). It should feel like a detailed model city someone built and is playing on at night.
- **Tone:** serious, 1960s, film noir. Wet streets, soot-black brick, shadow, smoke. Nothing bouncy or cheerful.
- **Light:**
  - The bulb is the main light, falling off toward the corners.
  - The only bright points are practical lights: windows lit warm, cast-iron street lamps (four warm light pools follow the squares that wake up), lit signs (NEWS, STATION, POLICE, PAYDAY), the station clock, the phone box and the token car's headlights.
- **Palette:**
  - Charcoal, soot, dark brick `#5a3328`, slate `#25262a`, dirty stone `#6c6458`, brass `#7d6234`, oxblood `#5a2422`, navy `#2b3647`, dark glass `#262b33`.
  - District colours are a thin accent only: one line under the sign, the owner's trim along the back and their small plate by the door.
- **Streets:**
  - A 0.42 carriageway between two narrow pavements with kerbs.
  - Wet clearcoat, with dark asphalt and buried tram rails, or old setts in London.
  - Lamps on every other kerb and the occasional manhole cover.
  - Empty: the players' pieces are the only moving things.
- **Buildings:**
  - Two narrow plots per lot, tall and packed.
  - A permanent row of old buildings at the back of every lot, so the city is dense from the first turn.
  - Empty lot: a hoarding and a skip. Then one storefront, two, three storeys, a tenement with a water tower, and finally the grand building (a London tower with a spire).
  - Construction rises out of the ground with a low rumble and dust, never a bounce.
- **No nature:** no grass, no trees, no bushes. Ground is concrete, setts and gravel only.
- **Waking up:** windows light one after another, the lamp brightens and casts a pool on the wet street, the sign stutters on, steam rises from the manhole and smoke from the chimneys, a faint warm edge appears, and the square lifts 1 mm. It's slow in and slower out.
- **Labels:** a small dark enamel street sign with a brass border and uppercase Oswald, a thin line of the colour group, and price then owner and rent in typewriter type.
  - Dim (34 %) by default; hidden when the camera is far back unless they're relevant.
  - Clear (96 %) on hover or when someone is on the square. Fade only, no movement.
- **Tokens:** the Table Mode pewter pieces with their enamel band, a brass glow under the player whose turn it is, and two headlights plus a soft beam on the car. Moves are slow and heavy (380 ms per square).
- **Image:** Table Mode's rendering chain: soft shadows, AO, bloom on lights only, depth of field, grain, vignette, cold-shadow/warm-light grade. A "1960s broadcast" button (TV icon, in both modes) switches to near black-and-white with soft scanlines.
- **Camera:** slow, smoothed moves; no shake and no fast zoom.
- **Sound:** the room carries on (room tone, bulb hum, the record). On top come rain on the city, far-off traffic, a siren in the distance now and then, and per square: a radio behind a window plus a door closing, the water and a foghorn at the docks, steam and a bell at the station, machinery at the works.

## 3. What each square shows (Underworld map; other maps get the same districts by colour group)

| # | Square | Scene |
|---|---|---|
| 0 | Payday (Start) | City gate: stone gate with a lit PAYDAY sign |
| 1, 3 | Five Points, The Bowery (NY) | **Tenements & pawn shops (`bowery`):** soot-black 4–5 storey walk-ups, PAWN / LOANS / HOCK signs with the three-ball bracket, boarded shop fronts, fire escapes, bare-bulb lamps, cracked street |
| 2, 17, 33 | Under the Table | City hall with colonnade |
| 4 | Protection Money | Government building with a clock |
| 5, 15, 25, 35 | Gare du Nord, Grand Central, Shinjuku Station, King's Cross | Platform, canopy, track and a dark carriage with a STATION sign |
| 6, 8, 9 | Whitechapel, Seven Dials, Limehouse | **Brick rowhouses (`london`):** continuous red-brown terraces of identical narrow houses, chimney pots, front stoops, a corner PUB, gas lamps, York-stone pavement; Whitechapel barrow, the Seven Dials pillar, Limehouse crates |
| 7, 22, 36 | Tip-Off | NEWS kiosk and phone box |
| 10 | The Lock-Up | Stone jail with barred windows, wall and guard tower |
| 11, 13, 14 | Pigalle, Barbès, Rue Saint-Denis | **Cabaret & nightlife (`paris`):** pale Haussmann fronts with balconies and mansard roofs, café awnings, pink/red neon (CABARET, BAR, CAFE), ornate double-globe lamps, pale pavement; CABARET gantry at Pigalle |
| 12 | Power & Light Co. | Works with chimney and tanks |
| 16, 18, 19 | Kabukichō, Roppongi, Kamagasaki | **Neon alleys (`tokyo`):** six thin concrete towers crammed together, up to 24 storeys, stacks of small vertical neon signs hung over the street, utility-pole lamps, cold blue-grey ground; Kamagasaki is poorer |
| 20 | Safe House (Free Parking) | Dim empty lot under one lamp |
| 21, 23, 24 | Hell's Kitchen, Tenderloin, The Levee | **Commercial street (`downtown`):** 2–4 storey shop fronts with big windows and awnings, a chrome DINER, a CINEMA with a bulb-ringed marquee and blade sign, shop signs, cobra-head lamps |
| 26, 27, 29 | Kowloon Walled City, Wan Chai, El Raval | **Docks (`harbour`):** saw-tooth warehouses with sodium-orange windows, stacked shipping containers, a gantry crane, dark water at the quay, sodium floodlight masts, green-grey wet ground; Kowloon is a container city, Wan Chai has the tug, El Raval a row of warehouses |
| 28 | City Waterworks | Water tower and pump hall |
| 30 | Busted! (Go to Jail) | Police station with blue globe lamps and the only parked car |
| 31, 32, 34 | Reeperbahn, De Wallen, Quartieri Spagnoli | **Art-deco business district (`canal` key, formerly the canal quarter):** stepped limestone office blocks with set-backs and vertical fins, brass-lit lobbies and canopies, a brass spire on the biggest, cream pavement, globe lamps; BANK gantry at the Reeperbahn, De Wallen is the exchange tower with a spire |
| 37, 39 | Monte Carlo, The Strip | **Marble towers & grand hotels (`luxe`):** white marble with gold bands, brass canopies, gold candelabra lamps, dark polished pavement; CASINO and LUCKY gantries, a rooftop HOTEL sign on the grand hotel |
| 38 | The Vig | Government building with a clock |

**Property levels (city mode):** the lot shows `district.growth[n]`, with n = 0 when nobody owns the square and n = min(level, 4) when owned; Max (level 5) shows the level-4 street plus a beam.
- **0 Abandoned:** one or two low buildings that are boarded up, dimmer, with **no lit windows** (no glow key), a fence, rubble and a skip, in the district's own style (a burnt-out terrace, a derelict warehouse, a shuttered deco block).
- **1 to 4:** each level adds or raises a building (more storeys, more plots, more lit windows) and from level 3 the signs come on (pawn signs, pub, neon, cinema, crane, spire, HOTEL). Level 4 is the district's finest street.
- **Max:** a vertical beam of light in the owner's colour rises ~8 units from the lot (additive, no depth write, soft gradient bright at the base, slow shimmer, faint ground disc). One shared geometry, one small shader material per tile; it fades in after the build and out when the tile drops below Max, is mortgaged or loses its owner.

Each change shows a dust puff while the new block rises out of the ground (the owner's cornice line rises with it).

**How the districts are built (`public/city/`):** `archetypes.js` makes the code-built buildings (`['bld', style, {…}]` entries in `districts.js`): one atlas texture per style (facade tile, windows, ground-floor shop/door/pawn/cafe/lobby/garage strips) with a second emissive pass so the windows light through the usual glow keys, plus roofs (flat, gable, mansard, saw-tooth), crane, diner, containers, canopies, spires. Windows share two glow groups per lot and all trim/roofs are plain colours that bake into one vertex-colour mesh, so a lot is ~10 draw calls. Each district also sets `lamp` (its own street-lamp model in `cityScene.js`), `pave` and `ground` (its pavement and ground colour) and optionally `glowColor`. The owner's kerb band is one merged mesh; the cornice line sits on the front edge of the tallest code-built roof.

## 4. Assets

All CC0 from Kenney, kept as downloaded in `assets-src/` and copied to `public/assets/city/` by `tools/build-assets.mjs`. They're listed in CREDITS.md.

| Kit | Link | Size | Licence | Status |
|---|---|---|---|---|
| City Kit (Roads) | https://kenney.nl/assets/city-kit-roads | had it | CC0 | used |
| City Kit (Suburban) | https://kenney.nl/assets/city-kit-suburban | had it | CC0 | used |
| City Kit (Commercial) | https://kenney.nl/assets/city-kit-commercial | had it | CC0 | used |
| Car Kit | https://kenney.nl/assets/car-kit | had it | CC0 | used |
| Nature Kit | https://kenney.nl/assets/nature-kit | had it | CC0 | used |
| City Kit (Industrial) | https://kenney.nl/assets/city-kit-industrial | 4.8 MB | CC0 | downloaded, used |
| Train Kit | https://kenney.nl/assets/train-kit | 5.0 MB | CC0 | downloaded, used |
| Mini Characters (animated) | https://kenney.nl/assets/mini-characters | 2.3 MB | CC0 | downloaded, used |
| Watercraft Kit | https://kenney.nl/assets/watercraft-kit | 1.8 MB | CC0 | downloaded, used |
| Fantasy Town Kit | https://kenney.nl/assets/fantasy-town-kit | 3.7 MB | CC0 | downloaded, used |

- **Sound:** synthesized in the browser, like the rest of the game, so nothing to license. Freesound needs a login.
- **Possible later additions (not needed so far):** Quaternius *Ultimate Buildings* (CC0) for more varied facades, and KayKit *City Builder Bits* (CC0) for signs and props.

## 5. Stages

1. **Done:** structure, both modes switchable, road loop, raised squares, centre park and plaza dice, labels, ambient life system, vehicles driving the road with the camera following and framing the landing square, building growth, ownership flags, outdoor sound, the full **London** district.
2. **Done (all districts):** the seven other districts: palettes, growth ladders, each place's landmark, and dirt, bridge and canal roads. Shop signs ('shopsign'), fire escapes and cornices were added as code-built façade details.
3. **Done (special squares):** the special squares properly dressed: Start gate, prison with guard tower, police station, parking lot, stations with trains arriving, power plant, waterworks, tax offices, kiosks and town halls.
4. Life pass: trains, boats, blinking signs, more people and traffic, a sound for each place, and per-square detail levels.
5. Optional day/night cycle with street lights and windows, a lighter HUD skin for City Mode, then a performance and phone pass.

Each stage ends with screenshots and an honest critique before moving on.

## 6. Noir revision: what changed and an honest critique

**Changed:**
- **Setting and look:**
  - The city now stands in Table Mode's room, on its table, under its bulb, with its props.
  - The sky, sun, ground, fog, tilt-shift, bright grade and toy plinth are gone.
- **Streets:** narrow, wet and empty. No traffic, no pedestrians, no birds.
- **Buildings and lots:**
  - All district palettes are repainted dark, and windows are dark until they light up.
  - The packed back row is new, and growth uses narrow plots.
  - Nature is removed everywhere: the centre is now a paved square with a dark fountain, a column and lamps.
- **Special squares in the noir style:** a gate with a PAYDAY sign, a jail block behind a wall with bars and one lamp, an empty lot under one lamp, a police station with the only parked car, a NEWS kiosk and phone box, a city hall with columns, a tax office with a clock, a platform with a dark carriage and a STATION sign, and the works.
- **Interface:** labels are now enamel street signs; tokens are now the pewter pieces; the broadcast filter is new.
- **Sound and camera:** sounds for a city at night, and a slow camera.
- **Logic:** the game logic is untouched.

**Fully shown in the new style:** the London side (Gare du Nord, Whitechapel, Tip-Off, Seven Dials, Limehouse, The Lock-Up). The rest of the board already uses the same dark generic look, but not each district's own architecture.

**Honest critique:**
- **It belongs in the room:** close up, the London street (wet setts, a lamp's reflection, lit brick facades, the NEWS sign) feels like a frame from a noir show.
- **The overview is still a bit flat:** the large paved square in the middle takes a lot of space and is empty apart from the fountain and the dice.
- **Similar silhouettes:** the Kenney buildings are good but uniform. Real fire escapes, cornices and shop signs are still missing (no CC0 kit has them; they could be modelled in code).
- **The jail and the city hall** are still built from generic blocks.
- **Hard to read from the default camera:** the camera often frames the backs of buildings (the near side is seen from behind), which doesn't read well at the default distance.
- **Not measured:** the frame rate. The point lights are capped at four.

**District pass critique:**
- Every district now reads differently by silhouette (Tokyo slivers, canal gables, Paris cornice line, luxe towers).
- The default overview is dense but dark: far tiles sit in deep shadow by design.
- Kenney models still repeat across districts; jail barred windows only read up close.
- The police car and the station carriage are slightly paler than the rest.
- Frame rate still not measured on a mid-range laptop.
