// ==========================================================================
// Nyuton qonunlari — fizika (DOM'siz, SI).
// 1) Ikkinchi qonun: aravacha + doimiy kuch (dinamometr) yoki blok orqali osilgan yuk; ishqalanish μ.
// 2) Uchinchi qonun: ikki aravacha orasidagi siqilgan prujina — F₁₂ = −F₂₁, m₁v₁ = m₂v₂.
// 3) Liftda vazn: P = m(g + a), qavatga yurish profili, erkin tushish va tormoz.
// ==========================================================================

export const G = 9.81;

/**
 * Aravacha dinamikasi. mode: "force" (doimiy F) yoki "hang" (osilgan yuk m).
 * Qaytaradi: a, ishqalanish f (harakatga qarshi), ip tarangligi T, harakatlantiruvchi kuch Fd, natijaviy kuch.
 * v — hozirgi tezlik (0 bo'lsa tinchlikdagi ishqalanish tekshiriladi).
 */
export function cartForces({ M, m = 0, F = 0, mu = 0, mode = "force", v = 0, attached = true }, g = G) {
  const Fd = !attached ? 0 : mode === "hang" ? m * g : F; // harakatlantiruvchi tashqi kuch
  const mass = mode === "hang" && attached ? M + m : M;
  const fmax = mu * M * g;
  let f, a;
  if (v > 1e-9) { f = fmax; a = (Fd - f) / mass; }
  else if (Fd > fmax) { f = fmax; a = (Fd - f) / mass; }
  else { f = Fd; a = 0; } // tinch turadi: tinchlikdagi ishqalanish tashqi kuchni muvozanatlaydi
  const T = mode === "hang" ? (attached ? m * (g - a) : 0) : F;
  return { a, f, T, Fd, Fnet: mass * a, mass };
}
/** Tinch holatdan s masofani o'tish vaqti va tezligi. */
export const timeOver = (s, a) => (a > 0 ? Math.sqrt((2 * s) / a) : Infinity);
export const accelFrom = (s, t) => (2 * s) / (t * t);

/** Ikki aravacha + prujina (siqilgan Δx). Holat {x1, x2, v1, v2}; prujina faqat siqilganda ta'sir qiladi. */
export function recoilStep(st, dt, { m1, m2, k, L0 }) {
  const n = Math.max(1, Math.ceil(dt / 2e-4)), h = dt / n;
  let { x1, x2, v1, v2 } = st, Fs = 0;
  for (let i = 0; i < n; i++) {
    const comp = L0 - (x2 - x1);
    Fs = comp > 0 ? k * comp : 0; // 2-aravachaga +Fs, 1-aravachaga −Fs
    v1 -= (Fs / m1) * h; v2 += (Fs / m2) * h; x1 += v1 * h; x2 += v2 * h;
  }
  return { x1, x2, v1, v2, F: Fs };
}
/** Prujina energiyasidan oxirgi tezliklar (impuls saqlanishi). */
export function recoilFinal(m1, m2, k, dx) {
  const E = 0.5 * k * dx * dx, v2 = Math.sqrt((2 * E * m1) / (m2 * (m1 + m2)));
  return { v1: -(m2 * v2) / m1, v2, E };
}

/** Vazn (tarozi ko'rsatishi): P = m(g + a), a — yuqoriga musbat. */
export const weight = (m, a, g = G) => Math.max(0, m * (g + a));

/** Qavatga yurish profili: tezlanish a0, eng katta tezlik vmax; D — yo'l (ishorali). Qaytaradi a(t) funksiyasi va T. */
export function rideProfile(D, a0, vmax) {
  const d = Math.abs(D), sg = Math.sign(D) || 1;
  let ta = vmax / a0, vm = vmax;
  if (a0 * ta * ta > d) { ta = Math.sqrt(d / a0); vm = a0 * ta; }
  const tc = (d - a0 * ta * ta) / vm, T = 2 * ta + tc;
  const acc = (t) => (t < 0 || t > T ? 0 : t < ta ? sg * a0 : t < ta + tc ? 0 : -sg * a0);
  return { acc, T, ta, tc, vm };
}
