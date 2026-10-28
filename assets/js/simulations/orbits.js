// ==========================================================================
// Orbitalar va kosmik tezliklar — simulyatsiya (simulations/orbits.html)
// 1) Nyuton to'pi: 100 km li tog' tepasidagi to'p jismni gorizontal otadi (Yer, Oy, Mars, Yupiter).
//    Tezlik strelkasini sahnada surish, «Otish!», izlar saqlanadi, kutilayotgan yo'l uzuq chiziqda.
//    v < v₁ — tushadi, v ≈ v₁ — doiraviy, v₁ < v < v₂ — ellips, v ≥ v₂ — uzoqlashib ketadi. Grafik h(t).
// 2) Sun'iy yo'ldoshlar: doiraviy orbita balandligi (yo'ldosh sahnada suriladi), Yer aylanishi, XKS, GPS,
//    geostatsionar orbita, Oy. Grafik v(h).
// Fizika: orbits-physics.js (Node'da tekshirilgan: t_orbits.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, arrow, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn } from "./labkit.js";
import * as P from "./orbits-physics.js";
import { drawHeights, drawSpeed, lastFrame } from "./orbits-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const H0 = 100;
const COLORS = ["#2563eb", "#ea580c", "#16a34a", "#9333ea", "#e11d48", "#0891b2"];

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "cannon", hover: null };
const cn = { planet: "earth", v: 7, shots: [], preview: null, ci: 0 };
const ob = { s: 200, h: 420, t: 0 };
let presetId = null, playing = true;
const geo = {};
const pl = () => P.PLANETS[cn.planet];
const E = P.PLANETS.earth;
const H_MIN = 200, H_MAX = 384400 - 6371;
const hOfS = (s) => H_MIN * (H_MAX / H_MIN) ** (s / 1000);
const sOfH = (h) => (1000 * Math.log(h / H_MIN)) / Math.log(H_MAX / H_MIN);
const vMax = () => Math.ceil(P.v2(pl(), H0) * 1.25 * 10) / 10;
const ORBITS = [[420, "XKS"], [20200, "GPS"], [35786, "geostatsionar"], [378029, "Oy"]];
const TYPE = { fall: "Yerga tushadi", circle: "doiraviy orbita", ellipse: "elliptik orbita", para: "parabola — uzoqlashib ketadi", hyper: "giperbola — uzoqlashib ketadi" };
function orbitType(p, v) { const L = P.launch(p, v, H0); if (Math.abs(L.k - 1) < 0.004) return { ...L, type: "circle" }; if (Math.abs(L.k - 2) < 0.004) return { ...L, type: "para" }; return L; }
const typeName = (t) => (t === "fall" && cn.planet !== "earth" ? `${pl().name}ga tushadi` : TYPE[t]);

/** Otishning to'liq yo'lini oldindan hisoblash */
function computeShot(p, v) {
  const L = orbitType(p, v), s = { x: 0, y: p.R + H0, vx: v, vy: 0 }, pts = [[s.x, s.y, 0]];
  const closed = L.type === "circle" || L.type === "ellipse", Tc = closed ? P.periodA(p, (L.rp + L.ra) / 2) : Infinity, T1 = P.period(p, H0);
  let t = 0, landed = false;
  for (let i = 0; i < 60000; i++) {
    const r = Math.hypot(s.x, s.y), dt = Math.min(0.004 * Math.sqrt(r ** 3 / p.GM), closed ? Tc - t : Infinity);
    if (!(dt > 1e-6)) break;
    P.step(s, p.GM, dt); t += dt; pts.push([s.x, s.y, t]);
    if (Math.hypot(s.x, s.y) < p.R) { landed = true; break; }
    if (closed && t >= Tc - 1e-6) break;
    if (!closed && (Math.hypot(s.x, s.y) > 7 * p.R || t > 40 * T1)) break;
  }
  return { v, pts, type: L.type, L, landed, tEnd: t, tNow: 0, color: COLORS[cn.ci++ % COLORS.length] };
}

/* ------------------------------------------------------------------ Osmon jismi */

const BLOBS = [[0.2, 0.35, 0.28], [1.4, 0.2, 0.35], [2.5, -0.3, 0.25], [3.6, 0.45, 0.3], [4.6, -0.1, 0.22], [5.5, 0.3, 0.18]];
function body(ctx, c, cx, cy, Rp, p, rot = 0) {
  if (p === E) { const g0 = ctx.createRadialGradient(cx, cy, Rp * 0.95, cx, cy, Rp * 1.08); g0.addColorStop(0, "rgba(125,211,252,0.55)"); g0.addColorStop(1, "rgba(125,211,252,0)"); ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(cx, cy, Rp * 1.08, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(cx - Rp * 0.35, cy - Rp * 0.35, Rp * 0.1, cx, cy, Rp);
  g.addColorStop(0, p.color[0]); g.addColorStop(1, p.color[1]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.clip();
  if (p === E) { ctx.fillStyle = "rgba(22,163,74,0.8)"; for (const [a, d, r] of BLOBS) { const an = a + rot; ctx.beginPath(); ctx.ellipse(cx + Math.cos(an) * Rp * (0.55 + d * 0.4), cy + Math.sin(an) * Rp * (0.55 + d * 0.4), Rp * r, Rp * r * 0.7, an, 0, TAU); ctx.fill(); } }
  else if (p === P.PLANETS.jupiter) { ctx.globalAlpha = 0.35; ctx.fillStyle = "#78350f"; for (let k = -3; k <= 3; k++) ctx.fillRect(cx - Rp, cy + k * Rp * 0.26 - Rp * 0.05, 2 * Rp, Rp * 0.09); ctx.globalAlpha = 1; }
  else { ctx.fillStyle = "rgba(0,0,0,0.12)"; for (const [a, d, r] of BLOBS) { ctx.beginPath(); ctx.arc(cx + Math.cos(a) * Rp * 0.6 * d * 1.6, cy + Math.sin(a * 1.7) * Rp * 0.55, Rp * r * 0.35, 0, TAU); ctx.fill(); } }
  const sh = ctx.createLinearGradient(cx - Rp * 0.7, cy - Rp * 0.7, cx + Rp * 0.7, cy + Rp * 0.7); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(0.55, "rgba(0,0,0,0.08)"); sh.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = sh; ctx.fillRect(cx - Rp, cy - Rp, 2 * Rp, 2 * Rp);
  ctx.restore();
}
function stars(ctx, c, w, h) { if (!c.dark) return; ctx.fillStyle = "rgba(255,255,255,0.5)"; for (let i = 0; i < 70; i++) { const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * w, y = (Math.sin(i * 37.3 + 1) * 0.5 + 0.5) * h; ctx.fillRect(x, y, 1.2, 1.2); } }

/* ------------------------------------------------------------------ 1. Nyuton to'pi */

function viewExt(p, L) { if (L.type === "fall" || L.type === "circle") return 1.15 * p.R; if (L.type === "ellipse") return Math.min(L.ra, 5 * p.R); return 3.2 * p.R; }
function drawCannon(ctx, c, w, h) {
  const narrow = w < 560, p = pl(), L = orbitType(p, cn.v);
  let ext = viewExt(p, L), bMax = 1.1 * p.R;
  for (const s of cn.shots) { ext = Math.max(ext, viewExt(p, s.L)); if (s.type === "ellipse") bMax = Math.max(bMax, Math.sqrt(s.L.rp * s.L.ra)); }
  if (L.type === "ellipse") bMax = Math.max(bMax, Math.sqrt(L.rp * L.ra));
  const top = p.R + H0, sc = Math.min((h - 74) / (top + ext), (w / 2 - 10) / Math.min(bMax, 3.2 * p.R));
  const cx = w / 2, cy = 58 + top * sc, X = (x) => cx + x * sc, Y = (y) => cy - y * sc;
  stars(ctx, c, w, h);
  body(ctx, c, cx, cy, p.R * sc, p);
  // tog' va to'p
  const mx = cx, my = Y(p.R), mh = 16;
  ctx.fillStyle = c.dark ? "#78716c" : "#57534e"; ctx.beginPath(); ctx.moveTo(mx - 20, my + 4); ctx.lineTo(mx - 2, my - mh); ctx.lineTo(mx + 2, my - mh); ctx.lineTo(mx + 20, my + 4); ctx.fill();
  ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.moveTo(mx - 6, my - mh + 6); ctx.lineTo(mx - 2, my - mh); ctx.lineTo(mx + 2, my - mh); ctx.lineTo(mx + 6, my - mh + 6); ctx.fill();
  ctx.fillStyle = "#1e293b"; ctx.fillRect(mx - 4, my - mh - 8, 18, 6); ctx.beginPath(); ctx.arc(mx - 2, my - mh - 2, 4, 0, TAU); ctx.fill();
  // kutilayotgan yo'l
  if (cn.preview) { ctx.strokeStyle = c.text3; ctx.lineWidth = 1.3; ctx.setLineDash([5, 5]); ctx.beginPath(); cn.preview.pts.forEach((q, i) => { if (i % 2 && i !== cn.preview.pts.length - 1) return; if (i) ctx.lineTo(X(q[0]), Y(q[1])); else ctx.moveTo(X(q[0]), Y(q[1])); }); ctx.stroke(); ctx.setLineDash([]); }
  // otishlar
  for (const s of cn.shots) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.beginPath(); let last = s.pts[0];
    for (let i = 0; i < s.pts.length; i++) { const q = s.pts[i]; if (q[2] > s.tNow) break; if (i) ctx.lineTo(X(q[0]), Y(q[1])); else ctx.moveTo(X(q[0]), Y(q[1])); last = q; }
    ctx.stroke();
    const done = s.tNow >= s.tEnd;
    if (s.landed && done) { const x = X(last[0]), y = Y(last[1]); ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke(); }
    else if (!done || s.type === "circle" || s.type === "ellipse") { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 4, 0, TAU); ctx.fill(); }
  }
  // tezlik strelkasi va shkala
  const ax = mx + 14, ay = my - mh - 5, Lpx = narrow ? 120 : 180, len = (cn.v / vMax()) * Lpx;
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay - 12); ctx.lineTo(ax + Lpx, ay - 12); ctx.stroke();
  for (const [vv, lab] of [[P.v1(p, H0), "v₁"], [P.v2(p, H0), "v₂"]]) { const x = ax + (vv / vMax()) * Lpx; ctx.strokeStyle = c.text2; ctx.beginPath(); ctx.moveTo(x, ay - 17); ctx.lineTo(x, ay - 7); ctx.stroke(); ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(lab, x, ay - 18); }
  if (len > 3) arrow(ctx, ax, ay, len, 0, c.danger, { width: 2.6, head: 8 });
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.danger; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ax + len, ay, 7, 0, TAU); ctx.fill(); ctx.stroke();
  geo.tip = { x: ax + len, y: ay, ax, Lpx };
  { const lbl = `v = ${fmt(cn.v, 2)} km/s`; ctx.font = BOLD; const tw = ctx.measureText(lbl).width + 12, lx = Math.min(ax + len + 12, w - 8 - tw); tag(ctx, lbl, lx, ay + (lx < ax + len + 12 ? 22 : 14), { color: c.danger, bg: c.bg2, font: BOLD }); }
  // ma'lumot va tugmalar
  const bx = narrow ? 8 : 14;
  geo.fire = chipBtn(ctx, c, bx, 10, "Otish!", true, 76, 26, c.danger);
  geo.clear = chipBtn(ctx, c, bx, 42, "Tozalash", false, 76, 24);
  const ty0 = narrow ? h - 42 : 22;
  tag(ctx, typeName(L.type), w - (narrow ? 8 : 14), ty0, { color: c.text, bg: c.bg2, font: narrow ? SMALL : MID, align: "right" });
  tag(ctx, `${p.name}: v₁ = ${fmt(P.v1(p, H0), 2)}, v₂ = ${fmt(P.v2(p, H0), 2)} km/s`, w - (narrow ? 8 : 14), ty0 + (narrow ? 22 : 26), { color: c.text2, bg: c.bg2, font: SMALL, align: "right" });
}

/* ------------------------------------------------------------------ 2. Sun'iy yo'ldoshlar */

function satellite(ctx, c, x, y, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = "#1d4ed8"; ctx.fillRect(-16, -4, 10, 8); ctx.fillRect(6, -4, 10, 8);
  ctx.strokeStyle = "#93c5fd"; ctx.lineWidth = 0.7; for (const x0 of [-16, 6]) for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x0 + k * 2.5, -4); ctx.lineTo(x0 + k * 2.5, 4); ctx.stroke(); }
  ctx.fillStyle = "#e5e7eb"; ctx.fillRect(-6, -5, 12, 10); ctx.fillStyle = "#facc15"; ctx.fillRect(-6, -5, 12, 2);
  ctx.restore();
}
function drawOrbit(ctx, c, w, h) {
  const narrow = w < 560, r = E.R + ob.h, T = P.period(E, ob.h);
  const sc = (Math.min(w, h) / 2 - 22) / Math.max(1.6 * E.R, r * 1.08), cx = narrow ? w / 2 : w * 0.46, cy = h / 2 + 6;
  stars(ctx, c, w, h);
  // ma'lum orbitalar
  for (const [hh, name] of ORBITS) { const rr = (E.R + hh) * sc; if (rr > Math.max(w, h)) continue; ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); if (rr > E.R * sc + 14 && rr < Math.min(w, h) / 2) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(name, cx + rr * 0.71 + 3, cy - rr * 0.71); } }
  const rotE = (TAU * ob.t) / E.day, aS = -Math.PI / 2 + (TAU * ob.t) / T;
  body(ctx, c, cx, cy, E.R * sc, E, rotE);
  // Toshkent
  const aT = -Math.PI / 2 + rotE, tx = cx + Math.cos(aT) * E.R * sc, ty = cy + Math.sin(aT) * E.R * sc;
  ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, TAU); ctx.fill();
  // orbita va yo'ldosh
  ctx.strokeStyle = c.primary; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, TAU); ctx.stroke();
  const sx = cx + Math.cos(aS) * r * sc, sy = cy + Math.sin(aS) * r * sc;
  const geoNow = Math.abs(T - E.day) / E.day < 0.01;
  if (geoNow) { ctx.strokeStyle = c.danger; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]); }
  const vlen = 20 + 30 * (P.v1(E, ob.h) / 8);
  arrow(ctx, sx, sy, -Math.sin(aS) * -vlen * -1 * -1, Math.cos(aS) * vlen, c.success, { width: 2, head: 7, label: "v" });
  satellite(ctx, c, sx, sy, aS + Math.PI / 2);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 13, 0, TAU); ctx.stroke();
  geo.sat = { x: sx, y: sy, cx, cy, sc };
  // ma'lumot
  const ix = narrow ? 8 : 14;
  tag(ctx, `h = ${fmt(ob.h, 0)} km, v = ${fmt(P.v1(E, ob.h), 2)} km/s`, ix, 20, { color: c.text, bg: c.bg2, font: narrow ? SMALL : MID });
  tag(ctx, `T = ${T < 7200 ? `${fmt(T / 60, 1)} min` : T < 3 * 86400 ? `${fmt(T / 3600, 2)} soat` : `${fmt(T / 86400, 1)} sutka`}`, ix, 46, { color: c.primary, bg: c.bg2, font: BOLD });
  tag(ctx, `1 s = ${fmt(T / 6 / 60, 0)} min`, ix, 72, { color: c.text3, bg: c.bg2, font: SMALL });
  if (geoNow) tag(ctx, "geostatsionar: yo‘ldosh Toshkent ustida «qotib» turadi", narrow ? 8 : w - 14, h - 18, { color: "#fff", bg: c.danger, font: SMALL, align: narrow ? "left" : "right" });
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.dark ? "#020617" : c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "cannon") drawCannon(ctx, c, s.w, s.h); else drawOrbit(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.5, 360, 440)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "cannon") return drawHeights(ctx, gs, { p: pl(), shots: cn.shots, hover: ui.hover });
  return drawSpeed(ctx, gs, { p: E, h: ob.h, marks: ORBITS.slice(0, 3), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  cannon: ["Otilgan jismlarning balandligi h(t)", "Sekin otilgan jism tezda yerga tushadi. Tezlik oshgan sari u uzoqroqqa uchadi; v₁ da balandlik o‘zgarmaydi (doiraviy orbita), v₁ dan katta bo‘lsa jism uzoqlashib, yana qaytib keladi (ellips). v₂ va undan katta tezlikda u qaytib kelmaydi."],
  orbit: ["Doiraviy orbitadagi tezlik v(h)", "Orbita qancha baland bo‘lsa, yo‘ldosh shuncha sekin harakatlanadi va aylanish davri shuncha uzun. 35 786 km da davr bir sutkaga teng — geostatsionar orbita. Uzuq chiziq — o‘sha balandlikdan butunlay uzoqlashib ketish tezligi."],
};
function setTab() { const t = TABS[ui.mode]; ui.hover = null; $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); graph.render(); }

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const dur = (s) => (s < 7200 ? u(fmt(s / 60, 1), "min") : s < 3 * 86400 ? u(fmt(s / 3600, 2), "soat") : u(fmt(s / 86400, 1), "sutka"));

function updateReadouts() {
  if (ui.mode === "cannon") {
    const p = pl(), L = orbitType(p, cn.v), last = cn.shots[cn.shots.length - 1];
    setRO("r1", "Otish tezligi <i>v</i>", u(fmt(cn.v, 2), "km/s"), `${fmt(cn.v / P.v1(p, H0), 2)}·v₁`, "orange");
    setRO("r2", "Birinchi kosmik tezlik <i>v₁</i>", u(fmt(P.v1(p, 0), 2), "km/s"), `sirtda; 100 km da ${fmt(P.v1(p, H0), 2)} km/s`, "green");
    setRO("r3", "Ikkinchi kosmik tezlik <i>v₂</i>", u(fmt(P.v2(p, 0), 2), "km/s"), `= √2·v₁; 100 km da ${fmt(P.v2(p, H0), 2)} km/s`);
    setRO("r4", "Yo‘l turi", typeName(L.type), `k = rv²/GM = ${fmt(L.k, 3)}`, L.type === "fall" ? "" : "green");
    setRO("r5", L.type === "ellipse" || L.type === "circle" ? "Eng uzoq nuqta (apogey)" : "Eng yaqin nuqta", L.type === "ellipse" || L.type === "circle" ? u(fmt(L.ra - p.R, 0), "km") : u(fmt(Math.max(0, L.rp - p.R), 0), "km"), L.type === "fall" ? "orbita sayyora ichidan o‘tadi" : "sirtdan balandlik");
    const show = last && last.v === cn.v ? last : computeShotCached(p, cn.v);
    setRO("r6", show.landed ? "Uchish vaqti / masofa" : L.type === "ellipse" || L.type === "circle" ? "Aylanish davri <i>T</i>" : "Sayyoradan uzoqlashish", show.landed ? dur(show.tEnd) : L.type === "ellipse" || L.type === "circle" ? dur(show.tEnd) : "∞", show.landed ? `yoy bo‘yicha ${fmt(p.R * Math.abs(Math.atan2(show.pts[show.pts.length - 1][0], show.pts[show.pts.length - 1][1])), 0)} km` : L.type === "para" || L.type === "hyper" ? "qaytib kelmaydi" : "otilgan nuqtaga qaytadi");
    return;
  }
  const T = P.period(E, ob.h), v = P.v1(E, ob.h);
  setRO("r1", "Orbita balandligi <i>h</i>", u(fmt(ob.h, 0), "km"), `r = R + h = ${fmt(E.R + ob.h, 0)} km`, "orange");
  setRO("r2", "Orbital tezlik <i>v</i>", u(fmt(v, 2), "km/s"), `= ${fmt(v * 3600, 0)} km/soat`, "green");
  setRO("r3", "Aylanish davri <i>T</i>", dur(T), `sutkada ${fmt(86400 / T, 2)} marta aylanadi`);
  setRO("r4", "Markazga intilma tezlanish", u(fmt((E.GM / (E.R + ob.h) ** 2) * 1000, 2), "m/s²"), `= g(R/r)²; yer sirtida 9,82 m/s²`);
  setRO("r5", "Uzoqlashib ketish tezligi", u(fmt(P.v2(E, ob.h), 2), "km/s"), "shu balandlikdan, √2·v");
  const geoNow = Math.abs(T - E.day) / E.day < 0.01;
  setRO("r6", "Yer aylanishiga nisbatan", geoNow ? "bir xil" : T < E.day ? "tezroq" : "sekinroq", geoNow ? "geostatsionar orbita (h ≈ 35 786 km)" : `yulduz sutkasi 23 soat 56 min`, geoNow ? "green" : "");
}
let cache = { k: "", shot: null };
function computeShotCached(p, v) { const k = `${cn.planet}:${v}`; if (cache.k !== k) { const ci = cn.ci; cache = { k, shot: computeShot(p, v) }; cn.ci = ci; } return cache.shot; }
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "cannon") { const L = orbitType(pl(), cn.v); t = typeName(L.type); tone = L.type === "fall" ? "orange" : "green"; }
  else { t = `T = ${fmt(P.period(E, ob.h) / 3600, 2)} soat`; tone = "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "cannon") {
    const pp = pl(), L = orbitType(pp, cn.v);
    p.push(`<p>Nyuton tasavvur qilgan tajriba: baland tog‘ tepasidagi to‘p jismni gorizontal otadi. Jism tushayotganda ${pp.name} sirti ham uning ostidan «egilib» qochadi. Tezlik yetarlicha katta bo‘lsa, jism doim tushib, lekin sirtga yetolmay, sayyora atrofida aylanaveradi — bu <b>orbital harakat</b>.</p>`);
    p.push({ fall: `<p>v = ${fmt(cn.v, 2)} km/s birinchi kosmik tezlikdan kichik — jism ${pp.name}ga qaytib tushadi. Tezlikni oshirsangiz, u uzoqroqqa tushadi.</p>`, circle: `<p>v ≈ v₁: tortishish kuchi aynan markazga intilma tezlanish beradi (v²/r = GM/r²), shuning uchun balandlik o‘zgarmaydi — <b>doiraviy orbita</b>. Bu tezlik birinchi kosmik tezlik deyiladi: Yer sirtida v₁ = √(gR) ≈ 7,9 km/s.</p>`, ellipse: `<p>v₁ < v < v₂: jism otilgan nuqtadan uzoqlashadi, eng uzoq nuqtada (apogeyda) sekinlashib, yana qaytib keladi — <b>elliptik orbita</b>. Ko‘pchilik sun’iy yo‘ldosh va sayyoralar ellips bo‘ylab harakatlanadi (Keplerning 1-qonuni).</p>`, para: `<p>v = v₂ = √2·v₁: jismning kinetik energiyasi tortishish potensial energiyasini yengishga yetadi — u sayyoraga qaytib kelmaydi. Bu <b>ikkinchi kosmik tezlik</b> (Yer uchun 11,2 km/s). Oyga va boshqa sayyoralarga uchadigan kemalar shunday tezlik oladi.</p>`, hyper: `<p>v > v₂: jism giperbola bo‘ylab sayyoradan butunlay uzoqlashadi va undan uzoqda ham tezligi nolga tushmaydi.</p>` }[L.type]);
  } else {
    p.push("<p>Sun’iy yo‘ldosh doiraviy orbitada tortishish kuchi ta’sirida markazga intilma tezlanish bilan harakatlanadi: v = √(GM/r). Balandroq orbitada tortishish zaifroq, shuning uchun tezlik kichik, yo‘l esa uzun — davr tez ortadi.</p>");
    p.push("<p>Xalqaro kosmik stansiya (≈ 420 km) Yerni ≈ 93 minutda aylanadi. GPS yo‘ldoshlari 20 200 km da 12 soatda aylanadi. 35 786 km da davr Yerning o‘z o‘qi atrofida aylanish davriga teng: ekvator ustidagi bunday <b>geostatsionar</b> yo‘ldosh osmonda bir joyda turgandek ko‘rinadi — televideniye va aloqa yo‘ldoshlari shu orbitada. Oy — Yerning tabiiy yo‘ldoshi, 27,3 sutkada aylanadi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "cannon" ? "<small>Kosmik tezliklar</small> v₁ = √(gR),&nbsp; v₂ = √2·v₁" : "<small>Orbita</small> v = √(GM/r),&nbsp; T = 2πr/v";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "cannon") { const warp = P.period(pl(), H0) / 8; for (const s of cn.shots) if (s.tNow < s.tEnd) s.tNow = Math.min(s.tEnd, s.tNow + dt * warp); }
  else ob.t += dt * (P.period(E, ob.h) / 6);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.25) { uiTimer = 0; graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom";
}
playBtn.addEventListener("click", () => { if (loop.running) { loop.stop(); playing = false; } else { loop.start(); playing = true; } });
function startIfNeeded() {
  if (prefersReducedMotion()) { for (const s of cn.shots) s.tNow = s.tEnd; loop.stop(); setPlayUI(false); return; }
  if (!playing) { loop.stop(); setPlayUI(false); } else loop.start();
}
$("[data-reset]").addEventListener("click", () => { if (ui.mode === "cannon") { cn.shots = []; cn.ci = 0; } else ob.t = 0; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

function setV(v) { cn.v = clamp(Math.round(v * 100) / 100, 0, vMax()); cn.preview = computeShotCached(pl(), cn.v); vC.set(cn.v); }
const vC = bindRange($("#cV"), $("#cVOut"), (v) => `${fmt(v, 2)} km/s`, (v) => { setV(v); customized(); refresh(); });
const hC = bindRange($("#oH"), $("#oHOut"), (v) => `${fmt(hOfS(v), 0)} km`, (v) => { ob.s = v; ob.h = hOfS(v); customized(); refresh(); });
function setPlanet(k) {
  cn.planet = k; cn.shots = []; cn.ci = 0; cache.k = "";
  const inp = $("#cV"); inp.max = String(vMax()); inp.step = k === "jupiter" ? "0.1" : "0.01";
  document.querySelectorAll("[data-planet-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.planetValue === k)));
}
document.querySelectorAll("[data-planet-value]").forEach((b) => b.addEventListener("click", () => { setPlanet(b.dataset.planetValue); setV(P.v1(pl(), H0) * 0.9); customized(); refresh(); }));
function fire(v = cn.v) { const s = computeShot(pl(), v); if (prefersReducedMotion() || !loop.running) s.tNow = s.tEnd; cn.shots.push(s); if (cn.shots.length > 6) cn.shots.shift(); }
function setH(h) { ob.h = clamp(h, H_MIN, H_MAX); ob.s = sOfH(ob.h); hC.set(ob.s); }

/* Sahnada surish va bosish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode === "cannon") { if (inBox(p, geo.fire)) return { kind: "fire" }; if (inBox(p, geo.clear)) return { kind: "clear" }; const g = geo.tip; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= 18) return { kind: "tip" }; }
  else { const g = geo.sat; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= 22) return { kind: "sat" }; }
  return null;
}
function applyDrag(h, p) {
  if (h.kind === "tip") { const g = geo.tip; setV(((p.x - g.ax) / g.Lpx) * vMax()); }
  else if (h.kind === "sat") { const g = geo.sat, rr = Math.hypot(p.x - g.cx, p.y - g.cy) / g.sc; setH(rr - E.R); }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  e.preventDefault(); customized();
  if (h.kind === "fire") { fire(); refresh(); return; }
  if (h.kind === "clear") { cn.shots = []; cn.ci = 0; refresh(); return; }
  applyDrag(h, p);
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true"; refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "tip" ? "ew-resize" : h.kind === "sat" ? "grab" : "pointer"; return; }
  applyDrag(drag, p); refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const CN = (title, lesson, planet, v, shots = [v]) => ({ mode: "cannon", title, lesson, set: () => { setPlanet(planet); for (const sv of shots) fire(sv); setV(v); } });
const OB = (title, lesson, h) => ({ mode: "orbit", title, lesson, set: () => { setH(h); ob.t = 0; } });
const PRESETS = {
  cSlow: CN("Sekin otish (3 km/s)", "Jism 3 km/s tezlik bilan otildi: ≈ 470 km uchib, 2,6 minutda yerga tushdi. Tezlikni oshirib yana otib ko‘ring.", "earth", 3),
  cFast: CN("Tez, lekin yetarli emas (7 km/s)", "7 km/s — jism ≈ 2200 km uzoqlikka tushadi, sirt egriligi sezilarli. Yana ozgina tezlik kerak.", "earth", 7),
  cV1: CN("Birinchi kosmik tezlik", "v = 7,85 km/s (100 km balandlikda v₁): jism tushishda davom etadi, lekin Yer sirti ham shuncha «pastga ketadi» — balandlik o‘zgarmaydi. Bir aylanish ≈ 86 minut.", "earth", 7.85),
  cEllipse: CN("Elliptik orbita (9 km/s)", "v₁ dan katta tezlik: jism Yerdan ≈ 5200 km uzoqlashib, yana qaytib keladi. Otilgan nuqta — perigey, qarama-qarshi nuqta — apogey.", "earth", 9),
  cV2: CN("Ikkinchi kosmik tezlik", "v = 11,1 km/s (100 km balandlikda v₂): jism parabola bo‘ylab Yerdan butunlay uzoqlashadi.", "earth", 11.1),
  cNewton: CN("Nyuton rasmi: bir nechta otish", "Nyutonning «Olam tizimi» kitobidagi mashhur rasm: tezlik oshgan sari jism uzoqroqqa tushadi va nihoyat Yer atrofida aylanadi.", "earth", 9, [3, 5, 7, 7.85, 9]),
  cMoon: CN("Oyda otish", "Oyda tortishish 6 marta zaif: v₁ = 1,68 km/s, v₂ = 2,38 km/s. Apollon kemalari Oydan juda kichik tezlik bilan uchib keta olgan.", "moon", 1.66, [1.2, 1.66]),
  cMars: CN("Marsda otish", "Marsda v₁ = 3,55 km/s, v₂ = 5,03 km/s — Yerdagidan ancha kichik.", "mars", 3.5, [2.5, 3.5]),
  cJupiter: CN("Yupiterda otish", "Yupiter juda massiv: v₁ ≈ 42 km/s, v₂ ≈ 60 km/s. Yupiterdan raketa bilan uchib ketish deyarli imkonsiz.", "jupiter", 40, [30, 40]),
  oISS: OB("XKS (420 km)", "Xalqaro kosmik stansiya 420 km balandlikda 7,66 km/s tezlik bilan uchadi va Yerni ≈ 93 minutda aylanadi — sutkada 15,5 marta.", 420),
  oGPS: OB("GPS yo‘ldoshi (20 200 km)", "GPS yo‘ldoshlari 20 200 km da 3,9 km/s tezlik bilan 12 soatda bir aylanadi.", 20200),
  oGeo: OB("Geostatsionar orbita", "35 786 km: yo‘ldosh Yer bilan bir xil burchak tezlik bilan aylanadi va Toshkent (qizil nuqta) bilan bir chiziqda qoladi. Sun’iy yo‘ldosh antennalari shuning uchun qimirlamaydi.", 35786),
  oMoon: OB("Oy orbitasi", "Oy Yerdan ≈ 384 000 km uzoqlikda ≈ 1 km/s tezlik bilan 27,3 sutkada aylanadi.", H_MAX),
};
const GROUPS = [["Nyuton to‘pi", ["cSlow", "cFast", "cV1", "cEllipse", "cV2", "cNewton"]], ["Boshqa osmon jismlari", ["cMoon", "cMars", "cJupiter"]], ["Sun’iy yo‘ldoshlar", ["oISS", "oGPS", "oGeo", "oMoon"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { cannon: "Tezlik strelkasini suring, «Otish!»", orbit: "Yo‘ldoshni suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", ui.mode === "cannon" ? "Sayyora, tog‘ tepasidagi to‘p, otilgan jismlarning yo‘llari" : "Aylanayotgan Yer, sun’iy yo‘ldosh va uning orbitasi");
}
const MODE_DEFAULT = { cannon: "cNewton", orbit: "oISS" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; startIfNeeded(); p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  setTab(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "cNewton");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
