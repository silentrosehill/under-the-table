// The physical game board: a slightly warped cardboard board with a glossy vintage print,
// plus the small physical pieces that sit on it (wooden houses & hotels, owner markers,
// mortgage slips, card decks). Units: 1 unit = 4 cm.
import * as THREE from 'three';
import { loadTexture } from './assets.js';
import { fmtMoney } from './money.js';

export const BOARD_T = 0.14;                 // 5.6 mm thick
const INK = '#1E1712', PAPER = '#EADBBB', PAPER_LIGHT = '#F1E6CC';
const DISPLAY = '"Abril Fatface", Georgia, serif';
const COND = 'Oswald, "Arial Narrow", sans-serif';

// muted, slightly off-register printing-ink versions of the eight groups
export const PRINT_COLORS = {
  brown: '#7E5236', lightblue: '#7FB5CF', pink: '#C97497', orange: '#D98840',
  red: '#B8433A', yellow: '#D9B444', green: '#4E8D57', darkblue: '#3B5694',
};

// Top surface height at (x, z): edges curl up a touch, and there's a dip along the fold.
let HALF_SIZE = 6.22;
export function boardHeight(x, z) {
  const ex = Math.abs(x) / HALF_SIZE, ez = Math.abs(z) / HALF_SIZE;
  return 0.028 * ex ** 4 + 0.022 * ez ** 4 + 0.012 * (ex * ez) ** 3 - 0.007 * Math.exp(-((x / 0.05) ** 2));
}

// ------------------------------------------------------------------ small drawing helpers

function wrapLines(g, text, maxW) {
  const words = String(text).toUpperCase().split(/\s+/), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function fitLines(g, text, maxW, size, maxLines, font) {
  for (let s = size; s >= 16; s -= 2) {
    g.font = font(s);
    const lines = wrapLines(g, text, maxW);
    if (lines.length <= maxLines && lines.every(l => g.measureText(l).width <= maxW)) return { lines, size: s };
  }
  g.font = font(16);
  return { lines: wrapLines(g, text, maxW), size: 16 };
}
function textBlock(g, text, y, maxW, size, maxLines, font = s => `600 ${s}px ${COND}`) {
  const { lines, size: s } = fitLines(g, text, maxW, size, maxLines, font);
  g.font = font(s);
  lines.forEach((l, k) => g.fillText(l, 0, y + (k - (lines.length - 1) / 2) * s * 1.02));
  return { lines, size: s, bottom: y + (lines.length / 2) * s * 1.02 };
}
// "Pigalle, Paris" → name + city line
export const splitName = n => { const k = String(n).lastIndexOf(','); return k > 0 ? [n.slice(0, k).trim(), n.slice(k + 1).trim()] : [n, '']; };
export const slug = n => splitName(n)[0].normalize('NFD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
function nameWithCity(g, name, y, maxW, size, maxLines) {
  const [nm, city] = splitName(name);
  const r = textBlock(g, nm, y, maxW, size, maxLines);
  if (city) { g.font = `500 ${Math.round(size * 0.52)}px ${COND}`; g.fillStyle = 'rgba(30,23,18,.75)'; g.fillText(city.toUpperCase(), 0, r.bottom + size * 0.32); g.fillStyle = INK; }
}
// black & white photo in a thin printed frame
function photoBox(g, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  g.save();
  g.filter = 'grayscale(1) contrast(1.2) brightness(0.95) sepia(0.18)';
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(x, y, w, h);
}
const rand = (a, b) => a + Math.random() * (b - a);

// Engraved-style icons, drawn in ink around (0,0), roughly `s` px tall.
const ICON = {
  train(g, s) {
    g.save(); g.scale(s / 100, s / 100);
    g.fillStyle = INK;
    g.fillRect(-46, -8, 58, 30);                       // boiler
    g.fillRect(12, -30, 30, 52);                       // cab
    g.fillRect(8, -36, 38, 8);                         // roof
    g.fillRect(-36, -30, 12, 22);                      // chimney
    g.fillRect(-42, -36, 20, 8);
    g.beginPath(); g.moveTo(-46, 22); g.lineTo(-58, 30); g.lineTo(-46, 30); g.fill();   // cow-catcher
    for (const [x, r] of [[-32, 11], [-8, 11], [26, 14]]) { g.beginPath(); g.arc(x, 32, r, 0, 7); g.fill(); g.fillStyle = PAPER; g.beginPath(); g.arc(x, 32, r * 0.35, 0, 7); g.fill(); g.fillStyle = INK; }
    g.fillStyle = PAPER; g.fillRect(18, -22, 18, 14); g.fillStyle = INK;
    g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(-60, 47); g.lineTo(52, 47); g.stroke();
    g.restore();
  },
  bulb(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.arc(0, -12, 30, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(12, 26); g.lineTo(-12, 26); g.closePath(); g.stroke();
    for (let k = 0; k < 3; k++) g.fillRect(-14, 30 + k * 9, 28, 5);
    g.lineWidth = 3; g.beginPath(); g.moveTo(-8, 24); g.lineTo(-6, -10); g.lineTo(0, -2); g.lineTo(6, -10); g.lineTo(8, 24); g.stroke();
    g.lineWidth = 4;
    for (let k = 0; k < 7; k++) { const a = Math.PI * (1.05 + k * 0.15); g.beginPath(); g.moveTo(Math.cos(a) * 40, -12 + Math.sin(a) * 40); g.lineTo(Math.cos(a) * 52, -12 + Math.sin(a) * 52); g.stroke(); }
    g.restore();
  },
  faucet(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 6;
    g.fillRect(-50, -24, 60, 18); g.fillRect(-56, -32, 10, 34);
    g.beginPath(); g.arc(10, 6, 30, -Math.PI / 2, 0); g.lineWidth = 18; g.stroke(); g.lineWidth = 6;
    g.fillRect(-26, -46, 12, 22); g.fillRect(-40, -52, 40, 8);
    g.beginPath(); g.moveTo(40, 34); g.quadraticCurveTo(52, 52, 40, 58); g.quadraticCurveTo(28, 52, 40, 34); g.fill();
    g.restore();
  },
  ring(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.strokeStyle = INK; g.fillStyle = INK;
    g.lineWidth = 9; g.beginPath(); g.arc(0, 18, 30, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(-18, -14); g.lineTo(0, -40); g.lineTo(18, -14); g.lineTo(0, -6); g.closePath(); g.fill();
    g.strokeStyle = PAPER; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, -14); g.lineTo(18, -14); g.moveTo(0, -40); g.lineTo(0, -6); g.stroke();
    g.restore();
  },
  moneybag(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = INK;
    g.beginPath(); g.moveTo(-14, -30); g.quadraticCurveTo(-50, 0, -40, 30); g.quadraticCurveTo(-30, 46, 0, 46); g.quadraticCurveTo(30, 46, 40, 30); g.quadraticCurveTo(50, 0, 14, -30); g.fill();
    g.beginPath(); g.moveTo(-14, -30); g.lineTo(-24, -48); g.lineTo(0, -40); g.lineTo(24, -48); g.lineTo(14, -30); g.fill();
    g.fillStyle = PAPER; g.font = `900 46px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 12);
    g.restore();
  },
  chest(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = INK; g.strokeStyle = PAPER;
    g.fillRect(-48, -4, 96, 46);
    g.beginPath(); g.moveTo(-48, -4); g.quadraticCurveTo(-48, -40, 0, -40); g.quadraticCurveTo(48, -40, 48, -4); g.fill();
    g.lineWidth = 4; for (const x of [-30, 30]) { g.beginPath(); g.moveTo(x, -36); g.lineTo(x, 42); g.stroke(); }
    g.beginPath(); g.moveTo(-48, -4); g.lineTo(48, -4); g.stroke();
    g.fillStyle = PAPER; g.fillRect(-7, -10, 14, 16); g.fillStyle = INK; g.fillRect(-2, -4, 4, 6);
    g.restore();
  },
  roulette(g, s) {                                     // a roulette wheel from above: pockets round a hub, the ball on the rim
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = INK; g.strokeStyle = INK;
    g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 48, 0, 7); g.stroke();
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, b = a + Math.PI / 8;
      g.fillStyle = k % 2 ? '#B8433A' : INK;
      g.beginPath(); g.arc(0, 0, 43, a, b); g.arc(0, 0, 27, b, a, true); g.closePath(); g.fill();
    }
    g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.stroke();
    g.lineWidth = 5; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); g.stroke(); }
    g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
    g.fillStyle = PAPER_LIGHT; g.beginPath(); g.arc(32, -30, 6, 0, 7); g.fill(); g.lineWidth = 3; g.stroke();
    g.restore();
  },
  car(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = INK;
    g.beginPath(); g.moveTo(-58, 18); g.lineTo(-58, 0); g.lineTo(-40, -4); g.lineTo(-24, -28); g.lineTo(22, -28); g.lineTo(38, -4); g.lineTo(58, 2); g.lineTo(58, 18); g.closePath(); g.fill();
    g.fillStyle = PAPER; g.fillRect(-18, -22, 16, 16); g.fillRect(4, -22, 18, 16); g.fillStyle = INK;
    for (const x of [-34, 34]) { g.beginPath(); g.arc(x, 20, 13, 0, 7); g.fill(); g.fillStyle = PAPER; g.beginPath(); g.arc(x, 20, 5, 0, 7); g.fill(); g.fillStyle = INK; }
    g.restore();
  },
  taxi(g, s) {                                          // a cab: roof sign, checker band along the doors
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = INK;
    g.beginPath(); g.moveTo(-60, 20); g.lineTo(-60, 2); g.lineTo(-42, -2); g.lineTo(-26, -26); g.lineTo(24, -26); g.lineTo(40, -2); g.lineTo(60, 4); g.lineTo(60, 20); g.closePath(); g.fill();
    g.fillRect(-12, -38, 24, 12);                       // roof sign
    g.fillStyle = PAPER; g.fillRect(-20, -21, 16, 14); g.fillRect(4, -21, 18, 14); g.fillRect(-7, -35, 14, 6);
    g.fillStyle = PAPER; for (let k = 0; k < 10; k++) if (k % 2) g.fillRect(-52 + k * 10, 4, 10, 6); else g.fillRect(-52 + k * 10, 10, 10, 6);
    g.fillStyle = INK;
    for (const x of [-34, 36]) { g.beginPath(); g.arc(x, 22, 13, 0, 7); g.fill(); g.fillStyle = PAPER; g.beginPath(); g.arc(x, 22, 5, 0, 7); g.fill(); g.fillStyle = INK; }
    g.restore();
  },
  badge(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = INK;
    g.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 22 : 50, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
    g.fillStyle = PAPER; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
    g.restore();
  },
  arrow(g, s) {
    g.save(); g.scale(s / 100, s / 100); g.fillStyle = '#B8433A';
    g.beginPath(); g.moveTo(-60, -14); g.lineTo(20, -14); g.lineTo(20, -34); g.lineTo(62, 0); g.lineTo(20, 34); g.lineTo(20, 14); g.lineTo(-60, 14); g.closePath(); g.fill();
    g.restore();
  },
};

// ------------------------------------------------------------------ the printed sheet

function drawPrint(g, W, ctx) {
  const { board, meta, tileFrame, S } = ctx;
  const PX = W / S;
  const cur = (meta && meta.currency) || '$';
  const toPx = v => (v + S / 2) * PX;

  // paper
  g.fillStyle = PAPER; g.fillRect(0, 0, W, W);
  for (let k = 0; k < 9000; k++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(120,90,50,.06)' : 'rgba(255,250,235,.08)';
    g.fillRect(Math.random() * W, Math.random() * W, rand(1, 4), rand(1, 4));
  }

  // tiles
  for (const sp of board) {
    const fr = tileFrame(sp.i);
    const w = fr.w * PX, d = fr.d * PX;
    g.save();
    g.translate(toPx(fr.pos.x), toPx(fr.pos.z));
    g.rotate(-fr.rot);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = PAPER_LIGHT; g.fillRect(-w / 2, -d / 2, w, d);
    g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(-w / 2, -d / 2, w, d);
    g.fillStyle = INK;
    const maxW = w - 30;
    if (sp.type === 'property') {
      const bh = 0.36 * PX;
      g.fillStyle = PRINT_COLORS[sp.group] || sp.color; g.fillRect(-w / 2, -d / 2, w, bh);
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(-w / 2, -d / 2 + bh); g.lineTo(w / 2, -d / 2 + bh); g.stroke();
      g.fillStyle = INK;
      const photo = ctx.photos && ctx.photos.get(sp.i);
      if (photo) {
        const ph = 0.6 * PX;
        photoBox(g, photo, -w / 2 + 16, -d / 2 + bh + 14, w - 32, ph);
        nameWithCity(g, sp.name, -d / 2 + bh + ph + 62, maxW, 44, 2);
      } else nameWithCity(g, sp.name, -d / 2 + bh + 95, maxW, 54, 3);
      g.font = `500 36px ${COND}`; g.fillText(`PRICE ${fmtMoney(sp.price, cur)}`, 0, d / 2 - 48);
    } else if (fr.corner) {
      drawCorner(g, sp, w, cur);
    } else {
      nameWithCity(g, sp.name, -d / 2 + 64, maxW, 44, 2);
      const iconY = 15;
      const stationPhoto = sp.type === 'railroad' && ctx.photos && ctx.photos.get(sp.i);
      if (stationPhoto) photoBox(g, stationPhoto, -w / 2 + 16, -d / 2 + 150, w - 32, 0.6 * PX);
      else if (sp.type === 'railroad') ICON.train(g, 150);
      if (sp.type === 'utility') (sp.i === 12 ? ICON.bulb : ICON.faucet)(g, 140);
      if (sp.type === 'tax') (sp.i === 38 ? ICON.ring : ICON.moneybag)(g, 130);
      if (sp.type === 'chest') ICON.chest(g, 140);
      if (sp.type === 'casino') ICON.roulette(g, 190);
      if (sp.type === 'chance') {
        g.font = `400 220px ${DISPLAY}`; g.fillStyle = ['#B8433A', '#3B5694', '#D98840'][sp.i % 3]; g.fillText('?', 0, iconY + 10);
        g.fillStyle = INK;
      }
      g.font = `500 36px ${COND}`;
      if (sp.type === 'casino') { g.font = `600 52px ${COND}`; g.fillStyle = '#B8433A'; g.fillText('CASINO', 0, d / 2 - 48); g.fillStyle = INK; }
      else if (sp.price) g.fillText(`PRICE ${fmtMoney(sp.price, cur)}`, 0, d / 2 - 48);
      else if (sp.amount) g.fillText(`PAY ${fmtMoney(sp.amount, cur)}`, 0, d / 2 - 48);
    }
    g.restore();
  }

  // inner frame
  const inner = (ctx.HALF - 1.6 * (ctx.K || 1)) * PX;
  g.strokeStyle = INK; g.lineWidth = 6;
  g.strokeRect(W / 2 - inner, W / 2 - inner, inner * 2, inner * 2);
  drawCenterArt(g, W, PX, ctx);
}

function drawCorner(g, sp, w, cur) {
  const s = w / 2;
  g.fillStyle = INK;
  if (sp.type === 'go') {
    g.save(); g.rotate(-Math.PI / 4);
    g.font = `500 34px ${COND}`; g.fillText(`COLLECT ${cur}200 SALARY`, 0, -s * 0.62); g.fillText('AS YOU PASS', 0, -s * 0.44);
    g.font = `400 210px ${DISPLAY}`; g.fillStyle = '#B8433A'; g.fillText(sp.name.length <= 4 ? sp.name.toUpperCase() : 'GO', 0, -s * 0.02);
    g.fillStyle = INK;
    if (sp.name.length > 4) { g.font = `600 40px ${COND}`; g.fillText(sp.name.toUpperCase(), 0, s * 0.3); }
    g.restore();
    g.save(); g.translate(0, s * 0.62); g.scale(-1, 1); ICON.arrow(g, 190); g.restore();       // play runs toward -x
  } else if (sp.type === 'jail') {
    const c = s;                                                // the cell: inner quadrant
    g.fillStyle = '#D98840'; g.fillRect(-c, -c, c * 1.05, c * 1.05);
    g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(-c, -c, c * 1.05, c * 1.05);
    g.lineWidth = 7; for (let k = 1; k < 6; k++) { const x = -c + k * c * 1.05 / 6; g.beginPath(); g.moveTo(x, -c); g.lineTo(x, -c + c * 1.05); g.stroke(); }
    g.save(); g.translate(-c * 0.47, -c * 0.47); g.rotate(-Math.PI / 4);
    g.fillStyle = PAPER_LIGHT; g.fillRect(-150, -36, 300, 72); g.strokeRect(-150, -36, 300, 72);
    g.fillStyle = INK; g.font = `600 44px ${COND}`; g.fillText(sp.name.toUpperCase().slice(0, 14), 0, 2);
    g.restore();
    g.fillStyle = INK; g.font = `600 52px ${COND}`; g.fillText('VISITING', 0, s * 0.62);
    g.save(); g.translate(s * 0.62, 0); g.rotate(-Math.PI / 2); g.fillText('JUST', 0, 0); g.restore();
  } else {
    g.save(); g.rotate(-Math.PI / 4);
    const words = sp.name.toUpperCase().split(' ');
    const top = words.length > 1 ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : sp.type === 'taxi' ? 'TAXI' : 'GO TO';
    const bottom = words.length > 1 ? words.slice(Math.ceil(words.length / 2)).join(' ') : words[0];
    g.font = `600 56px ${COND}`; g.fillText(top, 0, -s * 0.58);
    (sp.type === 'taxi' ? ICON.taxi : ICON.badge)(g, sp.type === 'taxi' ? 200 : 170);
    g.font = `600 56px ${COND}`; g.fillText(bottom, 0, s * 0.6);
    g.restore();
  }
}

function drawCenterArt(g, W, PX, ctx) {
  const { meta, decks } = ctx;
  const cx = W / 2;
  const at = v => cx + v * PX;
  const inner = (ctx.HALF - 1.6 * (ctx.K || 1)) * PX;
  g.strokeStyle = INK; g.lineWidth = 2;
  g.strokeRect(cx - inner + 26, cx - inner + 26, (inner - 26) * 2, (inner - 26) * 2);

  // title ribbon
  const title = ((meta && meta.title) || 'Under The Table').toUpperCase();
  const ty = at(-1.85 * (ctx.K || 1));
  g.save(); g.translate(cx, ty); g.rotate(-0.03);
  const rw = 2050, rh = 300;
  g.fillStyle = '#7d2a24';
  for (const sx of [-1, 1]) {                                   // folded ribbon tails
    g.beginPath(); g.moveTo(sx * rw / 2 - sx * 40, -rh / 2 + 60); g.lineTo(sx * (rw / 2 + 170), -rh / 2 + 60); g.lineTo(sx * (rw / 2 + 110), 30); g.lineTo(sx * (rw / 2 + 170), rh / 2 + 60); g.lineTo(sx * rw / 2 - sx * 40, rh / 2 + 60); g.closePath(); g.fill();
  }
  g.fillStyle = '#B8433A'; g.fillRect(-rw / 2, -rh / 2, rw, rh);
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(-rw / 2, -rh / 2, rw, rh);
  g.strokeStyle = 'rgba(241,230,204,.6)'; g.lineWidth = 3; g.strokeRect(-rw / 2 + 18, -rh / 2 + 18, rw - 36, rh - 36);
  let size = 210; g.font = `400 ${size}px ${DISPLAY}`;
  while (g.measureText(title).width > rw - 160 && size > 80) { size -= 8; g.font = `400 ${size}px ${DISPLAY}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(30,23,18,.55)'; g.fillText(title, 6, 14);
  g.fillStyle = PAPER_LIGHT; g.fillText(title, 0, 8);
  g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = INK; g.font = `500 64px ${COND}`;
  g.fillText('★   A  GAME  OF  FORTUNE  &  RUIN   ★', cx, ty + 250);

  // card spaces
  for (const dk of decks) {
    g.save(); g.translate(at(dk.x), at(dk.z)); g.rotate(-dk.rot);
    const w = 1.12 * PX, h = 1.62 * PX;
    g.setLineDash([22, 14]); g.lineWidth = 5; g.strokeStyle = INK; g.strokeRect(-w / 2, -h / 2, w, h); g.setLineDash([]);
    g.font = `600 52px ${COND}`; g.fillStyle = INK;
    g.fillText(dk.label.toUpperCase(), 0, h / 2 + 60);
    g.restore();
  }
  g.font = `500 40px ${COND}`; g.fillStyle = 'rgba(30,23,18,.75)';
  g.fillText('PLAYED IN BACK ROOMS SINCE 1931  ·  ALL DEBTS ARE FINAL', cx, at(4.05 * (ctx.K || 1)));
}

// age the sheet: yellowed edges, rubbed-off ink at corners and edges, a fold crease, a stain
function drawWear(g, rough, W, S) {
  const PX = W / S;
  const yellow = g.createRadialGradient(W / 2, W / 2, W * 0.25, W / 2, W / 2, W * 0.75);
  yellow.addColorStop(0, 'rgba(0,0,0,0)'); yellow.addColorStop(1, 'rgba(120,80,30,.22)');
  g.fillStyle = yellow; g.fillRect(0, 0, W, W);

  // decades of hands: soft mottling, grime toward the edges, faded ink in patches
  for (let k = 0; k < 700; k++) {
    const x = Math.random() * W, y = Math.random() * W, r = rand(20, 140);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.65;
    gr.addColorStop(0, dark ? `rgba(110,75,35,${rand(0.02, 0.06)})` : `rgba(250,242,222,${rand(0.03, 0.08)})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const grime = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(70,45,20,.22)'); gr.addColorStop(1, 'rgba(70,45,20,0)'); return gr; };
  const e = 0.25 * PX;
  g.fillStyle = grime(0, 0, 0, e); g.fillRect(0, 0, W, e);
  g.fillStyle = grime(0, W, 0, W - e); g.fillRect(0, W - e, W, e);
  g.fillStyle = grime(0, 0, e, 0); g.fillRect(0, 0, e, W);
  g.fillStyle = grime(W, 0, W - e, 0); g.fillRect(W - e, 0, e, W);

  rough.fillStyle = '#5a5a5a'; rough.fillRect(0, 0, W, W);            // glossy coat overall
  for (let k = 0; k < 4000; k++) { rough.fillStyle = `rgba(255,255,255,${rand(0.02, 0.08)})`; rough.fillRect(Math.random() * W, Math.random() * W, rand(2, 10), rand(2, 10)); }

  const scuff = (x, y, r, a) => {
    g.fillStyle = `rgba(236,224,196,${a})`; rough.fillStyle = `rgba(230,230,230,${a})`;
    for (const c of [g, rough]) { c.beginPath(); for (let t = 0; t < 7; t += 0.5) { const rr = r * rand(0.6, 1.1); c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } c.fill(); }
  };
  for (const [cx, cy] of [[0, 0], [W, 0], [0, W], [W, W]]) {         // corners get the most handling
    for (let k = 0; k < 90; k++) {
      const r = rand(0, 0.45) * PX * Math.random(), a = rand(0, Math.PI / 2);
      scuff(cx ? cx - Math.cos(a) * r : Math.cos(a) * r, cy ? cy - Math.sin(a) * r : Math.sin(a) * r, rand(4, 22), rand(0.25, 0.75));
    }
  }
  for (let k = 0; k < 260; k++) {                                     // edge rub
    const t = Math.random() * W, e = rand(0, 18), side = k % 4;
    const [x, y] = side === 0 ? [t, e] : side === 1 ? [t, W - e] : side === 2 ? [e, t] : [W - e, t];
    scuff(x, y, rand(3, 12), rand(0.3, 0.8));
  }
  for (let k = 0; k < 60; k++) {                                      // fine scratches
    const x = Math.random() * W, y = Math.random() * W, a = Math.random() * Math.PI, l = rand(20, 120);
    g.strokeStyle = 'rgba(245,236,214,.35)'; rough.strokeStyle = 'rgba(220,220,220,.5)';
    for (const c of [g, rough]) { c.lineWidth = rand(1, 2.5); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  }
  // the fold down the middle: a dark valley, a light ridge, ink cracked along it
  g.fillStyle = 'rgba(40,25,10,.28)'; g.fillRect(W / 2 - 3, 0, 6, W);
  g.fillStyle = 'rgba(255,248,230,.35)'; g.fillRect(W / 2 + 4, 0, 3, W);
  for (let y = 0; y < W; y += rand(4, 26)) { g.fillStyle = `rgba(236,224,196,${rand(0.3, 0.8)})`; g.fillRect(W / 2 - rand(1, 5), y, rand(2, 9), rand(2, 10)); }
  rough.fillStyle = 'rgba(200,200,200,.8)'; rough.fillRect(W / 2 - 6, 0, 12, W);
  // a faint ring where someone once put a glass down
  g.strokeStyle = 'rgba(110,70,30,.16)'; g.lineWidth = 14;
  g.beginPath(); g.arc(W * 0.66, W * 0.62, 0.42 * PX, 0, 7); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(W * 0.66, W * 0.62, 0.36 * PX, 0, 5.4); g.stroke();
}

// ------------------------------------------------------------------ pieces

const woodNormal = () => loadTexture('table_normal', { repeat: [4, 4] });
let paintedMat = null;
function painted(color) {
  paintedMat ||= {};
  if (!paintedMat[color]) paintedMat[color] = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, normalMap: woodNormal(), normalScale: new THREE.Vector2(0.25, 0.25) });
  return paintedMat[color];
}
function houseGeometry(w, depth, wall, peak) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, wall); s.lineTo(0, peak); s.lineTo(-w / 2, wall); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  geo.translate(0, 0.012, -depth / 2);
  return geo;
}
const HOUSE_GEO = houseGeometry(0.17, 0.2, 0.12, 0.2);
const HOTEL_GEO = houseGeometry(0.24, 0.48, 0.17, 0.27);
export function makeHouse() { const m = new THREE.Mesh(HOUSE_GEO, painted('#2E6E3F')); m.castShadow = m.receiveShadow = true; return m; }
export function makeHotel() { const m = new THREE.Mesh(HOTEL_GEO, painted('#9C2F28')); m.castShadow = m.receiveShadow = true; m.rotation.y = Math.PI / 2; return m; }

const CHIP_GEO = new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.125, 0.012], [0.125, 0.036], [0.11, 0.048], [0, 0.048]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
export function makeOwnerChip(color) {
  const m = new THREE.Mesh(CHIP_GEO, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

let slipTex = null;
export function makeMortgageSlip() {
  if (!slipTex) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 330;
    const g = c.getContext('2d');
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, 512, 330);
    g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(14, 14, 484, 302);
    g.font = `500 30px ${COND}`; g.fillStyle = INK; g.textAlign = 'center'; g.fillText('TITLE DEED', 256, 62);
    g.save(); g.translate(256, 190); g.rotate(-0.18);
    g.strokeStyle = '#9E2B25'; g.lineWidth = 9; g.strokeRect(-200, -52, 400, 104);
    g.fillStyle = '#9E2B25'; g.font = `600 70px ${COND}`; g.textBaseline = 'middle'; g.fillText('MORTGAGED', 0, 4);
    g.restore();
    slipTex = new THREE.CanvasTexture(c); slipTex.colorSpace = THREE.SRGBColorSpace;
  }
  const paper = new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.85 });
  const top = new THREE.MeshStandardMaterial({ map: slipTex, roughness: 0.8 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.006, 0.4), [paper, paper, top, paper, paper, paper]);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cardBackTexture(color, kind, label) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 576;
  const g = c.getContext('2d');
  g.fillStyle = '#efe4c8'; g.fillRect(0, 0, 384, 576);
  g.fillStyle = color; g.fillRect(22, 22, 340, 532);
  g.strokeStyle = '#efe4c8'; g.lineWidth = 6; g.strokeRect(40, 40, 304, 496);
  g.fillStyle = '#efe4c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'chance') { g.font = `400 300px ${DISPLAY}`; g.fillText('?', 192, 270); }
  else { g.save(); g.translate(192, 260); g.scale(2.2, 2.2); g.fillStyle = '#efe4c8'; g.fillRect(-48, -4, 96, 46); g.beginPath(); g.moveTo(-48, -4); g.quadraticCurveTo(-48, -40, 0, -40); g.quadraticCurveTo(48, -40, 48, -4); g.fill(); g.restore(); }
  g.font = `600 44px ${COND}`; g.fillText(String(label).toUpperCase().slice(0, 16), 192, 480);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function makeDeck(dk) {
  const g = new THREE.Group();
  const edge = new THREE.MeshStandardMaterial({ color: '#e6dabd', roughness: 0.9 });
  const back = new THREE.MeshPhysicalMaterial({ map: cardBackTexture(dk.color, dk.kind, dk.label), roughness: 0.45, clearcoat: 0.3 });
  const geo = new THREE.BoxGeometry(1.0, 0.011, 1.5);
  const n = 14;
  for (let k = 0; k < n; k++) {
    const card = new THREE.Mesh(geo, k === n - 1 ? [edge, edge, back, edge, edge, edge] : edge);
    card.position.set(rand(-0.025, 0.025), 0.006 + k * 0.012, rand(-0.025, 0.025));
    card.rotation.y = rand(-0.03, 0.03);
    card.castShadow = card.receiveShadow = true;
    g.add(card);
  }
  g.position.set(dk.x, boardHeight(dk.x, dk.z), dk.z);
  g.rotation.y = dk.rot;
  return g;
}

// ------------------------------------------------------------------ the board

export function createBoard({ board, meta, tileFrame, HALF, K = 1, tex }) {
  const S = 2 * HALF + 0.24;
  HALF_SIZE = S / 2;
  const group = new THREE.Group();
  const decks = [
    { x: -2.75 * K, z: 0.75 * K, rot: 0, kind: 'chance', label: (meta && meta.chance) || 'Chance', color: '#B8433A' },
    { x: 2.75 * K, z: 0.75 * K, rot: 0, kind: 'chest', label: (meta && meta.chest) || 'Community Chest', color: '#3B5694' },
  ];

  // the printed top sheet + its gloss/wear map, drawn once at 4K
  const W = 4096;
  const ctx = { board, meta, tileFrame, S, HALF, K, decks };
  const printCanvas = document.createElement('canvas'); printCanvas.width = printCanvas.height = W;
  const roughCanvas = document.createElement('canvas'); roughCanvas.width = roughCanvas.height = 1024;
  const pg = printCanvas.getContext('2d');
  drawPrint(pg, W, ctx);
  const rg = roughCanvas.getContext('2d');
  rg.scale(1024 / W, 1024 / W);
  drawWear(pg, rg, W, S);
  const printTex = tex(printCanvas, true);
  fetch('/assets/photos/index.json').then(r => (r.ok ? r.json() : {})).then(async list => {
    const photos = new Map();
    await Promise.all(board.map(sp => {
      const file = sp.type !== 'property' && sp.type !== 'railroad' ? null : list[slug(sp.name)];
      if (!file) return null;
      const img = new Image();
      img.src = `/assets/photos/${file}`;
      return img.decode().then(() => photos.set(sp.i, img)).catch(() => {});
    }));
    if (!photos.size) return;
    ctx.photos = photos;
    drawPrint(pg, W, ctx);
    drawWear(pg, document.createElement('canvas').getContext('2d'), W, S);
    printTex.needsUpdate = true;
  }).catch(() => {});
  const roughTex = tex(roughCanvas, false);

  const top = new THREE.MeshPhysicalMaterial({
    map: printTex, roughnessMap: roughTex, roughness: 1, metalness: 0,
    normalMap: loadTexture('paper_normal', { repeat: [6, 6] }), normalScale: new THREE.Vector2(0.25, 0.25),
    clearcoat: 0.5, clearcoatRoughness: 0.32,
  });
  const card = new THREE.MeshStandardMaterial({
    map: loadTexture('cardboard_color', { srgb: true, repeat: [8, 0.12] }), normalMap: loadTexture('cardboard_normal', { repeat: [8, 0.12] }),
    roughness: 0.95, color: '#8d7a62',
  });
  const under = new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.8 });
  const geo = new THREE.BoxGeometry(S, BOARD_T, S, 48, 1, 48);
  const p = geo.attributes.position;
  const R = 0.1, h = S / 2;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // round the corners a little: real boards get knocked soft
    const dx = Math.abs(x) - (h - R), dz = Math.abs(z) - (h - R);
    if (dx > 0 && dz > 0) {
      const l = Math.hypot(dx, dz);
      if (l > R) { x = Math.sign(x) * (h - R + dx / l * R); z = Math.sign(z) * (h - R + dz / l * R); }
    }
    p.setXYZ(i, x, y + BOARD_T / 2 - BOARD_T + boardHeight(x, z), z);
  }
  geo.computeVertexNormals();
  const slab = new THREE.Mesh(geo, [card, card, top, under, card, card]);
  slab.receiveShadow = true; slab.castShadow = true;
  group.add(slab);

  // per-tile helpers: an invisible pick target, a glow for hover, and a spot for pieces
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const tiles = board.map(sp => {
    const fr = tileFrame(sp.i);
    const tg = new THREE.Group();
    tg.position.copy(fr.pos); tg.rotation.y = fr.rot;
    const pick = new THREE.Mesh(new THREE.PlaneGeometry(fr.w, fr.d), pickMat);
    pick.rotation.x = -Math.PI / 2; pick.position.y = 0.04; pick.userData.tile = sp.i;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(fr.w - 0.04, fr.d - 0.04),
      new THREE.MeshBasicMaterial({ color: '#f0a83c', transparent: true, opacity: 0, depthWrite: false }));      // (normal blending: additive vanishes on the cream print)
    glow.rotation.x = -Math.PI / 2; glow.position.y = boardHeight(fr.pos.x, fr.pos.z) + 0.006;
    const bld = new THREE.Group();
    tg.add(pick, glow, bld);
    group.add(tg);
    return { sp, fr, group: tg, pick, glow, bld, houses: 0, chip: null, slip: null, owner: null, mortgaged: false, lift: 0 };
  });

  for (const dk of decks) group.add(makeDeck(dk));
  return { group, tiles, size: S };
}
