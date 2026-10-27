// ==========================================================================
// Qattiq jism deformatsiyasi — fizika (DOM'siz; simulations/deformation.html).
// Mexanik kuchlanish σ = F/S, nisbiy uzayish ε = Δl/l₀, Guk qonuni σ = Eε (proporsionallik chegarasigacha).
// Cho'zilish diagrammasi σ(ε): elastik qism → oquvchanlik (po'latda «maydoncha») → mustahkamlanish →
// mustahkamlik chegarasi σₘ (bo'yin hosil bo'ladi) → uzilish. Mo'rt material (cho'yan) deyarli plastik
// deformatsiyasiz uziladi. Yuksizlantirish — qiyaligi E bo'lgan to'g'ri chiziq bo'ylab, qoldiq deformatsiya qoladi;
// qayta yuklashda elastiklik chegarasi oshadi (naklyop).
// Sim (yoki sterjen) bikrligi k = ES/l₀.
// ==========================================================================

export const G = 9.81;

/** Materiallar (o'quv maqsadida tanlangan odatiy qiymatlar, SI) */
export const MATERIALS = {
  steel: { name: "po‘lat", full: "Po‘lat (St3)", E: 200e9, sp: 200e6, sy: 240e6, su: 400e6, eh: 0.015, eu: 0.2, ef: 0.27, sf: 300e6, plateau: true, color: ["#e2e8f0", "#64748b", "#334155"] },
  copper: { name: "mis", full: "Mis (yumshatilgan)", E: 110e9, sp: 40e6, su: 220e6, eu: 0.35, ef: 0.45, sf: 165e6, color: ["#fed7aa", "#c2410c", "#7c2d12"] },
  alu: { name: "alyuminiy", full: "Alyuminiy", E: 70e9, sp: 60e6, su: 120e6, eu: 0.15, ef: 0.22, sf: 90e6, color: ["#f1f5f9", "#94a3b8", "#475569"] },
  iron: { name: "cho‘yan", full: "Cho‘yan (kulrang)", E: 110e9, su: 180e6, ef: 0.006, brittle: true, color: ["#d6d3d1", "#57534e", "#292524"] },
};

/** Ko'ndalang kesim yuzasi (diametr d, m) */
export const area = (d) => (Math.PI * d * d) / 4;
/** Bikrlik k = ES/l₀ */
export const stiffness = (E, S, L) => (E * S) / L;

/** Monoton yuklashdagi kuchlanish σ(ε), Pa (ε < ef) */
export function sigmaMono(m, e) {
  if (e <= 0) return m.E * e;
  if (m.brittle) { const k = (m.E * m.ef) / m.su, t = Math.min(1, e / m.ef); return m.su * (1 - (1 - t) ** k); }
  const ep = m.sp / m.E;
  if (e <= ep) return m.E * e;
  const x = e - ep;
  if (m.plateau) {
    const A = m.sy - m.sp, c1 = A / m.E, s1 = (z) => m.sp + A * (1 - Math.exp(-z / c1));
    if (e <= m.eh) return s1(x);
    const sh = s1(m.eh - ep);
    if (e <= m.eu) { const t = (e - m.eh) / (m.eu - m.eh); return sh + (m.su - sh) * (1 - (1 - t) ** 2); }
    return neck(m, e);
  }
  // mustahkamlanish: tez (ε dan silliq o'tish) + sekin had
  const B = 0.15 * (m.su - m.sp), c1 = B / m.E, c2 = (m.eu - ep) / 3;
  const A = (m.su - m.sp - B * (1 - Math.exp(-(m.eu - ep) / c1))) / (1 - Math.exp(-3));
  if (e <= m.eu) return m.sp + B * (1 - Math.exp(-x / c1)) + A * (1 - Math.exp(-x / c2));
  return neck(m, e);
}
function neck(m, e) { const t = Math.min(1, (e - m.eu) / (m.ef - m.eu)); return m.su - (m.su - m.sf) * t * t; }

/** Shartli oquvchanlik chegarasi σ₀,₂ (0,2 % qoldiq deformatsiya) */
export function yieldStrength(m) {
  if (m.brittle) return null;
  let lo = 0.002, hi = m.eu;
  for (let i = 0; i < 80; i++) { const e = (lo + hi) / 2; if (sigmaMono(m, e) > m.E * (e - 0.002)) lo = e; else hi = e; }
  return sigmaMono(m, (lo + hi) / 2);
}
/** Elastiklik chegarasi deb proporsionallik chegarasi olinadi (mo'rt materialda — yo'q) */
export const propLimit = (m) => (m.brittle ? null : m.sp);

/* ------------------------------------------------------------------ Namuna (yuklash tarixi bilan) */

export function createSample() { return { emax: 0, epl: 0, broken: false }; }
function touch(s, m, e) {
  if (s.broken) return;
  if (e >= m.ef) { s.emax = m.ef; s.epl = m.ef - (m.brittle ? m.su : m.sf) / m.E; s.broken = true; return; }
  if (e > s.emax) { s.emax = e; s.epl = Math.max(0, e - sigmaMono(m, e) / m.E); if (s.epl < 1e-7) s.epl = 0; }
}
/** Deformatsiya bilan boshqarish (cho'zish mashinasi): ε ni o'rnatadi va σ ni qaytaradi */
export function strainTo(s, m, e) {
  touch(s, m, Math.max(0, e));
  return stressAt(s, m, e);
}
/** Joriy holatda ε uchun σ (yuksizlantirish chizig'i yoki yuklash egri chizig'i) */
export function stressAt(s, m, e) {
  if (s.broken) return 0;
  if (e >= s.emax) return sigmaMono(m, e);
  return Math.max(0, m.E * (e - s.epl));
}
/** Namuna bo'shashib qoladigan (σ = 0) eng kichik ε — qoldiq deformatsiya */
export const residual = (s) => s.epl;

/** Kuch bilan boshqarish (simga yuk osish): σ berilgan → ε. σ > σₘ bo'lsa sim uziladi. */
export function strainFor(s, m, sigma) {
  if (s.broken) return s.emax;
  if (sigma <= 0) return s.epl;
  const sTop = s.emax > 0 ? sigmaMono(m, s.emax) : 0;
  if (sigma <= sTop) return s.epl + sigma / m.E;
  const eTop = m.brittle ? m.ef : m.eu;
  if (sigma >= m.su) { touch(s, m, m.ef); return s.emax; }
  let lo = s.emax, hi = eTop;
  for (let i = 0; i < 80; i++) { const e = (lo + hi) / 2; if (sigmaMono(m, e) < sigma) lo = e; else hi = e; }
  const e = (lo + hi) / 2; touch(s, m, e); return e;
}

/** Diagramma bosqichi (tushuntirish uchun) */
export function region(s, m, e) {
  if (s.broken) return "broken";
  if (e < s.emax - 1e-9) return e <= s.epl + 1e-9 ? "slack" : "unload";
  if (m.brittle) return e < 0.6 * m.ef ? "elastic" : "brittle";
  const ep = m.sp / m.E;
  if (e <= ep) return "elastic";
  if (m.plateau && e <= m.eh) return "yield";
  if (e <= m.eu) return "harden";
  return "neck";
}
