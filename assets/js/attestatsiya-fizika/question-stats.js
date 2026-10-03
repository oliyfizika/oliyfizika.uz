// ==========================================================================
// Attestatsiya → Fizika: savollar kesimidagi statistika (faqat ADMIN paneli uchun, sof hisob — DOM/Firebase yo'q).
//
// Manba: attestationPhysicsAttempts (real urinishlar) + keys/v{n} (kanonik tartib va ballga kiruvchi savollar).
// Hech narsa yozilmaydi; yangi collection yo'q.
//
// HISOBGA OLINADIGAN URINISH: testId == test, testVersion == tanlangan versiya, kind == "official",
// status == "graded". in_progress / submitted (baholanmagan) / boshqa versiya / versiyasiz — kirmaydi.
// testVersion taxmin qilinmaydi: maydoni yo'q urinish hech qaysi versiyaga qo'shilmaydi.
//
// SAVOL HOLATI (ballga kiruvchi savol, ya'ni key.answers da bor):
//   to'g'ri    — correctIds da (Rules baholashda kalit bilan tasdiqlagan ro'yxat);
//   noto'g'ri  — wrongIds da;
//   javobsiz   — ikkalasida ham yo'q (foydalanuvchi javob bermagan).
//   correctIds/wrongIds bo'lmagan eski urinish: answers (yoki selectedAnswers) shu versiya kaliti bilan
//   gradeAnswers() orqali solishtiriladi (Rules bilan bir xil algoritm; urinish o'zgartirilmaydi).
//   Ballga kirmaydigan savol (kalitda yo'q) — foizsiz, «Ballga kirmaydi».
//
// FORMULA (maxraj — barcha hisobga olingan urinishlar N, javobsizlar ham kiradi):
//   to'g'ri %   = to'g'ri   / N × 100
//   xato %      = noto'g'ri / N × 100
//   javobsiz %  = javobsiz  / N × 100        (uchalasi yig'indisi = N)
// Bu natija foizi (scorePercent = to'g'ri / ballga kiruvchi savollar) bilan bir xil semantika: javobsiz — to'g'ri emas.
// Ko'rsatish uchun butun songa yaxlitlanadi (Math.round). N = 0 bo'lsa foiz HISOBLANMAYDI (null) — 0 % emas.
// ==========================================================================
import { gradeAnswers } from "./core.js";

export const pct = (part, total) => (total > 0 ? Math.round((part * 100) / total) : null);

/** Urinish shu test + versiya statistikasiga kiradimi (rasmiy, baholangan). */
export function isCountedAttempt(a, testId, version) {
  return !!a && a.testId === testId && a.testVersion === version && a.kind === "official" && a.status === "graded";
}

/**
 * @param {{testId:string, version:number, questionIds:string[], answers:Record<string,string>, scorableCount:number}} key
 * @param {object[]} attempts  — istalgan urinishlar (filtr shu yerda qo'llanadi)
 * @returns {{testId, version, attempts:number, regraded:number, excluded:number, questionCount:number,
 *            scorableCount:number, rows:object[], mostWrong:object[], mostUnanswered:object[]}}
 */
export function computeQuestionStats(key, attempts, { top = 10 } = {}) {
  const testId = key?.testId;
  const version = key?.version;
  const order = Array.isArray(key?.questionIds) ? key.questionIds : [];
  const scorable = key?.answers && typeof key.answers === "object" ? key.answers : {};
  const list = Array.isArray(attempts) ? attempts : [];
  const counted = list.filter((a) => isCountedAttempt(a, testId, version));
  // Takroriy questionId (buzilgan kalit) ikki marta sanalmaydi: hisob unikal ID bo'yicha, ko'rsatish — birinchi pozitsiyada.
  const acc = new Map();
  for (const q of order) if (!acc.has(q)) acc.set(q, { correct: 0, wrong: 0, unanswered: 0 });
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  let regraded = 0;
  for (const a of counted) {
    let correctIds = a.correctIds;
    let wrongIds = a.wrongIds;
    if (!Array.isArray(correctIds) || !Array.isArray(wrongIds)) {
      const ans = isObj(a.answers) ? a.answers : isObj(a.selectedAnswers) ? a.selectedAnswers : {};
      const g = gradeAnswers(ans, { answers: scorable, scorableCount: Object.keys(scorable).length }, order.length);
      ({ correctIds, wrongIds } = g);
      regraded++;
    }
    const c = new Set(correctIds);
    const w = new Set(wrongIds);
    for (const [q, s] of acc) {
      if (!(q in scorable)) continue;
      if (c.has(q)) s.correct++;
      else if (w.has(q)) s.wrong++;
      else s.unanswered++;
    }
  }
  const n = counted.length;
  const seen = new Set();
  const rows = order.map((q, i) => {
    const s = acc.get(q);
    const scored = q in scorable && !seen.has(q);
    const duplicate = seen.has(q);
    seen.add(q);
    return {
      duplicate,
      questionId: q,
      number: i + 1,                       // kanonik tartib (keys/v{n}.questionIds) — test sahifasidagi raqam
      scored,
      total: scored ? n : 0,
      ...s,
      correctPct: scored ? pct(s.correct, n) : null,
      wrongPct: scored ? pct(s.wrong, n) : null,
      unansweredPct: scored ? pct(s.unanswered, n) : null,
    };
  });
  const ranked = (field, pf) => rows
    .filter((r) => r.scored && r[field] > 0)
    .sort((a, b) => b[field] - a[field] || a.number - b.number)   // teng bo'lsa — kanonik tartib
    .slice(0, top)
    .map((r) => ({ number: r.number, questionId: r.questionId, count: r[field], pct: r[pf] }));
  return {
    testId,
    version,
    attempts: n,
    regraded,
    excluded: list.length - n,
    questionCount: order.length,
    scorableCount: [...acc.keys()].filter((q) => q in scorable).length,
    rows,
    mostWrong: n ? ranked("wrong", "wrongPct") : [],
    mostUnanswered: n ? ranked("unanswered", "unansweredPct") : [],
  };
}
