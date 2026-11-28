// Muvozanat, kuch momenti va oddiy mexanizmlar — 360° 3D laboratoriya sahnasi (simulations/statics.html).
// Holat, fizika va sudrash mantiqi statics.js / statics-physics.js da o'zgarmaydi: asboblar o'sha "dunyo" tekisligida
// (520 × 300 shartli birlik, y pastga) turadi, bu yerda u stol ustidagi tik tekislikka (z = 0) joylashtiriladi.
// Old tomon −z (kuzatuvchi tomoni), stol usti y = 0 — har tajribada dunyo "pol" chizig'i (floor) shu yerga to'g'ri keladi.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, arrowSolid, dashed, helix, path } from './apparatus-3d.js?v=20261124-n3';
import { ball, shell } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt, tag } from './sim-kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
/** Dunyo birligining sahnadagi o'lchami (520 → 5,8). */
export const K = 0.0112;
const WOOD = (c) => (c.dark ? '#a0764a' : '#d8ae74'), WOOD2 = (c) => (c.dark ? '#7a5434' : '#a36d38');
const IRON = (c) => (c.dark ? '#64748b' : '#374151'), STEEL = (c) => (c.dark ? '#cbd5e1' : '#9ca3af');
const BRASS = (c) => (c.dark ? '#facc15' : '#b8860b'), ROPE = (c) => (c.dark ? '#d6a77a' : '#7c5a2e'), SKIN = '#e9b78f';

/** Har tajribaning dunyo "pol"i (stol usti) va kamerasi. */
const VIEW = {
  plate: { floor: 284, z: 0, begin: { target: [-0.25, 1.4, 0], focal: 2.25 }, camera: { yaw: -0.32, pitch: 0.2, zoom: 1 } },
  tip: { floor: 238, z: 0, begin: { target: [0.45, 0.85, 0], focal: 2.6 }, camera: { yaw: -0.3, pitch: 0.24, zoom: 1 } },
  ball: { floor: 240, z: 0, begin: { target: [0, 0.4, 0], focal: 2.6 }, camera: { yaw: -0.3, pitch: 0.3, zoom: 1 } },
  lever: { floor: 286, z: 0, begin: { target: [0.2, 1.65, 0], focal: 2.3 }, camera: { yaw: -0.3, pitch: 0.2, zoom: 1 } },
  mech: { floor: 282, z: 0, begin: { target: [0, 1.55, 0], focal: 2.0 }, camera: { yaw: -0.32, pitch: 0.16, zoom: 1 } },
  axle: { floor: 282, z: -0.44, begin: { target: [0.35, 1.7, 0], focal: 2.0 }, camera: { yaw: -0.38, pitch: 0.18, zoom: 1 } },
};
const viewOf = (k) => (VIEW[k] ? k : k === 'axle' ? 'axle' : ['fixed', 'movable', 'tackle'].includes(k) ? 'mech' : 'plate');

/** Oddiy ko'pburchakni uchburchaklarga ajratish (quloq kesish). pts — [[x, y], ...]. */
export function triangulate(pts) {
  const n = pts.length, area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), sg = Math.sign(area) || 1;
  const idx = [...Array(n).keys()], out = [];
  const cross = (a, b, c) => ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * sg;
  const inTri = (p, a, b, c) => cross(a, b, p) > 1e-9 && cross(b, c, p) > 1e-9 && cross(c, a, p) > 1e-9;
  let guard = 0;
  while (idx.length > 3 && guard++ < 4 * n * n) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length], a = pts[ia], b = pts[ib], c = pts[ic];
      if (cross(a, b, c) <= 1e-9) continue;
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && inTri(pts[j], a, b, c))) continue;
      out.push([ia, ib, ic]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}
/** Teshikli ko'pburchak: tashqi kontur va ichki teshik ko'prik bilan bitta konturga ulanadi. */
export function bridge(outer, hole) {
  let bi = 0, bj = 0, d = Infinity;
  outer.forEach((p, i) => hole.forEach((q, j) => { const dd = Math.hypot(p[0] - q[0], p[1] - q[1]); if (dd < d) { d = dd; bi = i; bj = j; } }));
  const h = [...hole.slice(bj), ...hole.slice(0, bj + 1)].reverse();
  return [...outer.slice(0, bi + 1), ...h, ...outer.slice(bi)];
}

export function createStaticsLab() {
  const lab = createLab3D();
  let key = 'plate', floor = 284, narrow = false, ctxRef = null, stageRef = null;
  lab.reset = () => Object.assign(lab.camera, VIEW[key].camera);
  lab.reset();
  /** Dunyo nuqtasi (x, y pastga) → sahna. */
  const V = (x, y, z = 0) => [(x - 260) * K, (floor - y) * K, z];
  const Vp = (p, z = 0) => V(p[0], p[1], z);
  const S = (v) => v * K;
  const hud = [], tri = {};

  /* -------------------------------------------------- umumiy detallar */
  function disc(center, r, color, n = 24, z = center[2]) {
    lab.face(Array.from({ length: n }, (_, i) => [center[0] + r * Math.cos((i * TAU) / n), center[1] + r * Math.sin((i * TAU) / n), z]), color);
  }
  function cone(base, tip, r, color, n = 16) {
    const d = tip.map((v, i) => v - base[i]), L = Math.hypot(...d) || 1, u = d.map((v) => v / L), q = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let a = [u[1] * q[2] - u[2] * q[1], u[2] * q[0] - u[0] * q[2], u[0] * q[1] - u[1] * q[0]]; const la = Math.hypot(...a); a = a.map((v) => v / la);
    const b = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
    const ring = Array.from({ length: n }, (_, i) => base.map((v, j) => v + r * (Math.cos((i * TAU) / n) * a[j] + Math.sin((i * TAU) / n) * b[j])));
    for (let i = 0; i < n; i++) lab.face([ring[i], ring[(i + 1) % n], tip], color);
    lab.face(ring, color);
  }
  /** Massa markazi belgisi (to'rt bo'lakli doira), −z ga qaragan. */
  function cmMark(p, r) {
    const c = lab.colors, n = 6;
    for (let q = 0; q < 4; q++) {
      const pts = [p];
      for (let i = 0; i <= n; i++) { const a = (q * Math.PI) / 2 + (i * Math.PI) / 2 / n; pts.push([p[0] + r * Math.cos(a), p[1] + r * Math.sin(a), p[2]]); }
      lab.face(pts, q % 2 ? '#ffffff' : c.danger);
    }
  }
  function ringZ(center, r, color, width = 1.4, n = 28) {
    for (let i = 0; i < n; i++) { const a = (i * TAU) / n, b = ((i + 1) * TAU) / n; lab.line([center[0] + r * Math.cos(a), center[1] + r * Math.sin(a), center[2]], [center[0] + r * Math.cos(b), center[1] + r * Math.sin(b), center[2]], color, width); }
  }
  /** Shtativ: cho'yan asos, xrom sterjen. x — dunyo, tepasi yt (dunyo), z — sterjen chuqurligi. */
  function stand(x, yt, z = 0.16, wide = 1.4) {
    const c = lab.colors, b = V(x, floor);
    lab.box(b[0] - 0.22, 0, z - 0.3, wide * 0.55, 0.09, 0.6, IRON(c));
    lab.rod([b[0], 0.09, z], V(x, yt, z), 0.03, STEEL(c), 12);
  }
  function fist(p, r) { ball(lab, p, r, SKIN, 6); for (const k of [-1, 0, 1]) lab.line([p[0] - r * 0.7, p[1] + k * r * 0.3, p[2] - r * 0.85], [p[0] + r * 0.15, p[1] + k * r * 0.3, p[2] - r * 0.85], '#b07d56', 0.9); }
  /** Dinamometr (prujinali tarozi) a — halqa (qo'l), b — ilgak. Yuzasi −z ga qaragan; F, Fmax — N. */
  function dyno(a, b, F, Fmax, w = 0.17) {
    const c = lab.colors, d = b.map((v, i) => v - a[i]), L = Math.hypot(...d);
    if (L < 0.2) return;
    const u = d.map((v) => v / L), n = [-u[1], u[0], 0], at = (s, o = 0, z = 0) => a.map((v, i) => v + u[i] * s + n[i] * o + (i === 2 ? z : 0));
    const r = w * 0.42, top = r * 2, hook = Math.min(L * 0.18, w * 1.6), bot = L - hook, s0 = top + w * 0.5, s1 = bot - w * 0.6;
    ringZ(at(r * 0.4), r * 0.75, STEEL(c), 2);
    lab.rod(at(top), at(bot), w / 2, alpha(c.dark ? '#cbd5e1' : '#94a3b8', 0.35), 16);
    for (const s of [top, bot]) lab.rod(at(s - 0.004), at(s + 0.004), w / 2 + 0.004, c.text3, 16);
    const frac = clamp(F / Fmax, 0, 1.04), yi = s0 + frac * (s1 - s0), zf = -w / 2 - 0.004;
    lab.face([at(s0 - 0.03, -w * 0.08, zf), at(s0 - 0.03, w * 0.4, zf), at(s1 + 0.03, w * 0.4, zf), at(s1 + 0.03, -w * 0.08, zf)], '#fafaf9');
    const step = Fmax <= 2 ? 0.1 : Fmax <= 5 ? 0.5 : Fmax <= 20 ? 1 : 5, big = Fmax <= 2 ? 0.5 : Fmax <= 5 ? 1 : Fmax <= 20 ? 5 : 10;
    for (let v = 0; v <= Fmax + 1e-9; v += step) {
      const s = s0 + (v / Fmax) * (s1 - s0), isBig = Math.abs(v / big - Math.round(v / big)) < 1e-6;
      lab.line(at(s, -w * 0.06, zf - 0.002), at(s, -w * 0.06 + (isBig ? w * 0.26 : w * 0.14), zf - 0.002), '#27272a', isBig ? 1.1 : 0.7);
    }
    if (!narrow) for (const v of [0, Fmax]) lab.label(fmt(v, 0), at(s0 + (v / Fmax) * (s1 - s0), w * 0.95, zf), c.text2);
    helix(lab, at(top + 0.01, -w * 0.18), at(Math.max(top + 0.03, yi), -w * 0.18), w * 0.12, 8, '#71717a', 0.005);
    lab.rod(at(yi, -w * 0.42, zf - 0.004), at(yi, w * 0.2, zf - 0.004), 0.009, c.danger, 6);
    lab.rod(at(yi), at(bot + hook * 0.55), 0.011, STEEL(c), 8);
    path(lab, [at(bot + hook * 0.55), at(L - 0.02, -0.02), at(L, 0.012), at(L - 0.03, 0.03)], STEEL(c), 0.01);
  }
  const vec = (p, dx, dy, color, text) => lab.vector(p, [S(dx), -S(dy), 0], color, text);

  /* -------------------------------------------------- 1a) Plastinka */
  function plate(s) {
    const c = lab.colors, sh = s.shape(), pin = s.PIN, zf = -0.028, zb = 0.028;
    stand(78, 14);
    lab.box(...V(78 - 9, pin[1] - 9, 0.08), S(18), S(18), 0.16, IRON(c));
    lab.rod(V(78, pin[1], 0.16), V(pin[0] + 4, pin[1], 0.16), 0.022, STEEL(c), 10);
    lab.rod(V(pin[0], pin[1], 0.16), V(pin[0], pin[1], -0.075), 0.03, STEEL(c), 12);
    // fanera: old va orqa yuz uchburchaklarga ajratiladi, chetlari to'rtburchaklar
    const parts = sh.parts.filter((p) => p[1] > 0).map((p) => p[0]), holes = sh.parts.filter((p) => p[1] < 0).map((p) => p[0]);
    let poly = parts[0];
    for (const h of holes) poly = bridge(poly, h);
    const W = poly.map((q) => s.plW(q)), wood = WOOD(c), edge = WOOD2(c);
    for (const [i, j, k] of (tri[s.shapeName] ||= triangulate(poly))) { lab.face([Vp(W[i], zf), Vp(W[j], zf), Vp(W[k], zf)], wood); lab.face([Vp(W[i], zb), Vp(W[j], zb), Vp(W[k], zb)], wood); }
    for (const loop of [...parts, ...holes]) {
      const L = loop.map((q) => s.plW(q));
      for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; lab.face([Vp(p, zf), Vp(q, zf), Vp(q, zb), Vp(p, zb)], edge); lab.line(Vp(p, zf - 0.001), Vp(q, zf - 0.001), c.dark ? '#5b3a1e' : '#8a5a2b', 1); }
    }
    // yog'och tolasi (faqat plastinka ustida)
    for (let v = 1; v < 26; v += 2.4) {
      let prev = null;
      for (let u = -1; u <= 27; u += 1) { const q = [u, v + 0.35 * Math.sin(u * 0.5 + v)], inn = s.inside(q[0], q[1]), p = Vp(s.plW(q), zf - 0.001); if (inn && prev) lab.line(prev, p, alpha('#78481e', 0.25), 0.7); prev = inn ? p : null; }
    }
    // qalam chiziqlari (plastinka ustida) va bo'shliqdagi davomi (shtrix)
    for (const seg of s.pencil) lab.line(Vp(seg[0], zf - 0.002), Vp(seg[1], zf - 0.002), c.dark ? '#1e293b' : '#334155', 1.6);
    for (const seg of s.dashes) dashed(lab, Vp(seg[0], zf - 0.002), Vp(seg[1], zf - 0.002), c.text3, 1);
    // teshiklar
    sh.holes.forEach((h, i) => {
      const p = s.plW(h), lp = s.holeLabel(i);
      lab.rod(Vp(p, zf - 0.003), Vp(p, zb + 0.003), S(3.4), c.dark ? '#0b1220' : '#3f3f46', 14);
      lab.label(['A', 'B', 'C'][i], Vp(lp, zf - 0.01), i === s.hole ? c.danger : c.text);
      s.hits['hole' + i] = { x: p[0], y: p[1], r: 10 };
    });
    if (s.est) { ringZ(Vp(s.est, zf - 0.006), S(6), c.primary, 2.2); if (!narrow) lab.label('kesishish nuqtasi', V(s.est[0] + 62, s.est[1] - 4, zf - 0.01), c.primary); }
    if (s.cm) { cmMark(Vp(s.cm, zf - 0.008), S(5)); if (!narrow) lab.label('massa markazi C', V(s.cm[0] - 58, s.cm[1] + 22, zf - 0.01), c.danger); }
    // shtift va shovun
    ball(lab, V(pin[0], pin[1], -0.08), S(4.2), STEEL(c), 5);
    const bobY = 252;
    lab.line(V(pin[0], pin[1], -0.07), V(pin[0], bobY, -0.07), c.dark ? '#e5e7eb' : '#1f2937', 1.1);
    lab.rod(V(pin[0], bobY, -0.07), V(pin[0], bobY + 8, -0.07), S(5.5), BRASS(c), 14);
    cone(V(pin[0], bobY + 8, -0.07), V(pin[0], bobY + 20, -0.07), S(5.5), BRASS(c));
    if (!narrow) { lab.label('shovun', V(pin[0] + 30, bobY + 12, -0.07)); lab.label('shtift', V(pin[0] - 40, pin[1] - 12, -0.08)); lab.label('shtativ', V(78, 150, 0.16)); }
  }

  /* -------------------------------------------------- 1b) Quti */
  function tip(s) {
    const c = lab.colors, o = s.tBox(), { b, h } = o, zd = Math.max(0.18, (b * s.TK * K) / 2), E = s.TIP_E;
    const P = (u, v, z) => Vp(s.tpW(u, v), z);
    const steel = Math.abs(o.f - 0.5) > 0.02;
    const box = (u0, v0, u1, v1, z0, z1, col) => lab.solid([P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), P(u0, v1, z0), P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], col);
    if (steel) {
      const hb = h * Math.min(0.45, Math.abs(o.f - 0.5) * 1.3 + 0.1), v0 = o.f < 0.5 ? 0.012 : h - hb - 0.012;
      box(-b + 0.012, v0, -0.012, v0 + hb, -zd + 0.03, zd - 0.03, STEEL(c));
    }
    box(-b, 0, 0, h, -zd, zd, steel ? alpha(WOOD(c), 0.5) : WOOD(c));
    for (let v = 0.05; v < h - 0.01; v += 0.05) lab.line(P(-b, v, -zd - 0.002), P(0, v, -zd - 0.002), alpha('#5c3312', 0.55), 1);
    for (const [u, v] of [[-b, 0], [0, 0], [0, h], [-b, h]]) lab.line(P(u, v, -zd - 0.003), P(u, v, zd + 0.003), '#6b4423', 1.2);
    // tayanch: tekis turganda — butun taglik, og'ganda — qirra
    if (s.tp.a < 1e-4) lab.box(...V(E[0] - b * s.TK, E[1], -zd), S(b * s.TK), 0.012, 2 * zd, c.success);
    else if (s.tp.a < Math.PI / 2 - 1e-4) { const e = V(E[0], E[1]); for (const z of [-zd, zd]) lab.line([e[0], 0.004, z], [e[0], 0.004, -z], c.warning, 3); }
    const cm = s.tpW(-b / 2, o.f * h), inside = cm[0] <= E[0] + 0.5, col = inside ? c.success : c.danger, zc = -zd - 0.02;
    dashed(lab, Vp(cm, zc), V(cm[0], E[1], zc), col, 1.6);
    cmMark(Vp(cm, zc), S(5));
    vec(Vp(cm, zc), 0, 36, col, 'mg');
    if (s.tp.a > 0.01 && s.tp.a < Math.PI / 2 - 0.01) {
      const e = V(E[0], E[1], zc); dashed(lab, e, V(E[0], E[1] - 60, zc), c.primary, 1.4);
      const R = S(40), pts = Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * s.tp.a; return [e[0] + R * Math.sin(a), e[1] + R * Math.cos(a), zc]; });
      for (let i = 1; i < pts.length; i++) lab.line(pts[i - 1], pts[i], c.primary, 1.6);
      lab.label(`α = ${fmt(s.tp.a / DEG, 1)}°`, V(E[0] + 70, E[1] - 40, zc), c.primary);
    }
    if (s.tp.held && s.tp.a > 0.005 && s.tp.a < Math.PI / 2 - 0.01) { const q = s.tpW(-b, h * 0.92); fist(V(q[0] - 7, q[1], 0), S(8)); }
    if (!narrow) hud.push([`Quti ${fmt(b * 100, 0)} × ${fmt(h * 100, 0)} cm, m = 2 kg`, c.text2], [`massa markazi ${fmt(o.f * h * 100, 1)} cm balandlikda`, c.text2], [`αₖᵣ = ${fmt(s.tCrit() / DEG, 1)}°`, c.text2]);
  }

  /* -------------------------------------------------- 1c) Sharcha */
  function ballStage(s) {
    const c = lab.colors, k = s.bl.kind, zd = 0.42, wood = WOOD(c), dark = WOOD2(c), base = s.BC[1] + 14;
    const span = k === 'bowl' ? 15 : 26, prof = [];
    for (let x = -span; x <= span + 1e-9; x += 0.5) prof.push(s.surfW(x));
    if (k === 'bowl') { const yr = s.surfW(15)[1] - 2; prof.unshift([s.BC[0] - s.BK * 17, yr]); prof.push([s.BC[0] + s.BK * 17, yr]); }
    for (let i = 1; i < prof.length; i++) {
      const p = prof[i - 1], q = prof[i];
      for (const z of [-zd, zd]) lab.face([V(p[0], base, z), V(q[0], base, z), V(q[0], q[1], z), V(p[0], p[1], z)], wood);
      lab.face([V(p[0], p[1], -zd), V(q[0], q[1], -zd), V(q[0], q[1], zd), V(p[0], p[1], zd)], dark);
      lab.line(V(p[0], p[1], -zd - 0.002), V(q[0], q[1], -zd - 0.002), '#6b4423', 1.3);
    }
    for (const p of [prof[0], prof.at(-1)]) lab.face([V(p[0], base, -zd), V(p[0], p[1], -zd), V(p[0], p[1], zd), V(p[0], base, zd)], dark);
    if (k === 'flat') { // suv sathi (daraja) stol ustida, oldinroqda
      const x0 = V(s.BC[0] + 120 - 30, base, -0.75);
      lab.box(x0[0], 0, x0[2], S(60), 0.09, 0.12, BRASS(c));
      lab.rod([x0[0] + S(20), 0.095, x0[2] + 0.06], [x0[0] + S(40), 0.095, x0[2] + 0.06], 0.035, alpha('#86efac', 0.8), 12);
      ball(lab, [x0[0] + S(30), 0.11, x0[2] + 0.06], 0.02, '#ffffff', 3);
      if (!narrow) lab.label('suv sathi', [x0[0] + S(30), 0.02, x0[2] - 0.2], c.text2);
    }
    const eq = s.surfW(0);
    dashed(lab, V(eq[0], eq[1] - 76, -zd), V(eq[0], eq[1] + 6, -zd), c.text3, 1);
    if (!narrow) lab.label('muvozanat holati', V(eq[0], eq[1] - 84, -zd), c.text3);
    // sharcha (dumalaydi: belgisi aylanadi)
    const sl = s.slope(), nn = Math.hypot(1, sl), p0 = s.surfW(s.bl.x), R = s.BK * s.BR, cx = p0[0] + (R * sl) / nn, cy = p0[1] - R / nn, ctr = V(cx, cy, 0);
    lab.sphere(ctr, S(R), STEEL(c));
    const rot = s.bl.x / s.BR; ball(lab, [ctr[0] + Math.cos(rot) * S(R) * 0.55, ctr[1] - Math.sin(rot) * S(R) * 0.55, -S(R) * 0.83], 0.016, '#1e293b', 3);
    const mgL = 42, n2 = 1 + sl * sl, zc = -S(R) - 0.02, P0 = [ctr[0], ctr[1], zc];
    vec(P0, 0, mgL, c.danger, 'mg');
    vec(P0, (-sl / n2) * mgL, (-1 / n2) * mgL, c.primary, 'N');
    if (Math.abs(sl) > 0.02) vec(P0, (-sl / n2) * mgL, ((sl * sl) / n2) * mgL, c.success, 'F');
    s.hits.ball = { x: cx, y: cy, r: 16 };
    if (!narrow) hud.push([{ bowl: 'Botiq sirt — turg‘un muvozanat', dome: 'Qavariq sirt — turg‘unmas muvozanat', flat: 'Tekis sirt — befarq muvozanat' }[k], c.text2]);
  }

  /* -------------------------------------------------- 2) Richag */
  function lever(s) {
    const c = lab.colors, L = s.LEVER.L, po = s.lv.po, piv = s.PIV, hb = 11, zf = -0.045, m = s.lvMom(), Fd = s.lvF();
    stand(piv[0], piv[1] + 10, 0.14, 1.6);
    lab.box(...V(piv[0] - 9, piv[1] + 18, 0.06), S(18), S(22), 0.16, IRON(c));
    lab.rod(V(piv[0], piv[1], 0.14), V(piv[0], piv[1], -0.07), S(4.5), STEEL(c), 12);
    // richag: aylanadigan to'rtburchak brus
    const u0 = -L / 2 - po, u1 = L / 2 - po, Q = (u, v, z) => Vp(s.lvW(u, v), z);
    lab.solid([Q(u0, -hb / 2, zf), Q(u1, -hb / 2, zf), Q(u1, hb / 2, zf), Q(u0, hb / 2, zf), Q(u0, -hb / 2, -zf), Q(u1, -hb / 2, -zf), Q(u1, hb / 2, -zf), Q(u0, hb / 2, -zf)], c.dark ? '#94a3b8' : '#cbd5e1');
    for (let k = -6; k <= 6; k++) {
      const u = k * s.LEVER.step - po;
      lab.rod(Q(u, 0, zf - 0.002), Q(u, 0, -zf + 0.002), S(2.4), '#334155', 10);
      if (k && (!narrow || k % 2 === 0)) lab.label(String(Math.abs(k)), Q(u, -15, zf), c.text2);
    }
    // ko'rsatkich va shkala
    for (let a = -12; a <= 12; a += 4) { const x = piv[0] + Math.sin(a * DEG) * 34; lab.line(V(x, piv[1] + 30, zf - 0.02), V(x, piv[1] + 34 + (a ? 0 : 3), zf - 0.02), c.text2, 1.2); }
    lab.rod(V(piv[0], piv[1], zf - 0.025), Q(0, 30, zf - 0.025), 0.008, c.danger, 6);
    // yuk guruhlari (100 g li tirqishli yuklar)
    for (const [key, gr] of [['A', s.lv.A], ['B', s.lv.B]]) {
      if (!gr.n || !gr.h) { s.hits[key] = null; continue; }
      const [hx, hy] = s.lvW(gr.h * s.LEVER.step - po, 0), hi = s.dragKey === key;
      path(lab, [V(hx, hy, 0), V(hx, hy + 6, 0), V(hx, hy + 14, 0)], c.dark ? '#e5e7eb' : '#374151', 0.006);
      lab.rod(V(hx, hy + 14), V(hx, hy + 16 + gr.n * 12), S(1.2), STEEL(c), 8);
      for (let i = 0; i < gr.n; i++) {
        const yy = hy + 16 + i * 12, col = hi ? (c.dark ? '#93c5fd' : '#60a5fa') : BRASS(c);
        lab.rod(V(hx, yy + 0.6), V(hx, yy + 11), S(14), col, 20);
        if (!i && !narrow) lab.label('100 g', V(hx, yy + 6, -S(14) - 0.01), c.dark ? '#1c1917' : '#3b2a08');
      }
      lab.rod(V(hx, hy + 16 + gr.n * 12), V(hx, hy + 19 + gr.n * 12), S(9), '#3f3f46', 14);
      s.hits[key] = { x: hx - 16, y: hy - 4, w: 32, h: 28 + gr.n * 12 };
    }
    // yelkalar
    const dimY = piv[1] - 30, zd = zf - 0.03;
    const dim = (u, text, col) => { const xa = piv[0], xb = piv[0] + u * s.LK * Math.cos(s.lv.b); lab.line(V(xa, dimY, zd), V(xb, dimY, zd), col, 1.6); lab.line(V(xb, dimY - 4, zd), V(xb, dimY + 4, zd), col, 1.6); lab.label(text, V((xa + xb) / 2, dimY - 11, zd), col); };
    const uA = s.lv.A.h * s.LEVER.step - po, uB = s.lv.B.h * s.LEVER.step - po;
    if (s.lv.A.n && s.lv.A.h) dim(uA, `l₁ = ${fmt(Math.abs(s.lv.A.h * 5 - po * 100), 0)} cm`, c.primary);
    if (s.lv.B.n && s.lv.B.h && Math.sign(uB) !== Math.sign(uA)) dim(uB, `l₂ = ${fmt(Math.abs(s.lv.B.h * 5 - po * 100), 0)} cm`, c.warning);
    if (Math.abs(po) > 1e-6) { const q = s.lvW(-po, 0); cmMark(Vp(q, zf - 0.01), S(3.6)); vec(V(q[0], q[1] + 6, zf - 0.01), 0, 26, c.special, ''); lab.label('mᵣ·g', V(q[0], q[1] + 44, zf - 0.01), c.special); }
    s.hits.ring = null;
    if (s.lv.dyn) {
      const ud = s.lv.dh * s.LEVER.step - po, [dx, dy] = s.lvW(ud, 0), up = !(Fd < 0), side = Math.sign(ud) || 1, len = 92, phi = s.lv.phi * DEG;
      const rx = dx + side * Math.sin(phi) * len, ry = dy + (up ? -1 : 1) * Math.cos(phi) * len, Fa = Math.abs(Fd), Fmax = Fa > 5 ? 10 : 5, zq = zf - 0.06;
      if (phi > 0.01) {
        dashed(lab, V(dx - (rx - dx) * 0.6, dy - (ry - dy) * 0.6, zq), V(rx, ry, zq), c.special, 1);
        lab.line(V(dx, dy, zq), V(dx, dy + (up ? -1 : 1) * 50, zq), c.text3, 1);
        lab.label(`φ = ${fmt(s.lv.phi, 0)}°`, V(dx + side * 18, dy + (up ? -1 : 1) * 58, zq), c.special);
      }
      if (Number.isFinite(Fd)) dyno(V(rx, ry, zq), V(dx, dy, zq), Fa, Fmax);
      lab.rod(V(dx, dy, zq), V(dx, dy, zf), 0.008, STEEL(c), 6);
      fist(V(rx, ry, zq), S(9));
      s.hits.ring = { x: rx, y: ry, r: 18 };
      lab.label(Number.isFinite(Fd) ? `${fmt(Fa, 2)} N ${up ? '↑' : '↓'}` : 'yelka nolga teng!', V(rx + side * 34, ry, zq), c.text);
    }
    if (!narrow) {
      const bal = Math.abs(m.net) < 1e-9 || s.lv.dyn, t = s.lv.dyn ? 'dinamometr richagni gorizontal ushlab turibdi' : bal ? 'momentlar teng: richag muvozanatda' : m.net > 0 ? 'o‘ng tomon og‘ir: soat mili bo‘yicha buriladi' : 'chap tomon og‘ir: soat miliga qarshi buriladi';
      hud.push([t, bal ? c.success : c.danger], [`M₁ = ${fmt(m.ccw, 3)} N·m   M₂ = ${fmt(m.cw, 3)} N·m`, c.text2]);
    }
  }

  /* -------------------------------------------------- 3) Bloklar va chig'ir */
  function pulley(x, y, r, a0, z = 0) {
    const c = lab.colors, rr = S(r);
    lab.rod(V(x, y, z - 0.035), V(x, y, z + 0.035), rr, STEEL(c), 28);
    lab.rod(V(x, y, z - 0.012), V(x, y, z + 0.012), rr + 0.004, c.text2, 28);
    for (let k = 0; k < 4; k++) { const a = a0 + (k * TAU) / 4; lab.line(V(x, y, z - 0.037), V(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3), z - 0.037), c.text2, 1); }
    lab.rod(V(x, y, z - 0.06), V(x, y, z + 0.06), S(2.4), '#1f2937', 10);
  }
  const rope = (pts, z = 0) => path(lab, pts.map((p) => V(p[0], p[1], z)), ROPE(lab.colors), 0.011);
  function ropeArc(x, y, r, a0, a1, z = 0) { const pts = []; for (let i = 0; i <= 16; i++) { const a = a0 + ((a1 - a0) * i) / 16; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } rope(pts, z); }
  function weightBlock(x, yTop, mLabel, lh, m) {
    const c = lab.colors, w = 26 + 8 * Math.cbrt(m);
    path(lab, [V(x - 4, yTop + 2), V(x - 4, yTop - 3), V(x, yTop - 7), V(x + 4, yTop - 3), V(x + 4, yTop + 2)], '#374151', 0.008);
    lab.rod(V(x, yTop + 2), V(x, yTop + lh * 0.3), S(w * 0.3), c.dark ? '#52525b' : '#3f3f46', 20);
    lab.rod(V(x, yTop + lh * 0.3), V(x, yTop + lh), S(w / 2), c.dark ? '#71717a' : '#27272a', 24);
    lab.label(mLabel, V(x, yTop + lh * 0.66, -S(w / 2) - 0.01), '#f4f4f5');
  }
  function bucket(x, yTop, mLabel, lh, m) {
    const c = lab.colors, w = 30 + 6 * Math.cbrt(m), n = 24, r0 = S(w / 2), r1 = S(w * 0.38), y0 = V(0, yTop + 6)[1], y1 = V(0, yTop + lh)[1], cx = V(x, 0)[0];
    const ring = (y, r) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i * TAU) / n), y, r * Math.sin((i * TAU) / n)]);
    const A = ring(y0, r0), B = ring(y1, r1), col = c.dark ? '#94a3b8' : '#64748b';
    for (let i = 0; i < n; i++) lab.face([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]], alpha(col, 0.85));
    lab.face(B, col); lab.face(ring(y0 - 0.02, r0 * 0.97), alpha(c.dark ? '#3b82f6' : '#60a5fa', 0.8));
    const arc = Array.from({ length: 13 }, (_, i) => { const a = Math.PI + (i * Math.PI) / 12; return [cx + r0 * Math.cos(a), y0 - r0 * Math.sin(a) * 0.9, 0]; });
    path(lab, arc, '#6b7280', 0.006);
    lab.label(mLabel, [cx, (y0 + y1) / 2, -r0 - 0.02], c.dark ? '#0f172a' : '#0f172a');
  }
  function ruler(x, y0, hcur, MK, z = 0.32) {
    const c = lab.colors, top = y0 - 0.5 * MK;
    lab.box(...V(x - 7, y0, z), S(14), S(y0 - top + 4), 0.025, c.dark ? '#fde68a' : '#fef3c7');
    for (let k = 0; k <= 50; k += 5) { const y = y0 - (k / 100) * MK; lab.line(V(x - 7, y, z - 0.002), V(x - 7 + (k % 10 ? 4 : 7), y, z - 0.002), '#78350f', 1); if (!(k % 10) && k && !narrow) lab.label(String(k), V(x + 2, y, z - 0.01), '#78350f'); }
    const yh = y0 - hcur * MK; cone(V(x + 16, yh, z - 0.01), V(x + 8, yh, z - 0.01), S(4), c.danger, 10);
    lab.label('cm', V(x, top - 22, z), c.text2);
  }
  function frame(x0, x1) {
    const c = lab.colors, a = V(x0, 0, -0.13), b = V(x1, 16, 0.13);
    lab.box(a[0], b[1], a[2], b[0] - a[0], a[1] - b[1], b[2] - a[2], WOOD2(c));
    for (const x of [x0 + 6, x1 - 6]) { lab.box(...V(x - 5, floor, 0.14), S(10), S(floor - 16), 0.1, WOOD2(c)); lab.box(...V(x - 14, floor, -0.1), S(28), 0.04, 0.44, WOOD2(c)); }
    for (let x = x0 + 20; x < x1; x += 60) lab.rod(V(x, 8, -0.135), V(x, 8, -0.125), S(2), '#4b2e14', 8);
  }
  function mech(s) {
    const c = lab.colors, k = s.kind(), r = s.mRes(), h = s.mH(), F0 = r.F, lh = s.loadH(), MK = s.MK, FL = s.FLOOR, mc = s.mc, Fmax = F0 > 40 ? 100 : F0 > 20 ? 50 : F0 > 10 ? 20 : F0 > 5 ? 10 : 5;
    const kg = `${fmt(mc.m, mc.m < 1 ? 1 : mc.m % 1 ? 1 : 0)} kg`, a0 = (mc.s / (20 / MK)) % TAU;
    if (k !== 'axle') frame(140, 420);
    s.hits.hand = null;
    if (k === 'fixed') {
      const px = 270, py = 46, pr = 20, lx = px - pr, rx = px + pr, ytop = FL - lh - h * MK, yh = 110 + mc.s * MK;
      for (const z of [-0.05, 0.05]) lab.rod(V(px, 16, z), V(px, py, z), 0.012, STEEL(c), 8);
      pulley(px, py, pr, a0);
      rope([[lx, ytop - 6], [lx, py]]); ropeArc(px, py, pr, Math.PI, TAU); rope([[rx, py], [rx, yh]]);
      weightBlock(lx, ytop, kg, lh, mc.m);
      dyno(V(rx, yh + 66), V(rx, yh), F0, Fmax); fist(V(rx, yh + 72), S(9));
      s.hits.hand = { x: rx - 22, y: yh - 4, w: 44, h: 84, dir: 1 };
      ruler(180, FL, h, MK);
      vec(V(rx + 24, yh + 20, -0.08), 0, 34, c.success, 'F');
    } else if (k === 'movable') {
      const pr = 20, ytop = FL - lh - h * MK, py = ytop - 30, ax = 250 - pr, bx = 250 + pr, yh = 168 - mc.s * MK;
      lab.rod(V(ax, 16, -0.03), V(ax, 16, 0.03), 0.02, '#374151', 10);
      rope([[ax, 16], [ax, py]]); ropeArc(250, py, pr, Math.PI, 0); rope([[bx, py], [bx, yh]]);
      pulley(250, py, pr, -a0 / 2);
      for (const z of [-0.05, 0.05]) lab.rod(V(250, py, z), V(250, ytop - 2, z), 0.012, STEEL(c), 8);
      lab.box(...V(236, ytop - 2, -0.06), S(28), S(4), 0.12, '#4b5563');
      weightBlock(250, ytop, kg, lh, mc.m);
      dyno(V(bx, yh - 62), V(bx, yh), F0, Fmax); fist(V(bx, yh - 68), S(9));
      s.hits.hand = { x: bx - 22, y: yh - 80, w: 44, h: 84, dir: -1 };
      ruler(180, FL, h, MK);
      vec(V(bx + 24, yh - 20, -0.08), 0, -34, c.success, 'F');
    } else if (k === 'tackle') {
      const q = mc.n / 2, pr = 9, sp = 22, cx = 262, fy = 44, ytop = FL - lh - h * MK, my = ytop - 30, xs = Array.from({ length: q }, (_, i) => cx + (i - (q - 1) / 2) * sp), yh = 100 + mc.s * MK;
      lab.rod(V(cx, 16), V(cx, fy - 12), 0.014, STEEL(c), 8);
      for (const yb of [fy, my]) lab.box(...V(xs[0] - pr - 5, yb + 13, 0.045), S((q - 1) * sp + 2 * pr + 10), S(26), 0.025, '#4b5563');
      for (const x of xs) { rope([[x - pr, fy], [x - pr, my]]); rope([[x + pr, fy], [x + pr, my]]); }
      const fx = xs.at(-1) + pr; rope([[fx, fy], [fx + 18, fy + 26], [fx + 18, yh]]);
      for (const x of xs) { pulley(x, fy, pr, a0); pulley(x, my, pr, -a0); }
      lab.rod(V(cx, my + 12), V(cx, ytop - 2), 0.012, STEEL(c), 8);
      weightBlock(cx, ytop, kg, lh, mc.m);
      dyno(V(fx + 18, yh + 62), V(fx + 18, yh), F0, Fmax); fist(V(fx + 18, yh + 68), S(9));
      s.hits.hand = { x: fx - 4, y: yh - 4, w: 44, h: 80, dir: 1 };
      ruler(180, FL, h, MK);
      if (!narrow) lab.label(`${mc.n} ta ip yukni ushlab turibdi`, V(fx + 80, my + 4, 0), c.text2);
    } else {
      const C = [250, 96], R = mc.R * 250, rd = 12.5, ytop = FL - lh - h * MK, psi = mc.psi, zc = s.zAxle, gx = C[0] + Math.cos(psi) * R, gy = C[1] + Math.sin(psi) * R;
      for (const z of [-0.34, 0.34]) for (const dx of [-1, 1]) lab.solid([V(C[0] + dx * 4, C[1] - 4, z - 0.04), V(C[0] + dx * 12, C[1] - 4, z - 0.04), V(C[0] + dx * 70, FL, z - 0.04), V(C[0] + dx * 56, FL, z - 0.04), V(C[0] + dx * 4, C[1] - 4, z + 0.04), V(C[0] + dx * 12, C[1] - 4, z + 0.04), V(C[0] + dx * 70, FL, z + 0.04), V(C[0] + dx * 56, FL, z + 0.04)], c.dark ? '#a16207' : '#8b5a2b');
      lab.rod(V(C[0], C[1], -0.3), V(C[0], C[1], 0.3), S(rd), c.dark ? '#c08a55' : '#a36d38', 24);
      for (let k2 = 0; k2 < 6; k2++) { const a = psi + (k2 * TAU) / 6; lab.line(V(C[0], C[1], -0.302), V(C[0] + Math.cos(a) * rd, C[1] + Math.sin(a) * rd, -0.302), '#5c3a17', 1); }
      for (let i = 0; i < 9; i++) lab.line(V(C[0] - rd, C[1] - 3 + i * 0.7, -0.25 + i * 0.06), V(C[0] + rd, C[1] - 3 + i * 0.7, -0.22 + i * 0.06), ROPE(c), 1.2);
      lab.rod(V(C[0], C[1], -0.44), V(C[0], C[1], 0.36), S(3), STEEL(c), 10);
      rope([[C[0] - rd, C[1]], [C[0] - rd, ytop + 4]]);
      const circ = Array.from({ length: 49 }, (_, i) => V(C[0] + Math.cos((i * TAU) / 48) * R, C[1] + Math.sin((i * TAU) / 48) * R, zc));
      for (let i = 1; i < circ.length; i += 2) lab.line(circ[i - 1], circ[i], c.text3, 1);
      lab.rod(V(C[0], C[1], zc), V(gx, gy, zc), S(2.5), c.text2, 8);
      lab.rod(V(gx, gy, zc + 0.02), V(gx, gy, zc - 0.14), S(5), '#7a4e25', 12);
      bucket(C[0] - rd, ytop, kg, lh, mc.m);
      const tx = -Math.sin(psi), ty = Math.cos(psi), len = 70, zq = zc - 0.12;
      dyno(V(gx + tx * len, gy + ty * len, zq), V(gx, gy, zq), F0, Fmax, 0.16); fist(V(gx + tx * (len + 5), gy + ty * (len + 5), zq), S(8));
      s.hits.hand = { x: C[0], y: C[1], r: R + 30, axle: true };
      ruler(420, FL, h, MK, 0);
      if (!narrow) { lab.label(`R = ${fmt(mc.R * 100, 0)} cm`, V(C[0] + R / 2, C[1] - 16, zc), c.text2); lab.label('r = 5 cm', V(C[0] - 34, C[1] + 22, -0.3), c.text2); }
    }
    if (!narrow) hud.push([`F = ${fmt(F0, 2)} N`, c.text2], [`mg = ${fmt(r.W, 2)} N`, c.text2], [`s = ${fmt(mc.s * 100, 1)} cm`, c.text2], [`h = ${fmt(h * 100, 1)} cm`, c.text2]);
  }

  /**
   * s — statics.js tayyorlagan holat va dunyo koordinatalari funksiyalari; s.hits shu yerda to'ldiriladi (sudrash uchun).
   */
  function draw(ctx, stage, s) {
    const k = s.kind(), vk = viewOf(k);
    if (vk !== key) { key = vk; lab.reset(); }
    floor = VIEW[vk].floor; narrow = stage.w < 560; ctxRef = ctx; stageRef = stage; hud.length = 0;
    for (const id of Object.keys(s.hits)) delete s.hits[id];
    lab.begin(ctx, stage, VIEW[vk].begin);
    if (k === 'plate') plate(s);
    else if (k === 'tip') tip(s);
    else if (k === 'ball') ballStage(s);
    else if (k === 'lever') lever(s);
    else mech(s);
    lab.finish('3D laboratoriya', narrow ? 'Bo‘sh joydan suring — kamera' : 'Bo‘sh joydan sudrang — kamera aylanadi · asboblarni sahnada suring');
    hud.forEach(([t, col], i) => tag(ctx, t, stage.w - 12, 21 + i * 24, { color: col, bg: stage.colors.bg2, align: 'right', font: '600 11px system-ui' }));
  }
  /** Ekran nuqtasi → dunyo koordinatasi (asboblar tekisligida); tekislik qirrasidan ko'rinsa null. */
  function toWorld(x, y) {
    if (!stageRef) return null;
    const p = lab.planePoint(x, y, VIEW[key].z);
    return p ? { x: p[0] / K + 260, y: floor - p[1] / K } : null;
  }
  /** Dunyo nuqtasi → ekran (tekshiruv uchun). */
  const toScreen = (x, y) => lab.project(V(x, y, VIEW[key].z));
  return { lab, draw, toWorld, toScreen, get mode() { return key; }, get ctx() { return ctxRef; } };
}
