// ==========================================================================
// Laboratoriya ishi: Havoning nisbiy namligini aniqlash (simulations/lab-namlik.html). Darslik: 9-sinf §42.
// 1-topshiriq — psixrometr (quruq va ho‘l termometr, psixrometrik jadval). 2-topshiriq — kondensatsion gigrometr:
// sayqallangan idishdagi efir puflab sovitiladi, sirtda shudring paydo bo‘lgan temperatura — shudring nuqtasi.
// Fizika: humidity-physics.js (to‘yingan bug‘ bosimi va zichligi, ho‘l termometr temperaturasi, shudring nuqtasi).
// ==========================================================================

import { createLab, docKit, meanErr, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { wetBulb, phiFromPsy, psyTable, rhoSat, dewPoint, pSat } from "./humidity-physics.js";
import { thermometer, label, hint, rr, F, inBox } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-namlik.html", label: "oliyfizika.uz/simulations/lab-namlik.html" };
const ROOMS = {
  cls: { name: "Sinf xonasi", t: 22.0, phi: 0.48 },
  kitchen: { name: "Oshxona (choy qaynayapti)", t: 25.5, phi: 0.74 },
  winter: { name: "Qishda isitilgan xona", t: 23.5, phi: 0.27 },
  out: { name: "Ko‘cha (kuz kuni)", t: 14.0, phi: 0.66 },
};
const st = { room: "cls", Td: 22, Tw: 22, Tc: 22, pump: false, time: 0 };
const geo = {};
const half = (v) => Math.round(v * 2) / 2;
const R = () => ROOMS[st.room];
const tw0 = () => wetBulb(R().t, R().phi), td0 = () => dewPoint(R().phi * pSat(R().t));

function step(dt) {
  const h = Math.min(dt, 0.1), r = R();
  st.Td += ((r.t - st.Td) * h) / 3;
  st.Tw += ((tw0() - st.Tw) * h) / 5;
  if (st.pump) st.Tc -= 0.45 * h; else st.Tc += ((r.t - st.Tc) * h) / 40;
  st.time += h;
  return true;
}
const dew = () => Math.max(0, Math.min(1, (td0() - st.Tc) / 1.2 + 0.15)) * (st.Tc <= td0() ? 1 : 0);

/* ------------------------------------------------------------------ Sahna */
function draw(ctx, S, lab) {
  const { w, h, colors: c, narrow } = S, base = h - 14;
  const tTop = 26, tH = h - 70;
  const thOpts = (t) => ({ min: 0, max: 40, major: 5, minor: 1, t, col: "#dc2626" });
  if (lab.mode === "p") {
    const x0 = narrow ? 40 : 120, gap = narrow ? 110 : 140;
    ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; rr(ctx, x0 - 40, tTop - 12, gap + 80, tH + 40, 10); ctx.fill();
    thermometer(ctx, c, x0, tTop, tH, thOpts(st.Td));
    const W = thermometer(ctx, c, x0 + gap, tTop, tH, thOpts(st.Tw));
    // fitil va suv idishi
    ctx.fillStyle = "rgba(59,130,246,0.35)"; ctx.fillRect(W.bulb[0] - 24, base - 22, 30, 18); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.strokeRect(W.bulb[0] - 24, base - 22, 30, 18);
    ctx.strokeStyle = "#e7e5e4"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W.bulb[0], W.bulb[1]); ctx.quadraticCurveTo(W.bulb[0] - 4, base - 30, W.bulb[0] - 10, base - 10); ctx.stroke();
    label(ctx, "quruq", x0, tTop + tH + 12, c.text2, F(10, 700)); label(ctx, "ho‘l", x0 + gap + 18, tTop + tH + 12, c.text2, F(10, 700));
  } else {
    const xr = narrow ? 40 : 110, cx = narrow ? 220 : 340;
    thermometer(ctx, c, xr, tTop, tH, thOpts(st.Td));
    label(ctx, "xona havosi", xr, tTop + tH + 12, c.text2, F(10, 700));
    // sayqallangan idish
    const cw = narrow ? 90 : 110, cy = base - 130, d = dew();
    const g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0); g.addColorStop(0, "#94a3b8"); g.addColorStop(0.35, "#f8fafc"); g.addColorStop(0.6, "#cbd5e1"); g.addColorStop(1, "#64748b");
    ctx.fillStyle = g; rr(ctx, cx - cw / 2, cy, cw, 124, 6); ctx.fill();
    if (d > 0) { ctx.fillStyle = `rgba(241,245,249,${0.25 + 0.6 * d})`; rr(ctx, cx - cw / 2, cy + 30, cw, 94, 6); ctx.fill(); ctx.fillStyle = `rgba(148,163,184,${0.6 * d})`; for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(cx - cw / 2 + 8 + ((i * 37) % (cw - 16)), cy + 40 + ((i * 53) % 76), 1.5 + (i % 3) * 0.6, 0, Math.PI * 2); ctx.fill(); } }
    label(ctx, d > 0 ? "shudring!" : "sayqallangan idish (efir)", cx, cy + 140, d > 0 ? "#2563eb" : c.text2, F(10, 700));
    thermometer(ctx, c, cx + 6, tTop, tH - 40, { min: -5, max: 35, major: 5, minor: 1, t: st.Tc, col: "#dc2626" });
    // nok (havo puflagich)
    const px = cx + cw / 2 + (narrow ? 44 : 70), py = cy + 40;
    ctx.strokeStyle = c.text3; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + cw / 2 - 10, cy + 100); ctx.quadraticCurveTo(px - 20, cy + 110, px - 14, py + 10); ctx.stroke();
    ctx.fillStyle = st.pump ? "#b91c1c" : "#dc2626"; ctx.beginPath(); ctx.ellipse(px, py, st.pump ? 16 : 20, st.pump ? 22 : 26, 0, 0, Math.PI * 2); ctx.fill();
    geo.pump = { x0: px - 26, x1: px + 26, y0: py - 32, y1: py + 32 };
    hint(ctx, c, "nokni bosib turing — havo puflanadi", narrow ? 120 : px - 60, py - 46);
  }
  // xona kartasi
  const ix = narrow ? w - 150 : w - 200, iw = narrow ? 140 : 186;
  ctx.fillStyle = c.dark ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.92)"; rr(ctx, ix, 14, iw, 46, 8); ctx.fill(); ctx.strokeStyle = c.dark ? "#475569" : "#cbd5e1"; ctx.lineWidth = 1; ctx.stroke();
  label(ctx, "Joy", ix + 10, 26, c.text3, F(9, 700), "left"); label(ctx, R().name, ix + 10, 44, c.text, F(narrow ? 9.5 : 11, 700), "left");
}

/* ------------------------------------------------------------------ Hisob */
function anP(rows) {
  const rs = rows.map((r) => { const phi = phiFromPsy(r.t, r.tw) * 100, rho = (phi / 100) * rhoSat(r.t); return { ...r, dt: r.t - r.tw, phi, rho, td: dewPoint((phi / 100) * pSat(r.t)) }; });
  return { rows: rs, m: meanErr(rs.map((r) => r.phi)), ok: rs.length >= 1 };
}
function anD(rows) {
  const rs = rows.map((r) => { const rd = rhoSat(r.td), rt = rhoSat(r.t); return { ...r, rd, rt, phi: (rd / rt) * 100 }; });
  return { rows: rs, m: meanErr(rs.map((r) => r.phi)), ok: rs.length >= 1 };
}
function build(nb, res) {
  const A = res.t1?.ok ? res.t1.A : null, B = res.t2?.ok ? res.t2.A : null, Rm = ROOMS[(res.t1?.cond || res.t2?.cond || {}).room] || ROOMS.cls, D = docKit(), box = [];
  D.S("Ishning maqsadi");
  D.list(["Havoning nisbiy namligini psixrometr yordamida aniqlash.", "Shudring nuqtasini kondensatsion gigrometr bilan o‘lchab, nisbiy namlikni hisoblash va natijalarni solishtirish."]);
  D.S("Qisqacha nazariya");
  D.p("Havoning nisbiy namligi — havodagi suv bug‘i zichligi $\\rho$ (yoki bosimi $p$) ning shu temperaturadagi to‘yingan bug‘ zichligi $\\rho_0$ ga nisbati:");
  D.eq("\\varphi = \\frac{\\rho}{\\rho_0}\\cdot 100\\,\\% = \\frac{p}{p_0}\\cdot 100\\,\\%", 1);
  D.p("Psixrometrda ho‘l termometr idishidan suv bug‘lanadi va u soviydi; havo qancha quruq bo‘lsa, quruq va ho‘l termometrlar ko‘rsatkichlari farqi $\\Delta t = t - t_{\\text{h}}$ shuncha katta. $\\varphi$ psixrometrik jadvaldan topiladi. Havo sovitilganda undagi bug‘ to‘yinadigan temperatura — shudring nuqtasi $t_{\\text{sh}}$; bunda $\\rho = \\rho_0(t_{\\text{sh}})$, demak:");
  D.eq("\\varphi = \\frac{\\rho_0(t_{\\text{sh}})}{\\rho_0(t)}\\cdot 100\\,\\%", 2);
  D.S("Jihozlar");
  D.list(["Psixrometr (ikkita termometr, bo‘linma qiymati $1$ °C), psixrometrik jadval.", "Kondensatsion gigrometr: sayqallangan idish, efir, havo puflagich (nok), termometr.", `Tajriba joyi: ${Rm.name.toLowerCase()}.`]);
  if (A) {
    D.S("Psixrometr bilan o‘lchash");
    D.table("Psixrometr ko‘rsatkichlari", ["№", "$t$, °C", "$t_{\\text{h}}$, °C", "$\\Delta t$, °C", "$\\varphi$, %", "$\\rho$, g/m$^3$", "Tekshiruv"],
      A.rows.map((r, i) => [String(i + 1), `$${fx(r.t, 1)}$`, `$${fx(r.tw, 1)}$`, `$${fx(r.dt, 1)}$`, `$${fx(r.phi, 0)}$`, `$${fx(r.rho, 1)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]),
      "$\\varphi$ — psixrometrik jadvaldan (oraliq qiymatlar interpolyatsiya qilingan), $\\rho = \\varphi\\rho_0(t)$.");
    box.push(`• Psixrometr bo‘yicha nisbiy namlik $\\varphi \\approx ${fx(A.m.m, 0)}$ %, havodagi bug‘ zichligi $\\rho \\approx ${fx(A.rows[0].rho, 1)}$ g/m$^3$.`);
  }
  if (B) {
    D.S("Shudring nuqtasi bo‘yicha");
    D.table("Kondensatsion gigrometr", ["№", "$t$, °C", "$t_{\\text{sh}}$, °C", "$\\rho_0(t_{\\text{sh}})$, g/m$^3$", "$\\rho_0(t)$, g/m$^3$", "$\\varphi$, %", "Tekshiruv"],
      B.rows.map((r, i) => [String(i + 1), `$${fx(r.t, 1)}$`, `$${fx(r.td, 1)}$`, `$${fx(r.rd, 1)}$`, `$${fx(r.rt, 1)}$`, `$${fx(r.phi, 0)}$`, res.t2.flags[i] ? "$\\checkmark$" : "--"]),
      "To‘yingan bug‘ zichligi $\\rho_0$ — jadvaldan.");
    const r0 = B.rows[0];
    D.eq(`\\varphi = \\frac{${fx(r0.rd, 1)}}{${fx(r0.rt, 1)}}\\cdot 100\\,\\% = ${fx(r0.phi, 0)}\\,\\%`);
    box.push(`• Shudring nuqtasi $t_{\\text{sh}} \\approx ${fx(r0.td, 1)}$ °C; undan $\\varphi \\approx ${fx(B.m.m, 0)}$ %.`);
  }
  if (A && B) box.push(`• Ikki usul natijalari ${Math.abs(A.m.m - B.m.m) <= 6 ? "yaxshi mos keladi" : "biroz farq qiladi"} (farq $${fx(Math.abs(A.m.m - B.m.m), 0)}$ %); shudringni biroz kech payqash $t_{\\text{sh}}$ ni pasaytiradi.`);
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Havoning nisbiy namligini aniqlash", titlePlain: "Laboratoriya ishi. Havo namligi", author: nb.f.name, sub: Rm.name, meta: docMeta(nb, userText), blocks: D.X };
}

// psixrometrik jadval (sahifada ko‘rsatiladi): t = 10…30 °C, Δt = 0…10 °C
const PT = (() => {
  const ts = Array.from({ length: 11 }, (_, i) => 10 + 2 * i), dts = Array.from({ length: 11 }, (_, i) => i), tab = psyTable(ts, dts);
  return `<details class="lab-psy"><summary>Psixrometrik jadval (φ, %)</summary><div class="lab-table-wrap"><table class="lab-table"><thead><tr><th>t, °C \\ Δt</th>${dts.map((d) => `<th>${d}</th>`).join("")}</tr></thead><tbody>${ts.map((t, i) => `<tr><th>${t}</th>${tab[i].map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="of-subtle">Oraliq qiymatlar interpolyatsiya qilinadi.</p></details>`;
})();

createLab({
  key: "humidity", fileBase: "Namlik-lab", docLabel: "Virtual laboratoriya ishi · 9-sinf", site: SITE,
  modes: [{ id: "p", label: "1. Psixrometr", hint: "Quruq va ho‘l termometr ko‘rsatkichlarini o‘qing" }, { id: "d", label: "2. Shudring nuqtasi", hint: "Idishni sovitib, shudring paydo bo‘lgan temperaturani yozing" }],
  onMode() { st.pump = false; },
  vh: (n) => (n ? 360 : 330),
  draw, step,
  down(x, y, lab) { if (lab.mode === "d" && inBox(x, y, geo.pump)) { st.pump = true; return "pump"; } return null; },
  up() { st.pump = false; },
  cursor: (x, y) => (inBox(x, y, geo.pump) ? "pointer" : ""),
  tools: [{ label: "Puflash: boshlash / to‘xtatish", run: () => { st.pump = !st.pump; }, only: "d" }],
  controls: [
    { type: "seg", label: "Tajriba joyi", opts: Object.entries(ROOMS).map(([k, v]) => [k, v.name]), get: () => st.room, set: (v) => { st.room = v; st.pump = false; } },
    { type: "note", text: "Termometrlar 0,5 °C aniqlikda o‘qiladi. Joy almashtirilganda ko‘rsatkichlar barqarorlashishini kuting (ho‘l termometr sekinroq)." },
  ],
  readouts(lab) {
    return lab.mode === "p"
      ? [["Quruq termometr <i>t</i>", `${fmt(half(st.Td), 1)}<small>°C</small>`, "havo temperaturasi", "orange"], ["Ho‘l termometr <i>t</i><sub>h</sub>", `${fmt(half(st.Tw), 1)}<small>°C</small>`, "bug‘lanish sovitadi", "blue"], ["Farq <i>Δt</i>", `${fmt(half(st.Td) - half(st.Tw), 1)}<small>°C</small>`, "jadvalga kirish"], ["Joy", R().name, ""]]
      : [["Xona havosi <i>t</i>", `${fmt(half(st.Td), 1)}<small>°C</small>`, "", "orange"], ["Idish <i>t</i>", `${fmt(half(st.Tc), 1)}<small>°C</small>`, st.pump ? "sovimoqda" : "", "blue"], ["Sirt", dew() > 0 ? "shudring bor" : "quruq", dew() > 0 ? "t ≤ shudring nuqtasi" : ""], ["Joy", R().name, ""]];
  },
  record(lab) {
    if (lab.mode === "p") {
      if (Math.abs(st.Tw - tw0()) > 0.3 || Math.abs(st.Td - R().t) > 0.2) return { err: "Termometrlar hali barqarorlashmadi — biroz kuting." };
      const v = { t: fmt(half(st.Td), 1), tw: fmt(half(st.Tw), 1) };
      return { t: "t1", v, text: `${R().name}: t = ${v.t} °C, tₕ = ${v.tw} °C` };
    }
    if (!(dew() > 0)) return { err: "Idish sirtida hali shudring yo‘q — havo puflashni davom ettiring." };
    const v = { t: fmt(half(st.Td), 1), td: fmt(half(st.Tc), 1) };
    return { t: "t2", v, text: `${R().name}: t = ${v.t} °C, shudring nuqtasi ${v.td} °C` };
  },
  explain(lab) { return lab.mode === "p" ? `Ho‘l termometrdagi suv bug‘lanib uni sovitadi. Havo qancha quruq bo‘lsa, bug‘lanish tezroq va Δt kattaroq (hozir ${fmt(half(st.Td) - half(st.Tw), 1)} °C).` : dew() > 0 ? "Idish sirti yaqinidagi havo shudring nuqtasigacha sovidi — bug‘ to‘yinib, sirtda shudring paydo bo‘ldi. Shu paytdagi temperaturani yozing." : "Efir bug‘lanib idishni sovitmoqda. Sirt xiralashgan paytni kuzating."; },
  steps: ["1-topshiriq: joyni tanlang. Termometrlar barqarorlashgach, quruq va ho‘l termometr ko‘rsatkichlarini <b>Qaydga yozing</b>; jadvaldan φ ni toping.", "2-topshiriq: nokni bosib turib idishni sekin soviting. Sirtda shudring paydo bo‘lishi bilan idish temperaturasini va xona temperaturasini yozing.", "Qaydlarni jadvallarga o‘tkazing: φ avtomatik. Ikkala usul natijasini solishtiring.", "Boshqa joylarda (oshxona, qishki xona, ko‘cha) takrorlang. Xulosa va PDF."],
  formulas: ["Nisbiy namlik: <span class=\"sim-math\">φ = ρ / ρ₀ · 100 %</span>", "Shudring nuqtasi bo‘yicha: <span class=\"sim-math\">φ = ρ₀(t<sub>sh</sub>) / ρ₀(t) · 100 %</span>", "Psixrometr: φ — jadvaldan (t va Δt bo‘yicha)", "Qulay namlik: 40–60 %"],
  note: "Qulay va sog‘lom muhit uchun nisbiy namlik 40–60 % bo‘lishi tavsiya etiladi.",
  extra: PT,
  notebook: {
    intro: "Jadval sharti — tajriba joyi. Bitta topshiriq yetarli, ikkalasi — usullarni solishtirish.",
    conclusionPh: "Havoning nisbiy namligi qancha chiqdi? Ikki usul natijalari mosmi? Bu joyda namlik me’yordami?",
    hint: "Javob bering: 1) φ qancha? 2) Nega ho‘l termometr past ko‘rsatadi? 3) Ikki usul natijasi qanchalik mos? 4) Qishda isitilgan xonada nega havo quruq?",
    minTables: 1,
    tables: [
      { key: "t1", okLabel: "Psixrometr", need: "1-jadvalda kamida 1 o‘lchash", title: "1-topshiriq. Psixrometr",
        cond: { fields: [{ k: "room", label: "Joy", opts: Object.entries(ROOMS).map(([k, v]) => [k, v.name]) }], sync: () => ({ room: st.room }), init: { room: "cls" } },
        head: ["t, °C", "tₕ, °C", "Δt, °C", "φ, %", "Tekshiruv"], cols: [{ k: "t", kind: "num" }, { k: "tw", kind: "num" }], outs: ["dt", "phi"],
        blank: () => ({ t: "", tw: "" }), rows: 2, max: 8, narrow: true,
        parse: (r) => ({ t: num(r.t), tw: num(r.tw) }), check: (r) => (!(r.tw <= r.t) ? { ok: false, err: "tₕ ≤ t bo‘lishi kerak" } : { ok: true }),
        analyze: anP, out: (A, j, r) => ({ dt: fmt(r.t - r.tw, 1), phi: fmt(phiFromPsy(r.t, r.tw) * 100, 0) }),
        summary: (A) => (A.rows.length ? [["Nisbiy namlik φ", `${fmt(A.m.m, 0)} %`, "psixrometr"]] : null),
        ok: (A) => A.ok },
      { key: "t2", okLabel: "Shudring nuqtasi", need: "2-jadvalda kamida 1 o‘lchash", title: "2-topshiriq. Shudring nuqtasi",
        cond: { fields: [{ k: "room", label: "Joy", opts: Object.entries(ROOMS).map(([k, v]) => [k, v.name]) }], sync: () => ({ room: st.room }), init: { room: "cls" } },
        head: ["t, °C", "t<sub>sh</sub>, °C", "φ, %", "Tekshiruv"], cols: [{ k: "t", kind: "num" }, { k: "td", kind: "num" }], outs: ["phi"],
        blank: () => ({ t: "", td: "" }), rows: 2, max: 8, narrow: true,
        parse: (r) => ({ t: num(r.t), td: num(r.td) }), check: (r) => (!(r.td <= r.t) ? { ok: false, err: "t_sh ≤ t bo‘lishi kerak" } : { ok: true }),
        analyze: anD, out: (A, j, r) => ({ phi: fmt((rhoSat(r.td) / rhoSat(r.t)) * 100, 0) }),
        summary: (A) => (A.rows.length ? [["Nisbiy namlik φ", `${fmt(A.m.m, 0)} %`, "shudring nuqtasi bo‘yicha"]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
