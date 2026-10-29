const { app, BrowserWindow, Menu, ipcMain, utilityProcess, dialog, clipboard } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const os = require('node:os');
const updates = require('./updates.cjs');
let launcher, game, server, tunnel, hostUrl, inviteUrl, quitting = false, starting = false;
const launcherFile = path.join(__dirname, 'launcher.html');
const launcherUrl = pathToFileURL(launcherFile).href;
const smoke = process.argv.includes('--smoke-test');
if (process.env.MONOPOLY_TEST_DATA) app.setPath('userData', process.env.MONOPOLY_TEST_DATA);
function status(message) { if (launcher && !launcher.isDestroyed()) launcher.webContents.send('status', { message, hostUrl, inviteUrl }); }
function stopHost() {
  if (tunnel) { tunnel.kill(); tunnel = null; }
  if (server) { server.kill(); server = null; }
  hostUrl = inviteUrl = null;
}
function secure(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // everything is refused except writing to the clipboard (the lobby's "Copy" invite button)
  const allow = permission => permission === 'clipboard-sanitized-write';
  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => callback(allow(permission)));
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => allow(permission));
  win.webContents.on('will-attach-webview', e => e.preventDefault());
}
function openGame(url) {
  game = new BrowserWindow({ width: 1440, height: 940, minWidth: 800, minHeight: 600, backgroundColor: '#17130e', title: 'Under The Table', icon: path.join(__dirname, 'icons/icon.png'), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  secure(game);
  const origin = new URL(url).origin;
  game.webContents.on('will-navigate', (e, target) => { if (new URL(target).origin !== origin) e.preventDefault(); });
  game.on('close', e => {
    if (server && !quitting && !smoke) {
      const choice = dialog.showMessageBoxSync(game, { type: 'question', buttons: ['Keep playing', 'End hosted game'], defaultId: 0, cancelId: 0, message: 'End this hosted game?', detail: 'Closing the game disconnects everyone, including browser players.' });
      if (choice === 0) e.preventDefault();
    }
  });
  game.on('closed', () => { game = null; stopHost(); if (!quitting) { launcher.show(); status('Ready to play.'); } });
  game.webContents.on('did-fail-load', (_e, code, description, _url, mainFrame) => {
    if (mainFrame && code !== -3) { launcher.show(); status(`Could not open game: ${description}. Check the address and that the host is running.`); }
  });
  game.loadURL(url).catch(error => status(error.message));
  if (!tunnel) launcher.hide();
}
function startServer() {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(path.join(__dirname, '..', 'server.js'), [], { env: { ...process.env, MONOPOLY_DESKTOP: '1', PORT: '0', SIM: '' }, stdio: 'pipe', serviceName: 'Under The Table Server' });
    server = child;
    const timeout = setTimeout(() => { child.kill(); reject(new Error('The local server did not start in time.')); }, 15000);
    child.stdout?.on('data', b => console.log(String(b).trim()));
    child.stderr?.on('data', b => console.error(String(b).trim()));
    child.once('message', message => { if (message.type === 'ready') { clearTimeout(timeout); hostUrl = `http://127.0.0.1:${message.port}`; resolve(message.port); } });
    child.once('exit', code => { clearTimeout(timeout); if (server === child) { server = null; status('The local server stopped. Return to the launcher to host again.'); } reject(new Error(`Server exited (${code}).`)); });
  });
}
function startTunnel(port) {
  const binary = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'desktop-resources', process.platform + '-' + process.arch), process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  const child = spawn(binary, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { windowsHide: true });
  tunnel = child;
  status('Opening an invite link… This can take about 30 seconds.');
  let tail = '';
  const read = chunk => {
    tail = (tail + String(chunk)).slice(-8000);
    const match = tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !inviteUrl) { inviteUrl = match[0]; server?.postMessage({ type: 'invite', url: inviteUrl }); status('Invite link ready. Keep this app open while friends play.'); }
  };
  child.stdout.on('data', read); child.stderr.on('data', read);
  child.on('error', err => status(`Online sharing could not start: ${err.message}. Local play still works.`));
  child.on('exit', () => { if (tunnel === child) { tunnel = null; inviteUrl = null; server?.postMessage({ type: 'invite', url: null }); status('Online sharing stopped. Local play still works. Close the game and host online again for a new link.'); } });
}
function trusted(event) { if (event.sender !== launcher.webContents || event.senderFrame.url !== launcherUrl) throw new Error('Unavailable outside the launcher.'); }
ipcMain.handle('host', async (event, online) => {
  trusted(event);
  if (starting || server || game) throw new Error('A game is already open.');
  starting = true;
  try { status('Starting your table…'); const port = await startServer(); if (online === true) startTunnel(port); openGame(hostUrl); status(online === true ? 'Opening an invite link…' : 'Local game ready. Friends on your Wi-Fi can join using an address below.'); return true; }
  catch (error) { stopHost(); throw error; } finally { starting = false; }
});
ipcMain.handle('join', (event, address) => {
  trusted(event); if (starting || game || server) throw new Error('A game is already open.');
  const url = new URL(String(address).trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter an http:// or https:// game link.');
  openGame(url.href); return true;
});
ipcMain.handle('app-version', event => { trusted(event); return app.getVersion(); });
ipcMain.handle('check-update', (event, force) => { trusted(event); return updates.check(force === true); });
ipcMain.handle('open-release', event => { trusted(event); return updates.openRelease(); });
ipcMain.handle('copy-invite', event => { trusted(event); if (inviteUrl) clipboard.writeText(inviteUrl); return !!inviteUrl; });
ipcMain.handle('addresses', event => { trusted(event); if (!hostUrl) return []; const port = new URL(hostUrl).port; return Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${port}`); });
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { (game || launcher)?.show(); (game || launcher)?.focus(); });
  app.whenReady().then(async () => {
    launcher = new BrowserWindow({ width: 760, height: 780, minWidth: 640, minHeight: 680, backgroundColor: '#17130e', title: 'Under The Table', icon: path.join(__dirname, 'icons/icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    secure(launcher);
    launcher.webContents.on('will-navigate', e => e.preventDefault());
    launcher.on('close', e => { if (game && !quitting) { e.preventDefault(); launcher.hide(); game.focus(); } });
    await launcher.loadFile(launcherFile);
    // Quiet check at most once a day (cached); only a newer release is announced.
    if (!smoke) updates.check(false).then(result => { if (result.state === 'available' && launcher && !launcher.isDestroyed()) launcher.webContents.send('update', result); }).catch(() => {});
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'Game', submenu: [{ label: 'Show launcher / invite link', click: () => launcher.show() }, { label: 'Return to game', click: () => game?.show() }, { type: 'separator' }, { role: 'quit' }] },
      { role: 'editMenu' }, { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }
    ]));
    if (smoke) {
      const port = await startServer(); openGame(`http://127.0.0.1:${port}`);
      game.webContents.on('console-message', (_event, details) => console.log('RENDERER', details.message));
      game.webContents.on('did-finish-load', async () => {
        try {
          await new Promise(r => setTimeout(r, 2500));
          const result = await game.webContents.executeJavaScript(`({ menuVisible: !document.querySelector('#joinScreen').hidden, title: document.title, gpu: !!document.createElement('canvas').getContext('webgl2') })`);
          console.log('DESKTOP_SMOKE', JSON.stringify(result));
          if (!result.menuVisible || !result.gpu) process.exitCode = 1;
        } catch (error) { console.error(error); process.exitCode = 1; }
        app.quit();
      });
    }
  });
}
app.on('before-quit', e => {
  if (server && !quitting && !smoke) {
    const choice = dialog.showMessageBoxSync(game || launcher, { type: 'question', buttons: ['Keep playing', 'Quit and end game'], defaultId: 0, cancelId: 0, message: 'Quit and disconnect everyone from your hosted game?' });
    if (choice === 0) { e.preventDefault(); return; }
  }
  quitting = true; stopHost();
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => (game || launcher)?.show());
