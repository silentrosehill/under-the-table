// Card artwork: one shared art-deco card face + back. Pair with cardface.css.
// cardFace({ key, type, title, text, value, size, tone }) -> HTML string
//   type: attack | counter | negative | positive | casino   (tone 'pos'|'neg' tints casino cards)
//   size: width in px (height follows 5:7); omit to fill the parent's width.
// cardBack(deck, size) -> HTML string ('chance' = the casino deck, anything else = UNDER THE TABLE)

export const ART = {
  gang: 'art/cards/gang.svg',
  squatters: 'art/cards/squatters.svg',
  protection: 'art/cards/protection.svg',
  squatters_in: 'art/cards/squatters_in.svg',
  crime: 'art/cards/crime.svg',
  billionaire: 'art/cards/billionaire.svg',
  gift: 'art/cards/gift.svg',
  bribe: 'art/cards/bribe.svg',
  'mafia-table': 'art/cards/mafia-table.svg',
  'mafia-note': 'art/cards/mafia-note.svg',
  'casino-whim': 'art/cards/casino-whim.svg',
  'casino-police': 'art/cards/casino-police.svg',
  'casino-mayor': 'art/cards/casino-mayor.svg',
  'casino-gang': 'art/cards/casino-gang.svg',
  'casino-bombing': 'art/cards/casino-bombing.svg',
  'casino-boom': 'art/cards/casino-boom.svg',
  'casino-onetoomany': 'art/cards/casino-onetoomany.svg',
};

const LABEL = { attack: 'ATTACK', counter: 'COUNTER', negative: 'NEGATIVE', positive: 'POSITIVE', casino: 'CASINO', mafia: 'THE FAMILY' };

// badge glyphs on a 24x24 grid, drawn in currentColor
const ICON = {
  attack: '<path d="M12 2 L14 9 L21 8 L16 13 L19 21 L12 16 L5 21 L8 13 L3 8 L10 9Z"/>',
  counter: '<path d="M12 2 L21 5 V12 C21 17 17 20 12 22 C7 20 3 17 3 12 V5Z"/><path d="M12 6 V18 M7 11 H17" stroke="var(--cf-paper)" stroke-width="1.8" fill="none"/>',
  negative: '<path d="M12 3 L22 20 H2Z"/><path d="M12 9 V14 M12 16.5 V17.5" stroke="var(--cf-paper)" stroke-width="2" fill="none"/>',
  positive: '<path d="M12 2 L15 9 L22 9.5 L16.8 14.3 L18.4 21.5 L12 17.8 L5.6 21.5 L7.2 14.3 L2 9.5 L9 9Z"/>',
  mafia: '<path d="M2 15 Q12 12 22 15 L21 17.5 Q12 15.5 3 17.5Z"/><path d="M6 14 Q6 6 12 6 Q18 6 18 14Z"/><path d="M6.4 11.6 H17.6" stroke="var(--cf-paper)" stroke-width="1.6" fill="none"/>',
  casino: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><g fill="var(--cf-paper)"><circle cx="8.5" cy="8.5" r="1.8"/><circle cx="15.5" cy="8.5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="8.5" cy="15.5" r="1.8"/><circle cx="15.5" cy="15.5" r="1.8"/></g>',
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// deco frame over the whole card (viewBox 250x350): double rules, stepped corners, sunburst, chevrons
const FRAME = `<svg class="cf-frame" viewBox="0 0 250 350" preserveAspectRatio="none" aria-hidden="true">
<rect x="1.5" y="1.5" width="247" height="347" rx="7" fill="none" stroke="#1a1512" stroke-width="3"/>
<rect x="7" y="7" width="236" height="336" fill="none" stroke="var(--ac)" stroke-width="1.4"/>
<rect x="10.5" y="10.5" width="229" height="329" fill="none" stroke="#1a1512" stroke-width=".7"/>
<g fill="none" stroke="var(--ac)" stroke-width="1.4">
<path d="M7 24 H15 V16 H23 V7"/><path d="M243 24 H235 V16 H227 V7"/><path d="M7 326 H15 V334 H23 V343"/><path d="M243 326 H235 V334 H227 V343"/></g>
<g fill="#1a1512"><path d="M7 7 H17 V10.5 H10.5 V17 H7Z"/><path d="M243 7 H233 V10.5 H239.5 V17 H243Z"/><path d="M7 343 H17 V339.5 H10.5 V333 H7Z"/><path d="M243 343 H233 V339.5 H239.5 V333 H243Z"/></g>
<path d="M18 49 H232 M18 208 H232" stroke="#1a1512" stroke-width=".6" opacity=".5"/>
<path d="M18 50 L26 42 H224 L232 50 V207 L224 215 H26 L18 207Z" fill="none" stroke="#1a1512" stroke-width="2.4"/>
<path d="M21 52 L28 45 H222 L229 52 V205 L222 212 H28 L21 205Z" fill="none" stroke="var(--ac)" stroke-width=".9"/>
<g stroke="var(--ac)" stroke-width=".8" opacity=".75"><path d="M125 295 L125 345 M125 295 L100 338 M125 295 L150 338 M125 295 L76 326 M125 295 L174 326" opacity=".0"/></g>
<g fill="var(--ac)"><path d="M104 311 H146 L142 314 H108Z" opacity=".0"/><path d="M92 341 L125 331 L158 341 L125 336Z" opacity=".9"/><path d="M110 338 l15 -5 l15 5" stroke="#1a1512" stroke-width=".6" fill="none"/></g>
</svg>`;

export function cardFace({ key, type = 'attack', title = '', text = '', value = '', size, tone } = {}) {
  const t = LABEL[type] ? type : 'attack';
  const src = ART[key] || '';
  const cls = `cf cf-${t}${t === 'casino' && tone ? ' cf-tone-' + tone : ''}`;
  const style = size ? ` style="--cw:${Math.round(size)}px"` : '';
  return `<div class="${cls}"${style} data-key="${esc(key)}">
<div class="cf-paper"></div>
<div class="cf-art">${src ? `<img src="${src}" alt="" draggable="false">` : ''}<span class="cf-wash"></span></div>
${FRAME}
<div class="cf-strip"><span class="cf-label">${LABEL[t]}</span></div>
<svg class="cf-badge" viewBox="0 0 24 24" aria-hidden="true">${ICON[t]}</svg>
<div class="cf-title">${esc(title)}</div>
<div class="cf-text">${esc(text)}</div>
<div class="cf-foot">${value ? `<span class="cf-value">${esc(value)}</span>` : ''}</div>
</div>`;
}

// card back: deco lattice + sunburst + monogram
export function cardBack(deck = 'chance', size) {
  const tip = deck === 'chance' || deck === 'tip';
  const lines = tip ? ['CASINO', 'DECK'] : ['UNDER', 'THE TABLE'];
  const style = size ? ` style="--cw:${Math.round(size)}px"` : '';
  let rays = '';
  for (let i = 0; i < 17; i++) { const a = Math.PI * (i / 16); rays += `<path d="M125 175 L${(125 + Math.cos(a) * 160).toFixed(1)} ${(175 - Math.sin(a) * 160).toFixed(1)}" />`; }
  return `<div class="cf cf-back ${tip ? 'cf-back-tip' : 'cf-back-table'}"${style} data-deck="${esc(deck)}">
<svg class="cf-backart" viewBox="0 0 250 350" preserveAspectRatio="none" aria-hidden="true">
<defs><pattern id="cfl-${tip ? 't' : 'u'}" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 H20 M0 0 V20" stroke="var(--ac)" stroke-width=".7" opacity=".55"/></pattern></defs>
<rect width="250" height="350" fill="var(--bk)"/>
<rect width="250" height="350" fill="url(#cfl-${tip ? 't' : 'u'})"/>
<g stroke="var(--ac)" stroke-width=".8" opacity=".6" fill="none">${rays}</g>
<rect x="1.5" y="1.5" width="247" height="347" rx="7" fill="none" stroke="#0b0908" stroke-width="3"/>
<rect x="9" y="9" width="232" height="332" fill="none" stroke="var(--ac)" stroke-width="2"/>
<rect x="14" y="14" width="222" height="322" fill="none" stroke="var(--ac)" stroke-width=".8"/>
<path d="M9 30 H30 V9 M241 30 H220 V9 M9 320 H30 V341 M241 320 H220 V341" stroke="var(--ac)" stroke-width="2" fill="none"/>
<path d="M125 62 L190 175 L125 288 L60 175Z" fill="var(--bk)" stroke="var(--ac)" stroke-width="2.4"/>
<path d="M125 74 L180 175 L125 276 L70 175Z" fill="none" stroke="var(--ac)" stroke-width=".9"/>
<circle cx="125" cy="175" r="44" fill="none" stroke="var(--ac)" stroke-width=".8" opacity=".7"/>
</svg>
<div class="cf-mono"><span class="cf-mono-a">${lines[0]}</span><span class="cf-mono-b">${lines[1]}</span></div>
</div>`;
}

if (typeof window !== 'undefined') window.CardFace = { cardFace, cardBack, ART };
