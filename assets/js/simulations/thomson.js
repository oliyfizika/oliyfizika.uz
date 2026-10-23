// ==========================================================================
// Elektronning solishtirma zaryadi e/m — virtual laboratoriya (simulations/thomson-em.html)
// Ingichka dastali naycha (siyraklangan vodorod) Helmgols g‘altaklari orasida: tezlatuvchi kuchlanish U,
// g‘altak toki I, tok yo‘nalishi va qurilmaning holati (0° / 180° — Yer maydonini kompensatsiyalash uchun).
// Dasta aylanasi nuqtali belgilar (diametr 4, 6, 8, 10 sm) dan o‘tadigan tok topiladi; lupa — aniq moslash uchun.
// Daftar: labnotebook.js; hisobot: thomson-report.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { createStage, createLoop, prefersReducedMotion } from "./sim-kit.js";
import { TAU, SMALL, MID, BOLD, circle, tagIn, chipBtn, knob, lcd, chipGrid, readouts, u, clamp, fmt } from "./labkit.js";
import * as P from "./thomson-physics.js";
import * as L from "./thomson-lab.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { buildThomsonDoc, SITE, DOC_LABEL } from "./thomson-report.js";

const $ = (s) => document.querySelector(s);
const st = { U: 200, I: 1.2, dir: 1, o: 1, t: 0 };
const geo = {};
let presetId = null;
const B = () => P.Bof(st.I, st.dir, st.o);
const setU = (v) => { st.U = clamp(Math.round(v), P.U_RANGE[0], P.U_RANGE[1]); };
const setI = (v) => { st.I = clamp(Math.round(v * 1000) / 1000, 0, P.I_MAX); };

/* ------------------------------------------------------------------ Sahna */
function drawTube(ctx, c, cx, cy, sc, dark) {
  const S = (x, y) => [cx + st.o * x * sc, cy - y * sc]; // qurilma 180° burilganda ko‘rinish ko‘zguli
  // tagkursi
  ctx.fillStyle = dark ? "#334155" : "#94a3b8"; ctx.fillRect(cx - 0.17 * sc, cy + 0.175 * sc, 0.34 * sc, 0.012 * sc);
  ctx.fillRect(cx - 0.006 * sc, cy + 0.09 * sc, 0.012 * sc, 0.09 * sc);
  // orqa g‘altak (siljigan) va old g‘altak
  const coil = (dx, dy, al) => {
    ctx.save(); ctx.globalAlpha = al; ctx.lineWidth = 0.022 * sc; ctx.strokeStyle = "#b45309"; circle(ctx, cx + dx, cy + dy, P.R * sc); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,237,213,0.35)"; for (let k = -2; k <= 2; k++) { circle(ctx, cx + dx, cy + dy, P.R * sc + k * 0.0042 * sc); ctx.stroke(); } ctx.restore();
  };
  coil(10, -6, 0.55);
  [-1, 1].forEach((s) => { ctx.fillStyle = dark ? "#475569" : "#64748b"; ctx.fillRect(cx + s * P.R * sc - 0.006 * sc, cy, 0.012 * sc, 0.185 * sc); });
  coil(0, 0, 1);
  // tok yo‘nalishi strelkalari
  ctx.fillStyle = "#fde68a"; for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.6, sgn = st.dir * st.o, x = cx + Math.cos(a) * P.R * sc, y = cy + Math.sin(a) * P.R * sc, t = a + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2); ctx.save(); ctx.translate(x, y); ctx.rotate(t); ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -4.5); ctx.lineTo(-4, 4.5); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // shisha shar
  const g = ctx.createRadialGradient(cx - 0.03 * sc, cy - 0.035 * sc, 0.01 * sc, cx, cy, P.RB * sc);
  g.addColorStop(0, dark ? "rgba(148,163,184,0.16)" : "rgba(226,232,240,0.55)"); g.addColorStop(1, dark ? "rgba(30,41,59,0.55)" : "rgba(148,163,184,0.35)");
  ctx.fillStyle = "#0b1020"; circle(ctx, cx, cy, P.RB * sc); ctx.fill(); ctx.fillStyle = g; circle(ctx, cx, cy, P.RB * sc); ctx.fill();
  ctx.strokeStyle = "rgba(203,213,225,0.7)"; ctx.lineWidth = 1.5; circle(ctx, cx, cy, P.RB * sc); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, P.RB * sc - 6, -2.5, -1.9); ctx.stroke();
  // bo‘yin va elektron to‘pi
  ctx.fillStyle = "rgba(148,163,184,0.35)"; ctx.fillRect(cx - 0.012 * sc, cy + 0.08 * sc, 0.024 * sc, 0.03 * sc);
  const [gx, gy] = S(0, P.GY);
  ctx.fillStyle = "#64748b"; ctx.fillRect(Math.min(gx, gx - st.o * 0.024 * sc), gy - 0.006 * sc, 0.024 * sc, 0.012 * sc);
  const [kx] = S(-0.022, 0); ctx.fillStyle = "#fb923c"; ctx.shadowColor = "#fb923c"; ctx.shadowBlur = 10; circle(ctx, kx, gy, 0.003 * sc); ctx.fill(); ctx.shadowBlur = 0;
  // belgilar narvoni
  ctx.strokeStyle = "rgba(203,213,225,0.55)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(...S(0, P.GY + 0.008)); ctx.lineTo(...S(0, P.GY + 0.104)); ctx.stroke();
  P.MARKS.forEach((r) => { const [x, y] = S(0, P.GY + 2 * r); ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 0.004 * sc, y); ctx.lineTo(x + 0.004 * sc, y); ctx.stroke(); ctx.fillStyle = "#a5f3fc"; circle(ctx, x, y, 1.8); ctx.fill(); ctx.fillStyle = "#cbd5e1"; ctx.font = SMALL; ctx.textAlign = st.o > 0 ? "right" : "left"; ctx.textBaseline = "middle"; ctx.fillText(`${Math.round(r * 200)}`, x - st.o * 0.007 * sc, y); });
  // dasta
  const b = st.U > P.DU + 5 && st.I >= 0 ? P.beam(st.U, B()) : null;
  if (b && b.pts.length > 1) {
    const br = clamp((st.U - 80) / 220, 0.35, 1);
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    [[7, 0.18], [3.5, 0.45], [1.6, 1]].forEach(([w, a]) => { ctx.strokeStyle = `rgba(103,232,249,${a * br})`; ctx.lineWidth = w; ctx.beginPath(); b.pts.forEach(([x, y], i) => { const [X, Y] = S(x, y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); });
    if (b.hit) { const [X, Y] = S(...b.pts.at(-1)); ctx.fillStyle = "rgba(190,242,100,0.9)"; ctx.shadowColor = "#bef264"; ctx.shadowBlur = 12; circle(ctx, X, Y, 3); ctx.fill(); }
    ctx.restore();
  }
  // maydon belgisi
  const Bz = B(), sy = Bz * st.o; // ekranga nisbatan yo‘nalish
  ctx.fillStyle = "#e2e8f0"; ctx.font = BOLD; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const bx = cx - 0.07 * sc, by = cy - 0.045 * sc; ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1.4; circle(ctx, bx, by, 6); ctx.stroke();
  if (sy >= 0) { circle(ctx, bx, by, 1.8); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(bx - 4, by - 4); ctx.lineTo(bx + 4, by + 4); ctx.moveTo(bx + 4, by - 4); ctx.lineTo(bx - 4, by + 4); ctx.stroke(); }
  ctx.fillText("B", bx + 10, by);
  return b;
}
function lupa(ctx, c, x, y, r, b) {
  const top = b && !b.hit ? P.GY + 2 * b.r : null, mark = top === null ? P.MARKS[2] : P.MARKS.reduce((m, q) => (Math.abs(P.GY + 2 * q - top) < Math.abs(P.GY + 2 * m - top) ? q : m), P.MARKS[0]);
  const yc = P.GY + 2 * mark, Z = r / 0.004; // ±4 mm
  ctx.save(); ctx.fillStyle = "#020617"; circle(ctx, x, y, r); ctx.fill(); ctx.clip();
  ctx.strokeStyle = "rgba(203,213,225,0.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - r * 0.9, y); ctx.lineTo(x + r * 0.9, y); ctx.stroke(); ctx.fillStyle = "#a5f3fc"; circle(ctx, x, y, 4); ctx.fill();
  if (b && b.pts.length > 1) {
    ctx.lineCap = "round"; [[16, 0.18], [8, 0.45], [3.5, 1]].forEach(([w, a]) => { ctx.strokeStyle = `rgba(103,232,249,${a})`; ctx.lineWidth = w; ctx.beginPath(); let pen = false; b.pts.forEach(([px, py]) => { const X = x + st.o * px * Z, Y = y - (py - yc) * Z; if (Math.abs(X - x) > 2 * r || Math.abs(Y - y) > 2 * r) { pen = false; return; } pen ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); pen = true; }); ctx.stroke(); });
  }
  ctx.restore(); ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 3; circle(ctx, x, y, r); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textBaseline = "top"; const lt = `lupa ±4 mm · d = ${Math.round(mark * 200)} sm`, tw = ctx.measureText(lt).width; ctx.textAlign = "left"; ctx.fillText(lt, Math.max(4, x - tw / 2), y + r + 4);
}
function draw(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, cw, ch);
  geo.chips = [];
  const area = narrow ? cw - 16 : Math.min(cw * 0.56, ch - 16), sc = area / 0.37, cx = narrow ? cw / 2 : 8 + area / 2, cy = narrow ? 8 + area * 0.47 : ch / 2 - 0.005 * sc;
  const b = drawTube(ctx, c, cx, cy, sc, c.dark);
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(st.o > 0 ? "qurilma: 0°" : "qurilma: 180° burilgan", 8, 6);
  if (b?.hit) tagIn(ctx, st.dir < 0 ? "Dasta shishaga urilmoqda — tok yo‘nalishini o‘zgartiring" : "Dasta shishaga urilmoqda — tokni oshiring", cx, cy + P.RB * sc + 8, cw, { color: c.danger, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  if (narrow) {
    const y0 = 8 + area * 0.97, r = 44;
    lupa(ctx, c, 8 + r, y0 + r, r, b);
    const lx = 8 + 2 * r + 10, lw = cw - lx - 8;
    lcd(ctx, lx, y0, lw, 44, "U, V", fmt(st.U, 0), "V", "#60a5fa"); lcd(ctx, lx, y0 + 50, lw, 44, "I, A", fmt(st.I, 3), "A");
    const y1 = y0 + 2 * r + 22;
    geo.chips.push(...chipGrid(ctx, c, 8, y1, cw - 16, [["U −10", -10], ["−1", -1], ["+1", 1], ["U +10", 10]], 4, 26).map((q) => ({ ...q, k: "dU" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y1 + 30, cw - 16, [["I −0,1", -0.1], ["−0,01", -0.01], ["−0,001", -0.001], ["+0,001", 0.001], ["+0,01", 0.01], ["I +0,1", 0.1]], 6, 26).map((q) => ({ ...q, k: "dI" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y1 + 60, cw - 16, [[st.dir > 0 ? "Tok: to‘g‘ri" : "Tok: teskari", "dir"], [st.o > 0 ? "Qurilma: 0°" : "Qurilma: 180°", "rot"]], 2, 26).map((q) => ({ ...q, k: "tog" })));
    return;
  }
  const rx = 8 + area + 16, rw = cw - rx - 10;
  lcd(ctx, rx, 10, rw / 2 - 3, 50, "VOLTMETR · U", fmt(st.U, 0), "V", "#60a5fa");
  lcd(ctx, rx + rw / 2 + 3, 10, rw / 2 - 3, 50, "AMPERMETR · I", fmt(st.I, 3), "A");
  const lr = Math.min(58, (ch - 250) / 2), lx = rx + lr + 2; lupa(ctx, c, lx, 72 + lr, lr, b);
  const kx = lx + lr + 34, kw = rx + rw - kx;
  knob(ctx, c, kx, 92, 18, (st.U - 100) / 200, "U"); geo.knobU = { x: kx, y: 92, r: 28 };
  knob(ctx, c, kx, 152, 18, st.I / P.I_MAX, "I"); geo.knobI = { x: kx, y: 152, r: 28 };
  geo.chips.push(...chipGrid(ctx, c, kx + 28, 72, kw - 28, [["+10", 10], ["+1", 1], ["−10", -10], ["−1", -1]], 2, 20, 3).map((q) => ({ ...q, k: "dU" })));
  geo.chips.push(...chipGrid(ctx, c, kx + 28, 124, kw - 28, [["+0,1", 0.1], ["+0,01", 0.01], ["+0,001", 0.001], ["−0,1", -0.1], ["−0,01", -0.01], ["−0,001", -0.001]], 3, 20, 3).map((q) => ({ ...q, k: "dI" })));
  const ty = Math.max(72 + 2 * lr + 24, 196);
  geo.chips.push(...chipGrid(ctx, c, rx, ty, rw, [[st.dir > 0 ? "Tok yo‘nalishi: to‘g‘ri" : "Tok yo‘nalishi: teskari", "dir"], [st.o > 0 ? "Qurilma: 0°" : "Qurilma: 180° burilgan", "rot"]], 2, 26, 4, (v) => (v === "dir" ? st.dir < 0 : st.o < 0)).map((q) => ({ ...q, k: "tog" })));
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("Yer maydoni ta’sirini yo‘qotish: har bir belgi uchun", rx, ty + 32); ctx.fillText("tokni 0° va 180° holatlarda o‘lchang.", rx, ty + 45);
}
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? Math.round((cw - 16) * 0.97 + 8 + 88 + 22 + 92) : Math.round(clamp(Math.min(cw * 0.5, (window.innerHeight || 800) * 0.56), 340, 440))) });

/* ------------------------------------------------------------------ Natijalar */
const setRO = readouts($("[data-readouts]"));
function updateReadouts() {
  const Bz = B(), r = P.rOf(st.U, Bz);
  setRO("r1", "Tezlatuvchi kuchlanish <i>U</i>", u(fmt(st.U, 0), "V"), "anod–katod");
  setRO("r2", "G‘altak toki <i>I</i>", u(fmt(st.I, 3), "A"), st.dir > 0 ? "to‘g‘ri yo‘nalish" : "teskari yo‘nalish");
  setRO("r3", "G‘altak maydoni <i>B</i> = <i>kI</i>", u(fmt(P.KB * st.I * 1000, 3), "mT"), `k = ${fmt(P.KB * 1000, 4)} mT/A`);
  setRO("r4", "Elektron energiyasi", u(fmt(st.U, 0), "eV"), "eU");
  setRO("r5", "Yer maydoni (o‘q bo‘ylab)", u(fmt(P.BY * 1e6, 0), "μT"), st.o > 0 ? "g‘altak maydoniga qarshi" : "g‘altak maydoni bilan bir yo‘nalishda");
  setRO("r6", "Dasta", Number.isFinite(r) && r < 0.08 && st.dir > 0 ? "aylana" : "shishaga uriladi", Number.isFinite(r) ? `d ≈ ${fmt(2 * r * 100, 1)} sm (taxminiy)` : "B ≈ 0", Number.isFinite(r) && r < 0.08 && st.dir > 0 ? "" : "red");
}
function updateStatus() { const el = $("[data-status]"), t = `B = ${fmt(Math.abs(B()) * 1000, 3)} mT`; if (el.textContent !== t) el.textContent = t; el.dataset.tone = "blue"; }
let lastEx = "";
function updateExplain() {
  const html = `<p>Qizdirilgan katoddan chiqqan elektronlar U kuchlanish bilan tezlashtiriladi (eU = mv²/2) va siyraklangan vodorodli sharda ingichka yorug‘ dasta hosil qiladi. Helmgols g‘altaklarining bir jinsli maydoni dastani aylanaga egadi: evB = mv²/r.</p><p>Shundan <b>e/m = 2U/(B²r²)</b>. Tokni shunday tanlangki, aylana belgi orqali o‘tsin (lupa bilan tekshiring). Yer maydoni g‘altak maydoniga qo‘shiladi — qurilmani 180° burib qayta o‘lchang va o‘rtacha tokni oling.${st.dir < 0 ? " Hozir tok teskari: Lorens kuchi dastani pastga egadi." : ""}</p>`;
  if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() { actBtn.textContent = "Qurilmani 180° burish"; resetBtn.textContent = "Tok yo‘nalishini almashtirish"; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateAction(); syncUI(); stage.render(); }
$("[data-formula]").innerHTML = "<small>Tomson</small> e/m = 2U/(B²r²)";
$("[data-graph-card]").hidden = true;

/* ------------------------------------------------------------------ Vaqt (faqat jonli ko‘rinish) */
const loop = createLoop((dt) => { if (!(dt > 0)) return; st.t += dt; }, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.hidden = true;
actBtn.addEventListener("click", () => { st.o = -st.o; customized(); refresh(); });
resetBtn.addEventListener("click", () => { st.dir = -st.dir; customized(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */
const uIn = $("#pUa"), uOut = $("#pUaOut"), iIn = $("#pI"), iOut = $("#pIOut");
uIn.addEventListener("input", () => { setU(+uIn.value); customized(); refresh(); });
iIn.addEventListener("input", () => { setI(+iIn.value); customized(); refresh(); });
function syncUI() { if (+uIn.value !== st.U) uIn.value = st.U; uOut.textContent = `${st.U} V`; if (+iIn.value !== st.I) iIn.value = st.I; iOut.textContent = `${fmt(st.I, 3)} A`; }
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, q) => q && p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1;
function hit(p) {
  for (const ch of geo.chips || []) if (inBox(p, ch)) return { k: "chip", ch };
  for (const [k, g] of [["U", geo.knobU], ["I", geo.knobI]]) if (g && Math.hypot(p.x - g.x, p.y - g.y) <= g.r) return { k };
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hit(p); if (!h) return;
  if (h.k === "chip") { const q = h.ch; if (q.k === "dU") setU(st.U + q.v); else if (q.k === "dI") setI(st.I + q.v); else if (q.v === "dir") st.dir = -st.dir; else st.o = -st.o; customized(); refresh(); return; }
  drag = h.k; dragY0 = p.y; dragV0 = h.k === "U" ? st.U : st.I; canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(e);
  if (!drag) { const h = hit(p); canvas.style.cursor = h ? (h.k === "chip" ? "pointer" : "ns-resize") : ""; return; }
  if (drag === "U") setU(dragV0 + (dragY0 - p.y) * 1); else setI(dragV0 + (dragY0 - p.y) * 0.01);
  customized(); refresh();
});
const end = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

/* ------------------------------------------------------------------ Tayyor tajribalar */
const PRESETS = {
  base: { title: "U = 200 V, aylana", lesson: "Tokni o‘zgartirib, dasta aylanasini d = 8 sm belgisiga keltiring (lupada dasta belgining markazidan o‘tsin). U, I va r = 4 sm ni jadvalga yozing.", set: () => Object.assign(st, { U: 200, I: 1.40, dir: 1, o: 1 }) },
  rot: { title: "Yer maydoni: 180° burish", lesson: "Qurilma 180° burilganda Yer maydoni g‘altak maydoniga qo‘shiladi — o‘sha belgi uchun kamroq tok kerak. Ikkala tokning o‘rtachasi Yer maydoni ta’sirini yo‘qotadi.", set: () => Object.assign(st, { U: 200, I: 1.52, dir: 1, o: -1 }) },
  rev: { title: "Tok teskari: Lorens kuchi", lesson: "G‘altakdagi tok yo‘nalishi o‘zgarsa, B ham teskari bo‘ladi va dasta pastga egiladi — shishaga uriladi (F = −e·v×B).", set: () => Object.assign(st, { U: 200, I: 1.5, dir: -1, o: 1 }) },
  big: { title: "U = 300 V, kichik B", lesson: "Kuchlanish katta, maydon kichik — radius katta: dasta shar devoriga yetadi. Tokni oshirib, eng katta belgiga (10 sm) keltiring.", set: () => Object.assign(st, { U: 300, I: 1.2, dir: 1, o: 1 }) },
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.entries(PRESETS).map(([id, p]) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${p.title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPP = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPP(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id) {
  const p = PRESETS[id]; p.set(); presetId = id; setPP(id); $("[data-lesson]").textContent = p.lesson; $("[data-mode-hint]").textContent = "U va I ni dastaklar yoki tugmalar bilan o‘zgartiring";
  refresh(); if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* */ }
}

/* ------------------------------------------------------------------ Laboratoriya daftari */
const rOpts = [["", "—"], ...P.MARKS.map((r) => [r, `${fmt(r * 100, 0)} sm (d = ${fmt(r * 200, 0)})`])];
const sci11 = (v) => `${fmt(v / 1e11, 3)}·10¹¹ C/kg`;
createNotebook($("[data-notebook]"), {
  key: "thomson", docLabel: DOC_LABEL, site: SITE,
  intro: "Har bir o‘lchashda dasta aylanasini belgiga keltiring va tokni yozing; Yer maydonini yo‘qotish uchun qurilmani 180° burib, tokni qayta o‘lchang. Hisoblashlar avtomatik bajariladi.",
  conclusionPh: "e/m ning qiymati va jadval qiymatidan farqi; Yer maydonini kompensatsiyalash natijaga qanday ta’sir qildi; elektron massasi.",
  hint: "Javob bering: 1) e/m ning o‘rtacha qiymati va uning xatoligi. 2) Faqat I₁ bo‘yicha hisoblangan e/m bilan solishtiring — farq nimadan? 3) U ning (Br)²/2 ga bog‘liqligi to‘g‘ri chiziqmi? 4) e = 1,602·10⁻¹⁹ C ma’lum bo‘lsa, elektron massasi qancha?",
  fileBase: (nb) => `Tomson-em-lab-${translit(nb.f.name)}`,
  minTables: 1,
  tables: [
    { key: "t1", okLabel: "e/m", need: "kamida 4 ta qator (2 xil U va 2 xil r)", title: "1-topshiriq. Elektronning solishtirma zaryadini aniqlash",
      desc: "Turli U va belgilar uchun dasta belgidan o‘tadigan tokni yozing: I₁ — qurilma 0° holatda, I₂ — 180° burilgan holatda (ixtiyoriy, lekin tavsiya etiladi). Kamida 4 ta o‘lchash (2 xil U, 2 xil r).",
      head: ["U, V", "r, sm", "I₁ (0°), A", "I₂ (180°), A", "Ī, A", "B, mT", "e/m, 10¹¹ C/kg", "Tekshiruv"],
      cols: [{ k: "U", kind: "num" }, { k: "r", kind: "sel", opts: rOpts }, { k: "Ip", kind: "num" }, { k: "Im", kind: "num" }], outs: ["I", "B", "em"],
      blank: (i) => ({ U: ["200", "200", "250", "250", "300", "300"][i] ?? "", r: String([0.04, 0.05, 0.04, 0.05, 0.04, 0.05][i] ?? ""), Ip: "", Im: "" }), rows: 4, max: 12,
      parse: (r) => ({ U: num(r.U), r: +r.r, Ip: num(r.Ip), Im: num(r.Im) }), check: L.check, analyze: (rows) => L.analyze(rows),
      out: (A, j) => { const r = A.rows[j]; return { I: fmt(r.I, 3), B: fmt(r.B * 1000, 3), em: fmt(r.em / 1e11, 3) }; },
      match: (r) => L.match(r), noMatch: "Bu tokda dasta belgidan o‘tmaydi (±0,015 A)",
      summary: (A) => A.rows.length ? [["e/m (o‘rtacha)", sci11(A.m), `± ${fmt(A.se / 1e11, 3)} · farq ${fmt((100 * (A.m - P.EM)) / P.EM, 1)}%`], ...(A.fit ? [["U = (e/m)(Br)²/2", sci11(A.emFit), `m = ${fmt(A.me / 1e-31, 2)}·10⁻³¹ kg`]] : []), ...(A.nBoth < A.rows.length ? [["Kompensatsiya", `${A.nBoth}/${A.rows.length} qator`, "I₂ siz Yer maydoni xatosi qoladi"]] : [["Faqat I₁ bo‘yicha", sci11(A.mp), "Yer maydoni ta’siri"]])] : null,
      ok: (A) => A.ok },
  ],
  build: (nb, res) => buildThomsonDoc(nb, res),
});

/* ------------------------------------------------------------------ Ishga tushirish */
setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "base");
document.fonts?.ready.then(() => stage.render());
