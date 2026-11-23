// ==========================================================================
// Kulon qonuni va elektr maydon — virtual laboratoriya (simulations/coulomb-law.html)
// 1) Kulon qonuni: shtativga ipak ipda osilgan folga qoplangan po'kak sharcha va organik shisha stenddagi sharcha.
//    Stendni chizg'ich bo'ylab surish, transportirdan og'ish burchagini o'qish, F = mg·tg α ni grafikka yozish,
//    Kulon usuli bilan zaryadni teng bo'lish (neytral sharcha tegizish), tortishishda tegib zaryadlarning tenglashishi.
// 2) Superpozitsiya: moy quyilgan kyuvetadagi zaryadli elektrodlar, kuch chiziqlari, yorma donalari, sinov zaryadi q₀
//    va undagi E₁, E₂, … hamda natijaviy E vektorlari (bitta chiziqli masshtab, parallelogramm/ko'pburchak).
// 3) Zaryadlangan shar: Van de Graaf generatori sferasi (metall) yoki tekis zaryadlangan dielektrik shar, kesim,
//    izolyator dastali zond, havoning teshilishi va yerga ulangan sharchaga uchqun.
// 360° 3D laboratoriya: coulomb-lab-3d.js (har uch tajriba stol ustida; kamera aylanadi, asboblar sudraladi).
// Dunyo koordinatalari mm da (har rejimda o'z o'lchami). Fizika: coulomb-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { fieldLines } from "./inverse-square.js";
import * as P from "./coulomb-physics.js";
import { drawLaw, drawSphere, lastFrame } from "./coulomb-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261123-cg";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-cg";
import { createCoulombLab } from "./coulomb-lab-3d.js?v=20261123-cg";

const $ = (s) => document.querySelector(s);
const DEG = Math.PI / 180, MM = 1e-3, NC = P.NC;

/* ------------------------------------------------------------------ Holat */

// 1) Osma sharcha: osilish nuqtasi, ip, sharcha radiusi (mm), chizg'ich noli
const PX = 150, PY = 12, LEN = 150, RB = 5, RULER0 = 60, TABLE = 204;
// 3) Shar: markaz, yerga ulangan sharcha
const CX = 150, CY = 130, DX = 432, DR = 14, STAND_TOP = 236, TABLE3 = 262;

const ui = { mode: "law", view: { law: "r", sph: "E" }, hover: null, show: { forces: true, lines: true, grains: false, parts: true, cut: true, names: false } };
const law = { q1: 7, q2: 7, D: 40, m: 0.05, a: 0, w: 0, pts: [], flash: 0, shared: 0, halveT: 0 };
const sup = { charges: [], sel: 0, probe: { x: 180, y: 60 }, med: "air" };
const sph = { Q: 400, R: 8, type: "shell", probe: { x: 300, y: 130 }, spark: 0, sparkSeed: 1, belt: 0, beltT: 0, rate: 0, sparks: 0 };
let presetId = null;
let running = false;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const qText = (q, d = 1) => `${q > 0 ? "+" : q < 0 ? "−" : ""}${fmt(Math.abs(q), Math.abs(q) % 1 ? d : 0)} nC`;

/* ================================================================== 1) Kulon qonuni */

/** Fizika moduli uchun SI qiymatlar (m slayderda grammda) */
const lawObj = () => ({ L: LEN * MM, D: law.D * MM, m: law.m * 1e-3, r: RB * MM, q1: law.q1 * NC, q2: law.q2 * NC, eps: P.MEDIA.air.eps });
const bob = () => ({ x: PX + LEN * Math.sin(law.a), y: PY + LEN * Math.cos(law.a) });
const fixed = () => ({ x: PX + law.D, y: PY + LEN });
const lawGap = () => P.gap(LEN * MM, law.D * MM, law.a);

/** Muvozanatga darhol o'tkazish (pauza yoki «kamroq harakat»). Tegsa — zaryad teng bo'linadi va qayta hisoblanadi. */
function settleLaw() {
  for (let k = 0; k < 3; k++) {
    const eq = P.equilibrium(lawObj());
    law.a = eq.a; law.w = 0;
    if (!eq.contact) return;
    if (!shareLaw()) return;
  }
}
/** Sharchalar tekkanda zaryadlar tenglashadi; o'zgargan bo'lsa true */
function shareLaw() {
  if (Math.abs(law.q1 - law.q2) < 1e-9) return false;
  const [a, b] = P.share(law.q1, law.q2);
  law.q1 = a; law.q2 = b; law.shared = 1.2;
  q1C.set(law.q1); q2C.set(law.q2); lawOut();
  return true;
}
function stepLaw(dt) {
  const o = lawObj(), L = o.L, m = o.m, aT = P.touchAngle(L, o.D, 2 * o.r);
  const n = Math.ceil(dt / 0.0008), h = dt / n;
  for (let i = 0; i < n; i++) {
    const bx = L * Math.sin(law.a), by = L * Math.cos(law.a), dx = bx - o.D, dy = by - L, d = Math.hypot(dx, dy);
    const F = P.coulomb(o.q1, o.q2, d, o.eps);
    const Ft = (F * (dx * Math.cos(law.a) - dy * Math.sin(law.a))) / d;
    const acc = (Ft - m * P.G * Math.sin(law.a)) / (m * L) - 2.2 * law.w;
    law.w += acc * h; law.a += law.w * h;
    if (law.a >= aT) {
      law.a = aT; law.w = -0.25 * Math.abs(law.w);
      if (shareLaw()) { o.q1 = law.q1 * NC; o.q2 = law.q2 * NC; }
    }
    law.a = clamp(law.a, -80 * DEG, 80 * DEG);
  }
}
const lawSettled = () => Math.abs(law.w) < 0.02;

/* ================================================================== 2) Superpozitsiya */

const TRAY = { x0: 6, y0: 6, x1: 354, y1: 206 };
const RC = 7, RP = 3.5, Q0 = 1; // elektrod radiusi, zond radiusi (mm), sinov zaryadi (nC)
const eps2 = () => P.MEDIA[sup.med].eps;
const chargesSI = () => sup.charges.map((q) => ({ x: q.x * MM, y: q.y * MM, q: q.q * NC }));
const fieldAt = (x, y) => P.field(chargesSI(), x * MM, y * MM, eps2());
let lineCache = { key: "", lines: [] };
let grainCache = { key: "", g: [] };
const GRAINS = (() => { let a = 7; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; return Array.from({ length: 850 }, () => ({ x: TRAY.x0 + 4 + r() * (TRAY.x1 - TRAY.x0 - 8), y: TRAY.y0 + 4 + r() * (TRAY.y1 - TRAY.y0 - 8), n: r() - 0.5, l: 0.7 + r() * 0.6 })); })();

/* ================================================================== 3) Zaryadlangan shar */

const sphQ = () => sph.Q * NC, sphR = () => sph.R / 100;
const sphProbeR = () => dist(sph.probe.x, sph.probe.y, CX, CY) * MM;
const Qmax = () => P.maxCharge(sphR()) / NC;


/* ------------------------------------------------------------------ Sahna (3D) */

const scene = createCoulombLab();
const GEOM = { PX, PY, LEN, RB, RULER0, TABLE, TRAY, RC, RP, CX, CY, DX, DR, STAND_TOP, TABLE3 };
/** Joriy holatdan sahna uchun kadr: fizik kattaliklar shu yerda, 3D modul faqat chizadi. */
function frame() {
  if (ui.mode === "law") {
    const b = bob(), f = fixed();
    let forces = null;
    if (ui.show.forces && (law.q1 || law.q2)) {
      const o = lawObj(), d = lawGap(), F = P.coulomb(o.q1, o.q2, d), mg = o.m * P.G, k = 55 / mg; // 55 mm = mg
      const ux = (b.x - f.x) / dist(b.x, b.y, f.x, f.y), uy = (b.y - f.y) / dist(b.x, b.y, f.x, f.y);
      const T = { x: -(F * ux), y: -(F * uy) - mg }; // ip tarangligi muvozanatda: −(F + mg)
      const Lc = (v) => clamp(v * k, -110, 110);
      forces = { mg: Lc(mg), T: lawSettled() ? { x: Lc(T.x), y: Lc(T.y) } : null, F: Math.abs(F) > 1e-9 ? { x: Lc(F * ux), y: Lc(F * uy) } : null };
    }
    return {
      mode: "law", geom: GEOM, q1: law.q1, q2: law.q2, a: law.a, bob: b, fixed: f, forces, halveT: law.halveT, names: ui.show.names,
      shared: law.shared > 0, sharedText: "Tegdi: zaryadlar teng bo‘lindi",
      q1Text: `q₁ = ${qText(law.q1)}`, q2Text: `q₂ = ${qText(law.q2)}`, aText: `α = ${fmt(Math.abs(law.a) / DEG, 1)}°`,
      note: "Haqiqiy o‘lcham: ip 15 cm, sharchalar r = 5 mm · kuch vektorlari shartli",
    };
  }
  if (ui.mode === "sup") {
    const charges = sup.charges, med = P.MEDIA[sup.med], any = charges.some((q) => q.q);
    let lines = null, grains = null, E = null;
    if (ui.show.lines && any) {
      const key = JSON.stringify(charges);
      if (key !== lineCache.key) lineCache = { key, lines: fieldLines(charges.map((q) => ({ x: q.x, y: q.y, q: q.q, r: RC })), TRAY, { minLines: 6, perUnit: 1.4, step: 1.6, maxSteps: 900 }) };
      lines = lineCache.lines;
    }
    // yorma donalari: maydon bo'ylab tiziladi; kuchsiz maydonda tartibsiz qoladi
    if (ui.show.grains && any) {
      const key = JSON.stringify(charges) + sup.med;
      if (key !== grainCache.key) {
        const ref = Math.max(...charges.map((q) => Math.abs(q.q))) * NC;
        const Eref = (P.K * ref) / (eps2() * 0.3 * 0.3); // 30 cm dagi maydon — "kuchsiz" chegarasi
        grainCache = { key, g: GRAINS.map((g) => { const f = fieldAt(g.x, g.y), k = clamp(Math.log10(Math.max(f.e, 1e-9) / Eref) / 1.3 + 0.5, 0, 1); return { ...g, a: Math.atan2(f.ey, f.ex) + g.n * (1 - k) * 0.7 * Math.PI, k }; }) };
      }
      grains = grainCache.g;
    }
    const f = fieldAt(sup.probe.x, sup.probe.y);
    if (charges.length && f.e > 0) E = { ex: f.ex, ey: f.ey, e: f.e, parts: f.parts.map((q, i) => ({ ...q, i })).filter((q) => q.e > 0) };
    return {
      mode: "sup", geom: GEOM, charges, sel: sup.sel, probe: sup.probe, lines, grains, E, showParts: ui.show.parts,
      oil: sup.med !== "air", eps: med.eps, medText: `${med.name}: ε = ${fmt(med.eps, med.eps % 1 ? 1 : 0)}`, qText: (q) => qText(q),
      note: "Kyuveta tubida 1 cm li to‘r · E vektorlari bitta chiziqli masshtabda",
    };
  }
  const rr = sphProbeR(), E = P.sphereE(sphQ(), sphR(), rr, sph.type);
  let Evec = null;
  if (Math.abs(E) > 0 && rr > 1e-4) {
    const Es = P.sphereE(sphQ(), sphR(), sphR(), sph.type), frac = clamp(Math.sqrt(Math.abs(E / Es)), 0.12, 1);
    const ux = (sph.probe.x - CX) / (rr / MM), uy = (sph.probe.y - CY) / (rr / MM);
    Evec = { x: Math.sign(E) * ux * frac, y: Math.sign(E) * uy * frac };
  }
  return {
    mode: "sph", geom: GEOM, Q: sph.Q, R: sph.R, type: sph.type, probe: sph.probe, spark: sph.spark, sparkSeed: sph.sparkSeed, belt: sph.belt,
    lines: ui.show.lines, cut: ui.show.cut, Evec, RText: `R = ${fmt(sph.R, 1)} cm`, QText: `Q = ${qText(sph.Q, 0)}`,
    note: ui.show.cut ? "Kesim: sharning old yarmi olib tashlangan · kuch chiziqlari shartli" : "Kuch chiziqlari shartli",
  };
}
function draw(ctx, stg) { scene.draw(ctx, stg, frame()); }
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });


/* ------------------------------------------------------------------ Grafik */

function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "law") {
    const o = lawObj(), d = lawGap();
    return drawLaw(ctx, gs, { view: ui.view.law, q1: o.q1, q2: o.q2, r: d, F: P.measuredForce(o.m, law.a), pts: law.pts, hover: ui.hover });
  }
  if (ui.mode === "sph") return drawSphere(ctx, gs, { view: ui.view.sph, Q: sphQ(), R: sphR(), type: sph.type, r: sphProbeR(), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  law: [["r", "F(r)", "Kuchning masofaga bog‘liqligi F(r)", "Ko‘k — Kulon qonuni hozirgi zaryadlar uchun, yashil nuqtalar — siz yozgan o‘lchashlar (F = mg·tg α). Kulrang — boshqa zaryadlarda yozilgan nuqtalar."],
    ["inv", "F(1/r²)", "Kuch 1/r² ga proporsional", "Agar F ∝ 1/r² bo‘lsa, nuqtalar koordinata boshidan o‘tuvchi to‘g‘ri chiziqda yotadi. Shtrix — o‘lchashlar bo‘yicha eng kichik kvadratlar to‘g‘ri chizig‘i."]],
  sph: [["E", "E(r)", "Maydon kuchlanganligi E(r)", "Kulrang soha — shar ichi. Metall shar ichida maydon yo‘q, sirtda sakrab kQ/R² ga yetadi; tashqarida ikkala shar ham nuqtaviy zaryaddek: E = kQ/r²."],
    ["phi", "φ(r)", "Potensial φ(r)", "Metall shar ichida potensial o‘zgarmas va sirtdagiga teng (kQ/R). Potensial uzluksiz, maydon esa — uning qiyaligi."]],
};
function setTabs() {
  const box = $("[data-tabs]"), card = $("[data-graph-card]");
  card.hidden = ui.mode === "sup";
  if (card.hidden) return;
  const tabs = TABS[ui.mode], cur = ui.view[ui.mode], t = tabs.find((x) => x[0] === cur);
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === cur}">${name}</button>`).join("");
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[ui.mode] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
/** Maydon kuchlanganligi: N/C → mos birlik */
const fE = (e, unit = "N/C") => { const a = Math.abs(e); return a >= 1e6 ? u(fmt(e / 1e6, 2), unit === "N/C" ? "MN/C" : "MV/m") : a >= 1e3 ? u(fmt(e / 1e3, a >= 1e5 ? 0 : 1), unit === "N/C" ? "kN/C" : "kV/m") : u(fmt(e, 0), unit); };
const fV = (v) => { const a = Math.abs(v); return a >= 1e6 ? u(fmt(v / 1e6, 2), "MV") : a >= 1e3 ? u(fmt(v / 1e3, a >= 1e5 ? 0 : 1), "kV") : u(fmt(v, 0), "V"); };

function updateReadouts() {
  if (ui.mode === "law") {
    const o = lawObj(), d = lawGap(), Fk = Math.abs(P.coulomb(o.q1, o.q2, d)), Fm = P.measuredForce(o.m, law.a);
    const kind = !law.q1 || !law.q2 ? "ta’sir yo‘q" : law.q1 * law.q2 > 0 ? "itarilish" : "tortishish";
    setRO("r1", "Osma sharcha <i>q</i>₁", u(fmt(law.q1, 1), "nC"), `${P.maxCharge(RB * MM) / NC > Math.abs(law.q1) ? "folga qoplangan po‘kak, r = 5 mm" : "havo teshilish chegarasida"}`);
    setRO("r2", "Stenddagi sharcha <i>q</i>₂", u(fmt(law.q2, 1), "nC"), kind, kind === "itarilish" ? "orange" : kind === "tortishish" ? "blue" : "");
    setRO("r3", "Markazlar orasidagi masofa <i>r</i>", u(fmt(d * 100, 2), "cm"), `stend D = ${fmt(law.D / 10, 1)} cm; osma sharcha ${fmt(Math.abs(LEN * Math.sin(law.a)) / 10, 2)} cm ga og‘di`);
    setRO("r4", "Og‘ish burchagi <i>α</i>", u(fmt(Math.abs(law.a) / DEG, 1), "°"), lawSettled() ? "transportirdan" : "tebranmoqda — to‘xtashini kuting", lawSettled() ? "" : "purple");
    setRO("r5", "O‘lchangan kuch <i>F</i> = <i>mg</i>·tg <i>α</i>", u(fmt(Fm * 1000, 3), "mN"), `m = ${fmt(law.m, 2)} g, mg = ${fmt(o.m * P.G * 1000, 2)} mN`, "orange");
    const err = Fk > 0 ? ((Fm - Fk) / Fk) * 100 : 0;
    setRO("r6", "Kulon qonuni <i>F</i> = <i>k</i>|<i>q</i>₁<i>q</i>₂|/<i>r</i>²", u(fmt(Fk * 1000, 3), "mN"), Fk > 0 && lawSettled() ? `farq ${fmt(err, 1)} % — kuch ip bo‘ylab to‘liq gorizontal emas` : "N = 9·10⁹·|q₁q₂|/r²", "green");
  } else if (ui.mode === "sup") {
    const p = sup.probe, f = fieldAt(p.x, p.y), th = Math.atan2(-f.ey, f.ex) / DEG, phi = P.potentialAt(chargesSI(), p.x * MM, p.y * MM, eps2());
    setRO("r1", "Natijaviy maydon <i>E</i>", fE(f.e), f.e < 1 ? "bu nuqtada maydonlar bir-birini yo‘qotadi" : `${f.parts.length} ta zaryad maydonining vektor yig‘indisi`, "orange");
    setRO("r2", "Yo‘nalishi <i>θ</i> (Ox dan)", f.e < 1 ? "—" : u(fmt((th + 360) % 360, 0), "°"), "soat strelkasiga teskari");
    setRO("r3", "<i>E<sub>x</sub></i> = Σ <i>E<sub>ix</sub></i>", fE(f.ex), f.parts.map((q, i) => `E${"₁₂₃₄₅"[i]}x = ${sci(q.ex, 2)}`).join(", "));
    setRO("r4", "<i>E<sub>y</sub></i> = Σ <i>E<sub>iy</sub></i>", fE(-f.ey), "y o‘qi yuqoriga");
    setRO("r5", "Sinov zaryadiga kuch <i>F</i> = <i>q</i>₀<i>E</i>", u(fmt(Q0 * NC * f.e * 1e6, 1), "μN"), `q₀ = +${Q0} nC, F ∥ E`);
    setRO("r6", "Potensial <i>φ</i> = Σ <i>kq<sub>i</sub></i>/(<i>εr<sub>i</sub></i>)", fV(phi), "skalyar — oddiy yig‘iladi");
  } else {
    const Q = sphQ(), R = sphR(), r = sphProbeR(), E = P.sphereE(Q, R, r, sph.type), phi = P.spherePhi(Q, R, r, sph.type), Es = Math.abs(P.sphereE(Q, R, R)), pct = (Es / P.E_BD) * 100;
    setRO("r1", "Shar zaryadi <i>Q</i>", u(fmt(Math.round(sph.Q), 0), "nC"), `σ = ${sci(P.surfaceDensity(Q, R) * 1e6, 3)} μC/m²${sph.sparks ? ` · uchqunlar: ${sph.sparks}` : ""}`);
    setRO("r2", "Shar radiusi <i>R</i>", u(fmt(sph.R, 1), "cm"), `sig‘im C = 4πε₀R = ${fmt(P.capacitance(R) * 1e12, 1)} pF`);
    setRO("r3", "Zondgacha masofa <i>r</i>", u(fmt(r * 100, 1), "cm"), r < R ? "shar ichida" : "shar tashqarisida", r < R ? "purple" : "");
    setRO("r4", "Zondda maydon <i>E</i>", fE(Math.abs(E), "V/m"), r < R ? (sph.type === "shell" ? "o‘tkazgich ichida E = 0" : "E = kQr/R³ — markazga qarab kamayadi") : "E = kQ/r²", "orange");
    setRO("r5", "Zondda potensial <i>φ</i>", fV(phi), r < R && sph.type === "shell" ? "ichida φ = kQ/R — o‘zgarmas" : r < R ? "φ = kQ(3R² − r²)/(2R³)" : "φ = kQ/r");
    setRO("r6", "Sirtdagi maydon <i>E</i><sub>sirt</sub>", fE(Es, "V/m"), `havo teshilishining ${fmt(pct, 0)} % i (3 MV/m); Q_max = ${fmt(Qmax(), 0)} nC`, pct >= 90 ? "red" : pct >= 60 ? "orange" : "green");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "law") {
    if (law.shared > 0) { t = "Sharchalar tegdi — zaryad bo‘lindi"; tone = "orange"; }
    else if (!law.q1 || !law.q2) { t = "Zaryadsiz — og‘ish yo‘q"; tone = ""; }
    else if (!lawSettled()) { t = "Sharcha tebranmoqda"; tone = "purple"; }
    else { t = law.q1 * law.q2 > 0 ? "Itarilish: muvozanat" : "Tortishish: muvozanat"; tone = law.q1 * law.q2 > 0 ? "orange" : "blue"; }
  } else if (ui.mode === "sup") {
    const f = fieldAt(sup.probe.x, sup.probe.y); t = `E = ${sci(f.e, 3)} N/C`; tone = "orange";
  } else {
    if (sph.spark > 0) { t = "Uchqun! Havo teshildi"; tone = "red"; }
    else if (!sph.Q) { t = "Shar zaryadsiz"; tone = ""; }
    else { const pct = Math.abs(P.sphereE(sphQ(), sphR(), sphR())) / P.E_BD; t = pct > 0.9 ? "Teshilishga yaqin" : sphProbeR() < sphR() ? "Zond shar ichida" : "Zond shar tashqarisida"; tone = pct > 0.9 ? "red" : "blue"; }
  }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "law") {
    const o = lawObj(), d = lawGap(), Fk = Math.abs(P.coulomb(o.q1, o.q2, d));
    if (!law.q1 || !law.q2) p.push("<p>Sharchalardan biri zaryadsiz — nuqtaviy zaryadlar modelida ular orasida kuch yo‘q, ip vertikal turadi. (Haqiqiy tajribada zaryadsiz folga sharcha ham zaryadlangan jismga biroz tortiladi: unda induksiya orqali zaryadlar ajraladi.)</p>");
    else {
      p.push(`<p>Sharchalar ${law.q1 * law.q2 > 0 ? "<b>bir xil ishorali</b> — itariladi" : "<b>har xil ishorali</b> — tortishadi"}. Osma sharchaga uchta kuch ta’sir qiladi: og‘irlik <b>mg</b>, ip tarangligi <b>T</b> va Kulon kuchi <b>F</b>. Muvozanatda ular yig‘indisi nolga teng, shuning uchun <b>tg α = F/(mg)</b>: burchakni o‘lchab, kuchni topamiz — F = ${fmt(P.measuredForce(o.m, law.a) * 1000, 3)} mN (formula bo‘yicha ${fmt(Fk * 1000, 3)} mN).</p>`);
      p.push(`<p>Stendni suring va har safar «Nuqta yozish»ni bosing (${law.pts.length} ta nuqta). Masofa 2 marta kamaysa, kuch 4 marta ortadi — «F(1/r²)» grafigida nuqtalar to‘g‘ri chiziqqa tushadi.</p>`);
      if (law.q1 * law.q2 < 0) p.push("<p>Tortishishda sharchalar yaqinlashgan sari kuch tez ortadi: yetarlicha yaqin bo‘lsa, sharcha stenddagisiga «yopishadi». Tekkanda bir xil o‘tkazgich sharchalarning zaryadi tenglashadi — (q₁ + q₂)/2 — va ular endi itariladi.</p>");
      else p.push("<p>Kulon zaryadni o‘lchay olmagan, lekin uni aniq bo‘la olgan: zaryadlangan sharchaga xuddi shunday neytral sharcha tegizilsa, zaryad teng ikkiga bo‘linadi. «Neytral sharcha tegizish»ni bosing: q₂ ikki marta kamayadi — kuch ham ikki marta kamayishini tekshiring.</p>");
    }
  } else if (ui.mode === "sup") {
    const f = fieldAt(sup.probe.x, sup.probe.y);
    p.push("<p><b>Superpozitsiya prinsipi</b>: har bir zaryad maydoni boshqalariga bog‘liq bo‘lmaydi, natijaviy maydon — vektorlar yig‘indisi: <b>E = E₁ + E₂ + …</b>. Shtrix chiziqlar vektorlarni uchma-uch qo‘yishni ko‘rsatadi (ikki vektor uchun — parallelogramm qoidasi).</p>");
    if (f.e < 0.02 * Math.max(...f.parts.map((q) => q.e), 1)) p.push("<p>Sinov zaryadi deyarli <b>E = 0</b> nuqtada: zaryadlarning maydonlari moduli teng va qarama-qarshi yo‘nalgan. Bu yerga qo‘yilgan zaryadga kuch ta’sir qilmaydi, potensial esa nolga teng bo‘lishi shart emas.</p>");
    else p.push(`<p>Kuch chiziqlari musbat zaryaddan boshlanib, manfiyda tugaydi; ular hech qachon kesishmaydi va chiziqqa urinma E yo‘nalishini beradi. Chiziqlar zich joyda maydon kuchli. Hozir E = ${sci(f.e, 3)} N/C.</p>`);
    if (sup.med !== "air") p.push(`<p>Kyuvetada ${P.MEDIA[sup.med].name.toLowerCase()} (ε = ${fmt(eps2(), 1)}): dielektrikning qutblanishi tufayli maydon havodagidan ${fmt(eps2(), 1)} marta kuchsiz, chiziqlar shakli esa o‘zgarmaydi. Moyga sepilgan yorma donalari qutblanib, kuch chiziqlari bo‘ylab tiziladi — maydonni «ko‘rish» usuli.</p>`);
  } else {
    const R = sphR(), Es = Math.abs(P.sphereE(sphQ(), R, R));
    p.push(sph.type === "shell"
      ? "<p><b>Metall shar</b> — o‘tkazgich: ortiqcha zaryadlar bir-birini itarib, faqat sirtga taqsimlanadi. Ichida maydon yo‘q (E = 0) — elektrostatik himoya (Faradey to‘ri) shunga asoslangan. Tashqarida shar maydoni markazdagi nuqtaviy Q zaryad maydonidek.</p>"
      : "<p><b>Dielektrik shar</b> hajmida tekis zaryadlangan: ichida maydon markazdan masofaga proporsional (E = kQr/R³), sirtda eng katta, tashqarida yana nuqtaviy zaryaddek kamayadi.</p>");
    p.push(`<p>Sirtdagi maydon E = kQ/R² = ${sci(Es, 3)} V/m. Havo taxminan <b>3 MV/m</b> da ionlashib, o‘tkazuvchan bo‘lib qoladi — shar zaryadini uchqun yoki «toj razryad» orqali yo‘qotadi. Bu radiusda Q<sub>max</sub> = ${fmt(Qmax(), 0)} nC: katta shar ko‘proq zaryad saqlaydi, shuning uchun Van de Graaf generatorlari sferasi katta va silliq qilinadi, chaqmoq qaytargich esa — o‘tkir.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "law" ? "<small>Kulon qonuni</small> F = k|q₁q₂|/r²" : ui.mode === "sup" ? "<small>Superpozitsiya</small> E = E₁ + E₂ + …" : "<small>Shar maydoni</small> E = kQ/r², r ≥ R";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); if (ui.mode !== "sup") graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0, wasMoving = true;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "law") {
    stepLaw(dt);
    if (law.shared > 0) law.shared = Math.max(0, law.shared - dt);
    if (law.halveT > 0) { const was = law.halveT; law.halveT = Math.max(0, law.halveT - dt); if (was > 0.6 && law.halveT <= 0.6) doHalve(); }
  } else if (ui.mode === "sph") {
    if (sph.spark > 0) sph.spark = Math.max(0, sph.spark - dt);
    if (sph.beltT > 0) { sph.beltT = Math.max(0, sph.beltT - dt); sph.belt += dt * 60; sph.Q += dt * sph.rate; if (!sph.beltT) sph.Q = Math.round(sph.Q); QC.set(clamp(Math.round(sph.Q), -5000, 5000)); checkSpark(); }
  }
  // 3D sahna faqat nimadir harakatlanayotganda qayta chiziladi (tinch holatda kadrlar bekorga yig'ilmaydi)
  const moving = ui.mode === "law" ? Math.abs(law.w) > 1e-4 || law.shared > 0 || law.halveT > 0 : ui.mode === "sph" ? sph.spark > 0 || sph.beltT > 0 : false;
  if (moving || wasMoving) stage.render();
  wasMoving = moving;
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode !== "sup") graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) { if (ui.mode === "law") settleLaw(); sph.spark = 0; sph.beltT = 0; refresh(); }
}
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || MODE_DEFAULT[ui.mode], false));

/** Lahzali o'zgarish (pauzada yoki «kamroq harakat»da): sharcha darhol muvozanatga o'tadi */
function afterLawChange() { if (!running) settleLaw(); refresh(); }

/* ------------------------------------------------------------------ Boshqaruv: 1) Kulon */

function lawOut() { $("#lq1Out").textContent = qText(law.q1); $("#lq2Out").textContent = qText(law.q2); }
const q1C = bindRange($("#lq1"), $("#lq1Out"), (v) => qText(v), (v) => { law.q1 = v; customized(); afterLawChange(); });
const q2C = bindRange($("#lq2"), $("#lq2Out"), (v) => qText(v), (v) => { law.q2 = v; customized(); afterLawChange(); });
const DC = bindRange($("#lD"), $("#lDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { law.D = v * 10; customized(); afterLawChange(); });
const mC = bindRange($("#lm"), $("#lmOut"), (v) => `${fmt(v, 2)} g`, (v) => { law.m = v; customized(); afterLawChange(); });
$("[data-record]").addEventListener("click", () => {
  if (!law.q1 || !law.q2) return;
  if (running && !lawSettled()) { flashStatus("Sharcha hali tebranmoqda — to‘xtashini kuting"); return; }
  const o = lawObj(), r = lawGap(), F = P.measuredForce(o.m, law.a);
  if (law.pts.length >= 14) law.pts.shift();
  law.pts.push({ r, F, qq: o.q1 * o.q2 });
  refresh();
});
function doHalve() { law.q2 /= 2; q2C.set(law.q2); lawOut(); if (!running) settleLaw(); refresh(); }
$("[data-halve]").addEventListener("click", () => {
  if (!law.q2) return; customized();
  if (running && !prefersReducedMotion()) law.halveT = 1.2; else doHalve();
});
let flashTimer = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "purple"; clearTimeout(flashTimer); flashTimer = setTimeout(updateStatus, 1800); }

/* ------------------------------------------------------------------ Boshqaruv: 2) Superpozitsiya */

const sqC = bindRange($("#sq"), $("#sqOut"), (v) => qText(v), (v) => { if (!sup.charges[sup.sel]) return; sup.charges[sup.sel].q = v; customized(); refresh(); });
const medSel = $("#smed");
medSel.addEventListener("change", () => { sup.med = medSel.value; customized(); refresh(); });
$("[data-add]").addEventListener("click", () => {
  if (sup.charges.length >= 5) { flashStatus("Ko‘pi bilan 5 ta zaryad"); return; }
  const spots = [[90, 60], [270, 150], [270, 60], [90, 150], [180, 175], [180, 35]];
  const spot = spots.find(([x, y]) => sup.charges.every((q) => dist(q.x, q.y, x, y) > 30) && dist(sup.probe.x, sup.probe.y, x, y) > 20) || [180, 106];
  sup.charges.push({ x: spot[0], y: spot[1], q: -(sup.charges[sup.charges.length - 1]?.q || -10) });
  sup.sel = sup.charges.length - 1; customized(); syncSup(); refresh();
});
$("[data-remove]").addEventListener("click", () => {
  if (sup.charges.length <= 1) { flashStatus("Kamida bitta zaryad qoladi"); return; }
  sup.charges.splice(sup.sel, 1); sup.sel = Math.min(sup.sel, sup.charges.length - 1); customized(); syncSup(); refresh();
});
function syncSup() { const q = sup.charges[sup.sel]; if (q) sqC.set(q.q); medSel.value = sup.med; }

/* ------------------------------------------------------------------ Boshqaruv: 3) Shar */

const QC = bindRange($("#pQ"), $("#pQOut"), (v) => qText(v, 0), (v) => { sph.Q = v; customized(); checkSpark(); refresh(); });
const RCt = bindRange($("#pR"), $("#pROut"), (v) => `${fmt(v, 1)} cm`, (v) => { sph.R = v; keepProbeOut(); customized(); checkSpark(); refresh(); });
document.querySelectorAll("[data-type-value]").forEach((b) => b.addEventListener("click", () => { sph.type = b.dataset.typeValue; customized(); syncSph(); refresh(); }));
function syncSph() { QC.set(clamp(Math.round(sph.Q), -5000, 5000)); $("#pQOut").textContent = qText(Math.round(sph.Q), 0); RCt.set(sph.R); document.querySelectorAll("[data-type-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.typeValue === sph.type))); }
/** Sirtda maydon 3 MV/m dan oshsa — uchqun: zaryad yerga ulangan sharchaga o'tadi */
function checkSpark() {
  const qm = Qmax();
  if (Math.abs(sph.Q) <= qm) return false;
  sph.Q = Math.sign(sph.Q) * Math.round(qm * 0.55); sph.spark = running ? 0.45 : 0; sph.sparkSeed = (sph.sparkSeed * 7 + 3) % 997 + 1; sph.sparks++; sph.beltT = 0;
  syncSph(); if (!running) flashStatus("Uchqun! Havo teshildi, zaryad kamaydi");
  return true;
}
$("[data-charge]").addEventListener("click", () => {
  customized();
  const step = Math.max(20, Math.round(Qmax() * 0.18)), sg = sph.Q < 0 ? -1 : 1;
  if (running && !prefersReducedMotion()) { sph.beltT = 1; sph.rate = sg * step; }
  else { sph.Q += sg * step; checkSpark(); syncSph(); refresh(); }
});
$("[data-ground]").addEventListener("click", () => { customized(); sph.Q = 0; sph.beltT = 0; syncSph(); refresh(); });
function keepProbeOut() { /* zond shar sirtiga "yopishib" qolmasin — joyida qoladi, faqat sahnadan chiqmaydi */ sph.probe.x = clamp(sph.probe.x, 8, 470); sph.probe.y = clamp(sph.probe.y, 8, TABLE3 - 8); }

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* ------------------------------------------------------------------ Sahnada sudrash (3D) */

const canvas = stage.canvas;
let drag = null;
/** Stend: ushlangan joy balandligidagi chiziq bo'ylab eng yaqin D (mm). */
const standD = (p, y) => scene.lab.nearest((D) => scene.lawPoint(PX + D, y), 20, 140, p.x, p.y);
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id, p) {
    if (id === "stand" || id === "standBall") { const y = id === "stand" ? TABLE - 4 : fixed().y; drag = { id, y, off: law.D - standD(p, y) }; }
    else if (id === "bob") drag = { id };
    else if (id === "probe" || /^q\d$/.test(id)) {
      const q = scene.trayPoint(p), o = id === "probe" ? sup.probe : sup.charges[+id.slice(1)];
      if (id !== "probe") { sup.sel = +id.slice(1); syncSup(); }
      drag = { id, dx: q ? o.x - q.x : 0, dy: q ? o.y - q.y : 0 };
    } else if (id === "sprobe") { const q = scene.spherePoint(p); drag = { id, dx: q ? sph.probe.x - q.x : 0, dy: q ? sph.probe.y - q.y : 0 }; }
    refresh();
  },
  move(id, p) {
    if (!drag || drag.id !== id) return;
    if (id === "stand" || id === "standBall") { law.D = clamp(Math.round(standD(p, drag.y) + drag.off), 20, 140); DC.set(law.D / 10); afterLawChange(); }
    else if (id === "bob") {
      const hi = Math.min(Math.asin(0.9), P.touchAngle(LEN * MM, law.D * MM, 2 * RB * MM) - 0.001); // stendga yetmasa touchAngle = ∞
      law.a = scene.lab.nearest((a) => scene.lawPoint(PX + LEN * Math.sin(a), PY + LEN * Math.cos(a)), -60 * DEG, hi, p.x, p.y); law.w = 0;
    } else if (id === "probe") { const q = scene.trayPoint(p); if (!q) return; sup.probe.x = clamp(q.x + drag.dx, TRAY.x0 + 5, TRAY.x1 - 5); sup.probe.y = clamp(q.y + drag.dy, TRAY.y0 + 5, TRAY.y1 - 5); }
    else if (/^q\d$/.test(id)) {
      const q = scene.trayPoint(p), c = sup.charges[+id.slice(1)]; if (!q || !c) return;
      c.x = clamp(Math.round(q.x + drag.dx), TRAY.x0 + RC + 2, TRAY.x1 - RC - 2); c.y = clamp(Math.round(q.y + drag.dy), TRAY.y0 + RC + 2, TRAY.y1 - RC - 2);
    } else if (id === "sprobe") { const q = scene.spherePoint(p); if (!q) return; sph.probe.x = clamp(q.x + drag.dx, 8, 400); sph.probe.y = clamp(q.y + drag.dy, 90, TABLE3 - 8); }
    customized(); refresh();
  },
  end() { if (!drag) return; const k = drag.id; drag = null; if (k === "bob" && !running) settleLaw(); refresh(); },
});


/* ------------------------------------------------------------------ Tayyor tajribalar */

const setLaw = (q1, q2, D, m = 0.05) => () => { Object.assign(law, { q1, q2, D, m, a: 0, w: 0, pts: [], shared: 0, halveT: 0 }); };
const setSup = (charges, probe, med = "air", show = {}) => () => { sup.charges = charges.map(([x, y, q]) => ({ x, y, q })); sup.sel = 0; sup.probe = { x: probe[0], y: probe[1] }; sup.med = med; Object.assign(ui.show, { lines: true, grains: false, parts: true }, show); };
const setSph = (Q, R, type, probe = [300, 130], show = {}) => () => { Object.assign(sph, { Q, R, type, probe: { x: probe[0], y: probe[1] }, spark: 0, beltT: 0, sparks: 0 }); Object.assign(ui.show, { lines: true, cut: true }, show); };
const PRESETS = {
  repel: { mode: "law", title: "Itarilish (+ +)", lesson: "Ikkala sharcha bir xil musbat zaryadlangan: osma sharcha stenddan uzoqlashadi. Stendni chizg‘ich bo‘ylab yaqinlashtiring — burchak ortadi.", set: setLaw(7, 7, 40) },
  attract: { mode: "law", title: "Tortishish (+ −)", lesson: "Zaryadlar har xil ishorali va kichik: osma sharcha stend tomon og‘adi, lekin yetib bormaydi. Stendni sekin yaqinlashtirib ko‘ring.", set: setLaw(2.5, -2.5, 50) },
  touch: { mode: "law", title: "Tegish: zaryad bo‘linadi", lesson: "Kuchli tortishish: sharcha stenddagisiga tegadi, zaryadlar tenglashadi ((+8 − 2)/2 = +3 nC) va endi sharchalar itariladi.", set: setLaw(8, -2, 35) },
  rlaw: { mode: "law", title: "F ∝ 1/r²: o‘lchashlar", lesson: "Stendni 3, 5, 7, 9, 12 cm ga qo‘yib, har safar «Nuqta yozish»ni bosing. So‘ng «F(1/r²)» grafigini oching — nuqtalar to‘g‘ri chiziqda yotadi.", set: setLaw(7, 7, 30) },
  halve: { mode: "law", title: "Kulon usuli: zaryadni bo‘lish", lesson: "«Nuqta yozish»ni bosing, so‘ng «Neytral sharcha tegizish» — q₂ ikki marta kamayadi. Stendni avvalgi r ga qaytarib, kuch ham ikki marta kamayganini tekshiring.", set: setLaw(7, 7, 40) },
  heavy: { mode: "law", title: "Og‘irroq sharcha", lesson: "Sharcha massasi 3 marta katta (0,15 g): xuddi shu zaryadlarda burchak ancha kichik. tg α = F/(mg) — sezgir asbob uchun yengil sharcha kerak.", set: setLaw(7, 7, 40, 0.15) },
  single: { mode: "sup", title: "Nuqtaviy zaryad maydoni", lesson: "Bitta musbat zaryad: kuch chiziqlari radial, zaryaddan chiqadi. Sinov zaryadini uzoqlashtiring — E masofa kvadratiga teskari kamayadi. Zaryad ishorasini almashtirib ko‘ring.", set: setSup([[150, 106, 10]], [230, 70], "castor", { grains: true }) },
  twoEq: { mode: "sup", title: "Ikki bir xil zaryad", lesson: "Ikki teng musbat zaryad: o‘rtada maydon nolga teng — chiziqlar u yerga kirmaydi. Sinov zaryadini simmetriya o‘qi bo‘ylab suring.", set: setSup([[120, 106, 10], [240, 106, 10]], [180, 60]) },
  dipole: { mode: "sup", title: "Dipol: + va −", lesson: "Teng va qarama-qarshi zaryadlar. E₁ va E₂ ni parallelogramm qoidasi bilan qo‘shing: o‘rta chiziqda natijaviy E dipol o‘qiga parallel, + dan − tomon.", set: setSup([[120, 106, 10], [240, 106, -10]], [180, 60]) },
  zero: { mode: "sup", title: "E = 0 nuqtani toping", lesson: "q₁ = +16 nC va q₂ = +4 nC, oralig‘i 12 cm. Maydon nolga teng nuqta kichik zaryadga yaqinroq: q₁ dan 8 cm da. Sinov zaryadini u yerga olib boring.", set: setSup([[120, 106, 16], [240, 106, 4]], [190, 80]) },
  triangle: { mode: "sup", title: "Uch zaryad (uchburchak)", lesson: "Teng tomonli uchburchak uchlarida uchta bir xil zaryad: markazda E = 0, lekin potensial nolga teng emas — φ skalyar ravishda qo‘shiladi.", set: setSup([[180, 46, 8], [128, 136, 8], [232, 136, 8]], [180, 120]) },
  quad: { mode: "sup", title: "Kvadrupol (+ − + −)", lesson: "Kvadrat uchlarida navbatma-navbat ishorali zaryadlar. Markazda maydon nol, chiziqlar to‘rt «bo‘lak»ka ajraladi. Har bir E ni ko‘pburchak qoidasi bilan qo‘shing.", set: setSup([[130, 56, 8], [230, 56, -8], [230, 156, 8], [130, 156, -8]], [180, 106]) },
  oil: { mode: "sup", title: "Kastor moyidagi yorma", lesson: "Klassik tajriba: kastor moyiga manna yormasi sepilgan, ikki elektrod — + va −. Donalar qutblanib, kuch chiziqlari bo‘ylab zanjir bo‘lib tiziladi. Chiziqlarni o‘chirib, faqat donalarga qarang.", set: setSup([[110, 106, 12], [250, 106, -12]], [180, 40], "castor", { grains: true, lines: false, parts: false }) },
  shell: { mode: "sph", title: "Metall shar maydoni", lesson: "Metall shar zaryadlangan. Zondni uzoqdan sharga yaqinlashtiring: E = kQ/r² ortadi va sirtda eng katta. So‘ng zondni kesim orqali ichkariga kiriting — E = 0.", set: setSph(400, 8, "shell", [320, 130]) },
  inside: { mode: "sph", title: "O‘tkazgich ichida E = 0", lesson: "Zond shar ichida. Qancha zaryad bermang («Zaryadlash»), ichkarida maydon nol, potensial esa sirtdagiga teng. «φ(r)» grafigini oching.", set: setSph(800, 10, "shell", [175, 140]) },
  solid: { mode: "sph", title: "Dielektrik shar (hajmda)", lesson: "Shar hajmida tekis zaryadlangan: ichida E = kQr/R³ — markazda nol, sirtda maksimum. Zondni markazdan tashqariga suring va E(r) grafigini kuzating.", set: setSph(400, 8, "solid", [190, 130]) },
  vdg: { mode: "sph", title: "Van de Graaf va uchqun", lesson: "Generator sferasi R = 10 cm. «Zaryadlash»ni bir necha marta bosing: sirtdagi maydon 3 MV/m ga yetganda havo teshiladi va yerga ulangan sharchaga uchqun sakraydi.", set: setSph(2400, 10, "shell", [330, 100]) },
  small: { mode: "sph", title: "Kichik shar tez teshiladi", lesson: "R = 3 cm: bu shar 300 nC dan ortiq zaryad saqlay olmaydi (E = kQ/R²). Radiusni oshiring — shar ko‘proq zaryad saqlaydi, potensiali ham ortadi.", set: setSph(250, 3, "shell", [250, 130]) },
};
const GROUPS = [["Kulon qonuni", ["repel", "attract", "touch", "rlaw", "halve", "heavy"]], ["Superpozitsiya", ["single", "twoEq", "dipole", "zero", "triangle", "quad", "oil"]], ["Zaryadlangan shar", ["shell", "inside", "solid", "vdg", "small"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { law: "Stendni suring, burchakni transportirdan o‘qing", sup: "Zaryadlarni va sinov zaryadi q₀ ni suring", sph: "Zondni dastasidan ushlab suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  if (ui.mode !== sceneMode) { sceneMode = ui.mode; scene.setMode(ui.mode); } // kamera shu tajribaga mos ko'rinishga
  setTabs();
}
let sceneMode = "law";
function syncAll() {
  q1C.set(law.q1); q2C.set(law.q2); DC.set(law.D / 10); mC.set(law.m); lawOut();
  syncSup(); syncSph();
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = !!ui.show[cb.dataset.toggle]; });
}
const MODE_DEFAULT = { law: "repel", sup: "dipole", sph: "shell" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null;
  p.set();
  if (ui.mode === "law") { law.a = 0; law.w = 0; if (!running || prefersReducedMotion()) settleLaw(); }
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "repel");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__coulomb = { law, sup, sph, ui, loadPreset, settleLaw, fieldAt, refresh, scene, bob, fixed };