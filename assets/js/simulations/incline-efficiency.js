// ==========================================================================
// Qiya tekislik: ish va FIK — simulyatsiya va virtual laboratoriya (simulations/incline-efficiency.html)
// 1) Oltin qoida: h balandlikdagi supaga pandus qo'yilgan, yuk lebyodka va raqamli dinamometr bilan tortiladi.
//    Pandus uchini surib uzunligini o'zgartirish; F·l = P·h (ishqalanishsiz). Grafik F(l).
// 2) Ishqalanish va FIK: o'sha pandus μ bilan; ishlar balansi A_t = A_f + A_q (ustunlar), η. Grafik η(α).
// 3) Lab: taxta (0,8 m), shtativ muftasi (h ni surish), brusok + 100 g li yuklar, prujinali dinamometr (0–4 N).
//    Dinamometr halqasini tortib brusokni tekis ko'tarish, «P ni o'lchash», «Yozish» — jadval va η(α) nuqtalari.
// Fizika: incline-efficiency-physics.js (Node'da tekshirilgan: t_incline_efficiency.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, arrow, bindRange, prefersReducedMotion, angleArc } from "./sim-kit.js";
import { chipBtn, noise } from "./labkit.js";
import { springScale } from "./instruments.js";
import * as P from "./incline-efficiency-physics.js";
import { drawEta, lastFrame } from "./incline-efficiency-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "rule", hover: null };
const rp = { h: 1.2, l: 3, m: 50, mu: 0, muWork: 0.3, s: 0, pulling: false };
const LB = 0.8, BLK = 0.08, DYN = 0.2, M0 = 0.12;
const lab = { h: 0.2, n: 1, surf: "wood", x: 0, auto: false, moving: 0, Fread: null, showP: false, rows: [], hist: [] };
let presetId = null, playing = true, tNow = 0;
const geo = {};

const mu = () => (ui.mode === "work" ? rp.muWork : 0);
const alpha = () => Math.asin(Math.min(1, rp.h / rp.l));
const Pw = () => rp.m * P.G;
const Fpull = () => P.pullForce(Pw(), alpha(), mu());
const lAlpha = () => P.angleOf(lab.h, LB);
const lMu = () => P.SURFACES[lab.surf].mu;
const lP = () => (M0 + 0.1 * lab.n) * P.G;
const lPmeas = () => Math.round(lP() / 0.05) * 0.05;
const lFkin = () => P.pullForce(lP(), lAlpha(), lMu());
const lFsys = () => lFkin() + noise(lab.h * 100 + lab.n * 7, lMu() * 10) * 0.06;
const lReading = () => (lab.moving > 0 ? lFsys() + noise(tNow * 2.3, 1) * 0.03 : P.holdForce(lP(), lAlpha(), lMu()));

/* ------------------------------------------------------------------ 1–2. Pandus */

function crate(ctx, x, y, b, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = "#b45309"; ctx.beginPath(); ctx.roundRect(-b / 2, -b, b, b, 3); ctx.fill();
  ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2; ctx.strokeRect(-b / 2 + 3, -b + 3, b - 6, b - 6);
  ctx.beginPath(); ctx.moveTo(-b / 2 + 3, -b + 3); ctx.lineTo(b / 2 - 3, -3); ctx.stroke();
  ctx.restore();
}
function digitalGauge(ctx, c, a, b, F) {
  const [ax, ay] = a, [bx, by] = b, rot = Math.atan2(by - ay, bx - ax);
  ctx.save(); ctx.translate((ax + bx) / 2, (ay + by) / 2); ctx.rotate(rot);
  const L = Math.hypot(bx - ax, by - ay);
  ctx.strokeStyle = "#71717a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0); ctx.stroke();
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.roundRect(-26, -11, 52, 22, 5); ctx.fill();
  ctx.fillStyle = "#0b1220"; ctx.fillRect(-21, -7, 42, 14);
  ctx.fillStyle = "#4ade80"; ctx.font = '700 10px "SFMono-Regular", Menlo, Consolas, monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (Math.cos(rot) < 0) { ctx.rotate(Math.PI); }
  ctx.fillText(`${fmt(F, 0)} N`, 0, 0.5);
  ctx.restore();
}
function drawRamp(ctx, c, w, h) {
  const narrow = w < 560, work = ui.mode === "work", a = alpha(), ground = h - 26;
  const pw = narrow ? 64 : 120, pr = w - (narrow ? 8 : 16), px0 = pr - pw;
  const k = Math.min((px0 - (narrow ? 24 : 60)) / 6.05, (h - (narrow ? 150 : 70)) / 2.05);
  const top = ground - rp.h * k, run = Math.sqrt(Math.max(0, rp.l * rp.l - rp.h * rp.h)), fx = px0 - run * k;
  // yer
  ctx.fillStyle = c.dark ? "#1f2937" : "#e5e7eb"; ctx.fillRect(0, ground, w, h - ground);
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke();
  // supa (yuk ortish maydonchasi)
  const g = ctx.createLinearGradient(px0, 0, pr, 0); g.addColorStop(0, c.dark ? "#475569" : "#cbd5e1"); g.addColorStop(1, c.dark ? "#334155" : "#94a3b8");
  ctx.fillStyle = g; ctx.fillRect(px0, top, pw, ground - top);
  ctx.fillStyle = "#facc15"; for (let x = px0; x < pr; x += 16) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 8, top); ctx.lineTo(x + 4, top + 6); ctx.lineTo(x - 4, top + 6); ctx.fill(); }
  ctx.fillStyle = "#1e293b"; ctx.fillRect(px0, top, pw, 2);
  // balandlik o'lchami
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(px0 + pw * 0.5, top); ctx.lineTo(px0 + pw * 0.5, ground); ctx.stroke(); ctx.setLineDash([]);
  tag(ctx, `h = ${fmt(rp.h, 1)} m`, px0 + pw * 0.5, (top + ground) / 2, { color: c.warning, bg: c.bg2, align: "center", font: SMALL, pad: 4 });
  // lebyodka
  const wx = pr - (narrow ? 16 : 26), wy = top - 14;
  ctx.fillStyle = "#334155"; ctx.fillRect(wx - 14, top - 4, 28, 4); ctx.fillStyle = "#64748b"; ctx.beginPath(); ctx.arc(wx, wy, 10, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#a16207"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(wx, wy, 6, 0, TAU); ctx.stroke();
  const cr = tNow * (rp.pulling ? 4 : 0); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(cr) * 14, wy + Math.sin(cr) * 14); ctx.stroke();
  // pandus taxtasi
  const ux = Math.cos(a), uy = -Math.sin(a), nx = -uy, ny = ux, th = 7;
  ctx.fillStyle = work && rp.muWork > 0.4 ? "#78716c" : "#d97706"; ctx.beginPath(); ctx.moveTo(fx, ground); ctx.lineTo(px0, top); ctx.lineTo(px0 + nx * th, top + ny * th); ctx.lineTo(fx + nx * th, ground + ny * th); ctx.closePath(); ctx.fill();
  if (work && rp.muWork > 0.02) { ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; const n = Math.round(rp.l * 8); for (let i = 1; i < n; i++) { const t = i / n, x = fx + (px0 - fx) * t, y = ground + (top - ground) * t; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + nx * 3 * (rp.muWork * 2), y + ny * 3 * (rp.muWork * 2)); ctx.stroke(); } }
  if (a < 89 * DEG) angleArc(ctx, fx, ground, 34, -a, 0, c.primary, { label: `${fmt(a / DEG, 0)}°`, labelR: 52 });
  // pandus uchi tutqichi
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(fx, ground + 10, 8, 0, TAU); ctx.fill(); ctx.stroke();
  geo.foot = { x: fx, y: ground + 10, px0, k, ground };
  // l o'lchami
  const off = -22, lx0 = fx - nx * off, ly0 = ground - ny * off, lx1 = px0 - nx * off, ly1 = top - ny * off;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.lineTo(lx1, ly1); ctx.stroke();
  tag(ctx, `l = ${fmt(rp.l, 1)} m`, (lx0 + lx1) / 2 + nx * 10, (ly0 + ly1) / 2 + ny * 10, { color: c.text2, bg: c.bg2, align: "center", font: SMALL, pad: 4 });
  // yuk
  const b = clamp(0.36 * k, 22, 40), sPx = Math.max(0, Math.min(clamp(rp.s, 0, rp.l) * k, rp.l * k - b - 4)), bx = fx + ux * (sPx + b / 2 + 2), by = ground + uy * (sPx + b / 2 + 2);
  crate(ctx, bx, by, b, -a);
  geo.box = { x: bx + nx * -b / 2, y: by - ny * b / 2, k, fx, ground, a };
  // arqon va dinamometr
  // Supaning chap burchagidagi blok: arqon yukdan pandusga parallel keladi, blokni aylanib o'tib,
  // gorizontal holda lebyodkaga boradi (tortish kuchi pandus bo'ylab yo'nalgan).
  const d = b * 0.45, rr = narrow ? 6 : 8, ry = wy - 6;  // arqonning pandusdan balandligi, blok radiusi, lebyodka arqoni sathi
  const tC = (ry + rr - ground + ny * (d - rr)) / uy, C = [fx + ux * tC - nx * (d - rr), ry + rr];
  const T1 = [C[0] - nx * rr, C[1] - ny * rr], a1 = Math.atan2(-ny, -nx);
  const fpx = [bx + ux * (b / 2) - nx * d, by + uy * (b / 2) - ny * d];
  const toT1 = Math.hypot(T1[0] - fpx[0], T1[1] - fpx[1]), gl = Math.min(64, toT1 - 4), dEnd = [fpx[0] + ux * gl, fpx[1] + uy * gl];
  const Fshow = rp.s >= rp.l - 1e-6 ? 0 : Fpull();
  // blok kronshteyni (supaga mahkamlangan) va blok
  const bxk = Math.max(C[0], px0 + 5);  // kronshteyn supa ustida turadi (tik pandusda blok biroz chetga chiqadi)
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(bxk, top - 2); ctx.lineTo(C[0], C[1]); ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = "#475569"; ctx.fillRect(bxk - 7, top - 3, 14, 3);
  const pg = ctx.createRadialGradient(C[0] - rr * 0.3, C[1] - rr * 0.3, 1, C[0], C[1], rr);
  pg.addColorStop(0, "#cbd5e1"); pg.addColorStop(1, "#64748b");
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(C[0], C[1], rr, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.arc(C[0], C[1], 2, 0, TAU); ctx.fill();
  const showGauge = rp.s < rp.l - 0.05 && gl > 56;
  if (showGauge) digitalGauge(ctx, c, fpx, dEnd, Fshow);
  const r0 = showGauge ? dEnd : fpx;
  ctx.strokeStyle = "#a16207"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(T1[0], T1[1]);
  ctx.arc(C[0], C[1], rr, a1, -Math.PI / 2); ctx.lineTo(wx, ry); ctx.stroke();
  // kuch strelkalari
  if (Fshow > 0 && !narrow) {
    const sc = 46 / Pw();
    arrow(ctx, bx, by - ny * b / 2 - 0, 0, Pw() * sc, c.special, { width: 2, head: 7, label: "P" });
    arrow(ctx, bx - nx * b * 0.5 + ux * b * 0.2, by - ny * b * 0.5 + uy * b * 0.2 - 2, ux * Fshow * sc, uy * Fshow * sc, c.danger, { width: 2.2, head: 7, label: "F" });
  }
  // ish paneli
  const s = clamp(rp.s, 0, rp.l), Af = Pw() * s * Math.sin(a), At = Fpull() * s, Aq = mu() * Pw() * Math.cos(a) * s;
  const W = Pw() * rp.h * (work ? 1 / Math.max(0.05, P.efficiency(a, mu())) : 1), bw = narrow ? w - 16 : Math.min(320, w * 0.42), bx0 = narrow ? 8 : 14;
  ctx.font = MID; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (!work) {
    const rows = [["Qiya tekislik", `F = ${fmt(Fpull(), 0)} N`, `yo‘l l = ${fmt(rp.l, 2)} m`, Fpull() / Pw(), rp.l / Math.max(rp.l, 6), c.primary], ["Tik ko‘tarish", `F = P = ${fmt(Pw(), 0)} N`, `yo‘l h = ${fmt(rp.h, 2)} m`, 1, rp.h / 6, c.special]];
    rows.forEach(([name, f, d, fr, dr, col], i) => {
      const y = 14 + i * 34; ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.fillText(`${name}: ${f}, ${d}`, bx0, y);
      ctx.fillStyle = col; ctx.fillRect(bx0, y + 8, (bw * 0.48) * fr, 7); ctx.globalAlpha = 0.45; ctx.fillRect(bx0 + bw * 0.52, y + 8, (bw * 0.48) * (i ? rp.h / 6 : rp.l / 6), 7); ctx.globalAlpha = 1;
    });
    tag(ctx, `A = F·l = P·h = ${fmt(Pw() * rp.h, 0)} J`, bx0, 86, { color: c.success, bg: c.bg2, font: BOLD });
  } else {
    const items = [["A_t (sarflangan)", At, c.primary], ["A_f = Ph (foydali)", Af, c.success], ["A_q (ishqalanish → issiqlik)", Aq, c.danger]];
    items.forEach(([name, v, col], i) => { const y = 14 + i * 26; ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.fillText(`${name}: ${fmt(v, 0)} J`, bx0, y); ctx.fillStyle = col; ctx.fillRect(bx0, y + 7, Math.max(1, (bw * v) / W), 7); });
    tag(ctx, `η = ${fmt(100 * P.efficiency(a, mu()), 0)} %`, bx0, 96, { color: c.text, bg: c.bg2, font: BOLD });
    if (P.holds(a, mu())) tag(ctx, "o‘z-o‘zidan tormozlanadi", bx0 + 74, 96, { color: c.danger, bg: c.bg2, font: SMALL });
  }
  const cy = narrow ? 112 : 112;
  geo.pull = chipBtn(ctx, c, bx0, cy, rp.pulling ? "tortilmoqda…" : "▶ Tortish", rp.pulling, 92, 24, c.success);
  geo.down = chipBtn(ctx, c, bx0 + 98, cy, "Pastga", false, 66, 24);
}

/* ------------------------------------------------------------------ 3. Laboratoriya */

function drawLab(ctx, c, w, h) {
  const narrow = w < 560, a = lAlpha(), table = h - 34;
  const k = Math.min((w - (narrow ? 70 : 230)) / 0.86, (table - 70) / 0.56), x0 = narrow ? 18 : 200;
  // stol
  const tg = ctx.createLinearGradient(0, table, 0, h); tg.addColorStop(0, c.dark ? "#78350f" : "#d6a46a"); tg.addColorStop(1, c.dark ? "#451a03" : "#a16207");
  ctx.fillStyle = tg; ctx.fillRect(0, table, w, 14); ctx.fillStyle = c.dark ? "#292524" : "#78716c"; ctx.fillRect(10, table + 14, 10, h - table); ctx.fillRect(w - 20, table + 14, 10, h - table);
  const ux = Math.cos(a), uy = -Math.sin(a), nx = -uy, ny = ux;
  const bot = [x0, table], topE = [x0 + LB * ux * k, table + LB * uy * k];
  // shtativ
  const sx = topE[0] + (narrow ? 14 : 22), rodTop = table - 0.58 * k;
  ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.roundRect(sx - 30, table - 8, 60, 8, 3); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(sx - 3, rodTop, 6, table - 8 - rodTop);
  const my = topE[1] + 4;
  ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(sx - 9, my - 9, 18, 18, 3); ctx.fill();
  ctx.fillStyle = "#475569"; ctx.fillRect(topE[0] - 4, my - 3, sx - topE[0] - 4, 6);
  ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(sx + 12, my, 5, 0, TAU); ctx.fill();
  geo.clamp = { x: sx, y: my, table, k };
  // taxta
  const th = 6;
  ctx.fillStyle = lab.surf === "glass" ? (c.dark ? "#67e8f9" : "#a5f3fc") : lab.surf === "cloth" ? "#6366f1" : lab.surf === "paper" ? "#f8fafc" : "#e0a96d";
  ctx.beginPath(); ctx.moveTo(bot[0], bot[1]); ctx.lineTo(topE[0], topE[1]); ctx.lineTo(topE[0] + nx * th, topE[1] + ny * th); ctx.lineTo(bot[0] + nx * th, bot[1] + ny * th); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c.dark ? "#a16207" : "#92400e"; ctx.lineWidth = 1; ctx.stroke();
  // h o'lchami
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(topE[0], topE[1]); ctx.lineTo(topE[0], table); ctx.stroke(); ctx.setLineDash([]);
  tag(ctx, `h = ${fmt(lab.h * 100, 0)} cm`, topE[0] - 6, (topE[1] + table) / 2, { color: c.warning, bg: c.bg2, align: "right", font: SMALL, pad: 4 });
  angleArc(ctx, bot[0], bot[1], 64, -a, 0, c.primary, { label: `${fmt(a / DEG, 1)}°`, labelR: 86 });
  // brusok va yuklar
  const bL = BLK * k, bH = 0.035 * k, xs = clamp(lab.x, 0, LB - BLK) * k;
  const p0 = [bot[0] + ux * xs, bot[1] + uy * xs];
  ctx.save(); ctx.translate(p0[0], p0[1]); ctx.rotate(-a);
  ctx.fillStyle = "#c2410c"; ctx.beginPath(); ctx.roundRect(0, -bH, bL, bH, 2); ctx.fill(); ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 1; ctx.stroke();
  for (let i = 0; i < lab.n; i++) { const wx = bL * (0.22 + 0.28 * i), r = Math.min(bL * 0.12, 7); const gg = ctx.createLinearGradient(wx - r, 0, wx + r, 0); gg.addColorStop(0, "#64748b"); gg.addColorStop(0.5, "#e2e8f0"); gg.addColorStop(1, "#475569"); ctx.fillStyle = gg; ctx.fillRect(wx - r, -bH - 2.2 * r, 2 * r, 2.2 * r); ctx.fillStyle = "#94a3b8"; ctx.fillRect(wx - 1.2, -bH - 2.2 * r - 4, 2.4, 4); }
  ctx.fillStyle = "#e5e7eb"; ctx.beginPath(); ctx.arc(bL, -bH / 2, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
  // dinamometr
  const hook = [p0[0] + ux * bL + nx * (-bH / 2), p0[1] + uy * bL + ny * (-bH / 2)], dl = DYN * k;
  const ring = [hook[0] + ux * dl, hook[1] + uy * dl];
  springScale(ctx, c, ring, hook, Math.max(0, lReading()), 4, { w: narrow ? 13 : 16 });
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ring[0] + ux * 9, ring[1] + uy * 9, 8, 0, TAU); ctx.fill(); ctx.stroke();
  geo.ring = { x: ring[0] + ux * 9, y: ring[1] + uy * 9, bot, ux, uy, k };
  // ko'rsatish
  const rd = lReading();
  tag(ctx, lab.moving > 0 ? `F ≈ ${fmt(Math.round(rd / 0.05) * 0.05, 2)} N (tekis harakat)` : `F = ${fmt(rd, 2)} N (tinch)`, ring[0] + nx * -26, ring[1] + ny * -26, { color: lab.moving > 0 ? c.success : c.text2, bg: c.bg2, font: SMALL, align: "center", pad: 4 });
  // P ni o'lchash (alohida)
  const ix = narrow ? w - 64 : 30;
  if (lab.showP) {
    const iy = 46; ctx.fillStyle = "#475569"; ctx.fillRect(ix - 22, iy - 8, 44, 5);
    const hk = [ix, iy + 110]; springScale(ctx, c, [ix, iy], hk, lP(), 4, { w: 16 });
    ctx.fillStyle = "#c2410c"; ctx.fillRect(ix - 22, hk[1] + 2, 44, 16);
    for (let i = 0; i < lab.n; i++) { ctx.fillStyle = "#94a3b8"; ctx.fillRect(ix - 18 + i * 13, hk[1] - 10, 9, 12); }
    tag(ctx, `P = ${fmt(lPmeas(), 2)} N`, ix, hk[1] + 32, { color: c.text, bg: c.bg2, font: BOLD, align: "center" });
  }
  // tugmalar
  const bx = narrow ? 8 : w - 132, by = narrow ? 8 : 12, cw = narrow ? 100 : 120;
  geo.lPull = chipBtn(ctx, c, bx, by, lab.auto ? "tortilmoqda…" : "▶ Tortish", lab.auto, cw, 24, c.success);
  geo.lDown = chipBtn(ctx, c, bx, by + 30, "Pastga", false, cw, 24);
  geo.lP = chipBtn(ctx, c, bx, by + 60, lab.showP ? "P: yashirish" : "P ni o‘lchash", lab.showP, cw, 24, c.special);
  geo.lRec = chipBtn(ctx, c, bx, by + 90, lab.Fread != null ? "✎ Yozish" : "avval torting", lab.Fread != null, cw, 24, c.primary);
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "lab") drawLab(ctx, c, s.w, s.h); else drawRamp(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.44, 330, 380)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
const labPts = () => lab.rows.map((r) => [P.angleOf(r.h, LB) / DEG, 100 * r.eta]);
function drawGraphCanvas(ctx, gs) {
  // grafik faqat «Lab» rejimida (o'lchangan nuqtalar va nazariy egri chiziq)
  return drawEta(ctx, gs, { mu: lMu(), a: lAlpha(), pts: labPts(), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  lab: ["O‘lchangan FIK va nazariy egri chiziq η(α)", "Yashil nuqtalar — jadvaldagi o‘lchashlar, ko‘k chiziq — tanlangan sirt uchun η = 1/(1 + μ ctg α). Taxta uchini turli balandlikka qo‘yib, bir nechta o‘lchash bajaring."],
};
function setTab() {
  const t = TABS[ui.mode]; ui.hover = null;
  $("[data-graph-card]").hidden = !t;  // «Oltin qoida» va «Ishqalanish va FIK» da grafik yo'q
  $("[data-lab-card]").hidden = ui.mode !== "lab";
  if (!t) return;
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); graph.render();
}

/* ------------------------------------------------------------------ Jadval */

const grid = $("[data-lab-grid]");
function renderTable() {
  const head = "<thead><tr><th>№</th><th>h, m</th><th>l, m</th><th>P, N</th><th>F, N</th><th>A<sub>f</sub> = Ph, J</th><th>A<sub>t</sub> = Fl, J</th><th>η, %</th></tr></thead>";
  const body = lab.rows.length ? lab.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fmt(r.h, 2)}</td><td>${fmt(LB, 1)}</td><td>${fmt(r.P, 2)}</td><td>${fmt(r.F, 2)}</td><td>${fmt(r.P * r.h, 3)}</td><td>${fmt(r.F * LB, 3)}</td><td><b>${fmt(100 * r.eta, 0)}</b></td></tr>`).join("") : `<tr><td colspan="8">Hali o‘lchash yo‘q</td></tr>`;
  grid.innerHTML = head + `<tbody>${body}</tbody>`;
}
function record() {
  if (lab.Fread == null) return;
  const F = lab.Fread, Pm = lPmeas();
  lab.rows.push({ h: lab.h, P: Pm, F, eta: (Pm * lab.h) / (F * LB), surf: lab.surf });
  lab.Fread = null; renderTable();
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab_, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab_; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;

function updateReadouts() {
  if (ui.mode !== "lab") {
    const a = alpha(), F = Fpull(), Pv = Pw(), w = P.works(Pv, a, mu(), rp.h);
    setRO("r1", "Tortish kuchi <i>F</i>", u(fmt(F, 0), "N"), `og‘irlik P = ${fmt(Pv, 0)} N`, "orange");
    setRO("r2", "Kuchdan yutuq <i>P/F</i>", u(fmt(Pv / F, 2), "marta"), `yo‘l l/h = ${fmt(rp.l / rp.h, 2)} marta uzun`);
    setRO("r3", "To‘liq ish <i>A</i><sub>t</sub> = <i>Fl</i>", u(fmt(w.At, 0), "J"), `α = ${fmt(a / DEG, 1)}°, l = ${fmt(rp.l, 1)} m`);
    setRO("r4", "Foydali ish <i>A</i><sub>f</sub> = <i>Ph</i>", u(fmt(w.Af, 0), "J"), `h = ${fmt(rp.h, 1)} m`, "green");
    setRO("r5", "Ishqalanishga ketgan ish", u(fmt(w.Aq, 0), "J"), mu() > 0 ? `μ = ${fmt(mu(), 2)} — issiqlikka aylanadi` : "ishqalanish yo‘q");
    setRO("r6", "FIK <i>η</i>", u(fmt(100 * P.efficiency(a, mu()), 0), "%"), mu() > 0 ? (P.holds(a, mu()) ? "o‘z-o‘zidan tormozlanadi" : "qo‘yib yuborilsa sirpanadi") : "ideal tekislik", "green");
    return;
  }
  const a = lAlpha(), Pm = lPmeas(), F = lab.Fread;
  setRO("r1", "Brusok og‘irligi <i>P</i>", lab.showP ? u(fmt(Pm, 2), "N") : "?", lab.showP ? `${fmt((M0 + 0.1 * lab.n) * 1000, 0)} g` : "«P ni o‘lchash» ni bosing", "orange");
  setRO("r2", "Tortish kuchi <i>F</i>", F != null ? u(fmt(F, 2), "N") : "—", F != null ? "tekis harakatdagi ko‘rsatish" : "brusokni torting");
  setRO("r3", "Balandlik <i>h</i> va <i>l</i>", u(`${fmt(lab.h, 2)} / ${fmt(LB, 1)}`, "m"), `α = ${fmt(a / DEG, 1)}°`);
  setRO("r4", "Foydali ish <i>Ph</i>", lab.showP ? u(fmt(Pm * lab.h, 3), "J") : "—", "brusokni h ga ko‘tarish", "green");
  setRO("r5", "Sarflangan ish <i>Fl</i>", F != null ? u(fmt(F * LB, 3), "J") : "—", "dinamometr bajargan ish");
  setRO("r6", "FIK <i>η</i>", F != null && lab.showP ? u(fmt((100 * Pm * lab.h) / (F * LB), 0), "%") : "—", `jadvalda ${lab.rows.length} ta o‘lchash`, "green");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode !== "lab") { t = `η = ${fmt(100 * P.efficiency(alpha(), mu()), 0)} %`; tone = "green"; }
  else { t = lab.moving > 0 ? "Tekis tortilmoqda" : lab.Fread != null ? "Natijani yozing" : "Brusokni torting"; tone = lab.moving > 0 ? "green" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "rule") {
    p.push(`<p>Og‘ir yukni (P = ${fmt(Pw(), 0)} N) ${fmt(rp.h, 1)} m balandlikdagi supaga tik ko‘tarish uchun P ga teng kuch kerak. Pandus bo‘ylab tortganda esa kuch ${fmt(Pw() / Fpull(), 1)} marta kichik — atigi ${fmt(Fpull(), 0)} N. Ammo yuk ${fmt(rp.l, 1)} m yo‘l bosadi — ${fmt(rp.l / rp.h, 1)} marta ko‘p.</p>`);
    p.push("<p>Bajarilgan ish ikkala holda ham bir xil: F·l = P·h. Bu <b>mexanikaning oltin qoidasi</b>: hech bir oddiy mexanizm (richag, blok, qiya tekislik) ishdan yutuq bermaydi — kuchdan necha marta yutilsa, yo‘ldan shuncha marta yutqaziladi. Shuning uchun tog‘ yo‘llari ilon izi qilib quriladi.</p>");
  } else if (ui.mode === "work") {
    const a = alpha();
    p.push(`<p>Haqiqiy pandusda ishqalanish bor: yukni tekis tortish uchun F = P(sin α + μ cos α) kuch kerak. Sarflangan ishning bir qismi (${fmt(100 * (1 - P.efficiency(a, mu())), 0)} %) ishqalanishni yengishga — issiqlikka ketadi. Shuning uchun <b>foydali ish koeffitsiyenti</b> η = A<sub>f</sub>/A<sub>t</sub> har doim 100 % dan kichik.</p>`);
    p.push(P.holds(a, mu()) ? "<p>Bu qiyalikda tg α ≤ μ: qo‘yib yuborilgan yuk o‘zi sirpanmaydi — tekislik <b>o‘z-o‘zidan tormozlanadi</b>. Bunday mexanizmlarning (vint, domkrat, pona) FIKi 50 % dan kichik, lekin yukni ushlab turish uchun qo‘shimcha tormoz kerak emas.</p>" : "<p>Qiyalikni kamaytirsangiz kuchdan yutuq ortadi, lekin FIK kamayadi: yo‘l uzayadi va ishqalanishga ko‘proq ish ketadi. Qiyalik oshganda FIK ortadi, ammo ko‘proq kuch kerak.</p>");
  } else {
    p.push("<p><b>Ishning maqsadi</b>: qiya tekislikning FIKini aniqlash. Kerakli jihozlar: taxta (l = 0,8 m), shtativ va mufta, yog‘och brusok, 100 g li yuklar, dinamometr, chizg‘ich.</p>");
    p.push("<p><b>Bajarish</b>: 1) brusok og‘irligi P ni dinamometr bilan o‘lchang; 2) taxta uchini h balandlikka mahkamlang; 3) brusokni dinamometr bilan taxta bo‘ylab tekis tortib F ni o‘lchang; 4) A<sub>f</sub> = Ph, A<sub>t</sub> = Fl va η = A<sub>f</sub>/A<sub>t</sub> ni hisoblang; 5) h ni o‘zgartirib tajribani takrorlang. Xulosa: qiyalik ortishi bilan FIK qanday o‘zgaradi?</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "rule" ? "<small>Oltin qoida</small> F·l = P·h" : "<small>FIK</small> η = Ph/(Fl) · 100 %";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  tNow += dt;
  if (ui.mode !== "lab") { if (rp.pulling) { rp.s = Math.min(rp.l, rp.s + dt * 0.8); if (rp.s >= rp.l) rp.pulling = false; } }
  else {
    if (lab.auto) { lab.x = Math.min(LB - BLK - 0.02, lab.x + dt * 0.18); lab.moving = 0.25; lab.Fread = Math.round(lFsys() / 0.05) * 0.05; if (lab.x >= LB - BLK - 0.02) lab.auto = false; }
    else if (lab.moving > 0) lab.moving -= dt;
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.2) { uiTimer = 0; refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom";
}
playBtn.addEventListener("click", () => { if (loop.running) { loop.stop(); playing = false; } else { loop.start(); playing = true; } });
function startIfNeeded() {
  if (prefersReducedMotion()) { loop.stop(); setPlayUI(false); return; }
  if (!playing) { loop.stop(); setPlayUI(false); } else loop.start();
}
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "lab") { lab.rows = []; lab.Fread = null; lab.x = 0; lab.auto = false; renderTable(); }
  else { rp.s = 0; rp.pulling = false; }
  refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const hC = bindRange($("#rH"), $("#rHOut"), (v) => `${fmt(v, 1)} m`, (v) => { rp.h = v; if (rp.l < rp.h) { rp.l = rp.h; lC.set(rp.l); } rp.s = Math.min(rp.s, rp.l); customized(); refresh(); });
const lC = bindRange($("#rL"), $("#rLOut"), (v) => `${fmt(v, 1)} m`, (v) => { rp.l = Math.max(v, rp.h); if (v < rp.h) lC.set(rp.l); rp.s = Math.min(rp.s, rp.l); customized(); refresh(); });
const mC = bindRange($("#rM"), $("#rMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { rp.m = v; customized(); refresh(); });
const muC = bindRange($("#rMu"), $("#rMuOut"), (v) => fmt(v, 2), (v) => { rp.muWork = v; customized(); refresh(); });
const lhC = bindRange($("#lH"), $("#lHOut"), (v) => `${fmt(v * 100, 0)} cm`, (v) => { lab.h = v; lab.Fread = null; customized(); refresh(); });
const lnC = bindRange($("#lN"), $("#lNOut"), (v) => `${fmt(v, 0)} ta`, (v) => { lab.n = v; lab.Fread = null; customized(); refresh(); });
function setSurf(k) { if (k !== lab.surf) { lab.rows = []; renderTable(); } lab.surf = k; lab.Fread = null; document.querySelectorAll("[data-surf-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.surfValue === k))); }
document.querySelectorAll("[data-surf-value]").forEach((b) => b.addEventListener("click", () => { setSurf(b.dataset.surfValue); customized(); refresh(); }));

/* Sahnada surish va bosish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode !== "lab") {
    if (inBox(p, geo.pull)) return { kind: "pull" }; if (inBox(p, geo.down)) return { kind: "down" };
    if (geo.box && Math.hypot(p.x - geo.box.x, p.y - geo.box.y) <= 24) return { kind: "box" };
    if (geo.foot && Math.hypot(p.x - geo.foot.x, p.y - geo.foot.y) <= 18) return { kind: "foot" };
  } else {
    if (inBox(p, geo.lPull)) return { kind: "lPull" }; if (inBox(p, geo.lDown)) return { kind: "lDown" }; if (inBox(p, geo.lP)) return { kind: "lP" }; if (inBox(p, geo.lRec)) return { kind: "lRec" };
    if (geo.ring && Math.hypot(p.x - geo.ring.x, p.y - geo.ring.y) <= 20) return { kind: "ring" };
    if (geo.clamp && Math.abs(p.x - geo.clamp.x) <= 22 && Math.abs(p.y - geo.clamp.y) <= 18) return { kind: "clamp" };
  }
  return null;
}
function applyDrag(h, p) {
  if (h.kind === "foot") { const g = geo.foot, run = Math.max(0, (g.px0 - p.x) / g.k); rp.l = clamp(Math.round(Math.hypot(run, rp.h) * 10) / 10, rp.h, 6); lC.set(rp.l); rp.s = Math.min(rp.s, rp.l); }
  else if (h.kind === "box") { const g = geo.box, s = ((p.x - g.fx) * Math.cos(g.a) - (p.y - g.ground) * Math.sin(g.a)) / g.k - 0.3; rp.s = clamp(s, 0, rp.l); }
  else if (h.kind === "clamp") { const g = geo.clamp; lab.h = clamp(Math.round(((g.table - p.y + 4) / g.k) * 100) / 100, 0.05, 0.5); lhC.set(lab.h); lab.Fread = null; }
  else if (h.kind === "ring") {
    const g = geo.ring, along = (p.x - g.bot[0]) * g.ux + (p.y - g.bot[1]) * g.uy, x = clamp(along / g.k - BLK - DYN - 0.012, 0, LB - BLK - 0.02);
    const now = performance.now(), dtm = (now - (h.t || now)) / 1000; const v = dtm > 0 ? (x - lab.x) / dtm : 0;
    if (x > lab.x + 1e-4 && dtm > 0 && v > 0.01) { lab.moving = 0.25; lab.Fread = Math.round(lFsys() / 0.05) * 0.05; }
    lab.x = x; h.t = now;
  }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  e.preventDefault(); customized();
  if (h.kind === "pull") { if (rp.s >= rp.l) rp.s = 0; rp.pulling = true; if (prefersReducedMotion()) { rp.s = rp.l; rp.pulling = false; } refresh(); return; }
  if (h.kind === "down") { rp.s = 0; rp.pulling = false; refresh(); return; }
  if (h.kind === "lPull") { if (lab.x >= LB - BLK - 0.03) lab.x = 0; lab.auto = true; if (prefersReducedMotion()) { lab.auto = false; lab.x = LB - BLK - 0.02; lab.Fread = Math.round(lFsys() / 0.05) * 0.05; } refresh(); return; }
  if (h.kind === "lDown") { lab.x = 0; lab.auto = false; refresh(); return; }
  if (h.kind === "lP") { lab.showP = !lab.showP; refresh(); return; }
  if (h.kind === "lRec") { if (!lab.showP) lab.showP = true; record(); refresh(); return; }
  rp.pulling = false; lab.auto = false;
  applyDrag(h, p);
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true"; refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "foot" ? "ew-resize" : h.kind === "clamp" ? "ns-resize" : h.kind === "box" || h.kind === "ring" ? "grab" : "pointer"; return; }
  applyDrag(drag, p); refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const RP = (mode, title, lesson, h, l, m, muV, s = 0) => ({ mode, title, lesson, set: () => { Object.assign(rp, { h, l, m, s, pulling: false }); if (muV != null) rp.muWork = muV; } });
const LBP = (title, lesson, h, n, surf, rows, showP = true) => ({ mode: "lab", title, lesson, set: () => {
  setSurf(surf); lab.rows = []; lab.showP = showP; lab.x = 0; lab.auto = false; lab.Fread = null; lab.moving = 0;
  for (const hh of rows) { lab.h = hh; lab.n = n; lab.Fread = Math.round(lFsys() / 0.05) * 0.05; record(); }
  lab.h = h; lab.n = n; lab.Fread = null; renderTable();
} });
const PRESETS = {
  ruleTruck: RP("rule", "Yukni supaga ko‘tarish", "50 kg li yukni 1,2 m balandlikdagi supaga 3 m li pandus bo‘ylab tortamiz: kuch 2,5 marta kichik, yo‘l 2,5 marta uzun, ish esa bir xil — 589 J.", 1.2, 3, 50, null),
  ruleGentle: RP("rule", "Uzun pandus (6 m)", "Pandus 6 m: kuch og‘irlikdan 5 marta kichik (≈ 98 N), lekin yuk 6 m yo‘l bosadi. Ish o‘zgarmadi.", 1.2, 6, 50, null),
  ruleSteep: RP("rule", "Qisqa pandus (1,5 m)", "Pandus qisqa va tik: yo‘l kam, lekin kuch og‘irlikning 80 % iga yaqin.", 1.2, 1.5, 50, null),
  ruleLift: RP("rule", "Tik ko‘tarish (l = h)", "Pandus uzunligi balandlikka teng — bu tik ko‘tarish: F = P, yo‘l = h. Pandus uchini chapga surib solishtiring.", 1.2, 1.2, 50, null),
  workWood: RP("work", "Yog‘och pandus (μ = 0,3)", "Yuk yog‘och pandusda sudralmoqda: sarflangan ishning bir qismi ishqalanishga ketadi, η ≈ 65 %. «Tortish» ni bosing va ish ustunlarini kuzating.", 1.2, 2.4, 50, 0.3),
  workIce: RP("work", "Muzli pandus (μ = 0,05)", "Ishqalanish juda kichik — FIK ≈ 92 %. Deyarli butun ish yukni ko‘tarishga ketadi.", 1.2, 2.4, 50, 0.05),
  workGentle: RP("work", "Yotiq pandus", "α ≈ 12°: kuchdan 2 marta yutamiz, lekin FIK atigi ≈ 41 % — ishning ko‘p qismi issiqlikka aylanadi. Bunday tekislik o‘z-o‘zidan tormozlanadi.", 1.2, 6, 50, 0.3),
  workSteep: RP("work", "Tik pandus", "α ≈ 53°: FIK ≈ 82 %, lekin kuch og‘irlikdan atigi 1,0 marta kichik — yutuq yo‘q.", 1.2, 1.5, 50, 0.3),
  labStart: LBP("Lab: birinchi o‘lchash", "Taxta uchi 20 cm balandlikda. Avval «P ni o‘lchash» bilan brusok og‘irligini aniqlang, so‘ng dinamometr halqasini taxta bo‘ylab tortib (yoki «Tortish») F ni o‘lchang va «Yozish» ni bosing.", 0.2, 1, "wood", [], false),
  labSeries: LBP("Lab: turli balandliklar", "Yog‘och taxtada 4 ta balandlikda o‘lchangan natijalar jadvalda. Grafikda nuqtalar nazariy egri chiziq atrofida joylashgan: qiyalik ortishi bilan FIK ortadi.", 0.4, 1, "wood", [0.1, 0.2, 0.3, 0.4]),
  labLoad: LBP("Lab: yuk massasining ta’siri", "Brusokka 3 ta yuk qo‘yildi. P va F ikkalasi ham ortadi, ammo FIK deyarli o‘zgarmaydi — u massaga emas, α va μ ga bog‘liq.", 0.2, 3, "wood", [0.2]),
  labGlass: LBP("Lab: shisha sirt", "Taxtaga shisha qo‘yildi (μ ≈ 0,12): ishqalanish kamaydi — xuddi shu balandlikda FIK ancha katta.", 0.2, 1, "glass", [0.1, 0.2]),
};
const GROUPS = [["Oltin qoida", ["ruleTruck", "ruleGentle", "ruleSteep", "ruleLift"]], ["Ishqalanish va FIK", ["workWood", "workIce", "workGentle", "workSteep"]], ["Laboratoriya ishi", ["labStart", "labSeries", "labLoad", "labGlass"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { rule: "Pandus uchini yoki yukni suring", work: "Pandus uchini suring, «Tortish»", lab: "Dinamometr halqasini torting" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { rule: "Supaga qo‘yilgan pandus, yuk, raqamli dinamometr va lebyodka", work: "Ishqalanishli pandus, yuk va ishlar balansi ustunlari", lab: "Stol ustida shtativga tiralgan taxta, brusok, yuklar va prujinali dinamometr" }[ui.mode]);
}
const MODE_DEFAULT = { rule: "ruleTruck", work: "workWood", lab: "labStart" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  hC.set(rp.h); lC.set(rp.l); mC.set(rp.m); muC.set(rp.muWork); lhC.set(lab.h); lnC.set(lab.n);
  setTab(); startIfNeeded(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

renderTable();
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "ruleTruck");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
