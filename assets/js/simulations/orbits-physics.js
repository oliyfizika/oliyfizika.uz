// ==========================================================================
// Orbitalar va kosmik tezliklar — fizika (DOM'siz; simulations/orbits.html). Birliklar: km, s.
// Gravitatsiya: a = −GM r/r³. Birinchi kosmik tezlik v₁ = √(GM/r) = √(gR) (doiraviy orbita),
// ikkinchi kosmik tezlik v₂ = √(2GM/r) = √2·v₁ (parabolik — sayyoradan uzoqlashib ketadi).
// Gorizontal otishda otish nuqtasi apsis bo'ladi; ikkinchi apsis r' = r·k/(2 − k), k = rv²/GM.
// Doiraviy orbita davri T = 2π√(r³/GM); geostatsionar orbita: T = 1 yulduz sutka.
// ==========================================================================

export const PLANETS = {
  earth: { name: "Yer", GM: 398600.4, R: 6371, day: 86164, color: ["#60a5fa", "#1d4ed8", "#16a34a"] },
  moon: { name: "Oy", GM: 4904.87, R: 1737.4, day: 2360592, color: ["#e5e7eb", "#9ca3af", "#6b7280"] },
  mars: { name: "Mars", GM: 42828.4, R: 3389.5, day: 88643, color: ["#fdba74", "#c2410c", "#7c2d12"] },
  jupiter: { name: "Yupiter", GM: 126686534, R: 69911, day: 35730, color: ["#fde68a", "#d97706", "#92400e"] },
};

export const v1 = (p, h = 0) => Math.sqrt(p.GM / (p.R + h));
export const v2 = (p, h = 0) => Math.sqrt((2 * p.GM) / (p.R + h));
/** Sirtdagi erkin tushish tezlanishi, m/s² */
export const gSurf = (p) => (p.GM / (p.R * p.R)) * 1000;
/** Doiraviy orbita davri, s */
export const period = (p, h) => 2 * Math.PI * Math.sqrt((p.R + h) ** 3 / p.GM);
/** Davri T bo'lgan doiraviy orbita balandligi, km */
export const altitudeForPeriod = (p, T) => Math.cbrt((p.GM * T * T) / (4 * Math.PI * Math.PI)) - p.R;

/** Gorizontal otish (r₀ = R + h₀ masofadan, v tezlik bilan) natijasi */
export function launch(p, v, h0 = 0) {
  const r0 = p.R + h0, k = (r0 * v * v) / p.GM, eps = (v * v) / 2 - p.GM / r0, e = Math.abs(k - 1);
  if (k >= 2 - 1e-9) return { type: k > 2 + 1e-6 ? "hyper" : "para", k, e, eps, rp: r0, ra: Infinity };
  const r2 = (r0 * k) / (2 - k);
  if (Math.abs(k - 1) < 1e-6) return { type: "circle", k, e: 0, eps, rp: r0, ra: r0 };
  if (k < 1) return { type: r2 < p.R ? "fall" : "ellipse", k, e, eps, rp: r2, ra: r0 };
  return { type: "ellipse", k, e, eps, rp: r0, ra: r2 };
}
/** Elliptik orbita davri (katta yarim o'q a orqali) */
export const periodA = (p, a) => 2 * Math.PI * Math.sqrt(a ** 3 / p.GM);

/** RK4 qadam: s = { x, y, vx, vy } */
export function step(s, GM, dt) {
  const f = (x, y) => { const r3 = Math.hypot(x, y) ** 3; return [(-GM * x) / r3, (-GM * y) / r3]; };
  const [a1x, a1y] = f(s.x, s.y);
  const [a2x, a2y] = f(s.x + (s.vx * dt) / 2, s.y + (s.vy * dt) / 2);
  const v2x = s.vx + (a1x * dt) / 2, v2y = s.vy + (a1y * dt) / 2;
  const [a3x, a3y] = f(s.x + (v2x * dt) / 2, s.y + (v2y * dt) / 2);
  const v3x = s.vx + (a2x * dt) / 2, v3y = s.vy + (a2y * dt) / 2;
  const [a4x, a4y] = f(s.x + v3x * dt, s.y + v3y * dt);
  const v4x = s.vx + a3x * dt, v4y = s.vy + a3y * dt;
  s.x += (dt / 6) * (s.vx + 2 * v2x + 2 * v3x + v4x);
  s.y += (dt / 6) * (s.vy + 2 * v2y + 2 * v3y + v4y);
  s.vx += (dt / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
  s.vy += (dt / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
  return s;
}
export const energy = (s, GM) => (s.vx * s.vx + s.vy * s.vy) / 2 - GM / Math.hypot(s.x, s.y);

/** Sirt bo'ylab masofa (yerga tushgan nuqtagacha yoy), km — integratsiya bilan */
export function flight(p, v, h0 = 0, tMax = 4e5, dt = 2) {
  const s = { x: 0, y: p.R + h0, vx: v, vy: 0 }; let t = 0;
  while (t < tMax) { step(s, p.GM, dt); t += dt; if (Math.hypot(s.x, s.y) < p.R) break; }
  const ang = Math.atan2(s.x, s.y); return { t, arc: p.R * (ang < 0 ? ang + 2 * Math.PI : ang), landed: Math.hypot(s.x, s.y) < p.R };
}
