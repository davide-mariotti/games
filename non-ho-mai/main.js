// Non ho mai / Never Have I Ever: cards in questions.js, shared helpers (icons, sound, overlays) in /games/shared/arcade.js.
'use strict';

Object.assign(ICONS, {
  heart: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>',
  laugh: '<path d="M15 10V9"/><path d="M7.084 14.302a5.12 5.12 0 009.833 0 .24.24 0 00-.235-.302H7.32a.24.24 0 00-.235.302"/><path d="M9 10V9"/><circle cx="12" cy="12" r="10"/>',
  flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  menu: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>',
});

const CATS = {
  amore: { icon: 'heart', it: 'Amore', en: 'Love' },
  avventura: { icon: 'compass', it: 'Avventura', en: 'Adventure' },
  imbarazzo: { icon: 'laugh', it: 'Imbarazzo', en: 'Awkward' },
  piccante: { icon: 'flame', it: 'Piccante 18+', en: 'Spicy 18+' },
  social: { icon: 'smartphone', it: 'Social', en: 'Social media' },
};
const TXT = IT
  ? { title: 'Non ho mai · Davide Mariotti', play: 'Gioca', resume: 'Riprendi', cats: 'Categorie', shuffle: 'Si rimescola' }
  : { title: 'Never Have I Ever · Davide Mariotti', play: 'Play', resume: 'Resume', cats: 'Categories', shuffle: 'Reshuffle' };
const CATS_KEY = 'nonhomai_cats';
const SAVE_KEY = 'nonhomai'; // sessionStorage: a reload keeps the evening going, a new tab starts a new one

setupPage();
document.title = TXT.title;
$('settings').setAttribute('aria-label', TXT.cats);
$('cats').setAttribute('aria-label', TXT.cats);

const sfx = {
  card: () => tone(NOTES[Math.floor(Math.random() * 5)], 0.14, 'triangle', 0.05),
  start: () => tone(392, 0.18, 'triangle', 0.05, 784),
  shuffle: () => [0, 2, 4, 6].forEach((j, i) => tone(NOTES[j], 0.16, 'triangle', 0.05, 0, i * 0.06)),
};

/* ---------- state ---------- */
const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })();
const used = new Set(saved.used || []);
let count = saved.count || 0, start = saved.start || 0, last = saved.last ?? -1;
const picked = new Set((store.get(CATS_KEY) || Object.keys(CATS).join()).split(',').filter((c) => CATS[c]));

function save() {
  try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ used: [...used], count, start, last })); } catch { /* private mode: no resume */ }
}

/* ---------- cards ---------- */
function next() {
  if (!$('menu').hidden || !picked.size) return;
  const pool = () => QUESTIONS.flatMap((q, i) => (picked.has(q[0]) && !used.has(i) ? [i] : []));
  let free = pool();
  if (!free.length) { // seen them all: these categories go back in the deck
    QUESTIONS.forEach((q, i) => picked.has(q[0]) && used.delete(i));
    free = pool();
    banner(TXT.shuffle);
    sfx.shuffle();
  } else sfx.card();
  last = free[Math.floor(Math.random() * free.length)];
  used.add(last);
  count++;
  start ||= Date.now();
  paint();
  replay($('face'), 'deal');
  save();
}

function paint() {
  $('count').textContent = count;
  tick();
  if (last < 0) return;
  const [cat, it, en] = QUESTIONS[last];
  $('cat').innerHTML = svgIcon(CATS[cat].icon) + `<span>${IT ? CATS[cat].it : CATS[cat].en}</span>`;
  $('q').textContent = IT ? it : en;
}

function tick() {
  const s = start ? Math.floor((Date.now() - start) / 1000) : 0;
  $('time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- menu ---------- */
$('cats').innerHTML = Object.entries(CATS).map(([k, c]) =>
  `<label><input type="checkbox" value="${k}"${picked.has(k) ? ' checked' : ''}>${svgIcon(c.icon)}<span>${IT ? c.it : c.en}</span></label>`).join('');
$('cats').onchange = (e) => {
  if (e.target.checked) picked.add(e.target.value); else picked.delete(e.target.value);
  store.set(CATS_KEY, [...picked].join());
  $('play').disabled = !picked.size;
};

function openMenu() {
  $('play-label').textContent = count ? TXT.resume : TXT.play;
  $('restart').hidden = !count;
  $('play').disabled = !picked.size;
  show('menu');
}

function play() {
  show(null);
  sfx.start();
  if (!count) next();
}

function restart() {
  used.clear();
  count = 0; start = 0; last = -1;
  save();
  play();
}

/* ---------- input ---------- */
$('play').onclick = play;
$('restart').onclick = restart;
$('next').onclick = (e) => { e.currentTarget.blur(); next(); };
$('game').onclick = next;
$('settings').onclick = (e) => { e.currentTarget.blur(); openMenu(); };
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && count) return show(null);
  if (e.target.closest('button, input')) return; // their own Enter and Space
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
});
setInterval(() => start && tick(), 1000);

paint();
openMenu();
