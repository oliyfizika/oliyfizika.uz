// ==========================================================================
// Fotometriya — fizika (DOM'siz; simulations/photometry.html).
// Nuqtaviy manba: yorug'lik kuchi I (kandela, cd); Ω fazoviy burchakdagi yorug'lik oqimi Φ = IΩ (lyumen, lm);
// to'liq oqim Φ₀ = 4πI. Yoritilganlik E = Φ/S (lyuks, lx); manbadan r masofadagi, nurga α burchak
// ostida (normal bilan) turgan sirt uchun E = I·cos α / r² (masofa kvadratiga teskari va kosinus qonuni).
// ==========================================================================

export const LAMPS = {
  inc60: { name: "Cho‘g‘lanma lampa 60 W", P: 60, flux: 710 },
  inc100: { name: "Cho‘g‘lanma lampa 100 W", P: 100, flux: 1340 },
  led9: { name: "LED lampa 9 W", P: 9, flux: 806 },
};
/** Lampaning (izotrop deb olingan) yorug'lik kuchi, cd */
export const intensity = (lamp) => lamp.flux / (4 * Math.PI);
/** Yorug'lik berish samaradorligi, lm/W */
export const efficacy = (lamp) => lamp.flux / lamp.P;

/** Yoritilganlik, lx: I (cd), r (m), α (rad) */
export const illuminance = (I, r, alpha = 0) => (I * Math.max(0, Math.cos(alpha))) / (r * r);
/** Sirtga tushayotgan oqim, lm: S (m²) */
export const fluxOn = (I, r, alpha, S) => illuminance(I, r, alpha) * S;
/** Sirt manbadan ko'rinadigan fazoviy burchak (kichik sirt), sr */
export const solidAngle = (r, alpha, S) => (S * Math.max(0, Math.cos(alpha))) / (r * r);

/** Lyuksmetr: fon yoritilganligi + o'lchash xatoligi (±2 % ± 1 lx), 1 lx gacha yaxlitlanadi */
export function luxmeter(E, fon, rnd = 0) { return Math.max(0, Math.round((E + fon) * (1 + 0.02 * rnd) + rnd)); }

/** Koordinata boshidan o'tuvchi to'g'ri chiziq qiyaligi (eng kichik kvadratlar) */
export function slope0(pts) { let a = 0, b = 0; for (const [x, y] of pts) { a += x * x; b += x * y; } return a > 0 ? b / a : NaN; }

/** Yoritilganlik me'yorlari, lx */
export const NORMS = [[20, "ko‘cha yoritilishi"], [150, "yo‘lak, zina"], [300, "sinf xonasi, o‘qish"], [500, "chizmachilik, nozik ish"], [1000, "operatsiya xonasi"]];
