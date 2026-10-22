// ==========================================================================
// LED laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-topshiriq: difraksion panjara bilan λ = d·sin φ / m.
// 2-topshiriq: VAX ning chiziqli qismidagi ikki nuqta orqali bo‘sag‘a U₀ = U₁ − I₁(U₂ − U₁)/(I₂ − I₁);
//              eU₀ = hc/λ → EKK: U₀ = (h/e)·ν + b → h; har bir diod uchun h_i = eU₀λ/c.
// ==========================================================================

import { QE, C, D_NM, LEDS, ledById, ledI, thetaOf } from "./led-physics.js";
import { lfit } from "./photo-lab.js";

/* 1-topshiriq */
export function check1(r) {
  const L = ledById(r.led); if (!L) return { ok: false, err: "diodni tanlang" };
  if (!Number.isFinite(r.phi)) return { ok: false, err: "φ kiritilmagan" };
  if (r.phi <= 0 || r.phi >= 90) return { ok: false, err: "φ 0…90°" };
  if (![1, 2].includes(r.m)) return { ok: false, err: "m = 1 yoki 2" };
  return { ok: true };
}
export const lamOf = (phi, m) => (D_NM * Math.sin((phi * Math.PI) / 180)) / m;
export function analyze1(rows) {
  const R = rows.map((r) => ({ ...r, L: ledById(r.led), lam: lamOf(r.phi, r.m) }));
  const by = {}; R.forEach((r) => (by[r.led] ||= []).push(r.lam));
  const lam = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.reduce((s, x) => s + x, 0) / v.length]));
  return { rows: R, lam, ok: Object.keys(lam).length >= 3 };
}
/** Spektrometr: φ chiziq markazidan ±0,3° ichida. */
export function match1(r, tol = 0.3) { const L = ledById(r.led), t = L && thetaOf(L.nm, r.m); return t !== null && t !== undefined && Math.abs(t - r.phi) <= tol; }

/* 2-topshiriq */
export function check2(r) {
  if (!ledById(r.led)) return { ok: false, err: "diodni tanlang" };
  if (![r.U1, r.I1, r.U2, r.I2].every(Number.isFinite)) return { ok: false, err: "4 ta qiymat kerak" };
  if (r.U1 <= 0 || r.U2 <= 0 || r.U1 > 5 || r.U2 > 5) return { ok: false, err: "U 0…5 V" };
  if (!(r.U2 > r.U1) || !(r.I2 > r.I1)) return { ok: false, err: "U₂ > U₁, I₂ > I₁ bo‘lsin" };
  if (r.I1 < 3) return { ok: false, err: "chiziqli qism: I₁ ≥ 3 mA" };
  if (r.I2 - r.I1 < 3) return { ok: false, err: "I₂ − I₁ ≥ 3 mA bo‘lsin" };
  return { ok: true };
}
export const U0of = (r) => r.U1 - (r.I1 * (r.U2 - r.U1)) / (r.I2 - r.I1);
/** lamMeas — 1-topshiriqda o‘lchangan λ (nm) {led: λ}; bo‘lmasa pasport qiymati. */
export function analyze2(rows, lamMeas = {}) {
  const R = rows.map((r) => {
    const L = ledById(r.led), meas = Number.isFinite(lamMeas[r.led]), lam = meas ? lamMeas[r.led] : L.nm, U0 = U0of(r), nu = C / (lam * 1e-9);
    return { ...r, L, lam, meas, U0, nu, nu14: nu / 1e14, hi: (QE * U0 * lam * 1e-9) / C };
  });
  const out = { rows: R, ok: new Set(R.map((r) => r.led)).size >= 3 };
  const f = lfit(R.map((r) => r.nu), R.map((r) => r.U0));
  if (f) { out.fit = f; out.h = f.b * QE; out.sh = f.sb * QE; }
  if (R.length) { const hs = R.map((r) => r.hi), m = hs.reduce((s, v) => s + v, 0) / hs.length; out.hm = m; out.hsd = hs.length > 1 ? Math.sqrt(hs.reduce((s, v) => s + (v - m) ** 2, 0) / (hs.length - 1)) : 0; }
  return out;
}
/** Har ikkala nuqta qurilmadagi VAX ustida (tok ±2 % yoki kuchlanish ±3 mV). */
export function match2(r) {
  const L = ledById(r.led); if (!L) return false;
  const Uinv = (I) => { let lo = 0, hi = 5; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (ledI(L, m) > I) hi = m; else lo = m; } return (lo + hi) / 2; };
  const near = (U, I) => { const t = ledI(L, U); return Math.abs(t - I) <= Math.max(0.02 * t, 0.05) || Math.abs(Uinv(I) - U) <= 0.003; };
  return near(r.U1, r.I1) && near(r.U2, r.I2);
}
export { LEDS };
