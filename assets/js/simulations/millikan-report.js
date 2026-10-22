// ==========================================================================
// Milliken tajribasi — laboratoriya hisoboti mazmuni (→ labreport.js).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { QE, RHO, RHO_AIR, ETA, D_PL, S_MEAS, B_C, PRESS } from "./millikan-physics.js";

export const SITE = { url: "https://oliyfizika.uz/simulations/millikan.html", label: "oliyfizika.uz/simulations/millikan.html" };
export const DOC_LABEL = "Virtual laboratoriya ishi · Kvant fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const q19 = (q) => fx(q / 1e-19, 3);

function qFig(id, caption, groups, Q) {
  const nmax = Math.max(...groups.map((g) => g.n)) + 1;
  return { t: "fig", id, caption, plot: {
    xmin: 0, xmax: nmax, ymin: 0, ymax: (Math.max(...groups.map((g) => g.q)) / 1e-19) * 1.2, xticks: Array.from({ length: nmax + 1 }, (_, i) => i), legendPos: "north west",
    xlab: `Zaryadlar soni ${it("n")}`, ylab: `${it("q")}, 10${SUP("−19")} C`, xlabTeX: "Zaryadlar soni $n$", ylabTeX: "$q$, $10^{-19}$ C",
    series: [
      { kind: "line", fn: (x) => (Q.e / 1e-19) * x, color: "#1d4ed8", label: `${it("q")} = ${fx(Q.e / 1e-19, 3).replace("{,}", ",")}·${it("n")}`, texColor: "ofblue", texFn: `${(Q.e / 1e-19).toFixed(5)}*x`, domain: [0, nmax], samples: 2, labelTeX: `$q = ${fx(Q.e / 1e-19, 3)}\\,n$` },
      { kind: "pts", data: groups.map((g) => [g.n, g.q / 1e-19]), color: "#c2410c", label: "tomchilar", texColor: "orange!80!black", labelTeX: "tomchilar" },
    ] } };
}

export function buildMillikanDoc(nb, res) {
  const T1 = res.t1, T2 = res.t2, X = []; let sec = 1, tab = 1, fig = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });
  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "Elektr maydonidagi zaryadlangan moy tomchilarining harakatini kuzatish va ularning zaryadini o‘lchash.",
    "Zaryadning diskretligini (kvantlanganligini) tekshirish va elementar zaryad $e$ ni aniqlash.",
  ] });
  S("Qisqacha nazariya");
  X.push({ t: "p", text: "Havoda radiusi $r$ bo‘lgan tomchi o‘zgarmas tezlik bilan harakatlanadi: og‘irlik kuchi (Arximed kuchi hisobga olingan), elektr kuch va Stoks qarshilik kuchi muvozanatlashadi. Maydon bo‘lmaganda (tushish, $v_t$):" });
  X.push({ t: "eq", tag: 1, lines: ["\\frac{4}{3}\\pi r^3 (\\rho - \\rho_h) g = 6\\pi\\eta r v_t"] });
  X.push({ t: "p", text: "Maydon $E = U/d$ tomchini yuqoriga ko‘targanda (ko‘tarilish, $v_k$):" });
  X.push({ t: "eq", tag: 2, lines: ["q\\frac{U}{d} = \\frac{4}{3}\\pi r^3 (\\rho - \\rho_h) g + 6\\pi\\eta r v_k"] });
  X.push({ t: "p", text: "(1) va (2) dan:" });
  X.push({ t: "eq", tag: 3, lines: ["r = \\sqrt{\\frac{9\\eta v_t}{2(\\rho-\\rho_h) g}},\\qquad q = \\frac{6\\pi\\eta r\\,(v_t + v_k)\\,d}{U}"] });
  X.push({ t: "p", text: "Radiusi $\\sim 1$ μm bo‘lgan tomchilar uchun Stoks qonuniga Kanningem tuzatmasi kiritiladi: $\\eta_{ef} = \\eta/(1 + b/pr)$; bunda radius" });
  X.push({ t: "eq", tag: 4, lines: ["r = \\sqrt{\\frac{b^2}{4p^2} + \\frac{9\\eta v_t}{2(\\rho-\\rho_h) g}} - \\frac{b}{2p}"] });
  X.push({ t: "p", text: "Muvozanat usulida tomchi $U_m$ kuchlanishda to‘xtaydi: $q = \\frac{4}{3}\\pi r^3(\\rho-\\rho_h) g\\,d/U_m$. Barcha zaryadlar $q = ne$ ko‘rinishida bo‘lishi kerak ($n$ — butun son)." });
  S("Jihozlar va doimiylar");
  X.push({ t: "list", items: [
    `Yassi kondensator: $d = ${fx(D_PL * 1000, 1)}$ mm, $U = 0\\ldots 600$ V; o‘lchov chiziqlari orasidagi masofa $s = ${fx(S_MEAS * 1000, 1)}$ mm.`,
    "Purkagich, ionlovchi manba, yoritgich, okulyar-mikrometrli mikroskop, sekundomer (0,01 s).",
    `Moy zichligi $\\rho = ${fx(RHO, 1)}$ kg/m$^3$, havo zichligi $\\rho_h = ${fx(RHO_AIR, 2)}$ kg/m$^3$, havo qovushqoqligi $\\eta = ${sx(ETA, 4)}$ Pa·s, $b = ${sx(B_C, 2)}$ Pa·m, $p = ${fx(PRESS / 1000, 1)}$ kPa, $g = 9{,}81$ m/s$^2$.`,
  ] });
  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "Kondensatorga moy tomchilarini purkang, mikroskopda bitta tomchini tanlang.",
    "Maydonsiz tomchining A chiziqdan B chiziqqacha tushish vaqti $t_t$ ni, maydon yoqilganda B dan A gacha ko‘tarilish vaqti $t_k$ ni o‘lchang. Har bir tomchi uchun o‘lchashni takrorlang.",
    "Bir nechta tomchi uchun $q$ ni hisoblang, $q_i = n_i e$ shartidan $n_i$ va $e$ ni toping.",
  ] });

  const block = (T, title, dyn) => {
    const a = T.A, Q = a.Q;
    S(title);
    X.push({ t: "table", caption: `**${tab++}-jadval.** ${dyn ? "Dinamik usul" : "Muvozanat usuli"}: o‘lchashlar va hisoblangan zaryadlar`,
      head: dyn ? ["№", "Tomchi", "$U$, V", "$t_t$, s", "$t_k$, s", "$r$, μm", "$q$, $10^{-19}$ C", "$n$", "$q/n$, $10^{-19}$ C", "Tekshiruv"] : ["№", "Tomchi", "$t_t$, s", "$U_m$, V", "$r$, μm", "$q$, $10^{-19}$ C", "$n$", "$q/n$, $10^{-19}$ C", "Tekshiruv"],
      rows: a.rows.map((r, i) => [String(i + 1), String(r.drop), ...(dyn ? [M(fx(r.U, 0)), M(fx(r.tf, 2)), M(fx(r.tr, 2))] : [M(fx(r.tf, 2)), M(fx(r.Ub, 0))]), M(fx(r.r * 1e6, 3)), M(q19(r.q)), M(String(r.n)), M(q19(r.qn)), T.flags[i] ? "$\\checkmark$" : "--"]),
      note: "Bir tomchi bo‘yicha takroriy o‘lchashlar keyingi jadvalda o‘rtachalangan. «Tekshiruv»: $\\checkmark$ — o‘lchangan vaqt (kuchlanish) shu tomchi uchun qurilmadagi qiymatga mos (Broun harakati tufayli $\\pm 10\\,\\%$)." });
    X.push({ t: "table", caption: `**${tab++}-jadval.** Tomchilar bo‘yicha o‘rtacha qiymatlar`,
      head: ["Tomchi", dyn ? "$\\bar t_t$, s" : "$\\bar t_t$, s", dyn ? "$\\bar t_k$, s" : "$U_m$, V", "$r$, μm", "$q$, $10^{-19}$ C", "$n$", "$q/n$, $10^{-19}$ C"],
      rows: a.groups.map((g) => [String(g.drop), M(fx(g.tf, 2)), M(dyn ? fx(g.tr, 2) : fx(g.Ub, 0)), M(fx(g.r * 1e6, 3)), M(q19(g.q)), M(String(g.n)), M(q19(g.qn))]) });
    const g0 = a.groups[0];
    X.push({ t: "p", text: `**Hisoblash namunasi** (tomchi № ${g0.drop}):` });
    const L = [`v_t &= \\frac{s}{\\bar t_t} = \\frac{${fx(S_MEAS * 1000, 1)}\\cdot 10^{-3}}{${fx(g0.tf, 2)}} = ${sx(g0.vf, 3)}\\ \\text{m/s},\\qquad r = ${sx(g0.r, 3)}\\ \\text{m}\\ \\ (4)`];
    if (dyn) L.push(`v_k &= ${sx(g0.vr, 3)}\\ \\text{m/s},\\qquad q = \\frac{6\\pi\\eta_{ef} r (v_t + v_k) d}{U} = ${sx(g0.q, 4)}\\ \\text{C}`);
    else L.push(`q &= \\frac{4\\pi r^3 (\\rho-\\rho_h) g\\, d}{3\\,U_m} = ${sx(g0.q, 4)}\\ \\text{C}`);
    L.push(`n &= \\operatorname{round}(q/e) = ${g0.n},\\qquad q/n = ${sx(g0.qn, 4)}\\ \\text{C}`);
    X.push({ t: "eq", lines: L });
    X.push(qFig(`q${tab}`, `**${fig++}-rasm.** Tomchilar zaryadining zaryadlar soni $n$ ga bog‘liqligi (${dyn ? "dinamik usul" : "muvozanat usuli"}). Qiyalik — elementar zaryad.`, a.groups, Q));
    X.push({ t: "eq", lines: [`e = \\frac{\\sum q_i}{\\sum n_i} = ${sx(Q.e, 4)}\\ \\text{C},\\qquad \\Delta e = ${sx(Math.max(Q.se, 1e-22), 2)}\\ \\text{C}\\ \\ (${a.groups.length}\\ \\text{ta tomchi})`] });
  };
  if (T1?.ok) block(T1, "1-topshiriq: dinamik usul", true);
  if (T2?.ok) block(T2, `${T1?.ok ? 2 : 1}-topshiriq: muvozanat usuli`, false);
  const es = [T1, T2].filter((t) => t?.ok).map((t) => t.A.Q.e);
  X.push({ t: "p", text: `Jadval qiymati: $e = 1{,}602\\cdot 10^{-19}$ C. Farq: ${es.map((e) => `$${fx((100 * (e - QE)) / QE, 1)}\\,\\%$`).join(", ")}. Asosiy xato manbalari — Broun harakati (vaqtlarning tasodifiy o‘zgarishi), sekundomerni ishga tushirish aniqligi va tomchi radiusining kichikligi.` });
  S("Xulosa");
  docTail(X, nb, userText, [
    "• O‘lchangan barcha zaryadlar bitta eng kichik zaryadga karrali — elektr zaryadi kvantlangan.",
    ...es.map((e, i) => `• ${es.length > 1 ? (i ? "Muvozanat usuli" : "Dinamik usul") : "Elementar zaryad"}: $e = ${sx(e, 3)}$ C.`),
  ], SITE);
  return { title: "Laboratoriya ishi. Elementar zaryadni Milliken usulida aniqlash", titlePlain: "Laboratoriya ishi. Milliken tajribasi", author: nb.f.name, sub: "Moy tomchilari, Stoks qonuni va zaryadning kvantlanishi", meta: docMeta(nb, userText), blocks: X };
}
