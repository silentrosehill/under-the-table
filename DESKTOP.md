# Monopoly Party desktop

## Play

- **macOS Apple Silicon:** unzip the Mac download, move **Monopoly Party.app** to Applications, then open it.
- **Windows x64:** extract the entire ZIP into a folder and open **Monopoly Party.exe**. Keep the accompanying files beside the executable.
- Pick **Host on Wi-Fi** for a local game, or **Host online** to generate a public invite link. The first person to take a seat controls the lobby. Add bots to play solo.
- Friends can paste the invite into **Join game**, or open it in any supported browser. Browser users do not need the app.
- While playing, use **Game → Show launcher / invite link** to copy the online link or see Wi-Fi addresses.
- Keep the host app and computer running. Closing the hosted game ends the session. The app asks before closing or quitting a live host.
- Online links use Cloudflare Quick Tunnels, require internet access, and change when you host again. Share only with intended players. A tunnel can take about 30 seconds to become reachable. If sharing fails, local play still works; return to the launcher and host online again.
- Allow incoming connections if the operating system asks and you want Wi-Fi players to connect.

## Graphics

The desktop app uses hardware-accelerated Chromium/WebGL with the existing adaptive graphics settings. Three.js, physics, and game assets are bundled locally. No Node.js installation is needed on players' computers. Fonts are bundled locally, so gameplay makes no requests to Google Fonts.

The same 3D scenes run in the browser and desktop editions. Desktop packaging does not guarantee a frame-rate increase. Leave quality on Auto, or use Medium/Low on slower GPUs. Internet latency depends on the host connection and tunnel.

## Existing server

The original commands remain available:

```
npm start
npm run online
```

Standalone online hosting still uses a `cloudflared` executable on PATH. Desktop hosting uses the bundled, platform-specific executable. Desktop servers select a free port automatically, so they can coexist with the usual port-3000 server.

## Build from source

Install a current Node.js LTS and run:

```
npm ci
npm run prepare:desktop
npm run desktop
npm run build:mac
npm run build:windows
```

Build scripts target macOS arm64 and Windows x64. The preparation script copies pinned graphics libraries and downloads Cloudflared 2026.10.2 from its official GitHub release, verifying its SHA-256 hashes. Build output goes to `dist/`. macOS builds should be made on macOS. Windows ZIP packaging can be performed on macOS; a Windows machine is still needed for Windows runtime testing.

## Distribution status

These are personal-use builds, not signed/notarized releases. macOS Gatekeeper and Windows SmartScreen may warn or block them. Trusted public distribution requires Apple signing/notarization and Windows code signing using the publisher's credentials. No credentials are included.

The game renderer has no Node access; it runs sandboxed with context isolation. Only the local launcher exposes narrow hosting and joining controls. The local server runs in a separate utility process and shuts down with its host window.

Third-party software: Electron (MIT), Three.js (MIT), cannon-es (MIT), Cloudflared (Apache-2.0). Game-asset credits remain in CREDITS.md. Runtime license files and graphics-library licenses are included in the bundles.
