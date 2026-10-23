// ==========================================================================
// Magnit maydon va Amper kuchi — virtual laboratoriya (simulations/magnetism.html)
// 1) Magnit maydon: magnit, tokli o'tkazgich, g'altak, kompaslar; kuch chiziqlari / temir qipiqlari / kompaslar to'ri.
// 2) Amper kuchi: osma o'tkazgich (og'ish burchagidan F ni o'lchash) va relsdagi o'tkazgich (ish A = IΔΦ).
// 3) Tokli ramka: aylantiruvchi moment, kollektor bilan — o'zgarmas tok elektr dvigateli.
// Fizika: magnet-physics.js (Node'da tekshirilgan). Grafiklar: magnet-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./magnet-physics.js";
import { drawFI, drawFAlpha, drawRail, drawTorque, drawOmega, drawProfileB } from "./magnet-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const W = 0.40, H = 0.24; // maydon (m)

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "field", view: "lines", tab: "", earth: false, forces: true, heat: false, hand: true };
let objs = [];
let sel = -1;
let cmp = null;
let lines = [], filings = [], heatGrid = null;
let presetId = null;
const amp = { setup: "swing", I: 5, B: 0.2, l: 0.1, alpha: 90, m: 20, mu: 0.1, th: 0, om: 0, rail: { x: 0, v: 0, work: 0 }, t: 0, hist: [], pts: [] };
const frm = { I: 2, B: 0.2, N: 50, S: 40, k: 5, commutator: true, st: { phi: 1.2, omega: 0 }, t: 0, hist: [] };

const mk = {
  magnet: (x, y, angle = 0, q = 20) => ({ type: "magnet", x, y, angle, len: 0.08, width: 0.02, q }),
  wire: (x, y, I = 10) => ({ type: "wire", x, y, I }),
  coil: (x, y, angle = 0, N = 200, I = 2, core = false) => ({ type: "coil", x, y, angle, len: 0.12, diam: 0.045, N, I, core, mu: 50 }),
  compass: (x, y) => ({ type: "compass", x, y, ang: Math.PI / 2, w: 0 }),
};

/* ------------------------------------------------------------------ Maydon: hisob va kuch chiziqlari */

function sources() {
  const s = objs.filter((o) => o.type !== "compass");
  if (ui.earth) s.push({ type: "earth", B: P.B_EARTH, angle: Math.PI / 2 });
  return s;
}
let srcIndexOf = new Map();
function recompute() {
  const src = sources();
  srcIndexOf = new Map(src.map((s, k) => [s, k]));
  cmp = P.compile(src);
  if (ui.view === "lines") traceLines();
  else if (ui.view === "filings") makeFilings();
  if (ui.heat) makeHeat();
}
const Bat = (x, y) => P.field(cmp, x, y);

function insideBody(x, y) {
  for (const o of objs) {
    if (o.type !== "magnet") continue;
    const dx = x - o.x, dy = y - o.y, c = Math.cos(o.angle), s = Math.sin(o.angle);
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (Math.abs(u) < o.len / 2 - 0.0005 && Math.abs(v) < o.width / 2) return true;
  }
  return false;
}
function nearSingular(x, y) {
  for (const w of cmp.wires) if (Math.hypot(x - w.x, y - w.y) < 0.004) return true;
  for (const p of cmp.poles) if (p.q < 0 && Math.hypot(x - p.x, y - p.y) < 0.0025) return true;
  return false;
}

function traceLines() {
  lines = [];
  const CS = 0.011, cols = Math.ceil(W / CS), rows = Math.ceil(H / CS);
  const occ = new Int32Array(cols * rows).fill(-1);
  const cellOf = (x, y) => { const cx = Math.floor(x / CS), cy = Math.floor(y / CS); return cx >= 0 && cy >= 0 && cx < cols && cy < rows ? cy * cols + cx : -1; };
  const seeds = [];
  objs.forEach((o) => {
    if (o.type === "magnet") {
      const c = Math.cos(o.angle), s = Math.sin(o.angle);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; seeds.push([o.x + c * (o.len / 2) + Math.cos(a) * 0.006, o.y + s * (o.len / 2) + Math.sin(a) * 0.006]); }
    } else if (o.type === "wire" && o.I !== 0) {
      for (let k = 1; k <= 8; k++) seeds.push([o.x + 0.008 * k * 1.25, o.y]);
    } else if (o.type === "coil" && o.I !== 0) {
      const c = Math.cos(o.angle), s = Math.sin(o.angle), vx = -s, vy = c;
      for (let k = -2; k <= 2; k++) seeds.push([o.x + vx * (o.diam / 5) * k, o.y + vy * (o.diam / 5) * k]);
    }
  });
  for (let y = CS * 1.5; y < H; y += CS * 2) for (let x = CS * 1.5; x < W; x += CS * 2) seeds.push([x, y]);
  const ds = 0.0018;
  const dirAt = (x, y) => { const [bx, by] = Bat(x, y); const m = Math.hypot(bx, by); return m < 1e-12 ? null : [bx / m, by / m, m]; };
  let id = 0;
  for (const [sx, sy] of seeds) {
    if (lines.length > 140) break;
    const c0 = cellOf(sx, sy);
    if (c0 < 0 || occ[c0] !== -1 || insideBody(sx, sy) || nearSingular(sx, sy)) continue;
    const half = (sign) => {
      const pts = [];
      let x = sx, y = sy;
      for (let n = 0; n < 700; n++) {
        const d1 = dirAt(x, y); if (!d1) break;
        const mx = x + sign * d1[0] * ds * 0.5, my = y + sign * d1[1] * ds * 0.5;
        const d2 = dirAt(mx, my); if (!d2) break;
        x += sign * d2[0] * ds; y += sign * d2[1] * ds;
        if (x < 0 || y < 0 || x > W || y > H) break;
        if (insideBody(x, y) || nearSingular(x, y)) { pts.push([x, y]); break; }
        const cc = cellOf(x, y);
        if (cc >= 0 && occ[cc] !== -1 && occ[cc] !== id && n > 2) break;
        pts.push([x, y]);
        if (n > 30 && Math.hypot(x - sx, y - sy) < ds * 1.2) { pts.push([sx, sy]); break; } // yopiq chiziq
      }
      return pts;
    };
    const fwd = half(1), bwd = half(-1);
    const pts = bwd.reverse().concat([[sx, sy]], fwd);
    if (pts.length < 8) continue;
    pts.forEach(([x, y]) => { const cc = cellOf(x, y); if (cc >= 0 && occ[cc] === -1) occ[cc] = id; });
    lines.push({ pts, mid: bwd.length });
    id++;
  }
}

let rnd = 1;
const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
function makeFilings() {
  rnd = 7; filings = [];
  for (let k = 0; k < 2200; k++) {
    const x = rand() * W, y = rand() * H;
    if (insideBody(x, y)) continue;
    const [bx, by] = Bat(x, y), m = Math.hypot(bx, by);
    filings.push([x, y, Math.atan2(by, bx), clamp((Math.log10(m + 1e-12) + 5.6) / 3, 0.08, 1)]);
  }
}
function makeHeat() {
  const nx = 80, ny = 48, g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const [bx, by] = Bat(((i + 0.5) / nx) * W, ((j + 0.5) / ny) * H); g[j * nx + i] = Math.hypot(bx, by); }
  heatGrid = { nx, ny, g };
}

/* ------------------------------------------------------------------ Geometriya */

const view = { s: 1, ox: 0, oy: 0 };
const X = (x) => view.ox + x * view.s, Y = (y) => view.oy + (H - y) * view.s;
const toWorld = (px, py) => [(px - view.ox) / view.s, H - (py - view.oy) / view.s];

function hitObj(px, py) {
  const [x, y] = toWorld(px, py);
  for (let k = objs.length - 1; k >= 0; k--) {
    const o = objs[k];
    if (o.type === "wire" || o.type === "compass") { if (Math.hypot(x - o.x, y - o.y) < Math.max(0.012, 14 / view.s)) return k; continue; }
    const c = Math.cos(o.angle), s = Math.sin(o.angle), dx = x - o.x, dy = y - o.y;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    const hw = o.type === "magnet" ? o.width / 2 : o.diam / 2 + 0.004;
    if (Math.abs(u) <= o.len / 2 + 0.003 && Math.abs(v) <= hw + 0.003) return k;
  }
  return -1;
}

/* ------------------------------------------------------------------ Chizish: maydon */

const B_TXT = (b) => (b >= 1e-3 ? `${fmt(b * 1e3, b >= 0.01 ? 1 : 2)} mT` : `${fmt(b * 1e6, b >= 1e-5 ? 1 : 2)} μT`);

function drawMagnet(ctx, c, o, selected) {
  const L = o.len * view.s, Wd = o.width * view.s;
  ctx.save(); ctx.translate(X(o.x), Y(o.y)); ctx.rotate(-o.angle);
  ctx.fillStyle = "#3b82f6"; ctx.fillRect(-L / 2, -Wd / 2, L / 2, Wd);
  ctx.fillStyle = "#ef4444"; ctx.fillRect(0, -Wd / 2, L / 2, Wd);
  ctx.strokeStyle = selected ? c.warning : "rgba(0,0,0,0.35)"; ctx.lineWidth = selected ? 3 : 1.5; ctx.strokeRect(-L / 2, -Wd / 2, L, Wd);
  ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(Math.min(Wd * 0.7, 16))}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.save(); ctx.translate(L / 4, 0); ctx.rotate(o.angle); ctx.fillText("N", 0, 1); ctx.restore();
  ctx.save(); ctx.translate(-L / 4, 0); ctx.rotate(o.angle); ctx.fillText("S", 0, 1); ctx.restore();
  ctx.restore();
}

function currentSymbol(ctx, c, x, y, r, I, colorOverride) {
  ctx.save();
  ctx.fillStyle = c.bg; ctx.strokeStyle = colorOverride || (I === 0 ? c.text3 : c.text); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  if (I > 0) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, TAU); ctx.fill(); }
  else if (I < 0) { const k = r * 0.55; ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x - k, y + k); ctx.lineTo(x + k, y - k); ctx.stroke(); }
  ctx.restore();
}

function drawCoil(ctx, c, o, selected) {
  const L = o.len * view.s, D = o.diam * view.s;
  ctx.save(); ctx.translate(X(o.x), Y(o.y)); ctx.rotate(-o.angle);
  if (o.core) { ctx.fillStyle = "rgba(100,116,139,0.45)"; ctx.fillRect(-L / 2 - 6, -D * 0.3, L + 12, D * 0.6); }
  ctx.strokeStyle = selected ? c.warning : c.text3; ctx.lineWidth = selected ? 2.5 : 1.25; ctx.setLineDash([4, 3]);
  ctx.strokeRect(-L / 2, -D / 2, L, D); ctx.setLineDash([]);
  ctx.restore();
  const ws = P.coilWires(o), r = clamp(Math.min((L / (ws.length / 2)) * 0.36, 7), 3, 7);
  ws.forEach((w) => currentSymbol(ctx, c, X(w.x), Y(w.y), r, Math.sign(w.I) * Math.sign(o.I || 1) * (o.I === 0 ? 0 : 1), selected ? c.warning : null));
}

function drawCompass(ctx, c, o, selected, r = 13) {
  const x = X(o.x), y = Y(o.y);
  ctx.save();
  ctx.fillStyle = c.bg; ctx.strokeStyle = selected ? c.warning : c.borderStrong; ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  needle(ctx, x, y, o.ang, r * 0.85, 1);
  ctx.restore();
}
function needle(ctx, x, y, ang, len, alpha) {
  const ca = Math.cos(ang), sa = Math.sin(ang), w = len * 0.22;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.moveTo(x + ca * len, y - sa * len); ctx.lineTo(x - sa * w, y - ca * w); ctx.lineTo(x + sa * w, y + ca * w); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.moveTo(x - ca * len, y + sa * len); ctx.lineTo(x - sa * w, y - ca * w); ctx.lineTo(x + sa * w, y + ca * w); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawField(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  view.s = Math.min((cw - 16) / W, (ch - 16) / H);
  view.ox = (cw - W * view.s) / 2; view.oy = (ch - H * view.s) / 2;
  ctx.save(); ctx.fillStyle = c.bg2; ctx.fillRect(X(0), Y(H), W * view.s, H * view.s);
  // 1 cm to'r
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W + 1e-9; x += 0.02) { ctx.moveTo(Math.round(X(x)) + 0.5, Y(H)); ctx.lineTo(Math.round(X(x)) + 0.5, Y(0)); }
  for (let y = 0; y <= H + 1e-9; y += 0.02) { ctx.moveTo(X(0), Math.round(Y(y)) + 0.5); ctx.lineTo(X(W), Math.round(Y(y)) + 0.5); }
  ctx.stroke(); ctx.restore();
  if (!cmp) return;
  if (ui.heat && heatGrid) {
    const { nx, ny, g } = heatGrid, cwid = (W / nx) * view.s, chei = (H / ny) * view.s;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const t = clamp((Math.log10(g[j * nx + i] + 1e-12) + 5.3) / 3.3, 0, 1);
      if (t <= 0.02) continue;
      ctx.fillStyle = `rgba(${Math.round(59 + 180 * t)},${Math.round(130 - 60 * t)},${Math.round(246 - 180 * t)},${0.08 + 0.32 * t})`;
      ctx.fillRect(X((i / nx) * W), Y(((j + 1) / ny) * H), cwid + 0.5, chei + 0.5);
    }
  }
  ctx.save(); ctx.beginPath(); ctx.rect(X(0), Y(H), W * view.s, H * view.s); ctx.clip();
  if (ui.view === "lines") {
    ctx.strokeStyle = c.primary; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
    lines.forEach((L) => {
      ctx.beginPath(); L.pts.forEach(([x, y], k) => { if (k === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }); ctx.stroke();
      const n = L.pts.length, k = clamp(L.mid, 2, n - 3);
      const [x1, y1] = L.pts[k], [x2, y2] = L.pts[k + 1];
      const a = Math.atan2(-(y2 - y1), x2 - x1), px = X(x1), py = Y(y1);
      ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5); ctx.lineTo(px + Math.cos(a + 2.5) * 5, py + Math.sin(a + 2.5) * 5); ctx.lineTo(px + Math.cos(a - 2.5) * 5, py + Math.sin(a - 2.5) * 5); ctx.closePath(); ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (ui.view === "filings") {
    ctx.strokeStyle = c.text2; ctx.lineWidth = 1.3; ctx.lineCap = "round";
    filings.forEach(([x, y, a, al]) => { const L = 3.2 + 2.5 * al; ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(X(x) - Math.cos(a) * L, Y(y) + Math.sin(a) * L); ctx.lineTo(X(x) + Math.cos(a) * L, Y(y) - Math.sin(a) * L); ctx.stroke(); });
    ctx.globalAlpha = 1;
  } else {
    const st = 0.02;
    for (let y = st / 2; y < H; y += st) for (let x = st / 2; x < W; x += st) {
      if (insideBody(x, y)) continue;
      const [bx, by] = Bat(x, y), m = Math.hypot(bx, by);
      const al = clamp((Math.log10(m + 1e-12) + 5.6) / 3, 0.15, 1);
      needle(ctx, X(x), Y(y), Math.atan2(by, bx), Math.min(9, st * view.s * 0.42), al);
    }
  }
  ctx.restore();

  // Obyektlar
  objs.forEach((o, k) => {
    if (o.type === "magnet") drawMagnet(ctx, c, o, k === sel);
    else if (o.type === "coil") drawCoil(ctx, c, o, k === sel);
  });
  objs.forEach((o, k) => {
    if (o.type === "wire") {
      currentSymbol(ctx, c, X(o.x), Y(o.y), 10, o.I, k === sel ? c.warning : null);
      tag(ctx, `${fmt(o.I, 1)} A`, X(o.x), Y(o.y) + 22, { color: c.text2, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
      if (ui.forces && objs.some((q2) => q2 !== o && q2.type !== "compass")) {
        const F = P.forceOnWire(cmp, { x: o.x, y: o.y, I: o.I }, srcIndexOf.get(o));
        const f = Math.hypot(...F);
        if (f > 1e-9) {
          const L = clamp(18 + 14 * Math.log10(f / 1e-5), 14, 70);
          arrow(ctx, X(o.x), Y(o.y), (F[0] / f) * L, (-F[1] / f) * L, c.danger, { width: 2.5, head: 8 });
          tag(ctx, `F/l = ${sci(f * 1000, 2)} mN/m`, X(o.x), Y(o.y) + 42, { color: c.danger, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
        }
      }
    } else if (o.type === "compass") drawCompass(ctx, c, o, k === sel);
  });
  // Yer
  if (ui.earth) {
    const x = X(W) - 22, y = Y(H) + 26;
    arrow(ctx, x, y + 14, 0, -26, c.text2, { width: 2, head: 7 });
    tag(ctx, "Sh", x, y - 20, { color: c.text2, bg: c.bg, align: "center", font: "700 10px Inter, system-ui, sans-serif" });
  }
  // shkala
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 2; const sx = X(0) + 12, sy = Y(0) - 10;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 0.02 * view.s, sy); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("2 cm", sx, sy - 3); ctx.restore();
  // Tanlangan kompas — o'lchov
  const probe = probeObj();
  if (probe) {
    const [bx, by] = Bat(probe.x, probe.y);
    const right = X(probe.x) > cw * 0.62;
    tag(ctx, `B = ${B_TXT(Math.hypot(bx, by))}`, X(probe.x) + (right ? -18 : 18), Y(probe.y) - 16, { color: c.text, bg: c.bg, align: right ? "right" : "left", font: "700 11px Inter, system-ui, sans-serif" });
  }
  if (!objs.length) { ctx.fillStyle = c.text3; ctx.font = "500 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Stol bo‘sh: o‘ngdagi tugmalar bilan magnit, tokli o‘tkazgich yoki g‘altak qo‘shing", cw / 2, ch / 2); }
}
const probeObj = () => (sel >= 0 && objs[sel]?.type === "compass" ? objs[sel] : objs.find((o) => o.type === "compass"));

/* ------------------------------------------------------------------ Chizish: Amper kuchi */

const ampF = () => P.ampereForce(amp.B, amp.I, amp.l, amp.setup === "swing" ? amp.alpha * DEG : Math.PI / 2);

function drawAmpere(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  if (amp.setup === "swing") {
    const cx = cw * (cw < 560 ? 0.42 : 0.38), gapH = Math.min(ch * 0.36, 120), poleW = Math.min(cw * 0.5, 300), poleH = 34;
    const yTop = ch * 0.5 - gapH / 2, yBot = ch * 0.5 + gapH / 2;
    // qutblar
    ctx.save();
    ctx.fillStyle = "#ef4444"; ctx.fillRect(cx - poleW / 2, yTop - poleH, poleW, poleH);
    ctx.fillStyle = "#3b82f6"; ctx.fillRect(cx - poleW / 2, yBot, poleW, poleH);
    ctx.fillStyle = "#fff"; ctx.font = "800 16px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", cx - poleW / 2 + 18, yTop - poleH / 2); ctx.fillText("S", cx - poleW / 2 + 18, yBot + poleH / 2);
    ctx.restore();
    // B chiziqlari
    const nB = Math.round(3 + amp.B * 18);
    for (let k = 0; k < nB; k++) { const x = cx - poleW / 2 + 40 + ((poleW - 60) * (k + 0.5)) / nB; ctx.save(); ctx.strokeStyle = "rgba(59,130,246,0.45)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, yTop + 2); ctx.lineTo(x, yBot - 2); ctx.stroke(); ctx.restore(); arrow(ctx, x, (yTop + yBot) / 2 - 6, 0, 12, "rgba(59,130,246,0.7)", { width: 1.5, head: 6 }); }
    // osma
    const pivotY = 14, Lp = (yTop + yBot) / 2 - pivotY;
    const bx = cx + Math.sin(amp.th) * Lp, by = pivotY + Math.cos(amp.th) * Lp;
    ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, pivotY); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = c.text2; ctx.fillRect(cx - 30, pivotY - 6, 60, 6); ctx.restore();
    ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = c.border; ctx.beginPath(); ctx.moveTo(cx, pivotY); ctx.lineTo(cx, pivotY + Lp + 14); ctx.stroke(); ctx.restore();
    currentSymbol(ctx, c, bx, by, 11, Math.sign(amp.I) * (amp.I === 0 ? 0 : 1));
    const F = ampF();
    if (Math.abs(F) > 1e-6) {
      const L = clamp(20 + 40 * Math.abs(F) / 0.5, 18, 90) * Math.sign(F);
      arrow(ctx, bx + Math.sign(F) * 12, by, L, 0, c.danger, { width: 3, head: 9 });
      tag(ctx, `F = ${fmt(Math.abs(F) * 1000, 1)} mN`, bx + Math.sign(F) * 14 + L, by - 18, { color: c.danger, bg: c.bg, align: F > 0 ? "left" : "right", font: "700 11.5px Inter, system-ui, sans-serif" });
    }
    tag(ctx, `θ = ${fmt(Math.abs(amp.th) / DEG, 1)}°`, cx + 8, pivotY + 26, { color: c.text2, bg: c.bg, font: "600 11px Inter, system-ui, sans-serif" });
    tag(ctx, "B ↓", cx + poleW / 2 - 24, (yTop + yBot) / 2, { color: "#3b82f6", bg: c.bg, align: "center", font: "700 11px Inter, system-ui, sans-serif" });
    // yuqoridan ko'rinish (α) — tor ekranda ko'rsatilmaydi (α natijalarda)
    if (cw >= 560) {
    const ix = cw - (cw < 560 ? 70 : 100), iy = ch * 0.5, R = cw < 560 ? 40 : 56;
    ctx.save(); ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.beginPath(); ctx.arc(ix, iy, R, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    arrow(ctx, ix - R * 0.75, iy, R * 1.5, 0, "#3b82f6", { width: 2, head: 7 });
    const a = amp.alpha * DEG;
    ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ix - Math.cos(a) * R * 0.7, iy + Math.sin(a) * R * 0.7); ctx.lineTo(ix + Math.cos(a) * R * 0.7, iy - Math.sin(a) * R * 0.7); ctx.stroke(); ctx.restore();
    tag(ctx, `α = ${fmt(amp.alpha, 0)}°`, ix, iy + R + 14, { color: c.text, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
    tag(ctx, "yuqoridan", ix, iy - R - 12, { color: c.text3, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
    }
    if (ui.hand && cw >= 560) tag(ctx, "Chap qo‘l: B kaftga kiradi, 4 barmoq — tok, bosh barmoq — F", 12, ch - 14, { color: c.text2, bg: c.bg2, font: "600 10.5px Inter, system-ui, sans-serif" });
  } else {
    // Relslar (yuqoridan): B — bizdan (⊗)
    const L0 = 0.6, s = (cw - 90) / L0, x0 = 70, yc = ch * 0.5, half = clamp(amp.l * s * 0.5 * 1.6, 26, ch * 0.32);
    const sign = amp.B >= 0 ? -1 : 1;
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let gx = x0 + 10; gx < x0 + L0 * s; gx += 26) for (let gy = yc - half - 22; gy <= yc + half + 22; gy += 26) currentSymbol(ctx, c, gx, gy, 4.5, amp.B === 0 ? 0 : sign, "rgba(59,130,246,0.8)");
    ctx.restore();
    ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, yc - half); ctx.lineTo(x0 + L0 * s, yc - half); ctx.moveTo(x0, yc + half); ctx.lineTo(x0 + L0 * s, yc + half); ctx.stroke();
    // batareya
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, yc - half); ctx.lineTo(x0 - 30, yc - half); ctx.lineTo(x0 - 30, yc - 8); ctx.moveTo(x0, yc + half); ctx.lineTo(x0 - 30, yc + half); ctx.lineTo(x0 - 30, yc + 8); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0 - 42, yc - 8); ctx.lineTo(x0 - 18, yc - 8); ctx.stroke(); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0 - 36, yc + 6); ctx.lineTo(x0 - 24, yc + 6); ctx.stroke();
    ctx.restore();
    const rx = x0 + clamp(amp.rail.x, 0, L0) * s + 20;
    ctx.save(); ctx.fillStyle = "#c2410c"; ctx.fillRect(rx - 4, yc - half - 8, 8, 2 * half + 16); ctx.restore();
    // tok yo'nalishi
    if (amp.I !== 0) arrow(ctx, rx + 12, amp.I > 0 ? yc - 18 : yc + 18, 0, amp.I > 0 ? 36 : -36, c.warning, { width: 2, head: 7 });
    const F = ampF();
    if (Math.abs(F) > 1e-6) { const L = clamp(20 + 50 * Math.abs(F) / 0.5, 18, 90) * Math.sign(F); arrow(ctx, rx, yc, L, 0, c.danger, { width: 3, head: 9 }); tag(ctx, `F = ${fmt(Math.abs(F) * 1000, 1)} mN`, rx + L + Math.sign(F) * 4, yc - 16, { color: c.danger, bg: c.bg, align: F > 0 ? "left" : "right", font: "700 11.5px Inter, system-ui, sans-serif" }); }
    tag(ctx, `s = ${fmt(amp.rail.x * 100, 1)} cm`, rx, yc + half + 22, { color: c.text2, bg: c.bg, align: "center", font: "600 11px Inter, system-ui, sans-serif" });
    tag(ctx, amp.B >= 0 ? "B — bizdan (⊗)" : "B — bizga (⊙)", cw - 12, 14, { color: "#3b82f6", bg: c.bg, align: "right", font: "700 11px Inter, system-ui, sans-serif" });
  }
}

/* ------------------------------------------------------------------ Chizish: ramka */

function drawFrame(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const cx = cw * (cw < 560 ? 0.5 : 0.42), cy = ch * 0.52, R = Math.min(ch * 0.33, cw * 0.18);
  // qutblar (yuqoridan ko'rinish): N chapda, S o'ngda
  const gap = R * 1.35, pw = Math.min(70, cw * 0.12), phh = R * 2.2;
  ctx.save();
  ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.moveTo(cx - gap - pw, cy - phh / 2); ctx.lineTo(cx - gap, cy - phh / 2); ctx.arc(cx, cy, gap, Math.PI + 0.75, Math.PI - 0.75, true); ctx.lineTo(cx - gap - pw, cy + phh / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.moveTo(cx + gap + pw, cy - phh / 2); ctx.lineTo(cx + gap, cy - phh / 2); ctx.arc(cx, cy, gap, -0.75, 0.75, false); ctx.lineTo(cx + gap + pw, cy + phh / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "800 18px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("N", cx - gap - pw / 2 - 4, cy); ctx.fillText("S", cx + gap + pw / 2 + 4, cy);
  ctx.restore();
  for (let k = -2; k <= 2; k++) { const y = cy + k * R * 0.42; ctx.save(); ctx.strokeStyle = "rgba(59,130,246,0.35)"; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(cx - gap + 4, y); ctx.lineTo(cx + gap - 4, y); ctx.stroke(); ctx.restore(); }
  arrow(ctx, cx - gap + 8, cy - R * 1.05, 26, 0, "rgba(59,130,246,0.85)", { width: 2, head: 7 });
  tag(ctx, "B", cx - gap + 44, cy - R * 1.05, { color: "#3b82f6", bg: c.bg, align: "center", font: "700 11px Inter, system-ui, sans-serif" });
  const phi = frm.st.phi;
  const px = -Math.sin(phi), py = Math.cos(phi); // ramka tekisligi yo'nalishi (y yuqoriga)
  const Ieff = frm.st.Ieff ?? frm.I;
  const A = [cx + px * R, cy - py * R], Bp = [cx - px * R, cy + py * R];
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...Bp); ctx.stroke(); ctx.restore();
  // normal
  arrow(ctx, cx, cy, Math.cos(phi) * R * 0.75, -Math.sin(phi) * R * 0.75, c.success, { width: 2, head: 7 });
  tag(ctx, "n", cx + Math.cos(phi) * R * 0.9, cy - Math.sin(phi) * R * 0.9, { color: c.success, bg: c.bg, align: "center", font: "700 11px Inter, system-ui, sans-serif" });
  // kollektor
  ctx.save(); ctx.lineWidth = 4;
  ctx.strokeStyle = "#b45309"; ctx.beginPath(); ctx.arc(cx, cy, 9, -phi + 0.15, -phi + Math.PI - 0.15); ctx.stroke();
  ctx.strokeStyle = "#d97706"; ctx.beginPath(); ctx.arc(cx, cy, 9, -phi + Math.PI + 0.15, -phi + TAU - 0.15); ctx.stroke();
  ctx.fillStyle = c.text3; ctx.fillRect(cx - 18, cy - 3, 6, 6); ctx.fillRect(cx + 12, cy - 3, 6, 6);
  ctx.restore();
  currentSymbol(ctx, c, A[0], A[1], 11, Ieff === 0 ? 0 : Math.sign(Ieff));
  currentSymbol(ctx, c, Bp[0], Bp[1], 11, Ieff === 0 ? 0 : -Math.sign(Ieff));
  // kuchlar: ⊙ tomonda yuqoriga (B = +x)
  const Fm = Math.abs(frm.N * frm.B * Ieff) > 0 ? clamp(16 + 30 * Math.abs(frm.N * frm.B * Ieff) / 20, 14, 60) : 0;
  if (Fm) {
    const sA = Math.sign(Ieff);
    arrow(ctx, A[0], A[1] - sA * 13, 0, -sA * Fm, c.danger, { width: 2.5, head: 8 });
    arrow(ctx, Bp[0], Bp[1] + sA * 13, 0, sA * Fm, c.danger, { width: 2.5, head: 8 });
    tag(ctx, "F", A[0] + 12, A[1] - sA * (Fm + 14), { color: c.danger, bg: c.bg, font: "700 11px Inter, system-ui, sans-serif" });
  }
  const deg = (((phi / DEG) % 360) + 360) % 360;
  tag(ctx, `φ = ${fmt(deg, 0)}°`, 12, 16, { color: c.text, bg: c.bg2, font: "700 11.5px Inter, system-ui, sans-serif" });
  tag(ctx, `ω = ${fmt(Math.abs(frm.st.omega) * 60 / TAU, 0)} ayl/min`, 12, 42, { color: c.text, bg: c.bg2, font: "700 11.5px Inter, system-ui, sans-serif" });
  if (cw >= 560) tag(ctx, "yuqoridan ko‘rinish (aylanish o‘qi bizga qarab)", cw - 12, ch - 14, { color: c.text3, bg: c.bg, align: "right", font: "600 10.5px Inter, system-ui, sans-serif" });
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "field") drawField(ctx, stage);
  else if (ui.mode === "ampere") drawAmpere(ctx, stage);
  else drawFrame(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.6, vh * 0.46), 240, 380)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  field: [["profile", "B(r)", "Maydon induksiyasining masofaga bog‘liqligi", "Tanlangan (yoki birinchi) manbadan o‘ngga qarab B o‘lchanadi. To‘g‘ri tokda B ∝ 1/r, magnitda uzoqda tezroq — taxminan 1/r³ kamayadi."]],
  ampere: [
    ["fi", "F(I)", "Amper kuchining tok kuchiga bog‘liqligi", "Kuch og‘ish burchagidan topiladi: F = mg·tgθ. Nuqtalar — o‘lchov, chiziq — F = BIl·sinα."],
    ["fa", "F(α)", "Amper kuchining burchakka bog‘liqligi", "O‘tkazgich B ga parallel bo‘lsa (α = 0) kuch nolga teng, tik bo‘lsa (α = 90°) eng katta."],
    ["rail", "x(τ)", "O‘tkazgichning relslar bo‘ylab harakati", "Amper kuchi o‘tkazgichni tezlashtiradi. Bajarilgan ish A = F·s = I·ΔΦ."],
  ],
  frame: [
    ["torque", "M(φ)", "Aylantiruvchi moment M(φ)", "M = NBIS·sinφ. Kollektorsiz moment ishorasini o‘zgartiradi — ramka tebranib to‘xtaydi; kollektor tokni har yarim aylanishda almashtiradi va moment bir tomonga yo‘naladi."],
    ["omega", "ω(τ)", "Burchak tezligi", "Dvigatel aylanib ketadi va ishqalanish (yuk) bilan muvozanatlashgach o‘zgarmas tezlikda aylanadi."],
  ],
};
function setupTabs() {
  const box = $("[data-tabs]");
  let list = TABS[ui.mode];
  if (ui.mode === "ampere") list = list.filter((t) => (amp.setup === "rail" ? t[0] === "rail" : t[0] !== "rail"));
  box.innerHTML = list.map(([id, label]) => `<button type="button" data-tab-value="${id}">${label}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
  if (!list.some((t) => t[0] === ui.tab)) ui.tab = list[0][0];
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  $("[data-meas-tools]").hidden = !(ui.mode === "ampere" && ui.tab === "fi");
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "field") {
    const src = (sel >= 0 && objs[sel].type !== "compass" ? objs[sel] : objs.find((o) => o.type !== "compass"));
    drawProfileB(ctx, st, { src, cmp, B_TXT });
  } else if (ui.mode === "ampere") {
    if (ui.tab === "fa") drawFAlpha(ctx, st, { B: amp.B, I: amp.I, l: amp.l, alpha: amp.alpha });
    else if (ui.tab === "rail") drawRail(ctx, st, { hist: amp.hist });
    else drawFI(ctx, st, { B: amp.B, l: amp.l, alpha: amp.alpha, I: amp.I, pts: amp.pts, Fnow: amp.m / 1000 * 9.81 * Math.tan(amp.th) });
  } else {
    if (ui.tab === "omega") drawOmega(ctx, st, { hist: frm.hist });
    else drawTorque(ctx, st, { N: frm.N, B: frm.B, I: frm.I, S: frm.S / 1e4, phi: frm.st.phi, commutator: frm.commutator });
  }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const Bhtml = (b) => (b >= 1e-3 ? `${fmt(b * 1e3, b >= 0.01 ? 1 : 2)}<small>mT</small>` : `${fmt(b * 1e6, b >= 1e-5 ? 1 : 2)}<small>μT</small>`);

function updateReadouts() {
  if (ui.mode === "field") {
    const pr = probeObj();
    if (pr) {
      const [bx, by] = Bat(pr.x, pr.y), b = Math.hypot(bx, by);
      const az = ((90 - Math.atan2(by, bx) / DEG) + 360) % 360;
      setRO("r1", "Kompas joyida <i>B</i>", Bhtml(b), "Kompas mili B yo‘nalishini ko‘rsatadi");
      setRO("r2", "Yo‘nalish (shimoldan)", `${fmt(az, 0)}<small>°</small>`, ui.earth ? "Yer maydoni ham hisobga olingan" : "Yuqori — shimol");
    } else { setRO("r1", "Kompas joyida <i>B</i>", "—", "Kompas qo‘shing", "muted"); setRO("r2", "Yo‘nalish", "—", "", "muted"); }
    const wires = objs.filter((o) => o.type === "wire");
    if (pr && wires.length) {
      const w0 = wires.reduce((a, o) => (Math.hypot(o.x - pr.x, o.y - pr.y) < Math.hypot(a.x - pr.x, a.y - pr.y) ? o : a));
      const r = Math.hypot(w0.x - pr.x, w0.y - pr.y);
      setRO("r3", "Eng yaqin tokgacha <i>r</i>", `${fmt(r * 100, 1)}<small>cm</small>`, `μ₀I/(2πr) = ${B_TXT(Math.abs(P.MU0 * w0.I / (TAU * r)))}`);
    } else setRO("r3", "Tokgacha masofa <i>r</i>", "—", "Tokli o‘tkazgich va kompas kerak", "muted");
    if (wires.length >= 2) {
      const [a, b] = wires, d = Math.hypot(a.x - b.x, a.y - b.y), f = P.parallelForce(a.I, b.I, d);
      setRO("r4", "Toklar orasidagi kuch <i>F/l</i>", `${sci(Math.abs(f) * 1000, 3)}<small>mN/m</small>`, `${f > 0 ? "Tortishadi" : "Itariladi"} · d = ${fmt(d * 100, 1)} cm`);
    } else setRO("r4", "Toklar orasidagi kuch", "—", "Ikkita tokli o‘tkazgich kerak", "muted");
    const coil = objs.find((o) => o.type === "coil");
    if (coil) {
      const Bin = Math.hypot(...Bat(coil.x, coil.y));
      setRO("r5", "G‘altak ichida <i>B</i>", Bhtml(Bin), `μ₀μNI/l = ${B_TXT(Math.abs(P.solenoidB(coil.N, coil.I, coil.len, coil.core ? coil.mu : 1)))}${coil.core ? " (temir o‘zak)" : ""}`);
    } else setRO("r5", "G‘altak ichida <i>B</i>", "—", "G‘altak qo‘shing", "muted");
    const mag = objs.filter((o) => o.type === "magnet").length;
    setRO("r6", "Stoldagi manbalar", `${objs.filter((o) => o.type !== "compass").length}`, `${mag} magnit · ${wires.length} tok · ${objs.filter((o) => o.type === "coil").length} g‘altak · ${objs.filter((o) => o.type === "compass").length} kompas`);
  } else if (ui.mode === "ampere") {
    const F = ampF();
    setRO("r1", "Amper kuchi <i>F</i>", `${fmt(Math.abs(F) * 1000, 2)}<small>mN</small>`, `F = BIl·sinα = ${fmt(amp.B, 2)}·${fmt(Math.abs(amp.I), 1)}·${fmt(amp.l, 2)}${amp.setup === "swing" ? `·sin${fmt(amp.alpha, 0)}°` : ""}`);
    if (amp.setup === "swing") {
      const Fm = (amp.m / 1000) * 9.81 * Math.tan(amp.th);
      setRO("r2", "Og‘ish burchagi <i>θ</i>", `${fmt(Math.abs(amp.th) / DEG, 1)}<small>°</small>`, `Muvozanat: tgθ = F/mg → ${fmt(Math.abs(P.swingAngle(F, amp.m / 1000)) / DEG, 1)}°`);
      setRO("r3", "O‘lchangan kuch", `${fmt(Math.abs(Fm) * 1000, 2)}<small>mN</small>`, "F = mg·tgθ (og‘ishdan)");
      setRO("r4", "Og‘irlik kuchi <i>mg</i>", `${fmt(amp.m * 9.81, 0)}<small>mN</small>`, `m = ${fmt(amp.m, 0)} g`);
      setRO("r5", "Kuch yo‘nalishi", F > 0 ? "o‘ngga" : F < 0 ? "chapga" : "—", "Tok yoki B yo‘nalishini almashtirsangiz kuch ham teskarisiga");
      setRO("r6", "Magnit induksiya <i>B</i>", `${fmt(amp.B, 2)}<small>T</small>`, `l = ${fmt(amp.l * 100, 0)} cm, α = ${fmt(amp.alpha, 0)}°`);
    } else {
      const s = amp.rail.x, dPhi = amp.B * amp.l * s;
      setRO("r2", "Ko‘chish <i>s</i>", `${fmt(s * 100, 1)}<small>cm</small>`, `Tezlik v = ${fmt(amp.rail.v, 2)} m/s`);
      setRO("r3", "Amper kuchi ishi <i>A</i>", `${fmt(amp.rail.work * 1000, 2)}<small>mJ</small>`, "A = F·s");
      setRO("r4", "Magnit oqimi o‘zgarishi <i>ΔΦ</i>", `${fmt(dPhi * 1000, 2)}<small>mWb</small>`, "ΔΦ = B·l·s");
      setRO("r5", "<i>I</i>·ΔΦ", `${fmt(Math.abs(amp.I * dPhi) * 1000, 2)}<small>mJ</small>`, "A = I·ΔΦ — ish bilan teng");
      setRO("r6", "Ishqalanish kuchi", `${fmt(amp.mu * amp.m * 9.81, 1)}<small>mN</small>`, Math.abs(F) <= amp.mu * amp.m / 1000 * 9.81 ? "Amper kuchi yetarli emas — qo‘zg‘almaydi" : "μmg");
    }
  } else {
    const S = frm.S / 1e4, st = frm.st, Mmax = frm.N * frm.B * frm.I * S;
    const deg = (((st.phi / DEG) % 360) + 360) % 360;
    setRO("r1", "Aylantiruvchi moment <i>M</i>", `${fmt(Math.abs(st.M ?? 0) * 1000, 1)}<small>mN·m</small>`, "M = NBIS·sinφ");
    setRO("r2", "Maksimal moment", `${fmt(Mmax * 1000, 1)}<small>mN·m</small>`, `N = ${frm.N}, S = ${fmt(frm.S, 0)} cm²`);
    setRO("r3", "Burchak <i>φ</i>", `${fmt(deg, 0)}<small>°</small>`, "Ramka normali va B orasida");
    setRO("r4", "Aylanish chastotasi", `${fmt(Math.abs(st.omega) * 60 / TAU, 0)}<small>ayl/min</small>`, `ω = ${fmt(Math.abs(st.omega), 2)} rad/s`);
    const Pm = Math.abs((st.M ?? 0) * st.omega);
    setRO("r5", "Mexanik quvvat", `${fmt(Pm * 1000, 1)}<small>mW</small>`, "P = Mω (oniy)");
    setRO("r6", "Ramkadagi tok", (st.Ieff ?? frm.I) >= 0 ? "to‘g‘ri" : "teskari", frm.commutator ? "Kollektor yarim aylanishda tokni almashtiradi" : "Kollektorsiz — tok yo‘nalishi o‘zgarmaydi");
  }
}

function updateStatus() {
  const el = $("[data-status]"); let text = "", tone = "blue";
  if (ui.mode === "field") { text = `${objs.length ? "Maydon hisoblandi" : "Stol bo‘sh"}`; tone = objs.length ? "green" : "blue"; }
  else if (ui.mode === "ampere") { const F = ampF(); text = Math.abs(F) < 1e-9 ? "Kuch yo‘q" : amp.setup === "rail" ? (Math.abs(amp.rail.v) > 1e-4 ? "Harakatlanmoqda" : "Turibdi") : "Amper kuchi ta’sir qilmoqda"; tone = Math.abs(F) < 1e-9 ? "blue" : "orange"; }
  else { const w = Math.abs(frm.st.omega); text = w > 1 ? (frm.commutator ? "Dvigatel aylanmoqda" : "Ramka tebranmoqda") : "Ramka to‘xtagan"; tone = w > 1 ? "orange" : "blue"; }
  el.textContent = text; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const parts = [];
  if (ui.mode === "field") {
    parts.push("<p>Magnit maydonni kuch chiziqlari, temir qipiqlari yoki kompas millari bilan ko‘rish mumkin. Kuch chiziqlari magnitning <b>N</b> qutbidan chiqib, <b>S</b> qutbiga kiradi; tok atrofida esa yopiq aylanalar hosil qiladi (o‘ng parma qoidasi).</p>");
    if (objs.some((o) => o.type === "wire")) parts.push("<p>To‘g‘ri tok maydoni o‘tkazgichdan uzoqlashgan sari kamayadi: B = μ₀I/(2πr). Tok yo‘nalishini almashtirsangiz, kompas millari teskari buriladi (Ersted tajribasi).</p>");
    if (objs.filter((o) => o.type === "wire").length >= 2) parts.push("<p>Parallel toklar bir yo‘nalishda bo‘lsa tortishadi, qarama-qarshi bo‘lsa itariladi: har biri ikkinchisining maydonida Amper kuchini sezadi.</p>");
    if (objs.some((o) => o.type === "coil")) parts.push("<p>G‘altak ichida maydon deyarli bir jinsli: B = μ₀μNI/l. Tashqarida u polosali magnitnikiga o‘xshaydi. Temir o‘zak maydonni ko‘p marta kuchaytiradi — elektromagnit shunday ishlaydi.</p>");
    if (ui.earth) parts.push("<p>Yerning magnit maydoni kuchsiz (≈ 20 μT), lekin kompas mili aynan shu maydon bo‘yicha shimolga qaraydi. Yaqindagi tok yoki magnit maydoni undan kuchliroq bo‘lsa, mil buriladi.</p>");
  } else if (ui.mode === "ampere") {
    parts.push("<p>Magnit maydondagi tokli o‘tkazgichga <b>Amper kuchi</b> ta’sir qiladi: F = BIl·sinα. Yo‘nalishi chap qo‘l qoidasi bilan topiladi: kaftga B kiradi, to‘rt barmoq tok yo‘nalishida — bosh barmoq kuchni ko‘rsatadi.</p>");
    if (amp.setup === "rail") parts.push("<p>Relslar ustidagi o‘tkazgichni Amper kuchi ko‘chiradi va ish bajaradi: A = F·s = BIl·s = I·ΔΦ, bu yerda ΔΦ = B·l·s — o‘tkazgich «chizib» o‘tgan yuzadan o‘tuvchi magnit oqimi.</p>");
    else parts.push("<p>Osma o‘tkazgich Amper kuchi va og‘irlik kuchi muvozanatlashgan burchakka og‘adi: tgθ = F/(mg). Shu burchakni o‘lchab, kuchni topish mumkin.</p>");
  } else {
    parts.push("<p>Magnit maydondagi tokli ramkaning qarama-qarshi tomonlariga teng va qarama-qarshi Amper kuchlari ta’sir qiladi — ular <b>juft kuch</b> hosil qilib, ramkani aylantiradi: M = NBIS·sinφ.</p>");
    parts.push(frm.commutator ? "<p><b>Kollektor</b> (yarim halqalar va cho‘tkalar) ramka B ga tik holatdan o‘tganda tok yo‘nalishini almashtiradi — moment doim bir tomonga, ramka uzluksiz aylanadi. Bu — o‘zgarmas tok elektr dvigatelining ishlash prinsipi.</p>" : "<p>Kollektorsiz ramka normali B bilan bir yo‘nalishga kelguncha buriladi, so‘ng tebranib to‘xtaydi: moment ishorasini o‘zgartiradi.</p>");
  }
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const f = $("[data-formula]");
  const html = ui.mode === "field" ? (objs.some((o) => o.type === "coil") && !objs.some((o) => o.type === "wire") ? "<small>G‘altak</small> B = μ₀μNI / l" : "<small>To‘g‘ri tok</small> B = μ₀I / 2πr")
    : ui.mode === "ampere" ? (amp.setup === "rail" ? "<small>Ish</small> A = I·ΔΦ" : "<small>Amper kuchi</small> F = BIl·sinα") : "<small>Ramka</small> M = NBIS·sinφ";
  if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); }

/* ------------------------------------------------------------------ Boshqaruv: maydon */

const propsBox = $("[data-props]");
const qCtl = bindRange($("#pQ"), $("#pQOut"), (v) => `${fmt(v, 0)} A·m`, (v) => editSel((o) => { o.q = v; }));
const iCtl = bindRange($("#pI"), $("#pIOut"), (v) => `${fmt(v, 1)} A`, (v) => editSel((o) => { o.I = v; }));
const nCtl = bindRange($("#pN"), $("#pNOut"), (v) => `${fmt(v, 0)}`, (v) => editSel((o) => { o.N = v; }));
const lCtl = bindRange($("#pL"), $("#pLOut"), (v) => `${fmt(v * 100, 0)} cm`, (v) => editSel((o) => { o.len = v; }));
const aCtl = bindRange($("#pA"), $("#pAOut"), (v) => `${fmt(v, 0)}°`, (v) => editSel((o) => { o.angle = v * DEG; }));
$("#pCore").addEventListener("change", (e) => editSel((o) => { o.core = e.target.checked; }));
$("[data-flip]").addEventListener("click", () => editSel((o) => { if (o.type === "wire") o.I = -o.I; else if (o.type === "coil") o.I = -o.I; else o.angle = (o.angle + Math.PI) % TAU; }));
$("[data-delete]").addEventListener("click", () => { if (sel >= 0) { objs.splice(sel, 1); sel = -1; changed(); } });
function editSel(fn) { if (sel < 0) return; fn(objs[sel]); customized(); changed(false); }
function syncProps() {
  const o = sel >= 0 ? objs[sel] : null;
  propsBox.hidden = !o || ui.mode !== "field";
  if (!o) return;
  const show = (k, on) => { propsBox.querySelector(`[data-prop="${k}"]`).hidden = !on; };
  $("[data-props-title]").textContent = { magnet: "Doimiy magnit", wire: "Tokli o‘tkazgich", coil: "G‘altak", compass: "Kompas" }[o.type];
  show("q", o.type === "magnet"); show("I", o.type === "wire" || o.type === "coil"); show("N", o.type === "coil"); show("len", o.type === "coil");
  show("angle", o.type === "magnet" || o.type === "coil"); show("core", o.type === "coil");
  $("[data-flip]").hidden = o.type === "compass";
  $("[data-flip]").textContent = o.type === "magnet" ? "Qutblarni almashtirish" : "Tok yo‘nalishini almashtirish";
  const pI = $("#pI"); pI.min = o.type === "coil" ? -5 : -20; pI.max = o.type === "coil" ? 5 : 20; pI.step = o.type === "coil" ? 0.1 : 0.5;
  if (o.type === "magnet") { qCtl.set(o.q); aCtl.set(Math.round(o.angle / DEG / 15) * 15 % 360); }
  if (o.type === "wire" || o.type === "coil") iCtl.set(o.I);
  if (o.type === "coil") { nCtl.set(o.N); lCtl.set(o.len); aCtl.set(Math.round(o.angle / DEG / 15) * 15 % 360); $("#pCore").checked = o.core; }
}
function changed(props = true) { recompute(); if (props) syncProps(); refresh(); stage.render(); graph.render(); }

document.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
  const t = b.dataset.add;
  // bo'sh joy izlash
  let best = [W / 2, H / 2], bd = -1;
  for (let k = 0; k < 40; k++) {
    const x = 0.05 + ((k * 0.618) % 1) * (W - 0.1), y = 0.04 + ((k * 0.382 + 0.2) % 1) * (H - 0.08);
    const d = Math.min(1, ...objs.map((o) => Math.hypot(o.x - x, o.y - y)));
    if (d > bd) { bd = d; best = [x, y]; }
  }
  objs.push(mk[t](best[0], best[1]));
  sel = objs.length - 1; customized(); changed();
}));
$("[data-clear-all]").addEventListener("click", () => { objs = []; sel = -1; customized(); changed(); });
$("[data-earth]").addEventListener("change", (e) => { ui.earth = e.target.checked; customized(); changed(false); });
$("[data-forces]").addEventListener("change", (e) => { ui.forces = e.target.checked; stage.render(); });
$("[data-heat]").addEventListener("change", (e) => { ui.heat = e.target.checked; changed(false); });
document.querySelectorAll("[data-view-value]").forEach((b) => b.addEventListener("click", () => {
  ui.view = b.dataset.viewValue;
  document.querySelectorAll("[data-view-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  changed(false);
}));

// Sudrash
let drag = null;
stage.canvas.addEventListener("pointerdown", (ev) => {
  if (ui.mode !== "field") return;
  const r = stage.canvas.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
  const k = hitObj(px, py);
  sel = k;
  if (k >= 0) { const [x, y] = toWorld(px, py); drag = { k, dx: objs[k].x - x, dy: objs[k].y - y }; try { stage.canvas.setPointerCapture(ev.pointerId); } catch { /* */ } stage.canvas.dataset.dragging = "true"; }
  syncProps(); refresh(); stage.render(); graph.render();
});
let pending = false;
stage.canvas.addEventListener("pointermove", (ev) => {
  if (ui.mode !== "field") return;
  const r = stage.canvas.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
  if (!drag) { stage.canvas.style.cursor = hitObj(px, py) >= 0 ? "grab" : ""; return; }
  const [x, y] = toWorld(px, py);
  const o = objs[drag.k];
  o.x = clamp(x + drag.dx, 0.005, W - 0.005); o.y = clamp(y + drag.dy, 0.005, H - 0.005);
  if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; if (o.type !== "compass") { customized(); recompute(); } refresh(); stage.render(); graph.render(); }); }
});
const endDrag = () => { if (drag) { drag = null; delete stage.canvas.dataset.dragging; } };
stage.canvas.addEventListener("pointerup", endDrag);
stage.canvas.addEventListener("pointercancel", endDrag);
document.addEventListener("keydown", (ev) => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
  if ((ev.key === "Delete" || ev.key === "Backspace") && ui.mode === "field" && sel >= 0) { ev.preventDefault(); objs.splice(sel, 1); sel = -1; changed(); }
});

/* ------------------------------------------------------------------ Boshqaruv: Amper, ramka */

const aICtl = bindRange($("#aI"), $("#aIOut"), (v) => `${fmt(v, 1)} A`, (v) => { amp.I = v; customized(); refresh(); graph.render(); });
const aBCtl = bindRange($("#aB"), $("#aBOut"), (v) => `${fmt(v, 2)} T`, (v) => { amp.B = v; customized(); refresh(); graph.render(); });
const aLCtl = bindRange($("#aL"), $("#aLOut"), (v) => `${fmt(v * 100, 0)} cm`, (v) => { amp.l = v; customized(); refresh(); graph.render(); });
const aAlCtl = bindRange($("#aAl"), $("#aAlOut"), (v) => `${fmt(v, 0)}°`, (v) => { amp.alpha = v; customized(); refresh(); graph.render(); });
const aMCtl = bindRange($("#aM"), $("#aMOut"), (v) => `${fmt(v, 0)} g`, (v) => { amp.m = v; customized(); refresh(); });
const aMuCtl = bindRange($("#aMu"), $("#aMuOut"), (v) => `${fmt(v, 2)}`, (v) => { amp.mu = v; customized(); refresh(); });
$("[data-hand]").addEventListener("change", (e) => { ui.hand = e.target.checked; stage.render(); });
document.querySelectorAll("[data-setup-value]").forEach((b) => b.addEventListener("click", () => setSetup(b.dataset.setupValue)));
function setSetup(s) {
  amp.setup = s; amp.rail = { x: 0, v: 0, work: 0 }; amp.hist = []; amp.t = 0;
  document.querySelectorAll("[data-setup-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setupValue === s)));
  document.querySelectorAll("[data-setup-only]").forEach((el) => { el.hidden = el.dataset.setupOnly !== s; });
  setupTabs(); setTab(ui.tab); refresh(); stage.render();
}
$("[data-meas-add]").addEventListener("click", () => { amp.pts.push({ I: amp.I, F: (amp.m / 1000) * 9.81 * Math.tan(amp.th) }); graph.render(); });
$("[data-meas-clear]").addEventListener("click", () => { amp.pts = []; graph.render(); });
$("[data-meas-scan]").addEventListener("click", () => {
  amp.pts = [];
  for (let I = -10; I <= 10; I += 2.5) { const F = P.ampereForce(amp.B, I, amp.l, amp.alpha * DEG); amp.pts.push({ I, F: (amp.m / 1000) * 9.81 * Math.tan(P.swingAngle(F, amp.m / 1000)) }); }
  graph.render();
});

const fICtl = bindRange($("#fI"), $("#fIOut"), (v) => `${fmt(v, 1)} A`, (v) => { frm.I = v; customized(); refresh(); graph.render(); });
const fBCtl = bindRange($("#fB"), $("#fBOut"), (v) => `${fmt(v, 2)} T`, (v) => { frm.B = v; customized(); refresh(); graph.render(); });
const fNCtl = bindRange($("#fN"), $("#fNOut"), (v) => `${fmt(v, 0)}`, (v) => { frm.N = v; customized(); refresh(); graph.render(); });
const fSCtl = bindRange($("#fS"), $("#fSOut"), (v) => `${fmt(v, 0)} cm²`, (v) => { frm.S = v; customized(); refresh(); graph.render(); });
const fKCtl = bindRange($("#fK"), $("#fKOut"), (v) => `${fmt(v, 0)}`, (v) => { frm.k = v; customized(); refresh(); });
$("[data-commutator]").addEventListener("change", (e) => { frm.commutator = e.target.checked; customized(); refresh(); graph.render(); });
$("[data-kick]").addEventListener("click", () => { frm.st.omega += 6; });

/* ------------------------------------------------------------------ Simulyatsiya qadami */

function stepSim(dt) {
  if (ui.mode === "field") {
    // kompas millari: so'nuvchi tebranish bilan maydon yo'nalishiga buriladi
    objs.forEach((o) => {
      if (o.type !== "compass") return;
      const [bx, by] = Bat(o.x, o.y); const b = Math.hypot(bx, by);
      if (b < 1e-12) { o.w *= 0.95; o.ang += o.w * dt; return; }
      const target = Math.atan2(by, bx);
      let d = target - o.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      const k = 60, cdamp = 5;
      o.w += (k * Math.sin(d) - cdamp * o.w) * dt; o.ang += o.w * dt;
    });
  } else if (ui.mode === "ampere") {
    const F = ampF(), m = amp.m / 1000;
    if (amp.setup === "swing") {
      const Lp = 0.3, n = 8, h = dt / n;
      for (let k = 0; k < n; k++) { const acc = (F * Math.cos(amp.th) - m * 9.81 * Math.sin(amp.th)) / (m * Lp) - 3 * amp.om; amp.om += acc * h; amp.th += amp.om * h; }
    } else {
      if (amp.rail.x < 0.6 && amp.rail.x > -0.001) {
        const n = 10, h = dt / n;
        for (let k = 0; k < n; k++) { P.railStep(amp.rail, { B: amp.B, I: amp.I, l: amp.l, m, mu: amp.mu }, h); if (amp.rail.x >= 0.6) { amp.rail.x = 0.6; amp.rail.v = 0; amp.rail.work = F * 0.6; break; } }
        if (amp.rail.x < 0) { amp.rail.x = 0; amp.rail.v = 0; }
        amp.t += dt;
        if (amp.t - (amp.hist.length ? amp.hist[amp.hist.length - 1].t : -1) > 0.03) amp.hist.push({ t: amp.t, x: amp.rail.x, v: amp.rail.v, A: amp.rail.work });
      } else if (amp.rail.x >= 0.6) { amp.rail.x = 0.6; amp.rail.v = 0; }
    }
  } else {
    const p = { N: frm.N, B: frm.B, I: frm.I, S: frm.S / 1e4, J: 2e-3, k: frm.k * 1e-3, commutator: frm.commutator };
    const n = 20, h = dt / n;
    for (let k = 0; k < n; k++) P.frameStep(frm.st, p, h);
    if (Math.abs(frm.st.omega) > 120) frm.st.omega = 120 * Math.sign(frm.st.omega); // xavfsizlik chegarasi
    frm.t += dt;
    if (frm.t - (frm.hist.length ? frm.hist[frm.hist.length - 1].t : -1) > 0.05) { frm.hist.push({ t: frm.t, w: Math.abs(frm.st.omega) * 60 / TAU }); if (frm.hist.length > 600) frm.hist.shift(); }
  }
}

/* ------------------------------------------------------------------ Tayyor tajribalar */

const C = (x, y) => [x, y];
const PRESETS = {
  bar: { mode: "field", title: "Doimiy magnit", lesson: "Polosali magnit maydoni: kuch chiziqlari N qutbdan chiqib S qutbga kiradi, qutblar yonida zich. Kompasni suring — mil kuch chizig‘i bo‘ylab joylashadi.", set: () => { objs = [mk.magnet(0.2, 0.12, 0, 20), mk.compass(0.3, 0.17), mk.compass(0.1, 0.06)]; ui.earth = false; } },
  attract: { mode: "field", title: "Ikki magnit: tortishish", lesson: "Har xil qutblar (N va S) bir-biriga qaragan: kuch chiziqlari bir magnitdan ikkinchisiga o‘tadi — magnitlar tortishadi.", set: () => { objs = [mk.magnet(0.12, 0.12, 0, 20), mk.magnet(0.28, 0.12, 0, 20)]; ui.earth = false; } },
  repel: { mode: "field", title: "Ikki magnit: itarilish", lesson: "Bir xil qutblar (N va N) bir-biriga qaragan: chiziqlar bir-biridan qochadi, orada maydon kuchsiz nuqta hosil bo‘ladi — magnitlar itariladi.", set: () => { objs = [mk.magnet(0.12, 0.12, 0, 20), mk.magnet(0.28, 0.12, Math.PI, 20)]; ui.earth = false; } },
  oersted: { mode: "field", title: "Ersted tajribasi", lesson: "Kompas Yer maydonida shimolga qaragan. Uning yonida tokli o‘tkazgich: tok o‘tganda mil buriladi. Tok kuchini o‘zgartiring, yo‘nalishini almashtiring yoki nolga tushiring.", set: () => { objs = [mk.wire(0.2, 0.12, 5), mk.compass(0.2, 0.155), mk.compass(0.2, 0.085), mk.compass(0.33, 0.19)]; ui.earth = true; }, sel: 0 },
  wire: { mode: "field", title: "To‘g‘ri tok maydoni", lesson: "Tok atrofidagi kuch chiziqlari — konsentrik aylanalar (o‘ng parma qoidasi). Kompasni uzoqlashtiring: B = μ₀I/(2πr) kamayadi. «B(r)» grafigini ko‘ring.", set: () => { objs = [mk.wire(0.2, 0.12, 10), mk.compass(0.24, 0.12)]; ui.earth = false; }, sel: 0 },
  parallel: { mode: "field", title: "Parallel toklar (tortishish)", lesson: "Bir yo‘nalishdagi parallel toklar tortishadi: F/l = μ₀I₁I₂/(2πd). O‘tkazgichlarni suring — masofa kamaysa kuch ortadi.", set: () => { objs = [mk.wire(0.16, 0.12, 15), mk.wire(0.24, 0.12, 15)]; ui.earth = false; } },
  antiparallel: { mode: "field", title: "Qarama-qarshi toklar (itarilish)", lesson: "Toklar qarama-qarshi yo‘nalishda — o‘tkazgichlar itariladi, ular orasida maydon kuchayadi.", set: () => { objs = [mk.wire(0.16, 0.12, 15), mk.wire(0.24, 0.12, -15)]; ui.earth = false; } },
  coil: { mode: "field", title: "G‘altak (solenoid)", lesson: "G‘altak ichida maydon bir jinsli va kuchli, tashqarida polosali magnitnikiga o‘xshaydi. Uchlari — N va S qutblar (o‘ng qo‘l qoidasi).", set: () => { objs = [mk.coil(0.2, 0.12, 0, 200, 2, false), mk.compass(0.33, 0.12), mk.compass(0.2, 0.2)]; ui.earth = false; }, sel: 0 },
  electromagnet: { mode: "field", title: "Elektromagnit (temir o‘zak)", lesson: "Temir o‘zak g‘altak maydonini ko‘p marta kuchaytiradi. O‘zakni olib tashlab yoki o‘ramlar sonini, tokni o‘zgartirib solishtiring.", set: () => { objs = [mk.coil(0.2, 0.12, 0, 200, 1, true), mk.compass(0.34, 0.12)]; ui.earth = false; }, sel: 0 },
  earth: { mode: "field", title: "Yerning magnit maydoni", lesson: "Faqat Yer maydoni: barcha kompaslar shimolga qaraydi. Magnit qo‘shib, uning yaqinida kompaslar qanday burilishini kuzating.", set: () => { objs = [mk.compass(0.1, 0.08), mk.compass(0.2, 0.16), mk.compass(0.3, 0.08)]; ui.earth = true; ui.view = "grid"; } },
  amp: { mode: "ampere", title: "Amper kuchi (osma o‘tkazgich)", lesson: "Taqasimon magnit qutblari orasidagi tokli o‘tkazgich og‘adi. Tok yo‘nalishini yoki kuchini o‘zgartiring, α burchakni kamaytiring.", set: () => { Object.assign(amp, { I: 5, B: 0.2, l: 0.1, alpha: 90, m: 20, th: 0, om: 0, pts: [] }); setSetup("swing"); }, tab: "fi" },
  ampLab: { mode: "ampere", title: "Lab: F(I) ni o‘lchash", lesson: "Har xil tok kuchida o‘tkazgich og‘ish burchagini o‘lchang («Nuqta qo‘shish»): F = mg·tgθ. Nuqtalar to‘g‘ri chiziqqa tushadi — F ∝ I.", set: () => { Object.assign(amp, { I: 2, B: 0.3, l: 0.1, alpha: 90, m: 20, th: 0, om: 0, pts: [] }); setSetup("swing"); }, tab: "fi" },
  rail: { mode: "ampere", title: "Relsdagi o‘tkazgich: ish", lesson: "Tok o‘tganda o‘tkazgich relslar bo‘ylab siljiydi. Amper kuchi bajargan ish A = F·s tok va magnit oqimi o‘zgarishi ko‘paytmasiga teng: A = I·ΔΦ.", set: () => { Object.assign(amp, { I: 5, B: 0.3, l: 0.1, m: 20, mu: 0.1 }); setSetup("rail"); }, tab: "rail" },
  frame: { mode: "frame", title: "Tokli ramka (kollektorsiz)", lesson: "Ramkaga aylantiruvchi moment ta’sir qiladi, lekin u normali B bilan bir yo‘nalishga kelgach tebranib to‘xtaydi. «Turtki berish» ni bosing.", set: () => { Object.assign(frm, { I: 2, B: 0.2, N: 50, S: 40, k: 1, commutator: false, st: { phi: 1.4, omega: 0 }, hist: [], t: 0 }); }, tab: "torque" },
  motor: { mode: "frame", title: "O‘zgarmas tok elektr dvigateli", lesson: "Kollektor tok yo‘nalishini har yarim aylanishda almashtiradi — ramka uzluksiz aylanadi. Tok, B yoki o‘ramlar sonini oshiring — tezlik ortadi.", set: () => { Object.assign(frm, { I: 2, B: 0.2, N: 50, S: 40, k: 5, commutator: true, st: { phi: 1.4, omega: 0 }, hist: [], t: 0 }); }, tab: "omega" },
};
void C;
const GROUPS = [["Magnit maydon", ["bar", "attract", "repel", "oersted", "wire", "parallel", "antiparallel", "coil", "electromagnet", "earth"]], ["Amper kuchi", ["amp", "ampLab", "rail"]], ["Tokli ramka", ["frame", "motor"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function loadPreset(id) {
  const p = PRESETS[id];
  ui.view = "lines";
  setMode(p.mode);
  p.set();
  sel = p.sel ?? -1;
  presetId = id;
  setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll();
  if (p.tab) { setupTabs(); setTab(p.tab); }
  changed();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}
function syncAll() {
  document.querySelectorAll("[data-view-value]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.viewValue === ui.view)));
  $("[data-earth]").checked = ui.earth; $("[data-forces]").checked = ui.forces; $("[data-heat]").checked = ui.heat;
  aICtl.set(amp.I); aBCtl.set(amp.B); aLCtl.set(amp.l); aAlCtl.set(amp.alpha); aMCtl.set(amp.m); aMuCtl.set(amp.mu);
  fICtl.set(frm.I); fBCtl.set(frm.B); fNCtl.set(frm.N); fSCtl.set(frm.S); fKCtl.set(frm.k); $("[data-commutator]").checked = frm.commutator;
}

const MODE_HINT = { field: "Magnit, tok va g‘altak maydoni — obyektlarni suring", ampere: "Magnit maydondagi tokli o‘tkazgichga ta’sir etuvchi kuch", frame: "Tokli ramkaning aylanishi va elektr dvigatel" };
function setMode(mode) {
  ui.mode = mode;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== mode || (el === propsBox && sel < 0); });
  $("[data-view]").hidden = mode !== "field";
  $("[data-mode-hint]").textContent = MODE_HINT[mode];
  setupTabs(); setTab(ui.tab);
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.modeValue !== ui.mode) loadPreset({ field: "bar", ampere: "amp", frame: "motor" }[b.dataset.modeValue]);
}));

/* ------------------------------------------------------------------ Ishga tushirish */

const playBtn = $("[data-play]");
function syncPlay(running) { playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : "Davom ettirish"; }
let uiTimer = 0;
const loop = createLoop((dt) => {
  stepSim(dt);
  uiTimer += dt;
  if (uiTimer > 0.15) { uiTimer = 0; refresh(); if (ui.mode !== "field") graph.render(); }
  stage.render();
}, { onStateChange: syncPlay });
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));
$("[data-reset]").addEventListener("click", () => {
  if (presetId) loadPreset(presetId);
  else if (ui.mode === "ampere") { amp.th = 0; amp.om = 0; amp.rail = { x: 0, v: 0, work: 0 }; amp.hist = []; amp.t = 0; }
  else if (ui.mode === "frame") { frm.st = { phi: 1.4, omega: 0 }; frm.hist = []; frm.t = 0; }
});

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "bar");
if (!prefersReducedMotion()) loop.start(); else { syncPlay(false); stage.render(); }
