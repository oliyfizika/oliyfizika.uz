// ==========================================================================
// Laboratoriya ishi: Difraksion panjara yordamida yorug‘lik to‘lqin uzunligini aniqlash (simulations/lab-difraksion-panjara.html).
// Darslik: 11-sinf §26. Qurilma: lazer, difraksion panjara (50/100/200 shtrix/mm), panjaradan L masofadagi shkalali ekran.
// Yuqorida — qurilmaning yon ko‘rinishi (skameyka shkalasi), pastda — ekran old tomondan (mm shkala, maksimumlar dog‘lari).
// Fizika: diffraction-physics.js (panjara maksimumlari d sin φ = kλ, intensivlik qobig‘i).
// ==========================================================================

import { createLab, docKit, fitOrigin, meanErr, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { orderAngle, waveRGB, gratingI } from "./diffraction-physics.js";
import { rulerH, label, hint, rr, F } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-difraksion-panjara.html", label: "oliyfizika.uz/simulations/lab-difraksion-panjara.html" };
const LASERS = { red: { name: "Qizil lazer", nm: 654, ref: 650 }, green: { name: "Yashil lazer", nm: 532, ref: 532 }, x: { name: "Noma’lum lazer", nm: 594, ref: null } };
const GRATS = { g50: { name: "50 shtrix/mm", d: 20e-6, dmm: "0,02" }, g100: { name: "100 shtrix/mm", d: 10e-6, dmm: "0,01" }, g200: { name: "200 shtrix/mm", d: 5e-6, dmm: "0,005" } };
const XMAX = 30; // ekran shkalasi ±30 cm
const st = { las: "red", gr: "g100", L: 60, k: 1 };
const geo = {};

const pos = (k) => { const p = orderAngle(k, LASERS[st.las].nm * 1e-9, GRATS[st.gr].d); return p === null ? null : st.L * Math.tan(p); }; // cm
const orders = () => { const out = []; for (let k = -6; k <= 6; k++) { const x = pos(k); if (x !== null && Math.abs(x) <= XMAX) out.push([k, x]); } return out; };
const reading = () => { const a = pos(st.k), b = pos(-st.k); return a === null || Math.abs(a) > XMAX ? null : Math.round(((a - b) / 2) * 10) / 10; };

const LAY = {
  wide: { top: { y: 70, x0: 110, k: 5 }, scr: { x0: 30, x1: 650, y: 200, h: 70 } },
  narrow: { top: { y: 70, x0: 50, k: 3.3 }, scr: { x0: 14, x1: 386, y: 210, h: 70 } },
};
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, L = narrow ? LAY.narrow : LAY.wide, las = LASERS[st.las], [r, g, b] = waveRGB(las.nm).map((v) => Math.round(v * 255));
  const T = L.top, xs = T.x0 + st.L * T.k, col = `rgb(${r},${g},${b})`;
  // yon ko‘rinish: skameyka
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8"; ctx.fillRect(10, T.y + 26, w - 20, 6);
  rulerH(ctx, c, T.x0, T.y + 34, T.k, 100, { h: 16, sub: 1, step: 10, labelEvery: narrow ? 2 : 1 });
  // lazer
  ctx.fillStyle = "#1f2937"; rr(ctx, T.x0 - (narrow ? 44 : 80), T.y - 7, narrow ? 34 : 56, 14, 4); ctx.fill(); ctx.fillStyle = col; ctx.fillRect(T.x0 - (narrow ? 12 : 26), T.y - 2, 4, 4);
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(T.x0 - (narrow ? 10 : 24), T.y); ctx.lineTo(T.x0, T.y); ctx.stroke();
  // panjara
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#475569"; ctx.fillRect(T.x0 - 2, T.y - 22, 4, 44); ctx.fillRect(T.x0 - 1, T.y + 22, 2, 8);
  label(ctx, "panjara", T.x0, T.y - 30, c.text2, F(9, 700));
  // nurlar (haqiqiy masshtab: yon ko‘rinishda 1 cm = T.k px)
  ctx.save(); ctx.beginPath(); ctx.rect(T.x0, T.y - 62, w, 86); ctx.clip();
  for (const [k, x] of orders()) { const I = Math.abs(k) ? 0.4 + 0.6 * Math.sqrt(intensity(k)) : 1; ctx.strokeStyle = col; ctx.globalAlpha = 0.25 + 0.6 * I; ctx.lineWidth = k ? 1 : 1.6; ctx.beginPath(); ctx.moveTo(T.x0, T.y); ctx.lineTo(xs, T.y - x * T.k); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.restore();
  // ekran (yon)
  ctx.fillStyle = c.dark ? "#e2e8f0" : "#f8fafc"; ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.fillRect(xs - 3, T.y - 60, 6, 86); ctx.strokeRect(xs - 3, T.y - 60, 6, 86);
  ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.moveTo(xs, T.y + 34); ctx.lineTo(xs - 5, T.y + 28); ctx.lineTo(xs + 5, T.y + 28); ctx.closePath(); ctx.fill();
  label(ctx, `ekran · L = ${fmt(st.L, 1)} cm`, Math.min(xs, w - 60), T.y - 66, c.text2, F(9, 700));
  geo.scrX = xs; geo.top = T;
  // ekran old tomondan
  const Sc = L.scr, sk = (Sc.x1 - Sc.x0) / (2 * XMAX), cx = (Sc.x0 + Sc.x1) / 2;
  ctx.fillStyle = c.dark ? "#0b1220" : "#111827"; rr(ctx, Sc.x0 - 8, Sc.y - 30, Sc.x1 - Sc.x0 + 16, Sc.h + 62, 8); ctx.fill();
  ctx.fillStyle = "#e7e5e4"; ctx.fillRect(Sc.x0, Sc.y, Sc.x1 - Sc.x0, Sc.h);
  // mm shkala
  ctx.strokeStyle = "#1c1917";
  for (let mm = -XMAX * 10; mm <= XMAX * 10; mm += narrow ? 2 : 1) {
    const xx = cx + (mm / 10) * sk, big = mm % 100 === 0, mid = mm % 50 === 0, cm = mm % 10 === 0;
    ctx.lineWidth = big ? 1.2 : 0.6; ctx.beginPath(); ctx.moveTo(xx, Sc.y + Sc.h); ctx.lineTo(xx, Sc.y + Sc.h - (big ? 16 : mid ? 11 : cm ? 8 : 4)); ctx.stroke();
    if (big || (!narrow && mid)) label(ctx, String(Math.abs(mm / 10)), xx, Sc.y + Sc.h + 9, "#e5e7eb", F(9, 700));
  }
  // dog‘lar
  geo.spots = [];
  for (const [k, x] of orders()) {
    const xx = cx + x * sk, yy = Sc.y + Sc.h * 0.42, I = Math.max(0.12, Math.sqrt(intensity(k))), rad = k ? 7 : 9;
    const gr = ctx.createRadialGradient(xx, yy, 0, xx, yy, rad * 2.2); gr.addColorStop(0, `rgba(255,255,255,${0.9 * I})`); gr.addColorStop(0.3, `rgba(${r},${g},${b},${I})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(xx, yy, rad * 2.2, 0, Math.PI * 2); ctx.fill();
    if (Math.abs(k) === st.k) { ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(xx, yy, rad * 2.2 + 2, 0, Math.PI * 2); ctx.stroke(); }
    label(ctx, String(k), xx, Sc.y - 12, Math.abs(k) === st.k ? "#93c5fd" : "#9ca3af", F(10, 700));
    if (k) geo.spots.push({ k, x: xx, y: yy });
  }
  label(ctx, "k =", Sc.x0 + 4, Sc.y - 12, "#9ca3af", F(9, 700), "left");
  label(ctx, "cm", Sc.x1 - 2, Sc.y - 12, "#9ca3af", F(9, 700), "right");
  geo.scr = { x0: Sc.x0, x1: Sc.x1, y0: Sc.y - 24, y1: Sc.y + Sc.h };
  hint(ctx, c, "ekranni suring", Math.min(xs + 10, w - 100), T.y - 40);
  hint(ctx, c, "maksimum dog‘ini bosing — tartibini tanlash", Sc.x0, h - 10);
}
function intensity(k) {
  const lam = LASERS[st.las].nm * 1e-9, d = GRATS[st.gr].d, p = orderAngle(k, lam, d);
  return p === null ? 0 : Math.max(0.02, gratingI(Math.sin(p) + 1e-12, lam, d, 0.32 * d, 1));
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows, cond) {
  const d = GRATS[cond?.gr]?.d ?? GRATS.g100.d;
  const rs = rows.slice().sort((a, b) => a.L - b.L || a.k - b.k).map((r) => { const s = Math.sin(Math.atan(r.x / r.L)); return { ...r, s, lam: (d * s) / r.k * 1e9, lam0: (d * r.x) / (r.k * r.L) * 1e9 }; });
  const m = meanErr(rs.map((r) => r.lam)), f = rs.length >= 2 ? fitOrigin(rs.map((r) => [r.k, r.s])) : null;
  return { rows: rs, d, m, f, lamFit: f ? f.k * d * 1e9 : NaN, ok: rs.length >= 3 && new Set(rs.map((r) => `${r.L}|${r.k}`)).size >= 3 };
}
function build(nb, res) {
  const A = res.t1.A, cond = res.t1.cond, Ls = LASERS[cond.las] || LASERS.red, Gr = GRATS[cond.gr] || GRATS.g100, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Difraksion panjara yordamida lazer nurining to‘lqin uzunligini aniqlash.", "Panjara formulasini tekshirish."]);
  D.S("Qisqacha nazariya");
  D.p("Davri $d$ bo‘lgan panjaraga normal tushgan monoxromatik yorug‘likning bosh maksimumlari quyidagi shart bajariladigan yo‘nalishlarda kuzatiladi:");
  D.eq("d\\sin\\varphi = k\\lambda,\\qquad k = 0, \\pm 1, \\pm 2, \\ldots", 1);
  D.p("Ekran panjaradan $L$ masofada bo‘lsa, $k$-maksimumning markazdan uzoqligi $x$ uchun $\\operatorname{tg}\\varphi = x/L$. Kichik burchaklarda $\\sin\\varphi \\approx \\operatorname{tg}\\varphi$, shuning uchun:");
  D.eq("\\lambda = \\frac{d\\sin\\varphi}{k} \\approx \\frac{d\\,x}{k\\,L}", 2);
  D.S("Jihozlar");
  D.list([`${Ls.name}.`, `Difraksion panjara ${Gr.name} ($d = ${Gr.dmm}$ mm).`, "Shkalali ekran (bo‘linma qiymati $1$ mm), optik skameyka ($L$ — $0{,}5$ cm aniqlikda)."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Lazer nuri panjaraga normal yo‘naltirildi, ekran panjaradan $L$ masofaga qo‘yildi.", "Ekranda markaziy maksimumdan chap va o‘ngdagi $k$-tartibli maksimumlar orasidagi masofa $2x$ o‘lchanib, $x$ topildi.", "O‘lchash turli $L$ va $k$ uchun takrorlandi; har holda $\\lambda$ hisoblandi."], true);
  D.S("O‘lchash natijalari");
  D.table(`Maksimumlar holati (${Ls.name}, ${Gr.name})`, ["№", "$L$, cm", "$k$", "$x$, cm", "$\\sin\\varphi$", "$\\lambda$, nm", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.L, 1)}$`, `$${fx(r.k, 0)}$`, `$${fx(r.x, 1)}$`, `$${fx(r.s, 4)}$`, `$${fx(r.lam, 0)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
    "$\\sin\\varphi = \\sin(\\operatorname{arctg}(x/L))$.");
  if (A.f) D.fig("grat", "$\\sin\\varphi$ ning maksimum tartibi $k$ ga bog‘liqligi; qiyalik $\\lambda/d$.", { xmin: 0, xmax: Math.max(...A.rows.map((r) => r.k)) + 0.5, ymin: 0, ymax: Math.max(...A.rows.map((r) => r.s)) * 1.25, legendPos: "north west", xlab: "k", ylab: "sin φ",
    series: [{ kind: "pts", data: A.rows.map((r) => [r.k, r.s]), color: "#c2410c", label: "tajriba" }, { kind: "line", fn: (x) => A.f.k * x, color: "#1d4ed8", label: `sin φ = ${fmt(A.f.k, 4)}·k` }] });
  const r0 = A.rows[0];
  D.p("**Hisoblash:**");
  D.eq([`\\lambda_1 = \\frac{d\\sin\\varphi}{k} = \\frac{${Gr.dmm}\\cdot 10^{-3}\\ \\text{m} \\cdot ${fx(r0.s, 4)}}{${fx(r0.k, 0)}} = ${fx(r0.lam, 0)}\\ \\text{nm}\\quad\\left(\\text{taqribiy: } \\frac{dx}{kL} = ${fx(r0.lam0, 0)}\\ \\text{nm}\\right)`,
    `\\langle\\lambda\\rangle = (${fx(A.m.m, 0)} \\pm ${fx(Math.max(A.m.s, 0.5), 0)})\\ \\text{nm}`]);
  const box = [`• ${Ls.name} to‘lqin uzunligi $\\lambda = (${fx(A.m.m, 0)} \\pm ${fx(Math.max(A.m.s, 0.5), 0)})$ nm${Ls.ref ? ` (pasportdagi qiymat $${Ls.ref}$ nm, farq $${fx(Math.abs(pct(A.m.m, Ls.ref)), 1)}$ %)` : ""}.`, "• Maksimum tartibi ortgan sari og‘ish burchagi ortadi; $\\sin\\varphi$ tartibga proporsional — panjara formulasi tasdiqlandi."];
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Difraksion panjara yordamida yorug‘lik to‘lqin uzunligini aniqlash", titlePlain: "Laboratoriya ishi. Difraksion panjara", author: nb.f.name, sub: `${Ls.name}, ${Gr.name}`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "grating", fileBase: "Panjara-lab", docLabel: "Virtual laboratoriya ishi · 11-sinf", site: SITE,
  vh: (n) => (n ? 320 : 320),
  draw,
  down(x, y) {
    const T = geo.top;
    if (Math.abs(x - geo.scrX) < 16 && y > T.y - 70 && y < T.y + 52) return "scr";
    if (y > geo.scr.y0 - 6 && y < geo.scr.y1 + 6) { let best = null; for (const s of geo.spots) if (Math.abs(x - s.x) < 18 && (!best || Math.abs(x - s.x) < Math.abs(x - best.x))) best = s; if (best) { st.k = Math.abs(best.k); return true; } }
    return null;
  },
  move(h, x) { const T = geo.top; st.L = Math.max(20, Math.min(100, Math.round(((x - T.x0) / T.k) * 2) / 2)); },
  cursor(x, y) { const T = geo.top; if (T && Math.abs(x - geo.scrX) < 16 && y > T.y - 70 && y < T.y + 52) return "ew-resize"; return geo.spots?.some((s) => Math.abs(x - s.x) < 18 && y > geo.scr.y0 - 6 && y < geo.scr.y1 + 6) ? "pointer" : ""; },
  controls: [
    { type: "seg", label: "Lazer", opts: Object.entries(LASERS).map(([k, v]) => [k, v.name]), get: () => st.las, set: (v) => { st.las = v; } },
    { type: "seg", label: "Panjara", opts: Object.entries(GRATS).map(([k, v]) => [k, v.name]), get: () => st.gr, set: (v) => { st.gr = v; if (reading() === null) st.k = 1; } },
    { type: "range", label: "Ekrangacha masofa L", min: 20, max: 100, step: 0.5, get: () => st.L, set: (v) => { st.L = v; if (reading() === null) st.k = 1; }, fmt: (v) => `${fmt(v, 1)} cm` },
    { type: "note", text: "Ekrandagi ±k maksimumlar orasidagi masofaning yarmi x qayd qilinadi. Tartibni dog‘ni bosib tanlang." },
  ],
  readouts() {
    const x = reading();
    return [["Masofa <i>L</i>", `${fmt(st.L, 1)}<small>cm</small>`, "panjaradan ekrangacha", "blue"], [`Maksimum <i>k</i> = ${st.k}`, x === null ? "—" : `${fmt(x, 1)}<small>cm</small>`, "markazdan (x = ½·oraliq)", "orange"],
      ["Panjara", GRATS[st.gr].name, `d = ${GRATS[st.gr].dmm} mm`], ["Lazer", LASERS[st.las].name, "λ — noma’lum"]];
  },
  record() {
    const x = reading();
    if (x === null) return { err: `${st.k}-tartibli maksimum ekranga tushmayapti — ekranni yaqinlashtiring yoki boshqa tartibni tanlang.` };
    const v = { L: fmt(st.L, 1), k: String(st.k), x: fmt(x, 1) };
    return { t: "t1", v, text: `${LASERS[st.las].name}, ${GRATS[st.gr].name}: L = ${v.L} cm, k = ${v.k}, x = ${v.x} cm` };
  },
  explain() { const n = orders().filter(([k]) => k > 0).length; return `Ekranda markaziy maksimumdan har tomonda ${n} tadan maksimum ko‘rinmoqda. Shtrixlar zichroq (d kichik) panjarada maksimumlar uzoqroq joylashadi; qizil nur yashilga qaraganda kuchliroq og‘adi.`; },
  steps: ["Lazer va panjarani tanlang. Ekranni panjaradan L masofaga qo‘ying (masalan, 50 cm).", "Ekrandagi 1-tartibli maksimumni bosing va <b>Qaydga yozing</b> (x — ±1 dog‘lar oralig‘ining yarmi). Ko‘rinsa, 2-, 3-tartibni ham yozing.", "L ni o‘zgartirib (masalan, 70 va 90 cm) takrorlang.", "Qaydlarni jadvalga o‘tkazing: λ avtomatik. Noma’lum lazer to‘lqin uzunligini ham toping. Xulosa va PDF."],
  formulas: ["Panjara formulasi: <span class=\"sim-math\">d sin φ = kλ</span>", "<span class=\"sim-math\">tg φ = x / L</span>", "Kichik burchaklarda: <span class=\"sim-math\">λ ≈ dx / (kL)</span>", "Panjara davri: <span class=\"sim-math\">d = 1 / N</span> (N — 1 mm dagi shtrixlar soni)"],
  note: "Ko‘rinadigan yorug‘lik: binafsha ≈ 400 nm … qizil ≈ 700 nm.",
  notebook: {
    intro: "Jadval sharti — lazer va panjara. Kamida 3 ta o‘lchash (turli L yoki k).",
    conclusionPh: "Lazer nurining to‘lqin uzunligi qancha chiqdi? Natija L va k ga bog‘liqmi?",
    hint: "Javob bering: 1) λ qancha va u qaysi rangga mos? 2) Turli L va k da λ bir xil chiqdimi? 3) Panjara davri kichraysa maksimumlar qanday joylashadi? 4) Xatoning asosiy manbai nima?",
    tables: [
      { key: "t1", okLabel: "To‘lqin uzunligi", need: "kamida 3 ta o‘lchash", title: "Maksimumlar holati va to‘lqin uzunligi",
        cond: { fields: [{ k: "las", label: "Lazer", opts: Object.entries(LASERS).map(([k, v]) => [k, v.name]) }, { k: "gr", label: "Panjara", opts: Object.entries(GRATS).map(([k, v]) => [k, v.name]) }], sync: () => ({ las: st.las, gr: st.gr }), init: { las: "red", gr: "g100" } },
        head: ["L, cm", "k", "x, cm", "λ, nm", "Tekshiruv"], cols: [{ k: "L", kind: "num" }, { k: "k", kind: "num" }, { k: "x", kind: "num" }], outs: ["lam"],
        blank: () => ({ L: "", k: "", x: "" }), rows: 4, max: 12, narrow: true,
        parse: (r) => ({ L: num(r.L), k: num(r.k), x: num(r.x) }), check: (r) => (!(r.L > 0) || !(r.k >= 1) || !(r.x > 0) ? { ok: false, err: "L, x > 0; k ≥ 1" } : { ok: true }),
        analyze, out: (A, j, r) => ({ lam: fmt((A.d * Math.sin(Math.atan(r.x / r.L))) / r.k * 1e9, 0) }),
        summary: (A) => (A.rows.length ? [["To‘lqin uzunligi λ", `${fmt(A.m.m, 0)} nm`, A.rows.length > 1 ? `± ${fmt(Math.max(A.m.s, 0.5), 0)} nm` : ""]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
