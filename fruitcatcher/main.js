// Fruit Catcher: plain canvas, no libraries. Shared helpers (icons, sound, overlays) in /games/shared/arcade.js.
'use strict';

Object.assign(ICONS, {
  apple: '<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>',
  cherry: '<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/>',
  grape: '<path d="M22 5V2l-5.89 5.89"/><circle cx="16.6" cy="15.89" r="3"/><circle cx="8.11" cy="7.4" r="3"/><circle cx="12.35" cy="11.65" r="3"/><circle cx="13.91" cy="5.85" r="3"/><circle cx="18.15" cy="10.09" r="3"/><circle cx="6.56" cy="13.2" r="3"/><circle cx="10.8" cy="17.44" r="3"/><circle cx="5" cy="19" r="3"/>',
  citrus: '<path d="M21.66 17.67a1.08 1.08 0 0 1-.04 1.6A12 12 0 0 1 4.73 2.38a1.1 1.1 0 0 1 1.61-.04z"/><path d="M19.65 15.66A8 8 0 0 1 8.35 4.34"/><path d="m14 10-5.5 5.5"/><path d="M14 17.85V10H6.15"/>',
  banana: '<path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5"/><path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  bomb: '<circle cx="11" cy="13" r="9"/><path d="M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95"/><path d="m22 2-1.5 1.5"/>',
  snowflake: '<path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  heart: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
});

const FRUITS = ['apple', 'cherry', 'grape', 'citrus', 'banana'];
const KIND = {
  apple: { color: COLOR.accent, type: 'fruit' },
  cherry: { color: COLOR.lime, type: 'fruit' },
  grape: { color: COLOR.accent, type: 'fruit' },
  citrus: { color: COLOR.lime, type: 'fruit' },
  banana: { color: COLOR.lime, type: 'fruit' },
  star: { color: COLOR.lime, type: 'gold' },
  bomb: { color: COLOR.danger, type: 'bomb' },
  magnet: { color: COLOR.ink, type: 'power' },
  snowflake: { color: COLOR.ink, type: 'power' },
  shield: { color: COLOR.ink, type: 'power' },
};
const DURATION = { magnet: 7, snowflake: 6 }; // seconds; the shield lasts until a bomb hits it
const BEST_KEY = 'fruitcatcher_highscore'; // same key as the old Phaser version, so records survive
const TXT = IT ? { level: 'Livello', blocked: 'Parata!' } : { level: 'Level', blocked: 'Blocked!' };

setupPage();
const stage = $('stage');
const cvs = $('game');
const ctx = cvs.getContext('2d');
const ui = {
  score: $('score'), best: $('best'), level: $('level'), combo: $('combo'), final: $('final'), record: $('record'),
  hearts: [...$('lives').children], chips: [...document.querySelectorAll('.chip')],
};
const sprites = {};

/* ---------- state ---------- */
let W = 0, H = 0, u = 0;
const B = { x: 0, y: 0, w: 0, h: 0, vx: 0, tilt: 0, squash: 0 }; // the basket; y is the rim
let state = 'menu'; // menu | play | paused | dying | over
let items = [], parts = [], rings = [], floats = [];
let score = 0, lives = 3, streak = 0, mult = 1, maxStreak = 0, caught = 0, level = 1, elapsed = 0, spawnT = 0, shake = 0, dieT = 0;
let best = Number(store.get(BEST_KEY)) || 0;
let pointerX = null;
const keys = new Set();
const power = { magnet: 0, snowflake: 0, shield: 0 };
const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8 }));

function resize() {
  const ow = W, oh = H;
  ({ w: W, h: H } = fitCanvas(cvs, ctx));
  u = Math.max(28, Math.min(54, Math.min(W, H * 0.8) / 11));
  B.w = u * 2.8; B.h = u * 0.95;
  B.y = H - B.h - Math.max(u, 30);
  B.x = ow ? (B.x * W) / ow : W / 2;
  if (ow) for (const it of items) { it.x *= W / ow; it.y *= H / oh; it.vy *= H / oh; it.py = it.y; }
}
new ResizeObserver(resize).observe(stage);

const sfx = {
  catch: (n) => tone(NOTES[Math.min(n - 1, NOTES.length - 1)], 0.14, 'triangle', 0.07),
  gold: () => [4, 6, 8].forEach((j, i) => tone(NOTES[j], 0.18, 'triangle', 0.06, 0, i * 0.06)),
  combo: () => tone(660, 0.25, 'sine', 0.05, 1320),
  power: () => tone(330, 0.3, 'sine', 0.07, 990),
  block: () => tone(1400, 0.18, 'square', 0.025, 700),
  bomb: () => tone(160, 0.45, 'sawtooth', 0.08, 40),
  miss: () => tone(220, 0.12, 'sine', 0.04, 160),
  level: () => [0, 2, 4].forEach((j, i) => tone(NOTES[j], 0.16, 'triangle', 0.05, 0, i * 0.08)),
  start: () => tone(392, 0.18, 'triangle', 0.05, 784),
  over: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)),
};

/* ---------- HUD ---------- */
function hearts() { ui.hearts.forEach((h, i) => h.classList.toggle('lost', i >= lives)); }
function comboChip() { ui.combo.textContent = 'x' + mult; ui.combo.classList.toggle('on', mult > 1); }
function chips() {
  for (const c of ui.chips) c.classList.toggle('on', power[c.dataset.p] > 0);
  stage.classList.toggle('slow', power.snowflake > 0);
}

/* ---------- effects ---------- */
function burst(x, y, color, n, f = 1) {
  rings.push({ x, y, t: 0, color, f });
  if (calm) n = Math.ceil(n / 3);
  for (let i = 0; i < n && parts.length < 600; i++) {
    const a = Math.random() * Math.PI * 2, s = u * (1.5 + Math.random() * 5) * f;
    const life = 0.45 + Math.random() * 0.5;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - u * 3 * f, g: H * 0.9, life, max: life, size: u * (0.05 + Math.random() * 0.09), color });
  }
}
function fuseSpark(it) {
  const c = Math.cos(it.rot), s = Math.sin(it.rot), ox = it.size * 0.4, oy = -it.size * 0.4;
  const life = 0.2 + Math.random() * 0.25;
  parts.push({ x: it.x + ox * c - oy * s, y: it.y + ox * s + oy * c, vx: (Math.random() - 0.5) * u * 2, vy: -Math.random() * u * 2, g: H * 0.3, life, max: life, size: u * 0.06, color: Math.random() < 0.5 ? COLOR.spark : COLOR.danger });
}
function float(x, y, text, color, s = 1) { floats.push({ x, y, text, color, s, life: 0.9, max: 0.9 }); }

/* ---------- game ---------- */
function spawn(kind) {
  const size = u * (kind === 'star' ? 1.1 : 1);
  items.push({
    kind, k: KIND[kind], size, t: 0,
    x: size + Math.random() * Math.max(1, W - size * 2), y: -size, py: -size,
    vx: (Math.random() - 0.5) * u * 1.2,
    vy: H * (0.2 + 0.035 * (level - 1)) * (0.85 + Math.random() * 0.3),
    rot: Math.random() - 0.5, spin: (Math.random() - 0.5) * 2.4,
  });
}

function pickKind() {
  const r = Math.random(), bomb = Math.min(0.3, 0.1 + 0.025 * (level - 1));
  if (r < bomb) return 'bomb';
  if (r < bomb + 0.035) return 'star';
  if (r < bomb + 0.065 && elapsed > 6) {
    const free = ['magnet', 'snowflake', 'shield'].filter((p) => !power[p]);
    if (free.length) return free[(Math.random() * free.length) | 0];
  }
  return FRUITS[(Math.random() * FRUITS.length) | 0];
}

function breakCombo() { streak = 0; mult = 1; comboChip(); }

function catchItem(it) {
  const { type, color } = it.k;
  B.squash = 0.22;
  if (type === 'bomb') {
    if (power.shield) {
      power.shield = 0; chips();
      burst(it.x, B.y, COLOR.ink, 30, 1.3); float(it.x, B.y - u, TXT.blocked, COLOR.ink); sfx.block();
      return;
    }
    lives--; hearts(); breakCombo(); flash(); sfx.bomb();
    burst(it.x, B.y, COLOR.danger, 40, 1.5);
    shake = 0.45;
    if (lives <= 0) { state = 'dying'; dieT = 1; sfx.over(); }
    return;
  }
  if (type === 'power') {
    power[it.kind] = DURATION[it.kind] || 1; chips();
    burst(it.x, B.y, COLOR.ink, 26, 1.2); sfx.power();
    return;
  }
  streak++; caught++; maxStreak = Math.max(maxStreak, streak);
  const m = Math.min(5, 1 + Math.floor(streak / 5));
  const pts = (type === 'gold' ? 50 : 10) * m;
  score += pts; ui.score.textContent = score; bump(ui.score);
  if (m !== mult) { mult = m; comboChip(); bump(ui.combo); banner('x' + m); sfx.combo(); }
  const gold = type === 'gold';
  burst(it.x, B.y, color, gold ? 36 : 16, gold ? 1.4 : 1);
  float(it.x, B.y - u * 0.6, '+' + pts, color, gold ? 1.5 : 1);
  if (gold) sfx.gold(); else sfx.catch(streak);
}

function moveBasket(dt) {
  const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  if (dir) B.vx += (dir * W * 1.2 - B.vx) * Math.min(1, dt * 12);
  else if (pointerX !== null) B.vx = ((pointerX - B.x) * (1 - Math.exp(-dt * 22))) / dt;
  else B.vx *= Math.exp(-dt * 10);
  B.x = Math.min(Math.max(B.x + B.vx * dt, B.w / 2), W - B.w / 2);
  B.tilt += (Math.max(-0.28, Math.min(0.28, B.vx / (W * 2.5))) - B.tilt) * Math.min(1, dt * 12);
  B.squash *= Math.exp(-dt * 9);
}

function update(dt) {
  const live = state === 'play';
  const g = dt * (state === 'dying' ? 0.2 : power.snowflake > 0 ? 0.45 : 1); // game time: slow-mo bends it, the basket ignores it

  if (live) {
    elapsed += g;
    const lv = 1 + Math.floor(elapsed / 18);
    if (lv !== level) { level = lv; ui.level.textContent = lv; banner(`${TXT.level} ${lv}`); sfx.level(); }
    for (const p in DURATION) {
      if (power[p] > 0 && (power[p] -= dt) <= 0) { power[p] = 0; chips(); }
      ui.chips.find((c) => c.dataset.p === p).style.setProperty('--p', power[p] / DURATION[p]);
    }
  }
  if (state === 'dying' && (dieT -= dt) <= 0) gameOver();

  // the real rain while playing; a few slow fruits behind the menus
  if (state !== 'dying' && (spawnT -= g) <= 0) {
    if (live) { spawn(pickKind()); spawnT = Math.max(0.3, 0.8 * 0.9 ** (level - 1)) * (0.7 + Math.random() * 0.6); }
    else { spawn(FRUITS[(Math.random() * FRUITS.length) | 0]); spawnT = 0.9; }
  }

  moveBasket(dt);

  const G = H * (0.3 + 0.03 * (level - 1));
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], half = it.size / 2;
    it.py = it.y; it.t += g;
    it.vy += G * g; it.x += it.vx * g; it.y += it.vy * g; it.rot += it.spin * g;
    if (it.x < half || it.x > W - half) { it.vx = -it.vx; it.x = Math.min(Math.max(it.x, half), W - half); }
    if (power.magnet > 0 && it.k.type !== 'bomb' && it.y > H * 0.2) {
      const d = B.x - it.x;
      it.x += Math.sign(d) * Math.min(Math.abs(d), W * 0.9 * g);
    }
    if (it.k.type === 'bomb' && Math.random() < g * 30) fuseSpark(it);
    // caught when its centre crosses the rim inside the basket
    if (live && it.py < B.y && it.y >= B.y && Math.abs(it.x - B.x) < B.w / 2 + it.size * 0.15) {
      items.splice(i, 1); catchItem(it); continue;
    }
    if (it.y - it.size > H) {
      items.splice(i, 1);
      if (live && (it.k.type === 'fruit' || it.k.type === 'gold') && streak) { if (streak >= 3) sfx.miss(); breakCombo(); }
    }
  }

  for (const d of dust) if ((d.y += d.z * 0.04 * g) > 1) { d.y = 0; d.x = Math.random(); }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if ((p.life -= dt) <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g * g; p.x += p.vx * g; p.y += p.vy * g;
  }
  for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > 0.5) rings.splice(i, 1);
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    if ((f.life -= dt) <= 0) floats.splice(i, 1); else f.y -= u * 1.4 * dt;
  }
  shake = Math.max(0, shake - dt);
}

/* ---------- drawing ---------- */
function drawBasket(now) {
  const { x, y, w, h } = B, hw = w / 2, bw = w * 0.36, r = h * 0.45;
  ctx.save();
  ctx.translate(x, y + h);
  ctx.rotate(B.tilt);
  ctx.scale(1 + B.squash * 0.5, 1 - B.squash * 0.6); // squash from the bottom, like it took the weight

  // soft light rising from the opening
  ctx.save();
  ctx.translate(0, -h); ctx.scale(1, 2.4);
  const beam = ctx.createRadialGradient(0, 0, 0, 0, 0, hw);
  beam.addColorStop(0, 'rgba(47,227,127,.16)'); beam.addColorStop(1, 'rgba(47,227,127,0)');
  ctx.fillStyle = beam; ctx.beginPath(); ctx.arc(0, 0, hw, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();

  const body = new Path2D();
  body.moveTo(-hw, -h);
  body.lineTo(-bw, -r);
  body.quadraticCurveTo(-bw, 0, -bw + r, 0);
  body.lineTo(bw - r, 0);
  body.quadraticCurveTo(bw, 0, bw, -r);
  body.lineTo(hw, -h);
  const fill = ctx.createLinearGradient(0, -h, 0, 0);
  fill.addColorStop(0, 'rgba(47,227,127,.24)'); fill.addColorStop(1, 'rgba(47,227,127,.04)');
  ctx.fillStyle = fill; ctx.fill(body);

  ctx.save(); ctx.clip(body);
  ctx.strokeStyle = 'rgba(198,243,107,.28)'; ctx.lineWidth = u * 0.05;
  for (const k of [0.35, 0.65]) { ctx.beginPath(); ctx.moveTo(-hw, -h * k); ctx.lineTo(hw, -h * k); ctx.stroke(); }
  ctx.restore();

  const edge = ctx.createLinearGradient(-hw, 0, hw, 0);
  edge.addColorStop(0, COLOR.accent); edge.addColorStop(1, COLOR.lime);
  ctx.strokeStyle = edge; ctx.lineWidth = u * 0.11; ctx.lineJoin = ctx.lineCap = 'round';
  ctx.shadowColor = COLOR.accent; ctx.shadowBlur = u * 0.5;
  ctx.stroke(body);
  ctx.lineWidth = u * 0.14;
  ctx.beginPath(); ctx.moveTo(-hw - u * 0.12, -h); ctx.lineTo(hw + u * 0.12, -h); ctx.stroke();

  // power-ups wrap the basket
  if (power.shield) {
    ctx.strokeStyle = COLOR.ink; ctx.shadowColor = COLOR.ink; ctx.lineWidth = u * 0.07;
    ctx.globalAlpha = 0.55 + Math.sin(now / 180) * 0.2;
    ctx.beginPath(); ctx.arc(0, -h, hw * 1.2, Math.PI, Math.PI * 2); ctx.stroke();
  }
  if (power.magnet > 0) {
    ctx.strokeStyle = COLOR.ink; ctx.lineWidth = u * 0.04; ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
      const p = (now / 1000 * 1.2 + i / 3) % 1;
      ctx.globalAlpha = (1 - p) * 0.4;
      ctx.beginPath(); ctx.arc(0, -h, hw * (0.6 + p * 1.8), Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
  }
  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * shake * u * 0.9, (Math.random() - 0.5) * shake * u * 0.9);

  for (const d of dust) {
    const s = d.z * 1.8;
    ctx.globalAlpha = d.z * 0.35;
    ctx.fillStyle = d.z > 0.85 ? COLOR.accent : COLOR.ink;
    ctx.fillRect(d.x * W, d.y * H, s, s);
  }
  ctx.globalAlpha = 1;

  // pool of light on the floor under the basket
  ctx.save();
  ctx.translate(B.x, B.y + B.h + u * 0.45); ctx.scale(1, 0.22);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, B.w * 0.9);
  pool.addColorStop(0, 'rgba(47,227,127,.35)'); pool.addColorStop(1, 'rgba(47,227,127,0)');
  ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, B.w * 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  for (const it of items) {
    const sp = sprites[it.kind];
    if (!sp) continue;
    const pulse = it.k.type === 'power' || it.k.type === 'gold' ? 1 + Math.sin(it.t * 6) * 0.08 : 1;
    const s = it.size * SPRITE_SCALE * pulse;
    ctx.save();
    ctx.translate(it.x, it.y);
    if (it.k.type !== 'power') ctx.rotate(it.rot);
    ctx.drawImage(sp, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  drawBasket(now);

  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) {
    const p = r.t / 0.5, rad = u * (0.4 + p * 2.2 * r.f);
    ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(0.5, u * 0.08 * (1 - p));
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (const p of parts) {
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
    ctx.font = `600 ${Math.round(u * 0.55 * f.s)}px "Geist Mono", ui-monospace, monospace`;
    ctx.fillStyle = ctx.shadowColor = f.color; ctx.shadowBlur = 12;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (state !== 'paused') update(dt);
  draw(now);
  requestAnimationFrame(frame);
}

/* ---------- flow ---------- */
function start() {
  items = []; parts = []; rings = []; floats = [];
  score = 0; lives = 3; streak = 0; mult = 1; maxStreak = 0; caught = 0; level = 1; elapsed = 0; spawnT = 0.6; shake = 0;
  power.magnet = power.snowflake = power.shield = 0;
  ui.score.textContent = 0; ui.level.textContent = 1;
  hearts(); comboChip(); chips();
  show(null);
  state = 'play';
  sfx.start();
}

function togglePause() {
  if (state === 'play') { state = 'paused'; shake = 0; keys.clear(); show('paused'); }
  else if (state === 'paused') { state = 'play'; show(null); }
}

function gameOver() {
  state = 'over'; keys.clear();
  power.magnet = power.snowflake = power.shield = 0; chips();
  const record = score > best;
  if (record) { best = score; store.set(BEST_KEY, best); ui.best.textContent = best; }
  ui.record.classList.toggle('on', record);
  $('s-fruit').textContent = caught; $('s-combo').textContent = maxStreak; $('s-level').textContent = level;
  countUp(ui.final, score);
  show('over');
}

/* ---------- input ---------- */
const KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { keys.add(KEYMAP[k]); pointerX = null; e.preventDefault(); }
  else if (k === 'p' || (k === 'escape' && state === 'play')) togglePause();
  else if ((k === ' ' || k === 'enter') && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    if (state === 'menu' || state === 'over') start(); else if (state === 'paused') togglePause();
  }
});
addEventListener('keyup', (e) => keys.delete(KEYMAP[e.key.toLowerCase()]));
addEventListener('blur', () => { keys.clear(); if (state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
const aim = (e) => { pointerX = e.clientX - stage.getBoundingClientRect().left; };
stage.addEventListener('pointermove', aim);
stage.addEventListener('pointerdown', aim);

$('play').onclick = start;
$('again').onclick = start;
$('resume').onclick = togglePause;
$('pause').onclick = (e) => { e.currentTarget.blur(); togglePause(); };

ui.best.textContent = best;
Promise.all(Object.entries(KIND).map(async ([name, k]) => {
  sprites[name] = await neonSprite(name, k.color, k.type === 'gold' ? 1 : k.type === 'power' ? 0 : 0.14, k.type === 'power');
})).then(() => requestAnimationFrame((t) => { last = t; frame(t); }));
