// Wordle Italiano: plain DOM, no libraries. Shared helpers in /games/shared/arcade.js, icons in icons.js.
// Firebase (sign-in, cloud stats, ranking) is imported on demand: without it the game works the same.
import { ACHIEVEMENTS, earned } from './achievements.js';

const LEN = 5, TRIES = 6, TIMED = 30;
const GUEST_KEY = 'wordle-it-stats'; // same key as before: guests keep their numbers
const DAILY_KEY = 'wordle-it-daily';
const MODE_KEY = 'wordle-it-mode';
const HELP_KEY = 'wordle-it-help';
const RARITY = { common: '#9aaba1', rare: COLOR.accent, epic: COLOR.lime, legendary: COLOR.ink };
const TXT = IT ? {
  short: 'Mancano lettere', unknown: 'Non è nel dizionario', timeUp: 'Tempo scaduto!',
  hardPos: (l, p) => `La ${l} va in posizione ${p}`, hardUse: (l) => `Devi usare la ${l}`,
  praise: ['Geniale!', 'Magnifico!', 'Impressionante!', 'Splendido!', 'Ottimo!', 'Per un pelo!'],
  won: (n) => `Indovinata in ${n} ${n === 1 ? 'tentativo' : 'tentativi'}.`, lost: 'Questa volta no. Era questa.',
  kicker: { daily: (n) => `Parola del giorno n. ${n}`, practice: 'Partita libera', timed: 'A tempo', hard: 'Difficile' },
  note: { daily: (n) => `Parola n. ${n} · uguale per tutti`, practice: 'Una parola nuova a ogni partita', timed: '30 secondi dal primo tentativo', hard: 'Gli indizi trovati vanno riusati' },
  next: (t) => `Prossima parola tra <b>${t}</b>`, playFree: 'Gioca libera', newWord: 'Nuova parola', done: 'La parola di oggi l\'hai già giocata',
  stats: ['Giocate', 'Vinte %', 'Serie', 'Serie max'], copied: 'Copiato negli appunti', hi: (n) => `Ciao ${n}!`, bye: 'Sei uscito',
  saved: 'Salvato', loginFail: 'Accesso non riuscito', resetAsk: 'Sicuro? Tocca di nuovo', resetDone: 'Statistiche azzerate',
  resetLabel: 'Azzera le statistiche', unlocked: 'Traguardo sbloccato', awards: (a, b) => `${a} di ${b} sbloccati`,
  rarity: { common: 'comune', rare: 'raro', epic: 'epico', legendary: 'leggendario' }, empty: 'Nessuno ancora. Potresti essere tu.',
  offline: 'Classifica non raggiungibile: sei offline?', loading: 'Carico...', anon: 'Anonimo', ranked: 'In classifica!',
  state: { correct: 'al posto giusto', present: 'in un altro posto', absent: 'assente' }, noSpark: 'Servono almeno due partite',
} : {
  short: 'Not enough letters', unknown: 'Not in the word list', timeUp: 'Time\'s up!',
  hardPos: (l, p) => `${l} must be letter ${p}`, hardUse: (l) => `You must use ${l}`,
  praise: ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'],
  won: (n) => `Got it in ${n} ${n === 1 ? 'try' : 'tries'}.`, lost: 'Not this time. This was the word.',
  kicker: { daily: (n) => `Daily word #${n}`, practice: 'Free game', timed: 'Timed', hard: 'Hard' },
  note: { daily: (n) => `Word #${n} · the same for everyone`, practice: 'A new word every game', timed: '30 seconds from the first try', hard: 'Every clue you find must be used' },
  next: (t) => `Next word in <b>${t}</b>`, playFree: 'Play free', newWord: 'New word', done: 'You\'ve already played today\'s word',
  stats: ['Played', 'Win %', 'Streak', 'Best'], copied: 'Copied to the clipboard', hi: (n) => `Hi ${n}!`, bye: 'Signed out',
  saved: 'Saved', loginFail: 'Sign-in didn\'t work', resetAsk: 'Sure? Tap again', resetDone: 'Stats reset',
  resetLabel: 'Reset stats', unlocked: 'Achievement unlocked', awards: (a, b) => `${a} of ${b} unlocked`,
  rarity: { common: 'common', rare: 'rare', epic: 'epic', legendary: 'legendary' }, empty: 'Nobody yet. Could be you.',
  offline: 'The ranking can\'t be reached: are you offline?', loading: 'Loading...', anon: 'Anonymous', ranked: 'On the board!',
  state: { correct: 'right spot', present: 'another spot', absent: 'not in the word' }, noSpark: 'Needs at least two games',
};

setupPage();
if (IT) document.querySelectorAll('[data-it-label]').forEach((el) => el.setAttribute('aria-label', el.dataset.itLabel));
const stage = $('stage');
const boardEl = $('board');
const keyEls = {};
document.querySelectorAll('[data-key]').forEach((b) => (keyEls[b.dataset.key] = b));

/* ---------- state ---------- */
let words = [], wordSet = new Set();
let mode = ['daily', 'practice', 'timed', 'hard'].includes(store.get(MODE_KEY)) ? store.get(MODE_KEY) : 'daily';
let target = '', rows = [], results = [], current = '', over = false, busy = false;
let clock = null, deadline = 0, timeLeft = TIMED, timeUp = false;
let stats = blankStats();
let user = null, fb = null, fbLoading = null, greet = false;

function blankStats() {
  return { gamesPlayed: 0, gamesWon: 0, currentStreak: 0, maxStreak: 0, guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, fail: 0 }, hardModeWins: 0, timedModeWins: 0, achievements: [], gameHistory: [] };
}
function normalize(s) {
  const b = blankStats();
  if (!s || typeof s !== 'object') return b;
  return { ...b, ...s, guesses: { ...b.guesses, ...(s.guesses || {}) }, achievements: Array.isArray(s.achievements) ? s.achievements : [], gameHistory: Array.isArray(s.gameHistory) ? s.gameHistory : [] };
}
function readJSON(key) { try { return JSON.parse(store.get(key)); } catch { return null; } }
const statsKey = () => (user ? `${GUEST_KEY}-${user.uid}` : GUEST_KEY);
function saveStats() {
  store.set(statsKey(), JSON.stringify(stats));
  if (user && fb) fb.saveStats(user, stats).catch(() => {});
}
stats = normalize(readJSON(GUEST_KEY));

/* ---------- sound ---------- */
const sfx = {
  key: () => tone(620 + Math.random() * 60, 0.03, 'triangle', 0.02),
  flip: (s, i) => (s === 'correct' ? tone(NOTES[4 + i] || 1318, 0.12, 'triangle', 0.05) : s === 'present' ? tone(NOTES[2 + i], 0.1, 'triangle', 0.04) : tone(200, 0.07, 'sine', 0.03)),
  bad: () => tone(150, 0.16, 'square', 0.03, 110),
  win: () => [0, 2, 4, 7, 8].forEach((j, i) => tone(NOTES[j], 0.22, 'triangle', 0.06, 0, i * 0.08)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)),
  unlock: () => { tone(1046, 0.12, 'sine', 0.05); tone(1568, 0.2, 'sine', 0.05, 0, 0.1); },
};

/* ---------- daily word ---------- */
function dayNo() { // days since 1 Jan 2026, by the player's calendar
  const d = new Date();
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5) + 1;
}
const dailyWord = (n) => words[(n * 7919 + 4111) % words.length]; // 7919 is prime: no repeats for 8000+ days
function untilMidnight() {
  const now = new Date(), end = new Date(now); end.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((end - now) / 1000));
  return [s / 3600, (s / 60) % 60, s % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
}
function saveDaily() { store.set(DAILY_KEY, JSON.stringify({ day: dayNo(), rows, over })); }

/* ---------- scoring ---------- */
function score(guess, word) {
  const res = Array(LEN).fill('absent'), left = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === word[i]) res[i] = 'correct';
    else left[word[i]] = (left[word[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (res[i] !== 'correct' && left[guess[i]]) { res[i] = 'present'; left[guess[i]]--; }
  }
  return res;
}
function hardCheck(g) { // every clue found so far must be reused
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < LEN; i++) if (results[r][i] === 'correct' && g[i] !== rows[r][i]) return TXT.hardPos(rows[r][i].toUpperCase(), i + 1);
    for (let i = 0; i < LEN; i++) if (results[r][i] === 'present' && !g.includes(rows[r][i])) return TXT.hardUse(rows[r][i].toUpperCase());
  }
  return '';
}

/* ---------- board ---------- */
const tile = (r, i) => boardEl.children[r].children[i];
function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < TRIES; r++) {
    const row = document.createElement('div');
    row.className = 'row'; row.setAttribute('role', 'row');
    for (let i = 0; i < LEN; i++) {
      const t = document.createElement('div');
      t.className = 'tile'; t.setAttribute('role', 'gridcell');
      row.appendChild(t);
    }
    boardEl.appendChild(row);
  }
  for (const b of Object.values(keyEls)) b.classList.remove('correct', 'present', 'absent');
}
function drawCurrent() {
  const r = rows.length;
  if (r >= TRIES) return;
  for (let i = 0; i < LEN; i++) {
    const t = tile(r, i), ch = current[i] || '';
    if (t.textContent === ch) continue;
    t.textContent = ch;
    if (ch) replay(t, 'filled'); else t.classList.remove('filled');
  }
}
function paintKey(ch, s) {
  const k = keyEls[ch];
  if (!k || k.classList.contains('correct') || (s === 'absent' && k.classList.contains('present'))) return;
  k.classList.remove('present', 'absent');
  k.classList.add(s);
}
function setTile(t, ch, s) {
  t.textContent = ch;
  t.classList.remove('filled');
  t.classList.add(s);
  t.setAttribute('aria-label', `${ch.toUpperCase()}, ${TXT.state[s]}`);
}
function reveal(r, guess, res, animate) {
  if (!animate || calm) {
    for (let i = 0; i < LEN; i++) { setTile(tile(r, i), guess[i], res[i]); paintKey(guess[i], res[i]); }
    return Promise.resolve();
  }
  return new Promise((done) => {
    for (let i = 0; i < LEN; i++) {
      setTimeout(() => {
        const t = tile(r, i);
        t.classList.add('flip');
        setTimeout(() => { setTile(t, guess[i], res[i]); paintKey(guess[i], res[i]); sfx.flip(res[i], i); }, 250); // turn it at the edge
      }, i * 260);
    }
    setTimeout(done, LEN * 260 + 300);
  });
}
function nope(msg) {
  toast(msg); sfx.bad();
  replay(boardEl.children[rows.length], 'shake');
}

/* ---------- toasts ---------- */
function toast(msg, ms = 1400) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}
let unlockQueue = Promise.resolve();
function announce(a) { // achievements unlocked, one after the other
  unlockQueue = unlockQueue.then(() => new Promise((next) => {
    const el = document.createElement('div');
    el.innerHTML = `<span class="ic">${svgIcon(a.icon)}</span><span><small>${TXT.unlocked}</small><b></b></span>`;
    el.querySelector('b').textContent = (IT ? a.it : a.en)[0];
    $('unlock').appendChild(el); sfx.unlock();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 400); }, 2600);
  }));
}

/* ---------- confetti, on the kit's canvas ---------- */
const cvs = $('game'), ctx = cvs.getContext('2d');
let W = 0, H = 0, bits = [], confettiOn = false;
new ResizeObserver(() => ({ w: W, h: H } = fitCanvas(cvs, ctx))).observe(stage);
function confetti() {
  const r = boardEl.getBoundingClientRect(), s = stage.getBoundingClientRect();
  const x = r.left - s.left + r.width / 2, y = r.top - s.top + r.height * 0.4;
  const colors = [COLOR.accent, COLOR.lime, COLOR.ink, '#12a150'];
  for (let i = 0; i < (calm ? 40 : 160); i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 300 + Math.random() * 650;
    bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[i % 4], life: 2.4 + Math.random() });
  }
  if (!confettiOn) { confettiOn = true; let last = performance.now(); requestAnimationFrame(function step(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, W, H);
    bits = bits.filter((b) => (b.life -= dt) > 0 && b.y < H + 40);
    for (const b of bits) {
      b.vy += 900 * dt; b.vx *= 1 - 1.2 * dt; b.vy *= 1 - 0.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.scale(1, Math.cos(b.r * 2)); // flutter
      ctx.globalAlpha = Math.min(1, b.life); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (bits.length) requestAnimationFrame(step); else { confettiOn = false; ctx.clearRect(0, 0, W, H); }
  }); }
}

/* ---------- timed mode ---------- */
function startClock() {
  deadline = performance.now() + TIMED * 1000; timeUp = false;
  clock = setInterval(() => {
    timeLeft = Math.max(0, (deadline - performance.now()) / 1000);
    drawClock();
    if (timeLeft <= 0) expire();
  }, 100);
}
function stopClock() { clearInterval(clock); clock = null; }
function drawClock() {
  $('clock').style.setProperty('--t', timeLeft / TIMED);
  $('clock-left').textContent = Math.ceil(timeLeft);
  $('clock').classList.toggle('low', timeLeft < 10);
}
function expire() {
  stopClock(); timeUp = true;
  if (busy || over) return; // the reveal in progress ends the game
  if (current.length === LEN && wordSet.has(current) && !hardCheck(current)) return submit(); // a full word still counts
  toast(TXT.timeUp);
  finish(false);
}

/* ---------- game ---------- */
function newGame() {
  stopClock();
  rows = []; results = []; current = ''; over = false; busy = false; timeLeft = TIMED; timeUp = false;
  buildBoard();
  document.querySelectorAll('.modes button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  $('note').textContent = mode === 'daily' ? TXT.note.daily(dayNo()) : TXT.note[mode];
  $('clock').hidden = mode !== 'timed';
  drawClock();
  if (!words.length) return;
  if (mode !== 'daily') { target = words[(Math.random() * words.length) | 0]; return; }
  target = dailyWord(dayNo());
  const saved = readJSON(DAILY_KEY);
  if (!saved || saved.day !== dayNo()) return;
  for (const g of saved.rows || []) { rows.push(g); results.push(score(g, target)); reveal(rows.length - 1, g, results[rows.length - 1], false); }
  if (saved.over) { over = true; setTimeout(() => showResult(rows[rows.length - 1] === target), 300); }
}

function type(ch) {
  if (over || busy || current.length >= LEN) return;
  current += ch; sfx.key(); drawCurrent();
}
function erase() {
  if (over || busy || !current) return;
  current = current.slice(0, -1); drawCurrent();
}
async function submit() {
  if (over || busy) return;
  if (current.length < LEN) return nope(TXT.short);
  if (!wordSet.has(current)) return nope(TXT.unknown);
  const hard = mode === 'hard' ? hardCheck(current) : '';
  if (hard) return nope(hard);
  if (mode === 'timed' && !clock && !timeUp) startClock();
  busy = true;
  const guess = current, res = score(guess, target);
  rows.push(guess); results.push(res); current = '';
  if (mode === 'daily') saveDaily();
  await reveal(rows.length - 1, guess, res, true);
  busy = false;
  const won = guess === target;
  if (won || rows.length === TRIES || timeUp) finish(won);
}

function finish(won) {
  over = true; stopClock();
  const attempts = rows.length;
  record(won, attempts);
  if (mode === 'daily') {
    saveDaily();
    if (won && user && fb) fb.saveScore(user, attempts, true).then(() => toast(TXT.ranked)).catch(() => {});
  }
  if (won) {
    const r = boardEl.children[attempts - 1];
    [...r.children].forEach((t, i) => { t.style.animationDelay = `${i * 90}ms`; t.classList.remove('flip'); replay(t, 'win'); });
    toast(TXT.praise[attempts - 1], 1600); sfx.win(); setTimeout(confetti, 350);
  } else {
    toast(target.toUpperCase(), 2400); sfx.lose();
  }
  setTimeout(() => showResult(won), won ? 1700 : 1500);
}

function record(won, attempts) {
  const s = stats, timeRemaining = mode === 'timed' ? Math.round(timeLeft * 10) / 10 : null;
  s.gamesPlayed++;
  if (won) {
    s.gamesWon++; s.currentStreak++; s.maxStreak = Math.max(s.maxStreak, s.currentStreak); s.guesses[attempts]++;
    if (mode === 'hard') s.hardModeWins++;
    if (mode === 'timed') s.timedModeWins++;
  } else { s.currentStreak = 0; s.guesses.fail++; }
  const game = { date: Date.now(), won, attempts: won ? attempts : 0, mode, timeRemaining };
  s.gameHistory = [...s.gameHistory, game].slice(-100);
  for (let k = 0; k < 3; k++) { // twice more: "unlock 10" counts the ones just unlocked
    const fresh = earned(s, game, s.achievements);
    if (!fresh.length) break;
    for (const a of fresh) { s.achievements.push(a.id); announce(a); }
  }
  saveStats();
}

/* ---------- panels ---------- */
function fillStats(dl) {
  const s = stats, pct = s.gamesPlayed ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;
  dl.innerHTML = '';
  [s.gamesPlayed, pct, s.currentStreak, s.maxStreak].forEach((v, i) => {
    const d = document.createElement('div');
    d.innerHTML = `<dt>${TXT.stats[i]}</dt><dd>${v}</dd>`;
    dl.appendChild(d);
  });
}
function fillDist(el, now) {
  const g = stats.guesses, max = Math.max(1, ...[1, 2, 3, 4, 5, 6].map((i) => g[i]));
  el.innerHTML = '';
  for (let i = 1; i <= TRIES; i++) {
    const d = document.createElement('div');
    if (i === now) d.className = 'now';
    d.innerHTML = `<span>${i}</span><i style="--w:${(g[i] / max) * 100}%">${g[i]}</i>`;
    el.appendChild(d);
  }
}

let nextTimer = null;
function showResult(won) {
  const daily = mode === 'daily';
  $('r-kicker').textContent = daily ? TXT.kicker.daily(dayNo()) : TXT.kicker[mode];
  const w = $('r-word');
  w.className = 'reveal' + (won ? '' : ' lost');
  w.innerHTML = '';
  [...target].forEach((ch, i) => {
    const t = document.createElement('span');
    t.className = 't' + (won ? ' correct' : ''); t.textContent = ch.toUpperCase(); t.style.animationDelay = `${i * 90}ms`;
    w.appendChild(t);
  });
  $('r-text').textContent = won ? TXT.won(rows.length) : TXT.lost;
  $('r-link').href = `https://1parola.it/${target}`;
  fillStats($('r-stats'));
  fillDist($('r-dist'), won ? rows.length : 0);
  $('again-label').textContent = daily ? TXT.playFree : TXT.newWord;
  $('r-next').hidden = !daily;
  clearInterval(nextTimer);
  if (daily) {
    const tick = () => ($('r-next').innerHTML = TXT.next(untilMidnight()));
    tick(); nextTimer = setInterval(tick, 1000);
  }
  show('result');
}

function share() {
  const won = rows[rows.length - 1] === target;
  const head = `Wordle IT${mode === 'daily' ? ' ' + dayNo() : ''} ${won ? rows.length : 'X'}/${TRIES}${mode === 'hard' ? '*' : ''}`;
  const grid = results.map((r) => r.map((s) => (s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛')).join('')).join('\n');
  const text = `${head}\n\n${grid}\n${location.origin}/games/wordle/`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => toast(TXT.copied), () => {});
}

function openStats(tab = 'numbers') {
  fillStats($('s-stats'));
  fillDist($('s-dist'), 0);
  // last 30 games: higher is better, fails are red dots on the floor
  const h = stats.gameHistory.slice(-30), sp = $('s-spark');
  if (h.length < 2) sp.innerHTML = `<text x="150" y="35" text-anchor="middle">${TXT.noSpark}</text>`;
  else {
    const x = (i) => (i / (h.length - 1)) * 300, y = (g) => (g.won ? 4 + (g.attempts - 1) * 9.5 : 56);
    sp.innerHTML = `<polyline points="${h.map((g, i) => `${x(i).toFixed(1)},${y(g)}`).join(' ')}"/>` +
      h.map((g, i) => (g.won ? '' : `<circle cx="${x(i).toFixed(1)}" cy="56" r="3"/>`)).join('');
  }
  // the last 12 weeks, one cell a day
  const perDay = {};
  for (const g of stats.gameHistory) { const k = new Date(g.date).toDateString(); perDay[k] = (perDay[k] || 0) + 1; }
  const heat = $('s-heat');
  heat.innerHTML = '';
  for (let i = 83; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const n = perDay[d.toDateString()] || 0, c = document.createElement('i');
    c.dataset.l = Math.min(4, n); c.title = `${d.toLocaleDateString()}: ${n}`;
    heat.appendChild(c);
  }
  // achievements
  const box = $('awards');
  box.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const on = stats.achievements.includes(a.id), [name, desc] = IT ? a.it : a.en, d = document.createElement('div');
    d.className = 'award' + (on ? ' on' : '');
    d.style.setProperty('--r', RARITY[a.rarity]);
    d.innerHTML = `<span class="ic">${svgIcon(on ? a.icon : 'lock')}</span><b></b><span></span><em>${TXT.rarity[a.rarity]}</em>`;
    d.querySelector('b').textContent = name; d.querySelector('span:not(.ic)').textContent = desc;
    box.appendChild(d);
  }
  $('a-count').textContent = TXT.awards(stats.achievements.length, ACHIEVEMENTS.length);
  disarmReset();
  pickTab(tab);
  show('board-stats');
}
function pickTab(tab) {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelectorAll('section.tab').forEach((s) => (s.hidden = s.dataset.tab !== tab));
  if (tab === 'ranks') loadRanks(document.querySelector('#periods [aria-selected="true"]')?.dataset.period || 'today');
}

async function loadRanks(period) {
  document.querySelectorAll('#periods button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.period === period)));
  const list = $('ranks');
  const line = (text) => { list.innerHTML = '<li class="empty"></li>'; list.firstChild.textContent = text; };
  line(TXT.loading);
  let scores;
  try { scores = await (await firebase()).leaderboard(period); } catch { return line(TXT.offline); }
  if (!scores.length) return line(TXT.empty);
  list.innerHTML = '';
  scores.forEach((s, i) => { // everything here was typed by players: text only, never HTML
    const li = document.createElement('li'), name = s.displayName || TXT.anon;
    if (user && s.uid === user.uid) li.className = 'me';
    const face = /^https:\/\//.test(s.photoURL || '') ? Object.assign(document.createElement('img'), { src: s.photoURL, alt: '', referrerPolicy: 'no-referrer', loading: 'lazy' }) : document.createElement('span');
    face.className = 'face';
    if (face.tagName === 'SPAN') face.textContent = name[0].toUpperCase();
    const pos = Object.assign(document.createElement('span'), { className: 'pos', textContent: i + 1 });
    const who = Object.assign(document.createElement('span'), { className: 'who' });
    who.append(Object.assign(document.createElement('b'), { textContent: name }), Object.assign(document.createElement('span'), { textContent: new Date(s.timestamp.seconds * 1000).toLocaleDateString() }));
    const tries = Object.assign(document.createElement('span'), { className: 'tries', textContent: `${s.attempts}/${TRIES}` });
    li.append(pos, face, who, tries);
    list.appendChild(li);
  });
}

function disarmReset() { $('reset').classList.remove('armed'); $('reset-label').textContent = TXT.resetLabel; }
$('reset').onclick = () => { // two taps, no modal
  if (!$('reset').classList.contains('armed')) { $('reset').classList.add('armed'); $('reset-label').textContent = TXT.resetAsk; return; }
  stats = blankStats(); saveStats(); toast(TXT.resetDone); openStats('numbers');
};

/* ---------- account ---------- */
function firebase() {
  fbLoading = fbLoading || import('./firebase.js').then((m) => { fb = m; m.onAuth(signedIn); return m; }).catch((e) => { fbLoading = null; throw e; });
  return fbLoading;
}
async function signedIn(u) {
  user = u || null;
  if (user) {
    let cloud = null, reached = true;
    try { cloud = await fb.loadStats(user); } catch { reached = false; } // offline: use the copy on this device
    const guest = normalize(readJSON(GUEST_KEY));
    // the first sign-in brings the guest's games along; after that the cloud copy wins
    stats = normalize(cloud || readJSON(statsKey()) || (guest.gamesPlayed ? guest : null));
    store.set(statsKey(), JSON.stringify(stats));
    if (reached && !cloud) fb.saveStats(user, stats).catch(() => {}); // never push a stale copy over the cloud one
    if (greet) toast(TXT.hi((user.displayName || '').split(' ')[0] || TXT.anon));
  } else {
    stats = normalize(readJSON(GUEST_KEY));
    if (greet) toast(TXT.bye);
  }
  greet = false;
  paintAccount();
}
function paintAccount() {
  const btn = $('account-btn');
  btn.innerHTML = user && /^https:\/\//.test(user.photoURL || '') ? `<img alt="" referrerpolicy="no-referrer">` : svgIcon('user');
  if (btn.firstChild.tagName === 'IMG') btn.firstChild.src = user.photoURL;
  $('signed-out').hidden = !!user; $('signed-in').hidden = !user;
  if (!user) return;
  $('me-photo').src = /^https:\/\//.test(user.photoURL || '') ? user.photoURL : '/favicon.svg';
  $('me-email').textContent = user.email || '';
  $('me-name').value = user.displayName || '';
}
async function openAccount() {
  paintAccount();
  $('offline-note').hidden = true;
  show('account');
  try { await firebase(); } catch { $('offline-note').hidden = false; }
}
$('login').onclick = async () => {
  try { const m = await firebase(); greet = true; await m.login(); } catch { greet = false; toast(TXT.loginFail); }
};
$('logout').onclick = async () => { greet = true; await fb?.logout(); show(null); };
$('save-name').onclick = async () => {
  const name = $('me-name').value.trim().slice(0, 24);
  if (!name || !user) return;
  try { await fb.rename(user, name); toast(TXT.saved); paintAccount(); } catch { toast(TXT.loginFail); }
};

/* ---------- input ---------- */
document.querySelectorAll('.modes button').forEach((b) => (b.onclick = () => {
  if (b.dataset.mode === mode) return;
  mode = b.dataset.mode; store.set(MODE_KEY, mode);
  newGame();
  if (mode === 'daily' && over) toast(TXT.done);
}));
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => pickTab(b.dataset.tab)));
document.querySelectorAll('#periods button').forEach((b) => (b.onclick = () => loadRanks(b.dataset.period)));
for (const [k, b] of Object.entries(keyEls)) {
  b.onclick = () => { b.blur(); k === 'enter' ? submit() : k === 'backspace' ? erase() : type(k); };
}
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const open = document.querySelector('.overlay:not([hidden])');
  if (open) { if (e.key === 'Escape') show(null); return; }
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'enter') { e.preventDefault(); submit(); }
  else if (k === 'backspace') { e.preventDefault(); erase(); }
  else if (/^[a-z]$/.test(k)) type(k);
});
document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) show(null); }));
document.querySelectorAll('.close, [data-close]').forEach((b) => (b.onclick = () => show(null)));
$('help-btn').onclick = () => show('help');
$('stats-btn').onclick = () => openStats();
$('account-btn').onclick = openAccount;
$('share').onclick = share;
$('again').onclick = () => {
  show(null);
  if (mode === 'daily') { mode = 'practice'; store.set(MODE_KEY, mode); }
  newGame();
};

/* ---------- start ---------- */
newGame();
fetch('parole.txt')
  .then((r) => (r.ok ? r.text() : Promise.reject()))
  .then((t) => t.split('\n').map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z]{5}$/.test(w)))
  .catch(() => [])
  .then((list) => {
    words = list.length ? list : ['palla', 'gatto', 'fiore', 'piano', 'treno'];
    wordSet = new Set(words);
    newGame();
    if (!store.get(HELP_KEY)) { store.set(HELP_KEY, '1'); show('help'); }
  });
firebase().catch(() => {}); // signed-in players get their stats back; offline is fine
