// ==========================================================================
// Linzalar va optik asboblar — fizika (DOM'siz, paraksial yaqinlashish, yupqa linzalar).
// Maktab formulasi: 1/F = 1/d + 1/f (d — buyumgacha, f — tasvirgacha; f < 0 — mavhum tasvir; F < 0 — sochuvchi linza).
// Ichki hisob — Dekart koordinatalari (x o'ngga, linza x = 0 da): 1/x' − 1/x = 1/F, kattalashtirish m = x'/x.
// Nur: (y, u) — balandlik va qiyalik; linzadan o'tganda u' = u − y/F, bo'shliqda y' = y + u·Δx.
// Ko'z: soddalashtirilgan model (linza + to'r parda L_r masofada), akkomodatsiya oralig'i [P₀, P₀ + A].
// ==========================================================================

/** Bitta yupqa linza: buyum masofasi d > 0 (chapda), qaytaradi { f, m, real, upright, inf }. */
export function thinLens(F, d) {
  const x = -d;
  const inv = 1 / F + 1 / x;
  if (Math.abs(inv) < 1e-12) return { f: Infinity, m: Infinity, real: false, upright: true, inf: true };
  const xi = 1 / inv;
  const m = xi / x;
  return { f: xi, m, real: xi > 0, upright: m > 0, inf: false };
}

/** Optik kuch (dioptriya): D = 1/F (F metrda). */
export const power = (Fm) => 1 / Fm;

/** Ketma-ket linzalar tizimida buyumning tasviri. lenses: [{x, F}] (x o'sish tartibida), buyum xo, balandligi h. */
export function systemImage(lenses, xo, h) {
  let x = xo, y = h;
  const steps = [];
  for (const L of lenses) {
    const rel = x - L.x; // buyumning linzaga nisbatan koordinatasi (Dekart)
    const inv = 1 / L.F + 1 / rel;
    if (Math.abs(inv) < 1e-12) { steps.push({ x: Infinity, y: Infinity, inf: true }); return { steps, x: Infinity, y: Infinity, inf: true }; }
    const xi = 1 / inv, m = xi / rel;
    x = L.x + xi; y = y * m;
    steps.push({ x, y, real: xi > 0, inf: false });
  }
  return { steps, x, y, inf: false };
}

/** Nurni kuzatish: (x0, y0) dan u qiyalik bilan; linzalar orqali xEnd gacha. Qaytaradi siniq chiziq nuqtalari. */
export function traceRay(lenses, x0, y0, u, xEnd) {
  const pts = [[x0, y0]];
  let x = x0, y = y0, s = u;
  for (const L of lenses) {
    if (L.x <= x) continue;
    if (L.x > xEnd) break;
    y += s * (L.x - x); x = L.x;
    pts.push([x, y]);
    s -= y / L.F;
  }
  y += s * (xEnd - x);
  pts.push([xEnd, y]);
  return { pts, slope: s };
}

/** Ekrandagi dog' (noaniqlik) diametri: nuqtaviy buyumdan linza aperturasi (radius a) orqali, ekran xs da. */
export function blurDiameter(F, d, a, xs) {
  const { f, inf } = thinLens(F, d);
  if (inf) return 2 * a; // parallel dasta
  if (f <= 0) return 2 * a * (1 + xs / Math.max(1e-9, -f)); // mavhum: tarqaluvchi dasta
  return (2 * a * Math.abs(xs - f)) / f;
}

/* ------------------------------------------------------------------ Optik asboblar */

export const D0 = 0.25; // eng yaxshi ko'rish masofasi (m)
/** Lupa: Γ = D₀/F (tasvir cheksizlikda). */
export const loupeMag = (F) => D0 / F;
/** Mikroskop: Γ ≈ (Δ/F₁)·(D₀/F₂), Δ — fokuslar orasidagi masofa (tubus). */
export const microscopeMag = (F1, F2, L) => ((L - F1 - F2) / F1) * (D0 / F2);
/** Kepler teleskopi: Γ = F₁/F₂ (fokuslar ustma-ust: L = F₁ + F₂). */
export const telescopeMag = (F1, F2) => F1 / F2;

/* ------------------------------------------------------------------ Ko'z */

export const EYE = {
  Lr: { normal: 0.017, myopia: 0.0176, hyperopia: 0.0165 }, // linza — to'r parda (m)
  P0: 1 / 0.017,   // bo'shashgan ko'z optik kuchi (D)
  A: 4,            // akkomodatsiya (D) — normal ko'zning eng yaqin nuqtasi 25 cm
  pupil: 0.003,    // ko'z qorachig'i diametri (m)
  glassesGap: 0.012,
};

/**
 * Ko'z buyumni ko'radi: d — buyumgacha masofa (m, Infinity bo'lishi mumkin), defect — normal|myopia|hyperopia,
 * glasses — ko'zoynak optik kuchi (D) yoki 0. Qaytaradi: { P (tanlangan kuch), img (linzadan tasvirgacha), defocus, blur (to'r pardadagi dog', m), sharp }
 */
export function eyeView(d, defect = "normal", glasses = 0) {
  const Lr = EYE.Lr[defect], g = EYE.glassesGap;
  // Vergentsiya (D): manbadan d masofada V = −1/d (tarqaluvchi dasta manfiy)
  let V;
  if (glasses !== 0) {
    let Vg = Number.isFinite(d) ? -1 / (d - g) : 0; // ko'zoynakka kelganda
    Vg += glasses;
    V = Vg / (1 - g * Vg);                             // g masofadan keyin ko'zga
  } else V = Number.isFinite(d) ? -1 / d : 0;
  const need = 1 / Lr - V;
  const P = Math.min(EYE.P0 + EYE.A, Math.max(EYE.P0, need));
  const out = V + P;
  const img = out > 1e-9 ? 1 / out : Infinity;
  const defocus = Lr - img;
  const blur = Number.isFinite(img) ? (EYE.pupil * Math.abs(defocus)) / img : EYE.pupil;
  return { P, img, defocus, blur, sharp: blur < 6e-6, Lr, V, accommodation: P - EYE.P0 };
}

/** Uzoq va yaqin nuqtalar (ko'zoynaksiz). */
export function farNear(defect) {
  const Lr = EYE.Lr[defect];
  const far = EYE.P0 - 1 / Lr; // 1/d_far
  const near = EYE.P0 + EYE.A - 1 / Lr;
  return { far: far <= 0 ? Infinity : 1 / far, near: near > 0 ? 1 / near : Infinity, farV: far, nearV: near };
}

/** Kerakli ko'zoynak: miopiyada uzoq nuqtani cheksizlikka; gipermetropiyada yaqin nuqtani 25 cm ga. */
export function prescription(defect) {
  const { far, near } = farNear(defect);
  if (defect === "myopia") { const g = far - EYE.glassesGap; return -1 / g; }
  if (defect === "hyperopia") { const dg = D0 - EYE.glassesGap, ng = near - EYE.glassesGap; return 1 / dg - 1 / ng; }
  return 0;
}
