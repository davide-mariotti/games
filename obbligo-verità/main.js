// Truth or Dare: plain DOM, no libraries. Shared helpers (icons, sound, overlays) in /games/shared/arcade.js, cards in cards.js.
'use strict';

Object.assign(ICONS, {
  'message-circle-question-mark': '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5"/><path d="M12 17h.01"/>',
  flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  dices: '<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  heart: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
});

const MODES = { friends: ['all'], two: ['all', 'two'], car: ['all', 'two', 'car'] }; // which decks each way of playing uses
const TXT = IT ? {
  title: 'Obbligo o Verità', t: 'Verità', d: 'Obbligo', prompt: 'Verità o obbligo?', next: 'Tocca a ',
  shuffled: 'Mazzo rimescolato.', empty: 'Carte finite. Siete arrivati in fondo.', done: 'Fatto',
  go: (s) => `Via, ${s} s`, up: 'Tempo!', seconds: /(\d+) secondi/,
  modes: { friends: 'Tra amici', two: 'In due', car: 'In macchina' },
  name: 'Nome', add: 'Aggiungi giocatore', remove: (n) => `Togli ${n}`, random: 'A caso',
} : {
  title: 'Truth or Dare', t: 'Truth', d: 'Dare', prompt: 'Truth or dare?', next: 'Up next: ',
  shuffled: 'Deck shuffled.', empty: 'Out of cards. You made it to the end.', done: 'Done',
  go: (s) => `Start ${s} s`, up: "Time's up!", seconds: /(\d+)[ -]second/,
  modes: { friends: 'With friends', two: 'Just the two of you', car: 'In the car' },
  name: 'Name', add: 'Add player', remove: (n) => `Remove ${n}`, random: 'Random',
};
const LANG = IT ? 2 : 3; // column of the text in CARDS

setupPage();
document.title = `${TXT.title} · Davide Mariotti`;
const ui = {
  card: $('card'), tag: $('tag'), text: $('text'), timer: $('timer'), timerT: $('timer-t'), turn: $('turn'),
  nt: $('n-t'), nd: $('n-d'), mode: $('mode-name'), truth: $('truth'), dare: $('dare'), random: $('random'), again: $('again'),
  names: $('names'), name: $('name'), modes: [...document.querySelectorAll('.mode')],
};
ui.name.placeholder = TXT.name;
$('add-btn').setAttribute('aria-label', TXT.add);
ui.random.setAttribute('aria-label', TXT.random);

/* ---------- state: the way of playing and the players stay, the used cards last the evening (the tab) ---------- */
const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode: the deck just forgets */ } },
};
const parse = (s, fallback) => { try { return JSON.parse(s) ?? fallback; } catch { return fallback; } };
let mode = MODES[store.get('tod_mode')] ? store.get('tod_mode') : null;
let players = parse(store.get('tod_players'), []).filter((n) => typeof n === 'string').slice(0, 12);
const used = new Set(parse(session.get('tod_used'), []));
let next = 0; // index of the player who picks next

const sfx = {
  t: () => tone(523.25, 0.2, 'triangle', 0.05, 784),
  d: () => tone(196, 0.25, 'sawtooth', 0.035, 392),
  dice: () => [0, 2, 4, 7].forEach((j, i) => tone(NOTES[j], 0.07, 'square', 0.02, 0, i * 0.045)),
  tick: () => tone(1200, 0.05, 'square', 0.02),
  up: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.2, 'triangle', 0.06, 0, i * 0.12)),
  add: () => tone(660, 0.1, 'sine', 0.04, 880),
};

/* ---------- deck ---------- */
const left = (type) => CARDS.flatMap((c, i) => (c[0] === type && MODES[mode].includes(c[1]) && !used.has(i) ? [i] : []));
function counts() {
  const t = left('t').length, d = left('d').length;
  ui.nt.textContent = t; ui.nd.textContent = d;
  ui.truth.disabled = !t; ui.dare.disabled = !d; ui.random.disabled = !t && !d;
  ui.again.hidden = t + d > 0;
  return t + d;
}

function showTurn() {
  ui.turn.textContent = '';
  if (players.length) ui.turn.append(TXT.next, Object.assign(document.createElement('b'), { textContent: players[next] }));
}

function idle(text) {
  stopTimer();
  ui.card.className = 'card idle';
  ui.tag.textContent = '';
  ui.text.textContent = text;
  ui.timer.hidden = true;
  replay(ui.card, 'flip');
  showTurn();
}

function draw(type) {
  const pool = left(type);
  if (!pool.length) return;
  const i = pool[(Math.random() * pool.length) | 0], text = CARDS[i][LANG];
  used.add(i);
  session.set('tod_used', JSON.stringify([...used]));
  stopTimer();
  ui.card.className = 'card ' + type;
  ui.tag.textContent = TXT[type] + (players.length ? ` · ${players[next]}` : '');
  ui.text.textContent = text;
  replay(ui.card, 'flip');
  const secs = type === 'd' && text.match(TXT.seconds);
  ui.timer.hidden = !secs;
  if (secs) { timer.len = Number(secs[1]); ui.timerT.textContent = TXT.go(timer.len); }
  if (players.length) next = (next + 1) % players.length;
  showTurn();
  sfx[type]();
  if (!counts()) ui.turn.textContent = TXT.empty;
}

function randomDraw() {
  const types = ['t', 'd'].filter((t) => left(t).length);
  if (!types.length) return;
  const type = types[(Math.random() * types.length) | 0];
  sfx.dice();
  banner(TXT[type]);
  draw(type);
}

function shuffleBack() {
  used.clear();
  session.set('tod_used', '[]');
  if (mode) { counts(); idle(TXT.shuffled); }
}

/* ---------- stopwatch for the timed dares ---------- */
const timer = { len: 0, end: 0, raf: 0, shown: 0 };
function stopTimer() {
  cancelAnimationFrame(timer.raf);
  timer.end = 0;
  ui.timer.classList.remove('run', 'done');
  ui.timer.style.setProperty('--p', 1);
}
function tick() {
  const s = (timer.end - performance.now()) / 1000;
  if (s <= 0) {
    stopTimer();
    ui.timerT.textContent = TXT.up; ui.timer.classList.add('done'); sfx.up();
    return;
  }
  const whole = Math.ceil(s);
  if (whole !== timer.shown) { timer.shown = whole; ui.timerT.textContent = whole; if (whole <= 3) sfx.tick(); }
  ui.timer.style.setProperty('--p', s / timer.len);
  timer.raf = requestAnimationFrame(tick);
}
ui.timer.onclick = () => {
  if (timer.end) { stopTimer(); ui.timerT.textContent = TXT.go(timer.len); return; } // a second tap stops it
  stopTimer();
  timer.end = performance.now() + timer.len * 1000; timer.shown = 0;
  ui.timer.classList.add('run');
  tick();
};

/* ---------- menu: how to play, and who ---------- */
function choose(m) {
  mode = m; store.set('tod_mode', m);
  for (const b of ui.modes) b.classList.toggle('on', b.dataset.mode === m);
  ui.mode.textContent = TXT.modes[m];
  counts() ? idle(TXT.prompt) : idle(TXT.empty);
  show(null);
}

function renderPlayers() {
  store.set('tod_players', JSON.stringify(players));
  if (next >= players.length) next = 0;
  ui.names.replaceChildren(...players.map((n, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'name';
    b.innerHTML = svgIcon('x');
    b.prepend(n); // text node: names never become markup
    b.setAttribute('aria-label', TXT.remove(n));
    b.onclick = () => { players.splice(i, 1); renderPlayers(); };
    return b;
  }));
  showTurn();
}

$('add').onsubmit = (e) => {
  e.preventDefault();
  const n = ui.name.value.trim().replace(/\s+/g, ' ');
  if (n && players.length < 12 && !players.includes(n)) { players.push(n); renderPlayers(); sfx.add(); }
  ui.name.value = '';
};
for (const b of ui.modes) b.onclick = () => choose(b.dataset.mode);
$('reset').onclick = (e) => {
  shuffleBack();
  const b = e.currentTarget, label = b.textContent;
  b.textContent = TXT.done; setTimeout(() => (b.textContent = label), 1200);
};
$('open-menu').onclick = (e) => { e.currentTarget.blur(); show('menu'); };

/* ---------- playing ---------- */
ui.truth.onclick = () => draw('t');
ui.dare.onclick = () => draw('d');
ui.random.onclick = randomDraw;
ui.again.onclick = shuffleBack;

const KEYS = { t: 't', v: 't', d: 'd', o: 'd', r: 'r', c: 'r' };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(), menuOpen = !$('menu').hidden;
  if (k === 'escape') { if (menuOpen && mode) show(null); else if (!menuOpen) show('menu'); return; }
  if (menuOpen || !KEYS[k]) return;
  if (KEYS[k] === 'r') randomDraw(); else draw(KEYS[k]);
});

renderPlayers();
if (mode) {
  for (const b of ui.modes) b.classList.toggle('on', b.dataset.mode === mode);
  ui.mode.textContent = TXT.modes[mode];
  counts();
}
idle(TXT.prompt);
