// ==========================================================================
// Elektromagnit induksiya grafiklari: vaqt bo'yicha siljuvchi oyna (ε, I, Ψ).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag } from "./sim-kit.js";

const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);

/** d: { hist: [{t, ...}], window (s), series: [{key, k, color, label, dash}], yLabel, sym, hline, hlabel } */
export function drawSeries(ctx, stage, d) {
  const c = stage.colors, h = d.hist;
  if (h.length < 2) {
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, stage.w, stage.h);
    ctx.fillStyle = c.text3; ctx.font = "500 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Tajriba boshlansa, grafik shu yerda chiziladi", stage.w / 2, stage.h / 2);
    return;
  }
  const tEnd = h[h.length - 1].t, t0 = Math.max(h[0].t, tEnd - d.window);
  let lo = Infinity, hi = -Infinity;
  d.series.forEach((s) => h.forEach((p) => { const v = p[s.key] * s.k; if (v < lo) lo = v; if (v > hi) hi = v; }));
  if (d.hline) { hi = Math.max(hi, d.hline); }
  let m = Math.max(Math.abs(lo), Math.abs(hi), 1e-6);
  if (d.sym) { lo = Math.min(lo, -m * 0.15); hi = Math.max(hi, m * 0.15); }
  const pad = (hi - lo) * 0.12 || m * 0.2;
  const yt = ticks(lo - pad, hi + pad, stage.h < 220 ? 3 : 4);
  const yMin = Math.min(yt.values[0], lo - pad), yMax = Math.max(yt.values[yt.values.length - 1], hi + pad);
  const xt = ticks(0, d.window, stage.w < 480 ? 3 : 6);
  const f = frame(ctx, stage, { xMin: 0, xMax: d.window, yMin, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, dec(xt.step)), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "s", yLabel: d.yLabel });
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  if (d.hline) { ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(d.hline)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(d.hline)); ctx.stroke(); ctx.setLineDash([]); }
  d.series.forEach((s) => {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.25; ctx.setLineDash(s.dash || []); ctx.beginPath();
    let first = true;
    h.forEach((p) => { if (p.t < t0) return; const x = f.X(p.t - t0), y = f.Y(p[s.key] * s.k); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
  });
  ctx.restore();
  if (d.hline) tag(ctx, `${d.hlabel} = ${fmt(d.hline, 2)}`, f.rect.x + f.rect.w - 6, f.Y(d.hline) - 12, { color: c.text2, bg: c.bg, align: "right", font: "600 10.5px Inter, system-ui, sans-serif" });
  legend(ctx, d.series.map((s) => ({ color: s.color, label: s.label, dash: s.dash })), f.padL + 56, 9, c);
}
