// ==========================================================================
// Elektroliz va Faradey qonunlari — virtual laboratoriya (simulations/electrolysis.html)
// 1) Suyuqliklarda tok: vanna + lampa + manba; distillangan suv, shakar, tuz, mis kuporosi, kislota.
//    Ionlar elektrodlarga dreyf qiladi, elektrodlarda gaz pufakchalari yoki metall ajraladi. I(U) va R(t) grafiklari.
//    Sahnada: manba tutqichi (U) va katodni surish (d).
// 2) Faradeyning 1-qonuni: o'zgarmas tok manbai, sekundomer, katod massasi (tarozi 1 mg); m(t) va m(q).
// 3) Faradeyning 2-qonuni: ketma-ket uchta vanna (Ag, Cu, suv / Cu, Ni, Zn ...), m — M/n grafigi, F ni aniqlash.
// Fizika: electrolysis-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./electrolysis-physics.js";
import { drawIU, drawRT, drawMass, drawEquiv, lastFrame } from "./electrolysis-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const S_EL = 2e-3;          // elektrod yuzasi (suyuqlikka botgan qismi), m²
const R_LAMP = 12;          // lampa (6 V, 3 W) qarshiligi, Ω
const P_LAMP = 3;
const T_MAX = 3600;         // tajriba davomiyligi, s
const M0 = { Cu: 7.168, Ag: 8.392, Ni: 7.126, Zn: 5.712 }; // katod plastinkasining boshlang'ich massasi, g
const F1_SOL = { cuso4: "Mis kuporosi CuSO₄, mis elektrodlar", agno3: "Kumush nitrat AgNO₃, kumush elektrodlar", niso4: "Nikel sulfat NiSO₄, nikel elektrodlar", znso4: "Rux sulfat ZnSO₄, rux elektrodlar" };
const SETS = {
  agcuw: { title: "Ag, Cu va suv (H₂, O₂)", cells: [{ sol: "agno3", s: "Ag" }, { sol: "cuso4", s: "Cu" }, { sol: "h2so4", s: "H2", gas: true }] },
  cunizn: { title: "Cu, Ni va Zn", cells: [{ sol: "cuso4", s: "Cu" }, { sol: "niso4", s: "Ni" }, { sol: "znso4", s: "Zn" }] },
  agcuzn: { title: "Ag, Cu va Zn", cells: [{ sol: "agno3", s: "Ag" }, { sol: "cuso4", s: "Cu" }, { sol: "znso4", s: "Zn" }] },
};
const SOL_LABEL = { agno3: "AgNO₃", cuso4: "CuSO₄", niso4: "NiSO₄", znso4: "ZnSO₄", h2so4: "Suv + H₂SO₄" };
const METAL_COL = { Cu: ["#f59e0b", "#b45309"], Ag: ["#e2e8f0", "#94a3b8"], Ni: ["#d4d4d8", "#71717a"], Zn: ["#cbd5e1", "#64748b"], Pt: ["#e5e7eb", "#9ca3af"], C: ["#475569", "#1e293b"] };

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "ion", tab: "iu", speed: 60, hover: null };
const ion = { key: "nacl", c: 0.5, U: 12, d: 0.05, t: 25 };
const f1 = { key: "cuso4", I: 1, time: 0, runs: [] };
const f2 = { set: "agcuw", I: 1, time: 0 };
const vis = { ions: {}, bubbles: [], spark: 0 };
let presetId = null, running = false;
const geo = {};

const ionCirc = () => P.circuit({ key: ion.key, c: ion.c, t: ion.t, d: ion.d, S: S_EL, U: ion.U, Rext: R_LAMP });
const f1Subst = () => P.SOLUTIONS[f1.key].cath;
const balance = (kg) => Math.round(kg * 1e6) / 1e6; // tarozi: 1 mg
const curRun = () => f1.runs[f1.runs.length - 1];
const RUN_COLS = (c) => [c.primary, c.success, c.warning, c.special];

/* ------------------------------------------------------------------ Ionlar (sxematik) */

function makeIons(id, key, n = 26) {
  const s = P.SOLUTIONS[key], arr = [];
  for (let k = 0; k < n; k++) {
    const sg = s.electrolyte ? (k % 2 ? -1 : 1) : 0;
    arr.push({ x: ((k * 37) % 97) / 97, y: ((k * 59) % 89) / 89, sg, ph: k * 1.7 });
  }
  vis.ions[id] = { key, arr };
  return vis.ions[id];
}
function ionsFor(id, key, n) { const v = vis.ions[id]; return v && v.key === key ? v : makeIons(id, key, n); }
/** xa, xc — anod va katod (normal koordinatada); flux — 0…1 (tok nisbiy) */
function stepIons(set, dt, xa, xc, flux, onArrive) {
  for (const p of set.arr) {
    p.ph += dt * 3;
    p.y = clamp(p.y + Math.sin(p.ph * 1.3) * 0.05 * dt, 0.02, 0.98);
    p.x += Math.cos(p.ph) * 0.03 * dt;
    if (p.sg && flux > 0 && p.x > xa && p.x < xc) p.x += p.sg * flux * 0.35 * dt;
    if (p.sg > 0 && p.x >= xc) { onArrive?.(p, "cath"); p.x = xa + 0.02 + Math.random() * 0.08; p.y = 0.1 + Math.random() * 0.8; }
    else if (p.sg < 0 && p.x <= xa) { onArrive?.(p, "anod"); p.x = xc - 0.02 - Math.random() * 0.08; p.y = 0.1 + Math.random() * 0.8; }
    p.x = clamp(p.x, 0.01, 0.99);
  }
}
function drawIons(ctx, c, set, x0, y0, w, h) {
  const s = P.SOLUTIONS[set.key], [cat, an] = s.ions;
  for (const p of set.arr) {
    const x = x0 + p.x * w, y = y0 + p.y * h;
    if (!p.sg) { ctx.fillStyle = c.dark ? "rgba(148,163,184,0.55)" : "rgba(100,116,139,0.45)"; ctx.beginPath(); ctx.arc(x, y, set.key === "sugar" ? 4.5 : 2.6, 0, TAU); ctx.fill(); continue; }
    ctx.fillStyle = p.sg > 0 ? c.danger : c.primary; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.sg > 0 ? "+" : "−", x, y + 0.5);
  }
  return { cat, an };
}
function emitBubble(x, y, kind, xmin, xmax) { if (vis.bubbles.length < 160) vis.bubbles.push({ x: x + (Math.random() - 0.5) * 6, y, vy: 22 + Math.random() * 20, r: 1.6 + Math.random() * 2, kind, xmin, xmax }); }
function stepBubbles(dt, topOf) {
  for (const b of vis.bubbles) { b.y -= b.vy * dt; b.x += Math.sin(b.y * 0.2) * 0.3; }
  vis.bubbles = vis.bubbles.filter((b) => b.y > topOf(b));
}

/* ------------------------------------------------------------------ Chizish yordamchilari */

function beaker(ctx, c, x, y, w, h, col) {
  const yl = y + 16;
  ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${c.dark ? 0.28 : 0.45})`; ctx.fillRect(x, yl, w, y + h - yl);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + 4); ctx.lineTo(x + w + 4, y); ctx.stroke();
  return yl;
}
function plate(ctx, c, x, y0, y1, pw, metal, label) {
  const [a, b] = METAL_COL[metal] || METAL_COL.C, g = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
  g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(x - pw / 2, y0, pw, y1 - y0);
  ctx.strokeStyle = c.dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(x - pw / 2 + 0.5, y0 + 0.5, pw - 1, y1 - y0 - 1);
  if (label) { ctx.font = BOLD; ctx.fillStyle = label === "+" ? c.danger : c.primary; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(label, x, y0 - 3); }
}
function wire(ctx, c, pts, on) {
  ctx.strokeStyle = on ? c.warning : c.text3; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
}
/** Manba: vertikal shkala va tutqich. frac — 0…1 */
function source(ctx, c, x, y, w, h, title, value, frac) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(title, x + w / 2, y + 6);
  ctx.fillStyle = c.dark ? "#052e16" : "#ecfdf5"; ctx.fillRect(x + 8, y + 20, w - 16, 22);
  ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.fillStyle = c.success; ctx.textBaseline = "middle"; ctx.fillText(value, x + w / 2, y + 31);
  const y0 = y + 56, y1 = y + h - 26, sx = x + w / 2;
  ctx.strokeStyle = c.border; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(sx, y0); ctx.lineTo(sx, y1); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.moveTo(sx, y1); ctx.lineTo(sx, y1 - frac * (y1 - y0)); ctx.stroke(); ctx.lineCap = "butt";
  const ky = y1 - frac * (y1 - y0);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx, ky, 9, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(sx, ky - 5); ctx.lineTo(sx - 3, ky - 1.5); ctx.lineTo(sx + 3, ky - 1.5); ctx.closePath(); ctx.moveTo(sx, ky + 5); ctx.lineTo(sx - 3, ky + 1.5); ctx.lineTo(sx + 3, ky + 1.5); ctx.closePath(); ctx.fill();
  ctx.font = BOLD; ctx.textBaseline = "middle"; ctx.fillStyle = c.danger; ctx.fillText("+", x + w - 10, y + h - 12); ctx.fillStyle = c.primary; ctx.fillText("−", x + 10, y + h - 12);
  geo.src = { x, y, w, h, y0, y1 };
  return { plus: [x + w, y + h - 12], minus: [x, y + h - 12] };
}
function meter(ctx, c, x, y, sym, txt) {
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.font = "700 14px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(sym, x, y + 0.5);
  if (txt) tag(ctx, txt, x + 20, y, { color: c.text, bg: c.bg2, font: MID });
}
function lamp(ctx, c, x, y, glow) {
  if (glow > 0.01) { const g = ctx.createRadialGradient(x, y, 2, x, y, 12 + 30 * glow); g.addColorStop(0, `rgba(250,204,21,${0.85 * glow})`); g.addColorStop(1, "rgba(250,204,21,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12 + 30 * glow, 0, TAU); ctx.fill(); }
  ctx.fillStyle = glow > 0.05 ? `rgba(254,240,138,${0.4 + 0.6 * glow})` : c.bg2; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = glow > 0.05 ? "#f59e0b" : c.text3; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 7, y + 7); ctx.lineTo(x + 7, y - 7); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.stroke();
}
function stopwatch(ctx, c, x, y, r, t) {
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.fillRect(x - 4, y - r - 7, 8, 6);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r - 5, -Math.PI / 2, -Math.PI / 2 + TAU * (t / T_MAX)); ctx.stroke();
  ctx.font = BOLD; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`, x, y);
}
const fmtI = (I) => (I <= 0 ? "0 A" : I < 1e-3 ? `${fmt(I * 1e6, 1)} μA` : I < 0.1 ? `${fmt(I * 1e3, 1)} mA` : `${fmt(I, 2)} A`);
const fmtMass = (kg) => (kg < 1e-3 ? `${fmt(kg * 1e6, 0)} mg` : `${fmt(kg * 1e3, 3)} g`);

/* ------------------------------------------------------------------ 1. Suyuqliklarda tok */

function drawIonStage(ctx, c, w, h) {
  const narrow = w < 560, cir = ionCirc(), s = P.SOLUTIONS[ion.key], on = cir.I > 1e-4;
  const sw = narrow ? 62 : 80, src = source(ctx, c, 10, 14, sw, h - 28, "Manba", `${fmt(ion.U, 1)} V`, ion.U / 24);
  const bw = Math.min(300, narrow ? w - sw - 90 : w * 0.42), bx = sw + (narrow ? 34 : 70), by = 104, bh = h - by - 18;
  const yl = beaker(ctx, c, bx, by, bw, bh, s.color);
  const span = (ion.d - 0.02) / 0.08, gap = bw * (0.22 + 0.62 * span), xa = bx + bw / 2 - gap / 2, xc = bx + bw / 2 + gap / 2, pw = 10;
  const metal = s.cath === "Cu" || s.cath === "Ag" ? s.cath : "C";
  geo.ion = { bx, bw, xa, xc, yl, by, bh };
  // ionlar
  const set = ionsFor("ion", ion.key, 26), x0 = bx + 4, iw = bw - 8;
  geo.ionBox = { x0, iw, yl, ih: by + bh - yl - 6 };
  drawIons(ctx, c, set, x0, yl + 4, iw, by + bh - yl - 10);
  // pufakchalar
  for (const b of vis.bubbles) { ctx.strokeStyle = b.kind === "Cl2" ? "#84cc16" : c.dark ? "rgba(226,232,240,0.8)" : "rgba(71,85,105,0.7)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); }
  plate(ctx, c, xa, by - 14, by + bh - 20, pw, metal, "+");
  plate(ctx, c, xc, by - 14, by + bh - 20, pw, metal, "−");
  // sudrash uchun belgi (katod)
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(xc + pw / 2 + 4, by + 30); ctx.lineTo(xc + pw / 2 + 12, by + 25); ctx.lineTo(xc + pw / 2 + 12, by + 35); ctx.closePath(); ctx.fill();
  geo.cath = { x: xc, y0: by - 14, y1: by + bh - 20, pw };
  // zanjir: manba + → lampa → anod; katod → ampermetr → manba −
  const lx = (src.plus[0] + xa) / 2, ly = 34, xr = bx + bw + 26;
  wire(ctx, c, [src.plus, [src.plus[0] + 12, src.plus[1]], [src.plus[0] + 12, ly], [lx - 11, ly]], on);
  wire(ctx, c, [[lx + 11, ly], [xa, ly], [xa, by - 14]], on);
  wire(ctx, c, [[xc, by - 14], [xc, 64], [xr, 64], [xr, h - 6], [src.minus[0] - 0, h - 6], [src.minus[0] - 6, h - 6], [src.minus[0] - 6, src.minus[1]], src.minus], on);
  lamp(ctx, c, lx, ly, clamp(cir.Pext / P_LAMP, 0, 1));
  meter(ctx, c, xr, (64 + h - 6) / 2, "A", narrow ? "" : fmtI(cir.I));
  // ma'lumot
  const ix = xr + (narrow ? 0 : 110); if (narrow || w - ix < 150) return;
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "700 14px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text;
  wrapText(ctx, s.name, ix, 16, w - ix - 8, 17);
  ctx.font = MID; ctx.fillStyle = c.text2;
  const lines = s.electrolyte
    ? [`Ionlar: ${s.ions[0]} (katodga), ${s.ions[1]} (anodga)`, `c = ${fmt(ion.c, 2)} mol/L, t = ${fmt(ion.t, 0)} °C`, `σ = ${sci(P.sigma(ion.key, ion.c, ion.t), 3)} S/m`, `R vanna = ${sci(cir.R, 3)} Ω`, on ? `Katodda: ${P.SUBST[s.cath].name.toLowerCase()}${P.SUBST[s.cath].gas ? " (gaz)" : ""}` : `U < E_p = ${fmt(s.Ep, 1)} V — elektroliz yo‘q`, on ? `Anodda: ${s.anod === s.cath ? "mis eriydi" : P.SUBST[s.anod].name.toLowerCase() + " (gaz)"}` : ""]
    : ["Ionlar deyarli yo‘q — molekulalar neytral", `σ = ${sci(P.sigma(ion.key, ion.c, ion.t), 2)} S/m (juda kichik)`, `R vanna = ${sci(cir.R, 2)} Ω`, `I = ${fmtI(cir.I)} — lampa yonmaydi`];
  lines.filter(Boolean).forEach((l, k) => ctx.fillText(l, ix, 56 + k * 17));
}
function wrapText(ctx, text, x, y, maxW, lh) {
  let line = "", yy = y;
  for (const word of text.split(" ")) { const t = line ? `${line} ${word}` : word; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = word; yy += lh; } else line = t; }
  if (line) ctx.fillText(line, x, yy);
  return yy + lh;
}

/* ------------------------------------------------------------------ 2. Faradeyning 1-qonuni */

function f1Mass() { const r = curRun(); return r ? P.massOf(f1Subst(), r.I * f1.time) : 0; }
function drawF1Stage(ctx, c, w, h) {
  const narrow = w < 560, s = P.SOLUTIONS[f1.key], metal = s.cath, dm = f1Mass(), I = curRun()?.I ?? f1.I, on = f1.time < T_MAX;
  const sw = narrow ? 62 : 80, src = source(ctx, c, 10, 14, sw, h - 28, "Tok manbai", `${fmt(f1.I, 2)} A`, (f1.I - 0.1) / 2.9);
  const bw = Math.min(260, narrow ? w - sw - 80 : w * 0.36), bx = sw + (narrow ? 30 : 60), by = 104, bh = h - by - 18;
  const yl = beaker(ctx, c, bx, by, bw, bh, s.color);
  const xa = bx + bw * 0.24, xc = bx + bw * 0.76, grow = Math.min(12, (dm * 1e3) * 6), pw = 10;
  const set = ionsFor("f1", f1.key, 22);
  drawIons(ctx, c, set, bx + 4, yl + 4, bw - 8, by + bh - yl - 10);
  geo.f1 = { bx, bw, xa, xc };
  plate(ctx, c, xa, by - 14, by + bh - 20, Math.max(3, pw - grow * 0.5), metal, "+");
  plate(ctx, c, xc, by - 14, by + bh - 20, pw, metal, "−");
  if (grow > 0.2) { const [a, b] = METAL_COL[metal]; ctx.fillStyle = b; ctx.globalAlpha = 0.9; ctx.fillRect(xc - pw / 2 - grow / 2, yl + 2, grow / 2, by + bh - 22 - yl); ctx.fillRect(xc + pw / 2, yl + 2, grow / 2, by + bh - 22 - yl); ctx.globalAlpha = 1; ctx.fillStyle = a; ctx.fillRect(xc - pw / 2 - grow / 2, yl + 2, 1.5, by + bh - 22 - yl); }
  const xr = bx + bw + 24, flowing = running && on;
  wire(ctx, c, [src.plus, [src.plus[0] + 12, src.plus[1]], [src.plus[0] + 12, 40], [xa, 40], [xa, by - 14]], flowing);
  wire(ctx, c, [[xc, by - 14], [xc, 64], [xr, 64], [xr, h - 6], [src.minus[0] - 6, h - 6], [src.minus[0] - 6, src.minus[1]], src.minus], flowing);
  meter(ctx, c, xr, (64 + h - 6) / 2, "A", narrow ? "" : `${fmt(I, 2)} A`);
  if (narrow) { stopwatch(ctx, c, w - 34, 34, 24, f1.time); return; }
  // sekundomer va tarozi
  const ix = xr + 90;
  stopwatch(ctx, c, ix + 36, 54, 34, f1.time);
  const tx = ix, ty = 104, tw = Math.min(w - ix - 10, 230);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(tx, ty, tw, 70, 8); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("Tarozi: katod massasi", tx + 10, ty + 8);
  ctx.fillStyle = c.dark ? "#052e16" : "#ecfdf5"; ctx.fillRect(tx + 10, ty + 24, tw - 20, 26);
  ctx.font = "700 15px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.fillStyle = c.success; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(`${fmt(M0[metal] + balance(dm) * 1e3, 3)} g`, tx + tw - 16, ty + 37);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`boshida ${fmt(M0[metal], 3)} g → Δm = ${fmtMass(balance(dm))}`, tx + 10, ty + 54);
  ctx.font = MID; ctx.fillStyle = c.text2;
  [`q = It = ${fmt(I, 2)} A · ${fmt(f1.time, 0)} s = ${fmt(I * f1.time, 0)} C`, `Katodda: ${s.ions[0]} + ${P.SUBST[metal].n}e⁻ → ${metal}`, `Anodda: ${metal} → ${s.ions[0]} + ${P.SUBST[metal].n}e⁻ (eriydi)`].forEach((l, k) => ctx.fillText(l, tx, ty + 82 + k * 17));
}

/* ------------------------------------------------------------------ 3. Faradeyning 2-qonuni */

const f2Cells = () => SETS[f2.set].cells;
const f2q = () => f2.I * f2.time;
function drawF2Stage(ctx, c, w, h) {
  const narrow = w < 600, q = f2q(), cells = f2Cells(), flowing = running && f2.time < T_MAX;
  const sw = narrow ? 58 : 76, src = source(ctx, c, 8, 14, sw, h - 28, "Tok manbai", `${fmt(f2.I, 2)} A`, (f2.I - 0.1) / 2.9);
  const x0 = sw + 26, avail = w - x0 - 44, gapC = narrow ? 10 : 22, bw = (avail - gapC * 2) / 3, by = 112, bh = h - by - 44, wy = 42;
  let prevX = src.plus[0] + 12;
  wire(ctx, c, [src.plus, [prevX, src.plus[1]], [prevX, wy]], flowing);
  cells.forEach((cl, k) => {
    const bx = x0 + k * (bw + gapC), s = P.SOLUTIONS[cl.sol], yl = beaker(ctx, c, bx, by, bw, bh, s.color);
    const xa = bx + bw * 0.27, xc = bx + bw * 0.73, metal = cl.gas ? "Pt" : cl.s;
    const set = ionsFor(`f2-${k}`, cl.sol, 12);
    drawIons(ctx, c, set, bx + 3, yl + 3, bw - 6, by + bh - yl - 8);
    if (cl.gas) {
      // Gofman: elektrodlar ustida to'ntarilgan probirkalar
      const VH = P.gasVolume("H2", q) * 1e6, VO = P.gasVolume("O2", q) * 1e6, cap = 500; // mL
      [[xa, VO, "O₂"], [xc, VH, "H₂"]].forEach(([x, V, lab]) => {
        const tw2 = 18, ty0 = by - 22, ty1 = by + bh - 26, fill = clamp(V / cap, 0, 1) * (ty1 - ty0);
        ctx.fillStyle = c.dark ? "rgba(226,232,240,0.18)" : "rgba(255,255,255,0.75)"; ctx.fillRect(x - tw2 / 2, ty0, tw2, fill);
        ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - tw2 / 2, ty1); ctx.lineTo(x - tw2 / 2, ty0 + 6); ctx.arcTo(x - tw2 / 2, ty0, x, ty0, 6); ctx.arcTo(x + tw2 / 2, ty0, x + tw2 / 2, ty0 + 6, 6); ctx.lineTo(x + tw2 / 2, ty1); ctx.stroke();
        ctx.strokeStyle = c.text3; ctx.lineWidth = 1; for (let m = 1; m < 6; m++) { const yy = ty0 + (m / 6) * (ty1 - ty0); ctx.beginPath(); ctx.moveTo(x - tw2 / 2, yy); ctx.lineTo(x - tw2 / 2 + 5, yy); ctx.stroke(); }
        ctx.font = SMALL; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(narrow ? lab : `${lab} ${fmt(V, 1)} mL`, x, ty0 - 2);
      });
    }
    plate(ctx, c, xa, by - (cl.gas ? 4 : 14), by + bh - 20, cl.gas ? 6 : 8, metal, "+");
    plate(ctx, c, xc, by - (cl.gas ? 4 : 14), by + bh - 20, cl.gas ? 6 : 8, metal, "−");
    if (!cl.gas) { const grow = Math.min(8, P.massOf(cl.s, q) * 1e3 * 5); if (grow > 0.2) { ctx.fillStyle = METAL_COL[cl.s][1]; ctx.fillRect(xc - 4 - grow / 2, yl + 2, grow / 2, by + bh - 22 - yl); ctx.fillRect(xc + 4, yl + 2, grow / 2, by + bh - 22 - yl); } }
    // simlar: oldingi katoddan shu anodga
    wire(ctx, c, [[prevX, wy], [xa, wy], [xa, by - (cl.gas ? 4 : 14)]], flowing);
    wire(ctx, c, [[xc, by - (cl.gas ? 4 : 14)], [xc, wy + 22]], flowing);
    prevX = xc; geo[`f2c${k}`] = xc;
    // yorliq
    ctx.font = narrow ? SMALL : MID; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(SOL_LABEL[cl.sol], bx + bw / 2, by + bh + 4);
    ctx.fillStyle = c.success; ctx.font = narrow ? "700 10px Inter, system-ui, sans-serif" : BOLD;
    const mtxt = fmtMass(cl.gas ? P.massOf("H2", q) : balance(P.massOf(cl.s, q)));
    ctx.fillText(narrow ? mtxt : cl.gas ? `m(H₂) = ${mtxt}` : `Δm(${cl.s}) = ${mtxt}`, bx + bw / 2, by + bh + 20);
    if (k < 2) wire(ctx, c, [[xc, wy + 22], [xc, wy]], flowing);
  });
  const xr = w - 22;
  wire(ctx, c, [[prevX, wy + 22], [prevX, wy], [xr, wy], [xr, h - 6], [src.minus[0] - 4, h - 6], [src.minus[0] - 4, src.minus[1]], src.minus], flowing);
  meter(ctx, c, xr, (wy + h) / 2, "A", "");
  const tt = `${String(Math.floor(f2.time / 60)).padStart(2, "0")}:${String(Math.floor(f2.time % 60)).padStart(2, "0")}`;
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(narrow ? `t = ${tt} · q = ${fmt(q, 0)} C` : `t = ${tt} · I = ${fmt(f2.I, 2)} A · q = It = ${fmt(q, 0)} C — har bir vannadan`, x0, 6);
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) {
  const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "ion") drawIonStage(ctx, c, st.w, st.h);
  else if (ui.mode === "f1") drawF1Stage(ctx, c, st.w, st.h);
  else drawF2Stage(ctx, c, st.w, st.h);
}
const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(vh * 0.42, 300, 350)), graph: Math.round(clamp(vh * 0.28, 190, 260)) };
};
const stage = createStage($("#stage"), draw, { height: () => heights().stage });

function drawGraphCanvas(ctx, gst) {
  const c = gst.colors;
  if (ui.mode === "ion") {
    if (ui.tab === "rt") return drawRT(ctx, gst, { key: ion.key, c: ion.c, t: ion.t, hover: ui.hover });
    const cir = ionCirc();
    return drawIU(ctx, gst, { cfg: { key: ion.key, c: ion.c, t: ion.t, d: ion.d, S: S_EL, Rext: R_LAMP }, Umax: 24, cur: { U: ion.U, I: cir.I }, hover: ui.hover });
  }
  if (ui.mode === "f1") {
    const cols = RUN_COLS(c);
    const runs = f1.runs.map((r, k) => ({ ...r, color: cols[k % cols.length], label: `I = ${fmt(r.I, 2)} A` }));
    return drawMass(ctx, gst, { x: ui.tab === "mq" ? "q" : "t", subst: f1Subst(), runs, tMax: T_MAX, hover: ui.hover });
  }
  const q = f2q(), cols = [c.primary, c.warning, c.success, c.special], pts = [];
  f2Cells().forEach((cl, k) => { pts.push({ s: cl.s, m: cl.gas ? P.massOf(cl.s, q) : balance(P.massOf(cl.s, q)), color: cols[k] }); if (cl.gas) pts.push({ s: "O2", m: P.massOf("O2", q), color: cols[3] }); });
  return drawEquiv(ctx, gst, { q, cells: pts, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

const TABS = {
  ion: { iu: ["Volt-amper xarakteristikasi I(U)", "Tuz va kislota eritmalarida U parchalanish kuchlanishidan (E_p) oshgandagina tok o‘tadi, keyin I ≈ U ga chiziqli. Lampa va vanna ketma-ket ulangan. Kursor bilan qiymat o‘qing."], rt: ["Qarshilikning temperaturaga bog‘liqligi", "Elektrolit qizdirilsa ionlar harakatchanroq bo‘ladi va qarshilik kamayadi (≈ 2 %/K). Metallarda esa aksincha — qarshilik ortadi."] },
  f1: { mt: ["Katod massasining ortishi m(t)", "Nuqtalar — tarozi ko‘rsatishi (1 mg aniqlikda), shtrix — m = kIt. Tok o‘zgarmas bo‘lsa massa vaqtga to‘g‘ri proporsional."], mq: ["Massa va zaryad m(q)", "Turli tok kuchidagi tajribalar bitta to‘g‘ri chiziqqa tushadi: massa faqat o‘tgan zaryadga bog‘liq, m = kq. Chiziq qiyaligi — elektrokimyoviy ekvivalent k."] },
  f2: { eq: ["Faradeyning 2-qonuni: m — M/n", "Bir xil zaryadda ajralgan massa ekvivalent massaga (M/n) proporsional: barcha nuqtalar qiyaligi q/F bo‘lgan to‘g‘ri chiziqda yotadi."] },
};
const TAB_LABEL = { iu: "I(U)", rt: "R(t)", mt: "m(t)", mq: "m(q)", eq: "m — M/n" };
function setTab(tab) {
  ui.tab = TABS[ui.mode][tab] ? tab : Object.keys(TABS[ui.mode])[0];
  const t = TABS[ui.mode][ui.tab], keys = Object.keys(TABS[ui.mode]);
  $("[data-tabs]").innerHTML = keys.length > 1 ? keys.map((k) => `<button type="button" data-tab-value="${k}" aria-pressed="${k === ui.tab}">${TAB_LABEL[k]}</button>`).join("") : "";
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1];
  graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (b) setTab(b.dataset.tabValue); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;
const splitU = (txt) => { const m = txt.match(/^(.*) (\S+)$/); return m ? u(m[1], m[2]) : txt; };

function updateReadouts() {
  if (ui.mode === "ion") {
    const cir = ionCirc(), s = P.SOLUTIONS[ion.key];
    setRO("r1", "Tok kuchi <i>I</i>", splitU(fmtI(cir.I)), cir.I > 1e-4 ? "ampermetr ko‘rsatishi" : "deyarli tok yo‘q", "orange");
    setRO("r2", "Vannadagi kuchlanish", u(fmt(cir.Ucell, 2), "V"), `E_p = ${fmt(s.Ep, 1)} V + I·R`);
    setRO("r3", "Vanna qarshiligi <i>R</i>", u(sci(cir.R, 3), "Ω"), `R = d/(σS), d = ${fmt(ion.d * 100, 1)} cm, S = ${fmt(S_EL * 1e4, 0)} cm²`);
    setRO("r4", "Solishtirma o‘tkazuvchanlik <i>σ</i>", u(sci(P.sigma(ion.key, ion.c, ion.t), 3), "S/m"), s.electrolyte ? `c = ${fmt(ion.c, 2)} mol/L, t = ${fmt(ion.t, 0)} °C` : "toza suv: ionlar juda kam");
    setRO("r5", "Lampa quvvati", u(fmt(cir.Pext, 2), "W"), cir.Pext > 0.3 ? "lampa yonadi" : cir.Pext > 0.02 ? "lampa xira yonadi" : "lampa yonmaydi");
    setRO("r6", "Elektrodlarda", cir.I > 1e-4 && s.electrolyte ? `${P.SUBST[s.cath].sym} | ${s.anod === s.cath ? `${s.anod} eriydi` : P.SUBST[s.anod].sym}` : "—", cir.I > 1e-4 && s.electrolyte ? "katodda | anodda" : ion.U <= s.Ep ? `U < E_p — elektroliz boshlanmaydi` : "elektrolit emas");
    return;
  }
  if (ui.mode === "f1") {
    const r = curRun(), I = r?.I ?? f1.I, q = I * f1.time, dm = balance(f1Mass()), sub = f1Subst(), k = P.kOf(sub);
    setRO("r1", "Tok kuchi <i>I</i>", u(fmt(I, 2), "A"), "o‘zgarmas");
    setRO("r2", "Vaqt <i>t</i>", u(fmt(f1.time / 60, 1), "min"), `= ${fmt(f1.time, 0)} s`);
    setRO("r3", "Zaryad <i>q = It</i>", u(fmt(q, 0), "C"), `= ${fmt(q / 3600, 3)} A·soat`);
    setRO("r4", "Katodda ajralgan <i>Δm</i>", splitU(fmtMass(dm)), `tarozi: ${fmt(M0[sub] + dm * 1e3, 3)} g`, "orange");
    setRO("r5", "Ekvivalent <i>k = Δm/q</i>", q > 50 && dm > 0 ? u(fmt((dm / q) * 1e6, 3), "mg/C") : "—", `jadvalda ${P.SUBST[sub].sym}: ${fmt(k * 1e6, 4)} mg/C`);
    setRO("r6", "Qatlam qalinligi <i>h</i>", u(fmt(P.thickness(sub, q, 2 * S_EL) * 1e6, 2), "μm"), "h = m/(ρS), ikki tomonida");
    return;
  }
  const q = f2q(), cells = f2Cells(), keys = ["r2", "r3", "r4"];
  setRO("r1", "Zaryad <i>q</i>", u(fmt(q, 0), "C"), `I = ${fmt(f2.I, 2)} A, t = ${fmt(f2.time / 60, 1)} min`);
  cells.forEach((cl, k) => {
    if (cl.gas) setRO(keys[k], "Suv: gazlar", u(`${fmt(P.gasVolume("H2", q) * 1e6, 1)} / ${fmt(P.gasVolume("O2", q) * 1e6, 1)}`, "mL"), `H₂ / O₂ (20 °C) = 2 : 1; m(H₂) = ${fmtMass(P.massOf("H2", q))}`);
    else setRO(keys[k], `${P.SUBST[cl.s].name} <i>(M/n = ${fmt((P.SUBST[cl.s].M * 1e3) / P.SUBST[cl.s].n, 1)})</i>`, splitU(fmtMass(balance(P.massOf(cl.s, q)))), `k = ${fmt(P.kOf(cl.s) * 1e6, 4)} mg/C`);
  });
  const m1 = balance(P.massOf(cells[0].s, q)), m2 = balance(P.massOf(cells[1].s, q)), Fm = m1 > 0 ? P.faradayFrom(cells[0].s, q, m1) : null;
  setRO("r5", `m(${P.SUBST[cells[0].s].sym}) / m(${P.SUBST[cells[1].s].sym})`, m2 > 0 ? fmt(m1 / m2, 3) : "—", `(M/n) nisbati = ${fmt((P.SUBST[cells[0].s].M / P.SUBST[cells[0].s].n) / (P.SUBST[cells[1].s].M / P.SUBST[cells[1].s].n), 3)}`);
  setRO("r6", "Faradey soni (o‘lchovdan)", Fm ? u(fmt(Fm, 0), "C/mol") : "—", Fm ? `F = qM/(nm), jadvalda 96 485 (farqi ${fmt(((Fm - P.F) / P.F) * 100, 2)} %)` : "tokni yoqing", "orange");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "ion") { const cir = ionCirc(), s = P.SOLUTIONS[ion.key]; t = !s.electrolyte ? "Elektrolit emas — tok deyarli yo‘q" : cir.I <= 0 ? "U < E_p: elektroliz yo‘q" : "Elektroliz bormoqda"; tone = !s.electrolyte || cir.I <= 0 ? "blue" : "green"; }
  else { const time = ui.mode === "f1" ? f1.time : f2.time; t = time >= T_MAX ? "Tajriba tugadi (60 min)" : running ? "Elektroliz bormoqda" : time > 0 ? "Pauza" : "Boshlash tugmasini bosing"; tone = time >= T_MAX ? "green" : running ? "orange" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "ion") {
    const s = P.SOLUTIONS[ion.key], cir = ionCirc();
    if (!s.electrolyte) p.push(`<p><b>${s.name}</b> deyarli tok o‘tkazmaydi: unda erkin zaryadli zarralar (ionlar) juda kam. Distillangan suvda ham, shakar eritmasida ham molekulalar neytral — lampa yonmaydi, ampermetr mikroamperlarni ko‘rsatadi.</p>`);
    else {
      p.push(`<p>Tuz, kislota va ishqorlar suvda eriganda molekulalar musbat va manfiy <b>ionlarga</b> ajraladi (<b>elektrolitik dissotsiatsiya</b>). Elektr maydonda musbat ionlar (${s.ions[0]}) katodga (−), manfiy ionlar (${s.ions[1]}) anodga (+) harakatlanadi — suyuqlikda tok shunday hosil bo‘ladi. Elektrodlarda modda ajralishi — <b>elektroliz</b>.</p>`);
      if (cir.I <= 0) p.push(`<p>Manba kuchlanishi parchalanish kuchlanishidan (E_p = ${fmt(s.Ep, 1)} V) kichik — elektrodlarda moddalar ajrala boshlamaydi va tok o‘tmaydi. U ni oshiring.</p>`);
      else p.push(`<p>Konsentratsiya ortsa ionlar ko‘payadi va qarshilik kamayadi; elektrodlarni yaqinlashtirsangiz ham qarshilik kamayadi (R = d/σS). Elektrolitni isitsangiz ionlar harakatchanroq bo‘ladi — metallardan farqli ravishda qarshilik <b>kamayadi</b>.</p>`);
    }
  } else if (ui.mode === "f1") {
    const sub = f1Subst();
    p.push(`<p>Har bir ${P.SOLUTIONS[f1.key].ions[0]} ioni katodda ${P.SUBST[sub].n} ta elektron olib ${P.SUBST[sub].name.toLowerCase()} atomiga aylanadi va plastinkaga o‘tiradi; anod esa eriydi. Ajralgan massa o‘tgan ionlar soniga, ya’ni <b>zaryadga</b> proporsional: <b>m = kIt</b> — Faradeyning 1-qonuni.</p>`);
    if (f1.runs.length > 1) p.push("<p>m(q) grafikda turli tok kuchidagi tajribalar bitta chiziqqa tushadi: 2 A da 15 minut va 1 A da 30 minut — bir xil zaryad, bir xil massa.</p>");
    p.push("<p>Bu hodisa <b>galvanostegiya</b> (buyumlarni nikel, xrom, kumush bilan qoplash), <b>galvanoplastika</b> va metallarni tozalashda (rafinatsiya) ishlatiladi.</p>");
  } else {
    p.push("<p>Vannalar <b>ketma-ket</b> ulangan — har biridan bir xil zaryad o‘tadi. Lekin ajralgan massalar har xil: kumushdan eng ko‘p, chunki uning ioni bir zaryadli (n = 1) va atom massasi katta.</p>");
    p.push("<p>Faradeyning 2-qonuni: elektrokimyoviy ekvivalent <b>k = M/(nF)</b>. 1 mol bir valentli moddani ajratish uchun F = 96 485 C zaryad kerak — bu N_A ta elektronning zaryadi: F = eN_A.</p>");
    if (f2Cells().some((cl) => cl.gas)) p.push("<p>Suv elektrolizida katodda vodorod, anodda kislorod ajraladi; hajmlari 2 : 1 nisbatda (H₂O molekulasida 2 ta H va 1 ta O).</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "ion" ? "<small>Vanna</small> I = (U − E<sub>p</sub>)/(R + R<sub>l</sub>)" : ui.mode === "f1" ? "<small>Faradeyning 1-qonuni</small> m = kIt" : "<small>Faradeyning 2-qonuni</small> k = M/(nF)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0, recT = 0;
function advanceF1(dts) {
  const r = curRun(); if (!r) return;
  const h = Math.min(dts, T_MAX - f1.time); if (h <= 0) return;
  f1.time += h; recT += h;
  if (recT >= 30 || f1.time >= T_MAX) { recT = 0; r.pts.push({ t: f1.time, q: r.I * f1.time, m: balance(P.massOf(f1Subst(), r.I * f1.time)) }); }
}
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  const topOf = () => (geo.ion?.yl ?? 0) + 2;
  if (ui.mode === "ion") {
    const cir = ionCirc(), s = P.SOLUTIONS[ion.key], g = geo.ion, flux = clamp(cir.I / 0.6, 0, 1.4);
    if (g && vis.ions.ion) {
      const xa = (g.xa - g.bx) / g.bw, xc = (g.xc - g.bx) / g.bw;
      stepIons(vis.ions.ion, dt, xa, xc, flux, (p, at) => {
        const gas = at === "cath" ? s.cath : s.anod;
        if (P.SUBST[gas]?.gas) emitBubble(at === "cath" ? g.xc : g.xa, g.by + g.bh - 30 - Math.random() * (g.bh - 60), gas);
      });
      if (s.electrolyte && cir.I > 1e-4 && Math.random() < dt * 30 * flux) { if (P.SUBST[s.cath].gas) emitBubble(g.xc - 7, g.by + g.bh - 26 - Math.random() * (g.bh - 50), s.cath); if (P.SUBST[s.anod].gas) emitBubble(g.xa + 7, g.by + g.bh - 26 - Math.random() * (g.bh - 50), s.anod); }
    }
    stepBubbles(dt, topOf);
  } else if (ui.mode === "f1") {
    if (f1.time < T_MAX) { advanceF1(dt * ui.speed); const v = vis.ions.f1; if (v) stepIons(v, dt, 0.24, 0.76, clamp((curRun()?.I ?? 0) / 2, 0.15, 1)); }
    else loop.stop();
  } else {
    if (f2.time < T_MAX) { f2.time = Math.min(T_MAX, f2.time + dt * ui.speed); f2Cells().forEach((cl, k) => { const v = vis.ions[`f2-${k}`]; if (v) stepIons(v, dt, 0.27, 0.73, clamp(f2.I / 2, 0.15, 1)); }); }
    else loop.stop();
  }
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  const t = ui.mode === "f1" ? f1.time : ui.mode === "f2" ? f2.time : 0;
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : ui.mode === "ion" ? "Ionlar" : t > 0 && t < T_MAX ? "Davom ettirish" : "Boshlash";
  if (f1.runs.length) { updateReadouts(); updateStatus(); stage.render(); graph.render(); }
}
playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (ui.mode === "f1" && f1.time >= T_MAX) newRun();
  if (ui.mode === "f2" && f2.time >= T_MAX) f2.time = 0;
  if (prefersReducedMotion() && ui.mode !== "ion") { // animatsiyasiz: darhol 60 minutga
    if (ui.mode === "f1") { while (f1.time < T_MAX) advanceF1(30); } else f2.time = T_MAX;
    refresh(); return;
  }
  loop.start();
});
function newRun() {
  const r = curRun();
  if (r && r.pts.length <= 1) f1.runs.pop();
  if (f1.runs.length >= 4) f1.runs.shift();
  f1.runs.push({ I: f1.I, pts: [{ t: 0, q: 0, m: 0 }] }); f1.time = 0; recT = 0;
}
$("[data-reset]").addEventListener("click", () => {
  loop.stop();
  if (ui.mode === "f1") newRun(); else if (ui.mode === "f2") f2.time = 0; else { vis.bubbles = []; makeIons("ion", ion.key); }
  setPlayUI(false); refresh();
});
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; syncSpeed(); }));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.speedValue === ui.speed)));

/* ------------------------------------------------------------------ Boshqaruv */

const iSol = $("#iSol");
iSol.innerHTML = ["water", "sugar", "nacl", "cuso4", "h2so4"].map((k) => `<option value="${k}">${P.SOLUTIONS[k].name}</option>`).join("");
iSol.addEventListener("change", () => { ion.key = iSol.value; vis.bubbles = []; customized(); syncIonCtl(); refresh(); });
const iCC = bindRange($("#iC"), $("#iCOut"), (v) => `${fmt(v, 2)} mol/L`, (v) => { ion.c = v; customized(); refresh(); });
const iUC = bindRange($("#iU"), $("#iUOut"), (v) => `${fmt(v, 1)} V`, (v) => { ion.U = v; customized(); refresh(); });
const iDC = bindRange($("#iD"), $("#iDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ion.d = v / 100; customized(); refresh(); });
const iTC = bindRange($("#iT"), $("#iTOut"), (v) => `${fmt(v, 0)} °C`, (v) => { ion.t = v; customized(); refresh(); });
function syncIonCtl() { iSol.value = ion.key; iCC.set(ion.c); iUC.set(ion.U); iDC.set(ion.d * 100); iTC.set(ion.t); $("#iC").disabled = !P.SOLUTIONS[ion.key].electrolyte; }

const fSol = $("#fSol");
fSol.innerHTML = Object.entries(F1_SOL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
fSol.addEventListener("change", () => { loop.stop(); f1.key = fSol.value; f1.runs = []; newRun(); customized(); setPlayUI(false); refresh(); });
const fIC = bindRange($("#fI"), $("#fIOut"), (v) => `${fmt(v, 2)} A`, (v) => setF1I(v));
// Tajriba davomida tok o'zgartirilsa — slayder qo'yib yuborilganda yangi tajriba boshlanadi (yangi katod)
function setF1I(v) { f1.I = v; customized(); if (f1.time === 0 && curRun()) curRun().I = v; refresh(); }
function commitF1I() { if (f1.time > 0 && curRun() && curRun().I !== f1.I) { const was = loop.running; newRun(); if (was) loop.start(); refresh(); } }
$("#fI").addEventListener("change", commitF1I);

const sSet = $("#sSet");
sSet.innerHTML = Object.entries(SETS).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join("");
sSet.addEventListener("change", () => { loop.stop(); f2.set = sSet.value; f2.time = 0; customized(); setPlayUI(false); refresh(); });
const sIC = bindRange($("#sI"), $("#sIOut"), (v) => `${fmt(v, 2)} A`, (v) => { f2.I = v; customized(); refresh(); });

/* Sahnada: manba tutqichi, katodni surish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function hit(p) {
  const s = geo.src;
  if (s && p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y0 - 14 && p.y <= s.y1 + 14) return { kind: "src" };
  if (ui.mode === "ion" && geo.cath && Math.abs(p.x - geo.cath.x) <= geo.cath.pw / 2 + 12 && p.y >= geo.cath.y0 && p.y <= geo.cath.y1) return { kind: "cath" };
  return null;
}
function dragTo(p) {
  if (drag.kind === "src") {
    const s = geo.src, fr = clamp((s.y1 - p.y) / (s.y1 - s.y0), 0, 1);
    if (ui.mode === "ion") { ion.U = Math.round(fr * 240) / 10; iUC.set(ion.U); refresh(); }
    else if (ui.mode === "f1") { const v = Math.round((0.1 + fr * 2.9) * 20) / 20; if (v !== f1.I) { fIC.set(v); f1.I = v; if (f1.time === 0 && curRun()) curRun().I = v; refresh(); } }
    else { f2.I = Math.round((0.1 + fr * 2.9) * 20) / 20; sIC.set(f2.I); refresh(); }
  } else if (drag.kind === "cath") {
    const g = geo.ion, gap = 2 * (p.x - (g.bx + g.bw / 2)), span = clamp((gap / g.bw - 0.22) / 0.62, 0, 1);
    ion.d = Math.round((0.02 + span * 0.08) * 200) / 200; iDC.set(ion.d * 100); refresh();
  }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  drag = h; customized(); e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  canvas.dataset.dragging = "true"; dragTo(p);
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (drag) { dragTo(p); return; }
  const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "cath" ? "ew-resize" : "ns-resize";
});
const endDrag = () => {
  if (drag?.kind === "src" && ui.mode === "f1") commitF1I();
  drag = null; canvas.dataset.dragging = "false";
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Grafikda kursor */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) return;
  const p = ptr(gcv, e), r = f.rect;
  ui.hover = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h ? ((p.x - r.x) / r.w) * f.xMax : null;
  gcv.style.cursor = ui.hover !== null ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  distilled: { mode: "ion", title: "Distillangan suv: tok yo‘q", lesson: "Toza suvda ionlar juda kam: 12 V da ham tok bir necha mikroamper, lampa yonmaydi. Suyuqlikni osh tuzi eritmasiga almashtiring.", set: () => Object.assign(ion, { key: "water", c: 0.5, U: 12, d: 0.05, t: 25 }) },
  salt: { mode: "ion", title: "Osh tuzi eritmasi: lampa yonadi", lesson: "NaCl suvda Na⁺ va Cl⁻ ionlariga ajraladi. Ionlar elektrodlarga harakatlanadi: katodda vodorod, anodda xlor pufakchalari ajraladi, lampa yonadi.", set: () => Object.assign(ion, { key: "nacl", c: 0.5, U: 12, d: 0.05, t: 25 }) },
  sugar: { mode: "ion", title: "Shakar eritmasi — elektrolit emas", lesson: "Shakar suvda eriydi, lekin ionlarga ajralmaydi — eritma tok o‘tkazmaydi. Eriydigan har qanday modda elektrolit bo‘lavermaydi.", set: () => Object.assign(ion, { key: "sugar", c: 0.5, U: 12, d: 0.05, t: 25 }) },
  conc: { mode: "ion", title: "Konsentratsiya va o‘tkazuvchanlik", lesson: "Tuz juda kam (0,02 mol/L): lampa xira. Konsentratsiyani asta oshiring — ionlar ko‘payadi, qarshilik kamayadi, lampa yorqinlashadi.", set: () => Object.assign(ion, { key: "nacl", c: 0.02, U: 12, d: 0.05, t: 25 }) },
  heat: { mode: "ion", title: "Isitilgan elektrolit", lesson: "Elektrolit 80 °C gacha qizdirildi: ionlar harakatchanroq, qarshilik ≈ 2 marta kamaydi. R(t) grafikda metall sim bilan solishtiring — metallda qarshilik ortadi.", set: () => Object.assign(ion, { key: "nacl", c: 0.1, U: 12, d: 0.05, t: 80 }), tab: "rt" },
  decomp: { mode: "ion", title: "Parchalanish kuchlanishi", lesson: "U = 2 V — NaCl eritmasining parchalanish kuchlanishidan (≈ 2,2 V) kichik: ionlar bor, lekin elektrodlarda moddalar ajralmaydi va tok o‘tmaydi. Manba tutqichini asta ko‘taring va I(U) ni kuzating.", set: () => Object.assign(ion, { key: "nacl", c: 0.5, U: 2, d: 0.05, t: 25 }) },
  cuIon: { mode: "ion", title: "Mis kuporosi: mis ajraladi", lesson: "CuSO₄ eritmasida mis elektrodlar: katodga Cu²⁺ ionlari kelib mis bo‘lib o‘tiradi, anod eriydi. Gaz ajralmaydi va parchalanish kuchlanishi deyarli nol.", set: () => Object.assign(ion, { key: "cuso4", c: 0.5, U: 6, d: 0.05, t: 25 }) },
  cu1: { mode: "f1", title: "Mis kuporosi: m = kIt", lesson: "I = 1 A da 60 minut elektroliz. Tarozida katod massasini kuzating: har daqiqada ≈ 19,8 mg mis o‘tiradi. Natijalarda k = Δm/q ni jadval qiymati bilan solishtiring.", set: () => { setF1("cuso4", [], 1); } },
  cu2: { mode: "f1", title: "Tokni 2 marta oshirish", lesson: "Birinchi tajriba (1 A, 60 min) bajarilgan. Endi I = 2 A: massa 2 marta tez ortadi. m(q) grafikda ikkala tajriba bitta chiziqda — massa faqat zaryadga bog‘liq.", set: () => setF1("cuso4", [1], 2), tab: "mq" },
  silver: { mode: "f1", title: "Kumushlash", lesson: "Kumush nitrat eritmasida katodga kumush o‘tiradi. Kumushning k si misnikidan 3,4 marta katta: Ag⁺ bir zaryadli va atomi og‘ir.", set: () => setF1("agno3", [], 0.5) },
  nickel: { mode: "f1", title: "Nikellash (galvanostegiya)", lesson: "Buyumni nikel bilan qoplash: buyum katod qilib olinadi. Qatlam qalinligi h = m/(ρS) — natijalarda mikrometrlarda.", set: () => setF1("niso4", [], 1.5) },
  series: { mode: "f2", title: "Ketma-ket: Ag, Cu va suv", lesson: "Uchta vanna ketma-ket — zaryad bir xil. Kumush, mis massalari va vodorod hajmini solishtiring. m — M/n grafikda barcha nuqtalar bitta chiziqda.", set: () => Object.assign(f2, { set: "agcuw", I: 1, time: 0 }) },
  metals: { mode: "f2", title: "Ikki valentli metallar: Cu, Ni, Zn", lesson: "Uchala metall ham ikki valentli (n = 2): massalar faqat molyar massaga proporsional — M(Zn) > M(Cu) > M(Ni).", set: () => Object.assign(f2, { set: "cunizn", I: 1.5, time: 0 }) },
  faraday: { mode: "f2", title: "Faradey sonini aniqlash", lesson: "2 A tok 30 minut o‘tdi (q = 3600 C). Kumush vannasidagi massadan F = qM/(nm) hisoblandi — tarozi 1 mg aniqlikda bo‘lgani uchun jadval qiymatidan biroz farq qiladi.", set: () => Object.assign(f2, { set: "agcuw", I: 2, time: 1800 }) },
};
function setF1(key, prevI, I) {
  f1.key = key; f1.runs = []; f1.time = 0;
  for (const pi of prevI) { f1.I = pi; newRun(); while (f1.time < T_MAX) advanceF1(30); }
  f1.I = I; newRun();
}
const GROUPS = [["Suyuqliklarda tok", ["distilled", "salt", "sugar", "conc", "heat", "decomp", "cuIon"]], ["Faradeyning 1-qonuni", ["cu1", "cu2", "silver", "nickel"]], ["Faradeyning 2-qonuni", ["series", "metals", "faraday"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { ion: "Manba tutqichini va katodni suring", f1: "Manba tutqichini surib tokni o‘zgartiring", f2: "Manba tutqichini surib tokni o‘zgartiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { ion: "Elektrolitik vanna, lampa, ampermetr va manba; ionlar elektrodlarga harakatlanadi", f1: "Mis kuporosi vannasi, tok manbai, sekundomer va katod massasini ko‘rsatuvchi tarozi", f2: "Ketma-ket ulangan uchta elektrolitik vanna" }[ui.mode]);
}
function syncAll() { syncIonCtl(); fSol.value = f1.key; fIC.set(f1.I); sSet.value = f2.set; sIC.set(f2.I); syncSpeed(); }
const MODE_DEFAULT = { ion: "salt", f1: "cu1", f2: "series" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  loop.stop(); drag = null; ui.hover = null; vis.bubbles = [];
  ui.mode = p.mode; p.set(); ui.speed = 60;
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || Object.keys(TABS[ui.mode])[0]);
  if (ui.mode === "ion" && !prefersReducedMotion()) loop.start();
  setPlayUI(loop.running); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

newRun();
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "salt");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
