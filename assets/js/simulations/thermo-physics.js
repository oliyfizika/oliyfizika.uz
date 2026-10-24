// ==========================================================================
// Termodinamika — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_thermo.mjs)
// Ideal gaz: pV = νRT, U = (i/2)νRT. Kvazistatik izojarayonlar: ish, ichki energiya o'zgarishi, issiqlik
// (1-qonun Q = ΔU + A). Sikllar: Karno, to'g'ri to'rtburchak (2 izobara + 2 izoxora), Otto, teskari Karno.
// To'rt taktli dvigatel: krivoship-shatun kinematikasi va ideal Otto bo'yicha bosim.
// Birliklar: SI (Pa, m³, K, J). Gaz: { nu (mol), i (erkinlik darajalari: 3 yoki 5) }.
// ==========================================================================

export const R = 8.314;
export const P_ATM = 101325;

export const GASES = {
  he: { name: "Geliy (bir atomli)", short: "He", i: 3 },
  air: { name: "Havo (ikki atomli)", short: "havo", i: 5 },
};

export const cv = (i) => (i / 2) * R;
export const cp = (i) => cv(i) + R;
export const gammaOf = (i) => (i + 2) / i;

/** Holat: p, V, T dan ikkitasi berilsa uchinchisi. */
export const stateVT = (gas, V, T) => ({ V, T, p: (gas.nu * R * T) / V });
export const statePV = (gas, p, V) => ({ p, V, T: (p * V) / (gas.nu * R) });
export const stateTP = (gas, T, p) => ({ T, p, V: (gas.nu * R * T) / p });
export const energy = (gas, T) => gas.nu * cv(gas.i) * T;

/**
 * Jarayon bo'ylab yangi holat. kind: "V" izoxorik, "p" izobarik, "T" izotermik, "Q" adiabatik.
 * to: { V } yoki { T } (izoxorikda faqat T; adiabatikda T berilsa V topiladi).
 */
export function move(gas, s, kind, to) {
  if (kind === "V") return stateVT(gas, s.V, to.T ?? s.T);
  if (kind === "p") return to.V !== undefined ? statePV(gas, s.p, to.V) : stateTP(gas, to.T, s.p);
  if (kind === "T") return stateVT(gas, to.V ?? s.V, s.T);
  const g1 = gammaOf(gas.i) - 1;
  if (to.V !== undefined) return stateVT(gas, to.V, s.T * (s.V / to.V) ** g1);
  return stateVT(gas, s.V * (s.T / to.T) ** (1 / g1), to.T);
}

/** Gaz bajargan ish A (J) — analitik. */
export function work(gas, a, b, kind) {
  if (kind === "V") return 0;
  if (kind === "p") return a.p * (b.V - a.V);
  if (kind === "T") return gas.nu * R * a.T * Math.log(b.V / a.V);
  return gas.nu * cv(gas.i) * (a.T - b.T); // adiabatik: A = −ΔU
}

/** Bitta jarayon: A, ΔU, Q (1-qonun). */
export function leg(gas, a, b, kind) {
  const A = work(gas, a, b, kind), dU = energy(gas, b.T) - energy(gas, a.T);
  return { kind, a, b, A, dU, Q: kind === "Q" ? 0 : dU + A };
}

/** Jarayonning f ∈ [0, 1] ulushidagi holat (izoxorikda T, qolganlarida V chiziqli o'zgaradi). */
export function onLeg(gas, L, f) {
  if (L.kind === "V") return move(gas, L.a, "V", { T: L.a.T + (L.b.T - L.a.T) * f });
  return move(gas, L.a, L.kind, { V: L.a.V + (L.b.V - L.a.V) * f });
}

/** Jarayon chizig'i nuqtalari (p–V diagramma uchun). */
export function legPath(gas, L, n = 48) {
  return Array.from({ length: n + 1 }, (_, k) => onLeg(gas, L, k / n));
}

/** Ixtiyoriy siniq yo'l bo'ylab ish: trapetsiya qoidasi (tekshirish va erkin yo'l uchun). */
export function pathWork(pts) {
  let A = 0;
  for (let k = 1; k < pts.length; k++) A += ((pts[k].p + pts[k - 1].p) / 2) * (pts[k].V - pts[k - 1].V);
  return A;
}

/* ------------------------------------------------------------------ Sikllar */

export const CYCLES = {
  karno: { title: "Karno sikli", legs: "T Q T Q", rLabel: "Izotermik kengayish V₂/V₁" },
  rect: { title: "To‘rtburchak sikl (2 izobara + 2 izoxora)", legs: "p V p V", rLabel: "Kengayish V₂/V₁" },
  otto: { title: "Otto sikli (benzin dvigateli)", legs: "Q V Q V", rLabel: "Siqish darajasi ε" },
  rev: { title: "Sovutgich (teskari Karno sikli)", legs: "Q T Q T", rLabel: "Izotermik siqish V₂/V₁" },
};

/** Parametrlar chegarasi: sikl mavjud bo'lishi uchun r ning eng katta qiymati. */
export function maxRatio(gas, name, T1, T2) {
  if (name === "rect") return (T1 / T2) * 0.97;
  if (name === "otto") return (T1 / T2) ** (1 / (gammaOf(gas.i) - 1)) * 0.97;
  return Infinity;
}

/**
 * Sikl: { pts, legs, Qin, Qout, A, eta, etaC, cop, reverse }.
 * T1 — isitkich (eng yuqori), T2 — sovitkich (eng past) temperaturasi; r — kengayish/siqish darajasi; V1 — eng kichik hajm (Otto da eng kattasi).
 */
export function cycle(gas, name, { T1, T2, r, V1 = 1e-3 }) {
  const g1 = gammaOf(gas.i) - 1;
  let pts, kinds;
  if (name === "karno" || name === "rev") {
    const k = (T1 / T2) ** (1 / g1);
    pts = [stateVT(gas, V1, T1), stateVT(gas, r * V1, T1), stateVT(gas, r * V1 * k, T2), stateVT(gas, V1 * k, T2)];
    kinds = ["T", "Q", "T", "Q"];
    if (name === "rev") { pts = [pts[0], pts[3], pts[2], pts[1]]; kinds = ["Q", "T", "Q", "T"]; }
  } else if (name === "rect") {
    const V2 = r * V1, pHi = (gas.nu * R * T1) / V2, pLo = (gas.nu * R * T2) / V1;
    pts = [statePV(gas, pHi, V1), statePV(gas, pHi, V2), statePV(gas, pLo, V2), statePV(gas, pLo, V1)];
    kinds = ["p", "V", "p", "V"];
  } else {
    const Vmax = V1, Vmin = V1 / r;
    pts = [stateVT(gas, Vmax, T2), stateVT(gas, Vmin, T2 * r ** g1), stateVT(gas, Vmin, T1), stateVT(gas, Vmax, T1 * r ** -g1)];
    kinds = ["Q", "V", "Q", "V"];
  }
  const legs = kinds.map((kd, j) => leg(gas, pts[j], pts[(j + 1) % 4], kd));
  const A = legs.reduce((s, L) => s + L.A, 0);
  const Qin = legs.reduce((s, L) => s + Math.max(0, L.Q), 0), Qout = legs.reduce((s, L) => s + Math.max(0, -L.Q), 0);
  const etaC = 1 - T2 / T1, reverse = name === "rev";
  return { name, pts, legs, A, Qin, Qout, eta: reverse ? null : A / Qin, etaC, cop: reverse ? Qin / -A : null, copC: T2 / (T1 - T2), reverse };
}

/** Sikl bo'ylab harakat: u ∈ [0, 4) — butun qismi jarayon raqami. */
export function onCycle(gas, cyc, u) {
  const j = Math.min(3, Math.floor(u));
  return { j, s: onLeg(gas, cyc.legs[j], u - j) };
}

/* ------------------------------------------------------------------ To'rt taktli dvigatel */

export const STROKES = ["So‘rish", "Siqish", "Ish yo‘li", "Chiqarish"];

/**
 * Dvigatel geometriyasi: diametr D, porshen yo'li S (= 2r), shatun l, siqish darajasi eps.
 * Qaytaradi: { area, r, l, Vd, Vc, Vmax, nu (so'rilgan aralashma) }.
 */
export function engineGeom({ D = 0.08, S = 0.08, l = 0.14, eps = 9, Tin = 300, pIn = P_ATM } = {}) {
  const area = (Math.PI * D * D) / 4, r = S / 2, Vd = area * S, Vc = Vd / (eps - 1), Vmax = Vc + Vd;
  return { D, S, area, r, l, Vd, Vc, Vmax, eps, Tin, pIn, nu: (pIn * Vmax) / (R * Tin) };
}

/** Porshen siljishi (YuChN dan, m) va hajm: θ = 0 — yuqori chetki nuqta. */
export function crank(g, th) {
  const x = g.r * Math.cos(th) + Math.sqrt(g.l * g.l - (g.r * Math.sin(th)) ** 2);
  const s = g.r + g.l - x;
  return { s, V: g.Vc + g.area * s };
}

/**
 * Ideal Otto bo'yicha holat: θ ∈ [0, 4π). Tmax — yonishdan keyingi temperatura.
 * Qaytaradi: { stroke (0…3), V, p, T, s }.
 */
export function engineState(g, i, Tmax, th) {
  const TH = ((th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI), stroke = Math.min(3, Math.floor(TH / Math.PI));
  const { s, V } = crank(g, TH), gam = gammaOf(i), g1 = gam - 1;
  let p, T;
  if (stroke === 0 || stroke === 3) { p = g.pIn; T = g.Tin; }
  else if (stroke === 1) { p = g.pIn * (g.Vmax / V) ** gam; T = g.Tin * (g.Vmax / V) ** g1; }
  else { T = Tmax * (g.Vc / V) ** g1; p = (g.nu * R * T) / V; }
  return { stroke, V, p, T, s };
}

/** Bir sikl ishi va quvvat (ideal). rpm — tirsakli valning aylanish chastotasi. */
export function enginePower(g, i, Tmax, rpm) {
  const gas = { nu: g.nu, i }, c = cycle(gas, "otto", { T1: Tmax, T2: g.Tin, r: g.eps, V1: g.Vmax });
  return { cyc: c, A: c.A, P: c.A * (rpm / 60 / 2) };
}
