// ==========================================================================
// Molekula o'lchamini baholash — amaliy ish (simulations/molecule-size.html)
// Pipetkadan menzurkaga tomchilar sanaladi (bir tomchi hajmi V₀ = V/N), so'ng olein kislotasining
// spirtdagi eritmasidan (1 : k) likopodiy kukuni sepilgan suvli vannaga tomiziladi. Kislota monoqatlam
// bo'lib yoyiladi va kukunni chetga suradi. Vanna ustiga shisha va katakli qog'oz qo'yilib, dog' yuzi
// kataklar bilan sanaladi: S ≈ N₁ + N₂/2. Molekula o'lchami d = V/S. Jadval va S(V) grafigi.
// Fizika: molecule-size-physics.js (Node'da tekshirilgan: t_molecule_size.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn, noise } from "./labkit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./molecule-size-physics.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const TRUE_N = 48;              // pipetkaning 1 ml dagi haqiqiy tomchilar soni
const V0_TRUE = 1 / TRUE_N;     // ml

/* ------------------------------------------------------------------ Holat */

const ui = { hover: null };
const s = { k: 1000, N: 0, n: 0, V: 0, seed: 1, cx: 20, cy: 15, t: 9, grid: false, rows: [], drops: [], ripple: -1, fall: -1 };
let presetId = null, playing = true;
const geo = {};
const Vread = () => Math.round((s.N / TRUE_N) / 0.05) * 0.05;            // menzurka shkalasidan, ml
const V0meas = () => (s.N >= 10 && Vread() > 0 ? Vread() / s.N : null);
const Vacid = () => s.V / s.k;                                          // vannadagi haqiqiy kislota, ml
const Vcalc = () => (V0meas() ? (s.n * V0meas()) / s.k : null);           // o'quvchi hisoblaydigan, ml
const grow = () => 1 - Math.exp(-s.t / 0.35);
const shape = () => P.spotShape(P.spotArea(Vacid()) * grow() ** 2, s.seed);
let gcache = { key: "", g: null };
function counted() {
  if (!s.n || grow() < 0.995) return null;
  const key = `${s.V}:${s.seed}:${s.cx}:${s.cy}`;
  if (gcache.key !== key) gcache = { key, g: P.gridCount(P.spotShape(P.spotArea(Vacid()), s.seed), s.cx, s.cy) };
  return gcache.g;
}
const touchesWall = () => { if (!s.n) return false; const R = P.spotShape(P.spotArea(Vacid()), s.seed).R * 1.2; return s.cx - R < 0 || s.cx + R > P.TRAY.w || s.cy - R < 0 || s.cy + R > P.TRAY.h; };
const dMeas = () => { const g = counted(), V = Vcalc(); return g && V ? P.thickness(V, g.S) : null; };

/* ------------------------------------------------------------------ Kukun */

const POWDER = Array.from({ length: 2600 }, (_, i) => [(noise(i, 1) + 0.5) * P.TRAY.w, (noise(i, 2) + 0.5) * P.TRAY.h, noise(i, 3)]);

/* ------------------------------------------------------------------ Chizish */

function cylinder(ctx, c, x, y, wC, hC) {
  // menzurka 0…2 ml
  const top = y, bot = y + hC, ml = (v) => bot - (v / 2) * (hC - 10);
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.12)" : "rgba(226,232,240,0.6)"; ctx.fillRect(x, top, wC, hC);
  const lv = Math.min(2, s.N / TRUE_N);
  if (lv > 0) { ctx.fillStyle = "rgba(250,204,21,0.45)"; ctx.fillRect(x + 1, ml(lv), wC - 2, bot - ml(lv)); ctx.strokeStyle = "rgba(202,138,4,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 1, ml(lv) + 2); ctx.quadraticCurveTo(x + wC / 2, ml(lv) + 5, x + wC - 1, ml(lv) + 2); ctx.stroke(); }
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#64748b"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, bot); ctx.lineTo(x + wC, bot); ctx.lineTo(x + wC, top - 4); ctx.stroke();
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#64748b"; ctx.fillRect(x - 8, bot, wC + 16, 4);
  ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineWidth = 1;
  for (let k = 0; k <= 20; k++) { const yy = ml(k / 10), big = k % 5 === 0; ctx.strokeStyle = c.text2; ctx.beginPath(); ctx.moveTo(x + wC - (big ? 12 : 7), yy); ctx.lineTo(x + wC, yy); ctx.stroke(); if (k % 5 === 0) { ctx.fillStyle = c.text2; ctx.fillText(fmt(k / 10, 1), x + wC + 4, yy); } }
  ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("ml", x + wC / 2, bot + 7);
}
function pipette(ctx, c, x, y, len) {
  ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.roundRect(x - 7, y - 26, 14, 26, 6); ctx.fill();
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.25)" : "rgba(203,213,225,0.7)"; ctx.fillRect(x - 4, y, 8, len - 12);
  ctx.beginPath(); ctx.moveTo(x - 4, y + len - 12); ctx.lineTo(x - 1, y + len); ctx.lineTo(x + 1, y + len); ctx.lineTo(x + 4, y + len - 12); ctx.fill();
  ctx.fillStyle = "rgba(250,204,21,0.55)"; ctx.fillRect(x - 3, y + len * 0.4, 6, len * 0.6 - 12);
}
function trayView(ctx, c, x0, y0, w0, h0) {
  const sc = Math.min(w0 / P.TRAY.w, h0 / P.TRAY.h), W = P.TRAY.w * sc, H = P.TRAY.h * sc, tx = x0 + (w0 - W) / 2, ty = y0;
  const X = (x) => tx + x * sc, Y = (y) => ty + y * sc;
  geo.tray = { tx, ty, W, H, sc };
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8"; ctx.beginPath(); ctx.roundRect(tx - 7, ty - 7, W + 14, H + 14, 8); ctx.fill();
  const g = ctx.createLinearGradient(tx, ty, tx + W, ty + H); g.addColorStop(0, c.dark ? "#0c4a6e" : "#bae6fd"); g.addColorStop(1, c.dark ? "#075985" : "#7dd3fc"); ctx.fillStyle = g; ctx.fillRect(tx, ty, W, H);
  const sh = s.n ? shape() : null;
  // kukun
  ctx.fillStyle = c.dark ? "rgba(253,224,71,0.75)" : "rgba(202,138,4,0.7)";
  const pr = Math.max(0.8, sc * 0.09);
  for (const [px, py, q] of POWDER) {
    let x = px, y = py;
    if (sh) { const dx = px - s.cx, dy = py - s.cy, rr = Math.hypot(dx, dy), rb = sh.r(Math.atan2(dy, dx)); if (rr < rb) { const f = rb / Math.max(rr, 0.01); x = s.cx + dx * f * (1.0 + 0.05 * (q + 0.5)); y = s.cy + dy * f * (1.0 + 0.05 * (q + 0.5)); if (x < 0 || x > P.TRAY.w || y < 0 || y > P.TRAY.h) continue; } }
    ctx.fillRect(X(x) - pr / 2, Y(y) - pr / 2, pr, pr);
  }
  // dog'
  if (sh) {
    ctx.beginPath(); for (let i = 0; i <= 120; i++) { const th = (i / 120) * TAU, r = sh.r(th); const x = X(s.cx + Math.cos(th) * r), y = Y(s.cy + Math.sin(th) * r); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
    const gs = ctx.createRadialGradient(X(s.cx), Y(s.cy), 2, X(s.cx), Y(s.cy), sh.R * sc * 1.1); gs.addColorStop(0, "rgba(255,255,255,0.10)"); gs.addColorStop(0.7, "rgba(167,139,250,0.10)"); gs.addColorStop(1, "rgba(52,211,153,0.16)");
    ctx.fillStyle = gs; ctx.fill(); ctx.strokeStyle = c.dark ? "rgba(253,224,71,0.7)" : "rgba(161,98,7,0.7)"; ctx.lineWidth = 1.6; ctx.stroke();
  }
  // tomchi va to'lqin
  if (s.fall >= 0) { const yy = ty - 40 + s.fall * (Y(s.cy) - ty + 40); ctx.fillStyle = "rgba(250,204,21,0.9)"; ctx.beginPath(); ctx.arc(X(s.cx), yy, 3.5, 0, TAU); ctx.fill(); }
  if (s.ripple >= 0 && s.ripple < 1) { ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - s.ripple)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(s.cx), Y(s.cy), 4 + s.ripple * 40, 0, TAU); ctx.stroke(); }
  // shisha va katakli qog'oz
  const gc = counted();
  if (s.grid) {
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(tx, ty, W, H);
    if (gc) for (const [i, j, f] of gc.cells) { ctx.fillStyle = f === 2 ? "rgba(34,197,94,0.28)" : "rgba(234,179,8,0.35)"; ctx.fillRect(X(i), Y(j), sc, sc); }
    ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.28)" : "rgba(30,64,175,0.22)"; ctx.lineWidth = 0.6; ctx.beginPath();
    for (let i = 0; i <= P.TRAY.w; i++) { ctx.moveTo(X(i), ty); ctx.lineTo(X(i), ty + H); }
    for (let j = 0; j <= P.TRAY.h; j++) { ctx.moveTo(tx, Y(j)); ctx.lineTo(tx + W, Y(j)); }
    ctx.stroke();
    ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.5)" : "rgba(30,64,175,0.45)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= P.TRAY.w; i += 5) { ctx.moveTo(X(i), ty); ctx.lineTo(X(i), ty + H); }
    for (let j = 0; j <= P.TRAY.h; j += 5) { ctx.moveTo(tx, Y(j)); ctx.lineTo(tx + W, Y(j)); }
    ctx.stroke();
    if (gc) tag(ctx, `to‘liq: ${gc.full}, chala: ${gc.part} → S ≈ ${fmt(gc.S, 0)} sm²`, tx + 8, ty + H - 14, { color: c.text, bg: c.bg2, font: MID });
    else if (s.n) tag(ctx, "dog‘ yoyilmoqda…", tx + 8, ty + H - 14, { color: c.text2, bg: c.bg2, font: MID });
  }
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText(`vanna ${P.TRAY.w} × ${P.TRAY.h} sm, katak 1 sm`, tx + W, ty + H + 9);
  if (touchesWall()) tag(ctx, "dog‘ vanna devoriga yetdi — kamroq tomchi yoki suyuqroq eritma oling", tx + W / 2, ty + 16, { color: "#fff", bg: c.danger, font: SMALL, align: "center" });
}
function monolayer(ctx, c, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.clip();
  ctx.fillStyle = c.bg2; ctx.fillRect(x, y, w, h);
  const wy = y + h * 0.62; ctx.fillStyle = c.dark ? "#0c4a6e" : "#bae6fd"; ctx.fillRect(x, wy, w, h);
  for (let k = 0; k < 9; k++) {
    const mx = x + 14 + k * ((w - 28) / 8);
    ctx.strokeStyle = c.dark ? "#fcd34d" : "#a16207"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, wy - 3);
    for (let z = 1; z <= 7; z++) ctx.lineTo(mx + (z % 2 ? 3 : -3), wy - 3 - z * 6); ctx.stroke();
    ctx.fillStyle = "#2563eb"; ctx.beginPath(); ctx.arc(mx, wy, 4, 0, TAU); ctx.fill();
  }
  const top = wy - 45; ctx.strokeStyle = c.danger; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + w - 10, wy); ctx.lineTo(x + w - 10, top); ctx.moveTo(x + w - 14, wy); ctx.lineTo(x + w - 6, wy); ctx.moveTo(x + w - 14, top); ctx.lineTo(x + w - 6, top); ctx.stroke();
  ctx.font = BOLD; ctx.fillStyle = c.danger; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText("d", x + w - 15, (wy + top) / 2);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("monoqatlam (kattalashtirilgan)", x + 8, y + 6);
  ctx.fillStyle = c.dark ? "#e0f2fe" : "#075985"; ctx.textBaseline = "bottom"; ctx.fillText("suv", x + 8, y + h - 4);
  ctx.restore();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
}
function draw(ctx, st) {
  const c = st.colors, w = st.w, h = st.h, narrow = w < 560; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  // chap ustun: eritma, pipetka, menzurka
  const lx = narrow ? 8 : 14, cylX = narrow ? 30 : 64, cylY = narrow ? 76 : 96, cylH = narrow ? 110 : 180, cylW = narrow ? 30 : 38;
  pipette(ctx, c, cylX + cylW / 2, cylY - (narrow ? 40 : 58), narrow ? 34 : 50);
  cylinder(ctx, c, cylX, cylY, cylW, cylH);
  tag(ctx, `eritma 1 : ${s.k}`, narrow ? cylX + cylW + 30 : lx, narrow ? 82 : 14, { color: c.text, bg: c.bg2, font: SMALL });
  const bx = narrow ? cylX + cylW + 30 : lx, by = narrow ? 104 : cylY + cylH + 26;
  geo.add1 = chipBtn(ctx, c, bx, by, "+1 tomchi", true, 74, 24);
  geo.add10 = chipBtn(ctx, c, bx + 78, by, "+10", false, 40, 24);
  geo.empty = chipBtn(ctx, c, bx + 122, by, "To‘kish", false, 58, 24);
  tag(ctx, `N = ${s.N} tomchi`, bx, by + (narrow ? 40 : 42), { color: c.text, bg: c.bg2, font: BOLD });
  if (!narrow && h - (by + 64) > 64) monolayer(ctx, c, lx, by + 62, 190, Math.min(110, h - by - 70));
  // vanna
  const tX = narrow ? 8 : 226, tY = narrow ? cylY + cylH + 50 : 50, tW = w - tX - (narrow ? 8 : 16), tH = h - tY - 26;
  const cy0 = narrow ? tY - 34 : 12, cx0 = narrow ? 8 : tX;
  geo.drop = chipBtn(ctx, c, cx0, cy0, "Vannaga tomizish", true, 124, 24);
  geo.grid = chipBtn(ctx, c, cx0 + 128, cy0, narrow ? "Shisha" : "Shisha + katakli qog‘oz", s.grid, narrow ? 60 : 160, 24);
  geo.rec = chipBtn(ctx, c, cx0 + 128 + (narrow ? 64 : 164), cy0, "Yozish", false, 60, 24, c.success);
  geo.fresh = chipBtn(ctx, c, cx0 + 128 + (narrow ? 128 : 228), cy0, "Yangi vanna", false, 92, 24);
  trayView(ctx, c, tX, tY, tW, tH);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.52, 400, 460)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => ($("#stage").parentElement.clientWidth < 560 ? 520 : heights().stage) });

/* ------------------------------------------------------------------ Grafik S(V) */

let gLast = null;
function drawGraph(ctx, gs) {
  const c = gs.colors, pts = s.rows.map((r) => [r.V * 1000, r.S]);
  const xMax = Math.max(0.05, ...pts.map((p) => p[0] * 1.2)), yMax = Math.max(200, ...pts.map((p) => p[1] * 1.2));
  const xm = Math.ceil(xMax * 100) / 100, ym = Math.ceil(yMax / 100) * 100;
  const f = frame(ctx, gs, { xMin: 0, xMax: xm, yMin: 0, yMax: ym, xTicks: ticks(0, xm, gs.w < 480 ? 4 : 6).values, yTicks: ticks(0, ym, 4).values, fmtX: (v) => fmt(v, 3), fmtY: (v) => fmt(v, 0), yLabel: "S, sm²", xUnit: "V, mm³" });
  gLast = { ...f, xMin: 0, xMax: xm };
  const k = P.fitThroughOrigin(pts.map(([x, y]) => [x / 1000, y]));
  if (pts.length && isFinite(k)) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xm), f.Y((k * xm) / 1000)); ctx.stroke(); ctx.setLineDash([]); }
  for (const [x, y] of pts) { ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), 5, 0, TAU); ctx.fill(); }
  if (!pts.length) { ctx.font = MID; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Jadvalga o‘lchash yozilsa, nuqtalar shu yerda paydo bo‘ladi", f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2); }
  else legend(ctx, [{ color: c.warning, label: "o‘lchashlar" }, { color: c.primary, label: `S = V/d, d = ${fmt(1e7 / k, 2)} nm`, dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (ui.hover != null && pts.length) { const q = pts.reduce((b, p) => (Math.abs(p[0] - ui.hover) < Math.abs(b[0] - ui.hover) ? p : b)); tag(ctx, `V = ${fmt(q[0], 4)} mm³, S = ${fmt(q[1], 0)} sm²`, f.X(q[0]) + 10, f.Y(q[1]) - 14, { color: c.text, bg: c.bg2, font: MID }); }
}
const graph = createStage($("#graph"), drawGraph, { height: () => heights().graph });

/* ------------------------------------------------------------------ Jadval */

const grid = $("[data-lab-grid]");
function renderTable() {
  const head = "<thead><tr><th>№</th><th>Eritma</th><th>N</th><th>V<sub>m</sub>, ml</th><th>V₀ = V<sub>m</sub>/N, ml</th><th>n</th><th>V = nV₀/k, mm³</th><th>S, sm²</th><th>d = V/S, nm</th></tr></thead>";
  const body = s.rows.length ? s.rows.map((r, i) => `<tr><td>${i + 1}</td><td>1 : ${r.k}</td><td>${r.N}</td><td>${fmt(r.Vm, 2)}</td><td>${fmt(r.V0, 4)}</td><td>${r.n}</td><td>${fmt(r.V * 1000, 4)}</td><td>${fmt(r.S, 0)}</td><td><b>${fmt(r.d, 2)}</b></td></tr>`).join("") : `<tr><td colspan="9">Hali o‘lchash yo‘q</td></tr>`;
  grid.innerHTML = head + `<tbody>${body}</tbody>`;
}
function record() {
  const g = counted(), V = Vcalc(); if (!g || !V || !s.grid || touchesWall()) return false;
  s.rows.push({ k: s.k, N: s.N, Vm: Vread(), V0: V0meas(), n: s.n, V, S: g.S, d: P.thickness(V, g.S) }); renderTable(); return true;
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
let msg = "";
function updateReadouts() {
  const V0 = V0meas(), V = Vcalc(), g = counted(), d = dMeas();
  setRO("r1", "Menzurkadagi tomchilar <i>N</i>", String(s.N), s.N ? `shkala: V = ${fmt(Vread(), 2)} ml` : "«+1 tomchi» bilan sanang", "orange");
  setRO("r2", "Bir tomchi hajmi <i>V₀ = V/N</i>", V0 ? u(fmt(V0, 4), "ml") : "—", V0 ? `= ${fmt(V0 * 1000, 1)} mm³` : "kamida 10 tomchi sanang");
  setRO("r3", "Dog‘dagi kislota hajmi <i>V</i>", V ? u(fmt(V * 1000, 4), "mm³") : "—", s.n ? `n = ${s.n} tomchi, V = nV₀/${s.k}` : "vannaga hali tomizilmagan");
  setRO("r4", "Dog‘ yuzi <i>S</i>", g && s.grid ? u(fmt(g.S, 0), "sm²") : "—", g && s.grid ? `${g.full} + ${g.part}/2 katak` : s.n ? "shisha va katakli qog‘oz qo‘ying" : "—", "green");
  setRO("r5", "Molekula o‘lchami <i>d = V/S</i>", d && s.grid ? u(fmt(d, 2), "nm") : "—", d && s.grid ? `= ${fmt(d, 2)}·10⁻⁹ m` : "", d && s.grid ? "green" : "");
  const k = s.rows.length ? P.fitThroughOrigin(s.rows.map((r) => [r.V, r.S])) : NaN;
  setRO("r6", "Jadval bo‘yicha o‘rtacha", s.rows.length ? u(fmt(s.rows.reduce((a, r) => a + r.d, 0) / s.rows.length, 2), "nm") : "—", s.rows.length ? `${s.rows.length} ta o‘lchash; grafikdan ${fmt(1e7 / k, 2)} nm` : "«Yozish» bilan jadvalga qo‘shing");
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (msg) { t = msg; tone = "orange"; }
  else if (!V0meas()) t = "1-qadam: tomchilarni sanang";
  else if (!s.n) t = "2-qadam: vannaga tomizing";
  else if (!s.grid) t = "3-qadam: shisha qo‘yib, kataklarni sanang";
  else { t = dMeas() ? `d ≈ ${fmt(dMeas(), 2)} nm` : "dog‘ yoyilmoqda…"; tone = "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = ["<p>Olein kislotasi suvda erimaydi, uning molekulasining bir uchi suvga «yopishadi», ikkinchisi esa yuqoriga qaraydi. Shuning uchun tomchi suv sirtida imkon qadar keng yoyilib, <b>bir molekula qalinlikdagi parda</b> hosil qiladi. Parda qalinligi molekula o‘lchamiga teng: <b>d = V/S</b>.</p>",
    `<p>Sof kislota juda ko‘p joy egallaydi, shuning uchun u spirtda 1 : ${s.k} nisbatda suyultiriladi: bir tomchidagi kislota hajmi V₀/${s.k}. Spirt suvda eriydi va bug‘lanadi, sirtda faqat kislota qoladi. Likopodiy kukuni pardaning chegarasini ko‘rinadigan qiladi.</p>`];
  if (dMeas() && s.grid) p.push(`<p>Natija: d ≈ ${fmt(dMeas(), 2)}·10⁻⁹ m. Demak, molekulalar o‘lchami taxminan 10⁻⁹ m — bir millimetrga bir milliondan ortiq molekula qator terilib sig‘adi.</p>`);
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
$("[data-formula]").innerHTML = "<small>Molekula o‘lchami</small> d = V/S";
function refresh() { updateReadouts(); updateStatus(); updateExplain(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return; dt = Math.min(dt, 0.05);
  if (s.fall >= 0) { s.fall += dt / 0.35; if (s.fall >= 1) { s.fall = -1; addDrop(); } }
  if (s.ripple >= 0) { s.ripple += dt / 0.8; if (s.ripple >= 1) s.ripple = -1; }
  if (s.n) s.t += dt;
  stage.render();
  uiTimer += dt; if (uiTimer > 0.25) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom";
}
playBtn.addEventListener("click", () => { if (loop.running) { loop.stop(); playing = false; } else { loop.start(); playing = true; } });
function startIfNeeded() {
  if (prefersReducedMotion()) { loop.stop(); setPlayUI(false); return; }
  if (!playing) { loop.stop(); setPlayUI(false); } else loop.start();
}

/* ------------------------------------------------------------------ Amallar */

let dropNo = 0;
function addDrop() { dropNo++; s.n++; s.V += V0_TRUE * (1 + 0.04 * noise(dropNo, 7)); s.ripple = 0; if (s.n === 1) s.t = 0; else s.t = Math.min(s.t, 0.4); gcache.key = ""; }
function drop() { if (s.fall >= 0) return; if (!loop.running) { addDrop(); s.t = 9; s.ripple = -1; } else s.fall = 0; }
function freshTray(seed) { s.n = 0; s.V = 0; s.t = 9; s.fall = -1; s.ripple = -1; s.grid = false; s.seed = seed ?? s.seed + 1; s.cx = 20 + 3 * noise(s.seed, 4); s.cy = 15 + 2 * noise(s.seed, 5); gcache.key = ""; }
$("[data-reset]").addEventListener("click", () => { s.N = 0; freshTray(); s.rows = []; renderTable(); customized(); refresh(); });
function setConc(k) { s.k = k; document.querySelectorAll("[data-conc-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.concValue) === k))); }
document.querySelectorAll("[data-conc-value]").forEach((b) => b.addEventListener("click", () => { setConc(Number(b.dataset.concValue)); freshTray(); customized(); refresh(); }));

const canvas = stage.canvas;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const HITS = ["add1", "add10", "empty", "drop", "grid", "rec", "fresh"];
const hit = (p) => HITS.find((k) => inBox(p, geo[k])) || null;
let msgTimer = 0;
const say = (m) => { msg = m; clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg = ""; updateStatus(); }, 2600); };
canvas.addEventListener("pointerdown", (e) => {
  const h = hit(ptr(canvas, e)); if (!h) return; e.preventDefault(); customized();
  if (h === "add1") s.N = Math.min(2 * TRUE_N, s.N + 1);
  else if (h === "add10") s.N = Math.min(2 * TRUE_N, s.N + 10);
  else if (h === "empty") s.N = 0;
  else if (h === "drop") { if (s.n >= 6) say("Juda ko‘p tomchi — yangi vanna oling"); else drop(); }
  else if (h === "grid") s.grid = !s.grid;
  else if (h === "rec") { if (!V0meas()) say("Avval bir tomchi hajmini toping"); else if (!s.n) say("Vannada dog‘ yo‘q"); else if (!s.grid) say("Shisha va katakli qog‘oz qo‘ying"); else if (touchesWall()) say("Dog‘ devorga yetgan — o‘lchab bo‘lmaydi"); else if (!counted()) say("Dog‘ hali yoyilmoqda"); else if (record()) { say("Jadvalga yozildi — yangi vanna oling"); } }
  else if (h === "fresh") freshTray();
  refresh();
});
canvas.addEventListener("pointermove", (e) => { canvas.style.cursor = hit(ptr(canvas, e)) ? "pointer" : ""; });
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = gLast; if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PR = (title, lesson, o) => ({ title, lesson, set: () => {
  setConc(o.k ?? 1000); s.N = o.N ?? 0; s.rows = []; freshTray(o.seed ?? 3);
  for (const [k, n] of o.series || []) { setConc(k); freshTray(); for (let i = 0; i < n; i++) addDrop(); s.t = 9; s.grid = true; record(); }
  setConc(o.k ?? 1000); freshTray(o.seed ?? 3); for (let i = 0; i < (o.n ?? 0); i++) addDrop(); s.t = 9; s.ripple = -1; s.grid = !!o.grid; renderTable();
} });
const PRESETS = {
  mStart: PR("Ishni boshlash", "1-qadam: pipetkadan menzurkaga tomchilarni sanab tomizing («+1 tomchi», «+10»), suyuqlik 1 ml ga yetganda bir tomchi hajmini toping: V₀ = V/N.", {}),
  mCount: PR("Tomchilar sanaldi", "1 ml ga 48 tomchi ketdi: V₀ = 1/48 ≈ 0,021 ml. Endi «Vannaga tomizish» ni bosing va dog‘ yoyilishini kuzating.", { N: 48 }),
  mOne: PR("Bir tomchi, 1 : 1000", "Bir tomchi eritmada 0,021 mm³ kislota bor. Dog‘ ≈ 170 sm² ga yoyildi. Kataklar sanaldi: yashil — to‘liq, sariq — chala kataklar. d = V/S ≈ 1,2 nm.", { N: 48, n: 1, grid: true }),
  mTwo: PR("Ikki tomchi", "Kislota hajmi ikki marta oshdi — dog‘ yuzi ham ikki marta katta, qalinlik esa o‘zgarmadi: parda doim bir molekula qalinlikda.", { N: 48, n: 2, grid: true }),
  mDilute: PR("Suyuqroq eritma 1 : 2000", "Eritma ikki marta suyultirilsa, tomchidagi kislota ikki marta kam — dog‘ ham ikki marta kichik. Natija (d) o‘zgarmaydi.", { k: 2000, N: 48, n: 1, grid: true }),
  mSeries: PR("O‘lchashlar seriyasi", "Turli eritma va tomchilar soni bilan 4 ta o‘lchash yozildi. S(V) nuqtalari koordinata boshidan o‘tuvchi to‘g‘ri chiziqda yotadi — qiyaligi 1/d.", { N: 48, n: 3, grid: true, series: [[1000, 1], [1000, 2], [2000, 1], [500, 1]] }),
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.keys(PRESETS).map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id) {
  const p = PRESETS[id]; ui.hover = null; msg = "";
  startIfNeeded(); p.set();
  presetId = id; setPresetPressed(id); $("[data-lesson]").textContent = p.lesson;
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "mStart");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
