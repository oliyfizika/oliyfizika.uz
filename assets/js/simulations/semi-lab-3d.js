// Yarimo'tkazgichlar va p–n o'tish — 360° 3D laboratoriya sahnasi (simulations/semiconductor.html).
// Holat va fizika semi.js / semi-physics.js da o'zgarmaydi; bu yerda faqat asboblar, simlar va sahnadagi tutqichlar.
// Old tomon −z (kuzatuvchi tomoni), stol usti y = 0. Panjara gorizontal plastinkada: dunyo (x, y) → sahna (X, −Z).
// Mikroskopik ko'rinishlar (ionlar tebranishi, p–n o'tish kesimi) — sahna ustidagi tekis oynachalar.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, path } from './apparatus-3d.js?v=20261124-n3';
import { ball, hoop, panel, post, wire, meter, supply, display, thermometer, glow, camRing, shell } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt, tag } from './sim-kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const rgb = (a, o = 1) => `rgba(${a[0]},${a[1]},${a[2]},${o})`;
const lift = (p, y) => [p[0], y, p[2]];
const hash = (k) => { const h = Math.sin(k * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };
const LO = 0.03;
const COL = (c) => ({ red: c.dark ? '#f87171' : '#b91c1c', black: c.dark ? '#cbd5e1' : '#1f2937', blue: c.dark ? '#60a5fa' : '#1d4ed8', copper: c.dark ? '#f59e0b' : '#b45309', wood: c.dark ? '#7c5a3a' : '#c08a55', pcb: c.dark ? '#14532d' : '#15803d' });
/** Rezistor rang halqalari (nominal → 4 ta rang). */
export const BANDS = { 100: ['#7c2d12', '#111827', '#7c2d12', '#d4a017'], 1000: ['#7c2d12', '#111827', '#dc2626', '#d4a017'], 2000: ['#dc2626', '#111827', '#dc2626', '#d4a017'], 4700: ['#eab308', '#7c3aed', '#dc2626', '#d4a017'], 10000: ['#7c2d12', '#111827', '#f97316', '#d4a017'] };

/** Fotorezistor optik skamyada: 1 cm = CM sahna birligi; lampa LDR_X dan d cm chapda. */
const LDR_X = 1.6, CM = 0.045, YA = 0.72;
/** Panjara: 2D dunyo (x, y) → plastinka ustidagi nuqta. */
const LS = 0.0098, YL = 0.34;
const L3 = (x, y, h = YL) => [(x - 260) * LS, h, (154 - y) * LS];

const VIEW = {
  thermo: { begin: { target: [0.15, 0.85, 0.05], focal: 2.0 }, camera: { yaw: -0.3, pitch: 0.34, zoom: 1 } },
  photo: { begin: { target: [0.15, 0.5, 0.05], focal: 2.45 }, camera: { yaw: -0.35, pitch: 0.36, zoom: 1 } },
  lat: { begin: { target: [0, 0.2, 0.2], focal: 2.25 }, camera: { yaw: -0.12, pitch: 0.95, zoom: 1 } },
  vax: { begin: { target: [0.05, 0.45, 0.05], focal: 2.4 }, camera: { yaw: -0.32, pitch: 0.55, zoom: 1 } },
  rect: { begin: { target: [0, 0.35, 0.1], focal: 2.3 }, camera: { yaw: -0.25, pitch: 0.62, zoom: 1 } },
  tr: { begin: { target: [0, 0.45, 0], focal: 2.15 }, camera: { yaw: -0.3, pitch: 0.55, zoom: 1 } },
};

export function createSemiLab() {
  const lab = createLab3D();
  let mode = 'thermo', narrow = false;
  let heatAt = () => [0, 0, 0], knobAt = () => [0, 0, 0], potAt = () => [0, 0, 0];
  lab.reset = () => Object.assign(lab.camera, VIEW[mode].camera);
  lab.reset();

  /* ---------------------------------------------------------------- umumiy asboblar */
  /** Egiluvchan o'lchov simi: a → b, o'rtasi `up` balandlikka ko'tarilgan silliq egri. */
  function cable(a, b, color, up = 0.25, width = 0.011) {
    const m = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + up, (a[2] + b[2]) / 2], pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, u = 1 - t; pts.push([0, 1, 2].map((k) => u * u * a[k] + 2 * u * t * m[k] + t * t * b[k])); }
    path(lab, pts, color, width);
  }
  /** Krokodil qisqich: p — tishlari, rang — izolyatsiya. */
  function clip(p, color) {
    lab.box(p[0] - 0.022, p[1] + 0.01, p[2] - 0.012, 0.044, 0.07, 0.024, color);
    lab.rod([p[0], p[1] + 0.01, p[2]], p, 0.008, lab.colors.text3, 4);
  }
  /** Raqamli multimetr (tik turgan): displey, almashtirgich, ikki uya. p — old yuz pastki o'rtasi. */
  function multimeter(p, text, title) {
    const c = lab.colors, [x, y, z] = p, w = 0.5, h = 0.78, d = 0.16;
    lab.box(x - w / 2, y, z, w, h, d, c.dark ? '#ca8a04' : '#facc15');
    lab.box(x - w / 2 + 0.03, y + 0.03, z - 0.004, w - 0.06, h - 0.06, 0.004, c.dark ? '#27272a' : '#3f3f46');
    panel(lab, x - w * 0.38, y + h * 0.66, x + w * 0.38, y + h * 0.9, z - 0.01, '#b5c4a1');
    lab.label(text, [x, y + h * 0.78, z - 0.02], c.success);
    lab.rod([x, y + h * 0.42, z - 0.008], [x, y + h * 0.42, z - 0.04], 0.085, c.text3, 18);
    lab.rod([x, y + h * 0.42, z - 0.04], [x + 0.05, y + h * 0.42 + 0.05, z - 0.045], 0.01, c.text, 4);
    const red = post(lab, [x - 0.12, y + 0.1, z - 0.004], '#dc2626', 0.04, 0.022), com = post(lab, [x + 0.12, y + 0.1, z - 0.004], '#18181b', 0.04, 0.022);
    if (title) lab.label(title, [x, y + h + 0.1, z + d / 2], c.text2);
    return { red, com };
  }
  /** Rezistor: a → b (o'q bo'ylab), korpus va rang halqalari. */
  function resistor(a, b, bands, body = '#e7d3a7', len = 0.3, r = 0.036) {
    const c = lab.colors, d = b.map((v, i) => v - a[i]), L = Math.hypot(...d) || 1, u = d.map((v) => v / L), at = (s) => a.map((v, i) => v + u[i] * s);
    const s0 = (L - len) / 2;
    lab.rod(a, at(s0), 0.006, c.text3, 4); lab.rod(at(s0 + len), b, 0.006, c.text3, 4);
    lab.rod(at(s0), at(s0 + len), r, body, 12);
    bands.forEach((col, i) => { const s = s0 + (i < 3 ? 0.05 + i * 0.045 : len - 0.06); lab.rod(at(s), at(s + 0.018), r * 1.04, col, 12); });
  }
  /** O'q bo'ylab diod: a — anod, b — katod; glass — shisha korpusli (Ge); on — tok o'tmoqda. */
  function diode(a, b, on, glassBody = false) {
    const c = lab.colors, d = b.map((v, i) => v - a[i]), L = Math.hypot(...d) || 1, u = d.map((v) => v / L), at = (s) => a.map((v, i) => v + u[i] * s);
    const len = glassBody ? 0.2 : 0.24, r = glassBody ? 0.034 : 0.042, s0 = (L - len) / 2, mid = at(L / 2);
    lab.rod(a, at(s0), 0.006, c.text3, 4); lab.rod(at(s0 + len), b, 0.006, c.text3, 4);
    if (glassBody) {
      lab.rod(at(s0), at(s0 + len), r, alpha(c.text3, 0.3), 12);
      lab.rod(at(s0 + 0.03), at(s0 + len * 0.6), 0.008, '#b45309', 6);
      lab.rod(at(s0 + len - 0.04), at(s0 + len - 0.022), r * 1.04, '#dc2626', 12);
    } else {
      lab.rod(at(s0), at(s0 + len), r, '#18181b', 12);
      lab.rod(at(s0 + len - 0.06), at(s0 + len - 0.035), r * 1.04, '#d4d4d8', 12);
    }
    if (on) glow(lab, mid, 0.16, c.dark ? [250, 204, 21] : [234, 179, 8], 0.35, 5, 24);
  }
  /** Taxtacha ustidagi klemma (tik vint). */
  const screw = (p) => post(lab, p, lab.colors.text3, 0.05, 0.018, [0, 1, 0]);

  /* ---------------------------------------------------------------- 1a) Qizdirish: mis va termorezistor */
  function thermoScene(R, anim) {
    const c = lab.colors, col = COL(c), T = R.T, power = R.power, cx = 0.2, cz = 0.1;
    // elektr plitka: korpus, konforka, indikator va dasta (old yuzda)
    lab.box(cx - 0.75, 0, cz - 0.55, 1.5, 0.22, 1.1, c.dark ? '#cbd5e1' : '#f1f5f9');
    lab.rod([cx, 0.22, cz], [cx, 0.235, cz], 0.45, '#27272a', 32);
    if (power > 0) lab.rod([cx, 0.236, cz], [cx, 0.24, cz], 0.43, `rgba(239,68,68,${0.25 + 0.5 * power})`, 32);
    const zf = cz - 0.55;
    lab.rod([cx - 0.6, 0.11, zf], [cx - 0.6, 0.11, zf - 0.01], 0.025, power > 0 ? '#f97316' : '#78716c', 10);
    if (power > 0) glow(lab, [cx - 0.6, 0.11, zf - 0.012], 0.06, [249, 115, 22], 0.5, 4, 20);
    if (!narrow) lab.label('Elektr plitka 800 W', [cx - 0.2, 0.11, zf - 0.02], c.text2);
    const kc = [cx + 0.55, 0.11, zf], rk = 0.07;
    heatAt = (f) => { const a = (-135 + 270 * clamp(f, 0, 1)) * DEG; return [kc[0] + Math.sin(a) * rk * 0.8, kc[1] + Math.cos(a) * rk * 0.8, kc[2] - 0.06]; };
    for (let k = 0; k <= 3; k++) { const a = (-135 + 90 * k) * DEG; lab.line([kc[0] + Math.sin(a) * rk * 1.2, kc[1] + Math.cos(a) * rk * 1.2, zf - 0.003], [kc[0] + Math.sin(a) * rk * 1.45, kc[1] + Math.cos(a) * rk * 1.45, zf - 0.003], c.text, 1.2); }
    lab.rod(kc, [kc[0], kc[1], zf - 0.055], rk, '#1f2937', 20);
    const tip = heatAt(R.level);
    lab.rod([kc[0], kc[1], zf - 0.057], tip, 0.009, '#ffffff', 6);
    ball(lab, tip, 0.016, c.danger, 3);
    lab.handle('heat', tip, 0.15);
    // stakan, suv, konveksiya, pufakchalar
    const y0 = 0.24, top = 1.2, surf = 0.98, r = 0.38;
    lab.rod([cx, y0, cz], [cx, y0 + 0.02, cz], r, alpha(c.text3, 0.4), 28);
    const warm = clamp((T - 20) / 80, 0, 1);
    lab.rod([cx, y0 + 0.02, cz], [cx, surf, cz], r * 0.96, alpha(c.dark ? '#38bdf8' : '#0ea5e9', 0.26 + 0.08 * warm), 28);
    hoop(lab, [cx, surf, cz], r * 0.96, alpha(c.dark ? '#bae6fd' : '#0284c7', 0.8), 0.006, 28);
    lab.rod([cx, y0, cz], [cx, top, cz], r, alpha(c.text3, 0.13), 28);
    hoop(lab, [cx, top, cz], r, alpha(c.text3, 0.7), 0.008, 28);
    for (let i = 1; i <= 4; i++) { const yy = y0 + 0.16 * i; lab.line([cx + r * 0.5, yy, cz - r * 0.87], [cx + r * 0.78, yy, cz - r * 0.63], c.text3, 0.8); }
    if (!narrow) lab.label('600 ml', [cx - r * 0.55, top - 0.08, cz - r * 0.84], c.text3);
    if (power > 0.05 && T < 99.5) for (let k = 0; k < 8; k++) { const ph = (anim * (0.3 + 0.04 * k) + k / 8) % 1; ball(lab, [cx - 0.25 + 0.07 * k, y0 + 0.06 + ph * (surf - y0 - 0.1), cz + 0.2], 0.01, alpha('#ffffff', 0.5 * (1 - ph)), 3); }
    if (T > 80) { const nb = Math.round(((T - 80) / 20) * 16); for (let k = 0; k < nb; k++) { const ph = (anim * (0.5 + (k % 4) * 0.15) + k * 0.37) % 1; ball(lab, [cx - 0.28 + ((k * 0.073) % 0.56), y0 + 0.05 + ph * (surf - y0 - 0.07), cz - 0.2 + ((k * 0.11) % 0.4)], 0.012 + (k % 3) * 0.004, alpha('#ffffff', 0.7), 3); } }
    if (T >= 99.5) for (let k = 0; k < 6; k++) { const ph = (anim * 0.5 + k / 6) % 1; ball(lab, [cx + (k % 2 ? 0.2 : -0.2) + Math.sin(ph * 6 + k) * 0.05, top + 0.05 + ph * 0.7, cz], 0.05 + 0.08 * ph, alpha(c.text3, 0.22 * (1 - ph)), 4); }
    // mis g'altak plastik karkasda
    const gx = cx - 0.17, gz = cz - 0.02;
    for (const yy of [0.42, 0.74]) lab.rod([gx, yy, gz], [gx, yy + 0.02, gz], 0.1, c.dark ? '#e5e7eb' : '#f8fafc', 18);
    lab.rod([gx, 0.44, gz], [gx, 0.74, gz], 0.075, col.copper, 18);
    for (let k = 0; k < 10; k++) hoop(lab, [gx, 0.46 + k * 0.03, gz], 0.077, c.dark ? '#b45309' : '#7c2d12', 0.003, 18);
    const cl1 = [gx - 0.05, 1.42, gz], cl2 = [gx + 0.05, 1.42, gz];
    lab.rod([gx - 0.05, 0.74, gz], cl1, 0.006, col.copper, 4); lab.rod([gx + 0.05, 0.74, gz], cl2, 0.006, col.copper, 4);
    // termorezistor shisha tayoqchada
    const tx = cx + 0.12, tz = cz + 0.06;
    lab.rod([tx, 0.36, tz], [tx, 1.42, tz], 0.016, alpha(c.text3, 0.35), 8);
    ball(lab, [tx, 0.34, tz], 0.032, c.dark ? '#60a5fa' : '#1e3a8a', 5);
    const cl3 = [tx - 0.05, 1.46, tz], cl4 = [tx + 0.05, 1.46, tz];
    lab.rod([tx - 0.01, 0.36, tz], [tx - 0.05, 1.46, tz], 0.004, c.text3, 4); lab.rod([tx + 0.01, 0.36, tz], [tx + 0.05, 1.46, tz], 0.004, c.text3, 4);
    // termometr
    thermometer(lab, [cx + 0.26, 0.32, cz - 0.12], [cx + 0.26, 1.62, cz - 0.12], (T / 100) * 0.94 + 0.03);
    lab.label(`${fmt(T, 1)} °C`, [cx + 0.26, 1.74, cz - 0.12], c.text);
    // multimetrlar va o'lchov simlari
    const m1 = multimeter([-1.85, 0, -0.35], R.Rm, narrow ? '' : 'mis g‘altak'), m2 = multimeter([2.2, 0, -0.35], R.Rs, narrow ? '' : 'termorezistor');
    clip(cl1, '#dc2626'); clip(cl2, '#18181b'); clip(cl3, '#dc2626'); clip(cl4, '#18181b');
    cable(m1.red, cl1, col.red, 0.3); cable(m1.com, cl2, col.black, 0.2);
    cable(m2.red, cl4, col.red, 0.3); cable(m2.com, cl3, col.black, 0.2);
    if (narrow) { lab.label('mis', [-1.85, 0.9, -0.27], c.primary); lab.label('termorezistor', [2.2, 0.9, -0.27], c.warning); }
  }
  function insetMetal(ctx, c, x, y, w, h, T, anim) {
    const k = w / 140, amp = (0.5 + (2.6 * (T - 20)) / 80) * k;
    hudBox(ctx, c, x, y, w, h);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) {
      const n = i * 3 + j, px = x + (14 + i * 19) * k + amp * Math.sin(anim * 17 + n * 1.7), py = y + h * 0.36 + j * h * 0.23 + amp * Math.cos(anim * 13 + n * 2.3);
      ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(px, py, 5.2 * k, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(6, 6.5 * k)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', px, py);
    }
    ctx.fillStyle = c.dark ? '#93c5fd' : '#2563eb';
    for (let n = 0; n < 22; n++) {
      const ex = x + 4 + ((hash(n) * (w - 8) + anim * 6 * k + amp * 4 * Math.sin(anim * (3 + hash(n + 9) * 4) + n)) % (w - 8) + (w - 8)) % (w - 8);
      const ey = y + 18 + (((hash(n + 3) * (h - 22) + 7 * k * Math.sin(anim * (2 + hash(n + 5) * 3) + n * 2)) % (h - 22)) + (h - 22)) % (h - 22);
      ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, TAU); ctx.fill();
    }
    ctx.restore();
    tag(ctx, narrow ? 'Mis: ionlar' : 'Mis: ionlar tebranishi ortadi', x + 4, y + 9, { color: c.text, bg: c.bg2, font: '600 10px system-ui' });
  }
  function insetSemi(ctx, c, x, y, w, h, n, anim) {
    const k = w / 140, ax = (i) => x + (14 + i * 22.5) * k, ay = (j) => y + h * 0.38 + j * h * 0.24;
    hudBox(ctx, c, x, y, w, h);
    ctx.strokeStyle = c.dark ? '#475569' : '#94a3b8'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      if (i < 5) for (const d of [-2, 2]) { ctx.beginPath(); ctx.moveTo(ax(i), ay(j) + d); ctx.lineTo(ax(i + 1), ay(j) + d); ctx.stroke(); }
      if (j < 2) for (const d of [-2, 2]) { ctx.beginPath(); ctx.moveTo(ax(i) + d, ay(j)); ctx.lineTo(ax(i) + d, ay(j + 1)); ctx.stroke(); }
    }
    ctx.fillStyle = c.dark ? '#64748b' : '#cbd5e1';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(ax(i), ay(j), 5 * k, 0, TAU); ctx.fill(); }
    for (let q = 0; q < n; q++) {
      const slot = Math.floor(anim * 0.4 + hash(q * 7) * 5), b = Math.floor(hash(q * 13 + slot) * 25), bi = b % 5, bj = Math.floor(b / 5) % 3;
      ctx.strokeStyle = c.danger; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc((ax(bi) + ax(bi + 1)) / 2, ay(bj), 3 * k, 0, TAU); ctx.stroke();
      const ex = x + 4 + ((hash(q + 1) * (w - 8) + anim * (14 + 6 * hash(q + 2)) * k * (hash(q + 4) > 0.5 ? 1 : -1)) % (w - 8) + (w - 8)) % (w - 8);
      const ey = y + 18 + (((hash(q + 3) * (h - 22) + 9 * k * Math.sin(anim * 3 + q)) % (h - 22)) + (h - 22)) % (h - 22);
      ctx.fillStyle = c.dark ? '#93c5fd' : '#2563eb'; ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    tag(ctx, narrow ? 'Yarimo‘tkazgich: elektronlar' : 'Yarimo‘tkazgich: elektronlar ko‘payadi', x + 4, y + 9, { color: c.text, bg: c.bg2, font: '600 10px system-ui' });
  }
  /** HUD oynacha: fon, chegara va kesish (chaqiruvchi ctx.restore() qiladi). */
  function hudBox(ctx, c, x, y, w, h) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 6);
    ctx.fillStyle = c.dark ? 'rgba(15,23,42,0.92)' : 'rgba(248,250,252,0.94)'; ctx.fill();
    ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.stroke(); ctx.clip();
  }

  /* ---------------------------------------------------------------- 1b) Fotorezistor optik skamyada */
  const lampX = (d) => LDR_X - d * CM;
  function photoScene(F, anim) {
    const c = lab.colors, col = COL(c), lx = lampX(F.d), on = F.lampOn;
    // optik skamya va chizg'ich (0 — fotorezistor)
    lab.box(-2.45, 0, -0.1, 4.6, 0.08, 0.2, c.dark ? '#94a3b8' : '#e5e7eb');
    for (let d = 0; d <= 90; d += 5) { const x = LDR_X - d * CM; if (x < -2.42) break; lab.line([x, 0.082, -0.1], [x, 0.082, d % 10 ? -0.06 : -0.03], c.text, d % 10 ? 0.8 : 1.3); if (d % (narrow ? 20 : 10) === 0) lab.label(String(d), [x, 0.05, -0.18], c.text2); }
    if (!narrow) lab.label('cm', [LDR_X + 0.25, 0.05, -0.18], c.text3);
    // fotorezistor tayanchda: oq disk, zigzag yo'lak (old yuzi lampaga, −x)
    lab.box(LDR_X - 0.1, 0.08, -0.1, 0.2, 0.06, 0.2, '#475569');
    lab.rod([LDR_X, 0.14, 0], [LDR_X, YA - 0.1, 0], 0.018, '#94a3b8', 8);
    lab.rod([LDR_X + 0.03, YA, 0], [LDR_X, YA, 0], 0.11, '#f5f5f4', 22);
    const zz = [];
    for (let k = 0; k <= 8; k++) { const yy = YA - 0.08 + k * 0.02, half = Math.sqrt(Math.max(0, 0.09 * 0.09 - (yy - YA) ** 2)); zz.push([LDR_X - 0.002, yy, k % 2 ? half : -half], [LDR_X - 0.002, yy + 0.02, k % 2 ? half : -half]); }
    path(lab, zz.slice(0, -1), '#c2410c', 0.004);
    lab.rod([LDR_X + 0.03, YA - 0.09, -0.03], [LDR_X + 0.03, YA - 0.2, -0.03], 0.004, c.text3, 4);
    lab.rod([LDR_X + 0.03, YA - 0.09, 0.03], [LDR_X + 0.03, YA - 0.2, 0.03], 0.004, c.text3, 4);
    // luksmetr datchigi (fotorezistor yonida, xuddi shu masofada)
    const sz = 0.32;
    lab.box(LDR_X - 0.08, 0, sz - 0.08, 0.16, 0.04, 0.16, '#475569');
    lab.rod([LDR_X, 0.04, sz], [LDR_X, YA - 0.08, sz], 0.014, '#94a3b8', 8);
    lab.rod([LDR_X + 0.04, YA - 0.02, sz], [LDR_X, YA - 0.02, sz], 0.07, '#f8fafc', 18);
    lab.rod([LDR_X - 0.001, YA - 0.02, sz], [LDR_X - 0.003, YA - 0.02, sz], 0.05, '#fde68a', 18);
    // yorug'lik dastasi (kesik konus) va lampa
    if (on) {
      const a = [lx + 0.08, YA, 0], b = [LDR_X - 0.01, YA, 0], r0 = 0.14, r1 = 0.14 + (LDR_X - lx) * 0.2, n = 16, op = clamp(0.2 - (LDR_X - lx) * 0.03, 0.07, 0.18);
      for (let k = 0; k < n; k++) {
        const t0 = (k * TAU) / n, t1 = ((k + 1) * TAU) / n, P = (p, r, t) => [p[0], p[1] + r * Math.cos(t), p[2] + r * Math.sin(t)];
        lab.face([P(a, r0, t0), P(a, r0, t1), P(b, r1, t1), P(b, r1, t0)], `rgba(253,224,71,${op})`);
      }
    }
    lab.box(lx - 0.16, 0.08, -0.12, 0.3, 0.06, 0.24, '#475569');
    lab.rod([lx - 0.04, 0.14, 0], [lx - 0.04, YA - 0.12, 0], 0.018, '#94a3b8', 8);
    lab.rod([lx - 0.22, YA, 0], [lx + 0.02, YA, 0], 0.09, c.dark ? '#64748b' : '#94a3b8', 18);
    lab.rod([lx + 0.02, YA, 0], [lx + 0.08, YA, 0], 0.15, c.dark ? '#475569' : '#64748b', 22);
    lab.rod([lx + 0.08, YA, 0], [lx + 0.085, YA, 0], 0.135, on ? '#fef9c3' : c.dark ? '#475569' : '#e2e8f0', 22);
    if (on) glow(lab, [lx + 0.1, YA, 0], 0.42, [254, 240, 138], 0.55);
    path(lab, [[lx - 0.22, YA, 0], [lx - 0.4, YA - 0.2, 0.05], [lx - 0.45, 0.03, 0.3], [lx - 0.7, 0.03, 0.6]], c.dark ? '#a1a1aa' : '#27272a', 0.014);
    lab.handle('lamp', [lx - 0.06, YA, 0], 0.2);
    lab.label(on ? 'lampa 60 W' : 'lampa o‘chiq', [lx - 0.05, YA + 0.3, 0], c.text2);
    lab.label(`r = ${fmt(F.d, 0)} cm`, [(lx + LDR_X) / 2, 0.36, 0], c.text);
    if (!narrow) lab.label('fotorezistor', [LDR_X, YA + 0.24, 0], c.warning);
    // luksmetr va multimetr
    display(lab, [0.75, 0, -0.75], { w: 0.5, h: 0.42, d: 0.22, text: `${fmt(F.E, F.E < 10 ? 1 : 0)} lk`, title: narrow ? '' : 'Luksmetr', color: c.success });
    cable([LDR_X + 0.04, YA - 0.02, sz], [0.75, 0.3, -0.64], '#334155', 0.2, 0.009);
    const mm = multimeter([2.45, 0, -0.45], F.R, narrow ? '' : 'Ω-metr');
    cable(mm.red, [LDR_X + 0.03, YA - 0.2, -0.03], col.red, 0.15); cable(mm.com, [LDR_X + 0.03, YA - 0.2, 0.03], col.black, 0.1);
  }

  /* ---------------------------------------------------------------- 2) Panjara */
  function latScene(L, anim) {
    const c = lab.colors, col = COL(c), on = L.field;
    // plastinka, kontaktlar
    const x0 = (46 - 260) * LS, x1 = (474 - 260) * LS, z0 = (154 - 256) * LS, z1 = (154 - 52) * LS;
    lab.box(x0, 0, z0 - 0.06, x1 - x0, 0.2, z1 - z0 + 0.12, c.dark ? '#1e293b' : '#e2e8f0');
    lab.face([[x0, 0.202, z0 - 0.06], [x1, 0.202, z0 - 0.06], [x1, 0.202, z1 + 0.06], [x0, 0.202, z1 + 0.06]], c.dark ? '#0f172a' : '#f8fafc');
    for (const [a, b] of [[x0 - 0.13, x0], [x1, x1 + 0.13]]) lab.box(a, 0, z0 - 0.06, b - a, 0.42, z1 - z0 + 0.12, c.dark ? '#94a3b8' : '#cbd5e1');
    // bog'lar va bog' elektronlari
    const bondC = c.dark ? '#64748b' : '#94a3b8', eC = c.dark ? '#93c5fd' : '#1d4ed8';
    for (const b of L.bonds) {
      const A = L.pos(b.a), B = L.pos(b.b);
      for (const d of [-2.2, 2.2]) lab.line(L3(A[0] + (b.h ? 0 : d), A[1] + (b.h ? d : 0)), L3(B[0] + (b.h ? 0 : d), B[1] + (b.h ? d : 0)), bondC, 1);
    }
    L.bonds.forEach((b, k) => { for (const sl of [0, 1]) { if (L.holeAt.has(`${k}:${sl}`)) continue; const [x, y] = L.slot(k, sl); ball(lab, L3(x, y), 0.014, eC, 2); } });
    // atomlar (bosiladi)
    for (let i = 0; i < L.atoms.length; i++) {
      const [x, y] = L.pos(i), t = L.atoms[i], p = L3(x, y);
      const fill = t === 'd' ? '#ea580c' : t === 'a' ? '#16a34a' : c.dark ? '#64748b' : '#cbd5e1';
      ball(lab, p, 0.1, fill, 6);
      if (t !== 's') {
        ball(lab, [p[0] + 0.08, p[1] + 0.08, p[2] + 0.08], 0.04, t === 'd' ? '#dc2626' : '#1d4ed8', 4);
        lab.label(t === 'd' ? 'P⁺' : 'B⁻', [p[0], p[1] + 0.2, p[2]], t === 'd' ? c.warning : c.success);
      }
      lab.handle(`atom:${i}`, p, 0.1);
    }
    // chaqnashlar, kovaklar, erkin elektronlar
    for (const f of L.fx) camRing(lab, L3(f.x, f.y, YL + 0.02), 0.04 + f.t * 0.2, f.kind === 'gen' ? `rgba(250,204,21,${1 - f.t / 0.7})` : `rgba(74,222,128,${1 - f.t / 0.7})`, 2);
    for (const h of L.h) { const p = L3(h.x, h.y, YL + 0.01); camRing(lab, p, 0.034, c.danger, 1.8, 16); lab.line([p[0] - 0.018, p[1], p[2]], [p[0] + 0.018, p[1], p[2]], c.danger, 1.6); lab.line([p[0], p[1], p[2] - 0.018], [p[0], p[1], p[2] + 0.018], c.danger, 1.6); }
    for (const e of L.e) ball(lab, L3(e.x, e.y, YL + 0.05), 0.045, c.dark ? '#60a5fa' : '#2563eb', 5);
    // batareya, tugmali kalit va ampermetr (orqada)
    const zb = 1.38;
    lab.box(-1.4, 0, zb - 0.15, 1.0, 0.26, 0.3, '#b91c1c');
    lab.box(-1.4, 0, zb - 0.151, 1.0, 0.09, 0.302, '#1e3a8a');
    lab.label('4,5 V', [-0.9, 0.18, zb - 0.16], c.warning);
    const bp = post(lab, [-1.25, 0.26, zb], '#d4a017', 0.05, 0.02, [0, 1, 0]), bm = post(lab, [-0.55, 0.26, zb], '#d4a017', 0.06, 0.03, [0, 1, 0]);
    lab.label('+', [-1.25, 0.42, zb], c.danger); lab.label('−', [-0.55, 0.42, zb], c.text);
    lab.box(0.0, 0, zb - 0.14, 0.5, 0.1, 0.28, c.dark ? '#334155' : '#e5e7eb');
    lab.rod([0.25, 0.1, zb], [0.25, 0.16, zb], 0.07, on ? '#16a34a' : '#dc2626', 16);
    lab.label(on ? 'ON' : 'OFF', [0.25, 0.28, zb], on ? c.success : c.danger);
    lab.handle('btn', [0.25, 0.14, zb], 0.17);
    const s1 = screw([0.06, 0.1, zb]), s2 = screw([0.44, 0.1, zb]);
    display(lab, [1.3, 0, zb - 0.12], { w: 0.62, h: 0.34, d: 0.22, text: on ? `${L.I[0]} ${L.I[1]}` : '0 nA', title: narrow ? '' : 'mikroampermetr', color: on ? c.success : c.text2 });
    const fl = { on, t: anim, speed: 0.4 };
    const ca = [x0 - 0.065, 0.42, z1], cb = [x1 + 0.065, 0.42, z1];
    wire(lab, [bp, [bp[0], 0.45, bp[2]], [x0 - 0.065, 0.45, zb], ca], col.red, fl);
    wire(lab, [bm, [bm[0], 0.4, bm[2]], [s1[0], 0.4, zb], s1], col.black, fl);
    wire(lab, [s2, [s2[0], 0.3, zb], [1.0, 0.3, zb], [1.0, 0.05, zb - 0.13]], col.black, fl);
    wire(lab, [[1.6, 0.05, zb - 0.13], [x1 + 0.065, 0.05, zb - 0.13], [x1 + 0.065, 0.45, zb - 0.13], cb], col.black, fl);
    lab.label('+', [x0 - 0.065, 0.6, z0], c.danger); lab.label('−', [x1 + 0.065, 0.6, z0], c.text);
    // maydon yo'nalishi
    if (on) {
      const zf = z0 - 0.22;
      lab.vector([-0.6, 0.22, zf], [1.2, 0, 0], c.warning, 'E');
      if (!narrow) { lab.label('← elektronlar', [-1.4, 0.22, zf], c.primary); lab.label('kovaklar →', [1.4, 0.22, zf], c.danger); }
    }
  }

  /* ---------------------------------------------------------------- 3a) Diod VAX */
  function vaxScene(V, anim) {
    const c = lab.colors, col = COL(c), on = V.on, rev = V.rev;
    const ps = supply(lab, [-2.2, 0, 0.25], { text: `${fmt(V.E, rev ? 1 : 2)} V`, title: narrow ? '' : rev ? 'Manba 0–30 V' : 'Manba 0–5 V', frac: V.E / V.Emax, id: 'knob', marks: !narrow });
    knobAt = ps.knob;
    // qutb almashtirgich (bosiladi): ikki kirish, ikki chiqish, almashinuvchi ko'prikchalar
    const px = -1.2, pz = -0.55;
    lab.box(px - 0.3, 0, pz - 0.2, 0.6, 0.06, 0.4, c.dark ? '#334155' : '#e5e7eb');
    const i1 = screw([px - 0.2, 0.06, pz + 0.12]), i2 = screw([px + 0.2, 0.06, pz + 0.12]), o1 = screw([px - 0.2, 0.06, pz - 0.12]), o2 = screw([px + 0.2, 0.06, pz - 0.12]);
    const br = c.dark ? '#cbd5e1' : '#57534e';
    if (!rev) { lab.rod(i1, o1, 0.012, br, 6); lab.rod(i2, o2, 0.012, br, 6); }
    else { lab.rod(i1, o2, 0.012, br, 6); lab.rod(i2, o1, 0.012, br, 6); }
    lab.rod([px, 0.11, pz], [px, 0.2, pz], 0.035, '#111827', 10);
    lab.handle('pol', [px, 0.12, pz], 0.24);
    lab.label(rev ? 'teskari' : 'to‘g‘ri', [px, 0.32, pz], rev ? c.danger : c.success);
    // 100 Ω rezistor, ampermetr, diod taxtachasi, voltmetr
    const ra = [-0.95, 0.09, 0.0], rb = [-0.45, 0.09, 0.0];
    lab.box(-1.02, 0, -0.08, 0.64, 0.05, 0.16, col.wood);
    resistor(ra, rb, BANDS[100]);
    const ra0 = screw([-0.98, 0.05, 0]), rb0 = screw([-0.42, 0.05, 0]);
    lab.rod(ra0, ra, 0.006, c.text3, 4); lab.rod(rb0, rb, 0.006, c.text3, 4);
    if (!narrow) lab.label('R = 100 Ω', [-0.7, 0.22, 0.0], c.text2);
    const am = meter(lab, [0.0, 0, 0.55], { frac: V.Am.frac, sym: V.Am.sym, text: narrow ? V.Am.short : V.Am.text });
    const vm = meter(lab, [2.25, 0, 0.45], { frac: V.Vm.frac, sym: 'V', text: narrow ? V.Vm.short : V.Vm.text });
    const bx = 1.0, bz = -0.35, yb = 0.05;
    lab.box(bx - 0.5, 0, bz - 0.2, 1.0, yb, 0.4, col.wood);
    const A = screw([bx - 0.4, yb, bz]), K = screw([bx + 0.4, yb, bz]);
    const a = [bx - 0.38, yb + 0.08, bz], k = [bx + 0.38, yb + 0.08, bz];
    if (V.led) {
      const ledC = V.led, b = clamp(V.I / 0.02, 0, 1.5), lp = [bx, yb + 0.18, bz];
      lab.rod([bx - 0.02, yb, bz], [bx - 0.02, yb + 0.1, bz], 0.004, c.text3, 4); lab.rod([bx + 0.02, yb, bz], [bx + 0.02, yb + 0.1, bz], 0.004, c.text3, 4);
      lab.rod([bx, yb + 0.1, bz], [bx, yb + 0.115, bz], 0.06, rgb(ledC, 0.6), 18);
      lab.rod([bx, yb + 0.115, bz], lp, 0.05, rgb(ledC, b > 0.01 ? 0.75 + 0.2 * Math.min(1, b) : 0.4), 18);
      ball(lab, lp, 0.05, rgb(ledC, b > 0.01 ? 0.8 : 0.45), 6);
      if (b > 0.01) glow(lab, lp, 0.18 + 0.4 * Math.sqrt(b), ledC, Math.min(0.7, 0.25 + 0.4 * b));
      path(lab, [A, lift(A, yb + 0.06), [bx - 0.02, yb + 0.06, bz], [bx - 0.02, yb, bz]], c.text3, 0.004);
      path(lab, [K, lift(K, yb + 0.06), [bx + 0.02, yb + 0.06, bz], [bx + 0.02, yb, bz]], c.text3, 0.004);
    } else {
      lab.rod(A, a, 0.005, c.text3, 4); lab.rod(K, k, 0.005, c.text3, 4);
      diode(a, k, V.I > 1e-4, V.glass);
    }
    lab.label(V.short, [bx, 0.02, bz - 0.32], c.text);
    if (!narrow) lab.label(rev ? 'anod «−» ga, katod «+» ga' : 'anod «+» ga, katod «−» ga', [bx, 0.42, bz + 0.1], rev ? c.danger : c.success);
    // simlar
    const fl = { on, t: anim, speed: rev ? 0.08 : 0.15 + 0.4 * clamp(V.I / 0.03, 0, 1) };
    wire(lab, [ps.plus, lift(ps.plus, LO), [ps.plus[0], LO, i1[2]], lift(i1, LO), i1], col.red, fl);
    wire(lab, [ps.minus, lift(ps.minus, 0.05), [ps.minus[0], 0.05, i2[2] + 0.08], [i2[0], 0.05, i2[2] + 0.08], i2], col.black, fl);
    wire(lab, [o1, lift(o1, 0.14), [o1[0], 0.14, pz - 0.3], [-0.98, 0.14, pz - 0.3], ra0], col.red, fl);
    wire(lab, [rb0, lift(rb0, 0.12), [am.plus[0], 0.12, 0], am.plus], col.red, fl);
    wire(lab, [am.minus, lift(am.minus, 0.1), [A[0], 0.1, am.minus[2]], lift(A, 0.1), A], col.red, fl);
    wire(lab, [K, lift(K, LO), [K[0] + 0.3, LO, K[2]], [K[0] + 0.3, LO, -0.95], [o2[0], LO, -0.95], lift(o2, LO), o2], col.black, fl);
    wire(lab, [vm.plus, lift(vm.plus, 0.5), [A[0] - 0.03, 0.5, vm.plus[2]], [A[0] - 0.03, 0.5, A[2]], A], col.blue, { width: 0.01 });
    wire(lab, [vm.minus, lift(vm.minus, 0.42), [K[0] + 0.03, 0.42, vm.minus[2]], [K[0] + 0.03, 0.42, K[2]], K], col.blue, { width: 0.01 });
  }
  /** p–n o'tish kesimi (tekis oynacha): kambag'allashgan qatlam kengligi va tashuvchilar oqimi. */
  function pnInset(ctx, c, x, y, w, h, wzK, flux, anim) {
    const k = w / 370, jx = x + w / 2, wz = clamp(44 * wzK, 6, 170) * k, z0 = jx - wz / 2, z1 = jx + wz / 2;
    hudBox(ctx, c, x, y, w, h);
    ctx.fillStyle = c.dark ? 'rgba(248,113,113,0.16)' : 'rgba(254,202,202,0.6)'; ctx.fillRect(x, y, jx - x, h);
    ctx.fillStyle = c.dark ? 'rgba(96,165,250,0.16)' : 'rgba(191,219,254,0.7)'; ctx.fillRect(jx, y, x + w - jx, h);
    ctx.fillStyle = c.dark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.75)'; ctx.fillRect(z0, y, wz, h);
    ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const g = 11 * k;
    for (let gx = jx - g / 2 - g * Math.floor((wz / 2 - g / 2) / g); gx < z1; gx += g) for (let gy = y + 20; gy < y + h - 4; gy += 13) {
      if (gx < z0 || gx > z1) continue; const p = gx < jx;
      ctx.fillStyle = p ? (c.dark ? 'rgba(147,197,253,0.7)' : 'rgba(29,78,216,0.55)') : (c.dark ? 'rgba(252,165,165,0.7)' : 'rgba(185,28,28,0.55)');
      ctx.fillText(p ? '⊖' : '⊕', gx, gy);
    }
    for (let q = 0; q < 34; q++) {
      const p = q % 2 === 0, yy = y + 18 + hash(q * 3) * (h - 24);
      let xx;
      if (flux > 0 && hash(q * 7) < 0.25 + 0.6 * flux) {
        const ph = (anim * (0.18 + 0.5 * flux) + hash(q)) % 1;
        xx = p ? x + 6 + ph * (w * 0.72) : x + w - 6 - ph * (w * 0.72);
        const past = p ? xx - z1 : z0 - xx; if (past > 0) ctx.globalAlpha = clamp(1 - past / (50 * k), 0, 1);
      } else {
        const base = hash(q * 5), jig = 2.5 * Math.sin(anim * 5 + q);
        xx = p ? x + 6 + base * (z0 - x - 10) + jig : z1 + 4 + base * (x + w - z1 - 10) + jig;
      }
      if (p) { ctx.strokeStyle = c.danger; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(xx, yy, 2.8, 0, TAU); ctx.stroke(); }
      else { ctx.fillStyle = c.dark ? '#93c5fd' : '#1d4ed8'; ctx.beginPath(); ctx.arc(xx, yy, 2.6, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(z0, y + 16); ctx.lineTo(z0, y + h); ctx.moveTo(z1, y + 16); ctx.lineTo(z1, y + h); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    const f = { bg: c.bg2, font: '600 10px system-ui' };
    tag(ctx, 'p', x + 4, y + 9, { ...f, color: c.danger });
    tag(ctx, 'n', x + w - 16, y + 9, { ...f, color: c.primary });
    tag(ctx, wz > 130 * Math.min(1, w / 300) && w > 250 ? 'kambag‘allashgan qatlam' : 'qatlam', jx, y + 9, { ...f, color: c.text2, align: 'center' });
  }

  /* ---------------------------------------------------------------- 3b) To'g'rilagich */
  function rectScene(Q, anim) {
    const c = lab.colors, col = COL(c), cond = Q.cond, pos = Q.pos, yb = 0.05, Y = yb + 0.1;
    // transformator: o'zak, ikki g'altak, tarmoq vilkasi simi
    const tx = -2.25;
    lab.box(tx - 0.42, 0, -0.25, 0.84, 0.82, 0.5, c.dark ? '#64748b' : '#94a3b8');
    for (let yy = 0.05; yy < 0.8; yy += 0.05) lab.line([tx - 0.42, yy, -0.252], [tx + 0.42, yy, -0.252], alpha('#0f172a', 0.25), 0.6);
    for (const [gx, n] of [[-0.21, 14], [0.21, 7]]) {
      lab.box(tx + gx - 0.13, 0.14, -0.3, 0.26, 0.54, 0.6, col.copper);
      for (let q = 0; q < n; q++) lab.line([tx + gx - 0.13, 0.17 + (q * 0.48) / n, -0.302], [tx + gx + 0.13, 0.17 + (q * 0.48) / n + 0.01, -0.302], alpha('#78350f', 0.6), n > 10 ? 0.7 : 1.4);
    }
    if (!narrow) { lab.label('220 V', [tx - 0.21, 0.4, -0.34], c.text); lab.label('12 V', [tx + 0.21, 0.4, -0.34], c.text); }
    lab.label(narrow ? 'Transformator' : `Transformator · kirish ${fmt(Q.u, 1)} V`, [tx, 0.98, 0], Q.u !== 0 ? c.warning : c.text2);
    path(lab, [[tx - 0.3, 0.1, 0.25], [tx - 0.4, 0.03, 0.6], [tx - 0.2, 0.03, 1.2]], c.dark ? '#a1a1aa' : '#27272a', 0.02);
    const AC1 = post(lab, [tx + 0.42, 0.62, -0.1], col.copper, 0.06, 0.02, [1, 0, 0]), AC2 = post(lab, [tx + 0.42, 0.62, 0.1], col.copper, 0.06, 0.02, [1, 0, 0]);
    // plata
    lab.box(-1.45, 0, -0.75, 2.6, yb, 1.4, col.pcb);
    for (let x = -1.35; x < 1.1; x += 0.12) for (let z = -0.65; z < 0.6; z += 0.12) lab.line([x, yb + 0.002, z], [x + 0.01, yb + 0.002, z], alpha('#000000', 0.3), 1.2);
    const TOP = 0.45, BOT = -0.5, RX = 0.95, CXp = 0.45;
    const fl = (on) => ({ on, t: anim, speed: 0.45 });
    const node = (p) => ball(lab, p, 0.02, c.dark ? '#e2e8f0' : '#1f2937', 3);
    if (Q.bridge) {
      const L = [-0.95, Y, 0], R = [0.05, Y, 0], T = [-0.45, Y, TOP], B = [-0.45, Y, BOT];
      const ds = [[L, T], [R, T], [B, L], [B, R]], on = [cond && pos, cond && !pos, cond && !pos, cond && pos];
      ds.forEach(([a, b], k) => { diode(a, b, on[k]); lab.label(`D${k + 1}`, [(a[0] + b[0]) / 2 + (k % 2 ? 0.14 : -0.14), Y + 0.1, (a[2] + b[2]) / 2 + (k < 2 ? 0.1 : -0.1)], on[k] ? c.warning : c.text3); });
      wire(lab, [AC1, [AC1[0] + 0.3, AC1[1], AC1[2]], [-1.25, Y, -0.1], [-1.25, Y, 0], L], col.copper, fl(cond && pos));
      wire(lab, [AC2, [AC2[0] + 0.2, AC2[1], AC2[2]], [-1.35, Y, 0.6], [0.25, Y, 0.6], [0.25, Y, 0], R], col.copper, fl(cond && !pos));
      wire(lab, [T, [RX, Y, TOP]], col.red, fl(cond));
      wire(lab, [B, [RX, Y, BOT]], col.black, fl(cond));
      [L, R, T, B].forEach(node);
    } else {
      const d0 = [-0.95, Y, TOP], d1 = [-0.35, Y, TOP];
      diode(d0, d1, cond);
      lab.label('D1', [-0.65, Y + 0.12, TOP], cond ? c.warning : c.text3);
      wire(lab, [AC1, [AC1[0] + 0.3, AC1[1], AC1[2]], [-1.2, Y, TOP], d0], col.copper, fl(cond));
      wire(lab, [d1, [RX, Y, TOP]], col.red, fl(cond));
      wire(lab, [AC2, [AC2[0] + 0.2, AC2[1], AC2[2]], [-1.3, Y, BOT], [RX, Y, BOT]], col.black, fl(cond));
    }
    // kondensator
    if (Q.C > 0) {
      const hC = Q.C >= 1000 ? 0.4 : Q.C >= 470 ? 0.32 : 0.25, rC = Q.C >= 1000 ? 0.1 : 0.08, p = [CXp, yb, 0];
      lab.rod(p, [CXp, yb + hC, 0], rC, '#1d4ed8', 20);
      lab.rod([CXp, yb + hC, 0], [CXp, yb + hC + 0.005, 0], rC * 0.95, '#94a3b8', 20);
      lab.rod([CXp - rC * 0.98, yb + 0.02, -0.01], [CXp - rC * 0.98, yb + hC - 0.02, -0.01], 0.012, '#cbd5e1', 4);
      lab.label(`${Q.C} μF`, [CXp, yb + hC + 0.14, 0], c.primary);
      wire(lab, [[CXp, Y, TOP], [CXp, Y, 0.06]], col.red, {}); wire(lab, [[CXp, Y, BOT], [CXp, Y, -0.06]], col.black, {});
      node([CXp, Y, TOP]); node([CXp, Y, BOT]);
    }
    // yuklama rezistori (rels bo'ylab)
    resistor([RX, Y, TOP], [RX, Y, BOT], BANDS[100], '#d6d3d1', 0.44, 0.05);
    if (Q.v > 0.2) wire(lab, [[RX + 0.09, Y, TOP - 0.1], [RX + 0.09, Y, BOT + 0.1]], alpha(c.primary, 0.01), { on: true, t: anim, speed: 0.15 + 0.4 * clamp(Q.v / 17, 0, 1), width: 0.004, dots: c.dark ? '#67e8f9' : '#0891b2' });
    lab.label(`R = ${fmt(Q.R, 0)} Ω`, [RX + 0.12, Y + 0.12, -0.05], c.text2);
    lab.label(`chiqish ${fmt(Q.v, 1)} V`, [RX, 0.02, BOT - 0.38], c.primary);
    // ossillograf
    const ox = 2.25, oz = 0.35, w = 1.2, h = 0.9;
    lab.box(ox - w / 2, 0, oz, w, h, 0.5, shell(c));
    const sx0 = ox - w / 2 + 0.06, sx1 = ox + 0.22, sy0 = 0.12, sy1 = h - 0.08, zs = oz - 0.004, mid = (sy0 + sy1) / 2;
    lab.face([[sx0, sy0, zs], [sx1, sy0, zs], [sx1, sy1, zs], [sx0, sy1, zs]], '#06281a');
    for (let q = 0; q <= 10; q++) lab.line([sx0 + ((sx1 - sx0) * q) / 10, sy0, zs - 0.001], [sx0 + ((sx1 - sx0) * q) / 10, sy1, zs - 0.001], 'rgba(74,222,128,0.2)', 0.6);
    for (let q = 0; q <= 8; q++) lab.line([sx0, sy0 + ((sy1 - sy0) * q) / 8, zs - 0.001], [sx1, sy0 + ((sy1 - sy0) * q) / 8, zs - 0.001], 'rgba(74,222,128,0.2)', 0.6);
    const VY = (v) => clamp(mid + (v / 5) * ((sy1 - sy0) / 8), sy0, sy1), TX = (i) => sx0 + (i / (Q.uin.length - 1)) * (sx1 - sx0);
    const tr = (arr, color) => { const step = Math.max(1, Math.floor(arr.length / 150)); let prev = null; for (let i = 0; i < arr.length; i += step) { const p = [TX(i), VY(arr[i]), zs - 0.003]; if (prev) lab.line(prev, p, color, 1.6); prev = p; } };
    tr(Q.uin, '#facc15'); tr(Q.uout, '#22d3ee');
    ball(lab, [TX(Q.i), VY(Q.uout[Q.i]), zs - 0.006], 0.014, '#ffffff', 3);
    for (const [k, cl] of [[0, '#facc15'], [1, '#22d3ee'], [2, '#a1a1aa']]) { const kp = [ox + 0.4, 0.66 - k * 0.2, oz]; lab.rod(kp, [kp[0], kp[1], oz - 0.04], 0.045, '#1f2937', 14); lab.rod([kp[0], kp[1], oz - 0.04], [kp[0], kp[1] + 0.035, oz - 0.045], 0.008, cl, 4); }
    lab.label(narrow ? 'Ossillograf' : 'Ossillograf · 5 V/bo‘l, 4 ms/bo‘l', [ox, h + 0.12, oz + 0.25], c.text2);
    cable([ox - 0.3, 0.05, oz - 0.02], [RX, Y, TOP], '#22d3ee', 0.35, 0.008);
    cable([ox - 0.45, 0.05, oz - 0.02], [AC1[0], AC1[1], AC1[2]], '#facc15', 0.45, 0.008);
  }

  /* ---------------------------------------------------------------- 3c) Tranzistor */
  function trScene(Tt, anim) {
    const c = lab.colors, col = COL(c), onB = Tt.onB, onC = Tt.onC, yb = 0.05;
    // batareyalar 4 × 1,5 V
    const bz = -0.75;
    lab.box(-2.6, 0, bz - 0.17, 1.2, 0.06, 0.34, '#1f2937');
    for (let k = 0; k < 4; k++) { const x = -2.5 + k * 0.27; lab.rod([x, 0.14, bz], [x + 0.24, 0.14, bz], 0.075, k % 2 ? '#78350f' : '#f59e0b', 16); lab.rod([x + (k % 2 ? 0 : 0.24), 0.14, bz], [x + (k % 2 ? -0.015 : 0.255), 0.14, bz], 0.025, '#e5e7eb', 8); }
    lab.label('6 V', [-2.0, 0.3, bz], c.text);
    const BP = post(lab, [-2.6, 0.08, bz], col.red, 0.06, 0.02, [-1, 0, 0]), BM = post(lab, [-1.4, 0.08, bz], c.text2, 0.06, 0.02, [1, 0, 0]);
    // potensiometr (dasta old yuzda)
    const px = -2.1, pz = 0.25, kc = [px, 0.22, pz - 0.15], rk = 0.08;
    lab.box(px - 0.3, 0, pz - 0.15, 0.6, 0.44, 0.3, '#334155');
    potAt = (f) => { const a = (-135 + 270 * clamp(f, 0, 1)) * DEG; return [kc[0] + Math.sin(a) * rk * 0.8, kc[1] + Math.cos(a) * rk * 0.8, kc[2] - 0.07]; };
    for (let k = 0; k <= 10; k++) { const a = (-135 + 27 * k) * DEG; lab.line([kc[0] + Math.sin(a) * rk * 1.2, kc[1] + Math.cos(a) * rk * 1.2, kc[2] - 0.003], [kc[0] + Math.sin(a) * rk * 1.45, kc[1] + Math.cos(a) * rk * 1.45, kc[2] - 0.003], k <= Tt.f * 10 + 1e-6 ? c.primary : c.text3, 1.2); }
    lab.rod(kc, [kc[0], kc[1], kc[2] - 0.065], rk, '#d4d4d8', 20);
    const tip = potAt(Tt.f);
    lab.rod([kc[0], kc[1], kc[2] - 0.067], tip, 0.01, '#dc2626', 6); ball(lab, tip, 0.017, '#dc2626', 3);
    lab.handle('pot', tip, 0.16);
    if (!narrow) lab.label('potensiometr', [px, 0.56, pz], c.text2);
    const lugs = [0, 1, 2].map((k) => post(lab, [px + 0.3, 0.12 + k * 0.1, pz], '#d4d4d8', 0.06, 0.016, [1, 0, 0])); // pastki — «−», o'rta — surgich, yuqori — «+»
    // baza zanjiri: surgich → mA-metr → R_B → B
    const bm = meter(lab, [-0.95, 0, 0.55], { w: 0.56, h: 0.46, frac: Tt.Ib / 0.003, sym: 'mA', text: narrow ? `${fmt(Tt.Ib * 1e3, 2)} mA` : `baza ${fmt(Tt.Ib * 1e3, 2)} mA · 0–3 mA` });
    const ra = [-0.75, 0.13, -0.3], rb = [-0.15, 0.13, -0.3];
    lab.box(-0.82, 0, -0.38, 0.74, 0.05, 0.16, col.wood);
    const ra0 = screw([-0.78, 0.05, -0.3]), rb0 = screw([-0.12, 0.05, -0.3]);
    lab.rod(ra0, ra, 0.005, c.text3, 4); lab.rod(rb0, rb, 0.005, c.text3, 4);
    resistor(ra, rb, BANDS[Tt.Rb] || BANDS[2000]);
    lab.label(`R_B = ${Tt.RbText}`, [-0.45, 0.28, -0.3], c.text2);
    // tranzistor plata (BC337)
    const tx = 0.55, tz = -0.1;
    lab.box(tx - 0.3, 0, tz - 0.3, 0.6, yb, 0.6, col.pcb);
    const E = screw([tx + 0.2, yb, tz - 0.2]), Bt = screw([tx - 0.2, yb, tz - 0.2]), Kt = screw([tx, yb, tz + 0.2]);
    for (const dx of [-0.05, 0, 0.05]) lab.rod([tx + dx, yb, tz], [tx + dx, yb + 0.12, tz], 0.006, '#d4d4d8', 4);
    lab.box(tx - 0.08, yb + 0.12, tz - 0.03, 0.16, 0.2, 0.06, '#18181b');
    lab.rod([tx, yb + 0.12, tz + 0.03], [tx, yb + 0.32, tz + 0.03], 0.08, '#18181b', 14);
    if (!narrow) lab.label('BC337', [tx - 0.32, yb + 0.28, tz], c.text2);
    path(lab, [[tx - 0.05, yb + 0.003, tz], [tx - 0.2, yb + 0.003, tz], Bt], '#d97706', 0.01);
    path(lab, [[tx, yb + 0.003, tz], [tx, yb + 0.003, tz + 0.2]], '#d97706', 0.01);
    path(lab, [[tx + 0.05, yb + 0.003, tz], [tx + 0.2, yb + 0.003, tz], [tx + 0.2, yb + 0.003, tz - 0.2]], '#d97706', 0.01);
    if (!narrow) { lab.label('B', [Bt[0], 0.2, Bt[2] - 0.06], c.text); lab.label('K', [Kt[0] + 0.14, 0.12, Kt[2] + 0.06], c.text); lab.label('E', [E[0], 0.2, E[2] - 0.06], c.text); }
    lab.label(Tt.cut ? 'yopiq' : Tt.sat ? 'to‘yinish (kalit ochiq)' : 'kuchaytirish', [tx, 0.75, tz], Tt.cut ? c.text3 : Tt.sat ? c.success : c.warning);
    // lampa va kollektor mA-metr
    const lx = 2.3, lz = -0.3, b = Tt.br, rgbL = Tt.rgb;
    lab.box(lx - 0.2, 0, lz - 0.2, 0.4, 0.06, 0.4, '#1c1917');
    lab.rod([lx, 0.06, lz], [lx, 0.18, lz], 0.07, '#a16207', 14);
    lab.rod([lx, 0.18, lz], [lx, 0.24, lz], 0.05, b > 0.02 ? rgb(rgbL, 0.4) : alpha(c.text3, 0.2), 14);
    const cyl = [lx, 0.38, lz];
    ball(lab, cyl, 0.16, b > 0.02 ? rgb(rgbL, Math.min(0.75, 0.15 + 0.55 * b)) : alpha(c.text3, 0.18), 8);
    const fil = []; for (let q = 0; q <= 24; q++) { const u = q / 24; fil.push([lx - 0.07 + 0.14 * u, 0.38 + 0.012 * Math.sin(u * 20), lz]); }
    path(lab, fil, b > 0.05 ? rgb(rgbL) : '#57534e', 0.005);
    if (b > 0.02) glow(lab, cyl, 0.25 + 0.5 * Math.sqrt(Math.min(b, 1.3)), rgbL, Math.min(0.65, 0.12 + 0.45 * b));
    lab.label('lampa 6,3 V', [lx, 0.72, lz], b > 0.05 ? c.warning : c.text3);
    const L1 = screw([lx - 0.14, 0.06, lz - 0.14]), L2 = screw([lx + 0.14, 0.06, lz - 0.14]);
    const cm = meter(lab, [1.55, 0, 0.55], { frac: Tt.Ic / 0.2, sym: 'mA', text: narrow ? `${fmt(Tt.Ic * 1e3, 0)} mA` : `kollektor ${fmt(Tt.Ic * 1e3, 0)} mA · 0–200 mA` });
    // simlar
    const fC = { on: onC, t: anim, speed: 0.15 + 0.45 * clamp(Tt.Ic / 0.15, 0, 1) }, fB = { on: onB, t: anim, speed: 0.06 + 0.2 * clamp(Tt.Ib / 0.002, 0, 1), dots: c.dark ? '#67e8f9' : '#0891b2' };
    const zr = 0.95, xr = lx + 0.45;
    wire(lab, [BP, [BP[0] - 0.08, BP[1], BP[2]], [-2.76, LO, bz], [-2.76, LO, zr], [xr, LO, zr], [xr, LO, lz - 0.14], [L2[0], LO, L2[2]], L2], col.red, { ...fC, on: onC || onB });
    wire(lab, [lugs[2], [lugs[2][0] + 0.08, lugs[2][1], pz], [lugs[2][0] + 0.08, LO, pz], [lugs[2][0] + 0.08, LO, zr]], col.red, fB);
    wire(lab, [lugs[0], [lugs[0][0] + 0.2, lugs[0][1], pz], [lugs[0][0] + 0.2, LO, pz], [lugs[0][0] + 0.2, LO, bz], BM], col.black);
    wire(lab, [lugs[1], [lugs[1][0] + 0.14, lugs[1][1], pz], [lugs[1][0] + 0.14, 0.22, bm.plus[2]], bm.plus], col.red, fB);
    wire(lab, [bm.minus, lift(bm.minus, 0.08), [ra0[0], 0.08, bm.minus[2]], lift(ra0, 0.08), ra0], col.red, fB);
    wire(lab, [rb0, lift(rb0, 0.08), [Bt[0], 0.08, rb0[2]], lift(Bt, 0.08), Bt], col.red, fB);
    wire(lab, [L1, lift(L1, 0.12), [cm.plus[0], 0.12, L1[2]], [cm.plus[0], 0.12, cm.plus[2]], cm.plus], col.red, fC);
    wire(lab, [cm.minus, lift(cm.minus, 0.16), [Kt[0], 0.16, cm.minus[2]], lift(Kt, 0.16), Kt], col.red, fC);
    wire(lab, [E, lift(E, LO), [E[0], LO, bz - 0.25], [BM[0] + 0.1, LO, bz - 0.25], [BM[0] + 0.1, LO, bz], BM], col.black, { ...fC, on: onC || onB });
  }

  /* ---------------------------------------------------------------- chizish */
  function draw(ctx, stage, cfg) {
    const view = VIEW[cfg.mode] || VIEW.thermo, anim = cfg.anim || 0;
    narrow = stage.w < 480;
    lab.begin(ctx, stage, view.begin);
    const c = lab.colors;
    if (cfg.mode === 'thermo') {
      thermoScene(cfg.R, anim);
      lab.finish(narrow ? `${fmt(cfg.R.T, 1)} °C` : `3D laboratoriya · suv ${fmt(cfg.R.T, 1)} °C`, narrow ? 'Plitka dastasini aylantiring' : 'Mis g‘altak va termorezistor bir xil suvda qiziydi');
      const w = narrow ? (stage.w - 30) / 2 : Math.min(205, (stage.w - 300) / 2), h = narrow ? 58 : 80, y = 34, x = narrow ? 10 : stage.w - 2 * w - 22;
      insetMetal(ctx, c, x, y, w, h, cfg.R.T, anim);
      insetSemi(ctx, c, x + w + (narrow ? 10 : 12), y, w, h, cfg.R.nfree, anim);
    } else if (cfg.mode === 'photo') {
      photoScene(cfg.F, anim);
      const dim = cfg.F.room < 10;
      lab.finish(narrow ? `E = ${fmt(cfg.F.E, cfg.F.E < 10 ? 1 : 0)} lk` : `3D laboratoriya · yoritilganlik E = ${fmt(cfg.F.E, cfg.F.E < 10 ? 1 : 0)} lk`, narrow ? 'Lampani suring' : 'Lampani optik skamya bo‘ylab suring');
      if (dim) {
        ctx.fillStyle = `rgba(2,6,23,${cfg.F.room < 1 ? 0.45 : 0.28})`; ctx.fillRect(0, 0, stage.w, stage.h);
        tag(ctx, cfg.F.room < 1 ? 'qorong‘i xona' : 'xira xona', 14, 44, { color: c.text2, bg: c.bg2, font: '600 10px system-ui' });
      }
    } else if (cfg.mode === 'lat') {
      latScene(cfg.L, anim);
      const L = cfg.L, kind = L.dope === 'i' ? `sof ${L.sym}` : L.dope === 'n' ? `n-tip: ${L.sym} + P` : `p-tip: ${L.sym} + B`;
      lab.finish(narrow ? `${kind} · ${fmt(L.T, 0)} K` : `${kind} · T = ${fmt(L.T, 0)} K (${fmt(L.T - 273.15, 0)} °C)`, `erkin elektronlar ${L.e.length} · kovaklar ${L.h.length}`);
    } else if (cfg.mode === 'vax') {
      vaxScene(cfg.V, anim);
      lab.finish(narrow ? cfg.V.short : `3D laboratoriya · ${cfg.V.short}`, narrow ? 'Dastani aylantiring' : 'Manba dastasini aylantiring, qutb almashtirgichni bosing');
      const w = narrow ? stage.w - 20 : Math.min(330, stage.w * 0.42), h = narrow ? 56 : 72, x = narrow ? 10 : stage.w - w - 12;
      pnInset(ctx, c, x, narrow ? 34 : 12, w, h, cfg.V.dep, cfg.V.flux, anim);
    } else if (cfg.mode === 'rect') {
      rectScene(cfg.Q, anim);
      lab.finish(narrow ? (cfg.Q.bridge ? 'Diod ko‘prigi' : 'Bitta diod') : `3D laboratoriya · ${cfg.Q.bridge ? 'to‘liq davrli (diod ko‘prigi)' : 'yarim davrli (bitta diod)'} to‘g‘rilagich`, narrow ? 'Ossillografda kirish va chiqish' : 'Ossillograf: sariq — kirish, havorang — chiqish kuchlanishi');
    } else {
      trScene(cfg.T, anim);
      lab.finish(narrow ? `U = ${fmt(cfg.T.U, 2)} V` : `3D laboratoriya · potensiometr U = ${fmt(cfg.T.U, 2)} V`, narrow ? 'Dastani aylantiring' : 'Potensiometr dastasini aylantiring');
    }
  }

  return {
    lab, draw,
    setMode(m) { if (VIEW[m] && m !== mode) { mode = m; lab.reset(); } },
    /** Tutqichlar yo'li (lab.nearest uchun). */
    heatAt: (f) => heatAt(f), knobAt: (f) => knobAt(f), potAt: (f) => potAt(f),
    lampAt: (d) => [lampX(d) - 0.06, YA, 0],
  };
}
