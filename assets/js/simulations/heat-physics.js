// ==========================================================================
// Issiqlik almashinuvi — fizika (DOM'siz).
// Holat — solishtirma entalpiya h (J/kg), nol nuqta: erish temperaturasidagi qattiq modda.
//   kristall modda:  h ≤ 0 — qattiq: T = Tm + h/cs;   0 < h < λ — erish (T = Tm);
//                    λ ≤ h ≤ hb — suyuq: T = Tm + (h − λ)/cl;   hb < h < hb + L — qaynash (T = Tb);
//                    h ≥ hb + L — bug': T = Tb + (h − hb − L)/cg,   hb = λ + cl(Tb − Tm).
//   amorf modda (mum): erish oralig'i [T1, T2] da issiqlik sig'imi silliq ortadi — maydoncha (plato) yo'q.
// Issiqlik muvozanati: Σ m_i (h_i(θ) − h_i0) = 0 (yo'qotishsiz). θ bisektsiya bilan topiladi,
// maydonchadagi energiya (masalan, muzning bir qismi erishi) alohida taqsimlanadi.
// Dinamika: jismlar aralashma orqali issiqlik almashadi (Nyuton qonuni), entalpiya bo'yicha integrallanadi.
// Qiymatlar — maktab darsliklari jadvallari (20 °C, normal bosim).
// ==========================================================================

/** Moddalar: c — J/(kg·°C), λ va L — J/kg, temperaturalar — °C. */
export const SUBSTANCES = {
  water:     { name: "Suv (muz, bug‘)", short: "Suv", solidName: "Muz", cs: 2100, cl: 4200, cg: 2000, tm: 0, lambda: 3.4e5, tb: 100, L: 2.3e6, rho: 1000, color: "#3b82f6" },
  alcohol:   { name: "Spirt", short: "Spirt", cs: 2400, cl: 2500, cg: 1500, tm: -114, lambda: 1.1e5, tb: 78, L: 9.0e5, rho: 800, color: "#a855f7" },
  aluminium: { name: "Alyuminiy", short: "Alyuminiy", cs: 920, cl: 1180, cg: 1000, tm: 660, lambda: 3.9e5, tb: 2470, L: 1.1e7, rho: 2700, color: "#94a3b8", metal: true },
  iron:      { name: "Temir", short: "Temir", cs: 460, cl: 820, cg: 800, tm: 1539, lambda: 2.7e5, tb: 2860, L: 6.3e6, rho: 7800, color: "#64748b", metal: true },
  copper:    { name: "Mis", short: "Mis", cs: 400, cl: 490, cg: 500, tm: 1085, lambda: 2.1e5, tb: 2567, L: 4.8e6, rho: 8900, color: "#c2410c", metal: true },
  brass:     { name: "Latun", short: "Latun", cs: 380, cl: 450, cg: 450, tm: 1000, lambda: 1.6e5, tb: 1500, L: 4.0e6, rho: 8500, color: "#ca8a04", metal: true },
  lead:      { name: "Qo‘rg‘oshin", short: "Qo‘rg‘oshin", cs: 140, cl: 140, cg: 150, tm: 327, lambda: 2.5e4, tb: 1740, L: 8.6e5, rho: 11300, color: "#475569", metal: true },
  tin:       { name: "Qalay", short: "Qalay", cs: 230, cl: 250, cg: 250, tm: 232, lambda: 5.9e4, tb: 2600, L: 2.5e6, rho: 7300, color: "#9ca3af", metal: true },
  naphthalene: { name: "Naftalin", short: "Naftalin", cs: 1300, cl: 1700, cg: 1500, tm: 80, lambda: 1.5e5, tb: 218, L: 3.4e5, rho: 1150, color: "#e5e7eb" },
  wax:       { name: "Mum (amorf)", short: "Mum", cs: 2900, cl: 2900, cg: 2900, tm: 40, t2: 70, lambda: 1.5e5, tb: Infinity, L: 0, rho: 900, color: "#fbbf24", amorphous: true },
};

/** Yoqilg'ilarning solishtirma yonish issiqligi q (J/kg). */
export const FUELS = {
  alcohol:  { name: "Spirt", q: 2.7e7 },
  petrol:   { name: "Benzin", q: 4.6e7 },
  kerosene: { name: "Kerosin", q: 4.6e7 },
  gas:      { name: "Tabiiy gaz", q: 4.4e7 },
  coal:     { name: "Toshko‘mir", q: 2.7e7 },
  wood:     { name: "O‘tin (quruq)", q: 1.0e7 },
  hydrogen: { name: "Vodorod", q: 1.2e8 },
};

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const hb = (s) => s.lambda + s.cl * (s.tb - s.tm);

/** h(T) — pastki tarmoq: T erish/qaynash temperaturasiga teng bo'lsa, maydoncha boshi qaytariladi. */
export function hOf(s, T) {
  if (s.amorphous) {
    if (T <= s.tm) return s.cs * (T - s.tm);
    if (T >= s.t2) return s.cs * (s.t2 - s.tm) + s.lambda + s.cl * (T - s.t2);
    return s.cs * (T - s.tm) + s.lambda * smooth((T - s.tm) / (s.t2 - s.tm));
  }
  if (T <= s.tm) return s.cs * (T - s.tm);
  if (T <= s.tb) return s.lambda + s.cl * (T - s.tm);
  return hb(s) + s.L + s.cg * (T - s.tb);
}

/** T = T(h). */
export function TOf(s, h) {
  if (s.amorphous) {
    if (h <= 0) return s.tm + h / s.cs;
    const hTop = s.cs * (s.t2 - s.tm) + s.lambda;
    if (h >= hTop) return s.t2 + (h - hTop) / s.cl;
    let lo = s.tm, hi = s.t2;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (hOf(s, m) < h) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  if (h <= 0) return s.tm + h / s.cs;
  if (h < s.lambda) return s.tm;
  const b = hb(s);
  if (h <= b) return s.tm + (h - s.lambda) / s.cl;
  if (h < b + s.L) return s.tb;
  return s.tb + (h - b - s.L) / s.cg;
}

/** Agregat holati: phase — solid | melting | liquid | boiling | gas | soft (amorf yumshash); liquid — suyuq ulush, vapor — bug' ulushi. */
export function phaseOf(s, h) {
  if (s.amorphous) {
    const T = TOf(s, h);
    if (T <= s.tm) return { phase: "solid", liquid: 0, vapor: 0 };
    if (T >= s.t2) return { phase: "liquid", liquid: 1, vapor: 0 };
    return { phase: "soft", liquid: smooth((T - s.tm) / (s.t2 - s.tm)), vapor: 0 };
  }
  if (h <= 0) return { phase: "solid", liquid: 0, vapor: 0 };
  if (h < s.lambda) return { phase: "melting", liquid: h / s.lambda, vapor: 0 };
  const b = hb(s);
  if (h <= b) return { phase: "liquid", liquid: 1, vapor: 0 };
  if (h < b + s.L) return { phase: "boiling", liquid: 1 - (h - b) / s.L, vapor: (h - b) / s.L };
  return { phase: "gas", liquid: 0, vapor: 1 };
}

/** Muayyan T dagi maydoncha kengligi (J/kg): erish yoki qaynash temperaturasiga to'g'ri kelsa. */
function plateauAt(s, T, eps = 1e-9) {
  if (s.amorphous) return 0;
  if (Math.abs(T - s.tm) < eps) return s.lambda;
  if (Math.abs(T - s.tb) < eps) return s.L;
  return 0;
}

export const PHASE_NAMES = { solid: "qattiq", melting: "erimoqda", liquid: "suyuq", boiling: "qaynamoqda", gas: "bug‘ (gaz)", soft: "yumshamoqda" };

/**
 * Issiqlik muvozanati (yo'qotishsiz). bodies: [{ s (modda), m (kg), h0 (J/kg) }].
 * Qaytaradi: { T, h: [yakuniy h_i], plateau: bool } — Σ m_i (h_i − h0_i) = 0.
 */
export function equilibrium(bodies) {
  if (!bodies.length) return null;
  const F = (T) => bodies.reduce((a, b) => a + b.m * (hOf(b.s, T) - b.h0), 0);
  const Ts = bodies.map((b) => TOf(b.s, b.h0));
  let lo = Math.min(...Ts) - 1, hi = Math.max(...Ts) + 1;
  // eng katta T: F(T) ≤ 0
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (F(m) <= 0) lo = m; else hi = m; }
  let T = lo;
  // Maydoncha temperaturasiga yaqin bo'lsa — aniq qiymatga tortamiz
  const cands = new Set();
  bodies.forEach((b) => { if (!b.s.amorphous) { cands.add(b.s.tm); if (Number.isFinite(b.s.tb)) cands.add(b.s.tb); } });
  for (const c of cands) if (Math.abs(T - c) < 1e-6) T = c;
  let deficit = -F(T); // maydonchalarga taqsimlanadigan energiya (J)
  const widths = bodies.map((b) => b.m * plateauAt(b.s, T));
  const W = widths.reduce((a, x) => a + x, 0);
  const h = bodies.map((b) => hOf(b.s, T));
  let plateau = false;
  if (W > 0 && deficit > 1e-9) {
    plateau = true;
    const f = Math.min(1, deficit / W);
    bodies.forEach((b, i) => { if (widths[i] > 0) h[i] += f * plateauAt(b.s, T); });
    deficit -= f * W;
  }
  return { T, h, plateau };
}

/**
 * Kalorimetr dinamikasi. bodies: [{ s, m, h, K }] (K — aralashmaga issiqlik o'tkazuvchanlik, W/°C).
 * env: { G (W/°C), T (°C), idx (atrof-muhit bilan almashuvchi jism indekslari) }. dt — s. h joyida yangilanadi.
 * Qaytaradi: atrof-muhitga ketgan issiqlik (J).
 */
export function stepMix(bodies, dt, env = null) {
  const n = bodies.length;
  if (!n) return 0;
  const T = bodies.map((b) => TOf(b.s, b.h));
  const Ksum = bodies.reduce((a, b) => a + b.K, 0);
  // Aralashma temperaturasi (o'tkazuvchanlik bo'yicha o'rtacha) — har bir jism shu tugun bilan almashadi
  const Tmix = bodies.reduce((a, b, i) => a + b.K * T[i], 0) / Ksum;
  let lost = 0;
  bodies.forEach((b, i) => {
    let P = b.K * (Tmix - T[i]);
    if (env && env.G > 0 && env.idx.includes(i)) { const pl = env.G * (T[i] - env.T); P -= pl; lost += pl * dt; }
    b.h += (P * dt) / b.m;
  });
  return lost;
}

/** Barqaror qadam: issiqlik sig'imi va o'tkazuvchanlik bo'yicha. */
export function stableDt(bodies) {
  const Ksum = bodies.reduce((a, b) => a + b.K, 0);
  let dt = 1;
  bodies.forEach((b) => {
    const c = Math.min(b.s.cs, b.s.cl, b.s.cg || b.s.cl);
    const Keff = b.K * (1 - b.K / Ksum) + 1e-9;
    dt = Math.min(dt, (0.4 * b.m * c) / Keff);
  });
  return dt;
}

/** Isitish (bitta jism): P — isitgich foydali quvvati (W), loss — { G, T } atrofga yo'qotish. */
export function stepHeat(body, P, dt, loss = null) {
  const T = TOf(body.s, body.h);
  const Pl = loss && loss.G > 0 ? loss.G * (T - loss.T) : 0;
  body.h += ((P - Pl) * dt) / body.m;
  return Pl * dt;
}

/** Bosqichlar bo'yicha issiqlik: h0 → h oralig'ida har bir bo'lakka (qattiqni isitish, erish, suyuqni isitish, qaynash, bug'ni isitish) sarflangan Q (J). */
export function stageHeats(s, m, h0, h) {
  if (s.amorphous) {
    const top = s.cs * (s.t2 - s.tm) + s.lambda;
    const seg = [[-Infinity, 0], [0, top], [top, Infinity]];
    const q = seg.map(([a, b]) => m * (Math.min(Math.max(h, a), b) - Math.min(Math.max(h0, a), b)));
    return { heatSolid: q[0], melt: q[1], heatLiquid: q[2], boil: 0, heatGas: 0 };
  }
  const b = hb(s);
  const seg = [[-Infinity, 0], [0, s.lambda], [s.lambda, b], [b, b + s.L], [b + s.L, Infinity]];
  const q = seg.map(([a, c]) => m * (Math.min(Math.max(h, a), c) - Math.min(Math.max(h0, a), c)));
  return { heatSolid: q[0], melt: q[1], heatLiquid: q[2], boil: q[3], heatGas: q[4] };
}

/** Maktab formulasi bo'yicha kalorimetrdan solishtirma issiqlik sig'imi: c_x = Σ c_j m_j (θ − t_j) / (m_x (t_x − θ)). */
export function measuredC(mx, tx, theta, others) {
  const gained = others.reduce((a, o) => a + o.c * o.m * (theta - o.t), 0);
  return gained / (mx * (tx - theta));
}
