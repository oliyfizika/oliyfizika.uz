// ==========================================================================
// Issiqlik almashinuvi — virtual laboratoriya (simulations/heat.html)
// 1) Kalorimetr: 2–3 jism (suv, muz, bug‘, spirt, metallar, noma’lum metall) va idish — issiqlik muvozanati.
// 2) Isitish: moddani elektr isitgich yoki yoqilg‘i bilan isitish/sovitish — isitish egri chizig‘i, erish, qaynash.
// Fizika: heat-physics.js (entalpiya bo'yicha, Node'da tekshirilgan). Grafiklar: heat-plots.js.
// ==========================================================================

import { createHeatLab } from './heat-lab-3d.js?v=20261123-batch8d';
import { bindLabCamera } from './lab-3d.js?v=20261123-batch8d';
import { detailedStageHeight } from './apparatus-3d.js?v=20261123-batch8d';
import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import {
  SUBSTANCES as SUB, FUELS, hOf, TOf, phaseOf, equilibrium, stepMix, stableDt, stepHeat, stageHeats, measuredC, PHASE_NAMES,
} from "./heat-physics.js";
import { drawMixTemps, drawMixBalance, drawHeatCurve, drawHeatStages } from "./heat-plots.js";

const $ = (s) => document.querySelector(s);
const T_ROOM = 20;

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

const tempTxt = (T) => `${fmt(T, Math.abs(T) < 100 ? 1 : 0)} °C`;
const kJ = (Q) => (Math.abs(Q) >= 1e6 ? `${fmt(Q / 1e6, 2)} MJ` : Math.abs(Q) >= 1000 ? `${fmt(Q / 1000, Math.abs(Q) >= 1e5 ? 0 : 1)} kJ` : `${fmt(Q, 0)} J`);
const kJhtml = (Q) => (Math.abs(Q) >= 1e6 ? `${fmt(Q / 1e6, 2)}<small>MJ</small>` : Math.abs(Q) >= 1000 ? `${fmt(Q / 1000, Math.abs(Q) >= 1e5 ? 0 : 1)}<small>kJ</small>` : `${fmt(Q, 0)}<small>J</small>`);
const timeTxt = (t) => (t < 120 ? `${fmt(t, t < 10 ? 1 : 0)} s` : `${Math.floor(t / 60)} min ${String(Math.round(t % 60)).padStart(2, "0")} s`);

let clock = 0; // vizual vaqt; fizik vaqt mix.t / heat.t da

const scene = createHeatLab();
function draw(ctx, stage) {
  if (ui.mode === 'mix' ? mix.bodies.length : heat.body) scene.draw(ctx,stage,ui,mix,heat,clock);
}

const heights = (w) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(w * 0.5, vh * 0.5), 280, 420)), graph: Math.round(clamp(vh * 0.27, 170, 250)) };
};
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });

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

/* Sahnadagi fizik moslama va 360° kamera. Dastaklar slayderlar bilan bir xil parametrni boshqaradi. */
let sceneDrag = null;
bindLabCamera(stage.canvas, scene.lab, () => stage.render(), {
  start(id,p) {
    if (id === 'heater') { $('[data-heater]').click(); return; }
    const body = /^(mass|temp)([012])$/.exec(id);
    if (body) { const i=+body[2]; sceneDrag={id,x:p.x,value:mix.cfg[i][body[1]==='mass'?'m':'t'],i,kind:body[1]}; }
    else sceneDrag={id,x:p.x,value:id==='power'?(heat.cfg.src==='electric'?heat.cfg.P:heat.cfg.rate):heat.cfg.m};
  },
  move(id,p) {
    if (!sceneDrag || sceneDrag.id!==id) return;
    const d=sceneDrag,dx=(p.x-d.x)/180;
    if (d.kind) {
      const cfg=mix.cfg[d.i],k=KINDS[cfg.kind];
      if(d.kind==='mass'){const hi=k.branch==='gas'?.1:1;cfg.m=clamp(Math.round((d.value+dx*(hi-.01))*100)/100,.01,hi);bodyCtl[d.i].m.set(cfg.m);}
      else {cfg.t=clamp(Math.round(d.value+dx*(k.tMax-k.tMin)),k.tMin,k.tMax);bodyCtl[d.i].t.set(cfg.t);}
      customized();rebuild();
    } else if(id==='massH') {heat.cfg.m=clamp(Math.round((d.value+dx*1.9)*20)/20,.1,2);hMCtl.set(heat.cfg.m);customized();rebuild();}
    else if(id==='power') {
      if(heat.cfg.src==='electric'){heat.cfg.P=clamp(Math.round((d.value+dx*2950)/50)*50,50,3000);hPCtl.set(heat.cfg.P);}
      else {heat.cfg.rate=clamp(Math.round((d.value+dx*19.5)*2)/2,.5,20);hRateCtl.set(heat.cfg.rate);}
      customized();refresh();
    }
  },
  end(){sceneDrag=null;},
});

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
