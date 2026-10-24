// ==========================================================================
// Termodinamika — grafiklar (simulations/thermo.html):
// p–V diagramma (izotermalar foni, jarayon/sikl chizig'i, ish yuzasi, nuqtalar, kursor bilan p, V, T o'qish)
// va 1-qonun energiya ustunlari (Q, ΔU, A).
// ==========================================================================

import { fmt, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import { R } from "./thermo-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
const SMALL = "500 10px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;

const L = (V) => V * 1000;      // m³ → L

/** p ning qulay maksimumi (kPa) */
export const niceMax = (v) => { const t = ticks(0, v * 1.08, 4); return t.values[t.values.length - 1] < v * 1.04 ? t.values[t.values.length - 1] + t.step : t.values[t.values.length - 1]; };

function arrowHead(ctx, x, y, ang, size, color) {
  ctx.save(); ctx.fillStyle = color; ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.7, size * 0.6); ctx.lineTo(-size * 0.7, -size * 0.6); ctx.closePath(); ctx.fill(); ctx.restore();
}

/**
 * p–V diagramma. o: {
 *   gas, vMax, pMax (SI), isotherms: [T], paths: [{ pts, color, width, dash, arrow }],
 *   fill: { pts, color, closed } | null, marks: [{ s, label, color }], cur: s | null, hover: { V, p } | null, legend: [] }
 */
export function drawPV(ctx, st, o) {
  const div = o.pDiv || 1000, KPA = (p) => p / div, c = st.colors, xMax = L(o.vMax), yMax = KPA(o.pMax);
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const dx = xt.step < 0.1 ? 2 : xt.step < 1 ? 1 : 0, dy = yt.step < 1 ? 1 : 0;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, dx), fmtY: (v) => fmt(v, dy), yLabel: `p, ${o.pUnit || "kPa"}`, xUnit: "V, L" });
  const X = (V) => f.X(L(V)), Y = (p) => f.Y(KPA(p)), r = f.rect;
  last = { ...f, toV: (px) => ((px - r.x) / r.w) * xMax / 1000, toP: (py) => ((r.y + r.h - py) / r.h) * yMax * div };
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();

  // izotermalar (fon): p = νRT/V
  ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  for (const T of o.isotherms || []) {
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1.4; ctx.setLineDash([2, 4]); ctx.beginPath();
    let lab = null;
    for (let k = 0; k <= 120; k++) {
      const V = (o.vMax * (k + 2)) / 122, p = (o.gas.nu * R * T) / V, x = X(V), y = Y(p);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      if (!lab && p <= o.pMax * 0.96) lab = { x, y };
    }
    ctx.stroke(); ctx.setLineDash([]);
    const end = { x: X(o.vMax), y: Y((o.gas.nu * R * T) / o.vMax) };
    if (end.y > r.y + 10) { ctx.fillStyle = c.text3; ctx.fillText(`${fmt(T, 0)} K`, end.x - 3, end.y - 3); }
  }

  // ish yuzasi
  if (o.fill && o.fill.pts.length > 1) {
    ctx.fillStyle = o.fill.color; ctx.beginPath();
    o.fill.pts.forEach((s, k) => (k ? ctx.lineTo(X(s.V), Y(s.p)) : ctx.moveTo(X(s.V), Y(s.p))));
    if (!o.fill.closed) { const a = o.fill.pts[0], b = o.fill.pts[o.fill.pts.length - 1]; ctx.lineTo(X(b.V), Y(0)); ctx.lineTo(X(a.V), Y(0)); }
    ctx.closePath(); ctx.fill();
  }

  // chiziqlar
  for (const P of o.paths || []) {
    if (P.pts.length < 2) continue;
    ctx.strokeStyle = P.color; ctx.lineWidth = P.width || 2.6; ctx.setLineDash(P.dash || []); ctx.lineJoin = "round"; ctx.beginPath();
    P.pts.forEach((s, k) => (k ? ctx.lineTo(X(s.V), Y(s.p)) : ctx.moveTo(X(s.V), Y(s.p))));
    ctx.stroke(); ctx.setLineDash([]);
    if (P.arrow) {
      const m = Math.floor(P.pts.length / 2), a = P.pts[Math.max(0, m - 1)], b = P.pts[Math.min(P.pts.length - 1, m + 1)];
      const ang = Math.atan2(Y(b.p) - Y(a.p), X(b.V) - X(a.V));
      if (Math.hypot(Y(b.p) - Y(a.p), X(b.V) - X(a.V)) > 0.5) arrowHead(ctx, X(P.pts[m].V), Y(P.pts[m].p), ang, 7, P.color);
    }
  }
  ctx.restore();

  // nuqtalar
  ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.textBaseline = "middle";
  for (const m of o.marks || []) {
    const x = X(m.s.V), y = Y(m.s.p);
    ctx.fillStyle = c.bg; ctx.strokeStyle = m.color || c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (m.label) { ctx.fillStyle = m.color || c.text; ctx.textAlign = x > r.x + r.w - 30 ? "right" : "left"; ctx.fillText(m.label, x + (ctx.textAlign === "right" ? -8 : 8), clamp(y - 10, r.y + 8, r.y + r.h - 8)); }
  }
  if (o.cur) {
    const x = X(o.cur.V), y = Y(o.cur.p);
    ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.bg; ctx.lineWidth = 2; ctx.stroke();
  }
  if (o.legend?.length) legend(ctx, o.legend, f.padL + 10, r.y + 12, c);

  // kursor: p, V, T
  if (o.hover) {
    const x = X(o.hover.V), y = Y(o.hover.p);
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x + 0.5, r.y + r.h); ctx.lineTo(x + 0.5, y); ctx.lineTo(r.x, y + 0.5); ctx.stroke(); ctx.setLineDash([]);
    const T = (o.hover.p * o.hover.V) / (o.gas.nu * R);
    const lines = [`V = ${fmt(L(o.hover.V), dx + 1)} L, p = ${fmt(KPA(o.hover.p), dy + (div > 1000 ? 2 : 0))} ${o.pUnit || "kPa"}`];
    if (o.hoverT !== false) lines.push(`shu holatda T = pV/νR = ${fmt(T, 0)} K`);
    ctx.font = FONT;
    const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = x + 12 + wMax > r.x + r.w;
    lines.forEach((l, i) => tag(ctx, l, right ? x - 10 : x + 10, clamp(y - 30 + i * 24, r.y + 12, r.y + r.h - 36 + i * 24), { color: i ? c.text2 : c.text, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
  }
}

/** 1-qonun ustunlari: o: { Q, dU, A, Qname } — J */
export function drawEnergy(ctx, st, o) {
  const { w, h, colors: c } = st;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  last = null;
  const z = (v) => Math.abs(v) < 0.05;
  const rows = [["Q", "Issiqlik miqdori", o.Q, o.Q >= 0 ? c.danger : c.primary, z(o.Q) ? "almashinuv yo‘q" : o.Q > 0 ? "gaz oldi" : "gaz berdi"], ["ΔU", "Ichki energiya o‘zgarishi", o.dU, c.warning, z(o.dU) ? "o‘zgarmadi" : o.dU > 0 ? "ortdi" : "kamaydi"], ["A", "Gaz bajargan ish", o.A, c.success, z(o.A) ? "bajarilmadi" : o.A > 0 ? "gaz kengaydi" : "gaz ustida ish bajarildi"]];
  const vmax = Math.max(1, ...rows.map((rw) => Math.abs(rw[2]))) * 1.1, narrow = w < 520;
  const padL = narrow ? 44 : 190, padR = narrow ? 16 : 120, x0 = padL + (w - padL - padR) / 2, half = (w - padL - padR) / 2;
  const top = 26, rowH = Math.min(46, (h - top - 40) / 3);
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 0.5, top - 8); ctx.lineTo(x0 + 0.5, top + rowH * 3); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("0", x0, top - 10);
  rows.forEach(([sym, name, v, col, note], k) => {
    const y = top + k * rowH + rowH / 2, bw = (v / vmax) * half;
    ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.roundRect(Math.min(x0, x0 + bw), y - 11, Math.max(Math.abs(bw), 1.5), 22, 4); ctx.fill(); ctx.globalAlpha = 1;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.font = "700 14px Inter, system-ui, sans-serif"; ctx.fillStyle = col; ctx.fillText(sym, 12, y - (narrow ? 0 : 7));
    if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.fillText(name, 12, y + 9); }
    ctx.font = FONT; ctx.fillStyle = c.text;
    const val = `${fmt(v, 1)} J`, tx = bw >= 0 ? x0 + bw + 8 : x0 + bw - 8;
    ctx.textAlign = bw >= 0 ? "left" : "right";
    ctx.fillText(narrow ? val : `${val} — ${note}`, clamp(tx, 4, w - 4), y);
  });
  ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.font = "700 13px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text;
  ctx.fillText(`Q = ΔU + A:  ${fmt(o.Q, 1)} = ${fmt(o.dU, 1)} ${o.A < 0 ? "−" : "+"} ${fmt(Math.abs(o.A), 1)} J`, w / 2, h - 10);
}
