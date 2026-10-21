const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const binaries = [
  { folder: 'darwin-arm64', name: 'cloudflared-darwin-arm64.tgz', hash: '529a07089ac2d46762578389230fa148e5cb6ce2689200fc006956864042d17a' },
  { folder: 'win32-x64', name: 'cloudflared-windows-amd64.exe', hash: '12c7c887f8aaab779aef1dfa9b60673530a5adb88ecc55dd6df8f56e0b70f199' },
];
async function main() {
  const vendor = path.join(root, 'public/vendor');
  await fs.mkdir(vendor, { recursive: true });
  for (const [source, destination] of [['three/build','three/build'], ['three/examples/jsm','three/addons'], ['three/LICENSE','three/LICENSE'], ['cannon-es/dist/cannon-es.js','cannon-es.js'], ['cannon-es/LICENSE','cannon-es-LICENSE']]) {
    await fs.cp(path.join(root, 'node_modules', source), path.join(vendor, destination), { recursive: true });
  }
  for (const item of binaries) {
    const dir = path.join(root, 'desktop-resources', item.folder);
    await fs.mkdir(dir, { recursive: true });
    const archive = path.join(dir, item.name);
    let data;
    try { data = await fs.readFile(archive); } catch {}
    if (!data || crypto.createHash('sha256').update(data).digest('hex') !== item.hash) {
      const response = await fetch(`https://github.com/cloudflare/cloudflared/releases/download/2026.10.2/${item.name}`);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      data = Buffer.from(await response.arrayBuffer());
      if (crypto.createHash('sha256').update(data).digest('hex') !== item.hash) throw new Error('Cloudflared checksum mismatch');
      await fs.writeFile(archive, data);
    }
    if (item.folder.startsWith('darwin')) { execFileSync('tar', ['-xzf', archive, '-C', dir]); await fs.chmod(path.join(dir, 'cloudflared'), 0o755); }
    else await fs.copyFile(archive, path.join(dir, 'cloudflared.exe'));
  }
  console.log('Local graphics libraries and verified Cloudflared binaries ready.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
