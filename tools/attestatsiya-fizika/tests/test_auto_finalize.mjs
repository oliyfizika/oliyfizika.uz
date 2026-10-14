// Attestatsiya → Fizika: avtomatik yakunlash — sof qism unit testlari (sintetik ma'lumot).
//   node tools/attestatsiya-fizika/tests/test_auto_finalize.mjs
// Server tomondagi qaror (Rules) — test_rules.py «14. AUTO-FINALIZE» bo'limida.
// KUNLIK test: vaqt chegarasi 2 soat (startedAt + 7200 s), avto-yakunlash — chegara + 60 s dan keyin; completedAt = startedAt + 2 soat.
import { isOverdue, autoSubmitPatch } from "../../../assets/js/attestatsiya-fizika/finalize-core.js";
import { gradeAnswers, durationSeconds, nextMidnightTashkent } from "../../../assets/js/attestatsiya-fizika/core.js";

const results = [];
const expect = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = JSON.stringify;
const TS = (iso) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 });

// Asia/Tashkent: Day 1 e'lon qilindi 2026-10-04 18:00 Toshkent (13:00 UTC) → yechim 2026-10-05 00:00 Toshkent (2026-10-04 19:00 UTC)
const S = nextMidnightTashkent(new Date("2026-10-04T13:00:00Z"));
expect("solutionAvailableAt = keyingi kun 00:00 Asia/Tashkent (mavjud nextMidnightTashkent)", S.toISOString() === "2026-10-04T19:00:00.000Z", S.toISOString());
const test = { id: "day-1", solutionAvailableAt: TS(S.toISOString()), currentVersion: 2 };
const base = { id: "u1__day-1", userId: "u1", testId: "day-1", dayNumber: 1, testVersion: 2, attemptNumber: 1, kind: "official",
  status: "in_progress", startedAt: TS("2026-10-04T13:00:00Z"), questionCount: 32 };
const ms = S.getTime();
const start = Date.parse("2026-10-04T13:00:00Z");
const LE = start + 7200e3;                 // start + 2 soat
const AF = LE + 60e3;                      // avto-yakunlash boshlanadi (grace dan keyin)

// E/F — vaqt chegarasi (kunlik test: startedAt + 2 soat + 60 s grace; yechim vaqti hisobga olinmaydi)
expect("E: chegara + grace dan 1 s oldin — hali in_progress (nomzod emas)", !isOverdue(base, test, AF - 1000));
expect("E: start dan 1 soat keyin — nomzod emas", !isOverdue(base, test, start + 3600e3));
expect("F: aynan chegara + 60 s da — nomzod", isOverdue(base, test, AF));
expect("F: keyin (8 soat) — nomzod", isOverdue(base, test, AF + 8 * 3600e3));
expect("kunlik test: yechim vaqti o'tgan bo'lsa ham start + 2 soat dan oldin nomzod emas (istalgan kunda boshlash)", !isOverdue({ ...base, startedAt: TS("2026-12-01T10:00:00Z") }, test, Date.parse("2026-12-01T11:00:00Z")));
expect("A: submitted / graded — nomzod emas (qo'lda yakunlangan)", !isOverdue({ ...base, status: "submitted" }, test, AF + 1) && !isOverdue({ ...base, status: "graded" }, test, AF + 1));
expect("K: testVersion yo'q / satr — taxmin qilinmaydi", !isOverdue({ ...base, testVersion: undefined }, test, AF + 1) && !isOverdue({ ...base, testVersion: "2" }, test, AF + 1));
expect("practice / boshqa test — nomzod emas",
       !isOverdue({ ...base, kind: "practice" }, test, AF + 1) && !isOverdue(base, { ...test, id: "day-2" }, AF + 1));

// patch — javoblar o'zgarmaydi, natija maydonlari yo'q
const answers = { Q1: "A", Q2: "C" };
const p = autoSubmitPatch({ ...base, answers }, test);
expect("patch: status submitted, completedAt = startedAt + 2 soat, autoFinalized", p.status === "submitted" && p.completedAt.seconds === base.startedAt.seconds + 7200 && p.completedAt.nanoseconds === 0 && p.autoFinalized === true);
expect("patch: javoblar o'zgarmagan (nusxa)", J(p.answers) === J(answers) && p.answers !== answers);
expect("patch: faqat lifecycle maydonlari (natija/ID/versiya yo'q)", J(Object.keys(p).sort()) === J(["answers", "autoFinalized", "completedAt", "status"]));
expect("C: javob yo'q → answers = {}", J(autoSubmitPatch(base, test).answers) === "{}" && J(autoSubmitPatch({ ...base, answers: null }, test).answers) === "{}");

// vaqt: 2 soat bilan cheklanadi (ertasi kuni qaytsa ham 14 soat emas)
expect("vaqt: sarflangan vaqt = 2 soat (7200 s)", durationSeconds(base.startedAt, p.completedAt) === 7200);

// Baholash: qo'lda va avtomatik yakun — bir xil mavjud gradeAnswers natijasi
const qids = Array.from({ length: 32 }, (_, i) => `Q${i + 1}`);
const key = { answers: Object.fromEntries(qids.map((q, i) => [q, "ABCD"[i % 4]])), scorableCount: 32 };
const some = Object.fromEntries(qids.slice(0, 12).map((q, i) => [q, i < 7 ? key.answers[q] : "E"]));   // 7 to'g'ri, 5 xato, 20 javobsiz
const gManual = gradeAnswers(some, key, 32);
const gAuto = gradeAnswers(autoSubmitPatch({ ...base, answers: some }, test).answers, key, 32);
expect("L: 32 savol, 12 javob — 7 to'g'ri / 5 xato / 20 javobsiz", gAuto.correctAnswers === 7 && gAuto.wrongAnswers === 5 && gAuto.unanswered === 20);
expect("qo'lda va avtomatik — bir xil natija", J(gManual) === J(gAuto));
expect("score: 7/32 → 22 % (mavjud yaxlitlash)", gAuto.scorePercent === Math.round(700 / 32));
const one = gradeAnswers(autoSubmitPatch({ ...base, answers: { Q1: "A" } }, test).answers, key, 32);
expect("B: 1 ta javob — 1 to'g'ri, 31 javobsiz", one.correctAnswers === 1 && one.unanswered === 31);
const none = gradeAnswers(autoSubmitPatch(base, test).answers, key, 32);
expect("C: javobsiz — hammasi unanswered, 0 %", none.unanswered === 32 && none.scorePercent === 0);
const all = gradeAnswers(autoSubmitPatch({ ...base, answers: { ...key.answers } }, test).answers, key, 32);
expect("D: hammasiga javob (yakunlanmagan) — 100 %", all.correctAnswers === 32 && all.scorePercent === 100);
const v1 = { answers: Object.fromEntries(qids.map((q) => [q, "A"])), scorableCount: 32 };
expect("I/J: versiya kaliti bo'yicha (v1 kaliti boshqa natija beradi)", gradeAnswers(some, v1, 32).correctAnswers !== gAuto.correctAnswers);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
