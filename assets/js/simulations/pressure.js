// ==========================================================================
// Bosim, Paskal qonuni va tutash idishlar — virtual laboratoriya (simulations/pressure.html)
// 1) Qattiq jism bosimi: g'isht (3 qirra, ustiga yuk), odam etikda va chang'ida, igna, traktor — qumdagi iz p ga mos.
// 2) Paskal qonuni: gidravlik press (kichik porshen sahnada pastga suriladi, katta porshen yukni ko'taradi) va Paskal shari.
// 3) Suyuqlik bosimi: idishdagi bosim datchigi (sahnada suriladi) + U-manometr, p = ρgh; tutash idishlar va suv-moy U-nay.
// Fizika: pressure-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { clamp, fmt, sci, createStage, bindRange } from "./sim-kit.js";
import { createPressureLab } from "./pressure-lab-3d.js?v=20261123-batch6b";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch6b";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch6b";
import * as P from "./pressure-physics.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const OBJ_NAMES = { brick: "G‘isht (3,5 kg)", ...Object.fromEntries(Object.entries(P.OBJECTS).map(([k, v]) => [k, v.name])) };
const TANK_H = 0.8;  // idishdagi suyuqlik chuqurligi, m
const UT_H = 0.4;    // U-nay balandligi, m
const UT_W0 = 0.2;   // U-naydagi suv sathi (moysiz), m
const BALL_S = 10e-4; // Paskal shari porsheni yuzasi, m²
const PRESS_S1MAX = 20; // kichik porshen yo'li, cm

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "solid" };
const solid = { obj: "brick", face: "flat", extra: 0 };
const pas = { view: "press", S1: 2, S2: 100, M: 200, s1: 6, F: 50, t: 0 };
const flu = { view: "depth", liq: "water", h: 0.3, x: 0.5, atm: false, rot: 0, level: 0.18, oil: 0.1 };
let presetId = null;


/* ------------------------------------------------------------------ Hisob */

function solidNow() {
  if (solid.obj === "brick") { const f = P.FACES[solid.face], m = P.BRICK.m + solid.extra; return { F: P.weightN(m), S: f.S, m, label: `G‘isht: ${f.name.toLowerCase()}` }; }
  const o = P.OBJECTS[solid.obj]; return { F: o.F ?? P.weightN(o.m), S: o.S, m: o.m ?? null, label: o.name };
}
const solidP = () => { const s = solidNow(); return P.pressure(s.F, s.S); };
const pressF1 = () => P.forceToLift(pas.M, pas.S1 * 1e-4, pas.S2 * 1e-4);
const s2 = () => P.pressLift(pas.s1, pas.S1, pas.S2); // cm
const ballP = () => P.pistonPressure(pas.F, BALL_S);
const fluP = () => P.hydro(P.LIQUIDS[flu.liq].rho, flu.h, flu.atm);
const uNow = () => P.uTube(1000, P.LIQUIDS.oil.rho, flu.oil);

/* ------------------------------------------------------------------ 3D sahna va grafik */

const scene = createPressureLab();
function draw(ctx, st) { scene.draw(ctx, st, ui, solid, pas, flu); }
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;
const paU = (p) => (p >= 1e6 ? u(sci(p, 3), "Pa") : p >= 1e4 ? u(fmt(p / 1000, 2), "kPa") : u(fmt(p, 0), "Pa"));

function updateReadouts() {
  if (ui.mode === "solid") {
    const s = solidNow(), p = P.pressure(s.F, s.S);
    setRO("r1", "Bosim kuchi <i>F</i>", s.F >= 1e4 ? u(fmt(s.F / 1000, 1), "kN") : u(fmt(s.F, 1), "N"), s.m !== null ? `og‘irlik: mg = ${fmt(s.m, 1)} kg · 9,81 N/kg` : "barmoq kuchi");
    setRO("r2", "Tayanch yuzasi <i>S</i>", s.S >= 1e-4 ? u(fmt(s.S * 1e4, 0), "cm²") : u(fmt(s.S * 1e6, 2), "mm²"), s.S >= 1e-4 ? `= ${fmt(s.S, 4)} m²` : `= ${sci(s.S, 2)} m²`);
    setRO("r3", "Bosim <i>p = F/S</i>", paU(p), p >= 1e4 && p < 1e6 ? `= ${fmt(p, 0)} Pa` : "1 Pa = 1 N/m²", "orange");
    if (solid.obj === "brick") {
      const pf = P.pressure(s.F, P.FACES.flat.S), pe = P.pressure(s.F, P.FACES.end.S);
      setRO("r4", "Yassi qo‘yilganda", paU(pf), "eng katta yuza — eng kichik bosim");
      setRO("r5", "Tik qo‘yilganda", paU(pe), `yassidan ${fmt(pe / pf, 2)} marta katta`);
    } else {
      const o = P.OBJECTS[solid.obj];
      setRO("r4", "Tayanch", o.note, "");
      const ratio = p / P.pressure(P.weightN(P.BRICK.m), P.FACES.flat.S);
      setRO("r5", "G‘isht bilan solishtiring", `${ratio >= 1000 ? sci(ratio, 2) : fmt(ratio, ratio >= 100 ? 0 : 1)} ×`, "yassi g‘isht bosimidan");
    }
    setRO("r6", "Iz", solid.obj === "needle" ? "teshadi" : p > 2e4 ? "chuqur botadi" : p > 5000 ? "botadi" : p > 2000 ? "biroz botadi" : "deyarli botmaydi", "bosim qancha katta bo‘lsa — iz shuncha chuqur");
    return;
  }
  if (ui.mode === "pascal") {
    if (pas.view === "ball") {
      const p = ballP();
      setRO("r1", "Porshenga kuch <i>F</i>", u(fmt(pas.F, 0), "N"), "sahnada porshenni suring");
      setRO("r2", "Porshen yuzasi <i>S</i>", u(fmt(BALL_S * 1e4, 0), "cm²"), "");
      setRO("r3", "Suvdagi bosim <i>p = F/S</i>", paU(p), "atmosfera bosimidan ortiq", "orange");
      setRO("r4", "Oqim tezligi", u(fmt(P.jetSpeed(p), 1), "m/s"), "v = √(2p/ρ) — barcha teshiklarda bir xil");
      setRO("r5", "Teshiklar", "9 ta", "har xil yo‘nalishda");
      setRO("r6", "Xulosa", "p hamma tomonga bir xil", "Paskal qonuni");
      return;
    }
    const F1 = pressF1(), F2 = P.weightN(pas.M);
    setRO("r1", "Kichik porshenga <i>F₁</i>", u(fmt(F1, 1), "N"), `S₁ = ${fmt(pas.S1, 0)} cm²`, "orange");
    setRO("r2", "Katta porshen <i>F₂ = Mg</i>", F2 >= 1e4 ? u(fmt(F2 / 1000, 2), "kN") : u(fmt(F2, 0), "N"), `S₂ = ${fmt(pas.S2, 0)} cm², M = ${fmt(pas.M, 0)} kg`);
    setRO("r3", "Kuchda yutuq", `${fmt(pas.S2 / pas.S1, 0)} ×`, "F₂/F₁ = S₂/S₁");
    setRO("r4", "Suyuqlik bosimi <i>p</i>", paU(F1 / (pas.S1 * 1e-4)), "p = F₁/S₁ = F₂/S₂");
    setRO("r5", "Yo‘llar <i>s₁ / s₂</i>", u(`${fmt(pas.s1, 1)} / ${fmt(s2(), 2)}`, "cm"), "s₂ = s₁·S₁/S₂");
    setRO("r6", "Ish <i>A₁ = A₂</i>", u(fmt((F1 * pas.s1) / 100, 2), "J"), "ishda yutuq yo‘q");
    return;
  }
  if (flu.view === "depth") {
    const L = P.LIQUIDS[flu.liq], ph = P.hydro(L.rho, flu.h);
    setRO("r1", "Chuqurlik <i>h</i>", u(fmt(flu.h * 100, 0), "cm"), "suyuqlik sirtidan");
    setRO("r2", "Suyuqlik zichligi <i>ρ</i>", u(fmt(L.rho, 0), "kg/m³"), L.name);
    setRO("r3", "Gidrostatik bosim <i>ρgh</i>", paU(ph), `= ${fmt(L.rho, 0)} · 9,81 · ${fmt(flu.h, 2)}`, "orange");
    setRO("r4", "To‘liq bosim", paU(ph + P.P0), "p₀ + ρgh (atmosfera bilan)");
    setRO("r5", "1 cm² membranaga kuch", u(fmt((flu.atm ? ph + P.P0 : ph) * 1e-4, 2), "N"), "F = pS");
    setRO("r6", "Manometr <i>Δh</i>", u(fmt((ph / (1000 * P.G)) * 100, 1), "cm suv"), "membrana qayoqqa qaramasin — bir xil");
    return;
  }
  const uu = uNow();
  setRO("r1", "Idishlardagi sath", u(fmt(flu.level * 100, 0), "cm"), "shaklidan qat’i nazar bir xil");
  setRO("r2", "Tubdagi bosim", paU(P.hydro(1000, flu.level)), "barcha idishlarda bir xil");
  setRO("r3", "Moy ustuni <i>h₁</i>", u(fmt(flu.oil * 100, 1), "cm"), `ρ₁ = ${fmt(P.LIQUIDS.oil.rho, 0)} kg/m³`);
  setRO("r4", "Suv ustuni <i>h₂</i>", u(fmt(uu.dWater * 100, 2), "cm"), "suv sathlari farqi", "orange");
  setRO("r5", "<i>ρ₁h₁ = ρ₂h₂</i>", `${fmt(P.LIQUIDS.oil.rho * flu.oil, 1)} = ${fmt(1000 * uu.dWater, 1)}`, "kg/m²");
  setRO("r6", "Sathlar farqi", u(fmt(uu.dTop * 100, 2), "cm"), "moy yuzasi suvdan baland — yengilroq");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "solid") { const p = solidP(); t = `p = ${p >= 1e6 ? sci(p, 2) : fmt(p, 0)} Pa`; tone = p > 2e4 ? "orange" : "green"; }
  else if (ui.mode === "pascal") { t = pas.view === "ball" ? "Bosim hamma tomonga bir xil" : `Kuchda ${fmt(pas.S2 / pas.S1, 0)} marta yutuq`; tone = "green"; }
  else { t = flu.view === "depth" ? `p = ρgh = ${fmt(P.hydro(P.LIQUIDS[flu.liq].rho, flu.h) / 1000, 2)} kPa` : "Tutash idishlar"; tone = "purple"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "solid") {
    p.push("<p><b>Bosim</b> — sirtga perpendikulyar ta’sir qiluvchi kuchning shu sirt yuzasiga nisbati: p = F/S. Bir xil kuch kichik yuzaga ta’sir qilsa bosim katta bo‘ladi — shuning uchun g‘isht tik qo‘yilganda qumga chuqurroq botadi.</p>");
    p.push(solid.obj === "skis" || solid.obj === "boots" ? "<p>Chang‘i tayanch yuzasini ≈ 5 marta oshiradi — bosim shuncha kamayadi va odam qorga botmaydi. Etikda esa chuqur botadi.</p>" : solid.obj === "needle" ? "<p>Igna uchi yuzasi juda kichik, shuning uchun barmoq kuchi bilan ham 10⁸ Pa (1000 atmosfera!) bosim hosil bo‘ladi. Pichoq, qaychi, mix — o‘tkir qilinadi.</p>" : solid.obj === "tractor" ? "<p>Traktor juda og‘ir, lekin keng zanjirlari tufayli yerga bosimi odamnikidan atigi 2–3 marta katta — yumshoq yerda botib qolmaydi. Poydevor, rels ostidagi shpallar ham shu maqsadda keng qilinadi.</p>" : "<p>Bosimni oshirish uchun yuzani kamaytiramiz (o‘tkir asboblar), kamaytirish uchun — oshiramiz (keng poydevor, chang‘i, zanjir).</p>");
  } else if (ui.mode === "pascal") {
    p.push("<p><b>Paskal qonuni</b>: suyuqlik yoki gazga berilgan tashqi bosim uning har bir nuqtasiga har tomonga o‘zgarishsiz uzatiladi. Sababi — molekulalar erkin harakatlanib, bosimni barcha yo‘nalishlarda tarqatadi.</p>");
    p.push(pas.view === "ball" ? "<p>Porshen surilganda suv shardagi barcha teshiklardan bir xil kuch bilan otilib chiqadi — bosim faqat porshen yo‘nalishida emas, hamma tomonga uzatildi.</p>" : `<p><b>Gidravlik press</b>: ikkala porshen ostida bosim bir xil (p = F₁/S₁ = F₂/S₂), shuning uchun katta porshenga S₂/S₁ = ${fmt(pas.S2 / pas.S1, 0)} marta katta kuch ta’sir qiladi. Ammo kichik porshen 1 cm tushganda katta porshen atigi ${fmt(pas.S1 / pas.S2, 3)} cm ko‘tariladi — ishda yutuq yo‘q. Avtomobil tormozi, domkrat, ekskavator shu prinsipda ishlaydi.</p>`);
  } else if (flu.view === "depth") {
    p.push("<p>Suyuqlik o‘z og‘irligi tufayli idish tubiga, devorlariga va ichidagi jismlarga bosim beradi. h chuqurlikdagi bosim — shu nuqta ustidagi suyuqlik ustunining og‘irligidan: <b>p = ρgh</b>. Bir xil chuqurlikda bosim hamma yo‘nalishda bir xil (Paskal qonuni) — membranani burib tekshiring.</p>");
    p.push("<p>Suvda har 10 m chuqurlikda bosim ≈ 1 atmosferaga ortadi. Shuning uchun g‘avvoslar uchun maxsus skafandr, suv osti kemalari uchun qalin korpus kerak; to‘g‘on pastki qismi qalinroq quriladi.</p>");
  } else {
    p.push("<p><b>Tutash idishlar</b>da bir jinsli suyuqlik sathi idishlar shakli va kesimidan qat’i nazar bir xil balandlikda turadi: tubdagi bosim ρgh hamma joyda teng bo‘lishi kerak. Choynak jo‘mragi, suv minorasi va vodoprovod, shlyuzlar shunga asoslangan.</p>");
    p.push("<p>Agar tirsaklarda har xil suyuqlik bo‘lsa, ularning chegarasidan hisoblangan ustunlar balandligi zichliklarga teskari proporsional: <b>ρ₁h₁ = ρ₂h₂</b>. Moy yengil — shuning uchun moy ustuni suv ustunidan baland.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "solid" ? "<small>Bosim</small> p = F/S" : ui.mode === "pascal" ? (pas.view === "ball" ? "<small>Paskal qonuni</small> p = F/S hamma tomonga" : "<small>Gidravlik press</small> F₂/F₁ = S₂/S₁") : flu.view === "depth" ? "<small>Suyuqlik bosimi</small> p = ρgh" : "<small>Tutash idishlar</small> ρ₁h₁ = ρ₂h₂";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); }

/* ------------------------------------------------------------------ Asboblar paneli (sahna statik: holat surish bilan o'zgaradi, animatsiya yo'q) */

$("[data-play]").hidden = true;
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "solid") { solid.extra = 0; sLoadC.set(0); }
  else if (ui.mode === "pascal") { pas.s1 = 0; pas.F = 0; pFC.set(0); }
  else { flu.h = 0.3; flu.x = 0.5; flu.rot = 0; fHC.set(30); flu.oil = 0; fOilC.set(0); }
  customized(); refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const sObj = $("#sObj");
sObj.innerHTML = Object.entries(OBJ_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
sObj.addEventListener("change", () => { solid.obj = sObj.value; customized(); syncSolid(); refresh(); });
document.querySelectorAll("[data-face-value]").forEach((b) => b.addEventListener("click", () => { solid.face = b.dataset.faceValue; customized(); syncSolid(); refresh(); }));
const sLoadC = bindRange($("#sLoad"), $("#sLoadOut"), (v) => `${fmt(v, 0)} kg`, (v) => { solid.extra = v; customized(); refresh(); });
function syncSolid() {
  sObj.value = solid.obj; sLoadC.set(solid.extra);
  document.querySelectorAll("[data-face-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.faceValue === solid.face)));
  document.querySelectorAll("[data-sv]").forEach((el) => { el.hidden = solid.obj !== "brick"; });
}
document.querySelectorAll("[data-pview-value]").forEach((b) => b.addEventListener("click", () => { pas.view = b.dataset.pviewValue; customized(); syncPascal(); refresh(); }));
const pS1C = bindRange($("#pS1"), $("#pS1Out"), (v) => `${fmt(v, 0)} cm²`, (v) => { pas.S1 = v; customized(); refresh(); });
const pS2C = bindRange($("#pS2"), $("#pS2Out"), (v) => `${fmt(v, 0)} cm²`, (v) => { pas.S2 = v; customized(); refresh(); });
const pMC = bindRange($("#pM"), $("#pMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { pas.M = v; customized(); refresh(); });
const pFC = bindRange($("#pF"), $("#pFOut"), (v) => `${fmt(v, 0)} N`, (v) => { pas.F = v; customized(); refresh(); });
function syncPascal() {
  document.querySelectorAll("[data-pview-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pviewValue === pas.view)));
  document.querySelectorAll("[data-pv]").forEach((el) => { el.hidden = el.dataset.pv !== pas.view; });
  pS1C.set(pas.S1); pS2C.set(pas.S2); pMC.set(pas.M); pFC.set(pas.F);
}
document.querySelectorAll("[data-fview-value]").forEach((b) => b.addEventListener("click", () => { flu.view = b.dataset.fviewValue; customized(); syncFluid(); refresh(); }));
const fLiq = $("#fLiq");
fLiq.innerHTML = Object.entries(P.LIQUIDS).map(([k, v]) => `<option value="${k}">${v.name} (${fmt(v.rho, 0)} kg/m³)</option>`).join("");
fLiq.addEventListener("change", () => { flu.liq = fLiq.value; customized(); refresh(); });
const fHC = bindRange($("#fH"), $("#fHOut"), (v) => `${fmt(v, 0)} cm`, (v) => { flu.h = v / 100; customized(); refresh(); });
$("[data-atm]").addEventListener("change", (e) => { flu.atm = e.target.checked; customized(); refresh(); });
$("[data-rotate]").addEventListener("click", () => { flu.rot = (flu.rot + Math.PI / 2) % TAU; refresh(); });
const fLevelC = bindRange($("#fLevel"), $("#fLevelOut"), (v) => `${fmt(v, 0)} cm`, (v) => { flu.level = v / 100; customized(); refresh(); });
const fOilC = bindRange($("#fOil"), $("#fOilOut"), (v) => `${fmt(v, 1)} cm`, (v) => { flu.oil = v / 100; customized(); refresh(); });
function syncFluid() {
  document.querySelectorAll("[data-fview-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fviewValue === flu.view)));
  document.querySelectorAll("[data-fv]").forEach((el) => { el.hidden = el.dataset.fv !== flu.view; });
  fLiq.value = flu.liq; fHC.set(Math.round(flu.h * 100)); $("[data-atm]").checked = flu.atm; fLevelC.set(Math.round(flu.level * 100)); fOilC.set(flu.oil * 100);
}

/* Sahnada surish; bo‘sh joy 360° kamerani aylantiradi. */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const knobSpecs = {
  area1: {obj:pas,key:'S1',min:1,max:20,step:1,control:pS1C},
  area2: {obj:pas,key:'S2',min:20,max:500,step:10,control:pS2C},
  pressMass: {obj:pas,key:'M',min:10,max:2000,step:10,control:pMC},
};
bindLabCamera(canvas,scene.lab,()=>stage.render(),{
  start(id,p) {
    customized();
    if(id==='brick') {
      const order=['flat','edge','end'];solid.face=order[(order.indexOf(solid.face)+1)%3];syncSolid();refresh();return;
    }
    const spec=knobSpecs[id];drag={id,x:p.x,value:spec?spec.obj[spec.key]:0};
  },
  move(id,p) {
    if(!drag||drag.id!==id)return;
    const spec=knobSpecs[id];
    if(spec) {
      const v=clamp(Math.round((drag.value+(p.x-drag.x)*(spec.max-spec.min)/180)/spec.step)*spec.step,spec.min,spec.max);
      spec.obj[spec.key]=v;spec.control.set(v);
    } else if(id==='probe') {
      const v=scene.probe(p.x,p.y);if(!v)return;
      flu.h=Math.round(v.h*100)/100;flu.x=v.x;fHC.set(Math.round(flu.h*100));
    } else {
      const v=scene.parameter(id,p);if(v===null)return;
      if(id==='load'){solid.extra=clamp(Math.round(v),0,12);sLoadC.set(solid.extra);}
      else if(id==='knob')pas.s1=clamp(Math.round(v*2)/2,0,PRESS_S1MAX);
      else if(id==='ball'){pas.F=clamp(Math.round(v),0,100);pFC.set(pas.F);}
      else if(id==='level'){flu.level=clamp(Math.round(v*100)/100,.05,.3);fLevelC.set(Math.round(flu.level*100));}
      else if(id==='oil'){flu.oil=clamp(Math.round(v*200)/200,0,.2);fOilC.set(flu.oil*100);}
    }
    refresh();
  },
  end(){drag=null;}
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  brickFlat: { mode: "solid", title: "G‘isht: yassi yotqizilgan", lesson: "G‘isht og‘irligi 34,3 N, eng katta yuzasi 300 cm²: p ≈ 1,1 kPa. G‘ishtni bosing — u boshqa qirrasi bilan qo‘yiladi va qumdagi iz chuqurlashadi.", set: () => Object.assign(solid, { obj: "brick", face: "flat", extra: 0 }) },
  brickEnd: { mode: "solid", title: "G‘isht: tik qo‘yilgan", lesson: "Og‘irlik o‘zgarmadi, lekin tayanch yuzasi 78 cm² ga kamaydi — bosim ≈ 3,9 marta ortdi va g‘isht chuqurroq botdi.", set: () => Object.assign(solid, { obj: "brick", face: "end", extra: 0 }) },
  brickLoad: { mode: "solid", title: "Yukni oshirish", lesson: "Yuz o‘zgarmas, yukni oshiramiz: bosim kuchga to‘g‘ri proporsional. G‘isht ustidagi tutqichni yuqoriga suring.", set: () => Object.assign(solid, { obj: "brick", face: "flat", extra: 6 }) },
  boots: { mode: "solid", title: "Odam etikda qorda", lesson: "60 kg odam etikda: p ≈ 9,8 kPa — yumshoq qorga chuqur botadi. Chang‘i bilan solishtiring.", set: () => Object.assign(solid, { obj: "boots" }) },
  skis: { mode: "solid", title: "Odam chang‘ida", lesson: "Xuddi shu odam chang‘ida: tayanch yuzasi 3240 cm² — bosim 1,8 kPa, qorga deyarli botmaydi.", set: () => Object.assign(solid, { obj: "skis" }) },
  needle: { mode: "solid", title: "Igna uchi", lesson: "1 N kuch 0,01 mm² yuzaga — 10⁸ Pa. Kichik kuch bilan katta bosim olish mumkin.", set: () => Object.assign(solid, { obj: "needle" }) },
  tractor: { mode: "solid", title: "Zanjirli traktor", lesson: "6 tonnali traktor zanjirlari bilan yerga ≈ 25 kPa bosim beradi — odamnikidan atigi 2,5 marta ko‘p.", set: () => Object.assign(solid, { obj: "tractor" }) },
  press: { mode: "pascal", title: "Gidravlik press", lesson: "S₂/S₁ = 50: 200 kg yukni ko‘tarish uchun kichik porshenga atigi 39 N kerak. Kichik porshen dastasini pastga suring va katta porshen qanchalik kam ko‘tarilishini kuzating.", set: () => Object.assign(pas, { view: "press", S1: 2, S2: 100, M: 200, s1: 6 }) },
  car: { mode: "pascal", title: "Avtomobilni ko‘tarish", lesson: "Gidravlik ko‘targich: S₂/S₁ = 100. 1,2 tonnali avtomobilni 118 N (≈ 12 kg yuk og‘irligi) kuch bilan ko‘tarish mumkin.", set: () => Object.assign(pas, { view: "press", S1: 4, S2: 400, M: 1200, s1: 10 }) },
  ball: { mode: "pascal", title: "Paskal shari", lesson: "Porshenni chapdan o‘ngga suring: suv shardagi barcha teshiklardan bir xil otilib chiqadi — bosim hamma tomonga uzatiladi.", set: () => Object.assign(pas, { view: "ball", F: 50 }) },
  depth: { mode: "fluid", title: "Chuqurlikdagi bosim", lesson: "Datchikni chuqurroq tushiring — manometrdagi suv sathlari farqi va bosim ortadi: p = ρgh. Membranani burang — bosim o‘zgarmaydi.", set: () => Object.assign(flu, { view: "depth", liq: "water", h: 0.3, x: 0.5, atm: false, rot: 0 }) },
  mercuryP: { mode: "fluid", title: "Simobda bosim", lesson: "Simob suvdan 13,6 marta zich — bir xil chuqurlikda bosim ham 13,6 marta katta. 76 cm simob ustuni atmosfera bosimiga teng.", set: () => Object.assign(flu, { view: "depth", liq: "mercury", h: 0.5, x: 0.5, atm: false, rot: 0 }) },
  atm: { mode: "fluid", title: "Atmosfera bosimi bilan", lesson: "Suyuqlik sirtiga havo ham bosim beradi: p₀ ≈ 101 kPa. To‘liq bosim p = p₀ + ρgh. 80 cm suv atmosfera bosimiga atigi 8 % qo‘shadi.", set: () => Object.assign(flu, { view: "depth", liq: "water", h: 0.8, x: 0.5, atm: true, rot: 0 }) },
  vessels: { mode: "fluid", title: "Tutash idishlar", lesson: "Uch xil shakldagi idish pastdan tutashtirilgan: suv sathi hammasida bir xil. Istalgan idishdagi sathni suring.", set: () => Object.assign(flu, { view: "vessels", level: 0.18, oil: 0 }) },
  oil: { mode: "fluid", title: "U-nayda suv va moy", lesson: "Chap tirsakka 15 cm moy quyildi: moy ustuni suv ustunidan baland, chunki moy yengil. ρ_moy·h_moy = ρ_suv·h_suv — moy zichligini shunday o‘lchash mumkin.", set: () => Object.assign(flu, { view: "vessels", level: 0.18, oil: 0.15 }) },
};
const GROUPS = [["Qattiq jism bosimi", ["brickFlat", "brickEnd", "brickLoad", "boots", "skis", "needle", "tractor"]], ["Paskal qonuni", ["press", "car", "ball"]], ["Suyuqlik bosimi", ["depth", "mercuryP", "atm", "vessels", "oil"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { solid: "G‘ishtni bosing, yukni suring", pascal: "Porshen dastasini suring", fluid: "Datchikni yoki suyuqlik sathini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { solid: "Qumdagi g‘isht, odam yoki igna — bosim izi", pascal: "Gidravlik press yoki Paskal shari", fluid: "Suyuqlikli idish, bosim datchigi va manometr yoki tutash idishlar" }[ui.mode]);
}
const MODE_DEFAULT = { solid: "brickFlat", pascal: "press", fluid: "depth" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncSolid(); syncPascal(); syncFluid(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "brickFlat");
document.fonts?.ready.then(() => stage.render());
