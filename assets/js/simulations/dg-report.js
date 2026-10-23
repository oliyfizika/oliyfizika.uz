// ==========================================================================
// Elektron difraksiyasi (Devisson–Jermer, grafit) — laboratoriya hisoboti mazmuni → labreport.js (KaTeX/PDF, LaTeX).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { H, K_NR, NI_D, GRAPHITE, dgCurrent } from "./dg-physics.js";

export const SITE_URL = "https://oliyfizika.uz/simulations/davisson-germer.html";
export const SITE_LABEL = "oliyfizika.uz/simulations/davisson-germer.html";
export const DOC_LABEL = "Virtual laboratoriya ishi · Atom fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const SUB = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d && m && y ? `${d}.${m}.${y}` : iso; };
const C = { blue: "#1d4ed8", orange: "#c2410c", green: "#15803d", purple: "#7e22ce" };
const PAL = ["#1d4ed8", "#c2410c", "#15803d", "#7e22ce", "#0e7490", "#be123c"], TPAL = ["ofblue", "orange!80!black", "green!50!black", "violet!80!black", "cyan!60!black", "red!70!black"];
const plain = (s) => s.replace(/\{,\}/g, ",").replace(/\\cdot 10\^\{(-?\d+)\}/g, (_, e) => `·10${SUP(e.replace("-", "−"))}`);

/** nb — daftar; A — analyzeDG; B — analyzeGr; flags {dg:[], gr:[]}; curves — {U: [[φ, I]]} yozib olingan I(φ) */
export function buildDGDoc(nb, A, B, flags, curves) {
  const now = new Date(), pad = (v) => String(v).padStart(2, "0");
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const hasA = A.ok && A.fit, hasB = B.ok && B.fit, X = [];
  let sec = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });

  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "Elektronlarning kristallda difraksiyalanishini kuzatib, de Broyl gipotezasini (zarrachalarning to‘lqin xossasini) tekshirish.",
    "Elektron to‘lqin uzunligining tezlatuvchi kuchlanishga bog‘liqligini o‘lchab, $\\lambda \\propto 1/\\sqrt{U}$ ekanini ko‘rsatish.",
    "Tajriba natijalaridan Plank doimiysi $h$ ni aniqlash.",
  ] });

  S("Qisqacha nazariya");
  X.push({ t: "p", text: "L. de Broyl (1924) gipotezasiga ko‘ra impulsi $p$ bo‘lgan har qanday zarra to‘lqin xossasiga ega. $U$ kuchlanish bilan tezlatilgan elektron uchun:" });
  X.push({ t: "eq", tag: 1, lines: ["\\lambda=\\frac{h}{p}=\\frac{h}{\\sqrt{2m_e eU}}=\\frac{1{,}226}{\\sqrt{U\\,[\\text{V}]}}\\ \\text{nm}"] });
  X.push({ t: "p", text: "Bu to‘lqin uzunligi kristall panjara davri bilan bir tartibda, shuning uchun kristall elektronlar uchun difraksion panjara vazifasini bajaradi. **Devisson–Jermer tajribasida** (1927) elektronlar nikel monokristalining sirtiga normal tushadi; sirtdagi atom qatorlari ($d = 0{,}215$ nm) qaytgan to‘lqinlarni $\\varphi$ burchak ostida kuchaytiradi:" });
  X.push({ t: "eq", tag: 2, lines: ["d\\sin\\varphi = n\\lambda,\\qquad n=1,2,\\ldots"] });
  X.push({ t: "p", text: "**Grafit plyonkada** (polikristall) mayda kristallchalar har xil yo‘nalgan, shuning uchun Bragg sharti bajariladigan yo‘nalishlar konus hosil qiladi va ekranda halqalar ko‘rinadi. Kichik burchaklarda ($L$ — plyonkadan ekrangacha masofa, $D$ — halqa diametri):" });
  X.push({ t: "eq", tag: 3, lines: ["2d\\sin\\theta=\\lambda,\\qquad \\operatorname{tg}2\\theta=\\frac{D}{2L}\\quad\\Rightarrow\\quad \\lambda\\approx\\frac{d\\,D}{2L}"] });
  X.push({ t: "p", text: "(1) dan $\\lambda = k/\\sqrt{U}$, bu yerda $k = h/\\sqrt{2m_e e}$. Demak, $\\lambda$ ning $1/\\sqrt{U}$ ga bog‘liqligi koordinata boshidan o‘tuvchi to‘g‘ri chiziq; uning qiyaligidan:" });
  X.push({ t: "eq", tag: 4, lines: ["h = k\\sqrt{2m_e e},\\qquad m_e = 9{,}109\\cdot 10^{-31}\\ \\text{kg},\\quad e = 1{,}602\\cdot 10^{-19}\\ \\text{C}"] });
  X.push({ t: "p", text: "Relyativistik tuzatma $\\left(1+eU/2m_ec^2\\right)^{-1/2}$ 100 V da $5\\cdot 10^{-5}$, 5 kV da $0{,}25\\,\\%$ — o‘lchash xatoligidan kichik." });

  S("Jihozlar (virtual qurilma)");
  X.push({ t: "list", items: [
    `Devisson–Jermer qurilmasi: vakuum kamera, elektron to‘pi ($U = 20\\ldots 100$ V), nikel monokristali (sirt qatorlari oralig‘i $d = ${fx(NI_D, 3)}$ nm), burchak shkalali aylanuvchi kollektor (Faradey silindri) va galvanometr.`,
    `Elektron-difraksion trubka: elektron to‘pi ($U = ${fx(GRAPHITE.Umin, 1)}\\ldots ${fx(GRAPHITE.Umax, 1)}$ kV), yupqa grafit plyonka ($d_1 = ${fx(GRAPHITE.d[0], 3)}$ nm, $d_2 = ${fx(GRAPHITE.d[1], 3)}$ nm), lyuminessent ekran ($L = ${GRAPHITE.L}$ mm), shtangensirkul (0,1 mm).`,
  ] });

  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "Devisson–Jermer qurilmasida kuchlanishni o‘rnating va kollektorni burab, galvanometr toki eng katta bo‘ladigan burchak $\\varphi_{\\max}$ ni toping (qutb diagrammasidagi «bo‘rtiq»). Kamida uch xil $U$ da takrorlang (1-jadval).",
    "Grafit trubkasida turli kuchlanishlarda ichki va tashqi halqalar diametrlari $D_1$, $D_2$ ni shtangensirkul bilan o‘lchang (2-jadval).",
    "(2) va (3) bo‘yicha $\\lambda$ ni hisoblang, (1) bilan solishtiring; $\\lambda(1/\\sqrt{U})$ grafigidan $k$ va (4) dan $h$ ni toping.",
  ] });

  // ---------------------------------------------------------------- 1-topshiriq
  if (A.rows.length) {
    S("1-topshiriq: Devisson–Jermer tajribasi");
    X.push({ t: "table", caption: `**1-jadval.** Difraksiya maksimumlari va elektron to‘lqin uzunligi ($d = ${fx(NI_D, 3)}$ nm)`,
      head: ["№", "$U$, V", "$\\varphi_{\\max},\\ ^\\circ$", "$n$", "$\\lambda = d\\sin\\varphi/n$, nm", "$\\lambda_{\\text{dB}} = h/\\sqrt{2m_eeU}$, nm", "Farq, %", "Tekshiruv"],
      rows: A.rows.map((r, i) => [String(i + 1), M(fx(r.U, 0)), M(fx(r.phi, 1)), M(String(r.n)), M(fx(r.lam, 4)), M(fx(r.lamDB, 4)), M(fx(100 * r.dev, 1)), flags.dg[i] ? "$\\checkmark$" : "--"]),
      note: "«Tekshiruv»: $\\checkmark$ — burchak qurilmadagi haqiqiy maksimumdan $\\pm 1{,}5^\\circ$ dan ko‘p farq qilmaydi." });
    const keys = Object.keys(curves || {}).map(Number).filter((u) => curves[u].length > 8).sort((a, b) => a - b).slice(-6);
    if (keys.length) {
      const imax = Math.max(...keys.flatMap((u) => curves[u].map((p) => p[1]))) * 1.12;
      X.push({ t: "fig", id: "dgI", caption: "**1-rasm.** Kollektor tokining burchakka bog‘liqligi (o‘lchangan). «Bo‘rtiq» — elektronlar difraksiyasi maksimumi; kuchlanish ortishi bilan u kichik burchaklarga siljiydi.", plot: {
        xmin: 10, xmax: 90, ymin: 0, ymax: imax, xticks: [10, 20, 30, 40, 50, 60, 70, 80, 90],
        xlab: `Kollektor burchagi ${it("φ")}, °`, ylab: `Kollektor toki ${it("I")}, nA`, xlabTeX: "Kollektor burchagi $\\varphi$, $^\\circ$", ylabTeX: "Kollektor toki $I$, nA",
        series: keys.map((u, i) => ({ kind: "line", data: curves[u].slice().sort((a, b) => a[0] - b[0]), color: PAL[i % 6], label: `${it("U")} = ${u} V`, texColor: TPAL[i % 6], labelTeX: `$U=${u}$ V` })),
      } });
    }
    if (hasA) {
      const xmax = Math.max(...A.rows.map((r) => r.x)) * 1.15;
      X.push({ t: "fig", id: "dgL", caption: "**2-rasm.** Elektron to‘lqin uzunligining $1/\\sqrt{U}$ ga bog‘liqligi: koordinata boshidan o‘tuvchi to‘g‘ri chiziq — de Broyl formulasi.", plot: {
        xmin: 0, xmax: xmax, ymin: 0, ymax: Math.ceil(Math.max(...A.rows.map((r) => r.lam), K_NR * xmax) * 1.1 * 100) / 100, legendPos: "north west",
        xlab: `1/√${it("U")}, V${SUP("−1/2")}`, ylab: `${it("λ")}, nm`, xlabTeX: "$1/\\sqrt{U}$, $\\mathrm{V^{-1/2}}$", ylabTeX: "$\\lambda$, nm",
        series: [
          { kind: "line", fn: (x) => A.fit.k * x, color: C.blue, label: `EKK: ${it("λ")} = ${plain(fx(A.fit.k, 3))}/√${it("U")}`, texColor: "ofblue", texFn: `${A.fit.k.toFixed(5)}*x`, domain: [0, xmax], samples: 2, labelTeX: `EKK: $\\lambda=${fx(A.fit.k, 3)}/\\sqrt{U}$` },
          { kind: "line", fn: (x) => K_NR * x, color: C.green, dash: "6 4", label: `de Broyl: ${it("λ")} = 1,226/√${it("U")}`, texColor: "green!50!black", dash2: true, texFn: `${K_NR.toFixed(5)}*x`, domain: [0, xmax], samples: 2, labelTeX: "de Broyl: $\\lambda=1{,}226/\\sqrt{U}$" },
          { kind: "pts", data: A.rows.map((r) => [r.x, r.lam]), color: C.orange, label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
        ] } });
      const r0 = A.rows[0];
      X.push({ t: "p", text: `**Hisoblash** (1-qator, $U = ${fx(r0.U, 0)}$ V):` });
      X.push({ t: "eq", lines: [
        `\\lambda &= \\frac{d\\sin\\varphi}{n} = \\frac{${fx(NI_D, 3)}\\ \\text{nm}\\cdot\\sin ${fx(r0.phi, 1)}^\\circ}{${r0.n}} = ${fx(r0.lam, 4)}\\ \\text{nm},\\qquad \\lambda_{\\text{dB}} = \\frac{1{,}226}{\\sqrt{${fx(r0.U, 0)}}}\\ \\text{nm} = ${fx(r0.lamDB, 4)}\\ \\text{nm}`,
        `k &= \\frac{\\sum_i \\lambda_i/\\sqrt{U_i}}{\\sum_i 1/U_i} = (${fx(A.fit.k, 4)} \\pm ${fx(Math.max(A.fit.sk, 1e-4), 4)})\\ \\text{nm}\\cdot\\text{V}^{1/2}`,
        `h &= k\\sqrt{2m_e e} = ${sx(A.fit.k * 1e-9, 4)}\\ \\text{m}\\cdot\\text{V}^{1/2}\\cdot ${sx(Math.sqrt(2 * 9.1093837015e-31 * 1.602176634e-19), 4)}\\ \\sqrt{\\text{kg}\\cdot\\text{C}} = (${sx(A.h, 3)} \\pm ${sx(Math.max(A.sh, 1e-37), 1)})\\ \\text{J}\\cdot\\text{s}`,
      ] });
      X.push({ t: "p", text: `Jadvaldagi qiymat $h = 6{,}626\\cdot 10^{-34}$ J·s; nisbiy farq $\\delta = ${fx((100 * (A.h - H)) / H, 1)}\\,\\%$.` });
    }
  }

  // ---------------------------------------------------------------- 2-topshiriq
  if (B.rows.length) {
    S("2-topshiriq: grafitda elektron difraksiyasi");
    X.push({ t: "table", caption: `**${A.rows.length ? 2 : 1}-jadval.** Difraksiya halqalari diametrlari ($L = ${GRAPHITE.L}$ mm, $d_1 = ${fx(GRAPHITE.d[0], 3)}$ nm, $d_2 = ${fx(GRAPHITE.d[1], 3)}$ nm)`,
      head: ["№", "$U$, kV", "$D_1$, mm", "$D_2$, mm", "$\\lambda_1 = d_1D_1/2L$, pm", "$\\lambda_2 = d_2D_2/2L$, pm", "$\\lambda_{\\text{dB}}$, pm", "Jurnal"],
      rows: B.rows.map((r, i) => [String(i + 1), M(fx(r.U, 2)), r.D1 !== null && Number.isFinite(r.D1) ? M(fx(r.D1, 1)) : "--", Number.isFinite(r.D2) ? M(fx(r.D2, 1)) : "--", r.l1 !== null ? M(fx(r.l1 * 1000, 2)) : "--", r.l2 !== null ? M(fx(r.l2 * 1000, 2)) : "--", M(fx(r.lamDB * 1000, 2)), flags.gr[i] ? "$\\checkmark$" : "--"]),
      note: "Jurnal: $\\checkmark$ — diametrlar shtangensirkul o‘lchovlari jurnalida bor. 1 pm $= 10^{-12}$ m." });
    if (hasB) {
      const xmax = Math.max(...B.rows.map((r) => r.x)) * 1.12;
      const ser = [];
      if (B.f1) ser.push({ kind: "line", fn: (x) => B.f1.k * x, color: C.blue, label: `${it("D")}${SUB("1")} = ${plain(fx(B.f1.k, 0))}/√${it("U")}`, texColor: "ofblue", texFn: `${B.f1.k.toFixed(3)}*x`, domain: [0, xmax], samples: 2, labelTeX: `$D_1=${fx(B.f1.k, 0)}/\\sqrt{U}$` },
        { kind: "pts", data: B.rows.filter((r) => Number.isFinite(r.D1)).map((r) => [r.x, r.D1]), color: C.blue, texColor: "ofblue" });
      if (B.f2) ser.push({ kind: "line", fn: (x) => B.f2.k * x, color: C.orange, label: `${it("D")}${SUB("2")} = ${plain(fx(B.f2.k, 0))}/√${it("U")}`, texColor: "orange!80!black", texFn: `${B.f2.k.toFixed(3)}*x`, domain: [0, xmax], samples: 2, labelTeX: `$D_2=${fx(B.f2.k, 0)}/\\sqrt{U}$` },
        { kind: "pts", data: B.rows.filter((r) => Number.isFinite(r.D2)).map((r) => [r.x, r.D2]), color: C.orange, texColor: "orange!80!black" });
      X.push({ t: "fig", id: "gr", caption: `**${A.rows.length ? 3 : 1}-rasm.** Halqa diametrlarining $1/\\sqrt{U}$ ga bog‘liqligi.`, plot: {
        xmin: 0, xmax: xmax, ymin: 0, ymax: Math.ceil(Math.max(...B.rows.map((r) => Math.max(r.D1 || 0, r.D2 || 0))) * 1.15 / 10) * 10, legendPos: "north west",
        xlab: `1/√${it("U")}, V${SUP("−1/2")}`, ylab: `${it("D")}, mm`, xlabTeX: "$1/\\sqrt{U}$, $\\mathrm{V^{-1/2}}$", ylabTeX: "$D$, mm", series: ser } });
      const lines = [];
      if (B.f1) lines.push(`k_1 &= \\frac{d_1 s_1}{2L} = \\frac{${fx(GRAPHITE.d[0], 3)}\\ \\text{nm}\\cdot ${fx(B.f1.k, 1)}\\ \\text{mm}\\cdot\\text{V}^{1/2}}{2\\cdot ${GRAPHITE.L}\\ \\text{mm}} = ${fx(B.k1, 4)}\\ \\text{nm}\\cdot\\text{V}^{1/2}`);
      if (B.f2) lines.push(`k_2 &= \\frac{d_2 s_2}{2L} = \\frac{${fx(GRAPHITE.d[1], 3)}\\cdot ${fx(B.f2.k, 1)}}{2\\cdot ${GRAPHITE.L}}\\ \\text{nm}\\cdot\\text{V}^{1/2} = ${fx(B.k2, 4)}\\ \\text{nm}\\cdot\\text{V}^{1/2}`);
      lines.push(`k &= ${fx(B.fit.k, 4)} \\pm ${fx(Math.max(B.fit.sk, 1e-4), 4)}\\ \\text{nm}\\cdot\\text{V}^{1/2}\\quad(\\lambda\\ \\text{o‘rtachalari bo‘yicha}),\\qquad h = k\\sqrt{2m_e e} = (${sx(B.h, 3)}\\pm ${sx(Math.max(B.sh, 1e-37), 1)})\\ \\text{J}\\cdot\\text{s}`);
      X.push({ t: "p", text: "**Hisoblash.** $D = s/\\sqrt{U}$ chiziqlarining qiyaliklari $s$ dan:" });
      X.push({ t: "eq", lines });
      X.push({ t: "p", text: `Nisbiy farq $\\delta = ${fx((100 * (B.h - H)) / H, 1)}\\,\\%$. Kichik burchak yaqinlashuvi va relyativistik tuzatma tashqi halqada $\\sim 1\\,\\%$ sistematik xatolik beradi.` });
    }
  }

  S("Xulosa");
  const box = ["**Hisob natijalari:**"];
  if (hasA) box.push(`• Devisson–Jermer: difraksiya maksimumi kuchlanish ortishi bilan kichik burchakka siljiydi; $\\lambda$ de Broyl formulasiga mos, $h = ${sx(A.h, 3)}$ J·s.`);
  if (hasB) box.push(`• Grafit: halqalar diametri $1/\\sqrt{U}$ ga proporsional; $h = ${sx(B.h, 3)}$ J·s.`);
  box.push("• Elektron to‘lqin xossasiga ega — de Broyl gipotezasi tasdiqlandi.");
  X.push({ t: "box", items: box });
  X.push({ t: "p", text: "**Bajaruvchining xulosasi:**" });
  userText(nb.f.conclusion.trim()).split(/\n+/).forEach((par) => X.push({ t: "p", text: par }));
  X.push({ t: "sign", items: ["Bajaruvchi imzosi", "O‘qituvchi imzosi va bahosi"] });
  X.push({ t: "link", url: SITE_URL, label: SITE_LABEL, text: "Ushbu ish OliyFizika.uz virtual laboratoriyasida bajarildi. Laboratoriyani ochish:" });

  return {
    title: "Laboratoriya ishi. Elektron difraksiyasi (Devisson–Jermer tajribasi)",
    titlePlain: "Laboratoriya ishi. Elektron difraksiyasi (Devisson-Jermer tajribasi)",
    author: nb.f.name,
    sub: "De Broyl gipotezasini tekshirish va Plank doimiysini aniqlash",
    meta: [["Bajaruvchi:", userText(nb.f.name)], ["Guruh / sinf:", userText(nb.f.group || "—")], ["Muassasa:", userText(nb.f.school || "—")], ["O‘qituvchi:", userText(nb.f.teacher || "—")], ["Bajarilgan sana:", fmtDate(nb.f.date)], ["Hisobot yaratildi:", created]],
    blocks: X,
  };
}
export { dgCurrent };
