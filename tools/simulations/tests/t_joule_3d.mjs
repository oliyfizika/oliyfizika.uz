// Tok ishi va Joul–Lens qonuni 3D sahnasi (joule-lab-3d.js): kalorimetr, lampa va uy tarmog'ining barcha holatlarida
// koordinatalar chekli; tutqichlar sahnada; manba dastasi va LATR uchun ekran ↔ sahna teskari almashtirishlari to'g'ri.
// node tools/simulations/tests/t_joule_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/joule-physics.js';
import { createJouleLab, latrPoint } from '../../../assets/js/simulations/joule-lab-3d.js';

// joule.js dagi qiymatlar
const R_INT = 0.3, RANGES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20], SUB = '₁₂', METER0 = 4521.3, IMP = 3200;
const HOME_IDS = ['kettle', 'iron', 'heater', 'washer', 'ac', 'fridge', 'tv', 'pc', 'lamp', 'led'];
const SHORT = { kettle: 'Choynak', iron: 'Dazmol', heater: 'Isitgich', washer: 'Kir mashina', ac: 'Konditsioner', fridge: 'Muzlatkich', tv: 'Televizor', pc: 'Kompyuter', lamp: 'Lampa', led: 'LED lampa' };
const POWER = Object.fromEntries(HOME_IDS.map((id) => [id, P.APPLIANCES[id].P])), HEATING = { kettle: 1, iron: 1, heater: 1 };
const range = (v) => RANGES.find((r) => r >= v * 1.04) || 20;
const fmt = (v, d) => v.toFixed(d).replace('.', ',');

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
const POSES = [{ yaw: -0.9, pitch: 0.6 }, { yaw: 0.4, pitch: 0.2 }, { yaw: 2.6, pitch: 0.5 }, { yaw: -2.4, pitch: 1.2 }];

const scene = createJouleLab(), lab = scene.lab, drawn = { kal: 0, lamp: 0, home: 0 };
const draw = (stage, f) => { texts = []; scene.draw(ctx, stage, f); drawn[f.mode]++; return texts; };
/** Ekranni to'r bilan aylanib chiqib, sahnadagi barcha tutqichlarni yig'adi. */
function handles(stage) {
  const ids = new Set();
  for (let x = 2; x < stage.w; x += 3) for (let y = 2; y < stage.h; y += 3) { const id = lab.hit(x, y); if (id) ids.add(id); }
  return ids;
}

/* ---------------------------------------------- 1) Kalorimetr */
function kalFrame(conn, E, closed, m, T, t = 42.3) {
  const n = conn === 'single' ? 1 : 2, h0 = P.heaters(E, R_INT, [2, 4], conn);
  const h = closed ? h0 : { I: 0, U: 0, R: h0.R, parts: h0.parts.map((p) => ({ R: p.R, I: 0, U: 0, P: 0 })) };
  return { mode: 'kal', anim: t, kal: { n, conn, E, closed, I: h.I, Ir: range(h.I), U: h.U, parts: h.parts, T, m, t, clock: '00:42,3', running: closed, labels: h.parts.map((p, i) => `R${n > 1 ? SUB[i] : ''} ${fmt(p.R, 1)} Ω · ${fmt(T[i], 1)} °C`) } };
}
scene.setMode('kal');
assert.deepEqual({ ...lab.camera }, { yaw: -0.5, pitch: 0.35, zoom: 1 }, 'kalorimetrning boshlang\'ich ko\'rinishi');
for (const stage of stages) for (const conn of ['single', 'series', 'parallel']) for (const E of [0, 4, 8, 12]) for (const closed of [true, false]) for (const m of [50, 150, 300]) for (const T of [[20, 20], [85, 60], [100, 100]]) {
  const txt = draw(stage, kalFrame(conn, E, closed, m, T));
  assert.ok(txt.includes(`${fmt(E, 1)} V`), 'manba displeyi');
}
{
  const wide = draw(WIDE, kalFrame('single', 8, true, 150, [20, 20])), narrow = draw(NARROW, kalFrame('single', 8, true, 150, [20, 20]));
  for (const s of ['Manba 0–12 V', 'Sekundomer', 'kalit ulangan']) { assert.ok(wide.includes(s), `keng: ${s}`); assert.ok(!narrow.includes(s), `tor: ${s} yo'q`); }
  const I = P.heaters(8, R_INT, [2, 4], 'single').I;
  assert.ok(wide.includes(`${fmt(I, 2)} A · 0–5 A`) && narrow.includes(`${fmt(I, 2)} A`), 'ampermetr: keng — chegarasi bilan, tor — qisqa');
  assert.ok(narrow.includes('R 2,0 Ω · 20,0 °C') && narrow.includes('00:42,3'), 'tor ekranda asosiy yozuvlar qoladi');
}
{ // tutqichlar va manba dastasi
  lab.reset(); draw(WIDE, kalFrame('series', 8, false, 150, [20, 20]));
  const ids = handles(WIDE);
  for (const id of ['knob', 'sw']) assert.ok(ids.has(id), `kalorimetr tutqichi: ${id}`);
  for (const pose of [null, ...POSES.slice(0, 2)]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, kalFrame('series', 8, false, 150, [20, 20]));
    for (let f = 0; f <= 1.0001; f += 0.1) { const p = lab.project(scene.knob(f)); near(lab.nearest(scene.knob, 0, 1, p.x, p.y), f, 0.02, 'manba dastasi'); }
  }
}

/* ---------------------------------------------- 2) Lampa */
function lampFrame(a, b, conn, U) {
  const ls = [P.LAMPS[a], b !== 'none' ? P.LAMPS[b] : null].filter(Boolean), small = a === 'l6';
  let r;
  if (ls.length === 1 || conn === 'parallel') r = { ...P.parallelLamps(ls, U), series: false };
  else { const s = P.seriesLamps(ls, U); r = { I: s.I, parts: s.parts.map((p) => ({ ...p, I: s.I })), series: true }; }
  return { mode: 'lamp', anim: 0.8, lamp: { U, Umax: small ? 8 : 250, small, I: r.I, Ir: range(r.I), Vmax: small ? 10 : 300, lamps: ls, parts: r.parts.map((p) => ({ ...p, b: P.brightness(p.T) })), series: r.series } };
}
scene.setMode('lamp');
assert.deepEqual({ ...lab.camera }, { yaw: -0.45, pitch: 0.45, zoom: 1 }, 'lampaning boshlang\'ich ko\'rinishi');
for (const stage of stages) {
  for (const a of ['l25', 'l40', 'l60', 'l100']) for (const b of ['none', 'l40', 'l100']) for (const conn of ['series', 'parallel']) for (const U of [0, 50, 110, 220, 250]) draw(stage, lampFrame(a, b, conn, U));
  for (const U of [0, 2, 6.3, 8]) draw(stage, lampFrame('l6', 'none', 'series', U));
}
{
  const wide = draw(WIDE, lampFrame('l100', 'none', 'series', 220)), narrow = draw(NARROW, lampFrame('l100', 'none', 'series', 220));
  assert.ok(wide.includes('LATR · ~220 V → 0–250 V') && !narrow.includes('LATR · ~220 V → 0–250 V'), 'LATR yozuvi faqat keng ekranda');
  assert.ok(narrow.includes('220 V') && narrow.includes('100 W, 220 V'), 'tor ekranda voltmetr va lampa yozuvi qoladi');
  lab.reset(); draw(WIDE, lampFrame('l100', 'none', 'series', 220));
  assert.ok(handles(WIDE).has('latr'), 'LATR dastasi tutqichi');
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, lampFrame('l100', 'none', 'series', 220));
    if (lab.camera.pitch < 0.3) continue; // dasta aylanasi deyarli yonidan ko'rinadi
    for (let f = 0; f <= 1.0001; f += 0.1) { const p = lab.project(latrPoint(f)); near(lab.nearest(scene.latrPoint, 0, 1, p.x, p.y), f, 0.02, 'LATR'); }
  }
}

/* ---------------------------------------------- 3) Uy tarmog'i */
function homeFrame(ids, { tripped = false, pulse = false, In = 16, E = 0.37 } = {}) {
  const on = Object.fromEntries(ids.map((id) => [id, true])), Pw = tripped ? 0 : ids.reduce((s, id) => s + POWER[id], 0);
  return { mode: 'home', anim: 5.5, home: { I: Pw / P.MAINS, reading: (METER0 + E).toFixed(2).padStart(8, '0').replace('.', ','), pulse, imp: IMP, tripped, In, ids: HOME_IDS, on, P: POWER, heating: HEATING, names: SHORT, t: 103 } };
}
scene.setMode('home');
assert.deepEqual({ ...lab.camera }, { yaw: -0.3, pitch: 0.3, zoom: 1 }, 'uy tarmog\'ining boshlang\'ich ko\'rinishi');
const sets = [[], ['kettle'], ['kettle', 'iron', 'washer'], HOME_IDS, ['ac', 'tv', 'led'], ['lamp', 'pc', 'fridge', 'heater']];
for (const stage of stages) for (const ids of sets) for (const tripped of [false, true]) for (const pulse of [false, true]) draw(stage, homeFrame(ids, { tripped, pulse }));
{
  const wide = draw(WIDE, homeFrame(['kettle'])), narrow = draw(NARROW, homeFrame(['kettle']));
  assert.ok(wide.includes('Choynak · 2,0 kW') && wide.includes('Televizor · 100 W'), 'keng ekranda barcha iste\'molchilar nomi');
  assert.ok(narrow.includes('2,0 kW') && !narrow.some((s) => s.startsWith('Televizor')), 'tor ekranda faqat ishlayotganlar quvvati');
  assert.ok(wide.includes('04521,67 kVt·soat') && narrow.includes('04521,67'), 'hisoblagich ko\'rsatishi');
  lab.reset(); draw(WIDE, homeFrame(['kettle']));
  const ids = handles(WIDE);
  assert.ok(ids.has('breaker'), 'avtomat richagi tutqichi');
  const found = HOME_IDS.filter((id) => ids.has(`a:${id}`));
  assert.ok(found.length >= 9, `iste'molchilar tutqichlari: ${found.length}/10 (${found.join(', ')})`);
}

/* ---------------------------------------------- 4) Kamera: rejim almashganda o'z ko'rinishi */
Object.assign(lab.camera, { yaw: 1, pitch: 1, zoom: 2 });
scene.setMode('home'); assert.equal(lab.camera.yaw, 1, 'o\'sha rejim — kamera o\'zgarmaydi');
scene.setMode('kal'); assert.deepEqual({ ...lab.camera }, { yaw: -0.5, pitch: 0.35, zoom: 1 }, 'kalorimetr ko\'rinishi');

const total = Object.values(drawn).reduce((s, v) => s + v, 0);
console.log(`joule 3D: ${drawn.kal} kalorimetr, ${drawn.lamp} lampa, ${drawn.home} uy tarmog'i kadri (${total}); ${coordinates} koordinata chekli — OK`);
