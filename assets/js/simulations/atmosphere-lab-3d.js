// Atmosfera bosimi — 360° 3D laboratoriya sahnasi (simulations/atmosphere.html).
// Holat va fizika atmosphere.js / atmosphere-physics.js da o'zgarmaydi. Bu yerda faqat sahna: Torichelli nayi va idish,
// chizg'ich, aneroid; Magdeburg yarim sharlari, nasos, vakuummetr va otlar (o'quvchilar); tog'lar va havo shari.
// Tugmalar va asboblar kartochkasi — sahna ustidagi tekis qatlam (atmosphere.js dagi overlay).
// Old tomon −z (kuzatuvchi tomoni), stol (yoki yer) usti y = 0.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, arrowSolid, dashed, path } from './apparatus-3d.js?v=20261124-n3';
import { ball } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt } from './sim-kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const VIEW = {
  torr: { begin: { target: [0.2, 1.4, 0], focal: 2.45 }, camera: { yaw: -0.32, pitch: 0.16, zoom: 1 } },
  mag: { begin: { target: [0, 0.85, 0], focal: 1.5, bench: false }, camera: { yaw: -0.22, pitch: 0.2, zoom: 1 } },
  alt: { begin: { target: [0.2, 1.6, 1.2], focal: 1.4, bench: false }, camera: { yaw: -0.25, pitch: 0.14, zoom: 1 } },
};
/** Torichelli: idishdagi suyuqlik sathi va nayning to'liq balandligi (sahna birligida). */
export const TORR = { surf: 0.3, H: 2.35 };
export const tubeTip = (tilt, ext = 0.07) => { const a = tilt * DEG; return [Math.sin(a) * (TORR.H + ext), TORR.surf + Math.cos(a) * (TORR.H + ext), 0]; };
/** Nasos dastagi: handle = 0 (pastda) … 1 (tepada). */
export const PUMP = { x: -1.1, z: -1.25, top: 0.9 };
export const pumpPoint = (f) => [PUMP.x, PUMP.top + 0.12 + clamp(f, 0, 1) * 0.55, PUMP.z];
/** Balandlik: 0…12 km → 0…3,3 birlik; havo shari shu tik chiziq bo'ylab. */
export const ALT = { k: 3.3 / 12000, x: -2.1, z: -0.4 };
export const balloonPoint = (h) => [ALT.x, 0.12 + clamp(h, 0, 12000) * ALT.k + 0.42, ALT.z];
const COATS = [['#a8693a', '#5c3417', '#22150b'], ['#bd7339', '#743d17', '#8a4a1c'], ['#71472a', '#3a2314', '#1a110a'], ['#d6d1c8', '#8f897f', '#5f5a52']];
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function createAtmosphereLab() {
  const lab = createLab3D();
  let key = 'torr', narrow = false;
  lab.reset = () => Object.assign(lab.camera, VIEW[key].camera);
  lab.reset();

  function cone(base, tip, r, color, n = 18) {
    const ring = Array.from({ length: n }, (_, i) => [base[0] + r * Math.cos((i * TAU) / n), base[1], base[2] + r * Math.sin((i * TAU) / n)]);
    for (let i = 0; i < n; i++) lab.face([ring[i], ring[(i + 1) % n], tip], color);
  }
  /** Dumaloq strelkali asbob (old yuzi −z): [lo, hi] shkala 270° yoyda. */
  function gauge(cen, R, val, lo, hi, step, labelStep, unit) {
    const c = lab.colors, A = (v) => Math.PI * 0.75 + ((v - lo) / (hi - lo)) * Math.PI * 1.5, at = (v, r, dz = -0.006) => [cen[0] + Math.cos(A(v)) * r, cen[1] - Math.sin(A(v)) * r, cen[2] + dz];
    lab.rod([cen[0], cen[1], cen[2]], [cen[0], cen[1], cen[2] + 0.08], R + 0.05, c.dark ? '#ca8a04' : '#a16207', 32);
    lab.face(Array.from({ length: 32 }, (_, i) => [cen[0] + Math.cos((i * TAU) / 32) * R, cen[1] + Math.sin((i * TAU) / 32) * R, cen[2] - 0.004]), c.dark ? '#1e293b' : '#fffbeb');
    for (let v = lo; v <= hi + 1e-9; v += step / 5) { const maj = Math.abs(v / step - Math.round(v / step)) < 1e-6; lab.line(at(v, R * (maj ? 0.8 : 0.88)), at(v, R * 0.97), c.dark ? '#cbd5e1' : '#334155', maj ? 1.3 : 0.7); }
    if (!narrow || R > 0.3) for (let v = lo; v <= hi + 1e-9; v += labelStep) lab.label(String(Math.round(v)), at(v, R * 0.62, -0.008), c.dark ? c.text : '#1e293b');
    lab.rod(at(lo + (hi - lo) * 0, 0, -0.02), at(clamp(val, lo, hi), R * 0.86, -0.02), 0.009, '#b91c1c', 6);
    ball(lab, [cen[0], cen[1], cen[2] - 0.025], 0.025, c.dark ? '#94a3b8' : '#334155', 3);
    if (unit) lab.label(unit, [cen[0], cen[1] - (R < 0.45 ? R + 0.1 : R * 0.55), cen[2] - 0.01], c.dark ? c.text2 : '#475569');
  }
  function sky(ctx, stage, dark) {
    const c = lab.colors, g = ctx.createLinearGradient(0, 0, 0, stage.h);
    g.addColorStop(0, c.dark ? '#020617' : dark ? '#1e3a8a' : '#60a5fa'); g.addColorStop(0.55, c.dark ? '#1e3a8a' : dark ? '#3b82f6' : '#bfdbfe'); g.addColorStop(1, c.dark ? '#1e40af' : '#dbeafe');
    ctx.fillStyle = g; ctx.fillRect(0, 0, stage.w, stage.h);
  }

  /* -------------------------------------------------- 1) Torichelli */
  function torr(f) {
    const c = lab.colors, t = f.torr, Lt = t.Lt, U = TORR.H / Lt, a = t.tilt * DEG, u = [Math.sin(a), Math.cos(a), 0], S = TORR.surf;
    const lc = t.water ? [c.dark ? '#38bdf8' : '#0ea5e9', 0.55] : ['#cbd5e1', 1];
    const along = (d) => [u[0] * d, S + u[1] * d, 0];
    // idish: shisha vanna va suyuqlik
    lab.box(-0.75, 0, -0.5, 1.5, 0.04, 1.0, c.text3);
    lab.box(-0.7, 0.04, -0.45, 1.4, S - 0.04, 0.9, alpha(lc[0], t.water ? 0.4 : 0.95));
    for (const z of [-0.47, 0.47]) lab.face([[-0.72, 0.04, z], [0.72, 0.04, z], [0.72, S + 0.2, z], [-0.72, S + 0.2, z]], alpha(c.dark ? '#cbd5e1' : '#94a3b8', 0.14));
    for (const x of [-0.72, 0.72]) lab.face([[x, 0.04, -0.47], [x, 0.04, 0.47], [x, S + 0.2, 0.47], [x, S + 0.2, -0.47]], alpha(c.dark ? '#cbd5e1' : '#94a3b8', 0.14));
    // atmosfera bosimi strelkalari
    for (const x of [-0.45, 0.45]) { arrowSolid(lab, [x, S + 0.45, -0.2], [x, S + 0.03, -0.2], c.primary, 0.014); lab.label('p₀', [x + 0.14, S + 0.38, -0.2], c.primary); }
    // chizg'ich
    const rx = -1.25, rz = 0.05;
    lab.box(rx - 0.02, 0, rz, 0.26, S + TORR.H + 0.12, 0.04, c.dark ? '#7a5434' : '#fef3c7');
    if (t.water) { for (let m = 0; m <= 12; m += 0.5) { const y = S + m * U, maj = m % 2 === 0; lab.line([rx, y, rz - 0.003], [rx + (maj ? 0.1 : 0.05), y, rz - 0.003], c.dark ? '#e7e5e4' : '#78350f', maj ? 1.2 : 0.7); if (maj && (!narrow || m % 4 === 0)) lab.label(`${m} m`, [rx - 0.17, y, rz - 0.01], c.text2); } }
    else {
      for (let v = 0; v <= 1000; v += 10) { const y = S + (v / 1000) * TORR.H, maj = v % 100 === 0, mid = v % 50 === 0; if (narrow && !mid) continue; lab.line([rx, y, rz - 0.003], [rx + (maj ? 0.11 : mid ? 0.07 : 0.04), y, rz - 0.003], c.dark ? '#e7e5e4' : '#78350f', maj ? 1.2 : 0.6); if (maj && (!narrow || v % 200 === 0)) lab.label(String(v), [rx - 0.15, y, rz - 0.01], c.text2); }
      lab.label('mm', [rx + 0.1, S + TORR.H + 0.28, rz], c.text2);
    }
    // nay: shisha va suyuqlik ustuni
    const L = TORR.H, cl = clamp(t.col * U, 0, L), tw = 0.045;
    lab.rod(along(-0.12), along(L), tw, alpha(c.dark ? '#e2e8f0' : '#94a3b8', 0.28), 14);
    ball(lab, along(L), tw, alpha(c.dark ? '#e2e8f0' : '#94a3b8', 0.28), 5);
    lab.rod(along(-0.12), along(cl), tw * 0.78, lc[0], 14);
    if (!t.hole && !t.full && cl < L - 0.12) lab.label(narrow ? 'vakuum' : 'Torichelli bo‘shlig‘i (vakuum)', [...along((cl + L) / 2).slice(0, 2).map((v, i) => v + (i ? 0 : 0.6)), 0], c.text2);
    if (t.hole) { ball(lab, along(L + 0.01), 0.018, c.bg, 3); arrowSolid(lab, [along(L)[0], along(L)[1] + 0.35, 0], [along(L)[0], along(L)[1] + 0.08, 0], c.primary, 0.01); }
    const tip = tubeTip(t.tilt);
    ball(lab, tip, 0.05, c.primary, 5);
    lab.handle('tip', tip, 0.22);
    // ustun balandligi chizig'i
    if (t.col > 0.01) {
      const yh = S + Math.min(t.col * Math.cos(a), t.hv) * U, x1 = Math.max(u[0] * cl + 0.35, 0.5);
      dashed(lab, [rx, yh, -0.06], [x1, yh, -0.06], c.warning, 1.6);
      lab.label(t.water ? `h = ${fmt(t.col * Math.cos(a), 2)} m` : `h = ${fmt(t.col * Math.cos(a) * 1000, 0)} mm`, [x1 + 0.38, yh, -0.06], c.warning);
    }
    if (t.water) { // 4 qavatli bino (masshtab)
      const bx = 1.2, bw = 1.3;
      lab.box(bx, 0, 0.3, bw, S + 12 * U, 0.9, c.dark ? '#334155' : '#cbd5e1');
      for (let fl = 1; fl <= 4; fl++) { const y = S + fl * 3 * U; lab.line([bx, y, 0.298], [bx + bw, y, 0.298], c.border, 1); for (let k = 0; k < 3; k++) lab.face([[bx + 0.12 + k * 0.4, y - 0.55, 0.296], [bx + 0.38 + k * 0.4, y - 0.55, 0.296], [bx + 0.38 + k * 0.4, y - 0.2, 0.296], [bx + 0.12 + k * 0.4, y - 0.2, 0.296]], alpha(c.dark ? '#7dd3fc' : '#0ea5e9', 0.35)); }
      if (!narrow) lab.label('4 qavatli bino (12 m)', [bx + bw / 2, S + 0.2, 0.29], c.text3);
    } else if (!narrow) {
      // aneroid barometr (stol ustida)
      const g = [1.55, 1.05, -0.2];
      lab.box(g[0] - 0.25, 0, g[2] - 0.05, 0.5, 0.06, 0.4, c.text3); lab.rod([g[0], 0.06, g[2] + 0.12], [g[0], g[1] - 0.4, g[2] + 0.12], 0.03, c.text3, 8);
      gauge(g, 0.56, t.mmHg, 400, 800, 50, 100, 'mm sim. ust.');
      lab.label('aneroid barometr', [g[0], g[1] - 0.78, g[2] - 0.02], c.text2);
    }
  }

  /* -------------------------------------------------- 2) Magdeburg */
  function horse(x, dir, phase, pulling, coat, z) {
    const [hi, lo, mane] = COATS[coat % COATS.length], sw = pulling ? Math.sin(phase) : 0, lean = pulling ? 0.1 : 0, P = (dx, y, dz = 0) => [x + dir * dx, y, z + dz];
    lab.rod(P(-0.45, 0.9), P(0.35, 0.92 - lean * 0.3), 0.21, hi, 14);
    ball(lab, P(-0.45, 0.9), 0.21, hi, 6); ball(lab, P(0.35, 0.92 - lean * 0.3), 0.22, hi, 6);
    lab.rod(P(0.42, 1.0 - lean * 0.3), P(0.62, 1.38 - lean), 0.1, hi, 10);
    lab.rod(P(0.62, 1.38 - lean), P(0.85, 1.2 - lean), 0.075, lo, 10);
    path(lab, [P(0.4, 1.12 - lean * 0.3), P(0.6, 1.46 - lean)], mane, 0.035);
    path(lab, [P(-0.62, 0.98), P(-0.75, 0.75), P(-0.72, 0.5)], mane, 0.03);
    for (const [dx, dz, s] of [[0.3, -0.11, sw], [0.3, 0.11, -sw], [-0.4, -0.11, -sw], [-0.4, 0.11, sw]]) {
      const front = dx > 0, kick = pulling ? (front ? 0.12 : -0.14) + 0.05 * s : 0, knee = P(dx + kick * 0.5, 0.42, dz), hoof = P(dx + kick, 0.03, dz);
      lab.rod(P(dx, 0.82, dz), knee, 0.055, lo, 8); lab.rod(knee, hoof, 0.04, lo, 8); lab.box(...hoof.map((v, i) => v - [0.05, 0.03, 0.05][i]), 0.1, 0.05, 0.1, '#24201c');
    }
    ball(lab, P(0.83, 1.27 - lean, -0.05), 0.018, '#120c08', 3); ball(lab, P(0.83, 1.27 - lean, 0.05), 0.018, '#120c08', 3);
    lab.rod(P(0.45, 1.15 - lean * 0.3, -0.16), P(0.45, 0.82, -0.16), 0.03, '#33241a', 6); lab.rod(P(0.45, 1.15 - lean * 0.3, 0.16), P(0.45, 0.82, 0.16), 0.03, '#33241a', 6);
    return { collar: P(0.45, 0.85), tail: P(-0.74, 0.62) };
  }
  function person(x, dir, pulling, z) {
    const c = lab.colors, lean = pulling ? 0.14 * dir : 0, col = c.dark ? '#cbd5e1' : '#334155';
    lab.rod([x - 0.06 * dir, 0, z], [x, 0.42, z], 0.03, col, 6); lab.rod([x + 0.1 * dir, 0, z], [x, 0.42, z], 0.03, col, 6);
    lab.rod([x, 0.42, z], [x + lean, 0.78, z], 0.05, c.dark ? '#60a5fa' : '#2563eb', 8);
    ball(lab, [x + lean * 1.25, 0.9, z], 0.08, '#e9b78f', 5);
    path(lab, [[x + lean, 0.72, z], [x - 0.16 * dir, 0.6, z]], col, 0.022);
    return [x - 0.18 * dir, 0.6, z];
  }
  function mag(ctx, stage, f) {
    const c = lab.colors, m = f.mag, big = m.big, R = big ? 0.32 : 0.13, cy = big ? 0.62 : 0.6, gap = m.sep * (big ? 0.8 : 0.5), pulling = m.pull > 0;
    sky(ctx, stage, false);
    lab.box(-4.8, -0.2, -1.6, 9.6, 0.2, 3.4, c.dark ? '#14532d' : '#86efac');
    for (let i = 0; i < 110; i++) { const x = -4.6 + hash(i) * 9.2, z = -1.5 + hash(i + 40) * 3.2; lab.line([x, 0.002, z], [x + 0.03, 0.09, z], c.dark ? '#22c55e' : '#65a30d', 1); }
    // yarim sharlar (mis) va halqalar
    for (const dir of [-1, 1]) {
      const cx = dir * gap / 2, n = 24;
      for (let i = 0; i < 12; i++) for (let j = 0; j < n; j++) {
        const th0 = (i * Math.PI) / 24, th1 = ((i + 1) * Math.PI) / 24, p0 = (j * TAU) / n, p1 = ((j + 1) * TAU) / n;
        const q = (th, p) => [cx + dir * R * Math.cos(th), cy + R * Math.sin(th) * Math.cos(p), R * Math.sin(th) * Math.sin(p)];
        lab.face([q(Math.PI / 2 - th0, p0), q(Math.PI / 2 - th1, p0), q(Math.PI / 2 - th1, p1), q(Math.PI / 2 - th0, p1)], c.dark ? '#f59e0b' : '#d97706');
      }
      lab.rod([cx, cy, 0], [cx + dir * 0.025, cy, 0], R + 0.04, '#92400e', 24);
      lab.rod([cx + dir * R, cy, 0], [cx + dir * (R + 0.08), cy, 0], 0.02, '#78350f', 6);
      for (let i = 0; i < 16; i++) { const a0 = (i * TAU) / 16, a1 = ((i + 1) * TAU) / 16, rr = 0.06; lab.rod([cx + dir * (R + 0.14) + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, 0], [cx + dir * (R + 0.14) + Math.cos(a1) * rr, cy + Math.sin(a1) * rr, 0], 0.014, '#78350f', 5); }
    }
    // havo bosimi strelkalari (Δp ga proporsional)
    const dp = (101325 - m.p) / 101325;
    if (dp > 0.02 && m.sep < 0.05) { const L = 0.08 + 0.3 * dp; for (let k = 0; k < 12; k++) { const an = (k / 12) * TAU + 0.26, rr = R + 0.12, p = [Math.cos(an) * (rr + L), cy + Math.sin(an) * (rr + L), -0.05]; if (p[1] < 0.05) continue; arrowSolid(lab, p, [Math.cos(an) * rr, cy + Math.sin(an) * rr, -0.05], c.primary, 0.008); } }
    // jo'mrak
    const vx = -gap / 2 - R * 0.35, vy = cy + R * 0.94;
    lab.rod([vx, vy - 0.04, 0], [vx, vy + 0.12, 0], 0.025, '#64748b', 8);
    lab.rod(m.valve ? [vx, vy + 0.14, -0.05] : [vx - 0.1, vy + 0.14, 0], m.valve ? [vx, vy + 0.14, 0.05] : [vx + 0.1, vy + 0.14, 0], 0.016, m.valve ? c.danger : '#334155', 6);
    // tortuvchilar va arqonlar
    const nDraw = big ? (narrow ? 1 : 3) : Math.min(m.team, narrow ? 3 : 5), shift = pulling ? 0.08 : 0;
    for (const dir of [-1, 1]) {
      const hook = [dir * (gap / 2 + R + 0.2), cy, 0];
      if (dir > 0 && m.tree) {
        const tx = 3.6; lab.rod([tx, 0, 0], [tx, 1.6, 0], 0.12, '#78350f', 10);
        for (const [dx, dy, r] of [[0, 2.0, 0.6], [-0.4, 1.7, 0.4], [0.4, 1.7, 0.42]]) ball(lab, [tx + dx, dy, 0], r, c.dark ? '#166534' : '#22c55e', 6);
        path(lab, [hook, [tx - 0.1, cy, 0]], pulling ? '#a16207' : '#ca8a04', 0.014);
        continue;
      }
      if (big) {
        const sp = 1.75, x0 = hook[0] + dir * (0.35 + shift + 0.74);
        let prev = hook;
        for (let i = 0; i < nDraw; i++) { const hs = horse(x0 + dir * i * sp, dir, f.t * 11 + i * 1.7, pulling, i + (dir > 0 ? 1 : 0), 0); path(lab, [prev, hs.tail], i ? '#33241a' : pulling ? '#a16207' : '#ca8a04', i ? 0.012 : 0.016); prev = hs.collar; }
        if (m.team > nDraw) lab.label(`${m.team} ta ot`, [x0 + dir * ((nDraw - 1) * sp) / 2, 1.85, 0], c.text);
      } else {
        const sp = 0.42, x0 = hook[0] + dir * 0.6;
        let last = hook;
        for (let i = 0; i < nDraw; i++) last = person(x0 + dir * (i * sp + shift), dir, pulling, (i % 2 ? 0.12 : -0.12));
        path(lab, [hook, [hook[0] + dir * 0.3, pulling ? cy : 0.45, 0], last], pulling ? '#a16207' : '#ca8a04', 0.012);
        if (m.team > nDraw) lab.label(`× ${m.team}`, [x0 + dir * (nDraw * sp + 0.25), 1.05, 0], c.text);
      }
    }
    // nasos (dastagi sahnada suriladi) va vakuummetr
    const pp = PUMP, hp = pumpPoint(m.handle);
    lab.box(pp.x - 0.3, 0, pp.z - 0.2, 0.6, 0.05, 0.4, '#334155');
    lab.rod([pp.x, 0.05, pp.z], [pp.x, pp.top, pp.z], 0.1, c.dark ? '#94a3b8' : '#cbd5e1', 18);
    lab.rod([pp.x, pp.top, pp.z], [pp.x, hp[1], pp.z], 0.018, '#94a3b8', 8);
    lab.rod([pp.x - 0.22, hp[1], pp.z], [pp.x + 0.22, hp[1], pp.z], 0.035, '#78350f', 10);
    lab.handle('handle', hp, 0.25);
    path(lab, [[pp.x + 0.1, 0.25, pp.z], [pp.x + 0.3, 0.06, pp.z + 0.3], [vx - 0.1, 0.06, -0.5], [vx - 0.1, vy + 0.4, -0.2], [vx, vy + 0.12, 0]], c.dark ? '#94a3b8' : '#475569', 0.02);
    lab.label(`nasos: ${m.n} yurish`, [pp.x, 0.02, pp.z - 0.42], c.text2);
    const gc = [pp.x - 0.62, 0.78, pp.z - 0.05];
    lab.rod([gc[0], 0, gc[2] + 0.06], [gc[0], gc[1] - 0.25, gc[2] + 0.06], 0.025, c.text3, 6);
    gauge(gc, 0.36, m.p / 1000, 0, 100, 20, 50, 'kPa');
  }

  /* -------------------------------------------------- 3) Balandlik */
  function alt(ctx, stage, f) {
    const c = lab.colors, k = ALT.k, h0 = 455 * k, base = 0.12;
    sky(ctx, stage, true);
    lab.box(-4.6, -0.25, -1.6, 9.2, 0.25 + base, 5.2, c.dark ? '#14532d' : '#4d7c0f');
    lab.box(-4.6, base, -1.6, 3.0, h0, 2.4, c.dark ? '#166534' : '#65a30d');
    for (let i = 0; i < 6; i++) lab.box(-4.1 + i * 0.32, base + h0, -1.2 + (i % 2) * 0.3, 0.2, 0.12 + ((i * 7) % 5) * 0.06, 0.2, c.dark ? '#475569' : '#e2e8f0');
    const peaks = [[0.2, 2.2, 3309, 0.9, 'Katta Chimyon'], [1.9, 2.9, 7495, 1.2, 'Ismoil Somoniy'], [3.4, 2.4, 8849, 1.15, 'Everest'], [1.0, 3.3, 5200, 1.1, ''], [2.7, 3.6, 6000, 1.1, ''], [-0.9, 3.0, 1800, 0.9, '']];
    for (const [x, z, hm, r, name] of peaks) {
      const top = [x, base + hm * k, z];
      cone([x, base, z], top, r, c.dark ? '#334155' : '#64748b');
      if (hm > 5000) { const f2 = 0.3; cone([x, base + hm * k * (1 - f2), z], [x, top[1] + 0.005, z], r * f2 + 0.005, '#f8fafc'); }
      if (name && !narrow) lab.label(`${name} ${fmt(hm, 0)} m`, [x, top[1] + 0.2, z], '#0f172a');
    }
    // samolyot
    const ay = base + 10500 * k, ax = 0.2, az = 0.6;
    lab.rod([ax - 0.35, ay, az], [ax + 0.35, ay, az], 0.045, '#f8fafc', 10);
    lab.face([[ax - 0.05, ay, az - 0.45], [ax + 0.1, ay, az - 0.45], [ax + 0.12, ay, az + 0.45], [ax - 0.03, ay, az + 0.45]], '#e2e8f0');
    lab.face([[ax - 0.33, ay, az], [ax - 0.25, ay, az], [ax - 0.35, ay + 0.15, az]], '#e2e8f0');
    if (!narrow) lab.label('samolyot 10–11 km', [ax + 0.8, ay, az], '#0f172a');
    // balandlik shkalasi
    for (let km = 0; km <= 12; km += 2) { const y = base + km * 1000 * k; lab.line([-3.6, y, 1.4], [-3.45, y, 1.4], 'rgba(255,255,255,0.8)', 1.2); lab.label(`${km} km`, [-3.85, y, 1.4], c.text2); }
    lab.line([-3.6, base, 1.4], [-3.6, base + 12000 * k, 1.4], 'rgba(255,255,255,0.7)', 1.2);
    // havo shari: savat, arqonlar va shar
    const bp = balloonPoint(f.alt.h), by = bp[1] - 0.42;
    lab.box(ALT.x - 0.08, by - 0.12, ALT.z - 0.08, 0.16, 0.12, 0.16, '#a16207');
    for (const [dx, dz] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) lab.line([ALT.x + dx, by, ALT.z + dz], [ALT.x + dx * 2.2, by + 0.2, ALT.z + dz * 2.2], '#78350f', 1);
    const n = 16;
    for (let i = 0; i < 8; i++) for (let j = 0; j < n; j++) {
      const t0 = (i * Math.PI) / 8, t1 = ((i + 1) * Math.PI) / 8, p0 = (j * TAU) / n, p1 = ((j + 1) * TAU) / n, rr = (t) => 0.3 * Math.sin(t) * (t > Math.PI * 0.6 ? 0.7 + 0.3 * Math.sin(t) : 1);
      const q = (t, p) => [bp[0] + rr(t) * Math.cos(p), bp[1] + 0.3 * Math.cos(t) * 1.15, bp[2] + rr(t) * Math.sin(p)];
      lab.face([q(t0, p0), q(t1, p0), q(t1, p1), q(t0, p1)], j % 4 < 2 ? '#dc2626' : '#fbbf24');
    }
    lab.handle('balloon', bp, 0.4);
    dashed(lab, [ALT.x + 0.35, by, ALT.z], [-3.45, by, 1.4], 'rgba(251,191,36,0.95)', 1.4);
    lab.label(`h = ${fmt(f.alt.h, 0)} m`, [ALT.x + 0.75, bp[1] + 0.2, ALT.z], '#0f172a');
  }

  /** f.mode: 'torr' | 'mag' | 'alt'; f.overlay(ctx, stage, narrow) — tekis qatlam (tugmalar, kartochka). */
  function draw(ctx, stage, f) {
    const m = VIEW[f.mode] ? f.mode : 'torr';
    if (m !== key) { key = m; lab.reset(); }
    narrow = stage.w < 560;
    lab.begin(ctx, stage, narrow && m === 'alt' ? { ...VIEW.alt.begin, target: [-0.55, 1.6, 1.2] } : VIEW[m].begin);
    if (m === 'torr') torr(f); else if (m === 'mag') mag(ctx, stage, f); else alt(ctx, stage, f);
    lab.finish(m === 'torr' ? '3D laboratoriya' : '3D dala', m === 'torr' ? (narrow ? 'Bo‘sh joydan suring — kamera' : 'Nay uchini suring · bo‘sh joydan sudrang — kamera') : m === 'mag' ? (narrow ? 'Nasos dastagini suring' : 'Nasos dastagini yuqoriga-pastga suring · o‘lchamlar shartli') : narrow ? 'Havo sharini suring' : 'Havo sharini yuqoriga-pastga suring · balandlik masshtabda');
    f.overlay?.(ctx, stage, narrow);
  }
  return { lab, draw, tubeTip, pumpPoint, balloonPoint, get narrow() { return narrow; } };
}
