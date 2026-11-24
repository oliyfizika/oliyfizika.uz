import { createInclineLab } from "./mechanics-3d.js?v=20261122";
import { bindLabCamera, labStageHeight } from "./lab-3d.js?v=20261122";
// ==========================================================================
// Qiya tekislik va ishqalanish — simulyatsiya (simulations/inclined-plane.html)
// Fizika: incline-physics.js (tinch/sirpanish ishqalanishi, aniq integratsiya).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { DEG, clamp, fmt, createStage, createLoop, bindRange } from "./sim-kit.js";
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

const scene = createInclineLab();
function draw(ctx, stage) { scene.draw(ctx, stage, p, st, ui.show); }

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

const stage = createStage($("#stage"), draw, { height: labStageHeight });
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

bindLabCamera(stage.canvas, scene.lab, () => stage.render(), {
  start() { loop.stop(); },
  move(id, pointer) {
    if (id === "angle") {
      p.theta = Math.round(scene.angle(pointer.x, pointer.y) / DEG) * DEG;
      thetaCtl.set(Math.round(p.theta / DEG)); onParam();
    } else {
      st.x = clamp(scene.position(pointer.x, pointer.y), X_MIN, X_MAX);
      st.v = 0; st.t = 0; st.s = 0; st.edge = null; st.vHit = 0;
      started = false; updateUI(); setPlayButton(false);
    }
  },
  end(id, cancelled) { if (id === "block" && !cancelled) { started = true; loop.start(); updateUI(); } },
});

reset();
document.fonts?.ready.then(() => stage.render());
