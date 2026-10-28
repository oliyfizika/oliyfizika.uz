// ==========================================================================
// Laboratoriya ishi: Qattiq jismning zichligini aniqlash (simulations/lab-zichlik.html). Darslik: 7-sinf §18.
// Qurilma: elektron tarozi (0,1 g), menzurka (250 ml, bo‘linma qiymati 2 ml — 1 ml gacha o‘qiladi), suv, ipga bog‘langan jismlar.
// Jism sahnada sudrab tarozi yoki menzurkaga qo‘yiladi. Hajm — suv sathining ko‘tarilishidan: V = V₂ − V₁.
// Fizika: density-physics.js (moddalar zichligi jadvali, eng yaqin moddani aniqlash).
// ==========================================================================

import { createLab, docKit, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { MATERIALS, identify } from "./density-physics.js";
import { eScale, cylinder, label, hint, rr, F, inBox } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-zichlik.html", label: "oliyfizika.uz/simulations/lab-zichlik.html" };
// jismlar: o‘quvchiga moddasi noma’lum; V — haqiqiy hajm (cm³), shape — chizish
const BODIES = {
  b1: { name: "1-jism (silindr)", mat: "alu", V: 20.0, shape: "cyl" },
  b2: { name: "2-jism (silindr)", mat: "brass", V: 20.0, shape: "cyl" },
  b3: { name: "3-jism (tosh)", mat: "granite", V: 34.6, shape: "stone" },
  b4: { name: "4-jism (probka)", mat: "glass", V: 18.4, shape: "stopper" },
  b5: { name: "5-jism (gayka)", mat: "steel", V: 16.2, shape: "nut" },
};
const mass = (k) => BODIES[k].V * MATERIALS[BODIES[k].mat].rho * (1 + (k.charCodeAt(1) % 3 - 1) * 0.004); // g
const st = { b: "b1", at: "table", V1: 120, drag: null };
const geo = {};
const V1true = () => st.V1 + 0.3; // menisk: suv hajmi biroz farq qiladi
const Vnow = () => V1true() + (st.at === "cyl" ? BODIES[st.b].V : 0);

function bodyShape(ctx, k, x, yb, s = 1) {
  const B = BODIES[k], col = MATERIALS[B.mat].color, sz = Math.cbrt(B.V) * 6.2 * s;
  ctx.fillStyle = col; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
  if (B.shape === "cyl") { const g = ctx.createLinearGradient(x - sz / 2, 0, x + sz / 2, 0); g.addColorStop(0, col); g.addColorStop(0.45, "#f8fafc"); g.addColorStop(1, col); ctx.fillStyle = g; rr(ctx, x - sz * 0.4, yb - sz * 1.3, sz * 0.8, sz * 1.3, 3); ctx.fill(); ctx.stroke(); return sz * 1.3; }
  if (B.shape === "stone") { ctx.beginPath(); ctx.moveTo(x - sz * 0.7, yb); ctx.lineTo(x - sz * 0.8, yb - sz * 0.5); ctx.lineTo(x - sz * 0.3, yb - sz * 0.95); ctx.lineTo(x + sz * 0.4, yb - sz * 0.85); ctx.lineTo(x + sz * 0.75, yb - sz * 0.35); ctx.lineTo(x + sz * 0.6, yb); ctx.closePath(); ctx.fill(); ctx.stroke(); return sz; }
  if (B.shape === "stopper") { ctx.beginPath(); ctx.moveTo(x - sz * 0.35, yb); ctx.lineTo(x - sz * 0.5, yb - sz * 0.9); ctx.lineTo(x + sz * 0.5, yb - sz * 0.9); ctx.lineTo(x + sz * 0.35, yb); ctx.closePath(); ctx.fill(); ctx.stroke(); rr(ctx, x - sz * 0.6, yb - sz * 1.2, sz * 1.2, sz * 0.3, 3); ctx.fill(); ctx.stroke(); return sz * 1.2; }
  // gayka (olti qirrali, yon ko‘rinish)
  rr(ctx, x - sz * 0.7, yb - sz * 0.7, sz * 1.4, sz * 0.7, 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - sz * 0.23, yb - sz * 0.7); ctx.lineTo(x - sz * 0.23, yb); ctx.moveTo(x + sz * 0.23, yb - sz * 0.7); ctx.lineTo(x + sz * 0.23, yb); ctx.stroke(); return sz * 0.7;
}

function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, base = h - 14;
  const L = narrow ? { sc: [12, 150], home: 200, cyl: [292, 52] } : { sc: [50, 180], home: 330, cyl: [470, 60] };
  // stol chizig‘i
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; ctx.fillRect(0, base, w, 14);
  // tarozi
  const [sx, sw] = L.sc, panY = base - 48;
  eScale(ctx, c, sx, panY, sw, st.at === "scale" ? fmt(Math.round(mass(st.b) * 10) / 10, 1) : "0,0", "g");
  geo.scale = { x0: sx - 10, x1: sx + sw + 10, y0: panY - 90, y1: base };
  // menzurka
  const [cx, cw] = L.cyl, k = narrow ? 1.12 : 1.06;
  const C = cylinder(ctx, c, cx, base - 6, cw, { max: 250, div: 2, V: Vnow(), k });
  geo.cyl = { x0: cx - 20, x1: cx + cw + 40, y0: C.top - 10, y1: base };
  // jism
  let bx, by;
  if (st.drag) [bx, by] = st.drag;
  else if (st.at === "scale") [bx, by] = [sx + sw / 2, panY];
  else if (st.at === "cyl") [bx, by] = [cx + cw / 2, base - 8];
  else [bx, by] = [L.home, base];
  if (st.at === "cyl" && !st.drag) { ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, C.top - 30); ctx.lineTo(bx, by - 20); ctx.stroke(); }
  const bh = bodyShape(ctx, st.b, bx, by, st.at === "cyl" && !st.drag ? 0.82 : 1);
  geo.body = { x0: bx - 30, x1: bx + 30, y0: by - bh - 6, y1: by + 4 };
  label(ctx, BODIES[st.b].name, L.home, base - 70, c.text2, F(10, 700));
  if (!narrow) { label(ctx, "tarozi", sx + sw / 2, panY - 14, c.text3, F(10, 600)); label(ctx, "menzurka (250 ml)", cx + cw / 2, C.top - 22, c.text3, F(10, 600)); }
  hint(ctx, c, "jismni sudrab tarozi yoki menzurkaga qo‘ying", narrow ? 8 : 200, 20);
}

/* ------------------------------------------------------------------ Hisob */
function analyze(rows) {
  const rs = rows.map((r) => { const V = r.V2 - r.V1, rho = r.m / V, id = identify(rho); return { ...r, V, rho, id }; });
  return { rows: rs, ok: rs.length >= 2 && rs.every((r) => r.V > 0) };
}
function build(nb, res) {
  const A = res.t1.A, D = docKit();
  D.S("Ishning maqsadi");
  D.list(["Tarozi va menzurka yordamida qattiq jismlarning zichligini aniqlash.", "Zichliklar jadvalidan jism qaysi moddadan yasalganini topish."]);
  D.S("Qisqacha nazariya");
  D.p("Moddaning zichligi — birlik hajmdagi massa:");
  D.eq("\\rho = \\frac{m}{V}", 1);
  D.p("Jism massasi tarozida o‘lchanadi. Noto‘g‘ri shakldagi jism hajmini menzurka yordamida topamiz: jism suvga to‘liq botirilganda suv sathi jism hajmiga teng hajmga ko‘tariladi: $V = V_2 - V_1$. $1$ ml $= 1$ cm$^3$; $1$ g/cm$^3$ $= 1000$ kg/m$^3$.");
  D.S("Jihozlar");
  D.list(["Elektron tarozi (aniqligi $0{,}1$ g).", "Menzurka $250$ ml (bo‘linma qiymati $2$ ml), suv, ip.", "O‘rganiladigan jismlar."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Jism tarozida tortilib, massasi $m$ yozildi.", "Menzurkaga suv quyilib, uning hajmi $V_1$ yozildi.", "Jism ipga bog‘lanib suvga to‘liq botirildi va suv sathi $V_2$ yozildi.", "Zichlik hisoblanib, jadval bilan solishtirildi."], true);
  D.S("O‘lchash natijalari");
  D.table("Jismlar zichligi", ["№", "Jism", "$m$, g", "$V_1$, ml", "$V_2$, ml", "$V$, cm$^3$", "$\\rho$, g/cm$^3$", "$\\rho$, kg/m$^3$", "Modda (jadvaldan)", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), BODIES[r.b]?.name || "—", `$${fx(r.m, 1)}$`, `$${fx(r.V1, 0)}$`, `$${fx(r.V2, 0)}$`, `$${fx(r.V, 0)}$`, `$${fx(r.rho, 2)}$`, `$${fx(r.rho * 1000, 0)}$`, `${r.id.mat.name} (${fx(r.id.mat.rho, 1)})`, res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  const r0 = A.rows[0];
  D.p("**Hisoblash** (1-jism uchun):");
  D.eq(`V = V_2 - V_1 = ${fx(r0.V2, 0)} - ${fx(r0.V1, 0)} = ${fx(r0.V, 0)}\\ \\text{cm}^3,\\qquad \\rho = \\frac{m}{V} = \\frac{${fx(r0.m, 1)}\\ \\text{g}}{${fx(r0.V, 0)}\\ \\text{cm}^3} = ${fx(r0.rho, 2)}\\ \\frac{\\text{g}}{\\text{cm}^3} = ${fx(r0.rho * 1000, 0)}\\ \\frac{\\text{kg}}{\\text{m}^3}`);
  D.p("Hajmni o‘lchash xatosi $\\Delta V \\approx 1$–$2$ cm$^3$ bo‘lgani uchun kichik jismlarda nisbiy xato kattaroq bo‘ladi: $\\varepsilon_\\rho \\approx \\Delta V/V$.");
  D.S("Xulosa");
  docTail(D.X, nb, userText, A.rows.map((r) => `• ${BODIES[r.b]?.name || "Jism"}: $\\rho \\approx ${fx(r.rho, 2)}$ g/cm$^3$ — ${r.id.mat.name.toLowerCase()} ($${fx(r.id.mat.rho, 1)}$ g/cm$^3$, farq $${fx(Math.abs(pct(r.rho, r.id.mat.rho)), 0)}$ %).`), SITE);
  return { title: "Laboratoriya ishi. Qattiq jismning zichligini aniqlash", titlePlain: "Laboratoriya ishi. Zichlikni aniqlash", author: nb.f.name, sub: "Tarozi va menzurka yordamida", meta: docMeta(nb, userText), blocks: D.X };
}

const bodyOpts = Object.entries(BODIES).map(([k, v]) => [k, v.name]);
createLab({
  key: "density", fileBase: "Zichlik-lab", docLabel: "Virtual laboratoriya ishi · 7-sinf", site: SITE,
  vh: (n) => (n ? 360 : 330),
  draw,
  down(x, y) { if (inBox(x, y, geo.body)) { st.drag = [x, y + 10]; return "body"; } return null; },
  move(h, x, y) { st.drag = [x, y + 10]; },
  up(h, lab) {
    const [x, y] = st.drag; st.drag = null;
    st.at = inBox(x, y, geo.scale) ? "scale" : inBox(x, y, geo.cyl) ? "cyl" : "table";
    lab.say(st.at === "scale" ? "Jism tarozida." : st.at === "cyl" ? "Jism suvga botirildi — suv sathi ko‘tarildi." : "Jism stolda.");
  },
  cursor: (x, y) => (inBox(x, y, geo.body) ? "grab" : ""),
  tools: [{ label: "Tarozida tortish", run: () => { st.at = "scale"; } }, { label: "Menzurkaga botirish", run: () => { st.at = "cyl"; } }, { label: "Stolga olish", run: () => { st.at = "table"; } }],
  controls: [
    { type: "seg", label: "Jism", opts: bodyOpts, get: () => st.b, set: (v) => { st.b = v; st.at = "table"; } },
    { type: "range", label: "Menzurkadagi suv (quyish)", min: 80, max: 180, step: 2, get: () => st.V1, set: (v) => { st.V1 = v; if (st.at === "cyl") st.at = "table"; }, fmt: (v) => `≈ ${v} ml` },
    { type: "note", text: "Menzurka shkalasi bo‘yicha suv sathi pastki menisk bo‘yicha 1 ml aniqlikda o‘qiladi." },
  ],
  readouts() {
    return [["Tarozi", st.at === "scale" ? `${fmt(Math.round(mass(st.b) * 10) / 10, 1)}<small>g</small>` : "0,0<small>g</small>", "massa", "orange"], ["Menzurka", `${fmt(Math.round(Vnow()), 0)}<small>ml</small>`, st.at === "cyl" ? "jism suvda (V₂)" : "faqat suv (V₁)", "blue"],
      ["Jism", BODIES[st.b].name, st.at === "scale" ? "tarozida" : st.at === "cyl" ? "menzurkada" : "stolda"], ["Modda", "?", "zichlikdan aniqlang"]];
  },
  record() {
    const b = st.b;
    if (st.at === "scale") { const v = { b, m: fmt(Math.round(mass(b) * 10) / 10, 1) }; return { t: "t1", v, text: `${BODIES[b].name}: m = ${v.m} g` }; }
    if (st.at === "cyl") { const v = { b, V2: fmt(Math.round(Vnow()), 0) }; return { t: "t1", v, text: `${BODIES[b].name} suvda: V₂ = ${v.V2} ml` }; }
    const v = { b, V1: fmt(Math.round(Vnow()), 0) };
    return { t: "t1", v, text: `${BODIES[b].name} uchun suv: V₁ = ${v.V1} ml` };
  },
  explain() { return st.at === "cyl" ? `Jism suvni siqib chiqardi: sath ${fmt(Math.round(V1true()), 0)} ml dan ${fmt(Math.round(Vnow()), 0)} ml ga ko‘tarildi. Farq — jism hajmi.` : st.at === "scale" ? "Tarozi jism massasini ko‘rsatmoqda." : "Jismni tarozi yoki menzurkaga sudrab qo‘ying."; },
  steps: ["Jismni tanlang va tarozi ustiga sudrab qo‘ying — massani <b>Qaydga yozing</b>.", "Jismni stolga olib, menzurkadagi suv hajmini (V₁) yozing.", "Jismni menzurkaga botiring va suv sathini (V₂) yozing.", "Kamida 2–3 jism uchun takrorlang. Qaydlarni jadvalga o‘tkazing: V, ρ va modda avtomatik. Xulosa va PDF."],
  formulas: ["Zichlik: <span class=\"sim-math\">ρ = m / V</span>", "Hajm: <span class=\"sim-math\">V = V₂ − V₁</span>", "1 ml = 1 cm³; 1 g/cm³ = 1000 kg/m³", "Alyuminiy 2,7; po‘lat 7,8; latun 8,5; shisha 2,5; granit 2,6 g/cm³"],
  note: "Qaydlar jism nomi bilan yoziladi — jadvalda har jism alohida qatorga tushadi.",
  notebook: {
    intro: "Har qator — bitta jism: massa, suv hajmi va jism botirilgandagi hajm. Kamida 2 jism.",
    conclusionPh: "Jismlarning zichligi qancha chiqdi va ular qaysi moddalardan yasalgan?",
    hint: "Javob bering: 1) Har bir jismning zichligi qancha? 2) Ular qaysi moddadan yasalgan? 3) Qaysi o‘lchash eng katta xato beradi? 4) Suvda suzadigan jism hajmini qanday o‘lchash mumkin?",
    tables: [
      { key: "t1", okLabel: "Zichliklar", need: "kamida 2 jism", title: "Jismlarning massasi, hajmi va zichligi",
        head: ["Jism", "m, g", "V₁, ml", "V₂, ml", "V, cm³", "ρ, g/cm³", "Tekshiruv"], cols: [{ k: "b", kind: "sel", opts: bodyOpts }, { k: "m", kind: "num" }, { k: "V1", kind: "num" }, { k: "V2", kind: "num" }], outs: ["V", "rho"],
        blank: (i) => ({ b: Object.keys(BODIES)[i % 5], m: "", V1: "", V2: "" }), rows: 3, max: 10,
        parse: (r) => ({ b: r.b, m: num(r.m), V1: num(r.V1), V2: num(r.V2) }), check: (r) => (!(r.m > 0 && r.V1 > 0 && r.V2 > r.V1) ? { ok: false, err: "m > 0, V₂ > V₁" } : { ok: true }),
        analyze, out: (A, j, r) => ({ V: fmt(r.V2 - r.V1, 0), rho: fmt(r.m / (r.V2 - r.V1), 2) }),
        summary: (A) => (A.rows.length ? A.rows.slice(0, 4).map((r) => [BODIES[r.b]?.name || "Jism", `${fmt(r.rho, 2)} g/cm³`, r.id.mat.name]) : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
