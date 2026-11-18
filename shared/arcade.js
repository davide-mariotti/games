// Shared by the rebuilt games (the list is in the README): language, icons, storage, sound, HUD and overlays.
// Load before the game's main.js; everything here is a plain global.
// Icons: Lucide 1.74.0 (https://lucide.dev, ISC license). Each game adds its own with Object.assign(ICONS, ...).
'use strict';

const ICONS = {
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  'volume-2': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  'volume-x': '<path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z"/><path d="m16.5 14.5 5-5"/><path d="m16.5 9.5 5 5"/>',
  magnet: '<path d="m12 15 4 4"/><path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"/><path d="m5 8 4 4"/>',
};

// One green, a lime for gold, white for power-ups, a single red for danger.
const COLOR = { accent: '#2fe37f', lime: '#c6f36b', ink: '#ecf3ee', danger: '#ff5a5f', spark: '#ffc08a' };

const IT = (navigator.language || '').toLowerCase().startsWith('it');
const UI_TXT = IT ? { sound: 'Audio', pause: 'Pausa', area: 'Area di gioco' } : { sound: 'Sound', pause: 'Pause', area: 'Game area' };
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const svgIcon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: no records, still playable */ } },
};

/* ---------- page: language, icons, mute and pause buttons ---------- */
function setupPage() {
  if (IT) {
    document.documentElement.lang = 'it';
    document.querySelectorAll('[data-it]').forEach((el) => (el.innerHTML = el.dataset.it));
    document.querySelectorAll('a[href="/"]').forEach((a) => (a.href = '/it/'));
  }
  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = svgIcon(el.dataset.icon)));
  $('game').setAttribute('aria-label', UI_TXT.area);
  $('pause')?.setAttribute('aria-label', UI_TXT.pause); // not every game pauses (Tic-Tac-Toe)
  const mute = $('mute');
  const paint = () => {
    mute.innerHTML = svgIcon(muted ? 'volume-x' : 'volume-2');
    mute.setAttribute('aria-label', UI_TXT.sound);
    mute.setAttribute('aria-pressed', String(muted));
  };
  mute.onclick = (e) => { e.currentTarget.blur(); muted = !muted; store.set('games_muted', muted ? '1' : '0'); paint(); };
  paint();
}

/* ---------- sound: tiny synth blips, no files ---------- */
let muted = store.get('games_muted') === '1';
let audio = null;
function tone(f, d = 0.12, type = 'sine', v = 0.06, to = 0, at = 0) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { return; }
  const t = audio.currentTime + at, o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + d + 0.05);
}
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

/* ---------- HUD and overlays ---------- */
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function bump(el) { replay(el, 'bump'); }
function banner(text) {
  const b = $('banner');
  b.innerHTML = '<span></span>';
  b.firstChild.textContent = text;
  replay(b, 'show');
}
function flash() {
  const s = $('stage');
  replay(s, 'hit');
  clearTimeout(flash.t); flash.t = setTimeout(() => s.classList.remove('hit'), 650);
}
function show(id) {
  for (const o of document.querySelectorAll('.overlay')) o.hidden = o.id !== id;
  if (id) setTimeout(() => $(id).querySelector('button').focus({ preventScroll: true }), 50);
}
function countUp(el, total) {
  const t0 = performance.now();
  (function step(t) {
    const p = Math.min(1, (t - t0) / 900);
    el.textContent = Math.round(total * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------- canvas ---------- */
// Resizes the canvas to its box at the screen's pixel density; returns the size in CSS pixels.
function fitCanvas(cvs, ctx) {
  const r = cvs.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  cvs.width = Math.round(r.width * dpr); cvs.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}

// A Lucide icon drawn once with its neon glow baked in: drawImage per frame is cheap, shadowBlur is not.
const SPRITE = 128;
const SPRITE_PAD = 48;
const SPRITE_SCALE = (SPRITE + SPRITE_PAD * 2) / SPRITE; // draw at icon size * this, the rest is glow
async function neonSprite(name, color, fill = 0.14, ring = false) {
  const img = new Image();
  img.src = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SPRITE}" height="${SPRITE}" viewBox="0 0 24 24" fill="${color}" fill-opacity="${fill}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE + SPRITE_PAD * 2;
  const g = c.getContext('2d');
  g.shadowColor = color;
  if (ring) { // power-ups wear a ring, so they read as pick-ups
    g.globalAlpha = 0.5; g.strokeStyle = color; g.lineWidth = 5; g.shadowBlur = 18;
    g.beginPath(); g.arc(c.width / 2, c.height / 2, SPRITE * 0.66, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }
  g.shadowBlur = 36; g.drawImage(img, SPRITE_PAD, SPRITE_PAD);
  g.shadowBlur = 10; g.drawImage(img, SPRITE_PAD, SPRITE_PAD);
  return c;
}
