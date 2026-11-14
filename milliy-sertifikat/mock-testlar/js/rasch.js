// ==========================================================================
// Milliy sertifikat mock testlari: Rasch modeli bo'yicha baholash (sof modul — DOM/Firebase yo'q, Node'da testlanadi).
//
// Model (dixotomik Rasch): P(X_ni = 1) = exp(θ_n − b_i) / (1 + exp(θ_n − b_i))
//   θ_n — ishtirokchi qobiliyati, b_i — band (item) qiyinligi, ikkalasi logitda.
//   Band: MCQ savol = 1 band, ochiq savolning har bir qismi (a, b) = alohida band (scoring.js gradeLocal().atomic).
//
// Baholash: JMLE (Joint Maximum Likelihood, Winsteps uslubi):
//   1) PROX bilan boshlang'ich qiymatlar;
//   2) Newton–Raphson iteratsiyalari (qadam ±1 logit bilan cheklangan), bandlar o'rtachasi 0 ga markazlanadi;
//   3) ekstremal bandlar (hamma to'g'ri / hamma xato) va ekstremal ishtirokchilar (0 yoki maksimal) baholashdan chiqariladi;
//      ekstremal ishtirokchilar keyin r = 0,3 / L − 0,3 tuzatilgan ball bilan baholanadi (Winsteps EXTRSC = 0,3);
//   4) JMLE siljishi uchun (L − 1)/L tuzatish, so'ng θ lar tuzatilgan b lar bilan qayta baholanadi.
//
// Shkala (Milliy sertifikat uslubidagi T-ball): Z = (θ − θ̄)/σθ, T = 50 + 10·Z, [0; 75] oralig'ida, 2 xona.
//   Shuning uchun natija ishtirokchilar to'plamiga bog'liq (norma bo'yicha) — yetarli ishtirokchi kerak.
// Daraja (egasi bergan jadval): ≥70 A+, 65–69,9 A, 60–64,9 B+, 55–59,9 B, 50–54,9 C+, 46–49,9 C, <46 — daraja yo'q.
// Foiz: A+ chegarasiga (70) nisbatan, 100% bilan cheklangan (namuna sertifikatda 70,07 → 100%).
// ==========================================================================

export const SCALE = Object.freeze({ mean: 50, sd: 10, min: 0, max: 75, percentBase: 70 });

export const LEVELS = Object.freeze([
  { min: 70, label: "A+" },
  { min: 65, label: "A" },
  { min: 60, label: "B+" },
  { min: 55, label: "B" },
  { min: 50, label: "C+" },
  { min: 46, label: "C" },
]);

/** Minimal ishtirokchi soni (undan kam bo'lsa hisoblanmaydi) va tavsiya etiladigan son (undan kam — ogohlantirish). */
export const MIN_PARTICIPANTS = 5;
export const RECOMMENDED_PARTICIPANTS = 30;

const EXTREME_ADJ = 0.3;
const MAX_STEP = 1;
const round2 = (x) => Math.round(x * 100) / 100;
const logistic = (x) => 1 / (1 + Math.exp(-x));

/** Rasch balli → daraja ("A+" ... "C") yoki null (46 dan past). */
export function levelOf(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return null;
  const hit = LEVELS.find((l) => s >= l.min - 1e-9);
  return hit ? hit.label : null;
}

/** Umumiy ballga nisbatan foiz (A+ chegarasi = 100%). */
export function percentOf(score) {
  const s = Number(score);
  if (!Number.isFinite(s) || s <= 0) return 0;
  return Math.min(100, round2((s / SCALE.percentBase) * 100));
}

/** Berilgan qiyinliklar bilan bitta ishtirokchi θ sini topish (MLE, Newton–Raphson). r — (tuzatilgan) xom ball. */
export function estimateAbility(r, bs, start = 0) {
  const L = bs.length;
  if (!L) return { theta: 0, se: Infinity };
  const rr = Math.min(Math.max(r, EXTREME_ADJ), L - EXTREME_ADJ);
  let th = Number.isFinite(start) ? start : 0;
  for (let it = 0; it < 200; it++) {
    let e = 0;
    let v = 0;
    for (const b of bs) {
      const p = logistic(th - b);
      e += p;
      v += p * (1 - p);
    }
    const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, (rr - e) / Math.max(v, 1e-9)));
    th += step;
    if (Math.abs(step) < 1e-7) break;
  }
  let v = 0;
  for (const b of bs) {
    const p = logistic(th - b);
    v += p * (1 - p);
  }
  return { theta: th, se: 1 / Math.sqrt(Math.max(v, 1e-12)) };
}

/**
 * JMLE baholash.
 * @param {number[][]} X — N×L matritsa (1 = to'g'ri, 0 = xato/bo'sh). Barcha qatorlar bir xil uzunlikda.
 * @returns {{ theta:number[], thetaSE:number[], b:(number|null)[], bSE:(number|null)[], itemStatus:string[],
 *             personExtreme:string[], iterations:number, converged:boolean, reliability:number|null, estimatedItems:number }}
 *   itemStatus: "ok" | "all-correct" | "all-wrong" (ekstremal bandlar b = null, θ ga ta'sir qilmaydi).
 *   personExtreme: "" | "min" | "max" (baholanadigan bandlar bo'yicha).
 */
export function estimateRasch(X, { maxIter = 500, tol = 1e-5, biasCorrection = true } = {}) {
  const N = X.length;
  if (!N) throw new Error("Ishtirokchilar yo‘q");
  const L = X[0].length;
  if (!L || X.some((row) => row.length !== L)) throw new Error("Javoblar matritsasi noto‘g‘ri");
  const x = X.map((row) => row.map((v) => (v ? 1 : 0)));

  // 1) ekstremal bandlar
  const itemScore = new Array(L).fill(0);
  x.forEach((row) => row.forEach((v, i) => { itemScore[i] += v; }));
  const itemStatus = itemScore.map((s) => (s === 0 ? "all-wrong" : s === N ? "all-correct" : "ok"));
  const items = itemStatus.map((s, i) => (s === "ok" ? i : -1)).filter((i) => i >= 0);
  const Le = items.length;

  const raw = x.map((row) => items.reduce((s, i) => s + row[i], 0));
  const personExtreme = raw.map((r) => (Le === 0 ? "min" : r === 0 ? "min" : r === Le ? "max" : ""));
  const persons = raw.map((r, n) => (personExtreme[n] ? -1 : n)).filter((n) => n >= 0);

  const b = new Array(L).fill(null);
  const bSE = new Array(L).fill(null);
  const theta = new Array(N).fill(0);
  const thetaSE = new Array(N).fill(Infinity);

  if (Le === 0) {
    return { theta, thetaSE, b, bSE, itemStatus, personExtreme, iterations: 0, converged: false, reliability: null, estimatedItems: 0 };
  }

  // Bandlar ham o'zgarmas ishtirokchilar to'plamiga nisbatan yana ekstremal bo'lib qolishi mumkin (masalan, faqat ekstremal
  // ishtirokchilar to'g'ri yechgan band). Bunday bandlarni ham chiqaramiz (iterativ tozalash).
  let activeItems = items.slice();
  let activePersons = persons.slice();
  for (let guard = 0; guard < 50; guard++) {
    const iScore = activeItems.map((i) => activePersons.reduce((s, n) => s + x[n][i], 0));
    const keepI = activeItems.filter((_, k) => iScore[k] > 0 && iScore[k] < activePersons.length);
    const pScore = activePersons.map((n) => keepI.reduce((s, i) => s + x[n][i], 0));
    const keepP = activePersons.filter((_, k) => pScore[k] > 0 && pScore[k] < keepI.length);
    if (keepI.length === activeItems.length && keepP.length === activePersons.length) break;
    activeItems = keepI;
    activePersons = keepP;
  }

  let iterations = 0;
  let converged = false;
  const bAct = new Map();
  const thAct = new Map();

  if (activeItems.length >= 2 && activePersons.length >= 2) {
    // 2) PROX boshlang'ich qiymatlar
    const nP = activePersons.length;
    const nI = activeItems.length;
    activeItems.forEach((i) => {
      const s = activePersons.reduce((acc, n) => acc + x[n][i], 0);
      bAct.set(i, Math.log((nP - s) / s));
    });
    const meanB = [...bAct.values()].reduce((a, v) => a + v, 0) / nI;
    bAct.forEach((v, i) => bAct.set(i, v - meanB));
    activePersons.forEach((n) => {
      const r = activeItems.reduce((acc, i) => acc + x[n][i], 0);
      thAct.set(n, Math.log(r / (nI - r)));
    });

    // 3) JMLE Newton–Raphson
    for (iterations = 1; iterations <= maxIter; iterations++) {
      let maxChange = 0;
      // ishtirokchilar
      activePersons.forEach((n) => {
        const r = activeItems.reduce((acc, i) => acc + x[n][i], 0);
        let e = 0;
        let v = 0;
        const th = thAct.get(n);
        activeItems.forEach((i) => {
          const p = logistic(th - bAct.get(i));
          e += p;
          v += p * (1 - p);
        });
        const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, (r - e) / Math.max(v, 1e-9)));
        thAct.set(n, th + step);
        maxChange = Math.max(maxChange, Math.abs(step));
      });
      // bandlar
      activeItems.forEach((i) => {
        const s = activePersons.reduce((acc, n) => acc + x[n][i], 0);
        let e = 0;
        let v = 0;
        const bi = bAct.get(i);
        activePersons.forEach((n) => {
          const p = logistic(thAct.get(n) - bi);
          e += p;
          v += p * (1 - p);
        });
        const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, (e - s) / Math.max(v, 1e-9)));
        bAct.set(i, bi + step);
        maxChange = Math.max(maxChange, Math.abs(step));
      });
      const mean = [...bAct.values()].reduce((a, v) => a + v, 0) / nI;
      bAct.forEach((v, i) => bAct.set(i, v - mean));
      activePersons.forEach((n) => thAct.set(n, thAct.get(n) - mean));
      if (maxChange < tol) { converged = true; break; }
    }
    if (biasCorrection && nI > 1) {
      const k = (nI - 1) / nI;
      bAct.forEach((v, i) => bAct.set(i, v * k));
    }
  } else {
    // Juda kichik to'plam: PROX ham ishlamaydi — bandlar faqat p-qiymatdan (logit) olinadi.
    const nP = Math.max(1, persons.length || N);
    items.forEach((i) => {
      const s = Math.min(Math.max(itemScore[i], 0.5), nP - 0.5);
      bAct.set(i, Math.log((nP - s) / s));
    });
    const meanB = [...bAct.values()].reduce((a, v) => a + v, 0) / bAct.size;
    bAct.forEach((v, i) => bAct.set(i, v - meanB));
    converged = true;
  }

  // Faol to'plamdan tashqari qolgan (lekin global ekstremal bo'lmagan) bandlar: ekstremal bo'lgan tomonga 1 logit qo'yamiz.
  const bVals = [...bAct.values()];
  const bMin = Math.min(...bVals);
  const bMax = Math.max(...bVals);
  items.forEach((i) => {
    if (bAct.has(i)) return;
    const allOk = persons.every((n) => x[n][i] === 1);
    bAct.set(i, allOk ? bMin - 1 : bMax + 1);
  });

  const bs = items.map((i) => bAct.get(i));
  items.forEach((i, k) => { b[i] = bs[k]; });

  // 4) θ — yakuniy (tuzatilgan) qiyinliklar bilan; ekstremal ishtirokchilar r = 0,3 / L − 0,3
  for (let n = 0; n < N; n++) {
    const r = raw[n];
    const est = estimateAbility(personExtreme[n] === "min" ? EXTREME_ADJ : personExtreme[n] === "max" ? Le - EXTREME_ADJ : r, bs, thAct.get(n) ?? 0);
    theta[n] = est.theta;
    thetaSE[n] = est.se;
  }

  // Band SE
  items.forEach((i) => {
    let v = 0;
    for (let n = 0; n < N; n++) {
      const p = logistic(theta[n] - b[i]);
      v += p * (1 - p);
    }
    bSE[i] = 1 / Math.sqrt(Math.max(v, 1e-12));
  });

  // Ishtirokchilar ajratish ishonchliligi (person separation reliability)
  let reliability = null;
  const nonExt = theta.filter((_, n) => !personExtreme[n]);
  if (nonExt.length >= 2) {
    const m = nonExt.reduce((a, v) => a + v, 0) / nonExt.length;
    const obsVar = nonExt.reduce((a, v) => a + (v - m) ** 2, 0) / (nonExt.length - 1);
    const errVar = thetaSE.filter((_, n) => !personExtreme[n]).reduce((a, se) => a + se * se, 0) / nonExt.length;
    reliability = obsVar > 0 ? Math.max(0, Math.min(1, (obsVar - errVar) / obsVar)) : 0;
  }

  return { theta, thetaSE, b, bSE, itemStatus, personExtreme, iterations, converged, reliability, estimatedItems: Le };
}

/** θ lar → T-ball (50 + 10Z), [0; 75]. Hamma θ bir xil bo'lsa — hamma 50. */
export function toScaledScores(thetas) {
  const n = thetas.length;
  if (!n) return [];
  const mean = thetas.reduce((a, v) => a + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(thetas.reduce((a, v) => a + (v - mean) ** 2, 0) / n) : 0;
  return thetas.map((th) => {
    const z = sd > 1e-9 ? (th - mean) / sd : 0;
    return round2(Math.min(SCALE.max, Math.max(SCALE.min, SCALE.mean + SCALE.sd * z)));
  });
}

/**
 * Bo'limlar bo'yicha taqsimot: umumiy ball to'g'ri yechilgan bandlar ulushiga ko'ra bo'limlarga bo'linadi.
 * Band og'irligi = qiyinlik bo'yicha (b − b_min + 1): qiyinroq band ko'proq hissa qo'shadi. Yig'indi = umumiy ball.
 * @param {number} total — T-ball
 * @param {number[]} row — ishtirokchining atomik javoblari (0/1)
 * @param {(number|null)[]} b — band qiyinliklari (null — ekstremal band)
 * @param {string[]} itemSections — har bir bandning bo'lim id si
 * @param {string[]} order — bo'limlar tartibi
 * @returns {{id:string, score:number}[]}
 */
export function sectionBreakdown(total, row, b, itemSections, order) {
  const finite = b.filter((v) => Number.isFinite(v));
  const bMin = finite.length ? Math.min(...finite) : 0;
  const bMax = finite.length ? Math.max(...finite) : 0;
  const w = b.map((v, i) => {
    if (Number.isFinite(v)) return v - bMin + 1;
    // ekstremal band: hamma yechgan — eng yengil og'irlik, hech kim yechmagan — eng og'ir
    return row[i] ? (bMax - bMin + 2) : 1;
  });
  const sums = new Map(order.map((id) => [id, 0]));
  let all = 0;
  row.forEach((v, i) => {
    if (!v) return;
    const id = itemSections[i];
    if (!sums.has(id)) sums.set(id, 0);
    sums.set(id, sums.get(id) + w[i]);
    all += w[i];
  });
  const ids = [...sums.keys()];
  if (!all || total <= 0) return ids.map((id) => ({ id, score: 0 }));
  // 3 xona aniqlikda, yig'indi aynan total bo'lishi uchun qoldiq eng katta bo'limga qo'shiladi
  const out = ids.map((id) => ({ id, score: Math.round((total * sums.get(id) / all) * 1000) / 1000 }));
  const diff = Math.round((total - out.reduce((a, s) => a + s.score, 0)) * 1000) / 1000;
  if (diff) {
    const big = out.reduce((m, s) => (s.score > m.score ? s : m), out[0]);
    big.score = Math.round((big.score + diff) * 1000) / 1000;
  }
  return out;
}

/**
 * To'liq hisob: matritsa → har bir ishtirokchi uchun natija.
 * @returns {{ persons: {raw:number, theta:number, se:number, score:number, level:string|null, percent:number}[], model: object }}
 */
export function scoreSession(X) {
  const model = estimateRasch(X);
  const scores = toScaledScores(model.theta);
  const persons = X.map((row, n) => ({
    raw: row.reduce((a, v) => a + (v ? 1 : 0), 0),
    theta: Math.round(model.theta[n] * 10000) / 10000,
    se: Number.isFinite(model.thetaSE[n]) ? Math.round(model.thetaSE[n] * 10000) / 10000 : null,
    score: scores[n],
    level: levelOf(scores[n]),
    percent: percentOf(scores[n]),
  }));
  return { persons, model };
}
