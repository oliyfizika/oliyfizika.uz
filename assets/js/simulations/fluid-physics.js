// ==========================================================================
// Suyuqlik va gaz harakati — fizika (DOM'siz, SI). Ideal (siqilmaydigan, qovushoqliksiz) oqim.
// Uzluksizlik Q = S·v, Bernulli p + ρv²/2 + ρgh = const, Venturi, Torichelli, Jukovskiy qanoti (potensial oqim,
// Kutta sharti, Kutta–Jukovskiy ko'tarish kuchi), purkagich.
// ==========================================================================

export const G = 9.81, RHO_W = 1000, RHO_AIR = 1.2;

export const area = (d) => (Math.PI * d * d) / 4;
export const speed = (Q, d) => Q / area(d);

/** Bernulli: kirishdagi (p1, v1, y1) dan x nuqtadagi bosim. */
export const bernoulliP = (p1, v1, y1, v, y, rho = RHO_W, g = G) => p1 + 0.5 * rho * (v1 * v1 - v * v) + rho * g * (y1 - y);
/** Venturi: ikki kesimdagi bosimlar farqidan kirish tezligi. */
export const venturiV1 = (dp, S1, S2, rho = RHO_W) => Math.sqrt((2 * dp) / (rho * ((S1 / S2) ** 2 - 1)));

/** Torichelli: chuqurlik H dan oqib chiqish tezligi va polgacha uchish masofasi (teshik balandligi y). */
export const torricelliV = (H, g = G) => Math.sqrt(2 * g * Math.max(0, H));
export const jetRange = (level, y) => 2 * Math.sqrt(Math.max(0, (level - y) * y));

/** Purkagich: havo oqimi tezligi v bo'lganda suyuqlik ko'tariladigan balandlik. */
export const sprayRise = (v, rhoAir = RHO_AIR, rhoL = RHO_W, g = G) => (rhoAir * v * v) / (2 * rhoL * g);

/* ------------------------------------------------------------------ Jukovskiy qanoti */

const cx = (re, im) => ({ re, im });
const add = (a, b) => cx(a.re + b.re, a.im + b.im), sub = (a, b) => cx(a.re - b.re, a.im - b.im);
const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const sqrtc = (a) => { const r = Math.hypot(a.re, a.im), t = Math.atan2(a.im, a.re) / 2, s = Math.sqrt(r); return cx(s * Math.cos(t), s * Math.sin(t)); };
const expi = (t) => cx(Math.cos(t), Math.sin(t));

/**
 * Jukovskiy profili: z = ζ + c²/ζ (c = 1), aylana markazi ζ₀ = (−m, n), u ζ = c dan o'tadi.
 * alpha — hujum burchagi (oqim x o'qi bo'ylab, profil −α ga burilgan holat ekvivalenti sifatida oqimni α ga buramiz).
 */
export function airfoil({ m = 0.1, n = 0.08, alpha = 0, V = 1 } = {}) {
  const c = 1, z0 = cx(-m, n), R = Math.hypot(c + m, n), beta = Math.asin(n / R);
  const Gam = 4 * Math.PI * V * R * Math.sin(alpha + beta); // Kutta sharti (soat strelkasiga — ko'tarish yuqoriga)
  const ea = expi(-alpha), eb = expi(alpha), R2 = R * R;
  /** ζ tekisligidagi kompleks tezlik w = u − iv. */
  const wz = (zeta) => { const d = sub(zeta, z0), a = sub(ea, mul(eb, div(cx(R2, 0), mul(d, d)))), circ = div(cx(0, Gam / (2 * Math.PI)), d); return add(mul(cx(V, 0), a), circ); };
  const toZ = (zeta) => add(zeta, div(cx(c * c, 0), zeta));
  /** z → ζ (aylanadan tashqaridagi ildiz). */
  const toZeta = (z) => { const s = sqrtc(sub(mul(z, z), cx(4 * c * c, 0))), a = cx((z.re + s.re) / 2, (z.im + s.im) / 2), b = cx((z.re - s.re) / 2, (z.im - s.im) / 2); return Math.hypot(a.re - z0.re, a.im - z0.im) >= Math.hypot(b.re - z0.re, b.im - z0.im) ? a : b; };
  /** z tekisligidagi tezlik [u, v] (profil ichida null). */
  function vel(x, y) {
    const zeta = toZeta(cx(x, y)); if (Math.hypot(zeta.re - z0.re, zeta.im - z0.im) < R * 1.0005) return null;
    const dz = sub(cx(1, 0), div(cx(c * c, 0), mul(zeta, zeta))); if (Math.hypot(dz.re, dz.im) < 1e-6) return [V * Math.cos(alpha), V * Math.sin(alpha)];
    const w = div(wz(zeta), dz); return [w.re, -w.im];
  }
  const outline = []; for (let i = 0; i <= 160; i++) { const t = (2 * Math.PI * i) / 160, z = toZ(add(z0, cx(R * Math.cos(t), R * Math.sin(t)))); outline.push([z.re, z.im]); }
  let xmin = Infinity, xmax = -Infinity; outline.forEach(([x]) => { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); });
  const chord = xmax - xmin, CL = (2 * Gam) / (V * chord);
  return { vel, outline, chord, Gam, CL, R, z0, beta, wz };
}
/** Ko'tarish kuchi (bir metr qanot uzunligiga): L' = ρVΓ = ½ρV²·b·C_L. */
export const liftPerSpan = (rho, V, chordM, CL) => 0.5 * rho * V * V * chordM * CL;
