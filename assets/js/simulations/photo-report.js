// ==========================================================================
// Fotoeffekt — laboratoriya hisoboti mazmuni (→ labreport.js).
// ==========================================================================

import { fx, sx, userText } from "./labreport.js";
import { docMeta, docTail } from "./labnotebook.js";
import { H, QE, C, CATHODES, lineById, photonEv } from "./photo-physics.js";

export const SITE = { url: "https://oliyfizika.uz/simulations/photoeffect.html", label: "oliyfizika.uz/simulations/photoeffect.html" };
export const DOC_LABEL = "Virtual laboratoriya ishi · Kvant fizikasi";
const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
const SUB = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
const it = (t) => `<tspan font-style="italic">${t}</tspan>`;
const M = (t) => `$${t}$`;
const PAL = ["#1d4ed8", "#c2410c", "#15803d", "#7e22ce", "#0e7490", "#be123c"], TPAL = ["ofblue", "orange!80!black", "green!50!black", "violet!80!black", "cyan!60!black", "red!70!black"];
const plain = (s) => s.replace(/\{,\}/g, ",").replace(/\\cdot 10\^\{(-?\d+)\}/g, (_, e) => `·10${SUP(e.replace("-", "−"))}`);

/** res — createNotebook natijalari {t1: {A, flags, ok, cond}, t2: …}; curves — {kalit: {label, pts}} */
export function buildPhotoDoc(nb, res, curves) {
  const A = res.t1, B = res.t2, X = []; let sec = 1; const S = (t) => X.push({ t: "sec", text: `${sec++}. ${t}` });
  const cath = CATHODES[A.cond.cath] || CATHODES.Cs;

  S("Ishning maqsadi");
  X.push({ t: "list", items: [
    "Fotoeffekt qonunlarini o‘rganish: fotoelektronlarning maksimal kinetik energiyasi yorug‘lik chastotasiga bog‘liqligini va intensivligiga bog‘liq emasligini tekshirish.",
    "Tormozlovchi potensialning chastotaga bog‘liqligidan Plank doimiysi $h$, chiqish ishi $A$ va fotoeffektning qizil chegarasini aniqlash.",
    "To‘yinish tokining yorug‘lik oqimiga proporsionalligini (Stoletov qonunini) tekshirish.",
  ] });

  S("Qisqacha nazariya");
  X.push({ t: "p", text: "A. Eynshteyn (1905) bo‘yicha yorug‘lik energiyasi $h\\nu$ bo‘lgan porsiyalar — fotonlar bilan yutiladi. Foton energiyasi elektronni metalldan chiqarishga (chiqish ishi $A$) va unga kinetik energiya berishga sarflanadi:" });
  X.push({ t: "eq", tag: 1, lines: ["h\\nu = A + \\frac{m v_{\\max}^2}{2}"] });
  X.push({ t: "p", text: "Anodga tormozlovchi kuchlanish berilganda fototok $U_t$ da to‘xtaydi — eng tez elektronlar ham anodga yeta olmaydi: $m v_{\\max}^2/2 = eU_t$. Demak:" });
  X.push({ t: "eq", tag: 2, lines: ["U_t = \\frac{h}{e}\\,\\nu - \\frac{A}{e}"] });
  X.push({ t: "p", text: "$U_t(\\nu)$ grafigi to‘g‘ri chiziq: qiyaligi $h/e$, ordinata o‘qidagi kesmasi $-A/e$, abssissa o‘qini kesish nuqtasi — qizil chegara $\\nu_0 = A/h$, $\\lambda_0 = c/\\nu_0$. To‘yinish toki vaqt birligida chiqqan elektronlar soniga, ya’ni tushayotgan fotonlar soniga — yorug‘lik oqimi $\\Phi$ ga proporsional:" });
  X.push({ t: "eq", tag: 3, lines: ["I_{\\text{to‘y}} = \\frac{e N}{t} \\sim \\Phi"] });

  S("Jihozlar (virtual qurilma)");
  X.push({ t: "list", items: [
    "Simob lampasi va interferension filtrlar: $365{,}0$; $404{,}7$; $435{,}8$; $546{,}1$; $577{,}0$ nm.",
    "Diafragma (yorug‘lik oqimi $\\Phi = 20\\ldots 100\\,\\%$).",
    `Vakuumli fotoelement, katod: ${cath.name.replace(/^\w/, (ch) => ch.toLowerCase())}; manba $-3\\ldots +12$ V, voltmetr (0,01 V), nanoampermetr (0,001 nA).`,
  ] });
  S("Ishni bajarish tartibi");
  X.push({ t: "list", ordered: true, items: [
    "Filtrni o‘rnating, anod kuchlanishini manfiy tomonga asta oshirib, fototok nolga teng bo‘ladigan kuchlanish $U_t$ ni toping (nanoampermetr masshtabini kattalashtiring). Har bir filtr uchun takrorlang (1-jadval).",
    "Bitta filtr bilan diafragmani o‘zgartirib, $U = +10$ V dagi to‘yinish tokini va $U_t$ ni o‘lchang (2-jadval).",
    "$U_t(\\nu)$ va $I_{\\text{to‘y}}(\\Phi)$ grafiklarini chizing; $h$, $A$, $\\nu_0$ ni hisoblang.",
  ] });

  // 1-topshiriq
  if (A.ok) {
    S("1-topshiriq: tormozlovchi kuchlanishning chastotaga bog‘liqligi");
    X.push({ t: "table", caption: `**1-jadval.** Tormozlovchi kuchlanish (katod: ${cath.name.replace(/^\w/, (ch) => ch.toLowerCase())}, $\\Phi = 100\\,\\%$)`,
      head: ["№", "Filtr $\\lambda$, nm", "$\\nu$, $10^{14}$ Hz", "$h\\nu$, eV", "$U_t$, V", "Tekshiruv"],
      rows: A.A.rows.map((r, i) => [String(i + 1), M(fx(r.L.nm, 1)), M(fx(r.nu14, 3)), M(fx(photonEv(r.L.nm), 3)), M(fx(r.Us, 3)), A.flags[i] ? "$\\checkmark$" : "--"]),
      note: "«Tekshiruv»: $\\checkmark$ — qiymat qurilmada fototok nolga teng bo‘ladigan kuchlanishdan $\\pm 0{,}04$ V dan ko‘p farq qilmaydi." });
    const keys = Object.keys(curves || {}).filter((k) => curves[k].pts.length > 10).slice(-6);
    if (keys.length) {
      const imax = Math.max(...keys.flatMap((k) => curves[k].pts.map((p) => p[1]))) * 1.1;
      X.push({ t: "fig", id: "iv", caption: "**1-rasm.** Fotoelementning volt-amper xarakteristikalari (o‘lchangan). Manfiy kuchlanishlarda tok $U_t$ da nolga tushadi.", plot: {
        xmin: -3, xmax: 12, ymin: Math.min(0, ...keys.flatMap((k) => curves[k].pts.map((p) => p[1]))) * 1.1, ymax: imax, legendPos: "north west",
        xlab: `Anod kuchlanishi ${it("U")}, V`, ylab: `Fototok ${it("I")}, nA`, xlabTeX: "Anod kuchlanishi $U$, V", ylabTeX: "Fototok $I$, nA",
        series: keys.map((k, i) => ({ kind: "line", data: curves[k].pts.slice().sort((a, b) => a[0] - b[0]), color: PAL[i % 6], label: curves[k].label, texColor: TPAL[i % 6], labelTeX: curves[k].labelTeX })),
      } });
    }
    const a = A.A, f = a.fit, xmax = 9;
    X.push({ t: "fig", id: "us", caption: "**2-rasm.** Tormozlovchi kuchlanishning yorug‘lik chastotasiga bog‘liqligi. Abssissa o‘qi bilan kesishish — qizil chegara $\\nu_0$.", plot: {
      xmin: 4, xmax: xmax, ymin: Math.min(-0.2, f.a + f.b * 4e14 - 0.1), ymax: Math.max(...a.rows.map((r) => r.Us)) * 1.25, legendPos: "north west", xticks: [4, 5, 6, 7, 8, 9],
      xlab: `Chastota ${it("ν")}, 10${SUP("14")} Hz`, ylab: `${it("U")}${SUB("t")}, V`, xlabTeX: "Chastota $\\nu$, $10^{14}$ Hz", ylabTeX: "$U_t$, V",
      series: [
        { kind: "line", fn: (x) => f.a + f.b * x * 1e14, color: PAL[0], label: `EKK: ${it("U")}${SUB("t")} = ${plain(fx(f.b * 1e14, 4))}·${it("ν")} − ${plain(fx(-f.a, 3))}`, texColor: "ofblue", texFn: `${(f.b * 1e14).toFixed(6)}*x + (${f.a.toFixed(5)})`, domain: [4, xmax], samples: 2, labelTeX: `EKK: $U_t=${fx(f.b * 1e14, 4)}\\,\\nu-${fx(-f.a, 3)}$` },
        { kind: "line", data: [[4, 0], [xmax, 0]], color: "#64748b", dash: "3 3", texColor: "black!50" },
        { kind: "pts", data: a.rows.map((r) => [r.nu14, r.Us, r.Us - 0.01, r.Us + 0.01]), color: PAL[1], label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
      ] } });
    X.push({ t: "p", text: "**Hisoblash** (eng kichik kvadratlar usuli, $U_t = k\\nu + b$):" });
    X.push({ t: "eq", lines: [
      `k &= \\frac{h}{e} = (${sx(f.b, 4)} \\pm ${sx(Math.max(f.sb, 1e-18), 2)})\\ \\text{V}\\cdot\\text{s},\\qquad b = -\\frac{A}{e} = (${fx(f.a, 3)} \\pm ${fx(Math.max(f.sa, 0.001), 3)})\\ \\text{V}`,
      `h &= e\\,k = 1{,}602\\cdot 10^{-19}\\ \\text{C}\\cdot ${sx(f.b, 4)}\\ \\text{V}\\cdot\\text{s} = (${sx(a.h, 4)} \\pm ${sx(Math.max(a.sh, 1e-37), 2)})\\ \\text{J}\\cdot\\text{s}`,
      `A &= -e\\,b = ${fx(a.W, 3)}\\ \\text{eV},\\qquad \\nu_0 = \\frac{A}{h} = -\\frac{b}{k} = ${sx(a.nu0, 4)}\\ \\text{Hz},\\qquad \\lambda_0 = \\frac{c}{\\nu_0} = ${fx(a.lam0, 0)}\\ \\text{nm}`,
    ] });
    X.push({ t: "p", text: `Jadvaldagi qiymatlar: $h = 6{,}626\\cdot 10^{-34}$ J·s (farq $${fx((100 * (a.h - H)) / H, 1)}\\,\\%$); ${cath.id} uchun $A = ${fx(cath.W, 2)}$ eV (farq $${fx((100 * (a.W - cath.W)) / cath.W, 1)}\\,\\%$). Tormozlovchi kuchlanish odatda biroz kichik o‘lchanadi: tok nolga asimptotik yaqinlashadi va anoddan kichik teskari tok bor.` });
  }

  // 2-topshiriq
  if (B.ok) {
    const b = B.A, L = lineById(B.cond.line);
    S("2-topshiriq: to‘yinish tokining yorug‘lik oqimiga bog‘liqligi");
    X.push({ t: "table", caption: `**${A.ok ? 2 : 1}-jadval.** To‘yinish toki va tormozlovchi kuchlanish ($\\lambda = ${fx(L.nm, 1)}$ nm, $U = +10$ V)`,
      head: ["№", "$\\Phi$, %", "$I_{\\text{to‘y}}$, nA", "$I_{\\text{to‘y}}/\\Phi$, nA/%", "$U_t$, V", "Tekshiruv"],
      rows: b.rows.map((r, i) => [String(i + 1), M(fx(r.inten, 0)), M(fx(r.Is, 3)), M(fx(r.Is / r.inten, 4)), Number.isFinite(r.Us) ? M(fx(r.Us, 3)) : "--", B.flags[i] ? "$\\checkmark$" : "--"]) });
    X.push({ t: "fig", id: "is", caption: `**${A.ok ? 3 : 1}-rasm.** To‘yinish tokining yorug‘lik oqimiga bog‘liqligi (Stoletov qonuni).`, plot: {
      xmin: 0, xmax: 110, ymin: 0, ymax: Math.max(...b.rows.map((r) => r.Is)) * 1.25, xticks: [0, 20, 40, 60, 80, 100], legendPos: "north west",
      xlab: `Yorug‘lik oqimi ${it("Φ")}, %`, ylab: `${it("I")}${SUB("to‘y")}, nA`, xlabTeX: "Yorug‘lik oqimi $\\Phi$, \\%", ylabTeX: "$I_{\\text{to‘y}}$, nA",
      series: [
        { kind: "line", fn: (x) => b.fit.k * x, color: PAL[0], label: `${it("I")} = ${plain(fx(b.fit.k, 4))}·${it("Φ")}`, texColor: "ofblue", texFn: `${b.fit.k.toFixed(6)}*x`, domain: [0, 110], samples: 2, labelTeX: `$I=${fx(b.fit.k, 4)}\\,\\Phi$` },
        { kind: "pts", data: b.rows.map((r) => [r.inten, r.Is]), color: PAL[1], label: "tajriba", texColor: "orange!80!black", labelTeX: "tajriba" },
      ] } });
    const lines = [`I_{\\text{to‘y}} &= k\\,\\Phi,\\qquad k = (${fx(b.fit.k, 4)} \\pm ${fx(Math.max(b.fit.sk, 1e-4), 4)})\\ \\text{nA}/\\%`];
    if (b.lin) lines.push(`I_{\\text{to‘y}} &= a + k'\\Phi:\\quad a = ${fx(b.lin.a, 3)} \\pm ${fx(Math.max(b.lin.sa, 0.001), 3)}\\ \\text{nA}\\ (\\approx 0)`);
    if (b.Us) lines.push(`\\overline{U_t} &= (${fx(b.Us.m, 3)} \\pm ${fx(b.Us.sd, 3)})\\ \\text{V}\\quad(${b.Us.n}\\ \\text{ta intensivlikda})`);
    X.push({ t: "eq", lines });
    X.push({ t: "p", text: "To‘yinish toki yorug‘lik oqimiga proporsional, tormozlovchi kuchlanish esa (demak, fotoelektronlarning maksimal kinetik energiyasi ham) intensivlikka bog‘liq emas — klassik to‘lqin nazariyasi buni tushuntira olmaydi." });
  }

  S("Xulosa");
  const box = [];
  if (A.ok) box.push(`• $U_t$ chastotaga chiziqli bog‘liq; $h = ${sx(A.A.h, 3)}$ J·s, $A = ${fx(A.A.W, 2)}$ eV, qizil chegara $\\lambda_0 = ${fx(A.A.lam0, 0)}$ nm.`);
  if (B.ok) box.push(`• To‘yinish toki yorug‘lik oqimiga proporsional${B.A.Us ? `, $U_t$ intensivlikka bog‘liq emas ($${fx(B.A.Us.m, 3)}\\pm${fx(B.A.Us.sd, 3)}$ V)` : ""}.`);
  box.push("• Eynshteyn tenglamasi va yorug‘likning kvant tabiati tasdiqlandi.");
  docTail(X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Tashqi fotoeffektni o‘rganish va Plank doimiysini aniqlash", titlePlain: "Laboratoriya ishi. Tashqi fotoeffekt", author: nb.f.name, sub: "Eynshteyn tenglamasi, tormozlovchi potensial va Stoletov qonuni", meta: docMeta(nb, userText), blocks: X };
}
export { QE, C };
