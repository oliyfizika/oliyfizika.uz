// ==========================================================================
// Nishonga ur — bosqichli ballistika o‘yini.
// Fizika: havo qarshiligisiz gorizontga burchak ostida otilgan jism.
//   x(t) = v₀ cosα · t,  y(t) = h₀ + v₀ sinα · t − g t²/2   (dt = 1/240 s qadam bilan tekshiriladi)
// Dunyo birliklari — metr. Natijalar (yulduzlar) shu brauzerda saqlanadi.
// ==========================================================================

import { icon } from "../../assets/js/ui/icons.js";

const PROGRESS_KEY = "oliyfizika:nishonga-ur:progress";
const DT = 1 / 240;
const MAX_PLAYBACK = 3;           // uzun parvozlar 3 soniyada ko‘rsatiladi (tezlashtirilgan)
const SPEED_MIN = 5;
const SPEED_MAX = 40;
const ANGLE_MAX = 85;

const PLANETS = {
  earth: { name: "Yer", g: 9.8, ground: "--of-success" },
  moon: { name: "Oy", g: 1.62, ground: "--of-text-3" },
  mars: { name: "Mars", g: 3.71, ground: "--of-warning" },
  jupiter: { name: "Yupiter", g: 24.8, ground: "--of-special" },
};

// target: { x, y, r } — y = 0 bo‘lsa nishon yerda, y > 0 bo‘lsa ustunli supa ustida.
// walls: [x0, x1, y0, y1] to‘g‘ri to‘rtburchaklar. lock: o‘zgarmas parametr.
const LEVELS = [
  { title: "Birinchi otish", planet: "earth", target: { x: 20, y: 0, r: 1.2 }, view: [32, 14], start: [45, 10],
    hint: "45° burchakda uchish uzoqligi eng katta bo‘ladi: L = v₀²/g. L = 20 m uchun v₀ = √(20 · 9,8) ≈ 14 m/s." },
  { title: "Uzoqroq nishon", planet: "earth", target: { x: 35, y: 0, r: 1.2 }, view: [44, 18], start: [45, 15],
    hint: "L = v₀² sin2α / g. Tezlikni oshiring: L tezlik kvadratiga proporsional — tezlik 2 marta ortsa, uzoqlik 4 marta ortadi." },
  { title: "Devor ortida", planet: "earth", target: { x: 30, y: 0, r: 1.2 }, walls: [[14.5, 15.5, 0, 6]], view: [40, 18], start: [30, 15],
    hint: "Devor ustidan o‘tishi uchun x = 15 m da balandlik 6 m dan katta bo‘lishi kerak. Burchakni kattaroq oling." },
  { title: "Baland supa", planet: "earth", target: { x: 25, y: 8, r: 1.3 }, view: [36, 20], start: [55, 15],
    hint: "To‘p supaga yuqoridan tushishi kerak. y = x tgα − g x² / (2v₀² cos²α) formulasida x = 25 m bo‘lganda y = 8 m chiqsin." },
  { title: "Burchak qotirilgan", planet: "earth", target: { x: 40, y: 0, r: 1.2 }, lock: { angle: 45 }, view: [50, 20], start: [45, 12],
    hint: "α = 45° da L = v₀²/g. Demak v₀ = √(L · g) = √(40 · 9,8) ≈ 19,8 m/s." },
  { title: "Tezlik qotirilgan", planet: "earth", target: { x: 30, y: 0, r: 1.2 }, walls: [[9.5, 10.5, 0, 10]], lock: { speed: 20 }, view: [40, 22], start: [30, 20],
    hint: "Bir xil uzoqlikka ikki burchakda (α va 90° − α) otish mumkin. Past traektoriya devorga uriladi — tik burchakni tanlang." },
  { title: "Oyda otish", planet: "moon", target: { x: 60, y: 0, r: 1.5 }, view: [76, 34], start: [45, 8],
    hint: "Oyda g = 1,62 m/s² — Yerdagidan 6 marta kichik. Shu tezlikda to‘p 6 marta uzoqroq uchadi." },
  { title: "Marsdagi g‘or", planet: "mars", target: { x: 40, y: 0, r: 1.3 }, walls: [[10, 30, 8, 22]], view: [50, 22], start: [45, 15],
    hint: "G‘or shifti 8 m balandlikda. Eng katta balandlik H = v₀² sin²α / (2g) 8 m dan kichik bo‘lishi uchun past burchakda oting." },
  { title: "Jarlikdan gorizontal", planet: "earth", h0: 20, target: { x: 30, y: 0, r: 1.3 }, lock: { angle: 0 }, view: [40, 26], start: [0, 10],
    hint: "Gorizontal otishda tushish vaqti t = √(2h/g) ≈ 2,02 s. Uzoqlik x = v₀ t, demak v₀ = 30 / 2,02 ≈ 14,8 m/s." },
  { title: "Kichik nishon", planet: "earth", target: { x: 45, y: 5, r: 0.8 }, walls: [[24.5, 25.5, 0, 12]], view: [54, 26], start: [50, 20],
    hint: "Nishon kichik — tezlikni 0,5 m/s qadam bilan aniqlang. Oldingi otishlar izi qayerga tushganini ko‘rsatadi." },
  { title: "Yupiter tortishishi", planet: "jupiter", target: { x: 20, y: 0, r: 1.2 }, view: [30, 14], start: [45, 15],
    hint: "Yupiterda g = 24,8 m/s². 45° da v₀ = √(L · g) = √(20 · 24,8) ≈ 22,3 m/s." },
  { title: "Ikki devor", planet: "earth", target: { x: 40, y: 0, r: 1.1 }, walls: [[11.5, 12.5, 0, 8], [27.5, 28.5, 0, 8]], view: [50, 22], start: [40, 15],
    hint: "Ikkala devor ustidan o‘tish kerak: x = 12 m va x = 28 m da balandlik 8 m dan katta bo‘lsin. 50°–60° atrofida sinab ko‘ring." },
];

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const header = document.querySelector("[data-hide-on-play]");
function show(name) {
  views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  header.hidden = name === "play";
}
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace(/\.0+$/, "").replace(".", ",");

// ------------------------------------------------------------------ progress
function readProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") || {}; } catch { return {}; }
}
function saveStars(i, stars) {
  const p = readProgress();
  p[i] = Math.max(p[i] || 0, stars);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    // katalog kartasi uchun jami yulduzlar
    localStorage.setItem(`${PROGRESS_KEY.replace(":progress", "")}:stars`, String(Object.values(p).reduce((a, b) => a + b, 0)));
  } catch { /* storage yopiq */ }
}
const unlocked = (i, p = readProgress()) => i === 0 || (p[i - 1] || 0) > 0;
const starsHtml = (n, total = 3) => Array.from({ length: total }, (_, k) => `<span class="${k < n ? "on" : ""}">★</span>`).join("");

function renderLevels() {
  const p = readProgress();
  const list = $("levels");
  list.innerHTML = "";
  let total = 0;
  LEVELS.forEach((lvl, i) => {
    total += p[i] || 0;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gm-level";
    const open = unlocked(i, p);
    btn.disabled = !open;
    btn.dataset.done = String((p[i] || 0) > 0);
    btn.innerHTML = `<span class="gm-level__num">${i + 1}-bosqich · ${PLANETS[lvl.planet].name}</span>
      <span class="gm-level__title"></span>
      <span class="gm-stars">${open ? starsHtml(p[i] || 0) : `${icon("lock")} yopiq`}</span>`;
    btn.querySelector(".gm-level__title").textContent = lvl.title;
    btn.addEventListener("click", () => openLevel(i));
    li.append(btn);
    list.append(li);
  });
  $("totalStars").textContent = `${total} / ${LEVELS.length * 3} ★`;
}

// ------------------------------------------------------------------ holat
let li = 0;            // joriy bosqich
let level = LEVELS[0];
let angle = 45;
let speed = 15;
let shots = 0;
let ghosts = [];       // oldingi otishlar
let flight = null;     // { points, result, end, T, startedAt, rate }
let won = false;
let dragging = false;
let colors = {};

const canvas = $("canvas");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;
let view = { x0: -2, x1: 30, y1: 14, s: 10, ox: 0, oy: 0 };

const g = () => PLANETS[level.planet].g;
const h0 = () => level.h0 || 0;

function obstacles() {
  const list = (level.walls || []).map(([x0, x1, y0, y1]) => ({ x0, x1, y0, y1 }));
  const t = level.target;
  if (t.y > 0) {
    list.push({ x0: t.x - t.r, x1: t.x + t.r, y0: t.y - 0.35, y1: t.y, platform: true });
    list.push({ x0: t.x - 0.25, x1: t.x + 0.25, y0: 0, y1: t.y - 0.35, pillar: true });
  }
  return list;
}

// ------------------------------------------------------------------ fizika
function simulate(aDeg, v0) {
  const a = (aDeg * Math.PI) / 180;
  const vx = v0 * Math.cos(a);
  const vy = v0 * Math.sin(a);
  const gg = g();
  const y0 = h0();
  const t = level.target;
  const obs = obstacles();
  const pts = [[0, y0, 0]];
  let prev = [0, y0];
  for (let k = 1; k < 60 / DT; k += 1) {
    const time = k * DT;
    const x = vx * time;
    const y = y0 + vy * time - (gg * time * time) / 2;
    // nishon: yuqoridan pastga t.y sathini kesib o‘tish
    if (prev[1] >= t.y && y < t.y) {
      const f = (prev[1] - t.y) / (prev[1] - y);
      const xc = prev[0] + f * (x - prev[0]);
      if (Math.abs(xc - t.x) <= t.r) {
        pts.push([xc, t.y, time - DT + f * DT]);
        return { points: pts, result: "hit", end: [xc, t.y], T: time };
      }
    }
    const hitObs = obs.find((o) => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
    if (hitObs) {
      pts.push([x, y, time]);
      return { points: pts, result: hitObs.platform || hitObs.pillar ? "platform" : "wall", end: [x, y], T: time };
    }
    if (y <= 0 && x > 0) {
      const f = prev[1] / (prev[1] - y);
      const xc = prev[0] + f * (x - prev[0]);
      pts.push([xc, 0, time - DT + f * DT]);
      return { points: pts, result: "ground", end: [xc, 0], T: time };
    }
    if (x > view.x1 + 6) {
      pts.push([x, y, time]);
      return { points: pts, result: "out", end: [x, y], T: time };
    }
    pts.push([x, y, time]);
    prev = [x, y];
  }
  return { points: pts, result: "out", end: prev, T: 60 };
}

// ------------------------------------------------------------------ chizish
function readColors() {
  const cs = getComputedStyle(document.body);
  const v = (name) => cs.getPropertyValue(name).trim() || "#888";
  colors = {
    sky: v("--of-surface"), grid: v("--of-grid-line"), text: v("--of-text-2"), faint: v("--of-text-3"),
    primary: v("--of-primary"), danger: v("--of-danger"), success: v("--of-success"), wall: v("--of-border-strong"),
    wallEdge: v("--of-text-3"), surface: v("--of-surface"), ground: v(PLANETS[level.planet].ground), warning: v("--of-warning"),
  };
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(280, rect.width);
  H = Math.max(180, rect.height);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  fitView();
  draw();
}

function fitView() {
  const [vw, vh] = level.view;
  const x0 = h0() > 0 ? -5 : -3;
  const padB = 26;
  const padT = 10;
  const s = Math.min(W / (vw - x0), (H - padB - padT) / vh);
  view = { x0, x1: vw, y1: vh, s, ox: -x0 * s + (W - (vw - x0) * s) / 2, oy: H - padB };
}
const sx = (x) => view.ox + x * view.s;
const sy = (y) => view.oy - y * view.s;

function draw(now = performance.now()) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = colors.sky;
  ctx.fillRect(0, 0, W, H);

  // metr to‘ri
  const step = view.x1 > 60 ? 10 : 5;
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.faint;
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let x = 0; x <= view.x1 + 0.01; x += step) {
    ctx.beginPath(); ctx.moveTo(sx(x), sy(0)); ctx.lineTo(sx(x), 0); ctx.stroke();
    ctx.fillText(`${x} m`, sx(x), sy(0) + 17);
  }
  ctx.textAlign = "left";
  for (let y = step; y <= view.y1; y += step) {
    ctx.beginPath(); ctx.moveTo(0, sy(y)); ctx.lineTo(W, sy(y)); ctx.stroke();
    ctx.fillText(`${y} m`, 4, sy(y) - 3);
  }

  // yer
  ctx.fillStyle = colors.ground;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, sy(0), W, H - sy(0));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.ground;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0)); ctx.stroke();

  // jarlik
  if (h0() > 0) {
    ctx.fillStyle = colors.ground;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, sy(h0()), sx(0), sy(0) - sy(h0()));
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(0, sy(h0())); ctx.lineTo(sx(0), sy(h0())); ctx.lineTo(sx(0), sy(0)); ctx.stroke();
  }

  // to‘siqlar
  for (const o of obstacles()) {
    const x = sx(o.x0), y = sy(Math.min(o.y1, view.y1 + 2)), w = (o.x1 - o.x0) * view.s, h = sy(o.y0) - y;
    ctx.fillStyle = o.platform ? colors.danger : colors.wall;
    ctx.globalAlpha = o.platform ? 0.9 : o.pillar ? 0.8 : 0.55;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    if (!o.platform && !o.pillar) { ctx.strokeStyle = colors.wallEdge; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  }

  drawTarget();

  // oldingi otishlar izi
  ghosts.forEach((gh, k) => {
    ctx.strokeStyle = colors.faint;
    ctx.globalAlpha = 0.25 + (0.35 * (k + 1)) / ghosts.length;
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.5;
    path(gh.points, Infinity);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const [ex, ey] = gh.end;
    ctx.fillStyle = colors.faint;
    ctx.beginPath(); ctx.arc(sx(ex), sy(ey), 3, 0, Math.PI * 2); ctx.fill();
  });

  drawCannon();

  // joriy parvoz
  if (flight) {
    const simT = Math.min(flight.T, ((now - flight.startedAt) / 1000) * flight.rate);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2.5;
    const last = path(flight.points, simT);
    ctx.fillStyle = colors.primary;
    ctx.beginPath(); ctx.arc(sx(last[0]), sy(last[1]), Math.max(5, 0.35 * view.s), 0, Math.PI * 2); ctx.fill();
    if (flight.rate > 1.05) {
      ctx.fillStyle = colors.text;
      ctx.textAlign = "right";
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      ctx.fillText(`×${fmt(flight.rate)} tezlashtirilgan`, W - 10, 18);
    }
  }
}

function path(points, upTo) {
  ctx.beginPath();
  let last = points[0];
  ctx.moveTo(sx(last[0]), sy(last[1]));
  for (const p of points) {
    if (p[2] > upTo) break;
    ctx.lineTo(sx(p[0]), sy(p[1]));
    last = p;
  }
  ctx.stroke();
  return last;
}

function drawTarget() {
  const t = level.target;
  const cx = sx(t.x);
  const cy = sy(t.y);
  const r = t.r * view.s;
  // nishon zonasi
  ctx.fillStyle = colors.danger;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(cx - r, cy - 6, 2 * r, 6);
  ctx.globalAlpha = 1;
  // bayroqcha
  const fh = Math.max(24, 2.2 * view.s);
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - fh); ctx.stroke();
  ctx.fillStyle = colors.danger;
  ctx.beginPath(); ctx.moveTo(cx, cy - fh); ctx.lineTo(cx + fh * 0.55, cy - fh * 0.8); ctx.lineTo(cx, cy - fh * 0.6); ctx.closePath(); ctx.fill();
  // halqalar
  [1, 0.6, 0.25].forEach((k, i) => {
    ctx.fillStyle = i % 2 ? colors.surface : colors.danger;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * k, Math.max(2, r * k * 0.22), 0, 0, Math.PI * 2); ctx.fill();
  });
}

function drawCannon() {
  const x = sx(0), y = sy(h0());
  const a = (angle * Math.PI) / 180;
  const len = Math.max(26, 1.6 * view.s);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-a);
  ctx.fillStyle = colors.text;
  ctx.fillRect(0, -5, len, 10);
  ctx.restore();
  ctx.fillStyle = colors.text;
  ctx.beginPath(); ctx.arc(x, y, 10, Math.PI, 0); ctx.fill();
  // nishonga olish strelkasi (faqat yo‘nalish va tezlik, traektoriya emas)
  if (!flight && !won) {
    const L = 30 + (speed / SPEED_MAX) * Math.min(W, H) * 0.32;
    const ex = x + Math.cos(a) * L, ey = y - Math.sin(a) * L;
    ctx.strokeStyle = colors.primary;
    ctx.fillStyle = colors.primary;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 10 * Math.cos(a - 0.4), ey + 10 * Math.sin(a - 0.4));
    ctx.lineTo(ex - 10 * Math.cos(a + 0.4), ey + 10 * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.font = "600 12px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = colors.text;
    ctx.fillText(`${fmt(angle, 0)}°, ${fmt(speed)} m/s`, Math.min(ex + 8, W - 110), Math.max(ey - 8, 14));
  }
}

// ------------------------------------------------------------------ boshqaruv
function syncControls() {
  $("angle").value = String(angle);
  $("speed").value = String(speed);
  $("angleOut").textContent = `${fmt(angle, 0)}°`;
  $("speedOut").textContent = `${fmt(speed)} m/s`;
  const busy = !!flight || won;
  $("angle").disabled = busy || level.lock?.angle !== undefined;
  $("speed").disabled = busy || level.lock?.speed !== undefined;
  $("fire").disabled = busy;
}

function openLevel(i) {
  if (!unlocked(i)) return;
  li = i;
  level = LEVELS[i];
  angle = level.lock?.angle ?? level.start[0];
  speed = level.lock?.speed ?? level.start[1];
  shots = 0; ghosts = []; flight = null; won = false;
  $("lvlNum").textContent = `${i + 1}-bosqich`;
  $("lvlTitle").textContent = level.title;
  $("lvlPlanet").textContent = `${PLANETS[level.planet].name}: g = ${String(g()).replace(".", ",")} m/s²`;
  $("shots").textContent = "0";
  $("angleLock").hidden = level.lock?.angle === undefined;
  $("speedLock").hidden = level.lock?.speed === undefined;
  $("angleBox").dataset.locked = String(level.lock?.angle !== undefined);
  $("speedBox").dataset.locked = String(level.lock?.speed !== undefined);
  const t = level.target;
  $("goal").textContent = `Nishon: x = ${fmt(t.x)} m${t.y > 0 ? `, balandligi ${fmt(t.y)} m` : ""}${h0() ? ` · to‘p ${fmt(h0())} m balandlikdan otiladi` : ""}`;
  $("hint").textContent = level.hint;
  $("last").textContent = "";
  $("win").hidden = true;
  document.querySelector(".nu-hint").open = false;
  show("play");
  readColors();
  syncControls();
  requestAnimationFrame(resize);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fire() {
  if (flight || won) return;
  const sim = simulate(angle, speed);
  shots += 1;
  $("shots").textContent = String(shots);
  const playback = Math.min(sim.T, MAX_PLAYBACK);
  flight = { ...sim, angle, speed, startedAt: performance.now(), rate: sim.T / Math.max(playback, 0.4) };
  if (flight.rate < 1) flight.rate = 1;
  syncControls();
  $("last").textContent = "";
  const loop = (now) => {
    draw(now);
    const simT = ((now - flight.startedAt) / 1000) * flight.rate;
    if (simT < flight.T) requestAnimationFrame(loop);
    else land();
  };
  requestAnimationFrame(loop);
}

function land() {
  const f = flight;
  const t = level.target;
  ghosts.push({ points: f.points, end: f.end });
  if (ghosts.length > 6) ghosts.shift();
  flight = null;
  if (f.result === "hit") {
    won = true;
    const stars = shots === 1 ? 3 : shots <= 3 ? 2 : 1;
    saveStars(li, stars);
    draw();
    $("winStars").innerHTML = starsHtml(stars);
    $("winTitle").textContent = stars === 3 ? "Birinchi otishdayoq!" : "Nishonga tegdi!";
    $("winText").textContent = `α = ${fmt(f.angle, 0)}°, v₀ = ${fmt(f.speed)} m/s · ${shots} ta otish · parvoz vaqti ${fmt(f.T, 2)} s`;
    const last = li + 1 >= LEVELS.length;
    $("nextLvl").textContent = last ? "Barcha bosqichlar" : "Keyingi bosqich";
    $("win").hidden = false;
    $("nextLvl").focus({ preventScroll: true });
    syncControls();
    return;
  }
  draw();
  syncControls();
  const dx = f.end[0] - t.x;
  let msg;
  if (f.result === "wall") msg = `To‘p to‘siqqa urildi (x = ${fmt(f.end[0])} m, y = ${fmt(f.end[1])} m).`;
  else if (f.result === "platform") msg = "To‘p supaning yon tomoniga urildi — u supaga yuqoridan tushishi kerak.";
  else if (f.result === "out") msg = "To‘p maydondan uchib chiqib ketdi — juda kuchli.";
  else msg = `To‘p x = ${fmt(f.end[0])} m da tushdi: nishondan ${fmt(Math.abs(dx))} m ${dx < 0 ? "oldinda" : "uzoqda"}.`;
  $("last").textContent = msg;
}

$("angle").addEventListener("input", (e) => { angle = Number(e.target.value); syncControls(); draw(); });
$("speed").addEventListener("input", (e) => { speed = Number(e.target.value); syncControls(); draw(); });
$("fire").addEventListener("click", fire);
$("retry").addEventListener("click", () => openLevel(li));
$("nextLvl").addEventListener("click", () => {
  if (li + 1 < LEVELS.length) openLevel(li + 1);
  else { renderLevels(); show("setup"); }
});
$("toLevels").addEventListener("click", () => { flight = null; renderLevels(); show("setup"); });

// Maydonda tortib nishonga olish
function aimFrom(e) {
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left;
  const py = e.clientY - r.top;
  const dx = px - sx(0);
  const dy = sy(h0()) - py;
  if (level.lock?.angle === undefined) {
    angle = Math.round(Math.max(0, Math.min(ANGLE_MAX, (Math.atan2(dy, Math.max(dx, 0.001)) * 180) / Math.PI)));
  }
  if (level.lock?.speed === undefined) {
    const len = Math.hypot(dx, dy);
    const L = Math.min(W, H) * 0.32;
    const v = ((len - 30) / L) * SPEED_MAX; // drawCannon dagi strelka uzunligining teskarisi
    speed = Math.round(Math.max(SPEED_MIN, Math.min(SPEED_MAX, v)) * 2) / 2;
  }
  syncControls();
  draw();
}
canvas.addEventListener("pointerdown", (e) => {
  if (flight || won) return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  aimFrom(e);
});
canvas.addEventListener("pointermove", (e) => { if (dragging) aimFrom(e); });
canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("pointercancel", () => { dragging = false; });

document.addEventListener("keydown", (e) => {
  if ($("canvas").closest("[data-view]").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " " && !e.target.matches?.("button, input, select, textarea, summary")) { e.preventDefault(); fire(); }
});

new ResizeObserver(() => { if (!$("canvas").closest("[data-view]").hidden) resize(); }).observe(canvas);
new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readColors(); draw(); });

renderLevels();
