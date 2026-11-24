// Gazlarda elektr toki 3D sahnasi (discharge-lab-3d.js): besh tajribaning barcha holatlarida koordinatalar chekli;
// tutqichlar sahnada; manba dastasi, o'ng shar va o'ng ko'mir uchun ekran ↔ sahna teskari almashtirishlari to'g'ri.
// node tools/simulations/tests/t_discharge_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/discharge-physics.js';
import { createDischargeLab, ION, ionPoint, ballPoint, arcRodPoint } from '../../../assets/js/simulations/discharge-lab-3d.js';

// discharge.js dagi qiymatlar
const TUBE_L = 40, TUBE_R = 1e6, H_LINE = 1500, ARC_E = 110;

// WebGL'siz: sahna 2D kanvas yo'li bilan chiziladi, har bir son argument chekli bo'lishi kerak.
globalThis.document = { createElement: () => ({ getContext: () => null }) };
let coordinates = 0, texts = [];
const check = (...args) => { for (const v of args) if (typeof v === 'number') { assert.ok(Number.isFinite(v), 'chekli koordinata'); coordinates++; } };
const ctx = new Proxy({
  measureText: (t) => ({ width: String(t).length * 6 }),
  createRadialGradient: (...a) => { check(...a); return { addColorStop() {} }; },
  fillText: (t, ...a) => { texts.push(String(t)); check(...a); },
}, { get: (o, k) => (k in o ? o[k] : check) });
const palette = (dark) => ({ ...Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special', 'grid'].map((k) => [k, '#888'])), dark });
const WIDE = { w: 760, h: 414, colors: palette(false) }, NARROW = { w: 356, h: 321, colors: palette(true) }, stages = [WIDE, NARROW];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≈ ${b}`);
const POSES = [{ yaw: -0.6, pitch: 0.5 }, { yaw: 2.5, pitch: 0.3 }, { yaw: -2.8, pitch: 1.2 }, { yaw: 0.8, pitch: 0.05 }];

const scene = createDischargeLab(), lab = scene.lab, drawn = { ion: 0, tube: 0, spark: 0, arc: 0, corona: 0 };
const draw = (stage, f) => { texts = []; scene.draw(ctx, stage, f); drawn[f.mode]++; return texts; };
/** Ekranni to'r bilan aylanib chiqib, sahnadagi barcha tutqichlarni yig'adi. */
function handles(stage) {
  const ids = new Set();
  for (let x = 2; x < stage.w; x += 3) for (let y = 2; y < stage.h; y += 3) { const id = lab.hit(x, y); if (id) ids.add(id); }
  return ids;
}
/** Tasodifiy, lekin takrorlanadigan sonlar. */
const rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();

/* ---------------------------------------------- 1) Ionlash kamerasi */
function ionFrame(src, U, d, extra = {}) {
  const parts = [];
  for (let k = 0; k < 120; k++) {
    const x = 300 - 20 * d + 3 + rnd() * (40 * d - 6), y = 72 + rnd() * 110;
    parts.push({ x, y, z: rnd() - 0.5, s: k % 2 ? 1 : -1, life: rnd() * 1.8, vy: 0, a: k % 5 === 0 ? 1 : undefined });
  }
  const r = P.chamber(U, d / 100, 0.01, P.IONIZERS[src].q), I = r.I;
  return { mode: 'ion', anim: 1.3, ion: { src, U, pos: U < 1 ? 0 : Math.min(1, (1 + (999 * Math.log10(U)) / Math.log10(40000)) / 1000), text: `${U} V`, d, parts, hit: [0.15, 0.05], spark: 0, seed: 17, I, meter: { value: 0.5, max: 1, sym: 'nA', label: '0–1 nA' }, ...extra } };
}
scene.setMode('ion');
assert.deepEqual({ ...lab.camera }, { yaw: -0.2, pitch: 0.24, zoom: 1 }, 'ionlash kamerasining boshlang\'ich ko\'rinishi');
for (const stage of stages) for (const src of Object.keys(P.IONIZERS)) for (const U of [0, 10, 1000, 33000, 37000]) for (const d of [0.5, 1, 3]) {
  const t = draw(stage, ionFrame(src, U, d));
  assert.ok(t.includes(`d = ${String(d).replace('.', ',')}${Number.isInteger(d) ? ',0' : ''} cm`), `oraliq yozuvi (d = ${d})`);
  for (const spark of [0.06, 0.12]) draw(stage, ionFrame(src, U, d, { spark, seed: 1 + Math.floor(rnd() * 1e6) }));
}
{ // ionlar har doim plastinkalar orasida; chuqurlik bo'yicha ham ichkarida
  for (const d of [0.5, 1, 3]) for (const [x, y, z] of [[300 - 20 * d, 70, -0.5], [300 + 20 * d, 180, 0.5], [300, 125, 0]]) {
    const p = ionPoint({ x, y, z });
    assert.ok(p[0] >= ION.PX - (d * ION.K) / 2 - 1e-9 && p[0] <= ION.PX + (d * ION.K) / 2 + 1e-9, 'ion x — plastinkalar orasida');
    assert.ok(p[1] >= ION.Y0 - 1e-9 && p[1] <= ION.Y1 + 1e-9, 'ion y — plastinka balandligida');
    assert.ok(Math.abs(p[2]) < ION.Z, 'ion z — plastinka chuqurligida');
  }
}
{ // keng ekranda asbob nomlari bor, tor ekranda ikkinchi darajali yozuvlar yashiriladi
  const wide = draw(WIDE, ionFrame('xray', 1000, 1)), narrow = draw(NARROW, ionFrame('xray', 1000, 1));
  for (const s of ['galvanometr', 'Yuqori kuchlanish 0–40 kV', 'rentgen trubkasi (qo‘rg‘oshin g‘ilofda)']) { assert.ok(wide.includes(s), `keng: ${s}`); assert.ok(!narrow.includes(s), `tor: ${s} yo'q`); }
  assert.ok(narrow.includes('d = 1,0 cm') && narrow.includes('0–1 nA'), 'tor ekranda asosiy yozuvlar qoladi');
}
{ // manba dastasi: tutqich bor va ekrandagi nuqtadan dasta holati qayta topiladi
  lab.reset(); draw(WIDE, ionFrame('xray', 1000, 1));
  assert.ok(handles(WIDE).has('knob'), 'manba dastasi tutqichi');
  for (const pose of [null, ...POSES.slice(0, 2)]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, ionFrame('xray', 1000, 1));
    for (let f = 0; f <= 1.0001; f += 0.1) { const p = lab.project(scene.knob(f)); near(lab.nearest(scene.knob, 0, 1, p.x, p.y), f, 0.02, 'dasta'); }
  }
}

/* ---------------------------------------------- 2) Razryad trubkasi */
function tubeFrame(gas, p, U, extra = {}) {
  const g = P.GASES[gas], Ub = P.tubeBreakdown(g, p, TUBE_L), burning = U >= Ub, L = P.glowLayout(p, TUBE_L);
  const reg = !burning ? (p < 1e-3 ? 'vacuum' : 'none') : L.rays ? 'rays' : p > 40 ? 'spark' : p > 3 ? 'cord' : L.striae > 0.5 ? 'striae' : 'glow';
  return { mode: 'tube', anim: 2.1, tube: { gas: g, p, pText: `${p} mm`, U, pump: false, vent: false, burning, reg, regText: reg, I: burning ? P.tubeCurrent(U, Ub, TUBE_R) : 0, L, Lcm: TUBE_L, ...extra } };
}
scene.setMode('tube');
assert.deepEqual({ ...lab.camera }, { yaw: -0.35, pitch: 0.32, zoom: 1 }, 'trubkaning boshlang\'ich ko\'rinishi');
const regimes = new Set();
for (const stage of stages) for (const gas of Object.keys(P.GASES)) for (const p of [760, 100, 50, 20, 4, 2.5, 1, 0.3, 0.05, 0.005, 5e-4]) for (const U of [0, 6000, 15000]) {
  const f = tubeFrame(gas, p, U);
  regimes.add(f.tube.reg);
  draw(stage, f);
  draw(stage, tubeFrame(gas, p, U, { pump: true, anim: 3.7 }));
  draw(stage, tubeFrame(gas, p, U, { vent: true, anim: 0.4 }));
}
for (const r of ['none', 'vacuum', 'spark', 'cord', 'glow', 'striae', 'rays']) assert.ok(regimes.has(r), `trubka rejimi chizildi: ${r}`);
{
  lab.reset(); draw(WIDE, tubeFrame('air', 1, 6000));
  const ids = handles(WIDE);
  for (const id of ['knob', 'valve', 'pump']) assert.ok(ids.has(id), `trubka tutqichi: ${id}`);
  for (let f = 0; f <= 1.0001; f += 0.1) { const q = lab.project(scene.knob(f)); near(lab.nearest(scene.knob, 0, 1, q.x, q.y), f, 0.02, 'trubka manbai dastasi'); }
  const narrow = draw(NARROW, tubeFrame('air', 1, 6000));
  assert.ok(!narrow.includes('Vakuummetr') && narrow.includes('NASOS'), 'tor ekranda nasos yozuvi qoladi');
}

/* ---------------------------------------------- 3) Uchqun: elektrofor mashinasi */
scene.setMode('spark');
for (const stage of stages) for (const d of [0.2, 1.5, 4]) for (const jars of [true, false]) for (const flash of [0, 0.05, 0.16]) {
  draw(stage, { mode: 'spark', anim: 1, spark: { d, jars, U: 30000, rot: d * 3, flash, seed: 1 + Math.floor(rnd() * 1e6), Vb: P.sparkVb(d), t: 2.4 } });
}
{
  const f = (d) => ({ mode: 'spark', anim: 1, spark: { d, jars: true, U: 0, rot: 0, flash: 0, seed: 1, Vb: P.sparkVb(d), t: 0 } });
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 }); else lab.reset();
    draw(WIDE, f(1.5));
    const a = lab.project(ballPoint(0.2)), b = lab.project(ballPoint(4));
    if (Math.hypot(a.x - b.x, a.y - b.y) < 30) continue; // shar yo'li kameraga qarab ketgan (yon ko'rinish)
    for (let d = 0.2; d <= 4.0001; d += 0.2) { const p = lab.project(ballPoint(d)); near(lab.nearest(ballPoint, 0.2, 4, p.x, p.y), d, 0.05, 'shar'); }
  }
  lab.reset(); draw(WIDE, f(1.5));
  assert.ok(handles(WIDE).has('ball'), 'o\'ng shar tutqichi');
}

/* ---------------------------------------------- 4) Elektr yoyi */
scene.setMode('arc');
const arcModes = new Set();
for (const stage of stages) for (const R of [2, 5, 20]) for (const d of [0, 1, 3, 6.5, 12]) for (const out of [false, true]) {
  const pt = d > 0 ? P.arcPoint(ARC_E, R, d) : null;
  const st = d <= 0 ? { mode: 'short', I: ARC_E / (R + 0.05), U: (ARC_E / (R + 0.05)) * 0.05 } : pt && !out ? { mode: 'arc', ...pt } : { mode: 'off', I: 0, U: ARC_E };
  arcModes.add(st.mode);
  draw(stage, { mode: 'arc', anim: 0.7, arc: { R, d, st, out } });
}
for (const m of ['short', 'arc', 'off']) assert.ok(arcModes.has(m), `yoy holati chizildi: ${m}`);
{
  const f = { mode: 'arc', anim: 0, arc: { R: 5, d: 3, st: { mode: 'arc', ...P.arcPoint(ARC_E, 5, 3) }, out: false } };
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 }); else lab.reset();
    draw(WIDE, f);
    const a = lab.project(arcRodPoint(0)), b = lab.project(arcRodPoint(12));
    if (Math.hypot(a.x - b.x, a.y - b.y) < 30) continue;
    for (let d = 0; d <= 12.0001; d += 0.5) { const p = lab.project(arcRodPoint(d)); near(lab.nearest(arcRodPoint, 0, 12, p.x, p.y), d, 0.1, 'ko\'mir'); }
  }
  lab.reset(); draw(WIDE, f);
  const ids = handles(WIDE);
  assert.ok(ids.has('rod') && !ids.has('knob'), 'yoyda faqat ko\'mir tutqichi (manba 110 V — dastasiz)');
}

/* ---------------------------------------------- 5) Toj razryad */
scene.setMode('corona');
for (const stage of [...stages, { w: 1100, h: 520, colors: palette(false) }]) for (const U of [0, 127, 150, 300]) for (const r of [0.1, 0.3, 1.4]) for (const m of [0.5, 0.85, 1]) {
  const Es = P.wireField(U, r, H_LINE), Ec = P.peek(r, m), f = Es > Ec ? Math.min(1.5, (Es - Ec) / Ec) : 0;
  const t = draw(stage, { mode: 'corona', anim: 0.9, cor: { U, r, m, Es, Ec, f } });
  assert.ok(t.includes('sim kesimi'), 'sim kesimi doirasi');
  assert.equal(t.includes('toj razryad — vizillash, ozon hidi'), f > 0, 'toj yozuvi faqat toj bo\'lganda');
}
lab.reset(); draw(WIDE, { mode: 'corona', anim: 0, cor: { U: 150, r: 0.3, m: 1, Es: 40, Ec: 30, f: 0.3 } });
assert.equal(handles(WIDE).size, 0, 'liniya maketida tutqich yo\'q');

/* ---------------------------------------------- 6) Kamera: rejim almashganda o'z ko'rinishi */
Object.assign(lab.camera, { yaw: 1, pitch: 1, zoom: 2 });
scene.setMode('corona'); assert.equal(lab.camera.yaw, 1, 'o\'sha rejim — kamera o\'zgarmaydi');
scene.setMode('arc'); assert.deepEqual({ ...lab.camera }, { yaw: -0.35, pitch: 0.32, zoom: 1 }, 'yoy ko\'rinishi');
scene.setMode('spark'); assert.deepEqual({ ...lab.camera }, { yaw: -0.35, pitch: 0.18, zoom: 1 }, 'uchqun ko\'rinishi');

const total = Object.values(drawn).reduce((s, v) => s + v, 0);
console.log(`discharge 3D: ${drawn.ion} ionlash, ${drawn.tube} trubka, ${drawn.spark} uchqun, ${drawn.arc} yoy, ${drawn.corona} toj kadri (${total}); ${coordinates} koordinata chekli — OK`);
