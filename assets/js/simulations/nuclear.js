// ==========================================================================
// Yadro fizikasi — virtual laboratoriya (simulations/nuclear.html)
// 1) Radioaktiv yemirilish: 100/400/1600 yadroli namuna, har yadro tasodifiy yemiriladi (α, β⁻, γ zarrachalari
//    uchib chiqadi); N(t) va faollik grafiklari, o'lchovdan T½ (EKK). Yadroni bosib holatini ko'rish.
// 2) Bog'lanish energiyasi: proton va neytronlarni sudrab yadro yasash; E_b, E_b/A, massa defekti, barqarorlik;
//    sintez va bo'linish reaksiyalarining energiyasi; E_b/A (A) egri chizig'i.
// 3) Zanjir reaksiya: ²³⁵U/²³⁸U to'ri, neytronlar, boshqaruv sterjenlari (sahnada suriladi), k koeffitsiyenti, n(t), E(t).
// Fizika: nuclear-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./nuclear-physics.js";
import { drawDecay, drawActivity, drawBinding, drawChain, lastFrame } from "./nuclear-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const SEC_PER_HALF = 3, HALVES = 6;
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹", SUB = "₀₁₂₃₄₅₆₇₈₉";
const sup = (n) => String(n).split("").map((d) => SUP[+d]).join("");
const sub = (n) => String(n).split("").map((d) => SUB[+d]).join("");
const nuclide = (Z, A) => (Z === 0 ? "n" : `${sup(A)}${P.symOf(Z)}`);

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "decay", tab: "N", speed: 1, hover: null };
const dec = { iso: "c14", N0: 400, sample: null, t: 0, hist: [], bins: [], flashes: [], sel: null, seed: 1 };
const bind = { Z: 6, N: 6, view: "build", rx: "dt", ghost: null };
const chain = { enrich: 0.6, size: 24, depth: 0, core: null, hist: [], flashes: [], k: null, kTimer: 0, pTimer: 0, recent: [], seed: 3 };
let presetId = null;
const geo = {};
let running = false;

/* ------------------------------------------------------------------ 1. Yemirilish */

const iso = () => P.ISOTOPES[dec.iso];
const tMaxDec = () => HALVES * iso().half;
const binW = () => iso().half / 4;
function resetDecay() {
  dec.seed++;
  dec.sample = P.createSample(dec.N0, dec.seed); dec.t = 0; dec.hist = [{ t: 0, N: dec.N0 }];
  dec.bins = new Array(Math.ceil(tMaxDec() / binW())).fill(0); dec.flashes = []; dec.sel = null;
}
function stepDecay(dt) {
  const T = iso().half, h = Math.min((dt * ui.speed * T) / SEC_PER_HALF, tMaxDec() - dec.t);
  if (h <= 0) return;
  const out = dec.sample.step(h, T);
  for (const i of out) {
    const b = Math.floor(dec.sample.decayedAt[i] / binW()); if (b < dec.bins.length) dec.bins[b]++;
    if (dec.flashes.length < 80) dec.flashes.push({ i, age: 0, a: Math.random() * TAU });
  }
  dec.t = dec.sample.t;
  const lp = dec.hist[dec.hist.length - 1];
  if (out.length || dec.t - lp.t > T / 30) dec.hist.push({ t: dec.t, N: dec.sample.N });
  dec.flashes.forEach((f) => { f.age += dt; }); dec.flashes = dec.flashes.filter((f) => f.age < 0.8);
}
const decDone = () => dec.t >= tMaxDec() - 1e-9 || dec.sample.N === 0;

function decayGrid(w, h) {
  const n = Math.round(Math.sqrt(dec.N0)), narrow = w < 520, S = Math.min(h - 20, narrow ? w - 20 : w * 0.46), cell = S / n;
  return { n, S, cell, x0: narrow ? (w - S) / 2 : 10, y0: (h - S) / 2, narrow }; // tor ekranda faqat namuna
}
function drawDecayStage(ctx, c, w, h) {
  const g = decayGrid(w, h), I = iso(), s = dec.sample, parentC = c.warning, rr = Math.max(1.6, g.cell * 0.36);
  geo.grid = g;
  for (let i = 0; i < dec.N0; i++) {
    const x = g.x0 + ((i % g.n) + 0.5) * g.cell, y = g.y0 + (Math.floor(i / g.n) + 0.5) * g.cell, alive = s.decayedAt[i] === Infinity;
    ctx.fillStyle = alive ? parentC : c.dark ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.35)";
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  }
  // yemirilish chaqnashlari va uchib chiqqan zarrachalar
  for (const f of dec.flashes) {
    const x = g.x0 + ((f.i % g.n) + 0.5) * g.cell, y = g.y0 + (Math.floor(f.i / g.n) + 0.5) * g.cell, u = f.age / 0.8;
    ctx.strokeStyle = c.text; ctx.globalAlpha = 1 - u; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, rr + 6 * u + 1, 0, TAU); ctx.stroke();
    const d = 8 + 40 * u, px = x + Math.cos(f.a) * d, py = y + Math.sin(f.a) * d;
    if (I.type === "α") { ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, TAU); ctx.fill(); }
    else if (I.type === "β⁻") { ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = c.special; ctx.lineWidth = 1.6; ctx.beginPath(); for (let k = 0; k <= 12; k++) { const q = (k / 12) * d, ox = Math.cos(f.a) * q - Math.sin(f.a) * Math.sin(k * 1.6) * 3, oy = Math.sin(f.a) * q + Math.cos(f.a) * Math.sin(k * 1.6) * 3; if (k) ctx.lineTo(x + ox, y + oy); else ctx.moveTo(x + ox, y + oy); } ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (dec.sel !== null) {
    const i = dec.sel, x = g.x0 + ((i % g.n) + 0.5) * g.cell, y = g.y0 + (Math.floor(i / g.n) + 0.5) * g.cell, t = s.decayedAt[i];
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rr + 4, 0, TAU); ctx.stroke();
    tag(ctx, t === Infinity ? `${I.sym}: hali yemirilmagan` : `${I.daughter}: t = ${sci(t, 3)} ${I.unit} da yemirildi`, clamp(x + 10, 4, g.x0 + g.S - 120), clamp(y - 16, 12, h - 12), { color: c.text, bg: c.bg2, font: SMALL });
  }
  // o'ng tomonda ma'lumot
  const ix = g.x0 + g.S + 18, iw = w - ix - 10; if (g.narrow || iw < 120) return;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = c.text; ctx.font = "700 15px Inter, system-ui, sans-serif"; ctx.fillText(`${I.name} (${I.sym})`, ix, 14);
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.fillText(`${I.type}-yemirilish, T½ = ${sci(I.half, 4)} ${I.unit}`, ix, 36);
  ctx.font = "600 13px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text; ctx.fillText(I.eq, ix, 56);
  // soat: o'tgan yarim yemirilish davrlari
  const R = Math.min(42, iw * 0.2, h * 0.16), cx = ix + R + 2, cy = 100 + R, nT = dec.t / I.half;
  ctx.strokeStyle = c.border; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * (nT % 1 || (nT > 0 && nT % 1 === 0 ? 1 : 0))); ctx.stroke();
  ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt(nT, 2)}`, cx, cy - 6);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.fillText("T½ o‘tdi", cx, cy + 10);
  ctx.textAlign = "left"; ctx.fillStyle = c.text2; ctx.font = MID;
  ctx.fillText(`t = ${sci(dec.t, 3)} ${I.unit}`, cx + R + 14, cy - 18);
  ctx.fillText(`qoldi: N = ${s.N} / ${dec.N0}`, cx + R + 14, cy);
  ctx.fillText(`nazariy: ${fmt(P.remaining(dec.N0, dec.t, I.half), 1)}`, cx + R + 14, cy + 18);
  // ulush ustuni
  const by = cy + R + 22, bw = iw - 4, frac = s.N / dec.N0;
  ctx.fillStyle = c.bg2; ctx.fillRect(ix, by, bw, 14); ctx.fillStyle = parentC; ctx.fillRect(ix, by, bw * frac, 14);
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.strokeRect(ix + 0.5, by + 0.5, bw, 14);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textBaseline = "top"; ctx.fillText(`${I.sym} (to‘q sariq) — ${fmt(frac * 100, 1)} %; ${I.daughter} (kulrang)`, ix, by + 18);
}

/* ------------------------------------------------------------------ 2. Bog'lanish energiyasi */

const bindLayout = (w, h) => ({ pile: { p: { x: 44, y: h * 0.3 }, n: { x: 44, y: h * 0.72 } }, cx: w < 560 ? w * 0.42 : w * 0.34, cy: h * 0.5, rn: bind.Z + bind.N > 36 ? 6 : 7.5 });
function nucleonPos(A, Z, cx, cy, rn) {
  const out = [];
  for (let i = 0; i < A; i++) {
    const r = rn * 1.06 * Math.sqrt(i) * 1.02, a = i * 2.39996;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, p: Math.floor(((i + 1) * Z) / A) > Math.floor((i * Z) / A) });
  }
  return out;
}
function ball(ctx, c, x, y, r, proton) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
  if (proton) { g.addColorStop(0, "#fca5a5"); g.addColorStop(1, c.dark ? "#dc2626" : "#b91c1c"); }
  else { g.addColorStop(0, c.dark ? "#e2e8f0" : "#cbd5e1"); g.addColorStop(1, c.dark ? "#64748b" : "#475569"); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function drawBuild(ctx, c, w, h) {
  const L = bindLayout(w, h), A = bind.Z + bind.N;
  geo.bind = L;
  for (const [k, p] of Object.entries(L.pile)) {
    for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 9 : 0; ball(ctx, c, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 7, k === "p"); }
    ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(k === "p" ? "protonlar" : "neytronlar", p.x, p.y + 20);
  }
  const pos = nucleonPos(A, bind.Z, L.cx, L.cy, L.rn);
  geo.nucR = pos.length ? Math.max(...pos.map((q) => Math.hypot(q.x - L.cx, q.y - L.cy))) + L.rn : L.rn;
  ctx.strokeStyle = c.border; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(L.cx, L.cy, geo.nucR + 14, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  for (let i = pos.length - 1; i >= 0; i--) ball(ctx, c, pos[i].x, pos[i].y, L.rn, pos[i].p);
  geo.nucleons = pos;
  if (bind.ghost) ball(ctx, c, bind.ghost.x, bind.ghost.y, L.rn + 1, bind.ghost.type === "p");
  // ma'lumot
  const ix = w < 560 ? L.cx + geo.nucR + 22 : w * 0.58, Z = bind.Z, st = P.stability(Z, A), b = P.binding(Z, A);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.text; ctx.font = "700 40px Inter, system-ui, sans-serif";
  const symW = ctx.measureText(P.SYM[Z]).width;
  ctx.fillText(P.SYM[Z], ix + 30, 70);
  ctx.font = "700 16px Inter, system-ui, sans-serif"; ctx.textAlign = "right"; ctx.fillText(String(A), ix + 26, 46); ctx.fillText(String(Z), ix + 26, 72);
  ctx.textAlign = "left"; ctx.font = MID; ctx.fillStyle = c.text2; ctx.fillText(`${P.NAME[Z]}, A = ${A}`, ix + 34 + symW + 8, 50);
  ctx.fillStyle = st.stable ? c.success : c.danger; ctx.font = "700 12px Inter, system-ui, sans-serif";
  ctx.fillText(st.stable ? `barqaror${st.exact ? "" : " (taxminan)"}` : `radioaktiv: ${st.decay}${st.exact ? "" : " (taxminan)"}`, ix + 34 + symW + 8, 68);
  const rows = [["E_b", `${fmt(b.B, 2)} MeV${b.real ? "" : " (formula)"}`], ["E_b/A", `${fmt(A > 1 ? b.B / A : 0, 3)} MeV`], ["Δm", `${fmt(P.massDefect(b.B), 5)} u`]];
  ctx.font = MID; rows.forEach(([k, v], i) => { ctx.fillStyle = c.text3; ctx.fillText(k, ix, 104 + i * 20); ctx.fillStyle = c.text; ctx.fillText(v, ix + 46, 104 + i * 20); });
  // E_b/A ustuni (eng katta 8,8 MeV ga nisbatan)
  const bw = Math.min(200, w - ix - 14), by = 104 + rows.length * 20;
  ctx.fillStyle = c.bg2; ctx.fillRect(ix, by, bw, 10); ctx.fillStyle = c.primary; ctx.fillRect(ix, by, bw * clamp((A > 1 ? b.B / A : 0) / 8.8, 0, 1), 10);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textBaseline = "top"; ctx.fillText("⁵⁶Fe / ⁶²Ni darajasiga nisbatan (8,8 MeV)", ix, by + 14);
}
function drawReaction(ctx, c, w, h) {
  const R = P.REACTIONS[bind.rx], parts = [...R.inp.map((q) => ({ q, side: 0 })), ...R.out.map((q) => ({ q, side: 1 }))];
  const n = parts.length + 1, gap = w / (n + 0.5), y = h * 0.36;
  let x = gap * 0.75;
  parts.forEach((p, i) => {
    const [Z, A] = p.q;
    if (i === R.inp.length) { ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - gap * 0.3, y); ctx.lineTo(x + gap * 0.3, y); ctx.lineTo(x + gap * 0.2, y - 6); ctx.moveTo(x + gap * 0.3, y); ctx.lineTo(x + gap * 0.2, y + 6); ctx.stroke(); x += gap; }
    const rad = A <= 4 ? 8 + A * 2 : clamp(6 * Math.cbrt(A), 16, Math.min(40, gap * 0.42));
    if (A <= 4) { const pos = nucleonPos(A, Z, x, y, 7.5); pos.forEach((q) => ball(ctx, c, q.x, q.y, 7.5, q.p)); }
    else { const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 2, x, y, rad); g.addColorStop(0, c.dark ? "#fdba74" : "#fed7aa"); g.addColorStop(1, c.dark ? "#c2410c" : "#ea580c"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); }
    ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(nuclide(Z, A), x, y + Math.max(rad, 16) + 6);
    if (Z > 0 && gap >= 70) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.fillText(`E_b = ${fmt(P.binding(Z, A).B, 1)}`, x, y + Math.max(rad, 16) + 24); }
    if (i < parts.length - 1 && i !== R.inp.length - 1) { ctx.fillStyle = c.text2; ctx.font = BOLD; ctx.textBaseline = "middle"; ctx.fillText("+", x + gap / 2, y); }
    x += gap;
  });
  // energiya ustunlari
  const sIn = R.inp.reduce((s, [Z, A]) => s + P.binding(Z, A).B, 0), sOut = R.out.reduce((s, [Z, A]) => s + P.binding(Z, A).B, 0), Q = sOut - sIn;
  const bx = 20, bw = w - 40, y0 = h * 0.66, sc = bw / Math.max(sOut, 1);
  [[`ΣE_b boshida: ${fmt(sIn, 1)} MeV`, sIn, c.text3], [`ΣE_b oxirida: ${fmt(sOut, 1)} MeV`, sOut, c.primary]].forEach(([lab, v, col], i) => {
    const yy = y0 + i * 34; ctx.fillStyle = col; ctx.globalAlpha = 0.8; ctx.fillRect(bx, yy, v * sc, 14); ctx.globalAlpha = 1;
    ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(lab, bx, yy - 3);
  });
  ctx.fillStyle = c.warning; ctx.fillRect(bx + sIn * sc, y0 + 34, Q * sc, 14);
  ctx.font = MID; const qt = `Q = ${fmt(Q, 2)} MeV ajraladi`, qw = ctx.measureText(qt).width + 12;
  tag(ctx, qt, clamp(bx + sIn * sc + (Q * sc) / 2 - qw / 2, 4, w - 4 - qw), y0 + 66, { color: c.warning, bg: c.bg, font: MID });
}

/* ------------------------------------------------------------------ 3. Zanjir reaksiya */

function buildCore() {
  const cols = chain.size, rows = Math.max(4, Math.round(cols * 0.58)), rods = [];
  for (let x = 4; x < cols; x += 4) rods.push({ x, depth: chain.depth });
  chain.seed++;
  chain.core = P.createCore({ w: cols, h: rows, cols, rows, enrich: chain.enrich, rods, seed: chain.seed });
  chain.hist = [{ t: 0, n: 0, E: 0 }]; chain.flashes = []; chain.recent = []; chain.kTimer = 0; chain.pTimer = 0;
  measureK();
}
function measureK() {
  const co = chain.core;
  chain.k = P.measureK({ w: co.w, h: co.h, cols: co.w, rows: co.h, kinds: co.nuclei.map((q) => q.kind), done: co.nuclei.map((q) => q.done), rods: co.rods, starts: co.neutrons.map((n) => ({ x: n.x, y: n.y })) }, 300, chain.seed);
}
function fire(n = 4) {
  const co = chain.core; for (let k = 0; k < n; k++) co.inject(0.05, co.h / 2 + (k - (n - 1) / 2) * 0.25, (k - (n - 1) / 2) * 0.18);
}
function stepChain(dt) {
  const co = chain.core; let h = dt * ui.speed;
  while (h > 1e-9) {
    const d = Math.min(h, 1 / 60); h -= d; co.step(d);
    for (const e of co.events) if (chain.flashes.length < 120) chain.flashes.push({ ...e, age: 0 });
    if (co.events.some((e) => e.type === "fission")) chain.recent.push({ t: co.t, f: co.events.filter((e) => e.type === "fission").length });
  }
  chain.flashes.forEach((f) => { f.age += dt; }); chain.flashes = chain.flashes.filter((f) => f.age < 0.6);
  chain.recent = chain.recent.filter((r) => co.t - r.t <= 1);
  const lp = chain.hist[chain.hist.length - 1];
  if (co.t - lp.t >= 0.1) chain.hist.push({ t: co.t, n: co.neutrons.length, E: co.stats.fissions * P.E_FISSION });
  chain.kTimer += dt; if (chain.kTimer > 1) { chain.kTimer = 0; measureK(); }
}
function coreGeom(w, h) {
  const co = chain.core, cell = Math.min((w - 60) / co.w, (h - 46) / co.h);
  return { cell, x0: 44 + (w - 56 - co.w * cell) / 2, y0: 30 + (h - 38 - co.h * cell) / 2 };
}
function drawChainStage(ctx, c, w, h) {
  const co = chain.core, g = coreGeom(w, h), X = (x) => g.x0 + x * g.cell, Y = (y) => g.y0 + y * g.cell;
  geo.core = g;
  ctx.fillStyle = c.dark ? "rgba(56,189,248,0.06)" : "rgba(14,165,233,0.06)"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(X(0), Y(0), co.w * g.cell, co.h * g.cell, 6); ctx.fill(); ctx.stroke();
  const rr = Math.max(2.2, g.cell * 0.26);
  for (const q of co.nuclei) {
    const x = X(q.x), y = Y(q.y);
    if (!q.done) { ctx.fillStyle = q.kind === 235 ? c.warning : c.dark ? "#64748b" : "#94a3b8"; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); }
    else if (q.cap) { ctx.strokeStyle = c.special; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = c.dark ? "rgba(253,186,116,0.35)" : "rgba(234,88,12,0.25)"; ctx.beginPath(); ctx.arc(x - rr * 0.45, y, rr * 0.55, 0, TAU); ctx.arc(x + rr * 0.45, y, rr * 0.55, 0, TAU); ctx.fill(); }
  }
  // sterjenlar
  const dpx = chain.depth * co.h * g.cell;
  for (const r of co.rods) {
    ctx.fillStyle = c.dark ? "#334155" : "#475569"; ctx.fillRect(X(r.x) - g.cell / 2, Y(0) - 14, g.cell, dpx + 14);
  }
  if (co.rods.length) {
    ctx.strokeStyle = c.dark ? "#475569" : "#334155"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(co.rods[0].x), Y(0) - 14); ctx.lineTo(X(co.rods[co.rods.length - 1].x), Y(0) - 14); ctx.stroke();
    const hx = X(co.rods[Math.floor((co.rods.length - 1) / 2)].x), hy = Y(0) + dpx;
    ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(hx, hy - 6); ctx.lineTo(hx - 3, hy - 2); ctx.lineTo(hx + 3, hy - 2); ctx.closePath(); ctx.moveTo(hx, hy + 6); ctx.lineTo(hx - 3, hy + 2); ctx.lineTo(hx + 3, hy + 2); ctx.closePath(); ctx.fill();
    geo.rodHandle = { x: hx, y: hy, r: 16 };
  } else geo.rodHandle = null;
  // neytron manbai
  ctx.fillStyle = c.dark ? "#1e3a8a" : "#bfdbfe"; ctx.strokeStyle = c.primary; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(X(0) - 30, Y(co.h / 2) - 10, 24, 20, 4); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.primary; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("n", X(0) - 18, Y(co.h / 2));
  geo.gun = { x: X(0) - 18, y: Y(co.h / 2), r: 16 };
  // chaqnashlar
  for (const f of chain.flashes) {
    const x = X(f.x), y = Y(f.y), u = f.age / 0.6;
    ctx.globalAlpha = 1 - u;
    if (f.type === "fission") { ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(x, y, rr + 10 * u + 2, 0, TAU); ctx.fill(); }
    else if (f.type === "cap") { ctx.strokeStyle = c.special; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rr + 6 * u, 0, TAU); ctx.stroke(); }
    else { ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // neytronlar
  ctx.fillStyle = c.primary;
  for (const n of co.neutrons) { ctx.beginPath(); ctx.arc(X(n.x), Y(n.y), 2.4, 0, TAU); ctx.fill(); }
  // izohlar
  ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const ly = Math.min(h - 8, Y(co.h) + 12);
  [[c.warning, "²³⁵U"], [c.dark ? "#64748b" : "#94a3b8", "²³⁸U"], [c.primary, "neytron"]].forEach(([col, lab], i) => {
    const x = X(0) + i * 74; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 4, ly, 4, 0, TAU); ctx.fill(); ctx.fillStyle = c.text2; ctx.fillText(lab, x + 12, ly);
  });
}

/* ------------------------------------------------------------------ Chizish */

function draw(ctx, st) {
  const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "decay" && dec.sample) drawDecayStage(ctx, c, st.w, st.h);
  else if (ui.mode === "bind") (bind.view === "build" ? drawBuild : drawReaction)(ctx, c, st.w, st.h);
  else if (ui.mode === "chain" && chain.core) drawChainStage(ctx, c, st.w, st.h);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.55, vh * 0.42), 260, 350)), graph: Math.round(clamp(vh * 0.28, 180, 260)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

function drawGraph(ctx, gst) {
  if (ui.mode === "decay" && dec.sample) {
    const o = { iso: iso(), N0: dec.N0, hist: dec.hist, bins: dec.bins, bw: binW(), tMax: tMaxDec(), hover: ui.hover };
    return ui.tab === "A" ? drawActivity(ctx, gst, o) : drawDecay(ctx, gst, o);
  }
  if (ui.mode === "bind") {
    if (bind.view === "build") { const A = bind.Z + bind.N; return drawBinding(ctx, gst, { cur: A > 1 ? { Z: bind.Z, A, B: P.binding(bind.Z, A).B, label: nuclide(bind.Z, A) } : null, hover: ui.hover }); }
    const R = P.REACTIONS[bind.rx], c = gst.colors, pts = [], arrows = [];
    R.inp.filter(([Z]) => Z > 0).forEach(([Z, A]) => pts.push({ Z, A, label: nuclide(Z, A), color: c.text2 }));
    R.out.filter(([Z]) => Z > 0).forEach(([Z, A]) => pts.push({ Z, A, label: nuclide(Z, A), color: c.success }));
    const from = R.inp.filter(([Z]) => Z > 0), to = R.out.filter(([Z]) => Z > 0);
    for (const [Z0, A0] of from) for (const [Z1, A1] of to) arrows.push({ A0, y0: P.binding(Z0, A0).B / A0, A1, y1: P.binding(Z1, A1).B / A1, color: c.success });
    return drawBinding(ctx, gst, { cur: null, pts, arrows, hover: ui.hover });
  }
  if (ui.mode === "chain" && chain.core) return drawChain(ctx, gst, { tab: ui.tab, hist: chain.hist, tMax: chain.core.t, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraph, { height: (cw) => heights(cw).graph });

const TABS = {
  decay: { N: ["Qolgan yadrolar soni N(t)", "Har T½ da qolgan yadrolar soni ikki marta kamayadi. Ko‘k — namunadagi haqiqiy son (tasodifiy), to‘q sariq shtrix — qonun N₀·2^(−t/T½). Yadrolar kam bo‘lsa, tasodifiy chetlanish sezilarli."], A: ["Faollik: yemirilishlar soni", "Har ustun — T½/4 vaqt ichidagi yemirilishlar. Faollik A = λN ham yarim yemirilish davri bilan kamayadi."] },
  bind: { B: ["Solishtirma bog‘lanish energiyasi E_b/A (A)", "Nuqtalar — haqiqiy yadrolar, shtrix — tomchi modeli formulasi. Eng mustahkam yadrolar ⁵⁶Fe–⁶²Ni atrofida: yengil yadrolar qo‘shilganda (sintez) va og‘ir yadrolar bo‘linganda E_b/A ortadi — energiya ajraladi."] },
  chain: { n: ["Neytronlar soni n(t)", "Logarifmik shkala: k > 1 da neytronlar soni eksponensial ortadi (to‘g‘ri chiziq yuqoriga), k < 1 da kamayadi."], e: ["Ajralgan energiya E(t)", "Har bo‘linishda ≈ 200 MeV ajraladi (bo‘laklar kinetik energiyasi, neytronlar, γ-nurlanish)."] },
};
const TAB_LABEL = { N: "N(t)", A: "Faollik", n: "n(t)", e: "E(t)" };
function setTab(tab) {
  ui.tab = tab;
  const t = TABS[ui.mode][tab];
  $("[data-tabs]").innerHTML = Object.keys(TABS[ui.mode]).length > 1 ? Object.keys(TABS[ui.mode]).map((k) => `<button type="button" data-tab-value="${k}" aria-pressed="${k === tab}">${TAB_LABEL[k]}</button>`).join("") : "";
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1];
  graph.canvas.setAttribute("aria-label", t[0]); graph.render();
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
const COAL = 2.9e7; // J/kg

function updateReadouts() {
  if (ui.mode === "decay") {
    const I = iso(), s = dec.sample, T = I.half, lam = P.lambdaOf(T), Tf = P.fitHalfLife(dec.hist);
    setRO("r1", "Vaqt <i>t</i>", u(sci(dec.t, 3), I.unit), `= ${fmt(dec.t / T, 2)}·T½`);
    setRO("r2", "Qolgan yadrolar <i>N</i>", u(s.N, `/ ${dec.N0}`), `nazariy N₀·2^(−t/T½) = ${fmt(P.remaining(dec.N0, dec.t, T), 1)}`);
    setRO("r3", "Yemirilgan", u(dec.N0 - s.N, "ta"), `${I.daughter} hosil bo‘ldi`);
    setRO("r4", "Yarim yemirilish davri <i>T½</i>", u(sci(T, 4), I.unit), `λ = ln2/T½ = ${sci(lam, 3)} 1/${I.unit}`);
    setRO("r5", "T½ o‘lchovdan (EKK)", Tf ? u(sci(Tf, 3), I.unit) : "—", Tf ? `jadvaldan farqi ${fmt(((Tf - T) / T) * 100, 1)} %` : "ma’lumot yetarli emas", "orange");
    setRO("r6", "Faollik <i>A = λN</i>", u(sci(lam * s.N, 3), ` yemirilish/${I.unit}`), dec.iso === "c14" && s.N < dec.N0 ? `qolgan ${fmt((s.N / dec.N0) * 100, 1)} % → yosh ${sci(P.age(s.N / dec.N0, T), 3)} yil` : "vaqt birligidagi yemirilishlar soni");
    return;
  }
  if (ui.mode === "bind") {
    if (bind.view === "build") {
      const Z = bind.Z, A = Z + bind.N, b = P.binding(Z, A), st = P.stability(Z, A), dm = P.massDefect(b.B);
      setRO("r1", "Nuklid", `${sup(A)}${sub(Z)}${P.SYM[Z]}`, `${P.NAME[Z]}: Z = ${Z}, N = ${bind.N}`);
      setRO("r2", "Bog‘lanish energiyasi <i>E<sub>b</sub></i>", u(fmt(b.B, 2), "MeV"), b.real ? "jadval (AME2020)" : "Bete–Vaytszekker formulasi bo‘yicha");
      setRO("r3", "Solishtirma <i>E<sub>b</sub>/A</i>", u(fmt(A > 1 ? b.B / A : 0, 3), "MeV"), "bitta nuklonga to‘g‘ri keladi");
      setRO("r4", "Massa defekti <i>Δm</i>", u(fmt(dm, 5), "u"), `= E_b / 931,5 MeV = ${sci(dm * 1.6605e-27, 3)} kg`);
      setRO("r5", "Yadro massasi <i>M<sub>ya</sub></i>", u(fmt(P.nucleusMass(Z, A, b.B), 5), "u"), `Zm_p + Nm_n = ${fmt(Z * P.MP + bind.N * P.MN, 5)} u`);
      setRO("r6", "Barqarorlik", st.stable ? "barqaror" : st.decay, st.stable ? (st.exact ? "tabiatda uchraydi" : "barqarorlik chizig‘iga yaqin (taxminan)") : st.decay === "β⁻" ? "neytronlar ortiqcha: n → p + e⁻ + ν̃" : st.decay === "β⁺" ? "protonlar ortiqcha: p → n + e⁺ + ν" : st.decay === "α" ? "juda og‘ir yoki ⁸Be: α-zarra chiqadi" : "bog‘lanmagan zarra ajraladi", st.stable ? "" : "orange");
      return;
    }
    const R = P.REACTIONS[bind.rx], sIn = R.inp.reduce((s, [Z, A]) => s + P.binding(Z, A).B, 0), sOut = R.out.reduce((s, [Z, A]) => s + P.binding(Z, A).B, 0), Q = sOut - sIn;
    const mIn = R.inp.reduce((s, [, A]) => s + A, 0) * 1.6605e-27, Ekg = (Q * 1.602e-13) / mIn;
    setRO("r1", "Reaksiya", R.eq, R.name);
    setRO("r2", "ΣE<sub>b</sub> boshida", u(fmt(sIn, 2), "MeV"), "boshlang‘ich yadrolar");
    setRO("r3", "ΣE<sub>b</sub> oxirida", u(fmt(sOut, 2), "MeV"), "mahsulotlar (neytron uchun 0)");
    setRO("r4", "Ajralgan energiya <i>Q</i>", u(fmt(Q, 2), "MeV"), `= ${sci(Q * 1.602e-13, 3)} J bitta reaksiyada`, "orange");
    setRO("r5", "Massa kamayishi", u(fmt(Q / P.U_MEV, 5), "u"), "Δm = Q/c² — massa energiyaga aylandi");
    setRO("r6", "1 kg yoqilg‘idan", u(sci(Ekg, 3), "J"), `ko‘mirdan ≈ ${sci(Ekg / COAL, 2)} marta ko‘p`);
    return;
  }
  const co = chain.core, fuel0 = co.nuclei.filter((q) => q.kind === 235).length, L = co.stats.lost, lost = L.leak + L.rod + L.cap, k = chain.k;
  const pow = chain.recent.reduce((s, r) => s + r.f, 0) * P.E_FISSION;
  setRO("r1", "Neytronlar <i>n</i>", u(co.neutrons.length, "ta"), `jami tug‘ilgan: ${co.stats.born}`);
  setRO("r2", "Bo‘linishlar", u(co.stats.fissions, "ta"), `E = ${sci(co.stats.fissions * P.E_FISSION, 3)} MeV = ${sci(co.stats.fissions * P.E_FISSION * 1.602e-13, 3)} J`);
  setRO("r3", "Ko‘payish koeffitsiyenti <i>k</i>", k === null ? "—" : fmt(k, 2), k === null ? "" : k > 1.05 ? "o‘ta kritik — reaksiya kuchayadi" : k < 0.95 ? "kritikdan past — reaksiya so‘nadi" : "kritik holat — barqaror", k !== null && k > 1.05 ? "orange" : "");
  setRO("r4", "Qolgan ²³⁵U", u(fuel0 ? fmt((co.fuel / fuel0) * 100, 0) : "0", "%"), `${co.fuel} / ${fuel0} yadro`);
  setRO("r5", "Neytronlar qayerga ketdi", lost ? `${fmt((L.leak / lost) * 100, 0)} / ${fmt((L.rod / lost) * 100, 0)} / ${fmt((L.cap / lost) * 100, 0)}<small>%</small>` : "—", "chiqib ketdi / sterjen / ²³⁸U yutdi");
  setRO("r6", "Quvvat", u(sci(pow, 3), "MeV/s"), "oxirgi 1 s dagi bo‘linishlar × 200 MeV");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "decay") { t = decDone() ? "Tajriba tugadi" : running ? `${iso().type}-yemirilish davom etmoqda` : dec.t > 0 ? "Pauza" : "Boshlash tugmasini bosing"; tone = decDone() ? "green" : running ? "purple" : "blue"; }
  else if (ui.mode === "bind") { if (bind.view === "build") { const st = P.stability(bind.Z, bind.Z + bind.N); t = st.stable ? "Barqaror yadro" : `Radioaktiv: ${st.decay}`; tone = st.stable ? "green" : "orange"; } else { t = "Energiya ajraladi"; tone = "green"; } }
  else { const co = chain.core; t = !co.fuel ? "²³⁵U tugadi" : co.neutrons.length ? (chain.k > 1.05 ? "Zanjir reaksiya kuchaymoqda" : chain.k < 0.95 ? "Reaksiya so‘nmoqda" : "Kritik holat") : co.stats.fissions ? "Reaksiya so‘ndi" : "Neytron yuboring"; tone = co.neutrons.length ? (chain.k > 1.05 ? "red" : "purple") : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "decay") {
    const I = iso();
    p.push(`<p><b>Radioaktiv yemirilish</b> — tasodifiy jarayon: qaysi yadro qachon yemirilishini aytib bo‘lmaydi, lekin har biri vaqt birligida bir xil ehtimol (λ) bilan yemiriladi. Shuning uchun ko‘p yadrolar uchun qonun aniq: har <b>T½ = ${sci(I.half, 4)} ${I.unit}</b> da qolgan yadrolar soni ikki marta kamayadi.</p>`);
    p.push(I.type === "α" ? "<p>α-yemirilishda yadrodan geliy yadrosi (2 proton + 2 neytron) uchib chiqadi: Z ikkiga, A to‘rtga kamayadi.</p>" : I.type === "β⁻" ? "<p>β⁻-yemirilishda yadrodagi neytron protonga aylanadi va elektron (hamda antineytrino) chiqadi: Z birga ortadi, A o‘zgarmaydi.</p>" : "<p>γ-nurlanishda uyg‘ongan yadro ortiqcha energiyani foton sifatida chiqaradi: Z va A o‘zgarmaydi. ⁹⁹ᵐTc tibbiy diagnostikada ishlatiladi.</p>");
    if (dec.iso === "c14") p.push("<p><b>Radiouglerod usuli</b>: tirik organizmda ¹⁴C ulushi o‘zgarmas; o‘lgandan keyin u yemiriladi. Qolgan ulushni o‘lchab, yoshni topish mumkin: t = T½·log₂(N₀/N).</p>");
    if (dec.N0 === 100) p.push("<p>Yadrolar kam — egri chiziq zinapoyasimon va nazariyadan sezilarli chetlanadi (statistik xato ≈ √N). 1600 ta yadroda bilan solishtiring.</p>");
  } else if (ui.mode === "bind") {
    if (bind.view === "build") {
      p.push("<p>Yadrodagi nuklonlarni <b>yadro kuchlari</b> tutib turadi. Yadro massasi uni tashkil etgan proton va neytronlar massalari yig‘indisidan kichik — bu farq <b>massa defekti</b> Δm. Yadroni nuklonlarga ajratish uchun E_b = Δm·c² energiya kerak.</p>");
      const st = P.stability(bind.Z, bind.Z + bind.N);
      p.push(st.stable ? "<p>Bu yadro barqaror: proton va neytronlar nisbati muvozanatda. Neytron qo‘shib yoki olib ko‘ring — yadro radioaktiv bo‘lib qoladi.</p>" : `<p>Bu yadro barqaror emas (${st.decay}). Yengil yadrolarda barqarorlik uchun N ≈ Z, og‘irlarida neytronlar ko‘proq bo‘lishi kerak — protonlar orasidagi elektr itarishni kompensatsiya qilish uchun.</p>`);
    } else {
      const R = P.REACTIONS[bind.rx];
      p.push(bind.rx === "u235" ? "<p><b>Bo‘linish</b>: og‘ir ²³⁵U yadrosi neytron yutib, ikki o‘rta yadroga bo‘linadi. O‘rta yadrolarda E_b/A kattaroq (≈ 8,4 MeV, uranda 7,6 MeV), shuning uchun bog‘lanish energiyalari farqi ajraladi. Yana 2–3 neytron chiqadi — zanjir reaksiya imkoniyati.</p>" : `<p><b>Termoyadro sintezi</b> (${R.eq}): yengil yadrolar qo‘shilib, mustahkamroq yadro hosil qiladi. Quyosh va yulduzlar energiyasi shu jarayondan. Sintez uchun millionlab gradus harorat kerak — yadrolar Kulon itarishini yengishi lozim.</p>`);
      p.push("<p>Grafikda strelka E_b/A ning ortishini ko‘rsatadi: mahsulotlar kuchliroq bog‘langan, ortiqcha energiya ajraladi (Q &gt; 0).</p>");
    }
  } else {
    const co = chain.core;
    p.push("<p>²³⁵U yadrosi neytron yutib bo‘linadi va o‘rtacha 2,43 ta yangi neytron chiqaradi. Har bir neytron yana bo‘linish keltirib chiqarishi mumkin — <b>zanjir reaksiya</b>. Neytronlarning bir qismi zonadan chiqib ketadi, ²³⁸U yoki boshqaruv sterjenlari tomonidan yutiladi.</p>");
    p.push(`<p>Ko‘payish koeffitsiyenti <b>k ≈ ${chain.k === null ? "—" : fmt(chain.k, 2)}</b>. ${chain.k > 1.05 ? "k > 1: neytronlar soni avloddan avlodga ortadi — boshqarilmasa portlash (atom bombasi)." : chain.k < 0.95 ? "k < 1: reaksiya so‘nadi. Zonani kattalashtiring, boyitishni oshiring yoki sterjenlarni ko‘taring." : "k ≈ 1: kritik holat — atom elektr stansiyasidagi reaktor shunday ishlaydi, quvvat o‘zgarmaydi."}</p>`);
    if (co.w <= 10) p.push("<p>Zona kichik — neytronlar ko‘p qismi tashqariga chiqib ketadi. Shu sababli zanjir reaksiya uchun <b>kritik massa</b> kerak.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "decay" ? "<small>Yemirilish qonuni</small> N = N₀·2<sup>−t/T½</sup>" : ui.mode === "bind" ? (bind.view === "build" ? "<small>Bog‘lanish energiyasi</small> E<sub>b</sub> = Δm·c²" : "<small>Reaksiya energiyasi</small> Q = ΔE<sub>b</sub>") : "<small>Ko‘payish koeffitsiyenti</small> k = N<sub>i+1</sub>/N<sub>i</sub>";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "decay") { stepDecay(dt); if (decDone() && !dec.flashes.length) { loop.stop(); return; } }
  else if (ui.mode === "chain") stepChain(dt);
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  const started = ui.mode === "decay" ? dec.t > 0 && !decDone() : chain.core && chain.core.t > 0;
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : started ? "Davom ettirish" : "Boshlash";
  if (dec.sample || chain.core) refresh();
}
playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (ui.mode === "decay" && decDone()) resetDecay();
  if (ui.mode === "chain" && !chain.core.neutrons.length && chain.core.t === 0) fire();
  if (prefersReducedMotion() && ui.mode === "decay") { while (!decDone()) stepDecay(0.05); dec.flashes = []; refresh(); return; }
  loop.start();
});
$("[data-reset]").addEventListener("click", () => { loop.stop(); if (ui.mode === "decay") resetDecay(); else if (ui.mode === "chain") buildCore(); setPlayUI(false); });
$("[data-fire]").addEventListener("click", () => { fire(); if (!loop.running && !prefersReducedMotion()) loop.start(); refresh(); });
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));

/* ------------------------------------------------------------------ Boshqaruv */

const isoSel = $("#iso");
isoSel.innerHTML = Object.entries(P.ISOTOPES).map(([k, v]) => `<option value="${k}">${v.name} (${v.sym}), T½ = ${sci(v.half, 4)} ${v.unit}</option>`).join("");
isoSel.addEventListener("change", () => { dec.iso = isoSel.value; customized(); loop.stop(); resetDecay(); setPlayUI(false); });
document.querySelectorAll("[data-n0-value]").forEach((b) => b.addEventListener("click", () => { dec.N0 = +b.dataset.n0Value; syncN0(); customized(); loop.stop(); resetDecay(); setPlayUI(false); }));
const syncN0 = () => document.querySelectorAll("[data-n0-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.n0Value === dec.N0)));
const bZC = bindRange($("#bZ"), $("#bZOut"), (v) => `${fmt(v, 0)} (${P.SYM[v]})`, (v) => { bind.Z = v; customized(); refresh(); });
const bNC = bindRange($("#bN"), $("#bNOut"), (v) => fmt(v, 0), (v) => { bind.N = v; customized(); refresh(); });
const rxSel = $("#rx");
rxSel.innerHTML = Object.entries(P.REACTIONS).map(([k, v]) => `<option value="${k}">${v.eq}</option>`).join("");
rxSel.addEventListener("change", () => { bind.rx = rxSel.value; customized(); refresh(); });
document.querySelectorAll("[data-bview-value]").forEach((b) => b.addEventListener("click", () => { bind.view = b.dataset.bviewValue; syncBview(); customized(); refresh(); }));
function syncBview() {
  document.querySelectorAll("[data-bview-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.bviewValue === bind.view)));
  document.querySelectorAll("[data-bv]").forEach((el) => { el.hidden = el.dataset.bv !== bind.view; });
}
const cEC = bindRange($("#cE"), $("#cEOut"), (v) => `${fmt(v, 0)} %`, (v) => { chain.enrich = v / 100; customized(); loop.stop(); buildCore(); setPlayUI(false); });
const cSC = bindRange($("#cS"), $("#cSOut"), (v) => `${fmt(v, 0)} × ${Math.max(4, Math.round(v * 0.58))}`, (v) => { chain.size = v; customized(); loop.stop(); buildCore(); setPlayUI(false); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v, 0)} % tushirilgan`, (v) => { setRods(v / 100); customized(); });
function setRods(d) { chain.depth = d; chain.core.rods.forEach((r) => { r.depth = d; }); measureK(); refresh(); }

/* Sahnada: yadroni bosish, nuklonlarni sudrash, sterjenlar, neytron */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e);
  if (ui.mode === "decay") {
    const g = geo.grid; if (!g) return;
    const i = Math.floor((p.x - g.x0) / g.cell), j = Math.floor((p.y - g.y0) / g.cell);
    dec.sel = i >= 0 && j >= 0 && i < g.n && j < g.n ? j * g.n + i : null; stage.render(); return;
  }
  if (ui.mode === "bind" && bind.view === "build") {
    const L = geo.bind; if (!L) return;
    for (const [k, q] of Object.entries(L.pile)) if (Math.hypot(p.x - q.x, p.y - q.y) <= 30) { drag = { kind: "pile", type: k, x0: p.x, y0: p.y, moved: false }; bind.ghost = { type: k, x: p.x, y: p.y }; break; }
    if (!drag && Math.hypot(p.x - L.cx, p.y - L.cy) <= geo.nucR + 4 && geo.nucleons.length) {
      let best = 0, bd = Infinity; geo.nucleons.forEach((q, i) => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; best = i; } });
      const type = geo.nucleons[best].p ? "p" : "n";
      if (type === "p" && bind.Z <= 1) return;
      if (type === "p") bind.Z--; else bind.N--;
      drag = { kind: "nuc", type }; bind.ghost = { type, x: p.x, y: p.y };
    }
    if (drag) { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } customized(); syncBind(); refresh(); }
    return;
  }
  if (ui.mode === "chain") {
    const h = geo.rodHandle, g = geo.core, co = chain.core;
    if (h && Math.hypot(p.x - h.x, p.y - h.y) <= h.r) { drag = { kind: "rod" }; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } return; }
    if (Math.hypot(p.x - geo.gun.x, p.y - geo.gun.y) <= geo.gun.r) { $("[data-fire]").click(); return; }
    const x = (p.x - g.x0) / g.cell, y = (p.y - g.y0) / g.cell;
    if (x > 0 && y > 0 && x < co.w && y < co.h && !co.onRod(x, y)) { co.inject(x, y, Math.random() * TAU); if (!loop.running && !prefersReducedMotion()) loop.start(); refresh(); }
  }
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) {
    let cur = "";
    if (ui.mode === "decay") cur = "pointer";
    else if (ui.mode === "bind" && bind.view === "build" && geo.bind) cur = Object.values(geo.bind.pile).some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= 30) || Math.hypot(p.x - geo.bind.cx, p.y - geo.bind.cy) <= geo.nucR + 4 ? "grab" : "";
    else if (ui.mode === "chain") cur = geo.rodHandle && Math.hypot(p.x - geo.rodHandle.x, p.y - geo.rodHandle.y) <= 16 ? "ns-resize" : "crosshair";
    canvas.style.cursor = cur; return;
  }
  if (drag.kind === "rod") { const g = geo.core, d = clamp(Math.round(((p.y - g.y0) / (chain.core.h * g.cell)) * 20) / 20, 0, 1); cRC.set(d * 100); setRods(d); customized(); return; }
  if (bind.ghost) { bind.ghost.x = p.x; bind.ghost.y = p.y; if (drag.kind === "pile" && Math.hypot(p.x - drag.x0, p.y - drag.y0) > 4) drag.moved = true; stage.render(); }
});
function endDrag(e) {
  if (!drag) return;
  if (drag.kind === "pile" || drag.kind === "nuc") {
    const L = geo.bind, g = bind.ghost, inside = g && Math.hypot(g.x - L.cx, g.y - L.cy) <= geo.nucR + 30;
    const add = drag.kind === "pile" ? (inside || !drag.moved) : inside;
    if (add) { if (drag.type === "p") bind.Z = Math.min(30, bind.Z + 1); else bind.N = Math.min(40, bind.N + 1); }
    bind.ghost = null; syncBind(); refresh();
  }
  drag = null;
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
function syncBind() { bZC.set(bind.Z); bNC.set(bind.N); }

/* Grafikda kursor */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) return;
  const p = ptr(gcv, e), r = f.rect;
  ui.hover = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h ? ((p.x - r.x) / r.w) * f.xMax : null;
  gcv.style.cursor = ui.hover !== null ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  c14: { mode: "decay", title: "Radiouglerod ¹⁴C", lesson: "¹⁴C ning yarim yemirilish davri 5730 yil. Boshlang: har 5730 yilda qolgan yadrolar soni ikki marta kamayadi. Natijalarda qolgan ulush bo‘yicha namunaning yoshi ko‘rsatiladi.", set: () => Object.assign(dec, { iso: "c14", N0: 400 }) },
  rn222: { mode: "decay", title: "Radon-222: α-yemirilish", lesson: "Radon — uylarning yerto‘lalarida to‘planadigan radioaktiv gaz, T½ = 3,82 kun. α-zarralar (qizil) uchib chiqishini kuzating.", set: () => Object.assign(dec, { iso: "rn222", N0: 400 }) },
  i131: { mode: "decay", title: "Yod-131: tibbiyotda", lesson: "¹³¹I qalqonsimon bez kasalliklarini davolashda ishlatiladi; T½ = 8 kun bo‘lgani uchun organizmdan tez yo‘qoladi. β⁻-zarralar (ko‘k) chiqadi.", set: () => Object.assign(dec, { iso: "i131", N0: 400 }) },
  few: { mode: "decay", title: "Tasodifiylik: 100 ta yadro", lesson: "Faqat 100 ta yadro: N(t) zinapoyasimon va nazariy egri chiziqdan sezilarli chetlanadi. «Qayta» bosib bir necha marta takrorlang — har safar natija boshqacha.", set: () => Object.assign(dec, { iso: "co60", N0: 100 }) },
  many: { mode: "decay", title: "1600 ta yadro: silliq egri", lesson: "Yadrolar ko‘p bo‘lsa, tasodifiy chetlanishlar nisbatan kichik (≈ √N) va o‘lchangan egri chiziq qonunga juda yaqin. O‘lchovdan topilgan T½ ni jadvaldagi bilan solishtiring.", set: () => Object.assign(dec, { iso: "ra226", N0: 1600 }) },
  tc99m: { mode: "decay", title: "Texnetsiy-99m: γ-nurlanish", lesson: "⁹⁹ᵐTc — eng ko‘p ishlatiladigan tibbiy izotop (T½ = 6 soat). U γ-kvant chiqaradi, Z va A o‘zgarmaydi.", set: () => Object.assign(dec, { iso: "tc99m", N0: 400 }) },
  he4: { mode: "bind", title: "⁴He: geliy yadrosi", lesson: "Geliy yadrosi (α-zarra) — 2 proton va 2 neytron. Uning bog‘lanish energiyasi 28,3 MeV: juda mustahkam yadro. Bitta neytron qo‘shib ko‘ring.", set: () => Object.assign(bind, { view: "build", Z: 2, N: 2 }) },
  fe56: { mode: "bind", title: "⁵⁶Fe: eng mustahkam yadro", lesson: "Temir-56 da bitta nuklonga eng katta bog‘lanish energiyasi to‘g‘ri keladi (8,79 MeV). Grafikdagi qizil halqa — egri chiziqning cho‘qqisi.", set: () => Object.assign(bind, { view: "build", Z: 26, N: 30 }) },
  c14b: { mode: "bind", title: "¹⁴C: neytron ortiqcha", lesson: "Uglerod-14 da 6 proton va 8 neytron — neytronlar ortiqcha, shuning uchun u β⁻-yemiriladi va azot-14 ga aylanadi. Neytronni olib tashlab, barqaror ¹³C va ¹²C ni hosil qiling.", set: () => Object.assign(bind, { view: "build", Z: 6, N: 8 }) },
  fusion: { mode: "bind", title: "Sintez: D + T", lesson: "Deyteriy va tritiy qo‘shilib geliy va neytron hosil qiladi: Q = 17,6 MeV. Bir kg yoqilg‘idan ko‘mirdan millionlab marta ko‘p energiya.", set: () => Object.assign(bind, { view: "react", rx: "dt" }) },
  fission: { mode: "bind", title: "Bo‘linish: ²³⁵U", lesson: "²³⁵U neytron yutib bariy va kriptonga bo‘linadi: ≈ 173 MeV bog‘lanish energiyasi farqi ajraladi (neytrinolar va keyingi yemirilishlar bilan jami ≈ 200 MeV).", set: () => Object.assign(bind, { view: "react", rx: "u235" }) },
  bomb: { mode: "chain", title: "O‘ta kritik zona", lesson: "Boyitish yuqori, zona katta, sterjenlar yo‘q: k > 1. Neytron yuboring — neytronlar soni eksponensial ortadi va yoqilg‘i bir necha soniyada yonib bitadi (n(t) grafigi — log shkala).", set: () => Object.assign(chain, { enrich: 0.9, size: 24, depth: 0 }) },
  small: { mode: "chain", title: "Kritik massa: kichik zona", lesson: "Xuddi shu yoqilg‘i, lekin zona kichik: neytronlarning ko‘p qismi tashqariga chiqib ketadi va k < 1. O‘lchamni asta oshirib, reaksiya qachon o‘zini tutib tura boshlashini toping.", set: () => Object.assign(chain, { enrich: 0.9, size: 6, depth: 0 }) },
  reactor: { mode: "chain", title: "Reaktor: boshqaruv sterjenlari", lesson: "Sterjenlar (kadmiy, bor) neytronlarni yutadi. Neytron yuboring va sterjenlarni surib k ≈ 1 holatini toping — reaktor shu holatda barqaror quvvat beradi.", set: () => Object.assign(chain, { enrich: 0.8, size: 24, depth: 0.5 }) },
  natural: { mode: "chain", title: "Kam boyitilgan uran", lesson: "²³⁵U ulushi kichik: neytronlarni asosan ²³⁸U yutadi (binafsha halqalar) — zanjir reaksiya bormaydi. Shuning uchun uran boyitiladi (bu modelda ≈ 40 % dan k > 1).", set: () => Object.assign(chain, { enrich: 0.2, size: 24, depth: 0 }) },
};
const GROUPS = [["Radioaktiv yemirilish", ["c14", "rn222", "i131", "few", "many", "tc99m"]], ["Bog‘lanish energiyasi", ["he4", "fe56", "c14b", "fusion", "fission"]], ["Zanjir reaksiya", ["bomb", "small", "reactor", "natural"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { decay: "Yadroni bosing — holati ko‘rinadi", bind: "Proton va neytronlarni yadroga suring", chain: "Sterjenlarni suring, zonani bosib neytron chiqaring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  playBtn.hidden = ui.mode === "bind"; $("[data-reset]").hidden = ui.mode === "bind";
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
}
function syncAll() {
  isoSel.value = dec.iso; syncN0(); syncBind(); rxSel.value = bind.rx; syncBview();
  cEC.set(chain.enrich * 100); cSC.set(chain.size); cRC.set(chain.depth * 100);
}
const MODE_DEFAULT = { decay: "c14", bind: "he4", chain: "bomb" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  loop.stop(); drag = null; bind.ghost = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  if (p.mode === "decay") resetDecay();
  if (p.mode === "chain") buildCore();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(Object.keys(TABS[ui.mode])[0]);
  setPlayUI(false);
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

resetDecay(); buildCore();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "c14");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
