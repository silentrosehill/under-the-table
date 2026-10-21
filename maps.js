// Board definitions. Every map shares the classic 40-space layout and economy;
// only names, colors, currency and default skin change.

const GROUP_COLORS = {
  brown: '#8B4513', lightblue: '#8fd3f4', pink: '#d93a96', orange: '#f7941d',
  red: '#ed1b24', yellow: '#fde000', green: '#1fb25a', darkblue: '#0063b1',
};

// [type, group, price, rent[0..5], houseCost] (classic numbers; buildBoard scales them by K)
const K = 1000;
const LAYOUT = [
  ['go'],
  ['property', 'brown', 60, [2, 10, 30, 90, 160, 250], 50],
  ['chest'],
  ['property', 'brown', 60, [4, 20, 60, 180, 320, 450], 50],
  ['tax', null, 200],
  ['railroad', null, 200],
  ['property', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50],
  ['casino'],
  ['property', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50],
  ['property', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50],
  ['jail'],
  ['property', 'pink', 140, [10, 50, 150, 450, 625, 750], 100],
  ['utility', null, 150],
  ['property', 'pink', 140, [10, 50, 150, 450, 625, 750], 100],
  ['property', 'pink', 160, [12, 60, 180, 500, 700, 900], 100],
  ['railroad', null, 200],
  ['property', 'orange', 180, [14, 70, 200, 550, 750, 950], 100],
  ['chest'],
  ['property', 'orange', 180, [14, 70, 200, 550, 750, 950], 100],
  ['property', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100],
  ['taxi'],
  ['property', 'red', 220, [18, 90, 250, 700, 875, 1050], 150],
  ['casino'],
  ['property', 'red', 220, [18, 90, 250, 700, 875, 1050], 150],
  ['property', 'red', 240, [20, 100, 300, 750, 925, 1100], 150],
  ['railroad', null, 200],
  ['property', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150],
  ['property', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150],
  ['utility', null, 150],
  ['property', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150],
  ['gotojail'],
  ['property', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200],
  ['property', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200],
  ['chest'],
  ['property', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200],
  ['railroad', null, 200],
  ['casino'],
  ['property', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200],
  ['tax', null, 100],
  ['property', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200],
];

const MAPS = {
  classic: {
    title: 'Classic City',
    rail: 'Railroad',
    currency: '$',
    theme: 'classic',
    chance: 'Chance',
    chest: 'Community Chest',
    names: [
      'GO', 'Mediterranean Ave', 'Community Chest', 'Baltic Ave', 'Income Tax',
      'Reading Railroad', 'Oriental Ave', 'Chance', 'Vermont Ave', 'Connecticut Ave',
      'Jail', 'St. Charles Place', 'Electric Company', 'States Ave', 'Virginia Ave',
      'Pennsylvania Railroad', 'St. James Place', 'Community Chest', 'Tennessee Ave', 'New York Ave',
      'Free Parking', 'Kentucky Ave', 'Chance', 'Indiana Ave', 'Illinois Ave',
      'B&O Railroad', 'Atlantic Ave', 'Ventnor Ave', 'Water Works', 'Marvin Gardens',
      'Go To Jail', 'Pacific Ave', 'North Carolina Ave', 'Community Chest', 'Pennsylvania Ave',
      'Short Line', 'Chance', 'Park Place', 'Luxury Tax', 'Boardwalk',
    ],
  },
  world: {
    title: 'World Tour',
    rail: 'Airport',
    currency: '$',
    theme: 'ocean',
    chance: 'Adventure',
    chest: 'Travel Fund',
    names: [
      'Departure', 'Cairo', 'Travel Fund', 'Delhi', 'Visa Fees',
      'Heathrow Airport', 'Lisbon', 'Adventure', 'Prague', 'Budapest',
      'Customs', 'Istanbul', 'Power Grid', 'Athens', 'Rome',
      'Changi Airport', 'Madrid', 'Travel Fund', 'Berlin', 'Amsterdam',
      'Beach Day', 'Sydney', 'Adventure', 'Toronto', 'Seoul',
      'Narita Airport', 'Singapore', 'Dubai', 'Water Works', 'Hong Kong',
      'Deported!', 'Paris', 'London', 'Travel Fund', 'Zurich',
      'JFK Airport', 'Adventure', 'Tokyo', 'Luxury Tax', 'New York',
    ],
  },
  galaxy: {
    title: 'Galaxy Empire',
    rail: 'Warp Gate',
    currency: '₡',
    theme: 'neon',
    chance: 'Wormhole',
    chest: 'Supply Drop',
    names: [
      'Launch Pad', 'Pluto Outpost', 'Supply Drop', 'Ceres Mine', 'Hyperspace Toll',
      'Warp Gate Alpha', 'Europa Ice Fields', 'Wormhole', 'Ganymede', 'Callisto',
      'Space Brig', 'Titan Docks', 'Fusion Reactor', 'Enceladus', 'Rhea',
      'Warp Gate Beta', 'Phobos', 'Supply Drop', 'Deimos', 'Mars Colony',
      'Space Station', 'Venus Clouds', 'Wormhole', 'Mercury Forge', 'Io Volcano',
      'Warp Gate Gamma', 'Luna Base', 'Lagrange Hub', 'Ice Harvester', 'Orbital Ring',
      'Arrested!', 'Kepler-22b', 'Proxima b', 'Supply Drop', 'Trappist-1e',
      'Warp Gate Delta', 'Wormhole', 'Andromeda Gate', 'Dark Matter Tax', 'Galactic Core',
    ],
  },
  underworld: {
    title: 'Underworld',
    rail: 'Station',
    currency: '$',
    theme: 'noir',
    chance: 'Tip-Off',
    chest: 'Under the Table',
    // infamous underworld districts & streets — "Name, City" (the board prints the city small)
    names: [
      'Payday', 'Five Points, New York', 'Under the Table', 'The Bowery, New York', 'Protection Money',
      'Gare du Nord, Paris', 'Whitechapel, London', 'Tip-Off', 'Seven Dials, London', 'Limehouse, London',
      'The Lock-Up', 'Pigalle, Paris', 'Power & Light Co.', 'Barbès, Paris', 'Rue Saint-Denis, Paris',
      'Grand Central, New York', 'Kabukichō, Tokyo', 'Under the Table', 'Roppongi, Tokyo', 'Kamagasaki, Osaka',
      'Safe House', "Hell's Kitchen, New York", 'Tip-Off', 'The Tenderloin, San Francisco', 'The Levee, Chicago',
      'Shinjuku Station, Tokyo', 'Kowloon Walled City, Hong Kong', 'Wan Chai, Hong Kong', 'City Waterworks', 'El Raval, Barcelona',
      'Busted!', 'Reeperbahn, Hamburg', 'De Wallen, Amsterdam', 'Under the Table', 'Quartieri Spagnoli, Naples',
      "King's Cross, London", 'Tip-Off', 'Monte Carlo, Monaco', 'The Vig', 'The Strip, Las Vegas',
    ],
  },
  candy: {
    title: 'Sugar Rush',
    rail: 'Express',
    currency: '¢',
    theme: 'candy',
    chance: 'Surprise',
    chest: 'Cookie Jar',
    names: [
      'Start', 'Licorice Lane', 'Cookie Jar', 'Toffee Trail', 'Dentist Bill',
      'Choco Express', 'Bubblegum Bay', 'Surprise', 'Cotton Candy Cove', 'Marshmallow Mile',
      'Sticky Trap', 'Lollipop Lane', 'Sugar Mill', 'Gumdrop Grove', 'Jellybean Junction',
      'Caramel Express', 'Fudge Falls', 'Cookie Jar', 'Peppermint Park', 'Butterscotch Blvd',
      'Picnic', 'Cherry Sour St', 'Surprise', 'Strawberry Swirl', 'Raspberry Ridge',
      'Mint Express', 'Lemon Drop Drive', 'Honeycomb Heights', 'Syrup Springs', 'Banana Split Blvd',
      'Get Stuck!', 'Pistachio Plaza', 'Matcha Meadow', 'Cookie Jar', 'Key Lime Court',
      'Sprinkle Express', 'Surprise', 'Truffle Tower', 'Sugar Tax', 'Chocolate Palace',
    ],
  },
};

// Casino squares (7, 22, 36) replace the old Chance squares on every map. The old
// Chance/Tip-Off deck lives on as the casino's card deck (key 'chance' kept internally).
for (const [k, m] of Object.entries(MAPS)) {
  m.names[20] = k === 'underworld' ? 'Yellow Cab Co.' : 'Taxi Company'; // square 20: the taxi company (was Free Parking)
  m.casino = 'Casino';
  m.chance = 'Casino';
  m.names[7] = m.names[22] = m.names[36] = 'Casino';
}
MAPS.underworld.names[7] = 'The Ace of Clubs';MAPS.underworld.names[22] = 'The Golden Wheel';
MAPS.underworld.names[36] = 'Club Lucky Seven';

const THEMES = ['classic', 'neon', 'retro', 'ocean', 'candy'];
const { randomInt } = require('crypto');
const pick = a => a[randomInt(a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// "Mystery Mix": a brand-new board every game — names pulled from every world,
// group prices nudged up or down, random currency and random skin.
MAPS.random = { title: 'Mystery Mix', currency: '$', theme: 'random', chance: 'Casino', chest: 'Lucky Box', rail: 'Station', random: true };

function randomGame() {
  const worlds = Object.values(MAPS).filter(m => !m.random);
  const slotsOf = type => LAYOUT.map((l, i) => (l[0] === type ? i : -1)).filter(i => i >= 0);
  const pool = type => shuffle(worlds.flatMap(m => slotsOf(type).map(i => m.names[i])).filter((n, i, a) => a.indexOf(n) === i));
  const names = [...pick(worlds).names];
  for (const type of ['property', 'railroad', 'utility', 'tax']) {
    const p = pool(type);
    slotsOf(type).forEach((i, k) => { names[i] = p[k]; });
  }
  for (const i of [0, 10, 20, 30]) names[i] = pick(worlds).names[i];
  const deckWorld = pick(worlds);
  for (const i of slotsOf('casino')) names[i] = pick(worlds).names[i];
  for (const i of slotsOf('chest')) names[i] = deckWorld.names[2];

  const factor = {};
  for (const grp of Object.keys(GROUP_COLORS)) factor[grp] = 0.8 + randomInt(45) / 100; // 0.80–1.24
  const r10 = n => Math.max(10, Math.round(n / 10) * 10);
  const r1 = n => Math.max(1, Math.round(n));
  const board = LAYOUT.map(([type, group, price, rent, houseCost], i) => {
    const sp = { i, type, name: names[i] };
    if (group) {
      const f = factor[group];
      Object.assign(sp, { group, color: GROUP_COLORS[group], price: r10(price * f) * K, rent: rent.map(x => r1(x * f) * K), houseCost: r10(houseCost * f) * K });
    }
    if (type === 'railroad' || type === 'utility') sp.price = price * K;
    if (type === 'tax') sp.amount = r10(price * (0.7 + randomInt(61) / 100)) * K;
    return sp;
  });
  const meta = {
    title: pick(['Mystery Mix', 'Chaos Kingdom', 'Lucky Lands', 'Random Realm', 'Dice Island', 'Wild Card City']),
    currency: pick(['$', '€', '£', '₡', '¢', '¥']),
    theme: pick(THEMES),
    chance: 'Casino', chest: deckWorld.chest, casino: 'Casino',
    rail: worlds.find(w => w.names[5] === names[5])?.rail || 'Station',
  };
  return { board, meta };
}

function buildBoard(mapKey) {
  const map = MAPS[mapKey] || MAPS.classic;
  return LAYOUT.map(([type, group, price, rent, houseCost], i) => {
    const sp = { i, type, name: map.names[i] };
    if (group) { sp.group = group; sp.color = GROUP_COLORS[group]; }
    if (type === 'property') Object.assign(sp, { price: price * K, rent: rent.map(x => x * K), houseCost: houseCost * K });
    if (type === 'railroad' || type === 'utility') sp.price = price * K;
    if (type === 'tax') sp.amount = price * K;
    return sp;
  });
}

function buildGame(mapKey) {
  if (mapKey === 'random') return randomGame();
  const m = MAPS[mapKey] || MAPS.classic;
  return { board: buildBoard(mapKey), meta: { title: m.title, currency: m.currency, theme: m.theme, chance: m.chance, chest: m.chest, casino: m.casino, rail: m.rail } };
}

module.exports = { MAPS, buildBoard, buildGame };
