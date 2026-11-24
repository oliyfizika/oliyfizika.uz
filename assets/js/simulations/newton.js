// ==========================================================================
// Nyuton qonunlari — virtual laboratoriya (simulations/newton-second-law.html)
// 1) Ikkinchi qonun: stol ustidagi aravacha — dinamometr (doimiy kuch) yoki blok orqali osilgan yuk; ishqalanish;
//    aravacha/osma yukka yuk qo'shish («+»/«−»), kuch o'qini va fotodarvozani sudrash; a = 2s/t² o'lchovi, a(F), a(1/m).
// 2) Uchinchi qonun: ip bilan siqib bog'langan prujinali ikki aravacha — ipni kesish, F₁₂ = −F₂₁, m₁v₁ = m₂v₂,
//    stroboskopik belgilar.
// 3) Liftda vazn: bino kesimi va kabina ichi (tarozidagi odam, dinamometrdagi yuk), qavat pulti, erkin tushish va tormoz.
// Fizika: newton-physics.js (Node'da tekshirilgan). Grafiklar: newton-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./newton-physics.js";
import * as G from "./newton-plots.js";
import { createNewtonLab } from "./newton-lab-3d.js?v=20261123-batch5c";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch5c";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch5c";

const $ = (s) => document.querySelector(s);
const GRAV = P.G;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "law2", tab: "aF", show: { vec: true } };
// 1) aravacha (dunyo: metr; stol usti y = 0, rels usti 0,01; aravacha uzunligi 0,2)
const CL = 0.2, XMAX = 1.0, HANG_Y0 = -0.1, HANG_H = 0.09, FLOOR = -0.6, DROP = HANG_Y0 - HANG_H - FLOOR; // yuk polga tekkuncha yo'l (0,41 m)
const crt = { drive: "force", M: 0.5, m: 0.1, F: 1, mu: 0, s: 0.6, x: 0, v: 0, t: 0, phase: "ready", tGate: null, aMeas: null, landed: false, pts: [], wait: 0, Fd0: 0 };
// 2) ikki aravacha
const L0 = 0.06, KS = 600;
const rc = { m1: 0.5, m2: 1, dx: 0.03, x1: 0, x2: 0, v1: 0, v2: 0, F: 0, Fmax: 0, t: 0, phase: "bound", strobe: [], st: 0, start: null, contact: false };
// 3) lift
const FLOORH = 3, NFL = 9, VMAX = 3;
const lift = { m: 60, a0: 2, y: 0, v: 0, a: 0, mode: "idle", t: 0, tr: 0, ride: null, target: 1, cable: true, tf: 0, hist: [], auto: null };
let presetId = null;

const trim = (h, t) => { while (h.length && h[0].t < t) h.shift(); };

const gateMax = () => (crt.drive === "hang" ? 0.4 : 0.9);
function cartState() { return P.cartForces({ M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive, v: crt.v, attached: !(crt.drive === "hang" && crt.landed) }); }
const floorY = (n) => (n - 1) * FLOORH;
const curFloor = () => clamp(Math.round(lift.y / FLOORH) + 1, 1, NFL);
const canFall = () => lift.cable && lift.mode === "idle" && lift.y >= 8.5 - 1e-6;
const liftP = () => (lift.cable || lift.mode !== "idle" ? P.weight(lift.m, lift.a) : P.weight(lift.m, 0));

function stepLaw2(dt) {
  if (crt.phase !== "run") return;
  const n = Math.max(1, Math.ceil(dt / 0.002)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const cs = cartState();
    let v1 = crt.v + cs.a * h;
    if (crt.v > 0 && v1 <= 0) { crt.v = 0; crt.phase = "done"; break; }
    const x0 = crt.x; crt.x += 0.5 * (crt.v + v1) * h; crt.v = v1; crt.t += h;
    if (crt.tGate === null && crt.x >= crt.s) {
      const tg = crt.t - h + ((crt.s - x0) / Math.max(crt.x - x0, 1e-9)) * h;
      crt.tGate = Math.round(tg * 1000) / 1000; crt.aMeas = P.accelFrom(crt.s, crt.tGate);
      crt.pts.push({ F: crt.Fd0, a: crt.aMeas, M: crt.M, mass: crt.drive === "hang" ? crt.M + crt.m : crt.M, mode: crt.drive });
      if (crt.pts.length > 40) crt.pts.shift();
    }
    if (crt.drive === "hang" && !crt.landed && crt.x >= DROP) crt.landed = true;
    if (crt.x >= XMAX) { crt.x = XMAX; crt.v = 0; crt.phase = "done"; break; }
  }
}
function startLaw2() {
  if (crt.phase !== "ready") return;
  const cs = P.cartForces({ M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive, v: 0 });
  crt.Fd0 = cs.Fd; crt.t = 0; crt.tGate = null; crt.aMeas = null;
  crt.phase = cs.a > 0 ? "run" : "stuck";
  if (!loop.running) loop.start();
}
function resetLaw2() { Object.assign(crt, { x: 0, v: 0, t: 0, phase: "ready", tGate: null, aMeas: null, landed: false }); }

/* ================================================================== 2) Uchinchi qonun */

function placeRecoil() { const gap = L0 - rc.dx; rc.x1 = -gap / 2; rc.x2 = gap / 2; rc.v1 = rc.v2 = 0; rc.F = KS * rc.dx; rc.Fmax = 0; rc.t = 0; rc.st = 0; rc.strobe = []; rc.phase = "bound"; rc.start = null; rc.contact = true; }
function stepLaw3(dt) {
  if (rc.phase !== "push" && rc.phase !== "fly") return;
  const rate = rc.contact ? 0.04 : 1, h = dt * rate;
  const nx = P.recoilStep(rc, h, { m1: rc.m1, m2: rc.m2, k: KS, L0 });
  Object.assign(rc, { x1: nx.x1, x2: nx.x2, v1: nx.v1, v2: nx.v2, F: nx.F }); rc.Fmax = Math.max(rc.Fmax, nx.F);
  rc.contact = rc.x2 - rc.x1 < L0; if (!rc.contact) rc.phase = "fly";
  rc.t += h; rc.st += h;
  if (rc.st >= 0.1 || !rc.strobe.length) { rc.st = 0; rc.strobe.push({ a: rc.x1 - CL / 2, b: rc.x2 + CL / 2 }); }
  const lim = scene.recoilLimit;
  if (rc.x1 - CL <= -lim || rc.x2 + CL >= lim) { rc.phase = "done"; rc.strobe.push({ a: rc.x1 - CL / 2, b: rc.x2 + CL / 2 }); }
}
function releaseLaw3() { if (rc.phase !== "bound") return; rc.phase = "push"; rc.start = { x1: rc.x1, x2: rc.x2 }; rc.strobe = [{ a: rc.x1 - CL / 2, b: rc.x2 + CL / 2 }]; if (!loop.running) loop.start(); }

/* ================================================================== 3) Liftda vazn */

function startRide(n) {
  if (!lift.cable || lift.mode !== "idle") return;
  const D = floorY(n) - lift.y; if (Math.abs(D) < 0.01) return;
  lift.ride = P.rideProfile(D, lift.a0, VMAX); lift.tr = 0; lift.mode = "ride"; lift.target = n;
  if (!loop.running) loop.start();
}
function cutCable() { if (!canFall()) return; lift.cable = false; lift.mode = "fall"; lift.tf = 0; if (!loop.running) loop.start(); }
function stepLift(dt) {
  const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
  if (lift.auto) { lift.auto.t -= dt; if (lift.auto.t <= 0) { const f = lift.auto.fn; lift.auto = null; f(); } }
  for (let i = 0; i < n; i++) {
    if (lift.mode === "ride") {
      lift.tr += h; lift.a = lift.ride.acc(lift.tr);
      if (lift.tr >= lift.ride.T) { lift.y = floorY(lift.target); lift.v = 0; lift.a = 0; lift.mode = "idle"; break; }
    } else if (lift.mode === "fall") { lift.a = -GRAV; lift.tf += h; if (lift.tf >= 0.9) lift.mode = "brake"; }
    else if (lift.mode === "brake") { lift.a = GRAV; if (lift.v + lift.a * h >= 0) { lift.v = 0; lift.a = 0; lift.mode = "idle"; break; } }
    else lift.a = 0;
    lift.v += lift.a * h; lift.y = Math.max(0, lift.y + lift.v * h);
  }
  lift.t += dt;
  lift.hist.push({ t: lift.t, a: lift.a, v: lift.v, P: liftP() }); trim(lift.hist, lift.t - 20);
}

/* ------------------------------------------------------------------ Asosiy chizish */

const scene = createNewtonLab();
function draw(ctx, st) { scene.draw(ctx, st, ui, crt, rc, lift); }
const heights = () => ({graph: Math.round(clamp(innerHeight * .26, 170, 240))});
const stage = createStage($("#stage"), draw, {height: detailedStageHeight});

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  law2: [["aF", "a(F)", "Tezlanish kuchga bog‘liq (o‘lchovlar)", "Massa o‘zgarmas bo‘lsa, tezlanish kuchga to‘g‘ri proporsional: nuqtalar koordinata boshidan o‘tuvchi to‘g‘ri chiziqqa tushadi (ishqalanish bo‘lsa, chiziq μMg dan boshlanadi). Nuqta rangi — aravacha massasi."], ["am", "a(1/m)", "Tezlanish massaga bog‘liq (o‘lchovlar)", "Kuch o‘zgarmas bo‘lsa, a = F/m: tezlanish massaga teskari proporsional, 1/m ga nisbatan to‘g‘ri chiziq. Xira nuqtalar — boshqa kuch bilan o‘lchangan."]],
  law3: [],
  lift: [["P", "P(t)", "Tarozi ko‘rsatgan vazn", "Lift yuqoriga tezlansa yoki pastga tormozlansa (tezlanish yuqoriga), vazn mg dan katta; pastga tezlansa — kichik; tekis harakatda P = mg; erkin tushishda P = 0."], ["av", "a(t), v(t)", "Kabina tezlanishi va tezligi", "Vazn tezlikka emas, tezlanishga bog‘liq: tekis harakatda (v ≠ 0, a = 0) tarozi mg ni ko‘rsatadi."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
  $("[data-graph-card]").hidden = !TABS[ui.mode].length;
  $("[data-meas-clear]").hidden = ui.mode !== "law2";
}
function setTab(tab) {
  const list = TABS[ui.mode]; if (!list.length) return;
  const t = list.find((x) => x[0] === tab) || list[0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, gst) {
  if (ui.mode === "law2") {
    const Fd = crt.drive === "hang" ? crt.m * GRAV : crt.F;
    if (ui.tab === "am") return G.drawAM(ctx, gst, { pts: crt.pts.filter((p) => p.mode === crt.drive), M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive });
    return G.drawAF(ctx, gst, { pts: crt.pts.filter((p) => p.mode === crt.drive), M: crt.M, mu: crt.mu, mode: crt.drive, Fd });
  }
  if (ui.mode === "lift") return ui.tab === "av" ? G.drawLiftAV(ctx, gst, { hist: lift.hist, span: 16 }) : G.drawLiftP(ctx, gst, { hist: lift.hist, span: 16, mass: lift.m });
  ctx.fillStyle = gst.colors.bg; ctx.fillRect(0, 0, gst.w, gst.h);
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
  if (ui.mode === "law2") {
    const hang = crt.drive === "hang", cs0 = P.cartForces({ M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive, v: 0 }), cs = crt.phase === "run" ? cartState() : cs0;
    setRO("r1", "Tezlanuvchi massa", `${fmt(cs0.mass, 2)}<small>kg</small>`, hang ? `M + m = ${fmt(crt.M, 1)} + ${fmt(crt.m, 2)}` : "aravacha M");
    setRO("r2", hang ? "Tortuvchi kuch <i>mg</i>" : "Tortish kuchi <i>F</i>", `${fmt(cs0.Fd, 2)}<small>N</small>`, hang ? `ip tarangligi T = ${fmt(cs.T, 2)} N` : "dinamometr ko‘rsatishi");
    setRO("r3", "Ishqalanish kuchi <i>f</i>", `${fmt(cs.f, 2)}<small>N</small>`, crt.mu ? `eng ko‘pi μMg = ${fmt(crt.mu * crt.M * GRAV, 2)} N` : "ishqalanishsiz", crt.mu ? "" : "muted");
    setRO("r4", "Tezlanish (nazariya)", `${fmt(cs0.a, 2)}<small>m/s²</small>`, `a = (${hang ? "mg" : "F"} − f)/${hang ? "(M + m)" : "M"}`);
    setRO("r5", "O‘lchangan vaqt <i>t</i>", crt.tGate !== null ? `${fmt(crt.tGate, 3)}<small>s</small>` : "—", `s = ${fmt(crt.s, 2)} m masofada`);
    setRO("r6", "O‘lchangan tezlanish", crt.aMeas !== null ? `${fmt(crt.aMeas, 2)}<small>m/s²</small>` : "—", crt.aMeas !== null ? `a = 2s/t²; xato ${fmt(Math.abs(crt.aMeas - cs0.a) / Math.max(cs0.a, 1e-9) * 100, 1)}%` : "aravachani qo‘yib yuboring", crt.aMeas !== null ? "" : "muted");
  } else if (ui.mode === "law3") {
    const fin = P.recoilFinal(rc.m1, rc.m2, KS, rc.dx), F = rc.phase === "bound" ? KS * rc.dx : rc.F;
    setRO("r1", "Massalar <i>m₁ : m₂</i>", `${fmt(rc.m1, 1)} : ${fmt(rc.m2, 1)}<small>kg</small>`, `prujina k = ${KS} N/m, Δx = ${fmt(rc.dx * 100, 1)} cm`);
    setRO("r2", "O‘zaro ta’sir kuchi", `${fmt(F, 1)}<small>N</small>`, `|F₁₂| = |F₂₁|; eng katta ${fmt(KS * rc.dx, 1)} N`);
    setRO("r3", "Tezlanishlar <i>a₁, a₂</i>", `${fmt(F / rc.m1, 1)} ; ${fmt(F / rc.m2, 1)}<small>m/s²</small>`, `a₁/a₂ = m₂/m₁ = ${fmt(rc.m2 / rc.m1, 2)}`);
    setRO("r4", "Tezliklar <i>v₁, v₂</i>", `${fmt(rc.v1, 2)} ; ${fmt(rc.v2, 2)}<small>m/s</small>`, `oxirida ${fmt(fin.v1, 2)} va ${fmt(fin.v2, 2)} m/s`);
    setRO("r5", "Impulslar yig‘indisi", `${fmt(rc.m1 * rc.v1 + rc.m2 * rc.v2, 3)}<small>kg·m/s</small>`, `p₁ = ${fmt(rc.m1 * rc.v1, 2)}, p₂ = ${fmt(rc.m2 * rc.v2, 2)}`);
    const s1 = rc.start ? Math.abs(rc.x1 - rc.start.x1) : 0, s2 = rc.start ? Math.abs(rc.x2 - rc.start.x2) : 0;
    setRO("r6", "Yo‘llar nisbati <i>s₁/s₂</i>", s2 > 0.002 ? fmt(s1 / s2, 2) : "—", `m₂/m₁ = ${fmt(rc.m2 / rc.m1, 2)}`, s2 > 0.002 ? "" : "muted");
  } else {
    const P_ = liftP(), mg = lift.m * GRAV;
    setRO("r1", "Kabina tezlanishi <i>a</i>", `${fmt(lift.a, 2)}<small>m/s²</small>`, lift.a > 0.01 ? "yuqoriga" : lift.a < -0.01 ? "pastga" : "a = 0");
    setRO("r2", "Kabina tezligi <i>v</i>", `${fmt(lift.v, 2)}<small>m/s</small>`, lift.v > 0.01 ? "yuqoriga" : lift.v < -0.01 ? "pastga" : "turibdi");
    setRO("r3", "Vazn <i>P</i>", `${fmt(P_, 0)}<small>N</small>`, `og‘irlik kuchi mg = ${fmt(mg, 0)} N`, Math.abs(P_ - mg) > 1 ? "orange" : "");
    setRO("r4", "Tarozi ko‘rsatishi", `${fmt(P_ / GRAV, 1)}<small>kg</small>`, `haqiqiy massa ${fmt(lift.m, 0)} kg`);
    setRO("r5", "Yuklama <i>P/mg</i>", fmt(P_ / mg, 2), P_ < 1 ? "vaznsizlik" : P_ > mg * 1.01 ? "ortiqcha yuklama" : P_ < mg * 0.99 ? "vazn kamaygan" : "odatdagi");
    setRO("r6", "Qavat", `${curFloor()}`, `balandlik ${fmt(lift.y, 1)} m`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "law2") { t = { ready: "Tayyor", run: "Harakatlanmoqda", done: "To‘xtadi", stuck: "Qo‘zg‘almadi" }[crt.phase]; tone = { ready: "blue", run: "green", done: "purple", stuck: "red" }[crt.phase]; }
  else if (ui.mode === "law3") { t = { bound: "Ip bilan bog‘langan", push: "O‘zaro ta’sir", fly: "Ajralib ketdi", done: "To‘xtatgichga yetdi" }[rc.phase]; tone = rc.phase === "push" ? "orange" : rc.phase === "bound" ? "blue" : "green"; }
  else { const r = liftP() / (lift.m * GRAV); t = r < 0.02 ? "Vaznsizlik" : r > 1.01 ? "Ortiqcha yuklama" : r < 0.99 ? "Vazn kamaygan" : "P = mg"; tone = r < 0.02 ? "red" : r > 1.01 ? "orange" : r < 0.99 ? "purple" : "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "law2") {
    p.push("<p><b>Nyutonning ikkinchi qonuni:</b> jism olgan tezlanish unga ta’sir etayotgan natijaviy kuchga to‘g‘ri, massasiga teskari proporsional: a = F/m. Kuch 2 marta ortsa tezlanish 2 marta ortadi; massa 2 marta ortsa — 2 marta kamayadi.</p>");
    p.push(crt.drive === "hang" ? "<p>Osilgan yuk og‘irligi mg <b>ikki jismni</b> — aravacha va yukning o‘zini — tezlantiradi: a = mg/(M + m). Shuning uchun ip tarangligi T = m(g − a) yukning og‘irligidan kichik. Yuk polga tekkach ip bo‘shaydi va aravacha inersiya bilan harakatlanadi.</p>" : "<p>Aravacha tinch holatdan boshlab s masofani t vaqtda o‘tsa, s = at²/2, demak a = 2s/t². Fotodarvoza vaqtni o‘lchaydi — natija grafikka nuqta bo‘lib tushadi. Kuch va massani o‘zgartirib, bir nechta o‘lchov qiling.</p>");
    if (crt.mu > 0) p.push(`<p>Ishqalanish natijaviy kuchni kamaytiradi: F<sub>nat</sub> = F − μMg. Tortish kuchi μMg = ${fmt(crt.mu * crt.M * GRAV, 2)} N dan oshmaguncha aravacha qo‘zg‘almaydi — tinchlikdagi ishqalanish uni muvozanatlaydi.</p>`);
  } else if (ui.mode === "law3") {
    p.push("<p><b>Nyutonning uchinchi qonuni:</b> ikki jism bir-biriga moduli teng, yo‘nalishi qarama-qarshi kuchlar bilan ta’sir qiladi: F₁₂ = −F₂₁. Kuchlar <b>har xil jismlarga</b> qo‘yilgan, shuning uchun bir-birini muvozanatlamaydi.</p>");
    p.push("<p>Kuchlar teng, massalar har xil — tezlanishlar massaga teskari proporsional: a₁/a₂ = m₂/m₁. Ta’sir vaqti bir xil bo‘lgani uchun tezliklar va bir xil vaqtda o‘tilgan yo‘llar ham shu nisbatda: yengil aravacha uzoqroqqa ketadi. Impulslar yig‘indisi nolligicha qoladi.</p>");
  } else {
    p.push("<p><b>Vazn</b> — jismning tayanchga (tarozi) bosish kuchi. Kabina bilan birga a tezlanish bilan harakatlanayotgan odamga mg va N ta’sir qiladi: N − mg = ma, tarozi esa uchinchi qonunga ko‘ra P = N = m(g + a) ni ko‘rsatadi (a — yuqoriga musbat).</p>");
    p.push("<p>Tezlanish yuqoriga yo‘nalganda (yuqoriga tezlanish yoki pastga tushishda tormozlanish) — <b>ortiqcha yuklama</b>, pastga yo‘nalganda — vazn kamayadi. Erkin tushishda a = −g va P = 0 — <b>vaznsizlik</b>: odam va yuk tarozi va prujinaga bosmaydi, ammo og‘irlik kuchi mg o‘zgarmaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "law2" ? "<small>Ikkinchi qonun</small> a = F/m" : ui.mode === "law3" ? "<small>Uchinchi qonun</small> F₁₂ = −F₂₁" : "<small>Vazn</small> P = m(g + a)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  let t = "", dis = false;
  if (ui.mode === "law2") { t = crt.phase === "ready" ? "Qo‘yib yuborish" : "Qaytadan tayyorlash"; dis = crt.phase === "run"; }
  else if (ui.mode === "law3") { t = rc.phase === "bound" ? "Ipni kesish" : "Qaytadan bog‘lash"; dis = rc.phase === "push" || rc.phase === "fly"; }
  else { t = lift.cable ? "Arqon uzildi!" : "Arqonni tiklash"; dis = lift.cable ? !canFall() : lift.mode !== "idle"; }
  if (actBtn.textContent !== t) actBtn.textContent = t; actBtn.disabled = dis;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "law2") stepLaw2(dt); else if (ui.mode === "law3") stepLaw3(dt); else stepLift(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); updateAction(); graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
function resetMode() {
  if (ui.mode === "law2") resetLaw2();
  else if (ui.mode === "law3") placeRecoil();
  else Object.assign(lift, { v: 0, a: 0, mode: "idle", cable: true, ride: null, auto: null, y: floorY(curFloor()), hist: [], t: 0 });
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); });
actBtn.addEventListener("click", () => {
  if (ui.mode === "law2") { if (crt.phase === "ready") startLaw2(); else resetLaw2(); }
  else if (ui.mode === "law3") { if (rc.phase === "bound") releaseLaw3(); else placeRecoil(); }
  else if (lift.cable) cutCable(); else Object.assign(lift, { cable: true, mode: "idle" });
  customized(); refresh();
});
$("[data-meas-clear]").addEventListener("click", () => { crt.pts = []; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const ready2 = () => { if (crt.phase !== "ready") resetLaw2(); };
const aFC = bindRange($("#aF"), $("#aFOut"), (v) => `${fmt(v, 1)} N`, (v) => { crt.F = v; ready2(); customized(); refresh(); });
const aMhC = bindRange($("#aMh"), $("#aMhOut"), (v) => `${fmt(v * 1000, 0)} g`, (v) => { crt.m = v; ready2(); customized(); refresh(); });
const aMC = bindRange($("#aM"), $("#aMOut"), (v) => `${fmt(v, 1)} kg`, (v) => { crt.M = v; ready2(); customized(); refresh(); });
const aMuC = bindRange($("#aMu"), $("#aMuOut"), (v) => fmt(v, 2), (v) => { crt.mu = v; ready2(); customized(); refresh(); });
const aSC = bindRange($("#aS"), $("#aSOut"), (v) => `${fmt(v, 2)} m`, (v) => { crt.s = Math.min(v, gateMax()); if (crt.s !== v) aSC.set(crt.s); ready2(); customized(); refresh(); });
document.querySelectorAll("[data-drive-value]").forEach((b) => b.addEventListener("click", () => { crt.drive = b.dataset.driveValue; crt.s = Math.min(crt.s, gateMax()); resetLaw2(); syncAll(); setModeUI(); customized(); refresh(); }));
const rM1C = bindRange($("#rM1"), $("#rM1Out"), (v) => `${fmt(v, 1)} kg`, (v) => { rc.m1 = v; placeRecoil(); customized(); refresh(); });
const rM2C = bindRange($("#rM2"), $("#rM2Out"), (v) => `${fmt(v, 1)} kg`, (v) => { rc.m2 = v; placeRecoil(); customized(); refresh(); });
const rXC = bindRange($("#rX"), $("#rXOut"), (v) => `${fmt(v, 1)} cm`, (v) => { rc.dx = v / 100; placeRecoil(); customized(); refresh(); });
const lMC = bindRange($("#lM"), $("#lMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { lift.m = v; customized(); refresh(); });
const lAC = bindRange($("#lA"), $("#lAOut"), (v) => `${fmt(v, 1)} m/s²`, (v) => { lift.a0 = v; customized(); refresh(); });
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi boshqaruv */
const canvas = stage.canvas;
let drag = null;
function click(h) {
  if (h === "cm") crt.M = Math.round((crt.M - 0.1) * 10) / 10; else if (h === "cp") crt.M = Math.round((crt.M + 0.1) * 10) / 10;
  else if (h === "hm") crt.m = Math.round((crt.m - 0.05) * 100) / 100; else if (h === "hp") crt.m = Math.round((crt.m + 0.05) * 100) / 100;
  else if (/^[mp][12]$/.test(h)) { const k = h[1] === "1" ? "m1" : "m2"; rc[k] = clamp(rc[k] + (h[0] === "p" ? 0.5 : -0.5), 0.5, 2.5); placeRecoil(); }
  else if (h === "thread") releaseLaw3();
  else if (h === "fall") { if (lift.cable) cutCable(); else if (lift.mode === "idle") lift.cable = true; }
  else if (h[0] === "f") startRide(+h.slice(1));
  crt.M = clamp(crt.M, 0.5, 1); crt.m = clamp(crt.m, 0.05, 0.3);
  syncAll(); customized(); refresh();
}
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id, p) {
    if (!["ftip", "gate", "c1", "c2"].includes(id)) { click(id); return; }
    drag = id;
    scene.startDrag(id, p);
    if (id === "gate" && crt.phase !== "ready") resetLaw2();
  },
  move(id, p) {
    if (drag !== id) return;
    const v = scene.parameter(id, p);
    if (id === "ftip") { crt.F = clamp(Math.round(v * 10) / 10, 0, 4); aFC.set(crt.F); }
    else if (id === "gate") { crt.s = clamp(Math.round(v * 20) / 20, .1, gateMax()); aSC.set(crt.s); }
    else { rc.dx = clamp(Math.round(v * 200) / 200, .005, .04); placeRecoil(); rXC.set(rc.dx * 100); }
    customized(); refresh();
  },
  end() { drag = null; },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  force: { mode: "law2", title: "Doimiy kuch: F = ma", lesson: "Dinamometr aravachani 1 N kuch bilan tortadi. «Qo‘yib yuborish»ni bosing: fotodarvoza vaqtni o‘lchaydi va a = 2s/t² grafikka tushadi. Kuch o‘qini surib 2 N, 3 N bilan takrorlang — nuqtalar to‘g‘ri chiziqda yotadi.", set: () => Object.assign(crt, { drive: "force", M: 0.5, F: 1, mu: 0, s: 0.6, pts: [] }), tab: "aF" },
  mass: { mode: "law2", title: "Massani oshirish", lesson: "F = 2 N o‘zgarmas. Aravachaga «+» bilan yuk qo‘shib (0,5 → 1 kg) o‘lchang: massa 2 marta ortsa, tezlanish 2 marta kamayadi. a(1/m) grafigida nuqtalar to‘g‘ri chiziqda.", set: () => Object.assign(crt, { drive: "force", M: 0.5, F: 2, mu: 0, s: 0.6, pts: [] }), tab: "am" },
  hang: { mode: "law2", title: "Blok orqali osilgan yuk", lesson: "100 g yukning og‘irligi (0,98 N) aravacha bilan yukning o‘zini tezlantiradi: a = mg/(M + m) = 1,63 m/s². Ip tarangligi T yukning og‘irligidan kichik. Yuk polga tekkach aravacha inersiya bilan ketadi.", set: () => Object.assign(crt, { drive: "hang", M: 0.5, m: 0.1, mu: 0, s: 0.35, pts: [] }), tab: "aF" },
  fric: { mode: "law2", title: "Ishqalanish bilan", lesson: "μ = 0,2: ishqalanish kuchi μMg = 0,98 N. F = 0,8 N da aravacha qo‘zg‘almaydi; kuch o‘qini surib 1,5 N, 2,5 N bilan o‘lchang — to‘g‘ri chiziq koordinata boshidan emas, μMg nuqtadan boshlanadi.", set: () => Object.assign(crt, { drive: "force", M: 0.5, F: 0.8, mu: 0.2, s: 0.6, pts: [] }), tab: "aF" },
  eq: { mode: "law3", title: "Teng massalar", lesson: "Ikki aravacha massasi teng: ipni kesing — ular bir xil tezlik bilan qarama-qarshi tomonlarga ketadi. Ta’sir paytidagi kuchlar teng va qarama-qarshi.", set: () => Object.assign(rc, { m1: 1, m2: 1, dx: 0.03 }) },
  uneq: { mode: "law3", title: "Massalar 1 : 2", lesson: "m₂ = 2m₁. Kuchlar baribir teng, lekin og‘ir aravacha 2 marta sekin ketadi: belgilar orasidagi masofa 2 marta kichik, s₁/s₂ = 2.", set: () => Object.assign(rc, { m1: 0.5, m2: 1, dx: 0.03 }) },
  big: { mode: "law3", title: "Yengil va og‘ir (1 : 5)", lesson: "m₂ = 5m₁: og‘ir aravacha deyarli joyida qoladi — miltiq va o‘q, qayiqdan sakrash kabi. Impulslar yig‘indisi baribir nol.", set: () => Object.assign(rc, { m1: 0.5, m2: 2.5, dx: 0.04 }) },
  up: { mode: "lift", title: "Yuqoriga: 1 → 9 qavat", lesson: "Lift yuqoriga tezlanganda tarozi ko‘proq, tekis harakatda — aniq massani, to‘xtashda (tezlanish pastga) — kamroq ko‘rsatadi. Pultda boshqa qavatni tanlang.", set: () => { Object.assign(lift, { m: 60, a0: 2, y: 0 }); lift.auto = { t: 0.6, fn: () => startRide(9) }; }, tab: "P" },
  down: { mode: "lift", title: "Pastga: 9 → 1 qavat", lesson: "Pastga tezlanishda vazn kamayadi, pastga tushib to‘xtashda (tormoz — tezlanish yuqoriga) ortiqcha yuklama.", set: () => { Object.assign(lift, { m: 60, a0: 2, y: floorY(9) }); lift.auto = { t: 0.6, fn: () => startRide(1) }; }, tab: "P" },
  fall: { mode: "lift", title: "Arqon uzildi: vaznsizlik", lesson: "9-qavatda arqon uziladi: kabina erkin tushadi (a = −g) — tarozi ham, dinamometr ham nolni ko‘rsatadi. So‘ng xavfsizlik tormozi kabinani a = g bilan to‘xtatadi — vazn 2 marta ortadi.", set: () => { Object.assign(lift, { m: 60, a0: 2, y: floorY(9) }); lift.auto = { t: 1.2, fn: cutCable }; }, tab: "P" },
};
const GROUPS = [["Ikkinchi qonun", ["force", "mass", "hang", "fric"]], ["Uchinchi qonun", ["eq", "uneq", "big"]], ["Liftda vazn", ["up", "down", "fall"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  aFC.set(crt.F); aMhC.set(crt.m); aMC.set(crt.M); aMuC.set(crt.mu); aSC.set(crt.s);
  document.querySelectorAll("[data-drive-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.driveValue === crt.drive)));
  rM1C.set(rc.m1); rM2C.set(rc.m2); rXC.set(rc.dx * 100);
  lMC.set(lift.m); lAC.set(lift.a0);
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { law2: "Yuk «+»/«−», kuch o‘qi va fotodarvoza suriladi", law3: "Aravachani surib prujinani siqing, ipni bosib kesing", lift: "Kabina pultidagi qavat tugmasini bosing" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== crt.drive; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  setupTabs(); window.dispatchEvent(new Event("resize"));
}
const MODE_DEFAULT = { law2: "force", law3: "uneq", lift: "up" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; lift.auto = null;
  ui.mode = p.mode;
  if (p.mode === "lift") Object.assign(lift, { v: 0, a: 0, mode: "idle", cable: true, ride: null, hist: [], t: 0 });
  p.set();
  if (p.mode === "law2") resetLaw2(); else if (p.mode === "law3") placeRecoil();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || (TABS[ui.mode][0] || [""])[0]);
  refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "force");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
