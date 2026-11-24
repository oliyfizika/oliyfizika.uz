// Butun olam tortishish qonuni — 360° 3D laboratoriya sahnasi (simulations/gravity-law.html).
// Ikki jism stol ustidagi shtativlarda; markazlari bitta gorizontal tekislikda yotadi va jismni shu
// tekislikning istalgan nuqtasiga sudrash mumkin (2D dagi kabi). Holat va fizika gravity.js da, metrda.
import { createLab3D } from './lab-3d.js?v=20261123-cg';
import { alpha, dashed } from './apparatus-3d.js?v=20261123-cg';
import { clamp } from './sim-kit.js';

export const GRAVITY_SPAN = 4.2;                    // r_max sahnada shuncha birlik
export const GRAVITY_BOUNDS = { x: 2.55, z: 1.3 };  // jism markazlari chegarasi (sahna birligi)
export const PLANE_Y = .86;                         // markazlar tekisligining stoldan balandligi

/** Jismning sahnadagi radiusi: laboratoriyada haqiqiy (masshtabda), osmon jismlarida shartli. */
export function sceneRadius(space, body, R, S) {
  if (!space) return Math.max(.03, R * S);
  return body.station ? .12 : body.px / 90;
}

export function createGravityLab() {
  const lab = createLab3D();
  let S = 1;
  // Model (metr): x o'ngga, y ekranda pastga (2D dagi kabi) → sahnada −z (kuzatuvchi tomon).
  const at = (p, y = PLANE_Y) => [p.x * S, y, -p.y * S];
  /**
   * Ekran nuqtasi → markazlar tekisligidagi model nuqtasi (metr); proyektiv teskari almashtirish.
   * Nuqta kamera ortida yoki ufqdan narida bo'lsa — null (sudrash bu harakatni e'tiborsiz qoldiradi).
   */
  function modelPoint(p) {
    const o = [0, PLANE_Y, 0], a = lab.project(o), b = lab.project([S, PLANE_Y, 0]), c = lab.project([0, PLANE_Y, -S]);
    const ax = b.d * (b.x - p.x) - a.d * (a.x - p.x), ay = c.d * (c.x - p.x) - a.d * (a.x - p.x);
    const bx = b.d * (b.y - p.y) - a.d * (a.y - p.y), by = c.d * (c.y - p.y) - a.d * (a.y - p.y), det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-6) return null; // tekislik qirrasi bilan ko'rinmoqda
    const rx = a.d * (p.x - a.x), ry = a.d * (p.y - a.y), x = (rx * by - ay * ry) / det, y = (ax * ry - rx * bx) / det;
    const depth = a.d + x * (b.d - a.d) + y * (c.d - a.d);
    return depth > .5 && depth < 30 ? { x, y } : null;
  }
  function station(p, c) { // XKS: korpus va ikki juft quyosh paneli
    lab.box(p[0] - .09, p[1] - .04, p[2] - .05, .18, .08, .1, c.text2);
    lab.rod([p[0] - .24, p[1], p[2]], [p[0] + .24, p[1], p[2]], .012, c.text3, 8);
    for (const s of [-1, 1]) lab.box(p[0] + s * .2 - .07, p[1] - .006, p[2] - .15, .14, .012, .3, c.primary);
  }
  /**
   * cfg: { space, rMax, p1, p2 (metr), rad1, rad2 (sahna birligi), b1, b2, m1, m2, F, Fmin, Fmax, rLabel, label1, label2 }
   * show: { forces, field }
   */
  function draw(ctx, stage, cfg, show) {
    S = GRAVITY_SPAN / cfg.rMax;
    lab.begin(ctx, stage, { target: [0, .6, 0], focal: 2.1 });
    const c = lab.colors, space = cfg.space;
    const B = [
      { p: at(cfg.p1), rad: cfg.rad1, b: cfg.b1, m: cfg.m1, name: cfg.label1 },
      { p: at(cfg.p2), rad: cfg.rad2, b: cfg.b2, m: cfg.m2, name: cfg.label2 },
    ];
    // Shtativlar va jismlar: asos stolda, sterjen jism ostigacha
    B.forEach((o, i) => {
      const [x, y, z] = o.p;
      lab.rod([x, .004, z], [x, .05, z], .15, c.text2, 20);
      lab.rod([x, .05, z], [x, y - (o.b.station ? .04 : o.rad * .92), z], .02, c.borderStrong, 10);
      if (o.b.station) station(o.p, c);
      else {
        lab.sphere(o.p, o.rad, space ? o.b.color : c.text3);
        if (space && o.b.name === 'Quyosh') lab.sphere(o.p, o.rad * 1.28, alpha(o.b.color2 || o.b.color, .2));
      }
      lab.handle(i ? 'p2' : 'p1', o.p, Math.max(o.rad, .16));
    });

    // Gravitatsion maydon tekislikda: g = Σ G·m/d² (markazga). Uzunlik va shaffoflik — log|g| bo'yicha.
    if (show.field) {
      const pts = [];
      let lmin = Infinity, lmax = -Infinity;
      for (let x = -2.4; x <= 2.41; x += .4) for (let z = -1.2; z <= 1.21; z += .4) {
        let gx = 0, gz = 0, skip = false;
        for (const o of B) {
          const dx = o.p[0] - x, dz = o.p[2] - z, dd = Math.hypot(dx, dz);
          if (dd < o.rad + .17) { skip = true; break; }
          const dm = dd / S, gm = o.m / (dm * dm);
          gx += (gm * dx) / dd; gz += (gm * dz) / dd;
        }
        const mag = Math.hypot(gx, gz);
        if (skip || !(mag > 0)) continue;
        const lg = Math.log10(mag);
        lmin = Math.min(lmin, lg); lmax = Math.max(lmax, lg);
        pts.push([x, z, gx / mag, gz / mag, lg]);
      }
      for (const [x, z, ux, uz, lg] of pts) {
        const t = lmax > lmin ? (lg - lmin) / (lmax - lmin) : .5, L = .1 + .17 * t;
        lab.vector([x - (ux * L) / 2, PLANE_Y, z - (uz * L) / 2], [ux * L, 0, uz * L], alpha(c.primary, .22 + .6 * t), '');
      }
    }

    // Masofa: markazlarni tutashtiruvchi shtrix va doim ko'rinadigan r yorlig'i
    const d = B[1].p.map((v, i) => v - B[0].p[i]), len = Math.hypot(...d) || 1, u = d.map((v) => v / len);
    const gap = len - B[0].rad - B[1].rad, mid = B[0].p.map((v, i) => (v + B[1].p[i]) / 2);
    dashed(lab, B[0].p, B[1].p, c.text2, 1.25);
    lab.label(cfg.rLabel, [mid[0], PLANE_Y + .3, mid[2]], c.text);

    // Kuchlar — markazlarni tutashtiruvchi chiziq bo'ylab bir-biriga qarab, teng uzunlikda
    if (show.forces && cfg.F > 0) {
      const fromCenter = gap < .32, room = fromCenter ? len / 2 - .03 : gap / 2 - .05;
      const t = clamp((Math.log10(cfg.F) - Math.log10(cfg.Fmin)) / (Math.log10(cfg.Fmax) - Math.log10(cfg.Fmin)), 0, 1);
      const L = Math.max(fromCenter ? .09 : .045, Math.min(.16 + .95 * t, room));
      const a1 = B[0].p.map((v, i) => v + u[i] * (fromCenter ? 0 : B[0].rad));
      const a2 = B[1].p.map((v, i) => v - u[i] * (fromCenter ? 0 : B[1].rad));
      lab.vector(a1, u.map((v) => v * L), c.warning, '');
      lab.vector(a2, u.map((v) => -v * L), c.warning, '');
      lab.label('F₂₁', a1.map((v, i) => v + (u[i] * L) / 2 + (i === 1 ? -.13 : 0)), c.warning);
      lab.label('F₁₂', a2.map((v, i) => v - (u[i] * L) / 2 + (i === 1 ? -.13 : 0)), c.warning);
    }
    // Nomlar — jismlarning tashqi tomonida (bir-biridan uzoqroqda), biroz yuqorida
    B.forEach((o, i) => {
      const s = i ? 1 : -1, rr = o.b.station ? .2 : o.rad;
      lab.label(o.name, [o.p[0] + s * u[0] * (rr + .3), o.p[1] + rr + .12, o.p[2] + s * u[2] * (rr + .3)], c.text);
    });
    lab.finish(0, space ? 'Osmon jismlarining stol ustidagi modeli · o‘lchamlar shartli, r — haqiqiy masofa' : 'Po‘lat sharlar masshtabda · maydon va kuch vektorlari shartli');
  }
  return { lab, draw, modelPoint };
}
