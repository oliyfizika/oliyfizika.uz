// Yadro fizikasi 3D sahnasi (nuclear-lab-3d.js): yemirilish, yadro yasash, reaksiya va zanjir reaksiyaning barcha
// holatlarida koordinatalar chekli; tutqichlar sahnada; ekran ↔ sahna teskari almashtirishlari to'g'ri.
// node tools/simulations/tests/t_nuclear_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/nuclear-physics.js';
import { createNuclearLab, clusterPoints } from '../../../assets/js/simulations/nuclear-lab-3d.js';

// nuclear-lab-3d.js dagi geometriya
const NUCLEUS = [-0.15, 1.0, 0.15], CORE_CELL = 3.4 / 24, CORE_BASE = 0.3;

// WebGL'siz: sahna 2D kanvas yo'li bilan chiziladi, har bir son argument chekli bo'lishi kerak.
globalThis.document = { createElement: () => ({ getContext: () => null }) };
let coordinates = 0;
const check = (...args) => { for (const v of args) if (typeof v === 'number') { assert.ok(Number.isFinite(v), 'chekli koordinata'); coordinates++; } };
const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => (k in o ? o[k] : check) });
const palette = (dark) => ({ ...Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special', 'grid'].map((k) => [k, '#888'])), dark });
const stages = [{ w: 760, h: 414, colors: palette(false) }, { w: 360, h: 300, colors: palette(true) }];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≈ ${b}`);
const POSES = [{ yaw: -0.45, pitch: 0.42 }, { yaw: 1.2, pitch: 1.1 }, { yaw: -2.6, pitch: 0.15 }, { yaw: 3.1, pitch: 0.6 }];

const scene = createNuclearLab(), lab = scene.lab, drawn = { decay: 0, build: 0, react: 0, chain: 0 };
/** Ekranni to'r bilan aylanib chiqib, sahnadagi barcha tutqichlarni yig'adi. */
function handles(stage) {
  const ids = new Set();
  for (let x = 2; x < stage.w; x += 3) for (let y = 2; y < stage.h; y += 3) { const id = lab.hit(x, y); if (id) ids.add(id); }
  return ids;
}

/* ---------------------------------------------- 0) Nuklonlar to'pi */
for (let A = 1; A <= 70; A++) for (const Z of [0, 1, Math.floor(A / 2), A]) {
  const pts = clusterPoints(Z, A, [0, 0, 0], 0.1);
  assert.equal(pts.length, A);
  assert.equal(pts.filter((q) => q.proton).length, Z, `protonlar soni Z=${Z}, A=${A}`);
  const R = Math.max(...pts.map((q) => Math.hypot(...q.p)));
  assert.ok(R <= 0.1 * 1.2 * Math.cbrt(A - 1) + 1e-12, 'to\'p radiusi ∛A ga proporsional');
}
{ // A ortganda eski nuklonlar joyida qoladi; zichlik — to'p "spiral" emas (ustma-ust tushgan juftlar kam)
  const a = clusterPoints(26, 56, [0, 0, 0], 0.1), b = clusterPoints(26, 57, [0, 0, 0], 0.1);
  a.forEach((q, i) => assert.deepEqual(q.p, b[i].p));
  let close = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < i; j++) if (Math.hypot(...a[i].p.map((v, k) => v - a[j].p[k])) < 0.06) close++;
  assert.ok(close <= 3, `juda yaqin juftlar: ${close}`);
  // og'irlik markazi markazga yaqin (bir tomonga og'ib ketmagan)
  const g = [0, 1, 2].map((k) => a.reduce((s, q) => s + q.p[k], 0) / a.length);
  assert.ok(Math.hypot(...g) < 0.06, `og'irlik markazi ${g}`);
}

/* ---------------------------------------------- 1) Radioaktiv yemirilish */
scene.setMode('decay');
for (const stage of stages) for (const [key, I] of Object.entries(P.ISOTOPES)) for (const N0 of [100, 400, 1600]) {
  const s = P.createSample(N0, 3), steps = [0, 1, 3];
  for (const k of steps) {
    if (k) s.step(k * I.half, I.half);
    const dead = [...s.decayedAt.keys()].filter((i) => s.decayedAt[i] !== Infinity);
    const flashes = dead.slice(0, 12).map((i, j) => ({ i, age: (j % 8) / 10, a: j }));
    for (const sel of [null, dead[0] ?? 0]) {
      scene.draw(ctx, stage, { mode: 'decay', decay: { N0, decayedAt: s.decayedAt, N: s.N, iso: I, flashes, sel, t: s.t, theory: P.remaining(N0, s.t, I.half) }, bind: {}, chain: {} });
      drawn.decay++;
    }
  }
  assert.ok(key);
}
{ // Yadroni bosish: tanlangan yadro — bosilgan nuqtadagi yoki undan oldingi (kameraga yaqinroq) yadro
  const I = P.ISOTOPES.c14, stage = stages[0];
  for (const N0 of [100, 400]) {
    const s = P.createSample(N0, 5); s.step(I.half, I.half);
    const f = { mode: 'decay', decay: { N0, decayedAt: s.decayedAt, N: s.N, iso: I, flashes: [], sel: null, t: s.t, theory: 0 }, bind: {}, chain: {} };
    for (const pose of POSES) {
      Object.assign(lab.camera, pose, { zoom: 1 });
      scene.draw(ctx, stage, f);
      let exact = 0;
      for (let i = 0; i < N0; i += 7) {
        const p = lab.project(scene.nucleusPoint(i)), j = scene.pickNucleus(p.x, p.y);
        assert.notEqual(j, null, `yadro ${i} topildi`);
        if (j === i) exact++;
        else assert.ok(lab.project(scene.nucleusPoint(j)).d < p.d + 1e-9, `boshqa yadro — faqat oldinroqdagisi (${i} → ${j})`);
      }
      assert.ok(exact > 0, 'kamida bir nechta yadro aynan topiladi');
      assert.equal(scene.pickNucleus(3, stage.h - 3), null, 'bo\'sh joy — tanlov yo\'q');
    }
  }
}

/* ---------------------------------------------- 2) Bog'lanish energiyasi: yadro yasash va reaksiyalar */
scene.setMode('bind');
lab.reset();
for (const stage of stages) for (let Z = 1; Z <= 30; Z += 1) for (const N of [0, Math.max(0, Z - 2), Z, Z + 4, 40]) {
  for (const ghost of [null, { type: 'p', at: [-1.2, 0.8, 0] }, { type: 'n', at: null }]) {
    scene.draw(ctx, stage, { mode: 'bind', bind: { view: 'build', Z, N, rx: 'dt', ghost }, decay: {}, chain: {} });
    drawn.build++;
  }
}
{
  const stage = stages[0];
  for (const pose of POSES) {
    Object.assign(lab.camera, pose, { zoom: 1 });
    scene.draw(ctx, stage, { mode: 'bind', bind: { view: 'build', Z: 6, N: 6, rx: 'dt', ghost: null }, decay: {}, chain: {} });
    const ids = handles(stage);
    if (pose === POSES[0]) for (const id of ['pile:p', 'pile:n', 'nucleus']) assert.ok(ids.has(id), `tutqich ${id}`);
    for (const [id, at] of [['pile:p', [-2.05, 0.15, -0.45]], ['pile:n', [-1.3, 0.15, -0.45]]]) { // ekranda bo'lsa — bosiladi (yonma-yon tutqich ustma-ust tushishi mumkin)
      const q = lab.project(at);
      if (q.x > 0 && q.x < stage.w && q.y > 0 && q.y < stage.h) assert.ok(lab.hit(q.x, q.y), `tutqich ${id} (yaw ${pose.yaw})`);
    }
    const c = lab.project(NUCLEUS);
    assert.equal(lab.hit(c.x, c.y), 'nucleus');
    assert.ok(['p', 'n'].includes(scene.nucleonAt(c.x, c.y)), 'yadrodan nuklon olinadi');
    // sudralayotgan nuklon kursor ostida, yadro markazidan o'tuvchi tekislikda
    const g = scene.ghostAt(c);
    assert.ok(g && Math.hypot(...g.map((v, i) => v - NUCLEUS[i])) < 1e-6, 'markaz → markaz');
    assert.ok(scene.insideNucleus(g), 'markazda — yadro ichida');
    for (const [dx, dy] of [[60, 0], [0, -45], [-80, 30]]) {
      const q = scene.ghostAt({ x: c.x + dx, y: c.y + dy }), pq = lab.project(q);
      near(pq.x, c.x + dx, 1e-6, 'ghost x'); near(pq.y, c.y + dy, 1e-6, 'ghost y');
    }
    assert.ok(!scene.insideNucleus(scene.ghostAt({ x: c.x + 260, y: c.y })), 'uzoqda — yadrodan tashqari');
    assert.ok(!scene.insideNucleus(null));
  }
  // nuklonsiz (A = 0) yadroda "nucleus" tutqichi yo'q
  scene.draw(ctx, stage, { mode: 'bind', bind: { view: 'build', Z: 0, N: 0, rx: 'dt', ghost: null }, decay: {}, chain: {} });
  assert.ok(!handles(stage).has('nucleus'));
}
scene.setMode('react');
for (const stage of stages) for (const rx of Object.keys(P.REACTIONS)) for (const pose of POSES) {
  Object.assign(lab.camera, pose, { zoom: 1 });
  scene.draw(ctx, stage, { mode: 'bind', bind: { view: 'react', Z: 6, N: 6, rx, ghost: null }, decay: {}, chain: {} });
  drawn.react++;
}

/* ---------------------------------------------- 3) Zanjir reaksiya */
scene.setMode('chain');
function core(size, enrich, depth, seed = 3) {
  const cols = size, rows = Math.max(4, Math.round(cols * 0.58)), rods = [];
  for (let x = 4; x < cols; x += 4) rods.push({ x, depth });
  return P.createCore({ w: cols, h: rows, cols, rows, enrich, rods, seed });
}
for (const stage of stages) for (const size of [6, 10, 16, 24]) for (const enrich of [0.2, 0.9]) for (const depth of [0, 0.5, 1]) {
  const co = core(size, enrich, depth), flashes = [];
  for (let k = 0; k < 4; k++) co.inject(0.05, co.h / 2 + k * 0.2, k * 0.2);
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 20; i++) { co.step(1 / 60); for (const e of co.events) flashes.push({ ...e, age: (flashes.length % 6) / 10 }); }
    scene.draw(ctx, stage, { mode: 'chain', chain: { core: co, flashes: flashes.slice(-60), depth }, decay: {}, bind: {} });
    drawn.chain++;
  }
}
{
  const stage = stages[0];
  for (const pose of POSES) {
    Object.assign(lab.camera, pose, { zoom: 1 });
    for (const depth of [0, 0.35, 1]) {
      const co = core(24, 0.8, depth);
      scene.draw(ctx, stage, { mode: 'chain', chain: { core: co, flashes: [], depth }, decay: {}, bind: {} });
      const ids = handles(stage);
      assert.ok(ids.has('gun'), `neytron manbai (yaw ${pose.yaw})`);
      // sterjen tutqichi: tutqich o'rni → chuqurlik (240 bo'lakli qidiruv)
      const p = lab.project(scene.rodPoint(depth));
      assert.equal(lab.hit(p.x, p.y), 'rod', `sterjen tutqichi, d = ${depth}`);
      for (const d of [0, 0.25, 0.6, 1]) { const q = lab.project(scene.rodPoint(d)); near(lab.nearest(scene.rodPoint, 0, 1, q.x, q.y), d, 1 / 240 + 1e-9, `sterjen d, yaw ${pose.yaw}`); }
      // zonani bosish: ekran nuqtasi → zona katakchalaridagi (x, y)
      const W = co.w * CORE_CELL, x0 = -W / 2, top = CORE_BASE + co.h * CORE_CELL;
      for (const [x, y] of [[0.5, 0.5], [3.2, 7.7], [co.w - 0.4, co.h - 0.3], [12, 2]]) {
        const q = lab.project([x0 + x * CORE_CELL, top - y * CORE_CELL, 0]), r = scene.corePoint(q);
        if (pose.pitch > 1 && Math.abs(Math.cos(pose.yaw)) < 0.2) continue; // zona qirrasidan ko'rinsa — o'tkazib yuboriladi
        assert.ok(r, `zona nuqtasi (${x}, ${y}), yaw ${pose.yaw}`);
        near(r.x, x, 1e-6, 'zona x'); near(r.y, y, 1e-6, 'zona y');
      }
      assert.equal(scene.corePoint({ x: 4, y: 4 }), null, 'zonadan tashqari');
    }
  }
  // sterjensiz kichik zona: sterjen tutqichi yo'q, rodPoint xavfsiz
  const co = core(4, 0.9, 0);
  scene.draw(ctx, stage, { mode: 'chain', chain: { core: co, flashes: [], depth: 0 }, decay: {}, bind: {} });
  assert.ok(!handles(stage).has('rod'));
  assert.deepEqual(scene.rodPoint(0.5), [0, 0, 0]);
}

/* ---------------------------------------------- 4) Kamera: har rejimning o'z boshlang'ich ko'rinishi */
for (const m of ['decay', 'bind', 'react', 'chain']) {
  scene.setMode(m); Object.assign(lab.camera, { yaw: 2, pitch: 1.2, zoom: 1.4 });
  scene.setMode(m); assert.equal(lab.camera.yaw, 2, 'shu rejimning o\'zi — kamera o\'zgarmaydi');
  lab.reset(); assert.ok(lab.camera.yaw < 0 && lab.camera.zoom === 1, `${m}: boshlang'ich ko'rinish`);
}
scene.setMode('decay'); Object.assign(lab.camera, { yaw: 2 }); scene.setMode('chain');
assert.ok(lab.camera.yaw < 0, 'rejim almashganda kamera qaytadi');

console.log(`nuclear 3D: ${drawn.decay} yemirilish, ${drawn.build} yadro yasash, ${drawn.react} reaksiya, ${drawn.chain} zanjir kadri; ${coordinates} koordinata chekli — OK`);
