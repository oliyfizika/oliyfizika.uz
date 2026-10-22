// ==========================================================================
// Milliken tajribasi — virtual laboratoriya (simulations/millikan.html)
// Mikroskop ko‘rish maydoni: yoritilgan moy tomchilari (Broun harakati bilan), o‘lchov chiziqlari A va B (s = 0,5 mm).
// Kondensator: kuchlanish U (0…600 V), maydon yo‘nalishi ↑ / o‘chiq / ↓; purkagich (yangi tomchilar),
// ionlash (tomchilar zaryadi o‘zgaradi); sekundomer (Probel tugmasi ham), vaqt tezligi ×1/×2/×4.
// Daftar: labnotebook.js; hisobot: millikan-report.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { createStage, createLoop, prefersReducedMotion } from "./sim-kit.js";
import { SMALL, MID, BOLD, circle, tagIn, chipBtn, knob, lcd, chipGrid, readouts, u, clamp, fmt } from "./labkit.js";
import * as P from "./millikan-physics.js";
import * as L from "./millikan-lab.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { buildMillikanDoc, SITE, DOC_LABEL } from "./millikan-report.js";

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const KEY = "of-millikan-v1";
const R = P.rng((Date.now() % 100000) + 17);
const saved = store.get(KEY, null);
const st = { U: 400, field: 0, speed: 1, sw: 0, swOn: false, sel: null, t: 0, nextId: saved?.nextId || 1, drops: [], archive: saved?.archive || [] };
const geo = {};
let presetId = null;

function persist() { clearTimeout(persist.t); persist.t = setTimeout(() => store.set(KEY, { nextId: st.nextId, archive: st.archive.slice(-80) }), 300); }
function archiveDrop(d) { const a = st.archive.find((q) => q.id === d.id); if (a) { a.n = d.n; a.hist = d.hist.slice(); } else st.archive.push({ id: d.id, r: d.r, n: d.n, hist: d.hist.slice() }); persist(); }
function spray(k = 7) {
  for (let i = 0; i < k; i++) { const d = P.makeDrop(st.nextId++, R); st.drops.push(d); archiveDrop(d); }
  if (st.drops.length > 14) st.drops.splice(0, st.drops.length - 14);
  if (!st.drops.some((d) => d.id === st.sel)) st.sel = st.drops.at(-1)?.id ?? null;
}
function ionize() { st.drops.forEach((d) => { if (R() < 0.6) { d.hist.push(d.n); d.n = Math.max(1, Math.min(7, d.n + (R() < 0.5 ? -1 : 1) * (R() < 0.75 ? 1 : 2))); archiveDrop(d); } }); }
const selDrop = () => st.drops.find((d) => d.id === st.sel) || null;
const findDrop = (id) => st.drops.find((d) => d.id === id) || st.archive.find((d) => d.id === id) || null;

/* ------------------------------------------------------------------ Sahna */
function microscope(ctx, c, x, y, rad) {
  const Z = rad / P.VIEW; // px / m
  ctx.save(); ctx.fillStyle = "#03050c"; circle(ctx, x, y, rad); ctx.fill(); ctx.clip();
  // fon yorug‘ligi (yon tomondan yoritish)
  const g = ctx.createRadialGradient(x - rad * 0.3, y, rad * 0.1, x, y, rad); g.addColorStop(0, "rgba(30,41,59,0.55)"); g.addColorStop(1, "rgba(2,6,23,0)"); ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  // shkala: 0,1 mm bo‘linmalar
  for (let k = -12; k <= 12; k++) { const yy = y - k * 1e-4 * Z, major = k % 5 === 0; ctx.strokeStyle = major ? "rgba(148,163,184,0.45)" : "rgba(148,163,184,0.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - rad * (major ? 0.95 : 0.12), yy); ctx.lineTo(x + rad * (major ? 0.95 : 0.12), yy); ctx.stroke(); }
  ctx.strokeStyle = "rgba(148,163,184,0.3)"; ctx.beginPath(); ctx.moveTo(x, y - rad); ctx.lineTo(x, y + rad); ctx.stroke();
  // o‘lchov chiziqlari A (yuqori) va B (past)
  const sel = selDrop();
  [["A", P.S_MEAS / 2], ["B", -P.S_MEAS / 2]].forEach(([t, yy]) => { const Y = y - yy * Z, near = sel && Math.abs(sel.y - yy) < 0.012e-3; ctx.strokeStyle = near ? "#fde047" : "#f59e0b"; ctx.lineWidth = near ? 2.5 : 1.6; ctx.beginPath(); ctx.moveTo(x - rad, Y); ctx.lineTo(x + rad, Y); ctx.stroke(); ctx.fillStyle = "#fbbf24"; ctx.font = BOLD; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(t, x - rad * 0.86, Y - 2); });
  ctx.fillStyle = "#fbbf24"; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText("s = 0,5 mm", x + rad * 0.92, y);
  // tomchilar
  geo.drops = [];
  st.drops.forEach((d) => {
    const X = x + d.x * Z, Y = y - d.y * Z; if (Math.hypot(X - x, Y - y) > rad + 6) return;
    const s = 1.4 + (d.r * 1e6 - 0.7) * 2.2, on = d.id === st.sel;
    const gg = ctx.createRadialGradient(X, Y, 0, X, Y, s * 3.2); gg.addColorStop(0, "rgba(255,255,255,0.95)"); gg.addColorStop(0.3, "rgba(254,243,199,0.65)"); gg.addColorStop(1, "rgba(254,243,199,0)");
    ctx.fillStyle = gg; circle(ctx, X, Y, s * 3.2); ctx.fill();
    if (on) { ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1.5; circle(ctx, X, Y, 9); ctx.stroke(); }
    ctx.fillStyle = on ? "#7dd3fc" : "rgba(203,213,225,0.75)"; ctx.font = on ? BOLD : SMALL; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(String(d.id), X + 10, Y - 6);
    geo.drops.push({ id: d.id, x: X, y: Y });
  });
  ctx.restore();
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 4; circle(ctx, x, y, rad); ctx.stroke();
  // maydon ko‘rsatkichi
  const fx0 = x + rad * 0.72, fy0 = y - rad * 0.78;
  ctx.fillStyle = "rgba(15,23,42,0.75)"; ctx.beginPath(); ctx.roundRect(fx0 - 4, fy0 - 12, 64, 24, 6); ctx.fill();
  ctx.fillStyle = st.field ? "#86efac" : "#94a3b8"; ctx.font = BOLD; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(st.field > 0 ? "F ↑" : st.field < 0 ? "F ↓" : "E = 0", fx0 + 2, fy0);
}
function draw(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, cw, ch);
  geo.chips = [];
  if (narrow) {
    const rad = (cw - 16) / 2 * 0.86, mx = cw / 2, my = 8 + rad; microscope(ctx, c, mx, my, rad); geo.mic = { x: mx, y: my, r: rad };
    let y0 = my + rad + 10;
    lcd(ctx, 8, y0, cw / 2 - 12, 46, "KUCHLANISH U", fmt(st.U, 0), "V", "#60a5fa"); lcd(ctx, cw / 2 + 4, y0, cw / 2 - 12, 46, "SEKUNDOMER", fmt(st.sw, 2), "s", st.swOn ? "#4ade80" : "#e2e8f0");
    y0 += 52;
    geo.chips.push(...chipGrid(ctx, c, 8, y0, cw - 16, [[st.swOn ? "■ Stop" : "▶ Start", "sw"], ["↺ Nol", "sw0"], ["◀ tomchi", "prev"], ["tomchi ▶", "next"]], 4, 26, 4, (v) => v === "sw" && st.swOn).map((q) => ({ ...q, k: "act" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 30, cw - 16, [["Maydon ↑", 1], ["O‘chiq", 0], ["Maydon ↓", -1]], 3, 26, 4, (v) => v === st.field).map((q) => ({ ...q, k: "field" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 60, cw - 16, [["U −100", -100], ["−10", -10], ["−1", -1], ["+1", 1], ["+10", 10], ["U +100", 100]], 6, 26).map((q) => ({ ...q, k: "dU" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 90, cw - 16, [["Purkash", "spray"], ["Ionlash", "ion"], [`Tezlik ×${st.speed}`, "spd"]], 3, 26).map((q) => ({ ...q, k: "act" })));
    return;
  }
  const rad = Math.min(ch / 2 - 10, cw * 0.27), mx = 12 + rad + 30, my = ch / 2; microscope(ctx, c, mx, my, rad); geo.mic = { x: mx, y: my, r: rad };
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("mikroskop", 8, 6);
  // kondensator sxemasi (kichik)
  const px = mx + rad + 20, pw = 46, py = my - 60;
  ctx.fillStyle = c.text2; ctx.fillRect(px, py, pw, 5); ctx.fillRect(px, py + 115, pw, 5);
  ctx.fillStyle = c.text2; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  const top = st.field > 0 ? "+" : st.field < 0 ? "−" : "", bot = st.field > 0 ? "−" : st.field < 0 ? "+" : ""; // E: + → − ctx.fillText(top, px + pw / 2, py - 2); ctx.textBaseline = "top"; ctx.fillText(bot, px + pw / 2, py + 122);
  if (st.field) { ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; for (const dx of [12, 34]) { ctx.beginPath(); const y1 = st.field > 0 ? py + 12 : py + 108, y2 = st.field > 0 ? py + 108 : py + 12; ctx.moveTo(px + dx, y1); ctx.lineTo(px + dx, y2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px + dx, y2); ctx.lineTo(px + dx - 4, y2 + (st.field > 0 ? -7 : 7)); ctx.lineTo(px + dx + 4, y2 + (st.field > 0 ? -7 : 7)); ctx.closePath(); ctx.fillStyle = c.primary; ctx.fill(); } }
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`d = ${fmt(P.D_PL * 1000, 0)} mm`, px + pw / 2, py + 136);
  ctx.fillText(st.field ? "E (strelka)" : "", px + pw / 2, py + 150); ctx.fillText(st.field > 0 ? "F ↑ (q < 0)" : st.field < 0 ? "F ↓ (q < 0)" : "", px + pw / 2, py + 162);
  // o‘ng ustun
  const rx = px + pw + 20, rw = cw - rx - 10;
  lcd(ctx, rx, 10, rw / 2 - 3, 50, "KUCHLANISH U", fmt(st.U, 0), "V", "#60a5fa");
  lcd(ctx, rx + rw / 2 + 3, 10, rw / 2 - 3, 50, "SEKUNDOMER", fmt(st.sw, 2), "s", st.swOn ? "#4ade80" : "#e2e8f0");
  geo.chips.push(...chipGrid(ctx, c, rx, 66, rw, [[st.swOn ? "■ Stop (Probel)" : "▶ Start (Probel)", "sw"], ["↺ Nol", "sw0"]], 2, 28, 4, (v) => v === "sw" && st.swOn).map((q) => ({ ...q, k: "act" })));
  knob(ctx, c, rx + 22, 132, 18, st.U / P.U_MAX, "U"); geo.knob = { x: rx + 22, y: 132, r: 28 };
  geo.chips.push(...chipGrid(ctx, c, rx + 52, 104, rw - 52, [["+100", 100], ["+10", 10], ["+1", 1], ["−100", -100], ["−10", -10], ["−1", -1]], 3, 24).map((q) => ({ ...q, k: "dU" })));
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Maydon (kalit)", rx, 178);
  geo.chips.push(...chipGrid(ctx, c, rx, 184, rw, [["↑ ko‘tarish", 1], ["o‘chiq", 0], ["↓", -1]], 3, 26, 4, (v) => v === st.field).map((q) => ({ ...q, k: "field" })));
  ctx.fillText("Tomchi", rx, 228);
  geo.chips.push(...chipGrid(ctx, c, rx, 234, rw, [["◀", "prev"], [st.sel ? `№ ${st.sel}` : "—", "none"], ["▶", "next"]], 3, 24).map((q) => ({ ...q, k: "act" })));
  geo.chips.push(...chipGrid(ctx, c, rx, 266, rw, [["Purkash", "spray"], ["Ionlash", "ion"]], 2, 24).map((q) => ({ ...q, k: "act" })));
  geo.chips.push(...chipGrid(ctx, c, rx, 296, rw, [["×1", 1], ["×2", 2], ["×4", 4]], 3, 22, 4, (v) => v === st.speed).map((q) => ({ ...q, k: "speed" })));
  ctx.fillStyle = c.text3; ctx.fillText("vaqt tezligi (sekundomer — model vaqti)", rx, ch - 8);
}
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? Math.round((cw - 16) * 0.86 + 16 + 10 + 52 + 120) : Math.round(clamp(Math.min(cw * 0.5, (window.innerHeight || 800) * 0.55), 340, 420))) });

/* ------------------------------------------------------------------ Natijalar */
const setRO = readouts($("[data-readouts]"));
function updateReadouts() {
  const d = selDrop(), inView = st.drops.filter((q) => Math.hypot(q.x, q.y) < P.VIEW).length;
  setRO("r1", "Kuchlanish <i>U</i>", u(fmt(st.U, 0), "V"), st.field ? `E = ${fmt((st.U / P.D_PL) / 1000, 1)} kV/m` : "maydon o‘chiq");
  setRO("r2", "Sekundomer", u(fmt(st.sw, 2), "s"), st.swOn ? "ishlayapti" : "to‘xtagan", st.swOn ? "green" : "");
  let state = "—";
  if (d) { const v = P.vel(d, st.U, st.field); state = Math.abs(v) < 2e-6 ? "deyarli muvozanatda" : v > 0 ? "ko‘tarilmoqda" : "tushmoqda"; }
  setRO("r3", "Tanlangan tomchi", d ? `№ ${d.id}` : "yo‘q", d ? state : "tomchini bosing");
  setRO("r4", "Ko‘rish maydonida", String(inView), "tomchi");
  setRO("r5", "Maydon", st.field > 0 ? "↑" : st.field < 0 ? "↓" : "0", st.field > 0 ? "manfiy tomchilarni ko‘taradi" : st.field < 0 ? "pastga itaradi" : "faqat og‘irlik va qarshilik");
  setRO("r6", "Vaqt tezligi", `×${st.speed}`, "model vaqti");
}
function updateStatus() { const el = $("[data-status]"), t = st.swOn ? "Sekundomer ishlayapti" : `t = ${fmt(st.sw, 2)} s`; if (el.textContent !== t) el.textContent = t; el.dataset.tone = st.swOn ? "green" : "blue"; }
let lastEx = "";
function updateExplain() {
  const html = `<p>Maydon o‘chiq bo‘lganda tomchi og‘irlik va havoning qarshiligi (Stoks kuchi 6πηrv) muvozanatlashgan o‘zgarmas tezlik bilan tushadi — tushish tezligidan uning radiusi topiladi. Maydon ↑ yoqilganda zaryadlangan tomchi ko‘tariladi: qE = mg + 6πηrv<sub>k</sub>.</p><p>Tanlangan tomchi A chiziqni kesib o‘tganda sekundomerni yoqing, B da to‘xtating (yoki aksincha). Har bir tomchi uchun bir necha marta o‘lchang — Broun harakati tufayli vaqtlar biroz farq qiladi. Topilgan zaryadlar bitta elementar zaryadga karrali bo‘ladi.</p>`;
  if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() { const t = st.swOn ? "Sekundomerni to‘xtatish" : "Sekundomerni yoqish"; if (actBtn.textContent !== t) actBtn.textContent = t; resetBtn.textContent = "Yangi tomchilar"; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateAction(); syncUI(); stage.render(); }
$("[data-formula]").innerHTML = "<small>Milliken</small> q = 6πηr(v<sub>t</sub> + v<sub>k</sub>)·d/U";
$("[data-graph-card]").hidden = true;

/* ------------------------------------------------------------------ Vaqt */
let uiT = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return; const T = Math.min(dt, 0.1) * st.speed; st.t += T;
  const n = Math.max(1, Math.ceil(T / 0.02)), h = T / n;
  for (let i = 0; i < n; i++) st.drops.forEach((d) => P.step(d, st.U, st.field, h, R));
  for (let i = st.drops.length - 1; i >= 0; i--) { const d = st.drops[i]; if (Math.abs(d.y) > 8 * P.VIEW || Math.abs(d.x) > 3 * P.VIEW) { st.drops.splice(i, 1); if (d.id === st.sel) st.sel = null; } }
  if (st.swOn) st.sw += T;
  stage.render();
  uiT += dt; if (uiT > 0.12) { uiT = 0; updateReadouts(); updateStatus(); updateAction(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.addEventListener("click", () => loop.toggle());
const toggleSW = () => { st.swOn = !st.swOn; if (!loop.running) loop.start(); };
actBtn.addEventListener("click", () => { toggleSW(); refresh(); });
resetBtn.addEventListener("click", () => { st.drops = []; spray(); refresh(); });
document.addEventListener("keydown", (e) => { if (e.code !== "Space" || e.target.closest("input, textarea, select, button")) return; e.preventDefault(); toggleSW(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */
const uIn = $("#pUm"), uOut = $("#pUmOut");
uIn.addEventListener("input", () => { st.U = +uIn.value; customized(); refresh(); });
$("[data-fieldset]").innerHTML = [[1, "↑ ko‘tarish"], [0, "o‘chiq"], [-1, "↓"]].map(([v, t]) => `<button type="button" data-field="${v}">${t}</button>`).join("");
$("[data-fieldset]").addEventListener("click", (e) => { const b = e.target.closest("[data-field]"); if (b) { st.field = +b.dataset.field; customized(); refresh(); } });
function syncUI() { if (+uIn.value !== st.U) uIn.value = st.U; uOut.textContent = `${st.U} V`; document.querySelectorAll("[data-field]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.field === st.field))); }
const setU = (v) => { st.U = clamp(Math.round(v), 0, P.U_MAX); };
function cycleSel(k) { const ids = st.drops.filter((d) => Math.hypot(d.x, d.y) < P.VIEW * 1.05).map((d) => d.id); if (!ids.length) return; const i = ids.indexOf(st.sel); st.sel = ids[(i + k + ids.length) % ids.length]; }
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, q) => q && p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1;
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e);
  for (const q of geo.chips || []) if (inBox(p, q)) {
    if (q.k === "dU") setU(st.U + q.v); else if (q.k === "field") st.field = q.v; else if (q.k === "speed") st.speed = q.v;
    else if (q.v === "sw") toggleSW(); else if (q.v === "sw0") { st.sw = 0; st.swOn = false; } else if (q.v === "prev") cycleSel(-1); else if (q.v === "next") cycleSel(1);
    else if (q.v === "spray") spray(); else if (q.v === "ion") ionize(); else if (q.v === "spd") st.speed = st.speed === 1 ? 2 : st.speed === 2 ? 4 : 1;
    customized(); refresh(); return;
  }
  if (geo.knob && Math.hypot(p.x - geo.knob.x, p.y - geo.knob.y) <= geo.knob.r) { drag = "U"; dragY0 = p.y; dragV0 = st.U; canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault(); return; }
  let best = null, bd = 18; (geo.drops || []).forEach((q) => { const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = q; } });
  if (best) { st.sel = best.id; refresh(); }
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(e);
  if (!drag) { const over = (geo.chips || []).some((q) => inBox(p, q)) || (geo.drops || []).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 18); canvas.style.cursor = geo.knob && Math.hypot(p.x - geo.knob.x, p.y - geo.knob.y) <= geo.knob.r ? "ns-resize" : over ? "pointer" : ""; return; }
  setU(dragV0 + (dragY0 - p.y) * 3); customized(); refresh();
});
const end = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

/* ------------------------------------------------------------------ Tayyor tajribalar */
const PRESETS = {
  fall: { title: "Tushish vaqtini o‘lchash", lesson: "Maydon o‘chiq. Tomchini tanlang; u A chiziqni kesganda sekundomerni yoqing, B da to‘xtating — bu t_t. Har bir tomchi uchun 2–3 marta o‘lchang.", set: () => Object.assign(st, { field: 0, U: 400, speed: 1 }) },
  rise: { title: "Ko‘tarilish vaqti (U = 400 V)", lesson: "Maydon ↑: manfiy zaryadlangan tomchilar ko‘tariladi. B dan A gacha ko‘tarilish vaqti t_k ni o‘lchang. Juda tez ko‘tarilsa — U ni kamaytiring.", set: () => Object.assign(st, { field: 1, U: 400, speed: 1 }) },
  bal: { title: "Muvozanat usuli", lesson: "Maydon ↑ holatida U ni shunday tanlangki, tomchi to‘xtab qolsin (muvozanat). U_m va maydonsiz tushish vaqtini yozing (2-jadval).", set: () => Object.assign(st, { field: 1, U: 250, speed: 1 }) },
  ion: { title: "Zaryad o‘zgarishi (ionlash)", lesson: "«Ionlash» ni bosing: ba’zi tomchilar elektron yutadi yoki yo‘qotadi — ko‘tarilish tezligi sakrab o‘zgaradi. Tezlik o‘zgarishi doim bir xil «qadam» bilan bo‘ladi.", set: () => Object.assign(st, { field: 1, U: 400, speed: 2 }) },
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.entries(PRESETS).map(([id, p]) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${p.title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPP = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPP(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id) {
  const p = PRESETS[id]; p.set(); if (st.drops.length < 4) spray();
  presetId = id; setPP(id); $("[data-lesson]").textContent = p.lesson; $("[data-mode-hint]").textContent = "Tomchini bosib tanlang · Probel — sekundomer";
  refresh(); if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* */ }
}

/* ------------------------------------------------------------------ Laboratoriya daftari */
const match1 = (r) => { const d = findDrop(r.drop); if (!d) return false; const tf = P.tFall(d), okF = Math.abs(r.tf - tf) <= Math.max(0.1 * tf, 0.3); const okR = [d.n, ...(d.hist || [])].some((n) => { const t = P.tRise(d, r.U, n); return Number.isFinite(t) && Math.abs(r.tr - t) <= Math.max(0.1 * t, 0.3); }); return okF && okR; };
const match2 = (r) => { const d = findDrop(r.drop); if (!d) return false; const tf = P.tFall(d), okF = Math.abs(r.tf - tf) <= Math.max(0.1 * tf, 0.3); const okU = [d.n, ...(d.hist || [])].some((n) => Math.abs(r.Ub - P.uBal({ ...d, n })) <= 0.04 * P.uBal({ ...d, n })); return okF && okU; };
const q19 = (q) => fmt(q / 1e-19, 3);
const sumE = (A) => (A.Q ? [["e = Σq/Σn", `${q19(A.Q.e)}·10⁻¹⁹ C`, `farq ${fmt((100 * (A.Q.e - P.QE)) / P.QE, 1)}%`], ["q/n o‘rtacha", `± ${q19(A.Q.se)}·10⁻¹⁹ C`, `${A.groups.length} ta tomchi`]] : A.rows.length ? [["Kvantlash", "aniqlanmadi", "ko‘proq tomchi o‘lchang"]] : null);
createNotebook($("[data-notebook]"), {
  key: "millikan", docLabel: DOC_LABEL, site: SITE,
  intro: "Har bir tomchi uchun tushish va ko‘tarilish vaqtlarini bir necha marta o‘lchang (bir xil № va U li qatorlar o‘rtachalanadi). Zaryadlar avtomatik hisoblanadi va elementar zaryad topiladi.",
  conclusionPh: "Zaryadlar qanday qiymatlarni qabul qildi? Topilgan e jadval qiymatiga mosmi? Zaryad kvantlanganligi haqida xulosa.",
  hint: "Javob bering: 1) Har bir tomchining zaryadi qandaydir eng kichik qiymatga karralimi? 2) Topilgan e va uning xatoligi; jadval qiymati bilan farq. 3) Broun harakati o‘lchashlarga qanday ta’sir qiladi? 4) Ionlashdan keyin zaryad qanday o‘zgardi?",
  fileBase: (nb) => `Milliken-lab-${translit(nb.f.name)}`,
  minTables: 1,
  tables: [
    { key: "t1", req: true, okLabel: "e (dinamik)", need: "1-jadvalda kamida 4 ta tomchi", title: "1-topshiriq. Dinamik usul: tushish va ko‘tarilish vaqtlari",
      desc: "Maydonsiz A→B tushish vaqti t<sub>t</sub> va maydon ↑ da B→A ko‘tarilish vaqti t<sub>k</sub> (s = 0,5 mm, d = 6 mm). Bir tomchini bir necha marta o‘lchash tavsiya etiladi.",
      head: ["Tomchi №", "U, V", "t<sub>t</sub>, s", "t<sub>k</sub>, s", "r, μm", "q, 10⁻¹⁹ C", "n", "q/n, 10⁻¹⁹ C", "Tekshiruv"],
      cols: [{ k: "drop", kind: "num", mode: "numeric" }, { k: "U", kind: "num" }, { k: "tf", kind: "num" }, { k: "tr", kind: "num" }], outs: ["r", "q", "n", "qn"],
      blank: () => ({ drop: "", U: "", tf: "", tr: "" }), rows: 6, max: 30,
      parse: (r) => ({ drop: num(r.drop), U: num(r.U), tf: num(r.tf), tr: num(r.tr) }), check: L.check1, analyze: (rows) => L.analyze1(rows),
      out: (A, j) => { const r = A.rows[j]; return { r: fmt(r.r * 1e6, 3), q: q19(r.q), n: r.n ? String(r.n) : "—", qn: r.qn ? q19(r.qn) : "—" }; },
      match: match1, noMatch: "Vaqt bu tomchi uchun kutilganidan ±10 % dan ko‘p farq qiladi",
      summary: sumE, ok: (A) => A.ok },
    { key: "t2", okLabel: "e (muvozanat)", need: "2-jadvalda kamida 3 ta tomchi", title: "2-topshiriq. Muvozanat usuli (ixtiyoriy)",
      desc: "Maydon ↑ da tomchi to‘xtab qoladigan kuchlanish U<sub>m</sub> va maydonsiz tushish vaqti t<sub>t</sub>.",
      head: ["Tomchi №", "t<sub>t</sub>, s", "U<sub>m</sub>, V", "r, μm", "q, 10⁻¹⁹ C", "n", "q/n, 10⁻¹⁹ C", "Tekshiruv"],
      cols: [{ k: "drop", kind: "num", mode: "numeric" }, { k: "tf", kind: "num" }, { k: "Ub", kind: "num" }], outs: ["r", "q", "n", "qn"],
      blank: () => ({ drop: "", tf: "", Ub: "" }), rows: 3, max: 20, narrow: true,
      parse: (r) => ({ drop: num(r.drop), tf: num(r.tf), Ub: num(r.Ub) }), check: L.check2, analyze: (rows, c, res) => L.analyze2(rows, (res?.t1?.A?.groups || []).map((g) => g.q)),
      out: (A, j) => { const r = A.rows[j]; return { r: fmt(r.r * 1e6, 3), q: q19(r.q), n: r.n ? String(r.n) : "—", qn: r.qn ? q19(r.qn) : "—" }; },
      match: match2, noMatch: "U_m yoki t_t bu tomchi uchun mos emas",
      summary: sumE, ok: (A) => A.ok },
  ],
  build: (nb, res) => buildMillikanDoc(nb, res),
});

/* ------------------------------------------------------------------ Ishga tushirish */
setPlayUI(false);
spray();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "fall");
document.fonts?.ready.then(() => stage.render());
