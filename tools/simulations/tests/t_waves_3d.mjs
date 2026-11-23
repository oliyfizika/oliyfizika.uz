import assert from 'node:assert/strict';
import * as W from '../../../assets/js/simulations/waves-physics.js';
import { createWavesLab, stringPoint, waterPoint, soundPoint } from '../../../assets/js/simulations/waves-lab-3d.js';

const near = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);
near(W.harmonic(3, 2, 4), .75); near(W.harmonic(3, 2, 4, 'free'), .625);
assert.equal(W.nearestHarmonic(.75, 2, 4).n, 3);

// A pulse reaches the termination at t≈2.15 s, then returns with the correct sign.
for (const right of ['fixed', 'free', 'open']) {
  const sim = new W.StringWave({ L: 4, n: 400, v: 2, gamma: 0, right });
  for (let i = 0; i < 480; i++) sim.advance(.005, t => .06 * Math.exp(-(((t - .15) / .06) ** 2)));
  const reflected = sim.at(3.5);
  if (right === 'fixed') assert.ok(reflected < -.055, `fixed reflection: ${reflected}`);
  if (right === 'free') assert.ok(reflected > .055, `free reflection: ${reflected}`);
  if (right === 'open') assert.ok(Math.abs(reflected) < .002, `absorber reflection: ${reflected}`);
}

// A standing eigenmode retains its period and amplitude in the undamped solver.
const normal = new W.StringWave({ L: 4, n: 400, v: 2, gamma: 0, right: 'fixed' });
const dt = .002, omega = Math.PI * normal.v / normal.L;
for (let i = 0; i <= normal.n; i++) {
  normal.u[i] = .04 * Math.sin(Math.PI * i / normal.n);
  normal.uo[i] = normal.u[i] * Math.cos(omega * dt);
}
for (let i = 0; i < 2000; i++) normal.stepOnce(dt, () => 0);
near(normal.at(2), .04, 1e-5);

const src = [{ x: -7, y: -12, phase: 0 }, { x: 7, y: -12, phase: 0 }];
const opts = { k: 2 * Math.PI / 5, w: 6 * Math.PI, v: 15, r0: 1.5, t0: 0 };
assert.equal(W.rippleHeight(src, 0, 8, .1, opts), 0, 'wave cannot precede the advancing front');
const anti = [src[0], { ...src[1], phase: Math.PI }];
near(W.rippleAmplitude(anti, 0, 8, opts), 0);
assert.equal(W.pathDifference(src[0], src[1], 0, 8, 5).kind, 'max');
assert.equal(W.pathDifference(src[0], src[1], 0, 8, 5, Math.PI).kind, 'min');
near(W.dopplerLine(440, 343, 171.5), 880);
near(W.dopplerLine(440, 343, -171.5), 440 / 1.5);
const arrival = W.received(440, 343, { x0: 0, y: 0, u: 0 }, { x: 12, y: -4 }, .1);
assert.equal(arrival.length, 1); near(arrival[0].f, 440); near(arrival[0].te + Math.hypot(12, -4) / 343, .1);
const shock = W.received(300, 343, { x0: -22, y: 0, u: 1.6 * 343 }, { x: -12, y: -6 }, .07);
assert.equal(shock.length, 2);
for (const s of shock) near(Math.hypot(-12 - (-22 + 1.6 * 343 * s.te), -6), 343 * (.07 - s.te));
near(W.machAngle(1.6 * 343, 343), Math.asin(1 / 1.6) * 180 / Math.PI);

globalThis.document = { createElement: () => ({ getContext: () => null }) };
let numeric = 0;
const check = (...args) => { for (const v of args) if (typeof v === 'number') { assert.ok(Number.isFinite(v), `finite renderer coordinate: ${v}`); numeric++; } };
const ctx = new Proxy({ measureText: text => ({ width: String(text).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (target, key) => key in target ? target[key] : check });
const colors = Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special'].map(k => [k, '#64748b']));
const stage = { w: 720, h: 340, colors };
const scene = createWavesLab();
const str = { wave: 'trans', src: 'harm', f: .75, A: 4, v: 2, right: 'fixed', probeX: 1.5, env: Float64Array.from(normal.u, Math.abs) };
const rip = { n: 2, f: 3, v: 15, dphi: 0, s1: src[0], s2: src[1], probe: { x: 6, y: 8 }, t: 3, t0: 0 };
const dop = { t: .07, f: 300, c: 343, M: 1.6, fronts: Array.from({ length: 21 }, (_, i) => ({ te: i / 300, xe: -22 + i / 300 * 1.6 * 343 })), A: { x: 12, y: -4 }, B: { x: -12, y: -6 } };
const details = { nodes: [0, 4 / 3, 8 / 3, 4], harmonic: { n: 3 }, sources: src, srcX: t => -22 + 1.6 * 343 * t, recv: o => W.received(dop.f, dop.c, { x0: -22, y: 0, u: dop.M * dop.c }, o, dop.t) };
// The collar must follow actual longitudinal displacement at a free end.
const moving = new W.StringWave({ right: 'free' }); moving.u.fill(.04);
const rod = scene.lab.rod, rods = [];
scene.lab.rod = (...args) => { rods.push(args); rod(...args); };
scene.draw(ctx, stage, { mode: 'string' }, { ...str, right: 'free', wave: 'long' }, moving, rip, dop, details);
scene.lab.rod = rod;
const tip = stringPoint(4, .04, true);
const collar = rods.filter(([a, b]) => Math.abs(a[0] - tip[0]) < 1e-9 && Math.abs(b[0] - tip[0]) < 1e-9 && Math.abs(Math.hypot(a[1] - tip[1], a[2]) - .1) < 1e-9);
assert.equal(collar.length, 48, 'free longitudinal collar follows the displaced x coordinate');
assert.ok(rods.some(([a, b]) => a[0] === 2.05 && b[0] === 3.02 && a[1] === 1.15 && b[1] === 1.15), 'free longitudinal guide is horizontal');
// Cached trigonometric coefficients must reproduce the analytical field,
// including finite propagation, nonzero phase, and the shortest wavelength.
const face = scene.lab.face, shortest = { ...rip, f: 8, v: 6, dphi: 90 }, phased = [{ ...src[0], phase: Math.PI / 2 }, src[1]];
for (const t of [.1, 1.2, 5]) {
  const samples = []; let waterFaces = 0;
  scene.lab.face = (points, fill, ...rest) => {
    if (fill?.startsWith('rgb(')) {
      waterFaces++;
      const projected = rest[2];
      assert.equal(projected?.length, 4, 'shared mesh vertices are projected once per frame');
      for (let i = 0; i < 4; i++) {
        const expected = scene.lab.project(points[i]);
        near(projected[i].x, expected.x); near(projected[i].y, expected.y); near(projected[i].d, expected.d);
      }
      near(Math.abs(points[3][2] - points[0][2]) / .065, .75 / 2.1, 1e-9);
      if (waterFaces % 43 === 0) samples.push(...points.map(p => [...p]));
    }
    face(points, fill, ...rest);
  };
  scene.draw(ctx, stage, { mode: 'ripple', show: { lines: true } }, str, normal, { ...shortest, t }, dop, { ...details, sources: phased });
  scene.lab.face = face;
  assert.equal(waterFaces, 168 * 112, 'spatial mesh exceeds Nyquist in each direction');
  for (const p of samples) {
    const h = .5 * W.rippleHeight(phased, p[0] / .065, -p[2] / .065, t, { k: 2 * Math.PI / .75, w: 16 * Math.PI, v: 6, r0: 1.5, t0: 0 });
    near(p[1], .42 + h * .085, 1e-9);
  }
}
for (const width of [375, 720]) {
  stage.w = width;
  for (const wave of ['trans', 'long']) for (const right of ['fixed', 'free', 'open']) for (const source of ['harm', 'hand', 'pulse']) {
    const state = { ...str, wave, right, src: source };
    scene.draw(ctx, stage, { mode: 'string' }, state, normal, rip, dop, details);
    const px = scene.lab.project(stringPoint(1.5, normal.at(1.5), wave === 'long'));
    assert.equal(scene.lab.hit(px.x, px.y), 'probe');
    near(scene.stringX(px.x, px.y, state, normal), 1.5, .01);
  }
  for (const [n, dphi, f, v] of [[1, 0, 3, 15], [2, 0, 3, 15], [2, 180, 3, 15], [2, 360, 8, 6]]) {
    scene.draw(ctx, stage, { mode: 'ripple', show: { lines: true } }, str, normal, { ...rip, n, dphi, f, v }, dop, { ...details, sources: n === 1 ? [src[0]] : [{ ...src[0], phase: dphi * Math.PI / 180 }, src[1]] });
  }
  for (const M of [0, .5, 1, 1.6]) scene.draw(ctx, stage, { mode: 'doppler' }, str, normal, rip, { ...dop, M }, details);
  for (const mode of ['ripple', 'doppler']) for (const yaw of [-Math.PI, -.5, 0, Math.PI / 2, Math.PI]) {
    scene.lab.camera.yaw = yaw;
    scene.draw(ctx, stage, { mode, show: { lines: false } }, str, normal, rip, dop, details);
    const world = mode === 'ripple' ? waterPoint(8, -6) : soundPoint(-5, 6); world[1] = .77;
    const p = scene.lab.project(world), restored = scene.horizontalPoint(p.x, p.y, world[1]);
    assert.ok(restored); near(restored[0], world[0]); near(restored[2], world[2]);
  }
}
assert.ok(numeric > 100000);
console.log('Waves 3D: pulse reflection/absorption, normal mode, interference/causality, Doppler retarded times, all 3 scene modes and orbital drag inverse passed.');
