// ==========================================================================
// Kulon qonuni va elektr maydon — grafiklar (simulations/coulomb-law.html):
// F(r) va F(1/r²) — osma sharcha tajribasidagi o'lchangan nuqtalar bilan; zaryadlangan shar uchun E(r) va φ(r).
// ==========================================================================

import { fmt, sci, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./coulomb-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
function dot(ctx, x, y, r, fill, stroke) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }

/**
 * Kulon tajribasi. o: { view: "r" | "inv", q1, q2 (C), r (m, hozirgi), F (N, hozirgi o'lchangan), pts: [{ r, F, qq }], hover }
 * F mN da, r cm da; inv ko'rinishda x = 1/r² (1/cm²·10⁻³ emas — 1/m²).
 */
export function drawLaw(ctx, st, o) {
  const c = st.colors, qq = o.q1 * o.q2, Fk = (r) => Math.abs(P.coulomb(o.q1, o.q2, r)) * 1000;
  const same = (p) => Math.abs(p.qq - qq) <= 1e-3 * Math.max(Math.abs(qq), 1e-30);
  if (o.view === "inv") {
    const xs = [...o.pts.map((p) => 1 / (p.r * p.r)), o.r ? 1 / (o.r * o.r) : 0];
    const xMax = Math.max(400, ...xs) * 1.15; // 1/r², 1/m²
    const ptsMax = Math.max(0, ...o.pts.filter(same).map((p) => p.F * 1000));
    const yMax = Math.max(0.05, Fk(1 / Math.sqrt(xMax)), ptsMax) * 1.1;
    const xt = ticks(0, xMax, st.w < 480 ? 4 : 5), yt = ticks(0, yMax, 4);
    const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 0.1 ? 2 : 1), yLabel: "F, mN", xUnit: "1/r², 1/m²" });
    last = { ...f, xMin: 0, xMax };
    const r = f.rect;
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    if (qq) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(Fk(1 / Math.sqrt(xMax)))); ctx.stroke(); }
    for (const p of o.pts) dot(ctx, f.X(1 / (p.r * p.r)), f.Y(p.F * 1000), 5, same(p) ? c.success : c.text3, c.bg);
    // EKK: F = a·(1/r²) (koordinata boshidan)
    const sp = o.pts.filter(same);
    if (sp.length >= 2) {
      let sxx = 0, sxy = 0; for (const p of sp) { const x = 1 / (p.r * p.r); sxx += x * x; sxy += x * p.F * 1000; }
      const a = sxy / sxx; ctx.strokeStyle = c.success; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(a * xMax)); ctx.stroke(); ctx.setLineDash([]);
      last.fit = a / 1000; // N·m²
    }
    ctx.restore();
    if (o.r) dot(ctx, f.X(Math.min(xMax, 1 / (o.r * o.r))), f.Y(o.F * 1000), 6, c.warning);
    legend(ctx, [{ color: c.primary, label: "Kulon: F = k|q₁q₂|·(1/r²)" }, ...(sp.length >= 2 ? [{ color: c.success, label: "o‘lchashlar bo‘yicha to‘g‘ri chiziq", dash: [6, 4] }] : [])], f.padL + 10, r.y + 12, c);
    if (o.hover != null) { const x = o.hover; hoverLine(ctx, f, f.X(x), [`1/r² = ${fmt(x, 0)} 1/m²  (r = ${fmt(100 / Math.sqrt(Math.max(x, 1)), 1)} cm)`, `F = ${fmt(Fk(1 / Math.sqrt(Math.max(x, 1))), 3)} mN`], c); }
    return;
  }
  const xMin = 2, xMax = 16;
  const yMax = Math.max(0.05, Math.min(Fk(0.03), Math.max(Fk(0.05) * 3, 0.1)), ...o.pts.filter(same).map((p) => p.F * 1000)) * 1.12;
  const xt = ticks(xMin, xMax, st.w < 480 ? 5 : 7), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 0.1 ? 2 : 1), yLabel: "F, mN", xUnit: "r, cm" });
  last = { ...f, xMin, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  if (qq) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2.4; ctx.beginPath(); for (let x = xMin; x <= xMax + 1e-9; x += 0.05) { const y = f.Y(Fk(x / 100)); x === xMin ? ctx.moveTo(f.X(x), y) : ctx.lineTo(f.X(x), y); } ctx.stroke(); }
  for (const p of o.pts) dot(ctx, f.X(p.r * 100), f.Y(p.F * 1000), 5, same(p) ? c.success : c.text3, c.bg);
  ctx.restore();
  if (o.r) dot(ctx, f.X(Math.min(xMax, Math.max(xMin, o.r * 100))), f.Y(Math.min(yMax, o.F * 1000)), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: "Kulon qonuni" }, { color: c.success, label: "o‘lchangan: mg·tg α" }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) hoverLine(ctx, f, f.X(o.hover), [`r = ${fmt(o.hover, 1)} cm`, `F = ${fmt(Fk(o.hover / 100), 3)} mN`], c);
}

/** Zaryadlangan shar. o: { view: "E" | "phi", Q (C), R (m), type, r (m, zond), hover (cm) } */
export function drawSphere(ctx, st, o) {
  const c = st.colors, xMax = 40, other = o.type === "shell" ? "solid" : "shell";
  const isE = o.view === "E";
  const val = (type, rc) => (isE ? P.sphereE(o.Q, o.R, rc / 100, type) / 1e3 : P.spherePhi(o.Q, o.R, rc / 100, type) / 1e3); // kV/m yoki kV
  const peak = Math.abs(isE ? P.sphereE(o.Q, o.R, o.R) / 1e3 : P.spherePhi(o.Q, o.R, 0, "solid") / 1e3) || 1;
  const big = isE && Math.abs(o.Q) > 0 && P.E_BD / 1e3 < peak * 1.6;
  const lim = Math.max(peak, big ? P.E_BD / 1e3 : 0) * 1.12;
  const neg = o.Q < 0, yMin = neg ? -lim : 0, yMax = neg ? 0 : lim;
  const k = lim >= 2000, sc = k ? 1e-3 : 1, unit = isE ? (k ? "E, MV/m" : "E, kV/m") : k ? "φ, MV" : "φ, kV";
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 8), yt = ticks(yMin * sc, yMax * sc, 4);
  const f0 = frame(ctx, st, { xMin: 0, xMax, yMin: yMin * sc, yMax: yMax * sc, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: unit, xUnit: "r, cm" });
  const f = { ...f0, Y: (y) => f0.Y(y * sc) };
  last = { ...f0, xMin: 0, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // shar ichi
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.14)"; ctx.fillRect(f.X(0), r.y, f.X(o.R * 100) - f.X(0), r.h);
  if (big) { ctx.strokeStyle = c.danger; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4; const y = f.Y((neg ? -1 : 1) * P.E_BD / 1e3); ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); ctx.setLineDash([]); }
  const curve = (type, color, w, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
    let first = true;
    for (let x = 0; x <= xMax + 1e-9; x += 0.1) {
      const xx = Math.abs(x - o.R * 100) < 0.05 ? o.R * 100 : x;
      if (type === "shell" && isE && Math.abs(xx - o.R * 100) < 1e-9) { ctx.lineTo(f.X(xx), f.Y(0)); ctx.lineTo(f.X(xx), f.Y(val(type, xx))); continue; } // sakrash
      const y = f.Y(val(type, xx)); first ? ctx.moveTo(f.X(xx), y) : ctx.lineTo(f.X(xx), y); first = false;
    }
    ctx.stroke(); ctx.setLineDash([]);
  };
  if (o.Q) { curve(other, c.text3, 1.3, [5, 4]); curve(o.type, c.primary, 2.6); }
  ctx.restore();
  const rp = Math.min(xMax, o.r * 100);
  if (o.Q) dot(ctx, f.X(rp), f.Y(val(o.type, rp)), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: o.type === "shell" ? "metall shar" : "dielektrik shar" }, { color: c.text3, label: o.type === "shell" ? "dielektrik shar" : "metall shar", dash: [5, 4] }, ...(big ? [{ color: c.danger, label: "havo teshilishi 3 MV/m", dash: [5, 4] }] : [])], f.padL + 10, r.y + 12, c);
  if (o.hover != null) hoverLine(ctx, f, f.X(o.hover), [`r = ${fmt(o.hover, 1)} cm${o.hover < o.R * 100 ? " (shar ichida)" : ""}`, isE ? `E = ${sci(val(o.type, o.hover) * 1e3, 3)} V/m` : `φ = ${sci(val(o.type, o.hover) * 1e3, 3)} V`], c);
}
