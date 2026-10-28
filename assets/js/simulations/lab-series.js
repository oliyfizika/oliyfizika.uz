// ==========================================================================
// Laboratoriya ishi: O‘tkazgichlarni ketma-ket va parallel ulash (simulations/lab-ketma-ket-parallel.html). Darslik: 8-sinf §24.
// Qurilma: tok manbai, kalit, ikki rezistor (R₁ = 8 Ω, R₂ = 12 Ω — haqiqiy qiymati 1–2 % farq qiladi), ampermetr va voltmetr.
// Sahnada sxema: ampermetrni zanjirning turli joyiga (ketma-ket: R₁ dan oldin, orasida, keyin; parallel: umumiy, 1- va 2-tarmoq),
// voltmetrni R₁, R₂ yoki ikkalasiga (umumiy) ulash mumkin. Tepada — haqiqiy strelkali asboblar ko‘rsatkichi.
// ==========================================================================

import { createLab, docKit, meanErr, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { seriesR, parallelR } from "./circuit-physics.js";
import { meter, label, hint, F, inBox, sLine, sRes, sCell, sKey, sMeter, sNode, dot } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-ketma-ket-parallel.html", label: "oliyfizika.uz/simulations/lab-ketma-ket-parallel.html" };
const R1 = { nom: 8, R: 8.11 }, R2 = { nom: 12, R: 11.86 };
const SRC = { s3: { name: "3 V", emf: 3.0, r: 0.4 }, s45: { name: "4,5 V", emf: 4.5, r: 0.5 } };
const A_MAX = 1, A_DIV = 0.02, V_MAX = 6, V_DIV = 0.1, K_A = 1.01, K_V = 0.993;
const st = { src: "s45", on: false, aS: "a1", vS: "v1", aP: "a", vP: "v" };
const geo = {};
const readMeter = (v, div) => Math.round(v / (div / 2)) * (div / 2);

/** Zanjir: ketma-ket yoki parallel. Qaytaradi tok va kuchlanishlar (ideal asboblar; voltmetr R_V ≫ R). */
function solveCirc(mode) {
  const S = SRC[st.src];
  if (!st.on) return { I: 0, I1: 0, I2: 0, U: 0, U1: 0, U2: 0 };
  if (mode === "s") { const I = S.emf / (S.r + seriesR(R1.R, R2.R)); return { I, I1: I, I2: I, U1: I * R1.R, U2: I * R2.R, U: I * (R1.R + R2.R) }; }
  const Rp = parallelR(R1.R, R2.R), I = S.emf / (S.r + Rp), U = I * Rp;
  return { I, I1: U / R1.R, I2: U / R2.R, U, U1: U, U2: U };
}
function inst(mode) {
  const s = solveCirc(mode), a = mode === "s" ? s.I : st.aP === "a" ? s.I : st.aP === "p1" ? s.I1 : s.I2;
  const vk = mode === "s" ? st.vS : st.vP, v = mode === "s" ? (vk === "v1" ? s.U1 : vk === "v2" ? s.U2 : s.U) : s.U;
  return { Iraw: a * K_A, Uraw: v * K_V, I: readMeter(a * K_A, A_DIV), U: readMeter(v * K_V, V_DIV) };
}
const A_NAMES = { a1: "R₁ dan oldin", a2: "R₁ va R₂ orasida", a3: "R₂ dan keyin", a: "umumiy (tarmoqlanmagan qism)", p1: "1-tarmoq (R₁)", p2: "2-tarmoq (R₂)" };
const V_NAMES = { v1: "R₁ uchlarida", v2: "R₂ uchlarida", v12: "ikkalasining uchlarida (umumiy)", v: "tarmoqlanish nuqtalarida (umumiy)", pv1: "R₁ uchlarida", pv2: "R₂ uchlarida" };

/* ------------------------------------------------------------------ Sahna */
function draw(ctx, S, lab) {
  const { w, h, colors: c, narrow } = S, mode = lab.mode, r = inst(mode);
  const mw = narrow ? 180 : 200, mh = narrow ? 130 : 140, mx = narrow ? 10 : 70, vx = narrow ? 210 : 410;
  meter(ctx, c, mx, 8, mw, mh, { sym: "A", max: A_MAX, major: 5, minor: 10, value: r.Iraw, cls: "1,5", title: "AMPERMETR" });
  meter(ctx, c, vx, 8, mw, mh, { sym: "V", max: V_MAX, major: 6, minor: 10, value: r.Uraw, cls: "1,5", title: "VOLTMETR" });
  const ty = mh + 16;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.06)" : "#fbfcfe"; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(4, ty, w - 8, h - ty - 4, 12); ctx.fill(); ctx.stroke();
  const L = narrow ? 30 : 60, R = w - (narrow ? 30 : 60), ca = "#c2410c", cv = "#2563eb";
  geo.spots = [];
  const spot = (x, y, kind, id, on) => { geo.spots.push({ x0: x - 15, x1: x + 15, y0: y - 15, y1: y + 15, kind, id }); if (!on) { ctx.strokeStyle = c.border; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); } else sMeter(ctx, c, x, y, kind === "A" ? "A" : "V", kind === "A" ? ca : cv); };
  if (mode === "s") {
    const yt = ty + (narrow ? 60 : 44), yb = h - (narrow ? 46 : 40), xr1 = [L + (R - L) * 0.2, L + (R - L) * 0.42], xr2 = [L + (R - L) * 0.58, L + (R - L) * 0.8];
    sLine(ctx, c, [[L, yb], [L, yt], [R, yt], [R, yb], [L, yb]]);
    geo.r1 = sRes(ctx, c, xr1[0], yt, xr1[1], yt, "R₁", st.vS === "v1" || st.vS === "v12");
    geo.r2 = sRes(ctx, c, xr2[0], yt, xr2[1], yt, "R₂", st.vS === "v2" || st.vS === "v12");
    sCell(ctx, c, L + (R - L) * 0.3, yb, false, SRC[st.src].name);
    geo.key = sKey(ctx, c, L + (R - L) * 0.6, L + (R - L) * 0.6 + 40, yb, st.on);
    const ax = { a1: L + (R - L) * 0.08, a2: (xr1[1] + xr2[0]) / 2, a3: L + (R - L) * 0.92 };
    Object.entries(ax).forEach(([k, x]) => spot(x, yt, "A", k, st.aS === k));
    // voltmetr: tanlangan rezistor uchlariga
    const vEnds = st.vS === "v1" ? xr1 : st.vS === "v2" ? xr2 : [xr1[0], xr2[1]], vy = yt + (narrow ? 50 : 46), vxm = (vEnds[0] + vEnds[1]) / 2;
    ctx.strokeStyle = cv; ctx.lineWidth = 1.6; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(vEnds[0] - 6, yt); ctx.lineTo(vEnds[0] - 6, vy); ctx.lineTo(vxm - 12, vy); ctx.moveTo(vxm + 12, vy); ctx.lineTo(vEnds[1] + 6, vy); ctx.lineTo(vEnds[1] + 6, yt); ctx.stroke(); ctx.setLineDash([]);
    sNode(ctx, c, vEnds[0] - 6, yt); sNode(ctx, c, vEnds[1] + 6, yt); sMeter(ctx, c, vxm, vy, "V", cv);
    geo.vAll = { x0: xr1[1] + 4, x1: xr2[0] - 4, y0: yt - 34, y1: yt - 14 };
    ctx.fillStyle = c.bg2; ctx.beginPath(); ctx.roundRect(geo.vAll.x0, geo.vAll.y0, geo.vAll.x1 - geo.vAll.x0, 20, 6); ctx.fill();
    label(ctx, "V: umumiy", (geo.vAll.x0 + geo.vAll.x1) / 2, geo.vAll.y0 + 10, st.vS === "v12" ? cv : c.text3, F(narrow ? 9 : 10, 700));
    hint(ctx, c, narrow ? "doiraga bosing — A; R ga — V" : "bo‘sh doirani bosing — ampermetr o‘sha joyga; rezistorni bosing — voltmetr", L, yb + 24);
  } else {
    const y1 = ty + (narrow ? 50 : 36), y2 = ty + (narrow ? 130 : 100), ym = (y1 + y2) / 2, yb = h - (narrow ? 40 : 30), M = L + (R - L) * 0.2, N = L + (R - L) * 0.82;
    sLine(ctx, c, [[M, ym], [L, ym], [L, yb], [R, yb], [R, ym], [N, ym]]);
    sLine(ctx, c, [[M, y1], [M, y2]]); sLine(ctx, c, [[N, y1], [N, y2]]);
    const xr = [L + (R - L) * 0.32, L + (R - L) * 0.56];
    sLine(ctx, c, [[M, y1], [N, y1]]); sLine(ctx, c, [[M, y2], [N, y2]]);
    geo.r1 = sRes(ctx, c, xr[0], y1, xr[1], y1, "R₁", st.vP === "pv1");
    geo.r2 = sRes(ctx, c, xr[0], y2, xr[1], y2, "R₂", st.vP === "pv2");
    sNode(ctx, c, M, ym); sNode(ctx, c, N, ym); label(ctx, "M", M - 12, ym - 10, c.text2, F(11, 700)); label(ctx, "N", N + 12, ym - 10, c.text2, F(11, 700));
    sCell(ctx, c, L + (R - L) * 0.35, yb, false, SRC[st.src].name);
    geo.key = sKey(ctx, c, L + (R - L) * 0.6, L + (R - L) * 0.6 + 40, yb, st.on);
    const xa = L + (R - L) * 0.7;
    spot(L, (ym + yb) / 2, "A", "a", st.aP === "a"); spot(xa, y1, "A", "p1", st.aP === "p1"); spot(xa, y2, "A", "p2", st.aP === "p2");
    // voltmetr
    const vy = st.vP === "pv2" ? y2 + 36 : st.vP === "pv1" ? y1 + 30 : ym, ends = st.vP === "v" ? [M, N] : xr;
    const vyy = st.vP === "v" ? (y2 + yb) / 2 + 4 : vy, vxm = st.vP === "v" ? (M + N) / 2 - 40 : (ends[0] + ends[1]) / 2, yA = st.vP === "pv2" ? y2 : st.vP === "pv1" ? y1 : ym;
    ctx.strokeStyle = cv; ctx.lineWidth = 1.6; ctx.setLineDash([5, 3]); ctx.beginPath();
    const e0 = st.vP === "v" ? M : ends[0] - 6, e1 = st.vP === "v" ? N : ends[1] + 6;
    ctx.moveTo(e0, st.vP === "v" ? y2 : yA); ctx.lineTo(e0 + (st.vP === "v" ? 12 : 0), vyy); ctx.lineTo(vxm - 12, vyy); ctx.moveTo(vxm + 12, vyy); ctx.lineTo(e1 - (st.vP === "v" ? 12 : 0), vyy); ctx.lineTo(e1, st.vP === "v" ? y2 : yA); ctx.stroke(); ctx.setLineDash([]);
    sMeter(ctx, c, vxm, vyy, "V", cv);
    geo.vAll = { x0: N + 10, x1: N + 76, y0: ym + 14, y1: ym + 34 };
    ctx.fillStyle = c.bg2; ctx.beginPath(); ctx.roundRect(geo.vAll.x0, geo.vAll.y0, 66, 20, 6); ctx.fill();
    label(ctx, "V: MN", geo.vAll.x0 + 33, geo.vAll.y0 + 10, st.vP === "v" ? cv : c.text3, F(10, 700));
  }
  hint(ctx, c, st.on ? "K: uzish" : "kalitni bosing", geo.key.x1 + 4, geo.key.y0 + 12);
  // tok yo‘nalishi (yoniq bo‘lsa)
  if (st.on) dot(ctx, w - 18, ty + 14, 5, "#16a34a");
}

/* ------------------------------------------------------------------ Hisob */
function an1(rows) {
  const rs = rows.map((r) => ({ ...r, sumU: r.U1 + r.U2, R: r.U / r.I, Rs: (r.U1 + r.U2) / r.I, r1: r.U1 / r.I, r2: r.U2 / r.I }));
  return { rows: rs, ok: rs.length >= 1 };
}
function an2(rows) {
  const rs = rows.map((r) => ({ ...r, sumI: r.I1 + r.I2, R: r.U / r.I, r1: r.U / r.I1, r2: r.U / r.I2, Rp: parallelR(r.U / r.I1, r.U / r.I2) }));
  return { rows: rs, ok: rs.length >= 1 };
}

/* ------------------------------------------------------------------ Hisobot */
function build(nb, res) {
  const A = res.t1?.ok ? res.t1.A : null, B = res.t2?.ok ? res.t2.A : null, D = docKit(), box = [];
  D.S("Ishning maqsadi");
  D.list(["O‘tkazgichlarni ketma-ket va parallel ulashda tok kuchi va kuchlanish qanday taqsimlanishini tajribada o‘rganish.", "Umumiy qarshilik formulalarini tekshirish."]);
  D.S("Qisqacha nazariya");
  D.p("**Ketma-ket ulashda** barcha o‘tkazgichlardan bir xil tok o‘tadi, umumiy kuchlanish kuchlanishlar yig‘indisiga, umumiy qarshilik esa qarshiliklar yig‘indisiga teng:");
  D.eq("I = I_1 = I_2,\\qquad U = U_1 + U_2,\\qquad R = R_1 + R_2", 1);
  D.p("**Parallel ulashda** o‘tkazgichlar uchlaridagi kuchlanish bir xil, tarmoqlanmagan qismdagi tok tarmoqlardagi toklar yig‘indisiga teng:");
  D.eq("U = U_1 = U_2,\\qquad I = I_1 + I_2,\\qquad \\frac{1}{R} = \\frac{1}{R_1} + \\frac{1}{R_2}\\ \\Rightarrow\\ R = \\frac{R_1 R_2}{R_1 + R_2}", 2);
  D.S("Jihozlar");
  D.list([`Tok manbai (${SRC[st.src].name}), kalit, ulovchi simlar.`, `Rezistorlar: $R_1 = ${R1.nom}$ Ω, $R_2 = ${R2.nom}$ Ω (nominal).`, `Ampermetr $0\\ldots 1$ A (bo‘linma qiymati $${fx(A_DIV, 2)}$ A), voltmetr $0\\ldots 6$ V (bo‘linma qiymati $${fx(V_DIV, 1)}$ V).`]);
  D.S("Ishni bajarish tartibi");
  D.list(["Rezistorlar ketma-ket ulandi. Ampermetr zanjirning turli joylariga ulanib, tok kuchi o‘lchandi; voltmetr bilan $U_1$, $U_2$ va umumiy $U$ o‘lchandi (1-jadval).",
    "Rezistorlar parallel ulandi. Tarmoqlanmagan qismdagi $I$ va tarmoqlardagi $I_1$, $I_2$ toklar, tarmoqlanish nuqtalaridagi kuchlanish $U$ o‘lchandi (2-jadval).",
    "Natijalar formulalar (1) va (2) bilan solishtirildi."], true);
  if (A) {
    D.S("1-topshiriq: ketma-ket ulash");
    D.table("Ketma-ket ulashda o‘lchash natijalari", ["№", "$U_1$, V", "$U_2$, V", "$U$, V", "$I$, A", "$U_1 + U_2$, V", "$R = U/I$, Ω", "$R_1 + R_2$, Ω", "Tekshiruv"],
      A.rows.map((r, i) => [String(i + 1), `$${fx(r.U1, 2)}$`, `$${fx(r.U2, 2)}$`, `$${fx(r.U, 2)}$`, `$${fx(r.I, 2)}$`, `$${fx(r.sumU, 2)}$`, `$${fx(r.R, 1)}$`, `$${fx(r.Rs, 1)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
      "$R_1 + R_2$ ustunida qarshiliklar o‘lchangan kuchlanishlardan topildi: $R_1 = U_1/I$, $R_2 = U_2/I$.");
    const r = A.rows[0];
    D.p("**Hisoblash** (1-qator):");
    D.eq([`U_1 + U_2 = ${fx(r.U1, 2)} + ${fx(r.U2, 2)} = ${fx(r.sumU, 2)}\\ \\text{V}\\quad(U = ${fx(r.U, 2)}\\ \\text{V},\\ \\text{farq}\\ ${fx(pct(r.sumU, r.U), 1)}\\,\\%)`,
      `R = \\frac{U}{I} = \\frac{${fx(r.U, 2)}}{${fx(r.I, 2)}} = ${fx(r.R, 1)}\\ \\Omega;\\qquad R_1 + R_2 = \\frac{U_1}{I} + \\frac{U_2}{I} = ${fx(r.r1, 2)} + ${fx(r.r2, 2)} = ${fx(r.Rs, 1)}\\ \\Omega`]);
    box.push(`• Ketma-ket: $U_1 + U_2 = ${fx(r.sumU, 2)}$ V $\\approx U = ${fx(r.U, 2)}$ V; $R = ${fx(r.R, 1)}$ Ω $\\approx R_1 + R_2 = ${fx(r.Rs, 1)}$ Ω.`);
  }
  if (B) {
    D.S(`${A ? 2 : 1}-topshiriq: parallel ulash`);
    D.table("Parallel ulashda o‘lchash natijalari", ["№", "$U$, V", "$I_1$, A", "$I_2$, A", "$I$, A", "$I_1 + I_2$, A", "$R = U/I$, Ω", "$\\frac{R_1R_2}{R_1+R_2}$, Ω", "Tekshiruv"],
      B.rows.map((r, i) => [String(i + 1), `$${fx(r.U, 2)}$`, `$${fx(r.I1, 2)}$`, `$${fx(r.I2, 2)}$`, `$${fx(r.I, 2)}$`, `$${fx(r.sumI, 2)}$`, `$${fx(r.R, 2)}$`, `$${fx(r.Rp, 2)}$`, res.t2.flags[i] ? "$\\checkmark$" : "--"]),
      "Oxirgi ustunda $R_1 = U/I_1$, $R_2 = U/I_2$ o‘lchangan qiymatlardan hisoblandi.");
    const r = B.rows[0];
    D.p("**Hisoblash** (1-qator):");
    D.eq([`I_1 + I_2 = ${fx(r.I1, 2)} + ${fx(r.I2, 2)} = ${fx(r.sumI, 2)}\\ \\text{A}\\quad(I = ${fx(r.I, 2)}\\ \\text{A},\\ \\text{farq}\\ ${fx(pct(r.sumI, r.I), 1)}\\,\\%)`,
      `R = \\frac{U}{I} = ${fx(r.R, 2)}\\ \\Omega;\\qquad \\frac{R_1 R_2}{R_1 + R_2} = \\frac{${fx(r.r1, 2)}\\cdot ${fx(r.r2, 2)}}{${fx(r.r1, 2)} + ${fx(r.r2, 2)}} = ${fx(r.Rp, 2)}\\ \\Omega`]);
    box.push(`• Parallel: $I_1 + I_2 = ${fx(r.sumI, 2)}$ A $\\approx I = ${fx(r.I, 2)}$ A; $R = ${fx(r.R, 2)}$ Ω — har bir rezistordan kichik.`);
  }
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. O‘tkazgichlarni ketma-ket va parallel ulashni o‘rganish", titlePlain: "Laboratoriya ishi. Ketma-ket va parallel ulash", author: nb.f.name, sub: "Tok kuchi va kuchlanishning taqsimlanishi, umumiy qarshilik", meta: docMeta(nb, userText), blocks: D.X };
}

/* ------------------------------------------------------------------ Laboratoriya */
const ok4 = (r, ks) => (ks.some((k) => !(r[k] > 0)) ? { ok: false, err: "barcha ustunlar to‘lsin" } : { ok: true });
createLab({
  key: "series", fileBase: "Ketma-ket-parallel-lab", docLabel: "Virtual laboratoriya ishi · 8-sinf", site: SITE,
  modes: [{ id: "s", label: "1. Ketma-ket ulash", hint: "Ampermetrni turli joyga, voltmetrni R₁, R₂ va umumiy uchlarga ulang" }, { id: "p", label: "2. Parallel ulash", hint: "Umumiy va tarmoqlardagi toklarni, MN kuchlanishni o‘lchang" }],
  vh: (n) => (n ? 420 : 340),
  draw,
  down(x, y, lab) {
    if (inBox(x, y, geo.key)) { st.on = !st.on; return true; }
    const sp = geo.spots?.find((b) => inBox(x, y, b)); if (sp) { if (lab.mode === "s") st.aS = sp.id; else st.aP = sp.id; return true; }
    if (inBox(x, y, geo.r1)) { if (lab.mode === "s") st.vS = "v1"; else st.vP = "pv1"; return true; }
    if (inBox(x, y, geo.r2)) { if (lab.mode === "s") st.vS = "v2"; else st.vP = "pv2"; return true; }
    if (inBox(x, y, geo.vAll)) { if (lab.mode === "s") st.vS = "v12"; else st.vP = "v"; return true; }
    return null;
  },
  cursor: (x, y) => ([geo.key, geo.r1, geo.r2, geo.vAll, ...(geo.spots || [])].some((b) => inBox(x, y, b)) ? "pointer" : ""),
  controls: [
    { type: "seg", label: "Tok manbai", opts: Object.entries(SRC).map(([k, v]) => [k, v.name]), get: () => st.src, set: (v) => { st.src = v; } },
    { type: "seg", label: "Kalit", opts: [[true, "Ulangan"], [false, "Uzilgan"]], get: () => st.on, set: (v) => { st.on = v; } },
    { type: "seg", label: "Ampermetr joyi", only: "s", opts: [["a1", "R₁ dan oldin"], ["a2", "R₁ va R₂ orasida"], ["a3", "R₂ dan keyin"]], get: () => st.aS, set: (v) => { st.aS = v; } },
    { type: "seg", label: "Voltmetr", only: "s", opts: [["v1", "R₁"], ["v2", "R₂"], ["v12", "Umumiy"]], get: () => st.vS, set: (v) => { st.vS = v; } },
    { type: "seg", label: "Ampermetr joyi", only: "p", opts: [["a", "Umumiy"], ["p1", "1-tarmoq"], ["p2", "2-tarmoq"]], get: () => st.aP, set: (v) => { st.aP = v; } },
    { type: "seg", label: "Voltmetr", only: "p", opts: [["pv1", "R₁"], ["pv2", "R₂"], ["v", "MN"]], get: () => st.vP, set: (v) => { st.vP = v; } },
    { type: "note", text: "Sahnada: kalitni bosing; bo‘sh doirani bosib ampermetrni o‘sha joyga ko‘chiring; rezistorni bosib voltmetrni uning uchlariga ulang." },
  ],
  readouts(lab) {
    const r = inst(lab.mode), ak = lab.mode === "s" ? st.aS : st.aP, vk = lab.mode === "s" ? st.vS : st.vP;
    return [["Ampermetr <i>I</i>", `${fmt(r.I, 2)}<small>A</small>`, A_NAMES[ak], "orange"], ["Voltmetr <i>U</i>", `${fmt(r.U, 2)}<small>V</small>`, V_NAMES[vk], "blue"],
      ["Ulash", lab.mode === "s" ? "Ketma-ket" : "Parallel", st.on ? "kalit ulangan" : "kalit uzilgan"], ["Bo‘linma qiymati", `${fmt(A_DIV, 2)} A · ${fmt(V_DIV, 1)} V`, "yarim bo‘linmagacha o‘qiladi"]];
  },
  record(lab) {
    if (!st.on) return { err: "Kalit uzilgan — avval zanjirni ulang." };
    const r = inst(lab.mode), I = fmt(r.I, 2), U = fmt(r.U, 2);
    if (lab.mode === "s") { const uk = st.vS === "v1" ? "U1" : st.vS === "v2" ? "U2" : "U", un = { U1: "U₁", U2: "U₂", U: "U" }[uk]; return { t: "t1", v: { I, [uk]: U }, text: `Ketma-ket: I = ${I} A (${A_NAMES[st.aS]}); ${un} = ${U} V` }; }
    const ik = st.aP === "a" ? "I" : st.aP === "p1" ? "I1" : "I2", inm = { I: "I", I1: "I₁", I2: "I₂" }[ik], uk = "U";
    return { t: "t2", v: { [ik]: I, [uk]: U }, text: `Parallel: ${inm} = ${I} A; U = ${U} V (${V_NAMES[st.vP]})` };
  },
  explain(lab) {
    if (!st.on) return "Kalit uzilgan — zanjirda tok yo‘q.";
    const s = solveCirc(lab.mode);
    return lab.mode === "s" ? `Ketma-ket ulashda ampermetr qayerga ulanmasin, bir xil tokni ko‘rsatadi. Voltmetr R₁ da ${fmt(readMeter(s.U1 * K_V, V_DIV), 2)} V, R₂ da ${fmt(readMeter(s.U2 * K_V, V_DIV), 2)} V — katta qarshilikda kuchlanish ham katta.`
      : `Parallel ulashda ikkala rezistorning uchlaridagi kuchlanish bir xil. Kichik qarshilikli tarmoqdan (R₁) katta tok o‘tadi; umumiy tok tarmoqlardagi toklar yig‘indisiga teng.`;
  },
  steps: ["1-topshiriq: kalitni ulang. Ampermetrni uchala joyga navbat bilan qo‘yib, ko‘rsatkichni yozing — tok hamma joyda bir xilmi?",
    "Voltmetrni R₁, R₂ va umumiy uchlarga ulab U₁, U₂, U ni qaydga yozing. Qaydlar «→ 1» bilan jadvalning bitta qatoriga yig‘iladi.",
    "2-topshiriq: parallel ulashda umumiy tok I, tarmoqlardagi I₁, I₂ va MN kuchlanishni o‘lchang («→ 2»).",
    "Manbani almashtirib (3 V) tajribani takrorlash mumkin — har biri yangi qator. So‘ng xulosa va PDF hisobot."],
  formulas: ["Ketma-ket: <span class=\"sim-math\">I = I₁ = I₂</span>, <span class=\"sim-math\">U = U₁ + U₂</span>, <span class=\"sim-math\">R = R₁ + R₂</span>",
    "Parallel: <span class=\"sim-math\">U = U₁ = U₂</span>, <span class=\"sim-math\">I = I₁ + I₂</span>", "<span class=\"sim-math\">1/R = 1/R₁ + 1/R₂</span>, ya’ni <span class=\"sim-math\">R = R₁R₂ / (R₁ + R₂)</span>"],
  note: "Manbaning ichki qarshiligi tufayli parallel ulashda (tok katta) manba qisqichlaridagi kuchlanish ketma-ket ulashdagidan biroz kichik bo‘ladi.",
  notebook: {
    intro: "Har bir qatorga bitta tajriba (bitta manba) natijalari yoziladi. Qaydlar qatorni bosqichma-bosqich to‘ldiradi.",
    conclusionPh: "Ketma-ket va parallel ulashda tok va kuchlanish qanday taqsimlanadi? Umumiy qarshilik formulalari tasdiqlandimi?",
    hint: "Javob bering: 1) Ketma-ket ulashda ampermetr turli joyda bir xil ko‘rsatdimi? 2) U₁ + U₂ va U qanchalik mos? 3) Parallel ulashda I₁ + I₂ = I bajarildimi? 4) Parallel ulangan qarshiliklarning umumiy qarshiligi eng kichigidan ham kichik ekanini tushuntiring.",
    minTables: 2,
    tables: [
      { key: "t1", okLabel: "Ketma-ket", need: "1-jadvalda kamida 1 ta to‘liq qator", title: "1-topshiriq. Ketma-ket ulash",
        head: ["U₁, V", "U₂, V", "U, V", "I, A", "U₁ + U₂, V", "R = U/I, Ω", "R₁ + R₂, Ω", "Tekshiruv"], cols: [{ k: "U1", kind: "num" }, { k: "U2", kind: "num" }, { k: "U", kind: "num" }, { k: "I", kind: "num" }], outs: ["sU", "R", "Rs"],
        blank: () => ({ U1: "", U2: "", U: "", I: "" }), rows: 2, max: 6,
        parse: (r) => ({ U1: num(r.U1), U2: num(r.U2), U: num(r.U), I: num(r.I) }), check: (r) => ok4(r, ["U1", "U2", "U", "I"]), analyze: an1,
        out: (A, j) => { const r = A.rows[j]; return { sU: fmt(r.sumU, 2), R: fmt(r.R, 1), Rs: fmt(r.Rs, 1) }; },
        summary: (A) => A.rows.length ? [["U₁ + U₂ va U", `${fmt(pct(A.rows[0].sumU, A.rows[0].U), 1)} %`, "farq (1-qator)"], ["R va R₁ + R₂", `${fmt(A.rows[0].R, 1)} / ${fmt(A.rows[0].Rs, 1)} Ω`, `nominal ${R1.nom + R2.nom} Ω`]] : null,
        ok: (A) => A.ok },
      { key: "t2", okLabel: "Parallel", need: "2-jadvalda kamida 1 ta to‘liq qator", title: "2-topshiriq. Parallel ulash",
        head: ["U, V", "I₁, A", "I₂, A", "I, A", "I₁ + I₂, A", "R = U/I, Ω", "R₁R₂/(R₁+R₂), Ω", "Tekshiruv"], cols: [{ k: "U", kind: "num" }, { k: "I1", kind: "num" }, { k: "I2", kind: "num" }, { k: "I", kind: "num" }], outs: ["sI", "R", "Rp"],
        blank: () => ({ U: "", I1: "", I2: "", I: "" }), rows: 2, max: 6,
        parse: (r) => ({ U: num(r.U), I1: num(r.I1), I2: num(r.I2), I: num(r.I) }), check: (r) => ok4(r, ["U", "I1", "I2", "I"]), analyze: an2,
        out: (A, j) => { const r = A.rows[j]; return { sI: fmt(r.sumI, 2), R: fmt(r.R, 2), Rp: fmt(r.Rp, 2) }; },
        summary: (A) => A.rows.length ? [["I₁ + I₂ va I", `${fmt(pct(A.rows[0].sumI, A.rows[0].I), 1)} %`, "farq (1-qator)"], ["R (parallel)", `${fmt(A.rows[0].R, 2)} Ω`, `nazariy ${fmt(parallelR(R1.nom, R2.nom), 2)} Ω`]] : null,
        ok: (A) => A.ok },
    ],
    build,
  },
});
