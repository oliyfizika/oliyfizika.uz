// ==========================================================================
// Termodinamika — fizika (DOM'siz). Birliklar: V — L (dm³), p — kPa, shunda p·V — J; T — K; S — J/K.
// Ideal gaz: pV = νRT, U = ν·(i/2)·R·T. Jarayonlar (izobarik, izoxorik, izotermik, adiabatik, p–V da to'g'ri chiziq),
// termodinamikaning 1-qonuni Q = ΔU + A (sonli integrallash bilan), sikllar (Karno, Otto, Dizel, ixtiyoriy),
// FIK, sovitgich va issiqlik nasosi koeffitsiyentlari, 4 taktli dvigatelning p(θ), V(θ).
// ==========================================================================

export const R = 8.314;

/** Gaz: i — erkinlik darajalari (3 — bir atomli, 5 — ikki atomli). */
export const gas = (i) => ({ i, Cv: (i / 2) * R, Cp: (i / 2 + 1) * R, gamma: (i + 2) / i });

export const temp = (p, V, nu) => (p * V) / (nu * R);
export const pres = (T, V, nu) => (nu * R * T) / V;
/** Entropiya (nisbiy, 300 K va 1 L da nol): S = ν(Cv·ln(T/300) + R·ln V). */
export const entropy = (T, V, nu, g) => nu * (g.Cv * Math.log(T / 300) + R * Math.log(V));

/**
 * Bitta jarayon (tarmoq) yo'li: from = {p, V}, to = {p, V} (yoki tip bo'yicha hisoblanadi).
 * type: "p" izobarik, "V" izoxorik, "T" izotermik, "Q0" adiabatik, "line" — p–V da to'g'ri chiziq.
 * Qaytaradi nuqtalar [{p, V, T}] (n + 1 ta).
 */
export function legPath(type, from, to, nu, g, n = 120) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    let V, p;
    if (type === "V") { V = from.V; p = from.p + (to.p - from.p) * u; }
    else if (type === "p") { p = from.p; V = from.V + (to.V - from.V) * u; }
    else if (type === "T") { V = from.V * (to.V / from.V) ** u; p = (from.p * from.V) / V; }
    else if (type === "Q0") { V = from.V * (to.V / from.V) ** u; p = from.p * (from.V / V) ** g.gamma; }
    else { V = from.V + (to.V - from.V) * u; p = from.p + (to.p - from.p) * u; }
    pts.push({ p, V, T: temp(p, V, nu) });
  }
  return pts;
}

/**
 * Yo'l bo'yicha 1-qonun: A = ∫p dV, ΔU = νCvΔT, Q = ΔU + A; Q⁺ va Q⁻ — olingan va berilgan issiqlik.
 * Har qadamdagi ish aniq: izoterma — pV·ln(V₂/V₁), adiabata — (p₁V₁ − p₂V₂)/(γ − 1), qolganlari — trapetsiya (chiziqli).
 */
export function legEnergy(pts, nu, g, type = "line") {
  let A = 0, Qp = 0, Qm = 0;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    const dA = type === "T" ? a.p * a.V * Math.log(b.V / a.V) : type === "Q0" ? (a.p * a.V - b.p * b.V) / (g.gamma - 1) : 0.5 * (a.p + b.p) * (b.V - a.V);
    const dU = nu * g.Cv * (b.T - a.T), dQ = type === "Q0" ? 0 : dU + dA;
    A += dA; if (dQ > 0) Qp += dQ; else Qm -= dQ;
  }
  const dU = nu * g.Cv * (pts[pts.length - 1].T - pts[0].T);
  return { A, dU, Q: type === "Q0" ? 0 : dU + A, Qp, Qm };
}

/** Jarayon natijasi: boshlang'ich holat s1 = {p, V}, tip va maqsad (V2 yoki p2). */
export function process(type, s1, target, nu, g) {
  let s2;
  if (type === "p") s2 = { p: s1.p, V: target };
  else if (type === "V") s2 = { p: target, V: s1.V };
  else if (type === "T") s2 = { V: target, p: (s1.p * s1.V) / target };
  else s2 = { V: target, p: s1.p * (s1.V / target) ** g.gamma };
  const pts = legPath(type, s1, s2, nu, g);
  return { s2, pts, ...legEnergy(pts, nu, g, type) };
}
/** Analitik formulalar (test va izoh uchun). */
export const A_isoT = (nu, T, V1, V2) => nu * R * T * Math.log(V2 / V1);
export const A_adiab = (p1, V1, p2, V2, gamma) => (p1 * V1 - p2 * V2) / (gamma - 1);

/**
 * Sikl: tugunlar [{p, V}] va tarmoqlar tiplari (tugun i dan i+1 ga). Qaytaradi yo'llar, Q₁ (olingan), Q₂ (berilgan),
 * A (foydali ish), FIK, ΔU (≈ 0).
 */
export function cycle(nodes, types, nu, g) {
  const legs = nodes.map((a, i) => { const b = nodes[(i + 1) % nodes.length], pts = legPath(types[i], a, b, nu, g); return { type: types[i], pts, ...legEnergy(pts, nu, g, types[i]) }; });
  const Q1 = legs.reduce((s, l) => s + l.Qp, 0), Q2 = legs.reduce((s, l) => s + l.Qm, 0), A = legs.reduce((s, l) => s + l.A, 0), dU = legs.reduce((s, l) => s + l.dU, 0);
  return { legs, Q1, Q2, A, dU, eta: Q1 > 0 ? A / Q1 : 0 };
}
/** Ko'pburchak yuzasi (p–V da, J) — Gauss formulasi. */
export const shoelace = (pts) => pts.reduce((s, a, i) => { const b = pts[(i + 1) % pts.length]; return s + (a.V * b.p - b.V * a.p) / 2; }, 0);

/** Karno sikli: T1 > T2, V1 — izotermik kengayish boshi, r = V2/V1. Teskari bo'lsa — sovitgich. */
export function carnotNodes(T1, T2, V1, r, nu, g) {
  const k = (T1 / T2) ** (1 / (g.gamma - 1)), V2 = V1 * r, V3 = V2 * k, V4 = V1 * k;
  return [{ V: V1, p: pres(T1, V1, nu) }, { V: V2, p: pres(T1, V2, nu) }, { V: V3, p: pres(T2, V3, nu) }, { V: V4, p: pres(T2, V4, nu) }];
}
export const CARNOT_TYPES = ["T", "Q0", "T", "Q0"];
export const etaCarnot = (T1, T2) => 1 - T2 / T1;
export const copFridge = (T1, T2) => T2 / (T1 - T2);
export const copPump = (T1, T2) => T1 / (T1 - T2);

/** Otto sikli: V1 (eng katta), ε, boshlang'ich p1, olingan issiqlik Q1. */
export function ottoNodes(V1, eps, p1, Q1, nu, g) {
  const V2 = V1 / eps, p2 = p1 * eps ** g.gamma, T2 = temp(p2, V2, nu), T3 = T2 + Q1 / (nu * g.Cv), p3 = pres(T3, V2, nu), p4 = p3 * (V2 / V1) ** g.gamma;
  return [{ V: V1, p: p1 }, { V: V2, p: p2 }, { V: V2, p: p3 }, { V: V1, p: p4 }];
}
export const OTTO_TYPES = ["Q0", "V", "Q0", "V"];
export const etaOtto = (eps, gamma) => 1 - eps ** (1 - gamma);
/** Dizel sikli: issiqlik o'zgarmas bosimda beriladi. */
export function dieselNodes(V1, eps, p1, Q1, nu, g) {
  const V2 = V1 / eps, p2 = p1 * eps ** g.gamma, T2 = temp(p2, V2, nu), T3 = T2 + Q1 / (nu * g.Cp), V3 = (nu * R * T3) / p2, p4 = p2 * (V3 / V1) ** g.gamma;
  return [{ V: V1, p: p1 }, { V: V2, p: p2 }, { V: V3, p: p2 }, { V: V1, p: p4 }];
}
export const DIESEL_TYPES = ["Q0", "p", "Q0", "V"];
export const etaDiesel = (eps, rho, gamma) => 1 - (rho ** gamma - 1) / (gamma * eps ** (gamma - 1) * (rho - 1));

/* ------------------------------------------------------------------ 4 taktli dvigatel */

/**
 * Dvigatel: Vd — ishchi hajm (L), eps — siqish darajasi, fuel "benzin" (Otto) yoki "dizel", Q1 — bir sikldagi issiqlik (J).
 * p0 = 100 kPa, T0 = 300 K, i = 5 (havo). Krivoship-shatun: λ = r/L.
 */
export function engine({ Vd = 0.5, eps = 10, fuel = "benzin", Q1 = 900, lam = 0.35 } = {}) {
  const g = gas(5), p0 = 100, T0 = 300, V1 = (Vd * eps) / (eps - 1), Vc = V1 / eps, nu = (p0 * V1) / (R * T0);
  const nodes = fuel === "dizel" ? dieselNodes(V1, eps, p0, Q1, nu, g) : ottoNodes(V1, eps, p0, Q1, nu, g);
  const cyc = cycle(nodes, fuel === "dizel" ? DIESEL_TYPES : OTTO_TYPES, nu, g);
  /** Porshenning yuqori o'lik nuqtadan siljishi (0 … 1, ishchi yo'l ulushida). */
  const stroke = (th) => { const s = 1 - Math.cos(th) + (1 - Math.sqrt(1 - lam * lam * Math.sin(th) ** 2)) / lam; return s / 2; };
  const volume = (th) => Vc + Vd * stroke(th);
  /** θ ∈ [0, 4π): 0–π so'rish, π–2π siqish, 2π–3π ishchi yo'l, 3π–4π chiqarish. */
  function state(theta) {
    const th = ((theta % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI), V = volume(th), k = Math.floor(th / Math.PI);
    let p;
    if (k === 0 || k === 3) p = p0;
    else if (k === 1) p = p0 * (V1 / V) ** g.gamma;
    else if (fuel === "dizel" && V <= nodes[2].V) p = nodes[2].p;
    else p = nodes[2].p * (nodes[2].V / V) ** g.gamma; // ishchi yo'l: 3-tugundan adiabatik kengayish
    return { theta: th, V, p, T: k === 0 || k === 3 ? T0 : temp(p, V, nu), stroke: k };
  }
  return { g, p0, T0, V1, Vc, Vd, nu, nodes, cyc, eps, fuel, Q1, lam, volume, stroke, state, eta: cyc.eta, A: cyc.A };
}
export const STROKES = ["So‘rish", "Siqish", "Ishchi yo‘l", "Chiqarish"];
