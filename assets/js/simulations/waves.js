// ==========================================================================
// Mexanik to'lqinlar va tovush — virtual laboratoriya (simulations/waves.html)
// 1) Ipdagi to'lqin: ko'ndalang/bo'ylama, garmonik manba, impuls yoki qo'lda tebratish, mahkam/erkin/cheksiz uch,
//    qaytish, turg'un to'lqinlar va garmonikalar, nuqta tebranishi.
// 2) Interferensiya: suv sirtida bitta yoki ikkita manba, yo'llar farqi, maksimum/minimum chiziqlari, tebranishlarni qo'shish.
// 3) Tovush va Doppler: harakatlanuvchi manba, to'lqin frontlari, ikki kuzatuvchi chastotasi, Max konusi, ovoz (WebAudio).
// Fizika: waves-physics.js (Node'da tekshirilgan). Grafiklar: waves-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as W from "./waves-physics.js";
import * as G from "./waves-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch5d";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch5d";
import { createWavesLab } from "./waves-lab-3d.js?v=20261123-batch5d";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "string", tab: "shape", speed: 1, show: { lines: true } };
const LEN = 4;
const str = { wave: "trans", src: "harm", right: "fixed", f: 1, A: 4, v: 2, g: 0.06, probeX: 1.5, t0: 0, pulseT: null, hand: 0, handTarget: 0, hist: [], env: null };
const rip = { n: 2, f: 3, v: 15, d: 14, dphi: 0, s1: { x: -7, y: -12 }, s2: { x: 7, y: -12 }, probe: { x: 6, y: 8 }, t: 0, t0: 0 };
const dop = { medium: "air", c: 343, f: 440, M: 0.5, A: { x: 12, y: -4 }, B: { x: -12, y: -4 }, t: 0, tStart: 0, x0: -22, fronts: [], nEmit: 0 };
let presetId = null;
let sim = new W.StringWave({ L: LEN, n: 400, v: str.v, gamma: str.g, right: str.right });

function resetString() {
  sim = new W.StringWave({ L: LEN, n: 400, v: str.v, gamma: str.g, right: str.right });
  str.t0 = 0; str.pulseT = str.src === "pulse" ? 0.05 : null; str.hist = []; str.env = new Float64Array(sim.n + 1); str.hand = 0; str.handTarget = 0;
}
function drive(t) {
  const A = str.A / 100;
  if (str.src === "harm") { const tt = t - str.t0; return A * Math.sin(TAU * str.f * tt) * Math.min(1, tt * str.f); }
  if (str.src === "pulse") return str.pulseT === null ? 0 : A * Math.exp(-(((t - str.pulseT - 0.15) / 0.06) ** 2));
  return str.handAt ? str.handAt(t) : str.hand;
}
const lambda = () => str.v / str.f;
function standing() {
  if (str.src !== "harm" || str.right === "open") return null;
  const h = W.nearestHarmonic(str.f, str.v, LEN, str.right);
  return h.rel < 0.015 ? h : null;
}
function nodes() {
  const h = standing(); if (!h) return [];
  const lam = lambda(), out = [];
  if (str.right === "fixed") for (let x = LEN; x >= -1e-9; x -= lam / 2) out.push(x);
  else for (let x = LEN - lam / 4; x >= -1e-9; x -= lam / 2) out.push(x);
  return out;
}

/* ------------------------------------------------------------------ Ripple */

const kR = () => (TAU * rip.f) / rip.v, wR = () => TAU * rip.f, lamR = () => rip.v / rip.f;
const srcList = () => (rip.n === 2 ? [{ ...rip.s1, phase: (rip.dphi * Math.PI) / 180 }, { ...rip.s2, phase: 0 }] : [{ ...rip.s1, phase: 0 }]);
function setSourcesFromD() {
  let mx = (rip.s1.x + rip.s2.x) / 2, my = (rip.s1.y + rip.s2.y) / 2;
  let ux = rip.s2.x - rip.s1.x, uy = rip.s2.y - rip.s1.y; const l = Math.hypot(ux, uy);
  if (l < 1e-6) { ux = 1; uy = 0; } else { ux /= l; uy /= l; }
  // Keep both driven tips within the tank when changing separation after a drag.
  const dx = Math.abs(ux * rip.d / 2), dy = Math.abs(uy * rip.d / 2);
  mx = clamp(mx, -28 + dx, 28 - dx); my = clamp(my, -18 + dy, 18 - dy);
  rip.s1 = { x: mx - (ux * rip.d) / 2, y: my - (uy * rip.d) / 2 }; rip.s2 = { x: mx + (ux * rip.d) / 2, y: my + (uy * rip.d) / 2 };
}

/* ------------------------------------------------------------------ Doppler */

const VIS = 6; // to'lqin fronti ekranda 6 m/s tezlikda (vaqt sekinlashtirilgan)
const srcU = () => dop.M * dop.c;
function srcX(t) { return dop.M === 0 ? 0 : dop.x0 + srcU() * (t - dop.tStart); }
function restartDoppler() { dop.t = 0; dop.tStart = 0; dop.x0 = dop.M === 0 ? 0 : -22; dop.fronts = []; dop.nEmit = 0; }
function recv(obs, t = dop.t) {
  const sols = W.received(dop.f, dop.c, { x0: srcX(dop.tStart), y: 0, u: dop.M === 0 ? 0 : srcU() }, { x: obs.x - 0, y: obs.y }, t - dop.tStart);
  // A receiver measures the magnitude of the phase rate. On the second
  // supersonic branch phase reversal remains encoded in te for the p(t) graph.
  return sols.filter((s) => s.te >= 0).map((s) => ({ ...s, f: Math.abs(s.f) }));
}

/* ------------------------------------------------------------------ 3D laboratoriya */

const scene = createWavesLab();
function draw(ctx, stage) {
  scene.draw(ctx, stage, ui, str, sim, rip, dop, { nodes: nodes(), harmonic: standing(), sources: srcList(), srcX, recv });
}
const heights = (cw) => ({ stage: detailedStageHeight(cw), graph: Math.round(clamp(innerHeight * .26, 170, 240)) });
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  string: [["shape", "y(x)", "Ipning shakli y(x)", "Bir ondagi ip shakli — to‘lqinning «surati». Ko‘k soha — har bir nuqtaning tebranish chegarasi: turg‘un to‘lqinda tugun va do‘ngliklar ko‘rinadi."], ["probe", "y(t)", "Belgilangan nuqtaning tebranishi", "Ipning bir nuqtasi faqat yuqori-pastga tebranadi — to‘lqin bilan birga oldinga ketmaydi. Qizil P belgisini ip bo‘ylab suring."]],
  ripple: [["sum", "Qo‘shish", "Tebranishlarni qo‘shish (kuzatish nuqtasida)", "Ikki to‘lqin bir fazada kelsa kuchayadi (maksimum), qarama-qarshi fazada — so‘nadi (minimum)."], ["amp", "A(x)", "Amplituda taqsimoti", "Kuzatish nuqtasidan o‘tgan gorizontal chiziq bo‘ylab tebranish amplitudasi: maksimum va minimumlar navbatlashadi."]],
  doppler: [["fu", "ν′(u)", "Qabul qilinadigan chastota", "Manba yaqinlashganda chastota (tovush balandligi) ortadi, uzoqlashganda kamayadi."], ["p", "p(t)", "Kuzatuvchilardagi bosim tebranishi", "A oldinda — tebranishlar zichroq (chastota yuqori), B orqada — siyrakroq."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "string") {
    if (ui.tab === "probe") return G.drawProbe(ctx, st, { hist: str.hist, A: Math.max(str.A, 3) / 100, span: 6, T: str.src === "harm" ? 1 / str.f : null });
    return G.drawShape(ctx, st, { u: sim.u, env: str.wave === "trans" ? str.env : null, L: LEN, A: Math.max(str.A, 3) / 100, probeX: str.probeX, nodes: str.wave === "trans" ? nodes() : [] });
  }
  if (ui.mode === "ripple") {
    const S = srcList(), k = kR(), P = rip.probe;
    const amp = (s) => 1 / Math.sqrt(Math.max(Math.hypot(P.x - s.x, P.y - s.y), 1.5) / 1.5);
    const ph = (s) => k * Math.hypot(P.x - s.x, P.y - s.y) + s.phase;
    if (ui.tab === "amp") { const fn = (x) => W.rippleAmplitude(S, x, P.y, { k, r0: 1.5 }); let mA = 0; for (let x = -30; x <= 30; x += 0.25) mA = Math.max(mA, fn(x)); return G.drawAmpLine(ctx, st, { fn, x0: -30, x1: 30, probeX: P.x, yLine: P.y, maxA: Math.max(0.2, mA * 1.1) }); }
    return G.drawSum(ctx, st, { a1: amp(S[0]), a2: S[1] ? amp(S[1]) : 0, p1: ph(S[0]), p2: S[1] ? ph(S[1]) : 0, w: wR(), t: rip.t, two: rip.n === 2 });
  }
  if (ui.tab === "p") {
    const span = 6 / dop.f, N = 360, hA = [], hB = [];
    for (let i = 0; i <= N; i++) {
      const tt = dop.t - span + (span * i) / N;
      const a = tt > 0 ? recv(dop.A, tt) : [], b = tt > 0 ? recv(dop.B, tt) : [];
      hA.push({ t: tt, p: a.length ? a.reduce((s, q) => s + Math.cos(TAU * dop.f * q.te), 0) / a.length : null });
      hB.push({ t: tt, p: b.length ? b.reduce((s, q) => s + Math.cos(TAU * dop.f * q.te), 0) / b.length : null });
    }
    return G.drawPressure(ctx, st, { hA, hB, span });
  }
  return G.drawDopplerF(ctx, st, { f0: dop.f, M: dop.M });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
function updateReadouts() {
  if (ui.mode === "string") {
    const h = standing(), harm = str.src === "harm";
    setRO("r1", "To‘lqin uzunligi <i>λ</i>", harm ? `${fmt(lambda(), 2)}<small>m</small>` : "—", harm ? "λ = v/ν" : "Impulsda λ yo‘q");
    setRO("r2", "Davr <i>T</i>", harm ? `${fmt(1 / str.f, 2)}<small>s</small>` : "—", harm ? `ν = ${fmt(str.f, 2)} Hz` : "");
    setRO("r3", "Tezlik <i>v</i>", `${fmt(str.v, 1)}<small>m/s</small>`, `Ipni bosib o‘tish: ${fmt(LEN / str.v, 2)} s`);
    const f1 = W.harmonic(1, str.v, LEN, str.right === "free" ? "free" : "fixed");
    setRO("r4", "Asosiy chastota <i>ν</i>₁", str.right === "open" ? "—" : `${fmt(f1, 2)}<small>Hz</small>`, str.right === "fixed" ? "ν₁ = v/(2L), L = 4 m" : str.right === "free" ? "ν₁ = v/(4L) (bir uchi erkin)" : "Cheksiz ipda turg‘un to‘lqin yo‘q");
    setRO("r5", "Holat", h ? `${h.n}-garmonika` : str.src === "harm" ? "yuguruvchi" : str.src === "pulse" ? "impuls" : "qo‘lda", h ? `Tugunlar soni: ${nodes().length}` : str.right === "fixed" ? "Qaytgan to‘lqin teskari" : str.right === "free" ? "Qaytgan to‘lqin to‘g‘ri" : "Qaytish yo‘q", h ? "" : "");
    const pi = Math.round((str.probeX / LEN) * sim.n);
    setRO("r6", "Nuqta siljishi", `${fmt(sim.u[pi] * 100, 1)}<small>cm</small>`, `x = ${fmt(str.probeX, 2)} m`);
  } else if (ui.mode === "ripple") {
    const lam = lamR(), P = rip.probe, S = srcList();
    const r1 = Math.hypot(P.x - S[0].x, P.y - S[0].y), r2 = S[1] ? Math.hypot(P.x - S[1].x, P.y - S[1].y) : null;
    setRO("r1", "To‘lqin uzunligi <i>λ</i>", `${fmt(lam, 1)}<small>cm</small>`, `λ = v/ν, T = ${fmt(1 / rip.f, 2)} s`);
    setRO("r2", "1-manbagacha <i>r</i>₁", `${fmt(r1, 1)}<small>cm</small>`, `${fmt(r1 / lam, 2)} λ`);
    setRO("r3", "2-manbagacha <i>r</i>₂", r2 === null ? "—" : `${fmt(r2, 1)}<small>cm</small>`, r2 === null ? "Bitta manba" : `${fmt(r2 / lam, 2)} λ`);
    if (rip.n === 2) {
      const pd = W.pathDifference(S[0], S[1], P.x, P.y, lam, (rip.dphi * Math.PI) / 180);
      setRO("r4", "Yo‘llar farqi <i>Δr</i>", `${fmt(Math.abs(pd.d), 1)}<small>cm</small>`, `= ${fmt(Math.abs(pd.d) / lam, 2)} λ`);
      setRO("r5", "Natija", pd.kind === "max" ? "maksimum" : pd.kind === "min" ? "minimum" : "oraliq", rip.dphi ? `Faza farqi ${fmt(rip.dphi, 0)}° ham hisobga olingan` : pd.kind === "max" ? "Δr = kλ — kuchayish" : pd.kind === "min" ? "Δr = (2k+1)λ/2 — so‘nish" : "", pd.kind === "min" ? "orange" : "");
      const A = W.rippleAmplitude(S, P.x, P.y, { k: kR(), r0: 1.5 }), a1 = 1 / Math.sqrt(Math.max(r1, 1.5) / 1.5), a2 = 1 / Math.sqrt(Math.max(r2, 1.5) / 1.5);
      setRO("r6", "Amplituda", `${fmt((A / (a1 + a2)) * 100, 0)}<small>%</small>`, "A₁ + A₂ ga nisbatan");
    } else {
      setRO("r4", "Yo‘llar farqi", "—", "Ikkinchi manbani yoqing"); setRO("r5", "Fronti", "aylanalar", "Barcha yo‘nalishda bir xil tezlik"); setRO("r6", "Amplituda", "∝ 1/√r", "Uzoqlashgan sari kamayadi");
    }
  } else {
    const a = recv(dop.A), b = recv(dop.B), u = srcU(), mach = W.machAngle(u, dop.c);
    setRO("r1", "Tovush tezligi <i>c</i>", `${fmt(dop.c, 0)}<small>m/s</small>`, W.MEDIA.find((m) => m.id === dop.medium).name);
    setRO("r2", "Manba tezligi <i>u</i>", `${fmt(u, 0)}<small>m/s</small>`, `Max soni M = ${fmt(dop.M, 2)}`, dop.M >= 1 ? "orange" : "");
    setRO("r3", "A eshitadi", a.length ? `${fmt(a[0].f, 0)}<small>Hz</small>` : "jim", a.length ? (a.length > 1 ? `va ${fmt(a[1].f, 0)} Hz bir vaqtda` : `Manba ν = ${fmt(dop.f, 0)} Hz`) : "To‘lqin hali yetib kelmagan", a.length ? "" : "muted");
    setRO("r4", "B eshitadi", b.length ? `${fmt(b[0].f, 0)}<small>Hz</small>` : "jim", b.length ? (b.length > 1 ? `va ${fmt(b[1].f, 0)} Hz bir vaqtda` : "") : "To‘lqin hali yetib kelmagan", b.length ? "" : "muted");
    setRO("r5", "λ oldinda / orqada", dop.M < 1 ? `${fmt((dop.c - u) / dop.f, 2)} / ${fmt((dop.c + u) / dop.f, 2)}<small>m</small>` : "—", dop.M < 1 ? "λ′ = (c ∓ u)/ν" : "Manba o‘z to‘lqinlaridan o‘zib ketadi");
    setRO("r6", "Max konusi", mach === null ? "yo‘q" : `${fmt(mach, 1)}°`, mach === null ? "u < c" : "sin α = c/u — zarb to‘lqini", mach === null ? "" : "orange");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "string") { const h = standing(); t = h ? `Turg‘un to‘lqin, ${h.n}-garmonika` : str.wave === "long" ? "Bo‘ylama to‘lqin" : "Ko‘ndalang to‘lqin"; tone = h ? "green" : "blue"; }
  else if (ui.mode === "ripple") { t = rip.n === 2 ? "Interferensiya" : "Aylanma to‘lqinlar"; }
  else { t = dop.M === 0 ? "Manba tinch" : dop.M < 1 ? "Doppler effekti" : dop.M === 1 ? "Tovush to‘sig‘i" : "Tovushdan tez — zarb to‘lqini"; tone = dop.M >= 1 ? "orange" : "blue"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "string") {
    p.push(`<p><b>To‘lqin</b> — tebranishning muhitda tarqalishi: ipning har bir bo‘lagi qo‘shnisini tortadi va tebranish v tezlik bilan uzatiladi. Bunda <b>energiya</b> ko‘chadi, modda esa joyida tebranadi.${str.wave === "long" ? " <b>Bo‘ylama</b> to‘lqinda zarralar to‘lqin tarqalish yo‘nalishi bo‘ylab tebranadi — siqilish va siyraklanishlar hosil bo‘ladi (tovush shunday to‘lqin)." : " <b>Ko‘ndalang</b> to‘lqinda zarralar tarqalish yo‘nalishiga tik tebranadi."}</p>`);
    if (str.right === "fixed") p.push("<p>Mahkam uchdan to‘lqin <b>teskari</b> (fazasi π ga o‘zgarib) qaytadi. Kelayotgan va qaytgan to‘lqinlar qo‘shilib, ma’lum chastotalarda <b>turg‘un to‘lqin</b> hosil qiladi: tugunlar joyida turadi, do‘ngliklar eng kuchli tebranadi.</p>");
    else if (str.right === "free") p.push("<p>Erkin uchdan to‘lqin <b>to‘g‘ri</b> (fazasi o‘zgarmasdan) qaytadi; uchda do‘nglik hosil bo‘ladi.</p>");
    else p.push("<p>«Cheksiz» ipda qaytish yo‘q — faqat yuguruvchi to‘lqin.</p>");
  } else if (ui.mode === "ripple") {
    p.push("<p>Har bir manba aylanma to‘lqinlar tarqatadi. Ikki <b>kogerent</b> (bir xil chastotali) manba to‘lqinlari qo‘shilganda barqaror manzara — <b>interferensiya</b> hosil bo‘ladi.</p>");
    if (rip.n === 2) p.push("<p>Yo‘llar farqi Δr = kλ bo‘lgan nuqtalarda to‘lqinlar bir fazada keladi — <b>maksimum</b> (yashil punktir chiziqlar). Δr = (2k+1)λ/2 bo‘lsa, qarama-qarshi fazada — <b>minimum</b>, suv deyarli tinch (qizil chiziqlar). Bu chiziqlar giperbolalar.</p>");
  } else {
    p.push("<p>Tovush — havodagi bo‘ylama to‘lqin. Manba harakatlanganda u har bir frontni oldingisidan siljigan joydan chiqaradi: oldinda frontlar zichlashadi (λ kichik, chastota katta — tovush balandroq), orqada siyraklashadi. Bu — <b>Doppler effekti</b>.</p>");
    if (dop.M >= 1) p.push("<p>Manba tovushdan tez harakatlansa, frontlar konus — <b>Max konusi</b> bo‘ylab to‘planadi; u yetib kelganda zarb to‘lqini (gumburlash) eshitiladi. Konus ichida kuzatuvchi bir vaqtda ikki chastotani eshitadi, tashqarisida — hech narsa.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "string" ? "<small>To‘lqin uzunligi</small> λ = v/ν" : ui.mode === "ripple" ? "<small>Maksimum</small> Δr = kλ" : "<small>Doppler</small> ν′ = ν·c/(c ∓ u)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (ui.mode === "string") {
    const T = dt * ui.speed;
    // qo'l: kadr ichida silliq interpolyatsiya (sakrashlar yuqori chastotali shovqin bermasligi uchun)
    const h0 = str.hand, h1 = h0 + (str.handTarget - h0) * Math.min(1, dt * 9), ts = sim.t;
    str.handAt = (t) => h0 + (h1 - h0) * clamp((t - ts) / Math.max(T, 1e-9), 0, 1);
    sim.v = str.v; sim.gamma = str.g;
    sim.advance(T, drive);
    str.hand = h1;
    const dec = Math.exp(-T / 1.2);
    for (let i = 0; i <= sim.n; i++) str.env[i] = Math.max(Math.abs(sim.u[i]), str.env[i] * dec);
    str.hist.push({ t: sim.t, y: sim.at(str.probeX) }); while (str.hist.length && str.hist[0].t < sim.t - 6.5) str.hist.shift();
  } else if (ui.mode === "ripple") rip.t += dt * ui.speed;
  else {
    dop.t += dt * (VIS / dop.c);
    if (dop.M > 0 && srcX(dop.t) > 23) { dop.tStart = dop.t; dop.x0 = -22; dop.fronts = []; dop.nEmit = 0; }
    const k = Math.floor((dop.t - dop.tStart) * dop.f);
    while (dop.nEmit <= k) { const te = dop.tStart + dop.nEmit / dop.f; dop.fronts.push({ te, xe: srcX(te) }); dop.nEmit++; }
    dop.fronts = dop.fronts.filter((fr) => dop.c * (dop.t - fr.te) < 75);
    updateSound();
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); graph.render(); }
}, { onStateChange(on) { setPlayUI(on); if (!on) updateSound(true); } });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
setPlayUI(false);
playBtn.addEventListener("click", () => loop.toggle());

/* Ovoz (WebAudio) */
let audio = null;
const soundBtn = $("[data-sound]");
function updateSound(mute = false) {
  if (!audio) return;
  const on = soundBtn.getAttribute("aria-pressed") === "true" && ui.mode === "doppler" && loop.running && !mute;
  const r = on ? recv(dop.A) : [];
  const now = audio.ctx.currentTime;
  if (r.length && r[0].f < 20000) { audio.osc.frequency.setTargetAtTime(r[0].f, now, 0.02); audio.gain.gain.setTargetAtTime(0.06, now, 0.03); }
  else audio.gain.gain.setTargetAtTime(0, now, 0.03);
}
soundBtn.addEventListener("click", () => {
  const on = soundBtn.getAttribute("aria-pressed") !== "true";
  soundBtn.setAttribute("aria-pressed", String(on));
  soundBtn.classList.toggle("of-btn--primary", on);
  if (on && !audio) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
      const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = "sine"; gain.gain.value = 0; osc.connect(gain).connect(ctx.destination); osc.start();
      audio = { ctx, osc, gain };
    } catch { /* ovoz qo'llab-quvvatlanmaydi */ }
  }
  if (audio && audio.ctx.state === "suspended") audio.ctx.resume();
  updateSound();
});

/* ------------------------------------------------------------------ Boshqaruv */

const wFC = bindRange($("#wF"), $("#wFOut"), (v) => `${fmt(v, 2)} Hz`, (v) => { str.f = v; customized(); refresh(); });
const wAC = bindRange($("#wA"), $("#wAOut"), (v) => `${fmt(v, 1)} cm`, (v) => { str.A = v; customized(); refresh(); });
const wVC = bindRange($("#wV"), $("#wVOut"), (v) => `${fmt(v, 1)} m/s`, (v) => { str.v = v; customized(); refresh(); });
const wGC = bindRange($("#wG"), $("#wGOut"), (v) => (v === 0 ? "yo‘q" : fmt(v, 2)), (v) => { str.g = v; customized(); refresh(); });
const seg = (attr, obj, key, after) => document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.addEventListener("click", () => { obj[key] = b.dataset[`${attr}Value`]; after?.(); syncAll(); customized(); refresh(); }));
seg("wtype", str, "wave");
seg("src", str, "src", () => { if (str.src === "pulse") str.pulseT = sim.t + 0.02; if (str.src === "harm") str.t0 = sim.t; });
seg("end", str, "right", () => { sim.right = str.right; });
$("[data-pulse]").addEventListener("click", () => { if (str.src !== "pulse") { str.src = "pulse"; syncAll(); } str.pulseT = sim.t + 0.02; if (!loop.running) loop.start(); customized(); refresh(); });
$("[data-harm]").addEventListener("click", () => { const h = W.nearestHarmonic(str.f, str.v, LEN, str.right === "free" ? "free" : "fixed"); if (str.right === "open") { str.right = "fixed"; sim.right = "fixed"; } str.f = Math.round(W.harmonic(h.n, str.v, LEN, str.right) * 1000) / 1000; syncAll(); customized(); refresh(); });

const rFC = bindRange($("#rF"), $("#rFOut"), (v) => `${fmt(v, 1)} Hz`, (v) => { rip.f = v; customized(); refresh(); });
const rVC = bindRange($("#rV"), $("#rVOut"), (v) => `${fmt(v, 1)} cm/s`, (v) => { rip.v = v; customized(); refresh(); });
const rDC = bindRange($("#rD"), $("#rDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { rip.d = v; setSourcesFromD(); customized(); refresh(); });
const rPC = bindRange($("#rP"), $("#rPOut"), (v) => `${fmt(v, 0)}°`, (v) => { rip.dphi = v; customized(); refresh(); });
seg("nsrc", rip, "n", () => { rip.n = +rip.n; if (rip.n === 2) setSourcesFromD(); });

const dFC = bindRange($("#dF"), $("#dFOut"), (v) => `${fmt(v, 0)} Hz`, (v) => { dop.f = v; restartDoppler(); customized(); refresh(); });
const dMC = bindRange($("#dM"), $("#dMOut"), (v) => `${fmt(v, 2)} (${fmt(v * dop.c, 0)} m/s)`, (v) => { dop.M = v; restartDoppler(); customized(); refresh(); });
seg("medium", dop, "medium", () => { dop.c = W.MEDIA.find((m) => m.id === dop.medium).c; dMC.set(dop.M); restartDoppler(); });

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));
$("[data-reset]").addEventListener("click", () => { if (ui.mode === "string") resetString(); else if (ui.mode === "ripple") { rip.t = 0; rip.t0 = 0; } else restartDoppler(); refresh(); });

/* Sahna dastaklari; bo‘sh maydon 360° kamerani boshqaradi. */
const canvas = stage.canvas;
let knobDrag = null;
const knobSpecs = {
  wF: { object: str, key: 'f', min: .2, max: 4, step: .05, control: wFC },
  wA: { object: str, key: 'A', min: 1, max: 10, step: .5, control: wAC },
  rF: { object: rip, key: 'f', min: 1, max: 8, step: .1, control: rFC },
  rP: { object: rip, key: 'dphi', min: 0, max: 360, step: 15, control: rPC },
  dF: { object: dop, key: 'f', min: 100, max: 1000, step: 10, control: dFC },
  dM: { object: dop, key: 'M', min: 0, max: 1.8, step: .05, control: dMC },
};
function onSceneDrag(id, p) {
  const spec = knobSpecs[id];
  if (spec && knobDrag) {
    const value = clamp(Math.round((knobDrag.value + (p.x - knobDrag.x) * (spec.max - spec.min) / 180) / spec.step) * spec.step, spec.min, spec.max);
    if (spec.object[spec.key] !== value) {
      spec.object[spec.key] = value; spec.control.set(value);
      if (id === 'dF' || id === 'dM') restartDoppler();
    }
  } else if (id === 'hand') str.handTarget = scene.hand(p.x, p.y, str.wave === 'long');
  else if (id === 'probe') str.probeX = Math.round(scene.stringX(p.x, p.y, str, sim) * 20) / 20;
  else if (id === 'probeR' || id === 's1' || id === 's2') {
    const point = scene.horizontalPoint(p.x, p.y, id === 'probeR' ? .77 : .58);
    if (!point) return;
    const w = { x: clamp(point[0] / .065, id === 'probeR' ? -29 : -28, id === 'probeR' ? 29 : 28), y: clamp(-point[2] / .065, id === 'probeR' ? -19 : -18, id === 'probeR' ? 19 : 18) };
    if (id === 'probeR') rip.probe = w;
    else {
      const other = rip[id === 's1' ? 's2' : 's1'];
      if (rip.n === 2) {
        const dx = w.x - other.x, dy = w.y - other.y, distance = Math.hypot(dx, dy);
        if (distance < 2) return;
        const length = Math.round(clamp(distance, 2, 30) * 2) / 2;
        w.x = other.x + dx * length / distance; w.y = other.y + dy * length / distance;
        // A snapped separation must keep both source tips inside the tank.
        if (Math.abs(w.x) > 28 || Math.abs(w.y) > 18) return;
        rip.d = length; rDC.set(length);
      }
      rip[id] = w;
    }
  } else if (id === 'A' || id === 'B') {
    const point = scene.horizontalPoint(p.x, p.y, .81);
    if (!point) return;
    dop[id] = { x: clamp(point[0] / .105, -23, 23), y: clamp(-point[2] / .105, -10, 10) };
  }
  customized(); updateReadouts(); updateStatus(); updateExplain(); graph.render(); stage.render();
}
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id, p) {
    knobDrag = knobSpecs[id] ? { x: p.x, value: knobSpecs[id].object[knobSpecs[id].key] } : null;
    if (id === 'hand' && !loop.running) loop.start();
  },
  move: onSceneDrag,
  end(id) { if (id === 'hand') str.handTarget = 0; knobDrag = null; },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  travel: { mode: "string", title: "Yuguruvchi to‘lqin", lesson: "Chap uchi garmonik tebranadi, to‘lqin o‘ngga yuguradi va «cheksiz» uchda yutiladi. Qizil nuqta faqat yuqori-pastga tebranadi.", set: () => Object.assign(str, { wave: "trans", src: "harm", right: "open", f: 1, A: 4, v: 2, g: 0.02, probeX: 1.5 }) },
  pulseFixed: { mode: "string", title: "Impulsning qaytishi: mahkam uch", lesson: "Impuls devorga yetib, teskari bo‘lib qaytadi. «Impuls yuborish» ni yana bosing.", set: () => Object.assign(str, { wave: "trans", src: "pulse", right: "fixed", A: 6, v: 2, g: 0, probeX: 2 }) },
  pulseFree: { mode: "string", title: "Erkin uchdan qaytish", lesson: "Ip uchi halqa bilan sterjen bo‘ylab erkin sirpanadi — impuls to‘g‘ri (teskari bo‘lmasdan) qaytadi.", set: () => Object.assign(str, { wave: "trans", src: "pulse", right: "free", A: 6, v: 2, g: 0, probeX: 2 }) },
  standing: { mode: "string", title: "Turg‘un to‘lqin (3-garmonika)", lesson: "ν = 3·v/(2L) da kelgan va qaytgan to‘lqinlar turg‘un to‘lqin hosil qiladi: 4 tugun (qizil) va 3 do‘nglik. Chastotani biroz o‘zgartirsangiz, manzara buziladi.", set: () => Object.assign(str, { wave: "trans", src: "harm", right: "fixed", f: 0.75, A: 1, v: 2, g: 0.12, probeX: 2 / 3 }) },
  longw: { mode: "string", title: "Bo‘ylama to‘lqin (prujina)", lesson: "Zarralar to‘lqin yo‘nalishi bo‘ylab tebranadi: siqilish va siyraklanishlar yuguradi. Tovush havoda xuddi shunday tarqaladi.", set: () => Object.assign(str, { wave: "long", src: "harm", right: "open", f: 1, A: 8, v: 2, g: 0.02, probeX: 1.5 }) },
  hand: { mode: "string", title: "Qo‘lda tebratish", lesson: "Chap uchidagi sariq dastakni yuqori-pastga suring — o‘zingiz to‘lqin hosil qiling.", set: () => Object.assign(str, { wave: "trans", src: "hand", right: "fixed", A: 6, v: 2, g: 0.05, probeX: 2 }) },
  one: { mode: "ripple", title: "Bitta manba", lesson: "Nuqtaviy manbadan aylanma to‘lqinlar tarqaladi. Qo‘shni do‘ngliklar orasi — to‘lqin uzunligi λ.", set: () => Object.assign(rip, { n: 1, f: 3, v: 15, s1: { x: 0, y: -4 }, probe: { x: 10, y: 6 } }) },
  two: { mode: "ripple", title: "Ikki manba interferensiyasi", lesson: "Qizil belgini suring: yashil chiziqlarda (Δr = kλ) suv kuchli tebranadi, qizil chiziqlarda (Δr = (2k+1)λ/2) deyarli tinch.", set: () => Object.assign(rip, { n: 2, f: 3, v: 15, d: 14, dphi: 0, s1: { x: -7, y: -12 }, s2: { x: 7, y: -12 }, probe: { x: 6, y: 8 } }), tab: "sum" },
  anti: { mode: "ripple", title: "Qarama-qarshi fazali manbalar", lesson: "Manbalar qarama-qarshi fazada tebranadi: o‘rtadagi chiziqda endi minimum. Maksimumlar o‘rni almashadi.", set: () => Object.assign(rip, { n: 2, f: 3, v: 15, d: 14, dphi: 180, s1: { x: -7, y: -12 }, s2: { x: 7, y: -12 }, probe: { x: 0, y: 8 } }), tab: "amp" },
  dopSlow: { mode: "doppler", title: "Doppler effekti (u = 0,5c)", lesson: "Manba A ga yaqinlashmoqda, B dan uzoqlashmoqda. «Ovozni eshitish» ni bosing — A eshitadigan tovushni tinglang.", set: () => Object.assign(dop, { medium: "air", c: 343, f: 440, M: 0.5, A: { x: 12, y: -4 }, B: { x: -12, y: -4 } }) },
  dopStatic: { mode: "doppler", title: "Qo‘zg‘almas manba", lesson: "Manba tinch: frontlar konsentrik aylanalar, A va B bir xil chastotani eshitadi.", set: () => Object.assign(dop, { medium: "air", c: 343, f: 440, M: 0, A: { x: 12, y: -4 }, B: { x: -12, y: -4 } }) },
  sonic: { mode: "doppler", title: "Tovush to‘sig‘i (u = c)", lesson: "u = c da barcha frontlar manba oldida bir nuqtada to‘planadi — tovush to‘sig‘i.", set: () => Object.assign(dop, { medium: "air", c: 343, f: 300, M: 1, A: { x: 12, y: -4 }, B: { x: -12, y: -4 } }) },
  supersonic: { mode: "doppler", title: "Tovushdan tez: Max konusi", lesson: "u = 1,6c: frontlar konus bo‘ylab to‘planadi. Konus kuzatuvchiga yetguncha u hech narsa eshitmaydi.", set: () => Object.assign(dop, { medium: "air", c: 343, f: 300, M: 1.6, A: { x: 12, y: -6 }, B: { x: -12, y: -6 } }), tab: "p" },
};
const GROUPS = [["Ipdagi to‘lqin", ["travel", "pulseFixed", "pulseFree", "standing", "longw", "hand"]], ["Interferensiya", ["one", "two", "anti"]], ["Tovush va Doppler", ["dopSlow", "dopStatic", "sonic", "supersonic"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  const pr = (attr, val) => document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[`${attr}Value`] === String(val))));
  pr("wtype", str.wave); pr("src", str.src); pr("end", str.right); pr("nsrc", rip.n); pr("medium", dop.medium);
  document.querySelectorAll("[data-sctl]").forEach((el) => { el.hidden = !el.dataset.sctl.split(" ").includes(str.src); });
  document.querySelectorAll("[data-rctl]").forEach((el) => { el.hidden = rip.n !== 2; });
  $("[data-shint]").textContent = str.src === "hand" ? "Chap uchidagi sariq dastakni ko‘ndalang rejimda tik, bo‘ylama rejimda ip bo‘ylab suring." : "Qizil P belgisini surib kuzatish nuqtasini tanlang. ν va A dastaklari chap/o‘ngga suriladi.";
  wFC.set(str.f); wAC.set(str.A); wVC.set(str.v); wGC.set(str.g);
  rFC.set(rip.f); rVC.set(rip.v); rDC.set(rip.d); rPC.set(rip.dphi);
  dFC.set(dop.f); dMC.set(dop.M);
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { string: "P nuqtasi, ν va A dastaklarini suring", ripple: "Manbalar, P belgisi va generator dastaklarini suring", doppler: "Mikrofonlar, ν va M dastaklarini suring" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs(); updateSound();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ string: "travel", ripple: "two", doppler: "dopSlow" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  p.set(); setMode(p.mode);
  if (p.mode === "string") resetString();
  if (p.mode === "ripple") { rip.d = Math.hypot(rip.s2.x - rip.s1.x, rip.s2.y - rip.s1.y); rip.t = 0; rip.t0 = 0; }
  if (p.mode === "doppler") restartDoppler();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[ui.mode][0][0]);
  refresh();
  if (prefersReducedMotion()) loop.stop(); else loop.start();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "travel");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
