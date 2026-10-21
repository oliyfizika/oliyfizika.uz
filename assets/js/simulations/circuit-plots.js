// ==========================================================================
// Elektr zanjiri grafiklari: elementlar bo'yicha U va I ustunlari, I(U) o'lchash, manba U(I).
// data: { elements, index, labels (Map qirra→nom), sol (solve natijasi), selected (qirra yoki null), points }
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, sci, tag, clamp } from "./sim-kit.js";
import { diodeIV, diodeVoltage, LED_COLORS } from "./circuit-physics.js";

const TAU = Math.PI * 2;
const small = "600 11px Inter, system-ui, sans-serif";
const LOADS = new Set(["resistor", "rheostat", "conductor", "lamp", "diode", "led"]);
const DIODES = new Set(["diode", "led"]);
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);

function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }

function message(ctx, stage, text) {
  const { w, h, colors: c } = stage;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c.text3; ctx.font = "500 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
}

/* ------------------------------------------------------------------ Ustunlar: U va I */

function bars(ctx, stage, box, items, key, title, unit, selectedIdx) {
  const c = stage.colors;
  const { x, y, w, h } = box;
  const padL = 44, padR = 6, padT = 24, padB = 30;
  const pw = w - padL - padR, ph = h - padT - padB;
  const max = Math.max(1e-9, ...items.map((it) => Math.abs(it[key])));
  const yt = ticks(0, max * 1.12, 4);
  const top = Math.max(yt.values[yt.values.length - 1], max * 1.12);
  const Y = (v) => y + padT + ph - (v / top) * ph;
  ctx.save();
  ctx.font = "500 11px Inter, system-ui, sans-serif";
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.beginPath();
  yt.values.forEach((v) => { const py = Math.round(Y(v)) + 0.5; ctx.moveTo(x + padL, py); ctx.lineTo(x + padL + pw, py); });
  ctx.stroke();
  yt.values.forEach((v) => ctx.fillText(fmt(v, dec(yt.step)), x + padL - 6, Y(v)));
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = c.text2; ctx.font = small;
  ctx.fillText(`${title}, ${unit}`, x + padL, y + 4);
  ctx.strokeStyle = c.borderStrong;
  ctx.beginPath(); ctx.moveTo(x + padL + 0.5, y + padT); ctx.lineTo(x + padL + 0.5, y + padT + ph); ctx.lineTo(x + padL + pw, y + padT + ph + 0.5); ctx.stroke();

  const n = items.length, slot = pw / n, bw = Math.min(30, slot * 0.62);
  items.forEach((it, i) => {
    const cx = x + padL + slot * (i + 0.5), v = Math.abs(it[key]);
    const col = it.battery ? c.success : c.primary;
    ctx.fillStyle = col; ctx.globalAlpha = it.idx === selectedIdx ? 1 : 0.78;
    ctx.beginPath(); ctx.roundRect(cx - bw / 2, Y(v), bw, Math.max(1.5, y + padT + ph - Y(v)), 3); ctx.fill();
    ctx.globalAlpha = 1;
    if (it.idx === selectedIdx) { ctx.strokeStyle = c.warning; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(cx - bw / 2 - 2, Y(v) - 2, bw + 4, Math.max(1.5, y + padT + ph - Y(v)) + 4, 4); ctx.stroke(); }
    ctx.fillStyle = c.text; ctx.font = "600 10.5px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    const txt = sci(v, 3);
    if (ctx.measureText(txt).width < slot * 0.96 || it.idx === selectedIdx) ctx.fillText(txt, cx, Y(v) - 3);
    ctx.fillStyle = c.text2; ctx.textBaseline = "top"; ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText(it.label, cx, y + padT + ph + 8);
  });
  ctx.restore();
}

export function drawBars(ctx, stage, data) {
  const { w, h, colors: c } = stage;
  const items = [];
  data.index.forEach((edge, k) => {
    const e = data.elements[k], r = data.sol.el[k];
    if (LOADS.has(e.type)) items.push({ idx: edge, label: data.labels.get(edge), U: Math.abs(r.U), I: Math.abs(r.I), battery: false });
    else if (e.type === "battery") items.push({ idx: edge, label: data.labels.get(edge), U: Math.abs(r.Ut), I: Math.abs(r.Iout), battery: true });
  });
  if (!items.length || !data.sol.ok) return message(ctx, stage, data.sol.ok ? "Zanjirga rezistor, lampochka yoki batareya qo‘ying" : "Qisqa tutashuv — grafik hisoblanmadi");
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const gap = 10, half = (w - gap) / 2;
  bars(ctx, stage, { x: 0, y: 0, w: half, h }, items, "U", "Kuchlanish U", "V", data.selected);
  ctx.strokeStyle = c.border; ctx.beginPath(); ctx.moveTo(half + gap / 2 + 0.5, 8); ctx.lineTo(half + gap / 2 + 0.5, h - 8); ctx.stroke();
  bars(ctx, stage, { x: half + gap, y: 0, w: half, h }, items, "I", "Tok kuchi I", "A", data.selected);
}

/* ------------------------------------------------------------------ I(U) */

/** Eng kichik kvadratlar: I = U/R (koordinata boshidan o'tuvchi to'g'ri chiziq). */
export function fitResistance(points) {
  let suu = 0, sui = 0;
  points.forEach((p) => { suu += p.U * p.U; sui += p.U * p.I; });
  return sui > 0 ? suu / sui : null;
}

export function drawIU(ctx, stage, data) {
  const c = stage.colors;
  const k = data.index.indexOf(data.selected);
  const e = k >= 0 ? data.elements[k] : null;
  if (!e || !LOADS.has(e.type)) return message(ctx, stage, stage.w < 520 ? "Rezistor, lampochka yoki diodni tanlang" : "Iste’molchini (rezistor, lampochka, reostat, sim, diod, LED) tanlang — I(U) grafigi shu element uchun chiziladi");
  if (!data.sol.ok) return message(ctx, stage, "Qisqa tutashuv — grafik hisoblanmadi");
  if (DIODES.has(e.type)) return drawDiodeIV(ctx, stage, data, k, e);
  const r = data.sol.el[k], R = r.R;
  const pts = data.points.filter((p) => p.edge === data.selected);
  const Umax0 = Math.max(Math.abs(r.U), ...pts.map((p) => p.U), data.emfMax || 0, 1);
  const xt = ticks(0, Umax0 * 1.08, stage.w < 480 ? 3 : 5);
  const xMax = Math.max(xt.values[xt.values.length - 1], Umax0 * 1.08);
  const Imax0 = Math.max(Math.abs(r.I), xMax / R, ...pts.map((p) => p.I), 1e-3);
  const yt = ticks(0, Imax0 * 1.05, stage.h < 260 ? 3 : 4);
  const yMax = Math.max(yt.values[yt.values.length - 1], Imax0 * 1.05);
  const f = frame(ctx, stage, {
    xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, dec(xt.step)), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "V", yLabel: "I, A", padL: stage.w < 480 ? 50 : 58,
  });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.primary; ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(xMax / R)); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  const Rfit = pts.length >= 2 ? fitResistance(pts) : null;
  if (Rfit) { ctx.strokeStyle = c.success; ctx.lineWidth = 2.25; ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(xMax / Rfit)); ctx.stroke(); }
  pts.forEach((p) => { ctx.fillStyle = c.success; ctx.beginPath(); ctx.arc(f.X(p.U), f.Y(p.I), 4.5, 0, TAU); ctx.fill(); ctx.strokeStyle = c.bg; ctx.lineWidth = 1.5; ctx.stroke(); });
  ctx.fillStyle = c.warning;
  ctx.beginPath(); ctx.arc(f.X(Math.abs(r.U)), f.Y(Math.abs(r.I)), 6, 0, TAU); ctx.fill();
  ctx.restore();
  tag(ctx, `hozir: U = ${fmt(Math.abs(r.U), 2)} V · I = ${fmt(Math.abs(r.I), 3)} A`, f.X(Math.abs(r.U)) > f.rect.x + f.rect.w * 0.6 ? f.X(Math.abs(r.U)) - 10 : f.X(Math.abs(r.U)) + 10, clamp(f.Y(Math.abs(r.I)) + 22, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: f.X(Math.abs(r.U)) > f.rect.x + f.rect.w * 0.6 ? "right" : "left", font: small });
  const items = [{ color: c.primary, label: `Nazariy: I = U/R, R = ${fmt(R, 1)} Ω`, dash: [5, 4] }];
  if (pts.length) items.push({ color: c.success, label: pts.length >= 2 ? `O‘lchov: R ≈ ${fmt(Rfit, 2)} Ω` : "O‘lchov nuqtalari" });
  legend(ctx, items, f.padL + 10, f.padT + 14, c);
}

/* ------------------------------------------------------------------ Manba U(I) */

export function drawSource(ctx, stage, data) {
  const c = stage.colors;
  let k = data.index.indexOf(data.selected);
  if (k < 0 || data.elements[k].type !== "battery") k = data.elements.findIndex((e) => e.type === "battery");
  if (k < 0) return message(ctx, stage, "Zanjirga batareya qo‘ying — manba xarakteristikasi shu yerda ko‘rinadi");
  if (!data.sol.ok) return message(ctx, stage, "Qisqa tutashuv — grafik hisoblanmadi");
  const e = data.elements[k], r = data.sol.el[k], emf = e.emf, rin = e.r || 0;
  const Ish = rin > 0 ? emf / rin : null;
  const Ix = Math.max(Ish ?? 0, Math.abs(r.Iout) * 1.6, 0.5);
  const xt = ticks(0, Ix, stage.w < 480 ? 3 : 5);
  const xMax = Math.max(xt.values[xt.values.length - 1], Ix);
  const yt = ticks(0, emf * 1.2, stage.h < 260 ? 3 : 4);
  const yMax = Math.max(yt.values[yt.values.length - 1], emf * 1.2);
  const f = frame(ctx, stage, {
    xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, dec(xt.step)), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "A", yLabel: "U, V", padL: stage.w < 480 ? 46 : 54,
  });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.75;
  ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(emf)); ctx.lineTo(f.X(xMax), f.Y(Math.max(0, emf - rin * xMax))); ctx.stroke();
  ctx.setLineDash([4, 4]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(emf)); ctx.lineTo(f.X(xMax), f.Y(emf)); ctx.stroke(); ctx.setLineDash([]);
  const Io = Math.abs(r.Iout), Uo = r.Ut;
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(Io), f.Y(Uo), 6, 0, TAU); ctx.fill();
  ctx.restore();
  const right = f.X(Io) > f.rect.x + f.rect.w * 0.6;
  tag(ctx, `U = ${fmt(Uo, 2)} V · I = ${fmt(Io, 2)} A`, f.X(Io) + (right ? -10 : 10), clamp(f.Y(Uo) - 20, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: right ? "right" : "left", font: small });
  legend(ctx, [{ color: c.primary, label: `U = ε − I·r  (ε = ${fmt(emf, 1)} V, r = ${fmt(rin, 1)} Ω)` }].concat(Ish ? [{ color: c.text3, label: `Qisqa tutashuv toki ε/r = ${fmt(Ish, 1)} A`, dash: [4, 4] }] : []), f.padL + 10, f.padT + 14, c);
}

/* ------------------------------------------------------------------ Diod volt-amper xarakteristikasi */

function drawDiodeIV(ctx, stage, data, k, e) {
  const c = stage.colors;
  const r = data.sol.el[k];
  const pts = data.points.filter((p) => p.edge === data.selected);
  const vNom = diodeVoltage(e, e.type === "led" ? 0.03 : 0.08);
  const xMaxRaw = Math.max(vNom * 1.12, r.Vf * 1.1, ...pts.map((p) => p.U * 1.1));
  const xMinRaw = -Math.max(1, xMaxRaw * 1.4); // teskari tomonda tok ≈ 0 — keng ko'rsatish shart emas
  const xt = ticks(xMinRaw, xMaxRaw, stage.w < 480 ? 4 : 7);
  const xMin = Math.min(xt.values[0], xMinRaw), xMax = Math.max(xt.values[xt.values.length - 1], xMaxRaw);
  const iTop = Math.max(r.If, ...pts.map((p) => p.I), e.type === "led" ? 0.03 : 0.05) * 1.15;
  const yt = ticks(0, iTop, stage.h < 260 ? 3 : 4);
  const yMax = Math.max(yt.values[yt.values.length - 1], iTop), yMin = -yMax * 0.08;
  const mA = yMax < 0.2;
  const f = frame(ctx, stage, {
    xMin, xMax, yMin, yMax, xTicks: xt.values, yTicks: yt.values,
    fmtX: (v) => fmt(v, dec(xt.step)), fmtY: (v) => (mA ? fmt(v * 1000, dec(yt.step * 1000)) : fmt(v, dec(yt.step))), xUnit: "V", yLabel: mA ? "I, mA" : "I, A", padL: stage.w < 480 ? 46 : 54,
  });
  const col = e.type === "led" ? (LED_COLORS[e.color]?.color ?? c.danger) : c.primary;
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const v = xMin + ((xMax - xMin) * i) / 240;
    const I = clamp(diodeIV(e, v).i, yMin * 2, yMax * 3);
    if (i === 0) ctx.moveTo(f.X(v), f.Y(I)); else ctx.lineTo(f.X(v), f.Y(I));
  }
  ctx.stroke();
  const xc = (u) => f.X(Math.max(u, xMin + (xMax - xMin) * 0.01)); // chapdan chiqqan teskari nuqtalar chekkada
  pts.forEach((p) => { ctx.fillStyle = c.success; ctx.beginPath(); ctx.arc(xc(p.U), f.Y(p.I), 4.5, 0, TAU); ctx.fill(); ctx.strokeStyle = c.bg; ctx.lineWidth = 1.5; ctx.stroke(); });
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(xc(r.Vf), f.Y(r.If), 6, 0, TAU); ctx.fill();
  ctx.restore();
  const right = xc(r.Vf) > f.rect.x + f.rect.w * 0.6;
  const iTxt = Math.abs(r.If) < 1e-7 ? "0" : mA ? `${fmt(r.If * 1000, 1)} mA` : `${fmt(r.If, 3)} A`;
  tag(ctx, `hozir: U = ${fmt(r.Vf, 2)} V · I = ${iTxt}`, xc(r.Vf) + (right ? -10 : 10), clamp(f.Y(r.If) - 20, f.rect.y + 12, f.rect.y + f.rect.h - 12), { color: c.text, bg: c.bg, align: right ? "right" : "left", font: small });
  const items = [{ color: col, label: e.type === "led" ? `LED (${LED_COLORS[e.color]?.name ?? ""}): ochilish ≈ ${fmt(diodeVoltage(e, 0.01), 1)} V` : "Kremniy diod: ochilish ≈ 0,7 V" }];
  if (pts.length) items.push({ color: c.success, label: "O‘lchov nuqtalari" });
  legend(ctx, items, f.padL + 10, f.padT + 14, c);
  ctx.save(); ctx.font = small; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  if (xMin < 0) ctx.fillText("← teskari ulanish: tok ≈ 0", f.X(xMin) + 8, f.Y(0) - 6);
  ctx.restore();
}
