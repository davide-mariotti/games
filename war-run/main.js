// War Run: an army runner in plain canvas, no libraries. Shared helpers in /games/shared/arcade.js.
// The world is a road seen in perspective: x across (the road is -1..1), z ahead of the camera, y up.
// The army runs at depth ZA; gates, squads, barriers and the boss come from ZFAR towards it.
'use strict';

Object.assign(ICONS, {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  swords: '<path d="m13 19 6-6"/><path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5"/><path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="m5 14 4 4"/><path d="m5 21-2-2"/><path d="M7.5 16.5 4 20"/>',
  'circle-plus': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
  'circle-minus': '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
  construction: '<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>',
  skull: '<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
});

const BEST_KEY = 'warrun_best'; // the old version scored differently: a fresh record
const TXT = IT ? { level: 'Livello', boss: 'Boss!', max: 'MAX' } : { level: 'Level', boss: 'Boss!', max: 'MAX' };

/* ---------- tuning ---------- */
const ZA = 3, ZFAR = 44, ZNEAR = 0.9, ROAD = 1;          // world: army depth, horizon depth, camera cut, road half-width
const SP = 0.055, DOT = 0.065, MAX_ARMY = 300;             // soldiers: spacing in the crowd, size, cap
const START_ARMY = 5, DEMO_ARMY = 24;
const LEVEL_LEN = 260;                                   // units of road before the boss
const BULLET_SPEED = 26, BULLET_RANGE = 34, GATE_PER_HIT = 0.2;
const CLASH_RATE = 28;                                   // soldiers traded per second in a melee
const SLAM_R = 0.42, SLAM_WARN = 1;                      // boss attack: radius, seconds of warning
const fireRate = (n) => Math.min(30, 2 + n * 0.35);      // bullets per second: more soldiers, more fire
const bulletDmg = (n) => 1 + Math.floor(n / 90);
const bossHp = (lv) => 80 + 120 * lv * lv;
const worldSpeed = (lv) => Math.min(11, 7 + 0.6 * (lv - 1));
const spawnGap = (lv) => Math.max(10, 16 - lv);
const squadSize = (lv, army) => Math.min(250, 4 + lv * 3 + Math.floor(army * (0.3 + Math.random() * 0.5)));

setupPage();
const stage = $('stage');
const cvs = $('game');
const ctx = cvs.getContext('2d');
const ui = { score: $('score'), best: $('best'), level: $('level'), final: $('final'), record: $('record') };
// a crowd is packed like a sunflower: index -> offset from its centre (z squashed: it's a disc on the ground)
const TGT = Array.from({ length: MAX_ARMY }, (_, i) => {
  const r = SP * Math.sqrt(i + 0.5), a = i * 2.39996;
  return { x: r * Math.cos(a), z: r * Math.sin(a) * 0.75 };
});
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (n) => Math.floor(Math.random() * n);
const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;

/* ---------- projection ---------- */
let W = 0, H = 0, HOR = 0, F = 1, CAM = 1, scene = null, skull = null;
const pxX = (x, z) => W / 2 + (x * F) / z;
const pxY = (z, y = 0) => HOR + ((CAM - y) * F) / z;
const ppu = (z) => F / z; // pixels per unit at depth z
const fade = (z) => clamp((ZFAR - z) / 6, 0, 1); // things fade in out of the haze

function layout() {
  ({ w: W, h: H } = fitCanvas(cvs, ctx));
  HOR = H * 0.34;
  F = 0.44 * W * ZA;                 // the road fills ~90% of the width where the army runs
  CAM = ((H * 0.84 - HOR) * ZA) / F;  // and the army stands at 84% of the height
  buildScene();
}

// glowing beads: a hot core in the colour, a dark rim so a crowd still reads as many, then a soft halo
const DOT_SCALE = 1 / 0.38; // the sprite is this much bigger than the bead
const dots = {};
for (const [name, color] of [['army', COLOR.accent], ['enemy', COLOR.danger], ['lime', COLOR.lime]]) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.12, color); gr.addColorStop(0.34, color);
  gr.addColorStop(0.39, 'rgba(5,7,6,.6)'); gr.addColorStop(0.46, rgba(color, 0.22)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  dots[name] = c;
}

// everything that doesn't move (sky, sun, mountains, road) is painted once per size
function buildScene() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  scene = document.createElement('canvas');
  scene.width = Math.ceil(W * dpr); scene.height = Math.ceil(H * dpr);
  const g = scene.getContext('2d');
  g.scale(dpr, dpr);

  let gr = g.createLinearGradient(0, 0, 0, HOR);
  gr.addColorStop(0, '#050706'); gr.addColorStop(1, '#0d2318');
  g.fillStyle = gr; g.fillRect(0, 0, W, HOR);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(236,243,238,${(Math.random() * 0.45).toFixed(2)})`;
    g.fillRect(Math.random() * W, Math.random() * HOR * 0.85, 1.3, 1.3);
  }

  // a setting sun in the site's green and lime, cut by bands
  const R = Math.min(W * 0.25, HOR * 0.7), cx = W / 2, cy = HOR - R * 0.3;
  gr = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.4);
  gr.addColorStop(0, 'rgba(47,227,127,.22)'); gr.addColorStop(1, 'rgba(47,227,127,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, HOR);
  g.save();
  g.beginPath(); g.rect(0, 0, W, HOR); g.clip();
  gr = g.createLinearGradient(0, cy - R, 0, cy + R);
  gr.addColorStop(0, COLOR.lime); gr.addColorStop(1, COLOR.accent);
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0b1f15';
  for (let i = 0; i < 6; i++) g.fillRect(cx - R, cy + R * (0.05 + i * 0.16), R * 2, 1.5 + i * 1.6);
  g.restore();

  // two ridges, lower in the middle so the sun shows
  for (const [h, fill, edge] of [[0.22, '#08140e', 'rgba(47,227,127,.22)'], [0.13, '#060d09', 'rgba(47,227,127,.45)']]) {
    g.beginPath(); g.moveTo(0, HOR);
    for (let x = 0; x <= W + W / 16; x += W / 16) g.lineTo(x, HOR - 3 - Math.random() * HOR * h * (0.3 + (0.7 * Math.abs(x - cx)) / (W / 2)));
    g.lineTo(W, HOR); g.closePath();
    g.fillStyle = fill; g.fill();
    g.strokeStyle = edge; g.lineWidth = 1; g.stroke();
  }

  gr = g.createLinearGradient(0, HOR, 0, H);
  gr.addColorStop(0, '#0b1d14'); gr.addColorStop(1, '#050706');
  g.fillStyle = gr; g.fillRect(0, HOR, W, H - HOR);

  g.beginPath();
  g.moveTo(pxX(-ROAD, ZNEAR), pxY(ZNEAR)); g.lineTo(pxX(-ROAD, ZFAR), pxY(ZFAR));
  g.lineTo(pxX(ROAD, ZFAR), pxY(ZFAR)); g.lineTo(pxX(ROAD, ZNEAR), pxY(ZNEAR)); g.closePath();
  g.fillStyle = 'rgba(47,227,127,.05)'; g.fill();
  const rail = (x, a, w = 1) => {
    g.strokeStyle = `rgba(47,227,127,${a})`; g.lineWidth = w;
    g.beginPath(); g.moveTo(pxX(x, ZNEAR), pxY(ZNEAR)); g.lineTo(pxX(x, ZFAR), pxY(ZFAR)); g.stroke();
  };
  for (const x of [-0.5, 0, 0.5]) rail(x, 0.12);
  for (const x of [1.6, 2.4, 3.5, 5, 7]) { rail(x, 0.07); rail(-x, 0.07); }
  g.save(); g.shadowColor = COLOR.accent; g.shadowBlur = 14; rail(-ROAD, 0.9, 2); rail(ROAD, 0.9, 2); g.restore();

  gr = g.createLinearGradient(0, HOR - 30, 0, HOR + 40);
  gr.addColorStop(0, 'rgba(47,227,127,0)'); gr.addColorStop(0.45, 'rgba(47,227,127,.12)'); gr.addColorStop(1, 'rgba(47,227,127,0)');
  g.fillStyle = gr; g.fillRect(0, HOR - 30, W, 70);
}

/* ---------- state ---------- */
let state = 'menu'; // menu | play | paused | dying | over
let army, things, bullets, parts, floats, rings, boss;
let dist, levelDist, level, speed, score, maxArmy, sinceSpawn, spawned, fireAcc, shake, dieT, targetX, shown;
let best = Number(store.get(BEST_KEY)) || 0;
const keys = new Set();
const heard = {}; // when each frequent sound last played

function once(name, gap) {
  const t = performance.now();
  if (t - (heard[name] || 0) < gap) return false;
  heard[name] = t;
  return true;
}
const sfx = {
  tick: () => once('tick', 70) && tone(900 + Math.random() * 300, 0.03, 'square', 0.012),
  clash: () => once('clash', 60) && tone(110 + Math.random() * 80, 0.06, 'sawtooth', 0.03, 60),
  up: () => [2, 4, 6].forEach((j, i) => tone(NOTES[j], 0.14, 'triangle', 0.06, 0, i * 0.05)),
  down: () => tone(260, 0.3, 'sawtooth', 0.05, 110),
  cut: () => tone(200, 0.25, 'sawtooth', 0.06, 70),
  wiped: () => tone(520, 0.12, 'triangle', 0.05, 780),
  boss: () => { tone(90, 0.9, 'sawtooth', 0.07, 60); tone(70, 0.9, 'sawtooth', 0.05, 45, 0.25); },
  warn: () => tone(330, 0.12, 'square', 0.025),
  slam: () => tone(90, 0.45, 'sawtooth', 0.09, 30),
  win: () => [0, 2, 4, 7].forEach((j, i) => tone(NOTES[j], 0.2, 'triangle', 0.06, 0, i * 0.09)),
  start: () => tone(392, 0.18, 'triangle', 0.05, 784),
  over: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, 0, i * 0.16)),
};

/* ---------- effects (screen pixels) ---------- */
function burst(x, y, color, n, f = 1) {
  if (calm) n = Math.ceil(n / 3);
  for (let i = 0; i < n && parts.length < 700; i++) {
    const a = Math.random() * Math.PI * 2, s = (40 + Math.random() * 200) * f, life = 0.35 + Math.random() * 0.45;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60 * f, life, max: life, size: 2 + Math.random() * 3 * f, color });
  }
}
function float(x, y, text, color) { floats.push({ x, y, text, color, life: 1, max: 1 }); }
function ring(x, z, r, color) {
  const top = pxY(z + r), bot = pxY(z - r);
  rings.push({ x: pxX(x, z), y: (top + bot) / 2, rx: r * ppu(z), ry: (bot - top) / 2, t: 0, color });
}

/* ---------- army ---------- */
const armyR = () => SP * Math.sqrt(army.units.length + 0.5);
const squadR = (q) => SP * Math.sqrt(q.n + 0.5);
const unitX = (u) => pxX(army.x + u.ox, ZA + u.oz);
const unitY = (u) => pxY(ZA + u.oz, DOT * 0.5);

function addUnits(n) {
  n = Math.min(n, MAX_ARMY - army.units.length);
  for (let i = 0; i < n; i++) army.units.push({ ox: (Math.random() - 0.5) * 0.1, oz: (Math.random() - 0.5) * 0.1, ph: Math.random() * 6 });
  maxArmy = Math.max(maxArmy, army.units.length);
}
function loseUnit(i, color = COLOR.accent) {
  const u = army.units.splice(i, 1)[0];
  if (u) burst(unitX(u), unitY(u), color, 4, 0.6);
}
function removeUnits(n) { for (let i = 0; i < n && army.units.length; i++) loseUnit(army.units.length - 1); }
function frontUnit() { // the soldier nearest to whatever is in front
  let best = 0;
  army.units.forEach((u, i) => { if (u.oz > army.units[best].oz) best = i; });
  return best;
}

/* ---------- what comes down the road ---------- */
function gateRoll(good) {
  if (good) return Math.random() < (level >= 3 ? 0.28 : 0.18) ? { mul: level >= 4 && Math.random() < 0.3 ? 3 : 2 } : { add: 4 + rnd(6 + 5 * level) };
  return Math.random() < 0.2 ? { div: 2 } : { add: -(4 + rnd(6 + 6 * level)) };
}
function spawnGates(z = ZFAR) {
  const m = Math.random(), goodLeft = Math.random() < 0.5;
  const [l, r] = m < 0.7 ? [goodLeft, !goodLeft] : m < 0.85 ? [true, true] : [false, false];
  const pair = [
    { kind: 'gate', z, x0: -ROAD, x1: -0.02, flash: 0, ...gateRoll(l) },
    { kind: 'gate', z, x0: 0.02, x1: ROAD, flash: 0, ...gateRoll(r) },
  ];
  for (const g of pair) g.pair = pair;
  things.push(...pair);
}
function spawnRow(demo) {
  spawned++;
  if (demo || spawned <= 2) return spawnGates(); // the road always opens with gates
  const r = Math.random();
  if (r < 0.42) spawnGates();
  else if (r < 0.8) things.push({ kind: 'squad', z: ZFAR, x: (Math.random() * 2 - 1) * 0.6, n: squadSize(level, army.units.length), fight: false, acc: 0 });
  else {
    const w = 0.5 + Math.random() * 0.5, c = (Math.random() * 2 - 1) * (ROAD - w / 2);
    things.push({ kind: 'bar', z: ZFAR, x0: c - w / 2, x1: c + w / 2 });
  }
}
function spawnBoss() {
  const hp = bossHp(level);
  boss = { z: ZFAR + 2, x: 0, hp, max: hp, slam: null, cd: 3, hurt: 0 };
  banner(TXT.boss); sfx.boss();
}

const gateLabel = (g) => (g.mul ? '×' + g.mul : g.div ? '÷' + g.div : (Math.round(g.add) >= 0 ? '+' : '−') + Math.abs(Math.round(g.add)));
const gateSign = (g) => (g.mul ? 1 : g.div ? -1 : Math.sign(Math.round(g.add)));

function passGate(g) {
  for (const p of g.pair) p.done = true;
  g.flash = 0.6;
  const n = army.units.length;
  const m = clamp(Math.round(g.mul ? n * g.mul : g.div ? Math.ceil(n / g.div) : n + Math.round(g.add)), 0, MAX_ARMY);
  const x = pxX(army.x, ZA), y = pxY(ZA, armyR() * 0.75 + 0.85);
  if (m > n) { addUnits(m - n); float(x, y, '+' + (m - n), COLOR.accent); sfx.up(); }
  else if (m < n) { removeUnits(n - m); float(x, y, '−' + (n - m), COLOR.danger); sfx.down(); }
}

function passBar(b) {
  let lost = 0;
  for (let i = army.units.length - 1; i >= 0; i--) {
    const x = army.x + army.units[i].ox;
    if (x > b.x0 - 0.03 && x < b.x1 + 0.03) { loseUnit(i, COLOR.danger); lost++; }
  }
  if (!lost) return;
  float(pxX(army.x, ZA), pxY(ZA, armyR() * 0.75 + 0.85), '−' + lost, COLOR.danger);
  sfx.cut(); shake = Math.max(shake, 0.25);
}

function melee(q, dt, live) { // one for one, until one side is gone
  q.acc += dt * CLASH_RATE;
  while (q.acc >= 1 && q.n > 0 && army.units.length) {
    q.acc--; q.n--;
    if (live) score += 5;
    loseUnit(frontUnit(), COLOR.danger);
    sfx.clash();
  }
  const x = pxX((army.x + q.x) / 2, ZA + armyR() * 0.75), y = pxY(ZA + armyR() * 0.75, 0.1);
  if (Math.random() < 0.6) burst(x + (Math.random() - 0.5) * 30, y, Math.random() < 0.5 ? COLOR.spark : COLOR.danger, 2, 0.5);
}

function slam(x) {
  let lost = 0;
  for (let i = army.units.length - 1; i >= 0; i--) {
    const u = army.units[i], dx = army.x + u.ox - x;
    if (dx * dx + u.oz * u.oz < SLAM_R * SLAM_R) { loseUnit(i, COLOR.danger); lost++; }
  }
  ring(x, ZA, SLAM_R, COLOR.danger);
  burst(pxX(x, ZA), pxY(ZA), COLOR.danger, 26, 1.2);
  shake = 0.5; sfx.slam();
  if (lost) float(pxX(x, ZA), pxY(ZA, 0.9), '−' + lost, COLOR.danger);
}

function updateBoss(dt, step, live) {
  const b = boss;
  b.z = Math.max(ZA + armyR() * 0.75 + 1.4, b.z - step * 0.4);
  b.x += (army.x * 0.5 - b.x) * Math.min(1, dt * 0.8);
  b.hurt = Math.max(0, b.hurt - dt);
  if (!live || b.z > 22) return;
  if (b.slam) {
    if ((b.slam.t += dt) >= SLAM_WARN) { slam(b.slam.x); b.slam = null; b.cd = Math.max(1.2, 2.6 - level * 0.2); }
  } else if ((b.cd -= dt) <= 0) { b.slam = { x: army.x, t: 0 }; sfx.warn(); }
}

function bossDown() {
  const x = pxX(boss.x, boss.z), y = pxY(boss.z, 0.8);
  burst(x, y, COLOR.danger, 60, 2); burst(x, y, COLOR.lime, 30, 1.6);
  ring(boss.x, boss.z, 0.9, COLOR.lime);
  shake = 0.6;
  score += 250 * level;
  level++; ui.level.textContent = level;
  speed = worldSpeed(level); levelDist = 0; sinceSpawn = 0; spawned = 0;
  boss = null;
  banner(`${TXT.level} ${level}`); sfx.win(); bump(ui.score);
}

// a bullet hits the nearest thing whose front it has just passed (bullets fly over barriers)
function shoot(b, from, live) {
  let hit = null, hz = Infinity;
  for (const t of things) {
    if (t.done || t.kind === 'bar') continue;
    let fz, inside;
    if (t.kind === 'gate') { fz = t.z; inside = t.add !== undefined && b.x > t.x0 && b.x < t.x1; } // × and ÷ can't be changed
    else { const r = squadR(t); fz = t.z - r * 0.75; inside = Math.abs(b.x - t.x) < r + 0.03; }
    if (inside && fz > from && fz <= b.z && fz < hz) { hit = t; hz = fz; }
  }
  const x = pxX(b.x, b.z), y = pxY(b.z, 0.12);
  if (boss && boss.z > from && boss.z <= b.z + 0.3 && boss.z < hz && Math.abs(b.x - boss.x) < 0.5) {
    boss.hp -= b.d; boss.hurt = 0.08;
    burst(x, pxY(boss.z, 0.8), COLOR.spark, 2, 0.5); sfx.tick();
    if (boss.hp <= 0 && live) bossDown();
    return true;
  }
  if (!hit) return false;
  if (hit.kind === 'gate') {
    hit.add = Math.min(99, hit.add + GATE_PER_HIT); hit.flash = Math.max(hit.flash, 0.25);
    burst(x, y, COLOR.lime, 1, 0.4);
  } else {
    const k = Math.min(b.d, hit.n);
    hit.n -= k;
    if (live) score += 5 * k;
    burst(x, y, COLOR.danger, 3, 0.6);
    if (hit.n <= 0) { burst(pxX(hit.x, hit.z), pxY(hit.z, 0.2), COLOR.danger, 20, 1.2); sfx.wiped(); }
  }
  sfx.tick();
  return true;
}

/* ---------- loop ---------- */
function update(dt, now) {
  const live = state === 'play', demo = state === 'menu' || state === 'over';
  if (state === 'dying') { speed *= Math.exp(-dt * 2.5); if ((dieT -= dt) <= 0) return gameOver(); }
  const step = speed * dt;
  dist += step;
  if (live) { levelDist += step; score += step; }

  // steering: pointer sets the target, keys push it, the demo army weaves by itself
  if (demo) targetX = Math.sin(now / 1400) * 0.55;
  else if (live) targetX += ((keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0)) * 2.6 * dt;
  targetX = clamp(targetX, -0.9, 0.9);
  army.x += (targetX - army.x) * (1 - Math.exp(-dt * 9));
  const e = 1 - Math.exp(-dt * 7);
  army.units.forEach((u, i) => { u.ox += (TGT[i].x - u.ox) * e; u.oz += (TGT[i].z - u.oz) * e; });

  const n = army.units.length;
  if (n) {
    fireAcc += dt * fireRate(n);
    while (fireAcc >= 1) { fireAcc--; const u = army.units[rnd(n)]; bullets.push({ x: army.x + u.ox, z: ZA + u.oz + 0.05, d: bulletDmg(n) }); }
  }

  if ((live || demo) && !boss) {
    if (live && levelDist >= LEVEL_LEN) spawnBoss();
    else if ((sinceSpawn += step) >= spawnGap(level)) { sinceSpawn = 0; spawnRow(demo); }
  }

  for (let i = things.length - 1; i >= 0; i--) {
    const t = things[i], pz = t.z;
    if (t.kind === 'squad') {
      if (t.fight) {
        t.z = ZA + armyR() * 0.75 + squadR(t) * 0.75;
        t.x += (army.x - t.x) * Math.min(1, dt * 3);
        melee(t, dt, live);
      } else {
        t.z -= step * 1.35;
        if (t.z < 16) t.x += clamp(army.x - t.x, -1, 1) * 0.45 * dt; // they come for you, slowly
        if (live && army.units.length && t.z > ZA && t.z - squadR(t) * 0.75 <= ZA + armyR() * 0.75 && Math.abs(t.x - army.x) < armyR() + squadR(t)) t.fight = true;
      }
    } else t.z -= step;
    t.flash = Math.max(0, (t.flash || 0) - dt * 2);
    if (live && !t.done && pz > ZA && t.z <= ZA) {
      if (t.kind === 'gate') passGate(army.x < 0 ? t.pair[0] : t.pair[1]);
      else if (t.kind === 'bar') passBar(t);
    }
    if (t.z < ZNEAR || (t.kind === 'squad' && t.n <= 0)) things.splice(i, 1);
  }

  if (boss) updateBoss(dt, step, live);

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i], from = b.z - step; // things moved `step` towards us this frame
    b.z += BULLET_SPEED * dt;
    if (b.z > ZA + BULLET_RANGE || shoot(b, from, live)) bullets.splice(i, 1);
  }

  if (live && !army.units.length) die();

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if ((p.life -= dt) <= 0) { parts.splice(i, 1); continue; }
    p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > 0.5) rings.splice(i, 1);
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    if ((f.life -= dt) <= 0) floats.splice(i, 1); else f.y -= 50 * dt;
  }
  shake = Math.max(0, shake - dt);
  if (live && Math.floor(score) !== shown) { shown = Math.floor(score); ui.score.textContent = shown; }
}

/* ---------- drawing ---------- */
function drawGround() {
  ctx.lineWidth = 1;
  for (let z = 2 - (dist % 2); z < ZFAR; z += 2) {
    if (z < ZNEAR) continue;
    const y = pxY(z), a = Math.min(1, (1 - z / ZFAR) * 1.3);
    ctx.strokeStyle = `rgba(47,227,127,${(0.3 * a).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(pxX(-ROAD, z), y); ctx.lineTo(pxX(ROAD, z), y); ctx.stroke();
    ctx.strokeStyle = `rgba(47,227,127,${(0.07 * a).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pxX(-ROAD, z), y); ctx.moveTo(pxX(ROAD, z), y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let z = 5 - (dist % 5); z < ZFAR; z += 5) { // posts along the road
    if (z < ZNEAR) continue;
    const s = ppu(z), d = 0.12 * s * DOT_SCALE;
    ctx.globalAlpha = fade(z);
    ctx.strokeStyle = 'rgba(47,227,127,.5)'; ctx.lineWidth = Math.max(1, s * 0.025);
    for (const x of [-1.22, 1.22]) {
      const X = pxX(x, z);
      ctx.beginPath(); ctx.moveTo(X, pxY(z)); ctx.lineTo(X, pxY(z, 0.5)); ctx.stroke();
      ctx.drawImage(dots.lime, X - d / 2, pxY(z, 0.5) - d / 2, d, d);
    }
  }
  ctx.globalAlpha = 1;
}

function pill(x, z, y, text, color) {
  const s = ppu(z), fs = clamp(s * 0.16, 11, 22), X = pxX(x, z), Y = pxY(z, y);
  ctx.font = `600 ${fs}px "Geist Mono", ui-monospace, monospace`;
  const w = ctx.measureText(text).width + fs * 1.1, h = fs * 1.6;
  ctx.fillStyle = 'rgba(5,7,6,.72)'; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(X - w / 2, Y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, X, Y + 1);
}

function drawCrowd(cx, cz, n, sprite, now, units) {
  const t = now / 1000;
  for (let i = n - 1; i >= 0; i--) {
    const o = units ? units[i] : TGT[i], z = cz + (units ? o.oz : o.z), x = cx + (units ? o.ox : o.x);
    if (z < ZNEAR) continue;
    const d = DOT * ppu(z) * DOT_SCALE, hop = Math.abs(Math.sin(t * 11 + (units ? o.ph : i))) * 0.035; // they're running
    ctx.drawImage(sprite, pxX(x, z) - d / 2, pxY(z, DOT * 0.5 + hop) - d / 2, d, d);
  }
}

function drawArmy(now) {
  const n = army.units.length;
  if (!n) return;
  drawCrowd(army.x, ZA, n, dots.army, now, army.units);
  pill(army.x, ZA, armyR() * 0.75 + 0.25, n >= MAX_ARMY ? TXT.max : String(n), COLOR.accent);
}

function drawSquad(q, now) {
  ctx.globalAlpha = fade(q.z);
  drawCrowd(q.x, q.z, Math.ceil(q.n), dots.enemy, now);
  if (q.z > ZA * 0.8) pill(q.x, q.z, squadR(q) * 0.75 + 0.25, String(Math.ceil(q.n)), COLOR.danger);
  ctx.globalAlpha = 1;
}

const passed = (z) => (z < ZA ? clamp((z - 2.2) / (ZA - 2.2), 0, 1) : 1); // things that went by fade out before they fill the screen

function drawGate(g) {
  const z = g.z;
  if (z < 1.2) return;
  const s = ppu(z), L = pxX(g.x0 + 0.03, z), R = pxX(g.x1 - 0.03, z), top = pxY(z, 0.85), bot = pxY(z, 0);
  const sign = gateSign(g), c = sign > 0 ? '47,227,127' : sign < 0 ? '255,90,95' : '236,243,238';
  ctx.globalAlpha = fade(z) * passed(z) * (g.done ? 0.45 : 1);
  const gr = ctx.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, `rgba(${c},.34)`); gr.addColorStop(1, `rgba(${c},.05)`);
  ctx.fillStyle = gr; ctx.fillRect(L, top, R - L, bot - top);
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${(g.flash * 0.6).toFixed(2)})`; ctx.fillRect(L, top, R - L, bot - top); }
  ctx.strokeStyle = `rgba(${c},.25)`; ctx.lineWidth = Math.max(2, s * 0.05); ctx.strokeRect(L, top, R - L, bot - top);
  ctx.strokeStyle = `rgb(${c})`; ctx.lineWidth = Math.max(1, s * 0.014); ctx.strokeRect(L, top, R - L, bot - top);
  const fs = s * 0.36;
  if (fs > 5) {
    ctx.font = `700 ${fs}px Geist, system-ui, sans-serif`;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(gateLabel(g), (L + R) / 2, (top + bot) / 2);
  }
  ctx.globalAlpha = 1;
}

function drawBar(b) {
  const z = b.z;
  if (z < 1.2) return;
  const s = ppu(z), L = pxX(b.x0, z), R = pxX(b.x1, z), top = pxY(z, 0.42), bot = pxY(z, 0.14), h = bot - top, lw = Math.max(1, s * 0.02);
  ctx.globalAlpha = fade(z) * passed(z);
  ctx.strokeStyle = COLOR.danger; ctx.lineWidth = lw * 1.5;
  ctx.beginPath();
  for (const X of [L + (R - L) * 0.12, R - (R - L) * 0.12]) { ctx.moveTo(X, pxY(z)); ctx.lineTo(X, bot); }
  ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(L, top, R - L, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,90,95,.22)'; ctx.fillRect(L, top, R - L, h);
  ctx.strokeStyle = 'rgba(255,90,95,.75)'; ctx.lineWidth = h * 0.3;
  ctx.beginPath();
  for (let X = L - h; X < R; X += h * 1.2) { ctx.moveTo(X, bot); ctx.lineTo(X + h, top); }
  ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.shadowColor = COLOR.danger; ctx.shadowBlur = 10;
  ctx.strokeStyle = COLOR.danger; ctx.lineWidth = lw; ctx.strokeRect(L, top, R - L, h);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBoss(now) {
  const b = boss, z = b.z;
  if (z < 1.2) return;
  const s = ppu(z), X = pxX(b.x, z), t = now / 1000, Y = pxY(z, 0.8 + Math.sin(t * 2) * 0.06), r = 0.45 * s * (1 + b.hurt);
  ctx.globalAlpha = fade(z);
  ctx.fillStyle = 'rgba(255,90,95,.18)';
  ctx.beginPath(); ctx.ellipse(X, pxY(z), r * 1.1, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(X, Y); ctx.rotate(t * 0.5);
  const hex = new Path2D();
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; hex.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  hex.closePath();
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, b.hurt ? 'rgba(255,200,200,.6)' : 'rgba(255,90,95,.45)'); gr.addColorStop(1, 'rgba(60,8,12,.92)');
  ctx.fillStyle = gr; ctx.fill(hex);
  ctx.shadowColor = COLOR.danger; ctx.shadowBlur = 20;
  ctx.strokeStyle = COLOR.danger; ctx.lineWidth = Math.max(2, s * 0.04); ctx.stroke(hex);
  ctx.restore();
  if (skull) { const d = r * 1.1 * SPRITE_SCALE; ctx.drawImage(skull, X - d / 2, Y - d / 2, d, d); }
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.strokeStyle = 'rgba(236,243,238,.15)';
  ctx.beginPath(); ctx.arc(X, Y, r * 1.3, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = COLOR.ink;
  ctx.beginPath(); ctx.arc(X, Y, r * 1.3, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, b.hp) / b.max) * Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawSlam() { // where the boss is about to land: get out
  if (!boss || !boss.slam) return;
  const p = boss.slam.t / SLAM_WARN, top = pxY(ZA + SLAM_R), bot = pxY(ZA - SLAM_R);
  const X = pxX(boss.slam.x, ZA), Y = (top + bot) / 2, rx = SLAM_R * ppu(ZA), ry = (bot - top) / 2;
  ctx.fillStyle = `rgba(255,90,95,${(0.1 + p * 0.25).toFixed(2)})`;
  ctx.beginPath(); ctx.ellipse(X, Y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLOR.danger; ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath(); ctx.ellipse(X, Y, rx * p, ry * p, 0, 0, Math.PI * 2); ctx.stroke();
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);
  if (scene) ctx.drawImage(scene, 0, 0, W, H);
  drawGround();
  drawSlam();

  const list = things.slice();
  if (boss) list.push(boss);
  list.push(army);
  list.sort((a, b) => b.z - a.z); // far first
  for (const t of list) {
    if (t === army) drawArmy(now);
    else if (t === boss) drawBoss(now);
    else if (t.kind === 'gate') drawGate(t);
    else if (t.kind === 'bar') drawBar(t);
    else drawSquad(t, now);
  }

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COLOR.lime; ctx.lineCap = 'round';
  for (const b of bullets) {
    ctx.globalAlpha = fade(b.z) * 0.9; ctx.lineWidth = Math.max(1, ppu(b.z) * 0.022);
    ctx.beginPath(); ctx.moveTo(pxX(b.x, b.z), pxY(b.z, 0.12)); ctx.lineTo(pxX(b.x, b.z + 0.4), pxY(b.z + 0.4, 0.12)); ctx.stroke();
  }
  for (const p of parts) {
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  for (const r of rings) {
    const p = r.t / 0.5, k = 1 + p * 1.5;
    ctx.globalAlpha = 1 - p; ctx.strokeStyle = r.color; ctx.lineWidth = 3 * (1 - p) + 1;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.rx * k, r.ry * k, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 22px "Geist Mono", ui-monospace, monospace';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
    ctx.fillStyle = ctx.shadowColor = f.color; ctx.shadowBlur = 12;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  if (boss && state !== 'over') { // boss health, under the HUD
    const w = Math.min(W * 0.62, 340), x = (W - w) / 2, y = 96;
    ctx.fillStyle = 'rgba(5,7,6,.7)'; ctx.beginPath(); ctx.roundRect(x - 10, y - 20, w + 20, 32, 10); ctx.fill();
    ctx.font = '500 10px "Geist Mono", ui-monospace, monospace'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = COLOR.danger; ctx.fillText('BOSS', W / 2, y - 5);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(x, y, w, 5, 3); ctx.fill();
    ctx.fillStyle = COLOR.danger; ctx.beginPath(); ctx.roundRect(x, y, w * Math.max(0, boss.hp / boss.max), 5, 3); ctx.fill();
  }
  ctx.restore();
}

let lastT = 0;
function frame(now) {
  const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
  lastT = now;
  if (state !== 'paused') update(dt, now);
  draw(now);
  requestAnimationFrame(frame);
}

/* ---------- flow ---------- */
function newRun(n) {
  army = { x: 0, z: ZA, units: [] };
  things = []; bullets = []; parts = []; floats = []; rings = []; boss = null;
  dist = 0; levelDist = 0; level = 1; speed = worldSpeed(1); score = 0; maxArmy = 0; shown = 0;
  sinceSpawn = 0; spawned = 0; fireAcc = 0; shake = 0; dieT = 0; targetX = 0;
  addUnits(n);
  spawnGates(n === DEMO_ARMY ? 16 : 26); // something on the road from the first second
  if (n === DEMO_ARMY) spawnGates(31);
}

function start() {
  newRun(START_ARMY);
  ui.score.textContent = 0; ui.level.textContent = 1;
  show(null);
  state = 'play';
  sfx.start();
}

function die() {
  state = 'dying'; dieT = 1.3; shake = 0.4;
  if (boss) boss.slam = null;
  flash(); sfx.over();
}

function togglePause() {
  if (state === 'play') { state = 'paused'; shake = 0; keys.clear(); show('paused'); }
  else if (state === 'paused') { state = 'play'; show(null); }
}

function gameOver() {
  state = 'over';
  const total = Math.floor(score), record = total > best;
  if (record) { best = total; store.set(BEST_KEY, best); ui.best.textContent = best; }
  ui.record.classList.toggle('on', record);
  $('s-road').textContent = Math.floor(dist); $('s-army').textContent = maxArmy; $('s-level').textContent = level;
  countUp(ui.final, total);
  show('over');
  newRun(DEMO_ARMY); // the demo army takes the road again behind the overlay
}

/* ---------- input ---------- */
const KEYMAP = { arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r' };
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
addEventListener('blur', () => { keys.clear(); if (state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
// the army follows the finger (or the mouse) across the road
const aim = (e) => {
  if (state !== 'play') return;
  targetX = (e.clientX - cvs.getBoundingClientRect().left - W / 2) / ppu(ZA);
};
stage.addEventListener('pointermove', aim);
stage.addEventListener('pointerdown', aim);

$('play').onclick = start;
$('again').onclick = start;
$('resume').onclick = togglePause;
$('pause').onclick = (e) => { e.currentTarget.blur(); togglePause(); };

ui.best.textContent = best;
layout();
newRun(DEMO_ARMY);
new ResizeObserver(layout).observe(stage);
neonSprite('skull', COLOR.danger, 0.14).then((c) => { skull = c; });
requestAnimationFrame((t) => { lastT = t; frame(t); });
