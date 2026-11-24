// Kulon qonuni 3D sahnasi (coulomb-lab-3d.js): uch rejimning barcha holatlarida koordinatalar chekli,
// ekran ↔ sahna teskari almashtirishlari va tutqichlar to'g'ri. node tools/simulations/tests/t_coulomb_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/coulomb-physics.js';
import { fieldLines } from '../../../assets/js/simulations/inverse-square.js';
import { createCoulombLab } from '../../../assets/js/simulations/coulomb-lab-3d.js';

// coulomb.js dagi geometriya (mm)
const PX = 150, PY = 12, LEN = 150, RB = 5, RULER0 = 60, TABLE = 204;
const TRAY = { x0: 6, y0: 6, x1: 354, y1: 206 }, RC = 7, RP = 3.5;
const CX = 150, CY = 130, DX = 432, DR = 14, STAND_TOP = 236, TABLE3 = 262;
const GEOM = { PX, PY, LEN, RB, RULER0, TABLE, TRAY, RC, RP, CX, CY, DX, DR, STAND_TOP, TABLE3 };
const MM = 1e-3, NC = P.NC, DEG = Math.PI / 180;

// WebGL'siz: sahna 2D kanvas yo'li bilan chiziladi, har bir son argument chekli bo'lishi kerak.
globalThis.document = { createElement: () => ({ getContext: () => null }) };
let coordinates = 0;
const check = (...args) => { for (const v of args) if (typeof v === 'number') { assert.ok(Number.isFinite(v), 'chekli koordinata'); coordinates++; } };
const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => (k in o ? o[k] : check) });
const palette = (dark) => ({ ...Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special', 'grid'].map((k) => [k, '#888'])), dark });
const stages = [{ w: 760, h: 414, colors: palette(false) }, { w: 360, h: 300, colors: palette(true) }];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≈ ${b}`);
const qText = (q) => `${q} nC`;

const scene = createCoulombLab(), lab = scene.lab, drawn = { law: 0, sup: 0, sph: 0 };
const draw = (stage, f) => { scene.draw(ctx, stage, f); drawn[f.mode]++; };

/* ---------------------------------------------- 1) Kulon qonuni */
function lawFrame(q1, q2, D, m, extra = {}) {
  const o = { L: LEN * MM, D: D * MM, m: m * 1e-3, r: RB * MM, q1: q1 * NC, q2: q2 * NC, eps: 1 };
  const a = P.equilibrium(o).a, bob = { x: PX + LEN * Math.sin(a), y: PY + LEN * Math.cos(a) }, fixed = { x: PX + D, y: PY + LEN };
  let forces = null;
  if (q1 || q2) {
    const d = P.gap(o.L, o.D, a), F = P.coulomb(o.q1, o.q2, d), mg = o.m * P.G, k = 55 / mg, dd = Math.hypot(bob.x - fixed.x, bob.y - fixed.y);
    const ux = (bob.x - fixed.x) / dd, uy = (bob.y - fixed.y) / dd, Lc = (v) => Math.max(-110, Math.min(110, v * k));
    forces = { mg: Lc(mg), T: { x: Lc(-F * ux), y: Lc(-F * uy - mg) }, F: Math.abs(F) > 1e-9 ? { x: Lc(F * ux), y: Lc(F * uy) } : null };
  }
  return { mode: 'law', geom: GEOM, q1, q2, a, bob, fixed, forces, halveT: 0, names: false, shared: false, sharedText: 'Tegdi', q1Text: 'q₁', q2Text: 'q₂', aText: 'α', note: 'law', ...extra };
}
const lawCases = [[7, 7, 40, .05], [2.5, -2.5, 50, .05], [8, -2, 35, .05], [0, 5, 40, .05], [0, 0, 40, .05], [7, 7, 40, .15], [-8, -8, 20, .02], [8, -8, 140, .3]];
scene.setMode('law');
for (const stage of stages) for (const [q1, q2, D, m] of lawCases) for (const extra of [{}, { halveT: .6, names: true, shared: true }, { halveT: 1.2, forces: null }]) draw(stage, lawFrame(q1, q2, D, m, extra));

// Tutqichlar: osma sharcha, stenddagi sharcha va stend asosi o'z joyida topiladi
{
  const f = lawFrame(7, 7, 40, .05), stage = stages[0];
  scene.draw(ctx, stage, f);
  const at = (x, y) => lab.project(scene.lawPoint(x, y));
  for (const [id, x, y] of [['bob', f.bob.x, f.bob.y], ['standBall', f.fixed.x, f.fixed.y], ['stand', f.fixed.x, TABLE - 4]]) {
    const p = at(x, y);
    assert.equal(lab.hit(p.x, p.y), id, `tutqich ${id}`);
  }
  // Stendni sudrash: ekran nuqtasidan D (mm) qaytadi (240 bo'lakli qidiruv, qadam 0,5 mm)
  for (const pose of [{ yaw: -.5, pitch: .35 }, { yaw: 1.2, pitch: 1.1 }, { yaw: -2.6, pitch: .1 }]) {
    Object.assign(lab.camera, pose);
    scene.draw(ctx, stage, f);
    for (const D of [20, 47.5, 93, 140]) {
      const p = at(PX + D, TABLE - 4);
      near(lab.nearest((d) => scene.lawPoint(PX + d, TABLE - 4), 20, 140, p.x, p.y), D, .26, `stend D, yaw ${pose.yaw}`);
    }
    for (const a of [-50 * DEG, 0, 30 * DEG]) {
      const p = at(PX + LEN * Math.sin(a), PY + LEN * Math.cos(a)), hi = Math.asin(.9);
      near(lab.nearest((t) => scene.lawPoint(PX + LEN * Math.sin(t), PY + LEN * Math.cos(t)), -60 * DEG, hi, p.x, p.y), a, (hi + 60 * DEG) / 480 + 1e-9, `og'ish burchagi, yaw ${pose.yaw}`);
    }
  }
}

/* ---------------------------------------------- 2) Superpozitsiya */
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const grains = Array.from({ length: 160 }, () => ({ x: TRAY.x0 + 4 + rnd() * (TRAY.x1 - TRAY.x0 - 8), y: TRAY.y0 + 4 + rnd() * (TRAY.y1 - TRAY.y0 - 8), n: rnd() - .5, l: .7 + rnd() * .6 }));
function supFrame(list, probe, med = 'air', show = {}) {
  const charges = list.map(([x, y, q]) => ({ x, y, q })), eps = P.MEDIA[med].eps, any = charges.some((q) => q.q);
  const si = charges.map((q) => ({ x: q.x * MM, y: q.y * MM, q: q.q * NC })), fieldAt = (x, y) => P.field(si, x * MM, y * MM, eps);
  const lines = any ? fieldLines(charges.map((q) => ({ ...q, r: RC })), TRAY, { minLines: 6, perUnit: 1.4, step: 1.6, maxSteps: 900 }) : null;
  const gr = any && show.grains ? grains.map((g) => { const f = fieldAt(g.x, g.y); return { ...g, a: Math.atan2(f.ey, f.ex) + g.n, k: rnd() }; }) : null;
  const f = fieldAt(probe[0], probe[1]);
  const E = charges.length && f.e > 0 ? { ex: f.ex, ey: f.ey, e: f.e, parts: f.parts.map((q, i) => ({ ...q, i })).filter((q) => q.e > 0) } : null;
  return { mode: 'sup', geom: GEOM, charges, sel: show.sel ?? 0, probe: { x: probe[0], y: probe[1] }, lines, grains: gr, E, showParts: show.parts ?? true, oil: med !== 'air', eps, medText: med, qText, note: 'sup' };
}
const supCases = [
  [[[150, 106, 10]], [230, 70], 'castor', { grains: true }],
  [[[120, 106, 10], [240, 106, 10]], [180, 106]],                       // o'rtada E = 0
  [[[120, 106, 10], [240, 106, -10]], [180, 60], 'air', { parts: false }],
  [[[120, 106, 16], [240, 106, 4]], [200, 106], 'water', { grains: true, sel: 1 }],
  [[[180, 46, 8], [128, 136, 8], [232, 136, 8]], [180, 106]],
  [[[130, 56, 8], [230, 56, -8], [230, 156, 8], [130, 156, -8], [60, 180, 20]], [300, 30]],
  [[[150, 106, 0]], [200, 100]],                                        // zaryadsiz elektrod
  [[], [180, 60]],                                                      // elektrodsiz
  [[[150, 106, 10]], [150, 106]],                                       // zond elektrod markazida
];
scene.setMode('sup');
assert.equal(lab.camera.pitch, .85, 'kyuveta rejimi — yuqoriroqdan ko‘rinish');
for (const stage of stages) for (const [list, probe, med, show] of supCases) draw(stage, supFrame(list, probe, med, show));

// Kyuveta tekisligi: ekran → mm teskari almashtirish istalgan kamera holatida aniq; tutqichlar topiladi
{
  const f = supFrame([[120, 106, 10], [240, 106, -10]], [180, 60]), stage = stages[0];
  for (const pose of [{ yaw: -.35, pitch: .85, zoom: 1 }, { yaw: 2.4, pitch: 1.35, zoom: 1.65 }, { yaw: -3, pitch: .08, zoom: .7 }]) {
    Object.assign(lab.camera, pose);
    scene.draw(ctx, stage, f);
    for (const [x, y] of [[TRAY.x0, TRAY.y0], [180, 106], [TRAY.x1, TRAY.y1], [40, 190]]) {
      const q = scene.trayPoint(lab.project(scene.trayAt(x, y)));
      assert.ok(q, 'kyuveta tekisligi hech qachon qirrasidan ko‘rinmaydi');
      near(q.x, x, 1e-6, 'kyuveta x'); near(q.y, y, 1e-6, 'kyuveta y');
    }
  }
  lab.reset();
  assert.deepEqual({ ...lab.camera }, { yaw: -.35, pitch: .85, zoom: 1 }, 'Home — joriy tajribaning ko‘rinishiga');
  scene.draw(ctx, stage, f);
  for (const [id, x, y] of [['probe', 180, 60], ['q0', 120, 106], ['q1', 240, 106]]) { const p = lab.project(scene.trayAt(x, y)); assert.equal(lab.hit(p.x, p.y), id, `tutqich ${id}`); }
}

/* ---------------------------------------------- 3) Zaryadlangan shar */
function sphFrame(Q, R, type, probe, extra = {}) {
  const rr = Math.hypot(probe[0] - CX, probe[1] - CY) * MM, E = P.sphereE(Q * NC, R / 100, rr, type);
  let Evec = null;
  if (Math.abs(E) > 0 && rr > 1e-4) {
    const Es = P.sphereE(Q * NC, R / 100, R / 100, type), frac = Math.max(.12, Math.min(1, Math.sqrt(Math.abs(E / Es))));
    Evec = { x: (Math.sign(E) * (probe[0] - CX) * frac) / (rr / MM), y: (Math.sign(E) * (probe[1] - CY) * frac) / (rr / MM) };
  }
  return { mode: 'sph', geom: GEOM, Q, R, type, probe: { x: probe[0], y: probe[1] }, spark: 0, sparkSeed: 1, belt: 0, lines: true, cut: true, Evec, RText: 'R', QText: 'Q', note: 'sph', ...extra };
}
scene.setMode('sph');
assert.deepEqual({ ...lab.camera }, { yaw: -.5, pitch: .3, zoom: 1 }, 'shar rejimi kamerasi');
for (const stage of stages) for (const type of ['shell', 'solid']) for (const cut of [true, false]) for (const [Q, R] of [[400, 8], [-2400, 10], [0, 3], [5000, 12]]) {
  for (const probe of [[300, 130], [175, 140], [CX, CY], [8, 90], [400, TABLE3 - 8]]) draw(stage, sphFrame(Q, R, type, probe, { cut }));
  for (const [spark, belt] of [[.45, 7.5], [.2, -3], [.01, 123.4]]) draw(stage, sphFrame(Q, R, type, [330, 100], { cut, spark, sparkSeed: 1 + Math.round(belt * 7) % 997, belt, lines: spark < .3 }));
}

// Shar tekisligi (z = 0): ekran → mm; yon tomondan qaralganda tekislik qirrasi ko'rinadi — null, NaN emas
{
  const f = sphFrame(400, 8, 'shell', [320, 130]), stage = stages[0];
  for (const pose of [{ yaw: -.5, pitch: .3, zoom: 1 }, { yaw: 2.6, pitch: 1.2, zoom: 1.4 }, { yaw: -1.2, pitch: .08, zoom: .7 }]) {
    Object.assign(lab.camera, pose);
    scene.draw(ctx, stage, f);
    for (const [x, y] of [[8, 90], [CX, CY], [400, TABLE3 - 8]]) {
      const q = scene.spherePoint(lab.project(scene.sphereAt(x, y)));
      near(q.x, x, 1e-6, 'shar tekisligi x'); near(q.y, y, 1e-6, 'shar tekisligi y');
    }
  }
  Object.assign(lab.camera, { yaw: Math.PI / 2, pitch: .35 });
  scene.draw(ctx, stage, f);
  assert.equal(scene.spherePoint({ x: 300, y: 200 }), null, 'tekislik qirrasidan ko‘rinadi');
  lab.reset();
  scene.draw(ctx, stage, f);
  const p = lab.project(scene.sphereAt(320, 130));
  assert.equal(lab.hit(p.x, p.y), 'sprobe', 'zond tutqichi');
}

assert.ok(coordinates > 200000, `koordinatalar soni: ${coordinates}`);
console.log(`Kulon 3D: ${drawn.law} osma sharcha, ${drawn.sup} kyuveta va ${drawn.sph} shar holati; ekran ↔ tekislik almashtirishlari, tutqichlar va kamera — ${coordinates} ta chekli koordinata.`);
