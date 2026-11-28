// Atmosfera bosimi 3D sahnasi (atmosphere-lab-3d.js): Torichelli, Magdeburg va balandlik rejimlarining barcha holatlarida
// koordinatalar chekli, tutqichlar sahnada; nay qiyaligi, nasos dastagi va havo shari uchun ekran → qiymat almashtirishi to'g'ri.
// node tools/simulations/tests/t_atmosphere_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/atmosphere-physics.js';
import { createAtmosphereLab, tubeTip, pumpPoint, balloonPoint, TORR } from '../../../assets/js/simulations/atmosphere-lab-3d.js';

globalThis.document = { createElement: () => ({ getContext: () => null }) };
let coords = 0, texts = [];
const check = (...a) => { for (const v of a) if (typeof v === 'number') { assert.ok(Number.isFinite(v), 'chekli koordinata'); coords++; } };
const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }), createRadialGradient: (...a) => { check(...a); return { addColorStop() {} }; }, createLinearGradient: (...a) => { check(...a); return { addColorStop() {} }; }, fillText: (t, ...a) => { texts.push(String(t)); check(...a); } }, { get: (o, k) => (k in o ? o[k] : check) });
const palette = (dark) => ({ ...Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special', 'grid'].map((k) => [k, '#888'])), dark });
const WIDE = { w: 760, h: 350, colors: palette(false) }, NARROW = { w: 356, h: 320, colors: palette(true) };
const scene = createAtmosphereLab(), lab = scene.lab;
const draw = (st, f) => { texts = []; scene.draw(ctx, st, { t: 1.7, ...f }); return texts; };
const ids = (st) => { const s = new Set(); for (let x = 2; x < st.w; x += 4) for (let y = 2; y < st.h; y += 4) { const id = lab.hit(x, y); if (id) s.add(id); } return s; };
let n = 0;
for (const st of [WIDE, NARROW]) {
  for (const liq of ['hg', 'water']) for (const tilt of [0, 30, 55, 70]) for (const alt of [0, 3000]) for (const hole of [false, true]) {
    const rho = P.LIQUIDS[liq].rho, Lt = liq === 'hg' ? 1 : 12, p = P.isa(alt).p, t = P.tube(p, rho, Lt, (tilt * Math.PI) / 180);
    draw(st, { mode: 'torr', torr: { Lt, water: liq === 'water', tilt, col: hole ? 0.2 : t.len, hv: t.hv, full: t.full, hole, mmHg: p / P.MMHG } }); n++;
  }
  assert.ok(ids(st).has('tip'), 'nay uchi suriladi');
  for (const big of [true, false]) for (const team of [2, 8, 12]) for (const [sep, pull, valve, tree] of [[0, 0, false, false], [0, 1, true, false], [0.5, 0, false, true], [1, 0, false, false]]) {
    draw(st, { mode: 'mag', mag: { big, sep, pull, p: 30000, valve, tree, team, n: 12, handle: 0.4 } }); n++;
  }
  assert.ok(ids(st).has('handle'), 'nasos dastagi suriladi');
  for (const h of [0, 455, 3309, 8849, 12000]) { draw(st, { mode: 'alt', alt: { h } }); n++; }
  assert.ok(ids(st).has('balloon'), 'havo shari suriladi');
}
// Teskari almashtirishlar
for (const cam of [{ yaw: -0.3, pitch: 0.16 }, { yaw: 0.7, pitch: 0.5 }]) {
  draw(WIDE, { mode: 'torr', torr: { Lt: 1, water: false, tilt: 0, col: 0.76, hv: 0.76, full: false, hole: false, mmHg: 760 } }); Object.assign(lab.camera, cam);
  for (const tilt of [0, 25, 60]) { const s = lab.project(tubeTip(tilt)), q = lab.planePoint(s.x, s.y, 0); assert.ok(Math.abs(Math.atan2(q[0], q[1] - TORR.surf) * 180 / Math.PI - tilt) < 0.5, `nay qiyaligi ${tilt}°`); }
  lab.reset();
}
draw(WIDE, { mode: 'mag', mag: { big: true, sep: 0, pull: 0, p: 101325, valve: false, tree: false, team: 8, n: 0, handle: 1 } });
for (const f of [0.1, 0.5, 0.9]) { const s = lab.project(pumpPoint(f)); assert.ok(Math.abs(lab.nearest(pumpPoint, 0, 1, s.x, s.y) - f) < 0.01, `nasos dastagi ${f}`); }
draw(WIDE, { mode: 'alt', alt: { h: 455 } });
for (const h of [455, 5000, 10500]) { const s = lab.project(balloonPoint(h)); assert.ok(Math.abs(lab.nearest(balloonPoint, 0, 12000, s.x, s.y) - h) < 60, `havo shari ${h} m`); }
console.log(`✓ atmosphere 3D: ${n} holat chizildi, ${coords} koordinata chekli; tutqichlar va teskari almashtirishlar to'g'ri`);
