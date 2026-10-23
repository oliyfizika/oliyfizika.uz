// ==========================================================================
// Vilson kamerasi — zarralar izlari (DOM'siz). Uzunliklar — mm, kamera markazi (0, 0), ko‘rinadigan radius 80 mm.
// α-zarralar: havoda yugurish yo‘li (Geyger qonuni) R = 3,18·E^{3/2} mm (E — MeV), fluktuatsiya ~1,2 %.
// β-zarralar: magnit maydonda aylana yoyi, r = p/(|q|B): r[mm] = p[MeV/c]/(0,3·B[T]); T = √(p²c² + m²c⁴) − mc².
// Kosmik myuonlar — deyarli to‘g‘ri ingichka izlar. Yoritilgan qatlamdan chiqib ketgan izlar xira va qisqa.
// ==========================================================================

export const VIEW = 80, SRC = { x: -72, y: 0 }, MALPHA = 3727.38, ME = 0.511;
/** Manba igna uchining joyi: α — chetda (uzun izlar), β — markazga yaqinroq (aylanalar to‘liq ko‘rinsin). */
export const srcPos = (id) => (SOURCES[id]?.kind === "b" ? { x: -40, y: 0 } : SRC);
export const geigerR = (E) => 3.18 * E ** 1.5; // mm
export const geigerE = (R) => (R / 3.18) ** (2 / 3); // MeV
export const SOURCES = {
  "Po-210": { kind: "a", name: "²¹⁰Po", lines: [[5.304, 1]] },
  "Am-241": { kind: "a", name: "²⁴¹Am", lines: [[5.486, 0.85], [5.443, 0.13], [5.388, 0.02]] },
  "Th-228": { kind: "a", name: "²²⁸Th (+ avlodlari)", lines: [[5.423, 1], [5.685, 1], [6.288, 1], [6.778, 1], [6.051, 0.36], [8.785, 0.64]] },
  "Sr-90": { kind: "b", name: "⁹⁰Sr/⁹⁰Y (β⁻)", q: -1, Q: [0.546, 2.28] },
  "Na-22": { kind: "b", name: "²²Na (β⁺)", q: 1, Q: [0.546] },
};
export const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export function gauss(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }
const pick = (R, lines) => { const s = lines.reduce((a, l) => a + l[1], 0); let x = R() * s; for (const l of lines) { x -= l[1]; if (x <= 0) return l[0]; } return lines.at(-1)[0]; };
export const pOfT = (T, m = ME) => Math.sqrt(T * (T + 2 * m)); // MeV/c
export const TofP = (p, m = ME) => Math.sqrt(p * p + m * m) - m;
export const rOfP = (p, B, z = 1) => (B > 0 ? p / (0.3 * z * B) : Infinity); // mm
/** β-spektr (ruxsat etilgan shakl, Fermi funksiyasisiz): N(T) ~ p·E·(Q − T)². */
export function sampleBeta(R, Q) { const W = Q + ME; let f = 0; for (let i = 0; i < 400; i++) { const T = R() * Q, E = T + ME, p = pOfT(T), v = p * E * (Q - T) ** 2, mx = pOfT(Q / 2) * (Q / 2 + ME) * (Q / 2) ** 2 * 1.7; if (R() * mx < v) return T; f = T; } void W; return f; }
const inside = (x, y) => Math.hypot(x, y) < VIEW - 1;

/** Yoy/chiziq bo‘ylab yo‘l: boshlang‘ich nuqta, yo‘nalish, egrilik k (1/mm, + — soat strelkasiga qarshi), uzunlik. */
function path(x, y, ang, k, len, step = 0.5) {
  const pts = [[x, y]]; let a = ang;
  for (let s = 0; s < len; s += step) { x += Math.cos(a) * step; y += Math.sin(a) * step; a += k * step; if (!inside(x, y)) return { pts, out: true }; pts.push([x, y]); }
  return { pts, out: false };
}
/** Bitta «surat» (kengaytirish) uchun izlar. B — T, dir = +1 (⊙, kuzatuvchi tomon) / −1 (⊗). */
export function expansion(R, srcId, B, dir, nextId) {
  const S = SOURCES[srcId], tracks = [], O = srcPos(srcId);
  const n = S.kind === "a" ? 4 + Math.floor(R() * 4) : 3 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const ang = (R() * 2 - 1) * 0.95;
    if (S.kind === "a") {
      const E = pick(R, S.lines), Rf = geigerR(E) * (1 + 0.012 * gauss(R)), p = Math.sqrt(2 * MALPHA * E), r = rOfP(p, B, 2), k = Number.isFinite(r) ? (dir * 1) / r : 0; // α musbat: v×B — ⊙ da soat strelkasi bo‘yicha
      const partial = R() < 0.25, vis = partial ? Rf * (0.35 + 0.5 * R()) : Rf, P = path(O.x, O.y, ang, -k, vis, 0.4);
      tracks.push({ id: nextId++, t: "a", E, R: Rf, Rvis: vis, partial, pts: P.pts });
    } else {
      const Q = S.Q[Math.floor(R() * S.Q.length)], T = Math.max(0.03, sampleBeta(R, Q)), p = pOfT(T), r = rOfP(p, B), k = Number.isFinite(r) ? (-S.q * dir) / r : 0; // q·v×B
      const len = Number.isFinite(r) ? Math.min(2 * Math.PI * r * 0.92, 260) : 260, P = path(O.x, O.y, (R() * 2 - 1) * Math.PI * 0.6, k, len, 0.5);
      tracks.push({ id: nextId++, t: "b", q: S.q, T, p, r, pts: P.pts });
    }
  }
  if (R() < 0.45) { // kosmik myuon
    const a = R() * Math.PI, d = (R() * 2 - 1) * 60, x0 = -Math.sin(a) * d - Math.cos(a) * 90, y0 = Math.cos(a) * d - Math.sin(a) * 90, pts = [];
    for (let s = 0; s < 180; s += 0.8) { const x = x0 + Math.cos(a) * s, y = y0 + Math.sin(a) * s; if (inside(x, y)) pts.push([x, y]); }
    if (pts.length > 10) tracks.push({ id: nextId++, t: "m", pts });
  }
  return { tracks, nextId };
}
/** 3 nuqta orqali aylana: {cx, cy, r} yoki null. */
export function circle3(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-9) return null;
  const s1 = a[0] ** 2 + a[1] ** 2, s2 = b[0] ** 2 + b[1] ** 2, s3 = c[0] ** 2 + c[1] ** 2;
  const cx = (s1 * (b[1] - c[1]) + s2 * (c[1] - a[1]) + s3 * (a[1] - b[1])) / d, cy = (s1 * (c[0] - b[0]) + s2 * (a[0] - c[0]) + s3 * (b[0] - a[0])) / d;
  return { cx, cy, r: Math.hypot(a[0] - cx, a[1] - cy) };
}
