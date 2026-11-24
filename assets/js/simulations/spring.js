// ==========================================================================
// Prujinali mayatnik — simulyatsiya (simulations/spring.html)
// Fizika: spring-physics.js (RK4, aniq yechim bilan tekshirilgan). Grafiklar: spring-plots.js, pendulum-plots.js.
// Gorizontal ↔ vertikal: x muvozanatdan o'lchanadi, rejimni almashtirganda (x, v) saqlanadi —
// vertikalda og'irlik faqat muvozanatni Δl = mg/k ga siljitadi, davr o'zgarmaydi.
// ==========================================================================

import { createSpringLab } from "./spring-3d.js";
import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, bindRange } from "./sim-kit.js";
import {
  TAU, effectiveK, jointShare, omega0, period0, regime, steadyAmplitude, amplitudeOf,
  kinetic, elastic, dynParams, advance, createPeriodMeter,
} from "./spring-physics.js";
import { createHistory, createEnergyPlot, splitHeights } from "./pendulum-plots.js";
import { createXPlot, drawHooke, drawPeriodVsMass, periodMassFromPointer } from "./spring-plots.js";

const $ = (s) => document.querySelector(s);
const X_LIMIT = 0.45;      // masshtab chegarasi (m)

/* ------------------------------------------------------------------ Holat */

const P = { mode: "vertical", link: "single", k1: 25, k2: 60, m: 1, b: 0, g: 9.81, driveOn: false, F: 0.8, ratio: 1 };
const init = { x: 0.12, v: 0 };
const ui = { speed: 1, tab: "x", show: { forces: true, net: false, velocity: true, marks: true, energy: true, vcurve: true } };

let s = { x: init.x, v: init.v, t: 0 };
const meter = createPeriodMeter();
const hist = createHistory(3500);
const xPlot = createXPlot(), energyPlot = createEnergyPlot();
let lastSample = -1;
let eRef = 0;                  // energiya ustunlari masshtabi (J)
let Aview = 0.2;               // ko'rinadigan amplituda (m) — masshtab shundan olinadi
let flag = null;               // null | "rest" | "limit"

const k = () => effectiveK(P.link, P.k1, P.k2);
const w0 = () => omega0(k(), P.m);
const T0 = () => period0(k(), P.m);
const Om = () => P.ratio * w0();
const dlStatic = () => (P.m * P.g) / k();
const windowSeconds = () => clamp(4 * T0(), 3, 30);
const sampleDt = () => windowSeconds() / 700;
const params = () => dynParams({ m: P.m, k: k(), b: P.b, f: P.driveOn ? P.F : 0, Om: Om() });
const drivePush = (t) => (P.driveOn ? P.F * Math.cos(Om() * t) : 0);
const E_of = (st) => kinetic(st.v, P.m) + elastic(st.x, k());

function updateAview() {
  let ref = amplitudeOf(init.x, init.v, w0());
  if (P.driveOn) {
    const A = steadyAmplitude(k(), P.m, P.b, P.F, Om());
    ref += Number.isFinite(A) ? A : X_LIMIT;
  }
  Aview = clamp(1.15 * ref, 0.15, X_LIMIT);
}

function sample(a) {
  hist.push(a.t, a.x, a.v, kinetic(a.v, P.m), elastic(a.x, k()), null);
  lastSample = a.t;
}

function resetSim({ keepRunning = false } = {}) {
  s = { x: init.x, v: init.v, t: 0 };
  meter.reset();
  hist.clear();
  lastSample = -1;
  flag = null;
  updateAview();
  eRef = Math.max(E_of(s) * 1.15, 0.5 * k() * 0.05 * 0.05);
  sample(s);
  if (!keepRunning) loop.stop();
}

/* ------------------------------------------------------------------ 3D laboratoriya */
const lab = createSpringLab();
function draw(ctx, stage) {
  eRef = Math.max(eRef, E_of(s) * 1.08);
  lab.draw(ctx, stage, P, s, ui.show, { K: kinetic(s.v, P.m), U: elastic(s.x, k()), ref: eRef });
}

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  x: ["Siljishning vaqtga bog‘liqligi x(t)", "Yuk muvozanat atrofida garmonik tebranadi; uzuq chiziq — tezlik v/ω₀ (x bilan 90° farq)"],
  energy: ["Energiyaning vaqtga bog‘liqligi E(t)", "Kinetik va elastik potensial energiya almashinuvi; to‘liq energiya ishqalanishsiz o‘zgarmaydi"],
  hooke: ["Guk qonuni F(x)", "F = −kx: qiyalik qattiqlik k; yuza — saqlangan potensial energiya ½kx²"],
  period: ["Davrning massaga bog‘liqligi T(m)", "Bosib massani tanlang · T ∝ √m, qattiqroq prujinada davr qisqa"],
};

function envelope() {
  const R = regime(k(), P.m, P.b);
  if (P.driveOn || R.type !== "under") return null;
  const B = (init.v + (R.gamma / 2) * init.x) / R.wd;
  return { A0: Math.hypot(init.x, B), gamma: R.gamma };
}

function drawGraphCanvas(ctx, st) {
  if (ui.tab === "x") xPlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, w0: w0(), envelope: envelope(), showV: ui.show.vcurve });
  else if (ui.tab === "energy") energyPlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, scale: 1, ref: eRef * 0.9 });
  else if (ui.tab === "hooke") drawHooke(ctx, st, { k: k(), xView: Aview, x: s.x, F: -k() * s.x });
  else drawPeriodVsMass(ctx, st, { k: k(), m: P.m, mMin: 0.1, mMax: 3 });
}

/* ------------------------------------------------------------------ Ko'rsatkichlar */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

let lastExplain = "";
const sq = (x) => `<span class="sim-math">${x}</span>`;

function updateUI() {
  const kk = k(), m = P.m, W0 = w0(), t0 = T0();
  const R = regime(kk, m, P.b);
  const vert = P.mode === "vertical";
  const dl = dlStatic();
  const acc = (-kk * s.x - P.b * s.v + drivePush(s.t)) / m;
  const A = amplitudeOf(s.x, s.v, W0);
  const K = kinetic(s.v, m), U = elastic(s.x, kk);

  setReadout("x", `${fmt(s.x * 100, 1)}<small>sm</small>`, `v = ${fmt(s.v, 2)} m/s`);
  setReadout("a", `${fmt(acc, 2)}<small>m/s²</small>`, P.driveOn || P.b > 0 ? "a = (−kx − bv + F)/m" : `a = −ω₀²x, ω₀ = ${fmt(W0, 2)} rad/s`);
  if (vert) setReadout("F", `${fmt(kk * (dl + s.x), 2)}<small>N</small>`, `mg = ${fmt(m * P.g, 2)} N · teng ta’sir −kx = ${fmt(-kk * s.x, 2)} N`);
  else setReadout("F", `${fmt(-kk * s.x, 2)}<small>N</small>`, s.x === 0 ? "Muvozanat: kuch yo‘q" : s.x > 0 ? "Chapga — muvozanat tomon" : "O‘ngga — muvozanat tomon");

  const driven = P.driveOn;
  const aperiodic = R.type === "critical" || R.type === "over";
  const mTxt = meter.mean ?? meter.period;
  setReadout("Tm", mTxt ? `${fmt(mTxt, 3)}<small>s</small>` : "—",
    aperiodic && !driven ? "Tebranish yo‘q (aperiodik)" : meter.count ? `${meter.count} ta to‘liq tebranish bo‘yicha o‘rtacha` : mTxt ? "Birinchi o‘lchov" : s.t > 0 ? "O‘lchanmoqda…" : "Boshlang‘ich holat");
  if (driven) setReadout("Tt", `${fmt(TAU / Om(), 3)}<small>s</small>`, `Turg‘un rejimda T = 2π/Ω · T₀ = ${fmt(t0, 3)} s`);
  else if (aperiodic) setReadout("Tt", "∞", "T = 2π/ω_d: ω_d mavjud emas");
  else if (R.type === "under") setReadout("Tt", `${fmt(R.T, 3)}<small>s</small>`, `So‘nishda T = 2π/ω_d · T₀ = ${fmt(t0, 3)} s`);
  else setReadout("Tt", `${fmt(t0, 3)}<small>s</small>`, `T = 2π√(m/k) = 2π√(${fmt(m, 2)}/${fmt(kk, 1)})`);

  setReadout("E", `${sci(K + U, 3)}<small>J</small>`, `K = ${sci(K, 2)} J · U = ${sci(U, 2)} J`);
  if (vert) setReadout("dl", `${fmt(dl * 100, 1)}<small>sm</small>`, `Δl = mg/k = ${fmt(m * P.g, 2)}/${fmt(kk, 1)} · davr bog‘liq emas`);
  else setReadout("dl", "0<small>sm</small>", "Gorizontalda mg va N bir-birini yo‘qotadi");
  document.querySelector('[data-readout="dl"]').dataset.tone = vert ? "" : "muted";

  if (driven) {
    const Ast = steadyAmplitude(kk, m, P.b, P.F, Om());
    setReadout("A", `${fmt(A * 100, 1)}<small>sm</small>`, Number.isFinite(Ast) ? `Turg‘un amplituda ${fmt(Ast * 100, 1)} sm` : "Turg‘un amplituda cheksiz (rezonans, b = 0)");
  } else setReadout("A", `${fmt(A * 100, 1)}<small>sm</small>`, `v_max = Aω₀ = ${fmt(A * W0, 2)} m/s`);

  const bTxt = `b = ${fmt(P.b, 1)} kg/s · b_kr = 2√(km) = ${fmt(R.bc, 1)}`;
  if (R.type === "none") setReadout("Q", "yo‘q", `b = 0 · E o‘zgarmaydi · b_kr = ${fmt(R.bc, 1)} kg/s`);
  else if (R.type === "under") setReadout("Q", `Q = ${fmt(R.Q, 1)}`, `Susayuvchi · ${bTxt}`);
  else if (R.type === "critical") setReadout("Q", "kritik", `Eng tez qaytish · ${bTxt}`);
  else setReadout("Q", "aperiodik", `Tebranmasdan qaytadi · ${bTxt}`);

  // Holat
  const status = $("[data-status]");
  let [text, tone] = ["Tayyor", "blue"];
  if (flag === "limit") [text, tone] = ["Masshtab chegarasi", "red"];
  else if (flag === "rest") [text, tone] = ["Muvozanatda", "green"];
  else if (loop.running) [text, tone] = ["Tebranmoqda", "orange"];
  else if (s.t > 0) [text, tone] = ["Pauza", "purple"];
  status.textContent = text;
  status.dataset.tone = tone;

  // Rejimga bog'liq elementlar
  $("[data-net-switch]").hidden = !vert;
  $("[data-g-note]").textContent = vert
    ? "Vertikalda g muvozanatni Δl = mg/k ga siljitadi; davr g ga bog‘liq emas."
    : "Gorizontalda g ta’sir qilmaydi (mg va N muvozanatlashadi). Vertikal rejimda Δl ni o‘zgartiradi.";

  // Tushuntirish
  const parts = [];
  parts.push(vert
    ? `<p><b>Vertikal tebranish.</b> Yuk osilgach prujina avval <b>Δl = mg/k = ${fmt(dl * 100, 1)} sm</b> cho‘zilib, og‘irlikni muvozanatlaydi — bu yangi muvozanat nuqtasi (${sq("x = 0")}). Undan siljiganda og‘irlik va prujina kuchining teng ta’sir etuvchisi ${sq("−kx")}: gorizontaldagi bilan aynan bir xil tenglama, shuning uchun ${sq(`T = 2π√(m/k) = ${fmt(t0, 3)} s`)} va <b>g ga bog‘liq emas</b>.</p>`
    : `<p><b>Gorizontal tebranish.</b> Silliq sirtda og‘irlik ${sq("mg")} va reaksiya ${sq("N")} bir-birini yo‘qotadi; yuklamaga faqat prujina kuchi ${sq("F = −kx")} ta’sir qiladi va u doim muvozanat tomon yo‘nalgan. Davr ${sq(`T = 2π√(m/k) = ${fmt(t0, 3)} s`)}. “Vertikal” tugmasini bosib, shu holatning o‘zi osilgan yukda qanday ko‘rinishini ko‘ring.</p>`);
  if (P.link === "parallel") parts.push(`<p><b>Parallel ulanish:</b> ikkala prujina bir xil siljiydi, kuchlari qo‘shiladi — ${sq(`k = k₁ + k₂ = ${fmt(P.k1, 0)} + ${fmt(P.k2, 0)} = ${fmt(kk, 0)} N/m`)}. Tizim qattiqroq, shuning uchun davr qisqaroq.</p>`);
  else if (P.link === "series") parts.push(`<p><b>Ketma-ket ulanish:</b> ikkala prujinada kuch bir xil, cho‘zilishlar qo‘shiladi — ${sq(`1/k = 1/k₁ + 1/k₂`)}, ${sq(`k = ${fmt(kk, 1)} N/m`)} (har ikkalasidan ham yumshoq). Birlashma nuqtasi yukning ${sq(`k₂/(k₁+k₂) = ${fmt(jointShare(P.k1, P.k2) * 100, 0)}%`)} qadar siljiydi.</p>`);
  if (!vert && !driven && P.b === 0 && Math.abs(s.x) < 1e-9 && Math.abs(s.v) < 1e-9) parts.push("<p>Yuk muvozanatda. Uni sudrab siljiting yoki boshlang‘ich siljish/tezlikni tanlang.</p>");
  else if (!driven && P.b === 0) parts.push(`<p>Ishqalanish yo‘q: to‘liq energiya ${sq("E = kA²/2 = " + sci(0.5 * kk * A * A, 3) + " J")} o‘zgarmaydi, amplituda ${sq("A = " + fmt(A * 100, 1) + " sm")}. Kinetik va potensial energiya bir-biriga aylanadi; muvozanatda tezlik eng katta (${sq("v = Aω₀ = " + fmt(A * W0, 2) + " m/s")}). Davr amplitudaga bog‘liq emas.</p>`);
  if (P.b > 0) {
    const txt = R.type === "under" ? `Susayuvchi tebranish: amplituda ${sq("e<sup>−γt/2</sup>")} qonuni bilan kamayadi (har <b>${fmt(2 / R.gamma, 1)} s</b> da e marta), davr biroz uzayadi ${sq(`T = ${fmt(R.T, 3)} s`)}, ${sq(`Q = ${fmt(R.Q, 1)}`)}.`
      : R.type === "critical" ? `<b>Kritik so‘nish</b> (${sq("b = 2√(km) = " + fmt(R.bc, 1) + " kg/s")}): yuk tebranmasdan, eng tez muvozanatga qaytadi.`
        : `<b>Kuchli so‘nish</b> (${sq("b &gt; 2√(km) = " + fmt(R.bc, 1))}): tebranish yo‘q, yuk sekin muvozanatga “sudralib” qaytadi.`;
    parts.push(`<p>${txt}</p>`);
  }
  if (driven) {
    const r = P.ratio, Ast = steadyAmplitude(kk, m, P.b, P.F, Om());
    parts.push(`<p>Tashqi kuch ${sq(`F₀ = ${fmt(P.F, 1)} N`)}, chastota ${sq(`Ω = ${fmt(r, 2)} ω₀ = ${fmt(Om(), 2)} rad/s`)}. ${Math.abs(r - 1) < 0.08 ? "<b>Rezonans!</b> Chastotalar mos kelganda amplituda eng tez o‘sadi" + (P.b > 0 ? ", so‘nish uni " + sq("A = F₀/(bΩ) = " + fmt(Ast * 100, 1) + " sm") + " da cheklaydi." : "; ishqalanishsiz u cheksiz o‘sadi (animatsiya chegarada to‘xtaydi).") : r < 1 ? "Kuch chastotasi tabiiy chastotadan past — yuk kuchga deyarli “ergashadi”." : "Kuch chastotasi tabiiy chastotadan yuqori — yuk ulgurmaydi, amplituda kichik."}${Number.isFinite(Ast) && Math.abs(r - 1) >= 0.08 ? " Turg‘un amplituda " + sq(fmt(Ast * 100, 1) + " sm") + "." : ""}</p>`);
  }
  if (vert && Math.abs(P.g - 9.81) > 0.01) parts.push(`<p>Bu sayyorada ${sq("g = " + fmt(P.g, 2) + " m/s²")}: Yerdagi ${fmt(9.81 / kk * m * 100, 1)} sm o‘rniga <b>Δl = ${fmt(dl * 100, 1)} sm</b>, ammo davr o‘sha-o‘sha ${sq(fmt(t0, 3) + " s")}.</p>`);
  parts.push(`<p class="of-subtle">Sinab ko‘ring: massani 4 marta oshirsangiz davr 2 marta ortadi; qattiqlikni 4 marta oshirsangiz 2 marta kamayadi.</p>`);
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }

  // Ulanish haqida eslatma
  const keff = $("[data-keff]");
  keff.hidden = P.link === "single";
  if (P.link !== "single") keff.textContent = `Ekvivalent qattiqlik k = ${fmt(kk, P.link === "series" ? 1 : 0)} N/m`;

  stage.canvas.setAttribute("aria-label", `Prujinali mayatnik, ${vert ? "vertikal" : "gorizontal"}: k = ${fmt(kk, 1)} N/m, m = ${fmt(m, 2)} kg. Siljish ${fmt(s.x * 100, 1)} sm, davr ${fmt(t0, 3)} s.`);
  setPlayButton();
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { height: () => Math.round(Math.min(420, Math.max(285, innerHeight * 0.46))) });
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => splitHeights(w).graph });
const canvas = stage.canvas;
const playBtn = $("[data-play]");

function renderAll() { stage.render(); graph.render(); }

function setPlayButton() {
  const running = loop.running;
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : s.t > 0 && !flag ? "Davom ettirish" : "Boshlash";
}

function physicsStep(dt) {
  const p = params(), sd = sampleDt();
  s = advance(s, p, dt, (a, b) => {
    meter.feed(a, b);
    if (b.t - lastSample >= sd) sample(b);
  });
  Aview = Math.max(Aview, Math.min(X_LIMIT, 1.08 * Math.abs(s.x)));
}

const loop = createLoop((dt) => {
  physicsStep(dt * ui.speed);
  if (Math.abs(s.x) > X_LIMIT) { flag = "limit"; loop.stop(); }
  else if (!P.driveOn && amplitudeOf(s.x, s.v, w0()) < 2e-4 && P.b > 0) { flag = "rest"; loop.stop(); }
  renderAll();
  updateUI();
}, { onStateChange: () => { setPlayButton(); updateUI(); } });

function afterChange({ keepRunning = true } = {}) {
  syncV0Range();
  resetSim({ keepRunning: keepRunning && loop.running });
  renderAll();
  updateUI();
}

playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (flag) resetSim();
  loop.start();
});
$("[data-reset]").addEventListener("click", () => { afterChange({ keepRunning: false }); });
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));

/* Slayderlar */
const x0El = $("#x0"), v0El = $("#v0");
const x0Ctl = bindRange(x0El, $("#x0Out"), (v) => `${fmt(v, 1)} sm`, (v) => { init.x = v / 100; afterChange(); });
const v0Ctl = bindRange(v0El, $("#v0Out"), (v) => `${fmt(v, 2)} m/s`, (v) => { init.v = v; afterChange(); });
const k1Ctl = bindRange($("#k1"), $("#k1Out"), (v) => `${fmt(v, 0)} N/m`, (v) => { P.k1 = v; afterChange(); });
const k2Ctl = bindRange($("#k2"), $("#k2Out"), (v) => `${fmt(v, 0)} N/m`, (v) => { P.k2 = v; afterChange(); });
const mCtl = bindRange($("#m"), $("#mOut"), (v) => `${fmt(v, 2)} kg`, (v) => { P.m = v; afterChange(); });
const bCtl = bindRange($("#b"), $("#bOut"), (v) => (v === 0 ? "yo‘q" : `${fmt(v, 1)} kg/s`), (v) => { P.b = v; afterChange(); });
const fCtl = bindRange($("#driveF"), $("#driveFOut"), (v) => `${fmt(v, 1)} N`, (v) => { P.F = v; afterChange(); });
const rCtl = bindRange($("#driveR"), $("#driveROut"), (v) => `${fmt(v, 2)} ω₀`, (v) => { P.ratio = v; afterChange(); });
const linkSel = $("#link"), planet = $("#planet"), gOut = $("#gOut");

function syncV0Range() {
  const vMax = Math.max(0.2, Math.round(w0() * 0.25 * 20) / 20);
  v0El.min = String(-vMax); v0El.max = String(vMax); v0El.step = vMax > 1.5 ? "0.1" : "0.05";
  init.v = clamp(init.v, -vMax, vMax);
  v0Ctl.set(init.v);
}
function syncLinkUI() {
  linkSel.value = P.link;
  $("[data-k2-panel]").hidden = P.link === "single";
  $("[data-k1-label]").textContent = P.link === "single" ? "Qattiqlik k" : "1-prujina qattiqligi k₁";
}
linkSel.addEventListener("change", () => { P.link = linkSel.value; syncLinkUI(); afterChange(); });
const syncG = () => { gOut.textContent = `${fmt(P.g, 2)} m/s²`; planet.value = String(P.g); };
planet.addEventListener("change", () => { P.g = Number(planet.value); syncG(); renderAll(); updateUI(); });

function setDrive(on) {
  P.driveOn = on;
  document.querySelector('[data-toggle="drive"]').checked = on;
  document.querySelectorAll("[data-drive-panel]").forEach((el) => { el.hidden = !on; });
}

/* Rejim: gorizontal ↔ vertikal (holat saqlanadi) */
function setMode(mode) {
  P.mode = mode;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === mode)));
  renderAll(); updateUI();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.modeValue)));

/* Tayyor holatlar */
const BASE = { mode: "horizontal", link: "single", k1: 25, k2: 60, m: 1, x: 12, v: 0, b: 0, g: 9.81, drive: false, F: 0.8, ratio: 1 };
const PRESETS = {
  free:      {},
  hang:      { mode: "vertical" },
  moon:      { mode: "vertical", g: 1.62 },
  parallel:  { link: "parallel", k1: 40, k2: 60, x: 10 },
  series:    { link: "series", k1: 40, k2: 60 },
  damped:    { b: 1, x: 15 },
  critical:  { b: 10, x: 15 },
  resonance: { b: 1, x: 0, drive: true, F: 0.8, ratio: 1 },
};
function applyPreset(key) {
  const q = { ...BASE, ...PRESETS[key] };
  Object.assign(P, { link: q.link, k1: q.k1, k2: q.k2, m: q.m, b: q.b, g: q.g, F: q.F, ratio: q.ratio });
  init.x = q.x / 100; init.v = q.v;
  k1Ctl.set(q.k1); k2Ctl.set(q.k2); mCtl.set(q.m); bCtl.set(q.b); x0Ctl.set(q.x); fCtl.set(q.F); rCtl.set(q.ratio);
  syncLinkUI(); syncG(); setDrive(q.drive);
  syncV0Range();
  setMode(q.mode);
  markPreset(key);
  resetSim();
  renderAll(); updateUI();
  loop.start();
}
// Tanlangan preset tugmasi belgilanadi; parametr qo'lda o'zgartirilsa belgi olinadi
const markPreset = (key) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === key)));
markPreset(null);
document.querySelector(".sim-panel")?.addEventListener("input", () => markPreset(null));
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  const key = cb.dataset.toggle;
  if (key === "drive") { setDrive(cb.checked); afterChange(); return; }
  ui.show[key] = cb.checked;
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
  graph.canvas.dataset.clickable = String(tab === "period");
  graph.canvas.setAttribute("aria-label", TABS[tab][0]);
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* Grafikda bosib parametr tanlash: T(m) -> m */
graph.canvas.addEventListener("pointerdown", (e) => {
  const r = graph.canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  if (ui.tab === "period") {
    const m = periodMassFromPointer(px, py);
    if (m === null) return;
    P.m = clamp(Math.round(m * 20) / 20, 0.1, 3);
    mCtl.set(P.m);
    afterChange({ keepRunning: false }); loop.start();
  }
});

/* Kamera: bo‘sh joyni sudrash / ikki barmoq; yukni bevosita surish. */
let gesture = null;
const pointers = new Map();
const position = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};
const pinchDistance = () => {
  const [a,b] = [...pointers.values()];
  return Math.hypot(a.x-b.x,a.y-b.y);
};
canvas.style.touchAction = "none";
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 && e.pointerType !== "touch") return;
  const p = position(e); pointers.set(e.pointerId,p);
  canvas.setPointerCapture(e.pointerId);
  if(pointers.size > 1) {
    if(gesture?.kind === "mass" && gesture.running)loop.start();
    gesture = { kind: "pinch", distance: pinchDistance(), zoom: lab.camera.zoom };
    return;
  }
  const mass = lab.hit(p.x,p.y);
  gesture = { kind: mass ? "mass" : "orbit", start: p, last: p, x: s.x, running: loop.running };
  if(mass) loop.stop();
  canvas.dataset.dragging = "true";
});
canvas.addEventListener("pointermove", (e) => {
  const p = position(e);
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId,p);
  if(!gesture) { canvas.style.cursor = lab.hit(p.x,p.y) ? "grab" : "move"; return; }
  if(gesture.kind === "pinch") {
    if(pointers.size > 1) lab.camera.zoom = clamp(gesture.zoom * pinchDistance()/Math.max(1,gesture.distance), .7, 1.65);
  } else if(gesture.kind === "mass") {
    const x = clamp(gesture.x + lab.displacement(p.x-gesture.start.x,p.y-gesture.start.y),-.25,.25);
    init.x = Math.round(x*400)/400; init.v = 0;
    x0Ctl.set(init.x*100); v0Ctl.set(0);
    resetSim(); markPreset(null); updateUI();
  } else {
    lab.camera.yaw += (p.x-gesture.last.x)*.009;
    lab.camera.pitch = clamp(lab.camera.pitch+(p.y-gesture.last.y)*.006,.08,1.3);
    gesture.last = p;
  }
  renderAll();
});
function endGesture(e) {
  if(!pointers.has(e.pointerId))return;
  pointers.delete(e.pointerId);
  const wasMass = gesture?.kind === "mass";
  gesture = null; canvas.dataset.dragging = "false";
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(wasMass && e.type === "pointerup")loop.start();
  renderAll();
}
canvas.addEventListener("pointerup",endGesture);
canvas.addEventListener("pointercancel",endGesture);
canvas.addEventListener("lostpointercapture",endGesture);
canvas.addEventListener("wheel",e=>{
  e.preventDefault(); lab.camera.zoom=clamp(lab.camera.zoom*Math.exp(-e.deltaY*.001),.7,1.65);stage.render();
},{passive:false});
canvas.tabIndex=0;
canvas.addEventListener("keydown",e=>{
  if(e.ctrlKey || e.metaKey || e.altKey)return;
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","=","-","Home"].includes(e.key))return;
  e.preventDefault();
  if(e.key==="ArrowLeft")lab.camera.yaw-=.15;
  if(e.key==="ArrowRight")lab.camera.yaw+=.15;
  if(e.key==="ArrowUp")lab.camera.pitch=clamp(lab.camera.pitch+.1,.08,1.3);
  if(e.key==="ArrowDown")lab.camera.pitch=clamp(lab.camera.pitch-.1,.08,1.3);
  if(e.key==="+"||e.key==="=")lab.camera.zoom=clamp(lab.camera.zoom+.1,.7,1.65);
  if(e.key==="-")lab.camera.zoom=clamp(lab.camera.zoom-.1,.7,1.65);
  if(e.key==="Home")lab.reset();
  stage.render();
});
document.querySelectorAll("[data-camera]").forEach(b=>b.addEventListener("click",()=>{
  const name=b.dataset.camera;
  if(name==="reset")lab.reset();
  else if(name==="front")Object.assign(lab.camera,{yaw:0,pitch:.12,zoom:1});
  else if(name==="side")Object.assign(lab.camera,{yaw:Math.PI/2,pitch:.25,zoom:1});
  else if(name==="top")Object.assign(lab.camera,{yaw:0,pitch:1.3,zoom:1});
  stage.render();
}));

/* Boshlash */
syncG();
syncLinkUI();
syncV0Range();
x0Ctl.set(init.x * 100);
resetSim();
setTab("x");
updateUI();
renderAll();
const q = new URLSearchParams(location.search).get("preset"); // katalogdagi darslik havolalari
if (PRESETS[q]) applyPreset(q);
document.fonts?.ready.then(renderAll);
