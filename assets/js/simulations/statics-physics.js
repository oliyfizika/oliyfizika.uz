// ==========================================================================
// Statika: massa markazi, muvozanat turlari, kuch momenti, richag va oddiy mexanizmlar (DOM'siz).
// Plastinka geometriyasi cm da; dinamika SI (m, kg, s). Tekshiruv: tools/simulations/tests/t_statics.mjs
// ==========================================================================

export const G = 9.8;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ 1. Plastinka: massa markazi */

/** Ko'pburchakning yuzi, og'irlik markazi va koordinata boshiga nisbatan qutb inersiya momenti (birlik zichlik) */
export function polyProps(pts) {
  let A = 0, sx = 0, sy = 0, J = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], cr = x0 * y1 - x1 * y0;
    A += cr; sx += (x0 + x1) * cr; sy += (y0 + y1) * cr;
    J += cr * (x0 * x0 + x0 * x1 + x1 * x1 + y0 * y0 + y0 * y1 + y1 * y1);
  }
  A /= 2; const cx = sx / (6 * A), cy = sy / (6 * A); J /= 12;
  return A < 0 ? { A: -A, cx, cy, J: -J } : { A, cx, cy, J };
}
/** Aylana (ko'pburchak bilan yaqinlashtirilgan) */
export const circle = (x, y, r, n = 64) => Array.from({ length: n }, (_, k) => [x + r * Math.cos((TAU * k) / n), y + r * Math.sin((TAU * k) / n)]);
function arcPts(x, y, r, a0, a1, n) { return Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [x + r * Math.cos(a), y + r * Math.sin(a)]; }); }

/** Fanera plastinkalar (4 mm, ρ = 600 kg/m³ → 0,24 g/cm²). parts: [ko'pburchak, ishora]; holes — osish teshiklari */
export const SIGMA = 0.24;
export const SHAPES = {
  L: { name: "L shaklidagi plastinka", parts: [[[[0, 0], [10, 0], [10, 15], [24, 15], [24, 24], [0, 24]], 1]], holes: [[3, 3], [21, 20.5], [3, 21]] },
  tri: { name: "Uchburchak", parts: [[[[0, 24], [9, 0], [26, 24]], 1]], holes: [[9, 3.5], [23, 22], [3, 22]] },
  disk: { name: "Teshikli disk", parts: [[circle(13, 13, 12.5), 1], [circle(17.5, 9.5, 5), -1]], holes: [[13, 2], [3, 18], [23.5, 18]] },
  arch: { name: "Taqa (yarim halqa)", parts: [[[...arcPts(13, 14, 13, Math.PI, TAU, 40), ...arcPts(13, 14, 7, TAU, Math.PI, 30)], 1]], holes: [[13, 3.5], [3, 12.5], [23, 12.5]] },
};
/** Butun plastinka: yuz (cm²), massa markazi (cm), massa (g), massa markaziga nisbatan J/σ (cm⁴) */
export function plateProps(shape) {
  let A = 0, Sx = 0, Sy = 0, J = 0;
  for (const [pts, s] of shape.parts) { const p = polyProps(pts); A += s * p.A; Sx += s * p.A * p.cx; Sy += s * p.A * p.cy; J += s * p.J; }
  const cx = Sx / A, cy = Sy / A;
  return { A, cx, cy, Jc: J - A * (cx * cx + cy * cy), mass: SIGMA * A };
}
/** Plastinka teshikdan osilganda muvozanat burchagi: massa markazi osish nuqtasidan pastda (ekran: y pastga) */
export function hangEq(pp, hole) { return Math.PI / 2 - Math.atan2(pp.cy - hole[1], pp.cx - hole[0]); }
/** Fizik mayatnik: ω₀² = g·d/(k² + d²), d — osish nuqtasidan massa markazigacha (cm, g = 980 cm/s²) */
export function hangOmega(pp, hole) { const d = Math.hypot(pp.cx - hole[0], pp.cy - hole[1]); return Math.sqrt((980 * d) / (pp.Jc / pp.A + d * d)); }
export const wrapPi = (a) => a - TAU * Math.round(a / TAU);
/** Bir qadam: st { th, w }; γ — o'qdagi ishqalanish */
export function plateStep(st, pp, hole, dt, gamma = 1.5) {
  const th0 = hangEq(pp, hole), w0 = hangOmega(pp, hole), n = Math.max(1, Math.ceil(dt / 0.002)), h = dt / n;
  for (let i = 0; i < n; i++) { st.w += (-w0 * w0 * Math.sin(st.th - th0) - gamma * st.w) * h; st.th += st.w * h; }
  return st;
}
/** Ikki chiziq kesishishi (plastinka koordinatalarida): chiziq { p, d } */
export function lineX(a, b) {
  const det = a.d[0] * b.d[1] - a.d[1] * b.d[0];
  if (Math.abs(det) < 1e-6) return null;
  const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / det;
  return [a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t];
}
/** Nuqta ko'pburchak ichidami (plastinka materialida) */
export function inside(shape, x, y) {
  let s = 0;
  for (const [pts, sg] of shape.parts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } if (c) s += sg; }
  return s > 0;
}

/* ------------------------------------------------------------------ 2. Qutining ag'darilishi */

/** Quti: eni b, balandligi h (m), massa markazi balandligi f·h. Qirra atrofida α burchakka og'dirilgan */
export const tipCrit = (b, h, f = 0.5) => Math.atan(b / (2 * f * h));
export const tipHeight = (b, h, f, a) => f * h * Math.cos(a) + (b / 2) * Math.sin(a);
/** Tiklovchi moment (+ — qutini qaytaradi) */
export const tipTorque = (m, b, h, f, a) => m * G * ((b / 2) * Math.cos(a) - f * h * Math.sin(a));
export function tipInertia(m, b, h, f) { return m * ((b * b + h * h) / 12 + (b / 2) ** 2 + (f * h) ** 2); }
/** st { a, w }; α ≤ 0 — tagi bilan turadi; α = 90° — yonboshiga yiqilgan */
export function tipStep(st, box, dt) {
  const { m, b, h, f } = box, I = tipInertia(m, b, h, f), n = Math.max(1, Math.ceil(dt / 0.002)), k = dt / n;
  for (let i = 0; i < n; i++) {
    if (st.rest) break;
    st.w += (-tipTorque(m, b, h, f, st.a) / I) * k; st.a += st.w * k;
    if (st.a <= 0) { st.a = 0; st.w = Math.abs(st.w) > 0.4 ? -0.25 * st.w : 0; if (!st.w) st.rest = "up"; }
    if (st.a >= Math.PI / 2) { st.a = Math.PI / 2; st.w = 0; st.rest = "side"; }
  }
  return st;
}

/* ------------------------------------------------------------------ 3. Sharcha: muvozanat turlari */

/** Sirt profili y(x), cm: botiq (turg'un), qavariq (turg'unmas), tekis (befarq). R = 20 cm, |x| ≤ 15 cm */
export const SURF_R = 20, SURF_W = 15;
export function surfY(kind, x) {
  const a = Math.min(Math.abs(x), SURF_W), y = (a * a) / (2 * SURF_R), H = (SURF_W * SURF_W) / (2 * SURF_R);
  if (kind === "bowl") return y;
  if (kind === "dome") return Math.abs(x) >= SURF_W ? 0 : H - y;
  return 0;
}
export function surfSlope(kind, x) {
  if (kind === "flat" || Math.abs(x) >= SURF_W) return 0;
  return (kind === "bowl" ? 1 : -1) * (x / SURF_R);
}
/** Dumalayotgan sharcha (I = 2mr²/5): a = −(5/7)·g·sinθ. st { x (cm), v (cm/s) }. Chegaralar: botiq idish devori, stol chetlari */
export function ballStep(st, kind, dt, gamma = 0.35) {
  const n = Math.max(1, Math.ceil(dt / 0.002)), k = dt / n, lim = kind === "bowl" ? SURF_W : 24;
  for (let i = 0; i < n; i++) {
    const s = surfSlope(kind, st.x);
    st.v += (-(5 / 7) * 980 * (s / Math.sqrt(1 + s * s)) - gamma * st.v) * k; st.x += st.v * k;
    if (Math.abs(st.x) > lim) { st.x = Math.sign(st.x) * lim; st.v = -0.3 * st.v; }
  }
  return st;
}

/* ------------------------------------------------------------------ 4. Richag */

/** Laboratoriya richagi: 60 cm, har 5 cm da teshik (har tomonda 6 ta), massasi 100 g; yuklar 100 g */
export const LEVER = { L: 0.6, step: 0.05, n: 6, mBar: 0.1, mW: 0.1, e: 0.008 };
/**
 * Momentlar tayanch nuqtasiga nisbatan (+ — soat mili bo'yicha, o'ng uchi pastga).
 * loads: [{ x (m, richag markazidan, o'ngga +), m (kg) }], po — tayanch nuqtasining markazdan siljishi (m)
 */
export function leverMoments(loads, po = 0, mBar = LEVER.mBar) {
  let cw = 0, ccw = 0;
  for (const { x, m } of loads) { const M = m * G * (x - po); if (M > 0) cw += M; else ccw -= M; }
  const Mb = mBar * G * (0 - po); if (Mb > 0) cw += Mb; else ccw -= Mb;
  return { cw, ccw, net: cw - ccw, bar: Mb };
}
/** Dinamometr x nuqtada vertikaldan φ burchak ostida tortadi. Richag gorizontal turishi uchun kerakli kuch (+ — yuqoriga, − — pastga) */
export function dynForce(net, xd, po, phi) { const arm = (xd - po) * Math.cos(phi); return Math.abs(arm) < 1e-9 ? Infinity : net / arm; }
/** Tayanch reaksiyasi: N = Σmg + m_r·g − F (F yuqoriga musbat; dinamometr qiya bo'lsa, faqat vertikal tashkil etuvchisi) */
export function pivotN(loads, Fup = 0, phi = 0, mBar = LEVER.mBar) { return loads.reduce((s, l) => s + l.m * G, 0) + mBar * G - Fup * Math.cos(phi); }
export function leverInertia(loads, po = 0, mBar = LEVER.mBar) { return (mBar * LEVER.L * LEVER.L) / 12 + mBar * po * po + loads.reduce((s, l) => s + l.m * (l.x - po) ** 2, 0); }
/** Richag burilishi β (rad, + — o'ng uchi pastga); tayanch o'qi richag o'rta chizig'idan e = 8 mm yuqorida, tirgak ±14° */
export const LEVER_STOP = (14 * Math.PI) / 180;
export function leverStep(st, loads, po, dt, gamma = 3) {
  const I = leverInertia(loads, po), Mt = loads.reduce((s, l) => s + l.m, 0) + LEVER.mBar, { net } = leverMoments(loads, po), n = Math.max(1, Math.ceil(dt / 0.002)), k = dt / n;
  for (let i = 0; i < n; i++) {
    st.w += ((net * Math.cos(st.b) - Mt * G * LEVER.e * Math.sin(st.b)) / I - gamma * st.w) * k; st.b += st.w * k;
    if (Math.abs(st.b) > LEVER_STOP) { st.b = Math.sign(st.b) * LEVER_STOP; st.w = -0.2 * st.w; }
  }
  return st;
}

/* ------------------------------------------------------------------ 5. Bloklar va chig'ir */

/** Har bir g'ildirakda ip ishqalanishi: η₁ = 0,95; qo'zg'aluvchan blok oboymasi bilan 100 g; chig'ir barabani r = 5 cm */
export const MECH = { eta1: 0.95, mBlock: 0.1, r: 0.05, etaAxle: 0.92 };
/**
 * Kerakli kuch (yuk sekin, tekis ko'tariladi). kind: fixed | movable | tackle | axle.
 * Qaytaradi { F, W (yuk og'irligi), k = s/h (ip yo'lining yuk yo'liga nisbati), eta }
 */
export function mechForce(kind, m, { n = 4, R = 0.3, ideal = false } = {}) {
  const e = ideal ? 1 : MECH.eta1, W = m * G;
  let F, k;
  if (kind === "fixed") { F = W / e; k = 1; }
  else if (kind === "movable") { const Wt = W + (ideal ? 0 : MECH.mBlock * G); F = Wt / (1 + e); k = 2; }
  else if (kind === "tackle") { const Wt = W + (ideal ? 0 : MECH.mBlock * G * (n / 2)); let s = 0; for (let i = 1; i <= n; i++) s += e ** i; F = Wt / s; k = n; }
  else { F = (W * MECH.r) / (R * (ideal ? 1 : MECH.etaAxle)); k = R / MECH.r; }
  return { F, W, k, eta: W / (F * k) };
}
