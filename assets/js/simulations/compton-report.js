// ==========================================================================
// Kompton effekti — laboratoriya hisoboti mazmuni (→ labreport.js).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { E0, MEC2, HC, eScat } from "./compton-physics.js";

export const SITE = { url: "https://oliyfizika.uz/simulations/compton.html", label: "oliyfizika.uz/simulations/compton.html" };
export const DOC_LABEL = "Virtual laboratoriya ishi · Kvant fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const SUB = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const PAL = ["#1d4ed8", "#c2410c", "#15803d", "#7e22ce", "#0e7490", "#be123c"], TPAL = ["ofblue", "orange!80!black", "green!50!black", "violet!80!black", "cyan!60!black", "red!70!black"];
const dot = (s) => s.replace("{,}", ",");

/** res — {t1, t2}; rec — saqlangan spektrlar {"s|θ": {t, d: [256 bin]}} */
export function buildComptonDoc(nb, res, rec) {
  const C1 = res.t1, C2 = res.t2, a1 = C1.A, a2 = C2.A, cal = a1.fit, X = []; let sec = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });
  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "γ-kvantlarning erkin (kuchsiz bog‘langan) elektronlarda sochilishini — Kompton effektini o‘rganish.",
    "Sochilgan γ-kvant energiyasining sochilish burchagiga bog‘liqligini o‘lchash va Kompton formulasini tekshirish.",
    "Elektronning tinchlikdagi energiyasi $m_e c^2$ va Kompton to‘lqin uzunligi $\\lambda_C$ ni aniqlash.",
  ] });
  S("Qisqacha nazariya");
  X.push({ t: "p", text: "Energiyasi $E_0 = h\\nu_0$ bo‘lgan foton tinch turgan elektronda $\\theta$ burchakka sochilganda energiya va impulsning saqlanish qonunlaridan (relyativistik elektron uchun):" });
  X.push({ t: "eq", tag: 1, lines: ["E' = \\frac{E_0}{1 + \\dfrac{E_0}{m_e c^2}\\,(1 - \\cos\\theta)}"] });
  X.push({ t: "p", text: "Teskari kattaliklarga o‘tilsa, chiziqli bog‘lanish hosil bo‘ladi:" });
  X.push({ t: "eq", tag: 2, lines: ["\\frac{1}{E'} = \\frac{1}{E_0} + \\frac{1}{m_e c^2}\\,(1 - \\cos\\theta)"] });
  X.push({ t: "p", text: "To‘lqin uzunligi tilida ($\\lambda = hc/E$) bu Kompton siljishi:" });
  X.push({ t: "eq", tag: 3, lines: ["\\Delta\\lambda = \\lambda' - \\lambda_0 = \\lambda_C\\,(1 - \\cos\\theta),\\qquad \\lambda_C = \\frac{h}{m_e c} = 2{,}426\\ \\text{pm}"] });
  X.push({ t: "p", text: "Klassik to‘lqin nazariyasida (Tomson sochilishi) sochilgan nurlanish chastotasi tushgan nurniki bilan bir xil bo‘lishi kerak edi; $\\Delta\\lambda \\ne 0$ — fotonning impulsga ega zarra ekanini ko‘rsatadi. Sochilish ehtimoli Klein–Nishina formulasi bilan beriladi." });
  S("Jihozlar (virtual qurilma)");
  X.push({ t: "list", items: [
    `$^{137}$Cs manbai ($E_0 = ${fx(E0, 2)}$ keV) qo‘rg‘oshin himoya va kollimator bilan; alyuminiy sochuvchi.`,
    "NaI(Tl) ssintillyatsion detektor, fotoelektron ko‘paytirgich, aylanuvchi qo‘l va burchak shkalasi ($0{,}5^\\circ$).",
    "Ko‘p kanalli analizator (1024 kanal); kalibrlash manbalari: $^{241}$Am, $^{133}$Ba, $^{22}$Na, $^{137}$Cs.",
  ] });
  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "Kalibrlash manbalarini detektor oldiga qo‘yib, spektrlarni yozing; fotopiklar sentroidlaridan $E = a + b\\cdot k$ kalibrovkasini toping (1-jadval).",
    "$^{137}$Cs dastasini sochuvchiga yo‘naltiring. Detektorni $\\theta$ burchakka o‘rnatib spektrni yig‘ing, sochilgan fotopik sentroidini aniqlang (2-jadval).",
    "Sochuvchini olib qo‘yib fon spektrini tekshiring; (2) bo‘yicha grafik chizib $m_e c^2$, $E_0$ va $\\lambda_C$ ni hisoblang.",
  ] });

  S("1-topshiriq: analizatorni kalibrlash");
  X.push({ t: "table", caption: "**1-jadval.** Kalibrlash chiziqlari", head: ["№", "Manba", "$E$, keV", "Kanal $k$", "$E - (a + bk)$, keV", "Tekshiruv"],
    rows: a1.rows.map((r, i) => [String(i + 1), r.L.src, M(fx(r.E, 2)), M(fx(r.ch, 1)), M(fx(r.res, 2)), C1.flags[i] ? "$\\checkmark$" : "--"]),
    note: "«Tekshiruv»: $\\checkmark$ — kanal shu chiziq fotopikiga mos." });
  const kmax = Math.max(...a1.rows.map((r) => r.ch)) * 1.1;
  X.push({ t: "fig", id: "cal", caption: "**1-rasm.** Analizatorning energiya bo‘yicha kalibrovka chizig‘i.", plot: {
    xmin: 0, xmax: Math.max(900, kmax), ymin: 0, ymax: Math.max(720, (cal.a + cal.b * kmax) * 1.05), legendPos: "north west",
    xlab: `Kanal ${it("k")}`, ylab: `${it("E")}, keV`, xlabTeX: "Kanal $k$", ylabTeX: "$E$, keV",
    series: [
      { kind: "line", fn: (x) => cal.a + cal.b * x, color: PAL[0], label: `${it("E")} = ${dot(fx(cal.a, 2))} + ${dot(fx(cal.b, 4))}·${it("k")}`, texColor: TPAL[0], texFn: `${cal.a.toFixed(4)} + ${cal.b.toFixed(6)}*x`, domain: [0, Math.max(900, kmax)], samples: 2, labelTeX: `$E = ${fx(cal.a, 2)} + ${fx(cal.b, 4)}\\,k$` },
      { kind: "pts", data: a1.rows.map((r) => [r.ch, r.E]), color: PAL[1], label: "kalibrlash chiziqlari", texColor: TPAL[1], labelTeX: "kalibrlash chiziqlari" },
    ] } });
  X.push({ t: "eq", lines: [`a = (${fx(cal.a, 2)} \\pm ${fx(Math.max(cal.sa, 0.01), 2)})\\ \\text{keV},\\qquad b = (${fx(cal.b, 4)} \\pm ${fx(Math.max(cal.sb, 1e-4), 4)})\\ \\text{keV/kanal}`] });

  S("2-topshiriq: Kompton sochilishi");
  X.push({ t: "table", caption: "**2-jadval.** Sochilgan γ-kvantlar energiyasi", head: ["№", "$\\theta$, $^\\circ$", "Kanal", "$E'$, keV", "$1 - \\cos\\theta$", "$1/E'$, $10^{-3}$ keV$^{-1}$", "$\\Delta\\lambda$, pm", "$E'_{\\text{naz}}$, keV", "Tekshiruv"],
    rows: a2.rows.map((r, i) => [String(i + 1), M(fx(r.th, 1)), M(fx(r.ch, 1)), M(fx(r.E, 1)), M(fx(r.x, 4)), M(fx(r.inv * 1000, 4)), M(fx(r.dl, 3)), M(fx(r.Eth, 1)), C2.flags[i] ? "$\\checkmark$" : "--"]),
    note: "$E'_{\\text{naz}}$ — (1) formula bo‘yicha. «Tekshiruv»: $\\checkmark$ — kanal sochilgan fotopikka mos." });
  // saqlangan spektrlar
  const keys = Object.keys(rec || {}).filter((k) => k.startsWith("s|")).sort((p, q) => +p.slice(2) - +q.slice(2)).slice(0, 5);
  if (keys.length) {
    const sers = keys.map((k, i) => { const v = rec[k], d = v.d.map((n, j) => [cal.a + cal.b * (4 * j + 1.5), n / v.t]); return { kind: "line", data: d.filter((p) => p[0] > 20 && p[0] < 760), color: PAL[i % 6], label: `${it("θ")} = ${k.slice(2)}°`, texColor: TPAL[i % 6], labelTeX: `$\\theta = ${k.slice(2)}^\\circ$` }; });
    const ym = Math.max(...sers.flatMap((s) => s.data.filter((p) => p[0] > 120).map((p) => p[1])));
    X.push({ t: "fig", id: "spec", caption: "**2-rasm.** Turli burchaklarda yozilgan spektrlar (hisob tezligi, 4 kanal birlashtirilgan). Sochilgan fotopik burchak oshishi bilan past energiyalarga siljiydi; 662 keV dagi kichik cho‘qqi — himoyadan sizib chiqish.", plot: {
      xmin: 0, xmax: 760, ymin: 0, ymax: ym * 1.25, legendPos: "north east", xticks: [0, 100, 200, 300, 400, 500, 600, 700],
      xlab: `${it("E")}, keV`, ylab: "hisob tezligi, 1/s", xlabTeX: "$E$, keV", ylabTeX: "hisob tezligi, 1/s", series: sers } });
  }
  const f = a2.fit, xm = 2;
  X.push({ t: "fig", id: "inv", caption: `**${keys.length ? 3 : 2}-rasm.** $1/E'$ ning $(1 - \\cos\\theta)$ ga bog‘liqligi. Qiyalik $1/m_e c^2$, ordinata kesmasi $1/E_0$.`, plot: {
    xmin: 0, xmax: xm, ymin: 0, ymax: Math.ceil((f.a + f.b * xm) * 1000 * 1.1 * 2) / 2, legendPos: "north west",
    xlab: `1 − cos ${it("θ")}`, ylab: `1/${it("E")}′, 10${SUP("−3")} keV${SUP("−1")}`, xlabTeX: "$1 - \\cos\\theta$", ylabTeX: "$1/E'$, $10^{-3}$ keV$^{-1}$",
    series: [
      { kind: "line", fn: (x) => (f.a + f.b * x) * 1000, color: PAL[0], label: "EKK", texColor: TPAL[0], texFn: `${(f.a * 1000).toFixed(6)} + ${(f.b * 1000).toFixed(6)}*x`, domain: [0, xm], samples: 2, labelTeX: "EKK" },
      { kind: "line", fn: (x) => (1 / E0 + x / MEC2) * 1000, color: "#64748b", dash: "4 3", label: "nazariya", texColor: "black!50", texFn: `${(1000 / E0).toFixed(6)} + ${(1000 / MEC2).toFixed(6)}*x`, domain: [0, xm], samples: 2, labelTeX: "nazariya" },
      { kind: "pts", data: a2.rows.map((r) => [r.x, r.inv * 1000]), color: PAL[1], label: "tajriba", texColor: TPAL[1], labelTeX: "tajriba" },
    ] } });
  const r0 = a2.rows[0];
  X.push({ t: "p", text: "**Hisoblash** (1-qator va eng kichik kvadratlar usuli):" });
  X.push({ t: "eq", lines: [
    `E' &= a + b k = ${fx(cal.a, 2)} + ${fx(cal.b, 4)}\\cdot ${fx(r0.ch, 1)} = ${fx(r0.E, 1)}\\ \\text{keV},\\qquad E'_{\\text{naz}}(${fx(r0.th, 0)}^\\circ) = ${fx(eScat(r0.th), 1)}\\ \\text{keV}`,
    `\\frac{1}{E'} &= (${sx(f.a, 4)} \\pm ${sx(Math.max(f.sa, 1e-8), 2)}) + (${sx(f.b, 4)} \\pm ${sx(Math.max(f.sb, 1e-8), 2)})\\,(1 - \\cos\\theta)\\ \\ \\text{keV}^{-1}`,
    `m_e c^2 &= \\frac{1}{${sx(f.b, 4)}} = (${fx(a2.mc2, 1)} \\pm ${fx(Math.max(a2.smc2, 0.1), 1)})\\ \\text{keV},\\qquad E_0 = \\frac{1}{${sx(f.a, 4)}} = (${fx(a2.E0, 1)} \\pm ${fx(Math.max(a2.sE0, 0.1), 1)})\\ \\text{keV}`,
    `\\lambda_C &= \\frac{hc}{m_e c^2} = \\frac{${fx(HC, 2)}\\ \\text{keV}\\cdot\\text{pm}}{${fx(a2.mc2, 1)}\\ \\text{keV}} = (${fx(a2.lc, 3)} \\pm ${fx(Math.max(a2.slc, 0.001), 3)})\\ \\text{pm}`,
  ] });
  X.push({ t: "p", text: `Jadval qiymatlari: $m_e c^2 = 511{,}0$ keV (farq $${fx((100 * (a2.mc2 - MEC2)) / MEC2, 1)}\\,\\%$), $E_0 = 661{,}7$ keV, $\\lambda_C = 2{,}426$ pm. Xatolik manbalari: hisob statistikasi, ROI chegaralari va fonni ayirish, detektorning burchak aperturasi (cho‘qqi kengayadi), kalibrovka xatoligi.` });
  S("Xulosa");
  docTail(X, nb, userText, [
    "• Sochilgan γ-kvant energiyasi burchak oshishi bilan kamayadi, $1/E'$ esa $(1 - \\cos\\theta)$ ga chiziqli bog‘liq — Kompton formulasi tasdiqlandi.",
    `• $m_e c^2 = ${fx(a2.mc2, 0)}$ keV, $E_0 = ${fx(a2.E0, 0)}$ keV, $\\lambda_C = ${fx(a2.lc, 3)}$ pm.`,
    "• Foton energiya va impulsga ega zarra kabi elektron bilan to‘qnashadi.",
  ], SITE);
  return { title: "Laboratoriya ishi. Kompton effektini o‘rganish", titlePlain: "Laboratoriya ishi. Kompton effekti", author: nb.f.name, sub: "γ-kvantlarning elektronlarda sochilishi va elektronning tinchlikdagi energiyasi", meta: docMeta(nb, userText), blocks: X };
}
