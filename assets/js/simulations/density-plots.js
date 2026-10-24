// ==========================================================================
// Massa, zichlik va suzish — grafiklar (simulations/density.html):
// moddalar zichligi jadvali (o'lchangan qiymat bilan), dinamometr ko'rsatishi va Arximed kuchi botish chuqurligiga bog'liq.
// ==========================================================================

import { fmt, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./density-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;

/** Zichliklar jadvali: o: { keys: [...], measured (g/cm³) | null, liquid (g/cm³) | null, hover } */
export function drawTable(ctx, st, o) {
  const { w, h, colors: c } = st;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const rows = o.keys.map((k) => P.MATERIALS[k]).sort((a, b) => a.rho - b.rho), padL = w < 480 ? 92 : 128, padR = 54, top = 14, rh = Math.min(20, (h - top - 26) / rows.length);
  const xMax = Math.max(12, ...rows.map((r) => r.rho)) * 1.05, X = (v) => padL + (v / xMax) * (w - padL - padR);
  last = { rect: { x: padL, y: top, w: w - padL - padR, h: rows.length * rh }, xMax };
  ctx.font = FONT; ctx.textBaseline = "middle";
  rows.forEach((r, i) => {
    const y = top + i * rh + rh / 2, near = o.measured && Math.abs(o.measured - r.rho) / r.rho < 0.06;
    ctx.fillStyle = near ? c.text : c.text2; ctx.textAlign = "right"; ctx.fillText(r.name, padL - 8, y);
    ctx.fillStyle = r.color; ctx.globalAlpha = near ? 1 : 0.7; ctx.fillRect(padL, y - rh * 0.32, X(r.rho) - padL, rh * 0.64); ctx.globalAlpha = 1;
    if (near) { ctx.strokeStyle = c.warning; ctx.lineWidth = 2; ctx.strokeRect(padL - 0.5, y - rh * 0.32 - 1.5, X(r.rho) - padL + 1, rh * 0.64 + 3); }
    ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.fillText(fmt(r.rho, r.rho < 1 ? 2 : 1), X(r.rho) + 6, y);
  });
  const by = top + rows.length * rh + 4;
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, by); ctx.lineTo(w - padR, by); ctx.stroke();
  ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (const v of ticks(0, xMax, 5).values) { ctx.fillRect(X(v), by, 1, 4); ctx.fillText(fmt(v, 0), X(v), by + 6); }
  ctx.textAlign = "right"; ctx.fillText("ρ, g/cm³", w - 6, by + 6);
  const mark = (v, col, label) => { const x = X(v); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, by); ctx.stroke(); ctx.setLineDash([]); tag(ctx, label, clamp(x, padL + 60, w - 70), top + 2, { color: col, bg: c.bg2, align: "center", font: FONT }); };
  if (o.liquid) mark(o.liquid, c.primary, `suyuqlik ${fmt(o.liquid, 2)}`);
  if (o.measured) mark(o.measured, c.warning, `o‘lchandi: ${fmt(o.measured, 2)} g/cm³`);
  if (o.hover !== null && o.hover !== undefined) {
    const v = o.hover * xMax, x = X(v), id = P.identify(v);
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, by); ctx.stroke(); ctx.setLineDash([]);
    tag(ctx, `ρ = ${fmt(v, 2)} g/cm³ = ${fmt(v * 1000, 0)} kg/m³ (≈ ${id.mat.name.toLowerCase()})`, clamp(x, padL + 140, w - 150), by - 14, { color: c.text, bg: c.bg2, align: "center", font: FONT });
  }
}

/** Dinamometr va Arximed kuchi botish chuqurligiga bog'liq: o: { m, A, H, rhoL, d, dMax, hover } */
export function drawForces(ctx, st, o) {
  const c = st.colors, P0 = P.weight(o.m), yMax = Math.max(P0, P.buoyancy({ ...o, d: o.H }).FA) * 1.2;
  const xt = ticks(0, o.dMax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: o.dMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 0.1 ? 2 : 1), yLabel: "F, N", xUnit: "h, cm" });
  last = { ...f, xMax: o.dMax };
  const r = f.rect, N = 200;
  const line = (fn, col, w, dash) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); for (let k = 0; k <= N; k++) { const d = (o.dMax * k) / N, y = fn(d); if (k) ctx.lineTo(f.X(d), f.Y(y)); else ctx.moveTo(f.X(d), f.Y(y)); } ctx.stroke(); ctx.setLineDash([]); };
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  line(() => P0, c.text3, 1.4, [3, 4]);
  line((d) => P.buoyancy({ ...o, d }).FA, c.primary, 2.4, [6, 4]);
  line((d) => P.springReading({ ...o, d }), c.danger, 2.8);
  ctx.restore();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(clamp(o.d, 0, o.dMax)), f.Y(P.springReading(o)), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.danger, label: "Dinamometr" }, { color: c.primary, label: "F_A", dash: [5, 4] }, { color: c.text3, label: "P = mg", dash: [3, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) {
    const d = o.hover, x = f.X(d), b = P.buoyancy({ ...o, d });
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x + 0.5, r.y); ctx.lineTo(x + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
    const lines = [`h = ${fmt(d, 1)} cm`, `F_A = ${fmt(b.FA, 3)} N (V = ${fmt(b.Vsub, 1)} cm³)`, `dinamometr: ${fmt(P.springReading({ ...o, d }), 3)} N`];
    ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = x + 12 + wMax > r.x + r.w;
    lines.forEach((l, i) => tag(ctx, l, right ? x - 10 : x + 10, r.y + 34 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
  }
}
