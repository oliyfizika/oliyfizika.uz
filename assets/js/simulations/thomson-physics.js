// ==========================================================================
// Elektronning solishtirma zaryadi e/m — ingichka dastali naycha va Helmgols g‘altaklari (DOM'siz).
// eU = mv²/2,  evB = mv²/r  ⇒  r = √(2U·m/e)/B,  e/m = 2U/(B²r²).
// Helmgols g‘altaklari markazidagi maydon: B = (4/5)^{3/2}·μ₀NI/R.
// Yerning magnit maydonining g‘altaklar o‘qi bo‘ylab tashkil etuvchisi B_Y g‘altak maydoniga qo‘shiladi:
// qurilmani vertikal o‘q atrofida 180° burib (o = −1) qayta o‘lchab, o‘rtacha tok olinsa, uning ta’siri yo‘qoladi.
// Elektron to‘pidagi kontakt potensiallari tufayli elektron energiyasi e(U − ΔU), ΔU ≈ 3 V (kichik sistematik xato).
// Uzunliklar — metr; naycha koordinatalari: shar markazi (0, 0), elektron to‘pi chiqishi G (0, GY).
// ==========================================================================

export const EM = 1.75882001076e11; // C/kg
export const QE = 1.602176634e-19, ME = QE / EM;
export const MU0 = 4e-7 * Math.PI, N = 130, R = 0.15;
export const KB = (0.8 ** 1.5 * MU0 * N) / R; // T/A
export const BY = 2.0e-5; // Yer maydonining o‘q bo‘ylab tashkil etuvchisi, T
export const RB = 0.085; // shar radiusi, m
export const GY = -0.056; // dasta chiqish nuqtasi (shar markazidan pastda)
export const MARKS = [0.02, 0.03, 0.04, 0.05]; // nuqtali belgilar: r (diametr 4…10 sm)
export const U_RANGE = [100, 300], I_MAX = 4;
export const DU = 3; // katod–anod kontakt potensiallari: elektron energiyasi e(U − ΔU), V

/** Natijaviy maydon (ishorali, o‘q bo‘ylab), T. dir = ±1 — tok yo‘nalishi, o = ±1 — qurilma holati (0° / 180°). */
export const Bof = (I, dir = 1, o = 1) => dir * KB * I - o * BY;
export const vOf = (U) => Math.sqrt(2 * EM * Math.max(0, U - DU));
/** Orbita radiusi, m (B ≈ 0 da Infinity). */
export const rOf = (U, B) => (Math.abs(B) < 1e-9 ? Infinity : vOf(U) / (EM * Math.abs(B)));
/** Dasta r radiusli belgidan o‘tishi uchun kerakli tok (to‘g‘ri yo‘nalishda), A; o — qurilma holati. */
export const Ineed = (U, r, o = 1) => (vOf(U) / (EM * r) + o * BY) / KB;

/** Dasta traektoriyasi: shar ichidagi nuqtalar [[x, y], …] (m) va oxirgi nuqta shisha ustidami. */
export function beam(U, B, n = 240) {
  const r = rOf(U, B), s = B >= 0 ? 1 : -1, pts = [[0, GY]];
  if (!Number.isFinite(r) || r > 5) { for (let x = 0.002; x <= RB; x += 0.002) { if (Math.hypot(x, GY) > RB - 0.002) return { pts, hit: true, r }; pts.push([x, GY]); } return { pts, hit: true, r }; }
  const cy = GY + s * r;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI, x = r * Math.sin(a), y = cy - s * r * Math.cos(a);
    if (Math.hypot(x, y) > RB - 0.002) return { pts, hit: true, r };
    if (i === n && Math.hypot(x, y - GY) < 1e-6) break;
    pts.push([x, y]);
  }
  return { pts, hit: false, r };
}
