// ==========================================================================
// Laboratoriya ishi: Yarimo‘tkazgichli diodning volt-amper xarakteristikasi (simulations/lab-diod.html). Darslik: 10-sinf §46.
// Qurilma: rostlanadigan manba (dastak sahnada aylantiriladi), cheklovchi rezistor 100 Ω, raqamli milliampermetr
// (teskari ulashda mikroampermetr) va diodga parallel raqamli voltmetr. Diod platada — to‘g‘ri yoki teskari ulanadi.
// Fizika: semi-physics.js (Shokli tenglamasi, ketma-ket qarshilik, teskari tok va sizish o‘tkazuvchanligi).
// ==========================================================================

import { createLab, docKit, fitLine, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, sx, userText } from "./labreport.js";
import { DIODES, diodeCircuit } from "./semi-physics.js";
import { noise } from "./labkit.js";
import { supply, multimeter, resistor, wire, label, hint, F, inBox, near, dot, rr } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-diod.html", label: "oliyfizika.uz/simulations/lab-diod.html" };
const KINDS = { si: DIODES.si, ge: DIODES.ge, red: DIODES.red };
const R_LIM = 100, R_MA = 1.2, E_F = 5, E_R = 20;
const st = { d: "si", rev: false, f: 0.3 };
const geo = {};
const E = () => st.f * (st.rev ? E_R : E_F);
const dI = (v) => (st.rev && v < 1 ? 3 : 2); // mikroampermetr: 1 μA dan kichikda 0,001 μA aniqlik

function meas() {
  const d = KINDS[st.d], e = E();
  const s = diodeCircuit(d, st.rev ? -e : e, R_LIM + R_MA);
  const U = Math.abs(s.U), I = Math.abs(s.I);
  // raqamli asboblar: oxirgi xonada ±1 birlik
  const Ud = Math.round(U * (st.rev ? 100 : 1000) + noise(e * 37, st.rev ? 1 : 2)) / (st.rev ? 100 : 1000);
  const q = st.rev ? 1e9 : 1e5, Id = Math.max(0, Math.round(I * q + noise(e * 53, st.rev ? 1 : 3)) / (st.rev ? 1e3 : 100)); // mA: 0,01; μA: 0,001
  return { U, I, Ud, Id, over: !st.rev && I * 1e3 > 60, ledBreak: st.rev && d.led && e > 5 };
}

/* ------------------------------------------------------------------ Sahna */
function diodeBody(ctx, c, x0, x1, y, rev, d, glow) {
  sLead(ctx, x0, y, x0 + 22, y); sLead(ctx, x1 - 22, y, x1, y);
  const cx = (x0 + x1) / 2;
  if (d.led) {
    const [r, g, b] = d.led;
    if (glow > 0.01) { const gr = ctx.createRadialGradient(cx, y - 6, 2, cx, y - 6, 46); gr.addColorStop(0, `rgba(${r},${g},${b},${0.8 * glow})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, y - 6, 46, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(${r},${g},${b},${0.45 + 0.5 * glow})`; ctx.beginPath(); ctx.ellipse(cx, y - 2, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgb(${r * 0.6},${g * 0.6},${b * 0.6})`; ctx.lineWidth = 1; ctx.stroke();
  } else {
    ctx.fillStyle = st.d === "ge" ? "#a8a29e" : "#1f2937"; rr(ctx, cx - 22, y - 8, 44, 16, 5); ctx.fill();
    ctx.fillStyle = "#e5e7eb"; ctx.fillRect(rev ? cx - 18 : cx + 12, y - 8, 5, 16); // katod halqasi
  }
  // sxema belgisi ustida
  const sy = y - 30, dir = rev ? -1 : 1;
  ctx.strokeStyle = c.text2; ctx.fillStyle = c.text2; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - 9 * dir, sy - 7); ctx.lineTo(cx - 9 * dir, sy + 7); ctx.lineTo(cx + 5 * dir, sy); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 6 * dir, sy - 7); ctx.lineTo(cx + 6 * dir, sy + 7); ctx.stroke();
}
function sLead(ctx, x0, y0, x1, y1) { ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function probe(ctx, a, b, col) { ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.bezierCurveTo(a[0], a[1] + 50, b[0], b[1] - 60, b[0], b[1] - 4); ctx.stroke(); dot(ctx, b[0], b[1], 3.5, col); }

function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, m = meas(), d = KINDS[st.d];
  // joylashuv: keng — bir qatorda; tor — manba va voltmetr tepada, milliampermetr chapda, diod platasi o‘ngda
  const L = narrow
    ? { P: [8, 8, 112, 150], R: [160, 340, 64], A: [8, 190, 116, 122], V: [250, 8, 142, 124], B: [252, 388, 250], hk: [124, 96] }
    : { P: [12, 12, 130, 160], R: [180, 230, 76], A: [290, 190, 140, 134], V: [470, 12, 150, 134], B: [470, 600, 252], hk: [12, 190] };
  const P = supply(ctx, c, ...L.P, { value: fmt(E(), 2).padStart(5, " "), title: st.rev ? "MANBA 0…20 V" : "MANBA 0…5 V", frac: st.f });
  geo.knob = P.knob;
  const R = resistor(ctx, c, ...L.R, "100 Ω");
  const [mx, my, mwid, mh] = L.A;
  const mA = multimeter(ctx, c, mx, my, mwid, mh, { value: m.over ? "OL" : fmt(m.Id, dI(m.Id)), unit: st.rev ? "μA" : "mA", mode: st.rev ? "DC μA" : "DC mA", title: st.rev ? "MIKROAMPERMETR" : "MILLIAMPERMETR", inLabel: "mA" });
  const V = multimeter(ctx, c, ...L.V, { value: fmt(m.Ud, st.rev ? 2 : 3), unit: "V", mode: "DC V", title: "VOLTMETR", inLabel: "V" });
  // diod platasi
  const [bx0, bx1, by] = L.B;
  ctx.fillStyle = c.dark ? "#14532d" : "#166534"; rr(ctx, bx0 - 6, by - 52, bx1 - bx0 + 12, 72, 8); ctx.fill();
  const glow = d.led && !st.rev ? Math.min(1, (m.I * 1e3) / 15) : 0;
  diodeBody(ctx, c, bx0, bx1, by, st.rev, d, glow);
  const dl = [bx0, by], dr = [bx1, by];
  dot(ctx, dl[0], dl[1], 4.5, "#cbd5e1"); dot(ctx, dr[0], dr[1], 4.5, "#cbd5e1");
  label(ctx, d.short, (bx0 + bx1) / 2, by + 14, "#dcfce7", F(9, 700));
  geo.board = { x0: bx0 - 6, x1: bx1 + 6, y0: by - 52, y1: by + 20 };
  const cu = "#b45309", B = h - 6;
  if (narrow) {
    // manba «+» → mA → cheklovchi rezistor → diod → manba «−»
    wire(ctx, [P.plus, [P.plus[0], 170], [136, 170], [136, my + mh + 12], [mA.inp[0], my + mh + 12], mA.inp], cu);
    wire(ctx, [mA.com, [mA.com[0], R.a[1]], R.a], cu);
    wire(ctx, [R.b, [dl[0], R.b[1]], dl], cu);
    wire(ctx, [dr, [w - 4, dr[1]], [w - 4, B], [4, B], [4, 172], [P.minus[0], 172], P.minus], cu);
  } else {
    wire(ctx, [P.plus, [P.plus[0], P.plus[1] + 22], [R.a[0] - 14, P.plus[1] + 22], [R.a[0] - 14, R.a[1]], R.a], cu);
    wire(ctx, [R.b, [R.b[0] + 8, R.b[1]], [R.b[0] + 8, my - 12], [mx + mwid + 14, my - 12], [mx + mwid + 14, B - 14], [mA.inp[0], B - 14], mA.inp], cu);
    wire(ctx, [mA.com, [mA.com[0], B - 6], [mx + mwid + 26, B - 6], [mx + mwid + 26, dl[1]], dl], cu);
    wire(ctx, [dr, [Math.min(w - 10, dr[0] + 22), dr[1]], [Math.min(w - 10, dr[0] + 22), B], [6, B], [6, P.minus[1] + 22], [P.minus[0], P.minus[1] + 22], P.minus], cu);
  }
  // voltmetr shuplari: qizil — chap uchga (manbaning «+» tomoni), qora — o‘ng uchga
  probe(ctx, V.inp, [dl[0] + 10, dl[1] - 4], "#dc2626"); probe(ctx, V.com, [dr[0] - 10, dr[1] - 4], "#111827");
  hint(ctx, c, narrow ? "← dastakni buring" : "dastakni aylantiring", ...L.hk);
  hint(ctx, c, narrow ? "platani bosing: burish" : "platani bosing — diodni teskari ulash", (bx0 + bx1) / 2, by + 34, "center");
  if (m.over) hint(ctx, c, "Tok juda katta! Kuchlanishni kamaytiring", narrow ? 130 : mx, narrow ? 150 : my - 26);
  if (m.ledBreak) hint(ctx, c, narrow ? "LED: teskari U ≤ 5 V" : "LED ga 5 V dan katta teskari kuchlanish berilmaydi", narrow ? 200 : bx0 - 60, by - 64);
}

/* ------------------------------------------------------------------ Hisob */
function anF(rows) {
  const rs = rows.slice().sort((a, b) => a.U - b.U).map((r) => ({ ...r, Rs: r.I > 0 ? (r.U / r.I) * 1000 : NaN }));
  rs.forEach((r, i) => { const p = rs[i - 1]; r.Rd = p && r.I > p.I ? ((r.U - p.U) / (r.I - p.I)) * 1000 : NaN; });
  // ochilish kuchlanishi: tikka qismdagi (I ≥ 0,3·I_max) nuqtalar bo‘yicha I(U) to‘g‘ri chizig‘ining U o‘qi bilan kesishishi
  const Imax = Math.max(...rs.map((r) => r.I)), steep = rs.filter((r) => r.I >= 0.3 * Imax), f = steep.length >= 2 ? fitLine(steep.map((r) => [r.U, r.I])) : null;
  return { rows: rs, Uth: f && f.b > 0 ? -f.a / f.b : NaN, fit: f, Imax, ok: rs.length >= 5 && Imax >= 5 };
}
function anR(rows) {
  const rs = rows.slice().sort((a, b) => a.U - b.U).map((r) => ({ ...r, R: r.I > 0 ? r.U / r.I : NaN }));
  return { rows: rs, ok: rs.length >= 3 };
}
function build(nb, res) {
  const A = res.t1.A, B = res.t2?.ok ? res.t2.A : null, d = KINDS[res.t1.cond.d] || KINDS.si, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Yarimo‘tkazgichli diodning to‘g‘ri va teskari yo‘nalishdagi volt-amper xarakteristikasini (VAX) o‘lchash.", "Diodning bir tomonlama o‘tkazuvchanligini tushuntirish; ochilish kuchlanishi va dinamik qarshilikni aniqlash."]);
  D.S("Qisqacha nazariya");
  D.p("$p$–$n$ o‘tishga to‘g‘ri yo‘nalishda ($p$ sohaga «+») kuchlanish berilganda potensial to‘siq pasayadi va tok kuchlanish bilan eksponensial o‘sadi; teskari yo‘nalishda to‘siq ortadi va faqat juda kichik (asosiy bo‘lmagan zaryad tashuvchilar) toki o‘tadi:");
  D.eq("I = I_0\\left(e^{\\,eU/(nkT)} - 1\\right)", 1);
  D.p("Diodning statik qarshiligi $R = U/I$, dinamik (differensial) qarshiligi esa $r_d = \\Delta U/\\Delta I$. Ochilish kuchlanishi — VAX ning tik qismini $U$ o‘qigacha davom ettirganda hosil bo‘ladigan kesishish nuqtasi.");
  D.S("Jihozlar");
  D.list([`O‘rganilgan diod: ${d.name}.`, "Rostlanadigan manba ($0\\ldots 5$ V va teskari ulash uchun $0\\ldots 20$ V), cheklovchi rezistor $100$ Ω.", "Raqamli milliampermetr/mikroampermetr va raqamli voltmetr (diodga parallel)."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Diod to‘g‘ri yo‘nalishda ulandi. Manba kuchlanishi asta oshirilib, diod uchlaridagi kuchlanish $U$ va tok $I$ yozildi (1-jadval).", "Diod teskari ulandi, ampermetr mikroamper rejimiga o‘tkazildi va teskari tok o‘lchandi (2-jadval).", "VAX grafigi chizildi, ochilish kuchlanishi va dinamik qarshilik topildi."], true);
  D.S("To‘g‘ri yo‘nalish");
  D.table(`To‘g‘ri yo‘nalishdagi VAX (${d.short})`, ["№", "$U$, V", "$I$, mA", "$R = U/I$, Ω", "$r_d$, Ω", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.U, 3)}$`, `$${fx(r.I, 2)}$`, Number.isFinite(r.Rs) ? `$${sx(r.Rs, 3)}$` : "--", Number.isFinite(r.Rd) ? `$${sx(r.Rd, 3)}$` : "--", res.t1.flags[i] ? "$\\checkmark$" : "--"]),
    "$r_d$ — oldingi qator bilan: $r_d = \\Delta U/\\Delta I$.");
  const umax = Math.max(...A.rows.map((r) => r.U)) * 1.1;
  D.fig("vaxf", "Diodning to‘g‘ri yo‘nalishdagi volt-amper xarakteristikasi. Uzuq chiziq — tik qismning davomi (ochilish kuchlanishi).", { xmin: 0, xmax: umax, ymin: 0, ymax: A.Imax * 1.15, legendPos: "north west", xlab: "U, V", ylab: "I, mA",
    series: [{ kind: "line", data: A.rows.map((r) => [r.U, r.I]), color: "#94a3b8" }, { kind: "pts", data: A.rows.map((r) => [r.U, r.I]), color: "#c2410c", label: "tajriba" },
      ...(A.fit ? [{ kind: "line", fn: (x) => A.fit.a + A.fit.b * x, color: "#1d4ed8", dash: "5 4", label: `ochilish kuchlanishi ≈ ${fmt(A.Uth, 2)} V` }] : [])] });
  const top = A.rows.at(-1);
  D.p("**Hisoblash:**");
  D.eq([`U_{\\text{och}} \\approx ${fx(A.Uth, 2)}\\ \\text{V};\\qquad R(I = ${fx(top.I, 1)}\\ \\text{mA}) = \\frac{${fx(top.U, 3)}}{${fx(top.I / 1000, 4)}} = ${sx(top.Rs, 3)}\\ \\Omega;\\qquad r_d = \\frac{\\Delta U}{\\Delta I} = ${sx(top.Rd, 3)}\\ \\Omega`]);
  const box = [`• To‘g‘ri yo‘nalishda ochilish kuchlanishi $\\approx ${fx(A.Uth, 2)}$ V; undan keyin tok keskin ortadi (dinamik qarshilik $\\approx ${sx(top.Rd, 2)}$ Ω).`];
  if (B) {
    D.S("Teskari yo‘nalish");
    D.table(`Teskari yo‘nalishdagi tok (${d.short})`, ["№", "$U_{\\text{tesk}}$, V", "$I_{\\text{tesk}}$, μA", "$R = U/I$, MΩ", "Tekshiruv"],
      B.rows.map((r, i) => [String(i + 1), `$${fx(r.U, 2)}$`, `$${fx(r.I, 3)}$`, Number.isFinite(r.R) ? `$${sx(r.R, 3)}$` : "$\\infty$", res.t2.flags[i] ? "$\\checkmark$" : "--"]));
    const Ir = Math.max(...B.rows.map((r) => r.I));
    D.fig("vaxr", "Teskari yo‘nalishdagi tok (mikroamperlarda).", { xmin: 0, xmax: Math.max(...B.rows.map((r) => r.U)) * 1.1, ymin: 0, ymax: Math.max(Ir * 1.3, 0.005), legendPos: "north west", xlab: "U_tesk, V", ylab: "I_tesk, μA",
      series: [{ kind: "line", data: B.rows.map((r) => [r.U, r.I]), color: "#94a3b8" }, { kind: "pts", data: B.rows.map((r) => [r.U, r.I]), color: "#7c3aed", label: "tajriba" }] });
    const Rmin = Math.min(...B.rows.filter((r) => Number.isFinite(r.R)).map((r) => r.R));
    box.push(`• Teskari tok $\\le ${fx(Ir, 3)}$ μA — to‘g‘ri tokdan ${Ir > 0 ? `$${sx((A.Imax * 1000) / Ir, 2)}$ marta` : "minglab marta"} kichik; teskari qarshilik ${Number.isFinite(Rmin) ? `$\\ge ${sx(Rmin, 2)}$ MΩ` : "juda katta"}.`);
  }
  box.push("• Diod tokni asosan bir yo‘nalishda o‘tkazadi — bir tomonlama o‘tkazuvchanlik.");
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Yarimo‘tkazgichli diodning volt-amper xarakteristikasini o‘rganish", titlePlain: "Laboratoriya ishi. Diod VAXi", author: nb.f.name, sub: `${d.name}: to‘g‘ri va teskari yo‘nalish`, meta: docMeta(nb, userText), blocks: D.X };
}

let drag0 = null;
createLab({
  key: "diode", fileBase: "Diod-VAX-lab", docLabel: "Virtual laboratoriya ishi · 10-sinf", site: SITE,
  modes: [{ id: "f", label: "1. To‘g‘ri ulash", hint: "Kuchlanishni 0 dan asta oshiring — tok qachon keskin o‘sadi?" }, { id: "r", label: "2. Teskari ulash", hint: "Teskari tok mikroamperlarda o‘lchanadi" }],
  onMode(m) { st.rev = m === "r"; st.f = 0; },
  vh: (n) => (n ? 384 : 350),
  draw,
  down(x, y, lab) {
    if (near(x, y, geo.knob, geo.knob[2] + 6)) { drag0 = { y, f: st.f }; return "knob"; }
    if (inBox(x, y, geo.board)) { lab.setMode(st.rev ? "f" : "r"); return true; }
    return null;
  },
  move(h, x, y) { st.f = Math.min(1, Math.max(0, drag0.f - (y - drag0.y) / 160)); },
  cursor: (x, y) => (near(x, y, geo.knob, geo.knob?.[2] + 6) ? "ns-resize" : inBox(x, y, geo.board) ? "pointer" : ""),
  controls: [
    { type: "seg", label: "Diod", opts: Object.entries(KINDS).map(([k, v]) => [k, v.short]), get: () => st.d, set: (v) => { st.d = v; st.f = 0; } },
    { type: "range", label: "Manba kuchlanishi", min: 0, max: 1, step: 0.002, get: () => st.f, set: (v) => { st.f = v; }, fmt: (v) => `${fmt(v * (st.rev ? E_R : E_F), 2)} V` },
    { type: "note", text: "Sahnada: manba dastagini yuqoriga/pastga tortib aylantiring; diod platasini bosib uni teskari ulang." },
  ],
  readouts() {
    const m = meas(), d = KINDS[st.d];
    return [["Voltmetr (diodda)", `${fmt(m.Ud, st.rev ? 2 : 3)}<small>V</small>`, st.rev ? "teskari kuchlanish" : "to‘g‘ri kuchlanish", "blue"],
      [st.rev ? "Mikroampermetr" : "Milliampermetr", m.over ? "OL" : `${fmt(m.Id, dI(m.Id))}<small>${st.rev ? "μA" : "mA"}</small>`, st.rev ? "teskari tok" : "to‘g‘ri tok", "orange"],
      ["Diod", d.short, st.rev ? "teskari ulangan" : "to‘g‘ri ulangan"], ["Manba", `${fmt(E(), 2)}<small>V</small>`, `cheklovchi rezistor ${R_LIM} Ω`]];
  },
  record(lab) {
    const m = meas();
    if (m.over) return { err: "Milliampermetr shkalasidan chiqdi — kuchlanishni kamaytiring." };
    if (m.ledBreak) return { err: "LED uchun teskari kuchlanish 5 V dan oshmasin." };
    const v = { U: fmt(m.Ud, st.rev ? 2 : 3), I: fmt(m.Id, dI(m.Id)) };
    return { t: lab.mode === "r" ? "t2" : "t1", v, text: `${KINDS[st.d].short}, ${st.rev ? "teskari" : "to‘g‘ri"}: U = ${v.U} V, I = ${v.I} ${st.rev ? "μA" : "mA"}` };
  },
  explain() { const m = meas(); return st.rev ? `Teskari ulashda p–n o‘tishdagi to‘siq kattalashadi: ${fmt(m.Ud, 2)} V da tok bor-yo‘g‘i ${fmt(m.Id, 3)} μA.` : m.I * 1e3 < 0.5 ? "Kuchlanish hali ochilish kuchlanishidan kichik — tok deyarli yo‘q." : `Diod ochiq: kuchlanish ozgina ortsa ham tok keskin o‘sadi (${fmt(m.Id, 2)} mA). Ortiqcha kuchlanish cheklovchi rezistorda tushadi.`; },
  steps: ["1-topshiriq: diodni tanlang. Manba dastagini asta burab, diod kuchlanishini 0 dan oshiring; har 0,05–0,1 V da (tok tez o‘sa boshlagach — tez-tez) U va I ni <b>Qaydga yozing</b>. Tok 50 mA dan oshmasin.", "2-topshiriq: platani bosib diodni teskari ulang. Kuchlanishni 0…20 V oralig‘ida o‘zgartirib, teskari tokni (μA) yozing.", "Qaydlarni jadvallarga o‘tkazing: VAX grafigi, ochilish kuchlanishi va qarshiliklar avtomatik.", "Ge va Si diodlarni (yoki LED ni) solishtirish uchun jadval shartini o‘zgartirib takrorlang. Xulosa va PDF."],
  formulas: ["Diod tenglamasi: <span class=\"sim-math\">I = I₀(e<sup>eU/nkT</sup> − 1)</span>", "Statik qarshilik: <span class=\"sim-math\">R = U / I</span>", "Dinamik qarshilik: <span class=\"sim-math\">r<sub>d</sub> = ΔU / ΔI</span>", "Ochilish kuchlanishi: kremniy ≈ 0,6–0,8 V, germaniy ≈ 0,2–0,4 V, qizil LED ≈ 1,8 V"],
  note: "Germaniy diodning teskari toki kremniynikidan minglab marta katta — u temperaturaga ham juda sezgir.",
  notebook: {
    intro: "Jadval sharti — qaysi diod. 1-jadval majburiy (kamida 5 nuqta, tok kamida 5 mA gacha), 2-jadval — teskari tok.",
    conclusionPh: "Diod qaysi yo‘nalishda tok o‘tkazadi? Ochilish kuchlanishi, dinamik qarshilik, teskari tok qancha chiqdi?",
    hint: "Javob bering: 1) VAX ning to‘g‘ri tarmog‘i qanday shaklda? 2) Ochilish kuchlanishi qancha? 3) To‘g‘ri va teskari toklar necha marta farq qiladi? 4) Diod qayerda ishlatiladi (to‘g‘rilagich)?",
    minTables: 1,
    tables: [
      { key: "t1", req: true, okLabel: "To‘g‘ri VAX", need: "1-jadvalda kamida 5 nuqta (tok ≥ 5 mA gacha)", title: "1-topshiriq. To‘g‘ri yo‘nalish",
        cond: { fields: [{ k: "d", label: "Diod", opts: Object.entries(KINDS).map(([k, v]) => [k, v.short]) }], sync: () => ({ d: st.d }), init: { d: "si" } },
        head: ["U, V", "I, mA", "R = U/I, Ω", "Tekshiruv"], cols: [{ k: "U", kind: "num" }, { k: "I", kind: "num" }], outs: ["R"],
        blank: () => ({ U: "", I: "" }), rows: 6, max: 16, narrow: true,
        parse: (r) => ({ U: num(r.U), I: num(r.I) }), check: (r) => (!(r.U >= 0) || !(r.I >= 0) ? { ok: false, err: "U, I ≥ 0" } : { ok: true }),
        analyze: anF, out: (A, j, r) => ({ R: r.I > 0 ? fmt((r.U / r.I) * 1000, 1) : "∞" }),
        summary: (A) => (A.rows.length >= 2 ? [["Ochilish kuchlanishi", Number.isFinite(A.Uth) ? `${fmt(A.Uth, 2)} V` : "—", "tik qism davomi"], ["Eng katta tok", `${fmt(A.Imax, 2)} mA`, A.Imax >= 5 ? "" : "kamida 5 mA gacha o‘lchang"]] : null),
        ok: (A) => A.ok },
      { key: "t2", okLabel: "Teskari tok", need: "2-jadvalda kamida 3 nuqta", title: "2-topshiriq. Teskari yo‘nalish",
        head: ["U, V", "I, μA", "R = U/I, MΩ", "Tekshiruv"], cols: [{ k: "U", kind: "num" }, { k: "I", kind: "num" }], outs: ["R"],
        blank: () => ({ U: "", I: "" }), rows: 3, max: 10, narrow: true,
        parse: (r) => ({ U: num(r.U), I: num(r.I) }), check: (r) => (!(r.U >= 0) || !(r.I >= 0) ? { ok: false, err: "U, I ≥ 0" } : { ok: true }),
        analyze: anR, out: (A, j, r) => ({ R: r.I > 0 ? fmt(r.U / r.I, 2) : "∞" }),
        summary: (A) => (A.rows.length ? [["Eng katta teskari tok", `${fmt(Math.max(...A.rows.map((r) => r.I)), 3)} μA`, ""]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
