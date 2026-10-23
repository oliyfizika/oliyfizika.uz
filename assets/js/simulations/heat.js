// ==========================================================================
// Issiqlik almashinuvi — virtual laboratoriya (simulations/heat.html)
// 1) Kalorimetr: 2–3 jism (suv, muz, bug‘, spirt, metallar, noma’lum metall) va idish — issiqlik muvozanati.
// 2) Isitish: moddani elektr isitgich yoki yoqilg‘i bilan isitish/sovitish — isitish egri chizig‘i, erish, qaynash.
// Fizika: heat-physics.js (entalpiya bo'yicha, Node'da tekshirilgan). Grafiklar: heat-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import {
  SUBSTANCES as SUB, FUELS, hOf, TOf, phaseOf, equilibrium, stepMix, stableDt, stepHeat, stageHeats, measuredC, PHASE_NAMES,
} from "./heat-physics.js";
import { drawMixTemps, drawMixBalance, drawHeatCurve, drawHeatStages } from "./heat-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const T_ROOM = 20;
const SMALL = "600 11px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Ma'lumotlar */

const KINDS = {
  water:     { sub: "water", name: "Suv", tMin: 0, tMax: 100, branch: "liquid" },
  ice:       { sub: "water", name: "Muz", tMin: -40, tMax: 0, branch: "solid" },
  steam:     { sub: "water", name: "Suv bug‘i", tMin: 100, tMax: 150, branch: "gas" },
  alcohol:   { sub: "alcohol", name: "Spirt", tMin: -20, tMax: 78, branch: "liquid" },
  aluminium: { sub: "aluminium", name: "Alyuminiy", tMin: -20, tMax: 400, branch: "solid", metal: true },
  iron:      { sub: "iron", name: "Temir", tMin: -20, tMax: 400, branch: "solid", metal: true },
  copper:    { sub: "copper", name: "Mis", tMin: -20, tMax: 400, branch: "solid", metal: true },
  brass:     { sub: "brass", name: "Latun", tMin: -20, tMax: 400, branch: "solid", metal: true },
  lead:      { sub: "lead", name: "Qo‘rg‘oshin", tMin: -20, tMax: 300, branch: "solid", metal: true },
  unknown:   { sub: null, name: "Noma’lum metall", tMin: -20, tMax: 220, branch: "solid", metal: true },
};
const LIQUID_KINDS = ["water", "alcohol"];
const BODY_KINDS = ["water", "ice", "steam", "alcohol", "aluminium", "iron", "copper", "brass", "lead", "unknown"];
const UNKNOWN_POOL = ["aluminium", "iron", "copper", "brass", "lead"];
const HEAT_SUBS = ["water", "alcohol", "naphthalene", "tin", "lead", "aluminium", "wax"];

const hbOf = (s) => s.lambda + s.cl * (s.tb - s.tm);
function h0Of(kind, sub, T) {
  const s = SUB[sub];
  if (kind.branch === "liquid" && T <= s.tm) return s.lambda;
  if (kind.branch === "gas" && T <= s.tb) return hbOf(s) + s.L;
  if (kind.branch === "solid" && !s.amorphous && T >= s.tm) return 0;
  return hOf(s, T);
}

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "mix", tab: "temp", speed: 10 };
const mix = {
  cfg: [
    { kind: "water", m: 0.3, t: 20, on: true },
    { kind: "water", m: 0.2, t: 80, on: true },
    { kind: "ice", m: 0.05, t: -10, on: false },
  ],
  cup: { on: false, m: 0.1 }, loss: false, unknown: "copper", reveal: false,
  started: false, drop: 0, t: 0, bodies: [], hist: [], lost: 0, eq: null, done: false, lastRec: -1,
};
const heat = {
  cfg: { sub: "water", m: 0.5, t0: -20, src: "electric", P: 1000, fuel: "alcohol", rate: 3, eta: 40, loss: false },
  on: true, started: false, t: 0, body: null, hist: [], fuelM: 0, Qin: 0, lost: 0, done: false, doneMsg: "", lastRec: -1,
};
let presetId = null;
let lastPreset = "mixWater";

const subOfCfg = (c) => (c.kind === "unknown" ? mix.unknown : KINDS[c.kind].sub);
const nameOfCfg = (c) => (c.kind === "unknown" ? (mix.reveal ? `${SUB[mix.unknown].name} (X)` : "X metall") : KINDS[c.kind].name);
const BODY_COLORS = ["#3b82f6", "#f97316", "#a855f7"];

function kappa(kind) { return kind.branch === "liquid" ? 1500 : kind.branch === "gas" ? 1000 : 150; }

function buildMix() {
  const bodies = [];
  mix.cfg.forEach((c, i) => {
    if (!c.on) return;
    const kind = KINDS[c.kind], sub = subOfCfg(c), s = SUB[sub];
    const h = h0Of(kind, sub, c.t);
    bodies.push({ i, kind, sub, s, m: c.m, h, h0: h, K: kappa(kind) * Math.cbrt(c.m * c.m), label: nameOfCfg(c), color: BODY_COLORS[i], cfg: c });
  });
  if (mix.cup.on) {
    const s = SUB.aluminium, t = mix.cfg[0].t, h = hOf(s, t);
    bodies.push({ i: "cup", kind: KINDS.aluminium, sub: "aluminium", s, m: mix.cup.m, h, h0: h, K: 150 * Math.cbrt(mix.cup.m * mix.cup.m), label: "Idish", color: "#94a3b8", cup: true });
  }
  mix.bodies = bodies;
  mix.eq = equilibrium(bodies.map((b) => ({ s: b.s, m: b.m, h0: b.h0 })));
  mix.started = false; mix.drop = 0; mix.t = 0; mix.hist = []; mix.lost = 0; mix.done = false; mix.lastRec = -1;
  record(mix, true);
}

function heaterPower() {
  const c = heat.cfg;
  if (!heat.on) return 0;
  if (c.src === "electric") return c.P;
  return (c.eta / 100) * FUELS[c.fuel].q * (c.rate / 1000 / 60);
}
const lossG = () => 1.5 * Math.cbrt((heat.cfg.m / 0.5) ** 2);
function heatTmax() {
  const s = SUB[heat.cfg.sub];
  if (s.amorphous) return s.t2 + 50;
  return Math.min(Number.isFinite(s.tb) ? s.tb + 40 : Infinity, Math.max(s.tm + 120, 160));
}
function buildHeat() {
  const c = heat.cfg, s = SUB[c.sub];
  const kindLike = { branch: c.t0 < s.tm ? "solid" : "liquid" };
  const h = h0Of(kindLike, c.sub, c.t0);
  heat.body = { s, m: c.m, h, h0: h };
  heat.on = true; heat.started = false; heat.t = 0; heat.hist = []; heat.fuelM = 0; heat.Qin = 0; heat.lost = 0; heat.done = false; heat.doneMsg = ""; heat.lastRec = -1;
  record(heat, true);
}

function record(st, force = false) {
  const every = Math.max(0.02, ui.speed * 0.04);
  if (!force && st.t - st.lastRec < every) return;
  st.lastRec = st.t;
  if (st === mix) st.hist.push({ t: st.t, T: st.bodies.map((b) => TOf(b.s, b.h)) });
  else { const p = phaseOf(st.body.s, st.body.h); st.hist.push({ t: st.t, T: TOf(st.body.s, st.body.h), ph: p.phase, on: st.on }); }
  if (st.hist.length > 2400) st.hist = st.hist.filter((_, k) => k % 2 === 0 || k === st.hist.length - 1);
}

/* ------------------------------------------------------------------ Simulyatsiya qadami */

function stepSim(dtReal) {
  const dtSim = dtReal * ui.speed;
  if (ui.mode === "mix") {
    if (!mix.started || mix.done) return;
    if (mix.drop < 1) { mix.drop = Math.min(1, mix.drop + dtReal / 0.9); return; }
    const dt = stableDt(mix.bodies);
    const n = Math.min(4000, Math.ceil(dtSim / dt));
    const h = dtSim / n;
    const env = mix.loss ? { G: 1.0, T: T_ROOM, idx: [mix.bodies.findIndex((b) => b.cup) >= 0 ? mix.bodies.findIndex((b) => b.cup) : 0] } : null;
    for (let k = 0; k < n; k++) { mix.lost += stepMix(mix.bodies, h, env); mix.t += h; record(mix); }
    const Ts = mix.bodies.map((b) => TOf(b.s, b.h));
    const spread = Math.max(...Ts) - Math.min(...Ts);
    if (!mix.loss && spread < 0.01) { mix.done = true; record(mix, true); }
    if (mix.loss && Math.abs(Ts[0] - T_ROOM) < 0.2 && spread < 0.05) { mix.done = true; record(mix, true); }
  } else {
    if (!heat.started || heat.done) return;
    const c = heat.cfg, b = heat.body;
    const n = Math.max(1, Math.ceil(dtSim / 0.25));
    const h = dtSim / n;
    for (let k = 0; k < n; k++) {
      const P = heaterPower();
      const loss = c.loss || !heat.on ? { G: lossG(), T: T_ROOM } : null;
      heat.lost += stepHeat(b, P, h, loss);
      heat.Qin += P * h;
      if (heat.on && c.src === "fuel") heat.fuelM += (c.rate / 1000 / 60) * h;
      heat.t += h;
      record(heat);
      const ph = phaseOf(b.s, b.h), T = TOf(b.s, b.h);
      if (ph.phase === "gas") { heat.done = true; heat.doneMsg = "Modda butunlay bug‘lanib ketdi"; break; }
      if (heat.on && T >= heatTmax()) { heat.done = true; heat.doneMsg = `Tajriba chegarasi: ${fmt(heatTmax(), 0)} °C`; break; }
      if (!heat.on && T - T_ROOM < 0.3 && !(ph.phase === "melting")) { heat.done = true; heat.doneMsg = "Modda xona temperaturasigacha sovidi"; break; }
    }
    if (heat.done) record(heat, true);
  }
}

/* ------------------------------------------------------------------ Ranglar */

const STOPS = [[-40, [37, 99, 235]], [0, [96, 165, 250]], [20, [125, 180, 240]], [45, [244, 170, 120]], [80, [249, 115, 22]], [150, [220, 38, 38]], [700, [153, 27, 27]]];
function tempRGB(T) {
  if (T <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    if (T <= STOPS[i][0]) {
      const [t0, a] = STOPS[i - 1], [t1, b] = STOPS[i], u = (T - t0) / (t1 - t0);
      return a.map((v, k) => Math.round(v + (b[k] - v) * u));
    }
  }
  return STOPS[STOPS.length - 1][1];
}
const rgba = (rgb, a) => `rgba(${rgb.join(",")},${a})`;
const hexRGB = (hx) => [1, 3, 5].map((k) => parseInt(hx.slice(k, k + 2), 16));
const tempTxt = (T) => `${fmt(T, Math.abs(T) < 100 ? 1 : 0)} °C`;
const kJ = (Q) => (Math.abs(Q) >= 1e6 ? `${fmt(Q / 1e6, 2)} MJ` : Math.abs(Q) >= 1000 ? `${fmt(Q / 1000, Math.abs(Q) >= 1e5 ? 0 : 1)} kJ` : `${fmt(Q, 0)} J`);
const kJhtml = (Q) => (Math.abs(Q) >= 1e6 ? `${fmt(Q / 1e6, 2)}<small>MJ</small>` : Math.abs(Q) >= 1000 ? `${fmt(Q / 1000, Math.abs(Q) >= 1e5 ? 0 : 1)}<small>kJ</small>` : `${fmt(Q, 0)}<small>J</small>`);
const timeTxt = (t) => (t < 120 ? `${fmt(t, t < 10 ? 1 : 0)} s` : `${Math.floor(t / 60)} min ${String(Math.round(t % 60)).padStart(2, "0")} s`);

/* ------------------------------------------------------------------ Chizish: umumiy */

function thermometer(ctx, c, x, yTop, yBot, T, { tMin = -30, tMax = 120 } = {}) {
  const r = 6;
  ctx.save();
  ctx.lineWidth = 1.5; ctx.strokeStyle = c.borderStrong; ctx.fillStyle = c.bg;
  ctx.beginPath(); ctx.roundRect(x - 4, yTop, 8, yBot - yTop, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, yBot + r - 2, r, 0, TAU); ctx.fillStyle = c.danger; ctx.fill();
  const f = clamp((T - tMin) / (tMax - tMin), 0, 1);
  ctx.fillStyle = c.danger; ctx.fillRect(x - 2, yBot - 2 - f * (yBot - yTop - 6), 4, f * (yBot - yTop - 6) + 4);
  ctx.restore();
}

function beakerPath(ctx, x, y, w, h) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h - 8); ctx.quadraticCurveTo(x, y + h, x + 8, y + h); ctx.lineTo(x + w - 8, y + h); ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - 8); ctx.lineTo(x + w, y);
}

function iceCube(ctx, x, y, s, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(219,234,254,0.95)"; ctx.strokeStyle = "rgba(96,165,250,0.95)"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, Math.max(2, s * 0.18)); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.moveTo(x - s * 0.25, y - s * 0.25); ctx.lineTo(x - s * 0.05, y - s * 0.3); ctx.stroke();
  ctx.restore();
}

function metalBlock(ctx, c, x, y, w, h, colorHex, T) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  const rgb = hexRGB(colorHex);
  g.addColorStop(0, rgba(rgb.map((v) => Math.min(255, v + 50)), 1)); g.addColorStop(1, rgba(rgb, 1));
  ctx.fillStyle = g; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
  const glow = clamp((T - 60) / 300, 0, 1);
  if (glow > 0) { ctx.fillStyle = `rgba(249,115,22,${0.55 * glow})`; ctx.fill(); }
  ctx.restore();
}

function bubbles(ctx, x, y, w, h, n, seed, t, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  for (let k = 0; k < n; k++) {
    const r1 = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453, fr = r1 - Math.floor(r1);
    const sp = 0.6 + fr * 0.8;
    const ph = ((t * sp * 0.6 + fr) % 1);
    const bx = x + w * (0.1 + 0.8 * ((fr * 7.3) % 1)) + Math.sin(t * 3 + k) * 3;
    const by = y + h - ph * h;
    ctx.beginPath(); ctx.arc(bx, by, 1.5 + fr * 2.5, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function wisps(ctx, x, y, w, n, t, alpha) {
  ctx.save(); ctx.strokeStyle = `rgba(148,163,184,${alpha})`; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (let k = 0; k < n; k++) {
    const ph = (t * 0.35 + k / n) % 1;
    const bx = x + (w * (k + 0.5)) / n;
    ctx.globalAlpha = (1 - ph) * alpha;
    ctx.beginPath();
    for (let j = 0; j <= 12; j++) { const yy = y - ph * 40 - j * 3; const xx = bx + Math.sin(j * 0.7 + t * 2 + k) * 5; if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
    ctx.stroke();
  }
  ctx.restore();
}

let clock = 0; // vizual animatsiya vaqti (real)

/* ------------------------------------------------------------------ Chizish: kalorimetr */

function drawMix(ctx, stage) {
  const { w, h, colors: c } = stage;
  const narrow = w < 560;
  const tableY = h - 22;
  ctx.strokeStyle = c.border; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, tableY); ctx.lineTo(w - 10, tableY); ctx.stroke();

  // Kalorimetr
  const CW = narrow ? Math.min(170, w * 0.46) : Math.min(260, w * 0.33), CH = Math.min(h - 84, CW * 1.08);
  const cx = narrow ? w * 0.28 : w * 0.3, x0 = cx - CW / 2, y0 = tableY - CH;
  ctx.save();
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x0, y0, CW, CH, 10); ctx.fill(); ctx.stroke();
  // izolyatsiya chiziqchalari
  ctx.strokeStyle = c.border; ctx.lineWidth = 1;
  for (let yy = y0 + 14; yy < tableY - 8; yy += 12) { ctx.beginPath(); ctx.moveTo(x0 + 4, yy); ctx.lineTo(x0 + 10, yy - 6); ctx.moveTo(x0 + CW - 10, yy); ctx.lineTo(x0 + CW - 4, yy - 6); ctx.stroke(); }
  ctx.restore();
  const ix = x0 + 16, iw = CW - 32, iy = y0 + 18, ih = CH - 30;
  const inside = mix.started && mix.drop >= 1;
  const bodies = mix.bodies;
  const Tof = (b) => TOf(b.s, b.h);

  // Suyuqlik hajmi
  let vol = 0, liqT = 0, liqHeat = 0;
  bodies.forEach((b, k) => {
    if (b.cup) return;
    if (!inside && k > 0) return;
    const p = phaseOf(b.s, b.h);
    const lm = b.m * (b.kind.branch === "solid" && !(b.sub === "water" || b.sub === "alcohol") ? 0 : p.liquid);
    vol += lm / b.s.rho;
    liqT += lm * b.s.cl * Tof(b); liqHeat += lm * b.s.cl;
  });
  const Tliq = liqHeat > 0 ? liqT / liqHeat : Tof(bodies[0]);
  const level = clamp((vol / 0.0008) * ih, 6, ih - 6);
  // ichki idish
  ctx.save();
  ctx.fillStyle = c.bg; ctx.strokeStyle = mix.cup.on ? c.text2 : c.borderStrong; ctx.lineWidth = mix.cup.on ? 3 : 1.5;
  beakerPath(ctx, ix, iy, iw, ih); ctx.fill();
  ctx.save(); beakerPath(ctx, ix, iy, iw, ih); ctx.clip();
  const rgb = tempRGB(Tliq);
  const lg = ctx.createLinearGradient(0, iy + ih - level, 0, iy + ih);
  lg.addColorStop(0, rgba(rgb, 0.28)); lg.addColorStop(1, rgba(rgb, 0.5));
  ctx.fillStyle = lg; ctx.fillRect(ix, iy + ih - level, iw, level);
  ctx.strokeStyle = rgba(rgb, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ix, iy + ih - level); ctx.lineTo(ix + iw, iy + ih - level); ctx.stroke();
  ctx.restore();
  beakerPath(ctx, ix, iy, iw, ih); ctx.stroke();
  ctx.restore();
  const surf = iy + ih - level;

  // Ichidagi jismlar (tashlangandan keyin)
  const tags = [];
  bodies.forEach((b, k) => {
    if (b.cup || k === 0) return;
    const T = Tof(b), p = phaseOf(b.s, b.h);
    const slot = (k - 1) % 2;
    if (!inside) return;
    if (b.kind.metal) {
      const bw = clamp(Math.cbrt(b.m / b.s.rho) * 1500, 20, iw * 0.4), bh = bw * 0.62;
      const bx = ix + iw * (slot ? 0.52 : 0.2), by = iy + ih - bh - 4;
      metalBlock(ctx, c, bx, by, bw, bh, b.cfg?.kind === "unknown" && !mix.reveal ? "#8b95a5" : b.s.color, T);
      tags.push({ b, x: bx + bw / 2, y: by - 12 });
    } else if (b.sub === "water" && b.kind.branch !== "liquid") {
      const solid = 1 - p.liquid - p.vapor;
      if (b.kind.branch === "solid" || solid > 0.002) {
        const n = clamp(Math.round(b.m / 0.025), 1, 5);
        const s0 = clamp(Math.cbrt(b.m / n / 917) * 700, 12, 34) * Math.cbrt(Math.max(solid, 0));
        for (let q = 0; q < n; q++) if (s0 > 2) iceCube(ctx, ix + iw * (0.18 + 0.16 * q) + (slot ? 8 : 0), surf - s0 * 0.25 + Math.sin(clock * 1.3 + q) * 1.5, s0);
        tags.push({ b, x: ix + iw * 0.5, y: surf - Math.max(s0, 8) - 10 });
      }
      if (p.vapor > 0.001 && b.kind.branch === "gas") bubbles(ctx, ix + 4, surf + 4, iw - 8, ih - level - 8, Math.round(20 * p.vapor) + 2, k, clock, "rgba(255,255,255,0.85)");
      if (b.kind.branch === "gas") { // bug' trubkasi
        ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ix + iw * 0.82, y0 - 26); ctx.lineTo(ix + iw * 0.82, iy + ih - 14); ctx.stroke(); ctx.restore();
        if (p.vapor > 0.001) bubbles(ctx, ix + iw * 0.74, surf, iw * 0.16, iy + ih - surf - 12, 8, 3, clock * 1.6, "rgba(255,255,255,0.9)");
        tags.push({ b, x: ix + iw * 0.82, y: y0 - 36 });
      }
    } else tags.push({ b, x: ix + iw * (slot ? 0.72 : 0.3), y: surf + 18 });
  });

  // Termometr va aralashtirgich
  const thx = ix + iw * 0.9;
  thermometer(ctx, c, thx, y0 - 40, iy + ih - 18, Tliq);
  ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 2; const sx = ix + iw * 0.12 + Math.sin(clock * 2) * (mix.started && !mix.done ? 6 : 0);
  ctx.beginPath(); ctx.moveTo(sx, y0 - 30); ctx.lineTo(sx, iy + ih - 12); ctx.moveTo(sx - 10, iy + ih - 12); ctx.lineTo(sx + 10, iy + ih - 12); ctx.stroke(); ctx.restore();
  tag(ctx, `t = ${tempTxt(Tliq)}`, thx + 10, y0 - 44, { color: c.text, bg: c.bg2, align: narrow ? "right" : "left", font: "700 12px Inter, system-ui, sans-serif" });

  // Stol: hali tashlanmagan jismlar (o'ngda)
  const others = bodies.map((b, k) => ({ b, k })).filter(({ b, k }) => !b.cup && k > 0);
  const rx0 = narrow ? w * 0.58 : w * 0.56, rw = w - rx0 - 14;
  others.forEach(({ b, k }, j) => {
    if (inside) return;
    const T = Tof(b);
    const slotW = rw / Math.max(1, others.length);
    const home = { x: rx0 + slotW * (j + 0.5), y: tableY };
    const target = { x: ix + iw * (j ? 0.7 : 0.35), y: surf };
    const u = mix.started ? mix.drop : 0;
    const ease = u * u * (3 - 2 * u);
    const px = home.x + (target.x - home.x) * ease, py = home.y + (target.y - home.y) * ease - Math.sin(Math.PI * ease) * 40;
    ctx.save(); ctx.globalAlpha = 1 - 0.6 * ease;
    const sz = clamp(slotW * 0.7, 50, 120);
    let objH = 40;
    if (b.kind.metal) {
      const bw = clamp(Math.cbrt(b.m / b.s.rho) * 1500, 20, sz), bh = bw * 0.62;
      const hang = u === 0 ? (T >= 80 ? 8 : 30) : 0;
      if (u === 0 && T >= 80) { // qaynoq suvda qizdirilgan
        const pw = bw + 26, ph = bh + 16;
        ctx.fillStyle = c.bg; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
        beakerPath(ctx, px - pw / 2, py - ph - 2, pw, ph); ctx.fill();
        ctx.fillStyle = rgba(tempRGB(T), 0.35); ctx.fillRect(px - pw / 2 + 1, py - ph * 0.8, pw - 2, ph * 0.8 - 3);
        beakerPath(ctx, px - pw / 2, py - ph - 2, pw, ph); ctx.stroke();
        wisps(ctx, px - pw / 2, py - ph - 4, pw, 2, clock, 0.4);
      }
      metalBlock(ctx, c, px - bw / 2, py - bh - 2 - hang, bw, bh, b.cfg?.kind === "unknown" && !mix.reveal ? "#8b95a5" : b.s.color, T);
      if (u === 0 && T >= 80) { ctx.fillStyle = rgba(tempRGB(T), 0.3); ctx.fillRect(px - bw / 2 - 12, py - (bh + 16) * 0.8, bw + 24, (bh + 16) * 0.8 - 3); }
      ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py - bh - 2 - hang); ctx.lineTo(px, py - bh - 40 - hang); ctx.stroke();
      if (u === 0) { ctx.strokeStyle = c.text3; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + sz * 0.45, py); ctx.lineTo(px + sz * 0.45, py - bh - 44 - hang); ctx.lineTo(px - 2, py - bh - 44 - hang); ctx.stroke(); }
      objH = bh + 46 + hang;
    } else if (b.kind.branch === "solid") {
      ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.beginPath(); ctx.ellipse(px, py - 4, sz * 0.5, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      const n = clamp(Math.round(b.m / 0.025), 1, 5);
      for (let q = 0; q < n; q++) iceCube(ctx, px - (n - 1) * 9 + q * 18, py - 16 - (q % 2) * 8, 18);
      objH = 36;
    } else if (b.kind.branch === "gas") {
      // kolba olov ustida, trubka orqali bug' chiqadi
      const fy = py - 30;
      ctx.fillStyle = c.bg; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, fy - 22, 22, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(tempRGB(100), 0.45); ctx.beginPath(); ctx.arc(px, fy - 22, 20, 0.25, Math.PI - 0.25); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, fy - 44); ctx.lineTo(px, fy - 64); ctx.lineTo(px - 34, fy - 64); ctx.stroke();
      wisps(ctx, px - 44, fy - 66, 20, 2, clock, 0.6);
      ctx.strokeStyle = c.text3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 18, fy); ctx.lineTo(px + 18, fy); ctx.moveTo(px - 14, fy); ctx.lineTo(px - 18, py); ctx.moveTo(px + 14, fy); ctx.lineTo(px + 18, py); ctx.stroke();
      flame(ctx, px, py - 2, 0.25, c);
      objH = 100;
      // olov
      flame(ctx, px, py, 0.45, c);
    } else {
      const bw = clamp(sz * 0.6, 34, 70), bh = bw * 1.1;
      ctx.fillStyle = c.bg; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
      beakerPath(ctx, px - bw / 2, py - bh - 2, bw, bh); ctx.fill(); ctx.stroke();
      const lv = bh * clamp(b.m / 0.4, 0.2, 0.85);
      ctx.fillStyle = rgba(tempRGB(T), 0.5); ctx.fillRect(px - bw / 2 + 2, py - 4 - lv, bw - 4, lv);
      if (T > 60) wisps(ctx, px - bw / 2, py - bh - 6, bw, 2, clock, 0.35);
      objH = bh + 6;
    }
    ctx.restore();
    if (!mix.started) tags.push({ b, x: home.x, y: tableY - objH - 18, home: true });
  });
  if (mix.cup.on) tags.push({ b: bodies.find((x) => x.cup), x: ix + iw / 2, y: iy + ih + 2, cup: true });

  // Yorliqlar
  tags.forEach((g) => {
    if (!g.b) return;
    const T = Tof(g.b);
    const pp = phaseOf(g.b.s, g.b.h);
    const name = g.b.cup ? "Idish" : g.b.kind.branch === "solid" && g.b.sub === "water" && pp.liquid > 0.999 ? "Muzdan hosil bo‘lgan suv" : g.b.kind.branch === "gas" && pp.vapor < 0.001 ? "Bug‘dan hosil bo‘lgan suv" : g.b.label;
    const txt = g.home ? `${name} · ${fmt(g.b.m, 2)} kg · ${tempTxt(T)}` : `${name}: ${tempTxt(T)}`;
    if (g.cup) { tag(ctx, txt, g.x, g.y, { color: c.text2, bg: c.bg2, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" }); return; }
    ctx.save(); ctx.font = SMALL;
    const tw = ctx.measureText(txt).width + 12;
    ctx.restore();
    const x = clamp(g.x, tw / 2 + 4, w - tw / 2 - 4);
    tag(ctx, txt, x, g.y, { color: c.text, bg: c.bg, align: "center", font: SMALL });
    ctx.fillStyle = g.b.color; ctx.beginPath(); ctx.arc(x - tw / 2 - 1, g.y, 3.5, 0, TAU); ctx.fill();
  });
  // Sarlavha
  tag(ctx, `Kalorimetr: ${bodies[0].label.toLowerCase()} ${fmt(bodies[0].m, 2)} kg`, x0 + CW / 2, y0 - (narrow ? 60 : 64), { color: c.text2, bg: c.bg, align: "center", font: "600 11px Inter, system-ui, sans-serif" });
}

function flame(ctx, x, y, size, c) {
  if (size <= 0) return;
  const fh = 18 + 34 * size, fw = 8 + 10 * size;
  const fl = Math.sin(clock * 18) * 0.06 + Math.sin(clock * 11.3) * 0.05;
  ctx.save();
  const g = ctx.createRadialGradient(x, y - fh * 0.35, 1, x, y - fh * 0.4, fh * 0.7);
  g.addColorStop(0, "rgba(254,240,138,0.95)"); g.addColorStop(0.5, "rgba(251,146,60,0.85)"); g.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - fw / 2, y); ctx.quadraticCurveTo(x - fw * 0.7, y - fh * 0.5, x + fl * fh, y - fh * (1 + fl)); ctx.quadraticCurveTo(x + fw * 0.7, y - fh * 0.5, x + fw / 2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(96,165,250,0.7)"; ctx.beginPath(); ctx.ellipse(x, y - 3, fw * 0.3, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
  void c;
}

/* ------------------------------------------------------------------ Chizish: isitish */

const N_P = 40;
const parts = Array.from({ length: N_P }, (_, i) => ({ x: 0, y: 0, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), seed: Math.random() * 100, i }));
let partsInit = false;

function drawMolecules(ctx, c, bx, by, bw, bh, s, hval, dt) {
  const T = TOf(s, hval), p = phaseOf(s, hval);
  const nGas = Math.round(N_P * p.vapor), nLiq = Math.round(N_P * (p.liquid)), nSol = Math.max(0, N_P - nGas - nLiq);
  const cols = 8, rows = 5, r = Math.min(bw / (cols * 3.6), bh / (rows * 4.4));
  const site = (i) => ({ x: bx + bw / 2 + ((i % cols) - (cols - 1) / 2) * r * 2.3, y: by + bh - r * 1.6 - Math.floor(i / cols) * r * 2.3 });
  if (!partsInit) { parts.forEach((q, i) => { const st = site(i); q.x = st.x; q.y = st.y; }); partsInit = true; }
  const amp = 0.35 * r * Math.sqrt(Math.max(T + 273, 1) / 273);
  const vT = 22 * Math.sqrt(Math.max(T + 273, 1) / 273);
  ctx.save();
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(bx + 1, by + 1, bw - 2, bh - 2); ctx.clip();
  const rgb = hexRGB(s.color === "#e5e7eb" ? "#94a3b8" : s.color);
  parts.forEach((q, i) => {
    const mode = i < nSol ? "s" : i < nSol + nLiq ? "l" : "g";
    if (mode === "s") {
      const st = site(i);
      const tx = st.x + Math.sin(clock * 9 + q.seed) * amp, ty = st.y + Math.cos(clock * 8 + q.seed * 1.7) * amp;
      q.x += (tx - q.x) * Math.min(1, dt * 6); q.y += (ty - q.y) * Math.min(1, dt * 6);
    } else {
      const speed = mode === "g" ? vT * 3.2 : vT * 0.9;
      q.vx += (Math.random() - 0.5) * (mode === "l" ? 4 : 1) * dt; q.vy += (Math.random() - 0.5) * (mode === "l" ? 4 : 1) * dt + (mode === "l" ? 0.6 * dt : 0);
      const n = Math.hypot(q.vx, q.vy) || 1; q.vx /= n; q.vy /= n;
      q.x += q.vx * speed * dt; q.y += q.vy * speed * dt;
      const top = mode === "l" ? by + bh * (1 - Math.min(0.6, ((nLiq + nSol) / N_P) * 0.45 + 0.12)) : by + r * 2.2;
      if (q.x < bx + r) { q.x = bx + r; q.vx = Math.abs(q.vx); }
      if (q.x > bx + bw - r) { q.x = bx + bw - r; q.vx = -Math.abs(q.vx); }
      if (q.y < top) { q.y = top; q.vy = Math.abs(q.vy); }
      if (q.y > by + bh - r) { q.y = by + bh - r; q.vy = -Math.abs(q.vy); }
    }
    ctx.fillStyle = rgba(rgb, mode === "g" ? 0.55 : 0.9);
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
  });
  ctx.restore();
  tag(ctx, `Molekulalar · ${PHASE_NAMES[p.phase]}`, bx + 8, by + 13, { color: c.text2, bg: c.bg, font: "600 10.5px Inter, system-ui, sans-serif" });
}

let lastDraw = 0;
function drawHeat(ctx, stage) {
  const { w, h, colors: c } = stage;
  const now = performance.now(); const dt = lastDraw ? Math.min(0.05, (now - lastDraw) / 1000) : 0; lastDraw = now;
  const narrow = w < 560;
  const tableY = h - 22;
  ctx.strokeStyle = c.border; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, tableY); ctx.lineTo(w - 10, tableY); ctx.stroke();
  const b = heat.body, s = b.s, T = TOf(s, b.h), p = phaseOf(s, b.h);
  const cx = narrow ? w * 0.3 : w * 0.3;
  const VW = narrow ? Math.min(120, w * 0.34) : Math.min(210, w * 0.27), VH = Math.min(VW * 1.0, h - 170);
  const burnerH = 56;
  const vy = tableY - burnerH - VH - 8, vx = cx - VW / 2;
  // shtativ
  ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(vx - 26, tableY); ctx.lineTo(vx - 26, vy - 50); ctx.moveTo(vx - 30, vy + VH + 6); ctx.lineTo(vx + VW + 12, vy + VH + 6); ctx.stroke();
  ctx.restore();
  // isitgich
  const P = heaterPower();
  if (heat.cfg.src === "electric") {
    const pw = VW * 0.95, ph = 20, px = cx - pw / 2, py = tableY - ph - 26;
    ctx.save(); ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 5); ctx.fill(); ctx.stroke();
    ctx.fillRect(cx - 14, py + ph, 28, 26); ctx.strokeRect(cx - 14, py + ph, 28, 26);
    const glow = heat.on && heat.started ? clamp(heat.cfg.P / 2000, 0.25, 1) : 0;
    ctx.strokeStyle = glow ? `rgba(239,68,68,${0.4 + 0.6 * glow})` : c.text3; ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let k = 0; k <= 40; k++) { const xx = px + 8 + (k / 40) * (pw - 16); const yy = py + ph / 2 + Math.sin(k * 1.2) * 4; if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); } ctx.stroke();
    ctx.restore();
    tag(ctx, `${fmt(heat.cfg.P, 0)} W`, cx, tableY - 12, { color: c.text2, bg: c.bg, align: "center", font: "600 10.5px Inter, system-ui, sans-serif" });
  } else {
    // spirt lampasi / gorelka
    const lw = 46, lh = 30;
    ctx.save(); ctx.fillStyle = "rgba(147,197,253,0.35)"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, tableY - lh / 2, lw / 2, lh / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text3; ctx.fillRect(cx - 3, tableY - lh - 8, 6, 9);
    ctx.restore();
    if (heat.on && heat.started) flame(ctx, cx, tableY - lh - 8, clamp(heat.cfg.rate / 12, 0.2, 1.2), c);
    tag(ctx, `${FUELS[heat.cfg.fuel].name} · ${fmt(heat.cfg.rate, 1)} g/min`, cx + lw / 2 + 6, tableY - 10, { color: c.text2, bg: c.bg, font: "600 10.5px Inter, system-ui, sans-serif" });
  }
  // idish
  ctx.save(); ctx.fillStyle = c.bg; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2;
  beakerPath(ctx, vx, vy, VW, VH); ctx.fill();
  ctx.save(); beakerPath(ctx, vx, vy, VW, VH); ctx.clip();
  const solid = 1 - p.liquid - p.vapor;
  const fillMax = 0.62 * VH;
  const liqLevel = fillMax * p.liquid * (s.amorphous ? 0.6 : 1);
  const rgb = tempRGB(T);
  const subRGB = hexRGB(s.color === "#e5e7eb" ? "#cbd5e1" : s.color);
  const liqColor = s === SUB.water ? rgba(rgb, 0.45) : rgba(subRGB.map((v, k) => Math.round(v * 0.7 + rgb[k] * 0.3)), 0.65);
  if (liqLevel > 0.5) { ctx.fillStyle = liqColor; ctx.fillRect(vx, vy + VH - liqLevel, VW, liqLevel); }
  if (solid > 0.002 || s.amorphous && p.phase !== "liquid") {
    const fs = s.amorphous ? (p.phase === "soft" ? 1 - p.liquid * 0.85 : p.phase === "solid" ? 1 : 0.15) : solid;
    if (s === SUB.water) {
      const n = 4; const sz = (VW / 4.6) * Math.cbrt(fs);
      for (let q = 0; q < n; q++) iceCube(ctx, vx + VW * (0.2 + 0.2 * q), vy + VH - Math.max(liqLevel, 0) - sz * 0.35 + (liqLevel > sz ? sz * 0.6 : 0) + (q % 2) * -sz * 0.5, sz);
    } else {
      const bw = VW * 0.62 * Math.cbrt(fs), bh = VH * 0.42 * Math.cbrt(fs) * (s.amorphous ? 1 - 0.5 * (1 - fs) : 1);
      ctx.fillStyle = rgba(subRGB, 1); ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(cx - bw / 2, vy + VH - bh - 2, bw, bh, s.amorphous ? Math.min(bw, bh) * 0.35 * (1 - fs + 0.2) : 3); ctx.fill(); ctx.stroke();
      const glow = clamp((T - 150) / 500, 0, 1); if (glow > 0) { ctx.fillStyle = `rgba(249,115,22,${0.5 * glow})`; ctx.fill(); }
    }
  }
  if (p.phase === "boiling") bubbles(ctx, vx + 4, vy + VH - liqLevel, VW - 8, liqLevel - 4, 22, 1, clock * 1.4, "rgba(255,255,255,0.9)");
  else if (p.phase === "liquid" && s.tb < 1e4 && T > s.tb - 15) bubbles(ctx, vx + 4, vy + VH - liqLevel * 0.5, VW - 8, liqLevel * 0.45, 5, 2, clock, "rgba(255,255,255,0.6)");
  ctx.restore();
  beakerPath(ctx, vx, vy, VW, VH); ctx.stroke();
  ctx.restore();
  if (p.phase === "boiling" || p.phase === "gas" || (p.phase === "liquid" && s.tb < 1e4 && T > s.tb - 25)) wisps(ctx, vx, vy - 2, VW, 4, clock, p.phase === "boiling" ? 0.8 : 0.35);
  // termometr
  const thx = vx + VW * 0.82;
  const tR = Math.max(heatTmax(), 110);
  thermometer(ctx, c, thx, vy - 54, vy + VH - 14, T, { tMin: Math.min(-40, heat.cfg.t0), tMax: tR });
  tag(ctx, `t = ${tempTxt(T)}`, thx + 10, vy - 58, { color: c.text, bg: c.bg2, font: "700 12px Inter, system-ui, sans-serif" });
  tag(ctx, `${s.short}, ${fmt(heat.cfg.m, 2)} kg · ${PHASE_NAMES[p.phase]}${p.phase === "melting" ? ` ${Math.round(p.liquid * 100)}%` : p.phase === "boiling" ? ` ${Math.round(p.vapor * 100)}%` : ""}`, cx, vy - 74, { color: c.text2, bg: c.bg, align: "center", font: "600 11px Inter, system-ui, sans-serif" });

  // molekulalar
  const mw = narrow ? w * 0.4 : Math.min(260, w * 0.34), mh = Math.min(h - 70, mw * 0.8);
  const mx = w - mw - 14, my = narrow ? 36 : (h - mh) / 2 - 6;
  drawMolecules(ctx, c, mx, my, mw, mh, s, b.h, dt);
  if (heat.done) tag(ctx, heat.doneMsg, w / 2, 14, { color: "#fff", bg: c.warning, align: "center", font: "700 11.5px Inter, system-ui, sans-serif" });
  void P;
}

function draw(ctx, stage) {
  const { w, h, colors: c } = stage;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  if (ui.mode === "mix") { if (mix.bodies.length) drawMix(ctx, stage); }
  else if (heat.body) drawHeat(ctx, stage);
}

const heights = (w) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(w * 0.5, vh * 0.5), 280, 420)), graph: Math.round(clamp(vh * 0.27, 170, 250)) };
};
const stage = createStage($("#stage"), draw, { height: (w) => heights(w).stage });

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  mix: [
    ["temp", "Temperatura", "Jismlar temperaturasi t(τ)", "Issiq jism soviydi, sovuq jism isiydi — temperaturalar bir xil qiymatga (θ) intiladi. Punktir — nazariy muvozanat temperaturasi. Muz erigan vaqtda temperatura 0 °C da to‘xtab turadi."],
    ["balance", "Issiqlik balansi", "Berilgan va olingan issiqlik", "Har bir jism bergan (−) yoki olgan (+) issiqlik miqdori. Yo‘qotishsiz kalorimetrda Q_berilgan = Q_olingan."],
  ],
  heat: [
    ["curve", "Isitish egri chizig‘i", "Isitish egri chizig‘i t(τ)", "Gorizontal qismlar — erish va qaynash: issiqlik berilsa ham temperatura o‘zgarmaydi (energiya agregat holatni o‘zgartirishga ketadi). Amorf jismda bunday maydoncha yo‘q."],
    ["stages", "Issiqlik sarfi", "Bosqichlar bo‘yicha issiqlik miqdori", "Q₁ = c_q m Δt (qattiqni isitish), Q₂ = λm (erish), Q₃ = c_s m Δt (suyuqni isitish), Q₄ = Lm (bug‘lanish). Isitgich bergan energiya bilan solishtiring."],
  ],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, label]) => `<button type="button" data-tab-value="${id}" aria-pressed="${id === ui.tab}">${label}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  ui.tab = tab;
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2];
  $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "mix") {
    if (!mix.bodies.length) return;
    const data = { bodies: mix.bodies, hist: mix.hist, eq: mix.eq, started: mix.started, lost: mix.lost, loss: mix.loss, TOf };
    if (ui.tab === "balance") drawMixBalance(ctx, st, data); else drawMixTemps(ctx, st, data);
  } else if (heat.body) {
    const s = heat.body.s;
    const data = { s, hist: heat.hist, m: heat.cfg.m, t0: heat.cfg.t0, Tmax: heatTmax(), stages: stageHeats(s, heat.body.m, heat.body.h0, heat.body.h), Qin: heat.Qin, lost: heat.lost, fuel: heat.cfg.src === "fuel" ? { m: heat.fuelM, q: FUELS[heat.cfg.fuel].q, name: FUELS[heat.cfg.fuel].name } : null };
    if (ui.tab === "stages") drawHeatStages(ctx, st, data); else drawHeatCurve(ctx, st, data);
  }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => heights(w).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label;
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
  el.dataset.tone = tone || "";
}
const degHtml = (T) => `${fmt(T, Math.abs(T) < 100 ? 1 : 0)}<small>°C</small>`;

function mixHeats() {
  let given = 0, got = 0;
  const per = mix.bodies.map((b) => { const Q = b.m * (b.h - b.h0); if (Q < 0) given -= Q; else got += Q; return Q; });
  return { given, got, per };
}

function updateReadoutsMix() {
  const b0 = mix.bodies[0], eq = mix.eq;
  const T0 = TOf(b0.s, b0.h);
  setRO("r1", "Kalorimetrdagi temperatura <i>t</i>", degHtml(T0), mix.started ? (mix.done ? "Muvozanat qaror topdi" : "Termometr ko‘rsatishi") : "Tajriba boshlanmagan");
  const ice = mix.bodies.filter((b) => b.sub === "water");
  let eqSub = "Yo‘qotishsiz hisob: Σ Q = 0";
  if (eq && eq.plateau) {
    const solid = ice.reduce((a, b) => a + b.m * (1 - phaseOf(b.s, eq.h[mix.bodies.indexOf(b)]).liquid - phaseOf(b.s, eq.h[mix.bodies.indexOf(b)]).vapor), 0);
    if (Math.abs(eq.T) < 1e-9 && solid > 1e-6) eqSub = `Muz to‘liq erimaydi: ${fmt(solid * 1000, 0)} g muz qoladi`;
  }
  setRO("r2", "Muvozanat temperaturasi <i>θ</i>", eq ? degHtml(eq.T) : "—", eqSub);
  setRO("r3", "Vaqt <i>τ</i>", mix.started ? timeTxt(mix.t).replace(/ (s|min)/g, "<small>$1</small>").replace("<small>min</small>", "<small>min</small> ") : "0<small>s</small>", `Tezlik ×${ui.speed}`);
  const { given, got } = mixHeats();
  setRO("r4", "Berilgan issiqlik <i>Q</i><sub>ber</sub>", kJhtml(given), "Issiqroq jismlar sovishida");
  const diff = given > 1 ? (100 * (got - given)) / given : 0;
  setRO("r5", "Olingan issiqlik <i>Q</i><sub>ol</sub>", kJhtml(got), mix.loss && mix.started ? `Atrofga ketdi: ${kJ(mix.lost)} (${fmt(Math.abs(diff), 1)}%)` : "Sovuqroq jismlar isishida");
  // 6: muz / bug' / noma'lum c / yo'qotish
  const unk = mix.bodies.find((b) => b.cfg?.kind === "unknown");
  if (unk) {
    const others = mix.bodies.filter((b) => b !== unk).map((b) => ({ c: b.s.cl > 0 && b.kind.branch === "liquid" ? b.s.cl : b.s.cs, m: b.m, t: b.cfg ? b.cfg.t : mix.cfg[0].t }));
    const theta = T0;
    const cx = mix.done || (mix.started && mix.loss) ? measuredC(unk.m, unk.cfg.t, theta, others) : null;
    setRO("r6", "Tajribadan <i>c</i><sub>X</sub>", cx && Number.isFinite(cx) ? `${fmt(cx, 0)}<small>J/(kg·°C)</small>` : "—", cx ? (mix.reveal ? `Haqiqiy: ${SUB[mix.unknown].name}, c = ${SUB[mix.unknown].cs}` : "c = c_s m_s(θ − t_s) / (m_X(t_X − θ))") : "Muvozanatni kuting");
  } else if (ice.some((b) => b.kind.branch === "solid" || b.kind.branch === "gas")) {
    const solid = ice.reduce((a, b) => a + b.m * (1 - phaseOf(b.s, b.h).liquid - phaseOf(b.s, b.h).vapor), 0);
    const vapor = ice.reduce((a, b) => a + b.m * phaseOf(b.s, b.h).vapor, 0);
    const steam = ice.some((b) => b.kind.branch === "gas");
    if (steam) setRO("r6", "Kondensatsiyalanmagan bug‘", `${fmt(vapor * 1000, 1)}<small>g</small>`, "Q = Lm — kondensatsiyada ajraladi");
    else setRO("r6", "Kalorimetrdagi muz", `${fmt(solid * 1000, 1)}<small>g</small>`, "Erishga Q = λm sarflanadi");
  } else setRO("r6", "Issiqlik balansi", given > 1 ? `${fmt(got / given * 100, 1)}<small>%</small>` : "—", "Q_ol / Q_ber");
}

function heatStageName(p) {
  return { solid: "Qattiq jismni isitish: Q = c m Δt", melting: "Erish: Q = λ m", liquid: "Suyuqlikni isitish: Q = c m Δt", boiling: "Qaynash: Q = L m", gas: "Bug‘ni isitish", soft: "Amorf jism yumshaydi" }[p.phase];
}

function updateReadoutsHeat() {
  const b = heat.body, s = b.s, T = TOf(s, b.h), p = phaseOf(s, b.h);
  setRO("r1", "Temperatura <i>t</i>", degHtml(T), heat.on ? (heat.started ? "Isitilmoqda" : "Boshlang‘ich holat") : "Isitgich o‘chirilgan — soviydi");
  const pct = p.phase === "melting" ? ` ${Math.round(p.liquid * 100)}%` : p.phase === "boiling" ? ` ${Math.round(p.vapor * 100)}%` : "";
  setRO("r2", "Agregat holat", `${PHASE_NAMES[p.phase]}${pct ? `<small>${pct}</small>` : ""}`, heatStageName(p));
  setRO("r3", "Vaqt <i>τ</i>", timeTxt(heat.t).replace(/ (s|min)/g, "<small>$1</small>"), `Tezlik ×${ui.speed}`);
  const Qnet = b.m * (b.h - b.h0);
  setRO("r4", "Moddaga berilgan <i>Q</i>", kJhtml(Qnet), heat.lost > 1 ? `Atrofga ketdi: ${kJ(heat.lost)}` : "Q = m (h − h₀) — barcha bosqichlar yig‘indisi");
  if (heat.cfg.src === "electric") setRO("r5", "Isitgich quvvati <i>P</i>", `${fmt(heat.cfg.P, 0)}<small>W</small>`, `Bergan energiya Q = Pτ = ${kJ(heat.Qin)}`);
  else {
    const Qf = heat.fuelM * FUELS[heat.cfg.fuel].q;
    setRO("r5", "Yoqilg‘i sarfi <i>m</i><sub>yo</sub>", `${fmt(heat.fuelM * 1000, 1)}<small>g</small>`, `Q = qm = ${kJ(Qf)} (${FUELS[heat.cfg.fuel].name})`);
  }
  if (heat.cfg.src === "fuel") {
    const Qf = heat.fuelM * FUELS[heat.cfg.fuel].q;
    setRO("r6", "Qizdirgich FIK <i>η</i>", Qf > 0 ? `${fmt((Qnet / Qf) * 100, 0)}<small>%</small>` : `${fmt(heat.cfg.eta, 0)}<small>%</small>`, "η = Q_foydali / Q_yonish");
  } else {
    const q = stageHeats(s, b.m, b.h0, b.h);
    const cur = { solid: q.heatSolid, melting: q.melt, liquid: q.heatLiquid, boiling: q.boil, gas: q.heatGas, soft: q.melt }[p.phase];
    setRO("r6", "Joriy bosqichda <i>Q</i>", kJhtml(cur), p.phase === "melting" ? `λ = ${sci(s.lambda, 2)} J/kg` : p.phase === "boiling" ? `L = ${sci(s.L, 2)} J/kg` : `c = ${fmt(p.phase === "solid" ? s.cs : s.cl, 0)} J/(kg·°C)`);
  }
}

function updateStatus() {
  const el = $("[data-status]");
  let text, tone;
  if (ui.mode === "mix") {
    if (!mix.started) { text = "Tayyor"; tone = "blue"; }
    else if (mix.drop < 1) { text = "Jismlar tushirilmoqda"; tone = "orange"; }
    else if (mix.done) { text = "Issiqlik muvozanati"; tone = "green"; }
    else { text = "Issiqlik almashinuvi"; tone = "orange"; }
  } else {
    const p = phaseOf(heat.body.s, heat.body.h);
    if (!heat.started) { text = "Tayyor"; tone = "blue"; }
    else if (heat.done) { text = "Tajriba tugadi"; tone = "green"; }
    else if (p.phase === "melting") { text = heat.on ? "Erish" : "Qotish (kristallanish)"; tone = "purple"; }
    else if (p.phase === "boiling") { text = heat.on ? "Qaynash" : "Kondensatsiya"; tone = "purple"; }
    else { text = heat.on ? "Isitilmoqda" : "Sovimoqda"; tone = "orange"; }
  }
  el.textContent = text; el.dataset.tone = tone;
}

let lastExplain = "";
function updateExplain() {
  const parts = [];
  if (ui.mode === "mix") {
    const bs = mix.bodies, eq = mix.eq;
    const names = bs.filter((b) => !b.cup).map((b) => `${b.label.toLowerCase()} (${fmt(b.m, 2)} kg, ${tempTxt(TOf(b.s, b.h0))})`).join(", ");
    parts.push(`<p>Kalorimetrda: ${names}${mix.cup.on ? `, alyuminiy idish ${fmt(mix.cup.m, 2)} kg` : ""}. Issiqroq jismlar issiqlik beradi, sovuqroqlari oladi, toki temperaturalar tenglashguncha.</p>`);
    if (eq) parts.push(`<p>Issiqlik balansi tenglamasidan muvozanat temperaturasi <b>θ = ${tempTxt(eq.T)}</b>.${eq.plateau && Math.abs(eq.T) < 1e-9 ? " Issiqlik muzni to‘liq eritishga yetmaydi — aralashma 0 °C da qoladi (muz + suv)." : ""}${eq.plateau && Math.abs(eq.T - 100) < 1e-9 ? " Bug‘ning hammasi kondensatsiyalanmaydi — aralashma 100 °C da qoladi." : ""}</p>`);
    if (bs.some((b) => b.kind.branch === "solid" && b.sub === "water")) parts.push("<p>Muz avval 0 °C gacha isiydi (Q = c<sub>muz</sub>mΔt), so‘ng eriydi (Q = λm) — erish davomida uning temperaturasi 0 °C da qoladi; hosil bo‘lgan suv keyin isiydi.</p>");
    if (bs.some((b) => b.kind.branch === "gas")) parts.push("<p>Bug‘ suvga kirib kondensatsiyalanadi va katta issiqlik beradi: Q = Lm (L = 2,3·10⁶ J/kg) — shuning uchun bug‘ bilan kuyish qaynoq suvdan xavfliroq.</p>");
    if (bs.some((b) => b.cfg?.kind === "unknown")) parts.push("<p><b>Laboratoriya ishi:</b> noma’lum metall 100 °C gacha qizdirilgan (qaynoq suvda). Muvozanat temperaturasini o‘lchab, issiqlik balansidan uning solishtirma issiqlik sig‘imini toping va jadval bilan solishtiring.</p>");
    if (mix.loss) parts.push("<p>Real kalorimetrda issiqlikning bir qismi atrofga ketadi, shuning uchun olingan issiqlik berilganidan biroz kam chiqadi. Vaqt o‘tishi bilan aralashma xona temperaturasigacha soviydi.</p>");
  } else {
    const b = heat.body, s = b.s, p = phaseOf(s, b.h);
    if (s.amorphous) parts.push("<p><b>Amorf jism</b> (mum, shisha, plastilin) aniq erish temperaturasiga ega emas: qizdirilganda asta-sekin yumshaydi, grafikda gorizontal maydoncha bo‘lmaydi.</p>");
    else parts.push(`<p>${s.short}: erish temperaturasi <b>${fmt(s.tm, 0)} °C</b> (λ = ${sci(s.lambda, 2)} J/kg)${Number.isFinite(s.tb) ? `, qaynash temperaturasi <b>${fmt(s.tb, 0)} °C</b> (L = ${sci(s.L, 2)} J/kg)` : ""}. Erish va qaynash davomida temperatura o‘zgarmaydi.</p>`);
    if (p.phase === "melting") parts.push(`<p>Hozir modda ${heat.on ? "eriyapti" : "qotyapti"}: ${Math.round(p.liquid * 100)}% suyuq. ${heat.on ? "Berilayotgan issiqlik kristall panjarani buzishga sarflanadi." : "Qotishda xuddi shuncha issiqlik ajralib chiqadi."}</p>`);
    if (p.phase === "boiling") parts.push(`<p>Qaynash: suyuqlik butun hajmi bo‘yicha bug‘lanadi (pufakchalar). ${Math.round(p.vapor * 100)}% bug‘ga aylandi.</p>`);
    if (heat.cfg.src === "fuel") parts.push(`<p>${FUELS[heat.cfg.fuel].name} yonganda Q = qm issiqlik ajraladi (q = ${sci(FUELS[heat.cfg.fuel].q, 2)} J/kg), lekin uning faqat η = ${fmt(heat.cfg.eta, 0)}% qismi moddaga o‘tadi.</p>`);
    if (!heat.on) parts.push("<p>Isitgich o‘chirilgan: modda atrofga issiqlik berib soviydi. Qotish ham erish temperaturasining o‘zida ro‘y beradi.</p>");
  }
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}

function updateFormula() {
  const f = $("[data-formula]");
  let html = "<small>Issiqlik miqdori</small> Q = c·m·Δt";
  if (ui.mode === "mix") html = "<small>Issiqlik balansi</small> Q₁ + Q₂ + … = 0";
  else {
    const p = phaseOf(heat.body.s, heat.body.h);
    if (p.phase === "melting") html = "<small>Erish</small> Q = λ·m";
    else if (p.phase === "boiling") html = "<small>Bug‘lanish</small> Q = L·m";
    else if (heat.cfg.src === "fuel") html = "<small>Yonish</small> Q = q·m";
  }
  if (f.innerHTML !== html) f.innerHTML = html;
}

function refresh() {
  if (ui.mode === "mix") updateReadoutsMix(); else updateReadoutsHeat();
  updateStatus(); updateExplain(); updateFormula(); syncPlay();
}

/* ------------------------------------------------------------------ Boshqaruv: kalorimetr */

const bodiesBox = $("[data-bodies]");
bodiesBox.innerHTML = mix.cfg.map((_, i) => `
  <div class="sim-subgroup" data-body="${i}">
    <div class="sim-subgroup__head"><span class="sim-dot" style="background:${BODY_COLORS[i]}"></span><b>${i === 0 ? "1-jism: kalorimetrdagi suyuqlik" : `${i + 1}-jism`}</b>${i === 2 ? `<label class="sim-switch sim-switch--inline"><input type="checkbox" data-body-on="${i}"><span class="sim-switch__ui"></span>qo‘shish</label>` : ""}</div>
    <div class="sim-control"><select class="sim-select" id="bk${i}" aria-label="${i + 1}-jism moddasi"></select></div>
    <div class="sim-control"><div class="sim-control__row"><label for="bm${i}">Massa m</label><output for="bm${i}" id="bm${i}Out"></output></div><input class="sim-range" type="range" id="bm${i}" min="0.01" max="1" step="0.01" value="0.2"></div>
    <div class="sim-control"><div class="sim-control__row"><label for="bt${i}">Temperatura t</label><output for="bt${i}" id="bt${i}Out"></output></div><input class="sim-range" type="range" id="bt${i}" min="-40" max="100" step="1" value="20"></div>
  </div>`).join("");
const bodyCtl = mix.cfg.map((cfg, i) => {
  const sel = $(`#bk${i}`);
  (i === 0 ? LIQUID_KINDS : BODY_KINDS).forEach((k) => sel.insertAdjacentHTML("beforeend", `<option value="${k}">${KINDS[k].name}</option>`));
  sel.addEventListener("change", () => { mix.cfg[i].kind = sel.value; const k = KINDS[sel.value]; mix.cfg[i].t = clamp(mix.cfg[i].t, k.tMin, k.tMax); if (sel.value === "unknown") mix.reveal = false; customized(); syncMixCtl(); rebuild(); });
  const m = bindRange($(`#bm${i}`), $(`#bm${i}Out`), (v) => `${fmt(v, 2)} kg`, (v) => { mix.cfg[i].m = v; customized(); rebuild(); });
  const t = bindRange($(`#bt${i}`), $(`#bt${i}Out`), (v) => `${fmt(v, 0)} °C`, (v) => { mix.cfg[i].t = v; customized(); rebuild(); });
  return { sel, m, t };
});
$("[data-body-on='2']").addEventListener("change", (e) => { mix.cfg[2].on = e.target.checked; customized(); syncMixCtl(); rebuild(); });
const cupCtl = bindRange($("#cupM"), $("#cupMOut"), (v) => `${fmt(v, 2)} kg`, (v) => { mix.cup.m = v; customized(); rebuild(); });
$("[data-cup]").addEventListener("change", (e) => { mix.cup.on = e.target.checked; customized(); syncMixCtl(); rebuild(); });
$("[data-loss-mix]").addEventListener("change", (e) => { mix.loss = e.target.checked; customized(); rebuild(); });
$("[data-reveal]").addEventListener("click", () => { mix.reveal = !mix.reveal; mix.bodies.forEach((b) => { if (b.cfg?.kind === "unknown") b.label = nameOfCfg(b.cfg); }); syncMixCtl(); refresh(); stage.render(); graph.render(); });

function syncMixCtl() {
  mix.cfg.forEach((c, i) => {
    const k = KINDS[c.kind], ctl = bodyCtl[i];
    ctl.sel.value = c.kind;
    const ti = $(`#bt${i}`); ti.min = k.tMin; ti.max = k.tMax;
    const mi = $(`#bm${i}`); mi.max = k.branch === "gas" ? 0.1 : k.metal ? 1 : 1; mi.min = 0.01;
    ctl.m.set(c.m); ctl.t.set(c.t);
    const box = bodiesBox.querySelector(`[data-body="${i}"]`);
    box.querySelectorAll(".sim-control").forEach((el) => { el.hidden = !c.on; });
    if (i === 2) $("[data-body-on='2']").checked = c.on;
  });
  $("[data-cup]").checked = mix.cup.on; $("[data-cup-mass]").hidden = !mix.cup.on; cupCtl.set(mix.cup.m);
  $("[data-loss-mix]").checked = mix.loss;
  const hasUnk = mix.cfg.some((c) => c.on && c.kind === "unknown");
  const rv = $("[data-reveal]"); rv.hidden = !hasUnk; rv.textContent = mix.reveal ? "Javobni yashirish" : "Noma’lum metallni ko‘rsatish";
}

/* ------------------------------------------------------------------ Boshqaruv: isitish */

const hSub = $("#hSub");
HEAT_SUBS.forEach((k) => hSub.insertAdjacentHTML("beforeend", `<option value="${k}">${SUB[k].name}${SUB[k].amorphous ? "" : ` (t_er = ${fmt(SUB[k].tm, 0)} °C)`}</option>`));
const hFuel = $("#hFuel");
Object.entries(FUELS).forEach(([k, f]) => hFuel.insertAdjacentHTML("beforeend", `<option value="${k}">${f.name} — q = ${sci(f.q, 2)} J/kg</option>`));
const hMCtl = bindRange($("#hM"), $("#hMOut"), (v) => `${fmt(v, 2)} kg`, (v) => { heat.cfg.m = v; customized(); rebuild(); });
const hT0Ctl = bindRange($("#hT0"), $("#hT0Out"), (v) => `${fmt(v, 0)} °C`, (v) => { heat.cfg.t0 = v; customized(); rebuild(); });
const hPCtl = bindRange($("#hP"), $("#hPOut"), (v) => `${fmt(v, 0)} W`, (v) => { heat.cfg.P = v; customized(); refresh(); stage.render(); });
const hRateCtl = bindRange($("#hRate"), $("#hRateOut"), (v) => `${fmt(v, 1)} g/min`, (v) => { heat.cfg.rate = v; customized(); refresh(); stage.render(); });
const hEtaCtl = bindRange($("#hEta"), $("#hEtaOut"), (v) => `${fmt(v, 0)}%`, (v) => { heat.cfg.eta = v; customized(); refresh(); });
hSub.addEventListener("change", () => { heat.cfg.sub = hSub.value; heat.cfg.t0 = clamp(heat.cfg.t0, ...t0Range(hSub.value)); customized(); syncHeatCtl(); rebuild(); });
hFuel.addEventListener("change", () => { heat.cfg.fuel = hFuel.value; customized(); refresh(); stage.render(); });
document.querySelectorAll("[data-src-value]").forEach((b) => b.addEventListener("click", () => { heat.cfg.src = b.dataset.srcValue; customized(); syncHeatCtl(); refresh(); stage.render(); }));
$("[data-loss-heat]").addEventListener("change", (e) => { heat.cfg.loss = e.target.checked; customized(); refresh(); });
$("[data-heater]").addEventListener("click", () => {
  heat.on = !heat.on;
  if (heat.done && !heat.on) { heat.done = false; heat.doneMsg = ""; }
  if (heat.done && heat.on && phaseOf(heat.body.s, heat.body.h).phase !== "gas") { heat.done = false; heat.doneMsg = ""; }
  if (!heat.started) heat.started = true;
  if (!loop.running) loop.start();
  syncHeatCtl(); refresh();
});
function t0Range(sub) {
  const s = SUB[sub];
  return [-40, Math.min(Number.isFinite(s.tb) ? s.tb - 2 : 100, s.amorphous ? 30 : Math.max(s.tm - 5, 30), 100)];
}
function syncHeatCtl() {
  const c = heat.cfg;
  hSub.value = c.sub; hFuel.value = c.fuel;
  const [a, b] = t0Range(c.sub); const ti = $("#hT0"); ti.min = a; ti.max = b;
  hMCtl.set(c.m); hT0Ctl.set(c.t0); hPCtl.set(c.P); hRateCtl.set(c.rate); hEtaCtl.set(c.eta);
  document.querySelectorAll("[data-src-value]").forEach((b2) => b2.setAttribute("aria-pressed", String(b2.dataset.srcValue === c.src)));
  $("[data-src-electric]").hidden = c.src !== "electric";
  document.querySelectorAll("[data-src-fuel]").forEach((el) => { el.hidden = c.src !== "fuel"; });
  $("[data-loss-heat]").checked = c.loss;
  $("[data-heater]").textContent = heat.on ? "Isitgichni o‘chirish (sovitish)" : "Isitgichni yoqish";
}

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  mixWater: { mode: "mix", title: "Issiq va sovuq suvni aralashtirish", lesson: "0,3 kg sovuq (20 °C) va 0,2 kg issiq (80 °C) suv aralashtiriladi. θ = (m₁t₁ + m₂t₂)/(m₁ + m₂) = 44 °C.",
    set: () => setMix([{ kind: "water", m: 0.3, t: 20 }, { kind: "water", m: 0.2, t: 80 }], { cup: false, loss: false }) },
  mixMetal: { mode: "mix", title: "Qizdirilgan metallni suvga tushirish", lesson: "100 °C gacha qizdirilgan alyuminiy jism sovuq suvga tushiriladi: metall soviydi, suv isiydi. Metallni mis yoki qo‘rg‘oshinga almashtirib solishtiring — c kichik bo‘lsa, suv kam isiydi.",
    set: () => setMix([{ kind: "water", m: 0.3, t: 20 }, { kind: "aluminium", m: 0.2, t: 100 }], { cup: false, loss: false }) },
  mixLab: { mode: "mix", title: "Lab: solishtirma issiqlik sig‘imini aniqlash", lesson: "Noma’lum metall (0,15 kg, 100 °C) alyuminiy kalorimetrdagi suvga (0,2 kg, 20 °C) tushiriladi. Muvozanat temperaturasidan c_X ni hisoblang, so‘ng jadval bilan solishtiring.",
    set: () => { mix.unknown = UNKNOWN_POOL[Math.floor(Math.random() * UNKNOWN_POOL.length)]; mix.reveal = false; setMix([{ kind: "water", m: 0.2, t: 20 }, { kind: "unknown", m: 0.15, t: 100 }], { cup: true, cupM: 0.1, loss: false }); } },
  mixCompare: { mode: "mix", title: "Lab: issiqlik miqdorlarini taqqoslash", lesson: "Issiq va sovuq suv real (issiqlik yo‘qotadigan) kalorimetrda aralashtiriladi. Berilgan va olingan issiqlikni solishtiring — farq atrofga ketgan issiqlikka teng.",
    set: () => setMix([{ kind: "water", m: 0.1, t: 20 }, { kind: "water", m: 0.1, t: 70 }], { cup: true, cupM: 0.1, loss: true }) },
  mixIce: { mode: "mix", title: "Muzning erishi", lesson: "0,05 kg muz (−10 °C) 0,5 kg iliq suvga (50 °C) tashlanadi. Muz isiydi, eriydi, so‘ng hosil bo‘lgan suv isiydi.",
    set: () => setMix([{ kind: "water", m: 0.5, t: 50 }, { kind: "ice", m: 0.05, t: -10 }], { cup: false, loss: false }) },
  mixIce2: { mode: "mix", title: "Muz to‘liq erimaydi", lesson: "Muz ko‘p, suv kam: suv 0 °C gacha soviydi, lekin bergan issiqligi muzni to‘liq eritishga yetmaydi. Natija: 0 °C dagi muz va suv aralashmasi.",
    set: () => setMix([{ kind: "water", m: 0.2, t: 20 }, { kind: "ice", m: 0.3, t: -10 }], { cup: false, loss: false }) },
  mixSteam: { mode: "mix", title: "Bug‘ning kondensatsiyasi", lesson: "100 °C li 20 g suv bug‘i 0,5 kg sovuq suvga kiritiladi. Bug‘ kondensatsiyalanib (Q = Lm) va hosil bo‘lgan suv sovib issiqlik beradi.",
    set: () => setMix([{ kind: "water", m: 0.5, t: 20 }, { kind: "steam", m: 0.02, t: 100 }], { cup: false, loss: false }) },
  heatIce: { mode: "heat", title: "Muzni isitish: erish va qaynash", lesson: "−20 °C dagi muz elektr isitgichda isitiladi: muz isiydi → eriydi (0 °C) → suv isiydi → qaynaydi (100 °C). Maydonchalarga e’tibor bering.",
    set: () => setHeat({ sub: "water", m: 0.5, t0: -20, src: "electric", P: 1000, loss: false }) },
  heatTin: { mode: "heat", title: "Qalayning erishi va qotishi", lesson: "Qalay gaz gorelkasida isitiladi va 232 °C da eriydi. To‘liq erigach, isitgichni o‘chiring — qalay soviydi va xuddi shu temperaturada qotadi.",
    set: () => setHeat({ sub: "tin", m: 0.5, t0: 20, src: "fuel", fuel: "gas", rate: 2, eta: 40, loss: true }) },
  heatWax: { mode: "heat", title: "Kristall va amorf jism", lesson: "Mum — amorf jism: isitilganda asta-sekin yumshaydi, grafikda maydoncha yo‘q. Naftalin (kristall) bilan solishtiring: u 80 °C da aniq eriydi.",
    set: () => setHeat({ sub: "wax", m: 0.3, t0: 20, src: "electric", P: 400, loss: false }) },
  heatFuel: { mode: "heat", title: "Yoqilg‘i bilan isitish (FIK)", lesson: "1 kg suv spirt lampasida 20 °C dan qaynaguncha isitiladi. Yongan spirt massasi va FIK ni kuzating: Q_foydali = cmΔt, Q_yonish = qm, η = Q_foydali/Q_yonish.",
    set: () => setHeat({ sub: "water", m: 1, t0: 20, src: "fuel", fuel: "alcohol", rate: 4, eta: 35, loss: false }) },
  heatAlcohol: { mode: "heat", title: "Spirtning qaynashi", lesson: "Spirt 78 °C da qaynaydi — suvdan ancha past. Bug‘lanish issiqligi ham kichik: L = 0,9·10⁶ J/kg.",
    set: () => setHeat({ sub: "alcohol", m: 0.2, t0: 20, src: "electric", P: 500, loss: false }) },
};
const PRESET_GROUPS = [["Kalorimetr", ["mixWater", "mixMetal", "mixLab", "mixCompare", "mixIce", "mixIce2", "mixSteam"]], ["Isitish", ["heatIce", "heatTin", "heatWax", "heatFuel", "heatAlcohol"]]];

function setMix(list, { cup, cupM = 0.1, loss }) {
  list.forEach((x, i) => { Object.assign(mix.cfg[i], x, { on: true }); });
  for (let i = list.length; i < 3; i++) mix.cfg[i].on = false;
  if (!mix.cfg[2].on && mix.cfg[2].kind === "unknown") mix.cfg[2].kind = "ice";
  mix.cup.on = cup; mix.cup.m = cupM; mix.loss = loss;
}
function setHeat(o) { Object.assign(heat.cfg, { fuel: "alcohol", rate: 3, eta: 40, P: 1000 }, o); }

const presetBox = $("[data-presets]");
presetBox.innerHTML = PRESET_GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });

function setPresetPressed(id) { document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id))); }
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function loadPreset(id) {
  const p = PRESETS[id];
  p.set();
  presetId = id; lastPreset = id;
  setMode(p.mode, { keepPreset: true });
  setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncMixCtl(); syncHeatCtl();
  rebuild();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

/* ------------------------------------------------------------------ Rejim, tezlik, ishga tushirish */

const MODE_HINT = { mix: "Jismlarni tanlang va «Boshlash» ni bosing — ular kalorimetrga tushiriladi", heat: "Moddani tanlang, «Boshlash» — isitgich yoqiladi; keyin uni o‘chirib sovuting" };
function setMode(mode, { keepPreset = false } = {}) {
  ui.mode = mode;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === mode)));
  $("[data-mix-ctrl]").hidden = mode !== "mix"; $("[data-heat-ctrl]").hidden = mode !== "heat";
  $("[data-mode-hint]").textContent = MODE_HINT[mode];
  ui.tab = TABS[mode][0][0];
  setupTabs(); setTab(ui.tab);
  setSpeed(mode === "mix" ? 10 : 60);
  if (!keepPreset) customized();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.modeValue === ui.mode) return;
  loadPreset(b.dataset.modeValue === "mix" ? "mixWater" : "heatIce");
}));

function setSpeed(v) {
  ui.speed = v;
  document.querySelectorAll("[data-speed-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speedValue) === v)));
}
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { setSpeed(Number(b.dataset.speedValue)); refresh(); }));

function rebuild() {
  if (ui.mode === "mix") buildMix(); else buildHeat();
  refresh(); stage.render(); graph.render();
}

const playBtn = $("[data-play]");
function running() { return ui.mode === "mix" ? mix.started && !mix.done && !paused : heat.started && !heat.done && !paused; }
let paused = false;
function syncPlay() {
  const started = ui.mode === "mix" ? mix.started : heat.started;
  const done = ui.mode === "mix" ? mix.done : heat.done;
  const on = started && !paused && !done;
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = !started ? "Boshlash" : done ? "Tugadi" : paused ? "Davom ettirish" : "Pauza";
  playBtn.disabled = done;
}
playBtn.addEventListener("click", () => {
  const st = ui.mode === "mix" ? mix : heat;
  if (!st.started) { st.started = true; paused = false; }
  else paused = !paused;
  if (!loop.running) loop.start();
  refresh();
});
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));
$("[data-reset]").addEventListener("click", () => { paused = false; rebuild(); });

let uiTimer = 0;
const loop = createLoop((dt) => {
  clock += dt;
  if (running()) stepSim(dt);
  uiTimer += dt;
  if (uiTimer > 0.12) { uiTimer = 0; refresh(); graph.render(); }
  stage.render();
});

/* ------------------------------------------------------------------ Boshlash */

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "mixWater");
if (!prefersReducedMotion()) loop.start(); else stage.render();
