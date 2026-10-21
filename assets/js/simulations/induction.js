// ==========================================================================
// Elektromagnit induksiya — virtual laboratoriya (simulations/induction.html)
// 1) Faradey tajribasi: magnit g'altak ichidan o'tadi — galvanometr, Lens qoidasi, Ψ(t), ε(t).
// 2) Generator: ramka magnit maydonida aylanadi — o'zgaruvchan (halqalar) yoki bir yo'nalishli (kollektor) tok.
// 3) O'zinduksiya: lampa + rezistor va lampa + g'altak shoxchalari; kalitni ulash/uzish.
// Fizika: induction-physics.js (Node'da tekshirilgan). Grafiklar: induction-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./induction-physics.js";
import { drawSeries } from "./induction-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const R_LAMP = 10, R_COIL = 2;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "faraday", tab: "emf", slow: 0.1 };
const fd = { motion: "pass", v: 1, m: 1, N: 200, R: 10, flip: false, x: -0.13, dir: 1, vel: 0, t: 0, hist: [], drag: null, a: 0.02, len: 0.06 };
const gen = { n: 2, B: 0.2, N: 100, S: 50, R: 20, comm: false, t: 0, hist: [] };
const self = { E: 6, L: 3, R: 20, core: true, closed: false, st: { i2: 0 }, out: { i1: 0, i2: 0, eSelf: 0, tau: 0.25 }, t: 0, hist: [], spark: 0 };
let presetId = null;

const coil = () => ({ m: (fd.flip ? -1 : 1) * fd.m, a: fd.a, len: fd.len, N: fd.N });
const genP = () => ({ N: gen.N, B: gen.B, S: gen.S / 1e4, omega: TAU * gen.n, commutator: gen.comm });
const selfP = () => ({ E: self.E, R1: self.R + R_LAMP, R2: R_COIL + R_LAMP, L: self.core ? self.L : self.L / 50, closed: self.closed });

function fdState() { return P.faraday(coil(), fd.x, fd.vel, fd.R); }

/* ------------------------------------------------------------------ Simulyatsiya */

const WINDOW = 1.5; // grafik oynasi (model soniyalari)
function push(hist, rec) { hist.push(rec); while (hist.length > 2 && hist[hist.length - 1].t - hist[0].t > WINDOW * 1.02) hist.shift(); }

function stepSim(dtReal) {
  const dt = dtReal * ui.slow;
  if (ui.mode === "faraday") {
    if (fd.motion === "hand") {
      if (!fd.drag) fd.vel *= Math.exp(-dtReal * 12);
    } else {
      const n = Math.max(1, Math.ceil((Math.abs(fd.v) * dt) / 0.0008));
      const h = dt / n;
      for (let k = 0; k < n; k++) {
        if (fd.motion === "pass") {
          fd.vel = fd.v * fd.dir; fd.x += fd.vel * h;
          if (fd.x > 0.13) { fd.x = 0.13; fd.dir = -1; } else if (fd.x < -0.13) { fd.x = -0.13; fd.dir = 1; }
        } else {
          const A = 0.12, w = fd.v / A;
          fd.phase = (fd.phase || 0) + w * h;
          fd.x = -A * Math.cos(fd.phase); fd.vel = A * w * Math.sin(fd.phase);
        }
        fd.t += h;
        if (k % 3 === 0) { const s = fdState(); push(fd.hist, { t: fd.t, e: s.emf, I: s.I, psi: s.psi }); }
      }
      return;
    }
    fd.t += dt;
    const s = fdState(); push(fd.hist, { t: fd.t, e: s.emf, I: s.I, psi: s.psi });
  } else if (ui.mode === "gen") {
    const p = genP(), n = 6, h = dt / n;
    for (let k = 0; k < n; k++) { gen.t += h; push(gen.hist, { t: gen.t, e: P.generatorEmf(p, gen.t), psi: P.generatorFlux(p, gen.t) }); }
  } else {
    const p = selfP(), n = 8, h = dt / n;
    for (let k = 0; k < n; k++) { self.out = P.rlStep(self.st, p, h); self.t += h; push(self.hist, { t: self.t, i1: self.out.i1, i2: self.out.i2, e: self.out.eSelf }); }
    self.spark = Math.max(0, self.spark - dtReal * 2.5);
  }
}

/* ------------------------------------------------------------------ Chizish: umumiy */

function currentSymbol(ctx, c, x, y, r, s) {
  ctx.save(); ctx.fillStyle = c.bg; ctx.strokeStyle = s === 0 ? c.text3 : c.text; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  if (s > 0) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, TAU); ctx.fill(); }
  else if (s < 0) { const k = r * 0.55; ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x - k, y + k); ctx.lineTo(x + k, y - k); ctx.stroke(); }
  ctx.restore();
}

function meterDial(ctx, c, x, y, R, value, max, unit, label) {
  ctx.save();
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, R, Math.PI, 0); ctx.lineTo(x + R, y + 10); ctx.lineTo(x - R, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2;
  for (let k = -5; k <= 5; k++) { const a = -Math.PI / 2 + (k / 5) * 1.1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); ctx.lineTo(x + Math.cos(a) * R * (k % 5 ? 0.88 : 0.94), y + Math.sin(a) * R * (k % 5 ? 0.88 : 0.94)); ctx.stroke(); }
  const f = clamp(value / max, -1.08, 1.08), a = -Math.PI / 2 + f * 1.1;
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R * 0.86, y + Math.sin(a) * R * 0.86); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
  ctx.fillStyle = c.text3; ctx.font = "700 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, x, y - R * 0.38); ctx.fillText("0", x, y - R * 0.97 - 6);
  ctx.restore();
  tag(ctx, `${fmt(value, Math.abs(value) < 10 ? 2 : 1)} ${unit}`, x, y + 24, { color: c.text, bg: c.bg, align: "center", font: "700 11.5px Inter, system-ui, sans-serif" });
}

function lamp(ctx, c, x, y, r, b) {
  ctx.save();
  if (b > 0.02) { const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * (1.6 + b)); g.addColorStop(0, `rgba(250,204,21,${0.25 + 0.55 * Math.min(b, 1)})`); g.addColorStop(1, "rgba(250,204,21,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * (1.6 + b), 0, TAU); ctx.fill(); }
  ctx.fillStyle = b > 0.02 ? `rgba(253,224,71,${0.35 + 0.6 * Math.min(b, 1)})` : c.bg; ctx.strokeStyle = c.text2; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  const k = r * 0.7; ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x - k, y + k); ctx.lineTo(x + k, y - k); ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ Faradey */

const fview = { s: 1, cx: 0, cy: 0 };
const FX = (x) => fview.cx + x * fview.s;

function drawMagnetBar(ctx, c, x, y, len, h, flip) {
  const L = len;
  ctx.save();
  ctx.fillStyle = flip ? "#ef4444" : "#3b82f6"; ctx.fillRect(x - L / 2, y - h / 2, L / 2, h);
  ctx.fillStyle = flip ? "#3b82f6" : "#ef4444"; ctx.fillRect(x, y - h / 2, L / 2, h);
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1.2; ctx.strokeRect(x - L / 2, y - h / 2, L, h);
  ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(Math.min(h * 0.75, 15))}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(flip ? "N" : "S", x - L / 4, y + 1); ctx.fillText(flip ? "S" : "N", x + L / 4, y + 1);
  ctx.restore();
}

function drawFaraday(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  fview.s = (cw - 40) / 0.32; fview.cx = cw / 2; fview.cy = ch * 0.4;
  const cy = fview.cy, R = clamp(ch * 0.15, 26, 44), Lc = fd.len * fview.s;
  const turns = clamp(Math.round(fd.N / 40), 5, 14);
  const st = fdState();
  const sI = Math.abs(st.I) > 2e-5 ? Math.sign(st.I) : 0;
  const x0 = cw / 2 - Lc / 2;
  // orqa yarim o'ramlar
  ctx.save(); ctx.strokeStyle = "#b45309"; ctx.lineWidth = 2; ctx.globalAlpha = 0.45;
  for (let k = 0; k < turns; k++) { const x = x0 + (Lc * (k + 0.5)) / turns; ctx.beginPath(); ctx.ellipse(x, cy, R * 0.28, R, 0, Math.PI / 2, (3 * Math.PI) / 2); ctx.stroke(); }
  ctx.restore();
  // magnit
  const mh = R * 0.75, ml = 0.06 * fview.s;
  drawMagnetBar(ctx, c, FX(fd.x), cy, ml, mh, fd.flip);
  // old yarim o'ramlar
  ctx.save(); ctx.strokeStyle = "#d97706"; ctx.lineWidth = 2.5;
  for (let k = 0; k < turns; k++) { const x = x0 + (Lc * (k + 0.5)) / turns; ctx.beginPath(); ctx.ellipse(x, cy, R * 0.28, R, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
  ctx.restore();
  // induksion tok yo'nalishi (old tomonda)
  if (sI !== 0) {
    for (let k = 1; k < turns; k += 3) {
      const x = x0 + (Lc * (k + 0.5)) / turns + R * 0.28;
      arrow(ctx, x + 4, cy + (sI > 0 ? 8 : -8), 0, sI > 0 ? -16 : 16, c.success, { width: 2, head: 6 });
    }
    // Lens: g'altak uchlarida qutblar
    const right = sI > 0 ? "N" : "S", left = sI > 0 ? "S" : "N";
    tag(ctx, left, x0 - 18, cy + R * 0.78, { color: left === "N" ? "#ef4444" : "#3b82f6", bg: c.bg, align: "center", font: "800 12px Inter, system-ui, sans-serif" });
    tag(ctx, right, x0 + Lc + 18, cy + R * 0.78, { color: right === "N" ? "#ef4444" : "#3b82f6", bg: c.bg, align: "center", font: "800 12px Inter, system-ui, sans-serif" });
  }
  // simlar va galvanometr
  const gx = cw / 2, gy = ch - 46, gR = clamp(ch * 0.14, 28, 46);
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, cy + R); ctx.lineTo(x0, gy); ctx.lineTo(gx - gR, gy); ctx.moveTo(x0 + Lc, cy + R); ctx.lineTo(x0 + Lc, gy); ctx.lineTo(gx + gR, gy); ctx.stroke(); ctx.restore();
  const Imax = Math.max(1, Math.ceil(peakI() * 1000 / 1) * 1);
  meterDial(ctx, c, gx, gy, gR, st.I * 1000, Imax, "mA", "G");
  // tezlik o'qi
  if (Math.abs(fd.vel) > 0.01) arrow(ctx, FX(fd.x), cy - R - 16, Math.sign(fd.vel) * clamp(10 + Math.abs(fd.vel) * 14, 10, 50), 0, c.primary, { width: 2, head: 7 });
  tag(ctx, `v = ${fmt(fd.vel, 2)} m/s`, FX(fd.x), cy - R - 34, { color: c.primary, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
  if (fd.motion === "hand" && !fd.drag && Math.abs(fd.vel) < 0.01) tag(ctx, "Magnitni sichqoncha yoki barmoq bilan suring", cw / 2, 14, { color: c.text2, bg: c.bg2, align: "center", font: "600 11px Inter, system-ui, sans-serif" });
}
function peakI() {
  // berilgan sozlamalarda kutiladigan eng katta tok (shkala uchun)
  const c0 = coil(); let mx = 0;
  for (let x = -0.08; x <= 0.08; x += 0.004) mx = Math.max(mx, Math.abs(P.coilLinkage(c0, x).dpsi));
  return (mx * Math.max(fd.v, 0.3)) / fd.R;
}

/* ------------------------------------------------------------------ Generator */

function drawGen(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const narrow = cw < 560;
  const cx = cw * (narrow ? 0.38 : 0.36), cy = ch * 0.5, R = Math.min(ch * 0.3, cw * 0.15);
  const gap = R * 1.35, pw = Math.min(56, cw * 0.1), phh = R * 2.2;
  ctx.save();
  ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.moveTo(cx - gap - pw, cy - phh / 2); ctx.lineTo(cx - gap, cy - phh / 2); ctx.arc(cx, cy, gap, Math.PI + 0.75, Math.PI - 0.75, true); ctx.lineTo(cx - gap - pw, cy + phh / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.moveTo(cx + gap + pw, cy - phh / 2); ctx.lineTo(cx + gap, cy - phh / 2); ctx.arc(cx, cy, gap, -0.75, 0.75, false); ctx.lineTo(cx + gap + pw, cy + phh / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "800 16px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("N", cx - gap - pw / 2 - 3, cy); ctx.fillText("S", cx + gap + pw / 2 + 3, cy);
  ctx.restore();
  for (let k = -2; k <= 2; k++) { const y = cy + k * R * 0.42; ctx.save(); ctx.strokeStyle = "rgba(59,130,246,0.3)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - gap + 4, y); ctx.lineTo(cx + gap - 4, y); ctx.stroke(); ctx.restore(); }
  const p = genP(), th = p.omega * gen.t;
  const e = P.generatorEmf({ ...p, commutator: false }, gen.t);
  const px = -Math.sin(th), py = Math.cos(th);
  const A = [cx + px * R, cy - py * R], Bq = [cx - px * R, cy + py * R];
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...Bq); ctx.stroke(); ctx.restore();
  arrow(ctx, cx, cy, Math.cos(th) * R * 0.7, -Math.sin(th) * R * 0.7, c.success, { width: 2, head: 7 });
  const sE = Math.abs(e) > emfThreshold() ? Math.sign(e) : 0;
  currentSymbol(ctx, c, A[0], A[1], 10, sE);
  currentSymbol(ctx, c, Bq[0], Bq[1], 10, -sE);
  // aylanish yo'nalishi
  ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.restore();
  arrow(ctx, cx + R * Math.cos(-0.5), cy + R * Math.sin(-0.5), -8, -12, c.text3, { width: 1.5, head: 6 });
  // halqalar / kollektor va yuklama
  const rx = narrow ? cw * 0.74 : cw * 0.68, ry = cy - 30;
  ctx.save(); ctx.lineWidth = 3;
  if (gen.comm) {
    ctx.strokeStyle = "#b45309"; ctx.beginPath(); ctx.arc(rx, ry, 14, -th + 0.15, -th + Math.PI - 0.15); ctx.stroke();
    ctx.strokeStyle = "#d97706"; ctx.beginPath(); ctx.arc(rx, ry, 14, -th + Math.PI + 0.15, -th + TAU - 0.15); ctx.stroke();
  } else {
    ctx.strokeStyle = "#b45309"; ctx.beginPath(); ctx.ellipse(rx - 10, ry, 5, 14, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "#d97706"; ctx.beginPath(); ctx.ellipse(rx + 10, ry, 5, 14, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  tag(ctx, gen.comm ? "kollektor" : "kontakt halqalar", rx, ry - 30, { color: c.text2, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
  const eOut = P.generatorEmf(p, gen.t), Iout = eOut / gen.R;
  const lx = rx, ly = cy + 50, Ppk = (P.emfMax(p) ** 2) / gen.R;
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx - 10, ry + 14); ctx.lineTo(lx - 22, ly); ctx.moveTo(rx + 10, ry + 14); ctx.lineTo(lx + 22, ly); ctx.stroke(); ctx.restore();
  lamp(ctx, c, lx, ly, 14, clamp((eOut * Iout) / Math.max(Ppk, 1e-9), 0, 1.2) * clamp(Ppk / 2, 0.15, 1.2));
  tag(ctx, `ε = ${fmt(eOut, Math.abs(eOut) < 10 ? 2 : 1)} V`, lx, ly + 30, { color: c.text, bg: c.bg, align: "center", font: "700 11.5px Inter, system-ui, sans-serif" });
  const deg = ((((th * 180) / Math.PI) % 360) + 360) % 360;
  tag(ctx, `φ = ${fmt(deg, 0)}°`, 12, 16, { color: c.text, bg: c.bg2, font: "700 11px Inter, system-ui, sans-serif" });
}
const emfThreshold = () => P.emfMax(genP()) * 0.03;

/* ------------------------------------------------------------------ O'zinduksiya */

function resistor(ctx, x, y, w, h) { ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill(); ctx.stroke(); }

function drawSelf(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const L = 40, Rt = cw - 30, T = ch * 0.22, Bm = ch * 0.78, mid = ch * 0.5;
  const xS = L + 70, xJ = L + 120; // kalit va tugun
  const o = self.out, p = selfP();
  const Inorm = self.E / (R_COIL + R_LAMP);
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.fillStyle = c.bg;
  // manba (chapda, vertikal)
  ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, mid - 10); ctx.moveTo(L, mid + 10); ctx.lineTo(L, Bm); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(L - 14, mid - 6); ctx.lineTo(L + 14, mid - 6); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(L - 8, mid + 6); ctx.lineTo(L + 8, mid + 6); ctx.stroke();
  ctx.lineWidth = 2;
  // yuqori sim va kalit
  ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(xS - 20, T); ctx.moveTo(xS + 20, T); ctx.lineTo(Rt, T); ctx.stroke();
  ctx.fillStyle = c.text2; [xS - 20, xS + 20].forEach((x) => { ctx.beginPath(); ctx.arc(x, T, 3, 0, TAU); ctx.fill(); });
  ctx.strokeStyle = self.closed ? c.success : c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xS - 20, T);
  if (self.closed) ctx.lineTo(xS + 20, T); else ctx.lineTo(xS + 14, T - 22); ctx.stroke();
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2;
  // pastki sim
  ctx.beginPath(); ctx.moveTo(L, Bm); ctx.lineTo(Rt, Bm); ctx.stroke();
  // ikki shoxcha (vertikal): 1 — lampa + reostat, 2 — lampa + g'altak
  const b1 = xJ + (Rt - xJ) * 0.3, b2 = xJ + (Rt - xJ) * 0.78;
  ctx.beginPath(); ctx.moveTo(b1, T); ctx.lineTo(b1, Bm); ctx.moveTo(b2, T); ctx.lineTo(b2, Bm); ctx.stroke();
  ctx.fillStyle = c.bg; resistor(ctx, b1, T + (Bm - T) * 0.7, 14, 34);
  ctx.restore();
  // g'altak
  const gy0 = T + (Bm - T) * 0.55, gy1 = T + (Bm - T) * 0.88;
  ctx.save(); ctx.fillStyle = c.bg; ctx.fillRect(b2 - 12, gy0, 24, gy1 - gy0); ctx.strokeStyle = "#d97706"; ctx.lineWidth = 2.25;
  ctx.beginPath(); const nT = 6; for (let k = 0; k <= nT * 16; k++) { const t = k / (nT * 16); const y = gy0 + t * (gy1 - gy0); const x = b2 + Math.sin(t * nT * TAU) * 9; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
  if (self.core) { ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b2 + 15, gy0); ctx.lineTo(b2 + 15, gy1); ctx.moveTo(b2 + 19, gy0); ctx.lineTo(b2 + 19, gy1); ctx.stroke(); }
  ctx.restore();
  // lampalar
  const ly = T + (Bm - T) * 0.3;
  lamp(ctx, c, b1, ly, 14, clamp(Math.abs(o.i1) / Inorm, 0, 1.4));
  lamp(ctx, c, b2, ly, 14, clamp(Math.abs(o.i2) / Inorm, 0, 1.4));
  tag(ctx, "L₁", b1 - 26, ly, { color: c.text2, bg: c.bg, align: "right", font: "700 11px Inter, system-ui, sans-serif" });
  tag(ctx, "L₂", b2 - 26, ly, { color: c.text2, bg: c.bg, align: "right", font: "700 11px Inter, system-ui, sans-serif" });
  tag(ctx, `R = ${fmt(self.R, 0)} Ω`, b1 + 14, T + (Bm - T) * 0.7, { color: c.text2, bg: c.bg, font: "600 10.5px Inter, system-ui, sans-serif" });
  tag(ctx, `L = ${fmt(p.L, p.L < 1 ? 2 : 1)} H`, b2 + 24, (gy0 + gy1) / 2, { color: c.text2, bg: c.bg, font: "600 10.5px Inter, system-ui, sans-serif" });
  tag(ctx, `ε = ${fmt(self.E, 1)} V`, L + 18, mid, { color: c.text2, bg: c.bg, font: "600 10.5px Inter, system-ui, sans-serif" });
  // tok strelkalari
  const arr = (x, y, I) => { if (Math.abs(I) / Inorm < 0.03) return; arrow(ctx, x + 22, y + (I > 0 ? -12 : 12), 0, I > 0 ? 24 : -24, c.warning, { width: 2, head: 7 }); };
  arr(b1, T + (Bm - T) * 0.5, o.i1); arr(b2, T + (Bm - T) * 0.42, o.i2);
  tag(ctx, `I₁ = ${fmt(o.i1 * 1000, 0)} mA`, b1, Bm + 16, { color: c.text, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
  tag(ctx, `I₂ = ${fmt(o.i2 * 1000, 0)} mA`, b2, Bm + 16, { color: c.text, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
  // uchqun (kalit uzilganda)
  if (self.spark > 0.05) {
    ctx.save(); ctx.strokeStyle = `rgba(250,204,21,${self.spark})`; ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + self.t * 40; ctx.beginPath(); ctx.moveTo(xS + 6, T - 8); ctx.lineTo(xS + 6 + Math.cos(a) * 14 * self.spark, T - 8 + Math.sin(a) * 14 * self.spark); ctx.stroke(); }
    ctx.restore();
  }
  tag(ctx, self.closed ? "Kalit ulangan" : "Kalit uzilgan", xS, T - 34, { color: self.closed ? c.success : c.text2, bg: c.bg, align: "center", font: "700 11px Inter, system-ui, sans-serif" });
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "faraday") drawFaraday(ctx, stage); else if (ui.mode === "gen") drawGen(ctx, stage); else drawSelf(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.48, vh * 0.42), 240, 330)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  faraday: [["emf", "ε(τ)", "Induksiya EYuK va tok", "Magnit yaqinlashganda va uzoqlashganda EYuK ishorasi qarama-qarshi. Magnit tinch tursa (g‘altak ichida bo‘lsa ham) EYuK nolga teng — muhimi oqimning o‘zgarishi."], ["psi", "Ψ(τ)", "G‘altakdagi magnit oqimi", "EYuK oqim grafigining qiyaligiga teng (teskari ishora bilan): ε = −ΔΨ/Δt."]],
  gen: [["emf", "ε(τ)", "Generator EYuK", "Halqalar bilan — sinusoidal o‘zgaruvchan tok; kollektor bilan — bir yo‘nalishli, lekin pulsatsiyalanuvchi tok."], ["psi", "Ψ(τ)", "Ramka orqali magnit oqimi", "Oqim eng katta bo‘lganda (ramka B ga tik) EYuK nolga teng, oqim nol bo‘lganda EYuK eng katta."]],
  self: [["i", "I(τ)", "Shoxchalardagi toklar", "Kalit ulanganda g‘altakli shoxchada tok asta ortadi (τ = L/R); uzilganda g‘altak toki birinchi lampa orqali so‘nadi — lampa chaqnaydi."], ["e", "ε_o‘z(τ)", "O‘zinduksiya EYuK", "ε_o‘z = −L·ΔI/Δt: tok tez o‘zgarganda katta bo‘ladi (kalit uzilganda — uchqun)."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, label]) => `<button type="button" data-tab-value="${id}">${label}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  const c = st.colors;
  if (ui.mode === "faraday") {
    if (ui.tab === "psi") drawSeries(ctx, st, { hist: fd.hist, window: WINDOW, series: [{ key: "psi", k: 1000, color: c.primary, label: "Ψ, mWb" }], yLabel: "Ψ, mWb" });
    else drawSeries(ctx, st, { hist: fd.hist, window: WINDOW, series: [{ key: "e", k: 1000, color: c.danger, label: "ε, mV" }, { key: "I", k: 1000 * fd.R, color: c.success, label: `I·R (I, mA × ${fmt(fd.R, 0)})`, dash: [5, 4] }], yLabel: "ε, mV", sym: true });
  } else if (ui.mode === "gen") {
    if (ui.tab === "psi") drawSeries(ctx, st, { hist: gen.hist, window: WINDOW, series: [{ key: "psi", k: 1000, color: c.primary, label: "Ψ = NBS·cosωt, mWb" }], yLabel: "Ψ, mWb", sym: true });
    else drawSeries(ctx, st, { hist: gen.hist, window: WINDOW, series: [{ key: "e", k: 1, color: c.danger, label: gen.comm ? "ε (kollektor)" : "ε = NBSω·sinωt" }], yLabel: "ε, V", sym: true, hline: gen.comm ? null : P.emfMax(genP()) / Math.SQRT2, hlabel: "ε_ef" });
  } else {
    if (ui.tab === "e") drawSeries(ctx, st, { hist: self.hist, window: WINDOW, series: [{ key: "e", k: 1, color: c.special, label: "ε_o‘z, V" }], yLabel: "ε, V", sym: true });
    else drawSeries(ctx, st, { hist: self.hist, window: WINDOW, series: [{ key: "i1", k: 1000, color: c.primary, label: "I₁ (lampa + R)" }, { key: "i2", k: 1000, color: c.warning, label: "I₂ (lampa + g‘altak)" }], yLabel: "I, mA", sym: true });
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
const v2 = (x, u, d = 2) => `${fmt(x, d)}<small>${u}</small>`;

function updateReadouts() {
  if (ui.mode === "faraday") {
    const s = fdState(), dPsi = -s.emf;
    setRO("r1", "Induksiya EYuK <i>ε</i>", v2(s.emf * 1000, "mV"), "ε = −ΔΨ/Δt");
    setRO("r2", "Induksion tok <i>I</i>", v2(s.I * 1000, "mA"), `I = ε/R, R = ${fmt(fd.R, 0)} Ω`);
    setRO("r3", "Magnit oqimi <i>Ψ</i>", v2(s.psi * 1000, "mWb", 3), `N = ${fd.N} o‘ram`);
    setRO("r4", "Oqim o‘zgarish tezligi", v2(dPsi * 1000, "mWb/s"), "ΔΨ/Δt");
    setRO("r5", "Magnit tezligi <i>v</i>", v2(fd.vel, "m/s"), `x = ${fmt(fd.x * 100, 1)} cm (g‘altak markazidan)`);
    const lenz = Math.abs(s.I) < 2e-5 ? "Oqim o‘zgarmayapti — tok yo‘q" : (Math.sign(s.psi) * dPsi > 0 ? "|Ψ| ortmoqda: g‘altak magnitni itaradi" : "|Ψ| kamaymoqda: g‘altak magnitni tortadi");
    setRO("r6", "Lens qoidasi", Math.abs(s.I) < 2e-5 ? "—" : (s.I > 0 ? "o‘ng uchi N" : "o‘ng uchi S"), lenz, Math.abs(s.I) < 2e-5 ? "muted" : "");
  } else if (ui.mode === "gen") {
    const p = genP(), e = P.generatorEmf(p, gen.t), em = P.emfMax(p);
    setRO("r1", "Oniy EYuK <i>ε</i>", v2(e, "V"), gen.comm ? "Kollektor: bir yo‘nalishli" : "ε = NBSω·sinωt");
    setRO("r2", "Amplituda <i>ε</i><sub>max</sub>", v2(em, "V"), "ε_max = NBSω");
    setRO("r3", "Ta’sir etuvchi qiymat", v2(em / Math.SQRT2, "V"), gen.comm ? "Halqalar uchun ε_max/√2" : "ε_ef = ε_max/√2");
    setRO("r4", "Chastota <i>ν</i>", v2(gen.n, "Hz", 1), `T = ${fmt(1 / gen.n, 3)} s, ω = ${fmt(p.omega, 1)} rad/s`);
    setRO("r5", "Yuklamadagi tok", v2((e / gen.R) * 1000, "mA", 0), `R = ${fmt(gen.R, 0)} Ω`);
    setRO("r6", "Magnit oqimi <i>Ψ</i>", v2(P.generatorFlux(p, gen.t) * 1000, "mWb"), `N = ${gen.N}, B = ${fmt(gen.B, 2)} T, S = ${fmt(gen.S, 0)} cm²`);
  } else {
    const o = self.out, p = selfP();
    setRO("r1", "Lampa 1 toki <i>I</i>₁", v2(o.i1 * 1000, "mA", 0), self.closed ? "Rezistorli shoxcha — darhol" : "Uzilgandan so‘ng — g‘altak toki (teskari)");
    setRO("r2", "Lampa 2 toki <i>I</i>₂", v2(o.i2 * 1000, "mA", 0), "G‘altakli shoxcha");
    setRO("r3", "Vaqt doimiysi <i>τ</i>", v2(p.L / (self.closed ? p.R2 : p.R1 + p.R2), "s", 3), self.closed ? "τ = L/R₂" : "τ = L/(R₁ + R₂)");
    setRO("r4", "O‘zinduksiya EYuK", v2(o.eSelf, "V"), "ε_o‘z = −L·ΔI/Δt");
    setRO("r5", "Magnit maydon energiyasi", v2(P.magEnergy(p.L, o.i2) * 1000, "mJ"), "W = LI²/2");
    setRO("r6", "Induktivlik <i>L</i>", v2(p.L, "H", p.L < 1 ? 3 : 2), self.core ? "Temir o‘zak bilan" : "O‘zaksiz (≈50 marta kichik)");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let text, tone = "blue";
  if (ui.mode === "faraday") { const I = Math.abs(fdState().I); text = I > 2e-5 ? "Induksion tok bor" : "Tok yo‘q"; tone = I > 2e-5 ? "orange" : "blue"; }
  else if (ui.mode === "gen") { text = gen.comm ? "Bir yo‘nalishli tok" : "O‘zgaruvchan tok"; tone = "orange"; }
  else { const d = Math.abs(self.out.eSelf) > 0.05; text = d ? (self.closed ? "Tok o‘rnatilmoqda" : "Tok so‘nmoqda") : self.closed ? "Barqaror tok" : "Tok yo‘q"; tone = d ? "purple" : self.closed ? "green" : "blue"; }
  el.textContent = text; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const parts = [];
  if (ui.mode === "faraday") {
    parts.push("<p><b>Elektromagnit induksiya</b>: g‘altakdan o‘tuvchi magnit oqimi o‘zgarganda unda EYuK hosil bo‘ladi va yopiq zanjirda tok oqadi (galvanometr mili og‘adi). EYuK oqimning o‘zgarish tezligiga proporsional: ε = −NΔΦ/Δt.</p>");
    parts.push("<p><b>Lens qoidasi</b>: induksion tok shunday yo‘naladiki, uning magnit maydoni oqim o‘zgarishiga qarshilik qiladi. Magnit yaqinlashsa, g‘altak unga qarshi bir xil qutbi bilan qaraydi (itaradi); uzoqlashsa — qarama-qarshi qutb bilan (tortadi).</p>");
    parts.push("<p>Magnit tezroq harakatlansa yoki o‘ramlar ko‘p bo‘lsa, EYuK katta bo‘ladi. Magnit to‘xtasa — tok yo‘qoladi.</p>");
  } else if (ui.mode === "gen") {
    parts.push("<p><b>Generator</b>: ramka magnit maydonda aylanganda undan o‘tuvchi oqim Φ = BS cosωt davriy o‘zgaradi va EYuK hosil bo‘ladi: ε = NBSω·sinωt. Bu — mexanik energiyani elektr energiyasiga aylantirish.</p>");
    parts.push(gen.comm ? "<p><b>Kollektor</b> har yarim aylanishda ramka uchlarini almashtiradi — tashqi zanjirda tok yo‘nalishi o‘zgarmaydi (o‘zgarmas tok generatori).</p>" : "<p><b>Kontakt halqalar</b> orqali tashqi zanjirga o‘zgaruvchan tok beriladi. Ta’sir etuvchi qiymat ε_ef = ε_max/√2.</p>");
  } else {
    parts.push("<p><b>O‘zinduksiya</b>: g‘altakdagi tok o‘zgarganda uning o‘z magnit oqimi o‘zgaradi va g‘altakning o‘zida EYuK hosil bo‘ladi: ε_o‘z = −L·ΔI/Δt. U tokning o‘zgarishiga qarshilik qiladi.</p>");
    parts.push("<p>Kalit ulanganda L₁ lampa darhol yonadi, L₂ esa (g‘altakli) kechikib yonadi. Kalit uzilganda g‘altakda to‘plangan energiya W = LI²/2 lampalar orqali tok hosil qiladi — L₁ bir lahza chaqnab o‘chadi.</p>");
  }
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const f = $("[data-formula]");
  const html = ui.mode === "faraday" ? "<small>Faradey qonuni</small> ε = −N·ΔΦ / Δt" : ui.mode === "gen" ? "<small>Generator</small> ε = NBSω·sinωt" : "<small>O‘zinduksiya</small> ε = −L·ΔI / Δt";
  if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); }

/* ------------------------------------------------------------------ Boshqaruv */

const fVc = bindRange($("#fV"), $("#fVOut"), (v) => `${fmt(v, 1)} m/s`, (v) => { fd.v = v; customized(); });
const fMc = bindRange($("#fM"), $("#fMOut"), (v) => `${fmt(v, 1)} A·m²`, (v) => { fd.m = v; customized(); });
const fNc = bindRange($("#fN"), $("#fNOut"), (v) => `${fmt(v, 0)}`, (v) => { fd.N = v; customized(); });
const fRc = bindRange($("#fR"), $("#fROut"), (v) => `${fmt(v, 0)} Ω`, (v) => { fd.R = v; customized(); });
$("[data-flip]").addEventListener("click", () => { fd.flip = !fd.flip; customized(); });
document.querySelectorAll("[data-motion-value]").forEach((b) => b.addEventListener("click", () => { setMotion(b.dataset.motionValue); customized(); }));
function setMotion(m) { fd.motion = m; fd.vel = 0; fd.phase = Math.acos(clamp(-fd.x / 0.12, -1, 1)); document.querySelectorAll("[data-motion-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.motionValue === m))); }

const gNc = bindRange($("#gN"), $("#gNOut"), (v) => `${fmt(v, 1)} ayl/s`, (v) => { const th = TAU * gen.n * gen.t; gen.n = v; gen.t = th / (TAU * v); gen.hist = []; customized(); });
const gBc = bindRange($("#gB"), $("#gBOut"), (v) => `${fmt(v, 2)} T`, (v) => { gen.B = v; customized(); });
const gWc = bindRange($("#gW"), $("#gWOut"), (v) => `${fmt(v, 0)}`, (v) => { gen.N = v; customized(); });
const gSc = bindRange($("#gS"), $("#gSOut"), (v) => `${fmt(v, 0)} cm²`, (v) => { gen.S = v; customized(); });
const gRc = bindRange($("#gR"), $("#gROut"), (v) => `${fmt(v, 0)} Ω`, (v) => { gen.R = v; customized(); });
document.querySelectorAll("[data-collector-value]").forEach((b) => b.addEventListener("click", () => { gen.comm = b.dataset.collectorValue === "comm"; syncAll(); customized(); }));

const sEc = bindRange($("#sE"), $("#sEOut"), (v) => `${fmt(v, 1)} V`, (v) => { self.E = v; customized(); });
const sLc = bindRange($("#sL"), $("#sLOut"), (v) => `${fmt(v, 1)} H`, (v) => { self.L = v; customized(); });
const sRc = bindRange($("#sR"), $("#sROut"), (v) => `${fmt(v, 0)} Ω`, (v) => { self.R = v; customized(); });
$("[data-core]").addEventListener("change", (e) => { self.core = e.target.checked; customized(); });
function toggleSwitch() {
  self.closed = !self.closed;
  if (!self.closed && Math.abs(self.st.i2) > 1e-3) self.spark = 1;
  $("[data-switch]").textContent = self.closed ? "Kalitni uzish" : "Kalitni ulash";
  if (!loop.running) loop.start();
}
$("[data-switch]").addEventListener("click", toggleSwitch);

// Faradey: qo'lda sudrash
stage.canvas.addEventListener("pointerdown", (ev) => {
  if (ui.mode === "self") { toggleSwitch(); return; }
  if (ui.mode !== "faraday") return;
  if (fd.motion !== "hand") setMotion("hand");
  const r = stage.canvas.getBoundingClientRect();
  fd.drag = { px: ev.clientX - r.left, t: performance.now(), x0: fd.x, start: ev.clientX - r.left };
  try { stage.canvas.setPointerCapture(ev.pointerId); } catch { /* */ }
});
stage.canvas.addEventListener("pointermove", (ev) => {
  if (!fd.drag) { stage.canvas.style.cursor = ui.mode === "faraday" || ui.mode === "self" ? "pointer" : ""; return; }
  const r = stage.canvas.getBoundingClientRect(), px = ev.clientX - r.left, now = performance.now();
  const nx = clamp(fd.drag.x0 + (px - fd.drag.start) / fview.s, -0.145, 0.145);
  const dt = Math.max(0.008, (now - fd.drag.t) / 1000);
  const vInst = (nx - fd.x) / dt; // haqiqiy (real vaqt) tezlik
  fd.vel = fd.vel * 0.5 + vInst * 0.5; fd.x = nx; fd.drag.t = now;
});
const endDrag = () => { fd.drag = null; };
stage.canvas.addEventListener("pointerup", endDrag);
stage.canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  faraday: { mode: "faraday", title: "Faradey tajribasi", lesson: "Magnit g‘altak ichidan o‘tib, qaytib chiqadi. Galvanometr mili kirishda bir tomonga, chiqishda boshqa tomonga og‘adi. Magnit g‘altak markazida bir lahza to‘xtaganda tok nolga teng.", set: () => { Object.assign(fd, { motion: "pass", v: 1, m: 1, N: 200, R: 10, flip: false, x: -0.13, dir: 1, hist: [], t: 0 }); setMotion("pass"); } },
  hand: { mode: "faraday", title: "Magnitni qo‘lda suring", lesson: "Magnitni sichqoncha yoki barmoq bilan g‘altakka kiriting va chiqaring. Tezroq harakatlantirsangiz, galvanometr ko‘proq og‘adi; magnit to‘xtasa — tok yo‘q.", set: () => { Object.assign(fd, { v: 1, m: 1, N: 200, R: 10, flip: false, x: -0.15, hist: [], t: 0 }); setMotion("hand"); } },
  turns: { mode: "faraday", title: "O‘ramlar soni va tezlik", lesson: "O‘ramlar sonini 200 dan 800 ga oshiring — EYuK 4 marta ortadi. Tezlikni ikki marta oshirsangiz ham EYuK ikki marta ortadi.", set: () => { Object.assign(fd, { v: 2, m: 1, N: 800, R: 20, flip: false, x: -0.13, dir: 1, hist: [], t: 0 }); setMotion("osc"); } },
  generatorAC: { mode: "gen", title: "O‘zgaruvchan tok generatori", lesson: "Ramka kontakt halqalar orqali yuklamaga ulangan. EYuK sinusoida bo‘yicha o‘zgaradi, lampa har yarim davrda yonib-o‘chadi (tez aylanganda bilinmaydi).", set: () => Object.assign(gen, { n: 2, B: 0.2, N: 100, S: 50, R: 20, comm: false, t: 0, hist: [] }) },
  generatorDC: { mode: "gen", title: "O‘zgarmas tok generatori (kollektor)", lesson: "Kollektor ramka uchlarini har yarim aylanishda almashtiradi — tashqi zanjirdagi tok yo‘nalishi o‘zgarmaydi, lekin kattaligi pulsatsiyalanadi.", set: () => Object.assign(gen, { n: 2, B: 0.2, N: 100, S: 50, R: 20, comm: true, t: 0, hist: [] }) },
  selfOn: { mode: "self", title: "O‘zinduksiya: lampalar tajribasi", lesson: "«Kalitni ulash» ni bosing (yoki sxemani bosing): L₁ darhol yonadi, L₂ kechikib yonadi. Keyin kalitni uzing — L₁ bir lahza chaqnaydi.", set: () => { Object.assign(self, { E: 6, L: 3, R: 20, core: true, closed: false, st: { i2: 0 }, out: { i1: 0, i2: 0, eSelf: 0, tau: 0.25 }, t: 0, hist: [] }); } },
  selfCore: { mode: "self", title: "Temir o‘zakning roli", lesson: "O‘zaksiz g‘altakning induktivligi ancha kichik — lampa deyarli kechikmay yonadi. O‘zakni yoqib-o‘chirib, kalitni ulang va solishtiring.", set: () => { Object.assign(self, { E: 6, L: 3, R: 20, core: false, closed: false, st: { i2: 0 }, out: { i1: 0, i2: 0, eSelf: 0, tau: 0.25 }, t: 0, hist: [] }); } },
};
const GROUPS = [["Elektromagnit induksiya", ["faraday", "hand", "turns"]], ["Generator", ["generatorAC", "generatorDC"]], ["O‘zinduksiya", ["selfOn", "selfCore"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  fVc.set(fd.v); fMc.set(fd.m); fNc.set(fd.N); fRc.set(fd.R);
  gNc.set(gen.n); gBc.set(gen.B); gWc.set(gen.N); gSc.set(gen.S); gRc.set(gen.R);
  document.querySelectorAll("[data-collector-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.collectorValue === "comm") === gen.comm)));
  sEc.set(self.E); sLc.set(self.L); sRc.set(self.R); $("[data-core]").checked = self.core;
  $("[data-switch]").textContent = self.closed ? "Kalitni uzish" : "Kalitni ulash";
}
const MODE_HINT = { faraday: "Magnit g‘altak ichidan o‘tadi — galvanometrni kuzating", gen: "Magnit maydonda aylanayotgan ramka — generator", self: "Kalitni ulang va uzing — lampalarni kuzating" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== m; });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs(); setTab(TABS[m][0][0]);
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ faraday: "faraday", gen: "generatorAC", self: "selfOn" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  setMode(p.mode); p.set();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh(); stage.render(); graph.render();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.slow = Number(b.dataset.speedValue);
  document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));
const playBtn = $("[data-play]");
function syncPlay(running) { playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : "Davom ettirish"; }
let uiTimer = 0;
const loop = createLoop((dt) => {
  stepSim(dt);
  uiTimer += dt;
  if (uiTimer > 0.1) { uiTimer = 0; refresh(); graph.render(); }
  stage.render();
}, { onStateChange: syncPlay });
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));
$("[data-reset]").addEventListener("click", () => { if (presetId) loadPreset(presetId); else { fd.hist = []; gen.hist = []; self.hist = []; } });

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "faraday");
if (!prefersReducedMotion()) loop.start(); else { syncPlay(false); stage.render(); }
void sci;
