// ==========================================================================
// Vektorlar va kuchlarni qo'shish — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_vectors.mjs)
// Vektor — { x, y } (koordinata o'qlaridagi proyeksiyalari). Burchaklar gradusda, x o'qidan soat strelkasiga teskari.
// ==========================================================================

export const DEG = Math.PI / 180;
export const vec = (x, y) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
export const neg = (a) => scale(a, -1);
/** Moduli |a| = √(aₓ² + a_y²) */
export const mag = (a) => Math.hypot(a.x, a.y);
/** Yo'nalish burchagi (0…360°) */
export const dirDeg = (a) => { const d = Math.atan2(a.y, a.x) / DEG; return d < 0 ? d + 360 : d; };
/** Modul va burchakdan vektor */
export const polar = (r, deg) => ({ x: r * Math.cos(deg * DEG), y: r * Math.sin(deg * DEG) });
/** Skalyar ko'paytma */
export const dot = (a, b) => a.x * b.x + a.y * b.y;
/** Ikki vektor orasidagi burchak (0…180°) */
export const between = (a, b) => { const m = mag(a) * mag(b); return m ? Math.acos(Math.max(-1, Math.min(1, dot(a, b) / m))) / DEG : 0; };
/** Kosinuslar teoremasi: |a + b| = √(a² + b² + 2ab·cosθ) */
export const sumMag = (a, b, thetaDeg) => Math.sqrt(Math.max(0, a * a + b * b + 2 * a * b * Math.cos(thetaDeg * DEG)));
/** |a − b| = √(a² + b² − 2ab·cosθ) */
export const diffMag = (a, b, thetaDeg) => Math.sqrt(Math.max(0, a * a + b * b - 2 * a * b * Math.cos(thetaDeg * DEG)));
/** Teng ta'sir etuvchi (natijaviy) kuch */
export const resultant = (list) => list.reduce((s, f) => add(s, f), vec(0, 0));
/** Muvozanat: natijaviy kuch nolga teng */
export const isBalanced = (list, eps = 1e-9) => mag(resultant(list)) <= eps;
/** Proyeksiya: aₓ = a·cosα, a_y = a·sinα */
export const proj = (r, deg) => ({ x: r * Math.cos(deg * DEG), y: r * Math.sin(deg * DEG) });
