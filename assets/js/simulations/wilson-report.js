// ==========================================================================
// Vilson kamerasi — laboratoriya hisoboti mazmuni (→ labreport.js).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { SOURCES } from "./wilson-physics.js";

export const SITE = { url: "https://oliyfizika.uz/simulations/wilson.html", label: "oliyfizika.uz/simulations/wilson.html" };
export const DOC_LABEL = "Virtual laboratoriya ishi · Kvant fizikasi";
const M = (t) => `$${t}$`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;

export function buildWilsonDoc(nb, res) {
  const A = res.t1, B = res.t2, X = []; let sec = 1, tab = 1, fig = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });
  const src = SOURCES[A.cond.src] || SOURCES["Po-210"];
  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "Vilson kamerasining ishlash prinsipini o‘rganish, turli zarralar izlarini farqlash.",
    "α-zarralar yugurish yo‘lini o‘lchab, ularning energiyasini aniqlash; energiyaning diskretligini tekshirish.",
    "Magnit maydondagi β-zarralar izlarining egrilik radiusi bo‘yicha ularning impulsi, energiyasi va zaryad ishorasini aniqlash.",
  ] });
  S("Qisqacha nazariya");
  X.push({ t: "p", text: "Kamerada havo va spirt bug‘i aralashmasi porshen yordamida tez (adiabatik) kengaytiriladi: harorat pasayib, bug‘ o‘ta to‘yingan holatga o‘tadi. Zaryadli zarra o‘z yo‘lida ionlar hosil qiladi; ionlar kondensatsiya markazlari bo‘lib, ularda tomchilar o‘sadi — zarraning izi ko‘rinadi va suratga olinadi." });
  X.push({ t: "p", text: "α-zarralar havoni kuchli ionlaydi — izlari qalin va to‘g‘ri, uzunligi (yugurish yo‘li) energiyaga bog‘liq. 4–7 MeV oralig‘ida Geyger qonuni:" });
  X.push({ t: "eq", tag: 1, lines: ["R = 0{,}318\\,E^{3/2}\\quad (R\\ \\text{— sm},\\ E\\ \\text{— MeV}),\\qquad E = \\left(\\frac{R}{0{,}318}\\right)^{2/3}"] });
  X.push({ t: "p", text: "Magnit maydonda Lorens kuchi zarrani aylana bo‘ylab egadi:" });
  X.push({ t: "eq", tag: 2, lines: ["qvB = \\frac{\\gamma m v^2}{r} \\quad\\Longrightarrow\\quad p = qBr,\\qquad p\\,[\\text{MeV}/c] = 0{,}3\\,B\\,[\\text{T}]\\;r\\,[\\text{mm}]"] });
  X.push({ t: "p", text: "Elektron uchun kinetik energiya relyativistik formuladan topiladi ($m_e c^2 = 0{,}511$ MeV):" });
  X.push({ t: "eq", tag: 3, lines: ["T = \\sqrt{p^2c^2 + m_e^2c^4} - m_e c^2"] });
  X.push({ t: "p", text: "Egrilik yo‘nalishi $\\vec F = q\\,\\vec v \\times \\vec B$ bo‘yicha zaryad ishorasini ko‘rsatadi." });
  S("Jihozlar (virtual qurilma)");
  X.push({ t: "list", items: [
    "Vilson kamerasi (ko‘rish diametri 160 mm), porshen, yon yoritgich, fotokamera; manba igna uchida.",
    "Manbalar: $^{210}$Po, $^{241}$Am, $^{228}$Th (α); $^{90}$Sr/$^{90}$Y (β$^-$), $^{22}$Na (β$^+$).",
    "Elektromagnit: $B = 0\\ldots 0{,}3$ T; suratda o‘lchash: chizg‘ich va 3 nuqta orqali aylana, lupa ×4.",
  ] });
  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "α-manbani o‘rnating, kamerani kengaytirib bir nechta surat oling. Faqat to‘liq (oxirigacha yorqin) izlarning uzunligini manbadan iz oxirigacha o‘lchang (1-jadval).",
    "β-manbani o‘rnatib, magnit maydonni yoqing. Izga uchta nuqta qo‘yib, egrilik radiusini o‘lchang; egrilik yo‘nalishidan zaryad ishorasini aniqlang (2-jadval).",
    "(1)–(3) formulalar bo‘yicha energiyalarni hisoblang va natijalarni tahlil qiling.",
  ] });

  const a = A.A;
  S("1-topshiriq: α-zarralar");
  X.push({ t: "table", caption: `**${tab++}-jadval.** α-izlar uzunligi va energiyasi (manba: ${src.name.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `$^{${[...m].map((ch) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(ch)).join("")}}$`)})`,
    head: ["№", "Iz", "$R$, mm", "$E$, MeV", "$v$, $10^7$ m/s", "Tekshiruv"],
    rows: a.rows.map((r, i) => [String(i + 1), String(r.id), M(fx(r.R, 1)), M(fx(r.E, 3)), M(fx(r.v / 1e7, 3)), A.flags[i] ? "$\\checkmark$" : "--"]),
    note: "«Tekshiruv»: $\\checkmark$ — o‘lchangan uzunlik shu izga mos ($\\pm 1{,}5$ mm). «--» — iz to‘liq emas yoki uzunlik noto‘g‘ri." });
  // gistogramma
  const Es = a.rows.map((r) => r.E), lo = Math.floor(Math.min(...Es) * 5) / 5 - 0.2, hi = Math.ceil(Math.max(...Es) * 5) / 5 + 0.2, bw = 0.1, nb2 = Math.round((hi - lo) / bw);
  const cnt = Array.from({ length: nb2 }, (_, i) => Es.filter((e) => e >= lo + i * bw && e < lo + (i + 1) * bw).length), step = [];
  cnt.forEach((n, i) => { step.push([lo + i * bw, n], [lo + (i + 1) * bw, n]); });
  const refs = src.lines.filter((l) => l[0] >= lo && l[0] <= hi).map((l) => l[0]), ymax = Math.max(...cnt) + 1;
  X.push({ t: "fig", id: "hist", caption: `**${fig++}-rasm.** α-zarralar energiyalarining taqsimoti (kenglik 0,1 MeV). Shtrix chiziqlar — manbaning jadvaldagi α-chiziqlari.`, plot: {
    xmin: lo, xmax: hi, ymin: 0, ymax, legendPos: "north west",
    xlab: `${it("E")}, MeV`, ylab: "izlar soni", xlabTeX: "$E$, MeV", ylabTeX: "izlar soni",
    series: [
      { kind: "line", data: [[lo, 0], ...step, [hi, 0]], color: "#1d4ed8", label: "o‘lchangan", texColor: "ofblue", labelTeX: "o‘lchangan" },
      ...refs.map((e) => ({ kind: "line", data: [[e, 0], [e, ymax]], color: "#c2410c", dash: "4 3", texColor: "orange!80!black" })),
    ] } });
  X.push({ t: "table", caption: `**${tab++}-jadval.** Energiya guruhlari va jadval qiymatlari`, head: ["Guruh", "Izlar soni", "$\\bar E$, MeV", "$\\sigma_E$, MeV", "Eng yaqin jadval qiymati, MeV"],
    rows: a.G.map((g, i) => { const near = src.lines.reduce((b, l) => (Math.abs(l[0] - g.m) < Math.abs(b - g.m) ? l[0] : b), src.lines[0][0]); return [String(i + 1), String(g.n), M(fx(g.m, 3)), g.n > 1 ? M(fx(g.sd, 3)) : "--", M(fx(near, 3))]; }) });
  const r0 = a.rows[0];
  X.push({ t: "p", text: "**Hisoblash namunasi** (1-qator):" });
  X.push({ t: "eq", lines: [`E = \\left(\\frac{${fx(r0.R / 10, 2)}}{0{,}318}\\right)^{2/3} = ${fx(r0.E, 3)}\\ \\text{MeV},\\qquad v = c\\sqrt{\\frac{2E}{m_\\alpha c^2}} = ${sx(r0.v, 3)}\\ \\text{m/s}`] });

  if (B?.ok) {
    const b = B.A;
    S("2-topshiriq: β-zarralar magnit maydonda");
    X.push({ t: "table", caption: `**${tab++}-jadval.** β-izlar egrilik radiusi, impulsi va energiyasi ($B = ${fx(b.B, 1)}$ T)`,
      head: ["№", "Iz", "$r$, mm", "Zaryad", "$p$, MeV/$c$", "$T$, MeV", "$v/c$", "Tekshiruv"],
      rows: b.rows.map((r, i) => [String(i + 1), String(r.id), M(fx(r.r, 1)), r.sign === "-" ? "$e^-$" : "$e^+$", M(fx(r.p, 3)), M(fx(r.T, 3)), M(fx(r.beta, 3)), B.flags[i] ? "$\\checkmark$" : "--"]),
      note: "«Tekshiruv»: $\\checkmark$ — radius ($\\pm 6\\,\\%$) va zaryad ishorasi izga mos." });
    const q0 = b.rows[0];
    X.push({ t: "eq", lines: [`p = 0{,}3\\cdot ${fx(b.B, 1)}\\cdot ${fx(q0.r, 1)} = ${fx(q0.p, 3)}\\ \\text{MeV}/c,\\qquad T = \\sqrt{${fx(q0.p, 3)}^2 + 0{,}511^2} - 0{,}511 = ${fx(q0.T, 3)}\\ \\text{MeV}`] });
    X.push({ t: "p", text: `O‘rtacha kinetik energiya $\\bar T = ${fx(b.Tm, 2)}$ MeV, eng kattasi $${fx(b.Tmax, 2)}$ MeV. β-zarralar energiyasi bir xil emas — uzluksiz spektr (energiyaning bir qismini neytrino olib ketadi). $v/c$ birga yaqin: elektronlar relyativistik.` });
  }
  S("Xulosa");
  const box = [`• α-zarralar energiyasi diskret: ${a.G.map((g) => `$${fx(g.m, 2)}$`).join("; ")} MeV — yadro sathlari diskret.`];
  if (B?.ok) box.push(`• β-zarralar energiyasi uzluksiz taqsimlangan ($\\bar T = ${fx(B.A.Tm, 2)}$ MeV); zaryad ishorasi egrilik yo‘nalishidan aniqlandi.`);
  docTail(X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Vilson kamerasida zarralar izlarini o‘rganish", titlePlain: "Laboratoriya ishi. Vilson kamerasi", author: nb.f.name, sub: "α-zarralar yugurish yo‘li va β-zarralarning magnit maydonda harakati", meta: docMeta(nb, userText), blocks: X };
}
