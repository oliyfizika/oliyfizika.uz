// ==========================================================================
// Og'irlik kuchi ta'sirida jism harakati — simulyatsiya (simulations/projectile.html)
// Burchak ostida otish (parabola) + vertikal yuqoriga/pastga otish va erkin tushish — bitta qonun, a = g.
// Fizika: projectile-physics.js (analitik yechim). Grafiklar: projectile-plots.js.
// Masshtab avtomatik: butun trayektoriya (va oldingi izlar) har doim ko'rinadi, x va y bir xil masshtabda.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { DEG, clamp, fmt, createStage, createLoop, arrow, angleArc, tag, bindRange } from "./sim-kit.js";
import { solve, stateAt, energiesAt, niceStep } from "./projectile-physics.js";
import { splitHeights } from "./pendulum-plots.js";
import { drawFlightPlot, timeFromPointer } from "./projectile-plots.js";

const $ = (s) => document.querySelector(s);
const ITALIC = "italic 700 13px 'Times New Roman', serif";
const SMALL = "600 11px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const p = { v0: 20, alpha: 45 * DEG, h0: 0, g: 9.8 };
const ui = { speed: 1, kind: "angle", tab: "y", angleMemo: 45 * DEG, show: { preview: true, velocity: true, components: true, gravity: true, markers: true } };
let sol = solve(p);
let flight = null;          // { p, sol, t, landed }
let traces = [];            // oldingi otishlar: { p, sol }
const MAX_TRACES = 5;

const curP = () => (flight ? flight.p : p);
const curSol = () => (flight ? flight.sol : sol);

/* ------------------------------------------------------------------ Masshtab */

let view = null;

function computeView(w, h) {
  const narrow = w < 560;
  const padL = narrow ? 40 : 54, padR = narrow ? 14 : 24, padT = narrow ? 30 : 34, padB = 30;
  const cs = curSol(), cp = curP();
  const vertical = cs.vertical;
  const list = vertical ? [{ p: cp, sol: cs }] : [...traces.map((t) => ({ p: t.p, sol: t.sol })), { p: cp, sol: cs }];
  let xMax = 0, yMax = 0;
  list.forEach(({ p: pp, sol: ss }) => { xMax = Math.max(xMax, ss.L); yMax = Math.max(yMax, ss.H, pp.h0); });
  xMax = Math.max(xMax * 1.08, 10);
  yMax = Math.max(yMax * 1.15, 5);
  const axisX = padL + 16;
  const plotW = w - axisX - padR, plotH = h - padT - padB;
  const s = vertical ? plotH / yMax : Math.min(plotW / xMax, plotH / yMax);
  const ox = vertical ? axisX + plotW / 2 : axisX;
  const vRef = Math.max(cp.v0, 5);
  const kv = vertical ? clamp((0.4 * plotH) / Math.max(vRef, Math.abs(cs.vy - cp.g * cs.T), 10), 1.5, 6) : clamp((0.28 * Math.min(plotW, plotH)) / 25, 2, 6);
  return { s, kv, ox, axisX, oy: h - padB, w, h, plotW, plotH, padT, padR, xMax: vertical ? 0 : plotW / s, yMax: plotH / s, vertical };
}

const X = (x) => view.ox + x * view.s;
const Y = (y) => view.oy - y * view.s;

/* ------------------------------------------------------------------ Chizish */

function drawAxes(ctx, c) {
  const { axisX, oy, w, padT, vertical } = view;
  const span = vertical ? view.yMax : Math.max(view.xMax, view.yMax);
  const step = niceStep(span, w < 560 ? 4 : 7);
  ctx.save();
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (!vertical) for (let x = step; x <= view.xMax + 1e-9; x += step) { ctx.moveTo(X(x) + 0.5, padT - 10); ctx.lineTo(X(x) + 0.5, oy); }
  for (let y = step; y <= view.yMax + 1e-9; y += step) { ctx.moveTo(axisX, Y(y) + 0.5); ctx.lineTo(w - 8, Y(y) + 0.5); }
  ctx.stroke();

  ctx.fillStyle = c.sunken;
  ctx.fillRect(0, oy, w, view.h - oy);
  ctx.strokeStyle = c.borderStrong;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();

  ctx.fillStyle = c.text3;
  ctx.font = "500 11px Inter, system-ui, sans-serif";
  const digits = step < 1 ? 1 : 0;
  if (!vertical) {
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const lMark = ui.show.markers ? X(curSol().L) : -1e9;
    for (let x = 0; x <= view.xMax + 1e-9; x += step) if (Math.abs(X(x) - lMark) > 34) ctx.fillText(fmt(x, digits), X(x), oy + 8);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("x, m", w - 10, oy - 12);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let y = step; y <= view.yMax + 1e-9; y += step) ctx.fillText(fmt(y, digits), axisX - 22, Y(y));
  ctx.textAlign = "left";
  ctx.fillText("y, m", 8, padT - 18);
  ctx.restore();
}

function pathOf(ctx, pp, tEnd) {
  const n = 120;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const st = stateAt(pp, (tEnd * i) / n);
    if (i === 0) ctx.moveTo(X(st.x), Y(st.y)); else ctx.lineTo(X(st.x), Y(st.y));
  }
}

function drawLauncher(ctx, c, pp, vertical) {
  if (pp.h0 > 0) {
    ctx.save();
    ctx.fillStyle = c.sunken;
    ctx.strokeStyle = c.borderStrong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(X(0) - (vertical ? 30 : 18), Y(pp.h0), vertical ? 22 : 18, view.oy - Y(pp.h0));
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (pp.v0 <= 0 && vertical) return;
  ctx.save();
  ctx.translate(X(0), Y(pp.h0));
  ctx.fillStyle = c.text2;
  ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI, 0); ctx.fill();
  ctx.rotate(-pp.alpha);
  ctx.fillRect(0, -4, 22, 8);
  ctx.restore();
}

function draw(ctx, stage) {
  const { w, h, colors: c } = stage;
  view = computeView(w, h);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  drawAxes(ctx, c);

  const cur = curP(), cs = curSol(), vertical = cs.vertical;

  // Oldingi izlar (faqat egri trayektoriyalar)
  if (!vertical) traces.forEach((tr, i) => {
    if (tr.sol.vertical) return;
    if (flight?.landed && i === traces.length - 1) return;
    ctx.save();
    ctx.strokeStyle = c.text3;
    ctx.globalAlpha = 0.35 + 0.4 * ((i + 1) / traces.length);
    ctx.lineWidth = 2;
    pathOf(ctx, tr.p, tr.sol.T);
    ctx.stroke();
    ctx.restore();
    tag(ctx, `${fmt(tr.p.alpha / DEG, 0)}°`, X(tr.sol.xTop), Y(tr.sol.H) - 14, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  });

  // Bashorat
  if (ui.show.preview && (!flight || !flight.landed) && cs.T > 0) {
    ctx.save();
    ctx.strokeStyle = c.primary;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    pathOf(ctx, cur, cs.T);
    ctx.stroke();
    ctx.restore();
  }

  drawLauncher(ctx, c, cur, vertical);

  // Belgilar: H va L
  if (ui.show.markers) {
    if (cs.tTop > 0) {
      ctx.save();
      ctx.strokeStyle = c.success; ctx.lineWidth = 1.25; ctx.setLineDash([3, 4]);
      if (vertical) { ctx.beginPath(); ctx.moveTo(view.axisX, Y(cs.H)); ctx.lineTo(X(0) + 40, Y(cs.H)); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(X(cs.xTop), Y(cs.H)); ctx.lineTo(X(cs.xTop), view.oy); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = c.success;
      ctx.beginPath(); ctx.arc(X(cs.xTop), Y(cs.H), 3.5, 0, Math.PI * 2); ctx.fill();
      tag(ctx, `H = ${fmt(cs.H, 1)} m`, X(cs.xTop) + (vertical ? 44 : 8), Y(cs.H) - (vertical ? 0 : 14), { color: c.success, bg: c.bg });
    }
    if (!vertical) {
      ctx.save();
      ctx.fillStyle = c.danger;
      ctx.beginPath();
      ctx.moveTo(X(cs.L), view.oy); ctx.lineTo(X(cs.L) - 6, view.oy - 10); ctx.lineTo(X(cs.L) + 6, view.oy - 10); ctx.closePath();
      ctx.fill();
      ctx.restore();
      tag(ctx, `L = ${fmt(cs.L, 1)} m`, clamp(X(cs.L), 50, w - 50), view.oy + 21, { color: c.danger, bg: c.bg, align: "center" });
    }
  }

  // Joriy uchish: iz + stroboskop + jism + vektorlar
  let st = stateAt(cur, 0);
  if (flight) {
    const t = flight.t;
    st = stateAt(cur, t);
    ctx.save();
    ctx.strokeStyle = c.primary;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    pathOf(ctx, cur, t);
    ctx.stroke();
    // Teng vaqt oraliqlaridagi holatlar (vertikalda yon tomonga siljitilgan: yuqoriga va pastga yo'l ustma-ust tushmasin)
    const dtS = niceStep(cs.T, 12), off = vertical ? 26 : 0;
    ctx.fillStyle = c.primary;
    ctx.globalAlpha = 0.55;
    for (let k = dtS; k < t; k += dtS) {
      const q = stateAt(cur, k);
      ctx.beginPath(); ctx.arc(X(q.x) + off, Y(q.y), 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  const bx = X(st.x), by = Y(st.y);
  const vmaxPx = view.plotH * 0.5;
  if (ui.show.components && !vertical && (flight || p.v0 > 0)) {
    arrow(ctx, bx, by, st.vx * view.kv, 0, c.primary, { width: 2, dash: [5, 4], label: "vₓ", font: ITALIC });
    arrow(ctx, bx, by, 0, clamp(-st.vy * view.kv, -vmaxPx, vmaxPx), c.success, { width: 2, dash: [5, 4], label: "vy", font: ITALIC });
  }
  if (ui.show.velocity) {
    const dx = st.vx * view.kv, dy = clamp(-st.vy * view.kv, -vmaxPx, vmaxPx);
    arrow(ctx, bx, by, dx, dy, c.warning, { width: 3, label: "v", font: "italic 700 15px 'Times New Roman', serif" });
  }
  if (ui.show.gravity) {
    const len = clamp(cur.g * 2.2, 14, 62);
    arrow(ctx, bx + (vertical ? 16 : 14), by, 0, len, c.special, { width: 2.5, head: 8, label: "g", font: ITALIC });
  }

  // Jism
  ctx.save();
  ctx.fillStyle = c.primary;
  ctx.strokeStyle = c.bg;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  // Burchak
  if (!flight && !vertical && p.alpha > 1 * DEG) angleArc(ctx, X(0), Y(p.h0), 34, 0, -p.alpha, c.text2, { label: "α", labelR: 48 });

  // Sudrash dastagi
  handle.x = X(0) + Math.cos(p.alpha) * p.v0 * view.kv;
  handle.y = Y(p.h0) - Math.sin(p.alpha) * p.v0 * view.kv;
  if (!flight) {
    ctx.save();
    ctx.fillStyle = c.bg; ctx.strokeStyle = c.warning; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(handle.x, handle.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  tag(ctx, `t = ${fmt(flight ? flight.t : 0, 2)} s`, w - 12, 18, { color: c.text2, bg: c.bg2, align: "right", font: "600 12px Inter, system-ui, sans-serif" });
}
const handle = { x: 0, y: 0 };
let lastExplain = "";

/* ------------------------------------------------------------------ UI */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

const optimalAngle = (pp) => Math.atan(pp.v0 / Math.sqrt(pp.v0 * pp.v0 + 2 * pp.g * pp.h0));
const sq = (x) => `<span class="sim-math">${x}</span>`;

function updateUI() {
  const cur = curP(), cs = curSol();
  const t = flight ? flight.t : 0;
  const st = stateAt(cur, t);
  const v = Math.hypot(st.vx, st.vy);
  const en = energiesAt(cur, t);
  const vert = cs.vertical;
  const a = cur.alpha / DEG;
  const free = cur.v0 <= 0;

  setReadout("t", `${fmt(t, 2)}<small>s</small>`, flight?.landed ? "Harakat tugadi" : flight ? "Harakat davom etmoqda" : "Otishdan oldin");
  setReadout("xy", `${fmt(st.x, 1)}; ${fmt(Math.max(0, st.y), 1)}<small>m</small>`, vert ? `vy = ${fmt(st.vy, 1)} m/s` : `vₓ = ${fmt(st.vx, 1)} m/s, vy = ${fmt(st.vy, 1)} m/s`);
  setReadout("v", `${fmt(v, 1)}<small>m/s</small>`,
    Math.abs(st.vy) < 0.05 && cs.tTop > 0 && flight ? (vert ? "Eng yuqori nuqta: v = 0" : "Eng yuqori nuqta: v = vₓ") : st.vy > 0 ? "Ko‘tarilmoqda — v kamaymoqda" : st.vy < 0 ? "Tushmoqda — v ortmoqda" : "Boshlang‘ich holat");
  setReadout("a", `${fmt(-cur.g, 2)}<small>m/s²</small>`, "Doim pastga, o‘zgarmas");
  setReadout("e", `${fmt(en.tot, 1)}<small>J/kg</small>`, `K = ${fmt(en.kin, 1)} · U = ${fmt(en.pot, 1)} (saqlanadi)`);
  setReadout("H", `${fmt(cs.H, 1)}<small>m</small>`, cs.tTop > 0 ? `${fmt(cs.tTop, 2)} s da erishiladi` : "Otish nuqtasi eng baland");
  setReadout("T", `${fmt(cs.T, 2)}<small>s</small>`, cs.tTop > 0 && cur.h0 === 0 ? `Ko‘tarilish ${fmt(cs.tTop, 2)} s + tushish ${fmt(cs.T - cs.tTop, 2)} s` : "Yerga tushguncha");
  setReadout("L", `${fmt(cs.L, 1)}<small>m</small>`, vert ? "Vertikal harakat — gorizontal siljish yo‘q" : `Tushish burchagi ${fmt(cs.landAngle / DEG, 1)}°`);
  setReadout("vL", `${fmt(cs.vLand, 1)}<small>m/s</small>`, cur.h0 === 0 ? (vert ? "Otilgan tezlikka teng (h₀ = 0)" : "Otilgan tezlikka teng: v² = v₀² + 2gh₀") : `v² = v₀² + 2gh₀`);

  const status = $("[data-status]");
  const [text, tone] = !flight ? ["Tayyor", "blue"] : flight.landed ? ["Yerga tushdi", "green"] : loop.running ? [vert && free ? "Tushmoqda" : "Uchmoqda", "orange"] : ["Pauza", "purple"];
  status.textContent = text;
  status.dataset.tone = tone;

  // Tushuntirish
  let html = "";
  if (vert && free) {
    html += `<p><b>Erkin tushish.</b> Jism ${fmt(cur.h0, 0)} m balandlikdan boshlang‘ich tezliksiz qo‘yib yuboriladi. Faqat og‘irlik kuchi ta’sir qiladi, shuning uchun tezlik har soniyada <b>${fmt(cur.g, 2)} m/s</b> ga ortadi: ${sq(`t = √(2h/g) = ${fmt(cs.T, 2)} s`)}, ${sq(`v = √(2gh) = ${fmt(cs.vLand, 1)} m/s`)}. Jism massasi hech qayerda uchramaydi — hamma jismlar bir xil tushadi.</p>`;
  } else if (vert && a > 0) {
    html += `<p><b>Vertikal yuqoriga otish.</b> Tezlik har soniyada <b>${fmt(cur.g, 2)} m/s</b> ga kamayadi: ${sq("v = v₀ − gt")}. ${fmt(cs.tTop, 2)} s dan so‘ng <span class="sim-math">v = 0</span> — jism eng yuqori nuqtada (${sq(`H = v₀²/(2g) = ${fmt(cs.H, 1)} m`)}), so‘ng tusha boshlaydi.${cur.h0 === 0 ? ` Ko‘tarilish va tushish vaqti teng (${sq(`T = 2v₀/g = ${fmt(cs.T, 2)} s`)}), yerga urilish tezligi otilgan tezlikka teng. Bir xil balandlikdan o‘tishda tezliklar moduli teng — grafikda <i>v(t)</i> to‘g‘ri chiziq ekanini ko‘ring.` : ` Balandlik ${fmt(cur.h0, 0)} m bo‘lgani uchun jism otish nuqtasidan ham pastga tushadi: ${sq(`v² = v₀² + 2gh₀`)}.`}</p>`;
  } else if (vert) {
    html += `<p><b>Vertikal pastga otish.</b> Boshlang‘ich tezlik ${fmt(cur.v0, 1)} m/s pastga yo‘nalgan, og‘irlik kuchi uni yanada oshiradi: ${sq(`v = v₀ + gt`)}. Yerga ${fmt(cs.T, 2)} s da, ${fmt(cs.vLand, 1)} m/s tezlik bilan uriladi. Pastga otish uchun balandlik (h₀ &gt; 0) kerak.</p>`;
  } else {
    html += `<p>Gorizontal yo‘nalishda tezlik o‘zgarmaydi (${sq(`vₓ = ${fmt(cs.vx, 1)} m/s`)}) — teng vaqt oraliqlaridagi nuqtalar gorizontal bo‘yicha teng masofada joylashadi. Vertikal tezlik har soniyada <b>${fmt(cur.g, 2)} m/s</b> ga kamayadi, eng yuqori nuqtada ${sq("v<sub>y</sub> = 0")}. Ikkala harakat bir-biriga bog‘liq emas: <b>“Vertikal”</b> tugmasi bilan faqat vertikal tashkil etuvchini ko‘ring.</p>`;
    const best = optimalAngle(cur) / DEG;
    if (cur.h0 === 0 && a > 0 && a < 90) {
      const comp = 90 - a;
      html += Math.abs(a - 45) < 0.5
        ? `<p><b>α = 45°</b> — bir xil tezlikda eng katta uchish uzoqligi shu burchakda bo‘ladi, chunki ${sq("sin 2α = 1")}.</p>`
        : `<p><b>${fmt(a, 0)}°</b> va <b>${fmt(comp, 0)}°</b> burchaklarda uchish uzoqligi bir xil (${sq("sin 2α")} teng), lekin katta burchakda (<b>${fmt(Math.max(a, comp), 0)}°</b>) jism balandroq ko‘tariladi va havoda uzoqroq bo‘ladi. Ikkalasini ketma-ket oting — izlar saqlanib qoladi.</p>`;
    } else if (cur.h0 > 0) {
      html += `<p>Jism <b>${fmt(cur.h0, 0)} m</b> balandlikdan otilmoqda. Bunda eng uzoqqa otish burchagi 45° emas, balki <b>${fmt(best, 1)}°</b> (${sq("tg α* = v₀ / √(v₀² + 2gh₀)")}).${a === 0 ? ` α = 0° — gorizontal otish: tushish vaqti faqat balandlikka bog‘liq, ${sq("T = √(2h₀/g)")}.` : ""}</p>`;
    }
  }
  html += `<p>Energiya: ${sq("v²/2 + gy = " + fmt(en.tot, 1) + " J/kg")} — ko‘tarilganda kinetik energiya potensialga aylanadi, tushganda teskari; to‘liq energiya o‘zgarmaydi (energiya grafigiga qarang).</p>`;
  if (cur.g !== 9.8) html += `<p>Bu yerda ${sq(`g = ${fmt(cur.g, 2)} m/s²`)}: jism sekinroq (tezroq) tezlashadi — uchish vaqti va balandlik Yerdagidan ${fmt(9.8 / cur.g, 2)} marta farq qiladi (v₀ bir xil bo‘lsa).</p>`;
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }

  stage.canvas.setAttribute("aria-label", `${vert ? (free ? "Erkin tushish" : a > 0 ? "Vertikal yuqoriga otish" : "Vertikal pastga otish") : "Burchak ostida otish"}: α = ${fmt(a, 0)}°, v0 = ${fmt(cur.v0, 1)} m/s, h0 = ${fmt(cur.h0, 0)} m, g = ${fmt(cur.g, 2)} m/s². Uchish vaqti ${fmt(cs.T, 2)} s, maksimal balandlik ${fmt(cs.H, 1)} m.`);

  document.querySelectorAll("[data-preset]").forEach((b) => {
    const [kind, al, v0, h0, g] = b.dataset.preset.split(",");
    b.setAttribute("aria-pressed", String(kind === ui.kind && Math.abs(Number(al) - p.alpha / DEG) < 0.01 && Number(v0) === p.v0 && Number(h0) === p.h0 && Number(g) === p.g));
  });
  setPlayButton();
}

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  y: ["Balandlikning vaqtga bog‘liqligi y(t)", "Bosib harakatning istalgan paytini tanlang · yashil nuqta — eng yuqori nuqta"],
  v: ["Tezlikning vaqtga bog‘liqligi v(t)", "Tezlik chiziqli o‘zgaradi: qiyalik −g (tezlanish o‘zgarmas) · v = 0 — eng yuqori nuqta"],
  e: ["Energiyaning vaqtga bog‘liqligi (1 kg massaga)", "Kinetik va potensial energiya almashinadi, to‘liq energiya o‘zgarmaydi"],
};

function drawGraphCanvas(ctx, st) {
  drawFlightPlot(ui.tab, ctx, st, { p: curP(), sol: curSol(), t: flight ? flight.t : null });
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { height: (w) => splitHeights(w).stage });
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => splitHeights(w).graph });
const canvas = stage.canvas;
const playBtn = $("[data-play]");

function renderAll() { stage.render(); graph.render(); }

function setPlayButton() {
  const running = loop.running;
  const label = running ? "Pauza" : flight && !flight.landed ? "Davom" : "Otish";
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = label;
}

const loop = createLoop((dt) => {
  if (!flight) return;
  flight.t += dt * ui.speed;
  if (flight.t >= flight.sol.T) {
    flight.t = flight.sol.T;
    flight.landed = true;
    traces.push({ p: { ...flight.p }, sol: flight.sol });
    if (traces.length > MAX_TRACES) traces.shift();
    loop.stop();
  }
  renderAll();
  updateUI();
}, { onStateChange: () => { setPlayButton(); if (flight) updateUI(); } });

function launch() {
  if (sol.T <= 0) return;
  flight = { p: { ...p }, sol, t: 0, landed: false };
  loop.start();
  renderAll();
  updateUI();
}

playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (flight && !flight.landed) { loop.start(); return; }
  launch();
});
$("[data-reset]").addEventListener("click", () => { loop.stop(); flight = null; renderAll(); updateUI(); });
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));
$("[data-clear]").addEventListener("click", () => {
  traces = [];
  if (flight?.landed) flight = null;
  renderAll(); updateUI();
});

function onParam() {
  sol = solve(p);
  if (flight) { loop.stop(); flight = null; }
  renderAll();
  updateUI();
}

/* Slayderlar */
const alphaCtl = bindRange($("#alpha"), $("#alphaOut"), (v) => `${fmt(v, 0)}°`, (v) => { p.alpha = v * DEG; ui.angleMemo = p.alpha; onParam(); });
const v0Ctl = bindRange($("#v0"), $("#v0Out"), (v) => `${fmt(v, 1)} m/s`, (v) => { p.v0 = v; onParam(); });
const h0Ctl = bindRange($("#h0"), $("#h0Out"), (v) => `${fmt(v, 0)} m`, (v) => { p.h0 = v; if (ui.kind === "vertical" && p.h0 === 0 && p.alpha < 0) setDir(1, false); onParam(); });
const planet = $("#planet"), gOut = $("#gOut");
const syncG = () => { gOut.textContent = `${fmt(p.g, 2)} m/s²`; planet.value = String(p.g); };
planet.addEventListener("change", () => { p.g = Number(planet.value); syncG(); onParam(); });

/* Harakat turi: burchak ostida ↔ vertikal */
function syncKindUI() {
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === ui.kind)));
  document.querySelectorAll("[data-angle-only]").forEach((el) => { el.hidden = ui.kind !== "angle"; });
  document.querySelectorAll("[data-vertical-only]").forEach((el) => { el.hidden = ui.kind !== "vertical"; });
  document.querySelectorAll("[data-dir-value]").forEach((b) => b.setAttribute("aria-pressed", String((Number(b.dataset.dirValue) > 0) === p.alpha > 0)));
}
function setKind(kind, { apply = true } = {}) {
  if (kind === ui.kind) return;
  ui.kind = kind;
  if (kind === "vertical") {
    if (p.alpha > 0 && p.alpha < 90 * DEG) ui.angleMemo = p.alpha;
    p.alpha = 90 * DEG;
  } else {
    p.alpha = ui.angleMemo > 0 && ui.angleMemo < 90 * DEG ? ui.angleMemo : 45 * DEG;
  }
  alphaCtl.set(Math.round(p.alpha / DEG));
  syncKindUI();
  if (apply) onParam();
}
function setDir(dir, apply = true) {
  if (dir < 0 && p.h0 < 1) { p.h0 = 20; h0Ctl.set(20); }
  p.alpha = dir * 90 * DEG;
  syncKindUI();
  if (apply) onParam();
}
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => setKind(b.dataset.kindValue)));
document.querySelectorAll("[data-dir-value]").forEach((b) => b.addEventListener("click", () => setDir(Number(b.dataset.dirValue))));

/* Tayyor holatlar */
function applyPreset(spec) {
  const [kind, al, v0, h0, g] = spec.split(",");
  ui.kind = kind;
  p.alpha = Number(al) * DEG; p.v0 = Number(v0); p.h0 = Number(h0); p.g = Number(g);
  if (kind === "angle") ui.angleMemo = p.alpha;
  alphaCtl.set(Math.abs(Number(al))); v0Ctl.set(p.v0); h0Ctl.set(p.h0); syncG(); syncKindUI();
  onParam();
}
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  ui.show[cb.dataset.toggle] = cb.checked;
  stage.render();
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
  graph.canvas.setAttribute("aria-label", TABS[tab][0]);
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* Grafikni bosish/sudrash: harakatning tanlangan paytiga o'tish */
let scrub = false;
function seek(e) {
  const r = graph.canvas.getBoundingClientRect();
  const t = timeFromPointer(e.clientX - r.left);
  if (t === null || sol.T <= 0) return;
  if (!flight) flight = { p: { ...p }, sol, t, landed: false };
  loop.stop();
  flight.t = t;
  flight.landed = t >= flight.sol.T - 1e-9;
  renderAll(); updateUI();
}
graph.canvas.addEventListener("pointerdown", (e) => { scrub = true; graph.canvas.setPointerCapture(e.pointerId); seek(e); });
graph.canvas.addEventListener("pointermove", (e) => { if (scrub) seek(e); });
const endScrub = () => { scrub = false; };
graph.canvas.addEventListener("pointerup", endScrub);
graph.canvas.addEventListener("pointercancel", endScrub);

/* To'pdan tortish: burchak va tezlik (vertikalda — faqat tezlik va yo'nalish) */
let dragging = false;
function fromPointer(e) {
  const r = canvas.getBoundingClientRect();
  const dx = e.clientX - r.left - X(0);
  const dy = Y(p.h0) - (e.clientY - r.top);
  if (ui.kind === "vertical") {
    const dir = dy >= 0 || p.h0 < 1 ? 1 : -1;
    p.alpha = dir * 90 * DEG;
    p.v0 = clamp(Math.round((Math.abs(dy) / view.kv) * 2) / 2, 0, 50);
    v0Ctl.set(p.v0); syncKindUI();
  } else {
    const alpha = clamp(Math.round(Math.atan2(Math.max(dy, 0), Math.max(dx, 0.001)) / DEG), 0, 90);
    p.alpha = alpha * DEG; ui.angleMemo = p.alpha;
    p.v0 = clamp(Math.round((Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) / view.kv) * 2) / 2, 1, 50);
    alphaCtl.set(alpha); v0Ctl.set(p.v0);
  }
  onParam();
}
canvas.addEventListener("pointerdown", (e) => {
  if (flight && !flight.landed) return;
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const nearHandle = Math.hypot(px - handle.x, py - handle.y) < 26;
  const nearCannon = Math.hypot(px - X(0), py - Y(p.h0)) < 30;
  if (!nearHandle && !nearCannon) return;
  if (flight?.landed) flight = null;
  dragging = true;
  canvas.dataset.dragging = "true";
  canvas.setPointerCapture(e.pointerId);
  fromPointer(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (dragging) { fromPointer(e); return; }
  if (flight && !flight.landed) { canvas.style.cursor = ""; return; }
  const r = canvas.getBoundingClientRect();
  canvas.style.cursor = Math.hypot(e.clientX - r.left - handle.x, e.clientY - r.top - handle.y) < 26 ? "grab" : "default";
});
const endDrag = () => { dragging = false; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Boshlash (eski vertical-motion.html havolasi ?preset=vertical bilan keladi) */
const QUICK = { vertical: "vertical,90,20,0,9.8", fall: "vertical,-90,0,45,9.8" };
syncG();
syncKindUI();
const wanted = new URLSearchParams(location.search).get("preset");
if (wanted && QUICK[wanted]) applyPreset(QUICK[wanted]);
setTab("y");
updateUI();
renderAll();
document.fonts?.ready.then(renderAll);
