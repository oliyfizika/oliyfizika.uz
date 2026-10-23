// ==========================================================================
// To'g'ri chiziqli tarqalish grafiklari: ekrandagi yoritilganlik E(y), soya o'lchamlari (L),
// kamera-obskura: tasvir H(d) va dog'(p); tutilishlar: Oy kengligi β(E), yil davomidagi tutilishlar.
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag } from "./sim-kit.js";
import * as L from "./light-physics.js";

const TAU = Math.PI * 2;
const small = "600 10px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function curve(ctx, f, fn, x0, x1, color, w = 2.5, n = 300, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (!Number.isFinite(y)) { pen = false; continue; } if (!pen) { ctx.moveTo(f.X(x), f.Y(y)); pen = true; } else ctx.lineTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
const nice = (max, n = 4) => { const t = ticks(0, max, n); return { vals: t.values, top: t.values[t.values.length - 1], step: t.step }; };

/** Ekran bo'ylab yoritilganlik. */
export function drawProfile(ctx, st, { srcs, obj, Ls, H }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: -H, xMax: H, yMin: 0, yMax: 100, xTicks: ticks(-H, H, 6).values, yTicks: [0, 25, 50, 75, 100], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "E, %" });
  ctx.save(); clipTo(ctx, f.rect);
  // soha bo'yash
  const N = 600, cls = (e) => (e < 0.001 ? 2 : e < 0.999 ? 1 : 0);
  let start = -H, cur = cls(L.illumination(srcs, obj, Ls, -H));
  const flush = (y1) => { if (cur) { ctx.fillStyle = cur === 2 ? "rgba(15,23,42,0.16)" : "rgba(100,116,139,0.1)"; ctx.fillRect(f.X(start), f.rect.y, f.X(y1) - f.X(start), f.rect.h); } };
  for (let i = 1; i <= N; i++) {
    const y = -H + (i * 2 * H) / N, k = cls(L.illumination(srcs, obj, Ls, y));
    if (k !== cur || i === N) { flush(y); start = y; cur = k; }
  }
  curve(ctx, f, (y) => 100 * L.illumination(srcs, obj, Ls, y), -H, H, c.warning, 2.5, 600);
  ctx.restore();
  legend(ctx, [{ color: c.warning, label: "ekrandagi yoritilganlik" }, { color: "rgba(15,23,42,0.5)", label: "to‘la soya" }, { color: "rgba(100,116,139,0.45)", label: "yarim soya" }], f.padL + 56, 9, c);
}

/** Soya va yarim soya diametrlari ekran masofasiga bog'liq. */
export function drawSizes(ctx, st, { a, b, d, Ls }) {
  const c = st.colors, x0 = d + 1, x1 = 130;
  const yTop = nice(Math.max(20, L.penumbraDiameter(a, b, d, x1)));
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: 0, yMax: yTop.top, xTicks: ticks(x0, x1, 6).values.filter((v) => v >= x0), yTicks: yTop.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "D, cm" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (x) => L.penumbraDiameter(a, b, d, x), x0, x1, "#94a3b8", 2.5, 2);
  curve(ctx, f, (x) => L.umbraDiameter(a, b, d, x), x0, x1, c.text, 2.5, 200);
  dot(ctx, f, Ls, L.penumbraDiameter(a, b, d, Ls), "#94a3b8"); dot(ctx, f, Ls, L.umbraDiameter(a, b, d, Ls), c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.text, label: "to‘la soya D_u" }, { color: "#94a3b8", label: "yarim soya (tashqi) D_p" }], f.padL + 56, 9, c);
}

/** Kamera-obskura: tasvir balandligi H(d). */
export function drawPinholeH(ctx, st, { h, d, f: fz }) {
  const c = st.colors, x0 = 20, x1 = 300;
  const yt = nice(Math.max(5, L.pinholeImage(h, x0, fz)));
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: 0, yMax: yt.top, xTicks: [20, 50, 100, 150, 200, 250, 300], yTicks: yt.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "cm", yLabel: "H, cm" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, (x) => L.pinholeImage(h, x, fz), x0, x1, c.primary, 2.5, 300); dot(ctx, f, d, L.pinholeImage(h, d, fz), c.warning); ctx.restore();
  legend(ctx, [{ color: c.primary, label: `H = h·f/d, h = ${fmt(h, 0)} cm, f = ${fmt(fz, 0)} cm` }], f.padL + 56, 9, c);
}

/** Kamera-obskura: dog' o'lchami teshik diametriga bog'liq. p, mm; d, f — cm. */
export function drawBlur(ctx, st, { p, d, f: fz }) {
  const c = st.colors, x0 = 0.05, x1 = 5;
  const dm = d / 100, fm = fz / 100, mm = (x) => x / 1000;
  const g = (pp) => L.geoBlur(mm(pp), dm, fm) * 1000, df = (pp) => L.diffBlur(mm(pp), fm) * 1000, t = (pp) => L.totalBlur(mm(pp), dm, fm) * 1000;
  const yMax = 4;
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: 0, yMax, xTicks: [0.05, 1, 2, 3, 4, 5], yTicks: [0, 1, 2, 3, 4], fmtX: (v) => fmt(v, v < 1 ? 2 : 0), fmtY: (v) => fmt(v, 0), xUnit: "mm", yLabel: "dog‘, mm" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, g, x0, x1, "#94a3b8", 1.5, 200, [6, 4]);
  curve(ctx, f, df, x0, x1, "#8b5cf6", 1.5, 300, [2, 3]);
  curve(ctx, f, t, x0, x1, c.primary, 2.5, 400);
  const po = L.optimalPinhole(dm, fm) * 1000;
  ctx.strokeStyle = c.success; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(f.X(po), f.rect.y); ctx.lineTo(f.X(po), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
  if (t(p) <= yMax) dot(ctx, f, p, t(p), c.warning);
  ctx.restore();
  tag(ctx, `eng aniq: p ≈ ${fmt(po, 2)} mm`, f.X(po) + 4, f.rect.y + f.rect.h - 14, { color: c.success, bg: c.bg, font: small });
  legend(ctx, [{ color: c.primary, label: "umumiy dog‘" }, { color: "#94a3b8", label: "geometrik p(1 + f/d)", dash: [6, 4] }, { color: "#8b5cf6", label: "difraksiya 2,44λf/p", dash: [2, 3] }], f.padL + 56, 9, c);
}

/** Oyning ekliptik kengligi β bir oy davomida va tutilish chegaralari. */
export function drawBeta(ctx, st, { E, node, D }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: 0, xMax: 360, yMin: -6, yMax: 6, xTicks: [0, 90, 180, 270, 360], yTicks: [-6, -3, 0, 3, 6], fmtX: (v) => `${fmt(v, 0)}°`, fmtY: (v) => `${fmt(v, 0)}°`, xUnit: "E", yLabel: "β" });
  const s0 = L.eclipseState(0, 0, D);
  const solLim = s0.solar.rS + s0.rM + s0.piM, lunLim = s0.lunar.rhoU + s0.rM;
  ctx.save(); clipTo(ctx, f.rect);
  // tutilish chegaralari: yangi oy (E=0, 360) va to'lin oy (E=180)
  const band = (x, lim, col) => { ctx.fillStyle = col; ctx.fillRect(f.X(x) - 7, f.Y(lim), 14, f.Y(-lim) - f.Y(lim)); };
  band(0, solLim, "rgba(245,158,11,0.35)"); band(360, solLim, "rgba(245,158,11,0.35)"); band(180, lunLim, "rgba(185,28,28,0.3)");
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(0)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(0)); ctx.stroke();
  curve(ctx, f, (e) => L.eclipseState(e, node, D).beta, 0, 360, c.primary, 2.5, 360);
  dot(ctx, f, ((E % 360) + 360) % 360, L.eclipseState(E, node, D).beta, c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "Oyning ekliptikadan og‘ishi β" }, { color: "rgba(245,158,11,0.7)", label: "Quyosh tutilishi sohasi" }, { color: "rgba(185,28,28,0.6)", label: "Oy tutilishi sohasi" }], f.padL + 56, 9, c);
}

const TYPE_COL = { total: "#b91c1c", annular: "#f59e0b", partial: "#2563eb", penumbral: "#94a3b8" };
/** Bir yil davomida yangi oy va to'lin oylar, tutilishlar rangli. */
export function drawYear(ctx, st, { E, node, D, day }) {
  const c = st.colors;
  const ys = L.yearSyzygies(E, node, D, 365);
  const f = frame(ctx, st, { xMin: 0, xMax: 365, yMin: 0, yMax: 3, xTicks: [0, 60, 120, 180, 240, 300, 365], yTicks: [1, 2], fmtX: (v) => fmt(v, 0), fmtY: (v) => (v === 2 ? "yangi oy" : "to‘lin oy"), xUnit: "sutka", padL: 74 });
  ctx.save(); clipTo(ctx, f.rect);
  if (Number.isFinite(day)) { ctx.strokeStyle = c.warning; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.X(day), f.rect.y); ctx.lineTo(f.X(day), f.rect.y + f.rect.h); ctx.stroke(); }
  ys.forEach((s) => {
    const y = s.kind === "new" ? 2 : 1, type = s.kind === "new" ? s.st.solar.type : s.st.lunar.type;
    if (type === "none") { ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(f.X(s.day), f.Y(y), 4, 0, TAU); ctx.stroke(); }
    else dot(ctx, f, s.day, y, TYPE_COL[type], 7);
  });
  ctx.restore();
  legend(ctx, [{ color: TYPE_COL.total, label: "to‘liq" }, { color: TYPE_COL.annular, label: "halqasimon" }, { color: TYPE_COL.partial, label: "xususiy" }, { color: TYPE_COL.penumbral, label: "yarim soyali" }], f.padL + 40, 9, c);
}
