// ==========================================================================
// Laboratoriya ishi: Yoritilganlikning masofaga va nurlarning tushish burchagiga bog‘liqligi (simulations/lab-yoritilganlik.html).
// Darslik: 11-sinf §31. Qurilma (yuqoridan ko‘rinish): skameyka boshida lampa, shkala bo‘ylab suriladigan va burilishi mumkin
// bo‘lgan lyuksmetr fotoelementi, raqamli lyuksmetr. Xonada kuchsiz fon yorug‘ligi bor (lampa o‘chirilganda o‘lchanadi).
// Fizika: photometry-physics.js (E = I cos α / r², lyuksmetr xatoligi ±2 % ± 1 lx).
// ==========================================================================

import { createLab, docKit, fitOrigin, meanErr, fmt } from "./lab-core.js";
import { num, docMeta, docTail } from "./labnotebook.js";
import { fx, userText } from "./labreport.js";
import { LAMPS, intensity, illuminance } from "./photometry-physics.js";
import { noise } from "./labkit.js";
import { rulerH, multimeter, label, hint, rr, F } from "./labgear.js";

const SITE = { url: "https://oliyfizika.uz/simulations/lab-yoritilganlik.html", label: "oliyfizika.uz/simulations/lab-yoritilganlik.html" };
const FON = 2, D2R = Math.PI / 180;
const st = { lamp: "inc100", r: 60, a: 0, on: true };
const geo = {};

function lux() {
  const I = intensity(LAMPS[st.lamp]), E = st.on ? illuminance(I, st.r / 100, st.a * D2R) : 0;
  const z = noise(st.r * 0.71 + st.a * 0.13, st.lamp.length);
  return { E, Ed: Math.max(0, Math.round((E + FON) * (1 + 0.02 * z) + z)) };
}

const LAY = { wide: { x0: 70, k: 3.8, y: 170, lx: [500, 12, 168, 110] }, narrow: { x0: 40, k: 2.3, y: 200, lx: [214, 10, 176, 116] } };
function draw(ctx, S) {
  const { w, h, colors: c, narrow } = S, L = narrow ? LAY.narrow : LAY.wide, m = lux(), sx = L.x0 + st.r * L.k, sy = L.y;
  // lampa yorug‘ligi
  if (st.on) { const g = ctx.createRadialGradient(L.x0, sy, 4, L.x0, sy, w * 0.9); g.addColorStop(0, "rgba(253,224,71,0.55)"); g.addColorStop(0.25, "rgba(253,224,71,0.18)"); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  // skameyka va shkala (0 — lampa tolasida)
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8"; ctx.fillRect(L.x0 - 30, sy + 26, w - L.x0 + 20, 8);
  rulerH(ctx, c, L.x0, sy + 36, L.k, 150, { h: 18, sub: 1, step: 10, labelEvery: narrow ? 3 : 1 });
  // lampa
  ctx.fillStyle = c.dark ? "#475569" : "#64748b"; rr(ctx, L.x0 - 34, sy - 10, 22, 20, 3); ctx.fill();
  ctx.fillStyle = st.on ? "#fef9c3" : c.dark ? "#334155" : "#e2e8f0"; ctx.strokeStyle = "#a16207"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(L.x0, sy, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = st.on ? "#f59e0b" : "#78716c"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L.x0 - 6, sy); for (let i = 0; i < 6; i++) ctx.lineTo(L.x0 - 6 + i * 2.4, sy + (i % 2 ? -3 : 3)); ctx.stroke();
  geo.lamp = [L.x0, sy];
  label(ctx, st.on ? "lampa (bosing: o‘chirish)" : "lampa o‘chiq (bosing)", L.x0 - 20, sy - 30, c.text2, F(9, 700), "left");
  // nur yo‘nalishi va fotoelement
  ctx.setLineDash([4, 4]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L.x0 + 16, sy); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
  const a = st.a * D2R, nx = -Math.cos(a), ny = -Math.sin(a), px = -ny, py = nx, half = narrow ? 18 : 24;
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; rr(ctx, sx - 10, sy + 14, 20, 14, 3); ctx.fill(); ctx.fillRect(sx - 2, sy, 4, 16);
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 7; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(sx + px * half, sy + py * half); ctx.lineTo(sx - px * half, sy - py * half); ctx.stroke();
  ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx + px * half + nx * 4, sy + py * half + ny * 4); ctx.lineTo(sx - px * half + nx * 4, sy - py * half + ny * 4); ctx.stroke();
  // normal va burchak
  ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + nx * 46, sy + ny * 46); ctx.stroke();
  if (st.a) { ctx.beginPath(); ctx.arc(sx, sy, 30, Math.PI, Math.PI + a, a < 0); ctx.stroke(); label(ctx, `α = ${fmt(Math.abs(st.a), 0)}°`, sx - 36, sy + (st.a > 0 ? -26 : 26), "#2563eb", F(10, 700), "right"); }
  const hx = sx + px * (half + 10), hy = sy + py * (half + 10);
  ctx.fillStyle = "#2563eb"; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
  geo.cell = [sx, sy]; geo.rot = [hx, hy]; geo.L = L;
  label(ctx, "fotoelement", sx, sy + 48 + 18, c.text2, F(9, 700));
  // lyuksmetr
  multimeter(ctx, c, ...L.lx, { value: String(m.Ed), unit: "lx", mode: "LUX", title: "LYUKSMETR", inLabel: "sensor" });
  hint(ctx, c, "fotoelementni suring; ko‘k dastak — burish", narrow ? 10 : 160, narrow ? h - 16 : 24);
}

/* ------------------------------------------------------------------ Hisob */
function anR(rows) {
  const rs = rows.slice().sort((a, b) => a.r - b.r).map((r) => ({ ...r, rm: r.r / 100, I: r.E * (r.r / 100) ** 2, x: 1 / (r.r / 100) ** 2 }));
  const f = rs.length >= 2 ? fitOrigin(rs.map((r) => [r.x, r.E])) : null, m = meanErr(rs.map((r) => r.I));
  return { rows: rs, f, m, ok: new Set(rs.map((r) => r.r)).size >= 4 };
}
function anA(rows) {
  const rs = rows.slice().sort((a, b) => a.a - b.a), E0 = (rs.find((r) => r.a === 0) || rs.reduce((p, q) => (q.E > p.E ? q : p), rs[0] || { E: NaN })).E;
  return { rows: rs.map((r) => ({ ...r, q: r.E / E0, cos: Math.cos(r.a * D2R) })), E0, ok: rs.length >= 4 && rs.some((r) => r.a === 0) };
}
function build(nb, res) {
  const A = res.t1.A, B = res.t2?.ok ? res.t2.A : null, Lm = LAMPS[res.t1.cond.lamp] || LAMPS.inc100, D = docKit(), I = A.f ? A.f.k : A.m.m;
  D.S("Ishning maqsadi");
  D.list(["Yoritilganlikning manbagacha masofaga bog‘liqligini o‘rganish va manbaning yorug‘lik kuchini aniqlash.", "Yoritilganlikning nurlarning tushish burchagiga bog‘liqligini tekshirish."]);
  D.S("Qisqacha nazariya");
  D.p("Nuqtaviy manba (yorug‘lik kuchi $I$) dan $r$ masofadagi sirtning yoritilganligi, nurlar sirt normaliga $\\alpha$ burchak ostida tushganda:");
  D.eq("E = \\frac{I\\cos\\alpha}{r^2}", 1);
  D.p("Demak, $\\alpha = 0$ da $E \\cdot r^2 = I$ o‘zgarmas, $E(1/r^2)$ grafigi esa koordinata boshidan o‘tuvchi to‘g‘ri chiziq bo‘lib, uning qiyaligi $I$ ga teng. O‘zgarmas $r$ da $E/E_0 = \\cos\\alpha$.");
  D.S("Jihozlar");
  D.list([`${Lm.name}, optik skameyka (bo‘linma qiymati $1$ cm).`, "Lyuksmetr (xatoligi $\\pm 2$ % $\\pm 1$ lx) va burilishi mumkin bo‘lgan fotoelement.", "Tajriba qorong‘ilatilgan xonada o‘tkazildi (fon yoritilganligi bir necha lx)."]);
  D.S("Ishni bajarish tartibi");
  D.list(["Fotoelement nurga perpendikulyar ($\\alpha = 0$) qilib, lampadan turli $r$ masofalarga qo‘yildi va yoritilganlik $E$ o‘lchandi (1-jadval).", "O‘zgarmas $r$ da fotoelement turli $\\alpha$ burchaklarga burildi va $E$ o‘lchandi (2-jadval).", "$E(1/r^2)$ grafigidan yorug‘lik kuchi topildi, $E/E_0$ nisbat $\\cos\\alpha$ bilan solishtirildi."], true);
  D.S("Yoritilganlikning masofaga bog‘liqligi");
  D.table(`Yoritilganlikning masofaga bog‘liqligi (${Lm.name}, $\\alpha = 0$)`, ["№", "$r$, m", "$E$, lx", "$1/r^2$, m$^{-2}$", "$I = Er^2$, cd", "Tekshiruv"],
    A.rows.map((r, i) => [String(i + 1), `$${fx(r.rm, 2)}$`, `$${fx(r.E, 0)}$`, `$${fx(r.x, 2)}$`, `$${fx(r.I, 1)}$`, res.t1.flags[i] ? "$\\checkmark$" : "--"]));
  if (A.f) D.fig("er", "Yoritilganlikning $1/r^2$ ga bog‘liqligi; to‘g‘ri chiziq qiyaligi — yorug‘lik kuchi $I$.", { xmin: 0, xmax: Math.max(...A.rows.map((r) => r.x)) * 1.1, ymin: 0, ymax: Math.max(...A.rows.map((r) => r.E)) * 1.15, legendPos: "north west", xlab: "1/r², m⁻²", ylab: "E, lx",
    series: [{ kind: "pts", data: A.rows.map((r) => [r.x, r.E]), color: "#c2410c", label: "tajriba" }, { kind: "line", fn: (x) => A.f.k * x, color: "#1d4ed8", label: `E = ${fmt(A.f.k, 1)}/r²` }] });
  D.p("**Hisoblash:**");
  D.eq([`I = E r^2;\\qquad \\langle I\\rangle = (${fx(A.m.m, 1)} \\pm ${fx(Math.max(A.m.s, 0.05), 1)})\\ \\text{cd};\\qquad \\text{grafikdan: } I = ${fx(I, 1)}\\ \\text{cd}`,
    `\\Phi = 4\\pi I = ${fx(4 * Math.PI * I, 0)}\\ \\text{lm}\\quad (\\text{lampaning to‘liq yorug‘lik oqimi, izotrop manba uchun})`]);
  const box = [`• Lampaning yorug‘lik kuchi $I \\approx ${fx(I, 0)}$ cd, to‘liq oqimi $\\Phi \\approx ${fx(4 * Math.PI * I, 0)}$ lm.`, "• Yoritilganlik masofa kvadratiga teskari proporsional: masofa 2 marta ortsa, $E$ 4 marta kamayadi."];
  if (B) {
    D.S("Yoritilganlikning tushish burchagiga bog‘liqligi");
    D.table("Fotoelementni burish ($r$ o‘zgarmas)", ["№", "$\\alpha$, °", "$E$, lx", "$E/E_0$", "$\\cos\\alpha$", "Tekshiruv"],
      B.rows.map((r, i) => [String(i + 1), `$${fx(r.a, 0)}$`, `$${fx(r.E, 0)}$`, `$${fx(r.q, 3)}$`, `$${fx(r.cos, 3)}$`, res.t2.flags[i] ? "$\\checkmark$" : "--"]));
    D.fig("ea", "$E/E_0$ ning tushish burchagiga bog‘liqligi; uzluksiz chiziq — $\\cos\\alpha$.", { xmin: 0, xmax: 90, ymin: 0, ymax: 1.1, legendPos: "south west", xlab: "α, °", ylab: "E/E0",
      series: [{ kind: "line", fn: (x) => Math.cos(x * D2R), color: "#1d4ed8", label: "cos α" }, { kind: "pts", data: B.rows.map((r) => [r.a, r.q]), color: "#7c3aed", label: "tajriba" }] });
    box.push("• Fotoelement burilganda yoritilganlik $\\cos\\alpha$ ga proporsional kamayadi — Lambert qonuni tasdiqlandi.");
  }
  D.S("Xulosa");
  docTail(D.X, nb, userText, box, SITE);
  return { title: "Laboratoriya ishi. Yoritilganlikning masofa va tushish burchagiga bog‘liqligi", titlePlain: "Laboratoriya ishi. Yoritilganlik", author: nb.f.name, sub: `${Lm.name}: E = I cos α / r²`, meta: docMeta(nb, userText), blocks: D.X };
}

createLab({
  key: "illuminance", fileBase: "Yoritilganlik-lab", docLabel: "Virtual laboratoriya ishi · 11-sinf", site: SITE,
  modes: [{ id: "r", label: "1. Masofaga bog‘liqlik", hint: "Fotoelement nurga perpendikulyar (α = 0), masofani o‘zgartiring" }, { id: "a", label: "2. Burchakka bog‘liqlik", hint: "Masofa o‘zgarmas, fotoelementni buring" }],
  onMode(m) { if (m === "r") st.a = 0; },
  vh: (n) => (n ? 330 : 300),
  draw,
  down(x, y, lab) {
    if (geo.lamp && Math.hypot(x - geo.lamp[0], y - geo.lamp[1]) < 20) { st.on = !st.on; lab.say(st.on ? "Lampa yoqildi." : `Lampa o‘chirildi — lyuksmetr xonadagi fon yoritilganligini ko‘rsatmoqda (${lux().Ed} lx).`); return true; }
    if (geo.rot && Math.hypot(x - geo.rot[0], y - geo.rot[1]) < 14) return "rot";
    if (geo.cell && Math.abs(x - geo.cell[0]) < 28 && Math.abs(y - geo.cell[1]) < 40) return "cell";
    return null;
  },
  move(h, x, y) {
    const L = geo.L;
    if (h === "cell") st.r = Math.max(20, Math.min(150, Math.round((x - L.x0) / L.k)));
    else { const v = Math.atan2(y - geo.cell[1], x - geo.cell[0]) / D2R; st.a = Math.max(-85, Math.min(85, Math.round((v <= 0 ? v + 90 : v - 90) / 5) * 5)); }
  },
  cursor: (x, y) => (geo.rot && Math.hypot(x - geo.rot[0], y - geo.rot[1]) < 14 ? "grab" : geo.lamp && Math.hypot(x - geo.lamp[0], y - geo.lamp[1]) < 20 ? "pointer" : geo.cell && Math.abs(x - geo.cell[0]) < 28 && Math.abs(y - geo.cell[1]) < 40 ? "ew-resize" : ""),
  controls: [
    { type: "seg", label: "Lampa", opts: Object.entries(LAMPS).map(([k, v]) => [k, v.name]), get: () => st.lamp, set: (v) => { st.lamp = v; } },
    { type: "range", label: "Masofa r", min: 20, max: 150, step: 1, get: () => st.r, set: (v) => { st.r = v; }, fmt: (v) => `${fmt(v, 0)} cm` },
    { type: "range", label: "Burilish burchagi α", min: 0, max: 85, step: 5, get: () => Math.abs(st.a), set: (v) => { st.a = v; }, fmt: (v) => `${fmt(v, 0)}°`, only: "a" },
    { type: "note", text: "Masofa lampa tolasidan fotoelementgacha shkaladan o‘qiladi. Lampani bosib o‘chirsangiz — xonadagi fon yoritilganligini ko‘rasiz." },
  ],
  readouts() {
    const m = lux();
    return [["Lyuksmetr <i>E</i>", `${m.Ed}<small>lx</small>`, st.on ? "yoritilganlik" : "fon (lampa o‘chiq)", "orange"], ["Masofa <i>r</i>", `${fmt(st.r, 0)}<small>cm</small>`, "skameyka shkalasi", "blue"],
      ["Burchak <i>α</i>", `${fmt(Math.abs(st.a), 0)}°`, "normal va nur orasida"], ["Lampa", LAMPS[st.lamp].name, "I — noma’lum"]];
  },
  record(lab) {
    const m = lux();
    if (!st.on) return { err: "Lampa o‘chiq — fon yoritilganligi qaydga yozilmaydi (u bor-yo‘g‘i bir necha lx)." };
    if (lab.mode === "r") {
      if (st.a !== 0) return { err: "1-topshiriqda fotoelement nurga perpendikulyar bo‘lsin (α = 0)." };
      const v = { r: fmt(st.r, 0), E: String(m.Ed) };
      return { t: "t1", v, text: `${LAMPS[st.lamp].name}: r = ${v.r} cm, E = ${v.E} lx` };
    }
    const v = { a: fmt(Math.abs(st.a), 0), E: String(m.Ed) };
    return { t: "t2", v, text: `r = ${fmt(st.r, 0)} cm: α = ${v.a}°, E = ${v.E} lx` };
  },
  explain() { const m = lux(); return st.a ? `Fotoelement ${fmt(Math.abs(st.a), 0)}° ga burilgan: unga tushayotgan oqim cos α = ${fmt(Math.cos(st.a * D2R), 2)} marta kamaydi.` : `r = ${fmt(st.r, 0)} cm da E = ${m.Ed} lx. Masofani 2 marta oshirsangiz, yoritilganlik ≈ 4 marta kamayadi.`; },
  steps: ["1-topshiriq: lampani tanlang. Fotoelementni 30, 40, 60, 80, 100, 140 cm masofalarga surib, E ni <b>Qaydga yozing</b> (α = 0).", "2-topshiriq: fotoelementni masalan 60 cm da qoldirib, 0°, 20°, 40°, 60°, 80° ga burang va E ni yozing.", "Qaydlarni jadvallarga o‘tkazing: I = Er², E/E₀ va cos α avtomatik.", "Lampani o‘chirib fon yoritilganligini ko‘ring — u natijaga qanday ta’sir qiladi? Xulosa va PDF."],
  formulas: ["Yoritilganlik: <span class=\"sim-math\">E = I cos α / r²</span>", "Yorug‘lik kuchi: <span class=\"sim-math\">I = E r²</span> (α = 0)", "To‘liq oqim (izotrop manba): <span class=\"sim-math\">Φ = 4πI</span>", "1 lx = 1 lm/m²"],
  note: "Sinf xonasida o‘qish uchun me’yor ≈ 300 lx, chizmachilik uchun ≈ 500 lx.",
  notebook: {
    intro: "1-jadval sharti — lampa (α = 0, kamida 4 xil masofa). 2-jadval — o‘zgarmas masofada turli burchaklar (α = 0 ham bo‘lsin).",
    conclusionPh: "Yorug‘lik kuchi qancha chiqdi? E masofaga va burchakka qanday bog‘liq?",
    hint: "Javob bering: 1) E·r² o‘zgarmasmi va u nimaga teng? 2) Masofa 2 marta ortsa E necha marta kamayadi? 3) E/E₀ cos α ga mosmi? 4) Fon yoritilganligi qaysi masofalarda sezilarli ta’sir qiladi?",
    minTables: 1,
    tables: [
      { key: "t1", req: true, okLabel: "E(r)", need: "1-jadvalda kamida 4 xil masofa", title: "1-topshiriq. Yoritilganlikning masofaga bog‘liqligi",
        cond: { fields: [{ k: "lamp", label: "Lampa", opts: Object.entries(LAMPS).map(([k, v]) => [k, v.name]) }], sync: () => ({ lamp: st.lamp }), init: { lamp: "inc100" } },
        head: ["r, cm", "E, lx", "I = E·r², cd", "Tekshiruv"], cols: [{ k: "r", kind: "num" }, { k: "E", kind: "num" }], outs: ["I"],
        blank: () => ({ r: "", E: "" }), rows: 5, max: 12, narrow: true,
        parse: (r) => ({ r: num(r.r), E: num(r.E) }), check: (r) => (!(r.r > 0) || !(r.E >= 0) ? { ok: false, err: "r > 0, E ≥ 0" } : { ok: true }),
        analyze: anR, out: (A, j, r) => ({ I: fmt(r.E * (r.r / 100) ** 2, 1) }),
        summary: (A) => (A.rows.length ? [["Yorug‘lik kuchi I", `${fmt(A.f ? A.f.k : A.m.m, 1)} cd`, "E(1/r²) qiyaligi"], ["O‘rtacha E·r²", `${fmt(A.m.m, 1)} cd`, A.rows.length > 1 ? `± ${fmt(Math.max(A.m.s, 0.05), 1)}` : ""]] : null),
        ok: (A) => A.ok },
      { key: "t2", okLabel: "E(α)", need: "2-jadvalda kamida 4 burchak (0° bilan)", title: "2-topshiriq. Yoritilganlikning tushish burchagiga bog‘liqligi",
        head: ["α, °", "E, lx", "E/E₀", "cos α", "Tekshiruv"], cols: [{ k: "a", kind: "num" }, { k: "E", kind: "num" }], outs: ["q", "cos"],
        blank: () => ({ a: "", E: "" }), rows: 5, max: 12, narrow: true,
        parse: (r) => ({ a: num(r.a), E: num(r.E) }), check: (r) => (!(r.a >= 0 && r.a < 90) || !(r.E >= 0) ? { ok: false, err: "0 ≤ α < 90°, E ≥ 0" } : { ok: true }),
        analyze: anA, out: (A, j, r) => ({ q: Number.isFinite(A.E0) ? fmt(r.E / A.E0, 3) : "—", cos: fmt(Math.cos(r.a * D2R), 3) }),
        summary: (A) => (A.rows.length ? [["E₀ (α = 0)", Number.isFinite(A.E0) ? `${fmt(A.E0, 0)} lx` : "—", ""]] : null),
        ok: (A) => A.ok },
    ],
    build,
  },
});
