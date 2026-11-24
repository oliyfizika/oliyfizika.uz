// ==========================================================================
// Yarimo'tkazgichlar va p–n o'tish — virtual laboratoriya (simulations/semiconductor.html)
// 1) Metall va yarimo'tkazgich: plitkadagi suvli stakanda mis g'altak va termorezistor, ikkita multimetr (R(t));
//    fotorezistor optik skamyada (lampa, luksmetr). Mikroskopik ko'rinish: ionlar tebranishi / erkin elektronlar.
// 2) O'tkazuvchanlik: kremniy (germaniy) panjarasi, kovalent bog'lar, elektron-kovak juftlari, fosfor (n-tip) va bor
//    (p-tip) atomlari; batareya ulansa elektronlar va kovaklar qarama-qarshi tomonga dreyf qiladi.
// 3) Diod va tranzistor: diod VAX ni o'lchash (manba, qutb almashtirgich, rezistor, ampermetr, voltmetr; p–n o'tish
//    kesimi), yarim/to'liq davrli to'g'rilagich (transformator, diod ko'prigi, kondensator, ossillograf),
//    tranzistor kalit va kuchaytirgich (potensiometr, baza va kollektor toklari, lampa).
// Sahna — 360° 3D laboratoriya (semi-lab-3d.js); panjara modeli 2D dunyo birliklarida (520×300). Fizika: semi-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-n3";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261124-n3";
import { createSemiLab } from "./semi-lab-3d.js?v=20261125-n4";
import { tempRGB } from "./bb-physics.js";
import * as P from "./semi-physics.js";
import { drawRT, drawPhoto, drawCarriers, drawVAX, drawWave, drawTr, lastFrame, fI, fR, p10 } from "./semi-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "rt", kind: { rt: "thermo", pn: "vax" }, view: { thermo: "R", photo: "R", lat: "n", vax: "I", rect: "u", tr: "I" }, hover: null, speed: 5 };
const rt = { T: 20, level: 1, heat: true, hist: [], t: 0, lampOn: true, d: 30, room: 150 };
const lat = { mat: "si", dope: "i", logN: 21, T: 300, field: false, atoms: [], e: [], h: [], fx: [], acc: 0, flow: 0 };
const dio = { type: "si", pol: 1, E: 2, T: 20, pts: [] };
const rec = { bridge: false, C: 0, R: 100, ph: 0, res: null };
const trs = { U: 1.5, Rb: 2000 };
const R_LIM = 101, UCC = 6, R_LAMP = 40;
let presetId = null;
let running = false;
let anim = 0;
const kind = () => (ui.mode === "lat" ? "lat" : ui.kind[ui.mode]);

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/* ------------------------------------------------------------------ 1a) Qizdirish */

function resetRT() { rt.T = 20; rt.t = 0; rt.hist = [{ T: 20, Rm: P.metalR(20), Rs: P.ntcR(20) }]; }
function stepRT(dt) {
  rt.t += dt; rt.T = P.bathStep(rt.T, dt, rt.heat ? rt.level : 0);
  const lastT = rt.hist.length ? rt.hist.at(-1).T : -99;
  if (Math.abs(rt.T - lastT) >= 5 || (rt.T >= 100 && lastT < 99.9)) { const T = Math.round(rt.T * 10) / 10; rt.hist.push({ T, Rm: P.metalR(T), Rs: P.ntcR(T) }); if (rt.hist.length > 60) rt.hist.shift(); }
}

/* ------------------------------------------------------------------ 1b) Yoritish */

const photoE = () => rt.room + (rt.lampOn ? P.illum(80, rt.d / 100) : 0);
/* ------------------------------------------------------------------ 2) Panjara */

const LC = 9, LR = 5, LX0 = 78, LDX = 45.5, LY0 = 74, LDY = 40;
const atomXY = (i) => [LX0 + (i % LC) * LDX, LY0 + Math.floor(i / LC) * LDY];
const BONDS = [];
for (let i = 0; i < LC * LR; i++) { const c0 = i % LC, r0 = Math.floor(i / LC); if (c0 < LC - 1) BONDS.push({ a: i, b: i + 1, h: true }); if (r0 < LR - 1) BONDS.push({ a: i, b: i + LC, h: false }); }
BONDS.forEach((b) => { const [x1, y1] = atomXY(b.a), [x2, y2] = atomXY(b.b); b.x = (x1 + x2) / 2; b.y = (y1 + y2) / 2; });
const NEIGH = BONDS.map((b, k) => BONDS.map((q, j) => (j !== k && (q.a === b.a || q.a === b.b || q.b === b.a || q.b === b.b) ? j : -1)).filter((j) => j >= 0));
const slotXY = (bi, sl) => { const b = BONDS[bi], d = sl ? 3.4 : -3.4; return b.h ? [b.x, b.y + d] : [b.x + d, b.y]; };
const LXMIN = 46, LXMAX = 474, LYMIN = 52, LYMAX = 256;

const latMat = () => P.MATS[lat.mat];
const latN = () => 10 ** lat.logN;
const latCond = () => P.conductivity(latMat(), lat.T, lat.dope === "n" ? latN() : 0, lat.dope === "p" ? latN() : 0);
const nDon = () => lat.atoms.filter((a) => a === "d").length, nAcc = () => lat.atoms.filter((a) => a === "a").length;
const vis = (x) => clamp(Math.round(2.5 * Math.log10(x / 1e15)), 0, 12);
const minority = () => { const k = latCond(); return vis(lat.dope === "n" ? k.p : lat.dope === "p" ? k.n : k.ni); };
const latI = () => (lat.field ? latCond().sigma * (4.5 / 0.01) * 1e-6 : 0);

function freeBondNear(i) { const opts = BONDS.map((b, k) => ((b.a === i || b.b === i) && !lat.h.some((h) => h.b === k) ? k : -1)).filter((k) => k >= 0); return opts.length ? opts[Math.floor(Math.random() * opts.length)] : -1; }
function addElectron(x, y) { const a = Math.random() * TAU, v = 30 * Math.sqrt(lat.T / 300); lat.e.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: Math.random() * 0.3, tgt: -1 }); }
function addHole(bi) { const sl = Math.random() < 0.5 ? 0 : 1, [x, y] = slotXY(bi, sl); lat.h.push({ b: bi, sl, x, y, fx: x, fy: y, k: 1, t: Math.random() * 0.5, busy: false }); }
function resetLattice(dopants = []) {
  lat.atoms = Array(LC * LR).fill("s"); lat.e = []; lat.h = []; lat.fx = [];
  dopants.forEach((i) => { lat.atoms[i] = lat.dope === "n" ? "d" : "a"; });
  if (lat.dope === "n") dopants.forEach((i) => { const [x, y] = atomXY(i); addElectron(x + 14, y - 10); });
  if (lat.dope === "p") dopants.forEach((i) => { const b = freeBondNear(i); if (b >= 0) addHole(b); });
  const m = minority();
  for (let k = 0; k < m; k++) generate(false);
}
function generate(flash = true) {
  const free = BONDS.map((_, k) => k).filter((k) => !lat.h.some((h) => h.b === k) && lat.atoms[BONDS[k].a] === "s" && lat.atoms[BONDS[k].b] === "s");
  if (!free.length) return;
  const bi = free[Math.floor(Math.random() * free.length)]; addHole(bi);
  const hh = lat.h.at(-1); addElectron(hh.x, hh.y);
  if (flash) lat.fx.push({ x: hh.x, y: hh.y, t: 0, kind: "gen" });
}
function toggleAtom(i) {
  if (lat.dope === "i") { flashStatus("Avval n- yoki p-tipni tanlang — so‘ng atomni bosing"); return; }
  const want = lat.dope === "n" ? "d" : "a", [x, y] = atomXY(i);
  if (lat.atoms[i] === want) {
    lat.atoms[i] = "s";
    const pool = lat.dope === "n" ? lat.e : lat.h; if (pool.length) { let best = 0, bd = 1e9; pool.forEach((p, k) => { const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = k; } }); pool.splice(best, 1); }
  } else {
    lat.atoms[i] = want;
    if (want === "d") addElectron(x + 14, y - 10); else { const b = freeBondNear(i); if (b >= 0) addHole(b); }
  }
  customized(); refresh();
}
function stepLat(dt) {
  const m = latMat(), mu = P.mobility(m, lat.T), vth = 34 * Math.sqrt(lat.T / 300), vdE = lat.field ? -26 * (mu.n / 0.135) : 0, hopRate = 1.2 + (lat.field ? 3 * Math.min(3, mu.p / 0.048) : 0);
  // erkin elektronlar
  for (const e of lat.e) {
    if (e.tgt >= 0) {
      const h = lat.h[e.tgt]; if (!h) { e.tgt = -1; continue; }
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy); if (d < 3) { e.dead = true; h.dead = true; lat.fx.push({ x: h.x, y: h.y, t: 0, kind: "rec" }); continue; }
      const v = Math.min(d / dt, 60); e.x += (dx / d) * v * dt; e.y += (dy / d) * v * dt; continue;
    }
    e.t -= dt; if (e.t <= 0) { const a = Math.random() * TAU; e.vx = Math.cos(a) * vth; e.vy = Math.sin(a) * vth; e.t = 0.18 + Math.random() * 0.3; }
    e.x += (e.vx + vdE) * dt; e.y += e.vy * dt;
    if (e.y < LYMIN) { e.y = LYMIN; e.vy = Math.abs(e.vy); } if (e.y > LYMAX) { e.y = LYMAX; e.vy = -Math.abs(e.vy); }
    if (lat.field) { if (e.x < LXMIN) { e.x = LXMAX - 2; e.y = LYMIN + Math.random() * (LYMAX - LYMIN); lat.flow++; } if (e.x > LXMAX) e.x = LXMAX; }
    else { if (e.x < LXMIN) { e.x = LXMIN; e.vx = Math.abs(e.vx); } if (e.x > LXMAX) { e.x = LXMAX; e.vx = -Math.abs(e.vx); } }
  }
  // kovaklar (bog'dan bog'ga sakraydi)
  for (const h of lat.h) {
    if (h.k < 1) { h.k = Math.min(1, h.k + dt / 0.22); const [tx, ty] = slotXY(h.b, h.sl); h.x = h.fx + (tx - h.fx) * h.k; h.y = h.fy + (ty - h.fy) * h.k; continue; }
    if (lat.e.some((e) => e.tgt >= 0 && lat.h[e.tgt] === h)) continue;
    h.t -= dt; if (h.t > 0) continue; h.t = (0.5 + Math.random()) / hopRate;
    const cur = BONDS[h.b];
    if (lat.field && cur.x > LXMAX - 40 && Math.random() < 0.5) { h.dead = true; const left = BONDS.map((b, k) => (b.x < LX0 + 20 && !lat.h.some((q) => q.b === k) ? k : -1)).filter((k) => k >= 0 && lat.atoms[BONDS[k].a] === "s"); if (left.length) addHole(left[Math.floor(Math.random() * left.length)]); continue; }
    const opts = NEIGH[h.b].filter((k) => !lat.h.some((q) => q.b === k)); if (!opts.length) continue;
    const w = opts.map((k) => Math.exp((lat.field ? 0.07 : 0) * (BONDS[k].x - cur.x))), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot, pick = opts[0]; for (let j = 0; j < opts.length; j++) { r -= w[j]; if (r <= 0) { pick = opts[j]; break; } }
    h.fx = h.x; h.fy = h.y; h.b = pick; h.sl = Math.random() < 0.5 ? 0 : 1; h.k = 0;
  }
  // rekombinatsiya / generatsiya
  const keep = lat.h.map((h) => !h.dead);
  lat.e.forEach((e) => { if (e.tgt >= 0 && !keep[e.tgt]) e.tgt = -1; });
  const idx = []; let j = 0; lat.h.forEach((h, k) => { idx[k] = h.dead ? -1 : j; if (!h.dead) j++; });
  lat.e = lat.e.filter((e) => !e.dead); lat.e.forEach((e) => { if (e.tgt >= 0) e.tgt = idx[e.tgt]; });
  lat.h = lat.h.filter((h) => !h.dead);
  lat.acc += dt;
  if (lat.acc > 0.35) {
    lat.acc = 0;
    const want = minority(), pairs = lat.dope === "n" ? lat.e.length - nDon() : lat.dope === "p" ? lat.h.length - nAcc() : Math.min(lat.e.length, lat.h.length);
    if (pairs < want && Math.random() < 0.8) generate();
    else if (pairs > want && lat.e.length && lat.h.length) {
      const freeE = lat.e.filter((e) => e.tgt < 0); const e = freeE[Math.floor(Math.random() * freeE.length)];
      if (e) { let best = -1, bd = 1e9; lat.h.forEach((h, k) => { if (lat.e.some((q) => q.tgt === k)) return; const d = dist(h.x, h.y, e.x, e.y); if (d < bd) { bd = d; best = k; } }); if (best >= 0) e.tgt = best; }
    }
  }
  lat.fx.forEach((f) => { f.t += dt; }); lat.fx = lat.fx.filter((f) => f.t < 0.7);
}

/* ------------------------------------------------------------------ 3a) Diod VAX */

const dObj = () => P.DIODES[dio.type];
const dTK = () => dio.T + P.T0;
const dEmax = () => (dio.pol < 0 ? 30 : 5);
const dCirc = () => P.diodeCircuit(dObj(), dio.pol * dio.E, R_LIM, dTK());
const RANGES_MA = [1, 2, 5, 10, 20, 50, 100], RANGES_UA = [1, 2, 5, 10, 20, 50, 100];
const pickR = (list, v) => list.find((r) => r >= v * 1.04) || list.at(-1);
const mOpt = (r) => { const m = Math.round(r / 10 ** Math.floor(Math.log10(r) + 1e-9)), two = m === 2; return { max: r, ticks: two ? 4 : 5, digits: r < 5 && m !== 2 ? 1 : 0 }; };

/* ------------------------------------------------------------------ 3b) To'g'rilagich */

function recCalc() { rec.res = P.rectifier({ Um: 12 * Math.SQRT2, R: rec.R, C: rec.C * 1e-6, bridge: rec.bridge, N: 300 }); }
function recAt(ph) { const r = rec.res, i = clamp(Math.round((ph / 2) * (r.t.length - 1)), 0, r.t.length - 1); return { u: r.uin[i], v: r.uout[i], id: r.id[i] }; }
/* ------------------------------------------------------------------ 3c) Tranzistor */

const trCalc = () => P.transistor(trs.U, trs.Rb, UCC, R_LAMP);
/* ------------------------------------------------------------------ Sahna (3D) */

const scene = createSemiLab();
/** Joriy tajriba holati sahna uchun (fizika shu yerda hisoblanadi, sahna faqat chizadi). */
function frameCfg() {
  const k = kind();
  if (k === "thermo") {
    const T = rt.T, [rs, us] = fR(P.ntcR(T));
    return { mode: k, anim, R: { T, level: rt.level, power: rt.heat ? rt.level : 0, Rm: `${fmt(P.metalR(T), 2)} Ω`, Rs: `${rs} ${us}`, nfree: clamp(Math.round(1 + 6 * Math.log10(P.ntcR(20) / P.ntcR(T))), 1, 11) } };
  }
  if (k === "photo") { const E = photoE(), [rv, ru] = fR(P.ldrR(E)); return { mode: k, anim, F: { d: rt.d, lampOn: rt.lampOn, room: rt.room, E, R: `${rv} ${ru}` } }; }
  if (k === "lat") {
    const holeAt = new Set(lat.h.filter((h) => h.k >= 1).map((h) => `${h.b}:${h.sl}`));
    return { mode: k, anim, L: { sym: latMat().sym, dope: lat.dope, T: lat.T, field: lat.field, atoms: lat.atoms, e: lat.e, h: lat.h, fx: lat.fx, bonds: BONDS, pos: atomXY, slot: slotXY, holeAt, I: fI(latI()) } };
  }
  if (k === "vax") {
    const d = dObj(), r = dCirc(), rev = dio.pol < 0, Ia = Math.abs(r.I);
    const rA = rev ? pickR(RANGES_UA, Ia * 1e6) : pickR(RANGES_MA, r.I * 1e3), vA = rev ? Ia * 1e6 : r.I * 1e3, sym = rev ? "μA" : "mA";
    const vmax = rev ? 30 : d.led ? 5 : 1, Uv = Math.abs(r.U);
    return { mode: k, anim, V: {
      E: dio.E, Emax: dEmax(), rev, on: Ia > 1e-6, I: r.I, led: d.led || null, glass: dio.type === "ge", short: d.short,
      Am: { frac: vA / rA, sym, text: `${fmt(vA, vA < 10 ? 2 : 1)} ${sym} · 0–${rA} ${sym}`, short: `${fmt(vA, vA < 10 ? 2 : 1)} ${sym}` },
      Vm: { frac: Uv / vmax, text: `${fmt(Uv, 2)} V · 0–${vmax} V`, short: `${fmt(Uv, 2)} V` },
      dep: P.depletion(d, r.U - r.I * d.Rs), flux: r.I > 1e-7 ? clamp(Math.log10(r.I / 1e-7) / 5, 0, 1) : 0,
    } };
  }
  if (k === "rect") {
    const r = rec.res, at = recAt(rec.ph);
    return { mode: k, anim, Q: { bridge: rec.bridge, C: rec.C, R: rec.R, uin: r.uin, uout: r.uout, i: clamp(Math.round((rec.ph / 2) * (r.t.length - 1)), 0, r.t.length - 1), u: at.u, v: at.v, cond: at.id > 0.002, pos: at.u > 0 } };
  }
  const t = trCalc(), br = clamp((t.Ic * t.Ic * R_LAMP) / 0.9, 0, 1.3), T = 300 + 2400 * Math.pow(Math.min(1, br), 0.35);
  return { mode: k, anim, T: { U: trs.U, f: trs.U / UCC, Ib: t.Ib, Ic: t.Ic, cut: t.cut, sat: t.sat, onB: t.Ib > 1e-6, onC: t.Ic > 1e-5, br, rgb: tempRGB(Math.max(1000, T)), Rb: trs.Rb, RbText: trs.Rb >= 1000 ? `${fmt(trs.Rb / 1000, trs.Rb % 1000 ? 1 : 0)} kΩ` : `${trs.Rb} Ω` } };
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), (ctx, st) => scene.draw(ctx, st, frameCfg()), { height: detailedStageHeight });

/* ------------------------------------------------------------------ Grafik */

function latDop() { return { Nd: lat.dope === "n" ? latN() : 0, Na: lat.dope === "p" ? latN() : 0 }; }
function drawGraphCanvas(ctx, gs) {
  const k = kind(), v = ui.view[k];
  if (k === "thermo") return drawRT(ctx, gs, { view: v, hist: rt.hist, T: rt.T, hover: ui.hover });
  if (k === "photo") return drawPhoto(ctx, gs, { E: photoE(), hover: ui.hover });
  if (k === "lat") return drawCarriers(ctx, gs, { view: v, mat: latMat(), ...latDop(), T: lat.T, hover: ui.hover });
  if (k === "vax") { const r = dCirc(); return drawVAX(ctx, gs, { d: dObj(), T: dTK(), pts: dio.pts, U: r.U, I: r.I, hover: ui.hover }); }
  if (k === "rect") return drawWave(ctx, gs, { r: rec.res, ph: rec.ph / 2, hover: ui.hover });
  const t = trCalc(); return drawTr(ctx, gs, { Ucc: UCC, Rk: R_LAMP, Ib: t.Ib, Ic: t.Ic, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  thermo: [["R", "R(t)", "Qarshilikning temperaturaga bog‘liqligi", "Nuqtalar — multimetrlar ko‘rsatishi (har 5 °C da), shtrix — nazariya. Misning qarshiligi qizdirilganda chiziqli ortadi (α = 0,0043 1/K), termorezistorniki esa keskin kamayadi: 20 °C dan 100 °C gacha ~15 marta."],
    ["ln", "ln R(1/T)", "Termorezistor: ln R ning 1/T ga bog‘liqligi", "Yarimo‘tkazgichda R ∝ e^(B/T): ln R ning 1/T ga bog‘liqligi to‘g‘ri chiziq. Qiyalik B = E/(2k) dan zaryad tashuvchilarni hosil qilish energiyasi E ≈ 0,68 eV topiladi."]],
  photo: [["R", "R(E)", "Fotorezistor qarshiligining yoritilganlikka bog‘liqligi", "Ikkala o‘q logarifmik. Yorug‘lik fotonlari bog‘lardagi elektronlarni uzib, elektron-kovak juftlarini hosil qiladi — qarshilik qorong‘idagi 1 MΩ dan yorug‘da bir necha yuz Ω gacha kamayadi."]],
  lat: [["n", "n(T)", "Zaryad tashuvchilar konsentratsiyasi", "Logarifmik shkala. Sof yarimo‘tkazgichda n = p = nᵢ temperatura bilan eksponensial ortadi. Aralashmali yarimo‘tkazgichda asosiy tashuvchilar soni aralashma konsentratsiyasiga teng, asosiy bo‘lmaganlari n·p = nᵢ² dan topiladi; juda qizdirilsa yana xususiy bo‘lib qoladi."],
    ["s", "σ(T)", "Solishtirma o‘tkazuvchanlik", "σ = e(nμₙ + pμₚ). Aralashma qo‘shilsa o‘tkazuvchanlik millionlab marta ortadi. Aralashmali sohada qizdirilganda σ biroz kamayadi (harakatchanlik kamayadi), yuqori temperaturada esa xususiy o‘tkazuvchanlik ustun keladi."]],
  vax: [["I", "I(U)", "Diodning volt-amper xarakteristikasi", "O‘ngda — to‘g‘ri yo‘nalish (mA), chapda — teskari yo‘nalish (μA yoki nA): masshtablar har xil! Nuqtalar — siz yozgan o‘lchashlar, shtrix — nazariya. To‘g‘ri yo‘nalishda tok ~0,5 V (Ge da ~0,2 V) dan keyin keskin ortadi, teskari yo‘nalishda deyarli o‘tmaydi."]],
  rect: [["u", "u(t)", "Kuchlanish ossillogrammasi", "Sariq shtrix — transformatordan kirayotgan o‘zgaruvchan kuchlanish, ko‘k — yuklamadagi kuchlanish, yashil — uning o‘rtacha qiymati. Kondensator diod yopiq paytda yuklamani o‘zi ta’minlaydi va pulsatsiyani kamaytiradi."]],
  tr: [["I", "Kollektor toki", "Kollektor tokining baza tokiga bog‘liqligi", "Kuchaytirish sohasida kollektor toki baza tokidan β = 160 marta katta. Baza toki yetarlicha katta bo‘lsa, kollektor toki lampa qarshiligi bilan cheklanadi (to‘yinish) — tranzistor ochiq kalit kabi ishlaydi."]],
};
function setTabs() {
  const k = kind(), box = $("[data-tabs]"), tabs = TABS[k], cur = ui.view[k], t = tabs.find((x) => x[0] === cur) || tabs[0];
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === t[0]}">${name}</button>`).join("");
  box.hidden = tabs.length < 2;
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[kind()] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.inv(p.x) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const uR = (R) => { const [v, un] = fR(R); return u(v, un); };
const uI = (I) => { const [v, un] = fI(I); return u(v, un); };
const sciH = (v) => { if (!(v > 0)) return "0"; const e = Math.floor(Math.log10(v)), m = v / 10 ** e; return `${fmt(m, 2)}·${p10(e)}`; };

function updateReadouts() {
  const k = kind();
  if (k === "thermo") {
    const T = rt.T, Rm = P.metalR(T), Rs = P.ntcR(T);
    setRO("r1", "Suv temperaturasi <i>t</i>", u(fmt(T, 1), "°C"), T >= 99.9 ? "suv qaynamoqda" : rt.heat && rt.level > 0 ? `plitka ${fmt(rt.level * 100, 0)} % — isimoqda` : "plitka o‘chiq — sovimoqda", T >= 99.9 ? "red" : "orange");
    setRO("r2", "Mis g‘altak <i>R</i><sub>m</sub>", uR(Rm), `R₂₀ = 10 Ω; ${fmt(Rm / 10, 3)}·R₂₀ (+${fmt((Rm / 10 - 1) * 100, 1)} %)`, "blue");
    setRO("r3", "Termorezistor <i>R</i><sub>t</sub>", uR(Rs), `${fmt(Rs / P.ntcR(20), 3)}·R₂₀ (${fmt((1 - Rs / P.ntcR(20)) * 100, 0)} % kamaydi)`, "orange");
    setRO("r4", "Misning temperatura koeffitsiyenti", u(fmt(((Rm - 10) / (10 * Math.max(0.01, T - 20))) * 1000, 2), "·10⁻³ 1/K"), "α = (R − R₂₀)/(R₂₀Δt)");
    setRO("r5", "Termorezistor: erkin tashuvchilar", u(`×${fmt(P.ntcR(20) / Rs, Rs > P.ntcR(20) / 10 ? 2 : 1)}`, ""), "20 °C dagiga nisbatan (σ ∝ n, n ∝ 1/R)", "green");
    setRO("r6", "Yozilgan nuqtalar", u(String(rt.hist.length), "ta"), `vaqt ${Math.floor(rt.t / 60)} min ${Math.floor(rt.t % 60)} s (tezlik ${ui.speed}×)`);
  } else if (k === "photo") {
    const E = photoE(), R = P.ldrR(E);
    setRO("r1", "Yoritilganlik <i>E</i> (luksmetr)", u(fmt(E, E < 10 ? 1 : 0), "lk"), rt.lampOn ? `lampadan E = I/r² = 80/${fmt((rt.d / 100) ** 2, 4)} + xona ${fmt(rt.room, rt.room < 1 ? 1 : 0)} lk` : "lampa o‘chiq — faqat xona yorug‘ligi", "orange");
    setRO("r2", "Fotorezistor qarshiligi <i>R</i>", uR(R), `qorong‘ida 1 MΩ; ${fmt(1e6 / R, 0)} marta kichik`, "blue");
    setRO("r3", "Lampagacha masofa <i>r</i>", u(fmt(rt.d, 0), "cm"), "masofa 2 marta oshsa, E 4 marta kamayadi");
    setRO("r4", "O‘tkazuvchanlik <i>G</i> = 1/<i>R</i>", u(fmt((1 / R) * 1e6, (1 / R) * 1e6 < 10 ? 2 : 0), "μS"), "fotonlar hosil qilgan juftlar soniga proporsional", "green");
    setRO("r5", "1,5 V batareyadan tok", uI(1.5 / R), "agar fotorezistor batareyaga ulansa: I = U/R");
    setRO("r6", "Qayerda ishlatiladi", "avtomat", "ko‘cha chiroqlari, kamera eksponometri, turniket");
  } else if (k === "lat") {
    const q = latCond(), m = latMat(), I = latI();
    setRO("r1", "Xususiy konsentratsiya <i>n</i>ᵢ", u(sciH(q.ni), "m⁻³"), `${m.name}, T = ${fmt(lat.T, 0)} K; taqiqlangan zona ${fmt(m.Eg, 2)} eV`);
    setRO("r2", "Elektronlar <i>n</i>", u(sciH(q.n), "m⁻³"), lat.dope === "n" ? "asosiy tashuvchilar (donor — fosfor)" : lat.dope === "p" ? "asosiy bo‘lmagan tashuvchilar" : "n = p = nᵢ", "blue");
    setRO("r3", "Kovaklar <i>p</i>", u(sciH(q.p), "m⁻³"), lat.dope === "p" ? "asosiy tashuvchilar (akseptor — bor)" : lat.dope === "n" ? "asosiy bo‘lmagan tashuvchilar" : "har bir uzilgan bog‘ — bitta kovak", "red");
    setRO("r4", "Solishtirma o‘tkazuvchanlik σ", u(sciH(q.sigma), "S/m"), `ρ = 1/σ = ${sciH(1 / q.sigma)} Ω·m; elektron ulushi ${fmt((q.sn / q.sigma) * 100, 0)} %`, "green");
    setRO("r5", "Namunadagi tok <i>I</i>", lat.field ? uI(I) : u("0", "A"), lat.field ? `U = 4,5 V, R = ${fR(4.5 / I).join(" ")}` : "batareya uzilgan", lat.field ? "orange" : "");
    setRO("r6", "Harakatchanlik μ", u(`${fmt(q.mu.n * 1e4, 0)} | ${fmt(q.mu.p * 1e4, 0)}`, "cm²/(V·s)"), "elektron | kovak; dreyf tezligi v = μE");
  } else if (k === "vax") {
    const d = dObj(), r = dCirc(), n = dio.pts.length;
    setRO("r1", "Diodagi kuchlanish <i>U</i>", u(fmt(r.U, Math.abs(r.U) < 2 ? 3 : 2), "V"), dio.pol > 0 ? "to‘g‘ri yo‘nalish (voltmetr)" : "teskari yo‘nalish (voltmetr)", "blue");
    setRO("r2", "Tok kuchi <i>I</i>", uI(r.I), dio.pol > 0 ? `I = (E − U)/R = (${fmt(dio.E, 2)} − ${fmt(r.U, 2)})/100` : "teskari tok — asosiy bo‘lmagan tashuvchilar oqimi", "orange");
    setRO("r3", "Statik qarshilik <i>U</i>/<i>I</i>", Math.abs(r.I) > 1e-12 ? uR(Math.abs(r.U / r.I)) : u("∞", "Ω"), dio.pol > 0 ? "to‘g‘ri yo‘nalishda kichik" : "teskari yo‘nalishda juda katta");
    setRO("r4", "Differensial qarshilik Δ<i>U</i>/Δ<i>I</i>", uR(P.diffR(d, r.U, dTK())), "VAX qiyaligiga teskari");
    setRO("r5", "To‘g‘rilash koeffitsiyenti", u(sciH(P.diodeI(d, 1, dTK()) / Math.abs(P.diodeI(d, -1, dTK()))), ""), "I(+1 V)/|I(−1 V)| — diod tokni bir tomonga o‘tkazadi", "green");
    setRO("r6", "Jadvalda", u(String(n), "nuqta"), n ? `oxirgisi: ${fmt(dio.pts.at(-1).U, 2)} V; ${fI(dio.pts.at(-1).I).join(" ")}` : "«Nuqtani yozish» tugmasini bosing", n ? "green" : "");
    if (d.led) setRO("r5", "Foton energiyasi <i>hν</i>", u(fmt(P.photonEV(d.nm), 2), "eV"), `λ = ${d.nm} nm; eU ≈ hν — LED ${fmt(P.photonEV(d.nm), 1)} V atrofida yona boshlaydi`, "green");
  } else if (k === "rect") {
    const r = rec.res;
    setRO("r1", "Kirish (transformator)", u("12", "V"), `ta’sir etuvchi qiymat; amplituda ${fmt(12 * Math.SQRT2, 1)} V, 50 Hz`, "orange");
    setRO("r2", "Chiqishning o‘rtacha qiymati", u(fmt(r.Uavg, 2), "V"), rec.C ? "kondensator bilan" : `ideal diodda ${fmt(rec.bridge ? P.avgFull(17) : P.avgHalf(17), 2)} V (${rec.bridge ? "2Uₘ/π" : "Uₘ/π"})`, "blue");
    setRO("r3", "Maksimal kuchlanish", u(fmt(r.Umax, 2), "V"), `Uₘ − ${rec.bridge ? "2" : "1"}·0,7 V (diodlardagi kuchlanish)`);
    setRO("r4", "Pulsatsiya Δ<i>U</i>", u(fmt(r.ripple, 2), "V"), rec.C ? `taxminan U/(${rec.bridge ? "2" : ""}fRC) = ${fmt(P.rippleEst(r.Umax, 50, rec.R, rec.C * 1e-6, rec.bridge), 2)} V` : "kondensatorsiz — to‘liq pulsatsiya", rec.C ? "green" : "red");
    setRO("r5", "Yuklama toki (o‘rtacha)", uI(r.Uavg / rec.R), `I = U/R, R = ${fmt(rec.R, 0)} Ω`);
    setRO("r6", "Pulsatsiya chastotasi", u(rec.bridge ? "100" : "50", "Hz"), rec.bridge ? "har yarim davrda bir impuls" : "faqat musbat yarim davrlar o‘tadi");
  } else {
    const t = trCalc(), P_l = t.Ic * t.Ic * R_LAMP;
    setRO("r1", "Baza kuchlanishi (potensiometr)", u(fmt(trs.U, 2), "V"), t.cut ? "0,65 V dan kichik — baza-emitter o‘tishi yopiq" : "baza toki = (U − 0,65 V)/R");
    setRO("r2", "Baza toki <i>I</i><sub>B</sub>", uI(t.Ib), "kichik tok — boshqaruvchi", "blue");
    setRO("r3", "Kollektor toki <i>I</i><sub>K</sub>", uI(t.Ic), t.sat ? `lampa bilan cheklangan: (6 − 0,2)/40 = ${fmt(((UCC - 0.2) / R_LAMP) * 1000, 0)} mA` : `β · baza toki = 160 · ${fI(t.Ib).join(" ")}`, "orange");
    setRO("r4", "Tok kuchaytirish koeffitsiyenti", u(t.Ib > 0 ? fmt(t.gain, 0) : "—", ""), t.sat ? "to‘yinishda kollektor/baza toklari nisbati β dan kichik" : `β = ${P.TRANSISTOR.beta}`, "green");
    setRO("r5", "Kollektor–emitter kuchlanishi", u(fmt(t.Uce, 2), "V"), t.sat ? "to‘yinish: tranzistor deyarli qisqa tutashgan" : t.cut ? "yopiq: barcha kuchlanish tranzistorda" : "kuchaytirish rejimi");
    setRO("r6", "Lampa quvvati", u(fmt(P_l, 2), "W"), `nominal ~0,9 W; emitter toki ${fI(t.Ie).join(" ")}`, P_l > 0.3 ? "orange" : "");
  }
}
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"), k = kind(); let t, tone = "blue";
  if (k === "thermo") { t = rt.T >= 99.9 ? "Suv qaynamoqda — temperatura o‘zgarmaydi" : rt.heat && rt.level > 0 ? `Suv isimoqda (${ui.speed}×)` : "Plitka o‘chiq"; tone = rt.T >= 99.9 ? "red" : rt.heat ? "orange" : ""; }
  else if (k === "photo") { const E = photoE(); t = E > 500 ? "Kuchli yoritilgan — qarshilik kichik" : E > 20 ? "O‘rtacha yoritilganlik" : "Qorong‘i — qarshilik katta"; tone = E > 500 ? "orange" : E > 20 ? "blue" : ""; }
  else if (k === "lat") { t = lat.field ? "Tok o‘tmoqda: elektronlar «+» ga, kovaklar «−» ga" : "Batareya uzilgan — tartibsiz issiqlik harakati"; tone = lat.field ? "orange" : ""; }
  else if (k === "vax") { const r = dCirc(); t = dio.pol < 0 ? "Teskari yo‘nalish — diod yopiq" : r.I > 1e-3 ? "To‘g‘ri yo‘nalish — diod ochiq" : "To‘g‘ri yo‘nalish — tok hali kichik"; tone = dio.pol < 0 ? "red" : r.I > 1e-3 ? "green" : ""; if (dObj().led && r.I > 0.03) { t = "LED nominal tokidan (20 mA) oshdi!"; tone = "red"; } }
  else if (k === "rect") { t = rec.bridge ? "To‘liq davrli to‘g‘rilagich" : "Yarim davrli to‘g‘rilagich"; tone = "orange"; }
  else { const s = trCalc(); t = s.cut ? "Tranzistor yopiq — lampa o‘chiq" : s.sat ? "Tranzistor to‘liq ochiq — lampa yonmoqda" : "Kuchaytirish: kollektor toki baza tokidan β marta katta"; tone = s.cut ? "" : s.sat ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2200; }

let lastExplain = "";
function updateExplain() {
  const p = [], k = kind();
  if (k === "thermo") {
    p.push("<p><b>Metallda</b> erkin elektronlar juda ko‘p (har bir atomga ~1 ta) va ularning soni temperaturaga bog‘liq emas. Qizdirilganda kristall panjara ionlari kuchliroq tebranadi, elektronlar ularga tez-tez urilib, tartibli harakati qiyinlashadi — <b>qarshilik ortadi</b>: R = R₀(1 + αΔt).</p>");
    p.push("<p><b>Yarimo‘tkazgichda</b> elektronlar atomlar orasidagi kovalent bog‘larda ushlanib turadi; xona temperaturasida erkin elektronlar juda kam. Qizdirilganda issiqlik harakati energiyasi bog‘larni uza boshlaydi — erkin elektronlar va kovaklar soni eksponensial ortadi va <b>qarshilik keskin kamayadi</b>. Termorezistorlar shu xossa asosida termometr va temperatura datchiklari sifatida ishlatiladi.</p>");
    if (rt.T > 60) p.push(`<p>Hozir ${fmt(rt.T, 0)} °C: mis qarshiligi ${fmt((P.metalR(rt.T) / 10 - 1) * 100, 0)} % ortdi, termorezistorniki esa ${fmt(P.ntcR(20) / P.ntcR(rt.T), 1)} marta kamaydi. Plitkani o‘chirib, sovishini kuzating — jarayon qaytuvchan.</p>`);
  } else if (k === "photo") {
    p.push("<p>Yarimo‘tkazgichdagi bog‘ni faqat issiqlik emas, <b>yorug‘lik</b> ham uzishi mumkin: energiyasi taqiqlangan zona kengligidan katta bo‘lgan foton bog‘dagi elektronni urib chiqaradi va elektron-kovak jufti hosil bo‘ladi. Bu <b>ichki fotoeffekt</b>. Yorug‘lik qancha kuchli bo‘lsa, juftlar shuncha ko‘p, qarshilik shuncha kichik.</p>");
    p.push(`<p>Lampani yaqinlashtiring: yoritilganlik E = I/r² — masofa 2 marta kamaysa, 4 marta ortadi. Hozir E = ${fmt(photoE(), 0)} lk, R = ${fR(P.ldrR(photoE())).join(" ")}. Xonani qorong‘i qilib, lampani o‘chiring — qarshilik megaomga yetadi.</p>`);
  } else if (k === "lat") {
    const m = latMat(), q = latCond();
    p.push(`<p>${m.name} atomining tashqi qobig‘ida 4 ta valent elektron bor; kristallda har bir atom 4 ta qo‘shnisi bilan juft elektronli <b>kovalent bog‘</b> hosil qiladi. Issiqlik harakati ba’zi bog‘larni uzadi: bo‘shagan elektron erkin bo‘ladi (ko‘k), uning o‘rnida musbat zaryadli <b>kovak</b> qoladi (qizil halqa). Qo‘shni bog‘dagi elektron kovakka o‘tsa, kovak boshqa joyga ko‘chadi — xuddi musbat zaryad harakatlanayotgandek.</p>`);
    if (lat.dope === "n") p.push("<p><b>n-tip</b>: 5 valentli fosfor atomining 4 ta elektroni bog‘ hosil qiladi, 5-elektroni ortiqcha va oson ajraladi (fosfor — <b>donor</b>, o‘zi musbat ionga aylanadi). Asosiy tashuvchilar — elektronlar.</p>");
    else if (lat.dope === "p") p.push("<p><b>p-tip</b>: 3 valentli bor atomiga bitta bog‘ uchun elektron yetishmaydi — u qo‘shni bog‘dan elektronni tortib oladi (bor — <b>akseptor</b>, manfiy ionga aylanadi), u yerda kovak paydo bo‘ladi. Asosiy tashuvchilar — kovaklar.</p>");
    else p.push(`<p>Sof (xususiy) yarimo‘tkazgichda elektronlar va kovaklar soni teng: n = p = nᵢ = ${sciH(q.ni)} m⁻³. Bu ${m.sym} atomlari sonidan (5·10²⁸ m⁻³) milliardlab marta kam — shuning uchun sof yarimo‘tkazgich yomon o‘tkazadi. Temperaturani oshiring.</p>`);
    p.push(lat.field ? "<p>Batareya ulangan: elektr maydon elektronlarni «+» kontaktga, kovaklarni «−» kontaktga suradi. Tok ikkala turdagi tashuvchilar harakatidan iborat.</p>" : "<p>Batareyani ulang: tartibsiz harakatga maydon yo‘nalishidagi dreyf qo‘shiladi.</p>");
  } else if (k === "vax") {
    const d = dObj(), r = dCirc();
    p.push("<p>Diod — p va n tipli yarimo‘tkazgichlar tutashgan joy (<b>p–n o‘tish</b>). Chegarada elektronlar va kovaklar bir-biriga diffuziyalanib rekombinatsiyalanadi, tashuvchilardan xoli <b>kambag‘allashgan qatlam</b> va uning ichki maydoni hosil bo‘ladi (yuqoridagi kesim).</p>");
    p.push(dio.pol > 0 ? `<p><b>To‘g‘ri yo‘nalishda</b> (p ga «+») tashqi maydon ichki maydonga qarshi: qatlam torayadi, asosiy tashuvchilar o‘tishdan oqib o‘tadi — tok tez ortadi. Hozir U = ${fmt(r.U, 3)} V, I = ${fI(r.I).join(" ")}.</p>` : `<p><b>Teskari yo‘nalishda</b> qatlam kengayadi va asosiy tashuvchilarni o‘tkazmaydi. Faqat issiqlik hosil qilgan asosiy bo‘lmagan tashuvchilar kichik teskari tok beradi: ${fI(r.I).join(" ")}. ${dio.type === "ge" ? "Germaniyda u kremniydagidan ming marta katta va temperatura bilan tez ortadi." : ""}</p>`);
    if (d.led) p.push(`<p><b>Yorug‘lik diodida</b> o‘tishdan o‘tgan elektronlar kovaklar bilan rekombinatsiyalanib, energiyasini foton sifatida chiqaradi: hν ≈ E<sub>g</sub> (taqiqlangan zona kengligi). Shuning uchun qizil LED ~1,8 V da, ko‘k LED ~2,8 V da yona boshlaydi.</p>`);
  } else if (k === "rect") {
    p.push(rec.bridge ? "<p><b>Diod ko‘prigi</b>: musbat yarim davrda D1 va D4, manfiy yarim davrda D2 va D3 ochiq (sahnada yorishadi). Ikkala holatda ham yuklamadan tok bir xil yo‘nalishda o‘tadi — ikkala yarim to‘lqin ham ishlatiladi.</p>" : "<p><b>Bitta diod</b>: faqat musbat yarim davrda ochiq, manfiy yarim davrda tok o‘tmaydi. Yuklamada bir yo‘nalishli, lekin uzlukli (pulsatsiyalanuvchi) kuchlanish hosil bo‘ladi.</p>");
    p.push(rec.C ? `<p>Kondensator kuchlanish cho‘qqisida zaryadlanadi va diod yopiq paytda yuklama orqali sekin razryadlanadi — kuchlanish tekislanadi. C va R qancha katta bo‘lsa, pulsatsiya shuncha kichik (τ = RC = ${fmt(rec.R * rec.C * 1e-3, 0)} ms).</p>` : "<p>Pulsatsiyani kamaytirish uchun yuklamaga parallel kondensator (filtr) ulang. Elektronika qurilmalari quvvat bloklari aynan shunday ishlaydi.</p>");
  } else {
    p.push("<p><b>Tranzistor</b> — ikkita p–n o‘tishli asbob (n-p-n): emitter, baza (juda yupqa) va kollektor. Baza-emitter o‘tishi to‘g‘ri yo‘nalishda ulansa, emitterdan bazaga o‘tgan elektronlarning deyarli hammasi yupqa bazadan o‘tib, kollektorga yetadi. Kichik baza toki katta kollektor tokini boshqaradi: <b>I<sub>K</sub> = βI<sub>B</sub></b>.</p>");
    p.push("<p>Potensiometrni burang: baza kuchlanishi 0,65 V dan kichik bo‘lsa tranzistor <b>yopiq</b>, undan keyin kollektor toki baza tokiga proporsional (<b>kuchaytirish</b>), baza toki katta bo‘lsa — <b>to‘yinish</b>: lampa to‘liq yonadi, tranzistor yopiq yoki ochiq <b>kalit</b> kabi ishlaydi. Kompyuter mikrosxemalarida milliardlab tranzistorlar aynan kalit sifatida ishlaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
const FORMULA = { thermo: "<small>Qarshilik</small> metall: R = R₀(1 + αΔt)", photo: "<small>Yoritilganlik</small> E = I/r²", lat: "<small>O‘tkazuvchanlik</small> σ = e(nμₙ + pμₚ)", vax: "<small>Diod</small> I = Iₛ(e^(eU/kT) − 1)", rect: "<small>To‘g‘rilagich</small> U = 2Uₘ/π", tr: "<small>Tranzistor</small> Iₖ = β·I(baza)" };
function updateFormula() { const html = FORMULA[kind()]; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); syncTools(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  const k = kind();
  if (k === "thermo") stepRT(dt * ui.speed);
  else if (k === "lat") stepLat(dt);
  else if (k === "rect") rec.ph = (rec.ph + dt * 0.5) % 2;
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); if (k === "thermo" || k === "rect") graph.render(); if (k === "thermo" || k === "lat") updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) refresh();
}
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || defaultFor(), false));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = Number(b.dataset.speedValue); syncSpeed(); refresh(); }));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speedValue) === ui.speed)));

/* ------------------------------------------------------------------ Boshqaruv */

// 1) Qarshilik
const HL = bindRange($("#hL"), $("#hLOut"), (v) => `${fmt(v, 0)} %`, (v) => { rt.level = v / 100; customized(); refresh(); });
const PD = bindRange($("#pD"), $("#pDOut"), (v) => `${fmt(v, 0)} cm`, (v) => { rt.d = v; customized(); refresh(); });
const roomSel = $("#pRoom");
roomSel.addEventListener("change", () => { rt.room = Number(roomSel.value); customized(); refresh(); });
$("[data-heat]").addEventListener("click", () => { rt.heat = !rt.heat; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });
$("[data-lamp]").addEventListener("click", () => { rt.lampOn = !rt.lampOn; customized(); refresh(); });
function syncRT() { HL.set(Math.round(rt.level * 100)); PD.set(rt.d); roomSel.value = String(rt.room); }

// 2) Panjara
const matSel = $("#lM");
matSel.addEventListener("change", () => { lat.mat = matSel.value; resetLattice(dopIdx()); customized(); refresh(); });
const LN = bindRange($("#lN"), $("#lNOut"), (v) => `${fmt(10 ** (v - Math.floor(v)), 1)}·${p10(Math.floor(v))} m⁻³`, (v) => { lat.logN = v; customized(); refresh(); });
const LT = bindRange($("#lT"), $("#lTOut"), (v) => `${fmt(v, 0)} K (${fmt(v - P.T0, 0)} °C)`, (v) => { lat.T = v; customized(); refresh(); });
const DEF_DOP = [11, 24, 33];
const dopIdx = () => lat.atoms.map((a, i) => (a !== "s" ? i : -1)).filter((i) => i >= 0);
document.querySelectorAll("[data-dope-value]").forEach((b) => b.addEventListener("click", () => { if (lat.dope === b.dataset.dopeValue) return; lat.dope = b.dataset.dopeValue; resetLattice(lat.dope === "i" ? [] : DEF_DOP); customized(); syncLat(); refresh(); }));
$("[data-field]").addEventListener("click", () => { lat.field = !lat.field; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });
function syncLat() {
  matSel.value = lat.mat; LN.set(lat.logN); LT.set(lat.T);
  document.querySelectorAll("[data-dope-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dopeValue === lat.dope)));
  $("[data-dopectl]").hidden = lat.dope === "i";
}

// 3a) Diod
const dSel = $("#dType");
dSel.innerHTML = Object.entries(P.DIODES).map(([id, d]) => `<option value="${id}">${d.name}</option>`).join("");
const DE = bindRange($("#dE"), $("#dEOut"), (v) => `${fmt(v, 2)} V`, (v) => { dio.E = v; customized(); refresh(); });
const DT = bindRange($("#dT"), $("#dTOut"), (v) => `${fmt(v, 0)} °C`, (v) => { dio.T = v; customized(); refresh(); });
dSel.addEventListener("change", () => { dio.type = dSel.value; dio.pts = []; customized(); refresh(); });
function setPol(p) { if (dio.pol === p) return; dio.pol = p; dio.E = Math.min(dio.E, dEmax()); if (p < 0 && dio.E < 1) dio.E = 10; customized(); syncDio(); refresh(); }
document.querySelectorAll("[data-pol-value]").forEach((b) => b.addEventListener("click", () => setPol(Number(b.dataset.polValue))));
$("[data-rec]").addEventListener("click", () => { const r = dCirc(); dio.pts.push({ U: r.U, I: r.I }); dio.pts.sort((a, b) => a.U - b.U); flashUntil = 0; refresh(); });
$("[data-clear]").addEventListener("click", () => { dio.pts = []; refresh(); });
function syncDio() {
  dSel.value = dio.type; const inp = $("#dE"); inp.max = String(dEmax()); inp.step = dio.pol < 0 ? "0.1" : "0.01"; DE.set(dio.E); DT.set(dio.T);
  document.querySelectorAll("[data-pol-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.polValue) === dio.pol)));
}

// 3b) To'g'rilagich
const rcSel = $("#rC");
rcSel.addEventListener("change", () => { rec.C = Number(rcSel.value); recCalc(); customized(); refresh(); });
const RR = bindRange($("#rR"), $("#rROut"), (v) => `${fmt(v, 0)} Ω`, (v) => { rec.R = v; recCalc(); customized(); refresh(); });
document.querySelectorAll("[data-rk-value]").forEach((b) => b.addEventListener("click", () => { rec.bridge = b.dataset.rkValue === "bridge"; recCalc(); customized(); syncRec(); refresh(); }));
function syncRec() { rcSel.value = String(rec.C); RR.set(rec.R); document.querySelectorAll("[data-rk-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.rkValue === "bridge") === rec.bridge))); }

// 3c) Tranzistor
const TU = bindRange($("#tU"), $("#tUOut"), (v) => `${fmt(v, 2)} V`, (v) => { trs.U = v; customized(); refresh(); });
const rbSel = $("#tRb");
rbSel.addEventListener("change", () => { trs.Rb = Number(rbSel.value); customized(); refresh(); });
function syncTr() { TU.set(trs.U); rbSel.value = String(trs.Rb); }

function syncTools() {
  const k = kind();
  $("[data-heat]").textContent = rt.heat ? "Plitkani o‘chirish" : "Plitkani yoqish";
  $("[data-lamp]").textContent = rt.lampOn ? "Lampani o‘chirish" : "Lampani yoqish";
  const fb = $("[data-field]"); fb.textContent = lat.field ? "Batareyani uzish" : "Batareyani ulash"; fb.setAttribute("aria-pressed", String(lat.field));
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== k; });
}

/* ------------------------------------------------------------------ Sahnada boshqarish (3D) */

const canvas = stage.canvas;
let drag = null;
/** Dasta uchi yoy bo'ylab: ekrandagi eng yaqin nuqta; yoyning bo'sh qismi orqali "sakrash" o'tkazib yuboriladi. */
function turn(pointAt, p) { const f = scene.lab.nearest(pointAt, 0, 1, p.x, p.y); if (Math.abs(f - drag.f) > 0.5) return null; drag.f = f; return f; }
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) {
    if (id === "btn") { lat.field = !lat.field; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); return; }
    if (id.startsWith("atom:")) { toggleAtom(Number(id.slice(5))); return; }
    if (id === "pol") { setPol(-dio.pol); return; }
    drag = { id, f: id === "heat" ? rt.level : id === "pot" ? trs.U / UCC : id === "knob" ? dio.E / dEmax() : 0 };
  },
  move(id, p) {
    if (!drag || drag.id !== id) return;
    if (id === "heat") { const f = turn(scene.heatAt, p); if (f == null) return; rt.level = Math.round(f * 100) / 100; HL.set(Math.round(rt.level * 100)); }
    else if (id === "pot") { const f = turn(scene.potAt, p); if (f == null) return; trs.U = Math.round(f * UCC * 100) / 100; TU.set(trs.U); }
    else if (id === "knob") { const f = turn(scene.knobAt, p); if (f == null) return; const st = dio.pol < 0 ? 0.1 : 0.01; dio.E = clamp(Math.round((f * dEmax()) / st) * st, 0, dEmax()); DE.set(dio.E); }
    else if (id === "lamp") { rt.d = clamp(Math.round(scene.lab.nearest(scene.lampAt, 10, 80, p.x, p.y)), 10, 80); PD.set(rt.d); }
    else return;
    customized(); refresh();
  },
  end() { if (!drag) return; drag = null; refresh(); },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setThermo = (level, speed = 5, view = "R") => () => { ui.kind.rt = "thermo"; Object.assign(rt, { level, heat: true }); ui.speed = speed; ui.view.thermo = view; resetRT(); };
const setPhoto = (d, room, lampOn = true) => () => { ui.kind.rt = "photo"; Object.assign(rt, { d, room, lampOn }); };
const setLat = (mat, dope, T, field, logN = 21, dops = DEF_DOP, view = "n") => () => { Object.assign(lat, { mat, dope, T, field, logN }); ui.view.lat = view; resetLattice(dope === "i" ? [] : dops); };
const setVax = (type, pol, E, T = 20, pts = null) => () => { ui.kind.pn = "vax"; Object.assign(dio, { type, pol, E, T }); dio.pts = pts ? pts.map((U) => { const d = P.DIODES[type], c0 = P.diodeCircuit(d, U, R_LIM, T + P.T0); return { U: c0.U, I: c0.I }; }).sort((a, b) => a.U - b.U) : []; };
const setRec = (bridge, C, R = 100) => () => { ui.kind.pn = "rect"; Object.assign(rec, { bridge, C, R, ph: 0 }); recCalc(); };
const setTr = (U, Rb = 2000) => () => { ui.kind.pn = "tr"; Object.assign(trs, { U, Rb }); };
const PRESETS = {
  heat: { mode: "rt", title: "Qizdirish: metall va termorezistor", lesson: "Plitka to‘liq quvvatda. Multimetrlarni kuzating: misning qarshiligi sekin ortadi, termorezistorniki esa tez kamayadi. 100 °C da mis +34 %, termorezistor ~15 marta kichik.", set: setThermo(1, 5) },
  half: { mode: "rt", title: "Plitka 30 %: muvozanat", lesson: "Plitka 30 % quvvatda: suv ~57 °C gacha isiydi va shu temperaturada to‘xtaydi (keltirilgan va yo‘qotilgan issiqlik tenglashadi).", set: setThermo(0.3, 20) },
  lnR: { mode: "rt", title: "ln R(1/T) — energiyani topish", lesson: "«ln R(1/T)» grafigi ochiq: termorezistor nuqtalari to‘g‘ri chiziqda yotadi. Qiyalikdan E = 2kB ≈ 0,68 eV — bog‘ni uzish uchun kerak bo‘lgan energiya.", set: setThermo(1, 20, "ln") },
  photo: { mode: "rt", title: "Fotorezistor: 30 cm", lesson: "Lampani sahnada suring va multimetr ko‘rsatishini kuzating. Luksmetr yoritilganlikni o‘lchaydi; grafikda nuqta R(E) egri chizig‘i bo‘ylab siljiydi.", set: setPhoto(30, 150) },
  near: { mode: "rt", title: "Lampa yaqin: 10 cm", lesson: "10 cm da yoritilganlik ~8000 lk (quyoshli kunga yaqin): fotorezistor qarshiligi bir necha yuz omgacha kamaydi.", set: setPhoto(10, 150) },
  dark: { mode: "rt", title: "Qorong‘i xona", lesson: "Xona qorong‘i, lampa o‘chiq: fotorezistor qarshiligi ~1 MΩ ga yaqin. Lampani yoqing — qarshilik ming marta kamayadi. Ko‘cha chiroqlari shu tamoyilda o‘zi yonadi.", set: setPhoto(50, 0.3, false) },
  pure: { mode: "lat", title: "Sof kremniy, 300 K", lesson: "Xona temperaturasida bog‘larning juda oz qismi uzilgan: bir nechta elektron-kovak jufti. Sariq chaqnash — bog‘ uzildi (generatsiya), yashil — elektron kovakka tushdi (rekombinatsiya).", set: setLat("si", "i", 300, false) },
  hot: { mode: "lat", title: "Sof kremniy qizdirilgan", lesson: "T = 450 K (177 °C): juftlar soni ming martalab ortdi, o‘tkazuvchanlik keskin oshdi. «σ(T)» grafigini oching.", set: setLat("si", "i", 450, true, 21, DEF_DOP, "s") },
  ge: { mode: "lat", title: "Germaniy, 300 K", lesson: "Germaniyda taqiqlangan zona kichik (0,66 eV): xona temperaturasida ham juftlar kremniydagidan ~2000 marta ko‘p.", set: setLat("ge", "i", 300, true) },
  ntype: { mode: "lat", title: "n-tip: fosfor qo‘shilgan", lesson: "Uchta fosfor atomi: har biri bitta ortiqcha elektron beradi va musbat ionga aylanadi. Batareya ulangan — elektronlar «+» kontaktga oqadi. Boshqa atomlarni bosib, yana fosfor qo‘shing.", set: setLat("si", "n", 300, true) },
  ptype: { mode: "lat", title: "p-tip: bor qo‘shilgan", lesson: "Bor atomlari qo‘shni bog‘dan elektron oladi — kovaklar paydo bo‘ladi va maydon yo‘nalishida «−» kontaktga siljiydi. Aslida bog‘dan bog‘ga elektronlar sakraydi, kovak esa teskari tomonga ko‘chadi.", set: setLat("si", "p", 300, true) },
  vaxSi: { mode: "pn", title: "Kremniy diod VAX", lesson: "Laboratoriya ishi: manba kuchlanishini 0 dan 5 V gacha oshirib boring va har safar «Nuqtani yozish» ni bosing. So‘ng teskari yo‘nalishga o‘tib, 0–30 V da takrorlang. Bir nechta nuqta allaqachon yozilgan.", set: setVax("si", 1, 2, 20, [0.4, 0.6, 0.8, 1, 1.5, 2]) },
  vaxGe: { mode: "pn", title: "Germaniy diod: teskari tok", lesson: "Germaniy diod teskari ulangan: teskari tok mikroamperlarda — kremniydagidan ~1000 marta katta. Diod temperaturasini 60 °C ga oshiring: teskari tok 16 marta ortadi.", set: setVax("ge", -1, 10, 20, [-2, -5, -10, -20]) },
  led: { mode: "pn", title: "Yorug‘lik diodi", lesson: "Qizil LED: ~1,7 V dan keyin yona boshlaydi. Diod ro‘yxatidan yashil va ko‘k LEDni tanlang — ular kattaroq kuchlanishda yonadi, chunki ularning fotoni energiyasi katta (hν ≈ eU).", set: setVax("red", 1, 4) },
  rhalf: { mode: "pn", title: "Yarim davrli to‘g‘rilagich", lesson: "Bitta diod: faqat musbat yarim to‘lqinlar o‘tadi. Ossillografda sariq — kirish, ko‘k — chiqish. O‘rtacha kuchlanish Uₘ/π ga yaqin.", set: setRec(false, 0) },
  bridge: { mode: "pn", title: "Diod ko‘prigi + kondensator", lesson: "To‘liq davrli to‘g‘rilagich 1000 μF filtr bilan: chiqishda deyarli o‘zgarmas kuchlanish (~15 V). Kondensatorni ajrating va farqni ko‘ring.", set: setRec(true, 1000) },
  trAmp: { mode: "pn", title: "Tranzistor: kuchaytirish", lesson: "Baza toki ~0,4 mA, kollektor toki β = 160 marta katta (~68 mA): lampa xira yonadi. Potensiometrni sekin burab, ikkala ampermetrni solishtiring.", set: setTr(1.5) },
  trSwitch: { mode: "pn", title: "Tranzistor: kalit", lesson: "Potensiometr 0 da — tranzistor yopiq, lampa o‘chiq. Uni oxirigacha burang: tranzistor to‘yinadi va lampa to‘liq yonadi. Kichik baza toki katta tokni yoqib-o‘chiradi.", set: setTr(0) },
};
const GROUPS = [["Metall va yarimo‘tkazgich", ["heat", "half", "lnR", "photo", "near", "dark"]], ["O‘tkazuvchanlik", ["pure", "hot", "ge", "ntype", "ptype"]], ["Diod va tranzistor", ["vaxSi", "vaxGe", "led", "rhalf", "bridge", "trAmp", "trSwitch"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { thermo: "Plitka dastasini aylantiring", photo: "Lampani optik skamya bo‘ylab suring", lat: "Atomni bosing — aralashma qo‘shing; kalitni bosing", vax: "Manba dastasini aylantiring, qutb almashtirgichni bosing", rect: "Kondensator va diod ko‘prigini tanlang", tr: "Potensiometr dastasini aylantiring" };
const KIND_DEFAULT = { thermo: "heat", photo: "photo", vax: "vaxSi", rect: "rhalf", tr: "trAmp" };
const MODE_DEFAULT = { rt: "heat", lat: "ntype", pn: "vaxSi" };
const defaultFor = () => (ui.mode === "lat" ? MODE_DEFAULT.lat : KIND_DEFAULT[ui.kind[ui.mode]]);
function setModeUI() {
  const k = kind();
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === k)));
  document.querySelectorAll("[data-kctl]").forEach((el) => { el.hidden = el.dataset.kctl !== k; });
  $("[data-mode-hint]").textContent = MODE_HINT[k];
  scene.setMode(k); // kamera shu tajribaga mos ko'rinishga (rejim almashgandagina)
  setTabs();
}
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.kindValue !== kind()) loadPreset(KIND_DEFAULT[b.dataset.kindValue]); }));
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { const m = b.dataset.modeValue; if (m !== ui.mode) loadPreset(m === "lat" ? MODE_DEFAULT.lat : KIND_DEFAULT[ui.kind[m]] || MODE_DEFAULT[m]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null; flashUntil = 0;
  p.set();
  if (!rec.res) recCalc();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncRT(); syncLat(); syncDio(); syncRec(); syncTr(); syncSpeed(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

resetRT(); recCalc(); resetLattice([]);
setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "heat");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__semi = { rt, lat, dio, rec, trs, ui, loadPreset, refresh, stepRT, stepLat, dCirc, trCalc, kind, scene, frameCfg, atomXY, get drag() { return drag; } };
