// ==========================================================================
// Kompton effekti — virtual laboratoriya (simulations/compton.html)
// 1) «Kalibrlash»: detektor oldiga Am-241, Ba-133, Na-22 yoki Cs-137 manbai qo‘yiladi, MCA spektridan cho‘qqi kanallari.
// 2) «Kompton sochilishi»: ¹³⁷Cs dastasi alyuminiy sochuvchida sochiladi, NaI detektor θ burchakda (sudraladi),
//    sochuvchini olib qo‘yish mumkin (fon). Spektr Puasson statistikasi bilan yig‘iladi (vaqt ×1/×10/×100).
// Grafik: MCA spektri (lin/log), ROI (sichqoncha bilan belgilanadi) — sentroid, net hisob, FWHM.
// Daftar: labnotebook.js; hisobot: compton-report.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { createStage, createLoop, prefersReducedMotion } from "./sim-kit.js";
import { DEG, SMALL, MID, BOLD, circle, tagIn, chipBtn, lcd, chipGrid, readouts, u, clamp, fmt } from "./labkit.js";
import * as P from "./compton-physics.js";
import * as L from "./compton-lab.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { buildComptonDoc, SITE, DOC_LABEL } from "./compton-report.js";

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const REC = "of-compton-rec-v1";
const rec = store.get(REC, {});
const R = P.rng((Date.now() % 99991) + 3);
const st = { mode: "scat", src: "Cs-137", th: 60, scat: true, run: false, speed: 10, t: 0, sp: new Float64Array(P.NCH), roi: null, log: false, cursor: null };
const geo = {};
let presetId = null, rate = null;
const key = () => (st.mode === "cal" ? `cal|${st.src}` : `${st.scat ? "s" : "b"}|${st.th}`);
function setup() { rate = st.mode === "cal" ? P.rateCal(st.src) : P.rateScatter(st.th, st.scat); }
function clearSp() { saveSp(); st.sp = new Float64Array(P.NCH); st.t = 0; }
function saveSp() {
  if (st.t < 30) return;
  const d = []; for (let i = 0; i < P.NCH; i += 4) d.push(st.sp[i] + st.sp[i + 1] + st.sp[i + 2] + st.sp[i + 3]);
  rec[key()] = { t: Math.round(st.t), d }; const ks = Object.keys(rec); if (ks.length > 10) delete rec[ks[0]];
  store.set(REC, rec);
}
function change(fn) { const k0 = key(); fn(); if (key() !== k0) { clearSp(); setup(); } }
setup();
const totalRate = () => rate.reduce((a, b) => a + b, 0);
const roiRes = () => (st.roi ? P.roi(st.sp, st.roi[0], st.roi[1]) : null);

/* ------------------------------------------------------------------ Sahna */
function draw(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, cw, ch);
  geo.chips = [];
  const area = narrow ? cw - 16 : cw * 0.58, sc = Math.min(area / 420, (narrow ? 250 : ch - 16) / 236);
  const cx = (narrow ? 8 : 8) + 200 * sc, cy = 8 + 186 * sc, Rarm = 130 * sc;
  geo.c = { x: cx, y: cy, R: Rarm };
  const lead = c.dark ? "#475569" : "#6b7280";
  // stol va burchak shkalasi
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.06)" : "rgba(148,163,184,0.12)"; circle(ctx, cx, cy, Rarm + 30 * sc); ctx.fill();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, Rarm + 22 * sc, -160 * DEG, 0); ctx.stroke();
  for (let a = 0; a <= 160; a += 5) { const an = -a * DEG, r1 = Rarm + 22 * sc, r2 = r1 - (a % 30 === 0 ? 9 : 4) * sc; ctx.strokeStyle = c.text3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); ctx.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); ctx.stroke(); if (a % 30 === 0) { ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${a}°`, cx + Math.cos(an) * (r1 + 11 * sc), cy + Math.sin(an) * (r1 + 9 * sc)); } }
  const cal = st.mode === "cal";
  // manba (qo‘rg‘oshin himoya)
  const sx = cx - 175 * sc;
  ctx.fillStyle = lead; ctx.fillRect(sx, cy - 30 * sc, 70 * sc, 60 * sc);
  ctx.fillStyle = c.dark ? "#1e293b" : "#374151"; ctx.fillRect(sx + 30 * sc, cy - 4 * sc, 40 * sc, 8 * sc);
  ctx.fillStyle = "#eab308"; circle(ctx, sx + 22 * sc, cy, 6 * sc); ctx.fill(); ctx.fillStyle = "#111"; ctx.font = "700 7px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("☢", sx + 22 * sc, cy + 0.5);
  if (cal) { ctx.fillStyle = "#991b1b"; ctx.fillRect(sx + 68 * sc, cy - 10 * sc, 6 * sc, 20 * sc); }
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(cal ? "¹³⁷Cs (yopiq)" : "¹³⁷Cs, kollimator", sx + 35 * sc, cy + 33 * sc);
  // dasta va sochuvchi
  if (!cal) {
    ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -(performance.now() / 40) % 11; ctx.beginPath(); ctx.moveTo(sx + 70 * sc, cy); ctx.lineTo(st.scat ? cx : cx + Rarm + 30 * sc, cy); ctx.stroke(); ctx.setLineDash([]);
    if (st.scat) { ctx.fillStyle = c.dark ? "#94a3b8" : "#cbd5e1"; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; circle(ctx, cx, cy, 9 * sc); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("Al sochuvchi", cx, cy + 13 * sc); }
    else { ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); circle(ctx, cx, cy, 9 * sc); ctx.stroke(); ctx.setLineDash([]); }
  }
  // detektor qo‘li
  const thv = cal ? 90 : st.th, an = -thv * DEG, ca = Math.cos(an), sa = Math.sin(an), nx = -sa, ny = ca;
  const at = (r, w) => [cx + ca * r * sc + nx * w * sc, cy + sa * r * sc + ny * w * sc];
  ctx.strokeStyle = c.text3; ctx.lineWidth = 6 * sc; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...at(150, 0)); ctx.stroke(); ctx.lineCap = "butt";
  if (!cal && st.scat) { ctx.strokeStyle = "rgba(234,88,12,0.75)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -(performance.now() / 40) % 8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...at(88, 0)); ctx.stroke(); ctx.setLineDash([]); }
  const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); };
  poly([at(88, -15), at(98, -15), at(98, 15), at(88, 15)], lead); // qo‘rg‘oshin yoqa
  poly([at(98, -11), at(126, -11), at(126, 11), at(98, 11)], c.dark ? "#cbd5e1" : "#e2e8f0"); // NaI
  poly([at(126, -9), at(160, -9), at(160, 9), at(126, 9)], c.dark ? "#334155" : "#1f2937"); // FEK
  const [lx, ly] = at(143, 0); ctx.save(); ctx.translate(lx, ly); ctx.rotate(an + (thv > 90 ? Math.PI : 0)); ctx.fillStyle = "#e2e8f0"; ctx.font = "700 8px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FEK", 0, 0.5); ctx.restore();
  const [nx2, ny2] = at(112, 0); ctx.save(); ctx.translate(nx2, ny2); ctx.rotate(an + (thv > 90 ? Math.PI : 0)); ctx.fillStyle = "#334155"; ctx.font = "700 8px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("NaI", 0, 0.5); ctx.restore();
  geo.det = cal ? null : at(115, 0);
  if (cal) { const [px, py] = at(78, 0); ctx.fillStyle = "#eab308"; circle(ctx, px, py, 8 * sc); ctx.fill(); ctx.fillStyle = "#111"; ctx.font = "700 8px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("☢", px, py + 0.5); tagIn(ctx, st.src, px - 46 * sc, py, cw, { color: c.text, bg: c.bg2, align: "center", font: BOLD, pad: 5 }); }
  else tagIn(ctx, `θ = ${fmt(st.th, 1)}°`, ...at(70, -28), cw, { color: c.primary, bg: c.bg, align: "center", font: BOLD, pad: 5 });
  if (!cal && st.th < 9) tagIn(ctx, "Detektorga to‘g‘ridan-to‘g‘ri dasta tushmoqda!", cx, 10, cw, { color: c.danger, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  // asboblar
  const items = cal ? Object.keys(P.SOURCES).map((s) => [s, s]) : [["θ −10°", -10], ["−1°", -1], ["−0,5°", -0.5], ["+0,5°", 0.5], ["+1°", 1], ["θ +10°", 10]];
  if (narrow) {
    const y0 = cy + 48 * sc;
    lcd(ctx, 8, y0, (cw - 24) / 3, 44, "VAQT, s", fmt(st.t, 0), "", "#e2e8f0"); lcd(ctx, 12 + (cw - 24) / 3, y0, (cw - 24) / 3, 44, "TEZLIK, 1/s", fmt(totalRate(), 1), "", "#60a5fa"); lcd(ctx, 16 + (2 * (cw - 24)) / 3, y0, (cw - 24) / 3, 44, cal ? "MANBA" : "θ, °", cal ? st.src.split("-")[1] : fmt(st.th, 1), "", "#4ade80");
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 50, cw - 16, items, cal ? 4 : 6, 26, 4, (v) => v === st.src).map((q) => ({ ...q, k: cal ? "src" : "dth" })));
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 80, cw - 16, [[st.run ? "■ Stop" : "▶ Yig‘ish", "run"], ["Tozalash", "clr"], [`×${st.speed}`, "spd"], ...(cal ? [] : [[st.scat ? "Sochuvchi ✓" : "Sochuvchi ✗", "scat"]])], cal ? 3 : 4, 26, 4, (v) => (v === "run" && st.run) || (v === "scat" && st.scat)).map((q) => ({ ...q, k: "act" })));
    return;
  }
  const rx = 8 + area + 14, rw = cw - rx - 10;
  lcd(ctx, rx, 10, rw, 46, cal ? "KALIBRLASH MANBAI" : "DETEKTOR BURChAGI θ", cal ? st.src : fmt(st.th, 1), cal ? "" : "°", "#4ade80");
  lcd(ctx, rx, 62, rw / 2 - 3, 46, "VAQT, s", fmt(st.t, 0), "", "#e2e8f0"); lcd(ctx, rx + rw / 2 + 3, 62, rw / 2 - 3, 46, "TEZLIK, 1/s", fmt(totalRate(), 1), "", "#60a5fa");
  geo.chips.push(...chipGrid(ctx, c, rx, 116, rw, items, cal ? 2 : 3, 24, 4, (v) => v === st.src).map((q) => ({ ...q, k: cal ? "src" : "dth" })));
  geo.chips.push(...chipGrid(ctx, c, rx, 176, rw, [[st.run ? "■ To‘xtatish" : "▶ Spektrni yig‘ish", "run"], ["Tozalash", "clr"]], 2, 28, 4, (v) => v === "run" && st.run).map((q) => ({ ...q, k: "act" })));
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Vaqt tezligi", rx, 224);
  geo.chips.push(...chipGrid(ctx, c, rx, 230, rw, [["×1", 1], ["×10", 10], ["×100", 100]], 3, 24, 4, (v) => v === st.speed).map((q) => ({ ...q, k: "speed" })));
  if (!cal) geo.chips.push(...chipGrid(ctx, c, rx, 262, rw, [[st.scat ? "Sochuvchi: o‘rnatilgan" : "Sochuvchi: olingan (fon)", "scat"]], 1, 26, 4, () => !st.scat).map((q) => ({ ...q, k: "act" })));
}
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? Math.round(8 + 234 * Math.min((cw - 16) / 420, 250 / 236) + 116) : Math.round(clamp(Math.min(cw * 0.46, (window.innerHeight || 800) * 0.46), 300, 340))) });

/* ------------------------------------------------------------------ MCA grafigi */
function drawGraph(ctx, G) {
  const { w, h, colors: c } = G; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const x0 = 54, x1 = w - 12, y0 = 16, y1 = h - 30, sp = st.sp;
  let mx = 10; for (let i = 6; i < P.NCH; i++) mx = Math.max(mx, sp[i]);
  const ymax = st.log ? Math.log10(mx * 2) : mx * 1.12, X = (chn) => x0 + (chn / P.NCH) * (x1 - x0), Y = (v) => (st.log ? y1 - (Math.log10(Math.max(v, 0.5)) - Math.log10(0.5)) / (ymax - Math.log10(0.5)) * (y1 - y0) : y1 - (v / ymax) * (y1 - y0));
  geo.g = { x0, x1, y0, y1, X, inv: (px) => ((px - x0) / (x1 - x0)) * P.NCH };
  ctx.font = SMALL; ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3;
  for (let k = 0; k <= 1024; k += 128) { ctx.beginPath(); ctx.moveTo(X(k), y0); ctx.lineTo(X(k), y1); ctx.stroke(); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(String(k), X(k), y1 + 5); }
  if (st.log) { for (let e = 0; 10 ** e <= mx * 2; e++) { ctx.beginPath(); ctx.moveTo(x0, Y(10 ** e)); ctx.lineTo(x1, Y(10 ** e)); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(e < 4 ? String(10 ** e) : `10^${e}`, x0 - 5, Y(10 ** e)); } }
  else { const stp = 10 ** Math.floor(Math.log10(ymax / 4)) * ([1, 2, 5].find((m) => ymax / (10 ** Math.floor(Math.log10(ymax / 4)) * m) <= 6) || 10); for (let v = 0; v <= ymax; v += stp) { ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(fmt(v, 0), x0 - 5, Y(v)); } }
  ctx.strokeStyle = c.borderStrong; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("hisoblar N", x0 + 4, y0 + 2); ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("kanal", x1 - 4, y1 - 3);
  // ROI
  const rr = roiRes();
  if (st.roi) { const [a, b] = st.roi; ctx.fillStyle = c.dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.10)"; ctx.fillRect(X(Math.min(a, b)), y0, X(Math.max(a, b)) - X(Math.min(a, b)), y1 - y0); ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; [a, b].forEach((q) => { ctx.beginPath(); ctx.moveTo(X(q), y0); ctx.lineTo(X(q), y1); ctx.stroke(); }); }
  // spektr
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  ctx.fillStyle = c.dark ? "rgba(52,211,153,0.35)" : "rgba(5,150,105,0.25)"; ctx.strokeStyle = c.dark ? "#34d399" : "#047857"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(0), y1); for (let i = 0; i < P.NCH; i++) ctx.lineTo(X(i + 0.5), Y(sp[i])); ctx.lineTo(X(P.NCH), y1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); for (let i = 0; i < P.NCH; i++) (i ? ctx.lineTo(X(i + 0.5), Y(sp[i])) : ctx.moveTo(X(0.5), Y(sp[i]))); ctx.stroke();
  if (rr) { ctx.strokeStyle = c.danger; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(rr.c), y0); ctx.lineTo(X(rr.c), y1); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  geo.gchips = chipGrid(ctx, c, x1 - 120, y0 + 4, 116, [["lin", false], ["log", true]], 2, 22, 4, (v) => v === st.log);
  if (rr) tagIn(ctx, `ROI ${Math.round(Math.min(...st.roi))}…${Math.round(Math.max(...st.roi))} · sentroid ${fmt(rr.c, 1)} ± ${fmt(rr.sc, 1)} · net ${fmt(rr.net, 0)} · FWHM ${fmt(rr.fwhm, 1)} kan.`, x0 + 6, y0 + 22, w - 130, { color: c.text, bg: c.bg2, align: "left", font: BOLD, pad: 6 });
  else if (st.t > 0) tagIn(ctx, w < 520 ? "ROI: cho‘qqini bosib suring" : "Cho‘qqini sichqoncha bilan belgilang (ROI): bosib, suring", x0 + 6, y0 + 22, w - 130, { color: c.text2, bg: c.bg2, align: "left", font: MID, pad: 6 });
  if (st.cursor !== null) { const k = clamp(Math.floor(geo.g.inv(st.cursor)), 0, P.NCH - 1); tagIn(ctx, `kanal ${k}: ${fmt(sp[k], 0)}`, st.cursor + 8, y1 - 30, w, { color: c.text2, bg: c.bg, align: "left", font: SMALL, pad: 4 }); }
  if (st.t === 0) { ctx.fillStyle = c.text3; ctx.font = MID; ctx.textAlign = "center"; ctx.fillText("«Spektrni yig‘ish» ni bosing", (x0 + x1) / 2, (y0 + y1) / 2); }
}
const graph = createStage($("#graph"), drawGraph, { height: (cw) => Math.round(clamp(((window.innerHeight || 800) * 0.34), 220, 300)) });

/* ------------------------------------------------------------------ Natijalar */
const setRO = readouts($("[data-readouts]"));
function updateReadouts() {
  const rr = roiRes();
  setRO("r1", st.mode === "cal" ? "Manba" : "Burchak <i>θ</i>", st.mode === "cal" ? st.src : u(fmt(st.th, 1), "°"), st.mode === "cal" ? "detektor oldida" : st.scat ? "sochuvchi o‘rnatilgan" : "fon (sochuvchisiz)");
  setRO("r2", "O‘lchash vaqti", u(fmt(st.t, 0), "s"), st.run ? `yig‘ilmoqda ×${st.speed}` : "to‘xtatilgan", st.run ? "green" : "");
  setRO("r3", "Hisob tezligi", u(fmt(totalRate(), 1), "1/s"), "barcha kanallar");
  setRO("r4", "ROI sentroidi", rr ? u(fmt(rr.c, 1), "kanal") : "—", rr ? `± ${fmt(rr.sc, 2)} kanal` : "cho‘qqini belgilang");
  setRO("r5", "ROI net hisob", rr ? fmt(rr.net, 0) : "—", rr ? `fon ayirilgan (yalpi ${fmt(rr.gross, 0)})` : "");
  setRO("r6", "Cho‘qqi kengligi", rr ? u(fmt(rr.fwhm, 1), "kanal") : "—", rr ? `FWHM, ${fmt((100 * rr.fwhm) / rr.c, 1)} %` : "");
}
function updateStatus() { const el = $("[data-status]"), t = st.run ? `Yig‘ilmoqda: ${fmt(st.t, 0)} s` : st.t ? `Spektr: ${fmt(st.t, 0)} s` : "Tayyor"; if (el.textContent !== t) el.textContent = t; el.dataset.tone = st.run ? "green" : "blue"; }
let lastEx = "";
function updateExplain() {
  const html = st.mode === "cal"
    ? `<p>Ko‘p kanalli analizator detektordagi har bir impulsni uning amplitudasiga (γ-kvant energiyasiga proporsional) mos kanalga yozadi. Energiyalari ma’lum chiziqlar cho‘qqilarining kanallarini topib, <b>E = a + b·kanal</b> kalibrovka chizig‘ini quring.</p><p>Spektrda fotopikdan tashqari Kompton kontinuumi va uning qirrasi, orqaga sochilish cho‘qqisi ham bor — kalibrlash uchun faqat fotopiklardan foydalaning.</p>`
    : `<p>γ-kvant erkin elektronda sochilganda energiyasining bir qismini elektronga beradi: <b>E′ = E₀/(1 + (E₀/mₑc²)(1 − cos θ))</b>. Klassik to‘lqin nazariyasida sochilgan nurning chastotasi o‘zgarmasligi kerak edi.</p><p>Har bir burchakda sochilgan fotopikni ROI bilan belgilab, sentroid kanalini yozing. Spektrda himoyadan sizib chiqqan 662 keV cho‘qqisi ham bor — sochuvchini olib qo‘yib, qaysi cho‘qqi sochilishga tegishli ekanini tekshiring.</p>`;
  if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() { const t = st.run ? "To‘xtatish" : "Spektrni yig‘ish"; if (actBtn.textContent !== t) actBtn.textContent = t; resetBtn.textContent = "Spektrni tozalash"; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateAction(); syncUI(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */
let uiT = 0, gT = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (st.run) { const T = Math.min(dt, 0.1) * st.speed; for (let i = 0; i < P.NCH; i++) st.sp[i] += P.poisson(rate[i] * T, R); st.t += T; gT += dt; if (gT > 0.1) { gT = 0; graph.render(); } }
  stage.render();
  uiT += dt; if (uiT > 0.2) { uiT = 0; updateReadouts(); updateStatus(); updateAction(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.addEventListener("click", () => loop.toggle());
const toggleRun = () => { st.run = !st.run; if (!st.run) saveSp(); if (st.run && !loop.running) loop.start(); };
actBtn.addEventListener("click", () => { toggleRun(); refresh(); });
resetBtn.addEventListener("click", () => { st.sp = new Float64Array(P.NCH); st.t = 0; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */
const thIn = $("#pTh"), thOut = $("#pThOut");
thIn.addEventListener("input", () => { change(() => { st.th = clamp(Math.round(+thIn.value * 2) / 2, 0, 150); }); customized(); refresh(); });
$("[data-srcset]").innerHTML = Object.keys(P.SOURCES).map((s) => `<button type="button" data-src="${s}">${s}</button>`).join("");
$("[data-srcset]").addEventListener("click", (e) => { const b = e.target.closest("[data-src]"); if (b) { change(() => { st.src = b.dataset.src; }); customized(); refresh(); } });
function syncUI() {
  if (+thIn.value !== st.th) thIn.value = st.th; thOut.textContent = `${fmt(st.th, 1)}°`;
  document.querySelectorAll("[data-src]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.src === st.src)));
  document.querySelectorAll("[data-only]").forEach((el) => { el.hidden = el.dataset.only !== st.mode; });
}
const canvas = stage.canvas;
let drag = null;
const ptr = (e, cv = canvas) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, q) => q && p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1;
const angleAt = (p) => clamp(Math.round((Math.atan2(geo.c.y - p.y, p.x - geo.c.x) / DEG) * 2) / 2, 0, 150);
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e);
  for (const q of geo.chips || []) if (inBox(p, q)) {
    if (q.k === "dth") change(() => { st.th = clamp(st.th + q.v, 0, 150); }); else if (q.k === "src") change(() => { st.src = q.v; }); else if (q.k === "speed") st.speed = q.v;
    else if (q.v === "run") toggleRun(); else if (q.v === "clr") { st.sp = new Float64Array(P.NCH); st.t = 0; } else if (q.v === "spd") st.speed = st.speed === 1 ? 10 : st.speed === 10 ? 100 : 1; else if (q.v === "scat") change(() => { st.scat = !st.scat; });
    customized(); refresh(); return;
  }
  if (st.mode === "scat" && geo.det && Math.hypot(p.x - geo.det[0], p.y - geo.det[1]) < 40) { drag = "det"; canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault(); }
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(e);
  if (!drag) { const over = (geo.chips || []).some((q) => inBox(p, q)); const onDet = st.mode === "scat" && geo.det && Math.hypot(p.x - geo.det[0], p.y - geo.det[1]) < 40; canvas.style.cursor = over ? "pointer" : onDet ? "grab" : ""; return; }
  const a = angleAt(p); if (a !== st.th) { change(() => { st.th = a; }); customized(); refresh(); }
});
const end = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
// ROI: grafikda bosib suriladi; marker yonida — markerni suradi
let gdrag = null;
const gc = graph.canvas;
gc.addEventListener("pointerdown", (e) => {
  const p = ptr(e, gc);
  for (const q of geo.gchips || []) if (inBox(p, q)) { st.log = q.v; graph.render(); return; }
  if (!geo.g || p.x < geo.g.x0 || p.x > geo.g.x1 || p.y < geo.g.y0 || p.y > geo.g.y1) return;
  const chn = clamp(geo.g.inv(p.x), 0, P.NCH - 1);
  if (st.roi) { const i = [0, 1].find((j) => Math.abs(geo.g.X(st.roi[j]) - p.x) < 7); if (i !== undefined) { gdrag = i; try { gc.setPointerCapture(e.pointerId); } catch { /* */ } return; } }
  st.roi = [chn, chn]; gdrag = 1; try { gc.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault();
});
gc.addEventListener("pointermove", (e) => {
  const p = ptr(e, gc); st.cursor = geo.g && p.x >= geo.g.x0 && p.x <= geo.g.x1 ? p.x : null;
  if (gdrag !== null && st.roi) st.roi[gdrag] = clamp(Math.round(geo.g.inv(p.x)), 0, P.NCH - 1);
  gc.style.cursor = st.roi && [0, 1].some((j) => Math.abs(geo.g.X(st.roi[j]) - p.x) < 7) ? "ew-resize" : "crosshair";
  graph.render(); if (gdrag !== null) updateReadouts();
});
const gend = () => { if (gdrag !== null && st.roi && Math.abs(st.roi[0] - st.roi[1]) < 4) st.roi = null; gdrag = null; updateReadouts(); graph.render(); };
gc.addEventListener("pointerup", gend); gc.addEventListener("pointercancel", gend); gc.addEventListener("pointerleave", () => { st.cursor = null; graph.render(); });

/* ------------------------------------------------------------------ Rejim va tayyor tajribalar */
const MODE_HINT = { cal: "Manbani tanlang, spektrni yig‘ing, fotopikni ROI bilan belgilang", scat: "Detektorni sudrab θ ni o‘zgartiring; spektrni yig‘ib, cho‘qqini ROI bilan belgilang" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === st.mode)));
  $("[data-mode-hint]").textContent = MODE_HINT[st.mode]; $("[data-graph-card]").hidden = false;
  $("[data-formula]").innerHTML = st.mode === "cal" ? "<small>Kalibrlash</small> E = a + b·kanal" : "<small>Kompton</small> 1/E′ − 1/E₀ = (1 − cos θ)/mₑc²";
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== st.mode) loadPreset(b.dataset.modeValue === "cal" ? "calCs" : "s60"); }));
const PRESETS = {
  calCs: { title: "Kalibrlash: Cs-137", lesson: "662 keV fotopik ≈ 820-kanal atrofida, chapda Kompton qirrasi (477 keV) va orqaga sochilish cho‘qqisi (184 keV), 32 keV rentgen chizig‘i. Fotopikni ROI bilan belgilang.", set: () => Object.assign(st, { mode: "cal", src: "Cs-137" }) },
  calBa: { title: "Kalibrlash: Ba-133", lesson: "Ba-133 bir nechta chiziq beradi: 81, 303, 356 keV. Uchala cho‘qqi ham kalibrlash uchun yaroqli.", set: () => Object.assign(st, { mode: "cal", src: "Ba-133" }) },
  s60: { title: "Sochilish: θ = 60°", lesson: "Sochilgan fotopik ≈ 400 keV. O‘ngdagi kichik 662 keV cho‘qqi — himoyadan sizib chiqqan nurlanish. Sochuvchini olib qo‘yib tekshiring.", set: () => Object.assign(st, { mode: "scat", th: 60, scat: true }) },
  s120: { title: "Sochilish: θ = 120°", lesson: "Katta burchakda E′ ≈ 225 keV ga tushadi — orqaga sochilish chegarasi E₀/(1 + 2E₀/mₑc²) ≈ 184 keV ga yaqinlashadi.", set: () => Object.assign(st, { mode: "scat", th: 120, scat: true }) },
  bg: { title: "Fon: sochuvchisiz", lesson: "Sochuvchi olinganda sochilgan cho‘qqi yo‘qoladi, qolgani — fon va himoyadan sizib chiqish.", set: () => Object.assign(st, { mode: "scat", th: 60, scat: false }) },
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.entries(PRESETS).map(([id, p]) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${p.title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPP = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPP(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id) {
  const p = PRESETS[id]; change(() => p.set()); setup(); st.roi = null;
  setModeUI(); presetId = id; setPP(id); $("[data-lesson]").textContent = p.lesson;
  refresh(); if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* */ }
}

/* ------------------------------------------------------------------ Laboratoriya daftari */
const calOpts = [["", "— chiziq —"], ...P.CAL.map((q) => [q.id, `${q.src}: ${fmt(q.E, 2)} keV`])];
createNotebook($("[data-notebook]"), {
  key: "compton", docLabel: DOC_LABEL, site: SITE,
  intro: "Avval analizatorni kalibrlang (kamida 3 ta chiziq), so‘ng turli burchaklarda sochilgan γ-kvantlar cho‘qqisining kanalini yozing. Energiyalar kalibrovka bo‘yicha avtomatik hisoblanadi.",
  conclusionPh: "Sochilgan γ-kvant energiyasi burchakka qanday bog‘liq? Topilgan mₑc² va λ_C jadval qiymatlariga mosmi? Natija fotonning zarra xossasini tasdiqlaydimi?",
  hint: "Javob bering: 1) 1/E′ ning (1 − cos θ) ga bog‘liqligi chiziqlimi? 2) mₑc² va E₀ ning qiymatlari va xatoliklari. 3) Kompton to‘lqin uzunligi λ_C = h/(mₑc). 4) Nima uchun klassik elektrodinamika bu natijani tushuntira olmaydi?",
  fileBase: (nb) => `Kompton-lab-${translit(nb.f.name)}`,
  minTables: 2,
  tables: [
    { key: "t1", req: true, okLabel: "Kalibrlash", need: "1-jadvalda kamida 3 ta chiziq", title: "1-topshiriq. Analizatorni energiya bo‘yicha kalibrlash",
      desc: "«Kalibrlash» rejimida manbalar spektrini yig‘ing va fotopiklar sentroidini (ROI) yozing. Kamida 3 ta turli chiziq.",
      head: ["γ-chiziq", "Kanal", "E, keV", "Qoldiq, keV", "Tekshiruv"], cols: [{ k: "line", kind: "sel", opts: calOpts }, { k: "ch", kind: "num" }], outs: ["E", "res"],
      blank: (i) => ({ line: ["am", "ba356", "na511", "cs662"][i] || "", ch: "" }), rows: 4, max: 10, narrow: true,
      parse: (r) => ({ line: r.line, ch: num(r.ch) }), check: L.check1, analyze: (rows) => L.analyze1(rows),
      out: (A, j) => { const r = A.rows[j]; return { E: fmt(r.E, 2), res: r.res !== undefined ? fmt(r.res, 2) : "—" }; },
      match: L.match1, noMatch: "Bu chiziqning fotopiki boshqa kanalda",
      summary: (A) => (A.fit ? [["E = a + b·kanal", `a = ${fmt(A.fit.a, 2)} keV`, `b = ${fmt(A.fit.b, 4)} keV/kanal`]] : null),
      ok: (A) => A.ok && !!A.fit },
    { key: "t2", req: true, okLabel: "E′(θ)", need: "2-jadvalda kamida 4 xil burchak", title: "2-topshiriq. Sochilgan γ-kvantlar energiyasining burchakka bog‘liqligi",
      desc: "«Kompton sochilishi» rejimida har bir burchak uchun sochilgan fotopik sentroidini yozing. Kamida 4 xil burchak (masalan 30°…150°).",
      head: ["θ, °", "Kanal", "E′, keV", "1 − cos θ", "1/E′, 10⁻³ keV⁻¹", "E′<sub>naz</sub>, keV", "Tekshiruv"], cols: [{ k: "th", kind: "num" }, { k: "ch", kind: "num" }], outs: ["E", "x", "inv", "Eth"],
      blank: (i) => ({ th: ["30", "60", "90", "120", "150"][i] || "", ch: "" }), rows: 5, max: 14,
      parse: (r) => ({ th: num(r.th), ch: num(r.ch) }), check: L.check2, analyze: (rows, c, res) => L.analyze2(rows, res?.t1?.ok ? res.t1.A.fit : null),
      out: (A, j) => { const r = A.rows[j]; return A.noCal ? { E: "kalibrovka?", x: "", inv: "", Eth: "" } : { E: fmt(r.E, 1), x: fmt(r.x, 4), inv: fmt(r.inv * 1000, 4), Eth: fmt(r.Eth, 1) }; },
      match: L.match2, noMatch: "Bu burchakda sochilgan fotopik boshqa kanalda",
      summary: (A) => (A.noCal ? [["Avval kalibrlang", "1-jadval", ""]] : A.fit ? [["mₑc²", `${fmt(A.mc2, 1)} keV`, `farq ${fmt((100 * (A.mc2 - P.MEC2)) / P.MEC2, 1)}%`], ["E₀", `${fmt(A.E0, 1)} keV`, "jadvalda 661,7"], ["λ_C", `${fmt(A.lc, 3)} pm`, "jadvalda 2,426 pm"]] : null),
      ok: (A) => A.ok && !!A.fit },
  ],
  build: (nb, res) => buildComptonDoc(nb, res, rec),
});

/* ------------------------------------------------------------------ Ishga tushirish */
setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
setup(); loadPreset(PRESETS[q] ? q : "s60");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
