// ==========================================================================
// Yadro fizikasi — fizika (DOM'siz). Energiya MeV, massa u (atom massa birligi).
// 1) Radioaktiv yemirilish: N = N₀·2^(−t/T½), λ = ln2/T½, tasodifiy (har yadro dt da 1 − e^(−λdt) ehtimol bilan),
//    yarim yemirilish davrini o'lchovdan topish (ln N ning chiziqli EKK), radiouglerod yoshi.
// 2) Bog'lanish energiyasi: jadvaldagi haqiqiy qiymatlar (AME2020 bo'yicha, yaxlitlangan) va
//    Bete–Vaytszekker formulasi (boshqa yadrolar uchun), massa defekti Δm = E_b/c², reaksiya energiyasi Q.
// 3) Zanjir reaksiya: ²³⁵U, ²³⁸U, boshqaruv sterjenlari, neytronlar — 2D Monte-Karlo (urug'li tasodifiy son).
// ==========================================================================

export const LN2 = Math.LN2;
export const U_MEV = 931.494, MP = 1.007276, MN = 1.008665, ME = 0.000549;

/* ------------------------------------------------------------------ Tasodifiy sonlar (takrorlanuvchi) */

/** mulberry32 — urug'dan tasodifiy sonlar ketma-ketligi (testlar takrorlanishi uchun). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------------ 1. Radioaktiv yemirilish */

/** Izotoplar: T½ va birligi, yemirilish turi, tenglama. */
export const ISOTOPES = {
  rn222: { name: "Radon-222", sym: "²²²Rn", type: "α", half: 3.82, unit: "kun", eq: "²²²₈₆Rn → ²¹⁸₈₄Po + ⁴₂He", daughter: "²¹⁸Po" },
  c14: { name: "Uglerod-14", sym: "¹⁴C", type: "β⁻", half: 5730, unit: "yil", eq: "¹⁴₆C → ¹⁴₇N + e⁻ + ν̃", daughter: "¹⁴N" },
  i131: { name: "Yod-131", sym: "¹³¹I", type: "β⁻", half: 8.02, unit: "kun", eq: "¹³¹₅₃I → ¹³¹₅₄Xe + e⁻ + ν̃", daughter: "¹³¹Xe" },
  co60: { name: "Kobalt-60", sym: "⁶⁰Co", type: "β⁻", half: 5.27, unit: "yil", eq: "⁶⁰₂₇Co → ⁶⁰₂₈Ni + e⁻ + ν̃ (+ γ)", daughter: "⁶⁰Ni" },
  ra226: { name: "Radiy-226", sym: "²²⁶Ra", type: "α", half: 1600, unit: "yil", eq: "²²⁶₈₈Ra → ²²²₈₆Rn + ⁴₂He", daughter: "²²²Rn" },
  u238: { name: "Uran-238", sym: "²³⁸U", type: "α", half: 4.468e9, unit: "yil", eq: "²³⁸₉₂U → ²³⁴₉₀Th + ⁴₂He", daughter: "²³⁴Th" },
  h3: { name: "Tritiy", sym: "³H", type: "β⁻", half: 12.32, unit: "yil", eq: "³₁H → ³₂He + e⁻ + ν̃", daughter: "³He" },
  po210: { name: "Poloniy-210", sym: "²¹⁰Po", type: "α", half: 138.4, unit: "kun", eq: "²¹⁰₈₄Po → ²⁰⁶₈₂Pb + ⁴₂He", daughter: "²⁰⁶Pb" },
  tc99m: { name: "Texnetsiy-99m", sym: "⁹⁹ᵐTc", type: "γ", half: 6.01, unit: "soat", eq: "⁹⁹ᵐ₄₃Tc → ⁹⁹₄₃Tc + γ", daughter: "⁹⁹Tc" },
};

export const lambdaOf = (half) => LN2 / half;
export const remaining = (N0, t, half) => N0 * 2 ** (-t / half);
export const decayProb = (lambda, dt) => 1 - Math.exp(-lambda * dt);
/** Qolgan ulush bo'yicha yosh: t = T½·log₂(N₀/N). */
export const age = (fraction, half) => half * Math.log2(1 / fraction);

/** Namuna: n ta yadro, har biri yemirilgan vaqti (yoki Infinity). */
export function createSample(n, seed = 1) {
  const r = rng(seed), dt = new Float64Array(n).fill(Infinity);
  let N = n, t = 0;
  return {
    n, get N() { return N; }, get t() { return t; }, decayedAt: dt,
    /** dt vaqt (T½ birliklarida emas — half bilan bir xil birlikda) o'tdi; yemirilgan indekslar qaytariladi. */
    step(h, half) {
      const p = decayProb(lambdaOf(half), h), out = [];
      for (let i = 0; i < n; i++) if (dt[i] === Infinity && r() < p) { dt[i] = t + r() * h; out.push(i); }
      N -= out.length; t += h; return out;
    },
  };
}

/** ln N(t) bo'yicha EKK: T½ = −ln2/qiyalik. Nuqtalar: [{t, N}] (N > 0). */
export function fitHalfLife(pts) {
  const p = pts.filter((q) => q.N > 0);
  if (p.length < 3) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { t, N } of p) { const y = Math.log(N); sx += t; sy += y; sxx += t * t; sxy += t * y; }
  const n = p.length, d = n * sxx - sx * sx; if (!d) return null;
  const k = (n * sxy - sx * sy) / d;
  return k < 0 ? -LN2 / k : null;
}

/* ------------------------------------------------------------------ 2. Bog'lanish energiyasi */

export const SYM = ["n", "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn"];
export const NAME = ["neytron", "Vodorod", "Geliy", "Litiy", "Berilliy", "Bor", "Uglerod", "Azot", "Kislorod", "Ftor", "Neon", "Natriy", "Magniy", "Alyuminiy", "Kremniy", "Fosfor", "Oltingugurt", "Xlor", "Argon", "Kaliy", "Kalsiy", "Skandiy", "Titan", "Vanadiy", "Xrom", "Marganes", "Temir", "Kobalt", "Nikel", "Mis", "Rux"];

const HEAVY = { 36: "Kr", 56: "Ba", 82: "Pb", 92: "U" };
export const symOf = (Z) => SYM[Z] ?? HEAVY[Z] ?? `Z${Z}`;

/** Haqiqiy bog'lanish energiyalari E_b, MeV (AME2020). Kalit: "Z-A". */
export const B_REAL = {
  "1-2": 2.2246, "1-3": 8.4818, "2-3": 7.7180, "2-4": 28.2957, "3-6": 31.9940, "3-7": 39.2446, "4-9": 58.1650,
  "5-10": 64.7507, "5-11": 76.2051, "6-12": 92.1618, "6-13": 97.1080, "6-14": 105.2851, "7-14": 104.6587, "7-15": 115.4919,
  "8-16": 127.6193, "8-17": 131.7627, "8-18": 139.8077, "9-19": 147.8013, "10-20": 160.6448, "11-23": 186.5640,
  "12-24": 198.2569, "13-27": 224.9519, "14-28": 236.5367, "15-31": 262.9166, "16-32": 271.7808, "17-35": 298.2098,
  "18-40": 343.8104, "19-39": 333.7241, "20-40": 342.0521, "26-56": 492.2580, "28-62": 545.2590,
  "36-92": 783.1856, "56-141": 1173.9806, "82-208": 1636.4302, "92-235": 1783.8706, "92-238": 1801.6948,
};
/** Grafik uchun belgili nuqtalar. */
export const MARKED = [["1-2", "²H"], ["2-4", "⁴He"], ["3-7", "⁷Li"], ["6-12", "¹²C"], ["8-16", "¹⁶O"], ["26-56", "⁵⁶Fe"], ["36-92", "⁹²Kr"], ["56-141", "¹⁴¹Ba"], ["82-208", "²⁰⁸Pb"], ["92-235", "²³⁵U"], ["92-238", "²³⁸U"]];

/** Bete–Vaytszekker (tomchi modeli) formulasi, MeV. */
export function semf(Z, A) {
  if (A < 2 || Z < 0 || Z > A) return 0;
  const N = A - Z, aV = 15.75, aS = 17.8, aC = 0.711, aA = 23.7, aP = 11.18;
  const pair = Z % 2 === 0 && N % 2 === 0 ? aP / Math.sqrt(A) : Z % 2 === 1 && N % 2 === 1 ? -aP / Math.sqrt(A) : 0;
  return aV * A - aS * A ** (2 / 3) - (aC * Z * (Z - 1)) / A ** (1 / 3) - (aA * (N - Z) ** 2) / A + pair;
}
/** Bog'lanish energiyasi: jadvalda bo'lsa haqiqiy, aks holda formula. */
export function binding(Z, A) {
  if (A <= 1) return { B: 0, real: true };
  const k = `${Z}-${A}`;
  return k in B_REAL ? { B: B_REAL[k], real: true } : { B: semf(Z, A), real: false };
}
/** Massa defekti (u) va yadro massasi (u). */
export const massDefect = (B) => B / U_MEV;
export const nucleusMass = (Z, A, B) => Z * MP + (A - Z) * MN - massDefect(B);

/** Reaksiya energiyasi: Q = ΣE_b(mahsulotlar) − ΣE_b(boshlang'ich); zarralar [Z, A]. Neytron uchun E_b = 0. */
export const reactionQ = (inp, out) => out.reduce((s, [Z, A]) => s + binding(Z, A).B, 0) - inp.reduce((s, [Z, A]) => s + binding(Z, A).B, 0);
export const REACTIONS = {
  dt: { name: "Termoyadro sintezi D + T", inp: [[1, 2], [1, 3]], out: [[2, 4], [0, 1]], eq: "²H + ³H → ⁴He + n" },
  dd: { name: "Sintez D + D", inp: [[1, 2], [1, 2]], out: [[2, 3], [0, 1]], eq: "²H + ²H → ³He + n" },
  u235: { name: "²³⁵U ning bo‘linishi", inp: [[92, 235], [0, 1]], out: [[56, 141], [36, 92], [0, 1], [0, 1], [0, 1]], eq: "²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n" },
};

/** Z ≤ 20 uchun barqaror izotoplar (⁴⁸Ca amalda barqaror). */
const STABLE = new Set(["1-1", "1-2", "2-3", "2-4", "3-6", "3-7", "4-9", "5-10", "5-11", "6-12", "6-13", "7-14", "7-15", "8-16", "8-17", "8-18", "9-19", "10-20", "10-21", "10-22", "11-23", "12-24", "12-25", "12-26", "13-27", "14-28", "14-29", "14-30", "15-31", "16-32", "16-33", "16-34", "16-36", "17-35", "17-37", "18-36", "18-38", "18-40", "19-39", "19-41", "20-40", "20-42", "20-43", "20-44", "20-46", "20-48"]);
/** Barqarorlik chizig'i: berilgan A uchun eng barqaror Z (formula hosilasidan). */
export const zStable = (A) => A / (1.98 + 0.0155 * A ** (2 / 3));
/**
 * Barqarorlik va kutiladigan yemirilish: Z ≤ 20 — jadval bo'yicha, kattaroq — taxminiy (barqarorlik chizig'idan).
 * Qaytaradi { stable, decay ("β⁻" | "β⁺" | "α" | "p" | "n" | ""), exact }.
 */
export function stability(Z, A) {
  const N = A - Z;
  if (A === 1) return Z === 1 ? { stable: true, decay: "", exact: true } : { stable: false, decay: "β⁻", exact: true };
  if (Z === 0) return { stable: false, decay: "n", exact: true };
  if (N === 0 && Z > 1) return { stable: false, decay: "p", exact: true };
  const dz = Z - zStable(A);
  const dec = A > 209 ? "α" : dz > 0 ? "β⁺" : "β⁻";
  if (Z <= 20) return STABLE.has(`${Z}-${A}`) ? { stable: true, decay: "", exact: true } : { stable: false, decay: A === 8 && Z === 4 ? "α" : A === 5 ? (Z === 2 ? "n" : "p") : dec, exact: true };
  return Math.abs(dz) < 0.75 && A <= 209 ? { stable: true, decay: "", exact: false } : { stable: false, decay: dec, exact: false };
}

/* ------------------------------------------------------------------ 3. Zanjir reaksiya */

export const NU = 2.43, E_FISSION = 200; // o'rtacha neytronlar soni va bitta bo'linish energiyasi (MeV)

/**
 * Faol zona: kenglik w, balandlik h (birlik — shartli), yadrolar to'ri, sterjenlar.
 * o: { w, h, cols, rows, enrich (0..1) yoki kinds[] (235/238), done[], rods: [{x, depth}] (depth 0..1 — yuqoridan), seed, speed }
 * Neytron yadroga tegsa: ²³⁵U — bo'linadi (2 yoki 3 neytron), ²³⁸U — capture ehtimoli bilan yutadi, aks holda sochiladi.
 */
export function createCore(o) {
  const r = rng(o.seed ?? 7), w = o.w, h = o.h, cols = o.cols, rows = o.rows;
  const R = o.hitR ?? 0.1, capture = o.capture ?? 0.35, speed = o.speed ?? 6, rodW = o.rodW ?? 1;
  const nuclei = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = ((i + 0.5) * w) / cols, y = ((j + 0.5) * h) / rows;
    const idx = nuclei.length, kind = o.kinds ? o.kinds[idx] : r() < o.enrich ? 235 : 238;
    nuclei.push({ x, y, kind, done: !!o.done?.[idx] });
  }
  const core = {
    w, h, nuclei, neutrons: [], rods: o.rods || [], t: 0,
    stats: { fissions: 0, born: 0, lost: { leak: 0, rod: 0, cap: 0 } },
    events: [],
    inject(x, y, ang) { core.neutrons.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed }); core.stats.born++; },
    onRod(x, y) { return core.rods.some((d) => Math.abs(x - d.x) < rodW / 2 && y < d.depth * h); },
    step(dt) {
      core.t += dt; core.events = [];
      const keep = [];
      const cellW = w / cols, cellH = h / rows;
      for (const n of core.neutrons) {
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < 0 || n.x > w || n.y < 0 || n.y > h) { core.stats.lost.leak++; continue; }
        if (core.onRod(n.x, n.y)) { core.stats.lost.rod++; core.events.push({ type: "rod", x: n.x, y: n.y }); continue; }
        const i = Math.floor(n.x / cellW), j = Math.floor(n.y / cellH), nu = nuclei[j * cols + i];
        if (nu && !nu.done && (n.x - nu.x) ** 2 + (n.y - nu.y) ** 2 < R * R && !n.skip?.includes(nu)) {
          if (nu.kind === 235) {
            nu.done = true; core.stats.fissions++;
            const m = r() < NU - 2 ? 3 : 2;
            for (let k = 0; k < m; k++) { const a = r() * Math.PI * 2; keep.push({ x: nu.x, y: nu.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, skip: [nu] }); core.stats.born++; }
            core.events.push({ type: "fission", x: nu.x, y: nu.y, m });
            continue;
          }
          if (r() < capture) { nu.done = true; nu.cap = true; core.stats.lost.cap++; core.events.push({ type: "cap", x: nu.x, y: nu.y }); continue; }
          const a = r() * Math.PI * 2; n.vx = Math.cos(a) * speed; n.vy = Math.sin(a) * speed; n.skip = [nu];
        }
        keep.push(n);
      }
      core.neutrons = keep;
    },
    get fuel() { return nuclei.filter((q) => q.kind === 235 && !q.done).length; },
  };
  return core;
}
/**
 * Ko'payish koeffitsiyenti k: bitta neytron (zonaning tasodifiy nuqtasida tug'ilgan) o'rtacha nechta keyingi avlod
 * neytronini hosil qiladi; bolalar kuzatilmaydi. o.kinds / o.done berilsa — aynan shu (qisman yongan) zona uchun,
 * o.starts (hozirgi neytronlar o'rni) berilsa — neytronlar shu nuqtalardan boshlanadi (joriy k).
 */
export function measureK(o, trials = 400, seed = 11) {
  const r = rng(seed); let sum = 0;
  for (let k = 0; k < trials; k++) {
    const c = createCore({ ...o, seed: seed * 1000 + k });
    const s0 = o.starts?.length ? o.starts[Math.floor(r() * o.starts.length)] : { x: r() * o.w, y: r() * o.h };
    c.inject(s0.x, s0.y, r() * Math.PI * 2); c.stats.born = 0;
    for (let i = 0; i < 6000 && c.neutrons.length === 1 && !c.stats.fissions; i++) c.step(1 / 60);
    sum += c.stats.fissions ? c.neutrons.length : 0;
  }
  return sum / trials;
}
