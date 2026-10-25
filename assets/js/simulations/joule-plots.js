// ==========================================================================
// Tok ishi, quvvati va Joul–Lens qonuni — grafiklar (simulations/joule.html):
// kalorimetr T(t) va Q(t), lampa I(U) va P(U), uy tarmog'i I(t) va saqlagich chegarasi.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./joule-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
const CUP = (c) => [c.primary, c.warning];
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const poly = (ctx, f, pts, fx, fy) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(f.X(fx(p)), f.Y(fy(p))) : ctx.moveTo(f.X(fx(p)), f.Y(fy(p))))); ctx.stroke(); };
const at = (hist, t, key) => { if (!hist.length) return null; let best = hist[0]; for (const p of hist) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p; return best[key]; };

/** Kalorimetr. o: { view: "T" | "Q", hist: [{ t, T: [..], Qe: [..], Qa: [..] }], n, C, P: [..], hover } — t s da */
export function drawHeat(ctx, st, o) {
  const c = st.colors, tNow = o.hist.length ? o.hist[o.hist.length - 1].t : 0;
  const tMax = Math.max(120, Math.ceil((tNow * 1.15) / 60) * 60), cols = CUP(c);
  const min = (t) => t / 60;
  if (o.view === "Q") {
    const qMax = Math.max(1000, ...o.hist.map((p) => Math.max(...p.Qe))) * 1.12 / 1000;
    const xt = ticks(0, min(tMax), st.w < 480 ? 4 : 6), yt = ticks(0, qMax, 4);
    const f = frame(ctx, st, { xMin: 0, xMax: min(tMax), yMin: 0, yMax: qMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: "Q, kJ", xUnit: "t, min" });
    last = { ...f, xMin: 0, xMax: min(tMax) };
    ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
    for (let i = 0; i < o.n; i++) {
      ctx.strokeStyle = cols[i]; ctx.lineWidth = 2.4; poly(ctx, f, o.hist, (p) => min(p.t), (p) => p.Qe[i] / 1000);
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; poly(ctx, f, o.hist, (p) => min(p.t), (p) => p.Qa[i] / 1000); ctx.setLineDash([]);
    }
    ctx.restore();
    legend(ctx, [{ color: c.text2, label: "I²Rt — spiral bergan" }, { color: c.text2, label: "cmΔT — suv va idish olgan", dash: [5, 4] }], f.padL + 10, f.rect.y + 12, c);
    if (o.hover != null && o.hist.length) { const t = o.hover * 60; hoverLine(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 2)} min`, ...Array.from({ length: o.n }, (_, i) => `${i + 1}: I²Rt = ${fmt((at(o.hist, t, "Qe") || [])[i] / 1000, 2)} kJ, cmΔT = ${fmt((at(o.hist, t, "Qa") || [])[i] / 1000, 2)} kJ`)], c); }
    return;
  }
  const Tm = Math.max(30, ...o.hist.map((p) => Math.max(...p.T))), yMax = Math.min(110, Math.ceil((Tm + 5) / 10) * 10);
  const xt = ticks(0, min(tMax), st.w < 480 ? 4 : 6), yt = ticks(10, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: min(tMax), yMin: 10, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => fmt(v, 0), yLabel: "T, °C", xUnit: "t, min" });
  last = { ...f, xMin: 0, xMax: min(tMax) };
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  for (let i = 0; i < o.n; i++) {
    // yo'qotishsiz nazariya (hozirgi quvvatda): T = T₀ + Pt/C
    ctx.strokeStyle = cols[i]; ctx.globalAlpha = 0.5; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(P.T_ROOM)); ctx.lineTo(f.X(min(tMax)), f.Y(Math.min(P.BOIL, P.T_ROOM + (o.P[i] * tMax) / o.C[i]))); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.lineWidth = 2.6; poly(ctx, f, o.hist, (p) => min(p.t), (p) => p.T[i]);
  }
  ctx.restore();
  legend(ctx, Array.from({ length: o.n }, (_, i) => ({ color: cols[i], label: `${o.n > 1 ? `${i + 1}-kalorimetr` : "suv"}: R = ${fmt(o.R[i], 1)} Ω` })).concat([{ color: c.text3, label: "yo‘qotishsiz: Pt/C", dash: [5, 4] }]), f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null && o.hist.length) { const t = o.hover * 60; hoverLine(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 2)} min`, ...Array.from({ length: o.n }, (_, i) => `${o.n > 1 ? `${i + 1}: ` : ""}T = ${fmt((at(o.hist, t, "T") || [])[i], 1)} °C`)], c); }
}

/** Lampa. o: { view: "I" | "P", lamps: [L], conn, U, Umax, pts (hozirgi: [{ U, I, P }]), hover } */
export function drawLamp(ctx, st, o) {
  const c = st.colors, cols = CUP(c), Umax = o.Umax, isI = o.view === "I";
  const val = (L, U) => (isI ? P.lampI(L, U) : P.lampI(L, U) * U);
  const yMax = Math.max(...o.lamps.map((L) => val(L, Umax))) * 1.12 || 1;
  const xt = ticks(0, Umax, st.w < 480 ? 5 : 10), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: Umax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 0.1 ? 2 : yt.step < 1 ? 1 : 0), yLabel: isI ? "I, A" : "P, W", xUnit: "U, V" });
  last = { ...f, xMin: 0, xMax: Umax };
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  o.lamps.forEach((L, i) => {
    // Om qonuni (R o'zgarmas, nominaldagi qarshilik) — taqqoslash uchun
    const Rn = (L.Un * L.Un) / L.Pn;
    ctx.strokeStyle = cols[i]; ctx.globalAlpha = 0.5; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.beginPath();
    for (let U = 0; U <= Umax + 1e-9; U += Umax / 100) { const y = f.Y(isI ? U / Rn : (U * U) / Rn); U ? ctx.lineTo(f.X(U), y) : ctx.moveTo(f.X(U), y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.lineWidth = 2.6; ctx.beginPath();
    for (let U = 0; U <= Umax + 1e-9; U += Umax / 200) { const y = f.Y(val(L, U)); U ? ctx.lineTo(f.X(U), y) : ctx.moveTo(f.X(U), y); }
    ctx.stroke();
  });
  ctx.restore();
  // ish nuqtalari (har lampadagi kuchlanish)
  o.pts.forEach((p, i) => { ctx.fillStyle = cols[i]; ctx.strokeStyle = c.bg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.X(Math.min(Umax, p.U)), f.Y(isI ? p.I : p.P), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  legend(ctx, [...o.lamps.map((L, i) => ({ color: cols[i], label: `${L.name}` })), { color: c.text3, label: "agar R o‘zgarmas bo‘lsa", dash: [5, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) hoverLine(ctx, f, f.X(o.hover), [`U = ${fmt(o.hover, 0)} V`, ...o.lamps.map((L) => `${L.name}: I = ${fmt(P.lampI(L, o.hover), 3)} A, P = ${fmt(P.lampI(L, o.hover) * o.hover, 1)} W, R = ${fmt(P.lampR(L, o.hover), 0)} Ω`)], c);
}

/** Uy tarmog'i. o: { hist: [{ t, I }], In, win, hover } — t s da (oxirgi win soniya) */
export function drawLine(ctx, st, o) {
  const c = st.colors, tNow = o.hist.length ? o.hist[o.hist.length - 1].t : 0, t0 = Math.max(0, tNow - o.win);
  const yMax = Math.max(o.In * P.FUSE_K * 1.25, ...o.hist.map((p) => p.I * 1.1));
  const xt = ticks(t0, t0 + o.win, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: t0, xMax: t0 + o.win, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "I, A", xUnit: "t, s" });
  last = { ...f, xMin: t0, xMax: t0 + o.win };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = c.dark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.08)"; ctx.fillRect(r.x, f.Y(yMax), r.w, f.Y(o.In * P.FUSE_K) - f.Y(yMax));
  ctx.strokeStyle = c.danger; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(r.x, f.Y(o.In * P.FUSE_K)); ctx.lineTo(r.x + r.w, f.Y(o.In * P.FUSE_K)); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.beginPath(); ctx.moveTo(r.x, f.Y(o.In)); ctx.lineTo(r.x + r.w, f.Y(o.In)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.6; ctx.beginPath();
  o.hist.filter((p) => p.t >= t0 - 1).forEach((p, i, a) => { const x = f.X(p.t), y = f.Y(p.I); if (!i) ctx.moveTo(x, y); else { ctx.lineTo(x, f.Y(a[i - 1].I)); ctx.lineTo(x, y); } });
  ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "tarmoqdagi tok I = ΣP/U" }, { color: c.text3, label: `Iₙ = ${o.In} A`, dash: [6, 4] }, { color: c.danger, label: `1,45·Iₙ — erish chegarasi`, dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null && o.hist.length) hoverLine(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 0)} s`, `I = ${fmt(at(o.hist, o.hover, "I"), 1)} A`], c);
}
