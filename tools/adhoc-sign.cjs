// electron-builder afterSign hook: give the macOS app (and the bundled cloudflared) an ad-hoc signature so
// Gatekeeper shows the normal "unidentified developer" prompt instead of "app is damaged".
const path = require('node:path');
const { execFileSync } = require('node:child_process');
exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const run = (...args) => execFileSync('codesign', ['--force', '--sign', '-', ...args], { stdio: 'inherit' });
  run(path.join(app, 'Contents', 'Resources', 'cloudflared'));
  run('--deep', app);
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
