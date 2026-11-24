// Tok ishi, quvvati va Joul–Lens qonuni — 360° 3D laboratoriya sahnasi (simulations/joule.html).
// Holat va fizika joule.js / joule-physics.js da o'zgarmaydi; bu yerda faqat asboblar, simlar va sahnadagi tutqichlar.
// Old tomon −z (kuzatuvchi tomoni), stol usti y = 0. Asboblar boshlang'ich kamera (old-o'ng tomondan) bir-birini to'smaydigan qilib qo'yilgan.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, path, ring } from './apparatus-3d.js?v=20261124-n3';
import { ball, hoop, panel, post, wire, meter, supply, display, knife, thermometer, glow, shell } from './devices-3d.js?v=20261124-n3';
import { tempRGB } from './bb-physics.js';
import { clamp, fmt } from './sim-kit.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const rgb = (a, o = 1) => `rgba(${a[0]},${a[1]},${a[2]},${o})`;
const lift = (p, y) => [p[0], y, p[2]];
const LO = 0.03, HI = 0.055; // stol ustidagi simlar: kesishgan joyda biri ikkinchisining ustidan o'tadi
export const COL = (c) => ({ red: c.dark ? '#f87171' : '#b91c1c', black: c.dark ? '#cbd5e1' : '#1f2937', blue: c.dark ? '#60a5fa' : '#1d4ed8', yellow: c.dark ? '#facc15' : '#a16207', brown: c.dark ? '#d6a77a' : '#92400e', wood: c.dark ? '#7c5a3a' : '#c08a55' });

/** Har tajribaning boshlang'ich kamerasi va sahna markazi. */
const VIEW = {
  kal: { begin: { target: [0.15, 0.6, 0], focal: 2.2 }, camera: { yaw: -0.5, pitch: 0.35, zoom: 1 } },
  lamp: { begin: { target: [0, 0.45, 0], focal: 2.3 }, camera: { yaw: -0.45, pitch: 0.45, zoom: 1 } },
  home: { begin: { target: [0, 0.8, 0.25], focal: 2.05 }, camera: { yaw: -0.3, pitch: 0.3, zoom: 1 } },
};
/** Kalorimetr markazlari (bitta yoki ikkita). */
export const cupCenters = (n) => (n === 1 ? [[0.75, -0.2]] : [[0.12, -0.2], [1.42, -0.2]]);
/** LATR dastasi uchi: f = 0…1 (old-chapdan orqa orqali old-o'ngga, 270°; yuqoridan qaraganda soat mili bo'yicha). */
export const LATR_C = [-2.15, 0.56, 0.05];
export const latrPoint = (f) => { const a = (135 + 270 * clamp(f, 0, 1)) * DEG; return [LATR_C[0] + Math.cos(a) * 0.3, LATR_C[1] + 0.07, LATR_C[2] - Math.sin(a) * 0.3]; };
/** Uy tarmog'i: iste'molchilar joyi (konditsioner devorda). */
export const SLOTS = { fridge: [-2.2, 0.3], washer: [-1.1, 0.3], heater: [0, 0.3], tv: [1.1, 0.3], ac: [2.2, 0.3], kettle: [-2.2, -0.55], iron: [-1.1, -0.55], pc: [0, -0.55], lamp: [1.1, -0.55], led: [2.2, -0.55] };

export function createJouleLab() {
  const lab = createLab3D();
  let mode = 'kal', knobAt = () => [0, 0, 0], narrow = false; // narrow — tor ekran: ikkinchi darajali yozuvlar yashiriladi, asbob yozuvlari qisqa
  lab.reset = () => Object.assign(lab.camera, VIEW[mode].camera);
  lab.reset();

  /* ---------------------------------------------------------------- 1) Kalorimetr */
  function calorimeter([cx, cz], part, T, m, t, label) {
    const c = lab.colors, depth = 0.25 + (0.5 * (m - 50)) / 250, surf = 0.09 + depth;
    // tashqi alyuminiy idish va ichki stakan (devorlar shaffof — ichi ko'rinadi), ostidagi probka halqa
    lab.rod([cx, 0, cz], [cx, 0.03, cz], 0.37, c.text3, 28);
    lab.rod([cx, 0.03, cz], [cx, 0.9, cz], 0.36, alpha(c.text3, 0.16), 28);
    lab.rod([cx, 0.06, cz], [cx, 0.88, cz], 0.29, alpha(c.text3, 0.12), 28);
    for (const y of [0.03, 0.9]) hoop(lab, [cx, y, cz], 0.36, c.text3, 0.012, 28);
    hoop(lab, [cx, 0.88, cz], 0.29, c.text3, 0.01, 28);
    lab.rod([cx, 0.07, cz], [cx, surf, cz], 0.285, alpha(c.dark ? '#38bdf8' : '#0ea5e9', 0.3), 28);
    hoop(lab, [cx, surf, cz], 0.285, alpha(c.dark ? '#bae6fd' : '#0284c7', 0.8), 0.006, 28);
    // nixrom spiral va uning tutqichlari (qizishi quvvatga qarab)
    const hot = clamp(part.P / 40, 0, 1), sc = hot > 0.05 ? `rgb(${Math.round(120 + 100 * hot)},${Math.round(113 - 40 * hot)},${Math.round(108 - 70 * hot)})` : c.text2;
    const a = [cx - 0.17, 0.2, cz + 0.05], b = [cx + 0.17, 0.2, cz + 0.05], pts = [];
    for (let i = 0; i <= 90; i++) { const u = i / 90, th = u * 9 * TAU; pts.push([a[0] + (b[0] - a[0]) * u, 0.2 + 0.055 * Math.cos(th), cz + 0.05 + 0.055 * Math.sin(th)]); }
    path(lab, pts, sc, 0.008);
    const L = [cx - 0.17, 1.06, cz + 0.05], R = [cx + 0.17, 1.06, cz + 0.05];
    for (const [top, end] of [[L, a], [R, b]]) lab.rod([top[0], 0.98, top[2]], end, 0.01, c.text2, 6);
    // konveksiya oqimi va pufakchalar
    if (part.P > 0.5) for (let k = 0; k < 6; k++) { const ph = (t * (0.35 + 0.05 * k) + k / 6) % 1; ball(lab, [cx - 0.13 + 0.05 * k, 0.26 + ph * (surf - 0.3), cz + 0.12], 0.012, alpha('#ffffff', 0.55 * (1 - ph)), 3); }
    if (T > 80) { const nb = Math.round(((T - 80) / 20) * 14); for (let k = 0; k < nb; k++) { const ph = (t * (0.6 + (k % 4) * 0.15) + k * 0.37) % 1; ball(lab, [cx - 0.22 + ((k * 0.073) % 0.44), 0.12 + ph * (surf - 0.14), cz - 0.15 + ((k * 0.11) % 0.3)], 0.014 + (k % 3) * 0.004, alpha('#ffffff', 0.7), 3); } }
    // ebonit qopqoq, klemmalar va termometr (0…100 °C)
    lab.rod([cx, 0.9, cz], [cx, 0.97, cz], 0.4, c.dark ? c.bg : c.text, 28);
    for (const p of [L, R]) { lab.rod([p[0], 0.97, p[2]], p, 0.028, c.text3, 10); ball(lab, p, 0.03, c.text3, 4); }
    thermometer(lab, [cx, 0.2, cz - 0.13], [cx, 1.72, cz - 0.13], (T / 100) * 0.94 + 0.03);
    if (T >= 99.95) for (let k = 0; k < 6; k++) { const ph = (t * 0.5 + k / 6) % 1; ball(lab, [cx + (k % 2 ? 0.3 : -0.3) + Math.sin(ph * 6 + k) * 0.05, 1.0 + ph * 0.8, cz], 0.05 + 0.08 * ph, alpha(c.text3, 0.22 * (1 - ph)), 4); }
    lab.label(label, [cx, 0.02, cz - 0.5], c.text);
    return { L, R };
  }

  function kalScene(k, anim) {
    const c = lab.colors, col = COL(c), on = k.I > 0, cups = cupCenters(k.n);
    const ps = supply(lab, [-2.0, 0, 0.1], { text: `${fmt(k.E, 1)} V`, title: narrow ? '' : 'Manba 0–12 V', frac: k.E / 12, id: 'knob', marks: !narrow });
    knobAt = ps.knob;
    display(lab, [-2.5, 0, -0.75], { w: 0.5, h: 0.3, d: 0.2, text: k.clock, title: narrow ? '' : 'Sekundomer', color: k.running ? c.success : c.text2 });
    lab.rod([-2.5, 0.3, -0.65], [-2.5, 0.35, -0.65], 0.03, c.text2, 10);
    const sw = knife(lab, [-1.2, 0, -0.75], k.closed, 'sw');
    if (!narrow) lab.label(k.closed ? 'kalit ulangan' : 'kalit uzilgan', [-1.2, 0.02, -0.98], k.closed ? c.success : c.text3);
    const am = meter(lab, [-1.0, 0, 0.55], { frac: k.I / k.Ir, sym: 'A', text: narrow ? `${fmt(k.I, 2)} A` : `${fmt(k.I, 2)} A · 0–${fmt(k.Ir, k.Ir < 1 ? 1 : 0)} A` });
    const vm = meter(lab, [2.35, 0, 0.35], { frac: k.U / 15, sym: 'V', text: narrow ? `${fmt(k.U, 2)} V` : `${fmt(k.U, 2)} V · 0–15 V` });
    const ends = cups.map((p, i) => calorimeter(p, k.parts[i], k.T[i], k.m, anim, k.labels[i]));
    const L0 = ends[0].L, R0 = ends[k.n - 1].R;
    const flow = { on, t: anim, speed: 0.25 + 0.35 * Math.min(1, k.I / 5) };
    // manba + → kalit → ampermetr → spiral(lar) → manba − ; voltmetr spirallarga parallel
    wire(lab, [ps.plus, lift(ps.plus, LO), [ps.plus[0], LO, sw.a[2]], lift(sw.a, LO), sw.a], col.red, flow);
    wire(lab, [sw.b, lift(sw.b, LO), [sw.b[0], LO, am.plus[2]], lift(am.plus, LO), am.plus], col.red, flow);
    wire(lab, [am.minus, lift(am.minus, 1.25), [L0[0], 1.25, am.minus[2]], lift(L0, 1.25), L0], col.red, flow);
    wire(lab, [vm.plus, lift(vm.plus, 1.4), [L0[0] - 0.05, 1.4, vm.plus[2]], [L0[0] - 0.05, 1.4, L0[2]], L0], col.blue, { width: 0.011 });
    wire(lab, [vm.minus, lift(vm.minus, 1.32), [R0[0] + 0.05, 1.32, vm.minus[2]], [R0[0] + 0.05, 1.32, R0[2]], R0], col.blue, { width: 0.011 });
    if (k.conn === 'series') wire(lab, [ends[0].R, lift(ends[0].R, 1.18), lift(ends[1].L, 1.18), ends[1].L], col.yellow, flow);
    if (k.conn === 'parallel') {
      wire(lab, [L0, lift(L0, 1.16), [L0[0], 1.16, L0[2] - 0.12], [ends[1].L[0], 1.16, L0[2] - 0.12], lift(ends[1].L, 1.16), ends[1].L], col.red, flow);
      wire(lab, [ends[0].R, lift(ends[0].R, 1.22), [ends[0].R[0], 1.22, R0[2] + 0.12], [R0[0], 1.22, R0[2] + 0.12], lift(R0, 1.22), R0], col.black, flow);
    }
    const ex = R0[0] + 0.45;
    wire(lab, [R0, lift(R0, 1.1), [ex, 1.1, R0[2]], [ex, HI, R0[2]], [ex, HI, -1.02], [ps.minus[0], HI, -1.02], lift(ps.minus, HI), ps.minus], col.black, flow);
  }

  /* ---------------------------------------------------------------- 2) Lampa */
  function latr(l) {
    const c = lab.colors, [x, y, z] = LATR_C;
    lab.rod([x, 0, z], [x, y - 0.015, z], 0.42, c.text3, 32);
    lab.rod([x, y - 0.015, z], [x, y, z], 0.39, c.bg2, 32);
    for (let k = 0; k <= 25; k++) { const a = (135 + 270 * (k / 25)) * DEG, big = k % 5 === 0, r0 = big ? 0.29 : 0.32; lab.line([x + Math.cos(a) * r0, y + 0.004, z - Math.sin(a) * r0], [x + Math.cos(a) * 0.37, y + 0.004, z - Math.sin(a) * 0.37], c.text, big ? 1.4 : 0.8); }
    lab.rod([x, y, z], [x, y + 0.07, z], 0.11, c.dark ? c.bg : c.text, 20);
    const tip = latrPoint(l.U / l.Umax);
    lab.rod([x, y + 0.072, z], tip, 0.012, c.danger, 6); ball(lab, tip, 0.024, c.danger, 3);
    lab.handle('latr', tip, 0.16);
    if (!narrow) for (const f of [0, 0.5, 1]) { const q = latrPoint(f); lab.label(fmt(l.Umax * f, 0), [x + (q[0] - x) * 1.7, y + 0.02, z + (q[2] - z) * 1.7], c.text2); }
    path(lab, [[x - 0.3, 0.12, z + 0.3], [x - 0.42, 0.03, z + 0.6], [x - 0.3, 0.03, 1.05]], c.text, 0.022);
    if (!narrow) lab.label(l.small ? 'LATR · ~220 V → 0–8 V' : 'LATR · ~220 V → 0–250 V', [x, 0.02, z - 0.62], c.text);
    // chiqish klemmalari o'ng yonda (+x): o1 — old, o2 — orqa
    const o1 = post(lab, [x + 0.4, 0.2, z - 0.1], c.text2, 0.08, 0.024, [1, 0, 0]), o2 = post(lab, [x + 0.4, 0.2, z + 0.1], c.text2, 0.08, 0.024, [1, 0, 0]);
    return { o1, o2 };
  }
  function bulb(x, L, part) {
    const c = lab.colors, k = L.Un < 50 ? 0.6 : 1, T = part ? part.T : 293, b = part ? part.b : 0, col = tempRGB(Math.max(1000, T));
    const y0 = 0.07, ys = y0 + 0.2 * k, yb = ys + 0.13 * k, cy = yb + 0.1 * k + 0.24 * k, r = 0.24 * k;
    lab.rod([x, y0, 0], [x, ys, 0], 0.1 * k, c.dark ? c.text3 : c.text, 18);
    lab.rod([x, ys, 0], [x, yb, 0], 0.07 * k, c.dark ? '#facc15' : '#b45309', 16);
    for (let q = 0; q < 4; q++) hoop(lab, [x, ys + (q + 0.5) * 0.03 * k, 0], 0.072 * k, c.dark ? '#fde68a' : '#78350f', 0.004, 16);
    // shisha kolba: bo'yin va shar
    lab.rod([x, yb, 0], [x, yb + 0.12 * k, 0], 0.075 * k, b > 0.004 ? rgb(col, Math.min(0.75, 0.15 + 0.5 * b)) : alpha(c.text3, 0.2), 16);
    ball(lab, [x, cy, 0], r, b > 0.004 ? rgb(col, Math.min(0.75, 0.12 + 0.55 * b)) : alpha(c.text3, 0.18), 8);
    // ushlagich, elektrodlar va volfram tola (zigzag)
    lab.rod([x, yb + 0.02 * k, 0], [x, cy - 0.05 * k, 0], 0.012 * k, alpha(c.text3, 0.7), 6);
    for (const s of [-1, 1]) lab.rod([x + s * 0.02 * k, yb + 0.03 * k, 0], [x + s * 0.12 * k, cy, 0], 0.004, c.text2, 4);
    const fil = T < 850 ? c.text2 : rgb(col), pts = [];
    for (let q = 0; q <= 48; q++) { const u = q / 48; pts.push([x - 0.12 * k + 0.24 * k * u, cy + 0.05 * k * Math.sin(Math.PI * u) + 0.012 * k * Math.sin(u * 30 * Math.PI), 0]); }
    path(lab, pts, fil, b > 0.05 ? 0.006 : 0.004);
    if (b > 0.004) glow(lab, [x, cy, 0], r + 0.5 * k * Math.sqrt(Math.min(b, 1.6)), col, Math.min(0.6, 0.1 + 0.4 * b));
    if (part) lab.label(`${fmt(part.P, part.P < 10 ? 2 : 1)} W`, [x, cy + r + 0.2, 0], b > 0.02 ? c.warning : c.text3);
    lab.label(`${L.name}${L.Un > 50 ? ', 220 V' : ''}`, [x, 0.02, -0.45], c.text);
    // patron klemmalari taxta ustida (tik vintlar)
    return { tl: post(lab, [x - 0.17, 0.07, -0.2], c.text3, 0.06, 0.02, [0, 1, 0]), tr: post(lab, [x + 0.17, 0.07, -0.2], c.text3, 0.06, 0.02, [0, 1, 0]) };
  }
  function lampScene(l, anim) {
    const c = lab.colors, col = COL(c), on = l.I > 1e-4, X = [0.85, 2.0];
    const { o1, o2 } = latr(l);
    const vm = meter(lab, [-1.3, 0, 0.15], { w: 0.56, h: 0.46, frac: l.U / l.Vmax, sym: 'V', ac: true, text: narrow ? `${fmt(l.U, l.small ? 1 : 0)} V` : `${fmt(l.U, l.small ? 1 : 0)} V · 0–${l.Vmax} V` });
    const am = meter(lab, [-0.15, 0, 0.15], { frac: l.I / l.Ir, sym: 'A', ac: true, text: narrow ? `${fmt(l.I, 3)} A` : `${fmt(l.I, 3)} A · 0–${fmt(l.Ir, l.Ir < 1 ? 1 : 0)} A` });
    lab.box(0.2, 0, -0.3, 2.45, 0.07, 0.6, col.wood);
    const T = l.lamps.map((L, i) => bulb(X[i], L, l.parts[i]));
    const flow = { on, t: anim, speed: 0.4 }, t0 = T[0].tl;
    // LATR o2 → ampermetr → lampa(lar) → LATR o1; voltmetr LATR chiqishiga parallel
    wire(lab, [o2, [o2[0] + 0.1, o2[1], o2[2]], [o2[0] + 0.1, LO, o2[2]], [o2[0] + 0.1, LO, -0.35], [am.plus[0], LO, -0.35], lift(am.plus, LO), am.plus], col.brown, flow);
    wire(lab, [vm.plus, lift(vm.plus, 0.3), [o2[0] - 0.03, 0.3, vm.plus[2]], [o2[0] - 0.03, 0.3, o2[2]], [o2[0] - 0.03, o2[1] + 0.02, o2[2]]], col.blue, { width: 0.01 });
    wire(lab, [vm.minus, lift(vm.minus, 0.38), [o1[0] - 0.03, 0.38, vm.minus[2]], [o1[0] - 0.03, 0.38, o1[2]], [o1[0] - 0.03, o1[1] + 0.02, o1[2]]], col.blue, { width: 0.01 });
    wire(lab, [am.minus, lift(am.minus, LO), [am.minus[0], LO, -0.45], [t0[0], LO, -0.45], [t0[0], 0.17, -0.45], [t0[0], 0.17, t0[2]], t0], col.brown, flow);
    let end = T[0].tr;
    if (T.length === 2 && l.series) { wire(lab, [T[0].tr, lift(T[0].tr, 0.2), lift(T[1].tl, 0.2), T[1].tl], col.yellow, flow); end = T[1].tr; }
    else if (T.length === 2) {
      wire(lab, [t0, lift(t0, 0.25), [t0[0], 0.25, -0.38], [T[1].tl[0], 0.25, -0.38], lift(T[1].tl, 0.25), T[1].tl], col.brown, flow);
      wire(lab, [T[0].tr, lift(T[0].tr, 0.2), lift(T[1].tr, 0.2), T[1].tr], col.blue, flow);
      end = T[1].tr;
    }
    const ex = end[0] + 0.25, rx = o1[0] + 0.2;
    wire(lab, [end, lift(end, 0.17), [ex, 0.17, end[2]], [ex, HI, end[2]], [ex, HI, -0.7], [rx, HI, -0.7], [rx, HI, o1[2]], [rx, o1[1], o1[2]], o1], col.blue, flow);
  }

  /* ---------------------------------------------------------------- 3) Uy tarmog'i */
  function appliance(id, [x, z], live, anim) {
    const c = lab.colors, warm = alpha(c.warning, 0.22), lit = c.dark ? '#93c5fd' : '#3b82f6', screen = live ? lit : c.dark ? c.bg : c.text;
    let top = 0.5;
    if (id === 'kettle') {
      lab.rod([x, 0, z], [x, 0.04, z], 0.17, c.text2, 18); lab.rod([x, 0.04, z], [x, 0.36, z], 0.14, c.text3, 18);
      lab.rod([x, 0.36, z], [x, 0.39, z], 0.1, c.text2, 14); ball(lab, [x, 0.41, z], 0.025, c.text2, 3);
      lab.rod([x - 0.12, 0.22, z], [x - 0.25, 0.34, z], 0.028, c.text3, 8);
      path(lab, [[x + 0.13, 0.09, z], [x + 0.23, 0.13, z], [x + 0.23, 0.3, z], [x + 0.13, 0.34, z]], c.text2, 0.022);
      if (live) { lab.rod([x, 0.05, z], [x, 0.3, z], 0.145, warm, 18); for (let k = 0; k < 4; k++) { const ph = (anim * 0.4 + k / 4) % 1; ball(lab, [x - 0.26 - ph * 0.08, 0.36 + ph * 0.4, z], 0.03 + 0.05 * ph, alpha(c.text3, 0.25 * (1 - ph)), 4); } }
      top = 0.45;
    } else if (id === 'iron') {
      const s = (dx, dz) => [x + dx, 0.06, z + dz], b = (dx, dz) => [x + dx, 0.02, z + dz];
      const shape = [[-0.25, 0], [-0.08, -0.12], [0.16, -0.12], [0.16, 0.12], [-0.08, 0.12]];
      lab.face(shape.map(([u, v]) => s(u, v)), c.text3); lab.face(shape.map(([u, v]) => b(u, v)), c.text2);
      for (let i = 0; i < shape.length; i++) { const p = shape[i], q = shape[(i + 1) % shape.length]; lab.face([b(...p), b(...q), s(...q), s(...p)], c.text2); }
      lab.box(x - 0.1, 0.06, z - 0.08, 0.24, 0.08, 0.16, shell(c));
      lab.rod([x - 0.08, 0.14, z], [x - 0.04, 0.25, z], 0.02, c.text2, 8); lab.rod([x + 0.12, 0.14, z], [x + 0.1, 0.25, z], 0.02, c.text2, 8);
      lab.rod([x - 0.08, 0.25, z], [x + 0.12, 0.25, z], 0.03, c.text2, 10);
      if (live) lab.face(shape.map(([u, v]) => [x + u * 1.15, 0.012, z + v * 1.3]), alpha(c.warning, 0.45));
      top = 0.33;
    } else if (id === 'heater') {
      for (let k = 0; k < 7; k++) lab.box(x - 0.27 + k * 0.08, 0.08, z - 0.12, 0.05, 0.42, 0.24, c.text3);
      lab.rod([x - 0.27, 0.46, z], [x + 0.25, 0.46, z], 0.02, c.text2, 8); lab.rod([x - 0.27, 0.12, z], [x + 0.25, 0.12, z], 0.02, c.text2, 8);
      for (const s of [-1, 1]) lab.box(x + s * 0.2 - 0.03, 0, z - 0.15, 0.06, 0.08, 0.3, c.text2);
      if (live) { lab.box(x - 0.31, 0.06, z - 0.16, 0.62, 0.48, 0.32, warm); for (let k = 0; k < 3; k++) { const ph = (anim * 0.3 + k / 3) % 1; lab.box(x - 0.25, 0.52 + ph * 0.35, z - 0.1, 0.5, 0.02, 0.2, alpha(c.warning, 0.18 * (1 - ph))); } }
      top = 0.6;
    } else if (id === 'washer') {
      lab.box(x - 0.25, 0, z - 0.25, 0.5, 0.56, 0.5, shell(c)); lab.box(x - 0.25, 0.46, z - 0.255, 0.5, 0.1, 0.01, c.text3);
      ring(lab, [x, 0.24, z - 0.256], 0.15, c.text2, 'z', 0.018);
      const n = 24, disc = Array.from({ length: n }, (_, i) => [x + 0.14 * Math.cos((i * TAU) / n), 0.24 + 0.14 * Math.sin((i * TAU) / n), z - 0.254]);
      lab.face(disc, live ? alpha(c.primary, 0.55) : alpha(c.text3, 0.35));
      const a = live ? anim * 8 : 0.4;
      for (const s of [0, Math.PI / 2]) lab.line([x + 0.11 * Math.cos(a + s), 0.24 + 0.11 * Math.sin(a + s), z - 0.258], [x - 0.11 * Math.cos(a + s), 0.24 - 0.11 * Math.sin(a + s), z - 0.258], c.text2, 1.2);
      top = 0.66;
    } else if (id === 'ac') {
      // devorga o'rnatilgan ichki blok (stol ustidagi joy bo'sh qoladi)
      lab.box(x - 0.34, 1.48, 0.72, 0.68, 0.24, 0.21, shell(c));
      for (let k = 0; k < 4; k++) lab.line([x - 0.3, 1.5 + k * 0.012, 0.715], [x + 0.3, 1.5 + k * 0.012, 0.715], c.text3, 1);
      if (live) for (let k = 0; k < 3; k++) { const ph = (anim * 0.5 + k / 3) % 1; lab.face([[x - 0.3, 1.47 - ph * 0.4, 0.7 - ph * 0.35], [x + 0.3, 1.47 - ph * 0.4, 0.7 - ph * 0.35], [x + 0.3, 1.43 - ph * 0.4, 0.66 - ph * 0.35], [x - 0.3, 1.43 - ph * 0.4, 0.66 - ph * 0.35]], alpha(c.primary, 0.3 * (1 - ph))); }
      return 1.72;
    } else if (id === 'fridge') {
      lab.box(x - 0.2, 0, z - 0.2, 0.4, 0.82, 0.4, shell(c));
      lab.line([x - 0.2, 0.55, z - 0.205], [x + 0.2, 0.55, z - 0.205], c.text3, 1.2);
      for (const [y0, y1] of [[0.6, 0.75], [0.3, 0.5]]) lab.rod([x + 0.15, y0, z - 0.22], [x + 0.15, y1, z - 0.22], 0.012, c.text3, 6);
      top = 0.82;
    } else if (id === 'tv') {
      lab.box(x - 0.12, 0, z - 0.08, 0.24, 0.02, 0.16, c.text2); lab.rod([x, 0.02, z], [x, 0.14, z], 0.02, c.text2, 8);
      lab.box(x - 0.3, 0.14, z - 0.02, 0.6, 0.36, 0.04, c.dark ? c.text3 : c.text);
      panel(lab, x - 0.28, 0.16, x + 0.28, 0.48, z - 0.024, screen);
      top = 0.5;
    } else if (id === 'pc') {
      lab.box(x - 0.1, 0, z - 0.07, 0.2, 0.02, 0.14, c.text2); lab.rod([x - 0.05, 0.02, z], [x - 0.05, 0.12, z], 0.018, c.text2, 8);
      lab.box(x - 0.24, 0.12, z - 0.02, 0.38, 0.26, 0.03, c.dark ? c.text3 : c.text);
      panel(lab, x - 0.22, 0.14, x + 0.12, 0.36, z - 0.024, screen);
      lab.box(x + 0.17, 0, z - 0.15, 0.12, 0.34, 0.3, c.dark ? c.text3 : c.text);
      top = 0.38;
    } else {
      // stol lampasi: cho'g'lanma (lamp) yoki LED (led)
      const led = id === 'led', col = tempRGB(led ? 4200 : 2700);
      lab.rod([x, 0, z], [x, 0.03, z], 0.13, c.text2, 16); lab.rod([x, 0.03, z], [x, 0.26, z], 0.016, c.text2, 8);
      lab.rod([x, 0.26, z], [x, 0.32, z], 0.04, c.dark ? '#facc15' : '#b45309', 10);
      if (led) { lab.rod([x, 0.32, z], [x, 0.39, z], 0.05, live ? rgb(col, 0.9) : shell(c), 12); ball(lab, [x, 0.41, z], 0.06, live ? rgb(col, 0.9) : shell(c), 5); }
      else ball(lab, [x, 0.4, z], 0.075, live ? rgb(col, 0.75) : alpha(c.text3, 0.3), 6);
      if (live) glow(lab, [x, 0.4, z], 0.22, col, 0.45);
      top = 0.48;
    }
    return top;
  }

  function homeScene(h, anim) {
    const c = lab.colors, col = COL(c), on = h.I > 0, zf = 0.935;
    lab.box(-2.75, 0, 0.95, 5.5, 1.95, 0.08, c.sunken);
    // hisoblagich (kVt·soat) va kiruvchi kabel; L chiqishi o'ngda, N chapda
    lab.box(-2.55, 1.0, 0.77, 0.8, 0.82, 0.18, c.text3);
    panel(lab, -2.48, 1.5, -1.82, 1.74, 0.765, c.dark ? c.bg : c.text);
    lab.label(narrow ? h.reading : `${h.reading} kVt·soat`, [-2.15, 1.62, 0.76], c.success);
    ball(lab, [-1.88, 1.38, 0.76], 0.028, h.pulse ? c.danger : alpha(c.danger, 0.3), 4);
    if (h.pulse) glow(lab, [-1.88, 1.38, 0.74], 0.1, [239, 68, 68], 0.5, 4, 20);
    if (!narrow) { lab.label(`${h.imp} imp/(kVt·soat)`, [-2.25, 1.32, 0.76], c.text2); lab.label('Elektr hisoblagich', [-2.15, 1.93, 0.76], c.text2); }
    wire(lab, [[-2.35, 1.95, 0.86], [-2.35, 1.82, 0.86]], col.blue, { width: 0.02 });
    wire(lab, [[-1.95, 1.95, 0.86], [-1.95, 1.82, 0.86]], col.brown, { width: 0.02 });
    // avtomat saqlagich (DIN reyka); richag — tutqich
    lab.box(-1.4, 1.33, 0.9, 0.6, 0.06, 0.05, c.text3);
    lab.box(-1.23, 1.12, 0.79, 0.26, 0.48, 0.15, shell(c));
    const up = !h.tripped, lever = [-1.1, up ? 1.47 : 1.27, 0.76];
    lab.box(-1.14, 1.3, 0.785, 0.08, 0.2, 0.01, c.text2);
    lab.box(lever[0] - 0.035, lever[1] - 0.05, 0.75, 0.07, 0.1, 0.035, up ? c.success : c.danger);
    lab.handle('breaker', lever, 0.2);
    lab.label(`C${h.In} · ${up ? 'I' : 'O'}`, [-1.1, 1.75, 0.78], up ? c.success : c.danger);
    // simlar: L (faza) avtomat orqali, N (nol) to'g'ridan; shina bo'ylab tok nuqtalari
    const flow = { on, t: anim, speed: 0.3 + 0.03 * Math.min(30, h.I) };
    wire(lab, [[-1.95, 1.0, 0.86], [-1.95, 0.96, zf], [-1.4, 0.96, zf], [-1.4, 1.68, zf], [-1.1, 1.68, zf], [-1.1, 1.6, 0.86]], col.brown, flow);
    wire(lab, [[-1.1, 1.12, 0.86], [-1.1, 1.02, zf], [2.65, 1.02, zf]], col.brown, flow);
    wire(lab, [[-2.35, 1.0, 0.86], [-2.35, 0.88, zf], [2.65, 0.88, zf]], col.blue, flow);
    lab.label('L', [2.55, 1.1, zf], col.brown); lab.label('N', [2.55, 0.8, zf], col.blue);
    for (const id of h.ids) {
      const [x, z] = SLOTS[id], isOn = !!h.on[id], live = isOn && !h.tripped, A = h.P[id], wall = id === 'ac';
      const op = isOn ? 1 : 0.35;
      if (!wall) {
        const dx = z > 0 ? x : x + 0.55, zb = z > 0 ? z + 0.25 : z + 0.3;
        for (const [j, cc] of [[0, col.brown], [1, col.blue]]) {
          const xx = dx + (j ? 0.035 : -0.035), yb = j ? 0.88 : 1.02;
          path(lab, [[xx, yb, zf], [xx, 0.02, zf - 0.02], [xx, 0.02, zb], [x + (j ? 0.035 : -0.035), 0.02, zb]], alpha(cc, op), 0.008);
        }
      } else for (const [j, cc] of [[0, col.brown], [1, col.blue]]) path(lab, [[x + (j ? 0.05 : -0.05), j ? 0.88 : 1.02, zf], [x + (j ? 0.05 : -0.05), 1.48, zf]], alpha(cc, op), 0.008);
      const top = appliance(id, [x, z], live, anim);
      const power = A >= 1000 ? `${fmt(A / 1000, 1)} kW` : `${A} W`;
      if (!narrow || live) lab.label(narrow ? power : `${h.names[id]} · ${power}`, wall ? [x, top + 0.1, 0.75] : [x, top + 0.12, z], live ? (h.heating[id] ? c.warning : c.success) : c.text2); // tor ekranda — faqat ishlayotganlar quvvati
      ball(lab, wall ? [x - 0.28, 1.66, 0.715] : [x + 0.28, 0.03, z - 0.3], 0.025, live ? c.success : isOn ? c.danger : c.text3, 3);
      lab.handle(`a:${id}`, wall ? [x, 1.6, 0.75] : [x, Math.min(0.3, top * 0.5), z], 0.3);
    }
  }

  /**
   * cfg.mode: 'kal' | 'lamp' | 'home'; cfg.kal / cfg.lamp / cfg.home — joule.js tayyorlagan qiymatlar; cfg.anim — animatsiya vaqti.
   */
  function draw(ctx, stage, cfg) {
    const anim = cfg.anim || 0, view = VIEW[cfg.mode] || VIEW.kal;
    narrow = stage.w < 480;
    lab.begin(ctx, stage, view.begin);
    if (cfg.mode === 'kal') {
      kalScene(cfg.kal, anim);
      lab.finish(cfg.kal.t, 'Kalorimetr devorlari shaffof ko‘rsatilgan · termometr 0–100 °C');
    } else if (cfg.mode === 'lamp') {
      lampScene(cfg.lamp, anim);
      lab.finish('3D laboratoriya', 'Lampa nurlanishi tola temperaturasidan · o‘lchamlar shartli');
    } else {
      homeScene(cfg.home, anim);
      lab.finish(cfg.home.t, 'Iste’molchilar — shartli maketlar · L — faza, N — nol sim');
    }
  }
  return {
    lab, draw,
    /** Rejim almashganda kamera shu tajribaga mos ko'rinishga qaytadi. */
    setMode(m) { if (VIEW[m] && m !== mode) { mode = m; lab.reset(); } },
    /** Manba dastasi uchi (f = 0…1) — lab.nearest uchun; oxirgi chizilgan kadrdagi joyi. */
    knob: (f) => knobAt(f),
    latrPoint,
  };
}
