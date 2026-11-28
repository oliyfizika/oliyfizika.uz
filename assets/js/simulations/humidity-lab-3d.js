// Havo namligi va atmosfera hodisalari — 360° 3D laboratoriya sahnasi (simulations/humidity.html).
// Holat va fizika humidity.js / humidity-physics.js da o'zgarmaydi. Bu yerda faqat asboblar: yopiq shisha idish va
// molekulalar, termometr, soch gigrometri; psixrometr; kondensatsion gigrometr; sutka davomidagi dala (ochiq havo).
// Lupa, tugmalar va matnli ma'lumot — sahna ustidagi tekis qatlam (humidity.js dagi overlay).
// Old tomon −z (kuzatuvchi tomoni), stol usti y = 0.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, dashed, path } from './apparatus-3d.js?v=20261124-n3';
import { ball, glow, shell, hoop } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt } from './sim-kit.js';

const TAU = Math.PI * 2;
const VIEW = {
  air: { begin: { target: [-0.3, 1.0, 0], focal: 2.6 }, camera: { yaw: -0.4, pitch: 0.26, zoom: 1 } },
  psy: { begin: { target: [0.35, 1.3, 0], focal: 2.6 }, camera: { yaw: -0.28, pitch: 0.18, zoom: 1 } },
  cond: { begin: { target: [0.1, 1.05, 0], focal: 2.6 }, camera: { yaw: -0.35, pitch: 0.22, zoom: 1 } },
  atm: { begin: { target: [0, 1.25, 0.6], focal: 1.55, bench: false }, camera: { yaw: -0.3, pitch: 0.16, zoom: 1 } },
};
/** Idish (shisha quti) chegaralari — molekulalar shu hajmda. */
export const BOX = { x0: -2.3, x1: 0.35, y0: 0.06, y1: 1.95, z0: -0.62, z1: 0.62 };
/** Havo termometri (idish ichida): t = −10…40 °C. */
export const AIR_T = { x: 0.12, z: -0.42, y0: 0.42, y1: 1.72, lo: -10, hi: 40 };
export const airTPoint = (t) => [AIR_T.x, AIR_T.y0 + ((clamp(t, AIR_T.lo, AIR_T.hi) - AIR_T.lo) / (AIR_T.hi - AIR_T.lo)) * (AIR_T.y1 - AIR_T.y0), AIR_T.z];
/** Quyosh / Oy yoyi: f = 0 (sharq, chap) … 1 (g'arb, o'ng). */
export const SKY = { R: 3.3, z: 2.2 };
export const sunPoint = (f) => { const a = Math.PI * (1 - clamp(f, 0, 1)); return [Math.cos(a) * SKY.R, 0.05 + Math.sin(a) * SKY.R, SKY.z]; };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function createHumidityLab() {
  const lab = createLab3D();
  let key = 'air', narrow = false;
  lab.reset = () => Object.assign(lab.camera, VIEW[key].camera);
  lab.reset();
  const glass = (c, o = 0.1) => alpha(c.dark ? '#cbd5e1' : '#94a3b8', o);

  /** Shisha termometr: o'q x, z; [y0, y1] — shkala [lo, hi]; T — ko'rsatish. Shkala bo'linmalari va raqamlari bilan. */
  function therm(x, z, y0, y1, T, lo, hi, { major = 10, minor = 1, labels = true, color, wet = false, side = 1 } = {}) {
    const c = lab.colors, col = color || c.danger, Y = (t) => y0 + ((t - lo) / (hi - lo)) * (y1 - y0), yb = y0 - 0.16;
    lab.rod([x, yb, z], [x, y1 + 0.1, z], 0.022, glass(c, 0.3), 10);
    ball(lab, [x, yb, z], 0.045, col, 5);
    lab.rod([x, yb, z], [x, clamp(Y(T), yb, y1 + 0.06), z], 0.009, col, 6);
    for (let t = lo; t <= hi + 1e-9; t += minor) {
      const maj = Math.abs(t / major - Math.round(t / major)) < 1e-6, mid = Math.abs((2 * t) / major - Math.round((2 * t) / major)) < 1e-6, y = Y(t);
      if (!maj && !mid && narrow) continue;
      lab.line([x + side * 0.035, y, z - 0.01], [x + side * (maj ? 0.11 : mid ? 0.085 : 0.06), y, z - 0.01], c.text2, maj ? 1.2 : 0.7);
      if (maj && labels) lab.label(String(t), [x + side * 0.2, y, z - 0.01], c.text2);
    }
    if (wet) { // doka (ho'l mato)
      lab.rod([x, yb - 0.08, z], [x, yb + 0.12, z], 0.07, alpha(c.dark ? '#cbd5e1' : '#e2e8f0', 0.75), 12);
      for (let k = -2; k <= 2; k++) lab.line([x + k * 0.025, yb - 0.08, z - 0.07], [x + k * 0.025, yb + 0.12, z - 0.07], alpha('#94a3b8', 0.8), 0.8);
    }
    return { Y, yb };
  }

  /* -------------------------------------------------- 1) Yopiq idish */
  function airScene(f) {
    const c = lab.colors, a = f.air, s = a.s, B = BOX, W = B.x1 - B.x0, H = B.y1 - B.y0, D = B.z1 - B.z0;
    lab.box(B.x0 - 0.06, 0, B.z0 - 0.06, W + 0.12, 0.06, D + 0.12, c.text3);
    lab.box(B.x0 + 0.02, B.y0, B.z0 + 0.02, W - 0.04, 0.05, D - 0.04, alpha(c.dark ? '#38bdf8' : '#0ea5e9', 0.35));
    // molekulalar (shartli): kulrang — havo, ko'k — bug'
    const pad = 0.1, at = (m, i) => [B.x0 + pad + m.x * (W - 2 * pad), B.y0 + 0.18 + (1 - m.y) * (H - 0.3), B.z0 + pad + hash(i) * (D - 2 * pad)];
    a.airm.forEach((m, i) => ball(lab, at(m, i), 0.028, c.dark ? '#94a3b8' : '#64748b', 3));
    for (let i = 0; i < a.nV; i++) ball(lab, at(a.vapm[i], i + 500), 0.036, c.dark ? '#38bdf8' : '#0284c7', 3);
    if (s.cond > 0) lab.box(B.x0 + 0.01, B.y0 + 0.1, B.z0 + 0.01, W - 0.02, H - 0.11, D - 0.02, alpha(c.dark ? '#e2e8f0' : '#94a3b8', Math.min(0.42, 0.1 + s.cond * 0.07)));
    // devorlardagi tomchilar
    for (let i = 0; i < a.nD; i++) {
      const d = a.drops[i], zz = B.z0 + 0.05 + hash(i + 900) * (D - 0.1), r = d.r * 0.011;
      const p = d.side === 0 ? [B.x0 + r, B.y0 + 0.15 + d.u * (H - 0.3), zz] : d.side === 1 ? [B.x1 - r, B.y0 + 0.15 + d.u * (H - 0.3), zz] : [B.x0 + 0.06 + d.u * (W - 0.12), B.y1 - r, zz];
      ball(lab, p, r, c.dark ? 'rgba(186,230,253,0.95)' : 'rgba(2,132,199,0.85)', 3);
      if (d.side < 2) ball(lab, [p[0], p[1], B.z0 + r], r, c.dark ? 'rgba(186,230,253,0.95)' : 'rgba(2,132,199,0.85)', 3);
    }
    // shisha devorlar va qopqoq
    const gl = glass(c, 0.12);
    lab.face([[B.x0, B.y0, B.z0], [B.x1, B.y0, B.z0], [B.x1, B.y1, B.z0], [B.x0, B.y1, B.z0]], gl);
    lab.face([[B.x0, B.y0, B.z1], [B.x1, B.y0, B.z1], [B.x1, B.y1, B.z1], [B.x0, B.y1, B.z1]], gl);
    for (const x of [B.x0, B.x1]) lab.face([[x, B.y0, B.z0], [x, B.y1, B.z0], [x, B.y1, B.z1], [x, B.y0, B.z1]], gl);
    lab.box(B.x0 - 0.04, B.y1, B.z0 - 0.04, W + 0.08, 0.06, D + 0.08, c.text3);
    for (const [p, q] of [[[B.x0, B.y0, B.z0], [B.x0, B.y1, B.z0]], [[B.x1, B.y0, B.z0], [B.x1, B.y1, B.z0]], [[B.x0, B.y0, B.z1], [B.x0, B.y1, B.z1]], [[B.x1, B.y0, B.z1], [B.x1, B.y1, B.z1]]]) lab.line(p, q, c.text2, 1.6);
    // termometr (qopqoqdan o'tgan); ustun uchi suriladi
    const T = AIR_T;
    lab.rod([T.x, T.y1 + 0.1, T.z], [T.x, B.y1 + 0.1, T.z], 0.03, c.text3, 10);
    therm(T.x, T.z, T.y0, T.y1, a.t, T.lo, T.hi, { major: 10, minor: narrow ? 5 : 1, side: -1 });
    const tip = airTPoint(a.t);
    ball(lab, [tip[0], tip[1], tip[2] - 0.03], 0.05, c.primary, 5);
    lab.handle('therm', tip, 0.2);
    lab.label('t, °C', [T.x, B.y1 + 0.32, T.z], c.text);
    if (narrow) return;
    // soch gigrometri (devorda emas — stol ustidagi kichik asbob)
    const g = [1.4, 1.25, -0.1], R = 0.6;
    lab.box(g[0] - 0.08, 0, g[2] - 0.05, 0.16, 0.05, 0.3, c.text3);
    lab.rod([g[0], 0.05, g[2] + 0.1], [g[0], g[1] - R, g[2] + 0.1], 0.03, c.text3, 8);
    lab.rod([g[0], g[1], g[2] + 0.06], [g[0], g[1], g[2]], R + 0.06, shell(c), 36);
    const A = (fr) => Math.PI * 0.75 + Math.PI * 1.5 * fr, pt = (fr, r, dz = -0.004) => [g[0] + Math.cos(A(fr)) * r, g[1] - Math.sin(A(fr)) * r, g[2] + dz];
    for (const [u, v, col] of [[0, 0.4, '#f59e0b'], [0.4, 0.6, '#22c55e'], [0.6, 1, '#3b82f6']]) for (let i = 0; i < 12; i++) { const f0 = u + ((v - u) * i) / 12, f1 = u + ((v - u) * (i + 1)) / 12; lab.face([pt(f0, R - 0.13), pt(f1, R - 0.13), pt(f1, R - 0.05), pt(f0, R - 0.05)], alpha(col, 0.55)); }
    for (let k = 0; k <= 20; k++) { lab.line(pt(k / 20, R - (k % 2 ? 0.05 : 0.11), -0.006), pt(k / 20, R, -0.006), c.text2, 1); if (k % 10 === 0) lab.label(`${k * 5}`, pt(k / 20, R - 0.24, -0.008), c.text2); }
    lab.rod(pt(0, 0, -0.02), pt(clamp(s.phi, 0, 1), R - 0.06, -0.02), 0.01, c.danger, 6);
    ball(lab, pt(0, 0, -0.025), 0.03, c.text2, 4);
    lab.label('φ, %', [g[0], g[1] - 0.32, g[2] - 0.01], c.text);
    lab.label('soch gigrometri', [g[0], g[1] - R - 0.22, g[2] - 0.05], c.text2);
  }

  /* -------------------------------------------------- 2a) Psixrometr */
  function psyScene(f) {
    const c = lab.colors, p = f.psy, xd = -0.95, xw = -0.25, z = -0.04, y0 = 0.62, y1 = 2.15;
    lab.box(-1.45, 0, -0.25, 1.7, 0.06, 0.5, c.text3);
    lab.box(-1.35, 0.06, 0.02, 1.5, 2.45, 0.07, c.dark ? '#7a5434' : '#c8a37a');
    for (const x of [xd, xw]) for (const y of [0.5, 1.4, 2.2]) lab.rod([x, y, 0.02], [x, y, -0.03], 0.012, c.text3, 6);
    therm(xd, z, y0, y1, p.tdry, 0, 40, { major: 10, minor: 1, side: -1 });
    const wt = therm(xw, z, y0, y1, p.twet, 0, 40, { major: 10, minor: 1, wet: true });
    // pilik va suv idishchasi
    lab.rod([xw, wt.yb - 0.08, z], [xw, 0.2, z], 0.012, alpha('#94a3b8', 0.9), 6);
    lab.box(xw - 0.13, 0.06, z - 0.13, 0.26, 0.24, 0.26, glass(c, 0.25));
    lab.box(xw - 0.12, 0.07, z - 0.12, 0.24, 0.16, 0.24, alpha(c.dark ? '#38bdf8' : '#0ea5e9', 0.4));
    lab.label('quruq', [xd, y1 + 0.32, z], c.text); lab.label('ho‘l', [xw, y1 + 0.32, z], c.text);
    // tanlangan termometr ramkasi va lupa
    const sx = p.sel === 'dry' ? xd : xw, T = p.sel === 'dry' ? p.tdry : p.twet, yT = y0 + (T / 40) * (y1 - y0), zf = z - 0.08;
    for (const [a, b] of [[[sx - 0.3, y0 - 0.34], [sx + 0.3, y0 - 0.34]], [[sx + 0.3, y0 - 0.34], [sx + 0.3, y1 + 0.2]], [[sx + 0.3, y1 + 0.2], [sx - 0.3, y1 + 0.2]], [[sx - 0.3, y1 + 0.2], [sx - 0.3, y0 - 0.34]]]) dashed(lab, [...a, zf], [...b, zf], c.primary, 1.8);
    const lc = [sx, yT, -0.42];
    for (let i = 0; i < 32; i++) { const a0 = (i * TAU) / 32, a1 = ((i + 1) * TAU) / 32; lab.rod([lc[0] + Math.cos(a0) * 0.2, lc[1] + Math.sin(a0) * 0.2, lc[2]], [lc[0] + Math.cos(a1) * 0.2, lc[1] + Math.sin(a1) * 0.2, lc[2]], 0.018, c.dark ? '#94a3b8' : '#475569', 6); }
    lab.face(Array.from({ length: 32 }, (_, i) => [lc[0] + Math.cos((i * TAU) / 32) * 0.19, lc[1] + Math.sin((i * TAU) / 32) * 0.19, lc[2]]), alpha('#bfdbfe', 0.18));
    lab.rod([lc[0] + 0.14, lc[1] - 0.14, lc[2]], [lc[0] + 0.42, lc[1] - 0.48, lc[2] - 0.05], 0.03, c.dark ? '#a16207' : '#78350f', 10);
    lab.handle('dry', [xd, (y0 + y1) / 2, z], 0.3); lab.handle('wet', [xw, (y0 + y1) / 2, z], 0.3);
  }

  /* -------------------------------------------------- 2b) Kondensatsion gigrometr */
  function condScene(f) {
    const c = lab.colors, p = f.psy, cx = -0.55, cz = 0, r = 0.36, yb = 0.32, yt = 1.42, n = 32;
    lab.box(cx - 0.55, 0, cz - 0.45, 1.1, 0.06, 0.9, c.text3);
    for (const dx of [-0.3, 0.3]) lab.rod([cx + dx, 0.06, cz], [cx + dx, yb, cz], 0.025, c.text3, 8);
    lab.rod([cx, yb, cz], [cx, yt, cz], r, c.dark ? '#cbd5e1' : '#e2e8f0', n);
    const fy0 = yb + (yt - yb) * 0.3, fy1 = yb + (yt - yb) * 0.72;
    for (const y of [fy0 - 0.05, fy1]) lab.rod([cx, y, cz], [cx, y + 0.05, cz], r + 0.006, c.dark ? '#facc15' : '#d4a017', n);
    if (p.dew > 0.03) { // sayqallangan sirt xiralashadi — shudring
      const fog = `rgba(100,116,139,${Math.min(0.55, p.dew * 0.7)})`;
      for (let i = 0; i < n; i++) { const a0 = Math.PI + (i * Math.PI) / n, a1 = Math.PI + ((i + 1) * Math.PI) / n, rr = r + 0.008; lab.face([[cx + Math.cos(a0) * rr, fy0, cz + Math.sin(a0) * rr], [cx + Math.cos(a1) * rr, fy0, cz + Math.sin(a1) * rr], [cx + Math.cos(a1) * rr, fy1, cz + Math.sin(a1) * rr], [cx + Math.cos(a0) * rr, fy1, cz + Math.sin(a0) * rr]], fog); }
      const drops = Math.round(70 * Math.min(1, p.dew));
      for (let i = 0; i < drops; i++) { const a = Math.PI * 1.1 + hash(i) * Math.PI * 0.8, y = fy0 + 0.03 + hash(i + 50) * (fy1 - fy0 - 0.06); ball(lab, [cx + Math.cos(a) * (r + 0.012), y, cz + Math.sin(a) * (r + 0.012)], 0.008 + (i % 3) * 0.004, 'rgba(241,245,249,0.95)', 3); }
    }
    lab.rod([cx, yt, cz], [cx, yt + 0.05, cz], r * 0.9, c.text3, n);
    // termometr (idish ichiga tushirilgan)
    therm(cx + 0.12, cz - 0.05, yt + 0.05, yt + 0.95, p.can, -10, 40, { major: 10, minor: narrow ? 5 : 1 });
    // nok va shlang
    const bx = -1.7, by = 0.32, pr = p.pump ? 0.17 : 0.21;
    path(lab, [[cx - 0.2, yt + 0.05, cz], [cx - 0.2, yt + 0.35, cz], [cx - 0.6, yt + 0.45, cz - 0.1], [bx + 0.15, by + 0.6, -0.1], [bx + 0.05, by + pr, -0.1]], c.text3, 0.022);
    lab.sphere([bx, by, -0.1], pr, p.pump ? '#b91c1c' : '#ef4444');
    lab.handle('bulb', [bx, by, -0.1], 0.3);
    if (p.pump) for (let i = 0; i < 6; i++) { const ph = (p.time * 0.7 + i / 6) % 1; ball(lab, [cx - 0.2 + Math.sin(i * 2 + p.time * 5) * 0.03, yt + 0.06 + ph * 0.25, cz - 0.02], 0.02, alpha('#ffffff', 0.8 * (1 - ph)), 3); }
    lab.label(p.pump ? 'puflanmoqda' : 'nokni bosing', [bx, 0.02, -0.5], p.pump ? c.danger : c.text2);
    if (!narrow) lab.label('sayqallangan idish (efir)', [cx, 0.02, cz - 0.62], c.text2);
  }

  /* -------------------------------------------------- 3) Dala: sutka davomida */
  function atmScene(ctx, stage, f) {
    const c = lab.colors, a = f.atm, s = a.s, day = a.day, mix = (p, q) => p.map((v, i) => Math.round(v + (q[i] - v) * day));
    const nTop = c.dark ? [8, 15, 35] : [15, 30, 70], dTop = [96, 165, 250], nBot = c.dark ? [30, 41, 59] : [51, 65, 105], dBot = [219, 234, 254];
    const sky = ctx.createLinearGradient(0, 0, 0, stage.h);
    sky.addColorStop(0, `rgb(${mix(nTop, dTop).join(',')})`); sky.addColorStop(0.75, `rgb(${mix(nBot, dBot).join(',')})`); sky.addColorStop(1, `rgb(${mix(nBot, dBot).join(',')})`);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, stage.w, stage.h);
    if (!a.sunUp) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 40; i++) ctx.fillRect(hash(i) * stage.w, hash(i + 70) * stage.h * 0.45, 1.5, 1.5); }
    // yer: o'tli dala (doira)
    const G = 4.2, n = 48, ring = (r, y) => Array.from({ length: n }, (_, i) => [Math.cos((i * TAU) / n) * r, y, 0.6 + Math.sin((i * TAU) / n) * r]);
    const top = ring(G, 0), bot = ring(G, -0.25), green = c.dark ? '#166534' : '#4d7c0f';
    lab.face(top, green); for (let i = 0; i < n; i++) lab.face([top[i], top[(i + 1) % n], bot[(i + 1) % n], bot[i]], c.dark ? '#3f2d1d' : '#78543a');
    const blade = s.frost ? '#e0f2fe' : c.dark ? '#22c55e' : '#65a30d';
    for (let i = 0; i < 170; i++) {
      const rr = Math.sqrt(hash(i)) * (G - 0.2), an = hash(i + 300) * TAU, x = Math.cos(an) * rr, z = 0.6 + Math.sin(an) * rr, hgt = 0.08 + hash(i + 600) * 0.08;
      for (const d of [-1, 0, 1]) lab.line([x + d * 0.02, 0.002, z], [x + d * 0.05, hgt, z + d * 0.01], blade, 1.2);
      if (s.dew && i % 2 === 0) ball(lab, [x + 0.03, hgt * 0.8, z - 0.01], 0.014, 'rgba(186,230,253,0.95)', 3);
    }
    if (s.frost) lab.face(ring(G - 0.02, 0.012), 'rgba(240,249,255,0.5)');
    // daraxt va meteostansiya (termometr budkasi)
    lab.rod([2.1, 0, 1.6], [2.1, 0.9, 1.6], 0.07, c.dark ? '#78350f' : '#92400e', 10);
    for (const [dx, dy, dz, r] of [[0, 1.25, 0, 0.45], [-0.28, 1.0, -0.1, 0.32], [0.3, 1.02, 0.05, 0.32]]) ball(lab, [2.1 + dx, dy, 1.6 + dz], r, c.dark ? '#15803d' : '#22c55e', 6);
    const mx = -2.1, mz = -0.4;
    for (const dx of [-0.2, 0.2]) for (const dz of [-0.15, 0.15]) lab.rod([mx + dx, 0, mz + dz], [mx + dx, 0.85, mz + dz], 0.018, '#e2e8f0', 6);
    lab.box(mx - 0.28, 0.85, mz - 0.22, 0.56, 0.48, 0.44, '#f8fafc');
    for (let k = 1; k < 8; k++) lab.line([mx - 0.27, 0.85 + k * 0.06, mz - 0.225], [mx + 0.27, 0.85 + k * 0.06, mz - 0.225], '#cbd5e1', 1);
    lab.box(mx - 0.32, 1.33, mz - 0.26, 0.64, 0.04, 0.52, '#e2e8f0');
    lab.label(`${fmt(s.t, 1)} °C`, [mx, 1.6, mz], c.dark ? '#0f172a' : '#0f172a');
    // quyosh / oy yoyi
    const arc = Array.from({ length: 41 }, (_, i) => sunPoint(i / 40));
    for (let i = 1; i < arc.length; i += 2) lab.line(arc[i - 1], arc[i], 'rgba(255,255,255,0.35)', 1);
    const sp = sunPoint(a.f);
    if (a.sunUp) { lab.sphere(sp, 0.24, '#fbbf24'); glow(lab, sp, 0.75, [251, 191, 36], 0.45, 6); }
    else { lab.sphere(sp, 0.19, '#e2e8f0'); glow(lab, sp, 0.4, [226, 232, 240], 0.25, 4); }
    lab.handle('sun', sp, 0.4);
    // to'p-to'p bulut va uning asosi
    const kH = 2.7 / 3000;
    if (a.conv) {
      const yb = 0.05 + a.base * kH, cxp = 0.9, cz = 1.2, white = c.dark ? 'rgba(226,232,240,0.92)' : 'rgba(255,255,255,0.96)';
      for (const [dx, dy, dz, r] of [[0, 0.32, 0, 0.36], [-0.38, 0.2, 0.05, 0.27], [0.38, 0.2, -0.05, 0.27], [-0.16, 0.5, 0.1, 0.26], [0.2, 0.52, 0, 0.24], [0, 0.16, -0.25, 0.22]]) ball(lab, [cxp + dx, yb + dy, cz + dz], r, white, 7);
      dashed(lab, [cxp, 0.02, cz], [cxp, yb, cz], 'rgba(251,146,60,0.9)', 1.6);
      lab.label(`bulut asosi ≈ ${fmt(a.base, 0)} m`, [cxp + 0.95, yb + 0.05, cz], '#0f172a');
    }
    if (!narrow) for (let hh = 0; hh <= 3000; hh += 500) { const y = 0.05 + hh * kH; lab.line([3.6, y, 2.0], [3.75, y, 2.0], 'rgba(255,255,255,0.7)', 1); if (hh) lab.label(`${String(hh / 1000).replace(".", ",")} km`, [3.95, y, 2.0], c.text2); }
    if (!narrow) lab.line([3.6, 0, 2.0], [3.6, 0.05 + 3000 * kH, 2.0], 'rgba(255,255,255,0.6)', 1);
    // tuman: yerga yaqin oq qatlamlar
    if (s.fog) { const fh = 0.25 + Math.min(0.6, s.cond * 0.4); for (let k = 0; k < 5; k++) lab.face(ring(G - 0.05, 0.03 + (fh * k) / 5), `rgba(226,232,240,${0.38 - k * 0.06})`); }
  }

  /**
   * f.mode: 'air' | 'psy' | 'cond' | 'atm' — humidity.js tayyorlagan qiymatlar; f.overlay(ctx, stage) — tekis qatlam.
   */
  function draw(ctx, stage, f) {
    const m = VIEW[f.mode] ? f.mode : 'air';
    if (m !== key) { key = m; lab.reset(); }
    narrow = stage.w < 560;
    const v = VIEW[m].begin, shift = narrow && (m === 'psy' || m === 'cond') ? 0.6 : 0; // tor ekranda asbob chapga — o'ngda lupa
    lab.begin(ctx, stage, shift ? { ...v, target: [v.target[0] + shift, v.target[1], v.target[2]] } : v);
    if (m === 'air') airScene(f);
    else if (m === 'psy') psyScene(f);
    else if (m === 'cond') condScene(f);
    else atmScene(ctx, stage, f);
    lab.finish(m === 'atm' ? '3D dala' : '3D laboratoriya', m === 'atm' ? (narrow ? 'Quyosh/Oyni suring' : 'Quyosh yoki Oyni yoy bo‘ylab suring · o‘lchamlar shartli') : narrow ? 'Bo‘sh joydan suring — kamera' : 'Bo‘sh joydan sudrang — kamera aylanadi');
    f.overlay?.(ctx, stage, narrow);
  }
  return { lab, draw, airTPoint, sunPoint, get narrow() { return narrow; } };
}
