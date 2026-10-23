// ==========================================================================
// Qora jism nurlanishi — virtual laboratoriya (simulations/blackbody.html)
// Qora jism modeli (pech-bo‘shliq) harorati isitgich bilan o‘rnatiladi (issiqlik inersiyasi bor), optik pirometr T ni
// ko‘rsatadi. 1) «Spektr»: monoxromator (prizma) + detektor — B_λ(λ) o‘lchanadi, avtomatik skanerlash, grafik.
// 2) «Radiometr»: L masofadagi kalibrlangan termobatareya E ni o‘lchaydi — Stefan–Bolsman qonuni, ln E(ln T).
// Daftar: labnotebook.js; hisobot: bb-report.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { createStage, createLoop, prefersReducedMotion } from "./sim-kit.js";
import { SMALL, MID, BOLD, circle, tagIn, chipBtn, knob, lcd, chipGrid, readouts, u, noise, clamp, fmt } from "./labkit.js";
import * as P from "./bb-physics.js";
import * as L from "./bb-lab.js";
import { nmRGB } from "./led-physics.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { buildBBDoc, SITE, DOC_LABEL } from "./bb-report.js";

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const REC = "of-bb-rec-v1";
const rec = store.get(REC, { spec: {}, rad: [] });
const st = { mode: "spec", Tset: 2000, T: 2000, lam: 1.5, scan: false, norm: false, cursor: null, t: 0 };
const geo = {};
let presetId = null;
const Tpyr = () => Math.round(st.T);
const stable = () => Math.abs(st.T - st.Tset) < 2;
const detB = () => P.Blam(st.lam, st.T) * (1 + 0.001 * noise(st.lam * 7, st.T));
const radE = () => P.irr(st.T) * (1 + 0.003 * noise(st.T, 3));
const save = () => { clearTimeout(save.t); save.t = setTimeout(() => store.set(REC, rec), 400); };
function recordSpec() {
  const k = String(st.Tset), c = (rec.spec[k] ||= []), L0 = Math.round(st.lam * 100) / 100, i = c.findIndex((p) => Math.abs(p[0] - L0) < 1e-6), v = [L0, detB()];
  if (i >= 0) c[i] = v; else c.push(v);
  const ks = Object.keys(rec.spec); if (ks.length > 8) delete rec.spec[ks.find((x) => x !== k)];
  save();
}
const setTset = (v) => { st.Tset = clamp(Math.round(v / 10) * 10, P.T_RANGE[0], P.T_RANGE[1]); };
const setLam = (v) => { st.lam = clamp(Math.round(v * 100) / 100, P.LAM_RANGE[0], P.LAM_RANGE[1]); if (st.mode === "spec" && stable()) recordSpec(); };

/* ------------------------------------------------------------------ Sahna */
function furnace(ctx, c, x, y, s) {
  // pech: issiqlik izolyatsiyasi, ichki bo‘shliq, apertura
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; ctx.beginPath(); ctx.roundRect(x, y - 52 * s, 96 * s, 104 * s, 10); ctx.fill();
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; ctx.beginPath(); ctx.roundRect(x + 10 * s, y - 40 * s, 72 * s, 80 * s, 8); ctx.fill();
  const [r, g, b] = P.tempRGB(st.T), gl = P.glowLevel(st.T);
  const cav = ctx.createRadialGradient(x + 50 * s, y, 4, x + 50 * s, y, 34 * s); cav.addColorStop(0, `rgba(${r},${g},${b},${0.25 + 0.75 * gl})`); cav.addColorStop(1, `rgba(${r},${Math.round(g * 0.6)},${Math.round(b * 0.4)},${0.15 + 0.5 * gl})`);
  ctx.fillStyle = cav; ctx.beginPath(); ctx.roundRect(x + 16 * s, y - 32 * s, 62 * s, 64 * s, 30 * s); ctx.fill();
  ctx.fillStyle = c.dark ? "#94a3b8" : "#cbd5e1"; ctx.fillRect(x + 92 * s, y - 20 * s, 8 * s, 14 * s); ctx.fillRect(x + 92 * s, y + 6 * s, 8 * s, 14 * s);
  if (gl > 0.02) { const halo = ctx.createRadialGradient(x + 98 * s, y, 1, x + 98 * s, y, 26 * s); halo.addColorStop(0, `rgba(${r},${g},${b},${0.8 * gl})`); halo.addColorStop(1, `rgba(${r},${g},${b},0)`); ctx.fillStyle = halo; circle(ctx, x + 98 * s, y, 26 * s); ctx.fill(); }
  ctx.fillStyle = `rgb(${Math.round(r * (0.3 + 0.7 * gl))},${Math.round(g * (0.2 + 0.8 * gl))},${Math.round(b * (0.1 + 0.9 * gl))})`; ctx.fillRect(x + 94 * s, y - 6 * s, 4 * s, 12 * s);
  // isitgich spirali belgisi
  ctx.strokeStyle = "#f97316"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const xx = x + 18 * s + i * 1.5 * s, yy = y + 45 * s + Math.sin(i * 0.9) * 3 * s; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(s < 0.9 ? "pech" : "qora jism modeli (pech)", x + 48 * s, y + 58 * s);
  // pirometr
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.save(); ctx.translate(x + 120 * s, y - 62 * s); ctx.rotate(0.5); ctx.fillRect(-26 * s, -5 * s, 40 * s, 10 * s); ctx.restore();
  ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.fillText("pirometr", x + 120 * s, y - 84 * s);
}
function drawSpec(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560, area = narrow ? cw - 16 : cw * 0.6, k = Math.min(area / 470, (narrow ? 210 : ch - 30) / 230);
  const ox = narrow ? 8 : 8 + (area - 470 * k) / 2, oy = narrow ? 22 : (ch - 230 * k) / 2 + 26;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k, by = Y(70);
  geo.chips = [];
  furnace(ctx, c, X(0), by, k);
  // nur → monoxromator kirish tirqishi
  const [r, g, b] = P.tempRGB(st.T), gl = P.glowLevel(st.T);
  ctx.fillStyle = `rgba(${r},${g},${b},${0.15 + 0.5 * gl})`; ctx.fillRect(X(100), by - 4 * k, X(170) - X(100), 8 * k);
  // monoxromator
  ctx.fillStyle = c.dark ? "#1e293b" : "#e2e8f0"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(X(170), Y(10), 170 * k, 130 * k, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("monoxromator", X(255), Y(14));
  // prizma
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.45)"; ctx.beginPath(); ctx.moveTo(X(240), Y(110)); ctx.lineTo(X(270), Y(50)); ctx.lineTo(X(300), Y(110)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = c.text3; ctx.stroke();
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.3 + 0.6 * gl})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(176), by); ctx.lineTo(X(255), Y(82)); ctx.stroke();
  // dispersiya: tanlangan λ ning nuri chiqish tirqishiga
  for (let i = 0; i < 9; i++) { const l = 0.4 + i * 0.05, q = nmRGB(l * 1000); ctx.strokeStyle = `rgba(${q[0]},${q[1]},${q[2]},${0.25 + 0.4 * gl})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(285), Y(82)); ctx.lineTo(X(336), Y(46 + i * 7)); ctx.stroke(); }
  const yl = Y(46 + clamp((st.lam - 0.4) / 0.05, -3, 14) * 7);
  ctx.strokeStyle = st.lam < 0.78 && st.lam > 0.38 ? `rgb(${nmRGB(st.lam * 1000).join(",")})` : c.danger; ctx.lineWidth = 2.5; ctx.setLineDash(st.lam > 0.78 ? [4, 3] : []); ctx.beginPath(); ctx.moveTo(X(285), Y(82)); ctx.lineTo(X(340), yl); ctx.lineTo(X(360), by); ctx.stroke(); ctx.setLineDash([]);
  // λ dastagi (baraban)
  knob(ctx, c, X(255), Y(124), 11 * k, (st.lam - 0.3) / 5.7, ""); geo.drumL = { x: X(255), y: Y(124), r: 18 * k };
  // chiqish tirqishi va detektor
  ctx.fillStyle = c.text2; ctx.fillRect(X(340), by - 8 * k, 3 * k, 6 * k); ctx.fillRect(X(340), by + 2 * k, 3 * k, 6 * k);
  ctx.fillStyle = c.dark ? "#475569" : "#64748b"; ctx.beginPath(); ctx.roundRect(X(360), by - 18 * k, 50 * k, 36 * k, 6); ctx.fill();
  ctx.fillStyle = "#0b1220"; ctx.fillRect(X(360), by - 6 * k, 6 * k, 12 * k);
  ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("detektor", X(385), by + 22 * k); if (!narrow) ctx.fillText("(bolometr)", X(385), by + 34 * k);
  // λ shkalasi
  const sx0 = X(170), sx1 = X(470), sy = Y(170), LX = (l) => sx0 + ((l - 0.3) / 5.7) * (sx1 - sx0);
  for (let l = 0.38; l < 0.78; l += 0.01) { const q = nmRGB(l * 1000); ctx.fillStyle = `rgb(${q.join(",")})`; ctx.fillRect(LX(l), sy, LX(l + 0.01) - LX(l) + 0.5, 8 * k); }
  ctx.fillStyle = c.dark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.18)"; ctx.fillRect(LX(0.78), sy, sx1 - LX(0.78), 8 * k);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.strokeRect(sx0, sy, sx1 - sx0, 8 * k);
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; for (let l = 1; l <= 6; l++) ctx.fillText(String(l), LX(l), sy + 10 * k);
  ctx.fillText("λ, μm", LX(0.45), sy + 10 * k); ctx.fillText("infraqizil", LX(3.4), sy - 13 * k);
  ctx.fillStyle = c.danger; ctx.beginPath(); ctx.moveTo(LX(st.lam), sy - 2); ctx.lineTo(LX(st.lam) - 5, sy - 9); ctx.lineTo(LX(st.lam) + 5, sy - 9); ctx.closePath(); ctx.fill();
  geo.scale = { x0: sx0, x1: sx1, y0: sy - 12, y1: sy + 22 };
  instruments(ctx, c, cw, ch, narrow, ox + 470 * k + 14, narrow ? Y(200) : 0, "DETEKTOR · B_λ", fmt(detB(), detB() < 100 ? 2 : 1), "kW/(m²·sr·μm)",
    [["λ −0,1", -0.1, "dL"], ["−0,01", -0.01, "dL"], ["+0,01", 0.01, "dL"], ["λ +0,1", 0.1, "dL"]], `λ = ${fmt(st.lam, 2)} μm`);
}
function drawRad(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560, area = narrow ? cw - 16 : cw * 0.6, k = Math.min(area / 470, (narrow ? 210 : ch - 30) / 230);
  const ox = narrow ? 8 : 8 + (area - 470 * k) / 2, oy = narrow ? 22 : (ch - 230 * k) / 2 + 26;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k, by = Y(70);
  geo.chips = [];
  furnace(ctx, c, X(0), by, k);
  const [r, g, b] = P.tempRGB(st.T), gl = P.glowLevel(st.T);
  // nurlanish konusi apertura → radiometr
  const rx0 = X(100), rx1 = X(400);
  const cone = ctx.createLinearGradient(rx0, 0, rx1, 0); cone.addColorStop(0, `rgba(${r},${g},${b},${0.08 + 0.3 * gl})`); cone.addColorStop(1, `rgba(${r},${g},${b},0.03)`);
  ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(rx0, by - 5 * k); ctx.lineTo(rx1, by - 40 * k); ctx.lineTo(rx1, by + 40 * k); ctx.lineTo(rx0, by + 5 * k); ctx.closePath(); ctx.fill();
  // radiometr (termobatareya, konus)
  ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.beginPath(); ctx.moveTo(X(400), by - 16 * k); ctx.lineTo(X(430), by - 9 * k); ctx.lineTo(X(430), by + 9 * k); ctx.lineTo(X(400), by + 16 * k); ctx.closePath(); ctx.fill();
  ctx.fillRect(X(430), by - 12 * k, 30 * k, 24 * k); ctx.fillStyle = "#111827"; ctx.fillRect(X(399), by - 6 * k, 3 * k, 12 * k);
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.textAlign = narrow ? "right" : "center"; ctx.fillText("radiometr", narrow ? X(462) : X(430), by + 22 * k); if (!narrow) ctx.fillText("(termobatareya)", X(430), by + 34 * k);
  // masofa L
  const ly = Y(150); ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(98), ly); ctx.lineTo(X(400), ly); ctx.moveTo(X(98), ly - 5); ctx.lineTo(X(98), ly + 5); ctx.moveTo(X(400), ly - 5); ctx.lineTo(X(400), ly + 5); ctx.stroke();
  ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`L = ${fmt(P.L_RAD * 100, 0)} sm`, X(249), ly - 3);
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textBaseline = "top"; ctx.fillText(`apertura radiusi a = ${fmt(P.A_AP * 1000, 0)} mm,  ε = ${fmt(P.EPS, 2)},  T₀ = ${P.T0} K`, X(249), ly + 6);
  ctx.fillText(`yozilgan nuqtalar: ${rec.rad.length}`, X(249), ly + 22);
  instruments(ctx, c, cw, ch, narrow, ox + 470 * k + 14, narrow ? Y(200) : 0, "RADIOMETR · E", fmt(radE(), radE() < 100 ? 2 : 1), "W/m²",
    [["● Yozib olish", "rec", "act"], ["Tozalash", "clr", "act"]], "");
}
function instruments(ctx, c, cw, ch, narrow, rx0, y0n, title, val, unit, extra, sub) {
  const sTone = stable() ? "#4ade80" : "#fbbf24";
  if (narrow) {
    const y0 = y0n;
    lcd(ctx, 8, y0, cw / 2 - 12, 46, "PIROMETR T", String(Tpyr()), "K", sTone); lcd(ctx, cw / 2 + 4, y0, cw / 2 - 12, 46, title.split(" · ")[1] || title, val, unit.length > 4 ? "" : unit, "#60a5fa");
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 52, cw - 16, [["T −100", -100], ["−10", -10], ["+10", 10], ["T +100", 100]], 4, 26).map((q) => ({ ...q, k: "dT" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 82, cw - 16, extra.map(([t, v]) => [t, v]), extra.length, 26).map((q, i) => ({ ...q, k: extra[i][2] })));
    if (st.mode === "spec") { const sb = chipBtn(ctx, c, 8, y0 + 112, st.scan ? "■ To‘xtatish" : "▶ Spektrni skanerlash", st.scan, cw - 16, 26); geo.chips.push({ ...sb, k: "scan" }); }
    return;
  }
  const rx = rx0, rw = cw - rx - 10;
  lcd(ctx, rx, 10, rw, 50, `PIROMETR · T${stable() ? "" : " (o‘zgarmoqda…)"}`, String(Tpyr()), "K", sTone);
  lcd(ctx, rx, 66, rw, 50, title, val, unit.length > 6 ? "" : unit, "#60a5fa");
  if (unit.length > 6) { ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText(unit, rx + rw - 8, 70); }
  knob(ctx, c, rx + 22, 150, 18, (st.Tset - 800) / 2200, "isitgich"); geo.knobT = { x: rx + 22, y: 150, r: 28 };
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`o‘rnatilgan: ${st.Tset} K`, rx + 52, 124);
  geo.chips.push(...chipGrid(ctx, c, rx + 52, 140, rw - 52, [["+100", 100], ["+10", 10], ["−100", -100], ["−10", -10]], 2, 22, 3).map((q) => ({ ...q, k: "dT" })));
  if (sub) { ctx.fillStyle = c.text2; ctx.font = BOLD; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(sub, rx, 210); }
  geo.chips.push(...chipGrid(ctx, c, rx, 218, rw, extra.map(([t, v]) => [t, v]), extra.length > 2 ? 4 : 2, 26).map((q, i) => ({ ...q, k: extra[i][2] })));
  if (st.mode === "spec") { const sb = chipBtn(ctx, c, rx, ch - 34, st.scan ? "■ To‘xtatish" : "▶ Spektrni skanerlash (0,3 → 6 μm)", st.scan, rw, 26); geo.chips.push({ ...sb, k: "scan" }); }
}
const draw = (ctx, S) => { ctx.fillStyle = S.colors.bg; ctx.fillRect(0, 0, S.w, S.h); (st.mode === "spec" ? drawSpec : drawRad)(ctx, S); };

/* ------------------------------------------------------------------ Grafik */
function drawGraph(ctx, G) {
  const { w, h, colors: c } = G; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const x0 = 56, x1 = w - 12, y0 = 14, y1 = h - 30; geo.g = { x0, x1 };
  ctx.font = SMALL;
  if (st.mode === "spec") {
    const keys = Object.keys(rec.spec).filter((k) => rec.spec[k].length > 1).sort((a, b) => +a - +b);
    const mx = (k) => Math.max(...rec.spec[k].map((p) => p[1]));
    const ymax = st.norm ? 1.1 : Math.max(1, ...keys.map(mx), detB()) * 1.1;
    const X = (l) => x0 + ((l - 0.3) / 5.7) * (x1 - x0), Y = (v) => y1 - (v / ymax) * (y1 - y0);
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3;
    for (let l = 0.5; l <= 6; l += 0.5) { ctx.beginPath(); ctx.moveTo(X(l), y0); ctx.lineTo(X(l), y1); ctx.stroke(); if (l % 1 === 0) { ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(String(l), X(l), y1 + 5); } }
    const stp = st.norm ? 0.2 : 10 ** Math.floor(Math.log10(ymax / 4)) * ([1, 2, 5].find((m) => ymax / (10 ** Math.floor(Math.log10(ymax / 4)) * m) <= 6) || 10);
    for (let v = 0; v <= ymax; v += stp) { ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(fmt(v, stp < 1 ? 1 : 0), x0 - 5, Y(v)); }
    ctx.strokeStyle = c.borderStrong; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(st.norm ? "B_λ / B_max" : "B_λ, kW/(m²·sr·μm)", x0 + 4, y0 + 2); ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("λ, μm", x1 - 4, y1 - 3);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    keys.forEach((k) => {
      const pts = rec.spec[k].slice().sort((a, b) => a[0] - b[0]), m = st.norm ? mx(k) : 1, [r, g, b] = P.tempRGB(+k), on = +k === st.Tset;
      ctx.strokeStyle = c.dark ? `rgb(${r},${g},${b})` : `rgb(${Math.round(r * 0.75)},${Math.round(g * 0.6)},${Math.round(b * 0.75)})`; ctx.lineWidth = on ? 2.4 : 1.4; ctx.globalAlpha = on ? 1 : 0.6;
      ctx.beginPath(); pts.forEach(([l, v], i) => (i ? ctx.lineTo(X(l), Y(v / m)) : ctx.moveTo(X(l), Y(v / m)))); ctx.stroke();
      const pk = pts.reduce((a, p) => (p[1] > a[1] ? p : a), pts[0]); ctx.globalAlpha = 1; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(`${k} K`, X(pk[0]) + 4, Y(pk[1] / m) - 3);
    });
    ctx.globalAlpha = 1; ctx.fillStyle = c.danger; circle(ctx, X(st.lam), Y(detB() / (st.norm && rec.spec[st.Tset]?.length > 1 ? mx(String(st.Tset)) : 1)), 4); ctx.fill();
    ctx.restore();
    geo.gchips = chipGrid(ctx, c, x1 - 180, y0 + 4, 176, [["absolyut", false], ["normallangan", true]], 2, 22, 4, (v) => v === st.norm);
    const cur = rec.spec[st.Tset] || [];
    if (st.cursor !== null && cur.length) {
      const l = 0.3 + ((st.cursor - x0) / (x1 - x0)) * 5.7; let b = cur[0]; cur.forEach((p) => { if (Math.abs(p[0] - l) < Math.abs(b[0] - l)) b = p; });
      ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(b[0]), y0); ctx.lineTo(X(b[0]), y1); ctx.stroke(); ctx.setLineDash([]);
      tagIn(ctx, `λ = ${fmt(b[0], 2)} μm · B = ${fmt(b[1], b[1] < 100 ? 2 : 1)}`, X(b[0]) + 8, y0 + 32, w, { color: c.text, bg: c.bg2, align: "left", font: BOLD, pad: 6 });
    }
    if (!keys.length) { ctx.fillStyle = c.text3; ctx.font = MID; ctx.textAlign = "center"; ctx.fillText("Haroratni o‘rnating, barqarorlashishini kuting va «Spektrni skanerlash» ni bosing", (x0 + x1) / 2, (y0 + y1) / 2); }
  } else {
    const pts = rec.rad, lx0 = Math.log(700), lx1 = Math.log(3300), ly0 = Math.log(5), ly1 = Math.log(3000);
    const X = (T) => x0 + ((Math.log(T) - lx0) / (lx1 - lx0)) * (x1 - x0), Y = (E) => y1 - ((Math.log(E) - ly0) / (ly1 - ly0)) * (y1 - y0);
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3;
    [800, 1000, 1500, 2000, 2500, 3000].forEach((T) => { ctx.beginPath(); ctx.moveTo(X(T), y0); ctx.lineTo(X(T), y1); ctx.stroke(); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(String(T), X(T), y1 + 5); });
    [10, 20, 50, 100, 200, 500, 1000, 2000].forEach((E) => { ctx.beginPath(); ctx.moveTo(x0, Y(E)); ctx.lineTo(x1, Y(E)); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(String(E), x0 - 5, Y(E)); });
    ctx.strokeStyle = c.borderStrong; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("E, W/m² (log)", x0 + 4, y0 + 2); ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("T, K (log)", x1 - 4, y1 - 3);
    const A = pts.length >= 2 ? L.analyze2(pts.map(([T, E]) => ({ T, E }))) : null;
    if (A?.ln) { ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(750), Y(Math.exp(A.ln.a + A.ln.b * Math.log(750)))); ctx.lineTo(X(3200), Y(Math.exp(A.ln.a + A.ln.b * Math.log(3200)))); ctx.stroke(); tagIn(ctx, `qiyalik n = ${fmt(A.n, 3)}`, x0 + 10, y0 + 24, w, { color: c.primary, bg: c.bg2, align: "left", font: BOLD, pad: 6 }); }
    ctx.fillStyle = "#ea580c"; pts.forEach(([T, E]) => { circle(ctx, X(T), Y(E), 4); ctx.fill(); });
    ctx.fillStyle = c.danger; ctx.globalAlpha = 0.5; circle(ctx, X(st.T), Y(Math.max(5, radE())), 5); ctx.fill(); ctx.globalAlpha = 1;
    geo.gchips = [];
    if (!pts.length) { ctx.fillStyle = c.text3; ctx.font = MID; ctx.textAlign = "center"; ctx.fillText("Har bir barqaror haroratda «Yozib olish» ni bosing", (x0 + x1) / 2, (y0 + y1) / 2); }
  }
}
const heights = (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.46), 300, 360)), graph: Math.round(clamp(vh * 0.32, 210, 290)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? Math.round(((cw - 16) / 470) * 200 + 22 + 150) : heights(cw).stage) });
const graph = createStage($("#graph"), drawGraph, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */
const setRO = readouts($("[data-readouts]"));
function updateReadouts() {
  setRO("r1", "Harorat <i>T</i> (pirometr)", u(String(Tpyr()), "K"), stable() ? "barqaror" : `→ ${st.Tset} K`, stable() ? "" : "amber");
  if (st.mode === "spec") {
    setRO("r2", "To‘lqin uzunligi <i>λ</i>", u(fmt(st.lam, 2), "μm"), st.lam > 0.78 ? "infraqizil" : st.lam < 0.38 ? "ultrabinafsha" : "ko‘rinadigan");
    setRO("r3", "Detektor <i>B</i><sub>λ</sub>", u(fmt(detB(), 2), "kW/(m²·sr·μm)"), "spektral ravshanlik");
  } else {
    setRO("r2", "Radiometr <i>E</i>", u(fmt(radE(), 2), "W/m²"), `L = ${fmt(P.L_RAD * 100, 0)} sm`);
    setRO("r3", "<i>T</i>⁴ − <i>T</i>₀⁴", u(fmt((st.T ** 4 - P.T0 ** 4) / 1e12, 3), "·10¹² K⁴"), `T₀ = ${P.T0} K`);
  }
  setRO("r4", "Nurlanish rangi", st.T < 900 ? "to‘q qizil" : st.T < 1300 ? "qizil" : st.T < 1800 ? "to‘q sariq" : st.T < 2500 ? "sariq-oq" : "oq", "ko‘zga ko‘rinishi");
  setRO("r5", "Isitgich", u(String(st.Tset), "K"), "o‘rnatilgan harorat");
  setRO("r6", "Ko‘rinadigan ulush", u(fmt(100 * visFrac(st.T), 1), "%"), "0,38…0,78 μm");
}
const visFrac = (T) => { let s = 0, tot = 0; for (let l = 0.1; l < 40; l += 0.02) { const v = P.planck(l * 1e-6, T); tot += v; if (l >= 0.38 && l <= 0.78) s += v; } return s / tot; };
function updateStatus() { const el = $("[data-status]"), t = st.scan ? "Skanerlanmoqda…" : stable() ? `T = ${Tpyr()} K (barqaror)` : `Qizimoqda/sovimoqda: ${Tpyr()} K`; if (el.textContent !== t) el.textContent = t; el.dataset.tone = st.scan || stable() ? "green" : "amber"; }
let lastEx = "";
function updateExplain() {
  const html = st.mode === "spec"
    ? `<p>Pech ichidagi bo‘shliq tushgan nurni deyarli to‘liq yutadi — uning aperturasidan chiqqan nurlanish qora jism nurlanishiga juda yaqin. Monoxromator bitta to‘lqin uzunligini ajratadi, detektor spektral ravshanlik B<sub>λ</sub> ni o‘lchaydi.</p><p>Harorat oshgan sari spektr maksimumi qisqa to‘lqinlar tomon siljiydi: <b>λ<sub>max</sub>·T = b</b> (Vin qonuni). Hozir λ<sub>max</sub> ≈ ${fmt(P.lamMax(st.T), 2)} μm atrofida — grafikda maksimumni kursor bilan aniqlang.</p>`
    : `<p>Radiometr aperturadan chiqqan to‘liq (barcha to‘lqin uzunliklaridagi) nurlanish oqimini o‘lchaydi. Lambert manbai uchun E = εσ(T⁴ − T₀⁴)·a²/L².</p><p>Bir necha haroratda E ni yozing: ln E ning ln T ga bog‘liqligi qiyaligi <b>4</b> bo‘lgan to‘g‘ri chiziq (Stefan–Bolsman qonuni).</p>`;
  if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() { const t = st.mode === "spec" ? (st.scan ? "To‘xtatish" : "Spektrni skanerlash") : "Yozib olish"; if (actBtn.textContent !== t) actBtn.textContent = t; resetBtn.textContent = "Grafikni tozalash"; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateAction(); syncUI(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */
let uiT = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return; st.t += dt;
  const was = stable(); st.T += (st.Tset - st.T) * (1 - Math.exp(-dt / P.TAU)); if (Math.abs(st.T - st.Tset) < 0.3) st.T = st.Tset;
  if (st.scan) { if (!stable()) { /* kutadi */ } else { const n = Math.max(1, Math.round(dt / 0.012)); for (let i = 0; i < n && st.scan; i++) { setLam(st.lam + 0.02); if (st.lam >= P.LAM_RANGE[1] - 1e-9) st.scan = false; } } graph.render(); }
  stage.render(); if (!was && stable()) refresh();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updateReadouts(); updateStatus(); updateAction(); if (!st.scan) graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.addEventListener("click", () => loop.toggle());
function toggleScan() { if (st.scan) st.scan = false; else { st.lam = P.LAM_RANGE[0]; rec.spec[String(st.Tset)] = []; st.scan = true; if (!loop.running) loop.start(); } }
function recordRad() { if (!stable()) return false; const T = Tpyr(), E = Math.round(radE() * 100) / 100, i = rec.rad.findIndex((p) => p[0] === T); if (i >= 0) rec.rad[i] = [T, E]; else rec.rad.push([T, E]); rec.rad.sort((a, b) => a[0] - b[0]); save(); return true; }
actBtn.addEventListener("click", () => { if (st.mode === "spec") toggleScan(); else recordRad(); customized(); refresh(); });
resetBtn.addEventListener("click", () => { st.scan = false; if (st.mode === "spec") rec.spec = {}; else rec.rad = []; save(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */
const tIn = $("#pT"), tOut = $("#pTOut"), lIn = $("#pL"), lOut = $("#pLOut");
tIn.addEventListener("input", () => { setTset(+tIn.value); st.scan = false; customized(); refresh(); });
lIn.addEventListener("input", () => { st.scan = false; setLam(+lIn.value); customized(); refresh(); });
function syncUI() {
  if (+tIn.value !== st.Tset) tIn.value = st.Tset; tOut.textContent = `${st.Tset} K`;
  if (+lIn.value !== st.lam) lIn.value = st.lam; lOut.textContent = `${fmt(st.lam, 2)} μm`;
  document.querySelectorAll("[data-only]").forEach((el) => { el.hidden = el.dataset.only !== st.mode; });
}
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e, cv = canvas) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, q) => q && p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1;
function hit(p) {
  for (const q of geo.chips || []) if (inBox(p, q)) return { k: "chip", q };
  if (geo.knobT && Math.hypot(p.x - geo.knobT.x, p.y - geo.knobT.y) <= geo.knobT.r) return { k: "T" };
  if (st.mode === "spec" && geo.drumL && Math.hypot(p.x - geo.drumL.x, p.y - geo.drumL.y) <= geo.drumL.r + 6) return { k: "L" };
  if (st.mode === "spec" && inBox(p, geo.scale)) return { k: "scale" };
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hit(p); if (!h) return;
  if (h.k === "chip") { const q = h.q; if (q.k === "dT") { setTset(st.Tset + q.v); st.scan = false; } else if (q.k === "dL") { st.scan = false; setLam(st.lam + q.v); } else if (q.k === "scan") toggleScan(); else if (q.v === "rec") recordRad(); else if (q.v === "clr") { rec.rad = []; save(); } customized(); refresh(); return; }
  if (h.k === "scale") { st.scan = false; setLam(0.3 + ((p.x - geo.scale.x0) / (geo.scale.x1 - geo.scale.x0)) * 5.7); customized(); refresh(); return; }
  drag = h.k; dragY0 = p.y; dragV0 = h.k === "T" ? st.Tset : st.lam; st.scan = false; canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(e);
  if (!drag) { const h = hit(p); canvas.style.cursor = h ? (h.k === "chip" || h.k === "scale" ? "pointer" : "ns-resize") : ""; return; }
  if (drag === "T") setTset(dragV0 + (dragY0 - p.y) * 10); else setLam(dragV0 + (dragY0 - p.y) * 0.01);
  customized(); refresh();
});
const end = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
graph.canvas.addEventListener("pointermove", (e) => { const p = ptr(e, graph.canvas); st.cursor = st.mode === "spec" && geo.g && p.x >= geo.g.x0 && p.x <= geo.g.x1 ? p.x : null; graph.render(); });
graph.canvas.addEventListener("pointerleave", () => { st.cursor = null; graph.render(); });
graph.canvas.addEventListener("pointerdown", (e) => { const p = ptr(e, graph.canvas); for (const q of geo.gchips || []) if (inBox(p, q)) { st.norm = q.v; graph.render(); } });

/* ------------------------------------------------------------------ Rejim va tayyor tajribalar */
const MODE_HINT = { spec: "Isitgich, λ barabani yoki shkalani bosing; harorat barqarorlashishini kuting", rad: "Har bir barqaror haroratda E ni yozib oling" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === st.mode)));
  $("[data-mode-hint]").textContent = MODE_HINT[st.mode]; $("[data-graph-card]").hidden = false;
  $("[data-graph-title]").textContent = st.mode === "spec" ? "Qora jism spektri B_λ(λ)" : "Stefan–Bolsman: ln E — ln T";
  $("[data-formula]").innerHTML = st.mode === "spec" ? "<small>Vin</small> λ<sub>max</sub>·T = b" : "<small>Stefan–Bolsman</small> M = σT⁴";
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== st.mode) loadPreset(b.dataset.modeValue === "spec" ? "s2000" : "rad"); }));
const PRESETS = {
  s2000: { title: "Spektr: T = 2000 K", lesson: "Harorat barqarorlashgach «Spektrni skanerlash» ni bosing. Maksimum ≈ 1,45 μm — infraqizil sohada; ko‘rinadigan nur juda kichik ulush.", set: () => Object.assign(st, { mode: "spec", Tset: 2000, lam: 0.3 }) },
  s1200: { title: "Spektr: T = 1200 K", lesson: "Past haroratda maksimum ≈ 2,4 μm ga siljiydi, nurlanish ancha kuchsiz. «normallangan» ko‘rinishda spektrlarni solishtiring.", set: () => Object.assign(st, { mode: "spec", Tset: 1200, lam: 0.3 }) },
  s3000: { title: "Spektr: T = 3000 K", lesson: "Volfram lampa tolasi harorati. Maksimum ≈ 0,97 μm; ko‘rinadigan ulush ~ 10 %.", set: () => Object.assign(st, { mode: "spec", Tset: 3000, lam: 0.3 }) },
  rad: { title: "Radiometr: Stefan–Bolsman", lesson: "Haroratni 1000…3000 K oralig‘ida o‘zgartiring, har safar barqarorlashgach «Yozib olish» ni bosing. ln E — ln T grafigining qiyaligi 4 ga yaqin.", set: () => Object.assign(st, { mode: "rad", Tset: 1500 }) },
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.entries(PRESETS).map(([id, p]) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${p.title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPP = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPP(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id) {
  const p = PRESETS[id]; st.scan = false; p.set();
  setModeUI(); presetId = id; setPP(id); $("[data-lesson]").textContent = p.lesson;
  refresh(); if (!prefersReducedMotion()) loop.start(); else { st.T = st.Tset; loop.stop(); refresh(); }
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* */ }
}

/* ------------------------------------------------------------------ Laboratoriya daftari */
createNotebook($("[data-notebook]"), {
  key: "bb", docLabel: DOC_LABEL, site: SITE,
  intro: "Spektr rejimida turli haroratlar uchun maksimum to‘lqin uzunligini, radiometr rejimida to‘liq nurlanish oqimini o‘lchang. Ikkala topshiriq bajarilsa, Plank va Bolsman doimiylari ham hisoblanadi.",
  conclusionPh: "Vin va Stefan–Bolsman qonunlari bajarildimi? b, σ, n ning qiymatlari; h va k ni jadval qiymatlari bilan solishtiring.",
  hint: "Javob bering: 1) λ_max·T ko‘paytmasi o‘zgarmasmi? b ning qiymati. 2) ln E — ln T qiyaligi 4 ga yaqinmi? σ ning qiymati. 3) b va σ dan topilgan h va k jadvaldagi qiymatlarga qanchalik mos? 4) Nima uchun cho‘g‘lanma lampa nurlanishining katta qismi infraqizil?",
  fileBase: (nb) => `Qora-jism-lab-${translit(nb.f.name)}`,
  minTables: 1,
  tables: [
    { key: "t1", okLabel: "Vin (b)", need: "1-jadvalda kamida 3 xil T", title: "1-topshiriq. Vin siljish qonuni",
      desc: "Har bir harorat uchun spektrni yozing va maksimumga mos to‘lqin uzunligi λ<sub>max</sub> ni aniqlang (grafikda kursor bilan). Kamida 3 xil harorat.",
      head: ["T, K", "λ<sub>max</sub>, μm", "1/T, 10⁻³ K⁻¹", "λ<sub>max</sub>·T, mm·K", "Tekshiruv"], cols: [{ k: "T", kind: "num" }, { k: "lm", kind: "num" }], outs: ["inv", "b"],
      blank: (i) => ({ T: ["1200", "1600", "2000", "2400", "2800"][i] || "", lm: "" }), rows: 4, max: 10, narrow: true,
      parse: (r) => ({ T: num(r.T), lm: num(r.lm) }), check: L.check1, analyze: (rows) => L.analyze1(rows),
      out: (A, j) => { const r = A.rows[j]; return { inv: fmt(r.inv, 4), b: fmt(r.bi * 1000, 3) }; },
      match: L.match1, noMatch: "λ_max bu haroratda spektr maksimumidan ±2,5 % dan ko‘p farq qiladi",
      summary: (A) => (A.b ? [["b (EKK)", `${fmt(A.b * 1000, 4)} mm·K`, `farq ${fmt((100 * (A.b - P.B_WIEN)) / P.B_WIEN, 1)}%`]] : null),
      ok: (A) => A.ok && !!A.b },
    { key: "t2", okLabel: "Stefan–Bolsman (σ)", need: "2-jadvalda kamida 3 xil T", title: "2-topshiriq. Stefan–Bolsman qonuni",
      desc: `Radiometr rejimida har bir barqaror haroratda E ni yozing (a = ${fmt(P.A_AP * 1000, 0)} mm, L = ${fmt(P.L_RAD * 100, 0)} sm, ε = ${fmt(P.EPS, 2)}, T₀ = ${P.T0} K). Kamida 3 xil harorat.`,
      head: ["T, K", "E, W/m²", "T⁴ − T₀⁴, 10¹² K⁴", "σ<sub>i</sub>, 10⁻⁸ W/(m²K⁴)", "Tekshiruv"], cols: [{ k: "T", kind: "num" }, { k: "E", kind: "num" }], outs: ["X", "si"],
      blank: (i) => ({ T: ["1000", "1500", "2000", "2500", "3000"][i] || "", E: "" }), rows: 4, max: 12, narrow: true,
      parse: (r) => ({ T: num(r.T), E: num(r.E) }), check: L.check2, analyze: (rows) => L.analyze2(rows),
      out: (A, j) => { const r = A.rows[j]; return { X: fmt(r.X / 1e12, 4), si: fmt(r.si / 1e-8, 3) }; },
      match: L.match2, noMatch: "E bu harorat uchun radiometr ko‘rsatkichidan ±2 % dan ko‘p farq qiladi",
      summary: (A) => (A.sigma ? [["σ (EKK)", `${fmt(A.sigma / 1e-8, 3)}·10⁻⁸`, `farq ${fmt((100 * (A.sigma - P.SIGMA)) / P.SIGMA, 1)}%`], ...(A.n ? [["ln E — ln T qiyaligi", `n = ${fmt(A.n, 3)}`, "nazariyada 4"]] : [])] : null),
      ok: (A) => A.ok && !!A.sigma },
  ],
  build: (nb, res) => buildBBDoc(nb, res, Object.fromEntries(Object.entries(rec.spec).filter(([, v]) => v.length > 20).map(([k, v]) => [k, v.slice().sort((a, b) => a[0] - b[0])]))),
});

/* ------------------------------------------------------------------ Ishga tushirish */
setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
st.T = PRESETS[q] ? (q === "s1200" ? 1200 : q === "s3000" ? 3000 : q === "rad" ? 1500 : 2000) : 2000;
loadPreset(PRESETS[q] ? q : "s2000");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
