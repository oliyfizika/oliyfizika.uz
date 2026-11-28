// Havo namligi 3D sahnasi (humidity-lab-3d.js): to'rt rejimning barcha holatlarida koordinatalar chekli, tutqichlar sahnada,
// termometr ustuni va Quyosh/Oy yoyi uchun ekran → qiymat teskari almashtirishi to'g'ri.
// node tools/simulations/tests/t_humidity_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/humidity-physics.js';
import { createHumidityLab, airTPoint, sunPoint } from '../../../assets/js/simulations/humidity-lab-3d.js';

globalThis.document = { createElement: () => ({ getContext: () => null }) };
let coords = 0, texts = [];
const check = (...a) => { for (const v of a) if (typeof v === 'number') { assert.ok(Number.isFinite(v), 'chekli koordinata'); coords++; } };
const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }), createRadialGradient: (...a) => { check(...a); return { addColorStop() {} }; }, createLinearGradient: (...a) => { check(...a); return { addColorStop() {} }; }, fillText: (t, ...a) => { texts.push(String(t)); check(...a); } }, { get: (o, k) => (k in o ? o[k] : check) });
const palette = (dark) => ({ ...Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special', 'grid'].map((k) => [k, '#888'])), dark });
const WIDE = { w: 760, h: 340, colors: palette(false) }, NARROW = { w: 356, h: 310, colors: palette(true) };
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const mk = () => ({ x: rnd(), y: rnd() }), AIRM = Array.from({ length: 70 }, mk), VAPM = Array.from({ length: 150 }, mk), DROPS = Array.from({ length: 90 }, () => ({ side: Math.floor(rnd() * 3), u: rnd(), r: 1.2 + rnd() * 2.2 }));
const scene = createHumidityLab(), lab = scene.lab;
let overlays = 0;
const draw = (st, f) => { texts = []; scene.draw(ctx, st, { ...f, overlay: () => overlays++ }); return texts; };
const ids = (st) => { const s = new Set(); for (let x = 2; x < st.w; x += 4) for (let y = 2; y < st.h; y += 4) { const id = lab.hit(x, y); if (id) s.add(id); } return s; };
let n = 0;
for (const st of [WIDE, NARROW]) {
  for (const t of [-10, 5, 22, 40]) for (const W of [0.5, 9.7, 30]) {
    const s = P.airState(t, W);
    draw(st, { mode: 'air', air: { t, s, airm: AIRM, vapm: VAPM, nV: Math.min(150, Math.round(s.rho * 4)), drops: DROPS, nD: Math.min(90, Math.round(s.cond * 12)) } }); n++;
  }
  assert.ok(ids(st).has('therm'), 'termometr tutqichi');
  for (const sel of ['dry', 'wet']) for (const [tdry, twet] of [[21.4, 15], [33, 20], [12.6, 11.5]]) { draw(st, { mode: 'psy', psy: { tdry, twet, sel, can: 20, dew: 0, pump: false, time: 0 } }); n++; }
  const h = ids(st); assert.ok(h.has('dry') && h.has('wet'), 'psixrometr termometrlari bosiladi');
  for (const can of [-8, 10, 21.4]) for (const dew of [0, 0.5, 1]) for (const pump of [false, true]) { draw(st, { mode: 'cond', psy: { tdry: 21.4, twet: 15, sel: 'dry', can, dew, pump, time: 3.3 } }); n++; }
  assert.ok(ids(st).has('bulb'), 'nok bosiladi');
  for (const tau of [0, 4, 7.5, 13, 18.9, 22]) for (const [tMax, amp, phi] of [[26, 14, 0.45], [16, 10, 0.72], [9, 13, 0.5], [38, 15, 0.18]]) {
    const W = phi * P.rhoSat(tMax), s = P.phenomenon(P.dayTemp(tau, tMax - amp, tMax), W, false), sunUp = tau > 6 && tau < 19;
    draw(st, { mode: 'atm', atm: { s, tau, sunUp, day: Math.max(0, Math.sin(((tau - 6) / 13) * Math.PI)), f: sunUp ? (tau - 6) / 13 : ((tau - 19 + 24) % 24) / 11, conv: tau > 9 && tau < 18, base: P.cloudBase(s.t, s.td) } }); n++;
  }
  assert.ok(ids(st).has('sun'), 'Quyosh/Oy suriladi');
}
assert.equal(overlays, n, 'har kadrda tekis qatlam chiziladi');
// Teskari almashtirishlar: termometr ustuni va osmon yoyi
const s0 = P.airState(22, 9.7);
for (const cam of [{ yaw: -0.4, pitch: 0.26 }, { yaw: 0.8, pitch: 0.6 }, { yaw: -1.2, pitch: 1.0 }]) {
  draw(WIDE, { mode: 'air', air: { t: 22, s: s0, airm: AIRM, vapm: VAPM, nV: 40, drops: DROPS, nD: 0 } }); Object.assign(lab.camera, cam);
  for (const t of [-5, 12.5, 33]) { const p = lab.project(airTPoint(t)); assert.ok(Math.abs(lab.nearest(airTPoint, -10, 40, p.x, p.y) - t) < 0.3, `termometr: ${t} °C`); }
  lab.reset();
}
draw(WIDE, { mode: 'atm', atm: { s: P.phenomenon(20, 8, true), tau: 12, sunUp: true, day: 1, f: 0.5, conv: false, base: 2000 } });
for (const f of [0.1, 0.5, 0.85]) { const p = lab.project(sunPoint(f)); assert.ok(Math.abs(lab.nearest(sunPoint, 0, 1, p.x, p.y) - f) < 0.01, `osmon yoyi: f = ${f}`); }
console.log(`✓ humidity 3D: ${n} holat chizildi, ${coords} koordinata chekli; tutqichlar va teskari almashtirishlar to'g'ri`);
