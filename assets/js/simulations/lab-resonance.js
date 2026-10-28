// ==========================================================================
// Laboratoriya ishi: O‘zgaruvchan tok zanjirida kuchlanishlar rezonansi (simulations/lab-rezonans.html). Darslik: 11-sinf §19.
// Qurilma: tovush generatori (chastota dastak bilan, U_ef = 2 V, ichki qarshiligi 50 Ω), ketma-ket ulangan rezistor R,
// g‘altak (induktivligi o‘quvchiga noma’lum, R_L = 18 Ω) va almashtiriladigan kondensator; raqamli AC milliampermetr
// va kondensatorga parallel raqamli AC voltmetr. Rezonans egri chizig‘i I(f) dan f₀, Δf, Q va L topiladi.
// Fizika: lc-physics.js (acSeries — ketma-ket RLC impedansi).
// ==========================================================================

import { createLab, docKit, fitOrigin, meanErr, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, sx, userText } from "./labreport.js";
import { acSeries } from "./lc-physics.js";
import { noise } from "./labkit.js";
import { supply, multimeter, resistor, coil, capacitor, wire, hint, inBox, near, dot } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-rezonans.html", label: "oliyfizika.uz/simulations/lab-rezonans.html" };
// kondensatorlar: nominal (μF) va haqiqiy sig‘im (F) — haqiqiy qiymat nominaldan 1–3 % farq qiladi
const CAPS = { c047: { nom: 0.47, s: "0,47", C: 0.462e-6 }, c1: { nom: 1, s: "1", C: 0.988e-6 }, c22: { nom: 2.2, s: "2,2", C: 2.23e-6 } };
const RES = { r10: 10, r47: 47 };
const L_TRUE = 0.1035, R_L = 18, R_GEN = 50, U_EF = 2, F_MIN = 20, F_MAX = 2000;
const st = { c: "c1", r: "r10", f: 300 };
const geo = {};
const fv = (f) => Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN), vf = (v) => Math.round(F_MIN * (F_MAX / F_MIN) ** v);
const setF = (f) => { st.f = Math.min(F_MAX, Math.max(F_MIN, Math.round(f))); };

function meas() {
  const C = CAPS[st.c].C, R = RES[st.r] + R_L + R_GEN;
  const ac = acSeries({ R, L: L_TRUE, C }, U_EF * Math.SQRT2, st.f);
  const I = ac.Ief * 1000, UC = (ac.UC / Math.SQRT2);
  return { I, UC, Id: Math.max(0, Math.round(I * 100 + noise(st.f * 0.37, 2)) / 100), UCd: Math.round(UC * 100 + noise(st.f * 0.53, 1)) / 100, Q: Math.sqrt(L_TRUE / C) / R };
}

/* ------------------------------------------------------------------ Sahna */
const LAY = {
  wide: { G: [12, 12, 140, 160], A: [176, 12, 130, 128], V: [520, 12, 150, 130], R: [60, 290, 70], L: [220, 290, 130], C: [470, 290, 70], gy: 186, iy: 200, rx: 660, lx: 20, hk: [12, 214] },
  narrow: { G: [8, 8, 116, 150], A: [130, 8, 120, 124], V: [262, 8, 130, 124], R: [30, 310, 56], L: [140, 310, 92], C: [300, 310, 60], gy: 172, iy: 180, rx: 392, lx: 10, hk: [130, 204] },
};
function draw(ctx, S) {
  const { colors: c, narrow } = S, m = meas(), L = narrow ? LAY.narrow : LAY.wide;
  const G = supply(ctx, c, ...L.G, { value: String(st.f).padStart(4, " "), unit: "Hz", title: "GENERATOR · 2 V", frac: fv(st.f) });
  geo.knob = G.knob;
  const A = multimeter(ctx, c, ...L.A, { value: fmt(m.Id, 2), unit: "mA", mode: "AC mA", title: "MILLIAMPERMETR", inLabel: "mA" });
  const V = multimeter(ctx, c, ...L.V, { value: fmt(m.UCd, 2), unit: "V", mode: "AC V", title: "VOLTMETR (C da)", inLabel: "V" });
  const R = resistor(ctx, c, ...L.R, `R = ${RES[st.r]} Ω`);
  const K = coil(ctx, c, ...L.L, `L = ?  (R_L = ${R_L} Ω)`);
  const Cp = capacitor(ctx, c, ...L.C, `C = ${CAPS[st.c].s} μF`, narrow ? "" : "bosing: almashtirish");
  geo.cap = Cp.box;
  const cu = "#b45309";
  // generator → mA → kondensator → g‘altak → rezistor → generator
  wire(ctx, [G.plus, [G.plus[0], L.gy], [A.com[0], L.gy], A.com], cu);
  wire(ctx, [A.inp, [A.inp[0], L.iy], [L.rx, L.iy], [L.rx, Cp.b[1]], Cp.b], cu);
  wire(ctx, [Cp.a, K.b], cu); wire(ctx, [K.a, R.b], cu);
  wire(ctx, [R.a, [L.lx, R.a[1]], [L.lx, L.gy + 2], [G.minus[0], L.gy + 2], G.minus], cu);
  // voltmetr shuplari kondensator uchlarida
  const probe = (a, b, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.bezierCurveTo(a[0], a[1] + 60, b[0], b[1] - 80, b[0], b[1] - 6); ctx.stroke(); dot(ctx, b[0], b[1] - 4, 3.5, col); };
  probe(V.inp, [Cp.b[0] - 4, Cp.b[1]], "#dc2626"); probe(V.com, [Cp.a[0] + 4, Cp.a[1]], "#111827");
  hint(ctx, c, narrow ? "← dastakni buring" : "dastakni aylantiring: chastota", ...L.hk);
}

/* ------------------------------------------------------------------ Hisob */
const L_of = (f0, C) => 1 / (4 * Math.PI ** 2 * f0 * f0 * C);
function crossing(rs, i0, dir, lvl) {
  for (let i = i0; i + dir >= 0 && i + dir < rs.length; i += dir) {
    const a = rs[i], b = rs[i + dir];
    if (b.I <= lvl) return a.f + ((lvl - a.I) * (b.f - a.f)) / (b.I - a.I);
  }
  return NaN;
}
function anCurve(rows, cond) {
  const rs = rows.slice().sort((a, b) => a.f - b.f);
  if (rs.length < 3) return { rows: rs, ok: false };
  let k = 0; rs.forEach((r, i) => { if (r.I > rs[k].I) k = i; });
  const Imax = rs[k].I; let f0 = rs[k].f;
  if (k > 0 && k < rs.length - 1) {
    // parabola uchidan (3 nuqta) — rezonans chastotani aniqlashtirish
    const [a, b, c] = [rs[k - 1], rs[k], rs[k + 1]];
    const d = (a.f - b.f) * (a.f - c.f) * (b.f - c.f);
    const A2 = (c.f * (b.I - a.I) + b.f * (a.I - c.I) + a.f * (c.I - b.I)) / d, B2 = (c.f ** 2 * (a.I - b.I) + b.f ** 2 * (c.I - a.I) + a.f ** 2 * (b.I - c.I)) / d;
    if (A2 < 0) { const v = -B2 / (2 * A2); if (v > a.f && v < c.f) f0 = v; }
  }
  const lvl = Imax / Math.SQRT2, f1 = crossing(rs, k, -1, lvl), f2 = crossing(rs, k, 1, lvl), df = f2 - f1;
  const C = CAPS[cond?.c]?.nom ?? 1;
  return { rows: rs, k, Imax, f0, f1, f2, df, Q: f0 / df, C, L: L_of(f0, C * 1e-6), interior: k > 0 && k < rs.length - 1, ok: rs.length >= 7 && k > 0 && k < rs.length - 1 };
}
function anCaps(rows) {
  const rs = rows.slice().sort((a, b) => a.C - b.C).map((r) => ({ ...r, L: L_of(r.f0, r.C * 1e-6), y: 1 / (r.f0 * r.f0) }));
  const L = meanErr(rs.map((r) => r.L)), fit = rs.length >= 2 ? fitOrigin(rs.map((r) => [r.C * 1e-6, r.y])) : null;
  return { rows: rs, L, fit, Lfit: fit ? fit.k / (4 * Math.PI ** 2) : NaN, ok: new Set(rs.map((r) => r.C)).size >= 3 };
}
function build(nb, res) {
  const A = res.t1.A, B = res.t2?.ok ? res.t2.A : null, D = docKit(), cond = res.t1.cond;
  D.S("Ishning maqsadi");
  D.list(["Ketma-ket ulangan $RLC$ zanjirda tok kuchining chastotaga bog‘liqligini (rezonans egri chizig‘ini) o‘lchash.", "Rezonans chastotasi, o‘tkazish kengligi va asllikni aniqlash; Tomson formulasidan g‘altak induktivligini topish."]);
  D.S("Qisqacha nazariya");
  D.p("Ketma-ket $RLC$ zanjirning to‘la qarshiligi $Z = \\sqrt{R^2 + (\\omega L - 1/(\\omega C))^2}$. Induktiv va sig‘im qarshiliklari tenglashganda ($\\omega L = 1/(\\omega C)$) $Z$ eng kichik, tok esa eng katta bo‘ladi — kuchlanishlar rezonansi:");
  D.eq("f_0 = \\frac{1}{2\\pi\\sqrt{LC}},\\qquad I_{\\max} = \\frac{U}{R_\\Sigma}", 1);
  D.p("Tok $I_{\\max}/\\sqrt{2}$ gacha kamayadigan chastotalar $f_1$, $f_2$ orasidagi masofa — o‘tkazish kengligi $\\Delta f = f_2 - f_1$; zanjir aslligi $Q = f_0/\\Delta f$. Rezonansda kondensatordagi kuchlanish manba kuchlanishidan $Q$ marta katta: $U_C = QU$. (1) dan:");
  D.eq("L = \\frac{1}{4\\pi^2 f_0^2 C}", 2);
  D.S("Jihozlar");
  D.list(["Tovush generatori ($20\\ldots 2000$ Hz, $U_{\\text{ef}} = 2$ V, ichki qarshiligi $50$ Ω).", `Rezistor $R = ${cond.r ? RES[cond.r] : 10}$ Ω, g‘altak (induktivligi noma’lum, $R_L = ${R_L}$ Ω), kondensatorlar $0{,}47$; $1$; $2{,}2$ μF.`, "Raqamli o‘zgaruvchan tok milliampermetri va voltmetri."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Zanjir ketma-ket yig‘ildi; generator chastotasi past qiymatdan boshlab oshirildi va har chastotada tok kuchi yozildi (rezonans yaqinida — kichik qadam bilan).", "Tok eng katta bo‘lgan chastota — rezonans chastotasi $f_0$ topildi; yarim quvvat chastotalari $f_1$, $f_2$ aniqlandi.", "Kondensatorni almashtirib, har sig‘im uchun rezonans chastotasi topildi (2-jadval)."], true);
  D.S("Rezonans egri chizig‘i");
  D.table(`Tok kuchining chastotaga bog‘liqligi ($C = ${fx(A.C, 2)}$ μF, $R = ${cond.r ? RES[cond.r] : 10}$ Ω)`, ["№", "$f$, Hz", "$I$, mA", "$I/I_{\\max}$", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.f, 0)}$`, `$${fx(r.I, 2)}$`, `$${fx(r.I / A.Imax, 2)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  const fmax = Math.max(...A.rows.map((r) => r.f)) * 1.05;
  D.fig("res", "Rezonans egri chizig‘i $I(f)$. Gorizontal uzuq chiziq — $I_{\\max}/\\sqrt 2$ sathi.", { xmin: 0, xmax: fmax, ymin: 0, ymax: A.Imax * 1.15, legendPos: "north east", xlab: "f, Hz", ylab: "I, mA",
    series: [{ kind: "line", data: A.rows.map((r) => [r.f, r.I]), color: "#94a3b8" }, { kind: "pts", data: A.rows.map((r) => [r.f, r.I]), color: "#c2410c", label: "tajriba" },
      { kind: "line", fn: () => A.Imax / Math.SQRT2, color: "#1d4ed8", dash: "5 4", label: "I_max/√2" }] });
  D.p("**Hisoblash:**");
  const lines = [`f_0 \\approx ${fx(A.f0, 0)}\\ \\text{Hz},\\qquad I_{\\max} = ${fx(A.Imax, 2)}\\ \\text{mA}`];
  if (Number.isFinite(A.df)) lines.push(`\\Delta f = f_2 - f_1 = ${fx(A.f2, 0)} - ${fx(A.f1, 0)} = ${fx(A.df, 0)}\\ \\text{Hz},\\qquad Q = \\frac{f_0}{\\Delta f} = ${fx(A.Q, 1)}`);
  lines.push(`L = \\frac{1}{4\\pi^2 f_0^2 C} = \\frac{1}{4\\pi^2 \\cdot ${fx(A.f0, 0)}^2 \\cdot ${fx(A.C, 2)}\\cdot 10^{-6}} = ${fx(A.L, 3)}\\ \\text{H}`);
  D.eq(lines);
  const box = [`• Rezonans chastotasi $f_0 \\approx ${fx(A.f0, 0)}$ Hz; rezonansda tok eng katta: $${fx(A.Imax, 2)}$ mA.`, `• G‘altak induktivligi (Tomson formulasidan) $L \\approx ${fx(A.L, 3)}$ H.`];
  if (Number.isFinite(A.df)) box.push(`• O‘tkazish kengligi $\\Delta f \\approx ${fx(A.df, 0)}$ Hz, zanjir aslligi $Q \\approx ${fx(A.Q, 1)}$.`);
  if (B) {
    D.S("Rezonans chastotasining sig‘imga bog‘liqligi");
    D.table("Turli kondensatorlar uchun rezonans chastotasi", ["№", "$C$, μF", "$f_0$, Hz", "$1/f_0^2$, $10^{-6}$ s$^2$", "$L$, H", "Tekshiruv"],
      B.rows.map((r, i) => [String(i + 1), `$${fx(r.C, 2)}$`, `$${fx(r.f0, 0)}$`, `$${fx(r.y * 1e6, 3)}$`, `$${fx(r.L, 3)}$`, res.t2.flags[i] ? "$\\checkmark$" : "--"]),
      "(1) ga ko‘ra $1/f_0^2 = 4\\pi^2 L\\,C$ — sig‘imga to‘g‘ri proporsional.");
    const cm = Math.max(...B.rows.map((r) => r.C)) * 1.15;
    D.fig("fc", "$1/f_0^2$ ning sig‘imga bog‘liqligi; to‘g‘ri chiziq koordinata boshidan o‘tadi.", { xmin: 0, xmax: cm, ymin: 0, ymax: Math.max(...B.rows.map((r) => r.y * 1e6)) * 1.2, legendPos: "north west", xlab: "C, μF", ylab: "1/f0², 10⁻⁶ s²",
      series: [{ kind: "pts", data: B.rows.map((r) => [r.C, r.y * 1e6]), color: "#7c3aed", label: "tajriba" }, ...(B.fit ? [{ kind: "line", fn: (x) => B.fit.k * x, color: "#1d4ed8", label: `L = ${fmt(B.Lfit, 3)} H` }] : [])] });
    D.eq(`\\langle L\\rangle = (${fx(B.L.m, 3)} \\pm ${fx(Math.max(B.L.s, 0.0005), 3)})\\ \\text{H};\\qquad \\text{grafik qiyaligidan: } L = \\frac{k}{4\\pi^2} = ${fx(B.Lfit, 3)}\\ \\text{H}`);
    box.push(`• Sig‘im ortishi bilan rezonans chastotasi kamayadi; $f_0^2 C$ o‘zgarmas — Tomson formulasi tasdiqlandi ($\\langle L\\rangle \\approx ${fx(B.L.m, 3)}$ H).`);
  }
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. O‘zgaruvchan tok zanjirida rezonansni o‘rganish", titlePlain: "Laboratoriya ishi. Kuchlanishlar rezonansi", author: nb.f.name, sub: "Ketma-ket RLC zanjir: rezonans egri chizig‘i", meta: docMeta(nb, userText), blocks: D.X };
}

let drag0 = null;
const capKeys = Object.keys(CAPS);
createLab({
  key: "resonance", fileBase: "Rezonans-lab", docLabel: "Virtual laboratoriya ishi · 11-sinf", site: SITE,
  modes: [{ id: "f", label: "1. Rezonans egri chizig‘i", hint: "Chastotani o‘zgartirib, tok kuchini yozing — tok qayerda eng katta?" }, { id: "c", label: "2. Sig‘imni o‘zgartirish", hint: "Har kondensator uchun tok eng katta bo‘lgan chastotani toping" }],
  vh: (n) => (n ? 370 : 340),
  draw,
  down(x, y, lab) {
    if (near(x, y, geo.knob, geo.knob[2] + 6)) { drag0 = { y, v: fv(st.f) }; return "knob"; }
    if (inBox(x, y, geo.cap)) { st.c = capKeys[(capKeys.indexOf(st.c) + 1) % capKeys.length]; return true; }
    return null;
  },
  move(h, x, y) { setF(vf(Math.min(1, Math.max(0, drag0.v - (y - drag0.y) / 300)))); },
  cursor: (x, y) => (near(x, y, geo.knob, geo.knob?.[2] + 6) ? "ns-resize" : inBox(x, y, geo.cap) ? "pointer" : ""),
  tools: [{ label: "−10 Hz", run: () => setF(st.f - 10) }, { label: "−1 Hz", run: () => setF(st.f - 1) }, { label: "+1 Hz", run: () => setF(st.f + 1) }, { label: "+10 Hz", run: () => setF(st.f + 10) }],
  controls: [
    { type: "range", label: "Generator chastotasi", min: 0, max: 1, step: 0.001, get: () => fv(st.f), set: (v) => setF(vf(v)), fmt: (v) => `${vf(v)} Hz` },
    { type: "seg", label: "Kondensator", opts: Object.entries(CAPS).map(([k, v]) => [k, `${v.s} μF`]), get: () => st.c, set: (v) => { st.c = v; } },
    { type: "seg", label: "Rezistor", opts: Object.entries(RES).map(([k, v]) => [k, `${v} Ω`]), get: () => st.r, set: (v) => { st.r = v; } },
    { type: "note", text: "Sahnada: generator dastagini yuqoriga/pastga torting; aniq sozlash — «±1 Hz», «±10 Hz» tugmalari. Kondensatorni bosib almashtiring." },
  ],
  readouts() {
    const m = meas();
    return [["Chastota <i>f</i>", `${st.f}<small>Hz</small>`, "generator", "blue"], ["Tok <i>I</i>", `${fmt(m.Id, 2)}<small>mA</small>`, "ta’sir etuvchi qiymat", "orange"],
      ["Kondensatorda <i>U<sub>C</sub></i>", `${fmt(m.UCd, 2)}<small>V</small>`, `manba: ${fmt(U_EF, 0)} V`], ["Zanjir", `C = ${CAPS[st.c].s} μF`, `R = ${RES[st.r]} Ω, L = ?`]];
  },
  record(lab) {
    const m = meas();
    if (lab.mode === "c") {
      const v = { C: CAPS[st.c].s, f0: String(st.f) };
      return { t: "t2", v, text: `C = ${v.C} μF: f₀ ≈ ${v.f0} Hz (I = ${fmt(m.Id, 2)} mA)` };
    }
    const v = { f: String(st.f), I: fmt(m.Id, 2) };
    return { t: "t1", v, text: `C = ${CAPS[st.c].s} μF, R = ${RES[st.r]} Ω: f = ${v.f} Hz, I = ${v.I} mA` };
  },
  explain() {
    const m = meas(), C = CAPS[st.c].C, w = 2 * Math.PI * st.f, XL = w * L_TRUE, XC = 1 / (w * C);
    const near0 = Math.abs(XL - XC) < 0.15 * (RES[st.r] + R_L + R_GEN);
    return near0 ? `Rezonans yaqinida: X<sub>L</sub> ≈ X<sub>C</sub>, zanjir faqat aktiv qarshilikka ega — tok eng katta. Kondensatordagi kuchlanish (${fmt(m.UCd, 2)} V) manba kuchlanishidan ${fmt(m.UCd / U_EF, 1)} marta katta!`
      : XL < XC ? "Chastota rezonansdan past: sig‘im qarshiligi X<sub>C</sub> = 1/(ωC) katta — tok kichik. Chastotani oshiring." : "Chastota rezonansdan yuqori: induktiv qarshilik X<sub>L</sub> = ωL katta — tok kamaymoqda.";
  },
  steps: ["1-topshiriq: generator chastotasini 100 Hz dan boshlab oshiring. Har 50–100 Hz da (tok tez o‘zgaradigan joyda — 10–20 Hz da) f va I ni <b>Qaydga yozing</b>. Rezonansdan keyin ham bir necha nuqta oling.", "2-topshiriq: kondensatorni almashtiring (0,47; 1; 2,2 μF) va har biri uchun tok eng katta bo‘lgan chastotani «±1 Hz» bilan aniq toping — qaydga yozing.", "Qaydlarni jadvallarga o‘tkazing: f₀, Δf, Q va L avtomatik hisoblanadi.", "Rezistorni 47 Ω ga almashtirib egri chiziq qanday o‘zgarishini kuzating. Xulosa va PDF."],
  formulas: ["Tomson formulasi: <span class=\"sim-math\">f₀ = 1 / (2π√(LC))</span>", "To‘la qarshilik: <span class=\"sim-math\">Z = √(R² + (ωL − 1/ωC)²)</span>", "Asllik: <span class=\"sim-math\">Q = f₀ / Δf</span>, rezonansda <span class=\"sim-math\">U<sub>C</sub> = QU</span>", "<span class=\"sim-math\">L = 1 / (4π²f₀²C)</span>"],
  note: "Radiopriyomnik kontur sig‘imini o‘zgartirib, kerakli stansiya chastotasiga rezonansga sozlanadi.",
  notebook: {
    intro: "1-jadval sharti — kondensator va rezistor. Kamida 7 nuqta, rezonans cho‘qqisining ikki tomonida ham o‘lchang. 2-jadval — turli sig‘imlar uchun rezonans chastotasi.",
    conclusionPh: "Rezonans chastotasi, o‘tkazish kengligi, asllik va g‘altak induktivligi qancha chiqdi? f₀ sig‘imga qanday bog‘liq?",
    hint: "Javob bering: 1) Rezonansda tok nega eng katta? 2) f₀ va L qancha? 3) R ortsa egri chiziq qanday o‘zgaradi? 4) Rezonansda U_C nega manba kuchlanishidan katta?",
    minTables: 1,
    tables: [
      { key: "t1", req: true, okLabel: "Rezonans egri chizig‘i", need: "1-jadvalda kamida 7 nuqta, cho‘qqining ikki tomonida", title: "1-topshiriq. Rezonans egri chizig‘i I(f)",
        cond: { fields: [{ k: "c", label: "Kondensator", opts: Object.entries(CAPS).map(([k, v]) => [k, `${v.s} μF`]) }, { k: "r", label: "Rezistor", opts: Object.entries(RES).map(([k, v]) => [k, `${v} Ω`]) }], sync: () => ({ c: st.c, r: st.r }), init: { c: "c1", r: "r10" } },
        head: ["f, Hz", "I, mA", "I / I_max", "Tekshiruv"], cols: [{ k: "f", kind: "num" }, { k: "I", kind: "num" }], outs: ["q"],
        blank: () => ({ f: "", I: "" }), rows: 8, max: 24, narrow: true,
        parse: (r) => ({ f: num(r.f), I: num(r.I) }), check: (r) => (!(r.f > 0) || !(r.I >= 0) ? { ok: false, err: "f > 0, I ≥ 0" } : { ok: true }),
        analyze: anCurve, out: (A, j, r) => ({ q: A.Imax > 0 ? fmt(r.I / A.Imax, 2) : "—" }),
        summary: (A) => (A.rows.length >= 3 ? [["Rezonans chastotasi f₀", `${fmt(A.f0, 0)} Hz`, A.interior ? "cho‘qqi" : "cho‘qqining ikki tomonini o‘lchang"], ["O‘tkazish kengligi Δf", Number.isFinite(A.df) ? `${fmt(A.df, 0)} Hz` : "—", Number.isFinite(A.Q) ? `Q = ${fmt(A.Q, 1)}` : "I_max/√2 sathigacha o‘lchang"], ["Induktivlik L", `${fmt(A.L, 3)} H`, "Tomson formulasidan"]] : null),
        ok: (A) => A.ok },
      { key: "t2", okLabel: "f₀(C)", need: "2-jadvalda 3 ta turli sig‘im", title: "2-topshiriq. Rezonans chastotasining sig‘imga bog‘liqligi",
        head: ["C, μF", "f₀, Hz", "L, H", "Tekshiruv"], cols: [{ k: "C", kind: "num" }, { k: "f0", kind: "num" }], outs: ["L"],
        blank: () => ({ C: "", f0: "" }), rows: 3, max: 8, narrow: true,
        parse: (r) => ({ C: num(r.C), f0: num(r.f0) }), check: (r) => (!(r.C > 0) || !(r.f0 > 0) ? { ok: false, err: "C, f₀ > 0" } : { ok: true }),
        analyze: anCaps, out: (A, j, r) => ({ L: fmt(L_of(r.f0, r.C * 1e-6), 3) }),
        summary: (A) => (A.rows.length ? [["O‘rtacha induktivlik", `${fmt(A.L.m, 3)} H`, A.rows.length > 1 ? `± ${fmt(Math.max(A.L.s, 0.0005), 3)} H` : ""]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
