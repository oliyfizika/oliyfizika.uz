// ==========================================================================
// Fotoeffekt — virtual laboratoriya (simulations/photoeffect.html)
// Optik skamya: simob lampasi → filtrlar g‘ildiragi (bosib tanlanadi) → diafragma (Φ) → vakuumli fotoelement
// (fotonlar va fotoelektronlar, tormozlovchi maydonda orqaga qaytish). Asboblar: voltmetr, nanoampermetr,
// U dastagi va ±1/±0,1/±0,01 V tugmalari, avtomatik skanerlash. Grafik: yozib olingan I(U) (×1/×20/×200).
// Daftar: labnotebook.js; hisobot: photo-report.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { TAU, SMALL, MID, BOLD, circle, tagIn, chipBtn, knob, lcd, chipGrid, readouts, u, noise, clamp, fmt } from "./labkit.js";
import * as P from "./photo-physics.js";
import * as L from "./photo-lab.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { buildPhotoDoc, SITE, DOC_LABEL } from "./photo-report.js";

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const INTS = [20, 40, 60, 80, 100];

const st = { line: "436", cath: "Cs", inten: 100, U: 0, scan: false, zoom: 1, cursor: null, t: 0 };
const REC = "of-photo-rec-v1";
let curves = store.get(REC, {});
const ckey = () => `${st.cath}|${st.line}|${st.inten}`;
const sOf = () => ({ line: st.line, cath: st.cath, inten: st.inten });
const measuredI = (U) => { const I = P.current(U, sOf()); return I + 0.002 * Math.abs(I) * noise(U, st.inten) + 0.0003 * noise(U * 3.1, 7); };
const geo = {};
let presetId = null;

function record() {
  const k = ckey(), U = Math.round(st.U * 100) / 100, I = measuredI(U);
  const c = (curves[k] ||= { pts: [] }), i = c.pts.findIndex((p) => Math.abs(p[0] - U) < 1e-6);
  if (i >= 0) c.pts[i] = [U, I]; else c.pts.push([U, I]);
  const keys = Object.keys(curves); if (keys.length > 10) delete curves[keys.find((x) => x !== k)];
  clearTimeout(record.t); record.t = setTimeout(() => store.set(REC, curves), 400);
}
function setU(v) { st.U = clamp(Math.round(v * 100) / 100, P.U_RANGE[0], P.U_RANGE[1]); uC.set(st.U); record(); }

/* ------------------------------------------------------------------ Elektronlar (ko‘rgazmali) */
const EL = [];
let spawn = 0;
function stepParticles(dt) {
  const s = sOf(), Is = P.iSat(s), K = P.photonEv(P.lineById(st.line).nm) - P.CATHODES[st.cath].W;
  spawn += dt * Is * 1.6;
  while (spawn > 1 && EL.length < 60) { spawn -= 1; if (K <= 0) continue; const a = Math.random(), b = Math.random(), k0 = K * (a + b + Math.random()) / 3; EL.push({ x: 0, v: 1, K0: Math.max(0.01, k0), y: Math.random() * 1.6 - 0.8, back: false }); }
  if (K <= 0) spawn = 0;
  for (const e of EL) {
    const Kx = st.U >= 0 ? e.K0 + st.U * e.x : e.K0 + st.U * e.x; // eV, x — katod→anod ulushi
    if (!e.back && Kx <= 0.002) e.back = true;
    const sp = 0.35 + 0.9 * Math.sqrt(Math.max(0.002, Kx));
    e.x += (e.back ? -1 : 1) * sp * dt;
  }
  for (let i = EL.length - 1; i >= 0; i--) if (EL[i].x > 1 || EL[i].x < 0) EL.splice(i, 1);
}
const PH = Array.from({ length: 26 }, (_, i) => ({ p: i / 26, y: Math.random() * 2 - 1 }));

/* ------------------------------------------------------------------ Sahna */
function draw(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, cw, ch);
  const benchW = narrow ? cw - 16 : cw * 0.62, k = Math.min(benchW / 470, (narrow ? 200 : ch - 16) / 222);
  const ox = narrow ? 8 : 10 + (benchW - 470 * k) / 2, oy = narrow ? 6 - 36 * k : (ch - 222 * k) / 2 - 10 * k;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k, Lc = P.lineById(st.line), ph = P.photonEv(Lc.nm), W = P.CATHODES[st.cath].W;
  geo.chips = []; geo.wheel = null;
  const metal = c.dark ? "#475569" : "#64748b", dark = c.dark ? "#1e293b" : "#334155";
  // optik skamya (relsi va ustunlar)
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.beginPath(); ctx.roundRect(X(0), Y(196), 470 * k, 7 * k, 3); ctx.fill();
  [[41, 180], [150, 190], [232, 186], [385, 182]].forEach(([x, y0]) => { ctx.fillStyle = metal; ctx.fillRect(X(x) - 2.5 * k, Y(y0), 5 * k, Y(196) - Y(y0)); });
  const by = Y(110), beamW = 13 * k, ap = 13 * k * Math.sqrt(st.inten / 100);
  // lampa
  ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(X(4), Y(52), 74 * k, 128 * k, 8); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(X(12), Y(62 + i * 6), 30 * k, 2.5 * k); }
  const lg = ctx.createRadialGradient(X(44), by, 2, X(44), by, 30 * k); lg.addColorStop(0, "#faf5ff"); lg.addColorStop(0.45, "rgba(196,181,253,0.9)"); lg.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = lg; circle(ctx, X(44), by, 30 * k); ctx.fill();
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(X(76), by - beamW - 3 * k, 5 * k, 2 * beamW + 6 * k);
  // oq nur (lampa → filtr)
  ctx.fillStyle = "rgba(221,214,254,0.6)"; ctx.fillRect(X(81), by - beamW, X(150) - X(81), 2 * beamW);
  // filtr g‘ildiragi: o‘qi nurdan pastda, tanlangan filtr tepada — nur yo‘lida
  const wx = X(150), wy = Y(140), wr = 52 * k, sel = P.LINES.findIndex((q) => q.id === st.line);
  P.LINES.forEach((Ln, i) => {
    const a = -Math.PI / 2 + (i - sel) * (TAU / 5), on = i === sel;
    ctx.fillStyle = Ln.color; ctx.globalAlpha = on ? 0.95 : 0.5; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.arc(wx, wy, wr, a - TAU / 10 + 0.035, a + TAU / 10 - 0.035); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    if (!on) { const tx = wx + Math.cos(a) * wr * 0.62, ty = wy + Math.sin(a) * wr * 0.62; ctx.fillStyle = "#fff"; ctx.font = k < 0.9 ? "700 8px Inter, system-ui, sans-serif" : SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(Ln.id, tx, ty); }
  });
  ctx.strokeStyle = metal; ctx.lineWidth = 2.5; circle(ctx, wx, wy, wr); ctx.stroke(); ctx.fillStyle = metal; circle(ctx, wx, wy, 4.5 * k); ctx.fill();
  geo.wheel = { x: wx, y: wy, r: wr };
  // filtrlangan nur (filtr → diafragma), diafragmadan keyin — Φ ga mos kesim
  ctx.fillStyle = Lc.color; ctx.globalAlpha = 0.45; ctx.fillRect(wx + 8 * k, by - beamW, X(228) - wx - 8 * k, 2 * beamW); ctx.globalAlpha = 1;
  // diafragma (iris)
  ctx.fillStyle = metal; ctx.beginPath(); ctx.roundRect(X(225), Y(62), 14 * k, 124 * k, 3); ctx.fill();
  ctx.fillStyle = c.bg; circle(ctx, X(232), by, ap + 1); ctx.fill(); ctx.fillStyle = Lc.color; ctx.globalAlpha = 0.6; circle(ctx, X(232), by, ap); ctx.fill(); ctx.globalAlpha = 1;
  // fotoelement
  const px = X(385), py = by, pr = 64 * k, cR = pr * 0.74, cxs = px + cR * Math.cos(0.5);
  ctx.globalAlpha = 0.4; ctx.fillStyle = Lc.color; ctx.beginPath(); ctx.moveTo(X(239), by - ap); ctx.lineTo(cxs, py - cR * Math.sin(1.0)); ctx.lineTo(px + cR, py); ctx.lineTo(cxs, py + cR * Math.sin(1.0)); ctx.lineTo(X(239), by + ap); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.12)"; ctx.strokeStyle = c.text3; ctx.lineWidth = 2; circle(ctx, px, py, pr); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, pr - 5, -2.4, -1.7); ctx.stroke();
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#475569"; ctx.lineWidth = 6 * k; ctx.lineCap = "butt"; ctx.beginPath(); ctx.arc(px, py, cR, -1.05, 1.05); ctx.stroke();
  ctx.fillStyle = c.text; ctx.fillRect(px - 2.5 * k, py - pr * 0.55, 5 * k, pr * 1.1);
  // elektr zanjiri: anod — nanoampermetr — manba U — katod (keng ekranda)
  if (!narrow) {
    const yT = Y(22), xa = px, xk = px + pr + 20 * k, cTop = { x: px + cR * Math.cos(-1.05), y: py + cR * Math.sin(-1.05) };
    ctx.strokeStyle = c.text2; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(xa, py - pr * 0.55); ctx.lineTo(xa, yT); ctx.lineTo(xk, yT); ctx.lineTo(xk, cTop.y); ctx.lineTo(cTop.x, cTop.y); ctx.stroke();
    const am = { x: xa, y: Y(32) }; ctx.fillStyle = c.bg; ctx.strokeStyle = c.text2; circle(ctx, am.x, am.y, 9 * k); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text; ctx.font = "700 8px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("nA", am.x, am.y + 0.5);
    const bx = (xa + xk) / 2; ctx.fillStyle = c.bg; ctx.fillRect(bx - 5 * k, yT - 10, 10 * k, 20);
    const sg = st.U >= 0 ? 1 : -1; // uzun ingichka plastina — «+» (U ≥ 0 da anod tomonida)
    ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - 4 * k * sg, yT - 9); ctx.lineTo(bx - 4 * k * sg, yT + 9); ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx + 4 * k * sg, yT - 5); ctx.lineTo(bx + 4 * k * sg, yT + 5); ctx.stroke();
    const pol = st.U >= 0 ? ["+", "−"] : ["−", "+"]; ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textBaseline = "bottom"; ctx.fillText(pol[0], bx - 10 * k, yT - 4); ctx.fillText(pol[1], bx + 10 * k, yT - 4);
    ctx.fillStyle = c.primary; ctx.font = BOLD; ctx.fillText(`U = ${fmt(st.U, 2)} V`, bx, yT - 16);
  }
  // fotonlar
  const dens = Math.round(6 + 20 * st.inten / 100);
  PH.forEach((q, i) => { if (i >= dens) return; q.p = (q.p + 0.006) % 1; const x = X(240) + (cxs - X(240)) * q.p, w = ap + (cR * 0.8 - ap) * q.p; ctx.fillStyle = Lc.color; circle(ctx, x, by + q.y * w * 0.85, 1.9); ctx.fill(); });
  // elektronlar (katoddan anodga, tormozlovchi maydonda orqaga qaytadi)
  ctx.fillStyle = c.dark ? "#93c5fd" : "#1d4ed8";
  EL.forEach((e) => { const ang = e.y * 0.9, sx0 = px + cR * Math.cos(ang) - 4 * k, sy0 = py + cR * Math.sin(ang), x = sx0 + (px + 4 * k - sx0) * e.x, y = sy0 + (py + e.y * pr * 0.35 - sy0) * e.x; circle(ctx, x, y, 2.1); ctx.fill(); });
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("A", px - 10 * k, py - pr * 0.42); ctx.fillText("K", px + cR + 9 * k, py - pr * 0.6);
  // yorliqlar (relsdan pastda, ikki qator)
  const lab = (x, t1, t2, col) => { ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.fillText(t1, X(x), Y(206)); ctx.font = BOLD; ctx.fillStyle = col || c.text; ctx.fillText(t2, X(x), Y(206) + 13); };
  const okC = ph > W ? c.success : c.danger;
  if (narrow) { lab(41, "Hg lampa", "simob"); lab(150, "filtr", `${Lc.id} nm`, Lc.color); lab(232, "diafr.", `${st.inten}%`); lab(385, `katod ${st.cath}`, ph > W ? "hν > A" : "hν < A", okC); }
  else { lab(41, "Hg lampa", "simob"); lab(150, "filtr (bosing)", `${fmt(Lc.nm, 1)} nm`, Lc.color); lab(232, "diafragma", `Φ = ${st.inten}%`); lab(385, `fotoelement · katod ${st.cath}`, ph > W ? `hν = ${fmt(ph, 2)} eV > A` : `hν = ${fmt(ph, 2)} eV < A`, okC); }
  if (Math.abs(st.U) > 0.005) tagIn(ctx, st.U < 0 ? "tormozlovchi maydon" : "tezlatuvchi maydon", px, py + pr + 3 * k, cw, { color: st.U < 0 ? c.danger : c.success, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  // asboblar
  const I = measuredI(st.U);
  if (narrow) {
    const y0 = Y(240) + 6;
    lcd(ctx, 8, y0, cw / 2 - 12, 48, "VOLTMETR", fmt(st.U, 2), "V", "#60a5fa"); lcd(ctx, cw / 2 + 4, y0, cw / 2 - 12, 48, "NANOAMPERMETR", fmt(I, 3), "nA");
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 56, cw - 16, [["−1", -1], ["−0,1", -0.1], ["−0,01", -0.01], ["+0,01", 0.01], ["+0,1", 0.1], ["+1", 1]], 6, 26).map((b) => ({ ...b, k: "dU" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 88, cw - 16, INTS.map((v) => [`${v}%`, v]), 5, 24, 4, (v) => v === st.inten).map((b) => ({ ...b, k: "int" })));
    return;
  }
  const rx = X(470) + 10, rw = cw - rx - 10;
  lcd(ctx, rx, 10, rw, 52, "VOLTMETR · anod kuchlanishi", fmt(st.U, 2), "V", "#60a5fa");
  lcd(ctx, rx, 68, rw, 52, "NANOAMPERMETR · fototok", fmt(I, 3), "nA");
  const kr = 20, kx = rx + kr + 8, ky = 152; knob(ctx, c, kx, ky, kr, (st.U + 3) / 15, "U dastagi"); geo.knob = { x: kx, y: ky, r: kr + 10 };
  geo.chips.push(...chipGrid(ctx, c, kx + kr + 16, 130, rx + rw - (kx + kr + 16), [["+1 V", 1], ["−1 V", -1], ["+0,1", 0.1], ["−0,1", -0.1], ["+0,01", 0.01], ["−0,01", -0.01]], 2, 24).map((b) => ({ ...b, k: "dU" })));
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Yorug‘lik oqimi Φ (diafragma)", rx, 232);
  geo.chips.push(...chipGrid(ctx, c, rx, 238, rw, INTS.map((v) => [`${v}%`, v]), 5, 24, 4, (v) => v === st.inten).map((b) => ({ ...b, k: "int" })));
  ctx.fillText("Katod", rx, 282);
  geo.chips.push(...chipGrid(ctx, c, rx, 288, rw, Object.values(P.CATHODES).map((q) => [q.id, q.id]), 3, 24, 4, (v) => v === st.cath).map((b) => ({ ...b, k: "cath" })));
  const sb = chipBtn(ctx, c, rx, ch - 34, st.scan ? "■ To‘xtatish" : "▶ Avtomatik skanerlash (−3 → +12 V)", st.scan, rw, 26); geo.chips.push({ ...sb, k: "scan" });
}
function drawGraph(ctx, G) {
  const { w, h, colors: c } = G; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const keys = Object.keys(curves).filter((k) => curves[k].pts.length);
  const cur = curves[ckey()]?.pts || [];
  const all = keys.flatMap((k) => curves[k].pts.map((p) => p[1])), Imax = Math.max(0.05, ...all, measuredI(st.U));
  const ymax = Imax * 1.08 / st.zoom, ymin = st.zoom > 1 ? -ymax * 0.35 : Math.min(0, ...all) * 1.1;
  const x0 = 54, x1 = w - 12, y0 = 14, y1 = h - 30, X = (U) => x0 + ((U + 3) / 15) * (x1 - x0), Y = (I) => y1 - ((I - ymin) / (ymax - ymin)) * (y1 - y0);
  geo.g = { x0, x1 };
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3; ctx.font = SMALL;
  for (let U = -3; U <= 12; U += 1) { ctx.beginPath(); ctx.moveTo(X(U), y0); ctx.lineTo(X(U), y1); ctx.stroke(); if (U % 3 === 0) { ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(fmt(U, 0), X(U), y1 + 5); } }
  ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("U, V", x1 - 4, y1 - 3);
  const span = ymax - ymin, stp = 10 ** Math.floor(Math.log10(span / 4)) * ([1, 2, 5].find((m) => span / (10 ** Math.floor(Math.log10(span / 4)) * m) <= 6) || 10);
  for (let I = Math.ceil(ymin / stp) * stp; I <= ymax; I += stp) { ctx.beginPath(); ctx.moveTo(x0, Y(I)); ctx.lineTo(x1, Y(I)); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(fmt(I, stp < 0.01 ? 3 : stp < 0.1 ? 2 : stp < 1 ? 1 : 0), x0 - 5, Y(I)); }
  ctx.strokeStyle = c.borderStrong; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.moveTo(X(0), y0); ctx.lineTo(X(0), y1); ctx.stroke(); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = c.text3; ctx.fillText("I, nA", x0 + 4, y0 + 2);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  keys.forEach((k) => { const [ca, li] = k.split("|"), Ln = P.lineById(li), on = k === ckey(); const pts = curves[k].pts.slice().sort((a, b) => a[0] - b[0]); ctx.strokeStyle = Ln.color; ctx.globalAlpha = on ? 1 : 0.45; ctx.lineWidth = on ? 2.2 : 1.4; ctx.beginPath(); pts.forEach(([U, I], j) => (j ? ctx.lineTo(X(U), Y(I)) : ctx.moveTo(X(U), Y(I)))); ctx.stroke(); void ca; });
  ctx.globalAlpha = 1; ctx.fillStyle = c.danger; circle(ctx, X(st.U), Y(measuredI(st.U)), 4); ctx.fill();
  ctx.restore();
  geo.zoom = chipGrid(ctx, c, x0 + 46, y0 + 4, 140, [["×1", 1], ["×20", 20], ["×200", 200]], 3, 22, 4, (v) => v === st.zoom);
  if (st.cursor !== null && cur.length) {
    const U = -3 + ((st.cursor - x0) / (x1 - x0)) * 15; let b = cur[0]; cur.forEach((p) => { if (Math.abs(p[0] - U) < Math.abs(b[0] - U)) b = p; });
    ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(b[0]), y0); ctx.lineTo(X(b[0]), y1); ctx.stroke(); ctx.setLineDash([]);
    tagIn(ctx, `U = ${fmt(b[0], 2)} V · I = ${fmt(b[1], 3)} nA`, X(b[0]) + 8, y0 + 40, w, { color: c.text, bg: c.bg2, align: "left", font: BOLD, pad: 6 });
  }
  if (!keys.length) { ctx.fillStyle = c.text3; ctx.font = MID; ctx.textAlign = "center"; ctx.fillText("Kuchlanishni o‘zgartiring yoki «Avtomatik skanerlash» ni bosing", (x0 + x1) / 2, (y0 + y1) / 2); }
}
const heights = (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(Math.min(cw * 0.48, vh * 0.48), 300, 380)), graph: Math.round(clamp(vh * 0.3, 200, 270)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? Math.round(((cw - 16) / 470) * 204 + 130) : heights(cw).stage) });
const graph = createStage($("#graph"), drawGraph, { height: (cw) => heights(cw).graph });
$("[data-graph-card]").hidden = false;

/* ------------------------------------------------------------------ Natijalar */
const setRO = readouts($("[data-readouts]"));
function updateReadouts() {
  const Ln = P.lineById(st.line), ph = P.photonEv(Ln.nm), W = P.CATHODES[st.cath].W;
  setRO("r1", "Anod kuchlanishi <i>U</i>", u(fmt(st.U, 2), "V"), st.U < 0 ? "tormozlovchi" : "tezlatuvchi");
  setRO("r2", "Fototok <i>I</i>", u(fmt(measuredI(st.U), 3), "nA"), "nanoampermetr");
  setRO("r3", "Filtr", u(fmt(Ln.nm, 1), "nm"), `ν = ${fmt(P.nu(Ln.nm) / 1e14, 3)}·10¹⁴ Hz`);
  setRO("r4", "Foton energiyasi <i>hν</i>", u(fmt(ph, 3), "eV"), "hν = hc/λ");
  setRO("r5", "Yorug‘lik oqimi <i>Φ</i>", u(String(st.inten), "%"), "diafragma");
  setRO("r6", "Katod", st.cath, ph > W ? "fotoeffekt bor" : "fotoeffekt yo‘q (hν < A)", ph > W ? "" : "red");
}
function updateStatus() { const el = $("[data-status]"), t = st.scan ? "Skanerlanmoqda…" : `I(U) egri chizig‘i: ${(curves[ckey()]?.pts || []).length} nuqta`; if (el.textContent !== t) el.textContent = t; el.dataset.tone = st.scan ? "green" : "blue"; }
let lastEx = "";
function updateExplain() {
  const ph = P.photonEv(P.lineById(st.line).nm), W = P.CATHODES[st.cath].W;
  const html = `<p>Simob lampasidan chiqqan nurdan filtr bitta spektral chiziqni ajratadi. Foton katoddan elektron urib chiqaradi, agar uning energiyasi <b>hν</b> chiqish ishi <b>A</b> dan katta bo‘lsa. Ortiqcha energiya elektronning kinetik energiyasiga aylanadi (Eynshteyn tenglamasi).</p><p>${ph > W ? "Anodga manfiy kuchlanish bersangiz, elektronlar tormozlanadi va orqaga qaytadi. Tok nolga tushadigan kuchlanish <b>U<sub>t</sub></b> eng tez elektronlarning energiyasini o‘lchaydi: eU<sub>t</sub> = hν − A. Grafikda «×20», «×200» ni bosib nol atrofini kattalashtiring." : "Bu filtr uchun hν < A — yorug‘lik qanchalik kuchli bo‘lmasin, fotoeffekt yo‘q. Bu qizil chegara."}</p>`;
  if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() { const t = st.scan ? "To‘xtatish" : "Avtomatik skanerlash"; if (actBtn.textContent !== t) actBtn.textContent = t; resetBtn.textContent = "Grafikni tozalash"; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateAction(); syncUI(); stage.render(); graph.render(); }
$("[data-formula]").innerHTML = "<small>Eynshteyn</small> hν = A + eUₜ";

/* ------------------------------------------------------------------ Vaqt */
let uiT = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return; st.t += dt;
  if (st.scan) { const n = Math.max(1, Math.round(dt / 0.02)); for (let i = 0; i < n && st.scan; i++) { setU(st.U + 0.05); if (st.U >= P.U_RANGE[1] - 1e-9) st.scan = false; } graph.render(); }
  stepParticles(dt); stage.render();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updateReadouts(); updateStatus(); updateAction(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.addEventListener("click", () => loop.toggle());
function toggleScan() { if (st.scan) st.scan = false; else { setU(P.U_RANGE[0]); st.scan = true; if (!loop.running) loop.start(); } }
actBtn.addEventListener("click", () => { toggleScan(); customized(); refresh(); });
resetBtn.addEventListener("click", () => { st.scan = false; curves = {}; store.set(REC, curves); record(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */
const uC = bindRange($("#pU"), $("#pUOut"), (v) => `${fmt(v, 2)} V`, (v) => { st.U = v; record(); customized(); refresh(); });
$("[data-lineset]").innerHTML = P.LINES.map((l) => `<button type="button" data-line="${l.id}"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${l.color}"></span>${l.id} nm</button>`).join("");
$("[data-intset]").innerHTML = INTS.map((v) => `<button type="button" data-int="${v}" title="Φ = ${v}%">${v}</button>`).join("");
$("[data-cathset]").innerHTML = Object.values(P.CATHODES).map((q) => `<button type="button" data-cath="${q.id}" title="${q.name}, A = ${fmt(q.W, 2)} eV">${q.id}</button>`).join("");
const setLine = (v) => { st.line = String(v); record(); customized(); refresh(); };
const setInt = (v) => { st.inten = +v; record(); customized(); refresh(); };
const setCath = (v) => { st.cath = v; record(); customized(); refresh(); };
document.addEventListener("click", (e) => { const b = e.target.closest("[data-line],[data-int],[data-cath]"); if (!b || !b.closest(".sim-panel")) return; if (b.dataset.line) setLine(b.dataset.line); else if (b.dataset.int) setInt(b.dataset.int); else setCath(b.dataset.cath); });
function syncUI() {
  document.querySelectorAll("[data-line]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.line === st.line)));
  document.querySelectorAll("[data-int]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.int === st.inten)));
  document.querySelectorAll("[data-cath]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cath === st.cath)));
}
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e, cv = canvas) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  for (const ch of geo.chips || []) if (inBox(p, ch)) return { k: "chip", ch };
  if (geo.knob && Math.hypot(p.x - geo.knob.x, p.y - geo.knob.y) <= geo.knob.r) return { k: "knob" };
  if (geo.wheel && Math.hypot(p.x - geo.wheel.x, p.y - geo.wheel.y) <= geo.wheel.r) return { k: "wheel" };
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hit(p); if (!h) return;
  if (h.k === "chip") { const ch = h.ch; if (ch.k === "dU") { st.scan = false; setU(st.U + ch.v); } else if (ch.k === "int") setInt(ch.v); else if (ch.k === "cath") setCath(ch.v); else if (ch.k === "scan") toggleScan(); customized(); refresh(); return; }
  if (h.k === "wheel") { const i = P.LINES.findIndex((q) => q.id === st.line); setLine(P.LINES[(i + 1) % P.LINES.length].id); return; }
  drag = "knob"; dragY0 = p.y; dragV0 = st.U; st.scan = false; canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hit(p); canvas.style.cursor = h ? (h.k === "knob" ? "ns-resize" : "pointer") : ""; return; } setU(dragV0 + (dragY0 - p.y) * 0.05); customized(); refresh(); });
const end = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
graph.canvas.addEventListener("pointermove", (e) => { const p = ptr(e, graph.canvas); st.cursor = geo.g && p.x >= geo.g.x0 && p.x <= geo.g.x1 ? p.x : null; graph.render(); });
graph.canvas.addEventListener("pointerleave", () => { st.cursor = null; graph.render(); });
graph.canvas.addEventListener("pointerdown", (e) => { const p = ptr(e, graph.canvas); for (const z of geo.zoom || []) if (inBox(p, z)) { st.zoom = z.v; graph.render(); } });

/* ------------------------------------------------------------------ Tayyor tajribalar */
const PRESETS = {
  blue: { title: "Ko‘k chiziq, seziy katod", lesson: "436 nm filtr, Cs katod. «Avtomatik skanerlash» bilan VAX ni yozing, so‘ng kuchlanishni manfiy tomonga 0,01 V qadam bilan o‘zgartirib, tok nolga teng bo‘ladigan U_t ni toping (grafikda ×200).", set: () => Object.assign(st, { line: "436", cath: "Cs", inten: 100, U: 0 }) },
  uv: { title: "Ultrabinafsha 365 nm", lesson: "Foton energiyasi kattaroq — tormozlovchi kuchlanish ham katta (≈ 1,24 V).", set: () => Object.assign(st, { line: "365", cath: "Cs", inten: 100, U: 0 }) },
  red: { title: "Qizil chegara: sariq nur, Na", lesson: "577 nm, Na katod: hν = 2,15 eV < A = 2,36 eV. Diafragmani to‘liq ochsangiz ham fototok yo‘q — intensivlik emas, chastota hal qiladi.", set: () => Object.assign(st, { line: "577", cath: "Na", inten: 100, U: 5 }) },
  stoletov: { title: "Stoletov qonuni: Φ ni o‘zgartiring", lesson: "436 nm filtr. Diafragmani 20…100% qilib, U = +10 V dagi to‘yinish tokini o‘lchang: u Φ ga proporsional. Tormozlovchi kuchlanish esa o‘zgarmaydi.", set: () => Object.assign(st, { line: "436", cath: "Cs", inten: 60, U: 10 }) },
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.entries(PRESETS).map(([id, p]) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${p.title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPP = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPP(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id) {
  const p = PRESETS[id]; st.scan = false; p.set(); uC.set(st.U); record();
  presetId = id; setPP(id); $("[data-lesson]").textContent = p.lesson; $("[data-mode-hint]").textContent = "Filtr g‘ildiragini bosing, U ni dastak yoki tugmalar bilan o‘zgartiring";
  refresh(); if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* */ }
}

/* ------------------------------------------------------------------ Laboratoriya daftari */
const lineOpts = [["", "— tanlang —"], ...P.LINES.map((l) => [l.id, `${fmt(l.nm, 1)} nm`])];
const cathOpts = Object.values(P.CATHODES).map((q) => [q.id, q.name]);
createNotebook($("[data-notebook]"), {
  key: "photo", docLabel: DOC_LABEL, site: SITE,
  intro: "Tajribalarni bajaring, natijalarni jadvallarga kiriting — hisoblashlar avtomatik bajariladi. Oxirida LaTeX uslubidagi hisobotni PDF yoki .tex ko‘rinishida yuklab olasiz.",
  conclusionPh: "U_t chastotaga qanday bog‘liq? Topilgan h jadvaldagi qiymatga mosmi? Intensivlik U_t ga ta’sir qiladimi? Qizil chegara qanday?",
  hint: "Javob bering: 1) U_t(ν) to‘g‘ri chiziqmi? 2) Uning qiyaligidan topilgan h ning jadvaldagi qiymatdan farqi qancha va nima sababdan? 3) Chiqish ishi va qizil chegara qanday? 4) To‘yinish toki Φ ga proporsionalmi? 5) Nima uchun U_t intensivlikka bog‘liq emas?",
  fileBase: (nb) => `Fotoeffekt-lab-${translit(nb.f.name)}`,
  minTables: 1,
  tables: [
    { key: "t1", okLabel: "U_t(ν)", need: "1-jadvalda kamida 3 xil filtr", title: "1-topshiriq. Tormozlovchi kuchlanishning chastotaga bog‘liqligi",
      desc: "Har bir filtr uchun (Φ = 100%) fototok nolga teng bo‘ladigan tormozlovchi kuchlanishni U<sub>t</sub> (musbat son sifatida) yozing. Kamida 3 xil filtr.",
      cond: { fields: [{ k: "cath", label: "Katod", opts: cathOpts }], init: { cath: "Cs" }, sync: () => ({ cath: st.cath }) },
      head: ["Filtr λ, nm", "U<sub>t</sub>, V", "ν, 10¹⁴ Hz", "hν, eV", "Tekshiruv"], cols: [{ k: "line", kind: "sel", opts: lineOpts }, { k: "Us", kind: "num" }], outs: ["nu", "ph"],
      blank: (i) => ({ line: ["365", "405", "436", "546"][i] || "", Us: "" }), rows: 4, max: 10,
      parse: (r) => ({ line: r.line, Us: num(r.Us) }), check: L.check1, analyze: (rows, c) => L.analyze1(rows, c),
      out: (A, j) => { const r = A.rows[j]; return { nu: fmt(r.nu14, 3), ph: fmt(P.photonEv(r.L.nm), 3) }; },
      match: (r, c) => L.match1(r, c), noMatch: "Qurilmadagi nol tok nuqtasidan ±0,04 V dan ko‘p farq",
      summary: (A) => A.fit ? [["h = e·k", `${(A.h / 1e-34).toFixed(3).replace(".", ",")}·10⁻³⁴ J·s`, `farq ${fmt((100 * (A.h - P.H)) / P.H, 1)}%`], ["Chiqish ishi A", `${fmt(A.W, 2)} eV`, `jadvalda ${fmt(A.Wtrue, 2)} eV`], ["Qizil chegara λ₀", `${fmt(A.lam0, 0)} nm`, `ν₀ = ${fmt(A.nu0 / 1e14, 2)}·10¹⁴ Hz`]] : null,
      ok: (A) => A.ok && !!A.fit },
    { key: "t2", okLabel: "I(Φ)", need: "2-jadvalda kamida 3 xil Φ", title: "2-topshiriq. To‘yinish tokining yorug‘lik oqimiga bog‘liqligi",
      desc: "Bitta filtr bilan diafragmani o‘zgartirib, U = +10 V dagi to‘yinish tokini va (ixtiyoriy) tormozlovchi kuchlanishni yozing.",
      cond: { fields: [{ k: "line", label: "Filtr", opts: P.LINES.map((l) => [l.id, `${fmt(l.nm, 1)} nm`]) }, { k: "cath", label: "Katod", opts: cathOpts }], init: { line: "436", cath: "Cs" }, sync: () => ({ line: st.line, cath: st.cath }) },
      head: ["Φ, %", "I<sub>to‘y</sub>, nA", "U<sub>t</sub>, V (ixt.)", "I/Φ, nA/%", "Tekshiruv"], cols: [{ k: "inten", kind: "sel", opts: INTS.map((v) => [v, `${v}%`]) }, { k: "Is", kind: "num" }, { k: "Us", kind: "num" }], outs: ["ratio"],
      blank: (i) => ({ inten: String(INTS[[4, 2, 0, 3, 1][i] ?? 4]), Is: "", Us: "" }), rows: 3, max: 8, narrow: true,
      parse: (r) => ({ inten: +r.inten, Is: num(r.Is), Us: num(r.Us) }), check: L.check2, analyze: (rows) => L.analyze2(rows),
      out: (A, j) => { const r = A.rows[j]; return { ratio: fmt(r.Is / r.inten, 4) }; },
      match: (r, c) => L.match2(r, c), noMatch: "Qurilmadagi qiymatdan farq qiladi (I ±3%, U_t ±0,04 V)",
      summary: (A) => A.fit ? [["I_to‘y = k·Φ", `k = ${fmt(A.fit.k, 4)}`, "nA/%"], ...(A.Us ? [["U_t (o‘rtacha)", `${fmt(A.Us.m, 3)} V`, `± ${fmt(A.Us.sd, 3)} V — Φ ga bog‘liq emas`]] : [])] : null,
      ok: (A) => A.ok && !!A.fit },
  ],
  build: (nb, res) => buildPhotoDoc(nb, res, Object.fromEntries(Object.entries(curves).filter(([k, v]) => v.pts.length >= 20 && (k.startsWith(`${res.t1.cond.cath}|`) || k.startsWith(`${res.t2.cond.cath}|`))).slice(0, 6).map(([k, v]) => { const [ca, li, it] = k.split("|"); return [k, { pts: v.pts, label: `${li} nm, Φ = ${it}%, ${ca}`, labelTeX: `${li} nm, $\\Phi=${it}\\,\\%$` }]; }))),
});

/* ------------------------------------------------------------------ Ishga tushirish */
setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "blue");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
