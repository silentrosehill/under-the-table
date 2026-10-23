# Under The Table: privacy and hosting

## What is published

The repository and desktop releases contain game code, bundled public game assets, third-party libraries, and their credits/licenses. They do not include developer logs, assistant settings, browser profiles, local game sessions, screenshots, signing keys, or downloaded source-asset archives. Git commits use a GitHub no-reply email address.

A pre-release scan checked the selected source/assets for common credential formats, private keys, personal filesystem paths, and private IP literals. Matches in third-party code were reviewed. The packaged app payloads were checked against the reviewed source. This is a targeted review, not a guarantee against every possible vulnerability.

## While playing

- Your chosen player name, chat, and game actions are shared with the host and other viewers of that game. Use a nickname and avoid private information in chat.
- Anyone with a working game link can view the game and chat, and may join while seats are available. There is no password-protected lobby. The link is not an authentication boundary.
- Game state and chat live in the server's memory and end when the host stops it. The app stores preferences and a player reconnection token in its browser profile on that player's computer.
- Updated clients send reconnection tokens in request headers instead of URLs. They are not included in other players' public game state. Older clients using query tokens remain compatible; hosts/proxies should avoid retaining full request URLs.
- Fonts, graphics libraries, and game assets are served by the game host; there are no Google Fonts or analytics requests in the game code.
- **Host on Wi-Fi** listens on the host's network interfaces so other devices can connect. Wi-Fi HTTP traffic is not encrypted; use a trusted network.
- **Host online** explicitly starts a Cloudflare Quick Tunnel. Cloudflare handles that traffic, sees connection metadata, and terminates HTTPS. The public link normally hides the host's home IP from guests, but Cloudflare necessarily receives the host connection. Closing the hosted game stops its tunnel.
- The desktop renderer is sandboxed, with Node access disabled and context isolation enabled. Hosting controls are exposed only to the packaged local launcher.

The repository is public. The game is intended for small groups of trusted friends, not as a hardened public multiplayer service.
