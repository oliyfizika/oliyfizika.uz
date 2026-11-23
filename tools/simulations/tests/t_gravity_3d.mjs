// Butun olam tortishish qonuni 3D sahnasi (gravity-lab-3d.js): laboratoriya va osmon rejimlarining barcha
// holatlarida koordinatalar chekli, ekran → markazlar tekisligi almashtirishi aniq. node tools/simulations/tests/t_gravity_3d.mjs
import assert from 'node:assert/strict';
import { G, gravity } from '../../../assets/js/simulations/inverse-square.js';
import { createGravityLab, sceneRadius, GRAVITY_SPAN, GRAVITY_BOUNDS, PLANE_Y } from '../../../assets/js/simulations/gravity-lab-3d.js';

globalThis.document = { createElement: () => ({ getContext: () => null }) };
let coordinates = 0;
const check = (...args) => { for (const v of args) if (typeof v === 'number') { assert.ok(Number.isFinite(v), 'chekli koordinata'); coordinates++; } };
const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => (k in o ? o[k] : check) });
const palette = (dark) => ({ ...Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special', 'grid'].map((k) => [k, '#888'])), dark });
const stages = [{ w: 760, h: 414, colors: palette(false) }, { w: 360, h: 300, colors: palette(true) }];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≈ ${b}`);

// gravity.js dagi jismlar (rang va shartli o'lcham) va juftliklar
const BODIES = {
  earth: { name: 'Yer', m: 5.972e24, color: '#3b82f6', color2: '#10b981', px: 20 },
  moon: { name: 'Oy', m: 7.342e22, color: '#9ca3af', px: 10 },
  sun: { name: 'Quyosh', m: 1.989e30, color: '#f59e0b', color2: '#fde047', px: 36 },
  iss: { name: 'XKS', m: 4.2e5, color: '#94a3b8', px: 5, station: true },
  jupiter: { name: 'Yupiter', m: 1.898e27, color: '#d6a273', color2: '#b45309', px: 30 },
  io: { name: 'Io', m: 8.93e22, color: '#eab308', px: 10 },
};
const PAIRS = [['earth', 'moon', 3.844e8, .5], ['sun', 'earth', 1.496e11, .5], ['earth', 'iss', 6.771e6, .95], ['jupiter', 'io', 4.217e8, .5]];
const ballR = (m) => Math.cbrt((3 * m) / (4 * Math.PI * 7800));

// sceneRadius: laboratoriyada po'lat shar masshtabda (kamida 0,03), osmonda — shartli
assert.equal(sceneRadius(false, {}, ballR(500), GRAVITY_SPAN / 5), Math.max(.03, ballR(500) * GRAVITY_SPAN / 5));
assert.equal(sceneRadius(false, {}, 1e-4, 1), .03);
assert.equal(sceneRadius(true, BODIES.sun, 0, 1), 36 / 90);
assert.equal(sceneRadius(true, BODIES.iss, 0, 1), .12);

const scene = createGravityLab(), lab = scene.lab;
let frames = 0;
/** Jismlar stol chegarasida qoladi (gravity.js dagi keepOnTable kabi). */
const onTable = (p, rr, S) => ({ x: Math.max(-(GRAVITY_BOUNDS.x - rr) / S, Math.min((GRAVITY_BOUNDS.x - rr) / S, p.x)), y: Math.max(-(GRAVITY_BOUNDS.z - rr) / S, Math.min((GRAVITY_BOUNDS.z - rr) / S, p.y)) });
function cfgFor(space, M, r, angle, offset = 0) {
  const S = GRAVITY_SPAN / M.rMax, rad1 = sceneRadius(space, M.b1, M.R1, S), rad2 = sceneRadius(space, M.b2, M.R2, S);
  const ux = Math.cos(angle), uy = Math.sin(angle), mx = offset * M.rMax, my = -offset * M.rMax / 3;
  const p1 = onTable({ x: mx - (ux * r) / 2, y: my - (uy * r) / 2 }, rad1, S), p2 = onTable({ x: mx + (ux * r) / 2, y: my + (uy * r) / 2 }, rad2, S);
  const rr = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return { space, rMax: M.rMax, p1, p2, rad1, rad2, b1: M.b1, b2: M.b2, m1: M.m1, m2: M.m2, F: rr > 0 ? gravity(M.m1, M.m2, rr).F : 0, Fmin: M.Fmin, Fmax: M.Fmax, rLabel: 'r', label1: 'm₁', label2: 'm₂' };
}
const shows = [{ forces: true, field: true }, { forces: false, field: true }, { forces: true, field: false }];
const angles = [0, Math.PI / 4, Math.PI / 2, 2.6];

// Laboratoriya: po'lat sharlar 1–1000 kg, r — tegib turgandan 5 m gacha, har xil yo'nalish va joy
for (const stage of stages) for (const [m1, m2] of [[500, 100], [1, 1], [1000, 1000], [1, 1000]]) {
  const M = { m1, m2, R1: ballR(m1), R2: ballR(m2), rMax: 5, b1: { name: 'm₁' }, b2: { name: 'm₂' }, Fmin: G / 25, Fmax: (G * 1e6) / .39 };
  for (const r of [ballR(m1) + ballR(m2) + .005, .2, 1, 2.5, 5]) for (const angle of angles) for (const show of shows) {
    scene.draw(ctx, stage, cfgFor(false, M, r, angle, r < 2 ? .1 : 0), show); frames++;
  }
}
// Osmon: to'rt juftlik, masofa ko'paytuvchisi kMin..3
for (const stage of stages) for (const [a, b, d, kMin] of PAIRS) {
  const b1 = BODIES[a], b2 = BODIES[b], M = { m1: b1.m, m2: b2.m, rMax: 3 * d, b1, b2, Fmin: (G * b1.m * b2.m) / (3 * d) ** 2, Fmax: (G * b1.m * b2.m) / (kMin * d) ** 2 };
  for (const k of [kMin, 1, 2, 3]) for (const angle of angles) for (const show of shows) { scene.draw(ctx, stage, cfgFor(true, M, k * d, angle), show); frames++; }
}
// Ustma-ust tushgan markazlar (r = 0) ham NaN bermaydi
scene.draw(ctx, stages[0], { ...cfgFor(false, { m1: 500, m2: 100, R1: ballR(500), R2: ballR(100), rMax: 5, b1: {}, b2: {}, Fmin: G / 25, Fmax: G * 1e6 / .39 }, 1, 0), p2: { x: -.5, y: 0 }, F: 0 }, shows[0]);

// Ekran → markazlar tekisligi: istalgan kamera holatida jism kursor ostida qoladi; ufqdan narisi — null
{
  const M = { m1: 500, m2: 100, R1: ballR(500), R2: ballR(100), rMax: 5, b1: { name: 'm₁' }, b2: { name: 'm₂' }, Fmin: G / 25, Fmax: (G * 1e6) / .39 };
  const cfg = cfgFor(false, M, 1, 0), S = GRAVITY_SPAN / M.rMax;
  for (const pose of [{ yaw: -.5, pitch: .35, zoom: 1 }, { yaw: 2.2, pitch: 1.35, zoom: 1.65 }, { yaw: -3.1, pitch: .08, zoom: .7 }, { yaw: 7.5, pitch: .6, zoom: 1.2 }]) {
    Object.assign(lab.camera, pose);
    scene.draw(ctx, stages[0], cfg, shows[0]);
    for (const [x, y] of [[0, 0], [-2.4, 1.1], [2.4, -1.1], [1.3, .4]]) {
      const q = scene.modelPoint(lab.project([x * S, PLANE_Y, -y * S]));
      assert.ok(q, `tekislik nuqtasi topiladi (yaw ${pose.yaw})`);
      near(q.x, x, 1e-6, 'model x'); near(q.y, y, 1e-6, 'model y');
    }
    for (const [id, p] of [['p1', cfg.p1], ['p2', cfg.p2]]) { const s = lab.project([p.x * S, PLANE_Y, -p.y * S]); assert.equal(lab.hit(s.x, s.y), id, `tutqich ${id}`); }
  }
  Object.assign(lab.camera, { yaw: -.5, pitch: .08, zoom: 1 });
  scene.draw(ctx, stages[0], cfg, shows[0]);
  assert.equal(scene.modelPoint({ x: 380, y: 0 }), null, 'ufqdan yuqoridagi nuqta tekislikka tushmaydi');
  lab.reset();
}

assert.ok(coordinates > 100000, `koordinatalar soni: ${coordinates}`);
console.log(`Tortishish 3D: ${frames} holat (laboratoriya va 4 osmon juftligi), sceneRadius, ekran → tekislik almashtirishi va tutqichlar — ${coordinates} ta chekli koordinata.`);
