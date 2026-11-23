import { createLab3D } from './lab-3d.js?v=20261123-batch5d';
import { alpha, arrowSolid, dashed, dial, ring, stand } from './apparatus-3d.js?v=20261123-batch5d';
import { clamp, fmt } from './sim-kit.js';
import * as W from './waves-physics.js';

const TAU = Math.PI * 2;
// The solvers retain their SI/cm coordinates. Only these presentation maps change.
export const stringPoint = (x, u = 0, longitudinal = false) => [-2.4 + x * 1.2 + (longitudinal ? u * 4.5 : 0), 1.15 + (longitudinal ? 0 : u * 4.5), 0];
export const waterPoint = (x, y, h = 0) => [x * .065, .42 + h * .085, -y * .065];
export const soundPoint = (x, y) => [x * .105, .38, -y * .105];

const rgb = color => {
  const h = color.replace('#', '');
  if (/^[\da-f]{6}$/i.test(h)) return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  if (/^[\da-f]{3}$/i.test(h)) return [...h].map(v => parseInt(v + v, 16));
  return (color.match(/[\d.]+/g) || [128, 128, 128]).slice(0, 3).map(Number);
};
const blend = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };

export function createWavesLab() {
  const lab = createLab3D();
  const reset = lab.reset;
  lab.reset = () => { reset(); lab.camera.pitch = .52; };
  lab.reset();

  const strokePath = (points, color, width = 1.2) => {
    for (let i = 1; i < points.length; i++) lab.line(points[i - 1], points[i], color, width);
  };
  function ruler(x0, x1, y, z, length, unit, color) {
    lab.box(x0, y - .025, z - .05, x1 - x0, .025, .1, lab.colors.bg2);
    for (let i = 0; i <= length * 4; i++) {
      const x = x0 + (x1 - x0) * i / (length * 4), major = i % 4 === 0;
      lab.line([x, y + .003, z - .04], [x, y + .003, z + (major ? .045 : .015)], color, major ? 1.1 : .6);
      if (major && (length < 8 || i % 8 === 0)) lab.label(`${fmt(i / 4, 0)}`, [x, y + .06, z - .12], color);
    }
    lab.label(unit, [x1 + .15, y + .04, z], color);
  }
  function generator(x, y, z, knobs) {
    const c = lab.colors;
    lab.box(x - .52, y, z, 1.04, .48, .44, c.text3);
    lab.box(x - .48, y + .04, z - .012, .96, .39, .025, c.bg2);
    for (let i = 0; i < 5; i++) lab.line([x - .37 + i * .06, y + .32, z - .03], [x - .37 + i * .06, y + .39, z - .03], c.borderStrong);
    knobs.forEach(([id, value, label, color], i) => {
      dial(lab, [x - .24 + i * .48, y + .22, z - .035], value, color, id, label.split(' ')[0]);
      lab.label(label, [x, y + .69 + i * .29, z - .035], color);
    });
  }

  function drawString(str, sim, nd, harmonic) {
    const c = lab.colors, long = str.wave === 'long', L = sim.L;
    stand(lab, long && str.right === 'free' ? 2.96 : 2.55, 0, long && str.right === 'free' ? 1.15 : 2.02, c.text3);
    lab.box(-2.94, .02, -.3, .5, .12, .6, c.text3);
    lab.box(-2.86, .14, -.24, .36, 1.21, .48, c.bg2);
    lab.rod([-2.83, 1.15, 0], stringPoint(0, sim.u[0], long), .045, c.warning, 12);
    if (long) {
      const pts = [], n = 320;
      for (let i = 0; i <= n; i++) {
        const x = L * i / n, a = stringPoint(x, sim.at(x), true), theta = TAU * 32 * i / n;
        // Longitudinal displacement is along x; the helix radius does not encode displacement.
        pts.push([a[0], a[1] + .145 * Math.sin(theta), a[2] + .145 * Math.cos(theta)]);
      }
      for (let i = 1; i < pts.length; i++) lab.rod(pts[i - 1], pts[i], .018, c.primary, 6);
      const p = stringPoint(str.probeX, sim.at(str.probeX), true);
      ring(lab, p, .17, c.danger, 'x', .025); lab.handle('probe', p);
      lab.label('siqilish ↔ siyraklanish', [0, 1.7, 0], c.text2);
      arrowSolid(lab, [-.35, .8, -.12], [.35, .8, -.12], c.warning, .012);
    } else {
      const pts = Array.from({ length: 101 }, (_, i) => stringPoint(i * L / 100, sim.at(i * L / 100)));
      for (let i = 1; i < pts.length; i++) lab.rod(pts[i - 1], pts[i], .024, c.primary, 7);
      if (str.env) for (const sign of [-1, 1]) {
        const env = Array.from({ length: 101 }, (_, i) => stringPoint(i * L / 100, sign * str.env[Math.round(sim.n * i / 100)]));
        strokePath(env, alpha(c.primary, .28), .8);
      }
      for (const x of nd) lab.sphere(stringPoint(x), .045, c.danger);
      const p = stringPoint(str.probeX, sim.at(str.probeX));
      lab.sphere(p, .075, c.danger); lab.handle('probe', p); lab.label('P', [p[0], p[1] + .18, -.04], c.danger);
    }
    dashed(lab, stringPoint(0), stringPoint(L), c.text3, .8);
    const end = stringPoint(L, sim.u[sim.n], long);
    if (str.right === 'fixed') {
      lab.box(2.4, .88, -.16, .25, .54, .32, c.text3);
      for (let i = 0; i < 3; i++) lab.rod([2.42, 1.02 + i * .12, -.18], [2.61, 1.02 + i * .12, -.18], .018, c.borderStrong, 6);
    } else if (str.right === 'free') {
      if (long) {
        // A longitudinal free termination translates along x, not vertically.
        lab.rod([2.05, 1.15, 0], [3.02, 1.15, 0], .025, c.text3);
        ring(lab, end, .1, c.warning, 'x', .023);
      } else {
        lab.rod([2.46, .35, 0], [2.46, 1.96, 0], .03, c.text3);
        ring(lab, [2.46, end[1], 0], .09, c.warning, 'z', .023);
        lab.rod(end, [2.46, end[1], 0], .024, c.primary, 8);
      }
    } else {
      lab.box(2.43, .9, -.22, .3, .5, .44, c.sunken);
      for (let i = 0; i < 5; i++) lab.rod([2.45 + i * .045, 1.02, -.18], [2.45 + i * .045, 1.28, .18], .018, c.text3, 6);
      lab.label('yutuvchi uch', [2.4, .68, 0]);
    }
    if (str.src === 'hand') {
      const p = stringPoint(0, sim.u[0], long); lab.sphere(p, .1, c.warning); lab.handle('hand', p, .2);
      lab.label(long ? 'dastak ↔' : 'dastak ↕', [-2.48, 1.72, -.05], c.warning);
    }
    ruler(-2.4, 2.4, .12, -.5, L, 'm', c.text2);
    generator(-1.35, .05, -.95, [['wF', (str.f - .2) / 3.8, `ν ${fmt(str.f, 2)} Hz`, c.primary], ['wA', (str.A - 1) / 9, `A ${fmt(str.A, 1)} cm`, c.warning]]);
    if (str.src === 'harm') {
      const lam = str.v / str.f;
      if (lam < L * .94) {
        const a = stringPoint(.15), b = stringPoint(.15 + lam); a[1] = b[1] = 2.05;
        lab.line(a, b, c.special, 1.3);
        for (const p of [a, b]) lab.line([p[0], 1.98, 0], [p[0], 2.12, 0], c.special, 1.3);
        lab.label(`λ = ${fmt(lam, 2)} m`, [(a[0] + b[0]) / 2, 2.24, 0], c.special);
      }
    }
    if (harmonic) lab.label(`${harmonic.n}-garmonika`, [1.3, 2.26, 0], c.success);
  }

  let rippleField = null;
  const sampleCoefficients = (sources, x, y, k, norm) => sources.map(s => {
    const r = Math.hypot(x - s.x, y - s.y), a = norm / Math.sqrt(Math.max(r, 1.5) / 1.5), phase = k * r + (s.phase || 0);
    return { r, re: a * Math.cos(phase), im: a * Math.sin(phase) };
  });
  const coefficientHeight = (coefficients, reach, ct, st) => {
    let h = 0;
    for (const q of coefficients) if (q.r <= reach) h += q.re * ct + q.im * st;
    return h;
  };
  function buildRippleField(rip, sources) {
    const lambda = rip.v / rip.f, k = TAU / lambda, norm = rip.n === 2 ? .5 : 1;
    // Both directions exceed the spatial Nyquist limit even at the shortest
    // allowed wavelength (0.75 cm). Coefficients/topology are reused per frame.
    const nx = Math.max(80, Math.ceil(60 / lambda * 2.1 / 8) * 8), ny = Math.round(nx * 2 / 3);
    const mesh = Array.from({ length: ny + 1 }, (_, j) => Array.from({ length: nx + 1 }, (_, i) => {
      const x = -30 + 60 * i / nx, y = -20 + 40 * j / ny;
      return { p: waterPoint(x, y), h: 0, coefficients: sampleCoefficients(sources, x, y, k, norm) };
    }));
    const contours = [], d = sources.length === 2 ? Math.hypot(sources[1].x - sources[0].x, sources[1].y - sources[0].y) : 0;
    const stride = Math.max(1, Math.ceil(d / lambda / 8));
    if (d > 1e-6) {
      const ux = (sources[1].x - sources[0].x) / d, uy = (sources[1].y - sources[0].y) / d;
      const mx = (sources[0].x + sources[1].x) / 2, my = (sources[0].y + sources[1].y) / 2, max = Math.ceil(d / lambda) + 1, shift = rip.dphi / 360;
      for (let m = -max; m <= max; m++) {
        if (m % stride !== 0) continue;
        for (const offset of [0, .5]) {
          const D = (m + offset - shift) * lambda;
          if (Math.abs(D) >= d - 1e-6) continue;
          const a = D / 2, b = Math.sqrt(Math.max(0, d * d / 4 - a * a)), segments = [];
          let prev = null;
          for (let j = 0; j <= 128; j++) {
            const t = -4 + j / 16, xp = a * Math.cosh(t), yp = b * Math.sinh(t);
            const x = mx + ux * xp - uy * yp, y = my + uy * xp + ux * yp;
            const p = Math.abs(x) < 29.8 && Math.abs(y) < 19.8 ? { p: waterPoint(x, y), coefficients: sampleCoefficients(sources, x, y, k, norm) } : null;
            if (prev && p && (offset || j % 5 < 3)) segments.push([prev, p]);
            prev = p;
          }
          contours.push({ segments, minimum: !!offset });
        }
      }
    }
    return { nx, ny, mesh, contours, stride, paletteKey: null };
  }
  function drawRipple(ui, rip, sources) {
    const c = lab.colors, opts = { k: TAU * rip.f / rip.v, w: TAU * rip.f, v: rip.v, r0: 1.5, t0: rip.t0 };
    const height = (x, y) => W.rippleHeight(sources, x, y, rip.t, opts) * (rip.n === 2 ? .5 : 1);
    // Rigid tank, visible glass edges, supports and a genuinely displaced water mesh.
    lab.box(-2.06, .05, -1.41, 4.12, .13, 2.82, c.text3);
    lab.box(-2, .18, -1.35, 4, .09, 2.7, c.bg2);
    for (const x of [-2.04, 1.98]) lab.box(x, .25, -1.37, .06, .38, 2.74, alpha(c.primary, .18));
    for (const z of [-1.37, 1.31]) lab.box(-2.04, .25, z, 4.08, .38, .06, alpha(c.primary, .18));
    for (const z of [-1.37, 1.37]) lab.rod([-2.05, .64, z], [2.05, .64, z], .026, c.text3);
    for (const x of [-2.05, 2.05]) lab.rod([x, .64, -1.37], [x, .64, 1.37], .026, c.text3);
    const lambda = rip.v / rip.f;
    const key = JSON.stringify([rip.n, rip.f, rip.v, rip.dphi, sources]);
    if (rippleField?.key !== key) rippleField = { ...buildRippleField(rip, sources), key };
    const field = rippleField, reach = rip.v * (rip.t - rip.t0), ct = Math.cos(opts.w * rip.t), st = Math.sin(opts.w * rip.t);
    const paletteKey = c.primary + c.bg2;
    if (field.paletteKey !== paletteKey) {
      field.palette = Array.from({ length: 16 }, (_, i) => blend(c.primary, c.bg2, .18 + .6 * i / 15)); field.paletteKey = paletteKey;
    }
    for (const row of field.mesh) for (const q of row) {
      q.h = coefficientHeight(q.coefficients, reach, ct, st); q.p[1] = .42 + q.h * .085;
      // Adjacent quads share vertices. Project each vertex once per frame.
      q.projected = lab.project(q.p);
    }
    for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
      const a = field.mesh[j][i], b = field.mesh[j][i + 1], d = field.mesh[j + 1][i], e = field.mesh[j + 1][i + 1];
      const h = (a.h + b.h + d.h + e.h) * .25;
      lab.face([a.p, b.p, e.p, d.p], field.palette[Math.round(clamp(.5 + h * .42, 0, 1) * 15)], null, .7,
        [a.projected, b.projected, e.projected, d.projected]);
    }
    if (ui.show.lines && rip.n === 2) for (const contour of field.contours) {
      for (const segment of contour.segments) {
        for (const q of segment) q.p[1] = .42 + (coefficientHeight(q.coefficients, reach, ct, st) + .08) * .085;
        // Reject subpixel segments as the camera recedes; the physical loci do not move.
        const a = lab.project(segment[0].p), b = lab.project(segment[1].p);
        if (Math.hypot(b.x - a.x, b.y - a.y) > .65) lab.line(segment[0].p, segment[1].p, contour.minimum ? c.danger : c.success, 1.25);
      }
    }
    const probe = waterPoint(rip.probe.x, rip.probe.y, height(rip.probe.x, rip.probe.y));
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i], p = waterPoint(s.x, s.y), top = [p[0], 1.12, p[2]];
      lab.rod([p[0], 1.12, 1.38], top, .025, c.text3);
      lab.rod(top, [p[0], .49 + .035 * Math.cos(TAU * rip.f * rip.t - s.phase), p[2]], .026, c.warning);
      lab.rod([p[0], 1.12, 1.38], [p[0], .67, 1.38], .035, c.text3);
      lab.sphere([p[0], .53, p[2]], .065, c.warning); lab.handle(`s${i + 1}`, [p[0], .58, p[2]], .18);
      lab.label(`S${i + 1}`, [p[0], .85, p[2]], c.warning);
      dashed(lab, [p[0], .66, p[2]], [probe[0], .66, probe[2]], c.text2, .9);
    }
    lab.rod([probe[0], probe[1], probe[2]], [probe[0], .76, probe[2]], .022, c.danger);
    for (let j = 0; j < 2; j++) {
      const a = [probe[0], .77, probe[2]], b = [...a]; a[j * 2] -= .12; b[j * 2] += .12;
      lab.rod(a, b, .018, c.danger, 8);
    }
    lab.handle('probeR', [probe[0], .77, probe[2]], .18); lab.label('P', [probe[0], .98, probe[2]], c.danger);
    generator(2.56, .05, -.85, [['rF', (rip.f - 1) / 7, `ν ${fmt(rip.f, 1)} Hz`, c.primary], ['rP', rip.dphi / 360, `φ ${fmt(rip.dphi, 0)}°`, c.special]]);
    lab.label(`λ = ${fmt(lambda, 1)} cm`, [-.95, .22, -1.56], c.special);
    lab.line(waterPoint(-28, 19, -2.9), waterPoint(Math.min(28, -28 + lambda), 19, -2.9), c.special, 2);
  }

  function drawDoppler(dop, srcX, recv) {
    const c = lab.colors;
    lab.box(-2.6, .05, -1.22, 5.2, .16, 2.44, c.text3);
    lab.box(-2.54, .21, -1.16, 5.08, .05, 2.32, c.bg2);
    const point = (x, y) => soundPoint(x, y);
    // Rings show a horizontal cut through spherical wave fronts, not transported material.
    for (const fr of dop.fronts) {
      const r = dop.c * (dop.t - fr.te); if (r <= 0 || r > 75) continue;
      let prev = null;
      const n = 100;
      for (let j = 0; j <= n; j++) {
        const t = j * TAU / n, x = fr.xe + r * Math.cos(t), y = r * Math.sin(t);
        const p = Math.abs(x) < 24 && Math.abs(y) < 11 ? point(x, y) : null;
        if (prev && p) lab.line(prev, p, alpha(c.primary, clamp(.9 - r / 60, .15, .9)), .85);
        prev = p;
      }
    }
    // Precision rail, speaker trolley, wheels and an actual conical loudspeaker.
    for (const z of [-.14, .14]) lab.rod([-2.52, .29, z], [2.52, .29, z], .018, c.text3);
    const xs = srcX(dop.t), x = point(xs, 0)[0];
    for (const dx of [-.13, .13]) for (const z of [-.15, .15]) lab.rod([x + dx, .33, z - .025], [x + dx, .33, z + .025], .055, c.text3, 12);
    lab.box(x - .2, .36, -.18, .4, .1, .36, c.warning);
    lab.box(x - .13, .46, -.11, .18, .24, .22, c.warning);
    lab.rod([x + .05, .58, 0], [x + .18, .58, 0], .055, c.text3, 16);
    for (let j = 0; j < 20; j++) {
      const t = j * TAU / 20, a = [x + .14, .58 + .055 * Math.cos(t), .055 * Math.sin(t)], b = [x + .32, .58 + .15 * Math.cos(t), .15 * Math.sin(t)];
      const tn = (j + 1) * TAU / 20;
      lab.face([a, [x + .14, .58 + .055 * Math.cos(tn), .055 * Math.sin(tn)], [x + .32, .58 + .15 * Math.cos(tn), .15 * Math.sin(tn)], b], c.warning);
    }
    ring(lab, [x + .32, .58, 0], .15, c.text3, 'x', .017);
    lab.label(`S · u = ${fmt(dop.M * dop.c, 0)} m/s`, [x, .97, 0], c.warning);
    if (dop.M > 1) {
      const a = Math.asin(1 / dop.M), L = 60;
      for (const sign of [-1, 1]) {
        let prev = null;
        for (let i = 0; i <= 100; i++) {
          const xx = xs - L * i / 100 * Math.cos(a), yy = sign * L * i / 100 * Math.sin(a);
          const p = Math.abs(xx) <= 24 && Math.abs(yy) <= 11 ? point(xx, yy) : null;
          if (p && prev && i % 5 < 3) lab.line(prev, p, c.danger, 2); prev = p;
        }
      }
    }
    for (const [nm, obs, col] of [['A', dop.A, c.danger], ['B', dop.B, c.success]]) {
      const p = point(obs.x, obs.y);
      lab.rod([p[0], .27, p[2]], [p[0], .75, p[2]], .022, c.text3);
      lab.rod([p[0], .285, p[2]], [p[0], .295, p[2]], .115, c.text3, 20);
      lab.rod([p[0], .7, p[2]], [p[0], .84, p[2]], .06, col, 16);
      ring(lab, [p[0], .785, p[2]], .065, c.text2, 'z', .009);
      const received = recv(obs);
      lab.label(`${nm}: ${received.length ? received.map(q => `${fmt(q.f, 0)} Hz`).join(' + ') : 'jimlik'}`, [p[0], 1.05, p[2]], col);
      lab.handle(nm, [p[0], .81, p[2]], .18);
    }
    generator(0, .05, -1.66, [['dF', (dop.f - 100) / 900, `ν ${fmt(dop.f, 0)} Hz`, c.primary], ['dM', dop.M / 1.8, `M ${fmt(dop.M, 2)}`, c.warning]]);
    lab.label(`c = ${fmt(dop.c, 0)} m/s · λ₀ = ${fmt(dop.c / dop.f, 2)} m`, [-1.2, .27, 1.3], c.text2);
  }

  function draw(ctx, stage, ui, str, sim, rip, dop, details) {
    lab.begin(ctx, stage, { target: ui.mode === 'string' ? [0, 1, 0] : [0, .5, .1], focal: 1.58 });
    if (ui.mode === 'string') drawString(str, sim, details.nodes, details.harmonic);
    else if (ui.mode === 'ripple') drawRipple(ui, rip, details.sources);
    else drawDoppler(dop, details.srcX, details.recv);
    lab.finish(ui.mode === 'string' ? sim.t : ui.mode === 'ripple' ? rip.t : dop.t,
      ui.mode === 'string' ? 'Siljish x ga nisbatan ×3,75 · uzunlik 4 m' :
        ui.mode === 'ripple' ? (ui.show.lines && rippleField?.stride > 1 ? 'Chiziqlar siyraklashtirilgan · balandlik kuchaytirilgan' : stage.w < 500 ? 'Balandlik kuchaytirilgan · max/min: yashil/qizil' : 'Suv balandligi kuchaytirilgan · yashil: maksimum, qizil: minimum') :
          (stage.w < 500 ? 'Sferik front kesimi · vaqt sekinlashtirilgan' : 'Frontlar — sferik to‘lqinning gorizontal kesimi · vaqt sekinlashtirilgan'));
  }

  // Invert a horizontal plane using the public camera projection. This remains
  // valid after a complete orbit and does not depend on the initial screen view.
  function horizontalPoint(x, y, height) {
    const sp = Math.sin(lab.camera.pitch);
    const center = lab.project([0, height, 0]), px = lab.project([1, height, 0]), pz = lab.project([0, height, 1]);
    const rhsX = x - center.x, rhsY = y - center.y;
    // Projective plane homography solved with two rays, obtained without duplicating focal/target state.
    const ax = px.d * (px.x - x) - center.d * (center.x - x), az = pz.d * (pz.x - x) - center.d * (center.x - x);
    const bx = px.d * (px.y - y) - center.d * (center.y - y), bz = pz.d * (pz.y - y) - center.d * (center.y - y);
    const rx = center.d * rhsX, ry = center.d * rhsY, det = ax * bz - az * bx;
    if (Math.abs(det) < 1e-6 || Math.abs(sp) < .025) return null;
    return [(rx * bz - az * ry) / det, height, (ax * ry - rx * bx) / det];
  }
  return { lab, draw, horizontalPoint,
    stringX(x, y, str, sim) { return lab.nearest(t => stringPoint(t, sim.at(t), str.wave === 'long'), .05, sim.L - .05, x, y); },
    hand(x, y, long) { return lab.nearest(u => stringPoint(0, u, long), -.15, .15, x, y); },
  };
}
