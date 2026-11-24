// Elektromagnit to'lqinlar va radioaloqa — 360° 3D laboratoriya sahnasi (simulations/emwaves.html).
// Holat va fizika emwaves.js / emwaves-physics.js da o'zgarmaydi; bu yerda faqat asboblar, maydon chiziqlari va tutqichlar.
// Old tomon −z, stol usti y = 0. EM to'lqin +x bo'ylab tarqaladi: E — vertikal (y), B — gorizontal (2D dagi «bizga» → −z),
// shunda E × B tarqalish yo'nalishiga qaraydi.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, path, dashed } from './apparatus-3d.js?v=20261124-n3';
import { ball, glow, shell, planeHit, camRing } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt, sci } from './sim-kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
/** EM to'lqin rejimi: o'q x ∈ [X0, X1], ekranda 2,5 to'lqin uzunligi. */
export const X0 = -2.2, X1 = 2.7, LAMS = 2.5;
const YC = 0.95, AY = 0.6, AB = 0.48;
/** Gers tajribalari: to'lqin tushadigan nuqta va nurlatgich masofasi. */
export const HIT = [0, 0.45, 0.55], RE = 1.55;
/** Qutblanish: qabul qiluvchi vibrator markazi. */
export const RXC = [1.5, 0.8, 0];
const RLEN = 0.55;
/** Radio: sozlash shkalasi 0,5…1,6 MHz. */
const DX0 = -2.7, DX1 = 1.0, DXF = (f) => DX0 + ((f - 0.5) / 1.1) * (DX1 - DX0);

const VIEW = {
  wave: { begin: { target: [0.1, 0.85, 0], focal: 2.2 }, camera: { yaw: -0.55, pitch: 0.3, zoom: 1 } },
  reflect: { begin: { target: [0, 0.35, -0.1], focal: 2.3 }, camera: { yaw: -0.1, pitch: 0.95, zoom: 1 } },
  refract: { begin: { target: [0, 0.35, 0.1], focal: 2.3 }, camera: { yaw: -0.1, pitch: 0.95, zoom: 1 } },
  polar: { begin: { target: [-0.1, 0.75, 0], focal: 2.25 }, camera: { yaw: -0.75, pitch: 0.3, zoom: 1 } },
  radio: { begin: { target: [-0.1, 0.45, -0.1], focal: 2.15 }, camera: { yaw: -0.12, pitch: 0.62, zoom: 1 } },
};

export function createEmwavesLab() {
  const lab = createLab3D();
  let mode = 'wave', narrow = false;
  lab.reset = () => Object.assign(lab.camera, VIEW[mode].camera);
  lab.reset();

  function trace(pts, color, width = 2) { for (let i = 1; i < pts.length; i++) if (pts[i - 1] && pts[i]) lab.line(pts[i - 1], pts[i], color, width); }
  /** Dipol vibrator: ikki tik sterjen, uchlarida zaryadlangan sharlar, o'rtada uchqun oralig'i. */
  function vibrator(x, yc, z, len, q, col) {
    const c = lab.colors;
    lab.rod([x, yc + 0.05, z], [x, yc + len, z], 0.025, col || c.text2, 10);
    lab.rod([x, yc - 0.05, z], [x, yc - len, z], 0.025, col || c.text2, 10);
    ball(lab, [x, yc, z], 0.04, c.warning, 4);
    if (q != null) for (const [y, s] of [[yc + len, q], [yc - len, -q]]) ball(lab, [x, y, z], 0.085, alpha(s > 0 ? c.danger : c.primary, 0.3 + 0.7 * Math.abs(s)), 6);
  }
  /** Karnay antenna (rupor): to'lqin o'tkazgich va kengayuvchi og'iz; dir — og'iz qaragan gorizontal yo'nalish. */
  function horn(p, dir, color) {
    const s = [-dir[2], 0, dir[0]], at = (k, a, b) => p.map((v, i) => v + dir[i] * k + s[i] * a + (i === 1 ? b : 0));
    lab.rod(at(-0.42, 0, 0), at(-0.16, 0, 0), 0.055, color, 12);
    const back = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => at(-0.17, a * 0.06, b * 0.05)), mouth = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => at(0, a * 0.17, b * 0.13));
    for (let i = 0; i < 4; i++) lab.face([back[i], back[(i + 1) % 4], mouth[(i + 1) % 4], mouth[i]], color);
    lab.rod([p[0] - dir[0] * 0.3, 0, p[2] - dir[2] * 0.3], [p[0] - dir[0] * 0.3, p[1] - 0.05, p[2] - dir[2] * 0.3], 0.02, lab.colors.text3, 8);
    lab.box(p[0] - dir[0] * 0.3 - 0.1, 0, p[2] - dir[2] * 0.3 - 0.1, 0.2, 0.03, 0.2, lab.colors.text3);
  }
  /** Gorizontal tarqalayotgan to'lqin dastasi: shaffof lenta, to'lqin frontlari va yo'nalish strelkasi. */
  function beam(start, dir, len, lam, phase, color, a = 1) {
    const s = [-dir[2], 0, dir[0]], at = (k, w, h = 0) => start.map((v, i) => v + dir[i] * k + s[i] * w + (i === 1 ? h : 0));
    lab.face([at(0, -0.13), at(len, -0.13), at(len, 0.13), at(0, 0.13)], alpha(color, 0.13 * a));
    for (let k = (((phase % 1) + 1) % 1) * lam; k < len; k += lam) { lab.line(at(k, -0.14), at(k, 0.14), alpha(color, a), 2); lab.line(at(k, 0, -0.1), at(k, 0, 0.1), alpha(color, 0.6 * a), 1.4); }
    lab.vector(at(len * 0.5, 0), dir.map((v) => v * 0.22), alpha(color, a));
  }
  /** Gorizontal yoy (markaz p, burchak t0 → t1 normal −z dan o'lchanadi, sign — chap/o'ng). */
  function arcH(p, r, t0, t1, sx, sz, color) { const pts = []; for (let k = 0; k <= 16; k++) { const t = t0 + ((t1 - t0) * k) / 16; pts.push([p[0] + sx * r * Math.sin(t), p[1], p[2] + sz * r * Math.cos(t)]); } trace(pts, color, 1.5); }

  /* ---------------------------------------------------------------- 1) EM to'lqin */
  function waveScene(W) {
    const c = lab.colors, L = X1 - X0, lam = L / LAMS, ph = (x) => TAU * W.u - (TAU * (x - X0)) / lam, ecol = W.vc || c.danger;
    if (W.n > 1) lab.box(X0, 0.15, -0.75, L, 1.65, 1.5, W.water ? alpha('#0ea5e9', 0.12) : alpha(c.text3, 0.12));
    // o'q va tarqalish yo'nalishi
    lab.line([X0, YC, 0], [X1, YC, 0], c.borderStrong, 1.2);
    lab.vector([X1 - 0.45, YC, 0], [0.4, 0, 0], c.text2);
    lab.label(W.n > 1 ? 'v = c/n' : 'v = c', [X1 - 0.2, YC - 0.17, 0], c.text2);
    // B (gorizontal tekislikda) va E (tik tekislikda)
    const E = [], B = [];
    for (let x = X0; x <= X1 + 1e-9; x += 0.03) { const v = Math.cos(ph(x)); E.push([x, YC + v * AY, 0]); B.push([x, YC, -v * AB]); }
    if (W.showB) {
      trace(B, c.primary, 2.2);
      for (let x = X0 + lam / 16; x <= X1; x += lam / 8) { const v = Math.cos(ph(x)); if (Math.abs(v) > 0.1) lab.line([x, YC, 0], [x, YC, -v * AB], alpha(c.primary, 0.55), 1.3); }
      lab.label('B', [X0 + 0.1, YC, -AB - 0.15], c.primary);
    }
    trace(E, ecol, 2.8);
    for (let x = X0 + lam / 16; x <= X1; x += lam / 8) { const v = Math.cos(ph(x)); if (Math.abs(v) > 0.1) lab.line([x, YC, 0], [x, YC + v * AY, 0], alpha(ecol, 0.55), 1.3); }
    lab.label('E', [X0 + 0.1, YC + AY + 0.18, 0], ecol);
    // λ: ikki qo'shni cho'qqi orasida
    let xa = X0 + (W.u - Math.floor(W.u)) * lam; while (xa < X0 + 0.2) xa += lam;
    const xb = xa + lam, yb = YC + AY + 0.22;
    if (xb < X1 - 0.1) {
      lab.line([xa, yb, 0], [xb, yb, 0], c.text2, 1.2);
      for (const x of [xa, xb]) lab.line([x, yb - 0.06, 0], [x, yb + 0.02, 0], c.text2, 1.2);
      lab.label(`λ = ${sci(W.lam, 3)} m`, [(xa + xb) / 2, yb + 0.12, 0], c.text);
    }
    // vibrator (Gers vibratori) va induksion g'altak
    const xv = X0 - 0.4, q = Math.cos(TAU * W.u);
    vibrator(xv, YC, 0, 0.55, q);
    lab.rod([xv, 0.03, 0.25], [xv, YC - 0.62, 0.25], 0.02, c.text3, 8); lab.rod([xv, YC - 0.62, 0.25], [xv, YC - 0.62, 0.04], 0.02, c.text3, 8);
    lab.box(xv - 0.18, 0, 0.12, 0.36, 0.05, 0.3, c.text3);
    lab.box(xv - 0.2, 0, 0.55, 0.4, 0.26, 0.36, shell(lab.colors));
    path(lab, [[xv - 0.08, 0.26, 0.55], [xv - 0.08, YC, 0.3], [xv, YC, 0.05]], c.text2, 0.008);
    if (!narrow) lab.label('vibrator', [xv, 0.1, -0.35], c.text3);
    // o'lchov nuqtasi: old reyka bo'ylab suriladigan arava
    const xp = X0 + W.probe * L, Ep = Math.cos(ph(xp));
    lab.box(X0, 0, -1.08, L, 0.05, 0.12, c.text3);
    dashed(lab, [xp, 0.15, 0], [xp, 1.75, 0], c.warning, 1.4);
    lab.line([xp, 0.17, -1.02], [xp, 0.15, 0], alpha(c.warning, 0.5), 1);
    ball(lab, [xp, YC + Ep * AY, 0], 0.05, c.warning, 5);
    lab.box(xp - 0.09, 0.05, -1.1, 0.18, 0.12, 0.16, c.warning);
    lab.handle('probe', [xp, 0.12, -1.02], 0.2);
    lab.label(`E = ${fmt(Ep * W.E0, 1)} V/m`, [xp, 0.42, -1.02], c.text);
  }

  /* ---------------------------------------------------------------- 2) Gers tajribalari */
  function beamScene(Pp) {
    const c = lab.colors, a = Pp.a, H = HIT, refl = Pp.view === 'reflect', lam = 0.18;
    if (refl) {
      lab.box(-2.4, 0, H[2], 4.8, 0.95, 0.05, c.dark ? '#64748b' : '#94a3b8');
      lab.label('metall list', [-1.9, 1.08, H[2]], c.text3);
    } else {
      lab.box(-2.4, 0, H[2], 4.8, 0.9, 1.05, alpha('#facc15', c.dark ? 0.16 : 0.24));
      lab.line([-2.4, H[1], H[2] - 0.003], [2.4, H[1], H[2] - 0.003], c.borderStrong, 1);
      lab.label(narrow ? `dielektrik, n = ${fmt(Pp.n, 2)}` : `dielektrik (parafin, asfalt), n = ${fmt(Pp.n, 2)}`, [-1.3, 1.02, H[2] + 0.3], c.text2);
    }
    dashed(lab, [H[0], H[1], H[2]], [H[0], H[1], H[2] - 1.5], c.text3, 1);
    // nurlatgich (sudraladi) va tushuvchi dasta
    const din = [Math.sin(a), 0, Math.cos(a)], E = H.map((v, i) => v - din[i] * RE);
    beam(E, din, RE, lam, -Pp.ph, c.danger);
    horn(E, din, c.danger);
    lab.handle('emit', E, 0.24);
    if (!narrow) lab.label('nurlatgich (generator)', [E[0], 0.05, E[2] - 0.35], c.text3);
    // qaytgan dasta
    const dref = [Math.sin(a), 0, -Math.cos(a)];
    beam(H, dref, RE, lam, Pp.ph, c.warning, refl ? 1 : Math.max(0.25, Math.sqrt(Pp.R)));
    if (refl) { const Rx = H.map((v, i) => v + dref[i] * RE); horn(Rx, dref.map((v) => -v), c.success); if (!narrow) lab.label('qabul qiluvchi', [Rx[0], 0.05, Rx[2] - 0.35], c.text3); }
    // burchaklar (normaldan)
    arcH(H, 0.38, 0, a, -1, -1, c.danger);
    lab.label(`α = ${fmt(a / DEG, 1)}°`, [H[0] - 0.62 * Math.sin(Math.max(a, 0.3) / 2) - 0.12, H[1] + 0.05, H[2] - 0.62 * Math.cos(Math.max(a, 0.3) / 2)], c.danger);
    if (refl) {
      arcH(H, 0.44, 0, a, 1, -1, c.warning);
      lab.label(`β = ${fmt(a / DEG, 1)}°`, [H[0] + 0.66 * Math.sin(Math.max(a, 0.3) / 2) + 0.12, H[1] + 0.05, H[2] - 0.66 * Math.cos(Math.max(a, 0.3) / 2)], c.warning);
    } else if (Pp.b != null) {
      const b = Pp.b, dr = [Math.sin(b), 0, Math.cos(b)], len = Math.min(1.02 / Math.max(0.2, Math.cos(b)), RE);
      beam(H, dr, len, lam / Pp.n, Pp.ph * Pp.n, c.primary);
      dashed(lab, H, [H[0], H[1], H[2] + 1.05], c.text3, 1);
      arcH(H, 0.34, 0, b, 1, 1, c.primary);
      lab.label(`β = ${fmt(b / DEG, 1)}°`, [H[0] + 0.5 * Math.sin(Math.max(b, 0.3) / 2) + 0.1, H[1] + 0.05, H[2] + 0.55 * Math.cos(Math.max(b, 0.3) / 2)], c.primary);
    }
  }
  function polarScene(Pp) {
    const c = lab.colors, yc = RXC[1], xe = -2.3, phi = Pp.phi, P0 = Pp.P0;
    vibrator(xe, yc, 0, 0.5, Math.cos(TAU * Pp.ph));
    lab.rod([xe, 0, 0.3], [xe, yc - 0.58, 0.3], 0.02, c.text3, 8); lab.rod([xe, yc - 0.58, 0.3], [xe, yc - 0.58, 0.04], 0.02, c.text3, 8);
    if (!narrow) lab.label('nurlatgich', [xe, 0.08, -0.3], c.text3);
    // E — vertikal tekislikda tebranadi
    const x0 = xe + 0.3, x1 = RXC[0] - 0.4, lam = (x1 - x0) / 3, E = [];
    for (let x = x0; x <= x1 + 1e-9; x += 0.03) E.push([x, yc + Math.cos(TAU * Pp.ph - (TAU * (x - x0)) / lam) * 0.42, 0]);
    trace(E, c.danger, 2.4);
    lab.label('E ↕', [x0 + 0.2, yc + 0.6, 0], c.danger);
    // qabul qiluvchi vibrator (sudrab buriladi): to'lqinga tik tekislikda
    const e = [0, Math.cos(phi), -Math.sin(phi)], at = (k) => RXC.map((v, i) => v + e[i] * k);
    lab.rod(at(0.05), at(RLEN), 0.025, c.success, 10); lab.rod(at(-0.05), at(-RLEN), 0.025, c.success, 10);
    ball(lab, RXC, 0.045, c.warning, 4);
    ball(lab, at(RLEN), 0.06, c.primary, 5);
    lab.handle('rx', at(RLEN), 0.18);
    lab.rod([RXC[0], 0, 0.6], [RXC[0], yc, 0.6], 0.025, c.text3, 8); lab.rod([RXC[0], yc, 0.6], [RXC[0], yc, 0.05], 0.02, c.text3, 8);
    lab.box(RXC[0] - 0.15, 0, 0.45, 0.3, 0.03, 0.3, c.text3);
    dashed(lab, [RXC[0], yc - RLEN - 0.1, 0], [RXC[0], yc + RLEN + 0.1, 0], c.text3, 1);
    const arc = []; for (let k = 0; k <= 16; k++) { const t = (phi * k) / 16; arc.push([RXC[0], yc + 0.3 * Math.cos(t), -0.3 * Math.sin(t)]); }
    trace(arc, c.warning, 1.5);
    lab.label(`φ = ${fmt(phi / DEG, 0)}°`, [RXC[0], yc + RLEN + 0.2, -0.1], c.warning);
    // indikator lampa
    const lp = [RXC[0] + 0.75, yc, 0.3];
    path(lab, [[RXC[0], yc, 0.05], [RXC[0] + 0.2, yc - 0.2, 0.2], [lp[0], 0.25, lp[2]]], c.text2, 0.008);
    lab.rod([lp[0], 0, lp[2]], [lp[0], yc - 0.1, lp[2]], 0.03, c.text3, 8);
    ball(lab, lp, 0.1, P0 > 0.05 ? `rgba(254,240,138,${0.45 + 0.55 * P0})` : alpha(c.text3, 0.35), 7);
    if (P0 > 0.02) glow(lab, lp, 0.18 + 0.35 * P0, [250, 204, 21], 0.8 * P0);
    lab.label(`signal ${fmt(P0 * 100, 0)} %`, [lp[0], yc + 0.28, lp[2]], c.text2);
    if (!narrow) lab.label('qabul qiluvchi vibrator', [RXC[0], 0.08, -0.35], c.text3);
  }

  /* ---------------------------------------------------------------- 3) Radioaloqa */
  function scopeDev(x, z, w, h, ys, col, title, extra) {
    const c = lab.colors, sx0 = x - w / 2 + 0.06, sx1 = x + w / 2 - 0.06, sy0 = 0.1, sy1 = h - 0.08, mid = (sy0 + sy1) / 2, zs = z - 0.004;
    lab.box(x - w / 2, 0, z, w, h, 0.38, shell(c));
    lab.face([[sx0, sy0, zs], [sx1, sy0, zs], [sx1, sy1, zs], [sx0, sy1, zs]], c.dark ? '#0b1220' : '#f8fafc');
    lab.line([sx0, mid, zs - 0.002], [sx1, mid, zs - 0.002], alpha(c.text3, 0.4), 0.8);
    const plot = (arr, color, width) => { const n = arr.length, step = Math.max(1, Math.floor(n / 140)), pts = []; for (let k = 0; k < n; k += step) pts.push([sx0 + 0.02 + (k / (n - 1)) * (sx1 - sx0 - 0.04), mid + (clamp(arr[k], -1.8, 1.8) * (sy1 - sy0 - 0.06)) / 3.8, zs - 0.004]); trace(pts, color, width); };
    if (extra) plot(extra.ys, extra.col, 1.6);
    plot(ys, col, 1.4);
    if (title) lab.label(title, [x, h + 0.1, z + 0.1], c.text2);
    return { l: [x - w / 2, 0.03, z + 0.19], r: [x + w / 2, 0.03, z + 0.19] };
  }
  function radioScene(R) {
    const c = lab.colors, tr = R.tr, zT = 0.85, zR = -0.5, xs = [-2.25, -0.95, 0.35], wD = 1.1;
    // uzatgich (orqa qator)
    const t1 = scopeDev(xs[0], zT, wD, 0.85, tr.audio, c.success, narrow ? 'tovush' : 'Mikrofon: tovush (F)');
    const t2 = scopeDev(xs[1], zT, wD, 0.85, tr.carrier, c.text2, narrow ? 'tashuvchi' : 'Generator: tashuvchi (f)');
    const t3 = scopeDev(xs[2], zT, wD, 0.85, tr.mod, c.danger, narrow ? 'modulyatsiya' : R.mod === 'am' ? 'Modulyator: AM signal' : 'Modulyator: FM signal');
    for (const [a, b] of [[t1.r, t2.l], [t2.r, t3.l]]) path(lab, [a, b], c.text2, 0.01);
    // antenna minorasi va tarqalayotgan to'lqinlar
    const tx = 1.75, tz = 1.0, top = [tx, 1.85, tz];
    for (const [dx, dz] of [[-0.22, -0.15], [0.22, -0.15], [0, 0.22]]) lab.rod([tx + dx, 0, tz + dz], top, 0.016, c.text2, 6);
    for (let k = 1; k <= 5; k++) { const y = (1.85 * k) / 6, f = 1 - k / 6; lab.line([tx - 0.22 * f, y, tz - 0.15 * f], [tx + 0.22 * f, y, tz - 0.15 * f], c.text3, 1); lab.line([tx + 0.22 * f, y, tz - 0.15 * f], [tx, y, tz + 0.22 * f], c.text3, 1); }
    ball(lab, top, 0.04, c.danger, 4);
    path(lab, [t3.r, [tx, 0.03, t3.r[2]], [tx, 0.03, tz - 0.1]], c.text2, 0.01);
    const pulse = (R.t * 0.8) % 1;
    for (let k = 0; k < 3; k++) { const ph = (pulse + k / 3) % 1; camRing(lab, top, 0.12 + ph * 0.55, alpha(c.danger, 1 - ph), 1.5); }
    // priyomnik (old qator): antenna → kontur → detektor → karnay
    const ra = [1.35, 0, -0.35];
    lab.rod(ra, [ra[0], 1.35, ra[2]], 0.012, c.text2, 6); lab.box(ra[0] - 0.08, 0, ra[2] - 0.08, 0.16, 0.05, 0.16, c.text3);
    const r1 = scopeDev(xs[0], zR, wD, 0.6, tr.rx, c.primary, narrow ? 'kontur' : 'Kontur: tanlangan signal');
    const r2 = scopeDev(xs[1], zR, wD, 0.6, tr.det, c.warning, narrow ? 'detektor' : 'Detektor (diod + RC)', { ys: tr.rx.map((v) => Math.max(0, v)), col: alpha(c.text3, 0.45) });
    const r3 = scopeDev(xs[2], zR, wD, 0.6, tr.out.map((v) => v * 1.2), c.success, narrow ? 'karnay' : 'Karnayga: tovush');
    path(lab, [[ra[0], 0.05, ra[2]], [ra[0], 0.03, -1.0], [xs[0] - wD / 2 - 0.1, 0.03, -1.0], [xs[0] - wD / 2 - 0.1, 0.03, r1.l[2]], r1.l], c.text2, 0.01);
    for (const [a, b] of [[r1.r, r2.l], [r2.r, r3.l]]) path(lab, [a, b], c.text2, 0.01);
    // karnay
    const kx = 2.35, kz = -0.55, ky = 0.32, lvl = R.level;
    lab.box(kx - 0.3, 0, kz, 0.6, 0.62, 0.36, c.text3);
    const cone = []; for (let k = 0; k <= 24; k++) { const t = (k * TAU) / 24; cone.push([kx + 0.2 * Math.cos(t), ky + 0.2 * Math.sin(t), kz - 0.005]); }
    lab.face(cone.slice(0, 24), c.dark ? c.bg : c.text); ball(lab, [kx, ky, kz - 0.02], 0.05, c.text2, 4);
    for (let k = 1; k <= 3; k++) if (lvl > 0.02) camRing(lab, [kx, ky, kz - 0.1], 0.18 + k * 0.1, alpha(c.success, lvl * (1 - k / 4)), 2);
    path(lab, [r3.r, [kx - 0.3, 0.03, r3.r[2]]], c.text2, 0.01);
    // sozlash shkalasi (sudraladi)
    lab.box(DX0 - 0.15, 0, -1.5, DX1 - DX0 + 0.3, 0.08, 0.32, shell(c));
    for (let f = 0.5; f <= 1.6001; f += 0.1) {
      const x = DXF(f);
      lab.line([x, 0.082, -1.36], [x, 0.082, -1.26], c.text2, 1);
      if (Math.round(f * 10) % 2 === 1 || !narrow) lab.label(fmt(f, 1), [x, 0.08, -1.43], c.text3);
    }
    for (const s of R.stations) lab.box(DXF(s.f / 1e6) - 0.015, 0.08, -1.3, 0.03, 0.02, 0.16, alpha(c.success, 0.8));
    const xf = DXF(R.f0 / 1e6);
    lab.box(xf - 0.012, 0.08, -1.48, 0.024, 0.05, 0.28, c.danger);
    ball(lab, [xf, 0.17, -1.33], 0.05, c.primary, 5);
    lab.handle('dial', [xf, 0.15, -1.33], 0.18);
    if (!narrow) lab.label('MHz', [DX1 + 0.3, 0.08, -1.33], c.text3);
  }

  /**
   * cfg.mode: 'wave' | 'props' | 'radio'; cfg.W / cfg.P / cfg.R — emwaves.js tayyorlagan qiymatlar.
   */
  function draw(ctx, stage, cfg) {
    const key = cfg.mode === 'props' ? cfg.P.view : cfg.mode, view = VIEW[key] || VIEW.wave;
    narrow = stage.w < 480;
    lab.begin(ctx, stage, view.begin);
    if (cfg.mode === 'wave') {
      waveScene(cfg.W);
      lab.finish(cfg.W.band, narrow ? 'E — tik, B — gorizontal' : 'E — tik tekislikda, B — gorizontal tekislikda · amplitudalar shartli');
    } else if (cfg.mode === 'props') {
      if (cfg.P.view === 'polar') polarScene(cfg.P); else beamScene(cfg.P);
      const note = cfg.P.view === 'polar' ? 'Vibrator to‘lqinga tik tekislikda buriladi' : cfg.P.view === 'reflect' ? 'Gers tajribasi: santimetrli to‘lqinlar' : narrow ? `qaytgan ulush ${fmt(cfg.P.R * 100, 1)} %` : `dielektrikda λ' = λ/n, qaytgan ulush ${fmt(cfg.P.R * 100, 1)} %`;
      lab.finish('3D laboratoriya', note);
    } else {
      radioScene(cfg.R);
      lab.finish(narrow ? `${cfg.R.label} · ${fmt(cfg.R.f / 1e6, 2)} MHz` : `Radiouzatgich: ${cfg.R.label} (${fmt(cfg.R.f / 1e6, 2)} MHz, ${cfg.R.mod.toUpperCase()})`, `Radiopriyomnik: f₀ = ${fmt(cfg.R.f0 / 1e6, 3)} MHz`);
    }
  }
  return {
    lab, draw,
    setMode(m) { if (VIEW[m] && m !== mode) { mode = m; lab.reset(); } },
    /** Tutqichlar yo'li (lab.nearest uchun). */
    probeAt: (f) => [X0 + f * (X1 - X0), 0.12, -1.02],
    dialAt: (fMHz) => [DXF(fMHz), 0.15, -1.33],
    /** Nurlatgich: ekran nuqtasi → tushish burchagi α (rad), gorizontal tekislikda; ko'rinmasa null. */
    emitAngle(p) {
      const st = planeHit(lab, p, HIT, [1, 0, 0], [0, 0, 1]);
      if (!st) return null;
      return Math.atan2(-st[0], -st[1]);
    },
    /** Qabul qiluvchi vibrator: ekran nuqtasi → φ (rad, 0…π); ko'rinmasa null. */
    rxAngle(p) {
      const st = planeHit(lab, p, RXC, [0, 0, -1], [0, 1, 0]);
      if (!st) return null;
      let a = Math.atan2(st[0], st[1]); if (a < 0) a += Math.PI;
      return a;
    },
  };
}
