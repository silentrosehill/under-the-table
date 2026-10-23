# Under The Table desktop

## Play

- **macOS Apple Silicon:** unzip the Mac download and move **Under The Table.app** to Applications. See "First launch on macOS" below for the first open.
- **Windows x64:** extract the entire ZIP into a folder and open **Under The Table.exe**. Keep the accompanying files beside the executable. See "First launch on Windows" below if SmartScreen appears.
- Pick **Host on Wi-Fi** for a local game, or **Host online** to generate a public invite link. The first person to take a seat controls the lobby. Add bots to play solo.
- Friends can paste the invite into **Join game**, or open it in any supported browser. Browser users do not need the app.
- While playing, use **Game → Show launcher / invite link** to copy the online link or see Wi-Fi addresses.
- Keep the host app and computer running. Closing the hosted game ends the session. The app asks before closing or quitting a live host.
- Online links use Cloudflare Quick Tunnels, require internet access, and change when you host again. Share only with intended players. A tunnel can take about 30 seconds to become reachable. If sharing fails, local play still works; return to the launcher and host online again.
- Allow incoming connections if the operating system asks and you want Wi-Fi players to connect.

## First launch on macOS

The app is signed ad hoc, not with an Apple Developer ID, so macOS asks you to confirm it the first time. It is safe to open if you downloaded it from this project's Releases page.

1. In Applications, right-click (or Control-click) **Under The Table.app** and choose **Open**, then click **Open** in the dialog. After that it opens normally.
2. If there is no Open button: try to open it once, then go to **System Settings → Privacy & Security**, scroll down to the message about "Under The Table" and click **Open Anyway**.
3. If macOS still says the app is damaged or cannot be opened, remove the download quarantine flag in Terminal, then open it again:

```
xattr -dr com.apple.quarantine "/Applications/Under The Table.app"
```

## First launch on Windows

Windows SmartScreen may show "Windows protected your PC" because the app is not code-signed. Click **More info**, then **Run anyway**. If you extracted the ZIP from the Downloads folder, right-click the ZIP before extracting, choose **Properties**, tick **Unblock** and click OK to avoid repeated prompts.

## Updates

The launcher shows the current version and has a **Check for updates** button. It also checks quietly at most once a day when the app starts. If a newer release exists on GitHub, the launcher shows its notes and a button that opens the release page in your browser; download it there and replace the old app. The only request made is to the public GitHub releases API, with no account and no personal data. Recent changes are listed in [PATCHNOTES.md](PATCHNOTES.md).

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

Build scripts target macOS arm64 and Windows x64. The preparation script copies pinned graphics libraries and downloads Cloudflared 2026.10.2 from its official GitHub release, verifying its SHA-256 hashes. Build output goes to `dist/`. The macOS build is ad-hoc signed by `tools/adhoc-sign.cjs` (an electron-builder `afterSign` hook, which also signs the bundled `cloudflared`). macOS builds should be made on macOS. Windows ZIP packaging can be performed on macOS; a Windows machine is still needed for Windows runtime testing.

## Distribution status

These are personal-use builds. The macOS app carries an ad-hoc signature (no Developer ID, not notarized), so Gatekeeper shows the usual "unidentified developer" prompt; the Windows build is unsigned, so SmartScreen may warn. Trusted public distribution requires Apple signing/notarization and Windows code signing using the publisher's credentials. No credentials are included.

The game renderer has no Node access; it runs sandboxed with context isolation. Only the local launcher exposes narrow hosting and joining controls. The local server runs in a separate utility process and shuts down with its host window.

Third-party software: Electron (MIT), Three.js (MIT), cannon-es (MIT), Cloudflared (Apache-2.0). Game-asset credits remain in CREDITS.md. Runtime license files and graphics-library licenses are included in the bundles.
