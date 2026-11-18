// Snake: plain canvas, no libraries. Shared helpers (icons, sound, overlays) in /games/shared/arcade.js.
// The logic moves on a grid in fixed ticks; the drawing glides between ticks, one tick behind the logic.
'use strict';

Object.assign(ICONS, {
  apple: '<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  snowflake: '<path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/>',
  bomb: '<circle cx="11" cy="13" r="9"/><path d="M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95"/><path d="m22 2-1.5 1.5"/>',
});

const BEST_KEY = 'snake_best'; // the old version counted apples, this one counts points: a fresh record
const TXT = IT ? { level: 'Livello' } : { level: 'Level' };
const ITEM = {
  apple: { color: COLOR.lime, fill: 0.14, size: 0.9 },
  star: { color: COLOR.lime, fill: 1, size: 0.95, life: 6 },
  snowflake: { color: COLOR.ink, fill: 0, size: 0.8, ring: true, life: 8 },
  bomb: { color: COLOR.danger, fill: 0.14, size: 0.85, life: 9 },
};
const DIR = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const SLOW = 6; // seconds of freeze
const TOP = 80; // px kept free for the HUD above the board

setupPage();
const stage = $('stage');
const cvs = $('game');
const ctx = cvs.getContext('2d');
const ui = { score: $('score'), best: $('best'), level: $('level'), final: $('final'), record: $('record'), chip: document.querySelector('.chip') };
const sprites = {};

/* ---------- state ---------- */
let W = 0, H = 0, c = 20, ox = 0, oy = 0, cols = 17, rows = 17, boardImg = null;
let state = 'menu'; // menu | play | paused | dying | over
let body, prevTail, dir, queue, grow, items, parts, floats, bulges, score, apples, level, slow, acc, frac, nextSpawn, deathT, popped, shake;
let best = Number(store.get(BEST_KEY)) || 0;

const sfx = {
  eat: (n) => tone(NOTES[n % NOTES.length], 0.12, 'triangle', 0.07),
  gold: () => [4, 6, 8].forEach((j, i) => tone(NOTES[j], 0.18, 'triangle', 0.06, 0, i * 0.06)),
  power: () => tone(330, 0.3, 'sine', 0.07, 990),
  hit: () => tone(160, 0.45, 'sawtooth', 0.08, 40),
  level: () => [0, 2, 4].forEach((j, i) => tone(NOTES[j], 0.16, 'triangle', 0.05, 0, i * 0.08)),
  start: () => tone(392, 0.18, 'triangle', 0.05, 784),
  over: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)),
};

/* ---------- board ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapX = (x) => (x + cols) % cols;
const wrapY = (y) => (y + rows) % rows;
const px = (x) => ox + (x + 0.5) * c;
const py = (y) => oy + (y + 0.5) * c;

// about 17 cells on the short side, as many as fit on the long one; fixed for the whole game
function boardSize() {
  const aw = W - 24, ah = H - TOP - 12, cell = Math.min(aw, ah) / 17;
  cols = clamp(Math.floor(aw / cell), 12, 30);
  rows = clamp(Math.floor(ah / cell), 12, 36);
}

function layout() {
  const aw = W - 24, ah = H - TOP - 12;
  c = Math.max(8, Math.floor(Math.min(aw / cols, ah / rows)));
  ox = Math.round((W - cols * c) / 2);
  oy = Math.round(TOP + (ah - rows * c) / 2);
  // the board never changes during a game: draw it once
  const dpr = Math.min(devicePixelRatio || 1, 2), bw = cols * c, bh = rows * c;
  boardImg = document.createElement('canvas');
  boardImg.width = Math.ceil(bw * dpr); boardImg.height = Math.ceil(bh * dpr);
  const g = boardImg.getContext('2d');
  g.scale(dpr, dpr);
  g.beginPath(); g.roundRect(0.5, 0.5, bw - 1, bh - 1, Math.min(14, c * 0.6));
  g.fillStyle = 'rgba(255,255,255,.018)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.08)';
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) g.fillRect((x + 0.5) * c - 1, (y + 0.5) * c - 1, 2, 2);
}

function newGame() {
  boardSize(); layout();
  const x = cols >> 1, y = rows >> 1;
  body = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }];
  prevTail = { x: x - 3, y };
  dir = DIR.right; queue = []; grow = 0; items = []; parts = []; floats = []; bulges = [];
  score = 0; apples = 0; level = 1; slow = 0; acc = 0; frac = 0; nextSpawn = 8; deathT = 0; popped = 0; shake = 0;
  addItem('apple');
}

function resize() {
  ({ w: W, h: H } = fitCanvas(cvs, ctx));
  if (!body || state === 'menu' || state === 'over') newGame(); else layout();
}

function freeCell() {
  const h = body[0];
  for (let tries = 0; tries < 300; tries++) {
    const x = (Math.random() * cols) | 0, y = (Math.random() * rows) | 0;
    if (Math.abs(x - h.x) + Math.abs(y - h.y) < 3) continue; // never right under the nose
    if (body.some((s) => s.x === x && s.y === y) || items.some((i) => i.x === x && i.y === y)) continue;
    return { x, y };
  }
  return null;
}
function addItem(kind) { const p = freeCell(); if (p) items.push({ kind, x: p.x, y: p.y, t: 0 }); }

/* ---------- effects ---------- */
function burst(x, y, color, n, f = 1) {
  if (calm) n = Math.ceil(n / 3);
  for (let i = 0; i < n && parts.length < 600; i++) {
    const a = Math.random() * Math.PI * 2, s = c * (1.5 + Math.random() * 5) * f, life = 0.4 + Math.random() * 0.5;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: c * (0.06 + Math.random() * 0.1), color });
  }
}
function float(x, y, text, color, s = 1) { floats.push({ x, y, text, color, s, life: 0.9, max: 0.9 }); }
function chips() { ui.chip.classList.toggle('on', slow > 0); stage.classList.toggle('slow', slow > 0); }

/* ---------- game ---------- */
const interval = () => Math.max(0.055, 0.135 - 0.009 * (level - 1)) * (slow > 0 ? 1.8 : 1);

// two turns can wait in line, so quick "up, left" works; never straight back into yourself
function turn(d) {
  if (state !== 'play') return;
  const last = queue.length ? queue[queue.length - 1] : dir;
  if (queue.length >= 2 || (d.x === -last.x && d.y === -last.y) || d === last) return;
  queue.push(d);
}

// behind the menus a demo snake plays by itself: toward the apple, never into itself
function demoDir() {
  const h = body[0], apple = items.find((i) => i.kind === 'apple');
  const next = (d) => ({ x: wrapX(h.x + d.x), y: wrapY(h.y + d.y) });
  const safe = Object.values(DIR).filter((d) => {
    if (d.x === -dir.x && d.y === -dir.y) return false;
    const n = next(d);
    return !body.some((s, i) => i < body.length - 1 && s.x === n.x && s.y === n.y);
  });
  if (!safe.length || !apple) return dir;
  if (Math.random() < 0.1) return safe[(Math.random() * safe.length) | 0];
  const far = (d) => {
    const n = next(d), dx = Math.abs(n.x - apple.x), dy = Math.abs(n.y - apple.y);
    return Math.min(dx, cols - dx) + Math.min(dy, rows - dy);
  };
  return safe.sort((a, b) => far(a) - far(b))[0];
}

function tick() {
  const live = state === 'play';
  if (!live) dir = demoDir(); else if (queue.length) dir = queue.shift();
  const h = body[0], next = { x: wrapX(h.x + dir.x), y: wrapY(h.y + dir.y) };
  // the tail leaves its cell this tick (unless growing), so moving into it is fine
  const bite = body.some((s, i) => s.x === next.x && s.y === next.y && (i < body.length - 1 || grow > 0));
  const it = items.find((i) => i.x === next.x && i.y === next.y);
  if (bite || (it && it.kind === 'bomb')) {
    if (!live) return newGame();
    if (it) { burst(px(it.x), py(it.y), COLOR.danger, 40, 1.5); items.splice(items.indexOf(it), 1); }
    return die();
  }
  body.unshift(next);
  if (grow > 0) { grow--; prevTail = body[body.length - 1]; } else prevTail = body.pop();
  if (it) eat(it, live);
}

function eat(it, live) {
  items.splice(items.indexOf(it), 1);
  const x = px(it.x), y = py(it.y);
  if (it.kind === 'snowflake') {
    slow = SLOW; chips(); burst(x, y, COLOR.ink, 24, 1.2); sfx.power();
    return;
  }
  grow++; bulges.push(0);
  if (it.kind === 'apple') addItem('apple');
  if (!live) return;
  const gold = it.kind === 'star', pts = (gold ? 50 : 10) * level;
  score += pts; ui.score.textContent = score; bump(ui.score);
  burst(x, y, COLOR.lime, gold ? 34 : 16, gold ? 1.4 : 1);
  float(x, y - c * 0.6, '+' + pts, COLOR.lime, gold ? 1.4 : 1);
  if (gold) { sfx.gold(); return; }
  apples++; sfx.eat(apples);
  const lv = 1 + Math.floor(apples / 5);
  if (lv !== level) { level = lv; ui.level.textContent = lv; banner(`${TXT.level} ${lv}`); sfx.level(); }
  if (Math.random() < 0.18 && !items.some((i) => i.kind === 'star')) addItem('star');
}

function die() {
  state = 'dying'; deathT = 0; popped = 0; frac = 1; shake = 0.5;
  slow = 0; queue = []; chips();
  flash(); sfx.hit(); sfx.over();
}

function update(dt) {
  const live = state === 'play';
  if (state === 'dying') {
    // the snake comes apart from the head down, quicker when it's long
    deathT += dt;
    const per = Math.min(0.035, 0.9 / body.length);
    while (popped < Math.min(body.length, Math.floor(deathT / per))) {
      const s = body[popped++];
      burst(px(s.x), py(s.y), popped === 1 ? COLOR.danger : COLOR.accent, 8, 0.8);
    }
    if (deathT > body.length * per + 0.6) gameOver();
  } else {
    if (live && slow > 0 && (slow -= dt) <= 0) { slow = 0; chips(); }
    if (slow > 0) ui.chip.style.setProperty('--p', slow / SLOW);
    const step = live ? interval() : 0.11;
    acc += dt;
    while (acc >= step) { acc -= step; tick(); if (state === 'dying') break; }
    if (state !== 'dying') frac = acc / step;
    if (live && (nextSpawn -= dt) <= 0) { // bombs from level 3, a freeze now and then
      nextSpawn = 5 + Math.random() * 4;
      const bombs = items.filter((i) => i.kind === 'bomb').length;
      if (level >= 3 && bombs < Math.min(4, 1 + ((level - 3) >> 1)) && Math.random() < 0.7) addItem('bomb');
      else if (!slow && !items.some((i) => i.kind === 'snowflake') && Math.random() < 0.4) addItem('snowflake');
    }
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], life = ITEM[it.kind].life;
    if ((it.t += dt) > life) items.splice(i, 1);
  }
  for (let i = bulges.length - 1; i >= 0; i--) if ((bulges[i] += dt * 30) > body.length + 2) bulges.splice(i, 1);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if ((p.life -= dt) <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    if ((f.life -= dt) <= 0) floats.splice(i, 1); else f.y -= c * 1.6 * dt;
  }
  shake = Math.max(0, shake - dt);
}

/* ---------- drawing ---------- */
// The body as one continuous line in cell units, head first. Across an edge the line keeps going
// outside the board; it's then drawn again shifted by a board width/height, clipped: a portal.
function snakePath(p) {
  const step = (a, b, n) => { const d = a - b; return d > 1 ? d - n : d < -1 ? d + n : d; };
  const h = body[0], b1 = body[1];
  const pts = [{ x: b1.x + step(h.x, b1.x, cols) * p, y: b1.y + step(h.y, b1.y, rows) * p }, { x: b1.x, y: b1.y }];
  let x = b1.x, y = b1.y;
  for (let i = 2; i < body.length; i++) {
    x += step(body[i].x, body[i - 1].x, cols); y += step(body[i].y, body[i - 1].y, rows);
    pts.push({ x, y });
  }
  const t = body[body.length - 1];
  pts.push({ x: x + step(prevTail.x, t.x, cols) * (1 - p), y: y + step(prevTail.y, t.y, rows) * (1 - p) });
  return pts;
}

function bodyColor(t) { // accent at the head to the site's deep green at the tail
  return `rgb(${(47 - 29 * t) | 0},${(227 - 66 * t) | 0},${(127 - 47 * t) | 0})`;
}

function drawSnake(pts, sx, sy, now) {
  const X = (q) => ox + (q.x + sx + 0.5) * c, Y = (q) => oy + (q.y + sy + 0.5) * c;
  const dying = state === 'dying', from = dying ? popped : 0, n = pts.length - 1;
  if (from >= n) return;
  const line = () => { ctx.beginPath(); ctx.moveTo(X(pts[from]), Y(pts[from])); for (let i = from + 1; i <= n; i++) ctx.lineTo(X(pts[i]), Y(pts[i])); };
  ctx.lineCap = ctx.lineJoin = 'round';

  ctx.save(); // glow: one blurred stroke under the whole body
  ctx.strokeStyle = '#12a150'; ctx.lineWidth = c * 0.5;
  ctx.shadowColor = dying ? COLOR.danger : COLOR.accent; ctx.shadowBlur = c * 0.9;
  line(); ctx.stroke();
  ctx.restore();

  for (let i = n - 1; i >= from; i--) { // tail first, so the head sits on top
    const t = i / n;
    let w = c * (0.7 - 0.3 * t);
    for (const b of bulges) w += c * 0.28 * Math.max(0, 1 - Math.abs(i - b) / 1.6); // a swallowed apple travelling down
    ctx.strokeStyle = bodyColor(t); ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(X(pts[i]), Y(pts[i])); ctx.lineTo(X(pts[i + 1]), Y(pts[i + 1])); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(198,243,107,.35)'; ctx.lineWidth = c * 0.1; // light along the back: it reads as a tube
  line(); ctx.stroke();

  if (from > 0) return;
  const hx = X(pts[0]), hy = Y(pts[0]);
  const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, c * 1.5);
  halo.addColorStop(0, dying ? 'rgba(255,90,95,.4)' : 'rgba(47,227,127,.35)'); halo.addColorStop(1, 'rgba(47,227,127,0)');
  ctx.fillStyle = halo; ctx.fillRect(hx - c * 1.5, hy - c * 1.5, c * 3, c * 3);
  ctx.fillStyle = dying ? COLOR.danger : COLOR.accent;
  ctx.beginPath(); ctx.arc(hx, hy, c * 0.42, 0, Math.PI * 2); ctx.fill();
  const blink = now % 3600 < 110, side = { x: -dir.y, y: dir.x };
  ctx.fillStyle = '#04140a';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + dir.x * c * 0.14 + side.x * k * c * 0.19, hy + dir.y * c * 0.14 + side.y * k * c * 0.19, c * 0.09, blink ? c * 0.02 : c * 0.11, Math.atan2(dir.y, dir.x), 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * shake * c * 0.8, (Math.random() - 0.5) * shake * c * 0.8);
  if (boardImg) ctx.drawImage(boardImg, ox, oy, cols * c, rows * c);

  for (const it of items) {
    const k = ITEM[it.kind], sp = sprites[it.kind], left = k.life ? 1 - it.t / k.life : 1;
    if (!sp || (left < 0.25 && Math.floor(now / 120) % 2)) continue; // blinks before it goes
    const x = px(it.x), y = py(it.y), s = c * k.size * SPRITE_SCALE * (1 + Math.sin(it.t * 5) * 0.06) * Math.min(1, it.t * 5);
    ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
    if (k.life && it.kind !== 'bomb') { // time left
      ctx.strokeStyle = k.color; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, c * 0.66, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const pts = snakePath(frac);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, cols * c, rows * c); ctx.clip();
  for (const sx of [-cols, 0, cols]) for (const sy of [-rows, 0, rows]) {
    if (x1 + sx < -1 || x0 + sx > cols || y1 + sy < -1 || y0 + sy > rows) continue;
    drawSnake(pts, sx, sy, now);
  }
  ctx.restore();

  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
    ctx.font = `600 ${Math.round(c * 0.75 * f.s)}px "Geist Mono", ui-monospace, monospace`;
    ctx.fillStyle = ctx.shadowColor = f.color; ctx.shadowBlur = 12;
    ctx.fillText(f.text, f.x, f.y);
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
  newGame();
  ui.score.textContent = 0; ui.level.textContent = 1;
  chips(); show(null);
  state = 'play';
  sfx.start();
}

function togglePause() {
  if (state === 'play') { state = 'paused'; shake = 0; show('paused'); }
  else if (state === 'paused') { state = 'play'; show(null); }
}

function gameOver() {
  state = 'over';
  const record = score > best;
  if (record) { best = score; store.set(BEST_KEY, best); ui.best.textContent = best; }
  ui.record.classList.toggle('on', record);
  $('s-length').textContent = body.length; $('s-apples').textContent = apples; $('s-level').textContent = level;
  countUp(ui.final, score);
  show('over');
  newGame(); // the demo snake takes over behind the overlay
}

/* ---------- input ---------- */
const KEYMAP = { arrowup: DIR.up, w: DIR.up, arrowdown: DIR.down, s: DIR.down, arrowleft: DIR.left, a: DIR.left, arrowright: DIR.right, d: DIR.right };
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { turn(KEYMAP[k]); e.preventDefault(); }
  else if (k === 'p' || (k === 'escape' && state === 'play')) togglePause();
  else if ((k === ' ' || k === 'enter') && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    if (state === 'menu' || state === 'over') start(); else if (state === 'paused') togglePause();
  }
});
addEventListener('blur', () => { if (state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
// swipe anywhere on the stage; keep the finger down and swipe again to chain turns
let swipe = null;
stage.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) swipe = { x: e.clientX, y: e.clientY }; });
stage.addEventListener('pointermove', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) < 22) return;
  turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR.right : DIR.left) : dy > 0 ? DIR.down : DIR.up);
  swipe = { x: e.clientX, y: e.clientY };
});
for (const t of ['pointerup', 'pointercancel']) addEventListener(t, () => (swipe = null));

$('play').onclick = start;
$('again').onclick = start;
$('resume').onclick = togglePause;
$('pause').onclick = (e) => { e.currentTarget.blur(); togglePause(); };

ui.best.textContent = best;
resize();
new ResizeObserver(resize).observe(stage);
Promise.all(Object.entries(ITEM).map(async ([name, k]) => {
  sprites[name] = await neonSprite(name, k.color, k.fill, k.ring);
})).then(() => requestAnimationFrame((t) => { lastT = t; frame(t); }));
