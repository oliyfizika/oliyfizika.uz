// ==========================================================================
// Laboratoriya ishi: Tok manbaining EYuK va ichki qarshiligini aniqlash (simulations/lab-eyuk.html). Darslik: 10-sinf §35.
// Qurilma: tok manbai (EYuK va ichki qarshiligi o‘quvchiga noma’lum), kalit, ampermetr, reostat, himoya rezistori R₀,
// voltmetr manba qisqichlariga ulangan. Kalit uzilganda voltmetr ≈ ε ni ko‘rsatadi; tok ortsa U = ε − Ir kamayadi.
// Fizika: circuit-physics.js (tugun potensiallari usuli, voltmetr R_V = 1 MΩ).
// ==========================================================================

import { createLab, docKit, fitLine, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { solve } from "./circuit-physics.js";
import { meter, battery, keySwitch, rheostat, resistor, wire, hint, inBox } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-eyuk.html", label: "oliyfizika.uz/simulations/lab-eyuk.html" };
const SRC = {
  b45: { name: "Batareya «4,5 V»", short: "4,5 V", emf: 4.47, r: 1.35 },
  e15: { name: "Galvanik element «1,5 V»", short: "1,5 V", emf: 1.56, r: 0.42 },
  old: { name: "Eskirgan batareya «4,5 V»", short: "4,5 V*", emf: 4.21, r: 3.6 },
};
const R0 = 2.03, RH_MAX = 20, A_MAX = 2, A_DIV = 0.05, V_MAX = 6, V_DIV = 0.1, K_A = 1.01, K_V = 0.994;
const st = { src: "b45", rh: 0.8, on: false };
const geo = {};
const readMeter = (v, div) => Math.round(v / (div / 2)) * (div / 2);

function circuit() {
  const S = SRC[st.src];
  const s = solve(5, [
    { type: "battery", a: 0, b: 1, emf: S.emf, r: S.r, plus: "b" },
    { type: "switch", a: 1, b: 2, closed: st.on },
    { type: "ammeter", a: 2, b: 3 },
    { type: "rheostat", a: 3, b: 4, Rmax: RH_MAX, pos: Math.max(st.rh, 0.002) },
    { type: "resistor", a: 4, b: 0, R: R0 },
    { type: "voltmeter", a: 1, b: 0 },
  ]);
  const I = Math.abs(s.el[2].I) * K_A, U = Math.abs(s.el[5].U) * K_V;
  return { I, U, Ir: readMeter(I, A_DIV), Ur: readMeter(U, V_DIV) };
}

const LAY = {
  wide: { V: [70, 8, 200, 140], A: [410, 8, 200, 140], ty: 158, bat: [20, 256, 96], key: [150, 240, 46], kx: 330, rh: [380, 190, 150], aR: 660, rhL: 356, r0: [420, 288, 80], rail: 330, left: 8, vy: [154, 170] },
  narrow: { V: [10, 8, 180, 130], A: [210, 8, 180, 130], ty: 148, bat: [12, 262, 80], key: [120, 240, 44], kx: 200, rh: [240, 188, 120], aR: 394, rhL: 220, r0: [260, 300, 70], rail: 350, left: 6, vy: [142, 160] },
};
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, r = circuit(), L = narrow ? LAY.narrow : LAY.wide;
  const V = meter(ctx, c, ...L.V, { sym: "V", max: V_MAX, major: 6, minor: 10, value: r.U, cls: "1,5", title: "VOLTMETR" });
  const A = meter(ctx, c, ...L.A, { sym: "A", max: A_MAX, major: 4, minor: 10, value: r.I, cls: "1,5", title: "AMPERMETR" });
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.08)" : "rgba(226,232,240,0.55)"; ctx.beginPath(); ctx.roundRect(4, L.ty, w - 8, h - L.ty - 4, 12); ctx.fill();
  const B = battery(ctx, c, L.bat[0], L.bat[1], L.bat[2], 34, SRC[st.src].short);
  const K = keySwitch(ctx, c, L.key[0], L.key[1], L.key[2], st.on); geo.key = K.box;
  const RH = rheostat(ctx, c, L.rh[0], L.rh[1], L.rh[2], st.rh, `Reostat 0…${RH_MAX} Ω`); geo.rh = RH;
  const RZ = resistor(ctx, c, L.r0[0], L.r0[1], L.r0[2], "R₀ = 2 Ω");
  const cu = "#b45309", cv = "#2563eb";
  wire(ctx, [B.plus, [B.plus[0], K.a[1]], K.a], cu);
  wire(ctx, [K.b, [L.kx, K.b[1]], [L.kx, A.minus[1] + 16], [A.minus[0], A.minus[1] + 16], A.minus], cu);
  wire(ctx, [A.plus, [A.plus[0], A.plus[1] + 16], [L.aR, A.plus[1] + 16], [L.aR, RH.b[1]], RH.b], cu);
  wire(ctx, [RH.a, [L.rhL, RH.a[1]], [L.rhL, RZ.a[1]], RZ.a], cu);
  wire(ctx, [RZ.b, [RZ.b[0] + 18, RZ.b[1]], [RZ.b[0] + 18, L.rail], [L.left, L.rail], [L.left, K.a[1] - 4], [B.minus[0], K.a[1] - 4], B.minus], cu);
  wire(ctx, [V.minus, [V.minus[0], L.vy[0]], [B.minus[0], L.vy[0]], [B.minus[0], K.a[1] - 4]], cv, 1.8);
  wire(ctx, [V.plus, [V.plus[0], L.vy[1]], [B.plus[0], L.vy[1]], [B.plus[0], K.a[1]]], cv, 1.8);
  hint(ctx, c, st.on ? "kalit: uzish" : "kalitni bosing", K.box.x0, L.key[1] + 34);
  hint(ctx, c, "sirpang‘ichni suring", RH.x0, L.rh[1] - 34);
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows) {
  const rs = rows.slice().sort((a, b) => a.I - b.I), f = fitLine(rs.map((r) => [r.I, r.U]));
  const emf = f ? f.a : NaN, rr = f ? -f.b : NaN;
  return { rows: rs, f, emf, r: rr, Isc: emf / rr, ok: !!f && new Set(rs.map((r) => r.I)).size >= 4 && rr > 0 };
}
function build(nb, res) {
  const A = res.t1.A, D = docKit(), S = SRC[res.t1.cond.src] || SRC[st.src];
  D.S("Ishning maqsadi");
  D.list(["Tok manbaining elektr yurituvchi kuchi (EYuK) va ichki qarshiligini tajribada aniqlash.", "To‘liq zanjir uchun Om qonunini tekshirish."]);
  D.S("Qisqacha nazariya");
  D.p("To‘liq zanjir uchun Om qonuniga ko‘ra tok kuchi $I = \\varepsilon/(R + r)$, bu yerda $R$ — tashqi zanjir qarshiligi, $r$ — manbaning ichki qarshiligi. Manba qisqichlaridagi kuchlanish:");
  D.eq("U = IR = \\varepsilon - I r", 1);
  D.p("Demak, $U(I)$ — kamayuvchi to‘g‘ri chiziq: uning $U$ o‘qi bilan kesishishi ($I = 0$) EYuK ga, qiyaligining moduli ichki qarshilikka teng. Kalit uzilganda (tok deyarli yo‘q) voltmetr EYuK ni ko‘rsatadi. Ikki o‘lchashdan:");
  D.eq("r = \\frac{U_1 - U_2}{I_2 - I_1},\\qquad \\varepsilon = U_1 + I_1 r", 2);
  D.S("Jihozlar");
  D.list([`Tok manbai: ${S.name}.`, `Kalit, reostat $0\\ldots ${RH_MAX}$ Ω, himoya rezistori $R_0 = 2$ Ω, ulovchi simlar.`, `Ampermetr $0\\ldots 2$ A (bo‘linma qiymati $0{,}05$ A), voltmetr $0\\ldots 6$ V (bo‘linma qiymati $0{,}1$ V) — manba qisqichlariga ulangan.`]);
  D.S("Ishni bajarish tartibi");
  D.list(["Zanjir yig‘ildi; voltmetr manba qisqichlariga ulandi. Kalit uzilgan holda voltmetr ko‘rsatkichi yozildi ($I = 0$).", "Kalit ulanib, reostat bilan tok kuchi bosqichma-bosqich o‘zgartirildi; har holatda $I$ va $U$ yozildi.", "$U(I)$ grafigi chizilib, eng kichik kvadratlar usulida $\\varepsilon$ va $r$ topildi."], true);
  D.S("O‘lchash natijalari");
  D.table(`Manba qisqichlaridagi kuchlanishning tok kuchiga bog‘liqligi (${S.name})`, ["№", "$I$, A", "$U$, V", "$\\varepsilon - U$, V", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.I, 3)}$`, `$${fx(r.U, 2)}$`, `$${fx(A.emf - r.U, 2)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
    "$\\varepsilon - U = I r$ — manba ichidagi kuchlanish tushishi.");
  const xmax = Math.max(...A.rows.map((r) => r.I)) * 1.25 + 0.05;
  D.fig("ui", "Manba qisqichlaridagi kuchlanishning tok kuchiga bog‘liqligi. To‘g‘ri chiziq — eng kichik kvadratlar usuli.", { xmin: 0, xmax, ymin: 0, ymax: Math.ceil(A.emf * 1.15 * 2) / 2, legendPos: "north east", xlab: "I, A", ylab: "U, V",
    series: [{ kind: "pts", data: A.rows.map((r) => [r.I, r.U]), color: "#c2410c", label: "tajriba" }, { kind: "line", fn: (x) => A.f.a + A.f.b * x, color: "#1d4ed8", label: `U = ${fmt(A.emf, 2)} − ${fmt(A.r, 2)}·I` }] });
  const p1 = A.rows[0], p2 = A.rows.at(-1), r2 = (p1.U - p2.U) / (p2.I - p1.I);
  D.p("**Hisoblash.** Ikki chetki nuqta bo‘yicha (2) formuladan va barcha nuqtalar bo‘yicha (EKK):");
  D.eq([`r = \\frac{U_1 - U_2}{I_2 - I_1} = \\frac{${fx(p1.U, 2)} - ${fx(p2.U, 2)}}{${fx(p2.I, 3)} - ${fx(p1.I, 3)}} = ${fx(r2, 2)}\\ \\Omega,\\qquad \\varepsilon = U_1 + I_1 r = ${fx(p1.U + p1.I * r2, 2)}\\ \\text{V}`,
    `\\varepsilon = (${fx(A.emf, 2)} \\pm ${fx(Math.max(A.f.sa, 0.005), 2)})\\ \\text{V},\\qquad r = (${fx(A.r, 2)} \\pm ${fx(Math.max(A.f.sb, 0.005), 2)})\\ \\Omega,\\qquad I_{\\text{q.t.}} = \\frac{\\varepsilon}{r} = ${fx(A.Isc, 2)}\\ \\text{A}`]);
  D.S("Xulosa");
  docTail(D.X, nb, userText, [`• Manba EYuK si $\\varepsilon = ${fx(A.emf, 2)}$ V, ichki qarshiligi $r = ${fx(A.r, 2)}$ Ω.`, `• Qisqa tutashuv toki $I_{\\text{q.t.}} = \\varepsilon/r \\approx ${fx(A.Isc, 1)}$ A.`, "• Tok ortishi bilan qisqichlardagi kuchlanish chiziqli kamayadi — to‘liq zanjir uchun Om qonuni tasdiqlandi."], SITE);
  return { title: "Laboratoriya ishi. Tok manbaining EYuK va ichki qarshiligini aniqlash", titlePlain: "Laboratoriya ishi. EYuK va ichki qarshilik", author: nb.f.name, sub: "To‘liq zanjir uchun Om qonuni", meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "emf", fileBase: "EYuK-lab", docLabel: "Virtual laboratoriya ishi · 10-sinf", site: SITE,
  vh: (n) => (n ? 380 : 340),
  draw,
  down(x, y) {
    if (inBox(x, y, geo.key)) { st.on = !st.on; return true; }
    const R = geo.rh; if (R && x >= R.x0 - 14 && x <= R.x1 + 14 && y >= R.y - 30 && y <= R.y + 30) { st.rh = Math.min(1, Math.max(0, (x - R.x0) / (R.x1 - R.x0))); return "rh"; }
    return null;
  },
  move(h, x) { const R = geo.rh; st.rh = Math.min(1, Math.max(0, (x - R.x0) / (R.x1 - R.x0))); },
  cursor(x, y) { const R = geo.rh; return inBox(x, y, geo.key) ? "pointer" : R && x >= R.x0 - 14 && x <= R.x1 + 14 && y >= R.y - 30 && y <= R.y + 30 ? "ew-resize" : ""; },
  controls: [
    { type: "seg", label: "Tok manbai", opts: Object.entries(SRC).map(([k, v]) => [k, v.name]), get: () => st.src, set: (v) => { st.src = v; } },
    { type: "range", label: "Reostat sirpang‘ichi", min: 0, max: 1, step: 0.005, get: () => st.rh, set: (v) => { st.rh = v; }, fmt: (v) => `${Math.round(v * 100)} %` },
    { type: "seg", label: "Kalit", opts: [[true, "Ulangan"], [false, "Uzilgan"]], get: () => st.on, set: (v) => { st.on = v; } },
    { type: "note", text: "Manbaning EYuK va ichki qarshiligi noma’lum — ularni o‘lchashlardan toping. Kalit uzilganda ham voltmetr ko‘rsatkichini yozib oling (I = 0)." },
  ],
  readouts() {
    const r = circuit();
    return [["Voltmetr <i>U</i>", `${fmt(r.Ur, 2)}<small>V</small>`, "manba qisqichlarida", "blue"], ["Ampermetr <i>I</i>", `${fmt(r.Ir, 3)}<small>A</small>`, `bo‘linma qiymati ${fmt(A_DIV, 2)} A`, "orange"],
      ["Kalit", st.on ? "Ulangan" : "Uzilgan", st.on ? "tashqi zanjirda tok bor" : "U ≈ ε"], ["Tashqi qarshilik", "—", "o‘quvchiga noma’lum (reostat + R₀)"]];
  },
  record() {
    const r = circuit();
    if (r.I > A_MAX) return { err: "Ampermetr shkaladan chiqdi — reostat qarshiligini oshiring." };
    const v = { I: fmt(st.on ? r.Ir : 0, 3), U: fmt(r.Ur, 2) };
    return { t: "t1", v, text: `${SRC[st.src].short}: I = ${v.I} A, U = ${v.U} V${st.on ? "" : " (kalit uzilgan)"}` };
  },
  explain() { const r = circuit(); return st.on ? `Tok ${fmt(r.Ir, 3)} A. Manba ichida <b>Ir</b> kuchlanish «yo‘qoladi», shuning uchun qisqichlardagi kuchlanish (${fmt(r.Ur, 2)} V) EYuK dan kichik. Reostat qarshiligini kamaytirsangiz tok ortadi, U esa kamayadi.` : `Kalit uzilgan — tashqi zanjirda tok yo‘q, voltmetr deyarli EYuK ni ko‘rsatadi: <b>${fmt(r.Ur, 2)} V</b>.`; },
  steps: ["Kalit uzilgan holda voltmetr ko‘rsatkichini <b>Qaydga yozing</b> (I = 0, U ≈ ε).", "Kalitni ulang. Reostat sirpang‘ichini surib tok kuchini 4–6 xil qiymatga keltiring, har safar I va U ni qaydga yozing.", "Qaydlarni jadvalga o‘tkazing: U(I) to‘g‘ri chizig‘idan ε va r topiladi.", "Boshqa manba uchun (jadval shartini o‘zgartirib) takrorlash mumkin. Xulosa va PDF hisobot."],
  formulas: ["To‘liq zanjir uchun Om qonuni: <span class=\"sim-math\">I = ε / (R + r)</span>", "Qisqichlardagi kuchlanish: <span class=\"sim-math\">U = ε − Ir</span>", "<span class=\"sim-math\">r = (U₁ − U₂) / (I₂ − I₁)</span>", "Qisqa tutashuv toki: <span class=\"sim-math\">I = ε / r</span>"],
  note: "Batareya eskirgan sari uning ichki qarshiligi ortadi: kalit uzilganda voltmetr deyarli normal kuchlanishni ko‘rsatsa ham, yuklama ulanganda kuchlanish keskin tushadi.",
  notebook: {
    intro: "Jadval sharti — qaysi manba o‘rganilmoqda. Kamida 4 ta turli tok kuchida o‘lchash (I = 0 ham bo‘lishi mumkin).",
    conclusionPh: "Manbaning EYuK va ichki qarshiligi qancha chiqdi? U(I) grafigi qanday ko‘rinishda?",
    hint: "Javob bering: 1) U(I) grafigi to‘g‘ri chiziqmi? 2) Grafik U o‘qini qayerda kesadi va bu nimani bildiradi? 3) Kalit uzilganda voltmetr ko‘rsatkichi nega EYuK ga deyarli teng? 4) Qisqa tutashuv toki qancha va u nega xavfli?",
    tables: [
      { key: "t1", okLabel: "U(I)", need: "jadvalda kamida 4 ta turli tok kuchi", title: "Manba qisqichlaridagi kuchlanishning tok kuchiga bog‘liqligi",
        cond: { fields: [{ k: "src", label: "Tok manbai", opts: Object.entries(SRC).map(([k, v]) => [k, v.name]) }], sync: () => ({ src: st.src }), init: { src: "b45" } },
        head: ["I, A", "U, V", "ε − U, V", "Tekshiruv"], cols: [{ k: "I", kind: "num" }, { k: "U", kind: "num" }], outs: ["d"],
        blank: () => ({ I: "", U: "" }), rows: 5, max: 12, narrow: true,
        parse: (r) => ({ I: num(r.I), U: num(r.U) }), check: (r) => (!(r.I >= 0) || !(r.U > 0) ? { ok: false, err: "I ≥ 0, U > 0" } : { ok: true }),
        analyze, out: (A, j, r) => ({ d: Number.isFinite(A.emf) ? fmt(A.emf - r.U, 2) : "—" }),
        summary: (A) => (A.f ? [["EYuK ε", `${fmt(A.emf, 2)} V`, `± ${fmt(Math.max(A.f.sa, 0.005), 2)} V`], ["Ichki qarshilik r", `${fmt(A.r, 2)} Ω`, `± ${fmt(Math.max(A.f.sb, 0.005), 2)} Ω`], ["Qisqa tutashuv toki", `${fmt(A.Isc, 2)} A`, "ε / r"]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
