// ==========================================================================
// Kulon qonuni — simulyatsiya (simulations/coulomb-law.html)
// Fizika: inverse-square.js (coulomb, fieldLines). Zaryadlar μC da, masofa m da.
// ==========================================================================

import { clamp, fmt, sci, createStage, arrow, tag, bindRange, drawGraph } from "./sim-kit.js";
import { coulomb, fieldLines } from "./inverse-square.js";

const $ = (s) => document.querySelector(s);
const MU = 1e-6;
const R_MIN = 0.1, R_MAX = 1;

const st = { q1: 4, q2: -4, r: 0.4, eps: 1 };
const show = { field: true, forces: true };
let res = coulomb(st.q1 * MU, st.q2 * MU, st.r, st.eps);
let lineCache = { key: "", lines: [] };
const geo = { cx: 0, cy: 0, s: 1, x1: 0, x2: 0, r1: 0, r2: 0 };

const radius = (q) => 13 + 11 * Math.sqrt(Math.abs(q) / 10);
const qText = (q) => `${q > 0 ? "+" : q < 0 ? "−" : ""}${fmt(Math.abs(q), Math.abs(q) % 1 ? 1 : 0)} μC`;
/** Logarifmik o'q uzunligi: 1 mN → ~14 px, 100 N → ~190 px */
const forceLen = (F) => clamp(14 + 36 * (Math.log10(Math.max(F, 1e-4)) + 3), 10, 200);

/* ------------------------------------------------------------------ Chizish */

function draw(ctx, { w, h, colors: c }) {
  geo.cx = w / 2;
  geo.cy = h * 0.47;
  geo.s = (w - (w < 560 ? 64 : 120)) / 1.1;
  geo.x1 = geo.cx - (st.r * geo.s) / 2;
  geo.x2 = geo.cx + (st.r * geo.s) / 2;
  // Nuqtaviy zaryadlar: juda yaqin turganda chizilgan doiralar kichrayadi (ustma-ust tushmasin)
  const maxR = Math.max(6, (geo.x2 - geo.x1) / 2 - 4);
  geo.r1 = Math.min(radius(st.q1), maxR);
  geo.r2 = Math.min(radius(st.q2), maxR);

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  // Muhit rangi (ε > 1)
  if (st.eps > 1) {
    ctx.save();
    ctx.fillStyle = c.primary;
    ctx.globalAlpha = Math.min(0.14, 0.04 + Math.log10(st.eps) * 0.05);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = c.grid;
  ctx.beginPath();
  for (let x = (geo.cx % 28) + 0.5; x < w; x += 28) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = (geo.cy % 28) + 0.5; y < h; y += 28) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.restore();

  const col = (q) => (q > 0 ? c.danger : q < 0 ? c.primary : c.text3);

  // Maydon chiziqlari
  if (show.field) {
    const key = [w, h, st.q1, st.q2, st.r].join("|");
    if (key !== lineCache.key) {
      lineCache = {
        key,
        lines: fieldLines(
          [{ x: geo.x1, y: geo.cy, q: st.q1, r: geo.r1 }, { x: geo.x2, y: geo.cy, q: st.q2, r: geo.r2 }],
          { x0: 0, x1: w, y0: 0, y1: h },
          { minLines: 8, perUnit: 0.8 },
        ),
      };
    }
    ctx.save();
    ctx.strokeStyle = c.text3;
    ctx.globalAlpha = c.dark ? 0.5 : 0.42;
    ctx.lineWidth = 1.25;
    for (const ln of lineCache.lines) {
      ctx.beginPath();
      ln.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // Yo'nalish o'qchalari (E yo'nalishi: + dan − ga)
    ctx.fillStyle = c.text3;
    ctx.globalAlpha = c.dark ? 0.75 : 0.6;
    for (const ln of lineCache.lines) {
      const i = Math.min(ln.pts.length - 2, 26);
      if (i < 2) continue;
      const [ax, ay] = ln.pts[i], [bx, by] = ln.pts[i + 1];
      let ang = Math.atan2(by - ay, bx - ax);
      if (ln.dir < 0) ang += Math.PI;
      if (ax < 0 || ax > w || ay < 0 || ay > h) continue;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Masofa o'lchami
  const dimY = geo.cy + Math.max(geo.r1, geo.r2) + 38;
  ctx.save();
  ctx.strokeStyle = c.text2;
  ctx.fillStyle = c.text2;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(geo.x1, geo.cy + geo.r1 + 6); ctx.lineTo(geo.x1, dimY + 6);
  ctx.moveTo(geo.x2, geo.cy + geo.r2 + 6); ctx.lineTo(geo.x2, dimY + 6);
  ctx.moveTo(geo.x1, dimY); ctx.lineTo(geo.x2, dimY);
  ctx.stroke();
  for (const [x, d] of [[geo.x1, 1], [geo.x2, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, dimY); ctx.lineTo(x + d * 8, dimY - 4); ctx.lineTo(x + d * 8, dimY + 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  tag(ctx, `r = ${fmt(st.r, 2)} m`, geo.cx, dimY, { color: c.text, bg: c.bg, align: "center" });

  // Kuch vektorlari (Nyutonning 3-qonuni: teng va qarama-qarshi)
  if (show.forces && res.kind !== "none") {
    let L = forceLen(res.Fabs);
    // Tortishishda o'qlar bir-biriga yetib bormasin
    if (res.kind === "attract") L = Math.max(6, Math.min(L, (geo.x2 - geo.x1 - geo.r1 - geo.r2) / 2 - 8));
    else L = Math.max(6, Math.min(L, geo.x1 - geo.r1 - 16, w - geo.x2 - geo.r2 - 16));
    const toward = res.kind === "attract" ? 1 : -1;     // 1-zaryad uchun +x yo'nalish = 2-zaryad tomon
    const color = c.warning;
    const opts = { width: 4, head: 13, font: "italic 700 15px 'Times New Roman', serif" };
    const halo = (x, y, dx) => arrow(ctx, x, y, dx, 0, c.bg, { ...opts, width: 8, head: 16 });
    const s1 = geo.x1 + toward * geo.r1, s2 = geo.x2 - toward * geo.r2;
    const y = geo.cy;
    halo(s1, y, toward * L); arrow(ctx, s1, y, toward * L, 0, color, { ...opts, label: "" });
    halo(s2, y, -toward * L); arrow(ctx, s2, y, -toward * L, 0, color, { ...opts, label: "" });
    // Yorliqlar: biri o'q ustida, biri ostida — yaqin masofada ham ustma-ust tushmaydi
    const roomy = res.kind === "repel" || geo.x2 - geo.x1 - geo.r1 - geo.r2 >= 34;
    if (roomy) tag(ctx, "F₂₁", s1 + toward * L * 0.5, y - 20, { color, bg: c.bg, align: "center", font: "italic 700 14px 'Times New Roman', serif" });
    if (roomy) tag(ctx, "F₁₂", s2 - toward * L * 0.5, y + 20, { color, bg: c.bg, align: "center", font: "italic 700 14px 'Times New Roman', serif" });
  }

  // Zaryadlar
  for (const [x, q, rr, name, side] of [[geo.x1, st.q1, geo.r1, "q₁", -1], [geo.x2, st.q2, geo.r2, "q₂", 1]]) {
    const color = col(q);
    ctx.save();
    const g = ctx.createRadialGradient(x - rr * 0.35, geo.cy - rr * 0.35, rr * 0.1, x, geo.cy, rr);
    g.addColorStop(0, "rgb(255 255 255 / 0.55)");
    g.addColorStop(0.35, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.shadowColor = color;
    ctx.shadowBlur = c.dark ? 18 : 10;
    ctx.beginPath(); ctx.arc(x, geo.cy, rr, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const k = Math.max(3, rr * 0.42);
    if (q !== 0) {
      ctx.beginPath(); ctx.moveTo(x - k, geo.cy); ctx.lineTo(x + k, geo.cy);
      if (q > 0) { ctx.moveTo(x, geo.cy - k); ctx.lineTo(x, geo.cy + k); }
      ctx.stroke();
    }
    ctx.restore();
    // Yorliq tashqi tomonga suriladi: q₁ — chapga, q₂ — o'ngga (yaqin turganda ham ajralib turadi)
    tag(ctx, `${name} = ${qText(q)}`, x - side * rr, geo.cy - rr - 22, { color, bg: c.bg, align: side < 0 ? "right" : "left" });
  }

  if (st.eps > 1) tag(ctx, `Muhit: ε = ${fmt(st.eps, st.eps % 1 ? 1 : 0)}`, 14, 22, { color: c.text2, bg: c.bg });
}

function drawF(ctx, stage) {
  const f = (r) => coulomb(st.q1 * MU, st.q2 * MU, r, st.eps).Fabs;
  // Joriy nuqta grafikdan chiqib ketmasin (r < 0,2 m da o'q kengayadi)
  const yMax = Math.max(f(0.2), f(st.r) * 1.08) || 1;
  drawGraph(ctx, stage, {
    xMin: R_MIN, xMax: R_MAX, yMax, f, xCur: st.r,
    xUnit: "m", yLabel: "F, N", fmtX: (x) => fmt(x, 1), fmtY: (y) => sci(y, 2),
  });
}

/* ------------------------------------------------------------------ UI */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

function update() {
  res = coulomb(st.q1 * MU, st.q2 * MU, st.r, st.eps);
  stage.render();
  graph.render();

  const kindText = { attract: "Tortishish", repel: "Itarilish", none: "O‘zaro ta’sir yo‘q" }[res.kind];
  setReadout("F", `${sci(res.Fabs)}<small>N</small>`, `${kindText}; F₁₂ = F₂₁`);
  setReadout("E", `${sci(res.E1at2)}<small>N/C</small>`, `F = |q₂|·E = ${sci(Math.abs(st.q2 * MU) * res.E1at2)} N`);
  setReadout("W", `${sci(res.W)}<small>J</small>`, res.W < 0 ? "W < 0 — zaryadlar tortishadi" : res.W > 0 ? "W > 0 — zaryadlar itariladi" : "Ta’sir yo‘q");

  const status = $("[data-status]");
  status.textContent = kindText;
  status.dataset.tone = res.kind === "attract" ? "blue" : res.kind === "repel" ? "orange" : "";

  const F = res.Fabs;
  let html;
  if (res.kind === "none") {
    html = `<p>Zaryadlardan biri nolga teng — elektr o‘zaro ta’sir yo‘q (<span class="sim-math">F = 0</span>). Zaryadsiz jismga elektr maydon kuch bilan ta’sir qilmaydi.</p>`;
  } else {
    html = `<p>${res.kind === "attract" ? "Zaryadlar <b>har xil ishorali</b> — ular <b>tortishadi</b>." : "Zaryadlar <b>bir xil ishorali</b> — ular <b>itariladi</b>."} Kuch moduli <b>F = ${sci(F)} N</b>. Ikkala zaryadga ta’sir etuvchi kuchlar <b>teng</b> va qarama-qarshi yo‘nalgan — zaryadlar kattaligi har xil bo‘lsa ham (Nyutonning 3-qonuni).</p>`;
    const half = coulomb(st.q1 * MU, st.q2 * MU, st.r / 2, st.eps).Fabs;
    html += `<p>Masofani 2 marta kamaytirsangiz, kuch <b>4 marta</b> ortadi: <b>${sci(F)} → ${sci(half)} N</b>. Grafikdagi egri chiziq aynan shu <span class="sim-math">1/r²</span> bog‘lanishni ko‘rsatadi.</p>`;
    if (st.eps > 1) html += `<p>Zaryadlar <b>ε = ${fmt(st.eps, st.eps % 1 ? 1 : 0)}</b> muhitda: kuch vakuumdagidan <b>${fmt(st.eps, st.eps % 1 ? 1 : 0)} marta</b> kichik (<b>${sci(F * st.eps)} N</b> o‘rniga).</p>`;
  }
  $("[data-explain]").innerHTML = html;

  stage.canvas.setAttribute("aria-label", `Kulon qonuni: q1 = ${qText(st.q1)}, q2 = ${qText(st.q2)}, r = ${fmt(st.r, 2)} m. ${kindText}, F = ${sci(F)} N.`);
  document.querySelectorAll("[data-preset]").forEach((b) => {
    const [a, bq, r, e] = b.dataset.preset.split(",").map(Number);
    b.setAttribute("aria-pressed", String(a === st.q1 && bq === st.q2 && Math.abs(r - st.r) < 1e-9 && e === st.eps));
  });
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { aspect: 0.5, minHeight: 300, maxHeight: 460 });
const graph = createStage($("#graph"), drawF, { aspect: 0.32, minHeight: 190, maxHeight: 260 });

const q1Ctl = bindRange($("#q1"), $("#q1Out"), qText, (v) => { st.q1 = v; update(); });
const q2Ctl = bindRange($("#q2"), $("#q2Out"), qText, (v) => { st.q2 = v; update(); });
const rCtl = bindRange($("#r"), $("#rOut"), (v) => `${fmt(v, 2)} m`, (v) => { st.r = v; update(); });
const eps = $("#eps"), epsOut = $("#epsOut");
const syncEps = () => { eps.value = String(st.eps); epsOut.textContent = `ε = ${fmt(st.eps, st.eps % 1 ? 1 : 0)}`; };
eps.addEventListener("change", () => { st.eps = Number(eps.value); syncEps(); update(); });

document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
  const [a, bq, r, e] = b.dataset.preset.split(",").map(Number);
  Object.assign(st, { q1: a, q2: bq, r, eps: e });
  q1Ctl.set(a); q2Ctl.set(bq); rCtl.set(r); syncEps();
  update();
}));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  show[cb.dataset.toggle] = cb.checked;
  stage.render();
}));

/* Sudrash: zaryadni ushlab masofani o'zgartirish */
const canvas = stage.canvas;
let drag = false;
const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
canvas.addEventListener("pointerdown", (e) => {
  const [x, y] = local(e);
  const hit = Math.hypot(x - geo.x1, y - geo.cy) < geo.r1 + 10 || Math.hypot(x - geo.x2, y - geo.cy) < geo.r2 + 10;
  if (!hit) return;
  drag = true;
  canvas.dataset.dragging = "true";
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  const [x, y] = local(e);
  if (!drag) {
    const near = Math.hypot(x - geo.x1, y - geo.cy) < geo.r1 + 10 || Math.hypot(x - geo.x2, y - geo.cy) < geo.r2 + 10;
    canvas.style.cursor = near ? "grab" : "default";
    return;
  }
  const r = clamp(Math.round(((2 * Math.abs(x - geo.cx)) / geo.s) * 100) / 100, R_MIN, R_MAX);
  if (r !== st.r) { st.r = r; rCtl.set(r); update(); }
});
const end = () => { drag = false; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);

syncEps();
update();
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
