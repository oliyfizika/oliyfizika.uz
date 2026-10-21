// ==========================================================================
// Dispersiya va qutblanish grafiklari: n(λ), prizmada og'ish δ(λ), tomchida og'ish (kamalak), Malyus qonuni (lab).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag } from "./sim-kit.js";
import * as P from "./dispersion-physics.js";
import { prismDeviation } from "./reflection-physics.js";
import { waveRGB } from "./diffraction-physics.js";

const TAU = Math.PI * 2;
const small = "600 10px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
const css = (c) => `rgb(${Math.round(255 * c[0])},${Math.round(255 * c[1])},${Math.round(255 * c[2])})`;
/** Spektr rangidagi egri chiziq (x — λ nm). */
function specCurve(ctx, f, fn, w = 3) {
  for (let l = 380; l < 750; l += 4) { const y0 = fn(l), y1 = fn(l + 4); if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue; ctx.strokeStyle = css(waveRGB(l + 2)); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(f.X(l), f.Y(y0)); ctx.lineTo(f.X(l + 4), f.Y(y1)); ctx.stroke(); }
}
const range = (vals, pad = 0.08) => { const a = Math.min(...vals), b = Math.max(...vals), d = Math.max(1e-6, b - a); return [a - d * pad, b + d * pad]; };

export function drawN(ctx, st, { gid, nm }) {
  const c = st.colors, g = P.glass(gid);
  const [y0, y1] = range([P.nOf(g, 380), P.nOf(g, 750)], 0.15), yt = ticks(y0, y1, 4);
  const f = frame(ctx, st, { xMin: 380, xMax: 750, yMin: y0, yMax: y1, xTicks: [400, 450, 500, 550, 600, 650, 700, 750], yTicks: yt.values.filter((v) => v >= y0 && v <= y1), fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 3), xUnit: "nm", yLabel: "n" });
  ctx.save(); clipTo(ctx, f.rect); specCurve(ctx, f, (l) => P.nOf(g, l)); if (nm) dot(ctx, f, nm, P.nOf(g, nm), c.text, 5); ctx.restore();
  legend(ctx, [{ color: c.text2, label: `${g.name}: n = A + B/λ², Abbe soni V = ${fmt(P.abbe(g), 0)}` }], f.padL + 56, 9, c);
}

export function drawDev(ctx, st, { gid, A, alpha }) {
  const c = st.colors, g = P.glass(gid);
  const d = (l) => { const r = prismDeviation(A, P.nOf(g, l), alpha); return r.tir ? NaN : r.delta; };
  const vals = []; for (let l = 380; l <= 750; l += 10) { const v = d(l); if (Number.isFinite(v)) vals.push(v); }
  const [y0, y1] = vals.length ? range(vals, 0.2) : [0, 1], yt = ticks(y0, y1, 4);
  const f = frame(ctx, st, { xMin: 380, xMax: 750, yMin: y0, yMax: y1, xTicks: [400, 450, 500, 550, 600, 650, 700, 750], yTicks: yt.values.filter((v) => v >= y0 && v <= y1), fmtX: (v) => fmt(v, 0), fmtY: (v) => `${fmt(v, dec(yt.step))}°`, xUnit: "nm", yLabel: "δ" });
  ctx.save(); clipTo(ctx, f.rect); specCurve(ctx, f, d); ctx.restore();
  const s = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  legend(ctx, [{ color: c.text2, label: vals.length ? `og‘ish δ(λ), spektr kengligi ${fmt(s, 2)}° (A = ${fmt(A, 0)}°, α = ${fmt(alpha, 0)}°)` : "to‘liq ichki qaytish — nur chiqmaydi" }], f.padL + 56, 9, c);
}

/** Tomchida og'ish: b bo'yicha, qizil va binafsha uchun; k = 1 yoki 2. */
export function drawDrop(ctx, st, { b, k }) {
  const c = st.colors, w = P.glass("water"), nR = P.nOf(w, 700), nV = P.nOf(w, 400);
  const ang = (bb, n) => { const D = P.dropDeviation(bb, n, k); return k % 2 ? 180 - D : D - 180; };
  const y0 = k === 1 ? 0 : 0, y1 = k === 1 ? 45 : 70;
  const f = frame(ctx, st, { xMin: 0, xMax: 1, yMin: y0, yMax: y1, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], yTicks: ticks(y0, y1, 5).values, fmtX: (v) => fmt(v, 1), fmtY: (v) => `${fmt(v, 0)}°`, xUnit: "b/R", yLabel: "θ" });
  ctx.save(); clipTo(ctx, f.rect);
  [[nR, [0.9, 0.1, 0.1]], [nV, [0.5, 0.2, 0.95]]].forEach(([n, col]) => {
    ctx.strokeStyle = css(col); ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const bb = i / 300 * 0.9999, v = ang(bb, n); i ? ctx.lineTo(f.X(bb), f.Y(v)) : ctx.moveTo(f.X(bb), f.Y(v)); }
    ctx.stroke();
    const rb = P.rainbowAngle(n, k);
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(rb.angle)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(rb.angle)); ctx.stroke(); ctx.setLineDash([]);
    dot(ctx, f, b, ang(b, n), css(col), 5);
  });
  ctx.restore();
  const rR = P.rainbowAngle(nR, k).angle, rV = P.rainbowAngle(nV, k).angle;
  legend(ctx, [{ color: "#e11d48", label: `qizil: ${k === 1 ? "eng katta" : "eng kichik"} burchak ${fmt(rR, 1)}°` }, { color: "#7c3aed", label: `binafsha: ${fmt(rV, 1)}°` }], f.padL + 56, 9, c);
  tag(ctx, "nurlar shu burchak atrofida to‘planadi → kamalak", f.rect.x + f.rect.w - 4, f.Y(rR) - 12, { color: c.text2, bg: c.bg, align: "right", font: small });
}

/** Malyus qonuni: I/I₀ (analizatordan keyin) ikki polyaroid o'qlari orasidagi burchakka bog'liq; lab nuqtalari. */
export function drawMalus(ctx, st, { theta, pts, three, mid }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: 0, xMax: 180, yMin: 0, yMax: 0.55, xTicks: [0, 30, 60, 90, 120, 150, 180], yTicks: [0, 0.125, 0.25, 0.375, 0.5], fmtX: (v) => `${fmt(v, 0)}°`, fmtY: (v) => fmt(v, 3), xUnit: "θ", yLabel: "I/I₀" });
  ctx.save(); clipTo(ctx, f.rect);
  const fn = (t) => (three ? P.malusChain([0, mid, t])[2] : 0.5 * Math.cos(t * Math.PI / 180) ** 2);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 360; i++) { const t = i / 2; i ? ctx.lineTo(f.X(t), f.Y(fn(t))) : ctx.moveTo(f.X(t), f.Y(fn(t))); }
  ctx.stroke();
  pts.forEach((p) => dot(ctx, f, p.t, p.I, c.success, 5));
  const tt = ((theta % 180) + 180) % 180; dot(ctx, f, tt, fn(tt), c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: three ? `uch polyaroid (o‘rtadagisi ${fmt(mid, 0)}°)` : "I = (I₀/2)·cos²θ" }, ...(pts.length ? [{ color: c.success, label: `o‘lchovlar: ${pts.length} ta` }] : [])], f.padL + 56, 9, c);
}
