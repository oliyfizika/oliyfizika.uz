// ==========================================================================
// Elektrlanish va elektroskop — virtual laboratoriya (simulations/electroscope.html)
// 1) Elektrlanish: matoni tayoqcha ustida surib ishqalash (shisha–ipak, ebonit–jun, qahrabo–jun, qo'ldagi metall),
//    elektronlar ko'chishi, zaryadning saqlanishi; tayoqcha/matoni sharchaga yaqinlashtirish va tegizish, yerga ulash.
// 2) Induksiya: tayoqchani gorizontal surish, sharcha va yaproqchalarda zaryadlarning ajralishi, yerga ulash kaliti,
//    induksiya orqali zaryadlash bosqichlari.
// 3) Ikki elektroskop: metall yoki shisha ulagichni sharchalarga tushirish — zaryadning taqsimlanishi.
// Dunyo koordinatalari: 640 × 340, 1 birlik = 1 mm. Fizika: electroscope-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./electroscope-physics.js";
import { createElectroscopeLab } from "./electroscope-lab-3d.js?v=20261123-batch8c";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch8c";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch8c";
const scene=createElectroscopeLab();

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const W = 640, H = 340, MM = 1e-3;
const RB = 16, ROD_R = 7, ROD_LEN = 180, LEAF = 60, HINGE = 105, CLW = 74, CLH = 44;
const BAR_MIN = 30, BAR_MAX = 80 - RB - 6; // ulagich pastki holati: sharcha tepasi − ulagich qalinligi

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "rub", show: { charges: true, names: false } };
const st = { pair: "glass", m: 8, earth: 0, rubT: 0, barN: 0, rubAcc: 0 };
const rod = { on: true, x: 250, y: 190, q: 0, touch: -1 };
const cloth = { on: true, x: 140, y: 290, q: 0, touch: -1 };
const bar = { y: BAR_MIN, mat: "metal" };
const ind = { d: 18 };
const steps = { near: false, gnear: false, lift: false, done: false };
let scopes = [];
let particles = [];
let autoRub = null;
let presetId = null;
let CW = 800;

const REST = { rod: { x: 250, y: 190 }, cloth: { x: 140, y: 290 } };
const mkScope = (bx, gx) => ({ bx, by: 80, gx, Q: 0, g: false, th: 0, eq: 0, leaf: 0, ball: 0, ext: 0 });
const pair = () => P.PAIRS[st.pair];
const rodMat = () => (ui.mode === "ind" ? (rod.q < 0 ? "ebonite" : "glass") : st.pair);

function setLayout(mode) {
  ui.mode = mode;
  if (mode === "two") { scopes = [mkScope(200, null), mkScope(460, 570)]; rod.on = false; cloth.on = false; }
  else { scopes = [mkScope(440, 550)]; rod.on = true; cloth.on = mode === "rub"; }
  rod.touch = cloth.touch = -1; bar.y = BAR_MIN;
  Object.assign(rod, REST.rod); Object.assign(cloth, REST.cloth);
  rod.q = 0; cloth.q = 0; particles = []; autoRub = null;
  Object.assign(st, { earth: 0, rubT: 0, barN: 0, rubAcc: 0 });
  Object.assign(steps, { near: false, gnear: false, lift: false, done: false });
}

/* ------------------------------------------------------------------ Dunyo → ekran */

/** Har rejimda ko'rinadigan gorizontal oraliq (tor ekranda sahna kattaroq ko'rinsin). */
const XB = { rub: [20, 600], ind: [100, 600], two: [120, 600] };
const view = { s: 1, ox: 0, oy: 0 };
function fit(w, h, pad = 6) {
  const [x0, x1] = XB[ui.mode], s = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / H);
  view.s = s; view.ox = (w - (x1 - x0) * s) / 2 - x0 * s; view.oy = (h - H * s) / 2;
}
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s, y: (py - view.oy) / view.s });

/* ------------------------------------------------------------------ Geometriya */

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
/** Nuqtadan kesmagacha masofa va eng yaqin nuqta. */
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
  const t = L2 ? clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1) : 0;
  const cx = x0 + t * dx, cy = y0 + t * dy;
  return { d: Math.hypot(px - cx, py - cy), cx, cy };
}
/** Tayoqcha — kapsula: o'q chizig'i (x − len + r … x − r), radiusi r. */
const rodSeg = () => [rod.x - ROD_LEN + ROD_R, rod.y, rod.x - ROD_R, rod.y];
const rodCharge = () => ({ x: rod.x - 12, y: rod.y }); // ishqalangan uchining zaryad markazi
function rectCircle(cx, cy, w, h, px, py) {
  const nx = clamp(px, cx - w / 2, cx + w / 2), ny = clamp(py, cy - h / 2, cy + h / 2);
  return { d: Math.hypot(px - nx, py - ny), nx, ny };
}
const clothOnRod = () => rod.on && cloth.on && Math.abs(cloth.y - rod.y) <= CLH / 2 + ROD_R - 2 &&
  cloth.x + CLW / 2 > rod.x - ROD_LEN && cloth.x - CLW / 2 < rod.x;

/** Tayoqcha/mato sharcha ichiga kirmasin. */
function pushOut() {
  for (const s of scopes) {
    if (rod.on && ui.mode !== "ind") {
      const [x0, y0, x1, y1] = rodSeg(), r = segDist(s.bx, s.by, x0, y0, x1, y1), need = RB + ROD_R;
      if (r.d < need) {
        const nx = r.d > 1e-6 ? (r.cx - s.bx) / r.d : -1, ny = r.d > 1e-6 ? (r.cy - s.by) / r.d : 0;
        rod.x += nx * (need - r.d); rod.y += ny * (need - r.d);
      }
    }
    if (cloth.on) {
      const r = rectCircle(cloth.x, cloth.y, CLW, CLH, s.bx, s.by);
      if (r.d < RB) {
        const nx = r.d > 1e-6 ? (r.nx - s.bx) / r.d : (cloth.x - s.bx) / (dist(cloth.x, cloth.y, s.bx, s.by) || 1);
        const ny = r.d > 1e-6 ? (r.ny - s.by) / r.d : (cloth.y - s.by) / (dist(cloth.x, cloth.y, s.bx, s.by) || 1);
        cloth.x += nx * (RB - r.d); cloth.y += ny * (RB - r.d);
      }
    }
  }
}

/* ------------------------------------------------------------------ Zarrachalar (elektronlar oqimi) */

let running = false;
function spawn(path, n) {
  if (!running || prefersReducedMotion()) return;
  const lens = []; let L = 0;
  for (let i = 1; i < path.length; i++) { const l = dist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y); lens.push(l); L += l; }
  if (L < 1) return;
  for (let k = 0; k < n && particles.length < 70; k++) particles.push({ path, lens, L, t: -k * 0.11, dur: clamp(L / 220, 0.45, 1.2) });
}
function partPos(p) {
  let s = clamp(p.t / p.dur, 0, 1) * p.L;
  for (let i = 0; i < p.lens.length; i++) {
    if (s <= p.lens[i] || i === p.lens.length - 1) { const f = p.lens[i] ? Math.min(1, s / p.lens[i]) : 0, a = p.path[i], b = p.path[i + 1]; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
    s -= p.lens[i];
  }
  return p.path[p.path.length - 1];
}
const nOf = (dq) => Math.min(8, Math.max(1, Math.round(Math.abs(dq) / 1.2)));
const groundPath = (s) => [{ x: s.bx + RB, y: s.by }, { x: s.gx, y: s.by }, { x: s.gx, y: s.by + 214 }];

/* ------------------------------------------------------------------ Fizika */

function extFor(s) {
  const list = [];
  if (rod.on && rod.q) { const c = rodCharge(); list.push({ q: rod.q, D: dist(c.x, c.y, s.bx, s.by) * MM }); }
  if (cloth.on && cloth.q) list.push({ q: cloth.q, D: dist(cloth.x, cloth.y, s.bx, s.by) * MM });
  return P.external(list, P.SCOPE.R);
}
const barTouch = () => ui.mode === "two" && bar.y >= BAR_MAX - 0.5;
const barConnected = () => barTouch() && bar.mat === "metal";

/** Tegish hodisalari: yangi tegishda izolyator zaryadining bir qismi o'tadi. */
function checkContacts() {
  if (ui.mode === "ind") { rod.touch = cloth.touch = -1; return; }
  let rt = -1, ct = -1;
  scopes.forEach((s, i) => {
    if (rod.on) { const [x0, y0, x1, y1] = rodSeg(); if (segDist(s.bx, s.by, x0, y0, x1, y1).d <= RB + ROD_R + 1) rt = i; }
    if (cloth.on && rectCircle(cloth.x, cloth.y, CLW, CLH, s.bx, s.by).d <= RB + 1) ct = i;
  });
  if (rt >= 0 && rt !== rod.touch && !pair().metal) {
    const s = scopes[rt], r = P.touch(rod.q, s.Q); rod.q = r.q; s.Q = r.Q;
    const a = { x: rod.x - 4, y: rod.y }, b = { x: s.bx, y: s.by };
    spawn(r.dQ > 0 ? [b, a] : [a, b], nOf(r.dQ));
  }
  if (ct >= 0 && ct !== cloth.touch) {
    const s = scopes[ct], r = P.touch(cloth.q, s.Q); cloth.q = r.q; s.Q = r.Q;
    const a = { x: cloth.x, y: cloth.y }, b = { x: s.bx, y: s.by };
    spawn(r.dQ > 0 ? [b, a] : [a, b], nOf(r.dQ));
  }
  rod.touch = rt; cloth.touch = ct;
}

/** Cheklovlar (yerga ulash, ulagich) va muvozanat burchaklari. */
function solve() {
  scopes.forEach((s) => { s.ext = extFor(s); });
  const grounded = scopes.map((s, i) => s.g || (rod.on && pair().metal && ui.mode === "rub" && rod.touch === i));
  const old = scopes.map((s) => s.Q);
  const conn = barConnected();
  if (conn && grounded.some(Boolean)) scopes.forEach((s) => { s.Q = P.groundedQ(s.ext); });
  else if (conn) { const [a, b] = P.share(scopes[0].Q, scopes[1].Q, scopes[0].ext, scopes[1].ext); scopes[0].Q = a; scopes[1].Q = b; }
  else scopes.forEach((s, i) => { if (grounded[i]) s.Q = P.groundedQ(s.ext); });

  const dQ = scopes.map((s, i) => s.Q - old[i]);
  if (conn && !grounded.some(Boolean)) {
    if (Math.abs(dQ[0]) > 1e-6) {
      st.barN += P.electrons(dQ[0]);
      const a = { x: scopes[0].bx, y: bar.y + 3 }, b = { x: scopes[1].bx, y: bar.y + 3 };
      spawn(dQ[0] > 0 ? [a, b] : [b, a], nOf(dQ[0])); // A musbatlashsa — elektronlar A dan B ga
    }
  } else {
    scopes.forEach((s, i) => {
      if (Math.abs(dQ[i]) < 1e-6) return;
      st.earth -= dQ[i];
      if (s.g || conn) { const gp = s.gx ? groundPath(s) : groundPath(scopes.find((o) => o.gx)); spawn(dQ[i] < 0 ? [...gp].reverse() : gp, nOf(dQ[i])); }
      else { const h = { x: rod.x - ROD_LEN + 20, y: rod.y }, b = { x: s.bx, y: s.by }; spawn(dQ[i] < 0 ? [h, b] : [b, h], nOf(dQ[i])); }
    });
  }
  scopes.forEach((s) => {
    const d = P.distribute(s.Q, s.ext); s.leaf = d.leaf; s.ball = d.ball;
    s.eq = P.leafAngle(s.leaf, { m: st.m * 1e-6 });
    if (!running) s.th = s.eq;
  });
  if (ui.mode === "ind") trackSteps();
}

function trackSteps() {
  const s = scopes[0], near = ind.d <= 8 && Math.abs(rod.q) >= 5;
  if (near) steps.near = true;
  if (s.g && near) { steps.gnear = true; steps.lift = false; steps.done = false; }
  else if (s.g) Object.assign(steps, { gnear: false, lift: false, done: false });
  if (steps.gnear && near && !s.g) steps.lift = true;
  if (steps.lift && !s.g && ind.d >= 15) steps.done = true;
}

/** Ishqalash: mato tayoqcha bo'ylab dx (mm) siljidi. */
function rubBy(dx) {
  if (!clothOnRod() || !dx) return;
  const pr = pair(), dT = P.rubStep(cloth.q, Math.abs(dx) * MM, pr);
  cloth.q -= dT; st.rubT += dT;
  if (pr.metal) st.earth += dT; else rod.q += dT;
  st.rubAcc += Math.abs(dT);
  while (st.rubAcc > 1.5) {
    st.rubAcc -= 1.5;
    const r = { x: clamp(cloth.x, rod.x - ROD_LEN + 10, rod.x - 10) + (Math.random() - 0.5) * 30, y: rod.y }, c = { x: cloth.x + (Math.random() - 0.5) * 40, y: cloth.y + (cloth.y > rod.y ? 1 : -1) * 16 };
    spawn(dT > 0 ? [r, c] : [c, r], 1);
  }
}

/* ------------------------------------------------------------------ Chizish */

function draw(ctx,stg){scene.draw(ctx,stg,ui,scopes,rod,cloth,bar,pair(),rodMat(),particles,partPos);}
const stage=createStage($("#stage"),draw,{height:detailedStageHeight});

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, d, unit) => `${fmt(v, d)}<small>${unit}</small>`;
const nc = (v) => u(Math.abs(v) < 0.05 ? 0 : v, 1, "nC");
const sgn = (v) => (v > 0.05 ? "musbat" : v < -0.05 ? "manfiy" : "neytral");
const deg = (s) => u(s.eq / DEG, 0, "°");
const phi = (s) => (P.K * (s.Q + s.ext) * P.NC) / P.SCOPE.R / 1000; // kV

function updateReadouts() {
  const s = scopes[0];
  if (ui.mode === "rub") {
    const pr = pair(), tot = rod.q + cloth.q + s.Q;
    setRO("r1", `${pr.rod} <i>q</i>`, nc(rod.q), pr.metal ? "zaryad qo‘l orqali yerga oqib ketadi" : sgn(rod.q));
    setRO("r2", `${pr.cloth} <i>q<sub>m</sub></i>`, nc(cloth.q), sgn(cloth.q));
    setRO("r3", "Jami: tayoqcha + mato + elektroskop", nc(tot), Math.abs(st.earth) > 0.05 ? `yerga o‘tgan: ${fmt(st.earth, 1)} nC (jami bilan 0)` : "zaryad saqlanadi — faqat ko‘chadi");
    setRO("r4", "Elektroskop zaryadi <i>Q</i>", nc(s.Q), `yaproqchalarda ${fmt(s.leaf, 1)} nC${s.g ? " · yerga ulangan" : ""}`);
    setRO("r5", "Yaproqchalar burchagi <i>θ</i>", deg(s), s.eq > 2 * DEG ? "bir xil ishorali zaryadlar itarishadi" : "yaproqchalar yopiq", s.eq > 2 * DEG ? "orange" : "");
    const N = P.electrons(st.rubT);
    setRO("r6", "Ko‘chgan elektronlar <i>N</i>", N > 0 ? sci(N, 3) : "0", Math.abs(st.rubT) < 0.05 ? "hali ishqalanmadi" : st.rubT > 0 ? "tayoqchadan matoga: N = |q|/e" : "matodan tayoqchaga: N = |q|/e");
  } else if (ui.mode === "ind") {
    setRO("r1", "Tayoqcha zaryadi <i>q</i>", nc(rod.q), rod.q > 0 ? "shisha (ipakka ishqalangan)" : rod.q < 0 ? "ebonit (junga ishqalangan)" : "zaryadsiz");
    setRO("r2", "Sharchagacha masofa <i>d</i>", u(ind.d, 1, "cm"), "tayoqcha sharchaga tegmaydi");
    setRO("r3", "Sharchada <i>Q<sub>sh</sub></i>", nc(s.ball), Math.abs(s.ext) > 0.3 ? "tayoqchaga yaqin tomonga tortilgan" : "sharcha va sterjen");
    setRO("r4", "Yaproqchalarda <i>Q<sub>y</sub></i>", nc(s.leaf), Math.abs(s.leaf) > 0.05 ? `${sgn(s.leaf)} — yaproqchalar itarishadi` : "yaproqchalar zaryadsiz");
    setRO("r5", "Elektroskopning to‘liq zaryadi <i>Q</i>", nc(s.Q), s.g ? "yerga ulangan: Q = −q·R/D" : Math.abs(s.Q) > 0.05 ? "induksiya orqali zaryadlangan" : "Q = Q_sh + Q_y = 0", Math.abs(s.Q) > 0.05 && !s.g ? "orange" : "");
    setRO("r6", "Yaproqchalar burchagi <i>θ</i>", deg(s), `φ = ${fmt(phi(s), 1)} kV`);
  } else {
    const [a, b] = scopes, tb = barTouch();
    setRO("r1", "A elektroskop <i>Q<sub>A</sub></i>", nc(a.Q), `θ = ${fmt(a.eq / DEG, 0)}°, φ = ${fmt(phi(a), 1)} kV`);
    setRO("r2", "B elektroskop <i>Q<sub>B</sub></i>", nc(b.Q), `θ = ${fmt(b.eq / DEG, 0)}°, φ = ${fmt(phi(b), 1)} kV${b.g ? " · yerga ulangan" : ""}`);
    setRO("r3", "Jami <i>Q<sub>A</sub> + Q<sub>B</sub></i>", nc(a.Q + b.Q), Math.abs(st.earth) > 0.05 ? `yerga o‘tgan: ${fmt(st.earth, 1)} nC` : "zaryad saqlanadi");
    setRO("r4", "Ulagich", !tb ? "tegmagan" : bar.mat === "metal" ? "o‘tkazadi" : "o‘tkazmaydi", bar.mat === "metal" ? "metall — erkin elektronlar bor" : "shisha — dielektrik, elektronlar bog‘langan", tb ? "orange" : "");
    setRO("r5", "Potensiallar farqi <i>φ<sub>A</sub> − φ<sub>B</sub></i>", u(phi(a) - phi(b), 1, "kV"), barConnected() ? "ulangan o‘tkazgichda potensial bir xil" : "ulansa elektronlar oqadi");
    setRO("r6", "Ulagich orqali o‘tgan elektronlar", st.barN > 0 ? sci(st.barN, 3) : "0", "N = |ΔQ|/e");
  }
}
function updateStatus() {
  const el = $("[data-status]"), s = scopes[0]; let t, tone = "blue";
  if (ui.mode === "two") {
    const tb = barTouch();
    t = tb ? (bar.mat === "metal" ? "Ulandi: zaryad taqsimlandi" : "Shisha zaryad o‘tkazmaydi") : "Ulagich ko‘tarilgan"; tone = tb ? (bar.mat === "metal" ? "green" : "orange") : "blue";
  } else if (autoRub) { t = "Ishqalanmoqda: elektronlar ko‘chadi"; tone = "purple"; }
  else if (ui.mode === "rub" && clothOnRod()) { t = "Mato tayoqcha ustida — suring"; tone = "purple"; }
  else if (s.g || (rod.touch === 0 && pair().metal && ui.mode === "rub")) { t = "Yerga ulangan"; tone = "green"; }
  else if (rod.touch === 0 || cloth.touch === 0) { t = "Sharchaga tegib turibdi"; tone = "orange"; }
  else if (ui.mode === "ind" && steps.done) { t = `Induksiya orqali zaryadlandi: ${sgn(s.Q)}`; tone = "green"; }
  else { t = s.eq > 2 * DEG ? "Yaproqchalar ochilgan" : "Yaproqchalar yopiq"; tone = s.eq > 2 * DEG ? "orange" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [], s = scopes[0];
  if (ui.mode === "rub") {
    const pr = pair();
    if (pr.metal) p.push("<p>Metall — <b>o‘tkazgich</b>. Uni qo‘lda ushlab ishqalasak, tayoqchaga o‘tgan elektronlar darhol qo‘l va tana orqali yerga ketadi — tayoqcha zaryadlanmaydi, jun esa zaryadlanadi. Metallni izolyator dastadan ushlansa, u ham elektrlanadi. Qo‘ldagi metall sharchaga tegsa, elektroskopni yerga ulaydi.</p>");
    else p.push(`<p><b>Ishqalanish orqali elektrlanish</b>: jismlar zich tekkanda elektronlarning bir qismi bir jismdan ikkinchisiga o‘tadi. ${pr.rod} va ${pr.cloth.toLowerCase()} uchun elektronlar ${pr.sign > 0 ? `tayoqchadan matoga o‘tadi — tayoqcha <b>musbat</b>, mato <b>manfiy</b>` : `matodan tayoqchaga o‘tadi — tayoqcha <b>manfiy</b>, mato <b>musbat</b>`} zaryadlanadi. Zaryad yaratilmaydi, faqat ko‘chadi: q<sub>tayoqcha</sub> = −q<sub>mato</sub>.</p>`);
    if (Math.abs(s.Q) > 0.3) p.push(`<p>Elektroskop ${sgn(s.Q)} zaryadlangan (Q = ${fmt(s.Q, 1)} nC). Endi uni <b>ishorani aniqlash</b>da ishlatish mumkin: bir xil ishorali jism yaqinlashtirilsa yaproqchalar ko‘proq ochiladi, qarama-qarshi ishorali — yopiladi.</p>`);
    else if (Math.abs(rod.q) > 3) p.push("<p>Zaryadlangan tayoqchani sharchaga yaqinlashtiring: tegmasdan ham yaproqchalar ochiladi (induksiya). Tegizsangiz, zaryadning bir qismi elektroskopga o‘tadi va tayoqcha olib ketilgandan keyin ham yaproqchalar ochiq qoladi.</p>");
    else p.push("<p>Matoni tayoqcha ustida u yoqqa-bu yoqqa suring yoki «Ishqalash» tugmasini bosing. Har bir zaryad belgisi taxminan 3 nC ga (≈ 19 milliard elektron) to‘g‘ri keladi.</p>");
  } else if (ui.mode === "ind") {
    p.push(`<p><b>Elektrostatik induksiya</b>: zaryadlangan tayoqcha metalldagi erkin elektronlarni ${rod.q > 0 ? "o‘ziga tortadi — sharcha manfiy, yaproqchalar musbat" : rod.q < 0 ? "itaradi — sharcha musbat, yaproqchalar manfiy" : "ta’sir qilmaydi (tayoqcha zaryadsiz)"} bo‘lib qoladi. Elektroskopning umumiy zaryadi o‘zgarmaydi, faqat qayta taqsimlanadi; tayoqcha uzoqlashsa yaproqchalar yopiladi.</p>`);
    const ck = (b, t) => `<li>${b ? "✅" : "⬜"} ${t}</li>`;
    p.push(`<p><b>Induksiya orqali zaryadlash:</b></p><ul style="margin:6px 0 0 18px">${ck(steps.near, "tayoqchani sharchaga yaqinlashtiring (d ≤ 8 cm)")}${ck(steps.gnear, "tayoqchani olmasdan yerga ulang — yaproqchalar yopiladi")}${ck(steps.lift, "avval yerdan uzing")}${ck(steps.done, "keyin tayoqchani uzoqlashtiring (d ≥ 15 cm)")}</ul>`);
    if (steps.done) p.push(`<p>Natija: elektroskop tayoqchaga <b>qarama-qarshi</b> ishorada zaryadlandi (Q = ${fmt(s.Q, 1)} nC), tayoqcha esa zaryadini yo‘qotmadi. Tartibni almashtirsangiz (avval tayoqchani olib, keyin yerdan uzsangiz), zaryad yerga qaytib ketadi.</p>`);
  } else {
    const tb = barTouch();
    p.push(bar.mat === "metal"
      ? "<p><b>Metall</b> — o‘tkazgich: unda erkin elektronlar bor. Ulagich ikkala sharchaga tekkanda elektronlar potensiallar tenglashguncha oqadi. Bir xil elektroskoplarda zaryad teng bo‘linadi: Q′ = (Q<sub>A</sub> + Q<sub>B</sub>)/2. Qarama-qarshi teng zaryadlar bir-birini neytrallaydi.</p>"
      : "<p><b>Shisha</b> — dielektrik (izolyator): elektronlar atomlarga bog‘langan va erkin ko‘cha olmaydi. Shuning uchun shisha ulagich tekkanda ham elektroskoplarning zaryadi o‘zgarmaydi.</p>");
    if (tb && bar.mat === "metal") p.push(`<p>Hozir A va B bitta o‘tkazgich: Q<sub>A</sub> = ${fmt(scopes[0].Q, 1)} nC, Q<sub>B</sub> = ${fmt(scopes[1].Q, 1)} nC. Ulagichni ko‘tarsangiz ham zaryadlar shunday qoladi.</p>`);
    else p.push("<p>Ulagichni dastasidan ushlab pastga — sharchalarga tushiring. Dasta izolyatordan qilingan, shuning uchun zaryad qo‘lga o‘tmaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "rub" ? "<small>Saqlanish</small> q₁ + q₂ = 0, q = Ne" : ui.mode === "ind" ? "<small>Yerga ulanganda</small> Q = −qR/D" : "<small>Ulash</small> Q′ = (Q₁ + Q₂)/2";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); }
function update() { checkContacts(); solve(); syncDynamic(); refresh(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (autoRub) {
    autoRub.t += dt;
    const nx = rod.x - 62 + 40 * Math.sin(TAU * 1.5 * autoRub.t), dx = nx - cloth.x;
    cloth.x = nx; cloth.y = rod.y; rubBy(dx);
    if (autoRub.t >= 2) { endAutoRub(); }
    solve();
  }
  for (const p of particles) p.t += dt;
  particles = particles.filter((p) => p.t < p.dur);
  const k = 1 - Math.exp(-dt * 6);
  for (const s of scopes) s.th += (s.eq - s.th) * k;
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; if (autoRub) refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) { scopes.forEach((s) => { s.th = s.eq; }); particles = []; stage.render(); }
}
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || MODE_DEFAULT[ui.mode], false));

function startAutoRub() {
  if (ui.mode !== "rub" || autoRub) return;
  customized();
  if (!running) { cloth.x = rod.x - 62; cloth.y = rod.y; for (let k = 0; k < 30; k++) rubBy(k % 2 ? 30 : -30); endAutoRub(); update(); return; }
  cloth.x = rod.x - 62; cloth.y = rod.y; autoRub = { t: 0 };
}
function endAutoRub() {
  autoRub = null;
  cloth.y = rod.y + 80 <= H - CLH / 2 - 4 ? rod.y + 80 : rod.y - 80;
  cloth.x = clamp(cloth.x, XB.rub[0] + CLW / 2, XB.rub[1] - CLW / 2);
  pushOut(); update();
}
$("[data-rub]").addEventListener("click", startAutoRub);
$("[data-touch]").addEventListener("click", () => {
  if (ui.mode !== "rub") return;
  customized();
  const s = scopes[0];
  if (rod.touch === 0) { Object.assign(rod, REST.rod); }
  else { rod.x = s.bx - RB; rod.y = s.by; if (cloth.on && clothOnRod()) { cloth.y = rod.y + 80; } }
  update();
});

/* ------------------------------------------------------------------ Boshqaruv */

const pairSel = $("#pair");
pairSel.addEventListener("change", () => { st.pair = pairSel.value; customized(); rod.q = 0; cloth.q = 0; st.rubT = 0; st.earth = 0; scopes[0].Q = 0; update(); });
const iQC = bindRange($("#iQ"), $("#iQOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 0)} nC`, (v) => { rod.q = v; customized(); update(); });
const iDC = bindRange($("#iD"), $("#iDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ind.d = v; placeIndRod(); customized(); update(); });
const iG = $("#iG");
iG.addEventListener("change", () => { scopes[0].g = iG.checked; customized(); update(); });
const tAC = bindRange($("#tA"), $("#tAOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 0)} nC`, (v) => { scopes[0].Q = v; customized(); update(); });
const tBC = bindRange($("#tB"), $("#tBOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 0)} nC`, (v) => { scopes[1].Q = v; customized(); update(); });
const tC = $("#tC");
tC.addEventListener("change", () => { bar.y = tC.checked ? BAR_MAX : BAR_MIN; customized(); update(); });
document.querySelectorAll("[data-bar-value]").forEach((b) => b.addEventListener("click", () => { bar.mat = b.dataset.barValue; customized(); update(); }));
const lmC = bindRange($("#lm"), $("#lmOut"), (v) => `${fmt(v, 0)} mg`, (v) => { st.m = v; update(); });
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; stage.render(); }));

function placeIndRod() { const s = scopes[0]; rod.y = s.by; rod.x = s.bx - RB - ind.d * 10; }
/** Sahnadan o'zgaradigan qiymatlarni panelga yozish. */
function syncDynamic() {
  if (ui.mode === "ind") { iG.checked = scopes[0].g; iDC.set(ind.d); iQC.set(rod.q); }
  if (ui.mode === "two") { tAC.set(Math.round(scopes[0].Q)); tBC.set(Math.round(scopes[1].Q)); tC.checked = barTouch(); $("#tAOut").textContent = `${scopes[0].Q > 0.05 ? "+" : ""}${fmt(scopes[0].Q, 1)} nC`; $("#tBOut").textContent = `${scopes[1].Q > 0.05 ? "+" : ""}${fmt(scopes[1].Q, 1)} nC`; }
  document.querySelectorAll("[data-bar-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.barValue === bar.mat)));
}

/* Sahnadagi boshqaruv: orbit proyeksiyasidan model tekisligiga. */
const canvas=stage.canvas;
let drag=null;
function onDrag(p){
  const nx=p.x-drag.ox,ny=p.y-drag.oy;
  if(drag.k==='rod'){
    if(ui.mode==='ind'){const s=scopes[0];ind.d=clamp(Math.round((s.bx-RB-nx)/5)/2,.5,25);placeIndRod();}
    else{const px=rod.x,on=clothOnRod();rod.x=clamp(nx,XB[ui.mode][0]+ROD_LEN*.35,XB[ui.mode][1]-4);rod.y=clamp(ny,12,H-12);pushOut();if(on)rubBy(rod.x-px);}
  }else if(drag.k==='cloth'){
    const px=cloth.x;cloth.x=clamp(nx,XB[ui.mode][0]+CLW/2,XB[ui.mode][1]-CLW/2);cloth.y=clamp(ny,CLH/2,H-CLH/2);pushOut();rubBy(cloth.x-px);
  }else if(drag.k==='bar')bar.y=clamp(ny,BAR_MIN,BAR_MAX);
  customized();update();
}
bindLabCamera(canvas,scene.lab,()=>stage.render(),{
  start(id,p){
    if(autoRub)return;
    if(id.startsWith('sw')){const i=+id.slice(2);scopes[i].g=!scopes[i].g;customized();update();return;}
    const q=scene.modelPoint(p,id);if(!q)return;const o=id==='rod'?rod:id==='cloth'?cloth:{x:0,y:bar.y};drag={k:id,ox:q.x-o.x,oy:q.y-o.y};
  },
  move(id,p){if(!drag)return;const q=scene.modelPoint(p,drag.k);if(q)onDrag(q);},
  end(){drag=null;refresh();}
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  glass: { mode: "rub", title: "Shisha va ipak", lesson: "Shisha tayoqcha va ipak hozircha neytral. Ipakni tayoqcha ustida surib ishqalang: shisha elektronlarini yo‘qotib musbat, ipak manfiy zaryadlanadi. Keyin tayoqchani sharchaga yaqinlashtiring.", set: () => { st.pair = "glass"; } },
  ebonite: { mode: "rub", title: "Ebonit va jun", lesson: "Ebonit junga ishqalanganda elektronlarni o‘ziga oladi — manfiy zaryadlanadi, jun musbat. Har ikkala jismni navbat bilan sharchaga yaqinlashtirib, yaproqchalarni kuzating.", set: () => { st.pair = "ebonite"; } },
  contact: { mode: "rub", title: "Tegizib zaryadlash", lesson: "Ebonit tayoqcha zaryadlangan (−36 nC). Uni sharchaga tegizing («Tegizish» tugmasi) va olib keting: elektroskop manfiy zaryadlanib qoladi. Yana tegizsangiz, zaryadi ortadi.", set: () => { st.pair = "ebonite"; rod.q = -36; cloth.q = 36; st.rubT = -36; cloth.x = 60; cloth.y = 300; rod.x = 300; rod.y = 120; } },
  sign: { mode: "rub", title: "Zaryad ishorasini aniqlash", lesson: "Elektroskop oldindan manfiy zaryadlangan, shisha tayoqcha esa musbat. Tayoqchani sekin yaqinlashtiring: yaproqchalar yopiladi — demak, zaryadlar ishorasi qarama-qarshi. Tegizmang!", set: () => { st.pair = "glass"; rod.q = 30; cloth.q = -30; st.rubT = 30; scopes[0].Q = -12; cloth.x = 60; cloth.y = 300; } },
  amber: { mode: "rub", title: "Qahrabo: «elektron» so‘zi", lesson: "Qadimgi yunonlar junga ishqalangan qahrabo (yunoncha «elektron») mayda jismlarni tortishini payqashgan. Qahrabo manfiy zaryadlanadi. Ishqalab, elektroskopda tekshiring.", set: () => { st.pair = "amber"; } },
  metal: { mode: "rub", title: "Metall nega zaryadlanmaydi?", lesson: "Qo‘ldagi metall tayoqchani junga ishqalang: tayoqchaga o‘tgan elektronlar qo‘l orqali yerga ketadi, jun esa musbat zaryadlanadi. Zaryadlangan elektroskopga metallni tegizsangiz — u razryadlanadi.", set: () => { st.pair = "metal"; scopes[0].Q = 14; } },
  induce: { mode: "ind", title: "Yaqinlashtirish: zaryadlar ajraladi", lesson: "Musbat shisha tayoqcha sharchaga yaqinlashganda elektronlar sharchaga tortiladi, yaproqchalarda musbat zaryad qoladi va ular ochiladi. Tayoqchani olib ketsangiz — yopiladi.", set: () => { rod.q = 30; ind.d = 18; } },
  indCharge: { mode: "ind", title: "Induksiya orqali zaryadlash", lesson: "Tayoqcha sharchaga yaqin. Endi kalitni ulang (yaproqchalar yopiladi), so‘ng kalitni uzing va shundan keyingina tayoqchani uzoqlashtiring. Elektroskop tayoqchaga qarama-qarshi ishorada zaryadlanadi.", set: () => { rod.q = 36; ind.d = 3; } },
  indNeg: { mode: "ind", title: "Ebonit bilan induksiya", lesson: "Manfiy ebonit tayoqcha elektronlarni itaradi: ular yaproqchalarga ketadi, sharcha musbat bo‘lib qoladi. Bosqichlarni bajaring — elektroskop musbat zaryadlanadi.", set: () => { rod.q = -36; ind.d = 3; } },
  discharge: { mode: "ind", title: "Yerga ulash: razryadlash", lesson: "Elektroskop musbat zaryadlangan, tayoqcha uzoqda va zaryadsiz. Kalitni ulang (sharchaga qo‘l tekkizgandek): yerdan elektronlar keladi va elektroskop neytrallanadi.", set: () => { rod.q = 0; ind.d = 25; scopes[0].Q = 14; } },
  shareMetal: { mode: "two", title: "Metall bilan ulash", lesson: "A zaryadlangan (+16 nC), B — yo‘q. Metall ulagichni sharchalarga tushiring: zaryad teng bo‘linadi, ikkala elektroskopning yaproqchalari bir xil ochiladi.", set: () => { scopes[0].Q = 16; bar.mat = "metal"; } },
  shareGlass: { mode: "two", title: "Shisha bilan ulash", lesson: "Xuddi shu tajriba, lekin ulagich shishadan. Tushiring: zaryad o‘tmaydi — shisha dielektrik. Keyin «Metall sterjen»ni tanlang.", set: () => { scopes[0].Q = 16; bar.mat = "glass"; } },
  opposite: { mode: "two", title: "Qarama-qarshi zaryadlar", lesson: "A musbat (+12 nC), B manfiy (−12 nC). Metall bilan ulasangiz, ortiqcha elektronlar B dan A ga o‘tib, ikkalasi ham neytral bo‘ladi.", set: () => { scopes[0].Q = 12; scopes[1].Q = -12; bar.mat = "metal"; } },
  unequal: { mode: "two", title: "Turli zaryadlar", lesson: "A: +20 nC, B: −6 nC. Ulanganda har biri (20 − 6)/2 = +7 nC oladi. Keyin B ni yerga ulab, natijani kuzating.", set: () => { scopes[0].Q = 20; scopes[1].Q = -6; bar.mat = "metal"; } },
};
const GROUPS = [["Elektrlanish", ["glass", "ebonite", "amber", "contact", "sign", "metal"]], ["Induksiya", ["induce", "indCharge", "indNeg", "discharge"]], ["Ikki elektroskop", ["shareMetal", "shareGlass", "opposite", "unequal"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { rub: "Matoni tayoqchaga ishqalang, tayoqchani sharchaga olib boring", ind: "Tayoqchani gorizontal suring, kalitni bosing", two: "Ulagichni sharchalarga tushiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
}
function syncAll() {
  pairSel.value = st.pair; lmC.set(st.m);
  if (ui.mode === "ind") { iQC.set(rod.q); iDC.set(ind.d); }
  syncDynamic();
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_DEFAULT = { rub: "glass", ind: "induce", two: "shareMetal" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; setLayout(p.mode);
  p.set();
  if (ui.mode === "ind") placeIndRod();
  checkContacts(); solve(); scopes.forEach((s) => { s.th = s.eq; }); particles = [];
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "glass");
document.fonts?.ready.then(() => stage.render());

// Node/Playwright tekshiruvi uchun
window.__electroscope = { scopes: () => scopes, rod, cloth, bar, st, steps, ind, loadPreset, update };
