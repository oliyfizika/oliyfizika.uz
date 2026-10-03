// Attestatsiya → Fizika: «Savollar statistikasi» sof hisobining unit testlari (sintetik ma'lumot, haqiqiy kalit yo'q).
//   node tools/attestatsiya-fizika/tests/test_question_stats.mjs
import { computeQuestionStats, isCountedAttempt, pct } from "../../../assets/js/attestatsiya-fizika/question-stats.js";

const results = [];
const expect = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = JSON.stringify;

// Kanonik tartib ataylab alifbo tartibida EMAS (Z, B, M, A, Q); Q — ballga kirmaydi.
const order = ["T-Z", "T-B", "T-M", "T-A", "T-Q"];
const keyOf = (version, answers = { "T-Z": "A", "T-B": "B", "T-M": "C", "T-A": "D" }) =>
  ({ testId: "t1", version, questionIds: order, answers, scorableCount: Object.keys(answers).length });
const K2 = keyOf(2);
const K1 = keyOf(1, { "T-Z": "B", "T-B": "B", "T-M": "A", "T-A": "A" });
let seq = 0;
const att = (version, answers, over = {}) => {
  const key = version === 2 ? K2 : K1;
  const correctIds = Object.keys(key.answers).filter((q) => q in answers && answers[q] === key.answers[q]);
  const wrongIds = Object.keys(key.answers).filter((q) => q in answers && answers[q] !== key.answers[q]);
  return { id: `u${++seq}__t1`, userId: `u${seq}`, testId: "t1", testVersion: version, kind: "official", status: "graded",
           answers, correctIds, wrongIds, ...over };
};
const row = (st, n) => st.rows.find((r) => r.number === n);

// A. urinish yo'q
{
  const st = computeQuestionStats(K2, []);
  expect("A: 0 urinish → attempts = 0", st.attempts === 0);
  expect("A: 0 urinish → foizlar null (0 % emas)", st.rows.every((r) => r.correctPct === null && r.wrongPct === null));
  expect("A: 0 urinish → reyting ro'yxatlari bo'sh", !st.mostWrong.length && !st.mostUnanswered.length);
  expect("A: pct(0, 0) = null, pct(0, 5) = 0", pct(0, 0) === null && pct(0, 5) === 0);
}
// B. bitta urinish
{
  const st = computeQuestionStats(K2, [att(2, { "T-Z": "A", "T-B": "C" })]);   // Z to'g'ri, B xato, M/A javobsiz
  expect("B: 1 to'g'ri → 100 %", row(st, 1).correctPct === 100 && row(st, 1).correct === 1);
  expect("B: 1 noto'g'ri → 0 % to'g'ri, 100 % xato", row(st, 2).correctPct === 0 && row(st, 2).wrongPct === 100);
  expect("B: javobsiz alohida sanaladi (0 % to'g'ri, 100 % javobsiz)", row(st, 3).unanswered === 1 && row(st, 3).unansweredPct === 100 && row(st, 3).wrong === 0);
  expect("B: ballga kirmaydigan savol — foizsiz", !row(st, 5).scored && row(st, 5).correctPct === null);
}
// C. ko'p urinish: 8/10 to'g'ri, 2/10 xato
{
  const list = [];
  for (let i = 0; i < 10; i++) list.push(att(2, { "T-Z": i < 8 ? "A" : "B", "T-B": i < 9 ? "B" : "A", ...(i < 7 ? { "T-M": "C" } : {}) }));
  const st = computeQuestionStats(K2, list);
  expect("C: N = 10", st.attempts === 10);
  expect("C: 8/10 to'g'ri → 80 %", row(st, 1).correctPct === 80);
  expect("C: 2/10 xato → 20 %", row(st, 1).wrongPct === 20);
  expect("C: 9/10 → 90 %", row(st, 2).correctPct === 90);
  expect("C: 7 to'g'ri + 3 javobsiz → 70 % / 30 %", row(st, 3).correctPct === 70 && row(st, 3).unansweredPct === 30);
  expect("C: har savolda to'g'ri + xato + javobsiz = N",
         st.rows.filter((r) => r.scored).every((r) => r.correct + r.wrong + r.unanswered === 10));
  expect("C: xato reytingi kamayish tartibida (Z 20 %, B 10 %)", J(st.mostWrong.map((x) => [x.number, x.pct])) === J([[1, 20], [2, 10]]));
  expect("C: javobsiz reytingi (A 100 %, M 30 %)", J(st.mostUnanswered.map((x) => [x.number, x.pct])) === J([[4, 100], [3, 30]]));
}
// D. versiya izolyatsiyasi
{
  const v1 = [att(1, { "T-Z": "B" }), att(1, { "T-Z": "B" })];          // v1 kalitida Z = B → to'g'ri
  const v2 = [att(2, { "T-Z": "B" })];                                  // v2 kalitida Z = A → xato
  const all = [...v1, ...v2];
  const s2 = computeQuestionStats(K2, all);
  const s1 = computeQuestionStats(K1, all);
  expect("D: v2 statistikasi faqat v2 urinishlari (N = 1)", s2.attempts === 1 && row(s2, 1).correctPct === 0);
  expect("D: v1 statistikasi faqat v1 urinishlari (N = 2)", s1.attempts === 2 && row(s1, 1).correctPct === 100);
  expect("D: versiyasiz urinish hech qaysi versiyaga kirmaydi",
         computeQuestionStats(K2, [att(2, { "T-Z": "A" }, { testVersion: undefined })]).attempts === 0);
  expect("D: testVersion satr ('2') taxmin qilinmaydi", !isCountedAttempt(att(2, {}, { testVersion: "2" }), "t1", 2));
  expect("D: boshqa testId kirmaydi", computeQuestionStats(K2, [att(2, { "T-Z": "A" }, { testId: "t9" })]).attempts === 0);
}
// E. kanonik tartib
{
  const st = computeQuestionStats(K2, [att(2, { "T-A": "D" })]);
  expect("E: qatorlar keys.questionIds tartibida (alifbo emas)", J(st.rows.map((r) => r.questionId)) === J(order));
  expect("E: raqamlar 1..n", J(st.rows.map((r) => r.number)) === J([1, 2, 3, 4, 5]));
  expect("E: teng foizda reyting kanonik tartibda", J(computeQuestionStats(K2, [att(2, {})]).mostUnanswered.map((x) => x.number)) === J([1, 2, 3, 4]));
}
// Filtrlar
{
  const list = [att(2, { "T-Z": "A" }), att(2, { "T-Z": "A" }, { status: "in_progress", correctIds: undefined, wrongIds: undefined }),
                att(2, { "T-Z": "A" }, { status: "submitted", correctIds: undefined, wrongIds: undefined }),
                att(2, { "T-Z": "A" }, { kind: "practice" })];
  const st = computeQuestionStats(K2, list);
  expect("filtr: faqat official + graded (in_progress, submitted, practice — yo'q)", st.attempts === 1 && st.excluded === 3);
  const legacy = { id: "old", testId: "t1", testVersion: 2, kind: "official", status: "graded", selectedAnswers: { "T-Z": "A", "T-B": "A" } };
  const sl = computeQuestionStats(K2, [legacy]);
  expect("eski sxema (correctIds yo'q, selectedAnswers): kalit bilan solishtiriladi",
         sl.regraded === 1 && row(sl, 1).correct === 1 && row(sl, 2).wrong === 1 && row(sl, 3).unanswered === 1);
  expect("eski urinish obyekti o'zgartirilmadi", !("correctIds" in legacy));
  expect("Rules ro'yxati ustun: correctIds bor bo'lsa qayta baholanmaydi",
         computeQuestionStats(K2, [att(2, { "T-Z": "B" }, { correctIds: ["T-Z"], wrongIds: [] })]).rows[0].correct === 1);
}

// ---------------------------------------------------------------- QA: aniq formula ssenariysi (10 urinish)
{
  const list = [];
  for (let i = 0; i < 10; i++) {
    const a = {};
    a["T-Z"] = i < 8 ? "A" : "C";                              // Savol 1: 8 to'g'ri, 2 xato, 0 javobsiz
    if (i < 4) a["T-B"] = "B"; else if (i < 7) a["T-B"] = "D";  // Savol 2: 4 to'g'ri, 3 xato, 3 javobsiz
    list.push(att(2, a));
  }
  const st = computeQuestionStats(K2, list);
  const r1 = row(st, 1), r2 = row(st, 2);
  expect("QA: Savol 1 = 80 % / 20 % / 0 %", J([r1.correctPct, r1.wrongPct, r1.unansweredPct]) === J([80, 20, 0]));
  expect("QA: Savol 2 = 40 % / 30 % / 30 %", J([r2.correctPct, r2.wrongPct, r2.unansweredPct]) === J([40, 30, 30]));
  expect("QA: xato reytingi 2-savol (30 %) → 1-savol (20 %)", J(st.mostWrong.slice(0, 2).map((x) => [x.number, x.pct])) === J([[2, 30], [1, 20]]));
  expect("QA: teng foizda pozitsiya bo'yicha (3-savol 4-savoldan oldin, ikkalasi 100 % javobsiz)",
         J(st.mostUnanswered.map((x) => x.number)) === J([3, 4, 2]));
}
// ---------------------------------------------------------------- QA: chekka holatlar A–N
{
  const one = (ans) => computeQuestionStats(K2, [att(2, ans)]);
  const allRight = one({ "T-Z": "A", "T-B": "B", "T-M": "C", "T-A": "D" });
  expect("A: 1 urinish, hammasi to'g'ri → 100 %", allRight.rows.filter((r) => r.scored).every((r) => r.correctPct === 100));
  const allWrong = one({ "T-Z": "B", "T-B": "C", "T-M": "D", "T-A": "A" });
  expect("B: 1 urinish, hammasi xato → 0 % to'g'ri, 100 % xato", allWrong.rows.filter((r) => r.scored).every((r) => r.correctPct === 0 && r.wrongPct === 100));
  const blank = one({});
  expect("C: 1 urinish, hammasi javobsiz → 100 % javobsiz, xato reytingi bo'sh",
         blank.rows.filter((r) => r.scored).every((r) => r.unansweredPct === 100 && r.correctPct === 0) && !blank.mostWrong.length);
  const ten = [];
  for (let i = 0; i < 10; i++) ten.push(att(2, { ...(i < 8 ? { "T-Z": "A" } : { "T-Z": "B" }), ...(i < 7 ? { "T-B": "B" } : {}) }));
  const st10 = computeQuestionStats(K2, ten);
  expect("D: 10 urinish, 8 to'g'ri → 80 %", row(st10, 1).correctPct === 80);
  expect("E: 10 urinish, 2 xato → 20 %", row(st10, 1).wrongPct === 20);
  expect("F: 10 urinish, 3 javobsiz → 30 %", row(st10, 2).unansweredPct === 30 && row(st10, 2).correctPct === 70);
  expect("G: 0 urinish → null", computeQuestionStats(K2, []).rows.every((r) => r.correctPct === null));
  const h = computeQuestionStats(K2, [att(2, { "T-Z": "A" }, { correctIds: undefined }), att(2, { "T-Z": "B" }, { wrongIds: null })]);
  expect("H: correctIds/wrongIds yo'q → kalit bilan solishtiriladi", h.regraded === 2 && row(h, 1).correct === 1 && row(h, 1).wrong === 1);
  const old = computeQuestionStats(K2, [{ testId: "t1", testVersion: 2, kind: "official", status: "graded", selectedAnswers: { "T-Z": "A" } },
                                       { testId: "t1", testVersion: 2, kind: "official", status: "graded", answers: "buzilgan" },
                                       { testId: "t1", testVersion: 2, kind: "official", status: "graded" }]);
  expect("I: eski/buzilgan format (selectedAnswers, answers satr, answers yo'q) — crash yo'q",
         old.attempts === 3 && row(old, 1).correct === 1 && row(old, 1).unanswered === 2);
  expect("J: testVersion yo'q → kirmaydi", computeQuestionStats(K2, [att(2, { "T-Z": "A" }, { testVersion: null })]).attempts === 0);
  let kOk = true;
  try {
    const kNull = computeQuestionStats(null, [att(2, {})]);
    const kBad = computeQuestionStats({ testId: "t1", version: 2 }, [att(2, {})]);
    kOk = kNull.rows.length === 0 && kNull.attempts === 0 && kBad.rows.length === 0;
  } catch { kOk = false; }
  expect("K: keys/vN yo'q yoki buzilgan → crash yo'q, qator yo'q", kOk);
  const l = computeQuestionStats(K2, [att(2, { "T-Q": "A", "T-X": "B" }, { correctIds: ["T-Q", "T-X"], wrongIds: [] })]);
  expect("L: ballga kirmaydigan / kalitda yo'q savol hisobni buzmaydi", !row(l, 5).scored && row(l, 5).correct === 0
         && l.rows.filter((r) => r.scored).every((r) => r.unanswered === 1));
  const dupKey = { ...K2, questionIds: ["T-Z", "T-B", "T-Z", "T-M", "T-A", "T-Q"] };
  const m = computeQuestionStats(dupKey, [att(2, { "T-Z": "A" })]);
  expect("M: takroriy questionId ikki marta sanalmaydi", row(m, 1).correct === 1 && row(m, 1).total === 1 && row(m, 3).duplicate && !row(m, 3).scored
         && m.scorableCount === 4 && m.mostUnanswered.every((x) => x.number !== 3));
  const n = computeQuestionStats(K2, [{ ...att(2, {}), correctIds: ["T-A", "ZZZ"], wrongIds: ["T-Z", "YYY"] }]);
  expect("N: urinishdagi tartib/begona ID kanonik tartibni buzmaydi",
         J(n.rows.map((r) => r.questionId)) === J(order) && row(n, 4).correct === 1 && row(n, 1).wrong === 1);
  expect("malformed: attempts null / null elementlar — crash yo'q",
         computeQuestionStats(K2, null).attempts === 0 && computeQuestionStats(K2, [null, undefined, 5]).attempts === 0);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
