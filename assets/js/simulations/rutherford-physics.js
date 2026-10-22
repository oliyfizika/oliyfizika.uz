// ==========================================================================
// Rezerford tajribasi — fizika (DOM'siz). Birliklar: energiya MeV, uzunlik fm (yadro) va cm (qurilma).
// α-zarraning yadro Kulon maydonida sochilishi: dσ/dΩ = (zZe²/(4πε₀·4E))² / sin⁴(θ/2).
// Detektor sanoq tezligi: n(θ) = I₀ · (n_a·t) · ΔΩ · dσ/dΩ (+ fon). Havoda α-zarra energiyasi Geyger qoidasi bo'yicha
// kamayadi: R = 0,318·E^1,5 cm (normal bosimda).
// ==========================================================================

export const KE2 = 1.43996; // e²/(4πε₀), MeV·fm
export const NA = 6.02214076e23;
export const FM2_CM2 = 1e-26;
export const P_ATM = 101325;

export const MATERIALS = {
  Au: { id: "Au", name: "Oltin", Z: 79, A: 196.97, rho: 19.32 },
  Ag: { id: "Ag", name: "Kumush", Z: 47, A: 107.87, rho: 10.49 },
  Cu: { id: "Cu", name: "Mis", Z: 29, A: 63.55, rho: 8.96 },
  Al: { id: "Al", name: "Alyuminiy", Z: 13, A: 26.98, rho: 2.7 },
};
export const SOURCES = {
  am: { id: "am", name: "Am-241", E: 5.486 },
  po: { id: "po", name: "Po-210", E: 5.304 },
  rac: { id: "rac", name: "Ra-C′ (Po-214)", E: 7.687 },
};
/** Qurilma pasporti: dasta intensivligi, folga–detektor masofasi, detektor tirqishi yuzasi, manba–folga masofasi, fon. */
export const APP = { I0: 5.0e6, L: 8.0, Ad: 0.05, Ls: 8.5, bg: 0.002, beamHalf: 3 };
export const dOmega = (Ad = APP.Ad, L = APP.L) => Ad / (L * L);

export const atomsPerCm3 = (m) => (m.rho * NA) / m.A;
/** Folganing yuza zichligi n·t (atom/cm²), t — mikrometr. */
export const areal = (m, tUm) => atomsPerCm3(m) * tUm * 1e-4;
/** Yadro radiusi R ≈ 1,2·A^(1/3) fm. */
export const nucRadius = (A) => 1.2 * Math.cbrt(A);

/** To'qnashuv diametri d = zZe²/(4πε₀E) (fm) — markaziy to'qnashuvda eng yaqin masofa. */
export const collisionD = (Z, E, z = 2) => (z * Z * KE2) / E;
/** Differensial kesim, fm²/sr. th — radian. */
export function dsdo(Z, E, th, z = 2) {
  const a = (z * Z * KE2) / (4 * E), s = Math.sin(Math.abs(th) / 2);
  return (a * a) / s ** 4;
}
/** Nishon masofasi b va sochilish burchagi: θ = 2·arctg(d/2b). */
export const thetaFromB = (b, d) => 2 * Math.atan(d / (2 * b));
export const bFromTheta = (th, d) => d / (2 * Math.tan(th / 2));
/** Eng yaqin masofa: r_min = (d/2)(1 + 1/sin(θ/2)). */
export const rMin = (d, th) => (d / 2) * (1 + 1 / Math.sin(Math.abs(th) / 2));

/** Geyger qoidasi: havodagi yugurish yo'li (cm) va x cm o'tgandan keyingi energiya. p — Pa. */
export const airRange = (E) => 0.318 * E ** 1.5;
export function energyAfterAir(E, xcm, p) {
  const xe = (xcm * p) / P_ATM, R = airRange(E);
  if (xe >= R) return 0;
  return ((R - xe) / 0.318) ** (2 / 3);
}

/**
 * Detektorning kutilayotgan sanoq tezligi (1/s).
 * s = { mat, tUm, E, thDeg, p (Pa) }. Qaytaradi { rate, Eff, beam, blocked }.
 */
export function countRate({ mat, tUm, E, thDeg, p = 1 }, app = APP) {
  const m = MATERIALS[mat], th = (Math.abs(thDeg) * Math.PI) / 180;
  const Ef = energyAfterAir(E, app.Ls, p); // folgagacha
  if (Ef <= 0.05) return { rate: app.bg, Eff: 0, beam: false, blocked: true };
  const Ed = energyAfterAir(Ef, app.L, p); // folgadan detektorgacha
  if (Ed <= 0.05) return { rate: app.bg, Eff: Ef, beam: false, blocked: true };
  if (Math.abs(thDeg) < app.beamHalf) return { rate: 0.5 * app.I0, Eff: Ef, beam: true, blocked: false };
  const r = app.I0 * areal(m, tUm) * dOmega(app.Ad, app.L) * dsdo(m.Z, Ef, th) * FM2_CM2;
  return { rate: r + app.bg, Eff: Ef, beam: false, blocked: false };
}

/** Puasson tasodifiy son (rnd — [0,1) generator). */
export function poisson(lam, rnd = Math.random) {
  if (lam <= 0) return 0;
  if (lam > 60) { // normal yaqinlashish
    let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd();
    return Math.max(0, Math.round(lam + Math.sqrt(lam) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
  }
  const L = Math.exp(-lam); let k = 0, q = 1;
  do { k++; q *= rnd(); } while (q > L);
  return k - 1;
}

/**
 * Kulon itarishidagi traektoriya (yadro qo'zg'almas, koordinatalar fm). Boshlanish: x = −X, y = b, tezlik +x.
 * Tezlanish a = (d/2)·r̂/r² (v₀ = 1 birlikda). Qaytaradi nuqtalar [[x, y, vaqt],...] (|x|,|y| < 1,5X), chiqish burchagi, r_min.
 */
export function trajectory(b, d, { X = 400, step = 0.01 } = {}) {
  const X0 = 2e5; // asimptotik boshlanish
  let x = -X0, y = b, vx = Math.sqrt(1 - d / Math.hypot(X0, b)), vy = 0; // ½v² + (d/2)/r = ½
  const k = d / 2, pts = []; let T = 0;
  const acc = (x, y) => { const r2 = x * x + y * y, r = Math.sqrt(r2), f = k / (r2 * r); return [f * x, f * y]; };
  let rmin = Infinity;
  for (let i = 0; i < 200000; i++) {
    const r = Math.hypot(x, y); rmin = Math.min(rmin, r);
    const h = Math.min(Math.max(step * r, 0.002), 2000);
    const [a1x, a1y] = acc(x, y);
    const [a2x, a2y] = acc(x + 0.5 * h * vx, y + 0.5 * h * vy), v2x = vx + 0.5 * h * a1x, v2y = vy + 0.5 * h * a1y;
    const [a3x, a3y] = acc(x + 0.5 * h * v2x, y + 0.5 * h * v2y), v3x = vx + 0.5 * h * a2x, v3y = vy + 0.5 * h * a2y;
    const [a4x, a4y] = acc(x + h * v3x, y + h * v3y), v4x = vx + h * a3x, v4y = vy + h * a3y;
    T += h; x += (h / 6) * (vx + 2 * v2x + 2 * v3x + v4x); y += (h / 6) * (vy + 2 * v2y + 2 * v3y + v4y);
    vx += (h / 6) * (a1x + 2 * a2x + 2 * a3x + a4x); vy += (h / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
    if (Math.abs(x) < X * 1.5 && Math.abs(y) < X * 1.5) pts.push([x, y, T]);
    if (Math.hypot(x, y) > X0 && x * vx + y * vy > 0) break;
  }
  return { pts, theta: Math.atan2(vy, vx), rmin };
}
