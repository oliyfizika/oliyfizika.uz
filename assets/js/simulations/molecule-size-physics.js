// ==========================================================================
// Molekula o'lchamini baholash — fizika (DOM'siz; simulations/molecule-size.html).
// Olein kislotasining spirtdagi eritmasi (1 : k) suv sirtiga tomiziladi: spirt eriydi, kislota esa
// bir molekula qalinlikdagi parda (monoqatlam) bo'lib yoyiladi. Parda qalinligi = molekula o'lchami:
//   d = V/S,  V = n·V₀/k — dog'dagi kislota hajmi (n tomchi, V₀ — bir tomchi hajmi), S — dog' yuzi.
// V₀ menzurkaga tomchilarni sanab topiladi: V₀ = V_menzurka/N. S katakli qog'ozdagi kataklar bilan:
//   S ≈ (to'liq kataklar + chala kataklar/2)·1 sm².
// Birliklar: uzunlik sm, hajm ml (= sm³), qalinlik nm.
// ==========================================================================

export const D0 = 1.2;            // olein kislotasi monoqatlamining qalinligi, nm (≈ 1,1…1,3 nm)
export const TRAY = { w: 40, h: 30 }; // vanna, sm
export const CONCS = [500, 1000, 2000];

/** Dog' yuzi, sm²: V (ml = sm³) kislota, d (nm) */
export const spotArea = (V, d = D0) => V / (d * 1e-7);
/** Parda qalinligi, nm */
export const thickness = (V, S) => (V / S) * 1e7;
/** n tomchidagi kislota hajmi, ml */
export const acidVolume = (n, V0, k) => (n * V0) / k;

/** Dog' chegarasi: r(θ) = R·(1 + Σ aᵢ sin(mᵢθ + φᵢ)); R yuz aniq S bo'ladigan qilib tanlanadi */
const MODES = [[2, 0.05], [3, 0.07], [5, 0.035], [7, 0.02]];
export function spotShape(S, seed = 1) {
  const ph = MODES.map((_, i) => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) * Math.PI);
  const k = 1 + 0.5 * MODES.reduce((s, [, a]) => s + a * a, 0), R = Math.sqrt(S / (Math.PI * k));
  const r = (th) => R * (1 + MODES.reduce((s, [m, a], i) => s + a * Math.sin(m * th + ph[i]), 0));
  return { R, r, S };
}
/** Nuqta dog' ichidami (markaz cx, cy dan) */
export function inside(sh, cx, cy, x, y) { const dx = x - cx, dy = y - cy, rr = Math.hypot(dx, dy); return rr <= sh.r(Math.atan2(dy, dx)); }

/** 1 sm li kataklar bo'yicha sanash: to'liq va chala kataklar */
export function gridCount(sh, cx, cy, cell = 1, n = 6) {
  let full = 0, part = 0; const cells = [];
  const R = sh.R * 1.25, i0 = Math.floor((cx - R) / cell), i1 = Math.ceil((cx + R) / cell), j0 = Math.floor((cy - R) / cell), j1 = Math.ceil((cy + R) / cell);
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    let inn = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (inside(sh, cx, cy, (i + (a + 0.5) / n) * cell, (j + (b + 0.5) / n) * cell)) inn++;
    if (inn === n * n) { full++; cells.push([i, j, 2]); } else if (inn > 0) { part++; cells.push([i, j, 1]); }
  }
  return { full, part, S: (full + part / 2) * cell * cell, cells };
}

/** Eng kichik kvadratlar: koordinata boshidan o'tuvchi to'g'ri chiziq S = V/d qiyaligi */
export function fitThroughOrigin(pts) {
  let sxx = 0, sxy = 0; for (const [x, y] of pts) { sxx += x * x; sxy += x * y; }
  return sxx > 0 ? sxy / sxx : NaN;
}
