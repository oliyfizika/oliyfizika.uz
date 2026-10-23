// ==========================================================================
// Bor postulatlari — laboratoriya hisoboti mazmuni (hujjat modeli → labreport.js: KaTeX HTML/PDF va LaTeX).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { GASES, GRATINGS, R_H, RY_EV, HC_EV_NM, levelEv } from "./bohr-physics.js";

export const SITE_URL = "https://oliyfizika.uz/simulations/bohr.html";
export const SITE_LABEL = "oliyfizika.uz/simulations/bohr.html";
export const DOC_LABEL = "Virtual laboratoriya ishi · Atom fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const SUB = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d && m && y ? `${d}.${m}.${y}` : iso; };
const C = { blue: "#1d4ed8", orange: "#c2410c", green: "#15803d", gray: "#64748b" };
const plain = (s) => s.replace(/\{,\}/g, ",").replace(/\\cdot 10\^\{(-?\d+)\}/g, (_, e) => `·10${SUP(e.replace("-", "−"))}`);

/** nb — daftar; A — analyzeFH; B — analyzeBalmer; flags {fh:[bool], bal:[bool]}; rec — I(U) yozuvi [[U, I]] */
export function buildBohrDoc(nb, A, B, flags, rec) {
  const now = new Date(), pad = (v) => String(v).padStart(2, "0");
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const g = A.gas, gr = GRATINGS[B.cond.gr], X = [];
  const hasA = A.ok && A.fit, hasB = B.ok && B.fit;

  X.push({ t: "sec", text: "1. Ishning maqsadi" });
  X.push({ t: "list", items: [
    "Frank–Gers tajribasida atomlar energiyani faqat aniq porsiyalar bilan yutishini (statsionar holatlar mavjudligini — Borning 1-postulatini) tekshirish va atomning birinchi uyg‘otish energiyasini aniqlash.",
    "Vodorod atomi spektrining Balmer seriyasi chiziqlarini difraksion panjara yordamida o‘lchab, chastotalar qoidasini (Borning 2-postulatini) va Bor formulasini tekshirish, Ridberg doimiysi $R$ ni aniqlash.",
    "Vodorod atomining ionlanish energiyasini hisoblash.",
  ] });

  X.push({ t: "sec", text: "2. Qisqacha nazariya" });
  X.push({ t: "p", text: "**Borning 1-postulati (statsionar holatlar).** Atom faqat ma’lum energiyali $E_1, E_2, \\ldots$ statsionar holatlarda bo‘la oladi va bu holatlarda nurlanmaydi. Vodorod atomi uchun elektron orbitasining impuls momenti kvantlangan:" });
  X.push({ t: "eq", tag: 1, lines: ["m_e v r_n = n\\hbar,\\qquad E_n = -\\frac{hcR}{n^2} = -\\frac{13{,}6\\ \\text{eV}}{n^2},\\qquad n = 1, 2, 3, \\ldots"] });
  X.push({ t: "p", text: "**Borning 2-postulati (chastotalar qoidasi).** Atom bir statsionar holatdan ikkinchisiga o‘tganda energiyalar farqiga teng bitta foton chiqaradi (yutadi):" });
  X.push({ t: "eq", tag: 2, lines: ["h\\nu = \\frac{hc}{\\lambda} = E_n - E_m"] });
  X.push({ t: "p", text: "(1) va (2) dan vodorod spektrining seriyaviy formulasi kelib chiqadi; $m = 2$ — ko‘rinadigan Balmer seriyasi:" });
  X.push({ t: "eq", tag: 3, lines: ["\\frac{1}{\\lambda} = R\\left(\\frac{1}{m^2} - \\frac{1}{n^2}\\right),\\qquad \\frac{1}{\\lambda} = R\\left(\\frac{1}{4} - \\frac{1}{n^2}\\right),\\quad n = 3, 4, 5, 6"] });
  X.push({ t: "p", text: "Difraksion panjarada ($d$ — panjara davri) $k$-tartibli maksimum sharti va undan to‘lqin uzunligi:" });
  X.push({ t: "eq", tag: 4, lines: ["d\\sin\\varphi = k\\lambda,\\qquad \\lambda = \\frac{d\\sin\\varphi}{k},\\qquad \\varphi = \\frac{\\varphi_{\\text{o‘ng}} - \\varphi_{\\text{chap}}}{2}"] });
  X.push({ t: "p", text: "**Frank–Gers tajribasi.** Katoddan chiqqan elektronlar simob bug‘ida $U$ kuchlanish bilan tezlashtiriladi. Elektron energiyasi $eU$ atomning birinchi uyg‘otish energiyasi $E_1$ ga yetganda u energiyasini atomga beradi va tormozlovchi to‘siqdan o‘ta olmaydi — anod toki keskin kamayadi. Shu sababli tok maksimumlari teng oraliqlarda takrorlanadi:" });
  X.push({ t: "eq", tag: 5, lines: ["U_k = U_0 + k\\,\\Delta U,\\qquad E_1 = e\\,\\Delta U,\\qquad \\lambda_1 = \\frac{hc}{e\\,\\Delta U}"] });
  X.push({ t: "p", text: "$U_0$ kontakt potensiallar farqi va tormozlovchi kuchlanishni o‘z ichiga oladi, shuning uchun $E_1$ maksimumlar orasidagi masofadan topiladi. Uyg‘ongan simob atomi $\\lambda = 253{,}7$ nm li ultrabinafsha foton chiqaradi." });

  X.push({ t: "sec", text: "3. Jihozlar (virtual qurilma)" });
  X.push({ t: "list", items: [
    `Frank–Gers trubkasi: qizdiriladigan katod, to‘r, anod; ichida ${g.name.toLowerCase()} (${g.id})${g.id === "Hg" ? ` bug‘i, pech harorati $T = ${A.cond.T}\\,^\\circ$C` : ""}; tezlatuvchi manba $0\\ldots ${g.Umax}$ V, tormozlovchi kuchlanish $U_r = ${fx(A.cond.Ur, 1)}$ V, nanoampermetr.`,
    `Spektrometr: vodorod spektral lampasi, kollimator, difraksion panjara ($N = ${gr.id}$ chiziq/mm, $d = ${fx(gr.d * 1e6, 4)}$ µm), goniometrli teleskop (shkala aniqligi $0{,}01^\\circ$).`,
  ] });

  X.push({ t: "sec", text: "4. Ishni bajarish tartibi" });
  X.push({ t: "list", ordered: true, items: [
    "Frank–Gers qurilmasida tezlatuvchi kuchlanishni asta oshirib, anod tokini kuzating (yoki avtomatik skanerlang) va $I(U)$ egri chizig‘ini yozib oling.",
    "Tok maksimumlari to‘g‘ri keladigan kuchlanishlar $U_1, U_2, \\ldots$ ni aniqlab, 1-jadvalga yozing.",
    "Spektrometrda teleskopni burab, har bir spektral chiziqni ko‘rish maydonidagi vizir chizig‘iga keltiring; chap ($\\varphi_{\\text{chap}}$) va o‘ng ($\\varphi_{\\text{o‘ng}}$) tomondagi burchaklarni yozing (2-jadval).",
    "(4) va (3) formulalar bilan $\\lambda$ va $R$ ni, (5) bilan $E_1$ ni hisoblang; grafiklarni chizing va xulosa qiling.",
  ] });

  // ---------------------------------------------------------------- 1-topshiriq
  X.push({ t: "sec", text: "5. 1-topshiriq: Frank–Gers tajribasi" });
  X.push({ t: "table", caption: `**1-jadval.** Anod toki maksimumlariga mos kuchlanishlar (${g.id}${g.id === "Hg" ? `, $T = ${A.cond.T}\\,^\\circ$C` : ""}, $U_r = ${fx(A.cond.Ur, 1)}$ V)`,
    head: ["Maksimum $k$", "$U_k$, V", "$\\Delta U_k = U_k - U_{k-1}$, V", "Tekshiruv"],
    rows: A.rows.map((r, i) => [M(String(r.k)), M(fx(r.U, 2)), r.dU === null ? "--" : M(fx(r.dU, 2)), flags.fh[i] ? "$\\checkmark$" : "--"]),
    note: "«Tekshiruv» ustunida $\\checkmark$ — qiymat qurilmadagi haqiqiy maksimumdan $\\pm 0{,}3$ V dan ko‘p farq qilmaydi." });
  if (rec && rec.length > 5) {
    const step = Math.max(1, Math.ceil(rec.length / 260)), pts = rec.filter((_, i) => i % step === 0).sort((a, b) => a[0] - b[0]);
    const imax = Math.max(...pts.map((p) => p[1])) * 1.12, umax = Math.max(g.Umax, ...pts.map((p) => p[0]));
    X.push({ t: "fig", id: "fh", caption: "**1-rasm.** Anod tokining tezlatuvchi kuchlanishga bog‘liqligi (o‘lchangan). Punktir — 1-jadvaldagi maksimumlar.", plot: {
      xmin: 0, xmax: umax, ymin: 0, ymax: imax, legendPos: "north west",
      xlab: `Tezlatuvchi kuchlanish ${it("U")}, V`, ylab: `Anod toki ${it("I")}, nA`, xlabTeX: "Tezlatuvchi kuchlanish $U$, V", ylabTeX: "Anod toki $I$, nA",
      series: [
        { kind: "line", data: pts, color: C.blue, label: `${it("I")}(${it("U")}) — yozib olingan`, texColor: "ofblue", labelTeX: "$I(U)$ --- yozib olingan" },
        ...A.rows.map((r, i) => ({ kind: "line", data: [[r.U, 0], [r.U, imax]], color: C.orange, dash: "4 4", label: i === 0 ? "maksimumlar U" + SUB("k") : "", texColor: "orange!80!black", labelTeX: i === 0 ? "maksimumlar $U_k$" : "" })),
      ] } });
  }
  if (hasA) {
    const kmax = Math.max(...A.rows.map((r) => r.k)) + 1;
    X.push({ t: "fig", id: "fhk", caption: "**2-rasm.** Maksimumlar holatining tartib raqamiga bog‘liqligi: to‘g‘ri chiziq qiyaligi $\\Delta U$ ga teng.", plot: {
      xmin: 0, xmax: kmax, ymin: 0, ymax: Math.ceil((A.U0 + A.dU * kmax) / 5) * 5, xticks: Array.from({ length: kmax + 1 }, (_, i) => i), legendPos: "north west",
      xlab: `Maksimum tartib raqami ${it("k")}`, ylab: `${it("U")}${SUB("k")}, V`, xlabTeX: "Maksimum tartib raqami $k$", ylabTeX: "$U_k$, V",
      series: [
        { kind: "line", fn: (k) => A.U0 + A.dU * k, color: C.blue, label: `${it("U")}${SUB("k")} = ${plain(fx(A.U0, 2))} + ${plain(fx(A.dU, 3))}·${it("k")}`, texColor: "ofblue", texFn: `${A.U0.toFixed(4)} + ${A.dU.toFixed(5)}*x`, domain: [0, kmax], samples: 2, labelTeX: `$U_k=${fx(A.U0, 2)}+${fx(A.dU, 3)}\\,k$` },
        { kind: "pts", data: A.rows.map((r) => [r.k, r.U, r.U - 0.15, r.U + 0.15]), color: C.orange, label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
      ] } });
    X.push({ t: "p", text: "**Hisoblash.** Eng kichik kvadratlar usuli bilan $U_k = U_0 + k\\,\\Delta U$ to‘g‘ri chizig‘i:" });
    const lines = [
      `\\Delta U &= ${fx(A.dU, 3)} \\pm ${fx(Math.max(A.sdU, 0.001), 3)}\\ \\text{V},\\qquad U_0 = ${fx(A.U0, 2)} \\pm ${fx(Math.max(A.sU0, 0.01), 2)}\\ \\text{V}`,
      `E_1 &= e\\,\\Delta U = ${fx(A.dU, 3)}\\ \\text{eV} = ${fx(A.dU, 3)}\\cdot 1{,}602\\cdot 10^{-19}\\ \\text{J} = ${sx(A.dU * 1.602176634e-19, 4)}\\ \\text{J}`,
      `\\lambda_1 &= \\frac{hc}{e\\,\\Delta U} = \\frac{1239{,}84\\ \\text{eV}\\cdot\\text{nm}}{${fx(A.dU, 3)}\\ \\text{eV}} = ${fx(A.lam, 1)} \\pm ${fx(Math.max(A.slam, 0.1), 1)}\\ \\text{nm}`,
    ];
    if (A.diff) lines.push(`\\overline{\\Delta U_k} &= ${fx(A.diff.m, 3)} \\pm ${fx(A.diff.sm, 3)}\\ \\text{V}\\quad(\\text{qo‘shni maksimumlar ayirmasining o‘rtachasi})`);
    X.push({ t: "eq", lines });
    X.push({ t: "p", text: `Jadvaldagi qiymat: $E_1(\\mathrm{${g.id}}) = ${fx(g.E1, 2)}$ eV${g.id === "Hg" ? `, $\\lambda = ${fx(g.lineNm, 1)}$ nm` : ""}. Nisbiy farq: $\\delta = ${fx((100 * (A.dU - g.E1)) / g.E1, 2)}\\,\\%$.` });
  }

  // ---------------------------------------------------------------- 2-topshiriq
  X.push({ t: "sec", text: "6. 2-topshiriq: vodorodning Balmer seriyasi" });
  X.push({ t: "table", caption: `**2-jadval.** Spektral chiziqlarning difraksiya burchaklari va to‘lqin uzunliklari ($N = ${gr.id}$ chiziq/mm, $d = ${fx(gr.d * 1e6, 4)}$ µm)`,
    head: ["№", "Chiziq", "$n$", "$k$", "$\\varphi_{\\text{chap}},\\ ^\\circ$", "$\\varphi_{\\text{o‘ng}},\\ ^\\circ$", "$\\varphi,\\ ^\\circ$", "$\\lambda$, nm", "$R,\\ \\mathrm{m^{-1}}$", "Jurnal"],
    rows: B.rows.map((r, i) => [String(i + 1), r.L.name, M(String(r.n)), M(String(r.k)), M(fx(r.pL, 2)), M(fx(r.pR, 2)), M(fx(r.phi, 3)), M(fx(r.lamNm, 1)), M(sx(r.R, 5)), flags.bal[i] ? "$\\checkmark$" : "--"]),
    note: "$\\checkmark$ — ikkala burchak ham goniometr o‘lchovlar jurnalida bor. $\\varphi = (\\varphi_{\\text{o‘ng}} - \\varphi_{\\text{chap}})/2$ — shkala nol nuqtasining siljishi yo‘qotiladi." });
  if (hasB) {
    const r0 = B.rows[0];
    X.push({ t: "p", text: `**Namuna hisob** (1-qator, ${r0.L.name}, $k = ${r0.k}$):` });
    X.push({ t: "eq", lines: [
      `\\varphi &= \\frac{${fx(r0.pR, 2)}^\\circ - (${fx(r0.pL, 2)}^\\circ)}{2} = ${fx(r0.phi, 3)}^\\circ,\\qquad \\lambda = \\frac{d\\sin\\varphi}{k} = \\frac{${fx(gr.d * 1e6, 4)}\\ \\mu\\text{m}\\cdot\\sin ${fx(r0.phi, 3)}^\\circ}{${r0.k}} = ${fx(r0.lamNm, 1)}\\ \\text{nm}`,
      `R &= \\frac{1}{\\lambda\\left(\\frac{1}{4}-\\frac{1}{${r0.n}^2}\\right)} = \\frac{1}{${sx(r0.lamNm * 1e-9, 4)}\\ \\text{m}\\cdot ${fx(r0.x, 4)}} = ${sx(r0.R, 5)}\\ \\mathrm{m^{-1}}`,
    ] });
    const xs = B.rows.map((r) => r.x), xmax = 0.26;
    X.push({ t: "fig", id: "bal", caption: "**3-rasm.** $1/\\lambda$ ning $\\left(1/4 - 1/n^2\\right)$ ga bog‘liqligi: to‘g‘ri chiziq qiyaligi — Ridberg doimiysi.", plot: {
      xmin: 0, xmax: xmax, ymin: 0, ymax: Math.ceil((R_H * xmax * 1e-6) / 0.5) * 0.5, xticks: [0, 0.05, 0.1, 0.15, 0.2, 0.25], legendPos: "north west",
      xlab: `1/4 − 1/${it("n")}${SUP("2")}`, ylab: `1/${it("λ")}, μm${SUP("−1")}`, xlabTeX: "$1/4-1/n^2$", ylabTeX: "$1/\\lambda$, $\\mu\\mathrm{m}^{-1}$",
      series: [
        { kind: "line", fn: (x) => B.fit.a * 1e-6 + B.fit.b * 1e-6 * x, color: C.blue, label: `EKK: ${it("R")} = ${plain(sx(B.fit.b, 5))} m${SUP("−1")}`, texColor: "ofblue", texFn: `${(B.fit.a * 1e-6).toFixed(6)} + ${(B.fit.b * 1e-6).toFixed(6)}*x`, domain: [0, xmax], samples: 2, labelTeX: `EKK: $R=${sx(B.fit.b, 5)}\\ \\mathrm{m^{-1}}$` },
        { kind: "line", fn: (x) => R_H * 1e-6 * x, color: C.green, dash: "6 4", label: `nazariya: ${it("R")}${SUB("H")} = ${plain(sx(R_H, 5))} m${SUP("−1")}`, texColor: "green!50!black", dash2: true, texFn: `${(R_H * 1e-6).toFixed(6)}*x`, domain: [0, xmax], samples: 2, labelTeX: `nazariya: $R_H=${sx(R_H, 5)}\\ \\mathrm{m^{-1}}$` },
        { kind: "pts", data: B.rows.map((r) => [r.x, r.inv * 1e-6]), color: C.orange, label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
      ] } });
    X.push({ t: "p", text: "**Ridberg doimiysi va ionlanish energiyasi:**" });
    X.push({ t: "eq", lines: [
      `\\bar R &= \\frac{1}{N}\\sum_i R_i = (${sx(B.Rst.m, 5)} \\pm ${sx(Math.max(B.Rst.sm, 1), 2)})\\ \\mathrm{m^{-1}},\\qquad R_{\\text{EKK}} = ${sx(B.fit.b, 5)} \\pm ${sx(Math.max(B.fit.sb, 1), 2)}\\ \\mathrm{m^{-1}}`,
      `\\delta &= \\frac{\\bar R - R_H}{R_H} = \\frac{${sx(B.Rst.m, 5)} - ${sx(R_H, 5)}}{${sx(R_H, 5)}} = ${fx((100 * (B.Rst.m - R_H)) / R_H, 3)}\\,\\%`,
      `E_{\\text{ion}} &= hc\\bar R = 1239{,}84\\ \\text{eV}\\cdot\\text{nm}\\cdot ${sx(B.Rst.m * 1e-9, 5)}\\ \\text{nm}^{-1} = ${fx(B.Eion, 3)}\\ \\text{eV}\\quad(\\text{nazariya: } ${fx(RY_EV, 3)}\\ \\text{eV})`,
      `\\overline{\\varphi_0} &= \\frac{\\varphi_{\\text{o‘ng}}+\\varphi_{\\text{chap}}}{2} = ${fx(B.zero.m, 3)}^\\circ\\quad(\\text{goniometr nol nuqtasining siljishi})`,
    ] });
    // 2-postulat
    const uniq = []; B.rows.forEach((r) => { if (!uniq.some((u) => u.n === r.n)) uniq.push(r); });
    X.push({ t: "table", caption: "**3-jadval.** Chastotalar qoidasini tekshirish: foton energiyasi va Bor sathlari farqi", head: ["Chiziq", "O‘tish", "$\\lambda$, nm", "$h\\nu = hc/\\lambda$, eV", "$E_n - E_2$ (Bor), eV", "Farq, %"],
      rows: uniq.sort((a, b) => a.n - b.n).map((r) => { const rs = B.rows.filter((q) => q.n === r.n), lam = rs.reduce((s, q) => s + q.lamNm, 0) / rs.length, hv = HC_EV_NM / lam; return [r.L.name, M(`${r.n}\\to 2`), M(fx(lam, 1)), M(fx(hv, 3)), M(fx(r.dE, 3)), M(fx((100 * (hv - r.dE)) / r.dE, 2))]; }),
      note: `Sath energiyalari $E_n = -${fx(RY_EV, 3)}\\ \\text{eV}/n^2$: $E_2 = ${fx(levelEv(2), 3)}$, $E_3 = ${fx(levelEv(3), 3)}$, $E_4 = ${fx(levelEv(4), 3)}$, $E_5 = ${fx(levelEv(5), 3)}$, $E_6 = ${fx(levelEv(6), 3)}$ eV. Bir chiziq bir necha tartibda o‘lchangan bo‘lsa, $\\lambda$ o‘rtachasi olingan.` });
  }

  X.push({ t: "sec", text: "7. Xulosa" });
  const box = ["**Hisob natijalari:**"];
  if (hasA) box.push(`• Frank–Gers: maksimumlar teng oraliqda takrorlanadi, $\\Delta U = (${fx(A.dU, 3)}\\pm${fx(Math.max(A.sdU, 0.001), 3)})$ V; birinchi uyg‘otish energiyasi $E_1 = ${fx(A.dU, 2)}$ eV (jadvalda $${fx(g.E1, 2)}$ eV) — atom energiyasi diskret (1-postulat).`);
  if (hasB) box.push(`• Balmer seriyasi: $\\bar R = (${sx(B.Rst.m, 5)}\\pm${sx(Math.max(B.Rst.sm, 1), 2)})\\ \\mathrm{m^{-1}}$, nazariy $R_H = ${sx(R_H, 5)}\\ \\mathrm{m^{-1}}$; $h\\nu = E_n - E_2$ bajariladi (2-postulat); $E_{\\text{ion}} = ${fx(B.Eion, 2)}$ eV.`);
  X.push({ t: "box", items: box });
  X.push({ t: "p", text: "**Bajaruvchining xulosasi:**" });
  userText(nb.f.conclusion.trim()).split(/\n+/).forEach((par) => X.push({ t: "p", text: par }));
  X.push({ t: "sign", items: ["Bajaruvchi imzosi", "O‘qituvchi imzosi va bahosi"] });
  X.push({ t: "link", url: SITE_URL, label: SITE_LABEL, text: "Ushbu ish OliyFizika.uz virtual laboratoriyasida bajarildi. Laboratoriyani ochish:" });

  return {
    title: "Laboratoriya ishi. Bor postulatlarini tajribada tekshirish",
    titlePlain: "Laboratoriya ishi. Bor postulatlarini tajribada tekshirish",
    author: nb.f.name,
    sub: "Frank–Gers tajribasi va vodorod atomi spektrining Balmer seriyasi",
    meta: [["Bajaruvchi:", userText(nb.f.name)], ["Guruh / sinf:", userText(nb.f.group || "—")], ["Muassasa:", userText(nb.f.school || "—")], ["O‘qituvchi:", userText(nb.f.teacher || "—")], ["Bajarilgan sana:", fmtDate(nb.f.date)], ["Hisobot yaratildi:", created]],
    blocks: X,
  };
}
