// Tic-Tac-Toe: plain DOM, no libraries. Shared helpers (icons, sound, overlays) in /games/shared/arcade.js.
'use strict';

Object.assign(ICONS, {
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  circle: '<circle cx="12" cy="12" r="10"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  brain: '<path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4"/><path d="M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294"/><path d="M17.996 5.125a4 4 0 012.526 5.77"/><path d="M18 18a4 4 0 002-7.465"/><path d="M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517"/><path d="M6 18a4 4 0 01-2-7.465"/><path d="M6.004 5.125a4 4 0 00-2.526 5.77"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  menu: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>',
});

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const MISTAKES = 0.35; // how often the plain "Computer" plays a random square instead of the best one
const TXT = IT ? {
  yourTurn: 'Tocca a te', thinking: 'Il computer ci pensa', toMove: (s) => `Tocca a ${s}`,
  youWin: 'Hai vinto.', cpuWins: 'Vince il computer.', wins: (s) => `Vince ${s}.`,
  draw: 'Pareggio.', drawHard: 'Pareggio. Contro questo, vale come una vittoria.',
  you: 'Tu', cpu: 'CPU', menu: 'Cambia modalità',
  modes: { easy: 'Computer', hard: 'Imbattibile', duo: 'Due giocatori' },
  cell: (i, v) => `Casella ${i + 1}, ${v || 'vuota'}`,
} : {
  yourTurn: 'Your turn', thinking: 'The computer is thinking', toMove: (s) => `${s} to move`,
  youWin: 'You win.', cpuWins: 'Computer wins.', wins: (s) => `${s} wins.`,
  draw: 'Draw.', drawHard: 'Draw. Against this one, that counts as a win.',
  you: 'You', cpu: 'CPU', menu: 'Change mode',
  modes: { easy: 'Computer', hard: 'Unbeatable', duo: 'Two players' },
  cell: (i, v) => `Square ${i + 1}, ${v || 'empty'}`,
};

setupPage();
const stage = $('stage');
const board = $('game');
const strike = $('strike');
const next = $('next');
const cells = Array.from({ length: 9 }, (_, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.onclick = () => humanMove(i);
  return b;
});
board.prepend(...cells);
$('modes').setAttribute('aria-label', TXT.menu);

const sfx = {
  place: (i, s) => tone(NOTES[i], 0.16, s === 'X' ? 'triangle' : 'sine', 0.07),
  start: () => tone(392, 0.18, 'triangle', 0.05, 784),
  win: () => [4, 6, 8].forEach((j, i) => tone(NOTES[j], 0.2, 'triangle', 0.06, 0, i * 0.07)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)),
  draw: () => [440, 440].forEach((f, i) => tone(f, 0.14, 'sine', 0.05, 0, i * 0.14)),
};

/* ---------- state ---------- */
let mode = '';  // easy | hard | duo
let grid = Array(9).fill('');
let turn = 'X', round = 0, done = false, cpuTimer = 0;
const wins = { X: 0, O: 0, D: 0 };
const cpuTurn = () => mode !== 'duo' && turn === 'O' && !done; // you are X, the computer is O

/* ---------- rules and the computer ---------- */
function winner(g) {
  return LINES.find(([a, b, c]) => g[a] && g[a] === g[b] && g[a] === g[c]) || null;
}
// Score from O's point of view: a quick win beats a slow one, a slow loss beats a quick one.
function minimax(g, who, depth) {
  const w = winner(g);
  if (w) return g[w[0]] === 'O' ? 10 - depth : depth - 10;
  if (!g.includes('')) return 0;
  let best = who === 'O' ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (g[i]) continue;
    g[i] = who;
    const s = minimax(g, who === 'O' ? 'X' : 'O', depth + 1);
    g[i] = '';
    best = who === 'O' ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}
function bestMove(g, sloppy) {
  const free = g.flatMap((v, i) => (v ? [] : [i]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (sloppy && Math.random() < MISTAKES) return pick(free);
  let top = -Infinity, ties = [];
  for (const i of free) {
    g[i] = 'O';
    const s = minimax(g, 'X', 1);
    g[i] = '';
    if (s > top) { top = s; ties = [i]; } else if (s === top) ties.push(i);
  }
  return pick(ties); // random among equals, so it doesn't play the same game every time
}

/* ---------- game ---------- */
function start(m) {
  if (m === mode && round) return show(null); // same mode: just close the menu, keep the score
  mode = m; round = 0; wins.X = wins.O = wins.D = 0;
  $('n-X').textContent = mode === 'duo' ? '' : TXT.you;
  $('n-O').textContent = mode === 'duo' ? '' : TXT.cpu;
  $('mode-label').textContent = TXT.modes[mode];
  show(null);
  sfx.start();
  newRound();
}

function newRound() {
  clearTimeout(cpuTimer);
  round++;
  grid = Array(9).fill('');
  done = false;
  turn = round % 2 ? 'X' : 'O'; // take turns at starting
  cells.forEach((c, i) => { c.className = 'cell'; c.innerHTML = ''; label(i); });
  board.classList.remove('done');
  stage.classList.remove('won');
  strike.classList.remove('on');
  next.classList.remove('on');
  $('round').textContent = round;
  paintScore();
  prompt();
}

function prompt() {
  $('p-X').classList.toggle('on', turn === 'X');
  $('p-O').classList.toggle('on', turn === 'O');
  if (cpuTurn()) {
    say(TXT.thinking);
    cpuTimer = setTimeout(() => place(bestMove(grid, mode === 'easy')), 450 + Math.random() * 350);
  } else say(mode === 'duo' ? TXT.toMove(turn) : TXT.yourTurn);
}

function humanMove(i) {
  if (done || cpuTurn() || grid[i] || !$('menu').hidden) return;
  place(i);
}

function place(i) {
  grid[i] = turn;
  const c = cells[i];
  c.classList.add('full', turn.toLowerCase());
  c.innerHTML = `<svg class="mark" viewBox="0 0 24 24" aria-hidden="true">${ICONS[turn === 'X' ? 'x' : 'circle'].replaceAll('/>', ' pathLength="1"/>')}</svg>`;
  label(i);
  sfx.place(i, turn);
  const line = winner(grid);
  if (line || !grid.includes('')) return end(line);
  turn = turn === 'X' ? 'O' : 'X';
  prompt();
}

function end(line) {
  done = true;
  board.classList.add('done');
  $('p-X').classList.remove('on');
  $('p-O').classList.remove('on');
  let big = TXT.draw, msg = mode === 'hard' ? TXT.drawHard : TXT.draw, key = 'D';
  if (line) {
    key = grid[line[0]];
    line.forEach((i) => cells[i].classList.add('win'));
    drawStrike(line);
    big = msg = mode === 'duo' ? TXT.wins(key) : key === 'X' ? TXT.youWin : TXT.cpuWins;
    if (mode !== 'duo' && key === 'O') { sfx.lose(); flash(); } else { sfx.win(); stage.classList.add('won'); }
  } else sfx.draw();
  wins[key]++;
  paintScore(key);
  banner(big);
  say(msg);
  setTimeout(() => {
    if (!done) return;
    next.classList.add('on');
    if ($('menu').hidden) next.focus({ preventScroll: true });
  }, 700);
}

function drawStrike([a, , c]) {
  const at = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
  const [x1, y1] = at(a), [x2, y2] = at(c), k = 0.18; // run a little past the end squares
  strike.setAttribute('x1', x1 - (x2 - x1) * k); strike.setAttribute('y1', y1 - (y2 - y1) * k);
  strike.setAttribute('x2', x2 + (x2 - x1) * k); strike.setAttribute('y2', y2 + (y2 - y1) * k);
  strike.classList.add('on');
}

/* ---------- HUD ---------- */
function paintScore(changed) {
  for (const k in wins) $('w-' + k).textContent = wins[k];
  if (changed) bump($('w-' + changed));
}
function say(text) { $('status').textContent = text; }
function label(i) { cells[i].setAttribute('aria-label', TXT.cell(i, grid[i])); }

/* ---------- input ---------- */
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => start(b.dataset.mode)));
$('modes').onclick = (e) => { e.currentTarget.blur(); show('menu'); };
next.onclick = () => { next.blur(); newRound(); };
addEventListener('keydown', (e) => {
  if (/^[1-9]$/.test(e.key)) humanMove(Number(e.key) - 1);
  else if (e.key === 'Escape' && round) show(null);
});
