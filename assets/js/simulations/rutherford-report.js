// ==========================================================================
// Rezerford tajribasi — laboratoriya hisoboti mazmuni (hujjat modeli). labreport.js uni KaTeX’li HTML (→ PDF)
// va LaTeX (.tex) ko‘rinishida chiqaradi. Hisoblashlar raqamlar qo‘yilgan holda, LaTeX formulalari bilan.
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { MATERIALS, SOURCES, APP, KE2, areal, dOmega, atomsPerCm3 } from "./rutherford-physics.js";
import { sin4 } from "./rutherford-lab.js";

export const SITE_URL = "https://oliyfizika.uz/simulations/rutherford.html";
export const SITE_LABEL = "oliyfizika.uz/simulations/rutherford.html";
export const DOC_LABEL = "Virtual laboratoriya ishi · Atom fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`; // matndagi formula
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d && m && y ? `${d}.${m}.${y}` : iso; };
const C = { blue: "#1d4ed8", orange: "#c2410c", green: "#15803d" };

/** nb — daftar, A — analyze(), F — analyzeFoils(), flags — {t1: [bool], t2: [bool]} */
export function buildRutherfordDoc(nb, A, F, flags) {
  const m = A.mat, src = SOURCES[A.cond.src], tUm = A.cond.tUm, nt = areal(m, tUm), dO = dOmega(), E = A.E;
  const now = new Date(), pad = (v) => String(v).padStart(2, "0");
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const nOk = flags.t1.filter(Boolean).length;
  const B = [];

  B.push({ t: "sec", text: "1. Ishning maqsadi" });
  B.push({ t: "list", items: [
    `$\\alpha$-zarralar yupqa metall folgada sochilganda detektor sanog‘ining sochilish burchagi $\\theta$ ga bog‘liqligini o‘lchab, Rezerford formulasini tekshirish.`,
    "Tajriba natijalaridan folga moddasi atom yadrosining zaryad soni $Z$ ni aniqlash.",
    "Yadro o‘lchamining yuqori chegarasini baholash.",
  ] });

  B.push({ t: "sec", text: "2. Jihozlar (virtual qurilma)" });
  B.push({ t: "list", items: [
    `$\\alpha$-manba: ${src.name}, $\\alpha$-zarralar energiyasi $E = ${fx(src.E, 3)}$ MeV; qo‘rg‘oshin kollimator ingichka dasta hosil qiladi.`,
    `Yupqa folga: ${m.name.toLowerCase()} (${m.id}), $Z = ${m.Z}$, $A = ${fx(m.A, 2)}$, $\\rho = ${fx(m.rho, 2)}$ g/cm$^3$, qalinligi $t_f = ${fx(tUm, 1)}$ µm.`,
    "Aylanuvchi tirgakdagi detektor va sanagich, burchak shkalasi (goniometr).",
    "Vakuum kamera va nasos (havoda $\\alpha$-zarralar bir necha santimetrda to‘xtaydi).",
  ] });
  B.push({ t: "table", caption: "**1-jadval.** Qurilma parametrlari", head: ["Kattalik", "Belgisi", "Qiymati"], rows: [
    ["Dasta intensivligi (folgaga tushuvchi)", "$I_0$", `$${sx(APP.I0, 2)}\\ \\mathrm{s^{-1}}$`],
    ["Folga — detektor masofasi", "$L$", `$${fx(APP.L, 1)}$ cm`],
    ["Detektor tirqishi yuzasi", "$S$", `$${fx(APP.Ad, 2)}\\ \\mathrm{cm^2}$`],
    ["Detektorning fazoviy burchagi", "$\\Delta\\Omega = S/L^2$", `$${sx(dO, 3)}$ sr`],
    ["Atomlar konsentratsiyasi", "$n_a = \\rho N_A / A$", `$${sx(atomsPerCm3(m), 3)}\\ \\mathrm{cm^{-3}}$`],
    ["Folganing yuza zichligi", "$n_a t_f$", `$${sx(nt, 3)}\\ \\mathrm{cm^{-2}}$`],
    ["$\\alpha$-zarra zaryad soni", "$z$", "$2$"],
    ["Doimiylik", "$ke^2 = e^2/(4\\pi\\varepsilon_0)$", `$${fx(KE2, 3)}\\ \\mathrm{MeV\\cdot fm}$`],
  ] });

  B.push({ t: "sec", text: "3. Qisqacha nazariya" });
  B.push({ t: "p", text: "E. Rezerford (1911) modeliga ko‘ra atomning musbat zaryadi va deyarli butun massasi juda kichik yadroda to‘plangan. $\\alpha$-zarra yadroning Kulon maydonida giperbola bo‘ylab harakatlanadi. Bitta yadroda sochilishning differensial kesimi:" });
  B.push({ t: "eq", tag: 1, lines: ["\\frac{d\\sigma}{d\\Omega}=\\left(\\frac{zZ\\,ke^2}{4E}\\right)^{2}\\frac{1}{\\sin^{4}(\\theta/2)}"] });
  B.push({ t: "p", text: "Detektorga 1 s da tushadigan zarralar soni (sanoq tezligi) va undan kelib chiqadigan o‘zgarmas kattalik $K$:" });
  B.push({ t: "eq", tag: 2, lines: ["n(\\theta)=\\frac{N}{t}=I_0\\,n_a t_f\\,\\Delta\\Omega\\,\\frac{d\\sigma}{d\\Omega}"] });
  B.push({ t: "eq", tag: 3, lines: ["K=n(\\theta)\\,\\sin^{4}\\frac{\\theta}{2}=I_0\\,n_a t_f\\,\\Delta\\Omega\\left(\\frac{zZ\\,ke^2}{4E}\\right)^{2}=\\mathrm{const}"] });
  B.push({ t: "p", text: "Demak, model to‘g‘ri bo‘lsa, barcha burchaklarda $K$ bir xil chiqadi, $\\ln n$ ning $\\ln\\left(1/\\sin^4(\\theta/2)\\right)$ ga bog‘liqligi esa qiyaligi $m = 1$ bo‘lgan to‘g‘ri chiziq bo‘ladi. (3) dan yadro zaryadi:" });
  B.push({ t: "eq", tag: 4, lines: ["Z=\\frac{4E}{z\\,ke^2}\\sqrt{\\frac{K}{I_0\\,n_a t_f\\,\\Delta\\Omega}}"] });
  B.push({ t: "p", text: "Nishon masofasi $b$, sochilish burchagi va zarraning yadroga eng yaqin masofasi:" });
  B.push({ t: "eq", tag: 5, lines: ["\\operatorname{tg}\\frac{\\theta}{2}=\\frac{d}{2b},\\qquad d=\\frac{zZ\\,ke^2}{E},\\qquad r_{\\min}=\\frac{d}{2}\\left(1+\\frac{1}{\\sin(\\theta/2)}\\right)"] });
  B.push({ t: "p", text: "Sanoq tasodifiy kattalik (Puasson taqsimoti), uning standart xatoligi $\\Delta N=\\sqrt{N}$." });

  B.push({ t: "sec", text: "4. Ishni bajarish tartibi" });
  B.push({ t: "list", ordered: true, items: [
    "Vakuum nasosini yoqing va kameradagi bosim $\\sim 1$ Pa gacha tushishini kuting.",
    `Folga (${m.id}, $t_f = ${fx(tUm, 1)}$ µm) va manbani (${src.name}) tanlang.`,
    "Detektorni $\\theta$ burchakka qo‘ying, sanash vaqtini $N \\gtrsim 20$ bo‘ladigan qilib tanlang va sanashni boshlang. Natija o‘lchovlar jurnaliga yoziladi.",
    `O‘lchashni $15^\\circ$–$150^\\circ$ oralig‘idagi kamida beshta burchakda takrorlang; natijalarni 2-jadvalga yozing.`,
    "$n$, $\\sin^4(\\theta/2)$, $K$ ni hisoblang, grafiklarni chizing, $\\bar K$, qiyalik $m$ va $Z$ ni toping.",
  ] });

  B.push({ t: "sec", text: "5. O‘lchash natijalari" });
  B.push({ t: "table", caption: `**2-jadval.** Sanoqning sochilish burchagiga bog‘liqligi (${m.id}, $t_f = ${fx(tUm, 1)}$ µm, $E = ${fx(E, 3)}$ MeV)`,
    head: ["№", "$\\theta,\\ ^\\circ$", "$t$, s", "$N$", "$n=N/t$, $\\mathrm{s^{-1}}$", "$\\Delta n$, $\\mathrm{s^{-1}}$", "$\\sin^4(\\theta/2)$", "$K$, $\\mathrm{s^{-1}}$", "$\\Delta K$, $\\mathrm{s^{-1}}$", "Jurnal"],
    rows: A.rows.map((r, i) => [String(i + 1), M(fx(r.th, 0)), M(fx(r.t, 0)), M(String(r.N)), M(sx(r.n, 3)), M(sx(r.sn, 2)), M(sx(r.s4, 3)), M(sx(r.K, 3)), M(sx(r.sK, 2)), flags.t1[i] ? "$\\checkmark$" : "--"]),
    hl: A.rows.map((r) => Math.abs(r.sig) > 3),
    note: `Izoh: $\\Delta n=\\sqrt{N}/t$, $\\Delta K=K/\\sqrt{N}$. «Jurnal» ustunida $\\checkmark$ — qiymat qurilmaning o‘lchovlar jurnalidagi yozuv bilan mos (${nOk} / ${A.rows.length}).` });

  // Grafiklar
  B.push({ t: "sec", text: "6. Natijalarni qayta ishlash" });
  const thMin = Math.min(...A.rows.map((r) => Math.abs(r.th)));
  const lo = Math.min(...A.rows.map((r) => r.n - r.sn).filter((v) => v > 0), A.K) / 2;
  const hi = Math.max(...A.rows.map((r) => r.n + r.sn), A.K / sin4(Math.max(4, thMin - 4))) * 1.5;
  const ymin = 10 ** Math.floor(Math.log10(lo)), ymax = 10 ** Math.ceil(Math.log10(hi));
  B.push({ t: "fig", id: "f1", caption: "**1-rasm.** Sanoq tezligining sochilish burchagiga bog‘liqligi (logarifmik shkala). Chiziq — (2) formula, $\\bar K$ tajribadan.", plot: {
    xmin: 0, xmax: 180, ymin, ymax, ylog: true, xticks: [0, 30, 60, 90, 120, 150, 180],
    xlab: `Sochilish burchagi ${it("θ")}, °`, ylab: `${it("n")} = ${it("N")}/${it("t")}, s${SUP("−1")}`,
    xlabTeX: "Sochilish burchagi $\\theta$, $^\\circ$", ylabTeX: "$n=N/t$, $\\mathrm{s^{-1}}$",
    series: [
      { kind: "line", fn: (th) => (th > 1 ? A.K / sin4(th) : NaN), color: C.blue, label: `Rezerford formulasi, ${it("K")} = const`, texColor: "ofblue", texFn: `${Number(A.K.toPrecision(6))}/(sin(x/2))^4`, domain: [Math.max(2, thMin - 4), 178], labelTeX: "$n=\\bar K/\\sin^4(\\theta/2)$" },
      { kind: "pts", data: A.rows.map((r) => [Math.abs(r.th), r.n, Math.max(r.n - r.sn, ymin / 10), r.n + r.sn]), color: C.orange, label: `tajriba (±Δ${it("n")})`, texColor: "orange!80!black", labelTeX: "tajriba ($\\pm\\Delta n$)" },
    ] } });
  if (A.fit) {
    const xs = A.rows.map((r) => Math.log(r.inv)), ys = A.rows.map((r) => Math.log(r.n)), e = A.rows.map((r) => 1 / Math.sqrt(r.N));
    const xmin = Math.floor(Math.min(...xs) - 0.3), xmax = Math.ceil(Math.max(...xs) + 0.3);
    const ymn = Math.floor(Math.min(...ys.map((v, i) => v - e[i]), A.fit.m * xmin + A.fit.c) - 0.3), ymx = Math.ceil(Math.max(...ys.map((v, i) => v + e[i]), A.fit.m * xmax + A.fit.c) + 0.3);
    B.push({ t: "fig", id: "f2", caption: `**2-rasm.** Chiziqlashtirilgan bog‘lanish $\\ln n = m\\ln\\left(1/\\sin^4(\\theta/2)\\right) + c$. Nazariya: $m = 1$.`, plot: {
      xmin, xmax, ymin: ymn, ymax: ymx, legendPos: "north west",
      xlab: `ln(1 / sin${SUP("4")}(${it("θ")}/2))`, ylab: `ln ${it("n")}`, xlabTeX: "$\\ln\\left(1/\\sin^4(\\theta/2)\\right)$", ylabTeX: "$\\ln n$",
      series: [
        { kind: "line", fn: (v) => A.fit.m * v + A.fit.c, color: C.blue, label: `eng kichik kvadratlar: ${it("m")} = ${fx(A.fit.m, 3).replace("{,}", ",")} ± ${fx(A.fit.sm, 3).replace("{,}", ",")}`, texColor: "ofblue", texFn: `${Number(A.fit.m.toPrecision(6))}*x + (${Number(A.fit.c.toPrecision(6))})`, domain: [xmin, xmax], samples: 2, labelTeX: `$m=${fx(A.fit.m, 3)}\\pm${fx(A.fit.sm, 3)}$` },
        { kind: "line", fn: (v) => v + Math.log(A.K), color: C.green, dash: "6 4", label: `nazariya: ${it("m")} = 1`, texColor: "green!50!black", dash2: true, texFn: `x + (${Number(Math.log(A.K).toPrecision(6))})`, domain: [xmin, xmax], samples: 2, labelTeX: "nazariya: $m=1$" },
        { kind: "pts", data: A.rows.map((r, i) => [xs[i], ys[i], ys[i] - e[i], ys[i] + e[i]]), color: C.orange, label: `tajriba (±1/√${it("N")})`, texColor: "orange!80!black", labelTeX: "tajriba ($\\pm 1/\\sqrt{N}$)" },
      ] } });
  }

  B.push({ t: "p", text: "**a) $K$ ning vaznli o‘rtacha qiymati** (har bir nuqtaning vazni $1/\\Delta K_i^2$):" });
  B.push({ t: "eq", lines: [
    `\\bar K &= \\frac{\\sum_i K_i/\\Delta K_i^2}{\\sum_i 1/\\Delta K_i^2} = ${sx(A.K, 4)}\\ \\mathrm{s^{-1}},\\qquad \\Delta\\bar K=\\frac{1}{\\sqrt{\\sum_i 1/\\Delta K_i^2}}=${sx(A.sK, 2)}\\ \\mathrm{s^{-1}}`,
    `\\bar K &= (${sx(A.K, 3)}\\pm ${sx(A.sK, 2)})\\ \\mathrm{s^{-1}},\\qquad \\varepsilon=\\frac{\\Delta\\bar K}{\\bar K}=${fx((100 * A.sK) / A.K, 1)}\\,\\%`,
    `\\frac{\\chi^2}{n-1} &= \\frac{1}{n-1}\\sum_i\\left(\\frac{K_i-\\bar K}{\\Delta K_i}\\right)^2=\\frac{${fx(A.chi2, 2)}}{${A.dof}}=${fx(A.chi2 / Math.max(1, A.dof), 2)}`,
  ] });
  B.push({ t: "p", text: `$\\chi^2/(n-1)\\approx 1$ bo‘lsa, $K_i$ larning farqi faqat statistik xatolik bilan tushuntiriladi, ya’ni $K$ burchakka bog‘liq emas.` });
  if (A.fit) {
    const dev = Math.abs(A.fit.m - 1) / A.fit.sm, ok = dev <= 2;
    B.push({ t: "p", text: "**b) Chiziqlash.** $y=\\ln n$, $x=\\ln\\left(1/\\sin^4(\\theta/2)\\right)$ nuqtalar eng kichik kvadratlar usuli bilan to‘g‘ri chiziqqa yaqinlashtirildi (vazn $N_i$, chunki $\\Delta(\\ln n)=1/\\sqrt N$):" });
    B.push({ t: "eq", lines: [
      `m &= ${fx(A.fit.m, 3)} \\pm ${fx(A.fit.sm, 3)},\\qquad c = ${fx(A.fit.c, 3)} \\pm ${fx(A.fit.sc, 3)}`,
      `\\frac{|m-1|}{\\Delta m} &= \\frac{${fx(Math.abs(A.fit.m - 1), 3)}}{${fx(A.fit.sm, 3)}} = ${fx(dev, 1)}\\ ${ok ? "\\le 2" : "> 2"}`,
    ] });
    B.push({ t: "p", text: ok ? "Qiyalik nazariy qiymat $m=1$ bilan xatolik chegarasida mos keladi: $n\\propto 1/\\sin^4(\\theta/2)$ bog‘lanish tasdiqlandi." : "Qiyalik $m=1$ dan xatolikdan ko‘proq farq qiladi — o‘lchovlarni (ayniqsa kichik $N$ li nuqtalarni) qayta tekshirish tavsiya etiladi." });
  }
  const a = Math.sqrt(A.K / (APP.I0 * nt * dO * 1e-26));
  B.push({ t: "p", text: "**c) Yadro zaryad soni** (4) formula bo‘yicha:" });
  B.push({ t: "eq", lines: [
    `\\frac{zZ\\,ke^2}{4E} &= \\sqrt{\\frac{\\bar K}{I_0\\,n_a t_f\\,\\Delta\\Omega}} = \\sqrt{\\frac{${sx(A.K, 3)}}{${sx(APP.I0, 2)}\\cdot ${sx(nt, 3)}\\cdot ${sx(dO, 3)}}}\\ \\mathrm{cm} = ${sx(a * 1e-13, 3)}\\ \\mathrm{cm} = ${fx(a, 2)}\\ \\mathrm{fm}`,
    `Z &= \\frac{4E}{z\\,ke^2}\\cdot ${fx(a, 2)}\\ \\mathrm{fm} = \\frac{4\\cdot ${fx(E, 3)}\\ \\mathrm{MeV}\\cdot ${fx(a, 2)}\\ \\mathrm{fm}}{2\\cdot ${fx(KE2, 3)}\\ \\mathrm{MeV\\cdot fm}} = ${fx(A.Z, 1)}`,
    `\\Delta Z &= \\frac{Z}{2}\\cdot\\frac{\\Delta\\bar K}{\\bar K} = ${fx(A.sZ, 1)},\\qquad Z = ${fx(A.Z, 1)}\\pm ${fx(A.sZ, 1)}\\quad (\\text{jadvalda } Z_{\\mathrm{${m.id}}} = ${m.Z})`,
  ] });
  B.push({ t: "p", text: `Nisbiy farq: $\\delta = (Z - Z_{\\mathrm{${m.id}}})/Z_{\\mathrm{${m.id}}} = ${fx((100 * (A.Z - m.Z)) / m.Z, 1)}\\,\\%$.` });
  B.push({ t: "p", text: `**d) Yadro o‘lchamini baholash.** Eng katta burchakda ($\\theta_{\\max} = ${fx(A.thMax, 0)}^\\circ$) ham (1) formula bajarildi, demak $\\alpha$-zarra yadroga $r_{\\min}$ gacha yaqinlashganda ham unga faqat Kulon kuchi ta’sir qilgan:` });
  B.push({ t: "eq", lines: [
    `d &= \\frac{zZ\\,ke^2}{E} = \\frac{2\\cdot ${m.Z}\\cdot ${fx(KE2, 3)}}{${fx(E, 3)}}\\ \\mathrm{fm} = ${fx(A.d, 1)}\\ \\mathrm{fm}`,
    `r_{\\min} &= \\frac{d}{2}\\left(1+\\frac{1}{\\sin(\\theta_{\\max}/2)}\\right) = \\frac{${fx(A.d, 1)}}{2}\\left(1+\\frac{1}{\\sin ${fx(A.thMax / 2, 0)}^\\circ}\\right)\\ \\mathrm{fm} = ${fx(A.rmin, 1)}\\ \\mathrm{fm}`,
  ] });
  B.push({ t: "p", text: `Demak, yadro radiusi $R < ${fx(A.rmin, 0)}\\ \\mathrm{fm} \\approx ${sx(A.rmin * 1e-15, 2)}$ m. Taqqoslash uchun: $R \\approx 1{,}2\\,A^{1/3}\\ \\mathrm{fm} = ${fx(A.R, 1)}$ fm, atom radiusi esa $\\sim 10^{-10}$ m — yadro atomdan taxminan $10^4$ marta kichik.` });

  let sec = 7;
  if (F.length) {
    B.push({ t: "sec", text: `${sec++}. Boshqa folgalar bilan o‘lchash` });
    B.push({ t: "table", caption: "**3-jadval.** Turli moddalar yadrosining zaryad soni", head: ["№", "Folga", "$t_f$, µm", "$E$, MeV", "$\\theta,\\ ^\\circ$", "$t$, s", "$N$", "$Z$ (tajriba)", "$Z$ (jadval)", "Jurnal"],
      rows: F.map((r, i) => [String(i + 1), r.mat, M(fx(r.tUm, 1)), M(fx(r.E, 2)), M(fx(r.th, 0)), M(fx(r.t, 0)), M(String(r.N)), M(`${fx(r.Z, 1)}\\pm ${fx(r.sZ, 1)}`), M(String(r.Ztrue)), flags.t2[i] ? "$\\checkmark$" : "--"]),
      note: "$Z$ har bir folga uchun (4) formula bilan alohida hisoblangan; $\\Delta Z = Z/(2\\sqrt N)$. Sochilish yadro zaryadining kvadratiga proporsional: $n\\propto Z^2$." });
  }

  B.push({ t: "sec", text: `${sec}. Xulosa` });
  const okSlope = A.fit ? Math.abs(A.fit.m - 1) <= 2 * A.fit.sm : true, okZ = Math.abs(A.Z - m.Z) <= 2 * A.sZ + 0.02 * m.Z;
  B.push({ t: "box", items: [
    "**Hisob natijalari:**",
    `• $K = n\\sin^4(\\theta/2)$ ${A.rows.length} ta burchakda o‘lchandi: $\\bar K = (${sx(A.K, 3)}\\pm${sx(A.sK, 2)})\\ \\mathrm{s^{-1}}$, $\\chi^2/(n-1) = ${fx(A.chi2 / Math.max(1, A.dof), 2)}$.`,
    A.fit ? `• Chiziqlash qiyaligi $m = ${fx(A.fit.m, 3)}\\pm${fx(A.fit.sm, 3)}$ — ${okSlope ? "Rezerford formulasi tasdiqlandi" : "$m=1$ dan farq bor"}.` : "",
    `• Yadro zaryad soni $Z = ${fx(A.Z, 1)}\\pm${fx(A.sZ, 1)}$ (${m.id} uchun ${m.Z}) — ${okZ ? "mos keladi" : "farq bor"}; yadro radiusi $R < ${fx(A.rmin, 0)}$ fm.`,
  ].filter(Boolean) });
  B.push({ t: "p", text: "**Bajaruvchining xulosasi:**" });
  userText(nb.f.conclusion.trim()).split(/\n+/).forEach((par) => B.push({ t: "p", text: par }));
  B.push({ t: "sign", items: ["Bajaruvchi imzosi", "O‘qituvchi imzosi va bahosi"] });
  B.push({ t: "link", url: SITE_URL, label: SITE_LABEL, text: "Ushbu ish OliyFizika.uz virtual laboratoriyasida bajarildi. Laboratoriyani ochish:" });

  return {
    title: "Laboratoriya ishi. Rezerford tajribasi",
    titlePlain: "Laboratoriya ishi. Rezerford tajribasi",
    author: nb.f.name,
    sub: "$\\alpha$-zarralarning yupqa metall folgada sochilishini o‘rganish va atom yadrosi zaryadini aniqlash",
    meta: [["Bajaruvchi:", userText(nb.f.name)], ["Guruh / sinf:", userText(nb.f.group || "—")], ["Muassasa:", userText(nb.f.school || "—")], ["O‘qituvchi:", userText(nb.f.teacher || "—")], ["Bajarilgan sana:", fmtDate(nb.f.date)], ["Hisobot yaratildi:", created]],
    blocks: B,
  };
}
