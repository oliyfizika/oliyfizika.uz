// Kulon qonuni va elektr maydon — 360° 3D laboratoriya sahnasi (simulations/coulomb-law.html).
// 1) Kulon qonuni: shtativ, ipak ipga osilgan sharcha, transportir, chizg'ich va organik shisha stend (x–y tekisligi).
// 2) Superpozitsiya: stol ustidagi kyuveta — zaryadlar, sinov zaryadi, kuch chiziqlari va yorma moy sathida (gorizontal).
// 3) Zaryadlangan shar: Van de Graaf generatori, izolyator dastali zond, yerga ulangan sharcha va uchqun (x–y tekisligi).
// Holat va fizika coulomb.js / coulomb-physics.js da (mm, nC). Bu modul faqat tasvir va sudrash geometriyasi.
import { createLab3D } from './lab-3d.js?v=20261123-cg';
import { alpha, dashed } from './apparatus-3d.js?v=20261123-cg';
import { clamp } from './sim-kit.js';

const TAU = Math.PI * 2;
export const PART = ['#0891b2', '#9333ea', '#16a34a', '#e11d48', '#ca8a04'];
const SUB = '₁₂₃₄₅';
// Har tajribaning mm → sahna birligi masshtabi va joylashuvi
const LAW = { k: .0155, x0: 170 };                   // x–y tekislik; stol — 2D dagi TABLE
const SUP = { k: .0145, x0: 180, y0: 106, h: .12 };  // kyuveta; h — moy sathi (zaryadlar tekisligi)
const SPH = { k: .0115, x0: 240 };                   // x–y tekislik; stol — 2D dagi TABLE3
const VIEW = {
  law: { begin: { target: [0, 1.5, 0], focal: 1.75 }, camera: { yaw: -.5, pitch: .35, zoom: 1 } },
  sup: { begin: { target: [0, .15, 0], focal: 1.95 }, camera: { yaw: -.35, pitch: .85, zoom: 1 } },
  sph: { begin: { target: [0, 1.45, 0], focal: 1.7 }, camera: { yaw: -.5, pitch: .3, zoom: 1 } },
};
const seeded = (n) => { let a = n; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };

export function createCoulombLab() {
  const lab = createLab3D();
  let mode = 'law', geom = {};
  lab.reset = () => Object.assign(lab.camera, VIEW[mode].camera);
  const qColor = (c, q) => (q > 0 ? c.danger : q < 0 ? c.primary : c.text3);

  /* ------------------------------------------------ mm → sahna */
  const L = (x, y, z = 0) => [(x - LAW.x0) * LAW.k, (geom.TABLE - y) * LAW.k, z];
  const T = (x, y, h = SUP.h) => [(x - SUP.x0) * SUP.k, h, (SUP.y0 - y) * SUP.k];
  const S = (x, y, z = 0) => [(x - SPH.x0) * SPH.k, (geom.TABLE3 - y) * SPH.k, z];
  /**
   * Ekran nuqtasi → origin + s·u + t·v tekislikdagi (s, t); proyektiv teskari almashtirish.
   * Nuqta kamera ortida yoki ufqdan narida bo'lsa (tekislik qirrasidan ko'rinadi) — null.
   */
  function inverse(p, o, u, v) {
    const a = lab.project(o), b = lab.project(o.map((x, i) => x + u[i])), c = lab.project(o.map((x, i) => x + v[i]));
    const ax = b.d * (b.x - p.x) - a.d * (a.x - p.x), ay = c.d * (c.x - p.x) - a.d * (a.x - p.x);
    const bx = b.d * (b.y - p.y) - a.d * (a.y - p.y), by = c.d * (c.y - p.y) - a.d * (a.y - p.y), det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-6) return null;
    const rx = a.d * (p.x - a.x), ry = a.d * (p.y - a.y), s = (rx * by - ay * ry) / det, t = (ax * ry - rx * bx) / det;
    const depth = a.d + s * (b.d - a.d) + t * (c.d - a.d);
    return depth > .5 && depth < 30 ? { s, t } : null;
  }

  /* ------------------------------------------------ Yordamchi shakllar */
  /** Sfera bo'lagi: j0..j1 — azimut (π/12 qadam), z ≥ 0 yarmi uchun 0..12. */
  function sphereBand(p, r, color, j0 = 0, j1 = 24) {
    const at = (i, j) => [p[0] + r * Math.sin((i * Math.PI) / 12) * Math.cos((j * Math.PI) / 12), p[1] + r * Math.cos((i * Math.PI) / 12), p[2] + r * Math.sin((i * Math.PI) / 12) * Math.sin((j * Math.PI) / 12)];
    for (let i = 0; i < 12; i++) for (let j = j0; j < j1; j++) lab.face([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], color);
  }
  /** Zaryad belgisi (+ yoki −) x–y tekisligida, markazi p, yarim uzunligi h. */
  function glyph(p, sign, h, c) {
    if (!sign) return;
    const col = sign > 0 ? c.danger : c.primary;
    lab.line([p[0] - h, p[1], p[2]], [p[0] + h, p[1], p[2]], col, 2.2);
    if (sign > 0) lab.line([p[0], p[1] - h, p[2]], [p[0], p[1] + h, p[2]], col, 2.2);
  }
  /** Gorizontal tekislikdagi yassi strelka uchi (kuch chizig'i yo'nalishi). */
  function flatHead(p, ux, uz, size, color) {
    const nx = -uz, nz = ux;
    lab.face([[p[0] + ux * size, p[1], p[2] + uz * size], [p[0] - ux * size * .8 + nx * size * .72, p[1], p[2] - uz * size * .8 + nz * size * .72],
      [p[0] - ux * size * .8 - nx * size * .72, p[1], p[2] - uz * size * .8 - nz * size * .72]], color);
  }
  /** Konus strelka uchi: asos markazi b, uchi e. */
  function cone(b, e, r, color) {
    const d = e.map((v, i) => v - b[i]), len = Math.hypot(...d);
    if (len < 1e-6) return;
    const u = d.map((v) => v / len), q = Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    let a = [u[1] * q[2] - u[2] * q[1], u[2] * q[0] - u[0] * q[2], u[0] * q[1] - u[1] * q[0]];
    const al = Math.hypot(...a); a = a.map((v) => v / al);
    const w = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
    const ring = (t) => b.map((v, i) => v + r * (a[i] * Math.cos(t) + w[i] * Math.sin(t)));
    for (let i = 0; i < 10; i++) lab.face([ring((i * TAU) / 10), ring(((i + 1) * TAU) / 10), e], color);
  }

  /* ================================================ 1) Kulon qonuni */
  function lawScene(f, c) {
    const { PX, PY, LEN, RB, RULER0, TABLE } = geom, k = LAW.k;
    const steel = c.text3, dark = c.dark ? '#334155' : '#475569', darker = c.dark ? '#1e293b' : '#334155';
    // shtativ: asos, sterjen, mufta, lapka va osilish nuqtasi
    lab.box(L(2, 0)[0], 0, -.36, 64 * k, 7 * k, .72, dark);
    lab.rod(L(14, TABLE - 7), L(14, 2), 3 * k, steel, 14);
    lab.box(L(7, 0)[0], L(0, 15)[1], -.11, 14 * k, 12 * k, .22, darker);
    lab.rod(L(20, 8), L(PX, 8), 2 * k, steel, 10);
    lab.sphere(L(PX, PY - 2), 3 * k, darker);

    // transportir (shaffof plastik), markazi osilish nuqtasida — ip tekisligining orqasida
    const pr = 58, zp = .04, glassFill = alpha(c.dark ? '#7dd3fc' : '#0ea5e9', c.dark ? .1 : .08), glassEdge = alpha(c.dark ? '#7dd3fc' : '#0ea5e9', .6);
    const arc = [];
    for (let i = 0; i <= 36; i++) { const t = (Math.PI * i) / 36; arc.push(L(PX + Math.cos(t) * pr, PY + Math.sin(t) * pr, zp)); }
    lab.face([L(PX, PY, zp), ...arc], glassFill, glassEdge, 1);
    for (let d = -60; d <= 60; d += 5) {
      const t = Math.PI / 2 - (d * Math.PI) / 180, l = d % 10 === 0 ? 7 : 4.5;
      lab.line(L(PX + Math.cos(t) * pr, PY + Math.sin(t) * pr, zp - .003), L(PX + Math.cos(t) * (pr - l), PY + Math.sin(t) * (pr - l), zp - .003), c.text3, d % 10 === 0 ? 1 : .6);
      if (d % 20 === 0 && d) lab.label(String(Math.abs(d)), L(PX + Math.cos(t) * (pr - 14), PY + Math.sin(t) * (pr - 14), zp), c.text3);
    }

    // chizg'ich (yog'och, mm bo'linmalar) stol ustida, stendlar oldida
    const r1 = 336, zb = -.16, zf = -.38, yr = .012, wood = c.dark ? '#a16207' : '#facc15', ink = c.dark ? '#fde68a' : '#713f12';
    lab.box(L(RULER0 - 4, 0)[0], 0, zf, (r1 - RULER0 + 6) * k, yr, zb - zf, wood);
    for (let mm = 0; mm <= r1 - RULER0; mm += 5) {
      const x = L(RULER0 + mm, 0)[0], major = mm % 10 === 0;
      lab.line([x, yr + .001, zb], [x, yr + .001, zb - (major ? .075 : .045)], ink, major ? 1 : .6);
      if (mm % 40 === 0) lab.label(String(mm / 10), [x, yr, zb - .14], ink);
    }

    // stenddagi sharcha: organik shisha sterjen va asos (sudrab suriladi), chizg'ichdagi ko'rsatkich
    const fx = f.fixed, bx = f.bob, R = RB * k;
    lab.box(L(fx.x - 16, 0)[0], 0, -.12, 32 * k, 8 * k, .24, dark);
    lab.rod(L(fx.x, TABLE - 8), L(fx.x, fx.y + RB - 1), 2 * k, alpha(c.dark ? '#bae6fd' : '#7dd3fc', c.dark ? .4 : .55), 10);
    const xf = L(fx.x, 0)[0];
    lab.face([[xf, yr + .002, zb - .05], [xf - 3.2 * k, yr + .002, zb + .004], [xf + 3.2 * k, yr + .002, zb + .004]], c.warning);
    lab.sphere(L(fx.x, fx.y), R, qColor(c, f.q2));
    // osma sharcha: ip va sharcha; vertikal shtrix — ipning muvozanatdagi holati
    dashed(lab, L(PX, PY), L(PX, PY + LEN + RB + 6), alpha(c.text3, .6), 1);
    lab.line(L(PX, PY - 2), L(bx.x, bx.y), c.dark ? '#e2e8f0' : '#334155', 1.1);
    lab.sphere(L(bx.x, bx.y), R, qColor(c, f.q1));
    // Kulon usuli: neytral sharcha izolyator dastada tegiziladi
    if (f.halveT > 0) {
      const kk = Math.sin(Math.min(1, f.halveT / 1.2) * Math.PI), hx = fx.x + 2 * RB + 30 * (1 - kk), hy = fx.y - 2;
      lab.rod(L(hx + RB * .7, hy - RB * .7), L(hx + 40, hy - 34), 1.5 * k, darker, 8);
      lab.sphere(L(hx, hy), R, qColor(c, f.q2));
    }
    // og'ish burchagi yoyi
    if (Math.abs(f.a) > .4 * Math.PI / 180) {
      let prev = null;
      for (let i = 0; i <= 24; i++) {
        const t = Math.PI / 2 - (f.a * i) / 24, p = L(PX + Math.cos(t) * 34, PY + Math.sin(t) * 34, -.01);
        if (prev) lab.line(prev, p, c.warning, 1.7);
        prev = p;
      }
    }
    // kuchlar (2D dagi masshtab: 55 mm = mg), mm → sahna
    if (f.forces) {
      const o = L(bx.x, bx.y, -.015), v = (x, y) => [x * k, -y * k, 0];
      lab.vector(o, v(0, f.forces.mg), c.success, 'mg');
      if (f.forces.T) lab.vector(o, v(f.forces.T.x, f.forces.T.y), c.text2, 'T');
      if (f.forces.F) lab.vector(o, v(f.forces.F.x, f.forces.F.y), c.warning, 'F');
    }
    // yorliqlar
    lab.label(f.q1Text, L(bx.x - 20, bx.y + RB + 16), qColor(c, f.q1));
    lab.label(f.q2Text, L(fx.x + 22, fx.y - RB - 16), qColor(c, f.q2));
    lab.label(f.aText, L(PX + 24, PY + 46, -.01), c.warning);
    if (f.shared) lab.label(f.sharedText, L((bx.x + fx.x) / 2, fx.y - 36), c.danger);
    if (f.names) {
      lab.label('shtativ', L(24, 110)); lab.label('ipak ip', L(PX + 14, PY + 96)); lab.label('transportir', L(PX - 60, PY + 26, zp));
      lab.label('organik shisha stend', L(fx.x + 30, fx.y + 26)); lab.label('chizg‘ich, cm', [L(RULER0 + 20, 0)[0], yr, zf - .1]);
    }
    lab.handle('bob', L(bx.x, bx.y), .12);
    lab.handle('standBall', L(fx.x, fx.y), .12);
    lab.handle('stand', L(fx.x, TABLE - 4), .16);
  }

  /* ================================================ 2) Superpozitsiya (kyuveta) */
  function supScene(f, c) {
    const { TRAY, RC, RP } = geom, k = SUP.k, H = SUP.h;
    const [x0, , zFront] = T(TRAY.x0, TRAY.y1, 0), [x1, , zBack] = T(TRAY.x1, TRAY.y0, 0);
    const glass = alpha(c.dark ? '#bae6fd' : '#7dd3fc', c.dark ? .16 : .22), wall = .2, th = .025;
    // shisha tub, millimetrli qog'oz (1 cm to'r) va devorlar
    lab.box(x0, 0, zFront, x1 - x0, .018, zBack - zFront, glass);
    for (let x = 10; x < TRAY.x1; x += 10) if (x > TRAY.x0) lab.line(T(x, TRAY.y0, .02), T(x, TRAY.y1, .02), c.grid, .7);
    for (let y = 10; y < TRAY.y1; y += 10) if (y > TRAY.y0) lab.line(T(TRAY.x0, y, .02), T(TRAY.x1, y, .02), c.grid, .7);
    lab.box(x0, 0, zFront, x1 - x0, wall, th, glass);
    lab.box(x0, 0, zBack - th, x1 - x0, wall, th, glass);
    lab.box(x0, 0, zFront, th, wall, zBack - zFront, glass);
    lab.box(x1 - th, 0, zFront, th, wall, zBack - zFront, glass);
    if (f.oil) lab.face([[x0 + th, H - .006, zFront + th], [x1 - th, H - .006, zFront + th], [x1 - th, H - .006, zBack - th], [x0 + th, H - .006, zBack - th]], alpha('#facc15', c.dark ? .13 : .2));
    if (f.eps > 1) lab.label(f.medText, T(TRAY.x0 + 62, TRAY.y0 + 12, H + .02), c.text2);

    // yorma donalari: moyda maydon bo'ylab tiziladi
    if (f.grains) {
      const col = c.dark ? '#e7d3a1' : '#a16207';
      for (const g of f.grains) {
        if (f.charges.some((q) => Math.hypot(q.x - g.x, q.y - g.y) < RC + 1.5)) continue;
        const l = 2.1 * g.l, dx = Math.cos(g.a) * l, dy = Math.sin(g.a) * l;
        lab.line(T(g.x - dx, g.y - dy, H + .002), T(g.x + dx, g.y + dy, H + .002), alpha(col, Math.round((.45 + .5 * g.k) * 10) / 10), 1.3);
      }
    }
    // kuch chiziqlari (kyuveta ichida qirqiladi) va yo'nalish strelkalari
    if (f.lines) {
      const col = alpha(c.text2, c.dark ? .6 : .55), inside = (x, y) => x >= TRAY.x0 && x <= TRAY.x1 && y >= TRAY.y0 && y <= TRAY.y1;
      for (const ln of f.lines) {
        let prev = null;
        for (let i = 0; i < ln.pts.length; i += 3) {
          const [x, y] = ln.pts[i], p = inside(x, y) ? T(x, y, H + .004) : null;
          if (p && prev) lab.line(prev, p, col, 1.2);
          prev = p;
        }
        const i = Math.min(ln.pts.length - 2, 30);
        if (i < 3) continue;
        const [ax, ay] = ln.pts[i], [bx, by] = ln.pts[i + 1];
        if (!inside(ax, ay)) continue;
        const dl = Math.hypot(bx - ax, by - ay) || 1, ux = ((bx - ax) / dl) * ln.dir, uz = (-(by - ay) / dl) * ln.dir;
        flatHead(T(ax, ay, H + .005), ux, uz, 4.6 * k, alpha(c.text2, c.dark ? .85 : .75));
      }
    }

    // elektrodlar: zaryadli metall sharchalar (moy sathida)
    f.charges.forEach((q, i) => {
      const p = T(q.x, q.y), r = RC * k, col = qColor(c, q.q);
      lab.sphere(p, r, col);
      if (i === f.sel) {
        const rr = (RC + 6) * k;
        for (let j = 0; j < 24; j += 2) lab.line([p[0] + rr * Math.cos((j * TAU) / 24), H + .003, p[2] + rr * Math.sin((j * TAU) / 24)], [p[0] + rr * Math.cos(((j + 1) * TAU) / 24), H + .003, p[2] + rr * Math.sin(((j + 1) * TAU) / 24)], c.primary, 2);
      }
      lab.label(`q${SUB[i]} = ${f.qText(q.q)}`, [p[0], H + .02, p[2] + r + .2], col);
      lab.handle(`q${i}`, p, .14);
    });

    // sinov zaryadi q₀ (izolyator dastada) va undagi maydon vektorlari
    const pp = T(f.probe.x, f.probe.y);
    lab.rod([pp[0], H + .03, pp[2]], [pp[0], H + .62, pp[2]], .011, c.dark ? '#64748b' : '#1f2937', 6);
    lab.rod([pp[0], H + .62, pp[2]], [pp[0], H + .8, pp[2]], .034, alpha(c.dark ? '#fdba74' : '#fb923c', .85), 10);
    lab.sphere(pp, Math.max(RP * k, .042), c.dark ? '#facc15' : '#eab308');
    if (f.E) {
      const parts = f.E.parts, maxE = Math.max(f.E.e, ...parts.map((q) => q.e)), s = .95 / maxE;
      const o = [pp[0], H + .03, pp[2]], v = (ex, ey) => [ex * s, 0, -ey * s];
      if (f.showParts && parts.length > 1) {
        let cur = o;
        parts.forEach((q, j) => {
          const nx = cur.map((a, i) => a + v(q.ex, q.ey)[i]);
          if (j) dashed(lab, cur, nx, alpha(PART[q.i % PART.length], .75), 1.3);
          cur = nx;
        });
        parts.forEach((q) => lab.vector(o, v(q.ex, q.ey), PART[q.i % PART.length], `E${SUB[q.i]}`));
      }
      lab.vector(o, v(f.E.ex, f.E.ey), c.warning, 'E');
    }
    lab.label('q₀', [pp[0] + .14, H + .02, pp[2] - .14], c.text2);
    lab.handle('probe', pp, .12);
  }

  /* ================================================ 3) Zaryadlangan shar (Van de Graaf) */
  function sphScene(f, c) {
    const { CX, CY, DX, DR, STAND_TOP, TABLE3 } = geom, k = SPH.k, Rmm = f.R * 10, R = Rmm * k, ctr = S(CX, CY), Q = f.Q;
    const metal = c.text3, dark = c.dark ? '#334155' : '#475569', ins = c.dark ? '#64748b' : '#1f2937';
    // izolyator kolonna (shaffof), ichida harakatlanuvchi tasma; generator asosi
    const colTop = CY + Rmm - 4;
    if (STAND_TOP > colTop) {
      lab.rod(S(CX, STAND_TOP), S(CX, colTop), 13 * k, alpha(c.dark ? '#bae6fd' : '#7dd3fc', c.dark ? .2 : .3), 16);
      const beltCol = c.dark ? '#a8a29e' : '#78716c', ph = ((f.belt % 10) + 10) % 10;
      for (const sgn of [-1, 1]) for (let y = colTop - 10; y < STAND_TOP; y += 10) {
        const a = y + (sgn < 0 ? 10 - ph : ph), ya = clamp(a, colTop, STAND_TOP), yb = clamp(a + 6, colTop, STAND_TOP);
        if (yb - ya > .5) lab.line(S(CX + sgn * 6, ya), S(CX + sgn * 6, yb), beltCol, 2);
      }
    }
    lab.box(S(CX - 52, 0)[0], 0, -.3, 104 * k, (TABLE3 - STAND_TOP) * k, .6, dark);
    lab.rod(S(CX + 34, STAND_TOP + 13, -.3), S(CX + 34, STAND_TOP + 13, -.36), 6 * k, c.dark ? '#1e293b' : '#334155', 14);

    // radial kuch chiziqlari (3D yo'nalishlar) va konus strelkalar
    if (f.lines && Q) {
      const n = Math.round(1.5 * clamp(8 + (16 * Math.abs(Q)) / 3000, 8, 24)), sign = Math.sign(Q), col = alpha(c.text2, c.dark ? .5 : .45), r1 = Rmm + 130;
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + .5)) / n, rr = Math.sqrt(1 - y * y), ph = i * 2.399963;
        const u = [Math.cos(ph) * rr, y, Math.sin(ph) * rr], at = (m) => ctr.map((v, j) => v + u[j] * m * k);
        lab.line(at(Rmm + 2), at(r1), col, 1.1);
        const m = Rmm + 26;
        cone(at(m - (sign > 0 ? 3 : -3)), at(m + (sign > 0 ? 5 : -5)), 3.2 * k, col);
      }
    }
    // shar: metall (kesimda old yarmi olib tashlangan) yoki tekis zaryadlangan dielektrik
    if (f.type === 'shell') {
      if (f.cut) { // tashqi sirt, ichki sirt (to'qroq — ichi bo'sh) va kesim qirrasi
        const t = 3 * k;
        sphereBand(ctr, R, metal, 0, 12);
        sphereBand(ctr, R - t, c.dark ? '#334155' : '#64748b', 0, 12);
        for (let i = 0; i < 48; i++) {
          const a0 = (i * TAU) / 48, a1 = ((i + 1) * TAU) / 48, P = (a, rr) => [ctr[0] + rr * Math.cos(a), ctr[1] + rr * Math.sin(a), ctr[2] - .002];
          lab.face([P(a0, R), P(a1, R), P(a1, R - t), P(a0, R - t)], c.dark ? '#e2e8f0' : '#f1f5f9');
        }
        lab.label('E = 0', [ctr[0] + R * .42, ctr[1] - R * .12, ctr[2] + R * .35], c.success);
      } else sphereBand(ctr, R, metal);
    } else {
      const yel = c.dark ? '#a16207' : '#facc15';
      if (f.cut) {
        sphereBand(ctr, R, alpha(yel, .78), 0, 12);
        const disk = [];
        for (let i = 0; i < 48; i++) disk.push([ctr[0] + R * Math.cos((i * TAU) / 48), ctr[1] + R * Math.sin((i * TAU) / 48), ctr[2] - .002]);
        lab.face(disk, alpha(c.dark ? '#fef9c3' : '#fde68a', .55), alpha(yel, .9), 1);
        if (f.lines && Q) { // ichida E ∝ r: markazdan chiqqan qisqa radial shtrixlar
          const n = Math.round(clamp(8 + (16 * Math.abs(Q)) / 3000, 8, 24));
          for (let i = 0; i < n; i++) { const a = (TAU * (i + .5)) / n; dashed(lab, [ctr[0] + Math.cos(a) * R * .15, ctr[1] + Math.sin(a) * R * .15, ctr[2] - .006], [ctr[0] + Math.cos(a) * R, ctr[1] + Math.sin(a) * R, ctr[2] - .006], alpha(c.text2, .5), 1); }
        }
      } else sphereBand(ctr, R, alpha(yel, .55));
    }
    // zaryad belgilari: o'tkazgichda — sirtda, dielektrikda — hajmda
    if (Q) {
      const n = Math.round(clamp((Math.abs(Q) / 3000) * 26, 3, 26)), sg = Math.sign(Q), h = 4.6 * k;
      if (f.type === 'shell') {
        if (f.cut) for (let i = 0; i < n; i++) { const a = (TAU * i) / n + Math.PI / 2; glyph([ctr[0] + Math.cos(a) * (R - 6 * k), ctr[1] + Math.sin(a) * (R - 6 * k), ctr[2] - .006], sg, h, c); }
        else for (let i = 0; i < 2 * n; i++) {
          const y = 1 - (2 * (i + .5)) / (2 * n), rr = Math.sqrt(1 - y * y), ph = i * 2.399963, m = R + 1.5 * k;
          glyph([ctr[0] + Math.cos(ph) * rr * m, ctr[1] + y * m, ctr[2] + Math.sin(ph) * rr * m], sg, h, c);
        }
      } else {
        const rnd = seeded(11);
        for (let i = 0; i < n; i++) {
          const rr = Math.sqrt(rnd()) * (R - 6 * k), a = rnd() * TAU, z = f.cut ? -.006 : (rnd() - .5) * 1.2 * Math.sqrt(Math.max(0, (R - 6 * k) ** 2 - rr * rr));
          glyph([ctr[0] + Math.cos(a) * rr, ctr[1] + Math.sin(a) * rr, ctr[2] + z], sg, h, c);
        }
      }
    }
    // radius va markaz (kesimda yoki shaffof sharda ko'rinadi)
    if (f.cut || f.type !== 'shell') {
      lab.line([ctr[0], ctr[1], ctr[2] - .008], [ctr[0] - R * .7071, ctr[1] + R * .7071, ctr[2] - .008], c.text2, 1);
      lab.sphere([ctr[0], ctr[1], ctr[2] - .008], 1.6 * k, c.text2);
    }
    lab.label(f.RText, S(CX - Rmm * .36 - 16, CY - Rmm * .36 - 14), c.text);
    lab.label(f.QText, S(CX, CY - Rmm - 16), qColor(c, Q));

    // yerga ulangan razryadlovchi sharcha
    lab.rod(S(DX, TABLE3 - 10), S(DX, CY + DR * .9), 1.5 * k, c.dark ? '#94a3b8' : '#64748b', 8);
    for (const [hw, dy] of [[12, 0], [8, 4], [4, 8]]) lab.line(S(DX - hw, TABLE3 - 10 + dy), S(DX + hw, TABLE3 - 10 + dy), c.dark ? '#94a3b8' : '#64748b', 1.6);
    lab.sphere(S(DX, CY), DR * k, metal);
    // uchqun
    if (f.spark > 0) {
      const rnd = seeded(f.sparkSeed), xa = CX + Rmm, xb = DX - DR, segs = 9, a = clamp(f.spark / .4, 0, 1), pts = [S(xa, CY)];
      for (let i = 1; i < segs; i++) pts.push(S(xa + ((xb - xa) * i) / segs, CY + (rnd() - .5) * 22, (rnd() - .5) * .1));
      pts.push(S(xb, CY));
      // Nur — x–y tekisligidagi ikki shaffof lenta (burilishlarda miter, bo'g'inlarda ustma-ust tushmaydi), o'zakdan
      // biroz orqada; o'zak — bitta chiziq. Bir xil chuqurlikdagi chiziq qatlamlari WebGL da «chiqillab» qoladi.
      const op = (v) => Math.round(clamp(v, 0, 1) * 10) / 10; // shaffoflik 0,1 qadamda — rang keshi o'smasin
      const dir = (p, q) => { const x = q[0] - p[0], y = q[1] - p[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
      const last = pts.length - 1, side = pts.map((p, i) => {
        const d0 = dir(pts[Math.max(0, i - 1)], pts[Math.max(1, i)]), d1 = dir(pts[Math.min(i, last - 1)], pts[Math.min(i + 1, last)]);
        const tl = Math.hypot(d0[0] + d1[0], d0[1] + d1[1]) || 1, tx = (d0[0] + d1[0]) / tl, ty = (d0[1] + d1[1]) / tl;
        const m = 1 / Math.max(.5, tx * d0[0] + ty * d0[1]);
        return [-ty * m, tx * m];
      });
      const ribbon = (hw, col) => {
        const at = (j, s) => [pts[j][0] + s * side[j][0] * hw, pts[j][1] + s * side[j][1] * hw, pts[j][2] + .004];
        for (let i = 1; i <= last; i++) lab.face([at(i - 1, 1), at(i, 1), at(i, -1), at(i - 1, -1)], col);
      };
      ribbon(5.5 * k, alpha(c.dark ? '#c7d2fe' : '#a5b4fc', op(.45 * a)));
      ribbon(2.2 * k, alpha(c.dark ? '#e0e7ff' : '#818cf8', op(.75 * a)));
      for (let i = 1; i <= last; i++) lab.line(pts[i - 1], pts[i], alpha(c.dark ? '#ffffff' : '#4338ca', op(1.4 * a)), 2.4);
    }
    // zond: izolyator dasta (kuzatuvchi tomon og'gan), tutqich va sharcha
    const pr = f.probe, pp = S(pr.x, pr.y), grip0 = S(pr.x + 56, pr.y - 56, -.2), grip1 = S(pr.x + 78, pr.y - 78, -.28);
    lab.rod(S(pr.x + 2.8, pr.y - 2.8, -.01), grip0, 1.6 * k, ins, 8);
    lab.rod(grip0, grip1, 5.5 * k, alpha(c.dark ? '#fdba74' : '#fb923c', .85), 12);
    lab.sphere(pp, Math.max(4 * k, .046), c.dark ? '#facc15' : '#eab308');
    if (f.Evec) lab.vector(pp, [f.Evec.x * .95, -f.Evec.y * .95, 0], c.warning, 'E');
    lab.handle('sprobe', pp, .13);
    lab.handle('sprobe', grip1, .15);
  }

  /* ------------------------------------------------ Umumiy */
  function draw(ctx, stage, f) {
    geom = f.geom;
    if (f.mode !== mode) mode = f.mode;
    lab.begin(ctx, stage, VIEW[mode].begin);
    const c = lab.colors;
    if (mode === 'law') lawScene(f, c);
    else if (mode === 'sup') supScene(f, c);
    else sphScene(f, c);
    lab.finish(0, f.note);
  }
  return {
    lab, draw,
    /** Rejim almashganda kamera shu tajribaga mos ko'rinishga qaytadi. */
    setMode(m) { mode = m; lab.reset(); },
    /** mm nuqta → sahna: 1) shtativ tekisligi (lab.nearest uchun), 2) kyuvetadagi moy sathi, 3) shar tekisligi. */
    lawPoint: (x, y, z = 0) => L(x, y, z),
    trayAt: (x, y) => T(x, y),
    sphereAt: (x, y) => S(x, y),
    /** 2) Ekran → kyuveta tekisligidagi mm nuqta. */
    trayPoint(p) { const r = inverse(p, T(0, 0), [SUP.k, 0, 0], [0, 0, -SUP.k]); return r ? { x: r.s, y: r.t } : null; },
    /** 3) Ekran → shar tekisligidagi (z = 0) mm nuqta. */
    spherePoint(p) { const r = inverse(p, S(0, 0), [SPH.k, 0, 0], [0, -SPH.k, 0]); return r ? { x: r.s, y: r.t } : null; },
  };
}
