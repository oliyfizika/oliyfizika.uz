// ==========================================================================
// Og'irlik kuchi ta'sirida jism harakati — fizika (DOM'siz). Havo qarshiligi hisobga olinmaydi.
// p: { v0 (m/s), alpha (rad; −90°…90°, gorizontdan yuqoriga musbat), h0 (m), g (m/s²) }
//   x(t) = v0 cosα · t,   y(t) = h0 + v0 sinα · t − g t² / 2
//   vx = v0 cosα (o'zgarmas),   vy = v0 sinα − g t,   a = −g
// Maxsus hollar: α = 90° — vertikal yuqoriga otish; α = −90° — pastga otish; v0 = 0, α = −90° — erkin tushish.
// Energiya (massa birligiga): e = v²/2 + g y = const  (K = v²/2, U = g y).
// ==========================================================================

export function solve(p) {
  const vx = p.v0 * Math.cos(p.alpha);
  const vy = p.v0 * Math.sin(p.alpha);
  // y(T) = 0 → T = (vy + sqrt(vy² + 2 g h0)) / g   (h0 = 0 va vy ≤ 0 bo'lsa T = 0)
  const T = (vy + Math.sqrt(vy * vy + 2 * p.g * p.h0)) / p.g;
  const tTop = vy > 0 ? vy / p.g : 0;
  const H = p.h0 + (vy > 0 ? (vy * vy) / (2 * p.g) : 0);
  const L = vx * T;
  const vLand = Math.hypot(vx, vy - p.g * T);
  const landAngle = Math.atan2(p.g * T - vy, vx); // gorizontga nisbatan (pastga)
  const vertical = Math.abs(vx) < 1e-9;
  return { vx, vy, T, tTop, H, L, xTop: vx * tTop, vLand, landAngle, vertical };
}

export function stateAt(p, t) {
  const vx = p.v0 * Math.cos(p.alpha);
  const vy0 = p.v0 * Math.sin(p.alpha);
  return {
    x: vx * t,
    y: p.h0 + vy0 * t - 0.5 * p.g * t * t,
    vx,
    vy: vy0 - p.g * t,
  };
}

/** Massa birligiga to'g'ri keladigan energiyalar (J/kg): kinetik, potensial (yer sathidan) va to'liq. */
export function energiesAt(p, t) {
  const s = stateAt(p, t);
  const kin = 0.5 * (s.vx * s.vx + s.vy * s.vy);
  const pot = p.g * s.y;
  return { kin, pot, tot: kin + pot };
}

/** Chiroyli shkala qadami (1, 2, 5 · 10^n). */
export function niceStep(span, targetTicks = 6) {
  const raw = span / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}
