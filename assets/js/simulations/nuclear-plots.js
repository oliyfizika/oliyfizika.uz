// ==========================================================================
// Yadro fizikasi — grafiklar (simulations/nuclear.html):
// N(t) (o'lchangan + nazariy N₀·2^(−t/T½)), faollik gistogrammasi, E_b/A (A) egri chizig'i, zanjir reaksiyada n(t)
// (logarifmik) va ajralgan energiya E(t). Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, sci, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./nuclear-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;

function hoverTags(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT;
  const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}

/** N(t): o: { iso, N0, hist: [{t, N}], tMax, hover } — t izotop birliklarida. */
export function drawDecay(ctx, st, o) {
  const c = st.colors, T = o.iso.half;
  const xt = ticks(0, o.tMax, st.w < 480 ? 4 : 8), yt = ticks(0, o.N0, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: o.tMax, yMin: 0, yMax: o.N0 * 1.05, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => sci(v, 3), fmtY: (v) => fmt(v, 0), yLabel: "N, yadrolar", xUnit: o.iso.unit });
  last = { ...f, xMax: o.tMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // T½ belgilari: N₀/2, N₀/4 …
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.font = "500 10px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  for (let k = 1; k * T <= o.tMax + 1e-9; k++) {
    const x = f.X(k * T), y = f.Y(o.N0 / 2 ** k);
    ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x, y); ctx.lineTo(r.x, y); ctx.stroke();
    if (k <= 4) ctx.fillText(`${k}T½`, x + 3, r.y + r.h - 2);
  }
  ctx.setLineDash([]);
  // nazariy egri chiziq
  ctx.strokeStyle = c.warning; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath();
  for (let i = 0; i <= 200; i++) { const t = (o.tMax * i) / 200, y = P.remaining(o.N0, t, T); if (i) ctx.lineTo(f.X(t), f.Y(y)); else ctx.moveTo(f.X(t), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
  // o'lchangan (zinapoya)
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.6; ctx.beginPath();
  o.hist.forEach((p, i) => { if (!i) ctx.moveTo(f.X(p.t), f.Y(p.N)); else { ctx.lineTo(f.X(p.t), f.Y(o.hist[i - 1].N)); ctx.lineTo(f.X(p.t), f.Y(p.N)); } });
  ctx.stroke();
  ctx.restore();
  const lp = o.hist[o.hist.length - 1];
  if (lp) { ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(f.X(lp.t), f.Y(lp.N), 5, 0, Math.PI * 2); ctx.fill(); }
  if (o.hover !== null) {
    const t = o.hover, i = o.hist.findIndex((p) => p.t > t), m = i < 0 ? lp : o.hist[Math.max(0, i - 1)];
    const lines = [`t = ${sci(t, 3)} ${o.iso.unit} = ${fmt(t / T, 2)}·T½`, `nazariy: N = ${fmt(P.remaining(o.N0, t, T), 1)}`];
    if (m && t <= lp.t) lines.push(`o‘lchangan: N = ${m.N}`);
    hoverTags(ctx, f, f.X(t), lines, c);
  }
  legend(ctx, [{ color: c.primary, label: "O‘lchangan" }, { color: c.warning, label: "N₀·2^(−t/T½)", dash: [5, 4] }], f.padL + 10, r.y + r.h - 12, c);
}

/** Faollik: har oraliqdagi yemirilishlar soni (gistogramma) va λN·Δt. o: { iso, N0, bins: number[], bw, tMax, hover } */
export function drawActivity(ctx, st, o) {
  const c = st.colors, T = o.iso.half, lam = P.lambdaOf(T);
  const yMax = Math.max(o.N0 * (1 - 2 ** (-o.bw / T)) * 1.15, 1);
  const xt = ticks(0, o.tMax, st.w < 480 ? 4 : 8), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: o.tMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => sci(v, 3), fmtY: (v) => fmt(v, 0), yLabel: `ΔN, har ${sci(o.bw, 3)} ${o.iso.unit} da`, xUnit: o.iso.unit });
  last = { ...f, xMax: o.tMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = c.dark ? "rgba(96,165,250,0.45)" : "rgba(37,99,235,0.35)"; ctx.strokeStyle = c.primary; ctx.lineWidth = 1;
  o.bins.forEach((n, i) => { const x0 = f.X(i * o.bw), x1 = f.X((i + 1) * o.bw); ctx.fillRect(x0 + 1, f.Y(n), x1 - x0 - 2, f.Y(0) - f.Y(n)); });
  ctx.strokeStyle = c.warning; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath();
  for (let i = 0; i <= 200; i++) { const t = (o.tMax * i) / 200, y = P.remaining(o.N0, t, T) * (1 - Math.exp(-lam * o.bw)); if (i) ctx.lineTo(f.X(t), f.Y(y)); else ctx.moveTo(f.X(t), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  if (o.hover !== null) { const i = Math.floor(o.hover / o.bw); hoverTags(ctx, f, f.X(o.hover), [`t = ${sci(o.hover, 3)} ${o.iso.unit}`, `bu oraliqda: ${o.bins[i] ?? "—"} ta`, `nazariy λN·Δt ≈ ${fmt(P.remaining(o.N0, i * o.bw, T) * (1 - Math.exp(-lam * o.bw)), 1)}`], c); }
  legend(ctx, [{ color: c.primary, label: "Yemirilishlar" }, { color: c.warning, label: "Nazariy", dash: [5, 4] }], f.padL + 10, r.y + 14, c);
}

/** E_b/A (A): o: { cur: {Z, A, B} | null, pts: [{Z, A, label, role}] , arrows, hover } */
export function drawBinding(ctx, st, o) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: 0, xMax: 240, yMin: 0, yMax: 9.5, xTicks: ticks(0, 240, st.w < 480 ? 4 : 8).values, yTicks: [0, 2, 4, 6, 8], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "E_b/A, MeV", xUnit: "A" });
  last = { ...f, xMax: 240 };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // sohalar
  ctx.fillStyle = c.dark ? "rgba(52,211,153,0.07)" : "rgba(22,163,74,0.06)"; ctx.fillRect(r.x, r.y, f.X(56) - r.x, r.h);
  ctx.fillStyle = c.dark ? "rgba(251,146,60,0.07)" : "rgba(234,88,12,0.06)"; ctx.fillRect(f.X(56), r.y, r.x + r.w - f.X(56), r.h);
  ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.textBaseline = "top";
  ctx.fillStyle = c.success; ctx.textAlign = "left"; ctx.fillText("sintez → energiya ajraladi", f.X(8), f.Y(3.2));
  ctx.fillStyle = c.warning; ctx.textAlign = "right"; ctx.fillText("bo‘linish → energiya ajraladi", f.X(236), f.Y(6.6));
  // tomchi modeli egri chizig'i (barqarorlik chizig'i bo'yicha)
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]); ctx.beginPath();
  for (let A = 4; A <= 240; A++) { const Z = Math.round(P.zStable(A)), y = P.semf(Z, A) / A; if (A === 4) ctx.moveTo(f.X(A), f.Y(y)); else ctx.lineTo(f.X(A), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
  // haqiqiy nuqtalar
  ctx.fillStyle = c.primary;
  for (const [k, B] of Object.entries(P.B_REAL)) { const A = +k.split("-")[1]; ctx.beginPath(); ctx.arc(f.X(A), f.Y(B / A), 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  for (const [k, lab] of P.MARKED) { const A = +k.split("-")[1], y = P.B_REAL[k] / A; if (o.pts?.some((p) => `${p.Z}-${p.A}` === k)) continue; ctx.fillText(lab, f.X(A), f.Y(y) - (A === 238 ? -16 : 6)); }
  // reaksiya o'qlari
  for (const a of o.arrows || []) {
    ctx.strokeStyle = a.color; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(f.X(a.A0), f.Y(a.y0)); ctx.lineTo(f.X(a.A1), f.Y(a.y1)); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const p of o.pts || []) {
    const b = P.binding(p.Z, p.A).B / p.A, px = f.X(p.A), py = f.Y(b);
    ctx.fillStyle = p.color; ctx.strokeStyle = c.bg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    tag(ctx, p.label, clamp(px + 8, r.x + 2, r.x + r.w - 60), clamp(py - 14, r.y + 10, r.y + r.h - 10), { color: p.color, bg: c.bg, font: FONT });
  }
  if (o.cur) {
    const px = f.X(o.cur.A), py = f.Y(o.cur.B / o.cur.A);
    ctx.strokeStyle = c.danger; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
    tag(ctx, `${o.cur.label}: ${fmt(o.cur.B / o.cur.A, 2)} MeV`, clamp(px + 12, r.x + 2, r.x + r.w - 140), clamp(py + 18, r.y + 10, r.y + r.h - 10), { color: c.danger, bg: c.bg, font: FONT });
  }
  if (o.hover !== null) {
    const A = Math.round(o.hover), Z = Math.round(P.zStable(A));
    hoverTags(ctx, f, f.X(A), [`A = ${A} (Z ≈ ${Z})`, `formula: E_b/A = ${fmt(P.semf(Z, A) / A, 2)} MeV`], c);
  }
}

/** Zanjir reaksiya: o: { tab: "n" | "e", hist: [{t, n, E}], tMax, hover } */
export function drawChain(ctx, st, o) {
  const c = st.colors, tMax = Math.max(10, o.tMax);
  if (o.tab === "n") {
    const nMax = Math.max(10, ...o.hist.map((p) => p.n)), top = 10 ** Math.ceil(Math.log10(nMax * 1.2));
    const yt = []; for (let v = 1; v <= top; v *= 10) yt.push(Math.log10(v));
    const f = frame(ctx, st, { xMin: 0, xMax: tMax, yMin: 0, yMax: Math.log10(top), xTicks: ticks(0, tMax, st.w < 480 ? 4 : 8).values, yTicks: yt, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(10 ** v, 0), yLabel: "neytronlar soni n (log)", xUnit: "s" });
    last = { ...f, xMax: tMax };
    const r = f.rect; ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath();
    o.hist.forEach((p, i) => { const y = f.Y(Math.log10(Math.max(1, p.n))); if (i) ctx.lineTo(f.X(p.t), y); else ctx.moveTo(f.X(p.t), y); });
    ctx.stroke(); ctx.restore();
    if (o.hover !== null) { const p = o.hist.reduce((b, q) => (Math.abs(q.t - o.hover) < Math.abs(b.t - o.hover) ? q : b), o.hist[0] || { t: 0, n: 0 }); hoverTags(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 1)} s`, `n = ${p.n}`], c); }
    return;
  }
  const eMax = Math.max(1000, ...o.hist.map((p) => p.E)) * 1.1, yt = ticks(0, eMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: tMax, yMin: 0, yMax: eMax, xTicks: ticks(0, tMax, st.w < 480 ? 4 : 8).values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => sci(v, 2), yLabel: "ajralgan energiya E, MeV", xUnit: "s" });
  last = { ...f, xMax: tMax };
  const r = f.rect; ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = c.warning; ctx.lineWidth = 2.5; ctx.beginPath();
  o.hist.forEach((p, i) => { if (i) ctx.lineTo(f.X(p.t), f.Y(p.E)); else ctx.moveTo(f.X(p.t), f.Y(p.E)); });
  ctx.stroke(); ctx.restore();
  if (o.hover !== null) { const p = o.hist.reduce((b, q) => (Math.abs(q.t - o.hover) < Math.abs(b.t - o.hover) ? q : b), o.hist[0] || { t: 0, E: 0 }); hoverTags(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 1)} s`, `E = ${sci(p.E, 3)} MeV`, `= ${sci(p.E * 1.602e-13, 3)} J`], c); }
}
