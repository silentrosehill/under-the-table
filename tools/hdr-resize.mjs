// Box-filter downscale of a Radiance .hdr (RLE RGBE) in linear light:  node tools/hdr-resize.mjs in.hdr out.hdr 1024
// The game only uses the HDR as a dim, blurred reflection environment (PMREM), so 1k wide is plenty and ~4x smaller on the wire.
import { readFileSync, writeFileSync } from 'node:fs';
const [,, inp, outp, outW = '1024'] = process.argv;
const buf = readFileSync(inp);
let p = 0;
const line = () => { let s = ''; while (buf[p] !== 10) s += String.fromCharCode(buf[p++]); p++; return s; };
while (line() !== '');                                    // header ends at the blank line
const [, hs, , ws] = line().split(' ');                    // "-Y H +X W"
const H = +hs, W = +ws;
const f = new Float32Array(W * H * 3);
const scan = new Uint8Array(W * 4);
for (let y = 0; y < H; y++) {
  if (buf[p] !== 2 || buf[p + 1] !== 2) throw new Error('only RLE .hdr supported');
  p += 4;
  for (let c = 0; c < 4; c++) {
    let x = 0;
    while (x < W) {
      let n = buf[p++];
      if (n > 128) { n -= 128; const v = buf[p++]; while (n--) scan[(x++) * 4 + c] = v; }
      else while (n--) scan[(x++) * 4 + c] = buf[p++];
    }
  }
  for (let x = 0; x < W; x++) {
    const e = scan[x * 4 + 3], s = e ? Math.pow(2, e - 136) : 0;
    for (let c = 0; c < 3; c++) f[(y * W + x) * 3 + c] = scan[x * 4 + c] * s;
  }
}
const w = +outW, h = Math.round(H * w / W), k = W / w;
const out = [];
out.push(Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`));
const rgbe = new Uint8Array(w * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0]; let n = 0;
    for (let yy = Math.floor(y * k); yy < Math.floor((y + 1) * k); yy++) for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) { n++; for (let c = 0; c < 3; c++) acc[c] += f[(yy * W + xx) * 3 + c]; }
    const r = acc[0] / n, g = acc[1] / n, b = acc[2] / n, m = Math.max(r, g, b);
    if (m < 1e-32) { rgbe.set([0, 0, 0, 0], x * 4); continue; }
    const e = Math.ceil(Math.log2(m) + 1e-9), sc = 256 / Math.pow(2, e);
    rgbe.set([Math.min(255, r * sc), Math.min(255, g * sc), Math.min(255, b * sc), e + 128], x * 4);
  }
  const row = [2, 2, w >> 8, w & 255];
  for (let c = 0; c < 4; c++) {                            // new-style RLE, one channel at a time
    let x = 0;
    while (x < w) {
      let run = 1; while (x + run < w && run < 127 && rgbe[(x + run) * 4 + c] === rgbe[x * 4 + c]) run++;
      if (run >= 3) { row.push(128 + run, rgbe[x * 4 + c]); x += run; continue; }
      let lit = 0; while (x + lit < w && lit < 128) { let r2 = 1; while (x + lit + r2 < w && r2 < 3 && rgbe[(x + lit + r2) * 4 + c] === rgbe[(x + lit) * 4 + c]) r2++; if (r2 >= 3) break; lit++; }
      lit = Math.max(1, lit); row.push(lit); for (let i = 0; i < lit; i++) row.push(rgbe[(x + i) * 4 + c]); x += lit;
    }
  }
  out.push(Buffer.from(row));
}
writeFileSync(outp, Buffer.concat(out));
console.log('hdr', `${W}x${H} -> ${w}x${h}`);
