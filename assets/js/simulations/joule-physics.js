// ==========================================================================
// Tok ishi, quvvati va Joul–Lens qonuni — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_joule.mjs)
// 1) Kalorimetr: spiral(lar)dagi issiqlik Q = I²Rt; suv va idish isiydi, atrofga issiqlik yo'qotiladi (Nyuton):
//    C·dT/dt = P − k(T − T₀) → T(t) = T₀ + (P/k)(1 − e^(−kt/C)). Spirallar ketma-ket (Q ∝ R) yoki parallel (Q ∝ 1/R).
// 2) Cho'g'lanma lampa: volfram tolasi qizigan sari qarshiligi ortadi — tajribada I ≈ Iₙ(U/Uₙ)^0,58.
//    Tola temperaturasi nurlanish balansidan: P ∝ T⁴ (sovuq tola 293 K). Ketma-ket lampalar tok tengligidan yechiladi.
// 3) Uy tarmog'i: iste'molchilar parallel, I = ΣP/U; saqlagich simining erishi: ∫(I² − I_lim²)dt = W.
// Birliklar: SI (V, A, Ω, W, J, K, s).
// ==========================================================================

export const C_WATER = 4200;     // J/(kg·K)
export const C_ALU = 920;        // J/(kg·K)
export const T_ROOM = 20;        // °C

/** Joul–Lens qonuni: Q = I²Rt = UIt = U²t/R */
export const heat = (I, R, t) => I * I * R * t;
export const power = (U, I) => U * I;
/** Manba (EYuK E, ichki qarshilik r) va spirallar: { I, U, parts: [{ R, I, U, P }] } */
export function heaters(E, r, Rs, mode = "single") {
  if (mode === "parallel") {
    const Rp = 1 / Rs.reduce((s, R) => s + 1 / R, 0), I = E / (Rp + r), U = I * Rp;
    return { I, U, R: Rp, parts: Rs.map((R) => ({ R, I: U / R, U, P: (U * U) / R })) };
  }
  const list = mode === "series" ? Rs : Rs.slice(0, 1), Rt = list.reduce((s, R) => s + R, 0), I = E / (Rt + r);
  return { I, U: I * Rt, R: Rt, parts: list.map((R) => ({ R, I, U: I * R, P: I * I * R })) };
}
/** Kalorimetr issiqlik sig'imi C = m_s·c_s + m_i·c_i (J/K) */
export const heatCapacity = (mWater, mCup = 0.05, cCup = C_ALU) => mWater * C_WATER + mCup * cCup;
/** Temperatura (°C): P quvvat, C sig'im, k — issiqlik yo'qotish koeffitsiyenti (W/K) */
export function tempAt(t, P, C, k = 0.15, T0 = T_ROOM) {
  if (k <= 0) return T0 + (P * t) / C;
  return T0 + (P / k) * (1 - Math.exp((-k * t) / C));
}
/** Bir qadam (Eyler emas — aniq yechim dt ichida P o'zgarmas deb): T → T' */
export function stepTemp(T, dt, P, C, k = 0.15, T0 = T_ROOM) {
  const Tinf = T0 + (k > 0 ? P / k : Infinity);
  if (k <= 0) return T + (P * dt) / C;
  return Tinf + (T - Tinf) * Math.exp((-k * dt) / C);
}
/** Qaynashgacha qizdirish: 100 °C da to'xtaydi (bug'lanish issiqligi alohida) */
export const BOIL = 100;
/** FIK: η = cmΔT / (I²Rt) */
export const efficiency = (C, dT, Q) => (Q > 0 ? (C * dT) / Q : 0);
/** Nixrom sim qarshiligi R = ρl/S, ρ = 1,1·10⁻⁶ Ω·m */
export const RHO_NICHROME = 1.1e-6;
export const wireR = (l, d, rho = RHO_NICHROME) => (rho * l) / ((Math.PI * d * d) / 4);

/* ------------------------------------------------------------------ 2) Cho'g'lanma lampa */

export const LAMP_EXP = 0.58;   // I ∝ U^0,58 (volfram tolasi)
export const T_FIL_N = 2700;     // nominal ish temperaturasi, K
/** Lampalar: Pn (W), Un (V) */
export const LAMPS = {
  l25: { name: "25 W", Pn: 25, Un: 220 },
  l40: { name: "40 W", Pn: 40, Un: 220 },
  l60: { name: "60 W", Pn: 60, Un: 220 },
  l100: { name: "100 W", Pn: 100, Un: 220 },
  l6: { name: "6,3 V; 0,3 A", Pn: 1.89, Un: 6.3 },
};
export const ratedI = (L) => L.Pn / L.Un;
/** Sovuq tola qarshiligi (293 K): ishchi qarshilikdan ~12 marta kichik */
export const coldR = (L) => (L.Un * L.Un) / L.Pn / 12.5;
/** Lampa toki kuchlanishga bog'liq; juda kichik kuchlanishda tola qizimaydi — R = R_sovuq */
export const lampI = (L, U) => { const u = Math.max(0, U); return Math.min(u / coldR(L), ratedI(L) * Math.pow(u / L.Un, LAMP_EXP)); };
/** Tok bo'yicha kuchlanish (teskari) */
export const lampU = (L, I) => { const i = Math.max(0, I), Uc = L.Un * Math.pow(1 / 12.5, 1 / (1 - LAMP_EXP)); return i * coldR(L) <= Uc ? i * coldR(L) : L.Un * Math.pow(i / ratedI(L), 1 / LAMP_EXP); };
/** Ishchi holatdagi qarshilik R = U/I */
export const lampR = (L, U) => (U > 1e-6 ? U / lampI(L, U) : coldR(L));
/** Tola temperaturasi (K): nurlanish balansi P ∝ T⁴ − T₀⁴ */
export function filamentT(L, P) {
  const T0 = 293, k = L.Pn / (Math.pow(T_FIL_N, 4) - Math.pow(T0, 4));
  return Math.pow(Math.max(0, P) / k + Math.pow(T0, 4), 0.25);
}
/** Ko'rinadigan nur ulushi (nisbiy, nominalda 1): Vin qonuni oralig'ida T ning kuchli funksiyasi */
export const brightness = (T) => (T < 900 ? 0 : Math.pow((T - 900) / (T_FIL_N - 900), 3.4));
/** Ketma-ket ulangan lampalar: umumiy kuchlanish U → { I, parts: [{ U, P, T }] } */
export function seriesLamps(lamps, U) {
  if (U <= 0) return { I: 0, parts: lamps.map(() => ({ U: 0, P: 0, T: 293 })) };
  let lo = 0, hi = Math.max(...lamps.map((L) => lampI(L, U))) * 1.01;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2, s = lamps.reduce((a, L) => a + lampU(L, m), 0); if (s > U) hi = m; else lo = m; }
  const I = (lo + hi) / 2;
  return { I, parts: lamps.map((L) => { const u = lampU(L, I); return { U: u, P: u * I, T: filamentT(L, u * I) }; }) };
}
export function parallelLamps(lamps, U) {
  const parts = lamps.map((L) => { const i = lampI(L, U); return { U, I: i, P: U * i, T: filamentT(L, U * i) }; });
  return { I: parts.reduce((s, p) => s + p.I, 0), parts };
}

/* ------------------------------------------------------------------ 3) Uy tarmog'i */

export const MAINS = 220;
/** Maishiy iste'molchilar: P (W) */
export const APPLIANCES = {
  kettle: { name: "Elektr choynak", P: 2000 },
  iron: { name: "Dazmol", P: 1200 },
  heater: { name: "Isitgich", P: 1500 },
  washer: { name: "Kir yuvish mashinasi", P: 2200 },
  fridge: { name: "Muzlatkich", P: 150 },
  tv: { name: "Televizor", P: 100 },
  pc: { name: "Kompyuter", P: 300 },
  lamp: { name: "Cho‘g‘lanma lampa", P: 100 },
  led: { name: "LED lampa", P: 12 },
  ac: { name: "Konditsioner", P: 2500 },
};
export const lineCurrent = (Ps, U = MAINS) => Ps.reduce((s, P) => s + P, 0) / U;
/** Saqlagich: I_lim = 1,45·Iₙ dan katta tokda eriydi; W tanlangan: I = 2Iₙ da ~10 s */
export const FUSE_K = 1.45;
export const fuseW = (In) => 10 * (4 - FUSE_K * FUSE_K) * In * In;
/** Erish vaqti (s) yoki Infinity */
export const meltTime = (I, In) => { const d = I * I - FUSE_K * FUSE_K * In * In; return d > 0 ? fuseW(In) / d : Infinity; };
/** Energiya kVt·soat: W = Pt */
export const kWh = (P, seconds) => (P * seconds) / 3.6e6;
/** Sim (mis, uzunligi l, kesimi S mm²) qarshiligi va undagi isrof quvvati */
export const RHO_CU = 1.7e-8;
export const lineLoss = (I, l, Smm2) => I * I * ((RHO_CU * 2 * l) / (Smm2 * 1e-6));
