// ==========================================================================
// Virtual laboratoriyalar uchun umumiy chizish yordamchilari: asbob displeyi (LCD), dastak, sahnadagi tugma,
// yorliq, o‘lchov yozuvchisi (recorder) grafigi va readout kartochkalari.
// ==========================================================================

import { clamp, fmt, tag } from "./sim-kit.js";

export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const SMALL = "600 10px Inter, system-ui, sans-serif";
export const MID = "600 11px Inter, system-ui, sans-serif";
export const BOLD = "700 12px Inter, system-ui, sans-serif";
export const LBL = "italic 700 13px Inter, system-ui, sans-serif";
export const MONO = (s) => `700 ${s}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`;
export const PAL = ["#2563eb", "#ea580c", "#16a34a", "#9333ea", "#0891b2", "#e11d48", "#ca8a04", "#64748b"];

export function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
export function tagIn(ctx, text, x, y, cw, o) {
  ctx.save(); ctx.font = o.font || MID; const w = ctx.measureText(text).width + 2 * (o.pad ?? 6); ctx.restore();
  let x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  x0 = clamp(x0, 4, cw - 4 - w); tag(ctx, text, x0, y, { ...o, align: "left" });
}
/** Sahnadagi tugma; qaytaradi bosish sohasi. */
export function chipBtn(ctx, c, x, y, text, on, w, h = 24, color) {
  ctx.save(); ctx.font = MID; const tw = w || ctx.measureText(text).width + 14;
  ctx.fillStyle = on ? color || c.primary : c.dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"; ctx.beginPath(); ctx.roundRect(x, y, tw, h, 6); ctx.fill();
  ctx.fillStyle = on ? "#fff" : c.text; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x + tw / 2, y + h / 2 + 0.5); ctx.restore();
  return { x0: x, x1: x + tw, y0: y, y1: y + h };
}
export function knob(ctx, c, x, y, r, frac, label) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, 405 * DEG); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, (135 + 270 * clamp(frac, 0, 1)) * DEG); ctx.stroke();
  const a = (135 + 270 * clamp(frac, 0, 1)) * DEG; ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); ctx.stroke();
  if (label) { ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x, y + r + 8); }
}
/** Raqamli asbob displeyi. */
export function lcd(ctx, x, y, w, h, title, value, unit, col = "#4ade80") {
  ctx.fillStyle = "#0b1220"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(title, x + 9, y + 15);
  ctx.fillStyle = col; ctx.font = MONO(Math.min(26, h * 0.5)); ctx.textAlign = "right"; ctx.fillText(value, x + w - (unit.length > 2 ? 44 : 36), y + h - 11);
  ctx.fillStyle = "#cbd5e1"; ctx.font = BOLD; ctx.textAlign = "left"; ctx.fillText(unit, x + w - (unit.length > 2 ? 40 : 30), y + h - 12);
}
/** Tugmalar to‘ri: items [[matn, qiymat]], cols ustun; qaytaradi bosish sohalari {…, v}. */
export function chipGrid(ctx, c, x, y, w, items, cols, h = 24, gap = 4, isOn) {
  const bw = (w - gap * (cols - 1)) / cols, out = [];
  items.forEach(([t, v], i) => { const b = chipBtn(ctx, c, x + (i % cols) * (bw + gap), y + Math.floor(i / cols) * (h + gap), t, isOn ? isOn(v) : false, bw, h); out.push({ ...b, v }); });
  return out;
}
/** Readout kartochkalarini yaratadi; qaytaradi set(key, label, value, sub, tone). */
export function readouts(el) {
  el.innerHTML = ["r1", "r2", "r3", "r4", "r5", "r6"].map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
  return (key, label, value, sub, tone) => { const r = el.querySelector(`[data-readout="${key}"]`); r.querySelector("[data-label]").innerHTML = label; r.querySelector("[data-value]").innerHTML = value; r.querySelector("[data-sub]").textContent = sub; r.dataset.tone = tone || ""; };
}
export const u = (v, unit) => `${v}<small>${unit}</small>`;
/** Pseudo-tasodifiy shovqin [-0,5; 0,5) — asbob o‘qishlari barqaror bo‘lishi uchun deterministik. */
export const noise = (a, b = 0) => { const h = Math.sin(a * 913.7 + b * 37.1 + 0.123) * 43758.5453; return h - Math.floor(h) - 0.5; };
export { clamp, fmt };
