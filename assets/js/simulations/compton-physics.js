// ==========================================================================
// Kompton effekti — γ-spektrometr (DOM'siz).
// Manba: ¹³⁷Cs (E₀ = 661,66 keV) qo‘rg‘oshin himoyada, kollimatsiyalangan dasta alyuminiy sochuvchiga tushadi;
// NaI(Tl) ssintillyatsion detektor θ burchakda, ko‘p kanalli analizator (MCA, 1024 kanal).
// Kompton formulasi: E′ = E₀ / (1 + (E₀/mₑc²)(1 − cos θ)).  Klein–Nishina: dσ/dΩ ~ (E′/E)²(E′/E + E/E′ − sin²θ).
// Detektor javobi: fotopik (Gauss, FWHM ≈ 7,2 %·√(662/E)), detektor ichidagi Kompton kontinuumi va qirrasi,
// orqaga sochilish cho‘qqisi, xona foni, himoyadan sizib chiqqan 662 keV. Kalibrlash: E = a + b·kanal (yashirin).
// ==========================================================================

export const MEC2 = 510.999, E0 = 661.657, HC = 1239.84198; // keV, keV·pm
export const NCH = 1024, GAIN = 0.8, OFFS = 2.0; // E = OFFS + GAIN·ch  (qurilmaning «haqiqiy» kalibrovkasi)
export const chOf = (E) => (E - OFFS) / GAIN, eOf = (ch) => OFFS + GAIN * ch;
export const eScat = (th) => E0 / (1 + (E0 / MEC2) * (1 - Math.cos((th * Math.PI) / 180)));
export function kn(th, E = E0) { const c = Math.cos((th * Math.PI) / 180), r = 1 / (1 + (E / MEC2) * (1 - c)); return 0.5 * r * r * (r + 1 / r - (1 - c * c)); }
export const sigmaE = (E) => (0.072 * E * Math.sqrt(662 / Math.max(E, 20))) / 2.355;
/** Fotopik samaradorligi (nisbiy). */
export const effPk = (E) => Math.min(1, (160 / E) ** 0.85);
export const CAL = [
  { id: "am", src: "Am-241", E: 59.54, A: 40 },
  { id: "ba81", src: "Ba-133", E: 81.0, A: 14 },
  { id: "ba303", src: "Ba-133", E: 302.85, A: 6 },
  { id: "ba356", src: "Ba-133", E: 356.01, A: 18 },
  { id: "na511", src: "Na-22", E: 511.0, A: 30 },
  { id: "cs662", src: "Cs-137", E: 661.66, A: 25 },
];
export const SOURCES = {
  "Am-241": [[59.54, 40], [26.34, 5]],
  "Ba-133": [[31, 20], [81.0, 14], [276.4, 3], [302.85, 6], [356.01, 18], [383.85, 2.3]],
  "Na-22": [[511.0, 30], [1274.5, 7]],
  "Cs-137": [[32.2, 4], [661.66, 25]],
};

/** Bitta γ-chiziq uchun detektor javobi: kanallar bo‘yicha hisob tezligi (1/s) massiviga qo‘shadi. A — fotopik tezligi, sx — qo‘shimcha kengayish (keV). */
export function addLine(rate, E, A, sx = 0) {
  const s = Math.hypot(sigmaE(E), sx), ce = E * (2 * E / MEC2) / (1 + 2 * E / MEC2), bs = E / (1 + 2 * E / MEC2);
  const cont = E < 90 ? 0 : A * 1.6 * (1 - Math.exp(-(E - 90) / 260)) / (effPk(E) ** 0.4);
  const bsA = E > 200 ? 0.07 * A : 0, sb = 1.5 * sigmaE(bs);
  for (let ch = 0; ch < NCH; ch++) {
    const e = eOf(ch), de = GAIN;
    let v = (A * de) / (Math.sqrt(2 * Math.PI) * s) * Math.exp(-0.5 * ((e - E) / s) ** 2);
    if (cont > 0 && e < ce + 3 * s) { const edge = 0.5 * (1 - erf((e - ce) / (Math.SQRT2 * s))), shape = 0.75 + 0.35 * (e / ce) ** 2; v += ((cont * de) / ce) * shape * edge * (e > 8 ? 1 : e / 8); }
    if (bsA) v += (bsA * de) / (Math.sqrt(2 * Math.PI) * sb) * Math.exp(-0.5 * ((e - bs) / sb) ** 2);
    rate[ch] += v;
  }
}
export function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
/** Xona foni (1/s/kanal). */
export function addBg(rate) { for (let ch = 0; ch < NCH; ch++) { const e = eOf(ch); rate[ch] += 0.025 * Math.exp(-e / 110) + 0.0025 * (e > 12 ? 1 : 0); } }

/** Kompton tajribasi: θ, sochuvchi bor/yo‘q. */
export function rateScatter(th, scatterer = true) {
  const r = new Float64Array(NCH); addBg(r);
  addLine(r, E0, 0.12); // himoyadan sizib chiqish
  if (Math.abs(th) < 9) addLine(r, E0, 400 * (1 - Math.abs(th) / 9) ** 2 + 2); // to‘g‘ridan-to‘g‘ri dasta
  if (scatterer) { const E = eScat(th), dth = (2.5 * Math.PI) / 180, sx = ((E * E) / MEC2) * Math.sin((th * Math.PI) / 180) * dth; addLine(r, E, 22 * (kn(th) / kn(20)) * effPk(E) / effPk(eScat(20)), sx); } // ±2,5° burchak aperturasi — cho‘qqi kengayadi
  return r;
}
/** Kalibrlash: detektor oldiga qo‘yilgan manba. */
export function rateCal(src) { const r = new Float64Array(NCH); addBg(r); (SOURCES[src] || []).forEach(([E, A]) => addLine(r, E, A * effPk(E))); return r; }

/** Puasson tasodifiy son. */
export function poisson(l, R) {
  if (l <= 0) return 0;
  if (l > 40) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss(R)));
  let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1;
}
export function gauss(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }
export const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

/** ROI tahlili: chiziqli fon (chetlardagi 3 kanal) ayirilgan holda sentroid, net hisob, FWHM. */
export function roi(sp, a, b) {
  a = Math.max(3, Math.min(a, b) | 0); b = Math.min(NCH - 4, Math.max(a + 4, b | 0));
  const yl = (sp[a - 1] + sp[a] + sp[a + 1]) / 3, yr = (sp[b - 1] + sp[b] + sp[b + 1]) / 3;
  let n = 0, s1 = 0, s2 = 0, gross = 0;
  for (let ch = a; ch <= b; ch++) { const bg = yl + ((yr - yl) * (ch - a)) / (b - a), v = sp[ch] - bg; gross += sp[ch]; if (v > 0) { n += v; s1 += v * ch; } }
  if (n <= 0) return null;
  const c = s1 / n; for (let ch = a; ch <= b; ch++) { const bg = yl + ((yr - yl) * (ch - a)) / (b - a), v = sp[ch] - bg; if (v > 0) s2 += v * (ch - c) ** 2; }
  const sd = Math.sqrt(s2 / n);
  return { c, net: n, gross, fwhm: 2.355 * sd, sc: sd / Math.sqrt(n) };
}
