// ==========================================================================
// Butun olam tortishish qonuni — simulyatsiya (simulations/gravity-law.html)
// Rejimlar: "lab" (kg, m) va "space" (haqiqiy osmon jismlari, masofa ko'paytuvchisi bilan).
// Jismlar maydonning istalgan nuqtasiga sudraladi (2D); masofa r jism markazlari orasida doim ko'rsatiladi.
// ==========================================================================

import { clamp, fmt, sci, createStage, arrow, tag, bindRange } from "./sim-kit.js";
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
const geo = { cx: 0, cy: 0, s: 1, w: 0, h: 0, x1: 0, y1: 0, x2: 0, y2: 0, r1: 0, r2: 0 };
// Jismlar markazlari: sahna markaziga nisbatan, metrda (osmon rejimida ham haqiqiy metr)
const pos = { p1: { x: -0.5, y: 0 }, p2: { x: 0.5, y: 0 } };
const curR = () => Math.hypot(pos.p2.x - pos.p1.x, pos.p2.y - pos.p1.y);
/** Masofani r ga o'rnatish: o'rta nuqta va yo'nalish saqlanadi. */
function setDistance(rNew) {
  const mx = (pos.p1.x + pos.p2.x) / 2, my = (pos.p1.y + pos.p2.y) / 2, r0 = curR();
  const ux = r0 > 0 ? (pos.p2.x - pos.p1.x) / r0 : 1, uy = r0 > 0 ? (pos.p2.y - pos.p1.y) / r0 : 0;
  pos.p1 = { x: mx - (ux * rNew) / 2, y: my - (uy * rNew) / 2 };
  pos.p2 = { x: mx + (ux * rNew) / 2, y: my + (uy * rNew) / 2 };
}
/** Rejim yoki juftlik almashganda — jismlar gorizontal, markazga simmetrik. */
function resetPositions(rNew) { pos.p1 = { x: -rNew / 2, y: 0 }; pos.p2 = { x: rNew / 2, y: 0 }; }

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

/** Zamonaviy maydon strelkasi: yumaloq uchli ingichka tana + to'ldirilgan, biroz egilgan uch. */
function fieldArrow(ctx, x, y, ux, uy, L, color, alpha) {
  const hx = x + (ux * L) / 2, hy = y + (uy * L) / 2, tx = x - (ux * L) / 2, ty = y - (uy * L) / 2;
  const hl = Math.min(7, L * 0.45), hw = hl * 0.62, nx = -uy, ny = ux;
  const bx = hx - ux * hl, by = hy - uy * hl;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx + ux * 1.5, by + uy * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo(bx + ux * hl * 0.25 + nx * hw * 0.35, by + uy * hl * 0.25 + ny * hw * 0.35, bx + nx * hw, by + ny * hw);
  ctx.quadraticCurveTo(bx + ux * hl * 0.3, by + uy * hl * 0.3, bx - nx * hw, by - ny * hw);
  ctx.quadraticCurveTo(bx + ux * hl * 0.25 - nx * hw * 0.35, by + uy * hl * 0.25 - ny * hw * 0.35, hx, hy);
  ctx.fill();
}

/** Masofa yorlig'i va boshqa yorliqlar sahnadan chiqib ketmasin. */
function tagIn(ctx, text, x, y, o) {
  ctx.save(); ctx.font = o.font || "600 12px Inter, system-ui, sans-serif";
  const tw = ctx.measureText(text).width + 12; ctx.restore();
  let x0 = o.align === "center" ? x - tw / 2 : o.align === "right" ? x - tw : x;
  x0 = clamp(x0, 4, geo.w - tw - 4);
  tag(ctx, text, x0, clamp(y, 14, geo.h - 14), { ...o, align: "left" });
}

function draw(ctx, { w, h, colors: c }) {
  const M = model();
  const lab = st.mode === "lab", space = !lab;
  geo.w = w; geo.h = h; geo.cx = w / 2; geo.cy = h / 2;
  geo.s = (w - 120) / (M.rMax * 1.05);
  const pk = clamp(w / 700, 0.5, 1);  // osmon jismlari o'lchami (masshtabsiz) tor ekranda kichrayadi
  geo.r1 = lab ? Math.max(3, M.R1 * geo.s) : Math.max(5, M.b1.px * pk);
  geo.r2 = lab ? Math.max(3, M.R2 * geo.s) : M.b2.station ? 12 : Math.max(5, M.b2.px * pk);
  // jismlar sahna ichida qolsin (o'lcham o'zgarsa ham)
  for (const [p, rr] of [[pos.p1, geo.r1], [pos.p2, geo.r2]]) {
    const mx = (w / 2 - rr - 6) / geo.s, my = (h / 2 - rr - 6) / geo.s;
    p.x = clamp(p.x, -mx, mx); p.y = clamp(p.y, -my, my);
  }
  geo.x1 = geo.cx + pos.p1.x * geo.s; geo.y1 = geo.cy + pos.p1.y * geo.s;
  geo.x2 = geo.cx + pos.p2.x * geo.s; geo.y2 = geo.cy + pos.p2.y * geo.s;

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  if (space) {
    ctx.save();
    ctx.fillStyle = c.dark ? "#060a14" : "#0f172a";
    ctx.globalAlpha = c.dark ? 1 : 0.9;
    ctx.fillRect(0, 0, w, h);
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
  const ink = space ? "#e2e8f0" : c.text;
  const ink2 = space ? "#94a3b8" : c.text2;
  const tagBg = space ? "rgb(15 23 42 / 0.85)" : c.bg;
  const B = [[geo.x1, geo.y1, M.m1, geo.r1], [geo.x2, geo.y2, M.m2, geo.r2]];

  // Gravitatsion maydon: g = Σ G m / d² (jism markaziga). Uzunlik, shaffoflik — log|g| bo'yicha.
  if (show.field) {
    const fc = space ? "#93c5fd" : c.primary;
    // jismlar atrofida yumshoq «potensial chuqur» yorug'ligi
    ctx.save();
    for (const [bx, by, , rr] of B) {
      const R = rr + 70, g = ctx.createRadialGradient(bx, by, rr, bx, by, R);
      g.addColorStop(0, space ? "rgb(147 197 253 / 0.22)" : "rgb(37 99 235 / 0.12)"); g.addColorStop(1, "rgb(37 99 235 / 0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const step = w < 520 ? 34 : 40, pts = [];
    let lmin = Infinity, lmax = -Infinity;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        let gx = 0, gy = 0, skip = false;
        for (const [bx, by, m, rr] of B) {
          const dx = bx - x, dy = by - y, dpx = Math.hypot(dx, dy);
          if (dpx < rr + 12) { skip = true; break; }
          const d = dpx / geo.s, gm = (G * m) / (d * d);
          gx += (gm * dx) / dpx; gy += (gm * dy) / dpx;
        }
        if (skip) continue;
        const mag = Math.hypot(gx, gy), lg = Math.log10(mag);
        lmin = Math.min(lmin, lg); lmax = Math.max(lmax, lg);
        pts.push([x, y, gx / mag, gy / mag, lg]);
      }
    }
    ctx.save();
    for (const [x, y, ux, uy, lg] of pts) {
      const t = lmax > lmin ? (lg - lmin) / (lmax - lmin) : 0.5;
      fieldArrow(ctx, x, y, ux, uy, 9 + 15 * t, fc, 0.22 + 0.6 * t);
    }
    ctx.restore();
  }

  // Masofa: markazlarni tutashtiruvchi chiziq va har doim ko'rinadigan r yorlig'i
  const dx = geo.x2 - geo.x1, dy = geo.y2 - geo.y1, dpx = Math.hypot(dx, dy) || 1;
  const ux = dx / dpx, uy = dy / dpx;
  let nx = -uy, ny = ux; if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }  // normal — yuqoriga
  ctx.save();
  ctx.strokeStyle = ink2; ctx.fillStyle = ink2; ctx.lineWidth = 1.25; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(geo.x1, geo.y1); ctx.lineTo(geo.x2, geo.y2); ctx.stroke(); ctx.setLineDash([]);
  for (const [x, y] of [[geo.x1, geo.y1], [geo.x2, geo.y2]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  const rr = Math.max(geo.r1, geo.r2), mx = (geo.x1 + geo.x2) / 2, my = (geo.y1 + geo.y2) / 2;
  const off = (dpx - geo.r1 - geo.r2 < 120 ? rr : 0) + 30;  // jismlar yaqin bo'lsa yorliq ulardan nariroqqa
  tagIn(ctx, `r = ${rText(curR(), M)}`, mx + nx * off, my + ny * off, { color: ink, bg: tagBg, align: "center", font: "700 12px Inter, system-ui, sans-serif" });

  drawBody(ctx, geo.x1, geo.y1, M.b1, c, geo.r1);
  drawBody(ctx, geo.x2, geo.y2, M.b2, c, geo.r2);

  // Kuchlar — markazlarni tutashtiruvchi chiziq bo'ylab bir-biriga qarab
  const res = gravity(M.m1, M.m2, M.r);
  if (show.forces) {
    const gap = dpx - geo.r1 - geo.r2, fromCenter = gap < 44;
    const room = fromCenter ? dpx / 2 - 4 : gap / 2 - 8;
    const L = Math.max(fromCenter ? 12 : 6, Math.min(forceLen(res.F, M), room));
    const o1 = fromCenter ? 0 : geo.r1, o2 = fromCenter ? 0 : geo.r2;
    const a1 = [geo.x1 + ux * o1, geo.y1 + uy * o1], a2 = [geo.x2 - ux * o2, geo.y2 - uy * o2];
    const color = c.warning, opts = { width: 4, head: 13 }, halo = space ? "#0f172a" : c.bg;
    arrow(ctx, a1[0], a1[1], ux * L, uy * L, halo, { ...opts, width: 8, head: 16 });
    arrow(ctx, a1[0], a1[1], ux * L, uy * L, color, opts);
    arrow(ctx, a2[0], a2[1], -ux * L, -uy * L, halo, { ...opts, width: 8, head: 16 });
    arrow(ctx, a2[0], a2[1], -ux * L, -uy * L, color, opts);
    const f = "italic 700 14px 'Times New Roman', serif";
    tagIn(ctx, "F₂₁", a1[0] + (ux * L) / 2 - nx * 20, a1[1] + (uy * L) / 2 - ny * 20, { color, bg: tagBg, align: "center", font: f });
    tagIn(ctx, "F₁₂", a2[0] - (ux * L) / 2 - nx * 20, a2[1] - (uy * L) / 2 - ny * 20, { color, bg: tagBg, align: "center", font: f });
  }
  // Jism nomlari — jismlarning tashqi tomonida (bir-biridan uzoqroqda)
  const lbl1 = lab ? `m₁ = ${mText(M.m1)}` : M.b1.name;
  const lbl2 = lab ? `m₂ = ${mText(M.m2)}` : M.b2.name;
  const sx = ux >= 0 ? 1 : -1;
  tagIn(ctx, lbl1, geo.x1 - ux * (geo.r1 + 8), geo.y1 - uy * (geo.r1 + 8) - geo.r1 - 14, { color: ink, bg: tagBg, align: sx > 0 ? "right" : "left" });
  tagIn(ctx, lbl2, geo.x2 + ux * (geo.r2 + 8), geo.y2 + uy * (geo.r2 + 8) - geo.r2 - 14, { color: ink, bg: tagBg, align: sx > 0 ? "left" : "right" });
}

/* ------------------------------------------------------------------ UI */

function setReadout(key, value, sub) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
}

function update() {
  stage.render();
  // sahna chegarasi jismlarni siljitgan bo'lsa (tor ekran, o'lcham o'zgarishi) — r ni pozitsiyalardan olamiz
  if (Math.abs(curR() - model().r) > 1e-6 * model().r) { syncFromPositions(); stage.render(); }
  const M = model();
  const res = gravity(M.m1, M.m2, M.r);

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

const stage = createStage($("#stage"), draw, { height: (cw) => clamp(Math.min(cw * 0.62, ((typeof window !== "undefined" && window.innerHeight) || 800) * 0.62), 320, 540) });

/** Sharlar bir-biriga kirib ketmasin: r ≥ R₁ + R₂ */
function keepApart() {
  const min = contactMin();
  if (st.r < min) { st.r = min; rCtl.set(min); setDistance(min); }
}
bindRange($("#m1"), $("#m1Out"), (v) => `${fmt(v, 0)} kg`, (v) => { st.m1 = v; keepApart(); update(); });
bindRange($("#m2"), $("#m2Out"), (v) => `${fmt(v, 0)} kg`, (v) => { st.m2 = v; keepApart(); update(); });
const rCtl = bindRange($("#r"), $("#rOut"), (v) => `${fmt(v, 2)} m`, (v) => { st.r = Math.max(v, contactMin()); setDistance(st.r); keepApart(); update(); });
const kInput = $("#k");
const kCtl = bindRange(kInput, $("#kOut"), (v) => `${fmt(v, 2)}×`, (v) => { st.k = v; setDistance(PAIRS[st.pair].d * v); update(); });
$("#pair").addEventListener("change", (e) => {
  st.pair = e.target.value;
  const kMin = PAIRS[st.pair].kMin ?? 0.5;
  kInput.min = String(kMin);
  st.k = 1;                       // yangi juftlik — haqiqiy masofadan boshlanadi
  kCtl.set(st.k);
  resetPositions(PAIRS[st.pair].d);
  update();
});

document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => {
  st.mode = b.dataset.modeValue;
  document.querySelectorAll("[data-mode-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== st.mode; });
  resetPositions(st.mode === "lab" ? st.r : PAIRS[st.pair].d * st.k);
  update();
}));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  show[cb.dataset.toggle] = cb.checked;
  stage.render();
}));

/* Sudrash: jismni maydonning istalgan nuqtasiga olib borish mumkin */
const canvas = stage.canvas;
let drag = null;  // { key: "p1" | "p2", ox, oy } — ushlangan nuqtaning markazdan siljishi
const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function hit(x, y) {
  const d1 = Math.hypot(x - geo.x1, y - geo.y1), d2 = Math.hypot(x - geo.x2, y - geo.y2);
  const ok1 = d1 < geo.r1 + 14, ok2 = d2 < geo.r2 + 14;
  if (ok1 && ok2) return d1 - geo.r1 <= d2 - geo.r2 ? "p1" : "p2";
  return ok1 ? "p1" : ok2 ? "p2" : null;
}
/** Pozitsiyalardan r ni olib, slayderlarni sinxronlash. */
function syncFromPositions() {
  const r = curR();
  // slayder qadamga yaxlitlaydi — yozuvda esa sahnadagi aniq qiymat
  if (st.mode === "lab") { st.r = r; rCtl.set(r); $("#rOut").textContent = `${fmt(r, 2)} m`; }
  else { st.k = r / PAIRS[st.pair].d; kCtl.set(st.k); $("#kOut").textContent = `${fmt(st.k, 2)}×`; }
}
canvas.addEventListener("pointerdown", (e) => {
  const [x, y] = local(e), key = hit(x, y);
  if (!key) return;
  const c = key === "p1" ? [geo.x1, geo.y1] : [geo.x2, geo.y2];
  drag = { key, ox: x - c[0], oy: y - c[1] };
  canvas.dataset.dragging = "true";
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  const [x, y] = local(e);
  if (!drag) { canvas.style.cursor = hit(x, y) ? "grab" : "default"; return; }
  const M = model(), me = pos[drag.key], other = pos[drag.key === "p1" ? "p2" : "p1"];
  const rr = drag.key === "p1" ? geo.r1 : geo.r2;
  const mxw = (geo.w / 2 - rr - 6) / geo.s, myw = (geo.h / 2 - rr - 6) / geo.s;
  let px = clamp((x - drag.ox - geo.cx) / geo.s, -mxw, mxw), py = clamp((y - drag.oy - geo.cy) / geo.s, -myw, myw);
  // r ∈ [rMin, rMax]: jismlar bir-biriga kirmaydi va juda uzoqlashmaydi
  let dx = px - other.x, dy = py - other.y, d = Math.hypot(dx, dy);
  if (d < 1e-9) { dx = drag.key === "p1" ? -1 : 1; dy = 0; d = 1; }
  const dc = clamp(d, M.rMin, M.rMax);
  if (dc !== d) { px = other.x + (dx / d) * dc; py = other.y + (dy / d) * dc; }
  me.x = px; me.y = py;
  syncFromPositions();
  update();
});
const end = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);

resetPositions(st.r);
update();
document.fonts?.ready.then(() => stage.render());
window.addEventListener("resize", () => requestAnimationFrame(update));
