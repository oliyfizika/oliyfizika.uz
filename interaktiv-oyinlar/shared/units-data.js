// ==========================================================================
// Interaktiv o‘yinlar — fizik kattaliklar va SI birliklari, olimlar va kashfiyotlar.
// Birlikni top va Xotira juftlari o‘yinlari ishlatadi.
//
// dims — SI asosiy birliklaridagi darajalar: [kg, m, s, A, K, mol]
//   masalan, kuch: kg·m·s⁻² → [1, 1, -2, 0, 0, 0]
// ==========================================================================

export const BASE = ["kg", "m", "s", "A", "K", "mol"];
export const BASE_NAMES = ["kilogramm", "metr", "sekund", "amper", "kelvin", "mol"];

// group: mex — mexanika, mol — molekulyar fizika, el — elektr va magnetizm, opt — tebranish, optika va kvant
const q = (name, sym, hint, dims, unit, unitName = "", group = "mex") => ({ name, sym, hint, dims, unit, unitName, group });

export const QUANTITIES = [
  q("Uzunlik", "l", "asosiy kattalik", [0, 1, 0, 0, 0, 0], "m", "metr", "mex"),
  q("Massa", "m", "asosiy kattalik", [1, 0, 0, 0, 0, 0], "kg", "kilogramm", "mex"),
  q("Vaqt", "t", "asosiy kattalik", [0, 0, 1, 0, 0, 0], "s", "sekund", "mex"),
  q("Tok kuchi", "I", "asosiy kattalik", [0, 0, 0, 1, 0, 0], "A", "amper", "el"),
  q("Absolyut temperatura", "T", "asosiy kattalik", [0, 0, 0, 0, 1, 0], "K", "kelvin", "mol"),
  q("Modda miqdori", "ν", "asosiy kattalik", [0, 0, 0, 0, 0, 1], "mol", "mol", "mol"),
  q("Yuza", "S", "S = a·b", [0, 2, 0, 0, 0, 0], "m²", "", "mex"),
  q("Hajm", "V", "V = a·b·c", [0, 3, 0, 0, 0, 0], "m³", "", "mex"),
  q("Tezlik", "v", "v = s/t", [0, 1, -1, 0, 0, 0], "m/s", "", "mex"),
  q("Tezlanish", "a", "a = Δv/t", [0, 1, -2, 0, 0, 0], "m/s²", "", "mex"),
  q("Aylanish chastotasi", "ν", "ν = N/t", [0, 0, -1, 0, 0, 0], "Hz", "gers", "mex"),
  q("Zichlik", "ρ", "ρ = m/V", [1, -3, 0, 0, 0, 0], "kg/m³", "", "mex"),
  q("Kuch", "F", "F = ma", [1, 1, -2, 0, 0, 0], "N", "nyuton", "mex"),
  q("Jism impulsi", "p", "p = mv", [1, 1, -1, 0, 0, 0], "kg·m/s", "", "mex"),
  q("Bosim", "p", "p = F/S", [1, -1, -2, 0, 0, 0], "Pa", "paskal", "mex"),
  q("Mexanik ish", "A", "A = Fs", [1, 2, -2, 0, 0, 0], "J", "joul", "mex"),
  q("Quvvat", "N", "N = A/t", [1, 2, -3, 0, 0, 0], "W", "vatt", "mex"),
  q("Prujina bikrligi", "k", "F = kx", [1, 0, -2, 0, 0, 0], "N/m", "", "mex"),
  q("Gravitatsiya doimiysi", "G", "F = Gm₁m₂/r²", [-1, 3, -2, 0, 0, 0], "N·m²/kg²", "", "mex"),
  q("Solishtirma issiqlik sig‘imi", "c", "Q = cmΔt", [0, 2, -2, 0, -1, 0], "J/(kg·K)", "", "mol"),
  q("Solishtirma erish issiqligi", "λ", "Q = λm", [0, 2, -2, 0, 0, 0], "J/kg", "", "mol"),
  q("Molyar massa", "M", "M = m/ν", [1, 0, 0, 0, 0, -1], "kg/mol", "", "mol"),
  q("Universal gaz doimiysi", "R", "pV = νRT", [1, 2, -2, 0, -1, -1], "J/(mol·K)", "", "mol"),
  q("Bolsman doimiysi", "k", "Ē = (3/2)kT", [1, 2, -2, 0, -1, 0], "J/K", "", "mol"),
  q("Molekulalar konsentratsiyasi", "n", "n = N/V", [0, -3, 0, 0, 0, 0], "m⁻³", "", "mol"),
  q("Elektr zaryadi", "q", "q = It", [0, 0, 1, 1, 0, 0], "C", "kulon", "el"),
  q("Elektr kuchlanish", "U", "U = A/q", [1, 2, -3, -1, 0, 0], "V", "volt", "el"),
  q("Elektr qarshilik", "R", "R = U/I", [1, 2, -3, -2, 0, 0], "Ω", "om", "el"),
  q("Solishtirma qarshilik", "ρ", "R = ρl/S", [1, 3, -3, -2, 0, 0], "Ω·m", "", "el"),
  q("Elektr sig‘im", "C", "C = q/U", [-1, -2, 4, 2, 0, 0], "F", "farad", "el"),
  q("Elektr maydon kuchlanganligi", "E", "E = F/q", [1, 1, -3, -1, 0, 0], "V/m", "", "el"),
  q("Magnit induksiya", "B", "F = IBl", [1, 0, -2, -1, 0, 0], "T", "tesla", "el"),
  q("Magnit oqimi", "Φ", "Φ = BS", [1, 2, -2, -1, 0, 0], "Wb", "veber", "el"),
  q("Induktivlik", "L", "Φ = LI", [1, 2, -2, -2, 0, 0], "H", "genri", "el"),
  q("Linzaning optik kuchi", "D", "D = 1/F", [0, -1, 0, 0, 0, 0], "dptr", "dioptriya", "opt"),
  q("Plank doimiysi", "h", "E = hν", [1, 2, -1, 0, 0, 0], "J·s", "", "opt"),
  q("Kinetik energiya", "Eₖ", "Eₖ = mv²/2", [1, 2, -2, 0, 0, 0], "J", "joul", "mex"),
  q("Burchak tezlik", "ω", "ω = φ/t", [0, 0, -1, 0, 0, 0], "rad/s", "", "mex"),
  q("Kuch momenti", "M", "M = Fd", [1, 2, -2, 0, 0, 0], "N·m", "", "mex"),
  q("Issiqlik miqdori", "Q", "Q = cmΔt", [1, 2, -2, 0, 0, 0], "J", "joul", "mol"),
  q("Sirt taranglik koeffitsiyenti", "σ", "σ = F/l", [1, 0, -2, 0, 0, 0], "N/m", "", "mol"),
  q("Elektr yurituvchi kuch", "ℰ", "ℰ = A/q", [1, 2, -3, -1, 0, 0], "V", "volt", "el"),
  q("Tebranish davri", "T", "T = t/N", [0, 0, 1, 0, 0, 0], "s", "sekund", "opt"),
  q("To‘lqin uzunligi", "λ", "λ = vT", [0, 1, 0, 0, 0, 0], "m", "metr", "opt"),
];

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");

/** [kg, m, s, …] → "kg·m·s⁻²" (o‘lchamsiz bo‘lsa "1") */
export function formatDims(dims) {
  const parts = dims.map((e, i) => (e === 0 ? "" : e === 1 ? BASE[i] : `${BASE[i]}${sup(e)}`)).filter(Boolean);
  return parts.length ? parts.join("·") : "1";
}

export const sameDims = (a, b) => a.every((e, i) => e === b[i]);

/** Olimlar va kashfiyotlar (Xotira juftlari). */
export const SCIENTISTS = [
  ["Isaak Nyuton", "Butun olam tortishish qonuni"],
  ["Arximed", "Suyuqlikka botirilgan jismga itaruvchi kuch"],
  ["Galileo Galiley", "Erkin tushish tajribalari"],
  ["Iogann Kepler", "Sayyoralar harakati qonunlari"],
  ["Robert Guk", "Elastiklik kuchi qonuni"],
  ["Blez Paskal", "Suyuqlikda bosimning uzatilishi"],
  ["Evanjelista Torrichelli", "Atmosfera bosimini o‘lchash"],
  ["Georg Om", "Zanjir qismi uchun tok qonuni"],
  ["Maykl Faradey", "Elektromagnit induksiya"],
  ["Sharl Kulon", "Nuqtaviy zaryadlarning o‘zaro ta’siri"],
  ["Andre Amper", "Toklarning magnit o‘zaro ta’siri"],
  ["Jeyms Maksvell", "Elektromagnit maydon nazariyasi"],
  ["Genrix Gers", "Elektromagnit to‘lqinlarni tajribada olish"],
  ["Vilgelm Rentgen", "X-nurlar"],
  ["Anri Bekkerel", "Radioaktivlik hodisasi"],
  ["Ernest Rezerford", "Atom yadrosining kashf etilishi"],
  ["Nils Bor", "Atomning kvant modeli"],
  ["Albert Eynshteyn", "Fotoeffekt nazariyasi va nisbiylik nazariyasi"],
  ["Maks Plank", "Energiya kvanti gipotezasi"],
  ["Jeyms Joul", "Issiqlikning mexanik ekvivalenti"],
  ["Abu Rayhon Beruniy", "Yer radiusini o‘lchash"],
  ["Mirzo Ulug‘bek", "“Ziji Ko‘ragoniy” yulduzlar jadvali"],
  ["Kristian Gyuygens", "Yorug‘likning to‘lqin nazariyasi (Gyuygens prinsipi)"],
  ["Tomas Yung", "Yorug‘lik interferensiyasi tajribasi"],
];
