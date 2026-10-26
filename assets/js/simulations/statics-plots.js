// ==========================================================================
// Statika — grafiklar (simulations/statics.html): qutining massa markazi balandligi h(α), sharchaning
// potensial energiyasi Eₚ(x), richag muvozanati F₂(l₂), oddiy mexanizmlar F(m) va ish (oltin qoida).
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./statics-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
const DEG = Math.PI / 180;
let last = null;
export const lastFrame = () => last;
const setLast = (f, xMin, xMax) => { last = { rect: f.rect, inv: (px) => xMin + ((px - f.rect.x) / f.rect.w) * (xMax - xMin) }; };
function hoverLine(ctx, r, px, lines, c) {
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const clip = (ctx, r) => { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); };
function curve(ctx, f, x0, x1, n, fn, { color, width = 2.6, dash } = {}) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); let pen = false;
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = fn(x); if (!Number.isFinite(y)) { pen = false; continue; } const X = f.X(x), Y = f.Y(y); if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; } }
  ctx.stroke(); ctx.setLineDash([]);
}
function dot(ctx, x, y, color, c, { hollow = false, r = 6 } = {}) {
  ctx.fillStyle = hollow ? c.bg : color; ctx.strokeStyle = hollow ? color : c.bg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
const lastTick = (vals, max, span) => vals.filter((v) => v < max - 0.08 * span);

/** Quti: massa markazi balandligi h(α), cm. o: { b, h, f (m), a (rad), hover } */
export function drawTip(ctx, st, o) {
  const c = st.colors, xMin = 0, xMax = 90, H = (a) => P.tipHeight(o.b, o.h, o.f, a * DEG) * 100;
  const ac = P.tipCrit(o.b, o.h, o.f) / DEG, yMax = Math.max(H(ac), H(0), H(90)) * 1.25;
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax, xTicks: lastTick(ticks(xMin, xMax, st.w < 480 ? 4 : 6).values, xMax, 90), yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "massa markazi balandligi, cm", xUnit: "α, °" });
  setLast(f, xMin, xMax);
  ctx.fillStyle = c.dark ? "rgba(34,197,94,0.12)" : "rgba(22,163,74,0.08)"; ctx.fillRect(f.X(0), f.rect.y, f.X(ac) - f.X(0), f.rect.h);
  ctx.fillStyle = c.dark ? "rgba(239,68,68,0.12)" : "rgba(220,38,38,0.07)"; ctx.fillRect(f.X(ac), f.rect.y, f.X(90) - f.X(ac), f.rect.h);
  clip(ctx, f.rect); curve(ctx, f, 0, 90, 90, H, { color: c.primary }); ctx.restore();
  ctx.strokeStyle = c.danger; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.X(ac), f.rect.y); ctx.lineTo(f.X(ac), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
  tag(ctx, `αₖᵣ = ${fmt(ac, 1)}°`, f.X(ac) + 4, f.rect.y + f.rect.h - 14, { color: c.danger, bg: c.bg2, font: FONT });
  dot(ctx, f.X(o.a / DEG), f.Y(H(o.a / DEG)), c.warning, c);
  legend(ctx, [{ color: c.primary, label: "qaytadi ← | → ag‘dariladi" }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) { const a = o.hover; hoverLine(ctx, f.rect, f.X(a), [`α = ${fmt(a, 1)}°`, `h = ${fmt(H(a), 2)} cm${a < ac ? " — qaytadi" : " — ag‘dariladi"}`], c); }
}

/** Sharcha: Eₚ(x) = mgy, mJ. o: { kind, x, v, m (kg), hover } */
export function drawBall(ctx, st, o) {
  const c = st.colors, xMin = -24, xMax = 24, E = (x) => o.m * 9.8 * P.surfY(o.kind, x) * 10; // mJ (y cm → m: ·0,01; J → mJ: ·1000)
  const Ek = 0.5 * o.m * (o.v / 100) ** 2 * 1000 * (7 / 5), Etot = E(o.x) + Ek, yMax = Math.max(E(15), 1) * 1.4;
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax, xTicks: lastTick(ticks(xMin, xMax, st.w < 480 ? 4 : 8).values, xMax, 48), yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "Eₚ, mJ", xUnit: "x, cm" });
  setLast(f, xMin, xMax);
  clip(ctx, f.rect);
  curve(ctx, f, xMin, xMax, 240, (x) => (o.kind === "bowl" && Math.abs(x) > P.SURF_W ? NaN : E(x)), { color: c.primary });
  if (o.kind === "bowl") { ctx.strokeStyle = c.primary; ctx.lineWidth = 2.6; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(f.X(sx * P.SURF_W), f.Y(E(P.SURF_W))); ctx.lineTo(f.X(sx * P.SURF_W), f.rect.y); ctx.stroke(); } }
  if (Ek > 0.01) { ctx.strokeStyle = c.success; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Etot)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Etot)); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  dot(ctx, f.X(o.x), f.Y(E(o.x)), c.warning, c);
  legend(ctx, [{ color: c.primary, label: "potensial energiya" }, { color: c.success, label: "to‘liq energiya", dash: [5, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) { const x = o.hover, s = P.surfSlope(o.kind, x); hoverLine(ctx, f.rect, f.X(x), [`x = ${fmt(x, 1)} cm`, `Eₚ = ${fmt(E(x), 1)} mJ; ${Math.abs(s) < 1e-9 ? "kuch nolga teng" : s * (o.kind === "bowl" ? 1 : 1) > 0 ? "kuch chapga" : "kuch o‘ngga"}`], c); }
}

/** Richag: M₁ momentni muvozanatlash uchun kerakli F₂(l₂) = M₁/l₂. o: { M (N·m), F, l (cm), phi, pts: [{ l, F }], hover } */
export function drawLever(ctx, st, o) {
  const c = st.colors, xMin = 0, xMax = 32, M = Math.abs(o.M) * 100; // N·cm
  const yMax = Math.max(6, ...o.pts.map((p) => p.F * 1.15), Math.abs(o.F) * 1.15 || 0);
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax: Math.min(yMax, 14), xTicks: lastTick(ticks(xMin, xMax, st.w < 480 ? 4 : 8).values, xMax, 32), yTicks: ticks(0, Math.min(yMax, 14), 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "muvozanatlovchi kuch F₂, N", xUnit: "l₂, cm" });
  setLast(f, xMin, xMax);
  clip(ctx, f.rect);
  if (M > 1e-6) {
    curve(ctx, f, 1, xMax, 200, (l) => M / l, { color: c.primary });
    if (o.phi > 0.01) curve(ctx, f, 1, xMax, 200, (l) => M / (l * Math.cos(o.phi)), { color: c.special, width: 1.8, dash: [6, 4] });
  }
  ctx.restore();
  o.pts.forEach((p) => dot(ctx, f.X(p.l), f.Y(p.F), c.success, c, { r: 5 }));
  if (o.l > 0 && Number.isFinite(o.F) && Math.abs(o.F) < 30) dot(ctx, f.X(o.l), f.Y(Math.abs(o.F)), c.warning, c, { hollow: true });
  const items = [{ color: c.primary, label: `F₂·l₂ = M₁ = ${fmt(M, 1)} N·cm` }]; if (o.phi > 0.01) items.push({ color: c.special, label: `qiya: F₂·l₂·cos ${fmt(o.phi / DEG, 0)}°`, dash: [6, 4] });
  legend(ctx, items, f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null && o.hover > 0.5 && M > 1e-6) { const l = o.hover; hoverLine(ctx, f.rect, f.X(l), [`l₂ = ${fmt(l, 1)} cm`, `F₂ = ${fmt(M / l, 2)} N`], c); }
}

/** Oddiy mexanizm: F(m). o: { kind, n, R, m, hover } */
export function drawMechF(ctx, st, o) {
  const c = st.colors, xMin = 0, xMax = 10, opt = { n: o.n, R: o.R }, Fr = (m) => P.mechForce(o.kind, m, opt).F, Fi = (m) => P.mechForce(o.kind, m, { ...opt, ideal: true }).F;
  const yMax = Math.max(Fr(xMax), xMax * 9.8 * 0.25) * 1.1;
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax, xTicks: ticks(xMin, xMax, 5).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "kerakli kuch F, N", xUnit: "m, kg" });
  setLast(f, xMin, xMax);
  clip(ctx, f.rect);
  curve(ctx, f, 0, xMax, 2, (m) => m * 9.8, { color: c.text3, width: 1.4, dash: [3, 4] });
  curve(ctx, f, 0, xMax, 40, Fi, { color: c.success, width: 1.8, dash: [6, 4] });
  curve(ctx, f, 0, xMax, 40, Fr, { color: c.primary });
  ctx.restore();
  dot(ctx, f.X(o.m), f.Y(Fr(o.m)), c.warning, c);
  legend(ctx, [{ color: c.primary, label: "real" }, { color: c.success, label: "ideal", dash: [6, 4] }, { color: c.text3, label: "F = mg", dash: [3, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null && o.hover >= 0) { const m = o.hover; hoverLine(ctx, f.rect, f.X(m), [`m = ${fmt(m, 2)} kg, mg = ${fmt(m * 9.8, 1)} N`, `F = ${fmt(Fr(m), 2)} N (ideal ${fmt(Fi(m), 2)} N)`], c); }
}

/** Ish: foydali mgh va to'liq F·s. o: { W, F, h (m), s (m) } */
export function drawWork(ctx, st, o) {
  const c = st.colors, Af = o.W * o.h, At = o.F * o.s, Ai = o.W * o.h, yMax = Math.max(1, At * 1.45);
  const f = frame(ctx, st, { xMin: 0, xMax: 3, yMin: 0, yMax, xTicks: [], yTicks: ticks(0, yMax, 4).values, fmtX: () => "", fmtY: (v) => fmt(v, v < 10 ? 1 : 0), yLabel: "ish, J" });
  last = null;
  const bars = [["Foydali ish mgh", Af, c.success], ["To‘liq ish F·s", At, c.primary], ["Ishqalanish va blok", Math.max(0, At - Af), c.danger]];
  const bw = Math.min(90, f.rect.w / 5);
  bars.forEach(([name, v, col], i) => {
    const x = f.X(i + 0.5) - bw / 2, y = f.Y(v);
    ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(x, y, bw, f.Y(0) - y); ctx.globalAlpha = 1;
    ctx.font = FONT; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`${fmt(v, 2)} J`, x + bw / 2, y - 4);
    ctx.fillStyle = c.text2; ctx.textBaseline = "top"; ctx.fillText(name, x + bw / 2, f.rect.y + f.rect.h + 8);
  });
  const eta = At > 1e-9 ? Af / At : 1;
  tag(ctx, `FIK η = ${fmt(eta * 100, 0)} %; ideal mexanizmda F·s = mgh = ${fmt(Ai, 2)} J`, f.rect.x + 10, f.rect.y + 14, { color: c.text, bg: c.bg2, font: FONT });
}
