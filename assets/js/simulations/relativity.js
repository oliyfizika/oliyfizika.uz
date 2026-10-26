// ==========================================================================
// Maxsus nisbiylik nazariyasi — simulyatsiya (simulations/relativity.html)
// 1) Vaqt va uzunlik: Yerda tinch turgan va uchayotgan bir xil raketalar (Yer sanoq tizimida). Ichida yorug'lik soati:
//    uchayotgan soatda yorug'lik qiya yo'l bosadi — tik γ marta uzun; raketa harakat yo'nalishida L₀/γ ga qisqargan.
//    Myuonlar: tog' cho'qqisidan dengiz sathigacha tushayotgan myuonlar — klassik kutilgan va haqiqiy oqim, hisoblagichlar.
//    Tezlik sahnadagi spidometr strelkasini surib o'zgartiriladi. Grafik γ(v) yoki N/N₀(h).
// 2) Tezliklarni qo'shish: poyezd (v) tomidan snaryad yoki yorug'lik (u′) otiladi; Yerga nisbatan u — Eynshteyn bo'yicha,
//    xira «Galiley» snaryadi — klassik qo'shish bo'yicha. Grafik u(u′).
// 3) Massa va energiya: Bertozzi tajribasi — tezlatkich, 8,4 m uchish yo'li, ossillograf, o'lchash jadvali. Grafik v/c (K).
// Fizika: relativity-physics.js (Node'da tekshirilgan: t_relativity.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, arrow, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn, noise } from "./labkit.js";
import * as P from "./relativity-physics.js";
import { drawGamma, drawMuon, drawAdd, drawBert, lastFrame } from "./relativity-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "time", hover: null };
const tm = { tool: "clock", b: 0.8, T: 0, T0: 0, mu: [], spawn: 0, total: 0, nA: 0, nB: 0 };
const ad = { v: 0.5, u: 0.5, T: 0 };
const en = { part: "e", K: 1.5, T: 0, pts: [], n: 0 };
let presetId = null, playing = true;
const geo = {};

const D_CLOCK = 3, L0 = 100;           // yorug'lik soati: ko'zgular orasi 3 m; raketa uzunligi 100 m
const REST_TICK = 1.6;                  // tinch soat tiki ekranda, s
const H_MOUNT = 1907, FLIGHT = 8.4;     // Vashington tog'i (Frisch–Smith), Bertozzi uchish yo'li
const RANGE = { e: [-2, 1.3], p: [0, 4.3] };
const part = () => P.PARTICLES[en.part];
const tick0 = () => P.lightClock(D_CLOCK, 0).t0;

/** Kichik: c birligidagi tezlik */
const cfmt = (b, d = 3) => `${fmt(b, d)}c`;
const kmS = (b) => `${fmt((b * P.C) / 1000, 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km/s`;
const kfmt = (K) => (K >= 1000 ? `${fmt(K / 1000, K >= 10000 ? 1 : 2)} GeV` : K >= 1 ? `${fmt(K, K >= 100 ? 0 : 2)} MeV` : `${fmt(K * 1000, K >= 0.1 ? 0 : 1)} keV`);
const ufmt = (K) => (K >= 1000 ? `${fmt(K / 1000, K >= 10000 ? 1 : 2)} GV` : K >= 1 ? `${fmt(K, K >= 100 ? 0 : 2)} MV` : `${fmt(K * 1000, K >= 0.1 ? 0 : 1)} kV`);

/* Tasodifiy sonlar (deterministik) */
const rnd = (() => { let s = 11; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

/* ------------------------------------------------------------------ Umumiy asboblar */

/** Spidometr (yarim doira): frac 0…1; ticks [[frac, matn]]; qaytaradi bosish sohasi */
function dial(ctx, c, cx, cy, R, frac, { label = "", value = "", ticks = [], red = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = c.dark ? "#1e293b" : "#f8fafc"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R + 6, Math.PI, TAU); ctx.lineTo(cx + R + 6, cy + 8); ctx.lineTo(cx - R - 6, cy + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  const A = (f) => Math.PI + f * Math.PI;
  if (red) { ctx.strokeStyle = "rgba(239,68,68,0.55)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, R - 4, A(red), A(1)); ctx.stroke(); }
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.fillStyle = c.text2; ctx.font = "600 8px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let k = 0; k <= 20; k++) { const a = A(k / 20), r0 = R - (k % 5 ? 4 : 8); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
  if (R >= 34) for (const [f, t] of ticks) { const a = A(f); ctx.fillText(t, cx + Math.cos(a) * (R - 15), cy + Math.sin(a) * (R - 15)); }
  const an = A(clamp(frac, 0, 1));
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an) * (R - 3), cy + Math.sin(an) * (R - 3)); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * (R - 3), cy + Math.sin(an) * (R - 3), 4.5, 0, TAU); ctx.fill();
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill();
  ctx.font = "italic 700 11px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text; ctx.textBaseline = "bottom"; ctx.fillText(label, cx, cy - 7);
  if (value) { ctx.font = BOLD; ctx.fillStyle = c.primary; ctx.textBaseline = "top"; ctx.fillText(value, cx, cy + 10); }
  ctx.restore();
  return { x: cx, y: cy, R };
}
const fracFrom = (g, p) => { let a = Math.atan2(p.y - g.y, p.x - g.x); if (a > 0) a = p.x < g.x ? -Math.PI : 0; return clamp((a + Math.PI) / Math.PI, 0, 1); };
const onDial = (g, p) => g && Math.hypot(p.x - g.x, p.y - g.y) <= g.R + 10 && p.y <= g.y + 14;
const SPEED_TICKS = [[0, "0"], [0.5, "0,5"], [1, "c"]];

/** Raketa: (x, y) — orqa-yuqori burchak, L — tinch uzunlik, k = 1/γ (gorizontal qisqarish). Yorug'lik soati markazi x qaytariladi. */
function rocket(ctx, c, x, y, L, Hh, k, { flame = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, 1);
  if (flame > 0) {
    const fl = 14 + flame * 26, g = ctx.createLinearGradient(-fl, 0, 0, 0); g.addColorStop(0, "rgba(251,146,60,0)"); g.addColorStop(1, "rgba(251,191,36,0.95)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, Hh * 0.28); ctx.quadraticCurveTo(-fl * 0.6, Hh * 0.35, -fl, Hh / 2); ctx.quadraticCurveTo(-fl * 0.6, Hh * 0.65, 0, Hh * 0.72); ctx.fill();
  }
  // stabilizatorlar
  ctx.fillStyle = c.dark ? "#b91c1c" : "#dc2626";
  ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(L * 0.17, 4); ctx.lineTo(L * 0.05, -10); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, Hh - 4); ctx.lineTo(L * 0.17, Hh - 4); ctx.lineTo(L * 0.05, Hh + 10); ctx.lineTo(0, Hh + 10); ctx.closePath(); ctx.fill();
  // korpus (metall)
  const g = ctx.createLinearGradient(0, 0, 0, Hh);
  (c.dark ? ["#94a3b8", "#e2e8f0", "#cbd5e1", "#64748b"] : ["#cbd5e1", "#f8fafc", "#e2e8f0", "#94a3b8"]).forEach((col, i) => g.addColorStop(i / 3, col));
  ctx.fillStyle = g; ctx.strokeStyle = c.dark ? "#475569" : "#64748b"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(L * 0.78, 0); ctx.quadraticCurveTo(L * 0.95, 2, L, Hh / 2); ctx.quadraticCurveTo(L * 0.95, Hh - 2, L * 0.78, Hh); ctx.lineTo(6, Hh); ctx.quadraticCurveTo(0, Hh, 0, Hh - 6); ctx.lineTo(0, 6); ctx.quadraticCurveTo(0, 0, 6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "#2563eb" : "#1d4ed8"; ctx.fillRect(L * 0.08, 0.5, L * 0.03, Hh - 1);
  // illyuminatorlar
  for (const wx of [0.6, 0.69]) { ctx.fillStyle = "#0ea5e9"; ctx.strokeStyle = c.dark ? "#334155" : "#475569"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(L * wx, Hh * 0.36, 6, 0, TAU); ctx.fill(); ctx.stroke(); }
  // yorug'lik soati: ichki bo'lma va ko'zgular
  const cx = L * 0.36;
  ctx.fillStyle = c.dark ? "rgba(15,23,42,0.85)" : "rgba(15,23,42,0.88)"; ctx.fillRect(cx - 20, 3, 40, Hh - 6);
  ctx.fillStyle = "#e5e7eb"; ctx.fillRect(cx - 15, 5, 30, 3); ctx.fillRect(cx - 15, Hh - 8, 30, 3);
  ctx.restore();
  return { cx: x + cx * k, top: y + 8, bot: y + Hh - 8 };
}
function photon(ctx, x, y, r = 4) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, "rgba(254,240,138,1)"); g.addColorStop(0.35, "rgba(250,204,21,0.8)"); g.addColorStop(1, "rgba(250,204,21,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
}
/** O'lcham chizig'i */
function dim(ctx, c, x0, x1, y, text) {
  ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y - 5); ctx.lineTo(x0, y + 5); ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.restore();
  tag(ctx, text, (x0 + x1) / 2, y, { color: c.text, bg: c.bg2, align: "center", font: SMALL, pad: 5 });
}

/* ------------------------------------------------------------------ 1a. Yorug'lik soati */

const clockGeo = (w) => { const narrow = w < 560; return { narrow, Lr: narrow ? Math.min(w * 0.52, 200) : Math.min(260, w * 0.34), Hh: 58 }; };
function drawClock(ctx, c, w, h) {
  const { narrow, Lr, Hh } = clockGeo(w), b = tm.b, g = P.gamma(b), k = 1 / g;
  const Hm = Hh - 16, cpx = (2 * Hm) / REST_TICK, T = tm.T;
  // panel ajratgich
  const yTop = 30, yMid = Math.round(h * 0.44), ground = h - 34, yMov = ground - Hh - 16;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.05)" : "rgba(241,245,249,0.7)"; ctx.fillRect(0, 0, w, yMid);
  ctx.strokeStyle = c.border; ctx.beginPath(); ctx.moveTo(0, yMid + 0.5); ctx.lineTo(w, yMid + 0.5); ctx.stroke();
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(narrow ? "Tinch raketa" : "Yerda tinch turgan raketa", 12, 8);
  ctx.fillText(narrow ? "Uchayotgan raketa" : "Xuddi shunday raketa v tezlik bilan uchmoqda (Yerdan qaraganda)", 12, yMid + 8);
  // tinch raketa
  const xr0 = 18 + 0, rr = rocket(ctx, c, xr0, yTop, Lr, Hh, 1);
  const s0 = (T * cpx) % (2 * Hm), py0 = rr.bot - (s0 < Hm ? s0 : 2 * Hm - s0);
  ctx.strokeStyle = "rgba(250,204,21,0.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(rr.cx, rr.top); ctx.lineTo(rr.cx, rr.bot); ctx.stroke();
  photon(ctx, rr.cx, py0);
  dim(ctx, c, xr0, xr0 + Lr, yTop + Hh + 18, `L₀ = ${fmt(L0, 0)} m`);
  const n0 = Math.floor((T * cpx) / (2 * Hm)), nM = Math.floor((T * cpx) / (g * 2 * Hm));
  tag(ctx, `${n0} tik`, xr0 + Lr + 10, yTop + Hh / 2, { color: c.text, bg: c.bg2, font: BOLD });
  // spidometr
  const R = narrow ? 32 : 44;
  geo.dial = dial(ctx, c, w - R - 16, yMid - 16, R, b, { label: "v/c", value: narrow ? cfmt(b, 2) : `v = ${cfmt(b)}`, ticks: SPEED_TICKS, red: 0.9 });
  // yer va chizg'ich (100 m = Lr px)
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(0, ground, w, h - ground);
  ctx.strokeStyle = c.text2; ctx.fillStyle = c.text2; ctx.font = "600 9px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.lineWidth = 1;
  const pxm = Lr / L0;
  for (let m = 0, x = 18; x < w; m += 10, x += 10 * pxm) { const big = m % 50 === 0; ctx.beginPath(); ctx.moveTo(x + 0.5, ground); ctx.lineTo(x + 0.5, ground + (big ? 9 : 5)); ctx.stroke(); if (big) ctx.fillText(`${m}`, x, ground + 11); }
  ctx.textAlign = "right"; ctx.fillText("m", w - 4, ground + 11);
  // uchayotgan raketa
  if ((tm.T0 > T) || 18 + b * cpx * (T - tm.T0) > w + 10) tm.T0 = T;
  const xr = 18 + b * cpx * (T - tm.T0);
  // yorug'lik izi (Yer sanoq tizimida qiya yo'l)
  const Lm = Lr * k, ccx = Lr * 0.36 * k, yt = yMov + 8, yb = yMov + Hh - 8;
  const yAt = (t) => { const s = ((t * cpx) / g) % (2 * Hm); return yb - (s < Hm ? s : 2 * Hm - s); };
  ctx.strokeStyle = "rgba(250,204,21,0.85)"; ctx.lineWidth = 1.6; ctx.beginPath();
  const N = 160; for (let i = 0; i <= N; i++) { const t = tm.T0 + ((T - tm.T0) * i) / N, x = 18 + b * cpx * (t - tm.T0) + ccx; if (i) ctx.lineTo(x, yAt(t)); else ctx.moveTo(x, yAt(t)); }
  ctx.stroke();
  const mr = rocket(ctx, c, xr, yMov, Lr, Hh, k, { flame: b });
  photon(ctx, mr.cx, yAt(T));
  if (b > 0.02) arrow(ctx, xr + Lm + 8, yMov + Hh / 2, Math.min(70, 20 + 60 * b), 0, c.primary, { width: 2.5, head: 9, label: "v", labelColor: c.primary });
  dim(ctx, c, xr, xr + Lm, yMov - 14, Lm > 60 ? `L = ${fmt(contracted(), 1)} m` : `${fmt(contracted(), 1)} m`);
  tag(ctx, `${nM} tik`, clamp(xr + Lm / 2, 30, w - 30), yMov + Hh + 12, { color: c.text, bg: c.bg2, font: BOLD, align: "center" });
  // Yer soati
  const tNs = (T / REST_TICK) * tick0() * 1e9;
  tag(ctx, `Yer soati: t = ${fmt(tNs, 0)} ns`, narrow ? w - 8 : w - 12, yMid + 30, { color: c.text, bg: c.bg2, font: MID, align: "right" });
}
const contracted = () => P.contracted(L0, tm.b);

/* ------------------------------------------------------------------ 1b. Myuonlar */

const fallWall = () => 2.4 / Math.max(tm.b, 0.05);
function stepMuons(dt) {
  const b = tm.b, fw = fallWall(), tPhys = H_MOUNT / (b * P.C), g = P.gamma(b);
  tm.spawn += dt;
  while (tm.spawn > 0.06) { tm.spawn -= 0.06; tm.mu.push({ T0: tm.T, x: rnd(), tau: (-P.MUON.T_HALF / Math.LN2) * Math.log(1 - rnd()) }); }
  tm.mu = tm.mu.filter((m) => {
    const f = (tm.T - m.T0) / fw;
    if (f < 1) return true;
    tm.total++; if (m.tau > tPhys) tm.nA++; if (m.tau * g > tPhys) tm.nB++;
    return false;
  });
}
function drawMuons(ctx, c, w, h) {
  const narrow = w < 560, b = tm.b, g = P.gamma(b), fw = fallWall(), tPhys = H_MOUNT / (b * P.C);
  const top = 46, sea = h - 30;
  // osmon
  const sky = ctx.createLinearGradient(0, 0, 0, sea);
  sky.addColorStop(0, c.dark ? "#0b1530" : "#bfdbfe"); sky.addColorStop(1, c.dark ? "#1e293b" : "#eff6ff");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, sea);
  // tog'
  const mx = narrow ? 0.22 * w : 0.24 * w;
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8";
  ctx.beginPath(); ctx.moveTo(-10, sea); ctx.lineTo(mx * 0.35, top + 40); ctx.lineTo(mx * 0.62, top + 4); ctx.lineTo(mx * 0.8, top + 22); ctx.lineTo(mx * 1.15, sea); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.moveTo(mx * 0.52, top + 16); ctx.lineTo(mx * 0.62, top + 4); ctx.lineTo(mx * 0.71, top + 13); ctx.lineTo(mx * 0.64, top + 11); ctx.closePath(); ctx.fill();
  // dengiz
  ctx.fillStyle = c.dark ? "#0c4a6e" : "#38bdf8"; ctx.fillRect(0, sea, w, h - sea);
  // balandlik shkalasi
  ctx.strokeStyle = c.text3; ctx.fillStyle = c.text2; ctx.font = "600 9px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineWidth = 1;
  const Y = (hm) => sea - (hm / H_MOUNT) * (sea - top);
  for (let hm = 0; hm <= H_MOUNT; hm += 500) { ctx.beginPath(); ctx.moveTo(4, Y(hm)); ctx.lineTo(10, Y(hm)); ctx.stroke(); ctx.fillText(`${hm} m`, 12, Y(hm)); }
  tag(ctx, `${H_MOUNT} m`, 6, top - 14, { color: c.text, bg: c.bg2, font: SMALL });
  // ikki oqim
  const laneW = narrow ? 60 : 92, xA = narrow ? w * 0.27 : w * 0.38, xB = narrow ? w * 0.27 + laneW + 12 : w * 0.38 + laneW + 30;
  const lanes = [[xA, false, "klassik kutilgan", c.danger], [xB, true, "haqiqatda", c.success]];
  for (const [x, rel, lab, col] of lanes) {
    ctx.fillStyle = c.dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.45)"; ctx.fillRect(x, top, laneW, sea - top);
    // detektorlar (ssintillyator)
    ctx.fillStyle = c.dark ? "#475569" : "#64748b"; ctx.fillRect(x - 4, top - 8, laneW + 8, 8); ctx.fillRect(x - 4, sea - 8, laneW + 8, 8);
    ctx.fillStyle = col; ctx.fillRect(x - 4, sea - 8, laneW + 8, 2);
    tag(ctx, lab, x + laneW / 2, top - 22, { color: "#fff", bg: col, font: SMALL, align: "center", pad: 5 });
    const decayF = (m) => (rel ? m.tau * g : m.tau) / tPhys;
    for (const m of tm.mu) {
      const f = (tm.T - m.T0) / fw, df = decayF(m), px = x + 6 + m.x * (laneW - 12);
      if (f < df) { ctx.fillStyle = c.dark ? "#a78bfa" : "#7c3aed"; ctx.beginPath(); ctx.arc(px, top + f * (sea - top - 8), 3, 0, TAU); ctx.fill(); }
      else if (f - df < 0.08) { const py = top + df * (sea - top - 8), r = 3 + (f - df) * 70; ctx.strokeStyle = "rgba(251,146,60,0.9)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke(); }
    }
    const n = rel ? tm.nB : tm.nA;
    tag(ctx, `${n} / ${tm.total}`, x + laneW / 2, sea + 14, { color: c.text, bg: c.bg2, font: BOLD, align: "center" });
  }
  // myuon sanoq tizimida tog' balandligi
  if (!narrow) {
    const xh = xB + laneW + 44, hOwn = H_MOUNT / g;
    ctx.strokeStyle = c.special; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xh, sea); ctx.lineTo(xh, sea - (hOwn / H_MOUNT) * (sea - top)); ctx.stroke();
    ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(xh, top); ctx.lineTo(xh, sea); ctx.stroke(); ctx.setLineDash([]);
    tag(ctx, `myuon uchun: ${fmt(hOwn, 0)} m`, xh + 8, sea - (hOwn / H_MOUNT) * (sea - top) - 2, { color: c.special, bg: c.bg2, font: SMALL });
  }
  const R = narrow ? 30 : 40;
  geo.dial = dial(ctx, c, w - R - 14, top + R + 8, R, b, { label: "v/c", value: cfmt(b, 3), ticks: SPEED_TICKS, red: 0.9 });
  ctx.fillStyle = c.dark ? "#a78bfa" : "#7c3aed"; ctx.beginPath(); ctx.arc(w - 2 * R - 10, top + R + 44, 3, 0, TAU); ctx.fill();
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("myuon", w - 2 * R - 4, top + R + 44);
  ctx.strokeStyle = "rgba(251,146,60,0.9)"; ctx.beginPath(); ctx.arc(w - 2 * R - 10, top + R + 60, 4, 0, TAU); ctx.stroke(); ctx.fillText("yemirildi", w - 2 * R - 4, top + R + 60);
}

/* ------------------------------------------------------------------ 2. Tezliklarni qo'shish */

const addGeo = (w) => { const narrow = w < 560; return { narrow, Ltr: narrow ? Math.min(220, w * 0.55) : Math.min(360, w * 0.46), cpx: w / 4.5 }; };
const addCycleOver = (w) => { const { Ltr, cpx } = addGeo(w), u = P.addVel(ad.v, ad.u); return 20 + Ltr * 0.08 / P.gamma(ad.v) + u * cpx * ad.T > w + 30 || ad.T > 7; };
function train(ctx, c, x, y, L, Hc, k) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, 1);
  ctx.fillStyle = c.dark ? "#1d4ed8" : "#2563eb"; ctx.strokeStyle = c.dark ? "#1e3a8a" : "#1e40af"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(0, 0, L * 0.88, Hc, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.88, 0); ctx.quadraticCurveTo(L, 4, L, Hc); ctx.lineTo(L * 0.88, Hc); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, Hc * 0.62, L, 4);
  ctx.fillStyle = c.dark ? "#93c5fd" : "#bfdbfe";
  for (let i = 0; i < 6; i++) ctx.fillRect(L * (0.06 + i * 0.13), Hc * 0.18, L * 0.09, Hc * 0.32);
  ctx.fillStyle = "#334155";
  for (const wx of [0.1, 0.22, 0.66, 0.78]) { ctx.beginPath(); ctx.arc(L * wx, Hc + 3, 6, 0, TAU); ctx.fill(); }
  // tomdagi to'p (yoki chiroq)
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(L * 0.03, -10, L * 0.07, 10); ctx.fillRect(L * 0.07, -8, L * 0.06, 5);
  ctx.restore();
  return { muzzle: x + L * 0.13 * k, y: y - 6 };
}
function drawAdd2(ctx, c, w, h) {
  const { narrow, Ltr, cpx } = addGeo(w), v = ad.v, u1 = ad.u, g = P.gamma(v), k = 1 / g, u = P.addVel(v, u1), uG = P.addGal(v, u1), T = ad.T;
  const rail = h - 40, Hc = 50, light = u1 >= 0.999;
  // fon: osmon va platforma
  const sky = ctx.createLinearGradient(0, 0, 0, rail); sky.addColorStop(0, c.dark ? "#0f172a" : "#e0f2fe"); sky.addColorStop(1, c.dark ? "#1e293b" : "#f8fafc");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, rail);
  ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.fillRect(0, rail + 8, w, 4);
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(0, rail + 12, w, h - rail - 12);
  ctx.fillStyle = c.dark ? "#64748b" : "#78716c"; for (let x = 0; x < w; x += 24) ctx.fillRect(x, rail + 12, 12, 4);
  // Yerdagi kuzatuvchi
  const ox = narrow ? w - 24 : w - 40, oy = rail + 6;
  ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy - 40, 6, 0, TAU); ctx.moveTo(ox, oy - 34); ctx.lineTo(ox, oy - 16); ctx.moveTo(ox, oy - 16); ctx.lineTo(ox - 6, oy); ctx.moveTo(ox, oy - 16); ctx.lineTo(ox + 6, oy); ctx.moveTo(ox - 8, oy - 28); ctx.lineTo(ox + 8, oy - 28); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("Yer", ox, oy - 50);
  // poyezd
  const x0 = 20, xt = x0 + v * cpx * T, tr = train(ctx, c, xt, rail - Hc - 4, Ltr, Hc, k);
  if (v > 0.01) { const ax0 = xt + Ltr * k * 0.5 - 30, al = Math.min(80, 20 + 70 * v); arrow(ctx, ax0, rail + 26, al, 0, c.primary, { width: 2.5, head: 9 }); ctx.font = BOLD; ctx.fillStyle = c.primary; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(narrow ? "v" : `v = ${cfmt(v, 2)}`, ax0 + al + 6, rail + 26); }
  // snaryad: Eynshteyn va Galiley bo'yicha
  const xs0 = x0 + Ltr * 0.13 * k, xp = xs0 + u * cpx * T, xg = xs0 + uG * cpx * T, yp = tr.y - 6;
  if (xg < w + 10) { ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(xg, yp - 26, light ? 6 : 5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); tag(ctx, narrow ? `G: ${cfmt(uG, 2)}` : `Galiley: ${cfmt(uG, 2)}${uG > 1 ? " — imkonsiz" : ""}`, clamp(xg, 60, w - 60), yp - 44, { color: c.text2, bg: c.bg2, font: SMALL, align: "center" }); }
  else tag(ctx, `Galiley: ${cfmt(uG, 2)} →`, w - 8, yp - 44, { color: c.text2, bg: c.bg2, font: SMALL, align: "right" });
  if (light) photon(ctx, xp, yp, 5); else { ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(xp, yp, 5, 0, TAU); ctx.fill(); }
  if (u > 0.01) { ctx.strokeStyle = light ? "rgba(250,204,21,0.6)" : "rgba(220,38,38,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xs0, yp); ctx.lineTo(xp, yp); ctx.stroke(); }
  { ctx.font = BOLD; const tw = ctx.measureText(`u = ${cfmt(u, 3)}`).width + 12; tag(ctx, `u = ${cfmt(u, 3)}`, clamp(xp + 12, 4, w - tw - 4), yp, { color: light ? (c.dark ? "#fde047" : "#854d0e") : c.danger, bg: c.bg2, font: BOLD }); }
  // spidometrlar
  const R = narrow ? 30 : 40, dy = R + 18;
  geo.dV = dial(ctx, c, R + 14, dy, R, v, { label: "v/c", value: cfmt(v, 2), ticks: SPEED_TICKS, red: 0.9 });
  geo.dU = dial(ctx, c, 3 * R + 40, dy, R, u1, { label: "u′/c", value: light ? "c (yorug‘lik)" : cfmt(u1, 2), ticks: SPEED_TICKS, red: 0.9 });
  if (!narrow) tag(ctx, `u = (v + u′)/(1 + vu′/c²) = (${fmt(v, 2)} + ${fmt(u1, 2)})/(1 + ${fmt(v * u1, 3)}) = ${cfmt(u, 3)}`, 4 * R + 70, dy - 10, { color: c.text, bg: c.bg2, font: MID });
}

/* ------------------------------------------------------------------ 3. Massa va energiya (Bertozzi) */

const tofNs = () => P.tof(FLIGHT, P.particle(en.K, part().E0).b) * 1e9;
const SPANS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const span = () => SPANS.find((s) => s >= tofNs() * 1.25) || 20000;
const enPeriod = () => 1.2 / Math.max(0.04, P.particle(en.K, part().E0).b) + 0.8;
function drawEnergy(ctx, c, w, h) {
  const narrow = w < 560, s = P.particle(en.K, part().E0), [lo, hi] = RANGE[en.part];
  // tezlatkich (Van de Graaf)
  const ax = narrow ? 12 : 22, aw = narrow ? 70 : 92, yb = narrow ? 92 : 96;
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(ax + aw * 0.3, 40, aw * 0.4, yb - 30, 4); ctx.fill(); ctx.stroke();
  const dg = ctx.createRadialGradient(ax + aw * 0.42, 22, 4, ax + aw / 2, 30, aw * 0.5); dg.addColorStop(0, "#f8fafc"); dg.addColorStop(1, c.dark ? "#64748b" : "#94a3b8");
  ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(ax + aw / 2, 32, aw * 0.48, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "#1e293b" : "#e2e8f0"; ctx.beginPath(); ctx.roundRect(ax, yb - 14, aw, 30, 4); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(en.part === "e" ? "e⁻ manba" : "p manba", ax + aw / 2, yb + 1);
  // quvur, detektorlar, nishon
  const x1 = ax + aw, xA = x1 + 16, xB = w - (narrow ? 30 : 46);
  ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.fillRect(x1, yb - 5, xB - x1 + 16, 10);
  ctx.fillStyle = c.dark ? "#0f172a" : "#e2e8f0"; ctx.fillRect(x1, yb - 3, xB - x1 + 16, 6);
  for (const [x, l] of [[xA, "A"], [xB, "B"]]) { ctx.fillStyle = c.dark ? "#a16207" : "#ca8a04"; ctx.fillRect(x - 4, yb - 14, 8, 28); ctx.font = BOLD; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(l, x, yb - 16); }
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#64748b"; ctx.fillRect(xB + 10, yb - 16, 6, 32);
  if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText("Al nishon", xB + 16, yb + 18); }
  dim(ctx, c, xA, xB, yb + (narrow ? 26 : 30), "8,4 m");
  // impuls (sekinlashtirilgan): relyativistik va klassik
  const ph = en.T % enPeriod(), L = xB - xA;
  const pos = (beta) => xA + L * Math.min(1.2, (ph * beta) / 1.2);
  const xp = pos(s.b), xc = pos(Math.min(s.bCl, 3));
  if (xc <= xB + 4 && Math.abs(xc - xp) > 4) { ctx.strokeStyle = c.text3; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(xc, yb, 7, 4, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (xp <= xB) { const gg = ctx.createRadialGradient(xp, yb, 0, xp, yb, 12); gg.addColorStop(0, en.part === "e" ? "rgba(56,189,248,1)" : "rgba(244,63,94,1)"); gg.addColorStop(1, "rgba(56,189,248,0)"); ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(xp, yb, 12, 6, 0, 0, TAU); ctx.fill(); }
  // dastak: kinetik energiya (log shkala)
  const R = narrow ? 32 : 44, kx = narrow ? 46 : ax + 58, ky = narrow ? h - 22 : yb + 120;
  const frac = (Math.log10(en.K) - lo) / (hi - lo);
  const tk = []; for (let d = Math.ceil(lo); d <= hi; d++) tk.push([(d - lo) / (hi - lo), d >= 3 ? `${10 ** (d - 3)}G` : d >= 0 ? `${10 ** d}` : `${fmt(10 ** d, -d)}`]);
  geo.dial = dial(ctx, c, kx, ky, R, frac, { label: "K, MeV", value: kfmt(en.K), ticks: tk, red: 0 });
  // tugmalar
  const bx = narrow ? 100 : ax + 128, by = narrow ? yb + 42 : yb + 62;
  geo.meas = chipBtn(ctx, c, bx, by, "O‘lchash", true, narrow ? 76 : 84, 26);
  geo.clear = narrow ? chipBtn(ctx, c, bx + 84, by, "Tozalash", false, 76, 26) : chipBtn(ctx, c, bx, by + 34, "Tozalash", false, 84, 26);
  if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`${en.pts.length} ta nuqta`, bx + 4, by + 68); }
  // ossillograf
  const sx = narrow ? 100 : bx + 112, sy = narrow ? yb + 80 : yb + 50, sw = w - sx - 12, sh = h - sy - 12;
  ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.roundRect(sx - 6, sy - 6, sw + 12, sh + 12, 8); ctx.fill();
  ctx.fillStyle = "#052e16"; ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = "rgba(74,222,128,0.18)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) { const x = sx + (sw * i) / 10; ctx.beginPath(); ctx.moveTo(x + 0.5, sy); ctx.lineTo(x + 0.5, sy + sh); ctx.stroke(); }
  for (let i = 0; i <= 4; i++) { const y = sy + (sh * i) / 4; ctx.beginPath(); ctx.moveTo(sx, y + 0.5); ctx.lineTo(sx + sw, y + 0.5); ctx.stroke(); }
  const S = span(), t = tofNs(), X = (ns) => sx + sw * 0.05 + (ns / S) * sw * 0.9, base = sy + sh * 0.78;
  // yorug'lik chegarasi
  const tc = P.tof(FLIGHT, 1) * 1e9;
  ctx.strokeStyle = "rgba(250,204,21,0.7)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(tc), sy + 4); ctx.lineTo(X(tc), sy + sh - 4); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx, base);
  const pulse = (x0, a) => { ctx.lineTo(x0 - 2, base); ctx.lineTo(x0, base - a); ctx.lineTo(x0 + 3, base); };
  pulse(X(0), sh * 0.55); pulse(X(t), sh * 0.5); ctx.lineTo(sx + sw, base); ctx.stroke();
  ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.fillStyle = "#4ade80"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(`${fmt(S / 10, 0)} ns/bo‘l.`, sx + 4, sy + 3);
  ctx.textAlign = "right"; ctx.fillText(`Δt = ${fmt(t, 1)} ns`, sx + sw - 4, sy + 3);
  if (!narrow) { ctx.fillStyle = "rgba(250,204,21,0.9)"; ctx.textAlign = "left"; ctx.fillText(`c: ${fmt(tc, 1)} ns`, Math.min(X(tc) + 4, sx + sw - 70), sy + sh - 14); }
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "time") (tm.tool === "clock" ? drawClock : drawMuons)(ctx, c, s.w, s.h);
  else if (ui.mode === "add") drawAdd2(ctx, c, s.w, s.h);
  else drawEnergy(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.44, 320, 360)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "time") {
    if (tm.tool === "clock") return drawGamma(ctx, gs, { b: tm.b, hover: ui.hover });
    return drawMuon(ctx, gs, { b: tm.b, H: H_MOUNT, meas: tm.total >= 30 ? tm.nB / tm.total : null, hover: ui.hover });
  }
  if (ui.mode === "add") return drawAdd(ctx, gs, { v: ad.v, u: ad.u, hover: ui.hover });
  const [lo, hi] = RANGE[en.part];
  return drawBert(ctx, gs, { E0: part().E0, K: en.K, lo, hi, pts: en.pts, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  clock: ["Lorens omili γ(v)", "v ≪ c da γ ≈ 1 — klassik mexanika to‘g‘ri. v → c da γ cheksiz o‘sadi: harakatdagi soat γ marta sekin yuradi, jism harakat yo‘nalishida γ marta qisqaradi. Kursor bilan qiymatni o‘qing."],
  muon: ["Dengiz sathiga yetib kelgan myuonlar ulushi N/N₀(h)", "Qizil — vaqt sekinlashmasa kutiladigan ulush, yashil — nisbiylik nazariyasi bashorati. Doiracha — sahnadagi hisoblagich natijasi (30 tadan ko‘p myuon o‘tgach)."],
  add: ["Yerga nisbatan tezlik u(u′)", "Kul rang — Galiley qonuni (u = v + u′), u c dan oshib ketishi mumkin. Ko‘k — Eynshteyn qonuni: har qanday v va u′ < c da u < c, u′ = c bo‘lsa u = c."],
  energy: ["Tezlikning kinetik energiyaga bog‘liqligi v/c (K)", "Kul rang — klassik formula v = √(2K/m₀): K ≈ m₀c²/2 da v = c ga yetadi. Ko‘k — nisbiylik: energiya ortsa ham v doim c dan kichik, chunki massa m = γm₀ o‘sadi. Doirachalar — o‘lchangan nuqtalar. K o‘qi logarifmik."],
};
const tabKey = () => (ui.mode === "time" ? tm.tool : ui.mode);
function setTab() {
  const t = TABS[tabKey()]; ui.hover = null;
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); graph.render();
}

/* ------------------------------------------------------------------ O'lchash jadvali */

const bgrid = $("[data-bert-grid]");
function renderTable() {
  const E0 = part().E0;
  bgrid.innerHTML = `<thead><tr><th scope="col">№</th><th scope="col">K</th><th scope="col">Δt, ns</th><th scope="col">v/c (o‘lch.)</th><th scope="col">v/c (nisb.)</th><th scope="col">v/c (klassik)</th></tr></thead><tbody>${en.pts.map((p, i) => { const s = P.particle(p.K, E0); return `<tr><th scope="row">${i + 1}</th><td>${kfmt(p.K)}</td><td>${fmt(p.t, 1)}</td><td>${fmt(p.b, 3)}</td><td>${fmt(s.b, 3)}</td><td>${fmt(s.bCl, 2)}</td></tr>`; }).join("") || `<tr><td colspan="6">Hali o‘lchash yo‘q</td></tr>`}</tbody>`;
}
function measure() {
  en.n++; const t = tofNs() + 0.08 + 0.16 * noise(en.n, en.K); // detektor/kabel kechikishi 0…0,16 ns (tizimli + tasodifiy)
  en.pts = en.pts.filter((p) => Math.abs(Math.log10(p.K / en.K)) > 0.004);
  en.pts.push({ K: en.K, t, b: (FLIGHT / (t * 1e-9)) / P.C }); en.pts.sort((a, b) => a.K - b.K);
  if (en.pts.length > 12) en.pts.shift();
  renderTable();
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;

function updateReadouts() {
  if (ui.mode === "time" && tm.tool === "clock") {
    const g = P.gamma(tm.b), t0 = tick0() * 1e9;
    setRO("r1", "Tezlik <i>v</i>", u(fmt(tm.b, 3), "c"), kmS(tm.b));
    setRO("r2", "Lorens omili <i>γ</i>", fmt(g, 3), "γ = 1/√(1 − v²/c²)", "orange");
    setRO("r3", "Tinch soat tiki <i>Δt₀</i>", u(fmt(t0, 2), "ns"), `Δt₀ = 2d/c, d = ${D_CLOCK} m`);
    setRO("r4", "Uchayotgan soat tiki <i>Δt</i>", u(fmt(g * t0, 2), "ns"), "Δt = γΔt₀ — Yer soati bo‘yicha", "green");
    setRO("r5", "Tinch uzunlik <i>L₀</i>", u(fmt(L0, 0), "m"), "raketa bilan birga o‘lchangan");
    setRO("r6", "Yerdan o‘lchangan uzunlik <i>L</i>", u(fmt(contracted(), 2), "m"), "L = L₀/γ, ko‘ndalang o‘lcham o‘zgarmaydi", "green");
    return;
  }
  if (ui.mode === "time") {
    const r = P.muonSurvival(H_MOUNT, tm.b), cl = P.muonSurvival(H_MOUNT, tm.b, false), g = P.gamma(tm.b);
    setRO("r1", "Tezlik <i>v</i>, <i>γ</i>", u(fmt(tm.b, 3), "c"), `γ = ${fmt(g, 2)}`);
    setRO("r2", "Uchish vaqti (Yer soati) <i>t</i>", u(fmt(r.t * 1e6, 2), "µs"), `${fmt(r.t / P.MUON.T_HALF, 1)} ta yarim yemirilish davri`);
    setRO("r3", "Myuonning o‘z vaqti <i>t₀ = t/γ</i>", u(fmt(r.t0 * 1e6, 3), "µs"), `T½ = ${fmt(P.MUON.T_HALF * 1e6, 2)} µs`, "orange");
    setRO("r4", "Klassik kutilgan <i>N/N₀</i>", u(fmt(cl.frac * 100, 1), "%"), tm.total ? `hisoblagich: ${fmt((tm.nA / tm.total) * 100, 0)} %` : "");
    setRO("r5", "Nisbiylik bo‘yicha <i>N/N₀</i>", u(fmt(r.frac * 100, 1), "%"), tm.total ? `hisoblagich: ${fmt((tm.nB / tm.total) * 100, 0)} % (${tm.total} ta)` : "", "green");
    setRO("r6", "Myuon uchun tog‘ balandligi", u(fmt(r.hOwn, 0), "m"), "L = L₀/γ — xuddi shu natija");
    return;
  }
  if (ui.mode === "add") {
    const w = P.addVel(ad.v, ad.u), gg = P.addGal(ad.v, ad.u);
    setRO("r1", "Poyezd tezligi <i>v</i>", u(fmt(ad.v, 2), "c"), "Yerga nisbatan");
    setRO("r2", "Snaryad tezligi <i>u′</i>", ad.u >= 0.999 ? "c" : u(fmt(ad.u, 2), "c"), ad.u >= 0.999 ? "yorug‘lik chaqnashi" : "poyezdga nisbatan");
    setRO("r3", "Yerga nisbatan <i>u</i>", u(fmt(w, 4), "c"), "u = (v + u′)/(1 + vu′/c²)", "green");
    setRO("r4", "Galiley bo‘yicha <i>v + u′</i>", u(fmt(gg, 2), "c"), gg > 1 ? "c dan katta — noto‘g‘ri" : "kichik tezliklarda deyarli to‘g‘ri", gg > 1 ? "orange" : "");
    setRO("r5", "Farq <i>v + u′ − u</i>", u(fmt(gg - w, 4), "c"), `${fmt(((gg - w) / Math.max(gg, 1e-9)) * 100, 2)} %`);
    setRO("r6", "Poyezd uzunligi (Yerdan)", `${fmt(100 / P.gamma(ad.v), 1)}<small>%</small>`, "tinch uzunlikka nisbatan, L = L₀/γ");
    return;
  }
  const p = part(), s = P.particle(en.K, p.E0);
  setRO("r1", "Kinetik energiya <i>K = eU</i>", kfmt(en.K).replace(/ (\S+)$/, "<small>$1</small>"), `U = ${ufmt(en.K)}`);
  setRO("r2", "Tezlik <i>v</i>", u(fmt(s.b, s.b > 0.999 ? 5 : 4), "c"), kmS(s.b), "green");
  setRO("r3", "Klassik formula bo‘yicha", u(fmt(s.bCl, s.bCl > 10 ? 0 : 3), "c"), s.bCl > 1 ? "v > c — imkonsiz!" : "v = √(2K/m₀)", s.bCl > 1 ? "orange" : "");
  setRO("r4", "Massa <i>m = γm₀</i>", u(fmt(s.g, s.g > 100 ? 0 : 3), "m₀"), `m = ${sci(s.g * p.m, 3)} kg`, "orange");
  setRO("r5", "To‘liq energiya <i>E = mc²</i>", kfmt(s.E).replace(/ (\S+)$/, "<small>$1</small>"), `m₀c² = ${kfmt(p.E0)} + K`);
  setRO("r6", "Uchish vaqti <i>Δt</i> (8,4 m)", u(fmt(tofNs(), 2), "ns"), `yorug‘lik: ${fmt(P.tof(FLIGHT, 1) * 1e9, 2)} ns`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "time" && tm.tool === "clock") { t = `γ = ${fmt(P.gamma(tm.b), 3)}`; tone = tm.b > 0.5 ? "orange" : "blue"; }
  else if (ui.mode === "time") { t = `Hisoblagich: ${tm.nB} / ${tm.total}`; tone = "green"; }
  else if (ui.mode === "add") { t = ad.u >= 0.999 ? "Yorug‘lik tezligi doim c" : `u = ${cfmt(P.addVel(ad.v, ad.u), 3)}`; tone = ad.u >= 0.999 ? "orange" : "green"; }
  else { t = `${en.pts.length} ta o‘lchash`; tone = en.pts.length ? "green" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "time" && tm.tool === "clock") {
    const g = P.gamma(tm.b);
    p.push("<p>Eynshteyn postulatlari: 1) barcha inersial sanoq tizimlarida fizika qonunlari bir xil; 2) vakuumda yorug‘lik tezligi c manba va kuzatuvchi harakatiga bog‘liq emas. <b>Yorug‘lik soati</b> — ikki ko‘zgu orasida qaytib yuruvchi yorug‘lik: bir borib-kelish — bir «tik».</p>");
    p.push(`<p>Tinch soatda yorug‘lik tik yuqoriga-pastga yuradi: Δt₀ = 2d/c. Uchayotgan raketadagi soatda Yerdan qaraganda yorug‘lik <b>qiya</b> yo‘l bosadi (sariq chiziq), tezligi esa baribir c. Shuning uchun bir tik uzoqroq davom etadi: Δt = γΔt₀ = ${fmt(g, 3)}·Δt₀ — <b>harakatdagi soat sekin yuradi</b>. Shu bilan birga raketa harakat yo‘nalishida ${fmt(g, 3)} marta qisqargan (L = L₀/γ), ko‘ndalang o‘lchami (ko‘zgular orasi) o‘zgarmagan.</p>`);
  } else if (ui.mode === "time") {
    p.push(`<p><b>Myuonlar</b> atmosferaning yuqori qatlamida kosmik nurlar ta’sirida hosil bo‘ladi va deyarli yorug‘lik tezligida uchadi. Tinch turgan myuonning yarim yemirilish davri T½ = 1,52 µs. ${H_MOUNT} m balandlikni o‘tish uchun Yer soati bo‘yicha ${fmt(P.muonSurvival(H_MOUNT, tm.b).t * 1e6, 2)} µs kerak — klassik hisobda myuonlarning ko‘pi yo‘lda yemirilishi kerak edi.</p>`);
    p.push("<p>1963-yilda Frisch va Smith Vashington tog‘i cho‘qqisida va dengiz sathida myuonlarni sanab, ularning ≈ 72 % i yetib kelishini topdi. Sababi — <b>vaqtning sekinlashishi</b>: myuonning o‘z soati γ marta sekin yuradi. Myuon nuqtayi nazaridan esa tog‘ balandligi γ marta qisqargan — natija bir xil chiqadi.</p>");
  } else if (ui.mode === "add") {
    p.push("<p>Klassik mexanikada tezliklar oddiy qo‘shiladi: poyezd v tezlikda, undan oldinga u′ tezlikda otilgan snaryad Yerga nisbatan v + u′ tezlikda uchadi (xira «Galiley» snaryadi). Kichik tezliklarda bu juda aniq.</p>");
    p.push(`<p>Nisbiylik nazariyasida <b>u = (v + u′)/(1 + vu′/c²)</b>. Hozir ${fmt(ad.v, 2)}c va ${ad.u >= 0.999 ? "c" : `${fmt(ad.u, 2)}c`} qo‘shilib ${cfmt(P.addVel(ad.v, ad.u), 3)} hosil bo‘ldi. ${ad.u >= 0.999 ? "Poyezddagi chiroq yorug‘ligi Yerga nisbatan ham aynan c tezlikda tarqaladi — ikkinchi postulat." : "Tezliklar c dan kichik bo‘lsa, yig‘indi ham doim c dan kichik: hech bir jism yorug‘lik tezligiga yeta olmaydi."}</p>`);
  } else {
    const pr = part(), s = P.particle(en.K, pr.E0);
    p.push(`<p>Zarrani U kuchlanishda tezlatsak, u K = eU kinetik energiya oladi. Klassik formula K = m₀v²/2 bo‘yicha energiya 4 marta oshsa tezlik 2 marta oshishi kerak. Ammo tezlik c ga yaqinlashgani sari <b>massa m = γm₀ o‘sadi</b> va zarrani tezlatish qiyinlashadi. Hozir ${pr.name}ning massasi ${fmt(s.g, s.g > 100 ? 0 : 3)} marta oshgan, tezligi ${cfmt(s.b, 4)}.</p>`);
    p.push(`<p>Eynshteyn formulasi <b>E = mc²</b>: to‘liq energiya tinchlikdagi energiya m₀c² (${pr.name} uchun ${kfmt(pr.E0)}) va kinetik energiya yig‘indisi. 1 g massaga 9·10¹³ J energiya mos keladi. 1964-yilda Bertozzi elektronlarni 15 MeV gacha tezlatib, 8,4 m uchish vaqtini o‘lchadi: vaqt ${fmt(P.tof(FLIGHT, 1) * 1e9, 1)} ns dan kamaymadi — elektron yorug‘likdan tez ucha olmaydi.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "time" ? (tm.tool === "clock" ? "<small>Vaqt sekinlashishi</small> Δt = γΔt₀, L = L₀/γ" : "<small>Myuonlar</small> t₀ = t/γ, N = N₀·2^(−t₀/T½)") : ui.mode === "add" ? "<small>Tezliklarni qo‘shish</small> u = (v + u′)/(1 + vu′/c²)" : "<small>Massa va energiya</small> m = γm₀, E = mc²";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "time") { tm.T += dt; if (tm.tool === "muon") stepMuons(dt); }
  else if (ui.mode === "add") { ad.T += dt; if (addCycleOver(stage.w || 700)) ad.T = 0; }
  else en.T += dt;
  stage.render();
  uiTimer += dt; if (uiTimer > 0.25) { uiTimer = 0; refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom";
}
playBtn.addEventListener("click", () => { if (loop.running) { loop.stop(); playing = false; } else { loop.start(); playing = true; } });
function startIfNeeded() {
  if (prefersReducedMotion()) { tm.T = 6.4; ad.T = 1.6; en.T = 0.9; loop.stop(); setPlayUI(false); return; }
  if (!playing) { loop.stop(); setPlayUI(false); } else loop.start();
}
function resetRun() { tm.T = 0; tm.T0 = 0; tm.mu = []; tm.spawn = 0; tm.total = 0; tm.nA = 0; tm.nB = 0; ad.T = 0; en.T = 0; }
$("[data-reset]").addEventListener("click", () => { resetRun(); if (ui.mode === "energy") { en.pts = []; renderTable(); } refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const bC = bindRange($("#tB"), $("#tBOut"), (v) => cfmt(v, 3), (v) => { setB(v); customized(); refresh(); });
function setB(v) { tm.b = clamp(v, 0, 0.995); tm.T = 0; tm.T0 = 0; tm.mu = []; tm.total = 0; tm.nA = 0; tm.nB = 0; }
const vC = bindRange($("#aV"), $("#aVOut"), (v) => cfmt(v, 2), (v) => { ad.v = v; ad.T = 0; customized(); refresh(); });
const uC = bindRange($("#aU"), $("#aUOut"), (v) => (v >= 0.999 ? "c (yorug‘lik)" : cfmt(v, 2)), (v) => { ad.u = v; ad.T = 0; customized(); refresh(); });
const kIn = $("#eK");
const kC = bindRange(kIn, $("#eKOut"), (v) => kfmt(10 ** v), (v) => { en.K = 10 ** v; customized(); refresh(); });
function setTool(t) {
  tm.tool = t; document.querySelectorAll("[data-tool-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.toolValue === t)));
  $("[data-time-hint]").textContent = t === "clock" ? "Spidometr strelkasini surib raketa tezligini o‘zgartiring. Ikkala soatning «tik»lari sonini solishtiring." : "Spidometr strelkasini surib myuonlar tezligini o‘zgartiring. Pastdagi hisoblagichlar dengiz sathiga yetib kelgan myuonlarni sanaydi.";
  resetRun(); if (ui.mode === "time") setTab();
}
document.querySelectorAll("[data-tool-value]").forEach((b) => b.addEventListener("click", () => { setTool(b.dataset.toolValue); customized(); refresh(); }));
function setPart(pp) {
  en.part = pp; const [lo, hi] = RANGE[pp]; kIn.min = lo; kIn.max = hi;
  en.K = clamp(en.K, 10 ** lo, 10 ** hi); kC.set(Math.log10(en.K)); en.pts = []; renderTable();
  document.querySelectorAll("[data-part-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.partValue === pp)));
}
document.querySelectorAll("[data-part-value]").forEach((b) => b.addEventListener("click", () => { setPart(b.dataset.partValue); customized(); refresh(); }));

/* Sahnada surish va bosish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode === "time") { if (onDial(geo.dial, p)) return { kind: "b" }; }
  else if (ui.mode === "add") { if (onDial(geo.dV, p)) return { kind: "v" }; if (onDial(geo.dU, p)) return { kind: "u" }; }
  else { if (inBox(p, geo.meas)) return { kind: "meas" }; if (inBox(p, geo.clear)) return { kind: "clear" }; if (onDial(geo.dial, p)) return { kind: "K" }; }
  return null;
}
function applyDrag(h, p) {
  if (h.kind === "b") { const f = fracFrom(geo.dial, p); setB(Math.round(f * 1000 / 5) * 5 / 1000); bC.set(tm.b); }
  else if (h.kind === "v") { ad.v = clamp(Math.round(fracFrom(geo.dV, p) * 100) / 100, 0, 0.99); ad.T = 0; vC.set(ad.v); }
  else if (h.kind === "u") { ad.u = clamp(Math.round(fracFrom(geo.dU, p) * 100) / 100, 0, 1); ad.T = 0; uC.set(ad.u); }
  else if (h.kind === "K") { const [lo, hi] = RANGE[en.part], L = Math.round((lo + fracFrom(geo.dial, p) * (hi - lo)) * 100) / 100; en.K = 10 ** L; kC.set(L); }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  e.preventDefault(); customized();
  if (h.kind === "meas") { measure(); refresh(); return; }
  if (h.kind === "clear") { en.pts = []; renderTable(); refresh(); return; }
  applyDrag(h, p);
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true"; refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "meas" || h.kind === "clear" ? "pointer" : "grab"; return; }
  applyDrag(drag, p); refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const T = (tool, b) => () => { setTool(tool); setB(b); };
const PRESETS = {
  clk06: { mode: "time", title: "v = 0,6c: γ = 1,25", lesson: "Raketa 0,6c tezlikda: γ = 1,25. Tinch soat 5 marta «tik» qilganda uchayotgan soat 4 marta tik qiladi, raketa 100 m emas 80 m bo‘lib ko‘rinadi.", set: T("clock", 0.6) },
  clk08: { mode: "time", title: "v = 0,8c: γ = 5/3", lesson: "0,8c da γ = 1,667: uchayotgan soat 3 tik qilguncha tinch soat 5 tik qiladi. Sariq qiya chiziq — Yerdan qaraganda yorug‘likning yo‘li: u uzunroq, tezlik esa o‘sha c.", set: T("clock", 0.8) },
  clk099: { mode: "time", title: "v = 0,99c: γ ≈ 7", lesson: "Yorug‘lik tezligiga juda yaqin: soat 7 marta sekin yuradi, raketa 14 m ga qisqaradi. Yorug‘lik yo‘li deyarli gorizontal.", set: T("clock", 0.99) },
  clkSlow: { mode: "time", title: "Kosmik kema tezligi (8 km/s)", lesson: "Haqiqiy kosmik kemalar ≈ 8 km/s ≈ 0,000027c tezlikda uchadi: γ − 1 ≈ 3,6·10⁻¹⁰. Farq sahnada ko‘rinmaydi, lekin GPS sun’iy yo‘ldoshlari soatlarida hisobga olinadi (kuniga ≈ 7 µs).", set: T("clock", 0) },
  twin: { mode: "time", title: "Egizaklar paradoksi", lesson: "Egizaklardan biri 0,8c tezlikda 4,24 yorug‘lik yili uzoqlikdagi Proksima Sentavrga borib qaytadi. Yerda 10,6 yil o‘tadi, kemadagi soat bo‘yicha esa atigi 6,4 yil — qaytgan egizak akasidan 4,2 yil yosh.", set: T("clock", 0.8) },
  muon: { mode: "time", title: "Myuonlar: Frisch–Smith tajribasi", lesson: "v = 0,995c, γ = 10. 1907 m ni o‘tish uchun 6,4 µs kerak — 4,2 yarim yemirilish davri: klassik hisobda faqat 5 % myuon yetib kelishi kerak edi. Hisoblagichlar natijasini kuzating.", set: T("muon", 0.995) },
  muonSlow: { mode: "time", title: "Sekinroq myuonlar (0,9c)", lesson: "0,9c da γ = 2,3: vaqt sekinlashishi kichikroq, yetib kelgan myuonlar ulushi ham kamroq (≈ 20 %). Strelkani surib, ulush tezlikka qanday bog‘liqligini toping.", set: T("muon", 0.9) },
  addTrain: { mode: "add", title: "0,5c + 0,5c = 0,8c", lesson: "Poyezd 0,5c tezlikda, snaryad poyezdga nisbatan 0,5c tezlikda otildi. Galiley bo‘yicha Yerga nisbatan 1c bo‘lishi kerak edi, aslida 0,8c.", set: () => Object.assign(ad, { v: 0.5, u: 0.5 }) },
  addShips: { mode: "add", title: "0,8c + 0,8c: kemalar", lesson: "Kema Yerga nisbatan 0,8c, undan oldinga otilgan zond kemaga nisbatan 0,8c tezlikda: Yerga nisbatan 0,976c — c dan kichik. Xuddi shu formula bilan qarama-qarshi uchayotgan ikki kemaning nisbiy tezligi topiladi.", set: () => Object.assign(ad, { v: 0.8, u: 0.8 }) },
  addLight: { mode: "add", title: "Poyezddagi chiroq: c + v = c", lesson: "Poyezd 0,6c tezlikda, tomidagi chiroq oldinga yorug‘lik chaqnatadi. Galiley bo‘yicha 1,6c bo‘lishi kerak, ammo Yerdagi kuzatuvchi ham yorug‘lik tezligini aynan c deb o‘lchaydi — Eynshteynning ikkinchi postulati.", set: () => Object.assign(ad, { v: 0.6, u: 1 }) },
  addSlow: { mode: "add", title: "Kichik tezliklar: Galiley qonuni", lesson: "v = u′ = 0,05c (15 000 km/s) da ham farq atigi 0,25 %. Odatdagi tezliklarda (poyezd, samolyot) farq milliarddan bir ulushdan ham kichik — shuning uchun klassik mexanika to‘g‘ri ishlaydi.", set: () => Object.assign(ad, { v: 0.05, u: 0.05 }) },
  eTube: { mode: "energy", title: "Elektron, 25 kV (kineskop)", lesson: "Eski televizor kineskopida elektronlar 25 kV da tezlatiladi: v ≈ 0,3c, massa atigi 5 % ortadi. Klassik formula xatosi kichik (≈ 4 %).", set: () => { setPart("e"); en.K = 0.025; } },
  eMass: { mode: "energy", title: "K = m₀c²: massa 2 marta ortadi", lesson: "Elektronga tinchlikdagi energiyasiga teng (511 keV) kinetik energiya berildi: γ = 2, massa ikki marta ortdi, v = 0,866c. Klassik formula esa v = 1,41c beradi — mumkin emas.", set: () => { setPart("e"); en.K = P.PARTICLES.e.E0; } },
  bert15: { mode: "energy", title: "Bertozzi: 15 MeV elektron", lesson: "15 MeV da massa 30 marta ortgan, tezlik 0,9994c. Uchish vaqti 28,0 ns — yorug‘likniki bilan deyarli bir xil. Energiyani 30 marta oshirsak ham elektron yorug‘likdan o‘zib keta olmaydi.", set: () => { setPart("e"); en.K = 15; } },
  bertLab: { mode: "energy", title: "Bertozzi tajribasi: o‘lchash seriyasi", lesson: "Energiyani 0,5; 1; 1,5; 4,5 va 15 MeV ga qo‘yib, har safar «O‘lchash» tugmasini bosing. Grafikdagi nuqtalar klassik egri chiziqdan uzoqlashib, v = c chizig‘iga yaqinlashadi.", set: () => { setPart("e"); en.K = 0.5; } },
  proton: { mode: "energy", title: "Proton, 7 GeV", lesson: "Protonning tinchlikdagi energiyasi 938 MeV — elektronnikidan 1836 marta katta. 7 GeV da massa 8,5 marta ortadi, v = 0,993c. Katta adron kollayderida protonlar 6,8 TeV gacha tezlatiladi (γ ≈ 7000).", set: () => { setPart("p"); en.K = 7000; } },
};
const GROUPS = [["Vaqt va uzunlik", ["clk06", "clk08", "clk099", "clkSlow", "twin", "muon", "muonSlow"]], ["Tezliklarni qo‘shish", ["addTrain", "addShips", "addLight", "addSlow"]], ["Massa va energiya", ["eTube", "eMass", "bert15", "bertLab", "proton"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { time: "Spidometr strelkasini suring", add: "v va u′ strelkalarini suring", energy: "Dastakni burang, «O‘lchash»ni bosing" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-bert]").hidden = ui.mode !== "energy";
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { time: "Tinch va uchayotgan raketa, yorug‘lik soatlari yoki tog‘dan tushayotgan myuonlar", add: "Poyezd tomidan otilgan snaryad yoki yorug‘lik, Yerdagi kuzatuvchi", energy: "Tezlatkich, 8,4 m uchish yo‘li, detektorlar va ossillograf" }[ui.mode]);
}
const MODE_DEFAULT = { time: "clk08", add: "addTrain", energy: "bert15" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; resetRun(); p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  bC.set(tm.b); vC.set(ad.v); uC.set(ad.u); kC.set(Math.log10(en.K));
  setTab(); startIfNeeded(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

renderTable();
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "clk08");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
