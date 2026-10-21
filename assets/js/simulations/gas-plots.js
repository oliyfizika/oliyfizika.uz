// ==========================================================================
// Molekulyar harakat grafiklari: izojarayonlar, Maksvell taqsimoti, bosim p(τ), diffuziya, Broun harakati.
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag, clamp } from "./sim-kit.js";
import { maxwell2D } from "./gas-engine.js";

const TAU = Math.PI * 2;
const small = "600 11px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);

function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function message(ctx, stage, text) {
  const { w, h, colors: c } = stage;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c.text3; ctx.font = "500 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
}
function axes(stage, xMin, xMax, yMin, yMax, nx = 5, ny = 4) {
  const xt = ticks(xMin, xMax, stage.w < 480 ? Math.min(4, nx) : nx);
  const yt = ticks(yMin, yMax, stage.h < 220 ? 3 : ny);
  return { xt, yt, xMin: Math.min(xMin, xt.values[0]), xMax: Math.max(xMax, xt.values[xt.values.length - 1]), yMin: Math.min(yMin, yt.values[0]), yMax: Math.max(yMax, yt.values[yt.values.length - 1]) };
}
function dots(ctx, f, pts, color, r = 3) {
  ctx.fillStyle = color;
  pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); });
}

/* ------------------------------------------------------------------ Izojarayonlar */

export function drawProcess(ctx, stage, d) {
  const c = stage.colors;
  const pts = d.pts;
  const cur = d.cur;
  let f, line, xs, ys, xLab, yLab, lab;
  if (d.proc === "T") {
    // p(V): p = νRT/V (kPa, L)
    const T = d.Tset, k = (d.nuR * T) / 1000 * 1000; // p[kPa] = νRT/V[L]
    const a = axes(stage, 0.4, 2.1, 0, Math.max(k / 0.55, ...pts.map((p) => p.p / 1000)) * 1.02);
    f = frame(ctx, stage, { xMin: 0.4, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values.filter((v) => v >= 0.4), yTicks: a.yt.values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "L", yLabel: "p, kPa" });
    line = (x) => k / x; xs = [0.4, a.xMax]; xLab = "V"; yLab = "p";
    lab = `Izoterma T = ${fmt(T, 0)} K: pV = ${fmt(k, 1)} J`;
    ctx.save(); clipTo(ctx, f.rect);
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2.25; ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const x = xs[0] + ((xs[1] - xs[0]) * i) / 120; const y = line(x); if (i === 0) ctx.moveTo(f.X(x), f.Y(y)); else ctx.lineTo(f.X(x), f.Y(y)); }
    ctx.stroke();
    dots(ctx, f, pts.map((p) => [p.V, p.p / 1000]), "rgba(234,88,12,0.55)", 2.6);
    ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(cur.V), f.Y(cur.p / 1000), 5.5, 0, TAU); ctx.fill();
    ctx.restore();
  } else {
    const isoBar = d.proc === "p";
    const slope = isoBar ? (d.pTarget ? (d.nuR / d.pTarget) * 1000 : 0) : (d.nuR / (d.Vset / 1000)) / 1000; // V[L]/T yoki p[kPa]/T
    const yMax0 = Math.max(slope * 820, ...pts.map((p) => (isoBar ? p.V : p.p / 1000)), 0.1);
    const a = axes(stage, 0, 850, 0, yMax0 * 1.05, 6, 4);
    f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "K", yLabel: isoBar ? "V, L" : "p, kPa" });
    ctx.save(); clipTo(ctx, f.rect);
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2.25;
    ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(100), f.Y(slope * 100)); ctx.stroke();
    ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(f.X(100), f.Y(slope * 100)); ctx.lineTo(f.X(a.xMax), f.Y(slope * a.xMax)); ctx.stroke();
    dots(ctx, f, pts.map((p) => [p.T, isoBar ? p.V : p.p / 1000]), "rgba(234,88,12,0.55)", 2.6);
    ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(cur.T), f.Y(isoBar ? cur.V : cur.p / 1000), 5.5, 0, TAU); ctx.fill();
    ctx.restore();
    tag(ctx, "0 K — absolyut nol", f.X(0) + 8, f.Y(0) - 14, { color: c.text3, bg: c.bg, font: "600 10.5px Inter, system-ui, sans-serif" });
    lab = isoBar ? `Izobara p = ${fmt((d.pTarget || 0) / 1000, 1)} kPa: V = (νR/p)·T` : `Izoxora V = ${fmt(d.Vset, 2)} L: p = (νR/V)·T`;
  }
  legend(ctx, [{ color: c.primary, label: lab }, { color: c.warning, label: "o‘lchov" }], f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Maksvell */

export function drawSpeeds(ctx, stage, d) {
  const c = stage.colors;
  const total = d.hist.reduce((a, v) => a + v, 0);
  if (total < 1) return message(ctx, stage, "Ma’lumot yig‘ilmoqda…");
  const bw = d.vmaxReal / d.bins;
  const dens = d.hist.map((v) => v / (total * bw)); // ehtimollik zichligi (1/(m/s))
  const v2 = d.vRms * d.vRms;
  const peak = Math.max(...dens, maxwell2D(Math.sqrt(v2 / 2), v2));
  const a = axes(stage, 0, d.vmaxReal, 0, peak * 1.12, 6, 4);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v * 1000, 2), xUnit: "m/s", yLabel: "f(v)" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.fillStyle = "rgba(59,130,246,0.35)"; ctx.strokeStyle = "rgba(59,130,246,0.8)"; ctx.lineWidth = 1;
  dens.forEach((y, k) => { const x0 = f.X(k * bw), x1 = f.X((k + 1) * bw); ctx.fillRect(x0 + 0.5, f.Y(y), x1 - x0 - 1, f.Y(0) - f.Y(y)); });
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 160; i++) { const v = (a.xMax * i) / 160, y = maxwell2D(v, v2); if (i === 0) ctx.moveTo(f.X(v), f.Y(y)); else ctx.lineTo(f.X(v), f.Y(y)); }
  ctx.stroke();
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1.25; ctx.strokeStyle = c.text2;
  ctx.beginPath(); ctx.moveTo(f.X(d.vRms), f.rect.y); ctx.lineTo(f.X(d.vRms), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  tag(ctx, `v_kv = ${fmt(d.vRms, 0)} m/s`, f.X(d.vRms) + 6, f.rect.y + 14, { color: c.text, bg: c.bg, font: small });
  legend(ctx, [{ color: "rgba(59,130,246,0.8)", label: d.name }, { color: c.danger, label: "Maksvell taqsimoti" }], f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Bosim vaqt bo'yicha */

export function drawPressureTime(ctx, stage, d) {
  const c = stage.colors, pt = d.pt;
  if (pt.length < 2) return message(ctx, stage, "O‘lchanmoqda…");
  const t0 = pt[0].t, t1 = pt[pt.length - 1].t;
  const ps = pt.map((p) => p.p / 1000), pids = pt.map((p) => p.pid / 1000);
  const a = axes(stage, 0, Math.max(t1 - t0, 5), 0, Math.max(...ps, ...pids) * 1.15, 6, 4);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "s", yLabel: "p, kPa" });
  ctx.save(); clipTo(ctx, f.rect);
  const path = (key, color, width, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
    pt.forEach((p, k) => { const x = f.X(p.t - t0), y = f.Y(p[key] / 1000); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
  };
  path("p", "rgba(59,130,246,0.55)", 1.25);
  path("pe", c.warning, 2.5);
  path("pid", c.text2, 1.5, [6, 5]);
  ctx.restore();
  legend(ctx, [{ color: "rgba(59,130,246,0.7)", label: "har 0,1 s" }, { color: c.warning, label: "o‘rtacha (manometr)" }, { color: c.text2, label: "νRT/V", dash: [6, 5] }], f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Diffuziya */

export function drawMixing(ctx, stage, d) {
  const c = stage.colors;
  if (d.barrier || d.mix.length < 2) return message(ctx, stage, d.barrier ? "To‘siqni oling — aralashish shu yerda ko‘rinadi" : "Kuzatilmoqda…");
  const tEnd = d.mix[d.mix.length - 1].t;
  const a = axes(stage, 0, Math.max(tEnd, 5), 0, 110, 6, 5);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: 110, xTicks: a.xt.values, yTicks: [0, 25, 50, 75, 100], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "s", yLabel: "aralashish, %" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.text3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(100)); ctx.lineTo(f.X(a.xMax), f.Y(100)); ctx.stroke(); ctx.setLineDash([]);
  ["a", "b"].forEach((k, i) => {
    ctx.strokeStyle = d.colors[i]; ctx.lineWidth = 2.25; ctx.beginPath();
    d.mix.forEach((p, j) => { const x = f.X(p.t), y = f.Y(p[k] * 100); if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  });
  ctx.restore();
  legend(ctx, d.names.map((n, i) => ({ color: d.colors[i], label: `${n.split(" (")[0]} — narigi yarmida` })), f.padL + 56, 9, c);
}

export function drawProfile(ctx, stage, d) {
  const { w, h, colors: c } = stage;
  const f = frame(ctx, stage, { xMin: 0, xMax: d.frac.length, yMin: 0, yMax: 1.05, xTicks: [], yTicks: [0, 0.5, 1], fmtX: () => "", fmtY: (v) => `${fmt(v * 100, 0)}%`, yLabel: "1-gaz ulushi" });
  const bw = f.rect.w / d.frac.length;
  d.frac.forEach((v, k) => {
    const x = f.rect.x + k * bw;
    ctx.fillStyle = d.colors[1]; ctx.globalAlpha = 0.35; ctx.fillRect(x + 1, f.Y(1), bw - 2, f.Y(v) - f.Y(1));
    ctx.fillStyle = d.colors[0]; ctx.globalAlpha = 0.8; ctx.fillRect(x + 1, f.Y(v), bw - 2, f.Y(0) - f.Y(v));
  });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.rect.x + f.rect.w / 2, f.rect.y); ctx.lineTo(f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.text3; ctx.font = small; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("← chap", f.rect.x + f.rect.w * 0.25, f.rect.y + f.rect.h + 9); ctx.fillText("o‘ng →", f.rect.x + f.rect.w * 0.75, f.rect.y + f.rect.h + 9);
  void w; void h;
}

/* ------------------------------------------------------------------ Broun */

export function drawMSD(ctx, stage, d) {
  const c = stage.colors, u = d.unit;
  if (!d.pts.length) return message(ctx, stage, "Zarraning yo‘li yozilmoqda…");
  const xs = d.pts.map((p) => p.t), ys = d.pts.map((p) => p.r2 / (u * u));
  const a = axes(stage, 0, Math.max(...xs), 0, Math.max(...ys, d.D ? (4 * d.D * Math.max(...xs)) / (u * u) : 0) * 1.1, 6, 4);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, dec(a.xt.step)), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "s", yLabel: "⟨r²⟩, d²" });
  ctx.save(); clipTo(ctx, f.rect);
  if (d.D) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(a.xMax), f.Y((4 * d.D * a.xMax) / (u * u))); ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle = c.warning; ctx.lineWidth = 2.25; ctx.beginPath();
  d.pts.forEach((p, k) => { const x = f.X(p.t), y = f.Y(p.r2 / (u * u)); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.warning, label: "o‘lchangan ⟨r²⟩" }, { color: c.primary, label: "4Dτ (to‘g‘ri chiziq)", dash: [6, 5] }], f.padL + 56, 9, c);
}

export function drawBrownX(ctx, stage, d) {
  const c = stage.colors, tr = d.tr, u = d.unit;
  if (tr.length < 2) return message(ctx, stage, "Zarraning yo‘li yozilmoqda…");
  const t0 = tr[0][2];
  const xs = tr.map((p) => (p[0] - d.x0) / u);
  const lim = Math.max(1, ...xs.map(Math.abs)) * 1.15;
  const a = axes(stage, 0, Math.max(tr[tr.length - 1][2] - t0, 2), -lim, lim, 6, 4);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: a.yMin, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, dec(a.xt.step)), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "s", yLabel: "x − x₀, d" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.75; ctx.beginPath();
  tr.forEach((p, k) => { const x = f.X(p[2] - t0), y = f.Y((p[0] - d.x0) / u); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke(); ctx.restore();
  void clamp;
}
