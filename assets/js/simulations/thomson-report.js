// ==========================================================================
// e/m (Tomson usuli) — laboratoriya hisoboti mazmuni (→ labreport.js).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { EM, KB, N, R, BY } from "./thomson-physics.js";

export const SITE = { url: "https://oliyfizika.uz/simulations/thomson-em.html", label: "oliyfizika.uz/simulations/thomson-em.html" };
export const DOC_LABEL = "Virtual laboratoriya ishi · Kvant fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const SUB = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const plain = (s) => s.replace(/\{,\}/g, ",").replace(/\\cdot 10\^\{(-?\d+)\}/g, (_, e) => `·10${SUP(e.replace("-", "−"))}`);

export function buildThomsonDoc(nb, res) {
  const T = res.t1, a = T.A, X = []; let sec = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });
  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "Bir jinsli magnit maydonda harakatlanayotgan elektronlar dastasining traektoriyasini kuzatish.",
    "Dasta aylanasining radiusi, tezlatuvchi kuchlanish va magnit induksiyasi bo‘yicha elektronning solishtirma zaryadi $e/m$ ni aniqlash.",
    "Yerning magnit maydoni ta’sirini kompensatsiyalash usulini o‘rganish; elektron massasini hisoblash.",
  ] });
  S("Qisqacha nazariya");
  X.push({ t: "p", text: "Katoddan chiqqan elektronlar $U$ potensiallar farqi bilan tezlashtiriladi:" });
  X.push({ t: "eq", tag: 1, lines: ["eU = \\frac{m v^2}{2}"] });
  X.push({ t: "p", text: "Tezligi magnit induksiyasiga perpendikulyar bo‘lgan elektronga Lorens kuchi ta’sir qiladi va u aylana bo‘ylab harakatlanadi:" });
  X.push({ t: "eq", tag: 2, lines: ["evB = \\frac{m v^2}{r} \\quad\\Longrightarrow\\quad r = \\frac{1}{B}\\sqrt{\\frac{2Um}{e}}"] });
  X.push({ t: "p", text: "(1) va (2) dan solishtirma zaryad:" });
  X.push({ t: "eq", tag: 3, lines: ["\\frac{e}{m} = \\frac{2U}{B^2 r^2}"] });
  X.push({ t: "p", text: "Radiusi $R$, o‘ramlar soni $N$ bo‘lgan, bir-biridan $R$ masofada joylashgan Helmgols g‘altaklari markazidagi maydon:" });
  X.push({ t: "eq", tag: 4, lines: [`B = \\left(\\frac{4}{5}\\right)^{3/2}\\frac{\\mu_0 N I}{R} = k I,\\qquad k = ${fx(KB * 1000, 4)}\\ \\text{mT/A}`] });
  X.push({ t: "p", text: "Yer magnit maydonining g‘altaklar o‘qi bo‘ylab tashkil etuvchisi $B_Y$ g‘altak maydoniga qo‘shiladi. Qurilma 180° burilganda u ishorasini o‘zgartiradi, shuning uchun ikki holatdagi toklarning o‘rtachasi $\\bar I = (I_1 + I_2)/2$ uning ta’sirini yo‘qotadi." });
  S("Jihozlar (virtual qurilma)");
  X.push({ t: "list", items: [
    "Ingichka dastali naycha (siyraklangan vodorod bilan to‘ldirilgan shar, elektron to‘pi, diametri 4, 6, 8, 10 sm bo‘lgan nuqtali belgilar).",
    `Helmgols g‘altaklari: $N = ${N}$, $R = ${fx(R * 100, 0)}$ sm; ampermetr (0,001 A).`,
    "Tezlatuvchi kuchlanish manbai $U = 100\\ldots 300$ V, voltmetr (1 V).",
  ] });
  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "Tezlatuvchi kuchlanish $U$ ni o‘rnating. G‘altak tokini o‘zgartirib, dasta aylanasini tanlangan belgidan o‘tkazing; tok $I_1$ ni yozing.",
    "Qurilmani vertikal o‘q atrofida 180° burib, o‘sha belgi uchun tok $I_2$ ni o‘lchang.",
    "O‘lchashlarni boshqa belgilar va kuchlanishlar uchun takrorlang; (3) va (4) bo‘yicha $e/m$ ni hisoblang.",
  ] });
  S("O‘lchash natijalari");
  X.push({ t: "table", caption: "**1-jadval.** Dasta belgilardan o‘tadigan toklar va $e/m$",
    head: ["№", "$U$, V", "$r$, sm", "$I_1$, A", "$I_2$, A", "$\\bar I$, A", "$B$, mT", "$e/m$, $10^{11}$ C/kg", "Tekshiruv"],
    rows: a.rows.map((r, i) => [String(i + 1), M(fx(r.U, 0)), M(fx(r.r * 100, 0)), M(fx(r.Ip, 3)), r.both ? M(fx(r.Im, 3)) : "--", M(fx(r.I, 3)), M(fx(r.B * 1000, 3)), M(fx(r.em / 1e11, 3)), T.flags[i] ? "$\\checkmark$" : "--"]),
    note: `«Tekshiruv»: $\\checkmark$ — shu tokda dasta belgidan o‘tadi ($\\pm 0{,}015$ A).${a.nBoth < a.rows.length ? " «--» — 180° holatda o‘lchanmagan; $\\bar I = I_1$." : ""}` });
  const r0 = a.rows[0];
  X.push({ t: "p", text: "**Hisoblash namunasi** (1-qator):" });
  X.push({ t: "eq", lines: [
    `\\bar I &= ${r0.both ? `\\frac{${fx(r0.Ip, 3)} + ${fx(r0.Im, 3)}}{2} = ` : ""}${fx(r0.I, 3)}\\ \\text{A},\\qquad B = k\\bar I = ${fx(KB * 1000, 4)}\\cdot ${fx(r0.I, 3)} = ${fx(r0.B * 1000, 3)}\\ \\text{mT}`,
    `\\frac{e}{m} &= \\frac{2U}{B^2 r^2} = \\frac{2\\cdot ${fx(r0.U, 0)}}{(${sx(r0.B, 4)})^2\\cdot (${fx(r0.r, 2)})^2} = ${sx(r0.em, 4)}\\ \\text{C/kg}`,
  ] });
  if (a.fit) {
    const xmn = Math.max(...a.rows.map((r) => r.X)) * 1.15;
    X.push({ t: "fig", id: "ux", caption: "**1-rasm.** Tezlatuvchi kuchlanishning $(B r)^2/2$ ga bog‘liqligi. Koordinata boshidan o‘tuvchi to‘g‘ri chiziq qiyaligi $e/m$.", plot: {
      xmin: 0, xmax: xmn * 1e9, ymin: 0, ymax: Math.max(...a.rows.map((r) => r.U)) * 1.15, legendPos: "north west",
      xlab: `(${it("Br")})${SUP("2")}/2, 10${SUP("−9")} T${SUP("2")}·m${SUP("2")}`, ylab: `${it("U")}, V`, xlabTeX: "$(Br)^2/2$, $10^{-9}$ T$^2\\cdot$m$^2$", ylabTeX: "$U$, V",
      series: [
        { kind: "line", fn: (x) => a.fit.k * x * 1e-9, color: "#1d4ed8", label: `${it("U")} = ${plain(sx(a.fit.k, 4))}·(${it("Br")})${SUP("2")}/2`, texColor: "ofblue", texFn: `${(a.fit.k * 1e-9).toFixed(4)}*x`, domain: [0, xmn * 1e9], samples: 2, labelTeX: `$U = ${sx(a.fit.k, 4)}\\,(Br)^2/2$` },
        { kind: "pts", data: a.rows.map((r) => [r.X * 1e9, r.U]), color: "#c2410c", label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
      ] } });
  }
  X.push({ t: "p", text: "**Natijalar:**" });
  const L = [`\\overline{e/m} &= (${sx(a.m, 4)} \\pm ${sx(Math.max(a.se, 1e6), 2)})\\ \\text{C/kg}\\quad (${a.rows.length}\\ \\text{ta o‘lchash})`];
  if (a.fit) L.push(`e/m\\ (\\text{EKK}) &= ${sx(a.fit.k, 4)}\\ \\text{C/kg},\\qquad m = \\frac{e}{e/m} = \\frac{1{,}602\\cdot 10^{-19}}{${sx(a.fit.k, 4)}} = ${sx(a.me, 4)}\\ \\text{kg}`);
  L.push(`e/m\\ (\\text{faqat}\\ I_1) &= ${sx(a.mp, 4)}\\ \\text{C/kg}`);
  X.push({ t: "eq", lines: L });
  X.push({ t: "p", text: `Jadval qiymati: $e/m = 1{,}759\\cdot 10^{11}$ C/kg, $m_e = 9{,}109\\cdot 10^{-31}$ kg. O‘rtacha qiymatning farqi $${fx((100 * (a.m - EM)) / EM, 1)}\\,\\%$. Yer maydoni hisobga olinmasa (faqat $I_1$), farq $${fx((100 * (a.mp - EM)) / EM, 1)}\\,\\%$ ga yetadi. Qolgan xato manbalari: dasta qalinligi va belgi bilan moslash aniqligi, elektron to‘pidagi kontakt potensiallari (elektron energiyasi $eU$ dan biroz kichik).` });
  S("Xulosa");
  docTail(X, nb, userText, [
    `• Elektronning solishtirma zaryadi: $e/m = ${sx(a.m, 3)}$ C/kg (jadvalda $1{,}759\\cdot 10^{11}$ C/kg).`,
    a.fit ? `• $U$ ning $(Br)^2/2$ ga bog‘liqligi chiziqli; elektron massasi $m = ${sx(a.me, 3)}$ kg.` : "• Har bir o‘lchash uchun $e/m$ hisoblandi.",
    `• Yer magnit maydonining ta’siri ($B_Y \\approx ${fx(BY * 1e6, 0)}$ $\\mu$T) qurilmani 180° burish bilan kompensatsiyalandi.`,
  ], SITE);
  return { title: "Laboratoriya ishi. Elektronning solishtirma zaryadini aniqlash (Tomson usuli)", titlePlain: "Laboratoriya ishi. Elektronning solishtirma zaryadi", author: nb.f.name, sub: "Ingichka dastali naycha va Helmgols g‘altaklari", meta: docMeta(nb, userText), blocks: X };
}
