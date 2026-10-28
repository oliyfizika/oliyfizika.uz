// ==========================================================================
// Maktab laboratoriya asboblari — canvas chizmalari (lab-*.html sahifalari uchun umumiy):
// strelkali o‘lchov asbobi (ampermetr, voltmetr), chizg‘ich, termometr, dinamometr, menzurka, sekundomer,
// zanjir elementlari (batareya, kalit, reostat, rezistor, lampa, simlar va klemmalar).
// Hammasi tema ranglari (c = readColors()) bilan; asbob shkalasi doim oq/och (haqiqiy asbobdek).
// ==========================================================================

import { clamp, fmt } from "./sim-kit.js";

export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const F = (s, w = 600) => `${w} ${s}px Inter, system-ui, sans-serif`;
const DIAL = "#fbfaf5", INK = "#1f2937";

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
export function dot(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
export function label(ctx, text, x, y, col, font = F(11), align = "center", base = "middle") { ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(text, x, y); }
const nice = (v) => fmt(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);

/**
 * Strelkali asbob (ampermetr / voltmetr / galvanometr). o = {sym: "A"|"V"|"mA", max, value, major, minor, cls, title}
 * major — raqamli bo‘linmalar soni, minor — har biridagi kichik bo‘linmalar. Qaytaradi {x, y, w, h}.
 */
export function meter(ctx, c, x, y, w, h, o) {
  // korpus va shkala oynasi; o‘q (strelka aylanish markazi) shkaladan pastda — korpus ichida yashirin
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; rr(ctx, x, y, w, h, 10); ctx.fill();
  const dx = x + 6, dy = y + 6, dw = w - 12, dh = h * 0.7;
  ctx.fillStyle = DIAL; rr(ctx, dx, dy, dw, dh, 6); ctx.fill();
  const R = Math.min(dh * 0.98, dw * 0.56), cx = x + w / 2, cy = dy + dh + R * 0.22, a0 = -150 * DEG, a1 = -30 * DEG;
  ctx.save(); rr(ctx, dx, dy, dw, dh, 6); ctx.clip();
  const n = o.major * o.minor;
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, a0, a1); ctx.stroke();
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, big = i % o.minor === 0, mid = !big && o.minor % 2 === 0 && i % (o.minor / 2) === 0, L = big ? 10 : mid ? 7 : 4.5, r0 = R * 0.86;
    ctx.lineWidth = big ? 1.4 : 0.8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + L), cy + Math.sin(a) * (r0 + L)); ctx.stroke();
    if (big) label(ctx, nice((o.max * i) / n), cx + Math.cos(a) * (r0 - 11), cy + Math.sin(a) * (r0 - 11), INK, F(w < 170 ? 9 : 10, 700));
  }
  // ko‘zgu chizig‘i
  ctx.strokeStyle = "rgba(100,116,139,0.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * 0.86 + 13, a0 + 0.02, a1 - 0.02); ctx.stroke();
  label(ctx, o.sym, dx + 10, dy + 16, INK, `700 ${Math.round(Math.min(24, dh * 0.22))}px "Times New Roman", serif`, "left");
  if (o.cls) { ctx.strokeStyle = "#64748b"; ctx.lineWidth = 0.8; label(ctx, o.cls, dx + dw - 16, dy + 14, "#64748b", F(8, 700)); ctx.beginPath(); ctx.arc(dx + dw - 16, dy + 14, 8, 0, TAU); ctx.stroke(); }
  // strelka
  const f = clamp(o.value / o.max, -0.03, 1.04), a = a0 + (a1 - a0) * f;
  ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3); ctx.lineTo(cx + Math.cos(a) * (R * 0.86 + 14), cy + Math.sin(a) * (R * 0.86 + 14)); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = c.dark ? "#0f172a" : "#1e293b"; ctx.fillRect(cx - 18, dy + dh - 3, 36, 3);
  // klemmalar va nom
  const ky = y + h - 12;
  dot(ctx, x + 16, ky, 6, "#111"); dot(ctx, x + w - 16, ky, 6, "#b91c1c");
  label(ctx, "−", x + 28, ky, "#e2e8f0", F(11, 700)); label(ctx, "+", x + w - 28, ky, "#fecaca", F(11, 700));
  if (o.title) label(ctx, o.title, cx, ky, "#cbd5e1", F(9, 700));
  return { x, y, w, h, minus: [x + 16, ky], plus: [x + w - 16, ky] };
}

/** Gorizontal chizg‘ich: x0 dagi 0 belgidan, k px/unit, len birlik. o = {unit, step (raqam qadami), sub (kichik bo‘linma), top} */
export function rulerH(ctx, c, x0, y, k, len, o = {}) {
  const h = o.h || 18, sub = o.sub || 1, step = o.step || 10;
  ctx.fillStyle = c.dark ? "#d9c08c" : "#f3dfae"; ctx.fillRect(x0 - (o.pad ?? 6), y, len * k + 2 * (o.pad ?? 6), h);
  ctx.strokeStyle = "#7c5a1e"; ctx.lineWidth = 0.8; ctx.strokeRect(x0 - (o.pad ?? 6), y, len * k + 2 * (o.pad ?? 6), h);
  ctx.strokeStyle = "#3f2d0c"; ctx.fillStyle = "#3f2d0c";
  const minPx = 2.2, every = Math.max(1, Math.ceil(minPx / (k * sub)));
  for (let i = 0; i * sub <= len + 1e-9; i += every) {
    const v = i * sub, xx = x0 + v * k, big = Math.abs(v / step - Math.round(v / step)) < 1e-9, half = Math.abs((2 * v) / step - Math.round((2 * v) / step)) < 1e-9;
    const L = big ? h * 0.55 : half ? h * 0.4 : h * 0.25;
    ctx.lineWidth = big ? 1 : 0.6; ctx.beginPath(); ctx.moveTo(xx + 0.5, o.top ? y + h : y); ctx.lineTo(xx + 0.5, o.top ? y + h - L : y + L); ctx.stroke();
    if (big && (o.labelEvery ? Math.round(v / step) % o.labelEvery === 0 : true)) label(ctx, nice(v * (o.scale || 1)), xx, o.top ? y + 5 : y + h - 5, "#3f2d0c", F(8.5, 700));
  }
  if (o.unit) label(ctx, o.unit, x0 + len * k + (o.pad ?? 6) - 2, o.top ? y + 5 : y + h - 5, "#7c5a1e", F(8, 700), "right");
}
/** Vertikal chizg‘ich (0 pastda yoki tepada). o.down — qiymat pastga qarab o‘sadi. */
export function rulerV(ctx, c, x, y0, k, len, o = {}) {
  const w = o.w || 18, sub = o.sub || 1, step = o.step || 10, dir = o.down ? 1 : -1;
  const ya = y0, yb = y0 + dir * len * k;
  ctx.fillStyle = c.dark ? "#d9c08c" : "#f3dfae"; ctx.fillRect(x, Math.min(ya, yb) - 6, w, Math.abs(yb - ya) + 12);
  ctx.strokeStyle = "#7c5a1e"; ctx.lineWidth = 0.8; ctx.strokeRect(x, Math.min(ya, yb) - 6, w, Math.abs(yb - ya) + 12);
  ctx.strokeStyle = "#3f2d0c";
  const every = Math.max(1, Math.ceil(2.2 / (k * sub)));
  for (let i = 0; i * sub <= len + 1e-9; i += every) {
    const v = i * sub, yy = y0 + dir * v * k, big = Math.abs(v / step - Math.round(v / step)) < 1e-9, half = Math.abs((2 * v) / step - Math.round((2 * v) / step)) < 1e-9;
    const L = big ? w * 0.5 : half ? w * 0.36 : w * 0.22;
    ctx.lineWidth = big ? 1 : 0.6; ctx.beginPath(); ctx.moveTo(x, yy + 0.5); ctx.lineTo(x + L, yy + 0.5); ctx.stroke();
    if (big) label(ctx, nice(v * (o.scale || 1)), x + w - 3, yy, "#3f2d0c", F(8, 700), "right");
  }
}

/** Suyuqlikli termometr. o = {min, max, t, major (raqam qadami), minor (bo‘linma qiymati), col} Qaytaradi bulb koordinatasi. */
export function thermometer(ctx, c, x, y, h, o) {
  const w = 16, bulbR = 8, top = y, bot = y + h - bulbR * 2, k = (bot - 6 - (top + 8)) / (o.max - o.min);
  const Y = (t) => bot - 6 - (t - o.min) * k;
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.9)" : "#f8fafc"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#94a3b8"; ctx.lineWidth = 1;
  rr(ctx, x - w / 2 - 10, top - 4, w + 34, h + 4 - bulbR, 6); ctx.fill(); ctx.stroke();
  // kapillyar
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(x - 2, top + 4, 4, bot - top);
  const col = o.col || "#dc2626";
  ctx.fillStyle = col; ctx.fillRect(x - 2, Y(clamp(o.t, o.min - 0.5, o.max + 0.5)), 4, bot - Y(clamp(o.t, o.min - 0.5, o.max + 0.5)) + 2);
  dot(ctx, x, bot + bulbR - 2, bulbR, col);
  ctx.strokeStyle = INK; ctx.fillStyle = INK;
  for (let t = Math.ceil(o.min / o.minor) * o.minor; t <= o.max + 1e-9; t += o.minor) {
    const big = Math.abs(t / o.major - Math.round(t / o.major)) < 1e-6, half = Math.abs((2 * t) / o.major - Math.round((2 * t) / o.major)) < 1e-6, yy = Y(t);
    ctx.lineWidth = big ? 1 : 0.6; ctx.beginPath(); ctx.moveTo(x + 4, yy + 0.5); ctx.lineTo(x + 4 + (big ? 8 : half ? 6 : 3.5), yy + 0.5); ctx.stroke();
    if (big) label(ctx, String(Math.round(t)), x + 22, yy, INK, F(8.5, 700), "center");
  }
  label(ctx, "°C", x + 22, top + 2, "#64748b", F(8, 700));
  return { bulb: [x, bot + bulbR - 2], Y };
}

/** Prujinali dinamometr (vertikal). Ilgak (x, yHook) da, yuqoriga tortiladi. o = {max, F, div} */
export function dynamometer(ctx, c, x, y, h, o) {
  const w = 30;
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#e2e8f0"; ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1; rr(ctx, x - w / 2, y, w, h, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = DIAL; ctx.fillRect(x - w / 2 + 4, y + 10, 12, h - 20);
  const k = (h - 30) / o.max, y0 = y + 14;
  ctx.strokeStyle = INK; for (let v = 0; v <= o.max + 1e-9; v += o.div) {
    const big = Math.abs(v - Math.round(v)) < 1e-9, yy = y0 + v * k; ctx.lineWidth = big ? 1 : 0.6; ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, yy + 0.5); ctx.lineTo(x - w / 2 + (big ? 13 : 9), yy + 0.5); ctx.stroke();
    if (big) label(ctx, String(Math.round(v)), x + 8, yy, INK, F(8.5, 700));
  }
  const yp = y0 + clamp(o.F, 0, o.max * 1.02) * k;
  ctx.fillStyle = "#dc2626"; ctx.fillRect(x - w / 2 + 3, yp - 1.5, 15, 3);
  // prujina ko‘rinadi (cho‘ziladi)
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 16; i++) { const yy = y0 - 4 + ((yp - y0 + 4) * i) / 16; ctx.lineTo(x + 9 + (i % 2 ? 3 : -3), yy); } ctx.stroke();
  label(ctx, "N", x + 8, y + h - 6, "#475569", F(8, 700));
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + 10); ctx.arc(x + 4, y + h + 10, 4, Math.PI, 0.3 * Math.PI, true); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 8); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - 12, 4, 0, TAU); ctx.stroke();
  return { hook: [x, y + h + 14], ring: [x, y - 12] };
}

/** Menzurka (o‘lchov silindri). o = {max (ml), div (ml), V (suyuqlik hajmi, ml), col, k (px/ml)} Qaytaradi {Y, inner}. */
export function cylinder(ctx, c, x, yBottom, w, o) {
  const k = o.k, top = yBottom - o.max * k - 18;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.12)" : "rgba(226,232,240,0.6)"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, yBottom); ctx.lineTo(x + w, yBottom); ctx.lineTo(x + w, top); ctx.stroke();
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.fillRect(x - 8, yBottom, w + 16, 6);
  const Y = (v) => yBottom - v * k;
  const lv = Y(o.V);
  ctx.fillStyle = o.col || "rgba(59,130,246,0.28)"; ctx.fillRect(x + 1, lv, w - 2, yBottom - lv);
  // menisk
  ctx.strokeStyle = "rgba(37,99,235,0.85)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 1, lv - 3); ctx.quadraticCurveTo(x + w / 2, lv + 2.5, x + w - 1, lv - 3); ctx.stroke();
  ctx.strokeStyle = c.dark ? "#e2e8f0" : INK; ctx.fillStyle = c.dark ? "#e2e8f0" : INK;
  for (let v = 0; v <= o.max + 1e-9; v += o.div) {
    const big = Math.abs(v / (o.div * 10) - Math.round(v / (o.div * 10))) < 1e-9, half = Math.abs(v / (o.div * 5) - Math.round(v / (o.div * 5))) < 1e-9, yy = Y(v);
    ctx.lineWidth = big ? 1 : 0.6; ctx.beginPath(); ctx.moveTo(x, yy + 0.5); ctx.lineTo(x + (big ? 12 : half ? 8 : 5), yy + 0.5); ctx.stroke();
    if (big && v > 0) label(ctx, String(Math.round(v)), x + w + 4, yy, c.dark ? "#e2e8f0" : INK, F(8.5, 700), "left");
  }
  label(ctx, "ml", x + w + 4, top + 4, c.text3, F(8, 700), "left");
  return { Y, top, lv };
}

/** Elektron tarozi: tarelka (x..x+w, y), displey. Qaytaradi tarelka yuzasi y. */
export function eScale(ctx, c, x, y, w, value, unit = "g") {
  ctx.fillStyle = c.dark ? "#475569" : "#cbd5e1"; rr(ctx, x, y + 8, w, 40, 8); ctx.fill(); ctx.strokeStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = c.dark ? "#94a3b8" : "#e2e8f0"; rr(ctx, x + 6, y, w - 12, 9, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#0b1220"; rr(ctx, x + w / 2 - 44, y + 18, 88, 22, 4); ctx.fill();
  label(ctx, value, x + w / 2 + 22, y + 29, "#4ade80", `700 14px "SFMono-Regular", Menlo, Consolas, monospace`, "right");
  label(ctx, unit, x + w / 2 + 38, y + 30, "#cbd5e1", F(10, 700), "right");
  return y;
}
/** Raqamli sekundomer. */
export function stopwatch(ctx, c, x, y, w, t, running) {
  const h = 44;
  ctx.fillStyle = c.dark ? "#475569" : "#334155"; rr(ctx, x, y, w, h + 16, 12); ctx.fill();
  ctx.fillStyle = "#c7d2bf"; rr(ctx, x + 7, y + 8, w - 14, h - 6, 5); ctx.fill();
  const s = Math.max(0, t), mm = Math.floor(s / 60), ss = s - mm * 60;
  label(ctx, `${String(mm).padStart(2, "0")}:${ss.toFixed(2).padStart(5, "0").replace(".", ",")}`, x + w / 2, y + 8 + (h - 6) / 2 + 1, "#1f2a1a", `700 ${Math.round(w * 0.16)}px "SFMono-Regular", Menlo, Consolas, monospace`);
  label(ctx, running ? "● SEKUNDOMER" : "SEKUNDOMER", x + w / 2, y + h + 8, running ? "#fca5a5" : "#cbd5e1", F(8, 700));
}

/* ------------------------------------------------------------------ Zanjir elementlari (montaj ko‘rinishi) */

/** Sim: nuqtalar orqali, yumaloq burchaklar. */
export function wire(ctx, pts, col = "#b45309", w = 2.4) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
}
export function terminal(ctx, x, y, col = "#334155") { dot(ctx, x, y, 4.5, col); dot(ctx, x, y, 2, "#cbd5e1"); }

/** Batareya (galvanik elementlar bloki). Qaytaradi {minus, plus}. */
export function battery(ctx, c, x, y, w, h, text) {
  ctx.fillStyle = "#1e3a8a"; rr(ctx, x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = "#fbbf24"; ctx.fillRect(x + w * 0.62, y, w * 0.38, h);
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; rr(ctx, x, y, w, h, 6); ctx.stroke();
  label(ctx, text, x + w * 0.31, y + h / 2, "#fff", F(10, 700));
  const m = [x + 10, y - 5], p = [x + w - 10, y - 5];
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(m[0] - 3, y - 5, 6, 5); ctx.fillRect(p[0] - 3, y - 5, 6, 5);
  label(ctx, "−", m[0], y + h / 2, "#fff", F(12, 700)); label(ctx, "+", p[0], y + h / 2, "#1e3a8a", F(12, 700));
  terminal(ctx, m[0], m[1]); terminal(ctx, p[0], p[1], "#b91c1c");
  return { minus: m, plus: p };
}
/** Kalit (rubilnik). on — ulangan. Qaytaradi {a, b, box}. */
export function keySwitch(ctx, c, x, y, w, on) {
  ctx.fillStyle = c.dark ? "#78350f" : "#a16207"; rr(ctx, x - 6, y - 8, w + 12, 16, 4); ctx.fill();
  const a = [x, y], b = [x + w, y];
  terminal(ctx, a[0], a[1]); terminal(ctx, b[0], b[1]);
  const ang = on ? 0 : -32 * DEG;
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + Math.cos(ang) * w, a[1] + Math.sin(ang) * w); ctx.stroke();
  dot(ctx, a[0] + Math.cos(ang) * (w + 4), a[1] + Math.sin(ang) * (w + 4), 4, "#111");
  label(ctx, on ? "K (ulangan)" : "K (uzilgan)", x + w / 2, y + 16, c.text3, F(9, 700));
  return { a, b, box: { x0: x - 8, x1: x + w + 10, y0: y - 28, y1: y + 12 } };
}
/** Reostat (sirpang‘ichli). f — sirpang‘ich o‘rni 0…1 (chapdan). Qaytaradi {a, b, slider, x0, x1, y}. */
export function rheostat(ctx, c, x, y, w, f, name = "Reostat") {
  const h = 26;
  ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.fillRect(x - 8, y + h / 2 - 2, 8, 6); ctx.fillRect(x + w, y + h / 2 - 2, 8, 6);
  ctx.fillStyle = "#e7e5e4"; rr(ctx, x, y, w, h, 13); ctx.fill(); ctx.strokeStyle = "#78716c"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "#a16207"; ctx.lineWidth = 0.8; for (let xx = x + 6; xx < x + w - 6; xx += 3) { ctx.beginPath(); ctx.moveTo(xx, y + 2); ctx.lineTo(xx + 1.5, y + h - 2); ctx.stroke(); }
  // shtanga
  ctx.strokeStyle = "#64748b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 4, y - 12); ctx.lineTo(x + w + 4, y - 12); ctx.stroke();
  const sx = x + 8 + (w - 16) * clamp(f, 0, 1);
  ctx.fillStyle = "#1e293b"; rr(ctx, sx - 9, y - 20, 18, 16, 3); ctx.fill(); ctx.fillStyle = "#64748b"; ctx.fillRect(sx - 2, y - 4, 4, 6);
  const a = [x - 8, y + h / 2 + 1], b = [x + w + 4, y - 12];
  terminal(ctx, a[0], a[1]); terminal(ctx, b[0], b[1]);
  label(ctx, name, x + w / 2, y + h + 11, c.text3, F(9, 700));
  return { a, b, slider: [sx, y - 12], x0: x + 8, x1: x + w - 8, y };
}
/** Rezistor (sim o‘ralgan g‘altak ko‘rinishida, panelda). Qaytaradi {a, b}. */
export function resistor(ctx, c, x, y, w, text, col = "#a16207") {
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; rr(ctx, x - 10, y - 15, w + 20, 30, 5); ctx.fill(); ctx.strokeStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#f5f5f4"; rr(ctx, x + 6, y - 7, w - 12, 14, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1; for (let xx = x + 9; xx < x + w - 8; xx += 2.6) { ctx.beginPath(); ctx.moveTo(xx, y - 6); ctx.lineTo(xx + 1.3, y + 6); ctx.stroke(); }
  const a = [x - 2, y], b = [x + w + 2, y];
  terminal(ctx, a[0], a[1]); terminal(ctx, b[0], b[1]);
  if (text) label(ctx, text, x + w / 2, y + 24, c.text2, F(10, 700));
  return { a, b };
}
/** G‘altak (karkasga o‘ralgan mis sim), gorizontal. Qaytaradi {a, b}. */
export function coil(ctx, c, x, y, w, text) {
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; rr(ctx, x - 10, y - 22, w + 20, 44, 6); ctx.fill(); ctx.strokeStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#57534e"; rr(ctx, x + 4, y - 17, 6, 34, 2); ctx.fill(); rr(ctx, x + w - 10, y - 17, 6, 34, 2); ctx.fill();
  const g = ctx.createLinearGradient(0, y - 13, 0, y + 13); g.addColorStop(0, "#fdba74"); g.addColorStop(0.5, "#c2410c"); g.addColorStop(1, "#7c2d12");
  ctx.fillStyle = g; ctx.fillRect(x + 10, y - 13, w - 20, 26);
  ctx.strokeStyle = "rgba(67,20,7,0.55)"; ctx.lineWidth = 1; for (let xx = x + 12; xx < x + w - 10; xx += 3) { ctx.beginPath(); ctx.moveTo(xx, y - 13); ctx.lineTo(xx + 1.5, y + 13); ctx.stroke(); }
  const a = [x - 2, y], b = [x + w + 2, y];
  terminal(ctx, a[0], a[1]); terminal(ctx, b[0], b[1]);
  if (text) label(ctx, text, x + w / 2, y + 32, c.text2, F(10, 700));
  return { a, b };
}
/** Kondensator (qutichada), gorizontal. Qaytaradi {a, b, box}. */
export function capacitor(ctx, c, x, y, w, text, sub) {
  ctx.fillStyle = c.dark ? "#1e3a8a" : "#dbeafe"; rr(ctx, x - 10, y - 20, w + 20, 40, 6); ctx.fill(); ctx.strokeStyle = c.dark ? "#3b82f6" : "#93c5fd"; ctx.lineWidth = 1; ctx.stroke();
  const cx = x + w / 2; ctx.strokeStyle = c.dark ? "#e2e8f0" : "#1e3a8a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(cx - 4, y); ctx.moveTo(cx + 4, y); ctx.lineTo(x + w - 6, y); ctx.moveTo(cx - 4, y - 11); ctx.lineTo(cx - 4, y + 11); ctx.moveTo(cx + 4, y - 11); ctx.lineTo(cx + 4, y + 11); ctx.stroke();
  const a = [x - 2, y], b = [x + w + 2, y];
  terminal(ctx, a[0], a[1]); terminal(ctx, b[0], b[1]);
  if (text) label(ctx, text, cx, y + 30, c.text2, F(10, 700));
  if (sub) label(ctx, sub, cx, y + 43, c.text3, F(9));
  return { a, b, box: { x0: x - 10, x1: x + w + 10, y0: y - 20, y1: y + 20 } };
}
/** Cho‘g‘lanma lampa patronda. glow 0…1. Qaytaradi {a, b}. */
export function lamp(ctx, c, x, y, s, glow, text) {
  if (glow > 0.02) { const g = ctx.createRadialGradient(x, y - 14 * s, 2, x, y - 14 * s, 50 * s * (0.4 + glow)); g.addColorStop(0, `rgba(253,224,71,${0.75 * glow})`); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 14 * s, 50 * s * (0.4 + glow), 0, TAU); ctx.fill(); }
  ctx.fillStyle = glow > 0.05 ? `rgba(254,249,195,${0.6 + 0.4 * glow})` : c.dark ? "rgba(226,232,240,0.25)" : "rgba(241,245,249,0.9)"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y - 16 * s, 11 * s, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = glow > 0.05 ? `rgb(${Math.round(180 + 75 * glow)},${Math.round(80 + 140 * glow)},20)` : "#78716c"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 6 * s); ctx.lineTo(x - 3 * s, y - 18 * s); for (let i = 0; i <= 6; i++) ctx.lineTo(x - 3 * s + i * s, y - 18 * s + (i % 2 ? -2 : 0) * s); ctx.lineTo(x + 4 * s, y - 6 * s); ctx.stroke();
  ctx.fillStyle = "#a8a29e"; ctx.fillRect(x - 6 * s, y - 6 * s, 12 * s, 7 * s);
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; rr(ctx, x - 16 * s, y + 1 * s, 32 * s, 9 * s, 3); ctx.fill();
  const a = [x - 12 * s, y + 5 * s], b = [x + 12 * s, y + 5 * s]; terminal(ctx, a[0], a[1]); terminal(ctx, b[0], b[1]);
  if (text) label(ctx, text, x, y + 20 * s, c.text2, F(10, 700));
  return { a, b };
}
/** Sahnadagi kichik kirish yorlig‘i (qaysi narsani surish mumkin). */
export function hint(ctx, c, text, x, y, align = "left") {
  ctx.font = F(10); const w = ctx.measureText(text).width + 12, x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.fillStyle = c.dark ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.85)"; rr(ctx, x0, y - 10, w, 20, 6); ctx.fill();
  label(ctx, text, x0 + 6, y, c.text3, F(10), "left");
}
/** Nuqta (x,y) to‘rtburchak ichidami. */
export const inBox = (x, y, b, pad = 0) => b && x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad;
export const near = (x, y, p, r = 16) => p && Math.hypot(x - p[0], y - p[1]) <= r;

/* ------------------------------------------------------------------ Sxema belgilari (GOST uslubida) */

/** Sxemadagi chiziq. */
export function sLine(ctx, c, pts, col) { ctx.strokeStyle = col || c.text; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
/** Rezistor belgisi (to‘rtburchak) gorizontal yoki vertikal, (x1,y1)→(x2,y2) orasida. */
export function sRes(ctx, c, x1, y1, x2, y2, text, hot) {
  const hor = Math.abs(y2 - y1) < 1, L = hor ? Math.abs(x2 - x1) : Math.abs(y2 - y1), bl = Math.min(44, L * 0.6), bw = 14;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  sLine(ctx, c, [[x1, y1], [x2, y2]]);
  ctx.fillStyle = hot ? (c.dark ? "rgba(251,191,36,0.25)" : "#fef3c7") : c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2;
  if (hor) { ctx.fillRect(mx - bl / 2, my - bw / 2, bl, bw); ctx.strokeRect(mx - bl / 2, my - bw / 2, bl, bw); }
  else { ctx.fillRect(mx - bw / 2, my - bl / 2, bw, bl); ctx.strokeRect(mx - bw / 2, my - bl / 2, bw, bl); }
  if (text) label(ctx, text, hor ? mx : mx + 14, hor ? my - 18 : my, c.text, `italic 700 13px "Times New Roman", serif`, hor ? "center" : "left");
  return hor ? { x0: mx - bl / 2 - 6, x1: mx + bl / 2 + 6, y0: my - 20, y1: my + 14 } : { x0: mx - 14, x1: mx + 30, y0: my - bl / 2 - 6, y1: my + bl / 2 + 6 };
}
/** Galvanik element belgisi (gorizontal sim ustida): uzun chiziq «+», qisqa «−». plusLeft — «+» chapda. */
export function sCell(ctx, c, x, y, plusLeft, text) {
  ctx.fillStyle = c.bg; ctx.fillRect(x - 7, y - 16, 14, 32);
  ctx.strokeStyle = c.text; ctx.lineWidth = 2;
  const xl = plusLeft ? x - 4 : x + 4, xs = plusLeft ? x + 4 : x - 4;
  ctx.beginPath(); ctx.moveTo(xl, y - 15); ctx.lineTo(xl, y + 15); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xs, y - 8); ctx.lineTo(xs, y + 8); ctx.stroke();
  label(ctx, "+", xl + (plusLeft ? -9 : 9), y - 14, c.text2, F(11, 700)); label(ctx, "−", xs + (plusLeft ? 9 : -9), y - 14, c.text2, F(11, 700));
  if (text) label(ctx, text, x, y + 26, c.text2, F(11, 700));
}
/** Kalit belgisi. */
export function sKey(ctx, c, x1, x2, y, on) {
  ctx.fillStyle = c.bg; ctx.fillRect(x1 + 1, y - 18, x2 - x1 - 2, 22);
  dot(ctx, x1, y, 3, c.text); dot(ctx, x2, y, 3, c.text);
  const ang = on ? 0 : -28 * DEG; sLine(ctx, c, [[x1, y], [x1 + Math.cos(ang) * (x2 - x1), y + Math.sin(ang) * (x2 - x1)]]);
  label(ctx, "K", (x1 + x2) / 2, y + 14, c.text2, `italic 700 13px "Times New Roman", serif`);
  return { x0: x1 - 6, x1: x2 + 6, y0: y - 26, y1: y + 20 };
}
/** Asbob belgisi (aylana ichida harf) — sxemadagi o‘rni. */
export function sMeter(ctx, c, x, y, letter, col) {
  ctx.fillStyle = c.bg; ctx.strokeStyle = col || c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill(); ctx.stroke();
  label(ctx, letter, x, y + 0.5, col || c.text, `700 13px "Times New Roman", serif`);
}
export const sNode = (ctx, c, x, y) => dot(ctx, x, y, 3.6, c.text);

/* ------------------------------------------------------------------ Raqamli asboblar */

/** Raqamli multimetr (sariq korpus, LCD, rejim yozuvi, klemmalar). Qaytaradi {com, inp}. */
export function multimeter(ctx, c, x, y, w, h, o) {
  ctx.fillStyle = "#f59e0b"; rr(ctx, x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = "#1f2937"; rr(ctx, x + 6, y + 6, w - 12, h - 12, 9); ctx.fill();
  ctx.fillStyle = "#c7d2bf"; rr(ctx, x + 12, y + 12, w - 24, Math.min(46, h * 0.42), 5); ctx.fill();
  const lh = Math.min(46, h * 0.42);
  label(ctx, o.value, x + w - 20 - (o.unit.length > 1 ? 22 : 14), y + 12 + lh / 2 + 2, "#111827", `700 ${Math.round(Math.min(26, lh * 0.62, (w - 46 - (o.unit.length > 1 ? 22 : 14)) / (0.62 * String(o.value).length)))}px "SFMono-Regular", Menlo, Consolas, monospace`, "right");
  label(ctx, o.unit, x + w - 18, y + 12 + lh / 2 + 4, "#374151", F(11, 700), "right");
  if (o.mode) label(ctx, o.mode, x + 16, y + 20, "#374151", F(8, 700), "left");
  label(ctx, o.title, x + w / 2, y + 12 + lh + 14, "#e5e7eb", F(9, 700));
  const ky = y + h - 18, com = [x + w * 0.3, ky], inp = [x + w * 0.7, ky];
  dot(ctx, com[0], com[1], 6, "#111"); dot(ctx, inp[0], inp[1], 6, "#b91c1c");
  label(ctx, "COM", com[0], ky - 13, "#9ca3af", F(7, 700)); label(ctx, o.inLabel || "VΩmA", inp[0], ky - 13, "#9ca3af", F(7, 700));
  return { com, inp };
}
/** Laboratoriya manbai (rostlanadigan): korpus, LCD, aylantiriladigan dastak. Qaytaradi {minus, plus, knob: [x, y, r]}. */
export function supply(ctx, c, x, y, w, h, o) {
  ctx.fillStyle = c.dark ? "#475569" : "#cbd5e1"; rr(ctx, x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#0b1220"; rr(ctx, x + 10, y + 10, w - 20, 34, 5); ctx.fill();
  label(ctx, o.value, x + w - 32, y + 28, "#4ade80", `700 18px "SFMono-Regular", Menlo, Consolas, monospace`, "right"); label(ctx, o.unit || "V", x + w - 16, y + 29, "#cbd5e1", F(11, 700), "right");
  label(ctx, o.title, x + w / 2, y + 56, c.dark ? "#e2e8f0" : "#334155", F(9, 700));
  const kr = Math.min(18, h * 0.16), kx = x + w / 2, ky = y + h - kr - 26, f = clamp(o.frac, 0, 1), a = (135 + 270 * f) * DEG;
  ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(kx, ky, kr + 5, 135 * DEG, 405 * DEG); ctx.stroke();
  ctx.strokeStyle = "#22c55e"; ctx.beginPath(); ctx.arc(kx, ky, kr + 5, 135 * DEG, a); ctx.stroke();
  ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(a) * (kr - 3), ky + Math.sin(a) * (kr - 3)); ctx.stroke();
  const ty = y + h - 12, minus = [x + 16, ty], plus = [x + w - 16, ty];
  dot(ctx, minus[0], minus[1], 5.5, "#111"); dot(ctx, plus[0], plus[1], 5.5, "#b91c1c");
  label(ctx, "−", minus[0] + 13, ty, c.dark ? "#e2e8f0" : "#334155", F(11, 700)); label(ctx, "+", plus[0] - 13, ty, "#b91c1c", F(11, 700));
  return { minus, plus, knob: [kx, ky, kr + 10] };
}
/** Dastak burchagidan qiymat ulushi (0…1): 135°…405° oralig‘ida. */
export function knobFrac(x, y, k) {
  let a = Math.atan2(y - k[1], x - k[0]) / DEG; if (a < 0) a += 360; if (a < 135) a += 360;
  return clamp((a - 135) / 270, 0, 1);
}
