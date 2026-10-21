// ==========================================================================
// Qiya tekislik va ishqalanish — simulyatsiya (simulations/inclined-plane.html)
// Fizika: incline-physics.js (tinch/sirpanish ishqalanishi, aniq integratsiya).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { DEG, clamp, fmt, createStage, createLoop, arrow, angleArc, tag, bindRange } from "./sim-kit.js";
import { G, PLANE_LENGTH, BLOCK, X_MIN, X_MAX, dynamics, step, initialState } from "./incline-physics.js";

const $ = (s) => document.querySelector(s);

const p = { theta: 30 * DEG, mu: 0.3, m: 2 };
const ui = { v0: 0, show: { forces: true, components: false, net: true } };
let st = initialState(0);
let started = false;   // "Boshlash" bosilganmi (boshlang'ich holatdan chiqqanmi)

/* ------------------------------------------------------------------ Holat tavsifi */

function phase() {
  const d = dynamics(st.v, p);
  if (st.edge === "bottom" && st.v === 0) return { key: "bottom", d };
  if (d.mode === "rest") return { key: started ? "rest" : (ui.v0 > 0 ? "ready" : "rest-ready"), d };
  if (!started) return { key: "ready", d };
  return { key: d.mode, d };
}

/* ------------------------------------------------------------------ Chizish */

function geometry(w, h) {
  const th = p.theta;
  const c = Math.cos(th), s = Math.sin(th);
  const narrow = w < 560;
  const mL = narrow ? 20 : 36, mR = narrow ? 24 : 36, mT = narrow ? 44 : 70, mB = narrow ? 40 : 46;
  const availW = w - mL - mR - (narrow ? 10 : 40);
  const availH = h - mT - mB;
  const Lp = Math.min(availW / Math.max(c, 0.2), s > 0.01 ? availH / s : Infinity, w * 0.9);
  const run = Lp * c, rise = Lp * s;
  const baseY = h - mB;
  const x0 = mL + Math.max(0, (availW - run) / 2);
  return {
    top: { x: x0, y: baseY - rise },
    bottom: { x: x0 + run, y: baseY },
    corner: { x: x0, y: baseY },
    baseY,
    scale: Lp / PLANE_LENGTH,         // px / m
    d: { x: c, y: s },                // tekislik bo'ylab pastga
    n: { x: s, y: -c },               // tashqi normal
  };
}

function draw(ctx, { w, h, colors: col }) {
  const g = geometry(w, h);
  const ph = phase();
  const d = ph.d;

  // Fon + to'r
  ctx.fillStyle = col.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = col.grid;
  ctx.beginPath();
  for (let x = 0.5; x < w; x += 28) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0.5; y < h; y += 28) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.restore();

  // Yer (pol) — shtrixlangan
  ctx.save();
  ctx.strokeStyle = col.borderStrong;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, g.baseY); ctx.lineTo(w, g.baseY); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  for (let x = -20; x < w + 20; x += 12) { ctx.moveTo(x, g.baseY + 2); ctx.lineTo(x - 10, g.baseY + 12); }
  ctx.stroke();
  ctx.restore();

  // Pona (qiya tekislik)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.top.x, g.top.y);
  ctx.lineTo(g.bottom.x, g.bottom.y);
  ctx.lineTo(g.corner.x, g.corner.y);
  ctx.closePath();
  ctx.fillStyle = col.sunken;
  ctx.fill();
  ctx.globalAlpha = col.dark ? 0.12 : 0.06;
  ctx.fillStyle = col.primary;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col.borderStrong;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Sirt (ishqalanish ko'rsatkichi: μ katta — qalinroq "g'adir-budur" chiziq)
  ctx.beginPath();
  ctx.moveTo(g.top.x, g.top.y);
  ctx.lineTo(g.bottom.x, g.bottom.y);
  ctx.strokeStyle = col.text2;
  ctx.lineWidth = 2.5 + p.mu * 3;
  if (p.mu > 0) ctx.setLineDash([2 + p.mu * 4, 3]);
  ctx.stroke();
  ctx.restore();

  // Tirgak (pastda)
  ctx.save();
  ctx.fillStyle = col.text3;
  const stopX = g.bottom.x, stopY = g.bottom.y;
  ctx.translate(stopX, stopY);
  ctx.rotate(p.theta);
  ctx.fillRect(-4, -18, 6, 18);
  ctx.restore();

  // θ burchak
  if (p.theta > 0.5 * DEG) {
    const R = clamp(g.scale * 0.9, 36, 70);
    angleArc(ctx, g.bottom.x, g.bottom.y, R, Math.PI, Math.PI + p.theta, col.primary, { label: "θ", labelR: R + 16 });
  }

  // Jism
  const S = BLOCK * g.scale;
  const px = g.top.x + g.d.x * st.x * g.scale;
  const py = g.top.y + g.d.y * st.x * g.scale;
  const cx = px + g.n.x * S / 2, cy = py + g.n.y * S / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.theta);
  ctx.fillStyle = col.success;
  ctx.shadowColor = "rgb(0 0 0 / 0.18)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(-S / 2, -S / 2, S, S, Math.min(8, S * 0.15));
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${clamp(S * 0.2, 10, 13)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${fmt(p.m, p.m % 1 ? 1 : 0)} kg`, -S * 0.2, -S * 0.24);
  ctx.restore();

  // Kuchlar (masshtab: mg -> Fpx)
  const mg = p.m * G;
  const Fpx = clamp(Math.min(w, h) * 0.2, 60, 120);
  const k = Fpx / mg;
  const fontV = "italic 700 14px 'Times New Roman', serif";
  if (ui.show.components) {
    arrow(ctx, cx, cy, g.d.x * d.gPar * k, g.d.y * d.gPar * k, col.special, { dash: [5, 4], width: 2, label: "mg sinθ", font: "italic 600 12px 'Times New Roman', serif" });
    const perp = mg * Math.cos(p.theta);
    arrow(ctx, cx, cy, -g.n.x * perp * k, -g.n.y * perp * k, col.special, { dash: [5, 4], width: 2, label: "mg cosθ", font: "italic 600 12px 'Times New Roman', serif" });
  }
  if (ui.show.forces) {
    arrow(ctx, cx, cy, 0, mg * k, col.special, { label: "mg", font: fontV });
    arrow(ctx, cx, cy, g.n.x * d.N * k, g.n.y * d.N * k, col.primary, { label: "N", font: fontV });
    if (Math.abs(d.friction) > 1e-6) {
      // Ishqalanish kuchi sirt bo'ylab — jism tagida
      const bx = px + g.n.x * 4, by = py + g.n.y * 4;
      arrow(ctx, bx, by, g.d.x * d.friction * k, g.d.y * d.friction * k, col.danger, { label: d.kind === "static" ? "Fₜ" : "F", font: fontV });
    }
  }
  if (ui.show.net) {
    const Fnet = p.m * d.a;
    if (Math.abs(Fnet) > 1e-6) {
      const ox = cx + g.n.x * (S * 0.5 + 18), oy = cy + g.n.y * (S * 0.5 + 18);
      arrow(ctx, ox, oy, g.d.x * Fnet * k, g.d.y * Fnet * k, col.warning, { width: 3, label: "ma", font: fontV });
    }
  }

  // Legenda
  const items = [];
  if (ui.show.forces) items.push(["mg", col.special], ["N", col.primary], [d.kind === "static" ? "Fₜ (tinch)" : "F ishq.", col.danger]);
  if (ui.show.net) items.push(["ma", col.warning]);
  let lx = w - 14;
  const ly = w < 560 ? h - 16 : 22;   // tor ekranda — pastki o'ng burchakda
  ctx.save();
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  for (const [label, color] of items.reverse()) {
    const tw = ctx.measureText(label).width;
    lx -= tw;
    ctx.fillStyle = col.text2;
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx, ly);
    lx -= 18;
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly - 2, 12, 4);
    lx -= 14;
  }
  ctx.restore();

  // Holat yorlig'i
  if (ph.key === "rest" || ph.key === "rest-ready") {
    tag(ctx, d.kind === "static" ? "Tinch ishqalanish jismni ushlab turibdi" : "Jism tinch", 14, 22, { color: col.success, bg: col.bg });
  } else if (ph.key === "bottom") {
    tag(ctx, `Pastga yetdi: v = ${fmt(st.vHit, 2)} m/s`, 14, 22, { color: col.primary, bg: col.bg });
  }
}

/* ------------------------------------------------------------------ UI */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

const STATUS = {
  ready: ["Tayyor — «Boshlash»ni bosing", "blue"],
  "rest-ready": ["Jism tinch turadi", "green"],
  down: ["Pastga sirpanmoqda", "orange"],
  up: ["Yuqoriga harakatlanmoqda", "purple"],
  rest: ["Jism tinch turibdi", "green"],
  bottom: ["Pastga yetib keldi", "blue"],
};

function updateUI() {
  const ph = phase();
  const d = ph.d;
  // Boshlanmagan holatda keyingi harakat tezlanishini ko'rsatamiz
  const dd = !started && ui.v0 > 0 ? dynamics(-ui.v0, p) : (!started ? dynamics(0, p) : d);
  const a = dd.a;
  const tanT = Math.tan(p.theta);
  const theta0 = Math.atan(p.mu) / DEG;
  const thetaDeg = p.theta / DEG;

  setReadout("a", `${fmt(Math.abs(a), 2)}<small>m/s²</small>`,
    Math.abs(a) < 1e-9 ? "Tezlanish yo‘q" : dd.mode === "up" ? "Pastga yo‘nalgan — jism sekinlashadi" : "Tekislik bo‘ylab pastga");
  const v = ph.key === "bottom" ? st.vHit : Math.abs(st.v);
  setReadout("v", `${fmt(v, 2)}<small>m/s</small>`, ph.key === "bottom" ? "Tirgakka urilish paytida" : st.v < 0 ? "Yuqoriga" : st.v > 0 ? "Pastga" : "Jism tinch");
  setReadout("t", `${fmt(st.t, 2)}<small>s</small>`, `Bosib o‘tilgan yo‘l: ${fmt(st.s, 2)} m`);
  setReadout("f", `${fmt(Math.abs(dd.friction), 2)}<small>N</small>`,
    dd.kind === "static" ? `Tinch: mg sinθ ga teng (maks. μN = ${fmt(p.mu * dd.N, 2)} N)` : dd.kind === "kinetic" ? "Sirpanish: F = μN" : "Ishqalanish yo‘q");
  setReadout("n", `${fmt(dd.N, 2)}<small>N</small>`, `mg = ${fmt(p.m * G, 1)} N, mg sinθ = ${fmt(dd.gPar, 2)} N`);
  setReadout("crit", `${fmt(theta0, 1)}°`, thetaDeg <= theta0 + 1e-9 ? `θ = ${fmt(thetaDeg, 0)}° ≤ θ₀ — tinch tura oladi` : `θ = ${fmt(thetaDeg, 0)}° > θ₀ — sirpanadi`);

  const [text, tone] = STATUS[ph.key];
  const status = $("[data-status]");
  status.textContent = text;
  status.dataset.tone = tone;

  // Tushuntirish
  const ex = $("[data-explain]");
  const th = fmt(thetaDeg, 0), mu = fmt(p.mu, 2);
  const holds = tanT <= p.mu + 1e-9;
  let html = `<p><span class="sim-math">tg ${th}° = ${fmt(tanT, 3)}</span> ${holds ? "≤" : ">"} <span class="sim-math">μ = ${mu}</span>. `;
  html += holds
    ? `Og‘irlikning tekislik bo‘ylab tashkil etuvchisi (<b>${fmt(dd.gPar, 2)} N</b>) maksimal tinch ishqalanishdan (<b>${fmt(p.mu * dd.N, 2)} N</b>) oshmaydi, shuning uchun <b>tinch turgan jism sirpanmaydi</b>. Tinch ishqalanish kuchi aynan <span class="sim-math">mg sin θ</span> ga teng bo‘lib, uni muvozanatlaydi — u har doim ham μN ga teng emas!</p>`
    : `Og‘irlikning tekislik bo‘ylab tashkil etuvchisi (<b>${fmt(dd.gPar, 2)} N</b>) maksimal tinch ishqalanishdan (<b>${fmt(p.mu * dd.N, 2)} N</b>) katta — jism <b>pastga sirpanadi</b>, tezlanishi <span class="sim-math">a = g(sin θ − μ cos θ) = ${fmt(G * (Math.sin(p.theta) - p.mu * Math.cos(p.theta)), 2)} m/s²</span>.</p>`;
  if (ui.v0 > 0) {
    const aUp = G * (Math.sin(p.theta) + p.mu * Math.cos(p.theta));
    const dist = (ui.v0 * ui.v0) / (2 * aUp);
    html += `<p>Jism yuqoriga <b>${fmt(ui.v0, 1)} m/s</b> tezlik bilan turtiladi. Yuqoriga harakatda og‘irlik ham, ishqalanish ham pastga yo‘nalgan, shuning uchun sekinlanish katta: <span class="sim-math">a = g(sin θ + μ cos θ) = ${fmt(aUp, 2)} m/s²</span>. Jism taxminan <b>${fmt(dist, 2)} m</b> ko‘tarilib to‘xtaydi${dist > X_MAX - X_MIN ? " (tekislik uchiga yetib boradi)" : ""}, so‘ng ${holds ? "<b>o‘sha joyda qoladi</b>" : "<b>pastga sirpanib tushadi</b>"}. Ishqalanish kuchi yo‘nalishi harakat yo‘nalishiga qarab almashishiga e’tibor bering.</p>`;
  } else {
    html += `<p>Massa tezlanishga ta’sir qilmaydi: barcha kuchlar <i>m</i> ga proporsional. Lekin kuchlarning o‘zi (N, F) massaga bog‘liq.</p>`;
  }
  ex.innerHTML = html;

  stage.canvas.setAttribute("aria-label", `Qiya tekislik: burchak ${th} daraja, μ = ${mu}, massa ${fmt(p.m, 1)} kg. ${text}.`);

  document.querySelectorAll("[data-preset]").forEach((b) => {
    const [t, m, v] = b.dataset.preset.split(",").map(Number);
    b.setAttribute("aria-pressed", String(Math.abs(t - thetaDeg) < 0.01 && Math.abs(m - p.mu) < 0.001 && Math.abs(v - ui.v0) < 0.001));
  });
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { aspect: 0.6, minHeight: 300, maxHeight: 560 });
const playBtn = $("[data-play]");

function setPlayButton(running) {
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : started && phase().key !== "bottom" && phase().key !== "rest" ? "Davom ettirish" : "Boshlash";
}

const loop = createLoop((dt) => {
  step(st, p, dt);
  const key = phase().key;
  if (key === "bottom" || key === "rest") loop.stop();
  stage.render();
  updateUI();
}, { onStateChange: setPlayButton });

function reset() {
  loop.stop();
  st = initialState(ui.v0);
  started = false;
  stage.render();
  updateUI();
  setPlayButton(false);
}

playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  const key = phase().key;
  if (key === "bottom" || (started && key === "rest")) reset();
  started = true;
  loop.start();
  updateUI();
});
$("[data-reset]").addEventListener("click", reset);
$("[data-reset] [data-reset-icon]")?.remove();
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));

const onParam = () => {
  // Parametr o'zgarganda: harakat davom etsa — yangi qiymat bilan davom etadi;
  // jism to'xtagan bo'lsa, yangi sharoitda sirpanishi mumkin — "Davom ettirish" bilan.
  stage.render();
  updateUI();
  setPlayButton(loop.running);
};

const thetaCtl = bindRange($("#theta"), $("#thetaOut"), (v) => `${fmt(v, 0)}°`, (v) => { p.theta = v * DEG; onParam(); });
const muCtl = bindRange($("#mu"), $("#muOut"), (v) => fmt(v, 2), (v) => { p.mu = v; onParam(); });
bindRange($("#mass"), $("#massOut"), (v) => `${fmt(v, 1)} kg`, (v) => { p.m = v; onParam(); });
const v0Ctl = bindRange($("#v0"), $("#v0Out"), (v) => `${fmt(v, 1)} m/s`, (v) => { ui.v0 = v; reset(); });

document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
  const [t, m, v] = b.dataset.preset.split(",").map(Number);
  p.theta = t * DEG; p.mu = m; ui.v0 = v;
  thetaCtl.set(t); muCtl.set(m); v0Ctl.set(v);
  reset();
}));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  ui.show[cb.dataset.toggle] = cb.checked;
  stage.render();
}));

reset();
document.fonts?.ready.then(() => stage.render());
