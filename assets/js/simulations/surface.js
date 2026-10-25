// ==========================================================================
// Sirt tarangligi, ho'llash va kapillyarlik — virtual laboratoriya (simulations/surface.html)
// 1) Ramka va sovun pardasi: qo'zg'aluvchan to'sin sahnada suriladi; dinamometr F = 2σL (o'zgarmas), ish A = σΔS.
// 2) Ho'llash va kapillyarlik: 3 ta nay (0,25 / 0,5 / 1 mm) va radiusi sahnada o'zgaradigan nay; plastinkadagi tomchi
//    (chegaraviy burchak θ); simobda pasayish.
// 3) Tomchilar usuli: byuretkadan tomchilar uziladi (mg = πdσ), sanaladi, tarozida tortiladi → σ = Mg/(πdN).
// Fizika: surface-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./surface-physics.js";
import { drawFilm, drawCap, drawDrops, lastFrame } from "./surface-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const FIXED_R = [0.25e-3, 0.5e-3, 1e-3];
const X_MAX = 0.1; // ramka uzunligi, m
const N_MAX = 60;  // tajribada tomchilar soni

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "film", hover: null, speed: 1 };
const st = { liq: "soap", t: 20 };
const film = { L: 0.05, x: 0.05, x0: 0.03 };
const cap = { r: 0.5e-3 };
const drops = { d: 2e-3, N: 0, M: 0, grow: 0, falling: [], pts: [{ N: 0, M: 0 }], open: false };
let presetId = null, running = false;
const geo = {};

const L = () => P.LIQUIDS[st.liq];
const sigma = () => P.sigmaAt(st.liq, ui.mode === "drops" ? 20 : st.t);
const liqRGBA = (a) => { const c = L().color; return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const balanceMg = (kg) => Math.round(kg * 1e6); // tarozi: 1 mg

/* ------------------------------------------------------------------ 1. Ramka */

function drawFilmStage(ctx, c, w, h) {
  const narrow = w < 560, x0 = 40, k = (narrow ? w - 120 : w * 0.56) / X_MAX, cy = h * 0.5, half = (film.L * k) / 2, bx = x0 + film.x * k, F = P.filmForce(sigma(), film.L);
  // parda
  const g = ctx.createLinearGradient(x0, cy - half, bx, cy + half);
  g.addColorStop(0, c.dark ? "rgba(196,181,253,0.25)" : "rgba(196,181,253,0.35)"); g.addColorStop(0.5, c.dark ? "rgba(125,211,252,0.25)" : "rgba(125,211,252,0.35)"); g.addColorStop(1, c.dark ? "rgba(253,224,71,0.2)" : "rgba(253,224,71,0.3)");
  ctx.fillStyle = g; ctx.fillRect(x0, cy - half, bx - x0, 2 * half);
  // ramka (P-shakl)
  ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + X_MAX * k + 10, cy - half); ctx.lineTo(x0, cy - half); ctx.lineTo(x0, cy + half); ctx.lineTo(x0 + X_MAX * k + 10, cy + half); ctx.stroke();
  // to'sin
  ctx.strokeStyle = c.warning; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(bx, cy - half - 6); ctx.lineTo(bx, cy + half + 6); ctx.stroke(); ctx.lineCap = "butt";
  geo.bar = { x: bx, y0: cy - half - 10, y1: cy + half + 10, x0, k };
  // kuchlar: parda to'sinni chapga tortadi
  for (const yy of [cy - half * 0.6, cy, cy + half * 0.6]) arrow(ctx, bx - 4, yy, -26, 0, c.primary, { width: 2, head: 7 });
  tag(ctx, `F = 2σL = ${fmt(F * 1000, 2)} mN`, bx - 40, cy - half - 18, { color: c.primary, bg: c.bg, align: "right", font: MID });
  // dinamometr (o'ngga tortadi)
  const dx = bx + 26, dw = 70;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx + 3, cy); ctx.lineTo(dx, cy); ctx.stroke();
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.beginPath(); ctx.roundRect(dx, cy - 10, dw, 20, 5); ctx.fill(); ctx.stroke();
  const fr = clamp(F / 0.012, 0, 1); ctx.fillStyle = c.danger; ctx.fillRect(dx + 4 + fr * (dw - 10), cy - 7, 2.5, 14);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; for (let i = 0; i <= 6; i++) { const xx = dx + 4 + (i / 6) * (dw - 10); ctx.beginPath(); ctx.moveTo(xx, cy + 4); ctx.lineTo(xx, cy + 9); ctx.stroke(); }
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(dx + dw + 12, cy, 9, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.font = "700 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⇔", dx + dw + 12, cy + 0.5);
  geo.handle = { x: dx + dw + 12, y: cy, r: 16 };
  // o'lchamlar
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, cy + half + 22); ctx.lineTo(bx, cy + half + 22); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`x = ${fmt(film.x * 100, 1)} cm`, (x0 + bx) / 2, cy + half + 26);
  ctx.save(); ctx.translate(x0 - 8, cy); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`L = ${fmt(film.L * 100, 1)} cm`, 0, 0); ctx.restore();
  if (narrow) return;
  const ix = w * 0.72; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = BOLD; ctx.fillStyle = c.text; ctx.fillText(`${L().name} pardasi`, ix, 16);
  ctx.font = MID; ctx.fillStyle = c.text2;
  const dS = 2 * film.L * Math.abs(film.x - film.x0);
  [`σ = ${fmt(sigma() * 1000, 1)} mN/m (${fmt(st.t, 0)} °C)`, `parda yuzasi S = 2Lx = ${fmt(2 * film.L * film.x * 1e4, 1)} cm²`, `ΔS = ${fmt(dS * 1e4, 1)} cm²`, `A = σΔS = ${fmt(sigma() * dS * 1e6, 1)} μJ`].forEach((l, i) => ctx.fillText(l, ix, 40 + i * 18));
}

/* ------------------------------------------------------------------ 2. Kapillyarlik */

function tube(ctx, c, x, r, ys, top, bot, hpx, wets) {
  const half = 3 + r * 1000 * 7;
  ctx.fillStyle = liqRGBA(c.dark ? 0.45 : 0.55);
  const yl = ys - hpx; // suyuqlik ustuni yuqori sathi
  ctx.fillRect(x - half, Math.min(yl, ys), 2 * half, bot - Math.min(yl, ys));
  if (hpx < 0) { ctx.fillStyle = c.bg; ctx.fillRect(x - half, ys, 2 * half, -hpx); ctx.fillStyle = liqRGBA(c.dark ? 0.45 : 0.55); }
  // menisk
  ctx.strokeStyle = liqRGBA(1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - half, yl + (wets ? -3 : 3)); ctx.quadraticCurveTo(x, yl + (wets ? 4 : -5), x + half, yl + (wets ? -3 : 3)); ctx.stroke();
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - half - 1, top); ctx.lineTo(x - half - 1, bot - 6); ctx.moveTo(x + half + 1, top); ctx.lineTo(x + half + 1, bot - 6); ctx.stroke();
  return half;
}
function drawCapStage(ctx, c, w, h) {
  const narrow = w < 560, Lq = L(), s = sigma(), merc = st.liq === "mercury", top = 18, ys = merc ? h * 0.42 : h * 0.72, bot = h - 14;
  const hMaxMm = merc ? 25 : 65, kpx = (merc ? (bot - ys - 30) : (ys - top - 18)) / hMaxMm;
  const bx0 = narrow ? 14 : w * 0.3, bx1 = w - 14;
  // idish
  ctx.fillStyle = liqRGBA(c.dark ? 0.3 : 0.38); ctx.fillRect(bx0, ys, bx1 - bx0, bot - ys);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx0, top + 40); ctx.lineTo(bx0, bot); ctx.lineTo(bx1, bot); ctx.lineTo(bx1, top + 40); ctx.stroke();
  // naylar
  const radii = [...FIXED_R, cap.r], gap = (bx1 - bx0) / (radii.length + 1);
  radii.forEach((r, i) => {
    const x = bx0 + gap * (i + 1), hmm = P.capillaryH(s, Lq.rho, r, Lq.theta) * 1000, hpx = clamp(hmm * kpx, -(bot - ys - 8), ys - top - 6);
    const half = tube(ctx, c, x, r, ys, top + (i === 3 ? 22 : 10), bot, hpx, P.wets(Lq.theta));
    ctx.font = SMALL; ctx.fillStyle = i === 3 ? c.primary : c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(`r = ${fmt(r * 1000, 2)} mm`, x, top + (i === 3 ? 20 : 8) + (i === 3 ? 0 : 0));
    tag(ctx, `${hmm >= 0 ? "" : "−"}${fmt(Math.abs(hmm), 1)} mm`, x + half + 4, clamp(ys - hpx, top + 30, bot - 12), { color: c.text, bg: c.bg2, font: SMALL });
    if (i === 3) { ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + half + 1, top + 34, 8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.primary; ctx.font = "700 9px Inter, system-ui, sans-serif"; ctx.textBaseline = "middle"; ctx.fillText("⇔", x + half + 1, top + 34.5); geo.capHandle = { x: x + half + 1, y: top + 34, r: 16, cx: x }; }
  });
  ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx0, ys); ctx.lineTo(bx1, ys); ctx.stroke(); ctx.setLineDash([]);
  if (narrow) return;
  // plastinkadagi tomchi (θ)
  const px = 20, pw = w * 0.3 - 40, py = h * 0.5, th = Lq.theta, R = 34;
  ctx.fillStyle = c.dark ? "#475569" : "#cbd5e1"; ctx.fillRect(px, py, pw, 6);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("shisha plastinka", px, py + 10);
  // tomchi — aylana segmenti: plastinka bilan kesishgan joyda yarim kenglik a, chegaraviy burchak θ (suyuqlik ichidan o‘lchanadi)
  const cx = px + pw / 2, a = th > Math.PI / 2 ? R * 0.6 : R, flat = th < 0.05;
  const segR = flat ? a * 4 : a / Math.sin(Math.min(th, Math.PI - 0.05)), ccy = flat ? py + segR - 6 : py + segR * Math.cos(th);
  const dropH = flat ? 6 : segR * (1 - Math.cos(th));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, py); ctx.clip();
  ctx.fillStyle = liqRGBA(0.75); ctx.beginPath(); ctx.arc(cx, ccy, segR, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText(`${P.wets(th) ? "ho‘llaydi" : "ho‘llamaydi"} (θ ≈ ${fmt(th / P.DEG, 0)}°)`, cx, py - dropH - 8);
}

/* ------------------------------------------------------------------ 3. Tomchilar */

function drawDropsStage(ctx, c, w, h) {
  const narrow = w < 560, cx = narrow ? w * 0.4 : w * 0.3, Lq = L(), mDrop = P.dropMass(sigma(), drops.d), kr = 900; // px/m (tomchi 6 marta kattalashtirilgan)
  // byuretka
  ctx.fillStyle = liqRGBA(c.dark ? 0.35 : 0.45); ctx.fillRect(cx - 12, 14, 24, h * 0.36);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.8; ctx.strokeRect(cx - 12, 8, 24, h * 0.36 + 6);
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(cx - 12, 8 + i * h * 0.045); ctx.lineTo(cx - 4, 8 + i * h * 0.045); ctx.stroke(); }
  const ky = 14 + h * 0.36 + 10;
  ctx.fillStyle = drops.open ? c.success : c.danger; ctx.beginPath(); ctx.roundRect(cx - 22, ky - 5, 44, 10, 4); ctx.fill();
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(drops.open ? "jo‘mrak ochiq" : "jo‘mrak yopiq — bosing", cx + 28, ky);
  geo.cock = { x: cx - 26, y: ky - 10, w: 52, h: 20 };
  const tipY = ky + 26, tipW = 4 + drops.d * 1000 * 2.4;
  ctx.fillStyle = c.text3; ctx.fillRect(cx - tipW / 2 - 2, ky + 5, tipW + 4, 21);
  // o'sayotgan tomchi
  const rNow = P.dropRadius(mDrop * drops.grow, Lq.rho) * kr * 6;
  if (drops.grow > 0.02) { ctx.fillStyle = liqRGBA(0.85); ctx.beginPath(); ctx.ellipse(cx, tipY + rNow * 0.9, Math.max(tipW / 2, rNow), rNow * 1.1, 0, 0, TAU); ctx.fill(); }
  const rD = P.dropRadius(mDrop, Lq.rho) * kr * 6;
  for (const f of drops.falling) { ctx.fillStyle = liqRGBA(0.85); ctx.beginPath(); ctx.ellipse(cx, f.y, rD * 0.9, rD * 1.1, 0, 0, TAU); ctx.fill(); }
  // stakan va tarozi
  const by = h - 60, bw = 90;
  ctx.fillStyle = liqRGBA(c.dark ? 0.3 : 0.4); const fill = clamp(drops.M / (mDrop * N_MAX), 0, 1) * 24; ctx.fillRect(cx - bw / 2 + 2, by + 30 - fill, bw - 4, fill);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx - bw / 2, by - 10); ctx.lineTo(cx - bw / 2, by + 30); ctx.lineTo(cx + bw / 2, by + 30); ctx.lineTo(cx + bw / 2, by - 10); ctx.stroke();
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; ctx.strokeStyle = c.borderStrong; ctx.beginPath(); ctx.roundRect(cx - 80, by + 32, 160, 22, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "#052e16" : "#ecfdf5"; ctx.fillRect(cx - 40, by + 36, 76, 14);
  ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.fillStyle = c.success; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(`${balanceMg(drops.M)} mg`, cx + 33, by + 43.5);
  geo.dropsTop = tipY; geo.dropsBot = by + 28 - fill;
  // hisoblagich
  tag(ctx, `N = ${drops.N}`, cx - 80, ky + 40, { color: c.text, bg: c.bg2, font: BOLD, align: "right" });
  if (narrow) return;
  const ix = w * 0.56; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = BOLD; ctx.fillStyle = c.text; ctx.fillText("Tomchilar usuli", ix, 16);
  ctx.font = MID; ctx.fillStyle = c.text2;
  const M = balanceMg(drops.M) / 1e6, sg = drops.N > 0 && M > 0 ? P.sigmaFromDrops(M, drops.N, drops.d) : null;
  [`${Lq.name}, d = ${fmt(drops.d * 1000, 1)} mm`, `Tomchi uzilganda: mg = πdσ`, `N = ${drops.N} tomchi, M = ${balanceMg(drops.M)} mg`, drops.N ? `bitta tomchi m = M/N = ${fmt((M / drops.N) * 1e6, 1)} mg` : "jo‘mrakni oching", sg ? `σ = Mg/(πdN) = ${fmt(sg * 1000, 1)} mN/m` : ""].filter(Boolean).forEach((l, i) => ctx.fillText(l, ix, 40 + i * 18));
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "film") drawFilmStage(ctx, c, s.w, s.h);
  else if (ui.mode === "cap") drawCapStage(ctx, c, s.w, s.h);
  else drawDropsStage(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.42, 300, 350)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "film") return drawFilm(ctx, gs, { sigma: sigma(), L: film.L, x0: film.x0, x: film.x, xMax: X_MAX, hover: ui.hover });
  if (ui.mode === "cap") return drawCap(ctx, gs, { liq: st.liq, r: cap.r, t: st.t, hover: ui.hover });
  return drawDrops(ctx, gs, { pts: drops.pts, sigma: sigma(), d: drops.d, Nmax: N_MAX, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  film: ["Dinamometr ko‘rsatishi F(x)", "Pardani cho‘zganda kuch o‘zgarmaydi (prujinadan farqli): parda yupqalashmaydi, yangi molekulalar sirtga chiqadi. Bo‘yalgan yuza — bajarilgan ish A = σΔS."],
  cap: ["Kapillyar ko‘tarilish h(r)", "Nay qancha ingichka bo‘lsa, suyuqlik shuncha baland ko‘tariladi: h ∝ 1/r. Ho‘llamaydigan simob esa pasayadi. Shtrix — boshqa suyuqliklar."],
  drops: ["Tomchilar massasi M(N)", "Har bir tomchi bir xil massada uziladi (mg = πdσ), shuning uchun M tomchilar soniga proporsional. Chiziq qiyaligi — bitta tomchi massasi."],
};
function setTab() { const t = TABS[ui.mode]; $("[data-tabs]").innerHTML = ""; $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render(); }

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;

function updateReadouts() {
  const Lq = L(), s = sigma();
  if (ui.mode === "film") {
    const F = P.filmForce(s, film.L), dS = 2 * film.L * Math.abs(film.x - film.x0);
    setRO("r1", "Sirt taranglik koeffitsiyenti <i>σ</i>", u(fmt(s * 1000, 1), "mN/m"), `${Lq.name}, ${fmt(st.t, 0)} °C`);
    setRO("r2", "To‘sin uzunligi <i>L</i>", u(fmt(film.L * 100, 1), "cm"), "parda ikki sirtli: chegara 2L");
    setRO("r3", "Dinamometr <i>F = 2σL</i>", u(fmt(F * 1000, 2), "mN"), "x ga bog‘liq emas", "orange");
    setRO("r4", "Parda yuzasi <i>S</i>", u(fmt(2 * film.L * film.x * 1e4, 1), "cm²"), "ikki sirt: S = 2Lx");
    setRO("r5", "Yuza o‘zgarishi <i>ΔS</i>", u(fmt(dS * 1e4, 1), "cm²"), `to‘sin ${fmt(film.x0 * 100, 1)} → ${fmt(film.x * 100, 1)} cm`);
    setRO("r6", "Ish <i>A = σΔS</i>", u(fmt(s * dS * 1e6, 2), "μJ"), "= F·Δx — sirt energiyasi ortishi");
    return;
  }
  if (ui.mode === "cap") {
    const h = P.capillaryH(s, Lq.rho, cap.r, Lq.theta);
    setRO("r1", "Sirt taranglik <i>σ</i>", u(fmt(s * 1000, 1), "mN/m"), `${Lq.name}, ${fmt(st.t, 0)} °C`);
    setRO("r2", "Zichlik <i>ρ</i>", u(fmt(Lq.rho, 0), "kg/m³"), "");
    setRO("r3", "Chegaraviy burchak <i>θ</i>", u(fmt(Lq.theta / P.DEG, 0), "°"), P.wets(Lq.theta) ? "shishani ho‘llaydi" : "shishani ho‘llamaydi");
    setRO("r4", "Nay radiusi <i>r</i>", u(fmt(cap.r * 1000, 2), "mm"), "o‘ngdagi (o‘zgaruvchan) nay");
    setRO("r5", "Ko‘tarilish <i>h</i>", u(fmt(h * 1000, 1), "mm"), h >= 0 ? "h = 2σcosθ/(ρgr)" : "manfiy — sath pasayadi", "orange");
    setRO("r6", "Menisk", P.wets(Lq.theta) ? "botiq" : "qavariq", P.wets(Lq.theta) ? "suyuqlik devorga tortiladi" : "suyuqlik devordan qochadi");
    return;
  }
  const M = balanceMg(drops.M) / 1e6, sg = drops.N > 0 && M > 0 ? P.sigmaFromDrops(M, drops.N, drops.d) : null;
  setRO("r1", "Tomchilar soni <i>N</i>", u(drops.N, "ta"), drops.open ? "tomizilmoqda" : "jo‘mrak yopiq");
  setRO("r2", "Tomchilar massasi <i>M</i>", u(balanceMg(drops.M), "mg"), "tarozida (1 mg aniqlik)");
  setRO("r3", "Bitta tomchi <i>m = M/N</i>", drops.N ? u(fmt((M / drops.N) * 1e6, 2), "mg") : "—", `nazariy: πdσ/g = ${fmt(P.dropMass(s, drops.d) * 1e6, 2)} mg`);
  setRO("r4", "Naycha uchi <i>d</i>", u(fmt(drops.d * 1000, 1), "mm"), "uzilish chegarasi uzunligi πd");
  setRO("r5", "O‘lchangan <i>σ = Mg/(πdN)</i>", sg ? u(fmt(sg * 1000, 1), "mN/m") : "—", sg ? `farqi ${fmt(((sg - s) / s) * 100, 1)} %` : "tomizing", "orange");
  setRO("r6", "Jadvalda <i>σ</i>", u(fmt(s * 1000, 1), "mN/m"), `${Lq.name}, 20 °C`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "film") { t = `F = ${fmt(P.filmForce(sigma(), film.L) * 1000, 2)} mN`; tone = "purple"; }
  else if (ui.mode === "cap") { const h = P.capillaryH(sigma(), L().rho, cap.r, L().theta); t = h >= 0 ? "Suyuqlik ko‘tariladi" : "Suyuqlik pasayadi"; tone = h >= 0 ? "green" : "orange"; }
  else { t = drops.N >= N_MAX ? `Tajriba tugadi: ${N_MAX} tomchi` : drops.open ? "Tomizilmoqda" : "Jo‘mrakni oching"; tone = drops.N >= N_MAX ? "green" : drops.open ? "orange" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "film") {
    p.push("<p>Suyuqlik ichidagi molekulani qo‘shnilari har tomondan bir xil tortadi, sirtdagisini esa faqat ichkariga. Shuning uchun suyuqlik sirti tortilgan parda kabi qisqarishga intiladi — <b>sirt tarangligi</b>. Sirt chegarasining har metriga ta’sir qiluvchi kuch — sirt taranglik koeffitsiyenti σ.</p>");
    p.push("<p>Sovun pardasining ikki sirti bor, shuning uchun to‘sinni tortuvchi kuch F = 2σL. Parda cho‘zilganda kuch o‘zgarmaydi; bajarilgan ish sirt energiyasining ortishiga ketadi: A = σΔS. Temperatura ortsa σ kamayadi — issiq suv kirni yaxshiroq yuvadi.</p>");
  } else if (ui.mode === "cap") {
    const Lq = L();
    p.push(P.wets(Lq.theta) ? `<p>${Lq.name} shishani <b>ho‘llaydi</b>: suyuqlik molekulalarini shisha molekulalari o‘zaro tortilishidan kuchliroq tortadi. Ingichka nayda sirt botiq bo‘ladi va sirt taranglik kuchi suyuqlik ustunini yuqoriga tortadi — <b>kapillyar ko‘tarilish</b>: h = 2σcosθ/(ρgr).</p>` : "<p>Simob shishani <b>ho‘llamaydi</b> (θ ≈ 140°): sirt qavariq bo‘ladi va sirt taranglik kuchi ustunni pastga itaradi — nayda simob sathi idishdagidan past.</p>");
    p.push("<p>Kapillyar hodisalar: o‘simlik tanasida suv va oziq moddalarning ko‘tarilishi, sochiq va qog‘ozning suvni shimishi, chiroq piligi, tuproqda namlik harakati.</p>");
  } else {
    p.push("<p>Naycha uchida tomchi o‘sib boradi. Uni sirt taranglik kuchi ushlab turadi: F = σ·πd (naycha aylanasi bo‘yicha). Tomchi og‘irligi shu kuchdan oshganda u uziladi: <b>mg = πdσ</b>. N ta tomchi massasini tortib, σ = Mg/(πdN) topiladi — darslikdagi laboratoriya ishining usuli.</p>");
    p.push("<p>Spirt kabi σ kichik suyuqliklar mayda tomchilar hosil qiladi; tomchilar ko‘p sanalsa — tarozining 1 mg xatoligi nisbatan kamayadi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() { const html = ui.mode === "film" ? "<small>Parda</small> F = 2σL, A = σΔS" : ui.mode === "cap" ? "<small>Kapillyarlik</small> h = 2σcosθ/(ρgr)" : "<small>Tomchilar usuli</small> σ = Mg/(πdN)"; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt (tomchilar) */

let uiTimer = 0;
function addDrop() { drops.N++; drops.M += P.dropMass(sigma(), drops.d); drops.pts.push({ N: drops.N, M: balanceMg(drops.M) }); }
const loop = createLoop((dt) => {
  if (ui.mode !== "drops") { loop.stop(); return; }
  if (!(dt > 0)) return;
  if (drops.open && drops.N < N_MAX) { drops.grow += dt * 1.6 * ui.speed; if (drops.grow >= 1) { drops.grow = 0; drops.falling.push({ y: geo.dropsTop || 0, v: 0 }); } }
  for (const f of drops.falling) { f.v += 900 * dt; f.y += f.v * dt; }
  const landed = drops.falling.filter((f) => f.y >= (geo.dropsBot || 1e9)); drops.falling = drops.falling.filter((f) => f.y < (geo.dropsBot || 1e9));
  landed.forEach(addDrop);
  if (drops.N >= N_MAX && !drops.falling.length) { drops.open = false; drops.grow = 0; }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; refresh(); }
  if (!drops.open && !drops.falling.length) { loop.stop(); refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.hidden = ui.mode !== "drops";
  playBtn.setAttribute("aria-pressed", String(drops.open));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(drops.open ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = drops.open ? "Yopish" : "Tomizish";
}
function toggleCock() {
  if (drops.N >= N_MAX) resetDrops();
  drops.open = !drops.open; customized();
  if (drops.open && prefersReducedMotion()) { while (drops.N < N_MAX) addDrop(); drops.open = false; }
  else if (drops.open) loop.start();
  setPlayUI(loop.running); refresh();
}
playBtn.addEventListener("click", toggleCock);
function resetDrops() { drops.N = 0; drops.M = 0; drops.grow = 0; drops.falling = []; drops.pts = [{ N: 0, M: 0 }]; drops.open = false; }
$("[data-reset]").addEventListener("click", () => { if (ui.mode === "drops") { loop.stop(); resetDrops(); setPlayUI(false); } else if (ui.mode === "film") { film.x0 = film.x; } refresh(); });
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));

/* ------------------------------------------------------------------ Boshqaruv */

const liqSel = $("#liq");
const liqList = () => (ui.mode === "film" ? ["soap", "water", "alcohol", "glycerin"] : ui.mode === "cap" ? Object.keys(P.LIQUIDS) : ["water", "alcohol", "glycerin", "kerosene", "soap"]);
function fillLiq() { liqSel.innerHTML = liqList().map((k) => `<option value="${k}">${P.LIQUIDS[k].name} (σ = ${fmt(P.LIQUIDS[k].sigma * 1000, 1)} mN/m)</option>`).join(""); if (!liqList().includes(st.liq)) st.liq = liqList()[0]; liqSel.value = st.liq; }
liqSel.addEventListener("change", () => { st.liq = liqSel.value; customized(); if (ui.mode === "drops") { loop.stop(); resetDrops(); setPlayUI(false); } refresh(); });
const tC = bindRange($("#temp"), $("#tempOut"), (v) => `${fmt(v, 0)} °C`, (v) => { st.t = v; customized(); refresh(); });
const fLC = bindRange($("#fL"), $("#fLOut"), (v) => `${fmt(v, 1)} cm`, (v) => { film.L = v / 100; customized(); refresh(); });
const fXC = bindRange($("#fX"), $("#fXOut"), (v) => `${fmt(v, 1)} cm`, (v) => { film.x = v / 100; customized(); refresh(); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v, 2)} mm`, (v) => { cap.r = v / 1000; customized(); refresh(); });
const dDC = bindRange($("#dD"), $("#dDOut"), (v) => `${fmt(v, 1)} mm`, (v) => { drops.d = v / 1000; customized(); loop.stop(); resetDrops(); setPlayUI(false); refresh(); });

/* Sahnada surish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function hit(p) {
  if (ui.mode === "film") { const b = geo.bar; if ((b && Math.abs(p.x - b.x) <= 10 && p.y >= b.y0 && p.y <= b.y1) || (geo.handle && Math.hypot(p.x - geo.handle.x, p.y - geo.handle.y) <= geo.handle.r)) return { kind: "bar", off: p.x - geo.bar.x }; }
  else if (ui.mode === "cap") { const g = geo.capHandle; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= g.r) return { kind: "cap", x0: p.x, r0: cap.r }; }
  else { const g = geo.cock; if (g && p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) return { kind: "cock" }; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  e.preventDefault(); customized();
  if (h.kind === "cock") { toggleCock(); return; }
  if (h.kind === "bar") film.x0 = film.x;
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true";
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "cock" ? "pointer" : "ew-resize"; return; }
  if (drag.kind === "bar") { const b = geo.bar; film.x = clamp(Math.round(((p.x - drag.off - b.x0) / b.k) * 1000) / 1000, 0.01, 0.09); fXC.set(film.x * 100); }
  else if (drag.kind === "cap") { cap.r = clamp(Math.round((drag.r0 * 1000 + (p.x - drag.x0) * 0.01) * 20) / 20 / 1000, 0.1e-3, 2e-3); cRC.set(cap.r * 1000); } // 1 px = 0,01 mm
  refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? ((p.x - r.x) / r.w) * f.xMax : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  soapFrame: { mode: "film", title: "Sovun pardasi va ramka", lesson: "To‘sinni o‘ngga suring: parda cho‘ziladi, lekin dinamometr ko‘rsatishi o‘zgarmaydi — F = 2σL = 4 mN. Bo‘yalgan yuza (grafik) — bajarilgan ish.", set: () => { Object.assign(st, { liq: "soap", t: 20 }); Object.assign(film, { L: 0.05, x: 0.06, x0: 0.03 }); } },
  longBar: { mode: "film", title: "Uzun to‘sin: kuch ortadi", lesson: "To‘sin 2 marta uzun (8 cm) — sirt chegarasi uzun, kuch ham 2 marta katta: F ∝ L.", set: () => { Object.assign(st, { liq: "soap", t: 20 }); Object.assign(film, { L: 0.08, x: 0.05, x0: 0.05 }); } },
  hotFilm: { mode: "film", title: "Iliq sovunli suv", lesson: "70 °C da sovunli suvning σ si kamaygan — parda to‘sinni kuchsizroq tortadi. Temperaturani o‘zgartirib kuzating.", set: () => { Object.assign(st, { liq: "soap", t: 70 }); Object.assign(film, { L: 0.05, x: 0.05, x0: 0.05 }); } },
  capWater: { mode: "cap", title: "Suv kapillyar naylarda", lesson: "Suv shishani ho‘llaydi — barcha naylarda ko‘tariladi; 0,25 mm li nayda 59 mm, 1 mm li nayda atigi 15 mm: h ∝ 1/r. O‘ngdagi nay radiusini sahnada o‘zgartiring.", set: () => { Object.assign(st, { liq: "water", t: 20 }); cap.r = 0.5e-3; } },
  capAlcohol: { mode: "cap", title: "Spirt pastroq ko‘tariladi", lesson: "Spirtning σ si suvnikidan 3,3 marta kichik, zichligi ham kichik — u suvdan ≈ 2,6 marta past ko‘tariladi.", set: () => { Object.assign(st, { liq: "alcohol", t: 20 }); cap.r = 0.5e-3; } },
  capMercury: { mode: "cap", title: "Simob: ho‘llamaslik", lesson: "Simob shishani ho‘llamaydi: menisk qavariq, nayda sath pasayadi. Tomchi plastinkada sharsimon yig‘iladi.", set: () => { Object.assign(st, { liq: "mercury", t: 20 }); cap.r = 0.5e-3; } },
  capThin: { mode: "cap", title: "Juda ingichka nay: o‘simliklar", lesson: "Radiusi 0,1 mm nayda suv 15 cm ga ko‘tariladi (sahnada sig‘magani uchun kesib ko‘rsatilgan). O‘simlik tomirlari bundan ham ingichka.", set: () => { Object.assign(st, { liq: "water", t: 20 }); cap.r = 0.1e-3; } },
  drops: { mode: "drops", title: "Suv: tomchilar usuli", lesson: "Jo‘mrakni oching: 60 ta tomchi sanalib, massasi tortiladi. σ = Mg/(πdN) ni jadvaldagi 72,8 mN/m bilan solishtiring. Bu — darslikdagi «Sirt taranglik koeffitsiyentini aniqlash» laboratoriya ishining usuli.", set: () => { Object.assign(st, { liq: "water" }); drops.d = 2e-3; resetDrops(); } },
  dropsAlcohol: { mode: "drops", title: "Spirt tomchilari", lesson: "Spirt tomchilari suvnikidan 3,3 marta yengil — σ kichik.", set: () => { Object.assign(st, { liq: "alcohol" }); drops.d = 2e-3; resetDrops(); } },
  dropsTip: { mode: "drops", title: "Keng naycha: katta tomchilar", lesson: "Naycha uchi diametri 3,5 mm: tomchi og‘irroq bo‘lgandagina uziladi (m ∝ d), σ esa o‘sha natijani beradi.", set: () => { Object.assign(st, { liq: "water" }); drops.d = 3.5e-3; resetDrops(); } },
};
const GROUPS = [["Sirt tarangligi", ["soapFrame", "longBar", "hotFilm"]], ["Ho‘llash va kapillyarlik", ["capWater", "capAlcohol", "capMercury", "capThin"]], ["Tomchilar usuli", ["drops", "dropsAlcohol", "dropsTip"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { film: "To‘sinni suring", cap: "O‘ngdagi nay tutqichini suring", drops: "Jo‘mrakni bosing" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { film: "Sovun pardali ramka va dinamometr", cap: "Suyuqlikka tushirilgan kapillyar naylar va plastinkadagi tomchi", drops: "Byuretka, tomchilar va tarozidagi stakan" }[ui.mode]);
}
const MODE_DEFAULT = { film: "soapFrame", cap: "capWater", drops: "drops" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  loop.stop(); drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  fillLiq(); tC.set(st.t); fLC.set(film.L * 100); fXC.set(film.x * 100); cRC.set(cap.r * 1000); dDC.set(drops.d * 1000);
  setTab(); setPlayUI(false); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "soapFrame");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
