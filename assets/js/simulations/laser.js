// ==========================================================================
// Lazer — simulyatsiya (simulations/laser.html)
// 1) Yutilish va nurlanish: bitta rubin atomi (Cr³⁺ ioni) va uning energiya sathlari. Foton yuboriladi:
//    hν = E₂ − E₁ bo'lsa asosiy holatdagi atom uni yutadi, uyg'ongan atom esa majburiy nurlanadi —
//    ikki bir xil foton chiqadi. Yashil foton atomni nasos sathiga chiqaradi, u nurlanishsiz E₂ ga tushadi.
//    E₂ metastabil: atom o'z-o'zidan (tasodifiy yo'nalish va fazada) nurlanadi.
// 2) Lazer qurilmasi: faol muhit (rubin sterjen yoki He–Ne trubkasi), nasos, ikki ko'zgu (rezonator).
//    Atomlar va fotonlar Monte-Karlo usulida; inversiya, generatsiya bo'sag'asi, lazer nuri. Grafik:
//    sathlardagi atomlar ulushi va nur quvvati vaqt bo'yicha.
// Fizika: laser-physics.js (Node'da tekshirilgan: t_laser.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn } from "./labkit.js";
import { waveRGB, colorName } from "./diffraction-physics.js";
import * as P from "./laser-physics.js";
import { drawHistory, lastFrame } from "./laser-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const rgb = (nm, a = 1) => { const [r, g, b] = waveRGB(nm); return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`; };
const hex = (nm) => "#" + waveRGB(nm).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "atom", hover: null };
const TAU_ATOM = 5; // metastabil sathning (sekinlashtirilgan) o'rtacha yashash vaqti, s
const at = { s: "E1", nm: 694.3, ph: [], t: 0, tDecay: Infinity, tDown: Infinity, ev: null, n: { abs: 0, stim: 0, spont: 0, pump: 0, pass: 0 }, last: "" };
const lz = { type: "ruby", wt: 3, R: 0.8, st: null, hist: [], acc: 0, beam: 0, beamOut0: 0, beamT0: 0 };
let presetId = null, playing = true, seed = 11;
const geo = {};
const L = () => P.LASERS[lz.type];
const SPEED = 2; // rezonator: real 1 s da shartli vaqt birligi

/* ------------------------------------------------------------------ 1. Bitta atom */

const atomRnd = P.rng(5);
const expT = (tau) => -Math.log(1 - atomRnd()) * tau;
function sendPhoton() { at.ph.push({ x: -(geo.atom ? geo.atom.ax : 300) - 30, y: 0, dx: 1, dy: 0, nm: at.nm, ph: 0, src: "in", done: false, age: 0 }); }
function setAtom(s) { at.s = s; at.tDecay = s === "E2" ? at.t + Math.max(1.2, expT(TAU_ATOM)) : Infinity; at.tDown = s === "E3" ? at.t + 0.6 : Infinity; }
function event(kind, nm) { at.ev = { kind, nm, t: at.t }; at.n[kind]++; at.last = kind; }
function atomStep(dt, geoA) {
  at.t += dt;
  const v = 170; // px/s
  for (const p of at.ph) {
    p.age += dt; const x0 = p.x; p.x += p.dx * v * dt; p.y += p.dy * v * dt;
    if (p.src === "in" && !p.done && x0 < 0 && p.x >= 0) {
      p.done = true; const r = P.interact(at.s, p.nm);
      if (r === "absorb21") { p.dead = true; setAtom("E2"); event("abs", p.nm); }
      else if (r === "absorb31") { p.dead = true; setAtom("E3"); event("pump", p.nm); }
      else if (r === "stim") { setAtom("E1"); event("stim", p.nm); at.ph.push({ ...p, y: p.y - 16, src: "stim" }); }
      else event("pass", p.nm);
    }
  }
  if (at.t >= at.tDown) { setAtom("E2"); at.ev = { kind: "heat", t: at.t }; }
  if (at.t >= at.tDecay) {
    setAtom("E1"); event("spont", 694.3);
    let th = atomRnd() * TAU; if (Math.abs(Math.cos(th)) > 0.97) th += 0.4;
    at.ph.push({ x: 0, y: 0, dx: Math.cos(th), dy: Math.sin(th), nm: 694.3, ph: atomRnd() * TAU, src: "spont", done: true, age: 0 });
  }
  const lim = geoA ? geoA.lim : 900;
  at.ph = at.ph.filter((p) => !p.dead && Math.abs(p.x) < lim && Math.abs(p.y) < lim);
}

/** To'lqin paketi: markaz (x, y), yo'nalish (dx, dy), faza — bir xil fazali fotonlar bir xil chiziladi */
function packet(ctx, x, y, dx, dy, nm, phase, alpha = 1) {
  const lam = nm / 22, len = lam * 3.2, A = 7, k = TAU / lam, nx = -dy, ny = dx;
  ctx.strokeStyle = rgb(nm, alpha); ctx.lineWidth = 2.2; ctx.beginPath();
  for (let s = -len; s <= len; s += 1.5) {
    const env = Math.exp(-((s / (len * 0.6)) ** 2)), a = A * env * Math.sin(k * s - phase); const px = x + dx * s + nx * a, py = y + dy * s + ny * a;
    if (s === -len) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawAtom(ctx, c, w, h) {
  const narrow = w < 560;
  const ax = narrow ? w * 0.42 : w * 0.34, ay = narrow ? h * 0.36 : h * 0.47;
  const lim = Math.max(w, h);
  geo.atom = { ax, ay, lim };
  // nur yo'li
  ctx.strokeStyle = c.grid; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(narrow ? w : w * 0.6, ay); ctx.stroke(); ctx.setLineDash([]);
  // atom
  const st = at.s, R0 = 26, Rg = st === "E1" ? R0 : R0 + 10, gc = st === "E1" ? "rgba(148,163,184,0.35)" : st === "E2" ? rgb(694.3, 0.45) : "rgba(139,92,246,0.45)";
  const g = ctx.createRadialGradient(ax, ay, 2, ax, ay, Rg); g.addColorStop(0, gc); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ax, ay, Rg, 0, TAU); ctx.fill();
  ctx.fillStyle = "#b91c1c"; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, TAU); ctx.fill();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ax, ay, st === "E1" ? 16 : st === "E2" ? 24 : 30, 0, TAU); ctx.stroke();
  const ea = at.t * 2.4; ctx.fillStyle = c.primary; ctx.beginPath(); const er = st === "E1" ? 16 : st === "E2" ? 24 : 30; ctx.arc(ax + Math.cos(ea) * er, ay + Math.sin(ea) * er, 4, 0, TAU); ctx.fill();
  tag(ctx, "Cr³⁺ ioni", ax, ay + 48, { color: c.text2, bg: c.bg2, font: SMALL, align: "center" });
  // fotonlar
  for (const p of at.ph) packet(ctx, ax + p.x, ay + p.y, p.dx, p.dy, p.nm, p.ph, p.src === "spont" ? 0.9 : 1);
  // hodisa yozuvi
  const ev = at.ev, age = ev ? at.t - ev.t : 9;
  if (ev && age < 2.5) {
    const txt = { abs: "yutilish: E₁ → E₂", pump: "nasos: E₁ → E₃", stim: "majburiy nurlanish: 2 ta bir xil foton", spont: "o‘z-o‘zidan nurlanish: tasodifiy yo‘nalish", pass: "rezonans yo‘q — foton o‘tib ketdi", heat: "E₃ → E₂ nurlanishsiz (issiqlik)" }[ev.kind];
    tag(ctx, txt, ax, ay - (narrow ? 46 : 62), { color: "#fff", bg: ev.kind === "pass" ? c.text3 : ev.kind === "stim" ? c.success : ev.kind === "heat" ? "#7c3aed" : c.primary, font: MID, align: "center" });
  }
  // sathlar diagrammasi
  const dx0 = narrow ? 50 : w * 0.64, dx1 = narrow ? w - 16 : w - 24, dy0 = narrow ? h * 0.58 : 44, dy1 = h - 24;
  const E3hi = P.RUBY.E3hi, Ymap = (e) => dy1 - (e / 2.8) * (dy1 - dy0);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(dx0 - 40, dy0 - 26, dx1 - dx0 + 46, dy1 - dy0 + 40, 10); ctx.fill(); ctx.stroke();
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Energiya sathlari", dx0 - 30, dy0 - 10);
  const lx0 = dx0 + 34, lx1 = dx1 - (narrow ? 52 : 70);
  // E3 tasma
  ctx.fillStyle = "rgba(139,92,246,0.18)"; ctx.fillRect(lx0, Ymap(E3hi), lx1 - lx0, Ymap(P.RUBY.E3lo) - Ymap(E3hi));
  const lvl = (e, name, sub, col) => { const y = Ymap(e); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(lx0, y); ctx.lineTo(lx1, y); ctx.stroke(); ctx.font = BOLD; ctx.fillStyle = col; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(name, lx1 + 6, y - 6); ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.fillText(sub, lx1 + 6, y + 7); };
  lvl(P.RUBY.E1, "E₁", narrow ? "0 eV" : "asosiy, 0 eV", c.text2);
  lvl(P.RUBY.E2, "E₂", narrow ? "1,79 eV" : "metastabil, 1,79 eV", hex(694.3));
  lvl((P.RUBY.E3lo + E3hi) / 2, "E₃", narrow ? "nasos" : "nasos tasmasi", "#7c3aed");
  // elektron
  const ey = st === "E1" ? Ymap(0) : st === "E2" ? Ymap(P.RUBY.E2) : Ymap((P.RUBY.E3lo + E3hi) / 2), ex = (lx0 + lx1) / 2;
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = c.bg; ctx.lineWidth = 1.5; ctx.stroke();
  // oxirgi o'tish strelkasi
  if (ev && age < 2.5 && ev.kind !== "pass") {
    const al = 1 - age / 2.5, xa = ex - 26;
    const ud = { abs: [0, P.RUBY.E2, 694.3], pump: [0, (P.RUBY.E3lo + E3hi) / 2, ev.nm], stim: [P.RUBY.E2, 0, 694.3], spont: [P.RUBY.E2, 0, 694.3], heat: [(P.RUBY.E3lo + E3hi) / 2, P.RUBY.E2, null] }[ev.kind];
    const y0 = Ymap(ud[0]), y1 = Ymap(ud[1]), col = ud[2] ? rgb(ud[2], al) : `rgba(124,58,237,${al})`;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.4; if (!ud[2]) ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(xa, y0); ctx.lineTo(xa, y1 + Math.sign(y0 - y1) * 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(xa, y1); ctx.lineTo(xa - 5, y1 + Math.sign(y0 - y1) * 9); ctx.lineTo(xa + 5, y1 + Math.sign(y0 - y1) * 9); ctx.fill();
    if (ev.kind === "stim") { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(xa - 10, y0); ctx.lineTo(xa - 10, y1 + 7); ctx.stroke(); }
  }
  // foton energiyasi strelkasi (rezonansni solishtirish)
  const e = P.photonEV(at.nm), fx = dx0 - 14, fy0 = Ymap(0), fy1 = Ymap(Math.min(e, 2.8));
  ctx.strokeStyle = rgb(at.nm); ctx.fillStyle = rgb(at.nm); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, fy0); ctx.lineTo(fx, fy1 + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx, fy1); ctx.lineTo(fx - 5, fy1 + 9); ctx.lineTo(fx + 5, fy1 + 9); ctx.fill();
  ctx.save(); ctx.translate(fx - 10, (fy0 + fy1) / 2); ctx.rotate(-Math.PI / 2); ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`hν = ${fmt(e, 2)} eV`, 0, 0); ctx.restore();
  // tugmalar
  const bx = narrow ? 8 : 14;
  geo.send = chipBtn(ctx, c, bx, 10, "Foton yuborish", true, 118, 26);
  geo.ground = chipBtn(ctx, c, bx, 42, "Atomni tinchlantirish", false, 150, 24);
  geo.excite = chipBtn(ctx, c, bx + 156, 42, "Uyg‘otish", false, 80, 24);
  if (at.s === "E2" && !narrow) tag(ctx, "metastabil holat — tasodifiy vaqtdan so‘ng o‘zi nurlanadi", 14, h - 18, { color: c.text2, bg: c.bg2, font: SMALL });
}

/* ------------------------------------------------------------------ 2. Lazer qurilmasi */

function newCavity() { lz.st = P.createCavity({ scheme: L().scheme, tau: L().tau, W: lz.wt / L().tau, R: lz.R, seed: seed++ }); lz.hist = []; lz.acc = 0; lz.beam = 0; lz.beamOut0 = 0; lz.beamT0 = 0; }
function laserStep(dt) {
  const st = lz.st; st.W = lz.wt / st.tau; st.R = lz.R;
  let rem = dt * SPEED; while (rem > 1e-9) { const d = Math.min(0.01, rem); P.stepCavity(st, d); rem -= d; }
  if (st.t - lz.beamT0 >= 0.5) { const rate = (st.nBeam - lz.beamOut0) / (st.t - lz.beamT0) / st.atoms.length; lz.beam = lz.beam * 0.4 + rate * 0.6; lz.beamOut0 = st.nBeam; lz.beamT0 = st.t; }
  lz.acc += dt * SPEED;
  if (lz.acc >= 0.1) { lz.acc = 0; const n = P.counts(st); lz.hist.push({ t: st.t, up: n.upper / n.N, low: n.lower / n.N, beam: lz.beam }); if (lz.hist.length > 600) lz.hist.shift(); }
}
const ATOM_COL = { G: null, P: "#8b5cf6", U: null, L: "#38bdf8" };
function drawLaser(ctx, c, w, h) {
  const narrow = w < 560, lt = L(), col = hex(lt.nm), st = lz.st, n = P.counts(st);
  const x0 = narrow ? 34 : 70, x1 = w - (narrow ? 70 : 200), cy = narrow ? h * 0.36 : h * 0.42, Hp = Math.min(narrow ? 120 : 130, (x1 - x0) * (narrow ? 0.42 : 0.32));
  const X = (x) => x0 + (x / P.ROD.L) * (x1 - x0), Y = (y) => cy - Hp / 2 + (y / P.ROD.H) * Hp;
  const pumpOn = lz.wt > 0, pk = Math.min(1, lz.wt / 4);
  // nasos
  if (lz.type === "ruby") {
    const ly = cy - Hp / 2 - 30;
    ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.beginPath(); ctx.roundRect(x0 + 10, ly - 9, x1 - x0 - 20, 18, 9); ctx.fill();
    if (pumpOn) { const flick = 0.75 + 0.25 * Math.sin(lz.st.t * 37) * Math.sin(lz.st.t * 13); ctx.fillStyle = `rgba(224,242,254,${0.35 + 0.6 * pk * flick})`; ctx.beginPath(); ctx.roundRect(x0 + 14, ly - 6, x1 - x0 - 28, 12, 6); ctx.fill();
      ctx.strokeStyle = `rgba(74,222,128,${0.25 + 0.5 * pk})`; ctx.lineWidth = 1.2; for (let k = 0; k < 9; k++) { const xx = x0 + 30 + (k / 8) * (x1 - x0 - 60); ctx.beginPath(); ctx.moveTo(xx, ly + 10); ctx.lineTo(xx + 6, cy - Hp / 2 - 3); ctx.stroke(); } }
    ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("ksenon chaqnash lampasi (nasos)", x0 + 14, ly - 11);
    // rubin sterjen
    const g = ctx.createLinearGradient(0, cy - Hp / 2, 0, cy + Hp / 2); g.addColorStop(0, "rgba(251,113,133,0.30)"); g.addColorStop(0.5, "rgba(225,29,72,0.16)"); g.addColorStop(1, "rgba(159,18,57,0.32)");
    ctx.fillStyle = g; ctx.fillRect(X(0), cy - Hp / 2, X(P.ROD.L) - X(0), Hp);
    ctx.strokeStyle = "rgba(190,18,60,0.6)"; ctx.lineWidth = 1.2; ctx.strokeRect(X(0), cy - Hp / 2, X(P.ROD.L) - X(0), Hp);
    ctx.fillStyle = c.text3; ctx.textBaseline = "top"; ctx.fillText("rubin kristali (Al₂O₃ + Cr³⁺)", x0 + 14, cy + Hp / 2 + 6);
  } else {
    const g = ctx.createLinearGradient(0, cy - Hp / 2, 0, cy + Hp / 2); g.addColorStop(0, `rgba(251,146,60,${0.08 + 0.25 * pk})`); g.addColorStop(0.5, `rgba(244,114,182,${0.06 + 0.2 * pk})`); g.addColorStop(1, `rgba(251,146,60,${0.08 + 0.25 * pk})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(X(0), cy - Hp / 2, X(P.ROD.L) - X(0), Hp, Hp / 2.5); ctx.fill();
    ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.55)" : "rgba(71,85,105,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();
    // elektrodlar
    ctx.fillStyle = c.dark ? "#94a3b8" : "#64748b"; const ey = cy - Hp / 2;
    for (const [xx, lab] of [[X(0.12), "katod −"], [X(0.88), "anod +"]]) { ctx.fillRect(xx - 3, ey - 18, 6, 18); ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(lab, xx, ey - 20); ctx.fillStyle = c.dark ? "#94a3b8" : "#64748b"; }
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(0.12), ey - 34); ctx.lineTo(X(0.42), ey - 34); ctx.moveTo(X(0.58), ey - 34); ctx.lineTo(X(0.88), ey - 34); ctx.stroke();
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(narrow ? "≈ 1 kV" : "yuqori kuchlanish ≈ 1 kV", X(0.5), ey - 34);
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("gaz: geliy + neon (10 : 1), past bosim", x0 + 14, cy + Hp / 2 + 6);
  }
  // ko'zgular
  const mW = 9;
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#94a3b8"; ctx.fillRect(X(0) - mW - 3, cy - Hp / 2 - 8, mW, Hp + 16);
  ctx.fillStyle = `rgba(148,163,184,${0.25 + 0.6 * lz.R})`; ctx.fillRect(X(P.ROD.L) + 3, cy - Hp / 2 - 8, mW, Hp + 16);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("100 %", X(0) - mW / 2 - 3, cy + Hp / 2 + (lz.type === "ruby" ? 22 : 22));
  ctx.fillText(`R = ${fmt(lz.R * 100, 0)} %`, X(P.ROD.L) + 3 + mW / 2, cy + Hp / 2 + 22);
  // atomlar
  const ar = Math.max(2.5, Math.min(6, ((x1 - x0) / P.ROD.nx) * 0.2));
  for (const a of st.atoms) {
    const x = X(a.x), y = Y(a.y);
    if (a.s === "U") { ctx.fillStyle = rgb(lt.nm, 0.25); ctx.beginPath(); ctx.arc(x, y, ar * 2, 0, TAU); ctx.fill(); }
    if (a.flash > 0) { ctx.strokeStyle = rgb(lt.nm, a.flash * 3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, ar * 2.6, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = a.s === "U" ? col : a.s === "G" ? (c.dark ? "#475569" : "#94a3b8") : ATOM_COL[a.s]; ctx.beginPath(); ctx.arc(x, y, ar, 0, TAU); ctx.fill();
  }
  // fotonlar
  ctx.lineWidth = 2; ctx.lineCap = "round";
  for (const p of st.ph) { const x = X(p.x), y = Y(p.y), ax = Math.abs(p.dy) < 0.1; ctx.strokeStyle = rgb(lt.nm, ax ? 0.95 : 0.45); ctx.beginPath(); ctx.moveTo(x - p.dx * 7, y - p.dy * 7); ctx.lineTo(x + p.dx * 3, y + p.dy * 3); ctx.stroke(); }
  ctx.lineCap = "butt";
  // lazer nuri va ekran
  const bx0 = X(P.ROD.L) + 3 + mW, bx1 = w - (narrow ? 10 : 30), I = clamp(lz.beam / 0.3, 0, 1);
  if (I > 0.02) { const gb = ctx.createLinearGradient(0, cy - 8, 0, cy + 8); gb.addColorStop(0, rgb(lt.nm, 0)); gb.addColorStop(0.5, rgb(lt.nm, 0.25 + 0.75 * I)); gb.addColorStop(1, rgb(lt.nm, 0)); ctx.fillStyle = gb; ctx.fillRect(bx0, cy - 8, bx1 - bx0, 16); ctx.fillStyle = rgb(lt.nm, 0.5 + 0.5 * I); ctx.fillRect(bx0, cy - 1.2, bx1 - bx0, 2.4); }
  for (const o of st.out) { const x = bx0 + (o.d / 0.6) * (bx1 - bx0), y = cy + (Y(o.y) - cy) + o.dy * (o.d / 0.6) * (bx1 - bx0); if (y < cy - Hp || y > cy + Hp) continue; ctx.fillStyle = rgb(lt.nm, Math.abs(o.dy) < 0.1 ? 0.9 : 0.35); ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
  ctx.fillStyle = c.dark ? "#1e293b" : "#e2e8f0"; ctx.fillRect(bx1, cy - Hp / 2 - 10, 7, Hp + 20);
  if (I > 0.02) { const gs = ctx.createRadialGradient(bx1, cy, 1, bx1, cy, 16 + 10 * I); gs.addColorStop(0, rgb(lt.nm, 0.9)); gs.addColorStop(1, rgb(lt.nm, 0)); ctx.fillStyle = gs; ctx.beginPath(); ctx.arc(bx1, cy, 16 + 10 * I, 0, TAU); ctx.fill(); }
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText("ekran", bx1 + 7, cy + Hp / 2 + 12);
  // populyatsiya diagrammasi
  const py0 = narrow ? cy + Hp / 2 + 44 : h - 96, pyH = narrow ? Math.min(100, h - (cy + Hp / 2 + 44) - 6) : 84, pbx = narrow ? 10 : 14, pbW = narrow ? w - 20 : 300;
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(pbx, py0, pbW, pyH - 6, 8); ctx.fill(); ctx.stroke();
  const rows = lt.scheme === 4 ? [[narrow ? "yuqori" : "yuqori lazer sathi", n.U, col], [narrow ? "pastki" : "pastki lazer sathi", n.L, "#38bdf8"], [narrow ? "asosiy" : "asosiy sath", n.G, c.dark ? "#475569" : "#94a3b8"]] : [[narrow ? "E₂ yuqori" : "E₂ — yuqori (metastabil)", n.U, col], [narrow ? "E₁ asosiy" : "E₁ — asosiy (pastki)", n.G, c.dark ? "#475569" : "#94a3b8"]];
  const rh = (pyH - 30) / rows.length, lw = narrow ? 70 : 140;
  ctx.font = SMALL; ctx.textBaseline = "middle";
  rows.forEach(([lab, k, cc], i) => { const y = py0 + 12 + i * rh + rh / 2; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.fillText(lab, pbx + 8, y); const bw = pbW - lw - 44; ctx.fillStyle = c.grid; ctx.fillRect(pbx + lw, y - 5, bw, 10); ctx.fillStyle = cc; ctx.fillRect(pbx + lw, y - 5, (bw * k) / n.N, 10); ctx.fillStyle = c.text; ctx.textAlign = "right"; ctx.fillText(String(k), pbx + pbW - 8, y); });
  const invTxt = n.inversion ? `inversiya bor: N₂ > N₁` : "inversiya yo‘q: N₂ ≤ N₁";
  tag(ctx, invTxt, pbx + 8, py0 + pyH - 2, { color: "#fff", bg: n.inversion ? c.success : c.text3, font: SMALL });
  // holat
  const lasing = lz.beam > 0.06;
  tag(ctx, lasing ? `lazer ishlamoqda: λ = ${fmt(lt.nm, 1)} nm` : pumpOn ? "faqat o‘z-o‘zidan nurlanish (generatsiya yo‘q)" : "nasos o‘chiq", w - (narrow ? 8 : 14), narrow ? 18 : 22, { color: lasing ? "#fff" : c.text, bg: lasing ? col : c.bg2, font: narrow ? SMALL : MID, align: "right" });
  if (!narrow) tag(ctx, `${lt.name}, nasos: ${lt.pump}`, w - 14, 48, { color: c.text2, bg: c.bg2, font: SMALL, align: "right" });
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "atom") drawAtom(ctx, c, s.w, s.h); else drawLaser(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.5, 380, 440)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
function drawGraphCanvas(ctx, gs) { if (ui.mode === "laser") drawHistory(ctx, gs, { hist: lz.hist, span: 30, col: hex(L().nm), lowName: L().scheme === 4 ? "pastki lazer sathi" : "asosiy sath", hover: ui.hover }); }
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = { laser: ["Sathlardagi atomlar va lazer nuri", "Nasos atomlarni yuqori sathga chiqaradi. N₂ pastki sathdagidan oshganda (inversiya) majburiy nurlanish yutilishdan ko‘p bo‘ladi va rezonatorda fotonlar ko‘chkisi boshlanadi. Lazer ishlay boshlagach, inversiya bo‘sag‘a darajasida «qotadi»: nasos keltirgan energiya nurga aylanadi. Rubin lazerida nur ko‘pincha impulslar (pichoqlar) ko‘rinishida chiqadi."] };
function setTab() {
  const t = TABS[ui.mode], card = $("[data-graph-card]"); ui.hover = null;
  card.hidden = !t;
  if (t) { $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); graph.render(); }
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const STATE = { E1: "asosiy holat E₁", E2: "uyg‘ongan E₂", E3: "nasos sathi E₃" };
const LAST = { abs: "yutildi (E₁ → E₂)", pump: "yutildi (E₁ → E₃)", stim: "majburiy nurlanish", spont: "o‘z-o‘zidan nurlanish", pass: "o‘tib ketdi", "": "—" };

function updateReadouts() {
  if (ui.mode === "atom") {
    const e = P.photonEV(at.nm), d = P.RUBY.E2 - P.RUBY.E1, r = P.interact(at.s, at.nm);
    setRO("r1", "Foton to‘lqin uzunligi <i>λ</i>", u(fmt(at.nm, 1), "nm"), colorName(at.nm), "orange");
    setRO("r2", "Foton energiyasi <i>hν</i>", u(fmt(e, 3), "eV"), "hν = hc/λ", "green");
    setRO("r3", "Lazer o‘tishi <i>E₂ − E₁</i>", u(fmt(d, 3), "eV"), "λ = 694,3 nm (qizil)");
    setRO("r4", "Atom holati", STATE[at.s], at.s === "E2" ? "metastabil — uzoq yashaydi" : at.s === "E3" ? "tez E₂ ga o‘tadi" : "eng kichik energiya", at.s === "E1" ? "" : "orange");
    setRO("r5", "Bu foton nima qiladi?", { absorb21: "yutiladi", absorb31: "yutiladi (nasos)", stim: "majburiy nurlantiradi", pass: "o‘tib ketadi" }[r], `oxirgi hodisa: ${LAST[at.last]}`, r === "pass" ? "" : "green");
    setRO("r6", "Hodisalar soni", `${at.n.abs + at.n.pump} / ${at.n.stim} / ${at.n.spont}`, "yutilish / majburiy / o‘z-o‘zidan");
    return;
  }
  const st = lz.st, n = P.counts(st), lt = L();
  setRO("r1", "Nasos quvvati <i>Wτ</i>", fmt(lz.wt, 1), lt.scheme === 3 ? "3 sathli: inversiya uchun Wτ > 1" : "4 sathli: pastki sath tez bo‘shaydi", "orange");
  setRO("r2", "Yuqori sathda <i>N₂</i>", u(String(n.upper), `/ ${n.N}`), `${fmt((n.upper / n.N) * 100, 0)} % atom`, "orange");
  setRO("r3", lt.scheme === 4 ? "Pastki lazer sathida <i>N₁</i>" : "Asosiy sathda <i>N₁</i>", u(String(n.lower), `/ ${n.N}`), `${fmt((n.lower / n.N) * 100, 0)} % atom`);
  setRO("r4", "Populyatsiya inversiyasi", n.inversion ? "bor" : "yo‘q", `N₂ − N₁ = ${n.upper - n.lower}`, n.inversion ? "green" : "");
  setRO("r5", "Rezonatordagi fotonlar", String(P.axial(st)), "o‘q bo‘ylab yuguruvchi (lazer modasi)");
  setRO("r6", "Lazer nuri", lz.beam > 0.06 ? u(fmt(lt.nm, 1), "nm") : "yo‘q", lz.beam > 0.06 ? `${colorName(lt.nm)}, hν = ${fmt(P.photonEV(lt.nm), 2)} eV; nisbiy quvvat ${fmt(lz.beam, 2)}` : "generatsiya bo‘sag‘asidan past", lz.beam > 0.06 ? "green" : "");
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "atom") { t = STATE[at.s]; tone = at.s === "E1" ? "blue" : "orange"; }
  else { const on = lz.beam > 0.06; t = on ? "lazer nuri bor" : lz.wt > 0 ? "generatsiya yo‘q" : "nasos o‘chiq"; tone = on ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "atom") {
    p.push("<p>Atom energiyani faqat ma’lum ulushlar bilan oladi va beradi. Foton atomga ta’sir qilishi uchun uning energiyasi sathlar farqiga teng bo‘lishi kerak: <b>hν = E₂ − E₁</b>. Aks holda foton atomdan o‘tib ketadi.</p>");
    p.push({ E1: "<p>Atom asosiy holatda. 694 nm li qizil foton uni E₂ ga chiqaradi (yutilish). Yashil-ko‘k foton (500–590 nm) uni keng E₃ tasmasiga chiqaradi — lazerda nasos aynan shunday ishlaydi.</p>", E2: "<p>Atom metastabil E₂ holatida — u bu yerda odatdagidan ming martalab uzoq (rubinda ≈ 3 ms) qoladi. Hech narsa bo‘lmasa, tasodifiy vaqtdan keyin <b>o‘z-o‘zidan</b> nurlanadi: foton istalgan yo‘nalishda, tasodifiy fazada chiqadi. Agar unga 694 nm foton kelsa, <b>majburiy nurlanish</b> bo‘ladi: yangi foton kelgan fotonning aniq nusxasi — chastotasi, yo‘nalishi va fazasi bir xil. Fotonlar soni ikki baravar bo‘ladi!</p>", E3: "<p>E₃ tasmasi juda qisqa yashaydi: atom energiyaning bir qismini kristall panjarasiga issiqlik sifatida berib, metastabil E₂ ga tushadi. Shu yo‘l bilan E₂ da atomlar to‘planadi.</p>" }[at.s]);
  } else {
    const lt = L();
    p.push("<p>Lazer uch qismdan iborat: <b>faol muhit</b> (atomlar), <b>nasos</b> (atomlarni uyg‘otadigan energiya manbai) va <b>rezonator</b> — ikki parallel ko‘zgu. Ko‘zgulardan biri yarim shaffof, nur u orqali chiqadi.</p>");
    p.push(lt.scheme === 3 ? "<p>Rubinda lazer o‘tishining pastki sathi — asosiy sath, unda boshida barcha atomlar turadi. Shuning uchun inversiya (N₂ > N₁) uchun atomlarning yarmidan ko‘pini uyg‘otish kerak — kuchli nasos lozim (Wτ > 1). Kuchsiz nasosda atomlar faqat o‘z-o‘zidan, har tomonga nurlanadi.</p>" : "<p>He–Ne lazerida elektr razryad geliy atomlarini uyg‘otadi, ular to‘qnashuvda energiyani neon atomlariga beradi. Neonning pastki lazer sathi juda tez bo‘shaydi, shuning uchun kuchsiz nasosda ham inversiya oson hosil bo‘ladi (4 sathli sxema).</p>");
    p.push("<p>O‘q bo‘ylab uchgan foton uyg‘ongan atomlarni majburiy nurlantirib, o‘ziga o‘xshash fotonlar ko‘chkisini hosil qiladi. Ko‘zgular uni qayta-qayta muhitdan o‘tkazadi, yon tomonga ketgan fotonlar esa yo‘qoladi. Natijada nur <b>monoxromatik</b> (bir to‘lqin uzunlikda), <b>kogerent</b> (fazalari mos), <b>juda kam sochiladigan</b> va <b>kuchli</b> bo‘ladi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "atom" ? "<small>Rezonans</small> hν = E₂ − E₁" : "<small>Inversiya</small> N₂ > N₁";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return; dt = Math.min(dt, 0.05);
  if (ui.mode === "atom") atomStep(dt, geo.atom); else laserStep(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.25) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); graph.render(); }
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
/** Harakatsiz rejimda (reduced motion) natijani darhol ko'rsatish */
function settle() {
  if (loop.running) return;
  if (ui.mode === "atom") for (let i = 0; i < 40; i++) atomStep(0.05, geo.atom);
  else for (let i = 0; i < 600; i++) laserStep(0.05);
}
$("[data-reset]").addEventListener("click", () => { if (ui.mode === "atom") { at.ph = []; setAtom("E1"); at.ev = null; at.last = ""; at.n = { abs: 0, stim: 0, spont: 0, pump: 0, pass: 0 }; } else newCavity(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const nmC = bindRange($("#aNm"), $("#aNmOut"), (v) => `${fmt(v, 1)} nm`, (v) => { at.nm = v; customized(); refresh(); });
const wtC = bindRange($("#lW"), $("#lWOut"), (v) => fmt(v, 1), (v) => { lz.wt = v; customized(); refresh(); });
const rC = bindRange($("#lR"), $("#lROut"), (v) => `${fmt(v, 0)} %`, (v) => { lz.R = v / 100; customized(); refresh(); });
document.querySelectorAll("[data-nm-value]").forEach((b) => b.addEventListener("click", () => { at.nm = Number(b.dataset.nmValue); nmC.set(at.nm); customized(); refresh(); }));
function setType(k) { lz.type = k; document.querySelectorAll("[data-type-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.typeValue === k))); newCavity(); }
document.querySelectorAll("[data-type-value]").forEach((b) => b.addEventListener("click", () => { setType(b.dataset.typeValue); customized(); settle(); refresh(); }));

const canvas = stage.canvas;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode !== "atom") return null;
  if (inBox(p, geo.send)) return "send"; if (inBox(p, geo.ground)) return "ground"; if (inBox(p, geo.excite)) return "excite";
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const h = hit(ptr(canvas, e)); if (!h) return; e.preventDefault(); customized();
  if (h === "send") sendPhoton(); else if (h === "ground") { setAtom("E1"); at.ev = null; } else { setAtom("E2"); at.ev = null; }
  settle(); refresh();
});
canvas.addEventListener("pointermove", (e) => { canvas.style.cursor = hit(ptr(canvas, e)) ? "pointer" : ""; });

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const AT = (title, lesson, s, nm, send = true) => ({ mode: "atom", title, lesson, set: () => { at.ph = []; at.ev = null; at.last = ""; at.n = { abs: 0, stim: 0, spont: 0, pump: 0, pass: 0 }; setAtom(s); at.nm = nm; nmC.set(nm); if (send) sendPhoton(); } });
const LZ = (title, lesson, type, wt, R, warm = 0) => ({ mode: "laser", title, lesson, set: () => { lz.wt = wt; lz.R = R; wtC.set(wt); rC.set(R * 100); seed = 11; setType(type); for (let i = 0; i < warm * 20; i++) laserStep(0.05); } });
const PRESETS = {
  aAbs: AT("Yutilish", "Asosiy holatdagi atomga 694,3 nm li foton keldi: hν = E₂ − E₁ = 1,79 eV — foton yutiladi, atom E₂ sathiga chiqadi.", "E1", 694.3),
  aStim: AT("Majburiy nurlanish", "Uyg‘ongan atomga xuddi shunday foton keldi: atom E₁ ga tushib, ikkinchi fotonni chiqaradi. Ikkala foton bir xil rang, yo‘nalish va fazada — to‘lqinlar ustma-ust tushadi.", "E2", 694.3),
  aSpont: AT("O‘z-o‘zidan nurlanish", "Hech qanday foton kelmayapti: uyg‘ongan atom tasodifiy vaqtdan keyin o‘zi nurlanadi. Foton istalgan yo‘nalishda chiqadi — oddiy lampalar shunday nur sochadi.", "E2", 694.3, false),
  aPump: AT("Nasos: yashil foton", "550 nm li yashil foton atomni E₃ tasmasiga chiqaradi; atom tezda nurlanishsiz E₂ ga tushadi. Rubin lazerida chaqnash lampasining yashil-ko‘k nuri atomlarni shunday uyg‘otadi.", "E1", 550),
  aMiss: AT("Rezonans yo‘q", "600 nm li fotonning energiyasi 2,07 eV — hech bir o‘tishga mos emas, atom uni yutmaydi va foton o‘tib ketadi.", "E1", 600),
  lOff: LZ("Nasos o‘chiq", "Nasos yo‘q: barcha atomlar asosiy sathda, hech narsa nurlanmaydi. Nasos quvvatini oshiring.", "ruby", 0, 0.8),
  lWeak: LZ("Kuchsiz nasos", "Wτ = 0,6: atomlarning yarmidan kami uyg‘ongan, inversiya yo‘q. Ular faqat o‘z-o‘zidan, har tomonga nurlanadi — lazer nuri yo‘q.", "ruby", 0.6, 0.8, 12),
  lRuby: LZ("Rubin lazeri", "Wτ = 3: inversiya hosil bo‘ldi, o‘q bo‘ylab fotonlar ko‘chkisi boshlanadi va yarim shaffof ko‘zgudan qizil (694,3 nm) lazer nuri chiqadi.", "ruby", 3, 0.8, 12),
  lNoMirror: LZ("Rezonatorsiz", "Nasos kuchli, inversiya bor, lekin chiqish ko‘zgusi yo‘q (R = 0). Fotonlar muhitdan bir marta o‘tib chiqib ketadi — kuchli nur hosil bo‘lmaydi. Rezonator nima uchun kerakligini ko‘ring.", "ruby", 3, 0, 12),
  lHeNe: LZ("Geliy–neon lazeri", "He–Ne lazeri 4 sathli sxemada ishlaydi: kuchsiz nasosda (Wτ = 0,6) ham inversiya bor va 632,8 nm li qizil nur uzluksiz chiqadi. Maktab laboratoriyalaridagi lazerlar shunday.", "hene", 0.6, 0.9, 12),
};
const GROUPS = [["Bitta atom", ["aAbs", "aStim", "aSpont", "aPump", "aMiss"]], ["Lazer qurilmasi", ["lOff", "lWeak", "lRuby", "lNoMirror", "lHeNe"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { atom: "«Foton yuborish» ni bosing", laser: "Nasos va ko‘zguni o‘zgartiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", ui.mode === "atom" ? "Atom, fotonlar va energiya sathlari diagrammasi" : "Lazer: faol muhit, nasos, ikki ko‘zgu va chiqayotgan nur");
}
const MODE_DEFAULT = { atom: "aStim", laser: "lRuby" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  ui.hover = null; ui.mode = p.mode;
  if (!lz.st) newCavity();
  startIfNeeded(); p.set(); settle();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  setTab(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "aStim");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
