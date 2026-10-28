// ==========================================================================
// Yorug'lik oqimi, kuchi, yoritilganlik (simulations/photometry.html)
// 1) Fotometrik kattaliklar: nuqtaviy manba (I, cd), undan r masofada α burchak ostida turgan S yuzli sirt.
//    Sirtga tushgan oqim Φ = IΩ, yoritilganlik E = Φ/S = I cos α/r². Sirt sahnada suriladi va buriladi.
//    Grafik E(r).
// 2) Laboratoriya ishi «Yoritilganlik»: optik skamya, lampa, lyuksmetr fotoelementi (aravachada, buriladi).
//    Fon (xona yorug'ligi) lampasiz o'lchanadi. Jadval: r, α, E, E − E_fon, I. Grafik E − E_fon (cos α/r²) —
//    qiyaligi lampa yorug'lik kuchi I.
// Fizika: photometry-physics.js (Node'da tekshirilgan: t_photometry.mjs).
// ==========================================================================

import { clamp, fmt, createStage, tag, arrow, angleArc, bindRange } from "./sim-kit.js";
import { chipBtn, lcd, noise } from "./labkit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./photometry-physics.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const FON = 14; // xonaning (haqiqiy) fon yoritilganligi, lx

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "concept", hover: null };
const cp = { I: 56.5, r: 1, a: 0, S: 0.04 };
const lb = { lamp: "inc60", on: true, r: 0.5, a: 0, rows: [], fon: null };
let presetId = null;
const geo = {};
const lampI = () => P.intensity(P.LAMPS[lb.lamp]);
const reading = () => P.luxmeter(lb.on ? P.illuminance(lampI(), lb.r, lb.a * DEG) : 0, FON, noise(Math.round(lb.r * 1000) + lb.a * 7, lb.on ? 1 : 2) * 1.6);

/* ------------------------------------------------------------------ 1. Kattaliklar */

function bulb(ctx, c, x, y, s, on, glow) {
  if (on) { const g = ctx.createRadialGradient(x, y, 2, x, y, 60 * s * (0.6 + glow)); g.addColorStop(0, "rgba(253,224,71,0.75)"); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 60 * s * (0.6 + glow), 0, TAU); ctx.fill(); }
  ctx.fillStyle = on ? "#fef9c3" : c.dark ? "#475569" : "#e2e8f0"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, 13 * s, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.fillRect(x - 6 * s, y - 24 * s, 12 * s, 11 * s);
  ctx.strokeStyle = on ? "#f59e0b" : c.text3; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 12 * s); ctx.lineTo(x - 3 * s, y); ctx.lineTo(x + 3 * s, y); ctx.lineTo(x + 4 * s, y - 12 * s); ctx.stroke();
}
function drawConcept(ctx, c, w, h) {
  const narrow = w < 560, lx = narrow ? 34 : 70, cy = h * 0.5, k = (w - lx - (narrow ? 40 : 90)) / 2.1;
  const E = P.illuminance(cp.I, cp.r, cp.a * DEG), sx = lx + cp.r * k, hl = Math.sqrt(cp.S) * k * 0.9 + 10;
  const a = cp.a * DEG, tdx = -Math.sin(a), tdy = Math.cos(a), nx = -Math.cos(a), ny = -Math.sin(a);
  const p1 = [sx + tdx * hl, cy + tdy * hl], p2 = [sx - tdx * hl, cy - tdy * hl];
  // nurlar va sfera
  ctx.strokeStyle = c.dark ? "rgba(253,224,71,0.18)" : "rgba(202,138,4,0.2)"; ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) { const t = (i / 24) * TAU; ctx.beginPath(); ctx.moveTo(lx + Math.cos(t) * 18, cy + Math.sin(t) * 18); ctx.lineTo(lx + Math.cos(t) * 2000, cy + Math.sin(t) * 2000); ctx.stroke(); }
  ctx.strokeStyle = c.grid; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(lx, cy, cp.r * k, -1.2, 1.2); ctx.stroke(); ctx.setLineDash([]);
  if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("4πr² sfera", lx + Math.cos(-1.1) * cp.r * k + 4, cy + Math.sin(-1.1) * cp.r * k); }
  // konus (sirtga tushgan oqim)
  const al = clamp(0.1 + 0.5 * Math.log10(1 + E) / 3, 0.1, 0.6);
  ctx.fillStyle = `rgba(253,224,71,${al})`; ctx.beginPath(); ctx.moveTo(lx, cy); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill();
  bulb(ctx, c, lx, cy, 1, true, clamp(cp.I / 200, 0, 1));
  // sirt
  const lit = clamp(Math.log10(1 + E) / 3.3, 0, 1);
  ctx.strokeStyle = `rgb(${Math.round(100 + 155 * lit)},${Math.round(116 + 120 * lit)},${Math.round(139 - 60 * lit)})`; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p2[0], p2[1], 7, 0, TAU); ctx.fill(); ctx.stroke();
  geo.rot = { x: p2[0], y: p2[1], sx, cy };
  geo.patch = { x: sx, y: cy, lx, k };
  // normal va burchak
  arrow(ctx, sx, cy, nx * 46, ny * 46, c.success, { width: 2, head: 7, label: "n" });
  if (cp.a > 1) angleArc(ctx, sx, cy, 30, Math.PI + a, Math.PI, c.danger, { label: "α" });
  ctx.strokeStyle = c.danger; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx - 40, cy); ctx.stroke(); ctx.setLineDash([]);
  // masofa
  const my = cy + Math.max(hl, 30) + 26; ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, my - 5); ctx.lineTo(lx, my + 5); ctx.moveTo(lx, my); ctx.lineTo(sx, my); ctx.moveTo(sx, my - 5); ctx.lineTo(sx, my + 5); ctx.stroke();
  tag(ctx, `r = ${fmt(cp.r, 2)} m`, (lx + sx) / 2, my + 12, { color: c.text, bg: c.bg2, font: MID, align: "center" });
  // ma'lumot
  const ix = narrow ? 8 : 14;
  tag(ctx, `I = ${fmt(cp.I, 1)} cd,  Φ₀ = 4πI = ${fmt(4 * Math.PI * cp.I, 0)} lm`, ix, 20, { color: c.text, bg: c.bg2, font: narrow ? SMALL : MID });
  tag(ctx, `E = I cos α / r² = ${fmt(E, E < 100 ? 1 : 0)} lx`, ix, 46, { color: "#fff", bg: c.primary, font: BOLD });
  tag(ctx, `sirtga: Φ = ES = ${fmt(E * cp.S, 2)} lm`, ix, 72, { color: c.text2, bg: c.bg2, font: SMALL });
}

/* ------------------------------------------------------------------ 2. Laboratoriya */

function drawLab(ctx, c, w, h) {
  const narrow = w < 560, on = lb.on, L = P.LAMPS[lb.lamp];
  // xona: lampa yonganda yorug'roq
  if (on) { const g = ctx.createRadialGradient(narrow ? 40 : 80, h * 0.4, 10, narrow ? 40 : 80, h * 0.4, w * 0.9); g.addColorStop(0, c.dark ? "rgba(253,224,71,0.16)" : "rgba(253,224,71,0.22)"); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  const bx0 = narrow ? 34 : 80, bx1 = w - (narrow ? 20 : 40), ry = narrow ? h * 0.48 : h * 0.56, k = (bx1 - bx0) / 1.5, ly = ry - (narrow ? 64 : 84);
  const X = (r) => bx0 + r * k;
  // skamya va chizg'ich
  ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.fillRect(bx0 - 16, ry, bx1 - bx0 + 32, 10);
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(bx0 - 22, ry + 10, 10, 30); ctx.fillRect(bx1 + 12, ry + 10, 10, 30);
  ctx.fillStyle = c.dark ? "#fef3c7" : "#fefce8"; ctx.fillRect(bx0, ry - 16, bx1 - bx0, 16); ctx.strokeStyle = c.dark ? "#a16207" : "#ca8a04"; ctx.lineWidth = 1; ctx.strokeRect(bx0, ry - 16, bx1 - bx0, 16);
  ctx.strokeStyle = "#78350f"; ctx.fillStyle = "#78350f"; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let cm = 0; cm <= 150; cm++) { const x = X(cm / 100), big = cm % 10 === 0, mid = cm % 5 === 0; if (!big && !mid && k < 300) continue; ctx.beginPath(); ctx.moveTo(x + 0.5, ry - 16); ctx.lineTo(x + 0.5, ry - 16 + (big ? 8 : mid ? 5 : 3)); ctx.stroke(); if (big && (cm % (narrow ? 30 : 10) === 0)) ctx.fillText(String(cm), x, ry - 8); }
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText("sm", bx1, ry + 14);
  // lampa (r = 0 da)
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(X(0) - 3, ly + 14, 6, ry - 16 - ly - 14); ctx.fillRect(X(0) - 14, ry - 20, 28, 5);
  bulb(ctx, c, X(0), ly, narrow ? 1 : 1.25, on, clamp(lampI() / 110, 0.3, 1));
  // aravacha va fotoelement
  const sx = X(lb.r), a = lb.a * DEG, R = narrow ? 18 : 24;
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(sx - 14, ry - 22, 28, 8); ctx.fillRect(sx - 2.5, ly, 5, ry - 22 - ly);
  ctx.fillStyle = c.danger; ctx.beginPath(); ctx.moveTo(sx, ry - 16); ctx.lineTo(sx - 5, ry - 24); ctx.lineTo(sx + 5, ry - 24); ctx.fill();
  ctx.save(); ctx.translate(sx, ly); ctx.rotate(a);
  ctx.fillStyle = "#1e293b"; ctx.fillRect(0, -R - 3, 9, 2 * R + 6);
  const gl = on ? clamp(Math.log10(1 + reading()) / 3.3, 0.1, 1) : 0.05;
  ctx.fillStyle = `rgba(${Math.round(60 + 180 * gl)},${Math.round(80 + 150 * gl)},${Math.round(120 + 40 * gl)},1)`; ctx.fillRect(-3, -R, 4, 2 * R);
  ctx.restore();
  // normal va nur yo'nalishi
  if (lb.a > 0) { ctx.strokeStyle = c.success; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(sx, ly); ctx.lineTo(sx - Math.cos(a) * 46, ly - Math.sin(a) * 46); ctx.stroke(); ctx.setLineDash([]); angleArc(ctx, sx, ly, 30, Math.PI, Math.PI + a, c.danger, { label: "α" }); }
  if (on) { ctx.strokeStyle = "rgba(234,179,8,0.45)"; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(X(0) + 16, ly); ctx.lineTo(sx - 6, ly); ctx.stroke(); ctx.setLineDash([]); }
  geo.cart = { x: sx, y: (ly + ry) / 2, top: ly - R, bot: ry, X0: bx0, k };
  geo.sensor = { x: sx, y: ly };
  // lyuksmetr
  const mw = narrow ? 128 : 150, mh = narrow ? 62 : 70, my = narrow ? h - mh - 12 : h - mh - 18;
  const mxx = narrow ? w - mw - 12 : w - mw - 20;
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(mxx - 6, my - 20, mw + 12, mh + 26, 10); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("LYUKSMETR", mxx, my - 16);
  lcd(ctx, mxx, my, mw, mh, "yoritilganlik", String(reading()), "lx");
  ctx.strokeStyle = c.dark ? "#94a3b8" : "#334155"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx + 6, ly + R); ctx.bezierCurveTo(sx + 30, ry + 40, mxx - 40, my + 30, mxx - 6, my + mh / 2); ctx.stroke();
  // tugmalar va ma'lumot
  const bxx = narrow ? 8 : 14;
  geo.lampBtn = chipBtn(ctx, c, bxx, 10, on ? "Lampa yoqilgan" : "Lampa o‘chirilgan", on, 124, 26, "#ca8a04");
  geo.rec = chipBtn(ctx, c, bxx + 130, 10, on ? "Yozish" : "Fonni yozish", false, narrow ? 90 : 96, 26, c.success);
  if (!narrow) tag(ctx, `${L.name}`, w - 14, 22, { color: c.text2, bg: c.bg2, font: SMALL, align: "right" });
  tag(ctx, `r = ${fmt(lb.r * 100, 1)} sm, α = ${fmt(lb.a, 0)}°`, bxx, narrow ? 52 : 56, { color: c.text, bg: c.bg2, font: MID });
  if (!narrow) tag(ctx, "aravachani skamya bo‘ylab suring", bx0, ry + 50, { color: c.text3, bg: c.bg2, font: SMALL });
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, st) { const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h); if (ui.mode === "concept") drawConcept(ctx, c, st.w, st.h); else drawLab(ctx, c, st.w, st.h); }
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.48, 360, 420)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
let gLast = null;
const niceMax = (v) => { const e = 10 ** Math.floor(Math.log10(v)), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; };
function drawGraph(ctx, gs) {
  const c = gs.colors;
  if (ui.mode === "concept") {
    const yMax = niceMax(cp.I / 0.3 ** 2), xMin = 0.3, xMax = 2;
    const f = frame(ctx, gs, { xMin, xMax, yMin: 0, yMax, xTicks: [0.5, 1, 1.5, 2], yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), yLabel: "E, lx", xUnit: "r, m" });
    gLast = { ...f, xMin, xMax };
    const r = f.rect; ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    const curve = (al, col, wdt, dash) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.setLineDash(dash || []); ctx.beginPath(); for (let i = 0; i <= 200; i++) { const rr = xMin + ((xMax - xMin) * i) / 200, x = f.X(rr), y = f.Y(P.illuminance(cp.I, rr, al)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); ctx.setLineDash([]); };
    if (cp.a > 0) curve(0, c.text3, 1.5, [6, 4]);
    curve(cp.a * DEG, c.primary, 2.6);
    ctx.restore();
    const E = P.illuminance(cp.I, cp.r, cp.a * DEG); if (cp.r >= xMin) { ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(cp.r), f.Y(Math.min(E, yMax)), 6, 0, TAU); ctx.fill(); }
    legend(ctx, [{ color: c.primary, label: `E = I cos α / r² (α = ${fmt(cp.a, 0)}°)` }, ...(cp.a > 0 ? [{ color: c.text3, label: "α = 0°", dash: [6, 4] }] : [])], f.padL + 10, r.y + 12, c);
    if (ui.hover != null) { const rr = clamp(ui.hover, xMin, xMax); tag(ctx, `r = ${fmt(rr, 2)} m: E = ${fmt(P.illuminance(cp.I, rr, cp.a * DEG), 0)} lx`, f.X(rr) + 8, r.y + 40, { color: c.text, bg: c.bg2, font: MID, align: f.X(rr) > r.x + r.w - 180 ? "right" : "left" }); }
    return;
  }
  const fon = lb.fon ?? 0, pts = lb.rows.filter((q) => !q.fonRow).map((q) => [Math.cos(q.a * DEG) / (q.r * q.r), q.E - fon]);
  const xMax = niceMax(Math.max(4, ...pts.map((p) => p[0] * 1.1))), yMax = niceMax(Math.max(100, ...pts.map((p) => p[1] * 1.15)));
  const f = frame(ctx, gs, { xMin: 0, xMax, yMin: 0, yMax, xTicks: ticks(0, xMax, gs.w < 480 ? 4 : 6).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "E − E_fon, lx", xUnit: "cos α / r², 1/m²" });
  gLast = { ...f, xMin: 0, xMax };
  const s = P.slope0(pts);
  if (pts.length && isFinite(s)) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(s * xMax)); ctx.stroke(); ctx.setLineDash([]); }
  for (const [x, y] of pts) { ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), 5, 0, TAU); ctx.fill(); }
  if (!pts.length) { ctx.font = MID; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("O‘lchashlarni «Yozish» bilan jadvalga qo‘shing", f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2); }
  else legend(ctx, [{ color: c.warning, label: "o‘lchashlar" }, { color: c.primary, label: `qiyalik: I = ${fmt(s, 1)} cd`, dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
}
const graph = createStage($("#graph"), drawGraph, { height: () => heights().graph });
const TABS = {
  concept: ["Yoritilganlikning masofaga bog‘liqligi E(r)", "Manbadan uzoqlashgan sari yorug‘lik oqimi kattaroq sfera yuziga (4πr²) taqsimlanadi, shuning uchun yoritilganlik masofa kvadratiga teskari proporsional kamayadi. Sirt qiya tursa, unga kamroq nur tushadi — E cos α marta kichik bo‘ladi (uzuq chiziq — tik tushish)."],
  lab: ["Yoritilganlik va cos α / r²", "Fon ayirilgan yoritilganlik cos α / r² ga to‘g‘ri proporsional: nuqtalar koordinata boshidan o‘tuvchi to‘g‘ri chiziqda yotadi. Uning qiyaligi — lampaning yorug‘lik kuchi I."],
};
function setTab() { const t = TABS[ui.mode]; ui.hover = null; $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); $("[data-lab-card]").hidden = ui.mode !== "lab"; graph.render(); }

/* ------------------------------------------------------------------ Jadval */

const grid = $("[data-lab-grid]");
function renderTable() {
  const head = "<thead><tr><th>№</th><th>Lampa</th><th>r, m</th><th>α, °</th><th>E, lx</th><th>E − E<sub>fon</sub>, lx</th><th>I = (E − E<sub>fon</sub>)r²/cos α, cd</th></tr></thead>";
  const fon = lb.fon;
  const body = lb.rows.length ? lb.rows.map((q, i) => q.fonRow ? `<tr><td>${i + 1}</td><td>o‘chiq</td><td>—</td><td>—</td><td>${q.E}</td><td colspan="2">fon: E<sub>fon</sub> = ${q.E} lx</td></tr>` : `<tr><td>${i + 1}</td><td>${P.LAMPS[q.lamp].name.replace("Cho‘g‘lanma lampa", "cho‘g‘l.").replace("LED lampa", "LED")}</td><td>${fmt(q.r, 2)}</td><td>${q.a}</td><td>${q.E}</td><td>${fon != null ? q.E - fon : "—"}</td><td><b>${fmt(((q.E - (fon ?? 0)) * q.r * q.r) / Math.cos(q.a * DEG), 1)}</b></td></tr>`).join("") : `<tr><td colspan="7">Hali o‘lchash yo‘q</td></tr>`;
  grid.innerHTML = head + `<tbody>${body}</tbody>`;
}
function record() {
  if (!lb.on) { lb.fon = reading(); lb.rows.push({ fonRow: true, E: lb.fon }); }
  else lb.rows.push({ lamp: lb.lamp, r: Math.round(lb.r * 1000) / 1000, a: lb.a, E: reading() });
  if (lb.rows.length > 14) lb.rows.shift();
  renderTable();
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const norm = (E) => { let n = "juda xira"; for (const [v, name] of P.NORMS) if (E >= v) n = name; return n; };
function updateReadouts() {
  if (ui.mode === "concept") {
    const E = P.illuminance(cp.I, cp.r, cp.a * DEG), Om = P.solidAngle(cp.r, cp.a * DEG, cp.S);
    setRO("r1", "Yorug‘lik kuchi <i>I</i>", u(fmt(cp.I, 1), "cd"), "kandela — SI asosiy birligi", "orange");
    setRO("r2", "To‘liq yorug‘lik oqimi <i>Φ₀</i>", u(fmt(4 * Math.PI * cp.I, 0), "lm"), "Φ₀ = 4πI");
    setRO("r3", "Fazoviy burchak <i>Ω</i>", u(fmt(Om, 4), "sr"), "Ω = S cos α / r²");
    setRO("r4", "Sirtga tushgan oqim <i>Φ</i>", u(fmt(cp.I * Om, 2), "lm"), "Φ = IΩ");
    setRO("r5", "Yoritilganlik <i>E</i>", u(fmt(E, E < 100 ? 1 : 0), "lx"), "E = Φ/S = I cos α / r²", "green");
    setRO("r6", "Taqqoslash", norm(E), `S = ${fmt(cp.S * 1e4, 0)} sm² — E sirt yuziga bog‘liq emas`);
    return;
  }
  const E = reading(), fon = lb.fon, s = P.slope0(lb.rows.filter((q) => !q.fonRow).map((q) => [Math.cos(q.a * DEG) / (q.r * q.r), q.E - (fon ?? 0)]));
  setRO("r1", "Masofa <i>r</i>", u(fmt(lb.r, 3), "m"), "fotoelementdan lampa tolasigacha", "orange");
  setRO("r2", "Fotoelement burchagi <i>α</i>", u(fmt(lb.a, 0), "°"), `cos α = ${fmt(Math.cos(lb.a * DEG), 3)}`);
  setRO("r3", "Lyuksmetr", u(String(E), "lx"), lb.on ? norm(E) : "lampa o‘chiq — xona yorug‘ligi", "green");
  setRO("r4", "Fon yoritilganligi <i>E<sub>fon</sub></i>", fon != null ? u(String(fon), "lx") : "—", fon != null ? "lampa o‘chirilib o‘lchangan" : "lampani o‘chirib, «Fonni yozish»");
  setRO("r5", "Yorug‘lik kuchi (shu o‘lchashdan)", lb.on ? u(fmt(((E - (fon ?? 0)) * lb.r * lb.r) / Math.cos(lb.a * DEG), 1), "cd") : "—", "I = (E − E_fon) r² / cos α");
  setRO("r6", "Grafik bo‘yicha <i>I</i>", isFinite(s) ? u(fmt(s, 1), "cd") : "—", isFinite(s) ? `→ Φ₀ = 4πI ≈ ${fmt(4 * Math.PI * s, 0)} lm (pasportda ${P.LAMPS[lb.lamp].flux} lm)` : "jadvalga kamida bitta o‘lchash yozing");
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "green";
  if (ui.mode === "concept") t = `E = ${fmt(P.illuminance(cp.I, cp.r, cp.a * DEG), 0)} lx`;
  else { t = lb.on ? `${reading()} lx` : "lampa o‘chiq"; tone = lb.on ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "concept") {
    p.push("<p><b>Yorug‘lik oqimi</b> Φ — manbadan vaqt birligida chiqayotgan yorug‘lik energiyasi (ko‘zning sezgirligi hisobga olinib), lyumen (lm)da o‘lchanadi. <b>Yorug‘lik kuchi</b> I — bir steradian fazoviy burchakka to‘g‘ri keladigan oqim: I = Φ/Ω, kandela (cd). Har tomonga bir xil nurlanadigan manbaning to‘liq oqimi Φ₀ = 4πI.</p>");
    p.push("<p><b>Yoritilganlik</b> E — sirtning yuz birligiga tushadigan oqim: E = Φ/S, lyuks (lx = lm/m²). Nuqtaviy manba uchun E = I cos α / r²: masofa 2 marta ortsa, yoritilganlik 4 marta kamayadi. Sirtni nurga nisbatan qiyalatsak, unga kamroq nur tushadi.</p>");
  } else {
    p.push("<p>Lampa optik skamyaning nol belgisida, lyuksmetrning fotoelementi aravachada. Aravachani surib, turli masofalarda yoritilganlikni o‘lchang. Xonada boshqa yorug‘lik ham bor, shuning uchun avval lampani o‘chirib <b>fon</b> yoritilganligini yozing va uni har bir o‘lchashdan ayiring.</p>");
    p.push("<p>Har bir o‘lchashdan lampaning yorug‘lik kuchi I = (E − E_fon) r²/cos α ni hisoblang. Natijalar deyarli bir xil chiqsa, yoritilganlik qonuni tasdiqlanadi. Fotoelementni burib, kosinus qonunini ham tekshiring.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() { const html = "<small>Yoritilganlik</small> E = I cos α / r²"; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Qayta */

$("[data-reset]").addEventListener("click", () => { if (ui.mode === "lab") { lb.rows = []; lb.fon = null; renderTable(); } else Object.assign(cp, { r: 1, a: 0 }); syncSliders(); customized(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const iC = bindRange($("#cI"), $("#cIOut"), (v) => `${fmt(v, 1)} cd`, (v) => { cp.I = v; customized(); refresh(); });
const rCc = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v, 2)} m`, (v) => { cp.r = v; customized(); refresh(); });
const aCc = bindRange($("#cA"), $("#cAOut"), (v) => `${fmt(v, 0)}°`, (v) => { cp.a = v; customized(); refresh(); });
const sC = bindRange($("#cS"), $("#cSOut"), (v) => `${fmt(v, 0)} sm²`, (v) => { cp.S = v / 1e4; customized(); refresh(); });
const rL = bindRange($("#lR"), $("#lROut"), (v) => `${fmt(v, 1)} sm`, (v) => { lb.r = v / 100; customized(); refresh(); });
const aL = bindRange($("#lA"), $("#lAOut"), (v) => `${fmt(v, 0)}°`, (v) => { lb.a = v; customized(); refresh(); });
function syncSliders() { iC.set(cp.I); rCc.set(cp.r); aCc.set(cp.a); sC.set(cp.S * 1e4); rL.set(lb.r * 100); aL.set(lb.a); }
function setLamp(k) { lb.lamp = k; document.querySelectorAll("[data-lamp-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lampValue === k))); }
document.querySelectorAll("[data-lamp-value]").forEach((b) => b.addEventListener("click", () => { setLamp(b.dataset.lampValue); customized(); refresh(); }));

const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode === "concept") { const g = geo.rot; if (g && Math.hypot(p.x - g.x, p.y - g.y) < 14) return "rot"; const q = geo.patch; if (q && Math.abs(p.x - q.x) < 22 && Math.abs(p.y - q.y) < 70) return "patch"; return null; }
  if (inBox(p, geo.lampBtn)) return "lamp"; if (inBox(p, geo.rec)) return "rec";
  const s = geo.sensor; if (s && Math.hypot(p.x - s.x, p.y - s.y) < 30) return "tilt";
  const g = geo.cart; if (g && Math.abs(p.x - g.x) < 20 && p.y > g.top && p.y < g.bot + 6) return "cart";
  return null;
}
function applyDrag(h, p) {
  if (h === "patch") { const q = geo.patch; cp.r = clamp(Math.round(((p.x - q.lx) / q.k) * 100) / 100, 0.2, 2); rCc.set(cp.r); }
  else if (h === "rot") { const g = geo.rot; cp.a = clamp(Math.round(Math.atan2(p.x - g.sx, g.cy - p.y) / DEG), 0, 85); aCc.set(cp.a); }
  else if (h === "cart") { const g = geo.cart; lb.r = clamp(Math.round(((p.x - g.X0) / g.k) * 1000) / 1000, 0.2, 1.5); rL.set(lb.r * 100); }
  else if (h === "tilt") { const s = geo.sensor; lb.a = clamp(Math.round(Math.abs(Math.atan2(p.y - s.y, 40)) / DEG / 5) * 5, 0, 80); aL.set(lb.a); }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return; e.preventDefault(); customized();
  if (h === "lamp") { lb.on = !lb.on; refresh(); return; }
  if (h === "rec") { record(); refresh(); return; }
  drag = h; applyDrag(h, p); try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true"; refresh();
});
canvas.addEventListener("pointermove", (e) => { const p = ptr(canvas, e); if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h === "patch" || h === "cart" ? "ew-resize" : h === "rot" || h === "tilt" ? "grab" : "pointer"; return; } applyDrag(drag, p); refresh(); });
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = gLast; if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const CP = (title, lesson, o) => ({ mode: "concept", title, lesson, set: () => Object.assign(cp, { I: 56.5, r: 1, a: 0, S: 0.04 }, o) });
const LB = (title, lesson, lamp, o = {}) => ({ mode: "lab", title, lesson, set: () => {
  setLamp(lamp); lb.rows = []; lb.fon = null; lb.a = 0;
  if (o.fon) { lb.on = false; record(); }
  for (const [r, a] of o.series || []) { lb.on = true; lb.r = r; lb.a = a; record(); }
  lb.on = o.on ?? true; lb.r = o.r ?? 0.5; lb.a = o.a ?? 0; renderTable();
} });
const PRESETS = {
  cBase: CP("60 W lampa, 1 m", "60 W li cho‘g‘lanma lampa (Φ₀ ≈ 710 lm, I ≈ 56 cd) 1 m masofadagi sirtni ≈ 56 lx bilan yoritadi — o‘qish uchun juda kam.", {}),
  cFar: CP("Masofa 2 marta", "Sirtni 2 m ga uzoqlashtirdik: unga tushadigan nurlar konusi 4 marta kichraydi, yoritilganlik 56 lx dan 14 lx gacha — 4 marta kamaydi.", { r: 2 }),
  cTilt: CP("Qiya sirt (α = 60°)", "Sirt normali nur bilan 60° burchak hosil qiladi: unga tushayotgan nurlar konusi ikki marta tor, E = I cos 60°/r² ≈ 28 lx.", { a: 60 }),
  cArea: CP("Katta sirt", "Sirt yuzi 2,5 marta kattalashdi: unga tushadigan oqim ham 2,5 marta ortdi, yoritilganlik esa o‘zgarmadi — E sirt yuziga bog‘liq emas.", { S: 0.1 }),
  cDesk: CP("Stol lampasi", "Lampani kitobdan 45 sm balandlikka qo‘ysak, E ≈ 280 lx — o‘qish uchun me’yorga (300 lx) yaqin.", { r: 0.45 }),
  lStart: LB("Ishni boshlash", "Lampa yoqilgan, fotoelement 50 sm da. Avval lampani o‘chirib fonni yozing, so‘ng aravachani 30–120 sm oralig‘ida surib, har bir holatda «Yozish» ni bosing.", "inc60"),
  lSeries: LB("Masofalar seriyasi", "Fon (lampa o‘chiq) va 30–120 sm dagi 6 ta o‘lchash yozildi. Har bir qatordagi I deyarli bir xil — yoritilganlik r² ga teskari proporsional.", "inc60", { fon: true, series: [[0.3, 0], [0.4, 0], [0.5, 0], [0.6, 0], [0.8, 0], [1.0, 0]], r: 1 }),
  lAngle: LB("Kosinus qonuni", "Fotoelement 40 sm da turibdi va 0°, 30°, 45°, 60°, 75° ga burildi. Yoritilganlik cos α ga proporsional kamayadi, hisoblangan I esa o‘zgarmaydi.", "inc60", { fon: true, series: [[0.4, 0], [0.4, 30], [0.4, 45], [0.4, 60], [0.4, 75]], r: 0.4, a: 75 }),
  lLED: LB("LED lampa 9 W", "9 W li LED lampa 60 W li cho‘g‘lanma lampadan ko‘proq yorug‘lik beradi: I ≈ 64 cd. Samaradorligi ≈ 90 lm/W — 7–8 marta tejamkor.", "led9", { fon: true, series: [[0.3, 0], [0.5, 0], [0.7, 0], [1.0, 0]], r: 1 }),
  lFon: LB("Fonni o‘lchash", "Lampa o‘chirilgan: lyuksmetr faqat xona (deraza, boshqa lampalar) yorug‘ligini ko‘rsatadi. «Fonni yozish» ni bosing — bu qiymat keyingi o‘lchashlardan ayiriladi.", "inc60", { on: false }),
};
const GROUPS = [["Fotometrik kattaliklar", ["cBase", "cFar", "cTilt", "cArea", "cDesk"]], ["Laboratoriya ishi", ["lStart", "lFon", "lSeries", "lAngle", "lLED"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { concept: "Sirtni suring va buring", lab: "Aravachani suring, fotoelementni buring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", ui.mode === "concept" ? "Nuqtaviy yorug‘lik manbai va undan r masofadagi sirt" : "Optik skamya, lampa, lyuksmetr fotoelementi va lyuksmetr");
}
const MODE_DEFAULT = { concept: "cBase", lab: "lStart" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id]; drag = null; ui.hover = null; ui.mode = p.mode;
  p.set(); syncSliders();
  setModeUI(); presetId = id; setPresetPressed(id); $("[data-lesson]").textContent = p.lesson;
  setTab(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}
renderTable();
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "cBase");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
