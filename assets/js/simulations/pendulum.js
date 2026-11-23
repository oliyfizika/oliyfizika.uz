import { createPendulumLab } from "./mechanics-3d.js?v=20261122";
import { bindLabCamera, labStageHeight } from "./lab-3d.js?v=20261122";
// ==========================================================================
// Matematik mayatnik — simulyatsiya (simulations/pendulum.html)
// Fizika: pendulum-physics.js (RK4, aniq davr). Grafiklar: pendulum-plots.js.
// Qattiq vaznsiz sterjen: 180° gacha ishlaydi; sterjen kuchi N manfiy bo'lishi mumkin (siqilish).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { DEG, clamp, fmt, sci, createStage, createLoop, bindRange } from "./sim-kit.js";
import { TAU, H_MAX, rk4, createPeriodMeter, motionInfo, specificEnergy, specificKinetic, specificPotential, periodRatio, smallPeriod, wrapAngle } from "./pendulum-physics.js";
import { createHistory, createTimePlot, createEnergyPlot, splitHeights } from "./pendulum-plots.js";

const $ = (s) => document.querySelector(s);

/* ------------------------------------------------------------------ Holat */

const P = { L: 1, m: 1, g: 9.81, gamma: 0, driveOn: false, f: 0.1, ratio: 1 };
const init = { th: 30 * DEG, w: 0 };
const ui = { speed: 1, tab: "time", show: { forces: true, components: false, velocity: true, trail: true, lin: false, energy: true } };

let s = { th: init.th, w: init.w, t: 0 };
let lin = { ...s };
const meter = createPeriodMeter();
const hist = createHistory(3500);
const timePlot = createTimePlot(), energyPlot = createEnergyPlot();
let lastSample = -1;
let eRef = 0;                                   // energiya ustunlari masshtabi (J) — o'sib boradi

const w2 = () => P.g / P.L;
const w0 = () => Math.sqrt(w2());
const T0 = () => smallPeriod(w2());
const sim = () => ({ w2: w2(), gamma: P.gamma, f: P.driveOn ? P.f : 0, Om: P.ratio * w0(), linear: false });
const simLin = () => ({ ...sim(), linear: true });
const scaleE = () => P.m * P.L * P.L;            // J = scaleE · (energiya / I birligi)
const windowSeconds = () => clamp(4 * T0(), 3, 30);
const sampleDt = () => windowSeconds() / 700;

function sample(a, b) {
  hist.push(a.t, a.th, a.w, specificKinetic(a), specificPotential(a, w2()), b.th);
  lastSample = a.t;
}

function resetSim({ keepRunning = false } = {}) {
  s = { th: init.th, w: init.w, t: 0 };
  lin = { ...s };
  meter.reset();
  hist.clear();
  lastSample = -1;
  eRef = Math.max(scaleE() * specificEnergy(s, w2()) * 1.15, 0.12 * P.m * P.g * P.L);
  sample(s, lin);
  if (!keepRunning) loop.stop();
}

/* ------------------------------------------------------------------ 3D laboratoriya */
const scene = createPendulumLab();
function draw(ctx, stage) {
  const scale = scaleE(), K = scale * specificKinetic(s), U = scale * specificPotential(s, w2());
  eRef = Math.max(eRef, (K + U) * 1.08);
  scene.draw(ctx, stage, P, s, lin, ui.show, hist, { K, U, ref: eRef });
}

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  time: ["Burchakning vaqtga bog‘liqligi θ(t)", "Oxirgi tebranishlar; uzuq chiziq — kichik burchak modeli"],
  energy: ["Energiyaning vaqtga bog‘liqligi E(t)", "Kinetik va potensial energiya almashinuvi"],
};

function drawGraphCanvas(ctx, st) {
  if (ui.tab === "time") timePlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, showLin: ui.show.lin });
  else energyPlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, scale: scaleE(), ref: eRef * 0.9 });
}

/* ------------------------------------------------------------------ Ko'rsatkichlar */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

let lastExplain = "";

function updateUI() {
  const W2 = w2();
  const mL2 = scaleE();
  const eper = specificEnergy(s, W2);
  const E = mL2 * eper;
  const info = motionInfo(s, W2);
  const t0 = T0();
  const driven = P.driveOn;
  const mg = P.m * P.g;
  const N = P.m * (P.g * Math.cos(s.th) + P.L * s.w * s.w);
  const wr = wrapAngle(s.th);

  setReadout("th", `${fmt(wr / DEG, 1)}<small>°</small>`, `ω = ${fmt(s.w, 2)} rad/s`);
  setReadout("v", `${fmt(P.L * Math.abs(s.w), 2)}<small>m/s</small>`, `Pastda ${fmt(P.L * Math.sqrt(2 * eper), 2)} m/s gacha yetadi`);

  const mTxt = meter.mean ?? meter.period;
  setReadout("Tm", mTxt ? `${fmt(mTxt, 3)}<small>s</small>` : "—",
    meter.count ? `${meter.count} ta to‘liq tebranish bo‘yicha o‘rtacha` : mTxt ? "Birinchi o‘lchov" : s.t > 0 ? "O‘lchanmoqda…" : "Boshlang‘ich holat");

  if (driven) {
    setReadout("Tt", `${fmt((TAU / (P.ratio * w0())), 3)}<small>s</small>`, "Majburiy tebranish davri 2π/Ω");
  } else if (info.mode === "oscillation" || info.mode === "rest") {
    const pct = (info.period / t0 - 1) * 100;
    setReadout("Tt", `${fmt(info.period, 3)}<small>s</small>`, `T₀ = ${fmt(t0, 3)} s · ${pct < 0.005 ? "farq yo‘q" : `${fmt(pct, pct < 1 ? 2 : 1)}% katta`}`);
  } else if (info.mode === "rotation") {
    setReadout("Tt", `${fmt(info.period, 3)}<small>s</small>`, "To‘liq aylanish davri");
  } else {
    setReadout("Tt", "∞", "Separatrisa: yuqori nuqtaga cheksiz sekin yaqinlashadi");
  }

  setReadout("E", `${sci(E, 3)}<small>J</small>`, `K = ${sci(mL2 * specificKinetic(s), 2)} J · U = ${sci(mL2 * specificPotential(s, W2), 2)} J`);
  setReadout("N", `${fmt(N, 2)}<small>N</small>`, N < 0 ? "Manfiy: sterjen siqilmoqda" : `mg = ${fmt(mg, 2)} N ning ${fmt(N / mg, 2)} qismi`);
  document.querySelector('[data-readout="N"]').dataset.tone = N < 0 ? "orange" : "";

  const status = $("[data-status]");
  const atRest = !driven && info.mode === "rest";
  let [text, tone] = ["Tayyor", "blue"];
  if (s.t > 0 && atRest) [text, tone] = ["Muvozanatda", "green"];
  else if (loop.running) [text, tone] = info.mode === "rotation" ? ["Aylanmoqda", "orange"] : ["Tebranmoqda", "orange"];
  else if (s.t > 0) [text, tone] = ["Pauza", "purple"];
  status.textContent = text;
  status.dataset.tone = tone;

  // Tushuntirish
  const parts = [];
  const amp = info.amplitude / DEG;
  if (driven) {
    const r = P.ratio;
    const pred = P.f / Math.sqrt((W2 - (r * r * W2)) ** 2 + (P.gamma * r * w0()) ** 2);
    parts.push(`<p>Mayatnikka davriy tashqi kuch ta’sir qilmoqda: <span class="sim-math">Ω = ${fmt(r, 2)} ω₀ = ${fmt(r * w0(), 2)} rad/s</span>. Tabiiy chastota <span class="sim-math">ω₀ = ${fmt(w0(), 2)} rad/s</span>. ${Math.abs(r - 1) < 0.08 ? "<b>Rezonans!</b> Chastotalar mos kelganda amplituda eng tez o‘sadi, so‘nish esa uni cheklaydi." : r < 1 ? "Kuch chastotasi tabiiy chastotadan past — mayatnik kuchga deyarli “ergashadi”." : "Kuch chastotasi tabiiy chastotadan yuqori — mayatnik kuchga ulgurmaydi, amplituda kichik bo‘ladi."}</p>`);
    if (P.gamma > 0 && pred < 0.3) parts.push(`<p>Kichik burchaklar nazariyasi bo‘yicha turg‘un amplituda ≈ <b>${fmt((pred * 180) / Math.PI, 1)}°</b> (<span class="sim-math">f / √((ω₀² − Ω²)² + γ²Ω²)</span>). Qiymatni o‘lchangan grafik bilan solishtiring.</p>`);
  } else if (info.mode === "rotation") {
    parts.push(`<p>Boshlang‘ich energiya <span class="sim-math">2mgL</span> dan katta (<span class="sim-math">E = ${sci(E, 3)} J &gt; ${sci(2 * mg * P.L, 3)} J</span>) — mayatnik yuqori nuqtadan ham o‘tib, <b>to‘liq aylanadi</b>. Sterjen tutib turgani uchun bu mumkin; ip bo‘lganda yuqorida bo‘shashib qolishi mumkin edi.</p>`);
  } else if (info.mode === "separatrix") {
    parts.push(`<p>Energiya aynan <span class="sim-math">2mgL</span>: mayatnik yuqori nuqtaga cheksiz uzoq vaqt davomida yaqinlashadi — bu tebranish va aylanish chegarasi (separatrisa).</p>`);
  } else if (info.mode === "rest") {
    parts.push(`<p>Mayatnik muvozanat holatida (<span class="sim-math">θ = 0</span>, <span class="sim-math">ω = 0</span>). Burchakni o‘zgartiring yoki sharni torting.</p>`);
  } else if (amp <= 6) {
    parts.push(`<p>Amplituda kichik (<b>${fmt(amp, 1)}°</b>), shuning uchun <span class="sim-math">sin θ ≈ θ</span> va tebranish garmonik: <span class="sim-math">T = T₀ = 2π√(L/g) = ${fmt(t0, 3)} s</span>. Davr amplitudaga ham, massaga ham bog‘liq emas — <b>m</b> ni o‘zgartirib ko‘ring.</p>`);
  } else {
    const ratio = periodRatio(info.amplitude);
    parts.push(`<p>Amplituda <b>${fmt(amp, 0)}°</b> — endi <span class="sim-math">sin θ ≈ θ</span> yaqinlashuvi yaramaydi. Aniq davr <span class="sim-math">T = ${fmt(info.period, 3)} s</span>, kichik burchak formulasi esa <span class="sim-math">T₀ = ${fmt(t0, 3)} s</span> beradi: <b>${fmt((ratio - 1) * 100, ratio < 1.1 ? 1 : 0)}%</b> farq. “Kichik burchak modeli” ni yoqib, ikki mayatnik asta-sekin fazadan chiqib ketishini ko‘ring.</p>`);
  }
  if (P.gamma > 0) {
    const tau = 2 / P.gamma, Q = w0() / P.gamma;
    parts.push(`<p>Ishqalanish (<span class="sim-math">γ = ${fmt(P.gamma, 2)} s⁻¹</span>) energiyani sarflaydi: amplituda har <b>${fmt(tau, 1)} s</b> da e ≈ 2,72 marta kamayadi. ${P.gamma >= 2 * w0() ? "γ ≥ 2ω₀ — harakat tebranmasdan so‘nadi (aperiodik)." : `Sifat omili <span class="sim-math">Q = ω₀/γ = ${fmt(Q, 1)}</span>.`}</p>`);
  }
  if (Math.abs(P.g - 9.81) > 0.01) parts.push(`<p>Bu sayyorada <span class="sim-math">g = ${fmt(P.g, 2)} m/s²</span>, shuning uchun davr Yerdagidan <b>${fmt(Math.sqrt(9.81 / P.g), 2)}</b> marta ${P.g < 9.81 ? "uzun" : "qisqa"}.</p>`);
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }

  stage.canvas.setAttribute("aria-label", `Matematik mayatnik: L = ${fmt(P.L, 2)} m, m = ${fmt(P.m, 1)} kg, g = ${fmt(P.g, 2)} m/s². Hozirgi burchak ${fmt(wr / DEG, 1)}°, davr ${info.period && isFinite(info.period) ? fmt(info.period, 3) + " s" : "aniqlanmagan"}.`);
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
  const p = sim(), pl = simLin();
  const n = Math.max(1, Math.ceil(dt / H_MAX - 1e-9));
  const h = dt / n;
  const sd = sampleDt();
  for (let i = 0; i < n; i++) {
    const nx = rk4(s, p, h), nl = rk4(lin, pl, h);
    meter.feed(s, nx);
    s = nx; lin = nl;
    if (s.t - lastSample >= sd) sample(s, lin);
  }
}

const loop = createLoop((dt) => {
  physicsStep(dt * ui.speed);
  if (!P.driveOn && motionInfo(s, w2()).mode === "rest" && Math.abs(s.th) < 1e-3 && Math.abs(s.w) < 2e-3) { loop.stop(); }
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
  const info = motionInfo(s, w2());
  if (!P.driveOn && info.mode === "rest" && s.t > 0) resetSim(); // muvozanatda qolgan — boshidan
  loop.start();
});
$("[data-reset]").addEventListener("click", () => { afterChange({ keepRunning: false }); });
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));

/* Slayderlar */
const th0Ctl = bindRange($("#th0"), $("#th0Out"), (v) => `${fmt(v, 0)}°`, (v) => { init.th = v * DEG; afterChange(); });
const w0Ctl = bindRange($("#w0"), $("#w0Out"), (v) => `${fmt(v, 1)} rad/s`, (v) => { init.w = v; afterChange(); });
const LCtl = bindRange($("#L"), $("#LOut"), (v) => `${fmt(v, 2)} m`, (v) => { P.L = v; afterChange(); });
const mCtl = bindRange($("#m"), $("#mOut"), (v) => `${fmt(v, 1)} kg`, (v) => { P.m = v; renderAll(); updateUI(); });
const gammaCtl = bindRange($("#gamma"), $("#gammaOut"), (v) => (v === 0 ? "yo‘q" : `${fmt(v, 2)} s⁻¹`), (v) => { P.gamma = v; renderAll(); updateUI(); });
const fCtl = bindRange($("#driveF"), $("#driveFOut"), (v) => `${fmt(v, 2)} rad/s²`, (v) => { P.f = v; updateUI(); });
const rCtl = bindRange($("#driveR"), $("#driveROut"), (v) => `${fmt(v, 2)} ω₀`, (v) => { P.ratio = v; updateUI(); });
const planet = $("#planet"), gOut = $("#gOut");
const syncG = () => { gOut.textContent = `${fmt(P.g, 2)} m/s²`; planet.value = String(P.g); };
planet.addEventListener("change", () => { P.g = Number(planet.value); syncG(); afterChange(); });

function setDrive(on) {
  P.driveOn = on;
  document.querySelector('[data-toggle="drive"]').checked = on;
  document.querySelectorAll("[data-drive-panel]").forEach((el) => { el.hidden = !on; });
}

/* Tayyor holatlar */
const PRESETS = {
  small:     { th: 5,   w: 0, L: 1,     g: 9.81, gamma: 0,    drive: false },
  large:     { th: 120, w: 0, L: 1,     g: 9.81, gamma: 0,    drive: false },
  seconds:   { th: 5,   w: 0, L: 0.994, g: 9.81, gamma: 0,    drive: false },   // T = 2 s  (L = g/π²)
  moon:      { th: 30,  w: 0, L: 1,     g: 1.62, gamma: 0,    drive: false },
  spin:      { th: 0,   w: 7, L: 1,     g: 9.81, gamma: 0,    drive: false },
  damped:    { th: 60,  w: 0, L: 1,     g: 9.81, gamma: 0.35, drive: false },
  resonance: { th: 0,   w: 0, L: 1,     g: 9.81, gamma: 0.15, drive: true, f: 0.1, ratio: 1 },
};
function applyPreset(key) {
  const q = PRESETS[key];
  init.th = q.th * DEG; init.w = q.w;
  P.L = q.L; P.g = q.g; P.gamma = q.gamma;
  th0Ctl.set(q.th); w0Ctl.set(q.w); LCtl.set(q.L); gammaCtl.set(q.gamma); syncG();
  setDrive(q.drive);
  if (q.drive) { P.f = q.f; P.ratio = q.ratio; fCtl.set(q.f); rCtl.set(q.ratio); }
  resetSim();
  lastPreset = key;
  markPreset(key);
  renderAll();
  updateUI();
  loop.start();
}
let lastPreset = null;
// Tanlangan preset tugmasi belgilanadi; parametr qo'lda o'zgartirilsa belgi olinadi
const markPreset = (key) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === key)));
markPreset(null);
document.querySelector(".sim-panel")?.addEventListener("input", () => markPreset(null));
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  const k = cb.dataset.toggle;
  if (k === "drive") { setDrive(cb.checked); updateUI(); return; }
  ui.show[k] = cb.checked;
  renderAll();
}));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = Number(b.dataset.speedValue);
  document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));

/* Grafik turlari */
function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab-value]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tabValue === tab)));
  $("[data-graph-title]").textContent = TABS[tab][0];
  $("[data-graph-sub]").textContent = TABS[tab][1];
  graph.canvas.setAttribute("aria-label", TABS[tab][0]);
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* 3D kamera va sharni tebranish tekisligida surish. */
bindLabCamera(canvas, scene.lab, renderAll, {
  start() { loop.stop(); },
  move(id, p) {
    init.th = scene.angle(p.x, p.y); init.w = 0;
    th0Ctl.set(Math.round(init.th / DEG)); w0Ctl.set(0);
    markPreset(null); resetSim(); renderAll(); updateUI();
  },
  end(id, cancelled) { if (!cancelled) loop.start(); },
});

/* Boshlash */
syncG();
resetSim();
setTab("time");
updateUI();
renderAll();
const q = new URLSearchParams(location.search).get("preset"); // katalogdagi darslik havolalari
if (PRESETS[q]) applyPreset(q);
document.fonts?.ready.then(renderAll);
