// Bir nechta 3D sahnada takrorlanadigan laboratoriya asboblari (joule, nuclear, discharge sahnalari).
// Barcha o'lchamlar sahna birligida (lab-3d.js), old tomon −z — kuzatuvchi tomoni. Fizika bu yerda yo'q.
import { alpha, path } from './apparatus-3d.js?v=20261124-n3';
import { clamp } from './sim-kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;

/** Oq korpusli asbob rangi: qorong'i rejimda fon bilan qo'shilib ketmasligi uchun kulrang-ko'k. */
export const shell = (c) => (c.dark ? c.borderStrong : c.bg2);

/** Kam yuzli shar (2n² yuz); uchlar bir marta proyeksiyalanadi — yuzlab zarra uchun yetarlicha tez. */
export function ball(lab, p, r, color, n = 6) {
  const V = [], Q = [];
  for (let i = 0; i <= n; i++) {
    const t = (i * Math.PI) / n, st = Math.sin(t), ct = Math.cos(t), m = i === 0 || i === n ? 1 : 2 * n, row = [], prow = [];
    for (let j = 0; j < m; j++) {
      const f = (j * Math.PI) / n, q = [p[0] + r * st * Math.cos(f), p[1] + r * ct, p[2] + r * st * Math.sin(f)];
      row.push(q); prow.push(lab.project(q));
    }
    V.push(row); Q.push(prow);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < 2 * n; j++) {
    const k = (j + 1) % (2 * n);
    if (i === 0) lab.face([V[0][0], V[1][j], V[1][k]], color, null, 0.7, [Q[0][0], Q[1][j], Q[1][k]]);
    else if (i === n - 1) lab.face([V[i][j], V[n][0], V[i][k]], color, null, 0.7, [Q[i][j], Q[n][0], Q[i][k]]);
    else lab.face([V[i][j], V[i + 1][j], V[i + 1][k], V[i][k]], color, null, 0.7, [Q[i][j], Q[i + 1][j], Q[i + 1][k], Q[i][k]]);
  }
}

/** Gorizontal halqa (normali y bo'ylab). */
export function hoop(lab, center, r, color, wire = 0.012, n = 32) {
  const pt = (i) => [center[0] + r * Math.cos((i * TAU) / n), center[1], center[2] + r * Math.sin((i * TAU) / n)];
  for (let i = 0; i < n; i++) lab.rod(pt(i), pt(i + 1), wire, color, 6);
}

/** Tik tekislikdagi (old tomonga qaragan) to'rtburchak panel. */
export function panel(lab, x0, y0, x1, y1, z, color) {
  lab.face([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], color);
}

/** Klemma: korpusdan chiqqan qisqa ustuncha (odatda old tomonga, −z); uchini qaytaradi. */
export function post(lab, p, color, len = 0.06, r = 0.024, dir = [0, 0, -1]) {
  const tip = p.map((v, i) => v + dir[i] * len);
  lab.rod(p, tip, r, color, 10);
  return tip;
}

/**
 * Yorug'lik gardishi (halo): kameraga qaragan konsentrik shaffof halqalar — markazda yorqin, chetga qarab so'nadi.
 * rgb — [r, g, b]; opacity — markazdagi shaffoflik.
 */
export function glow(lab, p, r, rgb, opacity = 0.5, rings = 7, n = 32) {
  const { yaw, pitch } = lab.camera, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
  const at = (rad, k) => { const a = (k * TAU) / n; return lab.project(p.map((v, i) => v + rad * (Math.cos(a) * right[i] + Math.sin(a) * up[i]))); };
  const flat = [[0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0, 0]]; // soyalash uchun shartli gorizontal normal: gardish qoraymasin
  let inner = null;
  for (let j = 0; j < rings; j++) {
    const outer = Array.from({ length: n }, (_, k) => at((r * (j + 1)) / rings, k)), fill = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity * (1 - (j + 0.5) / rings) ** 2})`;
    if (!inner) lab.face(flat, fill, null, 0.7, outer);
    else for (let k = 0; k < n; k++) lab.face(flat, fill, null, 0.7, [inner[k], outer[k], outer[(k + 1) % n], inner[(k + 1) % n]]);
    inner = outer;
  }
}

/** Sim: tutash quvurchalar; tok bo'lsa ustida harakatlanuvchi zaryad nuqtalari. */
export function wire(lab, pts, color, { on = false, t = 0, speed = 0.5, width = 0.014, dots = null } = {}) {
  path(lab, pts, color, width);
  if (!on) return;
  const L = pts.slice(1).map((p, i) => Math.hypot(...p.map((v, j) => v - pts[i][j]))), total = L.reduce((a, b) => a + b, 0);
  if (total < 1e-6) return;
  const n = Math.max(2, Math.round(total / 0.28)), col = dots || (lab.colors.dark ? '#fde68a' : '#f59e0b');
  for (let k = 0; k < n; k++) {
    let d = (((t * speed + (k * total) / n) % total) + total) % total;
    for (let j = 0; j < L.length; j++) {
      if (d <= L[j]) { const f = d / (L[j] || 1); ball(lab, pts[j].map((v, i) => v + (pts[j + 1][i] - v) * f), width * 1.9, col, 3); break; }
      d -= L[j];
    }
  }
}

/**
 * Strelkali o'lchov asbobi; old yuzi −z ga qaragan. p — korpus old yuzining pastki o'rtasi.
 * frac — strelka holati (0…1), sym — shkala belgisi, text — asbob ustidagi yozuv.
 * Qaytaradi: { plus, minus } — klemmalar uchi.
 */
export function meter(lab, p, { frac = 0, sym = 'A', text = '', textColor, w = 0.62, h = 0.52, d = 0.28, plusLeft = true, ac = false, neutral = false } = {}) {
  const c = lab.colors, [x, y, z] = p;
  lab.box(x - w / 2, y, z, w, h, d, c.text3);
  const fx = w * 0.86, fy = y + h * 0.27, fh = h * 0.64, zf = z - 0.004;
  panel(lab, x - fx / 2, fy, x + fx / 2, fy + fh, zf, c.bg2);
  const pivot = [x, fy + fh * 0.1, zf - 0.004], R = fh * 0.8, at = (a, k) => [pivot[0] + Math.sin(a) * R * k, pivot[1] + Math.cos(a) * R * k, pivot[2]];
  for (let k = 0; k <= 10; k++) { const a = (-50 + 10 * k) * DEG, big = k % 5 === 0; lab.line(at(a, big ? 0.8 : 0.88), at(a, 1), c.text, big ? 1.4 : 0.8); }
  const a = (-50 + 100 * clamp(frac, -0.02, 1.04)) * DEG;
  lab.line(pivot, at(a, 0.96), c.danger, 2);
  ball(lab, pivot, 0.018, c.text2, 3);
  lab.label(ac ? `${sym} ~` : sym, [x, fy + fh * 0.5, zf], c.text);
  const red = c.danger, black = c.text2, ty = y + h * 0.13;
  const plus = post(lab, [x + (plusLeft ? -1 : 1) * w * 0.3, ty, z], ac || neutral ? black : red); // neutral — qutbsiz (elektrostatik) asbob
  const minus = post(lab, [x + (plusLeft ? 1 : -1) * w * 0.3, ty, z], black);
  if (text) lab.label(text, [x, y + h + 0.12, z + d / 2], textColor || c.text);
  return { plus, minus };
}

/**
 * Laboratoriya manbai: korpus, raqamli displey, aylanma dasta va + / − klemmalar. p — old yuzning pastki o'rtasi.
 * frac — dasta holati 0…1 (−135°…+135°); id bo'lsa dasta uchi sahnada suriladi.
 * Qaytaradi: { plus, minus, knob(f) } — knob(f) dasta uchining nuqtasi (lab.nearest uchun).
 */
export function supply(lab, p, { w = 1.0, h = 0.62, d = 0.55, text = '', title = '', frac = 0, id = null, knob = true, marks = true } = {}) {
  const c = lab.colors, [x, y, z] = p;
  lab.box(x - w / 2, y, z, w, h, d, shell(c));
  const dx0 = x - w * 0.42, dx1 = x + w * 0.42, dy0 = y + h * 0.56, dy1 = y + h * 0.88;
  panel(lab, dx0, dy0, dx1, dy1, z - 0.004, c.dark ? c.bg : c.text);
  if (text) lab.label(text, [x, (dy0 + dy1) / 2, z - 0.01], c.success);
  const kc = [x - w * 0.24, y + h * 0.27, z], rk = Math.min(0.1, h * 0.17);
  const knobAt = (f) => { const a = (-135 + 270 * clamp(f, 0, 1)) * DEG; return [kc[0] + Math.sin(a) * rk * 0.78, kc[1] + Math.cos(a) * rk * 0.78, kc[2] - 0.075]; };
  if (knob) {
    for (let k = 0; k <= 10; k++) { const a = (-135 + 27 * k) * DEG; lab.line([kc[0] + Math.sin(a) * rk * 1.15, kc[1] + Math.cos(a) * rk * 1.15, z - 0.004], [kc[0] + Math.sin(a) * rk * 1.38, kc[1] + Math.cos(a) * rk * 1.38, z - 0.004], c.text3, 1); }
    lab.rod(kc, [kc[0], kc[1], z - 0.07], rk, c.text2, 20);
    const tip = knobAt(frac);
    lab.rod([kc[0], kc[1], z - 0.072], tip, 0.01, c.danger, 6);
    ball(lab, tip, 0.018, c.danger, 3);
    if (id) lab.handle(id, tip, 0.15);
  }
  const plus = post(lab, [x + w * 0.16, y + h * 0.27, z], c.danger), minus = post(lab, [x + w * 0.36, y + h * 0.27, z], c.text2);
  if (marks) { lab.label('+', [plus[0], plus[1] + 0.12, plus[2]], c.danger); lab.label('−', [minus[0], minus[1] + 0.12, minus[2]], c.text2); } // tor ekranda qutb belgilari displey yozuviga tegmasin
  if (title) lab.label(title, [x, y + h + 0.12, z + d * 0.4], c.text2);
  return { plus, minus, knob: knobAt };
}

/** Raqamli displeyli kichik qurilma (sekundomer, vakuummetr, hisoblagich oynasi). p — old yuz pastki o'rtasi. */
export function display(lab, p, { w = 0.6, h = 0.34, d = 0.22, text = '', title = '', color, body } = {}) {
  const c = lab.colors, [x, y, z] = p;
  lab.box(x - w / 2, y, z, w, h, d, body || shell(c));
  panel(lab, x - w * 0.42, y + h * 0.3, x + w * 0.42, y + h * 0.86, z - 0.004, c.dark ? c.bg : c.text);
  if (text) lab.label(text, [x, y + h * 0.58, z - 0.01], color || c.success);
  if (title) lab.label(title, [x, y - 0.1, z - 0.02], c.text2);
}

/** Pichoqli kalit: taglik, ikki ustuncha va pichoq. p — taglik markazi. Qaytaradi: { a, b } — ulanish nuqtalari. */
export function knife(lab, p, closed, id = null) {
  const c = lab.colors, [x, y, z] = p;
  lab.box(x - 0.3, y, z - 0.11, 0.6, 0.05, 0.22, c.text2);
  for (const s of [-1, 1]) lab.rod([x + s * 0.22, y + 0.05, z], [x + s * 0.22, y + 0.17, z], 0.026, c.warning, 8);
  const hinge = [x - 0.22, y + 0.17, z], a = closed ? 0 : 55 * DEG, tip = [hinge[0] + 0.46 * Math.cos(a), hinge[1] + 0.46 * Math.sin(a), z];
  lab.box(hinge[0] - 0.01, hinge[1] - 0.02, z - 0.03, 0.02, 0.04, 0.06, c.text3);
  lab.rod(hinge, tip, 0.016, c.text3, 6);
  lab.rod(tip, [tip[0] + 0.1 * Math.cos(a), tip[1] + 0.1 * Math.sin(a), z], 0.028, c.text, 10);
  if (id) lab.handle(id, [(hinge[0] + tip[0]) / 2, (hinge[1] + tip[1]) / 2, z], 0.24);
  return { a: [x - 0.22, y + 0.1, z - 0.04], b: [x + 0.22, y + 0.1, z - 0.04] };
}

/** Uchqun kanali: ikki kesishgan yorug' lenta va o'zak chiziq (har tomondan ko'rinadi). seed — shakl. */
export function bolt(lab, a, b, seed, { width = 0.03, n = 9, amp = 0.18, core, glow } = {}) {
  const c = lab.colors, d = b.map((v, i) => v - a[i]), L = Math.hypot(...d) || 1, u = d.map((v) => v / L);
  const q = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let s1 = [u[1] * q[2] - u[2] * q[1], u[2] * q[0] - u[0] * q[2], u[0] * q[1] - u[1] * q[0]];
  const l1 = Math.hypot(...s1); s1 = s1.map((v) => v / l1);
  const s2 = [u[1] * s1[2] - u[2] * s1[1], u[2] * s1[0] - u[0] * s1[2], u[0] * s1[1] - u[1] * s1[0]];
  let r = seed || 1;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const pts = [a];
  for (let k = 1; k < n; k++) { const t = k / n, o1 = (rnd() - 0.5) * L * amp, o2 = (rnd() - 0.5) * L * amp; pts.push(a.map((v, i) => v + d[i] * t + s1[i] * o1 + s2[i] * o2)); }
  pts.push(b);
  const g = glow || (c.dark ? '#c4b5fd' : '#8b5cf6');
  for (const s of [s1, s2]) for (const [hw, op] of [[width * 2.2, 0.28], [width, 0.6]]) for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    lab.face([p0.map((v, j) => v + s[j] * hw), p1.map((v, j) => v + s[j] * hw), p1.map((v, j) => v - s[j] * hw), p0.map((v, j) => v - s[j] * hw)], alpha(g, op));
  }
  for (let i = 1; i < pts.length; i++) lab.line(pts[i - 1], pts[i], core || (c.dark ? '#ffffff' : '#4c1d95'), 2.2);
  return pts;
}

/** Termometr: shisha naycha, simob/spirt ustuni, har 10° belgi. frac — ustun ulushi (0…1). */
export function thermometer(lab, bottom, top, frac, { color, r = 0.022 } = {}) {
  const c = lab.colors, col = color || c.danger, H = top[1] - bottom[1], f = clamp(frac, 0, 1);
  lab.rod(bottom, top, r, alpha(c.text3, 0.28), 10);
  ball(lab, bottom, r * 1.7, col, 4);
  lab.rod(bottom, [bottom[0], bottom[1] + 0.06 + (H - 0.1) * f, bottom[2]], r * 0.45, col, 6);
  for (let k = 0; k <= 10; k++) { const y = bottom[1] + 0.06 + ((H - 0.1) * k) / 10; lab.line([bottom[0] + r, y, bottom[2] - r * 0.6], [bottom[0] + r + (k % 5 ? 0.025 : 0.045), y, bottom[2] - r * 0.6], c.text2, 0.9); }
}

/** Kameraga qaragan aylana (tanlangan zarra atrofidagi halqa). */
export function camRing(lab, p, r, color, width = 1.6, n = 28) {
  const { yaw, pitch } = lab.camera, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
  const at = (k) => { const a = (k * TAU) / n; return p.map((v, i) => v + r * (Math.cos(a) * right[i] + Math.sin(a) * up[i])); };
  for (let k = 0; k < n; k++) lab.line(at(k), at(k + 1), color, width);
}

/**
 * Ekran nuqtasi (x, y) → sahnadagi tekislik o + s·u + t·v ustidagi [s, t] (proyektiv teskari almashtirish).
 * Nuqta kamera ortida yoki tekislik qirrasidan ko'rinsa — null.
 */
export function planeHit(lab, p, o, u, v) {
  const a = lab.project(o), b = lab.project(o.map((x, i) => x + u[i])), c = lab.project(o.map((x, i) => x + v[i]));
  const ax = b.d * (b.x - p.x) - a.d * (a.x - p.x), ay = c.d * (c.x - p.x) - a.d * (a.x - p.x);
  const bx = b.d * (b.y - p.y) - a.d * (a.y - p.y), by = c.d * (c.y - p.y) - a.d * (a.y - p.y), det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-6) return null;
  const rx = a.d * (p.x - a.x), ry = a.d * (p.y - a.y), s = (rx * by - ay * ry) / det, t = (ax * ry - rx * bx) / det;
  const depth = a.d + s * (b.d - a.d) + t * (c.d - a.d);
  return depth > 0.5 && depth < 30 ? [s, t] : null;
}

/** Kameraning o'ng va yuqori yo'nalishlari (sahnada kameraga qaragan tekislik uchun). */
export function cameraAxes(lab) {
  const { yaw, pitch } = lab.camera, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return { right: [cy, 0, -sy], up: [sy * sp, cp, cy * sp] };
}
