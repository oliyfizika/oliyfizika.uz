// ==========================================================================
// Yorug'lik interferensiyasi va difraksiyasi — virtual laboratoriya (simulations/diffraction.html)
// 1) Yung tajribasi: ikki tirqish (suriladi), ekran (suriladi), oq yorug'lik, bitta tirqishni yopish.
// 2) Tirqish va doira teshik: markaziy maksimum, Eyri halqalari.
// 3) Difraksion panjara: spektr tartiblari, oq yorug'lik spektri, lab — noma'lum lazer λ sini o'lchash.
// Yon ko'rinish — sxematik (vertikal masshtab kattalashtirilgan), ekran ko'rinishi va grafiklar — haqiqiy.
// Fizika: diffraction-physics.js (Node'da tekshirilgan). Grafiklar: diffraction-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as D from "./diffraction-physics.js";
import * as G from "./diffraction-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "young", tab: "I", t: 0 };
const st = { lam: 532, L: 1, white: false, closed: false, d: 0.25, a: 0.05, shape: "slit", sa: 0.1, N: 300, unknown: false, revealed: false, lamHidden: 633, marker: 0, pts: [] };
let presetId = null;
const HIDDEN = [450, 488, 532, 589, 633, 650];

const lamNm = () => (ui.mode === "grating" && st.unknown ? st.lamHidden : st.lam);
const lamM = () => lamNm() * 1e-9;
const Ymax = () => (ui.mode === "young" ? 0.012 : ui.mode === "slit" ? 0.025 : 1.2);
const unit = () => (ui.mode === "grating" ? "cm" : "mm");
const dGr = () => 1e-3 / st.N;
const gam = () => (ui.mode === "grating" ? 0.4 : 0.6);
const hiddenLam = () => ui.mode === "grating" && st.unknown && !st.revealed;

/** Bitta to'lqin uzunligi uchun intensivlik Y nuqtada (m). */
function Ilam(lam, Y, Z = 0) {
  const L = st.L;
  if (ui.mode === "young") return D.youngI(D.sinTheta(Y, L), lam, st.d * 1e-3, st.a * 1e-3, st.closed);
  if (ui.mode === "slit") {
    if (st.shape === "round") return D.slitI(D.sinTheta(Math.hypot(Y, Z), L), lam, st.sa * 1e-3, true);
    return D.slitI(D.sinTheta(Y, L), lam, st.sa * 1e-3);
  }
  return D.gratingI(D.sinTheta(Y, L), lam, dGr(), dGr() / 3, 12);
}
/** Ekran nuqtasi: { I, rgb } (oq yorug'likda — ranglar yig'indisi). */
function sample(Y, Z = 0) {
  if (st.white) { const c = D.whiteRGB((l) => Ilam(l, Y, Z)); return { I: (c[0] + c[1] + c[2]) / 3, rgb: c }; }
  const I = Ilam(lamM(), Y, Z), c = D.waveRGB(lamNm());
  return { I, rgb: [c[0] * I, c[1] * I, c[2] * I] };
}

/** Kesh: ekran bo'ylab taqsimot (±1,6·Ymax, 801 nuqta) — parametrlar o'zgarganda qayta hisoblanadi. */
let binsCache = { key: "", bins: null };
const NB = 4000;
function bins() {
  const key = JSON.stringify([ui.mode, st.lam, st.L, st.white, st.closed, st.d, st.a, st.shape, st.sa, st.N, st.unknown, st.lamHidden]);
  if (binsCache.key !== key) {
    const arr = []; for (let i = 0; i <= NB; i++) arr.push(sample((i / NB * 2 - 1) * 1.6 * Ymax()));
    binsCache = { key, bins: arr, front: null };
  }
  return binsCache;
}
function lookup(Y) { const b = bins().bins, x = ((Y / (1.6 * Ymax())) + 1) / 2 * NB; if (x < 0 || x > NB) return { I: 0, rgb: [0, 0, 0] }; return b[Math.round(x)]; }

/* ------------------------------------------------------------------ Geometriya (px) */

const g = {};
function layout(cw, ch) {
  const narrow = cw < 560, fw = narrow ? cw * 0.3 : cw * 0.3;
  const aw = cw - fw - 16, yc = ch / 2, Hs = ch * 0.42;
  const xb = Math.max(70, aw * 0.22), xs = xb + 34 + Math.sqrt(clamp((st.L - 0.2) / 2.3, 0, 1)) * (aw - xb - 48);
  Object.assign(g, { narrow, aw, fw, yc, Hs, xb, xs, fx0: cw - fw - 6, fx1: cw - 8 });
  return g;
}
const Yof = (py) => ((g.yc - py) / g.Hs) * Ymax(); // ekran px → Y (m)
const pyOf = (Y) => g.yc - (Y / Ymax()) * g.Hs;
function openings() {
  if (ui.mode === "young") { const dp = 18 + ((st.d - 0.1) / 0.9) * 80, ap = 3 + ((st.a - 0.02) / 0.08) * 7; return st.closed ? [{ y: g.yc - dp / 2, h: ap }] : [{ y: g.yc - dp / 2, h: ap }, { y: g.yc + dp / 2, h: ap }]; }
  if (ui.mode === "slit") return [{ y: g.yc, h: 4 + ((st.sa - 0.02) / 0.48) * 56 }];
  return null;
}

/* ------------------------------------------------------------------ Chizish */

let field = null, front = null;
const rgbCss = (c, a = 1) => `rgba(${Math.round(255 * clamp(c[0], 0, 1))},${Math.round(255 * clamp(c[1], 0, 1))},${Math.round(255 * clamp(c[2], 0, 1))},${a})`;
function draw(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  layout(cw, ch);
  ctx.fillStyle = c.dark ? "#020617" : "#0f172a"; ctx.fillRect(0, 0, g.aw, ch);
  const beamC = st.white ? [1, 1, 1] : D.waveRGB(lamNm());
  // lazer va dasta
  const beamH = 46;
  ctx.fillStyle = "#334155"; ctx.fillRect(8, g.yc - 14, 34, 28); ctx.fillStyle = rgbCss(beamC); ctx.fillRect(40, g.yc - 4, 4, 8);
  ctx.fillStyle = rgbCss(beamC, 0.22); ctx.fillRect(44, g.yc - beamH / 2, g.xb - 44, beamH);
  const lv = 12 * (lamNm() / 550), ph = (ui.t * 40) % lv;
  ctx.strokeStyle = rgbCss(beamC, 0.6); ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = 44 + ph; x < g.xb; x += lv) { ctx.moveTo(x, g.yc - beamH / 2); ctx.lineTo(x, g.yc + beamH / 2); }
  ctx.stroke();
  // to'siq ortidagi maydon (ekrandagi taqsimotga mos yelpig'ich)
  const fx = g.xb + 2, fwid = Math.max(10, g.xs - fx), gw = Math.max(40, Math.round(fwid / 4)), gh = Math.round(ch / 4);
  if (!field || field.width !== gw || field.height !== gh) { field = document.createElement("canvas"); field.width = gw; field.height = gh; }
  const fctx = field.getContext("2d"), img = fctx.createImageData(gw, gh);
  const kv = TAU / lv;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = fx + ((i + 0.5) * fwid) / gw, y = ((j + 0.5) * ch) / gh;
    const Y = ((g.yc - y) / (x - g.xb)) * (g.xs - g.xb) / g.Hs * Ymax();
    if (Math.abs(Y) > Ymax() * 1.6) continue;
    const s = lookup(Y);
    const r = Math.hypot(x - g.xb, y - g.yc), wave = 0.72 + 0.28 * Math.cos(kv * r - ui.t * 40 * kv);
    const fade = 0.35 + 0.65 * Math.min(1, (x - g.xb) / 40);
    const p = (j * gw + i) * 4, m = Math.pow(clamp(s.I, 0, 1), gam()) * wave * fade * 0.85, rgb = s.rgb, iI = Math.max(1e-6, s.I);
    img.data[p] = 255 * clamp(rgb[0] / iI * m, 0, 1); img.data[p + 1] = 255 * clamp(rgb[1] / iI * m, 0, 1); img.data[p + 2] = 255 * clamp(rgb[2] / iI * m, 0, 1); img.data[p + 3] = 255;
  }
  fctx.putImageData(img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = "lighter"; ctx.drawImage(field, fx, 0, fwid, ch); ctx.restore();
  // to'siq
  const op = openings();
  ctx.fillStyle = "#94a3b8";
  if (op) {
    let y0 = 0; op.slice().sort((p, q) => p.y - q.y).forEach((o) => { ctx.fillRect(g.xb - 3, y0, 6, o.y - o.h / 2 - y0); y0 = o.y + o.h / 2; });
    ctx.fillRect(g.xb - 3, y0, 6, ch - y0);
    op.forEach((o) => { ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1; ctx.strokeRect(g.xb - 5, o.y - o.h / 2 - 2, 10, o.h + 4); });
  } else {
    ctx.fillStyle = "rgba(148,163,184,0.8)"; ctx.fillRect(g.xb - 3, 0, 6, ch);
    ctx.fillStyle = "#0f172a"; for (let y = g.yc - beamH / 2; y < g.yc + beamH / 2; y += 4) ctx.fillRect(g.xb - 3, y, 6, 1.6);
  }
  const lab = ui.mode === "young" ? (st.closed ? "bitta tirqish" : `d = ${fmt(st.d, 2)} mm`) : ui.mode === "slit" ? `${st.shape === "round" ? "D" : "a"} = ${fmt(st.sa, 2)} mm` : `${fmt(st.N, 0)} chiziq/mm`;
  tag(ctx, lab, g.xb, 14, { color: "#e2e8f0", bg: "rgba(15,23,42,0.85)", align: "center", font: SMALL });
  // ekran (yon ko'rinish)
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(g.xs, g.yc - g.Hs, 5, 2 * g.Hs);
  for (let py = g.yc - g.Hs; py < g.yc + g.Hs; py += 2) { const s = lookup(Yof(py)); ctx.fillStyle = rgbCss(s.rgb.map((v) => Math.pow(clamp(v, 0, 1), gam()))); ctx.fillRect(g.xs, py, 5, 2.2); }
  tag(ctx, `L = ${fmt(st.L, 2)} m ↔`, g.xs, g.yc + g.Hs + 12, { color: "#e2e8f0", bg: "rgba(15,23,42,0.85)", align: "center", font: SMALL });
  // panjara: tartiblar yo'nalishi
  if (ui.mode === "grating" && !hiddenLam()) {
    const lam = st.white ? 550e-9 : lamM(), km = Math.min(4, D.maxOrder(lam, dGr()));
    for (let k = -km; k <= km; k++) { const x = D.orderPosition(k, lam, dGr(), st.L); if (x === null || Math.abs(x) > Ymax()) continue; tag(ctx, k === 0 ? "0" : `${k > 0 ? "+" : "−"}${Math.abs(k)}`, g.xs - 14, pyOf(x), { color: "#e2e8f0", bg: "rgba(15,23,42,0.7)", align: "center", font: SMALL, pad: 3 }); }
  }
  tag(ctx, "yon ko‘rinish (masshtabsiz)", 8, ch - 12, { color: "#94a3b8", bg: "rgba(15,23,42,0.85)", font: SMALL });
  // ekranning old ko'rinishi
  const fw0 = g.fx0, fwW = g.fx1 - g.fx0, top = g.yc - g.Hs, H = 2 * g.Hs;
  const rw = 64, rh = Math.round(H / 2), round = ui.mode === "slit" && st.shape === "round", zSpan = Ymax() * (fwW / H);
  const fkey = `${rw}x${rh}x${fwW.toFixed(0)}`;
  if (!front || front.width !== rw || front.height !== rh) { front = document.createElement("canvas"); front.width = rw; front.height = rh; binsCache.front = null; }
  if (binsCache.front !== fkey) {
  binsCache.front = fkey;
  const bctx = front.getContext("2d"), bimg = bctx.createImageData(rw, rh);
  for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
    const z = zSpan * ((2 * (i + 0.5)) / rw - 1), y = Ymax() * (1 - (2 * (j + 0.5)) / rh);
    const s = round ? lookup(Math.hypot(y, z)) : lookup(y);
    const prof = round ? 1 : Math.exp(-((z / (zSpan * 0.75)) ** 2));
    const p = (j * rw + i) * 4, iI = Math.max(1e-6, s.I), m = Math.pow(clamp(s.I, 0, 1), gam()) * prof;
    bimg.data[p] = 255 * clamp((s.rgb[0] / iI) * m, 0, 1); bimg.data[p + 1] = 255 * clamp((s.rgb[1] / iI) * m, 0, 1); bimg.data[p + 2] = 255 * clamp((s.rgb[2] / iI) * m, 0, 1); bimg.data[p + 3] = 255;
  }
  bctx.putImageData(bimg, 0, 0);
  }
  ctx.save(); ctx.fillStyle = "#020617"; ctx.beginPath(); ctx.roundRect(fw0, top, fwW, H, 8); ctx.fill(); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(front, fw0, top, fwW, H); ctx.restore();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(fw0, top, fwW, H, 8); ctx.stroke();
  // chizg'ich
  const k = unit() === "cm" ? 100 : 1000, step = ui.mode === "grating" ? 0.2 : ui.mode === "young" ? 0.002 : 0.005;
  ctx.strokeStyle = "rgba(226,232,240,0.6)"; ctx.fillStyle = "rgba(226,232,240,0.8)"; ctx.font = "500 9px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (let Y = -Math.floor(Ymax() / step) * step; Y <= Ymax() + 1e-9; Y += step) { const py = pyOf(Y); ctx.beginPath(); ctx.moveTo(fw0, py); ctx.lineTo(fw0 + 7, py); ctx.stroke(); if (Math.abs(Math.round(Y / step)) % 2 === 0) ctx.fillText(fmt(Y * k, 0), fw0 + 9, py); }
  // marker
  const my = pyOf(st.marker);
  ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fw0 - 6, my); ctx.lineTo(g.fx1 + 2, my); ctx.stroke();
  ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.moveTo(fw0 - 6, my - 6); ctx.lineTo(fw0 + 2, my); ctx.lineTo(fw0 - 6, my + 6); ctx.fill();
  tag(ctx, `y = ${fmt(st.marker * k, unit() === "cm" ? 1 : 2)} ${unit()}`, g.fx1, my - 12, { color: "#fff", bg: "rgba(239,68,68,0.9)", align: "right", font: SMALL });
  tag(ctx, "ekran (oldidan)", (fw0 + g.fx1) / 2, top - 10 < 8 ? top + 12 : top - 10, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 260, 360)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  young: [["I", "I(y)", "Ekrandagi intensivlik", "Yorug‘ polosalar Δy = λL/d oraliqda takrorlanadi; ularning yorqinligini bitta tirqishning difraksiya o‘rovchisi belgilaydi."], ["dy", "Δy(d)", "Polosalar orasi tirqishlar oralig‘iga bog‘liq", "Tirqishlar yaqinlashsa (d kichik), polosalar kengayadi: Δy = λL/d."]],
  slit: [["I", "I(y)", "Difraksion manzara", "Markaziy maksimum eng yorqin va yon maksimumlardan ikki marta keng."], ["w", "Kenglik(a)", "Markaziy maksimum kengligi", "Tirqish torayganda yorug‘lik ko‘proq og‘adi — markaziy dog‘ kengayadi: 2λL/a."]],
  grating: [["I", "I(y)", "Panjaradan keyingi spektr", "Bosh maksimumlar d·sin φ = kλ da; panjara chiziqlari ko‘p bo‘lsa, ular ingichka va yorqin."], ["lab", "Lab: λ", "Lab: lazer to‘lqin uzunligini aniqlash", "Markerni yorug‘ dog‘ markaziga qo‘ying va yozing. sin φ = y/√(y² + L²); k — dog‘ tartibi. Og‘ish λ/d ni beradi."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  $("[data-meas-tools]").hidden = ui.tab !== "lab";
  graph.render();
}
function drawGraphCanvas(ctx, gst) {
  if (ui.tab === "I") {
    const env = ui.mode === "young" && !st.closed && !st.white ? (Y) => D.slitI(D.sinTheta(Y, st.L), lamM(), st.a * 1e-3) : null;
    return G.drawProfile(ctx, gst, { sample: (Y) => sample(Y), Ymax: Ymax(), unit: unit(), env, marker: st.marker, label: st.white ? "oq yorug‘lik (yorqinlik)" : `λ = ${hiddenLam() ? "?" : fmt(lamNm(), 0)} nm` });
  }
  if (ui.tab === "dy") return G.drawCurve(ctx, gst, { fn: (d) => D.fringeSpacing(lamM(), st.L, d * 1e-3) * 1000, x0: 0.1, x1: 1, cur: st.d, xUnit: "mm", yLabel: "Δy, mm", label: `Δy = λL/d, λ = ${fmt(lamNm(), 0)} nm, L = ${fmt(st.L, 2)} m` });
  if (ui.tab === "w") return G.drawCurve(ctx, gst, { fn: (a) => D.centralWidth(lamM(), st.L, a * 1e-3, st.shape === "round") * 1000, x0: 0.02, x1: 0.5, cur: st.sa, xUnit: "mm", yLabel: "kenglik, mm", label: st.shape === "round" ? "2·1,22λL/D" : "2λL/a" });
  return G.drawLab(ctx, gst, { pts: st.pts, lamTrue: lamM(), d: dGr(), hidden: hiddenLam(), kMax: Math.min(5, D.maxOrder(lamM(), dGr())) });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const lamTxt = () => (st.white ? "oq (400–700 nm)" : hiddenLam() ? "?" : `${fmt(lamNm(), 0)}<small>nm</small>`);
function measuredLam() { return D.fitLambda(st.pts, dGr()); }
function updateReadouts() {
  const lam = lamM(), L = st.L;
  setRO("r1", "To‘lqin uzunligi <i>λ</i>", lamTxt(), st.white ? "Har bir rang o‘z manzarasini beradi" : hiddenLam() ? "Lab: o‘lchab toping" : D.colorName(lamNm()), hiddenLam() ? "muted" : "");
  if (ui.mode === "young") {
    const dy = D.fringeSpacing(lam, L, st.d * 1e-3);
    setRO("r2", "Polosalar orasi <i>Δy</i>", st.closed ? "—" : `${fmt(dy * 1000, 2)}<small>mm</small>`, st.closed ? "Bitta tirqish — interferensiya yo‘q" : "Δy = λL/d");
    setRO("r3", "Tirqishlar orasi <i>d</i>", `${fmt(st.d, 2)}<small>mm</small>`, `Tirqish kengligi a = ${fmt(st.a, 3)} mm`);
    setRO("r4", "Markaziy o‘rovchida", st.closed ? "—" : `${Math.max(1, 2 * Math.floor(st.d / st.a - 1e-9) + 1)}<small>ta polosa</small>`, "Yorug‘ polosalar soni ≈ 2d/a − 1");
    setRO("r5", "Ekrangacha <i>L</i>", `${fmt(L, 2)}<small>m</small>`, `1-maksimum burchagi ${fmt((Math.asin(lam / (st.d * 1e-3)) * 180) / Math.PI * 60, 1)}′`);
    const m = (st.marker * st.d * 1e-3) / (lam * L);
    setRO("r6", "Marker", `${fmt(st.marker * 1000, 2)}<small>mm</small>`, st.closed ? "" : `Yo‘llar farqi Δ = ${fmt(m, 2)}λ`);
  } else if (ui.mode === "slit") {
    const round = st.shape === "round", a = st.sa * 1e-3, w = D.centralWidth(lam, L, a, round);
    setRO("r2", "Markaziy dog‘ kengligi", `${fmt(w * 1000, 2)}<small>mm</small>`, round ? "2·1,22λL/D" : "2λL/a");
    setRO("r3", round ? "Teshik diametri <i>D</i>" : "Tirqish kengligi <i>a</i>", `${fmt(st.sa, 3)}<small>mm</small>`, `a/λ = ${fmt(a / lam, 0)}`);
    const th = Math.asin(Math.min(1, ((round ? 1.22 : 1) * lam) / a));
    setRO("r4", "1-minimum burchagi", `${fmt((th * 180) / Math.PI, 3)}°`, round ? "sin φ = 1,22λ/D" : "a·sin φ = λ");
    setRO("r5", "Ekrangacha <i>L</i>", `${fmt(L, 2)}<small>m</small>`, "");
    setRO("r6", "Marker", `${fmt(st.marker * 1000, 2)}<small>mm</small>`, "");
  } else {
    const d = dGr(), km = D.maxOrder(st.white ? 700e-9 : lam, d), x1 = D.orderPosition(1, lam, d, L), ml = measuredLam();
    setRO("r2", "Panjara davri <i>d</i>", `${fmt(d * 1e6, 2)}<small>mkm</small>`, `d = 1/N, N = ${fmt(st.N, 0)} /mm`);
    setRO("r3", "Eng katta tartib", hiddenLam() ? "?" : `${km}`, st.white ? "qizil (700 nm) uchun" : "k_max < d/λ");
    setRO("r4", "1-tartib", x1 === null || hiddenLam() ? "?" : `${fmt(x1 * 100, 1)}<small>cm</small>`, x1 === null || hiddenLam() ? "Markazdan masofa — o‘lchang" : `φ₁ = ${fmt((Math.asin(lam / d) * 180) / Math.PI, 1)}°`);
    const s = D.sinTheta(st.marker, L), kk = Math.round((s * d) / lam);
    setRO("r5", "Marker", `${fmt(st.marker * 100, 1)}<small>cm</small>`, `sin φ = ${fmt(s, 3)}${!st.white && kk ? `, k = ${kk}` : ""}`);
    setRO("r6", "O‘lchangan λ", ml ? `${fmt(ml * 1e9, 0)}<small>nm</small>` : "—", ml ? `${st.pts.length} ta o‘lchov${st.unknown && st.revealed ? `, haqiqiy ${st.lamHidden} nm` : ""}` : "«Lab: λ» grafigida yozing");
  }
}
function updateStatus() {
  const el = $("[data-status]");
  el.textContent = ui.mode === "young" ? (st.closed ? "Difraksiya (bitta tirqish)" : "Interferensiya") : ui.mode === "slit" ? "Difraksiya" : st.white ? "Spektr" : "Bosh maksimumlar";
  el.dataset.tone = "blue";
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "young") {
    p.push("<p>Lazer nuri ikki tor tirqishga tushadi. Har bir tirqish yangi to‘lqin manbaiga aylanadi (Gyuygens prinsipi); ular <b>kogerent</b>, shuning uchun ekranda barqaror manzara — yorug‘ va qorong‘i polosalar hosil bo‘ladi. Yorug‘ polosada yo‘llar farqi butun sondagi to‘lqin uzunligiga teng, qorong‘ida — yarim to‘lqin qo‘shilgan.</p>");
    if (st.white) p.push("<p>Oq yorug‘likda markaziy polosa oq, qolganlari rangli: qizil polosalar keng (λ katta), binafsha — tor.</p>");
    if (st.closed) p.push("<p>Bitta tirqish yopilganda polosalar yo‘qoladi — faqat bitta tirqishning keng difraksion dog‘i qoladi. Demak polosalar ikki to‘lqin <b>qo‘shilishidan</b> hosil bo‘ladi.</p>");
  } else if (ui.mode === "slit") {
    p.push("<p>Yorug‘lik to‘lqin bo‘lgani uchun tor tirqishdan o‘tgach to‘g‘ri chiziqdan og‘adi — <b>difraksiya</b>. Tirqish qanchalik tor bo‘lsa (to‘lqin uzunligi bilan solishtirarli), og‘ish shunchalik kuchli.</p>");
    if (st.shape === "round") p.push("<p>Doira teshik markazda yorug‘ dog‘ va atrofida halqalar beradi (Eyri manzarasi). Shu sababli teleskop va mikroskop ikki yaqin nuqtani ajrata olmaydi — bu ularning ajrata olish chegarasi.</p>");
  } else {
    p.push("<p><b>Difraksion panjara</b> — juda ko‘p parallel tirqishlar. Barcha tirqishlardan kelgan to‘lqinlar faqat d·sin φ = kλ yo‘nalishlarida kuchayadi, shuning uchun ekranda ingichka yorqin dog‘lar (tartiblar) hosil bo‘ladi.</p>");
    if (st.white) p.push("<p>Oq yorug‘likda har bir tartib spektrga yoyiladi: binafsha markazga yaqin, qizil uzoqda (λ katta — burchak katta). Yuqori tartib spektrlari ustma-ust tushadi.</p>");
    if (st.unknown) p.push("<p><b>Lab ishi:</b> markerni ±1, ±2, … tartibli dog‘lar markaziga qo‘yib, har birini yozing. λ = d·sin φ/k.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "young" ? "<small>Polosalar orasi</small> Δy = λL / d" : ui.mode === "slit" ? (st.shape === "round" ? "<small>Doira teshik</small> sin φ = 1,22λ / D" : "<small>Minimumlar</small> a·sin φ = kλ") : "<small>Panjara</small> d·sin φ = kλ";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt (to'lqin animatsiyasi) */

const loop = createLoop((dt) => { ui.t += dt; stage.render(); }, {
  onStateChange(on) {
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
    playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  },
});
const playBtn = $("[data-play]");
playBtn.addEventListener("click", () => loop.toggle());

/* ------------------------------------------------------------------ Boshqaruv */

const lamC = bindRange($("#lam"), $("#lamOut"), (v) => `${fmt(v, 0)} nm`, (v) => { st.lam = v; customized(); refresh(); });
const scrC = bindRange($("#scr"), $("#scrOut"), (v) => `${fmt(v, 2)} m`, (v) => { st.L = v; customized(); refresh(); });
const yDC = bindRange($("#yD"), $("#yDOut"), (v) => `${fmt(v, 2)} mm`, (v) => { st.d = v; customized(); refresh(); });
const yAC = bindRange($("#yA"), $("#yAOut"), (v) => `${fmt(v, 3)} mm`, (v) => { st.a = v; customized(); refresh(); });
const sAC = bindRange($("#sA"), $("#sAOut"), (v) => `${fmt(v, 3)} mm`, (v) => { st.sa = v; customized(); refresh(); });
const gNC = bindRange($("#gN"), $("#gNOut"), (v) => `${fmt(v, 0)}`, (v) => { st.N = v; st.pts = []; customized(); refresh(); });
$("[data-white]").addEventListener("change", (e) => { st.white = e.target.checked; syncAll(); customized(); refresh(); });
$("[data-close]").addEventListener("change", (e) => { st.closed = e.target.checked; customized(); refresh(); });
document.querySelectorAll("[data-shape-value]").forEach((b) => b.addEventListener("click", () => { st.shape = b.dataset.shapeValue; syncAll(); customized(); refresh(); }));
$("[data-unknown]").addEventListener("change", (e) => { st.unknown = e.target.checked; st.revealed = false; st.pts = []; if (st.unknown) { st.white = false; st.lamHidden = HIDDEN[Math.floor(Math.random() * HIDDEN.length)]; } syncAll(); customized(); refresh(); });
$("[data-reveal]").addEventListener("click", () => { st.revealed = true; syncAll(); refresh(); });
$("[data-meas-add]").addEventListener("click", () => {
  const s = D.sinTheta(st.marker, st.L), k = Math.round((s * dGr()) / lamM());
  if (k === 0 || st.white) return;
  st.pts.push({ k, s: Math.round(s * 1000) / 1000 }); refresh();
});
$("[data-meas-clear]").addEventListener("click", () => { st.pts = []; refresh(); });

/* Sudrash: tirqish (d yoki a), ekran (L), marker */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
function hitTest(px, py) {
  if (px >= g.fx0 - 10 && px <= g.fx1 + 4 && Math.abs(py - pyOf(st.marker)) < 14) return "marker";
  if (px >= g.fx0 && px <= g.fx1 && Math.abs(py - g.yc) <= g.Hs) return "markerJump";
  if (Math.abs(px - g.xs - 2) < 14 && Math.abs(py - g.yc) < g.Hs) return "screen";
  const op = openings();
  if (op && Math.abs(px - g.xb) < 18) { for (const o of op) if (Math.abs(py - o.y) < o.h / 2 + 12) return ui.mode === "young" ? "slitD" : "slitA"; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const { px, py } = ptr(e); let h = hitTest(px, py);
  if (!h) return;
  if (h === "markerJump") h = "marker";
  drag = h; canvas.dataset.dragging = "true";
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  onDrag(px, py);
});
function onDrag(px, py) {
  if (drag === "marker") { const Y = clamp(Yof(py), -Ymax(), Ymax()); const q = ui.mode === "grating" ? 0.001 : 0.00005; st.marker = Math.round(Y / q) * q; }
  else if (drag === "screen") { const fr = clamp((px - g.xb - 34) / (g.aw - g.xb - 48), 0, 1), L = 0.2 + 2.3 * fr * fr; st.L = Math.round(clamp(L, 0.2, 2.5) * 20) / 20; scrC.set(st.L); }
  else if (drag === "slitD") { const dp = Math.abs(py - g.yc) * 2; st.d = Math.round(clamp(0.1 + ((dp - 18) / 80) * 0.9, 0.1, 1) * 100) / 100; yDC.set(st.d); }
  else if (drag === "slitA") { const hp = Math.abs(py - g.yc) * 2; st.sa = Math.round(clamp(0.02 + ((hp - 4) / 56) * 0.48, 0.02, 0.5) * 200) / 200; sAC.set(st.sa); }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => {
  const { px, py } = ptr(e);
  if (!drag) { const h = hitTest(px, py); canvas.style.cursor = h ? (h === "screen" ? "ew-resize" : "ns-resize") : ""; return; }
  onDrag(px, py);
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  youngG: { mode: "young", title: "Yung tajribasi (yashil lazer)", lesson: "Ikki tirqishdan o‘tgan nurlar ekranda yorug‘ va qorong‘i polosalar beradi. Ekranni uzoqlashtiring — polosalar kengayadi.", set: () => Object.assign(st, { lam: 532, L: 1, white: false, closed: false, d: 0.25, a: 0.05, marker: 0 }) },
  youngRed: { mode: "young", title: "Qizil lazer: polosalar kengroq", lesson: "λ = 650 nm: Δy = λL/d bo‘yicha polosalar yashil nurga nisbatan kengroq. λ slayderini surib solishtiring.", set: () => Object.assign(st, { lam: 650, L: 1, white: false, closed: false, d: 0.25, a: 0.05, marker: 0 }), tab: "dy" },
  youngWhite: { mode: "young", title: "Oq yorug‘likda interferensiya", lesson: "Markaziy polosa oq, chetlarida rangli polosalar — har bir rang o‘z oralig‘ida.", set: () => Object.assign(st, { L: 1, white: true, closed: false, d: 0.25, a: 0.04, marker: 0 }) },
  youngOne: { mode: "young", title: "Bitta tirqish yopiq", lesson: "Polosalar yo‘qoldi — interferensiya uchun ikkita kogerent to‘lqin kerak. Yoqib-o‘chirib solishtiring.", set: () => Object.assign(st, { lam: 532, L: 1, white: false, closed: true, d: 0.25, a: 0.05, marker: 0 }) },
  slitNarrow: { mode: "slit", title: "Tor tirqish — keng dog‘", lesson: "a = 0,05 mm: yorug‘lik kuchli og‘adi. Tirqish chetini surib kengaytiring — dog‘ torayadi.", set: () => Object.assign(st, { lam: 532, L: 1, white: false, shape: "slit", sa: 0.05, marker: 0 }), tab: "w" },
  slitWide: { mode: "slit", title: "Keng tirqish", lesson: "a = 0,4 mm: difraksiya sust, dog‘ tor — yorug‘lik deyarli to‘g‘ri chiziqli tarqaladi.", set: () => Object.assign(st, { lam: 532, L: 1, white: false, shape: "slit", sa: 0.4, marker: 0 }) },
  round: { mode: "slit", title: "Doira teshik: Eyri halqalari", lesson: "Markazda yorug‘ dog‘, atrofida xira halqalar. Birinchi qorong‘i halqa sin φ = 1,22λ/D da.", set: () => Object.assign(st, { lam: 633, L: 1.5, white: false, shape: "round", sa: 0.15, marker: 0 }) },
  grat: { mode: "grating", title: "Difraksion panjara (300 /mm)", lesson: "Ekranda 0, ±1, ±2, … tartibli yorqin dog‘lar. Chiziqlar sonini oshiring — dog‘lar uzoqlashadi.", set: () => Object.assign(st, { lam: 532, L: 1, white: false, N: 300, unknown: false, marker: 0, pts: [] }) },
  gratWhite: { mode: "grating", title: "Oq yorug‘lik spektri", lesson: "Har bir tartib kamalakka yoyiladi; markaziy (0) dog‘ oq. 2- va 3-tartib spektrlari ustma-ust tushadi.", set: () => Object.assign(st, { L: 1, white: true, N: 300, unknown: false, marker: 0, pts: [] }) },
  gratLab: { mode: "grating", title: "Lab: lazer to‘lqin uzunligi", lesson: "Lazer noma’lum. Markerni +1, −1, +2, −2 dog‘lar markaziga qo‘yib, har birida «O‘lchovni yozish» ni bosing. Grafik og‘ishidan λ ni toping.", set: () => { Object.assign(st, { L: 1, white: false, N: 300, unknown: true, revealed: false, marker: 0, pts: [] }); st.lamHidden = HIDDEN[Math.floor(Math.random() * HIDDEN.length)]; }, tab: "lab" },
  gratFine: { mode: "grating", title: "Zich panjara (1000 /mm)", lesson: "d = 1 mkm: faqat ±1 tartib ko‘rinadi, burchak katta — spektr keng yoyiladi.", set: () => Object.assign(st, { lam: 532, L: 0.6, white: false, N: 1000, unknown: false, marker: 0, pts: [] }) },
};
const GROUPS = [["Yung tajribasi", ["youngG", "youngRed", "youngWhite", "youngOne"]], ["Tirqish va teshik", ["slitNarrow", "slitWide", "round"]], ["Difraksion panjara", ["grat", "gratWhite", "gratLab", "gratFine"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  lamC.set(st.lam); scrC.set(st.L); yDC.set(st.d); yAC.set(st.a); sAC.set(st.sa); gNC.set(st.N);
  $("[data-white]").checked = st.white; $("[data-close]").checked = st.closed; $("[data-unknown]").checked = st.unknown;
  $("[data-lam-ctl]").hidden = st.white || (ui.mode === "grating" && st.unknown);
  $("[data-reveal]").hidden = !(ui.mode === "grating" && st.unknown && !st.revealed);
  document.querySelectorAll("[data-shape-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shapeValue === st.shape)));
  $("[data-sa-label]").textContent = st.shape === "round" ? "Teshik diametri D" : "Tirqish kengligi a";
  const lab = $("#lam"); lab.style.background = "linear-gradient(90deg,#7c3aed,#2563eb,#06b6d4,#22c55e,#eab308,#f97316,#dc2626)"; lab.style.borderRadius = "999px";
}
const MODE_HINT = { young: "Tirqish, ekran va qizil markerni suring", slit: "Tirqish chetini va ekranni suring", grating: "Markerni yorug‘ dog‘ga suring" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ young: "youngG", slit: "slitNarrow", grating: "grat" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  p.set(); setMode(p.mode);
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[ui.mode][0][0]);
  refresh();
  if (!prefersReducedMotion()) loop.start();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "youngG");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
