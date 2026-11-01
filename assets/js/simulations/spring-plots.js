// ==========================================================================
// Prujinali mayatnik grafiklari: x(t) (+ v/ω₀), Guk qonuni F(x), davr T(m).
// Energiya E(t) grafigi pendulum-plots.js dagi createEnergyPlot orqali chiziladi.
// Tarix (createHistory): th ← x (m), w ← v (m/s), kin, pot — energiyalar (J).
// ==========================================================================

import { TAU, niceStep } from "./pendulum-physics.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, clamp, tag } from "./sim-kit.js";

const CM = 100;
const small = "600 11px Inter, system-ui, sans-serif";

function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

/* ------------------------------------------------------------------ x(t) */

export function createXPlot() {
  return {
    /** o: { win, tNow, w0, envelope: { A0, gamma } | null, showV } */
    draw(ctx, stage, hist, o) {
      const c = stage.colors;
      const xMin = o.tNow > o.win ? o.tNow - o.win : 0, xMax = xMin + o.win;
      const i0 = hist.firstFrom(xMin);
      let amp = o.envelope ? o.envelope.A0 * 0.5 : 0;
      for (let i = i0; i < hist.length; i++) amp = Math.max(amp, Math.abs(hist.th[i]), o.showV ? Math.abs(hist.w[i]) / o.w0 : 0);
      const top = Math.max(0.05, amp * 1.15) * CM;
      const step = niceStep(top, stage.h < 260 ? 2 : 3);
      const yMax = Math.ceil(top / step) * step;
      const yt = ticks(-yMax, yMax, stage.h < 260 ? 3 : 4), xt = ticks(xMin, xMax, stage.w < 480 ? 3 : 5);
      const f = frame(ctx, stage, {
        xMin, xMax, yMin: -yMax, yMax, xTicks: xt.values, yTicks: yt.values,
        fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => fmt(v, dec(yt.step)), yLabel: "x, sm", xUnit: "s",
      });
      ctx.save();
      clipTo(ctx, f.rect);
      if (o.envelope && o.envelope.gamma > 0) {
        ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
        for (const sg of [1, -1]) {
          ctx.beginPath();
          for (let k = 0; k <= 80; k++) {
            const t = xMin + ((xMax - xMin) * k) / 80;
            const y = sg * o.envelope.A0 * Math.exp((-o.envelope.gamma * t) / 2) * CM;
            if (k === 0) ctx.moveTo(f.X(t), f.Y(y)); else ctx.lineTo(f.X(t), f.Y(y));
          }
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      const line = (get, color, width, dash) => {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = i0; i < hist.length; i++) {
          const px = f.X(hist.t[i]), py = f.Y(get(i) * CM);
          if (i === i0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };
      if (o.showV) line((i) => hist.w[i] / o.w0, c.success, 2, [6, 4]);
      line((i) => hist.th[i], c.primary, 2.75);
      ctx.restore();
      const n = hist.length;
      if (n) {
        const cx = f.X(hist.t[n - 1]), cy = f.Y(hist.th[n - 1] * CM);
        ctx.save();
        ctx.strokeStyle = c.warning; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.25; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, f.rect.y); ctx.lineTo(cx, f.rect.y + f.rect.h); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = c.warning;
        ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, TAU); ctx.fill();
        const right = cx > f.rect.x + f.rect.w - 80;
        tag(ctx, `x = ${fmt(hist.th[n - 1] * CM, 1)} sm`, cx + (right ? -10 : 10), clamp(cy - 18, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: right ? "right" : "left", font: small });
      }
      const items = [{ color: c.primary, label: "Siljish x" }];
      if (o.showV) items.push({ color: c.success, label: "Tezlik v/ω₀", dash: [5, 4] });
      if (o.envelope && o.envelope.gamma > 0) items.push({ color: c.text3, label: "So‘nish chizig‘i", dash: [5, 4] });
      legend(ctx, items, f.padL + 10, f.padT + 14, c);
    },
  };
}

/* ------------------------------------------------------------------ Guk qonuni F(x) */

export function drawHooke(ctx, stage, o) {
  // o: { k, xView (m), x (m), F (N; elastik kuch, F = −kx) }
  const c = stage.colors;
  const xs = o.xView * CM, fMax = o.k * o.xView;
  const xt = ticks(-xs, xs, stage.w < 480 ? 3 : 4), yt = ticks(-fMax, fMax, stage.h < 260 ? 3 : 4);
  const f = frame(ctx, stage, {
    xMin: -xs, xMax: xs, yMin: -fMax, yMax: fMax, xTicks: xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, dec(xt.step)), fmtY: (v) => fmt(v, dec(yt.step)), yLabel: "F, N", xUnit: "sm", padL: stage.w < 480 ? 44 : 54,
  });
  ctx.save();
  clipTo(ctx, f.rect);
  // Elastik potensial energiya — F(x) chizig'i ostidagi uchburchak (ishora bilan)
  const px = f.X(o.x * CM), py = f.Y(o.F);
  ctx.fillStyle = c.primary; ctx.globalAlpha = 0.16;
  ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(px, py); ctx.lineTo(px, f.Y(0)); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.primary; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(f.X(-xs), f.Y(o.k * o.xView)); ctx.lineTo(f.X(xs), f.Y(-o.k * o.xView)); ctx.stroke();
  ctx.setLineDash([4, 4]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, f.Y(0)); ctx.lineTo(px, py); ctx.lineTo(f.X(0), py); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = c.warning;
  ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill();
  const right = px > f.rect.x + f.rect.w * 0.6;
  tag(ctx, `F = −kx = ${fmt(o.F, 1)} N`, px + (right ? -12 : 12), clamp(py - 20, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: right ? "right" : "left", font: small });
  legend(ctx, [{ color: c.primary, label: `F = −kx,  k = ${fmt(o.k, 0)} N/m` }], f.padL + 10, f.padT + 14, c);
  ctx.save();
  ctx.fillStyle = c.primary; ctx.globalAlpha = 0.16;
  ctx.fillRect(f.padL + 10, f.padT + 28, 16, 10);
  ctx.globalAlpha = 1; ctx.fillStyle = c.text2; ctx.font = "600 11px Inter, system-ui, sans-serif"; ctx.textBaseline = "middle";
  ctx.fillText("Yuza = ½kx² (potensial energiya)", f.padL + 31, f.padT + 33.5);
  ctx.restore();
}

/* ------------------------------------------------------------------ Davr T(m) */

let lastT = null;
export function drawPeriodVsMass(ctx, stage, o) {
  // o: { k, m, mMin, mMax }
  const c = stage.colors;
  const T = (m, k) => TAU * Math.sqrt(m / k);
  const yTop = T(o.mMax, Math.min(o.k, o.k)) * 1.12;
  const yt = ticks(0, yTop, stage.h < 260 ? 3 : 4), xt = ticks(o.mMin, o.mMax, stage.w < 480 ? 3 : 5);
  const f = frame(ctx, stage, {
    xMin: o.mMin, xMax: o.mMax, yMin: 0, yMax: yt.values[yt.values.length - 1] + yt.step * 0.3, xTicks: xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => fmt(v, dec(yt.step)), yLabel: "T, s", xUnit: "kg", padL: stage.w < 480 ? 44 : 54,
  });
  lastT = { f, o };
  ctx.save();
  clipTo(ctx, f.rect);
  const curve = (k, color, w, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []);
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const m = o.mMin + ((o.mMax - o.mMin) * i) / 160;
      if (i === 0) ctx.moveTo(f.X(m), f.Y(T(m, k))); else ctx.lineTo(f.X(m), f.Y(T(m, k)));
    }
    ctx.stroke();
  };
  curve(o.k * 4, c.text3, 2, [6, 5]);
  curve(o.k, c.primary, 3);
  ctx.restore();
  const Tc = T(o.m, o.k);
  ctx.save();
  ctx.setLineDash([4, 4]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(f.X(o.m), f.rect.y + f.rect.h); ctx.lineTo(f.X(o.m), f.Y(Tc)); ctx.lineTo(f.rect.x, f.Y(Tc)); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = c.warning;
  ctx.beginPath(); ctx.arc(f.X(o.m), f.Y(Tc), 6, 0, TAU); ctx.fill();
  const right = f.X(o.m) > f.rect.x + f.rect.w * 0.6;
  tag(ctx, `T = ${fmt(Tc, 3)} s`, f.X(o.m) + (right ? -12 : 12), clamp(f.Y(Tc) + 20, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: right ? "right" : "left", font: small });
  legend(ctx, [{ color: c.primary, label: `k = ${fmt(o.k, 0)} N/m` }, { color: c.text3, label: `4k = ${fmt(o.k * 4, 0)} N/m (T ikki marta qisqa)`, dash: [5, 4] }], f.padL + 10, f.padT + 14, c);
}
export function periodMassFromPointer(px, py) {
  if (!lastT) return null;
  const { f, o } = lastT, r = f.rect;
  if (px < r.x || px > r.x + r.w) return null;
  return clamp(o.mMin + ((px - r.x) / r.w) * (o.mMax - o.mMin), o.mMin, o.mMax);
}
