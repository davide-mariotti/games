// Maze Rush: plain canvas, no libraries. Shared helpers (icons, sound, overlays) in /games/shared/arcade.js.
// Positions are in cells (a cell's centre is x + .5, y + .5); drawing scales them by `cs` pixels per cell.
'use strict';

Object.assign(ICONS, {
  gem: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
  bug: '<path d="M12 20v-9"/><path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z"/><path d="M14.12 3.88 16 2"/><path d="M21 21a4 4 0 0 0-3.81-4"/><path d="M21 5a4 4 0 0 1-3.55 3.97"/><path d="M22 13h-4"/><path d="M3 21a4 4 0 0 1 3.81-4"/><path d="M3 5a4 4 0 0 0 3.55 3.97"/><path d="M6 13H2"/><path d="m8 2 1.88 1.88"/><path d="M9 7.13V6a3 3 0 1 1 6 0v1.13"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>',
  'key-round': '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
});

const BEST_KEY = 'maze_highscore';
const TXT = IT ? { level: 'Livello', locked: 'Serve la chiave', key: 'Chiave!' } : { level: 'Level', locked: 'Find the key', key: 'Key!' };
const SPEED = 8.5, BUG_HIT = 5, HOURGLASS = 8, DURATION = { compass: 8 }; // cells per second, seconds
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]; // n e s w: the opposite of d is (d + 2) % 4, a cell's open sides are bits
const ITEM = {
  gem: { color: COLOR.lime, fill: 0.3, size: 0.6 },
  hourglass: { color: COLOR.ink, fill: 0, size: 0.56, ring: true },
  compass: { color: COLOR.ink, fill: 0, size: 0.56, ring: true },
  'key-round': { color: COLOR.lime, fill: 0.14, size: 0.62 },
  bug: { color: COLOR.danger, fill: 0.14, size: 0.66 },
  lock: { color: COLOR.ink, fill: 0.1, size: 0.4 },
};

setupPage();
const stage = $('stage');
const hud = $('hud');
const cvs = $('game');
const ctx = cvs.getContext('2d');
const ui = {
  score: $('score'), best: $('best'), level: $('level'), clock: $('clock'), time: $('time'), final: $('final'), record: $('record'),
  chips: [...document.querySelectorAll('.chip')],
};
const sprites = {};

/* ---------- state ---------- */
let W = 0, H = 0, cs = 1, ox = 0, oy = 0, area = { w: 1, h: 1, top: 0 };
const walls = document.createElement('canvas'); // floor and walls, drawn once per maze
let state = 'menu'; // menu | play | paused | dying | over
let M, P, items = [], bugs = [], parts = [], floats = [], trail = [];
let score = 0, level = 1, time = 0, shownTime = -1, mazes = 0, gems = 0, steps = 0, warp = 0, warpFn = null, shake = 0, dieT = 0, lockT = 0;
let best = Number(store.get(BEST_KEY)) || 0;
let held = -1; // arrow key being held down
const power = { compass: 0, key: 0 };

const sfx = {
  go: () => tone(300, 0.08, 'sine', 0.03, 520),
  wall: () => tone(140, 0.08, 'square', 0.02, 100),
  gem: (n) => tone(NOTES[4 + (n % 5)], 0.14, 'triangle', 0.06),
  key: () => [2, 4, 7].forEach((j, i) => tone(NOTES[j], 0.16, 'triangle', 0.06, 0, i * 0.06)),
  locked: () => tone(200, 0.2, 'square', 0.03, 150),
  power: () => tone(330, 0.3, 'sine', 0.07, 990),
  hit: () => tone(160, 0.45, 'sawtooth', 0.08, 40),
  tick: () => tone(1200, 0.05, 'square', 0.02),
  clear: () => [0, 2, 4, 7].forEach((j, i) => tone(NOTES[j], 0.18, 'triangle', 0.06, 0, i * 0.07)),
  start: () => tone(392, 0.18, 'triangle', 0.05, 784),
  over: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)),
};

/* ---------- the maze ---------- */
const isOpen = (c, d) => d >= 0 && (M.open[c] >> d) & 1;
const step = (c, d) => c + DX[d] + DY[d] * M.cols;
const center = (c) => [(c % M.cols) + 0.5, ((c / M.cols) | 0) + 0.5];
const closed = () => M.locked && !power.key;
const pick = (a) => a[(Math.random() * a.length) | 0];
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function neighbour(c, d) { // -1 off the grid
  const x = (c % M.cols) + DX[d], y = ((c / M.cols) | 0) + DY[d];
  return x >= 0 && y >= 0 && x < M.cols && y < M.rows ? y * M.cols + x : -1;
}
function link(c, d) { M.open[c] |= 1 << d; M.open[step(c, d)] |= 1 << ((d + 2) % 4); }

// depth-first backtracker: long winding corridors, exactly one way between any two cells
function carve() {
  const seen = new Uint8Array(M.open.length), stack = [(Math.random() * M.open.length) | 0];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const ways = [0, 1, 2, 3].filter((d) => { const n = neighbour(c, d); return n >= 0 && !seen[n]; });
    if (!ways.length) { stack.pop(); continue; }
    const d = pick(ways);
    link(c, d); seen[step(c, d)] = 1; stack.push(step(c, d));
  }
}

// distances from `from` to every cell; prev[c] is the next cell on the way back to `from`
function bfs(from) {
  const dist = new Int16Array(M.open.length).fill(-1), prev = new Int32Array(M.open.length), q = [from];
  dist[from] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (let d = 0; d < 4; d++) {
      if (!isOpen(c, d)) continue;
      const n = step(c, d);
      if (dist[n] < 0) { dist[n] = dist[c] + 1; prev[n] = c; q.push(n); }
    }
  }
  return { dist, prev };
}
function toward(c, target) {
  const next = bfs(target).prev[c];
  for (let d = 0; d < 4; d++) if (isOpen(c, d) && step(c, d) === next) return d;
  return -1;
}

// bigger every level, shaped like the room it has: short side 6 cells at level 1, 18 at most
function newMaze(lv) {
  const short = Math.max(4, Math.min(5 + lv, 18, Math.floor(Math.min(area.w, area.h) / 22)));
  const long = Math.max(short, Math.round((short * Math.max(area.w, area.h)) / Math.min(area.w, area.h)));
  const [cols, rows] = area.w >= area.h ? [long, short] : [short, long], n = cols * rows;
  M = { cols, rows, open: new Uint8Array(n), seen: new Uint8Array(n), locked: lv >= 3 };
  carve();
  const deadEnd = (c) => [0, 1, 2, 3].filter((d) => isOpen(c, d)).length === 1;
  if (lv >= 4) { // a few loops, so a bug in the way can be walked around
    for (let c = 0; c < n; c++) {
      if (!deadEnd(c) || Math.random() > 0.15) continue;
      const ways = [0, 1, 2, 3].filter((d) => !isOpen(c, d) && neighbour(c, d) >= 0);
      if (ways.length) link(c, pick(ways));
    }
  }

  M.start = pick([0, cols - 1, n - cols, n - 1]);
  const fromStart = bfs(M.start).dist;
  M.exit = fromStart.indexOf(Math.max(...fromStart)); // the farthest cell
  const fromExit = bfs(M.exit).dist;
  M.seen[M.start] = 1;
  items = []; bugs = []; parts = []; floats = []; trail = [];
  const taken = new Set([M.start, M.exit]);
  const put = (kind, c) => { items.push({ kind, c, t: Math.random() * 6 }); taken.add(c); };

  let len = fromStart[M.exit];
  if (M.locked) { // the key goes where it's far from both the start and the exit
    let k = -1, far = -1;
    for (let c = 0; c < n; c++) if (!taken.has(c) && Math.min(fromStart[c], fromExit[c]) > far) { far = Math.min(fromStart[c], fromExit[c]); k = c; }
    put('key-round', k);
    len = fromStart[k] + fromExit[k];
  }
  // gems and power-ups wait at the end of dead ends: worth the detour, if the clock agrees
  const ends = shuffle([...Array(n).keys()].filter((c) => deadEnd(c) && !taken.has(c)));
  for (let i = Math.min(8, 3 + (lv >> 1)); i > 0 && ends.length; i--) put('gem', ends.pop());
  if (lv >= 2 && ends.length && Math.random() < 0.6) put('hourglass', ends.pop());
  if (lv >= 2 && ends.length && Math.random() < 0.4) put('compass', ends.pop());
  if (lv >= 4) {
    const spots = shuffle([...Array(n).keys()].filter((c) => fromStart[c] > len * 0.3 && !taken.has(c)));
    for (let i = Math.min(3, (lv - 2) >> 1); i > 0 && spots.length; i--) {
      bugs.push({ c: spots.pop(), to: -1, d: (Math.random() * 4) | 0, k: 0, t: Math.random() * 6, speed: Math.min(5, 2.6 + 0.15 * lv), calm: 0 });
    }
  }
  // seconds this maze adds to the clock: the shortest walk, paid less per cell as levels go up
  M.bonus = Math.round(4 + len * Math.max(0.3, 0.6 - 0.025 * (lv - 1)));
  P = { c: M.start, to: -1, d: 2, k: 0, want: -1, hurt: 0, sq: 0, hit: false };
}

// behind the menus: a small maze and a dot that knows the way
function attract() { newMaze(2); items = []; bugs = []; fit(); }

function layout() {
  ({ w: W, h: H } = fitCanvas(cvs, ctx));
  const top = hud.getBoundingClientRect().bottom - cvs.getBoundingClientRect().top;
  area = { w: W - 28, h: H - top - 48, top }; // 48 px at the bottom for the power-up chips
}

function fit() {
  cs = Math.max(4, Math.floor(Math.min(area.w / M.cols, area.h / M.rows)));
  ox = Math.round((W - cs * M.cols) / 2);
  oy = Math.round(area.top + (area.h - cs * M.rows) / 2);
  const dpr = Math.min(devicePixelRatio || 1, 2), g = walls.getContext('2d');
  walls.width = Math.round(W * dpr); walls.height = Math.round(H * dpr);
  g.setTransform(dpr * cs, 0, 0, dpr * cs, dpr * ox, dpr * oy);
  g.fillStyle = 'rgba(5,7,6,.6)';
  g.fillRect(0, 0, M.cols, M.rows);
  const p = new Path2D();
  for (let c = 0; c < M.open.length; c++) {
    const x = c % M.cols, y = (c / M.cols) | 0;
    if (!isOpen(c, 0)) { p.moveTo(x, y); p.lineTo(x + 1, y); }
    if (!isOpen(c, 3)) { p.moveTo(x, y); p.lineTo(x, y + 1); }
    if (y === M.rows - 1) { p.moveTo(x, y + 1); p.lineTo(x + 1, y + 1); }
    if (x === M.cols - 1) { p.moveTo(x + 1, y); p.lineTo(x + 1, y + 1); }
  }
  g.lineWidth = Math.max(1.5, Math.min(4, cs * 0.09)) / cs;
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = 'rgba(214,240,224,.85)';
  g.shadowColor = COLOR.accent; // shadowBlur ignores the transform: device pixels
  g.shadowBlur = Math.min(18, cs * 0.4) * dpr; g.stroke(p);
  g.shadowBlur = 3 * dpr; g.stroke(p);
}

function resize() {
  layout();
  if (!M || state === 'menu' || state === 'over') attract(); else fit();
}

/* ---------- effects and HUD ---------- */
function burst(x, y, color, n, f = 1) {
  if (calm) n = Math.ceil(n / 3);
  for (let i = 0; i < n && parts.length < 500; i++) {
    const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 3.5) * f, life = 0.4 + Math.random() * 0.5;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: 0.05 + Math.random() * 0.08, color });
  }
}
function float(x, y, text, color, s = 1) { floats.push({ x, y, text, color, s, life: 0.9, max: 0.9 }); }
function addScore(n) { score += n; ui.score.textContent = score; bump(ui.score); }
function chips() { for (const c of ui.chips) c.classList.toggle('on', power[c.dataset.p] > 0); }
function showTime() {
  const s = Math.ceil(time);
  if (s === shownTime) return;
  if (state === 'play' && s < shownTime && s <= 5 && s > 0) sfx.tick();
  shownTime = s;
  ui.time.textContent = s;
  ui.clock.classList.toggle('low', s <= 10);
}

/* ---------- moving ---------- */
// player and bugs walk from cell c to cell `to`; k goes 0 -> 1 on the way, to is -1 when standing still
function pos(e) {
  const [ax, ay] = center(e.c);
  if (e.to < 0) return [ax, ay];
  const [bx, by] = center(e.to);
  return [ax + (bx - ax) * e.k, ay + (by - ay) * e.k];
}
function tryGo(e, d) {
  if (!isOpen(e.c, d)) return false;
  e.d = d; e.to = step(e.c, d);
  return true;
}

function steer(d) {
  if (state !== 'play' || warp) return;
  if (P.to >= 0) {
    if (d === (P.d + 2) % 4) { [P.c, P.to] = [P.to, P.c]; P.k = 1 - P.k; P.d = d; P.want = -1; } // turn back right away
    else P.want = d; // taken at the next cell where it's possible
  } else if (tryGo(P, d)) { P.k = 0; sfx.go(); }
  else if (P.sq < 0.1) { P.sq = 0.3; sfx.wall(); }
}

// the dot runs on along the corridor, bends included, and stops where it forks
function arrive() {
  P.c = P.to; P.to = -1; steps++;
  M.seen[P.c] = 1;
  reach(P.c);
  if (state !== 'play' || warp) return;
  const back = (P.d + 2) % 4; // a key held down never turns it back: that's what pressing it again is for
  if (tryGo(P, P.want) || (held !== back && tryGo(P, held))) { P.want = -1; return; }
  const ways = [0, 1, 2, 3].filter((d) => d !== back && isOpen(P.c, d));
  if (ways.length === 1) { tryGo(P, ways[0]); return; }
  P.want = -1;
}

function reach(c) {
  const [x, y] = center(c);
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.c !== c) continue;
    items.splice(i, 1);
    if (it.kind === 'gem') {
      gems++; addScore(25);
      float(x, y, '+25', COLOR.lime); burst(x, y, COLOR.lime, 14); sfx.gem(gems);
    } else if (it.kind === 'hourglass') {
      time += HOURGLASS; showTime(); bump(ui.clock);
      float(x, y, `+${HOURGLASS}s`, COLOR.ink); burst(x, y, COLOR.ink, 22, 1.2); sfx.power();
    } else if (it.kind === 'compass') {
      power.compass = DURATION.compass; chips();
      burst(x, y, COLOR.ink, 22, 1.2); sfx.power();
    } else {
      power.key = 1; chips();
      float(x, y, TXT.key, COLOR.lime); burst(x, y, COLOR.lime, 26, 1.3); sfx.key();
    }
  }
  if (c !== M.exit) return;
  if (!closed()) clearMaze();
  else if (lockT <= 0) { lockT = 1.2; float(x, y - 0.6, TXT.locked, COLOR.danger); sfx.locked(); }
}

function clearMaze() {
  mazes++;
  const pts = 100 * level, [x, y] = center(M.exit);
  addScore(pts);
  float(x, y - 0.6, '+' + pts, COLOR.accent, 1.4);
  burst(x, y, COLOR.accent, 40, 1.5); burst(x, y, COLOR.lime, 20);
  sfx.clear();
  power.compass = power.key = 0; chips();
  startWarp(() => {
    level++; ui.level.textContent = level;
    newMaze(level); fit();
    time += M.bonus; showTime(); bump(ui.clock);
    const [sx, sy] = center(M.start);
    float(sx, sy - 0.6, `+${M.bonus}s`, COLOR.accent, 1.2);
    banner(`${TXT.level} ${level}`);
  });
}

// out of one maze and into the next: fade out, swap halfway, fade in
function startWarp(fn) { warp = 0.8; warpFn = fn; }

function bugPick(b) {
  const back = (b.d + 2) % 4, ways = [0, 1, 2, 3].filter((d) => d !== back && isOpen(b.c, d));
  if (!tryGo(b, ways.length ? pick(ways) : back)) b.to = -1;
}

function hitBug(b, x, y) {
  time = Math.max(0, time - BUG_HIT); showTime(); bump(ui.clock);
  P.hurt = 1.5; b.calm = 1.5;
  if (b.to >= 0) { [b.c, b.to] = [b.to, b.c]; b.k = 1 - b.k; b.d = (b.d + 2) % 4; } // and off it goes
  flash(); shake = 0.3;
  burst(x, y, COLOR.danger, 26, 1.2); float(x, y - 0.5, `-${BUG_HIT}s`, COLOR.danger); sfx.hit();
}

function die() {
  state = 'dying'; dieT = 1.2; held = -1; P.want = -1; P.hit = true;
  flash(); shake = 0.4; sfx.over();
  const [x, y] = pos(P);
  burst(x, y, COLOR.danger, 30, 1.2);
}

function update(dt) {
  const live = state === 'play';
  if (warp > 0) {
    const was = warp;
    warp = Math.max(0, warp - dt);
    if (was > 0.4 && warp <= 0.4) warpFn();
  } else if (live) {
    if (P.to < 0 && held !== (P.d + 2) % 4 && tryGo(P, held)) P.k = 0;
    if (P.to >= 0 && (P.k += SPEED * dt) >= 1) { P.k -= 1; arrive(); if (P.to < 0) P.k = 0; }
    for (const b of bugs) {
      b.t += dt; b.calm = Math.max(0, b.calm - dt);
      if (b.to < 0) { bugPick(b); b.k = 0; }
      else if ((b.k += b.speed * dt) >= 1) { b.k -= 1; b.c = b.to; bugPick(b); if (b.to < 0) b.k = 0; }
    }
    const [px, py] = pos(P);
    for (const b of bugs) {
      if (P.hurt > 0 || b.calm > 0) continue;
      const [bx, by] = pos(b);
      if (Math.hypot(px - bx, py - by) < 0.6) hitBug(b, px, py);
    }
    if (power.compass > 0 && (power.compass -= dt) <= 0) { power.compass = 0; chips(); }
    ui.chips[1].style.setProperty('--p', power.compass / DURATION.compass);
    time -= dt;
    if (time <= 0) { time = 0; die(); }
    showTime();
  } else if (state === 'menu' || state === 'over') {
    if (P.to < 0) {
      if (P.c === M.exit) startWarp(attract);
      else { tryGo(P, toward(P.c, M.exit)); P.k = 0; }
    } else if ((P.k += 4.5 * dt) >= 1) {
      P.k -= 1; P.c = P.to; P.to = -1; M.seen[P.c] = 1;
      if (P.c !== M.exit) tryGo(P, toward(P.c, M.exit));
    }
  }
  if (state === 'dying' && (dieT -= dt) <= 0) gameOver();

  P.hurt = Math.max(0, P.hurt - dt);
  P.sq *= Math.exp(-dt * 10);
  lockT -= dt;
  if (P.to >= 0) trail.push(pos(P));
  if (trail.length > (P.to >= 0 ? 10 : 0)) trail.shift();
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], drag = Math.exp(-dt * 3);
    if ((p.life -= dt) <= 0) { parts.splice(i, 1); continue; }
    p.vx *= drag; p.vy *= drag; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    if ((f.life -= dt) <= 0) floats.splice(i, 1); else f.y -= 1.2 * dt;
  }
  shake = Math.max(0, shake - dt);
}

/* ---------- drawing ---------- */
function drawSprite(name, x, y, scale = 1, rot = 0, alpha = 1) {
  const sp = sprites[name];
  if (!sp) return;
  const s = ITEM[name].size * SPRITE_SCALE * scale;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.drawImage(sp, -s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawPortal(now) {
  const [x, y] = center(M.exit), shut = closed(), t = (now / 1000) * (calm ? 0.3 : 1);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 0.9);
  glow.addColorStop(0, shut ? 'rgba(236,243,238,.1)' : 'rgba(47,227,127,.4)'); glow.addColorStop(1, 'rgba(47,227,127,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
  ctx.lineWidth = 0.06; ctx.lineCap = 'round';
  ctx.globalAlpha = shut ? 0.4 : 1;
  for (const [r, spin, color] of [[0.34, 1.6, COLOR.accent], [0.22, -2.4, COLOR.lime]]) {
    ctx.strokeStyle = shut ? COLOR.ink : color;
    for (let i = 0; i < 2; i++) {
      const a = t * spin + i * Math.PI;
      ctx.beginPath(); ctx.arc(x, y, r, a, a + Math.PI * 0.7); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (shut) drawSprite('lock', x, y);
}

function drawCompass(now) {
  const key = closed() && items.find((it) => it.kind === 'key-round'), target = key ? key.c : M.exit;
  const { dist, prev } = bfs(target);
  const pts = [pos(P)];
  for (let c = P.to >= 0 && dist[P.to] < dist[P.c] ? P.to : P.c; ; c = prev[c]) { pts.push(center(c)); if (c === target) break; }
  ctx.save();
  ctx.globalAlpha = Math.min(1, power.compass / 1.5) * 0.75;
  ctx.strokeStyle = COLOR.ink; ctx.lineWidth = 0.08; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.setLineDash([0.05, 0.3]); ctx.lineDashOffset = -now / 400;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.restore();
}

function drawDot(now) {
  const s = warp ? Math.abs(warp - 0.4) / 0.4 : 1; // sucked into the portal, popped out at the start
  if (s < 0.02) return;
  const [x, y] = pos(P), R = 0.3 * s;
  const red = P.hit || (P.hurt > 0 && ((now / 90) | 0) % 2);
  const halo = ctx.createRadialGradient(x, y, 0, x, y, R * 3);
  halo.addColorStop(0, red ? 'rgba(255,90,95,.45)' : 'rgba(47,227,127,.45)'); halo.addColorStop(1, 'rgba(47,227,127,0)');
  ctx.fillStyle = halo; ctx.fillRect(x - R * 3, y - R * 3, R * 6, R * 6);
  ctx.save();
  ctx.translate(x, y);
  // stretched along the way it runs, squashed when it bumps a wall
  const st = P.to >= 0 ? 0.14 : 0, along = 1 + st - P.sq * 0.5, across = 1 - st * 0.6 + P.sq * 0.4;
  if (DX[P.d]) ctx.scale(along, across); else ctx.scale(across, along);
  ctx.fillStyle = red ? COLOR.danger : COLOR.accent;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.arc(-R * 0.32, -R * 0.38, R * 0.3, 0, Math.PI * 2); ctx.fill();
  // eyes: they look where it's going and blink now and then
  const lx = DX[P.d] * R * 0.2, ly = DY[P.d] * R * 0.15, blink = now % 3400 < 110;
  ctx.fillStyle = '#04140a';
  for (const ex of [-0.3, 0.3]) { ctx.beginPath(); ctx.ellipse(ex * R + lx, -R * 0.05 + ly, R * 0.11, blink ? R * 0.02 : R * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  if (!M) return;
  ctx.save();
  if (shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
  ctx.drawImage(walls, 0, 0, W, H);

  ctx.save(); // from here on, cells
  ctx.translate(ox, oy); ctx.scale(cs, cs);
  const seen = new Path2D(); // where the dot has been: those corridors stay lit
  for (let c = 0; c < M.seen.length; c++) {
    if (!M.seen[c]) continue;
    const [x, y] = center(c);
    seen.moveTo(x, y); seen.lineTo(x, y);
    for (const d of [1, 2]) if (isOpen(c, d) && M.seen[step(c, d)]) { seen.moveTo(x, y); seen.lineTo(x + DX[d], y + DY[d]); }
  }
  ctx.strokeStyle = 'rgba(47,227,127,.11)'; ctx.lineWidth = 0.5; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.stroke(seen);
  drawPortal(now);
  for (const it of items) {
    const [x, y] = center(it.c), t = now / 1000 + it.t;
    if (it.kind === 'gem') drawSprite('gem', x, y + Math.sin(t * 3) * 0.05, 1, Math.sin(t * 2) * 0.12);
    else if (it.kind === 'key-round') drawSprite('key-round', x, y, 1 + Math.sin(t * 4) * 0.08, Math.sin(t * 1.5) * 0.3);
    else drawSprite(it.kind, x, y, 1 + Math.sin(t * 6) * 0.08);
  }
  for (const b of bugs) {
    const [x, y] = pos(b);
    drawSprite('bug', x, y, 1, (b.d * Math.PI) / 2 + Math.sin(b.t * 12) * 0.15, b.calm > 0 ? 0.4 : 1);
  }
  if (power.compass > 0) drawCompass(now);

  ctx.globalCompositeOperation = 'lighter';
  trail.forEach(([x, y], i) => {
    const k = i / trail.length;
    ctx.globalAlpha = 0.25 * k; ctx.fillStyle = P.hit ? COLOR.danger : COLOR.accent;
    ctx.beginPath(); ctx.arc(x, y, 0.3 * (0.3 + 0.6 * k), 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawDot(now);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
  ctx.restore();

  if (warp) { // fade the whole maze out and the next one in
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1 - Math.abs(warp - 0.4) / 0.4;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // labels in screen pixels (text scaled up from cells looks soft)
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
    ctx.font = `600 ${Math.round(Math.max(14, Math.min(26, cs * 0.55)) * f.s)}px "Geist Mono", ui-monospace, monospace`;
    ctx.fillStyle = ctx.shadowColor = f.color; ctx.shadowBlur = 12;
    ctx.fillText(f.text, ox + f.x * cs, oy + f.y * cs);
  }
  ctx.restore();
}

let lastT = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
  lastT = now;
  if (state !== 'paused') update(dt);
  draw(now);
  requestAnimationFrame(frame);
}

/* ---------- flow ---------- */
function start() {
  score = 0; level = 1; mazes = 0; gems = 0; steps = 0; shake = 0; warp = 0; lockT = 0; held = -1;
  power.compass = power.key = 0; chips();
  newMaze(1); fit();
  time = 10 + M.bonus; shownTime = -1;
  ui.score.textContent = 0; ui.level.textContent = 1;
  show(null);
  state = 'play';
  showTime();
  sfx.start();
}

function togglePause() {
  if (state === 'play') { state = 'paused'; shake = 0; held = -1; show('paused'); }
  else if (state === 'paused') { state = 'play'; show(null); }
}

function gameOver() {
  state = 'over'; held = -1;
  power.compass = power.key = 0; chips();
  const record = score > best;
  if (record) { best = score; store.set(BEST_KEY, best); ui.best.textContent = best; }
  ui.record.classList.toggle('on', record);
  $('s-mazes').textContent = mazes; $('s-gems').textContent = gems; $('s-steps').textContent = steps;
  countUp(ui.final, score);
  show('over');
  warp = 0; attract(); // the dot finds its way again behind the overlay
}

/* ---------- input ---------- */
const KEYMAP = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(), d = KEYMAP[k];
  if (d !== undefined) { e.preventDefault(); if (!e.repeat) { held = d; steer(d); } }
  else if (k === 'p' || (k === 'escape' && state === 'play')) togglePause();
  else if ((k === ' ' || k === 'enter') && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    if (state === 'menu' || state === 'over') start(); else if (state === 'paused') togglePause();
  }
});
addEventListener('keyup', (e) => { if (KEYMAP[e.key.toLowerCase()] === held) held = -1; });
addEventListener('blur', () => { held = -1; if (state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
// touch or mouse: swipe; keep dragging to steer without lifting the finger
let swipe = null;
stage.addEventListener('pointerdown', (e) => { if (state === 'play' && !e.target.closest('button')) swipe = { x: e.clientX, y: e.clientY }; });
stage.addEventListener('pointermove', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
  swipe = { x: e.clientX, y: e.clientY };
});
for (const t of ['pointerup', 'pointercancel']) addEventListener(t, () => (swipe = null));

$('play').onclick = start;
$('again').onclick = start;
$('resume').onclick = togglePause;
$('pause').onclick = (e) => { e.currentTarget.blur(); togglePause(); };

ui.best.textContent = best;
ui.time.textContent = '--';
resize();
new ResizeObserver(resize).observe(stage);
document.fonts.ready.then(() => { layout(); fit(); }); // the HUD's height depends on the fonts
Promise.all(Object.entries(ITEM).map(async ([name, k]) => {
  sprites[name] = await neonSprite(name, k.color, k.fill, k.ring);
})).then(() => requestAnimationFrame((t) => { lastT = t; frame(t); }));
