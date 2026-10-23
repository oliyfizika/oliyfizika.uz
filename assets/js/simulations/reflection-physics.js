// ==========================================================================
// Yorug'likning qaytishi va sinishi — fizika (DOM'siz).
// Snell qonuni, Frenel koeffitsiyentlari, vektor ko'rinishida qaytish/sinish, 2D nur kuzatuvchi
// (plastinka, yarim silindr, prizma, optik tola — ko'pburchak + aniq yoy normallari),
// prizmada og'ish, yassi ko'zgular (ikki ko'zgudagi tasvirlar soni), sferik ko'zgu.
// Koordinatalar: x o'ngga, y yuqoriga. Burchaklar: tashqi API'da gradus, ichkarida radian.
// ==========================================================================

export const DEG = Math.PI / 180;
export const C = 299_792_458;

export const MATERIALS = [
  { id: "air", name: "Havo", n: 1.0 },
  { id: "water", name: "Suv", n: 1.33 },
  { id: "ice", name: "Muz", n: 1.31 },
  { id: "glass", name: "Shisha", n: 1.5 },
  { id: "flint", name: "Og‘ir shisha", n: 1.65 },
  { id: "diamond", name: "Olmos", n: 2.42 },
];

/* ------------------------------------------------------------------ Chegara: Snell + Frenel */

/** Frenel (qutblanmagan nur): Rs, Rp, R. a, b — tushish va sinish burchaklari (rad). */
export function fresnel(n1, n2, a, b) {
  const ci = Math.cos(a), ct = Math.cos(b);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
  const Rs = rs * rs, Rp = rp * rp;
  return { Rs, Rp, R: Math.min(1, Math.max(0, (Rs + Rp) / 2)) };
}

/** Snell qonuni: alfa gradusda. Qaytaradi {a, beta (rad|null), tir, critical (rad|null), Rs, Rp, R, T}. */
export function snell(n1, n2, alphaDeg) {
  const a = alphaDeg * DEG;
  const s = (n1 / n2) * Math.sin(a);
  const critical = n1 > n2 ? Math.asin(n2 / n1) : null;
  if (s > 1 + 1e-12) return { a, beta: null, tir: true, critical, Rs: 1, Rp: 1, R: 1, T: 0 };
  const beta = Math.asin(Math.min(1, s));
  const f = fresnel(n1, n2, a, beta);
  return { a, beta, tir: false, critical, ...f, T: 1 - f.R };
}

/** Bryuster burchagi (gradus): tg α_B = n₂/n₁. */
export const brewster = (n1, n2) => Math.atan(n2 / n1) / DEG;

/* ------------------------------------------------------------------ Vektorlar */

const dot = (a, b) => a.x * b.x + a.y * b.y;
const norm = (v) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
export const dirDeg = (deg) => ({ x: Math.cos(deg * DEG), y: Math.sin(deg * DEG) });

/** Qaytish: d' = d − 2(d·n)n. */
export function reflectVec(d, n) { const k = 2 * dot(d, n); return { x: d.x - k * n.x, y: d.y - k * n.y }; }

/** Sinish (n — nurga qarab yo'nalgan birlik normal, d·n < 0). To'liq ichki qaytishda null. */
export function refractVec(d, n, n1, n2) {
  const ci = -dot(d, n), eta = n1 / n2;
  const k = 1 - eta * eta * (1 - ci * ci);
  if (k < 0) return null;
  const s = eta * ci - Math.sqrt(k);
  return norm({ x: eta * d.x + s * n.x, y: eta * d.y + s * n.y });
}

/* ------------------------------------------------------------------ Shakllar */
// Shakl: { n, edges: [{a, b, c?}] } — c berilsa qirra yoy bo'lagi (normal = radial, aniq).

function pushArc(edges, c, r, t0, t1, steps) {
  for (let i = 0; i < steps; i++) {
    const u0 = t0 + ((t1 - t0) * i) / steps, u1 = t0 + ((t1 - t0) * (i + 1)) / steps;
    edges.push({ a: { x: c.x + r * Math.cos(u0), y: c.y + r * Math.sin(u0) }, b: { x: c.x + r * Math.cos(u1), y: c.y + r * Math.sin(u1) }, c, r });
  }
}
function polyEdges(pts) { return pts.map((p, i) => ({ a: p, b: pts[(i + 1) % pts.length] })); }

/** To'g'ri burchakli plastinka: markaz (0,0), kenglik w, qalinlik t. */
export function slabShape(w, t, n) { return { kind: "slab", n, t, edges: polyEdges([{ x: -w / 2, y: t / 2 }, { x: -w / 2, y: -t / 2 }, { x: w / 2, y: -t / 2 }, { x: w / 2, y: t / 2 }]) }; }

/** Yarim silindr (yarim doira): yassi tomoni y = 0 da yuqoriga qaragan, yoy pastda. */
export function semiShape(r, n) {
  const edges = [{ a: { x: r, y: 0 }, b: { x: -r, y: 0 } }];
  pushArc(edges, { x: 0, y: 0 }, r, Math.PI, 2 * Math.PI, 240);
  return { kind: "semi", n, r, edges };
}

/** Teng yonli prizma: uchi yuqorida, sindiruvchi burchak A (gradus), yon qirra uzunligi s. Asos markazi (0, −h/3) atrofida. */
export function prismShape(Adeg, s, n) {
  const A = Adeg * DEG, h = s * Math.cos(A / 2), b = s * Math.sin(A / 2);
  const y0 = -h / 2;
  const apex = { x: 0, y: y0 + h }, L = { x: -b, y: y0 }, R = { x: b, y: y0 };
  return { kind: "prism", n, A: Adeg, apex, L, R, edges: polyEdges([apex, L, R]) };
}

/**
 * Optik tola: o'q chizig'i (−len, 0) dan (0, 0) gacha to'g'ri, so'ng radiusi Rb bo'lgan yoy bo'ylab B gradusga pastga egiladi.
 * Qalinlik w. Kirish yuzasi x = −len da, chiqish — yoy oxirida.
 */
export function fiberShape(len, w, Rb, Bdeg, n) {
  const B = Bdeg * DEG, hw = w / 2, cen = { x: 0, y: -Rb };
  const top = [], bot = [];
  const steps = Math.max(2, Math.round(Bdeg * 2));
  const edges = [];
  // yuqori (tashqi) chiziq: chapdan o'ngga
  edges.push({ a: { x: -len, y: hw }, b: { x: 0, y: hw } });
  if (B > 1e-6) pushArc(edges, cen, Rb + hw, Math.PI / 2, Math.PI / 2 - B, steps);
  const endTop = B > 1e-6 ? { x: cen.x + (Rb + hw) * Math.sin(B), y: cen.y + (Rb + hw) * Math.cos(B) } : { x: 0, y: hw };
  const endBot = B > 1e-6 ? { x: cen.x + (Rb - hw) * Math.sin(B), y: cen.y + (Rb - hw) * Math.cos(B) } : { x: 0, y: -hw };
  edges.push({ a: endTop, b: endBot, exit: true });
  if (B > 1e-6) pushArc(edges, cen, Rb - hw, Math.PI / 2 - B, Math.PI / 2, steps);
  edges.push({ a: { x: 0, y: -hw }, b: { x: -len, y: -hw } });
  edges.push({ a: { x: -len, y: -hw }, b: { x: -len, y: hw }, entry: true });
  void top; void bot;
  const exitDir = { x: Math.cos(-B), y: Math.sin(-B) };
  return { kind: "fiber", n, len, w, Rb, B: Bdeg, edges, endTop, endBot, exitDir };
}

/** Nuqta shakl ichidami (nur tashlash usuli). */
export function inside(shape, p) {
  let c = false;
  for (const e of shape.edges) {
    const { a, b } = e;
    if ((a.y > p.y) !== (b.y > p.y)) {
      const x = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (x > p.x) c = !c;
    }
  }
  return c;
}
const mediumAt = (shapes, p, n0) => { for (const s of shapes) if (inside(s, p)) return s.n; return n0; };

/** Nur va kesma kesishishi: t (nur bo'ylab) yoki Infinity. */
function hitEdge(o, d, e) {
  const ex = e.b.x - e.a.x, ey = e.b.y - e.a.y;
  const den = d.x * ey - d.y * ex;
  if (Math.abs(den) < 1e-14) return Infinity;
  const wx = e.a.x - o.x, wy = e.a.y - o.y;
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * d.y - wy * d.x) / den;
  if (t <= 1e-9 || u < -1e-9 || u > 1 + 1e-9) return Infinity;
  return t;
}

/**
 * 2D nur kuzatuvchi. Har bir chegarada Frenel bo'yicha qaytgan va singan nurlarga ajraladi.
 * Qaytaradi: { segs: [{a, b, I, depth, main}], events: [{p, n1, n2, a (rad), b (rad|null), tir, edge, main}] }
 * main — asosiy (eng yorqin) yo'l.
 */
export function trace(shapes, o, d, { n0 = 1, maxDepth = 7, minI = 0.015, maxLen = 200, maxSegs = 160 } = {}) {
  const segs = [], events = [];
  const stack = [{ o, d: norm(d), I: 1, depth: 0, main: true }];
  while (stack.length && segs.length < maxSegs) {
    const r = stack.pop();
    let best = Infinity, be = null;
    for (const s of shapes) for (const e of s.edges) { const t = hitEdge(r.o, r.d, e); if (t < best) { best = t; be = e; } }
    if (!be || best > maxLen) { segs.push({ a: r.o, b: { x: r.o.x + r.d.x * maxLen, y: r.o.y + r.d.y * maxLen }, I: r.I, depth: r.depth, main: r.main, out: true }); continue; }
    const p = { x: r.o.x + r.d.x * best, y: r.o.y + r.d.y * best };
    segs.push({ a: r.o, b: p, I: r.I, depth: r.depth, main: r.main });
    if (r.depth >= maxDepth) continue;
    let nrm;
    if (be.c) nrm = norm({ x: p.x - be.c.x, y: p.y - be.c.y });
    else nrm = norm({ x: -(be.b.y - be.a.y), y: be.b.x - be.a.x });
    if (dot(nrm, r.d) > 0) nrm = { x: -nrm.x, y: -nrm.y }; // nurga qarab
    const eps = 1e-6;
    const n1 = mediumAt(shapes, { x: p.x + nrm.x * eps, y: p.y + nrm.y * eps }, n0);
    const n2 = mediumAt(shapes, { x: p.x - nrm.x * eps, y: p.y - nrm.y * eps }, n0);
    const ci = Math.min(1, -dot(r.d, nrm)), a = Math.acos(ci);
    const t = refractVec(r.d, nrm, n1, n2);
    const rd = reflectVec(r.d, nrm);
    const step = (v) => ({ x: p.x + v.x * 1e-7, y: p.y + v.y * 1e-7 });
    if (!t) {
      events.push({ p, n1, n2, a, b: null, tir: true, edge: be, main: r.main, nrm });
      stack.push({ o: step(rd), d: rd, I: r.I, depth: r.depth + 1, main: r.main });
      continue;
    }
    const b = Math.asin(Math.min(1, (n1 / n2) * Math.sin(a)));
    const { R } = fresnel(n1, n2, a, b);
    events.push({ p, n1, n2, a, b, tir: false, edge: be, main: r.main, nrm, R });
    const IR = r.I * R, IT = r.I * (1 - R);
    if (IR >= minI) stack.push({ o: step(rd), d: rd, I: IR, depth: r.depth + 1, main: false });
    if (IT >= minI) stack.push({ o: step(t), d: t, I: IT, depth: r.depth + 1, main: r.main });
  }
  return { segs, events };
}

/* ------------------------------------------------------------------ Plastinka va prizma (analitik) */

/** Yassi-parallel plastinkada nurning yon siljishi: Δ = t·sin(α−β)/cosβ. */
export function slabShift(t, n, alphaDeg, n0 = 1) {
  const r = snell(n0, n, alphaDeg);
  return (t * Math.sin(r.a - r.beta)) / Math.cos(r.beta);
}

/** Prizmada og'ish: A — sindiruvchi burchak, α — 1-yoqqa tushish burchagi (gradus). */
export function prismDeviation(Adeg, n, alphaDeg, n0 = 1) {
  const A = Adeg * DEG, a1 = alphaDeg * DEG;
  const b1 = Math.asin((n0 / n) * Math.sin(a1));
  const b2 = A - b1;
  const s = (n / n0) * Math.sin(b2);
  if (b2 < -Math.PI / 2 || s > 1) return { tir: true, b1, b2, a2: null, delta: null };
  const a2 = Math.asin(s);
  return { tir: false, b1, b2, a2, delta: (a1 + a2 - A) / DEG };
}
/** Eng kichik og'ish: simmetrik yo'l, n = sin((A+δmin)/2)/sin(A/2). */
export function prismMinDeviation(Adeg, n, n0 = 1) {
  const A = Adeg * DEG;
  const s = (n / n0) * Math.sin(A / 2);
  if (s > 1) return null;
  return { delta: (2 * Math.asin(s) - A) / DEG, alpha: Math.asin(s) / DEG };
}
/** Optik tola sonli aperturasi: sin α_max = √(n² − n₀²)/n_tashqi (havoda n_tashqi = 1). */
export function acceptanceAngle(n, nClad = 1, nOut = 1) {
  const s = Math.sqrt(Math.max(0, n * n - nClad * nClad)) / nOut;
  return s >= 1 ? 90 : Math.asin(s) / DEG;
}

/* ------------------------------------------------------------------ Ko'zgular */

/** Nuqtaning to'g'ri chiziqqa (p0 dan o'tuvchi, u yo'nalishli) nisbatan simmetrik tasviri. */
export function mirrorPoint(p, p0, u) {
  const v = norm(u), wx = p.x - p0.x, wy = p.y - p0.y, k = wx * v.x + wy * v.y;
  return { x: 2 * (p0.x + k * v.x) - p.x, y: 2 * (p0.y + k * v.y) - p.y };
}

/**
 * Burchak ostidagi ikki yassi ko'zgu (cho'qqisi koordinata boshida): 1-ko'zgu θ = 0 nur bo'ylab, 2-ko'zgu θ = φ nur bo'ylab.
 * Buyum ular orasida (0 < θ_buyum < φ). Ketma-ket aks ettirish bilan ko'rinadigan tasvirlar.
 * Qaytaradi: tasvirlar ro'yxati [{p, chain:"1"|"2"|..., order}] (takrorlar olib tashlangan).
 */
export function twoMirrorImages(phiDeg, obj) {
  const phi = phiDeg * DEG;
  const M = [{ u: { x: 1, y: 0 }, n: { x: 0, y: 1 } }, { u: { x: Math.cos(phi), y: Math.sin(phi) }, n: { x: Math.sin(phi), y: -Math.cos(phi) } }];
  // n — ko'zguning aks ettiruvchi (buyum tomondagi) normali; ko'zgu yarim to'g'ri chiziq (r ≥ 0)
  const front = (k, p) => p.x * M[k].n.x + p.y * M[k].n.y > 1e-9;
  const imgs = [];
  for (const startK of [0, 1]) {
    let src = obj, k = startK, order = 0;
    const chain = [];
    while (order < 60) {
      if (!front(k, src)) break;
      const im = mirrorPoint(src, { x: 0, y: 0 }, M[k].u);
      chain.push(k + 1); order++;
      imgs.push({ p: im, chain: chain.join(""), order });
      src = im; k = 1 - k;
    }
  }
  // takrorlarni olib tashlash (φ = 360/k da oxirgi tasvirlar ustma-ust)
  const out = [];
  for (const im of imgs) if (!out.some((o) => Math.hypot(o.p.x - im.p.x, o.p.y - im.p.y) < 1e-6 * (1 + Math.hypot(obj.x, obj.y)))) out.push(im);
  return out;
}
/** Maktab formulasi: N = 360°/φ − 1 (360/φ butun bo'lganda aniq). */
export const imagesFormula = (phiDeg) => 360 / phiDeg - 1;

/**
 * Sferik ko'zgu (paraksial). R > 0 — botiq, R < 0 — qavariq; F = R/2.
 * d — buyumgacha (ko'zgu oldida, > 0). Qaytaradi {F, f, m, real, upright, inf}: f > 0 — tasvir ko'zgu oldida (haqiqiy).
 */
export function sphericalMirror(R, d) {
  const F = R / 2;
  const inv = 1 / F - 1 / d;
  if (Math.abs(inv) < 1e-12) return { F, f: Infinity, m: Infinity, real: false, upright: true, inf: true };
  const f = 1 / inv, m = -f / d;
  return { F, f, m, real: f > 0, upright: m > 0, inf: false };
}
