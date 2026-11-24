// Gazlarda elektr toki — 360° 3D laboratoriya sahnasi (simulations/discharge.html).
// Holat va fizika discharge.js / discharge-physics.js da o'zgarmaydi; bu yerda ionlash kamerasi, razryad trubkasi,
// elektrofor mashinasi, ko'mir yoyi, liniya maketi va tutqichlar. Old tomon −z, stol usti y = 0.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, path, ring } from './apparatus-3d.js?v=20261124-n3';
import { ball, glow, wire, meter, supply, display, bolt, camRing } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt } from './sim-kit.js';

const TAU = Math.PI * 2;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`;
const SEED = (n) => { let a = n; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };
const COL = (c) => ({
  red: c.dark ? '#f87171' : '#b91c1c', black: c.dark ? '#cbd5e1' : '#1f2937', blue: c.dark ? '#60a5fa' : '#1d4ed8',
  metal: c.dark ? '#cbd5e1' : '#94a3b8', ebonite: c.dark ? '#1e293b' : '#292524', brass: '#d4a017', wood: c.dark ? '#7c5a3a' : '#c08a55',
  glass: alpha(c.dark ? '#cbd5e1' : '#64748b', 0.16), hose: c.dark ? '#334155' : '#1f2937',
});

/** Har tajribaning boshlang'ich kamerasi; hud — o'ng yuqorida 2D qo'shimcha bo'lsa sahna chapga suriladi. */
const VIEW = {
  ion: { begin: { target: [0.1, 0.85, 0], focal: 2.3 }, camera: { yaw: -0.2, pitch: 0.24, zoom: 1 } },
  tube: { begin: { target: [0.1, 0.6, -0.15], focal: 2.0 }, camera: { yaw: -0.35, pitch: 0.32, zoom: 1 } },
  spark: { begin: { target: [-0.1, 1.05, 0], focal: 1.9 }, camera: { yaw: -0.35, pitch: 0.18, zoom: 1 } },
  arc: { begin: { target: [0.1, 0.55, -0.05], focal: 2.35 }, camera: { yaw: -0.35, pitch: 0.32, zoom: 1 } },
  corona: { begin: { target: [0, 1.15, 0], focal: 1.9 }, camera: { yaw: -0.3, pitch: 0.12, zoom: 1 }, hud: 0.3 },
};

/** Ionlash kamerasi: plastinkalar markazi PX, balandligi Y0…Y1, yarim chuqurligi Z, K — 1 cm oraliq, T — qalinlik. */
export const ION = { PX: 0.25, Y0: 0.5, Y1: 1.5, Z: 0.4, K: 0.32, T: 0.04 };
/** discharge.js dagi ion koordinatalari (plastinkalar 300 ± 20d, y 70…180, z −0,5…0,5) → sahna nuqtasi. */
export const ionPoint = (q) => [ION.PX + (q.x - 300) * (ION.K / 40), ION.Y1 - ((q.y - 70) / 110) * (ION.Y1 - ION.Y0), (q.z ?? 0) * 2 * ION.Z * 0.85];
/** Razryad trubkasi: katod X0, anod X1 (40 cm), o'qi (Y, Z), shisha radiusi R. */
export const TUBE = { X0: -1.45, X1: 1.75, Y: 0.85, Z: 0.1, R: 0.2 };
/** Elektrofor mashinasi: disklar markazi (CX, CY), radiusi R, razryadlovchi sharlar balandligi BY, radiusi BR, K — 1 cm oraliq. */
export const SPARK = { CX: -0.55, CY: 1.05, R: 0.72, BY: 2.0, BR: 0.075, K: 0.17 };
/** O'ng shar markazi: d (cm) oraliq uchun (lab.nearest uchun). */
export const ballPoint = (d) => [SPARK.CX + (d * SPARK.K) / 2 + SPARK.BR, SPARK.BY, 0.01];
/** Ko'mir yoyi: oraliq markazi XM, o'q (Y, Z), K — 1 mm oraliq, ROD — ko'mir uzunligi. */
export const ARC = { XM: 0.75, Y: 0.62, Z: -0.05, K: 0.05, ROD: 0.75 };
/** O'ng ko'mir tutqichi: d (mm) oraliq uchun. */
export const arcRodPoint = (d) => [ARC.XM + (d * ARC.K) / 2 + 0.38, ARC.Y, ARC.Z];
/** Liniya maketi: tayanchlar ±X, sim tekisligi Z, tayanch balandligi TOP, sim osilgan joy Y0, salqilik SAG. */
export const LINE = { X: 2.25, Z: -0.3, TOP: 2.15, Y0: 1.72, SAG: 0.3 };
const sagY = (x) => LINE.Y0 - LINE.SAG * (1 - (x / LINE.X) ** 2);

export function createDischargeLab() {
  const lab = createLab3D();
  let mode = 'ion', knobAt = () => [0, 0, 0], narrow = false; // narrow — tor ekran: ikkinchi darajali yozuvlar yashiriladi
  lab.reset = () => Object.assign(lab.camera, VIEW[mode].camera);
  lab.reset();

  /** Shaffof nur konusi: a — manba (r0), b — nishon (r1). */
  function beam(a, b, r0, r1, rgb, op, n = 16) {
    const d = b.map((v, i) => v - a[i]), L = Math.hypot(...d) || 1, u = d.map((v) => v / L), q = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let v = [u[1] * q[2] - u[2] * q[1], u[2] * q[0] - u[0] * q[2], u[0] * q[1] - u[1] * q[0]];
    const vl = Math.hypot(...v); v = v.map((x) => x / vl);
    const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const rim = (p, r) => Array.from({ length: n }, (_, k) => p.map((x, i) => x + r * (Math.cos((k * TAU) / n) * v[i] + Math.sin((k * TAU) / n) * w[i])));
    const A = rim(a, r0), B = rim(b, r1);
    for (let k = 0; k < n; k++) lab.face([A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]], rgba(rgb, op));
  }
  /** Old tomonga (−z) qaragan disk yoki sektor. */
  function disc(p, r, color, a0 = 0, a1 = TAU, n = 18) {
    const pts = [p];
    for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; pts.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, p[2]]); }
    lab.face(pts, color);
  }

  /* ---------------------------------------------------------------- 1) Ionlash kamerasi */
  function ionizer(o, anim, xl, xr) {
    const c = lab.colors, { PX, Y0, Y1 } = ION;
    if (o.src === 'flame') {
      const x = PX, z = -0.05, fl = 1 + Math.sin(anim * 13) * 0.05 + Math.sin(anim * 7.3) * 0.04;
      lab.rod([x, 0, z], [x, 0.16, z], 0.16, alpha('#bae6fd', c.dark ? 0.3 : 0.55), 24);
      lab.rod([x, 0.005, z], [x, 0.08, z], 0.145, alpha('#38bdf8', 0.45), 24);
      lab.rod([x, 0.16, z], [x, 0.22, z], 0.05, '#a1a1aa', 12);
      lab.rod([x, 0.22, z], [x, 0.27, z], 0.012, '#f5f5f4', 6);
      glow(lab, [x, 0.37, z], 0.17 * fl, [251, 146, 60], 0.5, 5, 24);
      glow(lab, [x, 0.36, z], 0.1 * fl, [253, 224, 71], 0.9, 4, 20);
      glow(lab, [x, 0.33, z], 0.055 * fl, [59, 130, 246], 0.8, 3, 16);
      // alangadan ko'tarilayotgan issiq gaz (ionlar shu oqim bilan plastinkalar orasiga kiradi)
      for (const dx of [-0.05, 0, 0.05]) {
        const pts = [];
        for (let y = 0.46; y < Y0 + 0.45; y += 0.04) pts.push([x + dx + Math.sin(y * 18 - anim * 6 + dx * 40) * 0.015, y, z]);
        for (let k = 1; k < pts.length; k++) lab.line(pts[k - 1], pts[k], c.dark ? 'rgba(253,186,116,0.35)' : 'rgba(234,88,12,0.3)', 1.2);
      }
      if (!narrow) lab.label('spirt lampa', [x, 0.02, z - 0.42], c.text2);
    } else if (o.src === 'uv') {
      const L = [PX + 1.05, 1.0, -0.75], pulse = 0.85 + 0.15 * Math.sin(anim * 9);
      lab.box(L[0] - 0.16, 0, L[2] - 0.16, 0.32, 0.04, 0.32, c.text2);
      lab.rod([L[0], 0.04, L[2]], [L[0], L[1] - 0.1, L[2]], 0.025, c.text3, 8);
      lab.box(L[0] - 0.13, L[1] - 0.11, L[2] - 0.13, 0.32, 0.22, 0.26, c.dark ? '#475569' : '#64748b');
      const win = [L[0] - 0.13, L[1], L[2]];
      ball(lab, win, 0.07, '#c4b5fd', 6);
      beam(win, [PX, (Y0 + Y1) / 2, 0], 0.06, Math.max(0.2, (xr - xl) * 0.6), [167, 139, 250], 0.22 * pulse);
      if (!narrow) lab.label('ultrabinafsha lampa', [L[0], 0.02, L[2] - 0.3], c.text2);
    } else if (o.src === 'xray') {
      const x = PX, z = -0.1, pulse = 0.85 + 0.15 * Math.sin(anim * 9);
      lab.box(x - 0.36, 0, z - 0.2, 0.72, 0.3, 0.4, c.dark ? '#52525b' : '#71717a');
      lab.box(x - 0.1, 0.3, z - 0.06, 0.2, 0.04, 0.12, c.dark ? '#a1a1aa' : '#3f3f46');
      // radiatsiya belgisi
      const s = [x + 0.2, 0.15, z - 0.202];
      disc(s, 0.075, '#facc15');
      for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k * TAU) / 3; disc([s[0], s[1], s[2] - 0.002], 0.062, '#1c1917', a - 0.5, a + 0.5, 6); }
      disc([s[0], s[1], s[2] - 0.004], 0.016, '#facc15');
      // nurlar dastasi plastinkalar orasidan yuqoriga
      beam([x, 0.34, z + 0.1], [x, Y1, z + 0.1], 0.05, Math.max(0.06, (xr - xl) / 2 - 0.01), [52, 211, 153], 0.3 * pulse);
      if (!narrow) lab.label('rentgen trubkasi (qo‘rg‘oshin g‘ilofda)', [x, 0.02, z - 0.5], c.text2);
    } else if (!narrow) lab.label('ionlagich yo‘q — faqat kosmik nurlar va tabiiy radioaktivlik', [PX - 0.3, 0.02, -1.0], c.text3);
  }
  function ionScene(o, anim) {
    const c = lab.colors, col = COL(c), { PX, Y0, Y1, Z, K, T } = ION, gap = o.d * K, xl = PX - gap / 2, xr = PX + gap / 2;
    ionizer(o, anim, xl, xr);
    // plastinkalar izolyator ustunlarda; ionlar urilganda yalt etadi
    [[xl - T / 2, 0], [xr + T / 2, 1]].forEach(([x, i]) => {
      lab.box(x - 0.16, 0, Z - 0.22, 0.32, 0.05, 0.32, c.text2);
      lab.rod([x, 0.05, Z - 0.06], [x, Y0 + 0.08, Z - 0.06], 0.03, col.ebonite, 10);
      lab.box(i ? xr : xl - T, Y0, -Z, T, Y1 - Y0, 2 * Z, col.metal);
      if (o.hit[i] > 0) { const xf = i ? xr - 0.003 : xl + 0.003; lab.face([[xf, Y0, -Z], [xf, Y1, -Z], [xf, Y1, Z], [xf, Y0, Z]], `rgba(250,204,21,${clamp(o.hit[i] * 2, 0, 0.3)})`); }
    });
    // ionlar: qizil — musbat, ko'k — manfiy (kuchli maydonda — ko'chki ionlari kichikroq)
    const pos = c.dark ? '#f87171' : '#dc2626', neg = c.dark ? '#60a5fa' : '#2563eb';
    for (const q of o.parts) {
      const a = clamp(q.life * 1.5, 0.15, 1), base = q.s > 0 ? pos : neg;
      ball(lab, ionPoint(q), q.a ? 0.017 : 0.023, a > 0.97 ? base : alpha(base, a), 2);
    }
    if (o.spark > 0) {
      const k = clamp(o.spark / 0.12, 0, 1), y1 = Y1 - 0.2 - ((o.seed % 60) / 60) * 0.55, y2 = Y1 - 0.2 - (((o.seed * 7) % 70) / 70) * 0.55, zz = ((o.seed % 13) / 13 - 0.5) * 0.6;
      lab.face([[xl + 0.004, Y0, zz], [xr - 0.004, Y0, zz], [xr - 0.004, Y1, zz], [xl + 0.004, Y1, zz]], `rgba(196,181,253,${0.45 * k})`);
      bolt(lab, [xl, y1, zz], [xr, y2, zz], o.seed, { width: 0.012, n: Math.max(4, Math.round(o.d * 4)), amp: 0.25 });
    }
    lab.label('+', [xl - T / 2, Y1 + 0.13, -Z], c.danger); lab.label('−', [xr + T / 2, Y1 + 0.13, -Z], c.primary);
    lab.label(`d = ${fmt(o.d, 1)} cm`, [PX, Y0 - 0.13, -Z - 0.05], c.text);
    // manba, galvanometr va simlar
    const ps = supply(lab, [-1.75, 0, -0.2], { text: o.text, title: narrow ? '' : 'Yuqori kuchlanish 0–40 kV', marks: !narrow, frac: o.pos, id: 'knob' });
    knobAt = ps.knob;
    const m = o.meter, gm = meter(lab, [1.85, 0, -0.15], { frac: m.value / m.max, sym: m.sym, text: m.label, w: 0.66, h: 0.56 });
    if (!narrow) lab.label('galvanometr', [1.85, 0.02, -0.52], c.text2);
    const on = o.I > 0, t = anim;
    wire(lab, [ps.plus, [ps.plus[0], ps.plus[1], ps.plus[2] - 0.06], [-1.3, 1.72, -0.1], [xl - T / 2, 1.72, 0], [xl - T / 2, Y1, 0]], col.red, { on, t });
    wire(lab, [[xr + T / 2, Y1, 0], [xr + T / 2, 1.72, 0], [gm.plus[0], 1.15, gm.plus[2] - 0.1], [gm.plus[0], gm.plus[1], gm.plus[2] - 0.06], gm.plus], col.black, { on, t });
    wire(lab, [gm.minus, [gm.minus[0], gm.minus[1], gm.minus[2] - 0.06], [gm.minus[0], 0.03, gm.minus[2] - 0.08], [2.35, 0.03, gm.minus[2] - 0.08], [2.35, 0.03, 0.7], [-2.35, 0.03, 0.7], [-2.35, 0.03, -0.38], [ps.minus[0], 0.03, -0.38], [ps.minus[0], ps.minus[1], ps.minus[2] - 0.06], ps.minus], col.black, { on, t });
  }

  /* ---------------------------------------------------------------- 2) Razryad trubkasi */
  function tubeGlow(o, anim, b) {
    const { X0, X1, Y, Z } = TUBE, g = o.gas, reg = o.reg, s = (X1 - X0) / o.Lcm, rIn = 0.165;
    const seg = (x0, x1, rgb, a, r = rIn) => { if (x1 - x0 > 0.002 && a > 0.01) lab.rod([x0, Y, Z], [x1, Y, Z], r, rgba(rgb, a), 18); };
    if (reg === 'spark' || reg === 'cord') {
      const w = reg === 'spark' ? 0.008 : clamp(0.012 + 0.03 * (1 - (o.p - 3) / 10), 0.012, 0.045), glowCol = `rgb(${g.col.join(',')})`;
      for (let k = 0; k < (reg === 'spark' ? 2 : 1); k++) bolt(lab, [X0, Y, Z], [X1, Y, Z], 1 + Math.floor(anim * (reg === 'spark' ? 14 : 3)) * 7 + k * 101, { width: w * Math.min(1, b + 0.2), n: 22, amp: reg === 'spark' ? 0.035 : 0.014, glow: glowCol, core: '#ffffff' });
    } else if (reg === 'glow' || reg === 'striae') {
      const L = o.L, xd = X0 + L.dk * s, xn = xd + L.neg * s, xf = xn + L.far * s;
      seg(X0 + 0.002, X0 + 0.016, g.neg, 0.55 * b, 0.155); // katod shu'lasi
      for (let k = 0; k < 4; k++) seg(xd + ((xn - xd) * k) / 4, xd + ((xn - xd) * (k + 1)) / 4, g.neg, (0.85 - 0.2 * k) * b); // manfiy shu'la
      if (X1 > xf) { // musbat ustun (qatlamlar bilan)
        const sp = Math.max(0.05, L.spacing * s), phase = (anim * 0.05) % sp, N = 48, len = X1 - xf;
        for (let k = 0; k < N; k++) {
          const u = (k + 0.5) / N, x = xf + u * len, st = 0.5 + 0.5 * Math.cos(((x - xf + phase) / sp) * TAU);
          const a = (0.25 + 0.6 * (L.striae ? st ** 2 * L.striae + (1 - L.striae) : 1)) * b * Math.min(1, u * 6 + 0.2);
          seg(xf + (k * len) / N, xf + ((k + 1) * len) / N, g.col, Math.min(0.92, a));
        }
        seg(X1 - 0.03, X1 - 0.002, g.col, 0.6 * b);
      }
    } else if (reg === 'rays') { // katod nurlari: anod tomondagi shisha yashil shu'lalanadi
      const k = clamp(o.U / 12000, 0.3, 1);
      glow(lab, [X1 + 0.21, Y, Z], 0.42, [74, 222, 128], 0.75 * k, 6, 28);
      lab.rod([X1 + 0.19, Y, Z], [X1 + 0.205, Y, Z], 0.2, rgba([74, 222, 128], 0.6 * k), 28);
      seg(X0 + 0.002, X0 + 0.04, g.neg, 0.25 * k);
    }
  }
  function tubeScene(o, anim) {
    const c = lab.colors, col = COL(c), { X0, X1, Y, Z, R } = TUBE, b = clamp(o.I / 6e-3, 0.25, 1.2), on = o.I > 0;
    for (const x of [-1.15, 1.45]) { // shtativlar va qisqichlar
      lab.box(x - 0.15, 0, Z - 0.15, 0.3, 0.04, 0.3, c.text2);
      lab.rod([x, 0.04, Z], [x, Y - R - 0.02, Z], 0.022, c.text3, 8);
      ring(lab, [x, Y, Z], R + 0.015, c.text3, 'x', 0.012);
    }
    // elektrodlar va chiqishlar
    lab.rod([X0 - 0.03, Y, Z], [X0, Y, Z], 0.15, col.metal, 20); lab.rod([X0 - 0.03, Y, Z], [X0 - 0.48, Y, Z], 0.012, col.metal, 6);
    lab.rod([X1, Y, Z], [X1 + 0.03, Y, Z], 0.15, col.metal, 20); lab.rod([X1 + 0.03, Y, Z], [X1 + 0.48, Y, Z], 0.012, col.metal, 6);
    if (o.burning) tubeGlow(o, anim, b);
    lab.rod([X0 - 0.2, Y, Z], [X1 + 0.2, Y, Z], R, col.glass, 28);
    // yon naycha, klapan, shlang
    const vx = 0.15, vy = 0.4, lc = [vx, vy, Z - 0.09], lev = o.vent ? [0.13, 0, 0] : [0, 0.13, 0];
    lab.rod([vx, Y - R + 0.02, Z], [vx, vy + 0.06, Z], 0.045, col.glass, 12);
    lab.box(vx - 0.08, vy - 0.06, Z - 0.07, 0.16, 0.12, 0.14, c.dark ? '#a16207' : '#b45309');
    lab.rod(lc.map((v, i) => v - lev[i]), lc.map((v, i) => v + lev[i]), 0.018, c.dark ? '#fde68a' : '#78350f', 8);
    lab.handle('valve', lc, 0.16);
    if (o.vent) for (let k = 0; k < 3; k++) { const ph = (anim * 2 + k / 3) % 1; camRing(lab, [vx + 0.14 + ph * 0.3, vy, Z - 0.1], 0.03 + ph * 0.06, alpha(c.text3, 1 - ph), 1.2, 14); }
    path(lab, [[vx, vy - 0.06, Z], [vx, 0.2, Z - 0.12], [0.45, 0.3, -0.45], [0.72, 0.68, -0.66], [0.72, 0.6, -0.66]], col.hose, 0.032);
    // vakuummetr (naychaga ulangan)
    path(lab, [[vx, 0.55, Z], [-0.6, 0.55, Z], [-0.6, 0.42, -0.62]], col.hose, 0.018);
    display(lab, [-0.6, 0, -0.8], { w: 0.82, h: 0.42, d: 0.3, text: o.pText, title: narrow ? '' : 'Vakuummetr' });
    // vakuum nasosi
    lab.box(0.42, 0, -1.02, 1.32, 0.05, 0.72, c.dark ? '#1f2937' : '#111827');
    lab.box(0.5, 0.05, -0.95, 0.8, 0.5, 0.6, c.dark ? '#7f1d1d' : '#b91c1c');
    lab.rod([1.3, 0.28, -0.65], [1.68, 0.28, -0.65], 0.17, c.dark ? '#334155' : '#4b5563', 20);
    lab.rod([0.72, 0.55, -0.66], [0.72, 0.62, -0.66], 0.04, c.text3, 10);
    const fw = [0.9, 0.3], rot = o.pump ? anim * 18 : 0;
    lab.rod([fw[0], fw[1], -0.95], [fw[0], fw[1], -0.985], 0.17, c.dark ? '#cbd5e1' : '#e5e7eb', 24);
    for (let k = 0; k < 4; k++) { const a = rot + (k * Math.PI) / 2; lab.line([fw[0], fw[1], -0.99], [fw[0] + Math.cos(a) * 0.15, fw[1] + Math.sin(a) * 0.15, -0.99], '#475569', 2); }
    ball(lab, [fw[0], fw[1], -0.99], 0.03, '#475569', 3);
    ball(lab, [1.2, 0.47, -0.955], 0.024, o.pump ? '#22c55e' : '#6b7280', 3);
    lab.label('NASOS', [0.9, 0.64, -0.95], c.text);
    lab.handle('pump', [0.9, 0.3, -0.95], 0.32);
    // manba, mA metr va simlar
    const ps = supply(lab, [-2.2, 0, -0.8], { text: `${fmt(o.U / 1000, 2)} kV`, title: narrow ? '' : 'Yuqori kuchlanish 0–15 kV', marks: !narrow, frac: o.U / 15000, id: 'knob' });
    knobAt = ps.knob;
    const am = meter(lab, [2.3, 0, -0.5], { frac: (o.I * 1000) / 20, sym: 'mA', text: '0–20 mA', w: 0.6, h: 0.5 });
    wire(lab, [ps.minus, [ps.minus[0], ps.minus[1], ps.minus[2] - 0.06], [ps.minus[0], 0.03, ps.minus[2] - 0.12], [-2.75, 0.03, ps.minus[2] - 0.12], [-2.75, 0.03, Z], [-2.75, Y, Z], [X0 - 0.48, Y, Z]], col.black, { on, t: anim });
    wire(lab, [ps.plus, [ps.plus[0], ps.plus[1], ps.plus[2] - 0.06], [ps.plus[0], 0.03, -1.15], [am.plus[0], 0.03, -1.15], [am.plus[0], am.plus[1], am.plus[2] - 0.06], am.plus], col.red, { on, t: anim });
    wire(lab, [am.minus, [am.minus[0], am.minus[1], am.minus[2] - 0.06], [am.minus[0], 0.03, am.minus[2] - 0.08], [2.75, 0.03, am.minus[2] - 0.08], [2.75, 0.03, Z], [2.75, Y, Z], [X1 + 0.48, Y, Z]], col.red, { on, t: anim });
    lab.label('katod (−)', [X0, Y + R + 0.14, Z], c.text2); lab.label('anod (+)', [X1, Y + R + 0.14, Z], c.text2);
    lab.label(`${o.gas.name} · ${o.regText}`, [0.15, Y + R + 0.38, Z], c.text);
  }

  /* ---------------------------------------------------------------- 3) Uchqun: elektrofor mashinasi */
  function sparkScene(o) {
    const c = lab.colors, col = COL(c), { CX, CY, R, BY, BR, K } = SPARK, gp = o.d * K, zF = -0.05, zB = 0.07;
    lab.box(CX - 1.3, 0, -0.62, 2.6, 0.1, 1.15, col.wood);
    lab.rod([CX, 0.1, 0.32], [CX, CY, 0.32], 0.045, col.wood, 12);
    lab.rod([CX, CY, -0.16], [CX, CY, 0.36], 0.022, col.metal, 10);
    // ikki disk (organik shisha) qarama-qarshi aylanadi, ustida folga sektorlari
    for (const [z, dir] of [[zF, 1], [zB, -1]]) {
      const pts = Array.from({ length: 40 }, (_, k) => [CX + R * Math.cos((k * TAU) / 40), CY + R * Math.sin((k * TAU) / 40), z]);
      lab.face(pts, alpha(c.dark ? '#94a3b8' : '#bae6fd', 0.32));
      for (let k = 0; k < 40; k++) lab.line(pts[k], pts[(k + 1) % 40], c.text3, 1);
      const zs = z + (dir > 0 ? -0.004 : 0.004), r0 = R * 0.6, r1 = R * 0.92, w = 0.022;
      for (let k = 0; k < 24; k++) {
        const a = dir * o.rot + (k * TAU) / 24, ca = Math.cos(a), sa = Math.sin(a);
        lab.face([[CX + ca * r0 - sa * w, CY + sa * r0 + ca * w, zs], [CX + ca * r1 - sa * w, CY + sa * r1 + ca * w, zs], [CX + ca * r1 + sa * w, CY + sa * r1 - ca * w, zs], [CX + ca * r0 + sa * w, CY + sa * r0 - ca * w, zs]], c.dark ? '#e2e8f0' : '#78716c');
      }
    }
    for (const [a, z] of [[Math.PI / 4, zF - 0.035], [-Math.PI / 4, zB + 0.035]]) lab.rod([CX - Math.cos(a) * R * 0.95, CY - Math.sin(a) * R * 0.95, z], [CX + Math.cos(a) * R * 0.95, CY + Math.sin(a) * R * 0.95, z], 0.012, col.metal, 8);
    ball(lab, [CX, CY, zF - 0.04], 0.05, c.dark ? '#475569' : '#57534e', 4);
    const ha = o.rot * 0.5, tip = [CX + Math.cos(ha) * 0.26, CY + Math.sin(ha) * 0.26, -0.16];
    lab.rod([CX, CY, -0.16], tip, 0.018, c.dark ? '#a8a29e' : '#44403c', 8); lab.rod(tip, [tip[0], tip[1], -0.3], 0.025, '#b91c1c', 10);
    for (const sg of [-1, 1]) {
      const x = CX + sg * (R + 0.1);
      lab.rod([x, 0.1, 0.01], [x, CY - 0.2, 0.01], 0.035, col.ebonite, 12); // izolyator ustun
      lab.rod([x, CY - 0.2, 0.01], [x, CY + 0.2, 0.01], 0.02, col.metal, 8);
      for (const z of [zF - 0.06, zB + 0.06]) { // taroq disklarni ikki tomondan quchoqlaydi
        lab.rod([x, CY, 0.01], [x, CY, z], 0.014, col.metal, 6); lab.rod([x, CY, z], [x - sg * 0.16, CY, z], 0.014, col.metal, 6);
        for (let k = 0; k < 5; k++) { const tx = x - sg * (0.04 + k * 0.03); lab.line([tx, CY, z], [tx, CY, z + (z < 0 ? 0.03 : -0.03)], col.metal, 1); }
      }
      if (o.jars) { // Leyden bankasi
        const jx = CX + sg * 0.5, jz = -0.4;
        lab.rod([jx, 0.1, jz], [jx, 0.42, jz], 0.122, c.dark ? '#cbd5e1' : '#a1a1aa', 18);
        lab.rod([jx, 0.1, jz], [jx, 0.72, jz], 0.12, alpha(c.dark ? '#cbd5e1' : '#e2e8f0', 0.45), 18);
        path(lab, [[jx, 0.45, jz], [jx, 0.92, jz], [x, CY - 0.25, 0.01]], col.metal, 0.012);
        ball(lab, [jx, 0.92, jz], 0.03, col.metal, 3);
      }
      const bx = CX + sg * (gp / 2 + BR); // razryadlovchi va shar
      path(lab, [[x, CY + 0.2, 0.01], [x, BY, 0.01], [bx - sg * BR, BY, 0.01]], col.metal, 0.02);
      lab.rod([x - sg * 0.06, BY, 0.01], [x - sg * 0.26, BY, 0.01], 0.034, col.ebonite, 10);
      ball(lab, [bx, BY, 0.01], BR, col.brass, 8);
    }
    lab.handle('ball', ballPoint(o.d), 0.16);
    if (o.flash > 0) {
      const k = clamp(o.flash / (o.jars ? 0.16 : 0.08), 0, 1);
      glow(lab, [CX, BY, 0.01], (o.jars ? 0.9 : 0.4) * (0.6 + 0.4 * k), c.dark ? [221, 214, 254] : [139, 92, 246], (c.dark ? 0.55 : 0.4) * k, 6, 28);
      bolt(lab, [CX - gp / 2, BY, 0.01], [CX + gp / 2, BY, 0.01], o.seed, { width: o.jars ? 0.022 : 0.012, n: Math.max(3, Math.round(o.d * 4)), amp: 0.3 });
    }
    lab.label(`d = ${fmt(o.d, 1)} cm`, [CX, BY + 0.22, 0.01], c.text);
    // elektrostatik kilovoltmetr taroqlarga ulangan
    const vm = meter(lab, [1.85, 0, -0.15], { frac: o.U / 1000 / 100, sym: 'kV', text: 'elektrostatik', w: 0.78, h: 0.66, neutral: true });
    lab.label(`Uₜ = ${fmt(o.Vb / 1000, 1)} kV`, [1.85, 0.02, -0.56], c.danger);
    const xl = CX - R - 0.1, xr = CX + R + 0.1;
    wire(lab, [[xr + 0.035, 0.3, 0.01], [0.95, 0.3, 0.01], [0.95, 0.03, -0.34], [vm.minus[0], 0.03, -0.34], [vm.minus[0], vm.minus[1], vm.minus[2] - 0.05], vm.minus], col.black, { width: 0.012 });
    wire(lab, [[xl - 0.035, 0.3, 0.01], [-2.0, 0.3, 0.01], [-2.0, 0.03, 0.72], [1.3, 0.03, 0.72], [1.3, 0.03, -0.34], [vm.plus[0], 0.03, -0.34], [vm.plus[0], vm.plus[1], vm.plus[2] - 0.05], vm.plus], col.black, { width: 0.012 });
  }

  /* ---------------------------------------------------------------- 4) Elektr yoyi */
  function arcScene(o, anim) {
    const c = lab.colors, col = COL(c), { XM, Y, Z, K, ROD } = ARC, st = o.st, tl = XM - (o.d * K) / 2, tr = XM + (o.d * K) / 2, on = st.I > 0;
    const graphite = c.dark ? '#3f3f46' : '#27272a', lh = tl - ROD + 0.15, rh = tr + ROD - 0.15;
    lab.rod([tl - ROD, Y, Z], [tl, Y, Z], 0.05, graphite, 16);
    lab.rod([tr, Y, Z], [tr + ROD, Y, Z], 0.05, graphite, 16);
    for (const x of [lh, rh]) { lab.box(x - 0.17, 0, Z - 0.17, 0.34, 0.05, 0.34, c.text2); lab.rod([x, 0.05, Z], [x, Y - 0.07, Z], 0.03, col.ebonite, 10); lab.box(x - 0.08, Y - 0.08, Z - 0.08, 0.16, 0.16, 0.16, '#a1a1aa'); }
    // uchlar qizishi va yoy
    const heat = st.mode === 'arc' ? 1 : st.mode === 'short' ? 0.7 : 0;
    if (heat) for (const [x, dir, T] of [[tl, -1, 1], [tr, 1, 0.75]]) for (let k = 0; k < 4; k++) {
      lab.rod([x + dir * k * 0.05, Y, Z], [x + dir * (k + 1) * 0.05, Y, Z], 0.052, `rgba(255,${Math.round(230 * T * (1 - k * 0.2))},${Math.round(160 * T * (1 - k * 0.3))},${heat * (0.95 - k * 0.2)})`, 16);
    }
    if (st.mode === 'arc') {
      const fl = 1 + 0.08 * Math.sin(anim * 40) + 0.05 * Math.sin(anim * 23), m = [XM, Y, Z];
      glow(lab, m, (0.35 + o.d * 0.04) * fl, c.dark ? [255, 251, 235] : [253, 224, 71], 0.6, 7, 32);
      lab.rod([tl, Y, Z], [tr, Y, Z], (0.03 + o.d * 0.003) * fl, 'rgba(196,181,253,0.8)', 16);
      lab.rod([tl, Y, Z], [tr, Y, Z], 0.012 * fl, '#fffbeb', 10);
      ball(lab, [tl, Y, Z], 0.042, '#ffffff', 4);
    }
    lab.handle('rod', arcRodPoint(o.d), 0.2);
    lab.label(`d = ${fmt(o.d, 1)} mm`, [XM, Y + 0.3, Z], c.text);
    lab.label(st.mode === 'arc' ? 'elektr yoyi' : st.mode === 'short' ? 'ko‘mirlar tutashgan — qizimoqda' : o.out ? 'yoy so‘ndi' : 'tok yo‘q', [XM, Y + (narrow ? 0.74 : 0.52), Z], st.mode === 'arc' ? c.warning : st.mode === 'short' ? c.danger : c.text3);
    // manba, reostat (orqada), ampermetr va voltmetr
    const ps = supply(lab, [-2.2, 0, -0.35], { text: '110 V', title: narrow ? '' : 'Manba 110 V (o‘zgarmas)', marks: !narrow, knob: false });
    const rz = 0.75, ry = 0.38, rx0 = -1.9, rx1 = -0.6;
    for (const x of [rx0 - 0.06, rx1 + 0.06]) lab.box(x - 0.06, 0, rz - 0.15, 0.12, ry + 0.25, 0.3, c.text3);
    lab.rod([rx0, ry, rz], [rx1, ry, rz], 0.11, c.dark ? '#d6d3d1' : '#f5f5f4', 20);
    const turns = 26, coil = c.dark ? '#d97706' : '#92400e', at = (u) => { const a = u * turns * TAU; return [rx0 + 0.03 + u * (rx1 - rx0 - 0.06), ry + 0.113 * Math.cos(a), rz + 0.113 * Math.sin(a)]; };
    for (let k = 0; k < turns * 14; k++) lab.line(at(k / (turns * 14)), at((k + 1) / (turns * 14)), coil, 1);
    lab.rod([rx0 - 0.06, ry + 0.22, rz], [rx1 + 0.06, ry + 0.22, rz], 0.014, '#57534e', 8);
    const sx = rx0 + 0.05 + (o.R / 20) * (rx1 - rx0 - 0.1);
    lab.box(sx - 0.05, ry + 0.1, rz - 0.06, 0.1, 0.16, 0.12, '#1f2937');
    if (!narrow) lab.label(`reostat R = ${fmt(o.R, 1)} Ω`, [(rx0 + rx1) / 2, ry + 0.42, rz], c.text2);
    const amax = st.I > 19 ? 50 : 20, am = meter(lab, [-0.9, 0, -0.85], { frac: st.I / amax, sym: 'A', text: st.I > 19 ? '0–50 A' : '0–20 A', w: 0.56, h: 0.48 });
    const vm = meter(lab, [2.25, 0, -0.65], { frac: (st.mode === 'off' ? 0 : st.U) / 150, sym: 'V', text: '0–150 V', w: 0.56, h: 0.48 });
    const t = anim;
    wire(lab, [ps.plus, [ps.plus[0], ps.plus[1], ps.plus[2] - 0.06], [ps.plus[0], 0.03, -0.55], [-2.8, 0.03, -0.55], [-2.8, 0.03, rz], [rx0 - 0.06, 0.03, rz - 0.2], [rx0 - 0.06, ry + 0.25, rz - 0.15]], col.red, { on, t });
    wire(lab, [[sx, ry + 0.26, rz], [sx, ry + 0.34, rz], [-0.42, ry + 0.34, rz], [-0.42, 0.03, rz], [-0.42, 0.03, -1.02], [am.plus[0], 0.03, -1.02], [am.plus[0], am.plus[1], am.plus[2] - 0.05], am.plus], col.red, { on, t });
    wire(lab, [am.minus, [am.minus[0], am.minus[1], am.minus[2] - 0.05], [am.minus[0] + 0.08, 0.03, -1.12], [lh, 0.03, -1.12], [lh, 0.03, Z - 0.2], [lh, Y - 0.08, Z - 0.09]], col.red, { on, t });
    wire(lab, [[rh, Y - 0.08, Z + 0.09], [rh, 0.03, Z + 0.25], [rh, 0.03, 0.45], [-1.45, 0.03, 0.45], [-1.45, 0.03, -0.52], [ps.minus[0], 0.03, -0.52], [ps.minus[0], ps.minus[1], ps.minus[2] - 0.06], ps.minus], col.black, { on, t });
    wire(lab, [vm.plus, [vm.plus[0], vm.plus[1], vm.plus[2] - 0.05], [vm.plus[0], 0.03, -0.8], [lh + 0.1, 0.03, -0.8], [lh + 0.1, 0.05, Z - 0.17]], col.blue, { width: 0.01 });
    wire(lab, [vm.minus, [vm.minus[0], vm.minus[1], vm.minus[2] - 0.05], [vm.minus[0], 0.03, -0.4], [rh + 0.1, 0.03, -0.4], [rh + 0.1, 0.05, Z - 0.17]], col.blue, { width: 0.01 });
  }

  /* ---------------------------------------------------------------- 5) Toj razryad: liniya maketi */
  function tower(x, z) {
    const c = lab.colors, steel = c.dark ? '#94a3b8' : '#64748b', H = LINE.TOP, b0 = 0.28, b1 = 0.1;
    const corner = (y, sx, sz) => { const h = b0 + (b1 - b0) * (y / H); return [x + sx * h, y, z + sz * h]; };
    const sides = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lab.rod(corner(0, sx, sz), corner(H, sx, sz), 0.013, steel, 6);
    for (let y0 = 0; y0 < H - 1e-6; y0 += 0.3) {
      const y1 = Math.min(H, y0 + 0.3);
      for (const [a, b] of sides) { lab.line(corner(y0, ...a), corner(y1, ...b), steel, 1); lab.line(corner(y0, ...b), corner(y1, ...a), steel, 1); lab.line(corner(y1, ...a), corner(y1, ...b), steel, 1.3); }
    }
    lab.box(x - 0.05, H, LINE.Z - 0.1, 0.1, 0.06, z - LINE.Z + 0.25, steel); // traversa old tomonga
    lab.rod([x, H, LINE.Z], [x, LINE.Y0 + 0.02, LINE.Z], 0.008, steel, 6);
    for (let k = 0; k < 8; k++) { const y = H - 0.06 - k * 0.052; lab.rod([x, y, LINE.Z], [x, y - 0.014, LINE.Z], 0.06, 'rgba(134,239,172,0.85)', 16); } // izolyatorlar girlyandasi
  }
  function coronaScene(o, anim) {
    const c = lab.colors, { X, Z } = LINE;
    lab.box(-2.7, 0, -1.1, 5.4, 0.02, 2.2, c.dark ? '#14532d' : '#4d7c0f');
    tower(-X, 0.3); tower(X, 0.3);
    const N = 24, pts = Array.from({ length: N + 1 }, (_, k) => { const x = -X + (2 * X * k) / N; return [x, sagY(x), Z]; });
    if (o.f > 0) { // toj: sim atrofida binafsha ionlashgan qatlam va uchqunchalar
      for (const [w, a] of [[0.09, 0.12], [0.05, 0.22], [0.025, 0.4]]) {
        const op = a * clamp(0.4 + o.f, 0, 1.2) * (0.85 + 0.15 * Math.sin(anim * 30 + w * 100));
        for (let k = 0; k < N; k++) lab.rod(pts[k], pts[k + 1], w * (0.9 + o.f), `rgba(167,139,250,${clamp(op, 0, 1)})`, 10);
      }
      const r = SEED(1 + Math.floor(anim * 20));
      for (let k = 0; k < 10 + 30 * o.f; k++) { const x = -X + r() * 2 * X; ball(lab, [x, sagY(x) + (r() - 0.5) * 0.04, Z + (r() - 0.5) * 0.04], 0.008 + r() * 0.01, 'rgba(237,233,254,0.95)', 2); }
    }
    path(lab, pts, c.dark ? '#cbd5e1' : '#94a3b8', 0.01 + o.r * 0.01);
    if (o.m < 0.7) { // yomg'ir
      const r2 = SEED(11), rain = c.dark ? 'rgba(186,230,253,0.5)' : 'rgba(14,116,144,0.45)';
      for (let k = 0; k < 70; k++) { const x = -2.6 + r2() * 5.2, z = -1 + r2() * 2, y = 2.6 - ((r2() * 2.6 + anim * 2.6) % 2.6); lab.line([x, y, z], [x - 0.03, y - 0.12, z], rain, 1); }
    }
    lab.label(`${fmt(o.U, 0)} kV · r = ${fmt(o.r * 10, 1)} mm`, [0, sagY(0) - 0.25, Z], c.text);
    if (o.f > 0) lab.label('toj razryad — vizillash, ozon hidi', [0, 0.6, Z], c.special);
  }
  /** Yuqorida (keng ekranda o'ngda): sim kesimi va ionlashgan qatlam (2D, discharge.js dagi kesim bilan bir xil). */
  function coronaHud(ctx, st, o) {
    const IR = clamp(Math.min(st.w, st.h) * 0.13, 34, 56), k = IR / 58, ix = narrow ? st.w / 2 : st.w - IR - 16, iy = IR + 26, rpx = (8 + o.r * 10) * k; // tor ekranda — tepada o'rtada
    const ri = o.Es > 30 * o.m ? Math.min(IR - 4, rpx * (o.Es / (30 * o.m))) : rpx;
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.88)'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ix, iy, IR, 0, TAU); ctx.fill(); ctx.stroke();
    if (ri > rpx + 0.5) { const g = ctx.createRadialGradient(ix, iy, rpx, ix, iy, ri); g.addColorStop(0, 'rgba(167,139,250,0.85)'); g.addColorStop(1, 'rgba(167,139,250,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, iy, ri, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    for (let j = 0; j < 12; j++) { const a = (j * TAU) / 12; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * (rpx + 2), iy + Math.sin(a) * (rpx + 2)); ctx.lineTo(ix + Math.cos(a) * (IR - 4), iy + Math.sin(a) * (IR - 4)); ctx.stroke(); }
    ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(ix, iy, rpx, 0, TAU); ctx.fill();
    ctx.fillStyle = st.colors.text2; ctx.font = '600 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('sim kesimi', ix, iy + IR + 4);
    ctx.restore();
  }

  /**
   * f.mode: 'ion' | 'tube' | 'spark' | 'arc' | 'corona'; f.anim — animatsiya vaqti;
   * f.ion — { src, U, pos, text, d, parts, hit, spark, seed, I, meter }, f.tube — { gas, p, pText, U, pump, vent, burning, reg, regText, I, L, Lcm },
   * f.spark — { d, jars, U, rot, flash, seed, Vb, t }, f.arc — { R, d, st, out }, f.cor — { U, r, m, Es, Ec, f }.
   */
  function draw(ctx, stage, f) {
    const view = VIEW[f.mode] || VIEW.ion, wide = stage.w >= 640, t = view.begin.target;
    narrow = stage.w < 480;
    lab.begin(ctx, stage, { target: wide && view.hud ? [t[0] + view.hud, t[1], t[2]] : t, focal: view.begin.focal });
    if (f.mode === 'ion') { ionScene(f.ion, f.anim); lab.finish('3D laboratoriya', 'Shartli masshtab · qizil — musbat, ko‘k — manfiy ionlar'); }
    else if (f.mode === 'tube') { tubeScene(f.tube, f.anim); lab.finish('3D laboratoriya', 'Trubka uzunligi 40 cm · shu’la rangi gazga bog‘liq'); }
    else if (f.mode === 'spark') { sparkScene(f.spark); lab.finish(f.spark.t, 'Uimshurst mashinasi · sharlar oralig‘i kattalashtirib ko‘rsatilgan'); }
    else if (f.mode === 'arc') { arcScene(f.arc, f.anim); lab.finish('3D laboratoriya', 'Ko‘mirlar oralig‘i kattalashtirib ko‘rsatilgan · reostat — ballast qarshilik'); }
    else { coronaScene(f.cor, f.anim); lab.finish('3D laboratoriya', 'Elektr uzatish liniyasi maketi · doirada — sim kesimi'); coronaHud(ctx, stage, f.cor); }
  }

  return {
    lab, draw,
    /** Rejim almashganda kamera shu tajribaga mos ko'rinishga qaytadi. */
    setMode(m) { if (VIEW[m] && m !== mode) { mode = m; lab.reset(); } },
    /** Yuqori kuchlanish manbai dastasi uchi (f = 0…1) — oxirgi chizilgan kadrdagi joyi. */
    knob: (f) => knobAt(f),
    ballPoint, rodPoint: arcRodPoint,
  };
}
