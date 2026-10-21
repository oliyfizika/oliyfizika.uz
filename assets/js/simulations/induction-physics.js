// ==========================================================================
// Elektromagnit induksiya va o'zinduksiya — fizika (DOM'siz, SI).
// 1) Faradey tajribasi: o'q bo'ylab harakatlanuvchi magnit (nuqtaviy dipol, momenti m) va g'altak (N o'ram,
//    radius a, uzunlik ℓ). Bitta o'ramdan o'tuvchi oqim (aniq): Φ₁(z) = μ₀ m a² / (2 (a² + z²)^{3/2}).
//    G'altak oqimi — o'ramlar bo'ylab yig'indi (ℓ bo'yicha tekis taqsimlangan). EYuK: ε = −dΨ/dt = −(dΨ/dz)·v.
// 2) Generator: ramka ω burchak tezligi bilan aylanadi: Ψ = NBS cos ωt, ε = NBSω sin ωt.
//    Kontakt halqalar — o'zgaruvchan tok, kollektor — bir yo'nalishli (pulsatsiyalanuvchi) tok.
// 3) O'zinduksiya: ikki parallel shoxcha (lampa + rezistor, lampa + g'altak), kalit bilan.
//    Ulanganda: I₂ = I₀(1 − e^{−t/τ}), τ = L/R₂. Uzilganda: g'altak toki ikkala lampa orqali τ' = L/(R₁+R₂) bilan so'nadi.
// ==========================================================================

export const MU0 = 4e-7 * Math.PI;

/** Bitta o'ramdan (radius a) o'tuvchi dipol maydon oqimi; z — dipoldan o'ram markazigacha o'q bo'ylab masofa. */
export const loopFlux = (m, a, z) => (MU0 * m * a * a) / (2 * Math.pow(a * a + z * z, 1.5));
/** dΦ₁/dz. */
export const loopFluxDz = (m, a, z) => (-3 * MU0 * m * a * a * z) / (2 * Math.pow(a * a + z * z, 2.5));

/**
 * G'altakning to'liq oqim ilashishi Ψ = Σ Φᵢ va dΨ/dx (x — magnit markazi koordinatasi, g'altak markazi 0 da).
 * K — hisob uchun o'ram qatlamlari soni (har biri N/K o'ramni ifodalaydi).
 */
export function coilLinkage(c, x, K = 40) {
  let psi = 0, dpsi = 0;
  for (let i = 0; i < K; i++) {
    const zc = -c.len / 2 + (c.len * (i + 0.5)) / K; // o'ram joyi
    const z = zc - x;
    psi += loopFlux(c.m, c.a, z);
    dpsi += -loopFluxDz(c.m, c.a, z); // d/dx: z = zc − x
  }
  return { psi: (psi * c.N) / K, dpsi: (dpsi * c.N) / K };
}

/** EYuK va tok: ε = −(dΨ/dx)·v, I = ε / R. */
export function faraday(c, x, v, R) {
  const { psi, dpsi } = coilLinkage(c, x);
  const emf = -dpsi * v;
  return { psi, emf, I: emf / R };
}

/** Generator: ε(t) = NBSω sin(ωt + φ₀); kollektor bilan |sin|. */
export function generatorEmf(p, t) {
  const ph = p.omega * t + (p.phase0 || 0);
  const e = p.N * p.B * p.S * p.omega * Math.sin(ph);
  return p.commutator ? Math.abs(e) : e;
}
export const generatorFlux = (p, t) => p.N * p.B * p.S * Math.cos(p.omega * t + (p.phase0 || 0));
export const emfMax = (p) => p.N * p.B * p.S * p.omega;

/**
 * O'zinduksiya zanjiri: holat { i2 } — g'altak toki. p: { E, R1, R2, L, closed }.
 * Kalit ulangan: shoxchalar manbaga parallel: i1 = E/R1, L di2/dt = E − i2 R2.
 * Kalit uzilgan: g'altak toki ikkala shoxcha halqasi bo'ylab: L di2/dt = −i2 (R1 + R2), i1 = −i2 (lampa 1 orqali teskari).
 * Qaytaradi: { i1, i2, eSelf (o'zinduksiya EYuK = −L di2/dt) }.
 */
export function rlStep(st, p, dt) {
  // aniq eksponensial yechim bilan qadam (barqaror)
  let iInf, R;
  if (p.closed) { iInf = p.E / p.R2; R = p.R2; }
  else { iInf = 0; R = p.R1 + p.R2; }
  const tau = p.L / R;
  const i0 = st.i2;
  st.i2 = iInf + (i0 - iInf) * Math.exp(-dt / tau);
  const di = (iInf - st.i2) / tau; // di2/dt (oxirgi nuqtada)
  const i1 = p.closed ? p.E / p.R1 : -st.i2;
  return { i1, i2: st.i2, eSelf: -p.L * di, tau };
}

/** Analitik: ulangandan keyin t vaqtda g'altak toki. */
export const rlRise = (E, R, L, t) => (E / R) * (1 - Math.exp((-R * t) / L));
/** Analitik: uzilgandan keyin (boshlang'ich i0). */
export const rlFall = (i0, R, L, t) => i0 * Math.exp((-R * t) / L);
/** Magnit maydon energiyasi. */
export const magEnergy = (L, I) => 0.5 * L * I * I;
/** Uzun g'altak induktivligi: L = μ₀μN²S/ℓ. */
export const solenoidL = (N, S, len, mu = 1) => (MU0 * mu * N * N * S) / len;
