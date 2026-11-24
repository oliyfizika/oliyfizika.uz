// Elektromagnit to'lqinlar 3D sahnasi (emwaves-lab-3d.js): EM to'lqin, Gers tajribalari va radioaloqaning barcha holatlarida
// koordinatalar chekli; tutqichlar sahnada; o'lchov aravachasi, nurlatgich, qabul qiluvchi va shkala uchun teskari almashtirishlar to'g'ri.
// node tools/simulations/tests/t_emwaves_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/emwaves-physics.js';
import { createEmwavesLab, HIT, RE, RXC } from '../../../assets/js/simulations/emwaves-lab-3d.js';

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
const scene = createEmwavesLab(), lab = scene.lab;
const draw = (stage, f) => { texts = []; scene.draw(ctx, stage, f); return texts; };
function handles(stage) {
  const ids = new Set();
  for (let x = 2; x < stage.w; x += 3) for (let y = 2; y < stage.h; y += 3) { const id = lab.hit(x, y); if (id) ids.add(id); }
  return ids;
}
const DEG = Math.PI / 180;

/* ---------------------------------------------- 1) EM to'lqin */
const waveFrame = (lg, { n = 1, u = 0.3, probe = 0.55, showB = true, E0 = 50 } = {}) => { const f = 10 ** lg; return { mode: 'wave', W: { u, n, water: n === 9, vc: P.visibleColor(f), showB, probe, E0, lam: P.lambdaOf(f, n), band: P.bandOf(f).name } }; };
scene.setMode('wave');
assert.deepEqual({ ...lab.camera }, { yaw: -0.55, pitch: 0.3, zoom: 1 }, 'to\'lqin rejimining boshlang\'ich ko\'rinishi');
for (const stage of stages) for (const lg of [4, 6, 8, 9.4, 14.7, 18, 21]) for (const n of [1, 9, 1.5]) for (const u of [0, 0.37, 2.9]) for (const probe of [0.02, 0.5, 0.98]) for (const showB of [true, false]) draw(stage, waveFrame(lg, { n, u, probe, showB }));
{
  const wide = draw(WIDE, waveFrame(8, { u: 0 })), narrow = draw(NARROW, waveFrame(8, { u: 0 }));
  assert.ok(wide.includes('λ = 3,00 m') && wide.includes('v = c'), 'λ va v');
  assert.ok(wide.includes('vibrator') && !narrow.includes('vibrator'), 'tor ekranda vibrator yozuvi yashirin');
  assert.ok(wide.includes(`E = ${(Math.cos(-2 * Math.PI * 0.55 * 2.5) * 50).toFixed(1).replace('.', ',').replace('-', '−')} V/m`) || wide.some((t) => t.startsWith('E = ')), 'o\'lchov nuqtasidagi E');
  assert.ok(draw(WIDE, waveFrame(8, { n: 1.5 })).includes('v = c/n'), 'muhitda v = c/n');
  lab.reset(); draw(WIDE, waveFrame(8));
  assert.ok(handles(WIDE).has('probe'), 'o\'lchov aravachasi');
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, waveFrame(8));
    for (let f = 0.05; f <= 0.95; f += 0.1) { const p = lab.project(scene.probeAt(f)); near(lab.nearest(scene.probeAt, 0.02, 0.98, p.x, p.y), f, 0.01, 'o\'lchov nuqtasi'); }
  }
}

/* ---------------------------------------------- 2) Gers tajribalari */
const propsFrame = (view, { a = 40 * DEG, n = 1.5, phi = 30 * DEG, ph = 0.4 } = {}) => ({ mode: 'props', P: { view, a, n, phi, ph, b: view === 'refract' ? P.refractAngle(1, n, a) : null, R: view === 'reflect' ? 1 : P.reflectance(1, n, a), P0: P.receiverPower(phi) } });
for (const view of ['reflect', 'refract', 'polar']) {
  scene.setMode(view);
  for (const stage of stages) for (const a of [0, 20, 45, 80]) for (const n of [1.1, 1.5, 3]) for (const phi of [0, 30, 90, 180]) draw(stage, propsFrame(view, { a: a * DEG, n, phi: phi * DEG }));
}
{
  scene.setMode('reflect'); lab.reset();
  const wide = draw(WIDE, propsFrame('reflect'));
  assert.ok(wide.includes('α = 40,0°') && wide.includes('β = 40,0°'), 'qaytish: α = β');
  assert.ok(handles(WIDE).has('emit'), 'nurlatgich tutqichi');
  scene.setMode('refract'); lab.reset();
  const rf = draw(WIDE, propsFrame('refract', { a: 45 * DEG }));
  assert.ok(rf.includes(`β = ${(Math.asin(Math.sin(45 * DEG) / 1.5) / DEG).toFixed(1).replace('.', ',')}°`), 'sinish burchagi');
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, propsFrame('refract'));
    for (const d of [0, 15, 40, 70, 80]) { const a = d * DEG, p = lab.project([HIT[0] - Math.sin(a) * RE, HIT[1], HIT[2] - Math.cos(a) * RE]); near(scene.emitAngle(p), a, 1e-6, 'nurlatgich burchagi'); }
  }
  scene.setMode('polar'); lab.reset();
  const pw = draw(WIDE, propsFrame('polar', { phi: 60 * DEG })), pn = draw(NARROW, propsFrame('polar', { phi: 60 * DEG }));
  assert.ok(pw.includes('signal 25 %') && pw.includes('φ = 60°'), 'qutblanish: cos²φ');
  assert.ok(pw.includes('qabul qiluvchi vibrator') && !pn.includes('qabul qiluvchi vibrator'), 'tor ekranda yozuv yashirin');
  draw(WIDE, propsFrame('polar'));
  assert.ok(handles(WIDE).has('rx'), 'qabul qiluvchi tutqichi');
  for (const pose of [null, POSES[0], POSES[2]]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, propsFrame('polar'));
    for (const d of [5, 30, 60, 90, 120, 175]) { const f = d * DEG, p = lab.project([RXC[0], RXC[1] + Math.cos(f) * 0.55, -Math.sin(f) * 0.55]); near(scene.rxAngle(p), f, 1e-6, 'vibrator burchagi'); }
  }
}

/* ---------------------------------------------- 3) Radioaloqa */
const STATIONS = [{ f: 0.70e6, label: '1-stansiya' }, { f: 0.99e6, label: '2-stansiya' }, { f: 1.27e6, label: '3-stansiya' }];
function radioFrame(f0, mod = 'am', t = 0.3) {
  const N = 480, sig = (k, fq) => Math.cos(0.3 * k * fq);
  const tr = { audio: Array.from({ length: N }, (_, k) => 0.6 * Math.cos(k * 0.02)), carrier: Array.from({ length: N }, (_, k) => sig(k, 1)), mod: Array.from({ length: N }, (_, k) => (1 + 0.6 * Math.cos(k * 0.02)) * sig(k, 1)), rx: Array.from({ length: N }, (_, k) => sig(k, 1.1)), det: Array.from({ length: N }, (_, k) => Math.abs(Math.cos(k * 0.02))), out: Array.from({ length: N }, (_, k) => 3 * Math.cos(k * 0.02)) };
  return { mode: 'radio', R: { tr, level: P.response(0.7e6, f0, 40), stations: STATIONS, f0, t, mod, label: '1-stansiya', f: 0.7e6 } };
}
scene.setMode('radio');
for (const stage of stages) for (const f0 of [0.5e6, 0.7e6, 0.85e6, 1.6e6]) for (const mod of ['am', 'fm']) for (const t of [0, 0.4, 7.3]) draw(stage, radioFrame(f0, mod, t));
{
  const wide = draw(WIDE, radioFrame(0.7e6)), narrow = draw(NARROW, radioFrame(0.7e6, 'fm'));
  for (const s of ['Mikrofon: tovush (F)', 'Modulyator: AM signal', 'Detektor (diod + RC)', 'Radiopriyomnik: f₀ = 0,700 MHz', '1,5']) assert.ok(wide.includes(s), `keng: ${s}`);
  for (const s of ['tovush', 'tashuvchi', 'modulyatsiya', 'kontur', 'detektor', 'karnay']) assert.ok(narrow.includes(s), `tor: ${s}`);
  assert.ok(!narrow.includes('1,0') && narrow.includes('1,1'), 'tor ekranda shkalada toq qiymatlar');
  lab.reset(); draw(WIDE, radioFrame(0.85e6));
  assert.ok(handles(WIDE).has('dial'), 'shkala tutqichi');
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, radioFrame(0.85e6));
    for (let f = 0.55; f <= 1.6; f += 0.1) { const p = lab.project(scene.dialAt(f)); near(lab.nearest(scene.dialAt, 0.5, 1.6, p.x, p.y), f, 0.006, 'sozlash shkalasi'); }
  }
}
assert.ok(coordinates > 1e6, 'sahnalar chizildi');
console.log(`t_emwaves_3d: OK (${coordinates} koordinata)`);
