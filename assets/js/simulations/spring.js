// ==========================================================================
// Prujinali mayatnik — simulyatsiya (simulations/spring.html)
// Fizika: spring-physics.js (RK4, aniq yechim bilan tekshirilgan). Grafiklar: spring-plots.js, pendulum-plots.js.
// Gorizontal ↔ vertikal: x muvozanatdan o'lchanadi, rejimni almashtirganda (x, v) saqlanadi —
// vertikalda og'irlik faqat muvozanatni Δl = mg/k ga siljitadi, davr o'zgarmaydi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, arrow, tag, bindRange } from "./sim-kit.js";
import {
  TAU, effectiveK, jointShare, omega0, period0, regime, steadyAmplitude, amplitudeOf,
  kinetic, elastic, dynParams, advance, createPeriodMeter,
} from "./spring-physics.js";
import { createHistory, createEnergyPlot, splitHeights } from "./pendulum-plots.js";
import { createXPlot, createSpringPhasePlot, drawHooke, drawPeriodVsMass, periodMassFromPointer } from "./spring-plots.js";

const $ = (s) => document.querySelector(s);
const L0 = 0.5;            // prujinaning cho'zilmagan uzunligi (m) — faqat tasvir uchun, dinamikaga kirmaydi
const X_LIMIT = 0.45;      // masshtab chegarasi (m)
const SMALL = "600 11px Inter, system-ui, sans-serif";
const ITALIC = "italic 700 14px 'Times New Roman', serif";

/* ------------------------------------------------------------------ Holat */

const P = { mode: "horizontal", link: "single", k1: 25, k2: 60, m: 1, b: 0, g: 9.81, driveOn: false, F: 0.8, ratio: 1 };
const init = { x: 0.12, v: 0 };
const ui = { speed: 1, tab: "x", show: { forces: true, net: false, velocity: true, marks: true, energy: true, vcurve: true } };

let s = { x: init.x, v: init.v, t: 0 };
const meter = createPeriodMeter();
const hist = createHistory(3500);
const xPlot = createXPlot(), phasePlot = createSpringPhasePlot(), energyPlot = createEnergyPlot();
let lastSample = -1;
let eRef = 0;                  // energiya ustunlari masshtabi (J)
let Aview = 0.2;               // ko'rinadigan amplituda (m) — masshtab shundan olinadi
let flag = null;               // null | "rest" | "limit"

const k = () => effectiveK(P.link, P.k1, P.k2);
const w0 = () => omega0(k(), P.m);
const T0 = () => period0(k(), P.m);
const Om = () => P.ratio * w0();
const dlStatic = () => (P.m * P.g) / k();
const sideM = () => 0.09 + 0.035 * Math.cbrt(P.m);
const windowSeconds = () => clamp(4 * T0(), 3, 30);
const sampleDt = () => windowSeconds() / 700;
const params = () => dynParams({ m: P.m, k: k(), b: P.b, f: P.driveOn ? P.F : 0, Om: Om() });
const drivePush = (t) => (P.driveOn ? P.F * Math.cos(Om() * t) : 0);
const E_of = (st) => kinetic(st.v, P.m) + elastic(st.x, k());

function updateAview() {
  let ref = amplitudeOf(init.x, init.v, w0());
  if (P.driveOn) {
    const A = steadyAmplitude(k(), P.m, P.b, P.F, Om());
    ref += Number.isFinite(A) ? A : X_LIMIT;
  }
  Aview = clamp(1.15 * ref, 0.15, X_LIMIT);
}

function sample(a) {
  hist.push(a.t, a.x, a.v, kinetic(a.v, P.m), elastic(a.x, k()), null);
  lastSample = a.t;
}

function resetSim({ keepRunning = false } = {}) {
  s = { x: init.x, v: init.v, t: 0 };
  meter.reset();
  hist.clear();
  lastSample = -1;
  flag = null;
  updateAview();
  eRef = Math.max(E_of(s) * 1.15, 0.5 * k() * 0.05 * 0.05);
  sample(s);
  if (!keepRunning) loop.stop();
}

/* ------------------------------------------------------------------ Masshtab va geometriya */

let view = null;

function computeView(w, h) {
  const narrow = w < 560;
  const barsW = !narrow && ui.show.energy ? 150 : 0;
  const topPad = 34, botPad = 42;
  const availH = h - topPad - botPad;
  const massF = clamp(0.75 + 0.25 * Math.cbrt(P.m), 0.85, 1.12);
  const dl = P.mode === "vertical" ? dlStatic() : 0;
  const v = { w, h, barsW, topPad, botPad, dl, vert: P.mode === "vertical" };
  if (!v.vert) {
    const wallX = 40, availW = w - barsW - wallX - 24;
    v.sidePx = clamp(availH * 0.36, 52, 110) * massF;
    v.s = clamp((availW - v.sidePx) / (L0 + Aview), 50, 720);
    v.anchor = wallX;
    const above = v.sidePx / 2 + 70, below = v.sidePx / 2 + 54;
    v.cy = Math.max(above + 6, topPad + (availH - above - below) / 2 + above + 12);
    v.cx = 0;
  } else {
    v.sidePx = clamp(availH * 0.24, 38, 72) * massF;
    const total = L0 + dl + Aview;
    v.s = clamp((availH - v.sidePx) / total, 22 / Aview, 520);
    const hh = v.s * total + v.sidePx;
    v.anchor = hh <= availH ? topPad : h - botPad - hh;
    v.cx = (w - barsW) / 2 - 18;
    v.cy = 0;
  }
  v.side = v.sidePx / v.s;
  return v;
}

/** o'q bo'ylab u (m, langardan/shiftdan) va ko'ndalang p (px) -> piksel */
const pt = (v, u, p = 0) => (v.vert ? { x: v.cx + p, y: v.anchor + v.s * u } : { x: v.anchor + v.s * u, y: v.cy + p });

function niceStepCm(pxPerM, minPx) {
  for (const cm of [1, 2, 5, 10, 20, 50]) if ((cm / 100) * pxPerM >= minPx) return cm / 100;
  return 0.5;
}

/* ------------------------------------------------------------------ Chizish: qismlar */

function coil(ctx, c, a, b, { kk, coils, amp }) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const lead = Math.min(14, len * 0.14), body = len - 2 * lead, n = coils * 2;
  ctx.save();
  ctx.strokeStyle = c.text2;
  ctx.lineWidth = 1.4 + 2.2 * Math.sqrt(kk / 300);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(a.x + ux * lead, a.y + uy * lead);
  for (let i = 0; i < n; i++) {
    const pos = lead + (body * (i + 0.5)) / n, sg = i % 2 ? 1 : -1;
    ctx.lineTo(a.x + ux * pos + nx * amp * sg, a.y + uy * pos + ny * amp * sg);
  }
  ctx.lineTo(b.x - ux * lead, b.y - uy * lead);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function hatch(ctx, c, x0, y0, x1, y1, dirx, diry, step = 10) {
  // (x0,y0)-(x1,y1) chiziq bo'ylab shtrixlar; (dirx,diry) — shtrix yo'nalishi (px)
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  ctx.save();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let d = 4; d < len; d += step) { const px = x0 + ux * d, py = y0 + uy * d; ctx.moveTo(px, py); ctx.lineTo(px + dirx, py + diry); }
  ctx.stroke();
  ctx.restore();
}

function drawAnchorAndFloor(ctx, c, v) {
  ctx.save();
  if (!v.vert) {
    const floorY = v.cy + v.sidePx / 2, x1 = v.w - v.barsW - 10, top = v.cy - v.sidePx / 2 - 70;
    ctx.fillStyle = c.sunken;
    ctx.fillRect(v.anchor - 14, Math.max(8, top), 14, floorY - Math.max(8, top));
    ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(v.anchor, Math.max(8, top)); ctx.lineTo(v.anchor, floorY); ctx.lineTo(x1, floorY); ctx.stroke();
    hatch(ctx, c, v.anchor, floorY, x1, floorY, -8, 9);
    hatch(ctx, c, v.anchor, Math.max(8, top), v.anchor, floorY, -9, 8);
  } else if (v.anchor >= v.topPad - 2) {
    const half = Math.min(110, v.cx - 10, (v.w - v.barsW) / 2 - 10);
    ctx.fillStyle = c.sunken;
    ctx.fillRect(v.cx - half, v.anchor - 14, half * 2, 14);
    ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(v.cx - half, v.anchor + 0.5); ctx.lineTo(v.cx + half, v.anchor + 0.5); ctx.stroke();
    hatch(ctx, c, v.cx - half, v.anchor, v.cx + half, v.anchor, 8, -12);
  } else {
    tag(ctx, "tavan yuqorida ↑", v.cx + 22, 16, { color: c.text2, bg: c.bg2, font: SMALL });
  }
  ctx.restore();
}

function springGeometry(v) {
  // Prujinalar ro'yxati va (ketma-ket bo'lsa) birlashma holati; hammasi o'q bo'ylab metrda (u)
  const ub = L0 + v.dl + s.x;
  const k1 = P.k1, k2 = P.k2;
  const amp = clamp(v.sidePx * (P.link === "parallel" ? 0.17 : 0.24), 5, 13);
  if (P.link === "parallel") {
    const off = 0.3 * v.sidePx;
    return { ub, segs: [{ u0: 0, u1: ub, p: -off, kk: k1, coils: 12, amp }, { u0: 0, u1: ub, p: off, kk: k2, coils: 12, amp }], joint: null };
  }
  if (P.link === "series") {
    const e1 = (v.vert ? (P.m * P.g) / k1 : 0) + s.x * jointShare(k1, k2), uj = L0 / 2 + e1;
    return { ub, segs: [{ u0: 0, u1: uj, p: 0, kk: k1, coils: 7, amp }, { u0: uj, u1: ub, p: 0, kk: k2, coils: 7, amp }], joint: uj };
  }
  return { ub, segs: [{ u0: 0, u1: ub, p: 0, kk: k1, coils: 12, amp }], joint: null };
}

function drawRuler(ctx, c, v) {
  const step = niceStepCm(v.s, 28), A = Math.floor(Aview / step + 1e-9) * step;
  const eq = v.vert ? pt(v, L0 + v.dl) : pt(v, L0 + v.side / 2);
  ctx.save();
  ctx.strokeStyle = c.text3; ctx.fillStyle = c.text2; ctx.lineWidth = 1.5;
  ctx.font = SMALL;
  const zero = v.vert ? { x: v.cx + v.sidePx / 2 + 62, y: eq.y } : { x: eq.x, y: v.cy + v.sidePx / 2 + 26 };
  const sgn = v.vert ? { dx: 0, dy: 1 } : { dx: 1, dy: 0 };
  const a = { x: zero.x - sgn.dx * Aview * v.s, y: zero.y - sgn.dy * Aview * v.s };
  const b = { x: zero.x + sgn.dx * Aview * v.s, y: zero.y + sgn.dy * Aview * v.s };
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  for (let q = -A; q <= A + 1e-9; q += step) {
    const px = zero.x + sgn.dx * q * v.s, py = zero.y + sgn.dy * q * v.s, big = Math.abs(q) < step * 1e-6;
    ctx.beginPath();
    if (v.vert) { ctx.moveTo(px - (big ? 7 : 4), py); ctx.lineTo(px + (big ? 7 : 4), py); } else { ctx.moveTo(px, py - (big ? 7 : 4)); ctx.lineTo(px, py + (big ? 7 : 4)); }
    ctx.stroke();
    ctx.textBaseline = "middle";
    const label = big ? "0" : fmt(q * 100, step < 0.01 ? 1 : 0);
    if (v.vert) { ctx.textAlign = "left"; ctx.fillText(label, px + 11, py); } else { ctx.textAlign = "center"; ctx.fillText(label, px, py + 15); }
  }
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (v.vert) ctx.fillText("x, sm", zero.x - 14, a.y - 16); else ctx.fillText("x, sm", b.x + 12, zero.y);
  // joriy x ko'rsatkichi
  const cur = { x: zero.x + sgn.dx * s.x * v.s, y: zero.y + sgn.dy * s.x * v.s };
  ctx.fillStyle = c.warning;
  ctx.beginPath();
  if (v.vert) { ctx.moveTo(cur.x - 9, cur.y - 6); ctx.lineTo(cur.x - 9, cur.y + 6); ctx.lineTo(cur.x, cur.y); } else { ctx.moveTo(cur.x - 6, cur.y - 9); ctx.lineTo(cur.x + 6, cur.y - 9); ctx.lineTo(cur.x, cur.y); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  return { zero, cur };
}

function drawBars(ctx, c, v, K, U, E) {
  const x0 = v.w - v.barsW + 6, wBox = v.barsW - 16;
  const y0 = v.topPad - 8, hBox = v.h - v.topPad - v.botPad + 16;
  ctx.save();
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x0, y0, wBox, hBox, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = "600 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("Energiya, J", x0 + wBox / 2, y0 + 18);
  const top = y0 + 52, bottom = y0 + hBox - 30;
  eRef = Math.max(eRef, E * 1.08, U * 1.08);
  const bw = 28, gap = (wBox - 3 * bw) / 4;
  [["K", K, c.success], ["U", U, c.warning], ["E", E, c.primary]].forEach(([name, val, col], i) => {
    const bx = x0 + gap + i * (bw + gap), hh = clamp(val / eRef, 0, 1) * (bottom - top);
    ctx.fillStyle = c.sunken; ctx.beginPath(); ctx.roundRect(bx, top, bw, bottom - top, 6); ctx.fill();
    ctx.fillStyle = col;
    if (hh > 0.5) { ctx.beginPath(); ctx.roundRect(bx, bottom - hh, bw, hh, 6); ctx.fill(); }
    ctx.fillStyle = c.text2; ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.fillText(name, bx + bw / 2, bottom + 14);
    ctx.fillStyle = c.text; ctx.font = SMALL; ctx.fillText(sci(val, 2), bx + bw / 2, top - 12);
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ Chizish: asosiy sahna */

function draw(ctx, stage) {
  const { w, h, colors: c } = stage;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const v = (view = computeView(w, h));
  const kk = k(), mg = P.m * P.g;

  drawAnchorAndFloor(ctx, c, v);

  // Muvozanat va tabiiy uzunlik belgilari
  const eqPt = v.vert ? pt(v, L0 + v.dl) : pt(v, L0 + v.side / 2);
  if (v.vert && ui.show.marks) {
    const natY = v.anchor + v.s * L0, eqY = v.anchor + v.s * (L0 + v.dl);
    const cols = Math.max(1, (ui.show.velocity ? 1 : 0) + (ui.show.forces && P.b > 0 ? 1 : 0) + (ui.show.forces && P.driveOn ? 1 : 0));
    const xl = Math.max(100, v.cx - v.sidePx / 2 - 16 - 22 * cols - 14);
    ctx.save();
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.25;
    ctx.strokeStyle = c.text3;
    ctx.beginPath(); ctx.moveTo(xl, natY); ctx.lineTo(v.cx + v.sidePx * 0.9, natY); ctx.stroke();
    ctx.strokeStyle = c.primary; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(xl, eqY); ctx.lineTo(v.cx + v.sidePx * 0.9 + 12, eqY); ctx.stroke();
    ctx.restore();
    if (eqY - natY > 14) arrow(ctx, xl + 8, natY + 1, 0, eqY - natY - 2, c.special, { width: 1.75, head: 7 }), arrow(ctx, xl + 8, eqY - 1, 0, -(eqY - natY - 2), c.special, { width: 1.75, head: 7 });
    tag(ctx, `Δl = ${fmt(v.dl * 100, 1)} sm`, xl - 6, (natY + eqY) / 2, { color: c.text, bg: c.bg, align: "right", font: SMALL });
    tag(ctx, "tabiiy l₀", xl - 6, natY - (eqY - natY > 40 ? 0 : 12), { color: c.text2, bg: c.bg, align: "right", font: SMALL });
    tag(ctx, "muvozanat", xl - 6, eqY + (eqY - natY > 40 ? 0 : 12), { color: c.primary, bg: c.bg, align: "right", font: SMALL });
  } else if (!v.vert && ui.show.marks) {
    ctx.save();
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.25; ctx.strokeStyle = c.primary; ctx.globalAlpha = 0.65;
    ctx.beginPath(); ctx.moveTo(eqPt.x, v.cy - v.sidePx / 2 - 8); ctx.lineTo(eqPt.x, v.cy + v.sidePx / 2 + 26); ctx.stroke();
    ctx.restore();
  }

  // Prujina(lar)
  const geo = springGeometry(v);
  for (const sg of geo.segs) coil(ctx, c, pt(v, sg.u0, sg.p), pt(v, sg.u1, sg.p), sg);
  if (geo.joint !== null) {
    const j = pt(v, geo.joint);
    ctx.fillStyle = c.text; ctx.beginPath(); ctx.arc(j.x, j.y, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(j.x, j.y, 1.8, 0, TAU); ctx.fill();
  }

  // Yuk
  const bx = v.vert ? v.cx - v.sidePx / 2 : v.anchor + v.s * geo.ub;
  const by = v.vert ? v.anchor + v.s * geo.ub : v.cy - v.sidePx / 2;
  const centre = { x: bx + v.sidePx / 2, y: by + v.sidePx / 2 };
  const dragging = view && stage.canvas.dataset.dragging === "true";
  ctx.save();
  ctx.fillStyle = c.bg;
  ctx.beginPath(); ctx.roundRect(bx, by, v.sidePx, v.sidePx, Math.min(10, v.sidePx * 0.16)); ctx.fill();
  ctx.globalAlpha = 0.18; ctx.fillStyle = c.primary; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = dragging ? c.warning : c.primary;
  ctx.lineWidth = dragging ? 4 : 3;
  ctx.stroke();
  if (v.sidePx >= (v.vert ? 60 : 34)) {
    ctx.fillStyle = c.primary; ctx.font = `700 ${v.vert ? 10.5 : 12}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${fmt(P.m, 1)} kg`, centre.x, v.vert ? centre.y : by + v.sidePx - 12);
  }
  ctx.restore();

  // Tayanch tushunchalari: parallel/ketma-ket yozuvi (gorizontalda)
  if (!v.vert && ui.show.marks) {
    const midU = geo.ub / 2, mid = pt(v, midU);
    const text = P.link === "single" ? `k = ${fmt(P.k1, 0)} N/m` : P.link === "parallel" ? `k₁ ‖ k₂ → k = ${fmt(kk, 0)} N/m` : `k₁ — k₂ → k = ${fmt(kk, 1)} N/m`;
    tag(ctx, text, Math.max(mid.x, v.anchor + 70), v.cy - v.sidePx / 2 - 22 - (P.link === "parallel" ? 6 : 0), { color: c.text, bg: c.bg, align: "center", font: SMALL });
  }

  // Vektorlar
  const F_spring = -kk * s.x;                    // gorizontal: butun prujina kuchi; vertikal: faqat −kx (teng ta'sir etuvchi)
  const drag = -P.b * s.v;
  const push = drivePush(s.t);
  const rows = [];                               // yon qatorlar: tezlik, qarshilik, tashqi kuch
  let kF;
  if (!v.vert) {
    kF = 70 / (kk * Aview);
    if (ui.show.forces) {
      const len = Math.max(16, v.sidePx / 2 - 8), off = v.sidePx * 0.32;
      arrow(ctx, centre.x + off, centre.y, 0, len, c.special, { width: 2.5, head: 9, label: "mg", font: ITALIC });
      arrow(ctx, centre.x - off, centre.y, 0, -len, c.text2, { width: 2.5, head: 9, label: "N", font: ITALIC });
      arrow(ctx, centre.x, centre.y, F_spring * kF, 0, c.success, { width: 3, label: "F", font: ITALIC });
    }
  } else {
    kF = 90 / (mg + kk * Aview);
    if (ui.show.forces) {
      const Fel = kk * (v.dl + s.x);
      arrow(ctx, centre.x - v.sidePx * 0.3, centre.y, 0, mg * kF, c.special, { width: 3, head: 9, label: "mg", font: ITALIC });
      arrow(ctx, centre.x + v.sidePx * 0.3, centre.y, 0, -Fel * kF, c.success, { width: 3, head: 9, label: "F", font: ITALIC });
    }
    if (ui.show.net) {
      const x = centre.x + v.sidePx / 2 + 16;
      arrow(ctx, x, centre.y, 0, F_spring * kF * 3, c.danger, { width: 3, head: 9, label: "−kx", font: ITALIC, dash: [6, 4] });
    }
  }
  if (ui.show.velocity) rows.push({ d: s.v / (Aview * w0()) * 60, color: c.warning, label: "v" });
  if (ui.show.forces && P.b > 0) rows.push({ d: drag * kF, color: c.danger, label: "Fq", dash: [5, 4] });
  if (ui.show.forces && P.driveOn) rows.push({ d: push * kF, color: c.special, label: "F(t)" });
  rows.forEach((r, i) => {
    const d = clamp(r.d, -150, 150);
    const opt = { width: 2.5, head: 8, label: r.label, font: ITALIC, dash: r.dash || null };
    if (!v.vert) arrow(ctx, centre.x, by - 30 - 20 * i, d, 0, r.color, opt);
    else arrow(ctx, bx - 16 - 22 * i, centre.y, 0, d, r.color, opt);
  });

  if (ui.show.marks) drawRuler(ctx, c, v);

  if (v.barsW) drawBars(ctx, c, v, kinetic(s.v, P.m), elastic(s.x, kk), E_of(s));

  tag(ctx, `t = ${fmt(s.t, 1)} s`, 12, 20, { color: c.text2, bg: c.bg2, font: "600 12px Inter, system-ui, sans-serif" });
}

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  x: ["Siljishning vaqtga bog‘liqligi x(t)", "Yuk muvozanat atrofida garmonik tebranadi; uzuq chiziq — tezlik v/ω₀ (x bilan 90° farq)"],
  phase: ["Faza portreti (x, v)", "Bosib boshlang‘ich holatni tanlang · ishqalanishsiz — ellips, so‘nishda — spiral"],
  energy: ["Energiyaning vaqtga bog‘liqligi E(t)", "Kinetik va elastik potensial energiya almashinuvi; to‘liq energiya ishqalanishsiz o‘zgarmaydi"],
  hooke: ["Guk qonuni F(x)", "F = −kx: qiyalik qattiqlik k; yuza — saqlangan potensial energiya ½kx²"],
  period: ["Davrning massaga bog‘liqligi T(m)", "Bosib massani tanlang · T ∝ √m, qattiqroq prujinada davr qisqa"],
};

function envelope() {
  const R = regime(k(), P.m, P.b);
  if (P.driveOn || R.type !== "under") return null;
  const B = (init.v + (R.gamma / 2) * init.x) / R.wd;
  return { A0: Math.hypot(init.x, B), gamma: R.gamma };
}

function drawGraphCanvas(ctx, st) {
  if (ui.tab === "x") xPlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, w0: w0(), envelope: envelope(), showV: ui.show.vcurve });
  else if (ui.tab === "phase") phasePlot.draw(ctx, st, hist, { xView: Aview, vView: Aview * w0(), trail: 900 });
  else if (ui.tab === "energy") energyPlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, scale: 1, ref: eRef * 0.9 });
  else if (ui.tab === "hooke") drawHooke(ctx, st, { k: k(), xView: Aview, x: s.x, F: -k() * s.x });
  else drawPeriodVsMass(ctx, st, { k: k(), m: P.m, mMin: 0.1, mMax: 3 });
}

/* ------------------------------------------------------------------ Ko'rsatkichlar */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

let lastExplain = "";
const sq = (x) => `<span class="sim-math">${x}</span>`;

function updateUI() {
  const kk = k(), m = P.m, W0 = w0(), t0 = T0();
  const R = regime(kk, m, P.b);
  const vert = P.mode === "vertical";
  const dl = dlStatic();
  const acc = (-kk * s.x - P.b * s.v + drivePush(s.t)) / m;
  const A = amplitudeOf(s.x, s.v, W0);
  const K = kinetic(s.v, m), U = elastic(s.x, kk);

  setReadout("x", `${fmt(s.x * 100, 1)}<small>sm</small>`, `v = ${fmt(s.v, 2)} m/s`);
  setReadout("a", `${fmt(acc, 2)}<small>m/s²</small>`, P.driveOn || P.b > 0 ? "a = (−kx − bv + F)/m" : `a = −ω₀²x, ω₀ = ${fmt(W0, 2)} rad/s`);
  if (vert) setReadout("F", `${fmt(kk * (dl + s.x), 2)}<small>N</small>`, `mg = ${fmt(m * P.g, 2)} N · teng ta’sir −kx = ${fmt(-kk * s.x, 2)} N`);
  else setReadout("F", `${fmt(-kk * s.x, 2)}<small>N</small>`, s.x === 0 ? "Muvozanat: kuch yo‘q" : s.x > 0 ? "Chapga — muvozanat tomon" : "O‘ngga — muvozanat tomon");

  const driven = P.driveOn;
  const aperiodic = R.type === "critical" || R.type === "over";
  const mTxt = meter.mean ?? meter.period;
  setReadout("Tm", mTxt ? `${fmt(mTxt, 3)}<small>s</small>` : "—",
    aperiodic && !driven ? "Tebranish yo‘q (aperiodik)" : meter.count ? `${meter.count} ta to‘liq tebranish bo‘yicha o‘rtacha` : mTxt ? "Birinchi o‘lchov" : s.t > 0 ? "O‘lchanmoqda…" : "Boshlang‘ich holat");
  if (driven) setReadout("Tt", `${fmt(TAU / Om(), 3)}<small>s</small>`, `Turg‘un rejimda T = 2π/Ω · T₀ = ${fmt(t0, 3)} s`);
  else if (aperiodic) setReadout("Tt", "∞", "T = 2π/ω_d: ω_d mavjud emas");
  else if (R.type === "under") setReadout("Tt", `${fmt(R.T, 3)}<small>s</small>`, `So‘nishda T = 2π/ω_d · T₀ = ${fmt(t0, 3)} s`);
  else setReadout("Tt", `${fmt(t0, 3)}<small>s</small>`, `T = 2π√(m/k) = 2π√(${fmt(m, 2)}/${fmt(kk, 1)})`);

  setReadout("E", `${sci(K + U, 3)}<small>J</small>`, `K = ${sci(K, 2)} J · U = ${sci(U, 2)} J`);
  if (vert) setReadout("dl", `${fmt(dl * 100, 1)}<small>sm</small>`, `Δl = mg/k = ${fmt(m * P.g, 2)}/${fmt(kk, 1)} · davr bog‘liq emas`);
  else setReadout("dl", "0<small>sm</small>", "Gorizontalda mg va N bir-birini yo‘qotadi");
  document.querySelector('[data-readout="dl"]').dataset.tone = vert ? "" : "muted";

  if (driven) {
    const Ast = steadyAmplitude(kk, m, P.b, P.F, Om());
    setReadout("A", `${fmt(A * 100, 1)}<small>sm</small>`, Number.isFinite(Ast) ? `Turg‘un amplituda ${fmt(Ast * 100, 1)} sm` : "Turg‘un amplituda cheksiz (rezonans, b = 0)");
  } else setReadout("A", `${fmt(A * 100, 1)}<small>sm</small>`, `v_max = Aω₀ = ${fmt(A * W0, 2)} m/s`);

  const bTxt = `b = ${fmt(P.b, 1)} kg/s · b_kr = 2√(km) = ${fmt(R.bc, 1)}`;
  if (R.type === "none") setReadout("Q", "yo‘q", `b = 0 · E o‘zgarmaydi · b_kr = ${fmt(R.bc, 1)} kg/s`);
  else if (R.type === "under") setReadout("Q", `Q = ${fmt(R.Q, 1)}`, `Susayuvchi · ${bTxt}`);
  else if (R.type === "critical") setReadout("Q", "kritik", `Eng tez qaytish · ${bTxt}`);
  else setReadout("Q", "aperiodik", `Tebranmasdan qaytadi · ${bTxt}`);

  // Holat
  const status = $("[data-status]");
  let [text, tone] = ["Tayyor", "blue"];
  if (flag === "limit") [text, tone] = ["Masshtab chegarasi", "red"];
  else if (flag === "rest") [text, tone] = ["Muvozanatda", "green"];
  else if (loop.running) [text, tone] = ["Tebranmoqda", "orange"];
  else if (s.t > 0) [text, tone] = ["Pauza", "purple"];
  status.textContent = text;
  status.dataset.tone = tone;

  // Rejimga bog'liq elementlar
  $("[data-net-switch]").hidden = !vert;
  $("[data-g-note]").textContent = vert
    ? "Vertikalda g muvozanatni Δl = mg/k ga siljitadi; davr g ga bog‘liq emas."
    : "Gorizontalda g ta’sir qilmaydi (mg va N muvozanatlashadi). Vertikal rejimda Δl ni o‘zgartiradi.";

  // Tushuntirish
  const parts = [];
  parts.push(vert
    ? `<p><b>Vertikal tebranish.</b> Yuk osilgach prujina avval <b>Δl = mg/k = ${fmt(dl * 100, 1)} sm</b> cho‘zilib, og‘irlikni muvozanatlaydi — bu yangi muvozanat nuqtasi (${sq("x = 0")}). Undan siljiganda og‘irlik va prujina kuchining teng ta’sir etuvchisi ${sq("−kx")}: gorizontaldagi bilan aynan bir xil tenglama, shuning uchun ${sq(`T = 2π√(m/k) = ${fmt(t0, 3)} s`)} va <b>g ga bog‘liq emas</b>.</p>`
    : `<p><b>Gorizontal tebranish.</b> Silliq sirtda og‘irlik ${sq("mg")} va reaksiya ${sq("N")} bir-birini yo‘qotadi; yuklamaga faqat prujina kuchi ${sq("F = −kx")} ta’sir qiladi va u doim muvozanat tomon yo‘nalgan. Davr ${sq(`T = 2π√(m/k) = ${fmt(t0, 3)} s`)}. “Vertikal” tugmasini bosib, shu holatning o‘zi osilgan yukda qanday ko‘rinishini ko‘ring.</p>`);
  if (P.link === "parallel") parts.push(`<p><b>Parallel ulanish:</b> ikkala prujina bir xil siljiydi, kuchlari qo‘shiladi — ${sq(`k = k₁ + k₂ = ${fmt(P.k1, 0)} + ${fmt(P.k2, 0)} = ${fmt(kk, 0)} N/m`)}. Tizim qattiqroq, shuning uchun davr qisqaroq.</p>`);
  else if (P.link === "series") parts.push(`<p><b>Ketma-ket ulanish:</b> ikkala prujinada kuch bir xil, cho‘zilishlar qo‘shiladi — ${sq(`1/k = 1/k₁ + 1/k₂`)}, ${sq(`k = ${fmt(kk, 1)} N/m`)} (har ikkalasidan ham yumshoq). Birlashma nuqtasi yukning ${sq(`k₂/(k₁+k₂) = ${fmt(jointShare(P.k1, P.k2) * 100, 0)}%`)} qadar siljiydi.</p>`);
  if (!vert && !driven && P.b === 0 && Math.abs(s.x) < 1e-9 && Math.abs(s.v) < 1e-9) parts.push("<p>Yuk muvozanatda. Uni sudrab siljiting yoki boshlang‘ich siljish/tezlikni tanlang.</p>");
  else if (!driven && P.b === 0) parts.push(`<p>Ishqalanish yo‘q: to‘liq energiya ${sq("E = kA²/2 = " + sci(0.5 * kk * A * A, 3) + " J")} o‘zgarmaydi, amplituda ${sq("A = " + fmt(A * 100, 1) + " sm")}. Kinetik va potensial energiya bir-biriga aylanadi; muvozanatda tezlik eng katta (${sq("v = Aω₀ = " + fmt(A * W0, 2) + " m/s")}). Davr amplitudaga bog‘liq emas.</p>`);
  if (P.b > 0) {
    const txt = R.type === "under" ? `Susayuvchi tebranish: amplituda ${sq("e<sup>−γt/2</sup>")} qonuni bilan kamayadi (har <b>${fmt(2 / R.gamma, 1)} s</b> da e marta), davr biroz uzayadi ${sq(`T = ${fmt(R.T, 3)} s`)}, ${sq(`Q = ${fmt(R.Q, 1)}`)}.`
      : R.type === "critical" ? `<b>Kritik so‘nish</b> (${sq("b = 2√(km) = " + fmt(R.bc, 1) + " kg/s")}): yuk tebranmasdan, eng tez muvozanatga qaytadi.`
        : `<b>Kuchli so‘nish</b> (${sq("b &gt; 2√(km) = " + fmt(R.bc, 1))}): tebranish yo‘q, yuk sekin muvozanatga “sudralib” qaytadi.`;
    parts.push(`<p>${txt}</p>`);
  }
  if (driven) {
    const r = P.ratio, Ast = steadyAmplitude(kk, m, P.b, P.F, Om());
    parts.push(`<p>Tashqi kuch ${sq(`F₀ = ${fmt(P.F, 1)} N`)}, chastota ${sq(`Ω = ${fmt(r, 2)} ω₀ = ${fmt(Om(), 2)} rad/s`)}. ${Math.abs(r - 1) < 0.08 ? "<b>Rezonans!</b> Chastotalar mos kelganda amplituda eng tez o‘sadi" + (P.b > 0 ? ", so‘nish uni " + sq("A = F₀/(bΩ) = " + fmt(Ast * 100, 1) + " sm") + " da cheklaydi." : "; ishqalanishsiz u cheksiz o‘sadi (animatsiya chegarada to‘xtaydi).") : r < 1 ? "Kuch chastotasi tabiiy chastotadan past — yuk kuchga deyarli “ergashadi”." : "Kuch chastotasi tabiiy chastotadan yuqori — yuk ulgurmaydi, amplituda kichik."}${Number.isFinite(Ast) && Math.abs(r - 1) >= 0.08 ? " Turg‘un amplituda " + sq(fmt(Ast * 100, 1) + " sm") + "." : ""}</p>`);
  }
  if (vert && Math.abs(P.g - 9.81) > 0.01) parts.push(`<p>Bu sayyorada ${sq("g = " + fmt(P.g, 2) + " m/s²")}: Yerdagi ${fmt(9.81 / kk * m * 100, 1)} sm o‘rniga <b>Δl = ${fmt(dl * 100, 1)} sm</b>, ammo davr o‘sha-o‘sha ${sq(fmt(t0, 3) + " s")}.</p>`);
  parts.push(`<p class="of-subtle">Sinab ko‘ring: massani 4 marta oshirsangiz davr 2 marta ortadi; qattiqlikni 4 marta oshirsangiz 2 marta kamayadi.</p>`);
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }

  // Ulanish haqida eslatma
  const keff = $("[data-keff]");
  keff.hidden = P.link === "single";
  if (P.link !== "single") keff.textContent = `Ekvivalent qattiqlik k = ${fmt(kk, P.link === "series" ? 1 : 0)} N/m`;

  stage.canvas.setAttribute("aria-label", `Prujinali mayatnik, ${vert ? "vertikal" : "gorizontal"}: k = ${fmt(kk, 1)} N/m, m = ${fmt(m, 2)} kg. Siljish ${fmt(s.x * 100, 1)} sm, davr ${fmt(t0, 3)} s.`);
  setPlayButton();
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { height: (w) => splitHeights(w).stage });
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => splitHeights(w).graph });
const canvas = stage.canvas;
const playBtn = $("[data-play]");

function renderAll() { stage.render(); graph.render(); }

function setPlayButton() {
  const running = loop.running;
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : s.t > 0 && !flag ? "Davom ettirish" : "Boshlash";
}

function physicsStep(dt) {
  const p = params(), sd = sampleDt();
  s = advance(s, p, dt, (a, b) => {
    meter.feed(a, b);
    if (b.t - lastSample >= sd) sample(b);
  });
  Aview = Math.max(Aview, Math.min(X_LIMIT, 1.08 * Math.abs(s.x)));
}

const loop = createLoop((dt) => {
  physicsStep(dt * ui.speed);
  if (Math.abs(s.x) > X_LIMIT) { flag = "limit"; loop.stop(); }
  else if (!P.driveOn && amplitudeOf(s.x, s.v, w0()) < 2e-4 && P.b > 0) { flag = "rest"; loop.stop(); }
  renderAll();
  updateUI();
}, { onStateChange: () => { setPlayButton(); updateUI(); } });

function afterChange({ keepRunning = true } = {}) {
  syncV0Range();
  resetSim({ keepRunning: keepRunning && loop.running });
  renderAll();
  updateUI();
}

playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (flag) resetSim();
  loop.start();
});
$("[data-reset]").addEventListener("click", () => { afterChange({ keepRunning: false }); });
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));

/* Slayderlar */
const x0El = $("#x0"), v0El = $("#v0");
const x0Ctl = bindRange(x0El, $("#x0Out"), (v) => `${fmt(v, 1)} sm`, (v) => { init.x = v / 100; afterChange(); });
const v0Ctl = bindRange(v0El, $("#v0Out"), (v) => `${fmt(v, 2)} m/s`, (v) => { init.v = v; afterChange(); });
const k1Ctl = bindRange($("#k1"), $("#k1Out"), (v) => `${fmt(v, 0)} N/m`, (v) => { P.k1 = v; afterChange(); });
const k2Ctl = bindRange($("#k2"), $("#k2Out"), (v) => `${fmt(v, 0)} N/m`, (v) => { P.k2 = v; afterChange(); });
const mCtl = bindRange($("#m"), $("#mOut"), (v) => `${fmt(v, 2)} kg`, (v) => { P.m = v; afterChange(); });
const bCtl = bindRange($("#b"), $("#bOut"), (v) => (v === 0 ? "yo‘q" : `${fmt(v, 1)} kg/s`), (v) => { P.b = v; afterChange(); });
const fCtl = bindRange($("#driveF"), $("#driveFOut"), (v) => `${fmt(v, 1)} N`, (v) => { P.F = v; afterChange(); });
const rCtl = bindRange($("#driveR"), $("#driveROut"), (v) => `${fmt(v, 2)} ω₀`, (v) => { P.ratio = v; afterChange(); });
const linkSel = $("#link"), planet = $("#planet"), gOut = $("#gOut");

function syncV0Range() {
  const vMax = Math.max(0.2, Math.round(w0() * 0.25 * 20) / 20);
  v0El.min = String(-vMax); v0El.max = String(vMax); v0El.step = vMax > 1.5 ? "0.1" : "0.05";
  init.v = clamp(init.v, -vMax, vMax);
  v0Ctl.set(init.v);
}
function syncLinkUI() {
  linkSel.value = P.link;
  $("[data-k2-panel]").hidden = P.link === "single";
  $("[data-k1-label]").textContent = P.link === "single" ? "Qattiqlik k" : "1-prujina qattiqligi k₁";
}
linkSel.addEventListener("change", () => { P.link = linkSel.value; syncLinkUI(); afterChange(); });
const syncG = () => { gOut.textContent = `${fmt(P.g, 2)} m/s²`; planet.value = String(P.g); };
planet.addEventListener("change", () => { P.g = Number(planet.value); syncG(); renderAll(); updateUI(); });

function setDrive(on) {
  P.driveOn = on;
  document.querySelector('[data-toggle="drive"]').checked = on;
  document.querySelectorAll("[data-drive-panel]").forEach((el) => { el.hidden = !on; });
}

/* Rejim: gorizontal ↔ vertikal (holat saqlanadi) */
function setMode(mode) {
  P.mode = mode;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === mode)));
  renderAll(); updateUI();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.modeValue)));

/* Tayyor holatlar */
const BASE = { mode: "horizontal", link: "single", k1: 25, k2: 60, m: 1, x: 12, v: 0, b: 0, g: 9.81, drive: false, F: 0.8, ratio: 1 };
const PRESETS = {
  free:      {},
  hang:      { mode: "vertical" },
  moon:      { mode: "vertical", g: 1.62 },
  parallel:  { link: "parallel", k1: 40, k2: 60, x: 10 },
  series:    { link: "series", k1: 40, k2: 60 },
  damped:    { b: 1, x: 15 },
  critical:  { b: 10, x: 15 },
  resonance: { b: 1, x: 0, drive: true, F: 0.8, ratio: 1 },
};
function applyPreset(key) {
  const q = { ...BASE, ...PRESETS[key] };
  Object.assign(P, { link: q.link, k1: q.k1, k2: q.k2, m: q.m, b: q.b, g: q.g, F: q.F, ratio: q.ratio });
  init.x = q.x / 100; init.v = q.v;
  k1Ctl.set(q.k1); k2Ctl.set(q.k2); mCtl.set(q.m); bCtl.set(q.b); x0Ctl.set(q.x); fCtl.set(q.F); rCtl.set(q.ratio);
  syncLinkUI(); syncG(); setDrive(q.drive);
  syncV0Range();
  setMode(q.mode);
  resetSim();
  renderAll(); updateUI();
  loop.start();
}
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  const key = cb.dataset.toggle;
  if (key === "drive") { setDrive(cb.checked); afterChange(); return; }
  ui.show[key] = cb.checked;
  renderAll();
}));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = Number(b.dataset.speedValue);
  document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));

/* Grafik turlari */
function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab-value]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tabValue === tab)));
  $("[data-graph-title]").textContent = TABS[tab][0];
  $("[data-graph-sub]").textContent = TABS[tab][1];
  graph.canvas.dataset.clickable = String(tab === "phase" || tab === "period");
  graph.canvas.setAttribute("aria-label", TABS[tab][0]);
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* Grafikda bosib parametr tanlash: faza portreti -> (x, v); T(m) -> m */
graph.canvas.addEventListener("pointerdown", (e) => {
  const r = graph.canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  if (ui.tab === "phase") {
    const q = phasePlot.toState(px, py);
    if (!q) return;
    init.x = clamp(Math.round(q.x * 200) / 200, -0.25, 0.25);
    syncV0Range();
    const vMax = Number(v0El.max);
    init.v = clamp(Math.round(q.v * 20) / 20, -vMax, vMax);
    x0Ctl.set(Math.round(init.x * 1000) / 10); v0Ctl.set(init.v);
    resetSim(); renderAll(); updateUI(); loop.start();
  } else if (ui.tab === "period") {
    const m = periodMassFromPointer(px, py);
    if (m === null) return;
    P.m = clamp(Math.round(m * 20) / 20, 0.1, 3);
    mCtl.set(P.m);
    afterChange({ keepRunning: false }); loop.start();
  }
});

/* Yukni sudrash (harakat o'qi bo'ylab) */
let drag = null;
const axisCoord = (e) => {
  const r = canvas.getBoundingClientRect();
  return view.vert ? (e.clientY - r.top - view.anchor) / view.s : (e.clientX - r.left - view.anchor) / view.s;
};
function blockRect() {
  const geoUb = L0 + view.dl + s.x;
  return view.vert
    ? { x: view.cx - view.sidePx / 2, y: view.anchor + view.s * geoUb, w: view.sidePx, h: view.sidePx }
    : { x: view.anchor + view.s * geoUb, y: view.cy - view.sidePx / 2, w: view.sidePx, h: view.sidePx };
}
function overBlock(e) {
  const r = canvas.getBoundingClientRect(), b = blockRect(), px = e.clientX - r.left, py = e.clientY - r.top, pad = 12;
  return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
}
canvas.addEventListener("pointerdown", (e) => {
  if (!view || !overBlock(e)) return;
  drag = { grab: axisCoord(e) - (L0 + view.dl + s.x + view.side / 2) };
  loop.stop();
  canvas.dataset.dragging = "true";
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!view) return;
  if (drag) {
    const x = clamp(axisCoord(e) - drag.grab - L0 - view.dl - view.side / 2, -0.25, 0.25);
    init.x = Math.round(x * 400) / 400; init.v = 0;
    x0Ctl.set(Math.round(init.x * 1000) / 10); v0Ctl.set(0);
    const keep = Aview;
    resetSim();
    Aview = Math.max(keep, Aview, clamp(1.15 * Math.abs(init.x), 0.15, X_LIMIT));
    renderAll(); updateUI();
    return;
  }
  canvas.style.cursor = overBlock(e) ? "grab" : "default";
});
const endDrag = () => {
  if (!drag) return;
  drag = null;
  canvas.dataset.dragging = "false";
  loop.start();
  renderAll();
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Boshlash */
syncG();
syncLinkUI();
syncV0Range();
x0Ctl.set(init.x * 100);
resetSim();
setTab("x");
updateUI();
renderAll();
document.fonts?.ready.then(renderAll);
