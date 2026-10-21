const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const dir = path.join(__dirname, '../desktop/icons');
  const svg = await fs.readFile(path.join(dir, 'icon.svg'));
  await sharp(svg).resize(1024).png().toFile(path.join(dir, 'icon.png'));
  const png = await sharp(svg).resize(256).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await fs.writeFile(path.join(dir, 'icon.ico'), Buffer.concat([header, png]));
  const chunks = [];
  for (const [type, size] of [['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]]) {
    const data = await sharp(svg).resize(size).png().toBuffer();
    const entry = Buffer.alloc(8); entry.write(type); entry.writeUInt32BE(data.length + 8, 4);
    chunks.push(entry, data);
  }
  const body = Buffer.concat(chunks), icnsHeader = Buffer.alloc(8);
  icnsHeader.write('icns'); icnsHeader.writeUInt32BE(body.length + 8, 4);
  await fs.writeFile(path.join(dir, 'icon.icns'), Buffer.concat([icnsHeader, body]));
  await fs.rm(path.join(dir, 'icon.iconset'), { recursive: true, force: true });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
