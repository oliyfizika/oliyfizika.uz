// ==========================================================================
// Metallarda elektr toki — simulyatsiya (simulations/metals.html)
// 1) Elektronlar harakati: zanjir (manba, kalit, reostat, ampermetr) va sim ichining kattalashtirilgan ko'rinishi —
//    ionlar panjarasi, elektronlarning tartibsiz harakati va maydon ta'siridagi tartibli (dreyf) harakati. v = I/(enS).
// 2) Tok zichligi: kesimi har xil sim; I hamma kesimda bir xil, j = I/S va v ingichka joyda katta.
//    Kesim tekisligi (hisoblagich) sahnada suriladi.
// 3) Qarshilik va temperatura: pechdagi sim o'rami, termometr va ommetr; R = R₀(1 + αt); simobning o'ta o'tkazuvchanligi.
// Fizika: metals-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./metals-physics.js";
import { drawDrift, drawDensity, drawRT, lastFrame } from "./metals-plots.js";
import { createMetalsLab } from "./metals-lab-3d.js?v=20261123-batch8c";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch8c";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch8c";
const scene=createMetalsLab();
let modelTime=0;

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const MONO = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
const R20 = 10;       // R(t) tajribasida har bir o'ram 20 °C da 10 Ω bo'ladigan qilib tanlangan
const T_MIN = -100;   // °C
const SC_MIN = 3, SC_MAX = 6; // simob, K
const WIRE_L = 30;    // tok zichligi rejimida sim uzunligi, cm
const DRIFT_METALS = ["silver", "copper", "aluminum", "iron"];

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "drift", hover: null, speed: 1 };
const st = { metal: "copper" };
const drift = { I: 2, S: 1e-6, on: true, paused: false };
const dens = { I: 3, S1: 2e-6, S2: 0.5e-6, gate: 15, hist: [], paused: false };
const rt = { t: 20, T: 4.6, pts: [], heating: false, acc: 0 };
let presetId = null;
const geo = {};
const parts = () => [{ x0: 0, x1: 10, S: dens.S1 }, { x0: 10, x1: 20, S: dens.S2 }, { x0: 20, x1: WIRE_L, S: dens.S1 }];
const SAt = (xcm) => (xcm >= 10 && xcm <= 20 ? dens.S2 : dens.S1);
const M = () => P.METALS[st.metal] || P.METALS.copper;
const isSC = () => ui.mode === "rt" && st.metal === "hg";
const RofT = (t) => (R20 * P.rhoAt(M(), t)) / M().rho20;
const tMax = () => M().tMax;
const ohm = (R) => Math.round(R * 1000) / 1000; // ommetr: 1 mΩ

/* ------------------------------------------------------------------ Zarralar */

let rnd = 12345;
const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
let electrons = [];
function seedDrift() { rnd = 777; electrons = Array.from({ length: 70 }, () => ({ x: rand(), y: rand(), a: rand() * TAU, tc: rand() * 0.3 })); }
function seedDens() {
  rnd = 4242; const ps = parts(), tot = ps.reduce((s, p) => s + p.S * (p.x1 - p.x0), 0);
  const N = 480; // x — S bo'yicha tekis kvantillar (sanoq tebranishi kichik bo'lsin), u — tasodifiy
  electrons = Array.from({ length: N }, (_, i) => { let r = ((i + 0.5) / N) * tot, x = 0; for (const p of ps) { const w = p.S * (p.x1 - p.x0); if (r <= w) { x = p.x0 + r / p.S; break; } r -= w; } return { x, u: rand() * 2 - 1, j: 0 }; });
  dens.hist = [];
}

/* ------------------------------------------------------------------ 1. Elektronlar harakati */

const vDrift = () => (drift.on ? P.driftSpeed(drift.I, M().n, drift.S) : 0);
const visDrift = () => clamp((vDrift() * 1000) / 0.15, 0, 3) * 30; // px/s (masshtabda emas)

function stepDrift(dt) {
  const vt = 120, vd = visDrift(), W = 1 / 600, H = 1 / 170;
  for (const e of electrons) {
    e.tc -= dt; if (e.tc <= 0) { e.a = rand() * TAU; e.tc = 0.08 + rand() * 0.3; } // ionlar bilan to'qnashuv
    e.x += (Math.cos(e.a) * vt - vd) * dt * W; e.y += Math.sin(e.a) * vt * dt * H;
    if (e.y < 0) { e.y = -e.y; e.a = -e.a; } if (e.y > 1) { e.y = 2 - e.y; e.a = -e.a; }
    if (e.x < 0) e.x += 1; if (e.x > 1) e.x -= 1;
  }
}

/* ------------------------------------------------------------------ 2. Tok zichligi */

const V0 = 30; // px/s — 1 mm² kesimdagi ko'rinma tezlik (masshtabda emas)
function densGeom(w, h) {
  const x0 = 26, x1 = w - 26, cy = h * 0.5, k = (x1 - x0) / WIRE_L, half = (S) => 10 + 34 * Math.sqrt(S / 4e-6);
  return { x0, x1, cy, k, half, X: (xcm) => x0 + xcm * k };
}
function measuredI() {
  const span = dens.hist.length ? dens.hist[dens.hist.length - 1].t - dens.hist[0].t : 0;
  if (span < 1.5) return null;
  const n = dens.hist.reduce((s, q) => s + q.n, 0);
  return ((n / span) * dens.I) / dotFlux();
}
let densT = 0;
const densK = () => densGeom(stage.w || 700, stage.h || 320).k;
// har qanday kesimdan sekundiga o'tadigan nuqtalar soni: λ(x)·v(x) = N·S/ΣSl · V0·(1 mm²/S)/k — x ga bog'liq emas
function dotFlux() { const tot = parts().reduce((s, p) => s + p.S * (p.x1 - p.x0), 0); return (electrons.length * V0 * 1e-6) / (tot * densK()); }
function stepDens(dt) {
  const g = { k: densK() }; let crossed = 0;
  for (const e of electrons) {
    const v = (V0 * (1e-6 / SAt(e.x))) / g.k; // cm/s
    const xOld = e.x; e.x -= v * dt; e.u = clamp(e.u + (rand() - 0.5) * dt * 3, -1, 1);
    if (xOld >= dens.gate && e.x < dens.gate) crossed++;
    if (e.x < 0) { e.x += WIRE_L; e.u = rand() * 2 - 1; }
  }
  densT += dt; dens.hist.push({ t: densT, n: crossed }); while (dens.hist.length && densT - dens.hist[0].t > 3) dens.hist.shift();
}

/* ------------------------------------------------------------------ 3. Qarshilik va temperatura */

function glow(t) { // cho'g'lanish rangi
  if (t < 480) return null;
  const k = clamp((t - 480) / 2000, 0, 1), r = 255, g = Math.round(40 + 200 * k), b = Math.round(20 + 180 * Math.max(0, k - 0.5) * 2);
  return `rgba(${r},${g},${b},${clamp((t - 480) / 400, 0.25, 1)})`;
}
/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx,s){scene.draw(ctx,s,ui,drift,dens,rt,electrons,M(),{parts,SAt,measuredI,isSC,RofT,tMax,glow,mercuryR:()=>P.mercuryR(R20,rt.T)},modelTime);}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.42, 310, 350)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "drift") return drawDrift(ctx, gs, { metal: st.metal, S: drift.S, I: drift.I, on: drift.on, hover: ui.hover });
  if (ui.mode === "dens") return drawDensity(ctx, gs, { parts: parts(), I: dens.I, n: M().n, gate: dens.gate, L: WIRE_L, hover: ui.hover });
  return drawRT(ctx, gs, { metal: st.metal === "hg" ? "copper" : st.metal, R20, t: isSC() ? rt.T : rt.t, tMin: T_MIN, tMax: isSC() ? SC_MAX : tMax(), pts: rt.pts, sc: isSC(), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  drift: ["Dreyf tezligi v(I)", "Tartibli harakat tezligi tok kuchiga proporsional va juda kichik — sekundiga millimetrning ulushlari. Erkin elektronlar ko‘p metallarda (alyuminiy) u yanada kichik."],
  dens: ["Tok zichligi sim bo‘ylab j(x)", "Tarmoqlanmagan simda tok kuchi hamma kesimda bir xil, tok zichligi esa kesim yuzasiga teskari proporsional: ingichka joyda j va elektronlar tezligi katta."],
  rt: ["Qarshilikning temperaturaga bog‘liqligi R(t)", "Metallarda qarshilik temperatura bilan chiziqli ortadi. Shtrix — boshqa metallar (20 °C da hammasi 10 Ω). Yashil nuqtalar — «Qizdirish» paytidagi o‘lchashlar."],
};
function setTab() { const t = TABS[ui.mode]; $("[data-tabs]").innerHTML = ""; $("[data-graph-title]").textContent = isSC() ? "O‘ta o‘tkazuvchanlik: simob R(T)" : t[0]; $("[data-graph-sub]").textContent = isSC() ? "4,15 K da simobning qarshiligi sakrab nolga tushadi — o‘ta o‘tkazuvchanlik holati." : t[1]; graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render(); }

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const nTxt = (n) => `${sci(n, 3)}`;
function hours(s) { return s >= 3600 ? `${fmt(s / 3600, 1)} soat` : s >= 60 ? `${fmt(s / 60, 0)} min` : `${fmt(s, 0)} s`; }

function updateReadouts() {
  const m = M();
  if (ui.mode === "drift") {
    const v = vDrift(), I = drift.on ? drift.I : 0;
    setRO("r1", "Tok kuchi <i>I</i>", u(fmt(I, 2), "A"), drift.on ? "ampermetr" : "kalit ochiq");
    setRO("r2", "Kesim yuzasi <i>S</i>", u(fmt(drift.S * 1e6, 2), "mm²"), `${m.name} sim`);
    setRO("r3", "Erkin elektronlar <i>n</i>", u(nTxt(m.n), "m⁻³"), "har bir atomdan 1–3 ta elektron");
    setRO("r4", "Dreyf tezligi <i>v = I/(enS)</i>", u(fmt(v * 1000, 3), "mm/s"), "tartibli harakat", "orange");
    setRO("r5", "1 m yo‘lni bosish vaqti", v > 0 ? hours(P.travelTime(1, v)) : "—", "elektronning o‘zi juda sekin siljiydi");
    setRO("r6", "Tartibsiz harakat tezligi", u(sci(P.thermalSpeed(293), 2), "m/s"), v > 0 ? `dreyfdan ${sci(P.thermalSpeed(293) / v, 1)} marta katta` : "√(3kT/m), 20 °C");
    return;
  }
  if (ui.mode === "dens") {
    const S = SAt(dens.gate), j = P.currentDensity(dens.I, S), v = P.driftSpeed(dens.I, m.n, S), Im = measuredI();
    setRO("r1", "Tok kuchi <i>I</i>", u(fmt(dens.I, 2), "A"), "simning hamma kesimida bir xil");
    setRO("r2", "Kesimdagi yuza <i>S</i>", u(fmt(S * 1e6, 2), "mm²"), `x = ${fmt(dens.gate, 1)} cm`);
    setRO("r3", "Tok zichligi <i>j = I/S</i>", u(fmt(j / 1e6, 2), "A/mm²"), `= ${sci(j, 3)} A/m²`, "orange");
    setRO("r4", "Dreyf tezligi <i>v = j/(en)</i>", u(fmt(v * 1000, 3), "mm/s"), `${m.name}, n = ${sci(m.n, 3)} m⁻³`);
    setRO("r5", "Kesimdan o‘tgan zaryad <i>Δq/Δt</i>", Im === null ? "—" : u(fmt(Im, 2), "A"), "hisoblagich (3 s o‘rtacha)");
    setRO("r6", "<i>j·S</i>", u(fmt((j * S), 2), "A"), "= I — har qanday kesimda");
    return;
  }
  if (isSC()) {
    const R = P.mercuryR(R20, rt.T);
    setRO("r1", "Temperatura <i>T</i>", u(fmt(rt.T, 2), "K"), `= ${fmt(rt.T - 273.15, 2)} °C`);
    setRO("r2", "Qarshilik <i>R</i>", u(fmt(R * 1000, 2), "mΩ"), R === 0 ? "aniq nol" : "qoldiq qarshilik", "orange");
    setRO("r3", "Kritik temperatura <i>T<sub>k</sub></i>", u(fmt(P.HG_TC, 2), "K"), "simob");
    setRO("r4", "0 °C da <i>R₀</i>", u(fmt(R20, 0), "Ω"), "");
    setRO("r5", "<i>R/R₀</i>", R === 0 ? "0" : sci(R / R20, 2), "");
    setRO("r6", "Holat", R === 0 ? "o‘ta o‘tkazuvchan" : "oddiy metall", R === 0 ? "tok energiya yo‘qotmasdan oqadi" : `T > ${fmt(P.HG_TC, 2)} K`, R === 0 ? "green" : "");
    return;
  }
  const R = RofT(rt.t), R0 = RofT(0), pts = rt.pts, aM = pts.length >= 2 ? P.alphaFrom(pts[0].R, pts[0].t, pts[pts.length - 1].R, pts[pts.length - 1].t) : null;
  setRO("r1", "Temperatura <i>t</i>", u(fmt(rt.t, 0), "°C"), `T = ${fmt(rt.t + 273, 0)} K`);
  setRO("r2", "Qarshilik <i>R</i>", u(fmt(ohm(R), 3), "Ω"), "ommetr", "orange");
  setRO("r3", "0 °C da <i>R₀</i>", u(fmt(R0, 3), "Ω"), "20 °C da 10 Ω");
  setRO("r4", "Temperatura koeffitsiyenti <i>α</i>", u(fmt(m.alpha * 1000, m.alpha < 1e-3 ? 2 : 1), "·10⁻³ K⁻¹"), "jadvaldan");
  setRO("r5", "<i>R/R₂₀</i>", fmt(R / R20, 3), `ρ = ${sci(P.rhoAt(m, rt.t), 3)} Ω·m`);
  setRO("r6", "O‘lchangan <i>α</i>", aM === null ? "—" : u(fmt(aM * 1000, m.alpha < 1e-3 ? 3 : 2), "·10⁻³ K⁻¹"), aM === null ? "«Qizdirish» ni bosing" : `${pts.length} ta o‘lchashdan (birinchi va oxirgi)`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "drift") { t = drift.on ? `v = ${fmt(vDrift() * 1000, 3)} mm/s` : "Kalit ochiq — tok yo‘q"; tone = drift.on ? "purple" : "orange"; }
  else if (ui.mode === "dens") { t = `j = ${fmt(P.currentDensity(dens.I, SAt(dens.gate)) / 1e6, 2)} A/mm²`; tone = "purple"; }
  else if (isSC()) { const R = P.mercuryR(R20, rt.T); t = R === 0 ? "O‘ta o‘tkazuvchanlik: R = 0" : "Oddiy holat"; tone = R === 0 ? "green" : "blue"; }
  else { t = rt.heating ? "Qizdirilmoqda…" : `R = ${fmt(ohm(RofT(rt.t)), 3)} Ω`; tone = rt.heating ? "orange" : "purple"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [], m = M();
  if (ui.mode === "drift") {
    p.push("<p>Metall kristall panjarasining tugunlarida musbat ionlar tebranadi, ular orasida <b>erkin elektronlar</b> gaz kabi tartibsiz harakatlanadi (tezligi ~10⁵ m/s). Bu harakat tok hosil qilmaydi: har tomonga bir xil ko‘p elektron o‘tadi.</p>");
    p.push(drift.on ? `<p>Kalit yopilganda simda elektr maydon hosil bo‘ladi va elektronlar maydonga qarshi yo‘nalishda sekin <b>tartibli harakat</b> qiladi — bu elektr toki. ${m.name} simda I = ${fmt(drift.I, 1)} A, S = ${fmt(drift.S * 1e6, 2)} mm² da v = I/(enS) = ${fmt(vDrift() * 1000, 3)} mm/s. Lampa esa darhol yonadi: maydon sim bo‘ylab yorug‘lik tezligida (3·10⁸ m/s) tarqaladi va hamma elektronlar birdaniga harakatga keladi.</p>` : "<p>Kalitni yoping — maydon paydo bo‘ladi va elektronlar to‘dasi chapga (tok yo‘nalishiga teskari) siljiy boshlaydi.</p>");
    p.push("<p>Metallarda tokni elektronlar tashishini Tolmen va Styuart tajribasi (1916) isbotlagan: tez aylanayotgan g‘altak keskin to‘xtatilganda inersiya bilan siljigan zaryadlar tok hosil qiladi, uning yo‘nalishi va kattaligidan zaryad tashuvchilarning q/m nisbati elektronnikiga teng chiqqan.</p>");
  } else if (ui.mode === "dens") {
    const r = dens.S1 / dens.S2;
    p.push(`<p>Tok kuchi — kesimdan vaqt birligida o‘tgan zaryad: I = Δq/Δt = enSv. Simda zaryad to‘planib qolmaydi, shuning uchun tarmoqlanmagan simning <b>har qanday kesimidan</b> bir xil zaryad o‘tadi — hisoblagichni suring, Δq/Δt o‘zgarmaydi.</p>`);
    p.push(`<p><b>Tok zichligi</b> j = I/S — kesimning birlik yuzasidan o‘tuvchi tok. ${Math.abs(r - 1) < 0.01 ? "Kesimlar teng — j hamma joyda bir xil." : `O‘rtadagi bo‘lakning kesimi ${fmt(r >= 1 ? r : 1 / r, 2)} marta ${r >= 1 ? "kichik" : "katta"} — u yerda j va elektronlar tezligi shuncha marta ${r >= 1 ? "katta" : "kichik"}.`} Ingichka joy ko‘proq qiziydi: eruvchan saqlagichlar shunga asoslangan.</p>`);
  } else if (isSC()) {
    p.push("<p>1911-yilda Kamerling-Onnes simobni suyuq geliyda sovitib, 4,15 K da uning qarshiligi sakrab <b>nolga</b> tushishini kashf etdi — <b>o‘ta o‘tkazuvchanlik</b>. O‘ta o‘tkazuvchan halqada qo‘zg‘atilgan tok yillar davomida so‘nmaydi.</p>");
    p.push("<p>Qo‘llanilishi: kuchli elektromagnitlar (MRT tomografiya, zarralar tezlatkichlari), magnit yostiqli poyezdlar, isrofsiz elektr uzatish liniyalari tajribalari.</p>");
  } else {
    p.push(`<p>Qizdirilganda ionlarning tebranish amplitudasi ortadi va elektronlar ular bilan tez-tez to‘qnashadi — qarshilik ortadi: <b>R = R₀(1 + αt)</b>. ${m.name} uchun α = ${fmt(m.alpha * 1000, m.alpha < 1e-3 ? 2 : 1)}·10⁻³ K⁻¹: ${m.alpha < 1e-3 ? "qotishma qarshiligi temperaturaga deyarli bog‘liq emas — undan etalon rezistorlar va qizdirgich spirallar yasaladi." : "har 100 °C da qarshilik ≈ " + fmt(m.alpha * 100 * 100, 0) + " % ortadi."}</p>`);
    p.push(st.metal === "tungsten" ? "<p>Cho‘g‘lanma lampaning volfram tolasi ≈ 2500 °C da ishlaydi: issiq holatdagi qarshiligi sovuq holatdagidan 11–12 marta katta. Shuning uchun lampa yoqilgan zahoti tok katta bo‘ladi va lampalar ko‘pincha aynan yoqish paytida kuyadi.</p>" : "<p>Qarshilikning temperaturaga bog‘liqligidan <b>qarshilik termometrlari</b> yasaladi (platina, mis). Pechni sahnada qizdiring yoki «Qizdirish» tugmasini bosing — o‘lchangan nuqtalardan α hisoblanadi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() { const html = ui.mode === "drift" ? "<small>Metallarda tok</small> I = enSv" : ui.mode === "dens" ? "<small>Tok zichligi</small> j = I/S = env" : isSC() ? "<small>O‘ta o‘tkazuvchanlik</small> T &lt; T<sub>k</sub> → R = 0" : "<small>Qarshilik</small> R = R₀(1 + αt)"; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  modelTime+=dt;
  if (ui.mode === "drift") stepDrift(dt);
  else if (ui.mode === "dens") stepDens(dt);
  else if (rt.heating) stepHeat(dt);
  else { loop.stop(); return; }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.25) { uiTimer = 0; if (ui.mode === "rt") refresh(); else { updateReadouts(); if (ui.mode === "dens") stage.render(); } }
}, { onStateChange: () => setPlayUI() });
function stepHeat(dt) {
  if (isSC()) {
    rt.T = Math.min(SC_MAX, rt.T + dt * 0.2 * ui.speed); rt.acc += dt * 0.2 * ui.speed;
    if (rt.acc >= 0.1 || rt.T >= SC_MAX) { rt.acc = 0; rt.pts.push({ t: rt.T, R: Math.round(P.mercuryR(R20, rt.T) * 1e5) / 1e5 }); }
    tC.set(rt.T); if (rt.T >= SC_MAX) { rt.heating = false; refresh(); }
    return;
  }
  const rate = (tMax() - T_MIN) / 14;
  rt.t = Math.min(tMax(), rt.t + dt * rate * ui.speed); rt.acc += dt * rate * ui.speed;
  const stepT = tMax() > 1500 ? 200 : 50;
  if (rt.acc >= stepT || rt.t >= tMax()) { rt.acc = 0; rt.pts.push({ t: Math.round(rt.t), R: ohm(RofT(Math.round(rt.t))) }); }
  tC.set(rt.t); if (rt.t >= tMax()) { rt.heating = false; refresh(); }
}
const playBtn = $("[data-play]");
function setPlayUI() {
  let on, txt;
  if (ui.mode === "rt") { on = rt.heating; txt = rt.heating ? "To‘xtatish" : isSC() ? "Isitish" : "Qizdirish"; }
  else { const paused = ui.mode === "drift" ? drift.paused : dens.paused; on = !paused; txt = paused ? "Davom etish" : "Pauza"; }
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = txt;
}
function startAnim(force=false) { if (!force && prefersReducedMotion()) { if (ui.mode === "dens") { for (let i = 0; i < 120; i++) stepDens(1 / 40); } return; } loop.start(); }
playBtn.addEventListener("click", () => {
  customized();
  if (ui.mode === "rt") {
    if (rt.heating) { rt.heating = false; loop.stop(); }
    else {
      const atEnd = isSC() ? rt.T >= SC_MAX - 1e-6 : rt.t >= tMax() - 1e-6;
      if (atEnd || !rt.pts.length) { rt.pts = []; if (isSC()) rt.T = SC_MIN; else if (atEnd) rt.t = 20; rt.acc = 0; rt.pts.push(isSC() ? { t: rt.T, R: P.mercuryR(R20, rt.T) } : { t: rt.t, R: ohm(RofT(rt.t)) }); }
      if (prefersReducedMotion()) { while (isSC() ? rt.T < SC_MAX : rt.t < tMax()) { rt.heating = true; stepHeat(0.25); } rt.heating = false; }
      else { rt.heating = true; loop.start(); }
    }
  } else {
    const o = ui.mode === "drift" ? drift : dens; o.paused = !o.paused;
    if (o.paused) loop.stop(); else startAnim(true);
  }
  setPlayUI(); refresh();
});
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "rt") { rt.heating = false; loop.stop(); rt.pts = []; rt.acc = 0; if (isSC()) rt.T = 4.6; else rt.t = 20; tC.set(isSC() ? rt.T : rt.t); }
  else if (ui.mode === "drift") seedDrift(); else { seedDens(); if (prefersReducedMotion()) startAnim(); }
  setPlayUI(); refresh();
});
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));

/* ------------------------------------------------------------------ Boshqaruv */

const metSel = $("#metal");
const metList = () => (ui.mode === "rt" ? [...Object.keys(P.METALS), "hg"] : DRIFT_METALS);
const metName = (k) => (k === "hg" ? "Simob (o‘ta o‘tkazuvchanlik, K)" : ui.mode === "rt" ? `${P.METALS[k].name} (α = ${fmt(P.METALS[k].alpha * 1000, P.METALS[k].alpha < 1e-3 ? 2 : 1)}·10⁻³ K⁻¹)` : `${P.METALS[k].name} (n = ${sci(P.METALS[k].n, 3)} m⁻³)`);
function fillMetals() { metSel.innerHTML = metList().map((k) => `<option value="${k}">${metName(k)}</option>`).join(""); if (!metList().includes(st.metal)) st.metal = "copper"; metSel.value = st.metal; }
function setTempRange() {
  const inp = $("#rT"), lab = $("[for=rT]");
  if (isSC()) { inp.min = SC_MIN; inp.max = SC_MAX; inp.step = 0.01; lab.textContent = "Temperatura T"; tC.set(rt.T); }
  else { inp.min = T_MIN; inp.max = tMax(); inp.step = 1; lab.textContent = "Temperatura t"; rt.t = clamp(rt.t, T_MIN, tMax()); tC.set(rt.t); }
}
metSel.addEventListener("change", () => {
  st.metal = metSel.value; customized();
  if (ui.mode === "rt") { rt.heating = false; loop.stop(); rt.pts = []; setTempRange(); setTab(); setPlayUI(); }
  else if (ui.mode === "dens") seedDens();
  refresh();
});
const tC = bindRange($("#rT"), $("#rTOut"), (v) => (isSC() ? `${fmt(v, 2)} K` : `${fmt(v, 0)} °C`), (v) => { if (isSC()) rt.T = v; else rt.t = v; customized(); refresh(); });
const dIC = bindRange($("#dI"), $("#dIOut"), (v) => `${fmt(v, 1)} A`, (v) => { drift.I = v; customized(); refresh(); });
const dSC = bindRange($("#dS"), $("#dSOut"), (v) => `${fmt(v, 2)} mm²`, (v) => { drift.S = v * 1e-6; customized(); refresh(); });
const nIC = bindRange($("#nI"), $("#nIOut"), (v) => `${fmt(v, 1)} A`, (v) => { dens.I = v; dens.hist = []; customized(); refresh(); });
const nS1C = bindRange($("#nS1"), $("#nS1Out"), (v) => `${fmt(v, 2)} mm²`, (v) => { dens.S1 = v * 1e-6; seedDens(); customized(); refresh(); });
const nS2C = bindRange($("#nS2"), $("#nS2Out"), (v) => `${fmt(v, 2)} mm²`, (v) => { dens.S2 = v * 1e-6; seedDens(); customized(); refresh(); });

/* Sahnada surish */
const canvas=stage.canvas;let drag=null;
const ptr=(cv,e)=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
bindLabCamera(canvas,scene.lab,()=>stage.render(),{
  start(id,p){if(id==='key'){drift.on=!drift.on;customized();refresh();return;}drag=id;},
  move(id,p){
    if(drag!==id)return;
    const v=scene.parameter(id,p);
    if(id==='rheo'){drift.I=Math.round(v*10)/10;dIC.set(drift.I);}
    else if(id==='gate'){dens.gate=Math.round(v*10)/10;dens.hist=[];}
    else if(id==='temp'){
      if(isSC()){rt.T=Math.round((SC_MIN+v*(SC_MAX-SC_MIN))*100)/100;tC.set(rt.T);}else{rt.t=Math.round(T_MIN+v*(tMax()-T_MIN));tC.set(rt.t);}
      if(rt.heating){rt.heating=false;loop.stop();setPlayUI();}
    }
    customized();refresh();
  },end(){drag=null;}
});

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h, x0 = f.xMin ?? 0; ui.hover = inside ? x0 + ((p.x - r.x) / r.w) * (f.xMax - x0) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Presetlar */

const PRESETS = {
  driftCu: { mode: "drift", title: "Mis simda elektronlar", lesson: "Kalit yopiq: elektronlar tartibsiz harakat bilan birga sekin chapga siljiydi. Reostat surilgichini sahnada surib, tok kuchini o‘zgartiring.", set: () => { st.metal = "copper"; Object.assign(drift, { I: 2, S: 1e-6, on: true }); } },
  driftOff: { mode: "drift", title: "Tok yo‘q: tartibsiz harakat", lesson: "Kalit ochiq — maydon yo‘q, elektronlar faqat tartibsiz harakat qiladi, tok yo‘q. Sahnadagi kalitni bosib yoping.", set: () => { st.metal = "copper"; Object.assign(drift, { I: 2, S: 1e-6, on: false }); } },
  driftAl: { mode: "drift", title: "Alyuminiy: n katta, v kichik", lesson: "Alyuminiyda erkin elektronlar misdagidan 2,1 marta ko‘p — xuddi shu tok uchun ular 2,1 marta sekin harakatlanadi.", set: () => { st.metal = "aluminum"; Object.assign(drift, { I: 2, S: 1e-6, on: true }); } },
  driftThin: { mode: "drift", title: "Ingichka sim, katta tok", lesson: "S = 0,25 mm², I = 10 A: dreyf tezligi ≈ 3 mm/s — baribir juda kichik. Bunday simdan katta tok o‘tsa, u kuchli qiziydi.", set: () => { st.metal = "copper"; Object.assign(drift, { I: 10, S: 0.25e-6, on: true }); } },
  densStep: { mode: "dens", title: "Ingichkalashgan sim", lesson: "O‘rtadagi bo‘lakning kesimi 4 marta kichik: u yerda j va elektronlar tezligi 4 marta katta. Hisoblagichni sahnada surib, Δq/Δt hamma joyda bir xil ekanini tekshiring.", set: () => { st.metal = "copper"; Object.assign(dens, { I: 3, S1: 2e-6, S2: 0.5e-6, gate: 5 }); } },
  densEqual: { mode: "dens", title: "Bir xil kesimli sim", lesson: "Kesim hamma joyda bir xil — tok zichligi va elektronlar tezligi ham bir xil.", set: () => { st.metal = "copper"; Object.assign(dens, { I: 3, S1: 1e-6, S2: 1e-6, gate: 15 }); } },
  densFuse: { mode: "dens", title: "Saqlagich: juda ingichka joy", lesson: "Saqlagichning ingichka qismida tok zichligi 16 marta katta — eng avval shu joy qiziydi va eriydi.", set: () => { st.metal = "copper"; Object.assign(dens, { I: 5, S1: 4e-6, S2: 0.25e-6, gate: 15 }); } },
  rtCopper: { mode: "rt", title: "Mis: R = R₀(1 + αt)", lesson: "Pech regulyatorini sahnada yuqoriga suring yoki «Qizdirish» ni bosing: mis o‘ramning qarshiligi chiziqli ortadi. O‘lchangan nuqtalardan α hisoblanadi.", set: () => { st.metal = "copper"; rt.t = 20; rt.T = 4.6; } },
  rtLamp: { mode: "rt", title: "Lampa tolasi (volfram)", lesson: "Volfram 2500 °C gacha qizdiriladi — tola cho‘g‘lanadi, qarshiligi ≈ 11 marta ortadi.", set: () => { st.metal = "tungsten"; rt.t = 20; } },
  rtAlloy: { mode: "rt", title: "Konstantan: deyarli o‘zgarmaydi", lesson: "Konstantan qotishmasining α si misnikidan 200 marta kichik — qarshiligi qizdirilganda deyarli o‘zgarmaydi. Shtrix chiziqlar bilan solishtiring.", set: () => { st.metal = "constantan"; rt.t = 20; } },
  rtSuper: { mode: "rt", title: "O‘ta o‘tkazuvchanlik (simob)", lesson: "Simob suyuq geliyda sovitilgan. Regulyatorni 4,15 K dan pastga tushiring — qarshilik sakrab nolga tushadi. «Isitish» — 3 K dan 6 K gacha o‘lchash.", set: () => { st.metal = "hg"; rt.T = 4.6; } },
};
const GROUPS = [["Elektronlar harakati", ["driftCu", "driftOff", "driftAl", "driftThin"]], ["Tok zichligi", ["densStep", "densEqual", "densFuse"]], ["Qarshilik va temperatura", ["rtCopper", "rtLamp", "rtAlloy", "rtSuper"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { drift: "Kalitni bosing, reostatni suring", dens: "Hisoblagich tekisligini suring", rt: "Pech regulyatorini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { drift: "Zanjir va metall ichidagi ionlar hamda elektronlar", dens: "Kesimi har xil sim va undagi elektronlar oqimi", rt: "Pechdagi sim o‘rami, termometr va ommetr" }[ui.mode]);
}
const MODE_DEFAULT = { drift: "driftCu", dens: "densStep", rt: "rtCopper" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  loop.stop(); drag = null; ui.hover = null;
  ui.mode = p.mode; rt.heating = false; rt.pts = []; rt.acc = 0; drift.paused = prefersReducedMotion(); dens.paused = prefersReducedMotion(); modelTime=0; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  fillMetals(); dIC.set(drift.I); dSC.set(drift.S * 1e6); nIC.set(dens.I); nS1C.set(dens.S1 * 1e6); nS2C.set(dens.S2 * 1e6);
  if (ui.mode === "rt") setTempRange();
  if (ui.mode === "drift") seedDrift(); else if (ui.mode === "dens") seedDens();
  setTab(); setPlayUI(); refresh();
  if (ui.mode !== "rt") startAnim();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "driftCu");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
