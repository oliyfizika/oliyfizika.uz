// ==========================================================================
// Qiya tekislik: ish va FIK — fizika (DOM'siz; simulations/incline-efficiency.html).
// Jism qiya tekislik bo'ylab tekis (a = 0) yuqoriga tortiladi: F = P(sin α + μ cos α).
// Foydali ish A_f = Ph, to'liq (sarflangan) ish A_t = Fl, ishqalanishga ketgan ish A_q = μP cos α · l.
// FIK η = A_f / A_t = sin α / (sin α + μ cos α) = 1 / (1 + μ ctg α).
// Ishqalanishsiz: F·l = P·h — «mexanikaning oltin qoidasi» (kuchdan yutsak, yo'ldan yutqazamiz).
// ==========================================================================

export const G = 9.81;

/** Jismni tekis tortish uchun kuch (P — og'irlik, a — qiyalik burchagi, rad) */
export const pullForce = (P, a, mu) => P * (Math.sin(a) + mu * Math.cos(a));
/** FIK */
export const efficiency = (a, mu) => { const s = Math.sin(a), d = s + mu * Math.cos(a); return d > 0 ? s / d : 0; };
/** Ishlar: h balandlikka ko'tarishda (l = h / sin a) */
export function works(P, a, mu, h) {
  const l = h / Math.sin(a), F = pullForce(P, a, mu);
  return { l, F, Af: P * h, At: F * l, Aq: mu * P * Math.cos(a) * l };
}
/** Qo'yib yuborilgan jism sirpanmaydimi (o'z-o'zidan tormozlanish) */
export const holds = (a, mu) => Math.tan(a) <= mu + 1e-12;
/** Pastga tushirishda ushlab turuvchi kuch (≥ 0) */
export const holdForce = (P, a, mu) => Math.max(0, P * (Math.sin(a) - mu * Math.cos(a)));
/** Taxta uzunligi l va tirgak balandligi h dan burchak */
export const angleOf = (h, l) => Math.asin(Math.min(1, h / l));
/** Kuchdan yutuq P/F */
export const gain = (P, a, mu) => P / pullForce(P, a, mu);

/** Sirtlar (yog'och brusok ostida) */
export const SURFACES = {
  wood: { name: "yog‘och taxta", mu: 0.3 },
  paper: { name: "silliq qog‘oz", mu: 0.2 },
  glass: { name: "shisha", mu: 0.12 },
  cloth: { name: "mato", mu: 0.45 },
};
