// ==========================================================================
// Bosim — grafiklar (simulations/pressure.html):
// bosimlarni taqqoslash (log shkala), gidravlik press F₂(F₁), suyuqlik bosimi p(h), U-naydagi bosim profili p(y).
// ==========================================================================

import { fmt, sci, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./pressure-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
const fmtPa = (p) => (p >= 1e6 ? `${sci(p / 1e6, 3)} MPa` : p >= 1e3 ? `${fmt(p / 1e3, 1)} kPa` : `${fmt(p, 0)} Pa`);
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}

/** Bosimlarni taqqoslash: o: { rows: [{ label, p, cur }], hover } — log₁₀p 2…9 */
export function drawCompare(ctx, st, o) {
  const { w, h, colors: c } = st;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const padL = w < 480 ? 110 : 150, padR = 74, top = 12, rh = Math.min(26, (h - top - 30) / o.rows.length), lo = 2, hi = 9;
  const X = (p) => padL + ((Math.log10(Math.max(p, 10 ** lo)) - lo) / (hi - lo)) * (w - padL - padR);
  last = { rect: { x: padL, y: top, w: w - padL - padR, h: o.rows.length * rh }, lo, hi };
  ctx.font = FONT; ctx.textBaseline = "middle";
  o.rows.forEach((r, i) => {
    const y = top + i * rh + rh / 2;
    ctx.fillStyle = r.cur ? c.text : c.text2; ctx.textAlign = "right"; ctx.fillText(r.label, padL - 8, y);
    ctx.fillStyle = r.cur ? c.warning : c.primary; ctx.globalAlpha = r.cur ? 1 : 0.55; ctx.fillRect(padL, y - rh * 0.3, X(r.p) - padL, rh * 0.6); ctx.globalAlpha = 1;
    ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.fillText(fmtPa(r.p), X(r.p) + 6, y);
  });
  const by = top + o.rows.length * rh + 4;
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, by); ctx.lineTo(w - padR, by); ctx.stroke();
  ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let e = lo; e <= hi; e++) { const x = X(10 ** e); ctx.fillRect(x, by, 1, 4); ctx.fillText(`10${"⁰¹²³⁴⁵⁶⁷⁸⁹"[e]}`, x, by + 6); }
  ctx.textAlign = "right"; ctx.fillText("p, Pa (log)", w - 6, by + 6);
  if (o.hover !== null && o.hover !== undefined) { const p = 10 ** (lo + o.hover * (hi - lo)), x = X(p); ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, by); ctx.stroke(); ctx.setLineDash([]); tag(ctx, `p = ${fmtPa(p)}`, clamp(x, padL + 50, w - 60), by - 14, { color: c.text, bg: c.bg2, align: "center", font: FONT }); }
}

/** Gidravlik press: F₂(F₁) = F₁·S₂/S₁. o: { S1, S2, F1, F1max, hover } */
export function drawPress(ctx, st, o) {
  const c = st.colors, k = o.S2 / o.S1, xMax = o.F1max, yMax = xMax * k * 1.08, kN = yMax > 3000, sc = kN ? 1e-3 : 1;
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax * sc, 4);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax: yMax * sc, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: `F₂, ${kN ? "kN" : "N"}`, xUnit: "F₁, N" });
  last = { ...f, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(xMax * sc)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(xMax * k * sc)); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.F1), f.Y(o.F1 * k * sc), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.primary, label: `F₂ = ${fmt(k, 0)}·F₁` }, { color: c.text3, label: "pressiz (F₂ = F₁)", dash: [4, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`F₁ = ${fmt(o.hover, 1)} N`, `F₂ = ${fmt(o.hover * k * sc, kN ? 2 : 0)} ${kN ? "kN" : "N"}`], c);
}

/** p(h): o: { liq (kalit), h (m), hMax, atm, hover } */
export function drawDepth(ctx, st, o) {
  const c = st.colors, base = o.atm ? P.P0 : 0, rhoMax = Math.max(P.LIQUIDS[o.liq].rho, 1030);
  const yMax = (base + P.hydro(rhoMax, o.hMax)) / 1000 * 1.08, xt = ticks(0, o.hMax * 100, st.w < 480 ? 4 : 5), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: o.hMax * 100, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: "p, kPa", xUnit: "h, cm" });
  last = { ...f, xMax: o.hMax * 100 };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const [k, L] of Object.entries(P.LIQUIDS)) {
    if (k === "mercury" && o.liq !== "mercury") continue;
    const cur = k === o.liq; ctx.strokeStyle = cur ? c.primary : c.text3; ctx.lineWidth = cur ? 2.8 : 1.2; ctx.setLineDash(cur ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(base / 1000)); ctx.lineTo(f.X(o.hMax * 100), f.Y((base + P.hydro(L.rho, o.hMax)) / 1000)); ctx.stroke(); ctx.setLineDash([]);
    if (!cur && st.w > 480) { ctx.font = "500 10px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text3; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(L.name, f.X(o.hMax * 100) - 4, f.Y((base + P.hydro(L.rho, o.hMax)) / 1000) - 2); }
  }
  ctx.restore();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.h * 100), f.Y((base + P.hydro(P.LIQUIDS[o.liq].rho, o.h)) / 1000), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.primary, label: `${P.LIQUIDS[o.liq].name}: p = ${o.atm ? "p₀ + " : ""}ρgh` }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) { const hh = o.hover / 100; hoverLine(ctx, f, f.X(o.hover), [`h = ${fmt(o.hover, 1)} cm`, `p = ${fmtPa(base + P.hydro(P.LIQUIDS[o.liq].rho, hh))}`], c); }
}

/** U-nay: bosim balandlik bo'yicha har tirsakda. o: { arms: [{ label, color, layers: [{ top, bottom, rho }] }], yMax (m), hover } — y — tubdan */
export function drawProfiles(ctx, st, o) {
  // y balandlikdagi bosim: ustidagi har qatlam qo'shadi ρ·g·(qatlamning y dan yuqoridagi qalinligi)
  const c = st.colors, pAt = (arm, y) => arm.layers.reduce((s, L) => s + L.rho * P.G * Math.max(0, L.top - Math.max(y, L.bottom)), 0);
  const pMax = Math.max(...o.arms.map((a) => pAt(a, 0))) / 1000 * 1.12 || 1;
  const xt = ticks(0, pMax, st.w < 480 ? 4 : 5), yt = ticks(0, o.yMax * 100, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: pMax, yMin: 0, yMax: o.yMax * 100, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 2), fmtY: (v) => fmt(v, 0), yLabel: "y, cm (tubdan)", xUnit: "p, kPa" });
  last = { ...f, xMax: pMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const a of o.arms) {
    const top = Math.max(...a.layers.map((L) => L.top));
    ctx.strokeStyle = a.color; ctx.lineWidth = 2.6; ctx.setLineDash(a.dash || []); ctx.beginPath();
    for (let k = 0; k <= 200; k++) { const y = (top * k) / 200, p = pAt(a, y) / 1000; if (k) ctx.lineTo(f.X(p), f.Y(y * 100)); else ctx.moveTo(f.X(p), f.Y(y * 100)); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  legend(ctx, o.arms.map((a) => ({ color: a.color, label: a.label, dash: a.dash })), f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`p = ${fmt(o.hover, 3)} kPa`, ...o.arms.map((a) => { const top = Math.max(...a.layers.map((L) => L.top)); let lo = 0, hi = top; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (pAt(a, m) / 1000 > o.hover) lo = m; else hi = m; } return `${a.label}: y = ${fmt(lo * 100, 1)} cm`; })], c);
}
