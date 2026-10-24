// ==========================================================================
// Matematik mayatnik — simulyatsiya (simulations/pendulum.html)
// Fizika: pendulum-physics.js (RK4, aniq davr). Grafiklar: pendulum-plots.js.
// Qattiq vaznsiz sterjen: 180° gacha ishlaydi; sterjen kuchi N manfiy bo'lishi mumkin (siqilish).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { DEG, clamp, fmt, sci, createStage, createLoop, arrow, angleArc, tag, bindRange } from "./sim-kit.js";
import { TAU, H_MAX, rk4, createPeriodMeter, motionInfo, specificEnergy, specificKinetic, specificPotential, periodRatio, smallPeriod, wrapAngle } from "./pendulum-physics.js";
import { createHistory, createTimePlot, createPhasePlot, createEnergyPlot, splitHeights } from "./pendulum-plots.js";

const $ = (s) => document.querySelector(s);

/* ------------------------------------------------------------------ Holat */

const P = { L: 1, m: 1, g: 9.81, gamma: 0, driveOn: false, f: 0.1, ratio: 1 };
const init = { th: 30 * DEG, w: 0 };
const ui = { speed: 1, tab: "time", show: { forces: true, components: false, velocity: true, trail: true, lin: false, energy: true } };

let s = { th: init.th, w: init.w, t: 0 };
let lin = { ...s };
const meter = createPeriodMeter();
const hist = createHistory(3500);
const timePlot = createTimePlot(), phasePlot = createPhasePlot(), energyPlot = createEnergyPlot();
let lastSample = -1;
let eRef = 0;                                   // energiya ustunlari masshtabi (J) — o'sib boradi

const w2 = () => P.g / P.L;
const w0 = () => Math.sqrt(w2());
const T0 = () => smallPeriod(w2());
const sim = () => ({ w2: w2(), gamma: P.gamma, f: P.driveOn ? P.f : 0, Om: P.ratio * w0(), linear: false });
const simLin = () => ({ ...sim(), linear: true });
const scaleE = () => P.m * P.L * P.L;            // J = scaleE · (energiya / I birligi)
const windowSeconds = () => clamp(4 * T0(), 3, 30);
const sampleDt = () => windowSeconds() / 700;

function sample(a, b) {
  hist.push(a.t, a.th, a.w, specificKinetic(a), specificPotential(a, w2()), b.th);
  lastSample = a.t;
}

function resetSim({ keepRunning = false } = {}) {
  s = { th: init.th, w: init.w, t: 0 };
  lin = { ...s };
  meter.reset();
  hist.clear();
  phasePlot.reset();
  lastSample = -1;
  eRef = Math.max(scaleE() * specificEnergy(s, w2()) * 1.15, 0.12 * P.m * P.g * P.L);
  sample(s, lin);
  if (!keepRunning) loop.stop();
}

/* ------------------------------------------------------------------ Masshtab va chizish */

let view = null; // { cx, pivotY, Lpx, pxPerM, r }

function computeView(w, h) {
  const narrow = w < 560;
  const barsW = !narrow && ui.show.energy ? 150 : 0;
  const topPad = 30, botPad = 34;
  const info = motionInfo({ th: init.th, w: init.w }, w2());
  const amp0 = info.mode === "oscillation" ? info.amplitude : Math.PI;
  const up = amp0 > Math.PI / 2 ? -Math.cos(amp0) : 0;      // sterjenning yuqoriga ko'tarilish ulushi
  const availH = h - topPad - botPad;
  const cx = (w - barsW) / 2;
  const LmaxPx = Math.min(availH / (1 + up), cx - 26);
  const frac = 0.8 + 0.2 * Math.sqrt(P.L / 10);              // L ning tasviriy uzunligi (o'lchov chizg'ichi to'g'ri masshtabni ko'rsatadi)
  const Lpx = Math.max(60, LmaxPx * frac);
  const pivotY = topPad + up * Lpx + (up > 0 ? 6 : 0);
  const r = clamp(9 + 6 * Math.cbrt(P.m), 10, Math.max(10, Lpx * 0.3));
  return { w, h, cx, pivotY, Lpx, pxPerM: Lpx / P.L, r, barsW, topPad, botPad };
}

const bobAt = (v, th) => ({ x: v.cx + v.Lpx * Math.sin(th), y: v.pivotY + v.Lpx * Math.cos(th) });

function niceScaleLength(pxPerM) {
  for (const m of [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]) if (m * pxPerM >= 36) return m;
  return 10;
}

function drawCeiling(ctx, c, v) {
  const { cx, pivotY, w } = v;
  if (v.pivotY <= v.topPad + 8) {
    const half = Math.min(90, cx - 10);
    ctx.save();
    ctx.fillStyle = c.sunken;
    ctx.fillRect(cx - half, pivotY - 14, half * 2, 14);
    ctx.strokeStyle = c.borderStrong;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - half, pivotY + 0.5); ctx.lineTo(cx + half, pivotY + 0.5); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = c.border;
    ctx.beginPath();
    for (let x = cx - half + 6; x < cx + half; x += 10) { ctx.moveTo(x, pivotY - 1); ctx.lineTo(x - 8, pivotY - 13); }
    ctx.stroke();
    ctx.restore();
  }
}

function drawRod(ctx, c, v, th, { color, width = 3.5, dash = null, alpha = 1 }) {
  const b = bobAt(v, th);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(v.cx, v.pivotY); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
  return b;
}

function drawBars(ctx, c, v, K, U, E) {
  const x0 = v.w - v.barsW + 6, wBox = v.barsW - 16;
  const y0 = v.topPad - 8, hBox = v.h - v.topPad - v.botPad + 16;
  ctx.save();
  ctx.fillStyle = c.bg2;
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x0, y0, wBox, hBox, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text2;
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Energiya, J", x0 + wBox / 2, y0 + 18);
  const top = y0 + 52, bottom = y0 + hBox - 30;
  eRef = Math.max(eRef, E * 1.08, U * 1.08);
  const ref = eRef;
  const bw = 28, gap = (wBox - 3 * bw) / 4;
  const bars = [["K", K, c.success], ["U", U, c.warning], ["E", E, c.primary]];
  bars.forEach(([name, val, col], i) => {
    const bx = x0 + gap + i * (bw + gap);
    const hh = clamp(val / ref, 0, 1) * (bottom - top);
    ctx.fillStyle = c.sunken;
    ctx.beginPath(); ctx.roundRect(bx, top, bw, bottom - top, 6); ctx.fill();
    ctx.fillStyle = col;
    if (hh > 0.5) { ctx.beginPath(); ctx.roundRect(bx, bottom - hh, bw, hh, 6); ctx.fill(); }
    ctx.fillStyle = c.text2;
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.fillText(name, bx + bw / 2, bottom + 14);
    ctx.fillStyle = c.text;
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText(sci(val, 2), bx + bw / 2, top - 12);
  });
  ctx.restore();
}

function draw(ctx, stage) {
  const { w, h, colors: c } = stage;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const v = (view = computeView(w, h));
  const { cx, pivotY, Lpx, r } = v;

  drawCeiling(ctx, c, v);

  // Muvozanat chizig'i
  ctx.save();
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.beginPath(); ctx.moveTo(cx, pivotY); ctx.lineTo(cx, Math.min(h - 8, pivotY + Lpx + r + 24)); ctx.stroke();
  ctx.restore();

  // Iz
  if (ui.show.trail && hist.length > 1) {
    const trailT = Math.min(1.6 * T0(), 8);
    const i0 = hist.firstFrom(s.t - trailT);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 3;
    for (let i = Math.max(i0, 1); i < hist.length; i++) {
      const a = bobAt(v, hist.th[i - 1]), b = bobAt(v, hist.th[i]);
      if (Math.abs(hist.th[i] - hist.th[i - 1]) > 1) continue;
      ctx.strokeStyle = c.primary;
      ctx.globalAlpha = 0.5 * ((hist.t[i] - (s.t - trailT)) / trailT);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  // Chiziqli (kichik burchak) model — "xayoliy" mayatnik
  if (ui.show.lin) {
    const g = drawRod(ctx, c, v, lin.th, { color: c.text3, width: 2, dash: [6, 5], alpha: 0.9 });
    ctx.save();
    ctx.strokeStyle = c.text3;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, TAU); ctx.stroke();
    ctx.restore();
    tag(ctx, "sin θ ≈ θ", g.x + (g.x >= cx ? r + 8 : -r - 8), g.y - r - 10, { color: c.text2, bg: c.bg, align: g.x >= cx ? "left" : "right", font: "600 11px Inter, system-ui, sans-serif" });
  }

  // Burchak yoyi
  if (Math.abs(s.th) > 2 * DEG) {
    const ar = Math.min(54, Lpx * 0.38);
    angleArc(ctx, cx, pivotY, ar, Math.PI / 2, Math.PI / 2 - s.th, c.text2, { label: "θ", labelR: ar + 15, font: "italic 600 17px 'Times New Roman', serif" });
  }

  // Sterjen va shar
  const b = drawRod(ctx, c, v, s.th, { color: c.text2 });
  const mg = P.m * P.g;
  const N = P.m * (P.g * Math.cos(s.th) + P.L * s.w * s.w);
  const kF = 56 / mg;
  const tHat = { x: Math.cos(s.th), y: -Math.sin(s.th) };      // urinma (θ ortadigan yo'nalish)
  const rHat = { x: Math.sin(s.th), y: Math.cos(s.th) };       // markazdan tashqariga
  const italic = "italic 700 14px 'Times New Roman', serif";

  if (ui.show.components) {
    const at = -mg * Math.sin(s.th) * kF, ar2 = mg * Math.cos(s.th) * kF;
    arrow(ctx, b.x, b.y, tHat.x * at, tHat.y * at, c.special, { width: 2, dash: [5, 4], head: 8, label: "mg sinθ", font: "600 11px Inter, system-ui, sans-serif" });
    arrow(ctx, b.x, b.y, rHat.x * ar2, rHat.y * ar2, c.special, { width: 2, dash: [5, 4], head: 8, label: "mg cosθ", font: "600 11px Inter, system-ui, sans-serif" });
  }
  if (ui.show.forces) {
    arrow(ctx, b.x, b.y, 0, mg * kF, c.special, { width: 3, label: "mg", font: italic });
    const nLen = clamp(N * kF, -170, 170);
    arrow(ctx, b.x, b.y, -rHat.x * nLen, -rHat.y * nLen, c.success, { width: 3, label: "N", font: italic });
  }
  if (ui.show.velocity) {
    const vRef = Math.sqrt(P.g * P.L);
    const len = clamp((P.L * s.w / vRef) * 54, -130, 130);
    arrow(ctx, b.x, b.y, tHat.x * len, tHat.y * len, c.warning, { width: 3, label: "v", font: italic });
  }

  // Shar
  ctx.save();
  const dragging = stage.canvas.dataset.dragging === "true";
  ctx.fillStyle = c.primary;
  ctx.strokeStyle = dragging ? c.warning : c.bg;
  ctx.lineWidth = dragging ? 3 : 2.5;
  ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.beginPath(); ctx.arc(b.x - r * 0.3, b.y - r * 0.32, r * 0.28, 0, TAU); ctx.fill();
  ctx.restore();

  // Osish nuqtasi
  ctx.save();
  ctx.fillStyle = c.text;
  ctx.beginPath(); ctx.arc(cx, pivotY, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = c.bg;
  ctx.beginPath(); ctx.arc(cx, pivotY, 2, 0, TAU); ctx.fill();
  ctx.restore();

  // L belgisi (sterjen o'rtasida)
  if (Math.abs(s.th) < 70 * DEG) {
    const mid = bobAt({ ...v, Lpx: Lpx * 0.5 }, s.th);
    const off = s.th >= 0 ? 1 : -1;
    tag(ctx, `L = ${fmt(P.L, 2)} m`, mid.x + off * 18, mid.y, { color: c.text2, bg: c.bg, align: off < 0 ? "right" : "left", font: "600 11px Inter, system-ui, sans-serif" });
  }

  // Vaqt va o'lchov chizg'ichi
  tag(ctx, `t = ${fmt(s.t, 1)} s`, 12, 20, { color: c.text2, bg: c.bg2, font: "600 12px Inter, system-ui, sans-serif" });
  const unit = niceScaleLength(v.pxPerM);
  const sx = 14, sy = h - 16, sl = unit * v.pxPerM;
  ctx.save();
  ctx.strokeStyle = c.text2;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5); ctx.moveTo(sx, sy); ctx.lineTo(sx + sl, sy); ctx.moveTo(sx + sl, sy - 5); ctx.lineTo(sx + sl, sy + 5); ctx.stroke();
  ctx.fillStyle = c.text2;
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  ctx.fillText(`${fmt(unit, unit < 1 ? (unit < 0.1 ? 2 : 1) : 0)} m`, sx + sl + 8, sy + 5);
  ctx.restore();

  if (v.barsW) drawBars(ctx, c, v, P.m * P.L * P.L * specificKinetic(s), P.m * P.L * P.L * specificPotential(s, w2()), P.m * P.L * P.L * specificEnergy(s, w2()));
}

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  time: ["Burchakning vaqtga bog‘liqligi θ(t)", "Oxirgi tebranishlar; uzuq chiziq — kichik burchak modeli"],
  phase: ["Faza portreti (θ, ω/ω₀)", "Bosib boshlang‘ich holatni tanlang · uzuq chiziq — separatrisa"],
  energy: ["Energiyaning vaqtga bog‘liqligi E(t)", "Kinetik va potensial energiya almashinuvi"],
};

function drawGraphCanvas(ctx, st) {
  if (ui.tab === "time") timePlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, showLin: ui.show.lin });
  else if (ui.tab === "phase") phasePlot.draw(ctx, st, hist, { w0: w0(), separatrix: true, trail: 900 });
  else energyPlot.draw(ctx, st, hist, { win: windowSeconds(), tNow: s.t, scale: scaleE(), ref: eRef * 0.9 });
}

/* ------------------------------------------------------------------ Ko'rsatkichlar */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

let lastExplain = "";

function updateUI() {
  const W2 = w2();
  const mL2 = scaleE();
  const eper = specificEnergy(s, W2);
  const E = mL2 * eper;
  const info = motionInfo(s, W2);
  const t0 = T0();
  const driven = P.driveOn;
  const mg = P.m * P.g;
  const N = P.m * (P.g * Math.cos(s.th) + P.L * s.w * s.w);
  const wr = wrapAngle(s.th);

  setReadout("th", `${fmt(wr / DEG, 1)}<small>°</small>`, `ω = ${fmt(s.w, 2)} rad/s`);
  setReadout("v", `${fmt(P.L * Math.abs(s.w), 2)}<small>m/s</small>`, `Pastda ${fmt(P.L * Math.sqrt(2 * eper), 2)} m/s gacha yetadi`);

  const mTxt = meter.mean ?? meter.period;
  setReadout("Tm", mTxt ? `${fmt(mTxt, 3)}<small>s</small>` : "—",
    meter.count ? `${meter.count} ta to‘liq tebranish bo‘yicha o‘rtacha` : mTxt ? "Birinchi o‘lchov" : s.t > 0 ? "O‘lchanmoqda…" : "Boshlang‘ich holat");

  if (driven) {
    setReadout("Tt", `${fmt((TAU / (P.ratio * w0())), 3)}<small>s</small>`, "Majburiy tebranish davri 2π/Ω");
  } else if (info.mode === "oscillation" || info.mode === "rest") {
    const pct = (info.period / t0 - 1) * 100;
    setReadout("Tt", `${fmt(info.period, 3)}<small>s</small>`, `T₀ = ${fmt(t0, 3)} s · ${pct < 0.005 ? "farq yo‘q" : `${fmt(pct, pct < 1 ? 2 : 1)}% katta`}`);
  } else if (info.mode === "rotation") {
    setReadout("Tt", `${fmt(info.period, 3)}<small>s</small>`, "To‘liq aylanish davri");
  } else {
    setReadout("Tt", "∞", "Separatrisa: yuqori nuqtaga cheksiz sekin yaqinlashadi");
  }

  setReadout("E", `${sci(E, 3)}<small>J</small>`, `K = ${sci(mL2 * specificKinetic(s), 2)} J · U = ${sci(mL2 * specificPotential(s, W2), 2)} J`);
  setReadout("N", `${fmt(N, 2)}<small>N</small>`, N < 0 ? "Manfiy: sterjen siqilmoqda" : `mg = ${fmt(mg, 2)} N ning ${fmt(N / mg, 2)} qismi`);
  document.querySelector('[data-readout="N"]').dataset.tone = N < 0 ? "orange" : "";

  const status = $("[data-status]");
  const atRest = !driven && info.mode === "rest";
  let [text, tone] = ["Tayyor", "blue"];
  if (s.t > 0 && atRest) [text, tone] = ["Muvozanatda", "green"];
  else if (loop.running) [text, tone] = info.mode === "rotation" ? ["Aylanmoqda", "orange"] : ["Tebranmoqda", "orange"];
  else if (s.t > 0) [text, tone] = ["Pauza", "purple"];
  status.textContent = text;
  status.dataset.tone = tone;

  // Tushuntirish
  const parts = [];
  const amp = info.amplitude / DEG;
  if (driven) {
    const r = P.ratio;
    const pred = P.f / Math.sqrt((W2 - (r * r * W2)) ** 2 + (P.gamma * r * w0()) ** 2);
    parts.push(`<p>Mayatnikka davriy tashqi kuch ta’sir qilmoqda: <span class="sim-math">Ω = ${fmt(r, 2)} ω₀ = ${fmt(r * w0(), 2)} rad/s</span>. Tabiiy chastota <span class="sim-math">ω₀ = ${fmt(w0(), 2)} rad/s</span>. ${Math.abs(r - 1) < 0.08 ? "<b>Rezonans!</b> Chastotalar mos kelganda amplituda eng tez o‘sadi, so‘nish esa uni cheklaydi." : r < 1 ? "Kuch chastotasi tabiiy chastotadan past — mayatnik kuchga deyarli “ergashadi”." : "Kuch chastotasi tabiiy chastotadan yuqori — mayatnik kuchga ulgurmaydi, amplituda kichik bo‘ladi."}</p>`);
    if (P.gamma > 0 && pred < 0.3) parts.push(`<p>Kichik burchaklar nazariyasi bo‘yicha turg‘un amplituda ≈ <b>${fmt((pred * 180) / Math.PI, 1)}°</b> (<span class="sim-math">f / √((ω₀² − Ω²)² + γ²Ω²)</span>). Qiymatni o‘lchangan grafik bilan solishtiring.</p>`);
  } else if (info.mode === "rotation") {
    parts.push(`<p>Boshlang‘ich energiya <span class="sim-math">2mgL</span> dan katta (<span class="sim-math">E = ${sci(E, 3)} J &gt; ${sci(2 * mg * P.L, 3)} J</span>) — mayatnik yuqori nuqtadan ham o‘tib, <b>to‘liq aylanadi</b>. Sterjen tutib turgani uchun bu mumkin; ip bo‘lganda yuqorida bo‘shashib qolishi mumkin edi. Faza portretida bu holat separatrisadan tashqaridagi to‘lqinsimon chiziq.</p>`);
  } else if (info.mode === "separatrix") {
    parts.push(`<p>Energiya aynan <span class="sim-math">2mgL</span>: mayatnik yuqori nuqtaga cheksiz uzoq vaqt davomida yaqinlashadi — bu tebranish va aylanish chegarasi (separatrisa).</p>`);
  } else if (info.mode === "rest") {
    parts.push(`<p>Mayatnik muvozanat holatida (<span class="sim-math">θ = 0</span>, <span class="sim-math">ω = 0</span>). Burchakni o‘zgartiring yoki sharni torting.</p>`);
  } else if (amp <= 6) {
    parts.push(`<p>Amplituda kichik (<b>${fmt(amp, 1)}°</b>), shuning uchun <span class="sim-math">sin θ ≈ θ</span> va tebranish garmonik: <span class="sim-math">T = T₀ = 2π√(L/g) = ${fmt(t0, 3)} s</span>. Davr amplitudaga ham, massaga ham bog‘liq emas — <b>m</b> ni o‘zgartirib ko‘ring.</p>`);
  } else {
    const ratio = periodRatio(info.amplitude);
    parts.push(`<p>Amplituda <b>${fmt(amp, 0)}°</b> — endi <span class="sim-math">sin θ ≈ θ</span> yaqinlashuvi yaramaydi. Aniq davr <span class="sim-math">T = ${fmt(info.period, 3)} s</span>, kichik burchak formulasi esa <span class="sim-math">T₀ = ${fmt(t0, 3)} s</span> beradi: <b>${fmt((ratio - 1) * 100, ratio < 1.1 ? 1 : 0)}%</b> farq. “Kichik burchak modeli” ni yoqib, ikki mayatnik asta-sekin fazadan chiqib ketishini ko‘ring.</p>`);
  }
  if (P.gamma > 0) {
    const tau = 2 / P.gamma, Q = w0() / P.gamma;
    parts.push(`<p>Ishqalanish (<span class="sim-math">γ = ${fmt(P.gamma, 2)} s⁻¹</span>) energiyani sarflaydi: amplituda har <b>${fmt(tau, 1)} s</b> da e ≈ 2,72 marta kamayadi. ${P.gamma >= 2 * w0() ? "γ ≥ 2ω₀ — harakat tebranmasdan so‘nadi (aperiodik)." : `Sifat omili <span class="sim-math">Q = ω₀/γ = ${fmt(Q, 1)}</span>.`}</p>`);
  }
  if (Math.abs(P.g - 9.81) > 0.01) parts.push(`<p>Bu sayyorada <span class="sim-math">g = ${fmt(P.g, 2)} m/s²</span>, shuning uchun davr Yerdagidan <b>${fmt(Math.sqrt(9.81 / P.g), 2)}</b> marta ${P.g < 9.81 ? "uzun" : "qisqa"}.</p>`);
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }

  stage.canvas.setAttribute("aria-label", `Matematik mayatnik: L = ${fmt(P.L, 2)} m, m = ${fmt(P.m, 1)} kg, g = ${fmt(P.g, 2)} m/s². Hozirgi burchak ${fmt(wr / DEG, 1)}°, davr ${info.period && isFinite(info.period) ? fmt(info.period, 3) + " s" : "aniqlanmagan"}.`);
  setPlayButton();
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { height: (w) => splitHeights(w).stage });
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => splitHeights(w).graph });
const canvas = stage.canvas;
const playBtn = $("[data-play]");

function renderAll() { stage.render(); graph.render(); }

function setPlayButton() {
  const running = loop.running;
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : s.t > 0 ? "Davom ettirish" : "Boshlash";
}

function physicsStep(dt) {
  const p = sim(), pl = simLin();
  const n = Math.max(1, Math.ceil(dt / H_MAX - 1e-9));
  const h = dt / n;
  const sd = sampleDt();
  for (let i = 0; i < n; i++) {
    const nx = rk4(s, p, h), nl = rk4(lin, pl, h);
    meter.feed(s, nx);
    s = nx; lin = nl;
    if (s.t - lastSample >= sd) sample(s, lin);
  }
}

const loop = createLoop((dt) => {
  physicsStep(dt * ui.speed);
  if (!P.driveOn && motionInfo(s, w2()).mode === "rest" && Math.abs(s.th) < 1e-3 && Math.abs(s.w) < 2e-3) { loop.stop(); }
  renderAll();
  updateUI();
}, { onStateChange: () => { setPlayButton(); updateUI(); } });

function afterChange({ keepRunning = true } = {}) {
  resetSim({ keepRunning: keepRunning && loop.running });
  renderAll();
  updateUI();
}

playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  const info = motionInfo(s, w2());
  if (!P.driveOn && info.mode === "rest" && s.t > 0) resetSim(); // muvozanatda qolgan — boshidan
  loop.start();
});
$("[data-reset]").addEventListener("click", () => { afterChange({ keepRunning: false }); });
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));

/* Slayderlar */
const th0Ctl = bindRange($("#th0"), $("#th0Out"), (v) => `${fmt(v, 0)}°`, (v) => { init.th = v * DEG; afterChange(); });
const w0Ctl = bindRange($("#w0"), $("#w0Out"), (v) => `${fmt(v, 1)} rad/s`, (v) => { init.w = v; afterChange(); });
const LCtl = bindRange($("#L"), $("#LOut"), (v) => `${fmt(v, 2)} m`, (v) => { P.L = v; afterChange(); });
const mCtl = bindRange($("#m"), $("#mOut"), (v) => `${fmt(v, 1)} kg`, (v) => { P.m = v; renderAll(); updateUI(); });
const gammaCtl = bindRange($("#gamma"), $("#gammaOut"), (v) => (v === 0 ? "yo‘q" : `${fmt(v, 2)} s⁻¹`), (v) => { P.gamma = v; renderAll(); updateUI(); });
const fCtl = bindRange($("#driveF"), $("#driveFOut"), (v) => `${fmt(v, 2)} rad/s²`, (v) => { P.f = v; updateUI(); });
const rCtl = bindRange($("#driveR"), $("#driveROut"), (v) => `${fmt(v, 2)} ω₀`, (v) => { P.ratio = v; updateUI(); });
const planet = $("#planet"), gOut = $("#gOut");
const syncG = () => { gOut.textContent = `${fmt(P.g, 2)} m/s²`; planet.value = String(P.g); };
planet.addEventListener("change", () => { P.g = Number(planet.value); syncG(); afterChange(); });

function setDrive(on) {
  P.driveOn = on;
  document.querySelector('[data-toggle="drive"]').checked = on;
  document.querySelectorAll("[data-drive-panel]").forEach((el) => { el.hidden = !on; });
}

/* Tayyor holatlar */
const PRESETS = {
  small:     { th: 5,   w: 0, L: 1,     g: 9.81, gamma: 0,    drive: false },
  large:     { th: 120, w: 0, L: 1,     g: 9.81, gamma: 0,    drive: false },
  seconds:   { th: 5,   w: 0, L: 0.994, g: 9.81, gamma: 0,    drive: false },   // T = 2 s  (L = g/π²)
  moon:      { th: 30,  w: 0, L: 1,     g: 1.62, gamma: 0,    drive: false },
  spin:      { th: 0,   w: 7, L: 1,     g: 9.81, gamma: 0,    drive: false },
  damped:    { th: 60,  w: 0, L: 1,     g: 9.81, gamma: 0.35, drive: false },
  resonance: { th: 0,   w: 0, L: 1,     g: 9.81, gamma: 0.15, drive: true, f: 0.1, ratio: 1 },
};
function applyPreset(key) {
  const q = PRESETS[key];
  init.th = q.th * DEG; init.w = q.w;
  P.L = q.L; P.g = q.g; P.gamma = q.gamma;
  th0Ctl.set(q.th); w0Ctl.set(q.w); LCtl.set(q.L); gammaCtl.set(q.gamma); syncG();
  setDrive(q.drive);
  if (q.drive) { P.f = q.f; P.ratio = q.ratio; fCtl.set(q.f); rCtl.set(q.ratio); }
  resetSim();
  lastPreset = key;
  markPreset(key);
  renderAll();
  updateUI();
  loop.start();
}
let lastPreset = null;
// Tanlangan preset tugmasi belgilanadi; parametr qo'lda o'zgartirilsa belgi olinadi
const markPreset = (key) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === key)));
markPreset(null);
document.querySelector(".sim-panel")?.addEventListener("input", () => markPreset(null));
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  const k = cb.dataset.toggle;
  if (k === "drive") { setDrive(cb.checked); updateUI(); return; }
  ui.show[k] = cb.checked;
  renderAll();
}));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = Number(b.dataset.speedValue);
  document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
}));

/* Grafik turlari */
function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab-value]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tabValue === tab)));
  $("[data-graph-title]").textContent = TABS[tab][0];
  $("[data-graph-sub]").textContent = TABS[tab][1];
  graph.canvas.dataset.clickable = String(tab === "phase");
  graph.canvas.setAttribute("aria-label", TABS[tab][0]);
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* Faza portretida bosib boshlang'ich holat tanlash */
function setStateFromPhase(e) {
  const r = graph.canvas.getBoundingClientRect();
  const q = phasePlot.toState(e.clientX - r.left, e.clientY - r.top);
  if (!q) return;
  init.th = clamp(q.th, -179 * DEG, 179 * DEG);
  init.w = clamp(Math.round(q.w * 10) / 10, -10, 10);
  th0Ctl.set(Math.round(init.th / DEG)); w0Ctl.set(init.w);
  resetSim();
  renderAll(); updateUI();
  loop.start();
}
graph.canvas.addEventListener("pointerdown", (e) => { if (ui.tab === "phase") setStateFromPhase(e); });

/* Sharni sudrash */
let drag = null;
function angleFromPointer(e) {
  const r = canvas.getBoundingClientRect();
  const dx = e.clientX - r.left - view.cx, dy = e.clientY - r.top - view.pivotY;
  return clamp(Math.atan2(dx, dy), -179 * DEG, 179 * DEG);
}
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const b = bobAt(view, s.th);
  if (Math.hypot(e.clientX - r.left - b.x, e.clientY - r.top - b.y) > view.r + 16) return;
  drag = { wasRunning: loop.running };
  loop.stop();
  canvas.dataset.dragging = "true";
  canvas.setPointerCapture(e.pointerId);
  init.th = angleFromPointer(e); init.w = 0;
  w0Ctl.set(0); th0Ctl.set(Math.round(init.th / DEG));
  resetSim(); renderAll(); updateUI();
});
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  if (drag) {
    init.th = angleFromPointer(e);
    th0Ctl.set(Math.round(init.th / DEG));
    resetSim(); renderAll(); updateUI();
    return;
  }
  const b = bobAt(view, s.th);
  canvas.style.cursor = Math.hypot(e.clientX - r.left - b.x, e.clientY - r.top - b.y) <= view.r + 16 ? "grab" : "default";
});
const endDrag = () => {
  if (!drag) return;
  drag = null;
  canvas.dataset.dragging = "false";
  loop.start(); // qo'yib yuborish
  renderAll();
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Boshlash */
syncG();
resetSim();
setTab("time");
updateUI();
renderAll();
const q = new URLSearchParams(location.search).get("preset"); // katalogdagi darslik havolalari
if (PRESETS[q]) applyPreset(q);
document.fonts?.ready.then(renderAll);
