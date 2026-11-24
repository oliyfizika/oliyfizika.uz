import { detailedStageHeight } from "./apparatus-3d.js?v=20261122-detail4";
import { createVectorLab } from "./vector-lab-3d.js?v=20261122-detail4";
import { bindLabCamera } from "./lab-3d.js?v=20261122-detail4";
// ==========================================================================
// Vektorlar va kuchlarni qo'shish — simulyatsiya (simulations/vectors.html)
// 1) Vektor va proyeksiyalar: koordinata panjarasida vektor uchi suriladi; modul, yo'nalish, aₓ, a_y; k·a.
// 2) Vektorlarni qo'shish: uchburchak va parallelogramm usullari, ayirma a − b; |a + b| = √(a² + b² + 2ab·cosθ).
// 3) Kuchlarni qo'shish: jismga qo'yilgan 2–3 kuch, teng ta'sir etuvchi kuch R, muvozanatlovchi kuch −R,
//    kuchlar ko'pburchagi; muvozanat sharti R = 0.
// Fizika: vectors-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { clamp, fmt, createStage, bindRange, arrow, angleArc } from "./sim-kit.js";
import * as P from "./vectors-physics.js";
import { drawProj, drawSum, drawForces, lastFrame } from "./vectors-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 12px Inter, system-ui, sans-serif";
const LAB = "700 13px Inter, system-ui, sans-serif";
const LIM = 5.5; // vektor uchi chegarasi (katak)

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "vec", hover: null, snap: true };
const V = { a: P.vec(4, 3), k: 1, proj: true };
const A = { a: P.vec(4, 1), b: P.vec(1, 3), meth: "tri", diff: false };
const F = { f: [P.vec(3, 0), P.vec(0, 4), P.vec(-2, -2)], on3: false, bal: false, poly: true, m: 2 };
let presetId = null;
const geo = { handles: [] };
const forces = () => (F.on3 ? F.f : F.f.slice(0, 2));
const R = () => P.resultant(forces());
const unit = () => (ui.mode === "forces" ? "N" : "birlik");
const snapV = (v) => { const s = ui.snap ? 0.5 : 0.05; return P.vec(clamp(Math.round(v.x / s) * s, -LIM, LIM), clamp(Math.round(v.y / s) * s, -LIM, LIM)); };
const thetaAB = () => P.between(A.a, A.b);
const thetaF = () => { const d = P.dirDeg(F.f[1]) - P.dirDeg(F.f[0]); return ((d % 360) + 360) % 360; };

/* ------------------------------------------------------------------ Sahna */

const scene = createVectorLab();
function draw(ctx, stage) { scene.draw(ctx, stage, ui, V, A, F); }
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.42, 310, 350)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "vec") return drawProj(ctx, gs, { r: P.mag(V.a), deg: P.dirDeg(V.a), unit: "birlik", hover: ui.hover });
  if (ui.mode === "add") return drawSum(ctx, gs, { a: P.mag(A.a), b: P.mag(A.b), theta: thetaAB(), diff: A.diff, unit: "birlik", hover: ui.hover });
  return drawForces(ctx, gs, { F1: F.f[0], F2: F.f[1], F3: F.on3 ? F.f[2] : null, theta: thetaF(), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  vec: ["Proyeksiyalarning yo‘nalishga bog‘liqligi", "Vektorni aylantirganda moduli o‘zgarmaydi, proyeksiyalari esa kosinus va sinus bo‘yicha o‘zgaradi; II–IV choraklarda proyeksiya manfiy bo‘ladi."],
  add: ["Yig‘indi va ayirma moduli θ ga bog‘liq", "Vektorlar bir yo‘nalishda (θ = 0°) bo‘lsa |a + b| = a + b eng katta, qarama-qarshi (θ = 180°) bo‘lsa |a + b| = |a − b| eng kichik."],
  forces: ["Natijaviy kuch R(θ)", "F₂ yo‘nalishini F₁ ga nisbatan θ burchakka burganda natijaviy kuch qanday o‘zgaradi. Sariq nuqta — hozirgi holat."],
};
function setTab() { const t = TABS[ui.mode]; $("[data-tabs]").innerHTML = ""; $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render(); }

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const xy = (v) => `(${fmt(v.x, 1)}; ${fmt(v.y, 1)})`;

function updateReadouts() {
  if (ui.mode === "vec") {
    const a = V.a, ka = P.scale(a, V.k);
    setRO("r1", "Modul <i>|a|</i>", fmt(P.mag(a), 2), `a = ${xy(a)}`, "orange");
    setRO("r2", "Yo‘nalish <i>α</i>", u(fmt(P.dirDeg(a), 1), "°"), "x o‘qidan soat strelkasiga teskari");
    setRO("r3", "Proyeksiya <i>a<sub>x</sub></i>", fmt(a.x, 2), `= |a|·cosα`);
    setRO("r4", "Proyeksiya <i>a<sub>y</sub></i>", fmt(a.y, 2), `= |a|·sinα`);
    setRO("r5", "Son <i>k</i>", fmt(V.k, 1), V.k < 0 ? "manfiy — yo‘nalish teskari" : V.k === 0 ? "nol vektor" : "yo‘nalish o‘zgarmaydi");
    setRO("r6", "<i>|k·a|</i>", fmt(P.mag(ka), 2), `k·a = ${xy(ka)}`);
    return;
  }
  if (ui.mode === "add") {
    const a = A.a, b = A.b, s = P.add(a, b), d = P.sub(a, b), th = thetaAB();
    setRO("r1", "<i>|a|</i>", fmt(P.mag(a), 2), `a = ${xy(a)}`);
    setRO("r2", "<i>|b|</i>", fmt(P.mag(b), 2), `b = ${xy(b)}`);
    setRO("r3", "Orasidagi burchak <i>θ</i>", u(fmt(th, 1), "°"), "");
    setRO("r4", "Yig‘indi <i>|a + b|</i>", fmt(P.mag(s), 2), `a + b = ${xy(s)}`, "orange");
    setRO("r5", "Yig‘indining yo‘nalishi", P.mag(s) > 1e-9 ? u(fmt(P.dirDeg(s), 1), "°") : "—", "x o‘qidan");
    setRO("r6", "Ayirma <i>|a − b|</i>", fmt(P.mag(d), 2), `a − b = ${xy(d)}`);
    return;
  }
  const fs = forces(), r = R(), m = P.mag(r);
  setRO("r1", "<i>F</i>₁", u(fmt(P.mag(fs[0]), 2), "N"), `${fmt(P.dirDeg(fs[0]), 0)}°`);
  setRO("r2", "<i>F</i>₂", u(fmt(P.mag(fs[1]), 2), "N"), `${fmt(P.dirDeg(fs[1]), 0)}°; F₁ bilan θ = ${fmt(P.between(fs[0], fs[1]), 0)}°`);
  setRO("r3", "<i>F</i>₃", F.on3 ? u(fmt(P.mag(fs[2]), 2), "N") : "—", F.on3 ? `${fmt(P.dirDeg(fs[2]), 0)}°` : "o‘chirilgan");
  setRO("r4", "Teng ta’sir etuvchi <i>R</i>", u(fmt(m, 2), "N"), m < 0.05 ? "muvozanat" : `R = ${xy(r)} N`, m < 0.05 ? "green" : "orange");
  setRO("r5", "<i>R</i> yo‘nalishi", m < 0.05 ? "—" : u(fmt(P.dirDeg(r), 1), "°"), "x o‘qidan");
  setRO("r6", "Tezlanish <i>a = R/m</i>", u(fmt(m / F.m, 2), "m/s²"), `m = ${fmt(F.m, 1)} kg`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "purple";
  if (ui.mode === "vec") t = `|a| = ${fmt(P.mag(V.a), 2)}`;
  else if (ui.mode === "add") t = `|a + b| = ${fmt(P.mag(P.add(A.a, A.b)), 2)}`;
  else { const m = P.mag(R()); t = m < 0.05 ? "Muvozanat: R = 0" : `R = ${fmt(m, 2)} N`; tone = m < 0.05 ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "vec") {
    p.push("<p><b>Skalyar kattalik</b> faqat son qiymati bilan aniqlanadi: massa, vaqt, temperatura, yo‘l, energiya. <b>Vektor kattalik</b>ning son qiymati (moduli) va <b>yo‘nalishi</b> bor: ko‘chish, tezlik, tezlanish, kuch. Vektor strelka bilan tasvirlanadi, uzunligi masshtabda modulga teng.</p>");
    p.push(`<p>Vektor uchini sahnada suring. Uning koordinata o‘qlaridagi <b>proyeksiyalari</b> a<sub>x</sub> = |a|·cosα = ${fmt(V.a.x, 2)} va a<sub>y</sub> = |a|·sinα = ${fmt(V.a.y, 2)}; modul |a| = √(a<sub>x</sub>² + a<sub>y</sub>²) = ${fmt(P.mag(V.a), 2)}. Vektorni k songa ko‘paytirsak, moduli |k| marta o‘zgaradi, k &lt; 0 bo‘lsa yo‘nalishi teskariga almashadi.</p>`);
  } else if (ui.mode === "add") {
    p.push(A.meth === "tri" ? "<p><b>Uchburchak usuli:</b> b vektorning boshi a vektorning uchiga qo‘yiladi; a ning boshidan b ning uchiga o‘tkazilgan vektor — yig‘indi a + b.</p>" : "<p><b>Parallelogramm usuli:</b> a va b bir nuqtadan qo‘yiladi va ularga parallelogramm quriladi; umumiy nuqtadan chiqqan diagonal — yig‘indi a + b.</p>");
    p.push(`<p>Yig‘indining moduli vektorlar orasidagi burchakka bog‘liq: |a + b| = √(a² + b² + 2ab·cosθ) = ${fmt(P.mag(P.add(A.a, A.b)), 2)} (θ = ${fmt(thetaAB(), 1)}°). Koordinatalarda esa proyeksiyalar shunchaki qo‘shiladi: (a + b)<sub>x</sub> = a<sub>x</sub> + b<sub>x</sub>. Ayirma a − b — bu a + (−b).</p>`);
  } else {
    const m = P.mag(R());
    p.push("<p>Jismga bir nechta kuch ta’sir qilsa, ularni bitta <b>teng ta’sir etuvchi (natijaviy) kuch</b> R = F₁ + F₂ + … bilan almashtirish mumkin — u jismga xuddi shunday ta’sir qiladi. Kuchlar vektorlar kabi qo‘shiladi; shtrix chiziqlar — <b>kuchlar ko‘pburchagi</b>.</p>");
    p.push(m < 0.05 ? "<p><b>R = 0 — muvozanat:</b> kuchlar ko‘pburchagi yopiq. Nyutonning 1-qonuniga ko‘ra jism tinch turadi yoki to‘g‘ri chiziqli tekis harakat qiladi.</p>" : `<p>R = ${fmt(m, 2)} N ≠ 0, shuning uchun jism Nyutonning 2-qonuniga ko‘ra a = R/m = ${fmt(m / F.m, 2)} m/s² tezlanish bilan R yo‘nalishida harakatlanadi. Jismni muvozanatlash uchun <b>muvozanatlovchi kuch</b> −R qo‘yish kerak.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() { const html = ui.mode === "vec" ? "<small>Proyeksiyalar</small> |a| = √(a<sub>x</sub>² + a<sub>y</sub>²)" : ui.mode === "add" ? "<small>Qo‘shish</small> |a + b|² = a² + b² + 2ab·cosθ" : "<small>Natijaviy kuch</small> R = F₁ + F₂ + F₃"; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function syncControls() {
  vRC.set(P.mag(V.a)); vAC.set(Math.round(P.dirDeg(V.a))); vKC.set(V.k); $("#vProj").checked = V.proj;
  bRC.set(P.mag(A.b)); thC.set(Math.round(thetaAB())); $("#aDiff").checked = A.diff;
  document.querySelectorAll("[data-meth-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.methValue === A.meth)));
  f1C.set(P.mag(F.f[0])); f2C.set(P.mag(F.f[1])); fThC.set(Math.round(thetaF())); fmC.set(F.m);
  $("#f3").checked = F.on3; $("#fBal").checked = F.bal; $("#fPoly").checked = F.poly; $("#snap").checked = ui.snap;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Boshqaruv */

$("[data-play]").hidden = true;
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || MODE_DEFAULT[ui.mode]));
const r2 = (v) => Math.round(v * 100) / 100;
const vRC = bindRange($("#vR"), $("#vROut"), (v) => fmt(v, 2), (v) => { V.a = P.polar(v, P.dirDeg(V.a)); V.a = P.vec(r2(V.a.x), r2(V.a.y)); customized(); refresh(); });
const vAC = bindRange($("#vA"), $("#vAOut"), (v) => `${fmt(v, 0)}°`, (v) => { V.a = P.polar(P.mag(V.a), v); V.a = P.vec(r2(V.a.x), r2(V.a.y)); customized(); refresh(); });
const vKC = bindRange($("#vK"), $("#vKOut"), (v) => fmt(v, 1), (v) => { V.k = v; customized(); refresh(); });
$("#vProj").addEventListener("change", (e) => { V.proj = e.target.checked; customized(); refresh(); });
const bRC = bindRange($("#bR"), $("#bROut"), (v) => fmt(v, 2), (v) => { A.b = P.polar(v, P.dirDeg(A.b)); A.b = P.vec(r2(A.b.x), r2(A.b.y)); customized(); refresh(); syncControls(); });
const thC = bindRange($("#aTh"), $("#aThOut"), (v) => `${fmt(v, 0)}°`, (v) => { A.b = P.polar(P.mag(A.b), P.dirDeg(A.a) + v); A.b = P.vec(r2(A.b.x), r2(A.b.y)); customized(); refresh(); });
$("#aDiff").addEventListener("change", (e) => { A.diff = e.target.checked; customized(); refresh(); });
document.querySelectorAll("[data-meth-value]").forEach((b) => b.addEventListener("click", () => { A.meth = b.dataset.methValue; customized(); syncControls(); refresh(); }));
const f1C = bindRange($("#f1"), $("#f1Out"), (v) => `${fmt(v, 1)} N`, (v) => { F.f[0] = P.polar(v, P.dirDeg(F.f[0])); F.f[0] = P.vec(r2(F.f[0].x), r2(F.f[0].y)); customized(); refresh(); });
const f2C = bindRange($("#f2"), $("#f2Out"), (v) => `${fmt(v, 1)} N`, (v) => { F.f[1] = P.polar(v, P.dirDeg(F.f[1])); F.f[1] = P.vec(r2(F.f[1].x), r2(F.f[1].y)); customized(); refresh(); });
const fThC = bindRange($("#fTh"), $("#fThOut"), (v) => `${fmt(v, 0)}°`, (v) => { F.f[1] = P.polar(P.mag(F.f[1]), P.dirDeg(F.f[0]) + v); F.f[1] = P.vec(r2(F.f[1].x), r2(F.f[1].y)); customized(); refresh(); });
const fmC = bindRange($("#fm"), $("#fmOut"), (v) => `${fmt(v, 1)} kg`, (v) => { F.m = v; customized(); refresh(); });
$("#f3").addEventListener("change", (e) => { F.on3 = e.target.checked; customized(); refresh(); });
$("#fBal").addEventListener("change", (e) => { F.bal = e.target.checked; customized(); refresh(); });
$("#fPoly").addEventListener("change", (e) => { F.poly = e.target.checked; customized(); refresh(); });
$("#snap").addEventListener("change", (e) => { ui.snap = e.target.checked; });

/* Sahnada surish */
const canvas = stage.canvas;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  move(id, pointer) {
    const point = scene.point(pointer.x, pointer.y); if (!point) return;
    const v = snapV(point);
    if (id === "a") { if (ui.mode === "vec") V.a = v; else A.a = v; }
    else if (id === "b") A.b = A.meth === "tri" ? snapV(P.sub(v, A.a)) : v;
    else F.f[Number(id[1])] = v;
    customized(); syncControls(); refresh();
  },
});

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h, x0 = f.xMin ?? 0; ui.hover = inside ? x0 + ((p.x - r.x) / r.w) * (f.xMax - x0) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Presetlar */

const T = Math.round(5 / (2 * Math.sin(30 * P.DEG)) * 100) / 100;
const PRESETS = {
  vecBasic: { mode: "vec", title: "Vektor va uning moduli", lesson: "a = (4; 3): moduli |a| = √(4² + 3²) = 5. Vektor uchini sahnada surib ko‘ring.", set: () => Object.assign(V, { a: P.vec(4, 3), k: 1, proj: true }) },
  vecProj: { mode: "vec", title: "Manfiy proyeksiya", lesson: "Vektor II chorakda: x o‘qidagi proyeksiya manfiy, y o‘qidagi musbat. Proyeksiya ishorasi vektor yo‘nalishiga bog‘liq.", set: () => Object.assign(V, { a: P.vec(-3, 4), k: 1, proj: true }) },
  vecScale: { mode: "vec", title: "Vektorni songa ko‘paytirish", lesson: "k = −1,5: k·a vektorning moduli 1,5 marta katta, yo‘nalishi teskari. k slayderini o‘zgartiring.", set: () => Object.assign(V, { a: P.vec(2, 1.5), k: -1.5, proj: false }) },
  addTri: { mode: "add", title: "Uchburchak usuli", lesson: "b ning boshi a ning uchida. a ning boshidan b ning uchigacha — yig‘indi a + b. Vektorlar uchlarini surib ko‘ring.", set: () => Object.assign(A, { a: P.vec(4, 1), b: P.vec(1, 3), meth: "tri", diff: false }) },
  addPar: { mode: "add", title: "Parallelogramm usuli", lesson: "a va b bir nuqtadan qo‘yilgan; yig‘indi — parallelogramm diagonali.", set: () => Object.assign(A, { a: P.vec(4, 1), b: P.vec(1, 3), meth: "par", diff: false }) },
  addSame: { mode: "add", title: "Bir yo‘nalishdagi vektorlar", lesson: "θ = 0°: |a + b| = a + b = 5 — eng katta qiymat.", set: () => Object.assign(A, { a: P.vec(3, 0), b: P.vec(2, 0), meth: "tri", diff: false }) },
  addOpp: { mode: "add", title: "Qarama-qarshi vektorlar", lesson: "θ = 180°: |a + b| = a − b = 1 — eng kichik qiymat.", set: () => Object.assign(A, { a: P.vec(3, 0), b: P.vec(-2, 0), meth: "tri", diff: false }) },
  addRight: { mode: "add", title: "Perpendikulyar: Pifagor", lesson: "θ = 90°: |a + b| = √(3² + 4²) = 5 (cos90° = 0).", set: () => Object.assign(A, { a: P.vec(3, 0), b: P.vec(0, 4), meth: "par", diff: false }) },
  addDiff: { mode: "add", title: "Vektorlar ayirmasi a − b", lesson: "a − b vektor b ning uchidan a ning uchiga yo‘nalgan. Parallelogrammning ikkinchi diagonali.", set: () => Object.assign(A, { a: P.vec(4, 1), b: P.vec(1, 3), meth: "par", diff: true }) },
  fTwo: { mode: "forces", title: "Ikki kuch: 3 N va 4 N", lesson: "O‘zaro perpendikulyar 3 N va 4 N kuchlarning teng ta’sir etuvchisi 5 N. Kuchlar uchini surib ko‘ring.", set: () => Object.assign(F, { f: [P.vec(3, 0), P.vec(0, 4), P.vec(-2, -2)], on3: false, bal: false, poly: true, m: 2 }) },
  fAngle: { mode: "forces", title: "Teng kuchlar 120° ostida", lesson: "Har biri 4 N li kuchlar orasidagi burchak 120°: natijaviy kuch ham 4 N. θ slayderi bilan burchakni o‘zgartiring.", set: () => Object.assign(F, { f: [P.polar(4, 0), P.polar(4, 120), P.vec(-2, -2)].map((v) => P.vec(r2(v.x), r2(v.y))), on3: false, bal: false, poly: true, m: 2 }) },
  fEq: { mode: "forces", title: "Uch kuch muvozanati", lesson: "Uchta 4 N kuch 120° dan: kuchlar ko‘pburchagi yopiq, R = 0 — jism muvozanatda.", set: () => Object.assign(F, { f: [P.polar(4, 90), P.polar(4, 210), P.polar(4, 330)].map((v) => P.vec(r2(v.x), r2(v.y))), on3: true, bal: false, poly: true, m: 2 }) },
  fLamp: { mode: "forces", title: "Ikki simdagi chiroq", lesson: `Og‘irligi 5 N chiroq gorizontga 30° qiya ikki simga osilgan: har bir simning taranglik kuchi T = mg/(2·sin30°) = ${fmt(T, 0)} N. Simlar qanchalik yotiq bo‘lsa, taranglik shunchalik katta.`, set: () => Object.assign(F, { f: [P.polar(T, 30), P.polar(T, 150), P.vec(0, -5)].map((v) => P.vec(r2(v.x), r2(v.y))), on3: true, bal: false, poly: true, m: 0.5 }) },
  fBalance: { mode: "forces", title: "Muvozanatlovchi kuch", lesson: "R ga teng va qarama-qarshi yo‘nalgan −R kuch qo‘yilsa, jism muvozanatga keladi.", set: () => Object.assign(F, { f: [P.vec(4, 1), P.vec(1, 3), P.vec(-2, -2)], on3: false, bal: true, poly: true, m: 2 }) },
};
const GROUPS = [["Vektor va proyeksiyalar", ["vecBasic", "vecProj", "vecScale"]], ["Vektorlarni qo‘shish", ["addTri", "addPar", "addSame", "addOpp", "addRight", "addDiff"]], ["Kuchlarni qo‘shish", ["fTwo", "fAngle", "fEq", "fLamp", "fBalance"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { vec: "Vektor uchini suring", add: "a va b vektorlar uchini suring", forces: "Kuchlar uchini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { vec: "Koordinata panjarasidagi vektor va uning proyeksiyalari", add: "Ikki vektor va ularning yig‘indisi", forces: "Jismga qo‘yilgan kuchlar va teng ta’sir etuvchi kuch" }[ui.mode]);
}
const MODE_DEFAULT = { vec: "vecBasic", add: "addTri", forces: "fTwo" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  ui.hover = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncControls(); setTab(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "vecBasic");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
