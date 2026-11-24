// Magnit maydonda zaryadli zarra 3D sahnasi (lorentz-lab-3d.js): Lorens kuchi, vint chiziq, mass-spektrometr va siklotronning
// barcha holatlarida koordinatalar chekli; tutqichlar sahnada; dasta, chegara, manba va o'lchagich uchun ekran ↔ sahna almashtirishlari to'g'ri.
// node tools/simulations/tests/t_lorentz_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/lorentz-physics.js';
import { createLorentzLab, S, LOR_W } from '../../../assets/js/simulations/lorentz-lab-3d.js';

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
const scene = createLorentzLab(), lab = scene.lab;
const draw = (stage, f) => { texts = []; scene.draw(ctx, stage, f); return texts; };
function handles(stage) {
  const ids = new Set();
  for (let x = 2; x < stage.w; x += 3) for (let y = 2; y < stage.h; y += 3) { const id = lab.hit(x, y); if (id) ids.add(id); }
  return ids;
}
const REF = { e: { v: 1e7, B: 1e-3 }, p: { v: 1e6, B: 0.1 }, a: { v: 5e5, B: 0.1 } };

/* ---------------------------------------------- 1a) Lorens kuchi: tekislik */
function planeFrame(k, { kv = 1, kb = 1, Bs = 1, th = 0, ys = 0, xB = 18, t = 1e-7 } = {}) {
  const pr = P.PARTICLES[k], v = REF[k].v * kv * 100, B = REF[k].B * kb;
  let p = [2 + Math.cos(th) * 2.4, ys + Math.sin(th) * 2.4], vv = [Math.cos(th) * v, Math.sin(th) * v];
  const trail = [p.slice()];
  for (let i = 0; i < 400; i++) {
    if (p[0] >= xB) { const r = P.stepPlane([p[0] / 100, p[1] / 100], [vv[0] / 100, vv[1] / 100], t / 400, pr.q, pr.m, Bs * B); p = [r.p[0] * 100, r.p[1] * 100]; vv = [r.v[0] * 100, r.v[1] * 100]; }
    else p = [p[0] + vv[0] * t / 400, p[1] + vv[1] * t / 400];
    trail.push(p.slice());
  }
  return { mode: 'plane', L: { name: pr.name, q: pr.q, m: pr.m, e: P.E, B, Bs, kv, kb, th, ys, xB, p, v: vv, trail, inField: p[0] >= xB, vec: true, slow: 4.6e6 } };
}
scene.setMode('plane');
assert.deepEqual({ ...lab.camera }, { yaw: -0.3, pitch: 0.85, zoom: 1 }, 'Lorens rejimining boshlang\'ich ko\'rinishi');
for (const stage of stages) for (const k of ['p', 'e', 'a']) for (const kv of [0.2, 1, 2]) for (const kb of [0.25, 1, 2]) for (const Bs of [1, -1]) for (const xB of [0, 18, 44]) draw(stage, planeFrame(k, { kv, kb, Bs, xB, th: 0.5, ys: -4 }));
{
  const wide = draw(WIDE, planeFrame('p')), narrow = draw(NARROW, planeFrame('p'));
  assert.ok(wide.includes('B = 0,100 T') && wide.includes('B ↑'), 'B ko\'rsatkichi');
  for (const s of ['proton manbai', 'B — yuqoriga (bosing)']) { assert.ok(wide.includes(s), `keng: ${s}`); assert.ok(!narrow.includes(s), `tor: ${s} yo'q`); }
  assert.ok(draw(WIDE, planeFrame('p', { Bs: -1 })).includes('B ↓'), 'B pastga');
  lab.reset(); draw(WIDE, planeFrame('p'));
  const ids = handles(WIDE);
  for (const id of ['edge', 'gun', 'tip', 'bflip']) assert.ok(ids.has(id), `Lorens tutqichi: ${id}`);
  for (const pose of [null, ...POSES]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, planeFrame('p', { th: 0.4, ys: 3, kv: 1.5 }));
    for (let x = 6; x <= LOR_W - 4; x += 4) { const p = lab.project(scene.edgeAt(x)); near(lab.nearest(scene.edgeAt, 6, LOR_W - 4, p.x, p.y), x, 0.25, 'maydon chegarasi'); }
    for (let y = -11; y <= 11; y += 2) { const p = lab.project(scene.gunAt(y)); near(lab.nearest(scene.gunAt, -11, 11, p.x, p.y), y, 0.15, 'manba'); }
    // v uchi: ekran nuqtasi → tekislikdagi siljish (cm)
    for (const [dx, dy] of [[4.8, 0], [3, 2], [1, -3]]) {
      const ox = 2 + Math.cos(0.4) * 2.8, oy = 3 + Math.sin(0.4) * 2.8, p = lab.project([-2.28 + (ox + dx) * S, 0.42, (oy + dy) * S]);
      const d = scene.tipDelta(p); near(d[0], dx, 0.01, 'v uchi x'); near(d[1], dy, 0.01, 'v uchi y');
    }
  }
}

/* ---------------------------------------------- 1b) Vint chiziq */
function helixFrame(k, { kv = 1, kb = 1, alpha = Math.PI / 3, tt = 0 } = {}) {
  const pr = P.PARTICLES[k], B = REF[k].B * kb, hl = P.helix(pr.m, REF[k].v * kv, pr.q, B, alpha);
  return { mode: 'helix', H: { name: pr.name, q: pr.q, B, alpha, kv, r: hl.r * 100, T: hl.T, Om: (pr.q * B) / pr.m, vl: hl.vl * 100, vp: hl.vp * 100, tt: tt * hl.T, x0: 4, vec: true } };
}
scene.setMode('helix');
assert.deepEqual({ ...lab.camera }, { yaw: -0.5, pitch: 0.3, zoom: 1 }, 'vint rejimining boshlang\'ich ko\'rinishi');
for (const stage of stages) for (const k of ['p', 'e', 'a']) for (const kv of [0.2, 1, 2]) for (const kb of [0.25, 1, 2]) for (const a of [10, 45, 60, 90]) for (const tt of [0, 1.3, 5]) draw(stage, helixFrame(k, { kv, kb, alpha: (a * Math.PI) / 180, tt }));
{
  const wide = draw(WIDE, helixFrame('p')), narrow = draw(NARROW, helixFrame('p'));
  const h = P.helix(P.PARTICLES.p.m, 1e6, P.E, 0.1, Math.PI / 3).pitch * 100;
  assert.ok(wide.includes(`qadam h = ${h.toFixed(1).replace('.', ',')} cm`) && narrow.includes(`h = ${h.toFixed(1).replace('.', ',')} cm`), 'vint qadami');
  assert.ok(wide.includes('α = 60°'), 'burchak');
  lab.reset(); draw(WIDE, helixFrame('p'));
  assert.ok(handles(WIDE).has('htip'), 'vint tutqichi');
  for (const pose of [null, POSES[0]]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    const f = helixFrame('p'); draw(WIDE, f);
    const zc = -f.H.r, o = [-2.28 + 4 * S, 1.25, zc * S];
    for (const [dx, dy] of [[3.2, 0], [1.6, 2.77], [0.5, 4]]) { const d = scene.htipDelta(lab.project([o[0] + dx * S, o[1] + dy * S, o[2]])); near(d[0], dx, 0.01, 'vint v x'); near(d[1], dy, 0.01, 'vint v y'); }
  }
}

/* ---------------------------------------------- 2) Mass-spektrometr */
const MS = { H: [['¹H', 1.00783], ['²H (D)', 2.0141], ['³H (T)', 3.01605]], Ne: [['²⁰Ne', 19.99244], ['²²Ne', 21.99139]], Cl: [['³⁵Cl', 34.96885], ['³⁷Cl', 36.9659]] };
const COL = ['#2563eb', '#dc2626', '#16a34a'];
function msFrame(set, { U = 1000, B = 0.2, sel = false, Ef = 9800, ruler = 20.4 } = {}) {
  const ions = MS[set].map(([n, A], i) => { const m = A * P.AMU, v = P.speedFromU(m, P.E, U), r = P.msRadius(m, P.E, U, B); let pass = true; if (sel && Math.abs(P.selectorShift(m, P.E, v, Ef, 0.1, 0.08)) > 0.0005) pass = false; return { n, A, m, v, r, pass, col: COL[i] }; });
  const live = ions.map((io, i) => ({ pos: [-10 + 4 * i, 0], col: io.col })), hits = ions.flatMap((io) => (io.pass ? Array.from({ length: 30 }, (_, j) => ({ d: 2 * io.r * 100 + (j % 3) * 0.05, col: io.col })) : []));
  return { mode: 'ms', M: { ions, live, hits, ruler, mMeas: P.massFromR(ruler / 200, P.E, U, B) / P.AMU, U, B, Ef, sel, B1: 0.1, L: 0.08 } };
}
scene.setMode('ms');
for (const stage of stages) for (const set of Object.keys(MS)) for (const U of [200, 1000, 3000]) for (const B of [0.05, 0.2, 0.5]) for (const sel of [false, true]) draw(stage, msFrame(set, { U, B, sel }));
{
  const wide = draw(WIDE, msFrame('Ne', { sel: true })), narrow = draw(NARROW, msFrame('Ne', { sel: true }));
  assert.ok(wide.includes('1000 V') && wide.includes('9,8 kV/m'), 'manbalar displeyi');
  assert.ok(wide.includes('²²Ne: selektorda to‘xtadi'), 'selektor afsonasi');
  for (const s of ['ion manbai', 'U — tezlatuvchi kuchlanish']) { assert.ok(wide.includes(s), `keng: ${s}`); assert.ok(!narrow.includes(s), `tor: ${s} yo'q`); }
  lab.reset(); draw(WIDE, msFrame('Ne', { sel: true }));
  const ids = handles(WIDE);
  for (const id of ['kU', 'kE', 'ruler']) assert.ok(ids.has(id), `mass-spektrometr tutqichi: ${id}`);
  for (const pose of [null, ...POSES.slice(0, 2)]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, msFrame('Ne', { sel: true }));
    for (let d = 1; d <= 23; d += 2) { const p = lab.project(scene.rulerAt(d)); near(lab.nearest(scene.rulerAt, 0.5, 23.5, p.x, p.y), d, 0.15, 'o\'lchagich'); }
    for (const kf of [scene.knobU, scene.knobE]) for (let f = 0; f <= 1.0001; f += 0.1) { const p = lab.project(kf(f)); near(lab.nearest(kf, 0, 1, p.x, p.y), f, 0.02, 'dasta'); }
  }
}

/* ---------------------------------------------- 3) Siklotron */
function cycFrame(k, { B = 1, fr = 1, n = 600 } = {}) {
  const pr = P.PARTICLES[k], fc = P.cycFreq(pr.m, pr.q, B), trail = [];
  for (let i = 0; i <= n; i++) { const a = i * 0.1, r = 0.01 + 0.0004 * i; trail.push([r * Math.cos(a), r * Math.sin(a)]); }
  const p = trail[trail.length - 1];
  return { mode: 'cyc', Y: { q: pr.q, B, R: 0.25, p, v: [-p[1] * 1e7, p[0] * 1e7], trail, out: false, Vnow: Math.cos(n), fgen: fr * fc, fc, t: 3.3 / fc, cross: [1 / fc, 2.1 / fc, 3.2 / fc], W: 1.23, vec: true } };
}
scene.setMode('cyc');
for (const stage of stages) for (const k of ['p', 'a']) for (const B of [0.3, 1, 1.5]) for (const fr of [0.8, 1, 1.03, 1.2]) for (const n of [0, 50, 600]) draw(stage, cycFrame(k, { B, fr, n }));
{
  const wide = draw(WIDE, cycFrame('p')), narrow = draw(NARROW, cycFrame('p', { fr: 1.03 }));
  assert.ok(wide.includes('Rezonans ✓') && narrow.includes('Rezonans'), 'rezonans belgisi');
  assert.ok(wide.includes('Ossillograf: U(t)') && !narrow.includes('Ossillograf: U(t)'), 'ossillograf yozuvi tor ekranda yashirin');
  assert.ok(draw(WIDE, cycFrame('p', { fr: 1.03 })).includes('Generator · farq +3,0%'), 'chastota farqi');
  lab.reset(); draw(WIDE, cycFrame('p'));
  const ids = handles(WIDE);
  for (const id of ['kF', 'res']) assert.ok(ids.has(id), `siklotron tutqichi: ${id}`);
  for (const pose of [null, ...POSES.slice(0, 2)]) {
    if (pose) Object.assign(lab.camera, pose, { zoom: 1 });
    draw(WIDE, cycFrame('p'));
    for (let f = 0; f <= 1.0001; f += 0.1) { const p = lab.project(scene.knobF(f)); near(lab.nearest(scene.knobF, 0, 1, p.x, p.y), f, 0.02, 'generator dastasi'); }
  }
}
assert.ok(coordinates > 1e6, 'sahnalar chizildi');
console.log(`t_lorentz_3d: OK (${coordinates} koordinata)`);
