// ==========================================================================
// Harakat grafiklari — x(t), v(t), a(t) chizish (simulations/motion.html).
// To'liq (bashorat) egri chiziq — xira shtrix, o'tilgan qismi — qalin; v(t) ostidagi yuza (ko'chish),
// x(t) ga kursordagi urinma (oniy tezlik), uchrashish nuqtasi, bo'lakli v(t) tugunlari (suriladi).
// ==========================================================================

import { fmt, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
const KEY = { x: "x", v: "v", a: "a" };
const UNIT = { x: "m", v: "m/s", a: "m/s²" };

let last = null;
/** Oxirgi chizilgan ramka (sichqoncha bilan ishlash uchun). */
export const lastFrame = () => last;

/**
 * o: { tab, tMax, tNow, yMin, yMax, series: [{ m, color, label, Tend }], ghost, hover (t | null),
 *      meet: { t, x } | null, nodes: [{ t, v, w }] | null (v tabida suriladigan tugunlar) }
 */
export function drawPlot(ctx, stage, o) {
  const c = stage.colors, k = KEY[o.tab];
  const yt = ticks(o.yMin, o.yMax, stage.h < 230 ? 3 : 4), xt = ticks(0, o.tMax, stage.w < 480 ? 5 : 10);
  const f = frame(ctx, stage, {
    xMin: 0, xMax: o.tMax, yMin: o.yMin, yMax: o.yMax, xTicks: xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: `${o.tab}, ${UNIT[o.tab]}`, xUnit: "s",
  });
  last = { ...f, tMax: o.tMax, yMin: o.yMin, yMax: o.yMax };
  const r = f.rect;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();

  // v(t) ostidagi yuza — birinchi jism uchun (0 dan hozirgi yoki kursor vaqtigacha)
  const A = o.series[0];
  if (o.tab === "v" && A) {
    const tA = Math.min(o.hover ?? o.tNow, A.Tend);
    if (tA > 0) {
      const N = 240, y0 = f.Y(0);
      for (const sgn of [1, -1]) {
        ctx.fillStyle = sgn > 0 ? (c.dark ? "rgba(96,165,250,0.22)" : "rgba(37,99,235,0.14)") : (c.dark ? "rgba(248,113,113,0.22)" : "rgba(220,38,38,0.13)");
        ctx.beginPath(); ctx.moveTo(f.X(0), y0);
        for (let i = 0; i <= N; i++) { const t = (tA * i) / N, v = A.m.state(t).v; ctx.lineTo(f.X(t), f.Y(sgn > 0 ? Math.max(0, v) : Math.min(0, v))); }
        ctx.lineTo(f.X(tA), y0); ctx.closePath(); ctx.fill();
      }
    }
  }

  const curve = (s, t0, t1, width, dash, alpha) => {
    if (t1 <= t0) return;
    const N = Math.max(40, Math.round(((t1 - t0) / o.tMax) * 500));
    ctx.strokeStyle = s.color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.globalAlpha = alpha; ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const t = t0 + ((t1 - t0) * i) / N, y = s.m.state(t)[k]; if (i) ctx.lineTo(f.X(t), f.Y(y)); else ctx.moveTo(f.X(t), f.Y(y)); }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  for (const s of o.series) {
    if (o.ghost) curve(s, 0, s.Tend, 2, [6, 5], 0.45);
    curve(s, 0, Math.min(o.tNow, s.Tend), 3, null, 1);
  }

  // Urinma x(t) ga (kursorda yoki hozirgi vaqtda) — qiyalik = oniy tezlik
  if (o.tab === "x" && A && o.hover !== null && o.hover <= A.Tend) {
    const st = A.m.state(o.hover), dt = o.tMax * 0.18;
    ctx.strokeStyle = c.warning; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(f.X(o.hover - dt), f.Y(st.x - st.v * dt)); ctx.lineTo(f.X(o.hover + dt), f.Y(st.x + st.v * dt)); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();

  // Uchrashish nuqtasi
  if (o.meet && o.tab === "x") {
    const px = f.X(o.meet.t), py = f.Y(o.meet.x);
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, r.y + r.h); ctx.moveTo(px, py); ctx.lineTo(r.x, py); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Bo'lakli v(t) tugunlari
  if (o.nodes && o.tab === "v") {
    for (const n of o.nodes) {
      const px = f.X(n.t), py = f.Y(n.v);
      if (n.w) { ctx.strokeStyle = c.primary; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(f.X(n.t - n.w), py); ctx.lineTo(f.X(n.t + n.w), py); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.primary; ctx.beginPath();
      ctx.moveTo(px, py - 5); ctx.lineTo(px - 2.6, py - 1.6); ctx.lineTo(px + 2.6, py - 1.6); ctx.closePath();
      ctx.moveTo(px, py + 5); ctx.lineTo(px - 2.6, py + 1.6); ctx.lineTo(px + 2.6, py + 1.6); ctx.closePath(); ctx.fill();
    }
  }

  // Hozirgi nuqtalar
  for (const s of o.series) {
    const t = Math.min(o.tNow, s.Tend), y = s.m.state(t)[k];
    ctx.fillStyle = s.color; ctx.strokeStyle = c.bg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.X(t), f.Y(clamp(y, o.yMin, o.yMax)), 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Kursor: vertikal chiziq va qiymatlar
  if (o.hover !== null) {
    const px = f.X(o.hover);
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
    const lines = [`t = ${fmt(o.hover, 2)} s`];
    for (const s of o.series) {
      if (o.hover > s.Tend + 1e-9) continue;
      const st = s.m.state(o.hover);
      lines.push(`${s.short}: ${o.tab} = ${fmt(st[k], o.tab === "x" ? 1 : 2)} ${UNIT[o.tab]}`);
      if (s === A && o.tab === "x") lines.push(`qiyalik = v = ${fmt(st.v, 2)} m/s`);
      if (s === A && o.tab === "v") lines.push(`yuza: Δx = ${fmt(st.x - s.m.state(0).x, 1)} m, s = ${fmt(st.s, 1)} m`);
    }
    ctx.font = FONT;
    const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
    const right = px + 12 + wMax > r.x + r.w;
    lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
  }

  legend(ctx, o.series.map((s) => ({ color: s.color, label: s.label })), f.padL + 10, r.y + r.h - 12, c);
}
