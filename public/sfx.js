// The back room's sound. Three layers share one master bus: the room itself (low tone, the bulb's hum, synthesized),
// a record playing slow jazz under its own crackle (synthesized), and foley for what happens on the table: recorded
// samples (public/assets/sfx/, all CC0 / public domain / CC-BY, see CREDITS.md) with random variants, and the old
// synthesized version of every sound as the fallback while a sample loads or if it fails. Buttons tick like
// typewriter keys. Nothing plays until the first click or key press (browsers require a gesture).
import { lighting } from './lighting.js';
const pref = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch {} };
let muted = pref('mono.muted', false), musicOn = pref('mono.music', true);
const level = (k, d) => { try { const v = parseFloat(localStorage.getItem(k)); return v >= 0 && v <= 1 ? v : d; } catch { return d; } };
let volume = level('mono.volume', 0.8), musicVolume = level('mono.musicVolume', 0.8);
const curve = v => v * v;                                   // sliders feel even to the ear
const masterGain = () => (muted ? 0 : curve(volume));
const recordGain = () => (musicOn ? RECORD_LEVEL * curve(musicVolume) / curve(0.8) : 0);
const RECORD_LEVEL = 0.3, ROOM_LEVEL = 0.7;

let ctx = null, master, fxBus, roomBus, recordIn, recordOut, verbIn, wowBus, humGain, noiseBuf;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const mtof = m => 440 * 2 ** ((m - 69) / 12);

// ------------------------------------------------------------------ plumbing

const gain = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
function biquad(type, f, q = 0.7, g = 0) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g; return b; }
function env(t, vol, attack, dur) {
  const n = ctx.createGain();
  n.gain.setValueAtTime(0.0001, t);
  n.gain.exponentialRampToValueAtTime(vol, t + attack);
  n.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  return n;
}
function buffer(sec, fill, channels = 1) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(channels, n, ctx.sampleRate);
  for (let c = 0; c < channels; c++) fill(b.getChannelData(c), n);
  return b;
}
const loop = (buf, dest) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(); return s; };

// ------------------------------------------------------------------ recorded samples
// Small mono mp3s, fetched and decoded lazily after the first gesture, cached, and played through the same buses as
// the synthesized sounds (so mute and the volume sliders cover them). A sample that is not ready, or failed, is
// simply skipped and the synthesized version plays instead.
const SAMPLE_DIR = '/assets/sfx/';
const SAMPLE_IDS = [
  'dice_shake1', 'dice_shake2', 'dice_shake3', 'die0', 'die1', 'die2', 'die3', 'hop1', 'hop2', 'hop3', 'land1', 'land2', 'fly1', 'fly2', 'fly3',
  'stamp1', 'stamp2', 'stamp3', 'build1', 'build2', 'build3', 'hammer1', 'hammer2', 'hammer3', 'hammer4', 'woodhammer1', 'woodhammer2', 'constructbed',
  'cash1', 'cash2', 'cash3', 'pay1', 'pay2', 'pay3', 'chips1', 'chips2', 'chips3', 'coin1', 'coin2', 'coin3', 'register', 'banknotes1', 'banknotes2',
  'cdraw1', 'cdraw2', 'cdraw3', 'cdraw4', 'cflip1', 'cflip2', 'cflip3', 'card1', 'card2', 'shuffle', 'cplace1', 'cplace2', 'paper1', 'paper2', 'paper3', 'paper4',
  'key1', 'key2', 'key3', 'hover1', 'hover2', 'hover3', 'tick1', 'tick2', 'tick4', 'wfinal', 'pop1', 'pop2',
  'clink0', 'clink1', 'clink2', 'bottle', 'gulp', 'pour', 'irondoor', 'doorlock', 'keys1', 'keys2', 'slam1', 'slam2', 'cardoor', 'horn',
  'creak1', 'creak2', 'creak3', 'step1', 'step2', 'step3', 'step4', 'wstep1', 'wstep2', 'wstep3', 'latch', 'click',
  'metal1', 'metal2', 'glassbreak', 'crumble1', 'crumble2', 'crumble3', 'collapse', 'spray', 'boom1', 'boom2',
  'shot1', 'shot2', 'shot3', 'gunfire', 'siren1', 'siren2', 'applause', 'cheer', 'fanfare', 'trumpet', 'camera', 'sting', 'hitlow1', 'hitlow2', 'hitmid',
  'laugh1', 'laugh2', 'needle',
];
const SAMPLE_TRIM = 0.32;                                   // the files are normalised hot; this sits them level with the synthesized foley
const buffers = new Map();                                  // id -> AudioBuffer, or null once it has failed
const pending = new Map();
function loadSample(id) {
  if (!ctx || buffers.has(id)) return Promise.resolve(buffers.get(id) || null);
  if (!pending.has(id)) {
    pending.set(id, fetch(SAMPLE_DIR + id + '.mp3')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => ctx.decodeAudioData(b))
      .then(buf => { buffers.set(id, buf); return buf; })
      .catch(() => { buffers.set(id, null); return null; })
      .finally(() => pending.delete(id)));
  }
  return pending.get(id);
}
function preload() {                                        // a few at a time, so the game's own requests are not starved
  const queue = SAMPLE_IDS.filter(id => !buffers.has(id));
  const worker = async () => { while (queue.length) await loadSample(queue.shift()); };
  for (let k = 0; k < 4; k++) worker();
}
// a random variant of base1, base2 … that is ready (and not the one just played), as an id; null when none is
const lastVariant = {};
function v(base, ...nums) {
  const ids = nums.map(n => base + n).filter(id => buffers.get(id));
  if (!ids.length) { for (const n of nums) if (!buffers.has(base + n)) loadSample(base + n); return null; }
  const pool = ids.length > 1 ? ids.filter(id => id !== lastVariant[base]) : ids;
  return (lastVariant[base] = pick(pool));
}
// play a sample at time t: vol is relative to a normal foley hit, rate shifts the pitch, a little random variation on both
function S(t, id, vol = 1, { rate = 1, vary = 0.035, dest = null, delay = 0 } = {}) {
  const b = id && buffers.get(id);
  if (!b) { if (id && !buffers.has(id)) loadSample(id); return false; }
  const src = ctx.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = rate * 2 ** (rand(-1, 1) * vary);
  const g = gain(vol * SAMPLE_TRIM * (1 + rand(-0.1, 0.1)));
  src.connect(g).connect(dest || fxBus);
  src.start(t + delay);
  src.onended = () => { try { g.disconnect(); } catch {} };
  return true;
}

// filtered noise: scrapes, paper, brushes, thuds
function hiss(t, { dur = 0.05, vol = 0.1, type = 'bandpass', freq = 2000, freqTo, q = 1, attack = 0.002, dest = fxBus } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = biquad(type, freq, q);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + attack + dur);
  s.connect(f).connect(env(t, vol, attack, dur)).connect(dest);
  s.start(t, Math.random() * 1.5, attack + dur + 0.05);
}
// a struck partial: knocks, clinks, metal
function ping(t, freq, { dur = 0.1, vol = 0.1, type = 'sine', freqTo, attack = 0.002, dest = fxBus } = {}) {
  const o = osc(type, freq);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t + attack + dur);
  o.connect(env(t, vol, attack, dur)).connect(dest);
  o.start(t); o.stop(t + attack + dur + 0.05);
}

function buildGraph() {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
  master = gain(masterGain());
  master.connect(comp).connect(ctx.destination);
  noiseBuf = buffer(2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });

  // a small wood-panelled room: short, dull reflections
  const verb = ctx.createConvolver();
  verb.buffer = buffer(1.1, (d, n) => { let lp = 0; for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.3; d[i] = lp * (1 - i / n) ** 3.4; } }, 2);
  verbIn = gain(1);
  verbIn.connect(verb).connect(gain(0.5)).connect(master);

  fxBus = gain(0.9);
  fxBus.connect(master);
  fxBus.connect(gain(0.3)).connect(verbIn);
  roomBus = gain(0);
  roomBus.connect(master);

  // the record player: band-limited, a touch saturated, wobbling slightly
  recordIn = gain(1);
  const sat = ctx.createWaveShaper();
  sat.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh((i / 511.5 - 1) * 1.6) / Math.tanh(1.6));
  recordOut = gain(0);
  recordIn.connect(biquad('highpass', 85)).connect(biquad('peaking', 1100, 0.9, 3)).connect(biquad('lowpass', 3400)).connect(sat).connect(recordOut);
  recordOut.connect(master);
  recordOut.connect(gain(0.6)).connect(verbIn);
  wowBus = gain(1);
  const wow = osc('sine', 0.55), flutter = osc('sine', 6.4);
  wow.connect(gain(7)).connect(wowBus); flutter.connect(gain(1.6)).connect(wowBus);
  wow.start(); flutter.start();
}

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    buildGraph();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ------------------------------------------------------------------ the room

let brown = null;
function startRoom() {
  const t = ctx.currentTime;
  // low room tone: brown noise, a deeper rumble of the city outside
  brown = buffer(6, (d, n) => { let v = 0; for (let i = 0; i < n; i++) { v = (v + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = v * 3.5; } });
  loop(brown, biquad('lowpass', 240)).connect(gain(0.012)).connect(roomBus);
  loop(brown, biquad('lowpass', 70)).connect(gain(0.022)).connect(roomBus);

  // the bulb: mains hum and a faint filament buzz
  humGain = gain(1);
  humGain.connect(roomBus);
  for (const [f, v] of [[60, 0.012], [120, 0.008], [180, 0.004], [240, 0.002]]) { const o = osc('sine', f); o.connect(gain(v)).connect(humGain); o.start(); }
  const buzz = osc('sawtooth', 120);
  buzz.connect(biquad('bandpass', 3200, 5)).connect(gain(0.0025)).connect(humGain);
  buzz.start();

  // the record's surface: hiss, crackle, one soft tick per revolution (33⅓ rpm)
  const crackle = buffer(7.2, (d, n) => {
    const sr = n / 7.2;
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.01;
    for (let k = 0; k < 7.2 * 18; k++) {
      const at = Math.floor(Math.random() * n), amp = Math.random() ** 3 * 0.5 + 0.02, len = 6 + Math.floor(Math.random() * 50), s = Math.random() < 0.5 ? -1 : 1;
      for (let j = 0; j < len && at + j < n; j++) d[at + j] += s * amp * (1 - j / len) ** 2;
    }
    for (let at = 0.4; at < 7.2; at += 1.8) { const i0 = Math.floor(at * sr); for (let j = 0; j < 300; j++) d[i0 + j] += 0.12 * Math.sin(j / 300 * Math.PI) * (j % 2 ? 1 : -1) * 0.5; }
  });
  loop(crackle, biquad('highpass', 700)).connect(gain(0.55)).connect(recordOut);

  startCity();
  applyScene(t);
  recordOut.gain.setTargetAtTime(recordGain(), t + 0.5, 1.0);
  setInterval(tick, 200);
}

// now and then a car passes in the street below
let nextCar = 0;
function tick() {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (!nextCar) nextCar = now + rand(30, 60);
  if (now > nextCar) {
    nextCar = now + rand(45, 110);
    hiss(now, { type: 'lowpass', freq: 220, freqTo: 600, q: 0.5, vol: 0.05, attack: 2.2, dur: 2.8, dest: roomBus });
  }
  schedule();
  if (cityBus && rainGain) {                                                  // Day / Night: the rain gives way to the daytime street
    const day = lighting.mode === 'day';
    if (day !== dayShown) { dayShown = day; rainGain.gain.setTargetAtTime(day ? 0 : 0.006, now, 0.8); dayAmb.gain.setTargetAtTime(day ? 1 : 0, now, 0.8); }
    if (day && sceneKind === 'city') {
      if (now > nextBird) { nextBird = now + rand(6, 16); const f = rand(2800, 4200); for (let k = 0; k < 3; k++) ping(now + k * 0.13, f * (1 + k * 0.06), { vol: 0.004, dur: 0.1, dest: cityBus }); }
    }
  }
  if (sceneKind === 'city' && lighting.mode !== 'day') { if (!nextSiren) nextSiren = now + rand(25, 60); if (now > nextSiren) { nextSiren = now + rand(60, 140); siren(now); } }
}

// ------------------------------------------------------------------ the record: slow minor jazz trio

function epiano(t, midi, vol = 0.04, dur = 1.6, dest = recordIn) {
  const f = mtof(midi);
  const car = osc('sine', f), mod = osc('sine', f), mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.45);   // bright strike, mellow tail
  mod.connect(mg).connect(car.frequency);
  const e = ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  e.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.3);
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  car.connect(e).connect(dest);
  wowBus.connect(car.detune); wowBus.connect(mod.detune);
  car.onended = () => { try { wowBus.disconnect(car.detune); wowBus.disconnect(mod.detune); } catch {} };
  for (const o of [car, mod]) { o.start(t); o.stop(t + dur + 0.05); }
}
function upright(t, midi, dur) {
  const f = mtof(midi);
  const lp = biquad('lowpass', 1300, 1.1);
  lp.frequency.setValueAtTime(1300, t); lp.frequency.exponentialRampToValueAtTime(360, t + 0.14);
  const e = ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(0.2, t + 0.008);
  e.gain.exponentialRampToValueAtTime(0.08, t + 0.2);
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(e).connect(recordIn);
  for (const [type, k] of [['triangle', 1], ['sine', 1]]) {
    const o = osc(type, f * k);
    o.connect(lp); wowBus.connect(o.detune);
    o.onended = () => { try { wowBus.disconnect(o.detune); } catch {} };
    o.start(t); o.stop(t + dur + 0.05);
  }
  hiss(t, { type: 'lowpass', freq: 260, vol: 0.06, dur: 0.035, dest: recordIn });     // fingers on the string
}
const brush = (t, vol, len = 0.17) => hiss(t, { type: 'bandpass', freq: 3600, q: 0.6, vol, attack: 0.025, dur: len, dest: recordIn });
function ride(t, vol) {
  hiss(t, { type: 'highpass', freq: 6800, vol, dur: 0.4, dest: recordIn });
  for (const f of [3170, 4730, 5990]) ping(t, f, { vol: vol * 0.22, dur: 0.7, dest: recordIn });
}

// ii–V in D minor, voiced rootless the way a pianist's left hand would
const DM9 = { root: 38, tones: [0, 3, 7, 10, 14], voicing: [53, 57, 60, 64] };
const GM9 = { root: 43, tones: [0, 3, 7, 10, 14], voicing: [53, 57, 58, 62] };
const EM7B5 = { root: 40, tones: [0, 3, 6, 10], voicing: [55, 58, 62, 64] };
const A7B9 = { root: 45, tones: [0, 4, 7, 10, 13], voicing: [55, 58, 61, 64] };
const BBMAJ7 = { root: 46, tones: [0, 4, 7, 11], voicing: [57, 58, 62, 65] };
const CHORUS = [DM9, DM9, GM9, GM9, EM7B5, A7B9, DM9, A7B9, BBMAJ7, BBMAJ7, EM7B5, A7B9, DM9, GM9, EM7B5, A7B9];
const BPM = 72, BEAT = 60 / BPM;
const COMP = [[0, 2.5], [1.5, 3], [0.5, 2], [0, 1.5, 3.5], [2.5], [1, 3.5], [0]];
const swing = p => Math.floor(p) + (p % 1 ? 0.667 : 0);
const fit = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };

let barN = 0, nextBarT = 0;
function playBar(n, t) {
  const bar = CHORUS[n % CHORUS.length], next = CHORUS[(n + 1) % CHORUS.length];
  const firstTime = n < CHORUS.length;                        // the head is played in two, then the bass walks
  const r = bar.root;
  const bassLine = firstTime
    ? [[0, r, 2], [2, fit(r + 7, 33, 50), 2]]
    : [[0, r, 1], [1, fit(r + pick(bar.tones.slice(1, 3)), 33, 52), 1], [2, fit(r + pick([7, bar.tones[3], 12]), 33, 52), 1], [3, fit(next.root + pick([-1, 1]), 33, 52), 1]];
  for (const [b, m, len] of bassLine) upright(t + b * BEAT, m, len * BEAT * 0.95);

  // drums with brushes: ride "ding, ding-da", swish on 2 and 4
  for (let b = 0; b < 4; b++) {
    ride(t + b * BEAT, b % 2 ? 0.016 : 0.022);
    if (b % 2) { ride(t + swing(b + 0.5) * BEAT, 0.011); brush(t + b * BEAT, 0.05); }
    else brush(t + b * BEAT, 0.018, 0.3);
  }

  // piano comping, and every so often a short phrase on top
  if (Math.random() < 0.85) for (const p of pick(COMP)) {
    const at = t + swing(p) * BEAT, v = rand(0.024, 0.036);
    bar.voicing.forEach((m, k) => epiano(at + k * 0.006, m, v, rand(0.7, 1.4) * BEAT * 2));
  }
  if (!firstTime && Math.random() < 0.4) {
    const pool = [...new Set(bar.tones.map(x => fit(r + x, 67, 81)))].sort((a, b) => a - b);
    let k = Math.floor(Math.random() * pool.length);
    const slots = [0, 0.5, 1, 1.5, 2, 2.5, 3].filter(() => Math.random() < 0.45).slice(0, 5);
    for (const s of slots) {
      k = Math.max(0, Math.min(pool.length - 1, k + pick([-1, -1, 1, 2, -2])));
      epiano(t + swing(s) * BEAT, pool[k], rand(0.028, 0.04), BEAT * 1.6);
    }
  }
}
function schedule() {
  if (!musicOn || muted) return;
  const now = ctx.currentTime;
  if (nextBarT < now) nextBarT = now + 0.1;                  // first start, or the tab was asleep
  while (nextBarT < now + 0.6) { playBar(barN++, nextBarT); nextBarT += 4 * BEAT; }
}


// ------------------------------------------------------------------ City Mode: the city at night
// City Mode sits in the same back room, so the room tone, the bulb and the record carry on. On top:
// rain on the city, traffic far off, now and then a siren, and the square under the mouse adds its own
// quiet layer: a radio behind a window, water at the docks, steam at the station, machinery at the works.
let sceneKind = 'table', cityBus = null, rainGain = null, dayAmb = null, dayShown = null, nextBird = 0, places = {}, placeKind = null, nextSiren = 0;
function startCity() {
  cityBus = gain(0);
  cityBus.connect(master);
  loop(brown, biquad('lowpass', 380)).connect(gain(0.014)).connect(cityBus);                       // traffic, far off
  rainGain = gain(0.006);
  loop(noiseBuf, biquad('highpass', 2500)).connect(biquad('lowpass', 8000)).connect(rainGain).connect(cityBus);   // rain
  dayAmb = gain(0);                                                                                // by day: a soft murmur of the street instead of the rain
  dayAmb.connect(cityBus);
  loop(brown, biquad('bandpass', 700, 0.5)).connect(gain(0.02)).connect(dayAmb);
  loop(noiseBuf, biquad('bandpass', 1800, 0.4)).connect(gain(0.0018)).connect(dayAmb);
  const layer = () => { const g = gain(0); g.connect(cityBus); return g; };
  places.street = layer();                                                                       // the record, through a little radio
  recordOut.connect(biquad('highpass', 700)).connect(biquad('lowpass', 2600)).connect(gain(1.6)).connect(places.street);
  places.docks = layer();                                                                        // water against the quay
  const sea = loop(brown, biquad('lowpass', 500)), seaGain = gain(0.03);
  const swell = osc('sine', 0.11), sd = gain(0.025);
  swell.connect(sd).connect(seaGain.gain); swell.start();
  sea.connect(seaGain).connect(places.docks);
  places.station = layer();                                                                      // steam escaping
  loop(noiseBuf, biquad('bandpass', 3000, 0.6)).connect(gain(0.006)).connect(places.station);
  places.works = layer();                                                                        // machinery
  const hum = osc('sawtooth', 50); hum.connect(biquad('lowpass', 160)).connect(gain(0.03)).connect(places.works); hum.start();
}
function applyScene(t) {
  roomBus.gain.setTargetAtTime(ROOM_LEVEL, t, 1.0);
  cityBus.gain.setTargetAtTime(sceneKind === 'city' ? 1 : 0, t, 1.0);
}
function siren(t) {                                    // two tones, far away, through the rain
  const o = osc('sine', 640), lp = biquad('lowpass', 1200), e = ctx.createGain();
  for (let k = 0; k < 8; k++) o.frequency.setValueAtTime(k % 2 ? 860 : 640, t + k * 0.55);
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.006, t + 1.2); e.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
  o.connect(lp).connect(e).connect(cityBus); o.start(t); o.stop(t + 4.5);
}
// occasional sounds that belong to a place
function placeAccent(kind, t) {
  if (kind === 'station') { ping(t, 1760, { vol: 0.02, dur: 1.2 }); ping(t, 2637, { vol: 0.01, dur: 0.9 }); }
  else if (kind === 'docks') { ping(t, 98, { vol: 0.05, dur: 2.2, attack: 0.3 }); ping(t, 147, { vol: 0.02, dur: 2.0, attack: 0.3 }); }   // a foghorn
  else if (kind === 'street') { hiss(t, { type: 'lowpass', freq: 220, vol: 0.06, dur: 0.12 }); ping(t + 0.05, 1900, { vol: 0.008, dur: 0.04 }); }   // a door closing
}

// ------------------------------------------------------------------ start on the first gesture

let started = false;
function wake() {
  if (!ac() || started) return;
  started = true;
  startRoom();
  preload();
  loadSample('needle').then(() => { if (ctx && !muted && musicOn && ctx.currentTime < 20) S(ctx.currentTime + 0.1, 'needle', 3, { dest: recordOut, vary: 0 }); });   // the needle comes down on the record
}
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);

// UI buttons click like typewriter keys
addEventListener('click', e => { if (e.target.closest && e.target.closest('button, select, input[type=checkbox]')) sfx.key(); }, true);
// … and a soft rollover when the mouse moves onto one
let hoverEl = null, hoverAt = 0;
addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest && e.target.closest('button, select');
  if (!el || el === hoverEl) { if (!el) hoverEl = null; return; }
  hoverEl = el;
  const now = performance.now();
  if (el.disabled || now - hoverAt < 70) return;
  hoverAt = now; sfx.hover();
}, true);

// every foley sound: skip when muted or before the first gesture
const fx = fn => (...a) => { if (!ctx || muted) return; fn(ctx.currentTime + 0.01, ...a); };
function shuffle(t, n, low = 1) {                    // banknotes being counted
  for (let k = 0; k < n; k++) {
    const at = t + k * rand(0.05, 0.09);
    hiss(at, { type: 'bandpass', freq: rand(2800, 4600) * low, q: 0.9, vol: rand(0.025, 0.04), attack: 0.008, dur: rand(0.04, 0.08) });
    hiss(at + 0.01, { type: 'highpass', freq: 6000, vol: 0.012, dur: 0.02 });
  }
}
function clink(t, vol = 0.05) {                      // ice against glass
  const base = rand(2400, 2900);
  for (const k of [1, 1.53, 2.27, 3.1]) ping(t, base * k, { vol: vol / k, dur: 0.18 / k + 0.05 });
}

// a muted brass note: two detuned saws through a closing low-pass
function brassNote(t, midi, dur, vol = 0.05, dest = fxBus) {
  const f = mtof(midi), lp = biquad('lowpass', 500, 1.2), e = ctx.createGain();
  lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.08); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.03); e.gain.setValueAtTime(vol, t + dur * 0.6); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(e).connect(dest);
  for (const d of [-6, 6]) { const o = osc('sawtooth', f); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
}
const bell = (t, midi, vol = 0.03) => { for (const k of [1, 2.76, 5.4]) ping(t, mtof(midi) * k, { vol: vol / k, dur: 1.2 / k + 0.2 }); };   // a till bell

let accentTimer = null;
export const sfx = {
  // which mode is on screen: 'table' or 'city' (the model city, in the same room)
  setScene(kind) {
    sceneKind = kind === 'city' ? 'city' : 'table';
    if (ctx && cityBus) applyScene(ctx.currentTime);
    if (sceneKind !== 'city') this.place(null);
  },
  // the square under the mouse: 'street', 'docks', 'station', 'works' or null
  place(kind) {
    if (kind === placeKind) return;
    placeKind = kind;
    clearInterval(accentTimer);
    if (!ctx || !cityBus) return;
    const t = ctx.currentTime;
    for (const [k, g] of Object.entries(places)) g.gain.setTargetAtTime(k === kind ? 1 : 0, t, 0.35);
    if (kind && !muted) { placeAccent(kind, t + 0.4); accentTimer = setInterval(() => { if (ctx && !muted && Math.random() < 0.35) placeAccent(placeKind, ctx.currentTime + 0.05); }, 5000); }
  },
  get muted() { return muted; },
  get music() { return musicOn; },
  get volume() { return volume; },
  get musicVolume() { return musicVolume; },
  setVolume(v) {                                             // 0…1, everything
    volume = Math.max(0, Math.min(1, v)); try { localStorage.setItem('mono.volume', volume); } catch {}
    if (ctx) master.gain.setTargetAtTime(masterGain(), ctx.currentTime, 0.05);
  },
  setMusicVolume(v) {                                        // 0…1, just the record
    musicVolume = Math.max(0, Math.min(1, v)); try { localStorage.setItem('mono.musicVolume', musicVolume); } catch {}
    if (ctx) recordOut.gain.setTargetAtTime(recordGain(), ctx.currentTime, 0.05);
  },
  toggle() {
    muted = !muted; save('mono.muted', muted);
    if (ctx) master.gain.setTargetAtTime(masterGain(), ctx.currentTime, 0.08);
    return muted;
  },
  toggleMusic() {
    musicOn = !musicOn; save('mono.music', musicOn);
    if (ctx) recordOut.gain.setTargetAtTime(recordGain(), ctx.currentTime, 0.3);
    return musicOn;
  },
};

// ------------------------------------------------------------------ the synthesized foley (the fallback for every recorded sound)
const synth = {
  // dice leave the hand: a rattle in the palm, then the physics plays each hit with click()
  dice: fx(t => { for (let k = 0; k < 3; k++) ping(t + k * 0.04, rand(1900, 2600), { vol: 0.02, dur: 0.02 }); hiss(t, { type: 'bandpass', freq: 1500, vol: 0.03, attack: 0.04, dur: 0.12 }); }),
  click: fx((t, k = 0.6) => {                        // a die hitting cardboard
    hiss(t, { type: 'bandpass', freq: rand(1800, 3000), q: 1.4, vol: 0.04 + 0.2 * k, dur: 0.025 });
    hiss(t, { type: 'lowpass', freq: 520, vol: 0.12 * k, dur: 0.05 });
    ping(t, rand(150, 200), { vol: 0.07 * k, dur: 0.06 });
  }),
  hop: fx(t => {                                     // pewter tapping along the board
    ping(t, rand(2300, 2700), { vol: 0.012, dur: 0.03 });
    hiss(t, { type: 'lowpass', freq: 700, vol: 0.08, dur: 0.035 });
    ping(t, rand(180, 220), { vol: 0.04, dur: 0.05 });
  }),
  land: fx(t => { hiss(t, { type: 'lowpass', freq: 600, vol: 0.13, dur: 0.06 }); ping(t, 140, { vol: 0.07, dur: 0.1 }); ping(t, 2500, { vol: 0.01, dur: 0.05 }); }),
  fly: fx(t => hiss(t, { type: 'bandpass', freq: 500, freqTo: 1800, q: 0.8, vol: 0.04, attack: 0.15, dur: 0.4 })),
  cash: fx(t => shuffle(t, 4)),
  pay: fx(t => shuffle(t, 3, 0.8)),
  buy: fx(t => {                                     // a rubber stamp on the deed
    hiss(t, { type: 'lowpass', freq: 320, vol: 0.3, dur: 0.07 });
    ping(t, 95, { vol: 0.16, dur: 0.11 });
    hiss(t + 0.004, { type: 'bandpass', freq: 1800, vol: 0.09, dur: 0.05 });
  }),
  build: fx(t => {                                   // a wooden piece set down
    for (const [f, v] of [[720, 0.07], [1310, 0.04], [2140, 0.015]]) ping(t, f * rand(0.95, 1.05), { vol: v, dur: 0.07 });
    hiss(t, { type: 'bandpass', freq: 1000, q: 3, vol: 0.06, dur: 0.03 });
  }),
  construct: fx(t => {                               // City Mode, a building going up: hammer taps, a ratchet winding, a low rumble under it all
    hiss(t + 0.1, { type: 'lowpass', freq: 85, vol: 0.2, attack: 0.35, dur: 1.5 }); ping(t + 0.1, 44, { vol: 0.09, attack: 0.3, dur: 1.5 });
    for (const at of [0, 0.17, 0.29, 0.55, 0.68, 0.81, 1.22, 1.35]) {
      ping(t + at, rand(880, 1250), { vol: 0.055, dur: 0.05 }); ping(t + at, rand(150, 210), { vol: 0.05, dur: 0.08 });
      hiss(t + at, { type: 'bandpass', freq: rand(2200, 3000), q: 2, vol: 0.05, dur: 0.02 });
    }
    for (let k = 0, at = 0.9; k < 12; k++, at += 0.035 + k * 0.004) { ping(t + at, 2400 + k * 40, { vol: 0.02, dur: 0.012 }); hiss(t + at, { type: 'highpass', freq: 3800, vol: 0.03, dur: 0.01 }); }
  }),
  card: fx(t => {                                    // a card slid off the deck and turned over
    hiss(t, { type: 'bandpass', freq: 2400, freqTo: 4800, q: 0.8, vol: 0.045, attack: 0.06, dur: 0.22 });
    hiss(t + 0.3, { type: 'highpass', freq: 3000, vol: 0.09, dur: 0.02 });
  }),
  jail: fx(t => {                                    // a cell door slamming
    hiss(t, { type: 'lowpass', freq: 400, vol: 0.25, dur: 0.12 });
    for (const [f, d] of [[182, 1.4], [431, 1.1], [767, 0.9], [1123, 0.7], [1597, 0.5]]) ping(t, f, { vol: 0.04, dur: d });
    ping(t + 0.42, 2900, { vol: 0.03, dur: 0.04 }); hiss(t + 0.42, { type: 'bandpass', freq: 3500, vol: 0.05, dur: 0.03 });   // the latch
  }),
  turn: fx(t => { clink(t); clink(t + 0.13, 0.03); }),   // your move: ice settles in the glass
  ice: fx(t => clink(t, 0.035)),
  pour: fx(t => { for (let k = 0; k < 7; k++) ping(t + k * rand(0.07, 0.12), rand(260, 420), { freqTo: rand(500, 800), vol: 0.03, dur: 0.06 }); }),
  rumble: fx(t => { hiss(t, { type: 'lowpass', freq: 90, vol: 0.2, attack: 0.25, dur: 1.4 }); ping(t, 46, { vol: 0.1, attack: 0.2, dur: 1.4 }); }),   // a building rising
  pop: fx(t => { ping(t, 320, { vol: 0.05, dur: 0.05 }); hiss(t, { type: 'bandpass', freq: 1500, vol: 0.03, dur: 0.02 }); }),
  coins: fx(t => {                                   // chips clacking, then notes counted over
    for (let k = 0; k < 5; k++) { const at = t + k * rand(0.05, 0.08); ping(at, rand(2900, 3600), { vol: 0.03, dur: 0.03 }); hiss(at, { type: 'highpass', freq: 4000, vol: 0.03, dur: 0.015 }); }
    shuffle(t + 0.35, 3);
  }),
  chaos: fx(t => {                                   // a low, dissonant hit on the piano
    hiss(t, { type: 'lowpass', freq: 180, vol: 0.2, dur: 0.3 });
    for (const m of [26, 33, 39, 40, 44]) epiano(t, m, 0.07, 3.2, fxBus);
  }),
  win: fx(t => { [50, 53, 57, 60, 64, 69].forEach((m, k) => epiano(t + k * 0.11, m, 0.05, 2.6, fxBus)); [38, 53, 57, 60, 64].forEach(m => epiano(t + 0.9, m, 0.045, 3.5, fxBus)); }),
  lighter: fx(t => {                                 // lid, wheel, flame
    ping(t, 3300, { vol: 0.03, dur: 0.02 }); hiss(t, { type: 'bandpass', freq: 4200, vol: 0.05, dur: 0.02 });
    for (let k = 0; k < 6; k++) hiss(t + 0.25 + k * 0.012, { type: 'bandpass', freq: rand(2500, 4500), q: 2, vol: 0.05, dur: 0.01 });
    hiss(t + 0.3, { type: 'lowpass', freq: 380, freqTo: 900, vol: 0.09, attack: 0.06, dur: 0.5 });
  }),
  mafia: fx(t => {                                   // a low minor chord on the piano, then a lighter flicked open
    for (const m of [38, 45, 48, 51, 55]) epiano(t + (m % 5) * 0.012, m, 0.06, 3, fxBus);
    ping(t + 0.9, 3300, { vol: 0.025, dur: 0.02 }); hiss(t + 0.9, { type: 'bandpass', freq: 4200, vol: 0.04, dur: 0.02 });
    hiss(t + 1.1, { type: 'bandpass', freq: 3200, q: 2, vol: 0.04, dur: 0.012 });
  }),
  mafiaNote: fx(t => {                               // paper slid under a door, then footsteps going away down the hall
    hiss(t, { type: 'bandpass', freq: 2600, freqTo: 1100, q: 0.7, vol: 0.09, attack: 0.1, dur: 0.7 });
    hiss(t + 0.15, { type: 'highpass', freq: 5000, vol: 0.02, attack: 0.2, dur: 0.5 });
    for (let k = 0; k < 6; k++) { const at = t + 1.1 + k * 0.42 + (k % 2) * 0.03, v = 0.05 * (1 - k * 0.14); hiss(at, { type: 'lowpass', freq: 420, vol: v, dur: 0.06 }); ping(at, 95 - k * 4, { vol: v * 0.7, dur: 0.08 }); }
  }),
  roulette: fx(t => {                                // the wheel whirring down, the ball rattling round the rim and dropping in
    hiss(t, { type: 'bandpass', freq: 700, freqTo: 240, q: 1.1, vol: 0.05, attack: 0.25, dur: 2.5 });
    ping(t, 120, { freqTo: 60, vol: 0.035, attack: 0.3, dur: 2.5, type: 'triangle' });
    let at = 0, gap = 0.032;
    while (at < 2.2) { ping(t + at, rand(2300, 3300), { vol: 0.022, dur: 0.02 }); hiss(t + at, { type: 'highpass', freq: 5000, vol: 0.02, dur: 0.012 }); at += gap; gap *= 1.085; }
    for (const d of [0.1, 0.17, 0.21]) { ping(t + at + d, rand(1500, 2100), { vol: 0.03, dur: 0.03 }); hiss(t + at + d, { type: 'lowpass', freq: 900, vol: 0.05, dur: 0.03 }); }   // the last hops
    ping(t + at + 0.25, 180, { vol: 0.05, dur: 0.08 });
  }),
  // a sting for each thing the casino can do: warm for the good ones, cold for the bad
  casinoEvent: fx((t, key) => {
    if (key === 'whim') {                            // cash register, then a soft jazz chord
      hiss(t, { type: 'lowpass', freq: 500, vol: 0.12, dur: 0.06 }); bell(t + 0.05, 96, 0.05); bell(t + 0.2, 103, 0.03); shuffle(t + 0.35, 4);
      [50, 57, 62, 65, 69].forEach((m, k) => epiano(t + 0.5 + k * 0.012, m, 0.04, 2.6, fxBus));
    } else if (key === 'mayor') {                    // a short brass fanfare and a camera flash
      [[60, 0], [64, 0.14], [67, 0.28]].forEach(([m, d]) => brassNote(t + d, m, 0.22, 0.04)); brassNote(t + 0.45, 72, 0.7, 0.05); brassNote(t + 0.45, 64, 0.7, 0.035);
      hiss(t + 0.8, { type: 'highpass', freq: 3500, vol: 0.12, dur: 0.05 }); ping(t + 0.8, 5200, { vol: 0.03, dur: 0.12 });
    } else if (key === 'boom') {                     // a crowd roaring, a bright chord over it
      hiss(t, { type: 'bandpass', freq: 1200, freqTo: 2400, q: 0.5, vol: 0.08, attack: 0.25, dur: 1.5 });
      [55, 62, 66, 71, 74, 78].forEach((m, k) => epiano(t + 0.1 + k * 0.05, m, 0.045, 3, fxBus));
      for (let k = 0; k < 6; k++) hiss(t + 0.6 + k * 0.09, { type: 'bandpass', freq: rand(1500, 3500), q: 1.5, vol: 0.05, dur: 0.05 });   // a few claps
    } else if (key === 'police') {                   // a far-off siren over low brass
      const o = osc('sine', 640), lp = biquad('lowpass', 1500), e = ctx.createGain();
      for (let k = 0; k < 4; k++) o.frequency.setValueAtTime(k % 2 ? 860 : 640, t + k * 0.5);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.028, t + 0.3); e.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
      o.connect(lp).connect(e).connect(fxBus); o.start(t); o.stop(t + 2.2);
      brassNote(t, 38, 1.4, 0.05); brassNote(t + 0.02, 41, 1.4, 0.035);
    } else if (key === 'gang') {                     // a low brass hit and breaking glass
      brassNote(t, 36, 0.9, 0.06); brassNote(t, 43, 0.9, 0.04);
      hiss(t + 0.35, { type: 'highpass', freq: 3500, vol: 0.14, dur: 0.1 });
      for (let k = 0; k < 9; k++) ping(t + 0.37 + k * rand(0.03, 0.07), rand(3000, 6500), { vol: 0.02, dur: 0.06 });
    } else if (key === 'onetoomany') {               // glass clink, a slurred low brass slide, a bottle rolling away
      for (const [f, d] of [[3100, 0], [4300, 0.01], [5600, 0.02]]) ping(t + d, f, { vol: 0.04, dur: 0.35 });
      const o = osc('sawtooth', 220), lp = biquad('lowpass', 700), e = ctx.createGain();
      o.frequency.setValueAtTime(220, t + 0.5); o.frequency.exponentialRampToValueAtTime(110, t + 1.7);
      e.gain.setValueAtTime(0.0001, t + 0.5); e.gain.exponentialRampToValueAtTime(0.035, t + 0.8); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(lp).connect(e).connect(fxBus); o.start(t + 0.5); o.stop(t + 1.9);
      for (let k = 0; k < 10; k++) hiss(t + 1.2 + k * (0.09 + k * 0.012), { type: 'bandpass', freq: 300 + k * 25, q: 2, vol: 0.05, dur: 0.07 });
    } else if (key === 'bombing') {                  // a deep boom, then debris rattling down
      hiss(t, { type: 'lowpass', freq: 160, vol: 0.4, attack: 0.01, dur: 1.2 }); ping(t, 55, { freqTo: 28, vol: 0.3, dur: 1.4 });
      for (let k = 0; k < 14; k++) { hiss(t + 0.35 + k * rand(0.05, 0.12), { type: 'bandpass', freq: rand(600, 2500), q: 2, vol: 0.05, dur: 0.04 }); }
    }
  }),
  paper: fx(t => hiss(t, { type: 'bandpass', freq: 2200, freqTo: 1200, q: 0.7, vol: 0.1, attack: 0.12, dur: 0.5 })),   // a letter slid across the table
  // a dealer's shuffle: two riffles (a ripple of cards thumbing together), the bridge (a quick arch and a soft slap), a cut, then the squaring of the deck
  shuffle: fx(t => {
    const riffle = (at, n) => { for (let k = 0; k < n; k++) { const a = at + k * (0.022 + 0.006 * Math.sin(k * 0.9)) + rand(0, 0.006); hiss(a, { type: 'bandpass', freq: rand(2600, 5200), q: 1.2, vol: rand(0.02, 0.04), attack: 0.002, dur: 0.018 }); } };
    const bridge = at => { hiss(at, { type: 'bandpass', freq: 1500, freqTo: 4200, q: 0.8, vol: 0.05, attack: 0.05, dur: 0.3 }); hiss(at + 0.32, { type: 'lowpass', freq: 900, vol: 0.08, attack: 0.004, dur: 0.07 }); ping(at + 0.32, 150, { vol: 0.04, dur: 0.07 }); };
    riffle(t + 0.45, 20); riffle(t + 1.05, 22); bridge(t + 1.35);
    riffle(t + 1.9, 18); hiss(t + 2.35, { type: 'highpass', freq: 3000, vol: 0.07, dur: 0.025 }); hiss(t + 2.38, { type: 'lowpass', freq: 700, vol: 0.06, dur: 0.05 });
  }),
  // one tick of a spinning wheel's pointer on a peg; final = the soft clack when it comes to rest
  wheelTick: fx((t, final) => {
    if (final) { ping(t, 330, { vol: 0.05, dur: 0.1, type: 'triangle' }); hiss(t, { type: 'lowpass', freq: 1100, vol: 0.07, dur: 0.06 }); return; }
    ping(t, rand(1500, 1800), { vol: 0.035, dur: 0.025 }); hiss(t, { type: 'bandpass', freq: rand(2800, 3600), q: 2, vol: 0.04, dur: 0.012 });
  }),
  cardDraw: fx(t => hiss(t, { type: 'bandpass', freq: 1800, freqTo: 3800, q: 0.7, vol: 0.05, attack: 0.05, dur: 0.28 })),   // a card slid off the deck
  cardFlip: fx(t => { hiss(t, { type: 'bandpass', freq: 3200, freqTo: 1500, q: 0.9, vol: 0.05, attack: 0.03, dur: 0.16 }); hiss(t + 0.17, { type: 'highpass', freq: 3000, vol: 0.07, dur: 0.02 }); }),
  // one sting for each card of the new deck (and for evictions, audits, shoot-outs)
  cardSting: fx((t, key) => {
    const siren = (at, dur, vol = 0.026) => {
      const o = osc('sine', 640), lp = biquad('lowpass', 1500), e = ctx.createGain();
      for (let k = 0; k < Math.ceil(dur / 0.5); k++) o.frequency.setValueAtTime(k % 2 ? 860 : 640, at + k * 0.5);
      e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(vol, at + 0.25); e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(lp).connect(e).connect(fxBus); o.start(at); o.stop(at + dur + 0.05);
    };
    const creak = (at, dur = 0.7, f0 = 180) => {      // a door on dry hinges
      const o = osc('sawtooth', f0), bp = biquad('bandpass', 700, 6), e = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(f0 * 1.9, at + dur * 0.5); o.frequency.exponentialRampToValueAtTime(f0 * 1.2, at + dur);
      e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(0.03, at + 0.12); e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(bp).connect(e).connect(fxBus); o.start(at); o.stop(at + dur + 0.05);
    };
    const glass = at => { hiss(at, { type: 'highpass', freq: 3500, vol: 0.12, dur: 0.1 }); for (let k = 0; k < 8; k++) ping(at + 0.02 + k * rand(0.03, 0.07), rand(3000, 6500), { vol: 0.02, dur: 0.06 }); };
    const rummage = at => { for (let k = 0; k < 7; k++) hiss(at + k * rand(0.08, 0.15), { type: 'bandpass', freq: rand(500, 1800), q: 1.5, vol: 0.05, dur: 0.07 }); };
    const shots = (at, n) => { for (let k = 0; k < n; k++) { const a = at + k * rand(0.09, 0.2); hiss(a, { type: 'bandpass', freq: rand(900, 1500), q: 0.7, vol: 0.2, attack: 0.001, dur: 0.07 }); hiss(a, { type: 'lowpass', freq: 240, vol: 0.14, attack: 0.001, dur: 0.12 }); } };
    if (key === 'gang') {                              // a low brass hit and a crowbar clank
      brassNote(t, 36, 0.9, 0.06); brassNote(t, 43, 0.9, 0.04);
      for (const f of [1, 2.7, 5.1]) ping(t + 0.3, 900 * f, { vol: 0.06 / f, dur: 0.5 / f + 0.05 });
      hiss(t + 0.3, { type: 'highpass', freq: 4000, vol: 0.08, dur: 0.03 });
    } else if (key === 'squatters') { creak(t); rummage(t + 0.8);
    } else if (key === 'protection') {                 // a car door and a radio squelch
      hiss(t, { type: 'lowpass', freq: 500, vol: 0.2, dur: 0.1 }); hiss(t + 0.01, { type: 'bandpass', freq: 2200, vol: 0.05, dur: 0.04 });
      hiss(t + 0.45, { type: 'bandpass', freq: 1800, freqTo: 900, q: 3, vol: 0.06, attack: 0.02, dur: 0.35 }); ping(t + 0.8, 1200, { vol: 0.02, dur: 0.08 });
    } else if (key === 'squattersin') { creak(t, 0.6, 150); glass(t + 0.7);
    } else if (key === 'crime') {                      // a siren and rain swelling
      siren(t, 2.2); hiss(t, { type: 'highpass', freq: 3000, vol: 0.05, attack: 1.2, dur: 1.4 });
    } else if (key === 'billionaire') {                // cash register, soft jazz chord
      hiss(t, { type: 'lowpass', freq: 500, vol: 0.12, dur: 0.06 }); bell(t + 0.05, 96, 0.05); bell(t + 0.2, 103, 0.03); shuffle(t + 0.35, 4);
      [50, 57, 62, 65, 69].forEach((m, k) => epiano(t + 0.5 + k * 0.012, m, 0.04, 2.6, fxBus));
    } else if (key === 'gift') {                       // camera flashes and a brass flourish
      for (const d of [0, 0.15, 0.3]) { hiss(t + d, { type: 'highpass', freq: 3500, vol: 0.1, dur: 0.05 }); ping(t + d, 5200, { vol: 0.025, dur: 0.1 }); }
      [[60, 0.35], [64, 0.5], [67, 0.65]].forEach(([m, d]) => brassNote(t + d, m, 0.22, 0.04)); brassNote(t + 0.85, 72, 0.7, 0.05); brassNote(t + 0.85, 64, 0.7, 0.035);
    } else if (key === 'bribe') {                      // envelope slide, cash rustle, a low "hmm" of brass
      hiss(t, { type: 'bandpass', freq: 2200, freqTo: 900, q: 0.7, vol: 0.09, attack: 0.1, dur: 0.45 });
      for (let k = 0; k < 6; k++) hiss(t + 0.55 + k * rand(0.05, 0.1), { type: 'bandpass', freq: rand(2500, 5000), q: 1.4, vol: 0.04, dur: 0.04 });
      brassNote(t + 1.0, 41, 0.9, 0.045); brassNote(t + 1.0, 44, 0.9, 0.03);
    } else if (key === 'shootout') { shots(t, 6); siren(t + 0.8, 1.6, 0.02);
    } else if (key === 'evict') {                      // a door slam
      hiss(t, { type: 'lowpass', freq: 350, vol: 0.28, dur: 0.14 });
      for (const [f, d] of [[150, 0.9], [330, 0.7], [610, 0.5]]) ping(t, f, { vol: 0.05, dur: d });
    } else if (key === 'audit') {                      // typewriter, then a stamp
      for (let k = 0; k < 6; k++) { const a = t + k * 0.07; hiss(a, { type: 'highpass', freq: 2600, vol: 0.03, dur: 0.012 }); hiss(a + 0.004, { type: 'lowpass', freq: 380, vol: 0.035, dur: 0.03 }); }
      hiss(t + 0.6, { type: 'lowpass', freq: 300, vol: 0.2, dur: 0.1 }); ping(t + 0.6, 120, { vol: 0.08, dur: 0.15 });
    } else if (key === 'classic') { hiss(t, { type: 'highpass', freq: 3000, vol: 0.05, dur: 0.02 }); }
  }),
  key: fx(t => {                                     // typewriter key
    hiss(t, { type: 'highpass', freq: 2600, vol: 0.03, dur: 0.012 });
    ping(t, 1700, { vol: 0.007, dur: 0.02 });
    hiss(t + 0.004, { type: 'lowpass', freq: 380, vol: 0.035, dur: 0.03 });
  }),
  flicker: fx((t, depth = 0.06) => {                 // the bulb stutters: hum dips, filament ticks
    if (!humGain) return;
    humGain.gain.setValueAtTime(1, t); humGain.gain.linearRampToValueAtTime(1 - depth * 6, t + 0.02); humGain.gain.linearRampToValueAtTime(1, t + 0.15);
    hiss(t, { type: 'bandpass', freq: 6000, q: 2, vol: 0.02, dur: 0.012 });
  }),
  hover: () => {},                                   // (recorded only) a button under the mouse
  bankrupt: fx(t => synth.chaos(t)),                 // a player goes under
  taxi: fx(t => { ping(t, 430, { type: 'square', vol: 0.02, dur: 0.18 }); ping(t + 0.3, 540, { type: 'square', vol: 0.02, dur: 0.18 }); }),   // two beeps of a horn
};

// ------------------------------------------------------------------ the recorded versions
// over[name] plays the recorded version and returns true (the synthesized one is skipped), or false when its main
// sample is not ready (the synthesized one plays instead). plus[name] lays samples over the synthesized sound.
const first = (...r) => r[0];                                // run every S() call, report the first (the main sample)
const any = (...r) => r.some(Boolean);
const chord = (t, notes, vol, dur = 2.4) => notes.forEach((m, k) => epiano(t + k * 0.012, m, vol, dur, fxBus));
const coin = () => v('coin', 1, 2, 3);

// the casino's events: warm for the good ones (till, brass, a crowd), cold for the bad (low hits, sirens, breaking glass)
const CASINO = {
  whim: t => { const ok = first(S(t, 'register', 1.1), S(t + 0.08, coin(), 0.6), S(t + 0.5, 'laugh1', 0.85)); chord(t + 1, [50, 57, 62, 65, 69], 0.025); return ok; },   // the till, a rich man's chuckle, a soft chord
  mayor: t => first(S(t, 'fanfare', 1.1), S(t + 0.95, 'camera', 0.8), S(t + 1.1, 'applause', 0.55)),
  boom: t => { const ok = first(S(t, 'cheer', 1), S(t + 0.15, 'applause', 0.9), S(t + 0.4, coin(), 0.5)); chord(t + 0.1, [55, 62, 66, 71, 74, 78], 0.03, 3); return ok; },
  police: t => first(S(t, 'siren1', 1.2), S(t, 'hitlow2', 0.6)),
  gang: t => first(S(t, 'hitlow1', 0.9), S(t + 0.28, 'spray', 0.9), S(t + 0.5, 'glassbreak', 1)),   // a low hit, the spray can, a window
  onetoomany: t => {                                         // a glass clink, a gulp, a bottle set down, then a slurred low slide
    const ok = first(S(t, v('clink', 0, 1, 2), 1), S(t + 0.04, v('clink', 0, 1, 2), 0.6), S(t + 0.55, 'gulp', 0.9), S(t + 1, 'bottle', 0.8));
    const o = osc('sawtooth', 220), lp = biquad('lowpass', 700), e = ctx.createGain();
    o.frequency.setValueAtTime(220, t + 0.7); o.frequency.exponentialRampToValueAtTime(110, t + 1.9);
    e.gain.setValueAtTime(0.0001, t + 0.7); e.gain.exponentialRampToValueAtTime(0.03, t + 1); e.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    o.connect(lp).connect(e).connect(fxBus); o.start(t + 0.7); o.stop(t + 2.1);
    return ok;
  },
  bombing: t => { const ok = first(S(t, 'boom1', 1.5), S(t + 0.5, 'crumble1', 1.1), S(t + 0.8, 'crumble2', 1), S(t + 1.15, 'crumble3', 0.8)); ping(t, 55, { freqTo: 28, vol: 0.18, dur: 1.4 }); return ok; },
  gangwar: t => first(S(t, 'boom2', 1.2), S(t + 0.5, 'gunfire', 1), S(t + 1.8, 'siren2', 0.5)),   // (the global wheel's Gang War)
};
// one for each card, and for evictions, audits and shoot-outs
const STING = {
  gang: t => first(S(t, 'hitlow1', 0.8), S(t + 0.3, 'metal1', 0.9), S(t + 0.62, 'metal2', 0.5)),   // a low hit and a crowbar
  squatters: t => first(S(t, v('creak', 1, 2), 1), S(t + 0.8, v('wstep', 1, 2, 3), 0.8), S(t + 1.1, v('wstep', 1, 2, 3), 0.7), S(t + 1.5, v('fly', 1, 2, 3), 0.8), S(t + 1.8, v('fly', 1, 2, 3), 0.6)),   // a door, footsteps, rummaging
  protection: t => first(S(t, 'cardoor', 1), S(t + 0.45, 'click', 0.5), S(t + 0.6, 'siren2', 0.7)),   // a car door, a radio, a siren far off
  squattersin: t => first(S(t, 'creak3', 1), S(t + 0.7, 'glassbreak', 0.9)),
  crime: t => { const ok = first(S(t, 'siren2', 1.1), S(t + 0.2, 'hitlow2', 0.5)); hiss(t, { type: 'highpass', freq: 3000, vol: 0.05, attack: 1.2, dur: 1.4 }); return ok; },
  billionaire: t => { const ok = first(S(t, 'register', 1.1), S(t + 0.1, coin(), 0.6), S(t + 0.5, 'laugh2', 0.9)); chord(t + 1, [50, 57, 62, 65, 69], 0.025); return ok; },
  gift: t => first(S(t, 'camera', 0.8), S(t + 0.18, 'camera', 0.7), S(t + 0.36, 'camera', 0.6), S(t + 0.5, 'fanfare', 1), S(t + 1.1, 'applause', 0.55)),
  bribe: t => first(S(t, v('paper', 1, 2, 3, 4), 1), S(t + 0.5, v('banknotes', 1, 2), 1), S(t + 1, coin(), 0.7), S(t + 1.1, 'hitmid', 0.6)),   // an envelope, notes, a low "hmm"
  shootout: t => first(S(t, 'gunfire', 1.1), S(t + 0.15, 'shot3', 0.8), S(t + 0.45, 'shot1', 0.8), S(t + 0.7, 'shot2', 0.8), S(t + 0.9, 'metal2', 0.4, { rate: 1.6 }), S(t + 1.2, 'siren2', 0.55)),   // shots, a ricochet, a siren
  evict: t => first(S(t, 'slam1', 1.2), S(t + 0.05, 'slam2', 0.6)),
  audit: t => { let ok = false; for (let k = 0; k < 6; k++) ok = S(t + k * 0.07, v('key', 1, 2, 3), 0.9) || ok; return any(S(t + 0.6, v('stamp', 1, 2, 3), 1.2), ok); },   // typewriter, then a stamp
  classic: t => S(t, v('cplace', 1, 2), 0.9),
};
const over = {
  dice: t => S(t, v('dice_shake', 1, 2, 3), 0.9),
  click: (t, k = 0.6) => S(t, v('die', 0, 1, 2, 3), 0.3 + 1.1 * k, { rate: rand(0.9, 1.15), vary: 0.06 }),
  hop: t => S(t, v('hop', 1, 2, 3), 0.55),
  land: t => first(S(t, v('land', 1, 2), 0.9), S(t + 0.01, v('hop', 1, 2, 3), 0.4, { rate: 0.8 })),
  fly: t => S(t, v('fly', 1, 2, 3), 0.7),
  cash: t => first(S(t, v('cash', 1, 2, 3), 0.9), S(t + 0.04, coin(), 0.5)),
  pay: t => S(t, v('pay', 1, 2, 3), 1),
  buy: t => S(t, v('stamp', 1, 2, 3), 1.2),
  build: t => S(t, v('build', 1, 2, 3), 0.9),
  construct: t => {                                          // hammering over a building site, a low rumble under it
    let ok = S(t, 'constructbed', 0.6);
    for (const at of [0, 0.17, 0.29, 0.55, 0.68, 0.81, 1.22, 1.35]) ok = S(t + at, Math.random() < 0.5 ? v('hammer', 1, 2, 3, 4) : v('woodhammer', 1, 2), 0.8, { rate: rand(0.95, 1.05) }) || ok;
    hiss(t + 0.1, { type: 'lowpass', freq: 85, vol: 0.2, attack: 0.35, dur: 1.5 }); ping(t + 0.1, 44, { vol: 0.09, attack: 0.3, dur: 1.5 });
    return ok;
  },
  card: t => S(t, v('card', 1, 2), 0.8),
  jail: t => first(S(t, 'irondoor', 1.2), S(t + 0.32, v('keys', 1, 2), 0.7), S(t + 0.6, 'doorlock', 0.9)),   // the cell door, keys, the lock
  turn: t => first(S(t, v('clink', 0, 1, 2), 0.9), S(t + 0.14, v('clink', 0, 1, 2), 0.5)),
  ice: t => S(t, v('clink', 0, 1, 2), 0.6),
  pour: t => S(t, 'pour', 1),
  rumble: t => {                                             // a building coming down
    const ok = first(S(t, v('crumble', 1, 2), 1.2), S(t + 0.15, v('crumble', 1, 2), 0.9), S(t + 0.3, 'collapse', 0.7));
    hiss(t, { type: 'lowpass', freq: 90, vol: 0.14, attack: 0.25, dur: 1.4 }); ping(t, 46, { vol: 0.07, attack: 0.2, dur: 1.4 });
    return ok;
  },
  pop: t => S(t, v('pop', 1, 2), 0.8),
  coins: t => first(S(t, v('chips', 1, 2, 3), 1), S(t + 0.12, v('chips', 1, 2, 3), 0.8), S(t + 0.3, coin(), 0.6), S(t + 0.42, v('banknotes', 1, 2), 0.8)),
  win: t => first(S(t, 'fanfare', 1.1), S(t + 0.5, 'applause', 1)),
  paper: t => S(t, v('paper', 1, 2, 3, 4), 0.9),
  shuffle: t => S(t, 'shuffle', 1),
  wheelTick: (t, final) => final ? first(S(t, 'wfinal', 0.9), S(t, v('chips', 1, 2, 3), 0.4)) : S(t, v('tick', 1, 2, 4), 0.6, { rate: rand(0.95, 1.15) }),
  cardDraw: t => S(t, v('cdraw', 1, 2, 3, 4), 0.9),
  cardFlip: t => S(t, v('cflip', 1, 2, 3), 0.9),
  mafiaNote: t => {                                          // paper under the door, footsteps going away
    const ok = S(t, v('paper', 1, 2, 3, 4), 0.75);
    for (let k = 0; k < 6; k++) S(t + 1.1 + k * 0.42 + (k % 2) * 0.03, v('step', 1, 2, 3, 4), 0.8 - k * 0.1);
    return ok;
  },
  key: t => S(t, v('key', 1, 2, 3), 0.45, { rate: rand(0.96, 1.08) }),
  hover: t => S(t, v('hover', 1, 2, 3), 0.5),
  bankrupt: t => first(S(t, 'trumpet', 0.9), S(t + 0.1, 'hitlow2', 0.9)),
  taxi: t => first(S(t, 'horn', 0.9), S(t + 0.35, 'horn', 0.8, { rate: 1.06 })),
  casinoEvent: (t, key) => { const f = CASINO[key] || STING[key]; return f ? f(t) : false; },   // (the global wheel passes its own keys too)
  cardSting: (t, key) => (STING[key] || STING.classic)(t),
};
const plus = {
  chaos: t => { S(t, 'hitlow1', 1.1); S(t + 0.02, 'metal1', 0.6, { rate: 0.7 }); },
  mafia: t => { S(t, 'sting', 1); S(t + 1.1, 'click', 0.5); },
  lighter: t => { S(t, 'latch', 0.8); S(t + 0.25, 'click', 0.5); },
  roulette: t => { S(t + 2.28, v('chips', 1, 2, 3), 0.9); S(t + 2.36, v('chips', 1, 2, 3), 0.7); S(t + 2.48, 'wfinal', 0.7); },   // the ball drops into its pocket
};
let warned = false;
for (const name of Object.keys(synth)) {
  sfx[name] = (...a) => {
    if (!ctx || muted) return;
    const t = ctx.currentTime + 0.01;
    let done = false;
    try { done = !!(over[name] && over[name](t, ...a)); if (plus[name]) plus[name](t, ...a); } catch (e) { if (!warned) { warned = true; console.warn('sfx:', name, e); } }
    if (!done) synth[name](...a);
  };
}
// what is loaded, for checking
sfx.stats = () => ({ total: SAMPLE_IDS.length, loaded: SAMPLE_IDS.filter(id => buffers.get(id)), failed: SAMPLE_IDS.filter(id => buffers.get(id) === null), pending: SAMPLE_IDS.filter(id => !buffers.has(id)) });
sfx.sampleIds = SAMPLE_IDS;
