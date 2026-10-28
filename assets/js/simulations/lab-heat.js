// ==========================================================================
// Laboratoriya ishi: Issiqlik miqdorlarini taqqoslash va moddaning solishtirma issiqlik sig‘imini aniqlash
// (simulations/lab-issiqlik-sigimi.html). Darslik: 9-sinf §20 va §25.
// Qurilma: kalorimetr (ichki stakani alyuminiy, 42 g), termometrlar (bo‘linma 1 °C, 0,5 °C gacha o‘qiladi),
// 1-topshiriqda — issiq suvli stakan, 2-topshiriqda — qaynayotgan suvda isitilgan metall silindr.
// Fizika: issiqlik balansi + kalorimetrdan atrofga sekin issiqlik yo‘qotilishi va termometr inersiyasi (ikki jismli model).
// ==========================================================================

import { createLab, docKit, meanErr, pct, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { SUBSTANCES } from "./heat-physics.js";
import { thermometer, label, hint, rr, F } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-issiqlik-sigimi.html", label: "oliyfizika.uz/simulations/lab-issiqlik-sigimi.html" };
const C_W = 4200, C_AL = 920, M_CUP = 42, T_ROOM = 22, T_TAP = 18.5, T_BOIL = 99, G_LOSS = 0.35, TAU_TH = 2;
// silindrlar bir xil hajmda (20 cm³); massasi tarozida o‘lchangan
const METALS = { aluminium: { m: 54 }, iron: { m: 156 }, brass: { m: 170 }, copper: { m: 178 } };
const st = { mode: "q", m1: 100, m2: 100, metal: "aluminium", mw: 120, phase: "pre", T1: 72, T2: T_TAP, Tth: T_TAP, Tth1: 72, rate: 0, t: 0 };
const geo = {};
const half = (v) => Math.round(v * 2) / 2;

function reset() {
  st.phase = "pre"; st.t = 0; st.rate = 0;
  st.T2 = T_TAP; st.Tth = T_TAP;
  st.T1 = st.mode === "q" ? 72 : T_BOIL; st.Tth1 = st.T1;
}
const C1 = () => (st.mode === "q" ? C_W * st.m1 : SUBSTANCES[st.metal].cs * METALS[st.metal].m) / 1000;
const C2 = () => (C_W * (st.mode === "q" ? st.m2 : st.mw) + C_AL * M_CUP) / 1000;
function mix() {
  if (st.phase !== "pre") return false;
  st.phase = "mix"; st.t = 0; return true;
}
function step(dt) {
  const h = 0.02, n = Math.max(1, Math.round(Math.min(dt, 0.1) / h)), c1 = C1(), c2 = C2();
  const tau = st.mode === "q" ? 2.5 : 4, K = 1 / (tau * (1 / c1 + 1 / c2));
  const prev = st.Tth;
  for (let i = 0; i < n; i++) {
    if (st.phase === "mix") {
      const P = K * (st.T1 - st.T2);
      st.T1 -= (P * h) / c1; st.T2 += ((P - G_LOSS * (st.T2 - T_ROOM)) * h) / c2;
    } else {
      st.T2 += (-(G_LOSS * 0.4) * (st.T2 - T_ROOM) * h) / c2; // yopiq kalorimetr: juda sekin isiydi
      if (st.mode === "q") st.T1 += (-0.6 * (st.T1 - T_ROOM) * h) / c1; // issiq suv stakanda soviydi
    }
    st.Tth += ((st.T2 - st.Tth) * h) / TAU_TH;
    const Tsrc = st.mode === "c" ? T_BOIL : st.phase === "pre" ? st.T1 : T_ROOM; // chap termometr: manba idishida
    st.Tth1 += ((Tsrc - st.Tth1) * h) / TAU_TH;
    st.t += h;
  }
  st.rate = (st.Tth - prev) / Math.max(1e-6, n * h);
  return true;
}

/* ------------------------------------------------------------------ Sahna */
function beaker(ctx, c, x, y, w, h, level, col) {
  ctx.fillStyle = col; ctx.fillRect(x + 2, y + h - level, w - 4, level - 2);
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#64748b"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y); ctx.stroke();
}
const waterCol = (T, a = 0.45) => { const f = Math.max(0, Math.min(1, (T - 15) / 80)); return `rgba(${Math.round(59 + 180 * f)},${Math.round(130 - 60 * f)},${Math.round(246 - 180 * f)},${a})`; };
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S;
  const L = narrow ? { src: 14, cal: 200, card: [14, 8], thH: 180, top: 104 } : { src: 40, cal: 280, card: [470, 18], thH: 236, top: 40 };
  const base = h - 14;
  // manba: issiq suv yoki qaynayotgan suvdagi silindr
  const bx = L.src, bw = narrow ? 120 : 130, bh = 110, by = base - bh;
  if (st.mode === "q") {
    if (st.phase === "pre") { beaker(ctx, c, bx, by, bw, bh, 20 + st.m1 * 0.55, waterCol(st.T1)); label(ctx, `issiq suv · ${st.m1} g`, bx, by - 12, c.text2, F(10, 700), "left"); }
    else { beaker(ctx, c, bx, by, bw, bh, 4, waterCol(st.T1, 0.2)); label(ctx, "bo‘sh stakan", bx, by - 12, c.text3, F(10, 600), "left"); }
  } else {
    ctx.fillStyle = c.dark ? "#475569" : "#64748b"; rr(ctx, bx - 8, base - 6, bw + 16, 14, 4); ctx.fill();
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 7; i++) { ctx.moveTo(bx + 8 + i * 17, base - 3); ctx.lineTo(bx + 16 + i * 17, base - 3); } ctx.stroke();
    beaker(ctx, c, bx, by - 8, bw, bh, 88, waterCol(95, 0.4));
    ctx.fillStyle = "rgba(255,255,255,0.7)"; for (let i = 0; i < 9; i++) { const yy = base - 20 - ((st.t * 30 + i * 37) % 80); ctx.beginPath(); ctx.arc(bx + 12 + ((i * 29) % (bw - 24)), yy, 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
    label(ctx, "qaynayotgan suv", bx, by - 22, c.text2, F(10, 700), "left");
    if (st.phase === "pre") { const mx = bx + bw * 0.36; ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, by - 40); ctx.lineTo(mx, base - 70); ctx.stroke(); metalBody(ctx, mx, base - 70); }
  }
  geo.src = { x0: bx - 6, x1: bx + bw + 6, y0: by - 40, y1: base };
  const th1 = thermometer(ctx, c, bx + bw - 34, L.top, L.thH, { min: 0, max: 100, major: 10, minor: 1, t: st.Tth1, col: "#dc2626" });
  // kalorimetr
  const kx = L.cal, kw = narrow ? 150 : 170, kh = 150, ky = base - kh;
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; rr(ctx, kx - 10, ky - 6, kw + 20, kh + 10, 10); ctx.fill();
  ctx.fillStyle = c.dark ? "#1e293b" : "#f1f5f9"; ctx.fillRect(kx, ky, kw, kh - 6);
  const water = st.mode === "q" ? st.m2 + (st.phase === "mix" ? st.m1 : 0) : st.mw;
  const lev = 18 + water * 0.42;
  ctx.fillStyle = waterCol(st.T2); ctx.fillRect(kx + 8, base - 10 - lev, kw - 16, lev);
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2; ctx.strokeRect(kx + 8, ky + 10, kw - 16, kh - 20); // alyuminiy stakan
  if (st.mode === "c" && st.phase === "mix") metalBody(ctx, kx + kw * 0.36, base - 46);
  label(ctx, "kalorimetr", kx, ky - 14, c.text2, F(10, 700), "left");
  thermometer(ctx, c, kx + kw - 46, L.top, L.thH, { min: 0, max: 100, major: 10, minor: 1, t: st.Tth, col: "#dc2626" });
  // massalar kartasi
  const [cx, cy] = L.card;
  {
    const lines = st.mode === "q" ? [`issiq suv: m₁ = ${st.m1} g`, `sovuq suv: m₂ = ${st.m2} g`, `ichki stakan (Al): ${M_CUP} g`] : [`silindr (${SUBSTANCES[st.metal].short}): ${METALS[st.metal].m} g`, `kalorimetrda suv: ${st.mw} g`, `ichki stakan (Al): ${M_CUP} g`];
    const cw = narrow ? 170 : 190, cx2 = narrow ? w - cw - 10 : cx;
    ctx.fillStyle = c.dark ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.92)"; rr(ctx, cx2, cy, cw, 26 + lines.length * 17, 8); ctx.fill(); ctx.strokeStyle = c.dark ? "#475569" : "#cbd5e1"; ctx.lineWidth = 1; ctx.stroke();
    label(ctx, "Tarozida o‘lchangan", cx2 + 10, cy + 12, c.text3, F(9, 700), "left");
    lines.forEach((t, i) => label(ctx, t, cx2 + 10, cy + 30 + i * 17, c.text, F(10.5, 600), "left"));
  }
  if (st.phase === "pre") hint(ctx, c, st.mode === "q" ? "stakanni bosing — kalorimetrga quyish" : "silindrni bosing — kalorimetrga tushirish", bx, narrow ? h - 4 - 140 : 18);
  else if (Math.abs(st.rate) > 0.02) hint(ctx, c, "temperatura o‘zgarmoqda…", kx, ky - 34);
}
function metalBody(ctx, x, y) {
  const col = SUBSTANCES[st.metal].color;
  const g = ctx.createLinearGradient(x - 12, 0, x + 12, 0); g.addColorStop(0, col); g.addColorStop(0.5, "#f8fafc"); g.addColorStop(1, col);
  ctx.fillStyle = g; rr(ctx, x - 12, y, 24, 40, 3); ctx.fill(); ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.stroke();
}

/* ------------------------------------------------------------------ Hisob */
function anQ(rows) {
  const rs = rows.map((r) => { const Q1 = C_W * (r.m1 / 1000) * (r.t1 - r.th), Q2 = C_W * (r.m2 / 1000) * (r.th - r.t2), Qk = C_AL * (M_CUP / 1000) * (r.th - r.t2); return { ...r, Q1, Q2, Qk, k: Q2 / Q1, k2: (Q2 + Qk) / Q1 }; });
  return { rows: rs, k: meanErr(rs.map((r) => r.k)), k2: meanErr(rs.map((r) => r.k2)), ok: rs.length >= 2 };
}
const cOf = (r) => ((C_W * r.mw + C_AL * M_CUP) * (r.th - r.tw)) / (r.mx * (r.tx - r.th));
function anC(rows, cond) {
  const rs = rows.map((r) => ({ ...r, c: cOf(r) })), m = meanErr(rs.map((r) => r.c));
  const metals = Object.keys(METALS).map((k) => [k, SUBSTANCES[k].cs]), best = metals.reduce((p, q) => (Math.abs(q[1] - m.m) < Math.abs(p[1] - m.m) ? q : p));
  return { rows: rs, m, best: best[0], metal: cond?.metal, ok: rs.length >= 1 && Number.isFinite(m.m) };
}
function build(nb, res) {
  const A = res.t1?.ok ? res.t1.A : null, B = res.t2?.ok ? res.t2.A : null, D = docKit(), box = [];
  D.S("Ishning maqsadi");
  D.list(["Turli temperaturali suvlar aralashtirilganda issiq suv bergan va sovuq suv olgan issiqlik miqdorlarini taqqoslash.", "Kalorimetr yordamida metallning solishtirma issiqlik sig‘imini aniqlash."]);
  D.S("Qisqacha nazariya");
  D.p("Jismni $\\Delta t$ ga isitish uchun kerak bo‘lgan issiqlik miqdori $Q = cm\\Delta t$. Issiqlik almashinuvida (atrofga yo‘qotish bo‘lmasa) issiq jism bergan issiqlik sovuq jismlar olgan issiqlikka teng — issiqlik balansi tenglamasi:");
  D.eq("c_{\\text{s}} m_1 (t_1 - \\theta) = c_{\\text{s}} m_2 (\\theta - t_2) + c_{\\text{k}} m_{\\text{k}} (\\theta - t_2)", 1);
  D.p("Metall silindr ($m_x$, $t_x$) kalorimetrdagi suvga ($m_{\\text{s}}$, $t$) tushirilganda (1) dan:");
  D.eq("c_x = \\frac{(c_{\\text{s}} m_{\\text{s}} + c_{\\text{k}} m_{\\text{k}})(\\theta - t)}{m_x (t_x - \\theta)}", 2);
  D.p(`Bu yerda $c_{\\text{s}} = 4200$ J/(kg·°C) — suvning, $c_{\\text{k}} = 920$ J/(kg·°C) va $m_{\\text{k}} = ${M_CUP}$ g — kalorimetr ichki (alyuminiy) stakanining solishtirma issiqlik sig‘imi va massasi.`);
  D.S("Jihozlar");
  D.list(["Kalorimetr (ichki stakani alyuminiy), ikkita termometr (bo‘linma qiymati $1$ °C).", "Tarozi, menzurka, issiq va sovuq suv; metall silindrlar, elektr plita va suv qaynatiladigan idish."]);
  if (A) {
    D.S("Issiqlik miqdorlarini taqqoslash");
    D.list(["Kalorimetrga $m_2$ sovuq suv quyilib, uning temperaturasi $t_2$ o‘lchandi; stakandagi issiq suvning massasi $m_1$ va temperaturasi $t_1$ o‘lchandi.", "Issiq suv kalorimetrga quyilib aralashtirildi; termometr ko‘rsatkichi barqarorlashgach, aralashma temperaturasi $\\theta$ yozildi."], true);
    D.table("Issiq va sovuq suvni aralashtirish", ["№", "$m_1$, g", "$t_1$, °C", "$m_2$, g", "$t_2$, °C", "$\\theta$, °C", "$Q_1$, J", "$Q_2$, J", "$Q_2/Q_1$", "Tekshiruv"],
      A.rows.map((r, i) => [String(i + 1), `$${fx(r.m1, 0)}$`, `$${fx(r.t1, 1)}$`, `$${fx(r.m2, 0)}$`, `$${fx(r.t2, 1)}$`, `$${fx(r.th, 1)}$`, `$${fx(r.Q1, 0)}$`, `$${fx(r.Q2, 0)}$`, `$${fx(r.k, 2)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
      "$Q_1 = c_{\\text{s}}m_1(t_1 - \\theta)$ — issiq suv bergan, $Q_2 = c_{\\text{s}}m_2(\\theta - t_2)$ — sovuq suv olgan issiqlik.");
    const r0 = A.rows[0];
    D.eq([`Q_1 = 4200 \\cdot ${fx(r0.m1 / 1000, 3)} \\cdot (${fx(r0.t1, 1)} - ${fx(r0.th, 1)}) = ${fx(r0.Q1, 0)}\\ \\text{J},\\qquad Q_2 = 4200 \\cdot ${fx(r0.m2 / 1000, 3)} \\cdot (${fx(r0.th, 1)} - ${fx(r0.t2, 1)}) = ${fx(r0.Q2, 0)}\\ \\text{J}`,
      `\\text{kalorimetr stakani olgan: } Q_{\\text{k}} = 920 \\cdot ${fx(M_CUP / 1000, 3)} \\cdot (${fx(r0.th, 1)} - ${fx(r0.t2, 1)}) = ${fx(r0.Qk, 0)}\\ \\text{J};\\qquad \\frac{Q_2 + Q_{\\text{k}}}{Q_1} = ${fx(r0.k2, 2)}`]);
    box.push(`• Sovuq suv olgan issiqlik issiq suv berganidan bir oz kam ($Q_2/Q_1 \\approx ${fx(A.k.m, 2)}$); kalorimetr stakanini hisobga olsak, $(Q_2 + Q_{\\text{k}})/Q_1 \\approx ${fx(A.k2.m, 2)}$ — qolgan farq atrofga yo‘qotilgan issiqlik.`);
  }
  if (B) {
    const M = SUBSTANCES[B.best];
    D.S("Metallning solishtirma issiqlik sig‘imi");
    D.list(["Metall silindr massasi $m_x$ tarozida o‘lchandi va u qaynayotgan suvda isitildi ($t_x$ — qaynayotgan suv temperaturasi).", "Kalorimetrga $m_{\\text{s}}$ suv quyilib, temperaturasi $t$ o‘lchandi; silindr tezda kalorimetrga o‘tkazildi va eng yuqori barqaror temperatura $\\theta$ yozildi."], true);
    D.table("Silindrni kalorimetrga tushirish", ["№", "$m_x$, g", "$t_x$, °C", "$m_{\\text{s}}$, g", "$t$, °C", "$\\theta$, °C", "$c_x$, J/(kg·°C)", "Tekshiruv"],
      B.rows.map((r, i) => [String(i + 1), `$${fx(r.mx, 0)}$`, `$${fx(r.tx, 1)}$`, `$${fx(r.mw, 0)}$`, `$${fx(r.tw, 1)}$`, `$${fx(r.th, 1)}$`, `$${fx(r.c, 0)}$`, res.t2.flags[i] ? "$\\checkmark$" : "--"]));
    const r0 = B.rows[0];
    D.eq(`c_x = \\frac{(4200 \\cdot ${fx(r0.mw / 1000, 3)} + 920 \\cdot ${fx(M_CUP / 1000, 3)})(${fx(r0.th, 1)} - ${fx(r0.tw, 1)})}{${fx(r0.mx / 1000, 3)} \\cdot (${fx(r0.tx, 1)} - ${fx(r0.th, 1)})} = ${fx(r0.c, 0)}\\ \\frac{\\text{J}}{\\text{kg}\\cdot{}^\\circ\\text{C}}`);
    box.push(`• Silindr moddasining solishtirma issiqlik sig‘imi $c_x \\approx ${fx(B.m.m, 0)}$ J/(kg·°C); jadvaldagi eng yaqin qiymat — ${M.short.toLowerCase()} ($${M.cs}$ J/(kg·°C), farq $${fx(Math.abs(pct(B.m.m, M.cs)), 1)}$ %).`);
  }
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Issiqlik miqdorlarini taqqoslash va solishtirma issiqlik sig‘imini aniqlash", titlePlain: "Laboratoriya ishi. Solishtirma issiqlik sig‘imi", author: nb.f.name, sub: "Kalorimetr bilan ishlash", meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "heat", fileBase: "Issiqlik-sigimi-lab", docLabel: "Virtual laboratoriya ishi · 9-sinf", site: SITE,
  modes: [{ id: "q", label: "1. Issiq va sovuq suv", hint: "Issiq suvni sovuq suvli kalorimetrga quying" }, { id: "c", label: "2. Metall silindr", hint: "Qaynoq suvda isitilgan silindrni kalorimetrga tushiring" }],
  onMode(m) { st.mode = m; reset(); },
  vh: (n) => (n ? 380 : 330),
  draw, step,
  down(x, y, lab) {
    const s = geo.src;
    if (s && x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1 && mix()) { lab.say(st.mode === "q" ? "Issiq suv kalorimetrga quyildi — termometr ko‘rsatkichi barqarorlashishini kuting." : "Silindr kalorimetrga tushirildi — eng yuqori barqaror temperaturani kuting."); return true; }
    return null;
  },
  cursor: (x, y) => { const s = geo.src; return s && st.phase === "pre" && x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1 ? "pointer" : ""; },
  tools: [{ label: "Quyish / tushirish", run: (lab) => { if (mix()) lab.say("Aralashtirildi — termometrni kuzating."); } }, { label: "Yangi tajriba", run: (lab) => { reset(); lab.say("Yangi tajriba: kalorimetrda yangi sovuq suv."); } }],
  controls: [
    { type: "range", label: "Issiq suv massasi m₁", min: 50, max: 150, step: 10, get: () => st.m1, set: (v) => { st.m1 = v; reset(); }, fmt: (v) => `${v} g`, only: "q" },
    { type: "range", label: "Sovuq suv massasi m₂", min: 50, max: 150, step: 10, get: () => st.m2, set: (v) => { st.m2 = v; reset(); }, fmt: (v) => `${v} g`, only: "q" },
    { type: "seg", label: "Silindr", opts: Object.keys(METALS).map((k) => [k, SUBSTANCES[k].short]), get: () => st.metal, set: (v) => { st.metal = v; reset(); }, only: "c" },
    { type: "range", label: "Kalorimetrdagi suv", min: 60, max: 150, step: 10, get: () => st.mw, set: (v) => { st.mw = v; reset(); }, fmt: (v) => `${v} g`, only: "c" },
    { type: "note", text: "Avval boshlang‘ich temperaturalarni qaydga yozing, so‘ng aralashtiring va termometr barqarorlashgach θ ni yozing." },
  ],
  readouts() {
    return [[st.mode === "q" ? "Issiq suv <i>t₁</i>" : "Qaynoq suv <i>t<sub>x</sub></i>", `${fmt(half(st.Tth1), 1)}<small>°C</small>`, "chap termometr", "orange"], ["Kalorimetr", `${fmt(half(st.Tth), 1)}<small>°C</small>`, st.phase === "pre" ? "sovuq suv t₂" : "aralashma θ", "blue"],
      ["O‘zgarish tezligi", `${fmt(st.rate * 60, 1)}<small>°C/min</small>`, Math.abs(st.rate) > 0.02 ? "hali barqaror emas" : "barqaror"], ["Holat", st.phase === "pre" ? "aralashtirilmagan" : "aralashtirildi", `${fmt(st.t, 0)} s`]];
  },
  record(lab) {
    if (st.phase === "pre") {
      if (st.mode === "q") { const v = { m1: String(st.m1), t1: fmt(half(st.Tth1), 1), m2: String(st.m2), t2: fmt(half(st.Tth), 1) }; return { t: "t1", v, text: `m₁ = ${v.m1} g, t₁ = ${v.t1} °C; m₂ = ${v.m2} g, t₂ = ${v.t2} °C` }; }
      const v = { mx: String(METALS[st.metal].m), tx: fmt(half(st.Tth1), 1), mw: String(st.mw), tw: fmt(half(st.Tth), 1) };
      return { t: "t2", v, text: `${SUBSTANCES[st.metal].short}: mₓ = ${v.mx} g, tₓ = ${v.tx} °C; suv ${v.mw} g, t = ${v.tw} °C` };
    }
    if (Math.abs(st.rate) > 0.02) return { err: "Termometr ko‘rsatkichi hali o‘zgarmoqda — barqarorlashishini kuting." };
    const v = { th: fmt(half(st.Tth), 1) };
    return { t: st.mode === "q" ? "t1" : "t2", v, text: `aralashma: θ = ${v.th} °C` };
  },
  explain() { return st.phase === "pre" ? (st.mode === "q" ? "Issiq va sovuq suvning massasi hamda temperaturasini yozib oling, so‘ng issiq suvni kalorimetrga quying." : "Silindr qaynayotgan suvda — uning temperaturasi suvnikiga teng. Kalorimetrdagi suv temperaturasini yozib, silindrni tushiring.") : Math.abs(st.rate) > 0.02 ? "Issiqlik almashinuvi davom etmoqda: issiq jism soviyapti, kalorimetrdagi suv isiyapti." : "Issiqlik muvozanati qaror topdi. Endi temperatura atrofga issiqlik berilishi hisobiga juda sekin pasayadi."; },
  steps: ["1-topshiriq: issiq va sovuq suv massalarini tanlang. Ikkala termometr ko‘rsatkichini <b>Qaydga yozing</b>.", "Stakanni bosib issiq suvni kalorimetrga quying. Termometr barqarorlashgach θ ni yozing. «Yangi tajriba» bilan boshqa massalarda takrorlang.", "2-topshiriq: silindrni tanlang, boshlang‘ich holatni yozing, silindrni kalorimetrga tushiring va θ ni yozing.", "Qaydlarni jadvallarga o‘tkazing: Q₁, Q₂ va cₓ avtomatik. Xulosa va PDF."],
  formulas: ["Issiqlik miqdori: <span class=\"sim-math\">Q = cmΔt</span>", "Issiqlik balansi: <span class=\"sim-math\">Q<sub>berilgan</sub> = Q<sub>olingan</sub></span>", "<span class=\"sim-math\">cₓ = (c<sub>s</sub>m<sub>s</sub> + c<sub>k</sub>m<sub>k</sub>)(θ − t) / (mₓ(tₓ − θ))</span>", "Suv: 4200, alyuminiy: 920, mis: 400, temir: 460 J/(kg·°C)"],
  note: "Toshkentda (dengiz sathidan ≈ 450 m) suv ≈ 99 °C da qaynaydi.",
  notebook: {
    intro: "1-jadval — issiq va sovuq suvni aralashtirish (kamida 2 tajriba). 2-jadval sharti — silindr moddasi. Bitta topshiriq yetarli, ikkalasi — to‘liq ish.",
    conclusionPh: "Q₁ va Q₂ teng chiqdimi? Farq nimadan? Silindrning solishtirma issiqlik sig‘imi qancha va u qaysi moddaga mos?",
    hint: "Javob bering: 1) Issiq suv bergan va sovuq suv olgan issiqlik tengmi? 2) Farqning sabablari? 3) cₓ qancha va u qaysi metallga mos? 4) Nega silindrni tez o‘tkazish kerak?",
    minTables: 1,
    tables: [
      { key: "t1", okLabel: "Q₁ va Q₂", need: "1-jadvalda kamida 2 tajriba", title: "1-topshiriq. Issiq va sovuq suvni aralashtirish",
        head: ["m₁, g", "t₁, °C", "m₂, g", "t₂, °C", "θ, °C", "Q₁, J", "Q₂, J", "Tekshiruv"], cols: [{ k: "m1", kind: "num" }, { k: "t1", kind: "num" }, { k: "m2", kind: "num" }, { k: "t2", kind: "num" }, { k: "th", kind: "num" }], outs: ["Q1", "Q2"],
        blank: () => ({ m1: "", t1: "", m2: "", t2: "", th: "" }), rows: 2, max: 8,
        parse: (r) => ({ m1: num(r.m1), t1: num(r.t1), m2: num(r.m2), t2: num(r.t2), th: num(r.th) }),
        check: (r) => (!(r.m1 > 0 && r.m2 > 0) ? { ok: false, err: "m > 0" } : !(r.t1 > r.th && r.th > r.t2) ? { ok: false, err: "t₂ < θ < t₁ bo‘lishi kerak" } : { ok: true }),
        analyze: anQ, out: (A, j, r) => ({ Q1: fmt(C_W * (r.m1 / 1000) * (r.t1 - r.th), 0), Q2: fmt(C_W * (r.m2 / 1000) * (r.th - r.t2), 0) }),
        summary: (A) => (A.rows.length ? [["Q₂ / Q₁", fmt(A.k.m, 2), "sovuq suv olgan / issiq suv bergan"], ["(Q₂ + Q<sub>k</sub>) / Q₁", fmt(A.k2.m, 2), "kalorimetr stakani bilan"]] : null),
        ok: (A) => A.ok },
      { key: "t2", okLabel: "cₓ", need: "2-jadvalda kamida 1 tajriba", title: "2-topshiriq. Metallning solishtirma issiqlik sig‘imi",
        cond: { fields: [{ k: "metal", label: "Silindr", opts: Object.keys(METALS).map((k) => [k, SUBSTANCES[k].short]) }], sync: () => ({ metal: st.metal }), init: { metal: "aluminium" } },
        head: ["mₓ, g", "tₓ, °C", "m<sub>s</sub>, g", "t, °C", "θ, °C", "cₓ, J/(kg·°C)", "Tekshiruv"], cols: [{ k: "mx", kind: "num" }, { k: "tx", kind: "num" }, { k: "mw", kind: "num" }, { k: "tw", kind: "num" }, { k: "th", kind: "num" }], outs: ["c"],
        blank: () => ({ mx: "", tx: "", mw: "", tw: "", th: "" }), rows: 2, max: 8,
        parse: (r) => ({ mx: num(r.mx), tx: num(r.tx), mw: num(r.mw), tw: num(r.tw), th: num(r.th) }),
        check: (r) => (!(r.mx > 0 && r.mw > 0) ? { ok: false, err: "m > 0" } : !(r.tx > r.th && r.th > r.tw) ? { ok: false, err: "t < θ < tₓ bo‘lishi kerak" } : { ok: true }),
        analyze: anC, out: (A, j, r) => ({ c: fmt(cOf(r), 0) }),
        summary: (A) => (A.rows.length ? [["cₓ", `${fmt(A.m.m, 0)} J/(kg·°C)`, A.rows.length > 1 ? `± ${fmt(Math.max(A.m.s, 0.5), 0)}` : ""], ["Eng yaqin modda", SUBSTANCES[A.best].short, `${SUBSTANCES[A.best].cs} J/(kg·°C)`]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
reset();
