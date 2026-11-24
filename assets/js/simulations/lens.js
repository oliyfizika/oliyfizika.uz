// ==========================================================================
// Linzalar va optik asboblar — virtual laboratoriya (simulations/lens.html)
// 1) Tasvir yasash: yig'uvchi/sochuvchi linza, xarakterli nurlar va dasta, ekranda tasvirni ushlash, optik kuch.
// 2) Optik asboblar: lupa, mikroskop, teleskop (Kepler), fotoapparat, proyektor — ketma-ket linzalar orqali nurlar.
// 3) Ko'z: akkomodatsiya, yaqindan/uzoqdan ko'rmaslik, ko'zoynak bilan tuzatish.
// 360° 3D laboratoriya: optical-lab-3d.js (optik skamya, linzalar, ekran, asbob trubkasi va ko'z kesimi;
// buyum, F fokus belgisi va ekran sahnada sudraladi). Fizika: optics-physics.js (Node'da tekshirilgan). Grafiklar: lens-plots.js.
// ==========================================================================

import { clamp, fmt, createStage, bindRange } from "./sim-kit.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-lens";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261124-lens";
import { createOpticalLab } from "./optical-lab-3d.js?v=20261124-lens";
import * as O from "./optics-physics.js";
import { drawFD, drawInv, drawGamma, drawEyeBlur, drawInstrMag } from "./lens-plots.js";

const $ = (s) => document.querySelector(s);
const RAY = ["#ef4444", "#16a34a", "#2563eb"];

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "bench", tab: "fd", rays: true, fan: false };
const bench = { type: "conv", F: 10, d: 30, h: 4, screen: false, xs: 20, pts: [] };
const ins = { kind: "micro", F1: 4, F2: 8, L: 30, d: 4.8 };
const eye = { defect: "normal", k: 100, glasses: false, G: 0 };
let presetId = null;

const Fb = () => (bench.type === "conv" ? bench.F : -bench.F);
const eyeD = () => (eye.k >= 100 ? Infinity : 0.1 * Math.pow(10, (eye.k / 100) * 2.3));

/* ------------------------------------------------------------------ 3D optik laboratoriya */
function instrLenses() {
  if (ins.kind === "loupe" || ins.kind === "camera" || ins.kind === "projector") return [{ x: 0, F: ins.F1 }];
  return [{ x: 0, F: ins.F1 }, { x: ins.L, F: ins.F2 }];
}
const scene = createOpticalLab();
function draw(ctx, stage) { scene.draw(ctx, stage, ui, bench, ins, eye); }
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.42, vh * 0.42), 240, 340)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: detailedStageHeight });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  bench: [["fd", "f(d)", "Tasvirgacha masofa f(d)", "Buyum fokusga yaqinlashgan sari tasvir uzoqlashadi (d = F da — cheksizlikda). d < F bo‘lsa, tasvir mavhum (f < 0)."], ["inv", "1/f(1/d)", "Lab: linzaning optik kuchini aniqlash", "1/d + 1/f = D — to‘g‘ri chiziq. Buyum va ekranni siljitib, aniq tasvir hosil bo‘lganda «O‘lchovni yozish» ni bosing; chiziq o‘qlarni D nuqtasida kesadi."], ["gamma", "Γ(d)", "Kattalashtirish Γ = f/d", "d > 2F — kichraygan, F < d < 2F — kattalashgan haqiqiy, d < F — kattalashgan mavhum tasvir (lupa)."]],
  instr: [["mag", "Γ", "Asbobning kattalashtirishi", "Okulyar (yoki lupa) fokus masofasi kichik bo‘lsa, kattalashtirish ortadi."]],
  eye: [["blur", "Aniqlik", "Buyumgacha masofa va ko‘rish aniqligi", "Yashil soha — ko‘z aniq ko‘radigan masofalar (yaqin nuqtadan uzoq nuqtagacha). Ko‘zoynak bu sohani siljitadi."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  $("[data-meas-tools]").hidden = !(ui.mode === "bench" && ui.tab === "inv");
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "bench") {
    if (ui.tab === "inv") drawInv(ctx, st, { F: Fb(), pts: bench.pts, d: bench.d });
    else if (ui.tab === "gamma") drawGamma(ctx, st, { F: Fb(), d: bench.d });
    else drawFD(ctx, st, { F: Fb(), d: bench.d });
  } else if (ui.mode === "instr") drawInstrMag(ctx, st, { ...ins });
  else drawEyeBlur(ctx, st, { defect: eye.defect, G: eye.glasses ? eye.G : 0, d: eyeD() });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const cm = (x, dd = 1) => (Number.isFinite(x) ? `${fmt(x, dd)}<small>cm</small>` : "∞");

function describe(img, F) {
  if (img.inf) return "tasvir yo‘q (cheksizlikda)";
  const size = Math.abs(img.m) > 1.001 ? "kattalashgan" : Math.abs(img.m) < 0.999 ? "kichraygan" : "teng";
  return `${img.real ? "haqiqiy" : "mavhum"}, ${img.upright ? "to‘g‘ri" : "teskari"}, ${size}`;
}

function updateReadouts() {
  if (ui.mode === "bench") {
    const F = Fb(), img = O.thinLens(F, bench.d);
    setRO("r1", "Buyumgacha <i>d</i>", cm(bench.d), `F = ${fmt(F, 1)} cm`);
    setRO("r2", "Tasvirgacha <i>f</i>", img.inf ? "∞" : cm(img.f), img.inf ? "d = F" : img.real ? "haqiqiy tasvir (linzaning narigi tomonida)" : "mavhum tasvir (buyum tomonida)");
    setRO("r3", "Kattalashtirish <i>Γ</i>", img.inf ? "∞" : `${fmt(Math.abs(img.m), 2)}`, img.inf ? "" : `H = Γ·h = ${fmt(Math.abs(img.m * bench.h), 1)} cm`);
    setRO("r4", "Tasvir xarakteri", img.inf ? "—" : (img.real ? "haqiqiy" : "mavhum"), describe(img, F));
    setRO("r5", "Optik kuch <i>D</i>", `${fmt(100 / F, 1)}<small>dptr</small>`, "D = 1/F (F metrda)");
    if (bench.screen) {
      const sharp = img.real && Math.abs(bench.xs - img.f) < 0.6;
      setRO("r6", "Ekran", `${fmt(bench.xs, 1)}<small>cm</small>`, sharp ? "Aniq tasvir — ekran tasvir joyida" : img.real ? `Aniq bo‘lishi uchun ${fmt(img.f, 1)} cm ga suring` : "Mavhum tasvirni ekranda ushlab bo‘lmaydi", sharp ? "" : "muted");
    } else setRO("r6", "Tekshiruv: 1/d + 1/f", `${fmt(100 * (1 / bench.d + (img.inf ? 0 : 1 / img.f)), 2)}<small>dptr</small>`, `= 1/F = ${fmt(100 / F, 2)} dptr`);
  } else if (ui.mode === "instr") {
    const L = instrLenses();
    const k = ins.kind;
    if (k === "tele") {
      setRO("r1", "Kattalashtirish <i>Γ</i>", `${fmt(O.telescopeMag(ins.F1, ins.F2), 1)}<small>×</small>`, "Γ = F₁/F₂ (burchakli)");
      setRO("r2", "Obyektiv <i>F</i>₁", cm(ins.F1), "Uzun fokusli");
      setRO("r3", "Okulyar <i>F</i>₂", cm(ins.F2), "Qisqa fokusli");
      setRO("r4", "Teleskop uzunligi", cm(ins.L), `Normal sozlash: F₁ + F₂ = ${fmt(ins.F1 + ins.F2, 1)} cm`);
      const ok = Math.abs(ins.L - ins.F1 - ins.F2) < 0.6;
      setRO("r5", "Chiqish dastasi", ok ? "parallel" : "parallel emas", ok ? "Ko‘z zo‘riqmasdan ko‘radi" : "Okulyarni siljiting (L = F₁ + F₂)", ok ? "" : "muted");
      setRO("r6", "Oraliq tasvir", cm(ins.F1), "Obyektivning fokal tekisligida, teskari");
    } else {
      const h = 1, sys = O.systemImage(L, -ins.d, h), last = sys.steps[sys.steps.length - 1], first = sys.steps[0];
      const Gamma = k === "loupe" ? O.loupeMag(ins.F1 / 100) : k === "micro" ? O.microscopeMag(ins.F1 / 100, ins.F2 / 100, ins.L / 100) : Math.abs(last.y / h);
      setRO("r1", "Kattalashtirish <i>Γ</i>", `${fmt(Gamma, 1)}<small>×</small>`, k === "loupe" ? "Γ = d₀/F (d₀ = 25 cm)" : k === "micro" ? "Γ ≈ (Δ/F₁)·(d₀/F₂)" : "Γ = f/d (chiziqli)");
      setRO("r2", L.length > 1 ? "Obyektiv <i>F</i>₁" : "Linza <i>F</i>", cm(ins.F1), `D = ${fmt(100 / ins.F1, 1)} dptr`);
      setRO("r3", "Buyumgacha <i>d</i>", cm(ins.d), k === "loupe" ? "Buyum fokus ichida (d < F)" : k === "micro" ? "F₁ < d < 2F₁" : "");
      setRO("r4", L.length > 1 ? "Oraliq tasvir" : "Tasvir", first.inf ? "∞" : cm(first.x), first.real ? "haqiqiy" : "mavhum");
      setRO("r5", L.length > 1 ? "Okulyar <i>F</i>₂" : "Tasvir balandligi", L.length > 1 ? cm(ins.F2) : `${fmt(Math.abs(first.y * 3), 1)}<small>cm</small>`, L.length > 1 ? `Linzalar oralig‘i L = ${fmt(ins.L, 1)} cm` : "buyum 3 cm");
      setRO("r6", "Yakuniy tasvir", last.inf ? "∞" : cm(last.x), last.inf ? "Ko‘zga parallel nurlar" : last.real ? "haqiqiy" : "mavhum — ko‘z ko‘radi");
    }
  } else {
    const d = eyeD(), G = eye.glasses ? eye.G : 0, v = O.eyeView(d, eye.defect, G), fn = O.farNear(eye.defect);
    setRO("r1", "Buyumgacha", Number.isFinite(d) ? (d < 1 ? cm(d * 100, 0) : `${fmt(d, 1)}<small>m</small>`) : "∞", v.sharp ? "aniq ko‘rinadi" : "xira", v.sharp ? "" : "orange");
    setRO("r2", "Akkomodatsiya", `${fmt(v.accommodation, 2)}<small>dptr</small>`, `Ko‘z optik kuchi ${fmt(v.P, 1)} D (max +${O.EYE.A} D)`);
    setRO("r3", "Uzoq nuqta", Number.isFinite(fn.far) ? cm(fn.far * 100, 0) : "∞", "Ko‘zoynaksiz");
    setRO("r4", "Yaqin nuqta", cm(fn.near * 100, 0), "Normal ko‘zda ≈ 25 cm (maktab: d₀)");
    setRO("r5", "To‘r pardadagi dog‘", `${fmt(v.blur * 1e6, 1)}<small>μm</small>`, "≤ 6 μm — aniq");
    const rx = O.prescription(eye.defect);
    setRO("r6", "Ko‘zoynak", eye.glasses ? `${G > 0 ? "+" : ""}${fmt(G, 2)}<small>D</small>` : "yo‘q", eye.defect === "normal" ? "Normal ko‘zga kerak emas" : `Kerakli: ${rx > 0 ? "+" : ""}${fmt(rx, 2)} D (${rx > 0 ? "yig‘uvchi" : "sochuvchi"})`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "bench") { const img = O.thinLens(Fb(), bench.d); t = img.inf ? "Tasvir yo‘q" : img.real ? "Haqiqiy tasvir" : "Mavhum tasvir"; tone = img.real ? "green" : "purple"; }
  else if (ui.mode === "instr") { t = { loupe: "Lupa", micro: "Mikroskop", tele: "Teleskop", camera: "Fotoapparat", projector: "Proyektor" }[ins.kind]; tone = "blue"; }
  else { const v = O.eyeView(eyeD(), eye.defect, eye.glasses ? eye.G : 0); t = v.sharp ? "Aniq ko‘radi" : "Xira ko‘radi"; tone = v.sharp ? "green" : "orange"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "bench") {
    const F = Fb(), d = bench.d, img = O.thinLens(F, d);
    p.push(`<p>Tasvir uchta <b>xarakterli nur</b> yordamida yasaladi: <span style="color:${RAY[0]}">optik o‘qqa parallel nur</span> linzadan keyin fokusdan o‘tadi; <span style="color:${RAY[1]}">optik markazdan o‘tgan nur</span> sinmaydi; <span style="color:${RAY[2]}">fokusdan o‘tgan nur</span> linzadan keyin o‘qqa parallel ketadi.${F < 0 ? " Sochuvchi linzada nurlar «go‘yo fokusdan chiqqandek» tarqaladi — tasvir doim mavhum, to‘g‘ri va kichraygan." : ""}</p>`);
    if (F > 0) p.push(`<p>${d > 2 * F ? "d > 2F: tasvir haqiqiy, teskari, kichraygan (fotoapparat, ko‘z)." : Math.abs(d - 2 * F) < 0.3 ? "d = 2F: tasvir haqiqiy, teskari, buyumga teng." : d > F + 0.3 ? "F < d < 2F: tasvir haqiqiy, teskari, kattalashgan (proyektor)." : Math.abs(d - F) <= 0.3 ? "d = F: nurlar parallel, tasvir hosil bo‘lmaydi." : "d < F: tasvir mavhum, to‘g‘ri, kattalashgan (lupa)."}</p>`);
    if (bench.screen) p.push("<p>Haqiqiy tasvirni ekranda ushlash mumkin: ekran tasvir joyida bo‘lsa aniq, aks holda xira dog‘ ko‘rinadi. Mavhum tasvir ekranda hosil bo‘lmaydi.</p>");
    void img;
  } else if (ui.mode === "instr") {
    const k = ins.kind;
    if (k === "loupe") p.push("<p><b>Lupa</b> — qisqa fokusli yig‘uvchi linza. Buyum fokus ichiga qo‘yiladi, ko‘z kattalashgan mavhum to‘g‘ri tasvirni ko‘radi. Γ = 25 cm / F.</p>");
    if (k === "micro") p.push("<p><b>Mikroskop</b>: obyektiv buyumning kattalashgan haqiqiy teskari (oraliq) tasvirini beradi, okulyar uni lupa kabi yana kattalashtiradi. Umumiy kattalashtirish — ikkalasining ko‘paytmasi.</p>");
    if (k === "tele") p.push("<p><b>Kepler teleskopi</b>: uzun fokusli obyektiv uzoqdagi buyumning tasvirini fokal tekisligida hosil qiladi, okulyar uni burchakli kattalashtiradi: Γ = F₁/F₂. Chiqishda nurlar parallel — ko‘z zo‘riqmaydi.</p>");
    if (k === "camera") p.push("<p><b>Fotoapparat</b>: uzoqdagi buyumning kichraygan haqiqiy teskari tasviri matritsada hosil bo‘ladi. Fokuslash — obyektivni matritsaga nisbatan siljitish.</p>");
    if (k === "projector") p.push("<p><b>Proyektor</b>: slayd F va 2F orasida joylashadi — ekranda kattalashgan haqiqiy teskari tasvir (shuning uchun slayd teskari qo‘yiladi).</p>");
  } else {
    p.push("<p>Ko‘z — optik tizim: gavhar to‘r pardada buyumning tasvirini hosil qiladi. Turli masofadagi buyumlarni ko‘rish uchun gavhar egriligini o‘zgartiradi — bu <b>akkomodatsiya</b>.</p>");
    if (eye.defect === "myopia") p.push("<p><b>Yaqindan ko‘ruvchi (miopiya)</b>: ko‘z soqqasi uzunroq, uzoqdagi buyum tasviri to‘r parda oldida hosil bo‘ladi. Tuzatish — <b>sochuvchi</b> linzali ko‘zoynak (manfiy dioptriya).</p>");
    if (eye.defect === "hyperopia") p.push("<p><b>Uzoqdan ko‘ruvchi (gipermetropiya)</b>: ko‘z soqqasi qisqaroq, yaqindagi buyum tasviri to‘r parda orqasida hosil bo‘ladi. Tuzatish — <b>yig‘uvchi</b> linzali ko‘zoynak (musbat dioptriya).</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const f = $("[data-formula]");
  const html = ui.mode === "bench" ? "<small>Linza formulasi</small> 1/F = 1/d + 1/f" : ui.mode === "instr" ? (ins.kind === "tele" ? "<small>Teleskop</small> Γ = F₁ / F₂" : ins.kind === "micro" ? "<small>Mikroskop</small> Γ = Γ₁·Γ₂" : ins.kind === "loupe" ? "<small>Lupa</small> Γ = d₀ / F" : "<small>Linza formulasi</small> 1/F = 1/d + 1/f") : "<small>Optik kuch</small> D = 1/F";
  if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Boshqaruv */

const bFc = bindRange($("#bF"), $("#bFOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.F = v; customized(); refresh(); });
const bDc = bindRange($("#bD"), $("#bDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.d = v; customized(); refresh(); });
const bHc = bindRange($("#bH"), $("#bHOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.h = v; customized(); refresh(); });
const bSc = bindRange($("#bS"), $("#bSOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.xs = v; customized(); refresh(); });
document.querySelectorAll("[data-ltype-value]").forEach((b) => b.addEventListener("click", () => { bench.type = b.dataset.ltypeValue; syncAll(); customized(); refresh(); }));
$("[data-screen]").addEventListener("change", (e) => { bench.screen = e.target.checked; syncAll(); customized(); refresh(); });
$("[data-rays]").addEventListener("change", (e) => { ui.rays = e.target.checked; refresh(); });
$("[data-fan]").addEventListener("change", (e) => { ui.fan = e.target.checked; refresh(); });
$("[data-meas-add]").addEventListener("click", () => { const img = O.thinLens(Fb(), bench.d); if (img.real && !img.inf) { const f = bench.screen ? bench.xs : img.f; bench.pts.push({ d: bench.d, f }); } graph.render(); });
$("[data-meas-clear]").addEventListener("click", () => { bench.pts = []; graph.render(); });

const iF1 = bindRange($("#iF1"), $("#iF1Out"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.F1 = v; customized(); refresh(); });
const iF2 = bindRange($("#iF2"), $("#iF2Out"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.F2 = v; customized(); refresh(); });
const iL = bindRange($("#iL"), $("#iLOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.L = v; customized(); refresh(); });
const iD = bindRange($("#iD"), $("#iDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.d = v; customized(); refresh(); });

const eDc = bindRange($("#eD"), $("#eDOut"), (v) => { const d = v >= 100 ? Infinity : 0.1 * Math.pow(10, (v / 100) * 2.3); return Number.isFinite(d) ? (d < 1 ? `${fmt(d * 100, 0)} cm` : `${fmt(d, 1)} m`) : "∞"; }, (v) => { eye.k = v; customized(); refresh(); });
const eGc = bindRange($("#eG"), $("#eGOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 2)} D`, (v) => { eye.G = v; customized(); refresh(); });
document.querySelectorAll("[data-defect-value]").forEach((b) => b.addEventListener("click", () => { eye.defect = b.dataset.defectValue; syncAll(); customized(); refresh(); }));
$("[data-glasses]").addEventListener("change", (e) => { eye.glasses = e.target.checked; syncAll(); customized(); refresh(); });
$("[data-rx]").addEventListener("click", () => { eye.glasses = eye.defect !== "normal"; eye.G = Math.round(O.prescription(eye.defect) * 4) / 4; syncAll(); customized(); refresh(); });

// Buyum, fokus va ekran koordinatalari kameraning proyeksiyasi orqali hisoblanadi.
bindLabCamera(stage.canvas, scene.lab, () => stage.render(), {
  move(id, pointer) {
    if (ui.mode !== "bench") return;
    const x = scene.position(pointer.x, pointer.y); if (x === null) return;
    if (id === "object") { bench.d = Math.round(clamp(-x, 1, 58) * 2) / 2; bDc.set(bench.d); }
    else if (id === "screen") { bench.xs = Math.round(clamp(x, 2, 58) * 2) / 2; bSc.set(bench.xs); }
    else if (id === "focus") { const input = $("#bF"); bench.F = Math.round(clamp(Math.abs(x), Number(input.min), Number(input.max))*2)/2; bFc.set(bench.F); }
    customized(); refresh();
  },
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  far: { mode: "bench", title: "Buyum 2F dan uzoqda", lesson: "d > 2F: tasvir haqiqiy, teskari, kichraygan — fotoapparat va ko‘z shunday ishlaydi. Buyumni linzaga yaqinlashtirib, tasvir qanday o‘zgarishini kuzating.", set: () => Object.assign(bench, { type: "conv", F: 10, d: 30, h: 4, screen: false }) },
  between: { mode: "bench", title: "Buyum F va 2F orasida", lesson: "F < d < 2F: tasvir haqiqiy, teskari, kattalashgan va 2F dan uzoqda hosil bo‘ladi — proyektor prinsipi.", set: () => Object.assign(bench, { type: "conv", F: 10, d: 15, h: 3, screen: false }) },
  inside: { mode: "bench", title: "Buyum fokus ichida (lupa)", lesson: "d < F: nurlar linzadan keyin tarqaladi, ularning davomi (punktir) kesishgan joyda mavhum, to‘g‘ri, kattalashgan tasvir hosil bo‘ladi.", set: () => Object.assign(bench, { type: "conv", F: 12, d: 7, h: 3, screen: false }) },
  diverging: { mode: "bench", title: "Sochuvchi linza", lesson: "Sochuvchi linza har doim mavhum, to‘g‘ri, kichraygan tasvir beradi. Buyumni har qanday masofaga qo‘yib tekshiring.", set: () => Object.assign(bench, { type: "div", F: 12, d: 25, h: 5, screen: false }) },
  lab: { mode: "bench", title: "Lab: linzaning optik kuchi", lesson: "Ekranni suring va aniq tasvir hosil qiling, so‘ng «O‘lchovni yozish» ni bosing. Buyumni boshqa joyga qo‘yib takrorlang. 1/d + 1/f = D — grafikdagi chiziq optik kuchni beradi.", set: () => Object.assign(bench, { type: "conv", F: 12.5, d: 30, h: 3, screen: true, xs: 15, pts: [] }), tab: "inv" },
  loupe: { mode: "instr", title: "Lupa", lesson: "Buyum lupaning fokusi ichida: ko‘z kattalashgan mavhum to‘g‘ri tasvirni ko‘radi.", set: () => Object.assign(ins, { kind: "loupe", F1: 8, d: 5.5 }) },
  micro: { mode: "instr", title: "Mikroskop", lesson: "Obyektiv (F₁ = 4 cm) oraliq haqiqiy tasvir beradi, okulyar (F₂ = 8 cm) uni lupa kabi kattalashtiradi.", set: () => Object.assign(ins, { kind: "micro", F1: 4, F2: 8, L: 30, d: 4.8 }) },
  tele: { mode: "instr", title: "Teleskop (Kepler)", lesson: "Uzoqdagi buyumdan parallel nurlar keladi. Obyektiv tasvirni fokal tekislikda beradi, okulyar burchakni kattalashtiradi: Γ = F₁/F₂.", set: () => Object.assign(ins, { kind: "tele", F1: 40, F2: 8, L: 48 }) },
  camera: { mode: "instr", title: "Fotoapparat", lesson: "Buyum uzoqda (d > 2F): matritsada kichraygan teskari haqiqiy tasvir.", set: () => Object.assign(ins, { kind: "camera", F1: 5, d: 40 }) },
  projector: { mode: "instr", title: "Proyektor", lesson: "Slayd F va 2F orasida: ekranda kattalashgan teskari tasvir.", set: () => Object.assign(ins, { kind: "projector", F1: 8, d: 10 }) },
  eyeNormal: { mode: "eye", title: "Normal ko‘z va akkomodatsiya", lesson: "Buyumni yaqinlashtiring: gavhar qalinlashadi (akkomodatsiya) va tasvir to‘r pardada qoladi — 25 cm gacha aniq.", set: () => Object.assign(eye, { defect: "normal", k: 100, glasses: false, G: 0 }) },
  myopia: { mode: "eye", title: "Yaqindan ko‘ruvchi ko‘z", lesson: "Uzoqdagi buyum xira: tasvir to‘r parda oldida. «Kerakli ko‘zoynakni tanlash» ni bosing — sochuvchi linza tasvirni to‘r pardaga suradi.", set: () => Object.assign(eye, { defect: "myopia", k: 100, glasses: false, G: 0 }) },
  hyperopia: { mode: "eye", title: "Uzoqdan ko‘ruvchi ko‘z", lesson: "Kitob (25 cm) xira: tasvir to‘r parda orqasida. Yig‘uvchi linzali ko‘zoynak buni tuzatadi.", set: () => Object.assign(eye, { defect: "hyperopia", k: Math.round((Math.log10(0.25 / 0.1) / 2.3) * 100), glasses: false, G: 0 }) },
};
const GROUPS = [["Tasvir yasash", ["far", "between", "inside", "diverging", "lab"]], ["Optik asboblar", ["loupe", "micro", "tele", "camera", "projector"]], ["Ko‘z", ["eyeNormal", "myopia", "hyperopia"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const INSTR_TITLE = { loupe: "Lupa", micro: "Mikroskop", tele: "Teleskop", camera: "Fotoapparat", projector: "Proyektor" };
function syncAll() {
  document.querySelectorAll("[data-ltype-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ltypeValue === bench.type)));
  bFc.set(bench.F); bDc.set(bench.d); bHc.set(bench.h); bSc.set(bench.xs); $("[data-screen]").checked = bench.screen; $("[data-screen-ctl]").hidden = !bench.screen;
  $("[data-instr-title]").textContent = INSTR_TITLE[ins.kind];
  const two = ins.kind === "micro" || ins.kind === "tele";
  document.querySelector('[data-ictl="F2"]').hidden = !two; document.querySelector('[data-ictl="L"]').hidden = !two; document.querySelector('[data-ictl="d"]').hidden = ins.kind === "tele";
  $("[data-f1-label]").textContent = two ? "Obyektiv F₁" : "Linza F";
  const dIn = $("#iD"); dIn.max = ins.kind === "camera" ? 60 : ins.kind === "projector" ? 30 : 20;
  iF1.set(ins.F1); iF2.set(ins.F2); iL.set(ins.L); iD.set(ins.d);
  document.querySelectorAll("[data-defect-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.defectValue === eye.defect)));
  eDc.set(eye.k); eGc.set(eye.G); $("[data-glasses]").checked = eye.glasses; $("[data-glass-ctl]").hidden = !eye.glasses;
  $("[data-rays]").checked = ui.rays; $("[data-fan]").checked = ui.fan;
}
const MODE_HINT = { bench: "Buyumni va ekranni suring — tasvir qanday o‘zgaradi?", instr: "Optik asboblarda nurlar yo‘li", eye: "Ko‘z, akkomodatsiya va ko‘zoynak" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs(); setTab(TABS[m][0][0]);
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ bench: "far", instr: "micro", eye: "eyeNormal" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  setMode(p.mode); p.set();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll();
  if (p.tab) setTab(p.tab);
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "far");

window.__lens = { ui, bench, ins, eye, scene, loadPreset, refresh };
