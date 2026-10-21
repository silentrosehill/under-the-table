# 🎲 Monopoly Party

Desktop apps for **macOS Apple Silicon** and **Windows x64** are available on the [Releases page](https://github.com/silentrosehill/monopoly-party/releases). Extract the download and open the app; no Node.js installation is needed. See [Desktop guide](DESKTOP.md) and [Privacy and hosting](PRIVACY.md).

Monopoly in the browser for 2–4 friends. One person hosts it on their computer, and everyone else plays from a browser, either from their own home or on the same Wi‑Fi.

## Playing from home (online)

Do this once on the host's Mac to install Cloudflare's free tunnel tool:

```bash
brew install cloudflared
```

To host a game:

```bash
cd ~/Desktop/monopoly-party
node server.js --online
```

After a few seconds the terminal shows a link like `https://some-random-words.trycloudflare.com`. Send it to your friends. The link also appears in the lobby with a Copy button. Things to know:

- You don't need an account or router settings, and it's free.
- You get a new link every time you restart the server.
- The host's computer must stay on and awake for the whole game.
- Anyone who has the link can join until the game has 4 players, so only share it with your friends.

## Playing on the same Wi‑Fi

```bash
node server.js
```

Send your friends the `Friends on Wi-Fi:` address it prints.

The first person to join is the host: they pick the map and rules, then press **Start**. On macOS, choose **Allow** if it asks whether Node may accept incoming connections. To use another port, run `PORT=8080 node server.js`.

## What's in it

- **A 3D board** you can spin and zoom:
  - drag to rotate, scroll or pinch to zoom, right-drag to pan
  - 🎥 turns on "follow the active player", 🧭 resets the view
- **Animation everywhere:**
  - 3D dice you throw, which tumble differently every roll
  - tokens that hop tile by tile and fly to jail
  - houses and hotels that pop up, plus confetti, floating money amounts, flip cards and sound effects (🔇 mutes them)
- **Truly random:**
  - the dice use a cryptographically random number generator
  - the default map, **🎲 Mystery Mix**, makes a new board every game, with shuffled names from every world, group prices nudged up or down, a random currency and a random skin
- **🤝 2v2 Teams mode:**
  - pick your team (☀️ Sun or 🌙 Moon) in the lobby, or let the host shuffle
  - send your teammate money at any time with **💸 Send**
  - the host sets the **transfer fee** with a slider (0–50%, default 15%: sending 100,000 delivers 85,000)
  - the host also chooses whether teammates pay full, half or no rent on each other's properties
  - a team wins when both opponents are bankrupt
- **🤖 Bots** fill empty seats, so you can play 2v2 with fewer than 4 friends. They buy, build, trade, help their teammate, and react with emoji.
- **🌪️ Chaos events:** random twists at the start of some rounds:
  - Payday, Golden GO, Rent Boom, Market Crash
  - Lottery, Tax Day, Storm, Lucky Doubles
- **😀 Emoji reactions** that pop up above your token
- **Game length:** play until bankruptcy, or for 20, 30 or 50 rounds (the default is 50). When the limit is reached, the highest net worth wins.
- **Results podium** with net worth and awards (Landlord, Shopaholic, Lucky roller, Jailbird, Best teammate)
- **4 more maps:** Classic City, World Tour, Galaxy Empire, Sugar Rush
- **5 skins**, each with its own 3D scenery, picked by each player in the top-right corner:
  - Classic (forest)
  - Neon Night (glowing crystals)
  - Retro Wood (desert)
  - Ocean (palm islands)
  - Candy (lollipops)
- **8 tokens** (🚗 🎩 🐕 🚢 🦖 🚀 🐈 👑) and 8 colors. Each player has their own.
- **Rules:** buying property, rent (double rent for a full color set), railroads, utilities, taxes, Chance and Community Chest (16 cards each), jail (doubles, $50 fine, Get Out Free cards, 3 doubles in a row sends you to jail), even building of houses and hotels, selling buildings, mortgages, trading cash and properties, bankruptcy, and a winner screen
- **Optional:** a Taxi Company jackpot, plus a choice of starting cash
- Chat and a game log (💬). On a computer, the space bar rolls or ends your turn. If you refresh the page, you rejoin automatically.

The 3D engine and physics libraries are served locally from `public/vendor`. Run `npm run prepare:desktop` after installing dependencies to prepare them. Online invite links require internet access; Wi-Fi play does not.

For the macOS Apple Silicon and Windows x64 apps, hosting/joining instructions, and desktop builds, see [DESKTOP.md](DESKTOP.md).

Not included: auctions (passing on a property leaves it unowned) and the bank's limit on houses.
