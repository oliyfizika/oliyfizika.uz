// ==========================================================================
// Havo namligi va atmosfera hodisalari — virtual laboratoriya (simulations/humidity.html)
// 1) Namlik va shudring nuqtasi: yopiq shisha idishda havo va suv bug'i molekulalari; termometr ustunini surib
//    havo isitiladi/sovitiladi, «+ bug'» / «− bug'» tugmalari; soch gigrometri; t < t_d da tuman va devorda tomchilar.
//    Grafik pₛ(t) — holat nuqtasi va shudring nuqtasiga proyeksiya.
// 2) Psixrometr va kondensatsion gigrometr: quruq va ho'l termometr (ho'l termometr asta soviydi), lupa,
//    psixrometrik jadval (HTML). Gigrometr: nok bilan efir bug'latiladi, sayqallangan sirtda shudring paydo bo'ladi.
// 3) Atmosfera hodisalari: sutka davomida temperatura o'zgaradi, suv miqdori saqlanadi; shudring, qirov, tuman,
//    to'p-to'p bulut asosi. Quyosh/Oy osmon yoyi bo'ylab suriladi. Grafik t(τ) va t_d(τ).
// Fizika: humidity-physics.js (Node'da tekshirilgan: t_humidity.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn } from "./labkit.js";
import * as P from "./humidity-physics.js";
import { drawSat, drawDay, lastFrame } from "./humidity-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const MONO = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "air", hover: null, speed: 1 };
const air = { t: 22, W: 9.7 };
const psy = { tool: "psy", room: "class", time: 0, sel: "wet", can: 21.4, pump: false, dew: 0, revealed: false, cell: null };
const atm = { tau: 3, tMax: 24, amp: 14, phi15: 0.45, wind: false };
let presetId = null, playing = true;
const geo = {};

const ROOMS = {
  class: { name: "Sinf xonasi", t: 21.4, phi: 0.52 },
  bath: { name: "Hammom", t: 26.2, phi: 0.86 },
  winter: { name: "Qishda isitilgan xona", t: 23.0, phi: 0.24 },
  cellar: { name: "Yerto‘la", t: 12.6, phi: 0.88 },
  street: { name: "Yozgi ko‘cha (soyada)", t: 33.0, phi: 0.3 },
  unkA: { name: "Noma’lum xona A", t: 19.6, phi: 0.63, hidden: true },
  unkB: { name: "Noma’lum xona B", t: 24.3, phi: 0.41, hidden: true },
};
const room = () => ROOMS[psy.room];
const hidden = () => room().hidden && !psy.revealed;
const TAU_WET = 20; // ho'l termometrning sovish vaqt doimiysi, s
const wetNow = () => { const r = room(), tw = P.wetBulb(r.t, r.phi); return tw + (r.t - tw) * Math.exp(-psy.time / TAU_WET); };
const roomTd = () => P.dewPoint(room().phi * P.pSat(room().t));
const atmW = () => atm.phi15 * P.rhoSat(atm.tMax);
const atmMin = () => atm.tMax - atm.amp;
const atmNow = () => P.phenomenon(P.dayTemp(atm.tau, atmMin(), atm.tMax), atmW(), atm.wind);
/** Kunduzgi konveksiya: bulut asosi 3 km dan past va tuman yo'q */
const convective = (s, tau) => { const h = ((tau % 24) + 24) % 24; return h > 9 && h < 18 && P.cloudBase(s.t, s.td) < 2800 && !s.fog; };
const clock = (h) => { const x = ((h % 24) + 24) % 24, hh = Math.floor(x), mm = Math.round((x - hh) * 60); return `${String((hh + (mm === 60 ? 1 : 0)) % 24).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`; };

/* Molekulalar (shartli: bug' molekulalari soni ρ ga proporsional) */
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const mk = () => ({ x: rnd(), y: rnd(), vx: rnd() - 0.5, vy: rnd() - 0.5 });
const AIRM = Array.from({ length: 70 }, mk), VAPM = Array.from({ length: 150 }, mk);
const DROPS = Array.from({ length: 90 }, () => ({ side: Math.floor(rnd() * 3), u: rnd(), r: 1.2 + rnd() * 2.2 }));
function moveMolecules(dt) {
  for (const m of [...AIRM, ...VAPM]) {
    m.x += m.vx * dt * 0.35; m.y += m.vy * dt * 0.35;
    if (m.x < 0) { m.x = -m.x; m.vx = Math.abs(m.vx); } if (m.x > 1) { m.x = 2 - m.x; m.vx = -Math.abs(m.vx); }
    if (m.y < 0) { m.y = -m.y; m.vy = Math.abs(m.vy); } if (m.y > 1) { m.y = 2 - m.y; m.vy = -Math.abs(m.vy); }
  }
}

/* ------------------------------------------------------------------ Umumiy asboblar */

/** Shishali termometr: x — o'q, [y0, y1] — shkala, T — ko'rsatish; qaytaradi { Y(t) } */
function thermometer(ctx, c, x, y0, y1, T, { tMin = -10, tMax = 40, label = "", major = 10, minor = 1, wet = false, color } = {}) {
  const Y = (t) => y1 - ((t - tMin) / (tMax - tMin)) * (y1 - y0);
  ctx.save();
  // taxtacha (shkala)
  ctx.fillStyle = c.dark ? "#1e293b" : "#f8fafc"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x - 20, y0 - 12, 40, y1 - y0 + 34, 6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.fillStyle = c.text2; ctx.font = "600 9px Inter, system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let t = tMin; t <= tMax + 1e-9; t += minor) {
    const y = Math.round(Y(t)) + 0.5, isMaj = Math.abs(t / major - Math.round(t / major)) < 1e-6, isMid = Math.abs((2 * t) / major - Math.round((2 * t) / major)) < 1e-6;
    ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + (isMaj ? 14 : isMid ? 11 : 8), y); ctx.stroke();
    if (isMaj) ctx.fillText(`${t}`, x - 6, y);
  }
  // kapillyar va rezervuar
  const bulbY = y1 + 14;
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.12)" : "rgba(255,255,255,0.9)"; ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - 3, y0 - 6, 6, bulbY - y0, 3); ctx.fill(); ctx.stroke();
  const liquid = color || "#dc2626";
  ctx.fillStyle = liquid; ctx.beginPath(); ctx.arc(x, bulbY, 6.5, 0, TAU); ctx.fill();
  const yt = clamp(Y(T), y0 - 4, bulbY);
  ctx.fillRect(x - 1.6, yt, 3.2, bulbY - yt);
  if (wet) { // doka (ho'l mato) va pilik
    ctx.fillStyle = c.dark ? "rgba(203,213,225,0.55)" : "rgba(226,232,240,0.95)"; ctx.strokeStyle = c.text3; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(x - 9, bulbY - 12, 18, 22, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = c.dark ? "rgba(148,163,184,0.6)" : "rgba(148,163,184,0.8)"; for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(x + i, bulbY - 11); ctx.lineTo(x + i, bulbY + 9); ctx.stroke(); }
  }
  if (label) { ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(label, x, y0 - 14); }
  ctx.restore();
  return { Y, bulbY };
}

/** Lupa: termometr shkalasining T atrofidagi kattalashtirilgan qismi (0,2 °C bo'linmalar) */
function lens(ctx, c, cx, cy, R, T, title, { span = 2.4, color = "#dc2626" } = {}) {
  ctx.save();
  ctx.fillStyle = c.dark ? "#0f172a" : "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, TAU); ctx.clip();
  const k = (2 * R) / span, Y = (t) => cy - (t - T) * k, x = cx - R * 0.15;
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.12)" : "rgba(241,245,249,1)"; ctx.fillRect(x - 6, cy - R, 12, 2 * R);
  ctx.fillStyle = color; ctx.fillRect(x - 3.5, Y(T), 7, cy + R - Y(T));
  ctx.strokeStyle = c.text2; ctx.fillStyle = c.text; ctx.lineWidth = 1; ctx.font = "700 11px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const t0 = Math.floor((T - span) * 5) / 5;
  for (let i = 0; i <= span * 10 + 2; i++) {
    const t = Math.round((t0 + i * 0.2) * 10) / 10, y = Math.round(Y(t)) + 0.5, maj = Math.abs(t - Math.round(t)) < 1e-6, half = Math.abs(t * 2 - Math.round(t * 2)) < 1e-6;
    ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + (maj ? 26 : half ? 20 : 15), y); ctx.stroke();
    if (maj) ctx.fillText(`${t}`, x + 30, y);
  }
  ctx.restore();
  ctx.strokeStyle = c.dark ? "#94a3b8" : "#475569"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(title, cx, cy + R + 6);
  ctx.restore();
}

/* ------------------------------------------------------------------ 1. Namlik va shudring nuqtasi */

function drawAir(ctx, c, w, h) {
  const narrow = w < 560, s = P.airState(air.t, air.W);
  const x0 = narrow ? 12 : 22, x1 = narrow ? w - 78 : Math.round(w * 0.5), top = 16, bot = h - 46;
  // idish
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.06)" : "rgba(224,242,254,0.35)"; ctx.fillRect(x0, top, x1 - x0, bot - top);
  if (s.cond > 0) { ctx.fillStyle = c.dark ? `rgba(203,213,225,${Math.min(0.45, 0.12 + s.cond * 0.08)})` : `rgba(148,163,184,${Math.min(0.5, 0.15 + s.cond * 0.09)})`; ctx.fillRect(x0, top, x1 - x0, bot - top); }
  // suv (idish tubida)
  ctx.fillStyle = c.dark ? "rgba(56,189,248,0.25)" : "rgba(56,189,248,0.22)"; ctx.fillRect(x0 + 2, bot - 10, x1 - x0 - 4, 8);
  // molekulalar
  const nV = Math.min(VAPM.length, Math.round(s.rho * 4)), pad = 6, iw = x1 - x0 - 2 * pad, ih = bot - top - 2 * pad - 12;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.55)" : "rgba(100,116,139,0.55)";
  for (const m of AIRM) { ctx.beginPath(); ctx.arc(x0 + pad + m.x * iw, top + pad + m.y * ih, 2.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = c.dark ? "#38bdf8" : "#0284c7";
  for (let i = 0; i < nV; i++) { const m = VAPM[i]; ctx.beginPath(); ctx.arc(x0 + pad + m.x * iw, top + pad + m.y * ih, 3, 0, TAU); ctx.fill(); }
  // devordagi tomchilar
  const nD = Math.min(DROPS.length, Math.round(s.cond * 12));
  ctx.fillStyle = c.dark ? "rgba(186,230,253,0.9)" : "rgba(2,132,199,0.85)";
  for (let i = 0; i < nD; i++) { const d = DROPS[i]; const px = d.side === 0 ? x0 + 4 : d.side === 1 ? x1 - 4 : x0 + 6 + d.u * (x1 - x0 - 12), py = d.side === 2 ? top + 4 : top + 8 + d.u * (bot - top - 26); ctx.beginPath(); ctx.ellipse(px, py, d.r * 0.85, d.r, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.2; ctx.strokeRect(x0, top, x1 - x0, bot - top);
  // tugmalar
  geo.plus = chipBtn(ctx, c, x0, bot + 12, "+ bug‘", false, 64, 24);
  geo.minus = chipBtn(ctx, c, x0 + 70, bot + 12, "− bug‘", false, 64, 24);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (!narrow) ctx.fillText("● bug‘ molekulalari   ● havo molekulalari (shartli)", x0 + 144, bot + 24);
  // termometr (ustun suriladi)
  const tx = x1 + (narrow ? 38 : 34);
  const th = thermometer(ctx, c, tx, top + 26, bot - 24, air.t, { tMin: -10, tMax: 40, label: "t, °C", major: 10, minor: 1 });
  geo.therm = { x: tx, Y: th.Y, y0: top + 20, y1: bot - 20 };
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(tx, th.Y(air.t), 7, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.font = "700 9px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⇕", tx, th.Y(air.t) + 0.5);
  if (narrow) return;
  // soch gigrometri
  const gx = x1 + 120, gy = top + 62, R = 46;
  ctx.fillStyle = c.dark ? "#1e293b" : "#f8fafc"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, gy, R + 6, 0, TAU); ctx.fill(); ctx.stroke();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, A = (f) => a0 + (a1 - a0) * f;
  ctx.lineWidth = 6; [[0, 0.4, "#f59e0b"], [0.4, 0.6, "#22c55e"], [0.6, 1, "#3b82f6"]].forEach(([u, v, col]) => { ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(gx, gy, R - 6, A(u), A(v)); ctx.stroke(); }); ctx.globalAlpha = 1;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.font = "600 8px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let k = 0; k <= 20; k++) { const a = A(k / 20), r0 = R - (k % 2 ? 4 : 10); ctx.beginPath(); ctx.moveTo(gx + Math.cos(a) * r0, gy + Math.sin(a) * r0); ctx.lineTo(gx + Math.cos(a) * R, gy + Math.sin(a) * R); ctx.stroke(); if (k % 4 === 0) ctx.fillText(`${k * 5}`, gx + Math.cos(a) * (R - 18), gy + Math.sin(a) * (R - 18)); }
  const an = A(clamp(s.phi, 0, 1));
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(an) * (R - 6), gy + Math.sin(an) * (R - 6)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(gx, gy, 3.5, 0, TAU); ctx.fill();
  ctx.font = "700 9px Inter, system-ui, sans-serif"; ctx.fillText("φ, %", gx, gy + 22);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textBaseline = "top"; ctx.fillText("soch gigrometri", gx, gy + R + 10);
  // ma'lumot
  const ix = x1 + 62; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = MID; ctx.fillStyle = c.text2;
  const lines = [`ρ = ${fmt(s.rho, 2)} g/m³, ρₛ = ${fmt(s.rs, 2)} g/m³`, `φ = ρ/ρₛ = ${fmt(s.phi * 100, 0)} %`, `shudring nuqtasi t_d = ${fmt(s.td, 1)} °C`, s.cond > 0 ? `tuman: ${fmt(s.cond, 2)} g/m³ tomchilar` : s.phi > 0.97 ? "bug‘ to‘yingan" : "bug‘ to‘yinmagan"];
  lines.forEach((l, i) => { if (gy + R + 30 + i * 17 < h - 6) ctx.fillText(l, ix, gy + R + 28 + i * 17); });
}

/* ------------------------------------------------------------------ 2. Psixrometr va gigrometr */

function drawPsy(ctx, c, w, h) {
  const narrow = w < 560, r = room(), top = 30, bot = h - 76;
  // devor va taxta
  const bx = narrow ? 12 : 26, bw = narrow ? Math.min(150, w * 0.42) : 170;
  ctx.fillStyle = c.dark ? "#3f2d1d" : "#c8a37a"; ctx.strokeStyle = c.dark ? "#78350f" : "#92400e"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx, 12, bw, h - 24, 8); ctx.fill(); ctx.stroke();
  const xd = bx + bw * 0.3, xw = bx + bw * 0.72;
  const tdry = r.t, twet = wetNow();
  thermometer(ctx, c, xd, top + 16, bot - 6, tdry, { tMin: 0, tMax: 40, label: "quruq", major: 10, minor: 1 });
  const wt = thermometer(ctx, c, xw, top + 16, bot - 6, twet, { tMin: 0, tMax: 40, label: "ho‘l", major: 10, minor: 1, wet: true });
  // pilik va suv idishchasi
  const ry = wt.bulbY + 14;
  ctx.strokeStyle = c.dark ? "rgba(203,213,225,0.6)" : "rgba(148,163,184,0.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xw, wt.bulbY + 8); ctx.lineTo(xw, ry + 16); ctx.stroke();
  ctx.fillStyle = c.dark ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.4)"; ctx.fillRect(xw - 12, ry + 6, 24, 18);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2; ctx.strokeRect(xw - 12, ry, 24, 24);
  geo.thDry = { x: xd, y0: top, y1: bot + 14 }; geo.thWet = { x: xw, y0: top, y1: bot + 14 };
  // tanlangan termometr ramkasi
  const sx = psy.sel === "dry" ? xd : xw;
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(sx - 24, top - 2, 48, bot - top + 28); ctx.setLineDash([]);
  // lupa
  const lx = narrow ? bx + bw + (w - bx - bw) / 2 : bx + bw + 74, ly = narrow ? h * 0.36 : h * 0.4, R = narrow ? Math.min(52, (w - bx - bw) / 2 - 8) : 58;
  lens(ctx, c, lx, ly, R, psy.sel === "dry" ? tdry : twet, psy.sel === "dry" ? "lupa: quruq termometr" : "lupa: ho‘l termometr");
  if (narrow) return;
  const ix = lx + R + 26; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = BOLD; ctx.fillStyle = c.text; ctx.fillText(`Psixrometr — ${r.name}`, ix, 16);
  ctx.font = MID; ctx.fillStyle = c.text2;
  const settled = Math.abs(twet - P.wetBulb(r.t, r.phi)) < 0.05;
  [`Termometrni bosib lupaga qo‘ying.`, `Ho‘l termometr ${settled ? "barqarorlashdi" : "hali soviyapti…"}`, `1) t ni o‘qing`, `2) t_h ni o‘qing`, `3) Δt = t − t_h`, `4) jadvaldan φ ni toping`].forEach((l, i) => ctx.fillText(l, ix, 40 + i * 18));
}

function drawCond(ctx, c, w, h) {
  const narrow = w < 560, r = room(), td = roomTd();
  const cx = narrow ? w * 0.36 : w * 0.3, cw = narrow ? 84 : 100, top = 50, bot = h - 40;
  // shtativ
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8"; ctx.fillRect(cx - cw / 2 - 20, bot, cw + 40, 8);
  // idish (sayqallangan nikel)
  const g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
  ["#64748b", "#e2e8f0", "#f8fafc", "#cbd5e1", "#475569"].forEach((col, i) => g.addColorStop(i / 4, col));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - cw / 2, top, cw, bot - top, 6); ctx.fill();
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2; ctx.stroke();
  // sayqallangan old sirt va oltin halqa (taqqoslash uchun)
  const fy0 = top + (bot - top) * 0.3, fy1 = top + (bot - top) * 0.75;
  ctx.fillStyle = "#facc15"; ctx.globalAlpha = 0.6; ctx.fillRect(cx - cw / 2, fy0 - 6, cw, 6); ctx.fillRect(cx - cw / 2, fy1, cw, 6); ctx.globalAlpha = 1;
  if (psy.dew > 0.03) { // shudring — xiralashish
    ctx.fillStyle = `rgba(100,116,139,${Math.min(0.55, psy.dew * 0.7)})`; ctx.fillRect(cx - cw / 2 + 1, fy0, cw - 2, fy1 - fy0);
    ctx.fillStyle = `rgba(241,245,249,${Math.min(0.9, psy.dew)})`;
    for (let i = 0; i < 90; i++) { const u = ((i * 37) % 97) / 97, v = ((i * 61) % 89) / 89; ctx.beginPath(); ctx.arc(cx - cw / 2 + 4 + u * (cw - 8), fy0 + 3 + v * (fy1 - fy0 - 6), 1 + (i % 3) * 0.6, 0, TAU); ctx.fill(); }
  }
  // efir, termometr va nok
  ctx.fillStyle = "rgba(254,240,138,0.25)"; ctx.fillRect(cx - cw / 2 + 4, top + (bot - top) * 0.45, cw - 8, (bot - top) * 0.5);
  const tx = cx + cw * 0.18;
  thermometer(ctx, c, tx, 22, top + (bot - top) * 0.55, psy.can, { tMin: -10, tMax: 40, major: 10, minor: 1 });
  const bxp = cx - cw / 2 - (narrow ? 26 : 46), byp = top + 30;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bxp + 10, byp); ctx.quadraticCurveTo(cx - cw * 0.25, byp - 30, cx - cw * 0.2, top + 6); ctx.lineTo(cx - cw * 0.2, top + (bot - top) * 0.85); ctx.stroke();
  ctx.fillStyle = psy.pump ? "#b91c1c" : "#ef4444"; ctx.beginPath(); ctx.ellipse(bxp, byp + 18, psy.pump ? 13 : 16, psy.pump ? 20 : 22, 0, 0, TAU); ctx.fill();
  geo.bulb = { x: bxp, y: byp + 18, r: 26 };
  if (psy.pump) { ctx.fillStyle = "rgba(255,255,255,0.85)"; for (let i = 0; i < 6; i++) { const yy = top + (bot - top) * (0.92 - ((psy.time * 0.7 + i / 6) % 1) * 0.4); ctx.beginPath(); ctx.arc(cx - cw * 0.2 + Math.sin(i * 2 + psy.time * 5) * 4, yy, 2.5, 0, TAU); ctx.fill(); } }
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(psy.pump ? "puflanmoqda" : "nokni bosing", bxp, byp + 44);
  // lupa
  const lx = narrow ? w - 58 : cx + cw / 2 + 80, ly = h * 0.42, R = narrow ? 46 : 56;
  lens(ctx, c, lx, ly, R, psy.can, narrow ? "lupa" : "lupa: idishdagi termometr");
  if (narrow) return;
  const ix = lx + R + 24; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = BOLD; ctx.fillStyle = c.text; ctx.fillText(`Gigrometr — ${r.name}`, ix, 16);
  ctx.font = MID; ctx.fillStyle = c.text2;
  [`xona t = ${fmt(r.t, 1)} °C`, `Nokni bosing: efir bug‘lanib`, `idishni sovitadi.`, psy.dew > 0.05 ? "Sirtda shudring paydo bo‘ldi!" : "Sayqallangan sirt toza", `Shudring paydo bo‘lgan`, `paytdagi t — shudring nuqtasi`].forEach((l, i) => ctx.fillText(l, ix, 40 + i * 18));
  if (!hidden()) { ctx.fillStyle = c.text3; ctx.fillText(`(haqiqiy t_d = ${fmt(td, 1)} °C)`, ix, 40 + 6 * 18 + 4); }
}

/* ------------------------------------------------------------------ 3. Atmosfera hodisalari */

function drawAtm(ctx, c, w, h) {
  const narrow = w < 560, s = atmNow(), tau = ((atm.tau % 24) + 24) % 24;
  const ground = h - 54, sunUp = tau > 6 && tau < 19, day = clamp(Math.sin(((tau - 6) / 13) * Math.PI), 0, 1);
  // osmon
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  const nTop = c.dark ? [8, 15, 35] : [15, 30, 70], dTop = [96, 165, 250], nBot = c.dark ? [30, 41, 59] : [51, 65, 105], dBot = [219, 234, 254];
  const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * day));
  sky.addColorStop(0, `rgb(${mix(nTop, dTop).join(",")})`); sky.addColorStop(1, `rgb(${mix(nBot, dBot).join(",")})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, ground);
  if (!sunUp) { ctx.fillStyle = "rgba(255,255,255,0.8)"; for (let i = 0; i < 30; i++) { ctx.fillRect(((i * 97) % 100) / 100 * w, ((i * 53) % 60) / 100 * ground, 1.5, 1.5); } }
  // quyosh / oy yoyi
  const ax = w * (narrow ? 0.5 : 0.42), ay = ground, aR = Math.min(ax - 20, ground - 24);
  const ang = sunUp ? Math.PI * (1 - (tau - 6) / 13) : Math.PI * (1 - (((tau - 19 + 24) % 24) / 11));
  const sx = ax + Math.cos(ang) * aR, sy = ay - Math.sin(ang) * aR;
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(ax, ay, aR, Math.PI, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (sunUp) { ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(251,191,36,0.6)"; ctx.lineWidth = 2; for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 19, sy + Math.sin(a) * 19); ctx.lineTo(sx + Math.cos(a) * 25, sy + Math.sin(a) * 25); ctx.stroke(); } }
  else { ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, TAU); ctx.fill(); ctx.fillStyle = `rgb(${mix(nTop, dTop).join(",")})`; ctx.beginPath(); ctx.arc(sx + 5, sy - 3, 10, 0, TAU); ctx.fill(); }
  geo.sun = { x: sx, y: sy, r: 24, ax, ay };
  // bulut (kunduzi, konveksiya)
  const hMax = 3000, kH = (ground - 30) / hMax, base = P.cloudBase(s.t, s.td);
  const conv = convective(s, tau);
  if (conv) {
    const cyb = ground - base * kH, ccx = w * (narrow ? 0.55 : 0.6);
    ctx.fillStyle = c.dark ? "rgba(226,232,240,0.85)" : "rgba(255,255,255,0.95)";
    [[0, 0, 26], [-26, 6, 20], [26, 6, 20], [-12, -16, 20], [14, -18, 18]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.arc(ccx + dx, cyb - 20 + dy, rr, 0, TAU); ctx.fill(); });
    ctx.fillRect(ccx - 46, cyb - 14, 92, 14);
    ctx.strokeStyle = "rgba(251,146,60,0.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ccx, ground - 4); ctx.lineTo(ccx, cyb + 2); ctx.stroke(); ctx.setLineDash([]);
    tag(ctx, `bulut asosi ≈ ${fmt(base, 0)} m`, ccx + 50, cyb - 6, { color: "#0f172a", bg: "rgba(255,255,255,0.85)", font: SMALL });
  }
  // balandlik shkalasi
  if (!narrow) { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.lineWidth = 1; for (let hh = 0; hh <= hMax; hh += 500) { const y = ground - hh * kH; ctx.beginPath(); ctx.moveTo(w - 8, y); ctx.lineTo(w - 2, y); ctx.stroke(); if (hh) ctx.fillText(`${hh / 1000} km`, w - 10, y); } }
  // yer va o'tlar
  ctx.fillStyle = c.dark ? "#14532d" : "#4d7c0f"; ctx.fillRect(0, ground, w, h - ground);
  ctx.strokeStyle = s.frost ? "#e0f2fe" : c.dark ? "#22c55e" : "#65a30d"; ctx.lineWidth = 1.5;
  for (let x = 4; x < w; x += 7) { const hh = 8 + ((x * 13) % 9); ctx.beginPath(); ctx.moveTo(x, ground + 2); ctx.quadraticCurveTo(x + 2, ground - hh / 2, x + ((x % 3) - 1) * 3, ground - hh); ctx.stroke(); }
  if (s.dew) { ctx.fillStyle = "rgba(186,230,253,0.95)"; for (let x = 6; x < w; x += 11) { ctx.beginPath(); ctx.arc(x + ((x * 7) % 4), ground - 6 - ((x * 5) % 6), 1.8, 0, TAU); ctx.fill(); } }
  if (s.frost) { ctx.fillStyle = "rgba(240,249,255,0.55)"; ctx.fillRect(0, ground - 4, w, 8); }
  if (s.fog) { const fh = 26 + Math.min(60, s.cond * 40), gf = ctx.createLinearGradient(0, ground - fh, 0, ground + 4); gf.addColorStop(0, "rgba(226,232,240,0)"); gf.addColorStop(1, "rgba(226,232,240,0.9)"); ctx.fillStyle = gf; ctx.fillRect(0, ground - fh, w, fh + 6); }
  // meteostansiya (termometr budkasi)
  const mx = narrow ? 16 : 30, my = ground - 70;
  ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1; ctx.fillRect(mx, my, 54, 40); ctx.strokeRect(mx, my, 54, 40);
  ctx.strokeStyle = "#cbd5e1"; for (let y = my + 5; y < my + 40; y += 5) { ctx.beginPath(); ctx.moveTo(mx + 3, y); ctx.lineTo(mx + 51, y); ctx.stroke(); }
  ctx.fillStyle = "#64748b"; ctx.fillRect(mx + 25, my + 40, 4, 30);
  tag(ctx, `${fmt(s.t, 1)} °C`, mx + 27, my - 22, { color: "#0f172a", bg: "rgba(255,255,255,0.9)", font: MID, align: "center" });
  // soat
  tag(ctx, clock(tau), w / 2, 8, { color: "#0f172a", bg: "rgba(255,255,255,0.9)", font: BOLD, align: "center" });
  const word = s.fog ? (s.frost ? "tuman va qirov" : "tuman va shudring") : s.frost ? "qirov" : s.dew ? "shudring" : conv ? "to‘p-to‘p bulutlar" : "";
  if (word) tag(ctx, word, w / 2, ground + 14, { color: "#0f172a", bg: "rgba(255,255,255,0.9)", font: MID, align: "center" });
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "air") drawAir(ctx, c, s.w, s.h);
  else if (ui.mode === "psy") (psy.tool === "psy" ? drawPsy : drawCond)(ctx, c, s.w, s.h);
  else drawAtm(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.44, 310, 360)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "air") { const s = P.airState(air.t, air.W); return drawSat(ctx, gs, { t: air.t, p: s.p, td: s.td, hover: ui.hover }); }
  if (ui.mode === "atm") return drawDay(ctx, gs, { tMin: atmMin(), tMax: atm.tMax, W: atmW(), wind: atm.wind, tau: ((atm.tau % 24) + 24) % 24, hover: ui.hover });
  ctx.fillStyle = gs.colors.bg; ctx.fillRect(0, 0, gs.w, gs.h);
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  air: ["To‘yingan bug‘ bosimi pₛ(t)", "Egri chiziq — to‘yingan bug‘ bosimi. Holat nuqtasi (sariq) egri chiziqdan qancha past bo‘lsa, havo shuncha quruq. Havo sovitilganda bug‘ bosimi deyarli o‘zgarmaydi: nuqta chapga siljiydi va egri chiziqqa yetgan joyda (yashil) bug‘ to‘yinadi — shudring nuqtasi."],
  atm: ["Sutkalik temperatura t(τ) va shudring nuqtasi t_d(τ)", "Kechasi havo soviydi, shudring nuqtasi esa deyarli o‘zgarmaydi. Qizil chiziq yashil chiziqqa yetganda — shudring (0 °C dan past — qirov), shamolsiz kechada tuman ham tushadi (bo‘yalgan davrlar). Kunduzi t − t_d farqi bulut asosi balandligini belgilaydi."],
};
function setTab() {
  const t = TABS[ui.mode], card = $("[data-graph-card]");
  card.hidden = !t; ui.hover = null;
  if (t) { $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); graph.render(); }
}

/* ------------------------------------------------------------------ Psixrometrik jadval */

const PT_ROWS = Array.from({ length: 26 }, (_, i) => 10 + i), PT_COLS = Array.from({ length: 15 }, (_, i) => i);
const PT = P.psyTable(PT_ROWS, PT_COLS);
const grid = $("[data-psy-grid]");
grid.innerHTML = `<thead><tr><th scope="col">t, °C \\ Δt</th>${PT_COLS.map((d) => `<th scope="col">${d}</th>`).join("")}</tr></thead><tbody>${PT_ROWS.map((t, i) => `<tr><th scope="row">${t}</th>${PT[i].map((v, j) => `<td data-r="${i}" data-c="${j}">${v ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>`;
function markCell() {
  grid.querySelectorAll("td").forEach((td) => { const i = +td.dataset.r, j = +td.dataset.c; td.dataset.sel = !psy.cell ? "" : i === psy.cell[0] && j === psy.cell[1] ? "cell" : i === psy.cell[0] && j < psy.cell[1] ? "row" : j === psy.cell[1] && i < psy.cell[0] ? "col" : ""; });
}
grid.addEventListener("click", (e) => { const td = e.target.closest("td"); if (!td || td.textContent === "") return; psy.cell = [+td.dataset.r, +td.dataset.c]; markCell(); refresh(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const Q = "?";

function updateReadouts() {
  if (ui.mode === "air") {
    const s = P.airState(air.t, air.W);
    setRO("r1", "Temperatura <i>t</i>", u(fmt(air.t, 1), "°C"), "termometr ustunini suring");
    setRO("r2", "Absolyut namlik <i>ρ</i>", u(fmt(s.rho, 2), "g/m³"), s.cond > 0 ? `+ ${fmt(s.cond, 2)} g/m³ tomchilar (tuman)` : "1 m³ havodagi bug‘ massasi");
    setRO("r3", "To‘yingan bug‘ <i>ρₛ</i>", u(fmt(s.rs, 2), "g/m³"), `pₛ = ${fmt(s.ps / 1000, 3)} kPa`);
    setRO("r4", "Nisbiy namlik <i>φ</i>", u(fmt(s.phi * 100, 0), "%"), s.phi > 0.995 ? "bug‘ to‘yingan" : s.phi < 0.3 ? "havo quruq" : s.phi > 0.7 ? "havo nam" : "qulay namlik (40–60 %)", "orange");
    setRO("r5", "Bug‘ bosimi <i>p</i>", u(fmt(s.p / 1000, 3), "kPa"), "parsial bosim");
    setRO("r6", "Shudring nuqtasi <i>t<sub>d</sub></i>", u(fmt(s.td, 1), "°C"), s.td < 0 ? "0 °C dan past — qirov nuqtasi" : "shu t gacha sovitilsa bug‘ to‘yinadi", "green");
    return;
  }
  if (ui.mode === "psy") {
    const r = room(), td = roomTd(), p = r.phi * P.pSat(r.t), hid = hidden();
    if (psy.tool === "psy") {
      const tw = wetNow(), dt = r.t - tw, cell = psy.cell ? PT[psy.cell[0]][psy.cell[1]] : null;
      setRO("r1", "Quruq termometr <i>t</i>", u(fmt(r.t, 1), "°C"), hid ? "lupada o‘qing" : "havo temperaturasi");
      setRO("r2", "Ho‘l termometr <i>t<sub>h</sub></i>", hid ? Q : u(fmt(tw, 1), "°C"), Math.abs(tw - P.wetBulb(r.t, r.phi)) < 0.05 ? "barqarorlashdi" : "soviyapti — kuting");
      setRO("r3", "Farq <i>Δt = t − t<sub>h</sub></i>", hid ? Q : u(fmt(dt, 1), "°C"), "jadval ustuni");
      setRO("r4", "Jadvaldan <i>φ</i>", cell != null ? u(cell, "%") : "—", psy.cell ? `t = ${PT_ROWS[psy.cell[0]]} °C, Δt = ${PT_COLS[psy.cell[1]]} °C` : "jadvalda katakni bosing", "orange");
      setRO("r5", "Aniq <i>φ</i> (formula)", hid ? Q : u(fmt(P.phiFromPsy(r.t, tw) * 100, 0), "%"), hid ? "«Javobni ko‘rsatish»" : "p = pₛ(t_h) − A·p_atm·Δt");
      setRO("r6", "Shudring nuqtasi <i>t<sub>d</sub></i>", hid ? Q : u(fmt(td, 1), "°C"), hid ? "" : `ρ = ${fmt(P.rhoOf(p, r.t), 1)} g/m³`, "green");
    } else {
      setRO("r1", "Xona temperaturasi <i>t</i>", u(fmt(r.t, 1), "°C"), "");
      setRO("r2", "Idish temperaturasi", u(fmt(psy.can, 1), "°C"), psy.pump ? "efir bug‘lanmoqda — soviydi" : "asta isiydi");
      setRO("r3", "Sayqallangan sirt", psy.dew > 0.05 ? "shudring" : "toza", psy.dew > 0.05 ? "shu paytdagi t ni yozing" : "nokni bosib soviting", psy.dew > 0.05 ? "green" : "");
      setRO("r4", "Shudring nuqtasi <i>t<sub>d</sub></i>", hid ? Q : u(fmt(td, 1), "°C"), hid ? "o‘zingiz o‘lchang" : "haqiqiy qiymat");
      setRO("r5", "Nisbiy namlik <i>φ = pₛ(t<sub>d</sub>)/pₛ(t)</i>", hid ? Q : u(fmt(r.phi * 100, 0), "%"), hid ? "«Javobni ko‘rsatish»" : `pₛ(t_d) = ${fmt(p / 1000, 3)} kPa`, "orange");
      setRO("r6", "To‘yingan bug‘ <i>pₛ(t)</i>", u(fmt(P.pSat(r.t) / 1000, 3), "kPa"), "jadvaldan olinadi");
    }
    return;
  }
  const s = atmNow(), base = P.cloudBase(s.t, s.td);
  setRO("r1", "Sutka vaqti", clock(atm.tau), `t_min = ${fmt(atmMin(), 1)} °C (5:00), t_max = ${fmt(atm.tMax, 1)} °C (15:00)`);
  setRO("r2", "Havo temperaturasi <i>t</i>", u(fmt(s.t, 1), "°C"), "");
  setRO("r3", "Shudring nuqtasi <i>t<sub>d</sub></i>", u(fmt(s.td, 1), "°C"), `suv miqdori ${fmt(atmW(), 1)} g/m³`, "green");
  setRO("r4", "Nisbiy namlik <i>φ</i>", u(fmt(s.phi * 100, 0), "%"), "");
  setRO("r5", "Bulut asosi <i>h</i>", base > 50 ? u(fmt(base, 0), "m") : "yerda", "h ≈ 122 m/°C · (t − t_d)");
  const cv = convective(s, atm.tau);
  setRO("r6", "Hodisa", s.fog ? "tuman" : s.frost ? "qirov" : s.dew ? "shudring" : cv ? "bulutlar" : "ochiq osmon", s.dew || s.frost ? "havo shudring nuqtasigacha sovidi" : cv ? "ko‘tarilgan havo t_d gacha soviydi" : `t − t_d = ${fmt(s.t - s.td, 1)} °C`, "orange");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "air") { const s = P.airState(air.t, air.W); t = s.cond > 0 ? "Tuman: ortiqcha bug‘ kondensatsiyalandi" : s.phi > 0.995 ? "Bug‘ to‘yingan" : `φ = ${fmt(s.phi * 100, 0)} %`; tone = s.cond > 0 ? "orange" : "green"; }
  else if (ui.mode === "psy") {
    if (psy.tool === "psy") { const settled = Math.abs(wetNow() - P.wetBulb(room().t, room().phi)) < 0.05; t = settled ? "Ho‘l termometr barqaror — o‘qing" : "Ho‘l termometr soviyapti…"; tone = settled ? "green" : "orange"; }
    else { t = psy.dew > 0.05 ? "Shudring paydo bo‘ldi" : psy.pump ? "Idish soviyapti" : "Nokni bosing"; tone = psy.dew > 0.05 ? "green" : psy.pump ? "orange" : "blue"; }
  } else { const s = atmNow(); t = s.fog ? "Tuman" : s.frost ? "Qirov" : s.dew ? "Shudring" : `${clock(atm.tau)}`; tone = s.dew || s.frost ? "green" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "air") {
    const s = P.airState(air.t, air.W);
    p.push("<p>Suv doimo bug‘lanadi, bug‘ molekulalari esa yana suvga qaytadi. Ma’lum temperaturada havo faqat cheklangan miqdordagi bug‘ni ushlay oladi — bunday bug‘ <b>to‘yingan</b> deyiladi (ρₛ, pₛ). Temperatura ortsa ρₛ tez o‘sadi: 0 °C da 4,8 g/m³, 20 °C da 17,3 g/m³, 30 °C da 30,4 g/m³.</p>");
    p.push(`<p><b>Absolyut namlik</b> ρ — 1 m³ havodagi bug‘ massasi, <b>nisbiy namlik</b> φ = ρ/ρₛ. Hozir ρ = ${fmt(s.rho, 1)} g/m³, demak havo ${fmt(s.td, 1)} °C gacha sovitilsa bug‘ to‘yinadi — bu <b>shudring nuqtasi</b>. ${s.cond > 0 ? "Havo shudring nuqtasidan pastga sovidi: ortiqcha bug‘ mayda tomchilarga aylandi (tuman, idish devorida tomchilar)." : "Undan pastga sovitilsa ortiqcha bug‘ tomchilarga aylanadi."}</p>`);
  } else if (ui.mode === "psy") {
    if (psy.tool === "psy") {
      p.push("<p><b>Psixrometr</b> ikki termometrdan iborat. Ho‘l termometr rezervuari suvga botirilgan mato bilan o‘ralgan: matodan suv bug‘lanadi va termometrni sovitadi. Havo qancha quruq bo‘lsa, bug‘lanish shuncha tez, ho‘l termometr shuncha past ko‘rsatadi. φ = 100 % da bug‘lanish to‘xtaydi va ikkala termometr bir xil ko‘rsatadi.</p>");
      p.push("<p>O‘lchash tartibi (laboratoriya ishi): 1) ho‘l termometr barqarorlashguncha kuting; 2) quruq (t) va ho‘l (t<sub>h</sub>) termometrlarni lupada 0,2 °C aniqlikda o‘qing; 3) Δt = t − t<sub>h</sub>; 4) psixrometrik jadvalda t qatori va Δt ustuni kesishgan katakdan φ ni toping.</p>");
    } else {
      p.push("<p><b>Kondensatsion gigrometr</b>: sayqallangan idishdagi efir nok bilan havo puflanganda tez bug‘lanadi va idishni sovitadi. Idish sirtiga tegib turgan havo shudring nuqtasigacha soviganda sirt xiralashadi — shudring tushadi. Shu paytdagi termometr ko‘rsatishi t<sub>d</sub>.</p>");
      p.push("<p>Keyin jadvaldan pₛ(t<sub>d</sub>) (bu havodagi bug‘ bosimi) va pₛ(t) olinadi: φ = pₛ(t<sub>d</sub>)/pₛ(t). Shudring biroz kechikib ko‘rinadi, shuning uchun aniqroq natija uchun shudring paydo bo‘lish va yo‘qolish temperaturalarining o‘rtachasi olinadi. Taqqoslash uchun oltin halqalar xiralashmaydi.</p>");
    }
  } else {
    const s = atmNow();
    p.push("<p>Kunduzi Quyosh yerni isitadi, kechasi yer issiqlik nurlab soviydi va havoning pastki qatlami ham soviydi. Havodagi suv miqdori deyarli o‘zgarmaydi, shuning uchun shudring nuqtasi ham o‘zgarmaydi. Kechasi havo t<sub>d</sub> gacha sovisa, o‘tlar va sovuq sirtlarda <b>shudring</b> tushadi; t<sub>d</sub> < 0 °C bo‘lsa — <b>qirov</b>. Shamolsiz, ochiq kechada havo qatlami ham to‘yinadi va <b>tuman</b> hosil bo‘ladi; shamol havoni aralashtirib, tumanni tarqatadi.</p>");
    p.push(`<p>Kunduzi isigan havo ko‘tariladi va har kilometrda ≈ 10 °C soviydi; t<sub>d</sub> ga yetgan balandlikda bug‘ kondensatsiyalanib <b>to‘p-to‘p bulut</b> hosil bo‘ladi: h ≈ 122 m · (t − t<sub>d</sub>). ${s.t - s.td > 24 ? "Hozir havo juda quruq — bulut asosi 3 km dan yuqori." : ""}</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "air" ? "<small>Nisbiy namlik</small> φ = ρ/ρₛ = p/pₛ" : ui.mode === "psy" ? (psy.tool === "psy" ? "<small>Psixrometr</small> Δt = t − tₕ → φ (jadval)" : "<small>Gigrometr</small> φ = pₛ(t_d)/pₛ(t)") : "<small>Bulut asosi</small> h ≈ 122 m·(t − t_d)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); $("[data-reveal]").hidden = !(ui.mode === "psy" && room().hidden && !psy.revealed); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "air") moveMolecules(dt);
  else if (ui.mode === "psy") {
    const k = dt * ui.speed; psy.time += k;
    const r = room(), td = roomTd();
    psy.can += (psy.pump ? -0.25 * k : 0) + ((r.t - psy.can) * k) / 90; psy.can = Math.max(-8, psy.can);
    psy.dew = clamp(psy.dew + (psy.can < td ? (td - psy.can) * 1.0 : -(psy.can - td) * 0.6) * k, 0, 1);
  } else {
    atm.tau = (atm.tau + dt * ui.speed * 0.5) % 24; tauC.set(Math.round(atm.tau * 4) / 4);
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.2) { uiTimer = 0; refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : ui.mode === "atm" ? "Vaqtni yurgizish" : "Davom";
}
playBtn.addEventListener("click", () => { if (loop.running) { loop.stop(); playing = false; } else { loop.start(); playing = true; } });
function startIfNeeded() {
  if (prefersReducedMotion()) { if (ui.mode === "psy") psy.time = 600; loop.stop(); setPlayUI(false); return; }
  if (ui.mode === "atm" || !playing) { loop.stop(); setPlayUI(false); } else loop.start();
}
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "psy") { psy.time = 0; psy.can = room().t; psy.dew = 0; psy.pump = false; psy.cell = null; markCell(); }
  else if (presetId === null) loadPreset(MODE_DEFAULT[ui.mode]); else loadPreset(presetId);
  refresh();
});
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));
$("[data-reveal]").addEventListener("click", () => { psy.revealed = true; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const aTC = bindRange($("#aT"), $("#aTOut"), (v) => `${fmt(v, 1)} °C`, (v) => { air.t = v; customized(); refresh(); });
const aWC = bindRange($("#aW"), $("#aWOut"), (v) => `${fmt(v, 1)} g/m³`, (v) => { air.W = v; customized(); refresh(); });
const roomSel = $("#room");
roomSel.innerHTML = Object.entries(ROOMS).map(([k, r]) => `<option value="${k}">${r.name}${r.hidden ? "" : ` (${fmt(r.t, 1)} °C)`}</option>`).join("");
function setRoom(k) { psy.room = k; psy.time = 0; psy.can = ROOMS[k].t; psy.dew = 0; psy.pump = false; psy.revealed = false; psy.cell = null; roomSel.value = k; markCell(); }
roomSel.addEventListener("change", () => { setRoom(roomSel.value); customized(); refresh(); });
function setTool(t) {
  psy.tool = t; document.querySelectorAll("[data-tool-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.toolValue === t)));
  $("[data-psytable]").hidden = !(ui.mode === "psy" && t === "psy");
  $("[data-psy-hint]").textContent = t === "psy" ? "Termometrni sahnada bosib lupaga qo‘ying. Ho‘l termometr barqarorlashguncha kuting (10× tezlatish mumkin)." : "Sahnadagi qizil nokni bosib puflashni yoqing yoki o‘chiring. Sayqallangan sirt xiralashgan paytdagi temperaturani yozing.";
}
document.querySelectorAll("[data-tool-value]").forEach((b) => b.addEventListener("click", () => { setTool(b.dataset.toolValue); customized(); psy.pump = false; refresh(); }));
const tauC = bindRange($("#mTau"), $("#mTauOut"), (v) => clock(v), (v) => { atm.tau = v; customized(); refresh(); });
const maxC = bindRange($("#mMax"), $("#mMaxOut"), (v) => `${fmt(v, 1)} °C`, (v) => { atm.tMax = v; customized(); refresh(); });
const ampC = bindRange($("#mAmp"), $("#mAmpOut"), (v) => `${fmt(v, 1)} °C`, (v) => { atm.amp = v; customized(); refresh(); });
const phiC = bindRange($("#mPhi"), $("#mPhiOut"), (v) => `${fmt(v, 0)} %`, (v) => { atm.phi15 = v / 100; customized(); refresh(); });
const windEl = $("[data-wind]");
windEl.addEventListener("change", () => { atm.wind = windEl.checked; customized(); refresh(); });

/* Sahnada surish va bosish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode === "air") {
    if (inBox(p, geo.plus)) return { kind: "plus" };
    if (inBox(p, geo.minus)) return { kind: "minus" };
    const g = geo.therm; if (g && Math.abs(p.x - g.x) <= 16 && p.y >= g.y0 - 10 && p.y <= g.y1 + 20) return { kind: "therm" };
  } else if (ui.mode === "psy") {
    if (psy.tool === "psy") { for (const [k, g] of [["dry", geo.thDry], ["wet", geo.thWet]]) if (g && Math.abs(p.x - g.x) <= 22 && p.y >= g.y0 && p.y <= g.y1) return { kind: "sel", which: k }; }
    else { const g = geo.bulb; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= g.r) return { kind: "bulb" }; }
  } else { const g = geo.sun; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= g.r) return { kind: "sun" }; }
  return null;
}
function setAirT(y) { const g = geo.therm; let lo = -10, hi = 40; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (g.Y(m) > y) lo = m; else hi = m; } air.t = clamp(Math.round(((lo + hi) / 2) * 2) / 2, -10, 40); aTC.set(air.t); }
function stepW(d) { air.W = clamp(Math.round((air.W + d) * 10) / 10, 0.5, 30); aWC.set(air.W); }
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  e.preventDefault(); customized();
  if (h.kind === "plus" || h.kind === "minus") { stepW(h.kind === "plus" ? 1 : -1); refresh(); return; }
  if (h.kind === "sel") { psy.sel = h.which; refresh(); return; }
  if (h.kind === "bulb") { psy.pump = !psy.pump; if (!loop.running && !prefersReducedMotion()) { playing = true; loop.start(); } refresh(); return; }
  if (h.kind === "therm") setAirT(p.y);
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true"; refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "therm" ? "ns-resize" : h.kind === "sun" ? "grab" : "pointer"; return; }
  if (drag.kind === "therm") setAirT(p.y);
  else if (drag.kind === "sun") {
    const g = geo.sun, a = Math.atan2(g.ay - p.y, p.x - g.ax), f = clamp(1 - a / Math.PI, 0, 1), day = ((atm.tau % 24) + 24) % 24 > 6 && ((atm.tau % 24) + 24) % 24 < 19;
    atm.tau = day ? 6 + 13 * f : (19 + 11 * f) % 24; tauC.set(Math.round(atm.tau * 4) / 4);
  }
  refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  airRoom: { mode: "air", title: "Xonadagi havo", lesson: "22 °C da havoda 9,7 g/m³ bug‘ bor, bu to‘yingan bug‘ning yarmiga yaqin: φ ≈ 50 %. Termometr ustunini pastga surib havoni soviting va φ qanday o‘sishini kuzating.", set: () => Object.assign(air, { t: 22, W: 9.7 }) },
  airCool: { mode: "air", title: "Shudring nuqtasidan past sovitish", lesson: "O‘sha havo 5 °C gacha sovitildi: to‘yingan bug‘ zichligi atigi 6,8 g/m³, ortiqcha 2,9 g/m³ bug‘ tuman va devordagi tomchilarga aylandi. Qaytadan isitsangiz tomchilar bug‘lanib ketadi.", set: () => Object.assign(air, { t: 5, W: 9.7 }) },
  airSat: { mode: "air", title: "Namlatgich: to‘yingan bug‘", lesson: "20 °C da «+ bug‘» tugmasini bosib boring: ρ = 17,3 g/m³ da bug‘ to‘yinadi (φ = 100 %), undan keyin qo‘shilgan bug‘ tomchiga aylanadi — φ 100 % dan oshmaydi.", set: () => Object.assign(air, { t: 20, W: 16.3 }) },
  airWinter: { mode: "air", title: "Qishda isitilgan xona", lesson: "Tashqaridan kirgan sovuq havoda bug‘ kam (3 g/m³). Xona 22 °C gacha isitilganda φ atigi 15 % — havo juda quruq, shuning uchun qishda namlatgich ishlatiladi.", set: () => Object.assign(air, { t: 22, W: 3 }) },
  airSummer: { mode: "air", title: "Toshkent yozi: issiq va quruq", lesson: "36 °C, ρ = 8 g/m³: bug‘ miqdori xonadagidan kam emas, ammo issiq havoda ρₛ = 41,7 g/m³ — φ ≈ 19 %. Shudring nuqtasi 8 °C atrofida.", set: () => Object.assign(air, { t: 36, W: 8 }) },
  psyClass: { mode: "psy", title: "Psixrometr: sinf xonasi", lesson: "Ho‘l termometr barqarorlashguncha kuting (10× tezlatish mumkin). Ikkala termometrni lupada o‘qing, Δt ni hisoblang va jadvaldan φ ni toping.", set: () => { setTool("psy"); setRoom("class"); } },
  psyBath: { mode: "psy", title: "Psixrometr: hammom", lesson: "Havo bug‘ga to‘yinishga yaqin: suv sekin bug‘lanadi, termometrlar farqi atigi ≈ 2 °C, φ ≈ 86 %.", set: () => { setTool("psy"); setRoom("bath"); } },
  psyWinter: { mode: "psy", title: "Psixrometr: qishki xona", lesson: "Quruq havoda ho‘l termometr 11 °C ga soviydi: Δt ≈ 11 °C, φ ≈ 24 %.", set: () => { setTool("psy"); setRoom("winter"); } },
  psyLab: { mode: "psy", title: "Laboratoriya ishi: noma’lum xona", lesson: "Darslikdagi «Havoning nisbiy namligini aniqlash» laboratoriya ishi. Termometrlarni o‘qing, jadvaldan φ ni toping, so‘ng «Javobni ko‘rsatish» bilan tekshiring.", set: () => { setTool("psy"); setRoom("unkA"); } },
  condClass: { mode: "psy", title: "Kondensatsion gigrometr", lesson: "Qizil nokni bosing: efir bug‘lanib idishni sovitadi. Sayqallangan sirt xiralashgan paytdagi temperatura — shudring nuqtasi. Keyin φ = pₛ(t_d)/pₛ(t).", set: () => { setTool("cond"); setRoom("class"); } },
  condLab: { mode: "psy", title: "Gigrometr: noma’lum xona", lesson: "Shudring nuqtasini o‘zingiz o‘lchang: shudring paydo bo‘lgan va (puflashni to‘xtatgach) yo‘qolgan temperaturalarning o‘rtachasini oling. φ ni hisoblab, psixrometr bilan solishtiring.", set: () => { setTool("cond"); setRoom("unkB"); } },
  atmDew: { mode: "atm", title: "Yozgi tong: shudring", lesson: "Kun issiq (26 °C), kechasi havo 12 °C gacha soviydi. Shudring nuqtasi ≈ 12,6 °C — tongga yaqin o‘tlarda shudring tushadi. Shamolni yoqib-o‘chirib tumanni kuzating.", set: () => Object.assign(atm, { tau: 5, tMax: 26, amp: 14, phi15: 0.45, wind: true }) },
  atmFog: { mode: "atm", title: "Kuzgi tun: tuman", lesson: "Nam kuzgi havo, shamol yo‘q: kechasi havo shudring nuqtasidan ancha pastga soviydi — pastki qatlamda tuman hosil bo‘ladi. Quyosh chiqib havo isiganda tuman tarqaladi.", set: () => Object.assign(atm, { tau: 4, tMax: 16, amp: 10, phi15: 0.72, wind: false }) },
  atmFrost: { mode: "atm", title: "Erta bahor: qirov", lesson: "Kechasi temperatura 0 °C dan pastga tushadi, shudring nuqtasi ham manfiy — bug‘ to‘g‘ridan-to‘g‘ri muz kristallariga aylanadi: o‘tlarda qirov.", set: () => Object.assign(atm, { tau: 5, tMax: 9, amp: 13, phi15: 0.5, wind: true }) },
  atmCloud: { mode: "atm", title: "Bahor kuni: to‘p-to‘p bulutlar", lesson: "Kunduzi isigan havo ko‘tariladi va soviydi. t − t_d ≈ 11 °C — bulut asosi ≈ 1,3 km da. Vaqtni yurgizib, bulut asosi kun bo‘yi qanday ko‘tarilishini kuzating.", set: () => Object.assign(atm, { tau: 13, tMax: 22, amp: 12, phi15: 0.5, wind: true }) },
  atmDry: { mode: "atm", title: "Toshkent yozi: shudring yo‘q", lesson: "Havo juda quruq (15:00 da φ = 18 %): kechasi 23 °C gacha sovisa ham shudring nuqtasiga (≈ 9 °C) yetmaydi; bulut asosi 3 km dan yuqori — osmon ochiq.", set: () => Object.assign(atm, { tau: 14, tMax: 38, amp: 15, phi15: 0.18, wind: true }) },
};
const GROUPS = [["Namlik va shudring nuqtasi", ["airRoom", "airCool", "airSat", "airWinter", "airSummer"]], ["Psixrometr va gigrometr", ["psyClass", "psyBath", "psyWinter", "psyLab", "condClass", "condLab"]], ["Atmosfera hodisalari", ["atmDew", "atmFog", "atmFrost", "atmCloud", "atmDry"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { air: "Termometr ustunini suring", psy: "Termometrni yoki nokni bosing", atm: "Quyosh yoki Oyni suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  $("[data-psytable]").hidden = !(ui.mode === "psy" && psy.tool === "psy");
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { air: "Yopiq idishdagi havo va suv bug‘i molekulalari, termometr va soch gigrometri", psy: "Psixrometr yoki kondensatsion gigrometr va lupa", atm: "Sutka davomida osmon, yer, shudring, tuman va bulutlar" }[ui.mode]);
}
const MODE_DEFAULT = { air: "airRoom", psy: "psyClass", atm: "atmDew" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  aTC.set(air.t); aWC.set(air.W); tauC.set(atm.tau); maxC.set(atm.tMax); ampC.set(atm.amp); phiC.set(atm.phi15 * 100); windEl.checked = atm.wind;
  setTab(); startIfNeeded(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "airRoom");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
