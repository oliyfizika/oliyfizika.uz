// ==========================================================================
// Laboratoriya ishi: Qiya tekislikning foydali ish koeffitsiyentini aniqlash (simulations/lab-qiya-tekislik.html). Darslik: 10-sinf §11.
// Qurilma: uzunligi 80 cm taxta (balandligi shtativda o‘zgartiriladi, vertikal chizg‘ich bilan o‘lchanadi), yog‘och brusok
// (+ 100 g li yuklar), dinamometr 0…5 N (bo‘linma 0,1 N, 0,05 N gacha o‘qiladi). Brusok tekis tortilganda F o‘lchanadi.
// Fizika: incline-efficiency-physics.js — F = P(sin α + μ cos α), η = Ph / (Fl).
// ==========================================================================

import { createLab, docKit, meanErr, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { pullForce, SURFACES } from "./incline-efficiency-physics.js";
import { noise } from "./labkit.js";
import { dynamometer, rulerV, label, hint, rr, F } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-qiya-tekislik.html", label: "oliyfizika.uz/simulations/lab-qiya-tekislik.html" };
const SURF = { wood: SURFACES.wood, paper: SURFACES.paper, cloth: SURFACES.cloth };
const LEN = 0.8, G = 9.81, M_BLOCK = 0.097, M_LOAD = 0.1, DYN_MAX = 5;
const st = { surf: "wood", loads: 1, h: 0.2, hang: false, pull: false, s: 0, t: 0 };
const geo = {};
const read = (v) => Math.round(v / 0.05) * 0.05;
const P = () => (M_BLOCK + st.loads * M_LOAD) * G;
const alpha = () => Math.asin(Math.min(0.95, st.h / LEN));
const Fpull = () => pullForce(P(), alpha(), SURF[st.surf].mu) * (1 + 0.012 * Math.sin(st.t * 9) + 0.01 * noise(st.h * 31, st.loads));
const Fnow = () => (st.hang ? P() : st.pull ? Fpull() : 0); // tinch turganda dinamometr tortilmagan

function step(dt, lab) {
  if (!st.pull) return false;
  st.t += dt; st.s += 0.08 * dt;
  if (st.s >= LEN - 0.14) { st.s = LEN - 0.14; st.pull = false; lab.say("Brusok taxtaning yuqori uchiga yetdi. Qaytadan tortish uchun «Pastga qaytarish»."); }
  return true;
}

/* ------------------------------------------------------------------ Sahna */
function block(ctx, w, h, loads) {
  ctx.fillStyle = "#c08a4a"; ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 1; rr(ctx, -w / 2, -h, w, h, 3); ctx.fill(); ctx.stroke();
  for (let i = 0; i < loads; i++) { ctx.fillStyle = "#64748b"; rr(ctx, -10 + i * 0, -h - 12 - i * 12, 20, 12, 2); ctx.fill(); ctx.strokeStyle = "#334155"; ctx.stroke(); }
}
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, base = h - 18;
  const k = narrow ? 380 : 560, x0 = narrow ? 10 : 40, a = alpha(), Lp = LEN * k;
  const x1 = x0 + Lp * Math.cos(a), y1 = base - Lp * Math.sin(a);
  // stol va shtativ
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; ctx.fillRect(0, base, w, 18);
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(x1 + 14, 20, 6, base - 20); ctx.fillRect(x1 - 20, base - 4, 70, 6); ctx.fillRect(x1 - 4, y1 - 3, 26, 6);
  rulerV(ctx, c, x1 + 26, base, k / 100, Math.min(60, (base - 30) / (k / 100)), { w: 22, sub: 1, step: 10 });
  // h belgisi
  ctx.setLineDash([3, 3]); ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + 26, y1); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, "h", x1 + 56, y1, "#dc2626", F(11, 700));
  // taxta
  ctx.save(); ctx.translate(x0, base); ctx.rotate(-a);
  const surfCol = { wood: "#d6a76c", paper: "#f5f5f4", cloth: "#94a3b8" }[st.surf];
  ctx.fillStyle = "#a16207"; ctx.fillRect(0, 0, Lp, 10); ctx.fillStyle = surfCol; ctx.fillRect(0, -3, Lp, 4);
  // brusok va dinamometr (taxta bo‘ylab)
  const bw = 0.12 * k, bh = 0.05 * k * 0.8, bxc = (st.s + 0.07) * k;
  if (!st.hang) {
    ctx.save(); ctx.translate(bxc, -3); block(ctx, bw, bh, st.loads); ctx.restore();
    const hook = [bxc + bw / 2 + 4, -3 - bh / 2];
    ctx.save(); ctx.translate(hook[0], hook[1]); ctx.rotate(Math.PI / 2); // halqa — yuqoriga (qo‘l bilan tortiladi), ilgak — brusokda
    dynamometer(ctx, c, 0, -(narrow ? 120 : 150) - 14, narrow ? 120 : 150, { max: DYN_MAX, div: 0.1, F: Fnow() });
    ctx.restore();
    geo.block = [x0 + Math.cos(a) * bxc, base - Math.sin(a) * bxc];
  }
  ctx.restore();
  // osib o‘lchash
  if (st.hang) {
    const dx = narrow ? 70 : 140, dy = 24, dh = narrow ? 130 : 160;
    const D = dynamometer(ctx, c, dx, dy, dh, { max: DYN_MAX, div: 0.1, F: Fnow() });
    ctx.save(); ctx.translate(D.hook[0], D.hook[1] + 6 + bh); block(ctx, bw, bh, st.loads); ctx.restore();
  }
  label(ctx, `l = ${fmt(LEN * 100, 0)} cm (taxta uzunligi)`, x0 + (Lp / 2) * Math.cos(a) + 10, base - (Lp / 2) * Math.sin(a) + 24, c.text2, F(10, 700), "left");
  hint(ctx, c, st.hang ? "brusok dinamometrga osilgan — og‘irlik P" : st.pull ? "brusok tekis tortilmoqda…" : "«Tortish» — brusokni tekis yuqoriga tortish", narrow ? 8 : 200, 16);
}

/* ------------------------------------------------------------------ Hisob */
const eta = (r) => (r.P * r.h) / (r.F * r.l);
function analyze(rows) {
  const rs = rows.map((r) => ({ ...r, Ap: r.P * r.h, A: r.F * r.l, eta: eta(r) * 100, a: Math.asin(Math.min(1, r.h / r.l)) * 180 / Math.PI }));
  return { rows: rs.sort((x, y) => x.h - y.h), m: meanErr(rs.map((r) => r.eta)), ok: rs.length >= 2 };
}
function build(nb, res) {
  const A = res.t1.A, Sf = SURF[res.t1.cond.surf] || SURF.wood, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Qiya tekislik bo‘ylab yuk ko‘tarishda foydali va to‘liq ishni o‘lchab, foydali ish koeffitsiyentini (FIK) aniqlash.", "FIK ning qiyalik burchagiga bog‘liqligini o‘rganish."]);
  D.S("Qisqacha nazariya");
  D.p("Og‘irligi $P$ bo‘lgan jismni $h$ balandlikka ko‘tarishdagi foydali ish $A_{\\text{f}} = Ph$. Jismni uzunligi $l$ bo‘lgan qiya tekislik bo‘ylab tekis tortishda bajarilgan to‘liq ish $A = Fl$; ishqalanish tufayli $A > A_{\\text{f}}$:");
  D.eq("\\eta = \\frac{A_{\\text{f}}}{A}\\cdot 100\\,\\% = \\frac{Ph}{Fl}\\cdot 100\\,\\%", 1);
  D.p("Nazariy jihatdan $F = P(\\sin\\alpha + \\mu\\cos\\alpha)$, shuning uchun $\\eta = \\dfrac{\\sin\\alpha}{\\sin\\alpha + \\mu\\cos\\alpha}$ — qiyalik ortishi bilan FIK ortadi, ishqalanish koeffitsiyenti ortishi bilan kamayadi.");
  D.S("Jihozlar");
  D.list([`Uzunligi $${fx(LEN, 2)}$ m taxta (sirti: ${Sf.name}), shtativ, chizg‘ich.`, "Yog‘och brusok va $100$ g li yuklar.", "Dinamometr $0\\ldots 5$ N (bo‘linma qiymati $0{,}1$ N)."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Brusok (yuk bilan) dinamometrga osilib, og‘irligi $P$ o‘lchandi.", "Taxta $h$ balandlikka o‘rnatildi; brusok dinamometr bilan taxta bo‘ylab tekis tortilib, tortish kuchi $F$ o‘lchandi.", "Tajriba bir necha balandlik uchun takrorlandi; har holda FIK hisoblandi."], true);
  D.S("O‘lchash natijalari");
  D.table(`Qiya tekislik FIKi (sirt: ${Sf.name})`, ["№", "$P$, N", "$h$, m", "$l$, m", "$F$, N", "$A_{\\text{f}} = Ph$, J", "$A = Fl$, J", "$\\eta$, %", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.P, 2)}$`, `$${fx(r.h, 3)}$`, `$${fx(r.l, 2)}$`, `$${fx(r.F, 2)}$`, `$${fx(r.Ap, 3)}$`, `$${fx(r.A, 3)}$`, `$${fx(r.eta, 0)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  if (new Set(A.rows.map((r) => r.h)).size >= 3) {
    D.fig("eta", "FIK ning qiyalik burchagiga bog‘liqligi.", { xmin: 0, xmax: Math.max(...A.rows.map((r) => r.a)) * 1.2, ymin: 0, ymax: 100, legendPos: "south east", xlab: "α, °", ylab: "η, %",
      series: [{ kind: "line", data: A.rows.map((r) => [r.a, r.eta]), color: "#94a3b8" }, { kind: "pts", data: A.rows.map((r) => [r.a, r.eta]), color: "#c2410c", label: "tajriba" }] });
  }
  const r0 = A.rows[0];
  D.p("**Hisoblash:**");
  D.eq(`\\eta = \\frac{${fx(r0.P, 2)} \\cdot ${fx(r0.h, 3)}}{${fx(r0.F, 2)} \\cdot ${fx(r0.l, 2)}}\\cdot 100\\,\\% = \\frac{${fx(r0.Ap, 3)}}{${fx(r0.A, 3)}}\\cdot 100\\,\\% = ${fx(r0.eta, 0)}\\,\\%`);
  const lo = A.rows[0], hi = A.rows.at(-1);
  D.S("Xulosa");
  docTail(D.X, nb, userText, [`• Qiya tekislik FIKi $${fx(lo.eta, 0)}$–$${fx(hi.eta, 0)}$ % oralig‘ida chiqdi; to‘liq ish har doim foydali ishdan katta — ishqalanishni yengishga ham ish sarflanadi.`, hi.h > lo.h ? `• Balandlik ${fx(lo.h * 100, 0)} cm dan ${fx(hi.h * 100, 0)} cm gacha oshirilganda FIK ${hi.eta > lo.eta ? "ortdi" : "o‘zgarmadi"}.` : "• Turli balandliklarda o‘lchab, FIK ning qiyalikka bog‘liqligini ko‘rish mumkin.", "• Qiya tekislik kuchdan yutuq beradi ($F < P$), lekin ishdan yutuq bermaydi."], SITE);
  return { title: "Laboratoriya ishi. Qiya tekislikning foydali ish koeffitsiyentini aniqlash", titlePlain: "Laboratoriya ishi. Qiya tekislik FIKi", author: nb.f.name, sub: `Sirt: ${Sf.name}`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "incline", fileBase: "Qiya-tekislik-lab", docLabel: "Virtual laboratoriya ishi · 10-sinf", site: SITE,
  vh: (n) => (n ? 330 : 340),
  draw, step,
  tools: [{ label: "Og‘irlikni o‘lchash (osish)", run: (lab) => { st.hang = !st.hang; st.pull = false; lab.say(st.hang ? "Brusok dinamometrga osildi." : "Brusok taxtaga qo‘yildi."); } },
    { label: "Tortish", run: (lab) => { if (st.hang) st.hang = false; if (st.s >= LEN - 0.15) st.s = 0; st.pull = true; lab.say("Brusok tekis tortilmoqda — dinamometrni o‘qing."); } },
    { label: "Pastga qaytarish", run: () => { st.pull = false; st.s = 0; } }],
  controls: [
    { type: "range", label: "Taxta balandligi h", min: 0.05, max: 0.5, step: 0.005, get: () => st.h, set: (v) => { st.h = v; }, fmt: (v) => `${fmt(v * 100, 1)} cm` },
    { type: "seg", label: "Taxta sirti", opts: Object.entries(SURF).map(([k, v]) => [k, v.name]), get: () => st.surf, set: (v) => { st.surf = v; } },
    { type: "seg", label: "Brusok ustidagi yuklar", opts: [[0, "yo‘q"], [1, "1 × 100 g"], [2, "2 × 100 g"]], get: () => st.loads, set: (v) => { st.loads = v; st.hang = false; st.pull = false; } },
    { type: "note", text: "Balandlik chizg‘ichdan taxtaning yuqori uchigacha (qizil chiziq) o‘qiladi. F faqat tekis tortish paytida o‘lchanadi." },
  ],
  readouts() {
    const f = Fnow();
    return [["Dinamometr", `${fmt(read(f), 2)}<small>N</small>`, st.hang ? "og‘irlik P" : st.pull ? "tortish kuchi F" : "yuk yo‘q", "orange"], ["Balandlik <i>h</i>", `${fmt(st.h * 100, 1)}<small>cm</small>`, "chizg‘ich", "blue"],
      ["Qiyalik <i>α</i>", `${fmt(alpha() * 180 / Math.PI, 1)}°`, "sin α = h / l"], ["Taxta <i>l</i>", `${fmt(LEN * 100, 0)}<small>cm</small>`, SURF[st.surf].name]];
  },
  record() {
    if (st.hang) { const v = { P: fmt(read(P()), 2) }; return { t: "t1", v, text: `Og‘irlik (${st.loads ? `${st.loads} yuk bilan` : "yuksiz"}): P = ${v.P} N` }; }
    if (!st.pull) return { err: "Tortish kuchini brusok tekis harakatlanayotganda o‘lchang («Tortish»)." };
    const v = { h: fmt(st.h, 3), l: fmt(LEN, 2), F: fmt(read(Fpull()), 2) };
    return { t: "t1", v, text: `h = ${v.h} m, l = ${v.l} m: F = ${v.F} N` };
  },
  explain() { const a = alpha(); return `Qiyalik ${fmt(a * 180 / Math.PI, 1)}°. Brusokni tekis tortish uchun og‘irlikning tekislik bo‘ylab tashkil etuvchisini va ishqalanish kuchini yengish kerak. Qiyalik oshsa, ishqalanishga sarflanadigan ish ulushi kamayadi.`; },
  steps: ["Yuklar sonini tanlang. «Og‘irlikni o‘lchash» — brusok dinamometrga osiladi; P ni <b>Qaydga yozing</b>.", "Taxta balandligini o‘rnating (masalan, 10 cm). «Tortish» bosib, brusok tekis harakatlanayotganda h, l va F ni qaydga yozing.", "Balandlikni o‘zgartirib (20, 30, 40 cm) tortishni takrorlang (P har qator uchun bir xil — har gal qaydga yozing).", "Qaydlarni jadvalga o‘tkazing: A_f, A va η avtomatik. Xulosa va PDF."],
  formulas: ["Foydali ish: <span class=\"sim-math\">A<sub>f</sub> = Ph</span>", "To‘liq ish: <span class=\"sim-math\">A = Fl</span>", "FIK: <span class=\"sim-math\">η = Ph / (Fl) · 100 %</span>", "<span class=\"sim-math\">F = P(sin α + μ cos α)</span>"],
  note: "Har qator uchun P qaydini alohida yozing: qaydlar qatorlarga ketma-ket to‘ladi (P → h, l, F).",
  notebook: {
    intro: "Jadval sharti — taxta sirti. Kamida 2 xil balandlik.",
    conclusionPh: "Qiya tekislik FIKi qancha chiqdi? U qiyalikka qanday bog‘liq?",
    hint: "Javob bering: 1) FIK qancha? 2) Nega A > A_f? 3) Qiyalik oshganda FIK qanday o‘zgaradi? 4) Qiya tekislik kuchdan yutuq beradimi, ishdan-chi?",
    tables: [
      { key: "t1", okLabel: "FIK", need: "kamida 2 o‘lchash", title: "Qiya tekislikning FIKi",
        cond: { fields: [{ k: "surf", label: "Taxta sirti", opts: Object.entries(SURF).map(([k, v]) => [k, v.name]) }], sync: () => ({ surf: st.surf }), init: { surf: "wood" } },
        head: ["P, N", "h, m", "l, m", "F, N", "η, %", "Tekshiruv"], cols: [{ k: "P", kind: "num" }, { k: "h", kind: "num" }, { k: "l", kind: "num" }, { k: "F", kind: "num" }], outs: ["eta"],
        blank: () => ({ P: "", h: "", l: "", F: "" }), rows: 3, max: 10, narrow: true,
        parse: (r) => ({ P: num(r.P), h: num(r.h), l: num(r.l), F: num(r.F) }), check: (r) => (!(r.P > 0 && r.h > 0 && r.l > r.h && r.F > 0) ? { ok: false, err: "P, h, F > 0; l > h" } : { ok: true }),
        analyze, out: (A, j, r) => ({ eta: fmt(eta(r) * 100, 0) }),
        summary: (A) => (A.rows.length ? [["O‘rtacha FIK", `${fmt(A.m.m, 0)} %`, `${A.rows.length} ta o‘lchash`]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
