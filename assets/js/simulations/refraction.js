// ==========================================================================
// Yorug'likning qaytishi va sinishi — virtual laboratoriya (simulations/refraction-law.html)
// 1) Ikki muhit chegarasi: Snell qonuni, qaytish, Frenel, kritik burchak, to'liq ichki qaytish, to'lqin frontlari.
// 2) Plastinka va prizma: yassi-parallel plastinka (lab: n ni o'lchash), yarim silindr, prizma, optik tola — 2D nur kuzatuvchi.
// 3) Ko'zgular: yassi ko'zgu (qaytish qonuni, mavhum tasvir), ikki ko'zgu (tasvirlar soni), botiq/qavariq ko'zgu.
// Fizika: reflection-physics.js (Node'da tekshirilgan). Grafiklar: reflection-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, angleArc, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./reflection-physics.js";
import { traceRay } from "./optics-physics.js";
import * as G from "./reflection-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const DEG = P.DEG;
const RAY = ["#ef4444", "#16a34a", "#2563eb"];
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "refr", tab: "ba", phase: 0, show: { reflect: true, waves: true, angles: true, partial: true } };
const refr = { n1: 1, n2: 1.5, alpha: 40 };
const body = { obj: "slab", entry: "flat", alpha: 40, n: 1.5, t: 5, A: 60, B: 45, unknown: false, revealed: false, nHidden: 1.57, pts: [] };
const mir = { kind: "plane", d: 6, eye: { x: -8, y: 5.5 }, phi: 60, pos: 50, R: 20, sd: 30, h: 3 };
let presetId = null;

const nBody = () => (body.unknown && (body.obj === "slab" || body.obj === "semi") ? body.nHidden : body.n);
const hidden = () => body.unknown && !body.revealed && (body.obj === "slab" || body.obj === "semi");
const subKey = () => (ui.mode === "refr" ? "refr" : ui.mode === "body" ? body.obj : mir.kind);

/* ------------------------------------------------------------------ Dunyo → ekran (bir xil masshtab) */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(cw, ch, x0, x1, y0, y1, pad = 14) {
  const s = Math.min((cw - 2 * pad) / (x1 - x0), (ch - 2 * pad) / (y1 - y0));
  view.s = s;
  view.ox = (cw - (x1 - x0) * s) / 2; view.oy = (ch - (y1 - y0) * s) / 2;
  view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });

function line(ctx, a, b, color, w = 1.5, dash = null, alpha = 1) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = alpha; ctx.setLineDash(dash || []); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(SX(a.x), SY(a.y)); ctx.lineTo(SX(b.x), SY(b.y)); ctx.stroke(); ctx.restore();
}
/** Burchak yoyi ikki dunyo vektori orasida (kichik yoy), markaz p. */
function arcBetween(ctx, p, v1, v2, r, color, label) {
  const a1 = Math.atan2(-v1.y, v1.x), a2 = Math.atan2(-v2.y, v2.x);
  let diff = a2 - a1; while (diff > Math.PI) diff -= TAU; while (diff <= -Math.PI) diff += TAU;
  if (Math.abs(diff) < 0.6 * DEG) return;
  const s = diff >= 0 ? a1 : a2;
  angleArc(ctx, SX(p.x), SY(p.y), r, s, s + Math.abs(diff), color, { label, font: "italic 600 13px Inter, system-ui, sans-serif" });
}
function candle(ctx, px, py, r = 10) {
  const g = ctx.createRadialGradient(px, py, 1, px, py, r);
  g.addColorStop(0, "rgba(253,224,71,0.95)"); g.addColorStop(1, "rgba(253,224,71,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
}
function objArrowW(ctx, x, yb, yt, color, dashed = false, flame = false, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3; if (dashed) ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(SX(x), SY(yb)); ctx.lineTo(SX(x), SY(yt)); ctx.stroke(); ctx.setLineDash([]);
  const dir = yt >= yb ? 1 : -1, hd = 8;
  ctx.beginPath(); ctx.moveTo(SX(x), SY(yt)); ctx.lineTo(SX(x) - hd * 0.6, SY(yt) + dir * hd); ctx.lineTo(SX(x) + hd * 0.6, SY(yt) + dir * hd); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (flame) candle(ctx, SX(x), SY(yt) - 6 * dir, 12);
}
function eyeIcon(ctx, c, px, py, facing = 1) {
  ctx.save(); ctx.translate(px, py); ctx.scale(facing, 1); ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.fillStyle = c.bg;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, -13, 14, 0); ctx.quadraticCurveTo(0, 13, -14, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text; ctx.beginPath(); ctx.arc(4, 0, 4.5, 0, TAU); ctx.fill(); ctx.restore();
}
/** Ko'zgu orqa tomonidagi shtrixlar: a→b kesma, orqa tomon normali nb (dunyo). */
function hatch(ctx, c, a, b, nb, step = 9) {
  const L = Math.hypot(SX(b.x) - SX(a.x), SY(b.y) - SY(a.y)), k = Math.floor(L / step);
  ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= k; i++) {
    const t = i / Math.max(1, k), px = SX(a.x + (b.x - a.x) * t), py = SY(a.y + (b.y - a.y) * t);
    const ux = (SX(b.x) - SX(a.x)) / L, uy = (SY(b.y) - SY(a.y)) / L;
    ctx.moveTo(px, py); ctx.lineTo(px + nb.x * 7 - ux * 5, py - nb.y * 7 - uy * 5);
  }
  ctx.stroke(); ctx.restore();
  line(ctx, a, b, c.text, 3.5);
}

/* ================================================================== 1) Ikki muhit chegarasi */

const handle = { x: 0, y: 0 };
function rayEnd(ox, oy, dx, dy, w, h) {
  const tx = dx > 0 ? (w - ox) / dx : dx < 0 ? -ox / dx : Infinity;
  const ty = dy > 0 ? (h - oy) / dy : dy < 0 ? -oy / dy : Infinity;
  return Math.min(tx, ty);
}
function drawRayPx(ctx, ox, oy, dx, dy, len, color, alpha, width = 3.5) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * len, oy + dy * len); ctx.stroke(); ctx.restore();
}
function drawFronts(ctx, ox, oy, dx, dy, from, to, spacing, offset, color, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round";
  const px = -dy, py = dx, half = 7;
  let s = from + ((((offset - from) % spacing) + spacing) % spacing);
  ctx.beginPath();
  for (; s <= to; s += spacing) { const cx = ox + dx * s, cy = oy + dy * s; ctx.moveTo(cx - px * half, cy - py * half); ctx.lineTo(cx + px * half, cy + py * half); }
  ctx.stroke(); ctx.restore();
}
function chevron(ctx, x, y, dx, dy, color, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx));
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawRefr(ctx, { w, h, colors: c }) {
  const ox = w / 2, oy = h / 2, { n1, n2 } = refr;
  const r = P.snell(n1, n2, refr.alpha);
  const tint = (n) => 0.05 + ((n - 1) / 1.5) * (c.dark ? 0.28 : 0.22);
  ctx.save(); ctx.fillStyle = c.primary; ctx.globalAlpha = tint(n1); ctx.fillRect(0, 0, w, oy); ctx.globalAlpha = tint(n2); ctx.fillRect(0, oy, w, h - oy); ctx.restore();
  ctx.save(); ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = ox % 32; x < w; x += 32) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = oy % 32; y < h; y += 32) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke(); ctx.restore();
  ctx.save(); ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.25; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(ox, 10); ctx.lineTo(ox, h - 10); ctx.stroke(); ctx.restore();
  const ray = c.warning, a = r.a, sinA = Math.sin(a), cosA = Math.cos(a);
  if (r.critical !== null && ui.show.angles) {
    const dx = -Math.sin(r.critical), dy = -Math.cos(r.critical), k = Math.min(rayEnd(ox, oy, dx, dy, w, h) * 0.8, Math.min(w, h) * 0.36);
    ctx.save(); ctx.strokeStyle = c.danger; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * k, oy + dy * k); ctx.stroke(); ctx.restore();
    tag(ctx, `kritik ${fmt(r.critical / DEG, 1)}°`, Math.max(ox + dx * k, 58), oy + dy * k - 14, { color: c.danger, bg: c.bg, align: "center", font: MID });
  }
  const inc = { dx: sinA, dy: cosA }, refl = { dx: sinA, dy: -cosA }, rf = r.tir ? null : { dx: Math.sin(r.beta), dy: Math.cos(r.beta) };
  const lenIn = rayEnd(ox, oy, -inc.dx, -inc.dy, w, h), lenRefl = rayEnd(ox, oy, refl.dx, refl.dy, w, h), lenRefr = rf ? rayEnd(ox, oy, rf.dx, rf.dy, w, h) : 0;
  const aR = r.tir ? 1 : clamp(0.16 + 0.84 * Math.sqrt(r.R), 0, 1), aT = rf ? clamp(0.25 + 0.75 * r.T, 0, 1) : 0;
  const showR = ui.show.reflect || r.tir;
  ctx.save(); ctx.shadowColor = ray; ctx.shadowBlur = c.dark ? 14 : 8;
  drawRayPx(ctx, ox, oy, -inc.dx, -inc.dy, lenIn, ray, 1);
  if (showR) drawRayPx(ctx, ox, oy, refl.dx, refl.dy, lenRefl, ray, aR, r.tir ? 3.5 : 3);
  if (rf) drawRayPx(ctx, ox, oy, rf.dx, rf.dy, lenRefr, ray, aT, 3.5);
  ctx.restore();
  if (ui.show.waves) {
    const l0 = 34, ph = ui.phase % 1, l1 = l0 / n1, l2 = l0 / n2;
    drawFronts(ctx, ox, oy, inc.dx, inc.dy, -lenIn, 0, l1, ph * l1, c.text, 0.55);
    if (showR) drawFronts(ctx, ox, oy, refl.dx, refl.dy, 0, lenRefl, l1, ph * l1, c.text, 0.55 * aR);
    if (rf) drawFronts(ctx, ox, oy, rf.dx, rf.dy, 0, lenRefr, l2, ph * l2, c.text, 0.55 * aT);
  }
  const mid = Math.min(lenIn, 200) * 0.55;
  chevron(ctx, ox - inc.dx * mid, oy - inc.dy * mid, inc.dx, inc.dy, ray, 1);
  if (showR) chevron(ctx, ox + refl.dx * mid, oy + refl.dy * mid, refl.dx, refl.dy, ray, aR);
  if (rf) { const m2 = Math.min(lenRefr, 200) * 0.55; chevron(ctx, ox + rf.dx * m2, oy + rf.dy * m2, rf.dx, rf.dy, ray, aT); }
  if (ui.show.angles && a > 0.5 * DEG) {
    const R0 = Math.min(64, h * 0.16);
    angleArc(ctx, ox, oy, R0, -Math.PI / 2 - a, -Math.PI / 2, c.primary, { label: "α" });
    if (showR) angleArc(ctx, ox, oy, R0 + 18, -Math.PI / 2, -Math.PI / 2 + a, c.text2, { label: "γ" });
    if (rf && r.beta > 0.5 * DEG) angleArc(ctx, ox, oy, R0, Math.PI / 2 - r.beta, Math.PI / 2, c.success, { label: "β" });
  }
  ctx.save(); ctx.fillStyle = c.bg; ctx.strokeStyle = ray; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ox, oy, 5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  const k = Math.min(lenIn * 0.86, Math.min(w, h) * 0.42), hx = ox - inc.dx * k, hy = oy - inc.dy * k;
  handle.x = hx; handle.y = hy;
  ctx.save(); ctx.fillStyle = ray; ctx.shadowColor = ray; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(hx, hy, 11, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, TAU); ctx.fill(); ctx.restore();
  const m1 = P.MATERIALS.find((m) => Math.abs(m.n - n1) < 0.005)?.name, m2 = P.MATERIALS.find((m) => Math.abs(m.n - n2) < 0.005)?.name;
  tag(ctx, `1-muhit${m1 ? " · " + m1 : ""} · n₁ = ${fmt(n1)}`, 12, 18, { color: c.text, bg: c.bg, font: MID });
  tag(ctx, `2-muhit${m2 ? " · " + m2 : ""} · n₂ = ${fmt(n2)}`, 12, h - 18, { color: c.text, bg: c.bg, font: MID });
  tag(ctx, "normal", ox + 8, 18, { color: c.text3, bg: c.bg, font: SMALL });
  if (r.tir) tag(ctx, "To‘liq ichki qaytish — nur 2-muhitga o‘tmaydi", ox, oy + 30, { color: c.danger, bg: c.bg, align: "center", font: MID });
}

/* ================================================================== 2) Shisha jismlar */

const FIBER = { len: 22, w: 3, Rb: 8 };
function bodyScene() {
  const n = nBody(), al = body.alpha;
  if (body.obj === "slab") {
    const t = body.t, shape = P.slabShape(26, t, n), H = { x: -4, y: t / 2 };
    const dir = { x: Math.sin(al * DEG), y: -Math.cos(al * DEG) };
    return { shapes: [shape], o: { x: H.x - dir.x * 40, y: H.y - dir.y * 40 }, dir, H, bounds: [-14, 14, -t / 2 - 5.5, t / 2 + 6.5] };
  }
  if (body.obj === "semi") {
    const r = 8, shape = P.semiShape(r, n);
    const dir = body.entry === "flat" ? { x: Math.sin(al * DEG), y: -Math.cos(al * DEG) } : { x: Math.sin(al * DEG), y: Math.cos(al * DEG) };
    return { shapes: [shape], o: { x: -dir.x * 40, y: -dir.y * 40 }, dir, H: { x: 0, y: 0 }, bounds: [-13, 13, -11.3, 10.6] };
  }
  if (body.obj === "prism") {
    const s = 14, pr = P.prismShape(body.A, s, n);
    const mid = { x: (pr.apex.x + pr.L.x) / 2, y: (pr.apex.y + pr.L.y) / 2 };
    const fx = pr.L.x - pr.apex.x, fy = pr.L.y - pr.apex.y, fl = Math.hypot(fx, fy);
    let nx = -fy / fl, ny = fx / fl; if (nx > 0) { nx = -nx; ny = -ny; }
    const cA = Math.cos(al * DEG), sA = Math.sin(al * DEG), inw = { x: -nx, y: -ny };
    const dir = { x: inw.x * cA - inw.y * sA, y: inw.x * sA + inw.y * cA };
    const h = s * Math.cos((body.A * DEG) / 2);
    return { shapes: [pr], o: { x: mid.x - dir.x * 40, y: mid.y - dir.y * 40 }, dir, H: mid, prism: pr, bounds: [-17, 17, -h / 2 - 4, h / 2 + 3] };
  }
  const f = P.fiberShape(FIBER.len, FIBER.w, FIBER.Rb, body.B, n);
  const dir = { x: Math.cos(al * DEG), y: Math.sin(al * DEG) }, H = { x: -FIBER.len, y: -0.4 };
  const xr = Math.max(4, FIBER.Rb + FIBER.w + 2) * (body.B > 1 ? 1 : 0.3);
  return { shapes: [f], o: { x: H.x - dir.x * 40, y: H.y - dir.y * 40 }, dir, H, fiber: f, bounds: [-FIBER.len - 6, Math.max(3, xr), body.B > 1 ? -FIBER.Rb - FIBER.w - 2 - (body.B > 60 ? 2 : 0) : -6, 5] };
}
let bodyCache = null;
function bodyTrace() {
  const sc = bodyScene();
  const opts = body.obj === "fiber" ? { maxDepth: 90, maxSegs: 500, minI: 0.01 } : { maxDepth: 8, maxSegs: 200, minI: 0.01 };
  const tr = P.trace(sc.shapes, sc.o, sc.dir, opts);
  bodyCache = { sc, tr };
  return bodyCache;
}
/** Optik tolaning chiqish uchiga yetgan energiya ulushi. */
function fiberTransmission(alpha) {
  const n = nBody(), f = P.fiberShape(FIBER.len, FIBER.w, FIBER.Rb, body.B, n);
  const dir = { x: Math.cos(alpha * DEG), y: Math.sin(alpha * DEG) }, H = { x: -FIBER.len, y: -0.4 };
  const tr = P.trace([f], { x: H.x - dir.x * 10, y: H.y - dir.y * 10 }, dir, { maxDepth: 120, maxSegs: 600, minI: 0.003 });
  const e = { a: f.endTop, b: f.endBot }, ex = e.b.x - e.a.x, ey = e.b.y - e.a.y, L2 = ex * ex + ey * ey;
  let s = 0;
  for (const g of tr.segs) {
    if (!g.out) continue;
    const t = ((g.a.x - e.a.x) * ex + (g.a.y - e.a.y) * ey) / L2;
    const px = e.a.x + t * ex, py = e.a.y + t * ey;
    if (t > -1e-3 && t < 1 + 1e-3 && Math.hypot(px - g.a.x, py - g.a.y) < 1e-3) s += g.I;
  }
  return s;
}
function mainEvents() { return bodyCache ? bodyCache.tr.events.filter((e) => e.main) : []; }

function drawBody(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const { sc, tr } = bodyTrace();
  fit(cw, ch, ...sc.bounds);
  const n = nBody();
  // jism
  sc.shapes.forEach((s) => {
    ctx.save(); ctx.beginPath();
    s.edges.forEach((e, i) => { if (i === 0) ctx.moveTo(SX(e.a.x), SY(e.a.y)); ctx.lineTo(SX(e.b.x), SY(e.b.y)); });
    ctx.closePath(); ctx.fillStyle = c.primary; ctx.globalAlpha = 0.07 + clamp((n - 1) / 1.5, 0, 1) * (c.dark ? 0.22 : 0.16); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  });
  // yarim silindr: transportir
  if (body.obj === "semi" && ui.show.angles) {
    const r0 = 9.4, cx = SX(0), cy = SY(0), R = r0 * view.s;
    ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.font = "500 9px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let d = 0; d < 360; d += 5) {
      const a = d * DEG, len = d % 30 === 0 ? 9 : d % 10 === 0 ? 6 : 3.5;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len)); ctx.stroke();
      if (d % 30 === 0) { const fromN = Math.round(Math.abs(((((d + 90) % 180) + 180) % 180) - 90)); const v = 90 - fromN; ctx.fillText(`${v}°`, cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 18)); }
    }
    ctx.restore();
  }
  // normal(lar)
  const evs = tr.events.filter((e) => e.main);
  const showN = body.obj === "fiber" ? evs.slice(0, 1) : evs.slice(0, 3);
  if (ui.show.angles) showN.forEach((e) => {
    if (body.obj === "semi" && e.a < 0.5 * DEG) return;
    const L = body.obj === "fiber" ? 2.6 : 3.4;
    line(ctx, { x: e.p.x - e.nrm.x * L, y: e.p.y - e.nrm.y * L }, { x: e.p.x + e.nrm.x * L, y: e.p.y + e.nrm.y * L }, c.text3, 1.2, [5, 4]);
  });
  // plastinka: tushuvchi nur davomi va siljish
  if (body.obj === "slab" && evs.length >= 2 && !evs[0].tir) {
    const H = sc.H, d = sc.dir, E = evs[1].p, Lx = (E.y - H.y) / d.y + 6;
    line(ctx, H, { x: H.x + d.x * Lx, y: H.y + d.y * Lx }, c.warning, 1.4, [6, 5], 0.6);
    const k = (E.x - H.x) * d.x + (E.y - H.y) * d.y, Pp = { x: H.x + d.x * k, y: H.y + d.y * k };
    if (Math.hypot(E.x - Pp.x, E.y - Pp.y) > 0.25) {
      line(ctx, E, Pp, c.special, 1.8);
      tag(ctx, "Δ", (SX(E.x) + SX(Pp.x)) / 2 + 10, (SY(E.y) + SY(Pp.y)) / 2 + 10, { color: c.special, bg: c.bg, font: "italic 700 12px Inter, system-ui, sans-serif" });
    }
  }
  // prizma: og'ish burchagi — tushuvchi nur davomi
  if (body.obj === "prism") {
    line(ctx, sc.H, { x: sc.H.x + sc.dir.x * 22, y: sc.H.y + sc.dir.y * 22 }, c.warning, 1.4, [6, 5], 0.55);
  }
  // nurlar
  const segs = tr.segs.slice().sort((a, b) => a.I - b.I);
  segs.forEach((g) => {
    if (!g.main && !ui.show.partial) return;
    if (g.main) {
      ctx.save(); ctx.shadowColor = c.warning; ctx.shadowBlur = c.dark ? 12 : 6;
      line(ctx, g.a, g.b, c.warning, 3, null, clamp(0.35 + 0.65 * g.I, 0.35, 1)); ctx.restore();
    } else line(ctx, g.a, g.b, c.warning, 1.6, null, clamp(0.12 + g.I * 1.6, 0.12, 0.7));
  });
  // burchaklar
  if (ui.show.angles) {
    showN.forEach((e, k) => {
      const din = segDirInto(tr, e); if (!din) return;
      const back = { x: -din.x, y: -din.y };
      const rr = 30 + (k % 2) * 4;
      if (body.obj === "semi" && e.a < 0.5 * DEG) return;
      const lbIn = body.obj === "semi" && body.entry === "arc" ? "α" : k === 0 ? "α" : body.obj === "prism" ? "β₂" : "β";
      arcBetween(ctx, e.p, back, e.nrm, rr, c.primary, lbIn);
      if (!e.tir && e.b !== null && e.b > 0.5 * DEG) {
        const out = P.refractVec(din, e.nrm, e.n1, e.n2);
        if (out) arcBetween(ctx, e.p, out, { x: -e.nrm.x, y: -e.nrm.y }, rr, c.success, body.obj === "semi" && body.entry === "arc" ? "β" : k === 0 ? (body.obj === "prism" ? "β₁" : "β") : body.obj === "prism" ? "α₂" : "α′");
      }
    });
  }
  // yorliqlar
  const nTxt = hidden() ? "n = ?" : `n = ${fmt(n, 2)}`;
  const title = { slab: "Yassi-parallel shisha plastinka", semi: "Shisha yarim silindr", prism: `Shisha prizma, A = ${fmt(body.A, 0)}°`, fiber: "Optik tola" }[body.obj];
  tag(ctx, `${title} · ${nTxt}`, 12, 16, { color: c.text, bg: c.bg2, font: MID });
  const tirEv = evs.find((e) => e.tir);
  if (body.obj === "semi" && tirEv) tag(ctx, "To‘liq ichki qaytish", cw - 12, 16, { color: c.danger, bg: c.bg, align: "right", font: MID });
  if (body.obj === "prism") {
    const r = P.prismDeviation(body.A, n, body.alpha);
    tag(ctx, r.tir ? "2-yoqda to‘liq ichki qaytish" : `Og‘ish δ = ${fmt(r.delta, 1)}°`, cw - 12, 16, { color: r.tir ? c.danger : c.special, bg: c.bg, align: "right", font: MID });
  }
  if (body.obj === "fiber") {
    const nT = evs.filter((e) => e.tir).length, T = fiberTransmission(body.alpha);
    tag(ctx, `${nT} marta to‘liq ichki qaytish · chiqishda ${fmt(T * 100, 0)}%`, cw - 12, 16, { color: T > 0.5 ? c.success : c.danger, bg: c.bg, align: "right", font: MID });
    const f = sc.fiber; candle(ctx, (SX(f.endTop.x) + SX(f.endBot.x)) / 2 + 6 * f.exitDir.x, (SY(f.endTop.y) + SY(f.endBot.y)) / 2 - 6 * f.exitDir.y, 8 + 14 * T);
  }
  // manba
  const src = { x: sc.H.x - sc.dir.x * (body.obj === "fiber" ? 4.5 : body.obj === "semi" ? 11.5 : 7), y: sc.H.y - sc.dir.y * (body.obj === "fiber" ? 4.5 : body.obj === "semi" ? 11.5 : 7) };
  ctx.save(); ctx.fillStyle = c.warning; ctx.shadowColor = c.warning; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(SX(src.x), SY(src.y), 7, 0, TAU); ctx.fill(); ctx.restore();
}
/** Hodisa nuqtasiga kelgan nur yo'nalishi. */
function segDirInto(tr, e) {
  for (const g of tr.segs) if (Math.hypot(g.b.x - e.p.x, g.b.y - e.p.y) < 1e-9) { const dx = g.b.x - g.a.x, dy = g.b.y - g.a.y, l = Math.hypot(dx, dy); if (l > 0) return { x: dx / l, y: dy / l }; }
  return null;
}

/* ================================================================== 3) Ko'zgular */

const PLANE = { y0: -6, y1: 6, base: -4, tip: 0 };
function planeGeom() {
  const O = { x: -mir.d, y: PLANE.tip }, I = { x: mir.d, y: PLANE.tip }, E = mir.eye;
  const t = (0 - I.x) / (E.x - I.x), Pm = { x: 0, y: I.y + (E.y - I.y) * t };
  const Ob = { x: -mir.d, y: PLANE.base }, Ib = { x: mir.d, y: PLANE.base };
  const tb = (0 - Ib.x) / (E.x - Ib.x), Pb = { x: 0, y: Ib.y + (E.y - Ib.y) * tb };
  const seen = Pm.y >= PLANE.y0 && Pm.y <= PLANE.y1 && Pb.y >= PLANE.y0 && Pb.y <= PLANE.y1;
  const a = Math.atan2(Math.abs(O.y - Pm.y), Math.abs(O.x)) / DEG;
  return { O, I, E, Pm, Ob, Ib, Pb, seen, alpha: a, okTip: Pm.y >= PLANE.y0 && Pm.y <= PLANE.y1 };
}
function drawPlane(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  fit(cw, ch, -15, 13, -8, 8);
  const g = planeGeom();
  ctx.save(); ctx.fillStyle = c.bg2; ctx.fillRect(SX(0), 0, cw - SX(0), ch); ctx.restore();
  tag(ctx, "ko‘zgu orti", SX(0) + 12, 16, { color: c.text3, bg: c.bg2, font: SMALL });
  // dasta: uchidan 6 nur
  for (let k = 0; k < 5; k++) {
    const ym = PLANE.y0 + 1 + (k * (PLANE.y1 - PLANE.y0 - 2)) / 4, Pk = { x: 0, y: ym };
    if (Math.abs(ym - g.Pm.y) < 0.8) continue;
    const dx = Pk.x - g.O.x, dy = Pk.y - g.O.y, L = 7, l = Math.hypot(dx, dy);
    line(ctx, g.O, Pk, "#f59e0b", 1, null, 0.3);
    line(ctx, Pk, { x: Pk.x - (dx / l) * L, y: Pk.y + (dy / l) * L }, "#f59e0b", 1, null, 0.3);
    line(ctx, Pk, g.I, "#f59e0b", 1, [3, 4], 0.25);
  }
  hatch(ctx, c, { x: 0, y: PLANE.y0 }, { x: 0, y: PLANE.y1 }, { x: 1, y: 0 });
  // ko'zga boradigan nurlar
  if (g.okTip) {
    line(ctx, g.O, g.Pm, c.warning, 2.6); line(ctx, g.Pm, g.E, c.warning, 2.6); line(ctx, g.Pm, g.I, c.warning, 1.5, [6, 5], 0.8);
    if (ui.show.angles) {
      line(ctx, { x: -3.2, y: g.Pm.y }, { x: 0, y: g.Pm.y }, c.text3, 1.2, [5, 4]);
      const vin = { x: g.O.x - g.Pm.x, y: g.O.y - g.Pm.y }, vout = { x: g.E.x - g.Pm.x, y: g.E.y - g.Pm.y };
      arcBetween(ctx, g.Pm, vin, { x: -1, y: 0 }, 48, c.primary, "α");
      arcBetween(ctx, g.Pm, { x: -1, y: 0 }, vout, 48, c.success, "γ");
    }
  }
  if (g.Pb.y >= PLANE.y0 && g.Pb.y <= PLANE.y1) { line(ctx, g.Ob, g.Pb, c.warning, 1.6, null, 0.6); line(ctx, g.Pb, g.E, c.warning, 1.6, null, 0.6); line(ctx, g.Pb, g.Ib, c.warning, 1.2, [6, 5], 0.5); }
  objArrowW(ctx, -mir.d, PLANE.base, PLANE.tip, c.warning, false, true);
  objArrowW(ctx, mir.d, PLANE.base, PLANE.tip, c.special, true, false, 0.85);
  tag(ctx, "buyum", SX(-mir.d), SY(PLANE.base) + 14, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, "mavhum tasvir", SX(mir.d), SY(PLANE.base) + 14, { color: c.special, bg: c.bg2, align: "center", font: SMALL });
  // masofalar
  const yd = PLANE.base - 2.2;
  line(ctx, { x: -mir.d, y: yd }, { x: 0, y: yd }, c.text2, 1.2); line(ctx, { x: 0, y: yd }, { x: mir.d, y: yd }, c.special, 1.2);
  tag(ctx, `d = ${fmt(mir.d, 1)} cm`, SX(-mir.d / 2), SY(yd) + 12, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, `d′ = ${fmt(mir.d, 1)} cm`, SX(mir.d / 2), SY(yd) + 12, { color: c.special, bg: c.bg2, align: "center", font: SMALL });
  eyeIcon(ctx, c, SX(g.E.x), SY(g.E.y), 1);
  if (!g.okTip) tag(ctx, "Ko‘z tasvirni ko‘rmaydi — nur ko‘zgu chetidan o‘tib ketadi", cw / 2 - 40, ch - 16, { color: c.danger, bg: c.bg, align: "center", font: MID });
}

function twoGeom() {
  const phi = mir.phi, th = (mir.pos / 100) * phi * DEG, r = 5;
  const O = { x: r * Math.cos(th), y: r * Math.sin(th) };
  return { O, imgs: P.twoMirrorImages(phi, O), r };
}
function drawTwo(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  fit(cw, ch, -9.5, 9.5, -8, 8.6);
  const { O, imgs, r } = twoGeom(), phi = mir.phi * DEG, Lm = 8.2;
  // xona (ponasimon soha)
  ctx.save(); ctx.fillStyle = c.primary; ctx.globalAlpha = 0.06; ctx.beginPath(); ctx.moveTo(SX(0), SY(0)); ctx.arc(SX(0), SY(0), Lm * view.s, 0, -phi, true); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle = c.border; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(SX(0), SY(0), r * view.s, 0, TAU); ctx.stroke(); ctx.restore();
  // ko'zgular
  hatch(ctx, c, { x: 0, y: 0 }, { x: Lm, y: 0 }, { x: 0, y: -1 });
  hatch(ctx, c, { x: 0, y: 0 }, { x: Lm * Math.cos(phi), y: Lm * Math.sin(phi) }, { x: -Math.sin(phi), y: Math.cos(phi) });
  if (ui.show.angles) arcBetween(ctx, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: Math.cos(phi), y: Math.sin(phi) }, 26, c.primary, "φ");
  imgs.forEach((im) => {
    const px = SX(im.p.x), py = SY(im.p.y);
    ctx.save(); ctx.globalAlpha = Math.max(0.35, 0.85 - im.order * 0.08); candle(ctx, px, py, 11); ctx.fillStyle = c.special; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill(); ctx.restore();
    tag(ctx, String(imgs.indexOf(im) + 1), px + 9, py - 11, { color: c.special, bg: c.bg, font: "700 10px Inter, system-ui, sans-serif", pad: 4 });
  });
  candle(ctx, SX(O.x), SY(O.y), 14);
  ctx.save(); ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(SX(O.x), SY(O.y), 5.5, 0, TAU); ctx.fill(); ctx.restore();
  tag(ctx, "buyum", SX(O.x), SY(O.y) + 16, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, `Tasvirlar soni: ${imgs.length}`, 12, 16, { color: c.special, bg: c.bg2, font: "700 11px Inter, system-ui, sans-serif" });
}

function sphView(cw, ch) {
  // masshtab buyumni sudraganda o'zgarmaydi (faqat R ga bog'liq)
  const x0 = -42, x1 = mir.kind === "concave" ? 22 : clamp(mir.R + 5, 12, 30);
  view.x1 = x1;
  view.x0 = x0; view.s = (cw - 30) / (x1 - x0); view.ox = 15;
  view.sy = (ch * 0.4) / 10; view.oyC = ch * 0.5;
}
const MX = (x) => view.ox + (x - view.x0) * view.s;
const MY = (y) => view.oyC - y * view.sy;
function sphRays() {
  const R = mir.kind === "concave" ? mir.R : -mir.R, F = R / 2, d = mir.sd, h = mir.h;
  const st = [{ u: 0, color: RAY[0] }, { u: -h / d, color: RAY[1] }];
  if (Math.abs(d - F) > 0.3) st.push({ u: -h / (d - F), color: RAY[2] });
  return { R, F, d, h, rays: st.map((s) => ({ ...s, tr: traceRay([{ x: 0, F }], -d, h, s.u, 1) })) };
}
function drawSph(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  sphView(cw, ch);
  const { R, F, d, h, rays } = sphRays(), Hm = 9, img = P.sphericalMirror(R, d);
  ctx.save(); ctx.fillStyle = c.bg2; ctx.fillRect(MX(0), 0, cw - MX(0), ch); ctx.restore();
  ctx.save(); ctx.strokeStyle = c.borderStrong; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(MX(view.x0), MY(0)); ctx.lineTo(MX(view.x1), MY(0)); ctx.stroke(); ctx.restore();
  // F va C belgilari
  const sgn = R > 0 ? -1 : 1;
  [[sgn * Math.abs(F), "F"], [sgn * Math.abs(R), "C"]].forEach(([x, l]) => {
    if (x < view.x0 || x > view.x1) return;
    ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(MX(x), MY(0), 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = c.text3; ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(l, MX(x), MY(0) + 6);
  });
  // nurlar
  const x0 = view.x0;
  rays.forEach((r) => {
    const y0 = r.tr.pts[1][1], s = r.tr.slope;
    ctx.save(); ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(MX(-d), MY(h)); ctx.lineTo(MX(0), MY(y0)); ctx.lineTo(MX(x0), MY(y0 - s * x0)); ctx.stroke();
    if (!img.real && !img.inf) { ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.6; ctx.lineWidth = 1.3; const xi = -img.f; ctx.beginPath(); ctx.moveTo(MX(0), MY(y0)); ctx.lineTo(MX(xi + 1), MY(y0 - s * (xi + 1))); ctx.stroke(); }
    ctx.restore();
  });
  // ko'zgu
  const px = MX(0), yt = MY(Hm), yb = MY(-Hm), bend = R > 0 ? -10 : 10;
  ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(px + bend, yt); ctx.quadraticCurveTo(px - bend, (yt + yb) / 2, px + bend, yb); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let k = 0; k <= 14; k++) { const t = k / 14, yy = yt + (yb - yt) * t, xs = (1 - t) * (1 - t) * (px + bend) + 2 * t * (1 - t) * (px - bend) + t * t * (px + bend); ctx.moveTo(xs + 2, yy); ctx.lineTo(xs + 9, yy - 6); }
  ctx.stroke(); ctx.restore();
  tag(ctx, R > 0 ? "botiq ko‘zgu" : "qavariq ko‘zgu", px, yt - 12, { color: c.text, bg: c.bg, align: "center", font: "700 10.5px Inter, system-ui, sans-serif" });
  // buyum va tasvir
  ctx.save(); ctx.strokeStyle = c.warning; ctx.fillStyle = c.warning; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(MX(-d), MY(0)); ctx.lineTo(MX(-d), MY(h)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(MX(-d), MY(h)); ctx.lineTo(MX(-d) - 5, MY(h) + 8); ctx.lineTo(MX(-d) + 5, MY(h) + 8); ctx.closePath(); ctx.fill(); ctx.restore();
  candle(ctx, MX(-d), MY(h) - 6, 12);
  tag(ctx, "buyum", MX(-d), MY(0) + 18, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  if (img.inf) tag(ctx, "Buyum fokusda: qaytgan nurlar parallel — tasvir yo‘q", cw / 2, 16, { color: c.special, bg: c.bg2, align: "center", font: MID });
  else {
    const xi = -img.f, Hh = img.m * h;
    if (xi > view.x0 && xi < view.x1 && Math.abs(Hh) < 11) {
      ctx.save(); ctx.strokeStyle = c.special; ctx.fillStyle = c.special; ctx.lineWidth = 3; if (!img.real) ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(MX(xi), MY(0)); ctx.lineTo(MX(xi), MY(Hh)); ctx.stroke(); ctx.setLineDash([]);
      const dr = Hh >= 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(MX(xi), MY(Hh)); ctx.lineTo(MX(xi) - 5, MY(Hh) + 8 * dr); ctx.lineTo(MX(xi) + 5, MY(Hh) + 8 * dr); ctx.closePath(); ctx.fill(); ctx.restore();
      tag(ctx, img.real ? "haqiqiy tasvir" : "mavhum tasvir", MX(xi), MY(0) + (Hh > 0 ? 16 : -16), { color: c.special, bg: c.bg, align: "center", font: SMALL });
    } else tag(ctx, `Tasvir maydondan tashqarida (f = ${fmt(img.f, 0)} cm)`, cw - 12, 16, { color: c.special, bg: c.bg2, align: "right", font: MID });
  }
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "refr") drawRefr(ctx, stage);
  else if (ui.mode === "body") drawBody(ctx, stage);
  else if (mir.kind === "plane") drawPlane(ctx, stage);
  else if (mir.kind === "two") drawTwo(ctx, stage);
  else drawSph(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.44, vh * 0.44), 250, 350)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  refr: [["ba", "β(α)", "Sinish burchagi β(α)", "Optik zichroq muhitga o‘tganda β < α. Teskari holda β tezroq o‘sadi va α_kr da 90° ga yetadi — undan keyin nur o‘tmaydi."], ["fres", "R(α)", "Qaytgan yorug‘lik ulushi (Frenel)", "Tik tushganda shishadan ~4% qaytadi; sirpanib tushganda deyarli hammasi qaytadi. Bryuster burchagida p-qutblangan nur umuman qaytmaydi."]],
  slab: [["lab", "sin α – sin β", "Lab: shishaning sindirish ko‘rsatkichi", "Turli α uchun β ni o‘lchab «O‘lchovni yozish» ni bosing. sin α = n·sin β — nuqtalar to‘g‘ri chiziqda, og‘ish n ga teng."], ["shift", "Δ(α)", "Nurning yon siljishi Δ(α)", "Plastinkadan chiqqan nur tushuvchi nurga parallel, faqat yon tomonga siljiydi. Siljish qalinlik va burchak bilan ortadi."], ["fres", "R(α)", "Qaytgan yorug‘lik ulushi (1-sirt)", "Havodan shishaga o‘tishda qaytgan ulush (Frenel)."]],
  semi: [["lab", "sin α – sin β", "Lab: sindirish ko‘rsatkichi (yarim silindr)", "Nur markazga yo‘naltirilgan — yoy sirtida sinmaydi, faqat yassi sirtda sinadi. O‘lchovlardan n ni toping."], ["fres", "R(α)", "Yassi sirtda qaytgan ulush", "Shishadan havoga chiqishda α kritik burchakka yaqinlashsa qaytgan ulush keskin oshadi va 100% ga yetadi."]],
  prism: [["dev", "δ(α)", "Prizmada og‘ish burchagi δ(α)", "Og‘ish eng kichik bo‘lganda nur prizma ichida asosga parallel o‘tadi (simmetrik yo‘l). Kichik α da 2-yoqda to‘liq ichki qaytish bo‘ladi."]],
  fiber: [["fib", "Uzatish", "Optik tolada uzatish", "Tola ichida nur devorlardan to‘liq ichki qaytish bilan oldinga boradi. Tola egilsa, katta burchakli nurlar yo‘qoladi."]],
  plane: [["dd", "d′(d)", "Yassi ko‘zgu: tasvirgacha masofa", "Tasvir ko‘zgu orqasida, buyum bilan bir xil masofada; o‘lchami buyumga teng, mavhum va to‘g‘ri."]],
  two: [["N", "N(φ)", "Ikki ko‘zgudagi tasvirlar soni", "360°/φ juft son bo‘lsa N = 360°/φ − 1. Toq bo‘lsa, javob buyum holatiga bog‘liq: bissektrisada 360°/φ − 1, boshqa joyda 360°/φ."]],
  concave: [["fd", "f(d)", "Botiq ko‘zgu: tasvirgacha masofa", "d > F — haqiqiy tasvir (f > 0), d < F — ko‘zgu orqasida mavhum (f < 0). d = F da nurlar parallel."], ["gamma", "Γ(d)", "Kattalashtirish Γ(d)", "d = 2F = R da tasvir buyumga teng, d < F da kattalashgan mavhum (soqol oladigan ko‘zgu)."]],
  convex: [["fd", "f(d)", "Qavariq ko‘zgu: tasvirgacha masofa", "Qavariq ko‘zgu har doim mavhum, to‘g‘ri, kichraygan tasvir beradi — avtomobil yon ko‘zgusi."], ["gamma", "Γ(d)", "Kattalashtirish Γ(d)", "Γ < 1 — ko‘rish maydoni keng, lekin narsalar kichikroq va uzoqroq ko‘rinadi."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[subKey()].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const list = TABS[subKey()], t = list.find((x) => x[0] === tab) || list[0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  $("[data-meas-tools]").hidden = ui.tab !== "lab";
  graph.render();
}
let fiberCurve = null;
function fiberFn() {
  const key = `${nBody()}|${body.B}`;
  if (!fiberCurve || fiberCurve.key !== key) {
    const tab = []; for (let a = 0; a <= 89; a += 1) tab.push(fiberTransmission(a));
    fiberCurve = { key, fn: (a) => { const i = clamp(a, 0, 89), k = Math.floor(i), f = i - k; return tab[k] + (tab[Math.min(89, k + 1)] - tab[k]) * f; } };
  }
  return fiberCurve.fn;
}
function fresArgs() {
  if (ui.mode === "refr") return { n1: refr.n1, n2: refr.n2, alpha: refr.alpha };
  const n = nBody();
  if (body.obj === "semi" && body.entry === "arc") return { n1: n, n2: 1, alpha: body.alpha };
  return { n1: 1, n2: n, alpha: body.alpha };
}
function drawGraphCanvas(ctx, st) {
  const k = subKey();
  if (k === "refr") return ui.tab === "fres" ? G.drawFresnel(ctx, st, fresArgs()) : G.drawBetaAlpha(ctx, st, fresArgs());
  if (ui.tab === "lab") return G.drawLab(ctx, st, { pts: body.pts, n: nBody(), hidden: hidden() });
  if (ui.tab === "fres") return G.drawFresnel(ctx, st, fresArgs());
  if (ui.tab === "shift") return G.drawShift(ctx, st, { t: body.t, n: nBody(), alpha: body.alpha });
  if (ui.tab === "dev") return G.drawDeviation(ctx, st, { A: body.A, n: nBody(), alpha: body.alpha });
  if (ui.tab === "fib") return G.drawFiberT(ctx, st, { fn: fiberFn(), alpha: body.alpha, accept: P.acceptanceAngle(nBody()) });
  if (ui.tab === "dd") return G.drawPlane(ctx, st, { d: mir.d });
  if (ui.tab === "N") return G.drawImages(ctx, st, { phi: mir.phi, count: twoGeom().imgs.length });
  return G.drawMirrorFD(ctx, st, { R: mir.kind === "concave" ? mir.R : -mir.R, d: mir.sd, gamma: ui.tab === "gamma" });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const dg = (rad, d = 1) => `${fmt(rad / DEG, d)}°`;
const pc = (x) => `${fmt(x * 100, 1)}<small>%</small>`;
const cm = (x, d = 1) => (Number.isFinite(x) ? `${fmt(x, d)}<small>cm</small>` : "∞");

function measuredN() {
  if (!body.pts.length) return null;
  const sxy = body.pts.reduce((a, p) => a + p.sg * p.sa, 0), sxx = body.pts.reduce((a, p) => a + p.sg * p.sg, 0);
  return sxy / sxx;
}
function updateReadouts() {
  const k = subKey();
  if (k === "refr") {
    const { n1, n2, alpha } = refr, r = P.snell(n1, n2, alpha);
    setRO("r1", "Sinish burchagi <i>β</i>", r.tir ? "—" : dg(r.beta), r.tir ? "Sinish yo‘q: sin β > 1 bo‘lardi" : n2 > n1 ? "Nur normalga yaqinlashadi" : n2 < n1 ? "Nur normaldan uzoqlashadi" : "Muhitlar bir xil — sinmaydi", r.tir ? "orange" : "");
    setRO("r2", "Kritik burchak <i>α</i>₀", r.critical === null ? "yo‘q" : dg(r.critical), r.critical === null ? "Faqat n₁ > n₂ bo‘lganda" : alpha >= r.critical / DEG ? "α ≥ α₀ — to‘liq ichki qaytish" : "α < α₀ — nur sinib o‘tadi");
    setRO("r3", "Qaytgan ulush <i>R</i>", pc(r.R), "Frenel, qutblanmagan nur");
    setRO("r4", "O‘tgan ulush <i>T</i>", pc(r.T), r.tir ? "Hamma energiya qaytadi" : "T = 1 − R");
    setRO("r5", "2-muhitda tezlik <i>v</i>₂", `${fmt(P.C / n2 / 1e8, 2)}<small>·10⁸ m/s</small>`, `1-muhitda: ${fmt(P.C / n1 / 1e8, 2)}·10⁸ m/s`);
    setRO("r6", "Nisbiy ko‘rsatkich <i>n</i>₂₁", fmt(n2 / n1, 3), `Bryuster burchagi ${fmt(P.brewster(n1, n2), 1)}°`);
    return;
  }
  if (ui.mode === "body") {
    const n = nBody(), ev = mainEvents(), nShow = hidden() ? "?" : fmt(n, 2), nm = measuredN();
    const nSub = hidden() ? (nm ? `O‘lchovdan: n ≈ ${fmt(nm, 3)}` : "Lab: o‘lchab toping") : `v = c/n = ${fmt(P.C / n / 1e8, 2)}·10⁸ m/s`;
    if (k === "slab") {
      const e0 = ev[0], beta = e0 && e0.b !== null ? e0.b : null;
      setRO("r1", "Tushish burchagi <i>α</i>", `${fmt(body.alpha, 1)}°`, "1-sirtda (havo → shisha)");
      setRO("r2", "Sinish burchagi <i>β</i>", beta === null ? "—" : dg(beta), "Transportir bo‘yicha o‘qing");
      setRO("r3", "Sindirish ko‘rsatkichi <i>n</i>", nShow, nSub, hidden() ? "muted" : "");
      setRO("r4", "Yon siljish <i>Δ</i>", cm(P.slabShift(body.t, n, body.alpha), 2), `t = ${fmt(body.t, 1)} cm`);
      setRO("r5", "Chiqish burchagi", `${fmt(body.alpha, 1)}°`, "Chiqqan nur tushuvchiga parallel");
      setRO("r6", "1-sirtda qaytadi", pc(P.snell(1, n, body.alpha).R), `O‘lchovlar: ${body.pts.length} ta`);
    } else if (k === "semi") {
      const flat = body.entry === "flat", e = flat ? ev[0] : ev[1], crit = Math.asin(1 / n);
      if (flat) {
        setRO("r1", "Tushish burchagi <i>α</i>", `${fmt(body.alpha, 1)}°`, "Havodan yassi sirtga");
        setRO("r2", "Sinish burchagi <i>β</i>", e && e.b !== null ? dg(e.b) : "—", "Shishada; yoy sirtida sinmaydi");
      } else {
        setRO("r1", "Shishadagi burchak <i>α</i>", `${fmt(body.alpha, 1)}°`, "Yassi sirtga ichkaridan");
        setRO("r2", "Havodagi burchak <i>β</i>", e && !e.tir && e.b !== null ? dg(e.b) : "—", e && e.tir ? "To‘liq ichki qaytish" : "Nur havoga chiqadi", e && e.tir ? "orange" : "");
      }
      setRO("r3", "Sindirish ko‘rsatkichi <i>n</i>", nShow, nSub, hidden() ? "muted" : "");
      setRO("r4", "Kritik burchak <i>α</i>₀", hidden() ? "?" : dg(crit), "sin α₀ = 1/n (shisha → havo)");
      setRO("r5", "Qaytgan ulush", flat ? pc(P.snell(1, n, body.alpha).R) : pc(P.snell(n, 1, body.alpha).R), flat ? "Yassi sirtda (havodan)" : "Yassi sirtda (ichkaridan)");
      setRO("r6", "O‘lchovlar", `${body.pts.length}`, nm ? `n ≈ ${fmt(nm, 3)} (sin α / sin β)` : "«O‘lchovni yozish»");
    } else if (k === "prism") {
      const r = P.prismDeviation(body.A, n, body.alpha), mn = P.prismMinDeviation(body.A, n);
      setRO("r1", "Tushish burchagi <i>α</i>₁", `${fmt(body.alpha, 1)}°`, "1-yoqqa");
      setRO("r2", "Chiqish burchagi <i>α</i>₂", r.tir ? "—" : dg(r.a2), r.tir ? "2-yoqda to‘liq ichki qaytish" : `Ichkarida β₁ = ${dg(r.b1)}, β₂ = ${dg(r.b2)}`, r.tir ? "orange" : "");
      setRO("r3", "Og‘ish burchagi <i>δ</i>", r.tir ? "—" : `${fmt(r.delta, 1)}°`, "δ = α₁ + α₂ − A");
      setRO("r4", "Eng kichik og‘ish", mn ? `${fmt(mn.delta, 1)}°` : "—", mn ? `α₁ = ${fmt(mn.alpha, 1)}° da (β₁ = A/2)` : "Bu A va n da nur o‘tmaydi");
      setRO("r5", "Sindiruvchi burchak <i>A</i>", `${fmt(body.A, 0)}°`, "β₁ + β₂ = A");
      setRO("r6", "Sindirish ko‘rsatkichi <i>n</i>", fmt(n, 2), mn ? `n = sin((A+δ_min)/2)/sin(A/2)` : "");
    } else {
      const e0 = ev[0], beta = e0 && e0.b !== null ? e0.b : null, crit = Math.asin(1 / n), nT = ev.filter((e) => e.tir).length, T = fiberTransmission(body.alpha), acc = P.acceptanceAngle(n);
      setRO("r1", "Kirish burchagi <i>α</i>", `${fmt(body.alpha, 1)}°`, "Tola o‘qiga nisbatan");
      setRO("r2", "Tolada <i>β</i>", beta === null ? "—" : dg(beta), beta === null ? "" : `Devorga tushish: ${fmt(90 - beta / DEG, 1)}°`);
      setRO("r3", "Kritik burchak <i>α</i>₀", dg(crit), "Devorga tushish burchagi undan katta bo‘lishi kerak");
      setRO("r4", "To‘liq ichki qaytishlar", `${nT}`, body.B > 0 ? `Egilish ${fmt(body.B, 0)}°` : "To‘g‘ri tola");
      setRO("r5", "Chiqishga yetdi", pc(T), T > 0.5 ? "Yorug‘lik tola bo‘ylab uzatiladi" : "Yorug‘lik devordan chiqib ketadi", T > 0.5 ? "" : "orange");
      setRO("r6", "Qabul burchagi", acc >= 89.9 ? "90°" : `${fmt(acc, 1)}°`, "sin α_max = √(n² − 1) (to‘g‘ri tola)");
    }
    return;
  }
  if (k === "plane") {
    const g = planeGeom();
    setRO("r1", "Buyumgacha <i>d</i>", cm(mir.d), "Ko‘zgudan");
    setRO("r2", "Tasvirgacha <i>d</i>′", cm(mir.d), "Ko‘zgu orqasida, d′ = d");
    setRO("r3", "Tasvir balandligi", cm(PLANE.tip - PLANE.base), "Buyumga teng (Γ = 1)");
    setRO("r4", "Tushish burchagi <i>α</i>", g.okTip ? `${fmt(g.alpha, 1)}°` : "—", "Ko‘zga boradigan nur uchun");
    setRO("r5", "Qaytish burchagi <i>γ</i>", g.okTip ? `${fmt(g.alpha, 1)}°` : "—", "γ = α");
    setRO("r6", "Tasvir xarakteri", "mavhum", "to‘g‘ri, teng, chap-o‘ng almashgan");
  } else if (k === "two") {
    const { imgs } = twoGeom(), q = 360 / mir.phi, isInt = Math.abs(q - Math.round(q)) < 1e-6;
    setRO("r1", "Burchak <i>φ</i>", `${fmt(mir.phi, 0)}°`, `360°/φ = ${fmt(q, 2)}`);
    setRO("r2", "Tasvirlar soni <i>N</i>", `${imgs.length}`, "Ketma-ket aks ettirishlar bo‘yicha");
    setRO("r3", "Formula", isInt ? `${fmt(q - 1, 0)}` : "—", isInt ? "N = 360°/φ − 1" : "360°/φ butun emas — formula aniq emas", isInt ? "" : "muted");
    setRO("r4", "Buyum holati", `${fmt(mir.pos, 0)}%`, Math.abs(mir.pos - 50) < 0.5 ? "Bissektrisada" : "Bissektrisadan chetda");
    setRO("r5", "Bir marta qaytgan", `${imgs.filter((i) => i.order === 1).length}`, "Har bir ko‘zguda bittadan");
    setRO("r6", "Ko‘p marta qaytgan", `${imgs.filter((i) => i.order > 1).length}`, "Tasvirning tasviri");
  } else {
    const R = mir.kind === "concave" ? mir.R : -mir.R, img = P.sphericalMirror(R, mir.sd);
    setRO("r1", "Buyumgacha <i>d</i>", cm(mir.sd), `R = ${fmt(mir.R, 0)} cm`);
    setRO("r2", "Fokus masofasi <i>F</i>", cm(R / 2), mir.kind === "concave" ? "F = R/2 (haqiqiy fokus)" : "F = −R/2 (mavhum fokus)");
    setRO("r3", "Tasvirgacha <i>f</i>", img.inf ? "∞" : cm(img.f), img.inf ? "d = F" : img.real ? "ko‘zgu oldida — haqiqiy" : "ko‘zgu orqasida — mavhum");
    setRO("r4", "Kattalashtirish <i>Γ</i>", img.inf ? "∞" : fmt(Math.abs(img.m), 2), img.inf ? "" : `H = ${fmt(Math.abs(img.m * mir.h), 1)} cm`);
    setRO("r5", "Tasvir xarakteri", img.inf ? "—" : img.real ? "haqiqiy" : "mavhum", img.inf ? "" : `${img.upright ? "to‘g‘ri" : "teskari"}, ${Math.abs(img.m) > 1.001 ? "kattalashgan" : Math.abs(img.m) < 0.999 ? "kichraygan" : "teng"}`);
    setRO("r6", "Tekshiruv: 1/d + 1/f", `${fmt(100 * (1 / mir.sd + (img.inf ? 0 : 1 / img.f)), 2)}<small>dptr</small>`, `= 1/F = ${fmt(200 / R, 2)} dptr`);
  }
}
function updateStatus() {
  const el = $("[data-status]"), k = subKey();
  let t = "", tone = "blue";
  if (k === "refr") { const r = P.snell(refr.n1, refr.n2, refr.alpha); t = r.tir ? "To‘liq ichki qaytish" : refr.alpha === 0 ? "Normal bo‘yicha" : "Qaytish va sinish"; tone = r.tir ? "orange" : "green"; }
  else if (ui.mode === "body") { const ev = mainEvents(); const tir = ev.some((e) => e.tir); t = { slab: "Plastinka", semi: "Yarim silindr", prism: "Prizma", fiber: "Optik tola" }[k]; if (tir && k !== "fiber") { t += " · to‘liq ichki qaytish"; tone = "orange"; } }
  else if (k === "plane") { t = planeGeom().okTip ? "Ko‘z tasvirni ko‘radi" : "Tasvir ko‘rinmaydi"; tone = planeGeom().okTip ? "green" : "orange"; }
  else if (k === "two") { t = `${twoGeom().imgs.length} ta tasvir`; tone = "purple"; }
  else { const img = P.sphericalMirror(k === "concave" ? mir.R : -mir.R, mir.sd); t = img.inf ? "Tasvir yo‘q" : img.real ? "Haqiqiy tasvir" : "Mavhum tasvir"; tone = img.real ? "green" : "purple"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const k = subKey(), p = [];
  if (k === "refr") {
    const { n1, n2, alpha } = refr, r = P.snell(n1, n2, alpha), a1 = fmt(alpha, 1);
    if (r.tir) p.push(`<p>Nur optik zichroq muhitdan (<b>n₁ = ${fmt(n1)}</b>) siyrakroq muhitga (<b>n₂ = ${fmt(n2)}</b>) tushmoqda. α = ${a1}° kritik burchakdan (${fmt(r.critical / DEG, 1)}°) katta: <span class="sim-math">sin β = (n₁/n₂)·sin α</span> birdan katta chiqadi — bunday burchak yo‘q. Yorug‘likning hammasi qaytadi — <b>to‘liq ichki qaytish</b>. Optik tola va olmosning yaltirashi shunga asoslangan.</p>`);
    else if (alpha === 0) p.push(`<p>Nur chegaraga tik tushmoqda: yo‘nalish o‘zgarmaydi, lekin tezlik <span class="sim-math">v = c/n</span> ga, to‘lqin uzunligi esa <span class="sim-math">λ₀/n</span> ga o‘zgaradi. Shunda ham ${fmt(r.R * 100, 1)}% yorug‘lik qaytadi.</p>`);
    else p.push(`<p>Nur ${n2 > n1 ? "optik zichroq" : n2 < n1 ? "optik siyrakroq" : "xuddi shunday"} muhitga o‘tmoqda: <span class="sim-math">${fmt(n1)}·sin ${a1}° = ${fmt(n2)}·sin β</span>, bundan β = ${fmt(r.beta / DEG, 1)}°. ${n2 > n1 ? "Nur normalga yaqinlashadi." : n2 < n1 ? `Nur normaldan uzoqlashadi; α ni ${fmt(r.critical / DEG, 1)}° dan oshirsangiz, to‘liq ichki qaytish boshlanadi.` : ""}</p><p>Qaytish qonuni: γ = α. Energiyaning ${fmt(r.R * 100, 1)}% qismi qaytadi, ${fmt(r.T * 100, 1)}% qismi o‘tadi. To‘lqin frontlari chegarada uzilmaydi: chastota o‘zgarmaydi, to‘lqin uzunligi o‘zgaradi — sinishning sababi shu.</p>`);
  } else if (k === "slab") p.push("<p>Nur plastinkaga kirganda normalga yaqinlashadi, chiqqanda esa xuddi shuncha uzoqlashadi — chiqqan nur tushuvchi nurga <b>parallel</b>, faqat Δ ga siljigan. Xira chiziqlar — har bir sirtdan qisman qaytgan nurlar.</p><p><b>Lab ishi:</b> α ni o‘zgartirib, β ni o‘lchang va yozing. sin α / sin β nisbati — shishaning sindirish ko‘rsatkichi.</p>");
  else if (k === "semi") p.push(body.entry === "flat" ? "<p>Nur yarim silindr markaziga tushadi: yassi sirtda sinadi, keyin radius bo‘ylab ketgani uchun yoy sirtidan sinmasdan chiqadi. Burchaklarni transportirdan o‘qing.</p>" : "<p>Nur yoy tomondan markazga yo‘naltirilgan — yoy sirtida sinmaydi. Yassi sirtda shishadan havoga chiqadi va normaldan uzoqlashadi. α kritik burchakka yetganda singan nur sirt bo‘ylab sirpanadi, undan oshganda <b>to‘liq ichki qaytish</b> yuz beradi.</p>");
  else if (k === "prism") p.push("<p>Prizmada nur ikki marta sinadi va prizma <b>asosi tomon og‘adi</b>. Og‘ish burchagi δ tushish burchagiga bog‘liq: nur prizma ichida asosga parallel o‘tganda δ eng kichik bo‘ladi — shu usul bilan n aniq o‘lchanadi.</p>");
  else if (k === "fiber") p.push("<p>Optik tola — ingichka shisha tola. Nur devorga kritik burchakdan katta burchak bilan tushadi va <b>to‘liq ichki qaytadi</b>, shuning uchun tola egilgan bo‘lsa ham yorug‘lik deyarli yo‘qotishsiz uzatiladi. Internet, tibbiy endoskop shunga asoslangan.</p>");
  else if (k === "plane") p.push("<p>Buyumning har bir nuqtasidan chiqqan nurlar ko‘zgudan <b>γ = α</b> qonuni bo‘yicha qaytadi. Qaytgan nurlarning davomi (punktir) ko‘zgu orqasidagi bitta nuqtada kesishadi — ko‘z tasvirni o‘sha yerda ko‘radi. Bu <b>mavhum</b> tasvir: u yerga yorug‘lik bormaydi. Buyumni va ko‘zni suring.</p>");
  else if (k === "two") p.push("<p>Bir ko‘zgudagi tasvir ikkinchi ko‘zgu uchun buyum bo‘ladi — shuning uchun tasvirlar ko‘payadi. Barcha tasvirlar burchak cho‘qqisi atrofidagi aylanada yotadi. Kaleydoskop shu prinsipda ishlaydi.</p>");
  else if (k === "concave") p.push(`<p>Botiq ko‘zgu yorug‘likni yig‘adi: <span style="color:${RAY[0]}">o‘qqa parallel nur</span> fokusdan o‘tadi, <span style="color:${RAY[2]}">fokusdan o‘tgan nur</span> parallel qaytadi, <span style="color:${RAY[1]}">qutbga tushgan nur</span> o‘qqa simmetrik qaytadi. Fara, prozhektor va teleskop-reflektorlarda ishlatiladi.</p>`);
  else p.push(`<p>Qavariq ko‘zgu yorug‘likni sochadi: qaytgan nurlar ko‘zgu orqasidagi mavhum fokusdan chiqayotgandek tarqaladi. Tasvir doim mavhum, to‘g‘ri va kichraygan.</p>`);
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const k = subKey();
  const html = { refr: "<small>Snell qonuni</small> n₁ sin α = n₂ sin β", slab: "<small>Siljish</small> Δ = t·sin(α−β)/cos β", semi: "<small>Kritik burchak</small> sin α₀ = 1/n", prism: "<small>Prizma</small> δ = α₁ + α₂ − A", fiber: "<small>Qabul burchagi</small> sin α_max = √(n² − 1)", plane: "<small>Qaytish qonuni</small> γ = α", two: "<small>Tasvirlar</small> N = 360°/φ − 1", concave: "<small>Ko‘zgu</small> 1/F = 1/d + 1/f, F = R/2", convex: "<small>Ko‘zgu</small> 1/F = 1/d + 1/f, F = −R/2" }[k];
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() {
  if (ui.mode === "body") bodyTrace();
  updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render();
}

/* ------------------------------------------------------------------ Boshqaruv */

const m1 = $("#m1"), m2 = $("#m2");
const fillSelect = (sel) => { sel.innerHTML = P.MATERIALS.map((m, i) => `<option value="${i}">${m.name} (n = ${fmt(m.n)})</option>`).join("") + `<option value="custom">Boshqa (slayder)</option>`; };
fillSelect(m1); fillSelect(m2);
const syncSelect = (sel, n) => { const i = P.MATERIALS.findIndex((m) => Math.abs(m.n - n) < 0.005); sel.value = i >= 0 ? String(i) : "custom"; };
const alphaC = bindRange($("#alpha"), $("#alphaOut"), (v) => `${fmt(v, 1)}°`, (v) => { refr.alpha = v; customized(); refresh(); });
const n1C = bindRange($("#n1"), $("#n1Out"), (v) => fmt(v), (v) => { refr.n1 = v; syncSelect(m1, v); customized(); refresh(); });
const n2C = bindRange($("#n2"), $("#n2Out"), (v) => fmt(v), (v) => { refr.n2 = v; syncSelect(m2, v); customized(); refresh(); });
m1.addEventListener("change", () => { if (m1.value !== "custom") { refr.n1 = P.MATERIALS[+m1.value].n; n1C.set(refr.n1); customized(); refresh(); } });
m2.addEventListener("change", () => { if (m2.value !== "custom") { refr.n2 = P.MATERIALS[+m2.value].n; n2C.set(refr.n2); customized(); refresh(); } });
$("[data-swap]").addEventListener("click", () => { [refr.n1, refr.n2] = [refr.n2, refr.n1]; syncAll(); customized(); refresh(); });

const gAC = bindRange($("#gA"), $("#gAOut"), (v) => `${fmt(v, 1)}°`, (v) => { body.alpha = v; customized(); refresh(); });
const gNC = bindRange($("#gN"), $("#gNOut"), (v) => fmt(v, 2), (v) => { body.n = v; customized(); refresh(); });
const gTC = bindRange($("#gT"), $("#gTOut"), (v) => `${fmt(v, 1)} cm`, (v) => { body.t = v; customized(); refresh(); });
const gPC = bindRange($("#gP"), $("#gPOut"), (v) => `${fmt(v, 0)}°`, (v) => { body.A = v; customized(); refresh(); });
const gBC = bindRange($("#gB"), $("#gBOut"), (v) => `${fmt(v, 0)}°`, (v) => { body.B = v; customized(); refresh(); });
document.querySelectorAll("[data-obj-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.objValue === body.obj) return; body.obj = b.dataset.objValue; body.pts = []; body.alpha = { slab: 40, semi: 30, prism: 50, fiber: 25 }[body.obj]; syncAll(); setupTabs(); setTab(TABS[subKey()][0][0]); customized(); refresh(); }));
document.querySelectorAll("[data-entry-value]").forEach((b) => b.addEventListener("click", () => { body.entry = b.dataset.entryValue; body.pts = []; syncAll(); customized(); refresh(); }));
const HIDDEN_N = [1.46, 1.52, 1.57, 1.61, 1.68, 1.74];
$("[data-unknown]").addEventListener("change", (e) => { body.unknown = e.target.checked; body.revealed = false; body.pts = []; if (body.unknown) body.nHidden = HIDDEN_N[Math.floor(Math.random() * HIDDEN_N.length)]; syncAll(); customized(); refresh(); });
$("[data-reveal]").addEventListener("click", () => { body.revealed = true; syncAll(); refresh(); });
$("[data-meas-add]").addEventListener("click", () => {
  const ev = mainEvents(); let e = null, air, glass;
  if (body.obj === "slab" || (body.obj === "semi" && body.entry === "flat")) { e = ev[0]; if (e && e.b !== null) { air = e.a; glass = e.b; } }
  else if (body.obj === "semi") { e = ev[1]; if (e && !e.tir && e.b !== null) { glass = e.a; air = e.b; } }
  if (air === undefined || air < 2 * DEG) return;
  const r05 = (x) => (Math.round((x / DEG) * 2) / 2) * DEG; // transportir aniqligi 0,5°
  body.pts.push({ sa: Math.sin(r05(air)), sg: Math.sin(r05(glass)) });
  refresh();
});
$("[data-meas-clear]").addEventListener("click", () => { body.pts = []; refresh(); });

const mDC = bindRange($("#mD"), $("#mDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { mir.d = v; customized(); refresh(); });
const mPhiC = bindRange($("#mPhi"), $("#mPhiOut"), (v) => `${fmt(v, 0)}°`, (v) => { mir.phi = v; customized(); refresh(); });
const mPosC = bindRange($("#mPos"), $("#mPosOut"), (v) => (Math.abs(v - 50) < 0.5 ? "bissektrisada" : `${fmt(v, 0)}%`), (v) => { mir.pos = v; customized(); refresh(); });
const mRC = bindRange($("#mR"), $("#mROut"), (v) => `${fmt(v, 0)} cm`, (v) => { mir.R = v; customized(); refresh(); });
const mSdC = bindRange($("#mSd"), $("#mSdOut"), (v) => `${fmt(v, 1)} cm`, (v) => { mir.sd = v; customized(); refresh(); });
document.querySelectorAll("[data-mkind-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.mkindValue === mir.kind) return; mir.kind = b.dataset.mkindValue; syncAll(); setupTabs(); setTab(TABS[subKey()][0][0]); customized(); refresh(); }));

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; syncLoop(); refresh(); }));

/* Sudrash */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
function refrAngle(px, py) {
  const x = px - stage.w / 2, y = py - stage.h / 2;
  if (y > -4) return Math.abs(x) > Math.abs(y) ? 89 : null;
  return clamp(Math.round((Math.atan2(Math.abs(x), -y) / DEG) * 2) / 2, 0, 89);
}
function hitTest(px, py) {
  if (ui.mode === "refr") return Math.hypot(px - handle.x, py - handle.y) < 28 || py < stage.h / 2 ? "src" : null;
  if (ui.mode !== "mirror") return null;
  if (mir.kind === "plane") {
    if (Math.hypot(px - SX(mir.eye.x), py - SY(mir.eye.y)) < 22) return "eye";
    if (Math.abs(px - SX(-mir.d)) < 18 && py > SY(PLANE.tip) - 26 && py < SY(PLANE.base) + 10) return "obj";
  } else if (mir.kind === "two") { const { O } = twoGeom(); if (Math.hypot(px - SX(O.x), py - SY(O.y)) < 24) return "obj2"; }
  else if (Math.abs(px - MX(-mir.sd)) < 20) return "sobj";
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const { px, py } = ptr(e), h = hitTest(px, py);
  if (!h) return;
  drag = h; canvas.dataset.dragging = "true";
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  onDrag(px, py);
});
function onDrag(px, py) {
  if (drag === "src") { const v = refrAngle(px, py); if (v !== null && v !== refr.alpha) { refr.alpha = v; alphaC.set(v); } }
  else if (drag === "eye") { const w = toWorld(px, py); mir.eye = { x: clamp(w.x, -15.5, -1), y: clamp(w.y, -7.5, 7.5) }; }
  else if (drag === "obj") { const w = toWorld(px, py); mir.d = Math.round(clamp(-w.x, 1, 14) * 2) / 2; mDC.set(mir.d); }
  else if (drag === "obj2") { const w = toWorld(px, py); let th = Math.atan2(w.y, w.x) / DEG; if (th < 0) th += 360; mir.pos = Math.round(clamp((th / mir.phi) * 100, 5, 95)); mPosC.set(mir.pos); }
  else if (drag === "sobj") { const x = (px - view.ox) / view.s + view.x0; mir.sd = Math.round(clamp(-x, 1, 38) * 2) / 2; mSdC.set(mir.sd); }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => {
  const { px, py } = ptr(e);
  if (!drag) { canvas.style.cursor = hitTest(px, py) ? "grab" : ""; return; }
  onDrag(px, py);
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* To'lqin frontlari animatsiyasi */
const playBtn = $("[data-play]");
const loop = createLoop((dt) => { ui.phase += dt * 1.6; stage.render(); }, {
  onStateChange(on) {
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
    playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  },
});
let userPaused = prefersReducedMotion();
function syncLoop() {
  if (ui.mode === "refr" && ui.show.waves && !userPaused) loop.start(); else loop.stop();
  playBtn.disabled = !ui.show.waves;
}
playBtn.addEventListener("click", () => { userPaused = loop.running; syncLoop(); });
playBtn.querySelector("[data-play-icon]").innerHTML = icon("pause");

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  airGlass: { mode: "refr", title: "Havo → shisha", lesson: "Nur optik zichroq muhitga o‘tadi va normalga yaqinlashadi. Manbani surib, β qanday o‘zgarishini kuzating.", set: () => Object.assign(refr, { n1: 1, n2: 1.5, alpha: 40 }) },
  waterAir: { mode: "refr", title: "Suv → havo", lesson: "Nur suvdan havoga chiqadi va normaldan uzoqlashadi. α ni oshirib, kritik burchakni (48,8°) toping.", set: () => Object.assign(refr, { n1: 1.33, n2: 1, alpha: 35 }) },
  tir: { mode: "refr", title: "To‘liq ichki qaytish", lesson: "Shishadan havoga α = 50° da (> 41,8°) nur umuman chiqmaydi — hammasi qaytadi.", set: () => Object.assign(refr, { n1: 1.5, n2: 1, alpha: 50 }) },
  diamond: { mode: "refr", title: "Havo → olmos", lesson: "Olmosda n = 2,42 — nur kuchli sinadi; ichkaridan kritik burchak atigi 24,4°. Shuning uchun olmos yaltiraydi.", set: () => Object.assign(refr, { n1: 1, n2: 2.42, alpha: 50 }) },
  brewster: { mode: "refr", title: "Bryuster burchagi", lesson: "tg α = n₂/n₁ bo‘lganda qaytgan nur to‘liq qutblangan: p-tashkil etuvchi qaytmaydi (R(α) grafigi).", set: () => Object.assign(refr, { n1: 1, n2: 1.5, alpha: 56.5 }), tab: "fres" },
  slabLab: { mode: "body", title: "Lab: shishaning sindirish ko‘rsatkichi", lesson: "Shisha noma’lum. α ni 20°, 30°, … 70° qilib, har safar «O‘lchovni yozish» ni bosing. Grafikdagi to‘g‘ri chiziq og‘ishi — n. So‘ng «Javobni ko‘rsatish» bilan solishtiring.", set: () => { Object.assign(body, { obj: "slab", alpha: 30, t: 5, unknown: true, revealed: false, pts: [] }); body.nHidden = HIDDEN_N[Math.floor(Math.random() * HIDDEN_N.length)]; }, tab: "lab" },
  slabShift: { mode: "body", title: "Plastinkada nurning siljishi", lesson: "Chiqqan nur tushuvchi nurga parallel. Qalinlik va burchakni oshirib, siljish Δ qanday o‘zgarishini kuzating.", set: () => Object.assign(body, { obj: "slab", alpha: 60, t: 6, n: 1.5, unknown: false, pts: [] }), tab: "shift" },
  semiTir: { mode: "body", title: "Yarim silindr: to‘liq ichki qaytish", lesson: "Nur yoy tomondan markazga tushadi. α ni sekin oshiring: 41,8° da singan nur sirt bo‘ylab ketadi, keyin to‘liq ichki qaytish.", set: () => Object.assign(body, { obj: "semi", entry: "arc", alpha: 38, n: 1.5, unknown: false, pts: [] }), tab: "fres" },
  prism: { mode: "body", title: "Prizmada og‘ish", lesson: "Nur prizmada asos tomon og‘adi. α ni o‘zgartirib, eng kichik og‘ish burchagini toping (δ(α) grafigi).", set: () => Object.assign(body, { obj: "prism", alpha: 50, A: 60, n: 1.5 }) },
  fiber: { mode: "body", title: "Optik tola", lesson: "Nur tola devorlaridan to‘liq ichki qaytib, egilgan tola bo‘ylab ham uzatiladi. Kirish burchagini va egilishni o‘zgartiring.", set: () => Object.assign(body, { obj: "fiber", alpha: 25, B: 45, n: 1.5 }) },
  plane: { mode: "mirror", title: "Yassi ko‘zgu", lesson: "Buyumni va ko‘zni suring: qaytgan nurlarning davomi ko‘zgu orqasidagi bitta nuqtada kesishadi — mavhum tasvir. γ = α.", set: () => Object.assign(mir, { kind: "plane", d: 6, eye: { x: -8, y: 5.5 } }) },
  two: { mode: "mirror", title: "Ikki ko‘zgu (60°)", lesson: "φ = 60° da 5 ta tasvir. Burchakni 90°, 45°, 30° qilib tekshiring: N = 360°/φ − 1.", set: () => Object.assign(mir, { kind: "two", phi: 60, pos: 50 }) },
  concave: { mode: "mirror", title: "Botiq ko‘zgu", lesson: "Buyum C dan uzoqda: tasvir haqiqiy, teskari, kichraygan va ko‘zgu oldida. Buyumni yaqinlashtiring.", set: () => Object.assign(mir, { kind: "concave", R: 20, sd: 30 }) },
  concaveIn: { mode: "mirror", title: "Botiq ko‘zgu: buyum fokus ichida", lesson: "d < F: tasvir mavhum, to‘g‘ri, kattalashgan — kosmetik ko‘zgu shunday ishlaydi.", set: () => Object.assign(mir, { kind: "concave", R: 24, sd: 7 }) },
  convex: { mode: "mirror", title: "Qavariq ko‘zgu", lesson: "Tasvir har doim mavhum, to‘g‘ri, kichraygan; ko‘rish maydoni keng — avtomobil va do‘kon ko‘zgulari.", set: () => Object.assign(mir, { kind: "convex", R: 20, sd: 18 }) },
};
const GROUPS = [["Ikki muhit chegarasi", ["airGlass", "waterAir", "tir", "diamond", "brewster"]], ["Plastinka va prizma", ["slabLab", "slabShift", "semiTir", "prism", "fiber"]], ["Ko‘zgular", ["plane", "two", "concave", "concaveIn", "convex"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  alphaC.set(refr.alpha); n1C.set(refr.n1); n2C.set(refr.n2); syncSelect(m1, refr.n1); syncSelect(m2, refr.n2);
  document.querySelectorAll("[data-obj-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.objValue === body.obj)));
  document.querySelectorAll("[data-entry-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.entryValue === body.entry)));
  document.querySelectorAll("[data-octl]").forEach((el) => { el.hidden = !el.dataset.octl.split(" ").includes(body.obj); });
  const labSt = body.obj === "slab" || body.obj === "semi";
  $("[data-nctl]").hidden = labSt && body.unknown;
  $("[data-reveal]").hidden = !(labSt && body.unknown && !body.revealed);
  $("[data-unknown]").checked = body.unknown;
  $("[data-ga-label]").textContent = body.obj === "fiber" ? "Kirish burchagi α (o‘qqa)" : body.obj === "semi" && body.entry === "arc" ? "Shishadagi burchak α" : body.obj === "prism" ? "Tushish burchagi α₁" : "Tushish burchagi α";
  gAC.set(body.alpha); gNC.set(body.n); gTC.set(body.t); gPC.set(body.A); gBC.set(body.B);
  document.querySelectorAll("[data-mkind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mkindValue === mir.kind)));
  document.querySelectorAll("[data-mctl]").forEach((el) => { el.hidden = !el.dataset.mctl.split(" ").includes(mir.kind); });
  $("[data-mhint]").textContent = { plane: "Buyumni va ko‘zni sichqoncha yoki barmoq bilan suring.", two: "Buyumni (shamni) ko‘zgular orasida suring.", concave: "Buyumni suring.", convex: "Buyumni suring." }[mir.kind];
  mDC.set(mir.d); mPhiC.set(mir.phi); mPosC.set(mir.pos); mRC.set(mir.R); mSdC.set(mir.sd);
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { refr: "Nur manbasini suring — burchaklar o‘zgaradi", body: "Nur shisha jismdan qanday o‘tadi?", mirror: "Buyumni suring — tasvir qayerda?" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  syncLoop();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ refr: "airGlass", body: "prism", mirror: "plane" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  p.set(); setMode(p.mode);
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setupTabs(); setTab(p.tab || TABS[subKey()][0][0]);
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "airGlass");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
