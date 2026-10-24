// ==========================================================================
// Elektroliz — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_electrolysis.mjs)
// - Eritmalarning solishtirma o'tkazuvchanligi σ(c, T): Kolrausch tipidagi empirik bog'lanish (taxminiy, ±10 %).
// - Elektrolitik vanna: R = d/(σS), tok I = (U − E_p)/(R + R_tashqi), E_p — parchalanish kuchlanishi.
// - Faradey qonunlari: m = kIt = kq, k = M/(nF). Gaz hajmi V = νRT/p.
// Birliklar: SI (kg, m, s, A, C, K). Massa natijada g yoki mg ga o'tkaziladi.
// ==========================================================================

export const F = 96485.33;       // Faradey soni, C/mol
export const E = 1.602176634e-19;
export const NA = 6.02214076e23;
export const R_GAS = 8.314;

/** Ajraladigan moddalar: M (kg/mol), n — ion zaryadi (valentlik), rho (kg/m³). gas: true — elektrodda gaz. */
export const SUBST = {
  Cu: { name: "Mis", sym: "Cu", M: 63.546e-3, n: 2, rho: 8960, ion: "Cu²⁺" },
  Ag: { name: "Kumush", sym: "Ag", M: 107.868e-3, n: 1, rho: 10490, ion: "Ag⁺" },
  Ni: { name: "Nikel", sym: "Ni", M: 58.693e-3, n: 2, rho: 8908, ion: "Ni²⁺" },
  Zn: { name: "Rux", sym: "Zn", M: 65.38e-3, n: 2, rho: 7140, ion: "Zn²⁺" },
  H2: { name: "Vodorod", sym: "H₂", M: 2.016e-3, n: 2, gas: true, ion: "H⁺" },
  O2: { name: "Kislorod", sym: "O₂", M: 31.998e-3, n: 4, gas: true, ion: "OH⁻" },
  Cl2: { name: "Xlor", sym: "Cl₂", M: 70.906e-3, n: 2, gas: true, ion: "Cl⁻" },
};

/** Elektrokimyoviy ekvivalent k = M/(nF), kg/C */
export const kOf = (s) => SUBST[s].M / (SUBST[s].n * F);
/** Ajralgan massa (kg) */
export const massOf = (s, q) => kOf(s) * q;
/** Ajralgan modda miqdori (mol) */
export const molesOf = (s, q) => q / (SUBST[s].n * F);
/** Gaz hajmi (m³) T, p da */
export const gasVolume = (s, q, T = 293.15, p = 101325) => (molesOf(s, q) * R_GAS * T) / p;
/** Qatlam qalinligi (m), S — qoplanadigan yuza */
export const thickness = (s, q, S) => massOf(s, q) / (SUBST[s].rho * S);
/** O'lchangan m va q dan Faradey soni: F = qM/(nm) */
export const faradayFrom = (s, q, m) => (q * SUBST[s].M) / (SUBST[s].n * m);

/**
 * Eritmalar. L0 — cheksiz suyultirishdagi molyar o'tkazuvchanlik (S·m²/mol, formula birligiga), a — Kolrausch tipidagi
 * kamayish koeffitsiyenti, Ep — parchalanish kuchlanishi (V), cath/anod — elektrodlarda nima ajraladi.
 * electrolyte: false — dissotsiatsiyalanmaydi (o'tkazuvchanlik suvnikidek).
 */
export const SOLUTIONS = {
  water: { name: "Distillangan suv", electrolyte: false, Ep: 1.7, cath: "H2", anod: "O2", ions: [], color: [186, 230, 253] },
  sugar: { name: "Shakar eritmasi", electrolyte: false, Ep: 1.7, cath: "H2", anod: "O2", ions: [], color: [254, 249, 195] },
  nacl: { name: "Osh tuzi (NaCl) eritmasi", electrolyte: true, L0: 0.01264, a: 0.585, Ep: 2.2, cath: "H2", anod: "Cl2", ions: ["Na⁺", "Cl⁻"], color: [224, 242, 254] },
  cuso4: { name: "Mis kuporosi (CuSO₄) eritmasi", electrolyte: true, L0: 0.01072, a: 2.0, Ep: 0, cath: "Cu", anod: "Cu", ions: ["Cu²⁺", "SO₄²⁻"], color: [56, 189, 248] },
  agno3: { name: "Kumush nitrat (AgNO₃) eritmasi", electrolyte: true, L0: 0.01334, a: 0.7, Ep: 0, cath: "Ag", anod: "Ag", ions: ["Ag⁺", "NO₃⁻"], color: [241, 245, 249] },
  niso4: { name: "Nikel sulfat (NiSO₄) eritmasi", electrolyte: true, L0: 0.0100, a: 2.2, Ep: 0, cath: "Ni", anod: "Ni", ions: ["Ni²⁺", "SO₄²⁻"], color: [134, 239, 172] },
  znso4: { name: "Rux sulfat (ZnSO₄) eritmasi", electrolyte: true, L0: 0.01056, a: 2.2, Ep: 0, cath: "Zn", anod: "Zn", ions: ["Zn²⁺", "SO₄²⁻"], color: [241, 245, 249] },
  h2so4: { name: "Sulfat kislota (H₂SO₄) eritmasi", electrolyte: true, L0: 0.0860, a: 1.6, Ep: 1.7, cath: "H2", anod: "O2", ions: ["H⁺", "SO₄²⁻"], color: [240, 253, 250] },
};

export const SIGMA_WATER = 5.5e-6; // toza suv, S/m (25 °C)
export const ALPHA_EL = 0.02;      // elektrolitlar: o'tkazuvchanlik har 1 K da ≈ 2 % ortadi
export const ALPHA_CU = 0.0043;    // mis: qarshilik har 1 K da ≈ 0,43 % ortadi

/** Solishtirma o'tkazuvchanlik σ (S/m); c — mol/L, t — °C */
export function sigma(key, c, t = 25) {
  const s = SOLUTIONS[key];
  const base = s.electrolyte ? (s.L0 * c * 1000) / (1 + s.a * Math.sqrt(c)) : SIGMA_WATER * (key === "sugar" ? 1.2 : 1);
  return Math.max(SIGMA_WATER, base * (1 + ALPHA_EL * (t - 25)));
}

/** Vanna qarshiligi R = d/(σS) (Ω); d — elektrodlar orasi (m), S — elektrod yuzasi (m²) */
export const cellR = (key, c, t, d, S) => d / (sigma(key, c, t) * S);

/** Zanjir: manba U, vanna, tashqi qarshilik Rext (lampa, ampermetr). Qaytaradi { I, Ucell, R, P } */
export function circuit({ key, c, t = 25, d, S, U, Rext = 0 }) {
  const R = cellR(key, c, t, d, S), Ep = SOLUTIONS[key].Ep;
  const I = U > Ep ? (U - Ep) / (R + Rext) : 0;
  return { I, R, Ep, Ucell: I > 0 ? Ep + I * R : U, Pext: I * I * Rext };
}

/** Tok manbai (I = const) bilan vanna: kerakli kuchlanish */
export const voltageFor = (key, c, t, d, S, I) => SOLUTIONS[key].Ep + I * cellR(key, c, t, d, S);

/** Metall o'tkazgich qarshiligi R(t) = R₂₀(1 + α(t − 20)) — taqqoslash uchun */
export const metalR = (R20, t) => R20 * (1 + ALPHA_CU * (t - 20));

/** Ionlarning dreyf tezligi (m/s): v = uE, u — harakatchanlik (m²/(V·s)), E = U/d. Ko'rsatish uchun */
export const MOBILITY = { "H⁺": 36.2e-8, "Na⁺": 5.19e-8, "Cl⁻": 7.91e-8, "Cu²⁺": 5.56e-8, "SO₄²⁻": 8.29e-8, "Ag⁺": 6.42e-8, "NO₃⁻": 7.4e-8, "Ni²⁺": 5.2e-8, "Zn²⁺": 5.47e-8, "OH⁻": 20.6e-8 };
export const drift = (ion, E) => (MOBILITY[ion] || 5e-8) * E;
