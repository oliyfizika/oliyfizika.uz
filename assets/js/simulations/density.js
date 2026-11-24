// ==========================================================================
// Massa, zichlik va suzish — virtual laboratoriya (simulations/density.html)
// 1) Massa: pallali tarozi; chap pallada jism, o'ng pallaga gira toshlari (100 g … 100 mg) sahnada suriladi.
// 2) Zichlik: elektron tarozi (m) va menzurka (V₂ − V₁, lupa bilan 2 mL bo'lim); ρ = m/V va jadvaldan modda.
// 3) Suzish: dinamometrga osilgan brusok suyuqlikka botiriladi (dinamometr sahnada suriladi), F_A, ipni kesish.
// Fizika: density-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { createDensityLab } from "./density-lab-3d.js?v=20261123-batch6d";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch6d";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch6d";
import * as P from "./density-physics.js";
import { drawTable, drawForces, lastFrame } from "./density-plots.js";

const $ = (s) => document.querySelector(s);
const BODIES = {
  cu: { name: "Mis silindr", mat: "copper", m: 89.0, V: 10, shape: "cyl" },
  al: { name: "Alyuminiy brusok", mat: "alu", m: 54.0, V: 20, shape: "box" },
  st: { name: "Po‘lat sharcha", mat: "steel", m: 31.2, V: 4, shape: "ball" },
  gr: { name: "Granit bo‘lagi", mat: "granite", m: 78.0, V: 30, shape: "rock" },
  zn: { name: "Rux bo‘lagi", mat: "zinc", m: 63.9, V: 9, shape: "rock" },
  unk: { name: "Noma’lum metall silindr", mat: "lead", m: 113.0, V: 10, shape: "cyl" },
  wd: { name: "Yog‘och brusok", mat: "wood", m: 24.0, V: 48, shape: "box" },
};
const FBODY = { A: 16, H: 5 }; // suzish: 4 × 4 × 5 cm brusok
const F_MATS = ["cork", "wood", "ice", "paraffin", "egg", "plastic", "alu", "steel", "copper", "lead"];
const TABLE_KEYS = ["cork", "wood", "ice", "egg", "glass", "granite", "alu", "zinc", "steel", "copper", "silver", "lead", "gold"];
const DEPTH = 10; // idish chuqurligi (suyuqlik), cm

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "mass", tab: "tab", hover: null };
const mass = { body: "cu", pan: [], th: 0, w: 0 };
const dens = { body: "cu", V1: 100, inCyl: false, drop: 0 };
const fl = { mat: "alu", liq: "water", d: 0, free: false, y: 0, v: 0 };
let presetId = null, running = false;
let drag = null;
const wLabel = wg => wg >= 1 ? `${fmt(wg,0)} g` : `${fmt(wg*1000,0)} mg`;

const panMass = () => P.sumWeights(mass.pan.map((i) => P.WEIGHTS[i]));
const bodyM = (k) => BODIES[k].m;
const flM = () => P.MATERIALS[fl.mat].rho * FBODY.A * FBODY.H;
const flRhoL = () => P.LIQUIDS[fl.liq].rho;
/** Jismning haqiqiy botish chuqurligi (cm): ip bilan — dinamometr, suzsa ortiqcha botmaydi; erkin — dinamikadan */
function flDepth() {
  if (fl.free) return fl.y;
  const fd = P.floatDepth({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() });
  return fd !== null ? Math.min(fl.d, fd) : fl.d;
}
const flCfg = () => ({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL(), d: flDepth() });

/* ------------------------------------------------------------------ Uch o‘lchamli tajriba */
const scene = createDensityLab();
function draw(ctx, st) { scene.draw(ctx, st, ui, mass, dens, fl, BODIES, flCfg(), drag); }
const heights = () => ({ graph: Math.round(clamp(innerHeight*.3,220,280)) });
const stage = createStage($("#stage"), draw, {height:detailedStageHeight});

function drawGraphCanvas(ctx, gst) {
  if (ui.mode === "dens") {
    const B = BODIES[dens.body], Vr = P.readCylinder(dens.V1 + B.V) - P.readCylinder(dens.V1);
    return drawTable(ctx, gst, { keys: TABLE_KEYS, measured: dens.inCyl ? B.m / Vr : null, liquid: null, hover: ui.hover });
  }
  if (ui.mode === "float") {
    if (ui.tab === "tab") return drawTable(ctx, gst, { keys: F_MATS.concat(["glass"]).filter((k, i, a) => a.indexOf(k) === i), measured: P.MATERIALS[fl.mat].rho, liquid: flRhoL(), hover: ui.hover });
    return drawForces(ctx, gst, { ...flCfg(), d: fl.free ? flDepth() : fl.d, dMax: 8, hover: ui.hover });
  }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

const TABS = {
  mass: {},
  dens: { tab: ["Moddalar zichligi jadvali", "O‘lchangan zichlik (sariq shtrix) jadvaldagi qaysi moddaga eng yaqin? Kursor bilan qiymat o‘qing."] },
  float: { F: ["Kuchlar va botish chuqurligi", "Jism botgan sari Arximed kuchi ortadi va dinamometr ko‘rsatishi kamayadi. To‘liq botgandan keyin ikkalasi ham o‘zgarmaydi. Kursor bilan qiymat o‘qing."], tab: ["Jism va suyuqlik zichligi", "Jism zichligi suyuqlikniki­dan kichik bo‘lsa — suzadi, katta bo‘lsa — cho‘kadi. Ko‘k shtrix — suyuqlik zichligi."] },
};
const TAB_LABEL = { tab: "Zichliklar", F: "F(h)" };
function setTab(tab) {
  const keys = Object.keys(TABS[ui.mode]), card = $(".sim-graph");
  card.hidden = !keys.length; if (!keys.length) return;
  ui.tab = TABS[ui.mode][tab] ? tab : keys[0];
  const t = TABS[ui.mode][ui.tab];
  $("[data-tabs]").innerHTML = keys.length > 1 ? keys.map((k) => `<button type="button" data-tab-value="${k}" aria-pressed="${k === ui.tab}">${TAB_LABEL[k]}</button>`).join("") : "";
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1];
  graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (b) setTab(b.dataset.tabValue); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;

function updateReadouts() {
  if (ui.mode === "mass") {
    const m = bodyM(mass.body), s = panMass(), dm = s - m, bal = P.balanceAngle(dm) === 0;
    setRO("r1", "Chap pallada", BODIES[mass.body].name, "massasi noma’lum — tortib aniqlang");
    setRO("r2", "O‘ng pallada toshlar", u(fmt(s, 1), "g"), mass.pan.length ? mass.pan.map((i) => wLabel(P.WEIGHTS[i])).join(" + ") : "toshlar yo‘q");
    setRO("r3", "Tarozi holati", bal ? "muvozanat" : dm < 0 ? "chap og‘ir" : "o‘ng og‘ir", bal ? "momentlar teng" : dm < 0 ? "tosh qo‘shing" : "eng kichik toshlardan oling", bal ? "orange" : "");
    setRO("r4", "Jism massasi <i>m</i>", bal ? u(fmt(s, 1), "g") : "?", bal ? `= ${fmt(s / 1000, 4)} kg = ${fmt(s * 1000, 0)} mg` : "muvozanatga keltiring");
    setRO("r5", "Tarozi aniqligi", u("50", "mg"), "eng kichik tosh 100 mg");
    setRO("r6", "Og‘irlik <i>P = mg</i>", bal ? u(fmt(P.weight(s), 3), "N") : "?", "g = 9,81 N/kg");
    return;
  }
  if (ui.mode === "dens") {
    const B = BODIES[dens.body], V1 = P.readCylinder(dens.V1), V2 = P.readCylinder(dens.V1 + (dens.inCyl ? B.V : 0)), V = V2 - V1, rho = dens.inCyl && V > 0 ? B.m / V : null, id = rho ? P.identify(rho) : null;
    setRO("r1", "Massa <i>m</i>", u(fmt(B.m, 1), "g"), "elektron tarozida");
    setRO("r2", "Suv hajmi <i>V₁</i>", u(V1, "mL"), "jismsiz");
    setRO("r3", "Suv + jism <i>V₂</i>", dens.inCyl ? u(V2, "mL") : "?", dens.inCyl ? "menzurka shkalasi bo‘yicha" : "jismni menzurkaga soling");
    setRO("r4", "Jism hajmi <i>V</i>", dens.inCyl ? u(V, "cm³") : "?", "V = V₂ − V₁ (1 mL = 1 cm³)");
    setRO("r5", "Zichlik <i>ρ = m/V</i>", rho ? u(fmt(rho, 2), "g/cm³") : "?", rho ? `= ${fmt(rho * 1000, 0)} kg/m³` : "", "orange");
    setRO("r6", "Jadval bo‘yicha", id ? id.mat.name : "?", id ? `${fmt(id.mat.rho, 1)} g/cm³, farqi ${fmt(id.err * 100, 1)} %` : "zichlikni o‘lchang");
    return;
  }
  const cfg = flCfg(), b = P.buoyancy(cfg), mg = P.weight(cfg.m), read = fl.free ? 0 : P.springReading(cfg), fd = P.floatDepth({ m: cfg.m, A: FBODY.A, H: FBODY.H, rhoL: cfg.rhoL });
  setRO("r1", "Havodagi og‘irlik <i>P</i>", u(fmt(mg, 3), "N"), `m = ${fmt(cfg.m, 0)} g`);
  setRO("r2", "Dinamometr", u(fmt(read, 3), "N"), fl.free ? "ip kesilgan" : read < 1e-6 ? "ip bo‘shashgan — jism suzmoqda" : "P − F_A", "orange");
  setRO("r3", "Arximed kuchi <i>F<sub>A</sub></i>", u(fmt(b.FA, 3), "N"), `ρ_s·g·V_bot`);
  setRO("r4", "Botgan hajm <i>V<sub>bot</sub></i>", u(fmt(b.Vsub, 1), "cm³"), `h = ${fmt(cfg.d, 2)} cm (jism 80 cm³)`);
  setRO("r5", "Zichliklar", `${fmt(P.MATERIALS[fl.mat].rho, 2)} / ${fmt(cfg.rhoL, 2)}`, "jism / suyuqlik, g/cm³");
  setRO("r6", "Natija", fd !== null ? "suzadi" : "cho‘kadi", fd !== null ? `${fmt((fd / FBODY.H) * 100, 0)} % botib suzadi (ρ_j/ρ_s)` : `suvda «yengillashadi»: ${fmt((b.FA / mg) * 100, 0)} %`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "mass") { const bal = P.balanceAngle(panMass() - bodyM(mass.body)) === 0; t = bal ? "Muvozanat" : "Muvozanatga keltiring"; tone = bal ? "green" : "blue"; }
  else if (ui.mode === "dens") { t = dens.inCyl ? "Hajm o‘lchandi" : "Jismni menzurkaga soling"; tone = dens.inCyl ? "green" : "blue"; }
  else { const fd = P.floatDepth({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() }); t = fl.free ? (fd !== null ? "Jism suzmoqda" : "Jism cho‘kdi") : flDepth() <= 0 ? "Jism havoda" : "Jism suyuqlikda"; tone = fl.free ? (fd !== null ? "green" : "orange") : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "mass") {
    p.push("<p><b>Massa</b> — jismning inertligi o‘lchovi; SI birligi — kilogramm. Pallali (richagli) tarozida jism massasi ma’lum massali <b>toshlar (gira)</b> bilan taqqoslanadi: elkalar teng bo‘lgani uchun muvozanatda palladagi massalar teng.</p>");
    p.push("<p>Tortish tartibi: avval eng katta toshni qo‘ying; agar o‘ng palla og‘ir bo‘lsa — uni olib, kichikrog‘ini qo‘ying. Shunday qilib kichik toshlargacha davom eting. Massa — barcha toshlar yig‘indisi.</p>");
  } else if (ui.mode === "dens") {
    const B = BODIES[dens.body];
    p.push("<p><b>Zichlik</b> — birlik hajmdagi massa: ρ = m/V. Bir xil moddadan yasalgan jismlarning zichligi bir xil, shuning uchun zichlik bo‘yicha moddani aniqlash mumkin.</p>");
    p.push("<p>Noto‘g‘ri shakldagi jism hajmini <b>menzurka</b> bilan o‘lchaymiz: jism botirilganda suv sathi uning hajmicha ko‘tariladi, V = V₂ − V₁. Shkala bo‘limi 2 mL — o‘lchash xatoligi ±1 mL; kichik jismlarda nisbiy xato kattaroq.</p>");
    if (B.mat === "wood") p.push("<p>Yog‘och suvda suzadi, shuning uchun uni ingichka igna bilan to‘liq botirib hajmini o‘lchaymiz.</p>");
  } else {
    p.push("<p>Suyuqlikka botirilgan jismga yuqoriga yo‘nalgan <b>itaruvchi (Arximed) kuch</b> ta’sir qiladi: u jism siqib chiqargan suyuqlik og‘irligiga teng, F_A = ρ_s·g·V_bot. Shuning uchun dinamometr suvda kamroq ko‘rsatadi.</p>");
    p.push(`<p><b>Suzish sharti</b>: agar jism zichligi suyuqlik zichligidan kichik bo‘lsa — jism suzadi va shunchalik botadiki, F_A = mg bo‘ladi; botgan qism ulushi ρ_jism/ρ_s. ${fl.mat === "ice" ? "Muz suvda 90 % botadi — aysbergning faqat o‘ndan bir qismi ko‘rinadi." : fl.mat === "egg" ? "Tuxum chuchuk suvdan og‘irroq, lekin to‘yingan sho‘r suvdan yengil — sho‘r suvda suzadi." : ""}</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "mass" ? "<small>Tarozi</small> m<sub>jism</sub> = Σ m<sub>tosh</sub>" : ui.mode === "dens" ? "<small>Zichlik</small> ρ = m/V" : "<small>Arximed kuchi</small> F<sub>A</sub> = ρ<sub>s</sub>gV";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); if (!$(".sim-graph").hidden) graph.render(); }

/* ------------------------------------------------------------------ Vaqt (tarozi tebranishi, jism tushishi, erkin jism) */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  let moving = false;
  if (ui.mode === "mass") {
    const target = P.balanceAngle(panMass() - bodyM(mass.body));
    mass.w += (-(mass.th - target) * 60 - mass.w * 5) * dt; mass.th += mass.w * dt;
    moving = Math.abs(mass.th - target) > 1e-4 || Math.abs(mass.w) > 1e-3;
    if (!moving) { mass.th = target; mass.w = 0; }
  } else if (ui.mode === "dens") {
    if (dens.inCyl && dens.drop > 0) { dens.drop = Math.max(0, dens.drop - dt * 1.6); moving = true; }
  } else if (fl.free) {
    const cfg = { m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() }, mkg = cfg.m / 1000;
    const Fnet = P.weight(cfg.m) - P.buoyancy({ ...cfg, d: fl.y }).FA; // pastga musbat
    fl.v += ((Fnet / mkg) * 100 - fl.v * 24) * dt * 0.25; // cm/s, sekinlashtirilgan; suyuqlik qarshiligi (so'nish ≈ 0,4)
    fl.y += fl.v * dt;
    if (fl.y > DEPTH) { fl.y = DEPTH; fl.v = 0; } // tubga yetdi
    if (fl.y < 0 && fl.v < 0) { fl.y = 0; fl.v = 0; }
    moving = Math.abs(fl.v) > 0.01 || Math.abs(Fnet) > 1e-3 && fl.y < DEPTH;
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; refresh(); }
  if (!moving) { loop.stop(); refresh(); }
}, { onStateChange: setPlayUI });
const kick = () => { if (prefersReducedMotion()) { settle(); refresh(); } else loop.start(); };
function settle() {
  mass.th = P.balanceAngle(panMass() - bodyM(mass.body)); mass.w = 0; dens.drop = 0;
  if (fl.free) { const fd = P.floatDepth({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() }); fl.y = fd !== null ? fd : DEPTH; fl.v = 0; }
}
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.hidden = true; // bu sahifada animatsiya o'zi boshqariladi
}
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "mass") mass.pan = [];
  else if (ui.mode === "dens") { dens.inCyl = false; dens.drop = 0; }
  else { fl.free = false; fl.d = 0; fl.y = 0; fl.v = 0; fDC.set(0); }
  kick(); refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const bodySel = $("#body");
bodySel.innerHTML = Object.entries(BODIES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
bodySel.addEventListener("change", () => { customized(); if (ui.mode === "mass") { mass.body = bodySel.value; mass.pan = []; } else { dens.body = bodySel.value; dens.inCyl = false; } kick(); refresh(); });
const wBox = $("[data-weights]");
wBox.innerHTML = P.WEIGHTS.map((wg, i) => `<button class="sim-preset" type="button" data-w="${i}" aria-pressed="false">${wLabel(wg)}</button>`).join("");
wBox.addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (!b) return; toggleWeight(+b.dataset.w); });
function toggleWeight(i) { customized(); if (mass.pan.includes(i)) mass.pan = mass.pan.filter((x) => x !== i); else mass.pan.push(i); syncWeights(); kick(); refresh(); }
const syncWeights = () => document.querySelectorAll("[data-w]").forEach((b) => b.setAttribute("aria-pressed", String(mass.pan.includes(+b.dataset.w))));
$("[data-clear-weights]").addEventListener("click", () => { mass.pan = []; customized(); syncWeights(); kick(); refresh(); });
const v1C = bindRange($("#v1"), $("#v1Out"), (v) => `${fmt(v, 0)} mL`, (v) => { dens.V1 = v; customized(); refresh(); });
const fMat = $("#fMat"), fLiq = $("#fLiq");
fMat.innerHTML = F_MATS.map((k) => `<option value="${k}">${P.MATERIALS[k].name} (${fmt(P.MATERIALS[k].rho * 1000, 0)} kg/m³)</option>`).join("");
fLiq.innerHTML = Object.entries(P.LIQUIDS).map(([k, v]) => `<option value="${k}">${v.name} (${fmt(v.rho * 1000, 0)} kg/m³)</option>`).join("");
fMat.addEventListener("change", () => { fl.mat = fMat.value; customized(); if (fl.free) kick(); refresh(); });
fLiq.addEventListener("change", () => { fl.liq = fLiq.value; customized(); if (fl.free) kick(); refresh(); });
const fDC = bindRange($("#fD"), $("#fDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { if (fl.free) { fl.free = false; } fl.d = v; customized(); refresh(); });
function cutRope() {
  customized();
  if(fl.free){fl.free=false;fl.d=0;fDC.set(0);refresh();return;}
  const depth=flDepth();fl.free=true;fl.y=depth;fl.v=0;kick();refresh();
}
$("[data-cut]").addEventListener("click",cutRope);
function syncCut() { $("[data-cut]").textContent = fl.free ? "Jismni qayta osish" : "Ipni kesish"; }

/* Sahnada: proyeksiyalangan tushirish zonalari orbitdan keyin ham ishlaydi. */
const canvas=stage.canvas;
const ptr=(cv,e)=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
bindLabCamera(canvas,scene.lab,()=>stage.render(),{
  start(id,p){
    if(id.startsWith('pan-')){toggleWeight(+id.slice(4));return;}
    if(id==='cut'){cutRope();return;}
    drag={id,point:p,start:p,moved:false};customized();
    if(id.startsWith('weight-'))drag.i=+id.slice(7);
    if(id==='dyn'){
      if(fl.free){fl.free=false;fl.d=0;syncCut();}
      drag.offset=scene.depth(p)-fl.d;
    }
    if(id==='water')drag.offset=scene.water(p)-dens.V1;
  },
  move(id,p){
    if(!drag||drag.id!==id)return;
    drag.point=p;drag.moved ||= Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>4;
    if(id==='dyn'){fl.d=clamp(Math.round((scene.depth(p)-drag.offset)*10)/10,0,8);fDC.set(fl.d);}
    else if(id==='water'){dens.V1=clamp(Math.round((scene.water(p)-drag.offset)/2)*2,40,140);v1C.set(dens.V1);}
    refresh();
  },
  end(id,cancelled){
    if(!drag||drag.id!==id)return;
    const d=drag;drag=null;
    if(!cancelled&&id.startsWith('weight-')){if(!d.moved||scene.inPan(d.point))toggleWeight(d.i);}
    else if(!cancelled&&id==='body'){
      const into=scene.inCylinder(d.point);
      if(into&&!dens.inCyl){dens.inCyl=true;dens.drop=1;kick();}
      else if(!into&&dens.inCyl){dens.inCyl=false;dens.drop=0;}
    }
    refresh();
  }
});

/* Grafikda kursor */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) return;
  const p = ptr(gcv, e), r = f.rect;
  ui.hover = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 10 && p.y <= r.y + r.h + 10 ? (ui.tab === "F" ? ((p.x - r.x) / r.w) * f.xMax : (p.x - r.x) / r.w) : null;
  gcv.style.cursor = ui.hover !== null ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  weigh: { mode: "mass", title: "Mis silindrni tortish", lesson: "Chap pallada mis silindr. Toshlarni qutidan o‘ng pallaga suring: avval 100 g — palla og‘irlashsa, oling va 50 g qo‘ying va hokazo. Tarozi muvozanatga kelganda massani yozing.", set: () => Object.assign(mass, { body: "cu", pan: [] }) },
  weighSmall: { mode: "mass", title: "Po‘lat sharcha: milligrammlar", lesson: "Sharcha massasi butun grammga teng emas — milligrammli toshlar (500, 200, 100 mg) ham kerak bo‘ladi. Tarozi 50 mg dan kichik farqni sezmaydi.", set: () => Object.assign(mass, { body: "st", pan: [] }) },
  weighDone: { mode: "mass", title: "Tortilgan: granit bo‘lagi", lesson: "Granit bo‘lagi tortilgan: 50 + 20 + 5 + 2 + 1 = 78 g. Bitta toshni olib ko‘ring — tarozi og‘adi.", set: () => Object.assign(mass, { body: "gr", pan: [1, 2, 5, 6, 8] }) },
  copper: { mode: "dens", title: "Mis silindr zichligi", lesson: "Silindr massasi 89,0 g. Uni menzurkaga suring: suv sathi 100 mL dan 110 mL ga ko‘tariladi. ρ = 89 / 10 = 8,9 g/cm³ — jadvalda mis.", set: () => Object.assign(dens, { body: "cu", V1: 100, inCyl: false }) },
  alu: { mode: "dens", title: "Alyuminiy brusok", lesson: "54 g, hajmi menzurkada o‘lchanadi. ρ = 2,7 g/cm³ = 2700 kg/m³.", set: () => Object.assign(dens, { body: "al", V1: 80, inCyl: true, drop: 0 }) },
  stone: { mode: "dens", title: "Noto‘g‘ri shakldagi jism: granit", lesson: "Toshning hajmini chizg‘ich bilan o‘lchab bo‘lmaydi — menzurka yordam beradi. 78 g / 30 cm³ = 2,6 g/cm³ — granit.", set: () => Object.assign(dens, { body: "gr", V1: 100, inCyl: false }) },
  unknown: { mode: "dens", title: "Noma’lum metall: moddani aniqlang", lesson: "Massa va hajmni o‘lchab zichlikni hisoblang va jadvaldan moddani toping. Bu — darslikdagi «Jismlar zichligini aniqlash» laboratoriya ishining tartibi.", set: () => Object.assign(dens, { body: "unk", V1: 100, inCyl: false }) },
  zinc: { mode: "dens", title: "Shkala bo‘limi va xatolik", lesson: "Rux bo‘lagining hajmi 9 cm³, lekin menzurka bo‘limi 2 mL: o‘qilgan hajm 8 yoki 10 mL bo‘ladi va zichlik 10 % gacha xato chiqadi. Kichik jismlar uchun bo‘limi kichik menzurka kerak.", set: () => Object.assign(dens, { body: "zn", V1: 100, inCyl: true, drop: 0 }) },
  wood: { mode: "dens", title: "Yog‘och: igna bilan botirish", lesson: "Yog‘och suzadi, shuning uchun u igna bilan to‘liq botirilgan. 24 g / 48 cm³ = 0,5 g/cm³ — suvdan yengil.", set: () => Object.assign(dens, { body: "wd", V1: 100, inCyl: true, drop: 0 }) },
  archimedes: { mode: "float", title: "Arximed kuchi: alyuminiy suvda", lesson: "Havoda dinamometr 2,12 N ko‘rsatadi. Dinamometrni pastga suring: jism botgan sari ko‘rsatish kamayadi. To‘liq botganda 0,78 N ga kamaydi — bu siqib chiqarilgan 80 cm³ suv og‘irligi.", set: () => Object.assign(fl, { mat: "alu", liq: "water", d: 3, free: false }), tab: "F" },
  kerosene: { mode: "float", title: "Kerosinda Arximed kuchi kichik", lesson: "Xuddi shu brusok kerosinda: suyuqlik zichligi 800 kg/m³ — Arximed kuchi 20 % kichik, dinamometr ko‘proq ko‘rsatadi.", set: () => Object.assign(fl, { mat: "alu", liq: "kerosene", d: 6, free: false }), tab: "F" },
  woodFloat: { mode: "float", title: "Yog‘och suzadi", lesson: "Yog‘och brusok suvda yarmigacha botib suzadi: ip bo‘shashdi, dinamometr nolni ko‘rsatadi. «Ipni kesish» ni bosing.", set: () => Object.assign(fl, { mat: "wood", liq: "water", d: 5, free: false }) },
  ice: { mode: "float", title: "Muz: aysberg", lesson: "Muz zichligi 900 kg/m³ — suvda 90 % botib suzadi. Ip kesildi.", set: () => Object.assign(fl, { mat: "ice", liq: "water", d: 0, free: true, y: 0, v: 0 }) },
  egg: { mode: "float", title: "Tuxum: chuchuk va sho‘r suv", lesson: "Tuxum chuchuk suvda cho‘kadi. Suyuqlikni «Sho‘r suv (to‘yingan)» ga almashtiring — tuxum qalqib chiqadi.", set: () => Object.assign(fl, { mat: "egg", liq: "water", d: 0, free: true, y: 0, v: 0 }), tab: "tab" },
  mercury: { mode: "float", title: "Po‘lat simobda suzadi", lesson: "Simob zichligi 13 600 kg/m³ — po‘latdan ham, misdan ham katta. Shuning uchun temir buyumlar simobda suzadi, qo‘rg‘oshin ham.", set: () => Object.assign(fl, { mat: "steel", liq: "mercury", d: 0, free: true, y: 0, v: 0 }), tab: "tab" },
};
const GROUPS = [["Massa: tarozi", ["weigh", "weighSmall", "weighDone"]], ["Zichlik: menzurka", ["copper", "alu", "stone", "unknown", "zinc", "wood"]], ["Suzish", ["archimedes", "kerosene", "woodFloat", "ice", "egg", "mercury"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } syncCut(); }

const MODE_HINT = { mass: "Toshlarni o‘ng pallaga suring", dens: "Jismni menzurkaga suring", float: "Dinamometrni pastga suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { mass: "Uch o‘lchamli pallali tarozi va toshlar qutisi", dens: "Uch o‘lchamli elektron tarozi va menzurka, menisk lupasi", float: "Uch o‘lchamli dinamometr, brusok va suyuqlik idishi" }[ui.mode]);
}
function syncAll() { bodySel.value = ui.mode === "mass" ? mass.body : dens.body; syncWeights(); v1C.set(dens.V1); fMat.value = fl.mat; fLiq.value = fl.liq; fDC.set(fl.d); syncCut(); }
const MODE_DEFAULT = { mass: "weigh", dens: "copper", float: "archimedes" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || Object.keys(TABS[ui.mode])[0]);
  settle(); if (ui.mode === "mass") { mass.th = 0; }
  if (fl.free && ui.mode === "float") { fl.y = 0; fl.v = 0; }
  kick(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "weigh");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
