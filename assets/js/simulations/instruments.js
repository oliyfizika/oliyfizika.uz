// ==========================================================================
// Laboratoriya asboblarini realistik chizish (ekran koordinatasida, o'lcham px):
// strelkali ampermetr/voltmetr/galvanometr, klemmalar, simlar, laboratoriya manbai, pichoqli kalit.
// Ishlatiladi: joule.js, discharge.js, semi.js, statics.js (dinamometr). Ranglar readColors() tokenlaridan + asbob korpusining o'z ranglari.
// ==========================================================================

import { clamp, fmt } from "./sim-kit.js";

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const font = (w, px) => `${w} ${Math.round(px)}px Inter, system-ui, sans-serif`;

/** Klemma (vint): rang — qizil "+" yoki qora "−" */
export function terminal(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, "#fff"); g.addColorStop(0.35, color); g.addColorStop(1, "#111827");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1; ctx.stroke();
}

/** Sim: nuqtalar ro'yxati bo'ylab yumaloq burchakli chiziq; on — tok o'tayotgani (biroz yorqinroq) */
export function wire(ctx, c, pts, { color, width = 2.4, on = false } = {}) {
  if (pts.length < 2) return;
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = color || (c.dark ? "#f87171" : "#b91c1c"); ctx.lineWidth = width + 1.6; ctx.globalAlpha = 0.25;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.globalAlpha = on ? 1 : 0.85; ctx.lineWidth = width; ctx.stroke();
  ctx.restore();
}

/**
 * Strelkali o'lchov asbobi (laboratoriya ampermetri/voltmetri).
 * o: { value, max, min = 0, sym: "A" | "V" | "mA" | "μA" | "kV", label, digits, zeroCenter, plusLeft, ac (o‘zgaruvchan tok: ishorasiz klemmalar), ticks }
 * Qaytaradi: { plus: [x, y], minus: [x, y], box }
 */
export function analogMeter(ctx, c, x, y, w, o) {
  const h = w * 0.82, r = w * 0.44, cx = x + w / 2, cy = y + h * 0.78;
  const min = o.min ?? (o.zeroCenter ? -o.max : 0), max = o.max, span = 96 * DEG, a0 = -Math.PI / 2 - span / 2;
  ctx.save();
  // korpus (qora plastik)
  ctx.fillStyle = c.dark ? "#1f2937" : "#27272a"; ctx.beginPath(); ctx.roundRect(x, y, w, h, w * 0.06); ctx.fill();
  ctx.strokeStyle = c.dark ? "#475569" : "#18181b"; ctx.lineWidth = 1; ctx.stroke();
  // shkala oynasi
  const fx = x + w * 0.07, fy = y + w * 0.06, fw = w * 0.86, fh = h * 0.66;
  ctx.fillStyle = c.dark ? "#e7e5e4" : "#fafaf9"; ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, w * 0.03); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, w * 0.03); ctx.clip();
  // oyna (paralaksga qarshi ko'zgu yoyi)
  ctx.strokeStyle = "rgba(148,163,184,0.6)"; ctx.lineWidth = w * 0.025; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, a0, a0 + span); ctx.stroke();
  // bo'linmalar
  const n = o.ticks || 10;
  ctx.strokeStyle = "#1c1917"; ctx.fillStyle = "#1c1917"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = font(600, Math.max(7, w * 0.075));
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, a0, a0 + span); ctx.stroke();
  for (let k = 0; k <= n * 5; k++) {
    const a = a0 + (span * k) / (n * 5), big = k % 5 === 0, L = big ? r * 0.12 : r * 0.06;
    ctx.lineWidth = big ? 1.2 : 0.7;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); ctx.lineTo(cx + Math.cos(a) * (r * 0.9 + L), cy + Math.sin(a) * (r * 0.9 + L)); ctx.stroke();
    if (big && (k / 5) % (n > 5 ? 2 : 1) === 0) {
      const v = min + ((max - min) * k) / (n * 5);
      ctx.fillText(fmt(v, o.digits ?? (Math.abs(max - min) < 5 ? 1 : 0)), cx + Math.cos(a) * r * 1.13, cy + Math.sin(a) * r * 1.13);
    }
  }
  ctx.font = font(800, w * 0.13); ctx.fillText(o.sym, cx, cy - r * 0.42);
  if (o.label) { ctx.font = font(600, Math.max(6.5, w * 0.06)); ctx.fillStyle = "#57534e"; ctx.fillText(o.label, cx, cy - r * 0.2); }
  // strelka
  const f = clamp((o.value - min) / (max - min), -0.03, 1.03), a = a0 + span * f;
  ctx.strokeStyle = "#dc2626"; ctx.lineWidth = Math.max(1.2, w * 0.014); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#44403c"; ctx.beginPath(); ctx.arc(cx, cy, w * 0.045, 0, TAU); ctx.fill();
  // klemmalar
  const ty = y + h * 0.9, R = [x + w * 0.78, ty], L = [x + w * 0.22, ty], plus = o.plusLeft ? L : R, minus = o.plusLeft ? R : L;
  terminal(ctx, plus[0], plus[1], w * 0.055, o.ac ? "#334155" : "#dc2626"); terminal(ctx, minus[0], minus[1], w * 0.055, "#334155");
  ctx.fillStyle = "#e5e7eb"; ctx.font = font(800, w * 0.08); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const sg = o.plusLeft ? -1 : 1;
  if (o.ac) ctx.fillText("~", cx, ty); else { ctx.fillText("+", plus[0] - sg * w * 0.12, ty); ctx.fillText("−", minus[0] + sg * w * 0.12, ty); }
  ctx.restore();
  return { plus, minus, box: { x, y, w, h } };
}

/**
 * Laboratoriya manbai: raqamli displey, aylanadigan dasta (knob), klemmalar.
 * o: { value, unit, frac (dasta holati 0…1), title, on }
 */
export function powerSupply(ctx, c, x, y, w, h, o) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c.dark ? "#475569" : "#e2e8f0"); g.addColorStop(1, c.dark ? "#334155" : "#cbd5e1");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(8, w * 0.05)); ctx.fill();
  ctx.strokeStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.lineWidth = 1; ctx.stroke();
  // displey
  const dx = x + w * 0.08, dy = y + h * 0.12, dw = w * 0.84, dh = h * 0.34;
  ctx.fillStyle = "#0b1220"; ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, 4); ctx.fill();
  ctx.fillStyle = o.on === false ? "#334155" : "#4ade80"; ctx.font = `700 ${Math.round(dh * 0.62)}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(o.text ?? fmt(o.value, 1), dx + dw - dh * 0.9, dy + dh / 2 + 1);
  ctx.fillStyle = "#94a3b8"; ctx.font = font(700, dh * 0.36); ctx.textAlign = "left"; ctx.fillText(o.unit, dx + dw - dh * 0.8, dy + dh / 2 + 1);
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#334155"; ctx.font = font(700, Math.max(8, h * 0.085)); ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(o.title || "", x + w * 0.08, y + h * 0.52);
  // dasta
  const kx = x + w * 0.3, ky = y + h * 0.77, kr = Math.min(w, h) * 0.13;
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(kx, ky, kr + 4, 135 * DEG, (135 + 270 * clamp(o.frac, 0, 1)) * DEG); ctx.stroke();
  const ka = (135 + 270 * clamp(o.frac, 0, 1)) * DEG; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(kx + Math.cos(ka) * kr * 0.25, ky + Math.sin(ka) * kr * 0.25); ctx.lineTo(kx + Math.cos(ka) * kr * 0.85, ky + Math.sin(ka) * kr * 0.85); ctx.stroke();
  // klemmalar
  const plus = [x + w * 0.82, ky], minus = [x + w * 0.62, ky];
  terminal(ctx, plus[0], plus[1], Math.max(4, h * 0.06), "#dc2626"); terminal(ctx, minus[0], minus[1], Math.max(4, h * 0.06), "#334155");
  ctx.restore();
  return { plus, minus, knob: { x: kx, y: ky, r: kr + 6 }, box: { x, y, w, h } };
}

/** Pichoqli kalit: a, b — klemmalar (ekranda), closed */
export function knifeSwitch(ctx, c, a, b, closed, s = 1) {
  ctx.save();
  const [ax, ay] = a, [bx, by] = b, L = Math.hypot(bx - ax, by - ay);
  ctx.fillStyle = c.dark ? "#334155" : "#e7e5e4"; ctx.strokeStyle = c.dark ? "#64748b" : "#a8a29e"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(ax - 8 * s, ay - 7 * s, L + 16 * s, 14 * s, 3 * s); ctx.fill(); ctx.stroke();
  terminal(ctx, ax, ay, 4 * s, "#a1a1aa"); terminal(ctx, bx, by, 4 * s, "#a1a1aa");
  const ang = Math.atan2(by - ay, bx - ax) - (closed ? 0 : 32 * DEG);
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#78716c"; ctx.lineWidth = 3.4 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(ang) * L, ay + Math.sin(ang) * L); ctx.stroke();
  ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(ax + Math.cos(ang) * (L + 4 * s), ay + Math.sin(ang) * (L + 4 * s), 4 * s, 0, TAU); ctx.fill();
  ctx.restore();
  return { x: (ax + bx) / 2, y: ay - 10 * s, r: Math.max(18, L * 0.7) };
}

/** Raqamli sekundomer (LCD) */
export function stopwatch(ctx, c, x, y, w, t, running) {
  const h = w * 0.62;
  ctx.save();
  ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.beginPath(); ctx.roundRect(x + w * 0.42, y - h * 0.14, w * 0.16, h * 0.16, 2); ctx.fill();
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.25); ctx.fill();
  ctx.fillStyle = "#a3b18a"; ctx.beginPath(); ctx.roundRect(x + w * 0.08, y + h * 0.18, w * 0.84, h * 0.56, 3); ctx.fill();
  const m = Math.floor(t / 60), sec = t % 60;
  ctx.fillStyle = "#1a2e05"; ctx.font = `700 ${Math.round(h * 0.3)}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0").replace(".", ",")}`, x + w / 2, y + h * 0.47);
  ctx.fillStyle = running ? "#ef4444" : "#64748b"; ctx.beginPath(); ctx.arc(x + w * 0.88, y + h * 0.88, h * 0.06, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * Raqamli multimetr (sariq rezina g'ilofda): LCD, rejim tanlagich, uyachalar.
 * o: { text, unit, mode: "Ω" | "V" | "A" | "mA" | "μA", jack: "V" | "A" (qizil sim qaysi uyachada) }
 * Balandligi w·1,62. Qaytaradi: { com: [x, y], red: [x, y], dial: { x, y, r }, box }
 */
export function multimeter(ctx, c, x, y, w, o) {
  const h = w * 1.62;
  ctx.save();
  ctx.fillStyle = "#eab308"; ctx.beginPath(); ctx.roundRect(x, y, w, h, w * 0.12); ctx.fill();
  ctx.strokeStyle = "#a16207"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#27272a"; ctx.beginPath(); ctx.roundRect(x + w * 0.07, y + w * 0.07, w * 0.86, h - w * 0.14, w * 0.07); ctx.fill();
  // LCD
  const lx = x + w * 0.14, ly = y + w * 0.14, lw = w * 0.72, lh = w * 0.34;
  ctx.fillStyle = "#b5c4a1"; ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 3); ctx.fill();
  ctx.fillStyle = "#1a2e05"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(lh * 0.46)}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`;
  ctx.fillText(o.text, lx + lw * 0.76, ly + lh * 0.52);
  ctx.font = font(800, lh * 0.3); ctx.textAlign = "left"; ctx.fillText(o.unit, lx + lw * 0.8, ly + lh * 0.55);
  // rejim tanlagich
  const dx = x + w / 2, dy = y + w * 0.82, dr = w * 0.2, MODES = ["V", "Ω", "μA", "mA", "A"], k = Math.max(0, MODES.indexOf(o.mode));
  ctx.fillStyle = "#3f3f46"; ctx.beginPath(); ctx.arc(dx, dy, dr * 1.55, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e4e4e7"; ctx.font = font(700, Math.max(6, w * 0.08)); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  MODES.forEach((m, i) => { const a = (-150 + i * 75) * DEG; ctx.fillStyle = i === k ? "#facc15" : "#a1a1aa"; ctx.fillText(m, dx + Math.cos(a - Math.PI / 2) * dr * 1.3, dy + Math.sin(a - Math.PI / 2) * dr * 1.3); });
  const g = ctx.createRadialGradient(dx - dr * 0.3, dy - dr * 0.3, dr * 0.1, dx, dy, dr);
  g.addColorStop(0, "#52525b"); g.addColorStop(1, "#18181b"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(dx, dy, dr, 0, TAU); ctx.fill();
  const a = (-150 + k * 75) * DEG - Math.PI / 2; ctx.strokeStyle = "#f4f4f5"; ctx.lineWidth = Math.max(1.5, w * 0.03); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(dx + Math.cos(a) * dr * 0.2, dy + Math.sin(a) * dr * 0.2); ctx.lineTo(dx + Math.cos(a) * dr * 0.9, dy + Math.sin(a) * dr * 0.9); ctx.stroke();
  // uyachalar
  const jy = y + h - w * 0.2, com = [x + w * 0.5, jy], vj = [x + w * 0.78, jy], aj = [x + w * 0.22, jy], red = o.jack === "A" ? aj : vj;
  [[aj, "A"], [com, "COM"], [vj, "VΩ"]].forEach(([p, t]) => {
    ctx.fillStyle = "#09090b"; ctx.beginPath(); ctx.arc(p[0], p[1], w * 0.06, 0, TAU); ctx.fill();
    ctx.strokeStyle = t === "COM" ? "#52525b" : "#dc2626"; ctx.lineWidth = Math.max(1, w * 0.02); ctx.stroke();
    ctx.fillStyle = "#d4d4d8"; ctx.font = font(700, Math.max(5.5, w * 0.065)); ctx.fillText(t, p[0], p[1] - w * 0.11);
  });
  ctx.restore();
  return { com, red, dial: { x: dx, y: dy, r: dr * 1.55 }, box: { x, y, w, h } };
}

/** Sim uchidagi shtekerlar (banan-vilka) uyachaga kirgan holda */
export function plug(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - r, y - r * 2.6, r * 2, r * 2.4, r * 0.5); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(x - r * 0.6, y - r * 2.4, r * 0.4, r * 2);
  ctx.restore();
}

/**
 * Prujinali dinamometr: a — halqa (tortiladigan) uchi, b — ilgak uchi (ekran px). F — ko'rsatish (N), Fmax — shkala.
 * Korpus a → b o'qi bo'ylab joylashadi; shkala 0 dan Fmax gacha, qizil ko'rsatkich. w — korpus eni (px).
 */
export function springScale(ctx, c, a, b, F, Fmax, { w = 16 } = {}) {
  const [ax, ay] = a, [bx, by] = b, L = Math.hypot(bx - ax, by - ay);
  if (L < 20) return;
  const rot = Math.atan2(by - ay, bx - ax) - Math.PI / 2, flip = Math.cos(rot) < 0;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot);
  const r = w * 0.42, top = r * 2, hook = Math.min(L * 0.18, w * 1.6), bot = L - hook, bodyL = bot - top;
  // halqa
  ctx.strokeStyle = "#a1a1aa"; ctx.lineWidth = Math.max(1.4, w * 0.13); ctx.beginPath(); ctx.arc(0, r, r * 0.8, 0, TAU); ctx.stroke();
  // korpus (shaffof plastik quvur)
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "rgba(148,163,184,0.55)"); g.addColorStop(0.35, "rgba(241,245,249,0.85)"); g.addColorStop(1, "rgba(100,116,139,0.6)");
  ctx.fillStyle = g; ctx.strokeStyle = "rgba(71,85,105,0.9)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(-w / 2, top, w, bodyL, w * 0.3); ctx.fill(); ctx.stroke();
  // shkala plastinasi
  const s0 = top + w * 0.5, s1 = top + bodyL - w * 0.6, frac = clamp(F / Fmax, 0, 1.04), yi = s0 + frac * (s1 - s0);
  ctx.fillStyle = "#fafaf9"; ctx.fillRect(-w * 0.08, s0 - 3, w * 0.5, s1 - s0 + 6);
  // prujina
  ctx.strokeStyle = "#71717a"; ctx.lineWidth = Math.max(0.8, w * 0.06); ctx.beginPath();
  const coils = 9; for (let i = 0; i <= coils * 2; i++) { const yy = top + 3 + ((yi - top - 3) * i) / (coils * 2), xx = -w * 0.3 + (i % 2 ? w * 0.18 : 0); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke();
  // bo'linmalar
  const step = Fmax <= 2 ? 0.1 : Fmax <= 5 ? 0.5 : Fmax <= 20 ? 1 : 5, big = Fmax <= 2 ? 0.5 : Fmax <= 5 ? 1 : Fmax <= 20 ? 5 : 10;
  ctx.strokeStyle = "#27272a"; ctx.fillStyle = "#27272a"; ctx.lineWidth = 0.8; ctx.font = font(700, Math.max(6, w * 0.34)); ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (let v = 0; v <= Fmax + 1e-9; v += step) {
    const yy = s0 + (v / Fmax) * (s1 - s0), isBig = Math.abs(v / big - Math.round(v / big)) < 1e-6;
    ctx.beginPath(); ctx.moveTo(-w * 0.06, yy); ctx.lineTo(-w * 0.06 + (isBig ? w * 0.24 : w * 0.13), yy); ctx.stroke();
    if (isBig && w >= 12) { if (flip) { ctx.save(); ctx.translate(w * 0.2, yy); ctx.rotate(Math.PI); ctx.textAlign = "right"; ctx.fillText(fmt(v, 0), 0, 0); ctx.restore(); } else ctx.fillText(fmt(v, 0), w * 0.2, yy); }
  }
  // ko'rsatkich
  ctx.fillStyle = "#dc2626"; ctx.fillRect(-w * 0.42, yi - 1.6, w * 0.62, 3.2);
  // shtok va ilgak
  ctx.strokeStyle = "#a1a1aa"; ctx.lineWidth = Math.max(1.4, w * 0.12); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, yi); ctx.lineTo(0, L - hook * 0.45); ctx.stroke();
  ctx.beginPath(); ctx.arc(-hook * 0.18, L - hook * 0.45 + hook * 0.22, hook * 0.22, -Math.PI / 2, Math.PI * 0.85); ctx.stroke();
  ctx.restore();
}
