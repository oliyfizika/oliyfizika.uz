// ==========================================================================
// Suyuqlik va gaz harakati — virtual laboratoriya (simulations/fluid.html)
// 1) Oqim uzluksizligi: uch kesimli quvur (devor tutqichlari bilan diametrlar), jo'mrak dastagi (Q), zarralar
//    v = Q/S tezlik bilan oqadi, rangli «bo'lak» — uzunligi o'zgaradi, hajmi saqlanadi.
// 2) Bernulli qonuni: tor joyli va ko'tariluvchi quvur, to'rtta manometr (ustun balandligi p/ρg), energiya chizig'i,
//    Venturi trubkasi (grafiksiz — napor hadlari sahnadagi manometrlarda ko'rinadi).
// 3) Qo'llanishlar: Torichelli (sath va teshikni surish, uchish masofasi), qanot (Jukovskiy profili atrofidagi
//    potensial oqim, bosim xaritasi, chiqish qirrasini surib hujum burchagi), purkagich (naychani surish).
// Fizika: fluid-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./fluid-physics.js";
import { createFluidLab } from "./fluid-lab-3d.js?v=20261123-batch7b";
import { bindLabCamera } from "./lab-3d.js?v=20261123-batch7b";
import { detailedStageHeight } from "./apparatus-3d.js?v=20261123-batch7b";

const $ = (s) => document.querySelector(s);
const DEG = Math.PI / 180;
const COL = { y: "#64748b", p: "#2563eb", v: "#16a34a", e: "#9333ea", slab: "#ea580c" };
const g0 = P.G;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "flow", sub: "tor", show: { vec: true }, t: 0 };
const flow = { Q: 1, d: [10, 5, 8], pipe: null, slab: null };
const D1B = 10, BX = [12, 50, 85, 122];
const bern = { Q: 2.5, dt: 5, p1: 45, dy: 0, pipe: null };
const tor = { H: 1.3, holes: 1, yh: 0.45 };
const wing = { V: 40, alpha: 5 * DEG, foil: null, key: "", lines: null, pmap: null, pkey: "", top: null, bot: null, CHORD: 1.5 };
const spray = { v: 25, hs: 3 };
let presetId = null;


/* ------------------------------------------------------------------ Quvur (umumiy) */

/** secs: [{x0, x1, d, y}] — o'zgarmas bo'laklar, oralarida silliq o'tish. Uzunlik — cm. */
function makePipe(secs) {
  const x0 = secs[0].x0, x1 = secs[secs.length - 1].x1, sm = (u) => u * u * (3 - 2 * u);
  function at(x) {
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i];
      if (x <= s.x1) {
        if (i === 0 || x >= s.x0) return { d: s.d, y: s.y };
        const p = secs[i - 1], u = sm((x - p.x1) / (s.x0 - p.x1));
        return { d: p.d + (s.d - p.d) * u, y: p.y + (s.y - p.y) * u };
      }
    }
    const s = secs[secs.length - 1]; return { d: s.d, y: s.y };
  }
  const S = (x) => { const d = at(x).d; return (Math.PI * d * d) / 4; };
  const slope = (x) => (at(x + 0.25).y - at(x - 0.25).y) / 0.5;
  return { x0, x1, at, S, slope, dmax: Math.max(...secs.map((s) => s.d)) };
}
/** Quvur o'qi bo'ylab gorizontal tezlik, cm/s (Qc — cm³/s). */
const vx = (pipe, Qc, x) => { const s = pipe.slope(x); return Qc / pipe.S(x) / Math.sqrt(1 + s * s); };
function makeParts(n) { return { n, x: new Float64Array(n), e: new Float64Array(n) }; }
/** Zarralar hajm bo'yicha tekis: chiziqli zichlik ~ S. */
function seedParts(pt, pipe) {
  const L = pipe.x1 - pipe.x0, dm2 = pipe.dmax ** 2;
  for (let i = 0; i < pt.n; i++) { let x; do { x = pipe.x0 + Math.random() * L; } while (Math.random() * dm2 > pipe.at(x).d ** 2); pt.x[i] = x; pt.e[i] = (Math.random() * 2 - 1) * 0.86; }
}
function advect(pt, pipe, Qc, dt) {
  const L = pipe.x1 - pipe.x0;
  for (let i = 0; i < pt.n; i++) {
    let x = pt.x[i]; for (let k = 0; k < 3; k++) x += (vx(pipe, Qc, x) * dt) / 3;
    if (x > pipe.x1) { x -= L; pt.e[i] = (Math.random() * 2 - 1) * 0.86; }
    pt.x[i] = x;
  }
}
/* ================================================================== 1) Oqim uzluksizligi */

const flowParts = makeParts(280);
function rebuildFlow(reseed = true) {
  const d = flow.d;
  flow.pipe = makePipe([{ x0: 0, x1: 24, d: d[0], y: 0 }, { x0: 36, x1: 56, d: d[1], y: 0 }, { x0: 68, x1: 92, d: d[2], y: 0 }]);
  if (reseed) seedParts(flowParts, flow.pipe);
  newSlab();
}
/** a..b oralig'idagi hajm (cm³); quvur tashqarisida oxirgi kesim davom etadi. */
function volBetween(pipe, a, b) { let V = 0; for (let x = a; x < b; x += 0.25) V += pipe.S(Math.min(x + 0.125, pipe.x1)) * Math.min(0.25, b - x); return V; }
function newSlab() {
  const pipe = flow.pipe, V = pipe.S(0) * 10; let b = 0, acc = 0;
  while (acc < V && b < 400) { acc += pipe.S(Math.min(b + 0.125, pipe.x1)) * 0.25; b += 0.25; }
  flow.slab = { a: 0, b, V: volBetween(pipe, 0, b) };
}
function stepFlow(dt) {
  const Qc = flow.Q * 1000, pipe = flow.pipe; advect(flowParts, pipe, Qc, dt);
  const sl = flow.slab;
  for (let k = 0; k < 3; k++) { sl.a += (vx(pipe, Qc, Math.min(sl.a, pipe.x1)) * dt) / 3; sl.b += (vx(pipe, Qc, Math.min(sl.b, pipe.x1)) * dt) / 3; }
  if (sl.a > pipe.x1 + 2) newSlab();
}
const flowV = (i) => P.speed(flow.Q / 1000, flow.d[i] / 100) * 100; // cm/s
/* ================================================================== 2) Bernulli qonuni */

const bernParts = makeParts(260);
function rebuildBern(reseed = true) {
  bern.pipe = makePipe([{ x0: 0, x1: 25, d: D1B, y: 0 }, { x0: 40, x1: 60, d: bern.dt, y: 0 }, { x0: 75, x1: 95, d: D1B, y: 0 }, { x0: 112, x1: 136, d: D1B, y: bern.dy }]);
  if (reseed) seedParts(bernParts, bern.pipe);
}
/** x nuqtada: tezlik (m/s), manometrdagi ortiqcha bosim ustuni hp (cm), pyezometrik sath lvl (cm), to'liq napor E (cm). */
function bernAt(x) {
  const a = bern.pipe.at(x), v = P.speed(bern.Q / 1000, a.d / 100), v1 = P.speed(bern.Q / 1000, D1B / 100);
  const p1 = (P.RHO_W * g0 * bern.p1) / 100, p = P.bernoulliP(p1, v1, 0, v, a.y / 100), hp = (p / (P.RHO_W * g0)) * 100;
  return { ...a, v, v1, p, hp, lvl: a.y + hp, E: bern.p1 + ((v1 * v1) / (2 * g0)) * 100 };
}
function stepBern(dt) { advect(bernParts, bern.pipe, bern.Q * 1000, dt); }
rebuildFlow(); rebuildBern();
/* ================================================================== 3a) Torichelli */

const torHoles = () => (tor.holes === 1 ? [tor.yh] : [0.25, 0.5, 0.75].map((f) => f * tor.H));
/* ================================================================== 3b) Samolyot qanoti */

function foilUpdate() {
  const key = wing.alpha.toFixed(5); if (wing.key === key) return;
  wing.key = key; wing.foil = P.airfoil({ alpha: wing.alpha, V: 1 }); wing.lines = null; wing.pkey = "";
  const o = wing.foil.outline; let ti = 0, bi = 0, ty = -1e9, by = 1e9;
  o.forEach(([x, y], i) => { if (Math.abs(x) < 0.35) { if (y > ty) { ty = y; ti = i; } if (y < by) { by = y; bi = i; } } });
  const sp = (x, y) => { const v = wing.foil.vel(x, y); return v ? Math.hypot(v[0], v[1]) : NaN; };
  wing.top = { q: sp(o[ti][0], o[ti][1] + 0.05), x: o[ti][0], y: o[ti][1] + 0.05 }; wing.bot = { q: sp(o[bi][0], o[bi][1] - 0.05), x: o[bi][0], y: o[bi][1] - 0.05 };
}
const rotD = (x, y) => { const ca = Math.cos(wing.alpha), sa = Math.sin(wing.alpha); return [x * ca + y * sa, -x * sa + y * ca]; }; // fizik → ekran
function dvel(X, Y) {
  const ca = Math.cos(wing.alpha), sa = Math.sin(wing.alpha), v = wing.foil.vel(X * ca - Y * sa, X * sa + Y * ca);
  return v ? [v[0] * ca + v[1] * sa, -v[0] * sa + v[1] * ca] : null;
}
function streamlines() {
  if (wing.lines) return wing.lines;
  const out = [];
  for (let Y0 = -2.3; Y0 <= 2.31; Y0 += 0.26) {
    const pts = [[-4.8, Y0]]; let X = -4.8, Y = Y0;
    for (let k = 0; k < 900; k++) {
      const a = dvel(X, Y); if (!a) break; const q = Math.hypot(a[0], a[1]); if (q < 0.02) break;
      const h = 0.03, mX = X + (a[0] / q) * h * 0.5, mY = Y + (a[1] / q) * h * 0.5, b = dvel(mX, mY); if (!b) break; const qb = Math.hypot(b[0], b[1]); if (qb < 0.02) break;
      X += (b[0] / qb) * h; Y += (b[1] / qb) * h; pts.push([X, Y]); if (X > 5.2 || Math.abs(Y) > 2.8) break;
    }
    out.push(pts);
  }
  wing.lines = out; return out;
}
const WN = 150, wingP = { X: new Float64Array(WN), Y: new Float64Array(WN), age: new Float64Array(WN) };
function seedWing(all = true) { for (let i = 0; i < WN; i++) { wingP.X[i] = all ? -4.8 + Math.random() * 10 : -4.8; wingP.Y[i] = -2.4 + Math.random() * 4.8; wingP.age[i] = 0; } }
function stepWing(dt) {
  if (!wing.foil) return; const k = (wing.V / 40) * 1.5;
  for (let i = 0; i < WN; i++) {
    const a = dvel(wingP.X[i], wingP.Y[i]); wingP.age[i] += dt;
    if (!a || wingP.X[i] > 5.1 || Math.abs(wingP.Y[i]) > 2.7 || wingP.age[i] > 14) { wingP.X[i] = -4.8; wingP.Y[i] = -2.4 + Math.random() * 4.8; wingP.age[i] = 0; continue; }
    const mX = wingP.X[i] + a[0] * k * dt * 0.5, mY = wingP.Y[i] + a[1] * k * dt * 0.5, b = dvel(mX, mY) || a;
    wingP.X[i] += b[0] * k * dt; wingP.Y[i] += b[1] * k * dt;
  }
}
/* ================================================================== 3c) Purkagich */

/* ------------------------------------------------------------------ Asosiy chizish */

const scene = createFluidLab();
function draw(ctx,st) {
  if(ui.mode==='app'&&ui.sub==='wing')foilUpdate();
  scene.draw(ctx,st,ui,flow,bern,tor,wing,spray,{flow:flowParts,bern:bernParts,wing:wingP},{bernAt,rot:rotD,vel:dvel,lines:streamlines});
}
const stage=createStage($("#stage"),draw,{height:detailedStageHeight});

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, d, unit) => `${fmt(v, d)}<small>${unit}</small>`;
const S_cm2 = (d) => (Math.PI * d * d) / 4;
function updateReadouts() {
  if (ui.mode === "flow") {
    const vs = [0, 1, 2].map(flowV);
    setRO("r1", "Suv sarfi <i>Q</i>", u(flow.Q, 2, "L/s"), `= ${fmt(flow.Q * 1000, 0)} cm³/s — har kesimda bir xil`);
    [0, 1, 2].forEach((i) => setRO(`r${i + 2}`, `${i + 1}-kesimda tezlik <i>v${"₁₂₃"[i]}</i>`, u(vs[i], vs[i] < 10 ? 2 : 1, "cm/s"), `S${"₁₂₃"[i]} = ${fmt(S_cm2(flow.d[i]), 1)} cm²; S·v = ${fmt(S_cm2(flow.d[i]) * vs[i], 0)} cm³/s`));
    setRO("r5", "Nisbat <i>v₂/v₁</i>", fmt(vs[1] / vs[0], 2), `= S₁/S₂ = (d₁/d₂)² = (${fmt(flow.d[0], 1)}/${fmt(flow.d[1], 1)})²`);
    setRO("r6", "Belgilangan hajm <i>V</i>", u(flow.slab.V, 0, "cm³"), "uzunligi o‘zgaradi, hajmi — yo‘q", "orange");
  } else if (ui.mode === "bern") {
    const b = BX.map(bernAt), S1 = S_cm2(D1B), S2 = S_cm2(bern.dt), dh = b[0].hp - b[1].hp, dp = P.RHO_W * g0 * (dh / 100);
    setRO("r1", "Suv sarfi <i>Q</i>", u(bern.Q, 1, "L/s"), `v₁ = ${fmt(b[0].v, 2)} m/s (d₁ = ${fmt(D1B, 0)} cm)`);
    setRO("r2", "Tor joyda tezlik <i>v₂</i>", u(b[1].v, 2, "m/s"), `S₁/S₂ = ${fmt(S1 / S2, 2)} marta tez`);
    setRO("r3", "Manometrlar farqi <i>h₁ − h₂</i>", u(dh, 1, "cm"), `Δp = ρgΔh = ${fmt(dp, 0)} Pa`);
    setRO("r4", "Venturi: <i>v₁</i> o‘lchovdan", u(dh > 0 ? P.venturiV1(dp, S1, S2) : 0, 2, "m/s"), "v₁ = √(2Δp / ρ((S₁/S₂)² − 1))");
    setRO("r5", "Ko‘tarilgan joyda <i>h₄</i>", u(b[3].hp, 1, "cm"), bern.dy > 0 ? `h₁ − h₄ = Δy = ${fmt(bern.dy, 0)} cm` : "h₄ = h₃ = h₁ (tezlik bir xil)");
    setRO("r6", "Tor joyda bosim <i>h₂</i>", u(b[1].hp, 1, "cm"), b[1].hp < 0 ? "atmosfera bosimidan past!" : "atmosferaga nisbatan ortiqcha", b[1].hp < bern.dt / 2 ? "red" : "");
  } else if (ui.sub === "tor") {
    const holes = torHoles();
    if (tor.holes === 1) {
      const y = tor.yh, v = P.torricelliV(tor.H - y), l = P.jetRange(tor.H, y);
      setRO("r1", "Suv sathi <i>H</i>", u(tor.H, 2, "m"), "jo‘mrak sathni o‘zgarmas saqlaydi");
      setRO("r2", "Teshik chuqurligi <i>h</i>", u(tor.H - y, 2, "m"), `teshik poldan y = ${fmt(y, 2)} m`);
      setRO("r3", "Oqib chiqish tezligi <i>v</i>", u(v, 2, "m/s"), "v = √(2gh) — erkin tushgandek");
      setRO("r4", "Uchish vaqti <i>t</i>", u(Math.sqrt((2 * y) / g0), 2, "s"), "t = √(2y/g)");
      setRO("r5", "Uchish masofasi <i>l</i>", u(l, 2, "m"), "l = v·t = 2√(h·y)");
      setRO("r6", "Eng uzoq masofa", u(tor.H, 2, "m"), "y = H/2 bo‘lganda l = H", Math.abs(y - tor.H / 2) < 0.02 ? "green" : "");
    } else {
      setRO("r1", "Suv sathi <i>H</i>", u(tor.H, 2, "m"), "teshiklar: H/4, H/2, 3H/4");
      holes.forEach((y, i) => setRO(`r${i + 2}`, `${["Yuqori", "O‘rta", "Pastki"][2 - i]} teshik <i>l${"₁₂₃"[i]}</i>`, u(P.jetRange(tor.H, y), 2, "m"), `v = ${fmt(P.torricelliV(tor.H - y), 2)} m/s, y = ${fmt(y, 2)} m`, i === 1 ? "green" : ""));
      setRO("r5", "Tezliklar nisbati", fmt(P.torricelliV(tor.H - holes[0]) / P.torricelliV(tor.H - holes[2]), 2), "pastki/yuqori: √3 ≈ 1,73");
      setRO("r6", "l₁ = l₃", "✓", "chuqurroq — tezroq, lekin pastroq: vaqt kam");
    }
  } else if (ui.sub === "wing") {
    foilUpdate(); const f = wing.foil, Lp = P.liftPerSpan(P.RHO_AIR, wing.V, wing.CHORD, f.CL), dp = 0.5 * P.RHO_AIR * wing.V ** 2 * (wing.top.q ** 2 - wing.bot.q ** 2);
    setRO("r1", "Oqim tezligi <i>V</i>", u(wing.V, 0, "m/s"), `= ${fmt(wing.V * 3.6, 0)} km/soat`);
    setRO("r2", "Hujum burchagi <i>α</i>", u(wing.alpha / DEG, 1, "°"), `nol ko‘tarish: α₀ = −${fmt(f.beta / DEG, 1)}° (egilgan profil)`);
    setRO("r3", "Ko‘tarish koeffitsiyenti <i>C<sub>y</sub></i>", fmt(f.CL, 2), "Kutta–Jukovskiy: Γ sirkulyatsiya");
    setRO("r4", "Ko‘tarish kuchi (1 m qanotga)", Lp >= 1000 ? u(Lp / 1000, 2, "kN") : u(Lp, 0, "N"), `F = ½ρV²·b·C_y, b = ${fmt(wing.CHORD, 1)} m`, Lp < 0 ? "red" : "green");
    setRO("r5", "Tezlik: ustida / ostida", `${fmt(wing.top.q, 2)} / ${fmt(wing.bot.q, 2)}<small>·V</small>`, "o‘rta qismda, sirt yonida");
    setRO("r6", "Bosimlar farqi <i>Δp</i>", u(dp, 0, "Pa"), "Δp = ½ρ(v_ust² − v_ost²)");
  } else {
    const h = P.sprayRise(spray.v) * 100, on = h >= spray.hs, dp = 0.5 * P.RHO_AIR * spray.v ** 2, vmin = Math.sqrt((2 * P.RHO_W * g0 * spray.hs) / 100 / P.RHO_AIR);
    setRO("r1", "Havo tezligi <i>v</i>", u(spray.v, 1, "m/s"), "naycha uchi ustida");
    setRO("r2", "Bosim pasayishi <i>Δp</i>", u(dp, 0, "Pa"), "Δp = ρₕv²/2 (ρₕ — havo zichligi)");
    setRO("r3", "Suyuqlik ko‘tariladi <i>h</i>", u(h, 1, "cm"), "h = ρₕv²/(2ρg)");
    setRO("r4", "Naycha balandligi <i>hₛ</i>", u(spray.hs, 1, "cm"), "suyuqlik sirtidan");
    setRO("r5", "Kerakli tezlik <i>v<sub>min</sub></i>", u(vmin, 1, "m/s"), "v_min = √(2ρghₛ/ρₕ)");
    setRO("r6", "Holat", on ? "purkaydi" : "yetmaydi", on ? "h ≥ hₛ: suyuqlik uchiga chiqdi" : `yana ${fmt(spray.hs - h, 1)} cm kerak`, on ? "green" : "orange");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "flow") { t = "Oqim barqaror: Q = const"; tone = "green"; }
  else if (ui.mode === "bern") { const neg = bernAt(50).lvl < bern.dt / 2; t = neg ? "Tor joyda bosim atmosferadan past" : "Bernulli: p + ρv²/2 + ρgh = const"; tone = neg ? "red" : "green"; }
  else if (ui.sub === "tor") { t = "Sath o‘zgarmas"; tone = "blue"; }
  else if (ui.sub === "wing") { const L = wing.foil ? wing.foil.CL : 0; t = L > 0.02 ? "Ko‘tarish kuchi yuqoriga" : L < -0.02 ? "Ko‘tarish kuchi pastga" : "Ko‘tarish kuchi ≈ 0"; tone = L > 0.02 ? "green" : "orange"; }
  else { const on = P.sprayRise(spray.v) * 100 >= spray.hs; t = on ? "Purkamoqda (sekinlashtirilgan)" : "Suyuqlik naychada ko‘tarildi"; tone = on ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "flow") {
    p.push("<p>Suyuqlik siqilmaydi, shuning uchun quvurning istalgan kesimidan 1 sekundda bir xil hajm o‘tadi: <b>Q = S·v = const</b> (oqim uzluksizligi). Kesim yuzasi kichik joyda suyuqlik tezroq oqadi: v₂/v₁ = S₁/S₂ = (d₁/d₂)².</p>");
    p.push("<p>To‘q sariq bo‘lak — bir xil suyuqlik hajmi. Tor joyga kirganda u cho‘ziladi, keng joyda qisqaradi, ammo hajmi (V) o‘zgarmaydi. Shlang uchini barmoq bilan qisganda suv uzoqqa otilishi ham shu sababli.</p>");
  } else if (ui.mode === "bern") {
    p.push("<p><b>Bernulli qonuni</b> — oqimdagi energiyaning saqlanishi: p + ρv²/2 + ρgh = const. Tor joyda tezlik ortadi (uzluksizlik), demak statik bosim p kamayadi — manometrdagi suv ustuni pasayadi. Keng joyda tezlik avvalgidek bo‘lsa, bosim ham tiklanadi (h₃ = h₁).</p>");
    p.push(bern.dy > 0 ? "<p>Quvur Δy ga ko‘tarilgan joyda tezlik o‘zgarmagan, lekin ρgh hadi ortgan — bosim ρgΔy ga kamayadi: manometr ustunining ustki sathi pastda turadi va sathlar yig‘indisi baribir energiya chizig‘iga yetadi.</p>" : "<p><b>Venturi trubkasi</b>: ikki manometr farqi Δh dan oqim tezligi va sarfini hisoblash mumkin. Sarfni ko‘paytiring yoki tor joyni toraytiring — bosim atmosferadan ham pasayishi mumkin: shunda trubka havoni (yoki suyuqlikni) so‘rib oladi.</p>");
  } else if (ui.sub === "tor") {
    p.push("<p><b>Torichelli formulasi</b>: chuqurligi h bo‘lgan teshikdan suv v = √(2gh) tezlik bilan otiladi — xuddi h balandlikdan erkin tushgan jism tezligidek. Bu Bernulli qonunining natijasi (sirtda va teshikda bosim atmosferaga teng).</p>");
    p.push(tor.holes === 1 ? "<p>Oqim gorizontal otilgan jism kabi parabola bo‘ylab uchadi: l = v·t = 2√(h·y). Teshikni surib ko‘ring: eng uzoq masofa teshik H/2 balandlikda bo‘lganda (l = H).</p>" : "<p>Pastki teshikdan suv eng tez otiladi, lekin polga yaqin — uchish vaqti kam. H/4 va 3H/4 teshiklar bir xil masofaga otadi, H/2 dagi teshik — eng uzoqqa.</p>");
  } else if (ui.sub === "wing") {
    p.push("<p>Qanot profili egilgan va oqimga α burchak ostida turadi. Qanot ustidagi oqim chiziqlari zichlashadi — u yerda havo tezroq oqadi, Bernulli qonuniga ko‘ra bosim kamayadi (ko‘k). Qanot ostida havo sekinroq va bosim kattaroq (qizil). Bosimlar farqi <b>ko‘tarish kuchini</b> hosil qiladi.</p>");
    p.push("<p>Ko‘tarish kuchi F = ½ρV²·S·C<sub>y</sub>: tezlik 2 marta ortsa, kuch 4 marta ortadi. Kichik burchaklarda C<sub>y</sub> burchakka deyarli proporsional; chiqish qirrasini surib α ni o‘zgartiring. Egilgan profil α = 0 da ham ko‘taradi.</p>");
  } else {
    p.push("<p><b>Purkagich (atomayzer)</b>: noksimon puflagich naycha uchi ustidan tez havo oqimini o‘tkazadi. Bernulli qonuniga ko‘ra oqimda bosim ρv²/2 ga kamayadi, idishdagi suyuqlik sirtiga esa atmosfera bosimi ta’sir qiladi — farq suyuqlikni naychada h = ρₕv²/(2ρg) balandlikka ko‘taradi (ρₕ — havo, ρ — suyuqlik zichligi).</p>");
    p.push("<p>Agar h naycha uchigacha yetsa, suyuqlik havo oqimiga chiqadi va mayda tomchilarga ajralib sochiladi. Naychani pastroq qo‘ying yoki tezroq puflang. Atir purkagichi, bo‘yoq purkagich va karburator shu tamoyilda ishlaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "flow" ? "<small>Uzluksizlik</small> S₁v₁ = S₂v₂" : ui.mode === "bern" ? "<small>Bernulli</small> p + ρv²/2 + ρgh = const" : ui.sub === "tor" ? "<small>Torichelli</small> v = √(2gh)" : ui.sub === "wing" ? "<small>Ko‘tarish kuchi</small> F = ½·C·ρV²S" : "<small>Purkagich</small> pₐₜₘ − p = ρv²/2";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  ui.t += dt;
  if (ui.mode === "flow") stepFlow(dt); else if (ui.mode === "bern") stepBern(dt); else if (ui.sub === "wing") stepWing(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; if (ui.mode === "flow") updateReadouts(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
function resetMode() {
  ui.t = 0;
  if (ui.mode === "flow") rebuildFlow(); else if (ui.mode === "bern") rebuildBern(); else if (ui.sub === "wing") { foilUpdate(); seedWing(); }
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const fQC = bindRange($("#fQ"), $("#fQOut"), (v) => `${fmt(v, 2)} L/s`, (v) => { flow.Q = v; customized(); refresh(); });
const fDC = ["#fD1", "#fD2", "#fD3"].map((id, i) => bindRange($(id), $(`${id}Out`), (v) => `${fmt(v, 1)} cm`, (v) => { flow.d[i] = v; rebuildFlow(); customized(); refresh(); }));
const bQC = bindRange($("#bQ"), $("#bQOut"), (v) => `${fmt(v, 1)} L/s`, (v) => { bern.Q = v; customized(); refresh(); });
const bDC = bindRange($("#bD"), $("#bDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bern.dt = v; rebuildBern(); customized(); refresh(); });
const bPC = bindRange($("#bP"), $("#bPOut"), (v) => `${fmt(v, 0)} cm`, (v) => { bern.p1 = v; customized(); refresh(); });
const bYC = bindRange($("#bY"), $("#bYOut"), (v) => `${fmt(v, 0)} cm`, (v) => { bern.dy = v; rebuildBern(); customized(); refresh(); });
const tHC = bindRange($("#tH"), $("#tHOut"), (v) => `${fmt(v, 2)} m`, (v) => { tor.H = v; tor.yh = clamp(tor.yh, 0.05, tor.H - 0.05); customized(); refresh(); });
const wVC = bindRange($("#wV"), $("#wVOut"), (v) => `${fmt(v, 0)} m/s`, (v) => { wing.V = v; customized(); refresh(); });
const wAC = bindRange($("#wA"), $("#wAOut"), (v) => `${fmt(v, 1)}°`, (v) => { wing.alpha = v * DEG; customized(); refresh(); });
const sVC = bindRange($("#sV"), $("#sVOut"), (v) => `${fmt(v, 1)} m/s`, (v) => { spray.v = v; customized(); refresh(); });
const sHC = bindRange($("#sH"), $("#sHOut"), (v) => `${fmt(v, 1)} cm`, (v) => { spray.hs = v; customized(); refresh(); });
document.querySelectorAll("[data-holes-value]").forEach((b) => b.addEventListener("click", () => { if (+b.dataset.holesValue !== tor.holes) loadPreset(+b.dataset.holesValue === 3 ? "tor3" : "tor"); }));
document.querySelectorAll("[data-sub-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.subValue !== ui.sub) loadPreset(b.dataset.subValue); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi 3D asboblar va kamera. */
const canvas=stage.canvas;
let drag=null;
const dialSpec={
  knobF:{object:flow,key:'Q',min:.2,max:2,step:.05,control:fQC},
  knobB:{object:bern,key:'Q',min:.5,max:4,step:.1,control:bQC},
  knobW:{object:wing,key:'V',min:10,max:80,step:1,control:wVC},
  knobS:{object:spray,key:'v',min:0,max:50,step:.5,control:sVC},
};
bindLabCamera(canvas,scene.lab,()=>stage.render(),{
  start(id,p){const spec=dialSpec[id];drag={id,x:p.x,value:spec?spec.object[spec.key]:0};},
  move(id,p){
    if(!drag||drag.id!==id)return;
    const spec=dialSpec[id];
    if(spec){const v=clamp(Math.round((drag.value+(p.x-drag.x)*(spec.max-spec.min)/180)/spec.step)*spec.step,spec.min,spec.max);spec.object[spec.key]=v;spec.control.set(v);}
    else {
      const v=scene.parameter(id,p);
      if(/^d\d$/.test(id)){const i=+id[1];flow.d[i]=clamp(Math.round(v*2)/2,3,14);fDC[i].set(flow.d[i]);rebuildFlow();}
      else if(id==='th'){bern.dt=clamp(Math.round(v*10)/10,3.5,9);bDC.set(bern.dt);rebuildBern(false);}
      else if(id==='ry'){bern.dy=clamp(Math.round(v),0,20);bYC.set(bern.dy);rebuildBern(false);}
      else if(id==='lv'){bern.p1=clamp(Math.round(v),25,60);bPC.set(bern.p1);}
      else if(id==='lvl'){tor.H=clamp(Math.round(v*100)/100,.7,1.5);tor.yh=clamp(tor.yh,.05,tor.H-.05);tHC.set(tor.H);}
      else if(id==='hole')tor.yh=clamp(Math.round(v*100)/100,.05,tor.H-.05);
      else if(id==='te'){wing.alpha=clamp(Math.round(v/DEG*2)/2,-4,12)*DEG;wAC.set(wing.alpha/DEG);}
      else if(id==='tip'){spray.hs=clamp(Math.round(v*10)/10,1,10);sHC.set(spray.hs);}
    }
    customized();refresh();
  },
  end(id){if(id==='th'||id==='ry')rebuildBern(true);drag=null;refresh();}
});

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  flow: { mode: "flow", title: "Uch kesimli quvur: Q = Sv", lesson: "Har bir kesimdan 1 sekundda 1 litr suv o‘tadi. Tor (5 cm) joyda tezlik keng (10 cm) joydagidan 4 marta katta. Devordagi tutqichlarni surib kesimlarni o‘zgartiring.", set: () => Object.assign(flow, { Q: 1, d: [10, 5, 8] }) },
  hose: { mode: "flow", title: "Shlang uchini qisish", lesson: "Shlang uchi 12 cm dan 4 cm gacha toraytirilgan: kesim 9 marta kichik — suv 9 marta tez otiladi. To‘q sariq bo‘lak uchiga kirib qanday cho‘zilishini kuzating.", set: () => Object.assign(flow, { Q: 1.5, d: [12, 12, 4] }) },
  venturi: { mode: "bern", title: "Venturi trubkasi", lesson: "Tor joyda (d₂ = 5 cm) suv 4 marta tez oqadi va 2-manometr ustuni pastroq. Keng joyda (3-manometr) bosim tiklanadi. Tor joy devorini surib ko‘ring.", set: () => Object.assign(bern, { Q: 2.5, dt: 5, p1: 45, dy: 0 }) },
  suction: { mode: "bern", title: "Bosim atmosferadan past", lesson: "Sarf katta, tor joy esa ingichka: v₂²/2g kirishdagi bosim ustunidan katta — tor joyda bosim atmosferadan past. Suv nasosi (so‘rg‘ich) va purkagich shu hodisaga asoslangan.", set: () => Object.assign(bern, { Q: 4, dt: 4, p1: 35, dy: 0 }) },
  rise: { mode: "bern", title: "Ko‘tariluvchi quvur", lesson: "Quvur 20 cm ga ko‘tariladi, kesim o‘zgarmaydi: tezlik bir xil, ammo yuqorida bosim 20 cm suv ustuniga kam. Barcha manometr sathlari + v²/2g energiya chizig‘iga yetadi.", set: () => Object.assign(bern, { Q: 2, dt: 9, p1: 50, dy: 20 }) },
  tor: { mode: "app", sub: "tor", title: "Torichelli: teshikdan oqim", lesson: "Suv sathi 1,3 m. Teshik chuqurligi h bo‘lsa, oqim tezligi v = √(2gh). Teshikni surib eng uzoq otiladigan joyni toping; suv sathini ham suring.", set: () => Object.assign(tor, { H: 1.3, holes: 1, yh: 0.45 }) },
  tor3: { mode: "app", sub: "tor", title: "Uch teshik: qaysi biri uzoqroq?", lesson: "Teshiklar H/4, H/2 va 3H/4 balandlikda. Pastki teshikdan suv tezroq otiladi, lekin o‘rtadagisi eng uzoqqa yetadi; yuqori va pastki — bir xil masofaga.", set: () => Object.assign(tor, { H: 1.3, holes: 3 }) },
  wing: { mode: "app", sub: "wing", title: "Qanot: ko‘tarish kuchi", lesson: "40 m/s havo oqimi qanotni α = 5° burchak ostida aylanib o‘tadi. Qanot ustida oqim tezroq va bosim pastroq. Chiqish qirrasini surib burchakni, dastak bilan tezlikni o‘zgartiring.", set: () => Object.assign(wing, { V: 40, alpha: 5 * DEG }) },
  wingZero: { mode: "app", sub: "wing", title: "Nol ko‘tarish burchagi", lesson: "α ≈ −4°: egilgan profilda ham ko‘tarish kuchi deyarli nol — ustidagi va ostidagi tezliklar tenglashadi. Burchakni asta oshiring.", set: () => Object.assign(wing, { V: 40, alpha: -4 * DEG }) },
  spray: { mode: "app", sub: "spray", title: "Purkagich (atomayzer)", lesson: "25 m/s havo oqimi naycha uchida bosimni 375 Pa ga pasaytiradi — suyuqlik 3,8 cm ko‘tariladi va naycha uchidan (3 cm) oshib sochiladi. Naychani yuqoriroq suring yoki puflashni sekinlating.", set: () => Object.assign(spray, { v: 25, hs: 3 }) },
};
const GROUPS = [["Oqim uzluksizligi", ["flow", "hose"]], ["Bernulli qonuni", ["venturi", "suction", "rise"]], ["Qo‘llanishlar", ["tor", "tor3", "wing", "wingZero", "spray"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  fQC.set(flow.Q); fDC.forEach((cc, i) => cc.set(flow.d[i]));
  bQC.set(bern.Q); bDC.set(bern.dt); bPC.set(bern.p1); bYC.set(bern.dy);
  tHC.set(tor.H); wVC.set(wing.V); wAC.set(wing.alpha / DEG); sVC.set(spray.v); sHC.set(spray.hs);
  document.querySelectorAll("[data-holes-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.holesValue === tor.holes)));
  document.querySelectorAll("[data-sub-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.subValue === ui.sub)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { flow: "Devor tutqichlarini va Q dastagini suring", bern: "Tor joy, ko‘tarilgan quvur, 1-manometr sathi va Q dastagi", tor: "Suv sathini va teshikni suring", wing: "Qanot chiqish qirrasini va V dastagini suring", spray: "Naychani va puflagich dastagini suring" };
const DHINT = { tor: "Uchta teshik rejimida teshiklar H/4, H/2, 3H/4 da turadi.", wing: "Qanot vatari 1,5 m, havo zichligi 1,2 kg/m³. Rang — bosim: ko‘k past, qizil yuqori.", spray: "Suyuqlik zichligi 1000 kg/m³ (suv), havo 1,2 kg/m³." };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== ui.sub; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode === "app" ? ui.sub : ui.mode];
  $("[data-dhint]").textContent = DHINT[ui.sub] || "";
  window.dispatchEvent(new Event("resize"));
}
const MODE_DEFAULT = { flow: "flow", bern: "venturi", app: "tor" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; if (p.sub) ui.sub = p.sub;
  p.set(); resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "flow");
document.fonts?.ready.then(() => stage.render());
