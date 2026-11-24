// ==========================================================================
// Gazlarda elektr toki va razryad turlari — virtual laboratoriya (simulations/discharge.html)
// 1) Ionlash kamerasi: yuqori kuchlanish manbai, yassi plastinkalar, ionlagich (alanga, ultrabinafsha, rentgen),
//    galvanometr; ionlar hosil bo'lishi, rekombinatsiyasi va dreyfi; Om sohasi, to'yinish, zarbli ionlanish, uchqun.
// 2) Razryad trubkasi: vakuum nasosi, vakuummetr, gaz kiritish klapani; Pashen qonuni bo'yicha teshilish,
//    shnur → tlejli razryad (katod qorong'i sohasi, manfiy shu'la, Faradey sohasi, musbat ustun, qatlamlar) → katod nurlari.
// 3) Razryad turlari: Uimshurst elektrofor mashinasida uchqun, ko'mir elektrodlar orasida elektr yoyi, liniya simida toj.
// Sahna — 360° 3D laboratoriya (discharge-lab-3d.js); ionlar harakati 520×300 tekislikda hisoblanib, sahnaga o'tkaziladi.
// Fizika: discharge-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./discharge-physics.js";
import { drawChamber, drawPaschen, drawSpark, drawArc, drawCorona, lastFrame, fI, unitFor } from "./discharge-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-n3";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261124-n3";
import { createDischargeLab } from "./discharge-lab-3d.js?v=20261124-n3";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ Holat */

const ION_S = 0.01, ION_UMAX = 40000, ION_RLIM = 5e7;
const TUBE_L = 40, TUBE_R = 1e6;
const H_LINE = 1500, ARC_E = 110, SPARK_UMAX = 90000;
const ui = { mode: "ion", kind: "spark", view: { ion: "lin", tube: "pa", spark: "t", arc: "ui", corona: "e" }, hover: null };
const ion = { src: "xray", U: 1000, d: 1, parts: [], acc: 0, spark: 0, sparkT: 0, seed: 1, hit: [0, 0] };
const tube = { gas: "air", p: 760, U: 10000, pump: false, vent: false, burning: false };
const spark = { d: 1.5, w: 1.5, jars: true, U: 0, t: 0, hist: [], histT: 0, flash: 0, seed: 1, count: 0, rot: 0, lastT: null, period: null };
const arc = { R: 5, d: 3, on: false, out: false };
const cor = { U: 150, r: 0.5, m: 1 };
let presetId = null;
let running = false;
let anim = 0;

/* ------------------------------------------------------------------ Formatlar */

const fU = (U) => (U >= 1000 ? `${fmt(U / 1000, U >= 1e4 ? 1 : 2)} kV` : `${fmt(U, U < 10 ? 2 : 0)} V`);
const fP = (p) => (p >= 1 ? fmt(p, p >= 100 ? 0 : 1) : p >= 0.01 ? fmt(p, p >= 0.1 ? 2 : 3) : sci(p, 2));
const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
/** Galvanometr/ampermetr: avtomatik chegara */
function autoMeter(I) {
  const [k, unit] = unitFor(I || 1e-12), v = I / k, R = NICE.find((r) => r >= v * 1.04) || 1000, m = R / 10 ** Math.floor(Math.log10(R) + 1e-9);
  return { value: v, max: R, sym: unit, ticks: m === 2 ? 2 : 5, digits: R === 1 ? 1 : 0, label: `0–${R} ${unit}` };
}

/* ------------------------------------------------------------------ 1) Ionlash kamerasi */

const uFromPos = (v) => (v <= 0 ? 0 : 10 ** (((v - 1) / 999) * Math.log10(ION_UMAX)));
const posFromU = (U) => (U < 1 ? 0 : clamp(1 + (999 * Math.log10(U)) / Math.log10(ION_UMAX), 1, 1000));
const ionQ = () => P.IONIZERS[ion.src].q;
const ionUb = () => P.chamberBreakdown(ion.d / 100);
function ionState() {
  const r = P.chamber(ion.U, ion.d / 100, ION_S, ionQ());
  if (r.regime === "spark") r.I = Math.max(r.I, (ion.U - 0.3 * ionUb()) / ION_RLIM);
  return r;
}
const GAP = () => ion.d * 40;
const plateX = () => [300 - GAP() / 2, 300 + GAP() / 2];
const SPAWN = { none: 0.4, uv: 20, xray: 50, flame: 90 };
function stepIon(dt) {
  const st = ionState(), [xl, xr] = plateX(), n = P.chamber(1, 0.01, ION_S, ionQ()), Usat = (ionQ() * (ion.d / 100) ** 2) / (n.n * P.MU);
  const v = 170 * (1 - Math.exp(-ion.U / Math.max(1, 3 * Usat)));
  ion.acc += dt * SPAWN[ion.src];
  const r = Math.random;
  while (ion.acc >= 1 && ion.parts.length < 420) {
    ion.acc -= 1;
    const flame = ion.src === "flame", x = xl + 3 + r() * (xr - xl - 6), y = flame ? 150 + r() * 30 : 76 + r() * 100;
    const z = flame ? (r() - 0.5) * 0.3 : r() - 0.5; // z — plastinkalar bo'ylab chuqurlik (−0,5…0,5), faqat 3D sahna uchun
    ion.parts.push({ x, y, z, s: 1, life: 1.2 + r() * 0.6, vy: flame ? -18 - r() * 10 : 0 }, { x: x + (r() - 0.5) * 3, y: y + (r() - 0.5) * 3, z: z + (r() - 0.5) * 0.02, s: -1, life: 1.2 + r() * 0.6, vy: flame ? -18 - r() * 10 : 0 });
  }
  const M = st.M, ava = Number.isFinite(M) && M > 1.2 ? Math.log(M) * 1.6 : 0;
  const out = [];
  for (const p of ion.parts) {
    p.x += p.s * v * (p.s < 0 ? 1.3 : 1) * dt; p.y += p.vy * dt; p.life -= dt * (v > 40 ? 0.3 : 1);
    if (p.x <= xl + 1) { ion.hit[0] = 0.15; continue; }
    if (p.x >= xr - 1) { ion.hit[1] = 0.15; continue; }
    if (p.life <= 0 || p.y < 72 || p.y > 182) continue;
    if (ava && p.s < 0 && Math.random() < ava * dt && out.length < 600) { out.push({ x: p.x, y: p.y + (Math.random() - 0.5) * 4, z: p.z, s: -1, life: 1, vy: 0, a: 1 }, { x: p.x, y: p.y, z: p.z, s: 1, life: 1, vy: 0, a: 1 }); }
    out.push(p);
  }
  ion.parts = out;
  ion.hit = ion.hit.map((h) => Math.max(0, h - dt));
  if (st.regime === "spark") { ion.sparkT -= dt; if (ion.sparkT <= 0) { ion.spark = 0.12; ion.seed = 1 + Math.floor(Math.random() * 1e6); ion.sparkT = 0.25 + Math.random() * 0.5; } }
  ion.spark = Math.max(0, ion.spark - dt);
}

/* ------------------------------------------------------------------ 2) Razryad trubkasi */

const gas = () => P.GASES[tube.gas];
const pFromPos = (v) => 10 ** (-4 + (v / 1000) * (Math.log10(760) + 4));
const posFromP = (p) => clamp((1000 * (Math.log10(p) + 4)) / (Math.log10(760) + 4), 0, 1000);
const tubeUb = () => P.tubeBreakdown(gas(), tube.p, TUBE_L);
function updateBurning() {
  const Ub = tubeUb();
  if (!tube.burning && tube.U >= Ub) tube.burning = true;
  else if (tube.burning && tube.U < P.SUSTAIN * Ub) tube.burning = false;
}
const tubeI = () => (tube.burning ? P.tubeCurrent(tube.U, tubeUb(), TUBE_R) : 0);
function tubeRegime() {
  if (!tube.burning) return tube.p < 1e-3 ? "vacuum" : "none";
  const L = P.glowLayout(tube.p, TUBE_L);
  if (L.rays) return "rays";
  if (tube.p > 40) return "spark";
  if (tube.p > 3) return "cord";
  if (L.striae > 0.5) return "striae";
  return "glow";
}
const REGIME = { none: "razryad yo‘q", vacuum: "yuqori vakuum — tashuvchilar yo‘q", spark: "uchqunli kanal", cord: "shnur (ingichka kanal)", glow: "tlejli razryad", striae: "qatlamli tlejli razryad", rays: "katod nurlari (shisha shu’lalanadi)" };
function stepTube(dt) {
  if (tube.pump && !tube.vent) tube.p = P.pumpStep(tube.p, dt);
  if (tube.vent) { tube.p = P.ventStep(tube.p, dt); if (tube.p > 759) { tube.p = 760; tube.vent = false; } }
  if (tube.pump || tube.vent) { PC.set(posFromP(tube.p)); $("#tPOut").textContent = `${fP(tube.p)} mm`; }
  updateBurning();
}

/* ------------------------------------------------------------------ 3) Uchqun, yoy, toj */

const sparkC = () => (spark.jars ? 400e-12 : 20e-12);
const sparkVb = () => P.sparkVb(spark.d);
function stepSpark(dt) {
  const k = spark.w * (spark.jars ? 0.25 : 2.5);
  spark.U = SPARK_UMAX + (spark.U - SPARK_UMAX) * Math.exp(-k * dt);
  spark.rot += dt * spark.w * TAU; spark.t += dt; spark.flash = Math.max(0, spark.flash - dt);
  if (spark.U >= sparkVb()) {
    spark.hist.push({ t: spark.t, U: sparkVb() }); spark.U = 0.04 * sparkVb(); spark.hist.push({ t: spark.t + 1e-3, U: spark.U });
    spark.flash = spark.jars ? 0.16 : 0.08; spark.seed = 1 + Math.floor(Math.random() * 1e6); spark.count++;
    if (spark.lastT != null) spark.period = spark.t - spark.lastT; spark.lastT = spark.t;
  }
  if (spark.t - spark.histT >= 0.04) { spark.hist.push({ t: spark.t, U: spark.U }); spark.histT = spark.t; }
  if (spark.hist.length > 900) spark.hist = spark.hist.filter((p) => p.t >= spark.t - 12);
}
const arcPt = () => (arc.d <= 0 ? null : arc.on ? P.arcPoint(ARC_E, arc.R, arc.d) : null);
function arcState() { if (arc.d <= 0) return { mode: "short", I: ARC_E / (arc.R + 0.05), U: (ARC_E / (arc.R + 0.05)) * 0.05 }; const p = arcPt(); return p ? { mode: "arc", ...p } : { mode: "off", I: 0, U: ARC_E }; }
function setArcGap(d) {
  const was = arc.d; arc.d = d;
  if (d <= 0) { arc.on = false; arc.out = false; return; }
  if (was <= 0) arc.on = !!P.arcPoint(ARC_E, arc.R, d);
  if (arc.on && !P.arcPoint(ARC_E, arc.R, d)) { arc.on = false; arc.out = true; flashStatus("Yoy so‘ndi — oraliq juda katta"); }
}
const corEs = () => P.wireField(cor.U, cor.r, H_LINE);
const corEc = () => P.peek(cor.r, cor.m);
const corUc = () => P.coronaOnset(cor.r, H_LINE, cor.m);
/* ------------------------------------------------------------------ Sahna (360° 3D laboratoriya: discharge-lab-3d.js) */

const gkey = () => (ui.mode === "types" ? ui.kind : ui.mode);
const scene = createDischargeLab();
const pText = (p) => `${p >= 0.01 ? fmt(p, p >= 100 ? 0 : p >= 1 ? 1 : 3) : p.toExponential(1).replace(".", ",").replace("e-", "E-")} mm`;
/** Sahna uchun joriy qiymatlar (faqat o'qiladi). */
function frame() {
  const k = gkey();
  if (k === "ion") {
    const st = ionState();
    return { mode: "ion", anim, ion: { src: ion.src, U: ion.U, pos: posFromU(ion.U) / 1000, text: fU(ion.U), d: ion.d, parts: ion.parts, hit: ion.hit, spark: ion.spark, seed: ion.seed, I: st.I, meter: autoMeter(st.I) } };
  }
  if (k === "tube") {
    const reg = tubeRegime();
    return { mode: "tube", anim, tube: { gas: gas(), p: tube.p, pText: pText(tube.p), U: tube.U, pump: tube.pump, vent: tube.vent, burning: tube.burning, reg, regText: REGIME[reg], I: tubeI(), L: P.glowLayout(tube.p, TUBE_L), Lcm: TUBE_L } };
  }
  if (k === "spark") return { mode: "spark", anim, spark: { d: spark.d, jars: spark.jars, U: spark.U, rot: spark.rot, flash: spark.flash, seed: spark.seed, Vb: sparkVb(), t: spark.t } };
  if (k === "arc") return { mode: "arc", anim, arc: { R: arc.R, d: arc.d, st: arcState(), out: arc.out } };
  const Es = corEs(), Ec = corEc();
  return { mode: "corona", anim, cor: { U: cor.U, r: cor.r, m: cor.m, Es, Ec, f: Es > Ec ? clamp((Es - Ec) / Ec, 0, 1.5) : 0 } };
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), (ctx, stg) => scene.draw(ctx, stg, frame()), { height: detailedStageHeight });

/* ------------------------------------------------------------------ Grafik */

function drawGraphCanvas(ctx, gs) {
  const k = gkey();
  if (k === "ion") return drawChamber(ctx, gs, { view: ui.view.ion, q: ionQ(), d: ion.d / 100, S: ION_S, U: ion.U, hover: ui.hover });
  if (k === "tube") return drawPaschen(ctx, gs, { gas: gas(), d: TUBE_L, p: tube.p, U: tube.U, burning: tube.burning, hover: ui.hover });
  if (k === "spark") return drawSpark(ctx, gs, { view: ui.view.spark, hist: spark.hist, Vb: sparkVb(), d: spark.d, Umax: SPARK_UMAX, win: 10, hover: ui.hover });
  if (k === "arc") return drawArc(ctx, gs, { d: Math.max(0.1, arc.d), E: ARC_E, R: arc.R, pt: arcPt(), hover: ui.hover });
  return drawCorona(ctx, gs, { r: cor.r, h: H_LINE, m: cor.m, U: cor.U, Umax: 300, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  ion: [["lin", "I(U)", "Mustaqil bo‘lmagan razryad: I(U)", "Kichik kuchlanishda ionlarning bir qismi elektrodlarga yetmay rekombinatsiyalanadi — tok U ga proporsional (shtrix). Kuchlanish ortsa, hosil bo‘lgan barcha ionlar elektrodlarga yetadi: tok to‘yinadi (Iₛ = eqSd) va endi faqat ionlagichga bog‘liq."],
    ["log", "lg I(U)", "To‘yinishdan teshilishgacha (logarifmik shkala)", "To‘yinishdan keyin tok o‘zgarmaydi, so‘ng elektronlar molekulalarni urib ionlay boshlaydi — tok keskin ortadi (zarbli ionlanish). Qizil chiziqda ionlagichsiz ham tok mavjud bo‘ladi: mustaqil razryad (uchqun)."]],
  tube: [["pa", "Uₜ(p)", "Pashen egri chizig‘i: teshilish kuchlanishi", "Yashil soha — manba kuchlanishi teshilish uchun yetarli. Bosim kamaysa, elektronning erkin yugurish yo‘li uzayadi va u kamroq kuchlanishda ionlash energiyasini to‘playdi; juda past bosimda esa urilish uchun molekulalar yetmaydi — kuchlanish yana ortadi. Chap tarmoq taxminiy."]],
  spark: [["t", "U(t)", "Leyden bankalaridagi kuchlanish U(t)", "Mashina bankalarni zaryadlaydi, kuchlanish teshilish qiymatiga yetganda havo ionlashib, uchqun sakraydi va bankalar razryadlanadi — arra tishli grafik. Bankalar ulangan bo‘lsa, sig‘im katta: uchqun kamdan-kam, lekin kuchli."],
    ["d", "Uₜ(d)", "Uchqun oralig‘i va teshilish kuchlanishi", "Atmosfera bosimida havo taxminan 30 kV/cm da teshiladi (shtrix). Kichik oraliqlarda kerakli maydon kattaroq — Pashen qonuni. Oraliq mashina chegarasidan katta bo‘lsa, uchqun chiqmaydi."]],
  arc: [["ui", "U(I)", "Elektr yoyining volt-amper xarakteristikasi", "Yoyda tok ortsa, kuchlanish kamayadi: kuchliroq tok ko‘mirlarni qattiqroq qizdiradi, termoelektron emissiya va ionlanish ortadi. Shuning uchun yoy ballast qarshiliksiz ishlay olmaydi. Yashil — barqaror ish nuqtasi, ichi bo‘sh — beqaror."]],
  corona: [["e", "E(U)", "Sim sirtidagi maydon va toj chegarasi", "Sim sirtidagi maydon kuchlanishga proporsional va ingichka simda kattaroq. U Pik chegarasidan oshsa, sim atrofidagi yupqa qatlamda havo ionlashadi — toj razryad. Liniyalarda bu energiya isrofi va radioto‘siq, shuning uchun yo‘g‘on yoki ajratilgan (bir nechta) simlar ishlatiladi."]],
};
function setTabs() {
  const box = $("[data-tabs]"), k = gkey(), tabs = TABS[k], cur = ui.view[k], t = tabs.find((x) => x[0] === cur) || tabs[0];
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === t[0]}">${name}</button>`).join("");
  box.hidden = tabs.length < 2;
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[gkey()] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const uI = (I) => { const [v, un] = fI(I); return u(v, un); };
const uU = (U) => (U >= 1000 ? u(fmt(U / 1000, U >= 1e4 ? 1 : 2), "kV") : u(fmt(U, U < 10 ? 2 : 0), "V"));
const ION_REG = { ohm: ["Om qonuni sohasi", "blue"], sat: ["to‘yinish toki", "green"], town: ["zarbli ionlanish", "orange"], spark: ["mustaqil razryad — uchqun", "red"] };

function updateReadouts() {
  const k = gkey();
  if (k === "ion") {
    const st = ionState(), [rt, tone] = ION_REG[st.regime], Ub = ionUb(), a = P.alpha(P.GASES.air, 760, st.E / 100);
    setRO("r1", "Kuchlanish <i>U</i>", uU(ion.U), `E = U/d = ${fmt(st.E / 1e5, st.E < 1e5 ? 3 : 1)} kV/cm`);
    setRO("r2", "Tok <i>I</i> (galvanometr)", uI(st.I), rt, tone);
    setRO("r3", "To‘yinish toki <i>I</i>ₛ = <i>eqSd</i>", uI(st.Is), `${P.IONIZERS[ion.src].name}: q = ${sci(ionQ(), 2)} juft/(m³·s)`);
    setRO("r4", "Elektronlar ko‘payishi <i>M</i>", Number.isFinite(st.M) ? u(st.M < 100 ? fmt(st.M, 2) : sci(st.M, 2), "marta") : "∞", `α = ${a < 1e-3 ? sci(a, 2) : fmt(a, 2)} 1/cm (Taunsend)`, st.M > 1.2 ? "orange" : "");
    setRO("r5", "Teshilish kuchlanishi <i>U</i>ₜ", uU(Ub), `Pashen: pd = ${fmt(760 * ion.d, 0)} mm·cm; ${fmt(Ub / 1000 / ion.d, 1)} kV/cm`, "red");
    setRO("r6", "Ionlar konsentratsiyasi <i>n</i>", u(sci(st.n * 1e-6, 2), "1/cm³"), "n = √(q/β): hosil bo‘lish = rekombinatsiya");
  } else if (k === "tube") {
    const Ub = tubeUb(), I = tubeI(), reg = tubeRegime(), L = P.glowLayout(tube.p, TUBE_L);
    setRO("r1", "Bosim <i>p</i>", u(fP(tube.p), "mm sim. ust."), `${sci(tube.p * P.TORR, 2)} Pa${tube.pump ? " · nasos ishlamoqda" : tube.vent ? " · gaz kirmoqda" : ""}`, tube.pump ? "purple" : "");
    setRO("r2", "Teshilish kuchlanishi <i>U</i>ₜ", Number.isFinite(Ub) ? uU(Ub) : "∞", `${gas().name}, d = ${TUBE_L} cm; so‘nish ~${fU(P.SUSTAIN * Ub)}`, "red");
    setRO("r3", "Manba kuchlanishi <i>U</i>", uU(tube.U), tube.U >= Ub ? "teshilish uchun yetarli" : tube.burning ? "razryad hali yonib turibdi" : "teshilish uchun yetmaydi", tube.U >= Ub || tube.burning ? "green" : "");
    setRO("r4", "Trubka toki <i>I</i>", uI(I), tube.burning ? `cheklovchi qarshilik 1 MΩ` : "tok yo‘q", tube.burning ? "blue" : "");
    setRO("r5", "Razryad turi", REGIME[reg], tube.burning && !L.rays && tube.p < 3 ? `katod qorong‘i sohasi d_k ≈ ${fmt(L.dk, L.dk < 1 ? 2 : 1)} cm` : reg === "rays" ? "qorong‘i soha butun trubkani egalladi" : "", reg === "rays" ? "green" : tube.burning ? "purple" : "");
    setRO("r6", "Molekulaning erkin yugurish yo‘li <i>λ</i>", (() => { const l = 0.005 / tube.p; return l >= 1 ? u(fmt(l, l >= 10 ? 0 : 1), "cm") : l >= 1e-3 ? u(fmt(l * 10, l >= 0.1 ? 1 : 3), "mm") : u(fmt(l * 1e4, 2), "μm"); })(), "havoda λ ≈ 5·10⁻³ cm / p; elektronniki ~6 marta uzun");
  } else if (k === "spark") {
    const Vb = sparkVb(), W = 0.5 * sparkC() * Vb * Vb;
    setRO("r1", "Bankalardagi kuchlanish <i>U</i>", uU(spark.U), `mashina chegarasi ${fmt(SPARK_UMAX / 1000, 0)} kV (sizib ketish)`);
    setRO("r2", "Teshilish kuchlanishi <i>U</i>ₜ", uU(Vb), `o‘rtacha maydon ${fmt(Vb / 1000 / spark.d, 1)} kV/cm`, Vb < SPARK_UMAX ? "red" : "");
    setRO("r3", "Sharlar oralig‘i <i>d</i>", u(fmt(spark.d, 1), "cm"), Vb >= SPARK_UMAX ? "uchqun chiqmaydi — oraliq juda katta" : "havo 760 mm sim. ust.");
    setRO("r4", "Uchqunlar", u(String(spark.count), "ta"), spark.period && Vb < SPARK_UMAX ? `har ${fmt(spark.period, 2)} s da bittadan` : "—", "purple");
    setRO("r5", "Uchqun energiyasi <i>W</i> = <i>CU</i>ₜ²/2", W >= 0.1 ? u(fmt(W, 2), "J") : u(fmt(W * 1000, 0), "mJ"), `C = ${fmt(sparkC() * 1e12, 0)} pF`, "orange");
    setRO("r6", "Disklar tezligi", u(fmt(spark.w, 1), "ayl/s"), spark.w > 0 ? "zaryadlash tezligi ∝ aylanish" : "mashina to‘xtagan");
  } else if (k === "arc") {
    const st = arcState(), p = arcPt();
    setRO("r1", "Tok <i>I</i>", u(fmt(st.I, 1), "A"), st.mode === "short" ? "qisqa tutashuv: I = E/R" : st.mode === "arc" ? "ampermetr" : "zanjir uzilgan", st.mode === "short" ? "red" : "blue");
    setRO("r2", "Yoydagi kuchlanish <i>U</i>", st.mode === "off" ? "—" : u(fmt(st.U, 1), "V"), st.mode === "arc" ? `U = ${fmt(38.9 + 2.07 * arc.d, 1)} + ${fmt(11.7 + 10.5 * arc.d, 1)}/I` : "");
    setRO("r3", "Yoy quvvati <i>P</i> = <i>UI</i>", st.mode === "arc" ? u(fmt(st.U * st.I, 0), "W") : "—", st.mode === "arc" ? `reostatda ${fmt(st.I * st.I * arc.R, 0)} W` : "", "orange");
    setRO("r4", "Ko‘mirlar oralig‘i <i>d</i>", u(fmt(arc.d, 1), "mm"), `so‘nish chegarasi ≈ ${fmt(P.arcMaxGap(ARC_E, arc.R), 1)} mm`);
    setRO("r5", "Differensial qarshilik d<i>U</i>/d<i>I</i>", p ? u(fmt(-(11.7 + 10.5 * arc.d) / (p.I * p.I), 2), "Ω") : "—", p ? "manfiy: tok ortsa, kuchlanish kamayadi" : "", p ? "purple" : "");
    setRO("r6", "Anod krateri temperaturasi", st.mode === "arc" ? u("~3900", "K") : "—", st.mode === "arc" ? "katod ~3200 K; ko‘mir 4000 K atrofida bug‘lanadi" : "yoy yonmagan", st.mode === "arc" ? "red" : "");
  } else {
    const Es = corEs(), Ec = corEc(), Uc = corUc(), on = Es > Ec;
    setRO("r1", "Sim kuchlanishi <i>U</i>", u(fmt(cor.U, 0), "kV"), `liniya ${fmt(cor.U * Math.sqrt(3), 0)} kV (fazalararo)`);
    setRO("r2", "Sim sirtidagi maydon <i>E</i>", u(fmt(Es, 1), "kV/cm"), `E = U/(r·ln(2h/r)), h = ${H_LINE / 100} m`, on ? "purple" : "");
    setRO("r3", "Toj chegarasi <i>E</i>ₖ (Pik)", u(fmt(Ec, 1), "kV/cm"), `m = ${fmt(cor.m, 2)}; ingichka simda katta, lekin maydon undan tez ortadi`);
    setRO("r4", "Toj boshlanish kuchlanishi <i>U</i>ₖ", u(fmt(Uc, 0), "kV"), on ? "toj yonmoqda" : `${fmt(Uc - cor.U, 0)} kV zaxira`, on ? "red" : "green");
    setRO("r5", "Toj razryad", on ? "bor" : "yo‘q", on ? `toj toki ∝ U(U − Uₖ) = ${fmt(P.coronaI(cor.U, Uc) / 1000, 1)}·10³ (nisbiy)` : "isrof yo‘q", on ? "purple" : "green");
    setRO("r6", "Sim radiusi <i>r</i>", u(fmt(cor.r * 10, 1), "mm"), `diametri ${fmt(cor.r * 20, 0)} mm`);
  }
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2200; }
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"), k = gkey(); let t, tone = "blue";
  if (k === "ion") { const st = ionState(); [t, tone] = ION_REG[st.regime]; t = `${t[0].toUpperCase()}${t.slice(1)}`; if (ion.src === "none" && st.regime !== "spark") { t = "Havo deyarli izolyator — tok sezilmaydi"; tone = ""; } }
  else if (k === "tube") { const reg = tubeRegime(); t = `${REGIME[reg][0].toUpperCase()}${REGIME[reg].slice(1)}`; tone = tube.burning ? (reg === "rays" ? "green" : "purple") : ""; }
  else if (k === "spark") { const ok = sparkVb() < SPARK_UMAX; t = !ok ? "Oraliq juda katta — uchqun chiqmaydi" : spark.w <= 0 ? "Mashina to‘xtagan" : spark.flash > 0 ? "Uchqun!" : "Bankalar zaryadlanmoqda"; tone = spark.flash > 0 ? "red" : ok ? "orange" : ""; }
  else if (k === "arc") { const st = arcState(); t = st.mode === "arc" ? "Elektr yoyi yonmoqda" : st.mode === "short" ? "Ko‘mirlar tutashgan — endi sekin uzoqlashtiring" : arc.out ? "Yoy so‘ndi — qayta tutashtiring" : "Tok yo‘q — ko‘mirlarni tutashtiring"; tone = st.mode === "arc" ? "orange" : st.mode === "short" ? "red" : ""; }
  else { const on = corEs() > corEc(); t = on ? "Toj razryad: sim atrofida havo ionlashmoqda" : "Toj yo‘q"; tone = on ? "purple" : "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [], k = gkey();
  if (k === "ion") {
    const st = ionState();
    p.push("<p>Odatdagi havoda erkin zaryadlar juda kam — u yaxshi izolyator. <b>Ionlagich</b> (alanga, ultrabinafsha yoki rentgen nurlari) molekulalardan elektron urib chiqaradi: musbat ion va elektron (u tezda neytral molekulaga yopishib, manfiy ion hosil qiladi) juftlari paydo bo‘ladi. Ular bir-biri bilan uchrashsa, yana neytral molekulaga birlashadi — <b>rekombinatsiya</b>.</p>");
    if (st.regime === "ohm") p.push("<p>Kuchlanish kichik: ionlarning ko‘pchiligi plastinkalarga yetguncha rekombinatsiyalanadi. Tok kuchlanishga proporsional — gaz Om qonuniga bo‘ysunadi. Kuchlanishni oshiring.</p>");
    else if (st.regime === "sat") p.push(`<p><b>To‘yinish</b>: 1 sekundda hosil bo‘lgan barcha ionlar plastinkalarga yetib bormoqda, shuning uchun kuchlanishni oshirish tokni oshirmaydi: Iₛ = eqSd. Ionlagichni o‘chirsangiz, tok yo‘qoladi — bu <b>mustaqil bo‘lmagan razryad</b>.</p>`);
    else if (st.regime === "town") p.push(`<p>Maydon kuchli (${fmt(st.E / 1e5, 1)} kV/cm): elektron erkin yugurish yo‘lida ionlash energiyasini to‘playdi va molekulalarni urib ionlaydi — <b>elektron ko‘chkisi</b>. Tok ${Number.isFinite(st.M) ? fmt(st.M, 1) : "∞"} marta ortdi, lekin ionlagich o‘chsa, hali ham to‘xtaydi.</p>`);
    else p.push(`<p><b>Mustaqil razryad</b>: musbat ionlar katoddan yangi elektronlar urib chiqara boshladi (γ-jarayon) va razryad tashqi ionlagichsiz o‘zini o‘zi ta’minlaydi. Atmosfera bosimida bu — <b>uchqun</b>. Havo ${fmt(ionUb() / 1000 / ion.d, 0)} kV/cm atrofida teshiladi.</p>`);
  } else if (k === "tube") {
    const reg = tubeRegime(), L = P.glowLayout(tube.p, TUBE_L);
    p.push(`<p>Trubkadagi gaz bosimi kamaygan sari elektronlarning erkin yugurish yo‘li uzayadi va teshilish kuchlanishi kamayadi (<b>Pashen qonuni</b>: U<sub>t</sub> faqat p·d ga bog‘liq). Atmosfera bosimida 40 cm oraliqni yuzlab kilovolt ham teshmaydi, ${fmt(tube.p >= 1 ? tube.p : 1, 0)} mm sim. ust. atrofida esa ${fU(P.tubeBreakdown(gas(), Math.max(1, tube.p), TUBE_L))} yetadi.</p>`);
    if (reg === "cord" || reg === "spark") p.push("<p>Bosim hali katta: razryad ingichka, tebranib turuvchi kanal (shnur) ko‘rinishida. Havoni so‘rishda davom eting — kanal kengayib, trubkani to‘ldiradi.</p>");
    if (reg === "glow" || reg === "striae") p.push(`<p><b>Tlejli razryad</b>: katod yonida qorong‘i soha (${fmt(L.dk, 2)} cm) — bu yerda ionlar katodga urilib elektron urib chiqaradi va elektronlar tezlanadi; so‘ng yorqin manfiy shu’la, Faradey qorong‘i sohasi va trubkaning qolgan qismini to‘ldiruvchi <b>musbat ustun</b>. Ustun rangi gazga bog‘liq: ${gas().name.toLowerCase()} — reklama trubkalari shunga asoslangan.${reg === "striae" ? " Ustun qatlamlarga (strata) bo‘lingan: elektronlar energiya to‘plab, ma’lum masofada molekulalarni uyg‘otadi." : ""}</p>`);
    if (reg === "rays") p.push("<p>Bosim juda past: katod qorong‘i sohasi butun trubkani egalladi. Katoddan uchib chiqqan tez elektronlar — <b>katod nurlari</b> — gazga deyarli urilmay anod tomondagi shishaga uriladi va uni yashil shu’lalantiradi. Kineskop va rentgen trubkalari shu hodisadan boshlangan (J. Tomson elektronni shunday kashf etgan).</p>");
    if (reg === "vacuum") p.push("<p>Yuqori vakuum: ionlanadigan molekulalar deyarli qolmadi, razryad o‘chdi. Vakuumda tok faqat elektrodning o‘zi elektron chiqarganda (qizdirilgan katod — termoelektron emissiya) o‘tadi.</p>");
    if (reg === "none" && tube.p > 1) p.push("<p>Manba kuchlanishi teshilish uchun yetmaydi. Nasosni yoqing yoki kuchlanishni oshiring. Diqqat: razryad boshlangandan keyin uni ushlab turish uchun kamroq kuchlanish yetadi (so‘nish kuchlanishi ~0,4·Uₜ).</p>");
  } else if (k === "spark") {
    p.push("<p><b>Uchqun razryad</b> — atmosfera bosimida havoning qisqa muddatli teshilishi. Elektrofor mashinasining disklari aylanganda induksiya orqali zaryadlar ajraladi va Leyden bankalariga (kondensatorlarga) yig‘iladi. Kuchlanish teshilish qiymatiga yetganda sharlar orasida tor, yorqin, egri-bugri ionlashgan kanal hosil bo‘ladi va bankalar bir zumda razryadlanadi — chirsillagan ovoz eshitiladi (havo keskin qizib kengayadi).</p>");
    p.push("<p><b>Chaqmoq</b> — bulut va yer orasidagi ulkan uchqun: kuchlanish yuz millionlab volt, tok o‘n minglab amper. Momaqaldiroq — kanal havosining portlashsimon kengayishi.</p>");
  } else if (k === "arc") {
    p.push("<p><b>Elektr yoyi</b>ni 1802-yilda V. V. Petrov kashf etgan. Ko‘mirlar tutashtirilganda katta tok ularning uchini qizdiradi; ajratilganda qizigan katoddan <b>termoelektron emissiya</b> boshlanadi va oraliqdagi gaz ionlashadi. Kuchlanish atigi 40–60 V, tok esa o‘nlab amper; anod krateri ~3900 K gacha qiziydi — juda yorqin nur.</p>");
    p.push(`<p>Yoyning xarakteristikasi tushuvchi: tok ortsa, kuchlanish kamayadi. Ballast qarshilik bo‘lmasa, tok cheksiz ortib ketardi. Oraliqni kattalashtiring: ~${fmt(P.arcMaxGap(ARC_E, arc.R), 1)} mm dan keyin yuklama chizig‘i yoy egri chizig‘iga tegmay qoladi va yoy so‘nadi. Yoy payvandlashda, metall eritishda va projektorlarda ishlatiladi.</p>`);
  } else {
    p.push("<p><b>Toj razryad</b> keskin bir jinsli bo‘lmagan maydonda — ingichka sim, o‘tkir uch atrofida — paydo bo‘ladi. Faqat sirtga yaqin yupqa qatlamda maydon havoni ionlashga yetadi: binafsha shu’la, vizillash va ozon hidi. Kanal elektrodlarni tutashtirmaydi, shuning uchun bu uchqun emas.</p>");
    p.push("<p>Yuqori kuchlanishli liniyalarda toj energiya isrofi va radioto‘siq beradi, ayniqsa yomg‘ir va tumanda. Shuning uchun 330 kV dan yuqori liniyalarda har faza 2–4 ta simga ajratiladi. Chaqmoq qaytargich va «Avliyo Elm olovi» (kema machtalaridagi shu’la) ham toj razryadning ko‘rinishi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
const FORMULA = { ion: "<small>To‘yinish toki</small> Iₛ = eqSd", tube: "<small>Pashen qonuni</small> Uₜ = f(pd)", spark: "<small>Havo teshilishi</small> E ≈ 30 kV/cm", arc: "<small>Elektr yoyi</small> U = a + bd + (c + ed)/I", corona: "<small>Pik qonuni</small> Eₖ = 30m(1 + 0,301/√r)" };
function updateFormula() { const f = $("[data-formula]"), html = FORMULA[gkey()]; if (f.innerHTML !== html) f.innerHTML = html; }
function syncTools() {
  $("[data-pump]").textContent = tube.pump ? "Nasosni o‘chirish" : "Nasosni yoqish"; $("[data-pump]").setAttribute("aria-pressed", String(tube.pump));
  $("[data-vent]").setAttribute("aria-pressed", String(tube.vent));
  const tb = $("[data-touch]"); tb.hidden = !(ui.mode === "types" && ui.kind === "arc"); tb.textContent = arc.d > 0 ? "Ko‘mirlarni tutashtirish" : "Ko‘mirlarni ajratish (2 mm)";
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); syncTools(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  if (ui.mode === "ion") stepIon(dt);
  else if (ui.mode === "tube") stepTube(dt);
  else if (ui.kind === "spark") stepSpark(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); syncTools(); if (ui.mode === "tube" || ui.kind === "spark") graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) refresh();
}
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || modeDefault(), false));

/* ------------------------------------------------------------------ Boshqaruv */

const srcSel = $("#iSrc");
srcSel.innerHTML = Object.entries(P.IONIZERS).map(([id, z]) => `<option value="${id}">${z.name}</option>`).join("");
srcSel.addEventListener("change", () => { ion.src = srcSel.value; ion.parts = []; customized(); refresh(); });
const IUC = bindRange($("#iU"), $("#iUOut"), (v) => fU(uFromPos(v)), (v) => { ion.U = uFromPos(v); customized(); refresh(); });
const IDC = bindRange($("#iD"), $("#iDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ion.d = v; ion.parts = []; customized(); refresh(); });
function syncIon() { srcSel.value = ion.src; IUC.set(posFromU(ion.U)); $("#iUOut").textContent = fU(ion.U); IDC.set(ion.d); }

const gasSel = $("#tGas");
gasSel.innerHTML = Object.entries(P.GASES).map(([id, g]) => `<option value="${id}">${g.name}</option>`).join("");
gasSel.addEventListener("change", () => { tube.gas = gasSel.value; tube.burning = false; updateBurning(); customized(); refresh(); });
const PC = bindRange($("#tP"), $("#tPOut"), (v) => `${fP(pFromPos(v))} mm`, (v) => { tube.p = pFromPos(v); tube.vent = false; updateBurning(); customized(); refresh(); });
const TUC = bindRange($("#tU"), $("#tUOut"), (v) => `${fmt(v, 1)} kV`, (v) => { tube.U = v * 1000; updateBurning(); customized(); refresh(); });
function syncTube() { gasSel.value = tube.gas; PC.set(posFromP(tube.p)); $("#tPOut").textContent = `${fP(tube.p)} mm`; TUC.set(tube.U / 1000); }
$("[data-pump]").addEventListener("click", () => { tube.pump = !tube.pump; if (tube.pump) tube.vent = false; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });
$("[data-vent]").addEventListener("click", () => { tube.vent = !tube.vent; if (tube.vent) tube.pump = false; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });

const SDC = bindRange($("#sD"), $("#sDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { spark.d = v; customized(); refresh(); });
const SWC = bindRange($("#sW"), $("#sWOut"), (v) => `${fmt(v, 1)} ayl/s`, (v) => { spark.w = v; customized(); refresh(); });
const jarSel = $("#sC");
jarSel.addEventListener("change", () => { spark.jars = jarSel.value === "on"; customized(); refresh(); });
const ARC = bindRange($("#aR"), $("#aROut"), (v) => `${fmt(v, 1)} Ω`, (v) => { arc.R = v; setArcGap(arc.d); customized(); refresh(); });
const ADC = bindRange($("#aD"), $("#aDOut"), (v) => `${fmt(v, 1)} mm`, (v) => { setArcGap(v); customized(); refresh(); });
$("[data-touch]").addEventListener("click", () => { setArcGap(arc.d > 0 ? 0 : 2); ADC.set(arc.d); customized(); refresh(); });
const CUC = bindRange($("#cU"), $("#cUOut"), (v) => `${fmt(v, 0)} kV`, (v) => { cor.U = v; customized(); refresh(); });
const CRC = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v * 10, 1)} mm`, (v) => { cor.r = v; customized(); refresh(); });
const mSel = $("#cM");
mSel.addEventListener("change", () => { cor.m = Number(mSel.value); customized(); refresh(); });
function syncTypes() {
  SDC.set(spark.d); SWC.set(spark.w); jarSel.value = spark.jars ? "on" : "off"; ARC.set(arc.R); ADC.set(arc.d); CUC.set(cor.U); CRC.set(cor.r); mSel.value = String(cor.m);
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === ui.kind)));
  document.querySelectorAll("[data-kctl]").forEach((el) => { el.hidden = el.dataset.kctl !== ui.kind; });
}
const KIND_DEFAULT = { spark: "spark1", arc: "arc1", corona: "corona1" };
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.kindValue !== ui.kind) loadPreset(KIND_DEFAULT[b.dataset.kindValue]); }));

/* ------------------------------------------------------------------ Sahnada boshqarish (3D) */

// bo'sh joyni sudrash — kamera; manba dastasi buriladi, nasos va klapan bosiladi, o'ng shar va o'ng ko'mir suriladi
const canvas = stage.canvas;
let drag = null;
function turn(pointAt, p) { const f = scene.lab.nearest(pointAt, 0, 1, p.x, p.y); if (Math.abs(f - drag.f) > 0.5) return null; drag.f = f; return f; }
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) {
    if (id === "valve") return $("[data-vent]").click();
    if (id === "pump") return $("[data-pump]").click();
    drag = { id, f: id === "knob" ? (ui.mode === "ion" ? posFromU(ion.U) / 1000 : tube.U / 15000) : 0 };
  },
  move(id, p) {
    if (!drag || drag.id !== id) return;
    if (id === "knob") {
      const f = turn(scene.knob, p); if (f == null) return;
      if (ui.mode === "ion") { ion.U = uFromPos(Math.round(f * 1000)); syncIon(); }
      else { tube.U = Math.round(f * 150) * 100; updateBurning(); TUC.set(tube.U / 1000); }
    } else if (id === "ball") { spark.d = clamp(Math.round(scene.lab.nearest(scene.ballPoint, 0.2, 4, p.x, p.y) * 10) / 10, 0.2, 4); SDC.set(spark.d); }
    else if (id === "rod") { setArcGap(clamp(Math.round(scene.lab.nearest(scene.rodPoint, 0, 12, p.x, p.y) * 10) / 10, 0, 12)); ADC.set(arc.d); }
    else return;
    customized(); refresh();
  },
  end() { if (!drag) return; drag = null; refresh(); },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setIon = (src, U, d = 1, view = "lin") => () => { Object.assign(ion, { src, U, d, parts: [], spark: 0 }); ui.view.ion = view; };
const setTube = (g, p, U, pump = false) => () => { Object.assign(tube, { gas: g, p, U, pump, vent: false, burning: false }); updateBurning(); };
const setSpark = (d, w, jars, view = "t") => () => { Object.assign(spark, { d, w, jars, U: 0, t: 0, hist: [], histT: 0, flash: 0, count: 0, lastT: null, period: null }); ui.kind = "spark"; ui.view.spark = view; };
const setArc = (R, d) => () => { Object.assign(arc, { R, d: 0, on: false, out: false }); setArcGap(d); ui.kind = "arc"; };
const setCor = (U, r, m) => () => { Object.assign(cor, { U, r, m }); ui.kind = "corona"; };
const PRESETS = {
  none: { mode: "ion", title: "Havo — izolyator", lesson: "Ionlagich yo‘q: kosmik nurlar havoda 1 cm³ da sekundiga atigi ~10 juft ion hosil qiladi. Galvanometr hech narsa sezmaydi. Ionlagichni tanlang.", set: setIon("none", 1000) },
  flame: { mode: "ion", title: "Alanga: Om sohasi", lesson: "Spirt lampa alangasi plastinkalar orasidagi havoni ionlaydi. U = 10 V da tok kuchlanishga proporsional. Kuchlanishni 100–200 V gacha oshirib, tok to‘yinishini kuzating.", set: setIon("flame", 10) },
  sat: { mode: "ion", title: "To‘yinish toki", lesson: "Rentgen nurlari, U = 1 kV: barcha ionlar plastinkalarga yetadi, tok to‘yingan. Kuchlanishni ikki marta oshiring — tok deyarli o‘zgarmaydi. Endi ionlagichni almashtiring.", set: setIon("xray", 1000) },
  uv: { mode: "ion", title: "Ultrabinafsha nurlar", lesson: "Ultrabinafsha nurlar kuchsizroq ionlaydi: to‘yinish toki pikoamperlarda. Ionlagich quvvati tokni belgilaydi — dozimetrlar shu tamoyilda ishlaydi.", set: setIon("uv", 100) },
  town: { mode: "ion", title: "Zarbli ionlanish", lesson: "U = 33 kV, E = 33 kV/cm: elektronlar molekulalarni urib ionlaydi, ko‘chkilar paydo bo‘ldi — tok to‘yinish tokidan o‘nlab marta katta. «lg I(U)» grafigini oching.", set: setIon("xray", 33000, 1, "log") },
  spark: { mode: "ion", title: "Teshilish — uchqun", lesson: "U teshilish kuchlanishidan katta: razryad mustaqil bo‘ldi — plastinkalar orasida uchqunlar sakraydi. Ionlagichni o‘chirib ko‘ring: uchqun davom etadi.", set: setIon("xray", 37000, 1, "log") },
  atm: { mode: "tube", title: "Atmosfera bosimida", lesson: "Trubkada havo, 760 mm sim. ust., U = 12 kV: razryad yo‘q — 40 cm havo oralig‘ini teshish uchun ~1 MV kerak. Nasosni yoqing.", set: setTube("air", 760, 12000) },
  pumpdown: { mode: "tube", title: "Havoni so‘rib olish", lesson: "Nasos ishlamoqda. Bosim kamaygan sari: avval ingichka shnur, keyin trubkani to‘ldiruvchi tlejli razryad, qatlamlar va nihoyat katod nurlari (yashil shisha). Pashen grafigida nuqtani kuzating.", set: setTube("air", 760, 12000, true) },
  glow: { mode: "tube", title: "Tlejli razryad", lesson: "p = 1 mm sim. ust.: trubka pushti musbat ustun bilan to‘lgan, katod yonida qorong‘i soha va ko‘kish manfiy shu’la. Bosimni kamaytirib, qorong‘i sohaning kengayishini kuzating.", set: setTube("air", 1, 6000) },
  striae: { mode: "tube", title: "Qatlamli ustun", lesson: "p = 0,3 mm sim. ust.: musbat ustun yorug‘ va qorong‘i qatlamlarga bo‘lingan. Qatlamlar oralig‘i bosim kamaysa kattalashadi.", set: setTube("air", 0.3, 5000) },
  rays: { mode: "tube", title: "Katod nurlari", lesson: "p = 0,005 mm sim. ust.: gaz shu’lasi deyarli yo‘q, anod tomondagi shisha yashil yonadi — unga katoddan uchgan elektronlar uriladi.", set: setTube("air", 0.005, 12000) },
  neon: { mode: "tube", title: "Neon (reklama)", lesson: "Neon to‘ldirilgan trubka 2,5 mm sim. ust. da: to‘q sariq-qizil ustun, havoga qaraganda ancha kichik kuchlanishda yonadi. Argon va geliyni ham tanlab ko‘ring.", set: setTube("ne", 2.5, 6000) },
  spark1: { mode: "types", title: "Uchqun (elektrofor mashinasi)", lesson: "Disklar aylanmoqda, Leyden bankalari zaryadlanmoqda: ~50 kV da 1,5 cm havo teshiladi. O‘ng sharni suring — oraliq kattalashsa, uchqunlar kamayadi.", set: setSpark(1.5, 1.5, true) },
  sparkThin: { mode: "types", title: "Bankalarsiz — mayda uchqunlar", lesson: "Leyden bankalari ajratilgan: sig‘im 20 marta kichik — uchqunlar tez-tez, lekin ingichka va kuchsiz (energiya CU²/2).", set: setSpark(0.8, 1.5, false) },
  arc1: { mode: "types", title: "Elektr yoyi", lesson: "Ko‘mirlar 3 mm oraliqda, yoy yonmoqda: I ≈ 12 A, U ≈ 49 V. O‘ng ko‘mirni sekin uzoqlashtiring — tok kamayadi, kuchlanish ortadi va ~6,5 mm da yoy so‘nadi.", set: setArc(5, 3) },
  arcR: { mode: "types", title: "Ballast qarshilik", lesson: "R = 2 Ω: tok katta (~30 A), yoyni ancha uzoqqa cho‘zish mumkin. Reostatni oshirib boring — so‘nish chegarasi qisqaradi. U(I) grafigida yuklama chizig‘i qiyaligi o‘zgaradi.", set: setArc(2, 5) },
  corona1: { mode: "types", title: "Toj razryad (ingichka sim)", lesson: "150 kV ostidagi 3 mm radiusli simda sirt maydoni Pik chegarasidan katta — sim atrofida binafsha toj. Radiusni oshiring: maydon kamayadi va toj yo‘qoladi.", set: setCor(150, 0.3, 1) },
  line: { mode: "types", title: "220 kV liniya simi", lesson: "Haqiqiy 220 kV liniya: fazada 127 kV, sim radiusi 14 mm. Sirt maydoni chegaradan ancha kichik — toj yo‘q. Shuning uchun liniyalar yo‘g‘on sim bilan quriladi.", set: setCor(127, 1.4, 0.85) },
  rain: { mode: "types", title: "Yomg‘irda toj", lesson: "Quruq havoda 200 kV dagi 8 mm simda toj yo‘q. «Yomg‘ir»ni tanlang: tomchilar sirtni g‘adir-budur qiladi (m kamayadi) va toj boshlanadi.", set: setCor(200, 0.8, 0.85) },
};
const GROUPS = [["Ionlash kamerasi", ["none", "flame", "sat", "uv", "town", "spark"]], ["Razryad trubkasi", ["atm", "pumpdown", "glow", "striae", "rays", "neon"]], ["Razryad turlari", ["spark1", "sparkThin", "arc1", "arcR", "corona1", "line", "rain"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { ion: "Manba dastasini buring", tube: "Nasosni yoki klapanni bosing", spark: "O‘ng sharni suring", arc: "O‘ng ko‘mirni suring", corona: "Kuchlanish va sim radiusini o‘zgartiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[gkey()];
  scene.setMode(gkey());
  setTabs();
}
const MODE_DEFAULT = { ion: "sat", tube: "pumpdown" };
const modeDefault = () => (ui.mode === "types" ? KIND_DEFAULT[ui.kind] : MODE_DEFAULT[ui.mode]);
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(b.dataset.modeValue === "types" ? KIND_DEFAULT[ui.kind] : MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null; flashUntil = 0;
  p.set();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncIon(); syncTube(); syncTypes(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "sat");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__discharge = { ion, tube, spark, arc, cor, ui, loadPreset, refresh, ionState, tubeRegime, arcState, scene, frame };
