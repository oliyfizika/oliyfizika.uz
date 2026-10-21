// ==========================================================================
// Linzalar grafiklari: f(d), 1/f(1/d) (lab), Γ(d), asbob kattalashtirishi, ko'z aniqligi.
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag, clamp } from "./sim-kit.js";
import { thinLens, eyeView, farNear, loupeMag, microscopeMag, telescopeMag } from "./optics-physics.js";

const TAU = Math.PI * 2;
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function curve(ctx, f, fn, x0, x1, color, w = 2.5, n = 300, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (!Number.isFinite(y) || Math.abs(y) > 1e4) { pen = false; continue; } if (!pen) { ctx.moveTo(f.X(x), f.Y(y)); pen = true; } else ctx.lineTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };

export function drawFD(ctx, st, d) {
  const c = st.colors, F = d.F;
  const f = frame(ctx, st, { xMin: 0, xMax: 60, yMin: -60, yMax: 60, xTicks: [0, 10, 20, 30, 40, 50, 60], yTicks: [-60, -30, 0, 30, 60], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "f, cm" });
  ctx.save(); clipTo(ctx, f.rect);
  if (F > 0) { ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.X(F), f.rect.y); ctx.lineTo(f.X(F), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]); }
  curve(ctx, f, (x) => { const r = thinLens(F, x); return r.inf ? NaN : r.f; }, 0.2, 60, c.primary);
  const r = thinLens(F, d.d); if (!r.inf && Math.abs(r.f) <= 60) dot(ctx, f, d.d, r.f, c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: `F = ${fmt(F, 1)} cm` }], f.padL + 56, 9, c);
  if (F > 0) tag(ctx, "d = F", f.X(F) + 4, f.rect.y + 12, { color: c.text3, bg: c.bg, font: "600 10px Inter, system-ui, sans-serif" });
}

export function drawInv(ctx, st, d) {
  const c = st.colors, D = 1 / d.F; // 1/cm
  const max = Math.max(0.3, D * 1.2);
  const t = ticks(0, max, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: max, yMin: 0, yMax: max, xTicks: t.values, yTicks: t.values, fmtX: (v) => fmt(v * 100, 0), fmtY: (v) => fmt(v * 100, 0), xUnit: "1/m", yLabel: "1/f, 1/m" });
  ctx.save(); clipTo(ctx, f.rect);
  if (D > 0) curve(ctx, f, (x) => D - x, 0, max, c.primary, 2, 2, [6, 5]);
  d.pts.forEach((p) => dot(ctx, f, 1 / p.d, 1 / p.f, c.success, 5));
  ctx.restore();
  const items = [{ color: c.primary, label: `nazariy: 1/d + 1/f = D = ${fmt(100 * D, 1)} dptr`, dash: [6, 5] }];
  if (d.pts.length) {
    const Dm = d.pts.reduce((a, p) => a + 1 / p.d + 1 / p.f, 0) / d.pts.length;
    items.push({ color: c.success, label: `o‘lchov: D ≈ ${fmt(100 * Dm, 2)} dptr (${d.pts.length} ta)` });
  }
  legend(ctx, items, f.padL + 56, 9, c);
}

export function drawGamma(ctx, st, d) {
  const c = st.colors, F = d.F;
  const f = frame(ctx, st, { xMin: 0, xMax: 60, yMin: 0, yMax: 6, xTicks: [0, 10, 20, 30, 40, 50, 60], yTicks: [0, 1, 2, 3, 4, 5, 6], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "Γ" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(1)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(1)); ctx.stroke(); ctx.setLineDash([]);
  curve(ctx, f, (x) => { const r = thinLens(F, x); return r.inf ? NaN : Math.abs(r.m); }, 0.2, 60, c.primary);
  const r = thinLens(F, d.d); if (!r.inf && Math.abs(r.m) < 6) dot(ctx, f, d.d, Math.abs(r.m), c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "Γ = |f/d|" }], f.padL + 56, 9, c);
}

export function drawInstrMag(ctx, st, d) {
  const c = st.colors;
  let fn, xMin = 2, xMax = 15, xLabel = "F₂, cm", cur = d.F2, lab;
  if (d.kind === "loupe") { fn = (F) => loupeMag(F / 100); xMax = 20; xLabel = "F, cm"; cur = d.F1; lab = "Γ = 25/F"; }
  else if (d.kind === "micro") { fn = (F2) => microscopeMag(d.F1 / 100, F2 / 100, d.L / 100); lab = `Γ ≈ (Δ/F₁)(d₀/F₂), F₁ = ${fmt(d.F1, 1)} cm`; }
  else if (d.kind === "tele") { fn = (F2) => telescopeMag(d.F1, F2); lab = `Γ = F₁/F₂, F₁ = ${fmt(d.F1, 0)} cm`; }
  else { fn = (x) => { const r = thinLens(d.F1, x); return r.inf ? NaN : Math.abs(r.m); }; xMin = d.F1 * 1.05; xMax = 60; xLabel = "d, cm"; cur = d.d; lab = "Γ = f/d"; }
  const yMax = Math.max(2, Math.min(60, fn(Math.max(xMin, 2)) * 1.1));
  const yt = ticks(0, yMax, 4), xt = ticks(xMin, xMax, 6);
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax: Math.max(yMax, yt.values[yt.values.length - 1]), xTicks: xt.values.filter((v) => v >= xMin), yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: xLabel.split(", ")[1], yLabel: "Γ" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, fn, xMin, xMax, c.primary);
  const y = fn(cur); if (Number.isFinite(y)) dot(ctx, f, cur, y, c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: lab }], f.padL + 56, 9, c);
}

export function drawEyeBlur(ctx, st, d) {
  const c = st.colors;
  // x — log10(d, m) oralig'i: 0,1 m … 20 m va ∞
  const x0 = -1, x1 = 1.3;
  const blurAt = (lx) => eyeView(Math.pow(10, lx), d.defect, d.G).blur * 1e6;
  const yMax = 80;
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: 0, yMax, xTicks: [-1, -0.602, 0, 0.699, 1], yTicks: [0, 20, 40, 60, 80], fmtX: (v) => { const m = Math.pow(10, v); return m < 1 ? `${fmt(m * 100, 0)} cm` : `${fmt(m, 0)} m`; }, fmtY: (v) => fmt(v, 0), yLabel: "dog‘, μm" });
  ctx.save(); clipTo(ctx, f.rect);
  // aniq soha
  ctx.fillStyle = "rgba(34,197,94,0.12)";
  let inside = false, start = 0;
  for (let i = 0; i <= 400; i++) { const lx = x0 + ((x1 - x0) * i) / 400, ok = blurAt(lx) < 6; if (ok && !inside) { inside = true; start = lx; } if ((!ok || i === 400) && inside) { inside = false; ctx.fillRect(f.X(start), f.rect.y, f.X(lx) - f.X(start), f.rect.h); } }
  curve(ctx, f, (lx) => Math.min(blurAt(lx), yMax * 1.5), x0, x1, c.primary, 2.5, 400);
  ctx.strokeStyle = c.danger; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(6)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(6)); ctx.stroke(); ctx.setLineDash([]);
  if (Number.isFinite(d.d)) { const lx = Math.log10(d.d); if (lx >= x0 && lx <= x1) dot(ctx, f, lx, Math.min(blurAt(lx), yMax), c.warning); }
  ctx.restore();
  const fn = farNear(d.defect);
  legend(ctx, [{ color: c.primary, label: d.G ? `ko‘zoynak ${d.G > 0 ? "+" : ""}${fmt(d.G, 2)} D bilan` : "ko‘zoynaksiz" }, { color: "rgba(34,197,94,0.6)", label: "aniq ko‘rish sohasi" }], f.padL + 56, 9, c);
  void fn; void clamp;
}
