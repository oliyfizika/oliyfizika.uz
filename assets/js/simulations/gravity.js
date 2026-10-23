// ==========================================================================
// Butun olam tortishish qonuni — simulyatsiya (simulations/gravity-law.html)
// Rejimlar: "lab" (kg, m) va "space" (haqiqiy osmon jismlari, masofa ko'paytuvchisi bilan).
// ==========================================================================

import { clamp, fmt, sci, createStage, arrow, tag, bindRange, drawGraph } from "./sim-kit.js";
import { G, gravity } from "./inverse-square.js";

const $ = (s) => document.querySelector(s);

const BODIES = {
  earth: { name: "Yer", m: 5.972e24, color: "#3b82f6", color2: "#10b981", px: 20 },
  moon: { name: "Oy", m: 7.342e22, color: "#9ca3af", px: 10 },
  sun: { name: "Quyosh", m: 1.989e30, color: "#f59e0b", color2: "#fde047", px: 36 },
  iss: { name: "XKS", m: 4.2e5, color: "#94a3b8", px: 5, station: true },
  jupiter: { name: "Yupiter", m: 1.898e27, color: "#d6a273", color2: "#b45309", px: 30 },
  io: { name: "Io", m: 8.93e22, color: "#eab308", px: 10 },
};
const PAIRS = {
  "earth-moon": { a: "earth", b: "moon", d: 3.844e8 },
  "sun-earth": { a: "sun", b: "earth", d: 1.496e11 },
  "earth-iss": { a: "earth", b: "iss", d: 6.771e6, kMin: 0.95 }, // 0,95× dan kichigi — Yer ichida (R = 6371 km)
  "jupiter-io": { a: "jupiter", b: "io", d: 4.217e8 },
};

const st = { mode: "lab", m1: 500, m2: 100, r: 1, pair: "earth-moon", k: 1 };
const RHO = 7800;                 // laboratoriya jismlari — po'lat sharlar, kg/m³
const STEP = 0.05;                // masofa slayderi qadami, m
const ballR = (m) => Math.cbrt((3 * m) / (4 * Math.PI * RHO));
/** Sharlar tegib turgandagi eng kichik masofa (slayder qadamiga yaxlitlangan). */
const contactMin = () => Math.max(0.2, Math.round(Math.ceil((ballR(st.m1) + ballR(st.m2) + 0.005) / STEP) * STEP * 100) / 100);
const show = { forces: true, field: true };
const geo = { cx: 0, cy: 0, s: 1, x1: 0, x2: 0, r1: 0, r2: 0 };

/* ------------------------------------------------------------------ Model */

function model() {
  if (st.mode === "lab") {
    return {
      m1: st.m1, m2: st.m2, r: st.r, rMin: contactMin(), rMax: 5,
      R1: ballR(st.m1), R2: ballR(st.m2),            // haqiqiy radiuslar (masshtabda chiziladi)
      b1: { name: "m₁", color: "#475569", color2: "#cbd5e1" },
      b2: { name: "m₂", color: "#475569", color2: "#cbd5e1" },
      Fmin: (G * 1 * 1) / 25, Fmax: (G * 1e6) / 0.39,
    };
  }
  const p = PAIRS[st.pair];
  const b1 = BODIES[p.a], b2 = BODIES[p.b];
  const kMin = p.kMin ?? 0.5;
  return {
    m1: b1.m, m2: b2.m, r: p.d * st.k, rMin: p.d * kMin, rMax: p.d * 3, d0: p.d, kMin,
    b1, b2,
    Fmin: (G * b1.m * b2.m) / (p.d * 3) ** 2, Fmax: (G * b1.m * b2.m) / (p.d * kMin) ** 2,
  };
}

const forceLen = (F, M) => 22 + 150 * clamp((Math.log10(F) - Math.log10(M.Fmin)) / (Math.log10(M.Fmax) - Math.log10(M.Fmin)), 0, 1);

function rText(r, M) {
  if (st.mode === "lab") return `${fmt(r, 2)} m`;
  const km = r / 1000;
  return km >= 1e6 ? `${sci(km, 3)} km` : `${fmt(Math.round(km), 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}
const mText = (m) => (st.mode === "lab" ? `${fmt(m, 0)} kg` : `${sci(m, 3)} kg`);

function period(M) {
  return 2 * Math.PI * Math.sqrt(M.r ** 3 / (G * (M.m1 + M.m2)));
}
function timeText(sec) {
  if (sec < 3600) return `${fmt(sec / 60, 1)} daqiqa`;
  if (sec < 86400 * 2) return `${fmt(sec / 3600, 1)} soat`;
  if (sec < 86400 * 400) return `${fmt(sec / 86400, 1)} kun`;
  return `${fmt(sec / (86400 * 365.25), 2)} yil`;
}

/* ------------------------------------------------------------------ Chizish */

function drawBody(ctx, x, y, b, c, R) {
  ctx.save();
  if (b.station) {
    ctx.fillStyle = c.text2;
    ctx.fillRect(x - 12, y - 2, 24, 4);
    ctx.fillStyle = c.primary;
    ctx.fillRect(x - 12, y - 6, 7, 12);
    ctx.fillRect(x + 5, y - 6, 7, 12);
    ctx.restore();
    return;
  }
  const g = ctx.createRadialGradient(x - R * 0.4, y - R * 0.4, R * 0.1, x, y, R);
  g.addColorStop(0, "rgb(255 255 255 / 0.6)");
  g.addColorStop(0.3, b.color2 || b.color);
  g.addColorStop(1, b.color);
  ctx.fillStyle = g;
  if (b.name === "Quyosh") { ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 30; }
  else { ctx.shadowColor = "rgb(0 0 0 / 0.25)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; }
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function draw(ctx, { w, h, colors: c }) {
  const M = model();
  geo.cx = w / 2;
  geo.cy = h * 0.47;
  const span = M.rMax;
  geo.s = (w - 140) / (span * 1.05);
  geo.x1 = geo.cx - (M.r * geo.s) / 2;
  geo.x2 = geo.cx + (M.r * geo.s) / 2;
  const lab = st.mode === "lab";
  geo.r1 = lab ? Math.max(3, M.R1 * geo.s) : M.b1.px;
  geo.r2 = lab ? Math.max(3, M.R2 * geo.s) : M.b2.station ? 12 : M.b2.px;

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  if (st.mode === "space") {
    ctx.save();
    ctx.fillStyle = c.dark ? "#060a14" : "#0f172a";
    ctx.globalAlpha = c.dark ? 1 : 0.9;
    ctx.fillRect(0, 0, w, h);
    // Yulduzlar (barqaror tasodifiy)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.25 + rnd() * 0.5; ctx.fillRect(rnd() * w, rnd() * h, 1.4, 1.4); }
    ctx.restore();
  } else {
    ctx.save();
    ctx.strokeStyle = c.grid;
    ctx.beginPath();
    for (let x = (geo.cx % 28) + 0.5; x < w; x += 28) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = (geo.cy % 28) + 0.5; y < h; y += 28) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.restore();
  }
  const space = st.mode === "space";
  const ink = space ? "#e2e8f0" : c.text;
  const ink2 = space ? "#94a3b8" : c.text2;
  const tagBg = space ? "rgb(15 23 42 / 0.85)" : c.bg;

  // Gravitatsion maydon: har nuqtada g = Σ G m / d² (markazga yo'nalgan), uzunlik — logarifmik
  if (show.field) {
    const step = 46;
    const pts = [];
    let lmin = Infinity, lmax = -Infinity;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        let gx = 0, gy = 0, skip = false;
        for (const [bx, m, rr] of [[geo.x1, M.m1, geo.r1], [geo.x2, M.m2, geo.r2]]) {
          const dx = bx - x, dy = geo.cy - y;
          const dpx = Math.hypot(dx, dy);
          if (dpx < rr + 14) { skip = true; break; }
          const d = dpx / geo.s;
          const gm = (G * m) / (d * d);
          gx += (gm * dx) / dpx; gy += (gm * dy) / dpx;
        }
        if (skip) continue;
        const mag = Math.hypot(gx, gy);
        const lg = Math.log10(mag);
        lmin = Math.min(lmin, lg); lmax = Math.max(lmax, lg);
        pts.push([x, y, gx / mag, gy / mag, lg]);
      }
    }
    ctx.save();
    for (const [x, y, ux, uy, lg] of pts) {
      const t = lmax > lmin ? (lg - lmin) / (lmax - lmin) : 0.5;
      const L = 6 + 14 * t;
      ctx.globalAlpha = 0.18 + 0.45 * t;
      arrow(ctx, x - (ux * L) / 2, y - (uy * L) / 2, ux * L, uy * L, space ? "#93c5fd" : c.primary, { width: 1.5, head: 5 });
    }
    ctx.restore();
  }

  // Masofa o'lchami
  const dimY = geo.cy + Math.max(geo.r1, geo.r2) + 40;
  ctx.save();
  ctx.strokeStyle = ink2;
  ctx.fillStyle = ink2;
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
  tag(ctx, `r = ${rText(M.r, M)}`, geo.cx, dimY, { color: ink, bg: tagBg, align: "center" });

  drawBody(ctx, geo.x1, geo.cy, M.b1, c, geo.r1);
  drawBody(ctx, geo.x2, geo.cy, M.b2, c, geo.r2);
  // Kuchlar (har doim tortishish). Jismlar orasi keng bo'lsa — o'q jism chetidan,
  // tor bo'lsa (masalan, sharlar tegib tursa) — massa markazidan, jism ustida chiziladi.
  const res = gravity(M.m1, M.m2, M.r);
  if (show.forces) {
    const gap = geo.x2 - geo.x1 - geo.r1 - geo.r2;
    const fromCenter = gap < 44;
    const room = fromCenter ? (geo.x2 - geo.x1) / 2 - 4 : gap / 2 - 8;
    const L = Math.max(fromCenter ? 12 : 6, Math.min(forceLen(res.F, M), room));
    const o1 = fromCenter ? geo.x1 : geo.x1 + geo.r1;
    const o2 = fromCenter ? geo.x2 : geo.x2 - geo.r2;
    const color = c.warning;
    const opts = { width: 4, head: 13 };
    const halo = space ? "#0f172a" : c.bg;
    arrow(ctx, o1, geo.cy, L, 0, halo, { ...opts, width: 8, head: 16 });
    arrow(ctx, o1, geo.cy, L, 0, color, opts);
    arrow(ctx, o2, geo.cy, -L, 0, halo, { ...opts, width: 8, head: 16 });
    arrow(ctx, o2, geo.cy, -L, 0, color, opts);
    const f = "italic 700 14px 'Times New Roman', serif";
    tag(ctx, "F₂₁", o1 + L / 2, geo.cy - 20, { color, bg: tagBg, align: "center", font: f });
    tag(ctx, "F₁₂", o2 - L / 2, geo.cy + 20, { color, bg: tagBg, align: "center", font: f });
  }
  const lbl1 = st.mode === "lab" ? `m₁ = ${mText(M.m1)}` : M.b1.name;
  const lbl2 = st.mode === "lab" ? `m₂ = ${mText(M.m2)}` : M.b2.name;
  // Yorliqlar tashqi tomonga — jismlar yaqin turganda ham ustma-ust tushmaydi
  tag(ctx, lbl1, geo.x1 + Math.min(geo.r1, 14), geo.cy - geo.r1 - 22, { color: ink, bg: tagBg, align: "right" });
  tag(ctx, lbl2, geo.x2 - Math.min(geo.r2, 14), geo.cy - geo.r2 - 22, { color: ink, bg: tagBg, align: "left" });
}

function drawF(ctx, stage) {
  const M = model();
  const f = (r) => (G * M.m1 * M.m2) / (r * r);
  const space = st.mode === "space";
  drawGraph(ctx, stage, {
    xMin: M.rMin, xMax: M.rMax, yMax: Math.max(f(space ? M.d0 * Math.max(0.75, M.kMin) : Math.max(0.5, M.rMin)), f(M.r) * 1.08), f, xCur: M.r,
    xUnit: space ? "km" : "m", yLabel: "F, N",
    fmtX: (x) => (space ? sci(x / 1000, 2) : fmt(x, 1)), fmtY: (y) => sci(y, 2),
  });
}

/* ------------------------------------------------------------------ UI */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

function update() {
  const M = model();
  const res = gravity(M.m1, M.m2, M.r);
  stage.render();
  graph.render();

  const n1 = st.mode === "lab" ? "m₁" : M.b1.name, n2 = st.mode === "lab" ? "m₂" : M.b2.name;
  setReadout("F", `${sci(res.F)}<small>N</small>`, "F₁₂ = F₂₁ — kuchlar teng");
  setReadout("a1", `${sci(res.a1)}<small>m/s²</small>`, `${n1}: ${mText(M.m1)}`);
  setReadout("a2", `${sci(res.a2)}<small>m/s²</small>`, `${n2}: ${mText(M.m2)}`);

  const xl = $("[data-x-label]");
  let html;
  const ratioA = res.a2 / res.a1;
  if (st.mode === "lab") {
    const weight = M.m2 * 9.8;
    xl.textContent = "m₂ ning Yerdagi og‘irligi";
    setReadout("x", `${sci(weight)}<small>N</small>`, `Tortishish kuchidan ${sci(weight / res.F, 2)} marta katta`);
    html = `<p>${fmt(M.m1, 0)} kg va ${fmt(M.m2, 0)} kg li po‘lat sharlar (radiuslari ${fmt(M.R1 * 100, 0)} va ${fmt(M.R2 * 100, 0)} sm) ${fmt(M.r, 2)} m masofada bir-birini atigi <b>${sci(res.F)} N</b> kuch bilan tortadi — bu ${fmt(M.m2, 0)} kg jism og‘irligidan <b>${sci(weight / res.F, 2)} marta</b> kichik. Shuning uchun kundalik jismlar orasidagi tortishishni sezmaymiz: G juda kichik son.</p>`;
    if (M.r <= M.rMin + 1e-9) html += `<p>Sharlar bir-biriga <b>tegib turibdi</b> — markazlar orasidagi masofa radiuslar yig‘indisidan kichik bo‘la olmaydi.</p>`;
    html += `<p>Ikkala jismga ta’sir etuvchi kuchlar <b>teng</b>, lekin tezlanishlar massaga teskari proporsional: <span class="sim-math">a₂ / a₁ = m₁ / m₂ = ${fmt(ratioA, 2)}</span>. Masofani 2 marta kamaytirsangiz, kuch 4 marta ortadi.</p>`;
  } else {
    const T = period(M);
    xl.textContent = "Doiraviy orbita davri T";
    setReadout("x", timeText(T), `${M.b2.name} ${M.b1.name} atrofida`);
    html = `<p>${M.b1.name} va ${M.b2.name} bir-birini <b>${sci(res.F)} N</b> kuch bilan tortadi. Kuchlar teng, ammo ${M.b1.name} massasi ${sci(M.m1 / M.m2, 2)} marta katta, shuning uchun uning tezlanishi shuncha marta kichik (<b>${sci(res.a1)}</b> va <b>${sci(res.a2)} m/s²</b>).</p>`;
    html += `<p>Aynan shu kuch ${M.b2.name}ni orbitada ushlab turadi. Doiraviy orbita uchun davr <span class="sim-math">T = 2π√(r³/(G(m₁+m₂)))</span> ≈ <b>${timeText(T)}</b>${st.k === 1 ? " — haqiqiy qiymatga juda yaqin" : ""}. Masofa ortsa, kuch kamayadi va davr ortadi (Keplerning 3-qonuni: <span class="sim-math">T² ∝ r³</span>).</p>`;
  }
  $("[data-explain]").innerHTML = html;

  const status = $("[data-status]");
  const touching = st.mode === "lab" && M.r <= M.rMin + 1e-9;
  status.textContent = st.mode === "lab" ? (touching ? "Sharlar tegib turibdi" : "Laboratoriya") : `${M.b1.name} — ${M.b2.name}`;
  status.dataset.tone = st.mode === "lab" ? (touching ? "orange" : "blue") : "purple";
  stage.canvas.setAttribute("aria-label", `Tortishish: ${n1} va ${n2}, r = ${rText(M.r, M)}, F = ${sci(res.F)} N.`);
}

/* ------------------------------------------------------------------ Boshqaruv */

const stage = createStage($("#stage"), draw, { aspect: 0.5, minHeight: 300, maxHeight: 460 });
const graph = createStage($("#graph"), drawF, { aspect: 0.32, minHeight: 190, maxHeight: 260 });

/** Sharlar bir-biriga kirib ketmasin: r ≥ R₁ + R₂ */
function keepApart() {
  const min = contactMin();
  if (st.r < min) { st.r = min; rCtl.set(min); }
}
bindRange($("#m1"), $("#m1Out"), (v) => `${fmt(v, 0)} kg`, (v) => { st.m1 = v; keepApart(); update(); });
bindRange($("#m2"), $("#m2Out"), (v) => `${fmt(v, 0)} kg`, (v) => { st.m2 = v; keepApart(); update(); });
const rCtl = bindRange($("#r"), $("#rOut"), (v) => `${fmt(v, 2)} m`, (v) => { st.r = v; keepApart(); update(); });
const kInput = $("#k");
const kCtl = bindRange(kInput, $("#kOut"), (v) => `${fmt(v, 2)}×`, (v) => { st.k = v; update(); });
$("#pair").addEventListener("change", (e) => {
  st.pair = e.target.value;
  const kMin = PAIRS[st.pair].kMin ?? 0.5;
  kInput.min = String(kMin);
  st.k = 1;                       // yangi juftlik — haqiqiy masofadan boshlanadi
  kCtl.set(st.k);
  update();
});

document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => {
  st.mode = b.dataset.modeValue;
  document.querySelectorAll("[data-mode-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== st.mode; });
  update();
}));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  show[cb.dataset.toggle] = cb.checked;
  stage.render();
}));

/* Sudrash */
const canvas = stage.canvas;
let drag = false;
const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const hit = (x, y) => Math.hypot(x - geo.x1, y - geo.cy) < geo.r1 + 12 || Math.hypot(x - geo.x2, y - geo.cy) < geo.r2 + 12;
canvas.addEventListener("pointerdown", (e) => {
  const [x, y] = local(e);
  if (!hit(x, y)) return;
  drag = true;
  canvas.dataset.dragging = "true";
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  const [x, y] = local(e);
  if (!drag) { canvas.style.cursor = hit(x, y) ? "grab" : "default"; return; }
  const M = model();
  const r = clamp((2 * Math.abs(x - geo.cx)) / geo.s, M.rMin, M.rMax);
  if (st.mode === "lab") { st.r = Math.max(M.rMin, Math.round((r / STEP)) * STEP); rCtl.set(st.r); }
  else { st.k = Math.max(M.kMin, Math.round((r / M.d0) / 0.05) * 0.05); kCtl.set(st.k); }
  update();
});
const end = () => { drag = false; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);

update();
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
