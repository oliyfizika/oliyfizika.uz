// ==========================================================================
// Elektromagnit to'lqinlar va radioaloqa — virtual laboratoriya (simulations/emwaves.html)
// 1) EM to'lqin: vibrator (antenna) nurlatadi; E va B sinusoidalari (perspektivada), λ, v = c/n; chastota 10⁴…10²¹ Hz
//    (log shkala), muhit; sahnada o'lchov nuqtasi suriladi — E(t) grafigi; EM spektr.
// 2) Xossalari (Gers tajribalari): metall listdan qaytish, dielektrikda sinish, qutblanish (qabul qiluvchi vibrator).
//    Sahnada nurlatgich va qabul qiluvchi suriladi. β(α) va cos²φ grafiklari.
// 3) Radioaloqa: mikrofon → generator → modulyator (AM/FM) → antenna; priyomnik: kontur (sozlash) → detektor → karnay.
//    Uchta stansiya; sahnadagi shkalada sozlash; kontur aslligi Q; rezonans egri chizig'i.
// Sahna — 360° 3D laboratoriya (emwaves-lab-3d.js): bo'sh joydan sudrash kamerani aylantiradi.
// Fizika: emwaves-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./emwaves-physics.js";
import { drawEt, drawSpectrum, drawAngles, drawPolar, drawResonance, drawSignal, lastFrame } from "./emwaves-plots.js";
import { bindLabCamera } from "./lab-3d.js?v=20261124-n3";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261124-n3";
import { createEmwavesLab, LAMS } from "./emwaves-lab-3d.js?v=20261125-n4";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const MEDIA = {
  vac: { name: "Vakuum (havo)", n: 1 },
  water: { name: "Suv (radioto‘lqinlar uchun n ≈ 9)", n: 9 },
  glass: { name: "Shisha (yorug‘lik uchun n ≈ 1,5)", n: 1.5 },
};
const L_RX = 200e-6; // priyomnik g'altagi, H
const VIS_K = 14;    // ossillogrammada: tashuvchi «tebranishlari»/ms = 14·f(MHz) (kamaytirilgan)

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "wave", tab: "et", speed: 1, hover: null };
const wave = { lg: 8, E0: 50, med: "vac", probe: 0.55, showB: true, u: 0, hist: [] };
const props = { view: "reflect", a: 40 * DEG, n: 1.5, phi: 30 * DEG, ph: 0 };
const radio = { mod: "am", F: 1, m: 0.6, C: 260e-12, Q: 40, t: 0 };
const STATIONS = [
  { f: 0.70e6, F: 1, m: 0.6, label: "1-stansiya", own: true },
  { f: 0.99e6, F: 2.2, m: 0.5, label: "2-stansiya" },
  { f: 1.27e6, F: 0.5, m: 0.8, label: "3-stansiya" },
];
let presetId = null, running = false;

const nu = () => 10 ** wave.lg;
const med = () => MEDIA[wave.med];
const f0 = () => P.resonance(L_RX, radio.C);
const stationsNow = () => STATIONS.map((s) => (s.own ? { ...s, F: radio.F, m: radio.m, mod: radio.mod } : { ...s, mod: "am" }));

/* ------------------------------------------------------------------ Radio signallari (ossillogramma, ms) */

const WIN = 2, NS = 480;
function stationSig(s, t) { // t — ms
  const fv = VIS_K * (s.f / 1e6);
  return s.mod === "fm" ? P.fmSignal(t, { f: fv, F: s.F, df: s.m * fv * 0.35 }) : P.amSignal(t, { f: fv, F: s.F, m: s.m });
}
/** Joriy oynadagi barcha signallar (detektor uchun 1 ms oldindan boshlanadi) */
function radioTraces() {
  const st = stationsNow(), own = st[0], fz = f0(), dt = WIN / NS, pre = Math.round(1 / dt), t0 = radio.t;
  const resp = st.map((s) => P.response(s.f, fz, radio.Q));
  const ts = Array.from({ length: NS + pre + 1 }, (_, k) => t0 - 1 + k * dt);
  const rx = ts.map((t) => st.reduce((sum, s, i) => sum + resp[i] * stationSig(s, t), 0));
  // RC detektor: tashuvchi davridan katta, lekin konvert pasayishiga ulguradigan (τ ≲ √(1 − m²)/(mΩ)) — eng yuqori tovush chastotasi bo'yicha
  const fvMean = VIS_K * (fz / 1e6), Fmax = Math.max(...st.map((s) => s.F));
  const det = P.detect(rx, dt, Math.max(1.5 / fvMean, 0.3 / Fmax));
  const win = (arr) => arr.slice(pre);
  const audioOwn = ts.map((t) => Math.cos(TAU * own.F * t));
  // detektor chiqishi: doimiy tashkil etuvchisi olib tashlanadi; FM stansiya — ideal chastota detektori
  // tovush kuchaytirgichi oldidagi filtr: bir tashuvchi davri bo'yicha o'rtacha (detektor pulsatsiyasini silliqlaydi)
  const per = Math.max(1, Math.round(1 / (fvMean * dt))), sm = det.map((_, k) => { let sum = 0, n = 0; for (let j = Math.max(0, k - per + 1); j <= k; j++) { sum += det[j]; n++; } return sum / n; });
  const detW = win(det), smW = win(sm), mean = smW.reduce((a, b) => a + b, 0) / smW.length;
  const out = smW.map((v, k) => v - mean + (own.mod === "fm" ? resp[0] * own.m * win(audioOwn)[k] : 0));
  return {
    audio: win(audioOwn).map((v) => v * (own.mod === "fm" ? 1 : own.m)),
    carrier: win(ts).map((t) => Math.cos(TAU * VIS_K * (own.f / 1e6) * t)),
    mod: win(ts).map((t) => stationSig(own, t)),
    rx: win(rx), det: detW, out, resp,
  };
}
function received() {
  const st = stationsNow(), r = st.map((s) => P.response(s.f, f0(), radio.Q)), best = r.indexOf(Math.max(...r));
  const second = Math.max(...r.filter((_, i) => i !== best));
  return { r, best: r[best] > 0.5 ? best : null, mixed: r[best] > 0.5 && second > 0.2, level: r[best] };
}

/* ------------------------------------------------------------------ Sahna (360° 3D laboratoriya: emwaves-lab-3d.js) */

const scene = createEmwavesLab();
/** O'lchov nuqtasidagi E fazasi: ekranda 2,5 to'lqin uzunligi, nuqta — ulush. */
const probeE = (u) => Math.cos(TAU * u - TAU * wave.probe * LAMS);
/** Sahna uchun joriy qiymatlar (faqat o'qiladi). */
function frameCfg() {
  if (ui.mode === "wave") {
    const f = nu(), b = P.bandOf(f);
    return { mode: "wave", W: { u: wave.u, n: med().n, water: wave.med === "water", vc: P.visibleColor(f), showB: wave.showB, probe: wave.probe, E0: wave.E0, lam: P.lambdaOf(f, med().n), band: `${b.name}${P.radioBand(f) ? ": " + P.radioBand(f) : ""} · ${MEDIA[wave.med].name.split(" (")[0]}` } };
  }
  if (ui.mode === "props") {
    const b = props.view === "refract" ? P.refractAngle(1, props.n, props.a) : null;
    return { mode: "props", P: { view: props.view, a: props.a, n: props.n, phi: props.phi, ph: props.ph, b, R: props.view === "reflect" ? 1 : P.reflectance(1, props.n, props.a), P0: P.receiverPower(props.phi) } };
  }
  const st = stationsNow(), rc = received();
  return { mode: "radio", R: { tr: radioTraces(), level: rc.best !== null ? rc.level : 0, stations: STATIONS, f0: f0(), t: radio.t, mod: radio.mod, label: st[0].label, f: st[0].f } };
}
const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { graph: Math.round(clamp(vh * 0.28, 190, 260)) };
};
const stage = createStage($("#stage"), (ctx, st) => scene.draw(ctx, st, frameCfg()), { height: detailedStageHeight });

function drawGraphCanvas(ctx, gst) {
  const c = gst.colors;
  if (ui.mode === "wave") return ui.tab === "spec" ? drawSpectrum(ctx, gst, { nu: nu(), hover: ui.hover }) : drawEt(ctx, gst, { hist: wave.hist, win: 3, E0: wave.E0, T: 1 / nu(), hover: ui.hover });
  if (ui.mode === "props") return props.view === "polar" ? drawPolar(ctx, gst, { phi: props.phi, hover: ui.hover }) : drawAngles(ctx, gst, { n: props.n, alpha: props.a, reflect: props.view === "reflect", hover: ui.hover });
  if (ui.tab === "sig") { const tr = radioTraces(); return drawSignal(ctx, gst, { win: WIN, traces: [{ ys: tr.rx, color: c.primary, label: "Kontur chiqishi" }, { ys: tr.det, color: c.warning, label: "Detektor", width: 2.4 }] }); }
  const cols = [c.success, c.special, c.warning];
  return drawResonance(ctx, gst, { f0: f0(), Q: radio.Q, stations: STATIONS.map((s, i) => ({ f: s.f, label: s.label, color: cols[i] })), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

const TABS = {
  wave: { et: ["O‘lchov nuqtasida E(t)", "Elektr va magnit maydonlar bir xil fazada tebranadi: E maksimal bo‘lganda B ham maksimal (B = E/c). Gorizontal o‘q — davrlarda. O‘lchov nuqtasini sahnada suring."], spec: ["Elektromagnit to‘lqinlar shkalasi", "Radioto‘lqinlardan gamma-nurlanishgacha — barchasi bitta tabiatli EM to‘lqinlar, faqat chastotasi (to‘lqin uzunligi) bilan farq qiladi. Kursor bilan diapazonlarni o‘qing."] },
  props: { ang: ["Burchaklar", ""] },
  radio: { rez: ["Qabul qiluvchi kontur rezonansi", "Kontur faqat o‘z rezonans chastotasiga yaqin stansiyalarni o‘tkazadi. Q katta — egri chiziq tor (tanlovchanlik yuqori). Shtrix — 0,707 daraja, o‘tkazish polosasi Δf = f₀/Q."], sig: ["Kontur va detektor signallari", "Detektor (diod) signalning faqat musbat yarmini o‘tkazadi, RC filtr tashuvchi tebranishlarni silliqlaydi — tovush chastotali konvert qoladi."] },
};
const TAB_LABEL = { et: "E(t)", spec: "EM spektr", ang: "", rez: "Rezonans", sig: "Signal" };
function setTab(tab) {
  ui.tab = TABS[ui.mode][tab] ? tab : Object.keys(TABS[ui.mode])[0];
  let t = TABS[ui.mode][ui.tab];
  if (ui.mode === "props") t = props.view === "polar" ? ["Qabul qilingan signal P(φ)", "Vibrator to‘lqinning E vektoriga parallel bo‘lsa signal maksimal, perpendikulyar bo‘lsa — nol: EM to‘lqin ko‘ndalang va qutblangan. P = P₀cos²φ."] : props.view === "reflect" ? ["Qaytish qonuni β(α)", "EM to‘lqin metall listdan yorug‘lik kabi qaytadi: qaytish burchagi tushish burchagiga teng."] : ["Sinish qonuni β(α)", `Dielektrikda to‘lqin sekinroq (v = c/n) va sinadi: sinα = n·sinβ. n = ${fmt(props.n, 2)}. Shtrix — sinmasdan o‘tganda (β = α).`];
  const keys = Object.keys(TABS[ui.mode]);
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
const sciU = (v, unit) => u(sci(v, 3), unit);
function fmtHz(f) { return f >= 1e9 ? u(sci(f / 1e9, 3), "GHz") : f >= 1e6 ? u(sci(f / 1e6, 3), "MHz") : f >= 1e3 ? u(sci(f / 1e3, 3), "kHz") : u(sci(f, 3), "Hz"); }

function updateReadouts() {
  if (ui.mode === "wave") {
    const f = nu(), n = med().n, lam = P.lambdaOf(f, n), v = P.speedIn(n), b = P.bandOf(f);
    setRO("r1", "Chastota <i>ν</i>", f < 1e12 ? fmtHz(f) : sciU(f, "Hz"), `T = 1/ν = ${sci(1 / f, 3)} s`);
    setRO("r2", "To‘lqin uzunligi <i>λ</i>", sciU(lam, "m"), n > 1 ? `vakuumda ${sci(P.lambdaOf(f), 3)} m; muhitda n marta qisqa` : "λ = c/ν");
    setRO("r3", "Tarqalish tezligi <i>v</i>", sciU(v, "m/s"), n > 1 ? `v = c/n, n = ${fmt(n, 1)}` : "c = 1/√(ε₀μ₀)");
    setRO("r4", "Elektr maydon <i>E₀</i>", u(fmt(wave.E0, 0), "V/m"), `intensivlik I = cε₀E₀²/2 = ${sci(P.intensity(wave.E0), 3)} W/m²`);
    setRO("r5", "Magnit induksiya <i>B₀</i>", sciU(wave.E0 / v, "T"), "B₀ = E₀/v — juda kichik");
    setRO("r6", "Diapazon", b.name, P.radioBand(f) || (b.id === "vis" ? `λ = ${fmt(P.lambdaOf(f) * 1e9, 0)} nm` : "EM spektr qismi"), "orange");
    return;
  }
  if (ui.mode === "props") {
    if (props.view === "polar") {
      const p = P.receiverPower(props.phi);
      setRO("r1", "Burchak <i>φ</i>", u(fmt(props.phi / DEG, 0), "°"), "vibrator va E vektori orasida");
      setRO("r2", "Qabul qilingan quvvat", u(fmt(p * 100, 1), "%"), "P = P₀cos²φ", "orange");
      setRO("r3", "Induksiyalangan kuchlanish", u(fmt(Math.abs(Math.cos(props.phi)) * 100, 1), "%"), "U ∝ E·cosφ");
      setRO("r4", "Qutblanish", "chiziqli", "E vektori vertikal tekislikda tebranadi");
      setRO("r5", "Xulosa", p > 0.95 ? "maksimal" : p < 0.05 ? "signal yo‘q" : "qisman", p < 0.05 ? "vibrator E ga perpendikulyar" : "EM to‘lqin — ko‘ndalang to‘lqin");
      setRO("r6", "To‘lqin uzunligi", u("≈ 10", "cm"), "Gers tajribalari: dm va cm to‘lqinlar");
      return;
    }
    const a = props.a, refl = props.view === "reflect", b = refl ? a : P.refractAngle(1, props.n, a);
    setRO("r1", "Tushish burchagi <i>α</i>", u(fmt(a / DEG, 1), "°"), "normal bilan orasida");
    setRO("r2", refl ? "Qaytish burchagi <i>β</i>" : "Sinish burchagi <i>β</i>", u(fmt(b / DEG, 1), "°"), refl ? "β = α" : `sinβ = sinα/n = ${fmt(Math.sin(b), 3)}`, "orange");
    setRO("r3", refl ? "Qaytgan ulush" : "Qaytgan ulush (dielektrik)", u(fmt((refl ? 1 : P.reflectance(1, props.n, a)) * 100, 1), "%"), refl ? "metall EM to‘lqinni deyarli to‘liq qaytaradi" : "qolgani dielektrikka o‘tadi");
    setRO("r4", "Sindirish ko‘rsatkichi <i>n</i>", refl ? "—" : fmt(props.n, 2), refl ? "metall — o‘tkazgich" : "n = sinα/sinβ = c/v");
    setRO("r5", "Dielektrikdagi tezlik", refl ? "—" : sciU(P.speedIn(props.n), "m/s"), refl ? "" : "v = c/n");
    setRO("r6", "Dielektrikdagi λ", refl ? "—" : u(fmt(10 / props.n, 2), "cm"), refl ? "" : "λ' = λ/n (λ = 10 cm uchun)");
    return;
  }
  const fz = f0(), rc = received(), st = stationsNow();
  setRO("r1", "Sozlangan chastota <i>ν₀</i>", u(fmt(fz / 1e6, 3), "MHz"), "ν₀ = 1/(2π√(LC))");
  setRO("r2", "Kondensator sig‘imi <i>C</i>", u(fmt(radio.C * 1e12, 0), "pF"), `L = ${fmt(L_RX * 1e6, 0)} μH`);
  setRO("r3", "To‘lqin uzunligi", u(fmt(P.lambdaOf(fz), 0), "m"), P.radioBand(fz));
  setRO("r4", "O‘tkazish polosasi <i>Δf</i>", u(fmt(P.bandwidth(fz, radio.Q) / 1e3, 1), "kHz"), `Δf = ν₀/Q, Q = ${fmt(radio.Q, 0)}`);
  setRO("r5", "Eshitilmoqda", rc.best === null ? "hech narsa" : rc.mixed ? "aralash" : st[rc.best].label, rc.best === null ? "stansiyaga sozlang" : rc.mixed ? "ikki stansiya bir vaqtda — Q ni oshiring" : `${fmt(st[rc.best].f / 1e6, 2)} MHz, tovush ${fmt(st[rc.best].F, 1)} kHz`, rc.best === null ? "" : "orange");
  setRO("r6", radio.mod === "am" ? "Modulyatsiya chuqurligi <i>m</i>" : "Chastota og‘ishi", radio.mod === "am" ? fmt(radio.m, 2) : u(fmt(radio.m * 75, 0), "kHz"), radio.mod === "am" ? "1-stansiya, AM" : "1-stansiya, FM (Δf)");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "wave") { t = P.bandOf(nu()).name; tone = "purple"; }
  else if (ui.mode === "props") { t = props.view === "reflect" ? "Qaytish: α = β" : props.view === "refract" ? "Sinish: sinα = n sinβ" : `Signal ${fmt(P.receiverPower(props.phi) * 100, 0)} %`; tone = "green"; }
  else { const rc = received(); t = rc.best === null ? "Shovqin: stansiya yo‘q" : rc.mixed ? "Stansiyalar aralashmoqda" : `Eshitilmoqda: ${STATIONS[rc.best].label}`; tone = rc.best === null ? "blue" : rc.mixed ? "orange" : "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "wave") {
    p.push("<p>Tezlanish bilan harakatlanayotgan zaryadlar (vibratordagi tebranuvchi tok) atrofida o‘zgaruvchan elektr maydon o‘zgaruvchan magnit maydonni, u esa yana elektr maydonni hosil qiladi — fazoda <b>elektromagnit to‘lqin</b> tarqaladi (Maksvell nazariyasi, Gers tajribasi). E va B o‘zaro perpendikulyar va tarqalish yo‘nalishiga ham perpendikulyar — to‘lqin <b>ko‘ndalang</b>.</p>");
    p.push(`<p>Vakuumda tezlik c = 1/√(ε₀μ₀) ≈ 3·10⁸ m/s — yorug‘lik tezligiga teng. Bu yorug‘lik ham EM to‘lqin ekanini ko‘rsatdi. ${med().n > 1 ? `Muhitda (n = ${fmt(med().n, 1)}) to‘lqin sekinroq va to‘lqin uzunligi qisqaroq, chastota esa o‘zgarmaydi.` : ""}</p>`);
    const b = P.bandOf(nu());
    p.push({ radio: "<p><b>Radioto‘lqinlar</b> radioeshittirish, televideniye va mobil aloqada ishlatiladi. Uzun va o‘rta to‘lqinlar Yer sirtini aylanib o‘tadi, qisqa to‘lqinlar ionosferadan qaytadi, UQT esa to‘g‘ri chiziq bo‘ylab (ko‘rinish chegarasigacha) tarqaladi.</p>", micro: "<p><b>Mikroto‘lqinlar</b>: radiolokatsiya, sun’iy yo‘ldosh aloqasi, Wi-Fi, mikroto‘lqinli pech (2,45 GHz — suv molekulalari tebranadi).</p>", ir: "<p><b>Infraqizil nurlanish</b> — issiq jismlar chiqaradi (issiqlik nurlanishi). Teplovizor, masofadan boshqarish pulti.</p>", vis: "<p><b>Ko‘rinadigan yorug‘lik</b> — ko‘z sezadigan tor oraliq: ≈ 380–750 nm. To‘lqin uzunligi rangni belgilaydi.</p>", uv: "<p><b>Ultrabinafsha nurlanish</b> — quyoshda tanani qoraytiradi, D vitamini hosil qiladi, bakteriyalarni o‘ldiradi; ko‘p miqdorda zararli.</p>", xray: "<p><b>Rentgen nurlari</b> — tez elektronlar to‘satdan tormozlanganda hosil bo‘ladi. Yumshoq to‘qimadan o‘tadi, suyakda yutiladi — tibbiyotda tasvir olish.</p>", gamma: "<p><b>Gamma-nurlanish</b> — yadro jarayonlarida chiqadi, eng katta energiyali EM to‘lqinlar.</p>" }[b.id]);
  } else if (ui.mode === "props") {
    p.push("<p>Genrix Gers (1888) EM to‘lqinlarning yorug‘lik kabi xossalarga ega ekanini isbotladi: metall listdan <b>qaytadi</b>, dielektrik prizmada <b>sinadi</b>, metall panjara orqali o‘tganda <b>qutblanadi</b>, shuningdek interferensiya va difraksiya hosil qiladi.</p>");
    p.push(props.view === "polar" ? "<p>Nurlatgich vibratori vertikal — to‘lqinning E vektori vertikal tebranadi. Qabul qiluvchi vibratorda tok faqat E ning vibrator bo‘ylab tashkil etuvchisi (E cosφ) hosil qiladi. Shuning uchun televizor antennalari uzatgich antennasi bilan bir xil holatda o‘rnatiladi.</p>" : props.view === "reflect" ? "<p>Radiolokatsiya shu xossaga asoslangan: radar impuls yuboradi va qaytgan signal kechikishidan masofani topadi: s = ct/2.</p>" : "<p>Dielektrikda to‘lqin tezligi kamayadi: v = c/n, n = √ε (radioto‘lqinlar uchun). Tezlik o‘zgargani uchun to‘lqin fronti buriladi — sinish.</p>");
  } else {
    p.push("<p><b>Radioaloqa</b>: tovush (past chastota, ~1 kHz) uzoqqa o‘zi tarqala olmaydi, shuning uchun u yuqori chastotali <b>tashuvchi</b> tebranishga «yuklanadi» — <b>modulyatsiya</b>. AM da tashuvchining amplitudasi, FM da chastotasi tovush bilan o‘zgaradi.</p>");
    p.push("<p>Priyomnikda antenna barcha stansiyalarni qabul qiladi. <b>Tebranish konturi</b> (L va C) faqat rezonans chastotasiga yaqin signalni kuchaytiradi — sozlash. <b>Detektor</b> (diod va RC filtr) tashuvchini olib tashlab tovush signalini ajratadi, karnay uni tovushga aylantiradi.</p>");
    if (radio.mod === "fm") p.push("<p>FM da amplituda o‘zgarmas — shovqinlarga chidamliroq, ovoz sifati yaxshiroq. FM stansiyalar odatda UQT diapazonida (88–108 MHz) ishlaydi; bu yerda taqqoslash uchun bir xil diapazonda ko‘rsatilgan.</p>");
    if (received().mixed) p.push("<p>Kontur aslligi past — o‘tkazish polosasi keng, qo‘shni stansiya ham eshitiladi. Q ni oshiring.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "wave" ? "<small>EM to‘lqin</small> λ = c/ν, c = 1/√(ε₀μ₀)" : ui.mode === "props" ? (props.view === "polar" ? "<small>Qutblanish</small> P = P₀cos²φ" : props.view === "reflect" ? "<small>Qaytish</small> α = β" : "<small>Sinish</small> sinα/sinβ = n") : "<small>Kontur</small> ν₀ = 1/(2π√(LC))";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  const s = dt * ui.speed;
  if (ui.mode === "wave") {
    wave.u += s * 0.6;
    wave.hist.push({ u: wave.u, e: probeE(wave.u) });
    while (wave.hist.length && wave.hist[0].u < wave.u - 3) wave.hist.shift();
  } else if (ui.mode === "props") props.ph += s * 1.2;
  else radio.t += s * 0.5;
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.2) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => { if (loop.running) loop.stop(); else loop.start(); });
$("[data-reset]").addEventListener("click", () => { wave.u = 0; wave.hist = []; props.ph = 0; radio.t = 0; refresh(); });
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; syncSpeed(); }));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.speedValue === ui.speed)));
/** Animatsiyasiz rejimda E(t) grafigini bir martalik to'ldirish */
function fillHist() {
  const top = Math.max(wave.u, 3);
  wave.hist = Array.from({ length: 121 }, (_, k) => { const uu = top - 3 + (3 * k) / 120; return { u: uu, e: probeE(uu) }; });
}

/* ------------------------------------------------------------------ Boshqaruv */

const fmtNu = (lg) => { const f = 10 ** lg; return f >= 1e9 && f < 1e12 ? `${sci(f / 1e9, 3)} GHz` : f >= 1e6 && f < 1e9 ? `${sci(f / 1e6, 3)} MHz` : f >= 1e3 && f < 1e6 ? `${sci(f / 1e3, 3)} kHz` : `${sci(f, 3)} Hz`; };
const wNuC = bindRange($("#wNu"), $("#wNuOut"), fmtNu, (v) => { wave.lg = v; customized(); if (!loop.running) fillHist(); refresh(); });
const wEC = bindRange($("#wE"), $("#wEOut"), (v) => `${fmt(v, 0)} V/m`, (v) => { wave.E0 = v; customized(); refresh(); });
const wMed = $("#wMed");
wMed.innerHTML = Object.entries(MEDIA).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
wMed.addEventListener("change", () => { wave.med = wMed.value; customized(); refresh(); });
$("[data-show-b]").addEventListener("change", (e) => { wave.showB = e.target.checked; stage.render(); });

document.querySelectorAll("[data-pview-value]").forEach((b) => b.addEventListener("click", () => { props.view = b.dataset.pviewValue; scene.setMode(props.view); customized(); syncProps(); setTab("ang"); refresh(); }));
const pAC = bindRange($("#pA"), $("#pAOut"), (v) => `${fmt(v, 0)}°`, (v) => { props.a = v * DEG; customized(); refresh(); });
const pNC = bindRange($("#pN"), $("#pNOut"), (v) => fmt(v, 2), (v) => { props.n = v; customized(); setTab("ang"); refresh(); });
const pPhiC = bindRange($("#pPhi"), $("#pPhiOut"), (v) => `${fmt(v, 0)}°`, (v) => { props.phi = v * DEG; customized(); refresh(); });
function syncProps() {
  document.querySelectorAll("[data-pview-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pviewValue === props.view)));
  document.querySelectorAll("[data-pv]").forEach((el) => { el.hidden = !el.dataset.pv.split(" ").includes(props.view); });
  pAC.set(Math.round(props.a / DEG)); pNC.set(props.n); pPhiC.set(Math.round(props.phi / DEG));
}

document.querySelectorAll("[data-mod-value]").forEach((b) => b.addEventListener("click", () => { radio.mod = b.dataset.modValue; customized(); syncRadio(); refresh(); }));
const rFC = bindRange($("#rF"), $("#rFOut"), (v) => `${fmt(v, 1)} kHz`, (v) => { radio.F = v; customized(); refresh(); });
const rMC = bindRange($("#rM"), $("#rMOut"), (v) => (radio.mod === "am" ? fmt(v, 2) : `${fmt(v * 75, 0)} kHz`), (v) => { radio.m = v; customized(); refresh(); });
const rCC = bindRange($("#rC"), $("#rCOut"), (v) => `${fmt(v, 0)} pF (${fmt(P.resonance(L_RX, v * 1e-12) / 1e6, 3)} MHz)`, (v) => { radio.C = v * 1e-12; customized(); refresh(); });
const rQC = bindRange($("#rQ"), $("#rQOut"), (v) => fmt(v, 0), (v) => { radio.Q = v; customized(); refresh(); });
function syncRadio() {
  document.querySelectorAll("[data-mod-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modValue === radio.mod)));
  $("[data-m-label]").textContent = radio.mod === "am" ? "Modulyatsiya chuqurligi m" : "Chastota og‘ishi Δf";
  rFC.set(radio.F); rMC.set(radio.m); rCC.set(Math.round(radio.C * 1e12)); rQC.set(radio.Q);
}

/* Sahnada (3D): o'lchov nuqtasi, nurlatgich, qabul qiluvchi, sozlash shkalasi */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
bindLabCamera(canvas, scene.lab, () => stage.render(), {
  start(id) { drag = { kind: id }; customized(); },
  move(id, p) {
    if (!drag || drag.kind !== id) return;
    const L = scene.lab;
    if (id === "probe") { wave.probe = clamp(Math.round(L.nearest(scene.probeAt, 0.02, 0.98, p.x, p.y) * 200) / 200, 0.02, 0.98); wave.hist = []; if (!loop.running) fillHist(); }
    else if (id === "emit") { const a = scene.emitAngle(p); if (a == null) return; props.a = clamp(Math.round(a / DEG), 0, 80) * DEG; pAC.set(Math.round(props.a / DEG)); }
    else if (id === "rx") { const a = scene.rxAngle(p); if (a == null) return; props.phi = clamp(Math.round(a / DEG), 0, 180) * DEG; pPhiC.set(Math.round(props.phi / DEG)); }
    else if (id === "dial") { const f = L.nearest(scene.dialAt, 0.5, 1.6, p.x, p.y) * 1e6; radio.C = clamp(P.capFor(L_RX, f), 40e-12, 550e-12); rCC.set(Math.round(radio.C * 1e12)); radio.C = rCC.value * 1e-12; }
    refresh();
  },
  end() { drag = null; refresh(); },
});

/* Grafikda kursor (ulush 0…1) */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) return;
  const p = ptr(gcv, e), r = f.rect;
  ui.hover = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h ? (p.x - r.x) / r.w : null;
  gcv.style.cursor = ui.hover !== null ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const LG = (f) => Math.log10(f);
const PRESETS = {
  fm100: { mode: "wave", title: "Radioto‘lqin: 100 MHz", lesson: "FM radio chastotasi 100 MHz: to‘lqin uzunligi 3 m. E va B bir xil fazada tebranadi, o‘zaro va tarqalish yo‘nalishiga perpendikulyar.", set: () => Object.assign(wave, { lg: 8, med: "vac", E0: 50 }) },
  mw: { mode: "wave", title: "O‘rta to‘lqin: λ ≈ 300 m", lesson: "1 MHz — o‘rta to‘lqinli radio: to‘lqin uzunligi 300 m. Shuning uchun bunday radiostansiyalarning antennalari juda baland.", set: () => Object.assign(wave, { lg: 6, med: "vac", E0: 50 }) },
  tv: { mode: "wave", title: "Televideniye: UQT", lesson: "Televizion signal 470–790 MHz (detsimetrli to‘lqinlar) da uzatiladi: tasvir signali keng chastota polosasini talab qiladi, buni faqat yuqori chastotali tashuvchi sig‘dira oladi. UQT to‘g‘ri chiziq bo‘ylab tarqaladi — teleminoralar baland quriladi, uzoqqa yo‘ldosh orqali uzatiladi.", set: () => Object.assign(wave, { lg: LG(600e6), med: "vac", E0: 50 }) },
  micro: { mode: "wave", title: "Mikroto‘lqin: 2,45 GHz", lesson: "Mikroto‘lqinli pech va Wi-Fi chastotasi: λ ≈ 12 cm. Suv molekulalari shu maydonda tebranib ovqatni isitadi.", set: () => Object.assign(wave, { lg: LG(2.45e9), med: "vac", E0: 50 }), tab: "spec" },
  light: { mode: "wave", title: "Yorug‘lik — EM to‘lqin", lesson: "Yashil yorug‘lik: ν ≈ 5,5·10¹⁴ Hz, λ ≈ 550 nm. Maksvell yorug‘lik tezligi c = 1/√(ε₀μ₀) ekanini hisoblab, yorug‘lik EM to‘lqin degan xulosaga keldi.", set: () => Object.assign(wave, { lg: LG(5.45e14), med: "vac", E0: 50 }), tab: "spec" },
  glass: { mode: "wave", title: "Shishada yorug‘lik sekinlashadi", lesson: "Shishada (n ≈ 1,5) yorug‘lik tezligi 2·10⁸ m/s gacha kamayadi, to‘lqin uzunligi ham 1,5 marta qisqaradi; chastota o‘zgarmaydi.", set: () => Object.assign(wave, { lg: LG(5.45e14), med: "glass", E0: 50 }) },
  xray: { mode: "wave", title: "Rentgen nurlari", lesson: "Rentgen nurlari: ν ≈ 10¹⁸ Hz, λ ≈ 0,3 nm — atom o‘lchami tartibida. Spektr grafigida IQ, UB, rentgen va gamma-nurlanish o‘rnini ko‘ring.", set: () => Object.assign(wave, { lg: 18, med: "vac", E0: 50 }), tab: "spec" },
  reflect: { mode: "props", title: "Metall listdan qaytish", lesson: "Gers tajribasi: generator karnay antennasidan chiqqan santimetrli to‘lqinlar metall listdan qaytadi. Nurlatgichni surib, qabul qiluvchi doim α = β yo‘nalishda signal olishini kuzating.", set: () => Object.assign(props, { view: "reflect", a: 40 * DEG }) },
  refract: { mode: "props", title: "Dielektrikda sinish", lesson: "To‘lqin parafin (n ≈ 1,5) ga o‘tganda sekinlashadi va sinadi: sinα = n·sinβ. To‘lqin fronti oralig‘i (λ) dielektrikda qisqaroq.", set: () => Object.assign(props, { view: "refract", a: 45 * DEG, n: 1.5 }) },
  polar: { mode: "props", title: "Qutblanish: vibratorni burish", lesson: "Qabul qiluvchi vibratorni burang: E ga parallel (φ = 0°) — signal maksimal, 90° da — nol. EM to‘lqin ko‘ndalang ekanining isboti.", set: () => Object.assign(props, { view: "polar", phi: 30 * DEG }) },
  am: { mode: "radio", title: "AM radio: modulyatsiya va detektorlash", lesson: "Tovush (1 kHz) tashuvchining amplitudasini o‘zgartiradi. Priyomnik 1-stansiyaga sozlangan: kontur uni tanlaydi, detektor konvertni ajratadi — karnayda o‘sha tovush.", set: () => { Object.assign(radio, { mod: "am", F: 1, m: 0.6, Q: 40 }); radio.C = P.capFor(L_RX, 0.70e6); } },
  tune: { mode: "radio", title: "Stansiyani sozlash", lesson: "Priyomnik stansiyalar orasiga sozlangan — hech narsa eshitilmaydi. Sahnadagi shkala tutqichini surib 2- va 3-stansiyani toping; tovush chastotalari har xil.", set: () => { Object.assign(radio, { mod: "am", F: 1, m: 0.6, Q: 40 }); radio.C = P.capFor(L_RX, 0.85e6); }, tab: "rez" },
  lowQ: { mode: "radio", title: "Past aslilik: stansiyalar aralashadi", lesson: "Q = 6: rezonans egri chizig‘i keng — 2-stansiyaga sozlanganda qo‘shnilar ham o‘tadi va tovushlar aralashadi. Q ni oshirib tanlovchanlikni yaxshilang.", set: () => { Object.assign(radio, { mod: "am", F: 1, m: 0.6, Q: 6 }); radio.C = P.capFor(L_RX, 0.99e6); } },
  fm: { mode: "radio", title: "FM: chastota modulyatsiyasi", lesson: "FM da tashuvchi amplitudasi o‘zgarmaydi, tovush bilan uning chastotasi o‘zgaradi (zichlashadi va siyraklashadi). Shovqin amplitudani buzsa ham tovush saqlanadi.", set: () => { Object.assign(radio, { mod: "fm", F: 1, m: 0.8, Q: 40 }); radio.C = P.capFor(L_RX, 0.70e6); }, tab: "sig" },
};
const GROUPS = [["EM to‘lqin va spektr", ["fm100", "mw", "tv", "micro", "light", "glass", "xray"]], ["Xossalari (Gers)", ["reflect", "refract", "polar"]], ["Radioaloqa", ["am", "tune", "lowQ", "fm"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { wave: "O‘lchov nuqtasini suring", props: "Nurlatgich yoki qabul qiluvchini suring", radio: "Priyomnik shkalasini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  scene.setMode(ui.mode === "props" ? props.view : ui.mode); // kamera shu tajribaga mos ko'rinishga (rejim almashgandagina)
  stage.canvas.setAttribute("aria-label", { wave: "Vibrator nurlatayotgan elektromagnit to‘lqin: E va B maydonlar", props: "Gers tajribalari: EM to‘lqinning qaytishi, sinishi va qutblanishi", radio: "Radiouzatgich va radiopriyomnik blok-sxemasi, ossillogrammalar va sozlash shkalasi" }[ui.mode]);
}
function syncAll() { wNuC.set(wave.lg); wEC.set(wave.E0); wMed.value = wave.med; $("[data-show-b]").checked = wave.showB; syncProps(); syncRadio(); syncSpeed(); }
const MODE_DEFAULT = { wave: "fm100", props: "reflect", radio: "am" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set(); wave.hist = []; wave.u = 0;
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || Object.keys(TABS[ui.mode])[0]);
  stage.render(); fillHist();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  setPlayUI(loop.running); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "fm100");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
window.__emwaves = { wave, props, radio, ui, loadPreset, refresh, scene, frameCfg };
