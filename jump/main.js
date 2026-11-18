// Digital Jump: plain canvas, no libraries. Shared helpers (icons, sound, overlays) in /games/shared/arcade.js.
// The world is measured in units (u, a tenth of the playfield's width), so the physics doesn't care about screen size.
'use strict';

Object.assign(ICONS, {
  gem: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
  bug: '<path d="M12 20v-9"/><path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z"/><path d="M14.12 3.88 16 2"/><path d="M21 21a4 4 0 0 0-3.81-4"/><path d="M21 5a4 4 0 0 1-3.55 3.97"/><path d="M22 13h-4"/><path d="M3 21a4 4 0 0 1 3.81-4"/><path d="M3 5a4 4 0 0 0 3.55 3.97"/><path d="M6 13H2"/><path d="m8 2 1.88 1.88"/><path d="M9 7.13V6a3 3 0 1 1 6 0v1.13"/>',
  rocket: '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/>',
  'chevrons-up': '<path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>',
});

const BEST_KEY = 'jumpgame_highscore'; // same key as the old Phaser version, so records survive
const HEIGHT_KEY = 'jumpgame_bestheight';
const TXT = IT ? { level: 'Livello', record: 'Record!', best: 'RECORD' } : { level: 'Level', record: 'New record!', best: 'BEST' };
// physics, in units and seconds: a normal jump climbs ~5.2 u, the widest gap is 4.4 u
const G = 32, JUMP = 18.2, SPRING = 31, ROCKET = 26, RUN = 8.5, R = 0.42, PW = 2.3, PH = 0.3;
const DURATION = { rocket: 2.5, magnet: 10 };
const ITEM = {
  gem: { color: COLOR.lime, fill: 0.3, size: 0.85 },
  bug: { color: COLOR.danger, fill: 0.14, size: 1 },
  rocket: { color: COLOR.ink, fill: 0, size: 0.95, ring: true },
  magnet: { color: COLOR.ink, fill: 0, size: 0.95, ring: true },
  'chevrons-up': { color: COLOR.lime, fill: 0, size: 0.9 },
};

setupPage();
const stage = $('stage');
const cvs = $('game');
const ctx = cvs.getContext('2d');
const ui = { score: $('score'), best: $('best'), level: $('level'), final: $('final'), record: $('record'), chips: [...document.querySelectorAll('.chip')] };
const sprites = {};
let plats = {}; // platform sprites, redrawn when the unit changes

/* ---------- state ---------- */
let W = 0, H = 0, u = 1, Wu = 10, Hu = 16;
let state = 'menu'; // menu | play | paused | dying | over
let P, home, platforms, items, parts, floats, trail, camY, topY, maxClimb, bonus, gems, level, shake, dieT, passedBest;
let best = Number(store.get(BEST_KEY)) || 0;
let bestHeight = Number(store.get(HEIGHT_KEY)) || 0;
const power = { rocket: 0, magnet: 0 };
const keys = new Set();
let touchDir = 0;
const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8 }));

const sfx = {
  jump: () => tone(300 + Math.random() * 40, 0.1, 'sine', 0.04, 620),
  spring: () => tone(260, 0.4, 'sine', 0.07, 1500),
  gem: (n) => tone(NOTES[4 + (n % 5)], 0.14, 'triangle', 0.06),
  stomp: () => { tone(220, 0.15, 'square', 0.03, 110); tone(660, 0.12, 'triangle', 0.05, 0, 0.05); },
  crack: () => tone(150, 0.12, 'sawtooth', 0.035, 70),
  rocket: () => tone(110, 2.4, 'sawtooth', 0.025, 900),
  magnet: () => tone(330, 0.3, 'sine', 0.07, 990),
  hit: () => tone(160, 0.45, 'sawtooth', 0.08, 40),
  level: () => [0, 2, 4].forEach((j, i) => tone(NOTES[j], 0.16, 'triangle', 0.05, 0, i * 0.08)),
  start: () => tone(392, 0.18, 'triangle', 0.05, 784),
  over: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)),
};

/* ---------- world ---------- */
function newWorld() {
  const y = -PH / 2 - R; // standing on the first platform
  P = { x: Wu / 2, y, py: y, vx: 0, vy: 0, squash: 0, hit: false };
  platforms = []; items = []; parts = []; floats = []; trail = [];
  camY = -(Hu - 2.5); topY = 0; maxClimb = 0; bonus = 0; gems = 0; level = 1; shake = 0;
  passedBest = bestHeight <= 0;
  power.rocket = power.magnet = 0;
  home = addPlatform(0, Wu / 2, 'normal');
  generate();
}

function pickType() {
  const r = Math.random();
  const moving = level >= 2 ? Math.min(0.32, 0.06 + 0.04 * level) : 0;
  const crumble = level >= 3 ? Math.min(0.2, 0.04 + 0.025 * level) : 0;
  return r < moving ? 'moving' : r < moving + crumble ? 'crumble' : 'normal';
}

function addPlatform(y, x = PW / 2 + Math.random() * (Wu - PW), type = pickType()) {
  const p = { x, y, type, vx: 0, spring: 0, hasSpring: false, fall: 0, gone: 0 };
  if (type === 'moving') p.vx = (Math.random() < 0.5 ? -1 : 1) * (1.6 + 0.25 * level);
  platforms.push(p);
  return p;
}

// keeps half a screen of platforms ready above the camera
function generate() {
  while (topY > camY - Hu * 0.5) {
    const maxGap = Math.min(4.4, 2.2 + 0.3 * (level - 1)), gap = 1.1 + Math.random() * (maxGap - 1.1);
    topY -= gap;
    const p = addPlatform(topY), r = Math.random();
    if (p.type === 'normal' && r < 0.08) p.hasSpring = true;
    else if (r < 0.3) items.push({ kind: 'gem', x: p.x, y: p.y - 1.3, t: Math.random() * 6 });
    else if (r < 0.33 && topY < -30) items.push({ kind: Math.random() < 0.5 ? 'rocket' : 'magnet', x: p.x, y: p.y - 1.4, t: 0 });
    if (level >= 3 && Math.random() < Math.min(0.14, 0.03 + 0.015 * level)) {
      items.push({ kind: 'bug', x: 0.6 + Math.random() * (Wu - 1.2), y: topY + gap / 2, vx: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random()), t: Math.random() * 6 });
    }
  }
}

function resize() {
  const oWu = Wu;
  ({ w: W, h: H } = fitCanvas(cvs, ctx));
  u = Math.min(W, H * 0.62) / 10;
  Wu = W / u; Hu = H / u;
  buildPlatforms();
  if (!P || state === 'menu' || state === 'over') { newWorld(); return; }
  const k = Wu / oWu; // a narrower or wider field mid-game: squeeze everything sideways
  for (const p of platforms) p.x = Math.min(Math.max(p.x * k, PW / 2), Wu - PW / 2);
  for (const it of items) it.x *= k;
  P.x *= k; trail = [];
}

/* ---------- effects ---------- */
function burst(x, y, color, n, f = 1) {
  if (calm) n = Math.ceil(n / 3);
  for (let i = 0; i < n && parts.length < 600; i++) {
    const a = Math.random() * Math.PI * 2, s = (1.5 + Math.random() * 5) * f, life = 0.45 + Math.random() * 0.5;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2 * f, g: 20, life, max: life, size: 0.05 + Math.random() * 0.09, color });
  }
}
function puff(x, y) { // little dust kick when the dot lands
  for (let i = 0; i < (calm ? 3 : 8); i++) {
    const life = 0.25 + Math.random() * 0.25, side = Math.random() < 0.5 ? -1 : 1;
    parts.push({ x, y, vx: side * (1 + Math.random() * 3), vy: -0.5 - Math.random() * 1.5, g: 10, life, max: life, size: 0.05 + Math.random() * 0.06, color: COLOR.accent });
  }
}
function debris(p) { // a cracked platform falls apart
  for (let i = 0; i < (calm ? 4 : 12); i++) {
    const life = 0.6 + Math.random() * 0.4;
    parts.push({ x: p.x + (Math.random() - 0.5) * PW, y: p.y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 2, g: G, life, max: life, size: 0.1 + Math.random() * 0.12, color: COLOR.ink });
  }
}
function exhaust() {
  const life = 0.3 + Math.random() * 0.25;
  parts.push({ x: P.x + (Math.random() - 0.5) * 0.3, y: P.y + R, vx: (Math.random() - 0.5) * 3, vy: 6 + Math.random() * 6, g: 0, life, max: life, size: 0.08 + Math.random() * 0.1, color: [COLOR.spark, COLOR.lime, COLOR.danger][(Math.random() * 3) | 0] });
}
function float(x, y, text, color) { floats.push({ x, y, text, color, life: 0.9, max: 0.9 }); }

/* ---------- game ---------- */
const score = () => Math.floor(maxClimb) * 10 + bonus;
function chips() { for (const c of ui.chips) c.classList.toggle('on', power[c.dataset.p] > 0); }

function land(p, top, live) {
  P.y = top - R;
  P.squash = 0.4;
  if (p.hasSpring) {
    P.vy = -SPRING; p.spring = 0.3;
    if (live) { burst(p.x, top, COLOR.lime, 18, 1.2); sfx.spring(); }
  } else {
    P.vy = -JUMP;
    if (live) sfx.jump();
  }
  puff(P.x, top);
  if (p.type === 'crumble' && live) { p.gone = 0.001; debris(p); sfx.crack(); }
}

function touch(it, y) {
  if (it.kind === 'gem') {
    gems++; bonus += 25;
    float(it.x, y, '+25', COLOR.lime); burst(it.x, y, COLOR.lime, 14); sfx.gem(gems); bump(ui.score);
  } else if (it.kind === 'bug') {
    if (power.rocket > 0 || (P.vy > 0 && P.y < y - 0.1)) { // from above (or on a rocket): squashed
      bonus += 100;
      if (!power.rocket) { P.vy = -JUMP * 1.15; P.squash = 0.4; }
      float(it.x, y, '+100', COLOR.danger); burst(it.x, y, COLOR.danger, 30, 1.3); shake = 0.25; sfx.stomp(); bump(ui.score);
    } else die(true);
  } else {
    power[it.kind] = DURATION[it.kind]; chips();
    burst(it.x, y, COLOR.ink, 24, 1.2); sfx[it.kind]();
  }
}

function die(hit) {
  if (state !== 'play') return;
  state = 'dying'; dieT = hit ? 1.1 : 0.5; keys.clear(); touchDir = 0;
  power.rocket = power.magnet = 0; chips();
  if (hit) { P.vy = -9; P.hit = true; shake = 0.5; flash(); burst(P.x, P.y, COLOR.danger, 36, 1.4); sfx.hit(); }
  sfx.over();
}

function update(dt) {
  const live = state === 'play', attract = state === 'menu' || state === 'over';

  // the dot
  const dir = live ? (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) || touchDir : 0;
  P.vx += (dir * RUN - P.vx) * Math.min(1, dt * (dir ? 10 : 6));
  P.x = (((P.x + P.vx * dt) % Wu) + Wu) % Wu; // off one side, back from the other
  if (power.rocket > 0) {
    P.vy = -ROCKET;
    if ((power.rocket -= dt) <= 0) { power.rocket = 0; chips(); }
    for (let i = 0; i < 3; i++) exhaust();
  } else P.vy += G * dt;
  P.py = P.y; P.y += P.vy * dt;
  P.squash *= Math.exp(-dt * 10);
  if (power.magnet > 0 && (power.magnet -= dt) <= 0) { power.magnet = 0; chips(); }
  for (const c of ui.chips) c.style.setProperty('--p', power[c.dataset.p] / DURATION[c.dataset.p]);
  const last = trail[trail.length - 1];
  if (last && Math.abs(last.x - P.x) > Wu / 2) trail = [];
  trail.push({ x: P.x, y: P.y });
  if (trail.length > 12) trail.shift();

  // platforms: one-way, only when falling; behind the menus the dot just bounces on the first one
  for (const p of platforms) {
    if (p.vx) {
      p.x += p.vx * dt;
      if (p.x < PW / 2 || p.x > Wu - PW / 2) { p.vx = -p.vx; p.x = Math.min(Math.max(p.x, PW / 2), Wu - PW / 2); }
    }
    if (p.gone) { p.gone += dt; p.fall += G * dt; p.y += p.fall * dt; }
    p.spring = Math.max(0, p.spring - dt);
  }
  if (P.vy > 0 && power.rocket <= 0 && state !== 'dying') {
    for (const p of attract ? [home] : platforms) {
      const top = p.y - PH / 2;
      if (!p.gone && P.py + R <= top + 1e-6 && P.y + R >= top && Math.abs(P.x - p.x) < PW / 2 + R * 0.6) { land(p, top, live); break; }
    }
  }

  // gems, bugs, power-ups
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.t += dt;
    if (it.kind === 'bug') {
      it.x += it.vx * dt;
      if (it.x < 0.6 || it.x > Wu - 0.6) { it.vx = -it.vx; it.x = Math.min(Math.max(it.x, 0.6), Wu - 0.6); }
    }
    if (it.kind === 'gem' && power.magnet > 0) {
      const dx = P.x - it.x, dy = P.y - it.y, d = Math.hypot(dx, dy);
      if (d < 8 && d > 0.01) { const s = Math.min(d, 16 * dt) / d; it.x += dx * s; it.y += dy * s; }
    }
    if (it.y > camY + Hu + 2) { items.splice(i, 1); continue; }
    const y = it.y + (it.kind === 'bug' ? Math.sin(it.t * 4) * 0.25 : 0);
    if (!live || Math.hypot(P.x - it.x, P.y - y) > R + (it.kind === 'bug' ? 0.45 : 0.55)) continue;
    items.splice(i, 1);
    touch(it, y);
  }

  if (live) {
    camY = Math.min(camY, P.y - Hu * 0.45);
    if (-P.y > maxClimb) {
      maxClimb = -P.y;
      const lv = 1 + Math.floor(maxClimb / 60);
      if (lv !== level) { level = lv; ui.level.textContent = lv; banner(`${TXT.level} ${lv}`); sfx.level(); }
      if (!passedBest && maxClimb > bestHeight) { passedBest = true; banner(TXT.record); }
    }
    ui.score.textContent = score();
    if (P.y - R > camY + Hu + 0.5) die(false);
  }
  if (state === 'dying' && (dieT -= dt) <= 0) gameOver();

  generate();
  platforms = platforms.filter((p) => p.y < camY + Hu + 2 && p.gone < 0.8);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if ((p.life -= dt) <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    if ((f.life -= dt) <= 0) floats.splice(i, 1); else f.y -= 1.4 * dt;
  }
  shake = Math.max(0, shake - dt);
}

/* ---------- drawing ---------- */
function buildPlatforms() {
  const dpr = Math.min(devicePixelRatio || 1, 2), pad = 0.5, wu = PW + pad * 2, hu = PH + pad * 2;
  const make = (stroke, fill, cracked) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(wu * u * dpr); c.height = Math.ceil(hu * u * dpr);
    const g = c.getContext('2d');
    g.scale(u * dpr, u * dpr);
    g.beginPath(); g.roundRect(pad, pad, PW, PH, PH / 2);
    g.fillStyle = fill; g.fill();
    g.strokeStyle = g.shadowColor = stroke; g.lineWidth = 0.07;
    if (cracked) g.setLineDash([0.22, 0.14]);
    g.shadowBlur = 0.45 * u * dpr; g.stroke(); // shadowBlur ignores the transform: device pixels
    g.shadowBlur = 0.12 * u * dpr; g.stroke();
    if (cracked) {
      g.setLineDash([]); g.lineWidth = 0.04;
      g.beginPath(); g.moveTo(pad + PW * 0.45, pad); g.lineTo(pad + PW * 0.53, pad + PH * 0.5); g.lineTo(pad + PW * 0.47, pad + PH); g.stroke();
    }
    return { c, w: wu, h: hu };
  };
  plats = {
    normal: make(COLOR.accent, 'rgba(47,227,127,.22)'),
    moving: make(COLOR.lime, 'rgba(198,243,107,.2)'),
    crumble: make('rgba(236,243,238,.75)', 'rgba(236,243,238,.05)', true),
  };
}

function drawSprite(name, x, y, scale = 1, rot = 0, flip = 1) {
  const sp = sprites[name];
  if (!sp) return;
  const s = ITEM[name].size * SPRITE_SCALE * scale;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip, 1);
  ctx.drawImage(sp, -s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawDot(x, y, now) {
  const stretch = Math.min(0.28, Math.abs(P.vy) / 90), sq = P.squash;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, R * 3.2);
  halo.addColorStop(0, P.hit ? 'rgba(255,90,95,.45)' : 'rgba(47,227,127,.45)'); halo.addColorStop(1, 'rgba(47,227,127,0)');
  ctx.fillStyle = halo; ctx.fillRect(x - R * 3.2, y - R * 3.2, R * 6.4, R * 6.4);
  ctx.save();
  ctx.translate(x, y + sq * R * 0.4);
  ctx.scale(1 - stretch * 0.5 + sq * 0.45, 1 + stretch - sq * 0.5); // squash on landing, stretch in flight
  ctx.fillStyle = P.hit ? COLOR.danger : COLOR.accent;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.arc(-R * 0.32, -R * 0.38, R * 0.3, 0, Math.PI * 2); ctx.fill();
  // eyes: they look where it's going and blink now and then
  const look = Math.max(-1, Math.min(1, P.vx / RUN)) * R * 0.2, up = P.vy < 0 ? -R * 0.08 : R * 0.05, blink = now % 3400 < 110;
  ctx.fillStyle = '#04140a';
  for (const ex of [-0.3, 0.3]) { ctx.beginPath(); ctx.ellipse(ex * R + look, -R * 0.05 + up, R * 0.11, blink ? R * 0.02 : R * 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * shake * u * 0.8, (Math.random() - 0.5) * shake * u * 0.8);

  // parallax dust, in screen pixels; streaks while the rocket burns
  const fast = power.rocket > 0;
  for (const d of dust) {
    const s = d.z * 1.8, sy = (((d.y * H - camY * u * d.z * 0.35) % H) + H) % H;
    ctx.globalAlpha = d.z * 0.35;
    ctx.fillStyle = d.z > 0.85 ? COLOR.accent : COLOR.ink;
    ctx.fillRect(d.x * W, sy, s, fast ? s * 12 * d.z : s);
  }
  ctx.globalAlpha = 1;

  // from here on, world units
  ctx.save();
  ctx.scale(u, u);
  ctx.translate(0, -camY);

  const marks = [];
  ctx.lineWidth = 1 / u;
  ctx.strokeStyle = 'rgba(236,243,238,.08)';
  for (let m = Math.max(50, Math.ceil(-(camY + Hu) / 50) * 50); m <= -camY; m += 50) {
    ctx.beginPath(); ctx.moveTo(0, -m); ctx.lineTo(Wu, -m); ctx.stroke();
    marks.push(m);
  }
  const showBest = bestHeight > 0 && -bestHeight > camY && -bestHeight < camY + Hu;
  if (showBest) {
    ctx.strokeStyle = 'rgba(198,243,107,.55)'; ctx.lineWidth = 1.5 / u; ctx.setLineDash([0.3, 0.22]);
    ctx.beginPath(); ctx.moveTo(0, -bestHeight); ctx.lineTo(Wu, -bestHeight); ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const p of platforms) {
    const sp = plats[p.type];
    ctx.globalAlpha = p.gone ? Math.max(0, 1 - p.gone / 0.6) : 1;
    ctx.drawImage(sp.c, p.x - sp.w / 2, p.y - sp.h / 2, sp.w, sp.h);
    if (p.hasSpring) {
      const squash = p.spring > 0 ? 0.55 : 1;
      ctx.save(); ctx.translate(p.x, p.y - PH / 2); ctx.scale(1, squash);
      drawSprite('chevrons-up', 0, -0.45 + Math.sin(now / 220) * 0.05);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  for (const it of items) {
    if (it.kind === 'bug') drawSprite('bug', it.x, it.y + Math.sin(it.t * 4) * 0.25, 1, Math.sin(it.t * 9) * 0.15, it.vx < 0 ? -1 : 1);
    else if (it.kind === 'gem') drawSprite('gem', it.x, it.y + Math.sin(it.t * 3) * 0.12, 1, Math.sin(it.t * 2) * 0.12);
    else drawSprite(it.kind, it.x, it.y, 1 + Math.sin(it.t * 6) * 0.08);
  }

  ctx.globalCompositeOperation = 'lighter';
  trail.forEach((t, i) => {
    const k = i / trail.length;
    ctx.globalAlpha = 0.22 * k; ctx.fillStyle = P.hit ? COLOR.danger : COLOR.accent;
    ctx.beginPath(); ctx.arc(t.x, t.y, R * (0.35 + 0.5 * k), 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  drawDot(P.x, P.y, now);
  if (P.x < R) drawDot(P.x + Wu, P.y, now); // half out one side, half in the other
  else if (P.x > Wu - R) drawDot(P.x - Wu, P.y, now);
  if (power.magnet > 0) {
    ctx.strokeStyle = COLOR.ink; ctx.lineWidth = 0.04;
    for (let i = 0; i < 3; i++) {
      const k = (now / 1000 * 1.2 + i / 3) % 1;
      ctx.globalAlpha = (1 - k) * 0.4;
      ctx.beginPath(); ctx.arc(P.x, P.y, R * (1.6 + k * 4), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // labels in screen pixels (text scaled up from tiny units looks soft)
  const sy = (y) => (y - camY) * u;
  ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(236,243,238,.3)';
  for (const m of marks) ctx.fillText(`${m} m`, 10, sy(-m) - 4);
  if (showBest) { ctx.textAlign = 'right'; ctx.fillStyle = COLOR.lime; ctx.fillText(TXT.best, W - 10, sy(-bestHeight) - 4); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
    ctx.font = `600 ${Math.round(u * 0.55)}px "Geist Mono", ui-monospace, monospace`;
    ctx.fillStyle = ctx.shadowColor = f.color; ctx.shadowBlur = 12;
    ctx.fillText(f.text, f.x * u, sy(f.y));
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
  newWorld();
  ui.score.textContent = 0; ui.level.textContent = 1;
  chips(); show(null);
  state = 'play';
  sfx.start();
}

function togglePause() {
  if (state === 'play') { state = 'paused'; shake = 0; keys.clear(); touchDir = 0; show('paused'); }
  else if (state === 'paused') { state = 'play'; show(null); }
}

function gameOver() {
  state = 'over';
  const total = score(), record = total > best;
  if (record) { best = total; store.set(BEST_KEY, best); ui.best.textContent = best; }
  if (maxClimb > bestHeight) { bestHeight = maxClimb; store.set(HEIGHT_KEY, bestHeight.toFixed(1)); }
  ui.record.classList.toggle('on', record);
  $('s-height').textContent = Math.floor(maxClimb); $('s-gems').textContent = gems; $('s-level').textContent = level;
  countUp(ui.final, total);
  show('over');
  newWorld(); // the dot bounces again behind the overlay
}

/* ---------- input ---------- */
const KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { keys.add(KEYMAP[k]); e.preventDefault(); }
  else if (k === 'p' || (k === 'escape' && state === 'play')) togglePause();
  else if ((k === ' ' || k === 'enter') && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    if (state === 'menu' || state === 'over') start(); else if (state === 'paused') togglePause();
  }
});
addEventListener('keyup', (e) => keys.delete(KEYMAP[e.key.toLowerCase()]));
addEventListener('blur', () => { keys.clear(); touchDir = 0; if (state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
// touch or mouse: hold the left or the right half of the stage
let pressed = false;
const steer = (e) => {
  if (!pressed) return;
  const r = stage.getBoundingClientRect();
  touchDir = e.clientX - r.left < r.width / 2 ? -1 : 1;
};
stage.addEventListener('pointerdown', (e) => { if (state !== 'play' || e.target.closest('button')) return; pressed = true; steer(e); });
stage.addEventListener('pointermove', steer);
for (const t of ['pointerup', 'pointercancel']) addEventListener(t, () => { pressed = false; touchDir = 0; });

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
