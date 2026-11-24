// ==========================================================================
// Termodinamika — virtual laboratoriya (simulations/thermo.html)
// 1) 1-qonun: porshenli silindrdagi gaz; izoxorik / izobarik / izotermik / adiabatik jarayonlar. Porshenni yoki
//    termometrni sahnada surib holatni o'zgartirish; jarayonlar ketma-ket qo'shiladi (o'z siklingizni yasash mumkin).
//    p–V diagramma (ish — yuza) va Q = ΔU + A ustunlari.
// 2) Sikllar: Karno, to'rtburchak, Otto, sovutgich. Silindr isitkich / izolyatsiya / sovitkich ustida yuradi;
//    energiya oqimi Q₁ → A + Q₂, FIK va Karno chegarasi. Isitkich/sovitkich bloklari sahnada suriladi.
// 3) To'rt taktli ichki yonuv dvigateli: tirsakli val, shatun, porshen, klapanlar, sham; indikator p–V diagramma.
// Fizika: thermo-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { createThermoLab } from './thermo-lab-3d.js?v=20261123-batch8d';
import { bindLabCamera } from './lab-3d.js?v=20261123-batch8d';
import { detailedStageHeight } from './apparatus-3d.js?v=20261123-batch8d';
import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./thermo-physics.js";
import { drawPV, drawEnergy, lastFrame, niceMax } from "./thermo-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const NU = (P.P_ATM * 2e-3) / (P.R * 300); // silindrdagi gaz: 2 L, 1 atm, 300 K
const KIND_NAME = { V: "Izoxorik", p: "Izobarik", T: "Izotermik", Q: "Adiabatik" };
const KIND_LAW = { V: "V = const", p: "p = const", T: "T = const", Q: "Q = 0" };
const LIM = { V: [0.6e-3, 4.2e-3], T: [120, 1200] };

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "proc", tab: "pv", speed: 1, hover: null };
const gasState = { key: "air" };
const gas = () => ({ nu: NU, i: P.GASES[gasState.key].i });
const proc = { kind: "p", start: null, legs: [], cur: null, pMax: 300e3, flow: 0, flowT: 0, work: 0, flowA: 0 };
const cyc = { name: "karno", T1: 600, T2: 300, r: 2.5, u: 0, data: null, cylX: null, laps: 0 };
const eng = { eps: 9, Tmax: 2400, rpm: 3000, th: 0, g: null, curve: null };
const mol = Array.from({ length: 36 }, (_, k) => ({ x: ((k * 37) % 100) / 100, y: ((k * 61) % 100) / 100, a: k * 2.39996 }));
let presetId = null, running = false;

/* ------------------------------------------------------------------ 1. Jarayonlar */

function resetProc(V = 2e-3, T = 300) {
  proc.start = P.stateVT(gas(), V, T);
  proc.cur = proc.start;
  proc.legs = [{ kind: proc.kind, a: proc.start, b: proc.start }];
  proc.pMax = 0; proc.flow = 0; proc.flowT = 0; proc.flowA = 0;
  growP(proc.start);
}
function growP(s) { proc.pMax = Math.max(proc.pMax, niceMax((s.p * 1.15) / 1000) * 1000, 250e3); }
const curLeg = () => proc.legs[proc.legs.length - 1];
function setKind(k) {
  if (k === proc.kind) return;
  proc.kind = k;
  const L = curLeg();
  if (L.a === L.b || (L.a.V === L.b.V && L.a.T === L.b.T)) L.kind = k; // bo'sh jarayonni almashtiramiz
  else { proc.legs.push({ kind: k, a: proc.cur, b: proc.cur }); if (proc.legs.length > 8) proc.legs.shift(); }
}
/** Jarayon bo'ylab yangi holatga o'tish (chegaralar bilan). to: { V } yoki { T } */
function applyTarget(to) {
  const g = gas(), L = curLeg();
  if (proc.kind === "V" && to.V !== undefined) return;
  if (proc.kind === "T" && to.T !== undefined) return;
  let s = P.move(g, proc.cur, proc.kind, to);
  // chegaradan chiqsa — chegaraga qadar
  if (s.V < LIM.V[0] || s.V > LIM.V[1]) s = P.move(g, proc.cur, proc.kind, { V: clamp(s.V, LIM.V[0], LIM.V[1]) });
  if (s.T < LIM.T[0] || s.T > LIM.T[1]) s = P.move(g, proc.cur, proc.kind, { T: clamp(s.T, LIM.T[0], LIM.T[1]) });
  if (s.V < LIM.V[0] - 1e-9 || s.V > LIM.V[1] + 1e-9) return;
  const before = P.leg(g, proc.cur, s, proc.kind);
  if (Math.abs(before.Q) > 1e-6) { proc.flow = Math.sign(before.Q); proc.flowT = 1.2; }
  if (Math.abs(before.A) > 1e-6) { proc.flowA = Math.sign(before.A); }
  proc.cur = s; L.b = s; growP(s);
  syncProcCtl(); refresh();
}
function procTotals() {
  const g = gas();
  return proc.legs.reduce((t, L) => { const r = P.leg(g, L.a, L.b, L.kind); return { A: t.A + r.A, dU: t.dU + r.dU, Q: t.Q + r.Q }; }, { A: 0, dU: 0, Q: 0 });
}

/* ------------------------------------------------------------------ 2. Sikllar */

function buildCycle() {
  const g = gas(), rmax = P.maxRatio(g, cyc.name, cyc.T1, cyc.T2);
  if (cyc.T2 >= cyc.T1 - 10) cyc.T2 = cyc.T1 - 10;
  cyc.r = clamp(cyc.r, 1.2, Math.max(1.21, Math.min(12, rmax)));
  const V1 = cyc.name === "otto" ? 1e-3 : 0.5e-3;
  cyc.data = P.cycle(g, cyc.name, { T1: cyc.T1, T2: cyc.T2, r: cyc.r, V1 });
}
const cycState = () => P.onCycle(gas(), cyc.data, cyc.u);
/** Jarayonda silindr qayerda turadi: 0 isitkich, 1 izolyatsiya, 2 sovitkich */
function station(L) {
  if (L.kind === "Q") return 1;
  return L.Q > 1e-9 ? (cyc.data.reverse ? 2 : 0) : (cyc.data.reverse ? 0 : 2);
}

/* ------------------------------------------------------------------ 3. Dvigatel */

function buildEngine() {
  eng.g = P.engineGeom({ eps: eng.eps });
  const N = 720, pts = [];
  for (let k = 0; k <= N; k++) pts.push(P.engineState(eng.g, 5, eng.Tmax, (k / N) * 4 * Math.PI - 1e-9));
  eng.curve = pts;
}
const engState = () => P.engineState(eng.g, 5, eng.Tmax, eng.th);

const scene = createThermoLab();
function draw(ctx, st) {
  if (ui.mode==='proc' ? proc.cur : ui.mode==='cycle' ? cyc.data : eng.g) scene.draw(ctx,st,ui,proc,cyc,eng,mol,{totals:procTotals,cycleState:cycState,station,engineState:engState});
}

const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(vh * 0.44, 300, 360)), graph: Math.round(clamp(vh * 0.3, 200, 280)) };
};
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });

/* ------------------------------------------------------------------ Grafik */

function drawGraphCanvas(ctx, gst) {
  const c = gst.colors, g = gas();
  if (ui.mode === "proc" && proc.cur) {
    const T = procTotals();
    if (ui.tab === "en") return drawEnergy(ctx, gst, T);
    const legCol = { V: c.warning, p: c.danger, T: c.primary, Q: c.special };
    const paths = proc.legs.map((L) => ({ pts: P.legPath(g, L, 60), color: legCol[L.kind], width: 3, arrow: Math.abs(L.b.V - L.a.V) + Math.abs(L.b.T - L.a.T) > 1e-6 }));
    const fillPts = proc.legs.flatMap((L) => P.legPath(g, L, 60));
    const marks = [{ s: proc.start, label: "1", color: c.text }];
    proc.legs.forEach((L, k) => { if (k) marks.push({ s: L.a, label: String(k + 1), color: c.text2 }); });
    return drawPV(ctx, gst, {
      gas: g, vMax: 4.5e-3, pMax: proc.pMax, isotherms: [200, 300, 450, 600, 900],
      fill: Math.abs(T.A) > 0.05 ? { pts: fillPts, color: T.A >= 0 ? (c.dark ? "rgba(34,197,94,0.22)" : "rgba(22,163,74,0.16)") : (c.dark ? "rgba(239,68,68,0.2)" : "rgba(220,38,38,0.12)"), closed: false } : null,
      paths, marks, cur: proc.cur, hover: ui.hover,
      legend: [{ color: legCol[proc.kind], label: `${KIND_NAME[proc.kind]} (${KIND_LAW[proc.kind]})` }],
    });
  }
  if (ui.mode === "cycle" && cyc.data) {
    const d = cyc.data, legCol = { V: c.warning, p: c.danger, T: c.primary, Q: c.special };
    const { s } = cycState(), vMax = Math.max(...d.pts.map((q) => q.V)) * 1.12, pMax = niceMax((Math.max(...d.pts.map((q) => q.p)) * 1.1) / 1000) * 1000;
    const all = d.legs.flatMap((L) => P.legPath(g, L, 80));
    return drawPV(ctx, gst, {
      gas: g, vMax, pMax, isotherms: [d.reverse ? cyc.T1 : cyc.T1, cyc.T2],
      fill: { pts: all, closed: true, color: d.reverse ? (c.dark ? "rgba(239,68,68,0.18)" : "rgba(220,38,38,0.1)") : (c.dark ? "rgba(34,197,94,0.22)" : "rgba(22,163,74,0.15)") },
      paths: d.legs.map((L) => ({ pts: P.legPath(g, L, 80), color: legCol[L.kind], width: 3, arrow: true })),
      marks: d.pts.map((q, k) => ({ s: q, label: String(k + 1), color: c.text })), cur: s, hover: ui.hover,
      legend: [...new Set(d.legs.map((L) => L.kind))].map((kd) => ({ color: legCol[kd], label: KIND_NAME[kd] })),
    });
  }
  if (ui.mode === "engine" && eng.g) {
    const pts = eng.curve, pMax = niceMax((Math.max(...pts.map((q) => q.p)) * 1.08) / 1e6) * 1e6, es = engState(), cols = [c.primary, c.special, c.warning, c.text3];
    const byStroke = [0, 1, 2, 3].map((q) => pts.filter((x) => x.stroke === q));
    // ish yo'li boshida izoxorik yonish chizig'i va chiqarishdan oldingi bosim tushishi
    byStroke[2].unshift(byStroke[1][byStroke[1].length - 1]); byStroke[3].unshift(byStroke[2][byStroke[2].length - 1]);
    return drawPV(ctx, gst, {
      gas: { nu: eng.g.nu, i: 5 }, vMax: eng.g.Vmax * 1.1, pMax, pDiv: 1e6, pUnit: "MPa", isotherms: [],
      fill: { pts: [...byStroke[1], ...byStroke[2]], closed: true, color: c.dark ? "rgba(34,197,94,0.2)" : "rgba(22,163,74,0.14)" },
      paths: byStroke.map((q, k) => ({ pts: q, color: cols[k], width: k === 0 || k === 3 ? 4 : 2.8, dash: k === 3 ? [6, 4] : null, arrow: k === 1 || k === 2 })),
      marks: [], cur: es, hover: ui.hover, hoverT: false,
      legend: P.STROKES.map((n, k) => ({ color: cols[k], label: n, dash: k === 3 ? [6, 4] : null })),
    });
  }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

const TABS = {
  proc: { pv: ["p–V diagramma", "Jarayon chizig‘i ostidagi yuza — gaz bajargan ish A (yashil — kengayish, A > 0; qizil — siqish, A < 0). Shtrix chiziqlar — izotermalar. Kursor bilan p, V va T ni o‘qing."], en: ["1-qonun: Q = ΔU + A", "Gazga berilgan issiqlik ichki energiyani oshirishga va ish bajarishga sarflanadi. Barcha jarayonlar 1-holatdan hisoblanadi."] },
  cycle: { pv: ["Sikl p–V diagrammasi", "Sikl ichidagi yuza — bir siklda bajarilgan foydali ish A. Soat mili bo‘yicha aylanish — dvigatel (A > 0), teskari — sovutgich (A < 0). Shtrix — T₁ va T₂ izotermalari."] },
  engine: { pv: ["Indikator diagramma (ideal Otto)", "Ko‘k — so‘rish, binafsha — siqish, to‘q sariq — ish yo‘li, kulrang shtrix — chiqarish. Yopiq yuza — bir sikl ishi. Haqiqiy dvigatelda burchaklar silliqroq va yuza kichikroq."] },
};
const TAB_LABEL = { pv: "p–V", en: "Energiya" };
function setTab(tab) {
  ui.tab = TABS[ui.mode][tab] ? tab : "pv";
  const t = TABS[ui.mode][ui.tab], keys = Object.keys(TABS[ui.mode]);
  $("[data-tabs]").innerHTML = keys.length > 1 ? keys.map((k) => `<button type="button" data-tab-value="${k}" aria-pressed="${k === ui.tab}">${TAB_LABEL[k]}</button>`).join("") : "";
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1];
  graph.canvas.setAttribute("aria-label", t[0]); graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (b) setTab(b.dataset.tabValue); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;
const sgn = (v, d = 1) => (v >= 0.5 * 10 ** -d ? "+" : "") + fmt(v, d);

function updateReadouts() {
  const g = gas();
  if (ui.mode === "proc") {
    const s = proc.cur, s0 = proc.start, T = procTotals();
    setRO("r1", "Bosim <i>p</i>", u(fmt(s.p / 1000, 1), "kPa"), `boshida ${fmt(s0.p / 1000, 1)} kPa`);
    setRO("r2", "Hajm <i>V</i>", u(fmt(s.V * 1000, 2), "L"), `boshida ${fmt(s0.V * 1000, 2)} L`);
    setRO("r3", "Temperatura <i>T</i>", u(fmt(s.T, 0), "K"), `= ${fmt(s.T - 273.15, 0)} °C; boshida ${fmt(s0.T, 0)} K`);
    setRO("r4", "Ichki energiya o‘zgarishi <i>ΔU</i>", u(sgn(T.dU), "J"), `U = (${g.i}/2)νRT = ${fmt(P.energy(g, s.T), 0)} J`);
    setRO("r5", "Gaz bajargan ish <i>A</i>", u(sgn(T.A), "J"), T.A > 0.05 ? "gaz kengayib ish bajardi" : T.A < -0.05 ? "tashqi kuchlar gaz ustida ish bajardi" : "hajm o‘zgarmadi — ish nolga teng");
    setRO("r6", "Issiqlik miqdori <i>Q</i>", u(sgn(T.Q), "J"), T.Q > 0.05 ? "gaz issiqlik oldi" : T.Q < -0.05 ? "gaz issiqlik berdi" : "issiqlik almashinuvi yo‘q", "orange");
    return;
  }
  if (ui.mode === "cycle") {
    const d = cyc.data, { j, s } = cycState(), L = d.legs[j];
    if (d.reverse) {
      setRO("r1", "Sovitkichdan olingan <i>Q₂</i>", u(fmt(d.Qin, 1), "J"), "bir siklda (muzlatgich ichidan)");
      setRO("r2", "Sarflangan ish <i>|A|</i>", u(fmt(-d.A, 1), "J"), "kompressor bajargan ish");
      setRO("r3", "Isitkichga berilgan <i>Q₁</i>", u(fmt(d.Qout, 1), "J"), "Q₁ = Q₂ + |A| (xonaga)");
      setRO("r4", "Sovitish koeffitsiyenti <i>ε</i>", u(fmt(d.cop, 2), ""), "ε = Q₂/|A|", "orange");
      setRO("r5", "Karno chegarasi", u(fmt(d.copC, 2), ""), "ε_max = T₂/(T₁ − T₂)");
    } else {
      setRO("r1", "Isitkichdan olingan <i>Q₁</i>", u(fmt(d.Qin, 1), "J"), "bir siklda");
      setRO("r2", "Sovitkichga berilgan <i>|Q₂|</i>", u(fmt(d.Qout, 1), "J"), "bir siklda");
      setRO("r3", "Foydali ish <i>A</i>", u(fmt(d.A, 1), "J"), "A = Q₁ − |Q₂| = sikl yuzasi");
      setRO("r4", "FIK <i>η</i>", u(fmt(d.eta * 100, 1), "%"), "η = A/Q₁", "orange");
      setRO("r5", "Karno chegarasi <i>η<sub>max</sub></i>", u(fmt(d.etaC * 100, 1), "%"), "η_max = 1 − T₂/T₁ (shu T₁, T₂ da)");
    }
    setRO("r6", `Hozir: ${j + 1}→${(j + 1) % 4 + 1}`, u(fmt(s.T, 0), "K"), `${KIND_NAME[L.kind]}: Q = ${sgn(L.Q)} J, A = ${sgn(L.A)} J`);
    return;
  }
  const es = engState(), pw = P.enginePower(eng.g, 5, eng.Tmax, eng.rpm);
  setRO("r1", "Takt", `${es.stroke + 1}. ${P.STROKES[es.stroke]}`, `tirsak burchagi ${fmt((((eng.th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI)) * 180 / Math.PI, 0)}°`);
  setRO("r2", "Hajm va bosim", u(`${fmt(es.V * 1e6, 0)} cm³ · ${fmt(es.p / 1e6, 2)}`, "MPa"), `V_c = ${fmt(eng.g.Vc * 1e6, 0)} cm³, V_d = ${fmt(eng.g.Vd * 1e6, 0)} cm³`);
  setRO("r3", "Gaz temperaturasi", u(fmt(es.T, 0), "K"), es.stroke === 1 ? "siqilganda qiziydi" : es.stroke === 2 ? "kengayganda soviydi" : "atrof havo");
  setRO("r4", "Ideal FIK <i>η</i>", u(fmt(pw.cyc.eta * 100, 1), "%"), `η = 1 − ε^(1−γ), ε = ${fmt(eng.eps, 1)}`, "orange");
  setRO("r5", "Bir sikl ishi <i>A</i>", u(fmt(pw.A, 0), "J"), `Q₁ = ${fmt(pw.cyc.Qin, 0)} J yonilg‘idan`);
  setRO("r6", "Quvvat (1 silindr)", u(fmt(pw.P / 1000, 1), "kW"), `N = A·n/2, n = ${fmt(eng.rpm, 0)} ayl/min`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "proc") { const T = procTotals(); t = proc.kind === "Q" ? "Issiqlik izolyatsiyasi: Q = 0" : Math.abs(T.Q) < 0.05 ? "Porshenni yoki termometrni suring" : T.Q > 0 ? "Gaz issiqlik oldi" : "Gaz issiqlik berdi"; tone = Math.abs(T.Q) < 0.05 ? "blue" : T.Q > 0 ? "orange" : "purple"; }
  else if (ui.mode === "cycle") { const { j } = cycState(), L = cyc.data.legs[j]; t = L.kind === "Q" ? "Adiabatik: izolyatsiyada" : L.Q > 0 ? "Gaz issiqlik oladi" : "Gaz issiqlik beradi"; tone = L.kind === "Q" ? "purple" : L.Q > 0 ? "orange" : "blue"; }
  else { const es = engState(); t = `${es.stroke + 1}-takt: ${P.STROKES[es.stroke]}`; tone = ["blue", "purple", "orange", "green"][es.stroke]; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "proc") {
    const k = proc.kind, T = procTotals();
    p.push("<p><b>Ichki energiya</b> — gaz molekulalari issiqlik harakatining kinetik energiyasi. Ideal gazda u faqat temperaturaga bog‘liq: U = (i/2)νRT. Temperatura ortsa — molekulalar tezroq harakatlanadi (animatsiyada ranglari qizaradi).</p>");
    p.push({
      V: "<p><b>Izoxorik</b> (V = const): porshen mahkamlangan, gaz ish bajarmaydi (A = 0). Berilgan hamma issiqlik ichki energiyaga aylanadi: Q = ΔU. Termometrni surib gazni qizdiring yoki sovuting.</p>",
      p: "<p><b>Izobarik</b> (p = const): porshen ustidagi yuk bosimni o‘zgarmas tutadi. Qizdirilganda gaz kengayadi va ish bajaradi: A = p·ΔV. Issiqlikning bir qismi ichki energiyaga, qolgani ishga sarflanadi: Q = ΔU + A.</p>",
      T: "<p><b>Izotermik</b> (T = const): silindr termostatda. Ichki energiya o‘zgarmaydi (ΔU = 0), shuning uchun Q = A: kengayganda gaz issiqlik oladi va hammasini ishga sarflaydi, siqilganda issiqlik beradi.</p>",
      Q: "<p><b>Adiabatik</b> (Q = 0): silindr issiqlik o‘tkazmaydi. Gaz ish bajarsa, faqat ichki energiyasi hisobidan: A = −ΔU — kengayganda soviydi, siqilganda qiziydi (velosiped nasosi qiziydi; dizel dvigatelida havo siqilib, yonilg‘i o‘z-o‘zidan alangalanadi).</p>",
    }[k]);
    if (proc.legs.length > 1) p.push(`<p>Bir nechta jarayon ketma-ket bajarildi. Jami: Q = ${fmt(T.Q, 1)} J, ΔU = ${fmt(T.dU, 1)} J, A = ${fmt(T.A, 1)} J. Gazni boshlang‘ich holatga (1-nuqta) qaytarsangiz — ΔU = 0, yopiq yo‘l ichidagi yuza esa sikl ishi.</p>`);
  } else if (ui.mode === "cycle") {
    const d = cyc.data;
    if (d.reverse) p.push(`<p><b>Sovutgich</b> (muzlatgich, konditsioner) siklni teskari yo‘nalishda o‘taydi: tashqi ish |A| hisobiga sovuq jismdan Q₂ issiqlik olib, issiqroq muhitga Q₁ = Q₂ + |A| beradi. Sovitish koeffitsiyenti ε = Q₂/|A| = ${fmt(d.cop, 2)} — 1 J elektr energiyasi ${fmt(d.cop, 1)} J issiqlikni «tashib» chiqaradi.</p>`);
    else {
      p.push(`<p><b>Issiqlik dvigateli</b> isitkichdan Q₁ issiqlik oladi, uning bir qismini foydali ishga aylantiradi, qolganini (|Q₂|) sovitkichga beradi. FIK η = A/Q₁ = ${fmt(d.eta * 100, 1)} %. Sovitkichsiz dvigatel ishlay olmaydi — bu termodinamikaning 2-qonuni.</p>`);
      p.push(cyc.name === "karno" ? "<p><b>Karno sikli</b> — ikki izoterma va ikki adiabatadan iborat. Berilgan T₁ va T₂ oralig‘ida ishlaydigan dvigatellar ichida uning FIK eng katta: η = 1 − T₂/T₁. FIKni oshirish uchun T₁ ni ko‘tarish yoki T₂ ni pasaytirish kerak.</p>" : cyc.name === "otto" ? `<p><b>Otto sikli</b> — benzin dvigatelining ideal modeli: adiabatik siqish, yonish (V = const), adiabatik kengayish, chiqarish. FIK faqat siqish darajasiga bog‘liq: η = 1 − ε^(1−γ). Xuddi shu T₁, T₂ da Karno FIK ${fmt(d.etaC * 100, 1)} % — undan kichik.</p>` : `<p>Bu siklda issiqlik har xil temperaturada olinadi va beriladi, shuning uchun FIK (${fmt(d.eta * 100, 1)} %) xuddi shu T₁, T₂ oralig‘idagi Karno FIKidan (${fmt(d.etaC * 100, 1)} %) ancha kichik.</p>`);
    }
  } else {
    p.push("<p><b>To‘rt taktli ichki yonuv dvigateli</b>: bir ish sikli tirsakli valning ikki aylanishida (720°) bajariladi. Faqat 3-taktda (ish yo‘li) gaz porshenni itarib foydali ish bajaradi; qolgan taktlarda val maxovik inersiyasi bilan aylanadi.</p>");
    p.push(`<p>Siqish darajasi ε = ${fmt(eng.eps, 1)}: ideal FIK ${fmt((1 - eng.eps ** -0.4) * 100, 1)} %. ε ni oshirsangiz FIK ortadi, lekin benzin dvigatelida juda katta siqishda aralashma o‘z-o‘zidan portlab yonadi (detonatsiya), shuning uchun ε ≈ 8–12. Dizel dvigatelida ε = 15–22.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "proc" ? "<small>1-qonun</small> Q = ΔU + A" : ui.mode === "cycle" ? (cyc.data?.reverse ? "<small>Sovutgich</small> ε = Q₂/|A|" : "<small>FIK</small> η = A/Q₁ ≤ 1 − T₂/T₁") : "<small>Otto</small> η = 1 − ε<sup>1−γ</sup>";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
function stepMolecules(dt, T) {
  const sp = 0.55 * Math.sqrt(T / 300);
  for (const m of mol) {
    m.x += Math.cos(m.a) * sp * dt; m.y += Math.sin(m.a) * sp * dt;
    if (m.x < 0) { m.x = -m.x; m.a = Math.PI - m.a; } if (m.x > 1) { m.x = 2 - m.x; m.a = Math.PI - m.a; }
    if (m.y < 0) { m.y = -m.y; m.a = -m.a; } if (m.y > 1) { m.y = 2 - m.y; m.a = -m.a; }
  }
}
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "proc") { stepMolecules(dt, proc.cur.T); proc.flowT = Math.max(0, proc.flowT - dt); }
  else if (ui.mode === "cycle") {
    cyc.u += dt * ui.speed * 0.6; if (cyc.u >= 4) { cyc.u -= 4; cyc.laps++; }
    const { j, s } = cycState(), tx = cycleStationX(station(cyc.data.legs[j]));
    if (tx !== null) cyc.cylX = cyc.cylX === null ? tx : cyc.cylX + (tx - cyc.cylX) * Math.min(1, dt * 8);
    stepMolecules(dt, s.T);
  } else { eng.th += dt * ui.speed * Math.PI; if (eng.th > 4 * Math.PI * 1000) eng.th -= 4 * Math.PI * 1000; }
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); }
}, { onStateChange: setPlayUI });
function cycleStationX(k) { return [-1.8,0,1.8][k]; }

const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : ui.mode === "proc" ? "Molekulalar" : "Boshlash";
}
playBtn.addEventListener("click", () => { if (loop.running) loop.stop(); else if (!prefersReducedMotion() || ui.mode !== "proc") loop.start(); });
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "proc") { resetProc(proc.start.V, proc.start.T); syncProcCtl(); }
  else if (ui.mode === "cycle") { cyc.u = 0; cyc.cylX = null; }
  else eng.th = 0;
  ui.hover = null; refresh();
});
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = +b.dataset.speedValue; syncSpeed();
}));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.speedValue === ui.speed)));

/* ------------------------------------------------------------------ Boshqaruv */

const gasSel = $("#gas");
gasSel.innerHTML = Object.entries(P.GASES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
gasSel.addEventListener("change", () => { gasState.key = gasSel.value; customized(); if (ui.mode === "proc") { resetProc(proc.start.V, proc.start.T); syncProcCtl(); } else { buildCycle(); syncCycleCtl(); } refresh(); });

const pVC = bindRange($("#pV"), $("#pVOut"), (v) => `${fmt(v, 2)} L`, (v) => { customized(); applyTarget({ V: v / 1000 }); });
const pTC = bindRange($("#pT"), $("#pTOut"), (v) => `${fmt(v, 0)} K`, (v) => { customized(); applyTarget({ T: v }); });
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { setKind(b.dataset.kindValue); customized(); syncProcCtl(); refresh(); }));
function syncProcCtl() {
  pVC.set(+(proc.cur.V * 1000).toFixed(2)); pTC.set(Math.round(proc.cur.T));
  $("#pV").disabled = proc.kind === "V"; $("#pT").disabled = proc.kind === "T";
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === proc.kind)));
  $("[data-kind-note]").textContent = {
    V: "Porshen mahkamlangan. Sahnadagi termometrni yuqoriga/pastga surib gazni qizdiring yoki sovuting.",
    p: "Porshen dastasini yoki termometrni suring: qizdirilganda gaz kengayadi, bosim o‘zgarmaydi.",
    T: "Silindr termostatda. Porshen dastasini surib gazni siqing yoki kengaytiring.",
    Q: "Silindr issiqlik o‘tkazmaydi. Porshenni suring — siqilganda gaz qiziydi, kengayganda soviydi.",
  }[proc.kind] + " Jarayon turini almashtirsangiz, yangi jarayon shu holatdan davom etadi.";
}

const cycSel = $("#cyc");
cycSel.innerHTML = Object.entries(P.CYCLES).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join("");
cycSel.addEventListener("change", () => { cyc.name = cycSel.value; customized(); buildCycle(); syncCycleCtl(); refresh(); });
const cT1C = bindRange($("#cT1"), $("#cT1Out"), (v) => `${fmt(v, 0)} K`, (v) => { cyc.T1 = v; customized(); buildCycle(); syncCycleCtl(); refresh(); });
const cT2C = bindRange($("#cT2"), $("#cT2Out"), (v) => `${fmt(v, 0)} K`, (v) => { cyc.T2 = v; customized(); buildCycle(); syncCycleCtl(); refresh(); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => fmt(v, 1), (v) => { cyc.r = v; customized(); buildCycle(); syncCycleCtl(); refresh(); });
function syncCycleCtl() {
  cycSel.value = cyc.name; cT1C.set(cyc.T1); cT2C.set(cyc.T2); cRC.set(+cyc.r.toFixed(1));
  $("[data-r-label]").textContent = P.CYCLES[cyc.name].rLabel;
}

const eEC = bindRange($("#eE"), $("#eEOut"), (v) => fmt(v, 1), (v) => { eng.eps = v; customized(); buildEngine(); refresh(); });
const eTC = bindRange($("#eT"), $("#eTOut"), (v) => `${fmt(v, 0)} K`, (v) => { eng.Tmax = v; customized(); buildEngine(); refresh(); });
const eNC = bindRange($("#eN"), $("#eNOut"), (v) => `${fmt(v, 0)} ayl/min`, (v) => { eng.rpm = v; customized(); refresh(); });

/* Sahnada: porshen, termometr, termostat dastaklari va tirsak. */
let drag = null;
const ptr = (cv,e) => {const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
bindLabCamera(stage.canvas,scene.lab,()=>stage.render(),{
 start(id,p){
   drag={id,x:p.x,y:p.y,value:id==='hot'?cyc.T1:id==='cold'?cyc.T2:id==='rpm'?eng.rpm:eng.eps};
   if(id==='crank'&&loop.running)loop.stop();
   customized();
 },
 move(id,p){
   if(!drag||drag.id!==id)return;
   if(id==='piston'&&proc.kind!=='V'){const v=scene.parameter(id,p);applyTarget({V:clamp(Math.round(v*1e5)/1e5,...LIM.V)});}
   else if(id==='thermo'&&proc.kind!=='T'){const t=scene.parameter(id,p);applyTarget({T:clamp(Math.round(t/5)*5,...LIM.T)});}
   else if(id==='hot'||id==='cold'){
     const step=id==='hot'?10:5,v=Math.round((drag.value+(p.x-drag.x)*(id==='hot'?2250:450)/180)/step)*step;
     if(id==='hot')cyc.T1=clamp(v,250,2500);else cyc.T2=clamp(v,150,600);
     buildCycle();syncCycleCtl();refresh();
   }else if(id==='crank'){
     const a=scene.parameter(id,p);if(a===null)return;
     const base=eng.th-(((eng.th%TAU)+TAU)%TAU);let th=base+((a+TAU)%TAU);
     if(th-eng.th>Math.PI)th-=TAU;if(eng.th-th>Math.PI)th+=TAU;
     eng.th=Math.max(0,th);refresh();
   }else if(id==='rpm'){eng.rpm=clamp(Math.round((drag.value+(p.x-drag.x)*5200/180)/100)*100,800,6000);eNC.set(eng.rpm);refresh();}
   else if(id==='eps'){eng.eps=clamp(Math.round((drag.value+(p.x-drag.x)*7/180)*2)/2,5,12);eEC.set(eng.eps);buildEngine();refresh();}
 },end(){drag=null;}
});

/* Grafikda kursor */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) { ui.hover = null; return; }
  const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  ui.hover = inside ? { V: f.toV(p.x), p: f.toP(p.y) } : null;
  gcv.style.cursor = inside ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  internal: { mode: "proc", title: "Ichki energiya: qizdirish", lesson: "Porshen mahkamlangan (V = const). Gaz 300 K dan 450 K gacha qizdirildi: molekulalar tezlashdi, ichki energiya ortdi, ish esa bajarilmadi (A = 0) — Q = ΔU. Termometrni surib davom eting.", set: () => setProc("he", "V", 2e-3, 300, { T: 450 }) },
  isobar: { mode: "proc", title: "Izobarik kengayish: A = p·ΔV", lesson: "Yuk bosimni o‘zgarmas tutadi. Gaz qizdirilganda 2 L dan 3,5 L gacha kengaydi: ish A = p·ΔV — p–V diagrammadagi to‘rtburchak yuzasi. Energiya ustunlarida Q = ΔU + A ni tekshiring.", set: () => setProc("air", "p", 2e-3, 300, { V: 3.5e-3 }) },
  isotherm: { mode: "proc", title: "Izotermik siqish", lesson: "Termostatdagi gaz sekin siqildi: temperatura o‘zgarmadi (ΔU = 0), gaz ustida bajarilgan ish butunlay issiqlik bo‘lib termostatga o‘tdi (Q = A < 0). Bosim hajmga teskari proporsional — giperbola.", set: () => setProc("air", "T", 3.5e-3, 300, { V: 1.4e-3 }) },
  adiabC: { mode: "proc", title: "Adiabatik siqish: havo qiziydi", lesson: "Issiqlik o‘tkazmaydigan silindrda havo 3,5 L dan 1 L gacha siqildi: Q = 0, bajarilgan ish ichki energiyaga aylandi va temperatura ≈ 500 K gacha ko‘tarildi. Adiabata izotermadan tikroq.", set: () => setProc("air", "Q", 3.5e-3, 300, { V: 1e-3 }) },
  adiabE: { mode: "proc", title: "Adiabatik kengayish: sovish", lesson: "Qizdirilgan gaz izolyatsiyada kengaydi: ishni faqat ichki energiyasi hisobidan bajardi va soviydi (A = −ΔU). Bulutlar shunday hosil bo‘ladi — ko‘tarilgan havo kengayib soviydi.", set: () => setProc("air", "Q", 1e-3, 600, { V: 3.5e-3 }) },
  helium: { mode: "proc", title: "Bir atomli gaz: geliy", lesson: "Geliyda (i = 3) issiqlikning 60 % i ichki energiyaga, 40 % i ishga ketadi; havoda (i = 5) — 71 % va 29 %. Gazni almashtirib, izobarik kengayishda Q, ΔU va A ni solishtiring.", set: () => setProc("he", "p", 2e-3, 300, { V: 3.5e-3 }), tab: "en" },
  karno: { mode: "cycle", title: "Karno sikli", lesson: "Ikki izoterma (isitkich va sovitkichga tegib) va ikki adiabata (izolyatsiyada). FIK = 1 − T₂/T₁ = 50 %. Isitkich yoki sovitkich blokini sahnada surib, FIK qanday o‘zgarishini kuzating.", set: () => setCycle("he", "karno", 600, 300, 2.5) },
  karnoCold: { mode: "cycle", title: "Karno: sovitkichni sovutish", lesson: "Sovitkich 300 K dan 150 K gacha sovutildi — FIK 50 % dan 75 % gacha ortdi. Lekin 100 % ga yetib bo‘lmaydi: buning uchun T₂ = 0 K kerak.", set: () => setCycle("he", "karno", 600, 150, 2.5) },
  rect: { mode: "cycle", title: "To‘rtburchak sikl", lesson: "Ikki izobara va ikki izoxora. Sikl yuzasi Δp·ΔV ga teng. Issiqlik turli temperaturalarda olingani uchun FIK shu T₁, T₂ dagi Karno FIKidan ancha kichik.", set: () => setCycle("he", "rect", 900, 300, 2) },
  otto: { mode: "cycle", title: "Otto sikli", lesson: "Benzin dvigatelining ideal sikli: siqish (adiabata), yonish (izoxora), kengayish (adiabata), chiqarish (izoxora). ε = 8 da η = 1 − 8^(−0,4) ≈ 56 %.", set: () => setCycle("air", "otto", 1800, 300, 8) },
  fridge: { mode: "cycle", title: "Sovutgich (teskari Karno)", lesson: "Sikl teskari yo‘nalishda: kompressor ish bajaradi, gaz sovuq kameradan (260 K) issiqlik olib, xonaga (300 K) beradi. ε = T₂/(T₁ − T₂) = 6,5 — 1 J ishga 6,5 J issiqlik ko‘chiriladi.", set: () => setCycle("he", "rev", 300, 260, 2) },
  otto4: { mode: "engine", title: "To‘rt taktli dvigatel", lesson: "So‘rish → siqish → ish yo‘li → chiqarish: ikki aylanishda bitta ish sikli. Tirsakli valni sahnada aylantirib, har taktda klapanlar va p–V diagrammadagi nuqtani kuzating.", set: () => Object.assign(eng, { eps: 9, Tmax: 2400, rpm: 3000, th: 0 }), speed: 1 },
  highEps: { mode: "engine", title: "Yuqori siqish darajasi", lesson: "ε = 12: siqish oxirida havo ko‘proq qiziydi, ideal FIK 63 % gacha ortadi va bir sikl ishi ko‘payadi. Benzin uchun bu chegaraga yaqin (detonatsiya).", set: () => Object.assign(eng, { eps: 12, Tmax: 2400, rpm: 3000, th: 0 }), speed: 1 },
  slow: { mode: "engine", title: "Sekin: taktlarni kuzatish", lesson: "Animatsiya 4 marta sekinlashtirildi. Klapanlar qachon ochilishini, sham qachon uchqun berishini va gaz rangi (aralashma → yonish → chiqindi gaz) qanday o‘zgarishini kuzating.", set: () => Object.assign(eng, { eps: 9, Tmax: 2400, rpm: 3000, th: 0 }), speed: 0.25 },
};
function setProc(gk, kind, V, T, to) {
  gasState.key = gk; proc.kind = kind; resetProc(V, T);
  if (to) { const flow = proc.flow; applyTarget(to); proc.flowT = 0; proc.flow = flow; }
}
function setCycle(gk, name, T1, T2, r) { gasState.key = gk; Object.assign(cyc, { name, T1, T2, r, u: 0, cylX: null }); buildCycle(); }

const GROUPS = [["1-qonun: jarayonlar", ["internal", "isobar", "isotherm", "adiabC", "adiabE", "helium"]], ["Sikllar va FIK", ["karno", "karnoCold", "rect", "otto", "fridge"]], ["Dvigatel", ["otto4", "highEps", "slow"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { proc: "Porshen dastasini yoki termometrni suring", cycle: "T₁/T₂ dastaklarini chap/o‘ngga suring", engine: "Tirsakli valni aylantiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { proc: "Porshenli silindrdagi gaz, termometr va issiqlik manbai", cycle: "Silindr isitkich, izolyatsiya va sovitkich ustida; energiya oqimi sxemasi", engine: "To‘rt taktli ichki yonuv dvigateli: porshen, shatun, tirsakli val, klapanlar" }[ui.mode]);
}
function syncAll() {
  gasSel.value = gasState.key; syncProcCtl(); syncCycleCtl();
  eEC.set(eng.eps); eTC.set(eng.Tmax); eNC.set(eng.rpm); syncSpeed();
}
const MODE_DEFAULT = { proc: "isobar", cycle: "karno", engine: "otto4" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  if (p.mode === "engine") buildEngine();
  ui.speed = p.speed ?? 1;
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || "pv");
  setPlayUI(loop.running);
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

resetProc(); buildCycle(); buildEngine();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "isobar");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
