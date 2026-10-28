// ==========================================================================
// Laboratoriya ishi: Suyuqlikning sirt taranglik koeffitsiyentini tomchilar usulida aniqlash (simulations/lab-sirt-taranglik.html).
// Darslik: 9-sinf §34. Qurilma: jo‘mrakli byuretka (uchining tashqi diametri shtangensirkul bilan o‘lchangan),
// elektron tarozi ustidagi stakan (tara qilingan), tomchilar sanagichi.
// Fizika: surface-physics.js — tomchi uzilish paytida og‘irligi sirt taranglik kuchiga teng: m₀g = σπd (Teyt qonuni);
// haqiqiy tomchi biroz yengilroq (uzilganda bir qismi uchida qoladi) — bu usulning tizimli xatosi (≈ 3 %).
// ==========================================================================

import { createLab, docKit, meanErr, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { LIQUIDS, dropMass } from "./surface-physics.js";
import { eScale, label, hint, rr, F, inBox } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-sirt-taranglik.html", label: "oliyfizika.uz/simulations/lab-sirt-taranglik.html" };
const LIQ = { water: LIQUIDS.water, soap: LIQUIDS.soap, alcohol: LIQUIDS.alcohol };
const TIPS = { t12: { d: 1.2, s: "1,2" }, t20: { d: 2.0, s: "2,0" } };
const KEEP = 0.97, G = 9.81;
const st = { liq: "water", tip: "t20", open: false, rate: 3, auto: 50, N: 0, M: 0, phase: 0, fall: [] };
const geo = {};
const m0 = () => dropMass(LIQ[st.liq].sigma, TIPS[st.tip].d / 1000) * KEEP * 1000; // g

function empty() { st.N = 0; st.M = 0; st.fall = []; st.phase = 0; }
function step(dt, lab) {
  const moving = st.fall.length > 0;
  st.fall.forEach((f) => { f.v += 900 * dt; f.y += f.v * dt; });
  const landed = st.fall.filter((f) => f.y >= geo.surf);
  if (landed.length) { st.fall = st.fall.filter((f) => f.y < geo.surf); st.M += landed.length * m0(); }
  if (!st.open) return moving;
  st.phase += st.rate * dt;
  while (st.phase >= 1) {
    st.phase -= 1; st.N += 1; st.fall.push({ y: geo.tip, v: 40 });
    if (st.auto && st.N >= st.auto) { st.open = false; st.phase = 0; lab.say(`Jo‘mrak yopildi: ${st.N} ta tomchi. Tomchilar stakanga tushgach, tarozi ko‘rsatkichini yozing.`, "ok"); break; }
  }
  return true;
}

/* ------------------------------------------------------------------ Sahna */
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, Lq = LIQ[st.liq], [r, g, b] = Lq.color, bx = narrow ? 150 : 250, tipY = 170, base = h - 16;
  // shtativ
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(bx - 70, 14, 6, base - 14); ctx.fillRect(bx - 100, base - 4, 80, 8); ctx.fillRect(bx - 70, 40, 62, 5);
  // byuretka
  ctx.fillStyle = `rgba(${r},${g},${b},0.35)`; ctx.fillRect(bx - 9, 30, 18, 96);
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#64748b"; ctx.lineWidth = 1.4; ctx.strokeRect(bx - 9, 16, 18, 110);
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(bx - 9, 30 + i * 9.6); ctx.lineTo(bx - 3, 30 + i * 9.6); ctx.stroke(); }
  // jo‘mrak
  ctx.fillStyle = st.open ? "#16a34a" : "#dc2626"; rr(ctx, bx - 16, 128, 32, 12, 4); ctx.fill();
  ctx.save(); ctx.translate(bx, 134); ctx.rotate(st.open ? 0 : Math.PI / 2); ctx.fillStyle = "#f8fafc"; ctx.fillRect(-12, -2, 24, 4); ctx.restore();
  geo.tap = { x0: bx - 22, x1: bx + 22, y0: 120, y1: 148 };
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#64748b"; ctx.beginPath(); ctx.moveTo(bx - 4, 140); ctx.lineTo(bx - 2, tipY); ctx.moveTo(bx + 4, 140); ctx.lineTo(bx + 2, tipY); ctx.stroke();
  // o‘sayotgan tomchi
  const rad = 2 + 7 * Math.cbrt(st.open ? st.phase : 0.15) * (TIPS[st.tip].d / 2);
  ctx.fillStyle = `rgba(${r},${g},${b},0.85)`; ctx.beginPath(); ctx.arc(bx, tipY + rad * 0.8, rad, 0, Math.PI * 2); ctx.fill();
  geo.tip = tipY + rad;
  // tarozi va stakan
  const sw = 150, sx = bx - sw / 2, sy = base - 48;
  eScale(ctx, c, sx, sy, sw, fmt(st.M, 2), "g");
  const gx = bx - 36, gw = 72, gh = 70, gy = sy - gh;
  const lev = Math.min(gh - 8, 3 + st.M * 0.6);
  ctx.fillStyle = `rgba(${r},${g},${b},0.4)`; ctx.fillRect(gx + 2, sy - lev, gw - 4, lev);
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#64748b"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, sy); ctx.lineTo(gx + gw, sy); ctx.lineTo(gx + gw, gy); ctx.stroke();
  geo.surf = sy - lev;
  // tushayotgan tomchilar
  ctx.fillStyle = `rgba(${r},${g},${b},0.9)`; st.fall.forEach((f) => { ctx.beginPath(); ctx.ellipse(bx, f.y, rad * 0.8, rad, 0, 0, Math.PI * 2); ctx.fill(); });
  // sanagich va ma’lumot
  const ix = narrow ? 232 : 470, iy = 20, iw = narrow ? 160 : 190;
  ctx.fillStyle = c.dark ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.92)"; rr(ctx, ix, iy, iw, 112, 8); ctx.fill(); ctx.strokeStyle = c.dark ? "#475569" : "#cbd5e1"; ctx.lineWidth = 1; ctx.stroke();
  label(ctx, "TOMCHILAR SANAGICHI", ix + iw / 2, iy + 14, c.text3, F(9, 700));
  label(ctx, String(st.N), ix + iw / 2, iy + 42, c.text, `700 28px "SFMono-Regular", Menlo, Consolas, monospace`);
  label(ctx, `${Lq.name}`, ix + iw / 2, iy + 70, c.text2, F(10.5, 700));
  label(ctx, `byuretka uchi: d = ${TIPS[st.tip].s} mm`, ix + iw / 2, iy + 88, c.text2, F(10, 600));
  label(ctx, st.auto ? `avtomatik to‘xtash: N = ${st.auto}` : "qo‘lda yopiladi", ix + iw / 2, iy + 104, c.text3, F(9));
  hint(ctx, c, st.open ? "jo‘mrakni bosing: yopish" : "jo‘mrakni bosing: ochish", bx + 26, 134);
}

/* ------------------------------------------------------------------ Hisob */
const sig = (r) => ((r.M / 1000) * G) / (Math.PI * (r.d / 1000) * r.N) * 1000; // mN/m
function analyze(rows, cond) {
  const rs = rows.map((r) => ({ ...r, m0: (r.M / r.N) * 1000, s: sig(r) })), m = meanErr(rs.map((r) => r.s));
  return { rows: rs, m, ref: (LIQ[cond?.liq] || LIQ.water).sigma * 1000, ok: rs.length >= 2 };
}
function build(nb, res) {
  const A = res.t1.A, Lq = LIQ[res.t1.cond.liq] || LIQ.water, D = docKit();
  D.S("Ishning maqsadi");
  D.list([`${Lq.name}ning sirt taranglik koeffitsiyentini tomchilar usulida aniqlash.`]);
  D.S("Qisqacha nazariya");
  D.p("Byuretka uchida osilib turgan tomchini sirt taranglik kuchi ushlab turadi; bu kuch tomchi bo‘yni aylanasi uzunligi $\\pi d$ ga proporsional: $F = \\sigma\\pi d$. Tomchi og‘irligi shu kuchga yetganda u uziladi:");
  D.eq("m_0 g = \\sigma\\pi d\\quad\\Rightarrow\\quad \\sigma = \\frac{m_0 g}{\\pi d} = \\frac{Mg}{\\pi d N}", 1);
  D.p("Bitta tomchi massasi juda kichik, shuning uchun $N$ ta tomchining umumiy massasi $M$ o‘lchanadi: $m_0 = M/N$.");
  D.S("Jihozlar");
  D.list([`Jo‘mrakli byuretka, uchining tashqi diametri shtangensirkul bilan o‘lchangan ($d = ${fx(A.rows[0].d, 1)}$ mm).`, "Elektron tarozi (aniqligi $0{,}01$ g), stakan.", `O‘rganilgan suyuqlik: ${Lq.name.toLowerCase()}.`]);
  D.S("Ishni bajarish tartibi");
  D.list(["Stakan tarozida tara qilindi (ko‘rsatkich nolga keltirildi).", "Jo‘mrak ochilib, tomchilar sekin (sekundiga bir necha tomchi) stakanga tomizildi; $N$ ta tomchidan so‘ng jo‘mrak yopildi.", "Tomchilar massasi $M$ tarozidan o‘qildi; tajriba takrorlandi."], true);
  D.S("O‘lchash natijalari");
  D.table(`Tomchilar massasi (${Lq.name})`, ["№", "$d$, mm", "$N$", "$M$, g", "$m_0 = M/N$, mg", "$\\sigma$, mN/m", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.d, 1)}$`, `$${fx(r.N, 0)}$`, `$${fx(r.M, 2)}$`, `$${fx(r.m0, 1)}$`, `$${fx(r.s, 1)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  const r0 = A.rows[0];
  D.p("**Hisoblash:**");
  D.eq([`\\sigma = \\frac{Mg}{\\pi d N} = \\frac{${fx(r0.M / 1000, 5)} \\cdot 9{,}81}{3{,}14 \\cdot ${fx(r0.d / 1000, 4)} \\cdot ${fx(r0.N, 0)}} = ${fx(r0.s / 1000, 4)}\\ \\text{N/m}`,
    `\\langle\\sigma\\rangle = (${fx(A.m.m, 1)} \\pm ${fx(Math.max(A.m.s, 0.05), 1)})\\ \\text{mN/m};\\qquad \\varepsilon = \\frac{|\\sigma - \\sigma_{\\text{jadval}}|}{\\sigma_{\\text{jadval}}} = ${fx(Math.abs(pct(A.m.m, A.ref)), 1)}\\ \\%`]);
  D.S("Xulosa");
  docTail(D.X, nb, userText, [`• ${Lq.name}ning sirt taranglik koeffitsiyenti $\\sigma = (${fx(A.m.m, 1)} \\pm ${fx(Math.max(A.m.s, 0.05), 1)})$ mN/m (jadval qiymati $${fx(A.ref, 1)}$ mN/m).`, "• Natija jadval qiymatidan biroz kichik: tomchi uzilganda uning bir qismi byuretka uchida qoladi — usulning tizimli xatosi.", "• Ko‘p tomchi massasini o‘lchash bitta tomchi massasini aniq topish imkonini beradi."], SITE);
  return { title: "Laboratoriya ishi. Suyuqlikning sirt taranglik koeffitsiyentini aniqlash", titlePlain: "Laboratoriya ishi. Sirt taranglik", author: nb.f.name, sub: `${Lq.name}: tomchilar usuli`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "surface", fileBase: "Sirt-taranglik-lab", docLabel: "Virtual laboratoriya ishi · 9-sinf", site: SITE,
  vh: (n) => (n ? 360 : 330),
  draw, step,
  down(x, y, lab) { if (inBox(x, y, geo.tap)) { st.open = !st.open; lab.say(st.open ? "Jo‘mrak ochildi — tomchilar sanalmoqda." : `Jo‘mrak yopildi: ${st.N} ta tomchi.`); return true; } return null; },
  cursor: (x, y) => (inBox(x, y, geo.tap) ? "pointer" : ""),
  tools: [{ label: "Jo‘mrak: ochish / yopish", run: (lab) => { st.open = !st.open; } }, { label: "Stakanni bo‘shatish va tara", run: (lab) => { st.open = false; empty(); lab.say("Stakan bo‘shatildi, tarozi nolga keltirildi."); } }],
  controls: [
    { type: "seg", label: "Suyuqlik", opts: Object.entries(LIQ).map(([k, v]) => [k, v.name]), get: () => st.liq, set: (v) => { st.liq = v; st.open = false; empty(); } },
    { type: "seg", label: "Byuretka uchi diametri", opts: Object.entries(TIPS).map(([k, v]) => [k, `${v.s} mm`]), get: () => st.tip, set: (v) => { st.tip = v; st.open = false; empty(); } },
    { type: "seg", label: "Jo‘mrakni yopish", opts: [[0, "Qo‘lda"], [50, "N = 50"], [100, "N = 100"]], get: () => st.auto, set: (v) => { st.auto = v; } },
    { type: "seg", label: "Tomchilash tezligi", opts: [[1, "sekin"], [3, "o‘rtacha"], [8, "tez"]], get: () => st.rate, set: (v) => { st.rate = v; } },
    { type: "note", text: "Har tajribadan oldin stakanni bo‘shating (tara). Jo‘mrak yopilgach, barcha tomchilar tushishini kuting va qaydga yozing." },
  ],
  readouts() {
    return [["Tomchilar <i>N</i>", String(st.N), st.open ? "tomchilamoqda" : "jo‘mrak yopiq", "blue"], ["Tarozi <i>M</i>", `${fmt(st.M, 2)}<small>g</small>`, "tomchilar massasi", "orange"],
      ["Bitta tomchi", st.N ? `${fmt((st.M / st.N) * 1000, 1)}<small>mg</small>` : "—", "M / N"], ["Byuretka uchi", `${TIPS[st.tip].s}<small>mm</small>`, LIQ[st.liq].name]];
  },
  record() {
    if (st.open) return { err: "Avval jo‘mrakni yoping." };
    if (st.fall.length) return { err: "Tomchilar hali tushmoqda — biroz kuting." };
    if (st.N < 10) return { err: "Kamida 10 ta (yaxshisi 50–100 ta) tomchi tomizing." };
    const v = { d: TIPS[st.tip].s, N: String(st.N), M: fmt(st.M, 2) };
    return { t: "t1", v, text: `${LIQ[st.liq].name}, d = ${v.d} mm: N = ${v.N}, M = ${v.M} g` };
  },
  explain() { return st.N ? `${st.N} ta tomchi massasi ${fmt(st.M, 2)} g — bitta tomchi ≈ ${fmt((st.M / st.N) * 1000, 1)} mg. Sirt taranglik kattaroq bo‘lsa, tomchi og‘irroq bo‘lib uziladi.` : "Jo‘mrakni oching: tomchi byuretka uchida o‘sib, og‘irligi sirt taranglik kuchiga yetganda uziladi."; },
  steps: ["Suyuqlik va byuretka uchini tanlang. Stakanni bo‘shating (tara).", "Jo‘mrakni oching va 50–100 ta tomchi tomizing (avtomatik to‘xtatish mumkin). Tarozi ko‘rsatkichini <b>Qaydga yozing</b>.", "Tajribani 2–3 marta takrorlang (har safar tara qiling); boshqa uchda ham sinab ko‘ring.", "Qaydlarni jadvalga o‘tkazing: m₀ va σ avtomatik. Boshqa suyuqlik uchun jadval shartini o‘zgartiring. Xulosa va PDF."],
  formulas: ["Sirt taranglik kuchi: <span class=\"sim-math\">F = σl = σπd</span>", "Tomchi uzilishi: <span class=\"sim-math\">m₀g = σπd</span>", "<span class=\"sim-math\">σ = Mg / (πdN)</span>", "Suv: 72,8 mN/m; sovunli suv ≈ 40; spirt ≈ 22 mN/m (20 °C)"],
  note: "Sovun sirt taranglikni kamaytiradi — sovunli suv tomchilari mayda bo‘ladi.",
  notebook: {
    intro: "Jadval sharti — suyuqlik. Kamida 2 tajriba.",
    conclusionPh: "Sirt taranglik koeffitsiyenti qancha chiqdi? Jadval qiymatidan farqi nimadan?",
    hint: "Javob bering: 1) σ qancha va jadval qiymatiga mosmi? 2) Nega ko‘p tomchi massasi o‘lchanadi? 3) Uch diametri kattaroq bo‘lsa tomchi qanday bo‘ladi? 4) Sovun σ ga qanday ta’sir qiladi?",
    tables: [
      { key: "t1", okLabel: "σ", need: "kamida 2 tajriba", title: "Tomchilar usuli",
        cond: { fields: [{ k: "liq", label: "Suyuqlik", opts: Object.entries(LIQ).map(([k, v]) => [k, v.name]) }], sync: () => ({ liq: st.liq }), init: { liq: "water" } },
        head: ["d, mm", "N", "M, g", "m₀, mg", "σ, mN/m", "Tekshiruv"], cols: [{ k: "d", kind: "num" }, { k: "N", kind: "num" }, { k: "M", kind: "num" }], outs: ["m0", "s"],
        blank: () => ({ d: "", N: "", M: "" }), rows: 3, max: 10, narrow: true,
        parse: (r) => ({ d: num(r.d), N: num(r.N), M: num(r.M) }), check: (r) => (!(r.d > 0 && r.N >= 1 && r.M > 0) ? { ok: false, err: "d, N, M > 0" } : { ok: true }),
        analyze, out: (A, j, r) => ({ m0: fmt((r.M / r.N) * 1000, 1), s: fmt(sig(r), 1) }),
        summary: (A) => (A.rows.length ? [["σ", `${fmt(A.m.m, 1)} mN/m`, A.rows.length > 1 ? `± ${fmt(Math.max(A.m.s, 0.05), 1)}` : ""], ["Jadval qiymati", `${fmt(A.ref, 1)} mN/m`, ""]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
