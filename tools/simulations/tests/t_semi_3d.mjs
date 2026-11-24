// Yarimo'tkazgichlar 3D sahnasi (semi-lab-3d.js): qizdirish, fotorezistor, panjara, diod VAX, to'g'rilagich va tranzistorning
// barcha holatlarida koordinatalar chekli; tutqichlar sahnada; dasta va lampa uchun ekran ↔ sahna almashtirishlari to'g'ri.
// node tools/simulations/tests/t_semi_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/semi-physics.js';
import { createSemiLab } from '../../../assets/js/simulations/semi-lab-3d.js';

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
const POSES = [{ yaw: -0.9, pitch: 0.6 }, { yaw: 0.4, pitch: 0.9 }, { yaw: 2.6, pitch: 0.5 }];
const scene = createSemiLab(), lab = scene.lab;
const draw = (stage, f) => { texts = []; scene.draw(ctx, stage, f); return texts; };
function handles(stage) {
  const ids = new Set();
  for (let x = 2; x < stage.w; x += 3) for (let y = 2; y < stage.h; y += 3) { const id = lab.hit(x, y); if (id) ids.add(id); }
  return ids;
}
/** Dasta: ekrandagi nuqta → f (0…1) qaytishi. */
function dial(pointAt, msg) {
  for (const f of [0, 0.1, 0.35, 0.5, 0.8, 1]) { const p = lab.project(pointAt(f)); near(lab.nearest(pointAt, 0, 1, p.x, p.y), f, 0.01, msg); }
}

/* ---------------------------------------------- 1a) Qizdirish */
const thermo = (T, level = 1, heat = true, anim = 0.7) => ({ mode: 'thermo', anim, R: { T, level, power: heat ? level : 0, Rm: `${P.metalR(T).toFixed(2)} Ω`, Rs: `${(P.ntcR(T) / 1000).toFixed(1)} kΩ`, nfree: Math.max(1, Math.min(11, Math.round(1 + 6 * Math.log10(P.ntcR(20) / P.ntcR(T))))) } });
scene.setMode('thermo');
assert.deepEqual({ ...lab.camera }, { yaw: -0.3, pitch: 0.34, zoom: 1 }, 'qizdirish: boshlang\'ich ko\'rinish');
for (const stage of stages) for (const T of [20, 55, 85, 100]) for (const level of [0, 0.3, 1]) for (const heat of [true, false]) draw(stage, thermo(T, level, heat));
{
  const wide = draw(WIDE, thermo(100)), narrow = draw(NARROW, thermo(100));
  assert.ok(wide.includes('Mis: ionlar tebranishi ortadi') && narrow.includes('Mis: ionlar'), 'mikroskopik oynacha');
  assert.ok(wide.includes('Elektr plitka 800 W') && !narrow.includes('Elektr plitka 800 W'), 'plitka yozuvi faqat keng ekranda');
  lab.reset(); draw(WIDE, thermo(40, 0.5));
  assert.ok(handles(WIDE).has('heat'), 'plitka dastasi');
  for (const pose of [null, ...POSES]) { if (pose) Object.assign(lab.camera, pose, { zoom: 1 }); draw(WIDE, thermo(40)); dial(scene.heatAt, 'plitka dastasi'); }
}

/* ---------------------------------------------- 1b) Fotorezistor */
const photo = (d, room = 150, lampOn = true) => { const E = room + (lampOn ? P.illum(80, d / 100) : 0); return { mode: 'photo', anim: 0.3, F: { d, room, lampOn, E, R: `${Math.round(P.ldrR(E))} Ω` } }; };
scene.setMode('photo');
for (const stage of stages) for (const d of [10, 30, 55, 80]) for (const room of [150, 5, 0.3]) for (const on of [true, false]) draw(stage, photo(d, room, on));
{
  assert.ok(draw(WIDE, photo(30)).includes('r = 30 cm'), 'masofa yozuvi');
  assert.ok(draw(WIDE, photo(30, 0.3, false)).includes('qorong‘i xona'), 'qorong\'i xona');
  lab.reset(); draw(WIDE, photo(30));
  assert.ok(handles(WIDE).has('lamp'), 'lampa tutqichi');
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, photo(30));
    for (let d = 10; d <= 80; d += 5) { const p = lab.project(scene.lampAt(d)); near(lab.nearest(scene.lampAt, 10, 80, p.x, p.y), d, 0.4, 'lampa masofasi'); }
  }
}

/* ---------------------------------------------- 2) Panjara */
const LC = 9, LR = 5, atomXY = (i) => [78 + (i % LC) * 45.5, 74 + Math.floor(i / LC) * 40];
const BONDS = [];
for (let i = 0; i < LC * LR; i++) { const c0 = i % LC, r0 = Math.floor(i / LC); if (c0 < LC - 1) BONDS.push({ a: i, b: i + 1, h: true }); if (r0 < LR - 1) BONDS.push({ a: i, b: i + LC, h: false }); }
BONDS.forEach((b) => { const [x1, y1] = atomXY(b.a), [x2, y2] = atomXY(b.b); b.x = (x1 + x2) / 2; b.y = (y1 + y2) / 2; });
const slotXY = (bi, sl) => { const b = BONDS[bi], d = sl ? 3.4 : -3.4; return b.h ? [b.x, b.y + d] : [b.x + d, b.y]; };
function latFrame(dope, field, T = 300) {
  const atoms = Array(LC * LR).fill('s'); if (dope !== 'i') for (const i of [11, 24, 33]) atoms[i] = dope === 'n' ? 'd' : 'a';
  const e = [{ x: 100, y: 80 }, { x: 300, y: 200 }, { x: 46, y: 256 }], h = [3, 40, 70].map((b) => { const [x, y] = slotXY(b, 1); return { b, sl: 1, x, y, k: 1 }; });
  const holeAt = new Set(h.map((q) => `${q.b}:${q.sl}`));
  return { mode: 'lat', anim: 1.2, L: { sym: 'Si', dope, T, field, atoms, e, h, fx: [{ x: 200, y: 120, t: 0.3, kind: 'gen' }, { x: 260, y: 160, t: 0.6, kind: 'rec' }], bonds: BONDS, pos: atomXY, slot: slotXY, holeAt, I: ['9,73', 'mA'] } };
}
scene.setMode('lat');
for (const stage of stages) for (const dope of ['i', 'n', 'p']) for (const field of [true, false]) for (const T of [250, 300, 400]) draw(stage, latFrame(dope, field, T));
{
  const wide = draw(WIDE, latFrame('n', true)), narrow = draw(NARROW, latFrame('n', true));
  assert.ok(wide.includes('n-tip: Si + P · T = 300 K (27 °C)') && narrow.includes('n-tip: Si + P · 300 K'), 'panjara sarlavhasi');
  assert.ok(wide.includes('erkin elektronlar 3 · kovaklar 3') && wide.includes('9,73 mA') && wide.includes('ON'), 'hisoblagichlar');
  assert.ok(wide.includes('← elektronlar') && !narrow.includes('← elektronlar'), 'dreyf yo\'nalishi faqat keng ekranda');
  assert.ok(draw(WIDE, latFrame('n', false)).includes('0 nA'), 'kalit uzilgan — tok yo\'q');
  lab.reset(); draw(WIDE, latFrame('p', false));
  const ids = handles(WIDE);
  assert.ok(ids.has('btn'), 'batareya tugmasi');
  assert.equal([...ids].filter((id) => id.startsWith('atom:')).length, LC * LR, 'har bir atom bosiladi');
}

/* ---------------------------------------------- 3a) Diod VAX */
function vaxFrame(type, pol, E, T = 20) {
  const d = P.DIODES[type], r = P.diodeCircuit(d, pol * E, 101, T + P.T0), rev = pol < 0, Ia = Math.abs(r.I), vA = rev ? Ia * 1e6 : r.I * 1e3, rA = 100, sym = rev ? 'μA' : 'mA', vmax = rev ? 30 : d.led ? 5 : 1;
  return { mode: 'vax', anim: 0.9, V: { E, Emax: rev ? 30 : 5, rev, on: Ia > 1e-6, I: r.I, led: d.led || null, glass: type === 'ge', short: d.short,
    Am: { frac: vA / rA, sym, text: `${vA.toFixed(2)} ${sym} · 0–${rA} ${sym}`, short: `${vA.toFixed(2)} ${sym}` }, Vm: { frac: Math.abs(r.U) / vmax, text: `${Math.abs(r.U).toFixed(2)} V`, short: 'U' },
    dep: P.depletion(d, r.U - r.I * d.Rs), flux: r.I > 1e-7 ? Math.min(1, Math.log10(r.I / 1e-7) / 5) : 0 } };
}
scene.setMode('vax');
for (const stage of stages) for (const type of Object.keys(P.DIODES)) for (const [pol, E] of [[1, 0], [1, 0.6], [1, 5], [-1, 10], [-1, 30]]) draw(stage, vaxFrame(type, pol, E));
{
  const wide = draw(WIDE, vaxFrame('si', 1, 2)), narrow = draw(NARROW, vaxFrame('si', 1, 2));
  assert.ok(wide.includes('Manba 0–5 V') && wide.includes('to‘g‘ri') && wide.includes('anod «+» ga, katod «−» ga'), 'to\'g\'ri ulanish');
  assert.ok(!narrow.includes('Manba 0–5 V') && narrow.includes('p') && narrow.includes('n'), 'tor ekran');
  const rv = draw(WIDE, vaxFrame('si', -1, 10));
  assert.ok(rv.includes('Manba 0–30 V') && rv.includes('teskari') && rv.includes('kambag‘allashgan qatlam'), 'teskari ulanish: qatlam keng');
  lab.reset(); draw(WIDE, vaxFrame('si', 1, 2));
  const ids = handles(WIDE);
  for (const id of ['knob', 'pol']) assert.ok(ids.has(id), `VAX tutqichi: ${id}`);
  for (const pose of [null, ...POSES]) { if (pose) Object.assign(lab.camera, pose, { zoom: 1 }); draw(WIDE, vaxFrame('si', 1, 2)); dial(scene.knobAt, 'manba dastasi'); }
}

/* ---------------------------------------------- 3b) To'g'rilagich */
function recFrame(bridge, C, R = 100, ph = 0.3) {
  const r = P.rectifier({ Um: 12 * Math.SQRT2, R, C: C * 1e-6, bridge, N: 300 }), i = Math.round((ph / 2) * (r.t.length - 1));
  return { mode: 'rect', anim: ph, Q: { bridge, C, R, uin: r.uin, uout: r.uout, i, u: r.uin[i], v: r.uout[i], cond: r.id[i] > 0.002, pos: r.uin[i] > 0 } };
}
scene.setMode('rect');
for (const stage of stages) for (const bridge of [false, true]) for (const C of [0, 100, 470, 1000, 2200]) for (const ph of [0, 0.3, 0.8, 1.3, 1.99]) draw(stage, recFrame(bridge, C, 100, ph));
{
  const wide = draw(WIDE, recFrame(true, 1000));
  for (const s of ['D1', 'D2', 'D3', 'D4', '1000 μF', 'R = 100 Ω']) assert.ok(wide.includes(s), `ko'prik: ${s}`);
  assert.ok(!draw(WIDE, recFrame(false, 0)).includes('D2'), 'yarim davrli: bitta diod');
}

/* ---------------------------------------------- 3c) Tranzistor */
function trFrame(U, Rb = 2000) {
  const t = P.transistor(U, Rb, 6, 40), br = Math.min(1.3, (t.Ic * t.Ic * 40) / 0.9);
  return { mode: 'tr', anim: 0.5, T: { U, f: U / 6, Ib: t.Ib, Ic: t.Ic, cut: t.cut, sat: t.sat, onB: t.Ib > 1e-6, onC: t.Ic > 1e-5, br, rgb: [255, 200, 120], Rb, RbText: `${Rb / 1000} kΩ` } };
}
scene.setMode('tr');
for (const stage of stages) for (const U of [0, 0.7, 1.5, 3, 6]) for (const Rb of [1000, 2000, 4700, 10000]) draw(stage, trFrame(U, Rb));
{
  assert.ok(draw(WIDE, trFrame(0)).includes('yopiq'), 'tranzistor yopiq');
  assert.ok(draw(WIDE, trFrame(6, 1000)).includes('to‘yinish (kalit ochiq)'), 'to\'yinish');
  lab.reset(); draw(WIDE, trFrame(1.5));
  assert.ok(handles(WIDE).has('pot'), 'potensiometr dastasi');
  for (const pose of [null, ...POSES]) { if (pose) Object.assign(lab.camera, pose, { zoom: 1 }); draw(WIDE, trFrame(1.5)); dial(scene.potAt, 'potensiometr'); }
}

/* rejim almashganda kamera shu rejim ko'rinishiga qaytadi, bir xil rejimda saqlanadi */
Object.assign(lab.camera, { yaw: 1, pitch: 1, zoom: 1.3 });
scene.setMode('tr'); assert.equal(lab.camera.yaw, 1, 'bir xil rejim — kamera saqlanadi');
scene.setMode('thermo'); assert.deepEqual({ ...lab.camera }, { yaw: -0.3, pitch: 0.34, zoom: 1 }, 'rejim almashdi — kamera qaytdi');

console.log(`t_semi_3d: OK (${coordinates} koordinata)`);
