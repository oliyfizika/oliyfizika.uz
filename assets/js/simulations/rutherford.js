// ==========================================================================
// Rezerford tajribasi — virtual laboratoriya (simulations/rutherford.html)
// 1) Qurilma: vakuum kamera (tepadan), α-manba + kollimator, folga, aylanuvchi detektor (sudraladi), goniometr,
//    sanagich (vaqt, tezlashtirish), nasos va bosim, O‘lchovlar jurnali. Sanoq — Puasson jarayoni.
// 2) Yadro yaqinida: Kulon maydonidagi giperbolik traektoriyalar, nishon masofasi b (sudraladi), θ, r_min.
// 3) Laboratoriya daftari: 1-jadval (θ, t, N), 2-jadval (boshqa folgalar), hisoblashlar, xulosa, hisobot → PDF va .tex.
// Fizika: rutherford-physics.js, hisob: rutherford-lab.js (Node’da tekshirilgan); hisobot: rutherford-report.js + labreport.js (KaTeX → PDF, LaTeX manba).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow, angleArc, sci } from "./sim-kit.js";
import * as P from "./rutherford-physics.js";
import * as L from "./rutherford-lab.js";
import { buildRutherfordDoc, SITE_URL, SITE_LABEL, DOC_LABEL } from "./rutherford-report.js";
import { renderHTML, renderTeX } from "./labreport.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px Inter, system-ui, sans-serif";
const MONO = '700 30px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace';
const FOIL = { Au: "#d4a017", Ag: "#c0c7d1", Cu: "#c2693a", Al: "#9ca3af" };
const TIMES = [10, 30, 60, 100, 300, 600, 1200], SPEEDS = [1, 10, 100, 1000];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* xotira yo‘q */ } },
};

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "lab", t: 0 };
const lab = { mat: "Au", tUm: 2, src: "am", th: 30, T: 60, speed: 10, vacuum: true, p: 1, run: null, last: null, flashes: [], tracks: [], led: 0, spawn: 0 };
const micro = { b: 25, fan: true, anim: 0, cache: {} };
let journal = store.get("of-rutherford-journal-v1", []);
let presetId = null;
const geo = {};

/* ------------------------------------------------------------------ Yordamchi chizish */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(w, h, x0, x1, y0, y1, pad = 6) {
  const s = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (w - (x1 - x0) * s) / 2; view.oy = (h - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
function tagIn(ctx, text, x, y, cw, o) {
  ctx.save(); ctx.font = o.font || MID; const w = ctx.measureText(text).width + 2 * (o.pad ?? 6); ctx.restore();
  let x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  x0 = clamp(x0, 4, cw - 4 - w); tag(ctx, text, x0, y, { ...o, align: "left" });
}
function handle(ctx, c, x, y, r = 7) {
  ctx.save(); ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; circle(ctx, x, y, 2.5); ctx.fill(); ctx.restore();
}
function chipBtn(ctx, c, x, y, text, on, w) {
  ctx.save(); ctx.font = MID; const tw = w || ctx.measureText(text).width + 14, h = 22;
  ctx.fillStyle = on ? c.primary : c.dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"; ctx.beginPath(); ctx.roundRect(x, y, tw, h, 6); ctx.fill();
  ctx.fillStyle = on ? "#fff" : c.text2; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x + tw / 2, y + h / 2 + 0.5); ctx.restore();
  return { x0: x, x1: x + tw, y0: y, y1: y + h };
}
const presFmt = (p) => (p >= 1000 ? `${sci(p, 2)} Pa` : `${fmt(p, p < 10 ? 1 : 0)} Pa`);

/* ================================================================== 1) Qurilma */

const curRate = () => P.countRate({ mat: lab.mat, tUm: lab.tUm, E: P.SOURCES[lab.src].E, thDeg: lab.th, p: lab.p });
function startCount() {
  if (lab.run) return;
  lab.run = { t: 0, N: 0, T: lab.T, th: lab.th, mat: lab.mat, tUm: lab.tUm, src: lab.src, pMax: lab.p };
  lab.last = null; if (!loop.running) loop.start();
}
function abortCount(reason) { if (!lab.run) return; lab.run = null; lab.aborted = reason || "To‘xtatildi"; }
function finishCount() {
  const r = lab.run; lab.run = null;
  const rec = { id: (journal.at(-1)?.id || 0) + 1, mat: r.mat, tUm: r.tUm, src: r.src, th: r.th, t: r.T, N: r.N, p: Math.round(r.pMax), at: Date.now() };
  journal.push(rec); if (journal.length > 200) journal.shift();
  store.set("of-rutherford-journal-v1", journal);
  lab.last = rec; renderJournal(true); nbRefreshMatches();
}
function stepLab(dt) {
  // nasos / havo
  const target = lab.vacuum ? 1 : P.P_ATM;
  lab.p = lab.vacuum ? Math.max(1, lab.p * Math.exp(-dt * 2.6)) : Math.min(P.P_ATM, lab.p + (P.P_ATM - lab.p) * (1 - Math.exp(-dt * 1.5)) + 50 * dt);
  if (Math.abs(lab.p - target) < 0.5) lab.p = target;
  // sanoq
  if (lab.run) {
    const r = lab.run, dts = Math.min(dt * lab.speed, r.T - r.t), rate = P.countRate({ mat: r.mat, tUm: r.tUm, E: P.SOURCES[r.src].E, thDeg: r.th, p: lab.p }).rate;
    const k = P.poisson(rate * dts); r.N += k; r.t += dts; r.pMax = Math.max(r.pMax, lab.p);
    for (let i = 0; i < Math.min(k, 4); i++) lab.flashes.push({ age: 0, j: Math.random() });
    if (k > 0) lab.led = 0.12;
    if (r.t >= r.T - 1e-9) finishCount();
  }
  lab.led = Math.max(0, lab.led - dt);
  lab.flashes.forEach((f) => { f.age += dt; }); lab.flashes = lab.flashes.filter((f) => f.age < 0.35).slice(-12);
  // ko‘rgazmali treklar (statistikaga ta’sir qilmaydi)
  const blocked = curRate().blocked;
  lab.spawn += dt * 14;
  while (lab.spawn > 1) {
    lab.spawn -= 1; let th;
    if (Math.random() < 0.82) th = (Math.random() - 0.5) * 3 * DEG;
    else { const x0 = Math.sin(4 * DEG) ** 2, u = Math.random(), x = 1 / (1 / x0 - u * (1 / x0 - 1)); th = 2 * Math.asin(Math.sqrt(Math.min(1, x))) * (Math.random() < 0.5 ? -1 : 1); }
    lab.tracks.push({ age: 0, th, y0: (Math.random() - 0.5) * 0.25, stop: blocked ? 2 + Math.random() * 2.5 : 99 });
  }
  lab.tracks.forEach((t) => { t.age += dt; }); lab.tracks = lab.tracks.filter((t) => t.age < 1.6);
}

function drawLab(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  const S = narrow ? Math.min(ch - 14, cw - 8) : Math.min(ch - 12, cw * 0.6), cx = narrow ? cw / 2 : 8 + S / 2, cy = ch / 2;
  const R = 11.4; view.s = S / 2 / (R + 0.6); view.ox = cx; view.oy = cy; view.x0 = 0; view.y1 = 0;
  const s = view.s, X = (x) => cx + x * s, Y = (y) => cy - y * s;
  geo.lab = { cx, cy, s };
  // kamera
  ctx.fillStyle = c.dark ? "#141b2b" : "#f3f6fb"; circle(ctx, cx, cy, 11 * s); ctx.fill();
  ctx.strokeStyle = c.text2; ctx.lineWidth = Math.max(4, 0.35 * s); circle(ctx, cx, cy, 11.15 * s); ctx.stroke();
  // goniometr
  ctx.strokeStyle = c.text3; ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let a = -170; a <= 180; a += 5) {
    const r0 = a % 30 === 0 ? 10.1 : a % 10 === 0 ? 10.35 : 10.55, ca = Math.cos(a * DEG), sa = Math.sin(a * DEG);
    ctx.lineWidth = a % 30 === 0 ? 1.4 : 0.8; ctx.beginPath(); ctx.moveTo(X(10.85 * ca), Y(10.85 * sa)); ctx.lineTo(X(r0 * ca), Y(r0 * sa)); ctx.stroke();
    if (a % 30 === 0 && Math.abs(a) !== 180 && s > 9) ctx.fillText(`${a}°`, X(9.35 * ca), Y(9.35 * sa));
  }
  // manba va kollimator
  ctx.fillStyle = c.dark ? "#4b5563" : "#6b7280"; ctx.fillRect(X(-9.6), Y(1.5), 2.6 * s, 3 * s);
  ctx.fillStyle = "#f59e0b"; circle(ctx, X(-7.4), Y(0), Math.max(2.5, 0.28 * s)); ctx.fill();
  ctx.fillStyle = c.dark ? "#6b7280" : "#4b5563";
  [-5.6, -3.6].forEach((x) => { ctx.fillRect(X(x), Y(1.4), 0.35 * s, 1.25 * s); ctx.fillRect(X(x), Y(-0.15), 0.35 * s, 1.25 * s); });
  if (!narrow || s > 8) { ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.fillText(P.SOURCES[lab.src].name, X(-8.3), Y(-2.3)); ctx.fillText("kollimator", X(-4.4), Y(-2.3)); }
  // dasta va to‘g‘ri ketgan zarralar tutqichi
  const blocked = curRate().blocked;
  ctx.save(); ctx.strokeStyle = "rgba(245,158,11,0.35)"; ctx.lineWidth = Math.max(2, 0.18 * s); ctx.beginPath(); ctx.moveTo(X(-7.2), Y(0)); ctx.lineTo(X(blocked ? -4 : 10.4), Y(0)); ctx.stroke(); ctx.restore();
  ctx.fillStyle = c.dark ? "#4b5563" : "#6b7280"; ctx.fillRect(X(10.25), Y(0.7), 0.4 * s, 1.4 * s);
  // treklar
  lab.tracks.forEach((t) => {
    const v = 16, d = t.age * v - 7.2; // cm, manbadan
    let x, y;
    if (d < 0) { x = d; y = t.y0; } else { x = d * Math.cos(t.th); y = t.y0 + d * Math.sin(t.th); }
    if (d + 7.2 > t.stop || Math.hypot(x, y) > 10.8) return;
    ctx.fillStyle = c.dark ? "rgba(252,211,77,0.9)" : "rgba(217,119,6,0.85)"; circle(ctx, X(x), Y(y), 1.6); ctx.fill();
  });
  // folga
  ctx.fillStyle = FOIL[lab.mat]; ctx.strokeStyle = c.text2; ctx.lineWidth = 1;
  ctx.fillRect(X(0) - Math.max(1.5, 0.12 * s), Y(1.6), Math.max(3, 0.24 * s), 3.2 * s); ctx.strokeRect(X(0) - Math.max(1.5, 0.12 * s), Y(1.6), Math.max(3, 0.24 * s), 3.2 * s);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 2; ctx.strokeRect(X(-0.35), Y(1.9), 0.7 * s, 3.8 * s);
  tagIn(ctx, `${lab.mat}, ${fmt(lab.tUm, 1)} µm`, X(0), Y(-2.5), cw, { color: c.text, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  // detektor tirgagi
  const th = lab.th * DEG, ca = Math.cos(th), sa = Math.sin(th), Ld = P.APP.L;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(10.6 * ca), Y(10.6 * sa)); ctx.stroke();
  ctx.save(); ctx.strokeStyle = c.primary; ctx.globalAlpha = 0.5; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(Ld * ca), Y(Ld * sa)); ctx.stroke(); ctx.restore();
  angleArc(ctx, X(0), Y(0), 2.4 * s, 0, -th, c.warning, { label: "θ", labelR: 2.4 * s + 12, font: LBL });
  // chaqnashlar (detektorga tushgan zarralar)
  lab.flashes.forEach((f) => { const a = 1 - f.age / 0.35; ctx.strokeStyle = `rgba(250,204,21,${a})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(Ld * ca), Y(Ld * sa)); ctx.stroke(); ctx.fillStyle = `rgba(250,204,21,${a})`; circle(ctx, X(Ld * ca), Y(Ld * sa), 3 + 6 * a); ctx.fill(); });
  // detektor korpusi
  ctx.save(); ctx.translate(X(Ld * ca), Y(Ld * sa)); ctx.rotate(-th);
  ctx.fillStyle = c.dark ? "#334155" : "#1e293b"; ctx.beginPath(); ctx.roundRect(0, -0.7 * s, 1.9 * s, 1.4 * s, 3); ctx.fill();
  ctx.fillStyle = lab.led > 0 ? "#facc15" : c.dark ? "#64748b" : "#94a3b8"; ctx.fillRect(-1, -0.28 * s, 3, 0.56 * s);
  ctx.restore();
  const hx = X((Ld + 0.95) * ca), hy = Y((Ld + 0.95) * sa); handle(ctx, c, hx, hy, narrow ? 7 : 8);
  geo.lab.det = { x: hx, y: hy, r: 18 };
  tagIn(ctx, `θ = ${fmt(lab.th, 0)}°`, X(6.2 * ca), Y(6.2 * sa) + (sa > 0 ? -16 : 16), cw, { color: c.warning, bg: c.bg, align: "center", font: BOLD, pad: 5 });
  // nasos va bosim
  const px = narrow ? 34 : Math.min(cw - 34, cx + S / 2 + 44), py = ch - 34;
  ctx.fillStyle = lab.vacuum ? c.success : c.text3; ctx.beginPath(); ctx.roundRect(px - 26, py - 10, 52, 20, 5); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(lab.vacuum ? "NASOS" : "O‘CHIQ", px, py + 0.5);
  geo.lab.pump = { x0: px - 28, x1: px + 28, y0: py - 12, y1: py + 12 };
  tagIn(ctx, `p = ${presFmt(lab.p)}`, px, py + 22, cw, { color: lab.p > 1000 ? c.danger : c.text2, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  // sanagich displeyi
  drawCounter(ctx, st, narrow ? null : { x: cx + S / 2 + 18, y: 10, w: cw - (cx + S / 2 + 18) - 8, h: ch - 20 });
}
function drawCounter(ctx, st, box) {
  const { w: cw, colors: c } = st, r = lab.run, show = r || lab.last;
  const N = r ? r.N : lab.last ? lab.last.N : 0, t = r ? r.t : lab.last ? lab.last.t : 0, T = r ? r.T : lab.last ? lab.last.t : lab.T;
  geo.lab.chips = [];
  if (!box) { // ixcham (mobil)
    const w = 128, x = cw - w - 6, y = 6;
    ctx.fillStyle = "#0b1220"; ctx.beginPath(); ctx.roundRect(x, y, w, 52, 8); ctx.fill();
    ctx.fillStyle = "#4ade80"; ctx.font = '700 22px "SFMono-Regular", Menlo, Consolas, monospace'; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(N).padStart(5, "0"), x + w - 10, y + 28);
    ctx.font = SMALL; ctx.fillStyle = "#94a3b8"; ctx.fillText(`${fmt(t, 1)} / ${fmt(T, 0)} s · ×${lab.speed}`, x + w - 10, y + 45);
    ctx.fillStyle = lab.led > 0 ? "#facc15" : "#334155"; circle(ctx, x + 12, y + 14, 4); ctx.fill();
    return;
  }
  const { x, y, w, h } = box;
  ctx.fillStyle = c.dark ? "#0b1220" : "#0f172a"; ctx.beginPath(); ctx.roundRect(x, y, w, Math.min(h, 150), 10); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("SANAGICH", x + 12, y + 18);
  ctx.fillStyle = lab.led > 0 ? "#facc15" : "#334155"; circle(ctx, x + w - 16, y + 14, 5); ctx.fill();
  ctx.fillStyle = show ? "#4ade80" : "#166534"; ctx.font = MONO; ctx.textAlign = "right"; ctx.fillText(String(N).padStart(6, "0"), x + w - 12, y + 56);
  ctx.fillStyle = "#cbd5e1"; ctx.font = MID; ctx.fillText(`t = ${fmt(t, 1)} / ${fmt(T, 0)} s`, x + w - 12, y + 78);
  ctx.fillStyle = "#1e293b"; ctx.fillRect(x + 12, y + 88, w - 24, 6); ctx.fillStyle = "#4ade80"; ctx.fillRect(x + 12, y + 88, (w - 24) * clamp(T ? t / T : 0, 0, 1), 6);
  ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "left";
  const rr = show && t > 0 ? N / t : null;
  ctx.fillText(rr !== null ? `N/t = ${sci(rr, 3)} s⁻¹` : "N/t = —", x + 12, y + 112);
  ctx.fillText(r ? `θ = ${fmt(r.th, 0)}° · o‘lchanmoqda` : lab.last ? `θ = ${fmt(lab.last.th, 0)}° · jurnalga yozildi (№${lab.last.id})` : "Tayyor", x + 12, y + 128);
  if (lab.aborted && !r && !lab.last) { ctx.fillStyle = "#fca5a5"; ctx.fillText(lab.aborted, x + 12, y + 142); }
  // chiplar: vaqt va tezlik
  let yy = y + Math.min(h, 150) + 12;
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.fillText("Sanash vaqti, s", x, yy + 6); yy += 12;
  let xx = x;
  TIMES.forEach((v) => { const tw = Math.max(30, (w - 6 * 4) / TIMES.length); if (xx + tw > x + w + 1) { xx = x; yy += 26; } const b = chipBtn(ctx, c, xx, yy, String(v), lab.T === v, tw); geo.lab.chips.push({ ...b, k: "T", v }); xx += tw + 4; });
  yy += 34; ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.fillText("Tezlashtirish", x, yy + 6); yy += 12; xx = x;
  SPEEDS.forEach((v) => { const tw = (w - 3 * 4) / 4; const b = chipBtn(ctx, c, xx, yy, `×${v}`, lab.speed === v, tw); geo.lab.chips.push({ ...b, k: "S", v }); xx += tw + 4; });
  yy += 34;
  if (yy + 30 < y + h) { const b = chipBtn(ctx, c, x, yy, r ? "■ To‘xtatish" : "▶ Sanashni boshlash", !r, w); geo.lab.chips.push({ ...b, k: "go" }); }
}

/* ================================================================== 2) Yadro yaqinida */

const microD = () => P.collisionD(P.MATERIALS[lab.mat].Z, P.SOURCES[lab.src].E);
function traj(b) {
  const d = microD(), key = `${d.toFixed(4)}|${b}`;
  if (!micro.cache[key]) { micro.cache[key] = P.trajectory(Math.abs(b), d, { X: 200 }); if (b < 0) micro.cache[key] = { ...micro.cache[key], pts: micro.cache[key].pts.map(([x, y, t]) => [x, -y, t]), theta: -micro.cache[key].theta }; }
  return micro.cache[key];
}
function drawMicro(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  fit(cw, ch, -170, 170, -105, 105, 6);
  const s = view.s, m = P.MATERIALS[lab.mat], d = microD(), R = P.nucRadius(m.A);
  // fan
  if (micro.fan) {
    ctx.strokeStyle = c.dark ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.35)"; ctx.lineWidth = 1;
    for (let b = -150; b <= 150; b += 10) { if (b === 0) continue; const tr = traj(b); ctx.beginPath(); tr.pts.forEach(([x, y], i) => (i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y)))); ctx.stroke(); }
  }
  // yadro
  const g = ctx.createRadialGradient(SX(0) - 2, SY(0) - 2, 1, SX(0), SY(0), Math.max(5, R * s));
  g.addColorStop(0, "#fde68a"); g.addColorStop(1, "#d97706");
  ctx.fillStyle = g; circle(ctx, SX(0), SY(0), Math.max(5, R * s)); ctx.fill();
  tagIn(ctx, `+${m.Z}e`, SX(0), SY(0) + Math.max(5, R * s) + 14, cw, { color: c.text, bg: c.bg, align: "center", font: BOLD, pad: 4 });
  // tanlangan traektoriya
  const b = micro.b, tr = traj(b), th = Math.abs(tr.theta);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.4; ctx.beginPath(); tr.pts.forEach(([x, y], i) => (i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y)))); ctx.stroke();
  // r_min
  const rm = P.rMin(d, th || Math.PI);
  ctx.save(); ctx.strokeStyle = c.danger; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; circle(ctx, SX(0), SY(0), rm * s); ctx.stroke(); ctx.restore();
  tagIn(ctx, `r_min = ${fmt(rm, 1)} fm`, SX(0) + rm * s * 0.72 + 6, SY(0) + rm * s * 0.72 + 8, cw, { color: c.danger, bg: c.bg, align: "left", font: SMALL, pad: 4 });
  // b qavsi
  const bx = SX(-158);
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SX(-170), SY(0)); ctx.lineTo(SX(170), SY(0)); ctx.stroke(); ctx.setLineDash([]);
  if (b > 1) { ctx.strokeStyle = c.success; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, SY(0)); ctx.lineTo(bx, SY(b)); ctx.moveTo(bx - 4, SY(0)); ctx.lineTo(bx + 4, SY(0)); ctx.moveTo(bx - 4, SY(b)); ctx.lineTo(bx + 4, SY(b)); ctx.stroke(); }
  tagIn(ctx, `b = ${fmt(b, 0)} fm`, bx + 8, SY(b / 2), cw, { color: c.success, bg: c.bg, align: "left", font: BOLD, pad: 4 });
  // chiqish burchagi
  if (th > 1 * DEG) {
    const [ex, ey] = tr.pts[tr.pts.length - 1], dir = Math.atan2(ey - tr.pts[tr.pts.length - 6][1], ex - tr.pts[tr.pts.length - 6][0]);
    ctx.save(); ctx.strokeStyle = c.warning; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(SX(0), SY(0)); ctx.lineTo(SX(140 * Math.cos(dir)), SY(140 * Math.sin(dir))); ctx.stroke(); ctx.restore();
    angleArc(ctx, SX(0), SY(0), 46, 0, -dir, c.warning, { label: "θ", labelR: 62, font: LBL });
    tagIn(ctx, `θ = ${fmt(th / DEG, 1)}°`, SX(80 * Math.cos(dir)) + 12, clamp(SY(80 * Math.sin(dir)), 16, ch - 16), cw, { color: c.warning, bg: c.bg, align: "center", font: BOLD, pad: 5 });
  }
  // harakatdagi α-zarra
  const T = tr.pts[tr.pts.length - 1][2] - tr.pts[0][2], tt = tr.pts[0][2] + ((micro.anim * 110) % (T + 60));
  let k = tr.pts.findIndex((p) => p[2] >= tt); if (k < 0) k = tr.pts.length - 1;
  const [ax, ay] = tr.pts[k];
  ctx.fillStyle = "#ef4444"; circle(ctx, SX(ax), SY(ay), 5); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 8px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("α", SX(ax), SY(ay) + 0.5);
  // sudraladigan boshlanish nuqtasi
  const hx = SX(-150), hy = SY(b); handle(ctx, c, hx + 22, hy, narrow ? 7 : 8); geo.micro = { b: { x: hx + 22, y: hy, r: 16 } };
  // shkala
  const sb = 50 * s; ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cw - 16 - sb, ch - 14); ctx.lineTo(cw - 16, ch - 14); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("50 fm = 5·10⁻¹⁴ m", cw - 16, ch - 18);
  tagIn(ctx, `d = zZke²/E = ${fmt(d, 1)} fm · E = ${fmt(P.SOURCES[lab.src].E, 2)} MeV`, 10, 16, cw, { color: c.text2, bg: c.bg, align: "left", font: SMALL, pad: 5 });
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) {
  ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "lab") drawLab(ctx, st); else drawMicro(ctx, st);
}
const heights = (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(Math.min(cw * 0.5, vh * 0.5), 300, 400)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;
function updateReadouts() {
  const m = P.MATERIALS[lab.mat], E = P.SOURCES[lab.src].E;
  if (ui.mode === "lab") {
    const r = lab.run || lab.last, N = r ? r.N : 0, t = r ? (lab.run ? r.t : r.t) : 0;
    setRO("r1", "Sanoq <i>N</i>", r ? String(N) : "—", r ? `ΔN = √N = ${fmt(Math.sqrt(N), 1)}` : "sanashni boshlang", r ? "" : "muted");
    setRO("r2", "Sanash vaqti <i>t</i>", u(fmt(t, 1), "s"), lab.run ? `${fmt(lab.run.T, 0)} s dan, ×${lab.speed} tezlikda` : `tanlangan: ${lab.T} s`);
    setRO("r3", "Sanoq tezligi <i>n = N/t</i>", r && t > 0 ? u(sci(N / t, 3), "s⁻¹") : "—", r && N > 0 ? `nisbiy xatolik ${fmt(100 / Math.sqrt(N), 0)}%` : "—");
    setRO("r4", "Detektor burchagi <i>θ</i>", u(fmt(lab.th, 0), "°"), `sin⁴(θ/2) = ${sci(L.sin4(lab.th), 3)}`, Math.abs(lab.th) < P.APP.beamHalf ? "red" : "");
    setRO("r5", "Folga", `${m.id}<small> ${fmt(lab.tUm, 1)} µm</small>`, `Z = ${m.Z}, nₐt = ${sci(P.areal(m, lab.tUm), 3)} cm⁻²`);
    const cr = curRate();
    setRO("r6", "α-zarra energiyasi", u(fmt(cr.Eff || 0, 2), "MeV"), cr.blocked ? `havoda to‘xtaydi! p = ${presFmt(lab.p)}` : lab.p > 50 ? `havoda ${fmt(E - cr.Eff, 2)} MeV yo‘qotildi` : `${P.SOURCES[lab.src].name}, vakuum`, cr.blocked ? "red" : "");
  } else {
    const d = microD(), tr = traj(micro.b), th = Math.abs(tr.theta);
    setRO("r1", "Nishon masofasi <i>b</i>", u(fmt(micro.b, 0), "fm"), `= ${sci(micro.b * 1e-15, 2)} m`);
    setRO("r2", "Sochilish burchagi <i>θ</i>", u(fmt(th / DEG, 1), "°"), `tg(θ/2) = d/2b`);
    setRO("r3", "Eng yaqin masofa <i>r<sub>min</sub></i>", u(fmt(P.rMin(d, th || Math.PI), 1), "fm"), "r_min = (d/2)(1 + 1/sin(θ/2))");
    setRO("r4", "To‘qnashuv diametri <i>d</i>", u(fmt(d, 1), "fm"), "markaziy to‘qnashuvda r_min = d");
    setRO("r5", "Yadro", `${m.id}<small> Z = ${m.Z}</small>`, `R ≈ 1,2·A^⅓ = ${fmt(P.nucRadius(m.A), 1)} fm`);
    setRO("r6", "α-zarra energiyasi", u(fmt(E, 2), "MeV"), P.SOURCES[lab.src].name);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "lab") {
    const cr = curRate();
    if (lab.run) { t = `Sanalmoqda… ${fmt((100 * lab.run.t) / lab.run.T, 0)}%`; tone = "green"; }
    else if (cr.blocked) { t = "Kamerada havo: α-zarralar detektorga yetmaydi"; tone = "red"; }
    else if (Math.abs(lab.th) < P.APP.beamHalf) { t = "Detektor to‘g‘ridan-to‘g‘ri dastada"; tone = "orange"; }
    else if (lab.last) { t = `O‘lchov №${lab.last.id} jurnalga yozildi`; tone = "purple"; }
    else { t = "Tayyor"; tone = "blue"; }
  } else { t = "Kulon itarishi: giperbolik traektoriya"; tone = "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "lab") {
    p.push("<p>Radioaktiv manbadan chiqqan α-zarralar kollimatordan o‘tib ingichka dasta hosil qiladi va yupqa metall folgaga tushadi. Ko‘pchilik zarralar deyarli og‘masdan o‘tib ketadi, lekin juda oz qismi katta burchakka — hatto orqaga — qaytadi. Rezerford buni atom markazida juda kichik, og‘ir, musbat zaryadli <b>yadro</b> borligi bilan tushuntirdi.</p>");
    p.push("<p>Detektorni turli burchaklarga qo‘yib, belgilangan vaqtda nechta zarra tushishini sanang. Rezerford formulasiga ko‘ra sanoq tezligi 1/sin⁴(θ/2) ga proporsional: θ = 30° dan 150° gacha u ~200 marta kamayadi. Shuning uchun katta burchaklarda sanash vaqtini oshiring. Har bir o‘lchov jurnalga yoziladi — natijalarni pastdagi daftarga kiriting.</p>");
  } else {
    p.push("<p>α-zarra (zaryadi +2e) yadroning Kulon itarishi ta’sirida <b>giperbola</b> bo‘ylab harakatlanadi. Nishon masofasi b qancha kichik bo‘lsa, zarra yadroga shuncha yaqin keladi va katta burchakka og‘adi: tg(θ/2) = d/(2b). Markaziy to‘qnashuvda (b = 0) zarra orqaga qaytadi va yadroga d masofagacha yaqinlashadi.</p>");
    p.push("<p>Oltin uchun 5,5 MeV da d ≈ 41 fm — yadro radiusidan (≈ 7 fm) katta, shuning uchun zarra yadroga «tegmaydi» va sochilish to‘liq Kulon qonuni bilan tavsiflanadi. Atom radiusi ~10⁵ fm: yadro atomdan ~10⁴ marta kichik, shu sababli katta burchakka sochilish juda kam uchraydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "lab" ? "<small>Rezerford</small> n(θ) ~ 1/sin⁴(θ/2)" : "<small>Sochilish</small> tg(θ/2) = d/2b";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  const t = ui.mode === "lab" ? (lab.run ? "To‘xtatish" : "Sanashni boshlash") : "Qaytadan uchirish";
  if (actBtn.textContent !== t) actBtn.textContent = t;
}
function renderPassport() {
  const m = P.MATERIALS[lab.mat];
  $("[data-passport]").innerHTML = [
    ["Dasta intensivligi I₀", `${sci(P.APP.I0, 2)} s⁻¹`], ["Folga–detektor L", `${fmt(P.APP.L, 1)} cm`], ["Detektor tirqishi S", `${fmt(P.APP.Ad, 2)} cm²`],
    ["ΔΩ = S/L²", `${sci(P.dOmega(), 3)} sr`], ["Folga nₐ·t", `${sci(P.areal(m, lab.tUm), 3)} cm⁻²`], ["E (manbada)", `${fmt(P.SOURCES[lab.src].E, 3)} MeV`], ["Fon", `${sci(P.APP.bg, 1)} s⁻¹`],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); renderPassport(); stage.render(); }

/* ------------------------------------------------------------------ Jurnal */

const jEl = $("[data-journal]");
function renderJournal(fresh = false) {
  jEl.innerHTML = journal.slice().reverse().map((j, i) => `<li class="${fresh && i === 0 ? "is-new" : ""}"><span class="lab-journal__n">${j.id}</span><span class="lab-journal__m">${j.mat} ${fmt(j.tUm, 1)} µm · ${P.SOURCES[j.src]?.name || j.src} · θ = ${fmt(j.th, 0)}° · t = ${j.t} s${j.p > 100 ? " · havo!" : ""}</span><span class="lab-journal__v">N = ${j.N}</span></li>`).join("");
}
$("[data-journal-clear]").addEventListener("click", () => {
  if (!journal.length) return;
  if (!confirm("O‘lchovlar jurnalini tozalaysizmi? Daftardagi jadvallar o‘chmaydi, lekin ular jurnal bilan solishtirilmaydi.")) return;
  journal = []; store.set("of-rutherford-journal-v1", journal); renderJournal(); nbRefreshMatches();
});

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  ui.t += dt; micro.anim += dt;
  if (ui.mode === "lab") stepLab(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); updateAction(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").addEventListener("click", () => { if (ui.mode === "lab") { abortCount(); lab.last = null; lab.aborted = null; } else micro.anim = 0; refresh(); });
actBtn.addEventListener("click", () => {
  if (ui.mode === "lab") { if (lab.run) abortCount("Sanash to‘xtatildi — jurnalga yozilmadi"); else startCount(); }
  else micro.anim = 0;
  if (!loop.running) loop.start(); customized(); refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const change = () => { if (lab.run) abortCount("Sozlama o‘zgardi — sanash bekor qilindi"); lab.last = null; };
const rTC = bindRange($("#rT"), $("#rTOut"), (v) => `${fmt(v, 1)} µm`, (v) => { change(); lab.tUm = v; customized(); refresh(); });
const rThC = bindRange($("#rTh"), $("#rThOut"), (v) => `${fmt(v, 0)}°`, (v) => { change(); lab.th = v; customized(); refresh(); });
const rBC = bindRange($("#rB"), $("#rBOut"), (v) => `${fmt(v, 0)} fm`, (v) => { micro.b = v; micro.anim = 0; customized(); refresh(); });
const segs = (attr, get, set) => document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.addEventListener("click", () => { set(b.dataset[`${attr}Value`]); syncAll(); customized(); refresh(); }));
segs("mat", () => lab.mat, (v) => { change(); lab.mat = v; });
segs("src", () => lab.src, (v) => { change(); lab.src = v; });
segs("time", () => lab.T, (v) => { if (!lab.run) lab.T = +v; });
segs("speed", () => lab.speed, (v) => { lab.speed = +v; });
$("[data-vacuum]").addEventListener("change", (e) => { lab.vacuum = e.target.checked; if (!loop.running) loop.start(); customized(); refresh(); });
$("[data-fan]").addEventListener("change", (e) => { micro.fan = e.target.checked; refresh(); });

/* Sahnadagi boshqaruv */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const hitR = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r;
function hitTest(p) {
  if (ui.mode === "lab") {
    const g = geo.lab || {};
    for (const ch of g.chips || []) if (inBox(p, ch)) return { k: "chip", ch };
    if (inBox(p, g.pump)) return { k: "pump" };
    if (hitR(p, g.det)) return { k: "det" };
    // tirgak bo‘ylab ham ushlash mumkin
    if (g.cx !== undefined) { const r = Math.hypot(p.x - g.cx, p.y - g.cy) / g.s, a = Math.atan2(-(p.y - g.cy), p.x - g.cx) / DEG; if (r > 4 && r < 10.8 && Math.abs(((a - lab.th + 540) % 360) - 180) < 6) return { k: "det" }; }
    return null;
  }
  const g = geo.micro || {}; if (hitR(p, g.b)) return { k: "b" }; return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  if (h.k === "chip") {
    const { ch } = h;
    if (ch.k === "T" && !lab.run) lab.T = ch.v; else if (ch.k === "S") lab.speed = ch.v; else if (ch.k === "go") { if (lab.run) abortCount("Sanash to‘xtatildi — jurnalga yozilmadi"); else startCount(); }
    syncAll(); customized(); refresh(); return;
  }
  if (h.k === "pump") { lab.vacuum = !lab.vacuum; syncAll(); if (!loop.running) loop.start(); customized(); refresh(); return; }
  drag = h.k; canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  e.preventDefault(); onDrag(p);
});
function onDrag(p) {
  if (drag === "det") {
    const g = geo.lab, a = Math.round(Math.atan2(-(p.y - g.cy), p.x - g.cx) / DEG), v = clamp(a, -160, 160);
    if (v !== lab.th) { change(); lab.th = v; rThC.set(v); }
  } else if (drag === "b") {
    const w = toWorld(p.x, p.y); micro.b = clamp(Math.round(Math.abs(w.y)), 0, 150); micro.anim = 0; rBC.set(micro.b);
  }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? (h.k === "chip" || h.k === "pump" ? "pointer" : h.k === "b" ? "ns-resize" : "grab") : ""; return; } onDrag(p); });
function endDrag() { drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  basic: { mode: "lab", title: "Asosiy tajriba: oltin folga", lesson: "Oltin folga (2 µm), Am-241 manbasi. Detektor 30° da, sanash vaqti 60 s, ×10 tezlikda. «Sanashni boshlash»ni bosing; so‘ng detektorni 15°…150° gacha surib o‘lchovlarni takrorlang.", set: () => Object.assign(lab, { mat: "Au", tUm: 2, src: "am", th: 30, T: 60, speed: 10, vacuum: true }) },
  back: { mode: "lab", title: "Orqaga sochilish (150°)", lesson: "150° da sanoq tezligi 30° dagidan ~200 marta kichik: 1200 s sanang (×100 tezlikda ~12 s). Shunday kam bo‘lsa ham zarralar orqaga qaytadi — Tomson modeli buni tushuntira olmaydi.", set: () => Object.assign(lab, { mat: "Au", tUm: 2, src: "am", th: 150, T: 1200, speed: 100, vacuum: true }) },
  silver: { mode: "lab", title: "Kumush folga: Z kichikroq", lesson: "Kumushda Z = 47: bir xil burchakda sanoq (Z_Ag/Z_Au)² · (nₐ farqi) marta kam. 2-jadval uchun shu folgada bitta burchakda o‘lchang.", set: () => Object.assign(lab, { mat: "Ag", tUm: 2, src: "am", th: 30, T: 100, speed: 10, vacuum: true }) },
  energy: { mode: "lab", title: "Yuqori energiya: Ra-C′", lesson: "E = 7,69 MeV: sanoq 1/E² ga proporsional — 5,49 MeV dagidan ~2 marta kam.", set: () => Object.assign(lab, { mat: "Au", tUm: 2, src: "rac", th: 30, T: 60, speed: 10, vacuum: true }) },
  air: { mode: "lab", title: "Havo bilan to‘la kamera", lesson: "Nasos o‘chirilgan: havoda 5,5 MeV li α-zarra ~4 cm da to‘xtaydi, manbadan detektorgacha esa 16,5 cm. Sanashni boshlang — faqat fon qayd etiladi. Nasosni yoqing va bosim tushishini kuzating.", set: () => Object.assign(lab, { mat: "Au", tUm: 2, src: "am", th: 30, T: 60, speed: 10, vacuum: false, p: P.P_ATM }) },
  micro: { mode: "micro", title: "Yadro yaqinida: giperbola", lesson: "b = 25 fm da α-zarra ~79° ga og‘adi. Zarrani yuqoriga-pastga surib nishon masofasini o‘zgartiring: b kamaysa, θ ortadi.", set: () => Object.assign(micro, { b: 25 }) },
  head: { mode: "micro", title: "Markaziy to‘qnashuv (b = 0)", lesson: "b = 0: zarra yadroga d ≈ 41 fm gacha yaqinlashib, to‘xtaydi va orqaga qaytadi (θ = 180°). Shu masofada ham yadro kuchlari sezilmaydi — yadro undan kichik.", set: () => Object.assign(micro, { b: 0 }) },
};
const GROUPS = [["Qurilma", ["basic", "back", "silver", "energy", "air"]], ["Yadro yaqinida", ["micro", "head"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }
function syncAll() {
  rTC.set(lab.tUm); rThC.set(lab.th); rBC.set(micro.b);
  const pr = (attr, v) => document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[`${attr}Value`] === String(v))));
  pr("mat", lab.mat); pr("src", lab.src); pr("time", lab.T); pr("speed", lab.speed);
  $("[data-vacuum]").checked = lab.vacuum; $("[data-fan]").checked = micro.fan;
}
const MODE_HINT = { lab: "Detektorni surib burchakni tanlang; displeydagi vaqt va tezlikni bosing", micro: "α-zarrani yuqoriga-pastga surib nishon masofasini o‘zgartiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  window.dispatchEvent(new Event("resize"));
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(b.dataset.modeValue === "lab" ? "basic" : "micro"); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; abortCount(); lab.last = null; lab.aborted = null;
  ui.mode = p.mode; p.set(); micro.anim = 0;
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

/* ================================================================== Laboratoriya daftari */

const NB_KEY = "of-rutherford-nb-v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blankT1 = () => ({ th: "", t: "", N: "" }), blankT2 = () => ({ mat: "Ag", tUm: "2", src: "am", th: "", t: "", N: "" });
const nb = Object.assign({ f: { name: "", group: "", school: "", teacher: "", date: today(), conclusion: "" }, cond: { mat: "Au", tUm: 2, src: "am" }, t1: Array.from({ length: 6 }, blankT1), t2: Array.from({ length: 2 }, blankT2) }, store.get(NB_KEY, {}));
const saveNb = () => store.set(NB_KEY, nb);
const num = (s) => { const v = parseFloat(String(s).replace(",", ".").replace("−", "-")); return Number.isFinite(v) ? v : NaN; };
const parseT1 = (r) => ({ th: num(r.th), t: num(r.t), N: num(r.N) });
const parseT2 = (r) => ({ mat: r.mat, tUm: num(r.tUm), src: r.src, th: num(r.th), t: num(r.t), N: num(r.N) });
const T_OPTS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

// maydonlar
document.querySelectorAll("[data-f]").forEach((el) => { el.value = nb.f[el.dataset.f] || ""; el.addEventListener("input", () => { nb.f[el.dataset.f] = el.value; saveNb(); nbProgress(); }); });
const condSel = { mat: $('[data-c="mat"]'), tUm: $('[data-c="tUm"]'), src: $('[data-c="src"]') };
condSel.tUm.innerHTML = T_OPTS.map((v) => `<option value="${v}">${fmt(v, 1)}</option>`).join("");
function syncCondUI() { condSel.mat.value = nb.cond.mat; condSel.tUm.value = String(nb.cond.tUm); condSel.src.value = nb.cond.src; }
Object.entries(condSel).forEach(([k, el]) => el.addEventListener("change", () => { nb.cond[k] = k === "tUm" ? +el.value : el.value; saveNb(); nbRecalc(); }));
$("[data-cond-sync]").addEventListener("click", () => { nb.cond = { mat: lab.mat, tUm: lab.tUm, src: lab.src }; syncCondUI(); saveNb(); nbRecalc(); });

const t1Body = $("[data-t1] tbody"), t2Body = $("[data-t2] tbody");
const inp = (key, val, mode = "decimal", ph = "") => `<input data-k="${key}" inputmode="${mode}" value="${String(val ?? "").replace(/"/g, "&quot;")}" placeholder="${ph}" aria-label="${key}">`;
const sel = (key, val, opts) => `<select data-k="${key}" aria-label="${key}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(val) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
function renderT1() {
  t1Body.innerHTML = nb.t1.map((r, i) => `<tr data-i="${i}"><td class="lab-idx">${i + 1}</td><td>${inp("th", r.th, "numeric")}</td><td>${inp("t", r.t, "numeric")}</td><td>${inp("N", r.N, "numeric")}</td><td class="lab-calc" data-o="n"></td><td class="lab-calc" data-o="s4"></td><td class="lab-calc" data-o="K"></td><td data-o="j"></td><td><button class="lab-del" type="button" data-del="t1" aria-label="Qatorni o‘chirish">×</button></td></tr>`).join("");
}
function renderT2() {
  const mats = Object.values(P.MATERIALS).map((m) => [m.id, m.id]), srcs = Object.values(P.SOURCES).map((s) => [s.id, s.name]), ts = T_OPTS.map((v) => [v, fmt(v, 1)]);
  t2Body.innerHTML = nb.t2.map((r, i) => `<tr data-i="${i}"><td class="lab-idx">${i + 1}</td><td>${sel("mat", r.mat, mats)}</td><td>${sel("tUm", r.tUm, ts)}</td><td>${sel("src", r.src, srcs)}</td><td>${inp("th", r.th, "numeric")}</td><td>${inp("t", r.t, "numeric")}</td><td>${inp("N", r.N, "numeric")}</td><td class="lab-calc" data-o="Z"></td><td data-o="j"></td><td><button class="lab-del" type="button" data-del="t2" aria-label="Qatorni o‘chirish">×</button></td></tr>`).join("");
}
function onTableInput(e, tbl) {
  const el = e.target.closest("[data-k]"), tr = e.target.closest("tr[data-i]"); if (!el || !tr) return;
  nb[tbl][+tr.dataset.i][el.dataset.k] = el.value; saveNb(); nbRecalc();
}
t1Body.addEventListener("input", (e) => onTableInput(e, "t1")); t2Body.addEventListener("input", (e) => onTableInput(e, "t2")); t2Body.addEventListener("change", (e) => onTableInput(e, "t2"));
document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-del]"); if (d) { const tbl = d.dataset.del, i = +d.closest("tr").dataset.i; nb[tbl].splice(i, 1); if (!nb[tbl].length) nb[tbl].push(tbl === "t1" ? blankT1() : blankT2()); saveNb(); tbl === "t1" ? renderT1() : renderT2(); nbRecalc(); return; }
  const a = e.target.closest("[data-add]"); if (a) { const tbl = a.dataset.add; if (nb[tbl].length >= (tbl === "t1" ? 16 : 8)) return; nb[tbl].push(tbl === "t1" ? blankT1() : blankT2()); saveNb(); tbl === "t1" ? renderT1() : renderT2(); nbRecalc(); }
});

let lastA = null, lastF = [], flags = { t1: [], t2: [] };
function nbRecalc() {
  // 1-jadval
  const rows = nb.t1.map(parseT1);
  let filled = 0, bad = 0;
  [...t1Body.rows].forEach((tr, i) => {
    const r = rows[i], raw = nb.t1[i], any = raw.th !== "" || raw.t !== "" || raw.N !== "", ck = L.checkRow(r);
    const o = (k) => tr.querySelector(`[data-o="${k}"]`);
    tr.classList.toggle("is-bad", any && !ck.ok);
    tr.querySelectorAll("input").forEach((el) => el.setAttribute("aria-invalid", String(any && !ck.ok && el.value !== "" && !Number.isFinite(num(el.value)))));
    if (ck.ok) {
      filled++; const n = r.N / r.t, s4 = L.sin4(r.th);
      o("n").textContent = sci(n, 3); o("s4").textContent = sci(s4, 3); o("K").textContent = sci(n * s4, 3);
      const mt = L.matchJournal(r, nb.cond, journal); o("j").innerHTML = mt ? '<span class="lab-ok" title="Jurnalda bor">✓</span>' : '<span class="lab-no" title="Bu qiymat jurnalda topilmadi">?</span>';
    } else { ["n", "s4", "K"].forEach((k) => { o(k).textContent = any ? "" : ""; }); o("j").textContent = any ? ck.err : ""; if (any) bad++; }
  });
  const A = L.analyze(rows, nb.cond); lastA = A;
  flags.t1 = A.rows.map((r) => L.matchJournal(r, nb.cond, journal));
  const distinct = new Set(A.rows.map((r) => Math.abs(r.th))).size;
  const msg = $("[data-t1-msg]");
  msg.textContent = `${filled} ta to‘liq qator${bad ? `, ${bad} ta xato` : ""}${filled ? ` · ${flags.t1.filter(Boolean).length} tasi jurnal bilan mos` : ""}`;
  msg.dataset.tone = bad ? "red" : filled >= 5 ? "green" : "";
  const sum = $("[data-t1-sum]");
  if (A.rows.length >= 3 && distinct >= 3) {
    const m = A.mat;
    sum.innerHTML = [
      ["K̄ = n·sin⁴(θ/2)", `${sci(A.K, 3)} s⁻¹`, `± ${sci(A.sK, 2)} (${fmt((100 * A.sK) / A.K, 1)}%)`],
      ["χ²/(n−1)", fmt(A.chi2 / Math.max(1, A.dof), 2), "≈ 1 — farqlar statistik"],
      ["Qiyalik m (ln n — ln 1/sin⁴)", A.fit ? `${fmt(A.fit.m, 3)}` : "—", A.fit ? `± ${fmt(A.fit.sm, 3)} (nazariya: 1)` : ""],
      ["Yadro zaryadi Z", `${fmt(A.Z, 1)}`, `± ${fmt(A.sZ, 1)} (${m.id}: ${m.Z})`],
      ["Yadro radiusi", `< ${fmt(A.rmin, 0)} fm`, `θ_max = ${fmt(A.thMax, 0)}° bo‘yicha`],
    ].map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><small>${c}</small></div>`).join("");
  } else sum.innerHTML = "";
  // 2-jadval
  const r2 = nb.t2.map(parseT2), F = L.analyzeFoils(r2); lastF = F; let fi = 0; flags.t2 = [];
  [...t2Body.rows].forEach((tr, i) => {
    const r = r2[i], ok = L.checkRow(r).ok && r.tUm > 0, o = (k) => tr.querySelector(`[data-o="${k}"]`), raw = nb.t2[i], any = raw.th !== "" || raw.t !== "" || raw.N !== "";
    tr.classList.toggle("is-bad", any && !ok);
    if (ok) { const f = F[fi++]; o("Z").textContent = `${fmt(f.Z, 1)} ± ${fmt(f.sZ, 1)}`; const mt = L.matchJournal(r, { mat: r.mat, tUm: r.tUm, src: r.src }, journal); flags.t2.push(mt); o("j").innerHTML = mt ? '<span class="lab-ok">✓</span>' : '<span class="lab-no">?</span>'; }
    else { o("Z").textContent = ""; o("j").textContent = any ? L.checkRow(r).err || "" : ""; }
  });
  nbProgress();
}
function nbRefreshMatches() { nbRecalc(); }
function nbValid() {
  const errs = [];
  if (!nb.f.name.trim()) errs.push("F.I.Sh. kiritilmagan");
  const A = lastA; const distinct = A ? new Set(A.rows.map((r) => Math.abs(r.th))).size : 0;
  if (!A || A.rows.length < 5 || distinct < 5) errs.push("1-jadvalda kamida 5 ta turli burchakdagi to‘liq o‘lchov kerak");
  if (nb.f.conclusion.trim().length < 20) errs.push("xulosa yozilmagan (kamida bir-ikki gap)");
  return errs;
}
function nbProgress() {
  const A = lastA, distinct = A ? new Set(A.rows.map((r) => Math.abs(r.th))).size : 0;
  const st = [["Bajaruvchi", !!nb.f.name.trim()], ["1-jadval", !!A && A.rows.length >= 5 && distinct >= 5], ["Xulosa", nb.f.conclusion.trim().length >= 20], ["Lab varaq", built]];
  $("[data-nb-progress]").innerHTML = st.map(([t, ok]) => `<span class="${ok ? "is-done" : ""}">${ok ? "✓ " : ""}${t}</span>`).join("");
}
$("[data-conclusion-hint]").addEventListener("click", () => {
  const m = $("[data-hint-msg]");
  m.textContent = "Javob bering: 1) K = n·sin⁴(θ/2) barcha burchaklarda xatolik chegarasida bir xilmi? 2) Grafik qiyaligi 1 ga yaqinmi — bu nimani tasdiqlaydi? 3) Topilgan Z jadvaldagi qiymatga mosmi? 4) Yadro o‘lchami atom o‘lchamidan necha marta kichik? 5) Nega katta burchakka sochilish juda kam uchraydi?";
});

let built = false;
const buildMsg = $("[data-build-msg]"), pdfBtn = $("[data-pdf]"), texBtn = $("[data-tex]"), preview = $("[data-preview]");
const KATEX_JS = new URL("../../vendor/katex/katex.min.js", import.meta.url).href, KATEX_CSS = new URL("../../vendor/katex/katex.min.css", import.meta.url).href;
let katexP = null;
function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  katexP ||= new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = KATEX_JS; sc.onload = () => res(window.katex); sc.onerror = () => { katexP = null; rej(new Error("katex")); }; document.head.append(sc); });
  return katexP;
}
const translit = (s) => s.normalize("NFKD").replace(/[ʻʼ‘’'`]/g, "").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9\u0400-\u04FF]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "talaba";
const fileBase = () => `Rezerford-lab-${translit(nb.f.name)}`;
function makeDoc() {
  const errs = nbValid();
  if (errs.length) { buildMsg.textContent = `Avval to‘ldiring: ${errs.join("; ")}.`; buildMsg.dataset.tone = "red"; return null; }
  return buildRutherfordDoc(nb, lastA, lastF, flags);
}
async function makeHTML(autoPrint) {
  const doc = makeDoc(); if (!doc) return null;
  const katex = await loadKatex();
  return renderHTML(doc, { katex, katexCss: KATEX_CSS, title: fileBase(), docLabel: DOC_LABEL, autoPrint });
}
$("[data-build]").addEventListener("click", async () => {
  buildMsg.textContent = "Shakllantirilmoqda…"; buildMsg.dataset.tone = "";
  let html = null;
  try { html = await makeHTML(false); } catch { buildMsg.textContent = "Formulalar kutubxonasini yuklab bo‘lmadi. Internetni tekshirib qayta urinib ko‘ring."; buildMsg.dataset.tone = "red"; }
  if (!html) { built = false; preview.hidden = true; nbProgress(); return; }
  preview.innerHTML = ""; const fr = document.createElement("iframe"); fr.title = "Lab varaq ko‘rinishi"; fr.className = "lab-frame"; fr.srcdoc = html; preview.append(fr);
  preview.hidden = false; built = true;
  buildMsg.textContent = "Tayyor. Pastda ko‘rib chiqing, so‘ng PDF yoki LaTeX faylni yuklab oling."; buildMsg.dataset.tone = "green"; nbProgress();
});
pdfBtn.addEventListener("click", async () => {
  if (nbValid().length) { makeDoc(); return; }
  const w = window.open("", "_blank"); // bloklanmasligi uchun darhol ochiladi
  buildMsg.textContent = "PDF tayyorlanmoqda…"; buildMsg.dataset.tone = "";
  try {
    const html = await makeHTML(true);
    if (!w) { buildMsg.textContent = "Brauzer yangi oynani blokladi — ruxsat bering yoki «Lab varaqni shakllantirish» dan keyin ko‘rinishdagi tugmadan foydalaning."; buildMsg.dataset.tone = "red"; return; }
    w.document.open(); w.document.write(html); w.document.close();
    buildMsg.textContent = "Yangi oynada chop etish oynasi ochildi: «Saqlash: PDF» (Save as PDF) ni tanlang."; buildMsg.dataset.tone = "green";
    built = true; nbProgress();
  } catch { w?.close(); buildMsg.textContent = "Formulalar kutubxonasini yuklab bo‘lmadi. Qayta urinib ko‘ring."; buildMsg.dataset.tone = "red"; }
});
texBtn.addEventListener("click", () => {
  const doc = makeDoc(); if (!doc) return;
  const tex = renderTeX(doc, { docLabel: DOC_LABEL, url: SITE_URL, label: SITE_LABEL });
  const url = URL.createObjectURL(new Blob([tex], { type: "application/x-tex;charset=utf-8" })), a = document.createElement("a");
  a.href = url; a.download = `${fileBase()}.tex`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  buildMsg.textContent = "LaTeX fayl yuklab olindi. Overleaf (pdfLaTeX) yoki istalgan TeX tizimida kompilyatsiya qilinadi."; buildMsg.dataset.tone = "green";
});
// daftar o‘zgarsa — ko‘rinish eskiradi
document.querySelector("#labNotebook").addEventListener("input", () => { if (built) { built = false; buildMsg.textContent = "Ma’lumotlar o‘zgardi — PDF va LaTeX yangi ma’lumotlar bilan tuziladi; ko‘rinishni yangilash uchun qayta shakllantiring."; buildMsg.dataset.tone = ""; nbProgress(); } });

/* ------------------------------------------------------------------ Ishga tushirish */

setPlayUI(false);
syncCondUI(); renderT1(); renderT2(); renderJournal(); nbRecalc();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "basic");
document.fonts?.ready.then(() => stage.render());
