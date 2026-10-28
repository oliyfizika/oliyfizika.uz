// ==========================================================================
// Laboratoriya ishi: Matematik mayatnik yordamida erkin tushish tezlanishini aniqlash (simulations/lab-mayatnik.html). Darslik: 10-sinf §17.
// Qurilma: shtativga osilgan ipdagi po‘lat sharcha, vertikal chizg‘ich (ip uzunligi sharcha markazigacha), sekundomer.
// Sharcha sahnada yon tomonga tortib qo‘yib yuboriladi; sekundomer qo‘lda yoki N tebranishda avtomatik to‘xtaydi.
// Fizika: pendulum-physics.js (sin θ li to‘liq tenglama, RK4) — katta amplitudada davr biroz ortadi.
// ==========================================================================

import { createLab, docKit, fitOrigin, meanErr, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { advance } from "./pendulum-physics.js";
import { rulerV, stopwatch, label, hint, inBox, F, dot } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-mayatnik.html", label: "oliyfizika.uz/simulations/lab-mayatnik.html" };
const G = 9.80, GAMMA = 0.004, TH_MAX = 35 * Math.PI / 180, DEG = 180 / Math.PI;
const st = { l: 0.8, s: null, sw: { t: 0, run: false, armed: false, n: 0 }, auto: 20, speed: 1, drag: false, th0: 0 };
const geo = {};

const LAY = { wide: { px: 300, py: 26, k: 240, sw: [500, 40, 150] }, narrow: { px: 150, py: 26, k: 250, sw: [244, 40, 140] } };
const lay = (narrow) => (narrow ? LAY.narrow : LAY.wide);
const theta = () => (st.drag ? st.th0 : st.s ? st.s.th : 0);

function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, L = lay(narrow), k = L.k;
  geo.narrow = narrow;
  // shtativ
  const sx = L.px - 70;
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(sx - 4, L.py - 10, 8, h - L.py - 2); ctx.fillRect(sx - 40, h - 12, 90, 10);
  ctx.fillRect(sx, L.py - 10, L.px - sx + 14, 7); ctx.fillStyle = "#1e293b"; ctx.fillRect(L.px - 8, L.py - 14, 16, 14);
  // chizg‘ich: 0 — osilish nuqtasida
  rulerV(ctx, c, L.px + 26, L.py, k / 100, 125, { down: true, w: 26, sub: 1, step: 10 });
  const th = theta(), bx = L.px + Math.sin(th) * st.l * k, by = L.py + Math.cos(th) * st.l * k;
  // muvozanat chizig‘i va burchak
  ctx.setLineDash([4, 4]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L.px, L.py); ctx.lineTo(L.px, L.py + st.l * k + 16); ctx.stroke(); ctx.setLineDash([]);
  if (Math.abs(th) > 0.01) {
    ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(L.px, L.py, 46, Math.PI / 2, Math.PI / 2 - th, th > 0); ctx.stroke();
    if (st.drag) label(ctx, `${fmt(Math.abs(th) * DEG, 0)}°`, L.px + Math.sin(th / 2) * 60, L.py + Math.cos(th / 2) * 60, "#2563eb", F(11, 700));
  }
  // ip va sharcha
  ctx.strokeStyle = c.dark ? "#e2e8f0" : "#334155"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L.px, L.py); ctx.lineTo(bx, by); ctx.stroke();
  const g = ctx.createRadialGradient(bx - 4, by - 4, 1, bx, by, 12); g.addColorStop(0, "#f8fafc"); g.addColorStop(0.5, "#94a3b8"); g.addColorStop(1, "#334155");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
  geo.bob = [bx, by];
  // tinch holatda: markazdan chizg‘ichgacha belgi
  if (!st.s && !st.drag) { ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + 12, by); ctx.lineTo(L.px + 26, by); ctx.stroke(); dot(ctx, bx, by, 1.8, "#dc2626"); }
  // sekundomer va hisoblagich
  const [wx, wy, ww] = L.sw;
  stopwatch(ctx, c, wx, wy, ww, st.sw.t, st.sw.run);
  geo.sw = { x0: wx, x1: wx + ww, y0: wy, y1: wy + 60 };
  label(ctx, `Tebranishlar: ${st.sw.n}`, wx + ww / 2, wy + 80, c.text, F(12, 700));
  label(ctx, st.auto ? `avtomatik to‘xtash: N = ${st.auto}` : "qo‘lda to‘xtatiladi", wx + ww / 2, wy + 98, c.text3, F(10));
  if (st.sw.armed) label(ctx, "muvozanatdan o‘tishda boshlanadi…", wx + ww / 2, wy + 116, "#2563eb", F(10, 600));
  hint(ctx, c, st.s ? "sharchani bosing: to‘xtatish" : "sharchani yonga torting va qo‘yib yuboring", narrow ? 8 : L.px + 70, narrow ? h - 24 : h - 30);
  hint(ctx, c, "sekundomerni bosing: start / stop", wx, wy + 140);
}

/* ------------------------------------------------------------------ Sekundomer */
function swToggle(lab) {
  const W = st.sw;
  if (W.run || W.armed) { W.run = false; W.armed = false; lab.say(`Sekundomer to‘xtatildi: ${fmt(W.t, 2)} s, ${W.n} ta tebranish.`); return; }
  W.t = 0; W.n = 0;
  if (!st.s) { lab.say("Avval mayatnikni tebrantiring.", "warn"); return; }
  if (st.auto) { W.armed = true; lab.say(`Sekundomer muvozanat holatidan o‘tishda ishga tushadi va ${st.auto} tebranishda to‘xtaydi.`); } else { W.run = true; W.t0 = st.s.t; lab.say("Sekundomer ishlamoqda — tebranishlarni sanang va to‘xtating."); }
}
function step(dt, lab) {
  if (!st.s) return false;
  const W = st.sw, sim = Math.min(dt, 0.05) * st.speed;
  st.s = advance(st.s, { w2: G / st.l, gamma: GAMMA }, sim, (a, b) => {
    if (!(a.th < 0 && b.th >= 0)) return; // muvozanatdan musbat yo‘nalishda o‘tish
    const tc = a.t + (-a.th / (b.th - a.th)) * (b.t - a.t);
    if (W.armed) { W.armed = false; W.run = true; W.t0 = tc; W.n = 0; return; }
    if (W.run) { W.n += 1; if (st.auto && W.n >= st.auto) { W.run = false; W.t = tc - W.t0; W.stopAt = true; } }
  });
  if (W.run) W.t = st.s.t - W.t0;
  if (W.stopAt) { W.stopAt = false; lab.say(`Sekundomer to‘xtadi: ${W.n} ta tebranish, t = ${fmt(W.t, 2)} s.`, "ok"); }
  return true;
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows) {
  const rs = rows.slice().sort((a, b) => a.l - b.l).map((r) => { const T = r.t / r.N, lm = r.l / 100; return { ...r, T, T2: T * T, lm, g: (4 * Math.PI ** 2 * lm) / (T * T) }; });
  const f = rs.length >= 2 ? fitOrigin(rs.map((r) => [r.lm, r.T2])) : null, gm = meanErr(rs.map((r) => r.g));
  const gf = f ? (4 * Math.PI ** 2) / f.k : NaN;
  return { rows: rs, f, gf, sgf: f ? (gf * f.sk) / f.k : NaN, gm, ok: new Set(rs.map((r) => r.l)).size >= 4 };
}
function build(nb, res) {
  const A = res.t1.A, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Matematik mayatnik tebranish davrining ip uzunligiga bog‘liqligini o‘rganish.", "Erkin tushish tezlanishi $g$ ni aniqlash."]);
  D.S("Qisqacha nazariya");
  D.p("Kichik amplitudalarda ($\\alpha \\lesssim 10^\\circ$) matematik mayatnikning tebranish davri amplituda va massaga bog‘liq emas:");
  D.eq("T = 2\\pi\\sqrt{\\frac{l}{g}}\\quad\\Rightarrow\\quad T^2 = \\frac{4\\pi^2}{g}\\,l,\\qquad g = \\frac{4\\pi^2 l}{T^2}", 1);
  D.p("Demak, $T^2(l)$ grafigi koordinata boshidan o‘tuvchi to‘g‘ri chiziq; uning qiyaligi $k = 4\\pi^2/g$. Davr $N$ ta to‘liq tebranish vaqtidan topiladi: $T = t/N$ — bu tasodifiy xatoni $N$ marta kamaytiradi.");
  D.S("Jihozlar");
  D.list(["Shtativ, cho‘zilmaydigan ipga osilgan po‘lat sharcha.", "Chizg‘ich (bo‘linma qiymati $1$ mm) — ip uzunligi osilish nuqtasidan sharcha markazigacha o‘lchanadi.", "Sekundomer (aniqligi $0{,}01$ s)."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Ip uzunligi chizg‘ich bilan o‘lchandi. Sharcha kichik burchakka ($5$–$10^\\circ$) og‘dirilib qo‘yib yuborildi.", "$N$ ta to‘liq tebranish vaqti $t$ sekundomer bilan o‘lchandi; davr $T = t/N$.", "Tajriba kamida 4 xil ip uzunligida takrorlandi; $T^2(l)$ grafigidan $g$ topildi."], true);
  D.S("O‘lchash natijalari");
  D.table("Tebranish davrining ip uzunligiga bog‘liqligi", ["№", "$l$, m", "$N$", "$t$, s", "$T = t/N$, s", "$T^2$, s$^2$", "$g$, m/s$^2$", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.lm, 3)}$`, `$${fx(r.N, 0)}$`, `$${fx(r.t, 2)}$`, `$${fx(r.T, 3)}$`, `$${fx(r.T2, 3)}$`, `$${fx(r.g, 2)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  const lmax = Math.max(...A.rows.map((r) => r.lm)) * 1.15;
  D.fig("t2l", "Tebranish davri kvadratining ip uzunligiga bog‘liqligi. To‘g‘ri chiziq koordinata boshidan o‘tadi.", { xmin: 0, xmax: lmax, ymin: 0, ymax: Math.max(...A.rows.map((r) => r.T2)) * 1.2, legendPos: "north west", xlab: "l, m", ylab: "T², s²",
    series: [{ kind: "pts", data: A.rows.map((r) => [r.lm, r.T2]), color: "#c2410c", label: "tajriba" }, ...(A.f ? [{ kind: "line", fn: (x) => A.f.k * x, color: "#1d4ed8", label: `T² = ${fmt(A.f.k, 3)}·l` }] : [])] });
  const r0 = A.rows.at(-1);
  D.p("**Hisoblash.** Bitta o‘lchash uchun (1) formuladan va grafik qiyaligidan:");
  D.eq([`g = \\frac{4\\pi^2 l}{T^2} = \\frac{4\\pi^2 \\cdot ${fx(r0.lm, 3)}}{${fx(r0.T, 3)}^2} = ${fx(r0.g, 2)}\\ \\text{m/s}^2`,
    `k = ${fx(A.f.k, 3)}\\ \\text{s}^2/\\text{m},\\qquad g = \\frac{4\\pi^2}{k} = (${fx(A.gf, 2)} \\pm ${fx(Math.max(A.sgf, 0.005), 2)})\\ \\text{m/s}^2`,
    `\\langle g\\rangle = (${fx(A.gm.m, 2)} \\pm ${fx(Math.max(A.gm.s, 0.005), 2)})\\ \\text{m/s}^2,\\qquad \\varepsilon = \\frac{|g - g_{\\text{jadval}}|}{g_{\\text{jadval}}} = ${fx(Math.abs(pct(A.gf, 9.8)), 1)}\\ \\%`]);
  D.S("Xulosa");
  docTail(D.X, nb, userText, [`• Erkin tushish tezlanishi $g = (${fx(A.gf, 2)} \\pm ${fx(Math.max(A.sgf, 0.005), 2)})$ m/s$^2$ (jadval qiymati $9{,}8$ m/s$^2$).`, "• $T^2$ ip uzunligiga to‘g‘ri proporsional — $T = 2\\pi\\sqrt{l/g}$ formulasi tasdiqlandi.", "• Ko‘p tebranish vaqtini o‘lchash davrni aniqroq topish imkonini beradi."], SITE);
  return { title: "Laboratoriya ishi. Matematik mayatnik yordamida erkin tushish tezlanishini aniqlash", titlePlain: "Laboratoriya ishi. Mayatnik bilan g ni aniqlash", author: nb.f.name, sub: "Tebranish davrining ip uzunligiga bog‘liqligi", meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "pendulum", fileBase: "Mayatnik-g-lab", docLabel: "Virtual laboratoriya ishi · 10-sinf", site: SITE,
  vh: (n) => (n ? 380 : 340),
  draw, step,
  down(x, y, lab) {
    if (inBox(x, y, geo.sw)) { swToggle(lab); return true; }
    if (geo.bob && Math.hypot(x - geo.bob[0], y - geo.bob[1]) < 22) {
      if (st.s) { st.s = null; st.sw.run = false; st.sw.armed = false; lab.say("Mayatnik to‘xtatildi."); return true; }
      st.drag = true; st.th0 = 0; return "bob";
    }
    return null;
  },
  move(h, x, y) { const L = lay(geo.narrow); st.th0 = Math.max(-TH_MAX, Math.min(TH_MAX, Math.atan2(x - L.px, Math.max(10, y - L.py)))); },
  up(h, lab) {
    st.drag = false;
    if (Math.abs(st.th0) < 0.5 / DEG) { st.th0 = 0; return; }
    st.s = { th: st.th0, w: 0, t: 0 }; st.sw.t = 0; st.sw.n = 0; st.sw.run = false; st.sw.armed = false;
    lab.say(Math.abs(st.th0) * DEG > 12 ? `Amplituda ${fmt(Math.abs(st.th0) * DEG, 0)}° — katta! Formula kichik burchaklar (≲ 10°) uchun.` : `Mayatnik tebranmoqda (amplituda ${fmt(Math.abs(st.th0) * DEG, 0)}°). Sekundomerni ishga tushiring.`, Math.abs(st.th0) * DEG > 12 ? "warn" : "");
  },
  cursor: (x, y) => (inBox(x, y, geo.sw) ? "pointer" : geo.bob && Math.hypot(x - geo.bob[0], y - geo.bob[1]) < 22 ? (st.s ? "pointer" : "grab") : ""),
  tools: [{ label: "Sekundomer: start / stop", run: (lab) => swToggle(lab) }, { label: "Nolga", run: () => { st.sw = { t: 0, run: false, armed: false, n: 0 }; } }],
  controls: [
    { type: "range", label: "Ip uzunligi", min: 0.2, max: 1.2, step: 0.005, get: () => st.l, set: (v) => { st.l = v; st.s = null; st.sw = { t: 0, run: false, armed: false, n: 0 }; }, fmt: (v) => `${fmt(v * 100, 1)} cm` },
    { type: "seg", label: "Sekundomerni to‘xtatish", opts: [[0, "Qo‘lda"], [10, "N = 10"], [20, "N = 20"]], get: () => st.auto, set: (v) => { st.auto = v; } },
    { type: "seg", label: "Vaqt oqimi", opts: [[1, "1×"], [5, "5× (tezlashtirilgan)"]], get: () => st.speed, set: (v) => { st.speed = v; } },
    { type: "note", text: "Uzunlik chizg‘ichdan osilish nuqtasidan sharcha markazigacha (qizil belgi) o‘qiladi. Sekundomer va sanoq — sahnada." },
  ],
  readouts() {
    return [["Ip uzunligi <i>l</i>", `${fmt(st.l * 100, 1)}<small>cm</small>`, "chizg‘ich bo‘yicha", "blue"], ["Vaqt <i>t</i>", `${fmt(st.sw.t, 2)}<small>s</small>`, st.sw.run ? "sekundomer ishlamoqda" : "sekundomer", "orange"],
      ["Tebranishlar <i>N</i>", String(st.sw.n), "to‘liq tebranishlar"], ["Davr <i>t/N</i>", st.sw.n ? `${fmt(st.sw.t / st.sw.n, 3)}<small>s</small>` : "—", "o‘lchangan"]];
  },
  record() {
    const W = st.sw;
    if (W.run || W.armed) return { err: "Avval sekundomerni to‘xtating." };
    if (!(W.n > 0 && W.t > 0)) return { err: "Tebranishlar vaqtini o‘lchang: mayatnikni tebrating va sekundomerni ishlating." };
    const v = { l: fmt(st.l * 100, 1), N: String(W.n), t: fmt(W.t, 2) };
    return { t: "t1", v, text: `l = ${v.l} cm: N = ${v.N}, t = ${v.t} s` };
  },
  explain() { const T = 2 * Math.PI * Math.sqrt(st.l / G); return st.s ? `Ip uzunligi ${fmt(st.l * 100, 1)} cm. Davr ip uzunligining kvadrat ildiziga proporsional: uzunlikni 4 marta oshirsangiz, davr 2 marta ortadi.` : `Ip uzunligi ${fmt(st.l * 100, 1)} cm. Sharchani 5–10° ga og‘dirib qo‘yib yuboring. (Taxminan bitta tebranish ${fmt(T, 1)} s davom etadi.)`; },
  steps: ["Ip uzunligini tanlang va chizg‘ichdan o‘qing (sharcha markazigacha).", "Sharchani 5–10° ga og‘dirib qo‘yib yuboring. Sekundomerni ishga tushiring va 10–20 ta to‘liq tebranish vaqtini o‘lchang (avtomatik to‘xtatish yoki qo‘lda). <b>Qaydga yozing</b>.", "Tajribani kamida 4–5 xil uzunlikda takrorlang (masalan, 40, 60, 80, 100, 120 cm).", "Qaydlarni jadvalga o‘tkazing: T, T² va g avtomatik; T²(l) grafigidan g topiladi. Xulosa va PDF."],
  formulas: ["Davr: <span class=\"sim-math\">T = t / N</span>", "Matematik mayatnik: <span class=\"sim-math\">T = 2π√(l / g)</span>", "<span class=\"sim-math\">g = 4π²l / T²</span>", "Grafikdan: <span class=\"sim-math\">T² = (4π²/g)·l</span>"],
  note: "Qo‘lda o‘lchashda sekundomerni bosishdagi kechikish (≈ 0,1–0,2 s) asosiy xato manbai; uni ko‘p tebranish vaqtini o‘lchab kamaytiramiz.",
  notebook: {
    intro: "Kamida 4 xil ip uzunligi. Uzunlik — cm da, vaqt — N ta tebranish uchun.",
    conclusionPh: "g ning qiymati qancha chiqdi va u jadval qiymatidan qancha farq qiladi? T²(l) grafigi qanday?",
    hint: "Javob bering: 1) T²(l) grafigi koordinata boshidan o‘tuvchi to‘g‘ri chiziqmi? 2) g qancha chiqdi? 3) Xatoning asosiy manbalari nima? 4) Nega ko‘p tebranish vaqti o‘lchanadi?",
    tables: [
      { key: "t1", okLabel: "T²(l)", need: "kamida 4 xil ip uzunligi", title: "Tebranish davrining ip uzunligiga bog‘liqligi",
        head: ["l, cm", "N", "t, s", "T, s", "g, m/s²", "Tekshiruv"], cols: [{ k: "l", kind: "num" }, { k: "N", kind: "num" }, { k: "t", kind: "num" }], outs: ["T", "g"],
        blank: () => ({ l: "", N: "", t: "" }), rows: 5, max: 12, narrow: true,
        parse: (r) => ({ l: num(r.l), N: num(r.N), t: num(r.t) }), check: (r) => (!(r.l > 0) || !(r.N >= 1) || !(r.t > 0) ? { ok: false, err: "l, N, t > 0" } : { ok: true }),
        analyze, out: (A, j, r) => { const T = r.t / r.N; return { T: fmt(T, 3), g: fmt((4 * Math.PI ** 2 * r.l) / 100 / (T * T), 2) }; },
        summary: (A) => (A.f ? [["g (grafikdan)", `${fmt(A.gf, 2)} m/s²`, `± ${fmt(Math.max(A.sgf, 0.005), 2)}`], ["g (o‘rtacha)", `${fmt(A.gm.m, 2)} m/s²`, `± ${fmt(Math.max(A.gm.s, 0.005), 2)}`], ["Farq", `${fmt(Math.abs(pct(A.gf, 9.8)), 1)} %`, "9,8 m/s² dan"]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
