// ==========================================================================
// Elektrlanish va elektroskop — fizika (DOM'siz, SI; zaryadlar nC da).
// Ishqalanish orqali elektrlanish (zaryadning saqlanishi), tegizish orqali zaryadlash, elektrostatik induksiya,
// yerga ulash, ikki elektroskopni o'tkazgich bilan ulash, yaproqchalar muvozanati (Kulon kuchi + og'irlik).
//
// Elektroskop modeli: sharcha + sterjen + yaproqchalar — bitta o'tkazgich (radiusi R bo'lgan sharcha sig'imi).
// Tashqi zaryad q (masofa D) o'tkazgich potensialiga kq/D qo'shadi: φ = k(Q + Σ q·R/D)/R (uzoqda ekranlanadi).
// Yaproqchalardagi zaryad potensialga proporsional: Q_yap = β·(Q + Σ q·R/D) — elektroskop aslida potensialni ko'rsatadi.
// Yerga ulangan elektroskop: φ = 0 ⇒ Q = −Σ q·R/D (sharchada induksiyalangan zaryad), Q_yap = 0.
// ==========================================================================

export const K = 8.99e9, E = 1.602e-19, G = 9.81, NC = 1e-9;

/** Ishqalanadigan juftliklar: sign — tayoqcha oladigan zaryad ishorasi; metal — qo'lda ushlangan metall (zaryad yerga oqadi). */
export const PAIRS = {
  glass: { rod: "Shisha tayoqcha", cloth: "Ipak", sign: +1, qmax: 36, metal: false },
  ebonite: { rod: "Ebonit tayoqcha", cloth: "Jun", sign: -1, qmax: 40, metal: false },
  amber: { rod: "Qahrabo", cloth: "Jun", sign: -1, qmax: 28, metal: false },
  metal: { rod: "Metall tayoqcha", cloth: "Jun", sign: -1, qmax: 30, metal: true },
};

/** Elektroskop standart parametrlari: sharcha radiusi R, yaproqcha uzunligi L, massasi m, yaproqchalar ulushi β. */
export const SCOPE = { R: 0.016, L: 0.06, m: 8e-6, beta: 0.5, thMax: 80 * Math.PI / 180 };

/** Elektronlar soni: N = |q|/e (q — nC). */
export const electrons = (qnC) => Math.abs(qnC * NC) / E;

/**
 * Ishqalash qadami: mato tayoqcha bo'ylab ds (m) siljiganda matodan tayoqchaga o'tadigan zaryad dT (nC).
 * To'yinish: T → sign·qmax (T — shu paytgacha o'tgan zaryad, matoning zaryadi bilan −T).
 */
export function rubStep(qCloth, ds, pair, ell = 0.3) {
  const T = -qCloth;
  return (pair.sign * pair.qmax - T) * (1 - Math.exp(-Math.abs(ds) / ell));
}

/**
 * Tashqi zaryadning sharchaga ta'siri: q·R/D (nC). D — sharcha markazigacha masofa (m), D ≥ R.
 * Atrofdagi yerga ulangan jismlar (stol, korpus, qo'l) uzoq zaryadni ekranlaydi: exp(−(D − R)/λ) ko'paytuvchisi.
 */
export const LAMBDA = 0.1;
export const coupling = (R, D, lambda = LAMBDA) => { const d = Math.max(R, D); return (R / d) * Math.exp(-(d - R) / lambda); };
export const external = (list, R = SCOPE.R) => list.reduce((s, { q, D }) => s + q * coupling(R, D), 0);

/** Zaryad taqsimoti: yaproqchalarda va sharchada (sterjen bilan). */
export function distribute(Q, ext, beta = SCOPE.beta) {
  const leaf = beta * (Q + ext);
  return { leaf, ball: Q - leaf };
}
/** Yerga ulangan elektroskopning to'liq zaryadi. */
export const groundedQ = (ext) => -ext;

/**
 * Izolyator (shisha, ebonit, mato) sharchaga tekkanda zaryad almashuvi: faqat tekkan joydagi zaryad qatnashadi.
 * dQ = τ·(φ·q − (1 − φ)·Q); q' = q − dQ, Q' = Q + dQ (yig'indi saqlanadi).
 */
export function touch(q, Q, tau = 0.35, phi = 0.5) {
  const dQ = tau * (phi * q - (1 - phi) * Q);
  return { q: q - dQ, Q: Q + dQ, dQ };
}

/**
 * Ikki elektroskop o'tkazgich bilan ulanganda potensiallar tenglashadi (bir xil sig'im):
 * Q₁ + ext₁ = Q₂ + ext₂, Q₁ + Q₂ = const.
 */
export function share(Q1, Q2, ext1 = 0, ext2 = 0) {
  const Qt = Q1 + Q2, a = (Qt + ext2 - ext1) / 2;
  return [a, Qt - a];
}

/** Yaproqchalar orasidagi Kulon kuchi (N): har yaproqcha uchida q/2, oraliq 2L·sinθ. */
export const leafForce = (qLeafnC, th, L = SCOPE.L) => {
  const q = (qLeafnC * NC) / 2, r = 2 * L * Math.sin(th);
  return (K * q * q) / (r * r);
};

/**
 * Yaproqchalar burchagi θ (vertikaldan, rad): tgθ = F/(mg) ⇒ tgθ·sin²θ = kq²/(16L²mg).
 * Bisektsiya; korpus devori θ ≤ thMax.
 */
export function leafAngle(qLeafnC, { L = SCOPE.L, m = SCOPE.m, thMax = SCOPE.thMax } = {}) {
  const q = qLeafnC * NC, c = (K * q * q) / (16 * L * L * m * G);
  if (c <= 0) return 0;
  const f = (t) => Math.tan(t) * Math.sin(t) ** 2 - c;
  if (f(thMax) <= 0) return thMax;
  let a = 0, b = thMax;
  for (let i = 0; i < 60; i++) { const mid = (a + b) / 2; if (f(mid) > 0) b = mid; else a = mid; }
  return (a + b) / 2;
}
