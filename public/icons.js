// The HUD's icon set: one module, inline SVG, single colour (currentColor), a 24px grid and one stroke weight, so every
// icon in the interface (wheel segments, chips, event log, panels, toolbar, guide) reads as one family.
//   import { ic, emo, deEmoji, ICONS } from './icons.js';
//   ic('dice')                      -> '<svg class="ic ic-dice" viewBox="0 0 24 24" aria-hidden="true">…</svg>'
//   ic('dice', { label: 'Roll' })   -> same with role="img" aria-label (use when there is no text label next to it)
//   emo('🎲')                       -> the icon that replaces that emoji (the server's log lines and old data still carry emoji)
//   deEmoji('🧾 Tax audit! …')      -> the same text with every known emoji swapped for an inline icon (input must be HTML-safe)
//   iconDataUrl('dice', '#efe4c8')  -> a data: URL for canvas drawing (the wheel) or CSS backgrounds
// Style: .ic is 1em square, stroke 1.6, round caps. Parts drawn solid use fill="currentColor".

const D = (s, c) => `<circle cx="${s[0]}" cy="${s[1]}" r="${c || 1.15}" fill="currentColor" stroke="none"/>`;

// an 8-tooth cog, computed so the teeth are even
function cog() {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    for (const [da, r] of [[-0.2, 7.2], [-0.12, 9.6], [0.12, 9.6], [0.2, 7.2]]) pts.push([12 + Math.cos(a + da) * r, 12 + Math.sin(a + da) * r]);
  }
  return `<path d="M${pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L')}Z"/><circle cx="12" cy="12" r="3"/>`;
}

export const ICONS = {
  // game
  dice: `<rect x="4" y="4" width="16" height="16" rx="3"/>${D([8.8, 8.8])}${D([15.2, 8.8])}${D([12, 12])}${D([8.8, 15.2])}${D([15.2, 15.2])}`,
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  cash: `<rect x="2.5" y="6.5" width="19" height="11" rx="1.5"/><circle cx="12" cy="12" r="2.6"/>${D([6, 12], 0.9)}${D([18, 12], 0.9)}`,
  coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  debt: '<circle cx="10" cy="10" r="6.5"/><path d="M7 10h6"/><path d="M19 14v7M16 18l3 3 3-3"/>',
  building: '<path d="M5 21V8l7-4 7 4v13"/><path d="M3 21h18"/><path d="M9 11.5h1.5M13.5 11.5H15M9 15.5h1.5M13.5 15.5H15"/>',
  crane: '<path d="M7 21V3M3 6.5h17M17 6.5V12"/><path d="M15.2 12h3.6v3.2h-3.6z"/><path d="M4.5 21h5M7 8l-3.5-1.5"/>',
  ruin: '<path d="M5 21V8l7-4 7 4v13"/><path d="M3 21h18"/><path d="M12.5 8l-2.500 4 3 2.200-2 4.300"/>',
  house: '<path d="M3.5 11L12 4l8.500 7"/><path d="M6 9.500V20h12V9.500"/><path d="M10 20v-5.500h4V20"/>',
  card: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 7.500l3 4.500-3 4.500-3-4.500z"/>',
  cards: '<rect x="3.500" y="6" width="11" height="15" rx="1.800"/><path d="M8.500 3.500h9a2 2 0 0 1 2 2V17"/>',
  chip: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.500"/><path d="M12 3v3.500M12 17.500V21M3 12h3.500M17.500 12H21"/>',
  roulette: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>${D([12, 12], 1.3)}<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>${D([16.500, 7.500], 1)}`,
  badge: '<path d="M12 3l7 2.500v6c0 4.500-3 8-7 9.500-4-1.500-7-5-7-9.500v-6z"/><path d="M12 8l1.200 2.500 2.800.3-2.100 1.900.6 2.800-2.500-1.400-2.500 1.400.6-2.800-2.100-1.900 2.800-.3z"/>',
  shield: '<path d="M12 3l7 2.500v6c0 4.500-3 8-7 9.500-4-1.500-7-5-7-9.500v-6z"/><path d="M8.500 12l2.500 2.500 4.500-5"/>',
  siren: '<path d="M6 20v-6a6 6 0 0 1 12 0v6"/><path d="M4 20h16"/><path d="M12 4V2M4.500 6.500L3 5M19.500 6.500L21 5"/><path d="M9.500 14a2.500 2.500 0 0 1 2.500-2.500"/>',
  tophat: '<path d="M7 15V5.500h10V15"/><path d="M3 18c0-1.700 4-3 9-3s9 1.300 9 3-4 3-9 3-9-1.300-9-3z"/><path d="M7 11.500h10"/>',
  fedora: '<path d="M2.500 17c0-1.400 3-2.200 9.500-2.200s9.500.8 9.500 2.200-4 3-9.500 3-9.500-1.600-9.500-3z"/><path d="M6.500 14.800C6.500 9 8.500 6 12 6s5.500 3 5.500 8.800"/><path d="M6.700 12.500h10.600M9.500 6.600Q12 9 14.500 6.600"/>',
  knife: '<path d="M20 4C14 5 10 9 8 13l3 3c4-2 8-6 9-12z"/><path d="M8 13l-4 4 3 3 4-4"/>',
  gun: '<path d="M3 7h16v4h-7.500L10 17H6.500L8 11H3z"/><path d="M11.500 11v2.200"/>',
  spray: `<rect x="8" y="9" width="8" height="12" rx="1.500"/><path d="M9 9V7h6v2M11 7V4h2v3"/>${D([17.500, 5], 0.8)}${D([19.500, 3.500], 0.8)}${D([19.500, 6.500], 0.8)}`,
  bomb: '<circle cx="10" cy="14" r="6.500"/><path d="M14.500 9.500l3-3"/><path d="M17.500 6.500l1-3M17.500 6.500l3 1M17.500 6.500l2.500 2.500"/>',
  confetti: `<path d="M4 20l4-12 8 8z"/>${D([13, 5], 0.9)}${D([19, 9], 0.9)}${D([20, 14.500], 0.9)}<path d="M16.500 3.500l1 1.500M11 3v2"/>`,
  champagne: `<path d="M9 3h6l-.5 8a2.500 2.500 0 0 1-5 0z"/><path d="M12 13.500V20M8.500 20h7"/>${D([11, 6.500], 0.7)}${D([13, 8.500], 0.7)}`,
  whiskey: '<path d="M5 5h14l-1.600 14a1.500 1.500 0 0 1-1.500 1.300H8.100a1.500 1.500 0 0 1-1.500-1.300z"/><path d="M6 10h12"/><rect x="9" y="12.500" width="3.500" height="3.500" rx=".6"/>',
  handcuffs: '<circle cx="7" cy="14.500" r="4"/><circle cx="17" cy="14.500" r="4"/><path d="M11 14.500h2"/><path d="M7 10.500V7M17 10.500V7"/>',
  bars: '<rect x="3.500" y="4" width="17" height="16" rx="1"/><path d="M8 4v16M12 4v16M16 4v16"/>',
  skull: `<path d="M12 3C7.600 3 4.500 6 4.500 10c0 2.400 1.100 4 2.500 5v3.500h10V15c1.400-1 2.500-2.600 2.500-5 0-4-3.100-7-7.500-7z"/>${D([9, 11], 1.6)}${D([15, 11], 1.6)}<path d="M10 18.500v2M14 18.500v2M12 13.500v1.500"/>`,
  envelope: '<rect x="3" y="5.500" width="18" height="13" rx="1.500"/><path d="M3.500 7l8.500 6.500L20.500 7"/>',
  taxi: '<path d="M3.500 17v-4.500L6 8h12l2.500 4.500V17z"/><path d="M3.500 12.500h17"/><path d="M9.500 8V5.800h5V8"/><circle cx="7.500" cy="17.500" r="2"/><circle cx="16.500" cy="17.500" r="2"/>',
  padlock: '<rect x="5" y="10.500" width="14" height="10" rx="1.800"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/><path d="M12 14.500v2.500"/>',
  bed: '<path d="M3 18V7M3 14.500h18V18M21 14.500v-2.500a2.500 2.500 0 0 0-2.500-2.500H11v5"/><circle cx="7" cy="11.500" r="1.800"/>',
  alarm: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.500 2h-15z"/><path d="M10 21.500h4M3 8l1.500-1.500M21 8l-1.500-1.500"/>',
  gift: '<rect x="3.500" y="9" width="17" height="4" rx="1"/><path d="M5 13v7.500h14V13M12 9v11.500"/><path d="M12 9c-2.500 0-4.500-1-4.500-3 0-1.200 1-2 2-2 1.500 0 2.500 2 2.500 5zM12 9c2.500 0 4.500-1 4.500-3 0-1.200-1-2-2-2-1.500 0-2.500 2-2.500 5z"/>',
  briefcase: '<rect x="3" y="7.500" width="18" height="12.500" rx="1.800"/><path d="M9 7.500V5.500A1.500 1.500 0 0 1 10.500 4h3A1.500 1.500 0 0 1 15 5.500v2"/><path d="M3 13h18M11 13v2h2v-2"/>',
  stamp: '<path d="M9 13V9a3 3 0 1 1 6 0v4"/><path d="M5 13h14a2 2 0 0 1 2 2v1.500H3V15a2 2 0 0 1 2-2z"/><path d="M4 20h16"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
  scales: '<path d="M12 4v16M7 20h10M4 7h16"/><path d="M4 7l-2.500 6h5zM20 7l-2.500 6h5z"/>',
  broom: '<path d="M15 3l-3.500 8"/><path d="M6.500 11h9l2.500 10H4z"/><path d="M9 15l-.5 6M12.500 15l.5 6"/>',
  bolt: '<path d="M13 2.500L5 13.500h6l-1 8 8-11h-6z"/>',
  sparkle: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H4.500a3.500 3.500 0 0 0 3.500 4M16 6h3.500a3.500 3.500 0 0 1-3.500 4M12 14v4M8.500 20h7M9.500 18h5"/>',
  // interface
  gear: cog(),
  speaker: '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>',
  speakerOff: '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="17.500" cy="16" r="2.500"/>',
  record: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.800"/><path d="M12 5.500a6.500 6.500 0 0 1 6.500 6.500"/>`,
  camera: '<path d="M4 8h3l1.500-2.500h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
  video: '<rect x="3" y="7" width="12" height="10" rx="1.500"/><path d="M15 11l6-3v8l-6-3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
  eye: '<path d="M2 12s3.500-6.500 10-6.500S22 12 22 12s-3.500 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.500h8M8 12.500h5"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/>${D([12, 7.500], 1)}`,
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  tv: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 4 4-4"/>',
  door: '<path d="M6 21V3h10v18M3 21h18"/>' + D([13, 12], 1),
  log: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  newspaper: '<rect x="4" y="4" width="16" height="16" rx="1.500"/><path d="M8 8h8M8 12h3M13 12h3M8 16h8"/>',
  megaphone: '<path d="M4 10v4h3l8 4V6L7 10z"/><path d="M18 9.500a4 4 0 0 1 0 5"/>',
  tag: `<path d="M3 12V4h8l10 10-8 8z"/>${D([7.500, 8.500], 1)}`,
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  robot: `<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/>${D([9, 13], 1)}${D([15, 13], 1)}<path d="M9.500 16.500h5"/>`,
  star: '<path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.800 6.800 19.600l1-5.800L3.500 9.700l5.900-.8z"/>',
  user: '<circle cx="12" cy="8" r="3.800"/><path d="M4.500 20c0-4 3.400-6.500 7.500-6.500s7.500 2.500 7.500 6.500"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c0-3.500 3-6 6.500-6s6.500 2.500 6.500 6"/><path d="M16 5a3 3 0 0 1 0 6M18 14c2 .8 3.500 2.800 3.500 6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="1.500"/><path d="M8 20h8M12 16v4"/>',
  textsize: '<path d="M3 19l5-14 5 14M5 14h6M15 19l3-8 3 8M16 16.500h4"/>',
  shuffle: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  dot: D([12, 12], 4),
  ring: '<circle cx="12" cy="12" r="4.500"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4"/>',
  // tokens (the pieces, as monochrome silhouettes)
  car: '<path d="M3 16.500v-4l2.500-4.500h9l4.500 4.500h2v4z"/><path d="M9.500 8v4.500M3 12.500h18"/><circle cx="7.500" cy="17" r="2"/><circle cx="16.500" cy="17" r="2"/>',
  dog: `<path d="M8.500 4h7l1 11a4.500 4.500 0 0 1-9 0z"/><path d="M8.500 4C5 4 3.500 7 3.500 11c0 2 .8 3.500 2.500 4M15.500 4c3.500 0 5 3 5 7 0 2-.8 3.500-2.500 4"/>${D([10.200, 10], 1)}${D([13.800, 10], 1)}<path d="M10.500 14h3l-1.500 1.800z"/>`,
  ship: '<path d="M3 15h18l-3 5H6z"/><path d="M12 15V4l6 8h-6M10 15V8l-4 5z"/>',
  dino: `<path d="M3.500 16c0-3.500 3.500-5.500 8.500-5.500 4 0 6.500 1.500 7.500 3.500l1.500.5v2.500H18.500l-.5 3H15.500l-.5-3H9.500L9 19.500H6.500L6 16z"/><path d="M7 10.500L8.500 7.500 10 10M10.500 10.500L12 7l1.500 3.500M14 10.800l1.500-2.800 1.200 3"/>${D([18.800, 14.200], .8)}`,
  rocket: '<path d="M12 2.500c3 2.500 4.500 6 4.500 10l-2 3h-5l-2-3c0-4 1.500-7.500 4.500-10z"/><circle cx="12" cy="9.500" r="1.800"/><path d="M7.500 12.500L5 16l3 .5M16.500 12.500L19 16l-3 .5M10 18.500c0 1.500.8 3 2 3s2-1.500 2-3"/>',
  cat: `<path d="M4.500 4.500l4 3.500h7l4-3.500v10.500a7.500 7.500 0 0 1-15 0z"/>${D([9, 13], 1)}${D([15, 13], 1)}<path d="M10.500 16.500l1.500 1 1.500-1"/>`,
  crown: '<path d="M3.500 18l-1-10 5 4 4.500-7 4.500 7 5-4-1 10z"/><path d="M4 21h16"/>',
};
// the token keys the server uses -> icon
export const TOKEN_ICON = { car: 'car', hat: 'tophat', dog: 'dog', glass: 'whiskey', ship: 'car', dino: 'dog', rocket: 'car', cat: 'dog', crown: 'tophat' };

// emoji (still in the server's log lines and in older data) -> icon key
export const EMOJI_KEY = {
  '🎲': 'dice', '→': 'arrow', '💸': 'debt', '💵': 'cash', '💰': 'coins', '🏗': 'crane', '🏠': 'house', '🏚': 'ruin', '🕳': 'ruin', '🏙️': 'building', '🏙': 'building',
  '🂠': 'card', '🂡': 'card', '🃏': 'card', '🎰': 'chip', '🎡': 'roulette', '🚓': 'siren', '🚔': 'badge', '🛡': 'shield', '🎩': 'tophat', '🕴️': 'fedora', '🕴': 'fedora',
  '🔪': 'knife', '🔫': 'gun', '💣': 'bomb', '💥': 'bomb', '🎉': 'confetti', '🍾': 'champagne', '🥃': 'whiskey', '⛓': 'handcuffs', '💀': 'skull', '✉': 'envelope', '✉️': 'envelope',
  '🚕': 'taxi', '🔒': 'padlock', '🛏': 'bed', '🚨': 'alarm', '🎁': 'gift', '💼': 'briefcase', '🧾': 'stamp', '⌛': 'hourglass', '⏳': 'hourglass', '⏱': 'hourglass', '⚖': 'scales', '⚖️': 'scales',
  '🧹': 'broom', '⚡': 'bolt', '✦': 'sparkle', '🌍': 'globe', '🔊': 'speaker', '🎥': 'video', '💬': 'chat', '🏷': 'tag', '📢': 'megaphone', '📺': 'tv', '🧭': 'compass', '📀': 'record', '📜': 'log',
  '🚪': 'door', '▶': 'play', '⚑': 'flag', '🤖': 'robot', '★': 'star', '○': 'ring', '●': 'dot', '$': 'coins', '✕': 'close', '🚗': 'car', '🐕': 'dog', '🚢': 'ship', '🦖': 'dino', '🚀': 'rocket', '🐈': 'cat', '👑': 'crown',
  '✈️': 'arrow', '⚙': 'gear', '⚙️': 'gear', '🪐': 'globe', '🍭': 'sparkle',
};
// the tone each icon carries in the event log and the announcer
export const TONE = { skull: 'bad', handcuffs: 'bad', bomb: 'bad', knife: 'bad', gun: 'bad', ruin: 'bad', alarm: 'bad', siren: 'bad', bed: 'bad', whiskey: 'bad', stamp: 'warn', debt: 'bad',
  cash: 'gold', coins: 'gold', briefcase: 'gold', gift: 'good', confetti: 'good', tophat: 'good', crane: 'good', shield: 'good', badge: 'good', fedora: 'bad', envelope: 'bad' };

// the markup for one icon
export function ic(key, o = {}) {
  const body = ICONS[key];
  if (!body) return '';
  const a = o.label ? ` role="img" aria-label="${String(o.label).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
  return `<svg class="ic ic-${key}${o.cls ? ' ' + o.cls : ''}" viewBox="0 0 24 24"${a}>${body}</svg>`;
}
// the icon for an emoji; unknown ones come back as plain text so nothing is lost
export function emo(e, o) {
  const k = EMOJI_KEY[e] || EMOJI_KEY[String(e || '').replace(/️/g, '')];
  return k ? ic(k, o) : String(e ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const keyOfEmoji = e => EMOJI_KEY[e] || EMOJI_KEY[String(e || '').replace(/️/g, '')] || null;

// every known emoji inside an HTML-safe string becomes an inline icon (🎩 means the Mafia when the sentence is about the Mafia)
const RE = new RegExp('(' + Object.keys(EMOJI_KEY).filter(k => k.length > 1 || /[^\x00-\x7f]/.test(k)).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'gu');
export function deEmoji(html) {
  const s = String(html ?? '');
  const mafia = /Mafia|Family|borrowed|loan/i.test(s);
  return s.replace(RE, m => { const e = m.replace(/️/g, ''); return ic(e === '🎩' && mafia ? 'fedora' : EMOJI_KEY[e] || EMOJI_KEY[m], { cls: 'ic-inline' }); });
}
// plain text with the emoji dropped (toasts, aria labels)
export const stripEmoji = s => String(s ?? '').replace(RE, '').replace(/^\s+/, '');

// a data: URL of one icon in one colour (for the 2D wheel and CSS backgrounds)
export function iconDataUrl(key, color = '#efe4c8', sw = 1.6) {
  const body = ICONS[key] || '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${body.replace(/currentColor/g, color)}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
