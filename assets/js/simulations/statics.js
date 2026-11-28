// ==========================================================================
// Muvozanat, kuch momenti va oddiy mexanizmlar — virtual laboratoriya (simulations/statics.html)
// 1) Massa markazi va muvozanat: shtativ shtiftiga osilgan fanera plastinka va shovun (chiziqlar kesishmasi),
//    qutining qirrasi atrofida ag'darilishi (α_kr), sharcha botiq / qavariq / tekis sirtda (muvozanat turlari).
// 2) Laboratoriya richagi: 100 g li yuklar, teshiklar, dinamometr (qiya tortish), tayanch nuqtasini siljitish.
// 3) Oddiy mexanizmlar: qo'zg'almas va qo'zg'aluvchan blok, polispast, chig'ir; oltin qoida va FIK.
// Dunyo koordinatalari 520×300 (shartli birlik). Sahna — 360° 3D laboratoriya (statics-lab-3d.js): asboblar shu dunyo
// tekisligida turadi; bo'sh joydan sudrash kamerani aylantiradi. Fizika: statics-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-n3";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261124-n3";
import { createStaticsLab } from "./statics-lab-3d.js?v=20261128-s";
import * as P from "./statics-physics.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "cm", kind: { cm: "plate", mech: "fixed" } };
const pl = { shape: "L", hole: 0, th: 0, w: 0, lines: [], showCm: false, held: false };
const tp = { size: "tall", f: 0.5, a: 0, w: 0, rest: "up", held: true };
const bl = { kind: "bowl", x: 0, v: 0, held: false };
const lv = { A: { n: 2, h: -3 }, B: { n: 3, h: 2 }, dyn: false, dh: 5, phi: 0, po: 0, b: 0, w: 0 };
const mc = { m: 1, n: 4, R: 0.3, ideal: false, s: 0, auto: 0, psi: 0 };
let presetId = null;
let anim = 0, drag = null;
const hits = {};
const kind = () => (ui.mode === "lever" ? "lever" : ui.kind[ui.mode]);
const isMech = (k = kind()) => ["fixed", "movable", "tackle", "axle"].includes(k);

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/* ------------------------------------------------------------------ 1a) Plastinka */

const PIN = [250, 44], PK = 6.4;
const ppCache = {};
const pp = () => (ppCache[pl.shape] ||= P.plateProps(P.SHAPES[pl.shape]));
const shape = () => P.SHAPES[pl.shape];
const plHole = () => shape().holes[pl.hole];
const HOLE_L = ["A", "B", "C"];
function plW([qx, qy]) { const h = plHole(), dx = qx - h[0], dy = qy - h[1], co = Math.cos(pl.th), si = Math.sin(pl.th); return [PIN[0] + PK * (co * dx - si * dy), PIN[1] + PK * (si * dx + co * dy)]; }
function plInv(x, y) { const h = plHole(), dx = (x - PIN[0]) / PK, dy = (y - PIN[1]) / PK, co = Math.cos(pl.th), si = Math.sin(pl.th); return [h[0] + co * dx + si * dy, h[1] - si * dx + co * dy]; }
const plEq = () => P.hangEq(pp(), plHole());
const plDev = () => P.wrapPi(pl.th - plEq());
const plRest = () => Math.abs(pl.w) < 0.01 && Math.abs(plDev()) < 0.005;
function resetPlate(off = 0.55) { pl.th = plEq() + off; pl.w = 0; pl.lines = []; pl.held = false; }
function hangFrom(i) { if (i === pl.hole) return; pl.hole = i; pl.w = 0; pl.held = false; syncPlate(); }
function stepPlate(dt) { if (!pl.held) P.plateStep(pl, pp(), plHole(), dt); }
function drawPlumbLine() {
  const d = [Math.sin(pl.th), Math.cos(pl.th)];
  pl.lines = pl.lines.filter((l) => l.i !== pl.hole); pl.lines.push({ i: pl.hole, p: plHole(), d, dev: plDev() });
}
function plEstimate() {
  if (pl.lines.length < 2) return null;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < pl.lines.length; i++) for (let j = i + 1; j < pl.lines.length; j++) { const q = P.lineX(pl.lines[i], pl.lines[j]); if (q) { sx += q[0]; sy += q[1]; n++; } }
  return n ? [sx / n, sy / n] : null;
}
/* ------------------------------------------------------------------ 1b) Quti */

const TIP_E = [300, 238], TK = 500; // px / m
const TSZ = { tall: [0.1, 0.3], mid: [0.16, 0.24], cube: [0.2, 0.2] };
const tBox = () => { const [b, h] = TSZ[tp.size]; return { m: 2, b, h, f: tp.f }; };
const tCrit = () => { const o = tBox(); return P.tipCrit(o.b, o.h, o.f); };
function tpW(u, v) { const ca = Math.cos(tp.a), sa = Math.sin(tp.a); return [TIP_E[0] + TK * (u * ca + v * sa), TIP_E[1] - TK * (-u * sa + v * ca)]; }
function stepTip(dt) { if (!tp.held && !tp.rest) P.tipStep(tp, tBox(), dt); }
function releaseTip() { tp.held = false; tp.rest = tp.a <= 0 ? "up" : tp.a >= Math.PI / 2 ? "side" : null; tp.w = 0; }
/* ------------------------------------------------------------------ 1c) Sharcha */

const BC = [260, 226], BK = 10, BR = 1.15, BALL_M = 0.05;
function stepBall(dt) { if (!bl.held) P.ballStep(bl, bl.kind, dt); }
const surfW = (x) => [BC[0] + BK * x, BC[1] - BK * P.surfY(bl.kind, x)];
/* ------------------------------------------------------------------ 2) Richag */

const PIV = [260, 112], LK = 700; // px / m
const lvLoads = () => [lv.A, lv.B].filter((g) => g.n > 0 && g.h !== 0).map((g) => ({ x: g.h * P.LEVER.step, m: g.n * P.LEVER.mW }));
const lvMom = () => P.leverMoments(lvLoads(), lv.po);
const lvF = () => (lv.dyn ? P.dynForce(lvMom().net, lv.dh * P.LEVER.step, lv.po, lv.phi * DEG) : 0);
function stepLever(dt) {
  if (lv.dyn) { lv.b *= Math.exp(-dt * 8); lv.w = 0; return; }
  P.leverStep(lv, lvLoads(), lv.po, dt);
}
/** Richag nuqtasi: u (m, tayanchdan), v (birlik, perpendikulyar) */
function lvW(u, v = 0) { const cb = Math.cos(lv.b), sb = Math.sin(lv.b); return [PIV[0] + LK * u * cb - v * sb, PIV[1] + LK * u * sb + v * cb]; }
/* ------------------------------------------------------------------ 3) Bloklar va chig'ir */

const FLOOR = 282, MK = 300; // px / m
const mOpt = () => ({ n: mc.n, R: mc.R, ideal: mc.ideal });
const mRes = (k = kind()) => P.mechForce(k, mc.m, mOpt());
const loadH = () => 24 + 10 * Math.cbrt(mc.m);
/** Ip yo'li (sahnaga sig'adigan): qo'zg'almas 30 cm, qo'zg'aluvchan 30 cm, polispast 40 cm; chig'irda yuk 33 cm gacha */
function hMax(k = kind()) { const r = mRes(k); if (k === "axle") return Math.min(0.33, (FLOOR - loadH() - 125) / MK); return (k === "tackle" ? 0.4 : 0.3) / r.k; }
const sMax = () => hMax() * mRes().k;
const mH = () => mc.s / mRes().k;
function stepMech(dt) {
  if (!mc.auto) return;
  mc.s = clamp(mc.s + mc.auto * dt * 0.08 * mRes().k, 0, sMax()); mc.psi = mc.s / mc.R;
  if (mc.s >= sMax() || mc.s <= 0) mc.auto = 0;
}
/* ------------------------------------------------------------------ Sahna */

/** Qalam chiziqlari plastinka ustida (dunyo koordinatalarida kesmalar) va bo'shliqdagi davomi */
function pencil() {
  const segs = [], dashes = [], sh = shape();
  for (const l of pl.lines) {
    let a = null, prev = null;
    for (let t = -60; t <= 60.001; t += 0.5) {
      const q = [l.p[0] + l.d[0] * t, l.p[1] + l.d[1] * t], inn = P.inside(sh, q[0], q[1]);
      if (inn && !a) a = q;
      if (!inn && a) { segs.push([plW(a), plW(prev)]); a = null; }
      prev = q;
    }
    if (a) segs.push([plW(a), plW(prev)]);
  }
  const est = plEstimate();
  if (est && !P.inside(sh, est[0], est[1])) for (const l of pl.lines) { const t = (est[0] - l.p[0]) * l.d[0] + (est[1] - l.p[1]) * l.d[1], e = t + 3 * Math.sign(t); dashes.push([plW(l.p), plW([l.p[0] + l.d[0] * e, l.p[1] + l.d[1] * e])]); }
  return { segs, dashes, est };
}
function holeLabel(i) { const h = shape().holes[i], P0 = pp(), dx = P0.cx - h[0], dy = P0.cy - h[1], L = Math.hypot(dx, dy) || 1; return plW([h[0] + (dx / L) * 2.6, h[1] + (dy / L) * 2.6]); }
const scene = createStaticsLab();
/** 3D sahnaga beriladigan holat: dunyo koordinatalari funksiyalari (statics.js dagi bilan bir xil) */
function frame() {
  const pc = kind() === "plate" ? pencil() : { segs: [], dashes: [], est: null };
  return {
    hits, kind, pl, tp, bl, lv, mc, PIN, TIP_E, TK, BC, BK, BR, PIV, LK, MK, FLOOR, LEVER: P.LEVER, zAxle: -0.44,
    shape, shapeName: pl.shape, plW, inside: (x, y) => P.inside(shape(), x, y), hole: pl.hole, holeLabel, pencil: pc.segs, dashes: pc.dashes,
    est: pc.est && plW(pc.est), cm: pl.showCm ? plW([pp().cx, pp().cy]) : null,
    tBox, tCrit, tpW, surfW, slope: () => P.surfSlope(bl.kind, bl.x), lvW, lvMom, lvF, dragKey: drag && drag.k,
    mRes, mH, loadH,
  };
}
const stage = createStage($("#stage"), (ctx, stg) => scene.draw(ctx, stg, frame()), { height: detailedStageHeight });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const xy = (q) => `(${fmt(q[0], 1)}; ${fmt(q[1], 1)})`;
const tipM = () => { const o = tBox(); return P.tipTorque(o.m, o.b, o.h, o.f, tp.a); };
const ballEk = () => 0.5 * BALL_M * (bl.v / 100) ** 2 * (7 / 5);

function updateReadouts() {
  const k = kind();
  if (k === "plate") {
    const p0 = pp(), h = plHole(), d = Math.hypot(p0.cx - h[0], p0.cy - h[1]), est = plEstimate(), dev = plDev() / DEG;
    setRO("r1", "Plastinka", u(fmt(p0.mass, 0), "g"), `${shape().name}; yuzi S = ${fmt(p0.A, 0)} cm²`);
    setRO("r2", "Osish nuqtasi", u(HOLE_L[pl.hole], "teshik"), `shtiftdan massa markazigacha d = ${fmt(d, 1)} cm`, "blue");
    setRO("r3", "Vertikaldan og‘ish", u(fmt(dev, 1), "°"), plRest() ? "to‘xtadi — chiziq chizish mumkin" : `tebranmoqda; davr T = ${fmt(TAU / P.hangOmega(p0, h), 2)} s`, plRest() ? "green" : "orange");
    setRO("r4", "Chizilgan chiziqlar", u(String(pl.lines.length), "ta"), pl.lines.length ? pl.lines.map((l) => HOLE_L[l.i]).join(", ") + " teshikdan" : "shovun bo‘ylab chiziq chizing");
    setRO("r5", "Kesishish nuqtasi", est ? u(xy(est), "cm") : "—", est ? `hisoblangandan farqi ${fmt(Math.hypot(est[0] - p0.cx, est[1] - p0.cy) * 10, 1)} mm` : "kamida ikki chiziq kerak", est ? "green" : "");
    setRO("r6", "Massa markazi (hisob)", pl.showCm || pl.lines.length >= 2 ? u(xy([p0.cx, p0.cy]), "cm") : "?", P.inside(shape(), p0.cx, p0.cy) ? "koordinatalar plastinkaning chap yuqori burchagidan" : "jism tashqarisida — materialda emas!", P.inside(shape(), p0.cx, p0.cy) ? "" : "red");
  } else if (k === "tip") {
    const o = tBox(), ac = tCrit(), hc = P.tipHeight(o.b, o.h, o.f, tp.a), M = tipM(), dE = o.m * P.G * (P.tipHeight(o.b, o.h, o.f, ac) - o.f * o.h);
    setRO("r1", "Og‘ish burchagi α", u(fmt(tp.a / DEG, 1), "°"), tp.held ? "qo‘l bilan ushlab turilibdi" : tp.rest === "up" ? "tagida turibdi" : tp.rest === "side" ? "yonboshiga yiqildi" : "qo‘yib yuborildi", "blue");
    setRO("r2", "Kritik burchak α<sub>kr</sub>", u(fmt(ac / DEG, 1), "°"), `tg α = (b/2) : (massa markazi balandligi) = ${fmt(o.b * 50, 0)}/${fmt(o.f * o.h * 100, 1)}`, "orange");
    setRO("r3", "Massa markazi balandligi", u(fmt(hc * 100, 1), "cm"), `tik turganda ${fmt(o.f * o.h * 100, 1)} cm`);
    setRO("r4", "Tiklovchi moment", u(fmt(M, 3), "N·m"), M >= 0 ? "qutini tagiga qaytaradi" : "qutini ag‘daradi", M >= 0 ? "green" : "red");
    setRO("r5", "Ag‘darish uchun ish", u(fmt(dE * 1000, 0), "mJ"), "massa markazini αₖᵣ gacha ko‘tarish: mgΔh — turg‘unlik zaxirasi");
    setRO("r6", "Holat", tp.a < ac ? "turg‘un" : "ag‘dariladi", tp.a < ac ? "vertikal tayanch qirrasidan ichkarida" : "vertikal tayanchdan tashqariga chiqdi", tp.a < ac ? "green" : "red");
  } else if (k === "ball") {
    const y = P.surfY(bl.kind, bl.x), Ep = BALL_M * P.G * y / 100, sl = P.surfSlope(bl.kind, bl.x), Ft = BALL_M * P.G * Math.sin(Math.atan(Math.abs(sl)));
    setRO("r1", "Siljish <i>x</i>", u(fmt(bl.x, 1), "cm"), bl.held ? "qo‘l bilan ushlab turilibdi" : "muvozanat holatidan", "blue");
    setRO("r2", "Potensial energiya", u(fmt(Ep * 1000, 1), "mJ"), `Eₚ = mgy, y = ${fmt(y, 2)} cm`, "orange");
    setRO("r3", "Kinetik energiya", u(fmt(ballEk() * 1000, 1), "mJ"), "ilgarilanma + aylanma: (7/10)mv²", "green");
    setRO("r4", "Qaytaruvchi kuch", u(fmt(Ft * 1000, 0), "mN"), bl.kind === "dome" ? "muvozanatdan uzoqlashtiradi" : bl.kind === "bowl" ? "muvozanatga qaytaradi" : "nolga teng", bl.kind === "dome" && Ft > 1e-6 ? "red" : "");
    setRO("r5", "Muvozanat turi", { bowl: "turg‘un", dome: "turg‘unmas", flat: "befarq" }[bl.kind], { bowl: "Eₚ minimum: chetga chiqarilsa qaytadi", dome: "Eₚ maksimum: ozgina tursa ham dumalab ketadi", flat: "Eₚ o‘zgarmaydi: istalgan joyda turadi" }[bl.kind], { bowl: "green", dome: "red", flat: "" }[bl.kind]);
    setRO("r6", "Tebranish davri", bl.kind === "bowl" ? u(fmt(TAU * Math.sqrt((7 * P.SURF_R) / (5 * 980)), 2), "s") : "—", bl.kind === "bowl" ? "T = 2π√(7R/5g), R = 20 cm" : "tebranish yo‘q");
  } else if (k === "lever") {
    const m = lvMom(), Fd = lvF(), loads = lvLoads(), N = P.pivotN(loads, Number.isFinite(Fd) ? Fd : 0, lv.phi * DEG);
    setRO("r1", "Soat miliga qarshi moment M₁", u(fmt(m.ccw, 3), "N·m"), "chapga buruvchi kuchlar: F·l", "blue");
    setRO("r2", "Soat mili bo‘yicha moment M₂", u(fmt(m.cw, 3), "N·m"), "o‘ngga buruvchi kuchlar", "orange");
    setRO("r3", "Momentlar farqi", u(fmt(m.net, 3), "N·m"), lv.dyn ? "dinamometr momenti uni muvozanatlaydi" : Math.abs(m.net) < 1e-9 ? "M₁ = M₂ — muvozanat" : "muvozanat yo‘q", lv.dyn || Math.abs(m.net) < 1e-9 ? "green" : "red");
    setRO("r4", "Dinamometr", lv.dyn ? (Number.isFinite(Fd) ? u(fmt(Math.abs(Fd), 2), "N") : "∞") : "—", lv.dyn ? `${Fd >= 0 ? "yuqoriga" : "pastga"}; yelka ${fmt(Math.abs(lv.dh * 5 - lv.po * 100) * Math.cos(lv.phi * DEG), 1)} cm${lv.phi ? ` = d·cos ${fmt(lv.phi, 0)}°` : ""}` : "ulanmagan");
    setRO("r5", "Tayanch reaksiyasi <i>N</i>", u(fmt(N, 2), "N"), `yuklar ${fmt(loads.reduce((s, l) => s + l.m, 0) * P.G, 2)} N + richag ${fmt(P.LEVER.mBar * P.G, 2)} N${lv.dyn ? " − dinamometr" : ""}`);
    setRO("r6", "Richag og‘ishi", u(fmt(lv.b / DEG, 1), "°"), Math.abs(lv.b) >= P.LEVER_STOP - 1e-6 ? "tirgakka tiraldi" : "gorizontaldan", Math.abs(lv.b) > 0.01 ? "orange" : "");
  } else {
    const r = mRes(), h = mH(), Af = r.W * h, At = r.F * mc.s;
    setRO("r1", "Dinamometr (kerakli kuch)", u(fmt(r.F, 2), "N"), k === "axle" ? "dasta uchida, aylanishga urinma" : "ip uchida", "orange");
    setRO("r2", "Yuk og‘irligi mg", u(fmt(r.W, 2), "N"), `m = ${fmt(mc.m, 1)} kg, g = 9,8 m/s²`, "blue");
    setRO("r3", "Kuchdan yutuq", u(`×${fmt(r.W / r.F, 2)}`, ""), mc.ideal ? `ideal: ${k === "fixed" ? "1 (faqat yo‘nalish)" : k === "axle" ? "R/r" : k === "movable" ? "2" : "n"}` : "real: ishqalanish yutuqni kamaytiradi", "green");
    setRO("r4", "Yo‘ldan yutqazish s/h", u(`×${fmt(r.k, 0)}`, ""), `s = ${fmt(mc.s * 100, 1)} cm, h = ${fmt(h * 100, 1)} cm`);
    setRO("r5", "Ish", u(`${fmt(At, 2)} | ${fmt(Af, 2)}`, "J"), "to‘liq F·s | foydali mgh");
    setRO("r6", "FIK η", u(fmt(r.eta * 100, 0), "%"), mc.ideal ? "ideal mexanizm: F·s = mgh" : "η = mgh/(F·s)", r.eta > 0.99 ? "green" : "orange");
  }
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2400; }
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"), k = kind(); let t, tone = "blue";
  if (k === "plate") { t = pl.held ? "Plastinka qo‘lda" : plRest() ? "Plastinka to‘xtadi: massa markazi shtift ostida" : "Plastinka tebranmoqda"; tone = plRest() ? "green" : "orange"; }
  else if (k === "tip") { const ac = tCrit(); t = tp.rest === "side" ? "Quti ag‘darildi" : tp.held ? (tp.a < ac ? "Qo‘yib yuborilsa — qaytadi" : "Qo‘yib yuborilsa — ag‘dariladi") : tp.rest === "up" ? "Quti tagida turibdi" : "Quti harakatlanmoqda"; tone = tp.rest === "side" || (tp.held && tp.a >= ac) ? "red" : "green"; }
  else if (k === "ball") { t = { bowl: "Turg‘un muvozanat", dome: "Turg‘unmas muvozanat", flat: "Befarq muvozanat" }[bl.kind]; tone = { bowl: "green", dome: "red", flat: "blue" }[bl.kind]; }
  else if (k === "lever") { const m = lvMom(); t = lv.dyn ? "Dinamometr richagni muvozanatda ushlab turibdi" : Math.abs(m.net) < 1e-9 ? "Richag muvozanatda: M₁ = M₂" : "Momentlar teng emas — richag buriladi"; tone = lv.dyn || Math.abs(m.net) < 1e-9 ? "green" : "red"; }
  else { t = mc.auto > 0 ? "Yuk ko‘tarilmoqda" : mc.s >= sMax() - 1e-6 ? "Yuk eng yuqorida" : mc.s > 0 ? "Yuk ko‘tarildi" : "Yuk polda"; tone = mc.s > 0 ? "orange" : ""; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}

let lastExplain = "";
function updateExplain() {
  const p = [], k = kind();
  if (k === "plate") {
    p.push("<p>Jismning <b>massa markazi</b> (og‘irlik markazi) — og‘irlik kuchining teng ta’sir etuvchisi qo‘yilgan nuqta. Bitta nuqtadan osilgan jism tinch holatda shunday turadiki, massa markazi osish nuqtasidan o‘tgan <b>vertikal</b> ustida (pastda) bo‘ladi: aks holda og‘irlik kuchi momenti jismni buradi.</p>");
    p.push("<p>Shuning uchun shovun ipi bo‘ylab chizilgan chiziq massa markazidan o‘tadi. Plastinkani boshqa teshikdan osib, ikkinchi chiziqni chizing — kesishish nuqtasi massa markazi. Uchinchi chiziq ham shu nuqtadan o‘tadi (tekshirish).</p>");
    if (pl.shape === "arch") p.push("<p><b>Taqa</b>da massa markazi jismning ichida emas, bo‘shliqda yotadi. Halqa, bumerang, stul — massa markazi jism tashqarisida bo‘lishi mumkin.</p>");
    if (pl.shape === "disk") p.push("<p>Teshik qirqib olingan disk: massa markazi doira markazidan teshikka qarama-qarshi tomonga siljigan. Uni «butun disk − kichik doira» deb hisoblash mumkin: xᴄ = (S₁x₁ − S₂x₂)/(S₁ − S₂).</p>");
    if (!plRest() && !pl.held) p.push("<p>Plastinka tebranmoqda — bu <b>fizik mayatnik</b>. Shtiftdagi ishqalanish tebranishni so‘ndiradi.</p>");
  } else if (k === "tip") {
    p.push("<p>Tayanchga ega jism massa markazidan tushirilgan vertikal <b>tayanch yuzasi</b> ichidan o‘tsa, muvozanatda turadi. Quti og‘dirilganda u faqat bitta qirraga tayanadi; og‘irlik kuchining shu qirraga nisbatan momenti qutini orqaga qaytaradi — vertikal qirradan chiqib ketmaguncha.</p>");
    p.push(`<p>Kritik burchak tg α<sub>kr</sub> = (b/2)/h<sub>C</sub>. Hozir α<sub>kr</sub> = ${fmt(tCrit() / DEG, 1)}°. Quti qanchalik keng va massa markazi qanchalik past bo‘lsa, u shuncha <b>turg‘un</b>: yuk mashinalariga og‘ir yukni pastga joylashadi, minoralar va kranlar keng va og‘ir asosga quriladi.</p>`);
  } else if (k === "ball") {
    p.push("<p><b>Turg‘un muvozanat</b>: jism muvozanat holatidan chiqarilsa, uni qaytaruvchi kuch paydo bo‘ladi (botiq sirt — potensial energiya minimumi). <b>Turg‘unmas</b>: chetga chiqarilsa, kuch uni yanada uzoqlashtiradi (qavariq sirt cho‘qqisi — maksimum). <b>Befarq</b>: istalgan holatda muvozanatda (tekis sirt).</p>");
    p.push("<p>Sharchaga og‘irlik kuchi mg va sirtning reaksiya kuchi N ta’sir qiladi; ularning teng ta’sir etuvchisi F sirtga urinma yo‘nalgan. Muvozanat nuqtasida F = 0.</p>");
  } else if (k === "lever") {
    p.push("<p><b>Richag</b> — qo‘zg‘almas o‘q atrofida aylana oladigan qattiq jism. Kuch momenti M = F·l, bu yerda yelka l — o‘qdan kuchning ta’sir chizig‘igacha bo‘lgan eng qisqa masofa. Richag muvozanatda bo‘lishi uchun uni soat mili bo‘yicha va unga qarshi buruvchi momentlar teng bo‘lishi kerak: <b>M₁ = M₂</b>, ya’ni F₁l₁ = F₂l₂ (moment qoidasi).</p>");
    if (lv.dyn && lv.phi > 0) p.push(`<p>Dinamometr ${fmt(lv.phi, 0)}° qiya tortilmoqda: yelka d·cos φ ga kamaydi, shuning uchun kerakli kuch ${fmt(1 / Math.cos(lv.phi * DEG), 2)} marta ortdi.</p>`);
    if (Math.abs(lv.po) > 1e-6) p.push(`<p>Tayanch richag o‘rtasidan ${fmt(lv.po * 100, 0)} cm siljigan: endi richagning o‘z og‘irligi (${fmt(P.LEVER.mBar * P.G, 2)} N, massa markazi o‘rtada) ham moment beradi: ${fmt(P.LEVER.mBar * P.G * lv.po, 3)} N·m.</p>`);
    p.push("<p>Hayotda: qaychi, omburlar, lom, tarozi (1-tur), yong‘oq chaqqich va tachka (2-tur), qo‘l bilagi va pinset (3-tur).</p>");
  } else {
    const r = mRes();
    if (k === "fixed") p.push("<p><b>Qo‘zg‘almas blok</b> — teng yelkali richag: o‘qdan ikki ip uchigacha yelkalar bir xil (r), shuning uchun F = mg. U kuchdan yutuq bermaydi, faqat kuch yo‘nalishini qulay tomonga o‘zgartiradi.</p>");
    if (k === "movable") p.push("<p><b>Qo‘zg‘aluvchan blok</b> — yelkalari 2r va r bo‘lgan richag (aylanish o‘qi — chap ip tegib turgan nuqta). Kuchdan 2 marta yutuq beradi: F = mg/2, lekin ipni 2 marta ko‘p tortish kerak: s = 2h.</p>");
    if (k === "tackle") p.push(`<p><b>Polispast</b> — qo‘zg‘almas va qo‘zg‘aluvchan bloklar to‘plami. Yukni ${mc.n} ta ip ushlab turadi, har biridagi taranglik ~F: kuchdan ${mc.n} marta yutuq, yo‘ldan ${mc.n} marta yutqazish. Har bir g‘ildirakda ishqalanish taranglikni biroz kamaytiradi — FIK g‘ildiraklar soni bilan kamayadi.</p>`);
    if (k === "axle") p.push(`<p><b>Chig‘ir</b> (darvoza, vorot) — o‘qqa mahkamlangan baraban va dasta: yelkalari r va R bo‘lgan richag. F = mg·r/R: R/r = ${fmt(mc.R / P.MECH.r, 0)} marta yutuq. Quduqdan suv chiqarish, mashina rul g‘ildiragi, eshik dastasi, otvyortka — shu tamoyil.</p>`);
    p.push(`<p><b>Mexanikaning oltin qoidasi</b>: hech bir mexanizm ishdan yutuq bermaydi — kuchdan necha marta yutilsa, yo‘ldan shuncha marta yutqaziladi. Hozir FIK η = ${fmt(r.eta * 100, 0)} %${mc.ideal ? " (ideal)" : ": qolgan ish ishqalanish va blokni ko‘tarishga ketadi"}.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
const FORMULA = { plate: "<small>Massa markazi</small> x<sub>C</sub> = Σmᵢxᵢ/Σmᵢ", tip: "<small>Ag‘darilish</small> tg α<sub>kr</sub> = (b/2)/h<sub>C</sub>", ball: "<small>Muvozanat</small> ΣF = 0", lever: "<small>Moment qoidasi</small> F₁l₁ = F₂l₂", fixed: "<small>Qo‘zg‘almas blok</small> F = mg", movable: "<small>Qo‘zg‘aluvchan blok</small> F = mg/2", tackle: "<small>Polispast</small> F = mg/n", axle: "<small>Chig‘ir</small> F = mg·r/R" };
function updateFormula() { const html = FORMULA[kind()]; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); syncTools(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  const k = kind();
  if (k === "plate") stepPlate(dt); else if (k === "tip") stepTip(dt); else if (k === "ball") stepBall(dt); else if (k === "lever") stepLever(dt); else stepMech(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); if (k === "plate") updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) refresh();
}
playBtn.addEventListener("click", () => loop.toggle());
const kick = () => { if (!prefersReducedMotion()) loop.start(); };
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || defaultFor(), false));

/* ------------------------------------------------------------------ Boshqaruv */

// 1a) Plastinka
const shSel = $("#plShape");
shSel.innerHTML = Object.entries(P.SHAPES).map(([id, sh]) => `<option value="${id}">${sh.name}</option>`).join("");
shSel.addEventListener("change", () => { pl.shape = shSel.value; pl.hole = 0; resetPlate(); customized(); syncPlate(); refresh(); kick(); });
document.querySelectorAll("[data-hole-value]").forEach((b) => b.addEventListener("click", () => { hangFrom(Number(b.dataset.holeValue)); customized(); refresh(); kick(); }));
$("[data-line]").addEventListener("click", () => { if (!plRest()) flashStatus("Plastinka hali tebranmoqda — chiziq aniq chiqmaydi"); drawPlumbLine(); refresh(); });
$("[data-clearl]").addEventListener("click", () => { pl.lines = []; refresh(); });
$("[data-showcm]").addEventListener("click", () => { pl.showCm = !pl.showCm; refresh(); });
function syncPlate() { shSel.value = pl.shape; document.querySelectorAll("[data-hole-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.holeValue) === pl.hole))); }

// 1b) Quti
const szSel = $("#tpSize");
szSel.addEventListener("change", () => { tp.size = szSel.value; tp.a = 0; tp.rest = "up"; tp.held = true; customized(); syncTip(); refresh(); });
const TF = bindRange($("#tpF"), $("#tpFOut"), (v) => `${fmt(v * 100, 0)} % h`, (v) => { tp.f = v; if (tp.rest === "side") { tp.a = 0; tp.rest = "up"; } customized(); refresh(); });
const TA = bindRange($("#tpA"), $("#tpAOut"), (v) => `${fmt(v, 1)}°`, (v) => { tp.a = v * DEG; tp.held = true; tp.rest = null; tp.w = 0; customized(); refresh(); });
function syncTip() { szSel.value = tp.size; TF.set(tp.f); TA.set(Math.min(60, Math.round((tp.a / DEG) * 2) / 2)); }

// 1c) Sharcha
document.querySelectorAll("[data-surf-value]").forEach((b) => b.addEventListener("click", () => { bl.kind = b.dataset.surfValue; bl.x = bl.kind === "dome" ? 0 : 6; bl.v = 0; bl.held = bl.kind !== "dome"; customized(); syncBall(); refresh(); }));
function syncBall() { document.querySelectorAll("[data-surf-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.surfValue === bl.kind))); }
$("[data-release]").addEventListener("click", () => { if (kind() === "tip") releaseTip(); else { bl.held = false; bl.v = 0; } customized(); refresh(); kick(); });

// 2) Richag
const holeFmt = (v) => (v === 0 ? "—" : `${v < 0 ? "chapda" : "o‘ngda"} ${Math.abs(v)} (${Math.abs(v) * 5} cm)`);
const LAn = bindRange($("#lvAn"), $("#lvAnOut"), (v) => `${v} ta (${fmt(v * 0.98, 2)} N)`, (v) => { lv.A.n = v; leverChanged(); });
const LAh = bindRange($("#lvAh"), $("#lvAhOut"), holeFmt, (v) => { lv.A.h = v; leverChanged(); });
const LBn = bindRange($("#lvBn"), $("#lvBnOut"), (v) => `${v} ta (${fmt(v * 0.98, 2)} N)`, (v) => { lv.B.n = v; leverChanged(); });
const LBh = bindRange($("#lvBh"), $("#lvBhOut"), holeFmt, (v) => { lv.B.h = v; leverChanged(); });
const LDh = bindRange($("#lvDh"), $("#lvDhOut"), holeFmt, (v) => { lv.dh = v || 1; leverChanged(); });
const LPhi = bindRange($("#lvPhi"), $("#lvPhiOut"), (v) => `${fmt(v, 0)}°`, (v) => { lv.phi = v; leverChanged(); });
const poSel = $("#lvPo");
poSel.addEventListener("change", () => { lv.po = Number(poSel.value); leverChanged(); });
document.querySelectorAll("[data-dyn-value]").forEach((b) => b.addEventListener("click", () => { lv.dyn = b.dataset.dynValue === "1"; leverChanged(); syncLever(); }));
function leverChanged() { customized(); refresh(); kick(); }
function syncLever() {
  LAn.set(lv.A.n); LAh.set(lv.A.h); LBn.set(lv.B.n); LBh.set(lv.B.h); LDh.set(lv.dh); LPhi.set(lv.phi); poSel.value = String(lv.po);
  document.querySelectorAll("[data-dyn-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.dynValue === "1") === lv.dyn)));
  document.querySelectorAll("[data-dynctl]").forEach((el) => { el.hidden = !lv.dyn; });
}

// 3) Mexanizmlar
const MM = bindRange($("#mM"), $("#mMOut"), (v) => `${fmt(v, 1)} kg`, (v) => { mc.m = v; mc.s = Math.min(mc.s, sMax()); customized(); refresh(); });
const nSel = $("#mN"), rSel = $("#mR");
nSel.addEventListener("change", () => { mc.n = Number(nSel.value); mc.s = Math.min(mc.s, sMax()); customized(); refresh(); });
rSel.addEventListener("change", () => { mc.R = Number(rSel.value); mc.s = Math.min(mc.s, sMax()); mc.psi = mc.s / mc.R; customized(); refresh(); });
document.querySelectorAll("[data-ideal-value]").forEach((b) => b.addEventListener("click", () => { mc.ideal = b.dataset.idealValue === "1"; customized(); syncMech(); refresh(); }));
$("[data-lift]").addEventListener("click", () => { mc.auto = 1; if (mc.s >= sMax() - 1e-6) mc.s = 0; refresh(); kick(); });
$("[data-lower]").addEventListener("click", () => { mc.auto = 0; mc.s = 0; mc.psi = 0; refresh(); });
function syncMech() { MM.set(mc.m); nSel.value = String(mc.n); rSel.value = String(mc.R); document.querySelectorAll("[data-ideal-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.idealValue === "1") === mc.ideal))); }

function syncTools() {
  const k = kind();
  $("[data-showcm]").setAttribute("aria-pressed", String(pl.showCm)); $("[data-showcm]").textContent = pl.showCm ? "Massa markazini yashirish" : "Massa markazini ko‘rsatish";
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(k); });
}

/* ------------------------------------------------------------------ Sahnada boshqarish */

const canvas = stage.canvas;
const inBox = (p, b) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const near = (p, h, extra = 0) => h && dist(p.x, p.y, h.x, h.y) <= h.r + extra;
const angAt = (p, c0) => Math.atan2(p.y - c0[1], p.x - c0[0]);
function hitTest(p) {
  const k = kind();
  if (k === "plate") {
    for (let i = 0; i < 3; i++) if (i !== pl.hole && near(p, hits["hole" + i])) return { k: "hole", i };
    const [qx, qy] = plInv(p.x, p.y); return P.inside(shape(), qx, qy) ? { k: "plate" } : null;
  }
  if (k === "tip") { const o = tBox(), ca = Math.cos(tp.a), sa = Math.sin(tp.a), dx = (p.x - TIP_E[0]) / TK, dy = -(p.y - TIP_E[1]) / TK, uu = dx * ca - dy * sa, vv = dx * sa + dy * ca; return uu >= -o.b - 0.01 && uu <= 0.01 && vv >= -0.01 && vv <= o.h + 0.01 ? { k: "box" } : null; }
  if (k === "ball") return near(p, hits.ball) ? { k: "ball" } : null;
  if (k === "lever") { if (near(p, hits.ring)) return { k: "ring" }; for (const key of ["A", "B"]) if (inBox(p, hits[key])) return { k: key }; return null; }
  if (isMech(k)) { const h = hits.hand; if (!h) return null; if (h.axle) return dist(p.x, p.y, h.x, h.y) <= h.r && dist(p.x, p.y, h.x, h.y) > 10 ? { k: "crank" } : null; return inBox(p, h) ? { k: "hand", dir: h.dir } : null; }
  return null;
}
function startDrag(h, p) {
  if (h.k === "hole") { hangFrom(h.i); customized(); refresh(); kick(); return; }
  drag = { ...h, x0: p.x, y0: p.y, a0: h.k === "plate" ? angAt(p, PIN) : h.k === "box" ? angAt(p, TIP_E) : h.k === "crank" ? angAt(p, [250, 96]) : 0, th0: pl.th, ta0: tp.a, s0: mc.s };
  if (h.k === "plate") { pl.held = true; pl.w = 0; }
  if (h.k === "box") { tp.held = true; tp.rest = null; tp.w = 0; }
  if (h.k === "ball") { bl.held = true; bl.v = 0; }
  if (h.k === "hand" || h.k === "crank") mc.auto = 0;
  kick(); refresh();
}
function onDrag(p) {
  const k = drag.k;
  if (k === "plate") { pl.th = drag.th0 + P.wrapPi(angAt(p, PIN) - drag.a0); pl.w = 0; }
  else if (k === "box") { tp.a = clamp(drag.ta0 + P.wrapPi(angAt(p, TIP_E) - drag.a0), 0, Math.PI / 2); TA.set(Math.min(60, Math.round((tp.a / DEG) * 2) / 2)); }
  else if (k === "ball") { const lim = bl.kind === "bowl" ? P.SURF_W - 0.3 : 23; bl.x = clamp((p.x - BC[0]) / BK, -lim, lim); bl.v = 0; }
  else if (k === "A" || k === "B") { const g = lv[k], hNew = clamp(Math.round(((p.x - PIV[0]) / LK + lv.po) / P.LEVER.step), -6, 6); if (hNew !== 0 && hNew !== g.h) { g.h = hNew; (k === "A" ? LAh : LBh).set(hNew); } }
  else if (k === "ring") { const ud = lv.dh * P.LEVER.step - lv.po, [dx, dy] = lvW(ud, 0), side = Math.sign(ud) || 1, ph = Math.atan2((p.x - dx) * side, Math.abs(p.y - dy)) / DEG; lv.phi = clamp(Math.round(ph), 0, 60); LPhi.set(lv.phi); }
  else if (k === "hand") { mc.s = clamp(drag.s0 + (drag.dir * (p.y - drag.y0)) / MK, 0, sMax()); mc.psi = mc.s / mc.R; }
  else if (k === "crank") { const a = angAt(p, [250, 96]), d = P.wrapPi(a - drag.a0); drag.a0 = a; mc.s = clamp(mc.s + d * mc.R, 0, sMax()); mc.psi = mc.s / mc.R; }
  customized(); refresh();
}
function endDrag() {
  if (!drag) return;
  if (drag.k === "plate") { pl.held = false; pl.w = 0; }
  if (drag.k === "box") releaseTip();
  if (drag.k === "ball") { bl.held = false; bl.v = 0; }
  drag = null; kick(); refresh();
}
// 360° kamera: bo'sh joydan sudrash — aylantirish; asbob ustidan — o'sha asbob (ekran nuqtasi asboblar tekisligiga o'tkaziladi)
const worldHit = (x, y) => { const p = scene.toWorld(x, y); return p ? hitTest(p) : null; };
scene.lab.hit = (x, y) => { const h = worldHit(x, y); return h ? (h.k === "hole" ? `hole${h.i}` : h.k) : null; };
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id, p) { const h = worldHit(p.x, p.y), w = scene.toWorld(p.x, p.y); if (h && w) startDrag(h, w); },
  move(id, p) { const w = scene.toWorld(p.x, p.y); if (drag && w) onDrag(w); },
  end() { endDrag(); },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setPlate = (shapeId, showCm = false, lines = []) => () => { ui.kind.cm = "plate"; pl.shape = shapeId; pl.hole = 0; pl.showCm = showCm; resetPlate(); for (const i of lines) { pl.hole = i; pl.th = plEq(); drawPlumbLine(); } pl.hole = lines.length ? (lines.at(-1) + 1) % 3 : 0; if (lines.length) { pl.th = plEq() + 0.5; } };
const setTip = (size, f, aDeg, held = true) => () => { ui.kind.cm = "tip"; Object.assign(tp, { size, f, a: aDeg * DEG, w: 0, rest: aDeg ? null : "up", held }); };
const setBall = (k, x, held = false) => () => { ui.kind.cm = "ball"; Object.assign(bl, { kind: k, x, v: 0, held }); };
const setLever = (A, B, o = {}) => () => { lv.A = { n: A[0], h: A[1] }; lv.B = { n: B[0], h: B[1] }; Object.assign(lv, { dyn: false, dh: 5, phi: 0, po: 0, b: 0, w: 0 }, o); };
const setMech = (k, m, o = {}) => () => { ui.kind.mech = k; Object.assign(mc, { m, n: 4, R: 0.3, ideal: false, s: 0, auto: 0, psi: 0 }, o); };
const PRESETS = {
  plateL: { mode: "cm", title: "Massa markazini topish (L shakl)", lesson: "Plastinka A teshikdan osilgan va tebranmoqda. To‘xtagach «Shovun bo‘ylab chiziq chizish» ni bosing. So‘ng B teshikni bosing (yoki sahnada B harfini), yana chiziq chizing. Kesishish nuqtasi — massa markazi. C teshik bilan tekshiring.", set: setPlate("L") },
  plateTri: { mode: "cm", title: "Uchburchak: medianalar", lesson: "Uchburchak plastinkaning massa markazi medianalar kesishgan nuqtada (har bir medianani 2 : 1 nisbatda bo‘ladi). Ikki teshikdan osib tekshiring.", set: setPlate("tri") },
  plateDisk: { mode: "cm", title: "Teshikli disk", lesson: "Diskdan doira kesib olingan: massa markazi geometrik markazdan siljigan. Ikki chiziq allaqachon chizilgan — kesishish nuqtasini va hisoblangan markazni solishtiring.", set: setPlate("disk", true, [0, 1]) },
  plateArch: { mode: "cm", title: "Taqa: markaz jismdan tashqarida", lesson: "Yarim halqa shaklidagi plastinka. Chiziqlar bo‘shliqda kesishadi: massa markazi jism materialida emas.", set: setPlate("arch", true, [1, 2]) },
  tipTall: { mode: "cm", title: "Baland quti: αₖᵣ ≈ 18°", lesson: "Quti 15° ga og‘dirilgan va qo‘lda ushlab turilibdi. «Qo‘yib yuborish» ni bosing — u qaytadi. So‘ng sahnada 20° dan oshiring va qo‘yib yuboring — ag‘dariladi.", set: setTip("tall", 0.5, 15) },
  tipHeavy: { mode: "cm", title: "Og‘ir asos: turg‘unroq", lesson: "Xuddi shu qutining tagida po‘lat yuk: massa markazi balandlikning 25 % ida. Kritik burchak 18° dan 34° ga oshdi — 25° da ham qaytadi.", set: setTip("tall", 0.25, 25) },
  ballBowl: { mode: "cm", title: "Turg‘un muvozanat", lesson: "Botiq sirtdagi sharcha chetga surib qo‘yib yuborilgan: u muvozanat holati atrofida tebranib, pastki nuqtada to‘xtaydi.", set: setBall("bowl", 8) },
  ballDome: { mode: "cm", title: "Turg‘unmas muvozanat", lesson: "Sharcha qavariq sirt cho‘qqisidan 2 mm siljigan holda qo‘yib yuborildi — dumalab tushib ketadi. Uni sahnada aynan cho‘qqiga qo‘yib ko‘ring.", set: setBall("dome", 0.2) },
  ballFlat: { mode: "cm", title: "Befarq muvozanat", lesson: "Tekis gorizontal taxta: sharchani istalgan joyga qo‘ying — u o‘sha yerda qoladi.", set: setBall("flat", 6) },
  balance: { mode: "lever", title: "Moment qoidasi: 2 × 15 = 3 × 10", lesson: "Chapda 2 ta yuk 15 cm da (M₁ = 1,96·0,15 = 0,294 N·m), o‘ngda 3 ta yuk 10 cm da (M₂ = 2,94·0,10 = 0,294 N·m): richag muvozanatda. Yuklarni boshqa teshikka surib ko‘ring.", set: setLever([2, -3], [3, 2]) },
  unbal: { mode: "lever", title: "Momentlar teng emas", lesson: "Kuchlar teng (3 ta va 3 ta yuk), lekin yelkalar har xil: o‘ng tomon og‘ir. Momentlar tenglashishi uchun o‘ng yuklarni qaysi teshikka surish kerak?", set: setLever([3, -2], [3, 4]) },
  dynUp: { mode: "lever", title: "Dinamometr bilan o‘lchash", lesson: "Chapda 4 ta yuk 10 cm da, o‘ngda dinamometr 25 cm da pastga tortadi: F = 3,92·10/25 = 1,57 N. Dinamometrni boshqa teshikka o‘tkazing — kuch yelkaga teskari proporsional.", set: setLever([4, -2], [0, 3], { dyn: true, dh: 5 }) },
  dynAngle: { mode: "lever", title: "Qiya tortish: yelka kamayadi", lesson: "Dinamometr vertikaldan 50° og‘gan: kuch yelkasi d·cos 50° = 0,64d. Ko‘rsatish vertikal tortgandagidan 1,56 marta katta. Dinamometr halqasini sahnada surib ko‘ring.", set: setLever([4, -2], [0, 3], { dyn: true, dh: 5, phi: 50 }) },
  offset: { mode: "lever", title: "Tayanch siljigan: richag og‘irligi", lesson: "Tayanch richag o‘rtasidan 10 cm o‘ngda. Yuklarsiz ham richag chapga og‘adi: uning og‘irligi (0,98 N, massa markazi o‘rtada, yelkasi 10 cm) moment beradi. O‘ngdagi 4-teshikka (tayanchdan 10 cm) bitta yuk osing — richag muvozanatlashadi.", set: setLever([0, -3], [0, 4], { po: 0.1 }) },
  fixed: { mode: "mech", title: "Qo‘zg‘almas blok", lesson: "1 kg yuk. Dinamometrni pastga torting: yuk xuddi shuncha masofaga ko‘tariladi, kuch ~mg (ishqalanish tufayli biroz ko‘p).", set: setMech("fixed", 1) },
  movable: { mode: "mech", title: "Qo‘zg‘aluvchan blok", lesson: "2 kg yuk qo‘zg‘aluvchan blokda: dinamometr ~10 N ko‘rsatadi — mg/2 dan biroz ko‘p (blok massasi, ishqalanish). Ipni yuqoriga torting: yuk ip yo‘lining yarmicha ko‘tariladi.", set: setMech("movable", 2) },
  tackle: { mode: "mech", title: "Polispast (4 ip)", lesson: "5 kg yukni 4 ta ip ushlab turibdi: dinamometr ~14,5 N (ideal holda 12,25 N). Ipni 40 cm tortsangiz, yuk 10 cm ko‘tariladi. Natijalardagi «Ish» va «FIK η» ni solishtiring.", set: setMech("tackle", 5, { n: 4, auto: 1 }) },
  golden: { mode: "mech", title: "Oltin qoida (ideal)", lesson: "Ideal (ishqalanishsiz, yengil) qo‘zg‘aluvchan blok: F = mg/2 aniq, s = 2h, F·s = mgh — ishdan yutuq yo‘q. Natijalarda to‘liq va foydali ish teng, η = 100 %.", set: setMech("movable", 2, { ideal: true, auto: 1 }) },
  axle: { mode: "mech", title: "Chig‘ir: quduqdan suv", lesson: "10 kg suvli chelak. Dasta 30 cm, baraban 5 cm: kerakli kuch ~6 marta kichik (~18 N). Dastani sahnada aylantiring: bir aylanishda chelak 31 cm ko‘tariladi, qo‘l esa 1,9 m yo‘l bosadi.", set: setMech("axle", 10) },
};
const GROUPS = [["Massa markazi va muvozanat", ["plateL", "plateTri", "plateDisk", "plateArch", "tipTall", "tipHeavy", "ballBowl", "ballDome", "ballFlat"]], ["Richag", ["balance", "unbal", "dynUp", "dynAngle", "offset"]], ["Bloklar va chig‘ir", ["fixed", "movable", "tackle", "golden", "axle"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { plate: "Plastinkani surib tebrating, teshikni bosing", tip: "Qutini o‘ngga suring va qo‘yib yuboring", ball: "Sharchani suring va qo‘yib yuboring", lever: "Yuklarni teshiklarga suring, dinamometr halqasini torting", fixed: "Dinamometrni pastga torting", movable: "Dinamometrni yuqoriga torting", tackle: "Dinamometrni pastga torting", axle: "Chig‘ir dastasini aylantiring" };
const KIND_DEFAULT = { plate: "plateL", tip: "tipTall", ball: "ballBowl", lever: "balance", fixed: "fixed", movable: "movable", tackle: "tackle", axle: "axle" };
const MODE_DEFAULT = { cm: "plateL", lever: "balance", mech: "fixed" };
const defaultFor = () => KIND_DEFAULT[kind()];
function setModeUI() {
  const k = kind();
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === k)));
  document.querySelectorAll("[data-kctl]").forEach((el) => { el.hidden = !el.dataset.kctl.split(" ").includes(k); });
  $("[data-mode-hint]").textContent = MODE_HINT[k];
  stage.canvas.setAttribute("aria-label", { plate: "Shtativga osilgan fanera plastinka va shovun", tip: "Stol ustidagi yog‘och quti", ball: "Sirtdagi po‘lat sharcha", lever: "Laboratoriya richagi, yuklar va dinamometr", fixed: "Qo‘zg‘almas blok, yuk va dinamometr", movable: "Qo‘zg‘aluvchan blok, yuk va dinamometr", tackle: "Polispast, yuk va dinamometr", axle: "Quduq chig‘iri va chelak" }[k]);
}
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.kindValue !== kind()) loadPreset(KIND_DEFAULT[b.dataset.kindValue]); }));
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { const m = b.dataset.modeValue; if (m !== ui.mode) loadPreset(m === "lever" ? MODE_DEFAULT.lever : KIND_DEFAULT[ui.kind[m]] || MODE_DEFAULT[m]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; flashUntil = 0;
  p.set();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncPlate(); syncTip(); syncBall(); syncLever(); syncMech(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "plateL");
document.fonts?.ready.then(() => stage.render());

// Node/Playwright tekshiruvi uchun
window.__statics = { scene, hits, plW, pl, tp, bl, lv, mc, ui, loadPreset, refresh, stepPlate, stepTip, stepBall, stepLever, stepMech, kind, pp, plEstimate, lvMom, lvF, mRes, get drag() { return drag; } };
