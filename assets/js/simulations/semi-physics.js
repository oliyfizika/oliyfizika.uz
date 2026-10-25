// ==========================================================================
// Yarimo'tkazgichlar — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_semi.mjs)
// 1) Metall va yarimo'tkazgich qarshiligining temperaturaga bog'liqligi: mis R = R₂₀(1 + αΔt),
//    termorezistor (NTC) R = R₂₅·e^(B(1/T − 1/T₂₅)); fotorezistor (CdS) R(E).
// 2) Xususiy va aralashmali o'tkazuvchanlik: nᵢ(T) = nᵢ₃₀₀(T/300)^1,5·e^(−E_g/2k·(1/T − 1/300)),
//    n·p = nᵢ², elektr neytrallik n + N_a = p + N_d; σ = e(nμₙ + pμₚ).
// 3) p–n o'tish: Shokli tenglamasi I = I_s(e^(U/nkT) − 1) (+ ketma-ket qarshilik), teskari tok;
//    to'g'rilagich (yarim va to'liq davr, kondensatorli filtr), tranzistor kalit/kuchaytirgich (I_K = βI_B).
// Birliklar: SI; konsentratsiya — m⁻³, energiya — eV.
// ==========================================================================

export const K_B = 8.617e-5;            // eV/K
export const E_CH = 1.602e-19;          // C
export const T0 = 273.15;

/* ------------------------------------------------------------------ 1) Qarshilik va temperatura */

/** Mis simli g'altak: R₂₀ = 10 Ω, α = 4,3·10⁻³ 1/K */
export const COPPER = { R20: 10, alpha: 4.3e-3 };
export const metalR = (tC, m = COPPER) => m.R20 * (1 + m.alpha * (tC - 20));
/** NTC termorezistor (MMT tipidagi): R₂₅ = 10 kΩ, B = 3950 K (B ≈ E_g/2k → E_g ≈ 0,68 eV) */
export const NTC = { R25: 10000, B: 3950 };
export const ntcR = (tC, t = NTC) => t.R25 * Math.exp(t.B * (1 / (tC + T0) - 1 / (25 + T0)));
/** Termorezistor qarshiligidan aktivatsiya energiyasi: ln R = B/T + const, E_a = 2kB */
export const ntcEg = (t = NTC) => 2 * K_B * t.B;

/** Suvli stakan plitkada: dT/dt = (ηP − h(T − T_xona))/C; suv 100 °C da qaynaydi */
export const BATH = { C: 1150, h: 3.6, P: 800, eta: 0.55, room: 20 };
export function bathStep(T, dt, level, b = BATH) {
  const Pin = b.eta * b.P * level, Teq = b.room + Pin / b.h, k = b.h / b.C;
  return Math.min(100, Teq + (T - Teq) * Math.exp(-k * dt));
}

/** Fotorezistor (CdS): qorong'ida R_q = 1 MΩ, 10 lk da 20 kΩ, γ = 0,8: 1/R = 1/R_q + (E/10)^γ/R₁₀ */
export const LDR = { Rd: 1e6, R10: 2e4, g: 0.8 };
export const ldrR = (E, l = LDR) => 1 / (1 / l.Rd + Math.pow(Math.max(0, E) / 10, l.g) / l.R10);
/** Lampa yoritilganligi: E = I/r² (I — kd, r — m) */
export const illum = (Iv, r) => Iv / (r * r);

/* ------------------------------------------------------------------ 2) Zaryad tashuvchilar */

export const MATS = {
  si: { name: "Kremniy", sym: "Si", Eg: 1.12, ni300: 1.0e16, mun: 0.135, mup: 0.048 },
  ge: { name: "Germaniy", sym: "Ge", Eg: 0.66, ni300: 2.0e19, mun: 0.39, mup: 0.19 },
};
/** Xususiy konsentratsiya nᵢ (m⁻³) */
export const ni = (m, T) => m.ni300 * Math.pow(T / 300, 1.5) * Math.exp(-(m.Eg / (2 * K_B)) * (1 / T - 1 / 300));
/** Elektronlar va kovaklar konsentratsiyasi (aralashma atomlari to'liq ionlashgan) */
export function carriers(m, T, Nd = 0, Na = 0) {
  const n_i = ni(m, T), D = (Nd - Na) / 2, r = Math.hypot(D, n_i);
  if (D >= 0) { const n = D + r; return { ni: n_i, n, p: (n_i * n_i) / n }; }
  const p = -D + r; return { ni: n_i, n: (n_i * n_i) / p, p };
}
/** Harakatchanlik (panjara tebranishlarida sochilish): μ ∝ T^(−3/2) */
export const mobility = (m, T) => ({ n: m.mun * Math.pow(T / 300, -1.5), p: m.mup * Math.pow(T / 300, -1.5) });
export function conductivity(m, T, Nd = 0, Na = 0) {
  const c = carriers(m, T, Nd, Na), mu = mobility(m, T);
  return { ...c, mu, sigma: E_CH * (c.n * mu.n + c.p * mu.p), sn: E_CH * c.n * mu.n, sp: E_CH * c.p * mu.p };
}
/** Dreyf tezligi v = μE */
export const drift = (mu, E) => mu * E;

/* ------------------------------------------------------------------ 3) Diodlar */

/**
 * U10 — 10 mA dagi to'g'ri kuchlanish (300 K), n — ideallik koeffitsiyenti, Rs — ketma-ket qarshilik (Ω),
 * Ir — teskari to'yinish toki (A, 20 °C), G — teskari sirt o'tkazuvchanligi (S), Vbi — kontakt potensiallar farqi.
 */
export const DIODES = {
  si: { name: "Kremniy diod 1N4007", short: "Si diod", U10: 0.78, n: 1.9, Rs: 0.2, Ir: 5e-9, G: 2e-11, Vbi: 0.7, Eg: 1.12 },
  ge: { name: "Germaniy diod D9", short: "Ge diod", U10: 0.42, n: 1.3, Rs: 8, Ir: 4e-6, G: 3e-7, Vbi: 0.35, Eg: 0.66 },
  red: { name: "Qizil yorug‘lik diodi (AlGaInP)", short: "Qizil LED", U10: 1.95, n: 2, Rs: 8, Ir: 1e-11, G: 0, Vbi: 1.8, Eg: 1.97, led: [255, 45, 35], nm: 630 },
  green: { name: "Yashil yorug‘lik diodi (InGaN)", short: "Yashil LED", U10: 2.95, n: 2.6, Rs: 10, Ir: 1e-11, G: 0, Vbi: 2.6, Eg: 2.36, led: [40, 230, 90], nm: 525 },
  blue: { name: "Ko‘k yorug‘lik diodi (InGaN)", short: "Ko‘k LED", U10: 3.1, n: 2.8, Rs: 10, Ir: 1e-11, G: 0, Vbi: 2.8, Eg: 2.65, led: [60, 110, 255], nm: 465 },
};
export const VT = (T) => K_B * T;
/** To'yinish toki I_s (300 K, 10 mA da U10 bo'lishi uchun) */
export const diodeIs = (d) => 0.01 / Math.expm1((d.U10 - 0.01 * d.Rs) / (d.n * VT(300)));
/** O'tishdagi tok (ketma-ket qarshiliksiz). T — K; temperatura ortganda to'g'ri kuchlanish −2 mV/K, teskari tok har 10 K da 2 marta */
export function junctionI(d, Uj, T = 293) {
  if (Uj >= 0) { const nVt = d.n * VT(300), sh = 0.002 * (T - 300); return diodeIs(d) * (Math.exp((Uj + sh) / nVt) - Math.exp(sh / nVt)); }
  const Ir = d.Ir * Math.pow(2, (T - 293) / 10);
  return -(Ir * -Math.expm1(Uj / VT(T)) + d.G * -Uj);
}
/** Diod qisqichlaridagi kuchlanish U uchun tok (Rs hisobga olingan) */
export function diodeI(d, U, T = 293) {
  if (U <= 0) return junctionI(d, U, T);
  let lo = 0, hi = U;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (m + junctionI(d, m, T) * d.Rs > U) hi = m; else lo = m; }
  return junctionI(d, (lo + hi) / 2, T);
}
/** Manba E, ketma-ket qarshilik R (cheklovchi + asbob): diodagi kuchlanish va tok */
export function diodeCircuit(d, E, R, T = 293) {
  let lo = Math.min(0, E), hi = Math.max(0, E);
  for (let k = 0; k < 90; k++) { const m = (lo + hi) / 2; if (diodeI(d, m, T) - (E - m) / R > 0) hi = m; else lo = m; }
  const U = (lo + hi) / 2;
  return { U, I: diodeI(d, U, T) };
}
/** Statik qarshilik U/I va differensial qarshilik dU/dI */
export const staticR = (d, U, T = 293) => U / diodeI(d, U, T);
export function diffR(d, U, T = 293) { const h = Math.max(1e-4, Math.abs(U) * 1e-3); return (2 * h) / (diodeI(d, U + h, T) - diodeI(d, U - h, T)); }
/** Kambag'allashgan qatlam kengligi (nisbiy): w ∝ √(V_bi − U) */
export const depletion = (d, Uj) => Math.sqrt(Math.max(0.02 * d.Vbi, d.Vbi - Uj) / d.Vbi);
/** Yorug'lik diodi foton energiyasi hν = hc/λ (eV) */
export const photonEV = (nm) => 1239.84 / nm;

/* ------------------------------------------------------------------ To'g'rilagich */

/**
 * Transformator Um·sin(ωt) → diod(lar) → yuklama R ‖ C.
 * o: { Um, f, R, C (F), bridge, drop (bitta diodda, V), Rsrc (Ω), periods, N (bir davrda qadam) }
 * Qaytaradi: oxirgi 2 davr { t[], uin[], uout[], id[] } va { Umax, Umin, Uavg, ripple }.
 */
export function rectifier({ Um = 17, f = 50, R = 100, C = 0, bridge = false, drop = 0.7, Rsrc = 1, periods = 14, N = 400 } = {}) {
  const T = 1 / f, dt = T / N, k = bridge ? 2 : 1, out = { t: [], uin: [], uout: [], id: [] };
  let v = 0;
  for (let i = 0; i <= periods * N; i++) {
    const t = i * dt, u = Um * Math.sin(2 * Math.PI * f * t), ur = bridge ? Math.abs(u) : u, src = ur - k * drop;
    let id;
    if (C > 0) { id = Math.max(0, (src - v) / Rsrc); v += ((id - v / R) / C) * dt; }
    else { v = Math.max(0, src) * (R / (R + Rsrc)); id = v / R; }
    if (i >= (periods - 2) * N) { out.t.push(t - (periods - 2) * T); out.uin.push(u); out.uout.push(v); out.id.push(id); }
  }
  const Umax = Math.max(...out.uout), Umin = Math.min(...out.uout), Uavg = out.uout.reduce((a, b) => a + b, 0) / out.uout.length;
  return { ...out, Umax, Umin, Uavg, ripple: Umax - Umin, T };
}
/** Nazariy o'rtacha qiymatlar (ideal diod, C = 0): yarim davr Um/π, to'liq davr 2Um/π */
export const avgHalf = (Um) => Um / Math.PI;
export const avgFull = (Um) => (2 * Um) / Math.PI;
/** Kondensatorli filtrning taxminiy pulsatsiyasi ΔU ≈ U/(f'RC), f' = f (yarim) yoki 2f (to'liq) */
export const rippleEst = (U, f, R, C, bridge) => U / ((bridge ? 2 : 1) * f * R * C);

/* ------------------------------------------------------------------ Tranzistor */

/** n-p-n tranzistor umumiy emitterli sxemada: baza zanjiri Ub → Rb, kollektor Ucc → Rk (lampa) */
export const TRANSISTOR = { name: "n-p-n tranzistor BC337", beta: 160, Ube: 0.65, Usat: 0.2 };
export function transistor(Ub, Rb, Ucc, Rk, t = TRANSISTOR) {
  const Ib = Math.max(0, (Ub - t.Ube) / Rb), Ilin = t.beta * Ib, Imax = Math.max(0, (Ucc - t.Usat) / Rk);
  const Ic = Math.min(Ilin, Imax), sat = Ilin >= Imax && Ib > 0;
  return { Ib, Ic, Ie: Ib + Ic, Uce: Ucc - Ic * Rk, sat, cut: Ib <= 0, gain: Ib > 0 ? Ic / Ib : 0 };
}
