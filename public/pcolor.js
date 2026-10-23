// The players' colours are deep and muted (server.js COLORS: oxblood, navy, bottle green, aubergine), which suits fills, bars and enamel
// but vanishes as text or thin lines on the dark HUD, and barely lights anything in the dark city. Two tints are derived from each one:
//   pcText(hex): a pale tint of the same hue for text, thin borders and small dots on dark backgrounds
//   pcGlow(hex): a mid tone for emissive glows, light rings and beams (the deep colour lightened a little)
const cache = new Map();

function toHsl(hex) {
  const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
function tint(hex, key, sat, light) {
  const k = key + hex;
  if (!cache.has(k)) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) cache.set(k, hex || '#c9a24f');
    else { const [h, s] = toHsl(hex); cache.set(k, fromHsl(h, Math.min(sat[1], Math.max(sat[0], s * sat[2])), light)); }
  }
  return cache.get(k);
}
export const pcText = hex => tint(hex, 't', [0.34, 0.56, 1.1], 0.72);
export const pcGlow = hex => tint(hex, 'g', [0.3, 0.46, 1.0], 0.38);
