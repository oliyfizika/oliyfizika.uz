import { createPhysicalPendulumLab } from "./next-labs-3d.js?v=20261122-batch3";
import { bindLabCamera, labStageHeight } from "./lab-3d.js?v=20261122";
// ==========================================================================
// Fizik (murakkab) mayatnik — simulyatsiya (simulations/physical-pendulum.html)
// Fizika: pendulum-physics.js (RK4, aniq davr) + physical-pendulum-physics.js (jism shakllari, I, L_red, Keyter).
// Harakat tenglamasi: I θ″ = −m g d sin θ − I γ θ′  ⇒  ω₀² = m g d / I.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { DEG, clamp, fmt, sci, createStage, createLoop, tag, bindRange } from "./sim-kit.js";
import { TAU, H_MAX, rk4, createPeriodMeter, motionInfo, specificEnergy, specificKinetic, specificPotential, periodRatio, wrapAngle } from "./pendulum-physics.js";
import { SHAPES, gyr2, omega2, periodSmall, reducedLength, conjugateDistance, minPeriod, pivotReaction } from "./physical-pendulum-physics.js";
import { createHistory, createTimePlot, createEnergyPlot, frame, ticks, splitHeights } from "./pendulum-plots.js";

const $ = (s) => document.querySelector(s);

/* ------------------------------------------------------------------ Holat */

const P = { shape: "rod", S: 1, d: 0.5, m: 1, g: 9.81, gamma: 0 };
const init = { th: 30 * DEG, w: 0 };
const ui = { speed: 1, tab: "td", show: { forces: true, velocity: false, center: true, ghost: false } };
const SIZE_DEFAULT = { rod: 1, plate: 1, disk: 0.6, ring: 0.6, ball: 0.2 };
const SIZE_LABEL = { rod: "Uzunlik ℓ", plate: "Balandlik a (kengligi a/2)", disk: "Diametr 2R", ring: "Diametr 2R", ball: "Shar diametri 2R" };

let s = { th: init.th, w: init.w, t: 0 };
let ghost = { ...s };
const meter = createPeriodMeter();
const hist = createHistory(3500);
const timePlot = createTimePlot(), energyPlot = createEnergyPlot();
let lastSample = -1;

const shapeInfo = () => SHAPES[P.shape];
const K2 = () => gyr2(P.shape, P.S);
const Ic = () => P.m * (K2() + P.d * P.d);                 // I (osish nuqtasi atrofida)
const W2 = () => omega2(K2(), P.d, P.g);
const W0 = () => Math.sqrt(W2());
const Lred = () => reducedLength(K2(), P.d);
const T0 = () => periodSmall(K2(), P.d, P.g);
const sim = () => ({ w2: W2(), gamma: P.gamma, f: 0, Om: 0, linear: false });
const simGhost = () => ({ ...sim(), w2: P.g / P.d });
const windowSeconds = () => clamp(4 * T0(), 3, 30);
const sampleDt = () => windowSeconds() / 700;
const alphaOf = (st) => -W2() * Math.sin(st.th) - P.gamma * st.w;

function sample(a, b) {
  hist.push(a.t, a.th, a.w, specificKinetic(a), specificPotential(a, W2()), b.th);
  lastSample = a.t;
}

function resetSim({ keepRunning = false } = {}) {
  s = { th: init.th, w: init.w, t: 0 };
  ghost = { ...s };
  meter.reset();
  hist.clear();
  lastSample = -1;
  sample(s, ghost);
  if (!keepRunning) loop.stop();
}

/* ------------------------------------------------------------------ 3D laboratoriya */
const scene = createPhysicalPendulumLab();
function draw(ctx, stage) { scene.draw(ctx, stage, P, s, ghost, ui.show); }

/* ------------------------------------------------------------------ T(d) grafigi */

let lastTd = null;

function drawTd(ctx, st) {
  const c = st.colors;
  const sh = shapeInfo();
  const dMin = sh.dMin(P.S), dMax = sh.dMax(P.S);
  const k2 = K2(), kk = Math.sqrt(k2);
  const T = (d) => periodSmall(k2, d, P.g);
  const Tpt = (d) => TAU * Math.sqrt(d / P.g);
  const kIn = kk >= dMin && kk <= dMax;
  const yLo = kIn ? minPeriod(k2, P.g) : Math.min(T(dMin), T(dMax));
  const yHi = Math.min(Math.max(T(dMin), T(dMax)), yLo * 2.3);
  const yMin = Math.max(0, Math.floor((yLo * 0.85) * 10) / 10);
  const yMax = yHi * 1.06;
  const xt = ticks(dMin, dMax, st.w < 480 ? 3 : 5), yt = ticks(yMin, yMax, st.h < 260 ? 3 : 4);
  const f = frame(st.ctx, st, {
    xMin: dMin, xMax: dMax, yMin, yMax, xTicks: xt.values, yTicks: yt.values,
    fmtX: (x) => fmt(x, xt.step < 0.1 ? 2 : 1), fmtY: (y) => fmt(y, yt.step < 1 ? (yt.step < 0.1 ? 2 : 1) : 0), yLabel: "T, s", xUnit: "m", padL: st.w < 480 ? 46 : 54,
  });
  lastTd = { f, dMin, dMax };
  ctx.save();
  ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  const curve = (fn, color, width, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= 220; i++) {
      const d = dMin + ((dMax - dMin) * i) / 220;
      const x = f.X(d), y = f.Y(fn(d));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  curve(Tpt, c.text3, 2, [6, 5]);
  curve(T, c.primary, 3);
  ctx.restore();

  // Belgilar
  const dConj = conjugateDistance(k2, P.d);
  const Tcur = T(P.d);
  const guide = (x, y, col) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, f.rect.y + f.rect.h); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
  };
  if (dConj >= dMin && dConj <= dMax && Math.abs(dConj - P.d) > (dMax - dMin) * 0.01) {
    ctx.save();
    ctx.strokeStyle = c.special; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(f.X(P.d), f.Y(Tcur)); ctx.lineTo(f.X(dConj), f.Y(Tcur)); ctx.stroke();
    ctx.setLineDash([]);
    guide(f.X(dConj), f.Y(Tcur), c.special);
    ctx.fillStyle = c.bg; ctx.strokeStyle = c.special; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(f.X(dConj), f.Y(Tcur), 6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
    tag(ctx, `d′ = ${fmt(dConj, 3)} m`, f.X(dConj), f.Y(Tcur) - 17, { color: c.special, bg: c.bg, align: "center", font: "600 11px Inter, system-ui, sans-serif" });
  }
  if (kIn) {
    const Tm = minPeriod(k2, P.g);
    ctx.fillStyle = c.success;
    ctx.beginPath(); ctx.arc(f.X(kk), f.Y(Tm), 5, 0, TAU); ctx.fill();
    tag(ctx, `T_min = ${fmt(Tm, 3)} s (d = k)`, clamp(f.X(kk), f.rect.x + 70, f.rect.x + f.rect.w - 70), f.Y(Tm) + 19, { color: c.success, bg: c.bg, align: "center", font: "600 11px Inter, system-ui, sans-serif" });
  }
  guide(f.X(P.d), f.Y(Tcur), c.text3);
  ctx.fillStyle = c.warning;
  ctx.beginPath(); ctx.arc(f.X(P.d), f.Y(Math.min(Tcur, yMax)), 6, 0, TAU); ctx.fill();

  // Afsona
  ctx.save();
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  const items = [[c.primary, "Fizik mayatnik", []], [c.text3, "Nuqtaviy massa (L = d)", [5, 4]]];
  let lx = f.padL + 10;
  items.forEach(([col, label, dash]) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(lx, f.padT + 14); ctx.lineTo(lx + 16, f.padT + 14); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(label, lx + 21, f.padT + 14.5);
    lx += 21 + ctx.measureText(label).width + 14;
  });
  ctx.restore();
}

const TABS = {
  td: ["Davrning osish nuqtasiga bog‘liqligi T(d)", "Grafikni bosib d ni tanlang · ko‘k nuqta — hozirgi, binafsha — Keyter nuqtasi"],
  time: ["Burchakning vaqtga bog‘liqligi θ(t)", "Oxirgi tebranishlar; uzuq chiziq — massa markazida to‘plangan nuqta (L = d)"],
  energy: ["Energiyaning vaqtga bog‘liqligi E(t)", "Kinetik va potensial energiya almashinuvi"],
};

function drawGraphCanvas(ctx, st) {
  const win = windowSeconds();
  if (ui.tab === "td") drawTd(ctx, Object.assign(st, { ctx }));
  else if (ui.tab === "time") timePlot.draw(ctx, st, hist, { win, tNow: s.t, showLin: ui.show.ghost, linLabel: "Nuqtaviy massa (L = d)", mainLabel: "Fizik mayatnik" });
  else energyPlot.draw(ctx, st, hist, { win, tNow: s.t, scale: Ic(), ref: Math.max(Ic() * specificEnergy(init, W2()) * 1.2, 0.1 * P.m * P.g * P.d) });
}

/* ------------------------------------------------------------------ Ko'rsatkichlar */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

let lastExplain = "";

function updateUI() {
  const w2 = W2(), k2 = K2(), kk = Math.sqrt(k2), I = Ic();
  const eper = specificEnergy(s, w2);
  const info = motionInfo(s, w2);
  const t0 = T0();
  const mgd = P.m * P.g * P.d;
  const alpha = alphaOf(s);
  const M = -mgd * Math.sin(s.th);
  const R = pivotReaction({ m: P.m, d: P.d, g: P.g }, s.th, s.w, alpha);
  const dConj = conjugateDistance(k2, P.d);
  const lr = Lred();

  setReadout("th", `${fmt(wrapAngle(s.th) / DEG, 1)}<small>°</small>`, `ω = ${fmt(s.w, 2)} rad/s`);
  setReadout("I", `${sci(I, 3)}<small>kg·m²</small>`, `I_cm = ${sci(P.m * k2, 2)} + md² = ${sci(P.m * P.d * P.d, 2)}`);
  setReadout("L", `${fmt(lr, 3)}<small>m</small>`, `k = ${fmt(kk, 3)} m · d′ = k²/d = ${fmt(dConj, 3)} m`);
  const mTxt = meter.mean ?? meter.period;
  setReadout("Tm", mTxt ? `${fmt(mTxt, 3)}<small>s</small>` : "—",
    meter.count ? `${meter.count} ta to‘liq tebranish bo‘yicha o‘rtacha` : mTxt ? "Birinchi o‘lchov" : s.t > 0 ? "O‘lchanmoqda…" : "Boshlang‘ich holat");
  if (info.mode === "oscillation" || info.mode === "rest") {
    const pct = (info.period / t0 - 1) * 100;
    setReadout("Tt", `${fmt(info.period, 3)}<small>s</small>`, `T₀ = ${fmt(t0, 3)} s · ${pct < 0.005 ? "farq yo‘q" : `${fmt(pct, pct < 1 ? 2 : 1)}% katta`}`);
  } else if (info.mode === "rotation") {
    setReadout("Tt", `${fmt(info.period, 3)}<small>s</small>`, "To‘liq aylanish davri");
  } else setReadout("Tt", "∞", "Separatrisa");
  setReadout("E", `${sci(I * eper, 3)}<small>J</small>`, `K = ${sci(I * specificKinetic(s), 2)} J · U = ${sci(I * specificPotential(s, w2), 2)} J`);
  setReadout("M", `${fmt(M, 2)}<small>N·m</small>`, `Eng katta qiymat mgd = ${fmt(mgd, 2)} N·m`);
  setReadout("a", `${fmt(alpha, 2)}<small>rad/s²</small>`, "ε = M / I");
  setReadout("R", `${fmt(Math.hypot(R.x, R.y), 2)}<small>N</small>`, `Rₓ = ${fmt(R.x, 2)} N · Ry = ${fmt(R.y, 2)} N (mg = ${fmt(P.m * P.g, 2)})`);

  const status = $("[data-status]");
  let [text, tone] = ["Tayyor", "blue"];
  if (s.t > 0 && info.mode === "rest") [text, tone] = ["Muvozanatda", "green"];
  else if (loop.running) [text, tone] = info.mode === "rotation" ? ["Aylanmoqda", "orange"] : ["Tebranmoqda", "orange"];
  else if (s.t > 0) [text, tone] = ["Pauza", "purple"];
  status.textContent = text;
  status.dataset.tone = tone;

  // Tushuntirish
  const parts = [];
  const sh = shapeInfo();
  parts.push(`<p><b>${sh.name}</b>: ${sh.note}. Shuning uchun <span class="sim-math">k² = ${fmt(k2, 4)} m²</span> (<span class="sim-math">k = ${fmt(kk, 3)} m</span>). Shteyner teoremasi: <span class="sim-math">I = m(k² + d²) = ${sci(I, 3)} kg·m²</span>.</p>`);
  const ratioT = lr / P.d;
  if (Math.abs(P.d - kk) / kk < 0.04 && P.shape !== "ball") {
    parts.push(`<p><b>d ≈ k</b>: davr eng kichik qiymatga erishgan — <span class="sim-math">T<sub>min</sub> = 2π√(2k/g) = ${fmt(minPeriod(k2, P.g), 3)} s</span>. d ni ikkala tomonga o‘zgartirsangiz ham davr ortadi: pastga siljisangiz tiklovchi moment <span class="sim-math">mgd</span> kamayadi, yuqoriga siljisangiz <span class="sim-math">md²</span> hisobiga inersiya ortadi.</p>`);
  } else if (P.d < kk) {
    parts.push(`<p><b>d &lt; k</b>: osish nuqtasi massa markaziga yaqin, tiklovchi moment <span class="sim-math">mgd</span> kichik, inersiya esa asosan <span class="sim-math">mk²</span> — davr katta (<span class="sim-math">T₀ = ${fmt(t0, 3)} s</span>). d → 0 da davr cheksizga intiladi.</p>`);
  } else {
    parts.push(`<p><b>d &gt; k</b>: inersiya momentida <span class="sim-math">md²</span> hissasi ustun (${fmt((100 * P.d * P.d) / (k2 + P.d * P.d), 0)}%), shuning uchun jism nuqtaviy massaga yaqinlashadi: <span class="sim-math">L<sub>red</sub> = ${fmt(lr, 3)} m</span> — <span class="sim-math">d = ${fmt(P.d, 3)} m</span> dan <b>${fmt((ratioT - 1) * 100, ratioT < 1.1 ? 2 : 1)}%</b> katta. d ortgan sari <span class="sim-math">L<sub>red</sub> → d</span>.</p>`);
  }
  parts.push(`<p>Davr xuddi uzunligi <span class="sim-math">L<sub>red</sub> = ${fmt(lr, 3)} m</span> bo‘lgan matematik mayatnikniki kabi. Osish nuqtasidan shu masofadagi <b>O′</b> nuqta (tebranish markazi) bunday mayatnik sharchasi kabi harakat qiladi; unga zarba berilsa, o‘qda reaksiya kuchi paydo bo‘lmaydi (zarba markazi).</p>`);
  if (dConj >= shapeInfo().dMin(P.S) && dConj <= shapeInfo().dMax(P.S) && Math.abs(dConj - P.d) > 1e-3) {
    parts.push(`<p><b>Keyter teoremasi</b>: jismni O′ dan osib (<span class="sim-math">d′ = k²/d = ${fmt(dConj, 3)} m</span>) tebrantirsangiz, davr aynan o‘sha (<span class="sim-math">${fmt(t0, 3)} s</span>) bo‘ladi. “O ↔ O′” tugmasini bosib tekshiring — bu usul bilan g ni juda aniq o‘lchash mumkin.</p>`);
  }
  if (ui.show.ghost) {
    const Tp = TAU * Math.sqrt(P.d / P.g);
    parts.push(`<p>Barcha massa C nuqtada to‘plangan bo‘lsa (<span class="sim-math">L = d</span>), davr <span class="sim-math">${fmt(Tp, 3)} s</span> bo‘lardi — haqiqiy jismnikidan <b>${fmt((t0 / Tp - 1) * 100, 1)}%</b> qisqa. Farq jism o‘lchamining (<span class="sim-math">k²/d²</span>) natijasi: <span class="sim-math">T/T<sub>nuqta</sub> = √(1 + k²/d²) = ${fmt(Math.sqrt(1 + k2 / (P.d * P.d)), 3)}</span>.</p>`);
  }
  if (info.mode === "oscillation" && info.amplitude / DEG > 8) parts.push(`<p>Amplituda ${fmt(info.amplitude / DEG, 0)}° — kichik burchak formulasi yaramaydi: aniq davr <span class="sim-math">${fmt(info.period, 3)} s</span> (${fmt((periodRatio(info.amplitude) - 1) * 100, 1)}% katta).</p>`);
  if (P.gamma > 0) parts.push(`<p>Ishqalanish tufayli amplituda har <b>${fmt(2 / P.gamma, 1)} s</b> da e marta kamayadi.</p>`);
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }

  stage.canvas.setAttribute("aria-label", `Fizik mayatnik: ${sh.name}, d = ${fmt(P.d, 3)} m, davr ${fmt(t0, 3)} s, keltirilgan uzunlik ${fmt(lr, 3)} m.`);
  setPlayButton();
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { height: labStageHeight });
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => splitHeights(w).graph });
const canvas = stage.canvas;
const playBtn = $("[data-play]");

function renderAll() { stage.render(); graph.render(); }

function setPlayButton() {
  const running = loop.running;
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : s.t > 0 ? "Davom ettirish" : "Boshlash";
}

function physicsStep(dt) {
  const p = sim(), pg = simGhost();
  const n = Math.max(1, Math.ceil(dt / H_MAX - 1e-9));
  const h = dt / n, sd = sampleDt();
  for (let i = 0; i < n; i++) {
    const nx = rk4(s, p, h), ng = rk4(ghost, pg, h);
    meter.feed(s, nx);
    s = nx; ghost = ng;
    if (s.t - lastSample >= sd) sample(s, ghost);
  }
}

const loop = createLoop((dt) => {
  physicsStep(dt * ui.speed);
  if (motionInfo(s, W2()).mode === "rest" && Math.abs(s.th) < 1e-3 && Math.abs(s.w) < 2e-3) loop.stop();
  renderAll();
  updateUI();
}, { onStateChange: () => { setPlayButton(); updateUI(); } });

function afterChange({ keepRunning = true } = {}) {
  resetSim({ keepRunning: keepRunning && loop.running });
  renderAll();
  updateUI();
}

playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (s.t > 0 && motionInfo(s, W2()).mode === "rest") resetSim();
  loop.start();
});
$("[data-reset]").addEventListener("click", () => afterChange({ keepRunning: false }));
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));

/* Slayderlar */
const sizeIn = $("#size"), distIn = $("#dist");
const sizeCtl = bindRange(sizeIn, $("#sizeOut"), (v) => `${fmt(v, 2)} m`, (v) => {
  const sh = shapeInfo();
  const frac = P.shape === "ball" ? null : (P.d - sh.dMin(P.S)) / (sh.dMax(P.S) - sh.dMin(P.S));
  const stringLen = P.d - P.S / 2;
  P.S = v;
  P.d = P.shape === "ball" ? clamp(stringLen + P.S / 2, sh.dMin(P.S), sh.dMax(P.S)) : sh.dMin(P.S) + frac * (sh.dMax(P.S) - sh.dMin(P.S));
  syncDistRange();
  afterChange();
});
const distCtl = bindRange(distIn, $("#distOut"), (v) => `${fmt(v, 3)} m`, (v) => { P.d = v; afterChange(); });
const mCtl = bindRange($("#m"), $("#mOut"), (v) => `${fmt(v, 1)} kg`, (v) => { P.m = v; renderAll(); updateUI(); });
const th0Ctl = bindRange($("#th0"), $("#th0Out"), (v) => `${fmt(v, 0)}°`, (v) => { init.th = v * DEG; init.w = 0; afterChange(); });
const gammaCtl = bindRange($("#gamma"), $("#gammaOut"), (v) => (v === 0 ? "yo‘q" : `${fmt(v, 2)} s⁻¹`), (v) => { P.gamma = v; renderAll(); updateUI(); });
const planet = $("#planet"), gOut = $("#gOut");
const syncG = () => { gOut.textContent = `${fmt(P.g, 2)} m/s²`; planet.value = String(P.g); };
planet.addEventListener("change", () => { P.g = Number(planet.value); syncG(); afterChange(); });

function syncDistRange() {
  const sh = shapeInfo();
  distIn.min = String(sh.dMin(P.S)); distIn.max = String(sh.dMax(P.S));
  distIn.step = "0.005";
  P.d = clamp(Math.round(P.d * 1000) / 1000, sh.dMin(P.S), sh.dMax(P.S));
  distIn.value = String(P.d);
  distCtl.sync();
}

function applyShape(shape, { S = SIZE_DEFAULT[shape], d } = {}) {
  P.shape = shape;
  P.S = S;
  $("#shape").value = shape;
  $("[data-size-label]").textContent = SIZE_LABEL[shape];
  sizeIn.min = shape === "ball" ? "0.05" : "0.1";
  sizeIn.max = shape === "ball" ? "0.6" : "2";
  sizeCtl.set(S);
  const sh = shapeInfo();
  P.d = d ?? sh.dDefault(S);
  syncDistRange();
  $("[data-swap]").disabled = false;
}

$("#shape").addEventListener("change", (e) => { applyShape(e.target.value); afterChange({ keepRunning: false }); });
$("[data-set-dk]").addEventListener("click", () => {
  const sh = shapeInfo();
  P.d = clamp(Math.sqrt(K2()), sh.dMin(P.S), sh.dMax(P.S));
  syncDistRange(); afterChange();
});
$("[data-swap]").addEventListener("click", () => {
  const sh = shapeInfo();
  const dc = conjugateDistance(K2(), P.d);
  if (dc < sh.dMin(P.S) - 1e-9 || dc > sh.dMax(P.S) + 1e-9) {
    const b = $("[data-swap]");
    b.textContent = "O′ jism ichida emas";
    setTimeout(() => { b.textContent = "O ↔ O′ (Keyter)"; }, 1600);
    return;
  }
  P.d = dc;
  syncDistRange(); afterChange();
});

/* Tayyor holatlar */
const PRESETS = {
  ruler:  { shape: "rod",  S: 1,    d: () => 0.5, tab: "td" },
  rodMin: { shape: "rod",  S: 1,    d: () => Math.sqrt(gyr2("rod", 1)), tab: "td" },
  kater:  { shape: "rod",  S: 1,    d: () => 0.2, tab: "td" },
  disk:   { shape: "disk", S: 0.5,  d: () => 0.25 },
  ring:   { shape: "ring", S: 0.5,  d: () => 0.25 },
  ball:   { shape: "ball", S: 0.3,  d: () => 1.15, ghost: false },
};
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
  const q = PRESETS[b.dataset.preset];
  init.th = 30 * DEG; init.w = 0; th0Ctl.set(30);
  P.gamma = 0; gammaCtl.set(0); P.g = 9.81; syncG();
  applyShape(q.shape, { S: q.S, d: q.d() });
  if (q.tab) setTab(q.tab);
  if (q.ghost !== undefined) setToggle("ghost", q.ghost);
  afterChange({ keepRunning: false });
  loop.start();
}));

function setToggle(k, on) {
  ui.show[k] = on;
  const cb = document.querySelector(`[data-toggle="${k}"]`);
  if (cb) cb.checked = on;
}
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; renderAll(); updateUI(); }));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = Number(b.dataset.speedValue);
  document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));

/* Grafik turlari va grafikdagi bosish */
function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab-value]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tabValue === tab)));
  $("[data-graph-title]").textContent = TABS[tab][0];
  $("[data-graph-sub]").textContent = TABS[tab][1];
  graph.canvas.dataset.clickable = String(tab === "td");
  graph.canvas.setAttribute("aria-label", TABS[tab][0]);
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

graph.canvas.addEventListener("pointerdown", (e) => {
  const r = graph.canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  if (ui.tab === "td" && lastTd) {
    const { f, dMin, dMax } = lastTd;
    if (px < f.rect.x || px > f.rect.x + f.rect.w) return;
    P.d = clamp(Math.round((dMin + ((px - f.rect.x) / f.rect.w) * (dMax - dMin)) * 200) / 200, dMin, dMax);
    syncDistRange(); afterChange();
  }
});

/* 3D kameradan mustaqil ravishda jismning o‘z nuqtasini sudrash. */
bindLabCamera(canvas, scene.lab, renderAll, {
  start() { loop.stop(); },
  move(id, pointer) {
    const angle = scene.angle(id, pointer.x, pointer.y);
    if (angle === null) return;
    init.th = angle; init.w = 0;
    th0Ctl.set(Math.round(init.th / DEG));
    resetSim(); renderAll(); updateUI();
  },
  end(id, cancelled) { if (!cancelled) loop.start(); },
});

/* Boshlash */
syncG();
applyShape("rod");
resetSim();
setTab("td");
updateUI();
renderAll();
document.fonts?.ready.then(renderAll);
