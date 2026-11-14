// ==========================================================================
// Milliy sertifikat: sessiyani yakunlash — sof hisob qismi (DOM/Firebase yo'q, Node'da testlanadi).
// Admin sahifasi (assets/js/admin/ms-sessions.js) Firestore'dan urinishlarni o'qib shu funksiyaga beradi va natijani yozadi.
//
// Qadamlar:
//   1) har bir urinish mavjud gradeLocal() bilan baholanadi (MCQ = 1 band, ochiq savol qismlari alohida band);
//   2) bitta ham javob bermaganlar Rasch hisobidan chiqariladi (natija: «javob berilmagan»);
//   3) qolganlar matritsasi → rasch.scoreSession() (JMLE → T-ball 0–75 → daraja, foiz);
//   4) bo'limlar bo'yicha taqsimot (sections.js) va o'rin (rank).
// ==========================================================================
import { gradeLocal, countFilledItems } from "./scoring.js";
import { scoreSession, sectionBreakdown, MIN_PARTICIPANTS, RECOMMENDED_PARTICIPANTS } from "./rasch.js";
import { itemSections, sectionsOfTest, sectionLabel } from "./sections.js";
import { restoreAnswers } from "./session-service.js";

const r3 = (x) => Math.round(x * 1000) / 1000;

/**
 * @param {object} test — mock-test-N.json
 * @param {{id:string, uid:string, name?:string, status:string, answers?:object}[]} attempts
 * @returns {{ rows: {attemptId:string, uid:string, result:object}[], stats: object, warnings: string[] }}
 */
export function computeSessionResults(test, attempts) {
  const warnings = [];
  const graded = attempts.map((a) => {
    const answers = restoreAnswers(a.answers);
    return { a, grade: gradeLocal(test, answers), filled: countFilledItems(test.questions, answers) };
  });
  const scored = graded.filter((g) => g.filled > 0);
  const empty = graded.filter((g) => g.filled === 0);
  if (scored.length < MIN_PARTICIPANTS) {
    throw new Error(`Rasch hisobi uchun kamida ${MIN_PARTICIPANTS} ta javob bergan ishtirokchi kerak (hozir ${scored.length}).`);
  }
  if (scored.length < RECOMMENDED_PARTICIPANTS) {
    warnings.push(`Ishtirokchilar soni ${scored.length} ta — ishonchli Rasch bahosi uchun kamida ${RECOMMENDED_PARTICIPANTS} ta tavsiya etiladi.`);
  }

  const X = scored.map((g) => g.grade.atomic);
  const { persons, model } = scoreSession(X);
  const secOf = itemSections(test);
  const order = sectionsOfTest(test);
  const N = scored.length;
  const sortedScores = persons.map((p) => p.score).sort((x, y) => y - x);
  const rankOf = (s) => sortedScores.indexOf(s) + 1;

  const rows = scored.map((g, n) => {
    const p = persons[n];
    const sections = sectionBreakdown(p.score, g.grade.atomic, model.b, secOf, order)
      .map((s) => ({ id: s.id, label: sectionLabel(s.id), score: r3(s.score) }));
    return {
      attemptId: g.a.id,
      uid: g.a.uid,
      result: {
        score: p.score,
        level: p.level,
        percent: p.percent,
        raw: p.raw,
        maxRaw: g.grade.maxScore,
        full: g.grade.full,
        partial: g.grade.partial,
        theta: p.theta,
        se: p.se,
        rank: rankOf(p.score),
        participants: N,
        sections,
        submitted: g.a.status !== "in_progress",
        method: "rasch-jmle",
      },
    };
  });
  empty.forEach((g) => rows.push({
    attemptId: g.a.id,
    uid: g.a.uid,
    result: { score: null, level: null, percent: 0, raw: 0, maxRaw: g.grade.maxScore, participants: N, excluded: true,
      reason: "Hech bir savolga javob berilmagan — natija hisoblanmadi.", submitted: g.a.status !== "in_progress", method: "rasch-jmle" },
  }));

  const levels = {};
  persons.forEach((p) => { const k = p.level || "none"; levels[k] = (levels[k] || 0) + 1; });
  const raws = persons.map((p) => p.raw);
  const meanRaw = raws.reduce((s, v) => s + v, 0) / N;
  const stats = {
    participants: N,
    excluded: empty.length,
    unsubmitted: scored.filter((g) => g.a.status === "in_progress").length,
    maxRaw: X[0].length,
    meanRaw: Math.round(meanRaw * 100) / 100,
    maxScore: Math.max(...persons.map((p) => p.score)),
    reliability: model.reliability == null ? null : Math.round(model.reliability * 1000) / 1000,
    iterations: model.iterations,
    converged: model.converged,
    extremeItems: model.itemStatus.filter((s) => s !== "ok").length,
    levels,
  };
  return { rows, stats, warnings, model };
}
