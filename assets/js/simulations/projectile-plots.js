// ==========================================================================
// Og'irlik kuchi ta'sirida harakat grafiklari: y(t), tezlik v(t), energiya e(t) (J/kg).
// Hammasi analitik formulalardan chiziladi (butun uchish vaqti oralig'ida); "hozir" belgisi joriy t ni ko'rsatadi.
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { stateAt, energiesAt } from "./projectile-physics.js";
import { fmt, sci, tag, clamp } from "./sim-kit.js";

const TAU = Math.PI * 2;
const small = "600 11px Inter, system-ui, sans-serif";
const N = 200;

function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

let last = null; // { f, T } — grafikdan vaqtni qaytarish uchun

/** Grafikdagi piksel x -> vaqt t (s) yoki null (ramkadan tashqarida). */
export function timeFromPointer(px) {
  if (!last) return null;
  const { f, T } = last, r = f.rect;
  if (px < r.x - 6 || px > r.x + r.w + 6) return null;
  return clamp(((px - r.x) / r.w) * T, 0, T);
}

function curve(ctx, f, T, get, color, width, dash, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.globalAlpha = alpha; ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = (T * i) / N, px = f.X(t), py = f.Y(get(t));
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function progress(ctx, f, tNow, get, color, width) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const n = Math.max(2, Math.ceil((N * tNow) / Math.max(f.T, 1e-9)));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (tNow * i) / n, px = f.X(t), py = f.Y(get(t));
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function nowMark(ctx, c, f, t, y, text, below = false) {
  const cx = f.X(t), cy = f.Y(y);
  ctx.save();
  ctx.strokeStyle = c.warning; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.25; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(cx, f.rect.y); ctx.lineTo(cx, f.rect.y + f.rect.h); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = c.warning;
  ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, TAU); ctx.fill();
  const right = cx > f.rect.x + f.rect.w - 110;
  tag(ctx, text, cx + (right ? -10 : 10), clamp(cy + (below ? 20 : -18), f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: right ? "right" : "left", font: small });
}

/**
 * kind: "y" | "v" | "e".  o: { p, sol, t (null bo'lishi mumkin) }
 */
export function drawFlightPlot(kind, ctx, stage, o) {
  const c = stage.colors, { p, sol } = o;
  const T = Math.max(sol.T, 1e-3);
  const st = (t) => stateAt(p, t);
  const xt = ticks(0, T, stage.w < 480 ? 3 : 6);
  const common = { xMin: 0, xMax: T, xTicks: xt.values, fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), xUnit: "s", padL: stage.w < 480 ? 46 : 56 };
  const tNow = o.t ?? 0;
  let f;

  if (kind === "y") {
    const top = Math.max(sol.H, p.h0, 1) * 1.3, yt = ticks(0, top, stage.h < 260 ? 3 : 4);
    f = frame(ctx, stage, { ...common, yMin: 0, yMax: Math.max(top, yt.values[yt.values.length - 1] + yt.step * 0.3), yTicks: yt.values, fmtY: (v) => fmt(v, dec(yt.step)), yLabel: "y, m" });
    last = { f, T };
    ctx.save(); clipTo(ctx, f.rect);
    curve(ctx, f, T, (t) => st(t).y, c.primary, 2, [6, 5], 0.55);
    if (o.t !== null) progress(ctx, { ...f, T }, tNow, (t) => st(t).y, c.primary, 3);
    ctx.restore();
    if (sol.tTop > 0) {
      ctx.fillStyle = c.success;
      ctx.beginPath(); ctx.arc(f.X(sol.tTop), f.Y(sol.H), 4, 0, TAU); ctx.fill();
      tag(ctx, `H = ${fmt(sol.H, 1)} m`, f.X(sol.tTop) + 10, Math.max(f.Y(sol.H) - 14, f.rect.y + 12), { color: c.success, bg: c.bg, align: "left", font: small });
    }
    nowMark(ctx, c, f, tNow, st(tNow).y, `y = ${fmt(Math.max(0, st(tNow).y), 1)} m`, true);
    legend(ctx, [{ color: c.primary, label: "Balandlik y(t) — parabola" }], f.padL + 10, f.padT + 14, c);
  } else if (kind === "v") {
    const vx = sol.vx, vy0 = sol.vy, vyEnd = vy0 - p.g * T;
    const spd = (t) => Math.hypot(st(t).vx, st(t).vy);
    const hi = Math.max(vy0, vx, spd(0), spd(T), 1), lo = Math.min(vyEnd, 0, vy0);
    const yt = ticks(lo * 1.1, hi * 1.4, stage.h < 260 ? 3 : 4);
    f = frame(ctx, stage, { ...common, yMin: Math.min(yt.values[0], lo * 1.1), yMax: Math.max(yt.values[yt.values.length - 1], hi * 1.4), yTicks: yt.values, fmtY: (v) => fmt(v, dec(yt.step)), yLabel: "v, m/s" });
    last = { f, T };
    ctx.save(); clipTo(ctx, f.rect);
    if (!sol.vertical) curve(ctx, f, T, (t) => spd(t), c.warning, 1.75, null, 0.8);
    if (!sol.vertical) curve(ctx, f, T, () => vx, c.success, 2, [6, 4]);
    curve(ctx, f, T, (t) => st(t).vy, c.primary, o.t !== null ? 2 : 3, o.t !== null ? [6, 5] : null, o.t !== null ? 0.55 : 1);
    if (o.t !== null) progress(ctx, { ...f, T }, tNow, (t) => st(t).vy, c.primary, 3);
    ctx.restore();
    if (sol.tTop > 0) {
      ctx.fillStyle = c.success;
      ctx.beginPath(); ctx.arc(f.X(sol.tTop), f.Y(0), 4, 0, TAU); ctx.fill();
      tag(ctx, `v = 0 · t = ${fmt(sol.tTop, 2)} s`, f.X(sol.tTop), f.Y(0) + 16, { color: c.success, bg: c.bg, align: "center", font: small });
    }
    nowMark(ctx, c, f, tNow, st(tNow).vy, `v${sol.vertical ? "" : "y"} = ${fmt(st(tNow).vy, 1)} m/s`);
    const items = [{ color: c.primary, label: sol.vertical ? "Tezlik v(t) = v₀ − gt" : "Vertikal vy(t) = v₀sinα − gt" }];
    if (!sol.vertical) items.push({ color: c.success, label: "Gorizontal vₓ (o‘zgarmas)", dash: [5, 4] }, { color: c.warning, label: "Tezlik moduli |v|" });
    legend(ctx, items, f.padL + 10, f.padT + 14, c);
  } else {
    const e0 = energiesAt(p, 0).tot, top = Math.max(e0, 1) * 1.4, yt = ticks(0, top, stage.h < 260 ? 3 : 4);
    f = frame(ctx, stage, { ...common, yMin: 0, yMax: Math.max(top, yt.values[yt.values.length - 1] + yt.step * 0.3), yTicks: yt.values, fmtY: (v) => sci(v, 2), yLabel: "e, J/kg", padL: stage.w < 480 ? 54 : 62 });
    last = { f, T };
    ctx.save(); clipTo(ctx, f.rect);
    curve(ctx, f, T, (t) => energiesAt(p, t).pot, c.warning, 2.25);
    curve(ctx, f, T, (t) => energiesAt(p, t).kin, c.success, 2.25);
    curve(ctx, f, T, (t) => energiesAt(p, t).tot, c.primary, 2.75);
    ctx.restore();
    const en = energiesAt(p, tNow);
    nowMark(ctx, c, f, tNow, en.kin, `K = ${sci(en.kin, 3)} · U = ${sci(en.pot, 3)}`, true);
    legend(ctx, [{ color: c.success, label: "Kinetik v²/2" }, { color: c.warning, label: "Potensial gy" }, { color: c.primary, label: "To‘liq (o‘zgarmas)" }], f.padL + 10, f.padT + 14, c);
  }
}
