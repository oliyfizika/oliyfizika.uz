// ==========================================================================
// Yorug'lik interferensiyasi va difraksiyasi — fizika (DOM'siz, Fraungofer yaqinlashishi).
// Yung tajribasi: I = cos²(πd·sinθ/λ)·sinc²(πa·sinθ/λ); bitta tirqish: sinc²; doira teshik: Eyri [2J₁(x)/x]²;
// difraksion panjara: sinc²(β)·[sin(Nγ)/(N·sinγ)]². Oq yorug'lik — 400–700 nm bo'yicha yig'indi.
// Birliklar: SI (m). Ekrandagi nuqta Y (ekran markazidan), ekrangacha L: sinθ = Y/√(Y² + L²).
// ==========================================================================

export const TAU = Math.PI * 2;

/** To'lqin uzunligi (nm) → RGB (0…1), ko'rinadigan diapazon chetlarida xiralashadi. */
export function waveRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  return [r * f, g * f, b * f];
}
/** Rang nomi (o'zbekcha). */
export function colorName(nm) { return nm < 450 ? "binafsha" : nm < 485 ? "ko‘k" : nm < 500 ? "havorang" : nm < 565 ? "yashil" : nm < 590 ? "sariq" : nm < 625 ? "to‘q sariq" : "qizil"; }

const sinc2 = (x) => (Math.abs(x) < 1e-9 ? 1 : (Math.sin(x) / x) ** 2);
export const sinTheta = (Y, L) => Y / Math.hypot(Y, L);

/** Bessel J₁ (integral ko'rinishi, Simpson). */
export function besselJ1(x) {
  const n = 64, h = Math.PI / n; let s = 0;
  for (let k = 0; k <= n; k++) { const t = k * h, w = k === 0 || k === n ? 1 : k % 2 ? 4 : 2; s += w * Math.cos(t - x * Math.sin(t)); }
  return (s * h) / 3 / Math.PI;
}
/** Eyri funksiyasi [2J₁(x)/x]². */
export const airy = (x) => (Math.abs(x) < 1e-6 ? 1 : ((2 * besselJ1(x)) / x) ** 2);

/** Yung (ikki tirqish): d — tirqishlar orasi, a — tirqish kengligi. closed — bitta tirqish yopiq. */
export function youngI(s, lam, d, a, closed = false) {
  const env = sinc2((Math.PI * a * s) / lam);
  return closed ? env : env * Math.cos((Math.PI * d * s) / lam) ** 2;
}
/** Bitta tirqish (kenglik a) yoki doira teshik (diametr a). */
export function slitI(s, lam, a, round = false) { const x = (Math.PI * a * s) / lam; return round ? airy(x) : sinc2(x); }
/** Panjara: N ta tirqish, davr d, tirqish kengligi a (normallashtirilgan, bosh maksimumda 1). */
export function gratingI(s, lam, d, a, N) {
  const g = (Math.PI * d * s) / lam, sg = Math.sin(g);
  const arr = Math.abs(sg) < 1e-9 ? 1 : (Math.sin(N * g) / (N * sg)) ** 2;
  return sinc2((Math.PI * a * s) / lam) * arr;
}

/** Interferension polosalar orasi (kichik burchaklar): Δy = λL/d. */
export const fringeSpacing = (lam, L, d) => (lam * L) / d;
/** Markaziy maksimum kengligi: tirqish 2λL/a, doira 2·1,22λL/D (kichik burchaklar). */
export const centralWidth = (lam, L, a, round = false) => (2 * (round ? 1.22 : 1) * lam * L) / a;
/** Panjara: k-tartib burchagi (rad) yoki null, maksimal tartib. */
export const orderAngle = (k, lam, d) => { const s = (k * lam) / d; return Math.abs(s) < 1 ? Math.asin(s) : null; };
export const maxOrder = (lam, d) => Math.floor(d / lam - 1e-12);
/** Ekranda k-tartib holati: x = L·tg φ. */
export const orderPosition = (k, lam, d, L) => { const p = orderAngle(k, lam, d); return p === null ? null : L * Math.tan(p); };

/** Oq yorug'lik: berilgan intensivlik funksiyasi fn(lam) bo'yicha RGB yig'indisi (normallashtirilgan). */
const WHITE = Array.from({ length: 31 }, (_, k) => 400 + k * 10);
const WHITE_NORM = (() => { const s = [0, 0, 0]; WHITE.forEach((l) => { const c = waveRGB(l); s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; }); return s; })();
export function whiteRGB(fn) {
  const s = [0, 0, 0];
  for (const l of WHITE) { const I = fn(l * 1e-9), c = waveRGB(l); s[0] += I * c[0]; s[1] += I * c[1]; s[2] += I * c[2]; }
  return [s[0] / WHITE_NORM[0], s[1] / WHITE_NORM[1], s[2] / WHITE_NORM[2]];
}

/** Lab: o'lchovlardan λ = d·sinφ/k (eng kichik kvadratlar, koordinata boshidan o'tuvchi to'g'ri chiziq). pts: [{k, s}] */
export function fitLambda(pts, d) {
  if (!pts.length) return null;
  const sxy = pts.reduce((a, p) => a + p.k * p.s, 0), sxx = pts.reduce((a, p) => a + p.k * p.k, 0);
  return (sxy / sxx) * d;
}
