// ==========================================================================
// Elektr zanjiri — virtual laboratoriya (simulations/circuit.html)
// Foydalanuvchi asboblar qutisidan qurilmalarni (manba, kalit, rezistor, reostat, o'tkazgich, lampochka,
// diod, LED, ampermetr, voltmetr) maydonga sudrab yoki tanlab qo'yadi, sim tortadi va zanjir yig'adi.
// Fizika: circuit-physics.js (tugun potensiallari usuli + diodlar uchun Nyuton, Node'da tekshirilgan).
// To'r va tayyor zanjirlar: circuit-grid.js. Grafiklar: circuit-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { solve, resistanceOf, voltmeterReading, MATERIALS, LED_COLORS, LED_I_NOM, LED_I_MAX, R_VOLT } from "./circuit-physics.js";
import {
  COLS, ROWS, NODE_COUNT, EDGES, nodeCR, hEdge, vEdge, PRESETS, PRESET_ORDER, defaultProps, toElements, labelsFor, TYPE_INFO,
} from "./circuit-grid.js";
import { drawBars, drawIU, drawSource } from "./circuit-plots.js";
import { createDCCircuitLab } from "./dc-circuit-lab-3d.js?v=20261123-batch8c";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch8c";

const $ = (s) => document.querySelector(s);
const LOAD_TYPES = new Set(["resistor", "rheostat", "conductor", "lamp", "diode", "led"]);
const LINEAR = new Set(["resistor", "rheostat", "conductor", "lamp"]);
const DIODES = new Set(["diode", "led"]);
const FLIPPABLE = new Set(["battery", "diode", "led", "voltmeter"]);
const I_ZERO = 1e-6;     // bundan kichik tok ko'rsatkichlarda 0
const I_OPEN = 1e-4;     // manba toki bundan kichik — zanjir amalda ochiq (voltmetr toki hisobga olinmaydi)

/* ------------------------------------------------------------------ Asboblar qutisi */

const S = (d) => `<svg viewBox="0 0 44 24" aria-hidden="true" focusable="false">${d}</svg>`;
const PALETTE = [
  { group: "Boshqarish", items: [
    { tool: "select", label: "Tanlash", title: "Elementni tanlash va sudrab ko‘chirish; kalitni bosish — ulash/uzish", svg: S('<path d="M16 3l12 9.5-5.6.9 3.3 6.3-2.7 1.4-3.2-6.3L16 19Z" fill="currentColor" stroke="none"/>'), noDrag: true },
    { tool: "wire", label: "Sim", title: "Ulovchi sim: qirraga bosing yoki sudrab torting", svg: S('<path d="M5 12h34"/><circle cx="5" cy="12" r="2.4" fill="currentColor"/><circle cx="39" cy="12" r="2.4" fill="currentColor"/>') },
    { tool: "erase", label: "O‘chirish", title: "Elementni yoki simni o‘chirish", svg: S('<path d="M15 7h14M19 7V5h6v2M17 7l1.2 13h7.6L27 7"/>'), noDrag: true },
  ] },
  { group: "Manba va kalit", items: [
    { tool: "battery", label: "Batareya", title: "Tok manbai: EYuK ε va ichki qarshilik r", svg: S('<path d="M3 12h15M27 12h14M18 4v16"/><path d="M26 8v8" stroke-width="4"/><path d="M10 4.5h4M12 2.5v4" stroke-width="1.6"/>') },
    { tool: "switch", label: "Kalit", title: "Kalit: zanjirni ulaydi va uzadi", svg: S('<path d="M3 12h11M30 12h11M14 12l14-7"/><circle cx="14" cy="12" r="2.2" fill="currentColor"/><circle cx="30" cy="12" r="2.2" fill="currentColor"/>') },
  ] },
  { group: "Iste’molchilar", items: [
    { tool: "resistor", label: "Rezistor", title: "Rezistor: o‘zgarmas qarshilik R", svg: S('<path d="M3 12h9M32 12h9"/><rect x="12" y="7" width="20" height="10" rx="1"/>') },
    { tool: "rheostat", label: "Reostat", title: "Reostat: siljitgich bilan o‘zgaruvchan qarshilik", svg: S('<path d="M3 12h9M32 12h9"/><rect x="12" y="7" width="20" height="10" rx="1"/><path d="M10 21L33 3M33 3l-5.5.6M33 3l-1.4 5.3"/>') },
    { tool: "conductor", label: "O‘tkazgich", title: "Sim o‘tkazgich: R = ρ·l/S", svg: S('<path d="M3 12h5c2-7 4-7 6 0s4 7 6 0 4-7 6 0 4 7 6 0h8"/>') },
    { tool: "lamp", label: "Lampochka", title: "Cho‘g‘lanma lampochka", svg: S('<path d="M3 12h11M30 12h11"/><circle cx="22" cy="12" r="8"/><path d="M16.4 6.4l11.2 11.2M27.6 6.4L16.4 17.6"/>') },
    { tool: "diode", label: "Diod", title: "Yarimo‘tkazgichli diod: tokni bir yo‘nalishda o‘tkazadi", svg: S('<path d="M3 12h13M28 12h13"/><path d="M16 5l12 7-12 7Z" fill="currentColor" fill-opacity=".18"/><path d="M28 5v14"/>') },
    { tool: "led", label: "LED", title: "Yorug‘lik diodi (LED)", svg: S('<path d="M3 12h13M28 12h13"/><path d="M16 6l11 6-11 6Z" fill="currentColor" fill-opacity=".18"/><path d="M27 6v12"/><path d="M26 5l4-3.5M30 1.5h-2.6M30 1.5v2.6M31 8l4-3.5M35 4.5h-2.6M35 4.5v2.6" stroke-width="1.5"/>') },
  ] },
  { group: "O‘lchov asboblari", items: [
    { tool: "ammeter", label: "Ampermetr", title: "Ampermetr: tok kuchini o‘lchaydi, ketma-ket ulanadi", svg: S('<path d="M3 12h9M32 12h9"/><circle cx="22" cy="12" r="9.5"/><text x="22" y="16.2" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, system-ui, sans-serif">A</text>') },
    { tool: "voltmeter", label: "Voltmetr", title: "Voltmetr: kuchlanishni o‘lchaydi, parallel ulanadi", svg: S('<path d="M3 12h9M32 12h9"/><circle cx="22" cy="12" r="9.5"/><text x="22" y="16.2" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, system-ui, sans-serif">V</text>') },
  ] },
];
const TOOL_BY_ID = new Map(PALETTE.flatMap((g) => g.items).map((t) => [t.tool, t]));
const PLACE_TOOLS = new Set([...TOOL_BY_ID.keys()].filter((t) => t !== "select" && t !== "erase"));

/* ------------------------------------------------------------------ Holat */

let cells = new Map();          // qirra → element xossalari
let selected = null;            // tanlangan qirra
let tool = "select";
let presetId = "ohm";
let lastPreset = "ohm";
let hover = null;               // { kind: "edge", id }
let model = null;               // { elements, index, labels, sol, kOf }
let points = [];                // I(U) o'lchov nuqtalari { edge, U, I }
let drag = null;                // sudrash holati (ko'chirish, sim tortish, qutidan olib kelish)
let dropPreview = null;         // { edge, el, swap }
const ui = { tab: "bars", dir: "conv", potential: true, values: false };
const phase = new Float64Array(EDGES.length);

function recompute() {
  const { elements, index } = toElements(cells);
  const sol = solve(NODE_COUNT, elements);
  model = { elements, index, sol, labels: labelsFor(cells), kOf: new Map(index.map((e, k) => [e, k])) };
}
const elOf = (edge) => (model.kOf.has(edge) ? model.elements[model.kOf.get(edge)] : null);
const resOf = (edge) => (model.kOf.has(edge) ? model.sol.el[model.kOf.get(edge)] : null);
const forEachType = (pred) => model.elements.map((x, k) => ({ x, r: model.sol.el[k], k, edge: model.index[k] })).filter((o) => pred(o.x));

/* ------------------------------------------------------------------ Geometriya */

const scene = createDCCircuitLab();
let touchMode = false;
const pick = (x,y) => scene.pick(x,y,touchMode);

/* ------------------------------------------------------------------ Ranglar (potensial) */

const rgbCache = new Map();
let probeCtx = null;
function toRGB(str) {
  if (rgbCache.has(str)) return rgbCache.get(str);
  probeCtx ||= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probeCtx.canvas.width = probeCtx.canvas.height = 1;
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = str; probeCtx.fillRect(0, 0, 1, 1);
  const d = probeCtx.getImageData(0, 0, 1, 1).data;
  const rgb = [d[0], d[1], d[2]];
  rgbCache.set(str, rgb);
  return rgb;
}
const mixRGB = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const rgba = (rgb, a) => `rgba(${rgb.join(",")},${a})`;

function potentialRange() {
  let lo = Infinity, hi = -Infinity;
  model.sol.phi.forEach((p) => { if (Number.isFinite(p)) { lo = Math.min(lo, p); hi = Math.max(hi, p); } });
  return hi - lo > 1e-9 ? [lo, hi] : null;
}

/** Yorliq uchun qisqa son: 20,0 → 20; 6,60 → 6,6. */
const short = (v) => sci(v, 3).replace(/,0+$/, "").replace(/(,\d*?)0+$/, "$1");
const amps = (I) => (Math.abs(I) < I_ZERO ? "0 A" : Math.abs(I) < 0.1 ? `${short(Math.abs(I) * 1000)} mA` : `${short(Math.abs(I))} A`);

function formatValue(e, r) {
  switch (e.type) {
    case "resistor": return `${short(e.R)} Ω`;
    case "rheostat": case "conductor": case "lamp": return `${short(r?.R ?? resistanceOf(e))} Ω`;
    case "battery": return `${short(e.emf)} V${e.r > 0 ? ` · r=${short(e.r)}` : ""}`;
    case "led": return LED_COLORS[e.color]?.name.toLowerCase() ?? "";
    default: return "";
  }
}

function draw(ctx,stage) {
  scene.draw(ctx,stage,{model,cells,ui,phase,selected,tool,hover,drag,dropPreview,
    potentialRange,toRGB,mixRGB,formatValue,amps,placeTools:PLACE_TOOLS,defaultProps});
}
const heights = w => ({stage:detailedStageHeight(w),graph:Math.round(clamp(innerHeight*.27,170,260))});
const stage = createStage($("#stage"),draw,{height:w=>heights(w).stage});

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  bars: ["Elementlardagi kuchlanish va tok", "Ustunlar balandligi U va I ga mos. Ketma-ket ulashda toklar bir xil, parallelda kuchlanishlar bir xil. Zanjirdagi elementni bosing — u ajratiladi."],
  iu: ["Volt-amper xarakteristikasi I(U)", "Tanlangan iste’molchi uchun. Rezistorda — to‘g‘ri chiziq (Om qonuni), diodda — nochiziqli egri chiziq. «Nuqta qo‘shish» hozirgi U va I ni yozadi; «Avto-o‘lchash» EYuK ni o‘zgartirib o‘lchaydi."],
  src: ["Manba xarakteristikasi U(I)", "Batareya qisqichlaridagi kuchlanish tok ortishi bilan kamayadi: U = ε − I·r. Nuqta — hozirgi rejim."],
};

function graphData() {
  const bk = model.elements.find((e) => e.type === "battery");
  return { ...model, selected, points, emfMax: bk ? bk.emf : 0 };
}
function drawGraphCanvas(ctx, st) {
  if (!model) return;
  const d = graphData();
  if (ui.tab === "iu") drawIU(ctx, st, d);
  else if (ui.tab === "src") drawSource(ctx, st, d);
  else drawBars(ctx, st, d);
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => heights(w).graph });

function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === tab)));
  $("[data-graph-title]").textContent = TABS[tab][0];
  $("[data-graph-sub]").textContent = TABS[tab][1];
  $("[data-iu-tools]").hidden = tab !== "iu";
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* ------------------------------------------------------------------ Natijalar */

function setReadout(key, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
  el.dataset.tone = tone || "";
}
const setLabel = (key, html) => { document.querySelector(`[data-readout="${key}"] [data-label]`).innerHTML = html; };
const val = (v, u) => `${sci(v, 3)}<small>${u}</small>`;
const valI = (I) => (Math.abs(I) < I_ZERO ? `0<small>A</small>` : Math.abs(I) < 0.1 ? val(Math.abs(I) * 1000, "mA") : val(Math.abs(I), "A"));

function updateReadouts() {
  const sol = model.sol, ok = sol.ok;
  const e = selected !== null ? elOf(selected) : null, r = selected !== null ? resOf(selected) : null;
  const name = e ? model.labels.get(selected) || TYPE_INFO[e.type].label : null;
  const sfx = name ? ` · ${name}` : "";
  setLabel("I", `Tok kuchi <i>I</i>${sfx}`); setLabel("U", `Kuchlanish <i>U</i>${sfx}`); setLabel("P", `Quvvat <i>P</i>${sfx}`); setLabel("R", `Qarshilik <i>R</i>${sfx}`);
  if (!e || !ok) {
    const why = !ok ? "Hisoblanmadi" : "Element tanlanmagan";
    ["I", "U", "P", "R"].forEach((k) => setReadout(k, "—", why, "muted"));
  } else if (e.type === "wire") {
    setReadout("I", valI(r.I), "Sim bo‘ylab oqayotgan tok");
    setReadout("U", `0<small>V</small>`, "Ideal sim: potensial o‘zgarmaydi");
    setReadout("P", `0<small>W</small>`, "Qizish yo‘q");
    setReadout("R", `0<small>Ω</small>`, "Ideal sim qarshiligi hisobga olinmaydi");
  } else if (e.type === "switch") {
    setReadout("I", valI(r.I), e.closed ? "Kalit ulangan" : "Kalit uzilgan: tok o‘tmaydi");
    setReadout("U", val(Math.abs(r.U), "V"), e.closed ? "Ulangan kalitda kuchlanish yo‘q" : "Uzilgan joydagi kuchlanish");
    setReadout("P", `0<small>W</small>`, "—"); setReadout("R", e.closed ? `0<small>Ω</small>` : "∞", e.closed ? "Ulangan" : "Uzilgan");
  } else if (e.type === "battery") {
    setReadout("I", valI(r.Iout), r.Iout >= -1e-12 ? "Manba tok beryapti" : "Manba zaryadlanyapti (teskari tok)");
    setReadout("U", val(r.Ut, "V"), `ε = ${fmt(e.emf, 1)} V, Ir = ${fmt(r.drop, 2)} V`);
    setReadout("P", val(r.P, "W"), `Ichki qarshilikda ${sci(r.Ploss, 2)} W isrof`);
    setReadout("R", `${fmt(e.r, 1)}<small>Ω</small>`, "Ichki qarshilik r");
  } else if (e.type === "ammeter") {
    setReadout("I", valI(r.I), "Ampermetr ketma-ket ulanadi"); setReadout("U", `0<small>V</small>`, "Ideal ampermetr: kuchlanish tushmaydi");
    setReadout("P", `0<small>W</small>`, "—"); setReadout("R", `0<small>Ω</small>`, "Ideal ampermetr");
  } else if (e.type === "voltmeter") {
    const v = voltmeterReading(e, r);
    setReadout("I", val(Math.abs(r.I) * 1e6, "μA"), "Voltmetr orqali juda kichik tok o‘tadi");
    setReadout("U", val(v, "V"), v < -1e-9 ? "Manfiy: qutblarini almashtiring" : "Voltmetr parallel ulanadi");
    setReadout("P", val(Math.abs(r.P), "W"), "Deyarli energiya olmaydi");
    setReadout("R", `${fmt(R_VOLT / 1e6, 0)}<small>MΩ</small>`, "Ichki qarshiligi juda katta");
  } else if (DIODES.has(e.type)) {
    const fwd = r.If > I_ZERO;
    setReadout("I", valI(r.If), fwd ? "To‘g‘ri yo‘nalishda o‘tkazyapti" : r.Vf < -1e-3 ? "Teskari ulangan: tok deyarli yo‘q" : "Tok yo‘q");
    setReadout("U", val(r.Vf, "V"), fwd ? (e.type === "led" ? "LED ochilish kuchlanishi ≈ 1,9–2,6 V" : "Kremniy diodda ≈ 0,6–0,8 V tushadi") : "Diodga qo‘yilgan kuchlanish");
    setReadout("P", val(Math.abs(r.P), "W"), e.type === "led" ? (r.If > LED_I_MAX ? "Tok juda katta — LED kuyadi!" : `Yorqinlik ${Math.round(100 * clamp(r.If / LED_I_NOM, 0, 9.99))}%`) : "Diodda ajralayotgan issiqlik");
    setReadout("R", fwd && r.R ? val(r.R, "Ω") : "∞", fwd ? "U/I — tokka bog‘liq (nochiziqli element)" : "Yopiq diod: qarshilik juda katta", r.If > LED_I_MAX && e.type === "led" ? "orange" : "");
  } else {
    setReadout("I", valI(r.I), `I = U/R = ${fmt(Math.abs(r.U), 2)}/${sci(r.R, 3)}`);
    setReadout("U", val(Math.abs(r.U), "V"), "Elementdagi kuchlanish tushuvi");
    setReadout("P", val(r.P, "W"), "P = U·I = I²R");
    const extra = e.type === "lamp" ? `Nominal ${fmt(e.pNom, 0)} W · yorqinlik ${Math.round(100 * clamp(r.P / e.pNom, 0, 9.99))}%` : e.type === "conductor" ? `ρl/S = ${fmt(MATERIALS[e.mat].rho, 3)}·${fmt(e.l, 1)}/${fmt(e.S, 1)}` : e.type === "rheostat" ? `R = ${fmt(e.Rmax, 0)} Ω × ${fmt(e.pos, 2)}` : "Rezistor";
    setReadout("R", val(r.R, "Ω"), extra);
  }

  const bats = forEachType((x) => x.type === "battery");
  if (!bats.length) {
    ["Ut", "Is", "Req", "Ps"].forEach((k) => setReadout(k, "—", "Zanjirda manba yo‘q", "muted"));
  } else if (!ok) {
    ["Ut", "Is", "Req", "Ps"].forEach((k) => setReadout(k, "—", "Qisqa tutashuv", "muted"));
  } else {
    const b = bats[0];
    const open = Math.abs(b.r.Iout) < I_OPEN;
    setReadout("Ut", val(b.r.Ut, "V"), `ε = ${fmt(b.x.emf, 1)} V${b.x.r > 0 ? ` · U = ε − Ir` : ""}`);
    setReadout("Is", valI(b.r.Iout), bats.length > 1 ? `Birinchi manba (jami ${bats.length} ta)` : open ? "Zanjir ochiq" : "Zanjirdagi umumiy tok");
    const Ps = bats.reduce((s, o) => s + o.r.P, 0);
    if (bats.length === 1 && !open) setReadout("Req", val(Math.abs(b.r.Ut / b.r.Iout), "Ω"), `Butun zanjir: ε/I = ${sci(b.x.emf / Math.abs(b.r.Iout), 3)} Ω`);
    else setReadout("Req", open ? "∞" : "—", open ? "Zanjir ochiq" : "Bir nechta manba");
    setReadout("Ps", val(Ps, "W"), "Tashqi zanjirga berilayotgan quvvat");
  }

  // Voltmetrlar
  const vms = forEachType((x) => x.type === "voltmeter");
  const vm = vms.find((o) => o.edge === selected) || vms[0];
  if (!vm) setReadout("Uv", "—", "Voltmetrni o‘lchanadigan elementga parallel ulang", "muted");
  else if (!ok) setReadout("Uv", "—", "Qisqa tutashuv", "muted");
  else {
    const v = voltmeterReading(vm.x, vm.r);
    const others = vms.filter((o) => o !== vm).map((o) => `${model.labels.get(o.edge)}: ${fmt(voltmeterReading(o.x, o.r), 2)} V`).join(" · ");
    setReadout("Uv", val(v, "V"), `${model.labels.get(vm.edge)}${others ? " · " + others : v < -1e-9 ? " · qutblari teskari" : " · parallel ulangan"}`);
  }
}

/* ------------------------------------------------------------------ Holat va tushuntirish */

function updateStatus() {
  const s = $("[data-status]"), sol = model.sol;
  const bats = forEachType((x) => x.type === "battery");
  const maxI = Math.max(0, ...bats.map((o) => Math.abs(o.r.Iout)));
  let text, tone;
  if (sol.error === "short") { text = "Qisqa tutashuv!"; tone = "red"; }
  else if (!model.index.length) { text = "Stol bo‘sh"; tone = ""; }
  else if (!bats.length) { text = "Manba yo‘q"; tone = "blue"; }
  else if (maxI < I_OPEN) { text = "Zanjir ochiq — tok yo‘q"; tone = "orange"; }
  else { text = "Zanjir yopiq — tok o‘tmoqda"; tone = "green"; }
  s.textContent = text; s.dataset.tone = tone;
}

let lastExplain = "";
function updateExplain() {
  const sol = model.sol;
  const bats = forEachType((x) => x.type === "battery");
  const parts = [];
  if (sol.error === "short") parts.push("<p><b>Qisqa tutashuv:</b> manba qarshiliksiz o‘tkazgich (yoki to‘g‘ri ulangan diod) bilan tutashgan, tok juda katta bo‘ladi — real hayotda sim kuyadi. Tutashtiruvchi simni o‘chiring yoki iste’molchi qo‘ying.</p>");
  else if (!bats.length) parts.push("<p>Zanjirda manba yo‘q — tok oqmaydi. Qutidan «Batareya» ni olib, zanjirga qo‘ying.</p>");
  else {
    const b = bats[0], I = Math.abs(b.r.Iout);
    if (I < I_OPEN) parts.push("<p><b>Zanjir ochiq:</b> tok oqmayapti. Uzilgan joyni (ochiq kalit, ulanmagan sim, teskari ulangan diod) toping — voltmetrni shu joyga parallel ulasangiz, u manba kuchlanishini ko‘rsatadi.</p>");
    else {
      const loads = forEachType((x) => LOAD_TYPES.has(x.type));
      const Pl = loads.reduce((s, o) => s + o.r.P, 0), Ps = bats.reduce((s, o) => s + o.r.P, 0);
      parts.push(`<p>Manba <b>ε = ${fmt(b.x.emf, 1)} V</b>${b.x.r > 0 ? `, r = ${fmt(b.x.r, 1)} Ω` : ""}: zanjirdagi tok <b>I = ${amps(I)}</b>, qisqichlardagi kuchlanish <b>${fmt(b.r.Ut, 2)} V</b>.</p>`);
      if (loads.length) parts.push(`<p>Quvvat balansi: manba beradi <b>${sci(Ps, 3)} W</b>, iste’molchilar sarflaydi <b>${sci(Pl, 3)} W</b>${b.x.r > 0 ? `, ichki qarshilikda ${sci(b.r.Ploss, 2)} W isrof bo‘ladi (jami ${sci(Ps + b.r.Ploss, 3)} W = ε·I)` : ""}.</p>`);
    }
  }
  if (sol.ok) {
    const leds = forEachType((x) => x.type === "led");
    if (leds.some((o) => o.r.If > LED_I_MAX)) parts.push(`<p><b>Ogohlantirish:</b> LED orqali ${LED_I_MAX * 1000} mA dan katta tok o‘tyapti — real LED kuyib ketardi. Ketma-ket cheklovchi rezistor qo‘ying.</p>`);
    const vms = forEachType((x) => x.type === "voltmeter");
    if (vms.some((o) => voltmeterReading(o.x, o.r) < -1e-6)) parts.push("<p>Voltmetr ko‘rsatishi manfiy — uning «+» qisqichi past potensialli nuqtaga ulangan. Voltmetrni tanlab «Yo‘nalishni almashtirish» ni bosing.</p>");
    const ams = forEachType((x) => x.type === "ammeter");
    if (ams.some((o) => Math.abs(o.r.I) > 50)) parts.push("<p>Ampermetr orqali juda katta tok o‘tyapti: ampermetrni hech qachon manbaga to‘g‘ridan-to‘g‘ri (iste’molchisiz) ulamang.</p>");
  }
  if (selected !== null && sol.ok) {
    const e = elOf(selected), r = resOf(selected), name = model.labels.get(selected);
    if (e && LINEAR.has(e.type)) parts.push(`<p><b>${name}:</b> U = ${fmt(Math.abs(r.U), 2)} V, R = ${sci(r.R, 3)} Ω → I = U/R = ${amps(r.I)}.</p>`);
    if (e && e.type === "lamp" && r.P > 2 * e.pNom) parts.push("<p><b>Ogohlantirish:</b> lampochkaga nominaldan ancha ortiq quvvat tushyapti — real lampochka kuyib ketardi.</p>");
    if (e && DIODES.has(e.type)) parts.push(r.If > I_ZERO
      ? `<p><b>${name}</b> to‘g‘ri yo‘nalishda ulangan (anod — yuqori potensialda): U = ${fmt(r.Vf, 2)} V, I = ${amps(r.If)}. Diod qarshiligi o‘zgarmas emas — tok ortgani sari U deyarli o‘zgarmaydi, shuning uchun u Om qonuniga bo‘ysunmaydi.</p>`
      : `<p><b>${name}</b> teskari yo‘nalishda (yoki kuchlanish yetarli emas): diod yopiq, tok deyarli o‘tmaydi. Unga ${fmt(Math.max(0, -r.Vf), 2)} V teskari kuchlanish qo‘yilgan.</p>`);
    if (e && e.type === "voltmeter") parts.push(`<p><b>${name}</b> ulangan ikki nuqta orasidagi kuchlanishni ko‘rsatadi. Uning qarshiligi juda katta (1 MΩ), shuning uchun zanjirdagi toklarni deyarli o‘zgartirmaydi. Voltmetrni ketma-ket ulasangiz — zanjirda tok to‘xtaydi.</p>`);
  }
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}

/* ------------------------------------------------------------------ Panel: tanlangan element */

const propsBox = $("[data-props]");
const emfCtl = bindRange($("#emf"), $("#emfOut"), (v) => `${fmt(v, 1)} V`, (v) => edit((e) => { e.emf = v; }));
const rintCtl = bindRange($("#rint"), $("#rintOut"), (v) => (v === 0 ? "ideal (0)" : `${fmt(v, 1)} Ω`), (v) => edit((e) => { e.r = v; }));
const resCtl = bindRange($("#res"), $("#resOut"), (v) => `${fmt(v, 0)} Ω`, (v) => edit((e) => { if (e.type === "rheostat") e.Rmax = v; else e.R = v; }));
const posCtl = bindRange($("#pos"), $("#posOut"), (v) => `${Math.round(v * 100)}%`, (v) => edit((e) => { e.pos = v; }));
const lenCtl = bindRange($("#len"), $("#lenOut"), (v) => `${fmt(v, 1)} m`, (v) => edit((e) => { e.l = v; }));
const secCtl = bindRange($("#sec"), $("#secOut"), (v) => `${fmt(v, 1)} mm²`, (v) => edit((e) => { e.S = v; }));
const matSel = $("#mat");
Object.entries(MATERIALS).forEach(([k, m]) => matSel.insertAdjacentHTML("beforeend", `<option value="${k}">${m.name} — ${fmt(m.rho, 3)} Ω·mm²/m</option>`));
matSel.addEventListener("change", () => edit((e) => { e.mat = matSel.value; }));
const ledSel = $("#ledColor");
Object.entries(LED_COLORS).forEach(([k, m]) => ledSel.insertAdjacentHTML("beforeend", `<option value="${k}">${m.name}</option>`));
ledSel.addEventListener("change", () => edit((e) => { e.color = ledSel.value; }));

function edit(fn) {
  if (selected === null || !cells.has(selected)) return;
  fn(cells.get(selected));
  afterChange({ customize: true });
}

function syncProps() {
  const e = selected !== null ? cells.get(selected) : null;
  propsBox.hidden = !e;
  if (!e) return;
  const show = (key, on) => { propsBox.querySelector(`[data-prop="${key}"]`).hidden = !on; };
  $("[data-props-title]").textContent = `${TYPE_INFO[e.type].label}${model?.labels.get(selected) ? " · " + model.labels.get(selected) : ""}`;
  show("emf", e.type === "battery"); show("rint", e.type === "battery");
  show("res", e.type === "resistor" || e.type === "lamp" || e.type === "rheostat");
  show("pos", e.type === "rheostat");
  show("mat", e.type === "conductor"); show("len", e.type === "conductor"); show("sec", e.type === "conductor");
  show("led", e.type === "led");
  $("[data-switch]").hidden = e.type !== "switch";
  $("[data-flip]").hidden = !FLIPPABLE.has(e.type);
  $("[data-flip]").textContent = e.type === "battery" ? "Qutblarni almashtirish" : "Yo‘nalishni almashtirish";
  if (e.type === "battery") { emfCtl.set(e.emf); rintCtl.set(e.r); }
  if (e.type === "resistor" || e.type === "lamp") { $("[data-res-label]").textContent = e.type === "lamp" ? "Lampochka qarshiligi R" : "Qarshilik R"; resCtl.set(e.R); }
  if (e.type === "rheostat") { $("[data-res-label]").textContent = "Reostat to‘la qarshiligi"; resCtl.set(e.Rmax); posCtl.set(e.pos); }
  if (e.type === "conductor") { matSel.value = e.mat; lenCtl.set(e.l); secCtl.set(e.S); }
  if (e.type === "led") ledSel.value = e.color;
  $("[data-props-note]").textContent = e.type === "wire" ? "Sim — ideal o‘tkazgich (qarshiligi 0)." : e.type === "ammeter" ? "Ampermetr o‘lchanayotgan elementga ketma-ket ulanadi." : e.type === "voltmeter" ? "Voltmetr o‘lchanayotgan elementga parallel ulanadi. «+» qisqich — yuqori potensial tomonga." : DIODES.has(e.type) ? "Uchburchak uchi — tok o‘tadigan yo‘nalish (anoddan katodga)." : "";
}
$("[data-switch]").addEventListener("click", () => edit((e) => { e.closed = !e.closed; }));
$("[data-flip]").addEventListener("click", () => edit((e) => {
  if (e.type === "battery" || e.type === "voltmeter") e.plus = e.plus === "b" ? "a" : "b";
  else e.rev = !e.rev;
  points = points.filter((p) => p.edge !== selected);
}));
$("[data-delete]").addEventListener("click", () => { if (selected !== null) removeAt(selected); });

/* ------------------------------------------------------------------ O'zgarishlar */

function setPresetPressed(id) {
  document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
}

function afterChange({ customize = false, props = true } = {}) {
  if (customize && presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; }
  points = points.filter((p) => cells.has(p.edge));
  recompute();
  if (props) syncProps();
  updateReadouts(); updateStatus(); updateExplain();
  stage.render(); graph.render();
}

function removeAt(edge) {
  if (!cells.delete(edge)) return;
  if (selected === edge) selected = null;
  afterChange({ customize: true });
}

function loadPreset(id) {
  const p = PRESETS[id];
  cells = p.build();
  selected = p.select ?? null;
  points = []; presetId = id; lastPreset = id;
  if (tool !== "select") setTool("select");
  setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  if (p.tab) setTab(p.tab);
  afterChange();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const presetBox = $("[data-presets]");
PRESET_ORDER.forEach((id) => presetBox.insertAdjacentHTML("beforeend", `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`));
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
$("[data-clear]").addEventListener("click", () => { cells = new Map(); selected = null; points = []; afterChange({ customize: true }); setTool("battery"); });
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));
$("[data-reset]").addEventListener("click", () => loadPreset(lastPreset));

/* ------------------------------------------------------------------ Asboblar qutisi (DOM) */

const bin = $("[data-tools]");
bin.innerHTML = PALETTE.map((g) => `<div class="sim-bin__group" role="group" aria-label="${g.group}"><span class="sim-bin__title">${g.group}</span><div class="sim-bin__items">${g.items.map((t) => `<button class="sim-bin__item" type="button" data-tool="${t.tool}" aria-pressed="${t.tool === "select"}" title="${t.title}"${t.noDrag ? "" : ' data-drag="true"'}>${t.svg}<span>${t.label}</span></button>`).join("")}</div></div>`).join("");
const hintEl = $("[data-hint]");

function toolHint(t) {
  if (t === "select") return "Bo‘sh joyni sudrab kamerani aylantiring. Elementni bosing — parametrlari o‘ngda chiqadi. Elementni sudrab boshqa joyga ko‘chiring. Kalitni bosish uni ulaydi yoki uzadi.";
  if (t === "wire") return "Ikki nuqta orasiga bosing yoki sichqonchani bosib turib sudrang — bir nechta sim tortiladi.";
  if (t === "erase") return "O‘chirmoqchi bo‘lgan element yoki simni bosing (sudrab bir nechtasini o‘chirish mumkin). Klaviaturada — Delete.";
  const info = TOOL_BY_ID.get(t);
  const extra = t === "ammeter" ? " Ampermetr zanjirga ketma-ket ulanadi." : t === "voltmeter" ? " Voltmetr elementga parallel ulanadi: alohida shoxcha qilib, element uchlariga ulang." : DIODES.has(t) ? " K belgisi — katod; korpusdagi halqa shu qutbni ko‘rsatadi." : "";
  return `«${info.label}»: ikki nuqta orasidagi qirraga bosing — element qo‘yiladi.${extra} Asbobni qutidan to‘g‘ridan-to‘g‘ri sudrab olib kelish ham mumkin.`;
}

function setTool(t) {
  tool = t;
  bin.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
  stage.canvas.style.cursor = t === "select" ? "" : "crosshair";
  hintEl.textContent = toolHint(t);
  stage.render();
}

let suppressClick = false;
bin.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-tool]");
  if (!b) return;
  if (suppressClick) { suppressClick = false; return; }
  setTool(b.dataset.tool);
});

// Qutidan sudrab olib kelish (sichqoncha va qalam; sensorli ekranda — bosib tanlash)
let ghostEl = null;
bin.addEventListener("pointerdown", (ev) => {
  const b = ev.target.closest("[data-drag]");
  if (!b || ev.pointerType === "touch" || ev.button !== 0) return;
  drag = { kind: "bin", type: b.dataset.tool, sx: ev.clientX, sy: ev.clientY, active: false, btn: b };
  ev.preventDefault();
});
document.addEventListener("pointermove", (ev) => {
  if (drag?.kind !== "bin") return;
  if (!drag.active && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6) {
    drag.active = true;
    ghostEl = document.createElement("div");
    ghostEl.className = "sim-bin__ghost";
    ghostEl.innerHTML = drag.btn.querySelector("svg").outerHTML;
    document.body.appendChild(ghostEl);
    document.body.classList.add("sim-dragging");
  }
  if (!drag.active) return;
  ghostEl.style.left = `${ev.clientX}px`; ghostEl.style.top = `${ev.clientY}px`;
  const r = stage.canvas.getBoundingClientRect();
  const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  const h = inside ? pick(ev.clientX - r.left, ev.clientY - r.top) : null;
  ghostEl.hidden = !!h;
  const next = h ? { edge: h.id, el: defaultProps(drag.type) } : null;
  if ((next?.edge ?? null) !== (dropPreview?.edge ?? null)) { dropPreview = next; stage.render(); }
});
document.addEventListener("pointerup", () => {
  if (drag?.kind !== "bin") return;
  const d = drag; drag = null;
  ghostEl?.remove(); ghostEl = null; document.body.classList.remove("sim-dragging");
  if (!d.active) return; // oddiy bosish — click hodisasi asbobni tanlaydi
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  const target = dropPreview?.edge;
  dropPreview = null;
  if (target === undefined || target === null) { stage.render(); return; }
  cells.set(target, defaultProps(d.type));
  selected = d.type === "wire" ? null : target;
  setTool("select");
  afterChange({ customize: true });
});

/* ------------------------------------------------------------------ Maydondagi sichqoncha / barmoq */

function local(ev) {
  const r = stage.canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function paintAt(h) {
  if (!h || h.id === drag.last) return;
  drag.last = h.id;
  if (tool === "wire") {
    if (cells.has(h.id)) return; // elementlarni ustidan yozmaymiz
    cells.set(h.id, { type: "wire" });
    afterChange({ customize: true, props: false });
  } else if (tool === "erase") removeAt(h.id);
}

function placeAt(h) {
  if (!h) return;
  const cur = cells.get(h.id);
  if (cur && cur.type === tool) { selected = h.id; afterChange(); return; }
  cells.set(h.id, defaultProps(tool));
  selected = h.id;
  afterChange({ customize: true });
}

function commitMove(from, to) {
  if (to === null || to === undefined || to === from) { stage.render(); return; }
  const a = cells.get(from), b = cells.get(to);
  cells.set(to, a);
  if (b) cells.set(from, b); else cells.delete(from);
  points.forEach((p) => { if (p.edge === from) p.edge = to; else if (p.edge === to && b) p.edge = from; });
  selected = to;
  afterChange({ customize: true });
}

const pointers=new Map();
let cameraGesture=null,touchSnapshot=null;
const pinchDistance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
stage.canvas.style.touchAction='none';stage.canvas.tabIndex=0;
stage.canvas.addEventListener("pointerdown", ev=>{
  touchMode=ev.pointerType==='touch';if(ev.button!==0&&!touchMode)return;
  if(touchMode&&!pointers.size)touchSnapshot={
    cells:new Map([...cells].map(([edge,e])=>[edge,{...e}])),selected,
    points:points.map(p=>({...p})),presetId,lesson:$("[data-lesson]").textContent,
  };
  const p=local(ev);pointers.set(ev.pointerId,p);stage.canvas.setPointerCapture(ev.pointerId);
  if(pointers.size>1){
    endCanvasDrag(true);
    // A second finger turns this gesture into camera control. Restore edits made
    // by the first finger, including erased edges and their measured points.
    if(touchSnapshot){
      cells=new Map([...touchSnapshot.cells].map(([edge,e])=>[edge,{...e}]));
      selected=touchSnapshot.selected;points=touchSnapshot.points.map(p=>({...p}));
      presetId=touchSnapshot.presetId;setPresetPressed(presetId);$("[data-lesson]").textContent=touchSnapshot.lesson;
      afterChange();
    }
    cameraGesture={kind:'pinch',distance:pinchDistance(),zoom:scene.lab.camera.zoom};return;
  }
  const handle=tool==='select'?scene.lab.hit(p.x,p.y):null;
  if(handle?.startsWith('slider:')){selected=+handle.split(':')[1];drag={kind:'control',edge:selected};afterChange();return;}
  const h=pick(p.x,p.y);hover=h;
  if(tool==='select'){
    if(h&&cells.has(h.id))drag={kind:'move',from:h.id,sx:p.x,sy:p.y,x:p.x,y:p.y,active:false};
    else{selected=null;cameraGesture={kind:'orbit',last:p};afterChange();}
  }else if(!h)cameraGesture={kind:'orbit',last:p};
  else if(tool==='wire'||tool==='erase'){drag={kind:'paint',last:null};paintAt(h);}
  else placeAt(h);
});
stage.canvas.addEventListener("pointermove",ev=>{
  const p=local(ev);if(pointers.has(ev.pointerId))pointers.set(ev.pointerId,p);
  if(cameraGesture&&pointers.has(ev.pointerId)){
    if(cameraGesture.kind==='pinch'&&pointers.size>1)scene.lab.camera.zoom=clamp(cameraGesture.zoom*pinchDistance()/Math.max(cameraGesture.distance,1),.7,1.65);
    else if(cameraGesture.kind==='orbit'){
      scene.lab.camera.yaw+=(p.x-cameraGesture.last.x)*.009;
      scene.lab.camera.pitch=clamp(scene.lab.camera.pitch+(p.y-cameraGesture.last.y)*.006,.08,1.35);cameraGesture.last=p;
    }
    stage.render();return;
  }
  if(drag?.kind==='control'){
    const e=cells.get(drag.edge);if(e?.type==='rheostat'){e.pos=Math.round(scene.slider(drag.edge,p)*100)/100;posCtl.set(e.pos);afterChange({customize:true});}return;
  }
  const h=pick(p.x,p.y),changed=(h?.id??null)!==(hover?.id??null);hover=h;
  if(drag?.kind==='move'){
    if(!drag.active&&Math.hypot(p.x-drag.sx,p.y-drag.sy)>6){drag.active=true;stage.canvas.dataset.dragging='true';}
    if(drag.active){drag.x=p.x;drag.y=p.y;const t=h&&h.id!==drag.from?h.id:null;
      dropPreview=t!==null?{edge:t,el:cells.get(drag.from),swap:cells.has(t)}:null;stage.render();return;}
  }else if(drag?.kind==='paint')paintAt(h);
  stage.canvas.style.cursor=tool==='select'?(h&&cells.has(h.id)?'grab':'move'):'crosshair';
  if(changed&&!loop.running)stage.render();
});
function endCanvasDrag(cancel){
  const d=drag;if(!d||d.kind==='bin')return;drag=null;delete stage.canvas.dataset.dragging;
  if(d.kind==='move'){
    const target=dropPreview?.edge;dropPreview=null;if(cancel){stage.render();return;}
    if(d.active){commitMove(d.from,target);return;}
    selected=d.from;const e=cells.get(d.from);
    if(e?.type==='switch'){e.closed=!e.closed;afterChange({customize:true});return;}afterChange();
  }
}
const endPointer=ev=>{
  if(!pointers.has(ev.pointerId))return;pointers.delete(ev.pointerId);endCanvasDrag(ev.type!=='pointerup');cameraGesture=null;
  if(!pointers.size)touchSnapshot=null;
  if(stage.canvas.hasPointerCapture(ev.pointerId))stage.canvas.releasePointerCapture(ev.pointerId);stage.render();
};
for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.canvas.addEventListener(type,endPointer);
stage.canvas.addEventListener('pointerleave',()=>{if(!drag&&!cameraGesture){hover=null;if(!loop.running)stage.render();}});
stage.canvas.addEventListener('wheel',ev=>{ev.preventDefault();scene.lab.camera.zoom=clamp(scene.lab.camera.zoom*Math.exp(-ev.deltaY*.001),.7,1.65);stage.render();},{passive:false});
stage.canvas.addEventListener('keydown',ev=>{
  if(ev.ctrlKey||ev.metaKey||ev.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(ev.key))return;ev.preventDefault();
  const c=scene.lab.camera;
  if(ev.key==='ArrowLeft')c.yaw-=.15;if(ev.key==='ArrowRight')c.yaw+=.15;
  if(ev.key==='ArrowUp')c.pitch=clamp(c.pitch+.1,.08,1.35);if(ev.key==='ArrowDown')c.pitch=clamp(c.pitch-.1,.08,1.35);
  if(ev.key==='+'||ev.key==='=')c.zoom=clamp(c.zoom+.1,.7,1.65);if(ev.key==='-')c.zoom=clamp(c.zoom-.1,.7,1.65);
  if(ev.key==='Home'){scene.lab.reset();Object.assign(c,{pitch:.8,yaw:-.35});}stage.render();
});
document.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{
  const c=scene.lab.camera,name=button.dataset.camera;
  if(name==='reset'){scene.lab.reset();Object.assign(c,{pitch:.8,yaw:-.35});}
  if(name==='front')Object.assign(c,{yaw:0,pitch:.3,zoom:1});
  if(name==='side')Object.assign(c,{yaw:Math.PI/2,pitch:.6,zoom:1});
  if(name==='top')Object.assign(c,{yaw:0,pitch:1.3,zoom:1});stage.render();
}));

document.addEventListener("keydown", (ev) => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
  if ((ev.key === "Delete" || ev.key === "Backspace") && selected !== null) { ev.preventDefault(); removeAt(selected); }
  else if (ev.key === "Escape") { if (drag?.kind === "move") endCanvasDrag(true); setTool("select"); }
});

/* ------------------------------------------------------------------ Animatsiya */

const playBtn = $("[data-play]");
function syncPlay(running) {
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : "Davom ettirish";
}
const loop = createLoop((dt) => {
  if (!model) return;
  model.index.forEach((edge, k) => {
    const I = model.sol.el[k].I;
    if (!model.sol.ok || Math.abs(I) < 1e-5) return;
    const speed = Math.min(120, 20 + 55 * Math.log10(1 + 10 * Math.abs(I)));
    phase[edge] += (I > 0 ? 1 : -1) * (ui.dir === "elec" ? -1 : 1) * speed * dt;
  });
  stage.render();
}, { onStateChange: syncPlay });
playBtn.addEventListener("click", () => { loop.toggle(); stage.render(); });

document.querySelectorAll("[data-dir-value]").forEach((b) => b.addEventListener("click", () => {
  ui.dir = b.dataset.dirValue;
  document.querySelectorAll("[data-dir-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  stage.render();
}));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  ui[cb.dataset.toggle] = cb.checked; stage.render();
}));

/* ------------------------------------------------------------------ I(U) o'lchash */

function selectedLoad() {
  if (selected === null || !model.kOf.has(selected)) return null;
  const e = elOf(selected);
  return e && LOAD_TYPES.has(e.type) ? { e, k: model.kOf.get(selected) } : null;
}
const pointOf = (e, r) => (DIODES.has(e.type) ? { U: r.Vf, I: r.If } : { U: Math.abs(r.U), I: Math.abs(r.I) });
$("[data-iu-add]").addEventListener("click", () => {
  const s = selectedLoad();
  if (!s || !model.sol.ok) return;
  points.push({ edge: selected, ...pointOf(s.e, model.sol.el[s.k]) });
  graph.render();
});
$("[data-iu-clear]").addEventListener("click", () => { points = points.filter((p) => p.edge !== selected); graph.render(); });
$("[data-iu-scan]").addEventListener("click", () => {
  const s = selectedLoad();
  const bi = model.elements.findIndex((e) => e.type === "battery");
  if (!s || bi < 0) return;
  const base = model.elements[bi].emf;
  const diode = DIODES.has(s.e.type);
  points = points.filter((p) => p.edge !== selected);
  const steps = diode ? [-8, -6, -4, -2, 1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8];
  steps.forEach((i) => {
    const els = model.elements.map((e, k) => (k === bi ? { ...e, emf: (base * i) / 8 } : e));
    const sol = solve(NODE_COUNT, els);
    if (sol.ok) points.push({ edge: selected, ...pointOf(s.e, sol.el[s.k]) });
  });
  graph.render();
});

/* ------------------------------------------------------------------ Boshlash */

const q = new URLSearchParams(location.search).get("preset");
setTool("select");
loadPreset(PRESETS[q] ? q : "ohm");
if (!prefersReducedMotion()) loop.start(); else { syncPlay(false); stage.render(); }
