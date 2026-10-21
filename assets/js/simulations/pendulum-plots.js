// ==========================================================================
// Mayatnik simulyatsiyalari uchun umumiy grafiklar: θ(t), faza portreti (θ, ω), energiya E(t).
// Matematik va fizik mayatnik sahifalari bir xil grafiklardan foydalanadi.
// ==========================================================================

import { TAU, wrapAngle, niceStep } from "./pendulum-physics.js";
import { fmt, sci, tag, clamp } from "./sim-kit.js";

const FONT = "500 11px Inter, system-ui, sans-serif";

/**
 * Maydon va grafik balandliklari: ikkalasi bir ekranga sig'sin (oyna balandligiga qarab).
 * Sarlavha, asboblar paneli va grafik sarlavhasi uchun joy hisobga olingan.
 */
export function splitHeights(w) {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  const total = clamp(vh - 180 - 56 - 76 - 24, 360, 760);
  return { stage: Math.round(clamp(total * 0.58, w < 560 ? 280 : 230, 470)), graph: Math.round(clamp(total * 0.42, 160, 300)) };
}

/* ------------------------------------------------------------------ Tarix (grafik uchun namunalar) */

export function createHistory(maxPoints = 3000) {
  const h = {
    t: [], th: [], w: [], kin: [], pot: [], lin: [],
    push(t, th, w, kin, pot, lin = null) {
      h.t.push(t); h.th.push(th); h.w.push(w); h.kin.push(kin); h.pot.push(pot); h.lin.push(lin);
      if (h.t.length > maxPoints) {
        const cut = h.t.length - maxPoints + 256;
        for (const k of ["t", "th", "w", "kin", "pot", "lin"]) h[k].splice(0, cut);
      }
    },
    clear() { for (const k of ["t", "th", "w", "kin", "pot", "lin"]) h[k].length = 0; },
    get length() { return h.t.length; },
    /** t >= tFrom bo'lgan birinchi indeks */
    firstFrom(tFrom) {
      let lo = 0, hi = h.t.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (h.t[mid] < tFrom) lo = mid + 1; else hi = mid; }
      return lo;
    },
  };
  return h;
}

/* ------------------------------------------------------------------ Umumiy ramka */

export function ticks(min, max, target = 4) {
  const step = niceStep(max - min, target);
  const out = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { step, values: out };
}

/**
 * Ramka: fon, to'r, o'qlar, belgilar. Qaytaradi X(x), Y(y) va chizma to'rtburchagi.
 * o: { xMin, xMax, yMin, yMax, xTicks[], yTicks[], fmtX, fmtY, yLabel, xUnit, padL }
 */
export function frame(ctx, stage, o) {
  const { w, h, colors: c } = stage;
  const padL = o.padL ?? (w < 480 ? 50 : 58), padR = 16, padT = 20, padB = 32;
  const pw = w - padL - padR, ph = h - padT - padB;
  const X = (x) => padL + ((x - o.xMin) / (o.xMax - o.xMin)) * pw;
  const Y = (y) => padT + ph - ((y - o.yMin) / (o.yMax - o.yMin)) * ph;

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.font = FONT;
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.grid;
  ctx.beginPath();
  o.xTicks.forEach((x) => { ctx.moveTo(Math.round(X(x)) + 0.5, padT); ctx.lineTo(Math.round(X(x)) + 0.5, padT + ph); });
  o.yTicks.forEach((y) => { ctx.moveTo(padL, Math.round(Y(y)) + 0.5); ctx.lineTo(padL + pw, Math.round(Y(y)) + 0.5); });
  ctx.stroke();

  // Nol chiziqlari (agar ko'rinsa) qalinroq
  ctx.strokeStyle = c.borderStrong;
  ctx.beginPath();
  if (o.yMin < 0 && o.yMax > 0) { ctx.moveTo(padL, Math.round(Y(0)) + 0.5); ctx.lineTo(padL + pw, Math.round(Y(0)) + 0.5); }
  if (o.xMin < 0 && o.xMax > 0) { ctx.moveTo(Math.round(X(0)) + 0.5, padT); ctx.lineTo(Math.round(X(0)) + 0.5, padT + ph); }
  ctx.stroke();

  ctx.fillStyle = c.text3;
  ctx.textBaseline = "top";
  const lastIdx = o.xTicks.length - 1;
  o.xTicks.forEach((x, i) => {
    const last = i === lastIdx && o.xUnit;
    ctx.textAlign = last ? "right" : "center";
    ctx.fillText(o.fmtX(x) + (last ? ` ${o.xUnit}` : ""), X(x) + (last ? 6 : 0), padT + ph + 9);
  });
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  o.yTicks.forEach((y) => ctx.fillText(o.fmtY(y), padL - 8, Y(y)));
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  if (o.yLabel) ctx.fillText(o.yLabel, padL, 3);

  ctx.strokeStyle = c.borderStrong;
  ctx.strokeRect(padL + 0.5, padT + 0.5, pw, ph);
  ctx.restore();
  return { X, Y, rect: { x: padL, y: padT, w: pw, h: ph }, padL, padT, pw, ph };
}

function clipTo(ctx, r) {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

export function legend(ctx, items, x, y, c) {
  ctx.save();
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  let cx = x;
  for (const it of items) {
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(it.dash || []);
    ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + 16, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.text2;
    ctx.textAlign = "left";
    ctx.fillText(it.label, cx + 21, y + 0.5);
    cx += 21 + ctx.measureText(it.label).width + 14;
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ θ(t) */

export function createTimePlot() {
  return {
    /** o: { win (s), tNow, showLin } */
    draw(ctx, stage, hist, o) {
      const c = stage.colors;
      const xMin = o.tNow > o.win ? o.tNow - o.win : 0, xMax = xMin + o.win;
      const i0 = hist.firstFrom(xMin);
      let amp = 0;
      for (let i = i0; i < hist.length; i++) amp = Math.max(amp, Math.abs(wrapAngle(hist.th[i])));
      const maxDeg = Math.min(180, Math.max(10, Math.ceil(((amp * 180) / Math.PI) * 1.15 / 5) * 5));
      const yt = ticks(-maxDeg, maxDeg, stage.h < 260 ? 3 : 4);
      const xt = ticks(xMin, xMax, stage.w < 480 ? 3 : 5);
      const f = frame(ctx, stage, {
        xMin, xMax, yMin: -maxDeg, yMax: maxDeg, xTicks: xt.values, yTicks: yt.values,
        fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => `${fmt(v, 0)}°`, yLabel: "θ", xUnit: "s",
      });
      const deg = 180 / Math.PI;
      ctx.save();
      clipTo(ctx, f.rect);
      const line = (arr, color, width, dash) => {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineJoin = "round";
        ctx.beginPath();
        let prev = null;
        for (let i = i0; i < hist.length; i++) {
          const v = arr[i];
          if (v === null) { prev = null; continue; }
          const wv = wrapAngle(v);
          const px = f.X(hist.t[i]), py = f.Y(wv * deg);
          if (prev === null || Math.abs(wv - prev) > Math.PI) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          prev = wv;
        }
        ctx.stroke();
      };
      if (o.showLin) line(hist.lin, c.text3, 2, [6, 5]);
      line(hist.th, c.primary, 2.75);
      ctx.restore();
      // Joriy nuqta
      const n = hist.length;
      if (n) {
        const cx = f.X(hist.t[n - 1]), cy = f.Y(wrapAngle(hist.th[n - 1]) * deg);
        // Hozirgi vaqt: tik chiziq (maydondagi holat bilan parallel kuzatish uchun)
        ctx.save();
        ctx.strokeStyle = c.warning; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.25; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, f.rect.y); ctx.lineTo(cx, f.rect.y + f.rect.h); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = c.warning;
        ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, TAU); ctx.fill();
        const right = cx > f.rect.x + f.rect.w - 70;
        tag(ctx, `θ = ${fmt(wrapAngle(hist.th[n - 1]) * deg, 0)}°`, cx + (right ? -10 : 10), clamp(cy - 18, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: right ? "right" : "left", font: "600 11px Inter, system-ui, sans-serif" });
      }
      const items = [{ color: c.primary, label: o.mainLabel ?? "Haqiqiy (sin θ)" }];
      if (o.showLin) items.push({ color: c.text3, label: o.linLabel ?? "Chiziqli (sin θ ≈ θ)", dash: [5, 4] });
      legend(ctx, items, f.padL + 10, f.padT + 14, c);
    },
  };
}

/* ------------------------------------------------------------------ Faza portreti */

export function createPhasePlot() {
  let yMax = 2.5;
  let last = null; // { f, w0 }
  return {
    reset() { yMax = 2.5; },
    /** o: { w0 (rad/s), separatrix (bool), trail (nuqtalar soni) } */
    draw(ctx, stage, hist, o) {
      const c = stage.colors;
      const n = hist.length;
      const trailN = Math.min(n, o.trail ?? 700);
      for (let i = n - trailN; i < n; i++) yMax = Math.max(yMax, (Math.abs(hist.w[i]) / o.w0) * 1.12);
      yMax = Math.min(Math.ceil(yMax * 2) / 2, 60);
      const xt = { values: [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI] };
      const yt = ticks(-yMax, yMax, stage.h < 260 ? 3 : 4);
      const f = frame(ctx, stage, {
        xMin: -Math.PI, xMax: Math.PI, yMin: -yMax, yMax, xTicks: xt.values, yTicks: yt.values,
        fmtX: (v) => `${fmt((v * 180) / Math.PI, 0)}°`, fmtY: (v) => fmt(v, v % 1 ? 1 : 0), yLabel: "ω / ω₀",
        padL: stage.w < 480 ? 44 : 54,
      });
      last = { f, w0: o.w0, yMax };
      ctx.save();
      clipTo(ctx, f.rect);
      if (o.separatrix) {
        ctx.strokeStyle = c.text3; ctx.lineWidth = 1.75; ctx.setLineDash([6, 5]);
        for (const sgn of [1, -1]) {
          ctx.beginPath();
          for (let k = 0; k <= 120; k++) {
            const th = -Math.PI + (TAU * k) / 120;
            const y = sgn * 2 * Math.cos(th / 2);
            if (k === 0) ctx.moveTo(f.X(th), f.Y(y)); else ctx.lineTo(f.X(th), f.Y(y));
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      // Iz (so'nuvchi)
      const chunks = 8;
      const per = Math.max(1, Math.floor(trailN / chunks));
      for (let ch = 0; ch < chunks; ch++) {
        const a = n - trailN + ch * per, b = ch === chunks - 1 ? n : a + per + 1;
        ctx.strokeStyle = c.primary;
        ctx.globalAlpha = 0.18 + 0.82 * ((ch + 1) / chunks);
        ctx.lineWidth = 2.5; ctx.lineJoin = "round";
        ctx.beginPath();
        let prev = null;
        for (let i = Math.max(a, 0); i < b && i < n; i++) {
          const wv = wrapAngle(hist.th[i]);
          const px = f.X(wv), py = f.Y(hist.w[i] / o.w0);
          if (prev === null || Math.abs(wv - prev) > Math.PI) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          prev = wv;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (n) {
        ctx.fillStyle = c.warning;
        ctx.beginPath(); ctx.arc(f.X(wrapAngle(hist.th[n - 1])), f.Y(hist.w[n - 1] / o.w0), 5, 0, TAU); ctx.fill();
      }
      if (o.separatrix && stage.w >= 420) {
        ctx.save();
        ctx.font = "600 11px Inter, system-ui, sans-serif";
        ctx.fillStyle = c.text3;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (yMax >= 3) { ctx.fillText("aylanish", f.X(0), f.Y(yMax * 0.82)); ctx.fillText("aylanish", f.X(0), f.Y(-yMax * 0.82)); }
        ctx.restore();
      }
    },
    /** Piksel (canvas CSS koordinatasi) → {th, w}; chizma tashqarisida null */
    toState(px, py) {
      if (!last) return null;
      const { f, w0, yMax: ym } = last;
      const r = f.rect;
      if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) return null;
      const th = -Math.PI + ((px - r.x) / r.w) * TAU;
      const y = ym - ((py - r.y) / r.h) * 2 * ym;
      return { th, w: y * w0 };
    },
  };
}

/* ------------------------------------------------------------------ E(t) */

export function createEnergyPlot() {
  return {
    /** o: { win, tNow, scale (J / birlik), ref (J) } */
    draw(ctx, stage, hist, o) {
      const c = stage.colors;
      const xMin = o.tNow > o.win ? o.tNow - o.win : 0, xMax = xMin + o.win;
      const i0 = hist.firstFrom(xMin);
      let top = o.ref * 0.5;
      for (let i = i0; i < hist.length; i++) top = Math.max(top, (hist.kin[i] + hist.pot[i]) * o.scale);
      const yt = ticks(0, top * 1.18, stage.h < 260 ? 3 : 4);
      const yMax = yt.values[yt.values.length - 1] + yt.step * 0.35;
      const xt = ticks(xMin, xMax, stage.w < 480 ? 3 : 5);
      const f = frame(ctx, stage, {
        xMin, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values,
        fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => sci(v, 2), yLabel: "E, J", xUnit: "s", padL: stage.w < 480 ? 54 : 62,
      });
      ctx.save();
      clipTo(ctx, f.rect);
      const line = (get, color, width) => {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = i0; i < hist.length; i++) {
          const px = f.X(hist.t[i]), py = f.Y(get(i) * o.scale);
          if (i === i0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };
      line((i) => hist.pot[i], c.warning, 2.25);
      line((i) => hist.kin[i], c.success, 2.25);
      line((i) => hist.kin[i] + hist.pot[i], c.primary, 2.75);
      ctx.restore();
      legend(ctx, [
        { color: c.success, label: "Kinetik" },
        { color: c.warning, label: "Potensial" },
        { color: c.primary, label: "To‘liq" },
      ], f.padL + 10, f.padT + 14, c);
    },
  };
}
