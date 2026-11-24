// Magnit maydonda zaryadli zarra — 360° 3D laboratoriya sahnasi (simulations/lorentz.html).
// Holat va fizika lorentz.js / lorentz-physics.js da o'zgarmaydi; bu yerda faqat asboblar, izlar va sahnadagi tutqichlar.
// Old tomon −z (kuzatuvchi tomoni), stol usti y = 0. Zarra tekisligi gorizontal: fizik (x, y) → sahna (X, Z),
// fizik z (2D dagi «ekrandan bizga», ⊙) → sahna Y (yuqoriga). Vint chiziqda B — sahna X bo'ylab, fizik z → −Z.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, path, ring, dashed } from './apparatus-3d.js?v=20261124-n3';
import { ball, supply, display, shell, planeHit } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt, sci, tag } from './sim-kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
/** Lorens rejimi: 1 cm = S sahna birligi; dunyo x ∈ [0, LOR_W], y ∈ [−LOR_H, LOR_H] cm. */
export const S = 0.095, LOR_W = 48, LOR_H = 13;
const PX = (x) => -2.28 + x * S;
const YP = 0.42; // zarra tekisligi balandligi (Lorens rejimi)
const YH = 1.25; // vint o'qi balandligi
/** Mass-spektrometr: dunyo x ∈ [−27, 14], y ∈ [−24, 3] cm; tirqish (0, 0). */
const MX = (x) => (x + 6.5) * S, MZ = (y) => (y + 10.5) * S, YM = 0.32;
/** Siklotron: markaz CX, 1 m = K sahna birligi. */
const CX = -0.75, K = 3.8, YC = 0.42;

const VIEW = {
  plane: { begin: { target: [0, 0.35, 0], focal: 2.25 }, camera: { yaw: -0.3, pitch: 0.85, zoom: 1 } },
  helix: { begin: { target: [0, 1.0, 0], focal: 2.15 }, camera: { yaw: -0.5, pitch: 0.3, zoom: 1 } },
  ms: { begin: { target: [0, 0.3, 0.1], focal: 2.25 }, camera: { yaw: -0.2, pitch: 0.9, zoom: 1 } },
  cyc: { begin: { target: [0.3, 0.4, 0], focal: 2.25 }, camera: { yaw: -0.3, pitch: 0.7, zoom: 1 } },
};
const fmtB = (B) => (B < 0.01 ? `${fmt(B * 1000, 2)} mT` : `${fmt(B, 3)} T`);
const violet = (c) => (c.dark ? '#2e1065' : '#ede9fe'); // maydon sohasi (qutb ostidagi pol)
const copper = (c) => (c.dark ? '#f59e0b' : '#b45309');

export function createLorentzLab() {
  const lab = createLab3D();
  let mode = 'plane', narrow = false;
  let knobU = () => [0, 0, 0], knobE = () => [0, 0, 0], knobF = () => [0, 0, 0];
  let tipO = [0, 0]; // v vektori boshi (fizik, cm) — Lorens rejimi
  let hO = [0, 0, 0]; // vint: boshlang'ich nuqta (sahna)
  lab.reset = () => Object.assign(lab.camera, VIEW[mode].camera);
  lab.reset();

  /** Kesma bo'ylab chiziqlar (iz); juda ko'p nuqta bo'lsa siyraklashtiriladi. */
  function trace(pts, color, width = 2, max = 500) {
    const step = Math.max(1, Math.ceil(pts.length / max));
    let prev = null;
    for (let i = 0; i < pts.length; i += step) { const q = pts[i]; if (prev && q) lab.line(prev, q, color, width); prev = q; }
    const last = pts[pts.length - 1];
    if (prev && last && prev !== last) lab.line(prev, last, color, width);
  }
  /** Maydon chizig'i strelkasi: a → b, uchida har tomondan ko'rinadigan «yulduzcha». */
  function fieldArrow(a, b, color, h = 0.05) {
    lab.line(a, b, color, 1.1);
    const d = b.map((v, i) => v - a[i]), L = Math.hypot(...d) || 1, u = d.map((v) => v / L);
    const q = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const s1 = [u[1] * q[2] - u[2] * q[1], u[2] * q[0] - u[0] * q[2], u[0] * q[1] - u[1] * q[0]];
    const s2 = [u[1] * s1[2] - u[2] * s1[1], u[2] * s1[0] - u[0] * s1[2], u[0] * s1[1] - u[1] * s1[0]];
    for (const s of [s1, s2]) for (const k of [-1, 1]) lab.line(b, b.map((v, i) => v - u[i] * h + s[i] * h * 0.6 * k), color, 1.1);
  }
  /** Shaffof shisha devorlar (oldi, orqasi, yonlari) va qirralari. */
  function glass(x0, x1, y0, y1, z0, z1) {
    const c = lab.colors, g = alpha(c.text3, 0.07);
    lab.face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], g);
    lab.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], g);
    lab.face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], g);
    lab.face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], g);
    const e = alpha(c.text3, 0.6);
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) lab.line([x, y0, z], [x, y1, z], e, 0.8);
    for (const y of [y1]) { lab.line([x0, y, z0], [x1, y, z0], e, 0.8); lab.line([x0, y, z1], [x1, y, z1], e, 0.8); lab.line([x0, y, z0], [x0, y, z1], e, 0.8); lab.line([x1, y, z0], [x1, y, z1], e, 0.8); }
  }
  const pcol = (c, q) => (q > 0 ? c.danger : c.primary);
  function particle(p, q, r = 0.05) {
    const c = lab.colors;
    ball(lab, p, r, pcol(c, q), 6);
    if (!narrow) lab.label(q > 0 ? '+' : '−', [p[0], p[1] + r + 0.1, p[2]], pcol(c, q));
  }

  /* ---------------------------------------------------------------- 1a) Lorens kuchi: v ⊥ B */
  function planeScene(L) {
    const c = lab.colors, P = (x, y, h = YP) => [PX(x), h, y * S];
    const x0 = PX(0), x1 = PX(LOR_W), z0 = -LOR_H * S, z1 = LOR_H * S, xb = PX(L.xB), up = L.Bs > 0;
    // taglik, maydon qutblari (pastki — to'liq, yuqorigi — shaffof), vakuum kamera devorlari
    lab.box(x0 - 0.12, 0, z0 - 0.12, x1 - x0 + 0.24, 0.14, z1 - z0 + 0.24, shell(c));
    lab.face([[x0, 0.142, z0], [x1, 0.142, z0], [x1, 0.142, z1], [x0, 0.142, z1]], c.sunken);
    if (x1 - xb > 0.01) {
      lab.face([[xb, 0.144, z0], [x1, 0.144, z0], [x1, 0.144, z1], [xb, 0.144, z1]], violet(c));
      lab.box(xb, 0.66, z0, x1 - xb, 0.08, z1 - z0, alpha(c.special, 0.05));
      for (const y of [0.66, 0.74]) for (const [a, b] of [[[xb, y, z0], [x1, y, z0]], [[xb, y, z1], [x1, y, z1]], [[xb, y, z0], [xb, y, z1]]]) lab.line(a, b, alpha(c.special, 0.7), 1);
      const fc = alpha(c.special, c.dark ? 0.6 : 0.5);
      for (let x = Math.ceil(L.xB / 4) * 4 + 2; x < LOR_W; x += 4) for (let y = -LOR_H + 2.5; y < LOR_H; y += 4) {
        const a = P(x, y, up ? 0.3 : 0.64), b = P(x, y, up ? 0.64 : 0.3);
        fieldArrow(a, b, fc, 0.04);
      }
    }
    glass(x0, x1, 0.14, 0.66, z0, z1);
    dashed(lab, P(L.xB, -LOR_H), P(L.xB, LOR_H), c.special, 1.6);
    // maydon chegarasi tutqichi (old devorda)
    const tab = [xb, 0.5, z0 - 0.1];
    lab.box(xb - 0.045, 0.3, z0 - 0.13, 0.09, 0.4, 0.06, c.special);
    for (const dx of [-0.015, 0.015]) lab.line([xb + dx, 0.4, z0 - 0.132], [xb + dx, 0.6, z0 - 0.132], c.bg2, 1);
    lab.handle('edge', tab, 0.2);
    // manba (zarra to'pi) va v vektori (sudraladi)
    const g = P(2, L.ys), dir = [Math.cos(L.th), 0, Math.sin(L.th)], at = (k) => g.map((v, i) => v + dir[i] * k * S);
    lab.rod([g[0], 0.142, g[2]], [g[0], YP - 0.06, g[2]], 0.02, c.text3, 8);
    lab.rod(at(-1.8), at(0.4), 0.09, c.text2, 14);
    lab.box(g[0] - 0.12, 0.142, g[2] - 0.1, 0.24, 0.03, 0.2, c.text3);
    lab.rod(at(0.4), at(2.4), 0.03, c.text, 10);
    lab.handle('gun', at(-0.6), 0.17);
    if (!narrow) lab.label(`${L.name.toLowerCase()} manbai`, [g[0], YP + 0.2, g[2] - 0.2], c.text3);
    tipO = [2 + Math.cos(L.th) * 2.8, L.ys + Math.sin(L.th) * 2.8];
    const o = P(...tipO), tip = P(tipO[0] + Math.cos(L.th) * L.kv * 3.2, tipO[1] + Math.sin(L.th) * L.kv * 3.2);
    dashed(lab, o, tip, alpha(c.primary, 0.7), 1.8);
    ball(lab, tip, 0.032, c.primary, 4);
    lab.handle('tip', tip, 0.14);
    // iz va zarra
    if (L.trail.length > 1) trace(L.trail.map(([x, y]) => P(x, y)), pcol(c, L.q), 2.2);
    if (L.p) {
      const p = P(...L.p), sp = Math.hypot(...L.v) || 1, ux = L.v[0] / sp, uy = L.v[1] / sp;
      particle(p, L.q);
      if (L.vec) {
        lab.vector(p, [ux * L.kv * 3.2 * S, 0, uy * L.kv * 3.2 * S], c.primary, 'v');
        if (L.inField) {
          const sg = Math.sign(L.q) * L.Bs, Lf = (1.4 + 1.6 * L.kv * L.kb) * S;
          lab.vector(p, [sg * uy * Lf, 0, -sg * ux * Lf], c.danger, 'F');
        }
      }
    }
    // elektromagnit manbai: B yo'nalishini almashtirish (bosiladi)
    display(lab, [2.78, 0, -0.95], { w: 0.62, h: 0.36, d: 0.26, text: up ? 'B ↑' : 'B ↓', color: c.special });
    lab.box(2.6, 0.36, -0.86, 0.36, 0.05, 0.1, up ? c.special : c.text3);
    lab.handle('bflip', [2.78, 0.2, -0.97], 0.24);
    lab.label(`B = ${fmtB(L.B)}`, [2.78, 0.58, -0.82], c.special);
    if (!narrow) lab.label(up ? 'B — yuqoriga (bosing)' : 'B — pastga (bosing)', [2.78, -0.0, -1.18], c.text2);
    path(lab, [[2.78, 0.06, -0.69], [2.78, 0.04, -0.45], [x1 + 0.12, 0.04, -0.45]], c.text2, 0.012);
  }

  /* ---------------------------------------------------------------- 1b) Vint chiziq: v B ga α burchak ostida */
  function helixScene(H) {
    const c = lab.colors, r = H.r, zc = -(Math.sign(H.q) || 1) * r, pc = pcol(c, H.q);
    const Hp = (x, y, z) => [PX(x), YH + y * S, -(z - zc) * S];
    const inside = (y, z) => Math.abs(y) < 16 && Math.abs(z - zc) < 16;
    // solenoid (siyrak o'ramlar), tayanchlar, o'q va maydon chiziqlari
    const R = 1.1, cu = alpha(copper(c), 0.55);
    lab.box(PX(0) - 0.1, 0, -0.5, PX(LOR_W) - PX(0) + 0.2, 0.06, 1.0, shell(c));
    for (const x of [PX(6), PX(42)]) { lab.box(x - 0.08, 0.06, -0.3, 0.16, YH - R - 0.06, 0.6, c.text3); }
    for (let x = PX(1); x <= PX(LOR_W - 0.5); x += 0.5) {
      let prev = null;
      for (let k = 0; k <= 32; k++) { const a = (k * TAU) / 32, q = [x, YH + R * Math.cos(a), R * Math.sin(a)]; if (prev) lab.line(prev, q, cu, 1.6); prev = q; }
    }
    const fc = alpha(c.special, c.dark ? 0.6 : 0.5);
    for (const [y, z] of [[0.62, 0], [-0.62, 0], [0, 0.62], [0, -0.62]]) for (let x = PX(2); x < PX(LOR_W) - 0.5; x += 1.1) fieldArrow([x, YH + y, z], [x + 0.5, YH + y, z], fc, 0.05);
    lab.label(`B = ${fmtB(H.B)} →`, [PX(40), YH + R + 0.18, 0], c.special);
    dashed(lab, Hp(H.x0, 0, zc), Hp(LOR_W, 0, zc), c.text3, 1);
    // boshlang'ich kesim (aylana) va to'liq vint (xira)
    const circ = [];
    for (let i = 0; i <= 48; i++) { const ph = (TAU * i) / 48; circ.push(Hp(H.x0, r * Math.sin(ph), zc + r * Math.cos(ph))); }
    if (r < 16) trace(circ, alpha(c.text3, 0.6), 1);
    const pos = (t) => { const ph = H.Om * t; return [H.x0 + H.vl * t, (H.vp / H.Om) * Math.sin(ph), (H.vp / H.Om) * (Math.cos(ph) - 1)]; };
    const tEnd = (LOR_W - H.x0 - 2) / Math.max(H.vl, 1e-9), ghost = [], tr = [];
    for (let i = 0; i <= 360; i++) { const [x, y, z] = pos(Math.min(tEnd, 6 * H.T * (i / 360))); ghost.push(inside(y, z) ? Hp(x, y, z) : null); }
    trace(ghost, alpha(pc, 0.28), 1.2, 400);
    for (let i = 0; i <= 300; i++) { const [x, y, z] = pos((H.tt * i) / 300); tr.push(inside(y, z) ? Hp(x, y, z) : null); }
    trace(tr, pc, 2.4, 400);
    // qadam o'lchovi
    if (H.vl > 1e-6 && H.x0 + H.vl * H.T < LOR_W - 2) {
      const ya = -Math.min(14, r + 2), a = Hp(H.x0, ya, zc), b = Hp(H.x0 + H.vl * H.T, ya, zc);
      lab.line(a, b, c.text2, 1.2);
      for (const p of [a, b]) lab.line([p[0], p[1] - 0.05, p[2]], [p[0], p[1] + 0.05, p[2]], c.text2, 1.2);
      lab.label(narrow ? `h = ${fmt(H.vl * H.T, 1)} cm` : `qadam h = ${fmt(H.vl * H.T, 1)} cm`, [(a[0] + b[0]) / 2, a[1] - 0.13, a[2]], c.text);
    }
    // manba va boshlang'ich v (sudraladi): α — v va B orasidagi burchak
    const o = Hp(H.x0, 0, 0), d = [Math.cos(H.alpha), Math.sin(H.alpha), 0];
    hO = o;
    lab.rod(o.map((v, i) => v - d[i] * 0.34), o.map((v, i) => v - d[i] * 0.06), 0.05, c.text2, 12);
    const tip = o.map((v, i) => v + d[i] * H.kv * 3.2 * S);
    dashed(lab, o, tip, alpha(c.primary, 0.7), 1.8);
    ball(lab, tip, 0.032, c.primary, 4);
    lab.handle('htip', tip, 0.14);
    const arc = [];
    for (let k = 0; k <= 12; k++) { const a = (H.alpha * k) / 12; arc.push([o[0] + 0.28 * Math.cos(a), o[1] + 0.28 * Math.sin(a), o[2]]); }
    trace(arc, c.text3, 1);
    lab.label(`α = ${fmt(H.alpha / DEG, 0)}°`, [o[0] + 0.5, o[1] + 0.12, o[2]], c.text2);
    // zarra va vektorlar
    const [x, y, z] = pos(H.tt), p = Hp(x, y, z), ph = H.Om * H.tt;
    if (H.vec) {
      const vx = H.vl, vy = H.vp * Math.cos(ph), vz = -H.vp * Math.sin(ph), sp = Math.hypot(vx, vy, vz) || 1, Lv = H.kv * 3.2 * S;
      lab.vector(p, [(vx / sp) * Lv, (vy / sp) * Lv, (-vz / sp) * Lv], c.primary, 'v');
      const dy = -y, dz = zc - z, dl = Math.hypot(dy, dz) || 1, Lf = 4 * S;
      lab.vector(p, [0, (dy / dl) * Lf, (-dz / dl) * Lf], c.danger, 'F');
    }
    if (inside(y, z)) particle(p, H.q, 0.045);
  }

  /* ---------------------------------------------------------------- 2) Mass-spektrometr */
  function msScene(M) {
    const c = lab.colors, P = (x, y, h = YM) => [MX(x), h, MZ(y)];
    const x0 = MX(-27.5), x1 = MX(14), z0 = MZ(-24.5), z1 = MZ(3.2);
    lab.box(x0, 0, z0, x1 - x0, 0.2, z1 - z0, shell(c));
    lab.face([[x0, 0.202, z0], [x1, 0.202, z0], [x1, 0.202, z1], [x0, 0.202, z1]], c.sunken);
    // magnit (x ≥ 0): pastki qutb, shaffof yuqori qutb, maydon chiziqlari ⊙ → yuqoriga
    const xm = MX(0.05);
    lab.face([[xm, 0.204, z0], [x1, 0.204, z0], [x1, 0.204, z1], [xm, 0.204, z1]], violet(c));
    lab.box(xm, 0.5, z0, x1 - xm, 0.06, z1 - z0, alpha(c.special, 0.05));
    for (const y of [0.5, 0.56]) for (const [a, b] of [[[xm, y, z0], [x1, y, z0]], [[xm, y, z1], [x1, y, z1]], [[xm, y, z0], [xm, y, z1]], [[x1, y, z0], [x1, y, z1]]]) lab.line(a, b, alpha(c.special, 0.7), 1);
    const fc = alpha(c.special, c.dark ? 0.55 : 0.45);
    for (let x = 2; x < 14; x += 4) for (let y = 1; y > -24; y -= 4.5) fieldArrow(P(x, y, 0.25), P(x, y, 0.49), fc, 0.035);
    lab.label(`B = ${fmt(M.B, 2)} T ↑`, [MX(10), 0.68, MZ(2)], c.special);
    // fotoplastinka va shkala (cm)
    lab.box(MX(-0.7), 0.24, MZ(-24), MX(0) - MX(-0.7), 0.2, MZ(-0.35) - MZ(-24), c.dark ? '#475569' : '#334155');
    for (let d = 0; d <= 23; d++) {
      const big = d % 5 === 0, z = MZ(-d);
      lab.line([MX(-0.7), 0.442, z], [MX(-0.7) - (big ? 0.09 : 0.045), 0.442, z], c.text2, big ? 1.2 : 0.7);
      if (big && d && !narrow) lab.label(String(d), [MX(-0.7) - 0.16, 0.44, z], c.text3);
    }
    // dog'lar: plastinka yonida gistogramma ustunchalari
    const bins = {};
    M.hits.forEach((h) => { const k = Math.round(h.d * 10); (bins[k] = bins[k] || { n: 0, col: h.col }).n++; });
    for (const [k, b] of Object.entries(bins)) { const z = MZ(-k / 10); lab.box(MX(0.05), 0.24, z - 0.008, Math.min(3.2, 0.25 + b.n * 0.1) * S, 0.03, 0.016, b.col); }
    // o'lchagich (sudraladi)
    const ry = -M.ruler, rl = P(-3.2, ry, 0.47);
    lab.rod(rl, P(1.5, ry, 0.47), 0.012, c.warning, 6);
    lab.box(rl[0] - 0.06, 0.44, rl[2] - 0.035, 0.08, 0.05, 0.07, c.warning);
    lab.handle('ruler', rl, 0.17);
    lab.label(narrow ? `d = ${fmt(M.ruler, 1)} cm → ${fmt(M.mMeas, 2)} u` : `d = ${fmt(M.ruler, 1)} cm → m = qB²(d/2)²/2U = ${fmt(M.mMeas, 2)} u`, [rl[0] - (narrow ? 0.55 : 1.0), 0.47, rl[2]], c.text);
    // ion manbai, tezlatuvchi to'rlar (+ / −), tirqish
    lab.box(MX(-26.5), 0.2, MZ(-0.9), 3 * S, 0.24, 1.8 * S, c.text2);
    if (!narrow) lab.label('ion manbai', [MX(-25), 0.3, MZ(-2.6)], c.text3);
    const grid = (x, col) => { for (const [a, b] of [[0.25, 2], [-2, -0.25]]) lab.box(MX(x) - 0.012, 0.2, MZ(a), 0.024, 0.26, MZ(b) - MZ(a), col); };
    grid(-22.5, c.danger); grid(-19.5, c.primary);
    lab.label('+', P(-22.5, 2.6, 0.5), c.danger); lab.label('−', P(-19.5, 2.6, 0.5), c.primary);
    for (const [a, b] of [[0.25, 3], [-0.35, -0.25]]) lab.box(MX(-0.25), 0.2, MZ(a), 0.25 * S, 0.26, MZ(b) - MZ(a), c.text);
    // tezlatuvchi manba (U) — orqada; dastasi buriladi
    const su = supply(lab, [MX(-21), 0, z1 + 0.08], { w: 0.82, h: 0.5, d: 0.26, text: `${fmt(M.U, 0)} V`, title: narrow ? '' : 'U — tezlatuvchi kuchlanish', frac: (M.U - 200) / 2800, id: 'kU', marks: false });
    knobU = su.knob;
    path(lab, [su.plus, [su.plus[0], 0.46, su.plus[2]], [MX(-22.5), 0.46, MZ(2)], [MX(-22.5), 0.46, MZ(1.5)]], c.danger, 0.01);
    path(lab, [su.minus, [su.minus[0], 0.5, su.minus[2]], [MX(-19.5), 0.5, MZ(2)], [MX(-19.5), 0.46, MZ(1.5)]], c.text2, 0.01);
    // tezlik selektori: E ⊥ B₁ (plastinkalar y = ±1 cm), E manbai orqada
    if (M.sel) {
      const xs0 = -M.L * 100 - 4, xs1 = -4;
      lab.box(MX(xs0), 0.2, MZ(0.75), MX(xs1) - MX(xs0), 0.24, 0.35 * S, c.primary);
      lab.box(MX(xs0), 0.2, MZ(-1.1), MX(xs1) - MX(xs0), 0.24, 0.35 * S, c.danger);
      lab.box(MX(xs0), 0.44, MZ(-1.1), MX(xs1) - MX(xs0), 0.03, 2.2 * S, alpha(c.special, 0.18));
      const ec = c.dark ? '#fca5a5' : '#f87171';
      for (let x = xs0 + 1; x < xs1; x += 2) fieldArrow(P(x, -0.65, 0.36), P(x, 0.65, 0.36), ec, 0.03);
      const se = supply(lab, [MX(-8), 0, z1 + 0.08], { w: 0.82, h: 0.5, d: 0.26, text: `${fmt(M.Ef / 1000, 1)} kV/m`, title: narrow ? '' : `Selektor: B₁ = ${fmt(M.B1, 2)} T`, frac: (M.Ef / 1000 - 1) / 59, id: 'kE', marks: false });
      knobE = se.knob;
      path(lab, [se.plus, [se.plus[0], 0.5, se.plus[2]], [MX(-7), 0.5, MZ(-1.0)], [MX(-7), 0.44, MZ(-1.0)]], c.danger, 0.01);
      path(lab, [se.minus, [se.minus[0], 0.54, se.minus[2]], [MX(-6), 0.54, MZ(0.9)], [MX(-6), 0.44, MZ(0.9)]], c.text2, 0.01);
    }
    // nazariy yo'llar (xira) va uchayotgan ionlar
    for (const io of M.ions) {
      if (!io.pass) continue;
      const r = io.r * 100, pts = [];
      for (let i = 0; i <= 60; i++) { const a = (Math.PI * i) / 60, x = r * Math.sin(a), y = -r + r * Math.cos(a); pts.push(x <= 14 && y >= -24 ? P(x, y) : null); }
      trace(pts, alpha(io.col, 0.35), 1.2);
    }
    for (const ion of M.live) ball(lab, P(ion.pos[0], ion.pos[1]), 0.022, ion.col, 3);
  }
  function msLegend(ctx, stage, M) {
    const c = lab.colors;
    M.ions.forEach((io, i) => tag(ctx, `${io.n}: ${io.pass ? `2r = ${fmt(2 * io.r * 100, 2)} cm` : 'selektorda to‘xtadi'}`, stage.w - 10, 21 + i * 25, { color: io.col, bg: c.bg2, align: 'right', font: '600 10px system-ui' }));
  }

  /* ---------------------------------------------------------------- 3) Siklotron */
  function cycScene(Y, anim) {
    const c = lab.colors, R = Y.R, gap = 0.012, Q = (x, y, h = YC) => [CX + x * K, h, y * K];
    // elektromagnit: pastki qutb, shaffof yuqori qutb, orqadagi bo'yinturuq
    lab.rod([CX, 0, 0], [CX, 0.24, 0], R * K * 1.18, c.text3, 36);
    lab.face(Array.from({ length: 36 }, (_, i) => [CX + R * K * 1.17 * Math.cos((i * TAU) / 36), 0.242, R * K * 1.17 * Math.sin((i * TAU) / 36)]), violet(c));
    lab.rod([CX, 0.62, 0], [CX, 0.76, 0], R * K * 1.18, alpha(c.special, 0.05), 36);
    for (const y of [0.62, 0.76]) trace(Array.from({ length: 49 }, (_, i) => [CX + R * K * 1.18 * Math.cos((i * TAU) / 48), y, R * K * 1.18 * Math.sin((i * TAU) / 48)]), alpha(c.special, 0.7), 1);
    lab.box(CX - 0.4, 0, 1.15, 0.8, 0.9, 0.3, c.text3);
    lab.box(CX - 0.3, 0.76, 0.95, 0.6, 0.14, 0.25, c.text3);
    lab.label(`B = ${fmt(Y.B, 2)} T ↑`, [CX + 0.95, 0.9, 0.7], c.special);
    // duantlar: kuchlanish ishorasi bo'yicha (qizil — musbat, ko'k — manfiy)
    const plus = (sd) => (sd > 0 ? Y.Vnow < 0 : Y.Vnow > 0);
    for (const sd of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 24; pts.push([sd * (gap + R * Math.cos(a)), R * Math.sin(a)]); }
      const tint = alpha(plus(sd) ? '#ef4444' : '#2563eb', 0.2), edge = c.borderStrong;
      for (const h of [0.3, 0.54]) lab.face(pts.map(([x, y]) => Q(x, y, h)), tint);
      for (let i = 1; i < pts.length; i++) lab.face([Q(...pts[i - 1], 0.3), Q(...pts[i], 0.3), Q(...pts[i], 0.54), Q(...pts[i - 1], 0.54)], alpha(c.text3, 0.12));
      for (const h of [0.3, 0.54]) trace(pts.map(([x, y]) => Q(x, y, h)), edge, 1.2);
      lab.label(plus(sd) ? '+' : '−', Q(sd * R * 0.55, R * 0.8, 0.6), plus(sd) ? c.danger : c.primary);
    }
    // iz, zarra, vektorlar
    if (Y.trail.length > 1) trace(Y.trail.map(([x, y]) => Q(x, y)), c.danger, 1.6, 700);
    const p = Q(...Y.p);
    particle(p, Y.q, 0.04);
    if (Y.vec && !Y.out) {
      const sp = Math.hypot(...Y.v) || 1, ux = Y.v[0] / sp, uy = Y.v[1] / sp;
      lab.vector(p, [ux * 0.3, 0, uy * 0.3], c.primary, 'v');
      if (Math.abs(Y.p[0]) > 0.012) lab.vector(p, [uy * 0.22, 0, -ux * 0.22], c.danger, 'F');
    }
    // generator (chastota dastasi) va ossillograf; «Rezonans» tugmasi generator ustida
    const fr = Y.fgen / Y.fc, res = Math.abs(fr - 1) < 0.003;
    const gen = supply(lab, [2.05, 0, -0.95], { w: 1.0, h: 0.6, d: 0.42, text: `${fmt(Y.fgen / 1e6, 2)} MHz`, title: '', frac: (fr - 0.8) / 0.4, id: 'kF', marks: false });
    knobF = gen.knob;
    lab.box(1.95, 0.6, -0.9, 0.42, 0.06, 0.2, res ? c.success : c.primary);
    lab.handle('res', [2.16, 0.66, -0.8], 0.2);
    lab.label(res ? 'Rezonans ✓' : narrow ? 'Rezonans' : 'Rezonansga sozlash', [2.16, 0.8, -0.85], res ? c.success : c.primary);
    if (!narrow) lab.label(res ? `Generator · f_c = ${fmt(Y.fc / 1e6, 2)} MHz` : `Generator · farq ${fr > 1 ? '+' : '−'}${fmt(Math.abs(fr - 1) * 100, 1)}%`, [2.05, -0.02, -1.2], res ? c.text2 : c.danger);
    path(lab, [gen.plus, [gen.plus[0], 0.04, gen.plus[2]], [gen.plus[0], 0.04, -0.2], [CX + (R + 0.02) * K, 0.04, -0.2], Q(R * 0.7, -0.05, 0.3)], c.danger, 0.01);
    path(lab, [gen.minus, [gen.minus[0], 0.06, gen.minus[2]], [gen.minus[0], 0.06, -1.3], [CX - (R + 0.05) * K, 0.06, -1.3], [CX - (R + 0.05) * K, 0.06, -0.2], Q(-R * 0.7, -0.05, 0.3)], c.text2, 0.01);
    // ossillograf: U(t), sariq — tirqishdan o'tish lahzalari
    const ox0 = 1.45, ox1 = 2.75, oz = 0.3;
    lab.box(ox0, 0, oz, ox1 - ox0, 0.95, 0.42, shell(c));
    const sx0 = ox0 + 0.1, sx1 = ox1 - 0.1, sy0 = 0.28, sy1 = 0.86, mid = (sy0 + sy1) / 2, zs = oz - 0.006;
    lab.face([[sx0, sy0, zs], [sx1, sy0, zs], [sx1, sy1, zs], [sx0, sy1, zs]], '#0f172a');
    lab.line([sx0, mid, zs - 0.002], [sx1, mid, zs - 0.002], 'rgba(148,163,184,0.35)', 0.8);
    const span = 3 / Y.fc, t1 = Y.t, wave = [];
    for (let i = 0; i <= 120; i++) { const t = t1 - span + (span * i) / 120; wave.push([sx0 + ((sx1 - sx0) * i) / 120, mid + Math.cos(TAU * Y.fgen * t) * (sy1 - sy0) * 0.4, zs - 0.003]); }
    trace(wave, '#4ade80', 1.5);
    for (const tc of Y.cross) { if (tc < t1 - span) continue; ball(lab, [sx0 + ((tc - (t1 - span)) / span) * (sx1 - sx0), mid + Math.cos(TAU * Y.fgen * tc) * (sy1 - sy0) * 0.4, zs - 0.01], 0.018, '#fbbf24', 3); }
    if (!narrow) lab.label('Ossillograf: U(t)', [(ox0 + ox1) / 2, 1.08, oz + 0.1], c.text2);
    void anim;
  }

  /**
   * cfg.mode: 'plane' | 'helix' | 'ms' | 'cyc'; cfg.L / cfg.H / cfg.M / cfg.Y — lorentz.js tayyorlagan qiymatlar.
   */
  function draw(ctx, stage, cfg) {
    const view = VIEW[cfg.mode] || VIEW.plane;
    narrow = stage.w < 480;
    lab.begin(ctx, stage, view.begin);
    if (cfg.mode === 'plane') {
      planeScene(cfg.L);
      const L = cfg.L;
      lab.finish(narrow ? `${L.name}: q = ${L.q > 0 ? '+' : '−'}${fmt(Math.abs(L.q) / L.e, 0)}e` : `${L.name}: q = ${L.q > 0 ? '+' : '−'}${fmt(Math.abs(L.q) / L.e, 0)}e, m = ${sci(L.m, 3)} kg`, `harakat ~${sci(L.slow, 2)} marta sekinlashtirilgan`);
    } else if (cfg.mode === 'helix') {
      helixScene(cfg.H);
      const H = cfg.H;
      lab.finish(narrow ? `${H.name}: vint chiziq` : `${H.name}: vint chiziq — radius ${fmt(H.r, 1)} cm, davr T = ${sci(H.T, 3)} s`, narrow ? 'B — solenoid o‘qi bo‘ylab' : 'B — solenoid o‘qi bo‘ylab · o‘ramlar siyrak ko‘rsatilgan');
    } else if (cfg.mode === 'ms') {
      msScene(cfg.M);
      lab.finish('3D laboratoriya', narrow ? 'Yuqori qutb shaffof' : 'Vakuum kamera · yuqori magnit qutbi shaffof ko‘rsatilgan');
      msLegend(ctx, stage, cfg.M);
    } else {
      cycScene(cfg.Y, cfg.anim || 0);
      lab.finish(`3D laboratoriya · W = ${fmt(cfg.Y.W, 2)} MeV`, narrow ? `R = ${fmt(cfg.Y.R * 100, 0)} cm` : `Duant radiusi R = ${fmt(cfg.Y.R * 100, 0)} cm · yuqori qutb shaffof`);
    }
  }
  return {
    lab, draw,
    setMode(m) { if (VIEW[m] && m !== mode) { mode = m; lab.reset(); } },
    /** Tutqichlar yo'li (lab.nearest uchun). */
    edgeAt: (x) => [PX(x), 0.5, -LOR_H * S - 0.1],
    gunAt: (y) => [PX(2), YP, y * S],
    rulerAt: (d) => [MX(-3.2), 0.47, MZ(-d)],
    knobU: (f) => knobU(f), knobE: (f) => knobE(f), knobF: (f) => knobF(f),
    /** v uchi: ekran nuqtasi → zarra tekisligidagi siljish [dx, dy] (cm), v boshidan; ko'rinmasa null. */
    tipDelta(p) {
      const st = planeHit(lab, p, [0, YP, 0], [1, 0, 0], [0, 0, 1]);
      if (!st) return null;
      return [(st[0] + 2.28) / S - tipO[0], st[1] / S - tipO[1]];
    },
    /** Vint: ekran nuqtasi → v boshidan siljish [dx (B bo'ylab), dy] (cm) — tik tekislikda. */
    htipDelta(p) {
      const q = lab.planePoint(p.x, p.y, hO[2]);
      if (!q) return null;
      return [(q[0] - hO[0]) / S, (q[1] - hO[1]) / S];
    },
    clamp,
  };
}
