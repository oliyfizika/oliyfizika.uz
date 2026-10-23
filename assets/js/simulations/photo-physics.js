// ==========================================================================
// Fotoeffekt — fizika (DOM'siz). Eynshteyn tenglamasi: hν = W + eU_t.
// Simob lampasi spektral chiziqlari interferension filtrlar bilan ajratiladi; fotoelement katodidan chiqqan
// fotoelektronlarning kinetik energiyalari 0…K_max oralig‘ida taqsimlangan (f ~ K(K_max − K)), tormozlovchi
// kuchlanishda ulushi F(x) = 1 − 3x² + 2x³, x = e|U|/K_max (issiqlik yoyilishi kT bilan silliqlangan).
// To‘yinish toki yorug‘lik oqimiga proporsional; anoddan juda kichik teskari tok bor (real fotoelementdagidek).
// ==========================================================================

export const H = 6.62607015e-34, QE = 1.602176634e-19, C = 2.99792458e8;
export const LINES = [
  { id: "365", nm: 365.02, name: "365 nm (UB)", color: "#7c3aed", L: 1.0 },
  { id: "405", nm: 404.66, name: "405 nm (binafsha)", color: "#8b5cf6", L: 0.6 },
  { id: "436", nm: 435.83, name: "436 nm (ko‘k)", color: "#3b82f6", L: 1.0 },
  { id: "546", nm: 546.07, name: "546 nm (yashil)", color: "#22c55e", L: 1.0 },
  { id: "577", nm: 576.96, name: "577 nm (sariq)", color: "#eab308", L: 0.8 },
];
export const lineById = (id) => LINES.find((l) => l.id === String(id));
export const CATHODES = { Cs: { id: "Cs", name: "Seziy (Cs)", W: 2.14 }, K: { id: "K", name: "Kaliy (K)", W: 2.3 }, Na: { id: "Na", name: "Natriy (Na)", W: 2.36 } };
export const nu = (nm) => C / (nm * 1e-9); // Hz
export const photonEv = (nm) => (H * nu(nm)) / QE;
/** Nazariy tormozlovchi kuchlanish, V (fotoeffekt bo‘lmasa 0). */
export const stopV = (nm, W) => Math.max(0, photonEv(nm) - W);
export const KT = 0.026; // eV
export const U_RANGE = [-3, 12];

/** To‘yinish toki, nA. s = {line, cath, inten (0..100)} */
export function iSat({ line, cath, inten }) {
  const L = lineById(line), W = CATHODES[cath].W, ex = photonEv(L.nm) - W;
  if (ex <= -3 * KT) return 0;
  const exs = KT * Math.log1p(Math.exp(ex / KT)); // bo‘sag‘a yonida silliq
  return 25 * (inten / 100) * L.L * Math.min(1, exs / 0.8) ** 1.5;
}
/** Anod toki, nA. U — anod kuchlanishi (manfiy — tormozlovchi). */
export function current(U, s) {
  const L = lineById(s.line), W = CATHODES[s.cath].W, K = photonEv(L.nm) - W, Is = iSat(s);
  // yig‘ish samaradorligi g(U): U ≥ 0 da to‘yinishga intiladi, U < 0 da silliq davom etadi (U = 0 da hosila uzluksiz)
  const g = U >= 0 ? 1 - 0.4 * Math.exp(-U / 2) : 0.6 * Math.exp(U / 3);
  let I;
  if (U >= 0) I = Is * g;
  else {
    let f = 0;
    for (let k = -3; k <= 3; k++) { const Kk = K + (k * KT) / 4, wt = Math.exp(-(k * k) / 4); if (Kk > 0) { const x = Math.min(1, -U / Kk); f += wt * (1 - 3 * x * x + 2 * x * x * x); } }
    let ws = 0; for (let k = -3; k <= 3; k++) ws += Math.exp(-(k * k) / 4);
    I = Is * g * (f / ws);
  }
  const rev = U < 0 ? (0.0006 * Is + 0.00001 * s.inten * L.L) * (1 - Math.exp(U / 0.4)) : 0; // anoddan teskari fototok (sochilgan yorug‘lik)
  return I - rev;
}
/** Asbob «nol tok» nuqtasi (I = 0 bo‘ladigan U, V, musbat son sifatida). */
export function zeroCross(s) {
  if (iSat(s) < 0.02) return null; // fotoeffekt yo‘q
  let a = -U_RANGE[0], lo = 0, hi = a;
  if (current(-hi, s) > 0) return null;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (current(-m, s) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
