// ==========================================================================
// Elektromagnit tebranishlar va o'zgaruvchan tok — virtual laboratoriya (simulations/lc.html)
// 1) LC kontur: kalit 1 — kondensator batareyadan zaryadlanadi, kalit 2 — kontur tebranadi (R bilan so'nadi),
//    kondensator maydoni, g'altak maydoni, tok, energiya ustunlari, prujinali mayatnik bilan o'xshashlik.
// 2) O'zgaruvchan tok: R, C, L yoki ketma-ket RLC; vektor (fazor) diagramma, generator dastagi bilan chastota.
// 3) Rezonans: lampa + g'altak + o'zgaruvchan kondensator, radio shkalasi, I(f) lab o'lchovlari.
// Fizika: lc-physics.js (Node'da tekshirilgan). Grafiklar: lc-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./lc-physics.js";
import * as G from "./lc-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BLUE = "#2563eb", RED = "#ef4444", TEAL = "#14b8a6", VIOLET = "#8b5cf6";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "lc", tab: "qi", speed: 0.02, show: { mech: true }, vis: 0 };
const lc = { L: 0.5, C: 200e-6, R: 0, E: 6, sw: 1, q: 0, i: 0, t: 0, heat: 0, hist: [], dots: 0 };
const ac = { el: "R", f: 50, U: 10, R: 100, L: 0.2, C: 20e-6, dots: 0 };
const rs = { f: 120, C: 10e-6, L: 0.1, R: 20, U: 10 * Math.SQRT2, pts: [], dots: 0 };
let presetId = null;

const Tlc = () => P.thomson(lc.L, lc.C);
const qMax = () => lc.C * lc.E;
const iMax = () => qMax() / Math.sqrt(lc.L * lc.C);
function acElems() {
  const e = ac.el;
  return { R: e === "R" || e === "RLC" ? ac.R : 0, L: e === "L" || e === "RLC" ? ac.L : 0, C: e === "C" || e === "RLC" ? ac.C : Infinity };
}
const acState = () => P.acSeries(acElems(), ac.U, ac.f);
const rsState = (f = rs.f) => P.acSeries({ R: rs.R, L: rs.L, C: rs.C }, rs.U, f);

/* ------------------------------------------------------------------ Chizish yordamchilari */

function wire(ctx, c, pts, w = 2.5) { ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore(); }
function gap(ctx, c, x, y, w, h) { ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2, y - h / 2, w, h); }
function battery(ctx, c, x, y, vertical = true) {
  gap(ctx, c, x, y, 34, 18);
  ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 16, y - 5); ctx.lineTo(x + 16, y - 5); ctx.stroke();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 8, y + 5); ctx.lineTo(x + 8, y + 5); ctx.stroke(); ctx.restore();
  void vertical;
}
function resistorV(ctx, c, x, y, len = 44, color) {
  gap(ctx, c, x, y, 18, len); ctx.save(); ctx.strokeStyle = color || c.text; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y - len / 2);
  for (let k = 0; k <= 6; k++) ctx.lineTo(x + (k % 2 ? 7 : -7) * (k === 0 || k === 6 ? 0 : 1), y - len / 2 + (k * len) / 6); ctx.stroke(); ctx.restore();
}
function resistorH(ctx, c, x, y, len = 44, color) {
  gap(ctx, c, x, y, len, 18); ctx.save(); ctx.strokeStyle = color || c.text; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - len / 2, y);
  for (let k = 0; k <= 6; k++) ctx.lineTo(x - len / 2 + (k * len) / 6, y + (k % 2 ? 7 : -7) * (k === 0 || k === 6 ? 0 : 1)); ctx.stroke(); ctx.restore();
}
function coilV(ctx, c, x, y, len, color) {
  gap(ctx, c, x, y, 20, len); ctx.save(); ctx.strokeStyle = color || c.text; ctx.lineWidth = 2.4; ctx.beginPath();
  const n = 5, h = len / n; ctx.moveTo(x, y - len / 2);
  for (let k = 0; k < n; k++) { const y0 = y - len / 2 + k * h; ctx.bezierCurveTo(x + 14, y0, x + 14, y0 + h, x, y0 + h); }
  ctx.stroke(); ctx.restore();
}
function coilH(ctx, c, x, y, len, color) {
  gap(ctx, c, x, y, len, 22); ctx.save(); ctx.strokeStyle = color || c.text; ctx.lineWidth = 2.4; ctx.beginPath();
  const n = 5, w = len / n; ctx.moveTo(x - len / 2, y);
  for (let k = 0; k < n; k++) { const x0 = x - len / 2 + k * w; ctx.bezierCurveTo(x0, y - 14, x0 + w, y - 14, x0 + w, y); }
  ctx.stroke(); ctx.restore();
}
function capV(ctx, c, x, y, w = 34, color) { gap(ctx, c, x, y, w + 4, 14); ctx.save(); ctx.strokeStyle = color || c.text; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x - w / 2, y - 6); ctx.lineTo(x + w / 2, y - 6); ctx.moveTo(x - w / 2, y + 6); ctx.lineTo(x + w / 2, y + 6); ctx.stroke(); ctx.restore(); }
function capH(ctx, c, x, y, h = 34, color) { gap(ctx, c, x, y, 14, h + 4); ctx.save(); ctx.strokeStyle = color || c.text; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x - 6, y - h / 2); ctx.lineTo(x - 6, y + h / 2); ctx.moveTo(x + 6, y - h / 2); ctx.lineTo(x + 6, y + h / 2); ctx.stroke(); ctx.restore(); }
function generator(ctx, c, x, y, r = 22) {
  ctx.save(); ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); for (let k = 0; k <= 30; k++) { const t = k / 30, xx = x - r * 0.55 + t * r * 1.1, yy = y - Math.sin(t * TAU) * r * 0.3; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.restore();
}
function lamp(ctx, c, x, y, b) {
  if (b > 0.01) { const g = ctx.createRadialGradient(x, y, 2, x, y, 18 + 40 * b); g.addColorStop(0, `rgba(253,224,71,${0.9 * b})`); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18 + 40 * b, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.fillStyle = b > 0.05 ? `rgba(254,240,138,${0.4 + 0.6 * b})` : c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10); ctx.moveTo(x + 10, y - 10); ctx.lineTo(x - 10, y + 10); ctx.stroke(); ctx.restore();
}
/** Siniq chiziq bo'ylab harakatlanuvchi zaryadlar (tok yo'nalishini ko'rsatadi). */
function dotsAlong(ctx, pts, offset, color, spacing = 22) {
  const segs = []; let L = 0;
  for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); segs.push([pts[k - 1], pts[k], L, l]); L += l; }
  ctx.fillStyle = color;
  for (let s = ((offset % spacing) + spacing) % spacing; s < L; s += spacing) {
    const sg = segs.find((q) => s >= q[2] && s <= q[2] + q[3]); if (!sg) continue;
    const t = (s - sg[2]) / sg[3]; ctx.beginPath(); ctx.arc(sg[0][0] + (sg[1][0] - sg[0][0]) * t, sg[0][1] + (sg[1][1] - sg[0][1]) * t, 2.6, 0, TAU); ctx.fill();
  }
}
function bar(ctx, c, x, y, w, h, frac, color, label, value) {
  ctx.save(); ctx.fillStyle = c.bg2; ctx.fillRect(x, y, w, h); ctx.fillStyle = color; const hh = clamp(frac, 0, 1) * h; ctx.fillRect(x, y + h - hh, w, hh); ctx.strokeStyle = c.border; ctx.strokeRect(x, y, w, h); ctx.restore();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x + w / 2, y + h + 4); ctx.fillText(value, x + w / 2, y + h + 16);
}

/* ================================================================== 1) LC kontur */

const geo = {};
function drawLC(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const narrow = cw < 560, side = narrow ? 0 : cw * 0.34, aw = cw - side;
  const xB = aw * 0.13, xC = aw * 0.5, xL = aw * 0.86, yT = ch * 0.2, yB = ch * 0.84, yM = (yT + yB) / 2;
  Object.assign(geo, { xC, yT, sw: { x: xC, y: yT } });
  const qm = qMax(), im = iMax(), qn = lc.q / qm, inn = lc.i / im;
  const c1 = [xC - 40, yT], c2 = [xC + 40, yT];
  // simlar
  wire(ctx, c, [[xB, yM], [xB, yT], c1]);
  wire(ctx, c, [[xC, yT], [xC, yB]]);
  wire(ctx, c, [c2, [xL, yT], [xL, yB], [xB, yB], [xB, yM]]);
  // tok zaryadlari
  const loop2 = [[xC, yT], c2, [xL, yT], [xL, yB], [xC, yB], [xC, yT]], loop1 = [[xC, yB], [xB, yB], [xB, yT], c1, [xC, yT], [xC, yB]];
  if (lc.sw === 2) dotsAlong(ctx, loop2, lc.dots, c.warning); else dotsAlong(ctx, loop1, lc.dots, c.warning);
  // batareya
  battery(ctx, c, xB, yM); tag(ctx, `ε = ${fmt(lc.E, 1)} V`, xB + 22, yM, { color: c.text2, bg: c.bg, font: SMALL });
  // kondensator: maydon chiziqlari va zaryadlar
  const pw = 54;
  ctx.save(); ctx.strokeStyle = `rgba(37,99,235,${0.15 + 0.6 * Math.abs(qn)})`; ctx.lineWidth = 1.2;
  if (Math.abs(qn) > 0.03) for (let k = -2; k <= 2; k++) { const x = xC + k * 9; ctx.beginPath(); ctx.moveTo(x, yM - 9); ctx.lineTo(x, yM + 9); ctx.stroke(); }
  ctx.restore();
  capV(ctx, c, xC, yM, pw);
  const nq = Math.round(Math.abs(qn) * 6);
  ctx.font = "700 11px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let k = 0; k < nq; k++) { const x = xC - pw / 2 + 5 + (k * (pw - 10)) / 5; ctx.fillStyle = qn > 0 ? RED : BLUE; ctx.fillText(qn > 0 ? "+" : "−", x, yM - 14); ctx.fillStyle = qn > 0 ? BLUE : RED; ctx.fillText(qn > 0 ? "−" : "+", x, yM + 15); }
  tag(ctx, "C", xC - pw / 2 - 14, yM, { color: c.text2, bg: c.bg, align: "center", font: MID });
  // g'altak va magnit maydoni
  const coilLen = (yB - yT) * 0.42;
  if (Math.abs(inn) > 0.03) { ctx.save(); ctx.strokeStyle = `rgba(239,68,68,${0.15 + 0.6 * Math.abs(inn)})`; ctx.lineWidth = 1.3; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(xL + 7, yM, 10 + k * 8, coilLen * (0.55 + 0.12 * k), 0, 0, TAU); ctx.stroke(); } ctx.restore(); }
  coilV(ctx, c, xL, yM, coilLen);
  if (Math.abs(inn) > 0.05) tag(ctx, `B ${inn > 0 ? "↑" : "↓"}`, Math.min(xL + 30, cw - 30), yM - coilLen / 2 - 6, { color: RED, bg: c.bg, font: MID });
  tag(ctx, "L", xL - 16, yM, { color: c.text2, bg: c.bg, align: "center", font: MID });
  // qarshilik (pastki simda)
  if (lc.R > 0) { resistorH(ctx, c, (xC + xL) / 2, yB, 44); tag(ctx, `R = ${fmt(lc.R, 0)} Om`, (xC + xL) / 2, yB + 18, { color: c.text2, bg: c.bg, align: "center", font: SMALL }); }
  // kalit
  [c1, c2].forEach(([x, y], k) => { ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); ctx.stroke(); tag(ctx, String(k + 1), x, y - 16, { color: c.text2, bg: c.bg, align: "center", font: SMALL }); });
  const tgt = lc.sw === 1 ? c1 : c2;
  ctx.save(); ctx.strokeStyle = c.warning; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(xC, yT); ctx.lineTo(tgt[0], tgt[1] - 3); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(xC, yT, 6, 0, TAU); ctx.fill(); ctx.restore();
  tag(ctx, "kalit (bosing)", xC, yT - 18, { color: c.warning, bg: c.bg, align: "center", font: SMALL });
  // yon panel: energiya ustunlari va mexanik o'xshashlik
  const E0 = (qm * qm) / (2 * lc.C), en = P.energies(lc, lc.L, lc.C);
  if (!narrow) {
    const bx = aw + 12, bw = 26, by = 22, bh = ch * (ui.show.mech ? 0.36 : 0.6);
    bar(ctx, c, bx, by, bw, bh, en.WE / E0, BLUE, "W_E", `${fmt(en.WE * 1e3, 1)}`);
    bar(ctx, c, bx + 40, by, bw, bh, en.WM / E0, RED, "W_M", `${fmt(en.WM * 1e3, 1)}`);
    bar(ctx, c, bx + 80, by, bw, bh, lc.heat / E0, "#f59e0b", "issiqlik", `${fmt(lc.heat * 1e3, 1)}`);
    tag(ctx, "Energiya, mJ", bx + 120, by + 6, { color: c.text2, bg: c.bg, font: SMALL });
    if (ui.show.mech) {
      // prujinali mayatnik: x ∝ q, v ∝ i
      const my = ch * 0.8, mx0 = aw + 14, mx1 = cw - 14, eq = (mx0 + mx1) / 2 + 10, A = (mx1 - mx0) * 0.24, x = eq + A * qn;
      ctx.strokeStyle = c.text3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx0, my - 22); ctx.lineTo(mx0, my + 18); ctx.moveTo(mx0, my + 18); ctx.lineTo(mx1, my + 18); ctx.stroke();
      ctx.strokeStyle = c.text2; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(mx0, my); const coils = 10;
      for (let k = 1; k <= coils * 2; k++) ctx.lineTo(mx0 + ((x - 16 - mx0) * k) / (coils * 2), my + (k % 2 ? -7 : 7));
      ctx.lineTo(x - 16, my); ctx.stroke();
      ctx.fillStyle = c.primary; ctx.fillRect(x - 16, my - 15, 32, 32);
      ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(eq, my - 26); ctx.lineTo(eq, my + 18); ctx.stroke(); ctx.setLineDash([]);
      if (lc.R > 0) tag(ctx, "ishqalanish ↔ R", (mx0 + mx1) / 2, my + 32, { color: c.text3, bg: c.bg, align: "center", font: SMALL });
      tag(ctx, "Mexanik o‘xshashlik: x ↔ q, v ↔ i, k ↔ 1/C, m ↔ L", (mx0 + mx1) / 2, my - 40, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
    }
  }
  tag(ctx, `T = ${fmt(Tlc() * 1000, 1)} ms · vaqt ${fmt(1 / ui.speed, 0)} marta sekin`, 10, 14, { color: c.text, bg: c.bg2, font: SMALL });
}

/* ================================================================== 2) O'zgaruvchan tok */

function drawPhasors(ctx, c, cx, cy, R0, st, U, theta, rlc) {
  ctx.save(); ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(cx - R0 - 8, cy); ctx.lineTo(cx + R0 + 8, cy); ctx.moveTo(cx, cy - R0 - 8); ctx.lineTo(cx, cy + R0 + 8); ctx.stroke(); ctx.restore();
  const vec = (x0, y0, len, ang, col, lab, w = 3) => {
    const x1 = x0 + len * Math.cos(ang), y1 = y0 - len * Math.sin(ang);
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (len > 6) { const hd = 9, a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a - 0.4), y1 - hd * Math.sin(a - 0.4)); ctx.lineTo(x1 - hd * Math.cos(a + 0.4), y1 - hd * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    if (lab) tag(ctx, lab, x1 + 10 * Math.cos(ang), y1 - 10 * Math.sin(ang), { color: col, bg: c.bg, align: "center", font: "italic 700 11px Inter, system-ui, sans-serif", pad: 4 });
    return [x1, y1];
  };
  const k = R0 / U, aI = theta - st.phi, Ilen = R0 * 0.75;
  if (rlc) {
    let [x, y] = vec(cx, cy, st.UR * k, aI, c.text2, st.UR * k > 18 ? "U_R" : "", 2.5);
    [x, y] = vec(x, y, st.UL * k, aI + Math.PI / 2, TEAL, st.UL * k > 18 ? "U_L" : "", 2.5);
    vec(x, y, st.UC * k, aI - Math.PI / 2, VIOLET, st.UC * k > 18 ? "U_C" : "", 2.5);
  }
  vec(cx, cy, Ilen, aI, RED, "I");
  const [ux, uy] = vec(cx, cy, R0, theta, BLUE, "U");
  // proyeksiyalar — oniy qiymatlar
  ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = BLUE; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(cx + R0 + 14, uy); ctx.stroke();
  const iy = cy - Ilen * Math.sin(aI); ctx.strokeStyle = RED; ctx.beginPath(); ctx.moveTo(cx + Ilen * Math.cos(aI), iy); ctx.lineTo(cx + R0 + 14, iy); ctx.stroke(); ctx.restore();
  ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(cx + R0 + 14, uy, 4, 0, TAU); ctx.fill(); ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(cx + R0 + 14, iy, 4, 0, TAU); ctx.fill();
  if (Math.abs(st.phi) > 0.05) { ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 24, -theta, -aI, st.phi < 0); ctx.stroke(); ctx.restore(); tag(ctx, "φ", cx + 32 * Math.cos(theta - st.phi / 2), cy - 32 * Math.sin(theta - st.phi / 2), { color: c.text2, bg: c.bg, align: "center", font: "italic 700 12px Inter, system-ui, sans-serif", pad: 3 }); }
}
function drawAC(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const narrow = cw < 560, aw = narrow ? cw : cw * 0.58;
  const xG = aw * 0.14, xR = aw * 0.92, yT = ch * (narrow ? 0.14 : 0.2), yB = ch * (narrow ? 0.5 : 0.82), yM = (yT + yB) / 2;
  const st = acState(), theta = ui.vis, iNow = Math.sin(theta - st.phi);
  geo.gen = { x: xG, y: yM };
  wire(ctx, c, [[xG, yM - 22], [xG, yT], [xR, yT], [xR, yB], [xG, yB], [xG, yM + 22]]);
  dotsAlong(ctx, [[xG, yT], [xR, yT], [xR, yB], [xG, yB], [xG, yT]], ac.dots, c.warning);
  generator(ctx, c, xG, yM); tag(ctx, `${fmt(ac.f, 0)} Hz`, xG, yM + 36, { color: c.warning, bg: c.bg, align: "center", font: MID });
  ctx.save(); ctx.strokeStyle = c.warning; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(xG, yM, 28, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.stroke(); ctx.restore();
  const el = ac.el, items = el === "RLC" ? ["R", "L", "C"] : [el], span = xR - xG;
  items.forEach((it, k) => {
    const x = xG + span * ((k + 1) / (items.length + 1)), col = it === "R" ? c.text : it === "L" ? TEAL : VIOLET;
    if (it === "R") resistorH(ctx, c, x, yT, 46, col); else if (it === "L") coilH(ctx, c, x, yT, 50, col); else capH(ctx, c, x, yT, 30, col);
    const val = it === "R" ? `R = ${fmt(ac.R, 0)} Om` : it === "L" ? `X_L = ${fmt(st.XL, 0)} Om` : `X_C = ${fmt(st.XC, 0)} Om`;
    tag(ctx, val, x, yT - 24, { color: col, bg: c.bg, align: "center", font: SMALL });
  });
  // ampermetr
  const ax = (xG + xR) / 2;
  ctx.save(); ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, yB, 15, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = c.text; ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("A", ax, yB);
  tag(ctx, `I_ef = ${fmt(st.Ief * 1000, 1)} mA`, ax, yB + 26, { color: c.text, bg: c.bg2, align: "center", font: MID });
  tag(ctx, `u = ${fmt(ac.U * Math.sin(theta), 1)} V · i = ${fmt(st.I0 * iNow * 1000, 0)} mA (oniy)`, 10, 14, { color: c.text2, bg: c.bg2, font: SMALL });
  if (!narrow) drawPhasors(ctx, c, aw + (cw - aw) * 0.44, ch * 0.52, Math.min(ch * 0.34, (cw - aw) * 0.36), st, ac.U, theta, el === "RLC");
  else drawPhasors(ctx, c, cw * 0.5, ch * 0.78, ch * 0.17, st, ac.U, theta, el === "RLC");
}

/* ================================================================== 3) Rezonans */

const F_MIN = 20, F_MAX = 600;
function drawRes(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const xG = cw * 0.1, xR = cw * 0.9, yT = ch * 0.22, yB = ch * 0.6, yM = (yT + yB) / 2;
  const st = rsState(), f0 = P.resonanceF(rs.L, rs.C), b = (rs.R / st.Z) ** 2;
  wire(ctx, c, [[xG, yM - 22], [xG, yT], [xR, yT], [xR, yB], [xG, yB], [xG, yM + 22]]);
  dotsAlong(ctx, [[xG, yT], [xR, yT], [xR, yB], [xG, yB], [xG, yT]], rs.dots, c.warning);
  generator(ctx, c, xG, yM); tag(ctx, `${fmt(rs.f, 0)} Hz`, xG, yM + 36, { color: c.warning, bg: c.bg, align: "center", font: MID });
  const xs = [0.3, 0.55, 0.78].map((k) => xG + (xR - xG) * k);
  gap(ctx, c, xs[0], yT, 34, 34); lamp(ctx, c, xs[0], yT, clamp(b, 0, 1));
  coilH(ctx, c, xs[1], yT, 54, TEAL); capH(ctx, c, xs[2], yT, 32, VIOLET);
  // o'zgaruvchan kondensator belgisi va dastagi
  ctx.save(); ctx.strokeStyle = VIOLET; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(xs[2] - 18, yT + 18); ctx.lineTo(xs[2] + 18, yT - 18); ctx.lineTo(xs[2] + 11, yT - 17); ctx.moveTo(xs[2] + 18, yT - 18); ctx.lineTo(xs[2] + 17, yT - 11); ctx.stroke(); ctx.restore();
  const kn = { x: xs[2], y: yT + 52 }; geo.knob = kn;
  const ang = -Math.PI * 0.8 + ((Math.log(rs.C * 1e6) - Math.log(2)) / (Math.log(60) - Math.log(2))) * Math.PI * 1.6;
  ctx.save(); ctx.fillStyle = c.bg2; ctx.strokeStyle = VIOLET; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(kn.x, kn.y, 16, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(kn.x, kn.y); ctx.lineTo(kn.x + 13 * Math.sin(ang), kn.y - 13 * Math.cos(ang)); ctx.stroke(); ctx.restore();
  tag(ctx, `C = ${fmt(rs.C * 1e6, 1)} mkF ↔`, kn.x, kn.y + 28, { color: VIOLET, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, `U_L = ${fmt(st.UL / Math.SQRT2, 1)} V`, xs[1], yT - 26, { color: TEAL, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, `U_C = ${fmt(st.UC / Math.SQRT2, 1)} V`, xs[2], yT - 26, { color: VIOLET, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, `I = ${fmt(st.Ief * 1000, 0)} mA`, xs[0], yT - 26, { color: c.text, bg: c.bg, align: "center", font: SMALL });
  // radio shkalasi
  const sx0 = cw * 0.08, sx1 = cw * 0.92, sy = ch * 0.84, fx = (f) => sx0 + ((Math.log(f) - Math.log(F_MIN)) / (Math.log(F_MAX) - Math.log(F_MIN))) * (sx1 - sx0);
  ctx.save(); ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.beginPath(); ctx.roundRect(sx0 - 8, sy - 30, sx1 - sx0 + 16, 48, 8); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.font = "500 9px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top";
  [20, 50, 100, 200, 500].forEach((f) => { ctx.beginPath(); ctx.moveTo(fx(f), sy + 2); ctx.lineTo(fx(f), sy + 8); ctx.stroke(); ctx.fillText(String(f), fx(f), sy + 9); });
  // rezonans egri chizig'i shkalada
  ctx.strokeStyle = "rgba(34,197,94,0.7)"; ctx.lineWidth = 1.5; ctx.beginPath();
  const Imax = rs.U / Math.SQRT2 / rs.R;
  for (let k = 0; k <= 200; k++) { const f = Math.exp(Math.log(F_MIN) + (k / 200) * (Math.log(F_MAX) - Math.log(F_MIN))), v = rsState(f).Ief / Imax; const x = fx(f), y = sy - 2 - v * 25; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.restore();
  if (f0 >= F_MIN && f0 <= F_MAX) { ctx.fillStyle = c.success; ctx.beginPath(); ctx.moveTo(fx(f0), sy - 30); ctx.lineTo(fx(f0) - 5, sy - 38); ctx.lineTo(fx(f0) + 5, sy - 38); ctx.fill(); tag(ctx, `kontur f₀ = ${fmt(f0, 0)} Hz`, fx(f0), sy - 48, { color: c.success, bg: c.bg, align: "center", font: SMALL }); }
  ctx.strokeStyle = c.warning; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx(rs.f), sy - 28); ctx.lineTo(fx(rs.f), sy + 16); ctx.stroke();
  if (Math.abs(rs.f - f0) / f0 < 0.02) tag(ctx, "REZONANS", cw - 12, 14, { color: "#fff", bg: c.success, align: "right", font: "700 11px Inter, system-ui, sans-serif" });
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "lc") drawLC(ctx, stage); else if (ui.mode === "ac") drawAC(ctx, stage); else drawRes(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 270, 360)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  lc: [["qi", "q(t), i(t)", "Zaryad va tok", "Tok zaryaddan chorak davr orqada: kondensator to‘liq zaryadlanganda tok nolga teng, zaryadsizlanganda — eng katta."], ["en", "Energiya", "Energiya almashinuvi", "Elektr maydon energiyasi magnit maydon energiyasiga va aksincha aylanadi; R bo‘lsa, energiya issiqlikka o‘tib, tebranish so‘nadi."], ["th", "T(C)", "Tomson formulasi", "Sig‘im 4 marta oshsa, davr 2 marta ortadi: T = 2π√(LC)."]],
  ac: [["ui", "u(t), i(t)", "Kuchlanish va tok", "Aktiv qarshilikda tok va kuchlanish fazada; kondensatorda tok 90° oldinda, g‘altakda 90° orqada."], ["x", "X(f)", "Qarshiliklarning chastotaga bog‘liqligi", "X_L chastota bilan ortadi, X_C kamayadi; ular tenglashganda (rezonans) Z = R."]],
  res: [["i", "I(f)", "Rezonans egri chizig‘i (lab)", "Generator chastotasini o‘zgartirib, tokni o‘lchang va «O‘lchovni yozish» ni bosing. Tok f₀ da eng katta; R kichik bo‘lsa, egri chiziq o‘tkirroq."], ["u", "U_L, U_C", "G‘altak va kondensatordagi kuchlanish", "Rezonansda U_L = U_C va ular manba kuchlanishidan Q marta katta bo‘lishi mumkin."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  $("[data-meas-tools]").hidden = !(ui.mode === "res" && ui.tab === "i");
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "lc") {
    const span = 3 * Tlc();
    if (ui.tab === "en") return G.drawEnergy(ctx, st, { hist: lc.hist, span, E0: (qMax() * qMax()) / (2 * lc.C) });
    if (ui.tab === "th") return G.drawThomson(ctx, st, { L: lc.L, C: lc.C });
    return G.drawQI(ctx, st, { hist: lc.hist, qm: qMax(), im: iMax(), span });
  }
  if (ui.mode === "ac") {
    if (ui.tab === "x") { const e = acElems(); return G.drawReact(ctx, st, { R: e.R, L: ac.L, C: ac.C, f: ac.f, hasL: e.L > 0, hasC: Number.isFinite(e.C) }); }
    return G.drawUI(ctx, st, { ac: acState(), U: ac.U });
  }
  if (ui.tab === "u") return G.drawULC(ctx, st, { R: rs.R, L: rs.L, C: rs.C, U: rs.U, f: rs.f });
  return G.drawRes(ctx, st, { R: rs.R, L: rs.L, C: rs.C, U: rs.U, f: rs.f, pts: rs.pts });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const REG = { under: "so‘nuvchi tebranish", critical: "kritik (aperiodik chegara)", over: "aperiodik razryad" };
function updateReadouts() {
  if (ui.mode === "lc") {
    const T = Tlc(), en = P.energies(lc, lc.L, lc.C), reg = P.regime(lc.R, lc.L, lc.C), Q = P.qualityQ(lc.R, lc.L, lc.C);
    setRO("r1", "Davr <i>T</i>", `${fmt(T * 1000, 1)}<small>ms</small>`, `T = 2π√(LC), ν = ${fmt(1 / T, 1)} Hz`);
    setRO("r2", "Zaryad <i>q</i>", `${fmt(lc.q * 1000, 2)}<small>mC</small>`, `q_max = Cε = ${fmt(qMax() * 1000, 2)} mC`);
    setRO("r3", "Tok <i>i</i>", `${fmt(lc.i * 1000, 0)}<small>mA</small>`, `I_max = q_max/√(LC) = ${fmt(iMax() * 1000, 0)} mA`);
    setRO("r4", "Kondensator kuchlanishi", `${fmt(lc.q / lc.C, 2)}<small>V</small>`, "U = q/C");
    setRO("r5", "Energiya", `${fmt((en.WE + en.WM) * 1000, 2)}<small>mJ</small>`, `issiqlikka: ${fmt(lc.heat * 1000, 2)} mJ`);
    setRO("r6", "Rejim", lc.sw === 1 ? "zaryadlanish" : lc.R === 0 ? "erkin tebranish" : REG[reg], lc.sw === 1 ? "Kalitni 2-holatga buring" : lc.R === 0 ? "So‘nmaydi (R = 0)" : `Aslilik Q = ${fmt(Q, 1)}, R_kr = ${fmt(P.criticalR(lc.L, lc.C), 0)} Om`, lc.sw === 1 ? "muted" : "");
  } else if (ui.mode === "ac") {
    const st = acState(), e = ac.el;
    setRO("r1", e === "R" ? "Qarshilik <i>R</i>" : e === "C" ? "Sig‘im qarshiligi <i>X</i><sub>C</sub>" : e === "L" ? "Induktiv qarshilik <i>X</i><sub>L</sub>" : "To‘la qarshilik <i>Z</i>", `${fmt(e === "R" ? ac.R : e === "C" ? st.XC : e === "L" ? st.XL : st.Z, 1)}<small>Om</small>`, e === "C" ? `1/(2πfC), C = ${fmt(ac.C * 1e6, 0)} mkF` : e === "L" ? `2πfL, L = ${fmt(ac.L * 1000, 0)} mGn` : e === "RLC" ? `X_L = ${fmt(st.XL, 0)}, X_C = ${fmt(st.XC, 0)} Om` : "Chastotaga bog‘liq emas");
    setRO("r2", "Tok <i>I</i><sub>ef</sub>", `${fmt(st.Ief * 1000, 1)}<small>mA</small>`, `I₀ = ${fmt(st.I0 * 1000, 1)} mA`);
    setRO("r3", "Kuchlanish <i>U</i><sub>ef</sub>", `${fmt(st.Uef, 2)}<small>V</small>`, "U_ef = U₀/√2");
    const deg = (st.phi * 180) / Math.PI;
    setRO("r4", "Faza siljishi <i>φ</i>", `${fmt(deg, 0)}°`, Math.abs(deg) < 1 ? "Tok va kuchlanish fazada" : deg > 0 ? "Tok kuchlanishdan orqada" : "Tok kuchlanishdan oldinda");
    setRO("r5", "Quvvat <i>P</i>", `${fmt(st.P * 1000, 1)}<small>mW</small>`, `cos φ = ${fmt(st.cos, 2)}`);
    setRO("r6", "Chastota <i>f</i>", `${fmt(ac.f, 0)}<small>Hz</small>`, e === "RLC" ? `Rezonans f₀ = ${fmt(P.resonanceF(ac.L, ac.C), 0)} Hz` : `ω = ${fmt(st.w, 0)} rad/s`);
  } else {
    const st = rsState(), f0 = P.resonanceF(rs.L, rs.C), Q = P.qualityQ(rs.R, rs.L, rs.C), on = Math.abs(rs.f - f0) / f0 < 0.02;
    setRO("r1", "Rezonans chastota <i>f</i>₀", `${fmt(f0, 1)}<small>Hz</small>`, "f₀ = 1/(2π√(LC))");
    setRO("r2", "Generator <i>f</i>", `${fmt(rs.f, 0)}<small>Hz</small>`, on ? "Rezonans!" : rs.f < f0 ? "f < f₀ — sig‘im qarshiligi ustun" : "f > f₀ — induktiv qarshilik ustun", on ? "" : "muted");
    setRO("r3", "Tok <i>I</i><sub>ef</sub>", `${fmt(st.Ief * 1000, 1)}<small>mA</small>`, `Rezonansda ${fmt((rs.U / Math.SQRT2 / rs.R) * 1000, 0)} mA`);
    setRO("r4", "<i>U</i><sub>L</sub> / <i>U</i><sub>C</sub>", `${fmt(st.UL / Math.SQRT2, 1)} / ${fmt(st.UC / Math.SQRT2, 1)}<small>V</small>`, `Manba ${fmt(rs.U / Math.SQRT2, 1)} V`);
    setRO("r5", "Aslilik <i>Q</i>", fmt(Q, 1), `Δf = ${fmt(P.bandwidth(rs.R, rs.L), 1)} Hz`);
    setRO("r6", "Lampa quvvati", `${fmt(st.P, 2)}<small>W</small>`, `cos φ = ${fmt(st.cos, 2)}`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "lc") { t = lc.sw === 1 ? "Kondensator zaryadlanmoqda" : lc.R === 0 ? "Erkin tebranishlar" : REG[P.regime(lc.R, lc.L, lc.C)]; tone = lc.sw === 1 ? "orange" : "green"; }
  else if (ui.mode === "ac") { const d = (acState().phi * 180) / Math.PI; t = Math.abs(d) < 1 ? "φ = 0" : `φ = ${fmt(d, 0)}°`; }
  else { const f0 = P.resonanceF(rs.L, rs.C), on = Math.abs(rs.f - f0) / f0 < 0.02; t = on ? "Rezonans" : "Rezonansdan tashqarida"; tone = on ? "green" : "blue"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "lc") {
    p.push("<p>Kalit 1-holatda kondensator batareyadan zaryadlanadi va elektr maydon energiyasini to‘playdi. Kalit 2-holatga burilganda kondensator g‘altak orqali zaryadsizlanadi: tok o‘sadi, g‘altakda magnit maydon hosil bo‘ladi. O‘zinduksiya tufayli tok birdan to‘xtamaydi va kondensatorni teskari ishorada qayta zaryadlaydi — <b>elektromagnit tebranishlar</b> boshlanadi.</p>");
    p.push(lc.R > 0 ? `<p>Qarshilik R energiyani issiqlikka aylantiradi — tebranishlar <b>so‘nadi</b>. R ≥ ${fmt(P.criticalR(lc.L, lc.C), 0)} Om bo‘lsa, tebranish umuman bo‘lmaydi (aperiodik razryad).</p>` : "<p>R = 0 bo‘lsa, energiya saqlanadi va tebranishlar so‘nmaydi. Bu prujinali mayatnikka o‘xshaydi: zaryad — siljish, tok — tezlik, L — massa, 1/C — bikrlik.</p>");
  } else if (ui.mode === "ac") {
    const e = ac.el;
    if (e === "R") p.push("<p><b>Aktiv qarshilik</b>da tok va kuchlanish bir fazada o‘zgaradi; elektr energiyasi issiqlikka aylanadi. Qarshilik chastotaga bog‘liq emas.</p>");
    if (e === "C") p.push("<p><b>Kondensator</b> o‘zgaruvchan tokni o‘tkazadi: u har yarim davrda qayta zaryadlanadi. Tok kuchlanishdan chorak davr (90°) <b>oldinda</b>. Chastota oshgan sari sig‘im qarshiligi X_C = 1/(ωC) kamayadi. O‘rtacha quvvat nolga teng.</p>");
    if (e === "L") p.push("<p><b>G‘altak</b>da o‘zinduksiya EYuK tok o‘zgarishiga qarshilik qiladi — tok kuchlanishdan 90° <b>orqada</b>. Induktiv qarshilik X_L = ωL chastota bilan ortadi. O‘rtacha quvvat nolga teng.</p>");
    if (e === "RLC") p.push("<p>Ketma-ket zanjirda tok hamma elementda bir xil, kuchlanishlar esa vektorlar kabi qo‘shiladi: U_L va U_C qarama-qarshi yo‘nalgan. Vektor diagrammada U = U_R + U_L + U_C.</p>");
  } else {
    p.push("<p>Generator chastotasi kontur xususiy chastotasi f₀ ga teng bo‘lganda X_L = X_C, to‘la qarshilik eng kichik (Z = R) va tok eng katta bo‘ladi — <b>rezonans</b>. Lampa eng yorqin yonadi.</p><p>Radiopriyomnikda o‘zgaruvchan kondensator bilan konturning f₀ i kerakli radiostansiya chastotasiga sozlanadi.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "lc" ? "<small>Tomson formulasi</small> T = 2π√(LC)" : ui.mode === "ac" ? "<small>Om qonuni</small> I = U / Z" : "<small>Rezonans</small> f₀ = 1 / (2π√(LC))";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (ui.mode === "lc") {
    const T = Tlc(), simDt = dt * ui.speed, n = Math.max(1, Math.ceil(simDt / (T / 400))), h = simDt / n;
    for (let k = 0; k < n; k++) {
      if (lc.sw === 1) { const q0 = lc.q; lc.q = P.chargeStep(lc.q, h, { C: lc.C, emf: lc.E, r: T / (6 * lc.C) }); lc.i = (lc.q - q0) / h; }
      else { const s = P.rlcStep(lc, h, { L: lc.L, C: lc.C, R: lc.R }); lc.heat += lc.R * ((lc.i * lc.i + s.i * s.i) / 2) * h; lc.q = s.q; lc.i = s.i; }
      lc.t += h;
    }
    lc.dots += (lc.i / iMax()) * dt * 90 * (lc.sw === 2 ? 1 : -1);
    const en = P.energies(lc, lc.L, lc.C);
    lc.hist.push({ t: lc.t, q: lc.q, i: lc.i, WE: en.WE, WM: en.WM }); while (lc.hist.length && lc.hist[0].t < lc.t - 3.2 * T) lc.hist.shift();
  } else {
    ui.vis += dt * TAU * 0.35;
    if (ui.mode === "ac") { const st = acState(); ac.dots += Math.sin(ui.vis - st.phi) * dt * 120 * clamp(st.I0 / 0.1, 0.15, 1.5); }
    else { const st = rsState(); rs.dots += Math.sin(ui.vis - st.phi) * dt * 120 * clamp(st.Ief / 0.3, 0.05, 1.5); }
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode === "lc") graph.render(); }
}, {
  onStateChange(on) {
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
    playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  },
});
const playBtn = $("[data-play]");
playBtn.addEventListener("click", () => loop.toggle());

/* ------------------------------------------------------------------ Boshqaruv */

function toggleSwitch() { lc.sw = lc.sw === 1 ? 2 : 1; if (lc.sw === 2) lc.i = 0; customized(); if (!loop.running) loop.start(); refresh(); }
$("[data-switch]").addEventListener("click", toggleSwitch);
const kLC = bindRange($("#kL"), $("#kLOut"), (v) => `${fmt(v, 2)} Gn`, (v) => { lc.L = v; customized(); refresh(); });
const kCC = bindRange($("#kC"), $("#kCOut"), (v) => `${fmt(v, 0)} mkF`, (v) => { lc.C = v * 1e-6; customized(); refresh(); });
const kRC = bindRange($("#kR"), $("#kROut"), (v) => `${fmt(v, 0)} Om`, (v) => { lc.R = v; customized(); refresh(); });
const kEC = bindRange($("#kE"), $("#kEOut"), (v) => `${fmt(v, 1)} V`, (v) => { lc.E = v; customized(); refresh(); });

const aFC = bindRange($("#aF"), $("#aFOut"), (v) => `${fmt(v, 0)} Hz`, (v) => { ac.f = v; customized(); refresh(); });
const aUC = bindRange($("#aU"), $("#aUOut"), (v) => `${fmt(v, 1)} V`, (v) => { ac.U = v; customized(); refresh(); });
const aRC = bindRange($("#aR"), $("#aROut"), (v) => `${fmt(v, 0)} Om`, (v) => { ac.R = v; customized(); refresh(); });
const aLC = bindRange($("#aL"), $("#aLOut"), (v) => `${fmt(v, 0)} mGn`, (v) => { ac.L = v / 1000; customized(); refresh(); });
const aCC = bindRange($("#aC"), $("#aCOut"), (v) => `${fmt(v, 0)} mkF`, (v) => { ac.C = v * 1e-6; customized(); refresh(); });
document.querySelectorAll("[data-el-value]").forEach((b) => b.addEventListener("click", () => { ac.el = b.dataset.elValue; syncAll(); customized(); refresh(); }));

const rFC = bindRange($("#rF"), $("#rFOut"), (v) => `${fmt(v, 0)} Hz`, (v) => { rs.f = v; customized(); refresh(); });
const rCC = bindRange($("#rC"), $("#rCOut"), (v) => `${fmt(v, 1)} mkF`, (v) => { rs.C = v * 1e-6; customized(); refresh(); });
const rLC = bindRange($("#rL"), $("#rLOut"), (v) => `${fmt(v, 0)} mGn`, (v) => { rs.L = v / 1000; customized(); refresh(); });
const rRC = bindRange($("#rR"), $("#rROut"), (v) => `${fmt(v, 0)} Om`, (v) => { rs.R = v; customized(); refresh(); });
$("[data-tune]").addEventListener("click", () => { rs.C = clamp(Math.round(P.capacitanceFor(rs.f, rs.L) * 1e6 * 2) / 2, 2, 60) * 1e-6; rCC.set(rs.C * 1e6); customized(); refresh(); });
$("[data-meas-add]").addEventListener("click", () => { rs.pts.push({ f: rs.f, I: rsState().Ief }); graph.render(); });
$("[data-meas-clear]").addEventListener("click", () => { rs.pts = []; graph.render(); });
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); refresh(); }));

/* Sudrash: kalit (bosish), generator dastagi (chastota), o'zgaruvchan kondensator dastagi */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
function hitTest(px, py) {
  if (ui.mode === "lc" && geo.sw && Math.abs(px - geo.sw.x) < 50 && Math.abs(py - geo.sw.y) < 26) return "sw";
  if (ui.mode === "ac" && geo.gen && Math.hypot(px - geo.gen.x, py - geo.gen.y) < 32) return "gen";
  if (ui.mode === "res" && geo.knob && Math.hypot(px - geo.knob.x, py - geo.knob.y) < 24) return "knob";
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const { px, py } = ptr(e), h = hitTest(px, py);
  if (!h) return;
  if (h === "sw") { toggleSwitch(); return; }
  drag = { h, px, py, f0: ac.f, C0: rs.C }; canvas.dataset.dragging = "true";
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
});
canvas.addEventListener("pointermove", (e) => {
  const { px, py } = ptr(e);
  if (!drag) { const h = hitTest(px, py); canvas.style.cursor = h ? (h === "sw" ? "pointer" : h === "gen" ? "ns-resize" : "ew-resize") : ""; return; }
  if (drag.h === "gen") { ac.f = clamp(Math.round((drag.f0 * Math.exp((drag.py - py) / 60)) / 5) * 5, 10, 1000); aFC.set(ac.f); }
  else { rs.C = clamp(Math.round(drag.C0 * 1e6 * Math.exp((px - drag.px) / 80) * 2) / 2, 2, 60) * 1e-6; rCC.set(rs.C * 1e6); }
  customized(); refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  charge: { mode: "lc", title: "Zaryadlash va tebranishlar", lesson: "Kondensator batareyadan zaryadlanmoqda. Zaryadlangach, kalitni bosib 2-holatga o‘tkazing — tebranishlar boshlanadi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 0, E: 6, sw: 1, q: 0, i: 0 }) },
  free: { mode: "lc", title: "Erkin tebranishlar (R = 0)", lesson: "Energiya elektr maydondan magnit maydonga va qaytib o‘tadi, umumiy energiya o‘zgarmaydi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 0, E: 6, sw: 2, q: 200e-6 * 6, i: 0 }), tab: "en" },
  damped: { mode: "lc", title: "So‘nuvchi tebranishlar", lesson: "R = 10 Om: har davrda energiyaning bir qismi issiqlikka aylanadi, amplituda kamayadi, davr deyarli o‘zgarmaydi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 10, E: 6, sw: 2, q: 200e-6 * 6, i: 0 }) },
  aperiodic: { mode: "lc", title: "Aperiodik razryad (katta R)", lesson: "R > 2√(L/C) = 100 Om: kondensator tebranmasdan zaryadsizlanadi.", set: () => Object.assign(lc, { L: 0.5, C: 200e-6, R: 160, E: 6, sw: 2, q: 200e-6 * 6, i: 0 }) },
  bigC: { mode: "lc", title: "Sig‘imni 4 marta oshirish", lesson: "C = 800 mkF: Tomson formulasi bo‘yicha davr 2 marta ortadi. T(C) grafigiga qarang.", set: () => Object.assign(lc, { L: 0.5, C: 800e-6, R: 0, E: 6, sw: 2, q: 800e-6 * 6, i: 0 }), tab: "th" },
  acR: { mode: "ac", title: "Aktiv qarshilik: φ = 0", lesson: "Tok va kuchlanish vektorlari ustma-ust aylanadi — bir fazada.", set: () => Object.assign(ac, { el: "R", f: 50, U: 10, R: 100 }) },
  acC: { mode: "ac", title: "Kondensator: tok 90° oldinda", lesson: "Generator dastagini yuqoriga surib chastotani oshiring — X_C kamayadi, tok ortadi.", set: () => Object.assign(ac, { el: "C", f: 50, U: 10, C: 20e-6 }) },
  acL: { mode: "ac", title: "G‘altak: tok 90° orqada", lesson: "Chastota oshgan sari X_L = ωL ortadi va tok kamayadi.", set: () => Object.assign(ac, { el: "L", f: 50, U: 10, L: 0.2 }) },
  acRLC: { mode: "ac", title: "Ketma-ket RLC", lesson: "Vektor diagrammada U_R, U_L, U_C qo‘shilib U ni beradi. Chastotani f₀ ≈ 80 Hz ga yaqinlashtiring.", set: () => Object.assign(ac, { el: "RLC", f: 50, U: 10, R: 60, L: 0.2, C: 20e-6 }) },
  res: { mode: "res", title: "Rezonans (lab)", lesson: "Chastotani 40 dan 400 Hz gacha o‘zgartirib, har safar tokni yozing. Rezonans egri chizig‘ini quring.", set: () => Object.assign(rs, { f: 60, C: 10e-6, L: 0.1, R: 20, pts: [] }), tab: "i" },
  radio: { mode: "res", title: "Radio: konturni sozlash", lesson: "Generator — «radiostansiya» (250 Hz). O‘zgaruvchan kondensator dastagini suring va lampani eng yorqin yondiring.", set: () => Object.assign(rs, { f: 250, C: 20e-6, L: 0.1, R: 15, pts: [] }) },
  highQ: { mode: "res", title: "Yuqori aslilik: U_C ≫ U", lesson: "R = 5 Om: rezonansda kondensator va g‘altakdagi kuchlanish manbadan ~20 marta katta.", set: () => Object.assign(rs, { f: 159, C: 10e-6, L: 0.1, R: 5, pts: [] }), tab: "u" },
};
const GROUPS = [["LC kontur", ["charge", "free", "damped", "aperiodic", "bigC"]], ["O‘zgaruvchan tok", ["acR", "acC", "acL", "acRLC"]], ["Rezonans", ["res", "radio", "highQ"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  kLC.set(lc.L); kCC.set(lc.C * 1e6); kRC.set(lc.R); kEC.set(lc.E);
  aFC.set(ac.f); aUC.set(ac.U); aRC.set(ac.R); aLC.set(ac.L * 1000); aCC.set(ac.C * 1e6);
  document.querySelectorAll("[data-el-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.elValue === ac.el)));
  document.querySelectorAll("[data-actl]").forEach((el) => { el.hidden = !el.dataset.actl.split(" ").includes(ac.el); });
  rFC.set(rs.f); rCC.set(rs.C * 1e6); rLC.set(rs.L * 1000); rRC.set(rs.R);
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { lc: "Kalitni bosib buring", ac: "Generator dastagini suring", res: "Kondensator dastagini suring" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ lc: "charge", ac: "acRLC", res: "res" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  p.set(); setMode(p.mode);
  if (p.mode === "lc") { lc.t = 0; lc.heat = 0; lc.hist = []; lc.dots = 0; }
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[ui.mode][0][0]);
  refresh();
  if (!prefersReducedMotion()) loop.start();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "charge");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
