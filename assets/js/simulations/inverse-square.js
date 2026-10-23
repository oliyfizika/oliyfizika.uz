// ==========================================================================
// 1/r² qonunlari — Kulon va Butun olam tortishish (DOM'siz, alohida tekshiriladi)
// ==========================================================================

export const K = 8.9875517923e9;   // N·m²/C²  (k = 1 / 4πε₀)
export const G = 6.674e-11;        // N·m²/kg²

/** Kulon: q (C), r (m), eps — muhitning dielektrik singdiruvchanligi. F < 0 — tortishish. */
export function coulomb(q1, q2, r, eps = 1) {
  const F = (K * q1 * q2) / (eps * r * r);
  return {
    F,
    Fabs: Math.abs(F),
    kind: q1 === 0 || q2 === 0 ? "none" : F < 0 ? "attract" : "repel",
    W: (K * q1 * q2) / (eps * r),          // o'zaro ta'sir potensial energiyasi, J
    E1at2: (K * Math.abs(q1)) / (eps * r * r), // q1 ning q2 joyidagi maydon kuchlanganligi, N/C
  };
}

/** Gravitatsiya: m (kg), r (m). */
export function gravity(m1, m2, r) {
  const F = (G * m1 * m2) / (r * r);
  return { F, a1: F / m1, a2: F / m2, W: -(G * m1 * m2) / r };
}

/**
 * Elektr maydon chiziqlari (ekran koordinatasida). charges: [{x, y, q, r}] (r — chizilgan radius, px)
 * Chiziqlar musbat zaryaddan chiqadi; manfiy zaryad "ortiqcha" bo'lsa, undan ham teskari yo'nalishda chiziladi.
 * Qaytaradi: [{ pts: [[x,y],...], dir: +1|-1 }]
 */
export function fieldLines(charges, bounds, { perUnit = 1.6, minLines = 6, step = 4, maxSteps = 700 } = {}) {
  const active = charges.filter((c) => c.q !== 0);
  if (!active.length) return [];
  const qMax = Math.max(...active.map((c) => Math.abs(c.q)));
  const posSum = active.filter((c) => c.q > 0).reduce((s, c) => s + c.q, 0);
  const negSum = active.filter((c) => c.q < 0).reduce((s, c) => s - c.q, 0);
  const E = (x, y) => {
    let ex = 0, ey = 0;
    for (const c of active) {
      const dx = x - c.x, dy = y - c.y;
      const d2 = dx * dx + dy * dy + 1e-6;
      const k = c.q / (d2 * Math.sqrt(d2));
      ex += k * dx; ey += k * dy;
    }
    return [ex, ey];
  };
  const out = [];
  for (const src of active) {
    const positive = src.q > 0;
    if (!positive && posSum >= negSum) continue;     // musbatlardan chiqqan chiziqlar yetarli
    const n = Math.max(minLines, Math.round(minLines + perUnit * 10 * (Math.abs(src.q) / qMax)));
    const sign = positive ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * (i + 0.5)) / n;
      let x = src.x + Math.cos(ang) * (src.r + 2);
      let y = src.y + Math.sin(ang) * (src.r + 2);
      const pts = [[x, y]];
      for (let s = 0; s < maxSteps; s++) {
        // RK2 (o'rta nuqta)
        let [ex, ey] = E(x, y);
        let m = Math.hypot(ex, ey) || 1;
        const mx = x + (sign * ex / m) * step * 0.5, my = y + (sign * ey / m) * step * 0.5;
        [ex, ey] = E(mx, my);
        m = Math.hypot(ex, ey) || 1;
        x += (sign * ex / m) * step;
        y += (sign * ey / m) * step;
        pts.push([x, y]);
        if (x < bounds.x0 - 40 || x > bounds.x1 + 40 || y < bounds.y0 - 40 || y > bounds.y1 + 40) break;
        if (active.some((c) => c !== src && Math.hypot(x - c.x, y - c.y) < c.r)) break;
      }
      out.push({ pts, dir: sign });
    }
  }
  return out;
}
