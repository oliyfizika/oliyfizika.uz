// ==========================================================================
// Sirt tarangligi, ho'llash va kapillyarlik — virtual laboratoriya (simulations/surface.html)
// 1) Ramka va sovun pardasi: qo'zg'aluvchan to'sin sahnada suriladi; dinamometr F = 2σL (o'zgarmas), ish A = σΔS.
// 2) Ho'llash va kapillyarlik: 3 ta nay (0,25 / 0,5 / 1 mm) va radiusi sahnada o'zgaradigan nay; plastinkadagi tomchi
//    (chegaraviy burchak θ); simobda pasayish.
// 3) Tomchilar usuli: byuretkadan tomchilar uziladi (mg = πdσ), sanaladi, tarozida tortiladi → σ = Mg/(πdN).
// Fizika: surface-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { createSurfaceLab, dropLanding, dropStart } from './surface-lab-3d.js?v=20261123-batch8d';
import { bindLabCamera } from './lab-3d.js?v=20261123-batch8d';
import { detailedStageHeight } from './apparatus-3d.js?v=20261123-batch8d';
import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./surface-physics.js";
import { drawFilm, drawCap, drawDrops, lastFrame } from "./surface-plots.js";

const $ = (s) => document.querySelector(s);
const FIXED_R = [0.25e-3, 0.5e-3, 1e-3];
const X_MAX = 0.1; // ramka uzunligi, m
const N_MAX = 60;  // tajribada tomchilar soni

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "film", hover: null, speed: 1 };
const st = { liq: "soap", t: 20 };
const film = { L: 0.05, x: 0.05, x0: 0.03 };
const cap = { r: 0.5e-3 };
const drops = { d: 2e-3, N: 0, M: 0, grow: 0, falling: [], pts: [{ N: 0, M: 0 }], open: false };
let presetId = null, running = false;

const L = () => P.LIQUIDS[st.liq];
const sigma = () => P.sigmaAt(st.liq, ui.mode === "drops" ? 20 : st.t);
const balanceMg = (kg) => Math.round(kg * 1e6); // tarozi: 1 mg

/* ------------------------------------------------------------------ Chizish va grafik */

const scene = createSurfaceLab();
function draw(ctx, s) { scene.draw(ctx,s,ui,st,film,cap,drops,sigma()); }

const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.42, 300, 350)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "film") return drawFilm(ctx, gs, { sigma: sigma(), L: film.L, x0: film.x0, x: film.x, xMax: X_MAX, hover: ui.hover });
  if (ui.mode === "cap") return drawCap(ctx, gs, { liq: st.liq, r: cap.r, t: st.t, hover: ui.hover });
  return drawDrops(ctx, gs, { pts: drops.pts, sigma: sigma(), d: drops.d, Nmax: N_MAX, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  film: ["Dinamometr ko‘rsatishi F(x)", "Pardani cho‘zganda kuch o‘zgarmaydi (prujinadan farqli): parda yupqalashmaydi, yangi molekulalar sirtga chiqadi. Bo‘yalgan yuza — bajarilgan ish A = σΔS."],
  cap: ["Kapillyar ko‘tarilish h(r)", "Nay qancha ingichka bo‘lsa, suyuqlik shuncha baland ko‘tariladi: h ∝ 1/r. Ho‘llamaydigan simob esa pasayadi. Shtrix — boshqa suyuqliklar."],
  drops: ["Tomchilar massasi M(N)", "Har bir tomchi bir xil massada uziladi (mg = πdσ), shuning uchun M tomchilar soniga proporsional. Chiziq qiyaligi — bitta tomchi massasi."],
};
function setTab() { const t = TABS[ui.mode]; $("[data-tabs]").innerHTML = ""; $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render(); }

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;

function updateReadouts() {
  const Lq = L(), s = sigma();
  if (ui.mode === "film") {
    const F = P.filmForce(s, film.L), dS = 2 * film.L * Math.abs(film.x - film.x0);
    setRO("r1", "Sirt taranglik koeffitsiyenti <i>σ</i>", u(fmt(s * 1000, 1), "mN/m"), `${Lq.name}, ${fmt(st.t, 0)} °C`);
    setRO("r2", "To‘sin uzunligi <i>L</i>", u(fmt(film.L * 100, 1), "cm"), "parda ikki sirtli: chegara 2L");
    setRO("r3", "Dinamometr <i>F = 2σL</i>", u(fmt(F * 1000, 2), "mN"), "x ga bog‘liq emas", "orange");
    setRO("r4", "Parda yuzasi <i>S</i>", u(fmt(2 * film.L * film.x * 1e4, 1), "cm²"), "ikki sirt: S = 2Lx");
    setRO("r5", "Yuza o‘zgarishi <i>ΔS</i>", u(fmt(dS * 1e4, 1), "cm²"), `to‘sin ${fmt(film.x0 * 100, 1)} → ${fmt(film.x * 100, 1)} cm`);
    setRO("r6", "Ish <i>A = σΔS</i>", u(fmt(s * dS * 1e6, 2), "μJ"), "= F·Δx — sirt energiyasi ortishi");
    return;
  }
  if (ui.mode === "cap") {
    const h = P.capillaryH(s, Lq.rho, cap.r, Lq.theta);
    setRO("r1", "Sirt taranglik <i>σ</i>", u(fmt(s * 1000, 1), "mN/m"), `${Lq.name}, ${fmt(st.t, 0)} °C`);
    setRO("r2", "Zichlik <i>ρ</i>", u(fmt(Lq.rho, 0), "kg/m³"), "");
    setRO("r3", "Chegaraviy burchak <i>θ</i>", u(fmt(Lq.theta / P.DEG, 0), "°"), P.wets(Lq.theta) ? "shishani ho‘llaydi" : "shishani ho‘llamaydi");
    setRO("r4", "Nay radiusi <i>r</i>", u(fmt(cap.r * 1000, 2), "mm"), "o‘ngdagi (o‘zgaruvchan) nay");
    setRO("r5", "Ko‘tarilish <i>h</i>", u(fmt(h * 1000, 1), "mm"), h >= 0 ? "h = 2σcosθ/(ρgr)" : "manfiy — sath pasayadi", "orange");
    setRO("r6", "Menisk", P.wets(Lq.theta) ? "botiq" : "qavariq", P.wets(Lq.theta) ? "suyuqlik devorga tortiladi" : "suyuqlik devordan qochadi");
    return;
  }
  const M = balanceMg(drops.M) / 1e6, sg = drops.N > 0 && M > 0 ? P.sigmaFromDrops(M, drops.N, drops.d) : null;
  setRO("r1", "Tomchilar soni <i>N</i>", u(drops.N, "ta"), drops.open ? "tomizilmoqda" : "jo‘mrak yopiq");
  setRO("r2", "Tomchilar massasi <i>M</i>", u(balanceMg(drops.M), "mg"), "tarozida (1 mg aniqlik)");
  setRO("r3", "Bitta tomchi <i>m = M/N</i>", drops.N ? u(fmt((M / drops.N) * 1e6, 2), "mg") : "—", `nazariy: πdσ/g = ${fmt(P.dropMass(s, drops.d) * 1e6, 2)} mg`);
  setRO("r4", "Naycha uchi <i>d</i>", u(fmt(drops.d * 1000, 1), "mm"), "uzilish chegarasi uzunligi πd");
  setRO("r5", "O‘lchangan <i>σ = Mg/(πdN)</i>", sg ? u(fmt(sg * 1000, 1), "mN/m") : "—", sg ? `farqi ${fmt(((sg - s) / s) * 100, 1)} %` : "tomizing", "orange");
  setRO("r6", "Jadvalda <i>σ</i>", u(fmt(s * 1000, 1), "mN/m"), `${Lq.name}, 20 °C`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "film") { t = `F = ${fmt(P.filmForce(sigma(), film.L) * 1000, 2)} mN`; tone = "purple"; }
  else if (ui.mode === "cap") { const h = P.capillaryH(sigma(), L().rho, cap.r, L().theta); t = h >= 0 ? "Suyuqlik ko‘tariladi" : "Suyuqlik pasayadi"; tone = h >= 0 ? "green" : "orange"; }
  else { t = drops.N >= N_MAX ? `Tajriba tugadi: ${N_MAX} tomchi` : drops.open ? "Tomizilmoqda" : "Jo‘mrakni oching"; tone = drops.N >= N_MAX ? "green" : drops.open ? "orange" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "film") {
    p.push("<p>Suyuqlik ichidagi molekulani qo‘shnilari har tomondan bir xil tortadi, sirtdagisini esa faqat ichkariga. Shuning uchun suyuqlik sirti tortilgan parda kabi qisqarishga intiladi — <b>sirt tarangligi</b>. Sirt chegarasining har metriga ta’sir qiluvchi kuch — sirt taranglik koeffitsiyenti σ.</p>");
    p.push("<p>Sovun pardasining ikki sirti bor, shuning uchun to‘sinni tortuvchi kuch F = 2σL. Parda cho‘zilganda kuch o‘zgarmaydi; bajarilgan ish sirt energiyasining ortishiga ketadi: A = σΔS. Temperatura ortsa σ kamayadi — issiq suv kirni yaxshiroq yuvadi.</p>");
  } else if (ui.mode === "cap") {
    const Lq = L();
    p.push(P.wets(Lq.theta) ? `<p>${Lq.name} shishani <b>ho‘llaydi</b>: suyuqlik molekulalarini shisha molekulalari o‘zaro tortilishidan kuchliroq tortadi. Ingichka nayda sirt botiq bo‘ladi va sirt taranglik kuchi suyuqlik ustunini yuqoriga tortadi — <b>kapillyar ko‘tarilish</b>: h = 2σcosθ/(ρgr).</p>` : "<p>Simob shishani <b>ho‘llamaydi</b> (θ ≈ 140°): sirt qavariq bo‘ladi va sirt taranglik kuchi ustunni pastga itaradi — nayda simob sathi idishdagidan past.</p>");
    p.push("<p>Kapillyar hodisalar: o‘simlik tanasida suv va oziq moddalarning ko‘tarilishi, sochiq va qog‘ozning suvni shimishi, chiroq piligi, tuproqda namlik harakati.</p>");
  } else {
    p.push("<p>Naycha uchida tomchi o‘sib boradi. Uni sirt taranglik kuchi ushlab turadi: F = σ·πd (naycha aylanasi bo‘yicha). Tomchi og‘irligi shu kuchdan oshganda u uziladi: <b>mg = πdσ</b>. N ta tomchi massasini tortib, σ = Mg/(πdN) topiladi — darslikdagi laboratoriya ishining usuli.</p>");
    p.push("<p>Spirt kabi σ kichik suyuqliklar mayda tomchilar hosil qiladi; tomchilar ko‘p sanalsa — tarozining 1 mg xatoligi nisbatan kamayadi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() { const html = ui.mode === "film" ? "<small>Parda</small> F = 2σL, A = σΔS" : ui.mode === "cap" ? "<small>Kapillyarlik</small> h = 2σcosθ/(ρgr)" : "<small>Tomchilar usuli</small> σ = Mg/(πdN)"; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt (tomchilar) */

let uiTimer = 0;
function addDrop() { drops.N++; drops.M += P.dropMass(sigma(), drops.d); drops.pts.push({ N: drops.N, M: balanceMg(drops.M) }); }
const loop = createLoop((dt) => {
  if (ui.mode !== "drops") { loop.stop(); return; }
  if (!(dt > 0)) return;
  if (drops.open && drops.N + drops.falling.length < N_MAX) { drops.grow += dt * 1.6 * ui.speed; if (drops.grow >= 1) { drops.grow = 0; drops.falling.push({ y: dropStart(sigma(),drops.d,L().rho), v: 0 }); } }
  for (const f of drops.falling) { f.v -= 9.81 * dt; f.y += f.v * dt; }
  const landed = drops.falling.filter((f) => f.y <= dropLanding(drops.N)); drops.falling = drops.falling.filter((f) => f.y > dropLanding(drops.N));
  landed.forEach(addDrop);
  if (drops.N >= N_MAX && !drops.falling.length) { drops.open = false; drops.grow = 0; }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; refresh(); }
  if (!drops.open && !drops.falling.length) { loop.stop(); refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.hidden = ui.mode !== "drops";
  playBtn.setAttribute("aria-pressed", String(drops.open));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(drops.open ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = drops.open ? "Yopish" : "Tomizish";
}
function toggleCock() {
  if (drops.N >= N_MAX) resetDrops();
  drops.open = !drops.open; customized();
  if (drops.open && prefersReducedMotion()) { while (drops.N < N_MAX) addDrop(); drops.open = false; }
  else if (drops.open) loop.start();
  setPlayUI(loop.running); refresh();
}
playBtn.addEventListener("click", toggleCock);
function resetDrops() { drops.N = 0; drops.M = 0; drops.grow = 0; drops.falling = []; drops.pts = [{ N: 0, M: 0 }]; drops.open = false; }
$("[data-reset]").addEventListener("click", () => { if (ui.mode === "drops") { loop.stop(); resetDrops(); setPlayUI(false); } else if (ui.mode === "film") { film.x0 = film.x; } refresh(); });
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));

/* ------------------------------------------------------------------ Boshqaruv */

const liqSel = $("#liq");
const liqList = () => (ui.mode === "film" ? ["soap", "water", "alcohol", "glycerin"] : ui.mode === "cap" ? Object.keys(P.LIQUIDS) : ["water", "alcohol", "glycerin", "kerosene", "soap"]);
function fillLiq() { liqSel.innerHTML = liqList().map((k) => `<option value="${k}">${P.LIQUIDS[k].name} (σ = ${fmt(P.LIQUIDS[k].sigma * 1000, 1)} mN/m)</option>`).join(""); if (!liqList().includes(st.liq)) st.liq = liqList()[0]; liqSel.value = st.liq; }
liqSel.addEventListener("change", () => { st.liq = liqSel.value; customized(); if (ui.mode === "drops") { loop.stop(); resetDrops(); setPlayUI(false); } refresh(); });
const tC = bindRange($("#temp"), $("#tempOut"), (v) => `${fmt(v, 0)} °C`, (v) => { st.t = v; customized(); refresh(); });
const fLC = bindRange($("#fL"), $("#fLOut"), (v) => `${fmt(v, 1)} cm`, (v) => { film.L = v / 100; customized(); refresh(); });
const fXC = bindRange($("#fX"), $("#fXOut"), (v) => `${fmt(v, 1)} cm`, (v) => { film.x = v / 100; customized(); refresh(); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v, 2)} mm`, (v) => { cap.r = v / 1000; customized(); refresh(); });
const dDC = bindRange($("#dD"), $("#dDOut"), (v) => `${fmt(v, 1)} mm`, (v) => { drops.d = v / 1000; customized(); loop.stop(); resetDrops(); setPlayUI(false); refresh(); });

/* Hajmli sahnada surish va 360° kamera. */
let drag=null;
const ptr=(cv,e)=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
bindLabCamera(stage.canvas,scene.lab,()=>stage.render(),{
 start(id,p){
   if(id==='cock'){toggleCock();return;}
   drag={id,x:p.x,value:id==='radius'?cap.r:id==='tip'?drops.d:st.t};
   if(id==='bar')film.x0=film.x;
   customized();
 },move(id,p){
   if(!drag||drag.id!==id)return;
   if(id==='bar'){film.x=clamp(Math.round(scene.parameter(id,p)*1000)/1000,.01,.09);fXC.set(film.x*100);}
   else if(id==='length'){film.L=clamp(Math.round(scene.parameter(id,p)*200)/200,.02,.08);fLC.set(film.L*100);}
   else if(id==='radius'){cap.r=clamp(Math.round((drag.value+(p.x-drag.x)*.0019/180)*20000)/20000,.0001,.002);cRC.set(cap.r*1000);}
   else if(id==='tip'){drops.d=clamp(Math.round((drag.value+(p.x-drag.x)*.003/180)*10000)/10000,.001,.004);dDC.set(drops.d*1000);loop.stop();resetDrops();setPlayUI(false);}
   else if(id==='temp'){st.t=clamp(Math.round(drag.value+(p.x-drag.x)*90/180),0,90);tC.set(st.t);}
   refresh();
 },end(){drag=null;}
});

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? ((p.x - r.x) / r.w) * f.xMax : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  soapFrame: { mode: "film", title: "Sovun pardasi va ramka", lesson: "To‘sinni o‘ngga suring: parda cho‘ziladi, lekin dinamometr ko‘rsatishi o‘zgarmaydi — F = 2σL = 4 mN. Bo‘yalgan yuza (grafik) — bajarilgan ish.", set: () => { Object.assign(st, { liq: "soap", t: 20 }); Object.assign(film, { L: 0.05, x: 0.06, x0: 0.03 }); } },
  longBar: { mode: "film", title: "Uzun to‘sin: kuch ortadi", lesson: "To‘sin 2 marta uzun (8 cm) — sirt chegarasi uzun, kuch ham 2 marta katta: F ∝ L.", set: () => { Object.assign(st, { liq: "soap", t: 20 }); Object.assign(film, { L: 0.08, x: 0.05, x0: 0.05 }); } },
  hotFilm: { mode: "film", title: "Iliq sovunli suv", lesson: "70 °C da sovunli suvning σ si kamaygan — parda to‘sinni kuchsizroq tortadi. Temperaturani o‘zgartirib kuzating.", set: () => { Object.assign(st, { liq: "soap", t: 70 }); Object.assign(film, { L: 0.05, x: 0.05, x0: 0.05 }); } },
  capWater: { mode: "cap", title: "Suv kapillyar naylarda", lesson: "Suv shishani ho‘llaydi — barcha naylarda ko‘tariladi; 0,25 mm li nayda 59 mm, 1 mm li nayda atigi 15 mm: h ∝ 1/r. O‘ngdagi nay radiusini sahnada o‘zgartiring.", set: () => { Object.assign(st, { liq: "water", t: 20 }); cap.r = 0.5e-3; } },
  capAlcohol: { mode: "cap", title: "Spirt pastroq ko‘tariladi", lesson: "Spirtning σ si suvnikidan 3,3 marta kichik, zichligi ham kichik — u suvdan ≈ 2,6 marta past ko‘tariladi.", set: () => { Object.assign(st, { liq: "alcohol", t: 20 }); cap.r = 0.5e-3; } },
  capMercury: { mode: "cap", title: "Simob: ho‘llamaslik", lesson: "Simob shishani ho‘llamaydi: menisk qavariq, nayda sath pasayadi. Tomchi plastinkada sharsimon yig‘iladi.", set: () => { Object.assign(st, { liq: "mercury", t: 20 }); cap.r = 0.5e-3; } },
  capThin: { mode: "cap", title: "Juda ingichka nay: o‘simliklar", lesson: "Radiusi 0,1 mm nayda suv 15 cm ga ko‘tariladi (sahnada sig‘magani uchun kesib ko‘rsatilgan). O‘simlik tomirlari bundan ham ingichka.", set: () => { Object.assign(st, { liq: "water", t: 20 }); cap.r = 0.1e-3; } },
  drops: { mode: "drops", title: "Suv: tomchilar usuli", lesson: "Jo‘mrakni oching: 60 ta tomchi sanalib, massasi tortiladi. σ = Mg/(πdN) ni jadvaldagi 72,8 mN/m bilan solishtiring. Bu — darslikdagi «Sirt taranglik koeffitsiyentini aniqlash» laboratoriya ishining usuli.", set: () => { Object.assign(st, { liq: "water" }); drops.d = 2e-3; resetDrops(); } },
  dropsAlcohol: { mode: "drops", title: "Spirt tomchilari", lesson: "Spirt tomchilari suvnikidan 3,3 marta yengil — σ kichik.", set: () => { Object.assign(st, { liq: "alcohol" }); drops.d = 2e-3; resetDrops(); } },
  dropsTip: { mode: "drops", title: "Keng naycha: katta tomchilar", lesson: "Naycha uchi diametri 3,5 mm: tomchi og‘irroq bo‘lgandagina uziladi (m ∝ d), σ esa o‘sha natijani beradi.", set: () => { Object.assign(st, { liq: "water" }); drops.d = 3.5e-3; resetDrops(); } },
};
const GROUPS = [["Sirt tarangligi", ["soapFrame", "longBar", "hotFilm"]], ["Ho‘llash va kapillyarlik", ["capWater", "capAlcohol", "capMercury", "capThin"]], ["Tomchilar usuli", ["drops", "dropsAlcohol", "dropsTip"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { film: "To‘sinni suring", cap: "O‘ngdagi nay tutqichini suring", drops: "Jo‘mrakni bosing" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { film: "Sovun pardali ramka va dinamometr", cap: "Suyuqlikka tushirilgan kapillyar naylar va plastinkadagi tomchi", drops: "Byuretka, tomchilar va tarozidagi stakan" }[ui.mode]);
}
const MODE_DEFAULT = { film: "soapFrame", cap: "capWater", drops: "drops" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  loop.stop(); drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  fillLiq(); tC.set(st.t); fLC.set(film.L * 100); fXC.set(film.x * 100); cRC.set(cap.r * 1000); dDC.set(drops.d * 1000);
  setTab(); setPlayUI(false); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "soapFrame");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
