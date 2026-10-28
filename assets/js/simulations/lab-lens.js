// ==========================================================================
// Laboratoriya ishi: Yig‘uvchi linzaning fokus masofasi va optik kuchini aniqlash (simulations/lab-linza.html). Darslik: 9-sinf §53.
// Qurilma: optik skameyka (0…100 cm shkala), yoritilgan buyum («F» harfli diapozitiv, 0 cm da), yig‘uvchi linza va ekran
// suriladigan tutqichlarda. Ekranda tasvir aniq bo‘lganda d va f skameyka shkalasidan o‘qiladi.
// Fizika: optics-physics.js (yupqa linza formulasi, ekrandagi xiralik diametri).
// ==========================================================================

import { createLab, docKit, fitLine, meanErr, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { thinLens, blurDiameter } from "./optics-physics.js";
import { rulerH, label, hint, rr, F } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-linza.html", label: "oliyfizika.uz/simulations/lab-linza.html" };
// linzalar: nominal fokus masofasi yozilmagan — o‘quvchi topadi (haqiqiy F, cm)
const LENSES = { l1: { name: "Linza №1", F: 10.3 }, l2: { name: "Linza №2", F: 14.8 }, l3: { name: "Linza №3", F: 19.6 } };
const APER = 1.5, H_OBJ = 2, BLUR_OK = 0.16; // cm
const st = { lens: "l1", xl: 30, xs: 60 };
const geo = {};
const snap = (v) => Math.round(v * 2) / 2;

function optics() {
  const Fc = LENSES[st.lens].F, d = st.xl, img = thinLens(Fc, d), xsRel = st.xs - st.xl;
  const blur = img.inf || !img.real ? 99 : blurDiameter(Fc, d, APER, xsRel);
  return { d, f: xsRel, img, blur, m: img.m };
}

/* ------------------------------------------------------------------ Sahna */
const LAY = {
  wide: { x0: 40, k: 6, rail: 236, top: 120, inset: [470, 10, 200, 104] },
  narrow: { x0: 16, k: 3.68, rail: 250, top: 150, inset: [200, 8, 192, 104] },
};
function holder(ctx, c, x, rail, top, col) {
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(x - 2, top + 30, 4, rail - top - 30); rr(ctx, x - 12, rail - 8, 24, 14, 3); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, rail + 8); ctx.lineTo(x - 5, rail + 15); ctx.lineTo(x + 5, rail + 15); ctx.closePath(); ctx.fill(); // ko‘rsatkich
}
function screenImage(ctx, c, box, o) {
  const [x, y, w, h] = box;
  ctx.fillStyle = c.dark ? "#0f172a" : "#ffffff"; rr(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = c.dark ? "#475569" : "#cbd5e1"; ctx.lineWidth = 1; ctx.stroke();
  label(ctx, "Ekrandagi tasvir", x + 8, y + 10, c.text2, F(9, 700), "left");
  const sx = x + 10, sy = y + 20, sw = w - 20, sh = h - 28;
  ctx.save(); rr(ctx, sx, sy, sw, sh, 4); ctx.clip();
  ctx.fillStyle = "#f5f5f4"; ctx.fillRect(sx, sy, sw, sh);
  const ppc = 14; // ekran: 1 cm = 14 px
  if (o.img.real && !o.img.inf && o.blur < 8) {
    const s = Math.abs(o.m) * H_OBJ * ppc / 10, cx = sx + sw / 2, cy = sy + sh / 2, br = (o.blur * ppc) / 2;
    const glow = Math.min(1, 1.2 / Math.max(0.3, Math.abs(o.m)));
    // «F» harfi teskari (m < 0): bir nechta siljigan nusxalar — xiralik
    const n = br < 0.6 ? 1 : 10, al = (n === 1 ? 0.95 : 0.22) * (0.5 + 0.5 * glow);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, ox = n === 1 ? 0 : Math.cos(ang) * br, oy = n === 1 ? 0 : Math.sin(ang) * br;
      ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.scale(-1, -1); // teskari va chapga-o‘ngga almashgan
      ctx.fillStyle = `rgba(234,88,12,${al})`;
      const u = s; ctx.fillRect(-3 * u, -5 * u, 1.6 * u, 10 * u); ctx.fillRect(-3 * u, -5 * u, 6 * u, 1.6 * u); ctx.fillRect(-3 * u, -0.8 * u, 4.4 * u, 1.6 * u);
      ctx.restore();
    }
    if (br > 3) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, br + 10 * s); g.addColorStop(0, "rgba(253,186,116,0.35)"); g.addColorStop(1, "rgba(253,186,116,0)"); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh); }
  } else {
    const g = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, 0, sx + sw / 2, sy + sh / 2, sw * 0.6); g.addColorStop(0, "rgba(253,186,116,0.35)"); g.addColorStop(1, "rgba(253,186,116,0.08)"); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
  }
  ctx.restore();
}
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, L = narrow ? LAY.narrow : LAY.wide, o = optics(), X = (cm) => L.x0 + cm * L.k;
  geo.L = L;
  // skameyka
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8"; ctx.fillRect(L.x0 - 10, L.rail + 6, 100 * L.k + 20, 8);
  rulerH(ctx, c, L.x0, L.rail + 16, L.k, 100, { h: 20, sub: 1, step: 10, labelEvery: narrow ? 2 : 1 });
  const ay = (L.top + L.rail) / 2 - 10; // optik o‘q
  ctx.setLineDash([3, 5]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(0), ay); ctx.lineTo(X(100), ay); ctx.stroke(); ctx.setLineDash([]);
  // yorug‘lik dastasi: buyumdan linzagacha va linzadan tasvir/ekrangacha
  const lensH = narrow ? 30 : 38;
  ctx.fillStyle = "rgba(253,224,71,0.16)";
  ctx.beginPath(); ctx.moveTo(X(0), ay - 8); ctx.lineTo(X(st.xl), ay - lensH); ctx.lineTo(X(st.xl), ay + lensH); ctx.lineTo(X(0), ay + 8); ctx.fill();
  if (o.img.real && !o.img.inf) {
    const xi = st.xl + o.img.f, xe = Math.min(st.xs, 100), t = (xe - st.xl) / (xi - st.xl);
    const half = lensH * Math.abs(1 - t);
    ctx.beginPath(); ctx.moveTo(X(st.xl), ay - lensH);
    if (xi < xe) { ctx.lineTo(X(xi), ay); ctx.lineTo(X(xe), ay + half); ctx.lineTo(X(xe), ay - half); ctx.lineTo(X(xi), ay); ctx.lineTo(X(st.xl), ay + lensH); }
    else { ctx.lineTo(X(xe), ay - half); ctx.lineTo(X(xe), ay + half); ctx.lineTo(X(st.xl), ay + lensH); }
    ctx.fill();
  }
  // buyum (yoritgich + «F»)
  holder(ctx, c, X(0), L.rail, L.top, "#ea580c");
  ctx.fillStyle = "#1f2937"; rr(ctx, X(0) - 16, ay - 22, 22, 44, 4); ctx.fill(); ctx.fillStyle = "#fde68a"; ctx.fillRect(X(0) + 4, ay - 12, 5, 24);
  label(ctx, "F", X(0) + 6, ay - 28, "#ea580c", F(12, 800));
  // linza
  holder(ctx, c, X(st.xl), L.rail, L.top, "#2563eb");
  ctx.fillStyle = c.dark ? "rgba(125,211,252,0.45)" : "rgba(186,230,253,0.85)"; ctx.strokeStyle = "#0284c7"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(X(st.xl), ay, 6, lensH, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  label(ctx, LENSES[st.lens].name, X(st.xl), L.top - 4, c.text2, F(10, 700));
  // ekran
  holder(ctx, c, X(st.xs), L.rail, L.top, "#16a34a");
  ctx.fillStyle = c.dark ? "#e2e8f0" : "#f8fafc"; ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.fillRect(X(st.xs) - 3, ay - lensH - 12, 6, 2 * lensH + 24); ctx.strokeRect(X(st.xs) - 3, ay - lensH - 12, 6, 2 * lensH + 24);
  label(ctx, "ekran", X(st.xs), L.top - 4, c.text2, F(10, 700));
  geo.lens = X(st.xl); geo.scr = X(st.xs); geo.y0 = L.top - 14; geo.y1 = L.rail + 16;
  screenImage(ctx, c, L.inset, o);
  hint(ctx, c, "linza va ekranni suring", narrow ? 12 : 120, narrow ? 24 : 24);
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows) {
  const rs = rows.slice().sort((a, b) => a.d - b.d).map((r) => ({ ...r, F: (r.d * r.f) / (r.d + r.f), G: r.f / r.d }));
  const m = meanErr(rs.map((r) => r.F)), fit = rs.length >= 2 ? fitLine(rs.map((r) => [1 / r.d, 1 / r.f])) : null;
  const Ff = fit && fit.a > 0 ? 1 / fit.a : NaN;
  return { rows: rs, m, fit, Ff, D: 100 / m.m, ok: new Set(rs.map((r) => r.d)).size >= 3 };
}
function build(nb, res) {
  const A = res.t1.A, Ln = LENSES[res.t1.cond.lens] || LENSES.l1, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Yig‘uvchi linza beradigan haqiqiy tasvirni hosil qilish va buyum hamda tasvir masofalarini o‘lchash.", "Linzaning fokus masofasi va optik kuchini aniqlash."]);
  D.S("Qisqacha nazariya");
  D.p("Yupqa yig‘uvchi linza uchun buyumdan linzagacha masofa $d$, linzadan haqiqiy tasvirgacha masofa $f$ va fokus masofasi $F$ orasida bog‘lanish (linza formulasi):");
  D.eq("\\frac{1}{F} = \\frac{1}{d} + \\frac{1}{f}\\quad\\Rightarrow\\quad F = \\frac{df}{d + f},\\qquad D = \\frac{1}{F}", 1);
  D.p("Optik kuch $D$ dioptriyalarda ($F$ metrda). Chiziqli kattalashtirish $\\Gamma = f/d$. $1/f$ ning $1/d$ ga bog‘liqligi qiyaligi $-1$ bo‘lgan to‘g‘ri chiziq bo‘lib, uning $1/f$ o‘qi bilan kesishishi $1/F$ ga teng.");
  D.S("Jihozlar");
  D.list(["Optik skameyka ($0\\ldots 100$ cm shkala, bo‘linma qiymati $1$ cm, tutqich ko‘rsatkichi $0{,}5$ cm aniqlikda o‘qiladi).", `Yoritilgan buyum («F» harfi), ${Ln.name.toLowerCase()} (yig‘uvchi), ekran.`]);
  D.S("Ishni bajarish tartibi");
  D.list(["Buyum skameykaning $0$ belgisiga qo‘yildi. Linza $d$ masofaga o‘rnatildi.", "Ekran surilib, unda buyumning aniq tasviri hosil qilindi; linza va ekran holatidan $d$ va $f$ yozildi.", "Tajriba linzaning bir necha holati uchun takrorlandi."], true);
  D.S("O‘lchash natijalari");
  D.table(`Buyum va tasvir masofalari (${Ln.name})`, ["№", "$d$, cm", "$f$, cm", "$F = \\frac{df}{d+f}$, cm", "$\\Gamma = f/d$", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.d, 1)}$`, `$${fx(r.f, 1)}$`, `$${fx(r.F, 2)}$`, `$${fx(r.G, 2)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  if (A.fit) {
    const xs = A.rows.map((r) => 1 / r.d);
    D.fig("lens", "$1/f$ ning $1/d$ ga bog‘liqligi. To‘g‘ri chiziqning ordinata o‘qi bilan kesishishi — $1/F$.", { xmin: 0, xmax: Math.max(...xs) * 1.15, ymin: 0, ymax: A.fit.a * 1.1, legendPos: "north east", xlab: "1/d, 1/cm", ylab: "1/f, 1/cm",
      series: [{ kind: "pts", data: A.rows.map((r) => [1 / r.d, 1 / r.f]), color: "#c2410c", label: "tajriba" }, { kind: "line", fn: (x) => A.fit.a + A.fit.b * x, color: "#1d4ed8", label: `1/f = ${fmt(A.fit.a, 4)} − ${fmt(-A.fit.b, 2)}·(1/d)` }] });
  }
  const r0 = A.rows[0];
  D.p("**Hisoblash:**");
  D.eq([`F_1 = \\frac{${fx(r0.d, 1)} \\cdot ${fx(r0.f, 1)}}{${fx(r0.d, 1)} + ${fx(r0.f, 1)}} = ${fx(r0.F, 2)}\\ \\text{cm}`,
    `\\langle F\\rangle = (${fx(A.m.m, 1)} \\pm ${fx(Math.max(A.m.s, 0.05), 1)})\\ \\text{cm},\\qquad D = \\frac{1}{F} = \\frac{1}{${fx(A.m.m / 100, 3)}\\ \\text{m}} = ${fx(A.D, 1)}\\ \\text{dptr}`,
    ...(Number.isFinite(A.Ff) ? [`\\text{grafikdan: } F = \\frac{1}{${fx(A.fit.a, 4)}} = ${fx(A.Ff, 1)}\\ \\text{cm}`] : [])]);
  D.S("Xulosa");
  docTail(D.X, nb, userText, [`• ${Ln.name} fokus masofasi $F = (${fx(A.m.m, 1)} \\pm ${fx(Math.max(A.m.s, 0.05), 1)})$ cm, optik kuchi $D \\approx ${fx(A.D, 1)}$ dptr.`, "• Buyum linzaga yaqinlashgan sari ($d \\to F$) tasvir uzoqlashadi va kattalashadi; $d > 2F$ da tasvir kichraygan.", "• Barcha holatlarda tasvir haqiqiy va teskari."], SITE);
  return { title: "Laboratoriya ishi. Yig‘uvchi linzaning fokus masofasi va optik kuchini aniqlash", titlePlain: "Laboratoriya ishi. Linzaning optik kuchi", author: nb.f.name, sub: `${Ln.name}: linza formulasi`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "lens", fileBase: "Linza-lab", docLabel: "Virtual laboratoriya ishi · 9-sinf", site: SITE,
  vh: (n) => (n ? 300 : 290),
  draw,
  down(x, y) {
    if (y < geo.y0 - 30 || y > geo.y1 + 20) return null;
    const dl = Math.abs(x - geo.lens), ds = Math.abs(x - geo.scr);
    if (Math.min(dl, ds) > 18) return null;
    return dl <= ds ? "lens" : "scr";
  },
  move(h, x) {
    const v = snap((x - geo.L.x0) / geo.L.k);
    if (h === "lens") { st.xl = Math.max(3, Math.min(96, v)); if (st.xs < st.xl + 2) st.xs = Math.min(100, st.xl + 2); }
    else st.xs = Math.max(st.xl + 2, Math.min(100, v));
  },
  cursor: (x, y) => (y > geo.y0 - 30 && y < geo.y1 + 20 && Math.min(Math.abs(x - geo.lens), Math.abs(x - geo.scr)) <= 18 ? "ew-resize" : ""),
  controls: [
    { type: "seg", label: "Linza", opts: Object.entries(LENSES).map(([k, v]) => [k, v.name]), get: () => st.lens, set: (v) => { st.lens = v; } },
    { type: "range", label: "Linza holati", min: 3, max: 96, step: 0.5, get: () => st.xl, set: (v) => { st.xl = v; if (st.xs < v + 2) st.xs = Math.min(100, v + 2); }, fmt: (v) => `${fmt(v, 1)} cm` },
    { type: "range", label: "Ekran holati", min: 5, max: 100, step: 0.5, get: () => st.xs, set: (v) => { st.xs = Math.max(st.xl + 2, v); }, fmt: (v) => `${fmt(Math.max(st.xl + 2, v), 1)} cm` },
    { type: "note", text: "Buyum 0 cm da. Linzani qo‘ying, so‘ng ekranni surib, tasvir eng aniq bo‘lgan joyni toping (o‘ng yuqoridagi oyna)." },
  ],
  readouts() {
    const o = optics(), sharp = o.blur < BLUR_OK;
    return [["Buyum masofasi <i>d</i>", `${fmt(o.d, 1)}<small>cm</small>`, "skameyka shkalasi", "blue"], ["Ekran masofasi <i>f</i>", `${fmt(o.f, 1)}<small>cm</small>`, "linzadan ekrangacha", "orange"],
      ["Tasvir", sharp ? "aniq" : o.img.real ? "xira" : "hosil bo‘lmaydi", sharp ? "o‘lchash mumkin" : o.img.real ? "ekranni suring" : "d ≤ F — haqiqiy tasvir yo‘q", sharp ? "green" : ""], ["Linza", LENSES[st.lens].name, "F — noma’lum"]];
  },
  record() {
    const o = optics();
    if (!o.img.real || o.img.inf) return { err: "Ekranda tasvir yo‘q — linzani buyumdan uzoqroq qo‘ying." };
    if (o.blur >= BLUR_OK) return { err: "Ekrandagi tasvir hali xira — ekranni surib, eng aniq holatni toping." };
    const v = { d: fmt(o.d, 1), f: fmt(o.f, 1) };
    return { t: "t1", v, text: `${LENSES[st.lens].name}: d = ${v.d} cm, f = ${v.f} cm` };
  },
  explain() { const o = optics(); return !o.img.real ? "Buyum fokusda yoki undan yaqinda — linza haqiqiy tasvir bermaydi (lupa kabi mavhum tasvir)." : o.blur < BLUR_OK ? `Tasvir aniq: haqiqiy, teskari, ${Math.abs(o.m) > 1 ? "kattalashgan" : "kichraygan"} (Γ ≈ ${fmt(Math.abs(o.m), 2)}).` : "Ekrandagi tasvir xira — ekran tasvir hosil bo‘ladigan joyda emas."; },
  steps: ["Linzani tanlang va uni buyumdan biror masofaga qo‘ying (masalan, 25 cm).", "Ekranni surib, tasvir eng aniq bo‘lgan holatni toping; d va f ni <b>Qaydga yozing</b>.", "Linzani 4–5 xil masofaga qo‘yib takrorlang (2F dan uzoqda ham, F va 2F orasida ham).", "Qaydlarni jadvalga o‘tkazing: F, Γ va D avtomatik. Xulosa va PDF."],
  formulas: ["Linza formulasi: <span class=\"sim-math\">1/F = 1/d + 1/f</span>", "<span class=\"sim-math\">F = df / (d + f)</span>", "Optik kuch: <span class=\"sim-math\">D = 1/F</span> (dptr, F — metrda)", "Kattalashtirish: <span class=\"sim-math\">Γ = f / d</span>"],
  note: "Tasvir aniqligini ko‘z bilan baholash asosiy xato manbai: aniq tasvir ekranning bir necha millimetrlik siljishida saqlanadi.",
  notebook: {
    intro: "Jadval sharti — qaysi linza. Kamida 3 xil d (tasvir aniq bo‘lganda).",
    conclusionPh: "Linzaning fokus masofasi va optik kuchi qancha chiqdi? Tasvir xususiyatlari d ga qanday bog‘liq?",
    hint: "Javob bering: 1) F va D qancha? 2) d ortsa f qanday o‘zgaradi? 3) Qachon tasvir kattalashgan, qachon kichraygan? 4) d < F da nima bo‘ladi?",
    tables: [
      { key: "t1", okLabel: "Linza formulasi", need: "kamida 3 xil buyum masofasi", title: "Buyum va tasvir masofalari",
        cond: { fields: [{ k: "lens", label: "Linza", opts: Object.entries(LENSES).map(([k, v]) => [k, v.name]) }], sync: () => ({ lens: st.lens }), init: { lens: "l1" } },
        head: ["d, cm", "f, cm", "F, cm", "Γ", "Tekshiruv"], cols: [{ k: "d", kind: "num" }, { k: "f", kind: "num" }], outs: ["F", "G"],
        blank: () => ({ d: "", f: "" }), rows: 4, max: 10, narrow: true,
        parse: (r) => ({ d: num(r.d), f: num(r.f) }), check: (r) => (!(r.d > 0) || !(r.f > 0) ? { ok: false, err: "d, f > 0" } : { ok: true }),
        analyze, out: (A, j, r) => ({ F: fmt((r.d * r.f) / (r.d + r.f), 2), G: fmt(r.f / r.d, 2) }),
        summary: (A) => (A.rows.length ? [["Fokus masofasi F", `${fmt(A.m.m, 1)} cm`, A.rows.length > 1 ? `± ${fmt(Math.max(A.m.s, 0.05), 1)} cm` : ""], ["Optik kuch D", `${fmt(A.D, 1)} dptr`, "D = 1/F"]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
