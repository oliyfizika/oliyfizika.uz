// ==========================================================================
// Magnit maydonda zaryadli zarra — virtual laboratoriya (simulations/lorentz.html)
// 1) Lorens kuchi: v ⊥ B — manba, v vektori uchi, maydon chegarasi sudraladi, B yo'nalishi bosib almashtiriladi;
//    aylana, davr tezlikka bog'liq emas; vint chiziq — v B ga α burchak ostida (qiya proyeksiya).
// 2) Mass-spektrometr: ion manbai, tezlatuvchi kuchlanish (dastak), tezlik selektori (E ⊥ B₁), yarim aylana,
//    fotoplastinkadagi dog'lar, o'lchagich bilan massani aniqlash.
// 3) Siklotron: duantlar, generator (chastota dastagi, rezonans), spiral, energiya W(N) grafigi.
// Sahna — 360° 3D laboratoriya (lorentz-lab-3d.js): bo'sh joydan sudrash kamerani aylantiradi.
// Fizika: lorentz-physics.js (Node'da tekshirilgan). Harakat sekinlashtirib ko'rsatiladi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion, sci } from "./sim-kit.js";
import * as P from "./lorentz-physics.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-n3";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261124-n3";
import { createLorentzLab, LOR_W } from "./lorentz-lab-3d.js?v=20261125-n4";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const MEV = 1e6 * P.E;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "lor", show: { vec: true } };
// Zarralar uchun tayanch qiymatlar: r ≈ 6…10 cm, ko'rinadigan davr 3 s
const REF = { e: { v: 1e7, B: 1e-3 }, p: { v: 1e6, B: 0.1 }, a: { v: 5e5, B: 0.1 } };
const lor = { part: "p", view: "plane", kv: 1, kb: 1, Bs: 1, alpha: 60 * DEG, ys: 0, th: 0, xB: 18, p: null, v: null, t: 0, trail: [], wait: 0, inField: false, turns: 0 };
const MS = {
  H: { label: "H, D, T", iso: [["¹H", 1.00783], ["²H (D)", 2.0141], ["³H (T)", 3.01605]] },
  C: { label: "¹²C, ¹³C", iso: [["¹²C", 12], ["¹³C", 13.00335]] },
  Ne: { label: "²⁰Ne, ²²Ne", iso: [["²⁰Ne", 19.99244], ["²²Ne", 21.99139]] },
  Cl: { label: "³⁵Cl, ³⁷Cl", iso: [["³⁵Cl", 34.96885], ["³⁷Cl", 36.9659]] },
};
const ISO_COL = ["#2563eb", "#dc2626", "#16a34a"];
const B1 = 0.1, SEL_L = 0.08, SEL_HALF = 0.0005;
const ms = { set: "Ne", U: 1000, B: 0.2, sel: false, Ef: 9800, ions: [], hits: [], emit: 0, ruler: 20, seq: 0 };
const CYC_R = 0.25;
const cyc = { part: "p", B: 1, U0: 100e3, fgen: 0, p: [0, 0], v: [0, 0], W: 0, t: 0, k: 0, out: false, trail: [], hist: [], wait: 0, done: false };
let presetId = null;

const part = (k) => P.PARTICLES[k];
const lorV = () => REF[lor.part].v * lor.kv, lorB = () => REF[lor.part].B * lor.kb;
const lorK = () => P.period(part(lor.part).m, part(lor.part).q, REF[lor.part].B) / 3; // real s / ko'rinadigan s
const cycFc = () => P.cycFreq(part(cyc.part).m, part(cyc.part).q, cyc.B);
const cycK = () => P.period(part(cyc.part).m, part(cyc.part).q, 1) / 0.8;
const fmtB = (B) => (B < 0.01 ? `${fmt(B * 1000, 2)} mT` : `${fmt(B, 3)} T`);
const fmtV = (v) => `${sci(v, 3)} m/s`;

/* ================================================================== 1) Lorens kuchi (v ⊥ B) */

const LOR_H = 13; // dunyo: y ∈ [−13, 13] cm
function launchLor() {
  const v = lorV() * 100; // cm/s (real)
  const len = 2.4; // manba stvoli uzunligi, cm
  lor.p = [2 + Math.cos(lor.th) * len, lor.ys + Math.sin(lor.th) * len];
  lor.v = [Math.cos(lor.th) * v, Math.sin(lor.th) * v];
  lor.t = 0; lor.trail = [lor.p.slice()]; lor.wait = 0; lor.turns = 0; lor.ang = 0;
  if (lor.view === "helix") { lor.hx = { t: 0 }; lor.trail = []; }
}
function stepLorPlane(dt) {
  if (!lor.p) launchLor();
  const pr = part(lor.part), W = LOR_W;
  if (lor.wait > 0) { lor.wait -= dt; if (lor.wait <= 0) launchLor(); return; }
  const h = dt * lorK(), n = 24, hh = h / n, Bz = lor.Bs * lorB(), xB = lor.xB;
  for (let i = 0; i < n; i++) {
    const inF = lor.p[0] >= xB;
    if (inF) { const r = P.stepPlane([lor.p[0] / 100, lor.p[1] / 100], [lor.v[0] / 100, lor.v[1] / 100], hh, pr.q, pr.m, Bz); lor.p = [r.p[0] * 100, r.p[1] * 100]; lor.v = [r.v[0] * 100, r.v[1] * 100]; lor.ang += (Math.abs(pr.q * Bz) / pr.m) * hh; }
    else { lor.p = [lor.p[0] + lor.v[0] * hh, lor.p[1] + lor.v[1] * hh]; }
    lor.inField = lor.p[0] >= xB;
  }
  lor.t += h; lor.turns = lor.ang / TAU;
  const last = lor.trail[lor.trail.length - 1];
  if (Math.hypot(lor.p[0] - last[0], lor.p[1] - last[1]) > 0.15) { lor.trail.push(lor.p.slice()); if (lor.trail.length > 1500) lor.trail.shift(); }
  if (lor.p[0] < -1 || lor.p[0] > W + 1 || Math.abs(lor.p[1]) > LOR_H + 1) lor.wait = 0.6;
}

/* ------------------------------------------------------------------ Vint chiziq */

function stepLorHelix(dt) {
  if (!lor.hx) lor.hx = { t: 0 };
  const pr = part(lor.part), hl = P.helix(pr.m, lorV(), pr.q, lorB(), lor.alpha), W = LOR_W;
  lor.hx.t += dt * lorK();
  if (4 + hl.vl * 100 * lor.hx.t > W - 2 || lor.hx.t > 8 * hl.T) lor.hx.t = 0;
}

/* ================================================================== 2) Mass-spektrometr */

function msIons() { return MS[ms.set].iso.map(([n, A], i) => { const m = A * P.AMU, v = P.speedFromU(m, P.E, ms.U), r = P.msRadius(m, P.E, ms.U, ms.B); let pass = true, xHit = null, sh = 0; if (ms.sel) { sh = P.selectorShift(m, P.E, v, ms.Ef, B1, SEL_L); if (Math.abs(sh) > SEL_HALF) { pass = false; xHit = Math.sqrt(SEL_HALF / Math.abs(sh)); } } return { n, A, m, v, r, pass, xHit, sh, col: ISO_COL[i] }; }); }
const MSW = { x0: -27, x1: 14, y0: -24, y1: 3 }; // cm; tirqish (0, 0), maydon x ≥ 0, plastinka x = 0, y < 0
function msPath(ion, io, tvis) {
  // tvis — ko'rinadigan vaqt; ionning traektoriyasi (cm)
  const vv = ion.vs; // cm/s ko'rinadigan
  const xA = -21, xs0 = -SEL_L * 100 - 4;
  const sAcc = 3, tAcc = (2 * sAcc) / vv; // tezlatish: v 0 → vv
  let t = tvis;
  if (t < 0.3) return { pos: [-26 + t * 3, 0] };
  t -= 0.3;
  if (t < tAcc) return { pos: [-22.5 + 0.5 * (vv / tAcc) * t * t, 0] };
  t -= tAcc; let x = -19.5 + vv * t;
  if (x < 0) {
    if (ms.sel && x > xs0) { const u = (x - xs0) / (SEL_L * 100); if (!io.pass && u >= io.xHit) return { done: "plate", pos: [xs0 + io.xHit * SEL_L * 100, Math.sign(io.sh) * 0.75] }; const dy = io.pass ? 0 : Math.sign(io.sh) * 0.75 * (u / io.xHit) ** 2; return { pos: [x, dy] }; }
    if (ms.sel && !io.pass && x >= -4) return { done: "plate", pos: [-4, 0] };
    return { pos: [x, 0] };
  }
  const r = io.r * 100, ang = (x / r); // yoy uzunligi / r
  if (ang >= Math.PI) return { done: "hit", pos: [0, -2 * r] };
  return { pos: [r * Math.sin(ang), -r + r * Math.cos(ang)] };
}
function stepMS(dt) {
  const ions = msIons(), vmean = ions.reduce((a, b) => a + b.v, 0) / ions.length, kv = 14 / vmean;
  ms.emit -= dt;
  if (ms.emit <= 0 && ms.ions.length < 60) { ms.emit = 0.12; const i = ms.seq++ % ions.length; ms.ions.push({ i, t: 0, vs: ions[i].v * kv, col: ions[i].col, pos: [-26, 0] }); }
  ms.ions = ms.ions.filter((ion) => {
    ion.t += dt; const io = ions[ion.i]; if (!io) return false;
    const r = msPath(ion, io, ion.t); ion.pos = r.pos;
    if (r.done === "hit") { const d = 2 * io.r * 100 + (Math.random() - 0.5) * 0.15; if (d < -MSW.y0) ms.hits.push({ d, col: io.col }); if (ms.hits.length > 600) ms.hits.shift(); return false; }
    if (r.done === "plate") return false;
    if (ion.pos[0] > MSW.x1 + 1 || ion.pos[1] < MSW.y0 - 1) return false;
    return true;
  });
}

/* ================================================================== 3) Siklotron */

function resetCyc() {
  const pr = part(cyc.part);
  Object.assign(cyc, { p: [0, 0], W: 0, t: 0, k: 0, out: false, trail: [[0, 0]], hist: [], wait: 0, done: false });
  // birinchi o'tish t = 0 da: W = qU₀
  cyc.W = Math.max(P.gapGain(pr.q, cyc.U0, cyc.fgen, 0, 0), 0.05 * Math.abs(pr.q) * cyc.U0);
  const v = Math.sqrt((2 * cyc.W) / pr.m); cyc.v = [v, 0]; cyc.k = 1;
  cyc.hist.push({ n: 0, W: cyc.W / MEV });
}
function stepCyc(dt) {
  if (cyc.done) { cyc.wait += dt; if (cyc.wait > 2.5) resetCyc(); return; }
  const pr = part(cyc.part), h = dt * cycK(), n = 60, hh = h / n;
  cyc.cross = cyc.cross || [];
  for (let i = 0; i < n; i++) {
    const x0 = cyc.p[0];
    if (cyc.out) { cyc.p = [cyc.p[0] + cyc.v[0] * hh, cyc.p[1] + cyc.v[1] * hh]; }
    else { const r = P.stepPlane(cyc.p, cyc.v, hh, pr.q, pr.m, cyc.B); cyc.p = r.p; cyc.v = r.v; }
    cyc.t += hh;
    if (!cyc.out && Math.sign(x0) !== Math.sign(cyc.p[0]) && x0 !== 0) {
      // V = φ_chap − φ_o'ng = U₀cos(2πft): o'ngga (+x) o'tishda qV, chapga o'tishda −qV
      const dir = cyc.v[0] > 0 ? 1 : -1, gain = Math.abs(pr.q) * cyc.U0 * Math.cos(TAU * cyc.fgen * cyc.t) * dir;
      let W = cyc.W + gain, sp = Math.hypot(cyc.v[0], cyc.v[1]);
      if (W <= 0.02 * Math.abs(pr.q) * cyc.U0) { W = Math.max(Math.abs(W), 0.02 * Math.abs(pr.q) * cyc.U0); cyc.v = [-cyc.v[0], cyc.v[1]]; sp = Math.hypot(cyc.v[0], cyc.v[1]); }
      const ns = Math.sqrt((2 * W) / pr.m); cyc.v = [(cyc.v[0] / sp) * ns, (cyc.v[1] / sp) * ns]; cyc.W = W; cyc.k++;
      cyc.cross.push(cyc.t); if (cyc.cross.length > 30) cyc.cross.shift();
      cyc.hist.push({ n: cyc.t * cycFc(), W: W / MEV }); if (cyc.hist.length > 4000) cyc.hist.shift();
    }
    if (!cyc.out && Math.hypot(cyc.p[0], cyc.p[1]) > CYC_R * 0.97) cyc.out = true;
  }
  const last = cyc.trail[cyc.trail.length - 1];
  if (Math.hypot(cyc.p[0] - last[0], cyc.p[1] - last[1]) > 0.002) { cyc.trail.push(cyc.p.slice()); if (cyc.trail.length > 5000) cyc.trail.shift(); }
  if (cyc.out && Math.hypot(cyc.p[0], cyc.p[1]) > CYC_R * 1.6) cyc.done = true;
  if (cyc.t * cycFc() > 120) cyc.done = true;
}
function drawCycGraph(ctx, gst) {
  const c = gst.colors, pr = part(cyc.part), Wm = P.cycEnergy(pr.m, pr.q, cyc.B, CYC_R) / MEV, h = cyc.hist;
  const nMax = Math.max(4, ...h.map((p) => p.n)) * 1.05, yTop = Math.max(Wm * 1.15, ...h.map((p) => p.W));
  const yt = ticks(0, yTop, 4), xt = ticks(0, nMax, 6);
  const f = frame(ctx, gst, { xMin: 0, xMax: nMax, yMin: 0, yMax: yTop, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step >= 1 ? 0 : 1), xUnit: "ayl.", yLabel: "W, MeV" });
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  ctx.strokeStyle = c.danger; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Wm)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Wm)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); h.forEach((p, i) => { if (!i) ctx.moveTo(f.X(p.n), f.Y(p.W)); else { ctx.lineTo(f.X(p.n), f.Y(h[i - 1].W)); ctx.lineTo(f.X(p.n), f.Y(p.W)); } }); ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "zarra energiyasi W" }, { color: c.danger, label: `W_max = (qBR)²/2m = ${fmt(Wm, 2)} MeV`, dash: [5, 4] }], f.padL + 60, 9, c);
}

/* ------------------------------------------------------------------ Sahna (360° 3D laboratoriya: lorentz-lab-3d.js) */

const scene = createLorentzLab();
const sceneMode = () => (ui.mode === "lor" ? lor.view : ui.mode);
/** Sahna uchun joriy qiymatlar (faqat o'qiladi). */
function frameCfg() {
  const mode = sceneMode();
  if (mode === "plane") {
    const pr = part(lor.part);
    return { mode, L: { name: pr.name, q: pr.q, m: pr.m, e: P.E, B: lorB(), Bs: lor.Bs, kv: lor.kv, kb: lor.kb, th: lor.th, ys: lor.ys, xB: lor.xB, p: lor.p, v: lor.v, trail: lor.trail, inField: lor.inField, vec: ui.show.vec, slow: 1 / lorK() } };
  }
  if (mode === "helix") {
    const pr = part(lor.part), B = lorB(), hl = P.helix(pr.m, lorV(), pr.q, B, lor.alpha);
    return { mode, H: { name: pr.name, q: pr.q, B, alpha: lor.alpha, kv: lor.kv, r: hl.r * 100, T: hl.T, Om: (pr.q * B) / pr.m, vl: hl.vl * 100, vp: hl.vp * 100, tt: lor.hx ? lor.hx.t : 0, x0: 4, vec: ui.show.vec } };
  }
  if (mode === "ms") {
    const mMeas = P.massFromR(ms.ruler / 200, P.E, ms.U, ms.B) / P.AMU;
    return { mode, M: { ions: msIons(), live: ms.ions, hits: ms.hits, ruler: ms.ruler, mMeas, U: ms.U, B: ms.B, Ef: ms.Ef, sel: ms.sel, B1, L: SEL_L } };
  }
  const pr = part(cyc.part);
  return { mode, Y: { q: pr.q, B: cyc.B, R: CYC_R, p: cyc.p, v: cyc.v, trail: cyc.trail, out: cyc.out, Vnow: Math.cos(TAU * cyc.fgen * cyc.t), fgen: cyc.fgen, fc: cycFc(), t: cyc.t, cross: cyc.cross || [], W: cyc.W / MEV, vec: ui.show.vec } };
}
const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { graph: Math.round(clamp(vh * 0.24, 160, 220)) };
};
const stage = createStage($("#stage"), (ctx, st) => scene.draw(ctx, st, frameCfg()), { height: detailedStageHeight });
function drawGraphCanvas(ctx, gst) { if (ui.mode === "cyc") return drawCycGraph(ctx, gst); ctx.fillStyle = gst.colors.bg; ctx.fillRect(0, 0, gst.w, gst.h); }
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const val = (x, unit) => { const s = sci(x, 3); return `${s}<small>${unit}</small>`; };
function updateReadouts() {
  if (ui.mode === "lor") {
    const pr = part(lor.part), v = lorV(), B = lorB(), T = P.period(pr.m, pr.q, B);
    if (lor.view === "helix") {
      const hl = P.helix(pr.m, v, pr.q, B, lor.alpha);
      setRO("r1", "Tezlik <i>v</i>", val(v, "m/s"), `v∥ = ${sci(hl.vl, 3)}, v⊥ = ${sci(hl.vp, 3)} m/s`);
      setRO("r2", "Lorens kuchi <i>F</i>", val(P.force(pr.q, v, B, Math.sin(lor.alpha)), "N"), "F = |q|vB·sin α");
      setRO("r3", "Vint radiusi <i>r</i>", `${fmt(hl.r * 100, 2)}<small>cm</small>`, "r = mv·sin α/(|q|B)");
      setRO("r4", "Vint qadami <i>h</i>", `${fmt(hl.pitch * 100, 2)}<small>cm</small>`, "h = v·cos α·T");
      setRO("r5", "Aylanish davri <i>T</i>", val(T, "s"), "α va v ga bog‘liq emas");
      setRO("r6", "Burchak α", `${fmt(lor.alpha / DEG, 0)}°`, lor.alpha > 89.5 * DEG ? "v ⊥ B — tekis aylana" : "v ∥ B bo‘lsa kuch nol");
    } else {
      setRO("r1", "Zarra", pr.name, `q = ${sci(pr.q, 3)} C, m = ${sci(pr.m, 3)} kg`);
      setRO("r2", "Tezlik <i>v</i> va maydon <i>B</i>", val(v, "m/s"), `B = ${fmtB(B)}`);
      setRO("r3", "Lorens kuchi <i>F</i>", val(P.force(pr.q, v, B), "N"), "F = |q|vB, tezlikka tik");
      setRO("r4", "Aylana radiusi <i>r</i>", `${fmt(P.radius(pr.m, v, pr.q, B) * 100, 2)}<small>cm</small>`, "r = mv/(|q|B)");
      setRO("r5", "Aylanish davri <i>T</i>", val(T, "s"), `ν = ${sci(1 / T, 3)} Hz — v ga bog‘liq emas`);
      setRO("r6", "Maydonda burilish", `${fmt(lor.turns * 360, 0)}°`, lor.inField ? "zarra maydon ichida" : "maydondan tashqarida", lor.inField ? "" : "muted");
    }
  } else if (ui.mode === "ms") {
    const ions = msIons(), a = ions[0], b = ions[1], mMeas = P.massFromR(ms.ruler / 200, P.E, ms.U, ms.B) / P.AMU;
    setRO("r1", `${a.n} tezligi`, val(a.v, "m/s"), "qU = mv²/2");
    setRO("r2", "Radiuslar", ions.map((io) => fmt(io.r * 100, 2)).join(" / ") + "<small>cm</small>", "r = √(2mU/q)/B");
    setRO("r3", "Dog‘lar orasidagi masofa", `${fmt(2 * (b.r - a.r) * 100, 2)}<small>cm</small>`, `${a.n} va ${b.n}`);
    setRO("r4", "O‘lchagich", `${fmt(ms.ruler, 1)}<small>cm</small>`, "tirqishdan masofa d = 2r");
    setRO("r5", "O‘lchangan massa", `${fmt(mMeas, 2)}<small>u</small>`, "m = qB²d²/(8U)");
    setRO("r6", "Tezlik selektori", ms.sel ? val(ms.Ef / B1, "m/s") : "o‘chiq", ms.sel ? `o‘tadi: v = E/B₁; ${ions.filter((i) => i.pass).map((i) => i.n).join(", ") || "hech biri"}` : "barcha izotoplar o‘tadi", ms.sel ? "" : "muted");
  } else {
    const pr = part(cyc.part), fc = cycFc(), Wm = P.cycEnergy(pr.m, pr.q, cyc.B, CYC_R), turns = cyc.t * fc;
    setRO("r1", "Siklotron chastotasi <i>f_c</i>", `${fmt(fc / 1e6, 2)}<small>MHz</small>`, "f = qB/(2πm) — energiyaga bog‘liq emas");
    setRO("r2", "Generator chastotasi", `${fmt(cyc.fgen / 1e6, 2)}<small>MHz</small>`, Math.abs(cyc.fgen / fc - 1) < 0.003 ? "rezonans" : `farq ${fmt((cyc.fgen / fc - 1) * 100, 1)}%`, Math.abs(cyc.fgen / fc - 1) < 0.003 ? "" : "orange");
    setRO("r3", "Energiya <i>W</i>", `${fmt(cyc.W / MEV, 3)}<small>MeV</small>`, `har o‘tishda ≤ qU₀ = ${fmt((Math.abs(pr.q) * cyc.U0) / MEV, 3)} MeV`);
    setRO("r4", "Eng katta energiya", `${fmt(Wm / MEV, 2)}<small>MeV</small>`, `W_max = (qBR)²/2m, R = ${fmt(CYC_R * 100, 0)} cm`);
    setRO("r5", "Aylanishlar", fmt(turns, 1), `o‘tishlar: ${cyc.k}`);
    setRO("r6", "Tezlik", val(Math.sqrt((2 * cyc.W) / pr.m), "m/s"), `${fmt(Math.sqrt((2 * cyc.W) / pr.m) / 2.998e6, 1)}% c`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "lor") { if (lor.view === "helix") { t = "Vint chiziq"; tone = "purple"; } else { t = lor.inField ? "Lorens kuchi ta’sir qilmoqda" : "To‘g‘ri chiziqli"; tone = lor.inField ? "orange" : "blue"; } }
  else if (ui.mode === "ms") { const n = msIons().filter((i) => i.pass).length; t = ms.sel ? `${n} ta izotop o‘tadi` : "Izotoplar ajraldi"; tone = n ? "green" : "red"; }
  else { const fr = cyc.fgen / cycFc(); t = cyc.out ? "Dastadan chiqdi" : Math.abs(fr - 1) < 0.003 ? "Rezonans: tezlanmoqda" : "Faza siljimoqda"; tone = cyc.out ? "green" : Math.abs(fr - 1) < 0.003 ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "lor") {
    p.push("<p>Magnit maydonda harakatlanayotgan zaryadli zarraga <b>Lorens kuchi</b> ta’sir qiladi: F = |q|vB·sin α. Kuch doim tezlikka tik — u tezlik modulini o‘zgartirmaydi (ish bajarmaydi), faqat yo‘nalishini burib, zarrani aylana bo‘ylab harakatlantiradi.</p>");
    p.push(lor.view === "helix" ? "<p>Tezlik B ga burchak ostida bo‘lsa, uni ikki tashkil etuvchiga ajratamiz: B ga parallel v·cos α o‘zgarmaydi (kuch yo‘q), tik v·sin α esa aylanma harakat beradi. Natijada zarra <b>vint chiziq</b> bo‘ylab harakatlanadi — qutb yog‘dusidagi zarralar ham Yer maydon chiziqlari bo‘ylab shunday o‘raladi.</p>" : "<p>Radius r = mv/(|q|B): tezlik ortsa katta, maydon kuchli bo‘lsa kichik. Davr T = 2πm/(|q|B) esa tezlikka bog‘liq emas — v vektorini uzaytirib ko‘ring: aylana kattalashadi, lekin aylanish vaqti o‘zgarmaydi. Kuch yo‘nalishi chap qo‘l qoidasi bilan topiladi; elektron (manfiy) teskari tomonga buriladi.</p>");
  } else if (ui.mode === "ms") {
    p.push("<p><b>Mass-spektrometr</b>da ionlar U kuchlanishda tezlatiladi (qU = mv²/2), so‘ng magnit maydonda yarim aylana chizib, fotoplastinkaga tushadi. Radius r = √(2mU/q)/B massaning kvadrat ildiziga proporsional, shuning uchun bir elementning <b>izotoplari</b> turli joyga tushadi.</p>");
    p.push(ms.sel ? "<p><b>Tezlik selektori</b>da elektr kuchi qE va Lorens kuchi qvB₁ qarama-qarshi: faqat v = E/B₁ tezlikdagi ionlar to‘g‘ri o‘tadi, qolganlari plastinkalarga uriladi. E dastagini burab, kerakli izotopni tanlang.</p>" : "<p>O‘lchagichni dog‘ ustiga qo‘ying: d = 2r bo‘lgani uchun m = qB²d²/(8U). Shu tarzda izotoplarning massalarini aniqlang.</p>");
  } else {
    p.push("<p><b>Siklotron</b>da zarra ikki duant ichida magnit maydon ta’sirida yarim aylanalar chizadi, duantlar orasidagi tirqishda esa o‘zgaruvchan kuchlanish uni har safar tezlatadi. Yarim aylanish vaqti tezlikka bog‘liq bo‘lmagani uchun generator chastotasi f = qB/(2πm) ga teng bo‘lsa (rezonans), zarra har o‘tishda energiya oladi va spiral bo‘ylab chetga chiqadi.</p>");
    p.push("<p>Chastota mos kelmasa, o‘tish lahzalari kuchlanish fazasidan siljiydi: zarra avval tezlanadi, keyin sekinlashadi. Eng katta energiya W = (qBR)²/2m faqat B va duant radiusiga bog‘liq, U₀ esa faqat aylanishlar sonini belgilaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "lor" ? (lor.view === "helix" ? "<small>Vint chiziq</small> h = v·cos α·T" : "<small>Lorens kuchi</small> F = |q|vB·sin α") : ui.mode === "ms" ? "<small>Mass-spektrometr</small> m = qB²r²/(2U)" : "<small>Siklotron</small> f = qB/(2πm)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  const t = ui.mode === "lor" ? "Qayta otish" : ui.mode === "ms" ? "Plastinkani tozalash" : "Rezonansga sozlash";
  if (actBtn.textContent !== t) actBtn.textContent = t;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "lor") (lor.view === "helix" ? stepLorHelix : stepLorPlane)(dt); else if (ui.mode === "ms") stepMS(dt); else stepCyc(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode === "cyc") graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
function resetMode() { if (ui.mode === "lor") launchLor(); else if (ui.mode === "ms") { ms.ions = []; ms.hits = []; } else resetCyc(); }
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); if (!loop.running) loop.start(); });
function tuneRes() { cyc.fgen = cycFc(); cFC.set(1); resetCyc(); }
actBtn.addEventListener("click", () => { if (ui.mode === "lor") launchLor(); else if (ui.mode === "ms") ms.hits = []; else tuneRes(); customized(); refresh(); if (!loop.running) loop.start(); });

/* ------------------------------------------------------------------ Boshqaruv */

const lVC = bindRange($("#lV"), $("#lVOut"), (k) => fmtV(REF[lor.part].v * k), (k) => { lor.kv = k; launchLor(); customized(); refresh(); });
const lBC = bindRange($("#lB"), $("#lBOut"), (k) => fmtB(REF[lor.part].B * k), (k) => { lor.kb = k; launchLor(); customized(); refresh(); });
const lAC = bindRange($("#lA"), $("#lAOut"), (v) => `${fmt(v, 0)}°`, (v) => { lor.alpha = v * DEG; launchLor(); customized(); refresh(); });
document.querySelectorAll("[data-part-value]").forEach((b) => b.addEventListener("click", () => { lor.part = b.dataset.partValue; launchLor(); syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-view-value]").forEach((b) => b.addEventListener("click", () => { lor.view = b.dataset.viewValue; launchLor(); syncAll(); setModeUI(); customized(); refresh(); }));
const mUC = bindRange($("#mU"), $("#mUOut"), (v) => `${fmt(v, 0)} V`, (v) => { ms.U = v; ms.hits = []; customized(); refresh(); });
const mBC = bindRange($("#mB"), $("#mBOut"), (v) => `${fmt(v, 2)} T`, (v) => { ms.B = v; ms.hits = []; customized(); refresh(); });
const mEC = bindRange($("#mE"), $("#mEOut"), (v) => `${fmt(v, 1)} kV/m`, (v) => { ms.Ef = v * 1000; customized(); refresh(); });
$("[data-sel]").addEventListener("change", (e) => { ms.sel = e.target.checked; ms.hits = []; ms.ions = []; syncAll(); customized(); refresh(); });
document.querySelectorAll("[data-iso-value]").forEach((b) => b.addEventListener("click", () => { ms.set = b.dataset.isoValue; ms.hits = []; ms.ions = []; syncAll(); customized(); refresh(); }));
const cBC = bindRange($("#cB"), $("#cBOut"), (v) => `${fmt(v, 2)} T`, (v) => { cyc.B = v; const fr = clamp(cyc.fgen / cycFc(), 0.8, 1.2); cyc.fgen = fr * cycFc(); cFC.set(fr); resetCyc(); customized(); refresh(); });
const cUC = bindRange($("#cU"), $("#cUOut"), (v) => `${fmt(v, 0)} kV`, (v) => { cyc.U0 = v * 1000; resetCyc(); customized(); refresh(); });
const cFC = bindRange($("#cF"), $("#cFOut"), (v) => `${fmt((v * cycFc()) / 1e6, 2)} MHz`, (v) => { cyc.fgen = v * cycFc(); resetCyc(); customized(); refresh(); });
document.querySelectorAll("[data-cpart-value]").forEach((b) => b.addEventListener("click", () => { const fr = cyc.fgen / cycFc(); cyc.part = b.dataset.cpartValue; cyc.fgen = fr * cycFc(); resetCyc(); syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi boshqaruv (3D) */
const canvas = stage.canvas;
let drag = null;
/** Dasta uchi yoy bo'ylab: ekrandagi eng yaqin nuqta; yoyning bo'sh qismi orqali "sakrash" o'tkazib yuboriladi. */
function turn(pointAt, p) { const f = scene.lab.nearest(pointAt, 0, 1, p.x, p.y); if (Math.abs(f - drag.f) > 0.5) return null; drag.f = f; return f; }
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) {
    if (id === "bflip") { lor.Bs = -lor.Bs; launchLor(); customized(); refresh(); return; }
    if (id === "res") { tuneRes(); customized(); refresh(); return; }
    drag = { id, f: id === "kU" ? (ms.U - 200) / 2800 : id === "kE" ? (ms.Ef / 1000 - 1) / 59 : id === "kF" ? (cyc.fgen / cycFc() - 0.8) / 0.4 : 0 };
  },
  move(id, p) {
    if (!drag || drag.id !== id) return;
    const L = scene.lab;
    if (id === "tip") { const d = scene.tipDelta(p); if (!d) return; lor.th = clamp(Math.atan2(d[1], d[0]), -80 * DEG, 80 * DEG); lor.kv = clamp(Math.round((Math.hypot(d[0], d[1]) / 3.2) * 20) / 20, 0.2, 2); lVC.set(lor.kv); launchLor(); }
    else if (id === "htip") { const d = scene.htipDelta(p); if (!d) return; lor.alpha = clamp(Math.round(Math.atan2(d[1], d[0]) / DEG), 10, 90) * DEG; lor.kv = clamp(Math.round((Math.hypot(d[0], d[1]) / 3.2) * 20) / 20, 0.2, 2); lVC.set(lor.kv); lAC.set(lor.alpha / DEG); launchLor(); }
    else if (id === "gun") { lor.ys = Math.round(L.nearest(scene.gunAt, -LOR_H + 2, LOR_H - 2, p.x, p.y) * 2) / 2; launchLor(); }
    else if (id === "edge") { lor.xB = Math.round(L.nearest(scene.edgeAt, 6, LOR_W - 4, p.x, p.y) * 2) / 2; launchLor(); }
    else if (id === "ruler") { ms.ruler = Math.round(L.nearest(scene.rulerAt, 0.5, -MSW.y0 - 0.5, p.x, p.y) * 20) / 20; }
    else if (id === "kU") { const f = turn(scene.knobU, p); if (f == null) return; ms.U = clamp(Math.round((200 + 2800 * f) / 50) * 50, 200, 3000); mUC.set(ms.U); ms.hits = []; }
    else if (id === "kE") { const f = turn(scene.knobE, p); if (f == null) return; ms.Ef = clamp(Math.round(10 + 590 * f) * 100, 1000, 60000); mEC.set(ms.Ef / 1000); }
    else if (id === "kF") { const f = turn(scene.knobF, p); if (f == null) return; const fr = clamp(Math.round((0.8 + 0.4 * f) * 200) / 200, 0.8, 1.2); cyc.fgen = fr * cycFc(); cFC.set(fr); resetCyc(); }
    customized(); refresh();
  },
  end() { if (!drag) return; drag = null; refresh(); },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  proton: { mode: "lor", title: "Proton magnit maydonda", lesson: "Proton maydonga kirib aylana bo‘ylab buriladi: Lorens kuchi (qizil) doim tezlikka tik. v vektori uchini, manbani va maydon chegarasini surib ko‘ring; ⊙/⊗ tugmasi B yo‘nalishini almashtiradi.", set: () => Object.assign(lor, { part: "p", view: "plane", kv: 1, kb: 1, Bs: 1, th: 0, ys: 0, xB: 18 }) },
  period: { mode: "lor", title: "Davr tezlikka bog‘liq emas", lesson: "Proton maydon ichida tug‘iladi va to‘liq aylanalar chizadi. v vektorini uzaytiring: radius ortadi, lekin aylanish vaqti (T) o‘zgarmaydi — buni o‘lchov va «burilish» ko‘rsatkichida kuzating.", set: () => Object.assign(lor, { part: "p", view: "plane", kv: 0.8, kb: 1, Bs: 1, th: 80 * DEG, ys: -3, xB: 0 }) },
  electron: { mode: "lor", title: "Elektron va proton: ishora", lesson: "Elektron manfiy — xuddi shu maydonda protonga teskari tomonga buriladi. Massasi ancha kichik, shuning uchun 1 mT kabi kuchsiz maydonda ham kichik aylana chizadi.", set: () => Object.assign(lor, { part: "e", view: "plane", kv: 1, kb: 1, Bs: 1, th: 0, ys: 0, xB: 18 }) },
  helix: { mode: "lor", title: "Vint chiziq (α = 60°)", lesson: "Tezlik B ga 60° burchak ostida: zarra B bo‘ylab siljiydi va atrofida aylanadi — vint chiziq. v vektori uchini surib α ni o‘zgartiring: α = 90° da tekis aylana, kichik α da qadam uzun.", set: () => Object.assign(lor, { part: "p", view: "helix", kv: 1, kb: 1, alpha: 60 * DEG }) },
  msNe: { mode: "ms", title: "Neon izotoplari", lesson: "²⁰Ne va ²²Ne ionlari bir xil U da tezlatiladi, lekin og‘irrog‘i kattaroq yarim aylana chizadi. O‘lchagichni dog‘larga surib, massalarini aniqlang.", set: () => Object.assign(ms, { set: "Ne", U: 1000, B: 0.2, sel: false, ruler: 20.4 }) },
  msH: { mode: "ms", title: "Vodorod: H, D, T", lesson: "Protiy, deyteriy va tritiy massalari 1 : 2 : 3. Radiuslar √m ga proporsional: 1 : 1,41 : 1,73.", set: () => Object.assign(ms, { set: "H", U: 1000, B: 0.2, sel: false, ruler: 4.6 }) },
  msSel: { mode: "ms", title: "Tezlik selektori bilan", lesson: "Selektor E/B₁ = 9,8·10⁴ m/s tezlikni o‘tkazadi — faqat ²⁰Ne. E dastagini burab ²²Ne ni tanlang (≈ 9,35 kV/m).", set: () => Object.assign(ms, { set: "Ne", U: 1000, B: 0.2, sel: true, Ef: 9800, ruler: 20.4 }) },
  cycRes: { mode: "cyc", title: "Siklotron: rezonans", lesson: "Generator chastotasi f = qB/(2πm). Proton har o‘tishda 100 keV oladi va spiral bo‘ylab ~3 MeV gacha tezlanadi. Grafikda energiyaning «zinapoyasi».", set: () => { Object.assign(cyc, { part: "p", B: 1, U0: 100e3 }); cyc.fgen = cycFc(); } },
  cycOff: { mode: "cyc", title: "Chastota 3% farq qiladi", lesson: "Generator chastotasi 3% katta: o‘tish lahzalari kuchlanish fazasidan siljiydi, zarra avval tezlanib, keyin sekinlashadi — chetga yetolmaydi. Dastakni burab rezonansga keltiring.", set: () => { Object.assign(cyc, { part: "p", B: 1, U0: 100e3 }); cyc.fgen = 1.03 * cycFc(); } },
  cycAlpha: { mode: "cyc", title: "Alfa-zarra tezlatish", lesson: "Alfa-zarra uchun q/m protonnikidan 2 marta kichik: shu B da rezonans chastotasi 2 marta past. Energiyasi esa (2e)²/(4m) — protonniki bilan bir xil.", set: () => { Object.assign(cyc, { part: "a", B: 1, U0: 100e3 }); cyc.fgen = cycFc(); } },
};
const GROUPS = [["Lorens kuchi", ["proton", "period", "electron", "helix"]], ["Mass-spektrometr", ["msNe", "msH", "msSel"]], ["Siklotron", ["cycRes", "cycOff", "cycAlpha"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  lVC.set(lor.kv); lBC.set(lor.kb); lAC.set(Math.round(lor.alpha / DEG)); lVC.sync(); lBC.sync();
  document.querySelectorAll("[data-part-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.partValue === lor.part)));
  document.querySelectorAll("[data-view-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.viewValue === lor.view)));
  mUC.set(ms.U); mBC.set(ms.B); mEC.set(ms.Ef / 1000); $("[data-sel]").checked = ms.sel; $("[data-selctl]").hidden = !ms.sel;
  document.querySelectorAll("[data-iso-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.isoValue === ms.set)));
  cBC.set(cyc.B); cUC.set(cyc.U0 / 1000); cFC.set(cyc.fgen / cycFc()); cFC.sync();
  document.querySelectorAll("[data-cpart-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cpartValue === cyc.part)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { lor: "Manba, v vektori uchi va maydon chegarasi suriladi", ms: "U va E manbalari dastasini burang, o‘lchagichni suring", cyc: "Generator chastota dastasini burang" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-vctl]").forEach((el) => { el.hidden = el.dataset.vctl !== lor.view; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  scene.setMode(sceneMode()); // kamera shu tajribaga mos ko'rinishga (rejim almashgandagina)
  const gc = $("[data-graph-card]"); gc.hidden = ui.mode !== "cyc";
  if (ui.mode === "cyc") { $("[data-graph-title]").textContent = "Zarra energiyasi"; $("[data-graph-sub]").textContent = "Har bir o‘tishda energiya qU₀·cos φ ga o‘zgaradi: rezonansda — «zinapoya» bo‘ylab W_max gacha; chastota farq qilsa, energiya avval ortib, keyin kamayadi."; $("[data-tabs]").innerHTML = ""; window.dispatchEvent(new Event("resize")); }
}
const MODE_DEFAULT = { lor: "proton", ms: "msNe", cyc: "cycRes" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode;
  p.set();
  if (p.mode === "ms") { ms.hits = []; ms.ions = []; }
  resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
cyc.fgen = cycFc();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "proton");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
window.__lorentz = { lor, ms, cyc, ui, loadPreset, refresh, scene, frameCfg, cycFc };
