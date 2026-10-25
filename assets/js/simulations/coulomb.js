// ==========================================================================
// Kulon qonuni va elektr maydon — virtual laboratoriya (simulations/coulomb-law.html)
// 1) Kulon qonuni: shtativga ipak ipda osilgan folga qoplangan po'kak sharcha va organik shisha stenddagi sharcha.
//    Stendni chizg'ich bo'ylab surish, transportirdan og'ish burchagini o'qish, F = mg·tg α ni grafikka yozish,
//    Kulon usuli bilan zaryadni teng bo'lish (neytral sharcha tegizish), tortishishda tegib zaryadlarning tenglashishi.
// 2) Superpozitsiya: moy quyilgan kyuvetadagi zaryadli elektrodlar, kuch chiziqlari, yorma donalari, sinov zaryadi q₀
//    va undagi E₁, E₂, … hamda natijaviy E vektorlari (bitta chiziqli masshtab, parallelogramm/ko'pburchak).
// 3) Zaryadlangan shar: Van de Graaf generatori sferasi (metall) yoki tekis zaryadlangan dielektrik shar, kesim,
//    izolyator dastali zond, havoning teshilishi va yerga ulangan sharchaga uchqun.
// Dunyo koordinatalari mm da (har rejimda o'z o'lchami). Fizika: coulomb-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, arrow, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { fieldLines } from "./inverse-square.js";
import * as P from "./coulomb-physics.js";
import { drawLaw, drawSphere, lastFrame } from "./coulomb-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180, MM = 1e-3, NC = P.NC;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px 'Times New Roman', serif";

/* ------------------------------------------------------------------ Holat */

const WORLD = { law: [340, 218], sup: [360, 212], sph: [480, 272] };
// 1) Osma sharcha: osilish nuqtasi, ip, sharcha radiusi (mm), chizg'ich noli
const PX = 150, PY = 12, LEN = 150, RB = 5, RULER0 = 60, TABLE = 204;
// 3) Shar: markaz, yerga ulangan sharcha
const CX = 150, CY = 130, DX = 432, DR = 14, STAND_TOP = 236, TABLE3 = 262;

const ui = { mode: "law", view: { law: "r", sph: "E" }, hover: null, show: { forces: true, lines: true, grains: false, parts: true, cut: true, names: false } };
const law = { q1: 7, q2: 7, D: 40, m: 0.05, a: 0, w: 0, pts: [], flash: 0, shared: 0, halveT: 0 };
const sup = { charges: [], sel: 0, probe: { x: 180, y: 60 }, med: "air" };
const sph = { Q: 400, R: 8, type: "shell", probe: { x: 300, y: 130 }, spark: 0, sparkSeed: 1, belt: 0, beltT: 0, rate: 0, sparks: 0 };
let presetId = null;
let running = false;
let CW = 800;

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0 };
function fit(w, h, pad = 6) {
  const [W, H] = WORLD[ui.mode], s = Math.min((w - 2 * pad) / W, (h - 2 * pad) / H);
  view.s = s; view.ox = (w - W * s) / 2; view.oy = (h - H * s) / 2;
}
const X = (x) => view.ox + x * view.s, Y = (y) => view.oy + y * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s, y: (py - view.oy) / view.s });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/* ------------------------------------------------------------------ Ranglar */

const POS = (c) => (c.dark ? "#f87171" : "#dc2626");
const NEG = (c) => (c.dark ? "#60a5fa" : "#2563eb");
const qCol = (c, q) => (q > 0 ? POS(c) : q < 0 ? NEG(c) : c.text3);
const PART = ["#0891b2", "#9333ea", "#16a34a", "#e11d48", "#ca8a04"];

function sym(ctx, c, x, y, sign, r = 5) {
  if (!sign) return;
  const col = sign > 0 ? POS(c) : NEG(c);
  ctx.fillStyle = c.bg; ctx.strokeStyle = col; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - r + 1.8, y); ctx.lineTo(x + r - 1.8, y);
  if (sign > 0) { ctx.moveTo(x, y - r + 1.8); ctx.lineTo(x, y + r - 1.8); }
  ctx.stroke();
}
/** Metall (folga) sharcha: ekran koordinatasida */
function metalBall(ctx, c, x, y, r, tint) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, c.dark ? "#f1f5f9" : "#ffffff"); g.addColorStop(0.55, c.dark ? "#94a3b8" : "#cbd5e1"); g.addColorStop(1, c.dark ? "#475569" : "#64748b");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (tint) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#475569"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}
function label(ctx, c, text, x, y, align = "left", color) {
  ctx.font = SMALL;
  const w = ctx.measureText(text).width + 8;
  const x0 = clamp(align === "center" ? x - w / 2 : align === "right" ? x - w : x, 2, CW - 2 - w);
  tag(ctx, text, x0, y, { color: color || c.text2, bg: c.bg2, font: SMALL, pad: 4 });
}
const qText = (q, d = 1) => `${q > 0 ? "+" : q < 0 ? "−" : ""}${fmt(Math.abs(q), Math.abs(q) % 1 ? d : 0)} nC`;

/* ================================================================== 1) Kulon qonuni */

/** Fizika moduli uchun SI qiymatlar (m slayderda grammda) */
const lawObj = () => ({ L: LEN * MM, D: law.D * MM, m: law.m * 1e-3, r: RB * MM, q1: law.q1 * NC, q2: law.q2 * NC, eps: P.MEDIA.air.eps });
const bob = () => ({ x: PX + LEN * Math.sin(law.a), y: PY + LEN * Math.cos(law.a) });
const fixed = () => ({ x: PX + law.D, y: PY + LEN });
const lawGap = () => P.gap(LEN * MM, law.D * MM, law.a);

/** Muvozanatga darhol o'tkazish (pauza yoki «kamroq harakat»). Tegsa — zaryad teng bo'linadi va qayta hisoblanadi. */
function settleLaw() {
  for (let k = 0; k < 3; k++) {
    const eq = P.equilibrium(lawObj());
    law.a = eq.a; law.w = 0;
    if (!eq.contact) return;
    if (!shareLaw()) return;
  }
}
/** Sharchalar tekkanda zaryadlar tenglashadi; o'zgargan bo'lsa true */
function shareLaw() {
  if (Math.abs(law.q1 - law.q2) < 1e-9) return false;
  const [a, b] = P.share(law.q1, law.q2);
  law.q1 = a; law.q2 = b; law.shared = 1.2;
  q1C.set(law.q1); q2C.set(law.q2); lawOut();
  return true;
}
function stepLaw(dt) {
  const o = lawObj(), L = o.L, m = o.m, aT = P.touchAngle(L, o.D, 2 * o.r);
  const n = Math.ceil(dt / 0.0008), h = dt / n;
  for (let i = 0; i < n; i++) {
    const bx = L * Math.sin(law.a), by = L * Math.cos(law.a), dx = bx - o.D, dy = by - L, d = Math.hypot(dx, dy);
    const F = P.coulomb(o.q1, o.q2, d, o.eps);
    const Ft = (F * (dx * Math.cos(law.a) - dy * Math.sin(law.a))) / d;
    const acc = (Ft - m * P.G * Math.sin(law.a)) / (m * L) - 2.2 * law.w;
    law.w += acc * h; law.a += law.w * h;
    if (law.a >= aT) {
      law.a = aT; law.w = -0.25 * Math.abs(law.w);
      if (shareLaw()) { o.q1 = law.q1 * NC; o.q2 = law.q2 * NC; }
    }
    law.a = clamp(law.a, -80 * DEG, 80 * DEG);
  }
}
const lawSettled = () => Math.abs(law.w) < 0.02;

function drawLawStage(ctx, c) {
  const s = view.s;
  // stol
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.14)"; ctx.fillRect(X(0), Y(TABLE), X(340) - X(0), 3 * s);
  // shtativ: asos, sterjen, mufta, lapka
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; ctx.beginPath(); ctx.roundRect(X(2), Y(TABLE - 7), 64 * s, 7 * s, 2 * s); ctx.fill();
  const steel = ctx.createLinearGradient(X(11), 0, X(17), 0); steel.addColorStop(0, c.dark ? "#64748b" : "#94a3b8"); steel.addColorStop(0.5, c.dark ? "#cbd5e1" : "#e2e8f0"); steel.addColorStop(1, c.dark ? "#475569" : "#64748b");
  ctx.fillStyle = steel; ctx.fillRect(X(11), Y(2), 6 * s, (TABLE - 9) * s);
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; ctx.beginPath(); ctx.roundRect(X(7), Y(3), 14 * s, 12 * s, 2 * s); ctx.fill();
  ctx.fillStyle = steel; ctx.fillRect(X(20), Y(6), (PX - 18) * s, 4 * s);
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; ctx.beginPath(); ctx.arc(X(PX), Y(PY - 2), 3 * s, 0, TAU); ctx.fill();

  // transportir (shaffof plastik), markazi osilish nuqtasida
  const pr = 58;
  ctx.save();
  ctx.fillStyle = c.dark ? "rgba(125,211,252,0.07)" : "rgba(14,165,233,0.06)"; ctx.strokeStyle = c.dark ? "rgba(125,211,252,0.45)" : "rgba(14,165,233,0.55)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(PX - pr), Y(PY)); ctx.arc(X(PX), Y(PY), pr * s, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let d = -60; d <= 60; d++) {
    const t = Math.PI / 2 - d * DEG, l = d % 10 === 0 ? 7 : d % 5 === 0 ? 4.5 : 2.5;
    if (s < 1.4 && d % 5 !== 0) continue;
    ctx.lineWidth = d % 10 === 0 ? 1 : 0.6;
    ctx.beginPath(); ctx.moveTo(X(PX + Math.cos(t) * pr), Y(PY + Math.sin(t) * pr)); ctx.lineTo(X(PX + Math.cos(t) * (pr - l)), Y(PY + Math.sin(t) * (pr - l))); ctx.stroke();
    if (d % 20 === 0 && d) ctx.fillText(String(Math.abs(d)), X(PX + Math.cos(t) * (pr - 13)), Y(PY + Math.sin(t) * (pr - 13)));
  }
  ctx.restore();

  // chizg'ich (yog'och, mm bo'linmalar)
  const r0 = RULER0, r1 = 336, ry = TABLE + 2;
  ctx.fillStyle = c.dark ? "#a16207" : "#facc15"; ctx.globalAlpha = c.dark ? 0.55 : 0.75; ctx.fillRect(X(r0 - 4), Y(ry), (r1 - r0 + 6) * s, 12 * s); ctx.globalAlpha = 1;
  ctx.strokeStyle = c.dark ? "#fde68a" : "#713f12"; ctx.fillStyle = ctx.strokeStyle; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let mm = 0; mm <= r1 - r0; mm += 1) {
    if (s < 1.6 && mm % 5) continue;
    const l = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3.5 : 2;
    ctx.lineWidth = mm % 10 === 0 ? 1 : 0.6;
    ctx.beginPath(); ctx.moveTo(X(r0 + mm) + 0.5, Y(ry)); ctx.lineTo(X(r0 + mm) + 0.5, Y(ry + l)); ctx.stroke();
    if (mm % 20 === 0 || (s > 2 && mm % 10 === 0)) ctx.fillText(String(mm / 10), X(r0 + mm), Y(ry + 5.5));
  }

  // stenddagi sharcha: organik shisha sterjen va asos (sudrab suriladi)
  const f = fixed();
  ctx.fillStyle = c.dark ? "rgba(186,230,253,0.28)" : "rgba(125,211,252,0.45)"; ctx.strokeStyle = c.dark ? "#7dd3fc" : "#0284c7"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(X(f.x - 2), Y(f.y + RB - 1), 4 * s, (TABLE - 8 - f.y - RB + 1) * s, 1.5 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; ctx.beginPath(); ctx.roundRect(X(f.x - 16), Y(TABLE - 8), 32 * s, 8 * s, 3 * s); ctx.fill();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.moveTo(X(f.x), Y(TABLE + 1)); ctx.lineTo(X(f.x - 2.5), Y(TABLE - 2)); ctx.lineTo(X(f.x + 2.5), Y(TABLE - 2)); ctx.closePath(); ctx.fill(); // ko'rsatkich
  // osma sharcha: ip va sharcha
  const b = bob();
  ctx.strokeStyle = c.dark ? "#e2e8f0" : "#334155"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(PX), Y(PY - 2)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
  ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = c.text3; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(X(PX), Y(PY)); ctx.lineTo(X(PX), Y(PY + LEN + RB + 6)); ctx.stroke(); ctx.restore();
  metalBall(ctx, c, X(f.x), Y(f.y), RB * s, law.q2 ? qCol(c, law.q2) : null);
  metalBall(ctx, c, X(b.x), Y(b.y), RB * s, law.q1 ? qCol(c, law.q1) : null);
  // ishora belgilari
  const rs = Math.max(4, RB * s * 0.62);
  sym(ctx, c, X(b.x), Y(b.y), Math.sign(law.q1), rs);
  sym(ctx, c, X(f.x), Y(f.y), Math.sign(law.q2), rs);
  // Kulon usuli: neytral sharcha tegiziladi
  if (law.halveT > 0) {
    const k = Math.sin(Math.min(1, law.halveT / 1.2) * Math.PI), hx = f.x + 2 * RB + 30 * (1 - k), hy = f.y - 2;
    ctx.strokeStyle = c.dark ? "#1e293b" : "#0f172a"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(hx + RB), Y(hy - 1)); ctx.lineTo(X(hx + 40), Y(hy - 34)); ctx.stroke();
    metalBall(ctx, c, X(hx), Y(hy), RB * s, law.q2 ? qCol(c, law.q2) : null);
  }
  // burchak yoyi
  if (Math.abs(law.a) > 0.4 * DEG) {
    ctx.strokeStyle = c.warning; ctx.lineWidth = 1.6; ctx.beginPath();
    const a0 = Math.PI / 2, a1 = Math.PI / 2 - law.a;
    ctx.arc(X(PX), Y(PY), 34 * s, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
  }
  // kuchlar
  if (ui.show.forces && (law.q1 || law.q2)) {
    const o = lawObj(), d = lawGap(), F = P.coulomb(o.q1, o.q2, d), mg = o.m * P.G, k = 55 / mg; // 55 mm = mg
    const ux = (b.x - f.x) / dist(b.x, b.y, f.x, f.y), uy = (b.y - f.y) / dist(b.x, b.y, f.x, f.y);
    const T = { x: -(F * ux), y: -(F * uy) - mg }; // ip tarangligi muvozanatda: −(F + mg)
    const Lc = (v) => clamp(v * k, -110, 110);
    const ops = { width: 3, head: 10, font: LBL };
    arrow(ctx, X(b.x), Y(b.y), 0, Lc(mg) * s, c.success, { ...ops, label: "mg" });
    if (lawSettled()) arrow(ctx, X(b.x), Y(b.y), Lc(T.x) * s, Lc(T.y) * s, c.text2, { ...ops, label: "T" });
    if (Math.abs(F) > 1e-9) arrow(ctx, X(b.x), Y(b.y), Lc(F * ux) * s, Lc(F * uy) * s, c.warning, { ...ops, label: "F" });
  }
  // yorliqlar
  ctx.font = MID;
  tag(ctx, `q₁ = ${qText(law.q1)}`, X(b.x) + (law.a < 0 ? -14 : -14), Y(b.y) + RB * s + 18, { color: qCol(c, law.q1), bg: c.bg, align: "right", font: MID });
  tag(ctx, `q₂ = ${qText(law.q2)}`, X(f.x) + 12, Y(f.y) - RB * s - 16, { color: qCol(c, law.q2), bg: c.bg, align: "left", font: MID });
  tag(ctx, `α = ${fmt(Math.abs(law.a) / DEG, 1)}°`, X(PX) + 10, Y(PY + 44), { color: c.warning, bg: c.bg, font: MID });
  if (law.shared > 0) label(ctx, c, "Tegdi: zaryadlar teng bo‘lindi", X((b.x + f.x) / 2), Y(f.y) - 34, "center", c.danger);
  if (ui.show.names) {
    label(ctx, c, "shtativ", X(24), Y(110));
    label(ctx, c, "ipak ip", X(PX + 6), Y(PY + 96));
    label(ctx, c, "transportir", X(PX - 52), Y(PY + 24), "right");
    label(ctx, c, "organik shisha stend", X(f.x + 6), Y(f.y + 22));
    label(ctx, c, "chizg‘ich, cm", X(RULER0), Y(TABLE + 22));
  }
}

/* ================================================================== 2) Superpozitsiya */

const TRAY = { x0: 6, y0: 6, x1: 354, y1: 206 };
const RC = 7, RP = 3.5, Q0 = 1; // elektrod radiusi, zond radiusi (mm), sinov zaryadi (nC)
const eps2 = () => P.MEDIA[sup.med].eps;
const chargesSI = () => sup.charges.map((q) => ({ x: q.x * MM, y: q.y * MM, q: q.q * NC }));
const fieldAt = (x, y) => P.field(chargesSI(), x * MM, y * MM, eps2());
let lineCache = { key: "", lines: [] };
let grainCache = { key: "", g: [] };
const GRAINS = (() => { let a = 7; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; return Array.from({ length: 850 }, () => ({ x: TRAY.x0 + 4 + r() * (TRAY.x1 - TRAY.x0 - 8), y: TRAY.y0 + 4 + r() * (TRAY.y1 - TRAY.y0 - 8), n: r() - 0.5, l: 0.7 + r() * 0.6 })); })();

function drawSupStage(ctx, c, stg) {
  const s = view.s;
  // kyuveta (shisha), moy
  const med = P.MEDIA[sup.med];
  ctx.fillStyle = sup.med === "air" ? (c.dark ? "rgba(148,163,184,0.05)" : "rgba(148,163,184,0.06)") : c.dark ? "rgba(250,204,21,0.10)" : "rgba(250,204,21,0.16)";
  ctx.strokeStyle = c.dark ? "rgba(186,230,253,0.5)" : "rgba(2,132,199,0.55)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(X(TRAY.x0), Y(TRAY.y0), (TRAY.x1 - TRAY.x0) * s, (TRAY.y1 - TRAY.y0) * s, 8 * s); ctx.fill(); ctx.stroke();
  // 1 cm to'r (kyuveta tubidagi millimetrli qog'oz)
  ctx.save(); ctx.beginPath(); ctx.roundRect(X(TRAY.x0), Y(TRAY.y0), (TRAY.x1 - TRAY.x0) * s, (TRAY.y1 - TRAY.y0) * s, 8 * s); ctx.clip();
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 10; x < TRAY.x1; x += 10) { ctx.moveTo(Math.round(X(x)) + 0.5, Y(TRAY.y0)); ctx.lineTo(Math.round(X(x)) + 0.5, Y(TRAY.y1)); }
  for (let y = 10; y < TRAY.y1; y += 10) { ctx.moveTo(X(TRAY.x0), Math.round(Y(y)) + 0.5); ctx.lineTo(X(TRAY.x1), Math.round(Y(y)) + 0.5); }
  ctx.stroke();

  const charges = sup.charges;
  // yorma donalari: maydon bo'ylab tiziladi; kuchsiz maydonda tartibsiz qoladi
  if (ui.show.grains && charges.some((q) => q.q)) {
    const key = JSON.stringify(charges) + sup.med;
    if (key !== grainCache.key) {
      const ref = Math.max(...charges.map((q) => Math.abs(q.q))) * NC;
      const Eref = (P.K * ref) / (eps2() * 0.3 * 0.3); // 30 cm dagi maydon — "kuchsiz" chegarasi
      grainCache = { key, g: GRAINS.map((g) => { const f = fieldAt(g.x, g.y), k = clamp(Math.log10(Math.max(f.e, 1e-9) / Eref) / 1.3 + 0.5, 0, 1); return { ...g, a: Math.atan2(f.ey, f.ex) + g.n * (1 - k) * 0.7 * Math.PI, k }; }) };
    }
    ctx.strokeStyle = c.dark ? "#e7d3a1" : "#a16207"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(1.2, 1.1 * s);
    for (const g of grainCache.g) {
      if (charges.some((q) => dist(q.x, q.y, g.x, g.y) < RC + 1.5)) continue;
      const L = 2.1 * g.l; ctx.globalAlpha = 0.45 + 0.5 * g.k;
      ctx.beginPath(); ctx.moveTo(X(g.x - Math.cos(g.a) * L), Y(g.y - Math.sin(g.a) * L)); ctx.lineTo(X(g.x + Math.cos(g.a) * L), Y(g.y + Math.sin(g.a) * L)); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = "butt";
  }
  // kuch chiziqlari
  if (ui.show.lines && charges.some((q) => q.q)) {
    const key = JSON.stringify(charges);
    if (key !== lineCache.key) lineCache = { key, lines: fieldLines(charges.map((q) => ({ x: q.x, y: q.y, q: q.q, r: RC })), TRAY, { minLines: 6, perUnit: 1.4, step: 1.6, maxSteps: 900 }) };
    ctx.strokeStyle = c.text2; ctx.globalAlpha = c.dark ? 0.55 : 0.5; ctx.lineWidth = 1.2;
    for (const ln of lineCache.lines) { ctx.beginPath(); ln.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); }
    ctx.fillStyle = c.text2; ctx.globalAlpha = c.dark ? 0.8 : 0.7;
    for (const ln of lineCache.lines) {
      const i = Math.min(ln.pts.length - 2, 30); if (i < 3) continue;
      const [ax, ay] = ln.pts[i], [bx, by] = ln.pts[i + 1];
      if (ax < TRAY.x0 || ax > TRAY.x1 || ay < TRAY.y0 || ay > TRAY.y1) continue;
      const ang = Math.atan2(by - ay, bx - ax) + (ln.dir < 0 ? Math.PI : 0);
      ctx.save(); ctx.translate(X(ax), Y(ay)); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -3.6); ctx.lineTo(-4, 3.6); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (med.eps > 1) tag(ctx, `${med.name}: ε = ${fmt(med.eps, med.eps % 1 ? 1 : 0)}`, X(TRAY.x0) + 10, Y(TRAY.y0) + 16, { color: c.text2, bg: c.bg, font: MID });

  // elektrodlar
  charges.forEach((q, i) => {
    const x = X(q.x), y = Y(q.y), r = RC * s;
    if (i === sup.sel) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    metalBall(ctx, c, x, y, r, qCol(c, q.q));
    sym(ctx, c, x, y, Math.sign(q.q), Math.max(4, r * 0.6));
    tag(ctx, `q${"₁₂₃₄₅"[i]} = ${qText(q.q)}`, x, y - r - 14, { color: qCol(c, q.q), bg: c.bg, align: "center", font: MID });
  });

  // sinov zaryadi va vektorlar
  const p = sup.probe, f = fieldAt(p.x, p.y);
  if (charges.length && f.e > 0) {
    const parts = f.parts.map((q, i) => ({ ...q, i })).filter((q) => q.e > 0);
    const maxE = Math.max(f.e, ...parts.map((q) => q.e));
    const k = (Math.min(stg.w, stg.h) * 0.24) / maxE; // px / (N/C)
    const px = X(p.x), py = Y(p.y);
    const ops = { width: 2.2, head: 9, font: "italic 700 13px 'Times New Roman', serif" };
    if (ui.show.parts && parts.length > 1) {
      // qismlar va ularni uchma-uch qo'yish (ko'pburchak qoidasi) — shtrix
      let cx = px, cy = py;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
      parts.forEach((q) => { const nx = cx + q.ex * k, ny = cy + q.ey * k; if (cx !== px || cy !== py) { ctx.strokeStyle = PART[q.i % PART.length]; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke(); } cx = nx; cy = ny; });
      ctx.restore();
      parts.forEach((q) => arrow(ctx, px, py, q.ex * k, q.ey * k, PART[q.i % PART.length], { ...ops, width: 1.8, head: 8, label: `E${"₁₂₃₄₅"[q.i]}` }));
    }
    arrow(ctx, px, py, f.ex * k, f.ey * k, c.warning, { ...ops, width: 3.2, head: 12, label: "E" });
  }
  // zond (sinov zaryadi q₀ izolyator dastada)
  const pxs = X(p.x), pys = Y(p.y);
  ctx.fillStyle = c.dark ? "#facc15" : "#eab308"; ctx.strokeStyle = c.dark ? "#fde68a" : "#854d0e"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(pxs, pys, Math.max(4, RP * s), 0, TAU); ctx.fill(); ctx.stroke();
  sym(ctx, c, pxs, pys, 1, Math.max(3, RP * s * 0.62));
  tag(ctx, "q₀", pxs + Math.max(4, RP * s) + 4, pys + 14, { color: c.text2, bg: c.bg, font: MID });
}

/* ================================================================== 3) Zaryadlangan shar */

const sphQ = () => sph.Q * NC, sphR = () => sph.R / 100;
const sphProbeR = () => dist(sph.probe.x, sph.probe.y, CX, CY) * MM;
const Qmax = () => P.maxCharge(sphR()) / NC;
const SEED = (n) => { let a = n; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };

function drawSphStage(ctx, c, stg) {
  const s = view.s, R = sph.R * 10, Q = sph.Q;
  // stol
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.14)"; ctx.fillRect(X(0), Y(TABLE3), X(480) - X(0), 3 * s);
  // kuch chiziqlari (radial)
  if (ui.show.lines && Q) {
    const n = Math.round(clamp(8 + 16 * Math.abs(Q) / 3000, 8, 24)), sign = Math.sign(Q);
    ctx.save(); ctx.strokeStyle = c.text2; ctx.fillStyle = c.text2; ctx.globalAlpha = c.dark ? 0.5 : 0.45; ctx.lineWidth = 1.2;
    for (let i = 0; i < n; i++) {
      const a = (TAU * (i + 0.5)) / n, r0 = R + 2, r1 = 420;
      ctx.beginPath(); ctx.moveTo(X(CX + Math.cos(a) * r0), Y(CY + Math.sin(a) * r0)); ctx.lineTo(X(CX + Math.cos(a) * r1), Y(CY + Math.sin(a) * r1)); ctx.stroke();
      const am = R + 26; ctx.save(); ctx.translate(X(CX + Math.cos(a) * am), Y(CY + Math.sin(a) * am)); ctx.rotate(a + (sign < 0 ? Math.PI : 0)); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -3.5); ctx.lineTo(-4, 3.5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  // izolyator kolonna (shaffof, ichida tasma) va generator asosi
  const colTop = CY + R - 4;
  ctx.fillStyle = c.dark ? "rgba(186,230,253,0.16)" : "rgba(125,211,252,0.28)"; ctx.strokeStyle = c.dark ? "#7dd3fc" : "#0284c7"; ctx.lineWidth = 1;
  if (STAND_TOP > colTop) { ctx.beginPath(); ctx.roundRect(X(CX - 13), Y(colTop), 26 * s, (STAND_TOP - colTop) * s, 3 * s); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = c.dark ? "#a8a29e" : "#78716c"; ctx.lineWidth = Math.max(1.5, 2 * s); ctx.setLineDash([6 * s, 4 * s]); ctx.lineDashOffset = -sph.belt * s;
  if (STAND_TOP > colTop) { ctx.beginPath(); ctx.moveTo(X(CX - 6), Y(colTop)); ctx.lineTo(X(CX - 6), Y(STAND_TOP)); ctx.moveTo(X(CX + 6), Y(colTop)); ctx.lineTo(X(CX + 6), Y(STAND_TOP)); ctx.stroke(); }
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; ctx.beginPath(); ctx.roundRect(X(CX - 52), Y(STAND_TOP), 104 * s, (TABLE3 - STAND_TOP) * s, 4 * s); ctx.fill();
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; ctx.beginPath(); ctx.arc(X(CX + 34), Y(STAND_TOP + 13), 6 * s, 0, TAU); ctx.fill();
  // shar
  if (sph.type === "shell") {
    const g = ctx.createRadialGradient(X(CX - R * 0.4), Y(CY - R * 0.45), R * s * 0.1, X(CX), Y(CY), R * s);
    g.addColorStop(0, c.dark ? "#f1f5f9" : "#ffffff"); g.addColorStop(0.6, c.dark ? "#94a3b8" : "#cbd5e1"); g.addColorStop(1, c.dark ? "#475569" : "#64748b");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(CX), Y(CY), R * s, 0, TAU); ctx.fill();
    if (ui.show.cut) { // old yarmi kesilgan: ichi bo'sh
      ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(X(CX), Y(CY), (R - 2.2) * s, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.12)"; ctx.fill();
      ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(CX), Y(CY - R)); ctx.lineTo(X(CX), Y(CY + R)); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, "E = 0", X(CX + R * 0.5), Y(CY), { color: c.success, bg: c.bg, align: "center", font: MID });
    }
    ctx.strokeStyle = c.dark ? "#cbd5e1" : "#475569"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X(CX), Y(CY), R * s, 0, TAU); ctx.stroke();
  } else {
    // dielektrik (masalan, oltingugurt yoki ebonit) shar — hajmda tekis zaryad
    const g = ctx.createRadialGradient(X(CX - R * 0.4), Y(CY - R * 0.45), R * s * 0.1, X(CX), Y(CY), R * s);
    g.addColorStop(0, c.dark ? "#fef9c3" : "#fefce8"); g.addColorStop(1, c.dark ? "#a16207" : "#facc15");
    ctx.fillStyle = g; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(X(CX), Y(CY), R * s, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = c.dark ? "#fde68a" : "#a16207"; ctx.lineWidth = 1.2; ctx.stroke();
    if (ui.show.cut && ui.show.lines && Q) { // ichida E ∝ r: markazdan chiqqan qisqa radial chiziqlar
      ctx.save(); ctx.strokeStyle = c.text2; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      const n = Math.round(clamp(8 + 16 * Math.abs(Q) / 3000, 8, 24));
      for (let i = 0; i < n; i++) { const a = (TAU * (i + 0.5)) / n; ctx.beginPath(); ctx.moveTo(X(CX + Math.cos(a) * R * 0.15), Y(CY + Math.sin(a) * R * 0.15)); ctx.lineTo(X(CX + Math.cos(a) * R), Y(CY + Math.sin(a) * R)); ctx.stroke(); }
      ctx.restore();
    }
  }
  // zaryad belgilari
  if (Q) {
    const n = Math.round(clamp(Math.abs(Q) / 3000 * 26, 3, 26)), sg = Math.sign(Q), rs = Math.max(3.5, 4.2 * s * 0.8);
    if (sph.type === "shell") for (let i = 0; i < n; i++) { const a = (TAU * i) / n - Math.PI / 2; sym(ctx, c, X(CX + Math.cos(a) * (R - 4)), Y(CY + Math.sin(a) * (R - 4)), sg, rs); }
    else { const r = SEED(11); for (let i = 0; i < n; i++) { const rr = Math.sqrt(r()) * (R - 6), a = r() * TAU; sym(ctx, c, X(CX + Math.cos(a) * rr), Y(CY + Math.sin(a) * rr), sg, rs); } }
  }
  // yerga ulangan razryadlovchi sharcha
  ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(DX), Y(CY + DR)); ctx.lineTo(X(DX), Y(TABLE3 - 10)); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.beginPath(); [[12, 0], [8, 4], [4, 8]].forEach(([hw, dy]) => { ctx.moveTo(X(DX - hw), Y(TABLE3 - 10 + dy)); ctx.lineTo(X(DX + hw), Y(TABLE3 - 10 + dy)); }); ctx.stroke();
  metalBall(ctx, c, X(DX), Y(CY), DR * s);
  // uchqun
  if (sph.spark > 0) {
    const r = SEED(sph.sparkSeed), x0 = CX + R, x1 = DX - DR, segs = 9;
    ctx.save(); ctx.strokeStyle = c.dark ? "#e0e7ff" : "#6366f1"; ctx.shadowColor = "#a5b4fc"; ctx.shadowBlur = 12; ctx.lineWidth = 2.2; ctx.globalAlpha = clamp(sph.spark / 0.4, 0, 1);
    ctx.beginPath(); ctx.moveTo(X(x0), Y(CY));
    for (let i = 1; i < segs; i++) ctx.lineTo(X(x0 + ((x1 - x0) * i) / segs), Y(CY + (r() - 0.5) * 22));
    ctx.lineTo(X(x1), Y(CY)); ctx.stroke(); ctx.restore();
  }
  // zond: izolyator dasta va sharcha
  const p = sph.probe, pr = 4;
  ctx.strokeStyle = c.dark ? "#64748b" : "#1f2937"; ctx.lineWidth = Math.max(2.5, 3.2 * s); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(X(p.x + pr * 0.7), Y(p.y - pr * 0.7)); ctx.lineTo(X(p.x + 70), Y(p.y - 70)); ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = c.dark ? "rgba(253,186,116,0.55)" : "rgba(251,146,60,0.5)"; ctx.beginPath(); ctx.roundRect(X(p.x + 58), Y(p.y - 82), 22 * s, 22 * s, 6 * s); ctx.fill();
  metalBall(ctx, c, X(p.x), Y(p.y), Math.max(4, pr * s), c.dark ? "#facc15" : "#eab308");
  // zondda E vektori
  const rr = sphProbeR(), E = P.sphereE(sphQ(), sphR(), rr, sph.type);
  if (Math.abs(E) > 0 && rr > 1e-4) {
    const Es = P.sphereE(sphQ(), sphR(), sphR(), sph.type), Lp = (Math.min(stg.w, stg.h) * 0.22) * clamp(Math.sqrt(Math.abs(E / Es)), 0.12, 1);
    const ux = (p.x - CX) / (rr / MM), uy = (p.y - CY) / (rr / MM);
    arrow(ctx, X(p.x), Y(p.y), Math.sign(E) * ux * Lp, Math.sign(E) * uy * Lp, c.warning, { width: 3, head: 11, label: "E", font: LBL });
  }
  // radius yorlig'i
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(CX), Y(CY)); ctx.lineTo(X(CX - R * 0.7071), Y(CY - R * 0.7071)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(X(CX), Y(CY), 2, 0, TAU); ctx.fill();
  tag(ctx, `R = ${fmt(sph.R, 1)} cm`, X(CX - R * 0.36) - 8, Y(CY - R * 0.36) - 12, { color: c.text, bg: c.bg, align: "right", font: MID });
  tag(ctx, `Q = ${qText(Q, 0)}`, X(CX), Math.max(12, Y(CY - R) - 14), { color: qCol(c, Q), bg: c.bg, align: "center", font: MID });
}

/* ------------------------------------------------------------------ Sahna */

function draw(ctx, stg) {
  CW = stg.w;
  const c = stg.colors;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, stg.w, stg.h);
  fit(stg.w, stg.h);
  if (ui.mode === "law") drawLawStage(ctx, c);
  else if (ui.mode === "sup") drawSupStage(ctx, c, stg);
  else drawSphStage(ctx, c, stg);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return Math.round(clamp(Math.min(cw * 0.62, vh * 0.46), 240, 340)); } });

/* ------------------------------------------------------------------ Grafik */

function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "law") {
    const o = lawObj(), d = lawGap();
    return drawLaw(ctx, gs, { view: ui.view.law, q1: o.q1, q2: o.q2, r: d, F: P.measuredForce(o.m, law.a), pts: law.pts, hover: ui.hover });
  }
  if (ui.mode === "sph") return drawSphere(ctx, gs, { view: ui.view.sph, Q: sphQ(), R: sphR(), type: sph.type, r: sphProbeR(), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  law: [["r", "F(r)", "Kuchning masofaga bog‘liqligi F(r)", "Ko‘k — Kulon qonuni hozirgi zaryadlar uchun, yashil nuqtalar — siz yozgan o‘lchashlar (F = mg·tg α). Kulrang — boshqa zaryadlarda yozilgan nuqtalar."],
    ["inv", "F(1/r²)", "Kuch 1/r² ga proporsional", "Agar F ∝ 1/r² bo‘lsa, nuqtalar koordinata boshidan o‘tuvchi to‘g‘ri chiziqda yotadi. Shtrix — o‘lchashlar bo‘yicha eng kichik kvadratlar to‘g‘ri chizig‘i."]],
  sph: [["E", "E(r)", "Maydon kuchlanganligi E(r)", "Kulrang soha — shar ichi. Metall shar ichida maydon yo‘q, sirtda sakrab kQ/R² ga yetadi; tashqarida ikkala shar ham nuqtaviy zaryaddek: E = kQ/r²."],
    ["phi", "φ(r)", "Potensial φ(r)", "Metall shar ichida potensial o‘zgarmas va sirtdagiga teng (kQ/R). Potensial uzluksiz, maydon esa — uning qiyaligi."]],
};
function setTabs() {
  const box = $("[data-tabs]"), card = $("[data-graph-card]");
  card.hidden = ui.mode === "sup";
  if (card.hidden) return;
  const tabs = TABS[ui.mode], cur = ui.view[ui.mode], t = tabs.find((x) => x[0] === cur);
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === cur}">${name}</button>`).join("");
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[ui.mode] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
/** Maydon kuchlanganligi: N/C → mos birlik */
const fE = (e, unit = "N/C") => { const a = Math.abs(e); return a >= 1e6 ? u(fmt(e / 1e6, 2), unit === "N/C" ? "MN/C" : "MV/m") : a >= 1e3 ? u(fmt(e / 1e3, a >= 1e5 ? 0 : 1), unit === "N/C" ? "kN/C" : "kV/m") : u(fmt(e, 0), unit); };
const fV = (v) => { const a = Math.abs(v); return a >= 1e6 ? u(fmt(v / 1e6, 2), "MV") : a >= 1e3 ? u(fmt(v / 1e3, a >= 1e5 ? 0 : 1), "kV") : u(fmt(v, 0), "V"); };

function updateReadouts() {
  if (ui.mode === "law") {
    const o = lawObj(), d = lawGap(), Fk = Math.abs(P.coulomb(o.q1, o.q2, d)), Fm = P.measuredForce(o.m, law.a);
    const kind = !law.q1 || !law.q2 ? "ta’sir yo‘q" : law.q1 * law.q2 > 0 ? "itarilish" : "tortishish";
    setRO("r1", "Osma sharcha <i>q</i>₁", u(fmt(law.q1, 1), "nC"), `${P.maxCharge(RB * MM) / NC > Math.abs(law.q1) ? "folga qoplangan po‘kak, r = 5 mm" : "havo teshilish chegarasida"}`);
    setRO("r2", "Stenddagi sharcha <i>q</i>₂", u(fmt(law.q2, 1), "nC"), kind, kind === "itarilish" ? "orange" : kind === "tortishish" ? "blue" : "");
    setRO("r3", "Markazlar orasidagi masofa <i>r</i>", u(fmt(d * 100, 2), "cm"), `stend D = ${fmt(law.D / 10, 1)} cm; osma sharcha ${fmt(Math.abs(LEN * Math.sin(law.a)) / 10, 2)} cm ga og‘di`);
    setRO("r4", "Og‘ish burchagi <i>α</i>", u(fmt(Math.abs(law.a) / DEG, 1), "°"), lawSettled() ? "transportirdan" : "tebranmoqda — to‘xtashini kuting", lawSettled() ? "" : "purple");
    setRO("r5", "O‘lchangan kuch <i>F</i> = <i>mg</i>·tg <i>α</i>", u(fmt(Fm * 1000, 3), "mN"), `m = ${fmt(law.m, 2)} g, mg = ${fmt(o.m * P.G * 1000, 2)} mN`, "orange");
    const err = Fk > 0 ? ((Fm - Fk) / Fk) * 100 : 0;
    setRO("r6", "Kulon qonuni <i>F</i> = <i>k</i>|<i>q</i>₁<i>q</i>₂|/<i>r</i>²", u(fmt(Fk * 1000, 3), "mN"), Fk > 0 && lawSettled() ? `farq ${fmt(err, 1)} % — kuch ip bo‘ylab to‘liq gorizontal emas` : "N = 9·10⁹·|q₁q₂|/r²", "green");
  } else if (ui.mode === "sup") {
    const p = sup.probe, f = fieldAt(p.x, p.y), th = Math.atan2(-f.ey, f.ex) / DEG, phi = P.potentialAt(chargesSI(), p.x * MM, p.y * MM, eps2());
    setRO("r1", "Natijaviy maydon <i>E</i>", fE(f.e), f.e < 1 ? "bu nuqtada maydonlar bir-birini yo‘qotadi" : `${f.parts.length} ta zaryad maydonining vektor yig‘indisi`, "orange");
    setRO("r2", "Yo‘nalishi <i>θ</i> (Ox dan)", f.e < 1 ? "—" : u(fmt((th + 360) % 360, 0), "°"), "soat strelkasiga teskari");
    setRO("r3", "<i>E<sub>x</sub></i> = Σ <i>E<sub>ix</sub></i>", fE(f.ex), f.parts.map((q, i) => `E${"₁₂₃₄₅"[i]}x = ${sci(q.ex, 2)}`).join(", "));
    setRO("r4", "<i>E<sub>y</sub></i> = Σ <i>E<sub>iy</sub></i>", fE(-f.ey), "y o‘qi yuqoriga");
    setRO("r5", "Sinov zaryadiga kuch <i>F</i> = <i>q</i>₀<i>E</i>", u(fmt(Q0 * NC * f.e * 1e6, 1), "μN"), `q₀ = +${Q0} nC, F ∥ E`);
    setRO("r6", "Potensial <i>φ</i> = Σ <i>kq<sub>i</sub></i>/(<i>εr<sub>i</sub></i>)", fV(phi), "skalyar — oddiy yig‘iladi");
  } else {
    const Q = sphQ(), R = sphR(), r = sphProbeR(), E = P.sphereE(Q, R, r, sph.type), phi = P.spherePhi(Q, R, r, sph.type), Es = Math.abs(P.sphereE(Q, R, R)), pct = (Es / P.E_BD) * 100;
    setRO("r1", "Shar zaryadi <i>Q</i>", u(fmt(Math.round(sph.Q), 0), "nC"), `σ = ${sci(P.surfaceDensity(Q, R) * 1e6, 3)} μC/m²${sph.sparks ? ` · uchqunlar: ${sph.sparks}` : ""}`);
    setRO("r2", "Shar radiusi <i>R</i>", u(fmt(sph.R, 1), "cm"), `sig‘im C = 4πε₀R = ${fmt(P.capacitance(R) * 1e12, 1)} pF`);
    setRO("r3", "Zondgacha masofa <i>r</i>", u(fmt(r * 100, 1), "cm"), r < R ? "shar ichida" : "shar tashqarisida", r < R ? "purple" : "");
    setRO("r4", "Zondda maydon <i>E</i>", fE(Math.abs(E), "V/m"), r < R ? (sph.type === "shell" ? "o‘tkazgich ichida E = 0" : "E = kQr/R³ — markazga qarab kamayadi") : "E = kQ/r²", "orange");
    setRO("r5", "Zondda potensial <i>φ</i>", fV(phi), r < R && sph.type === "shell" ? "ichida φ = kQ/R — o‘zgarmas" : r < R ? "φ = kQ(3R² − r²)/(2R³)" : "φ = kQ/r");
    setRO("r6", "Sirtdagi maydon <i>E</i><sub>sirt</sub>", fE(Es, "V/m"), `havo teshilishining ${fmt(pct, 0)} % i (3 MV/m); Q_max = ${fmt(Qmax(), 0)} nC`, pct >= 90 ? "red" : pct >= 60 ? "orange" : "green");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "law") {
    if (law.shared > 0) { t = "Sharchalar tegdi — zaryad bo‘lindi"; tone = "orange"; }
    else if (!law.q1 || !law.q2) { t = "Zaryadsiz — og‘ish yo‘q"; tone = ""; }
    else if (!lawSettled()) { t = "Sharcha tebranmoqda"; tone = "purple"; }
    else { t = law.q1 * law.q2 > 0 ? "Itarilish: muvozanat" : "Tortishish: muvozanat"; tone = law.q1 * law.q2 > 0 ? "orange" : "blue"; }
  } else if (ui.mode === "sup") {
    const f = fieldAt(sup.probe.x, sup.probe.y); t = `E = ${sci(f.e, 3)} N/C`; tone = "orange";
  } else {
    if (sph.spark > 0) { t = "Uchqun! Havo teshildi"; tone = "red"; }
    else if (!sph.Q) { t = "Shar zaryadsiz"; tone = ""; }
    else { const pct = Math.abs(P.sphereE(sphQ(), sphR(), sphR())) / P.E_BD; t = pct > 0.9 ? "Teshilishga yaqin" : sphProbeR() < sphR() ? "Zond shar ichida" : "Zond shar tashqarisida"; tone = pct > 0.9 ? "red" : "blue"; }
  }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "law") {
    const o = lawObj(), d = lawGap(), Fk = Math.abs(P.coulomb(o.q1, o.q2, d));
    if (!law.q1 || !law.q2) p.push("<p>Sharchalardan biri zaryadsiz — nuqtaviy zaryadlar modelida ular orasida kuch yo‘q, ip vertikal turadi. (Haqiqiy tajribada zaryadsiz folga sharcha ham zaryadlangan jismga biroz tortiladi: unda induksiya orqali zaryadlar ajraladi.)</p>");
    else {
      p.push(`<p>Sharchalar ${law.q1 * law.q2 > 0 ? "<b>bir xil ishorali</b> — itariladi" : "<b>har xil ishorali</b> — tortishadi"}. Osma sharchaga uchta kuch ta’sir qiladi: og‘irlik <b>mg</b>, ip tarangligi <b>T</b> va Kulon kuchi <b>F</b>. Muvozanatda ular yig‘indisi nolga teng, shuning uchun <b>tg α = F/(mg)</b>: burchakni o‘lchab, kuchni topamiz — F = ${fmt(P.measuredForce(o.m, law.a) * 1000, 3)} mN (formula bo‘yicha ${fmt(Fk * 1000, 3)} mN).</p>`);
      p.push(`<p>Stendni suring va har safar «Nuqta yozish»ni bosing (${law.pts.length} ta nuqta). Masofa 2 marta kamaysa, kuch 4 marta ortadi — «F(1/r²)» grafigida nuqtalar to‘g‘ri chiziqqa tushadi.</p>`);
      if (law.q1 * law.q2 < 0) p.push("<p>Tortishishda sharchalar yaqinlashgan sari kuch tez ortadi: yetarlicha yaqin bo‘lsa, sharcha stenddagisiga «yopishadi». Tekkanda bir xil o‘tkazgich sharchalarning zaryadi tenglashadi — (q₁ + q₂)/2 — va ular endi itariladi.</p>");
      else p.push("<p>Kulon zaryadni o‘lchay olmagan, lekin uni aniq bo‘la olgan: zaryadlangan sharchaga xuddi shunday neytral sharcha tegizilsa, zaryad teng ikkiga bo‘linadi. «Neytral sharcha tegizish»ni bosing: q₂ ikki marta kamayadi — kuch ham ikki marta kamayishini tekshiring.</p>");
    }
  } else if (ui.mode === "sup") {
    const f = fieldAt(sup.probe.x, sup.probe.y);
    p.push("<p><b>Superpozitsiya prinsipi</b>: har bir zaryad maydoni boshqalariga bog‘liq bo‘lmaydi, natijaviy maydon — vektorlar yig‘indisi: <b>E = E₁ + E₂ + …</b>. Shtrix chiziqlar vektorlarni uchma-uch qo‘yishni ko‘rsatadi (ikki vektor uchun — parallelogramm qoidasi).</p>");
    if (f.e < 0.02 * Math.max(...f.parts.map((q) => q.e), 1)) p.push("<p>Sinov zaryadi deyarli <b>E = 0</b> nuqtada: zaryadlarning maydonlari moduli teng va qarama-qarshi yo‘nalgan. Bu yerga qo‘yilgan zaryadga kuch ta’sir qilmaydi, potensial esa nolga teng bo‘lishi shart emas.</p>");
    else p.push(`<p>Kuch chiziqlari musbat zaryaddan boshlanib, manfiyda tugaydi; ular hech qachon kesishmaydi va chiziqqa urinma E yo‘nalishini beradi. Chiziqlar zich joyda maydon kuchli. Hozir E = ${sci(f.e, 3)} N/C.</p>`);
    if (sup.med !== "air") p.push(`<p>Kyuvetada ${P.MEDIA[sup.med].name.toLowerCase()} (ε = ${fmt(eps2(), 1)}): dielektrikning qutblanishi tufayli maydon havodagidan ${fmt(eps2(), 1)} marta kuchsiz, chiziqlar shakli esa o‘zgarmaydi. Moyga sepilgan yorma donalari qutblanib, kuch chiziqlari bo‘ylab tiziladi — maydonni «ko‘rish» usuli.</p>`);
  } else {
    const R = sphR(), Es = Math.abs(P.sphereE(sphQ(), R, R));
    p.push(sph.type === "shell"
      ? "<p><b>Metall shar</b> — o‘tkazgich: ortiqcha zaryadlar bir-birini itarib, faqat sirtga taqsimlanadi. Ichida maydon yo‘q (E = 0) — elektrostatik himoya (Faradey to‘ri) shunga asoslangan. Tashqarida shar maydoni markazdagi nuqtaviy Q zaryad maydonidek.</p>"
      : "<p><b>Dielektrik shar</b> hajmida tekis zaryadlangan: ichida maydon markazdan masofaga proporsional (E = kQr/R³), sirtda eng katta, tashqarida yana nuqtaviy zaryaddek kamayadi.</p>");
    p.push(`<p>Sirtdagi maydon E = kQ/R² = ${sci(Es, 3)} V/m. Havo taxminan <b>3 MV/m</b> da ionlashib, o‘tkazuvchan bo‘lib qoladi — shar zaryadini uchqun yoki «toj razryad» orqali yo‘qotadi. Bu radiusda Q<sub>max</sub> = ${fmt(Qmax(), 0)} nC: katta shar ko‘proq zaryad saqlaydi, shuning uchun Van de Graaf generatorlari sferasi katta va silliq qilinadi, chaqmoq qaytargich esa — o‘tkir.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "law" ? "<small>Kulon qonuni</small> F = k|q₁q₂|/r²" : ui.mode === "sup" ? "<small>Superpozitsiya</small> E = E₁ + E₂ + …" : "<small>Shar maydoni</small> E = kQ/r², r ≥ R";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); if (ui.mode !== "sup") graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "law") {
    stepLaw(dt);
    if (law.shared > 0) law.shared = Math.max(0, law.shared - dt);
    if (law.halveT > 0) { const was = law.halveT; law.halveT = Math.max(0, law.halveT - dt); if (was > 0.6 && law.halveT <= 0.6) doHalve(); }
  } else if (ui.mode === "sph") {
    if (sph.spark > 0) sph.spark = Math.max(0, sph.spark - dt);
    if (sph.beltT > 0) { sph.beltT = Math.max(0, sph.beltT - dt); sph.belt += dt * 60; sph.Q += dt * sph.rate; if (!sph.beltT) sph.Q = Math.round(sph.Q); QC.set(clamp(Math.round(sph.Q), -5000, 5000)); checkSpark(); }
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode !== "sup") graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) { if (ui.mode === "law") settleLaw(); sph.spark = 0; sph.beltT = 0; refresh(); }
}
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || MODE_DEFAULT[ui.mode], false));

/** Lahzali o'zgarish (pauzada yoki «kamroq harakat»da): sharcha darhol muvozanatga o'tadi */
function afterLawChange() { if (!running) settleLaw(); refresh(); }

/* ------------------------------------------------------------------ Boshqaruv: 1) Kulon */

function lawOut() { $("#lq1Out").textContent = qText(law.q1); $("#lq2Out").textContent = qText(law.q2); }
const q1C = bindRange($("#lq1"), $("#lq1Out"), (v) => qText(v), (v) => { law.q1 = v; customized(); afterLawChange(); });
const q2C = bindRange($("#lq2"), $("#lq2Out"), (v) => qText(v), (v) => { law.q2 = v; customized(); afterLawChange(); });
const DC = bindRange($("#lD"), $("#lDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { law.D = v * 10; customized(); afterLawChange(); });
const mC = bindRange($("#lm"), $("#lmOut"), (v) => `${fmt(v, 2)} g`, (v) => { law.m = v; customized(); afterLawChange(); });
$("[data-record]").addEventListener("click", () => {
  if (!law.q1 || !law.q2) return;
  if (running && !lawSettled()) { flashStatus("Sharcha hali tebranmoqda — to‘xtashini kuting"); return; }
  const o = lawObj(), r = lawGap(), F = P.measuredForce(o.m, law.a);
  if (law.pts.length >= 14) law.pts.shift();
  law.pts.push({ r, F, qq: o.q1 * o.q2 });
  refresh();
});
function doHalve() { law.q2 /= 2; q2C.set(law.q2); lawOut(); if (!running) settleLaw(); refresh(); }
$("[data-halve]").addEventListener("click", () => {
  if (!law.q2) return; customized();
  if (running && !prefersReducedMotion()) law.halveT = 1.2; else doHalve();
});
let flashTimer = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "purple"; clearTimeout(flashTimer); flashTimer = setTimeout(updateStatus, 1800); }

/* ------------------------------------------------------------------ Boshqaruv: 2) Superpozitsiya */

const sqC = bindRange($("#sq"), $("#sqOut"), (v) => qText(v), (v) => { if (!sup.charges[sup.sel]) return; sup.charges[sup.sel].q = v; customized(); refresh(); });
const medSel = $("#smed");
medSel.addEventListener("change", () => { sup.med = medSel.value; customized(); refresh(); });
$("[data-add]").addEventListener("click", () => {
  if (sup.charges.length >= 5) { flashStatus("Ko‘pi bilan 5 ta zaryad"); return; }
  const spots = [[90, 60], [270, 150], [270, 60], [90, 150], [180, 175], [180, 35]];
  const spot = spots.find(([x, y]) => sup.charges.every((q) => dist(q.x, q.y, x, y) > 30) && dist(sup.probe.x, sup.probe.y, x, y) > 20) || [180, 106];
  sup.charges.push({ x: spot[0], y: spot[1], q: -(sup.charges[sup.charges.length - 1]?.q || -10) });
  sup.sel = sup.charges.length - 1; customized(); syncSup(); refresh();
});
$("[data-remove]").addEventListener("click", () => {
  if (sup.charges.length <= 1) { flashStatus("Kamida bitta zaryad qoladi"); return; }
  sup.charges.splice(sup.sel, 1); sup.sel = Math.min(sup.sel, sup.charges.length - 1); customized(); syncSup(); refresh();
});
function syncSup() { const q = sup.charges[sup.sel]; if (q) sqC.set(q.q); medSel.value = sup.med; }

/* ------------------------------------------------------------------ Boshqaruv: 3) Shar */

const QC = bindRange($("#pQ"), $("#pQOut"), (v) => qText(v, 0), (v) => { sph.Q = v; customized(); checkSpark(); refresh(); });
const RCt = bindRange($("#pR"), $("#pROut"), (v) => `${fmt(v, 1)} cm`, (v) => { sph.R = v; keepProbeOut(); customized(); checkSpark(); refresh(); });
document.querySelectorAll("[data-type-value]").forEach((b) => b.addEventListener("click", () => { sph.type = b.dataset.typeValue; customized(); syncSph(); refresh(); }));
function syncSph() { QC.set(clamp(Math.round(sph.Q), -5000, 5000)); $("#pQOut").textContent = qText(Math.round(sph.Q), 0); RCt.set(sph.R); document.querySelectorAll("[data-type-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.typeValue === sph.type))); }
/** Sirtda maydon 3 MV/m dan oshsa — uchqun: zaryad yerga ulangan sharchaga o'tadi */
function checkSpark() {
  const qm = Qmax();
  if (Math.abs(sph.Q) <= qm) return false;
  sph.Q = Math.sign(sph.Q) * Math.round(qm * 0.55); sph.spark = running ? 0.45 : 0; sph.sparkSeed = (sph.sparkSeed * 7 + 3) % 997 + 1; sph.sparks++; sph.beltT = 0;
  syncSph(); if (!running) flashStatus("Uchqun! Havo teshildi, zaryad kamaydi");
  return true;
}
$("[data-charge]").addEventListener("click", () => {
  customized();
  const step = Math.max(20, Math.round(Qmax() * 0.18)), sg = sph.Q < 0 ? -1 : 1;
  if (running && !prefersReducedMotion()) { sph.beltT = 1; sph.rate = sg * step; }
  else { sph.Q += sg * step; checkSpark(); syncSph(); refresh(); }
});
$("[data-ground]").addEventListener("click", () => { customized(); sph.Q = 0; sph.beltT = 0; syncSph(); refresh(); });
function keepProbeOut() { /* zond shar sirtiga "yopishib" qolmasin — joyida qoladi, faqat sahnadan chiqmaydi */ sph.probe.x = clamp(sph.probe.x, 8, 470); sph.probe.y = clamp(sph.probe.y, 8, TABLE3 - 8); }

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* ------------------------------------------------------------------ Sahnada sudrash */

const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); };
function hitTest(p) {
  if (ui.mode === "law") {
    const f = fixed(), b = bob();
    if (dist(p.x, p.y, f.x, f.y) <= RB + 8 || (Math.abs(p.x - f.x) <= 18 && p.y >= f.y && p.y <= TABLE + 2)) return { k: "stand" };
    if (dist(p.x, p.y, b.x, b.y) <= RB + 8) return { k: "bob" };
    return null;
  }
  if (ui.mode === "sup") {
    if (dist(p.x, p.y, sup.probe.x, sup.probe.y) <= RP + 7) return { k: "probe" };
    for (let i = sup.charges.length - 1; i >= 0; i--) if (dist(p.x, p.y, sup.charges[i].x, sup.charges[i].y) <= RC + 6) return { k: "charge", i };
    return null;
  }
  const pr = sph.probe;
  if (dist(p.x, p.y, pr.x, pr.y) <= 10 || (p.x > pr.x && p.x < pr.x + 82 && p.y < pr.y && p.y > pr.y - 84 && Math.abs((p.x - pr.x) + (p.y - pr.y)) < 14)) return { k: "sprobe" };
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  e.preventDefault();
  const o = h.k === "stand" ? { x: fixed().x, y: 0 } : h.k === "bob" ? bob() : h.k === "probe" ? sup.probe : h.k === "charge" ? sup.charges[h.i] : sph.probe;
  if (h.k === "charge") { sup.sel = h.i; syncSup(); }
  drag = { ...h, ox: p.x - o.x, oy: p.y - o.y };
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  refresh();
});
function onDrag(p) {
  const nx = p.x - drag.ox, ny = p.y - drag.oy;
  if (drag.k === "stand") { law.D = clamp(Math.round(nx - PX), 20, 140); DC.set(law.D / 10); afterLawChange(); }
  else if (drag.k === "bob") { law.a = clamp(Math.asin(clamp((p.x - PX) / LEN, -0.9, 0.9)), -60 * DEG, P.touchAngle(LEN * MM, law.D * MM, 2 * RB * MM) - 0.001); law.w = 0; }
  else if (drag.k === "probe") { sup.probe.x = clamp(nx, TRAY.x0 + 5, TRAY.x1 - 5); sup.probe.y = clamp(ny, TRAY.y0 + 5, TRAY.y1 - 5); }
  else if (drag.k === "charge") { const q = sup.charges[drag.i]; q.x = clamp(Math.round(nx), TRAY.x0 + RC + 2, TRAY.x1 - RC - 2); q.y = clamp(Math.round(ny), TRAY.y0 + RC + 2, TRAY.y1 - RC - 2); }
  else if (drag.k === "sprobe") { sph.probe.x = clamp(nx, 8, 400); sph.probe.y = clamp(ny, 90, TABLE3 - 8); }
  customized(); refresh();
}
const CURSOR = { stand: "ew-resize", bob: "grab", probe: "grab", charge: "grab", sprobe: "grab" };
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h.k] : ""; return; } onDrag(p); });
function endDrag() { if (!drag) return; const k = drag.k; drag = null; canvas.dataset.dragging = "false"; if (k === "bob" && !running) settleLaw(); refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setLaw = (q1, q2, D, m = 0.05) => () => { Object.assign(law, { q1, q2, D, m, a: 0, w: 0, pts: [], shared: 0, halveT: 0 }); };
const setSup = (charges, probe, med = "air", show = {}) => () => { sup.charges = charges.map(([x, y, q]) => ({ x, y, q })); sup.sel = 0; sup.probe = { x: probe[0], y: probe[1] }; sup.med = med; Object.assign(ui.show, { lines: true, grains: false, parts: true }, show); };
const setSph = (Q, R, type, probe = [300, 130], show = {}) => () => { Object.assign(sph, { Q, R, type, probe: { x: probe[0], y: probe[1] }, spark: 0, beltT: 0, sparks: 0 }); Object.assign(ui.show, { lines: true, cut: true }, show); };
const PRESETS = {
  repel: { mode: "law", title: "Itarilish (+ +)", lesson: "Ikkala sharcha bir xil musbat zaryadlangan: osma sharcha stenddan uzoqlashadi. Stendni chizg‘ich bo‘ylab yaqinlashtiring — burchak ortadi.", set: setLaw(7, 7, 40) },
  attract: { mode: "law", title: "Tortishish (+ −)", lesson: "Zaryadlar har xil ishorali va kichik: osma sharcha stend tomon og‘adi, lekin yetib bormaydi. Stendni sekin yaqinlashtirib ko‘ring.", set: setLaw(2.5, -2.5, 50) },
  touch: { mode: "law", title: "Tegish: zaryad bo‘linadi", lesson: "Kuchli tortishish: sharcha stenddagisiga tegadi, zaryadlar tenglashadi ((+8 − 2)/2 = +3 nC) va endi sharchalar itariladi.", set: setLaw(8, -2, 35) },
  rlaw: { mode: "law", title: "F ∝ 1/r²: o‘lchashlar", lesson: "Stendni 3, 5, 7, 9, 12 cm ga qo‘yib, har safar «Nuqta yozish»ni bosing. So‘ng «F(1/r²)» grafigini oching — nuqtalar to‘g‘ri chiziqda yotadi.", set: setLaw(7, 7, 30) },
  halve: { mode: "law", title: "Kulon usuli: zaryadni bo‘lish", lesson: "«Nuqta yozish»ni bosing, so‘ng «Neytral sharcha tegizish» — q₂ ikki marta kamayadi. Stendni avvalgi r ga qaytarib, kuch ham ikki marta kamayganini tekshiring.", set: setLaw(7, 7, 40) },
  heavy: { mode: "law", title: "Og‘irroq sharcha", lesson: "Sharcha massasi 3 marta katta (0,15 g): xuddi shu zaryadlarda burchak ancha kichik. tg α = F/(mg) — sezgir asbob uchun yengil sharcha kerak.", set: setLaw(7, 7, 40, 0.15) },
  single: { mode: "sup", title: "Nuqtaviy zaryad maydoni", lesson: "Bitta musbat zaryad: kuch chiziqlari radial, zaryaddan chiqadi. Sinov zaryadini uzoqlashtiring — E masofa kvadratiga teskari kamayadi. Zaryad ishorasini almashtirib ko‘ring.", set: setSup([[150, 106, 10]], [230, 70], "castor", { grains: true }) },
  twoEq: { mode: "sup", title: "Ikki bir xil zaryad", lesson: "Ikki teng musbat zaryad: o‘rtada maydon nolga teng — chiziqlar u yerga kirmaydi. Sinov zaryadini simmetriya o‘qi bo‘ylab suring.", set: setSup([[120, 106, 10], [240, 106, 10]], [180, 60]) },
  dipole: { mode: "sup", title: "Dipol: + va −", lesson: "Teng va qarama-qarshi zaryadlar. E₁ va E₂ ni parallelogramm qoidasi bilan qo‘shing: o‘rta chiziqda natijaviy E dipol o‘qiga parallel, + dan − tomon.", set: setSup([[120, 106, 10], [240, 106, -10]], [180, 60]) },
  zero: { mode: "sup", title: "E = 0 nuqtani toping", lesson: "q₁ = +16 nC va q₂ = +4 nC, oralig‘i 12 cm. Maydon nolga teng nuqta kichik zaryadga yaqinroq: q₁ dan 8 cm da. Sinov zaryadini u yerga olib boring.", set: setSup([[120, 106, 16], [240, 106, 4]], [190, 80]) },
  triangle: { mode: "sup", title: "Uch zaryad (uchburchak)", lesson: "Teng tomonli uchburchak uchlarida uchta bir xil zaryad: markazda E = 0, lekin potensial nolga teng emas — φ skalyar ravishda qo‘shiladi.", set: setSup([[180, 46, 8], [128, 136, 8], [232, 136, 8]], [180, 120]) },
  quad: { mode: "sup", title: "Kvadrupol (+ − + −)", lesson: "Kvadrat uchlarida navbatma-navbat ishorali zaryadlar. Markazda maydon nol, chiziqlar to‘rt «bo‘lak»ka ajraladi. Har bir E ni ko‘pburchak qoidasi bilan qo‘shing.", set: setSup([[130, 56, 8], [230, 56, -8], [230, 156, 8], [130, 156, -8]], [180, 106]) },
  oil: { mode: "sup", title: "Kastor moyidagi yorma", lesson: "Klassik tajriba: kastor moyiga manna yormasi sepilgan, ikki elektrod — + va −. Donalar qutblanib, kuch chiziqlari bo‘ylab zanjir bo‘lib tiziladi. Chiziqlarni o‘chirib, faqat donalarga qarang.", set: setSup([[110, 106, 12], [250, 106, -12]], [180, 40], "castor", { grains: true, lines: false, parts: false }) },
  shell: { mode: "sph", title: "Metall shar maydoni", lesson: "Metall shar zaryadlangan. Zondni uzoqdan sharga yaqinlashtiring: E = kQ/r² ortadi va sirtda eng katta. So‘ng zondni kesim orqali ichkariga kiriting — E = 0.", set: setSph(400, 8, "shell", [320, 130]) },
  inside: { mode: "sph", title: "O‘tkazgich ichida E = 0", lesson: "Zond shar ichida. Qancha zaryad bermang («Zaryadlash»), ichkarida maydon nol, potensial esa sirtdagiga teng. «φ(r)» grafigini oching.", set: setSph(800, 10, "shell", [175, 140]) },
  solid: { mode: "sph", title: "Dielektrik shar (hajmda)", lesson: "Shar hajmida tekis zaryadlangan: ichida E = kQr/R³ — markazda nol, sirtda maksimum. Zondni markazdan tashqariga suring va E(r) grafigini kuzating.", set: setSph(400, 8, "solid", [190, 130]) },
  vdg: { mode: "sph", title: "Van de Graaf va uchqun", lesson: "Generator sferasi R = 10 cm. «Zaryadlash»ni bir necha marta bosing: sirtdagi maydon 3 MV/m ga yetganda havo teshiladi va yerga ulangan sharchaga uchqun sakraydi.", set: setSph(2400, 10, "shell", [330, 100]) },
  small: { mode: "sph", title: "Kichik shar tez teshiladi", lesson: "R = 3 cm: bu shar 300 nC dan ortiq zaryad saqlay olmaydi (E = kQ/R²). Radiusni oshiring — shar ko‘proq zaryad saqlaydi, potensiali ham ortadi.", set: setSph(250, 3, "shell", [250, 130]) },
};
const GROUPS = [["Kulon qonuni", ["repel", "attract", "touch", "rlaw", "halve", "heavy"]], ["Superpozitsiya", ["single", "twoEq", "dipole", "zero", "triangle", "quad", "oil"]], ["Zaryadlangan shar", ["shell", "inside", "solid", "vdg", "small"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { law: "Stendni suring, burchakni transportirdan o‘qing", sup: "Zaryadlarni va sinov zaryadi q₀ ni suring", sph: "Zondni dastasidan ushlab suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  setTabs();
}
function syncAll() {
  q1C.set(law.q1); q2C.set(law.q2); DC.set(law.D / 10); mC.set(law.m); lawOut();
  syncSup(); syncSph();
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = !!ui.show[cb.dataset.toggle]; });
}
const MODE_DEFAULT = { law: "repel", sup: "dipole", sph: "shell" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null;
  p.set();
  if (ui.mode === "law") { law.a = 0; law.w = 0; if (!running || prefersReducedMotion()) settleLaw(); }
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "repel");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__coulomb = { law, sup, sph, ui, loadPreset, settleLaw, fieldAt, refresh };
