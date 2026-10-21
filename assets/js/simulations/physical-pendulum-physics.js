// ==========================================================================
// Fizik (murakkab) mayatnik — jism geometriyasi va o'lchamlari (DOM'siz).
//
// Qattiq jism gorizontal o'q atrofida aylanadi; o'q massa markazidan d masofada.
//   I_cm = m k²           (k — massa markazi atrofidagi inersiya radiusi)
//   I    = I_cm + m d²    (Shteyner teoremasi)
//   ω₀²  = m g d / I = g d / (k² + d²),   T₀ = 2π √(I / (m g d))
//   L_red = I / (m d) = d + k²/d          (keltirilgan uzunlik; tebranish markazigacha masofa)
//
// Jism osish nuqtasidan pastga qarab u o'qi bo'ylab joylashgan: massa markazi u = d da.
// ==========================================================================

import { TAU } from "./pendulum-physics.js";

/** S — jismning xarakterli o'lchami (sterjen uzunligi, plastina balandligi, disk/halqa/shar diametri), m. */
export const SHAPES = {
  rod: {
    name: "Sterjen",
    k2: (S) => (S * S) / 12,                       // I_cm = m ℓ²/12
    half: (S) => S / 2,                            // u o'qi bo'ylab yarim uzunlik
    dMin: (S) => Math.max(0.01, 0.02 * S),
    dMax: (S) => S / 2,
    dDefault: (S) => S / 2,
    note: "Ingichka bir jinsli sterjen: I<sub>cm</sub> = mℓ²/12",
  },
  plate: {
    name: "To‘rtburchak plastina",
    k2: (S) => (S * S + (S / 2) ** 2) / 12,        // I_cm = m (a² + b²)/12, b = a/2
    half: (S) => S / 2,
    dMin: (S) => Math.max(0.01, 0.02 * S),
    dMax: (S) => S / 2,
    dDefault: (S) => S / 2,
    note: "Plastina a × a/2, o‘q uning tekisligiga perpendikulyar: I<sub>cm</sub> = m(a² + b²)/12",
  },
  disk: {
    name: "Disk",
    k2: (S) => (S / 2) ** 2 / 2,                   // I_cm = m R²/2
    half: (S) => S / 2,
    dMin: (S) => Math.max(0.01, 0.02 * S),
    dMax: (S) => S / 2,
    dDefault: (S) => S / 2,
    note: "Bir jinsli disk: I<sub>cm</sub> = mR²/2",
  },
  ring: {
    name: "Halqa",
    k2: (S) => (S / 2) ** 2,                       // I_cm = m R²
    half: (S) => S / 2,
    dMin: (S) => Math.max(0.01, 0.02 * S),
    dMax: (S) => S / 2,
    dDefault: (S) => S / 2,
    note: "Ingichka halqa (yengil spitsalar bilan): I<sub>cm</sub> = mR²",
  },
  ball: {
    name: "Shar (ipda)",
    k2: (S) => 0.4 * (S / 2) ** 2,                 // I_cm = 2/5 m R²
    half: (S) => S / 2,
    dMin: (S) => S / 2,                            // ip uzunligi 0 bo'lganda
    dMax: (S) => S / 2 + 3,
    dDefault: (S) => S / 2 + 1,
    note: "Bir jinsli shar vaznsiz ipda: I<sub>cm</sub> = 2mR²/5",
  },
};

/** Berilgan jism va o'lcham uchun: inersiya radiusi kvadrati k² (m²). */
export const gyr2 = (shape, S) => SHAPES[shape].k2(S);

/** Osish nuqtasi massa markazidan d masofada bo'lgandagi ω₀² (1/s²). */
export const omega2 = (k2, d, g) => (g * d) / (k2 + d * d);

/** Kichik amplituda davri T₀ = 2π √((k² + d²)/(g d)). */
export const periodSmall = (k2, d, g) => TAU * Math.sqrt((k2 + d * d) / (g * d));

/** Keltirilgan uzunlik L = d + k²/d — bir xil davrli matematik mayatnik uzunligi. */
export const reducedLength = (k2, d) => d + k2 / d;

/** Qo'shma (Keyter) nuqta: massa markazidan k²/d masofada, osish nuqtasiga qarama-qarshi tomonda. */
export const conjugateDistance = (k2, d) => k2 / d;

/** T(d) eng kichik bo'ladigan masofa: d = k. */
export const dOfMinPeriod = (k2) => Math.sqrt(k2);

/** Eng kichik davr: T_min = 2π √(2k/g). */
export const minPeriod = (k2, g) => TAU * Math.sqrt((2 * Math.sqrt(k2)) / g);

/**
 * Osish o'qidagi reaksiya kuchi (Nyuton): massa markazi harakati m·a_cm = R + m·g.
 * θ pastki vertikaldan o'lchanadi; x — o'ngga, y — yuqoriga. alpha = θ''.
 */
export function pivotReaction({ m, d, g }, th, w, alpha) {
  const ax = d * alpha * Math.cos(th) - d * w * w * Math.sin(th);
  const ay = d * alpha * Math.sin(th) + d * w * w * Math.cos(th);
  return { x: m * ax, y: m * ay + m * g };
}
