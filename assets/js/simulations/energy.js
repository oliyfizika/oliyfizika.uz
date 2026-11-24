// ==========================================================================
// Ish, quvvat va mexanik energiya — virtual laboratoriya (simulations/energy.html)
// 1) Ish va quvvat: qutini ip bilan tortish (kuch o'qi uchini va marra bayrog'ini sudrash, kuchlar ishlari ustunlari,
//    ΣA = ΔEk), ikki lebyodka musobaqasi (quvvat dastaklari, marra chizig'i, A = mgh, P = A/t = Fv).
// 2) Energiyaning saqlanishi: skeytpark — skeytchini va yo'l nuqtalarini sudrash, «Ep = 0» sathi, Ek/Ep/Q ustunlari,
//    Yer/Oy/Yupiter, ishqalanish; E(x) diagrammasi (to'xtash nuqtalari).
// 3) Prujina energiyasi: prujinali otgich (kattalashtirilgan ko'rinishda siqish), H = kx²/2mg, H(x²) o'lchovlari.
// Fizika: energy-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./energy-physics.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch5d";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch5d";
import { createEnergyLab, PULL_RAIL_END } from "./energy-lab-3d.js?v=20261123-batch5d";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const COL = { k: "#16a34a", p: "#2563eb", q: "#ea580c", e: "#64748b", s: "#9333ea" };

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "work", sub: "pull", show: { vec: true } };
const pull = { F: 60, alpha: 30 * DEG, M: 20, mu: 0.2, s: 4, x: 0, v: 0, t: 0, phase: "ready", AF: 0, Af: 0, tFin: null, AFfin: null };
const lift = { P1: 500, P2: 1000, m: 50, h: 10, y1: 0, y2: 0, t: 0, t1: null, t2: null, phase: "ready" };
const TRACKS = {
  pipe: [[0, 6], [2.5, 1.4], [6, 0.3], [9.5, 1.4], [12, 6]],
  hills: [[0, 6], [3, 0.5], [6, 3], [9, 0.5], [12, 4.5]],
  ramp: [[0, 6], [2.5, 0.8], [5, 0.3], [8, 1.0], [10, 2.5], [12, 4.5]],
};
const park = { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0, g: 9.81, yref: 0, s: 0, v: 0, Q: 0, hold: false, tr: null, trail: [] };
const spr = { k: 200, m: 0.2, x: 0.08, y: -0.08, v: 0, phase: "ready", ymax: -1, pts: [], t: 0 };
let presetId = null;

const g0 = P.G;
function rebuild() { park.tr = P.makeTrack(park.pts); park.s = clamp(park.s, 0, park.tr.L); }
rebuild();

/* ================================================================== 1a) Qutini tortish */

const boxSide = () => 0.6 * Math.cbrt(pull.M / 20);
function pullState() { return P.pullForces({ M: pull.M, F: pull.phase === "run" ? pull.F : pull.phase === "coast" ? 0 : pull.F, alpha: pull.alpha, mu: pull.mu, v: pull.v }); }
function stepPull(dt) {
  if (pull.phase !== "run" && pull.phase !== "coast") return;
  const n = Math.max(1, Math.ceil(dt / 0.002)), h = dt / n, b = boxSide();
  for (let i = 0; i < n; i++) {
    const fs = pullState(); let v1 = pull.v + fs.a * h;
    if (v1 <= 0 && pull.phase === "coast") { pull.v = 0; pull.phase = "done"; break; }
    v1 = Math.max(0, v1);
    const ds = 0.5 * (pull.v + v1) * h;
    if (pull.phase === "run") pull.AF += fs.Fx * ds;
    pull.Af -= fs.f * ds; pull.x += ds; pull.v = v1; pull.t += h;
    if (pull.phase === "run" && pull.x >= pull.s) { pull.phase = "coast"; pull.tFin = pull.t; pull.AFfin = pull.AF; }
    if (pull.x + b >= PULL_RAIL_END) { pull.phase = "done"; break; } // rels oxiri: kadr shu yerda to‘xtaydi, Eₖ ko‘rsatiladi
  }
}
function startPull() {
  if (pull.phase !== "ready") return;
  const fs = P.pullForces({ M: pull.M, F: pull.F, alpha: pull.alpha, mu: pull.mu, v: 0 });
  pull.phase = fs.a > 0 ? "run" : "stuck"; if (!loop.running) loop.start();
}
function resetPull() { Object.assign(pull, { x: 0, v: 0, t: 0, phase: "ready", AF: 0, Af: 0, tFin: null, AFfin: null }); }

/* ================================================================== 1b) Ikki lebyodka */

function stepLift(dt) {
  if (lift.phase !== "run") return;
  lift.t += dt;
  const v1 = P.liftSpeed(lift.P1, lift.m), v2 = P.liftSpeed(lift.P2, lift.m);
  if (lift.t1 === null) { lift.y1 = Math.min(lift.h, v1 * lift.t); if (lift.y1 >= lift.h - 1e-9) lift.t1 = lift.h / v1; }
  if (lift.t2 === null) { lift.y2 = Math.min(lift.h, v2 * lift.t); if (lift.y2 >= lift.h - 1e-9) lift.t2 = lift.h / v2; }
  if (lift.t1 !== null && lift.t2 !== null) lift.phase = "done";
}
function resetLift() { Object.assign(lift, { y1: 0, y2: 0, t: 0, t1: null, t2: null, phase: "ready" }); }

/* ================================================================== 2) Skeytpark */

function parkE() {
  const p = park.tr.at(park.s), Ek = 0.5 * park.m * park.v * park.v, Ep = park.m * park.g * (p.y - park.yref), Q = park.m * park.Q;
  return { Ek, Ep, Q, E: Ek + Ep + Q, h: p.y, p };
}
function stepPark(dt) {
  if (park.hold) return;
  const n = 2; for (let i = 0; i < n; i++) { const r = P.skateStep(park.tr, park, dt / n, park.mu, park.g); park.s = r.s; park.v = r.v; park.Q = r.Q; }
  const p = park.tr.at(park.s), last = park.trail[park.trail.length - 1];
  if (!last || Math.hypot(p.x - last[0], p.y - last[1]) > 0.35) { park.trail.push([p.x, p.y]); if (park.trail.length > 60) park.trail.shift(); }
}
function placeSkater(s) { Object.assign(park, { s, v: 0, Q: 0, trail: [] }); park.Emax = Math.max(1, park.m * park.g * (Math.max(...park.pts.map((q) => q[1])) - Math.min(park.yref, 0)) ); }
function drawParkGraph(ctx, gst) {
  const c = gst.colors, tr = park.tr, e = parkE(), m = park.m, g = park.g;
  const Epx = (i) => m * g * (tr.ys[i] - park.yref), vals = tr.ys.map((_, i) => Epx(i)), lo = Math.min(0, ...vals), hi = Math.max(...vals, e.Ek + e.Ep) * 1.08;
  const yt = ticks(lo, hi, 5), f = frame(ctx, gst, { xMin: 0, xMax: 12, yMin: Math.min(lo, yt.values[0]), yMax: hi, xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => (Math.abs(yt.step) >= 1000 ? fmt(v / 1000, 1) + "k" : fmt(v, 0)), xUnit: "x, m", yLabel: "E, J" });
  const Em = e.Ek + e.Ep;
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  // taqiqlangan soha (Eₚ > E_mex)
  ctx.fillStyle = "rgba(239,68,68,0.12)"; ctx.beginPath(); ctx.moveTo(f.X(tr.xs[0]), f.Y(Em));
  for (let i = 0; i < tr.xs.length; i += 2) ctx.lineTo(f.X(tr.xs[i]), f.Y(Math.max(Em, vals[i]))); ctx.lineTo(f.X(tr.xs[tr.xs.length - 1]), f.Y(Em)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COL.p; ctx.lineWidth = 2.4; ctx.beginPath(); for (let i = 0; i < tr.xs.length; i += 2) i ? ctx.lineTo(f.X(tr.xs[i]), f.Y(vals[i])) : ctx.moveTo(f.X(tr.xs[i]), f.Y(vals[i])); ctx.stroke();
  ctx.strokeStyle = COL.e; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Em)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Em)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = COL.k; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.X(e.p.x), f.Y(e.Ep)); ctx.lineTo(f.X(e.p.x), f.Y(Em)); ctx.stroke();
  ctx.fillStyle = "#7c3aed"; ctx.beginPath(); ctx.arc(f.X(e.p.x), f.Y(e.Ep), 5, 0, TAU); ctx.fill();
  ctx.restore();
  legend(ctx, [{ color: COL.p, label: "Eₚ(x)" }, { color: COL.e, label: "Eₖ + Eₚ", dash: [6, 4] }, { color: COL.k, label: "Eₖ (yashil kesma)" }], f.padL + 60, 9, c);
}

/* ================================================================== 3) Prujinali otgich */

function stepSpring(dt) {
  if (spr.phase === "done") { spr.wait -= dt; if (spr.wait <= 0) resetSpring(); return; }
  if (spr.phase !== "run") return;
  const r = P.springBallStep(spr, dt * 0.6, spr.k, spr.m, g0); spr.t += dt * 0.6;
  if (r.v < 0 && spr.v >= 0) { spr.ymax = r.y; spr.pts.push({ x: spr.x, H: r.y + spr.x, k: spr.k, m: spr.m }); if (spr.pts.length > 40) spr.pts.shift(); }
  spr.y = r.y; spr.v = r.v;
  if (spr.v < 0 && spr.y <= 0) { spr.y = 0; spr.v = 0; spr.phase = "done"; spr.wait = 1.2; }
}
function startSpring() { if (spr.phase !== "ready") return; Object.assign(spr, { y: -spr.x, v: 0, phase: "run", ymax: -1, t: 0 }); if (!loop.running) loop.start(); }
function resetSpring() { Object.assign(spr, { y: -spr.x, v: 0, phase: "ready", t: 0 }); }
function drawSpringGraph(ctx, gst) {
  const c = gst.colors, pts = spr.pts, x1 = 240, Hm = (spr.k * 0.0225) / (2 * spr.m * g0);
  const top = Math.max(1, Hm, ...pts.map((p) => p.H)) * 1.1, yt = ticks(0, top, 4);
  const f = frame(ctx, gst, { xMin: 0, xMax: x1, yMin: 0, yMax: top, xTicks: [0, 50, 100, 150, 200], yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step >= 1 ? 0 : 1), xUnit: "x², cm²", yLabel: "H, m" });
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  ctx.strokeStyle = COL.s; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(x1), f.Y((spr.k * (x1 / 1e4)) / (2 * spr.m * g0))); ctx.stroke(); ctx.setLineDash([]);
  pts.forEach((p) => { const same = p.k === spr.k && p.m === spr.m; ctx.globalAlpha = same ? 1 : 0.3; ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(f.X(p.x * p.x * 1e4), f.Y(p.H), 5, 0, TAU); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.restore();
  legend(ctx, [{ color: COL.s, label: `nazariya H = kx²/(2mg), k = ${fmt(spr.k, 0)} N/m, m = ${fmt(spr.m * 1000, 0)} g`, dash: [6, 4] }], f.padL + 50, 9, c);
}

/* ------------------------------------------------------------------ Asosiy chizish */

const scene = createEnergyLab();
function draw(ctx, st) {
  scene.draw(ctx, st, ui, pull, lift, park, spr);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: detailedStageHeight(cw), graph: Math.round(clamp(vh * 0.24, 160, 220)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });
function drawGraphCanvas(ctx, gst) { if (ui.mode === "park") return drawParkGraph(ctx, gst); if (ui.mode === "spring") return drawSpringGraph(ctx, gst); ctx.fillStyle = gst.colors.bg; ctx.fillRect(0, 0, gst.w, gst.h); }
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const J = (v) => (Math.abs(v) >= 10000 ? `${fmt(v / 1000, 2)}<small>kJ</small>` : `${fmt(v, Math.abs(v) < 10 ? 2 : 1)}<small>J</small>`);
function updateReadouts() {
  if (ui.mode === "work" && ui.sub === "pull") {
    const fs = P.pullForces({ M: pull.M, F: pull.F, alpha: pull.alpha, mu: pull.mu, v: 1 }), Ek = 0.5 * pull.M * pull.v * pull.v;
    setRO("r1", "Tortish kuchi ishi <i>A_F</i>", J(pull.AF), `A = F·s·cos α = ${fmt(pull.F, 0)}·${fmt(pull.s, 1)}·cos ${fmt(pull.alpha / DEG, 0)}° = ${fmt(pull.F * pull.s * Math.cos(pull.alpha), 0)} J`);
    setRO("r2", "Ishqalanish ishi <i>A_f</i>", J(pull.Af), `f = μ(mg − F sin α) = ${fmt(fs.f, 1)} N`, pull.mu ? "" : "muted");
    setRO("r3", "Ishlar yig‘indisi <i>ΣA</i>", J(pull.AF + pull.Af), "og‘irlik va N ishi nol (s ga tik)");
    setRO("r4", "Kinetik energiya <i>E_k</i>", J(Ek), `v = ${fmt(pull.v, 2)} m/s; ΣA = ΔEₖ`);
    setRO("r5", "Vaqt <i>t</i>", pull.tFin !== null ? `${fmt(pull.tFin, 2)}<small>s</small>` : `${fmt(pull.t, 2)}<small>s</small>`, pull.tFin !== null ? "marragacha" : "harakat");
    setRO("r6", "O‘rtacha quvvat <i>P</i>", pull.tFin !== null ? `${fmt(pull.AFfin / pull.tFin, 1)}<small>W</small>` : "—", "P = A_F/t", pull.tFin !== null ? "" : "muted");
  } else if (ui.mode === "work") {
    const A = lift.m * g0 * lift.h, v1 = P.liftSpeed(lift.P1, lift.m), v2 = P.liftSpeed(lift.P2, lift.m);
    setRO("r1", "Bajarilgan ish <i>A</i>", J(A), "A = mgh — ikkalasida bir xil");
    setRO("r2", "1-yuk tezligi", `${fmt(v1, 2)}<small>m/s</small>`, `v = P/(mg); F = mg = ${fmt(lift.m * g0, 0)} N`);
    setRO("r3", "2-yuk tezligi", `${fmt(v2, 2)}<small>m/s</small>`, "P = F·v");
    setRO("r4", "1-dvigatel vaqti", lift.t1 !== null ? `${fmt(lift.t1, 2)}<small>s</small>` : "—", `P₁ = ${fmt(lift.P1, 0)} W`, lift.t1 !== null ? "" : "muted");
    setRO("r5", "2-dvigatel vaqti", lift.t2 !== null ? `${fmt(lift.t2, 2)}<small>s</small>` : "—", `P₂ = ${fmt(lift.P2, 0)} W`, lift.t2 !== null ? "" : "muted");
    setRO("r6", "Vaqtlar nisbati <i>t₁/t₂</i>", lift.t1 !== null && lift.t2 !== null ? fmt(lift.t1 / lift.t2, 2) : "—", `P₂/P₁ = ${fmt(lift.P2 / lift.P1, 2)}`);
  } else if (ui.mode === "park") {
    const e = parkE();
    setRO("r1", "Kinetik energiya <i>Eₖ</i>", J(e.Ek), `v = ${fmt(Math.abs(park.v), 2)} m/s`);
    setRO("r2", "Potensial energiya <i>Eₚ</i>", J(e.Ep), `h = ${fmt(e.h - park.yref, 2)} m (Eₚ = 0 sathidan)`);
    setRO("r3", "Issiqlik <i>Q</i>", J(e.Q), park.mu ? `μ = ${fmt(park.mu, 2)}` : "ishqalanish yo‘q", park.mu ? "orange" : "muted");
    setRO("r4", "To‘liq energiya", J(e.E), "Eₖ + Eₚ + Q = const");
    setRO("r5", "Mexanik energiya", J(e.Ek + e.Ep), park.mu ? "kamayib boradi" : "saqlanadi");
    setRO("r6", "Massa va g", `${fmt(park.m, 0)}<small>kg</small>`, `g = ${fmt(park.g, 2)} m/s²`);
  } else {
    const Etot = 0.5 * spr.k * spr.x * spr.x, Hth = P.launchHeight(spr.k, spr.x, spr.m, g0), last = spr.pts[spr.pts.length - 1];
    setRO("r1", "Prujina energiyasi", J(Etot), `kx²/2, x = ${fmt(spr.x * 100, 1)} cm`);
    setRO("r2", "Kutilgan balandlik", `${fmt(Hth, 2)}<small>m</small>`, "H = kx²/(2mg)");
    setRO("r3", "O‘lchangan balandlik", spr.ymax > -0.5 ? `${fmt(spr.ymax + spr.x, 2)}<small>m</small>` : "—", "eng past nuqtadan", spr.ymax > -0.5 ? "" : "muted");
    setRO("r4", "Uchib chiqish tezligi", `${fmt(Math.sqrt(Math.max(0, (spr.k / spr.m) * spr.x * spr.x - 2 * g0 * spr.x)), 2)}<small>m/s</small>`, "prujinadan ajralganda");
    setRO("r5", "Tezlik (hozir)", `${fmt(Math.abs(spr.v), 2)}<small>m/s</small>`, spr.phase === "run" ? (spr.v > 0 ? "yuqoriga" : "pastga") : "—");
    setRO("r6", "k (o‘lchovdan)", last ? `${fmt((2 * last.m * g0 * last.H) / (last.x * last.x), 0)}<small>N/m</small>` : "—", "k = 2mgH/x²", last ? "" : "muted");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "work" && ui.sub === "pull") { t = { ready: "Tayyor", run: "Tortilmoqda", coast: "Inersiya bilan", done: "To‘xtadi", stuck: "Qo‘zg‘almadi" }[pull.phase]; tone = { ready: "blue", run: "green", coast: "orange", done: "purple", stuck: "red" }[pull.phase]; }
  else if (ui.mode === "work") { t = lift.phase === "ready" ? "Tayyor" : lift.phase === "run" ? "Ko‘tarilmoqda" : "Marraga yetdi"; tone = lift.phase === "done" ? "green" : "blue"; }
  else if (ui.mode === "park") { t = park.hold ? "Qo‘yib yuboring" : park.mu ? "Mexanik energiya kamaymoqda" : "Energiya saqlanmoqda"; tone = park.mu ? "orange" : "green"; }
  else { t = { ready: "Siqilgan", run: "Uchmoqda", done: "Ushlab olindi" }[spr.phase]; tone = spr.phase === "run" ? "green" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "work" && ui.sub === "pull") {
    p.push("<p><b>Mexanik ish</b> — kuch bilan jism ko‘chishi ko‘paytmasi: A = F·s·cos α. Faqat ko‘chish yo‘nalishidagi tashkil etuvchi F·cos α ish bajaradi; og‘irlik kuchi va tayanch reaksiyasi ko‘chishga tik — ularning ishi nol. Ishqalanish kuchi harakatga qarshi — uning ishi manfiy.</p>");
    p.push("<p>Barcha kuchlar ishlarining yig‘indisi kinetik energiya o‘zgarishiga teng (ustunlarda ΣA = ΔEₖ). Ipni yuqoriroq ko‘tarsangiz, F·cos α kamayadi, lekin tayanch reaksiyasi va ishqalanish ham kamayadi.</p>");
  } else if (ui.mode === "work") {
    p.push("<p><b>Quvvat</b> — ishning bajarilish tezligi: P = A/t. Ikkala lebyodka bir xil ish A = mgh bajaradi, ammo quvvati katta dvigatel uni tezroq bajaradi: vaqtlar quvvatlarga teskari proporsional.</p>");
    p.push("<p>Yuk tekis ko‘tarilganda dvigatel kuchi F = mg, demak P = F·v va v = P/(mg): quvvat 2 marta katta bo‘lsa, yuk 2 marta tez ko‘tariladi.</p>");
  } else if (ui.mode === "park") {
    p.push("<p>Ishqalanish bo‘lmasa <b>to‘liq mexanik energiya saqlanadi</b>: Eₖ + Eₚ = const. Pastga tushganda potensial energiya kinetikka aylanadi, ko‘tarilganda — aksincha; skeytchi boshlang‘ich balandlikdan yuqoriga chiqa olmaydi.</p>");
    p.push(park.mu ? "<p>Ishqalanish mexanik energiyaning bir qismini <b>issiqlikka</b> (Q) aylantiradi: Eₖ + Eₚ + Q = const. Skeytchi har safar pastroq ko‘tariladi va oxiri chuqurda to‘xtaydi.</p>" : "<p>«Eₚ = 0» sathini suring: potensial energiya qiymati (hatto ishorasi) o‘zgaradi, lekin harakat o‘zgarmaydi — fizik ma’noga faqat energiyalar farqi ega. Oy yoki Yupiterda energiyalar boshqacha, ammo burilish nuqtalari o‘sha balandlikda.</p>");
  } else {
    p.push("<p>Siqilgan prujina <b>potensial energiya</b> to‘playdi: Eₚᵣ = kx²/2. Qo‘yib yuborilganda u avval sharchaning kinetik energiyasiga, so‘ng balandlik potensial energiyasiga aylanadi: kx²/2 = mgH.</p>");
    p.push("<p>Siqilish 2 marta ortsa, balandlik 4 marta ortadi (H ~ x²). H(x²) grafigidagi nuqtalar to‘g‘ri chiziqda yotadi; qiyaligidan k = 2mg·H/x² ni toping.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "work" ? (ui.sub === "lift" ? "<small>Quvvat</small> P = A/t = F·v" : "<small>Ish</small> A = F·s·cos α") : ui.mode === "park" ? "<small>Saqlanish</small> Eₖ + Eₚ + Q = const" : "<small>Prujina</small> kx²/2 = mgH";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  let t = "", dis = false;
  if (ui.mode === "work" && ui.sub === "pull") { t = pull.phase === "ready" ? "Tortish" : "Qaytadan"; dis = pull.phase === "run"; }
  else if (ui.mode === "work") { t = lift.phase === "ready" ? "Ko‘tarish" : "Qaytadan"; dis = lift.phase === "run"; }
  else if (ui.mode === "park") t = "Yuqoridan qo‘yib yuborish";
  else { t = spr.phase === "ready" ? "Otish" : "Qaytadan siqish"; dis = spr.phase === "run"; }
  if (actBtn.textContent !== t) actBtn.textContent = t; actBtn.disabled = dis;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "work") (ui.sub === "lift" ? stepLift : stepPull)(dt); else if (ui.mode === "park") stepPark(dt); else stepSpring(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); updateAction(); graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
function topStart() { let best = 0, by = -1; for (let i = 0; i < park.tr.xs.length; i++) if (park.tr.ys[i] > by && i < park.tr.xs.length / 2) { by = park.tr.ys[i]; best = park.tr.S[i]; } return Math.min(best + 0.35, park.tr.L); }
function resetMode() {
  if (ui.mode === "work") (ui.sub === "lift" ? resetLift : resetPull)();
  else if (ui.mode === "park") placeSkater(topStart());
  else resetSpring();
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); });
actBtn.addEventListener("click", () => {
  if (ui.mode === "work" && ui.sub === "pull") { if (pull.phase === "ready") startPull(); else resetPull(); }
  else if (ui.mode === "work") { if (lift.phase === "ready") { lift.phase = "run"; if (!loop.running) loop.start(); } else resetLift(); }
  else if (ui.mode === "park") { placeSkater(topStart()); if (!loop.running) loop.start(); }
  else if (spr.phase === "ready") startSpring(); else resetSpring();
  customized(); refresh();
});
$("[data-meas-clear]").addEventListener("click", () => { spr.pts = []; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const pr2 = () => { if (pull.phase !== "ready") resetPull(); };
const wFC = bindRange($("#wF"), $("#wFOut"), (v) => `${fmt(v, 0)} N`, (v) => { pull.F = v; pr2(); customized(); refresh(); });
const wAC = bindRange($("#wA"), $("#wAOut"), (v) => `${fmt(v, 0)}°`, (v) => { pull.alpha = v * DEG; pr2(); customized(); refresh(); });
const wMC = bindRange($("#wM"), $("#wMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { pull.M = v; pr2(); customized(); refresh(); });
const wMuC = bindRange($("#wMu"), $("#wMuOut"), (v) => fmt(v, 2), (v) => { pull.mu = v; pr2(); customized(); refresh(); });
const wSC = bindRange($("#wS"), $("#wSOut"), (v) => `${fmt(v, 1)} m`, (v) => { pull.s = v; pr2(); customized(); refresh(); });
const lr = () => { if (lift.phase !== "ready") resetLift(); };
const pP1C = bindRange($("#pP1"), $("#pP1Out"), (v) => `${fmt(v, 0)} W`, (v) => { lift.P1 = v; lr(); customized(); refresh(); });
const pP2C = bindRange($("#pP2"), $("#pP2Out"), (v) => `${fmt(v, 0)} W`, (v) => { lift.P2 = v; lr(); customized(); refresh(); });
const pMC = bindRange($("#pM"), $("#pMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { lift.m = v; lr(); customized(); refresh(); });
const pHC = bindRange($("#pH"), $("#pHOut"), (v) => `${fmt(v, 1)} m`, (v) => { lift.h = v; lr(); customized(); refresh(); });
const kMC = bindRange($("#kM"), $("#kMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { park.m = v; placeSkater(park.s); customized(); refresh(); });
const kMuC = bindRange($("#kMu"), $("#kMuOut"), (v) => fmt(v, 2), (v) => { park.mu = v; customized(); refresh(); });
document.querySelectorAll("[data-track-value]").forEach((b) => b.addEventListener("click", () => { park.track = b.dataset.trackValue; park.pts = TRACKS[park.track].map((p) => p.slice()); rebuild(); placeSkater(topStart()); syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-planet-value]").forEach((b) => b.addEventListener("click", () => { park.g = +b.dataset.planetValue; placeSkater(park.s); syncAll(); customized(); refresh(); }));
const sr = () => { if (spr.phase !== "ready") resetSpring(); };
const sKC = bindRange($("#sK"), $("#sKOut"), (v) => `${fmt(v, 0)} N/m`, (v) => { spr.k = v; sr(); customized(); refresh(); });
const sMC = bindRange($("#sM"), $("#sMOut"), (v) => `${fmt(v * 1000, 0)} g`, (v) => { spr.m = v; sr(); customized(); refresh(); });
const sXC = bindRange($("#sX"), $("#sXOut"), (v) => `${fmt(v, 1)} cm`, (v) => { spr.x = v / 100; sr(); resetSpring(); customized(); refresh(); });
document.querySelectorAll("[data-sub-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.subValue !== ui.sub) loadPreset(b.dataset.subValue === "lift" ? "power" : "pull"); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi 3D boshqaruv — orbit faqat bo‘sh joydan boshlanadi. */
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id,p) {
    drag=id; dragY0=p.y; dragV0=id==='k1'?lift.P1:id==='k2'?lift.P2:0;
    if(id==='mm'||id==='mp') {
      pull.M=clamp(pull.M+(id==='mp'?5:-5),5,40);wMC.set(pull.M);customized();refresh();
    }
    if(id==='sk')park.hold=true;
    if(id==='ball'&&spr.phase==='done')resetSpring();
  },
  move(id,p) {
    if(id==='tip') {
      const point=scene.lab.planePoint(p.x,p.y,-.31),origin=scene.forceAnchor(pull);
      if(!point)return;
      const dx=point[0]-origin[0],dy=point[1]-origin[1];
      pull.alpha=clamp(Math.round(Math.atan2(dy,dx)/DEG),0,70)*DEG;
      pull.F=clamp(Math.round(Math.hypot(dx,dy)/1.65*150),0,150);
      wAC.set(Math.round(pull.alpha/DEG));wFC.set(pull.F);
    } else if(id==='flag') {
      pr2();const b=boxSide();
      pull.s=Math.round(scene.lab.nearest(v=>{const q=scene.pullPoint(v+b,1.4,-.15);return[q[0]+.12,q[1]-.12,q[2]];},1,6,p.x,p.y)*10)/10;wSC.set(pull.s);
    } else if(id==='k1'||id==='k2') {
      lr();const v=clamp(Math.round((dragV0+(dragY0-p.y)*12)/50)*50,100,3000);
      if(id==='k1'){lift.P1=v;pP1C.set(v);}else{lift.P2=v;pP2C.set(v);}
    } else if(id==='hline') {
      lr();lift.h=Math.round(scene.lab.nearest(scene.liftPoint,2,12,p.x,p.y)*2)/2;pHC.set(lift.h);
    } else if(id==='ref') {
      park.yref=Math.round(scene.lab.nearest(y=>[2.8,scene.parkPoint(0,y)[1],-.48],-.5,6.5,p.x,p.y)*4)/4;
    } else if(id.startsWith('pt')) {
      const w=scene.parkPosition(p.x,p.y);if(!w)return;
      const i=+id.slice(2),n=park.pts.length,x=i===0?0:i===n-1?12:clamp(w.x,park.pts[i-1][0]+.8,park.pts[i+1][0]-.8);
      park.pts[i]=[Math.round(x*10)/10,clamp(Math.round(w.y*10)/10,0,7)];rebuild();placeSkater(park.s);
    } else if(id==='sk') {
      placeSkater(scene.lab.nearest(s=>scene.parkHandle(park,s),0,park.tr.L,p.x,p.y));
    } else if(id==='ball') {
      spr.x=Math.round(scene.lab.nearest(scene.springPoint,.01,.15,p.x,p.y)*2000)/2000;
      sXC.set(spr.x*100);resetSpring();
    }
    customized();refresh();
  },
  end(id,cancelled) {
    if(id==='sk'){park.hold=false;if(!cancelled&&!loop.running)loop.start();}
    drag=null;refresh();
  }
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  pull: { mode: "work", sub: "pull", title: "Qutini tortish: A = Fs·cos α", lesson: "60 N kuch 30° burchak ostida qutini 4 m ga tortadi. «Tortish»ni bosing: ustunlarda har bir kuchning ishi. F o‘qi uchini surib kuch va burchakni, bayroqni surib ko‘chishni o‘zgartiring.", set: () => Object.assign(pull, { F: 60, alpha: 30 * DEG, M: 20, mu: 0.2, s: 4 }) },
  noFric: { mode: "work", sub: "pull", title: "Ishqalanishsiz: ΣA = ΔEₖ", lesson: "Ishqalanish yo‘q: tortish kuchining butun ishi kinetik energiyaga aylanadi. Marradan keyin quti o‘zgarmas tezlik bilan ketadi.", set: () => Object.assign(pull, { F: 50, alpha: 0, M: 20, mu: 0, s: 4 }) },
  angle: { mode: "work", sub: "pull", title: "Burchak 60°: ish kamayadi", lesson: "cos 60° = 0,5 — kuchning faqat yarmi ish bajaradi. Gorizontal tortish (α = 0) bilan solishtiring.", set: () => Object.assign(pull, { F: 80, alpha: 60 * DEG, M: 20, mu: 0.1, s: 4 }) },
  power: { mode: "work", sub: "lift", title: "Quvvat: ikki lebyodka", lesson: "Ikkala dvigatel 50 kg yukni 10 m ga ko‘taradi — ish bir xil (4,9 kJ). 1000 W li dvigatel 500 W lidan 2 marta tez. Dastaklarni burab quvvatni o‘zgartiring.", set: () => Object.assign(lift, { P1: 500, P2: 1000, m: 50, h: 10 }) },
  pipe: { mode: "park", title: "Yarim quvur: Eₖ ⇄ Eₚ", lesson: "Ishqalanish yo‘q: skeytchi har ikki tomonda bir xil balandlikka ko‘tariladi, to‘liq energiya ustuni o‘zgarmaydi. Skeytchini surib boshqa joydan qo‘yib yuboring.", set: () => Object.assign(park, { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0, g: 9.81, yref: 0 }) },
  fric: { mode: "park", title: "Ishqalanish: issiqlik Q", lesson: "μ = 0,08: har tebranishda mexanik energiyaning bir qismi issiqlikka aylanadi, skeytchi asta pasayib, chuqurda to‘xtaydi. To‘liq energiya (E) baribir saqlanadi.", set: () => Object.assign(park, { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0.08, g: 9.81, yref: 0 }) },
  hills: { mode: "park", title: "Tepalikdan oshib o‘tish", lesson: "O‘rtadagi tepalik 3 m: skeytchi 6 m dan tushsa oshib o‘tadi. Uni 3 m dan pastroq joydan qo‘yib yuboring — oshib o‘ta olmaydi (E(x) diagrammasida qizil soha).", set: () => Object.assign(park, { track: "hills", pts: TRACKS.hills.map((p) => p.slice()), m: 50, mu: 0, g: 9.81, yref: 0 }) },
  moon: { mode: "park", title: "Oyda skeytpark", lesson: "Oyda g 6 marta kichik: energiyalar ham 6 marta kichik, harakat sekin — lekin skeytchi baribir xuddi shu balandlikka ko‘tariladi.", set: () => Object.assign(park, { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0, g: 1.62, yref: 0 }) },
  spring: { mode: "spring", title: "Prujinali otgich", lesson: "k = 200 N/m prujina 8 cm siqilgan: kx²/2 = 0,64 J. «Otish»ni bosing — 200 g sharcha ≈ 0,33 m ga ko‘tariladi. Sharchani surib siqilishni o‘zgartiring va o‘lchovlarni grafikka yig‘ing.", set: () => Object.assign(spr, { k: 200, m: 0.2, x: 0.08, pts: [] }) },
  springK: { mode: "spring", title: "Bikr prujina: k ni o‘lchash", lesson: "k = 450 N/m. Siqilishni 5, 10, 15 cm qilib otib ko‘ring: H(x²) nuqtalari to‘g‘ri chiziqda; qiyaligidan k ni hisoblang.", set: () => Object.assign(spr, { k: 450, m: 0.1, x: 0.1, pts: [] }) },
};
const GROUPS = [["Ish va quvvat", ["pull", "noFric", "angle", "power"]], ["Energiya saqlanishi", ["pipe", "fric", "hills", "moon"]], ["Prujina energiyasi", ["spring", "springK"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  wFC.set(pull.F); wAC.set(Math.round(pull.alpha / DEG)); wMC.set(pull.M); wMuC.set(pull.mu); wSC.set(pull.s);
  pP1C.set(lift.P1); pP2C.set(lift.P2); pMC.set(lift.m); pHC.set(lift.h);
  kMC.set(park.m); kMuC.set(park.mu);
  document.querySelectorAll("[data-track-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.trackValue === park.track)));
  document.querySelectorAll("[data-planet-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.planetValue === park.g)));
  sKC.set(spr.k); sMC.set(spr.m); sXC.set(spr.x * 100);
  document.querySelectorAll("[data-sub-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.subValue === ui.sub)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { pull: "F o‘qi uchi, marra bayrog‘i va yuk «+»/«−»", lift: "Quvvat dastaklarini burang, marra chizig‘ini suring", park: "Skeytchini, yo‘l nuqtalarini va Eₚ = 0 sathini suring", spring: "Sharchani pastga surib prujinani siqing" };
const DHINT = { pull: "Stol oldidagi «+»/«−» massani o‘zgartiradi; F o‘qining uchini surib kuch va burchakni o‘rnating.", lift: "Dvigatellar ustidagi dastaklarni yuqoriga-pastga surib quvvatni o‘zgartiring." };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== ui.sub; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode === "work" ? ui.sub : ui.mode];
  $("[data-dhint]").textContent = DHINT[ui.sub] || "";
  const gc = $("[data-graph-card]"); gc.hidden = ui.mode === "work"; $("[data-meas-clear]").hidden = ui.mode !== "spring";
  if (ui.mode === "park") { $("[data-graph-title]").textContent = "Energiya diagrammasi E(x)"; $("[data-graph-sub]").textContent = "Ko‘k egri — yo‘l bo‘ylab potensial energiya, punktir — mexanik energiya. Ularning farqi (yashil kesma) — kinetik energiya. Qizil sohaga skeytchi kira olmaydi: kesishish nuqtalari — burilish nuqtalari."; }
  if (ui.mode === "spring") { $("[data-graph-title]").textContent = "Ko‘tarilish balandligi H(x²) — o‘lchovlar"; $("[data-graph-sub]").textContent = "Har otishda eng yuqori nuqta nuqta bo‘lib tushadi. H siqilish kvadratiga proporsional: to‘g‘ri chiziq qiyaligi k/(2mg). Xira nuqtalar — boshqa k yoki m bilan o‘lchangan."; }
  window.dispatchEvent(new Event("resize"));
}
const MODE_DEFAULT = { work: "pull", park: "pipe", spring: "spring" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; if (p.sub) ui.sub = p.sub;
  p.set(); if (p.mode === "park") rebuild();
  resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "pull");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
