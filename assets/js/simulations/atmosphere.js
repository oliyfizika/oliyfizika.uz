// ==========================================================================
// Atmosfera bosimi — simulyatsiya (simulations/atmosphere.html)
// 1) Torichelli tajribasi: simob (1 m) yoki suv (12 m, Paskal) bilan to'ldirilgan nay idishga to'ntarilgan.
//    Ustun balandligi h = p/(ρg); nayning uchini surib qiyalatish — vertikal balandlik o'zgarmaydi; nay tepasini teshish;
//    joy balandligi (tog'da ustun pasayadi). Chizg'ich, «p₀» strelkalari, Torichelli bo'shlig'i.
// 2) Magdeburg yarim sharlari: nasos dastagi sahnada suriladi (har yurishda p ← p·V/(V + Vn)), vakuummetr, jo'mrak,
//    otlar (o'quvchilar) yoki daraxt; «Tortish» — kerakli kuch F = (p₀ − p)πR² bilan solishtiriladi. Grafik F(n).
// 3) Balandlik va barometr: havo shari sahnada suriladi; aneroid barometr, germetik paket, qaynash temperaturasi.
//    Grafik p(h) — standart atmosfera.
// Sahna — 360° 3D laboratoriya (atmosphere-lab-3d.js): bo'sh joydan sudrash kamerani aylantiradi; tugmalar va asboblar
// kartochkasi — sahna ustidagi tekis qatlam. Fizika: atmosphere-physics.js (Node'da tekshirilgan: t_atmosphere.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn } from "./labkit.js";
import * as P from "./atmosphere-physics.js";
import { drawAlt, drawPump, lastFrame } from "./atmosphere-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-n3";
import { createAtmosphereLab, TORR } from "./atmosphere-lab-3d.js?v=20261128-s";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "torr", hover: null };
const tr = { liq: "hg", tilt: 0, alt: 0, hole: false, col: null };
const mg = { size: "big", team: 8, tree: false, n: 0, p: P.P0, valve: false, handle: 1, armed: false, pull: 0, apart: false, sep: 0, result: "" };
const al = { h: 455 };
let presetId = null, playing = true;
const geo = {};

const TUBE = { hg: 1, water: 12 };
const SIZES = {
  big: { name: "Gerike yarim sharlari", R: 0.255, puller: 1800, who: "ot", Vp: 1 / 12, pMin: 0.08 },
  small: { name: "maktab yarim sharlari", R: 0.05, puller: 400, who: "o‘quvchi", Vp: 1 / 5, pMin: 0.06 },
};
const sz = () => SIZES[mg.size];
const V = () => P.sphereVolume(sz().R);
const needF = () => P.pullForce(mg.p, sz().R);
const pullF = () => mg.team * sz().puller;
const pAtm = () => P.isa(tr.alt).p;
const tubeNow = () => P.tube(pAtm(), P.LIQUIDS[tr.liq].rho, TUBE[tr.liq], tr.tilt * DEG);
const MARKS = [[455, "Toshkent"], [3309, "Katta Chimyon"], [7495, "Ismoil Somoniy"], [8849, "Everest"], [10500, "samolyot"]];
const mm = (p) => p / P.MMHG;
const kN = (F) => (F >= 5000 ? `${fmt(F / 1000, 1)} kN` : `${fmt(F, 0)} N`);

/* ------------------------------------------------------------------ Umumiy asboblar */

/** Dumaloq strelkali asbob: [lo, hi] shkala 270° yoyda, har step da raqam */
function gauge(ctx, c, cx, cy, R, val, lo, hi, step, label, labelStep = step) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 2, cx, cy, R + 6);
  g.addColorStop(0, "#fde68a"); g.addColorStop(1, "#a16207");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fffbeb"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, A = (v) => a0 + ((v - lo) / (hi - lo)) * (a1 - a0);
  ctx.strokeStyle = "#334155"; ctx.fillStyle = "#1e293b"; ctx.lineWidth = 1; ctx.font = `600 ${R > 40 ? 9 : 8}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const minor = step / 5;
  for (let v = lo; v <= hi + 1e-9; v += minor) { const a = A(v), maj = Math.abs(v / step - Math.round(v / step)) < 1e-6, r0 = R - (maj ? 9 : 5); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); ctx.stroke(); if (maj && R >= 34 && Math.abs(((v - lo) / labelStep) - Math.round((v - lo) / labelStep)) < 1e-6) ctx.fillText(`${Math.round(v)}`, cx + Math.cos(a) * (R - 17), cy + Math.sin(a) * (R - 17)); }
  ctx.font = "600 8px Inter, system-ui, sans-serif"; ctx.fillStyle = "#475569";
  if (R >= 34) ctx.fillText(label, cx, cy + R * 0.66);
  const an = A(clamp(val, lo, hi));
  ctx.strokeStyle = "#b91c1c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - Math.cos(an) * 8, cy - Math.sin(an) * 8); ctx.lineTo(cx + Math.cos(an) * (R - 6), cy + Math.sin(an) * (R - 6)); ctx.stroke();
  ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}
/* ------------------------------------------------------------------ Chizish va grafik */

const scene = createAtmosphereLab();
/** Sahna ustidagi tekis qatlam: tugmalar, kuchlar va asboblar kartochkasi (ekran koordinatalarida) */
function overlay(ctx, st, narrow) {
  const c = st.colors, w = st.w, h = st.h;
  for (const k of ["hole", "pull", "valve", "pump10"]) geo[k] = null;
  if (ui.mode === "torr") {
    tag(ctx, narrow ? `p = ${fmt(mm(pAtm()), 0)} mm` : `p = ${fmt(mm(pAtm()), 0)} mm sim. ust. = ${fmt(pAtm() / 1000, 1)} kPa`, w - 12, 21, { color: c.text, bg: c.bg2, font: narrow ? SMALL : MID, align: "right" });
    if (tr.alt > 0) tag(ctx, `balandlik ${fmt(tr.alt, 0)} m`, w - 12, 45, { color: c.text2, bg: c.bg2, font: SMALL, align: "right" });
    geo.hole = chipBtn(ctx, c, 12, h - 62, tr.hole ? "teshilgan" : "Teshish", !tr.hole, narrow ? 76 : 90, 26, c.danger);
    return;
  }
  if (ui.mode === "mag") {
    const pulling = mg.pull > 0;
    geo.pull = chipBtn(ctx, c, 12, 38, mg.apart ? "ajraldi" : pulling ? "tortilmoqda…" : "Tortish!", !mg.apart && !pulling, narrow ? 84 : 96, 26, c.success);
    geo.valve = chipBtn(ctx, c, 12, 70, mg.valve ? "jo‘mrak ochiq" : "Jo‘mrakni ochish", mg.valve, narrow ? 104 : 120, 24, c.danger);
    geo.pump10 = chipBtn(ctx, c, 12, 100, "+10 yurish", false, narrow ? 84 : 96, 24);
    if (!narrow) {
      const fx = w - 176, fy = 24, Fn = needF(), Fp = pullF(), Fm = Math.max(Fn, Fp, 1), bw = 160; ctx.save();
      ctx.fillStyle = c.dark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.88)"; ctx.beginPath(); ctx.roundRect(fx - 8, fy - 14, bw + 16, 64, 8); ctx.fill();
      ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = c.text2;
      ctx.fillText(`kerakli F = ${kN(Fn)}`, fx, fy); ctx.fillStyle = c.primary; ctx.fillRect(fx, fy + 7, (bw * Fn) / Fm, 8);
      ctx.fillStyle = c.text2; ctx.fillText(`tortish = ${kN(Fp)}`, fx, fy + 28); ctx.fillStyle = c.success; ctx.fillRect(fx, fy + 35, (bw * Fp) / Fm, 8); ctx.restore();
    }
    if (mg.result) tag(ctx, mg.result, w / 2, narrow ? 140 : 60, { color: mg.apart ? "#fff" : c.text, bg: mg.apart ? c.success : c.bg2, font: BOLD, align: "center" });
    return;
  }
  const s = P.isa(al.h), cw = narrow ? 150 : 196, chh = narrow ? 92 : 178, cx0 = w - cw - 10, cy0 = narrow ? h - 92 - 30 : 10;
  ctx.fillStyle = c.dark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.92)"; ctx.beginPath(); ctx.roundRect(cx0, cy0, cw, chh, 10); ctx.fill();
  const gR = narrow ? 30 : 44, gx = cx0 + gR + 12, gy = cy0 + gR + 14;
  gauge(ctx, c, gx, gy, gR, mm(s.p), 100, 800, 100, "mm sim. ust.", 200);
  const ratio = P.bagRatio(s.p), pw = narrow ? 30 : 40, phh = (narrow ? 26 : 34) * Math.min(2.4, Math.sqrt(ratio)), pxx = cx0 + cw - pw - 12, pyy = cy0 + (narrow ? 40 : 66);
  ctx.fillStyle = "#facc15"; ctx.strokeStyle = "#a16207"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(pxx + pw / 2, pyy, pw / 2 + Math.min(8, (ratio - 1) * 4), phh / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#dc2626"; ctx.fillRect(pxx - 2, pyy - phh / 2 - 4, pw + 4, 6); ctx.fillRect(pxx - 2, pyy + phh / 2 - 2, pw + 4, 6);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = narrow ? "right" : "center"; ctx.textBaseline = "top"; ctx.fillText(`paket ×${fmt(ratio, 2)}`, narrow ? cx0 + cw - 6 : pxx + pw / 2, pyy + phh / 2 + 8);
  ctx.textAlign = "left"; ctx.font = MID; ctx.fillStyle = c.text;
  const ly = cy0 + 2 * gR + 26;
  if (!narrow) { ctx.fillText(`${fmt(s.p / 100, 0)} hPa · ${fmt(s.T - 273.15, 1)} °C`, cx0 + 10, ly); ctx.fillText(`suv ${fmt(P.boilingPoint(s.p), 1)} °C da qaynaydi`, cx0 + 10, ly + 18); }
}
function frame() {
  const f = { mode: ui.mode, overlay, t: performance.now() / 1000 };
  if (ui.mode === "torr") { const t = tubeNow(); if (tr.col === null) tr.col = t.len; f.torr = { Lt: TUBE[tr.liq], water: tr.liq === "water", tilt: tr.tilt, col: tr.col, hv: t.hv, full: t.full, hole: tr.hole, mmHg: mm(pAtm()) }; }
  else if (ui.mode === "mag") f.mag = { big: mg.size === "big", sep: mg.sep, pull: mg.pull, p: mg.p, valve: mg.valve, tree: mg.tree, team: mg.team, n: mg.n, handle: mg.handle };
  else f.alt = { h: al.h };
  return f;
}
const draw = (ctx, st) => scene.draw(ctx, st, frame());
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.44, 320, 370)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "alt") return drawAlt(ctx, gs, { h: al.h, marks: MARKS, hover: ui.hover });
  if (ui.mode === "mag") { const s = sz(); return drawPump(ctx, gs, { V: V(), Vp: V() * s.Vp, pMin: s.pMin * P.P0, Rad: s.R, n: mg.n, pull: pullF(), hover: ui.hover }); }
  ctx.fillStyle = gs.colors.bg; ctx.fillRect(0, 0, gs.w, gs.h);
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  mag: ["Ajratish uchun kerakli kuch F(n)", "Har yurishda shar ichidagi havoning bir qismi so‘riladi va bosim kamayadi, kerakli kuch esa o‘sadi. Nasos ichkaridagi havoni to‘liq so‘ra olmaydi — kuch chegaraga yaqinlashadi. Yashil chiziq — tortuvchilar kuchi: u ko‘k chiziqdan yuqori bo‘lsa, sharlar ajraladi."],
  alt: ["Atmosfera bosimining balandlikka bog‘liqligi p(h)", "Pastki qatlamlar ustidagi havo og‘irligini ko‘taradi, shuning uchun bosim yer yaqinida eng katta. Har 5,5 km ko‘tarilganda bosim taxminan ikki marta kamayadi. Uzuq chiziq — darslikdagi «har 12 m da 1 mm sim. ust.» qoidasi: u faqat bir necha yuz metrgacha to‘g‘ri."],
};
function setTab() {
  const t = TABS[ui.mode], card = $("[data-graph-card]"); ui.hover = null;
  card.hidden = !t;
  if (t) { $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); graph.render(); }
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;

function updateReadouts() {
  if (ui.mode === "torr") {
    const t = tubeNow(), liq = P.LIQUIDS[tr.liq], water = tr.liq === "water", p = pAtm();
    setRO("r1", "Atmosfera bosimi <i>p</i>", u(fmt(mm(p), 0), "mm sim. ust."), `${fmt(p / 1000, 2)} kPa = ${fmt(p, 0)} Pa`, "orange");
    setRO("r2", "Ustun balandligi <i>h</i> (vertikal)", tr.hole ? u("0", water ? "m" : "mm") : water ? u(fmt(t.hv, 2), "m") : u(fmt(t.hv * 1000, 0), "mm"), tr.hole ? "havo kirdi — ustun tushdi" : t.full ? "nay to‘liq to‘lgan" : "h = p/(ρg)", "green");
    setRO("r3", "Nay bo‘ylab uzunlik", tr.hole ? "—" : water ? u(fmt(t.len, 2), "m") : u(fmt(t.len * 1000, 0), "mm"), `nay qiyaligi ${fmt(tr.tilt, 0)}°`);
    setRO("r4", "Nay tepasidagi bosim", tr.hole ? u(fmt(mm(p), 0), "mm sim. ust.") : t.full ? u(fmt(mm(t.pTop), 0), "mm sim. ust.") : "≈ 0", tr.hole ? "teshikdan havo kirdi" : t.full ? "suyuqlik nay tepasini bosadi" : "Torichelli bo‘shlig‘i (vakuum)");
    setRO("r5", "Suyuqlik zichligi <i>ρ</i>", u(fmt(liq.rho, 0), "kg/m³"), liq.name);
    setRO("r6", "Joy balandligi", u(fmt(tr.alt, 0), "m"), tr.alt ? `dengiz sathidan ${fmt(760 - mm(p), 0)} mm kam` : "dengiz sathi");
    return;
  }
  if (ui.mode === "mag") {
    const s = sz(), S = Math.PI * s.R * s.R, Fn = needF(), Fp = pullF();
    setRO("r1", "Shar ichidagi bosim <i>p</i>", u(fmt(mg.p / 1000, 1), "kPa"), `${fmt((mg.p / P.P0) * 100, 0)} % · nasos ${mg.n} yurish`);
    setRO("r2", "Bosimlar farqi <i>p₀ − p</i>", u(fmt((P.P0 - mg.p) / 1000, 1), "kPa"), "tashqaridan havo bosadi");
    setRO("r3", "Kesim yuzasi <i>πR²</i>", u(fmt(S * 1e4, 0), "cm²"), `d = ${fmt(s.R * 200, 0)} cm`);
    setRO("r4", "Kerakli kuch <i>F</i>", kN(Fn).replace(/ (\S+)$/, "<small>$1</small>"), `≈ ${fmt(Fn / 9.81, 0)} kg yuk og‘irligi`, "orange");
    setRO("r5", "Tortish kuchi", kN(Fp).replace(/ (\S+)$/, "<small>$1</small>"), `${mg.team} ta ${s.who} × ${kN(s.puller)}${mg.tree ? ", daraxt" : ""}`, Fp > Fn ? "green" : "");
    setRO("r6", "Natija", mg.apart ? "ajraldi" : mg.result ? "ajralmadi" : "—", Fp > Fn ? "kuch yetarli" : `yana ${kN(Fn - Fp)} kerak`, mg.apart ? "green" : "");
    return;
  }
  const s = P.isa(al.h);
  setRO("r1", "Balandlik <i>h</i>", u(fmt(al.h, 0), "m"), al.h > 8000 ? "kislorod niqobi kerak" : "");
  setRO("r2", "Atmosfera bosimi <i>p</i>", u(fmt(s.p / 1000, 1), "kPa"), `${fmt((s.p / P.P0) * 100, 0)} % · ${fmt(s.p / 100, 0)} hPa`, "orange");
  setRO("r3", "Barometr ko‘rsatishi", u(fmt(mm(s.p), 0), "mm sim. ust."), `dengiz sathidan ${fmt(760 - mm(s.p), 0)} mm kam`);
  setRO("r4", "Havo temperaturasi", u(fmt(s.T - 273.15, 1), "°C"), "standart atmosfera");
  setRO("r5", "Havo zichligi <i>ρ</i>", u(fmt(s.rho, 3), "kg/m³"), `paket ${fmt(P.bagRatio(s.p), 2)} marta shishdi`);
  setRO("r6", "Suvning qaynash temperaturasi", u(fmt(P.boilingPoint(s.p), 1), "°C"), "pₛ(t) = p", "green");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "torr") { const tt = tubeNow(); t = tr.hole ? "Havo kirdi — ustun tushdi" : tt.full ? "Nay to‘liq to‘ldi" : `h = ${tr.liq === "water" ? `${fmt(tt.hv, 2)} m` : `${fmt(tt.hv * 1000, 0)} mm`}`; tone = tr.hole ? "orange" : "green"; }
  else if (ui.mode === "mag") { t = mg.apart ? "Yarim sharlar ajraldi" : mg.pull > 0 ? "Tortilmoqda…" : mg.result || `F = ${kN(needF())}`; tone = mg.apart ? "green" : mg.result ? "orange" : "blue"; }
  else { t = `${fmt(mm(P.isa(al.h).p), 0)} mm sim. ust.`; tone = "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "torr") {
    const water = tr.liq === "water";
    p.push(`<p>1643-yilda Torichelli bir uchi berk 1 m li shisha nayni simob bilan to‘ldirib, ochiq uchini simobli idishga to‘ntardi. Simob to‘liq oqib tushmadi: ≈ 760 mm balandlikdagi ustun qoldi, uning ustida esa bo‘shliq (vakuum) hosil bo‘ldi. Idishdagi simob sirtini <b>atmosfera bosimi</b> bosadi va ustun og‘irligini muvozanatlaydi: p₀ = ρgh.</p>`);
    p.push(water ? "<p>Paskal suv bilan xuddi shunday tajribani o‘tkazgan: suv simobdan 13,6 marta yengil, shuning uchun suv ustuni 10,3 m — uch qavatli uydan baland bo‘ladi. Simob barometrda shuning uchun ishlatiladi.</p>" : `<p>Nayni qiyalatsangiz ham ustunning <b>vertikal balandligi</b> o‘zgarmaydi — nay bo‘ylab simob ko‘proq joy egallaydi. Nay tepasi 760 mm dan pastga tushsa bo‘shliq yo‘qoladi. Nay tepasi teshilsa, ichkariga havo kiradi va simob idishga tushadi. Tog‘ga chiqqan sari ustun pasayadi — bu barometr.</p>`);
  } else if (ui.mode === "mag") {
    p.push("<p>1654–1656-yillarda Magdeburg shahri burgomistri Otto fon Gerike ikki mis yarim sharni bir-biriga qo‘yib, ichidagi havoni nasos bilan so‘rdi. Ichkarida havo kam qolgach, sharlarni tashqi havo bosimi bir-biriga qattiq siqib qo‘ydi. Har tomonga 8 tadan ot qo‘shilganda ham ular sharlarni ajrata olmagan.</p>");
    p.push(`<p>Ajratish uchun kerakli kuch F = (p₀ − p)·πR² — bosimlar farqi va sharning kesim yuzasiga bog‘liq. Bir tomonni daraxtga bog‘lash natijani o‘zgartirmaydi: daraxt ham xuddi shunday kuch bilan qarshi tortadi (Nyutonning III qonuni). Jo‘mrak ochilsa, ichkariga havo kiradi va sharlar o‘zi ajraladi.</p>`);
  } else {
    p.push("<p>Atmosfera bosimi — yuqoridagi havo ustunining og‘irligi. Ko‘tarilgan sari ustimizdagi havo kamayadi va siyraklashadi, shuning uchun bosim kamayadi: Yer yaqinida har ≈ 12 m da 1 mm sim. ust. ga, 5,5 km da esa ikki marta. Aneroid barometr shu o‘zgarishni o‘lchaydi; balandlik o‘lchagich (altimetr) ham aslida barometr.</p>");
    p.push(`<p>Bosim kamaysa, suv pastroq temperaturada qaynaydi: Everest cho‘qqisida ≈ 70 °C da. Dengiz sathida yopilgan paket tog‘da shishib ketadi, chunki ichidagi havo bosimi tashqaridagidan katta. Samolyotlar 10–11 km da uchadi — u yerda bosim dengiz sathidagining to‘rtdan biricha, shuning uchun salonga havo damlanadi.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "torr" ? "<small>Torichelli</small> p₀ = ρgh ≈ 760 mm sim. ust." : ui.mode === "mag" ? "<small>Magdeburg sharlari</small> F = (p₀ − p)·πR²" : "<small>Balandlik</small> Δp ≈ 1 mm sim. ust. / 12 m";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "torr") { const target = tr.hole ? 0 : tubeNow().len; tr.col += (target - tr.col) * Math.min(1, dt * (tr.hole ? 3 : 6)); }
  else if (ui.mode === "mag") {
    if (mg.valve && !mg.apart) mg.p += (P.P0 - mg.p) * Math.min(1, dt * 4);
    if (mg.pull > 0) {
      mg.pull -= dt;
      if (pullF() > needF() && !mg.apart) { mg.apart = true; mg.p = P.P0; mg.result = "Yarim sharlar ajraldi!"; }
      if (mg.pull <= 0) { mg.pull = 0; if (!mg.apart) mg.result = `Ajrata olmadi: ${kN(pullF())} < ${kN(needF())}`; }
    }
    if (mg.apart) mg.sep = Math.min(1, mg.sep + dt * 2.5);
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.2) { uiTimer = 0; refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom";
}
playBtn.addEventListener("click", () => { if (loop.running) { loop.stop(); playing = false; } else { loop.start(); playing = true; } });
function startIfNeeded() {
  if (prefersReducedMotion()) { tr.col = tr.hole ? 0 : tubeNow().len; loop.stop(); setPlayUI(false); return; }
  if (!playing) { loop.stop(); setPlayUI(false); } else loop.start();
}
function resetMag() { Object.assign(mg, { n: 0, p: P.P0, valve: false, handle: 1, armed: false, pull: 0, apart: false, sep: 0, result: "" }); }
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "torr") { tr.hole = false; tr.col = null; }
  else if (ui.mode === "mag") resetMag();
  refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const aC = bindRange($("#tA"), $("#tAOut"), (v) => `${fmt(v, 0)}°`, (v) => { tr.tilt = v; customized(); refresh(); });
const hC = bindRange($("#tH"), $("#tHOut"), (v) => `${fmt(v, 0)} m`, (v) => { tr.alt = v; customized(); refresh(); });
const nC = bindRange($("#mN"), $("#mNOut"), (v) => `${fmt(v, 0)}`, (v) => { mg.team = v; mg.result = ""; customized(); refresh(); });
const altC = bindRange($("#aH"), $("#aHOut"), (v) => `${fmt(v, 0)} m`, (v) => { al.h = v; customized(); refresh(); });
const treeEl = $("[data-tree]");
treeEl.addEventListener("change", () => { mg.tree = treeEl.checked; mg.result = ""; customized(); refresh(); });
function setLiq(l) { tr.liq = l; tr.hole = false; tr.col = null; document.querySelectorAll("[data-liq-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.liqValue === l))); }
document.querySelectorAll("[data-liq-value]").forEach((b) => b.addEventListener("click", () => { setLiq(b.dataset.liqValue); customized(); refresh(); }));
function setSize(s) {
  mg.size = s; resetMag();
  document.querySelectorAll("[data-size-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sizeValue === s)));
  $("[data-team-label]").textContent = s === "big" ? "Har tomonda otlar soni" : "Har tomonda o‘quvchilar soni";
}
document.querySelectorAll("[data-size-value]").forEach((b) => b.addEventListener("click", () => { setSize(b.dataset.sizeValue); customized(); refresh(); }));
function stroke(k = 1) {
  if (mg.apart || mg.valve) return;
  const s = sz(); for (let i = 0; i < k; i++) { mg.n++; mg.p = P.pumped(1, V(), V() * s.Vp, mg.p, s.pMin * P.P0); }
  mg.result = "";
}

/* Sahnada surish va bosish (360° kamera: bo'sh joydan sudrash — aylantirish) */
const canvas = stage.canvas;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const handleHit = scene.lab.hit;
scene.lab.hit = (x, y) => {
  const p = { x, y };
  if (ui.mode === "torr" && inBox(p, geo.hole)) return "hole";
  if (ui.mode === "mag") for (const k of ["pull", "valve", "pump10"]) if (inBox(p, geo[k])) return k;
  const id = handleHit(x, y);
  return id && { tip: "torr", handle: "mag", balloon: "alt" }[id] === ui.mode ? id : null;
};
function applyDrag(id, p) {
  if (id === "tip") { const q = scene.lab.planePoint(p.x, p.y, 0); if (!q) return; tr.tilt = clamp(Math.round(Math.atan2(q[0], q[1] - TORR.surf) / DEG), 0, 70); aC.set(tr.tilt); }
  else if (id === "handle") {
    mg.handle = clamp(scene.lab.nearest(scene.pumpPoint, 0, 1, p.x, p.y), 0, 1);
    if (mg.handle < 0.12) mg.armed = true;
    if (mg.handle > 0.88 && mg.armed) { mg.armed = false; stroke(); }
  } else if (id === "balloon") { al.h = clamp(Math.round(scene.lab.nearest(scene.balloonPoint, 0, 12000, p.x, p.y) / 10) * 10, 0, 12000); altC.set(al.h); }
}
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id, p) {
    customized();
    if (id === "hole") { if (!tr.hole) tr.hole = true; }
    else if (id === "pull") { if (!mg.apart && mg.pull <= 0) { mg.pull = 2.2; mg.result = ""; } if (!loop.running && !prefersReducedMotion()) { playing = true; loop.start(); } else if (prefersReducedMotion()) { if (pullF() > needF()) { mg.apart = true; mg.sep = 1; mg.p = P.P0; mg.result = "Yarim sharlar ajraldi!"; } else mg.result = `Ajrata olmadi: ${kN(pullF())} < ${kN(needF())}`; } }
    else if (id === "valve") { if (!mg.apart) { mg.valve = !mg.valve; mg.result = ""; if (prefersReducedMotion() && mg.valve) mg.p = P.P0; } }
    else if (id === "pump10") stroke(10);
    else applyDrag(id, p);
    refresh();
  },
  move(id, p) { if (id === "tip" || id === "handle" || id === "balloon") { applyDrag(id, p); refresh(); } },
});

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const TR = (liq, tilt, alt, lesson, title) => ({ mode: "torr", title, lesson, set: () => { setLiq(liq); Object.assign(tr, { tilt, alt, hole: false, col: null }); } });
const MG = (size, team, n, tree, title, lesson) => ({ mode: "mag", title, lesson, set: () => { setSize(size); Object.assign(mg, { team, tree }); stroke(n); } });
const PRESETS = {
  torr: TR("hg", 0, 0, "Bir uchi berk 1 m li nay simob bilan to‘ldirilib, simobli idishga to‘ntarilgan. Simob ustuni 760 mm da to‘xtadi — uni idishdagi simob sirtiga ta’sir qilayotgan atmosfera bosimi ushlab turibdi.", "Torichelli tajribasi"),
  torrTilt: TR("hg", 30, 0, "Nay 30° ga qiyalatildi: nay bo‘ylab simob 878 mm ga cho‘zildi, ammo vertikal balandlik o‘sha 760 mm. Nayning uchini sahnada surib tekshiring: 40° dan ko‘proq qiyalatilsa nay to‘liq to‘ladi.", "Nayni qiyalatish"),
  torrFull: TR("hg", 55, 0, "Nay tepasi 760 mm dan pastga tushdi (1 m · cos 55° = 574 mm): bo‘shliq yo‘qoldi, simob nay tepasini ≈ 186 mm sim. ust. bosim bilan bosmoqda.", "Nay to‘liq to‘ldi"),
  torrHole: TR("hg", 0, 0, "«Teshish» tugmasini bosing: nay tepasiga havo kiradi, ustun ustidagi bosim ham p₀ ga teng bo‘ladi va simob idishga tushadi — xuddi ochiq tutash idishlardagidek.", "Nay tepasini teshish"),
  torrWater: TR("water", 0, 0, "Paskalning suvli barometri: suv simobdan 13,6 marta yengil, ustun 10,3 m — 4 qavatli binoning deyarli tomigacha.", "Suvli barometr (Paskal)"),
  torrTash: TR("hg", 0, 455, "Toshkent dengiz sathidan ≈ 455 m balandlikda: o‘rtacha bosim ≈ 719 mm sim. ust. Shuning uchun Toshkentdagi barometr 760 emas, 715–725 mm atrofida ko‘rsatadi.", "Toshkentda"),
  torrMount: TR("hg", 0, 3000, "3000 m balandlikdagi tog‘da simob ustuni ≈ 526 mm — dengiz sathidagidan 234 mm past. 1648-yilda Perye Paskal topshirig‘i bilan Pyui-de-Dom tog‘ida shunday o‘lchagan.", "Tog‘da: 3000 m"),
  magStart: MG("big", 8, 0, false, "Gerike yarim sharlari", "Ichida hali havo bor — sharlar osongina ajraladi. Nasos dastagini yuqoriga-pastga surib havoni so‘ring (yoki «+10 yurish»), kerakli kuch qanday o‘sishini kuzating."),
  magGuericke: MG("big", 8, 40, false, "8 + 8 ot ajrata olmaydi", "Havo so‘rib olindi: 51 cm li sharlarni ajratish uchun ≈ 18 kN (1,9 tonnalik yuk og‘irligi) kerak. 8 ta ot ≈ 14 kN bilan tortadi — «Tortish!» ni bosing."),
  magTree: MG("big", 8, 40, true, "Bir tomoni daraxtga bog‘langan", "Bir tomondagi 8 ta ot o‘rniga daraxt qo‘yildi. Natija o‘zgarmaydi: arqondagi taranglik baribir 8 ta otning kuchiga teng — daraxt ham xuddi shunday kuch bilan qarshi tortadi."),
  magMore: MG("big", 12, 40, false, "12 + 12 ot", "Har tomonga 12 tadan ot: tortish kuchi 21,6 kN — kerakli kuchdan katta. «Tortish!» ni bosing: sharlar katta shovqin bilan ajraladi."),
  magSchool: MG("small", 2, 20, false, "Maktab yarim sharlari", "Diametri 10 cm li yarim sharlar: kerakli kuch ≈ 730 N. Ikki o‘quvchi (≈ 800 N) zo‘rg‘a ajratadi. Jo‘mrakni ochib ko‘ring — kuch kerak bo‘lmay qoladi."),
  altSea: { mode: "alt", title: "Dengiz sathi", lesson: "Normal atmosfera bosimi: 760 mm sim. ust. = 101 325 Pa, havo zichligi 1,23 kg/m³, suv 100 °C da qaynaydi.", set: () => { al.h = 0; } },
  altChimyon: { mode: "alt", title: "Katta Chimyon (3309 m)", lesson: "Chimyon cho‘qqisida bosim ≈ 510 mm sim. ust., suv 89 °C da qaynaydi. Dengiz sathida yopilgan paket 1,5 marta shishgan.", set: () => { al.h = 3309; } },
  altEverest: { mode: "alt", title: "Everest cho‘qqisi (8849 m)", lesson: "Bosim dengiz sathidagining uchdan biri (≈ 236 mm sim. ust.), havo −42 °C. Suv ≈ 70 °C da qaynaydi — tuxumni pishirib bo‘lmaydi. Alpinistlar kislorod ballonidan foydalanadi.", set: () => { al.h = 8849; } },
  altPlane: { mode: "alt", title: "Samolyot balandligi (10,5 km)", lesson: "10,5 km da bosim ≈ 25 kPa, havo −53 °C. Samolyot saloniga havo damlanib, bosim 2–2,5 km balandlikdagidek ushlab turiladi.", set: () => { al.h = 10500; } },
};
const GROUPS = [["Torichelli tajribasi", ["torr", "torrTilt", "torrFull", "torrHole", "torrWater", "torrTash", "torrMount"]], ["Magdeburg yarim sharlari", ["magStart", "magGuericke", "magTree", "magMore", "magSchool"]], ["Balandlik va barometr", ["altSea", "altChimyon", "altEverest", "altPlane"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { torr: "Nay uchini suring", mag: "Nasos dastagini suring, «Tortish!»", alt: "Havo sharini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { torr: "Simob yoki suv bilan to‘ldirilgan barometr nayi, idish va chizg‘ich", mag: "Magdeburg yarim sharlari, nasos, vakuummetr va tortayotgan otlar", alt: "Tog‘lar, havo shari, aneroid barometr va germetik paket" }[ui.mode]);
}
const MODE_DEFAULT = { torr: "torr", mag: "magStart", alt: "altSea" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  ui.hover = null;
  ui.mode = p.mode; if (p.mode === "mag") resetMag(); p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  aC.set(tr.tilt); hC.set(tr.alt); nC.set(mg.team); altC.set(al.h); treeEl.checked = mg.tree;
  setTab(); startIfNeeded(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "torr");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
