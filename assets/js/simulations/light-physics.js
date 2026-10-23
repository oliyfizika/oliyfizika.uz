// ==========================================================================
// Yorug'likning to'g'ri chiziqli tarqalishi — fizika (DOM'siz).
// 1) Soya va yarim soya: disk shaklidagi manba (diametri a) va shar/disk buyum (diametri b) — ekrandagi yoritilganlik
//    manbaning ko'rinadigan qismi ulushi sifatida (doiralar kesishish yuzasi, aniq formula).
// 2) Kamera-obskura: tasvir o'lchami H = h·f/d, geometrik dog' p(1 + f/d), difraksion dog' 2,44·λf/p.
// 3) Quyosh va Oy tutilishi: haqiqiy burchak o'lchamlari (Quyosh 0,2666°, Oy 0,245°–0,279°), Oy orbitasining 5,145° og'ishi,
//    Oy gorizontal parallaksi, Yer soyasi (Danjon 1,02 kattalashtirish).
// ==========================================================================

export const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ Geometriya */

/** Radiuslari R va r bo'lgan, markazlari orasi d bo'lgan doiralar kesishish yuzasi. */
export function circleOverlap(R, r, d) {
  if (R <= 0 || r <= 0) return 0;
  if (d >= R + r) return 0;
  if (d <= Math.abs(R - r)) return Math.PI * Math.min(R, r) ** 2;
  const a = Math.acos(Math.max(-1, Math.min(1, (d * d + R * R - r * r) / (2 * d * R))));
  const b = Math.acos(Math.max(-1, Math.min(1, (d * d + r * r - R * R) / (2 * d * r))));
  return R * R * (a - Math.sin(2 * a) / 2) + r * r * (b - Math.sin(2 * b) / 2);
}

/* ------------------------------------------------------------------ 1) Soya */

/**
 * Ekran nuqtasidan (x = L, koordinatalar y, z) manbaning ko'rinadigan ulushi (0…1).
 * src: { x: 0, y, a } — manba markazi va diametri (a = 0 — nuqtaviy); obj: { x, y, b } — buyum markazi va diametri.
 */
export function visibleFraction(src, obj, L, y, z = 0) {
  if (obj.x <= src.x || obj.x >= L) return 1;
  const t = (L - src.x) / (L - obj.x); // ekran nuqtasidan buyum orqali manba tekisligigacha
  const cy = y + (obj.y - y) * t, cz = z + (0 - z) * t;
  const r = (obj.b / 2) * t, R = src.a / 2;
  const dist = Math.hypot(cy - src.y, cz);
  if (R < 1e-9) return dist > r ? 1 : 0;
  return 1 - circleOverlap(R, r, dist) / (Math.PI * R * R);
}

/** Bir nechta manbadan yoritilganlik (har bir manba bir xil kuchli, natija 0…1). */
export function illumination(srcs, obj, L, y, z = 0) {
  let s = 0;
  for (const S of srcs) s += visibleFraction(S, obj, L, y, z);
  return s / srcs.length;
}

/**
 * Soya chegaralari ekranda (yon ko'rinish, bitta manba). Qaytaradi:
 * { uTop, uBot (umbra; uTop < uBot bo'lsa umbra yo'q), pTop, pBot, umbra: diametr ≥ 0, pen: tashqi diametr, apex: umbra konusining uchi x }
 */
export function shadowEdges(src, obj, L) {
  const A = src.a / 2, B = obj.b / 2, d = obj.x - src.x, k = (L - src.x) / d;
  const line = (y0, y1) => y0 + (y1 - y0) * k;  // manbadagi y0 nuqtadan buyumdagi y1 orqali ekrangacha
  const uTop = line(src.y + A, obj.y + B), uBot = line(src.y - A, obj.y - B);
  const pTop = line(src.y - A, obj.y + B), pBot = line(src.y + A, obj.y - B);
  const apex = A > B ? src.x + (A * d) / (A - B) : Infinity;
  return { uTop, uBot, pTop, pBot, umbra: Math.max(0, uTop - uBot), pen: pTop - pBot, apex };
}
/** Umbra va yarim soya diametrlari (tahliliy): D_u = b + (b − a)(L − d)/d, D_p = b + (b + a)(L − d)/d. */
export const umbraDiameter = (a, b, d, L) => Math.max(0, b + ((b - a) * (L - d)) / d);
export const penumbraDiameter = (a, b, d, L) => b + ((b + a) * (L - d)) / d;

/* ------------------------------------------------------------------ 2) Kamera-obskura */

export const LAMBDA = 550e-9; // m, yashil yorug'lik

/** Tasvir balandligi (teskari): H = h·f/d. */
export const pinholeImage = (h, d, f) => (h * f) / d;
/** Geometrik dog' (ekranda): teshik diametri p, buyumgacha d, kamera chuqurligi f — p·(d + f)/d. */
export const geoBlur = (p, d, f) => (p * (d + f)) / d;
/** Difraksion dog' (Eyri diskining diametri): 2,44·λ·f/p (SI). */
export const diffBlur = (p, f, lambda = LAMBDA) => (2.44 * lambda * f) / p;
/** Umumiy dog' (kvadratik yig'indi). */
export const totalBlur = (p, d, f, lambda = LAMBDA) => Math.hypot(geoBlur(p, d, f), diffBlur(p, f, lambda));
/** Eng aniq tasvir beradigan teshik: p_opt = √(2,44·λ·f / (1 + f/d)). */
export const optimalPinhole = (d, f, lambda = LAMBDA) => Math.sqrt((2.44 * lambda * f) / (1 + f / d));

/* ------------------------------------------------------------------ 3) Tutilishlar */

export const ECL = {
  rSun: 959.63 / 3600,      // Quyosh burchak radiusi, gradus (1 a.b.)
  piSun: 8.794 / 3600,      // Quyosh gorizontal parallaksi, gradus
  Rmoon: 1737.4, Rearth: 6378.1, // km
  incl: 5.145,              // Oy orbitasining ekliptikaga og'ishi, gradus
  month: 29.530589,         // sinodik oy, sutka
  eclYear: 346.620,         // tutilish yili (Quyosh tugundan tugungacha), sutka
  Dmin: 356500, Dmax: 406700, Dmean: 384400,
};

/** Oyning burchak radiusi (gradus) va gorizontal parallaksi (gradus) masofa D (km) da. */
export const moonRadius = (D) => Math.asin(ECL.Rmoon / D) / DEG;
export const moonParallax = (D) => Math.asin(ECL.Rearth / D) / DEG;

/**
 * Tutilish holati. E — elongatsiya (Oy va Quyosh uzunliklari farqi, gradus; 0 — yangi oy, 180 — to'lin oy),
 * node — Oy orbitasi ko'tariluvchi tugunining Quyoshga nisbatan uzunligi (gradus), D — Oygacha masofa (km).
 */
export function eclipseState(E, node, D = ECL.Dmean) {
  const u = (E - node) * DEG; // kenglik argumenti
  const beta = Math.asin(Math.sin(ECL.incl * DEG) * Math.sin(u)) / DEG;
  const cb = Math.cos(beta * DEG), ce = Math.cos(E * DEG);
  const sepSun = Math.acos(Math.max(-1, Math.min(1, cb * ce))) / DEG;   // Quyosh va Oy markazlari orasidagi burchak (geotsentrik)
  const sepAnti = Math.acos(Math.max(-1, Math.min(1, -cb * ce))) / DEG; // Oy va Yer soyasi markazi orasidagi burchak
  const rS = ECL.rSun, rM = moonRadius(D), piM = moonParallax(D);
  // Quyosh tutilishi: Oy soyasi o'qiga eng yaqin joydagi kuzatuvchi (parallaks tufayli siljish ≤ π_M)
  const sObs = Math.max(0, sepSun - piM);
  let solar = { type: "none", mag: 0, obsc: 0, sep: sObs, rS, rM };
  if (sObs < rS + rM) {
    const obsc = circleOverlap(rS, rM, sObs) / (Math.PI * rS * rS);
    const mag = (rS + rM - sObs) / (2 * rS);
    const type = sObs + rS <= rM ? "total" : sObs + rM <= rS ? "annular" : "partial";
    solar = { type, mag, obsc, sep: sObs, rS, rM };
  }
  // Oy tutilishi: Yer soyasi (umbra) va yarim soyasi radiuslari Oy masofasida
  const rhoU = 1.02 * (piM + ECL.piSun - rS), rhoP = 1.02 * (piM + ECL.piSun + rS);
  let lunar = { type: "none", magU: (rhoU + rM - sepAnti) / (2 * rM), magP: (rhoP + rM - sepAnti) / (2 * rM), sep: sepAnti, rhoU, rhoP, rM };
  if (sepAnti + rM <= rhoU) lunar.type = "total";
  else if (sepAnti - rM < rhoU) lunar.type = "partial";
  else if (sepAnti - rM < rhoP) lunar.type = "penumbral";
  return { beta, sepSun, sepAnti, solar, lunar, rM, piM };
}

/** Oy fazasi: yoritilgan qism ulushi k = (1 − cos E)/2. */
export const moonPhase = (E) => (1 - Math.cos(E * DEG)) / 2;

/**
 * Bir yil davomidagi yangi va to'lin oylar: boshlang'ich E0, tugun node0 (gradus), D (km).
 * Oy elongatsiyasi 360°/sinodik oy, tugun Quyoshga nisbatan −360°/tutilish yili tezlikda siljiydi.
 * Qaytaradi [{ day, kind: "new"|"full", st }].
 */
export function yearSyzygies(E0, node0, D = ECL.Dmean, days = 365) {
  const out = [], wE = 360 / ECL.month, wN = -360 / ECL.eclYear;
  // birinchi yangi oy vaqti
  let t0 = ((((-E0) % 360) + 360) % 360) / wE;
  for (let k = -1; k < 30; k++) {
    for (const [off, kind] of [[0, "new"], [ECL.month / 2, "full"]]) {
      const t = t0 + k * ECL.month + off;
      if (t < 0 || t > days) continue;
      const E = kind === "new" ? 0 : 180;
      const node = node0 + wN * t;
      out.push({ day: t, kind, st: eclipseState(E, node, D) });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}
