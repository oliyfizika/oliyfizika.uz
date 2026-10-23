// ==========================================================================
// Issiqlik almashinuvi grafiklari: kalorimetr t(τ), issiqlik balansi, isitish egri chizig'i, bosqichlar bo'yicha Q.
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag, clamp } from "./sim-kit.js";

const TAU = Math.PI * 2;
const small = "600 11px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
const kJ = (Q) => (Math.abs(Q) >= 1e6 ? `${fmt(Q / 1e6, 2)} MJ` : Math.abs(Q) >= 1000 ? `${fmt(Q / 1000, Math.abs(Q) >= 1e5 ? 0 : 1)} kJ` : `${fmt(Q, 0)} J`);

function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function message(ctx, stage, text) {
  const { w, h, colors: c } = stage;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c.text3; ctx.font = "500 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
}
/** Vaqt o'qi: katta bo'lsa — minutlarda. */
function timeAxis(tMax, stage) {
  const useMin = tMax > 300;
  const k = useMin ? 60 : 1;
  const xt = ticks(0, tMax / k, stage.w < 480 ? 4 : 6);
  const xMax = Math.max(xt.values[xt.values.length - 1], tMax / k);
  return { k, xt, xMax, unit: useMin ? "min" : "s" };
}

/* ------------------------------------------------------------------ Kalorimetr: t(τ) */

export function drawMixTemps(ctx, stage, d) {
  const c = stage.colors;
  const hist = d.hist;
  const Ts = hist.flatMap((p) => p.T);
  const eqT = d.eq ? d.eq.T : null;
  const lo = Math.min(...Ts, eqT ?? Infinity), hi = Math.max(...Ts, eqT ?? -Infinity);
  const pad = Math.max(2, (hi - lo) * 0.08);
  const yt = ticks(lo - pad, hi + pad, stage.h < 230 ? 3 : 4);
  const yMin = Math.min(yt.values[0], lo - pad), yMax = Math.max(yt.values[yt.values.length - 1], hi + pad);
  const tEnd = Math.max(hist.length ? hist[hist.length - 1].t : 0, 10);
  const ax = timeAxis(tEnd * 1.05, stage);
  const f = frame(ctx, stage, {
    xMin: 0, xMax: ax.xMax, yMin, yMax, xTicks: ax.xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, dec(ax.xt.step)), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: ax.unit, yLabel: "t, °C",
  });
  ctx.save(); clipTo(ctx, f.rect);
  if (eqT !== null) {
    ctx.strokeStyle = c.text3; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(eqT)); ctx.lineTo(f.X(ax.xMax), f.Y(eqT)); ctx.stroke(); ctx.setLineDash([]);
  }
  d.bodies.forEach((b, i) => {
    ctx.strokeStyle = b.color; ctx.lineWidth = b.cup ? 1.75 : 2.5; if (b.cup) ctx.setLineDash([3, 3]);
    ctx.beginPath();
    hist.forEach((p, k) => { const x = f.X(p.t / ax.k), y = f.Y(p.T[i]); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    if (!d.started && hist.length) ctx.lineTo(f.X(ax.xMax * 0.04), f.Y(hist[0].T[i]));
    ctx.stroke(); ctx.setLineDash([]);
    const last = hist[hist.length - 1];
    if (last) { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(f.X(last.t / ax.k), f.Y(last.T[i]), 4, 0, TAU); ctx.fill(); }
  });
  ctx.restore();
  if (eqT !== null) tag(ctx, `θ = ${fmt(eqT, 1)} °C (nazariy)`, f.rect.x + f.rect.w - 8, clamp(f.Y(eqT) - 14, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text2, bg: c.bg, align: "right", font: small });
  legend(ctx, d.bodies.map((b) => ({ color: b.color, label: b.label, dash: b.cup ? [3, 3] : null })), f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Kalorimetr: balans */

export function drawMixBalance(ctx, stage, d) {
  const { w, h, colors: c } = stage;
  const items = d.bodies.map((b) => ({ label: b.label, color: b.color, Q: b.m * (b.h - b.h0) }));
  if (d.loss) items.push({ label: "Atrofga", color: c.text3, Q: d.lost });
  const max = Math.max(1, ...items.map((it) => Math.abs(it.Q)));
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const padL = Math.min(150, w * 0.3), padR = 10, padT = 18, padB = 26;
  const rowH = Math.min(40, (h - padT - padB) / items.length);
  const x0 = padL + (w - padL - padR) / 2, half = (w - padL - padR) / 2 - 64;
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, padT - 4); ctx.lineTo(Math.round(x0) + 0.5, padT + rowH * items.length); ctx.stroke();
  ctx.font = small; ctx.textBaseline = "middle";
  items.forEach((it, i) => {
    const y = padT + rowH * (i + 0.5), bw = (Math.abs(it.Q) / max) * half;
    ctx.fillStyle = it.color; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.roundRect(it.Q >= 0 ? x0 : x0 - bw, y - rowH * 0.3, Math.max(bw, 1.5), rowH * 0.6, 3); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = c.text2; ctx.textAlign = "right"; ctx.fillText(it.label, padL - 10, y);
    ctx.fillStyle = c.text; ctx.textAlign = it.Q >= 0 ? "left" : "right";
    ctx.fillText(`${it.Q >= 0 ? "+" : "−"}${kJ(Math.abs(it.Q))}`, it.Q >= 0 ? x0 + bw + 6 : x0 - bw - 6, y);
  });
  ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  const yb = Math.min(h - 6, padT + rowH * items.length + 22);
  ctx.fillText("← berdi (soviydi)", x0 - half / 2, yb); ctx.fillText("oldi (isiydi) →", x0 + half / 2, yb);
}

/* ------------------------------------------------------------------ Isitish egri chizig'i */

const PH_COLOR = (c) => ({ solid: c.primary, melting: c.special, liquid: c.warning, boiling: c.special, gas: c.danger, soft: c.special });

export function drawHeatCurve(ctx, stage, d) {
  const c = stage.colors, s = d.s;
  const hist = d.hist;
  if (!hist.length) return message(ctx, stage, "«Boshlash» tugmasini bosing");
  const Ts = hist.map((p) => p.T);
  const marks = [];
  if (!s.amorphous) { marks.push({ T: s.tm, label: `erish / qotish ${fmt(s.tm, 0)} °C` }); if (Number.isFinite(s.tb) && s.tb < d.Tmax + 1) marks.push({ T: s.tb, label: `qaynash ${fmt(s.tb, 0)} °C` }); }
  else marks.push({ T: s.tm, label: "yumshash boshlanadi" }, { T: s.t2, label: "to‘liq suyuq" });
  const lo = Math.min(...Ts, ...marks.map((m) => m.T)), hi = Math.max(...Ts, ...marks.map((m) => m.T));
  const pad = Math.max(3, (hi - lo) * 0.08);
  const yt = ticks(lo - pad, hi + pad, stage.h < 230 ? 4 : 5);
  const yMin = Math.min(yt.values[0], lo - pad), yMax = Math.max(yt.values[yt.values.length - 1], hi + pad);
  const tEnd = Math.max(hist[hist.length - 1].t, 30);
  const ax = timeAxis(tEnd * 1.05, stage);
  const f = frame(ctx, stage, {
    xMin: 0, xMax: ax.xMax, yMin, yMax, xTicks: ax.xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, dec(ax.xt.step)), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: ax.unit, yLabel: "t, °C",
  });
  ctx.save(); clipTo(ctx, f.rect);
  marks.forEach((m) => { ctx.strokeStyle = c.text3; ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(m.T)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(m.T)); ctx.stroke(); });
  ctx.setLineDash([]);
  const pc = PH_COLOR(c);
  ctx.lineWidth = 2.75; ctx.lineCap = "round";
  for (let k = 1; k < hist.length; k++) {
    const a = hist[k - 1], b = hist[k];
    ctx.strokeStyle = pc[b.ph] || c.primary;
    ctx.beginPath(); ctx.moveTo(f.X(a.t / ax.k), f.Y(a.T)); ctx.lineTo(f.X(b.t / ax.k), f.Y(b.T)); ctx.stroke();
  }
  // isitgich o'chirilgan joy
  const off = hist.findIndex((p) => p.on === false);
  if (off > 0) { ctx.strokeStyle = c.text3; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(f.X(hist[off].t / ax.k), f.rect.y); ctx.lineTo(f.X(hist[off].t / ax.k), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]); }
  const last = hist[hist.length - 1];
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(last.t / ax.k), f.Y(last.T), 5, 0, TAU); ctx.fill();
  ctx.restore();
  marks.forEach((m) => tag(ctx, m.label, f.rect.x + f.rect.w - 6, clamp(f.Y(m.T) - 12, f.rect.y + 10, f.rect.y + f.rect.h - 10), { color: c.text2, bg: c.bg, align: "right", font: "600 10.5px Inter, system-ui, sans-serif" }));
  if (off > 0) tag(ctx, "isitgich o‘chirildi", f.X(hist[off].t / ax.k) + 6, f.rect.y + f.rect.h - 14, { color: c.text3, bg: c.bg, font: "600 10.5px Inter, system-ui, sans-serif" });
  const items = s.amorphous ? [{ color: pc.solid, label: "qattiq" }, { color: pc.soft, label: "yumshash" }, { color: pc.liquid, label: "suyuq" }]
    : [{ color: pc.solid, label: "qattiq" }, { color: pc.melting, label: "erish / qaynash" }, { color: pc.liquid, label: "suyuq" }];
  legend(ctx, items, f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Bosqichlar bo'yicha Q */

export function drawHeatStages(ctx, stage, d) {
  const { w, h, colors: c } = stage;
  const q = d.stages;
  const items = [
    { label: "Q₁ qattiqni isitish", Q: q.heatSolid, color: c.primary },
    { label: d.s.amorphous ? "Q₂ yumshash" : "Q₂ erish (λm)", Q: q.melt, color: c.special },
    { label: "Q₃ suyuqni isitish", Q: q.heatLiquid, color: c.warning },
  ];
  if (!d.s.amorphous) items.push({ label: "Q₄ bug‘lanish (Lm)", Q: q.boil, color: c.danger });
  const sum = items.reduce((a, it) => a + it.Q, 0);
  items.push({ label: "Jami moddaga", Q: sum, color: c.text2, total: true });
  items.push({ label: d.fuel ? `Yoqilg‘i (qm)` : "Isitgich (Pτ)", Q: d.fuel ? d.fuel.m * d.fuel.q : d.Qin, color: c.success, total: true });
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const max = Math.max(1, ...items.map((it) => Math.abs(it.Q)));
  const padL = Math.min(150, w * 0.34), padR = 74, padT = 14, padB = 10;
  const rowH = Math.min(34, (h - padT - padB) / items.length);
  const pw = w - padL - padR;
  ctx.font = small; ctx.textBaseline = "middle";
  items.forEach((it, i) => {
    const y = padT + rowH * (i + 0.5), bw = (Math.abs(it.Q) / max) * pw;
    if (it.total && !items[i - 1]?.total) { ctx.strokeStyle = c.border; ctx.beginPath(); ctx.moveTo(padL - 140, y - rowH / 2); ctx.lineTo(w - 10, y - rowH / 2); ctx.stroke(); }
    ctx.fillStyle = it.color; ctx.globalAlpha = it.total ? 0.55 : 0.85;
    ctx.beginPath(); ctx.roundRect(padL, y - rowH * 0.3, Math.max(bw, 1.5), rowH * 0.6, 3); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = c.text2; ctx.textAlign = "right"; ctx.fillText(it.label, padL - 8, y);
    ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.fillText(kJ(it.Q), padL + bw + 6, y);
  });
}
