// ==========================================================================
// Molekulyar harakat va ideal gaz — virtual laboratoriya (simulations/gas.html)
// Rejimlar: gaz qonunlari (porshenli idish, izojarayonlar, bosim, Maksvell taqsimoti), diffuziya, Broun harakati.
// Dvigatel: gas-engine.js (2D qattiq disklar, Node'da tekshirilgan). Grafiklar: gas-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as G from "./gas-engine.js";
import { createGasLab } from "./gas-lab-3d.js?v=20261123-batch7c";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch7c";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch7c";
import { drawProcess, drawSpeeds, drawPressureTime, drawMixing, drawProfile, drawMSD, drawBrownX } from "./gas-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
// Also used by the diffusion charts and their readout legends.
const SPECIES = ["#3b82f6", "#f97316"];

/* ------------------------------------------------------------------ Model o'lchamlari */

const GAS_W = 400, GAS_HMAX = 300;          // idish (u); porshen yuqorida
const V_MAX = 2.0;                            // L — porshen eng yuqorida bo'lganda
const NU_PER = 1e-4;                          // har bir model zarrasi — 10⁻⁴ mol
const R_SMALL = 2.2;                          // model zarrasi radiusi (u)
const DIFF_W = 520, DIFF_H = 220;
const BR_W = 480, BR_H = 280;
// Model bosimidan (2D) haqiqiy bosimga (Pa) o'tish koeffitsiyenti: p = C·P₂
const C_P = NU_PER * G.R * (GAS_W * GAS_HMAX) / (V_MAX / 1000) * (300 / G.E0);

const heightOfV = (V) => (V / V_MAX) * GAS_HMAX;           // gaz ustuni balandligi (u)
const VofTop = (top) => ((GAS_HMAX - top) / GAS_HMAX) * V_MAX; // L

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "gas", tab: "process", speed: 1, proc: "T" };
const cfg = { gasA: "N2", gasB: "CO2", N: 150, T: 300, V: 2.0, bigM: 50, bigR: 14, colorSpeed: true, trace: false, hideSmall: false };
let w = null;
const meas = {};
let presetId = null, lastPreset = "pressure";

function resetMeasures() {
  Object.assign(meas, {
    winImp: 0, winT: 0, pInst: 0, pEMA: null, coll0: 0, hits: 0,
    proc: [], pt: [], lastRec: -1, histAcc: new Float64Array(30), histN: 0,
    trace: [], btrace: [], msd: [], mix: [], diffStart: null, pTarget: null,
  });
}

const massOf = (key) => G.GASES[key].M / G.M_REF;

function build() {
  resetMeasures();
  const kT = G.kTof(cfg.T);
  if (ui.mode === "gas") {
    const top = GAS_HMAX - heightOfV(cfg.V);
    w = G.createWorld({ W: GAS_W, H: GAS_HMAX, top });
    G.addParticles(w, cfg.N, { r: R_SMALL, m: massOf(cfg.gasA), kT });
  } else if (ui.mode === "diff") {
    w = G.createWorld({ W: DIFF_W, H: DIFF_H, top: 0 });
    G.addParticles(w, cfg.N, { r: R_SMALL, m: massOf(cfg.gasA), sp: 0, kT, xMax: DIFF_W / 2 });
    G.addParticles(w, cfg.N, { r: R_SMALL, m: massOf(cfg.gasB), sp: 1, kT, xMin: DIFF_W / 2 });
    w.barrier = DIFF_W / 2;
  } else {
    w = G.createWorld({ W: BR_W, H: BR_H, top: 0 });
    G.addParticles(w, cfg.N, { r: R_SMALL, m: 1, kT });
    G.addBig(w, { r: cfg.bigR, m: cfg.bigM, kT });
    meas.b0 = { x: w.x[w.big], y: w.y[w.big] };
  }
}

/* ------------------------------------------------------------------ Simulyatsiya */

const kTnow = () => G.kinetic(w).mean;
const Tnow = () => G.Tof(kTnow());
const nu = () => cfg.N * NU_PER;
const areaGas = () => w.W * (w.H - w.top);
const perimeter = () => 2 * (w.W + (w.H - w.top));

function stepSim(dtReal) {
  let left = dtReal * ui.speed;
  let guard = 0;
  while (left > 1e-9 && guard++ < 60) {
    const dt = Math.min(left, G.safeDt(w));
    left -= dt;
    if (ui.mode === "gas") {
      const kTt = G.kTof(cfg.T);
      G.thermostat(w, kTt, dt, ui.proc === "T" ? 0.25 : 0.6);
      let target = w.top;
      if (ui.proc === "T" || ui.proc === "V") target = GAS_HMAX - heightOfV(cfg.V);
      else {
        if (meas.pTarget === null) meas.pTarget = G.idealP(nu(), cfg.T, cfg.V / 1000);
        const Vt = (nu() * G.R * Tnow()) / meas.pTarget * 1000; // L
        target = GAS_HMAX - heightOfV(clamp(Vt, 0.3, V_MAX));
      }
      G.movePiston(w, clamp(target, 0, GAS_HMAX - 40), 80, dt);
      w.impulse = 0;
      G.step(w, dt);
      meas.winImp += w.impulse; meas.winT += dt;
    } else {
      if (ui.mode === "brown" || w.barrier === null || true) G.thermostat(w, G.kTof(cfg.T), dt, 1.0);
      w.topV = 0;
      G.step(w, dt);
    }
  }
  if (ui.mode === "gas") {
    if (meas.winT >= 0.1) {
      const P2 = meas.winImp / (meas.winT * perimeter());
      meas.pInst = C_P * P2;
      meas.pEMA = meas.pEMA === null ? meas.pInst : meas.pEMA + (meas.pInst - meas.pEMA) * Math.min(1, meas.winT / 1.2);
      meas.pt.push({ t: w.time, p: meas.pInst, pe: meas.pEMA, pid: idealNow() });
      if (meas.pt.length > 400) meas.pt.shift();
      meas.winImp = 0; meas.winT = 0;
    }
    if (w.time - meas.lastRec >= 0.25 && meas.pEMA !== null) {
      meas.lastRec = w.time;
      meas.proc.push({ V: VofTop(w.top), T: Tnow(), p: meas.pEMA });
      if (meas.proc.length > 600) meas.proc.shift();
    }
    if (cfg.trace) { meas.trace.push([w.x[0], w.y[0]]); if (meas.trace.length > 500) meas.trace.shift(); }
  } else if (ui.mode === "diff") {
    if (w.barrier === null && w.time - meas.lastRec >= 0.1) {
      meas.lastRec = w.time;
      meas.mix.push({ t: w.time - meas.diffStart, a: mixFrac(0), b: mixFrac(1) });
      if (meas.mix.length > 1200) meas.mix = meas.mix.filter((_, k) => k % 2 === 0);
    }
  } else {
    if (w.time - meas.lastRec >= 0.05) {
      meas.lastRec = w.time;
      meas.btrace.push([w.x[w.big], w.y[w.big], w.time]);
      if (meas.btrace.length > 3000) meas.btrace.shift();
    }
  }
  // tezliklar gistogrammasi (sekin so'nadigan yig'indi)
  const vmax = histVmax();
  const h = G.speedHistogram(w, meas.histAcc.length, vmax);
  for (let k = 0; k < h.length; k++) meas.histAcc[k] = meas.histAcc[k] * 0.97 + h[k];
  meas.histN = meas.histN * 0.97 + G.count(w) - (w.big >= 0 ? 1 : 0);
}

function idealNow() { return G.idealP(nu(), Tnow(), VofTop(w.top) / 1000); }
function mixFrac(sp) {
  let n = 0, k = 0;
  for (let i = 0; i < w.x.length; i++) { if (w.sp[i] !== sp) continue; n++; if (sp === 0 ? w.x[i] > w.W / 2 : w.x[i] < w.W / 2) k++; }
  return n ? (2 * k) / n : 0;
}
/** Model tezligi → haqiqiy (m/s): v_kv modelda √(2kT/m) ↔ haqiqiyda √(3RT/M). */
const realFactor = (key) => G.vRms3D(Tnow(), G.GASES[key].M) / Math.sqrt((2 * kTnow()) / massOf(key));
const histVmax = () => 3.2 * Math.sqrt((2 * G.kTof(Math.max(cfg.T, 50))) / (ui.mode === "brown" ? 1 : Math.min(massOf(cfg.gasA), ui.mode === "diff" ? massOf(cfg.gasB) : 99)));

/* ------------------------------------------------------------------ Chizish */

const scene=createGasLab();
function draw(ctx,st) {
  if(!w)return;
  const pMax=Math.max(50,Math.ceil(G.idealP(nu(),800,.0006)/1000/50)*50)*1000;
  scene.draw(ctx,st,ui,cfg,w,meas,{T:Tnow(),V:VofTop(w.top),p:meas.pEMA??idealNow(),pMax});
}
const heights=()=>({graph:Math.round(clamp(innerHeight*.26,170,240))});
const stage=createStage($("#stage"),draw,{height:detailedStageHeight});

/* ------------------------------------------------------------------ Grafiklar */

const PROC_TITLE = { T: "Izoterma p(V): pV = const", p: "Izobara V(T): V/T = const", V: "Izoxora p(T): p/T = const" };
const TABS = {
  gas: [
    ["process", "Jarayon", () => PROC_TITLE[ui.proc], "Nuqtalar — o‘lchangan qiymatlar, chiziq — ideal gaz qonuni. Izobara va izoxora davomi absolyut nol (0 K) ga boradi."],
    ["speeds", "Tezliklar", () => "Molekulalar tezliklari taqsimoti (Maksvell)", "Ustunlar — idishdagi molekulalar tezliklari (haqiqiy m/s ga o‘tkazilgan), chiziq — nazariy taqsimot. Temperatura ortsa, taqsimot o‘ngga siljiydi va yoyiladi."],
    ["ptime", "Bosim p(τ)", () => "Bosim vaqt bo‘yicha", "Bosim — molekulalarning devorga urilishlari natijasi. Har bir 0,1 s dagi qiymat tebranadi (fluktuatsiya), o‘rtachasi esa ideal gaz qonuniga mos."],
  ],
  diff: [
    ["mix", "Aralashish", () => "Aralashish darajasi", "100% — gazlar butunlay aralashdi (har bir yarmida teng ulush). Molekulalar tezroq harakatlansa (yengil gaz yoki yuqori temperatura), aralashish tezroq boradi."],
    ["profile", "Konsentratsiya", () => "Idish bo‘ylab konsentratsiya", "Har bir bo‘lakdagi birinchi gaz ulushi. To‘siq olingach chegaradagi keskin sakrash asta tekislanadi."],
  ],
  brown: [
    ["msd", "⟨r²⟩(τ)", () => "Siljish kvadratining o‘rtachasi", "Broun zarrasining siljishi kvadrati vaqtga proporsional o‘sadi: ⟨r²⟩ = 4Dτ (tekislikda). Zarra og‘irroq yoki kattaroq bo‘lsa, sekinroq siljiydi."],
    ["bx", "x(τ)", () => "Broun zarrasi koordinatasi", "Zarra koordinatasi tasodifiy o‘zgaradi — tartibsiz zarbalar natijasi."],
  ],
};
function setupTabs() {
  const boxEl = $("[data-tabs]");
  boxEl.innerHTML = TABS[ui.mode].map(([id, label]) => `<button type="button" data-tab-value="${id}">${label}</button>`).join("");
  boxEl.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]();
  $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function speedData() {
  const key = ui.mode === "brown" ? "N2" : cfg.gasA;
  const f = realFactor(key);
  const vmax = histVmax();
  const bins = meas.histAcc.length;
  // gistogrammani faqat 1-tur zarralar bo'yicha ko'rsatamiz (diffuziyada ikkala gaz aralash)
  return { hist: Array.from(meas.histAcc), n: meas.histN, vmaxReal: vmax * (ui.mode === "gas" ? f : f), bins, vRms: G.vRms3D(Tnow(), G.GASES[key].M), vMean: G.vMean3D(Tnow(), G.GASES[key].M), vProb: G.vProb3D(Tnow(), G.GASES[key].M), name: G.GASES[key].name };
}
function msdData() {
  const tr = meas.btrace;
  const n = tr.length;
  const out = [];
  if (n < 20) return { pts: out, D: null };
  const maxLag = Math.floor(n / 3), stepL = Math.max(1, Math.floor(maxLag / 40));
  for (let L = stepL; L <= maxLag; L += stepL) {
    let s = 0, c = 0;
    for (let i = 0; i + L < n; i += Math.max(1, Math.floor(L / 4))) { const dx = tr[i + L][0] - tr[i][0], dy = tr[i + L][1] - tr[i][1]; s += dx * dx + dy * dy; c++; }
    out.push({ t: tr[L][2] - tr[0][2], r2: s / c });
  }
  let sxy = 0, sxx = 0; out.forEach((p) => { sxy += p.t * p.r2; sxx += p.t * p.t; });
  const k = sxx > 0 ? sxy / sxx : 0;
  return { pts: out, D: k / 4 };
}
function drawGraphCanvas(ctx, st) {
  if (!w) return;
  if (ui.mode === "gas") {
    if (ui.tab === "speeds") drawSpeeds(ctx, st, speedData());
    else if (ui.tab === "ptime") drawPressureTime(ctx, st, { pt: meas.pt });
    else drawProcess(ctx, st, { proc: ui.proc, pts: meas.proc, nuR: nu() * G.R, Tset: cfg.T, Vset: cfg.V, pTarget: meas.pTarget, cur: { V: VofTop(w.top), T: Tnow(), p: meas.pEMA ?? idealNow() } });
  } else if (ui.mode === "diff") {
    if (ui.tab === "profile") {
      const bins = 12, a = new Array(bins).fill(0), all = new Array(bins).fill(0);
      for (let i = 0; i < w.x.length; i++) { const k = clamp(Math.floor((w.x[i] / w.W) * bins), 0, bins - 1); all[k]++; if (w.sp[i] === 0) a[k]++; }
      drawProfile(ctx, st, { frac: a.map((v, k) => (all[k] ? v / all[k] : 0)), colors: SPECIES });
    } else drawMixing(ctx, st, { mix: meas.mix, colors: SPECIES, names: [G.GASES[cfg.gasA].name, G.GASES[cfg.gasB].name], barrier: w.barrier !== null });
  } else {
    if (ui.tab === "bx") drawBrownX(ctx, st, { tr: meas.btrace, x0: meas.b0.x, unit: 2 * cfg.bigR });
    else drawMSD(ctx, st, { ...msdData(), unit: 2 * cfg.bigR });
  }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label;
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
  el.dataset.tone = tone || "";
}
const sup = (n) => String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);
function sciHtml(v, digits = 2) {
  if (!Number.isFinite(v) || v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v))), m = v / 10 ** e;
  return `${fmt(m, digits)}·10<sup>${e}</sup>`;
}

function updateReadouts() {
  if (ui.mode === "gas") {
    const T = Tnow(), V = VofTop(w.top), p = meas.pEMA ?? idealNow(), pid = idealNow();
    setRO("r1", "Bosim <i>p</i> (manometr)", `${fmt(p / 1000, 1)}<small>kPa</small>`, `Nazariy νRT/V = ${fmt(pid / 1000, 1)} kPa`);
    const n = (nu() * G.N_A) / (V / 1000);
    setRO("r2", "Hajm <i>V</i>", `${fmt(V, 2)}<small>L</small>`, `Konsentratsiya n = ${sci(n, 3)} m⁻³`);
    setRO("r3", "Temperatura <i>T</i>", `${fmt(T, 0)}<small>K</small>`, `${fmt(T - 273, 0)} °C · termostat ${fmt(cfg.T, 0)} K`);
    setRO("r4", "Modda miqdori <i>ν</i>", `${fmt(nu(), 3)}<small>mol</small>`, `N = νN_A = ${sci(nu() * G.N_A, 3)} molekula`);
    setRO("r5", "O‘rtacha kvadratik tezlik", `${fmt(G.vRms3D(T, G.GASES[cfg.gasA].M), 0)}<small>m/s</small>`, `v_kv = √(3RT/M), M = ${G.GASES[cfg.gasA].M} g/mol`);
    const inv = ui.proc === "T" ? [`pV`, `${fmt(p * V / 1000, 1)}<small>J</small>`] : ui.proc === "p" ? [`V/T`, `${fmt((V / T) * 1000, 2)}<small>mL/K</small>`] : [`p/T`, `${fmt(p / T, 1)}<small>Pa/K</small>`];
    setRO("r6", `${inv[0]} (o‘zgarmas)`, inv[1], `Ē = 3/2 kT = ${sci(G.meanKE3D(T), 3)} J`);
  } else if (ui.mode === "diff") {
    const last = meas.mix[meas.mix.length - 1];
    const mixP = last ? (100 * (last.a + last.b)) / 2 : 0;
    setRO("r1", "Aralashish darajasi", `${fmt(mixP, 0)}<small>%</small>`, w.barrier !== null ? "To‘siq hali olinmagan" : "Har bir yarmida ikkala gaz ulushi");
    setRO("r2", "Vaqt <i>τ</i>", meas.diffStart === null ? "0<small>s</small>" : `${fmt(w.time - meas.diffStart, 1)}<small>s</small>`, "Model vaqti (to‘siq olingandan)");
    setRO("r3", "Temperatura <i>T</i>", `${fmt(Tnow(), 0)}<small>K</small>`, `${fmt(Tnow() - 273, 0)} °C`);
    setRO("r4", `<span style="color:${SPECIES[0]}">●</span> v<sub>kv</sub> (${G.GASES[cfg.gasA].name.split(" ")[0]})`, `${fmt(G.vRms3D(Tnow(), G.GASES[cfg.gasA].M), 0)}<small>m/s</small>`, `M = ${G.GASES[cfg.gasA].M} g/mol`);
    setRO("r5", `<span style="color:${SPECIES[1]}">●</span> v<sub>kv</sub> (${G.GASES[cfg.gasB].name.split(" ")[0]})`, `${fmt(G.vRms3D(Tnow(), G.GASES[cfg.gasB].M), 0)}<small>m/s</small>`, `M = ${G.GASES[cfg.gasB].M} g/mol`);
    const ratio = Math.sqrt(G.GASES[cfg.gasB].M / G.GASES[cfg.gasA].M);
    setRO("r6", "Tezliklar nisbati", `${fmt(ratio, 2)}`, "v₁/v₂ = √(M₂/M₁)");
  } else {
    const b = w.big, dx = w.x[b] - meas.b0.x, dy = w.y[b] - meas.b0.y, d = 2 * cfg.bigR;
    const { D } = msdData();
    setRO("r1", "Siljish <i>r</i>", `${fmt(Math.hypot(dx, dy) / d, 2)}<small>d</small>`, "Boshlang‘ich nuqtadan (d — zarra diametri)");
    setRO("r2", "Vaqt <i>τ</i>", `${fmt(w.time, 1)}<small>s</small>`, "Model vaqti");
    setRO("r3", "Temperatura <i>T</i>", `${fmt(Tnow(), 0)}<small>K</small>`, `${fmt(Tnow() - 273, 0)} °C`);
    const vb = Math.hypot(w.vx[b], w.vy[b]), vs = Math.sqrt(2 * kTnow());
    setRO("r4", "Zarra tezligi / molekula tezligi", `${fmt(vb / vs, 2)}`, `Nazariy √(m/M) = ${fmt(Math.sqrt(1 / cfg.bigM), 2)}`);
    setRO("r5", "Diffuziya koeffitsiyenti <i>D</i>", D ? `${fmt(D / (d * d), 3)}<small>d²/s</small>` : "—", "⟨r²⟩ = 4Dτ dan");
    setRO("r6", "Massalar nisbati <i>M/m</i>", `${fmt(cfg.bigM, 0)}`, `Zarra diametri ${fmt(d / (2 * R_SMALL), 1)} marta katta`);
  }
}

function updateStatus() {
  const el = $("[data-status]");
  let text = "", tone = "blue";
  if (ui.mode === "gas") {
    const d = cfg.T - Tnow();
    const dv = Math.abs(VofTop(w.top) - (ui.proc === "p" ? VofTop(w.top) : cfg.V));
    if (d > 5) { text = "Isitilmoqda"; tone = "orange"; }
    else if (d < -5) { text = "Sovitilmoqda"; tone = "blue"; }
    else if (dv > 0.02 || Math.abs(w.topV) > 1) { text = w.topV > 0 ? "Siqilmoqda" : "Kengaymoqda"; tone = "purple"; }
    else { text = "Muvozanat holat"; tone = "green"; }
  } else if (ui.mode === "diff") { text = w.barrier !== null ? "To‘siq bor" : "Diffuziya"; tone = w.barrier !== null ? "blue" : "orange"; }
  else { text = "Broun harakati"; tone = "orange"; }
  el.textContent = text; el.dataset.tone = tone;
}

let lastExplain = "";
function updateExplain() {
  const parts = [];
  if (ui.mode === "gas") {
    parts.push("<p>Idishdagi har bir nuqta — gaz molekulasi. Ular tartibsiz harakatlanib, bir-biri va devorlar bilan to‘qnashadi. <b>Bosim</b> — molekulalarning devorga urilishlari natijasi: urilishlar qancha ko‘p va kuchli bo‘lsa, bosim shuncha katta.</p>");
    if (ui.proc === "T") parts.push("<p><b>Izotermik jarayon</b> (T = const, Boyl–Mariott qonuni): hajm kamaysa, molekulalar devorga tez-tez urilad — bosim ortadi, pV o‘zgarmaydi. Siqishda gaz ustida ish bajariladi, termostat ortiqcha issiqlikni oladi.</p>");
    if (ui.proc === "p") parts.push("<p><b>Izobarik jarayon</b> (p = const, Gey-Lyussak qonuni): porshen ustidagi yuk o‘zgarmaydi. Gaz isitilsa molekulalar tezlashadi va porshenni ko‘taradi — hajm temperaturaga proporsional ortadi.</p>");
    if (ui.proc === "V") parts.push("<p><b>Izoxorik jarayon</b> (V = const, Sharl qonuni): porshen mahkamlangan. Gaz isitilsa molekulalar devorga kuchliroq va tez-tez urilad — bosim temperaturaga proporsional ortadi.</p>");
    if (VofTop(w.top) < 0.9) parts.push("<p>Kichik hajmda manometr ko‘rsatishi nazariydan biroz katta: modelda molekulalar o‘lchamga ega (real gazdagi kabi), ular egallagan joy hisobiga erkin hajm kamayadi.</p>");
  } else if (ui.mode === "diff") {
    parts.push(`<p><b>Diffuziya</b> — moddalarning molekulalar issiqlik harakati tufayli o‘z-o‘zidan aralashib ketishi. ${w.barrier !== null ? "To‘siqni oling va kuzating." : "To‘siq olindi: molekulalar to‘qnashib-to‘qnashib, asta-sekin butun idishga tarqalmoqda."}</p>`);
    parts.push("<p>Molekulalar juda tez harakatlansa ham (yuzlab m/s), diffuziya sekin boradi: har bir molekula boshqalar bilan to‘xtovsiz to‘qnashib, yo‘nalishini o‘zgartiradi.</p>");
  } else {
    parts.push("<p><b>Broun harakati</b> — suyuqlik yoki gazdagi mayda (mikroskopda ko‘rinadigan) zarraning tartibsiz harakati. Uni ko‘rinmas molekulalarning har tomondan bir tekis bo‘lmagan zarbalari keltirib chiqaradi — bu molekulalar mavjudligi va harakatining isboti.</p>");
    parts.push("<p>Zarra qancha og‘ir va katta bo‘lsa, shuncha sekin siljiydi; temperatura ortsa — tezroq.</p>");
  }
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const f = $("[data-formula]");
  const html = ui.mode === "gas" ? { T: "<small>Boyl–Mariott</small> pV = const", p: "<small>Gey-Lyussak</small> V/T = const", V: "<small>Sharl</small> p/T = const" }[ui.proc]
    : ui.mode === "diff" ? "<small>Diffuziya</small> v<sub>kv</sub> = √(3RT/M)" : "<small>Broun harakati</small> ⟨r²⟩ ∝ t";
  if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); }

/* ------------------------------------------------------------------ Boshqaruv */

const gasA = $("#gasA"), gasB = $("#gasB");
Object.entries(G.GASES).forEach(([k, g]) => { gasA.insertAdjacentHTML("beforeend", `<option value="${k}">${g.name}, M = ${g.M} g/mol</option>`); gasB.insertAdjacentHTML("beforeend", `<option value="${k}">${g.name}, M = ${g.M} g/mol</option>`); });
const nCtl = bindRange($("#nP"), $("#nPOut"), (v) => `${fmt(v, 0)}`, (v) => { cfg.N = v; customized(); rebuild(); });
const tCtl = bindRange($("#tK"), $("#tKOut"), (v) => `${fmt(v, 0)} K (${fmt(v - 273, 0)} °C)`, (v) => { cfg.T = v; customized(); refresh(); });
const vCtl = bindRange($("#vL"), $("#vLOut"), (v) => `${fmt(v, 2)} L`, (v) => { cfg.V = v; customized(); refresh(); });
const mCtl = bindRange($("#bigM"), $("#bigMOut"), (v) => `${fmt(v, 0)} m`, (v) => { cfg.bigM = v; customized(); rebuild(); });
const rCtl = bindRange($("#bigR"), $("#bigROut"), (v) => `${fmt(v / R_SMALL, 1)} r`, (v) => { cfg.bigR = v; customized(); rebuild(); });
gasA.addEventListener("change", () => { cfg.gasA = gasA.value; customized(); rebuild(); });
gasB.addEventListener("change", () => { cfg.gasB = gasB.value; customized(); rebuild(); });
document.querySelectorAll("[data-proc-value]").forEach((b) => b.addEventListener("click", () => { setProc(b.dataset.procValue); customized(); }));
$("[data-color-speed]").addEventListener("change", (e) => { cfg.colorSpeed = e.target.checked; stage.render(); });
$("[data-trace]").addEventListener("change", (e) => { cfg.trace = e.target.checked; meas.trace = []; stage.render(); });
$("[data-hide-small]").addEventListener("change", (e) => { cfg.hideSmall = e.target.checked; stage.render(); });
function resetBrownTrace() {
  meas.btrace=[];meas.b0={x:w.x[w.big],y:w.y[w.big]};w.time=0;meas.lastRec=-1;
}
$("[data-clear-trace]").addEventListener("click", () => { resetBrownTrace(); stage.render(); graph.render(); });
function toggleBarrier() {
  if (w.barrier !== null) { w.barrier = null; meas.diffStart = w.time; meas.mix = [{ t: 0, a: mixFrac(0), b: mixFrac(1) }]; meas.lastRec = w.time; }
  else rebuild();
  syncCtl(); refresh(); stage.render(); graph.render();
}
$("[data-barrier]").addEventListener("click",toggleBarrier);

const PROC_NOTE = { T: "Termostat temperaturani o‘zgarmas saqlaydi. Hajmni o‘zgartiring.", p: "Porshen ustida o‘zgarmas yuk. Temperaturani o‘zgartiring — hajm o‘zi o‘zgaradi.", V: "Porshen mahkamlangan. Temperaturani o‘zgartiring." };
function setProc(p) {
  ui.proc = p; meas.proc = []; meas.pTarget = null;
  if (p === "p") meas.pTarget = G.idealP(nu(), Tnow(), VofTop(w.top) / 1000);
  cfg.V = clamp(Math.round(VofTop(w.top) / 0.05) * 0.05, 0.6, 2);
  syncCtl(); setTab(ui.tab); refresh();
}

function syncCtl() {
  const m = ui.mode;
  document.querySelectorAll("[data-ctl]").forEach((el) => {
    const keys = el.dataset.ctl.split(" ");
    el.hidden = !(keys.includes(m) || (m === "diff" && keys.includes("diff-a")));
  });
  $("[data-gas-a-label]").textContent = m === "diff" ? "Birinchi gaz (chapda)" : "Gaz";
  $("[data-n-label]").textContent = m === "diff" ? "Har bir gaz molekulalari soni" : m === "brown" ? "Mayda molekulalar soni" : "Molekulalar soni (modelda) N";
  const nI = $("#nP"); nI.max = m === "diff" ? 140 : m === "brown" ? 320 : 250; nI.min = m === "diff" ? 40 : 40;
  cfg.N = clamp(cfg.N, Number(nI.min), Number(nI.max));
  gasA.value = cfg.gasA; gasB.value = cfg.gasB;
  nCtl.set(cfg.N); tCtl.set(cfg.T); vCtl.set(cfg.V); mCtl.set(cfg.bigM); rCtl.set(cfg.bigR);
  $("#vL").disabled = ui.proc === "p";
  document.querySelectorAll("[data-proc-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.procValue === ui.proc)));
  $("[data-proc-note]").textContent = PROC_NOTE[ui.proc];
  $("[data-barrier]").textContent = w && w.barrier === null ? "To‘siqni qaytarish (qaytadan)" : "To‘siqni olish";
  $("[data-color-speed]").checked = cfg.colorSpeed; $("[data-trace]").checked = cfg.trace; $("[data-hide-small]").checked = cfg.hideSmall;
}

/* Uch o‘lchamli moslamadagi dastaklar. Porshen tutqichi maqsad hajmini belgilaydi. */
const knobSpecs={
  temp:{key:'T',min:100,max:800,step:10,control:tCtl},
  count:{key:'N',min:40,max:()=>ui.mode==='diff'?140:ui.mode==='brown'?320:250,step:10,control:nCtl},
  mass:{key:'bigM',min:10,max:200,step:10,control:mCtl},
  radius:{key:'bigR',min:8,max:24,step:1,control:rCtl},
};
let sceneDrag=null;
bindLabCamera(stage.canvas,scene.lab,()=>stage.render(),{
  start(id,p){
    if(id==='barrier'){toggleBarrier();return;}
    const spec=knobSpecs[id];
    sceneDrag={id,x:p.x,value:spec?cfg[spec.key]:0,wasRunning:loop.running};
    if(id==='brown')loop.stop();
  },
  move(id,p){
    if(!sceneDrag||sceneDrag.id!==id)return;
    const spec=knobSpecs[id];
    if(spec){
      const max=typeof spec.max==='function'?spec.max():spec.max;
      const v=clamp(Math.round((sceneDrag.value+(p.x-sceneDrag.x)*(max-spec.min)/180)/spec.step)*spec.step,spec.min,max);
      if(cfg[spec.key]!==v){cfg[spec.key]=v;spec.control.set(v);if(id!=='temp')rebuild();}
    }else if(id==='piston'&&ui.proc!=='p'){
      cfg.V=clamp(Math.round(scene.volume(p)*20)/20,.6,2);vCtl.set(cfg.V);
    }else if(id==='brown'&&w.big>=0){
      const q=scene.modelPoint(p);if(!q)return;const b=w.big,r=w.r[b];
      w.x[b]=clamp(q.x,r,w.W-r);w.y[b]=clamp(q.y,w.top+r,w.H-r);w.vx[b]=0;w.vy[b]=0;
      resetBrownTrace();
    }
    customized();refresh();graph.render();
  },
  end(id){const resume=id==='brown'&&sceneDrag?.wasRunning;sceneDrag=null;if(resume)loop.start();refresh();},
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  pressure: { mode: "gas", title: "Gaz bosimi qayerdan keladi", lesson: "Molekulalar devorga urilib, unga kuch bilan ta’sir qiladi — bu bosim. «Sekin» rejimda alohida urilishlarni kuzating; «Bosim p(τ)» grafigida bosim tebranib turadi.", set: () => Object.assign(cfg, { gasA: "N2", N: 120, T: 300, V: 2, colorSpeed: true, trace: true }), proc: "V", tab: "ptime" },
  boyle: { mode: "gas", title: "Boyl–Mariott qonuni (izotermik)", lesson: "Temperatura o‘zgarmas. Hajmni 2 L dan 0,6 L gacha kamaytiring — bosim shuncha marta ortadi, pV o‘zgarmaydi. Grafikda nuqtalar giperbolaga tushadi.", set: () => Object.assign(cfg, { gasA: "N2", N: 150, T: 300, V: 2, trace: false }), proc: "T", tab: "process" },
  gaylussac: { mode: "gas", title: "Gey-Lyussak qonuni (izobarik)", lesson: "Bosim o‘zgarmas (porshen ustida yuk). Temperaturani 300 K dan 600 K gacha oshiring — hajm 0,8 L dan 1,6 L gacha (ikki marta) ortadi. V(T) to‘g‘ri chizig‘i davomi 0 K ga boradi.", set: () => Object.assign(cfg, { gasA: "N2", N: 150, T: 300, V: 0.8, trace: false }), proc: "p", tab: "process" },
  charles: { mode: "gas", title: "Sharl qonuni (izoxorik)", lesson: "Hajm o‘zgarmas. Gazni isiting yoki sovuting — bosim temperaturaga proporsional o‘zgaradi: p/T = const.", set: () => Object.assign(cfg, { gasA: "N2", N: 150, T: 300, V: 1.2, trace: false }), proc: "V", tab: "process" },
  maxwell: { mode: "gas", title: "Molekulalar tezliklari (Maksvell)", lesson: "Molekulalar har xil tezlikda harakatlanadi: ko‘pchiligi o‘rtacha tezlik atrofida, juda sekin va juda tezlari kam. Temperaturani o‘zgartiring yoki gazni almashtiring (vodorod — yengil, tez).", set: () => Object.assign(cfg, { gasA: "N2", N: 250, T: 300, V: 2, colorSpeed: true, trace: false }), proc: "V", tab: "speeds" },
  diffusion: { mode: "diff", title: "Gazlar diffuziyasi", lesson: "Chapda azot, o‘ngda karbonat angidrid. «To‘siqni olish» tugmasini bosing — gazlar o‘z-o‘zidan aralashadi.", set: () => Object.assign(cfg, { gasA: "N2", gasB: "CO2", N: 110, T: 300 }), tab: "mix" },
  diffT: { mode: "diff", title: "Diffuziya va temperatura", lesson: "Xuddi shu gazlar yuqori temperaturada (700 K): molekulalar tezroq harakatlanadi — aralashish tezroq boradi. Avvalgi tajriba bilan solishtiring.", set: () => Object.assign(cfg, { gasA: "N2", gasB: "CO2", N: 110, T: 700 }), tab: "mix" },
  diffLight: { mode: "diff", title: "Yengil va og‘ir gaz", lesson: "Geliy (M = 4) molekulalari argonnikidan (M = 40) √10 ≈ 3,2 marta tez harakatlanadi. Aralashish azot–karbonat angidrid juftligiga qaraganda tezroq boradi — solishtiring.", set: () => Object.assign(cfg, { gasA: "He", gasB: "Ar", N: 110, T: 300 }), tab: "mix" },
  brown: { mode: "brown", title: "Broun harakati", lesson: "Katta zarra (masalan, suvdagi gul changi) atrofidagi molekulalar zarbidan tartibsiz harakatlanadi. «Mayda molekulalarni yashirish» ni yoqing — mikroskopda xuddi shunday ko‘rinadi.", set: () => Object.assign(cfg, { N: 260, T: 300, bigM: 50, bigR: 14, hideSmall: false }), tab: "msd" },
  brownHeavy: { mode: "brown", title: "Broun: og‘ir zarra", lesson: "Zarra massasini oshiring — u sekinroq siljiydi, diffuziya koeffitsiyenti kamayadi. Temperaturani oshirsangiz harakat jadallashadi.", set: () => Object.assign(cfg, { N: 260, T: 300, bigM: 200, bigR: 20, hideSmall: true }), tab: "msd" },
};
const GROUPS = [["Gaz qonunlari", ["pressure", "boyle", "gaylussac", "charles", "maxwell"]], ["Diffuziya", ["diffusion", "diffT", "diffLight"]], ["Broun harakati", ["brown", "brownHeavy"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function loadPreset(id) {
  const p = PRESETS[id];
  p.set();
  if (p.proc) ui.proc = p.proc;
  setMode(p.mode, true);
  presetId = id; lastPreset = id;
  setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  rebuild();
  if (p.proc) setProc(p.proc);
  setTab(p.tab);
  if(prefersReducedMotion())loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const MODE_HINT = { gas: "Porshenli idishdagi gaz: hajm, temperatura va bosim", diff: "Ikki gaz to‘siq bilan ajratilgan — to‘siqni oling", brown: "Katta zarra mayda molekulalar zarbidan harakatlanadi" };
function setMode(mode, keep = false) {
  ui.mode = mode;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === mode)));
  $("[data-mode-hint]").textContent = MODE_HINT[mode];
  setupTabs();
  if (!keep) customized();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.modeValue === ui.mode) return;
  loadPreset({ gas: "boyle", diff: "diffusion", brown: "brown" }[b.dataset.modeValue]);
}));

function rebuild() {
  build();
  syncCtl(); setTab(ui.tab); refresh(); stage.render(); graph.render();
}

/* ------------------------------------------------------------------ Ishga tushirish */

document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = Number(b.dataset.speedValue);
  document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));
const playBtn = $("[data-play]");
function syncPlay(running) {
  playBtn.setAttribute("aria-pressed",String(running));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : "Davom ettirish";
}
let uiTimer = 0;
const loop = createLoop((dt) => {
  if (w) stepSim(dt);
  uiTimer += dt;
  if (uiTimer > 0.15) { uiTimer = 0; refresh(); graph.render(); }
  stage.render();
}, { onStateChange: syncPlay });
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));
$("[data-reset]").addEventListener("click", () => { if (presetId) loadPreset(presetId); else { rebuild(); if (ui.mode === "gas") setProc(ui.proc); } });
void lastPreset;

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "pressure");
if (!prefersReducedMotion()) loop.start(); else { syncPlay(false); stage.render(); }
void sup; void sciHtml;
