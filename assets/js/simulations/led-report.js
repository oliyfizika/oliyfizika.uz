// ==========================================================================
// LED orqali Plank doimiysini aniqlash — laboratoriya hisoboti mazmuni (→ labreport.js).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { H, QE, C, LEDS, ledById, photonEv, R_LIM, GRATING, D_NM } from "./led-physics.js";

export const SITE = { url: "https://oliyfizika.uz/simulations/led-planck.html", label: "oliyfizika.uz/simulations/led-planck.html" };
export const DOC_LABEL = "Virtual laboratoriya ishi · Kvant fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const SUB = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const TCOL = { IR: "red!50!black", R: "red!80!black", O: "orange!90!black", Y: "yellow!60!black", G: "green!60!black", B: "blue!80!black", V: "violet!80!black" };
const plain = (s) => s.replace(/\{,\}/g, ",").replace(/\\cdot 10\^\{(-?\d+)\}/g, (_, e) => `·10${SUP(e.replace("-", "−"))}`);
const nameLow = (L) => (/^[A-Z]{2}/.test(L.short) ? L.short : L.short.replace(/^\S/, (ch) => ch.toLowerCase()));

/** res — {t1: {A, flags, ok}, t2: {A, flags, ok}}; curves — {ledId: {pts}} */
export function buildLedDoc(nb, res, curves) {
  const A1 = res.t1, A2 = res.t2, X = []; let sec = 1, tab = 1, fig = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });

  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "Turli rangdagi yorug‘lik diodlari (LED) nurlanishining to‘lqin uzunligini difraksion panjara yordamida o‘lchash.",
    "Diodlarning volt-amper xarakteristikasidan bo‘sag‘a (ochilish) kuchlanishi $U_0$ ni aniqlash.",
    "$eU_0 \\approx h\\nu$ munosabatidan Plank doimiysi $h$ ni topish.",
  ] });

  S("Qisqacha nazariya");
  X.push({ t: "p", text: "Yorug‘lik diodi — yarimo‘tkazgichli p–n o‘tish. To‘g‘ri yo‘nalishda ulanganda o‘tish sohasida elektronlar kovaklar bilan rekombinatsiyalanadi; har bir rekombinatsiyada energiyasi taqiqlangan zona kengligi $E_g$ ga yaqin bo‘lgan foton chiqadi:" });
  X.push({ t: "eq", tag: 1, lines: ["h\\nu = \\frac{hc}{\\lambda} \\approx E_g"] });
  X.push({ t: "p", text: "Diod orqali sezilarli tok faqat tashqi kuchlanish potensial to‘siqni yo‘qotganda, ya’ni $eU \\approx E_g$ bo‘lganda o‘ta boshlaydi. VAX ning chiziqli qismini $I = 0$ gacha davom ettirib topilgan bo‘sag‘a kuchlanishi $U_0$ uchun:" });
  X.push({ t: "eq", tag: 2, lines: ["eU_0 \\approx h\\nu \\quad\\Longrightarrow\\quad U_0 = \\frac{h}{e}\\,\\nu + b"] });
  X.push({ t: "p", text: "Chiziqli qismdagi ikki nuqta $(U_1, I_1)$ va $(U_2, I_2)$ orqali o‘tgan to‘g‘ri chiziqning abssissa o‘qi bilan kesishishi:" });
  X.push({ t: "eq", tag: 3, lines: ["U_0 = U_1 - I_1\\,\\frac{U_2 - U_1}{I_2 - I_1}"] });
  X.push({ t: "p", text: "Nurlanish to‘lqin uzunligi difraksion panjara formulasidan aniqlanadi ($d$ — panjara doimiysi, $m$ — spektr tartibi, $\\varphi$ — og‘ish burchagi):" });
  X.push({ t: "eq", tag: 4, lines: ["d \\sin\\varphi = m\\lambda"] });

  S("Jihozlar (virtual qurilma)");
  X.push({ t: "list", items: [
    `Yorug‘lik diodlari: ${LEDS.map((l) => `${nameLow(l)} (${l.nm} nm)`).join(", ")} — pasport qiymatlari.`,
    `Rostlanuvchi manba $E = 0\\ldots 6$ V, cheklovchi rezistor $R = ${R_LIM}$ $\\Omega$, voltmetr (0,001 V), milliampermetr (0,01 mA).`,
    `Goniometr-spektrometr: kollimator, difraksion panjara (${GRATING} chiziq/mm, $d = ${fx(D_NM, 1)}$ nm), ko‘rish trubasi, nonius (0,05$^\\circ$).`,
  ] });
  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "Spektrometrda har bir diod uchun spektr polosasining markazini vizirga keltirib, og‘ish burchagi $\\varphi$ ni o‘lchang (1-jadval).",
    "Diodni zanjirga ulang, manba kuchlanishini asta oshirib, $I(U)$ xarakteristikasini yozing. Chiziqli qismdan ($I \\approx 5\\ldots 20$ mA) ikki nuqta oling (2-jadval).",
    "Har bir diod uchun $U_0$ ni (3) formula bilan hisoblang, $U_0(\\nu)$ grafigini chizing va uning qiyaligidan $h$ ni toping.",
  ] });

  // 1-topshiriq
  if (A1?.ok) {
    const a = A1.A;
    S("1-topshiriq: to‘lqin uzunligini o‘lchash");
    X.push({ t: "table", caption: `**${tab++}-jadval.** Difraksion panjara bilan o‘lchash ($d = ${fx(D_NM, 1)}$ nm)`,
      head: ["№", "Diod", "$m$", "$\\varphi$, $^\\circ$", "$\\sin\\varphi$", "$\\lambda$, nm", "Pasport $\\lambda$, nm", "Tekshiruv"],
      rows: a.rows.map((r, i) => [String(i + 1), nameLow(r.L), String(r.m), M(fx(r.phi, 2)), M(fx(Math.sin((r.phi * Math.PI) / 180), 4)), M(fx(r.lam, 1)), M(String(r.L.nm)), A1.flags[i] ? "$\\checkmark$" : "--"]),
      note: "«Tekshiruv»: $\\checkmark$ — burchak spektr polosasi markazidan $\\pm 0{,}3^\\circ$ dan ko‘p farq qilmaydi." });
    const r0 = a.rows[0];
    X.push({ t: "p", text: "**Hisoblash namunasi** (1-qator):" });
    X.push({ t: "eq", lines: [`\\lambda = \\frac{d\\sin\\varphi}{m} = \\frac{${fx(D_NM, 1)}\\ \\text{nm}\\cdot ${fx(Math.sin((r0.phi * Math.PI) / 180), 4)}}{${r0.m}} = ${fx(r0.lam, 1)}\\ \\text{nm}`] });
  }

  // 2-topshiriq
  if (A2?.ok) {
    const b = A2.A, f = b.fit;
    S("2-topshiriq: bo‘sag‘a kuchlanishi va Plank doimiysi");
    X.push({ t: "table", caption: `**${tab++}-jadval.** VAX ning chiziqli qismi va bo‘sag‘a kuchlanishi`,
      head: ["№", "Diod", "$U_1$, V", "$I_1$, mA", "$U_2$, V", "$I_2$, mA", "$U_0$, V", "$\\lambda$, nm", "$\\nu$, $10^{14}$ Hz", "$h_i$, $10^{-34}$ J·s", "Tekshiruv"],
      rows: b.rows.map((r, i) => [String(i + 1), nameLow(r.L), M(fx(r.U1, 3)), M(fx(r.I1, 2)), M(fx(r.U2, 3)), M(fx(r.I2, 2)), M(fx(r.U0, 3)), M(fx(r.lam, 1)) + (r.meas ? "" : "*"), M(fx(r.nu14, 3)), M(fx(r.hi / 1e-34, 3)), A2.flags[i] ? "$\\checkmark$" : "--"]),
      note: `${b.rows.some((r) => !r.meas) ? "* — pasport qiymati (spektrometrda o‘lchanmagan). " : ""}$h_i = eU_0\\lambda/c$. «Tekshiruv»: $\\checkmark$ — nuqtalar qurilmadagi VAX ustida.` });
    const keys = Object.keys(curves || {}).filter((k) => ledById(k));
    if (keys.length) {
      const imax = Math.max(...keys.flatMap((k) => curves[k].pts.map((p) => p[1])));
      X.push({ t: "fig", id: "iv", caption: `**${fig++}-rasm.** Yorug‘lik diodlarining volt-amper xarakteristikalari (o‘lchangan) va chiziqli qismning ekstrapolyatsiyasi (shtrix).`, plot: {
        xmin: 0, xmax: 4, ymin: 0, ymax: Math.min(45, imax * 1.1), legendPos: "north west", xticks: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
        xlab: `Kuchlanish ${it("U")}, V`, ylab: `Tok ${it("I")}, mA`, xlabTeX: "Kuchlanish $U$, V", ylabTeX: "Tok $I$, mA",
        series: [
          ...keys.map((k) => { const Ld = ledById(k); return { kind: "line", data: curves[k].pts.slice().sort((p, q) => p[0] - q[0]), color: Ld.color, label: `${Ld.short} (${Ld.nm} nm)`, texColor: TCOL[k], labelTeX: `${nameLow(Ld)} (${Ld.nm} nm)` }; }),
          ...b.rows.map((r) => { const kk = (r.I2 - r.I1) / (r.U2 - r.U1); return { kind: "line", data: [[r.U0, 0], [r.U2 + 2 / kk, r.I2 + 2]], color: r.L.color, dash: "4 3", texColor: TCOL[r.led] }; }),
        ] } });
    }
    const x0 = Math.floor(Math.min(...b.rows.map((r) => r.nu14)) - 0.5), x1 = Math.ceil(Math.max(...b.rows.map((r) => r.nu14)) + 0.5);
    X.push({ t: "fig", id: "u0", caption: `**${fig++}-rasm.** Bo‘sag‘a kuchlanishining nurlanish chastotasiga bog‘liqligi. To‘g‘ri chiziq qiyaligi $h/e$.`, plot: {
      xmin: x0, xmax: x1, ymin: Math.max(0, Math.floor((f.a + f.b * x0 * 1e14) * 2) / 2 - 0.5), ymax: Math.ceil((f.a + f.b * x1 * 1e14) * 2) / 2 + 0.25, legendPos: "north west",
      xlab: `Chastota ${it("ν")}, 10${SUP("14")} Hz`, ylab: `${it("U")}${SUB("0")}, V`, xlabTeX: "Chastota $\\nu$, $10^{14}$ Hz", ylabTeX: "$U_0$, V",
      series: [
        { kind: "line", fn: (x) => f.a + f.b * x * 1e14, color: "#1d4ed8", label: `EKK: ${it("U")}${SUB("0")} = ${plain(fx(f.b * 1e14, 4))}·${it("ν")} ${f.a < 0 ? "−" : "+"} ${plain(fx(Math.abs(f.a), 3))}`, texColor: "ofblue", texFn: `${(f.b * 1e14).toFixed(6)}*x + (${f.a.toFixed(5)})`, domain: [x0, x1], samples: 2, labelTeX: `EKK: $U_0=${fx(f.b * 1e14, 4)}\\,\\nu${f.a < 0 ? "-" : "+"}${fx(Math.abs(f.a), 3)}$` },
        { kind: "pts", data: b.rows.map((r) => [r.nu14, r.U0, r.U0 - 0.02, r.U0 + 0.02]), color: "#c2410c", label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
      ] } });
    const r0 = b.rows[0];
    X.push({ t: "p", text: "**Hisoblash.** Bo‘sag‘a kuchlanishi (1-qator, (3) formula):" });
    X.push({ t: "eq", lines: [`U_0 = ${fx(r0.U1, 3)} - ${fx(r0.I1, 2)}\\cdot\\frac{${fx(r0.U2, 3)} - ${fx(r0.U1, 3)}}{${fx(r0.I2, 2)} - ${fx(r0.I1, 2)}} = ${fx(r0.U0, 3)}\\ \\text{V},\\qquad h_1 = \\frac{eU_0\\lambda}{c} = ${sx(r0.hi, 4)}\\ \\text{J}\\cdot\\text{s}`] });
    X.push({ t: "p", text: "Eng kichik kvadratlar usuli ($U_0 = k\\nu + b$):" });
    X.push({ t: "eq", lines: [
      `k &= \\frac{h}{e} = (${sx(f.b, 4)} \\pm ${sx(Math.max(f.sb, 1e-18), 2)})\\ \\text{V}\\cdot\\text{s},\\qquad b = (${fx(f.a, 3)} \\pm ${fx(Math.max(f.sa, 0.001), 3)})\\ \\text{V}`,
      `h &= e\\,k = 1{,}602\\cdot 10^{-19}\\ \\text{C}\\cdot ${sx(f.b, 4)}\\ \\text{V}\\cdot\\text{s} = (${sx(b.h, 4)} \\pm ${sx(Math.max(b.sh, 1e-37), 2)})\\ \\text{J}\\cdot\\text{s}`,
      `\\overline{h_i} &= (${sx(b.hm, 4)} \\pm ${sx(Math.max(b.hsd, 1e-37), 2)})\\ \\text{J}\\cdot\\text{s}\\quad (${b.rows.length}\\ \\text{ta diod})`,
    ] });
    X.push({ t: "p", text: `Jadval qiymati: $h = 6{,}626\\cdot 10^{-34}$ J·s; farq: EKK bo‘yicha $${fx((100 * (b.h - H)) / H, 1)}\\,\\%$, o‘rtacha $h_i$ bo‘yicha $${fx((100 * (b.hm - H)) / H, 1)}\\,\\%$. Farq sabablari: bo‘sag‘a $E_g$ ga aniq teng emas (issiqlik energiyasi $\\sim kT$, kontakt kuchlanishlari, ketma-ket qarshilik), LED spektri kengligi ${"$"}\\Delta\\lambda \\approx 15\\ldots 45${"$"} nm.` });
  }

  S("Xulosa");
  const box = [];
  if (A1?.ok) box.push(`• Spektrometrda o‘lchangan to‘lqin uzunliklari pasport qiymatlariga mos (${Object.entries(A1.A.lam).map(([id, l]) => `${nameLow(ledById(id))}: $${fx(l, 1)}$ nm`).join("; ")}).`);
  if (A2?.ok) box.push(`• $U_0$ chastotaga chiziqli bog‘liq; $h = ${sx(A2.A.h, 3)}$ J·s (EKK), $\\overline{h_i} = ${sx(A2.A.hm, 3)}$ J·s.`);
  box.push("• Yorug‘lik diodida elektr energiyasi kvantlar — energiyasi $h\\nu \\approx eU_0$ bo‘lgan fotonlar ko‘rinishida nurlanadi.");
  docTail(X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Yorug‘lik diodlari yordamida Plank doimiysini aniqlash", titlePlain: "Laboratoriya ishi. LED va Plank doimiysi", author: nb.f.name, sub: "Volt-amper xarakteristikasi, bo‘sag‘a kuchlanishi va difraksion spektrometr", meta: docMeta(nb, userText), blocks: X };
}
export { QE, C, photonEv };
