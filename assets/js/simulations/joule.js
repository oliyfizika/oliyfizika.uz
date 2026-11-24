// ==========================================================================
// Tok ishi, quvvati va Joul–Lens qonuni — virtual laboratoriya (simulations/joule.html)
// 1) Joul–Lens: laboratoriya manbai, pichoqli kalit, ampermetr, voltmetr va suvli kalorimetr(lar) ichidagi nixrom spiral.
//    Termometr va sekundomer bo'yicha ΔT(t); spirallar bitta, ketma-ket (Q ∝ R) yoki parallel (Q ∝ 1/R); FIK.
// 2) Lampa quvvati: LATR (laboratoriya avtotransformatori), o'zgaruvchan tok voltmetri va ampermetri, patronlardagi
//    cho'g'lanma lampalar; tola temperaturasi bo'yicha rang va yorqinlik, 40 W va 100 W ketma-ket/parallel.
// 3) Uy tarmog'i: impulsli elektr hisoblagich (kVt·soat), avtomat saqlagich, parallel ulangan maishiy iste'molchilar.
// Sahna — 360° 3D laboratoriya (joule-lab-3d.js): bo'sh joydan sudrash kamerani aylantiradi. Fizika: joule-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./joule-physics.js";
import { drawHeat, drawLamp, drawLine, lastFrame } from "./joule-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-n3";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261124-n3";
import { createJouleLab } from "./joule-lab-3d.js?v=20261124-n3";

const $ = (s) => document.querySelector(s);
const SUB = "₁₂";

/* ------------------------------------------------------------------ Holat */

const R_INT = 0.3, CUP_M = 0.05, METER0 = 4521.3, IMP = 3200;
const ui = { mode: "kal", view: { kal: "T", lamp: "I", home: "I" }, hover: null, speed: 10 };
const kal = { E: 8, R1: 2, R2: 4, m: 150, conn: "single", closed: false, t: 0, T: [P.T_ROOM, P.T_ROOM], Qe: [0, 0], hist: [], histT: 0 };
const lamp = { a: "l40", b: "none", conn: "series", U: 220 };
const HOME_IDS = ["kettle", "iron", "heater", "washer", "ac", "fridge", "tv", "pc", "lamp", "led"];
const SHORT = { kettle: "Choynak", iron: "Dazmol", heater: "Isitgich", washer: "Kir mashina", ac: "Konditsioner", fridge: "Muzlatkich", tv: "Televizor", pc: "Kompyuter", lamp: "Lampa", led: "LED lampa" };
const home = { on: {}, In: 16, tariff: 1000, t: 0, E: 0, acc: 0, tripped: false, why: "", hist: [], histT: 0, pulse: 0, pulses: 0, flow: 0 };
let presetId = null;
let running = false;
let anim = 0;

/* ------------------------------------------------------------------ Asbob shkalasi */

const RANGES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
const range = (v) => RANGES.find((r) => r >= v * 1.04) || 20;

/* ------------------------------------------------------------------ 1) Kalorimetr */

const kalN = () => (kal.conn === "single" ? 1 : 2);
const kalC = () => P.heatCapacity(kal.m / 1000, CUP_M);
function kalCirc() {
  const h = P.heaters(kal.E, R_INT, [kal.R1, kal.R2], kal.conn);
  if (kal.closed) return h;
  return { I: 0, U: 0, R: h.R, parts: h.parts.map((p) => ({ R: p.R, I: 0, U: 0, P: 0 })) };
}
function pushKal() {
  const n = kalN(), C = kalC();
  kal.hist.push({ t: kal.t, T: kal.T.slice(0, n), Qe: kal.Qe.slice(0, n), Qa: kal.T.slice(0, n).map((T) => C * (T - P.T_ROOM)) });
  kal.histT = kal.t;
  if (kal.hist.length > 1200) kal.hist = kal.hist.filter((_, i, a) => i % 2 === 0 || i === a.length - 1);
}
function resetKal() { kal.t = 0; kal.T = [P.T_ROOM, P.T_ROOM]; kal.Qe = [0, 0]; kal.hist = []; pushKal(); }
function stepKal(dt) {
  if (!kal.closed) return;
  const h = kalCirc(), C = kalC();
  h.parts.forEach((p, i) => { kal.T[i] = Math.min(P.BOIL, P.stepTemp(kal.T[i], dt, p.P, C)); kal.Qe[i] += p.P * dt; });
  kal.t += dt;
  if (kal.t - kal.histT >= Math.max(1, kal.t / 400)) pushKal();
}

/* ------------------------------------------------------------------ 2) Lampa */

const lampList = () => [P.LAMPS[lamp.a], lamp.b !== "none" ? P.LAMPS[lamp.b] : null].filter(Boolean);
const small = () => lamp.a === "l6";
const Umax = () => (small() ? 8 : 250);
function lampCirc() {
  const ls = lampList();
  if (ls.length === 1 || lamp.conn === "parallel") return { ...P.parallelLamps(ls, lamp.U), series: false };
  const r = P.seriesLamps(ls, lamp.U);
  return { I: r.I, parts: r.parts.map((p) => ({ ...p, I: r.I })), series: true };
}

/* ------------------------------------------------------------------ 3) Uy tarmog'i */

const homeP = () => (home.tripped ? 0 : HOME_IDS.reduce((sum, id) => sum + (home.on[id] ? P.APPLIANCES[id].P : 0), 0));
const homeLoad = () => HOME_IDS.reduce((sum, id) => sum + (home.on[id] ? P.APPLIANCES[id].P : 0), 0);
const homeI = () => homeP() / P.MAINS;
const homeWin = () => (ui.speed >= 60 ? 3600 : ui.speed >= 10 ? 600 : 60);
function pushHome() { home.hist.push({ t: home.t, I: homeI() }); home.histT = home.t; if (home.hist.length > 1500) home.hist = home.hist.filter((p) => p.t >= home.t - homeWin() * 1.2); }
function trip(why) { home.tripped = true; home.why = why; home.acc = 0; pushHome(); flashStatus(why === "mag" ? "Qisqa tutashuvdek katta tok — avtomat bir zumda uzildi" : "Ortiqcha yuklanish — avtomat qizib uzildi"); }
function stepHome(sdt, dt) {
  const I = homeI(), lim = (P.FUSE_K * home.In) ** 2;
  home.t += sdt; home.E += P.kWh(homeP(), sdt);
  if (!home.tripped) {
    if (I > 5 * home.In) trip("mag");
    else { home.acc = I * I > lim ? home.acc + (I * I - lim) * sdt : Math.max(0, home.acc - (lim - I * I) * sdt * 0.5); if (home.acc >= P.fuseW(home.In)) trip("heat"); }
  }
  const np = Math.floor(home.E * IMP); if (np > home.pulses) { home.pulses = np; home.pulse = 0.09; }
  home.pulse = Math.max(0, home.pulse - dt); home.flow += dt * homeI() * 1.2;
  if (home.t - home.histT >= homeWin() / 300) pushHome();
}

const HEATING = { kettle: 1, iron: 1, heater: 1 };

/* ------------------------------------------------------------------ Sahna (360° 3D laboratoriya: joule-lab-3d.js) */

const scene = createJouleLab();
const POWER = Object.fromEntries(HOME_IDS.map((id) => [id, P.APPLIANCES[id].P]));
const clock = (t) => { const d = Math.floor(t * 10), m = Math.floor(d / 600), s = Math.floor((d % 600) / 10); return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${d % 10}`; };
/** Sahna uchun joriy qiymatlar (faqat o'qiladi). */
function frame() {
  if (ui.mode === "kal") {
    const h = kalCirc(), n = kalN();
    return { mode: "kal", anim, kal: { n, conn: kal.conn, E: kal.E, closed: kal.closed, I: h.I, Ir: range(h.I), U: h.U, parts: h.parts, T: kal.T, m: kal.m, t: kal.t, clock: clock(kal.t), running: kal.closed && running, labels: h.parts.map((p, i) => `R${n > 1 ? SUB[i] : ""} ${fmt(p.R, 1)} Ω · ${fmt(kal.T[i], 1)} °C`) } };
  }
  if (ui.mode === "lamp") {
    const r = lampCirc();
    return { mode: "lamp", anim, lamp: { U: lamp.U, Umax: Umax(), small: small(), I: r.I, Ir: range(r.I), Vmax: small() ? 10 : 300, lamps: lampList(), parts: r.parts.map((p) => ({ ...p, b: P.brightness(p.T) })), series: r.series } };
  }
  return { mode: "home", anim, home: { I: homeI(), reading: (METER0 + home.E).toFixed(2).padStart(8, "0").replace(".", ","), pulse: home.pulse > 0, imp: IMP, tripped: home.tripped, In: home.In, ids: HOME_IDS, on: home.on, P: POWER, heating: HEATING, names: SHORT, t: home.t } };
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), (ctx, stg) => scene.draw(ctx, stg, frame()), { height: detailedStageHeight });

/* ------------------------------------------------------------------ Grafik */

function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "kal") {
    const h = kalCirc(), C = kalC();
    return drawHeat(ctx, gs, { view: ui.view.kal, hist: kal.hist, n: kalN(), C: [C, C], P: h.parts.map((p) => p.P), R: h.parts.map((p) => p.R), hover: ui.hover });
  }
  if (ui.mode === "lamp") { const r = lampCirc(); return drawLamp(ctx, gs, { view: ui.view.lamp, lamps: lampList(), Umax: Umax(), pts: r.parts, hover: ui.hover }); }
  return drawLine(ctx, gs, { hist: home.hist, In: home.In, win: homeWin(), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  kal: [["T", "T(t)", "Suv temperaturasi T(t)", "Uzluksiz chiziq — termometr ko‘rsatishi, shtrix — issiqlik yo‘qotilmaganda bo‘ladigan T₀ + Pt/C. Boshida ular ustma-ust: ΔT vaqtga proporsional. Suv isigan sari atrofga ko‘proq issiqlik ketadi."],
    ["Q", "Q(t)", "Spiral bergan va suv olgan issiqlik", "Uzluksiz — spiralda ajralgan Q = I²Rt, shtrix — suv va idish olgan cmΔT. Ular orasidagi farq — atrofga yo‘qotilgan issiqlik (FIK < 100 %)."]],
  lamp: [["I", "I(U)", "Lampaning volt-amper xarakteristikasi", "Uzluksiz — cho‘g‘lanma lampa, shtrix — qarshiligi o‘zgarmas bo‘lganda (Om qonuni). Tola qizigan sari qarshiligi ortadi, shuning uchun egri chiziq to‘g‘ri chiziqdan pastda. Nuqta — hozirgi ish holati."],
    ["P", "P(U)", "Lampa quvvatining kuchlanishga bog‘liqligi", "R o‘zgarmas bo‘lsa P = U²/R (shtrix parabola). Lampada qarshilik ortgani uchun quvvat sekinroq o‘sadi: kuchlanish yarmida quvvat 25 % emas, ~33 %."]],
  home: [["I", "I(t)", "Tarmoqdagi tok I(t)", "Har bir iste’molchi yoqilganda tok ΣP/U ga sakraydi. Qizil soha — 1,45·Iₙ dan katta tok: unda avtomatning bimetall plastinkasi qiziydi va bir necha soniyada uziladi."]],
};
function setTabs() {
  const box = $("[data-tabs]"), tabs = TABS[ui.mode], cur = ui.view[ui.mode], t = tabs.find((x) => x[0] === cur);
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === cur}">${name}</button>`).join("");
  box.hidden = tabs.length < 2;
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[ui.mode] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const fJ = (q) => (Math.abs(q) >= 1e6 ? u(fmt(q / 1e6, 2), "MJ") : Math.abs(q) >= 1e3 ? u(fmt(q / 1e3, Math.abs(q) >= 1e5 ? 0 : 1), "kJ") : u(fmt(q, 0), "J"));
const fW = (p) => (p >= 1000 ? u(fmt(p / 1000, 2), "kW") : u(fmt(p, p < 10 ? 2 : p < 100 ? 1 : 0), "W"));
const tText = (t) => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return t >= 3600 ? `${Math.floor(t / 3600)} soat ${Math.floor((t % 3600) / 60)} min` : m ? `${m} min ${s} s` : `${fmt(t, 1)} s`; };
const money = (v) => `${fmt(v, v < 10 ? 1 : 0)} so‘m`;

function updateReadouts() {
  if (ui.mode === "kal") {
    const h = kalCirc(), n = kalN(), C = kalC(), dT = kal.T.slice(0, n).map((T) => T - P.T_ROOM), Qe = kal.Qe.slice(0, n).reduce((a, b) => a + b, 0), Qa = dT.reduce((a, b) => a + C * b, 0);
    setRO("r1", "Tok kuchi <i>I</i> (ampermetr)", u(fmt(h.I, 2), "A"), kal.closed ? `I = E/(R + r) = ${fmt(kal.E, 1)}/(${fmt(h.R, 2)} + ${fmt(R_INT, 1)})` : "kalit uzilgan", kal.closed ? "blue" : "");
    setRO("r2", "Kuchlanish <i>U</i> (voltmetr)", u(fmt(h.U, 2), "V"), n > 1 ? h.parts.map((p, i) => `U${SUB[i]} = ${fmt(p.U, 2)} V`).join(", ") : "spiral uchlarida");
    setRO("r3", "Quvvat <i>P</i> = <i>UI</i>", fW(h.U * h.I), n > 1 ? h.parts.map((p, i) => `P${SUB[i]} = ${fmt(p.P, 1)} W`).join(", ") : `P = I²R = ${fmt(h.I * h.I * h.R, 1)} W`, "orange");
    setRO("r4", "Vaqt <i>t</i> (sekundomer)", kal.t < 60 ? u(fmt(kal.t, 1), "s") : u(`${Math.floor(kal.t / 60)}:${String(Math.floor(kal.t % 60)).padStart(2, "0")}`, "min"), `tezlik ${ui.speed}×`);
    setRO("r5", "Temperatura <i>T</i>", u(kal.T.slice(0, n).map((T) => fmt(T, 1)).join(" | "), "°C"), `ΔT = ${dT.map((d) => fmt(d, 1)).join(" | ")} K; C = ${fmt(C, 0)} J/K${kal.T.slice(0, n).some((T) => T >= P.BOIL - 0.05) ? " · qaynamoqda" : ""}`, kal.T.some((T) => T >= P.BOIL - 0.05) ? "red" : "");
    setRO("r6", "Issiqlik <i>Q</i> = <i>I</i>²<i>Rt</i>", fJ(Qe), Qe > 50 ? `suv va idish oldi cmΔT = ${fmt(Qa / 1000, 2)} kJ, FIK η = ${fmt((Qa / Qe) * 100, 1)} %` : "kalitni ulang va kuting", "green");
  } else if (ui.mode === "lamp") {
    const ls = lampList(), r = lampCirc(), p1 = r.parts[0], p2 = r.parts[1];
    setRO("r1", "Kuchlanish <i>U</i> (LATR, voltmetr)", u(fmt(lamp.U, small() ? 1 : 0), "V"), "o‘zgaruvchan tok, ta’sir etuvchi qiymat");
    setRO("r2", "Zanjirdagi tok <i>I</i> (ampermetr)", u(fmt(r.I, 3), "A"), ls.length < 2 ? `nominal tok Iₙ = ${fmt(P.ratedI(ls[0]), 3)} A` : r.series ? "ketma-ket: ikkala lampada bir xil" : `I = I₁ + I₂ = ${fmt(p1.I, 3)} + ${fmt(p2.I, 3)}`, "blue");
    setRO("r3", `${ls[0].name} lampa quvvati <i>P</i>${ls.length > 1 ? "₁" : ""}`, fW(p1.P), `U${ls.length > 1 ? "₁" : ""} = ${fmt(p1.U, 1)} V; nominaldan ${fmt((p1.P / ls[0].Pn) * 100, 0)} %`, "orange");
    if (p2) setRO("r4", `${ls[1].name} lampa quvvati <i>P</i>₂`, fW(p2.P), `U₂ = ${fmt(p2.U, 1)} V; nominaldan ${fmt((p2.P / ls[1].Pn) * 100, 0)} %`, "orange");
    else setRO("r4", "Elektr energiya (1 soatda)", u(fmt(P.kWh(p1.P, 3600) * 1000, 1), "W·soat"), `W = Pt; 1 kVt·soat = 3,6 MJ`);
    setRO("r5", `Tola qarshiligi <i>R</i>${ls.length > 1 ? "₁" : ""} = <i>U/I</i>`, u(fmt(P.lampR(ls[0], p1.U), 0), "Ω"), `sovuq tola ${fmt(P.coldR(ls[0]), ls[0].Un < 50 ? 1 : 0)} Ω; nominalda ${fmt((ls[0].Un * ls[0].Un) / ls[0].Pn, ls[0].Un < 50 ? 1 : 0)} Ω`);
    setRO("r6", "Tola temperaturasi <i>T</i>", u(r.parts.map((p) => fmt(p.T, 0)).join(" | "), "K"), `yorqinlik: ${r.parts.map((p) => `${fmt(P.brightness(p.T) * 100, 0)} %`).join(" | ")} (nominalga nisbatan)`, "red");
  } else {
    const Pw = homeP(), I = homeI(), lim = P.FUSE_K * home.In, left = I > lim && !home.tripped ? (P.fuseW(home.In) - home.acc) / (I * I - lim * lim) : null, nOn = HOME_IDS.filter((id) => home.on[id]).length;
    setRO("r1", "Iste’mol quvvati <i>P</i> = Σ<i>P</i><sub>i</sub>", fW(Pw), home.tripped ? `yuklama ${fmt(homeLoad(), 0)} W — avtomat uzilgan` : `${nOn} ta iste’molchi yoqilgan`, "orange");
    setRO("r2", "Tarmoq toki <i>I</i> = <i>P/U</i>", u(fmt(I, 1), "A"), `U = 220 V; avtomat Iₙ = ${home.In} A`, I > lim ? "red" : I > home.In ? "orange" : "blue");
    setRO("r3", "Avtomat", home.tripped ? "uzildi" : left != null ? u(`~${fmt(Math.max(0, left), 0)}`, "s") : "yoqilgan", home.tripped ? (home.why === "mag" ? "elektromagnit uzgich: I > 5Iₙ" : home.why === "heat" ? "bimetall plastinka qizib egildi" : "qo‘lda o‘chirilgan") : left != null ? `I > 1,45·Iₙ = ${fmt(lim, 1)} A — uzilishigacha` : `${fmt(lim, 1)} A gacha uzoq vaqt ishlaydi`, home.tripped ? "red" : left != null ? "orange" : "green");
    setRO("r4", "Sarflangan energiya <i>W</i>", u(fmt(home.E, home.E < 1 ? 3 : 2), "kVt·soat"), `t = ${tText(home.t)}; hisoblagich ${home.pulses} impuls`);
    setRO("r5", "Narxi", u(fmt(home.E * home.tariff, home.E * home.tariff < 10 ? 1 : 0), "so‘m"), `tarif ${fmt(home.tariff, 0)} so‘m / kVt·soat`, "green");
    setRO("r6", "Shu yuklamada 1 soatda", u(fmt(Pw / 1000, 2), "kVt·soat"), `${money((Pw / 1000) * home.tariff)}; oyiga (kuniga 3 soat) ${money((Pw / 1000) * 90 * home.tariff)}`);
  }
}
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "kal") {
    if (!kal.closed) { t = "Kalit uzilgan — tok yo‘q"; tone = ""; }
    else if (kal.T.slice(0, kalN()).some((T) => T >= P.BOIL - 0.05)) { t = "Suv qaynamoqda"; tone = "red"; }
    else { t = `Tok o‘tmoqda — suv isimoqda (${ui.speed}×)`; tone = "orange"; }
  } else if (ui.mode === "lamp") {
    const r = lampCirc(), ls = lampList();
    if (lamp.U < 0.5 || r.parts.every((p) => P.brightness(p.T) < 0.002)) { t = lamp.U < 0.5 ? "LATR nolda — lampalar o‘chiq" : "Tola qizarmagan — yorug‘lik yo‘q"; tone = ""; }
    else if (ls.length === 2 && r.series && ls[0].Pn !== ls[1].Pn) { const k = r.parts[0].P > r.parts[1].P ? 0 : 1; t = `Ketma-ket: ${ls[k].name} lampa yorqinroq`; tone = "orange"; }
    else { t = `Yorqinlik ${fmt(P.brightness(r.parts[0].T) * 100, 0)} %`; tone = "orange"; }
  } else {
    const I = homeI(), lim = P.FUSE_K * home.In;
    if (home.tripped) { t = home.why ? "Avtomat uzildi — iste’molchilarni kamaytirib, qayta yoqing" : "Avtomat o‘chirilgan"; tone = "red"; }
    else if (I > lim) { t = "Ortiqcha yuklanish! Avtomat qizimoqda"; tone = "red"; }
    else if (I > 0) { t = `Tok ${fmt(I, 1)} A — me’yorda`; tone = "green"; }
    else { t = "Barcha iste’molchilar o‘chiq"; tone = ""; }
  }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2200; }

let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "kal") {
    const h = kalCirc(), C = kalC();
    p.push(`<p>Tok o‘tganda o‘tkazgichdagi erkin elektronlar maydon bajargan ish hisobiga tezlanadi va kristall panjara ionlariga urilib, energiyasini ularga beradi — o‘tkazgich qiziydi. Ajralgan issiqlik <b>Joul–Lens qonuni</b> bilan topiladi: <b>Q = I²Rt</b>. Spiral suvga botirilgan, shuning uchun issiqlik suv va alyuminiy stakanni isitadi: <b>Q = cmΔT</b>, C = ${fmt(C, 0)} J/K.</p>`);
    if (kal.conn === "series") p.push(`<p><b>Ketma-ket</b> ulanganda ikkala spiraldan bir xil tok o‘tadi (${fmt(h.I, 2)} A), shuning uchun Q₁/Q₂ = R₁/R₂ = ${fmt(kal.R1 / kal.R2, 2)}: qarshiligi katta spiral ko‘proq issiqlik beradi. Termometrlarni solishtiring.</p>`);
    else if (kal.conn === "parallel") p.push(`<p><b>Parallel</b> ulanganda spirallardagi kuchlanish bir xil (${fmt(h.U, 2)} V), Q = U²t/R: endi qarshiligi <b>kichik</b> spiral ko‘proq issiqlik beradi, Q₁/Q₂ = R₂/R₁ = ${fmt(kal.R2 / kal.R1, 2)}. Shuning uchun uydagi kuchli isitgichlarning qarshiligi kichik.</p>`);
    else p.push(`<p>Kuchlanishni 2 marta oshirsangiz, tok ham 2 marta, quvvat esa 4 marta ortadi — suv 4 marta tez isiydi. Qarshilikni o‘zgartirib ko‘ring: manba ichki qarshiligi (${fmt(R_INT, 1)} Ω) tufayli eng katta quvvat R = r da bo‘ladi.</p>`);
    if (kal.t > 30) { const Qe = kal.Qe.slice(0, kalN()).reduce((a, b) => a + b, 0), Qa = kal.T.slice(0, kalN()).reduce((a, T) => a + C * (T - P.T_ROOM), 0); p.push(`<p>Hozircha spiral ${fmt(Qe / 1000, 2)} kJ issiqlik berdi, suv va idish ${fmt(Qa / 1000, 2)} kJ oldi — kalorimetr FIK ${fmt((Qa / Math.max(1, Qe)) * 100, 1)} %. Qolgani g‘ilof va qopqoq orqali havoga ketdi; suv qancha issiq bo‘lsa, yo‘qotish shuncha katta.</p>`); }
  } else if (ui.mode === "lamp") {
    const r = lampCirc(), ls = lampList();
    p.push(`<p>Cho‘g‘lanma lampada volfram tola tok bilan ~2700 K gacha qiziydi va nur sochadi. Volfram qarshiligi temperatura bilan kuchli ortadi: sovuq tolaning qarshiligi ${fmt(P.coldR(ls[0]), 0)} Ω, ish holatida esa ${fmt((ls[0].Un * ls[0].Un) / ls[0].Pn, 0)} Ω. Shuning uchun lampa yoqilgan zahoti tok bir necha marta katta bo‘ladi va lampalar ko‘pincha aynan yoqilganda kuyadi.</p>`);
    if (ls.length === 2 && r.series) p.push(`<p><b>Ketma-ket</b>: tok bir xil, quvvat P = I²R. Nominal quvvati kichik lampaning (${ls[0].Pn < ls[1].Pn ? ls[0].name : ls[1].name}) qarshiligi katta, shuning uchun unda kuchlanish va quvvat ko‘p — u yorqinroq yonadi, 100 W lampa esa zo‘rg‘a qizaradi. Ikkalasi ham nominaldan ancha kam quvvat oladi.</p>`);
    else if (ls.length === 2) p.push(`<p><b>Parallel</b>: har bir lampa to‘liq kuchlanishda, P = U²/R. Qarshiligi kichik (nominal quvvati katta) lampa yorqinroq. Uydagi barcha iste’molchilar shunday — parallel ulanadi.</p>`);
    else p.push(`<p>Lampa quvvatini ampermetr va voltmetr bilan o‘lchaymiz: <b>P = UI</b> = ${fmt(lamp.U, 0)} V · ${fmt(r.I, 3)} A = ${fmt(r.parts[0].P, 1)} W. LATR bilan kuchlanishni kamaytiring: tok kamayadi, tola soviydi va qarshiligi kamayadi — quvvat U² ga emas, taxminan U^1,58 ga proporsional kamayadi, rangi qizarib boradi.</p>`);
  } else {
    p.push("<p>Xonadondagi barcha iste’molchilar tarmoqqa <b>parallel</b> ulanadi: har biri 220 V kuchlanishda ishlaydi, umumiy tok esa ularning toklari yig‘indisi: <b>I = ΣP/U</b>. Faza (L) simiga avtomat saqlagich, hisoblagich esa kirishga o‘rnatiladi.</p>");
    p.push(`<p>Hisoblagich elektr energiyani <b>kVt·soat</b>da o‘lchaydi: 1 kVt·soat = 1000 W · 3600 s = 3,6 MJ. 2 kW choynak 30 minutda 1 kVt·soat sarflaydi. Hisoblagichdagi qizil chiroqcha har 1/${IMP} kVt·soatda miltillaydi — tezroq miltillasa, quvvat katta.</p>`);
    p.push(`<p>Avtomat ikki xil himoya qiladi: tok 1,45·Iₙ dan oshsa, <b>bimetall plastinka</b> qizib egiladi va bir necha soniya–minutda zanjirni uzadi (ortiqcha yuklanish); tok 5·Iₙ dan oshsa (qisqa tutashuv), <b>elektromagnit</b> bir zumda uzadi. Bu simlarning qizib, yong‘in chiqishidan saqlaydi — sim ham Joul–Lens qonuni bo‘yicha qiziydi.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "kal" ? "<small>Joul–Lens qonuni</small> Q = I²Rt" : ui.mode === "lamp" ? "<small>Tok quvvati</small> P = UI = U²/R" : "<small>Elektr energiya</small> W = Pt";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); syncTools(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  if (ui.mode === "kal") stepKal(dt * ui.speed);
  else if (ui.mode === "home") stepHome(dt * ui.speed, dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode !== "lamp") { graph.render(); updateExplain(); } }
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
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || MODE_DEFAULT[ui.mode], false));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = Number(b.dataset.speedValue); if (ui.mode === "home") home.hist = home.hist.filter((p) => p.t >= home.t - homeWin()); syncSpeed(); refresh(); }));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speedValue) === ui.speed)));

/* ------------------------------------------------------------------ Boshqaruv */

// 1) Kalorimetr
const EC = bindRange($("#kE"), $("#kEOut"), (v) => `${fmt(v, 1)} V`, (v) => { kal.E = v; customized(); refresh(); });
const R1C = bindRange($("#kR1"), $("#kR1Out"), (v) => `${fmt(v, 1)} Ω`, (v) => { kal.R1 = v; customized(); refresh(); });
const R2C = bindRange($("#kR2"), $("#kR2Out"), (v) => `${fmt(v, 1)} Ω`, (v) => { kal.R2 = v; customized(); refresh(); });
const mC = bindRange($("#km"), $("#kmOut"), (v) => `${fmt(v, 0)} g`, (v) => { kal.m = v; resetKal(); customized(); refresh(); });
document.querySelectorAll("[data-conn-value]").forEach((b) => b.addEventListener("click", () => { if (kal.conn === b.dataset.connValue) return; kal.conn = b.dataset.connValue; resetKal(); customized(); syncKal(); refresh(); }));
function syncKal() {
  EC.set(kal.E); R1C.set(kal.R1); R2C.set(kal.R2); mC.set(kal.m);
  document.querySelectorAll("[data-conn-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.connValue === kal.conn)));
  $("[data-r2]").hidden = kal.conn === "single";
}
function toggleKey() { kal.closed = !kal.closed; if (kal.closed && kal.hist.length <= 1) pushKal(); customized(); refresh(); if (kal.closed && !prefersReducedMotion()) loop.start(); }
$("[data-key]").addEventListener("click", toggleKey);

// 2) Lampa
const selA = $("#lA"), selB = $("#lB");
const OPT = (ids) => ids.map((id) => `<option value="${id}">${id === "none" ? "— ulanmagan —" : P.LAMPS[id].name}${id !== "none" && P.LAMPS[id].Un > 50 ? ", 220 V" : ""}</option>`).join("");
selA.innerHTML = OPT(["l25", "l40", "l60", "l100", "l6"]); selB.innerHTML = OPT(["none", "l25", "l40", "l60", "l100", "l6"]);
const UC = bindRange($("#lU"), $("#lUOut"), (v) => `${fmt(v, small() ? 1 : 0)} V`, (v) => { lamp.U = v; customized(); refresh(); });
function normLamps(changed) {
  const sa = lamp.a === "l6", sb = lamp.b === "l6";
  if (lamp.b !== "none" && sa !== sb) { if (changed === "a") lamp.b = "none"; else lamp.a = sb ? "l6" : "l40"; }
  lamp.U = clamp(lamp.U, 0, Umax());
}
selA.addEventListener("change", () => { const was = small(); lamp.a = selA.value; normLamps("a"); if (was !== small()) lamp.U = small() ? 6.3 : 220; customized(); syncLamp(); refresh(); });
selB.addEventListener("change", () => { const was = small(); lamp.b = selB.value; normLamps("b"); if (was !== small()) lamp.U = small() ? 6.3 : 220; customized(); syncLamp(); refresh(); });
document.querySelectorAll("[data-lconn-value]").forEach((b) => b.addEventListener("click", () => { lamp.conn = b.dataset.lconnValue; customized(); syncLamp(); refresh(); }));
function syncLamp() {
  selA.value = lamp.a; selB.value = lamp.b;
  const inp = $("#lU"); inp.max = String(Umax()); inp.step = small() ? "0.1" : "1"; UC.set(lamp.U);
  document.querySelectorAll("[data-lconn-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lconnValue === lamp.conn)));
  $("[data-lconn]").hidden = lamp.b === "none";
}

// 3) Uy tarmog'i
const fuseSel = $("#hF");
fuseSel.addEventListener("change", () => { home.In = Number(fuseSel.value); home.acc = 0; customized(); refresh(); });
const TC = bindRange($("#hT"), $("#hTOut"), (v) => `${fmt(v, 0)} so‘m`, (v) => { home.tariff = v; customized(); refresh(); });
function toggleBreaker() { if (home.tripped) { home.tripped = false; home.why = ""; home.acc = 0; } else { home.tripped = true; home.why = ""; } pushHome(); flashUntil = 0; customized(); refresh(); }
$("[data-fuse]").addEventListener("click", toggleBreaker);
function toggleAppliance(id) { home.on[id] = !home.on[id]; pushHome(); customized(); refresh(); if (!prefersReducedMotion()) loop.start(); }
function syncHome() { fuseSel.value = String(home.In); TC.set(home.tariff); }

function syncTools() {
  const kb = $("[data-key]"); kb.textContent = kal.closed ? "Kalitni uzish" : "Kalitni ulash"; kb.setAttribute("aria-pressed", String(kal.closed));
  const fb = $("[data-fuse]"); fb.textContent = home.tripped ? "Avtomatni yoqish" : "Avtomatni o‘chirish";
  $("[data-speed]").hidden = ui.mode === "lamp";
}

/* ------------------------------------------------------------------ Sahnada boshqarish (3D) */

const canvas = stage.canvas;
let drag = null;
/** Dasta uchi yoy bo'ylab: ekrandagi eng yaqin nuqta; yoyning bo'sh qismi orqali "sakrash" o'tkazib yuboriladi. */
function turn(pointAt, p) { const f = scene.lab.nearest(pointAt, 0, 1, p.x, p.y); if (Math.abs(f - drag.f) > 0.5) return null; drag.f = f; return f; }
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) {
    if (id === "sw") return toggleKey();
    if (id === "breaker") return toggleBreaker();
    if (id.startsWith("a:")) return toggleAppliance(id.slice(2));
    drag = { id, f: id === "knob" ? kal.E / 12 : lamp.U / Umax() };
  },
  move(id, p) {
    if (!drag || drag.id !== id) return;
    const f = turn(id === "knob" ? scene.knob : scene.latrPoint, p); if (f == null) return;
    if (id === "knob") { kal.E = Math.round(f * 120) / 10; EC.set(kal.E); }
    else { lamp.U = small() ? Math.round(f * Umax() * 10) / 10 : Math.round(f * Umax()); UC.set(lamp.U); }
    customized(); refresh();
  },
  end() { if (!drag) return; drag = null; refresh(); },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setKal = (conn, E, R1, R2, m, speed = 10) => () => { Object.assign(kal, { conn, E, R1, R2, m, closed: true }); ui.speed = speed; resetKal(); };
const setLamp = (a, b, conn, U) => () => { Object.assign(lamp, { a, b, conn, U }); };
const setHome = (ids, In = 16, speed = 10) => () => { home.on = Object.fromEntries(ids.map((id) => [id, true])); Object.assign(home, { In, t: 0, E: 0, acc: 0, tripped: false, why: "", hist: [], pulses: 0, pulse: 0 }); ui.speed = speed; pushHome(); };
const PRESETS = {
  single: { mode: "kal", title: "Bitta spiral: Q = I²Rt", lesson: "Kalit ulangan: spiraldan 3,5 A tok o‘tmoqda, quvvat ~24 W. Termometr va sekundomerni kuzating — ΔT vaqtga proporsional o‘sadi. Manba dastasini soat mili yo‘nalishida buring: kuchlanish 2 marta ortsa, suv 4 marta tez isiydi.", set: setKal("single", 8, 2, 4, 150) },
  series: { mode: "kal", title: "Ketma-ket: Q ∝ R", lesson: "Ikki kalorimetr ketma-ket: tok bir xil, R₂ = 2R₁. Bir necha minutdan so‘ng ΔT₂ ≈ 2ΔT₁ ekanini tekshiring (suv massalari teng).", set: setKal("series", 12, 2, 4, 150) },
  parallel: { mode: "kal", title: "Parallel: Q ∝ 1/R", lesson: "Spirallar parallel: kuchlanish bir xil. Endi qarshiligi kichik spiral (R₁ = 2 Ω) ikki marta ko‘p issiqlik beradi — ΔT₁ ≈ 2ΔT₂.", set: setKal("parallel", 8, 2, 4, 150) },
  water: { mode: "kal", title: "Ko‘p suv — sekin isiydi", lesson: "Suv massasi 300 g: xuddi shu quvvatda ΔT ikki marta kichik, chunki C = cm katta. m ni o‘zgartirib, T(t) qiyaligini solishtiring.", set: setKal("single", 10, 2, 4, 300) },
  boil: { mode: "kal", title: "Qaynashgacha (60×)", lesson: "R = 1 Ω, 80 g suv, 12 V: quvvat ~85 W. Taxminan 6 minutda suv qaynaydi — keyin temperatura 100 °C da to‘xtaydi, energiya bug‘lanishga ketadi.", set: setKal("single", 12, 1, 4, 80, 60) },
  eff: { mode: "kal", title: "Kalorimetr FIK", lesson: "10 minut kuting va «Q(t)» grafigini oching: spiral bergan I²Rt bilan suv olgan cmΔT orasidagi farq — yo‘qotish. FIK oxirgi natijada.", set: setKal("single", 10, 4, 4, 200, 60) },
  rated: { mode: "lamp", title: "100 W lampa quvvati", lesson: "Laboratoriya ishi: LATR 220 V. Voltmetr va ampermetr ko‘rsatishidan P = UI ni hisoblang va lampadagi yozuv (100 W) bilan solishtiring.", set: setLamp("l100", "none", "series", 220) },
  low: { mode: "lamp", title: "Kuchlanish yarmida", lesson: "U = 110 V: Om qonuni bo‘yicha quvvat 4 marta (25 W gacha) kamayishi kerak edi, lekin tola soviganida qarshiligi kamayadi — quvvat ~33 W. Tola rangi sarg‘ish-qizil.", set: setLamp("l100", "none", "series", 110) },
  series40: { mode: "lamp", title: "40 W va 100 W ketma-ket", lesson: "Kutilmagan natija: ketma-ket ulanganda 40 W lampa yorqin yonadi, 100 W esa zo‘rg‘a qizaradi. Sababi — 40 W lampaning qarshiligi katta, tok esa bir xil: P = I²R.", set: setLamp("l40", "l100", "series", 220) },
  parallel40: { mode: "lamp", title: "40 W va 100 W parallel", lesson: "Parallel ulanganda ikkala lampa ham 220 V da — har biri o‘z nominal quvvatida. Ampermetr umumiy tokni ko‘rsatadi: I = (40 + 100)/220.", set: setLamp("l40", "l100", "parallel", 220) },
  small: { mode: "lamp", title: "6,3 V lampa (maktab)", lesson: "Maktab laboratoriyasidagi kichik lampa: 6,3 V; 0,3 A. Kuchlanishni 0 dan oshirib boring va tola qachon qizara boshlaganini kuzating.", set: setLamp("l6", "none", "series", 6.3) },
  warm: { mode: "lamp", title: "Sovuq va issiq tola", lesson: "U = 20 V da tola deyarli qizimagan: qarshilik nominaldagidan bir necha marta kichik. LATR dastasini sekin aylantiring va «I(U)» grafigida nuqtaning Om qonuni chizig‘idan uzoqlashishini kuzating.", set: setLamp("l100", "none", "series", 20) },
  kettle: { mode: "home", title: "Choynak: 1 kVt·soat", lesson: "2 kW elektr choynak yoqilgan (60×). 30 minutda hisoblagich 1 kVt·soat qo‘shadi. Tarifni o‘zgartirib, narxni hisoblang.", set: setHome(["kettle"], 16, 60) },
  overload: { mode: "home", title: "Ortiqcha yuklanish", lesson: "Choynak, isitgich, dazmol va kir yuvish mashinasi birdan yoqildi: 6,9 kW, I ≈ 31 A. 16 A avtomat taxminan 11 s da uziladi. Bir nechtasini o‘chirib, avtomatni qayta yoqing.", set: setHome(["kettle", "heater", "iron", "washer"], 16, 1) },
  led: { mode: "home", title: "LED va cho‘g‘lanma lampa", lesson: "Ikkala lampa ham bir xil yorug‘lik beradi, lekin cho‘g‘lanma lampa 100 W, LED — 12 W. Birini o‘chirib, «1 soatda» va oylik narxni solishtiring.", set: setHome(["lamp", "led"], 10, 60) },
  evening: { mode: "home", title: "Oddiy oqshom", lesson: "Muzlatkich, televizor, kompyuter va LED lampa: tok 2,6 A — avtomat uchun xavfsiz. Konditsionerni ham yoqib ko‘ring.", set: setHome(["fridge", "tv", "pc", "led"], 16, 60) },
};
const GROUPS = [["Joul–Lens qonuni", ["single", "series", "parallel", "water", "boil", "eff"]], ["Lampa quvvati", ["rated", "low", "series40", "parallel40", "small", "warm"]], ["Uy tarmog‘i", ["kettle", "overload", "led", "evening"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { kal: "Manba dastasini buring, kalitni bosing", lamp: "LATR dastasini aylantiring", home: "Iste’molchi yoki avtomatni bosing" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  scene.setMode(ui.mode); // kamera shu tajribaga mos ko'rinishga (rejim almashgandagina)
  setTabs();
}
const MODE_DEFAULT = { kal: "single", lamp: "rated", home: "kettle" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null; flashUntil = 0;
  p.set();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncKal(); syncLamp(); syncHome(); syncSpeed(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "single");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__joule = { kal, lamp, home, ui, loadPreset, refresh, stepKal, stepHome, kalCirc, lampCirc, homeI, scene, frame };
