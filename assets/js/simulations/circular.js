// ==========================================================================
// Aylana bo'ylab harakat — virtual laboratoriya (simulations/circular-motion.html)
// 1) Kinematika: v, R, a_τ — tezlik va tezlanish vektorlari, proyeksiyalar (garmonik tebranish), tezlik godografi;
//    jismni va v vektori uchini sudrash.
// 2) Markazga intilma kuch: ipdagi sharcha (taranglik shkalasi, uzilish, ipni kesish → urinma bo'ylab),
//    burilishdagi avtomobil (spidometr mili va yo'l qiyaligini sudrash, ishqalanish, sirpanish),
//    vertikal halqa (sharchani tepalikda sudrash, h ≥ 2,5R, ajralish, parabola, energiya).
// 3) Uzatmalar: tasmali, tishli, velosiped (g'ildirak chetini sudrash).
// Fizika: circular-physics.js (Node'da tekshirilgan). Grafiklar: circular-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./circular-physics.js";
import * as G from "./circular-plots.js";
import { createCircularLab } from "./circular-lab-3d.js?v=20261123-batch7a";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch7a";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch7a";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180, GRAV = P.G;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "kin", sub: "string", tab: "xy", show: { vec: true } };
const KMAX = 4, SPIN = 0.3, MOD = 1, LOOP_RATE = 0.5, RW = 35;
const kin = { v0: 1.5, v: 1.5, R: 0.6, at: 0, th: 0, th0: 0, t: 0, hist: [], hold: false };
const str = { v0: 3, v: 3, m: 0.2, R: 0.6, Fmax: 5, th: 0, t: 0, on: true, why: "", fly: null, spin: false, hist: [], wait: 0, hold: false, rate: 1 };
const car = { v: 60 / 3.6, R: 60, mu: 0.7, alpha: 0, th: -Math.PI / 2, M: 1200, skid: null, trail: [], off: "", wait: 0 };
const TR = P.makeTrack();
const lp = { k: 3, R: 0.5, s: 0, w: 0, phase: "run", fly: null, det: null, t: 0, hist: [], wait: 0, top: 0, done: "" };
const blt = { type: "belt", n1: 0.5, R1: 12, R2: 6, th1: 0, th2: 0, s: 0, xb: 0, N1: 0, N2: 0, t: 0 };
const ROADS = {
  0.7: { name: "quruq asfalt", col: "#4b5563", line: "#f8fafc", edge: "rgba(255,255,255,0.7)" },
  0.4: { name: "ho‘l asfalt", col: "#334155", line: "#cbd5e1", edge: "rgba(186,230,253,0.75)" },
  0.2: { name: "qor", col: "#e2e8f0", line: "#94a3b8", edge: "rgba(100,116,139,0.7)" },
  0.08: { name: "muz", col: "#bae6fd", line: "#f0f9ff", edge: "rgba(14,116,144,0.6)" },
};
let presetId = null;
const trim = (h, t) => { while (h.length && h[0].t < t) h.shift(); };
const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

const kinPeriod = () => (kin.v > 1e-6 ? (TAU * kin.R) / kin.v : Infinity);
function effAt() { if (kin.at > 0 && kin.v >= KMAX - 1e-9) return 0; if (kin.at < 0 && kin.v <= 1e-9) return 0; return kin.at; }
const rateKin = () => Math.min(1, kinPeriod() / 0.8);
const strF = () => (str.on ? P.tension(str.m, str.v, str.R) : 0);
function carState() {
  const a = (car.v * car.v) / car.R, b = P.carBounds(car.mu, car.alpha);
  return { a, b, vmax: Math.sqrt(car.R * b.hi), vmin: Math.sqrt(car.R * b.lo), ok: a <= b.hi * 1.0001 && a >= b.lo * 0.9999 };
}
const carTS = () => clamp((TAU * car.R) / car.v / 7, 1, 30);
const zOf = (R) => Math.max(6, Math.round((2 * R) / MOD));
const ratio = () => blt.R1 / blt.R2;
const n2 = () => blt.n1 * ratio();
const gearPhase = () => Math.PI + Math.PI / zOf(blt.R2) - ratio() * blt.th1;

function stepKin(dt) {
  if (kin.hold) return;
  const h = dt * rateKin(), v1 = clamp(kin.v + kin.at * h, 0, KMAX), vm = (kin.v + v1) / 2;
  kin.th += (vm / kin.R) * h; kin.v = v1; kin.t += h;
  const an = (kin.v * kin.v) / kin.R;
  kin.hist.push({ t: kin.t, x: kin.R * Math.cos(kin.th), y: kin.R * Math.sin(kin.th), v: kin.v, an, a: Math.hypot(an, effAt()) });
  trim(kin.hist, kin.t - 14);
}

/* ================================================================== 2a) Ipdagi sharcha */

function stepString(dt) {
  if (str.on) {
    if (str.hold) return;
    str.rate = Math.min(1, (TAU * str.R) / str.v / 0.8);
    const h = dt * str.rate;
    if (str.spin) str.v = Math.min(str.v + SPIN * h, 8);
    str.th += (str.v / str.R) * h; str.t += h;
    const F = P.tension(str.m, str.v, str.R);
    str.hist.push({ t: str.t, F });
    if (F > str.Fmax) breakString("break");
  } else {
    const h = dt * str.rate; str.t += h;
    if (str.fly) { str.fly.x += str.fly.vx * h; str.fly.y += str.fly.vy * h; }
    str.hist.push({ t: str.t, F: 0 });
    // The tabletop model has fixed world bounds, independent of viewport size.
    if (!str.fly || Math.abs(str.fly.x) > 1.8 || Math.abs(str.fly.y) > 1.1) { str.wait += dt; if (str.wait > 0.9) reattach(); }
  }
  trim(str.hist, str.t - 14);
}
function breakString(why) {
  const th = str.th, x = str.R * Math.cos(th), y = str.R * Math.sin(th);
  str.on = false; str.why = why; str.wait = 0; str.hold = false;
  str.fly = { x, y, x0: x, y0: y, vx: -str.v * Math.sin(th), vy: str.v * Math.cos(th), th };
  if (drag === "sball" || drag === "stip") endDrag();
}
function reattach() { Object.assign(str, { on: true, fly: null, wait: 0, why: "", v: str.v0 }); }

/* ================================================================== 2b) Burilishdagi avtomobil */

function stepCar(dt) {
  if (car.off) { car.wait += dt; if (car.wait > 2.2) resetCar(); return; }
  const h = dt * carTS(), cs = carState();
  if (!car.skid) {
    if (cs.ok) { car.th += (car.v / car.R) * h; return; }
    const th = car.th;
    car.skid = { dir: cs.a > cs.b.hi ? "out" : "in", th0: th, x: car.R * Math.cos(th), y: car.R * Math.sin(th), vx: -car.v * Math.sin(th), vy: car.v * Math.cos(th), vr: 0 };
    car.trail = [[car.skid.x, car.skid.y]];
  }
  const sk = car.skid, n = Math.max(1, Math.ceil(h / 0.02)), dtt = h / n;
  for (let i = 0; i < n; i++) {
    if (sk.dir === "out") {
      const kb = P.carBounds(car.mu * 0.75, car.alpha), sp = Math.hypot(sk.vx, sk.vy), w = (Number.isFinite(kb.hi) ? kb.hi : 0) / sp * dtt, cw = Math.cos(w), sw = Math.sin(w);
      const vx = sk.vx * cw - sk.vy * sw, vy = sk.vx * sw + sk.vy * cw; sk.vx = vx; sk.vy = vy;
      sk.x += sk.vx * dtt; sk.y += sk.vy * dtt;
    } else {
      const ca = Math.cos(car.alpha), sa = Math.sin(car.alpha), aDown = Math.max(0.3, GRAV * (sa - 0.75 * car.mu * ca) * ca);
      sk.vr -= aDown * dtt;
      const r = Math.hypot(sk.x, sk.y), an = Math.atan2(sk.y, sk.x) + (car.v / Math.max(r, 1)) * dtt, r2 = Math.max(0.5, r + sk.vr * dtt);
      sk.x = r2 * Math.cos(an); sk.y = r2 * Math.sin(an);
      sk.vx = -car.v * Math.sin(an) + sk.vr * Math.cos(an); sk.vy = car.v * Math.cos(an) + sk.vr * Math.sin(an);
    }
    const last = car.trail[car.trail.length - 1];
    if (Math.hypot(sk.x - last[0], sk.y - last[1]) > car.R * 0.01) car.trail.push([sk.x, sk.y]);
    if (Math.abs(Math.hypot(sk.x, sk.y) / car.R - 1) > .24) { car.off = sk.dir; car.wait = 0; break; }
  }
}
function resetCar() { const th = car.skid ? car.skid.th0 : car.th; Object.assign(car, { skid: null, trail: [], off: "", wait: 0, th }); }

/* ================================================================== 2c) Vertikal halqa */

function stepLoop(dt) {
  if (lp.phase === "hold") return;
  if (lp.phase === "hit" || lp.phase === "gone") { lp.wait += dt; if (lp.wait > (lp.phase === "hit" ? 2.4 : 0.5)) restartLoop(); return; }
  const Hd = dt * LOOP_RATE, n = Math.max(1, Math.ceil(Hd / (1 / 400))), h = Hd / n;
  for (let i = 0; i < n && (lp.phase === "run" || lp.phase === "fly"); i++) {
    lp.t += h;
    if (lp.phase === "run") {
      const nx = P.trackStep(TR, lp, h, lp.R); lp.s = nx.s; lp.w = nx.w;
      const y = TR.at(lp.s).y, e = 2 * (GRAV / lp.R) * (lp.k - y);
      if (e > 1e-3 && Math.abs(lp.w) > 0.05) lp.w = Math.sign(lp.w) * Math.sqrt(e);
      if (lp.s > 0 && lp.s < TAU) { lp.top = Math.max(lp.top, lp.s); if (TR.normal(lp.s, lp.w, lp.R) < -1e-3) detach(); }
      if (lp.s >= TAU) lp.done = "full";
      if (lp.s > TAU + TR.exit + 0.6) { lp.phase = "gone"; lp.wait = 0; }
    } else {
      const f = lp.fly; f.tau += h;
      f.x = f.x0 + f.vx0 * f.tau; f.y = f.y0 + f.vy0 * f.tau - 0.5 * (GRAV / lp.R) * f.tau * f.tau;
      const d = Math.hypot(f.x, f.y - 1); if (d < 0.985) f.inside = true;
      const last = f.path[f.path.length - 1]; if (Math.hypot(f.x - last[0], f.y - last[1]) > 0.03) f.path.push([f.x, f.y]);
      if ((f.inside && d >= 1) || f.y <= 0) {
        if (f.y > 0) { f.x /= d; f.y = 1 + (f.y - 1) / d; } else f.y = 0;
        f.path.push([f.x, f.y]); lp.phase = "hit"; lp.wait = 0;
      }
    }
  }
  const y = lp.fly ? lp.fly.y : TR.at(lp.s).y;
  lp.hist.push({ t: lp.t, U: y / lp.k, K: Math.max(0, 1 - y / lp.k) });
  trim(lp.hist, lp.t - 12);
}
function detach() {
  const p = TR.at(lp.s), v = lp.w;
  lp.det = { x: p.x, y: p.y, th: lp.s };
  lp.fly = { x0: p.x, y0: p.y, vx0: v * p.tx, vy0: v * p.ty, tau: 0, x: p.x, y: p.y, inside: false, path: [[p.x, p.y]], nx: -p.ty, ny: p.tx };
  lp.phase = "fly";
}
function restartLoop() { Object.assign(lp, { s: TR.sOfH(lp.k), w: 0, phase: "run", fly: null, det: null, t: 0, hist: [], wait: 0, top: 0, done: "" }); }

/* ================================================================== 3) Uzatmalar */

function stepBelt(dt) {
  const w1 = TAU * blt.n1, r = ratio();
  blt.th1 += w1 * dt;
  if (blt.type === "gear") blt.th2 = gearPhase(); else blt.th2 += w1 * r * dt;
  blt.s += w1 * blt.R1 * dt; blt.t += dt; blt.N1 += blt.n1 * dt; blt.N2 += blt.n1 * r * dt;
  if (blt.type === "bike") blt.xb += w1 * r * (RW / 100) * dt;
}

/* ------------------------------------------------------------------ Asosiy chizish */

const scene = createCircularLab();
function draw(ctx, st) { scene.draw(ctx, st, ui, kin, str, car, lp, blt, TR, effAt); }
const heights = () => ({graph: Math.round(clamp(innerHeight * .26, 170, 240))});
const stage = createStage($("#stage"), draw, {height: detailedStageHeight});

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  kin: [["xy", "x(t), y(t)", "Jism proyeksiyalari vaqt bo‘yicha", "Aylana bo‘ylab tekis harakatda har bir proyeksiya garmonik tebranadi: x = R·cos φ, y = R·sin φ, φ = ωt; tebranish davri aylanish davriga teng."]],
  string: [["fv", "F(v)", "Ip tarangligi tezlikka bog‘liq", "F = mv²/R — parabola: tezlik 2 marta ortsa, kerakli kuch 4 marta ortadi. Qizil soha — ip uziladigan tezliklar."], ["ft", "F(t)", "Ip tarangligi vaqt bo‘yicha", "Sharcha tezlashtirilganda taranglik ortib boradi; F_max ga yetganda ip uziladi va kuch birdan nolga tushadi."]],
  car: [["vmax", "v_max(R)", "Xavfsiz burilish tezligi", "v_max = √(μgR) — radius 4 marta katta burilishda 2 marta tezroq yurish mumkin. Yashil soha — xavfsiz tezliklar, nuqta — hozirgi avtomobil."], ["fric", "f(v)", "Kerakli va mavjud ishqalanish kuchi", "Ko‘k chiziq — burilish uchun kerakli ishqalanish kuchi (m = 1200 kg), qizil punktir — tinchlikdagi ishqalanishning eng katta qiymati μN. Ko‘k chiziq yashil yo‘lakdan chiqsa, avtomobil sirpanadi."]],
  loop: [["n", "N(θ)", "Tayanch reaksiyasi halqa bo‘ylab", "θ = 0° — halqaning pastki, 180° — yuqori nuqtasi. Pastda N eng katta (ortiqcha yuklama), tepada eng kichik. N < 0 bo‘ladigan joyda sharcha yo‘ldan ajraladi."], ["en", "Energiya", "Energiyaning aylanishi", "Ishqalanish yo‘q: kinetik va potensial energiyalar yig‘indisi o‘zgarmaydi — yo‘ldan ajralgandan keyin ham."]],
  belt: [],  // uzatmalarda grafik yo'q
};
const tabKey = () => (ui.mode === "dyn" ? ui.sub : ui.mode);
function setupTabs() {
  const box = $("[data-tabs]");
  $(".sim-graph").hidden = !TABS[tabKey()].length;  // uzatmalarda grafik oynasi yo'q
  box.hidden = TABS[tabKey()].length < 2;  // bitta grafik bo'lsa tugmalar kerak emas
  box.innerHTML = TABS[tabKey()].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const list = TABS[tabKey()], t = list.find((x) => x[0] === tab) || list[0];
  if (!t) return;
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, gst) {
  const k = tabKey();
  if (k === "kin") {
    return G.drawXY(ctx, gst, { hist: kin.hist, R: kin.R, span: clamp(2.2 * kinPeriod(), 3, 10) });
  }
  if (k === "string") return ui.tab === "ft" ? G.drawFT(ctx, gst, { hist: str.hist, Fmax: str.Fmax, span: 8 }) : G.drawFV(ctx, gst, { m: str.m, R: str.R, Fmax: str.Fmax, v: str.v });
  if (k === "car") return ui.tab === "fric" ? G.drawFric(ctx, gst, { m: car.M, R: car.R, mu: car.mu, alpha: car.alpha, v: car.v }) : G.drawVmax(ctx, gst, { mu: car.mu, alpha: car.alpha, R: car.R, v: car.v });
  if (k === "loop") return ui.tab === "en" ? G.drawEnergy(ctx, gst, { hist: lp.hist, span: 6 }) : G.drawLoop(ctx, gst, { h: lp.k * lp.R, R: lp.R, th: lp.phase === "run" && lp.s > 0 && lp.s < TAU ? lp.s : null });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
function updateReadouts() {
  const k = tabKey();
  if (k === "kin") {
    const T = kinPeriod(), w = kin.v / kin.R, an = (kin.v * kin.v) / kin.R, at = effAt();
    setRO("r1", "Chiziqli tezlik <i>v</i>", `${fmt(kin.v, 2)}<small>m/s</small>`, kin.at ? `boshida v₀ = ${fmt(kin.v0, 2)} m/s` : "v = 2πR/T");
    setRO("r2", "Burchak tezlik <i>ω</i>", `${fmt(w, 2)}<small>rad/s</small>`, "ω = v/R = 2πν");
    setRO("r3", "Aylanish davri <i>T</i>", Number.isFinite(T) ? `${fmt(T, 2)}<small>s</small>` : "—", `Chastota ν = ${fmt(Number.isFinite(T) ? 1 / T : 0, 2)} ayl/s`);
    setRO("r4", "Markazga intilma tezlanish <i>aₙ</i>", `${fmt(an, 2)}<small>m/s²</small>`, "aₙ = v²/R = ω²R");
    setRO("r5", "Tangensial tezlanish <i>a<sub>τ</sub></i>", `${fmt(at, 2)}<small>m/s²</small>`, `to‘liq a = ${fmt(Math.hypot(an, at), 2)} m/s²`, at ? "orange" : "muted");
    setRO("r6", "Aylanishlar soni <i>N</i>", fmt(kin.th / TAU, 2), `φ = ${fmt(kin.th, 1)} rad · t = ${fmt(kin.t, 1)} s`);
  } else if (k === "string") {
    const F = strF(), vb = P.breakSpeed(str.m, str.R, str.Fmax), q = F / str.Fmax;
    setRO("r1", "Tezlik <i>v</i>", `${fmt(str.v, 2)}<small>m/s</small>`, `ω = ${fmt(str.v / str.R, 2)} rad/s`);
    setRO("r2", "Markazga intilma tezlanish", `${fmt((str.v * str.v) / str.R, 1)}<small>m/s²</small>`, "a = v²/R");
    setRO("r3", "Ip taranglik kuchi <i>F</i>", `${fmt(F, 2)}<small>N</small>`, str.on ? "F = ma = mv²/R" : "Ip uzilgan — kuch yo‘q", str.on && q > 0.8 ? "orange" : "");
    setRO("r4", "Ip chidaydigan kuch", `${fmt(str.Fmax, 1)}<small>N</small>`, `uzilish tezligi ${fmt(vb, 2)} m/s`);
    setRO("r5", "Aylanish davri <i>T</i>", `${fmt((TAU * str.R) / str.v, 2)}<small>s</small>`, "T = 2πR/v");
    setRO("r6", "Holat", str.on ? "Ip butun" : str.why === "cut" ? "Kesildi" : "Uzildi", str.on ? `m = ${fmt(str.m * 1000, 0)} g, R = ${fmt(str.R * 100, 0)} cm` : "sharcha urinma bo‘ylab ketdi", str.on ? "" : "orange");
  } else if (k === "car") {
    const cs = carState(), F = P.carForces(car.M, car.v, car.R, car.alpha), fmax = car.mu * F.N;
    setRO("r1", "Tezlik <i>v</i>", `${fmt(car.v * 3.6, 0)}<small>km/soat</small>`, `${fmt(car.v, 1)} m/s`);
    setRO("r2", "Eng katta xavfsiz tezlik", Number.isFinite(cs.vmax) ? `${fmt(cs.vmax * 3.6, 0)}<small>km/soat</small>` : "∞", car.alpha > 0 ? (cs.vmin > 0.1 ? `eng kichigi ${fmt(cs.vmin * 3.6, 0)} km/soat` : "qiyalik hisobga olingan") : "v_max = √(μgR)", cs.ok ? "" : "orange");
    setRO("r3", "Markazga intilma tezlanish", `${fmt(cs.a, 2)}<small>m/s²</small>`, `= ${fmt(cs.a / GRAV, 2)} g`);
    setRO("r4", "Kerakli ishqalanish kuchi", `${fmt(Math.abs(F.f) / 1000, 2)}<small>kN</small>`, `eng ko‘pi μN = ${fmt(fmax / 1000, 2)} kN`, Math.abs(F.f) > fmax ? "orange" : "");
    setRO("r5", "Ideal tezlik (f = 0)", car.alpha > 0 ? `${fmt(P.carIdeal(car.R, car.alpha) * 3.6, 0)}<small>km/soat</small>` : "—", car.alpha > 0 ? "v = √(gR·tg α)" : "yo‘l qiyaligi yo‘q", car.alpha > 0 ? "" : "muted");
    setRO("r6", "Holat", cs.ok ? "Barqaror" : "Sirpanadi", `${(ROADS[car.mu] || ROADS[0.7]).name}, μ = ${fmt(car.mu, 2)}`, cs.ok ? "" : "orange");
  } else if (k === "loop") {
    const R = lp.R, kk = lp.k, vb = Math.sqrt(2 * GRAV * kk * R);
    let v = 0, n = NaN;
    if (lp.fly) { v = Math.sqrt(Math.max(0, 2 * GRAV * R * (kk - lp.fly.y))); n = 0; } else { v = Math.abs(lp.w) * R; n = TR.normal(lp.s, lp.w, R); }
    const vt2 = 2 * GRAV * R * (kk - 2), det = P.detachAngle(kk * R, R);
    setRO("r1", "Boshlang‘ich balandlik <i>h</i>", `${fmt(kk, 2)}<small>R</small>`, `${fmt(kk * R, 2)} m; kerak ≥ 2,5R = ${fmt(2.5 * R, 2)} m`, kk < 2.5 ? "orange" : "");
    setRO("r2", "Tezlik (hozir)", `${fmt(v, 2)}<small>m/s</small>`, `pastda √(2gh) = ${fmt(vb, 2)} m/s`);
    setRO("r3", "Tayanch reaksiyasi <i>N</i>", Number.isFinite(n) ? `${fmt(n, 2)}<small>mg</small>` : "—", lp.fly ? "yo‘ldan ajralgan: N = 0" : "hozirgi nuqtada");
    setRO("r4", "Tepada tezlik", vt2 >= 0 ? `${fmt(Math.sqrt(vt2), 2)}<small>m/s</small>` : "—", `kerak: v ≥ √(gR) = ${fmt(Math.sqrt(GRAV * R), 2)} m/s`, kk >= 2.5 ? "" : "orange");
    setRO("r5", "Pastda tayanch reaksiyasi", `${fmt(1 + 2 * kk, 2)}<small>mg</small>`, "N = mg(1 + 2h/R)");
    setRO("r6", "Natija", kk >= 2.5 ? "Aylanadi" : det ? `θ = ${fmt(det / DEG, 0)}°` : "Tebranadi", kk >= 2.5 ? "butun halqada N ≥ 0" : det ? "shu burchakda ajraladi" : `θ = ${fmt(Math.acos(1 - Math.min(kk, 1)) / DEG, 0)}° gacha ko‘tariladi`, kk >= 2.5 ? "" : "orange");
  } else {
    const r = ratio(), n2v = n2(), w1 = TAU * blt.n1, w2 = TAU * n2v, v = (w1 * blt.R1) / 100, gear = blt.type === "gear", bike = blt.type === "bike";
    setRO("r1", bike ? "Pedal (yulduzcha 1) <i>n₁</i>" : "Yetaklovchi g‘ildirak <i>n₁</i>", `${fmt(blt.n1, 2)}<small>ayl/s</small>`, `ω₁ = ${fmt(w1, 2)} rad/s · T₁ = ${fmt(1 / blt.n1, 2)} s`);
    setRO("r2", bike ? "Orqa g‘ildirak <i>n₂</i>" : "Yetaklanuvchi g‘ildirak <i>n₂</i>", `${fmt(n2v, 2)}<small>ayl/s</small>`, `ω₂ = ${fmt(w2, 2)} rad/s · T₂ = ${fmt(1 / n2v, 2)} s`);
    setRO("r3", "Uzatish nisbati <i>n₂/n₁</i>", fmt(r, 2), gear ? `z₁/z₂ = ${zOf(blt.R1)}/${zOf(blt.R2)}` : `R₁/R₂ = ${fmt(blt.R1, 1)}/${fmt(blt.R2, 1)}`);
    setRO("r4", bike ? "Zanjir tezligi" : gear ? "Tishlar tezligi" : "Tasma tezligi", `${fmt(v, 2)}<small>m/s</small>`, "v = ω₁R₁ = ω₂R₂");
    setRO("r5", "Radiuslar <i>R₁ : R₂</i>", `${fmt(blt.R1, 1)} : ${fmt(blt.R2, 1)}<small>cm</small>`, gear ? `tishlar: ${zOf(blt.R1)} va ${zOf(blt.R2)}` : r > 1 ? "tezlatuvchi uzatma" : r < 1 ? "sekinlatuvchi uzatma" : "1 : 1");
    setRO("r6", bike ? "Velosiped tezligi" : "Aylanish yo‘nalishi", bike ? `${fmt(w2 * (RW / 100) * 3.6, 1)}<small>km/soat</small>` : gear ? "Qarama-qarshi" : "Bir xil", bike ? `v = ω₂·R_g = ${fmt(w2 * (RW / 100), 2)} m/s (R_g = 35 cm)` : gear ? "tishli uzatma" : "ochiq tasma");
  }
}
function updateStatus() {
  const el = $("[data-status]"), k = tabKey(); let t = "", tone = "blue";
  if (k === "kin") { const at = effAt(); if (kin.v <= 1e-9) { t = "To‘xtadi"; tone = "orange"; } else if (kin.at > 0 && at === 0) { t = "Tezlik chegarasi"; tone = "purple"; } else if (at > 0) { t = "Tezlanuvchan"; tone = "orange"; } else if (at < 0) { t = "Sekinlanuvchan"; tone = "orange"; } else { t = "Tekis harakat"; tone = "green"; } }
  else if (k === "string") { const q = strF() / str.Fmax; if (!str.on) { t = str.why === "cut" ? "Ip kesildi" : "Ip uzildi!"; tone = "red"; } else if (q > 0.8) { t = "Uzilish arafasida"; tone = "orange"; } else { t = "Ip butun"; tone = "green"; } }
  else if (k === "car") { if (car.off) { t = car.off === "out" ? "Yo‘ldan chiqdi" : "Ichkariga sirpandi"; tone = "red"; } else if (car.skid) { t = "Sirpanmoqda!"; tone = "red"; } else { t = "Barqaror burilish"; tone = "green"; } }
  else if (k === "loop") { if (lp.phase === "hold") t = "Qo‘yib yuboring"; else if (lp.phase === "fly") { t = "Yo‘ldan ajraldi!"; tone = "red"; } else if (lp.phase === "hit") { t = "Halqaga urildi"; tone = "red"; } else if (lp.done) { t = "Halqadan o‘tdi"; tone = "green"; } else t = lp.k <= 1 ? "Tebranmoqda" : "Sirpanmoqda"; }
  else { const r = ratio(); t = blt.type === "gear" ? "Qarama-qarshi aylanadi" : r > 1 ? "Tezlatuvchi" : r < 1 ? "Sekinlatuvchi" : "1 : 1"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const k = tabKey(), p = [];
  if (k === "kin") {
    p.push("<p>Jism aylana bo‘ylab harakatlanganda tezlik vektori doim aylanaga <b>urinma</b> bo‘ylab yo‘nalgan. Tekis harakatda tezlik moduli o‘zgarmaydi, lekin yo‘nalishi uzluksiz o‘zgaradi — demak, jism <b>tezlanish</b> bilan harakatlanadi. Bu tezlanish markazga yo‘nalgan: aₙ = v²/R = ω²R.</p>");
    p.push("<p><b>Tezlik godografi</b>da tezlik vektorlari bir nuqtaga keltirilgan: kichik Δφ burilishdagi Δv vektori trayektoriya markaziga qaragan, shuning uchun tezlanish ham markazga yo‘nalgan. Jismning x va y proyeksiyalari (soyalari) garmonik tebranadi.</p>");
    if (kin.at !== 0) p.push("<p><b>Notekis</b> harakatda tangensial tezlanish a<sub>τ</sub> tezlik modulini, normal tezlanish aₙ esa yo‘nalishini o‘zgartiradi. To‘liq tezlanish a = √(aₙ² + a<sub>τ</sub>²) markazga emas, burchak ostida yo‘nalgan.</p>");
  } else if (k === "string") {
    p.push("<p>Silliq stolda sharchani aylana bo‘ylab ushlab turuvchi yagona gorizontal kuch — <b>ip taranglik kuchi</b>. Nyutonning ikkinchi qonuniga ko‘ra u markazga yo‘nalgan va F = ma = mv²/R. Tezlik 2 marta ortsa, kerakli kuch 4 marta ortadi; ip qisqartirilsa ham kuch ortadi.</p>");
    p.push(str.on ? `<p>Ip chidaydigan eng katta kuch ${fmt(str.Fmax, 1)} N: bu sharcha uchun ip v = √(F<sub>max</sub>·R/m) = ${fmt(P.breakSpeed(str.m, str.R, str.Fmax), 2)} m/s dan katta tezlikda uziladi.</p>` : "<p>Ip uzilgach sharchaga gorizontal kuch ta’sir etmaydi va u <b>inersiya</b> bo‘yicha ip uzilgan paytdagi tezlik yo‘nalishida — aylanaga <b>urinma</b> bo‘ylab to‘g‘ri chiziqli tekis harakatlanadi. U markazdan radius bo‘ylab «qochmaydi»!</p>");
  } else if (k === "car") {
    const cs = carState();
    p.push("<p>Gorizontal burilishda avtomobilni aylana bo‘ylab yuritadigan markazga intilma kuch — shinalar bilan yo‘l orasidagi <b>tinchlikdagi ishqalanish kuchi</b>. U μN dan oshmaydi: mv²/R ≤ μmg, ya’ni v<sub>max</sub> = √(μgR) — massaga bog‘liq emas. Ho‘l yo‘l, qor va muzda μ kichik.</p>");
    if (car.alpha > 0) p.push("<p>Ichkariga qiya burilishda tayanch reaksiya kuchi N ham markazga og‘adi va uning gorizontal tashkil etuvchisi markazga intilma kuchning bir qismini beradi. <b>Ideal tezlik</b>da v = √(gR·tg α) ishqalanish umuman kerak emas — hatto muzda ham.</p>");
    if (!cs.ok) p.push(cs.a > cs.b.hi ? "<p>Kerakli markazga intilma kuch ishqalanishning eng katta qiymatidan katta — shinalar sirpanadi va avtomobil kattaroq radiusli yoy bo‘ylab tashqariga chiqib ketadi (sirpanishda ishqalanish yana ham kamayadi).</p>" : "<p>Tezlik juda kichik: qiya yo‘lda ishqalanish avtomobilni ushlab tura olmaydi va u qiyalik bo‘ylab ichkariga — pastga sirpanadi.</p>");
  } else if (k === "loop") {
    p.push("<p>Sharcha ishqalanishsiz sirpanadi — to‘liq mexanik energiya saqlanadi: v² = 2g(h − y). Halqada markazga intilma kuchni tayanch reaksiyasi N va og‘irlik kuchining radial tashkil etuvchisi birgalikda beradi: N − mg·cos θ = mv²/R.</p>");
    p.push("<p>Halqa tepasida mg + N = mv²/R. Sharcha yo‘ldan ajralmasligi uchun N ≥ 0, ya’ni v ≥ √(gR); energiya saqlanishidan h ≥ 2,5R kelib chiqadi.</p>");
    const det = P.detachAngle(lp.k * lp.R, lp.R);
    if (det) p.push(`<p>h = ${fmt(lp.k, 2)}R < 2,5R: θ ≈ ${fmt(det / DEG, 0)}° da N = 0 bo‘ladi — sharcha yo‘ldan ajralib, gorizontga burchak ostida otilgan jism kabi parabola bo‘ylab uchadi.</p>`);
    else if (lp.k <= 1) p.push("<p>h ≤ R: sharcha halqaning gorizontal diametridan yuqoriga chiqmaydi, N doim musbat — sharcha oldinga-orqaga tebranadi.</p>");
  } else {
    const t = blt.type;
    p.push(t === "gear" ? "<p>Tishli uzatmada g‘ildiraklar <b>qarama-qarshi</b> tomonga aylanadi. Tishlar bir-biriga mos kelishi uchun ularning qadami bir xil, shuning uchun tishlar soni radiusga proporsional: n₂/n₁ = z₁/z₂ = R₁/R₂.</p>" : t === "bike" ? "<p>Velosipedda pedal yulduzchasi (R₁) zanjir orqali orqa yulduzchani (R₂) aylantiradi. Orqa g‘ildirak yulduzcha bilan bitta o‘qda — bir xil burchak tezlik bilan aylanadi, velosiped tezligi v = ω₂·R<sub>g</sub> (R<sub>g</sub> = 35 cm).</p>" : "<p>Tasma sirpanmasa, ikkala g‘ildirak gardishidagi nuqtalarning <b>chiziqli tezligi bir xil</b>: v = ω₁R₁ = ω₂R₂. Shuning uchun kichik g‘ildirak tezroq aylanadi: n₂/n₁ = R₁/R₂.</p>");
    p.push("<p>Uzatma <b>tezlatuvchi</b> (R₂ < R₁) yoki <b>sekinlatuvchi</b> (R₂ > R₁) bo‘ladi. Sekinlatuvchi uzatma aylantiruvchi kuch momentini oshiradi — shuning uchun velosipedda tepalikka chiqishda kattaroq orqa yulduzcha tanlanadi.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const k = tabKey();
  const html = k === "kin" ? "<small>Markazga intilma tezlanish</small> a = v²/R = ω²R" : k === "string" ? "<small>Markazga intilma kuch</small> F = mv²/R" : k === "car" ? (car.alpha > 0 ? "<small>Ideal tezlik</small> v = √(gR·tg α)" : "<small>Xavfsiz burilish</small> v ≤ √(μgR)") : k === "loop" ? "<small>Halqa tepasida</small> mg + N = mv²/R" : "<small>Uzatma</small> ω₁R₁ = ω₂R₂";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  const show = ui.mode === "dyn" && ui.sub === "string";
  actBtn.hidden = !show;
  if (show) { const t = str.on ? "Ipni kesish" : "Ipni bog‘lash"; if (actBtn.textContent !== t) actBtn.textContent = t; }
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "kin") stepKin(dt);
  else if (ui.mode === "belt") stepBelt(dt);
  else if (ui.sub === "string") stepString(dt);
  else if (ui.sub === "car") stepCar(dt);
  else stepLoop(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); updateAction(); graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());

function resetMode() {
  if (ui.mode === "kin") Object.assign(kin, { v: kin.v0, th: 0, th0: 0, t: 0, hist: [], hold: false });
  else if (ui.mode === "belt") Object.assign(blt, { th1: 0, th2: 0, s: 0, xb: 0, N1: 0, N2: 0, t: 0 });
  else if (ui.sub === "string") Object.assign(str, { on: true, fly: null, why: "", wait: 0, v: str.v0, th: 0, t: 0, hist: [], hold: false, rate: 1 });
  else if (ui.sub === "car") Object.assign(car, { th: -Math.PI / 2, skid: null, trail: [], off: "", wait: 0 });
  else restartLoop();
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); if (!loop.running) loop.start(); });
actBtn.addEventListener("click", () => { if (str.on) breakString("cut"); else reattach(); if (!loop.running) loop.start(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const kVC = bindRange($("#kV"), $("#kVOut"), (v) => `${fmt(v, 2)} m/s`, (v) => { kin.v0 = v; kin.v = v; customized(); refresh(); });
const kRC = bindRange($("#kR"), $("#kROut"), (v) => `${fmt(v, 0)} cm`, (v) => { kin.R = v / 100; customized(); refresh(); });
const kAC = bindRange($("#kA"), $("#kAOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 2)} m/s²`, (v) => { kin.at = v; customized(); refresh(); });
const sVC = bindRange($("#sV"), $("#sVOut"), (v) => `${fmt(v, 1)} m/s`, (v) => { str.v0 = v; str.v = v; str.spin = false; customized(); refresh(); });
const sMC = bindRange($("#sM"), $("#sMOut"), (v) => `${fmt(v * 1000, 0)} g`, (v) => { str.m = v; customized(); refresh(); });
const sRC = bindRange($("#sR"), $("#sROut"), (v) => `${fmt(v, 0)} cm`, (v) => { str.R = v / 100; customized(); refresh(); });
const sTC = bindRange($("#sT"), $("#sTOut"), (v) => `${fmt(v, 1)} N`, (v) => { str.Fmax = v; customized(); refresh(); });
const cVC = bindRange($("#cV"), $("#cVOut"), (v) => `${fmt(v, 0)} km/soat`, (v) => { car.v = v / 3.6; customized(); refresh(); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v, 0)} m`, (v) => { car.R = v; customized(); refresh(); });
const cAC = bindRange($("#cA"), $("#cAOut"), (v) => `${fmt(v, 0)}°`, (v) => { car.alpha = v * DEG; customized(); refresh(); });
document.querySelectorAll("[data-road-value]").forEach((b) => b.addEventListener("click", () => { car.mu = +b.dataset.roadValue; syncAll(); customized(); refresh(); }));
const lHC = bindRange($("#lH"), $("#lHOut"), (v) => `${fmt(v, 2)}R = ${fmt(v * lp.R, 2)} m`, (v) => { lp.k = v; restartLoop(); customized(); refresh(); });
const lRC = bindRange($("#lR"), $("#lROut"), (v) => `${fmt(v, 2)} m`, (v) => { lp.R = v; lHC.sync(); restartLoop(); customized(); refresh(); });
const bNC = bindRange($("#bN"), $("#bNOut"), (v) => `${fmt(v, 2)} ayl/s`, (v) => { blt.n1 = v; customized(); refresh(); });
const b1C = bindRange($("#b1"), $("#b1Out"), (v) => `${fmt(v, 1)} cm`, (v) => { blt.R1 = v; customized(); refresh(); });
const b2C = bindRange($("#b2"), $("#b2Out"), (v) => `${fmt(v, 1)} cm`, (v) => { blt.R2 = v; customized(); refresh(); });
document.querySelectorAll("[data-btype-value]").forEach((b) => b.addEventListener("click", () => { blt.type = b.dataset.btypeValue; syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sudrash */
const canvas = stage.canvas;
let drag = null;
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) {
    if(id === "scut") { if(str.on) breakString("cut"); else reattach(); if(!loop.running) loop.start(); refresh(); return; }
    drag=id;
    if(id === "kbody" || id === "ktip") kin.hold=true;
    if(id === "sball" || id === "stip") str.hold=true;
    if(id === "lball") lp.phase="hold";
  },
  move(id,p) {
    if(drag !== id)return;
    if(id === "kbody" || id === "sball") {
      const w=scene.body(id,p);if(!w)return;
      const R=clamp(Math.round(Math.hypot(w.x,w.y)*100),20,100)/100,th=Math.atan2(w.y,w.x);
      if(id === "kbody") { kin.R=R;kin.th+=wrapPi(th-kin.th);kin.th0=kin.th;kRC.set(R*100); }
      else { str.R=R;str.th+=wrapPi(th-str.th);sRC.set(R*100); }
    } else {
      const v=scene.parameter(id,p);
      if(id === "ktip") {kin.v0=kin.v=clamp(Math.round(v*20)/20,.2,4);kVC.set(kin.v);}
      else if(id === "stip") {str.v0=str.v=clamp(Math.round(v*10)/10,.5,8);str.spin=false;sVC.set(str.v);}
      else if(id === "needle") {const kmh=clamp(Math.round(v),10,160);car.v=kmh/3.6;cVC.set(kmh);}
      else if(id === "bank") {car.alpha=clamp(Math.round(v/DEG),0,30)*DEG;cAC.set(car.alpha/DEG);}
      else if(id === "lball") {lp.k=clamp(Math.round(v*20)/20,.5,3.5);lHC.set(lp.k);Object.assign(lp,{s:TR.sOfH(lp.k),w:0,fly:null,det:null,t:0,hist:[],top:0,done:""});}
      else if(id === "r1") {blt.R1=clamp(Math.round(v*2)/2,3,18);b1C.set(blt.R1);}
      else if(id === "r2") {blt.R2=clamp(Math.round(v*2)/2,3,18);b2C.set(blt.R2);}
    }
    if((id === "sball" || id === "stip") && P.tension(str.m,str.v,str.R)>str.Fmax)breakString("break");
    customized();refresh();
  },
  end() {endDrag();}
});
function endDrag() {
  if(!drag)return;
  if(drag === "lball" && lp.phase === "hold") {lp.phase="run";if(!loop.running)loop.start();}
  kin.hold=false;str.hold=false;drag=null;refresh();
}

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  uniform: { mode: "kin", title: "Tekis aylanma harakat", lesson: "Tezlik moduli o‘zgarmaydi, yo‘nalishi esa uzluksiz o‘zgaradi: ko‘k v vektori aylanaga urinma, qizil aₙ — markazga yo‘nalgan. Jismni yoki v vektori uchini surib ko‘ring.", set: () => Object.assign(kin, { v0: 1.5, R: 0.6, at: 0 }), tab: "xy" },
  radius: { mode: "kin", title: "Tezlanish radiusga bog‘liq", lesson: "v = 2 m/s o‘zgarmas. Jismni markazga yaqinlashtiring: radius 2 marta kamaysa, a = v²/R 2 marta ortadi.", set: () => Object.assign(kin, { v0: 2, R: 0.8, at: 0 }), tab: "xy" },
  accel: { mode: "kin", title: "Notekis harakat (a_τ ≠ 0)", lesson: "Tezlik har soniyada 0,5 m/s ga ortadi: sariq a_τ tezlik modulini, qizil aₙ yo‘nalishini o‘zgartiradi. To‘liq tezlanish a (binafsha) markazdan og‘gan; tezlik ortgan sari aₙ ustun keladi.", set: () => Object.assign(kin, { v0: 0.4, R: 0.6, at: 0.5 }), tab: "xy" },
  string: { mode: "dyn", sub: "string", title: "Ipdagi sharcha", lesson: "Silliq stolda ipga bog‘langan sharcha aylanmoqda. Ipni bosing yoki «Ipni kesish» tugmasini bosing — sharcha urinma bo‘ylab ketadi. Sharchani surib, ipni qisqartirib ko‘ring.", set: () => Object.assign(str, { v0: 3, m: 0.2, R: 0.6, Fmax: 5, spin: false }), tab: "fv" },
  snap: { mode: "dyn", sub: "string", title: "Ip uziladi", lesson: "Sharcha asta tezlashtiriladi: taranglik F = mv²/R ortib, 4 N ga yetganda ip uziladi. Sharcha markazdan emas, urinma bo‘ylab uchib ketadi.", set: () => Object.assign(str, { v0: 2.4, m: 0.2, R: 0.5, Fmax: 4, spin: true }), tab: "ft" },
  carDry: { mode: "dyn", sub: "car", title: "Quruq yo‘lda burilish", lesson: "Quruq asfaltda (μ = 0,7) R = 60 m burilishni 73 km/soatgacha xavfsiz o‘tish mumkin. Spidometr milini surib tezlikni oshiring — qizil sohada avtomobil sirpanadi.", set: () => Object.assign(car, { v: 60 / 3.6, R: 60, mu: 0.7, alpha: 0 }), tab: "vmax" },
  carIce: { mode: "dyn", sub: "car", title: "Muzda sirpanish", lesson: "Muzda μ = 0,08: xuddi shu burilishda xavfsiz tezlik atigi 25 km/soat. 60 km/soatda ishqalanish yetmaydi — avtomobil sirpanib, yo‘ldan chiqib ketadi.", set: () => Object.assign(car, { v: 60 / 3.6, R: 60, mu: 0.08, alpha: 0 }), tab: "fric" },
  carBank: { mode: "dyn", sub: "car", title: "Qiya burilish (muzda ham)", lesson: "Yo‘l ichkariga 20° qiya. Muzda ham 46–59 km/soat oralig‘ida burilish mumkin: ideal 53 km/soatda ishqalanish deyarli kerak emas — N ning gorizontal tashkil etuvchisi yetarli. O‘ngdagi yo‘l kesimini surib qiyalikni o‘zgartiring.", set: () => Object.assign(car, { v: 53 / 3.6, R: 60, mu: 0.08, alpha: 20 * DEG }), tab: "fric" },
  loopOk: { mode: "dyn", sub: "loop", title: "Halqa: h = 3R", lesson: "h = 3R: sharcha halqani to‘liq aylanib chiqadi. Tepada N = mg, pastda N = 7mg (ortiqcha yuklama). Sharchani tepalikda surib boshqa balandlikdan qo‘yib yuboring.", set: () => Object.assign(lp, { k: 3, R: 0.5 }), tab: "n" },
  loopMin: { mode: "dyn", sub: "loop", title: "Eng kichik balandlik 2,5R", lesson: "h = 2,5R — eng kichik balandlik: tepada N = 0, markazga intilma kuchni faqat og‘irlik kuchi beradi va v = √(gR).", set: () => Object.assign(lp, { k: 2.5, R: 0.5 }), tab: "n" },
  loopFall: { mode: "dyn", sub: "loop", title: "Halqadan ajralish (h = 2R)", lesson: "h = 2R: sharcha tepaga yetmasdan (θ ≈ 132°) N = 0 bo‘ladi va yo‘ldan ajralib, parabola bo‘ylab tushadi.", set: () => Object.assign(lp, { k: 2, R: 0.5 }), tab: "n" },
  loopSwing: { mode: "dyn", sub: "loop", title: "Tebranish (h < R)", lesson: "h = 0,8R < R: sharcha halqaning chorak qismidan yuqoriga chiqmaydi va oldinga-orqaga tebranadi. Energiya grafigida kinetik va potensial energiya almashinuvini kuzating.", set: () => Object.assign(lp, { k: 0.8, R: 0.5 }), tab: "en" },
  belt: { mode: "belt", title: "Tasmali uzatma", lesson: "Tasma ikkala g‘ildirak gardishini bir xil v tezlik bilan harakatlantiradi, shuning uchun kichik g‘ildirak 2 marta tezroq aylanadi. G‘ildirak chetini surib radiusni o‘zgartiring.", set: () => Object.assign(blt, { type: "belt", n1: 0.5, R1: 12, R2: 6 }) },
  gear: { mode: "belt", title: "Tishli uzatma (sekinlatish)", lesson: "Kichik tishli g‘ildirak (12 tish) kattasini (30 tish) aylantiradi: g‘ildiraklar qarama-qarshi aylanadi, katta g‘ildirak 2,5 marta sekinroq.", set: () => Object.assign(blt, { type: "gear", n1: 1.2, R1: 6, R2: 15 }) },
  bike: { mode: "belt", title: "Velosiped", lesson: "Pedal 1 ayl/s (60 ayl/min) aylantiriladi. Yulduzchalar nisbati 10 : 4 — orqa g‘ildirak 2,5 ayl/s aylanadi va velosiped ≈ 20 km/soat tezlikda yuradi. Orqa yulduzchani kattalashtirib ko‘ring.", set: () => Object.assign(blt, { type: "bike", n1: 1, R1: 10, R2: 4 }) },
};
const GROUPS = [["Kinematika", ["uniform", "radius", "accel"]], ["Ip va sharcha", ["string", "snap"]], ["Burilish", ["carDry", "carIce", "carBank"]], ["Vertikal halqa", ["loopOk", "loopMin", "loopFall", "loopSwing"]], ["Uzatmalar", ["belt", "gear", "bike"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  kVC.set(kin.v0); kRC.set(kin.R * 100); kAC.set(kin.at);
  sVC.set(str.v0); sMC.set(str.m); sRC.set(str.R * 100); sTC.set(str.Fmax);
  cVC.set(Math.round(car.v * 3.6)); cRC.set(car.R); cAC.set(Math.round(car.alpha / DEG));
  document.querySelectorAll("[data-road-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.roadValue === car.mu)));
  lRC.set(lp.R); lHC.set(lp.k);
  bNC.set(blt.n1); b1C.set(blt.R1); b2C.set(blt.R2);
  document.querySelectorAll("[data-btype-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.btypeValue === blt.type)));
  document.querySelectorAll("[data-sub-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.subValue === ui.sub)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { kin: "Jismni yoki v vektori uchini suring", string: "Sharchani suring, ipni bosib kesing", car: "Spidometr milini va yo‘l kesimini suring", loop: "Sharchani tepalikda suring va qo‘yib yuboring", belt: "G‘ildiraklar chetini suring" };
const DHINT = { string: "Ipni bosing yoki «Ipni kesish» tugmasini bosing — sharcha urinma bo‘ylab ketadi.", car: "Avtomobil massasi 1200 kg. Spidometr milini va o‘ngdagi yo‘l kesimini sichqoncha bilan suring.", loop: "Balandlik halqa radiusi R birligida. Sharchani tepalik bo‘ylab surib qo‘yib yuboring." };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== ui.sub; });
  $("[data-mode-hint]").textContent = MODE_HINT[tabKey()];
  $("[data-dhint]").textContent = DHINT[ui.sub] || "";
  updateAction(); setupTabs();
}
const MODE_DEFAULT = { kin: "uniform", dyn: "string", belt: "belt" }, SUB_DEFAULT = { string: "string", car: "carDry", loop: "loopOk" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
document.querySelectorAll("[data-sub-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.subValue !== ui.sub || ui.mode !== "dyn") loadPreset(SUB_DEFAULT[b.dataset.subValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  if (drag) endDrag();
  p.set();
  if (p.sub) ui.sub = p.sub;
  ui.mode = p.mode;
  resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[tabKey()][0]?.[0]);
  refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "uniform");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
