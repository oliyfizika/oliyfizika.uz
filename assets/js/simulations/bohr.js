// ==========================================================================
// Bor postulatlarini tekshirish — virtual laboratoriya (simulations/bohr.html)
// 1) Frank–Gers: trubka (katod, to‘r, anod), simob pechi yoki neon (yorug‘ qatlamlar), tezlatuvchi kuchlanish
//    dastagi va ±tugmalar, nanoampermetr, avtomatik skanerlash; yozib oluvchi I(U) grafigi (kursor bilan o‘qish).
// 2) Vodorod spektri: goniometrli spektrometr (teleskop suriladi), okulyar ko‘rinishi (vizir), aniq burash
//    tugmalari, energiya sathlari diagrammasi (hν = E_n − E₂), goniometr jurnali.
// 3) Laboratoriya daftari → LaTeX uslubidagi hisobot (KaTeX HTML → PDF).
// Fizika: bohr-physics.js, hisob: bohr-lab.js (Node’da tekshirilgan); hisobot: bohr-report.js + labreport.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow, sci } from "./sim-kit.js";
import * as P from "./bohr-physics.js";
import * as L from "./bohr-lab.js";
import { frame, ticks } from "./pendulum-plots.js";
import { buildBohrDoc, SITE_URL, SITE_LABEL, DOC_LABEL } from "./bohr-report.js";
import { renderHTML } from "./labreport.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const MONO = (s) => `700 ${s}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* xotira yo‘q */ } },
};

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "fh", t: 0 };
const fh = { gas: "Hg", U: 0, T: 170, Ur: 1.5, scan: false, cursor: null, rec: [] };
const sp = { gr: 600, phi: 0 };
const REC_KEY = "of-bohr-rec-v1", J_KEY = "of-bohr-journal-v1";
let journal = store.get(J_KEY, []);
{ const r = store.get(REC_KEY, null); if (r && r.pts) { Object.assign(fh, { gas: r.gas, T: r.T, Ur: r.Ur }); fh.rec = r.pts; } }
let presetId = null;
const geo = {};
const condKey = () => `${fh.gas}|${fh.T}|${fh.Ur}`;

/* ------------------------------------------------------------------ Yordamchilar */

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
function tagIn(ctx, text, x, y, cw, o) {
  ctx.save(); ctx.font = o.font || MID; const w = ctx.measureText(text).width + 2 * (o.pad ?? 6); ctx.restore();
  let x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  x0 = clamp(x0, 4, cw - 4 - w); tag(ctx, text, x0, y, { ...o, align: "left" });
}
function chipBtn(ctx, c, x, y, text, on, w, h = 24) {
  ctx.save(); ctx.font = MID; const tw = w || ctx.measureText(text).width + 14;
  ctx.fillStyle = on ? c.primary : c.dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"; ctx.beginPath(); ctx.roundRect(x, y, tw, h, 6); ctx.fill();
  ctx.fillStyle = on ? "#fff" : c.text; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x + tw / 2, y + h / 2 + 0.5); ctx.restore();
  return { x0: x, x1: x + tw, y0: y, y1: y + h };
}
function knob(ctx, c, x, y, r, frac, label, val) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, 405 * DEG); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, (135 + 270 * clamp(frac, 0, 1)) * DEG); ctx.stroke();
  const a = (135 + 270 * clamp(frac, 0, 1)) * DEG; ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x, y + r + 8);
  if (val) { ctx.fillStyle = c.text; ctx.font = MID; ctx.fillText(val, x, y + r + 20); }
}
function lcd(ctx, x, y, w, h, title, value, unit, col = "#4ade80") {
  ctx.fillStyle = "#0b1220"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(title, x + 9, y + 15);
  ctx.fillStyle = col; ctx.font = MONO(Math.min(26, h * 0.5)); ctx.textAlign = "right"; ctx.fillText(value, x + w - 34, y + h - 11);
  ctx.fillStyle = "#cbd5e1"; ctx.font = BOLD; ctx.textAlign = "left"; ctx.fillText(unit, x + w - 28, y + h - 12);
}
/** O‘lchangan tok (kichik shovqin — haqiqiy asbobdagidek). */
function measuredI(U) {
  const I = P.fhCurrent(U, fh), h = Math.sin(U * 913.7 + fh.T * 3.1) * 43758.5453, r = h - Math.floor(h) - 0.5;
  return Math.max(0, I * (1 + 0.004 * r) + 0.03 * r);
}

/* ================================================================== 1) Frank–Gers */

function record() {
  const U = Math.round(fh.U * 20) / 20, I = measuredI(U);
  const i = fh.rec.findIndex((p) => Math.abs(p[0] - U) < 1e-6);
  if (i >= 0) fh.rec[i] = [U, I]; else fh.rec.push([U, I]);
  saveRec();
}
let recTimer = 0;
const saveRec = () => { clearTimeout(recTimer); recTimer = setTimeout(() => store.set(REC_KEY, { gas: fh.gas, T: fh.T, Ur: fh.Ur, pts: fh.rec }), 400); };
function setU(v) { fh.U = clamp(Math.round(v * 20) / 20, 0, P.GASES[fh.gas].Umax); fUC.set(fh.U); record(); }
function resetRec() { fh.rec = []; saveRec(); }
function stepFH(dt) {
  if (fh.scan) {
    const g = P.GASES[fh.gas], rate = g.Umax / 20; // ~20 s
    const n = Math.max(1, Math.round((dt * rate) / 0.05));
    for (let i = 0; i < n && fh.scan; i++) { setU(fh.U + 0.05); if (fh.U >= g.Umax - 1e-9) fh.scan = false; }
  }
}
// elektronlar (ko‘rgazmali)
const EL = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 2 - 1, f: 0 }));
function drawFH(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560, g = P.GASES[fh.gas];
  const tubeW = narrow ? cw - 24 : Math.min(cw * 0.62, 560), x0 = 12, tx = x0 + 10, ty = narrow ? 76 : 40, tw = tubeW - 20, th = narrow ? 120 : clamp(ch * 0.5, 120, 200);
  const xc = tx + 24, xg = tx + tw * 0.78, xa = tx + tw - 18, ymid = ty + th / 2;
  geo.fh = { chips: [] };
  // pech (simob)
  if (fh.gas === "Hg") {
    const hot = (fh.T - 140) / 60;
    ctx.fillStyle = c.dark ? `rgba(251,146,60,${0.08 + 0.1 * hot})` : `rgba(251,146,60,${0.1 + 0.12 * hot})`; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x0, ty - 14, tubeW, th + 28, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(`Pech: T = ${fh.T} °C`, x0 + 8, ty - 3);
  }
  // shisha ballon
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.14)"; ctx.strokeStyle = c.text3; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, th / 2.2); ctx.fill(); ctx.stroke();
  // yorug‘ qatlamlar (uyg‘otish joylari)
  const layers = P.glowLayers(fh.U, fh.gas, fh.T);
  layers.forEach((f) => {
    const x = xc + (xg - xc) * f, wdt = Math.max(6, (xg - xc) * 0.05);
    const gr = ctx.createLinearGradient(x - wdt * 2, 0, x + wdt * 2, 0), col = g.visible ? "251,146,60" : "167,139,250", a = g.visible ? 0.75 : 0.32;
    gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr; ctx.fillRect(x - wdt * 2, ty + 8, wdt * 4, th - 16);
  });
  if (!g.visible && layers.length) tagIn(ctx, "UB nurlanish λ ≈ 254 nm (ko‘zga ko‘rinmaydi)", tx + tw / 2, ty + th - 10, cw, { color: "#7c3aed", bg: c.bg, align: "center", font: SMALL, pad: 4 });
  // elektronlar
  ctx.fillStyle = c.dark ? "#93c5fd" : "#1d4ed8";
  EL.forEach((e) => { const x = xc + (xa - xc) * e.x, y = ymid + e.y * (th * 0.3); circle(ctx, x, y, 1.6); ctx.fill(); });
  // katod (qizigan spiral)
  ctx.strokeStyle = "#f97316"; ctx.lineWidth = 2.2; ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const yy = ymid - th * 0.28 + (th * 0.56 * i) / 40, xx = xc - 6 + Math.sin(i * 1.2) * 4; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = "#fb923c"; circle(ctx, xc - 6, ymid, th * 0.22); ctx.fill(); ctx.restore();
  // to‘r va anod
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(xg, ty + 10); ctx.lineTo(xg, ty + th - 10); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.text2; ctx.fillRect(xa - 3, ty + 14, 6, th - 28);
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("katod", xc - 6, ty + th + 4); ctx.fillText("to‘r", xg, ty + th + 4); ctx.fillText("anod", xa, ty + th + 4);
  ctx.fillText(`${g.name} ${fh.gas === "Hg" ? "bug‘i" : "gazi"}`, (xc + xg) / 2, ty + 6);
  // zanjir
  const yb = ty + th + (narrow ? 26 : 36);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.4; ctx.beginPath();
  ctx.moveTo(xc - 6, ty + th); ctx.lineTo(xc - 6, yb); ctx.lineTo(xg, yb); ctx.lineTo(xg, ty + th);
  ctx.moveTo(xg + 4, yb); ctx.lineTo(xa, yb); ctx.lineTo(xa, ty + th); ctx.stroke();
  const bat = (x, label) => { ctx.fillStyle = c.bg; ctx.fillRect(x - 10, yb - 9, 20, 18); ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 3, yb - 9); ctx.lineTo(x - 3, yb + 9); ctx.moveTo(x + 3, yb - 5); ctx.lineTo(x + 3, yb + 5); ctx.stroke(); ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x, yb + 11); };
  bat((xc + xg) / 2, `U = ${fmt(fh.U, 2)} V`); bat((xg + xa) / 2 - 8, `Uᵣ = ${fmt(fh.Ur, 1)} V`);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 1.6; circle(ctx, xa, yb, 9); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("A", xa, yb + 0.5);
  // asboblar va boshqaruv
  const I = measuredI(fh.U);
  if (narrow) {
    lcd(ctx, 8, 8, cw / 2 - 12, 50, "VOLTMETR", fmt(fh.U, 2), "V", "#60a5fa");
    lcd(ctx, cw / 2 + 4, 8, cw / 2 - 12, 50, "NANOAMPERMETR", fmt(I, 1), "nA");
    const yy = ch - 32, bw = (cw - 16 - 5 * 4) / 6; let xx = 8;
    [["−1", -1], ["−0,1", -0.1], ["−0,05", -0.05], ["+0,05", 0.05], ["+0,1", 0.1], ["+1", 1]].forEach(([t, d]) => { const b = chipBtn(ctx, c, xx, yy, t, false, bw, 26); geo.fh.chips.push({ ...b, d }); xx += bw + 4; });
    return;
  }
  const px = x0 + tubeW + 18, pw = cw - px - 10;
  lcd(ctx, px, 10, pw, 56, "VOLTMETR · tezlatuvchi U", fmt(fh.U, 2), "V", "#60a5fa");
  lcd(ctx, px, 74, pw, 56, "NANOAMPERMETR · anod toki I", fmt(I, 2), "nA");
  const kr = 22, kx = px + kr + 14, ky = 160 + kr;
  knob(ctx, c, kx, ky, kr, fh.U / g.Umax, "U dastagi", ""); geo.fh.knob = { x: kx, y: ky, r: kr + 10 };
  let yy = 146; const bx = kx + kr + 22, bw = Math.max(46, (px + pw - bx - 8) / 2);
  [["+1 V", 1], ["−1 V", -1], ["+0,1", 0.1], ["−0,1", -0.1], ["+0,05", 0.05], ["−0,05", -0.05]].forEach(([t, d], i) => { const b = chipBtn(ctx, c, bx + (i % 2) * (bw + 6), yy + Math.floor(i / 2) * 30, t, false, bw, 26); geo.fh.chips.push({ ...b, d }); });
  const sb = chipBtn(ctx, c, px, ch - 36, fh.scan ? "■ Skanerlashni to‘xtatish" : "▶ Avtomatik skanerlash", fh.scan, pw, 28); geo.fh.chips.push({ ...sb, scan: true });
}
function drawGraphFH(ctx, gst) {
  const c = gst.colors, g = P.GASES[fh.gas], pts = fh.rec.slice().sort((a, b) => a[0] - b[0]);
  const imax = Math.max(5, ...pts.map((p) => p[1]), measuredI(fh.U)) * 1.1, yt = ticks(0, imax, 4);
  const f = frame(ctx, gst, { xMin: 0, xMax: g.Umax, yMin: 0, yMax: imax, xTicks: ticks(0, g.Umax, 8).values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "U, V", yLabel: "I, nA" });
  geo.graph = f;
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  ctx.strokeStyle = c.primary; ctx.lineWidth = 1.8; ctx.beginPath();
  let prev = null; pts.forEach((p) => { const X = f.X(p[0]), Y = f.Y(p[1]); if (prev && p[0] - prev > 0.3) ctx.moveTo(X, Y); else if (!prev) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); prev = p[0]; }); ctx.stroke();
  ctx.fillStyle = c.primary; if (pts.length < 120) pts.forEach((p) => { circle(ctx, f.X(p[0]), f.Y(p[1]), 2); ctx.fill(); });
  // joriy nuqta
  ctx.fillStyle = c.danger; circle(ctx, f.X(fh.U), f.Y(measuredI(fh.U)), 4.5); ctx.fill();
  // kursor
  if (fh.cursor !== null && pts.length) {
    const U = (fh.cursor - f.rect.x) / f.rect.w * g.Umax; let best = pts[0]; pts.forEach((p) => { if (Math.abs(p[0] - U) < Math.abs(best[0] - U)) best = p; });
    ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.X(best[0]), f.rect.y); ctx.lineTo(f.X(best[0]), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    tagIn(ctx, `U = ${fmt(best[0], 2)} V · I = ${fmt(best[1], 2)} nA`, f.X(best[0]) + 8, f.rect.y + 12, gst.w, { color: c.text, bg: c.bg2, align: "left", font: BOLD, pad: 6 });
    return;
  }
  ctx.restore();
  if (!pts.length) { ctx.fillStyle = c.text3; ctx.font = MID; ctx.textAlign = "center"; ctx.fillText("Kuchlanishni o‘zgartiring yoki «Avtomatik skanerlash» ni bosing", f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2); }
}

/* ================================================================== 2) Spektrometr */

const LINE_NAME = { a: "qizil", b: "havorang", g: "ko‘k-binafsha", d: "binafsha" };
function nearestLine() { const v = P.linesInView(sp.phi, sp.gr); let best = null; v.forEach((o) => { if (o.line && (!best || Math.abs(o.off) < Math.abs(best.off))) best = o; }); return best; }
function setPhi(v) { sp.phi = clamp(Math.round(v * 100) / 100, -70, 70); sPhiC.set(sp.phi); }
function drawSpec(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  const R = narrow ? Math.min(cw * 0.42, ch * 0.36) : Math.min(ch * 0.44, cw * 0.27), cx = narrow ? cw / 2 : 18 + R + 28, cy = narrow ? 18 + R + 4 : ch / 2 + 6;
  geo.sp = { cx, cy, R, chips: [] };
  // stol va shkala
  ctx.fillStyle = c.dark ? "#141b2b" : "#f3f6fb"; circle(ctx, cx, cy, R); ctx.fill();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1;
  for (let a = -80; a <= 80; a += 1) {
    const r0 = a % 10 === 0 ? R - 12 : a % 5 === 0 ? R - 8 : R - 5, ang = -a * DEG; // o‘ngga 0°, yuqoriga musbat
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.lineTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.stroke();
    if (a % 20 === 0) { ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${a}°`, cx + Math.cos(ang) * (R - 22), cy + Math.sin(ang) * (R - 22)); }
  }
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; circle(ctx, cx, cy, R); ctx.stroke();
  // difraksiyalangan nurlar
  const d = P.GRATINGS[sp.gr].d;
  ctx.save(); ctx.globalAlpha = c.dark ? 0.55 : 0.4;
  for (const Ln of P.LINES) for (const k of [-3, -2, -1, 1, 2, 3]) { const a = P.diffAngle(P.balmerNm(Ln.n), k, d); if (a === null || Math.abs(a) > 80) continue; ctx.strokeStyle = Ln.color; ctx.lineWidth = 1.2 * Ln.I + 0.4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(-a * DEG) * (R - 14), cy + Math.sin(-a * DEG) * (R - 14)); ctx.stroke(); }
  ctx.strokeStyle = c.dark ? "#fff" : "#94a3b8"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R - 14, cy); ctx.stroke();
  ctx.restore();
  // lampa va kollimator
  const lx = cx - R - 6;
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; ctx.fillRect(cx - R * 0.95, cy - 6, R * 0.7, 12);
  ctx.save(); ctx.shadowColor = "#e879f9"; ctx.shadowBlur = 14; ctx.fillStyle = "#f0abfc"; ctx.beginPath(); ctx.roundRect(lx - 8, cy - 26, 12, 52, 6); ctx.fill(); ctx.restore();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("H₂ lampa", lx - 2, cy + 30);
  // panjara
  ctx.fillStyle = c.text; ctx.fillRect(cx - 2, cy - 14, 4, 28);
  // teleskop
  const ta = -(sp.phi - P.ZERO_OFFSET) * DEG, tl = R * 0.98;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ta);
  ctx.fillStyle = c.dark ? "#475569" : "#334155"; ctx.beginPath(); ctx.roundRect(R * 0.25, -7, tl - R * 0.25, 14, 4); ctx.fill();
  ctx.fillStyle = c.primary; ctx.fillRect(tl - 4, -9, 8, 18);
  ctx.restore();
  const hx = cx + Math.cos(ta) * (tl + 8), hy = cy + Math.sin(ta) * (tl + 8);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; circle(ctx, hx, hy, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.primary; circle(ctx, hx, hy, 2.5); ctx.fill();
  geo.sp.arm = { x: hx, y: hy, r: 18 };
  // okulyar
  const er = narrow ? Math.min(64, cw * 0.17) : Math.min(78, ch * 0.24), ex = narrow ? 12 + er : cx + R + 40 + er, ey = narrow ? cy + R + 24 + er : 16 + er;
  drawEyepiece(ctx, c, ex, ey, er);
  geo.sp.eye = { x: ex, y: ey, r: er };
  // shkala o‘qishi va aniq burash tugmalari (3×2)
  const colX = narrow ? ex + er + 14 : ex - er - 6, colW = narrow ? cw - colX - 10 : 2 * er + 12, ry = narrow ? ey - er : ey + er + 10;
  lcd(ctx, colX, ry, colW, 44, "SHKALA φ", fmt(sp.phi, 2), "°", "#fbbf24");
  const bw = (colW - 2 * 4) / 3;
  [["−1°", -1], ["−0,1°", -0.1], ["−0,01°", -0.01], ["+1°", 1], ["+0,1°", 0.1], ["+0,01°", 0.01]].forEach(([t, dd], i) => { const b = chipBtn(ctx, c, colX + (i % 3) * (bw + 4), ry + 52 + Math.floor(i / 3) * 30, t, false, bw, 26); geo.sp.chips.push({ ...b, d: dd }); });
  // energiya sathlari
  if (!narrow) {
    const lx0 = ex + er + 28, lw = cw - lx0 - 10;
    if (lw > 120) drawLevels(ctx, c, lx0, 16, lw, ch - 32);
  }
}
function drawEyepiece(ctx, c, ex, ey, er) {
  const fov = 1.2, v = P.linesInView(sp.phi, sp.gr, fov);
  ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.clip();
  ctx.fillStyle = "#020409"; ctx.fillRect(ex - er, ey - er, 2 * er, 2 * er);
  v.forEach((o) => {
    const x = ex + (o.off / fov) * er, col = o.line ? o.line.color : "#ffffff", a = o.line ? 0.35 + 0.65 * o.line.I / (Math.abs(o.k) === 1 ? 1 : 1.6) : 0.9;
    const gr = ctx.createLinearGradient(x - 7, 0, x + 7, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.fillRect(x - 7, ey - er, 14, 2 * er); ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex, ey - er); ctx.lineTo(ex, ey + er); ctx.moveTo(ex - er, ey); ctx.lineTo(ex + er, ey); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 3; circle(ctx, ex, ey, er); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("okulyar", ex, ey - er - 3);
}
function drawLevels(ctx, c, x, y, w, h) {
  const ns = [1, 2, 3, 4, 5, 6], Emin = -14.2, Emax = 0.6, Y = (E) => y + 14 + ((Emax - E) / (Emax - Emin)) * (h - 28);
  // n = 1 juda pastda — siqilgan shkala: yuqori sathlarni kengaytirish uchun 2 qism
  const Yl = (n) => (n === 1 ? y + h - 10 : y + 18 + ((0 - P.levelEv(n)) / 3.6) * (h - 70));
  ctx.fillStyle = c.text2; ctx.font = BOLD; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Vodorod sathlari", x, y + 4);
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x + w, y + 18); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.fillText("n = ∞, E = 0", x + w - 70, y + 14);
  ns.forEach((n) => {
    const yy = Yl(n); ctx.strokeStyle = c.text; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + 40, yy); ctx.lineTo(x + w, yy); ctx.stroke();
    ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.fillText(`n=${n}`, x, yy + 3); ctx.textAlign = "right"; ctx.fillText(`${fmt(P.levelEv(n), 2)} eV`, x + w, yy - 3);
  });
  if (Math.abs(Yl(2) - Yl(1)) > 30) { ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.fillText("⋮ (shkala uzilgan)", x + w / 2 + 20, (Yl(2) + Yl(1)) / 2); }
  const nl = nearestLine(), active = nl && Math.abs(nl.off) < 0.2 ? nl.line : null;
  P.LINES.forEach((Ln, i) => {
    const xx = x + 56 + i * ((w - 70) / 4), y1 = Yl(Ln.n), y2 = Yl(2), on = active && active.id === Ln.id;
    ctx.globalAlpha = on ? 1 : 0.35; arrow(ctx, xx, y1, 0, y2 - y1, Ln.color, { width: on ? 3 : 2, head: 8 }); ctx.globalAlpha = 1;
  });
  if (active) tagIn(ctx, `hν = E${"₃₄₅₆"[active.n - 3]} − E₂ = ${fmt(P.levelEv(active.n) - P.levelEv(2), 3)} eV`, x + w / 2 + 20, Yl(2) + 22, x + w + 10, { color: c.text, bg: c.bg2, align: "center", font: BOLD, pad: 5 });
}
function recordPhi() {
  const nl = nearestLine();
  journal.push({ id: (journal.at(-1)?.id || 0) + 1, gr: sp.gr, phi: sp.phi, line: nl && Math.abs(nl.off) < 0.6 ? nl.line.id : null, k: nl ? nl.k : null });
  if (journal.length > 200) journal.shift();
  store.set(J_KEY, journal); renderJournal(true); nbRecalc();
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) { ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h); if (ui.mode === "fh") drawFH(ctx, st); else drawSpec(ctx, st); }
const heights = (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(Math.min(cw * 0.5, vh * 0.5), cw < 560 ? 330 : 300, 400)), graph: Math.round(clamp(vh * 0.28, 180, 250)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => (ui.mode === "spec" && cw < 560 ? Math.round(cw * 0.84 + 200) : heights(cw).stage) });
const graph = createStage($("#graph"), (ctx, gst) => (ui.mode === "fh" ? drawGraphFH(ctx, gst) : null), { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;
function updateReadouts() {
  if (ui.mode === "fh") {
    const g = P.GASES[fh.gas], layers = P.glowLayers(fh.U, fh.gas, fh.T).length;
    setRO("r1", "Tezlatuvchi kuchlanish <i>U</i>", u(fmt(fh.U, 2), "V"), `0…${g.Umax} V`);
    setRO("r2", "Anod toki <i>I</i>", u(fmt(measuredI(fh.U), 2), "nA"), "nanoampermetr");
    setRO("r3", "Yozib olingan nuqtalar", String(fh.rec.length), fh.rec.length ? "grafikda — kursor bilan o‘qing" : "kuchlanishni o‘zgartiring", fh.rec.length ? "" : "muted");
    setRO("r4", "Gaz", `${g.id}<small> ${g.name.toLowerCase()}</small>`, fh.gas === "Hg" ? `pech T = ${fh.T} °C` : "xona harorati");
    setRO("r5", "Tormozlovchi kuchlanish <i>U<sub>r</sub></i>", u(fmt(fh.Ur, 1), "V"), "to‘r → anod");
    setRO("r6", "Uyg‘otish qatlamlari", String(layers), g.visible ? "neonda ko‘rinadi (to‘q sariq)" : "simobda UB — ko‘rinmaydi", layers ? "purple" : "muted");
  } else {
    const nl = nearestLine(), inC = nl && Math.abs(nl.off) < 0.006, gr = P.GRATINGS[sp.gr];
    setRO("r1", "Shkala o‘qishi <i>φ</i>", u(fmt(sp.phi, 2), "°"), "goniometr, aniqlik 0,01°");
    setRO("r2", "Difraksion panjara", u(String(sp.gr), "chiziq/mm"), `d = ${fmt(gr.d * 1e6, 4)} µm`);
    setRO("r3", "Ko‘rish maydonidagi chiziq", nl ? `${nl.line.plain}<small> ${LINE_NAME[nl.line.id]}</small>` : "—", nl ? `${nl.k > 0 ? "o‘ng" : "chap"} tomon, ${Math.abs(nl.k)}-tartib` : "chiziq yo‘q", nl ? "" : "muted");
    setRO("r4", "Vizir", inC ? "markazda" : nl ? "siljigan" : "—", inC ? "«Yozib olish» ni bosing" : "aniq burash tugmalaridan foydalaning", inC ? "green" : "orange");
    setRO("r5", "Jurnal yozuvlari", String(journal.length), "goniometr o‘qishlari");
    setRO("r6", "Sath energiyasi", u("−13,6 / n²", "eV"), "Bor modeli bo‘yicha");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "fh") { t = fh.scan ? "Skanerlanmoqda…" : `Yozib olindi: ${fh.rec.length} nuqta`; tone = fh.scan ? "green" : "blue"; }
  else { const nl = nearestLine(); t = nl && Math.abs(nl.off) < 0.006 ? `${nl.line.plain} chizig‘i vizirda` : "Chiziqni vizirga keltiring"; tone = nl && Math.abs(nl.off) < 0.006 ? "green" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "fh") {
    p.push("<p>Qizigan katoddan chiqqan elektronlar to‘rgacha <b>U</b> kuchlanish bilan tezlashadi, to‘r va anod orasida esa kichik tormozlovchi kuchlanish U<sub>r</sub> bor. Elektron energiyasi atomning birinchi uyg‘otish energiyasidan kichik bo‘lsa, to‘qnashuvlar elastik — energiya yo‘qolmaydi va anod toki U bilan ortadi.</p>");
    p.push("<p>Energiya E₁ ga yetganda elektron uni <b>to‘liq</b> atomga beradi va anodga yeta olmaydi — tok keskin kamayadi. U yana E₁/e ga ortganda elektron ikki marta uyg‘otadi va hokazo. Maksimumlar teng oraliqda takrorlanadi: atom energiyani faqat aniq porsiyalarda qabul qiladi (Borning 1-postulati). Neonda uyg‘ongan atomlar nurlanadigan qatlamlar ko‘zga ko‘rinadi.</p>");
  } else {
    p.push("<p>Vodorod lampasidagi atomlar yuqori sathlardan n = 2 sathga o‘tganda <b>Balmer seriyasi</b> fotonlarini chiqaradi: hν = E<sub>n</sub> − E<sub>2</sub> (Borning 2-postulati). Difraksion panjara har bir to‘lqin uzunligini d·sinφ = kλ burchakka yo‘naltiradi.</p>");
    p.push("<p>Teleskopni burab, chiziqni okulyardagi vizir chizig‘iga keltiring va shkalani o‘qing. Bir chiziqni chap va o‘ng tomonda o‘lchab, φ = (φ<sub>o‘ng</sub> − φ<sub>chap</sub>)/2 ni toping — shkala nol nuqtasining siljishi shunday yo‘qotiladi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() { const html = ui.mode === "fh" ? "<small>Frank–Gers</small> E₁ = eΔU" : "<small>Balmer</small> 1/λ = R(1/4 − 1/n²)"; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() {
  const t = ui.mode === "fh" ? (fh.scan ? "To‘xtatish" : "Avtomatik skanerlash") : "Yozib olish";
  if (actBtn.textContent !== t) actBtn.textContent = t;
  const r = ui.mode === "fh" ? "Grafikni tozalash" : "Nolga qaytarish"; if (resetBtn.textContent !== r) resetBtn.textContent = r;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Jurnal */

const jEl = $("[data-journal]");
function renderJournal(fresh = false) {
  jEl.innerHTML = journal.slice().reverse().map((j, i) => { const L0 = j.line ? P.LINES.find((l) => l.id === j.line) : null; return `<li class="${fresh && i === 0 ? "is-new" : ""}"><span class="lab-journal__n">${j.id}</span><span class="lab-journal__m">${j.gr} chiziq/mm${L0 ? ` · ${L0.plain} (${j.k > 0 ? "o‘ng" : "chap"}, k = ${Math.abs(j.k)})` : ""}</span><span class="lab-journal__v">φ = ${fmt(j.phi, 2)}°</span></li>`; }).join("");
}
$("[data-journal-clear]").addEventListener("click", () => { if (!journal.length || !confirm("Goniometr jurnalini tozalaysizmi?")) return; journal = []; store.set(J_KEY, journal); renderJournal(); nbRecalc(); });

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  ui.t += dt;
  if (ui.mode === "fh") {
    stepFH(dt);
    const g = P.GASES[fh.gas], W = Math.max(0.3, fh.U - g.Uc), lay = P.glowLayers(fh.U, fh.gas, fh.T);
    EL.forEach((e) => { e.x += dt * (0.15 + 0.06 * Math.sqrt(W)) * (0.6 + 0.8 * ((e.f = (e.f + dt * 3) % 1))); if (lay.some((f) => Math.abs(e.x / 0.88 - f) < 0.01)) e.x += 0.012; if (e.x > 1) { e.x = 0; e.y = Math.random() * 2 - 1; } });
  }
  stage.render(); if (fh.scan) graph.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); updateAction(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.addEventListener("click", () => loop.toggle());
resetBtn.addEventListener("click", () => { if (ui.mode === "fh") { fh.scan = false; resetRec(); setU(0); } else setPhi(0); customized(); refresh(); });
actBtn.addEventListener("click", () => {
  if (ui.mode === "fh") { if (fh.scan) fh.scan = false; else { if (fh.U >= P.GASES[fh.gas].Umax - 0.01) setU(0); fh.scan = true; if (!loop.running) loop.start(); } }
  else recordPhi();
  customized(); refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const fUC = bindRange($("#fU"), $("#fUOut"), (v) => `${fmt(v, 2)} V`, (v) => { fh.U = v; record(); customized(); refresh(); });
const fTC = bindRange($("#fT"), $("#fTOut"), (v) => `${fmt(v, 0)} °C`, (v) => { fh.T = v; condChanged(); });
const fUrC = bindRange($("#fUr"), $("#fUrOut"), (v) => `${fmt(v, 1)} V`, (v) => { fh.Ur = Math.round(v * 10) / 10; condChanged(); });
const sPhiC = bindRange($("#sPhi"), $("#sPhiOut"), (v) => `${fmt(v, 2)}°`, (v) => { sp.phi = v; customized(); refresh(); });
/** Sharoit o‘zgarsa — eski egri chiziq boshqa sharoitga tegishli, tozalanadi. */
function condChanged() { fh.scan = false; resetRec(); record(); customized(); refresh(); }
document.querySelectorAll("[data-gas-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.gasValue === fh.gas) return; fh.gas = b.dataset.gasValue; setGasUI(); fh.U = 0; condChanged(); syncAll(); }));
document.querySelectorAll("[data-gr-value]").forEach((b) => b.addEventListener("click", () => { sp.gr = +b.dataset.grValue; syncAll(); customized(); refresh(); }));
function setGasUI() { const g = P.GASES[fh.gas]; const r = $("#fU"); r.max = g.Umax; document.querySelectorAll("[data-hg-only]").forEach((el) => { el.hidden = fh.gas !== "Hg"; }); }

/* Sahnadagi boshqaruv */
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0, dragX0 = 0;
const ptr = (e, cv = canvas) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const hitR = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r;
function hitTest(p) {
  if (ui.mode === "fh") { const g = geo.fh || {}; for (const ch of g.chips || []) if (inBox(p, ch)) return { k: "chip", ch }; if (hitR(p, g.knob)) return { k: "knob" }; return null; }
  const g = geo.sp || {}; for (const ch of g.chips || []) if (inBox(p, ch)) return { k: "chip", ch };
  if (hitR(p, g.eye)) return { k: "eye" }; if (hitR(p, g.arm)) return { k: "arm" };
  if (g.cx !== undefined) { const r = Math.hypot(p.x - g.cx, p.y - g.cy), a = -Math.atan2(p.y - g.cy, p.x - g.cx) / DEG + P.ZERO_OFFSET; if (r > g.R * 0.3 && r < g.R * 1.05 && Math.abs(a - sp.phi) < 4) return { k: "arm" }; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  if (h.k === "chip") {
    const ch = h.ch;
    if (ui.mode === "fh") { if (ch.scan) { actBtn.click(); return; } fh.scan = false; setU(fh.U + ch.d); }
    else setPhi(sp.phi + ch.d);
    customized(); refresh(); return;
  }
  drag = h.k; dragY0 = p.y; dragX0 = p.x; dragV0 = ui.mode === "fh" ? fh.U : sp.phi;
  if (ui.mode === "fh") fh.scan = false;
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  e.preventDefault(); onDrag(p);
});
function onDrag(p) {
  if (drag === "knob") setU(dragV0 + (dragY0 - p.y) * (P.GASES[fh.gas].Umax / 300));
  else if (drag === "arm") { const g = geo.sp, a = -Math.atan2(p.y - g.cy, p.x - g.cx) / DEG + P.ZERO_OFFSET; setPhi(Math.round(a * 10) / 10); }
  else if (drag === "eye") setPhi(dragV0 - (p.x - dragX0) * (1.2 / geo.sp.eye.r) * 0.25);
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? (h.k === "chip" ? "pointer" : h.k === "knob" ? "ns-resize" : h.k === "eye" ? "ew-resize" : "grab") : ""; return; } onDrag(p); });
function endDrag() { drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
// grafik kursori
graph.canvas.addEventListener("pointermove", (e) => { const p = ptr(e, graph.canvas), f = geo.graph; fh.cursor = f && p.x >= f.rect.x && p.x <= f.rect.x + f.rect.w ? p.x : null; graph.render(); });
graph.canvas.addEventListener("pointerleave", () => { fh.cursor = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  hg: { mode: "fh", title: "Frank–Gers: simob", lesson: "Simob bug‘i, pech 170 °C. «Avtomatik skanerlash» ni bosing yoki dastakni burab kuchlanishni oshiring: anod tokida teng oraliqli maksimumlar paydo bo‘ladi. Ularni grafikdan o‘qib 1-jadvalga yozing.", set: () => Object.assign(fh, { gas: "Hg", T: 170, Ur: 1.5 }) },
  hgCold: { mode: "fh", title: "Past harorat: 140 °C", lesson: "Bug‘ siyrak — elektronlar uyg‘otishdan oldin ko‘proq energiya to‘playdi, tushishlar yumshoqroq. Maksimumlar orasidagi masofa o‘zgarmaydi.", set: () => Object.assign(fh, { gas: "Hg", T: 140, Ur: 1.5 }) },
  ne: { mode: "fh", title: "Frank–Gers: neon (yorug‘ qatlamlar)", lesson: "Neonda uyg‘otish energiyasi ~18,7 eV. Kuchlanish oshgan sari trubkada to‘q sariq yorug‘ qatlamlar paydo bo‘ladi — har biri bir marta uyg‘otishga mos.", set: () => Object.assign(fh, { gas: "Ne", T: 20, Ur: 1.5 }) },
  balmer: { mode: "spec", title: "Spektrometr: Balmer seriyasi", lesson: "Teleskopni o‘ngga burab qizil Hα chizig‘ini toping (≈ 23,5° atrofida), okulyar ostidagi tugmalar bilan vizirga keltiring va «Yozib olish» ni bosing. So‘ng xuddi shu chiziqni chap tomonda o‘lchang.", set: () => Object.assign(sp, { gr: 600, phi: 20 }) },
  balmer300: { mode: "spec", title: "300 chiziq/mm panjara", lesson: "Panjara davri 2 marta katta — burchaklar kichikroq, lekin 2- va 3-tartibli chiziqlar ham ko‘rinadi.", set: () => Object.assign(sp, { gr: 300, phi: 10 }) },
};
const GROUPS = [["1. Frank–Gers", ["hg", "hgCold", "ne"]], ["2. Vodorod spektri", ["balmer", "balmer300"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }
function syncAll() {
  setGasUI(); fUC.set(fh.U); fTC.set(fh.T); fUrC.set(fh.Ur); sPhiC.set(sp.phi);
  const pr = (attr, v) => document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[`${attr}Value`] === String(v))));
  pr("gas", fh.gas); pr("gr", sp.gr);
}
const MODE_HINT = { fh: "Dastak, ±tugmalar yoki avtomatik skanerlash; grafikda kursor bilan o‘qing", spec: "Teleskopni suring; okulyarda yoki tugmalar bilan aniq buring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  $("[data-graph-card]").hidden = ui.mode !== "fh";
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  window.dispatchEvent(new Event("resize"));
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(b.dataset.modeValue === "fh" ? "hg" : "balmer"); }));
function loadPreset(id) {
  const p = PRESETS[id]; drag = null; fh.scan = false;
  const before = condKey(); ui.mode = p.mode; p.set();
  if (p.mode === "fh" && condKey() !== before) { resetRec(); fh.U = 0; }
  setModeUI(); presetId = id; setPresetPressed(id); $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

/* ================================================================== Laboratoriya daftari */

const NB_KEY = "of-bohr-nb-v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blank1 = (k) => ({ k: k ? String(k) : "", U: "" }), blank2 = () => ({ line: "", k: "1", pL: "", pR: "" });
const nb = Object.assign({ f: { name: "", group: "", school: "", teacher: "", date: today(), conclusion: "" }, c1: { gas: "Hg", T: 170, Ur: 1.5 }, c2: { gr: 600 }, t1: [1, 2, 3, 4, 5].map(blank1), t2: Array.from({ length: 4 }, blank2) }, store.get(NB_KEY, {}));
const saveNb = () => store.set(NB_KEY, nb);
const num = (s) => { const v = parseFloat(String(s).replace(",", ".").replace("−", "-")); return Number.isFinite(v) ? v : NaN; };

document.querySelectorAll("[data-f]").forEach((el) => { el.value = nb.f[el.dataset.f] || ""; el.addEventListener("input", () => { nb.f[el.dataset.f] = el.value; saveNb(); nbProgress(); }); });
const c1 = { gas: $('[data-c="gas"]'), T: $('[data-c="T"]'), Ur: $('[data-c="Ur"]') }, c2 = { gr: $('[data-c="gr"]') };
c1.T.innerHTML = Array.from({ length: 13 }, (_, i) => 140 + 5 * i).map((v) => `<option value="${v}">${v}</option>`).join("");
c1.Ur.innerHTML = Array.from({ length: 26 }, (_, i) => Math.round((0.5 + 0.1 * i) * 10) / 10).map((v) => `<option value="${v}">${fmt(v, 1)}</option>`).join("");
function syncCondUI() { c1.gas.value = nb.c1.gas; c1.T.value = String(nb.c1.T); c1.Ur.value = String(nb.c1.Ur); c2.gr.value = String(nb.c2.gr); $("[data-c-hg]").hidden = nb.c1.gas !== "Hg"; }
Object.entries(c1).forEach(([k, el]) => el.addEventListener("change", () => { nb.c1[k] = k === "gas" ? el.value : +el.value; syncCondUI(); saveNb(); nbRecalc(); }));
c2.gr.addEventListener("change", () => { nb.c2.gr = +c2.gr.value; saveNb(); nbRecalc(); });
$("[data-cond-sync]").addEventListener("click", () => { nb.c1 = { gas: fh.gas, T: fh.T, Ur: fh.Ur }; syncCondUI(); saveNb(); nbRecalc(); });
$("[data-cond-sync2]").addEventListener("click", () => { nb.c2 = { gr: sp.gr }; syncCondUI(); saveNb(); nbRecalc(); });

const t1Body = $("[data-t1] tbody"), t2Body = $("[data-t2] tbody");
const inp = (key, val, mode = "decimal") => `<input data-k="${key}" inputmode="${mode}" value="${String(val ?? "").replace(/"/g, "&quot;")}" aria-label="${key}">`;
const sel = (key, val, opts) => `<select data-k="${key}" aria-label="${key}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(val) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
function renderT1() { t1Body.innerHTML = nb.t1.map((r, i) => `<tr data-i="${i}"><td class="lab-idx">${i + 1}</td><td>${inp("k", r.k, "numeric")}</td><td>${inp("U", r.U)}</td><td class="lab-calc" data-o="dU"></td><td data-o="j"></td><td><button class="lab-del" type="button" data-del="t1" aria-label="Qatorni o‘chirish">×</button></td></tr>`).join(""); }
function renderT2() {
  const lines = [["", "— tanlang —"], ...P.LINES.map((l) => [l.id, `${l.plain} (${LINE_NAME[l.id]})`])], ks = [[1, "1"], [2, "2"], [3, "3"]];
  t2Body.innerHTML = nb.t2.map((r, i) => `<tr data-i="${i}"><td class="lab-idx">${i + 1}</td><td>${sel("line", r.line, lines)}</td><td>${sel("k", r.k, ks)}</td><td>${inp("pL", r.pL, "text")}</td><td>${inp("pR", r.pR, "text")}</td><td class="lab-calc" data-o="phi"></td><td class="lab-calc" data-o="lam"></td><td class="lab-calc" data-o="R"></td><td data-o="j"></td><td><button class="lab-del" type="button" data-del="t2" aria-label="Qatorni o‘chirish">×</button></td></tr>`).join("");
}
function onTableInput(e, tbl) { const el = e.target.closest("[data-k]"), tr = e.target.closest("tr[data-i]"); if (!el || !tr) return; nb[tbl][+tr.dataset.i][el.dataset.k] = el.value; saveNb(); nbRecalc(); }
t1Body.addEventListener("input", (e) => onTableInput(e, "t1")); t2Body.addEventListener("input", (e) => onTableInput(e, "t2")); t2Body.addEventListener("change", (e) => onTableInput(e, "t2"));
document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-del]"); if (d) { const tbl = d.dataset.del, i = +d.closest("tr").dataset.i; nb[tbl].splice(i, 1); if (!nb[tbl].length) nb[tbl].push(tbl === "t1" ? blank1() : blank2()); saveNb(); tbl === "t1" ? renderT1() : renderT2(); nbRecalc(); return; }
  const a = e.target.closest("[data-add]"); if (a) { const tbl = a.dataset.add; if (nb[tbl].length >= 12) return; nb[tbl].push(tbl === "t1" ? blank1(nb.t1.length + 1) : blank2()); saveNb(); tbl === "t1" ? renderT1() : renderT2(); nbRecalc(); }
});

let lastA = null, lastB = null, flags = { fh: [], bal: [] };
const parse1 = (r) => ({ k: num(r.k), U: num(r.U) }), parse2 = (r) => ({ line: r.line, k: +r.k, pL: num(r.pL), pR: num(r.pR), gr: nb.c2.gr });
const summary = (el, items) => { el.innerHTML = items.map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><small>${c}</small></div>`).join(""); };
function nbRecalc() {
  // 1-topshiriq
  const rows1 = nb.t1.map(parse1), cond1 = nb.c1; let filled = 0, bad = 0;
  const A = L.analyzeFH(rows1.map((r) => ({ ...r })), cond1); lastA = A;
  [...t1Body.rows].forEach((tr, i) => {
    const r = rows1[i], raw = nb.t1[i], any = raw.U !== "", ck = L.checkFH(r, cond1.gas), o = (k) => tr.querySelector(`[data-o="${k}"]`);
    tr.classList.toggle("is-bad", any && !ck.ok);
    if (ck.ok) { filled++; const ar = A.rows.find((q) => q.k === r.k && q.U === r.U); o("dU").textContent = ar && ar.dU !== null ? fmt(ar.dU, 2) : "—"; const mt = L.matchFH(r, cond1); o("j").innerHTML = mt ? '<span class="lab-ok" title="Haqiqiy maksimumga mos">✓</span>' : '<span class="lab-no" title="Bu k-maksimumdan ±0,3 V dan ko‘p farq qiladi">?</span>'; }
    else { o("dU").textContent = ""; o("j").textContent = any ? ck.err : ""; if (any) bad++; }
  });
  flags.fh = A.rows.map((r) => L.matchFH(r, cond1));
  const m1 = $("[data-t1-msg]"); m1.textContent = `${filled} ta maksimum${bad ? `, ${bad} ta xato` : ""}${filled ? ` · ${flags.fh.filter(Boolean).length} tasi tekshiruvdan o‘tdi` : ""}`; m1.dataset.tone = bad ? "red" : A.ok ? "green" : "";
  if (A.ok && A.fit) summary($("[data-t1-sum]"), [["Maksimumlar oralig‘i ΔU", `${fmt(A.dU, 3)} V`, `± ${fmt(Math.max(A.sdU, 0.001), 3)} V (EKK)`], ["Birinchi uyg‘otish energiyasi", `${fmt(A.dU, 2)} eV`, `E₁ = eΔU (${A.gas.id}: ${fmt(A.gas.E1, 2)} eV)`], ["Foton to‘lqin uzunligi", `${fmt(A.lam, 1)} nm`, "λ = hc/(eΔU)"], ["U₀ (kontakt + Uᵣ)", `${fmt(A.U0, 2)} V`, `± ${fmt(Math.max(A.sU0, 0.01), 2)} V`]]);
  else $("[data-t1-sum]").innerHTML = "";
  // 2-topshiriq
  const rows2 = nb.t2.map(parse2), B = L.analyzeBalmer(rows2, nb.c2); lastB = B; let f2 = 0, b2 = 0; flags.bal = [];
  [...t2Body.rows].forEach((tr, i) => {
    const r = rows2[i], raw = nb.t2[i], any = raw.pL !== "" || raw.pR !== "" || raw.line !== "", ck = L.checkBal(r), o = (k) => tr.querySelector(`[data-o="${k}"]`);
    tr.classList.toggle("is-bad", any && !ck.ok);
    if (ck.ok) { f2++; const q = B.rows[f2 - 1]; o("phi").textContent = fmt(q.phi, 3); o("lam").textContent = fmt(q.lamNm, 1); o("R").textContent = sci(q.R, 5); const mt = L.matchBal(r, journal); flags.bal.push(mt); o("j").innerHTML = mt ? '<span class="lab-ok" title="Ikkala burchak jurnalda bor">✓</span>' : '<span class="lab-no" title="Jurnalda topilmadi">?</span>'; }
    else { ["phi", "lam", "R"].forEach((k) => { o(k).textContent = ""; }); o("j").textContent = any ? ck.err : ""; if (any) b2++; }
  });
  const m2 = $("[data-t2-msg]"); m2.textContent = `${f2} ta qator${b2 ? `, ${b2} ta xato` : ""}${f2 ? ` · ${flags.bal.filter(Boolean).length} tasi jurnal bilan mos` : ""}`; m2.dataset.tone = b2 ? "red" : B.ok ? "green" : "";
  if (B.rows.length >= 2 && B.Rst) summary($("[data-t2-sum]"), [["Ridberg doimiysi R̄", `${sci(B.Rst.m, 5)} m⁻¹`, `± ${sci(Math.max(B.Rst.sm, 1), 2)}`], ["Nazariy R_H", `${sci(P.R_H, 5)} m⁻¹`, `farq ${fmt((100 * (B.Rst.m - P.R_H)) / P.R_H, 3)}%`], ["Ionlanish energiyasi", `${fmt(B.Eion, 2)} eV`, "E = hcR (nazariya 13,60 eV)"], ["Shkala nol siljishi", `${fmt(B.zero.m, 2)}°`, "(φ_o‘ng + φ_chap)/2"]]);
  else $("[data-t2-sum]").innerHTML = "";
  nbProgress();
}
function nbValid() {
  const e = [];
  if (!nb.f.name.trim()) e.push("F.I.Sh. kiritilmagan");
  if (!lastA || !lastA.ok) e.push("1-topshiriqda kamida 3 ta maksimum (turli k) kerak");
  if (!lastB || !lastB.ok) e.push("2-topshiriqda kamida 3 ta turli chiziq kerak");
  if (nb.f.conclusion.trim().length < 20) e.push("xulosa yozilmagan");
  return e;
}
let built = false;
function nbProgress() {
  const st = [["Bajaruvchi", !!nb.f.name.trim()], ["Frank–Gers", !!lastA?.ok], ["Balmer", !!lastB?.ok], ["Xulosa", nb.f.conclusion.trim().length >= 20], ["Hisobot", built]];
  $("[data-nb-progress]").innerHTML = st.map(([t, ok]) => `<span class="${ok ? "is-done" : ""}">${ok ? "✓ " : ""}${t}</span>`).join("");
}
$("[data-conclusion-hint]").addEventListener("click", () => { $("[data-hint-msg]").textContent = "Javob bering: 1) I(U) da maksimumlar teng oraliqda takrorlanadimi va bu nimani bildiradi? 2) ΔU dan topilgan E₁ jadvaldagi qiymatga mosmi? 3) Balmer chiziqlari uchun topilgan R barcha chiziqlarda bir xilmi va R_H ga mosmi? 4) hν = E_n − E₂ bajariladimi? 5) Bor modelining qaysi postulatlari tasdiqlandi?"; });

const buildMsg = $("[data-build-msg]"), preview = $("[data-preview]");
const KATEX_JS = new URL("../../vendor/katex/katex.min.js", import.meta.url).href, KATEX_CSS = new URL("../../vendor/katex/katex.min.css", import.meta.url).href;
let katexP = null;
function loadKatex() { if (window.katex) return Promise.resolve(window.katex); katexP ||= new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = KATEX_JS; sc.onload = () => res(window.katex); sc.onerror = () => { katexP = null; rej(new Error("katex")); }; document.head.append(sc); }); return katexP; }
const translit = (s) => s.normalize("NFKD").replace(/[ʻʼ‘’'`]/g, "").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9Ѐ-ӿ]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "talaba";
const fileBase = () => `Bor-postulatlari-lab-${translit(nb.f.name)}`;
function recForDoc() { return condKey() === `${nb.c1.gas}|${nb.c1.T}|${nb.c1.Ur}` ? fh.rec : []; }
function makeDoc() { const e = nbValid(); if (e.length) { buildMsg.textContent = `Avval to‘ldiring: ${e.join("; ")}.`; buildMsg.dataset.tone = "red"; return null; } return buildBohrDoc(nb, lastA, lastB, flags, recForDoc()); }
async function makeHTML(autoPrint) { const doc = makeDoc(); if (!doc) return null; const katex = await loadKatex(); return renderHTML(doc, { katex, katexCss: KATEX_CSS, title: fileBase(), docLabel: DOC_LABEL, autoPrint }); }
$("[data-build]").addEventListener("click", async () => {
  buildMsg.textContent = "Shakllantirilmoqda…"; buildMsg.dataset.tone = "";
  let html = null; try { html = await makeHTML(false); } catch { buildMsg.textContent = "Formulalar kutubxonasini yuklab bo‘lmadi. Qayta urinib ko‘ring."; buildMsg.dataset.tone = "red"; }
  if (!html) { built = false; preview.hidden = true; nbProgress(); return; }
  preview.innerHTML = ""; const fr = document.createElement("iframe"); fr.title = "Lab varaq ko‘rinishi"; fr.className = "lab-frame"; fr.srcdoc = html; preview.append(fr);
  preview.hidden = false; built = true; buildMsg.textContent = "Tayyor. Pastda ko‘rib chiqing, so‘ng PDF ni yuklab oling."; buildMsg.dataset.tone = "green"; nbProgress();
});
$("[data-pdf]").addEventListener("click", async () => {
  if (nbValid().length) { makeDoc(); return; }
  const w = window.open("", "_blank"); buildMsg.textContent = "PDF tayyorlanmoqda…"; buildMsg.dataset.tone = "";
  try {
    const html = await makeHTML(true);
    if (!w) { buildMsg.textContent = "Brauzer yangi oynani blokladi — ruxsat bering yoki «Ko‘rib chiqish» dagi tugmadan foydalaning."; buildMsg.dataset.tone = "red"; return; }
    w.document.open(); w.document.write(html); w.document.close();
    buildMsg.textContent = "Yangi oynada chop etish oynasi ochildi: «Saqlash: PDF» (Save as PDF) ni tanlang."; buildMsg.dataset.tone = "green"; built = true; nbProgress();
  } catch { w?.close(); buildMsg.textContent = "Formulalar kutubxonasini yuklab bo‘lmadi. Qayta urinib ko‘ring."; buildMsg.dataset.tone = "red"; }
});
document.querySelector("#labNotebook").addEventListener("input", () => { if (built) { built = false; buildMsg.textContent = "Ma’lumotlar o‘zgardi — hisobot yangi ma’lumotlar bilan tuziladi."; buildMsg.dataset.tone = ""; nbProgress(); } });

/* ------------------------------------------------------------------ Ishga tushirish */

setPlayUI(false);
syncCondUI(); renderT1(); renderT2(); renderJournal(); nbRecalc();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "hg");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
