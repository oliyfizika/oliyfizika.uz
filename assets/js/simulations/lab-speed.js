// ==========================================================================
// Laboratoriya ishi: Notekis harakatda o‘rtacha tezlikni aniqlash (simulations/lab-ortacha-tezlik.html). Darslik: 7-sinf §12.
// Qurilma: uzunligi 1,2 m qiya nov (bir uchi shtativda h balandlikka ko‘tarilgan), nov bo‘ylab chizg‘ich, po‘lat sharcha,
// suriladigan to‘siq va elektron sekundomer (sharcha qo‘yib yuborilganda ishga tushadi, to‘siqqa urilganda to‘xtaydi).
// Fizika: novda dumalayotgan sharcha — tekis tezlanuvchan: s = at²/2, a ≈ 0,6·g·sin α (dumalash va ishqalanish hisobga olingan).
// ==========================================================================

import { createLab, docKit, fitOrigin, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { noise } from "./labkit.js";
import { rulerH, stopwatch, label, hint, rr, F } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-ortacha-tezlik.html", label: "oliyfizika.uz/simulations/lab-ortacha-tezlik.html" };
const LEN = 1.2, G = 9.81, K_ROLL = 0.6;
const HS = { h10: { h: 0.1, s: "10 cm" }, h15: { h: 0.15, s: "15 cm" }, h20: { h: 0.2, s: "20 cm" } };
const st = { hk: "h10", stop: 0.6, x: 0, v: 0, run: false, t: 0, done: false };
const geo = {};
const acc = () => K_ROLL * G * (HS[st.hk].h / LEN);

function reset() { st.x = 0; st.v = 0; st.t = 0; st.run = false; st.done = false; }
function step(dt, lab) {
  if (!st.run) return false;
  const h = Math.min(dt, 0.05), a = acc();
  st.x += st.v * h + (a * h * h) / 2; st.v += a * h; st.t += h;
  if (st.x >= st.stop) {
    // to‘siqqa urilish paytini aniq topamiz: stop = a t²/2
    st.t = Math.sqrt((2 * st.stop) / a) + 0.004 * noise(st.stop * 97, st.hk.length); st.x = st.stop; st.run = false; st.done = true; st.v = 0;
    lab.say(`Sharcha to‘siqqa urildi: t = ${fmt(st.t, 2)} s.`, "ok");
  }
  return true;
}

/* ------------------------------------------------------------------ Sahna */
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, base = h - 16, k = narrow ? 300 : 500, Lp = LEN * k, x0 = narrow ? 14 : 40;
  const hp = HS[st.hk].h * k * 2.2; // balandlik ko‘rinishi bo‘rttirilgan (qiyalik aniq ko‘rinishi uchun)
  const a = Math.asin(Math.min(0.6, hp / Lp)), y0 = base - Lp * Math.sin(a);
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; ctx.fillRect(0, base, w, 16);
  // shtativ
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(x0 + 6, y0, 6, base - y0); ctx.fillRect(x0 - 14, base - 4, 46, 6);
  label(ctx, `h = ${HS[st.hk].s}`, x0, y0 - 34, c.text2, F(10, 700), "left");
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(a);
  // nov
  ctx.fillStyle = c.dark ? "#78716c" : "#a8a29e"; ctx.fillRect(0, 0, Lp, 8); ctx.fillStyle = c.dark ? "#a8a29e" : "#d6d3d1"; ctx.fillRect(0, -3, Lp, 4);
  rulerH(ctx, c, 0, 10, k / 100, LEN * 100, { h: 16, sub: 1, step: 10, labelEvery: narrow ? 2 : 1, pad: 0 });
  // to‘siq
  const sp = st.stop * k;
  ctx.fillStyle = "#2563eb"; rr(ctx, sp + 6, -22, 10, 24, 2); ctx.fill();
  ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.moveTo(sp + 11, 30); ctx.lineTo(sp + 6, 38); ctx.lineTo(sp + 16, 38); ctx.closePath(); ctx.fill();
  // sharcha (markazi x da)
  const r = 7, bx = st.x * k;
  const g = ctx.createRadialGradient(bx - 2, -r - 4, 1, bx, -r - 2, r); g.addColorStop(0, "#f8fafc"); g.addColorStop(1, "#475569");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, -r - 2, r, 0, Math.PI * 2); ctx.fill();
  // boshlang‘ich darvoza
  ctx.fillStyle = "#16a34a"; ctx.fillRect(-4, -24, 4, 22);
  ctx.restore();
  geo.stop = { cx: x0 + Math.cos(a) * (sp + 11), cy: y0 + Math.sin(a) * (sp + 11) - 10, a, x0, y0, k };
  // sekundomer
  const sw = narrow ? 140 : 160, sx = w - sw - 12;
  stopwatch(ctx, c, sx, 14, sw, st.t, st.run);
  label(ctx, "start — qo‘yib yuborish, stop — to‘siq", sx + sw, 88, c.text3, F(narrow ? 8 : 9), "right");
  hint(ctx, c, "ko‘k to‘siqni nov bo‘ylab suring", narrow ? 10 : 240, narrow ? 112 : 30);
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows) {
  const rs = rows.slice().sort((a, b) => a.s - b.s).map((r) => ({ ...r, sm: r.s / 100, v: r.s / 100 / r.t }));
  rs.forEach((r, i) => { const p = rs[i - 1]; r.vs = p && r.t > p.t ? (r.sm - p.sm) / (r.t - p.t) : r.v; });
  const f = rs.length >= 2 ? fitOrigin(rs.map((r) => [r.t * r.t, r.sm])) : null;
  return { rows: rs, f, a: f ? 2 * f.k : NaN, ok: new Set(rs.map((r) => r.s)).size >= 3 };
}
function build(nb, res) {
  const A = res.t1.A, Hh = HS[res.t1.cond.hk] || HS.h10, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Qiya novdan dumalayotgan sharchaning turli yo‘l bo‘laklaridagi o‘rtacha tezligini aniqlash.", "Harakatning notekis ekanini tajribada ko‘rsatish."]);
  D.S("Qisqacha nazariya");
  D.p("Teng vaqt oraliqlarida turli yo‘llarni bosib o‘tadigan harakat notekis harakat deyiladi. Notekis harakatning o‘rtacha tezligi — bosib o‘tilgan butun yo‘lning shu yo‘lga ketgan vaqtga nisbati:");
  D.eq("v_{\\text{o‘r}} = \\frac{s}{t}", 1);
  D.p("Ikki o‘lchash orasidagi bo‘lakdagi o‘rtacha tezlik $v = \\Delta s/\\Delta t$. Novdan dumalayotgan sharchaning tezligi ortib boradi — har keyingi bo‘lakda o‘rtacha tezlik kattaroq.");
  D.S("Jihozlar");
  D.list([`Uzunligi $${fx(LEN, 1)}$ m nov, shtativ (novning ko‘tarilgan uchi balandligi $h = ${fx(Hh.h * 100, 0)}$ cm), chizg‘ich (bo‘linma qiymati $1$ cm).`, "Po‘lat sharcha, suriladigan to‘siq, elektron sekundomer ($0{,}01$ s)."]);
  D.S("Ishni bajarish tartibi");
  D.list(["To‘siq novning boshidan $s$ masofaga qo‘yildi.", "Sharcha novning yuqori uchidan boshlang‘ich tezliksiz qo‘yib yuborildi; to‘siqqacha harakat vaqti $t$ yozildi.", "Tajriba to‘siqning bir necha holati uchun takrorlandi."], true);
  D.S("O‘lchash natijalari");
  D.table("Yo‘l, vaqt va o‘rtacha tezlik", ["№", "$s$, m", "$t$, s", "$v_{\\text{o‘r}} = s/t$, m/s", "$\\Delta s/\\Delta t$, m/s", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.sm, 2)}$`, `$${fx(r.t, 2)}$`, `$${fx(r.v, 2)}$`, `$${fx(r.vs, 2)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
    "$\\Delta s/\\Delta t$ — oldingi qator bilan orasidagi bo‘lakda (birinchi qatorda — boshidan).");
  D.fig("st", "Bosib o‘tilgan yo‘lning vaqtga bog‘liqligi; egri chiziq — $s = at^2/2$.", { xmin: 0, xmax: Math.max(...A.rows.map((r) => r.t)) * 1.1, ymin: 0, ymax: LEN * 1.05, legendPos: "north west", xlab: "t, s", ylab: "s, m",
    series: [{ kind: "pts", data: A.rows.map((r) => [r.t, r.sm]), color: "#c2410c", label: "tajriba" }, ...(A.f ? [{ kind: "line", fn: (x) => A.f.k * x * x, color: "#1d4ed8", label: `s = ${fmt(A.a / 2, 3)}·t²` }] : [])] });
  const r0 = A.rows.at(-1);
  D.p("**Hisoblash:**");
  D.eq(`v_{\\text{o‘r}} = \\frac{s}{t} = \\frac{${fx(r0.sm, 2)}\\ \\text{m}}{${fx(r0.t, 2)}\\ \\text{s}} = ${fx(r0.v, 2)}\\ \\text{m/s}`);
  D.S("Xulosa");
  docTail(D.X, nb, userText, [`• O‘rtacha tezlik yo‘lning uzunligiga bog‘liq: $s = ${fx(A.rows[0].sm, 2)}$ m da $${fx(A.rows[0].v, 2)}$ m/s, $s = ${fx(r0.sm, 2)}$ m da $${fx(r0.v, 2)}$ m/s.`, `• Keyingi bo‘laklarda tezlik ortib bormoqda ($${fx(A.rows[0].vs, 2)}$ → $${fx(r0.vs, 2)}$ m/s) — sharcha notekis (tezlanuvchan) harakat qiladi.`, ...(A.f ? [`• $s(t)$ grafigi parabola: $s \\approx ${fx(A.a / 2, 3)}\\,t^2$ (tezlanish $a \\approx ${fx(A.a, 2)}$ m/s$^2$).`] : [])], SITE);
  return { title: "Laboratoriya ishi. Notekis harakatda o‘rtacha tezlikni aniqlash", titlePlain: "Laboratoriya ishi. O‘rtacha tezlik", author: nb.f.name, sub: `Qiya novdagi sharcha (h = ${fx(Hh.h * 100, 0)} cm)`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "speed", fileBase: "Ortacha-tezlik-lab", docLabel: "Virtual laboratoriya ishi · 7-sinf", site: SITE,
  vh: (n) => (n ? 300 : 280),
  draw, step,
  down(x, y) { const g = geo.stop; return g && Math.hypot(x - g.cx, y - g.cy) < 22 && !st.run ? "stop" : null; },
  move(h, x, y) { const g = geo.stop, d = ((x - g.x0) * Math.cos(g.a) + (y - g.y0) * Math.sin(g.a)) / g.k; st.stop = Math.max(0.1, Math.min(LEN, Math.round(d * 100) / 100 - 0.0)); st.done = false; st.x = 0; st.t = 0; },
  cursor: (x, y) => { const g = geo.stop; return g && Math.hypot(x - g.cx, y - g.cy) < 22 ? "ew-resize" : ""; },
  tools: [{ label: "Qo‘yib yuborish", run: (lab) => { reset(); st.run = true; lab.say("Sharcha dumalamoqda…"); } }, { label: "Sharchani qaytarish", run: () => reset() }],
  controls: [
    { type: "range", label: "To‘siq holati s", min: 0.1, max: 1.2, step: 0.01, get: () => st.stop, set: (v) => { st.stop = v; reset(); }, fmt: (v) => `${fmt(v * 100, 0)} cm` },
    { type: "seg", label: "Nov uchining balandligi", opts: Object.entries(HS).map(([k, v]) => [k, v.s]), get: () => st.hk, set: (v) => { st.hk = v; reset(); } },
    { type: "note", text: "Yo‘l s nov boshidagi yashil chiziqdan to‘siqqacha chizg‘ich bo‘yicha o‘qiladi." },
  ],
  readouts() {
    return [["Yo‘l <i>s</i>", `${fmt(st.stop * 100, 0)}<small>cm</small>`, "to‘siqqacha", "blue"], ["Vaqt <i>t</i>", `${fmt(st.t, 2)}<small>s</small>`, st.run ? "sekundomer ishlamoqda" : st.done ? "to‘siqqa yetdi" : "sekundomer", "orange"],
      ["O‘rtacha tezlik", st.done ? `${fmt(st.stop / st.t, 2)}<small>m/s</small>` : "—", "s / t"], ["Balandlik", HS[st.hk].s, `nov uzunligi ${fmt(LEN, 1)} m`]];
  },
  record() {
    if (!st.done) return { err: "Avval sharchani qo‘yib yuboring va u to‘siqqa yetishini kuting." };
    const v = { s: fmt(st.stop * 100, 0), t: fmt(st.t, 2) };
    return { t: "t1", v, text: `h = ${HS[st.hk].s}: s = ${v.s} cm, t = ${v.t} s` };
  },
  explain() { return st.done ? `Sharcha ${fmt(st.stop * 100, 0)} cm yo‘lni ${fmt(st.t, 2)} s da bosib o‘tdi: o‘rtacha tezlik ${fmt(st.stop / st.t, 2)} m/s. To‘siqni uzoqroqqa qo‘ysangiz, o‘rtacha tezlik kattaroq chiqadi — sharcha tezlashib boradi.` : "To‘siqni qo‘ying va sharchani qo‘yib yuboring."; },
  steps: ["To‘siqni 30 cm ga qo‘ying va «Qo‘yib yuborish». Sharcha to‘siqqa urilgach, s va t ni <b>Qaydga yozing</b>.", "To‘siqni 60, 90, 120 cm ga surib takrorlang.", "Qaydlarni jadvalga o‘tkazing: o‘rtacha tezlik va bo‘laklardagi tezlik avtomatik.", "Nov balandligini o‘zgartirib (jadval sharti) takrorlash mumkin. Xulosa va PDF."],
  formulas: ["O‘rtacha tezlik: <span class=\"sim-math\">v<sub>o‘r</sub> = s / t</span>", "Bo‘lakdagi tezlik: <span class=\"sim-math\">v = Δs / Δt</span>", "1 m/s = 3,6 km/h"],
  note: "Sekundomer elektron (darvozalar) — qo‘lda o‘lchashdagi kechikish xatosi yo‘q.",
  notebook: {
    intro: "Jadval sharti — nov uchining balandligi. Kamida 3 xil yo‘l.",
    conclusionPh: "O‘rtacha tezlik yo‘lga bog‘liqmi? Sharcha tekis harakat qiladimi yoki notekismi?",
    hint: "Javob bering: 1) Turli yo‘llarda o‘rtacha tezlik bir xilmi? 2) Bo‘laklardagi tezlik qanday o‘zgaradi? 3) Harakat tekismi yoki notekis? 4) Nov balandligi oshsa nima bo‘ladi?",
    tables: [
      { key: "t1", okLabel: "O‘rtacha tezlik", need: "kamida 3 xil yo‘l", title: "Yo‘l, vaqt va o‘rtacha tezlik",
        cond: { fields: [{ k: "hk", label: "Balandlik", opts: Object.entries(HS).map(([k, v]) => [k, v.s]) }], sync: () => ({ hk: st.hk }), init: { hk: "h10" } },
        head: ["s, cm", "t, s", "v = s/t, m/s", "Tekshiruv"], cols: [{ k: "s", kind: "num" }, { k: "t", kind: "num" }], outs: ["v"],
        blank: () => ({ s: "", t: "" }), rows: 4, max: 10, narrow: true,
        parse: (r) => ({ s: num(r.s), t: num(r.t) }), check: (r) => (!(r.s > 0 && r.t > 0) ? { ok: false, err: "s, t > 0" } : { ok: true }),
        analyze, out: (A, j, r) => ({ v: fmt(r.s / 100 / r.t, 2) }),
        summary: (A) => (A.rows.length >= 2 ? [["Eng qisqa yo‘lda", `${fmt(A.rows[0].v, 2)} m/s`, `s = ${fmt(A.rows[0].s, 0)} cm`], ["Eng uzun yo‘lda", `${fmt(A.rows.at(-1).v, 2)} m/s`, `s = ${fmt(A.rows.at(-1).s, 0)} cm`]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
