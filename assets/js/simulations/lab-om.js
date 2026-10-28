// ==========================================================================
// Laboratoriya ishi: Tok kuchi va kuchlanishni o‘lchash. Om qonunini o‘rganish (simulations/lab-om-qonuni.html)
// Darsliklar: 7-sinf §51, §57; 8-sinf §14, §19.
// Qurilma (montaj ko‘rinishi): tok manbai, kalit, reostat (sirpang‘ich sahnada suriladi), rezistor (almashtiriladi),
// ampermetr (ketma-ket) va voltmetr (rezistorga parallel) — strelkali, bo‘linma qiymati 0,02 A va 0,2 V.
// Fizika: circuit-physics.js (tugun potensiallari usuli). Rezistorlar haqiqiy qiymati nominaldan 1–3 % farq qiladi,
// asboblar 1,5-sinf aniqlikda — natija jadval qiymatidan biroz farq qiladi (real tajribadagidek).
// ==========================================================================

import { createLab, docKit, fitOrigin, meanErr, pct, fmt } from "./lab-core.js";
import { num } from "./labnotebook.js";
import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { solve } from "./circuit-physics.js";
import { meter, battery, keySwitch, rheostat, resistor, wire, label, hint, F, inBox } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-om-qonuni.html", label: "oliyfizika.uz/simulations/lab-om-qonuni.html" };
// Rezistorlar: nominal (yorliqda) va haqiqiy qiymat
const RES = {
  r5: { name: "R₁ = 5 Ω", nom: 5, R: 5.08 },
  r8: { name: "R₂ = 8 Ω", nom: 8, R: 7.86 },
  r10: { name: "R₃ = 10 Ω", nom: 10, R: 10.17 },
  rx: { name: "Rₓ = ?", nom: null, R: 12.4 },
};
const SRC = { s3: { name: "3 V", emf: 3.0, r: 0.35 }, s45: { name: "4,5 V", emf: 4.5, r: 0.5 } };
const RH_MAX = 30, A_MAX = 1, A_DIV = 0.02, V_MAX = 6, V_DIV = 0.2;
const K_A = 1.012, K_V = 0.992; // asboblarning kichik tizimli xatosi (1,5-sinf ichida)

const st = { src: "s45", rez: "r5", rh: 0.6, on: false };
const geo = {};

function circuit() {
  const S = SRC[st.src], el = [
    { type: "battery", a: 0, b: 1, emf: S.emf, r: S.r, plus: "b" },
    { type: "switch", a: 1, b: 2, closed: st.on },
    { type: "ammeter", a: 2, b: 3 },
    { type: "rheostat", a: 3, b: 4, Rmax: RH_MAX, pos: st.rh },
    { type: "resistor", a: 4, b: 0, R: RES[st.rez].R },
    { type: "voltmeter", a: 4, b: 0 },
  ];
  const s = solve(5, el);
  return { I: Math.abs(s.el[2].I) * K_A, U: Math.abs(s.el[5].U) * K_V };
}
/** Strelkali asbobni ko‘z bilan o‘qish: yarim bo‘linmagacha. */
const readMeter = (v, div) => Math.round(v / (div / 2)) * (div / 2);
const reading = () => { const c = circuit(); return { I: readMeter(c.I, A_DIV), U: readMeter(c.U, V_DIV), raw: c }; };

/* ------------------------------------------------------------------ Sahna */
// Joylashuv (virtual koordinatalar): keng 680×340, tor 400×400. Tok yo‘li: manba(+) → A → reostat → R → kalit → manba(−);
// voltmetr «+» klemmasi rezistorning yuqori potensialli uchiga (o‘ng) ulangan.
const LAY = {
  wide: { A: [70, 8, 200, 140], V: [410, 8, 200, 140], ty: 158, bat: [20, 256, 96], rh: [150, 190, 150], rz: [440, 280, 90], key: [220, 312, 46], vMinusX: 426, vPlusX: 660, rhX: 548, rail: 312, left: 8 },
  narrow: { A: [10, 8, 180, 130], V: [210, 8, 180, 130], ty: 148, bat: [12, 262, 80], rh: [140, 196, 120], rz: [282, 300, 74], key: [150, 352, 44], vMinusX: 272, vPlusX: 392, rhX: 368, rail: 352, left: 6 },
};
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, r = circuit(), L = narrow ? LAY.narrow : LAY.wide;
  // asboblar
  geo.A = meter(ctx, c, ...L.A, { sym: "A", max: A_MAX, major: 5, minor: 10, value: r.I, cls: "1,5", title: "AMPERMETR" });
  geo.V = meter(ctx, c, ...L.V, { sym: "V", max: V_MAX, major: 6, minor: 5, value: r.U, cls: "1,5", title: "VOLTMETR" });
  // montaj stoli
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.08)" : "rgba(226,232,240,0.55)"; ctx.beginPath(); ctx.roundRect(4, L.ty, w - 8, h - L.ty - 4, 12); ctx.fill();
  const B = battery(ctx, c, L.bat[0], L.bat[1], L.bat[2], 34, SRC[st.src].name);
  const RH = rheostat(ctx, c, L.rh[0], L.rh[1], L.rh[2], st.rh, `Reostat 0…${RH_MAX} Ω`); geo.rh = RH;
  const RZ = resistor(ctx, c, L.rz[0], L.rz[1], L.rz[2], RES[st.rez].name);
  const K = keySwitch(ctx, c, L.key[0], L.key[1], L.key[2], st.on); geo.key = K.box;
  const A = geo.A, V = geo.V, cu = "#b45309", cv = "#2563eb";
  // tok yo‘li
  wire(ctx, [B.plus, [B.plus[0], A.minus[1] + 14], [A.minus[0], A.minus[1] + 14], A.minus], cu);
  wire(ctx, [A.plus, [A.plus[0], A.minus[1] + 18], [RH.a[0] - 16, A.minus[1] + 18], [RH.a[0] - 16, RH.a[1]], RH.a], cu);
  wire(ctx, [RH.b, [L.rhX, RH.b[1]], [L.rhX, RZ.b[1]], RZ.b], cu);
  wire(ctx, [RZ.a, [RZ.a[0], L.rail], K.b], cu);
  wire(ctx, [K.a, [L.left, L.rail], [L.left, B.minus[1] - 12], [B.minus[0], B.minus[1] - 12], B.minus], cu);
  // voltmetr (parallel)
  wire(ctx, [V.minus, [L.vMinusX, V.minus[1]], [L.vMinusX, RZ.a[1] - 22], [RZ.a[0], RZ.a[1] - 22], RZ.a], cv, 1.8);
  wire(ctx, [V.plus, [V.plus[0], V.plus[1] + 14], [L.vPlusX, V.plus[1] + 14], [L.vPlusX, RZ.b[1] + 26], [RZ.b[0], RZ.b[1] + 26], RZ.b], cv, 1.8);
  geo.rez = { x0: L.rz[0] - 12, x1: L.rz[0] + L.rz[2] + 12, y0: L.rz[1] - 16, y1: L.rz[1] + 30 };
  hint(ctx, c, st.on ? "kalit: uzish" : "kalitni bosing", K.box.x1 + 10, L.key[1] - 2);
  hint(ctx, c, "sirpang‘ichni suring", RH.x0 - 10, L.rh[1] - 34);
  hint(ctx, c, narrow ? "bosing: almashtirish" : "rezistorni bosib almashtiring", L.rz[0] + L.rz[2] / 2, L.rz[1] - 46, "center");
}

/* ------------------------------------------------------------------ Hisob */
const resOpts = Object.entries(RES).map(([k, v]) => [k, v.name]);
function analyze1(rows) {
  const by = {}; rows.forEach((r) => (by[r.rez] ||= []).push(r));
  const groups = Object.entries(by).map(([rez, rs]) => ({ rez, rows: rs, fit: fitOrigin(rs.map((q) => [q.U, q.I])), R: meanErr(rs.map((q) => q.U / q.I)) }));
  return { rows: rows.map((r) => ({ ...r, Ri: r.U / r.I })), groups, ok: groups.some((g) => g.rows.length >= 4 && new Set(g.rows.map((q) => q.U)).size >= 3) };
}
function analyze2(rows) {
  const rs = rows.map((r) => ({ ...r, Rn: RES[r.rez].nom, inv: 1 / RES[r.rez].nom, IR: r.I * RES[r.rez].nom }));
  const U = meanErr(rs.map((r) => r.U)), spread = rs.length ? (Math.max(...rs.map((r) => r.U)) - Math.min(...rs.map((r) => r.U))) / U.m : 0;
  return { rows: rs, U, spread, fit: fitOrigin(rs.map((r) => [r.inv, r.I])), ok: new Set(rs.map((r) => r.rez)).size >= 3 && spread < 0.08 };
}

/* ------------------------------------------------------------------ Hisobot */
const COLS = { r5: "#2563eb", r8: "#c2410c", r10: "#15803d", rx: "#7c3aed" };
function build(nb, res) {
  const A = res.t1?.ok ? res.t1.A : null, B = res.t2?.ok ? res.t2.A : null, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Elektr zanjirini yig‘ish, ampermetr va voltmetrni to‘g‘ri ulashni o‘rganish; tok kuchi va kuchlanishni o‘lchash.",
    "O‘tkazgichdagi tok kuchining kuchlanishga bog‘liqligini tekshirish va qarshilikni aniqlash.",
    "Kuchlanish o‘zgarmas bo‘lganda tok kuchining qarshilikka bog‘liqligini o‘rganish (Om qonuni)."]);
  D.S("Qisqacha nazariya");
  D.p("Zanjir qismidagi tok kuchi shu qism uchlaridagi kuchlanishga to‘g‘ri, qismning qarshiligiga teskari proporsional (Om qonuni):");
  D.eq("I = \\frac{U}{R}", 1);
  D.p("Demak, $R$ o‘zgarmas bo‘lsa $I(U)$ grafigi koordinata boshidan o‘tuvchi to‘g‘ri chiziq, uning qiyaligi $1/R$ ga teng. $U$ o‘zgarmas bo‘lsa $I$ son jihatdan $1/R$ ga proporsional. Ampermetr zanjirga ketma-ket, voltmetr esa o‘lchanadigan qismga parallel ulanadi.");
  D.S("Jihozlar");
  D.list([`Tok manbai (${SRC[st.src].name}), kalit, ulovchi simlar.`, `Reostat $0\\ldots ${RH_MAX}$ Ω.`, "Rezistorlar: $R_1 = 5$ Ω, $R_2 = 8$ Ω, $R_3 = 10$ Ω va qarshiligi noma’lum $R_x$.",
    `Ampermetr $0\\ldots 1$ A (bo‘linma qiymati $${fx(A_DIV, 2)}$ A), voltmetr $0\\ldots 6$ V (bo‘linma qiymati $${fx(V_DIV, 1)}$ V); aniqlik sinfi 1,5.`]);
  D.S("Ishni bajarish tartibi");
  D.list(["Manba, kalit, ampermetr, reostat va rezistorni ketma-ket ulab zanjir yig‘ildi; voltmetr rezistorga parallel ulandi (ampermetrning «+» klemmasi manbaning «+» qutbi tomonida).",
    "Reostat sirpang‘ichini surib, rezistordagi kuchlanish o‘zgartirildi; har holatda $U$ va $I$ yozildi (1-jadval).",
    "Rezistorlar almashtirildi va reostat yordamida kuchlanish bir xil qilib turildi; tok kuchi o‘lchandi (2-jadval).",
    "Grafiklar chizildi, qarshilik va Om qonuni tekshirildi."], true);
  const box = [];
  if (A) {
    D.S("1-topshiriq: tok kuchining kuchlanishga bog‘liqligi");
    D.table("Kuchlanish, tok kuchi va qarshilik", ["№", "Rezistor", "$U$, V", "$I$, A", "$R = U/I$, Ω", "Tekshiruv"],
      A.rows.map((r, i) => [String(i + 1), RES[r.rez].name, `$${fx(r.U, 1)}$`, `$${fx(r.I, 2)}$`, `$${fx(r.Ri, 2)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
      "«Tekshiruv»: $\\checkmark$ — qiymatlar tajriba qaydlarida (asbob ko‘rsatkichi) bor.");
    const xmax = Math.max(...A.rows.map((r) => r.U)) * 1.15, ymax = Math.max(...A.rows.map((r) => r.I)) * 1.2;
    D.fig("iu", "Tok kuchining kuchlanishga bog‘liqligi. To‘g‘ri chiziqlar — eng kichik kvadratlar usuli ($I = U/R$).", {
      xmin: 0, xmax, ymin: 0, ymax, legendPos: "north west", xlab: "U, V", ylab: "I, A",
      series: A.groups.flatMap((g) => [
        { kind: "pts", data: g.rows.map((q) => [q.U, q.I]), color: COLS[g.rez], label: `${RES[g.rez].name.replace(" = ?", "")}: tajriba` },
        ...(g.fit ? [{ kind: "line", fn: (x) => g.fit.k * x, color: COLS[g.rez], label: `R = ${fmt(1 / g.fit.k, 2)} Ω` }] : []),
      ]) });
    const g0 = A.groups[0], r0 = g0.rows[0];
    D.p("**Hisoblash** (birinchi o‘lchash va grafik bo‘yicha):");
    D.eq([`R = \\frac{U}{I} = \\frac{${fx(r0.U, 1)}\\ \\text{V}}{${fx(r0.I, 2)}\\ \\text{A}} = ${fx(r0.U / r0.I, 2)}\\ \\Omega`,
      ...A.groups.filter((g) => g.fit).map((g) => `R_{\\text{${g.rez === "rx" ? "x" : RES[g.rez].nom}}} = \\frac{1}{k} = (${fx(1 / g.fit.k, 2)} \\pm ${fx(Math.max(g.fit.sk / g.fit.k ** 2, 0.01), 2)})\\ \\Omega${RES[g.rez].nom ? `\\quad(\\text{nominal}\\ ${RES[g.rez].nom}\\ \\Omega,\\ \\text{farq}\\ ${fx(pct(1 / g.fit.k, RES[g.rez].nom), 1)}\\,\\%)` : ""}`)]);
    A.groups.filter((g) => g.fit).forEach((g) => box.push(`• ${RES[g.rez].name.replace(" = ?", "")}: $I \\propto U$, $R = ${fx(1 / g.fit.k, 2)}$ Ω.`));
  }
  if (B) {
    D.S(`${A ? 2 : 1}-topshiriq: tok kuchining qarshilikka bog‘liqligi`);
    D.table(`Kuchlanish o‘zgarmas ($U \\approx ${fx(B.U.m, 1)}$ V) bo‘lganda`, ["№", "$R$, Ω", "$U$, V", "$I$, A", "$1/R$, Ω$^{-1}$", "$I\\cdot R$, V", "Tekshiruv"],
      B.rows.map((r, i) => [String(i + 1), `$${r.Rn}$`, `$${fx(r.U, 1)}$`, `$${fx(r.I, 2)}$`, `$${fx(r.inv, 3)}$`, `$${fx(r.IR, 2)}$`, res.t2.flags[i] ? "$\\checkmark$" : "--"]));
    if (B.fit) D.fig("ir", "Tok kuchining $1/R$ ga bog‘liqligi (U o‘zgarmas).", {
      xmin: 0, xmax: 0.25, ymin: 0, ymax: Math.max(...B.rows.map((r) => r.I)) * 1.25, legendPos: "north west", xlab: "1/R, 1/Ω", ylab: "I, A",
      series: [{ kind: "pts", data: B.rows.map((r) => [r.inv, r.I]), color: "#c2410c", label: "tajriba" }, { kind: "line", fn: (x) => B.fit.k * x, color: "#1d4ed8", label: `I = ${fmt(B.fit.k, 2)}·(1/R)` }] });
    D.p(`$I\\cdot R$ ko‘paytmasi deyarli o‘zgarmas va kuchlanishga teng: o‘rtacha $${fx(meanErr(B.rows.map((r) => r.IR)).m, 2)}$ V, voltmetr bo‘yicha $${fx(B.U.m, 2)}$ V.`);
    box.push(`• $U$ o‘zgarmas bo‘lganda $I \\propto 1/R$: grafik qiyaligi $${fx(B.fit?.k ?? NaN, 2)}$ V $\\approx U$.`);
  }
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Om qonunini o‘rganish", titlePlain: "Laboratoriya ishi. Om qonuni", author: nb.f.name, sub: "Tok kuchi va kuchlanishni o‘lchash, qarshilikni aniqlash", meta: docMeta(nb, userText), blocks: D.X };
}

/* ------------------------------------------------------------------ Laboratoriya */
createLab({
  key: "om", fileBase: "Om-qonuni-lab", docLabel: "Virtual laboratoriya ishi · 7–8-sinf", site: SITE,
  modes: [{ id: "u", label: "1. I(U): kuchlanishni o‘zgartirish", hint: "Rezistor bir xil, reostat bilan U ni o‘zgartiring" }, { id: "r", label: "2. I(R): rezistorni almashtirish", hint: "U ni reostat bilan bir xil qilib turing" }],
  vw: (n) => (n ? 400 : 680), vh: (n) => (n ? 400 : 340),
  draw,
  down(x, y, lab) {
    if (inBox(x, y, geo.key)) { st.on = !st.on; return true; }
    if (inBox(x, y, geo.rez)) { const ks = Object.keys(RES), list = lab.mode === "r" ? ks.filter((k) => RES[k].nom) : ks; st.rez = list[(list.indexOf(st.rez) + 1) % list.length]; return true; }
    const R = geo.rh; if (R && x >= R.x0 - 14 && x <= R.x1 + 14 && y >= R.y - 30 && y <= R.y + 30) { st.rh = Math.min(1, Math.max(0, (x - R.x0) / (R.x1 - R.x0))); return "rh"; }
    return null;
  },
  move(h, x) { const R = geo.rh; st.rh = Math.min(1, Math.max(0, (x - R.x0) / (R.x1 - R.x0))); },
  cursor(x, y) { const R = geo.rh; return inBox(x, y, geo.key) || inBox(x, y, geo.rez) ? "pointer" : R && x >= R.x0 - 14 && x <= R.x1 + 14 && y >= R.y - 30 && y <= R.y + 30 ? "ew-resize" : ""; },
  onMode(m) { if (m === "r" && st.rez === "rx") st.rez = "r5"; },
  controls: [
    { type: "seg", label: "Tok manbai", opts: Object.entries(SRC).map(([k, v]) => [k, v.name]), get: () => st.src, set: (v) => { st.src = v; } },
    { type: "seg", label: "Rezistor", opts: resOpts, get: () => st.rez, set: (v, lab) => { if (lab.mode === "r" && !RES[v].nom) return; st.rez = v; } },
    { type: "range", label: "Reostat sirpang‘ichi", min: 0, max: 1, step: 0.005, get: () => st.rh, set: (v) => { st.rh = v; }, fmt: (v) => `${Math.round(v * 100)} %` },
    { type: "seg", label: "Kalit", opts: [[true, "Ulangan"], [false, "Uzilgan"]], get: () => st.on, set: (v) => { st.on = v; } },
    { type: "note", text: "Sahnada: kalitni bosing, reostat sirpang‘ichini suring, rezistorni bosib almashtiring. 2-topshiriqda Rₓ ishlatilmaydi." },
  ],
  readouts() {
    const r = reading();
    return [["Voltmetr <i>U</i>", `${fmt(r.U, 1)}<small>V</small>`, `bo‘linma qiymati ${fmt(V_DIV, 1)} V`, "blue"],
      ["Ampermetr <i>I</i>", `${fmt(r.I, 2)}<small>A</small>`, `bo‘linma qiymati ${fmt(A_DIV, 2)} A`, "orange"],
      ["Rezistor", RES[st.rez].name, st.on ? "zanjir ulangan" : "kalit uzilgan"],
      ["U / I", r.I > 0 ? `${fmt(r.U / r.I, 2)}<small>Ω</small>` : "—", "qarshilik (taxminiy)"]];
  },
  record(lab) {
    if (!st.on) return { err: "Kalit uzilgan — avval zanjirni ulang." };
    const r = reading();
    if (r.raw.I > A_MAX) return { err: "Ampermetr shkaladan chiqib ketdi — reostat qarshiligini oshiring." };
    if (r.I < 0.04) return { err: "Tok juda kichik — sirpang‘ichni suring." };
    const v = { rez: st.rez, U: fmt(r.U, 1), I: fmt(r.I, 2) };
    return { t: lab.mode === "r" ? "t2" : "t1", v, text: `${RES[st.rez].name}: U = ${v.U} V, I = ${v.I} A` };
  },
  explain() { const r = reading(); return st.on ? `Zanjirda tok bor. Voltmetr rezistordagi kuchlanishni ko‘rsatadi: <b>U = ${fmt(r.U, 1)} V</b>, ampermetr — tok kuchini: <b>I = ${fmt(r.I, 2)} A</b>. Reostat qarshiligi kamaysa tok va kuchlanish ortadi, ammo U/I nisbati (rezistor qarshiligi) o‘zgarmaydi.` : "Kalit uzilgan — zanjirda tok yo‘q, asboblar nolni ko‘rsatadi."; },
  steps: [
    "Zanjir sxemasini ko‘rib chiqing: ampermetr ketma-ket, voltmetr rezistorga parallel ulangan. Kalitni bosib zanjirni ulang.",
    "1-topshiriq: reostat sirpang‘ichini kamida 4–5 holatga qo‘yib, har safar voltmetr va ampermetr ko‘rsatkichini <b>Qaydga yozing</b>. Xohlasangiz boshqa rezistor uchun takrorlang (Rₓ — noma’lum qarshilik).",
    "2-topshiriq: R₁, R₂, R₃ rezistorlarni navbat bilan qo‘ying, har birida reostat bilan kuchlanishni bir xil (masalan, 3,0 V) qilib, tok kuchini yozing.",
    "Qaydlarni «→» tugmasi bilan daftardagi jadvallarga o‘tkazing, xulosa yozing va PDF hisobotni yuklab oling.",
  ],
  formulas: ["Om qonuni: <span class=\"sim-math\">I = U / R</span>", "Qarshilik: <span class=\"sim-math\">R = U / I</span>", "Asbob ko‘rsatkichi = bo‘linmalar soni × bo‘linma qiymati", "Bo‘linma qiymati = (ikki raqam ayirmasi) / (ular orasidagi bo‘linmalar soni)"],
  note: "Strelkali asbobni o‘qishda ko‘zni shkalaga tik qarating (ko‘zgu chizig‘idagi aks strelka ortida yashirinsin). Qaydga asbob ko‘rsatkichi yarim bo‘linmagacha aniqlikda yoziladi.",
  notebook: {
    intro: "Qaydlardagi o‘lchovlarni jadvallarga o‘tkazing (yoki qo‘lda kiriting) — qarshilik, grafik va tekshiruv avtomatik. Kamida 1-topshiriq bajarilishi kerak.",
    conclusionPh: "Tok kuchi kuchlanishga qanday bog‘liq? Rezistorlarning topilgan qarshiliklari; Rₓ qiymati; U o‘zgarmas bo‘lganda I va R bog‘lanishi.",
    hint: "Javob bering: 1) I(U) grafigi koordinata boshidan o‘tuvchi to‘g‘ri chiziqmi? 2) Grafik qiyaligi nimaga teng? 3) Topilgan qarshilik nominal qiymatdan necha foiz farq qiladi va nima uchun? 4) U o‘zgarmas bo‘lsa, R ikki marta ortsa I qanday o‘zgaradi?",
    minTables: 1,
    tables: [
      { key: "t1", req: true, okLabel: "I(U)", need: "1-jadvalda bitta rezistor uchun kamida 4 ta o‘lchash", title: "1-topshiriq. Tok kuchining kuchlanishga bog‘liqligi",
        desc: "Rezistor bir xil, reostat bilan kuchlanish o‘zgartiriladi. Kamida 4 ta turli kuchlanish.",
        head: ["Rezistor", "U, V", "I, A", "R = U/I, Ω", "Tekshiruv"], cols: [{ k: "rez", kind: "sel", opts: resOpts }, { k: "U", kind: "num" }, { k: "I", kind: "num" }], outs: ["R"],
        blank: () => ({ rez: "r5", U: "", I: "" }), rows: 5, max: 14, narrow: true,
        parse: (r) => ({ rez: r.rez, U: num(r.U), I: num(r.I) }),
        check: (r) => (!(r.U > 0) || !(r.I > 0) ? { ok: false, err: "U va I musbat son" } : r.U > V_MAX || r.I > A_MAX ? { ok: false, err: "asbob chegarasidan katta" } : { ok: true }),
        analyze: analyze1, out: (A, j) => ({ R: fmt(A.rows[j].Ri, 2) }),
        summary: (A) => A.groups.filter((g) => g.fit).map((g) => [RES[g.rez].name.replace(" = ?", ""), `${fmt(1 / g.fit.k, 2)} Ω`, `${g.rows.length} ta o‘lchash, grafik qiyaligidan`]),
        ok: (A) => A.ok },
      { key: "t2", okLabel: "I(R)", need: "2-jadvalda kamida 3 xil rezistor, U bir xil", title: "2-topshiriq. Tok kuchining qarshilikka bog‘liqligi",
        desc: "Har bir rezistorda reostat bilan kuchlanishni bir xil qiling. Kamida 3 xil rezistor (R₁, R₂, R₃).",
        head: ["Rezistor", "U, V", "I, A", "1/R, 1/Ω", "I·R, V", "Tekshiruv"], cols: [{ k: "rez", kind: "sel", opts: resOpts.filter(([k]) => RES[k].nom) }, { k: "U", kind: "num" }, { k: "I", kind: "num" }], outs: ["inv", "IR"],
        blank: (i) => ({ rez: ["r5", "r8", "r10"][i] || "r5", U: "", I: "" }), rows: 3, max: 8, narrow: true,
        parse: (r) => ({ rez: r.rez, U: num(r.U), I: num(r.I) }),
        check: (r) => (!(r.U > 0) || !(r.I > 0) ? { ok: false, err: "U va I musbat son" } : { ok: true }),
        analyze: analyze2, out: (A, j) => ({ inv: fmt(A.rows[j].inv, 3), IR: fmt(A.rows[j].IR, 2) }),
        summary: (A) => (A.rows.length ? [["U (o‘rtacha)", `${fmt(A.U.m, 2)} V`, A.spread > 0.08 ? "kuchlanish bir xil emas!" : `farqi ${fmt(100 * A.spread, 1)} %`], ...(A.fit ? [["I·R (qiyalik)", `${fmt(A.fit.k, 2)} V`, "≈ U bo‘lishi kerak"]] : [])] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
