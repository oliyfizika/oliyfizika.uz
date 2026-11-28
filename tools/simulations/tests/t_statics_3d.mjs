// Statika 3D sahnasi (statics-lab-3d.js): plastinka uchburchaklarga to'g'ri ajratiladi (yuzi fizika bilan bir xil),
// 8 ta tajribaning barcha holatlarida koordinatalar chekli, sudrash uchun hits to'ldiriladi, ekran ↔ dunyo almashtirishi teskari.
// node tools/simulations/tests/t_statics_3d.mjs
import assert from 'node:assert/strict';
import * as P from '../../../assets/js/simulations/statics-physics.js';
import { createStaticsLab, triangulate, bridge } from '../../../assets/js/simulations/statics-lab-3d.js';

globalThis.document = { createElement: () => ({ getContext: () => null }) };
let coords = 0, texts = [];
const check = (...a) => { for (const v of a) if (typeof v === 'number') { assert.ok(Number.isFinite(v), 'chekli koordinata'); coords++; } };
const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }), createRadialGradient: (...a) => { check(...a); return { addColorStop() {} }; }, createLinearGradient: (...a) => { check(...a); return { addColorStop() {} }; }, fillText: (t, ...a) => { texts.push(String(t)); check(...a); } }, { get: (o, k) => (k in o ? o[k] : check) });
const palette = (dark) => ({ ...Object.fromEntries(['bg', 'bg2', 'sunken', 'border', 'borderStrong', 'text', 'text2', 'text3', 'primary', 'warning', 'danger', 'success', 'special', 'grid'].map((k) => [k, '#888'])), dark });
const WIDE = { w: 760, h: 414, colors: palette(false) }, NARROW = { w: 356, h: 320, colors: palette(true) };
const area = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);

// 1) Uchburchaklarga ajratish: yuzlar yig'indisi = plastinka yuzi (teshikli disk — ko'prik orqali)
for (const [id, sh] of Object.entries(P.SHAPES)) {
  let poly = sh.parts.filter((p) => p[1] > 0)[0][0];
  for (const h of sh.parts.filter((p) => p[1] < 0)) poly = bridge(poly, h[0]);
  const tris = triangulate(poly), A = tris.reduce((s, [i, j, k]) => s + Math.abs(area([poly[i], poly[j], poly[k]])), 0);
  assert.ok(Math.abs(A - P.plateProps(sh).A) < 0.01 * P.plateProps(sh).A, `${id}: uchburchaklar yuzi ${A.toFixed(1)} ≈ ${P.plateProps(sh).A.toFixed(1)} cm²`);
}

// 2) statics.js dagi dunyo koordinatalari (o'sha formulalar)
const PIN = [250, 44], PK = 6.4, TIP_E = [300, 238], TK = 500, BC = [260, 226], BK = 10, BR = 1.15, PIV = [260, 112], LK = 700, FLOOR = 282, MK = 300;
const TSZ = { tall: [0.1, 0.3], mid: [0.16, 0.24], cube: [0.2, 0.2] };
function frame(kind, o = {}) {
  const pl = { shape: o.shape || 'L', hole: o.hole || 0, th: o.th ?? 0.4, lines: [] }, tp = { size: o.size || 'tall', f: o.f ?? 0.5, a: o.a ?? 0.3, held: !!o.held };
  const bl = { kind: o.surf || 'bowl', x: o.x ?? 4 }, lv = { A: { n: 2, h: -3 }, B: { n: o.Bn ?? 3, h: 2 }, dyn: !!o.dyn, dh: 5, phi: o.phi ?? 0, po: o.po ?? 0, b: o.b ?? 0.05 };
  const mc = { m: o.m ?? 2, n: o.n ?? 4, R: 0.3, ideal: false, s: o.s ?? 0.1, psi: 0.7 };
  const sh = P.SHAPES[pl.shape], pp = P.plateProps(sh), hole = sh.holes[pl.hole];
  const plW = ([qx, qy]) => { const dx = qx - hole[0], dy = qy - hole[1], co = Math.cos(pl.th), si = Math.sin(pl.th); return [PIN[0] + PK * (co * dx - si * dy), PIN[1] + PK * (si * dx + co * dy)]; };
  const tBox = () => { const [b, h] = TSZ[tp.size]; return { m: 2, b, h, f: tp.f }; };
  const tpW = (u, v) => { const ca = Math.cos(tp.a), sa = Math.sin(tp.a); return [TIP_E[0] + TK * (u * ca + v * sa), TIP_E[1] - TK * (-u * sa + v * ca)]; };
  const lvW = (u, v = 0) => { const cb = Math.cos(lv.b), sb = Math.sin(lv.b); return [PIV[0] + LK * u * cb - v * sb, PIV[1] + LK * u * sb + v * cb]; };
  const loads = [lv.A, lv.B].filter((g) => g.n && g.h).map((g) => ({ x: g.h * P.LEVER.step, m: g.n * P.LEVER.mW }));
  const mRes = () => P.mechForce(kind, mc.m, { n: mc.n, R: mc.R }), loadH = () => 24 + 10 * Math.cbrt(mc.m);
  return {
    hits: {}, kind: () => kind, pl, tp, bl, lv, mc, PIN, TIP_E, TK, BC, BK, BR, PIV, LK, MK, FLOOR, LEVER: P.LEVER, zAxle: -0.44,
    shape: () => sh, shapeName: pl.shape, plW, inside: (x, y) => P.inside(sh, x, y), hole: pl.hole, holeLabel: (i) => plW(sh.holes[i]),
    pencil: o.lines ? [[plW([3, 0]), plW([3, 20])]] : [], dashes: o.lines ? [[plW([3, 0]), plW([13, 13])]] : [], est: o.lines ? plW([12, 12]) : null, cm: o.cm ? plW([pp.cx, pp.cy]) : null,
    tBox, tCrit: () => P.tipCrit(tBox().b, tBox().h, tp.f), tpW, surfW: (x) => [BC[0] + BK * x, BC[1] - BK * P.surfY(bl.kind, x)], slope: () => P.surfSlope(bl.kind, bl.x), lvW,
    lvMom: () => P.leverMoments(loads, lv.po), lvF: () => (lv.dyn ? P.dynForce(P.leverMoments(loads, lv.po).net, lv.dh * P.LEVER.step, lv.po, lv.phi * Math.PI / 180) : 0), dragKey: null,
    mRes, mH: () => mc.s / mRes().k, loadH,
  };
}
const scene = createStaticsLab(), lab = scene.lab;
const draw = (st, f) => { texts = []; scene.draw(ctx, st, f); return f.hits; };
let n = 0;
for (const st of [WIDE, NARROW]) {
  for (const shape of Object.keys(P.SHAPES)) for (const hole of [0, 1, 2]) for (const th of [-2.5, 0, 0.6]) { const h = draw(st, frame('plate', { shape, hole, th, lines: true, cm: true })); assert.ok(h.hole0 && h.hole1 && h.hole2, 'teshiklar hits'); n++; }
  for (const size of Object.keys(TSZ)) for (const f of [0.25, 0.5, 0.8]) for (const a of [0, 0.2, 0.7, Math.PI / 2]) { draw(st, frame('tip', { size, f, a, held: true })); n++; }
  for (const surf of ['bowl', 'dome', 'flat']) for (const x of [-14, 0, 6]) { const h = draw(st, frame('ball', { surf, x })); assert.ok(h.ball, 'sharcha hits'); n++; }
  for (const dyn of [false, true]) for (const phi of [0, 50]) for (const po of [0, 0.1]) { const h = draw(st, frame('lever', { dyn, phi, po, Bn: dyn ? 0 : 3 })); assert.ok(h.A && (!dyn || h.ring), 'richag hits'); n++; }
  for (const k of ['fixed', 'movable', 'tackle', 'axle']) for (const m of [0.1, 2, 10]) for (const s of [0, 0.2]) { const h = draw(st, frame(k, { m, s, n: k === 'tackle' ? 6 : 4 })); assert.ok(h.hand, `${k}: qo'l hits`); n++; }
}
{ // tor ekranda ikkinchi darajali yozuvlar yo'q
  const wide = (texts = [], scene.draw(ctx, WIDE, frame('plate', { lines: true, cm: true })), texts);
  assert.ok(wide.includes('shtativ') && wide.includes('massa markazi C'), 'keng: yozuvlar bor');
  texts = []; scene.draw(ctx, NARROW, frame('plate', { lines: true, cm: true }));
  assert.ok(!texts.includes('shtativ') && texts.includes('A'), 'tor: ikkinchi darajali yozuv yo\'q, teshik harflari bor');
}
// 3) Ekran ↔ dunyo: har kamerada to'g'ri teskari almashtirish
for (const [kind, pts] of [['plate', [[250, 120], [180, 200]]], ['lever', [[200, 112], [330, 150]]], ['axle', [[250, 96], [300, 60]]]]) {
  for (const cam of [{ yaw: -0.3, pitch: 0.2 }, { yaw: 0.6, pitch: 0.5 }, { yaw: -1.0, pitch: 0.9 }]) {
    draw(WIDE, frame(kind)); Object.assign(lab.camera, cam); draw(WIDE, frame(kind));
    for (const [x, y] of pts) { const s = scene.toScreen(x, y), w = scene.toWorld(s.x, s.y); assert.ok(w && Math.hypot(w.x - x, w.y - y) < 0.05, `${kind}: (${x}; ${y}) → ekran → dunyo`); }
  }
  lab.reset();
}
console.log(`✓ statics 3D: ${n} holat chizildi, ${coords} koordinata chekli; plastinka uchburchaklari va ekran ↔ dunyo almashtirishi to'g'ri`);
