// ==========================================================================
// Laboratoriya ishi: Shishaning sindirish ko‘rsatkichini aniqlash (simulations/lab-sindirish.html). Darslik: 9-sinf §49.
// Qurilma: yassi-parallel plastinka (shisha, organik shisha yoki suvli kyuveta) qog‘oz ustida, lazer ko‘rsatkich,
// plastinka sirtidagi tushish nuqtasiga markazlangan transportir. Burchaklar transportirdan (lupa bilan) 0,5° aniqlikda o‘qiladi.
// Fizika: Snellius qonuni sin α = n sin β; plastinkadan chiqqan nur tushgan nurga parallel (siljigan).
// ==========================================================================

import { createLab, docKit, fitOrigin, meanErr, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { label, hint, rr, dot, F } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-sindirish.html", label: "oliyfizika.uz/simulations/lab-sindirish.html" };
const MATS = {
  glass: { name: "Shisha plastinka (kron)", short: "Shisha", n: 1.517, ref: 1.5, col: "rgba(125,211,252,0.28)" },
  pmma: { name: "Organik shisha (pleksiglas)", short: "Pleksiglas", n: 1.491, ref: 1.49, col: "rgba(199,210,254,0.32)" },
  water: { name: "Suvli kyuveta", short: "Suv", n: 1.333, ref: 1.33, col: "rgba(56,189,248,0.22)" },
};
const D2R = Math.PI / 180;
const st = { m: "glass", a: 40 };
const geo = {};
const half = (v) => Math.round(v * 2) / 2;
const beta = () => Math.asin(Math.sin(st.a * D2R) / MATS[st.m].n) / D2R;

const LAY = {
  wide: { x0: 120, x1: 530, top: 140, bot: 270, O: [330, 140], R: 112, src: 156, lupa: [[548, 26, 124, 62], [548, 196, 124, 62]] },
  narrow: { x0: 24, x1: 376, top: 160, bot: 280, O: [200, 160], R: 100, src: 140, lupa: [[12, 312, 180, 62], [208, 312, 180, 62]] },
};

function protractor(ctx, c, O, R) {
  ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.55)" : "rgba(30,41,59,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(O[0], O[1], R, 0, Math.PI * 2); ctx.stroke();
  for (let d = 0; d < 360; d += 1) {
    const a = d * D2R, len = d % 10 === 0 ? 10 : d % 5 === 0 ? 7 : 4;
    ctx.beginPath(); ctx.moveTo(O[0] + Math.sin(a) * R, O[1] - Math.cos(a) * R); ctx.lineTo(O[0] + Math.sin(a) * (R - len), O[1] - Math.cos(a) * (R - len)); ctx.stroke();
    if (d % 10 === 0) { const v = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d; label(ctx, String(v), O[0] + Math.sin(a) * (R - 19), O[1] - Math.cos(a) * (R - 19), c.text3, F(8, 600)); }
  }
}
/** Lupa: nur transportir shkalasini kesib o‘tgan joy kattalashtirilgan (±4°). ang — normaldan hisoblangan burchak. */
function lupa(ctx, c, box, ang, title) {
  const [x, y, w, h] = box, cx = x + w / 2, ppd = w / 9;
  ctx.fillStyle = c.dark ? "#0f172a" : "#ffffff"; rr(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = c.dark ? "#475569" : "#cbd5e1"; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); rr(ctx, x, y, w, h, 8); ctx.clip();
  const base = y + h - 14, lo = Math.floor((ang - 5) * 2) / 2;
  ctx.strokeStyle = c.dark ? "#e2e8f0" : "#1e293b";
  for (let v = lo; v <= ang + 5; v += 0.5) {
    const xx = cx + (v - ang) * ppd, big = Math.abs(v - Math.round(v)) < 1e-9, five = big && Math.round(v) % 5 === 0;
    ctx.lineWidth = five ? 1.4 : 1; ctx.beginPath(); ctx.moveTo(xx, base); ctx.lineTo(xx, base - (five ? 22 : big ? 15 : 9)); ctx.stroke();
    if (big && v >= 0) label(ctx, String(Math.round(v)), xx, base + 7, c.text2, F(five ? 9 : 8, five ? 700 : 500));
  }
  ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, y + 16); ctx.lineTo(cx, base); ctx.stroke();
  ctx.restore();
  label(ctx, title, x + 8, y + 9, c.text2, F(9, 700), "left");
}

function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, L = narrow ? LAY.narrow : LAY.wide, M = MATS[st.m], O = L.O;
  // qog‘oz
  ctx.fillStyle = c.dark ? "#1e293b" : "#fafaf9"; ctx.fillRect(0, 0, w, h);
  // plastinka
  ctx.fillStyle = M.col; ctx.fillRect(L.x0, L.top, L.x1 - L.x0, L.bot - L.top);
  ctx.strokeStyle = c.dark ? "#7dd3fc" : "#0369a1"; ctx.lineWidth = 1.5; ctx.strokeRect(L.x0, L.top, L.x1 - L.x0, L.bot - L.top);
  label(ctx, M.short, L.x1 - 8, L.bot - 12, c.dark ? "#7dd3fc" : "#0369a1", F(10, 700), "right");
  // normal
  ctx.setLineDash([5, 4]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(O[0], O[1] - L.R - 10); ctx.lineTo(O[0], O[1] + L.R + 10); ctx.stroke(); ctx.setLineDash([]);
  protractor(ctx, c, O, L.R);
  // nurlar
  const a = st.a * D2R, b = beta() * D2R;
  const S0 = [O[0] - Math.sin(a) * L.src, O[1] - Math.cos(a) * L.src];
  geo.src = S0; geo.O = O; geo.L = L;
  const ray = (p, q, wid = 2.4, al = 1) => { ctx.strokeStyle = `rgba(239,68,68,${al})`; ctx.lineWidth = wid; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
  ray(S0, O);
  const R0 = (() => { const n = M.n, ci = Math.cos(a), ct = Math.cos(b); const rs = ((ci - n * ct) / (ci + n * ct)) ** 2, rp = ((n * ci - ct) / (n * ci + ct)) ** 2; return (rs + rp) / 2; })();
  ray(O, [O[0] + Math.sin(a) * L.src, O[1] - Math.cos(a) * L.src], 1.6, Math.min(0.9, 0.15 + R0 * 3));
  const E = [O[0] + Math.tan(b) * (L.bot - L.top), L.bot];
  ray(O, E);
  const far = h + 40; ray(E, [E[0] + Math.tan(a) * (far - E[1]), far]);
  // lazer
  ctx.save(); ctx.translate(S0[0], S0[1]); ctx.rotate(Math.atan2(O[1] - S0[1], O[0] - S0[0]));
  ctx.fillStyle = "#334155"; rr(ctx, -44, -7, 46, 14, 4); ctx.fill(); ctx.fillStyle = "#ef4444"; ctx.fillRect(-2, -3, 4, 6); ctx.restore();
  dot(ctx, O[0], O[1], 2.5, "#dc2626");
  // lupalar
  lupa(ctx, c, L.lupa[0], st.a, "Lupa: tushish burchagi α");
  lupa(ctx, c, L.lupa[1], beta(), "Lupa: sinish burchagi β");
  hint(ctx, c, "lazerni aylana bo‘ylab suring", narrow ? 12 : 12, narrow ? 20 : 20);
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows) {
  const rs = rows.slice().sort((x, y) => x.a - y.a).map((r) => { const sa = Math.sin(r.a * D2R), sb = Math.sin(r.b * D2R); return { ...r, sa, sb, n: sb > 0 ? sa / sb : NaN }; });
  const good = rs.filter((r) => r.a > 0 && Number.isFinite(r.n)), m = meanErr(good.map((r) => r.n)), f = good.length >= 2 ? fitOrigin(good.map((r) => [r.sb, r.sa])) : null;
  return { rows: rs, m, f, ok: new Set(good.map((r) => r.a)).size >= 4 };
}
function build(nb, res) {
  const A = res.t1.A, M = MATS[res.t1.cond.m] || MATS.glass, D = docKit(), nn = A.f ? A.f.k : A.m.m;
  D.S("Ishning maqsadi");
  D.list([`${M.name} uchun yorug‘likning sindirish ko‘rsatkichini aniqlash.`, "Yorug‘likning sinish qonunini tekshirish."]);
  D.S("Qisqacha nazariya");
  D.p("Yorug‘lik bir muhitdan ikkinchisiga o‘tganda tushish nuqtasida o‘tkazilgan normal bilan tushgan nur orasidagi burchak — tushish burchagi $\\alpha$, singan nur bilan normal orasidagi burchak — sinish burchagi $\\beta$. Sinish qonuni:");
  D.eq("\\frac{\\sin\\alpha}{\\sin\\beta} = n = \\frac{c}{v}", 1);
  D.p("Bu yerda $n$ — ikkinchi muhitning havoga nisbatan sindirish ko‘rsatkichi, $v$ — undagi yorug‘lik tezligi. Yassi-parallel plastinkadan chiqqan nur tushgan nurga parallel, faqat yon tomonga siljigan bo‘ladi.");
  D.S("Jihozlar");
  D.list([`${M.name}, oq qog‘oz varag‘i.`, "Lazer ko‘rsatkich (qizil, $\\lambda \\approx 650$ nm).", "Transportir (bo‘linma qiymati $1^\\circ$), burchaklar lupa yordamida $0{,}5^\\circ$ aniqlikda o‘qiladi."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Plastinka qog‘ozga qo‘yildi, tushish nuqtasida normal o‘tkazildi va transportir markazi shu nuqtaga joylandi.", "Lazer nuri turli burchaklarda yo‘naltirildi; har safar tushish burchagi $\\alpha$ va sinish burchagi $\\beta$ o‘lchandi.", "Har o‘lchash uchun $n = \\sin\\alpha/\\sin\\beta$ hisoblandi; $\\sin\\alpha(\\sin\\beta)$ grafigi chizildi."], true);
  D.S("O‘lchash natijalari");
  D.table(`Tushish va sinish burchaklari (${M.short})`, ["№", "$\\alpha$, °", "$\\beta$, °", "$\\sin\\alpha$", "$\\sin\\beta$", "$n$", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.a, 1)}$`, `$${fx(r.b, 1)}$`, `$${fx(r.sa, 3)}$`, `$${fx(r.sb, 3)}$`, Number.isFinite(r.n) && r.a > 0 ? `$${fx(r.n, 3)}$` : "--", res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  D.fig("snell", "$\\sin\\alpha$ ning $\\sin\\beta$ ga bog‘liqligi; to‘g‘ri chiziq qiyaligi — sindirish ko‘rsatkichi.", { xmin: 0, xmax: 1, ymin: 0, ymax: 1.05, legendPos: "north west", xlab: "sin β", ylab: "sin α",
    series: [{ kind: "pts", data: A.rows.map((r) => [r.sb, r.sa]), color: "#c2410c", label: "tajriba" }, ...(A.f ? [{ kind: "line", fn: (x) => A.f.k * x, color: "#1d4ed8", label: `sin α = ${fmt(A.f.k, 3)}·sin β` }] : [])] });
  const r0 = A.rows.filter((r) => r.a > 0).at(-1);
  D.p("**Hisoblash:**");
  D.eq([`n = \\frac{\\sin ${fx(r0.a, 1)}^\\circ}{\\sin ${fx(r0.b, 1)}^\\circ} = \\frac{${fx(r0.sa, 3)}}{${fx(r0.sb, 3)}} = ${fx(r0.n, 3)}`,
    `\\langle n\\rangle = ${fx(A.m.m, 3)} \\pm ${fx(Math.max(A.m.s, 0.0005), 3)};\\qquad \\text{grafikdan: } n = ${fx(nn, 3)};\\qquad v = \\frac{c}{n} = ${fx(3e5 / nn, 0)}\\ \\text{km/s}`]);
  D.S("Xulosa");
  docTail(D.X, nb, userText, [`• ${M.short} uchun sindirish ko‘rsatkichi $n = ${fx(nn, 3)} \\pm ${fx(Math.max(A.m.s, 0.0005), 3)}$ (jadval qiymati $\\approx ${fx(M.ref, 2)}$, farq $${fx(Math.abs(pct(nn, M.ref)), 1)}$ %).`, "• $\\sin\\alpha/\\sin\\beta$ nisbati tushish burchagiga bog‘liq emas — sinish qonuni tasdiqlandi.", `• ${M.short}da yorug‘lik tezligi $v \\approx ${fx(3e5 / nn, 0)}$ km/s.`], SITE);
  return { title: "Laboratoriya ishi. Shishaning sindirish ko‘rsatkichini aniqlash", titlePlain: "Laboratoriya ishi. Sindirish ko‘rsatkichi", author: nb.f.name, sub: `${M.name}: sinish qonuni`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "refraction", fileBase: "Sindirish-lab", docLabel: "Virtual laboratoriya ishi · 9-sinf", site: SITE,
  vh: (n) => (n ? 390 : 300),
  draw,
  down(x, y) { return geo.src && Math.hypot(x - geo.src[0], y - geo.src[1]) < 30 ? "src" : null; },
  move(h, x, y) { const O = geo.O; st.a = Math.max(0, Math.min(80, half(Math.atan2(O[0] - x, O[1] - y) / D2R))); },
  cursor: (x, y) => (geo.src && Math.hypot(x - geo.src[0], y - geo.src[1]) < 30 ? "grab" : ""),
  controls: [
    { type: "seg", label: "Plastinka", opts: Object.entries(MATS).map(([k, v]) => [k, v.short]), get: () => st.m, set: (v) => { st.m = v; } },
    { type: "range", label: "Tushish burchagi", min: 0, max: 80, step: 0.5, get: () => st.a, set: (v) => { st.a = v; }, fmt: (v) => `${fmt(v, 1)}°` },
    { type: "note", text: "Sahnada lazerni transportir aylanasi bo‘ylab suring. Burchaklarni o‘ngdagi lupalardan o‘qing (bo‘linma 0,5°)." },
  ],
  readouts() {
    return [["Tushish burchagi <i>α</i>", `${fmt(st.a, 1)}°`, "transportir (lupa)", "blue"], ["Sinish burchagi <i>β</i>", `${fmt(half(beta()), 1)}°`, "transportir (lupa)", "orange"],
      ["sin α / sin β", st.a > 0 ? fmt(Math.sin(st.a * D2R) / Math.sin(half(beta()) * D2R), 3) : "—", "o‘lchangan burchaklardan"], ["Plastinka", MATS[st.m].short, "n — noma’lum"]];
  },
  record() {
    const v = { a: fmt(st.a, 1), b: fmt(half(beta()), 1) };
    return { t: "t1", v, text: `${MATS[st.m].short}: α = ${v.a}°, β = ${v.b}°` };
  },
  explain() { return st.a === 0 ? "Nur normal bo‘ylab tushganda sinmaydi: α = β = 0." : `Nur optik zichroq muhitga o‘tib normalga yaqinlashadi: β (${fmt(half(beta()), 1)}°) < α (${fmt(st.a, 1)}°). Plastinkadan chiqqan nur tushgan nurga parallel.`; },
  steps: ["Plastinkani tanlang. Lazerni aylana bo‘ylab surib tushish burchagini o‘rnating (masalan, 20°, 30°, … 70°).", "Lupalardan α va β ni o‘qing va <b>Qaydga yozing</b>. Kamida 4–5 xil burchakda takrorlang.", "Qaydlarni jadvalga o‘tkazing: sin α, sin β va n avtomatik hisoblanadi; sin α(sin β) grafigining qiyaligi — n.", "Boshqa material uchun (jadval shartini o‘zgartirib) takrorlang. Xulosa va PDF."],
  formulas: ["Sinish qonuni: <span class=\"sim-math\">sin α / sin β = n</span>", "Yorug‘lik tezligi muhitda: <span class=\"sim-math\">v = c / n</span>", "Shisha ≈ 1,5; suv ≈ 1,33; havo ≈ 1,0003"],
  note: "Katta burchaklarda (α > 60°) plastinka sirtidan qaytgan nur ancha yorqinlashadi — bu ham kuzatiladi.",
  notebook: {
    intro: "Jadval sharti — qaysi plastinka. Kamida 4 xil tushish burchagi (0° dan farqli).",
    conclusionPh: "Sindirish ko‘rsatkichi qancha chiqdi? sin α / sin β nisbati burchakka bog‘liqmi?",
    hint: "Javob bering: 1) n ning qiymati jadval qiymatiga mosmi? 2) sin α / sin β nisbati o‘zgarmasmi? 3) Singan nur normalga yaqinlashadimi yoki uzoqlashadimi? 4) Plastinkadan chiqqan nur qanday yo‘nalgan?",
    tables: [
      { key: "t1", okLabel: "Sinish qonuni", need: "kamida 4 xil tushish burchagi", title: "Tushish va sinish burchaklari",
        cond: { fields: [{ k: "m", label: "Plastinka", opts: Object.entries(MATS).map(([k, v]) => [k, v.short]) }], sync: () => ({ m: st.m }), init: { m: "glass" } },
        head: ["α, °", "β, °", "sin α", "sin β", "n", "Tekshiruv"], cols: [{ k: "a", kind: "num" }, { k: "b", kind: "num" }], outs: ["sa", "sb", "n"],
        blank: () => ({ a: "", b: "" }), rows: 5, max: 12, narrow: true,
        parse: (r) => ({ a: num(r.a), b: num(r.b) }), check: (r) => (!(r.a >= 0 && r.a < 90) || !(r.b >= 0 && r.b < 90) ? { ok: false, err: "0 ≤ α, β < 90°" } : { ok: true }),
        analyze, out: (A, j, r) => { const sa = Math.sin(r.a * D2R), sb = Math.sin(r.b * D2R); return { sa: fmt(sa, 3), sb: fmt(sb, 3), n: sb > 0 ? fmt(sa / sb, 3) : "—" }; },
        summary: (A) => (A.m.m ? [["Sindirish ko‘rsatkichi", fmt(A.f ? A.f.k : A.m.m, 3), "grafik qiyaligi"], ["O‘rtacha n", fmt(A.m.m, 3), `± ${fmt(Math.max(A.m.s, 0.0005), 3)}`]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
