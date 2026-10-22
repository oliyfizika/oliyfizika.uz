// ==========================================================================
// Qora jism nurlanishi — laboratoriya hisoboti mazmuni (→ labreport.js).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { H, K, SIGMA, B_WIEN, T0, A_AP, L_RAD, EPS, hkFrom, tempRGB } from "./bb-physics.js";

export const SITE = { url: "https://oliyfizika.uz/simulations/blackbody.html", label: "oliyfizika.uz/simulations/blackbody.html" };
export const DOC_LABEL = "Virtual laboratoriya ishi · Kvant fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const SUB = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const TPAL = ["red!70!black", "orange!90!black", "yellow!60!black", "green!50!black", "cyan!60!black", "blue!70!black", "violet!80!black", "black"];
const hex = (T) => { const [r, g, b] = tempRGB(T); return `rgb(${Math.round(r * 0.75)},${Math.round(g * 0.6)},${Math.round(b * 0.75)})`; };

/** res — {t1, t2}; spectra — {T: [[λ, B], …]} */
export function buildBBDoc(nb, res, spectra) {
  const A = res.t1, B = res.t2, X = []; let sec = 1, tab = 1, fig = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });
  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "Qora jism modeli nurlanishining spektral taqsimotini turli haroratlarda o‘lchash.",
    "Vin siljish qonunini tekshirish va Vin doimiysi $b$ ni aniqlash.",
    "Stefan–Bolsman qonunini tekshirish va $\\sigma$ ni aniqlash; $b$ va $\\sigma$ dan Plank va Bolsman doimiylarini hisoblash.",
  ] });
  S("Qisqacha nazariya");
  X.push({ t: "p", text: "Absolyut qora jismning spektral energetik ravshanligi Plank formulasi bilan ifodalanadi:" });
  X.push({ t: "eq", tag: 1, lines: ["B_\\lambda(T) = \\frac{2hc^2}{\\lambda^5}\\,\\frac{1}{e^{hc/\\lambda k T} - 1}"] });
  X.push({ t: "p", text: "$dB_\\lambda/d\\lambda = 0$ shartidan maksimum $hc/\\lambda_{\\max} kT = x = 4{,}965$ da bo‘ladi — Vin siljish qonuni:" });
  X.push({ t: "eq", tag: 2, lines: ["\\lambda_{\\max} T = b, \\qquad b = \\frac{hc}{x k}"] });
  X.push({ t: "p", text: "(1) ni barcha to‘lqin uzunliklari va yarim fazo bo‘yicha integrallash Stefan–Bolsman qonunini beradi:" });
  X.push({ t: "eq", tag: 3, lines: ["M = \\sigma T^4,\\qquad \\sigma = \\frac{2\\pi^5 k^4}{15 c^2 h^3}"] });
  X.push({ t: "p", text: "Radiusi $a$ bo‘lgan apertura o‘qida $L \\gg a$ masofadagi radiometrga tushadigan oqim zichligi (atrof harorati $T_0$, nurlanish qobiliyati $\\varepsilon$):" });
  X.push({ t: "eq", tag: 4, lines: ["E = \\varepsilon\\sigma\\left(T^4 - T_0^4\\right)\\frac{a^2}{L^2}"] });
  S("Jihozlar (virtual qurilma)");
  X.push({ t: "list", items: [
    "Qora jism modeli — elektr pech ichidagi bo‘shliq, harorati $800\\ldots 3000$ K; optik pirometr (1 K).",
    "Prizmali monoxromator ($0{,}3\\ldots 6$ μm) va bolometr-detektor (spektral ravshanlik, kW/(m$^2$·sr·μm)).",
    `Kalibrlangan radiometr (termobatareya): $a = ${fx(A_AP * 1000, 0)}$ mm, $L = ${fx(L_RAD * 100, 0)}$ sm, $\\varepsilon = ${fx(EPS, 2)}$, $T_0 = ${T0}$ K.`,
  ] });
  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "Pech haroratini o‘rnating va barqarorlashishini kuting. Monoxromatorni $0{,}3\\ldots 6$ μm oralig‘ida aylantirib, spektrni yozing; maksimumga mos $\\lambda_{\\max}$ ni aniqlang (1-jadval).",
    "Radiometr bilan bir necha haroratda nurlanish oqimi zichligi $E$ ni o‘lchang (2-jadval).",
    "$\\lambda_{\\max}(1/T)$ va $\\ln E(\\ln T)$ grafiklarini chizing; $b$, $\\sigma$, $h$ va $k$ ni hisoblang.",
  ] });

  if (A?.ok) {
    const a = A.A;
    S("1-topshiriq: Vin siljish qonuni");
    X.push({ t: "table", caption: `**${tab++}-jadval.** Spektr maksimumining haroratga bog‘liqligi`,
      head: ["№", "$T$, K", "$\\lambda_{\\max}$, μm", "$1/T$, $10^{-3}$ K$^{-1}$", "$\\lambda_{\\max} T$, mm·K", "Tekshiruv"],
      rows: a.rows.map((r, i) => [String(i + 1), M(fx(r.T, 0)), M(fx(r.lm, 3)), M(fx(r.inv, 4)), M(fx(r.bi * 1000, 4)), A.flags[i] ? "$\\checkmark$" : "--"]),
      note: "«Tekshiruv»: $\\checkmark$ — $\\lambda_{\\max}$ o‘lchangan spektr maksimumidan $\\pm 2{,}5\\,\\%$ ichida." });
    const keys = Object.keys(spectra || {}).sort((p, q) => +p - +q).slice(-6);
    if (keys.length) {
      const ymax = Math.max(...keys.flatMap((k) => spectra[k].map((p) => p[1])));
      X.push({ t: "fig", id: "spec", caption: `**${fig++}-rasm.** Qora jism modelining o‘lchangan spektrlari. Harorat oshishi bilan maksimum qisqa to‘lqinlar tomon siljiydi.`, plot: {
        xmin: 0, xmax: 6, ymin: 0, ymax: ymax * 1.1, legendPos: "north east", xticks: [0, 1, 2, 3, 4, 5, 6],
        xlab: `To‘lqin uzunligi ${it("λ")}, μm`, ylab: `${it("B")}${SUB("λ")}, kW/(m${SUP("2")}·sr·μm)`, xlabTeX: "To‘lqin uzunligi $\\lambda$, μm", ylabTeX: "$B_\\lambda$, kW/(m$^2\\cdot$sr$\\cdot$μm)",
        series: keys.map((k, i) => ({ kind: "line", data: spectra[k].filter((_, j) => j % 2 === 0), color: hex(+k), label: `${it("T")} = ${k} K`, texColor: TPAL[i % TPAL.length], labelTeX: `$T = ${k}$ K` })),
      } });
    }
    const xmx = Math.max(...a.rows.map((r) => r.inv)) * 1.15;
    X.push({ t: "fig", id: "wien", caption: `**${fig++}-rasm.** $\\lambda_{\\max}$ ning $1/T$ ga bog‘liqligi. To‘g‘ri chiziq qiyaligi — Vin doimiysi $b$.`, plot: {
      xmin: 0, xmax: xmx, ymin: 0, ymax: Math.max(...a.rows.map((r) => r.lm)) * 1.2, legendPos: "north west",
      xlab: `1/${it("T")}, 10${SUP("−3")} K${SUP("−1")}`, ylab: `${it("λ")}${SUB("max")}, μm`, xlabTeX: "$1/T$, $10^{-3}$ K$^{-1}$", ylabTeX: "$\\lambda_{\\max}$, μm",
      series: [
        { kind: "line", fn: (x) => a.b * 1e3 * x, color: "#1d4ed8", label: `${it("λ")}${SUB("max")} = ${fx(a.b * 1e3, 4).replace("{,}", ",")}·(1/${it("T")})`, texColor: "ofblue", texFn: `${(a.b * 1e3).toFixed(6)}*x`, domain: [0, xmx], samples: 2, labelTeX: `$\\lambda_{\\max} = ${fx(a.b * 1e3, 4)}\\,(1/T)$` },
        { kind: "pts", data: a.rows.map((r) => [r.inv, r.lm]), color: "#c2410c", label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
      ] } });
    X.push({ t: "eq", lines: [`b = (${sx(a.b, 4)} \\pm ${sx(Math.max(a.sb, 1e-7), 2)})\\ \\text{m}\\cdot\\text{K}\\qquad(\\text{jadvalda}\\ 2{,}898\\cdot 10^{-3}\\ \\text{m}\\cdot\\text{K},\\ \\text{farq}\\ ${fx((100 * (a.b - B_WIEN)) / B_WIEN, 1)}\\,\\%)`] });
  }
  if (B?.ok) {
    const b = B.A;
    S(`${A?.ok ? 2 : 1}-topshiriq: Stefan–Bolsman qonuni`);
    X.push({ t: "table", caption: `**${tab++}-jadval.** Radiometr ko‘rsatkichlari`,
      head: ["№", "$T$, K", "$E$, W/m$^2$", "$T^4 - T_0^4$, $10^{12}$ K$^4$", "$\\ln T$", "$\\ln E$", "$\\sigma_i$, $10^{-8}$ W/(m$^2$K$^4$)", "Tekshiruv"],
      rows: b.rows.map((r, i) => [String(i + 1), M(fx(r.T, 0)), M(fx(r.E, 2)), M(fx(r.X / 1e12, 4)), M(fx(Math.log(r.T), 4)), M(fx(Math.log(r.E), 4)), M(fx(r.si / 1e-8, 3)), B.flags[i] ? "$\\checkmark$" : "--"]),
      note: "$\\sigma_i = E L^2/(\\varepsilon a^2 (T^4 - T_0^4))$. «Tekshiruv»: $\\checkmark$ — radiometr ko‘rsatkichiga $\\pm 2\\,\\%$ ichida mos." });
    if (b.ln) {
      const lx = b.rows.map((r) => Math.log(r.T)), x0 = Math.floor(Math.min(...lx) * 10) / 10 - 0.1, x1 = Math.ceil(Math.max(...lx) * 10) / 10 + 0.1;
      X.push({ t: "fig", id: "sb", caption: `**${fig++}-rasm.** $\\ln E$ ning $\\ln T$ ga bog‘liqligi. Qiyalik $n \\approx 4$ — Stefan–Bolsman qonuni.`, plot: {
        xmin: x0, xmax: x1, ymin: Math.floor(b.ln.a + b.ln.b * x0) - 0.5, ymax: Math.ceil(b.ln.a + b.ln.b * x1) + 0.5, legendPos: "north west",
        xlab: `ln ${it("T")}`, ylab: `ln ${it("E")}`, xlabTeX: "$\\ln T$", ylabTeX: "$\\ln E$",
        series: [
          { kind: "line", fn: (x) => b.ln.a + b.ln.b * x, color: "#1d4ed8", label: `ln ${it("E")} = ${fx(b.n, 3).replace("{,}", ",")}·ln ${it("T")} ${b.ln.a < 0 ? "−" : "+"} ${fx(Math.abs(b.ln.a), 2).replace("{,}", ",")}`, texColor: "ofblue", texFn: `${b.n.toFixed(5)}*x + (${b.ln.a.toFixed(4)})`, domain: [x0, x1], samples: 2, labelTeX: `$\\ln E = ${fx(b.n, 3)}\\ln T ${b.ln.a < 0 ? "-" : "+"} ${fx(Math.abs(b.ln.a), 2)}$` },
          { kind: "pts", data: b.rows.map((r) => [Math.log(r.T), Math.log(r.E)]), color: "#c2410c", label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
        ] } });
    }
    const r0 = b.rows[0];
    X.push({ t: "p", text: "**Hisoblash** (1-qator va eng kichik kvadratlar usuli, $E = s\\,(T^4 - T_0^4)$):" });
    X.push({ t: "eq", lines: [
      `\\sigma_1 &= \\frac{E L^2}{\\varepsilon a^2 (T^4 - T_0^4)} = \\frac{${fx(r0.E, 2)}\\cdot ${fx(L_RAD, 2)}^2}{${fx(EPS, 2)}\\cdot (${sx(A_AP, 1)})^2\\cdot ${sx(r0.X, 4)}} = ${sx(r0.si, 4)}\\ \\text{W/(m}^2\\text{K}^4)`,
      `\\sigma &= \\frac{s L^2}{\\varepsilon a^2} = (${sx(b.sigma, 4)} \\pm ${sx(Math.max(b.ssig, 1e-11), 2)})\\ \\text{W/(m}^2\\text{K}^4),\\qquad n = ${fx(b.n, 3)} \\pm ${fx(Math.max(b.sn, 0.001), 3)}`,
    ] });
    X.push({ t: "p", text: `Jadval qiymati: $\\sigma = 5{,}670\\cdot 10^{-8}$ W/(m$^2$K$^4$); farq $${fx((100 * (b.sigma - SIGMA)) / SIGMA, 1)}\\,\\%$.` });
  }
  let hk = null;
  if (A?.ok && B?.ok) {
    hk = hkFrom(A.A.b, B.A.sigma);
    S("Plank va Bolsman doimiylarini hisoblash");
    X.push({ t: "p", text: "(2) va (3) formulalardan $k$ va $h$ ni o‘lchangan $b$ va $\\sigma$ orqali ifodalash mumkin ($x = 4{,}965$):" });
    X.push({ t: "eq", lines: [
      `k &= \\frac{15\\,x^3 b^3 \\sigma}{2\\pi^5 c} = ${sx(hk.k, 4)}\\ \\text{J/K}\\qquad(\\text{jadvalda}\\ 1{,}381\\cdot 10^{-23},\\ \\text{farq}\\ ${fx((100 * (hk.k - K)) / K, 1)}\\,\\%)`,
      `h &= \\frac{x k b}{c} = ${sx(hk.h, 4)}\\ \\text{J}\\cdot\\text{s}\\qquad(\\text{jadvalda}\\ 6{,}626\\cdot 10^{-34},\\ \\text{farq}\\ ${fx((100 * (hk.h - H)) / H, 1)}\\,\\%)`,
    ] });

  }
  S("Xulosa");
  const box = [];
  if (A?.ok) box.push(`• Vin qonuni bajariladi: $\\lambda_{\\max} T = \\text{const}$, $b = ${sx(A.A.b, 3)}$ m·K.`);
  if (B?.ok) box.push(`• Stefan–Bolsman qonuni bajariladi: $n = ${fx(B.A.n, 2)} \\approx 4$, $\\sigma = ${sx(B.A.sigma, 3)}$ W/(m$^2$K$^4$).`);
  if (hk) box.push(`• Klassik nazariyada yo‘q bo‘lgan kvant doimiysi: $h = ${sx(hk.h, 3)}$ J·s; $k = ${sx(hk.k, 3)}$ J/K.`);
  docTail(X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Qora jism nurlanishi qonunlarini o‘rganish", titlePlain: "Laboratoriya ishi. Qora jism nurlanishi", author: nb.f.name, sub: "Plank formulasi, Vin siljish qonuni va Stefan–Bolsman qonuni", meta: docMeta(nb, userText), blocks: X };
}
