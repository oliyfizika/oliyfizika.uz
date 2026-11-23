import { detailedStageHeight } from "./apparatus-3d.js?v=20261122-detail4";
import { createCircuitLab, circuitEnergy } from "./circuit-lab-3d.js?v=20261122-detail4";
import { bindLabCamera } from "./lab-3d.js?v=20261122-detail4";
// ==========================================================================
// Elektromagnit tebranishlar va o'zgaruvchan tok — virtual laboratoriya (simulations/lc.html)
// 1) LC kontur: kalit 1 — kondensator batareyadan zaryadlanadi, kalit 2 — kontur tebranadi (R bilan so'nadi),
//    kondensator maydoni, g'altak maydoni, tok, energiya ustunlari, prujinali mayatnik bilan o'xshashlik.
// 2) O'zgaruvchan tok: R, C, L yoki ketma-ket RLC; vektor (fazor) diagramma, generator dastagi bilan chastota.
// 3) Rezonans: lampa + g'altak + o'zgaruvchan kondensator, radio shkalasi, I(f) lab o'lchovlari.
// Fizika: lc-physics.js (Node'da tekshirilgan). Grafiklar: lc-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./lc-physics.js";
import * as G from "./lc-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BLUE = "#2563eb", RED = "#ef4444", TEAL = "#14b8a6", VIOLET = "#8b5cf6";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "lc", tab: "qi", speed: 0.02, show: { mech: true }, vis: 0 };
const lc = { L: 0.5, C: 200e-6, R: 0, E: 6, sw: 1, q: 0, i: 0, t: 0, heat: 0, hist: [], dots: 0 };
const ac = { el: "R", f: 50, U: 10, R: 100, L: 0.2, C: 20e-6, dots: 0 };
const rs = { f: 120, C: 10e-6, L: 0.1, R: 20, U: 10 * Math.SQRT2, pts: [], dots: 0 };
let presetId = null;

const Tlc = () => P.thomson(lc.L, lc.C);
const qMax = () => lc.C * lc.E;
const iMax = () => qMax() / Math.sqrt(lc.L * lc.C);
function acElems() {
  const e = ac.el;
  return { R: e === "R" || e === "RLC" ? ac.R : 0, L: e === "L" || e === "RLC" ? ac.L : 0, C: e === "C" || e === "RLC" ? ac.C : Infinity };
}
const acState = () => P.acSeries(acElems(), ac.U, ac.f);
const rsState = (f = rs.f) => P.acSeries({ R: rs.R, L: rs.L, C: rs.C }, rs.U, f);

/* ------------------------------------------------------------------ 3D elektr laboratoriyasi */
const scene = createCircuitLab();
function draw(ctx, stage) { scene.draw(ctx, stage, ui, lc, ac, rs); }
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 270, 360)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  lc: [["qi", "q(t), i(t)", "Zaryad va tok", "Tok zaryaddan chorak davr orqada: kondensator to‘liq zaryadlanganda tok nolga teng, zaryadsizlanganda — eng katta."], ["en", "Energiya", "Energiya almashinuvi", "Elektr maydon energiyasi magnit maydon energiyasiga va aksincha aylanadi; R bo‘lsa, energiya issiqlikka o‘tib, tebranish so‘nadi."], ["th", "T(C)", "Tomson formulasi", "Sig‘im 4 marta oshsa, davr 2 marta ortadi: T = 2π√(LC)."]],
  ac: [["ui", "u(t), i(t)", "Kuchlanish va tok", "Aktiv qarshilikda tok va kuchlanish fazada; kondensatorda tok 90° oldinda, g‘altakda 90° orqada."], ["x", "X(f)", "Qarshiliklarning chastotaga bog‘liqligi", "X_L chastota bilan ortadi, X_C kamayadi; ular tenglashganda (rezonans) Z = R."]],
  res: [["i", "I(f)", "Rezonans egri chizig‘i (lab)", "Generator chastotasini o‘zgartirib, tokni o‘lchang va «O‘lchovni yozish» ni bosing. Tok f₀ da eng katta; R kichik bo‘lsa, egri chiziq o‘tkirroq."], ["u", "U_L, U_C", "G‘altak va kondensatordagi kuchlanish", "Rezonansda U_L = U_C va ular manba kuchlanishidan Q marta katta bo‘lishi mumkin."]],
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
  $("[data-meas-tools]").hidden = !(ui.mode === "res" && ui.tab === "i");
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "lc") {
    const span = 3 * Tlc();
    if (ui.tab === "en") return G.drawEnergy(ctx, st, { hist: lc.hist, span, E0: (qMax() * qMax()) / (2 * lc.C) });
    if (ui.tab === "th") return G.drawThomson(ctx, st, { L: lc.L, C: lc.C });
    return G.drawQI(ctx, st, { hist: lc.hist, qm: qMax(), im: iMax(), span });
  }
  if (ui.mode === "ac") {
    if (ui.tab === "x") { const e = acElems(); return G.drawReact(ctx, st, { R: e.R, L: ac.L, C: ac.C, f: ac.f, hasL: e.L > 0, hasC: Number.isFinite(e.C) }); }
    return G.drawUI(ctx, st, { ac: acState(), U: ac.U });
  }
  if (ui.tab === "u") return G.drawULC(ctx, st, { R: rs.R, L: rs.L, C: rs.C, U: rs.U, f: rs.f });
  return G.drawRes(ctx, st, { R: rs.R, L: rs.L, C: rs.C, U: rs.U, f: rs.f, pts: rs.pts });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const REG = { under: "so‘nuvchi tebranish", critical: "kritik (aperiodik chegara)", over: "aperiodik razryad" };
function updateReadouts() {
  if (ui.mode === "lc") {
    const T = Tlc(), en = circuitEnergy(lc), reg = P.regime(lc.R, lc.L, lc.C), Q = P.qualityQ(lc.R, lc.L, lc.C);
    setRO("r1", "Davr <i>T</i>", `${fmt(T * 1000, 1)}<small>ms</small>`, `T = 2π√(LC), ν = ${fmt(1 / T, 1)} Hz`);
    setRO("r2", "Zaryad <i>q</i>", `${fmt(lc.q * 1000, 2)}<small>mC</small>`, `q_max = Cε = ${fmt(qMax() * 1000, 2)} mC`);
    setRO("r3", "Tok <i>i</i>", `${fmt(lc.i * 1000, 0)}<small>mA</small>`, `I_max = q_max/√(LC) = ${fmt(iMax() * 1000, 0)} mA`);
    setRO("r4", "Kondensator kuchlanishi", `${fmt(lc.q / lc.C, 2)}<small>V</small>`, "U = q/C");
    setRO("r5", "Energiya", `${fmt((en.WE + en.WM) * 1000, 2)}<small>mJ</small>`, `issiqlikka: ${fmt(lc.heat * 1000, 2)} mJ`);
    setRO("r6", "Rejim", lc.sw === 1 ? "zaryadlanish" : lc.R === 0 ? "erkin tebranish" : REG[reg], lc.sw === 1 ? "Kalitni 2-holatga buring" : lc.R === 0 ? "So‘nmaydi (R = 0)" : `Aslilik Q = ${fmt(Q, 1)}, R_kr = ${fmt(P.criticalR(lc.L, lc.C), 0)} Om`, lc.sw === 1 ? "muted" : "");
  } else if (ui.mode === "ac") {
    const st = acState(), e = ac.el;
    setRO("r1", e === "R" ? "Qarshilik <i>R</i>" : e === "C" ? "Sig‘im qarshiligi <i>X</i><sub>C</sub>" : e === "L" ? "Induktiv qarshilik <i>X</i><sub>L</sub>" : "To‘la qarshilik <i>Z</i>", `${fmt(e === "R" ? ac.R : e === "C" ? st.XC : e === "L" ? st.XL : st.Z, 1)}<small>Om</small>`, e === "C" ? `1/(2πfC), C = ${fmt(ac.C * 1e6, 0)} mkF` : e === "L" ? `2πfL, L = ${fmt(ac.L * 1000, 0)} mGn` : e === "RLC" ? `X_L = ${fmt(st.XL, 0)}, X_C = ${fmt(st.XC, 0)} Om` : "Chastotaga bog‘liq emas");
    setRO("r2", "Tok <i>I</i><sub>ef</sub>", `${fmt(st.Ief * 1000, 1)}<small>mA</small>`, `I₀ = ${fmt(st.I0 * 1000, 1)} mA`);
    setRO("r3", "Kuchlanish <i>U</i><sub>ef</sub>", `${fmt(st.Uef, 2)}<small>V</small>`, "U_ef = U₀/√2");
    const deg = (st.phi * 180) / Math.PI;
    setRO("r4", "Faza siljishi <i>φ</i>", `${fmt(deg, 0)}°`, Math.abs(deg) < 1 ? "Tok va kuchlanish fazada" : deg > 0 ? "Tok kuchlanishdan orqada" : "Tok kuchlanishdan oldinda");
    setRO("r5", "Quvvat <i>P</i>", `${fmt(st.P * 1000, 1)}<small>mW</small>`, `cos φ = ${fmt(st.cos, 2)}`);
    setRO("r6", "Chastota <i>f</i>", `${fmt(ac.f, 0)}<small>Hz</small>`, e === "RLC" ? `Rezonans f₀ = ${fmt(P.resonanceF(ac.L, ac.C), 0)} Hz` : `ω = ${fmt(st.w, 0)} rad/s`);
  } else {
    const st = rsState(), f0 = P.resonanceF(rs.L, rs.C), Q = P.qualityQ(rs.R, rs.L, rs.C), on = Math.abs(rs.f - f0) / f0 < 0.02;
    setRO("r1", "Rezonans chastota <i>f</i>₀", `${fmt(f0, 1)}<small>Hz</small>`, "f₀ = 1/(2π√(LC))");
    setRO("r2", "Generator <i>f</i>", `${fmt(rs.f, 0)}<small>Hz</small>`, on ? "Rezonans!" : rs.f < f0 ? "f < f₀ — sig‘im qarshiligi ustun" : "f > f₀ — induktiv qarshilik ustun", on ? "" : "muted");
    setRO("r3", "Tok <i>I</i><sub>ef</sub>", `${fmt(st.Ief * 1000, 1)}<small>mA</small>`, `Rezonansda ${fmt((rs.U / Math.SQRT2 / rs.R) * 1000, 0)} mA`);
    setRO("r4", "<i>U</i><sub>L</sub> / <i>U</i><sub>C</sub>", `${fmt(st.UL / Math.SQRT2, 1)} / ${fmt(st.UC / Math.SQRT2, 1)}<small>V</small>`, `Manba ${fmt(rs.U / Math.SQRT2, 1)} V`);
    setRO("r5", "Aslilik <i>Q</i>", fmt(Q, 1), `Δf = ${fmt(P.bandwidth(rs.R, rs.L), 1)} Hz`);
    setRO("r6", "Lampa quvvati", `${fmt(st.P, 2)}<small>W</small>`, `cos φ = ${fmt(st.cos, 2)}`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "lc") { t = lc.sw === 1 ? "Kondensator zaryadlanmoqda" : lc.R === 0 ? "Erkin tebranishlar" : REG[P.regime(lc.R, lc.L, lc.C)]; tone = lc.sw === 1 ? "orange" : "green"; }
  else if (ui.mode === "ac") { const d = (acState().phi * 180) / Math.PI; t = Math.abs(d) < 1 ? "φ = 0" : `φ = ${fmt(d, 0)}°`; }
  else { const f0 = P.resonanceF(rs.L, rs.C), on = Math.abs(rs.f - f0) / f0 < 0.02; t = on ? "Rezonans" : "Rezonansdan tashqarida"; tone = on ? "green" : "blue"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "lc") {
    p.push("<p>Kalit 1-holatda kondensator batareyadan zaryadlanadi va elektr maydon energiyasini to‘playdi. Kalit 2-holatga burilganda kondensator g‘altak orqali zaryadsizlanadi: tok o‘sadi, g‘altakda magnit maydon hosil bo‘ladi. O‘zinduksiya tufayli tok birdan to‘xtamaydi va kondensatorni teskari ishorada qayta zaryadlaydi — <b>elektromagnit tebranishlar</b> boshlanadi.</p>");
    p.push(lc.R > 0 ? `<p>Qarshilik R energiyani issiqlikka aylantiradi — tebranishlar <b>so‘nadi</b>. R ≥ ${fmt(P.criticalR(lc.L, lc.C), 0)} Om bo‘lsa, tebranish umuman bo‘lmaydi (aperiodik razryad).</p>` : "<p>R = 0 bo‘lsa, energiya saqlanadi va tebranishlar so‘nmaydi. Bu prujinali mayatnikka o‘xshaydi: zaryad — siljish, tok — tezlik, L — massa, 1/C — bikrlik.</p>");
  } else if (ui.mode === "ac") {
    const e = ac.el;
    if (e === "R") p.push("<p><b>Aktiv qarshilik</b>da tok va kuchlanish bir fazada o‘zgaradi; elektr energiyasi issiqlikka aylanadi. Qarshilik chastotaga bog‘liq emas.</p>");
    if (e === "C") p.push("<p><b>Kondensator</b> o‘zgaruvchan tokni o‘tkazadi: u har yarim davrda qayta zaryadlanadi. Tok kuchlanishdan chorak davr (90°) <b>oldinda</b>. Chastota oshgan sari sig‘im qarshiligi X_C = 1/(ωC) kamayadi. O‘rtacha quvvat nolga teng.</p>");
    if (e === "L") p.push("<p><b>G‘altak</b>da o‘zinduksiya EYuK tok o‘zgarishiga qarshilik qiladi — tok kuchlanishdan 90° <b>orqada</b>. Induktiv qarshilik X_L = ωL chastota bilan ortadi. O‘rtacha quvvat nolga teng.</p>");
    if (e === "RLC") p.push("<p>Ketma-ket zanjirda tok hamma elementda bir xil, kuchlanishlar esa vektorlar kabi qo‘shiladi: U_L va U_C qarama-qarshi yo‘nalgan. Vektor diagrammada U = U_R + U_L + U_C.</p>");
  } else {
    p.push("<p>Generator chastotasi kontur xususiy chastotasi f₀ ga teng bo‘lganda X_L = X_C, to‘la qarshilik eng kichik (Z = R) va tok eng katta bo‘ladi — <b>rezonans</b>. Lampa eng yorqin yonadi.</p><p>Radiopriyomnikda o‘zgaruvchan kondensator bilan konturning f₀ i kerakli radiostansiya chastotasiga sozlanadi.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "lc" ? "<small>Tomson formulasi</small> T = 2π√(LC)" : ui.mode === "ac" ? "<small>Om qonuni</small> I = U / Z" : "<small>Rezonans</small> f₀ = 1 / (2π√(LC))";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (ui.mode === "lc") {
    const T = Tlc(), simDt = dt * ui.speed, n = Math.max(1, Math.ceil(simDt / (T / 400))), h = simDt / n;
    for (let k = 0; k < n; k++) {
      if (lc.sw === 1) { const q0 = lc.q; lc.q = P.chargeStep(lc.q, h, { C: lc.C, emf: lc.E, r: T / (6 * lc.C) }); lc.i = (lc.q - q0) / h; }
      else { const s = P.rlcStep(lc, h, { L: lc.L, C: lc.C, R: lc.R }); lc.heat += lc.R * ((lc.i * lc.i + s.i * s.i) / 2) * h; lc.q = s.q; lc.i = s.i; }
      lc.t += h;
    }
    lc.dots += (lc.i / iMax()) * dt * 90 * (lc.sw === 2 ? 1 : -1);
    const en = circuitEnergy(lc);
    lc.hist.push({ t: lc.t, q: lc.q, i: lc.i, WE: en.WE, WM: en.WM }); while (lc.hist.length && lc.hist[0].t < lc.t - 3.2 * T) lc.hist.shift();
  } else {
    ui.vis += dt * TAU * 0.35;
    if (ui.mode === "ac") { const st = acState(); ac.dots += Math.sin(ui.vis - st.phi) * dt * 120 * clamp(st.I0 / 0.1, 0.15, 1.5); }
    else { const st = rsState(); rs.dots += Math.sin(ui.vis - st.phi) * dt * 120 * clamp(st.Ief / 0.3, 0.05, 1.5); }
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode === "lc") graph.render(); }
}, {
  onStateChange(on) {
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
    playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  },
});
const playBtn = $("[data-play]");
playBtn.addEventListener("click", () => loop.toggle());

/* ------------------------------------------------------------------ Boshqaruv */

function toggleSwitch() { lc.sw = lc.sw === 1 ? 2 : 1; if (lc.sw === 2) lc.i = 0; customized(); if (!loop.running) loop.start(); refresh(); }
$("[data-switch]").addEventListener("click", toggleSwitch);
const kLC = bindRange($("#kL"), $("#kLOut"), (v) => `${fmt(v, 2)} Gn`, (v) => { lc.L = v; customized(); refresh(); });
const kCC = bindRange($("#kC"), $("#kCOut"), (v) => `${fmt(v, 0)} mkF`, (v) => { lc.C = v * 1e-6; customized(); refresh(); });
const kRC = bindRange($("#kR"), $("#kROut"), (v) => `${fmt(v, 0)} Om`, (v) => { lc.R = v; customized(); refresh(); });
const kEC = bindRange($("#kE"), $("#kEOut"), (v) => `${fmt(v, 1)} V`, (v) => { lc.E = v; customized(); refresh(); });

const aFC = bindRange($("#aF"), $("#aFOut"), (v) => `${fmt(v, 0)} Hz`, (v) => { ac.f = v; customized(); refresh(); });
const aUC = bindRange($("#aU"), $("#aUOut"), (v) => `${fmt(v, 1)} V`, (v) => { ac.U = v; customized(); refresh(); });
const aRC = bindRange($("#aR"), $("#aROut"), (v) => `${fmt(v, 0)} Om`, (v) => { ac.R = v; customized(); refresh(); });
const aLC = bindRange($("#aL"), $("#aLOut"), (v) => `${fmt(v, 0)} mGn`, (v) => { ac.L = v / 1000; customized(); refresh(); });
const aCC = bindRange($("#aC"), $("#aCOut"), (v) => `${fmt(v, 0)} mkF`, (v) => { ac.C = v * 1e-6; customized(); refresh(); });
document.querySelectorAll("[data-el-value]").forEach((b) => b.addEventListener("click", () => { ac.el = b.dataset.elValue; syncAll(); customized(); refresh(); }));

const rFC = bindRange($("#rF"), $("#rFOut"), (v) => `${fmt(v, 0)} Hz`, (v) => { rs.f = v; customized(); refresh(); });
const rCC = bindRange($("#rC"), $("#rCOut"), (v) => `${fmt(v, 1)} mkF`, (v) => { rs.C = v * 1e-6; customized(); refresh(); });
const rLC = bindRange($("#rL"), $("#rLOut"), (v) => `${fmt(v, 0)} mGn`, (v) => { rs.L = v / 1000; customized(); refresh(); });
const rRC = bindRange($("#rR"), $("#rROut"), (v) => `${fmt(v, 0)} Om`, (v) => { rs.R = v; customized(); refresh(); });
$("[data-tune]").addEventListener("click", () => { rs.C = clamp(Math.round(P.capacitanceFor(rs.f, rs.L) * 1e6 * 2) / 2, 2, 60) * 1e-6; rCC.set(rs.C * 1e6); customized(); refresh(); });
$("[data-meas-add]").addEventListener("click", () => { rs.pts.push({ f: rs.f, I: rsState().Ief }); graph.render(); });
$("[data-meas-clear]").addEventListener("click", () => { rs.pts = []; graph.render(); });
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); refresh(); }));

/* Kalit va aylanuvchi dastaklar; bo‘sh joyni sudrash kamerani boshqaradi. */
const canvas = stage.canvas;
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) { if (id === "switch") toggleSwitch(); },
  move(id, pointer) {
    if (id === "switch") return;
    const fraction = scene.dialFraction(pointer.x, pointer.y); if (fraction === null) return;
    if (id === "generator" && ui.mode === "ac") { ac.f = clamp(Math.round(10*Math.pow(100,fraction)/5)*5,10,1000); aFC.set(ac.f); }
    if (id === "capacitor" && ui.mode === "res") { rs.C = clamp(Math.round(2*Math.pow(30,fraction)*2)/2,2,60)*1e-6; rCC.set(rs.C*1e6); }
    customized(); refresh();
  },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  charge: { mode: "lc", title: "Zaryadlash va tebranishlar", lesson: "Kondensator batareyadan zaryadlanmoqda. Zaryadlangach, kalitni bosib 2-holatga o‘tkazing — tebranishlar boshlanadi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 0, E: 6, sw: 1, q: 0, i: 0 }) },
  free: { mode: "lc", title: "Erkin tebranishlar (R = 0)", lesson: "Energiya elektr maydondan magnit maydonga va qaytib o‘tadi, umumiy energiya o‘zgarmaydi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 0, E: 6, sw: 2, q: 200e-6 * 6, i: 0 }), tab: "en" },
  damped: { mode: "lc", title: "So‘nuvchi tebranishlar", lesson: "R = 10 Om: har davrda energiyaning bir qismi issiqlikka aylanadi, amplituda kamayadi, davr deyarli o‘zgarmaydi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 10, E: 6, sw: 2, q: 200e-6 * 6, i: 0 }) },
  aperiodic: { mode: "lc", title: "Aperiodik razryad (katta R)", lesson: "R > 2√(L/C) = 100 Om: kondensator tebranmasdan zaryadsizlanadi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 160, E: 6, sw: 2, q: 200e-6 * 6, i: 0 }) },
  bigC: { mode: "lc", title: "Sig‘imni 4 marta oshirish", lesson: "C = 800 mkF: Tomson formulasi bo‘yicha davr 2 marta ortadi. T(C) grafigiga qarang.", set: () => Object.assign(lc, { L: 0.5, C: 800e-6, R: 0, E: 6, sw: 2, q: 800e-6 * 6, i: 0 }), tab: "th" },
  acR: { mode: "ac", title: "Aktiv qarshilik: φ = 0", lesson: "Tok va kuchlanish vektorlari ustma-ust aylanadi — bir fazada.", set: () => Object.assign(ac, { el: "R", f: 50, U: 10, R: 100 }) },
  acC: { mode: "ac", title: "Kondensator: tok 90° oldinda", lesson: "Generator dastagini yuqoriga surib chastotani oshiring — X_C kamayadi, tok ortadi.", set: () => Object.assign(ac, { el: "C", f: 50, U: 10, C: 20e-6 }) },
  acL: { mode: "ac", title: "G‘altak: tok 90° orqada", lesson: "Chastota oshgan sari X_L = ωL ortadi va tok kamayadi.", set: () => Object.assign(ac, { el: "L", f: 50, U: 10, L: 0.2 }) },
  acRLC: { mode: "ac", title: "Ketma-ket RLC", lesson: "Vektor diagrammada U_R, U_L, U_C qo‘shilib U ni beradi. Chastotani f₀ ≈ 80 Hz ga yaqinlashtiring.", set: () => Object.assign(ac, { el: "RLC", f: 50, U: 10, R: 60, L: 0.2, C: 20e-6 }) },
  res: { mode: "res", title: "Rezonans (lab)", lesson: "Chastotani 40 dan 400 Hz gacha o‘zgartirib, har safar tokni yozing. Rezonans egri chizig‘ini quring.", set: () => Object.assign(rs, { f: 60, C: 10e-6, L: 0.1, R: 20, pts: [] }), tab: "i" },
  radio: { mode: "res", title: "Radio: konturni sozlash", lesson: "Generator — «radiostansiya» (250 Hz). O‘zgaruvchan kondensator dastagini suring va lampani eng yorqin yondiring.", set: () => Object.assign(rs, { f: 250, C: 20e-6, L: 0.1, R: 15, pts: [] }) },
  highQ: { mode: "res", title: "Yuqori aslilik: U_C ≫ U", lesson: "R = 5 Om: rezonansda kondensator va g‘altakdagi kuchlanish manbadan ~20 marta katta.", set: () => Object.assign(rs, { f: 159, C: 10e-6, L: 0.1, R: 5, pts: [] }), tab: "u" },
};
const GROUPS = [["LC kontur", ["charge", "free", "damped", "aperiodic", "bigC"]], ["O‘zgaruvchan tok", ["acR", "acC", "acL", "acRLC"]], ["Rezonans", ["res", "radio", "highQ"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  kLC.set(lc.L); kCC.set(lc.C * 1e6); kRC.set(lc.R); kEC.set(lc.E);
  aFC.set(ac.f); aUC.set(ac.U); aRC.set(ac.R); aLC.set(ac.L * 1000); aCC.set(ac.C * 1e6);
  document.querySelectorAll("[data-el-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.elValue === ac.el)));
  document.querySelectorAll("[data-actl]").forEach((el) => { el.hidden = !el.dataset.actl.split(" ").includes(ac.el); });
  rFC.set(rs.f); rCC.set(rs.C * 1e6); rLC.set(rs.L * 1000); rRC.set(rs.R);
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { lc: "Kalitni bosib buring", ac: "Generator dastagini suring", res: "Kondensator dastagini suring" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ lc: "charge", ac: "acRLC", res: "res" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  p.set(); setMode(p.mode);
  if (p.mode === "lc") { lc.t = 0; lc.heat = 0; lc.hist = []; lc.dots = 0; }
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[ui.mode][0][0]);
  refresh();
  if (!prefersReducedMotion()) loop.start();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "charge");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
