// ==========================================================================
// EM to'lqinlar — grafiklar (simulations/emwaves.html):
// E(t) o'lchov nuqtasida, EM spektr (log shkala), β(α) qaytish/sinish, cos²φ qutblanish,
// qabul qiluvchi kontur rezonans egri chizig'i, modulyatsiyalangan signal. Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, sci, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./emwaves-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
const SMALL = "500 10px Inter, system-ui, sans-serif";
const DEG = Math.PI / 180;
let last = null;
export const lastFrame = () => last;

function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT;
  const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
function curve(ctx, f, n, x0, x1, fn, color, width = 2.5, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = fn(x); if (k) ctx.lineTo(f.X(x), f.Y(y)); else ctx.moveTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}

/** E(t) o'lchov nuqtasida: o: { hist: [{u, e}] (u — davrlarda, e = E/E₀), win, E0, T (s), hover } */
export function drawEt(ctx, st, o) {
  const c = st.colors, x0 = Math.max(0, (o.hist.at(-1)?.u ?? 0) - o.win), x1 = x0 + o.win;
  const xt = ticks(x0, x1, st.w < 480 ? 4 : 6), yt = ticks(-o.E0 * 1.2, o.E0 * 1.2, 4);
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: -o.E0 * 1.25, yMax: o.E0 * 1.25, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), yLabel: "E, V/m", xUnit: "t / T" });
  last = { ...f, xMin: x0, xMax: x1 };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.6; ctx.beginPath();
  o.hist.forEach((p, k) => (k ? ctx.lineTo(f.X(p.u), f.Y(p.e * o.E0)) : ctx.moveTo(f.X(p.u), f.Y(p.e * o.E0)))); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
  o.hist.forEach((p, k) => (k ? ctx.lineTo(f.X(p.u), f.Y(p.e * o.E0)) : ctx.moveTo(f.X(p.u), f.Y(p.e * o.E0)))); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  legend(ctx, [{ color: c.danger, label: "E (V/m)" }, { color: c.primary, label: "c·B (fazada E bilan)", dash: [5, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) {
    const u = x0 + o.hover * (x1 - x0), p = o.hist.reduce((b, q) => (Math.abs(q.u - u) < Math.abs(b.u - u) ? q : b), o.hist[0] || { u, e: 0 }), E = p.e * o.E0;
    hoverLine(ctx, f, f.X(u), [`t = ${fmt(u, 2)}·T = ${sci(u * o.T, 3)} s`, `E = ${fmt(E, 1)} V/m, B = ${sci(E / P.C, 3)} T`], c);
  }
}

/** EM spektr: o: { nu, hover } — log₁₀ν shkala 3…22 */
export function drawSpectrum(ctx, st, o) {
  const { w, h, colors: c } = st, x0 = 20, x1 = w - 20, L = (nu) => x0 + ((Math.log10(nu) - 3) / 19) * (x1 - x0);
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  last = { rect: { x: x0, y: 0, w: x1 - x0, h }, xMin: 3, xMax: 22 };
  const y0 = h * 0.34, bh = h * 0.24;
  P.BANDS.forEach((b, k) => {
    const a = L(Math.max(b.from, 1e3)), z = L(b.to);
    if (b.id === "vis") { const g = ctx.createLinearGradient(a, 0, z, 0); ["#dc2626", "#f97316", "#eab308", "#16a34a", "#2563eb", "#7c3aed"].forEach((col, i) => g.addColorStop(i / 5, col)); ctx.fillStyle = g; }
    else { ctx.fillStyle = b.color; ctx.globalAlpha = c.dark ? 0.55 : 0.35; }
    ctx.fillRect(a, y0, z - a, bh); ctx.globalAlpha = 1;
    ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = k % 2 ? "top" : "bottom";
    const mid = (a + z) / 2, label = w < 560 ? b.name.split(" ")[0].replace("Ko‘rinadigan", "Yorug‘lik") : b.name;
    ctx.fillText(label, clamp(mid, x0 + 30, x1 - 30), k % 2 ? y0 + bh + 6 : y0 - 6);
  });
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textBaseline = "top"; ctx.textAlign = "center";
  for (let e = 4; e <= 22; e += w < 560 ? 4 : 2) { const x = L(10 ** e); ctx.fillRect(x, y0 + bh, 1, 4); ctx.fillText(`10${String(e).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]).join("")}`, x, h - 40); }
  ctx.fillText("ν, Hz", x1 - 10, h - 24);
  ctx.textAlign = "left"; ctx.fillText("λ:  10 km", x0, h - 16); ctx.textAlign = "right"; ctx.fillText("10⁻¹⁴ m", x1, h - 16);
  const x = L(o.nu); ctx.strokeStyle = c.warning; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y0 - 22); ctx.lineTo(x, y0 + bh + 2); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.moveTo(x, y0 - 4); ctx.lineTo(x - 6, y0 - 14); ctx.lineTo(x + 6, y0 - 14); ctx.closePath(); ctx.fill();
  tag(ctx, `ν = ${sci(o.nu, 3)} Hz, λ = ${sci(P.lambdaOf(o.nu), 3)} m`, clamp(x, x0 + 110, x1 - 110), 14, { color: c.text, bg: c.bg2, align: "center", font: FONT });
  if (o.hover !== null && o.hover !== undefined) {
    const nu = 10 ** (3 + o.hover * 19), hx = L(nu);
    ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, y0 - 8); ctx.lineTo(hx, y0 + bh + 8); ctx.stroke(); ctx.setLineDash([]);
    tag(ctx, `${P.bandOf(nu).name}: ν = ${sci(nu, 2)} Hz, λ = ${sci(P.lambdaOf(nu), 2)} m`, clamp(hx, x0 + 140, x1 - 140), h - 62, { color: c.text, bg: c.bg2, align: "center", font: FONT });
  }
}

/** β(α): o: { n, alpha (rad), reflect, hover } */
export function drawAngles(ctx, st, o) {
  const c = st.colors, xt = ticks(0, 90, 6), yt = ticks(0, 90, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 90, yMin: 0, yMax: 90, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => `${fmt(v, 0)}°`, fmtY: (v) => `${fmt(v, 0)}°`, yLabel: o.reflect ? "qaytish burchagi β" : "sinish burchagi β", xUnit: "α" });
  last = { ...f, xMin: 0, xMax: 90 };
  const r = f.rect, fn = (a) => (o.reflect ? a : (P.refractAngle(1, o.n, a * DEG) ?? 0) / DEG);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  curve(ctx, f, 1, 0, 90, (a) => a, c.text3, 1.4, [5, 5]);
  curve(ctx, f, 120, 0, 90, fn, c.primary, 2.8);
  ctx.restore();
  const a = o.alpha / DEG; ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(a), f.Y(fn(a)), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, o.reflect ? [{ color: c.primary, label: "β = α" }] : [{ color: c.primary, label: `sinα = ${fmt(o.n, 2)}·sinβ` }, { color: c.text3, label: "β = α", dash: [5, 5] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) { const x = o.hover * 90; hoverLine(ctx, f, f.X(x), [`α = ${fmt(x, 1)}°`, `β = ${fmt(fn(x), 1)}°`], c); }
}

/** Qutblanish: P(φ) = cos²φ. o: { phi (rad), hover } */
export function drawPolar(ctx, st, o) {
  const c = st.colors, xt = ticks(0, 180, 6), yt = ticks(0, 1, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 180, yMin: 0, yMax: 1.08, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => `${fmt(v, 0)}°`, fmtY: (v) => fmt(v, 2), yLabel: "P / P₀", xUnit: "φ" });
  last = { ...f, xMin: 0, xMax: 180 };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  curve(ctx, f, 180, 0, 180, (x) => P.receiverPower(x * DEG), c.primary, 2.8);
  ctx.restore();
  const x = (((o.phi / DEG) % 180) + 180) % 180;
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(x), f.Y(P.receiverPower(x * DEG)), 6, 0, Math.PI * 2); ctx.fill();
  if (o.hover !== null && o.hover !== undefined) { const h = o.hover * 180; hoverLine(ctx, f, f.X(h), [`φ = ${fmt(h, 0)}°`, `P/P₀ = cos²φ = ${fmt(P.receiverPower(h * DEG), 3)}`], c); }
}

/** Kontur rezonansi: o: { f0, Q, stations: [{ f, label, color }], hover } — f MHz da */
export function drawResonance(ctx, st, o) {
  const c = st.colors, xMin = 0.5, xMax = 1.6, xt = ticks(xMin, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, 1, 4);
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax: 1.1, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 2), yLabel: "kontur javobi U/U₀", xUnit: "f, MHz" });
  last = { ...f, xMin, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const s of o.stations) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.65; ctx.beginPath(); ctx.moveTo(f.X(s.f / 1e6), f.Y(0)); ctx.lineTo(f.X(s.f / 1e6), f.Y(1.02)); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.font = SMALL; ctx.fillStyle = s.color; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(s.label, f.X(s.f / 1e6), f.Y(1.02) - 2);
  }
  curve(ctx, f, 300, xMin, xMax, (x) => P.response(x * 1e6, o.f0, o.Q), c.primary, 2.8);
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x, f.Y(Math.SQRT1_2)); ctx.lineTo(r.x + r.w, f.Y(Math.SQRT1_2)); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.f0 / 1e6), f.Y(1), 6, 0, Math.PI * 2); ctx.fill();
  if (o.hover !== null && o.hover !== undefined) { const x = xMin + o.hover * (xMax - xMin); hoverLine(ctx, f, f.X(x), [`f = ${fmt(x, 3)} MHz`, `javob ${fmt(P.response(x * 1e6, o.f0, o.Q) * 100, 1)} %`], c); }
}

/** Ossillogramma: o: { traces: [{ ys, color, label, dash }], win } — ys −1.6…1.6 oralig'ida, teng qadamli */
export function drawSignal(ctx, st, o) {
  const c = st.colors, xt = ticks(0, o.win, 4), yt = ticks(-1.6, 1.6, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: o.win, yMin: -1.8, yMax: 1.8, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 1), yLabel: "U (nisbiy)", xUnit: "t, ms" });
  last = null;
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const tr of o.traces) {
    ctx.strokeStyle = tr.color; ctx.lineWidth = tr.width || 1.6; ctx.setLineDash(tr.dash || []); ctx.beginPath();
    tr.ys.forEach((y, k) => { const x = (k / (tr.ys.length - 1)) * o.win; if (k) ctx.lineTo(f.X(x), f.Y(y)); else ctx.moveTo(f.X(x), f.Y(y)); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  legend(ctx, o.traces.map((t) => ({ color: t.color, label: t.label, dash: t.dash })), f.padL + 10, r.y + 12, c);
}
