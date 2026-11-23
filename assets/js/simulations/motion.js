// ==========================================================================
// Harakat grafiklari — virtual laboratoriya (simulations/motion.html)
// 1) Tekis harakat: avtomobil (va velosipedchi) to'g'ri yo'lda; x₀ va v sahnada suriladi; x(t), v(t), a(t),
//    har 1 s dagi o'rni (stroboskop), uchrashish va quvib yetish.
// 2) Notekis (tekis o'zgaruvchan) harakat: tezlanish o'qi, tormozlash (v = 0 da to'xtash), qaytuvchi harakat.
// 3) Grafikdan harakat: v(t) ni tugunlarni surib chizish (zinapoya yoki siniq chiziq) — yo'l, ko'chish,
//    o'rtacha tezlik.
// O'q uzunligi: tezlik o'qi — 1 s da o'tiladigan yo'l (yo'l masshtabida), tezlanish o'qi — 5 marta kattalashtirilgan.
// Fizika: motion-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./motion-physics.js";
import { drawPlot, lastFrame } from "./motion-plots.js";
import { createMotionLab } from "./motion-lab-3d.js?v=20261123-batch6b";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch6b";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch6b";

const $ = (s) => document.querySelector(s);
const TMAX = 10, XL = -10, XR = 160, DT = 2;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "uni", tab: "x", speed: 1, show: { dots: true, ghost: true }, hover: null };
const A = { x0: 10, v0: 5, a: 2 };
const B = { on: false, x0: 120, v0: -5, a: 0 };
const pw = { x0: 0, shape: "lin", lin: [0, 10, 10, 10, 10, 0], step: [12, 12, 12, 4, 4] };
const sim = { t: 0, T: TMAX, edge: false, stop: true };
let models = { A: null, B: null }, meet = null, win = [XL, XR];
let presetId = null;
const dirMemo = { A: 1, B: -1 };

function build() {
  if (ui.mode === "pw") {
    models = { A: P.piecewise({ x0: pw.x0, nodes: pw[pw.shape], dt: DT, shape: pw.shape }), B: null };
    const [lo, hi] = P.xRange(models.A, TMAX);
    win = [Math.min(XL, Math.floor((lo - 5) / 10) * 10), Math.max(XR, Math.ceil((hi + 5) / 10) * 10)];
    sim.T = TMAX; sim.edge = false; meet = null;
    return;
  }
  const acc = ui.mode === "acc";
  models = {
    A: P.body({ x0: A.x0, v0: A.v0, a: acc ? A.a : 0, stop: acc && sim.stop }),
    B: B.on ? P.body({ x0: B.x0, v0: B.v0, a: acc ? B.a : 0, stop: acc && sim.stop }) : null,
  };
  win = [XL, XR];
  const te = [models.A, models.B].filter(Boolean).map((m) => P.edgeTime(m, XL, XR, TMAX)).filter((t) => t !== null);
  sim.T = te.length ? Math.min(TMAX, ...te) : TMAX; sim.edge = te.length > 0 && sim.T < TMAX;
  meet = null;
  if (models.B) { const t = P.meetTime(models.A, models.B, sim.T); if (t !== null) meet = { t, x: models.A.state(t).x }; }
}

/* ------------------------------------------------------------------ Sahna */

const COL = c => ({ A: c.primary, B: c.success, acc: c.warning });
const scene = createMotionLab();
function draw(ctx, st) {
  if (models.A) scene.draw(ctx, st, ui, models, sim, meet, win, dirMemo, !!ui.playing);
}
const heights = () => ({graph: Math.round(clamp(innerHeight * .3, 190, 280))});
const stage = createStage($("#stage"), draw, {height: detailedStageHeight});

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  x: ["Koordinata grafigi x(t)", "Tekis harakatda x(t) — to‘g‘ri chiziq, uning qiyaligi tezlikka teng. Tekis o‘zgaruvchan harakatda — parabola. Kursor qo‘yilgan nuqtadagi urinma oniy tezlikni ko‘rsatadi."],
  v: ["Tezlik grafigi v(t)", "Grafik ostidagi yuza — ko‘chish Δx (o‘qdan pastdagi yuza manfiy), yuzalar modullari yig‘indisi — yo‘l s. Tekis harakatda v(t) gorizontal chiziq."],
  a: ["Tezlanish grafigi a(t)", "Tekis harakatda a = 0. Tekis o‘zgaruvchan harakatda a(t) — gorizontal chiziq; a > 0 — tezlik ortadi (musbat yo‘nalishda), a < 0 — kamayadi."],
};
function graphRange() {
  if (ui.tab === "x") return ui.mode === "pw" ? win : [XL, XR];
  if (ui.tab === "v") return [-15, 20];
  let am = 5;
  if (ui.mode === "pw") models.A.segs.forEach((g) => { am = Math.max(am, Math.ceil(Math.abs(g.a))); });
  return [-am, am];
}
function drawGraph(ctx, gst) {
  if (!models.A) return;
  const c = gst.colors, col = COL(c), [yMin, yMax] = graphRange();
  const series = [{ m: models.A, color: col.A, label: "Avtomobil (A)", short: "A", Tend: sim.T }];
  if (models.B) series.push({ m: models.B, color: col.B, label: "Velosipedchi (B)", short: "B", Tend: sim.T });
  let nodes = null;
  if (ui.mode === "pw") nodes = pw.shape === "lin" ? pw.lin.map((v, i) => ({ t: i * DT, v })) : pw.step.map((v, i) => ({ t: i * DT + DT / 2, v, w: DT / 2 }));
  drawPlot(ctx, gst, { tab: ui.tab, tMax: TMAX, tNow: Math.min(sim.t, sim.T), yMin, yMax, series, ghost: ui.show.ghost, hover: ui.hover, meet, nodes });
}
const graph = createStage($("#graph"), drawGraph, { height: (cw) => heights(cw).graph });
function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab-value]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tabValue === tab)));
  $("[data-graph-title]").textContent = TABS[tab][0];
  $("[data-graph-sub]").textContent = TABS[tab][1] + (ui.mode === "pw" && tab === "v" ? " Tugunlarni surib grafikni o‘zgartiring." : "");
  graph.canvas.setAttribute("aria-label", TABS[tab][0]);
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, d, unit) => `${fmt(v, d)}<small>${unit}</small>`;
const kmh = (v) => `${fmt(v * 3.6, 1)} km/soat`;

function updateReadouts() {
  const t = Math.min(sim.t, sim.T), a = models.A.state(t), x0 = models.A.state(0).x, dx = a.x - x0;
  setRO("r1", "Vaqt <i>t</i>", u(t, 2, "s"), sim.t >= sim.T ? (sim.edge ? "jism yo‘l chetiga yetdi" : "tajriba tugadi") : `tajriba ${fmt(sim.T, sim.T % 1 ? 2 : 0)} s gacha`);
  setRO("r2", "Koordinata <i>x</i>", u(a.x, 1, "m"), `x₀ = ${fmt(x0, 0)} m`);
  setRO("r3", "Tezlik <i>v</i>", u(a.v, 2, "m/s"), `= ${kmh(a.v)}${a.v < -1e-6 ? " (x o‘qiga qarshi)" : ""}`);
  if (ui.mode === "pw") {
    const T = sim.T, fin = models.A.state(T), av = P.averages(models.A, T);
    setRO("r4", "Yo‘l <i>s</i> / ko‘chish <i>Δx</i>", `${fmt(a.s, 1)} / ${fmt(dx, 1)}<small>m</small>`, "s = ∫|v|dt, Δx = x − x₀");
    setRO("r5", "O‘rtacha tezlik (10 s)", u(av.vs, 2, "m/s"), `= s/t = ${fmt(fin.s, 1)} m / ${fmt(T, 0)} s`, "orange");
    setRO("r6", "O‘rtacha ko‘chish tezligi", u(av.vx, 2, "m/s"), `Δx/t = ${fmt(fin.x - x0, 1)} m / ${fmt(T, 0)} s`);
    return;
  }
  if (ui.mode === "uni") setRO("r4", "Ko‘chish <i>Δx</i>", u(dx, 1, "m"), `= v·t = ${fmt(a.v, 1)}·${fmt(t, 2)}; yo‘l s = ${fmt(a.s, 1)} m`);
  else setRO("r4", "Tezlanish <i>a</i>", u(a.a, 2, "m/s²"), models.A.ts < Infinity && t >= models.A.ts ? `to‘xtadi (t = ${fmt(models.A.ts, 2)} s)` : a.a * a.v > 0 ? "tezlik moduli ortmoqda" : a.a * a.v < 0 ? "tezlik moduli kamaymoqda" : "a = 0");
  if (ui.mode === "acc") setRO("r5", "Yo‘l <i>s</i> / ko‘chish <i>Δx</i>", `${fmt(a.s, 1)} / ${fmt(dx, 1)}<small>m</small>`, t > 0 ? `o‘rtacha tezlik s/t = ${fmt(a.s / t, 2)} m/s` : "s = |∫v dt| bo‘laklab");
  if (models.B) {
    const b = models.B.state(t);
    if (ui.mode === "uni") setRO("r5", "Velosipedchi <i>x<sub>B</sub></i>", u(b.x, 1, "m"), `v_B = ${fmt(b.v, 1)} m/s; oraliq ${fmt(Math.abs(b.x - a.x), 1)} m`);
    setRO("r6", "Uchrashish", meet ? u(meet.t, 2, "s") : "—", meet ? `x = ${fmt(meet.x, 1)} m${sim.t >= meet.t ? " ✓ uchrashdi" : ""}` : `${fmt(sim.T, 0)} s ichida uchrashmaydi`, meet && sim.t >= meet.t ? "orange" : "");
  } else {
    if (ui.mode === "uni") setRO("r5", "Grafik qiyaligi", u(dx / Math.max(t, 1e-9) || A.v0, 2, "m/s"), "Δx/Δt — tekis harakatda doim v ga teng");
    setRO("r6", ui.mode === "uni" ? "1 s da o‘tiladigan yo‘l" : "Tezlik o‘zgarishi <i>Δv</i>", ui.mode === "uni" ? u(Math.abs(A.v0), 1, "m") : u(a.v - A.v0, 2, "m/s"), ui.mode === "uni" ? "har sekundda bir xil — tekis harakat" : `= a·t (har 1 s da ${fmt(Math.abs(A.a), 2)} m/s ga)`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (sim.t >= sim.T) { t = sim.edge ? "Jism yo‘l chetiga yetdi" : "Tajriba tugadi"; tone = "green"; }
  else if (meet && sim.t >= meet.t && sim.t < meet.t + 1.2) { t = "Uchrashdi!"; tone = "orange"; }
  else if (loop.running) { t = "Harakatlanmoqda"; tone = "purple"; }
  else if (sim.t > 0) { t = "Pauza"; tone = "blue"; }
  else { t = ui.mode === "pw" ? "v(t) ni chizing va boshlang" : "Parametrlarni o‘rnating va boshlang"; tone = "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "uni") {
    p.push(`<p><b>Tekis harakat</b> — jism istalgan teng vaqt oraliqlarida teng masofalar o‘tadi: har 1 s dagi nuqtalar oralig‘i bir xil (${fmt(Math.abs(A.v0), 1)} m). x(t) grafigi — to‘g‘ri chiziq, uning qiyaligi tezlikka teng; v(t) — gorizontal chiziq, a = 0.</p>`);
    p.push(A.v0 < 0 ? "<p>Tezlik manfiy: avtomobil x o‘qiga qarshi harakatlanmoqda, koordinata kamayadi va x(t) pastga og‘adi. Yo‘l esa doim musbat: s = |v|·t.</p>" : "<p>Tezlik o‘qining uzunligi — avtomobil 1 s da o‘tadigan yo‘lga teng (yo‘l masshtabida). O‘q uchini surib tezlikni, avtomobilni surib boshlang‘ich koordinatani o‘zgartiring.</p>");
    if (models.B) p.push(meet ? `<p>Ikki jism grafiklari kesishgan nuqta — <b>uchrashish</b>: t = ${fmt(meet.t, 2)} s, x = ${fmt(meet.x, 1)} m. Uni tenglamadan ham topish mumkin: x₀A + v_A·t = x₀B + v_B·t.</p>` : "<p>Grafiklar 10 s ichida kesishmaydi — jismlar uchrashmaydi (tezliklar teng bo‘lsa, chiziqlar parallel).</p>");
  } else if (ui.mode === "acc") {
    p.push(`<p><b>Tekis o‘zgaruvchan harakat</b>da tezlik har sekundda bir xil kattalikka (a = ${fmt(A.a, 2)} m/s²) o‘zgaradi. Shuning uchun har 1 s dagi nuqtalar oralig‘i ${A.a * A.v0 >= 0 && A.a !== 0 ? "ortib boradi" : "o‘zgarib boradi"}, x(t) grafigi — parabola, v(t) — og‘ma chiziq.</p>`);
    p.push(A.a * A.v0 < 0 ? `<p>Tezlanish tezlikka qarama-qarshi — jism <b>sekinlashmoqda</b>. ${sim.stop ? `Tormozlangan avtomobil t = ${fmt(-A.v0 / A.a, 2)} s da to‘xtaydi; to‘xtash yo‘li v₀²/(2|a|) = ${fmt((A.v0 * A.v0) / (2 * Math.abs(A.a)), 1)} m.` : "Tormoz o‘chirilgan: tezlik nolga yetgach jism orqaga harakatlanadi (yuqoriga otilgan tosh kabi) — ko‘chish yo‘ldan kichik bo‘ladi."}</p>` : "<p>v(t) grafigi ostidagi yuza (trapetsiya) ko‘chishga teng: Δx = (v₀ + v)·t/2. Grafik ustida kursor bilan yurib, yuzani kuzating.</p>");
    if (models.B && meet) p.push(`<p>Grafiklar t = ${fmt(meet.t, 2)} s da kesishadi — jismlar uchrashadi (x = ${fmt(meet.x, 1)} m).</p>`);
  } else {
    const av = P.averages(models.A, TMAX);
    p.push(pw.shape === "step" ? "<p>Har bir 2 s li bo‘lakda avtomobil tekis harakatlanadi (tezlik sakrab o‘zgaradi — bu idealizatsiya). v(t) ostidagi to‘rtburchaklar yuzalari yig‘indisi — ko‘chish.</p>" : "<p>Har bo‘lakda tezlik tekis o‘zgaradi (tekis o‘zgaruvchan harakat). x(t) grafigi parabola bo‘laklaridan iborat: v(t) qayerda katta bo‘lsa, x(t) shu joyda tik.</p>");
    p.push(`<p><b>O‘rtacha tezlik</b> = umumiy yo‘l / umumiy vaqt = ${fmt(av.vs, 2)} m/s. U tezliklarning oddiy o‘rtacha qiymatiga teng bo‘lmasligi mumkin. Agar avtomobil orqaga ham yursa, ko‘chish yo‘ldan kichik: o‘rtacha ko‘chish tezligi ${fmt(av.vx, 2)} m/s.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "uni" ? "<small>Tekis harakat</small> x = x₀ + vt" : ui.mode === "acc" ? "<small>Tekis o‘zgaruvchan</small> x = x₀ + v₀t + at²/2" : "<small>O‘rtacha tezlik</small> v = s/t";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  sim.t = Math.min(sim.T, sim.t + dt * ui.speed);
  if (sim.t >= sim.T) { loop.stop(); refresh(); return; }
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  ui.playing = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : sim.t > 0 && sim.t < sim.T ? "Davom ettirish" : "Boshlash";
  if (models.A) refresh();
}
playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (sim.t >= sim.T) sim.t = 0;
  if (prefersReducedMotion()) { sim.t = sim.T; refresh(); setPlayUI(false); return; }
  loop.start();
});
/** Parametr o'zgardi: boshidan, to'xtatilgan holda. */
function changed() { loop.stop(); sim.t = 0; build(); customized(); setPlayUI(false); }
$("[data-reset]").addEventListener("click", () => { loop.stop(); sim.t = 0; setPlayUI(false); });
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = +b.dataset.speedValue;
  document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* ------------------------------------------------------------------ Boshqaruv */

const sgnF = (d, unit) => (v) => `${v > 0 ? "+" : ""}${fmt(v, d)} ${unit}`;
const aXC = bindRange($("#aX"), $("#aXOut"), (v) => `${fmt(v, 0)} m`, (v) => { A.x0 = v; changed(); });
const aVC = bindRange($("#aV"), $("#aVOut"), sgnF(1, "m/s"), (v) => { A.v0 = v; changed(); });
const aAC = bindRange($("#aA"), $("#aAOut"), sgnF(2, "m/s²"), (v) => { A.a = v; changed(); });
const bXC = bindRange($("#bX"), $("#bXOut"), (v) => `${fmt(v, 0)} m`, (v) => { B.x0 = v; changed(); });
const bVC = bindRange($("#bV"), $("#bVOut"), sgnF(1, "m/s"), (v) => { B.v0 = v; changed(); });
const bAC = bindRange($("#bA"), $("#bAOut"), sgnF(2, "m/s²"), (v) => { B.a = v; changed(); });
const pXC = bindRange($("#pX"), $("#pXOut"), (v) => `${fmt(v, 0)} m`, (v) => { pw.x0 = v; changed(); });
const bOn = $("#bOn"), stopCb = $("#stop");
bOn.addEventListener("change", () => { B.on = bOn.checked; syncB(); changed(); });
stopCb.addEventListener("change", () => { sim.stop = stopCb.checked; changed(); });
document.querySelectorAll("[data-shape-value]").forEach((b) => b.addEventListener("click", () => { pw.shape = b.dataset.shapeValue; syncShape(); changed(); }));
const syncB = () => document.querySelectorAll("[data-b]").forEach((el) => { el.style.display = B.on ? "" : "none"; });
const syncShape = () => document.querySelectorAll("[data-shape-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shapeValue === pw.shape)));

/* Sahnadagi 3D dastaklar; grafikning alohida pointer boshqaruvi saqlanadi. */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) {
    drag = id;
    if (loop.running || sim.t > 0) { loop.stop(); sim.t = 0; setPlayUI(false); }
  },
  move(id, p) {
    if (drag !== id) return;
    const [key, part] = id.split(":"), o = key === "A" ? A : B;
    const value = scene.parameter(id, p);
    if (part === "car") {
      const x = Math.round(value);
      if (ui.mode === "pw") { pw.x0 = clamp(x, 0, 100); pXC.set(pw.x0); }
      else { o.x0 = clamp(x, 0, 150); (key === "A" ? aXC : bXC).set(o.x0); }
    } else if (part === "v") {
      o.v0 = clamp(Math.round(value * 2) / 2, -15, 20); (key === "A" ? aVC : bVC).set(o.v0);
    } else {
      o.a = clamp(Math.round(value * 4) / 4, -4, 4); (key === "A" ? aAC : bAC).set(o.a);
    }
    changed();
  },
  end() { drag = null; refresh(); },
});

/* Grafikda: kursor bilan o'qish, vaqtni surish, v(t) tugunlari */
const gcv = graph.canvas;
let gdrag = null;
function graphT(p) { const f = lastFrame(); if (!f) return null; const r = f.rect; if (p.x < r.x - 4 || p.x > r.x + r.w + 4 || p.y < r.y - 4 || p.y > r.y + r.h + 4) return null; return clamp(((p.x - r.x) / r.w) * f.tMax, 0, f.tMax); }
function nodeAt(p) {
  if (ui.mode !== "pw" || ui.tab !== "v") return -1;
  const f = lastFrame(); if (!f) return -1;
  const vals = pw[pw.shape];
  for (let i = 0; i < vals.length; i++) { const t = pw.shape === "lin" ? i * DT : i * DT + DT / 2; if (Math.hypot(p.x - f.X(t), p.y - f.Y(vals[i])) <= 14) return i; }
  return -1;
}
gcv.addEventListener("pointerdown", (e) => {
  const p = ptr(gcv, e), n = nodeAt(p);
  try { gcv.setPointerCapture(e.pointerId); } catch { /* */ }
  if (n >= 0) { gdrag = { node: n }; e.preventDefault(); return; }
  const t = graphT(p); if (t === null) return;
  gdrag = { seek: true }; loop.stop(); sim.t = Math.min(t, sim.T); setPlayUI(false);
});
gcv.addEventListener("pointermove", (e) => {
  const p = ptr(gcv, e);
  if (gdrag?.node !== undefined) {
    const f = lastFrame(), r = f.rect, v = f.yMax - ((p.y - r.y) / r.h) * (f.yMax - f.yMin);
    pw[pw.shape][gdrag.node] = clamp(Math.round(v * 2) / 2, -15, 20); changed(); return;
  }
  const t = graphT(p); ui.hover = t;
  if (gdrag?.seek && t !== null) { sim.t = Math.min(t, sim.T); refresh(); return; }
  gcv.style.cursor = nodeAt(p) >= 0 ? "ns-resize" : t !== null ? "crosshair" : "";
  graph.render();
});
gcv.addEventListener("pointerleave", () => { if (!gdrag) { ui.hover = null; graph.render(); } });
const gEnd = () => { gdrag = null; };
gcv.addEventListener("pointerup", gEnd);
gcv.addEventListener("pointercancel", gEnd);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  uniform: { mode: "uni", title: "Tekis harakat", lesson: "Avtomobil 5 m/s tezlik bilan tekis harakatlanadi. Boshlang va har 1 s dagi nuqtalar oralig‘i bir xil ekanini, x(t) grafigi to‘g‘ri chiziq ekanini kuzating.", set: () => Object.assign(A, { x0: 10, v0: 5 }) },
  back: { mode: "uni", title: "Orqaga harakat (v < 0)", lesson: "Avtomobil x o‘qiga qarshi 8 m/s tezlik bilan yuradi: koordinata kamayadi, x(t) pastga og‘adi, v(t) o‘qdan pastda. Yo‘l esa musbat.", set: () => Object.assign(A, { x0: 140, v0: -8 }) },
  meet: { mode: "uni", title: "Qarama-qarshi harakat: uchrashish", lesson: "Avtomobil 0 m dan +10 m/s, velosipedchi 120 m dan −5 m/s tezlik bilan yuradi. Ular qachon va qayerda uchrashadi? Grafiklar kesishgan nuqtani toping: 120/(10 + 5) = 8 s.", set: () => { Object.assign(A, { x0: 0, v0: 10 }); Object.assign(B, { on: true, x0: 120, v0: -5 }); } },
  chase: { mode: "uni", title: "Quvib yetish", lesson: "Velosipedchi 40 m oldinda, 6 m/s tezlikda. Avtomobil 12 m/s bilan quvadi: yaqinlashish tezligi 6 m/s, quvib yetish vaqti 40/6 ≈ 6,7 s.", set: () => { Object.assign(A, { x0: 0, v0: 12 }); Object.assign(B, { on: true, x0: 40, v0: 6 }); } },
  start: { mode: "acc", title: "Joyidan tezlanish", lesson: "Avtomobil tinch holatdan 2 m/s² tezlanish bilan harakatlana boshlaydi. Nuqtalar oralig‘i 1, 3, 5, 7… m kabi ortadi; x(t) — parabola, v(t) — og‘ma chiziq.", set: () => Object.assign(A, { x0: 0, v0: 0, a: 2 }) },
  brake: { mode: "acc", title: "Tormozlash", lesson: "54 km/soat (15 m/s) tezlikdagi avtomobil −3 m/s² tezlanish bilan tormozlanadi va 5 s da to‘xtaydi. To‘xtash yo‘li v₀²/(2|a|) = 37,5 m — v(t) ostidagi uchburchak yuzasi.", set: () => Object.assign(A, { x0: 0, v0: 15, a: -3 }) },
  overtake: { mode: "acc", title: "Tekis va tezlanuvchan", lesson: "Avtomobil 8 m/s bilan tekis yuradi, velosipedchi joyidan 2 m/s² tezlanish bilan. Avval avtomobil oldinda, keyin velosipedchi quvib yetadi (t = 8 s). Shu paytda kimning tezligi katta?", set: () => { Object.assign(A, { x0: 0, v0: 8, a: 0 }); Object.assign(B, { on: true, x0: 0, v0: 0, a: 2 }); } },
  returnM: { mode: "acc", title: "Qaytuvchi harakat", lesson: "Jism +15 m/s bilan boshlaydi, tezlanish −3 m/s². Tormoz o‘chirilgan: 5 s da to‘xtab, orqaga qaytadi va 10 s da joyiga keladi. Ko‘chish 0, yo‘l esa 75 m.", set: () => { Object.assign(A, { x0: 20, v0: 15, a: -3 }); sim.stop = false; } },
  city: { mode: "pw", title: "Shahar: tezlanish–tekis–tormoz", lesson: "Avtomobil 2 s tezlanadi, 6 s 10 m/s bilan tekis yuradi, 2 s tormozlanadi. v(t) ostidagi trapetsiya yuzasi = 80 m — bosib o‘tilgan yo‘l.", set: () => { pw.shape = "lin"; pw.lin = [0, 10, 10, 10, 10, 0]; pw.x0 = 0; } },
  average: { mode: "pw", title: "O‘rtacha tezlik masalasi", lesson: "6 s davomida 12 m/s, keyin 4 s davomida 4 m/s. O‘rtacha tezlik (12 + 4)/2 = 8 emas, balki umumiy yo‘l / umumiy vaqt = 88/10 = 8,8 m/s.", set: () => { pw.shape = "step"; pw.step = [12, 12, 12, 4, 4]; pw.x0 = 0; } },
  round: { mode: "pw", title: "Borib-qaytish", lesson: "Avtomobil 4 s olg‘a (10 m/s), 2 s turadi, 4 s orqaga qaytadi. Ko‘chish nol, yo‘l 80 m: o‘rtacha tezlik 8 m/s, o‘rtacha ko‘chish tezligi 0.", set: () => { pw.shape = "step"; pw.step = [10, 10, 0, -10, -10]; pw.x0 = 40; } },
};
const GROUPS = [["Tekis harakat", ["uniform", "back", "meet", "chase"]], ["Notekis harakat", ["start", "brake", "overtake", "returnM"]], ["Grafikdan harakat", ["city", "average", "round"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { uni: "Avtomobilni va tezlik o‘qi uchini suring", acc: "Avtomobil, tezlik (ko‘k) va tezlanish (to‘q sariq) o‘qlarini suring", pw: "v(t) grafigidagi nuqtalarni suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
}
function syncAll() {
  aXC.set(A.x0); aVC.set(A.v0); aAC.set(A.a); bXC.set(B.x0); bVC.set(B.v0); bAC.set(B.a); pXC.set(pw.x0);
  bOn.checked = B.on; stopCb.checked = sim.stop; syncB(); syncShape();
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_DEFAULT = { uni: "uniform", acc: "start", pw: "city" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  loop.stop(); drag = null; gdrag = null;
  ui.mode = p.mode; B.on = false; B.a = 0; sim.stop = true; A.a = 0;
  p.set();
  dirMemo.A = 1; dirMemo.B = -1;
  sim.t = 0; build(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(ui.mode === "pw" ? "v" : "x");
  setPlayUI(false);
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "uniform");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
