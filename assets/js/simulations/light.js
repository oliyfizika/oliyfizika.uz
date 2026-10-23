// ==========================================================================
// Yorug'likning to'g'ri chiziqli tarqalishi — virtual laboratoriya (simulations/light.html)
// 1) Soya va yarim soya: nuqtaviy/katta manba, shar, ekran (sudrab o'zgartiriladi), ikki lampa, ekranning old ko'rinishi.
// 2) Kamera-obskura: teskari tasvir, o'lcham H = h·f/d, teshik o'lchami va aniqlik (geometriya + difraksiya).
// 3) Tutilishlar: Quyosh — Yer — Oy, Oy orbitasi bo'ylab harakat, to'liq/halqasimon/xususiy tutilishlar, tutilish mavsumlari.
// Fizika: light-physics.js (Node'da tekshirilgan). Grafiklar: light-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as L from "./light-physics.js";
import * as G from "./light-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const DEG = L.DEG;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "shadow", tab: "prof", show: { rays: true, front: true }, speed: 10 };
const sh = { a: 6, b: 10, d: 35, oy: 0, L: 100, two: false, sp: 20 };
const cam = { d: 100, h: 40, f: 20, p: 1 };
const ecl = { E: 0, node: 0, D: 384400, day: 0, E0: 0, node0: 0 };
let presetId = null;
const SCREEN_H = 30; // ekran yarim balandligi, cm

const srcs = () => (sh.two ? [{ x: 0, y: sh.sp / 2, a: sh.a }, { x: 0, y: -sh.sp / 2, a: sh.a }] : [{ x: 0, y: 0, a: sh.a }]);
const shObj = () => ({ x: sh.d, y: sh.oy, b: sh.b });

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(cw, ch, x0, x1, y0, y1, pad = 12) {
  const s = Math.min((cw - 2 * pad) / (x1 - x0), (ch - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (cw - (x1 - x0) * s) / 2; view.oy = (ch - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });
function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y)))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function seg(ctx, a, b, color, w = 1.2, dash = null, alpha = 1) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = alpha; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(SX(a[0]), SY(a[1])); ctx.lineTo(SX(b[0]), SY(b[1])); ctx.stroke(); ctx.restore(); }
function glow(ctx, px, py, r, a = 0.95) { const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(253,224,71,${a})`); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }

/* ================================================================== 1) Soya */

function drawShadow(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  fit(cw, ch, -8, 136, -SCREEN_H - 3, SCREEN_H + 3);
  const S = srcs(), O = shObj(), Ls = sh.L;
  ctx.save(); ctx.fillStyle = c.dark ? "rgba(0,0,0,0.25)" : "rgba(15,23,42,0.05)"; ctx.fillRect(0, 0, cw, ch); ctx.restore();
  // yoritilgan konus (manbadan ekranga)
  S.forEach((s) => poly(ctx, [[s.x, s.y + s.a / 2 + 0.2], [Ls, SCREEN_H], [Ls, -SCREEN_H], [s.x, s.y - s.a / 2 - 0.2]], c.dark ? "rgba(253,224,71,0.07)" : "rgba(253,224,71,0.12)"));
  // soyalar (har bir manba uchun alohida — ustma-ust tushganda qoraroq)
  const alphaP = sh.two ? 0.22 : 0.28, alphaU = sh.two ? 0.38 : 0.7;
  S.forEach((s) => {
    const e = L.shadowEdges(s, O, Ls), top = [O.x, O.y + O.b / 2], bot = [O.x, O.y - O.b / 2];
    poly(ctx, [top, [Ls, e.pTop], [Ls, e.pBot], bot], `rgba(100,116,139,${alphaP})`);
    if (e.umbra > 0) poly(ctx, [top, [Ls, e.uTop], [Ls, e.uBot], bot], `rgba(15,23,42,${alphaU})`);
    else if (e.apex > O.x) { const yA = s.y + ((O.y - s.y) * (e.apex - s.x)) / (O.x - s.x); poly(ctx, [top, [e.apex, yA], bot], `rgba(15,23,42,${alphaU})`); }
    if (ui.show.rays) {
      const A = s.a / 2, k = (x) => (y0, y1) => [x, y0 + ((y1 - y0) * (x - s.x)) / (O.x - s.x)];
      const end = k(Ls);
      seg(ctx, [s.x, s.y + A], end(s.y + A, O.y + O.b / 2), c.warning, 1.3);
      seg(ctx, [s.x, s.y - A], end(s.y - A, O.y - O.b / 2), c.warning, 1.3);
      if (s.a > 0) { seg(ctx, [s.x, s.y - A], end(s.y - A, O.y + O.b / 2), c.warning, 1.1, [5, 4], 0.8); seg(ctx, [s.x, s.y + A], end(s.y + A, O.y - O.b / 2), c.warning, 1.1, [5, 4], 0.8); }
    }
  });
  // ekran va undagi yoritilganlik
  const sx = SX(Ls);
  for (let i = 0; i < 120; i++) {
    const y = SCREEN_H - ((i + 0.5) * 2 * SCREEN_H) / 120, e = L.illumination(S, O, Ls, y);
    const v = Math.round(40 + 215 * e);
    ctx.fillStyle = `rgb(${v},${v},${Math.round(v * 0.9)})`;
    ctx.fillRect(sx, SY(y + SCREEN_H / 120), 7, (2 * SCREEN_H * view.s) / 120 + 0.6);
  }
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.strokeRect(sx, SY(SCREEN_H), 7, 2 * SCREEN_H * view.s);
  tag(ctx, "ekran", sx + 3, SY(-SCREEN_H) + 12, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  // buyum
  ctx.save(); const g = ctx.createRadialGradient(SX(O.x) - O.b * view.s * 0.15, SY(O.y) - O.b * view.s * 0.15, 1, SX(O.x), SY(O.y), (O.b / 2) * view.s);
  g.addColorStop(0, "#cbd5e1"); g.addColorStop(1, "#475569"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(SX(O.x), SY(O.y), (O.b / 2) * view.s, 0, TAU); ctx.fill(); ctx.restore();
  tag(ctx, "shar", SX(O.x), SY(O.y - O.b / 2) + 12, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  // manbalar
  S.forEach((s) => { const r = Math.max(3, (s.a / 2) * view.s); glow(ctx, SX(s.x), SY(s.y), r + 14); ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(SX(s.x), SY(s.y), r, 0, TAU); ctx.fill(); ctx.strokeStyle = "#ca8a04"; ctx.lineWidth = 1.2; ctx.stroke(); });
  tag(ctx, sh.a === 0 ? "nuqtaviy manba" : "manba", SX(0), cw < 560 ? SY(S[0].y + sh.a / 2) - 20 : SY(S[S.length - 1].y - sh.a / 2) + 18, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  // yorliqlar ekran yonida
  if (!sh.two) {
    const e = L.shadowEdges(S[0], O, Ls);
    if (e.umbra > 0.6 && Math.abs((e.uTop + e.uBot) / 2) < SCREEN_H) tag(ctx, "to‘la soya", sx - 8, SY((e.uTop + e.uBot) / 2), { color: "#fff", bg: "rgba(15,23,42,0.75)", align: "right", font: SMALL });
    if (sh.a > 0 && e.pTop - e.uTop > 1.5 && e.pTop - 1 < SCREEN_H) tag(ctx, "yarim soya", sx - 8, SY(Math.min(SCREEN_H - 2, (Math.max(e.uTop, e.uBot) + e.pTop) / 2)), { color: c.text, bg: c.bg, align: "right", font: SMALL });
  }
  // ekranning old ko'rinishi
  if (ui.show.front) {
    const narrow = cw < 560, n = 64, size = narrow ? 72 : Math.min(118, ch * 0.38), bx = 10, by = narrow ? ch - size - 8 : 26;
    const off = document.createElement("canvas"); off.width = n; off.height = n;
    const ox = off.getContext("2d"), img = ox.createImageData(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const y = SCREEN_H - ((i + 0.5) * 2 * SCREEN_H) / n, z = -SCREEN_H + ((j + 0.5) * 2 * SCREEN_H) / n;
      const e = L.illumination(S, O, Ls, y, z), v = 30 + 225 * e, k = (i * n + j) * 4;
      img.data[k] = v; img.data[k + 1] = v * 0.97; img.data[k + 2] = v * 0.85; img.data[k + 3] = 255;
    }
    ox.putImageData(img, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, size, size, 8); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, bx, by, size, size); ctx.restore();
    ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, by, size, size, 8); ctx.stroke();
    tag(ctx, narrow ? "Old ko‘rinish" : "Ekranning old ko‘rinishi", bx + size / 2, by - 14, { color: c.text, bg: c.bg, align: "center", font: SMALL });
  }
}

/* ================================================================== 2) Kamera-obskura */

const BOX = 24; // kamera orqa devori balandligi, cm
function drawTree(ctx, px, base, H, scale = 1, flip = false) {
  // daraxt: tana + toj; H — balandlik (px), flip — teskari
  const s = flip ? -1 : 1;
  ctx.save(); ctx.translate(px, base); ctx.scale(scale, s);
  ctx.fillStyle = "#92400e"; ctx.fillRect(-H * 0.05, -H * 0.42, H * 0.1, H * 0.42);
  ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.ellipse(0, -H * 0.66, H * 0.24, H * 0.34, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(H * 0.08, -H * 0.62, H * 0.04, 0, TAU); ctx.arc(-H * 0.1, -H * 0.75, H * 0.035, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawCamera(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const xL = -Math.max(cam.d + 12, 60), xR = cam.f + 4;
  const bw = Math.min(190, cw * 0.3), bh = Math.min(bw * 0.8, ch - 60), bx = cw - bw - 10, by = (ch - bh) / 2 - 6;
  fit(cw - bw - 16, ch, xL, xR, -Math.max(cam.h / 2 + 4, BOX / 2 + 4), Math.max(cam.h / 2 + 7, BOX / 2 + 5));
  const H = L.pinholeImage(cam.h, cam.d, cam.f), pc = cam.p / 10; // teshik cm da
  // kamera qutisi
  ctx.save(); ctx.fillStyle = c.dark ? "#020617" : "#1e293b"; ctx.fillRect(SX(0), SY(BOX / 2), cam.f * view.s, BOX * view.s); ctx.restore();
  // nur dastalari: daraxt uchi va tubidan teshik orqali
  const top = [-cam.d, cam.h / 2], bot = [-cam.d, -cam.h / 2];
  const holeHalf = Math.max(pc / 2, 1.5 / view.s); // chizish uchun (kamida 3 px)
  const beam = (p, col) => {
    const k = (cam.f + cam.d) / cam.d;
    const yA = p[1] + (holeHalf - p[1]) * k, yB = p[1] + (-holeHalf - p[1]) * k;
    poly(ctx, [p, [0, holeHalf], [cam.f, yA], [cam.f, yB], [0, -holeHalf]], col);
    if (ui.show.rays) seg(ctx, p, [cam.f, p[1] + (0 - p[1]) * k], col.replace(/[\d.]+\)$/, "1)"), 1.2);
  };
  beam(top, "rgba(34,197,94,0.28)"); beam(bot, "rgba(180,83,9,0.28)");
  // old devor teshik bilan
  ctx.fillStyle = c.text2; ctx.fillRect(SX(0) - 3, SY(BOX / 2), 6, (BOX / 2 - holeHalf) * view.s); ctx.fillRect(SX(0) - 3, SY(-holeHalf), 6, (BOX / 2 - holeHalf) * view.s);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.strokeRect(SX(0), SY(BOX / 2), cam.f * view.s, BOX * view.s);
  // orqa devordagi tasvir (yon ko'rinish)
  if (Math.abs(H / 2) < BOX / 2) { ctx.fillStyle = "rgba(253,230,138,0.85)"; ctx.fillRect(SX(cam.f) - 3, SY(H / 2), 3, H * view.s); }
  // daraxt
  drawTree(ctx, SX(-cam.d), SY(-cam.h / 2), cam.h * view.s);
  tag(ctx, "buyum", SX(-cam.d), SY(-cam.h / 2) + 12, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, `teshik p = ${fmt(cam.p, 2)} mm`, SX(0), SY(BOX / 2) - 12, { color: c.text, bg: c.bg, align: "center", font: SMALL });
  // o'lcham chiziqlari
  const yd = -Math.max(cam.h / 2, BOX / 2) - 2;
  seg(ctx, [-cam.d, yd], [0, yd], c.text3, 1); seg(ctx, [0, yd], [cam.f, yd], c.text3, 1);
  tag(ctx, `d = ${fmt(cam.d, 0)} cm`, SX(-cam.d / 2), SY(yd), { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  // orqa devor (ichkaridan ko'rinish) — kattalashtirilgan
  ctx.save(); ctx.fillStyle = "#020617"; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.clip();
  const span = Math.max(1.5 * H, 3), pxPerCm = bh / span, blurCm = L.totalBlur(cam.p / 1000, cam.d / 100, cam.f / 100) * 100;
  const rel = (cam.p / 10 / cam.f) / (0.1 / 20); // (p/f) / (1 mm / 20 cm)
  ctx.globalAlpha = clamp(0.2 + 0.8 * rel, 0.2, 1);
  ctx.filter = `blur(${clamp(blurCm * pxPerCm * 0.6, 0, 24).toFixed(1)}px)`;
  drawTree(ctx, bx + bw / 2, by + bh / 2 - (H * pxPerCm) / 2, H * pxPerCm, 1, true);
  ctx.restore();
  ctx.strokeStyle = c.border; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.stroke();
  tag(ctx, cw < 560 ? "Orqa devorda" : "Orqa devorda (kattalashtirilgan)", bx + bw / 2, by - 12, { color: c.text, bg: c.bg, align: "center", font: SMALL });
}

/* ================================================================== 3) Tutilishlar */

const geomE = { ex: 0, ey: 0, R: 0, re: 0, side: null };
function eclLayout(cw, ch) {
  const topH = ch * 0.7;
  const ex = cw < 560 ? cw * 0.4 : cw * 0.52, ey = topH * 0.5, R = Math.min(topH * 0.36, cw * 0.17), re = Math.max(9, R * 0.16);
  Object.assign(geomE, { ex, ey, R, re, topH });
  return geomE;
}
const moonPos = (E) => ({ x: geomE.ex - geomE.R * Math.cos(E * DEG), y: geomE.ey - geomE.R * Math.sin(E * DEG) });
function drawMoonPhase(ctx, x, y, r, E, dark = "#1e293b") {
  // Quyosh chap tomonda: Oyning chap yarmi yoritilgan (yuqoridan ko'rinish)
  ctx.save(); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(x, y, r, Math.PI / 2, (3 * Math.PI) / 2); ctx.fill(); ctx.restore();
}
function skyMoon(ctx, cx, cy, r, E) {
  // Yerdan ko'rinadigan faza: k — yoritilgan qism; o'sayotgan oyda o'ng tomoni yorug' (Shimoliy yarimshar)
  const k = L.moonPhase(E), right = ((E % 360) + 360) % 360 < 180, lit = "#f1f5f9", dark = "#334155";
  ctx.save();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = lit; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !right); ctx.closePath(); ctx.fill();
  ctx.fillStyle = k < 0.5 ? dark : lit; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.01, r * Math.abs(1 - 2 * k)), r, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawEclipse(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const g = eclLayout(cw, ch), st = L.eclipseState(ecl.E, ecl.node, ecl.D);
  // fon — kosmos
  ctx.fillStyle = c.dark ? "#020617" : "#0f172a"; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; for (let i = 0; i < 70; i++) { const x = (i * 97.3) % cw, y = (i * 53.7) % ch; ctx.fillRect(x, y, 1, 1); }
  // Quyosh
  const sr = g.topH * 0.9, sx = -sr * 0.55, sy = g.ey;
  const sg = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 1.25); sg.addColorStop(0, "rgba(253,224,71,1)"); sg.addColorStop(0.8, "rgba(251,191,36,0.35)"); sg.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr * 1.25, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(sx, sy, sr * 0.8, 0, TAU); ctx.fill();
  tag(ctx, "Quyosh", 12, 16, { color: "#0f172a", bg: "#fde68a", font: MID });
  // quyosh nurlari (Yer va Oyga)
  // Yer soyasi (yuqoridan ko'rinish, sxematik)
  const uLen = g.R * 2.4;
  ctx.save(); ctx.fillStyle = "rgba(148,163,184,0.16)"; ctx.beginPath(); ctx.moveTo(g.ex, g.ey - g.re); ctx.lineTo(g.ex + uLen * 1.2, g.ey - g.re - uLen * 0.28); ctx.lineTo(g.ex + uLen * 1.2, g.ey + g.re + uLen * 0.28); ctx.lineTo(g.ex, g.ey + g.re); ctx.fill();
  ctx.fillStyle = "rgba(2,6,23,0.75)"; ctx.beginPath(); ctx.moveTo(g.ex, g.ey - g.re); ctx.lineTo(g.ex + uLen, g.ey); ctx.lineTo(g.ex, g.ey + g.re); ctx.fill(); ctx.restore();
  // Oy orbitasi
  ctx.save(); ctx.strokeStyle = "rgba(226,232,240,0.45)"; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(g.ex, g.ey, g.R, 0, TAU); ctx.stroke(); ctx.restore();
  // tugunlar chizig'i (yuqoridan): Quyosh yo'nalishiga nisbatan node burchakda
  const nx = -Math.cos(ecl.node * DEG), ny = -Math.sin(ecl.node * DEG);
  ctx.save(); ctx.strokeStyle = "rgba(167,139,250,0.7)"; ctx.lineWidth = 1.2; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(g.ex - nx * g.R * 1.15, g.ey - ny * g.R * 1.15); ctx.lineTo(g.ex + nx * g.R * 1.15, g.ey + ny * g.R * 1.15); ctx.stroke(); ctx.restore();
  ctx.fillStyle = "#a78bfa"; [1, -1].forEach((k) => { ctx.beginPath(); ctx.arc(g.ex + k * nx * g.R, g.ey + k * ny * g.R, 3.5, 0, TAU); ctx.fill(); });
  const mm0 = moonPos(ecl.E); if (Math.hypot(mm0.x - (g.ex + nx * g.R), mm0.y - (g.ey + ny * g.R)) > 30) tag(ctx, "tugun", g.ex + nx * g.R * 1.15 + 4, g.ey + ny * g.R * 1.15 - 10, { color: "#c4b5fd", bg: "rgba(15,23,42,0.8)", font: SMALL });
  // Yer
  ctx.fillStyle = "#2563eb"; ctx.beginPath(); ctx.arc(g.ex, g.ey, g.re, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(2,6,23,0.55)"; ctx.beginPath(); ctx.arc(g.ex, g.ey, g.re, -Math.PI / 2, Math.PI / 2); ctx.fill();
  tag(ctx, "Yer", g.ex, g.ey + g.re + 12, { color: "#bfdbfe", bg: "rgba(15,23,42,0.8)", align: "center", font: SMALL });
  // Oy va uning soyasi
  const m = moonPos(ecl.E), mr = Math.max(5, g.re * 0.42);
  const ratio = st.rM / L.ECL.rSun, mLen = (g.R - g.re) * Math.pow(ratio, 6);
  const hits = st.solar.type !== "none";
  ctx.save(); ctx.globalAlpha = hits ? 0.85 : 0.3; ctx.fillStyle = "rgba(2,6,23,0.9)"; ctx.beginPath(); ctx.moveTo(m.x, m.y - mr); ctx.lineTo(m.x + mLen, m.y); ctx.lineTo(m.x, m.y + mr); ctx.fill();
  if (ratio < 1) { ctx.strokeStyle = "rgba(148,163,184,0.7)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(m.x + mLen, m.y); ctx.lineTo(m.x + mLen + 40, m.y - 6); ctx.moveTo(m.x + mLen, m.y); ctx.lineTo(m.x + mLen + 40, m.y + 6); ctx.stroke(); }
  ctx.restore();
  const inShadow = st.lunar.type === "total" || st.lunar.type === "partial";
  drawMoonPhase(ctx, m.x, m.y, mr, ecl.E, "#334155");
  if (inShadow) { ctx.fillStyle = st.lunar.type === "total" ? "rgba(185,28,28,0.75)" : "rgba(127,29,29,0.5)"; ctx.beginPath(); ctx.arc(m.x, m.y, mr, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(m.x, m.y, mr + 4, 0, TAU); ctx.stroke();
  tag(ctx, "Oy", m.x, m.y - mr - 12, { color: "#fde68a", bg: "rgba(15,23,42,0.8)", align: "center", font: SMALL });
  // yon ko'rinish (orbita og'ishi, 4 marta kattalashtirilgan)
  const y0 = g.topH + (ch - g.topH) * 0.5, kb = (ch - g.topH) * 0.3 / 5.2;
  ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(0, g.topH, cw, ch - g.topH);
  ctx.strokeStyle = "rgba(226,232,240,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(cw, y0); ctx.stroke();
  const rhoPx = Math.max(3, st.lunar.rhoU * kb);
  ctx.fillStyle = "rgba(148,163,184,0.25)"; ctx.fillRect(g.ex, y0 - rhoPx, g.R * 1.6, 2 * rhoPx);
  ctx.fillStyle = "#2563eb"; ctx.beginPath(); ctx.arc(g.ex, y0, 5, 0, TAU); ctx.fill();
  const mx = m.x, my = y0 - st.beta * kb;
  ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(mx, my, 4, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(mx, my, 7, 0, TAU); ctx.stroke();
  tag(ctx, `Yon ko‘rinish (og‘ish kattalashtirilgan): ${Math.abs(st.beta) < 0.05 ? "Oy ekliptikada" : `Oy ekliptikadan ${st.beta > 0 ? "yuqorida" : "pastda"}`}, β = ${fmt(st.beta, 2)}°`, 12, g.topH + 14, { color: "#e2e8f0", bg: "rgba(15,23,42,0.85)", font: SMALL });
  tag(ctx, "ekliptika tekisligi", cw - 12, y0 - 10, { color: "#94a3b8", bg: "rgba(15,23,42,0.85)", align: "right", font: SMALL });
  // Yerdan ko'rinish
  drawSky(ctx, cw, st, g);
}
function drawSky(ctx, cw, st, g) {
  const R = Math.min(cw < 560 ? 46 : 62, g.topH * 0.36), cx = cw - R - 12, cy = R + 12;
  const Ew = ((ecl.E % 360) + 360) % 360, nearNew = Ew < 25 || Ew > 335, nearFull = Math.abs(Ew - 180) < 25;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  let title = "Yerdan ko‘rinish: Oy fazasi";
  if (nearNew) {
    title = st.solar.type === "none" ? "Yerdan: Quyosh (tutilish yo‘q)" : `Yerdan: ${{ total: "to‘liq", annular: "halqasimon", partial: "xususiy" }[st.solar.type]} tutilish`;
    const k = R / 0.75; // px / gradus
    const dl = Ew > 180 ? Ew - 360 : Ew, dirLen = Math.hypot(dl, st.beta) || 1;
    const ox = (-dl / dirLen) * st.solar.sep * k, oy = (-st.beta / dirLen) * st.solar.sep * k;
    ctx.fillStyle = st.solar.type === "total" ? "#020617" : "#1e3a8a"; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    if (st.solar.type === "total") { const cg = ctx.createRadialGradient(cx, cy, st.solar.rS * k, cx, cy, st.solar.rS * k * 2.2); cg.addColorStop(0, "rgba(255,255,255,0.8)"); cg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, st.solar.rS * k * 2.2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(cx, cy, st.solar.rS * k, 0, TAU); ctx.fill();
    if (st.solar.type !== "none") { ctx.fillStyle = "#020617"; ctx.beginPath(); ctx.arc(cx + ox, cy + oy, st.solar.rM * k, 0, TAU); ctx.fill(); }
  } else if (nearFull) {
    const k = R / 1.6;
    ctx.fillStyle = "#020617"; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.fillStyle = "rgba(148,163,184,0.12)"; ctx.beginPath(); ctx.arc(cx, cy, st.lunar.rhoP * k, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.5)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(cx, cy, st.lunar.rhoU * k, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const dl = Ew - 180, dirLen = Math.hypot(dl, st.beta) || 1;
    const mx = cx + (dl / dirLen) * st.lunar.sep * k, my = cy - (st.beta / dirLen) * st.lunar.sep * k, mr = st.lunar.rM * k;
    ctx.fillStyle = st.lunar.type === "total" ? "#b45309" : "#e2e8f0"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    if (st.lunar.type === "partial") { ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.clip(); ctx.fillStyle = "rgba(127,29,29,0.85)"; ctx.beginPath(); ctx.arc(cx, cy, st.lunar.rhoU * k, 0, TAU); ctx.fill(); ctx.restore(); }
    if (st.lunar.type === "total") { ctx.fillStyle = "rgba(127,29,29,0.45)"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill(); }
    if (st.lunar.type === "penumbral") { ctx.fillStyle = "rgba(15,23,42,0.3)"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill(); }
    title = st.lunar.type === "none" ? "Yerdan: to‘lin oy (tutilish yo‘q)" : `Yerdan: ${{ total: "to‘liq", partial: "xususiy", penumbral: "yarim soyali" }[st.lunar.type]} Oy tutilishi`;
  } else {
    ctx.fillStyle = "#0b1220"; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    skyMoon(ctx, cx, cy, R * 0.6, ecl.E);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(226,232,240,0.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  tag(ctx, title, cw < 560 ? cw - 6 : cx, cy + R + 12, { color: "#e2e8f0", bg: "rgba(15,23,42,0.85)", align: cw < 560 ? "right" : "center", font: SMALL });
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "shadow") drawShadow(ctx, stage); else if (ui.mode === "camera") drawCamera(ctx, stage); else drawEclipse(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.46), 260, 370)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  shadow: [["prof", "E(y)", "Ekrandagi yoritilganlik", "To‘la soyaga manbaning hech bir nuqtasidan yorug‘lik tushmaydi; yarim soyaga — faqat bir qismidan. Nuqtaviy manbada yarim soya bo‘lmaydi."], ["size", "D(L)", "Soya o‘lchami ekran masofasiga bog‘liq", "Ekran uzoqlashgan sari yarim soya kengayadi. Manba shardan katta bo‘lsa, to‘la soya kichrayib, ma’lum masofada yo‘qoladi."]],
  camera: [["H", "H(d)", "Tasvir o‘lchami", "Buyum uzoqlashsa tasvir kichrayadi: H/h = f/d — nurlar teshikdan to‘g‘ri chiziq bo‘ylab o‘tadi."], ["blur", "Dog‘(p)", "Tasvir aniqligi teshik o‘lchamiga bog‘liq", "Katta teshik — har bir nuqta katta dog‘ beradi; juda kichik teshikda difraksiya xiralashtiradi. Eng aniq tasvir — oraliqdagi teshikda."]],
  eclipse: [["beta", "β(E)", "Oyning ekliptikadan og‘ishi", "Tutilish faqat yangi oy yoki to‘lin oy paytida Oy ekliptikaga juda yaqin (tugun yonida) bo‘lsa ro‘y beradi."], ["year", "Yil davomida", "Bir yildagi yangi va to‘lin oylar", "Tutilishlar yiliga ikki marta, taxminan har 173 sutkada, «tutilish mavsumlari»da to‘planadi."]],
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
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "shadow") return ui.tab === "size" ? G.drawSizes(ctx, st, { a: sh.a, b: sh.b, d: sh.d, Ls: sh.L }) : G.drawProfile(ctx, st, { srcs: srcs(), obj: shObj(), Ls: sh.L, H: SCREEN_H });
  if (ui.mode === "camera") return ui.tab === "blur" ? G.drawBlur(ctx, st, { p: cam.p, d: cam.d, f: cam.f }) : G.drawPinholeH(ctx, st, { h: cam.h, d: cam.d, f: cam.f });
  if (ui.tab === "year") return G.drawYear(ctx, st, { E: ecl.E0, node: ecl.node0, D: ecl.D, day: ecl.day });
  return G.drawBeta(ctx, st, { E: ecl.E, node: ecl.node, D: ecl.D });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const cm = (x, d = 1) => `${fmt(x, d)}<small>cm</small>`;
const TYPE_UZ = { total: "to‘liq", annular: "halqasimon", partial: "xususiy", penumbral: "yarim soyali", none: "yo‘q" };
const phaseName = (E) => { const e = ((E % 360) + 360) % 360; return e < 10 || e > 350 ? "yangi oy" : e < 80 ? "o‘sayotgan o‘roq" : e <= 100 ? "birinchi chorak" : e < 170 ? "o‘sayotgan oy" : e <= 190 ? "to‘lin oy" : e < 260 ? "kamayayotgan oy" : e <= 280 ? "oxirgi chorak" : "kamayayotgan o‘roq"; };

function updateReadouts() {
  if (ui.mode === "shadow") {
    const Du = L.umbraDiameter(sh.a, sh.b, sh.d, sh.L), Dp = L.penumbraDiameter(sh.a, sh.b, sh.d, sh.L);
    const e = L.shadowEdges(srcs()[0], shObj(), sh.L);
    setRO("r1", "To‘la soya <i>D</i><sub>u</sub>", Du > 0 ? cm(Du) : "yo‘q", Du > 0 ? "Manbaning hech qayeridan nur tushmaydi" : `Konus uchi ${fmt(e.apex, 0)} cm da — ekran undan uzoqda`, Du > 0 ? "" : "orange");
    setRO("r2", "Yarim soya <i>D</i><sub>p</sub>", sh.a > 0 ? cm(Dp) : "yo‘q", sh.a > 0 ? "Tashqi diametri" : "Nuqtaviy manbada yarim soya yo‘q");
    setRO("r3", "Manba <i>a</i>", sh.a > 0 ? cm(sh.a) : "nuqta", sh.two ? `Ikkita lampa, oralig‘i ${fmt(sh.sp, 0)} cm` : "Yorituvchi disk");
    setRO("r4", "Shar <i>b</i>", cm(sh.b), `Manbadan ${fmt(sh.d, 0)} cm`);
    setRO("r5", "Ekran <i>L</i>", cm(sh.L, 0), `Shardan ${fmt(sh.L - sh.d, 0)} cm`);
    setRO("r6", "Kattalashish", `${fmt(sh.L / sh.d, 2)}<small>×</small>`, "Nuqtaviy manbada soya D = b·L/d");
  } else if (ui.mode === "camera") {
    const H = L.pinholeImage(cam.h, cam.d, cam.f), bl = L.totalBlur(cam.p / 1000, cam.d / 100, cam.f / 100) * 1000, po = L.optimalPinhole(cam.d / 100, cam.f / 100) * 1000;
    setRO("r1", "Tasvir balandligi <i>H</i>", cm(H, 2), "Teskari tasvir");
    setRO("r2", "Kichrayish <i>H/h</i>", fmt(H / cam.h, 3), "= f/d");
    setRO("r3", "Dog‘ o‘lchami", `${fmt(bl, 2)}<small>mm</small>`, `geometrik ${fmt(L.geoBlur(cam.p, cam.d, cam.f), 2)} mm, difraksion ${fmt(L.diffBlur(cam.p / 1000, cam.f / 100) * 1000, 2)} mm`);
    setRO("r4", "Eng yaxshi teshik", `${fmt(po, 2)}<small>mm</small>`, Math.abs(cam.p - po) < 0.08 ? "Tanlangan teshik eng aniq" : cam.p > po ? "Teshik katta — xira" : "Teshik juda kichik — difraksiya", Math.abs(cam.p - po) < 0.08 ? "" : "muted");
    setRO("r5", "Yorqinlik", `${fmt(100 * Math.pow(cam.p / 10 / cam.f / (0.1 / 20), 2), 0)}<small>%</small>`, "∝ (p/f)², p = 1 mm, f = 20 cm ga nisbatan");
    setRO("r6", "Aniqlik (chiziqlar)", fmt(H * 10 / bl, 0), "Tasvirga sig‘adigan dog‘lar soni");
  } else {
    const st = L.eclipseState(ecl.E, ecl.node, ecl.D), Ew = ((ecl.E % 360) + 360) % 360;
    setRO("r1", "Oy fazasi", phaseName(ecl.E), `Elongatsiya ${fmt(Ew, 0)}°, yoritilgan ${fmt(L.moonPhase(ecl.E) * 100, 0)}%`);
    setRO("r2", "Ekliptikadan og‘ish <i>β</i>", `${fmt(st.beta, 2)}°`, "Orbita og‘ishi 5,15°");
    setRO("r3", "Quyosh tutilishi", TYPE_UZ[st.solar.type], st.solar.type === "none" ? (Ew < 30 || Ew > 330 ? "Oy soyasi Yerga tushmaydi" : "Faqat yangi oyda bo‘lishi mumkin") : `Quyoshning ${fmt(st.solar.obsc * 100, 0)}% yopiladi`, st.solar.type === "none" ? "" : "orange");
    setRO("r4", "Oy tutilishi", TYPE_UZ[st.lunar.type], st.lunar.type === "none" ? (Math.abs(Ew - 180) < 30 ? "Oy Yer soyasidan o‘tmaydi" : "Faqat to‘lin oyda bo‘lishi mumkin") : st.lunar.type === "penumbral" ? "Oy faqat yarim soyada — sezilarli emas" : `Faza ${fmt(st.lunar.magU, 2)}`, st.lunar.type === "none" ? "" : "orange");
    setRO("r5", "Oygacha masofa", `${fmt(ecl.D / 1000, 1)}<small>ming km</small>`, `Oy ${fmt(2 * st.rM * 60, 1)}′, Quyosh ${fmt(2 * L.ECL.rSun * 60, 1)}′`);
    setRO("r6", "Vaqt", `${fmt(ecl.day, 0)}<small>sutka</small>`, "Sinodik oy 29,53 sutka");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "shadow") { const Du = L.umbraDiameter(sh.a, sh.b, sh.d, sh.L); t = sh.a === 0 ? "Keskin soya" : Du > 0 ? "Soya va yarim soya" : "Faqat yarim soya"; tone = Du > 0 ? "blue" : "orange"; }
  else if (ui.mode === "camera") { const po = L.optimalPinhole(cam.d / 100, cam.f / 100) * 1000; t = Math.abs(cam.p - po) < 0.08 ? "Eng aniq tasvir" : "Teskari tasvir"; tone = Math.abs(cam.p - po) < 0.08 ? "green" : "blue"; }
  else { const st = L.eclipseState(ecl.E, ecl.node, ecl.D); if (st.solar.type !== "none") { t = `Quyosh tutilishi: ${TYPE_UZ[st.solar.type]}`; tone = "orange"; } else if (st.lunar.type !== "none") { t = `Oy tutilishi: ${TYPE_UZ[st.lunar.type]}`; tone = "orange"; } else { t = phaseName(ecl.E); tone = "blue"; } }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "shadow") {
    const Du = L.umbraDiameter(sh.a, sh.b, sh.d, sh.L);
    p.push("<p>Yorug‘lik to‘g‘ri chiziq bo‘ylab tarqaladi, shuning uchun shar orqasida soya hosil bo‘ladi. Soya chegaralarini manbaning chetlaridan shar chetlariga urinma o‘tkazilgan <b>nurlar</b> belgilaydi.</p>");
    p.push(sh.a === 0 ? "<p><b>Nuqtaviy manba</b> keskin chegarali soya beradi — yarim soya yo‘q.</p>" : `<p><b>Katta manba</b>da to‘la soya atrofida <b>yarim soya</b> hosil bo‘ladi: u yerga manbaning faqat bir qismidan yorug‘lik tushadi.${Du > 0 ? "" : " Manba shardan katta bo‘lgani uchun to‘la soya konusi ekrangacha yetmaydi — ekranda faqat yarim soya."}</p>`);
    if (sh.two) p.push("<p>Ikki lampa ikkita soya beradi; ular ustma-ust tushgan joy eng qorong‘i — u yerga ikkala lampadan ham yorug‘lik tushmaydi.</p>");
  } else if (ui.mode === "camera") {
    p.push("<p><b>Kamera-obskura</b> (qorong‘i quti) — bir devorida kichik teshik bor quti. Buyumning har bir nuqtasidan chiqqan nurlar teshikdan to‘g‘ri chiziq bo‘ylab o‘tib, qarama-qarshi devorda <b>teskari</b> tasvir hosil qiladi. Bu yorug‘likning to‘g‘ri chiziqli tarqalishining yaqqol isboti.</p>");
    p.push("<p>Teshik kattalashsa tasvir yorqinlashadi, lekin xiralashadi; juda kichik teshikda esa difraksiya tufayli yana xiralashadi.</p>");
  } else {
    p.push("<p><b>Quyosh tutilishi</b> — yangi oyda Oy Quyosh va Yer orasiga tushib, uning soyasi Yerga tushganda; <b>Oy tutilishi</b> — to‘lin oyda Oy Yer soyasiga kirganda ro‘y beradi.</p>");
    p.push("<p>Oy orbitasi ekliptikaga 5° og‘gan, shuning uchun ko‘pincha Oy soyadan yuqori yoki pastdan o‘tadi. Tutilish uchun yangi yoki to‘lin oy <b>tugun</b> yaqinida bo‘lishi kerak. Oy Quyoshdan 400 marta kichik, lekin 400 marta yaqin — ikkalasi osmonda deyarli bir xil kattalikda: Oy yaqinroq bo‘lsa to‘liq, uzoqroq bo‘lsa halqasimon tutilish bo‘ladi.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "shadow" ? "<small>To‘la soya</small> D = b + (b − a)(L − d)/d" : ui.mode === "camera" ? "<small>Kamera-obskura</small> H/h = f/d" : "<small>Tutilish</small> Quyosh — Oy — Yer bir chiziqda";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Boshqaruv */

const sAC = bindRange($("#sA"), $("#sAOut"), (v) => (v === 0 ? "nuqta" : `${fmt(v, 1)} cm`), (v) => { sh.a = v; customized(); refresh(); });
const sBC = bindRange($("#sB"), $("#sBOut"), (v) => `${fmt(v, 1)} cm`, (v) => { sh.b = v; customized(); refresh(); });
const sDC = bindRange($("#sD"), $("#sDOut"), (v) => `${fmt(v, 0)} cm`, (v) => { sh.d = Math.min(v, sh.L - 5); customized(); refresh(); });
const sLC = bindRange($("#sL"), $("#sLOut"), (v) => `${fmt(v, 0)} cm`, (v) => { sh.L = Math.max(v, sh.d + 5); customized(); refresh(); });
const sSC = bindRange($("#sS"), $("#sSOut"), (v) => `${fmt(v, 0)} cm`, (v) => { sh.sp = v; customized(); refresh(); });
$("[data-two]").addEventListener("change", (e) => { sh.two = e.target.checked; syncAll(); customized(); refresh(); });

const cDC = bindRange($("#cD"), $("#cDOut"), (v) => `${fmt(v, 0)} cm`, (v) => { cam.d = v; customized(); refresh(); });
const cHC = bindRange($("#cH"), $("#cHOut"), (v) => `${fmt(v, 0)} cm`, (v) => { cam.h = v; customized(); refresh(); });
const cFC = bindRange($("#cF"), $("#cFOut"), (v) => `${fmt(v, 0)} cm`, (v) => { cam.f = v; customized(); refresh(); });
const cPC = bindRange($("#cP"), $("#cPOut"), (v) => `${fmt(v, 2)} mm`, (v) => { cam.p = v; customized(); refresh(); });
$("[data-popt]").addEventListener("click", () => { cam.p = Math.round(L.optimalPinhole(cam.d / 100, cam.f / 100) * 1000 / 0.05) * 0.05; cPC.set(cam.p); customized(); refresh(); });

const eEC = bindRange($("#eE"), $("#eEOut"), (v) => `${fmt(v, 1)}°`, (v) => { setE(v); customized(); refresh(); });
const eNC = bindRange($("#eN"), $("#eNOut"), (v) => `${fmt(v, 1)}°`, (v) => { ecl.node = v; resetClock(); customized(); refresh(); });
const eMC = bindRange($("#eM"), $("#eMOut"), (v) => `${fmt(v / 1000, 1)} ming km`, (v) => { ecl.D = v; customized(); refresh(); });
function setE(v) { ecl.E = v; resetClock(); }
function resetClock() { ecl.day = 0; ecl.E0 = ecl.E; ecl.node0 = ecl.node; }
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));

/* Animatsiya: Oy orbita bo'ylab, tugunlar Quyoshga nisbatan siljiydi */
const playBtn = $("[data-play]");
const loop = createLoop((dt) => {
  ecl.day += dt * ui.speed;
  ecl.E = (((ecl.E0 + (360 / L.ECL.month) * ecl.day) % 360) + 360) % 360;
  let n = ecl.node0 - (360 / L.ECL.eclYear) * ecl.day; n = ((((n + 180) % 360) + 360) % 360) - 180; ecl.node = n;
  eEC.set(Math.round(ecl.E * 2) / 2); eNC.set(Math.round(ecl.node * 2) / 2);
  updateReadouts(); updateStatus(); stage.render(); graph.render();
}, {
  onStateChange(on) {
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
    playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Boshlash";
  },
});
playBtn.addEventListener("click", () => { if (loop.running) loop.stop(); else { if (ecl.day === 0) resetClock(); loop.start(); } });
playBtn.querySelector("[data-play-icon]").innerHTML = icon("play");

/* Sudrash */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
function hitTest(px, py) {
  if (ui.mode === "shadow") {
    if (Math.hypot(px - SX(sh.d), py - SY(sh.oy)) < Math.max(18, (sh.b / 2) * view.s + 6)) return "ball";
    if (Math.abs(px - SX(sh.L) - 3) < 14) return "screen";
  } else if (ui.mode === "camera") {
    if (Math.abs(px - SX(-cam.d)) < 22 && py > SY(cam.h / 2) - 10 && py < SY(-cam.h / 2) + 10) return "tree";
  } else {
    const m = moonPos(ecl.E); if (Math.hypot(px - m.x, py - m.y) < 22) return "moon";
    if (Math.abs(Math.hypot(px - geomE.ex, py - geomE.ey) - geomE.R) < 14) return "moon";
  }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const { px, py } = ptr(e), h = hitTest(px, py);
  if (!h) return;
  drag = h; canvas.dataset.dragging = "true";
  if (loop.running) loop.stop();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  onDrag(px, py);
});
function onDrag(px, py) {
  if (drag === "ball") { const w = toWorld(px, py); sh.d = Math.round(clamp(w.x, 10, Math.min(80, sh.L - 5))); sh.oy = Math.round(clamp(w.y, -18, 18) * 2) / 2; sDC.set(sh.d); }
  else if (drag === "screen") { const w = toWorld(px, py); sh.L = Math.round(clamp(w.x, sh.d + 5, 130)); sLC.set(sh.L); }
  else if (drag === "tree") { const w = toWorld(px, py); cam.d = Math.round(clamp(-w.x, 20, 200)); cDC.set(cam.d); }
  else if (drag === "moon") { setE(Math.round((((Math.atan2(geomE.ey - py, geomE.ex - px) / DEG) + 360) % 360) * 2) / 2); eEC.set(ecl.E); }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => {
  const { px, py } = ptr(e);
  if (!drag) { const h = hitTest(px, py); canvas.style.cursor = h ? (h === "screen" || h === "tree" ? "ew-resize" : "grab") : ""; return; }
  onDrag(px, py);
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  point: { mode: "shadow", title: "Nuqtaviy manba: keskin soya", lesson: "Manba nuqtaga yaqin — soya chegarasi keskin, yarim soya yo‘q. Ekranni surib, soya o‘lchamini kuzating.", set: () => Object.assign(sh, { a: 0, b: 10, d: 35, oy: 0, L: 100, two: false }) },
  big: { mode: "shadow", title: "Katta manba: soya va yarim soya", lesson: "Manba kattalashsa, to‘la soya atrofida yarim soya paydo bo‘ladi. Ekranning old ko‘rinishiga qarang.", set: () => Object.assign(sh, { a: 8, b: 12, d: 35, oy: 0, L: 100, two: false }), tab: "prof" },
  noUmbra: { mode: "shadow", title: "Manba shardan katta", lesson: "Manba shardan katta bo‘lsa, to‘la soya konus shaklida torayadi va uzoq ekranda faqat yarim soya qoladi. Ekranni sharga yaqinlashtiring.", set: () => Object.assign(sh, { a: 18, b: 8, d: 30, oy: 0, L: 110, two: false }), tab: "size" },
  two: { mode: "shadow", title: "Ikki lampa — ikki soya", lesson: "Har bir lampa o‘z soyasini beradi. Ikkala soya ustma-ust tushgan joy eng qorong‘i.", set: () => Object.assign(sh, { a: 2, b: 10, d: 40, oy: 0, L: 100, two: true, sp: 22 }) },
  camera: { mode: "camera", title: "Kamera-obskura", lesson: "Teshikdan o‘tgan nurlar qutining orqa devorida teskari tasvir hosil qiladi. Daraxtni yaqinlashtirib, tasvir kattalashishini kuzating.", set: () => Object.assign(cam, { d: 100, h: 40, f: 20, p: 1 }) },
  bigHole: { mode: "camera", title: "Katta teshik: xira tasvir", lesson: "Teshik katta — tasvir yorqin, lekin xira: buyumning har bir nuqtasi devorda katta dog‘ hosil qiladi.", set: () => Object.assign(cam, { d: 100, h: 40, f: 20, p: 4 }), tab: "blur" },
  sharp: { mode: "camera", title: "Eng aniq tasvir", lesson: "Teshik juda kichrayganda difraksiya xiralashtiradi. Eng aniq tasvir taxminan p ≈ √(2,44λf) da (bu yerda ≈ 0,5 mm).", set: () => Object.assign(cam, { d: 100, h: 40, f: 20, p: Math.round(L.optimalPinhole(1, 0.2) * 1000 / 0.05) * 0.05 }), tab: "blur" },
  solarTotal: { mode: "eclipse", title: "Quyosh to‘liq tutilishi", lesson: "Yangi oy tugun yonida, Oy yaqin (perigey) — Oy Quyoshni to‘liq yopadi, toj ko‘rinadi.", set: () => Object.assign(ecl, { E: 0, node: 0, D: 362000 }) },
  annular: { mode: "eclipse", title: "Halqasimon tutilish", lesson: "Oy uzoqda (apogey) — osmonda Quyoshdan kichikroq ko‘rinadi va uning chetida yorug‘ halqa qoladi.", set: () => Object.assign(ecl, { E: 0, node: 0, D: 404000 }) },
  lunar: { mode: "eclipse", title: "Oy tutilishi", lesson: "To‘lin oy tugun yonida — Oy Yer soyasiga kiradi va qizg‘ish tusga kiradi (Yer atmosferasida singan qizil nurlar).", set: () => Object.assign(ecl, { E: 180, node: 180, D: 384400 }) },
  noEcl: { mode: "eclipse", title: "Nega har oy tutilmaydi?", lesson: "Tugunlar chizig‘i Quyoshga perpendikulyar: yangi oyda Oy ekliptikadan 5° yuqorida, soyasi Yerga tushmaydi. Yon ko‘rinishga qarang.", set: () => Object.assign(ecl, { E: 0, node: 90, D: 384400 }), tab: "beta" },
  season: { mode: "eclipse", title: "Tutilish mavsumlari (animatsiya)", lesson: "«Boshlash» ni bosing: Oy aylanadi, tugunlar asta siljiydi. Tutilishlar yiliga ikki marta, tugun Quyosh yo‘nalishiga yaqinlashganda to‘planadi.", set: () => Object.assign(ecl, { E: 300, node: 40, D: 384400 }), tab: "year" },
};
const GROUPS = [["Soya va yarim soya", ["point", "big", "noUmbra", "two"]], ["Kamera-obskura", ["camera", "bigHole", "sharp"]], ["Tutilishlar", ["solarTotal", "annular", "lunar", "noEcl", "season"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  sAC.set(sh.a); sBC.set(sh.b); sDC.set(sh.d); sLC.set(sh.L); sSC.set(sh.sp); $("[data-two]").checked = sh.two; $("[data-two-ctl]").hidden = !sh.two;
  cDC.set(cam.d); cHC.set(cam.h); cFC.set(cam.f); cPC.set(cam.p);
  eEC.set(ecl.E); eNC.set(ecl.node); eMC.set(ecl.D);
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { shadow: "Sharni va ekranni suring", camera: "Daraxtni suring, teshikni o‘zgartiring", eclipse: "Oyni orbita bo‘ylab suring yoki «Boshlash»" };
function setMode(m) {
  if (m !== "eclipse" && loop.running) loop.stop();
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ shadow: "big", camera: "camera", eclipse: "solarTotal" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  if (loop.running) loop.stop();
  p.set(); resetClock(); setMode(p.mode);
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[ui.mode][0][0]);
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "big");
void prefersReducedMotion;
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
