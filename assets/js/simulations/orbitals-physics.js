// ==========================================================================
// Vodorod atomi: elektron bulutlari — DOM’siz fizika (simulations/orbitals.html)
// ψₙₗₘ(r, θ, φ) = Rₙₗ(r)·Yₗᵐ(θ, φ); uzunlik birligi — Bor radiusi a₀ = 0,529 Å.
// Nuqtalar |ψ|² taqsimotidan tanlanadi: radius r²Rₙₗ² ning teskari taqsimot funksiyasidan (aniq),
// yo‘nalish esa |Θ·Φ|² bo‘yicha qabul–rad (rejection) usulidan. |ψ|² = R²(r)·|Y(θ, φ)|² ajraluvchi.
// Node’da import qilinadi: tools/simulations/tests/t_orbitals.mjs
// ==========================================================================

export const NMAX = 4;
export const A0_NM = 0.0529177; // Bor radiusi, nm
export const RY_EV = 13.6057; // Ridberg energiyasi, eV
export const LETTERS = ["s", "p", "d", "f"];

/** Umumlashgan Lager ko‘phadi L_k^a(x) (rekurrent formula). */
export function laguerre(k, a, x) {
  if (k === 0) return 1;
  let L0 = 1, L1 = 1 + a - x;
  for (let i = 1; i < k; i++) {
    const L2 = ((2 * i + 1 + a - x) * L1 - (i + a) * L0) / (i + 1);
    L0 = L1; L1 = L2;
  }
  return L1;
}

/** Normallanmagan radial funksiya Rₙₗ(r), r — a₀ birligida. Ishorasi to‘g‘ri (tugunlarda o‘zgaradi). */
export function radial(n, l, r) {
  const rho = (2 * r) / n;
  return rho ** l * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** Biriktirilgan Lejandr funksiyasi Pₗᵐ(x), m ≥ 0 (Kondon–Shortli fazasisiz). */
export function legendre(l, m, x) {
  let pmm = 1;
  const s = Math.sqrt(Math.max(0, 1 - x * x));
  let f = 1;
  for (let i = 1; i <= m; i++) { pmm *= f * s; f += 2; }
  if (l === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1; pmmp1 = pll;
  }
  return pll;
}

/**
 * Burchak amplitudasi (normallanmagan, haqiqiy son): kvadrati — burchak bo‘yicha zichlik.
 * Kompleks holat (real = false): |Yₗᵐ|² ∝ Pₗ^|m|(cos θ)² — z o‘qi atrofida simmetrik; qaytariladigan ishora
 * faqat θ-qismniki (e^{imφ} fazasi ko‘rsatilmaydi).
 * Real orbital (real = true): m > 0 → P·cos(mφ), m < 0 → P·sin(|m|φ) (kimyodagi pₓ, d_xy, …).
 */
export function angAmp(l, m, real, ct, phi) {
  const am = Math.abs(m);
  const P = legendre(l, am, ct);
  if (!real || m === 0) return P;
  return m > 0 ? P * Math.cos(am * phi) : P * Math.sin(am * phi);
}

/** Holatning ruxsat etilganligi: 1 ≤ n, 0 ≤ l < n, |m| ≤ l. */
export const valid = (n, l, m) => Number.isInteger(n) && n >= 1 && n <= NMAX && l >= 0 && l < n && Math.abs(m) <= l;

/** Real orbital nomi (pastki indeks bilan): [asos, indeks]. */
const REAL_NAMES = {
  "1,0": "z", "1,1": "x", "1,-1": "y",
  "2,0": "z²", "2,1": "xz", "2,-1": "yz", "2,2": "x²−y²", "2,-2": "xy",
  "3,0": "z³", "3,1": "xz²", "3,-1": "yz²", "3,2": "z(x²−y²)", "3,-2": "xyz", "3,3": "x(x²−3y²)", "3,-3": "y(3x²−y²)",
};
export function orbitalName(n, l, m, real) {
  const base = `${n}${LETTERS[l]}`;
  if (l === 0 || (!real && m !== 0)) return { base, sub: "" }; // mₗ = 0 holat kompleks va real ko‘rinishda bir xil
  return { base, sub: REAL_NAMES[`${l},${m}`] || "" };
}

/** Kuzatiladigan kattaliklar (a₀, eV, ħ birliklarida). */
export function quantities(n, l, m, real) {
  const L2 = l * (l + 1);
  return {
    E: -RY_EV / (n * n), // eV
    L2, // L² / ħ²
    L: Math.sqrt(L2), // L / ħ
    Lz: real && m !== 0 ? null : m, // real kombinatsiyada L_z aniq qiymatga ega emas
    rMean: (3 * n * n - L2) / 2, // ⟨r⟩ / a₀
    r2Mean: (n * n * (5 * n * n + 1 - 3 * L2)) / 2, // ⟨r²⟩ / a₀²
    radialNodes: n - l - 1,
    angularNodes: l,
    degeneracy: n * n, // spinsiz orbitallar soni
    ionization: RY_EV / (n * n), // eV
  };
}

/** Eng ehtimolli radius: r²R² maksimumi (sonli), a₀. l = n − 1 da aniq n². */
export function mostProbableR(n, l) {
  const rmax = 3.6 * n * n + 12, G = 6000, dr = rmax / G;
  let best = 0, bestV = -1;
  for (let i = 1; i <= G; i++) { const r = i * dr, R = radial(n, l, r), v = r * r * R * R; if (v > bestV) { bestV = v; best = r; } }
  return best;
}

/** r²R² ning yig‘ma taqsimot funksiyasi (normallangan) — radiusni tanlash uchun. */
export function radialCDF(n, l, G = 4000) {
  const rmax = 3.6 * n * n + 12, dr = rmax / G;
  const cdf = new Float64Array(G + 1);
  let acc = 0;
  for (let i = 1; i <= G; i++) {
    const r = (i - 0.5) * dr, R = radial(n, l, r);
    acc += r * r * R * R * dr; cdf[i] = acc;
  }
  for (let i = 0; i <= G; i++) cdf[i] /= acc;
  return { cdf, dr, G, rmax };
}

/** Kichik, tez va qayta tiklanadigan PRNG (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * sample(n, l, m, real, N, rand) — |ψ|² taqsimotidan N ta nuqta.
 * Qaytaradi: { xyz: Float32Array(3N) — fizik (x, y, z), a₀; sign: Int8Array(N) — ψ ishorasi (+1 / −1); count }.
 */
export function sample(n, l, m, real, N, rand = Math.random) {
  const { cdf, dr, G } = radialCDF(n, l);
  let amax = 0;
  for (let a = 0; a <= 400; a++) {
    const ct = -1 + a / 200;
    for (let b = 0; b < 64; b++) { const v = angAmp(l, m, real, ct, (b * Math.PI) / 32); if (v * v > amax) amax = v * v; }
  }
  amax *= 1.02;
  const xyz = new Float32Array(N * 3), sign = new Int8Array(N);
  let k = 0, guard = 0;
  while (k < N && guard < N * 400) {
    guard++;
    const ct = 2 * rand() - 1, ph = 2 * Math.PI * rand();
    const A = angAmp(l, m, real, ct, ph);
    if (rand() * amax > A * A) continue;
    const u = rand();
    let lo = 0, hi = G;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid; }
    const r = (lo + (u - cdf[lo]) / Math.max(1e-12, cdf[hi] - cdf[lo])) * dr;
    const st = Math.sqrt(Math.max(0, 1 - ct * ct));
    xyz[3 * k] = r * st * Math.cos(ph);
    xyz[3 * k + 1] = r * st * Math.sin(ph);
    xyz[3 * k + 2] = r * ct;
    sign[k] = radial(n, l, r) * A >= 0 ? 1 : -1;
    k++;
  }
  return { xyz, sign, count: k };
}

/** ψ ning nol sirtlari (tugunlar): radial tugunlar radiuslari (a₀), sonli topiladi. */
export function radialNodeRadii(n, l) {
  const out = [], rmax = 3.6 * n * n + 12, G = 20000, dr = rmax / G;
  let prev = radial(n, l, dr);
  for (let i = 2; i <= G; i++) {
    const r = i * dr, v = radial(n, l, r);
    if (prev !== 0 && Math.sign(v) !== Math.sign(prev)) {
      let a = r - dr, b = r; // bisektsiya
      for (let j = 0; j < 50; j++) { const c = (a + b) / 2; if (Math.sign(radial(n, l, c)) === Math.sign(radial(n, l, a))) a = c; else b = c; }
      out.push((a + b) / 2);
    }
    prev = v;
  }
  return out;
}
