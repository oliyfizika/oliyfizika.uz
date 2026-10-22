// ==========================================================================
// Yorug‘lik diodlari (LED) yordamida Plank doimiysini aniqlash — fizika (DOM'siz).
// p–n o‘tishda elektron va kovak rekombinatsiyalanganda energiyasi ≈ E_g bo‘lgan foton chiqadi: hc/λ ≈ E_g ≈ eU₀.
// LED volt-amper xarakteristikasi: I = (nV_T/R_s)·ln(1 + e^{(U−U_a)/nV_T}) — bo‘sag‘adan past eksponensial,
// yuqorida chiziqli (qiyalik 1/R_s); chiziqli qismni I = 0 gacha davom ettirish U₀ ≈ U_a ni beradi.
// Har bir diodning U_a si hc/(eλ) dan bir oz farq qiladi (δ — real diodlardagi kabi; Plank doimiysi xatosi ~ bir necha %).
// Zanjir: manba E → cheklovchi rezistor R = 150 Ω → mA-metr → LED (voltmetr LED ga parallel).
// Spektrometr: difraksion panjara (600 chiziq/mm), d·sin φ = mλ.
// ==========================================================================

export const H = 6.62607015e-34, QE = 1.602176634e-19, C = 2.99792458e8;
export const HC_EVNM = (H * C) / QE * 1e9; // 1239,84 eV·nm
export const R_LIM = 150; // Ω
export const E_MAX = 6; // V
export const GRATING = 600; // chiziq/mm
export const D_NM = 1e6 / GRATING; // panjara doimiysi, nm
export const LEDS = [
  { id: "IR", name: "IK (GaAs)", short: "IK", nm: 940, fw: 45, d: 0.03, Rs: 6, n: 0.040, color: "#9f1239", vis: false },
  { id: "R", name: "Qizil (AlGaInP)", short: "Qizil", nm: 630, fw: 18, d: -0.02, Rs: 14, n: 0.048, color: "#ef4444", vis: true },
  { id: "O", name: "To‘q sariq (AlGaInP)", short: "To‘q sariq", nm: 610, fw: 16, d: -0.03, Rs: 15, n: 0.048, color: "#f97316", vis: true },
  { id: "Y", name: "Sariq (AlGaInP)", short: "Sariq", nm: 590, fw: 15, d: 0.02, Rs: 16, n: 0.05, color: "#eab308", vis: true },
  { id: "G", name: "Yashil (InGaN)", short: "Yashil", nm: 525, fw: 32, d: -0.04, Rs: 18, n: 0.055, color: "#22c55e", vis: true },
  { id: "B", name: "Ko‘k (InGaN)", short: "Ko‘k", nm: 470, fw: 24, d: 0.05, Rs: 17, n: 0.055, color: "#3b82f6", vis: true },
  { id: "V", name: "Binafsha (InGaN)", short: "Binafsha", nm: 405, fw: 14, d: 0.03, Rs: 20, n: 0.058, color: "#8b5cf6", vis: true },
];
export const ledById = (id) => LEDS.find((l) => l.id === id);
/** Diodning «haqiqiy» bo‘sag‘a kuchlanishi (chiziqli qism ekstrapolyatsiyasi), V. */
export const Ua = (L) => HC_EVNM / L.nm + L.d;
export const photonEv = (nm) => HC_EVNM / nm;

const softplus = (x) => (x > 30 ? x : Math.log1p(Math.exp(x)));
/** LED toki, mA (U — diod kuchlanishi, V). */
export function ledI(L, U) { return (1000 * L.n / L.Rs) * softplus((U - Ua(L)) / L.n); }
/** Manba kuchlanishi E da zanjir: {U (LED da), I (mA)}. */
export function circuit(L, E) {
  if (E <= 0) return { U: 0, I: 0 };
  let lo = 0, hi = E;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (m + (ledI(L, m) / 1000) * R_LIM > E) hi = m; else lo = m; }
  const U = (lo + hi) / 2; return { U, I: ledI(L, U) };
}
/** Berilgan tok uchun manba kuchlanishi (teskari masala, test va tekshiruv uchun). */
export function Eof(L, I) { let lo = 0, hi = 5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ledI(L, m) > I) hi = m; else lo = m; } const U = (lo + hi) / 2; return U + (I / 1000) * R_LIM; }
/** Nurlanish quvvati (nisbiy, 0…1) — tokka deyarli proporsional. */
export const glow = (L, I) => Math.min(1, I / 20);

/* ---------------- Spektrometr */
/** m-tartib maksimum burchagi, gradus (yo‘q bo‘lsa null). */
export function thetaOf(nm, m = 1) { const s = (m * nm) / D_NM; return Math.abs(s) < 1 ? (Math.asin(s) * 180) / Math.PI : null; }
/** Spektral zichlik (nisbiy) — Gauss, FWHM = fw. */
export const spec = (L, nm) => Math.exp(-4 * Math.LN2 * ((nm - L.nm) / L.fw) ** 2);
/** Ko‘rish trubasi burchagi φ da (gradus) ko‘rinadigan yorug‘lik: [{nm, I, m}] (1- va 2-tartiblar). */
export function seenAt(L, phiDeg) {
  const s = Math.sin((phiDeg * Math.PI) / 180), out = [];
  for (const [m, eff] of [[1, 1], [2, 0.28]]) { const nm = (D_NM * s) / m; if (nm > 300) out.push({ nm, m, I: eff * spec(L, nm) }); }
  return out;
}
/** λ, nm (380…780) → [r, g, b] 0…255 (taxminiy ko‘rinadigan rang). */
export function nmRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; } else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else if (nm <= 780) r = 1;
  const f = nm < 380 || nm > 780 ? 0 : nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  return [r, g, b].map((v) => Math.round(255 * (v * f) ** 0.8));
}
