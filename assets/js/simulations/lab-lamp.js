// ==========================================================================
// Laboratoriya ishi: Lampochka quvvatini aniqlash (simulations/lampochka-quvvati.html). Darslik: 8-sinf §33.
// Qurilma: batareya, kalit, ampermetr, reostat, cho‘g‘lanma lampochka (patronda), voltmetr (lampochkaga parallel).
// Fizika: joule-physics.js (volfram tolasi: I ∝ U^0,58, sovuq tola qarshiligi ~12 marta kichik; nurlanish balansi).
// Haqiqiy lampochka yorlig‘idagidan ~3 % kam quvvat oladi (ishlab chiqarish farqi) — natija nominaldan biroz farq qiladi.
// ==========================================================================

import { createLab, docKit, fitLine, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { lampU, filamentT, brightness } from "./joule-physics.js";
import { meter, battery, keySwitch, rheostat, lamp, wire, hint, inBox } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-lampochka-quvvati.html", label: "oliyfizika.uz/simulations/lab-lampochka-quvvati.html" };
// yorliqdagi (nominal) va haqiqiy parametrlar
const LAMPS = {
  l35: { name: "3,5 V; 0,28 A", Un: 3.5, In: 0.28, real: { Pn: 3.5 * 0.28 * 0.97, Un: 3.5 } },
  l63: { name: "6,3 V; 0,3 A", Un: 6.3, In: 0.3, real: { Pn: 6.3 * 0.3 * 0.965, Un: 6.3 } },
};
const SRC = { s45: { name: "4,5 V", emf: 4.5, r: 0.5 }, s8: { name: "8 V", emf: 8, r: 0.6 } };
const RH_MAX = 30, A_MAX = 0.5, A_DIV = 0.01, V_MAX = 10, V_DIV = 0.2, K_A = 1.008, K_V = 0.994;
const st = { lamp: "l35", src: "s45", rh: 0.7, on: false, burnt: false };
const geo = {};
const readMeter = (v, div) => Math.round(v / (div / 2)) * (div / 2);

/** Ketma-ket zanjir: ε = I(r + R_reo) + U_lampa(I) — I bisektsiya bilan. */
function circuit() {
  if (!st.on || st.burnt) return { I: 0, U: 0, P: 0, T: 293 };
  const S = SRC[st.src], L = LAMPS[st.lamp].real, Rx = S.r + RH_MAX * st.rh;
  let lo = 0, hi = S.emf / Math.max(Rx, 0.01) + 1;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (m * Rx + lampU(L, m) > S.emf) hi = m; else lo = m; }
  const I = (lo + hi) / 2, U = lampU(L, I);
  if (U > LAMPS[st.lamp].Un * 1.4) { st.burnt = true; return { I: 0, U: 0, P: 0, T: 293 }; } // tola kuyadi
  return { I, U, P: U * I, T: filamentT(L, U * I) };
}
const reading = () => { const c = circuit(); return { ...c, Ir: readMeter(c.I * K_A, A_DIV), Ur: readMeter(c.U * K_V, V_DIV), Ia: c.I * K_A, Ua: c.U * K_V }; };

const LAY = {
  wide: { A: [70, 8, 200, 140], V: [410, 8, 200, 140], ty: 158, bat: [20, 256, 96], rh: [150, 190, 150], lp: [490, 286], key: [220, 312, 46], vMinusX: 426, vPlusX: 660, rhX: 560, rail: 312, left: 8 },
  narrow: { A: [10, 8, 180, 130], V: [210, 8, 180, 130], ty: 148, bat: [12, 262, 80], rh: [140, 196, 120], lp: [318, 306], key: [150, 352, 44], vMinusX: 272, vPlusX: 392, rhX: 372, rail: 352, left: 6 },
};
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, r = reading(), L = narrow ? LAY.narrow : LAY.wide;
  geo.A = meter(ctx, c, ...L.A, { sym: "A", max: A_MAX, major: 5, minor: 10, value: r.Ia, cls: "1,5", title: "AMPERMETR" });
  geo.V = meter(ctx, c, ...L.V, { sym: "V", max: V_MAX, major: 5, minor: 10, value: r.Ua, cls: "1,5", title: "VOLTMETR" });
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.08)" : "rgba(226,232,240,0.55)"; ctx.beginPath(); ctx.roundRect(4, L.ty, w - 8, h - L.ty - 4, 12); ctx.fill();
  const B = battery(ctx, c, L.bat[0], L.bat[1], L.bat[2], 34, SRC[st.src].name);
  const RH = rheostat(ctx, c, L.rh[0], L.rh[1], L.rh[2], st.rh, `Reostat 0…${RH_MAX} Ω`); geo.rh = RH;
  const LP = lamp(ctx, c, L.lp[0], L.lp[1], narrow ? 1.1 : 1.3, Math.min(1, brightness(r.T)), LAMPS[st.lamp].name);
  const K = keySwitch(ctx, c, L.key[0], L.key[1], L.key[2], st.on); geo.key = K.box;
  const A = geo.A, V = geo.V, cu = "#b45309", cv = "#2563eb";
  wire(ctx, [B.plus, [B.plus[0], A.minus[1] + 14], [A.minus[0], A.minus[1] + 14], A.minus], cu);
  wire(ctx, [A.plus, [A.plus[0], A.minus[1] + 18], [RH.a[0] - 16, A.minus[1] + 18], [RH.a[0] - 16, RH.a[1]], RH.a], cu);
  wire(ctx, [RH.b, [L.rhX, RH.b[1]], [L.rhX, LP.b[1] + 14], [LP.b[0], LP.b[1] + 14], LP.b], cu);
  wire(ctx, [LP.a, [LP.a[0], L.rail], K.b], cu);
  wire(ctx, [K.a, [L.left, L.rail], [L.left, B.minus[1] - 12], [B.minus[0], B.minus[1] - 12], B.minus], cu);
  wire(ctx, [V.minus, [L.vMinusX, V.minus[1]], [L.vMinusX, LP.a[1] - 50], [LP.a[0] - 28, LP.a[1] - 50], [LP.a[0] - 28, LP.a[1]], LP.a], cv, 1.8);
  wire(ctx, [V.plus, [V.plus[0], V.plus[1] + 14], [L.vPlusX, V.plus[1] + 14], [L.vPlusX, LP.b[1] + 30], [LP.b[0], LP.b[1] + 30], LP.b], cv, 1.8);
  geo.lamp = { x0: L.lp[0] - 30, x1: L.lp[0] + 30, y0: L.lp[1] - 46, y1: L.lp[1] + 14 };
  hint(ctx, c, st.on ? "kalit: uzish" : "kalitni bosing", K.box.x1 + 10, L.key[1] - 2);
  hint(ctx, c, "sirpang‘ichni suring", RH.x0 - 10, L.rh[1] - 34);
  if (st.burnt) hint(ctx, c, "Lampochka kuydi! «Yangi lampochka» ni bosing", L.lp[0], L.lp[1] - 62, "center");
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows, cond) {
  const L = LAMPS[cond.lamp] || LAMPS.l35;
  const rs = rows.map((r) => ({ ...r, P: r.U * r.I, R: r.U / r.I })).sort((a, b) => a.U - b.U);
  // nominal kuchlanishdagi quvvat: eng yaqin ikki nuqta orasida chiziqli interpolatsiya (yoki eng yaqin nuqta)
  let Pn = NaN; const below = rs.filter((r) => r.U <= L.Un).at(-1), above = rs.find((r) => r.U >= L.Un);
  if (below && above && above.U > below.U) Pn = below.P + ((above.P - below.P) * (L.Un - below.U)) / (above.U - below.U);
  else if (below && Math.abs(below.U - L.Un) / L.Un < 0.05) Pn = below.P;
  else if (above && Math.abs(above.U - L.Un) / L.Un < 0.05) Pn = above.P;
  const lg = rs.length >= 3 ? fitLine(rs.map((r) => [Math.log(r.U), Math.log(r.I)])) : null;
  return { rows: rs, L, Pn, Pnom: L.Un * L.In, exp: lg?.b, ok: rs.length >= 4 && Number.isFinite(Pn) };
}

function build(nb, res) {
  const A = res.t1.A, L = A.L, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Ampermetr va voltmetr yordamida cho‘g‘lanma lampochkaning turli kuchlanishlardagi quvvatini aniqlash.", "Nominal kuchlanishdagi quvvatni lampochka yorlig‘idagi qiymat bilan solishtirish; tola qarshiligining o‘zgarishini kuzatish."]);
  D.S("Qisqacha nazariya");
  D.p("Elektr tokining quvvati iste’molchi uchlaridagi kuchlanish va undan o‘tayotgan tok kuchining ko‘paytmasiga teng:");
  D.eq("P = U I", 1);
  D.p("Lampochka yorlig‘ida nominal kuchlanish $U_n$ va tok $I_n$ (yoki quvvat) yoziladi: $P_n = U_n I_n$. Volfram tolasi qizigani sari qarshiligi ortadi, shuning uchun $R = U/I$ kuchlanish bilan o‘sadi va $I(U)$ to‘g‘ri chiziq emas.");
  D.eq("R = \\frac{U}{I}", 2);
  D.S("Jihozlar");
  D.list([`Batareya (${SRC[st.src].name}), kalit, reostat $0\\ldots ${RH_MAX}$ Ω, ulovchi simlar.`, `Cho‘g‘lanma lampochka (yorlig‘ida: ${L.name}) patronda.`, `Ampermetr $0\\ldots 0{,}5$ A (bo‘linma qiymati $0{,}01$ A), voltmetr $0\\ldots 10$ V (bo‘linma qiymati $0{,}2$ V).`]);
  D.S("Ishni bajarish tartibi");
  D.list(["Batareya, kalit, ampermetr, reostat va lampochka ketma-ket ulandi; voltmetr lampochkaga parallel ulandi.", "Reostat bilan lampochkadagi kuchlanish bosqichma-bosqich oshirildi (nominaldan oshirilmadi), har gal $U$ va $I$ yozildi.", "Har bir o‘lchash uchun quvvat va qarshilik hisoblandi; nominal kuchlanishdagi quvvat yorliqdagi qiymat bilan solishtirildi."], true);
  D.S("O‘lchash natijalari");
  D.table(`Lampochka (${L.name}) quvvati va qarshiligi`, ["№", "$U$, V", "$I$, A", "$P = UI$, W", "$R = U/I$, Ω", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.U, 1)}$`, `$${fx(r.I, 3)}$`, `$${fx(r.P, 3)}$`, `$${fx(r.R, 1)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
    "«Tekshiruv»: $\\checkmark$ — qiymatlar tajriba qaydlarida bor.");
  const umax = Math.max(L.Un, ...A.rows.map((r) => r.U)) * 1.1;
  D.fig("pu", "Lampochka quvvatining kuchlanishga bog‘liqligi.", { xmin: 0, xmax: umax, ymin: 0, ymax: Math.max(...A.rows.map((r) => r.P)) * 1.25, legendPos: "north west", xlab: "U, V", ylab: "P, W",
    series: [{ kind: "line", data: A.rows.map((r) => [r.U, r.P]), color: "#94a3b8", dash: "4 3" }, { kind: "pts", data: A.rows.map((r) => [r.U, r.P]), color: "#c2410c", label: "tajriba" }, { kind: "pts", data: [[L.Un, A.Pnom]], color: "#1d4ed8", label: "yorliqdagi P_n = U_n I_n" }] });
  D.fig("ru", "Tola qarshiligining kuchlanishga bog‘liqligi: tola qizigan sari qarshilik ortadi.", { xmin: 0, xmax: umax, ymin: 0, ymax: Math.max(...A.rows.map((r) => r.R)) * 1.25, legendPos: "north west", xlab: "U, V", ylab: "R, Ω",
    series: [{ kind: "line", data: A.rows.map((r) => [r.U, r.R]), color: "#94a3b8", dash: "4 3" }, { kind: "pts", data: A.rows.map((r) => [r.U, r.R]), color: "#15803d", label: "R = U/I" }] });
  const r0 = A.rows.at(-1);
  D.p("**Hisoblash** (oxirgi o‘lchash va nominal kuchlanish uchun):");
  D.eq([`P = UI = ${fx(r0.U, 1)}\\ \\text{V}\\cdot ${fx(r0.I, 3)}\\ \\text{A} = ${fx(r0.P, 3)}\\ \\text{W},\\qquad R = \\frac{U}{I} = ${fx(r0.R, 1)}\\ \\Omega`,
    `P(U_n = ${fx(L.Un, 1)}\\ \\text{V}) = ${fx(A.Pn, 3)}\\ \\text{W};\\qquad P_n = U_n I_n = ${fx(L.Un, 1)}\\cdot ${fx(L.In, 2)} = ${fx(A.Pnom, 3)}\\ \\text{W}\\quad(\\text{farq}\\ ${fx(pct(A.Pn, A.Pnom), 1)}\\,\\%)`]);
  D.S("Xulosa");
  const box = [`• Nominal kuchlanishda lampochka quvvati $P = ${fx(A.Pn, 2)}$ W, yorliqdagi $P_n = ${fx(A.Pnom, 2)}$ W (farq $${fx(pct(A.Pn, A.Pnom), 1)}\\,\\%$).`,
    `• Tola qarshiligi $${fx(A.rows[0].R, 1)}$ Ω dan $${fx(r0.R, 1)}$ Ω gacha ortdi — metall qarshiligi temperaturaga bog‘liq.`];
  if (Number.isFinite(A.exp)) box.push(`• $I \\propto U^{n}$, $n = ${fx(A.exp, 2)} < 1$ — Om qonuni (o‘zgarmas $R$ uchun) lampochka uchun bajarilmaydi.`);
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Lampochka quvvatini aniqlash", titlePlain: "Laboratoriya ishi. Lampochka quvvati", author: nb.f.name, sub: `Cho‘g‘lanma lampochka ${L.name}: quvvat va qarshilik`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "lamp", fileBase: "Lampochka-quvvati-lab", docLabel: "Virtual laboratoriya ishi · 8-sinf", site: SITE,
  vw: (n) => (n ? 400 : 680), vh: (n) => (n ? 400 : 340),
  draw,
  down(x, y) {
    if (inBox(x, y, geo.key)) { st.on = !st.on; return true; }
    const R = geo.rh; if (R && x >= R.x0 - 14 && x <= R.x1 + 14 && y >= R.y - 30 && y <= R.y + 30) { st.rh = Math.min(1, Math.max(0, (x - R.x0) / (R.x1 - R.x0))); return "rh"; }
    return null;
  },
  move(h, x) { const R = geo.rh; st.rh = Math.min(1, Math.max(0, (x - R.x0) / (R.x1 - R.x0))); },
  cursor(x, y) { const R = geo.rh; return inBox(x, y, geo.key) ? "pointer" : R && x >= R.x0 - 14 && x <= R.x1 + 14 && y >= R.y - 30 && y <= R.y + 30 ? "ew-resize" : ""; },
  tools: [{ label: "Yangi lampochka", run: (lab) => { st.burnt = false; st.rh = 1; lab.say("Lampochka almashtirildi, reostat — eng katta qarshilikda."); } }],
  controls: [
    { type: "seg", label: "Lampochka (yorlig‘i)", opts: Object.entries(LAMPS).map(([k, v]) => [k, v.name]), get: () => st.lamp, set: (v) => { st.lamp = v; st.src = v === "l63" ? "s8" : "s45"; st.rh = 1; st.burnt = false; } },
    { type: "seg", label: "Batareya", opts: Object.entries(SRC).map(([k, v]) => [k, v.name]), get: () => st.src, set: (v) => { st.src = v; } },
    { type: "range", label: "Reostat sirpang‘ichi", min: 0, max: 1, step: 0.005, get: () => st.rh, set: (v) => { st.rh = v; }, fmt: (v) => `${Math.round(v * 100)} %` },
    { type: "seg", label: "Kalit", opts: [[true, "Ulangan"], [false, "Uzilgan"]], get: () => st.on, set: (v) => { st.on = v; } },
    { type: "note", text: "Lampochkadagi kuchlanish nominaldan (yorliqdagidan) oshmasin — aks holda tola kuyadi." },
  ],
  readouts() {
    const r = reading(), L = LAMPS[st.lamp];
    return [["Voltmetr <i>U</i>", `${fmt(r.Ur, 1)}<small>V</small>`, `bo‘linma qiymati ${fmt(V_DIV, 1)} V`, "blue"], ["Ampermetr <i>I</i>", `${fmt(r.Ir, 3)}<small>A</small>`, `bo‘linma qiymati ${fmt(A_DIV, 2)} A`, "orange"],
      ["Quvvat <i>P</i> = <i>UI</i>", `${fmt(r.Ur * r.Ir, 2)}<small>W</small>`, `yorliqda ${fmt(L.Un * L.In, 2)} W`, "green"], ["Tola", r.T > 900 ? `${Math.round(r.T)} K` : "qizimagan", r.U > L.Un * 1.12 ? "XAVF: nominaldan yuqori!" : "taxminiy harorat", r.U > L.Un * 1.12 ? "red" : ""]];
  },
  record() {
    if (!st.on) return { err: "Kalit uzilgan — avval zanjirni ulang." };
    if (st.burnt) return { err: "Lampochka kuygan — «Yangi lampochka» ni bosing." };
    const r = reading();
    if (r.Ia > A_MAX) return { err: "Ampermetr shkaladan chiqdi." };
    if (r.Ir < 0.02) return { err: "Tok juda kichik — reostat qarshiligini kamaytiring." };
    const v = { U: fmt(r.Ur, 1), I: fmt(r.Ir, 3) };
    return { t: "t1", v, text: `${LAMPS[st.lamp].name}: U = ${v.U} V, I = ${v.I} A` };
  },
  explain() { const r = reading(), L = LAMPS[st.lamp]; return st.burnt ? "Tola kuydi: kuchlanish nominaldan ancha oshib ketdi. Zanjir uzildi — asboblar nol ko‘rsatadi." : st.on ? `Lampochkadagi kuchlanish ${fmt(r.Ur, 1)} V, tok ${fmt(r.Ir, 3)} A — quvvat P = UI ≈ <b>${fmt(r.Ur * r.Ir, 2)} W</b>. ${r.U < 0.3 * L.Un ? "Tola hali deyarli qizimagan, qarshiligi kichik." : "Tola qizib, qarshiligi ortgan: R = U/I ≈ " + fmt(r.Ur / Math.max(r.Ir, 1e-6), 1) + " Ω."}` : "Kalit uzilgan."; },
  steps: ["Kalitni ulang. Reostat sirpang‘ichini o‘ng chetdan (katta qarshilik) chapga asta suring.", "Kuchlanishni 4–6 bosqichda (nominalgacha) oshirib, har safar U va I ni <b>Qaydga yozing</b>. Albatta nominal kuchlanishga yaqin bir o‘lchash bo‘lsin.", "Qaydlarni jadvalga o‘tkazing: quvvat va qarshilik avtomatik hisoblanadi. Nominaldagi quvvatni yorliqdagi bilan solishtiring.", "Xulosa yozing va PDF hisobotni yuklab oling."],
  formulas: ["Quvvat: <span class=\"sim-math\">P = U·I</span>", "Nominal quvvat: <span class=\"sim-math\">Pₙ = Uₙ·Iₙ</span>", "Qarshilik: <span class=\"sim-math\">R = U / I</span>", "Ish: <span class=\"sim-math\">A = P·t</span>"],
  note: "Qizigan volfram tolasining qarshiligi sovuq holatdagidan 10–15 marta katta. Shuning uchun lampochka yoqilgan zahoti tok eng katta bo‘ladi va lampochkalar ko‘pincha yoqish paytida kuyadi.",
  notebook: {
    intro: "Lampochkani tanlang (jadval sharti), qaydlarni jadvalga o‘tkazing. Kamida 4 ta o‘lchash, ulardan biri nominal kuchlanishga yaqin bo‘lsin.",
    conclusionPh: "Nominal kuchlanishdagi quvvat yorliqdagi qiymatga mosmi? Quvvat va qarshilik kuchlanishga qanday bog‘liq?",
    hint: "Javob bering: 1) Nominal kuchlanishdagi quvvat yorliqdagidan necha foiz farq qiladi va nima uchun? 2) Kuchlanish 2 marta ortganda quvvat necha marta ortdi? 3) Nega tola qarshiligi o‘zgarmas emas? 4) Lampochka 1 soatda qancha energiya sarflaydi?",
    tables: [
      { key: "t1", okLabel: "P(U)", need: "jadvalda kamida 4 ta o‘lchash, biri nominal kuchlanishga yaqin", title: "Lampochka quvvatini aniqlash",
        cond: { fields: [{ k: "lamp", label: "Lampochka", opts: Object.entries(LAMPS).map(([k, v]) => [k, v.name]) }], sync: () => ({ lamp: st.lamp }), init: { lamp: "l35" } },
        head: ["U, V", "I, A", "P = UI, W", "R = U/I, Ω", "Tekshiruv"], cols: [{ k: "U", kind: "num" }, { k: "I", kind: "num" }], outs: ["P", "R"],
        blank: () => ({ U: "", I: "" }), rows: 5, max: 12, narrow: true,
        parse: (r) => ({ U: num(r.U), I: num(r.I) }), check: (r) => (!(r.U > 0) || !(r.I > 0) ? { ok: false, err: "U va I musbat son" } : { ok: true }),
        analyze, out: (A, j, r) => ({ P: fmt(r.U * r.I, 3), R: fmt(r.U / r.I, 1) }),
        summary: (A) => (A.rows.length ? [["P (nominal U da)", Number.isFinite(A.Pn) ? `${fmt(A.Pn, 3)} W` : "—", `yorliqda ${fmt(A.Pnom, 3)} W`], ["R: min → max", `${fmt(A.rows[0].R, 1)} → ${fmt(A.rows.at(-1).R, 1)} Ω`, "tola qiziydi"]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
