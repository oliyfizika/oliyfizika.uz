// ==========================================================================
// Elektromagnit to'lqinlar va radioaloqa — virtual laboratoriya (simulations/emwaves.html)
// 1) EM to'lqin: vibrator (antenna) nurlatadi; E va B sinusoidalari (perspektivada), λ, v = c/n; chastota 10⁴…10²¹ Hz
//    (log shkala), muhit; sahnada o'lchov nuqtasi suriladi — E(t) grafigi; EM spektr.
// 2) Xossalari (Gers tajribalari): metall listdan qaytish, dielektrikda sinish, qutblanish (qabul qiluvchi vibrator).
//    Sahnada nurlatgich va qabul qiluvchi suriladi. β(α) va cos²φ grafiklari.
// 3) Radioaloqa: mikrofon → generator → modulyator (AM/FM) → antenna; priyomnik: kontur (sozlash) → detektor → karnay.
//    Uchta stansiya; sahnadagi shkalada sozlash; kontur aslligi Q; rezonans egri chizig'i.
// Fizika: emwaves-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./emwaves-physics.js";
import { drawEt, drawSpectrum, drawAngles, drawPolar, drawResonance, drawSignal, lastFrame } from "./emwaves-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const MEDIA = {
  vac: { name: "Vakuum (havo)", n: 1 },
  water: { name: "Suv (radioto‘lqinlar uchun n ≈ 9)", n: 9 },
  glass: { name: "Shisha (yorug‘lik uchun n ≈ 1,5)", n: 1.5 },
};
const L_RX = 200e-6; // priyomnik g'altagi, H
const VIS_K = 14;    // ossillogrammada: tashuvchi «tebranishlari»/ms = 14·f(MHz) (kamaytirilgan)

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "wave", tab: "et", speed: 1, hover: null };
const wave = { lg: 8, E0: 50, med: "vac", probe: 0.55, showB: true, u: 0, hist: [] };
const props = { view: "reflect", a: 40 * DEG, n: 1.5, phi: 30 * DEG, ph: 0 };
const radio = { mod: "am", F: 1, m: 0.6, C: 260e-12, Q: 40, t: 0 };
const STATIONS = [
  { f: 0.70e6, F: 1, m: 0.6, label: "1-stansiya", own: true },
  { f: 0.99e6, F: 2.2, m: 0.5, label: "2-stansiya" },
  { f: 1.27e6, F: 0.5, m: 0.8, label: "3-stansiya" },
];
let presetId = null, running = false;
const geo = {};

const nu = () => 10 ** wave.lg;
const med = () => MEDIA[wave.med];
const f0 = () => P.resonance(L_RX, radio.C);
const stationsNow = () => STATIONS.map((s) => (s.own ? { ...s, F: radio.F, m: radio.m, mod: radio.mod } : { ...s, mod: "am" }));

/* ------------------------------------------------------------------ Radio signallari (ossillogramma, ms) */

const WIN = 2, NS = 480;
function stationSig(s, t) { // t — ms
  const fv = VIS_K * (s.f / 1e6);
  return s.mod === "fm" ? P.fmSignal(t, { f: fv, F: s.F, df: s.m * fv * 0.35 }) : P.amSignal(t, { f: fv, F: s.F, m: s.m });
}
/** Joriy oynadagi barcha signallar (detektor uchun 1 ms oldindan boshlanadi) */
function radioTraces() {
  const st = stationsNow(), own = st[0], fz = f0(), dt = WIN / NS, pre = Math.round(1 / dt), t0 = radio.t;
  const resp = st.map((s) => P.response(s.f, fz, radio.Q));
  const ts = Array.from({ length: NS + pre + 1 }, (_, k) => t0 - 1 + k * dt);
  const rx = ts.map((t) => st.reduce((sum, s, i) => sum + resp[i] * stationSig(s, t), 0));
  // RC detektor: tashuvchi davridan katta, lekin konvert pasayishiga ulguradigan (τ ≲ √(1 − m²)/(mΩ)) — eng yuqori tovush chastotasi bo'yicha
  const fvMean = VIS_K * (fz / 1e6), Fmax = Math.max(...st.map((s) => s.F));
  const det = P.detect(rx, dt, Math.max(1.5 / fvMean, 0.3 / Fmax));
  const win = (arr) => arr.slice(pre);
  const audioOwn = ts.map((t) => Math.cos(TAU * own.F * t));
  // detektor chiqishi: doimiy tashkil etuvchisi olib tashlanadi; FM stansiya — ideal chastota detektori
  // tovush kuchaytirgichi oldidagi filtr: bir tashuvchi davri bo'yicha o'rtacha (detektor pulsatsiyasini silliqlaydi)
  const per = Math.max(1, Math.round(1 / (fvMean * dt))), sm = det.map((_, k) => { let sum = 0, n = 0; for (let j = Math.max(0, k - per + 1); j <= k; j++) { sum += det[j]; n++; } return sum / n; });
  const detW = win(det), smW = win(sm), mean = smW.reduce((a, b) => a + b, 0) / smW.length;
  const out = smW.map((v, k) => v - mean + (own.mod === "fm" ? resp[0] * own.m * win(audioOwn)[k] : 0));
  return {
    audio: win(audioOwn).map((v) => v * (own.mod === "fm" ? 1 : own.m)),
    carrier: win(ts).map((t) => Math.cos(TAU * VIS_K * (own.f / 1e6) * t)),
    mod: win(ts).map((t) => stationSig(own, t)),
    rx: win(rx), det: detW, out, resp,
  };
}
function received() {
  const st = stationsNow(), r = st.map((s) => P.response(s.f, f0(), radio.Q)), best = r.indexOf(Math.max(...r));
  const second = Math.max(...r.filter((_, i) => i !== best));
  return { r, best: r[best] > 0.5 ? best : null, mixed: r[best] > 0.5 && second > 0.2, level: r[best] };
}

/* ------------------------------------------------------------------ 1. EM to'lqin */

function drawWaveStage(ctx, c, w, h) {
  const n = med().n, x0 = 74, x1 = w - 24, Lpx = x1 - x0, lam = Lpx / 2.5, cy = h * 0.5, Ay = h * 0.3, Ab = Math.min(h * 0.22, 70);
  const bx = -0.62, by = 0.42, u = wave.u, phase = (x) => TAU * u - (TAU * (x - x0)) / lam;
  const vc = P.visibleColor(nu());
  geo.wave = { x0, x1, cy };
  if (n > 1) { ctx.fillStyle = wave.med === "water" ? (c.dark ? "rgba(56,189,248,0.10)" : "rgba(14,165,233,0.08)") : (c.dark ? "rgba(148,163,184,0.10)" : "rgba(100,116,139,0.07)"); ctx.fillRect(x0, 8, Lpx, h - 16); }
  // o'qlar
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
  arrow(ctx, x1 - 40, cy, 36, 0, c.text2, { width: 2, head: 8 });
  ctx.font = BOLD; ctx.fillStyle = c.text2; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText(n > 1 ? "v = c/n" : "v = c", x1, cy + 8);
  ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + bx * Ab * 1.2, cy + by * Ab * 1.2); ctx.stroke(); ctx.setLineDash([]);
  // B (perspektivada)
  if (wave.showB) {
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath();
    for (let x = x0; x <= x1; x += 2) { const v = Math.cos(phase(x)) * Ab; const X = x + bx * v, Y = cy + by * v; if (x === x0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    ctx.stroke();
    for (let x = x0 + lam / 16; x <= x1; x += lam / 8) { const v = Math.cos(phase(x)) * Ab; if (Math.abs(v) > 6) { ctx.globalAlpha = 0.6; arrow(ctx, x, cy, bx * v, by * v, c.primary, { width: 1.4, head: 6 }); ctx.globalAlpha = 1; } }
  }
  // E
  const ecol = vc || c.danger;
  ctx.strokeStyle = ecol; ctx.lineWidth = 2.8; ctx.beginPath();
  for (let x = x0; x <= x1; x += 2) { const y = cy - Math.cos(phase(x)) * Ay; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  for (let x = x0 + lam / 16; x <= x1; x += lam / 8) { const v = Math.cos(phase(x)) * Ay; if (Math.abs(v) > 6) { ctx.globalAlpha = 0.6; arrow(ctx, x, cy, 0, -v, ecol, { width: 1.4, head: 6 }); ctx.globalAlpha = 1; } }
  ctx.font = "700 14px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = ecol; ctx.fillText("E", x0 + 6, cy - Ay - 10);
  if (wave.showB) { ctx.fillStyle = c.primary; ctx.fillText("B", x0 + bx * Ab - 14, cy + by * Ab + 8); }
  // λ qavs: ikki qo'shni cho'qqi orasida
  const xc = (k) => x0 + (u - k) * lam; // cho'qqi: faza = 2π(u − (x − x0)/λ) = 2πk
  let xa = xc(Math.floor(u)); while (xa < x0 + 20) xa += lam; const xb = xa + lam;
  if (xb < x1 - 10) {
    const yb = cy - Ay - 22; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xa, yb + 6); ctx.lineTo(xa, yb); ctx.lineTo(xb, yb); ctx.lineTo(xb, yb + 6); ctx.stroke();
    tag(ctx, `λ = ${sci(P.lambdaOf(nu(), n), 3)} m`, (xa + xb) / 2, yb, { color: c.text, bg: c.bg, align: "center", font: MID });
  }
  // vibrator (antenna)
  const ax = 30, q = Math.cos(TAU * u);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, cy - 58); ctx.lineTo(ax, cy - 6); ctx.moveTo(ax, cy + 6); ctx.lineTo(ax, cy + 58); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(ax, cy, 5, 0, TAU); ctx.fill();
  [[cy - 52, q], [cy + 52, -q]].forEach(([y, s]) => { ctx.fillStyle = s > 0 ? c.danger : c.primary; ctx.globalAlpha = 0.3 + 0.7 * Math.abs(s); ctx.beginPath(); ctx.arc(ax, y, 9, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.font = "700 11px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s > 0 ? "+" : "−", ax, y + 0.5); });
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("vibrator", ax, cy + 66);
  // o'lchov nuqtasi
  const px = x0 + wave.probe * Lpx, Ep = Math.cos(phase(px));
  ctx.strokeStyle = c.warning; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, 14); ctx.lineTo(px, h - 14); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(px, cy - Ep * Ay, 6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.roundRect(px - 9, h - 26, 18, 16, 4); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⇔", px, h - 18);
  geo.probe = { x: px, y0: 14, y1: h - 10 };
  tag(ctx, `E = ${fmt(Ep * wave.E0, 1)} V/m`, clamp(px + 10, 4, w - 120), h - 44, { color: c.text, bg: c.bg2, font: MID });
  // diapazon
  const b = P.bandOf(nu());
  tag(ctx, `${b.name}${P.radioBand(nu()) ? ": " + P.radioBand(nu()) : ""} · ${MEDIA[wave.med].name.split(" (")[0]}`, x0, 18, { color: c.text, bg: c.bg2, font: MID });
}

/* ------------------------------------------------------------------ 2. Xossalari */

function horn(ctx, c, x, y, ang, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-26, -7); ctx.lineTo(-8, -7); ctx.lineTo(4, -16); ctx.lineTo(4, 16); ctx.lineTo(-8, 7); ctx.lineTo(-26, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function beam(ctx, c, x, y, dir, len, lamPx, phase, col, alpha = 1, width = 26) {
  const ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
  ctx.save(); ctx.globalAlpha = 0.14 * alpha; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x + nx * width / 2, y + ny * width / 2); ctx.lineTo(x + ux * len + nx * width / 2, y + uy * len + ny * width / 2); ctx.lineTo(x + ux * len - nx * width / 2, y + uy * len - ny * width / 2); ctx.lineTo(x - nx * width / 2, y - ny * width / 2); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 2;
  for (let s = ((phase % 1) + 1) % 1 * lamPx; s < len; s += lamPx) { const cx = x + ux * s, cy = y + uy * s; ctx.beginPath(); ctx.moveTo(cx + nx * width / 2, cy + ny * width / 2); ctx.lineTo(cx - nx * width / 2, cy - ny * width / 2); ctx.stroke(); }
  ctx.restore();
  arrow(ctx, x + ux * len * 0.55, y + uy * len * 0.55, ux * 24, uy * 24, col, { width: 2, head: 8 });
}
function drawPropsStage(ctx, c, w, h) {
  const v = props.view;
  if (v === "polar") return drawPolarStage(ctx, c, w, h);
  const yb = h * 0.62, Hx = w * 0.45, R = Math.min(w * 0.4, h * 0.56), a = props.a, lamPx = 18, ph = props.ph;
  // chegara
  if (v === "reflect") { ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.fillRect(16, yb, w - 32, 8); ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("metall list", 20, yb + 12); }
  else { ctx.fillStyle = c.dark ? "rgba(250,204,21,0.12)" : "rgba(250,204,21,0.18)"; ctx.fillRect(16, yb, w - 32, h - yb - 8); ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(16, yb); ctx.lineTo(w - 16, yb); ctx.stroke(); ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`dielektrik (parafin, asfalt), n = ${fmt(props.n, 2)}`, 20, yb + 6); }
  // normal
  ctx.strokeStyle = c.text3; ctx.setLineDash([4, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Hx, yb - R * 0.95); ctx.lineTo(Hx, Math.min(h - 10, yb + R * 0.6)); ctx.stroke(); ctx.setLineDash([]);
  // tushuvchi
  const ex = Hx - Math.sin(a) * R, ey = yb - Math.cos(a) * R, din = Math.atan2(yb - ey, Hx - ex);
  beam(ctx, c, ex, ey, din, R, lamPx, ph, c.danger);
  horn(ctx, c, ex, ey, din, c.danger);
  geo.emitter = { x: ex, y: ey, Hx, yb };
  // qaytgan
  const Rr = v === "reflect" ? 1 : P.reflectance(1, props.n, a), dref = Math.atan2(-Math.cos(a), Math.sin(a));
  beam(ctx, c, Hx, yb, dref, R, lamPx, ph, c.warning, v === "reflect" ? 1 : Math.max(0.25, Math.sqrt(Rr)));
  if (v === "reflect") horn(ctx, c, Hx + Math.sin(a) * R, yb - Math.cos(a) * R, dref + Math.PI, c.success);
  // singan
  if (v === "refract") {
    const b = P.refractAngle(1, props.n, a), dr = Math.atan2(Math.cos(b), Math.sin(b)), len = Math.min((h - yb - 10) / Math.max(0.2, Math.cos(b)), R);
    beam(ctx, c, Hx, yb, dr, len, lamPx / props.n, ph * props.n, c.primary);
    ctx.font = MID; ctx.fillStyle = c.primary; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`β = ${fmt(b / DEG, 1)}°`, Hx + 10, yb + 46);
    ctx.beginPath(); ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; ctx.arc(Hx, yb, 32, Math.PI / 2, Math.PI / 2 - b, true); ctx.stroke();
  } else { ctx.font = MID; ctx.fillStyle = c.warning; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`β = ${fmt(a / DEG, 1)}°`, Hx + 8, yb - 44); ctx.strokeStyle = c.warning; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(Hx, yb, 36, -Math.PI / 2, -Math.PI / 2 + a); ctx.stroke(); }
  ctx.strokeStyle = c.danger; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(Hx, yb, 30, -Math.PI / 2 - a, -Math.PI / 2); ctx.stroke();
  ctx.font = MID; ctx.fillStyle = c.danger; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(`α = ${fmt(a / DEG, 1)}°`, Hx - 8, yb - 44);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("nurlatgich (generator)", 16, 10);
  if (v === "refract" && w > 520) ctx.fillText(`dielektrikda λ' = λ/n, qaytgan ulush ${fmt(Rr * 100, 1)} %`, w - 250, 10);
}
function drawPolarStage(ctx, c, w, h) {
  const cy = h * 0.5, ex = 60, rx = w * 0.72, len = Math.min(64, h * 0.22), ph = props.ph, phi = props.phi;
  // nurlatgich vibrator (vertikal)
  ctx.strokeStyle = c.text2; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ex, cy - len); ctx.lineTo(ex, cy - 5); ctx.moveTo(ex, cy + 5); ctx.lineTo(ex, cy + len); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(ex, cy, 5, 0, TAU); ctx.fill();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("nurlatgich", ex, cy + len + 8);
  // to'lqin: E vertikal
  const x0 = ex + 24, x1 = rx - 40, lam = (x1 - x0) / 3;
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.4; ctx.beginPath();
  for (let x = x0; x <= x1; x += 2) { const y = cy - Math.cos(TAU * ph - (TAU * (x - x0)) / lam) * len * 0.8; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.font = BOLD; ctx.fillStyle = c.danger; ctx.textAlign = "left"; ctx.fillText("E ↕", x0 + 4, cy - len - 4);
  // qabul qiluvchi (burilgan)
  const dx = Math.sin(phi) * len, dy = -Math.cos(phi) * len, P0 = P.receiverPower(phi);
  ctx.strokeStyle = c.success; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(rx - dx, cy - dy); ctx.lineTo(rx - dx * 0.08, cy - dy * 0.08); ctx.moveTo(rx + dx * 0.08, cy + dy * 0.08); ctx.lineTo(rx + dx, cy + dy); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rx, cy - len - 10); ctx.lineTo(rx, cy + len + 10); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(rx, cy, 26, -Math.PI / 2, -Math.PI / 2 + phi, false); ctx.stroke();
  ctx.font = MID; ctx.fillStyle = c.warning; ctx.textAlign = "left"; ctx.fillText(`φ = ${fmt(phi / DEG, 0)}°`, rx + 12, cy - len - 2);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(rx + dx, cy + dy, 9, 0, TAU); ctx.fill(); ctx.stroke();
  geo.rxHandle = { x: rx + dx, y: cy + dy, cx: rx, cy };
  // indikator lampa
  const lx = Math.min(w - 40, rx + len + 50), ly = cy;
  if (P0 > 0.02) { const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 14 + 26 * P0); g.addColorStop(0, `rgba(250,204,21,${0.9 * P0})`); g.addColorStop(1, "rgba(250,204,21,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 14 + 26 * P0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = P0 > 0.05 ? `rgba(254,240,138,${0.4 + 0.6 * P0})` : c.bg2; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx, ly, 11, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`signal ${fmt(P0 * 100, 0)} %`, lx, ly + 18);
  ctx.fillText("qabul qiluvchi vibrator", rx, cy + len + 18);
}

/* ------------------------------------------------------------------ 3. Radioaloqa */

function scope(ctx, c, x, y, w, h, ys, col, title, extra) {
  ctx.fillStyle = c.dark ? "#0b1220" : "#f8fafc"; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.grid; ctx.beginPath(); ctx.moveTo(x + 4, y + h / 2 + 6); ctx.lineTo(x + w - 4, y + h / 2 + 6); ctx.stroke();
  const draw = (arr, color, lw) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); arr.forEach((v, k) => { const X = x + 4 + (k / (arr.length - 1)) * (w - 8), Y = y + h / 2 + 6 - clamp(v, -1.8, 1.8) * (h - 22) / 3.8; if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); };
  draw(ys, col, 1.4);
  if (extra) draw(extra.ys, extra.col, 2);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(title, x + 6, y + 4);
}
function drawRadioStage(ctx, c, w, h) {
  const tr = radioTraces(), rc = received(), narrow = w < 560, st = stationsNow();
  const gap = 10, x0 = 12, sw = (w - x0 - 64 - gap * 2) / 3, sh = Math.min(86, h * 0.27), y1 = 22, y2 = h * 0.5 + 6;
  ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(`Radiouzatgich: ${st[0].label} (${fmt(st[0].f / 1e6, 2)} MHz, ${radio.mod.toUpperCase()})`, x0, 4);
  const s1 = (k) => x0 + k * (sw + gap);
  scope(ctx, c, s1(0), y1, sw, sh, tr.audio, c.success, narrow ? "tovush" : "Mikrofon: tovush (F)");
  scope(ctx, c, s1(1), y1, sw, sh, tr.carrier, c.text2, narrow ? "tashuvchi" : "Generator: tashuvchi (f)");
  scope(ctx, c, s1(2), y1, sw, sh, tr.mod, c.danger, narrow ? "modulyatsiya" : radio.mod === "am" ? "Modulyator: AM signal" : "Modulyator: FM signal");
  // antenna minorasi
  const ax = w - 36, ay = y1 + sh;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax - 12, ay); ctx.lineTo(ax, y1 - 4); ctx.lineTo(ax + 12, ay); ctx.moveTo(ax - 8, ay - 20); ctx.lineTo(ax + 8, ay - 20); ctx.stroke();
  const pulse = (radio.t * 0.8) % 1;
  for (let k = 0; k < 3; k++) { const r = 8 + ((pulse + k / 3) % 1) * 26; ctx.strokeStyle = c.danger; ctx.globalAlpha = 1 - ((pulse + k / 3) % 1); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ax, y1 - 4, r, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke(); ctx.globalAlpha = 1; }
  // priyomnik
  ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(`Radiopriyomnik: f₀ = ${fmt(f0() / 1e6, 3)} MHz`, x0, y2 - 18);
  scope(ctx, c, s1(0), y2, sw, sh, tr.rx, c.primary, narrow ? "kontur" : "Kontur: tanlangan signal");
  scope(ctx, c, s1(1), y2, sw, sh, tr.det.map((v) => v), c.warning, narrow ? "detektor" : "Detektor (diod + RC)", { ys: tr.rx.map((v) => Math.max(0, v)), col: c.dark ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.3)" });
  scope(ctx, c, s1(2), y2, sw, sh, tr.out.map((v) => v * 1.2), c.success, narrow ? "karnay" : "Karnayga: tovush");
  // karnay
  const kx = w - 36, ky = y2 + sh / 2, lvl = rc.best !== null ? rc.level : 0;
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.moveTo(kx - 14, ky - 6); ctx.lineTo(kx - 6, ky - 6); ctx.lineTo(kx + 4, ky - 14); ctx.lineTo(kx + 4, ky + 14); ctx.lineTo(kx - 6, ky + 6); ctx.lineTo(kx - 14, ky + 6); ctx.closePath(); ctx.fill();
  for (let k = 1; k <= 3; k++) { ctx.strokeStyle = c.success; ctx.globalAlpha = lvl * (1 - k / 4); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(kx + 4, ky, 6 + k * 6, -0.6, 0.6); ctx.stroke(); ctx.globalAlpha = 1; }
  // sozlash shkalasi
  const dx0 = x0 + 20, dx1 = w - 30, dy = h - 26, X = (f) => dx0 + ((f / 1e6 - 0.5) / 1.1) * (dx1 - dx0);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(dx0 - 12, dy - 12, dx1 - dx0 + 24, 26, 6); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let f = 0.5; f <= 1.6001; f += 0.1) { ctx.fillRect(X(f * 1e6), dy - 3, 1, 6); if (Math.round(f * 10) % 2 === 1 || !narrow) ctx.fillText(fmt(f, 1), X(f * 1e6), dy + 9 > h - 4 ? dy - 8 : dy - 8); }
  st.forEach((s) => { ctx.fillStyle = c.success; ctx.globalAlpha = 0.6; ctx.fillRect(X(s.f) - 1, dy - 10, 3, 20); ctx.globalAlpha = 1; });
  const px = X(f0()); ctx.fillStyle = c.danger; ctx.fillRect(px - 1.5, dy - 12, 3, 26);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, dy + 1, 8, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.font = "700 10px Inter, system-ui, sans-serif"; ctx.fillText("⇔", px, dy + 1.5);
  geo.dial = { x0: dx0, x1: dx1, y: dy };
}

/* ------------------------------------------------------------------ Asosiy chizish va grafik */

function draw(ctx, st) {
  const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "wave") drawWaveStage(ctx, c, st.w, st.h);
  else if (ui.mode === "props") drawPropsStage(ctx, c, st.w, st.h);
  else drawRadioStage(ctx, c, st.w, st.h);
}
const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(vh * 0.42, 300, 350)), graph: Math.round(clamp(vh * 0.28, 190, 260)) };
};
const stage = createStage($("#stage"), draw, { height: () => heights().stage });

function drawGraphCanvas(ctx, gst) {
  const c = gst.colors;
  if (ui.mode === "wave") return ui.tab === "spec" ? drawSpectrum(ctx, gst, { nu: nu(), hover: ui.hover }) : drawEt(ctx, gst, { hist: wave.hist, win: 3, E0: wave.E0, T: 1 / nu(), hover: ui.hover });
  if (ui.mode === "props") return props.view === "polar" ? drawPolar(ctx, gst, { phi: props.phi, hover: ui.hover }) : drawAngles(ctx, gst, { n: props.n, alpha: props.a, reflect: props.view === "reflect", hover: ui.hover });
  if (ui.tab === "sig") { const tr = radioTraces(); return drawSignal(ctx, gst, { win: WIN, traces: [{ ys: tr.rx, color: c.primary, label: "Kontur chiqishi" }, { ys: tr.det, color: c.warning, label: "Detektor", width: 2.4 }] }); }
  const cols = [c.success, c.special, c.warning];
  return drawResonance(ctx, gst, { f0: f0(), Q: radio.Q, stations: STATIONS.map((s, i) => ({ f: s.f, label: s.label, color: cols[i] })), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

const TABS = {
  wave: { et: ["O‘lchov nuqtasida E(t)", "Elektr va magnit maydonlar bir xil fazada tebranadi: E maksimal bo‘lganda B ham maksimal (B = E/c). Gorizontal o‘q — davrlarda. O‘lchov nuqtasini sahnada suring."], spec: ["Elektromagnit to‘lqinlar shkalasi", "Radioto‘lqinlardan gamma-nurlanishgacha — barchasi bitta tabiatli EM to‘lqinlar, faqat chastotasi (to‘lqin uzunligi) bilan farq qiladi. Kursor bilan diapazonlarni o‘qing."] },
  props: { ang: ["Burchaklar", ""] },
  radio: { rez: ["Qabul qiluvchi kontur rezonansi", "Kontur faqat o‘z rezonans chastotasiga yaqin stansiyalarni o‘tkazadi. Q katta — egri chiziq tor (tanlovchanlik yuqori). Shtrix — 0,707 daraja, o‘tkazish polosasi Δf = f₀/Q."], sig: ["Kontur va detektor signallari", "Detektor (diod) signalning faqat musbat yarmini o‘tkazadi, RC filtr tashuvchi tebranishlarni silliqlaydi — tovush chastotali konvert qoladi."] },
};
const TAB_LABEL = { et: "E(t)", spec: "EM spektr", ang: "", rez: "Rezonans", sig: "Signal" };
function setTab(tab) {
  ui.tab = TABS[ui.mode][tab] ? tab : Object.keys(TABS[ui.mode])[0];
  let t = TABS[ui.mode][ui.tab];
  if (ui.mode === "props") t = props.view === "polar" ? ["Qabul qilingan signal P(φ)", "Vibrator to‘lqinning E vektoriga parallel bo‘lsa signal maksimal, perpendikulyar bo‘lsa — nol: EM to‘lqin ko‘ndalang va qutblangan. P = P₀cos²φ."] : props.view === "reflect" ? ["Qaytish qonuni β(α)", "EM to‘lqin metall listdan yorug‘lik kabi qaytadi: qaytish burchagi tushish burchagiga teng."] : ["Sinish qonuni β(α)", `Dielektrikda to‘lqin sekinroq (v = c/n) va sinadi: sinα = n·sinβ. n = ${fmt(props.n, 2)}. Shtrix — sinmasdan o‘tganda (β = α).`];
  const keys = Object.keys(TABS[ui.mode]);
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
const sciU = (v, unit) => u(sci(v, 3), unit);
function fmtHz(f) { return f >= 1e9 ? u(sci(f / 1e9, 3), "GHz") : f >= 1e6 ? u(sci(f / 1e6, 3), "MHz") : f >= 1e3 ? u(sci(f / 1e3, 3), "kHz") : u(sci(f, 3), "Hz"); }

function updateReadouts() {
  if (ui.mode === "wave") {
    const f = nu(), n = med().n, lam = P.lambdaOf(f, n), v = P.speedIn(n), b = P.bandOf(f);
    setRO("r1", "Chastota <i>ν</i>", f < 1e12 ? fmtHz(f) : sciU(f, "Hz"), `T = 1/ν = ${sci(1 / f, 3)} s`);
    setRO("r2", "To‘lqin uzunligi <i>λ</i>", sciU(lam, "m"), n > 1 ? `vakuumda ${sci(P.lambdaOf(f), 3)} m; muhitda n marta qisqa` : "λ = c/ν");
    setRO("r3", "Tarqalish tezligi <i>v</i>", sciU(v, "m/s"), n > 1 ? `v = c/n, n = ${fmt(n, 1)}` : "c = 1/√(ε₀μ₀)");
    setRO("r4", "Elektr maydon <i>E₀</i>", u(fmt(wave.E0, 0), "V/m"), `intensivlik I = cε₀E₀²/2 = ${sci(P.intensity(wave.E0), 3)} W/m²`);
    setRO("r5", "Magnit induksiya <i>B₀</i>", sciU(wave.E0 / v, "T"), "B₀ = E₀/v — juda kichik");
    setRO("r6", "Diapazon", b.name, P.radioBand(f) || (b.id === "vis" ? `λ = ${fmt(P.lambdaOf(f) * 1e9, 0)} nm` : "EM spektr qismi"), "orange");
    return;
  }
  if (ui.mode === "props") {
    if (props.view === "polar") {
      const p = P.receiverPower(props.phi);
      setRO("r1", "Burchak <i>φ</i>", u(fmt(props.phi / DEG, 0), "°"), "vibrator va E vektori orasida");
      setRO("r2", "Qabul qilingan quvvat", u(fmt(p * 100, 1), "%"), "P = P₀cos²φ", "orange");
      setRO("r3", "Induksiyalangan kuchlanish", u(fmt(Math.abs(Math.cos(props.phi)) * 100, 1), "%"), "U ∝ E·cosφ");
      setRO("r4", "Qutblanish", "chiziqli", "E vektori vertikal tekislikda tebranadi");
      setRO("r5", "Xulosa", p > 0.95 ? "maksimal" : p < 0.05 ? "signal yo‘q" : "qisman", p < 0.05 ? "vibrator E ga perpendikulyar" : "EM to‘lqin — ko‘ndalang to‘lqin");
      setRO("r6", "To‘lqin uzunligi", u("≈ 10", "cm"), "Gers tajribalari: dm va cm to‘lqinlar");
      return;
    }
    const a = props.a, refl = props.view === "reflect", b = refl ? a : P.refractAngle(1, props.n, a);
    setRO("r1", "Tushish burchagi <i>α</i>", u(fmt(a / DEG, 1), "°"), "normal bilan orasida");
    setRO("r2", refl ? "Qaytish burchagi <i>β</i>" : "Sinish burchagi <i>β</i>", u(fmt(b / DEG, 1), "°"), refl ? "β = α" : `sinβ = sinα/n = ${fmt(Math.sin(b), 3)}`, "orange");
    setRO("r3", refl ? "Qaytgan ulush" : "Qaytgan ulush (dielektrik)", u(fmt((refl ? 1 : P.reflectance(1, props.n, a)) * 100, 1), "%"), refl ? "metall EM to‘lqinni deyarli to‘liq qaytaradi" : "qolgani dielektrikka o‘tadi");
    setRO("r4", "Sindirish ko‘rsatkichi <i>n</i>", refl ? "—" : fmt(props.n, 2), refl ? "metall — o‘tkazgich" : "n = sinα/sinβ = c/v");
    setRO("r5", "Dielektrikdagi tezlik", refl ? "—" : sciU(P.speedIn(props.n), "m/s"), refl ? "" : "v = c/n");
    setRO("r6", "Dielektrikdagi λ", refl ? "—" : u(fmt(10 / props.n, 2), "cm"), refl ? "" : "λ' = λ/n (λ = 10 cm uchun)");
    return;
  }
  const fz = f0(), rc = received(), st = stationsNow();
  setRO("r1", "Sozlangan chastota <i>ν₀</i>", u(fmt(fz / 1e6, 3), "MHz"), "ν₀ = 1/(2π√(LC))");
  setRO("r2", "Kondensator sig‘imi <i>C</i>", u(fmt(radio.C * 1e12, 0), "pF"), `L = ${fmt(L_RX * 1e6, 0)} μH`);
  setRO("r3", "To‘lqin uzunligi", u(fmt(P.lambdaOf(fz), 0), "m"), P.radioBand(fz));
  setRO("r4", "O‘tkazish polosasi <i>Δf</i>", u(fmt(P.bandwidth(fz, radio.Q) / 1e3, 1), "kHz"), `Δf = ν₀/Q, Q = ${fmt(radio.Q, 0)}`);
  setRO("r5", "Eshitilmoqda", rc.best === null ? "hech narsa" : rc.mixed ? "aralash" : st[rc.best].label, rc.best === null ? "stansiyaga sozlang" : rc.mixed ? "ikki stansiya bir vaqtda — Q ni oshiring" : `${fmt(st[rc.best].f / 1e6, 2)} MHz, tovush ${fmt(st[rc.best].F, 1)} kHz`, rc.best === null ? "" : "orange");
  setRO("r6", radio.mod === "am" ? "Modulyatsiya chuqurligi <i>m</i>" : "Chastota og‘ishi", radio.mod === "am" ? fmt(radio.m, 2) : u(fmt(radio.m * 75, 0), "kHz"), radio.mod === "am" ? "1-stansiya, AM" : "1-stansiya, FM (Δf)");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "wave") { t = P.bandOf(nu()).name; tone = "purple"; }
  else if (ui.mode === "props") { t = props.view === "reflect" ? "Qaytish: α = β" : props.view === "refract" ? "Sinish: sinα = n sinβ" : `Signal ${fmt(P.receiverPower(props.phi) * 100, 0)} %`; tone = "green"; }
  else { const rc = received(); t = rc.best === null ? "Shovqin: stansiya yo‘q" : rc.mixed ? "Stansiyalar aralashmoqda" : `Eshitilmoqda: ${STATIONS[rc.best].label}`; tone = rc.best === null ? "blue" : rc.mixed ? "orange" : "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "wave") {
    p.push("<p>Tezlanish bilan harakatlanayotgan zaryadlar (vibratordagi tebranuvchi tok) atrofida o‘zgaruvchan elektr maydon o‘zgaruvchan magnit maydonni, u esa yana elektr maydonni hosil qiladi — fazoda <b>elektromagnit to‘lqin</b> tarqaladi (Maksvell nazariyasi, Gers tajribasi). E va B o‘zaro perpendikulyar va tarqalish yo‘nalishiga ham perpendikulyar — to‘lqin <b>ko‘ndalang</b>.</p>");
    p.push(`<p>Vakuumda tezlik c = 1/√(ε₀μ₀) ≈ 3·10⁸ m/s — yorug‘lik tezligiga teng. Bu yorug‘lik ham EM to‘lqin ekanini ko‘rsatdi. ${med().n > 1 ? `Muhitda (n = ${fmt(med().n, 1)}) to‘lqin sekinroq va to‘lqin uzunligi qisqaroq, chastota esa o‘zgarmaydi.` : ""}</p>`);
    const b = P.bandOf(nu());
    p.push({ radio: "<p><b>Radioto‘lqinlar</b> radioeshittirish, televideniye va mobil aloqada ishlatiladi. Uzun va o‘rta to‘lqinlar Yer sirtini aylanib o‘tadi, qisqa to‘lqinlar ionosferadan qaytadi, UQT esa to‘g‘ri chiziq bo‘ylab (ko‘rinish chegarasigacha) tarqaladi.</p>", micro: "<p><b>Mikroto‘lqinlar</b>: radiolokatsiya, sun’iy yo‘ldosh aloqasi, Wi-Fi, mikroto‘lqinli pech (2,45 GHz — suv molekulalari tebranadi).</p>", ir: "<p><b>Infraqizil nurlanish</b> — issiq jismlar chiqaradi (issiqlik nurlanishi). Teplovizor, masofadan boshqarish pulti.</p>", vis: "<p><b>Ko‘rinadigan yorug‘lik</b> — ko‘z sezadigan tor oraliq: ≈ 380–750 nm. To‘lqin uzunligi rangni belgilaydi.</p>", uv: "<p><b>Ultrabinafsha nurlanish</b> — quyoshda tanani qoraytiradi, D vitamini hosil qiladi, bakteriyalarni o‘ldiradi; ko‘p miqdorda zararli.</p>", xray: "<p><b>Rentgen nurlari</b> — tez elektronlar to‘satdan tormozlanganda hosil bo‘ladi. Yumshoq to‘qimadan o‘tadi, suyakda yutiladi — tibbiyotda tasvir olish.</p>", gamma: "<p><b>Gamma-nurlanish</b> — yadro jarayonlarida chiqadi, eng katta energiyali EM to‘lqinlar.</p>" }[b.id]);
  } else if (ui.mode === "props") {
    p.push("<p>Genrix Gers (1888) EM to‘lqinlarning yorug‘lik kabi xossalarga ega ekanini isbotladi: metall listdan <b>qaytadi</b>, dielektrik prizmada <b>sinadi</b>, metall panjara orqali o‘tganda <b>qutblanadi</b>, shuningdek interferensiya va difraksiya hosil qiladi.</p>");
    p.push(props.view === "polar" ? "<p>Nurlatgich vibratori vertikal — to‘lqinning E vektori vertikal tebranadi. Qabul qiluvchi vibratorda tok faqat E ning vibrator bo‘ylab tashkil etuvchisi (E cosφ) hosil qiladi. Shuning uchun televizor antennalari uzatgich antennasi bilan bir xil holatda o‘rnatiladi.</p>" : props.view === "reflect" ? "<p>Radiolokatsiya shu xossaga asoslangan: radar impuls yuboradi va qaytgan signal kechikishidan masofani topadi: s = ct/2.</p>" : "<p>Dielektrikda to‘lqin tezligi kamayadi: v = c/n, n = √ε (radioto‘lqinlar uchun). Tezlik o‘zgargani uchun to‘lqin fronti buriladi — sinish.</p>");
  } else {
    p.push("<p><b>Radioaloqa</b>: tovush (past chastota, ~1 kHz) uzoqqa o‘zi tarqala olmaydi, shuning uchun u yuqori chastotali <b>tashuvchi</b> tebranishga «yuklanadi» — <b>modulyatsiya</b>. AM da tashuvchining amplitudasi, FM da chastotasi tovush bilan o‘zgaradi.</p>");
    p.push("<p>Priyomnikda antenna barcha stansiyalarni qabul qiladi. <b>Tebranish konturi</b> (L va C) faqat rezonans chastotasiga yaqin signalni kuchaytiradi — sozlash. <b>Detektor</b> (diod va RC filtr) tashuvchini olib tashlab tovush signalini ajratadi, karnay uni tovushga aylantiradi.</p>");
    if (radio.mod === "fm") p.push("<p>FM da amplituda o‘zgarmas — shovqinlarga chidamliroq, ovoz sifati yaxshiroq. FM stansiyalar odatda UQT diapazonida (88–108 MHz) ishlaydi; bu yerda taqqoslash uchun bir xil diapazonda ko‘rsatilgan.</p>");
    if (received().mixed) p.push("<p>Kontur aslligi past — o‘tkazish polosasi keng, qo‘shni stansiya ham eshitiladi. Q ni oshiring.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "wave" ? "<small>EM to‘lqin</small> λ = c/ν, c = 1/√(ε₀μ₀)" : ui.mode === "props" ? (props.view === "polar" ? "<small>Qutblanish</small> P = P₀cos²φ" : props.view === "reflect" ? "<small>Qaytish</small> α = β" : "<small>Sinish</small> sinα/sinβ = n") : "<small>Kontur</small> ν₀ = 1/(2π√(LC))";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  const s = dt * ui.speed;
  if (ui.mode === "wave") {
    wave.u += s * 0.6;
    const g = geo.wave; if (g) { const lam = (g.x1 - g.x0) / 2.5, px = wave.probe * (g.x1 - g.x0); wave.hist.push({ u: wave.u, e: Math.cos(TAU * wave.u - (TAU * px) / lam) }); }
    while (wave.hist.length && wave.hist[0].u < wave.u - 3) wave.hist.shift();
  } else if (ui.mode === "props") props.ph += s * 1.2;
  else radio.t += s * 0.5;
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.2) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => { if (loop.running) loop.stop(); else loop.start(); });
$("[data-reset]").addEventListener("click", () => { wave.u = 0; wave.hist = []; props.ph = 0; radio.t = 0; refresh(); });
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; syncSpeed(); }));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.speedValue === ui.speed)));
/** Animatsiyasiz rejimda E(t) grafigini bir martalik to'ldirish */
function fillHist() {
  const g = geo.wave; if (!g) return;
  const lam = (g.x1 - g.x0) / 2.5, px = wave.probe * (g.x1 - g.x0);
  const top = Math.max(wave.u, 3);
  wave.hist = Array.from({ length: 121 }, (_, k) => { const uu = top - 3 + (3 * k) / 120; return { u: uu, e: Math.cos(TAU * uu - (TAU * px) / lam) }; });
}

/* ------------------------------------------------------------------ Boshqaruv */

const fmtNu = (lg) => { const f = 10 ** lg; return f >= 1e9 && f < 1e12 ? `${sci(f / 1e9, 3)} GHz` : f >= 1e6 && f < 1e9 ? `${sci(f / 1e6, 3)} MHz` : f >= 1e3 && f < 1e6 ? `${sci(f / 1e3, 3)} kHz` : `${sci(f, 3)} Hz`; };
const wNuC = bindRange($("#wNu"), $("#wNuOut"), fmtNu, (v) => { wave.lg = v; customized(); if (!loop.running) fillHist(); refresh(); });
const wEC = bindRange($("#wE"), $("#wEOut"), (v) => `${fmt(v, 0)} V/m`, (v) => { wave.E0 = v; customized(); refresh(); });
const wMed = $("#wMed");
wMed.innerHTML = Object.entries(MEDIA).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
wMed.addEventListener("change", () => { wave.med = wMed.value; customized(); refresh(); });
$("[data-show-b]").addEventListener("change", (e) => { wave.showB = e.target.checked; stage.render(); });

document.querySelectorAll("[data-pview-value]").forEach((b) => b.addEventListener("click", () => { props.view = b.dataset.pviewValue; customized(); syncProps(); setTab("ang"); refresh(); }));
const pAC = bindRange($("#pA"), $("#pAOut"), (v) => `${fmt(v, 0)}°`, (v) => { props.a = v * DEG; customized(); refresh(); });
const pNC = bindRange($("#pN"), $("#pNOut"), (v) => fmt(v, 2), (v) => { props.n = v; customized(); setTab("ang"); refresh(); });
const pPhiC = bindRange($("#pPhi"), $("#pPhiOut"), (v) => `${fmt(v, 0)}°`, (v) => { props.phi = v * DEG; customized(); refresh(); });
function syncProps() {
  document.querySelectorAll("[data-pview-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pviewValue === props.view)));
  document.querySelectorAll("[data-pv]").forEach((el) => { el.hidden = !el.dataset.pv.split(" ").includes(props.view); });
  pAC.set(Math.round(props.a / DEG)); pNC.set(props.n); pPhiC.set(Math.round(props.phi / DEG));
}

document.querySelectorAll("[data-mod-value]").forEach((b) => b.addEventListener("click", () => { radio.mod = b.dataset.modValue; customized(); syncRadio(); refresh(); }));
const rFC = bindRange($("#rF"), $("#rFOut"), (v) => `${fmt(v, 1)} kHz`, (v) => { radio.F = v; customized(); refresh(); });
const rMC = bindRange($("#rM"), $("#rMOut"), (v) => (radio.mod === "am" ? fmt(v, 2) : `${fmt(v * 75, 0)} kHz`), (v) => { radio.m = v; customized(); refresh(); });
const rCC = bindRange($("#rC"), $("#rCOut"), (v) => `${fmt(v, 0)} pF (${fmt(P.resonance(L_RX, v * 1e-12) / 1e6, 3)} MHz)`, (v) => { radio.C = v * 1e-12; customized(); refresh(); });
const rQC = bindRange($("#rQ"), $("#rQOut"), (v) => fmt(v, 0), (v) => { radio.Q = v; customized(); refresh(); });
function syncRadio() {
  document.querySelectorAll("[data-mod-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modValue === radio.mod)));
  $("[data-m-label]").textContent = radio.mod === "am" ? "Modulyatsiya chuqurligi m" : "Chastota og‘ishi Δf";
  rFC.set(radio.F); rMC.set(radio.m); rCC.set(Math.round(radio.C * 1e12)); rQC.set(radio.Q);
}

/* Sahnada: o'lchov nuqtasi, nurlatgich, qabul qiluvchi, sozlash shkalasi */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function hit(p) {
  if (ui.mode === "wave" && geo.probe && Math.abs(p.x - geo.probe.x) <= 14 && p.y >= geo.probe.y0 && p.y <= geo.probe.y1) return { kind: "probe" };
  if (ui.mode === "props") {
    if (props.view === "polar" && geo.rxHandle && Math.hypot(p.x - geo.rxHandle.x, p.y - geo.rxHandle.y) <= 18) return { kind: "rx" };
    if (props.view !== "polar" && geo.emitter && Math.hypot(p.x - geo.emitter.x, p.y - geo.emitter.y) <= 30) return { kind: "emit" };
  }
  if (ui.mode === "radio" && geo.dial && p.x >= geo.dial.x0 - 14 && p.x <= geo.dial.x1 + 14 && Math.abs(p.y - geo.dial.y) <= 16) return { kind: "dial" };
  return null;
}
function dragTo(p) {
  if (drag.kind === "probe") { const g = geo.wave; wave.probe = clamp((p.x - g.x0) / (g.x1 - g.x0), 0.02, 0.98); wave.hist = []; if (!loop.running) fillHist(); }
  else if (drag.kind === "emit") { const e = geo.emitter, a = Math.atan2(e.Hx - p.x, e.yb - p.y); props.a = clamp(a, 0, 80 * DEG); pAC.set(Math.round(props.a / DEG)); }
  else if (drag.kind === "rx") { const g = geo.rxHandle; let a = Math.atan2(p.x - g.cx, -(p.y - g.cy)); if (a < 0) a += Math.PI; props.phi = clamp(a, 0, Math.PI); pPhiC.set(Math.round(props.phi / DEG)); }
  else if (drag.kind === "dial") { const d = geo.dial, f = (0.5 + clamp((p.x - d.x0) / (d.x1 - d.x0), 0, 1) * 1.1) * 1e6; radio.C = clamp(P.capFor(L_RX, f), 40e-12, 550e-12); rCC.set(Math.round(radio.C * 1e12)); radio.C = rCC.value * 1e-12; }
  refresh();
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  drag = h; customized(); e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  canvas.dataset.dragging = "true"; dragTo(p);
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (drag) { dragTo(p); return; }
  const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "probe" || h.kind === "dial" ? "ew-resize" : "grab";
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Grafikda kursor (ulush 0…1) */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) return;
  const p = ptr(gcv, e), r = f.rect;
  ui.hover = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h ? (p.x - r.x) / r.w : null;
  gcv.style.cursor = ui.hover !== null ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const LG = (f) => Math.log10(f);
const PRESETS = {
  fm100: { mode: "wave", title: "Radioto‘lqin: 100 MHz", lesson: "FM radio chastotasi 100 MHz: to‘lqin uzunligi 3 m. E va B bir xil fazada tebranadi, o‘zaro va tarqalish yo‘nalishiga perpendikulyar.", set: () => Object.assign(wave, { lg: 8, med: "vac", E0: 50 }) },
  mw: { mode: "wave", title: "O‘rta to‘lqin: λ ≈ 300 m", lesson: "1 MHz — o‘rta to‘lqinli radio: to‘lqin uzunligi 300 m. Shuning uchun bunday radiostansiyalarning antennalari juda baland.", set: () => Object.assign(wave, { lg: 6, med: "vac", E0: 50 }) },
  tv: { mode: "wave", title: "Televideniye: UQT", lesson: "Televizion signal 470–790 MHz (detsimetrli to‘lqinlar) da uzatiladi: tasvir signali keng chastota polosasini talab qiladi, buni faqat yuqori chastotali tashuvchi sig‘dira oladi. UQT to‘g‘ri chiziq bo‘ylab tarqaladi — teleminoralar baland quriladi, uzoqqa yo‘ldosh orqali uzatiladi.", set: () => Object.assign(wave, { lg: LG(600e6), med: "vac", E0: 50 }) },
  micro: { mode: "wave", title: "Mikroto‘lqin: 2,45 GHz", lesson: "Mikroto‘lqinli pech va Wi-Fi chastotasi: λ ≈ 12 cm. Suv molekulalari shu maydonda tebranib ovqatni isitadi.", set: () => Object.assign(wave, { lg: LG(2.45e9), med: "vac", E0: 50 }), tab: "spec" },
  light: { mode: "wave", title: "Yorug‘lik — EM to‘lqin", lesson: "Yashil yorug‘lik: ν ≈ 5,5·10¹⁴ Hz, λ ≈ 550 nm. Maksvell yorug‘lik tezligi c = 1/√(ε₀μ₀) ekanini hisoblab, yorug‘lik EM to‘lqin degan xulosaga keldi.", set: () => Object.assign(wave, { lg: LG(5.45e14), med: "vac", E0: 50 }), tab: "spec" },
  glass: { mode: "wave", title: "Shishada yorug‘lik sekinlashadi", lesson: "Shishada (n ≈ 1,5) yorug‘lik tezligi 2·10⁸ m/s gacha kamayadi, to‘lqin uzunligi ham 1,5 marta qisqaradi; chastota o‘zgarmaydi.", set: () => Object.assign(wave, { lg: LG(5.45e14), med: "glass", E0: 50 }) },
  xray: { mode: "wave", title: "Rentgen nurlari", lesson: "Rentgen nurlari: ν ≈ 10¹⁸ Hz, λ ≈ 0,3 nm — atom o‘lchami tartibida. Spektr grafigida IQ, UB, rentgen va gamma-nurlanish o‘rnini ko‘ring.", set: () => Object.assign(wave, { lg: 18, med: "vac", E0: 50 }), tab: "spec" },
  reflect: { mode: "props", title: "Metall listdan qaytish", lesson: "Gers tajribasi: generator karnay antennasidan chiqqan santimetrli to‘lqinlar metall listdan qaytadi. Nurlatgichni surib, qabul qiluvchi doim α = β yo‘nalishda signal olishini kuzating.", set: () => Object.assign(props, { view: "reflect", a: 40 * DEG }) },
  refract: { mode: "props", title: "Dielektrikda sinish", lesson: "To‘lqin parafin (n ≈ 1,5) ga o‘tganda sekinlashadi va sinadi: sinα = n·sinβ. To‘lqin fronti oralig‘i (λ) dielektrikda qisqaroq.", set: () => Object.assign(props, { view: "refract", a: 45 * DEG, n: 1.5 }) },
  polar: { mode: "props", title: "Qutblanish: vibratorni burish", lesson: "Qabul qiluvchi vibratorni burang: E ga parallel (φ = 0°) — signal maksimal, 90° da — nol. EM to‘lqin ko‘ndalang ekanining isboti.", set: () => Object.assign(props, { view: "polar", phi: 30 * DEG }) },
  am: { mode: "radio", title: "AM radio: modulyatsiya va detektorlash", lesson: "Tovush (1 kHz) tashuvchining amplitudasini o‘zgartiradi. Priyomnik 1-stansiyaga sozlangan: kontur uni tanlaydi, detektor konvertni ajratadi — karnayda o‘sha tovush.", set: () => { Object.assign(radio, { mod: "am", F: 1, m: 0.6, Q: 40 }); radio.C = P.capFor(L_RX, 0.70e6); } },
  tune: { mode: "radio", title: "Stansiyani sozlash", lesson: "Priyomnik stansiyalar orasiga sozlangan — hech narsa eshitilmaydi. Sahnadagi shkala tutqichini surib 2- va 3-stansiyani toping; tovush chastotalari har xil.", set: () => { Object.assign(radio, { mod: "am", F: 1, m: 0.6, Q: 40 }); radio.C = P.capFor(L_RX, 0.85e6); }, tab: "rez" },
  lowQ: { mode: "radio", title: "Past aslilik: stansiyalar aralashadi", lesson: "Q = 6: rezonans egri chizig‘i keng — 2-stansiyaga sozlanganda qo‘shnilar ham o‘tadi va tovushlar aralashadi. Q ni oshirib tanlovchanlikni yaxshilang.", set: () => { Object.assign(radio, { mod: "am", F: 1, m: 0.6, Q: 6 }); radio.C = P.capFor(L_RX, 0.99e6); } },
  fm: { mode: "radio", title: "FM: chastota modulyatsiyasi", lesson: "FM da tashuvchi amplitudasi o‘zgarmaydi, tovush bilan uning chastotasi o‘zgaradi (zichlashadi va siyraklashadi). Shovqin amplitudani buzsa ham tovush saqlanadi.", set: () => { Object.assign(radio, { mod: "fm", F: 1, m: 0.8, Q: 40 }); radio.C = P.capFor(L_RX, 0.70e6); }, tab: "sig" },
};
const GROUPS = [["EM to‘lqin va spektr", ["fm100", "mw", "tv", "micro", "light", "glass", "xray"]], ["Xossalari (Gers)", ["reflect", "refract", "polar"]], ["Radioaloqa", ["am", "tune", "lowQ", "fm"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { wave: "O‘lchov nuqtasini suring", props: "Nurlatgich yoki qabul qiluvchini suring", radio: "Priyomnik shkalasini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { wave: "Vibrator nurlatayotgan elektromagnit to‘lqin: E va B maydonlar", props: "Gers tajribalari: EM to‘lqinning qaytishi, sinishi va qutblanishi", radio: "Radiouzatgich va radiopriyomnik blok-sxemasi, ossillogrammalar va sozlash shkalasi" }[ui.mode]);
}
function syncAll() { wNuC.set(wave.lg); wEC.set(wave.E0); wMed.value = wave.med; $("[data-show-b]").checked = wave.showB; syncProps(); syncRadio(); syncSpeed(); }
const MODE_DEFAULT = { wave: "fm100", props: "reflect", radio: "am" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set(); wave.hist = []; wave.u = 0;
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || Object.keys(TABS[ui.mode])[0]);
  stage.render(); fillHist();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  setPlayUI(loop.running); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "fm100");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
