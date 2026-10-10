// Attestatsiya → Fizika: MOCK TEST — sof qism unit testlari + yig'ilgan to'plam (build_mock_test.py) invariantlari.
//   python3 tools/attestatsiya-fizika/build_mock_test.py && node tools/attestatsiya-fizika/tests/test_mock.mjs
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMock, isMockDay, dayLabel, dayLabelOf, mockPoints, mockMax, pickToday, computeStats, gradeAnswers, MOCK_FIRST_DAY, timeLimitOf, limitEndMs, isLimited, attemptEndMs, autoFromMs, remainingSeconds, formatLimit } from "../../../assets/js/attestatsiya-fizika/core.js";
import { isOverdue, autoSubmitPatch } from "../../../assets/js/attestatsiya-fizika/finalize-core.js";
import { dayOpen, accessContext } from "../../../assets/js/attestatsiya-fizika/access.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const results = [];
const expect = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const TS = (iso) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 });

// ---------------------------------------------------------------- core.js
const mock = { id: "att-fizika-mock-01", kind: "mock", dayNumber: 101, mockNumber: 1, pointsPerQuestion: 2, maxScore: 100, scorableCount: 50, status: "published", published: true,
  solutionAvailableAt: TS("2099-01-01T00:00:00Z") };
const day = { id: "att-fizika-day-05", dayNumber: 5, status: "published", published: true, solutionAvailableAt: TS("2099-01-01T00:00:00Z") };
expect("MOCK_FIRST_DAY = 101", MOCK_FIRST_DAY === 101);
expect("isMock: kind=mock yoki dayNumber>=101; kunlik emas", isMock(mock) && isMock({ dayNumber: 101 }) && !isMock(day) && !isMock(null) && !isMockDay(100) && isMockDay(101));
expect("dayLabel: «Mock test» / «Day 5»; dayLabelOf(101)", dayLabel(mock) === "Mock test" && dayLabel(day) === "Day 5" && dayLabelOf(101) === "Mock test" && dayLabelOf(7) === "Day 7"
  && dayLabel({ ...mock, mockNumber: 2 }) === "Mock test 2");
expect("ball: har to'g'ri javob x2, jami 100", mockPoints(37, mock) === 74 && mockPoints(0, mock) === 0 && mockPoints(50, mock) === 100 && mockMax(mock) === 100 && mockMax({}) === 100);
expect("ball == scorePercent (50 savol x 2): gradeAnswers 37/50 → 74", (() => {
  const ids = Array.from({ length: 50 }, (_, i) => `Q${i}`);
  const key = { answers: Object.fromEntries(ids.map((q) => [q, "A"])), scorableCount: 50 };
  const g = gradeAnswers(Object.fromEntries(ids.slice(0, 37).map((q) => [q, "A"])), key, 50);
  return g.scorePercent === 74 && mockPoints(g.correctAnswers, mock) === g.scorePercent;
})());
expect("pickToday: mock «bugungi test» bo'lmaydi (dayNumber katta bo'lsa ham)", pickToday([day, mock], 0)?.id === day.id && pickToday([mock], 0) === null);
const attempts = [
  { id: "u__d5", testId: day.id, dayNumber: 5, status: "graded", scorePercent: 80, correctAnswers: 8, scorableQuestions: 10, timeSpentSeconds: 600, correctIds: [] },
  { id: "u__m1", testId: mock.id, dayNumber: 101, status: "graded", scorePercent: 74, correctAnswers: 37, scorableQuestions: 50, timeSpentSeconds: 3000, correctIds: [] },
];
const st = computeStats(attempts, new Map([[day.id, { ...day, section: "mexanika" }], [mock.id, mock]]), 32);
expect("computeStats: mock kurs progressi/o'rtacha/eng yuqori/vaqtga kirmaydi", st.completed === 1 && st.graded === 1 && st.averageScore === 80 && st.bestScore === 80 && st.days.length === 1 && st.totalTime === 600);
expect("computeStats: faqat mock urinishi bo'lsa — 0/32, natija yo'q", (() => { const s = computeStats([attempts[1]], new Map([[mock.id, mock]]), 32); return s.completed === 0 && s.averageScore === null && s.days.length === 0; })());

// ---------------------------------------------------------------- access.js
const paidNone = accessContext({ accessMode: "paid" }, { attestationAccess: false });
expect("access: mock — paid rejimda attestationAccess'siz ham ochiq (bepul)", dayOpen(mock, paidNone) === true && dayOpen(day, paidNone) === false && dayOpen({ dayNumber: 3 }, paidNone) === true);
expect("access: Day 4+ cheklovi o'zgarmagan (paid, ruxsatsiz → yopiq; ruxsatli → ochiq)", dayOpen({ dayNumber: 4 }, paidNone) === false && dayOpen({ dayNumber: 4 }, accessContext({ accessMode: "paid" }, { attestationAccess: true })) === true);

// ---------------------------------------------------------------- yig'ilgan to'plam
const bundlePath = path.join(ROOT, "_private/attestatsiya-fizika/mock-import-01.json");
const planPath = path.join(ROOT, "docs/attestatsiya-fizika/mock_test_01_plan.json");
const b = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const [tOp, vOp, kOp, sOp] = b.ops;
const t = tOp.data, v = vOp.data, k = kOp.data, s = sOp.data;
const SECT = ["mexanika", "molekulyar", "elektromagnetizm", "optika", "atom-yadro"];
const phys = v.questions.slice(0, 40), ped = v.questions.slice(40);
expect("to'plam: 4 hujjat (test, versions/v1, keys/v1, solutions/v1)", b.ops.length === 4 && b.ops.map((o) => o.path.split("/").slice(2).join("/")).join() === ",versions/v1,keys/v1,solutions/v1");
expect("50 savol: 40 fizika + 10 pedagogika, 100 ball (50 x 2)", t.questionCount === 50 && phys.length === 40 && ped.length === 10 && t.maxScore === 100 && t.pointsPerQuestion === 2 && t.scorableCount === 50);
expect("fizika: har bobdan roppa-rosa 8 ta (Mexanika, Molekulyar, Elektr va magnetizm, Optika, Atom-yadro)",
  SECT.every((sec) => phys.filter((q) => q.section === sec).length === 8) && !phys.some((q) => q.section === "maxsus"));
expect("fizika savollari 5 bob tartibida: 8+8+8+8+8", SECT.every((sec, i) => phys.slice(i * 8, i * 8 + 8).every((q) => q.section === sec)));
expect("har bobda kamida 5 xil mavzu (mavzular turlicha)", SECT.every((sec) => new Set(phys.filter((q) => q.section === sec).map((q) => q.topic)).size >= 5));
expect("pedagogika: 10 ta, ID PED-xx-yy, 4 variant, noyob matn", ped.every((q) => /^PED-\d\d-\d\d$/.test(q.id) && q.options.length === 4 && q.section === "pedagogika")
  && new Set(ped.map((q) => JSON.stringify(q.question))).size === 10);
expect("ID'lar noyob va test.questionIds bilan bir xil tartibda", new Set(t.questionIds).size === 50 && v.questions.map((q) => q.id).join() === t.questionIds.join() && k.questionIds.join() === t.questionIds.join());
expect("kalit: 50 ta, scorableCount 50, har javob variantlar ichida", Object.keys(k.answers).length === 50 && k.scorableCount === 50
  && v.questions.every((q) => q.options.some((o) => o.key === k.answers[q.id])));
expect("yechimlar: 50 ta, javobi kalit bilan bir xil, bo'sh emas", s.items.length === 50 && s.items.every((i) => i.correctAnswer === k.answers[i.id] && i.solution.length > 0));
expect("kalit harflari muvozanatli (A–D har biri >= 8)", ["A", "B", "C", "D"].every((l) => Object.values(k.answers).filter((x) => x === l).length >= 8), JSON.stringify(Object.values(k.answers).reduce((a, x) => ({ ...a, [x]: (a[x] || 0) + 1 }), {})));
const leak = /"(correctAnswer|solution|bookAnswer|solutionResult|answers|review|verify)"/;
expect("public snapshot (versions) javob/yechim maydonlarisiz", !leak.test(JSON.stringify(v)) && !leak.test(JSON.stringify(t)));
expect("rasm yo'q (figure bloki yo'q), figureCount 0", !/"t":\s*"figure"/.test(JSON.stringify(b.ops)) && t.figureCount === 0);
expect("test: kind=mock, dayNumber 101, draft, e'lon qilinmagan, vaqt chegarasi 2 soat", t.kind === "mock" && t.dayNumber === 101 && t.status === "draft" && t.published === false && t.solutionAvailableAt === null && t.timeLimitSeconds === 7200);
expect("topics 6 ta (5 bob + Pedagogika), questionTopicIdx 8/8/8/8/8/10", t.topics.length === 6 && [8, 8, 8, 8, 8, 10].every((n, i) => t.questionTopicIdx.filter((x) => x === i).length === n));
expect("ichma-ich massiv yo'q (Firestore)", (() => {
  const bad = (x, inArr = false) => Array.isArray(x) ? (inArr || x.some((e) => bad(e, true))) : x && typeof x === "object" ? Object.values(x).some((e) => bad(e, false)) : false;
  return !bad(b.ops.map((o) => o.data));
})());
expect("hujjat hajmi < 900 KB", b.ops.every((o) => Buffer.byteLength(JSON.stringify(o.data)) < 900_000));
// kunlik savollar bankidagi manbasi bilan mazmuni bir xil (nusxa o'zgartirilmagan)
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "_private/attestatsiya-fizika/firestore-import.json"), "utf8"));
const bankQ = new Map();
for (const o of bank.ops) if (/\/versions\/v1$/.test(o.path)) for (const q of o.data.questions) bankQ.set(q.id, q);
expect("fizika savollari bankdagi asl savol/variantlar bilan aynan bir xil", phys.every((q) => JSON.stringify(q.question) === JSON.stringify(bankQ.get(q.id).question) && JSON.stringify(q.options) === JSON.stringify(bankQ.get(q.id).options)));
// pedagogika: asl faylidagi (attestatsiya/pedagogika-testlari/data/test*.js, FAQAT O'QILADI) savol, variantlar va to'g'ri javob bilan bir xil
const pedSrc = (fileNo, n) => {
  let src = fs.readFileSync(path.join(ROOT, `attestatsiya/pedagogika-testlari/data/test${fileNo}.js`), "utf8");
  src = "window" + src.slice(src.indexOf(".testQuestions"));            // test8.js boshidagi 'indow' xatosi tuzatilmaydi — faqat o'qishda chetlab o'tiladi
  const w = {};
  vm.runInNewContext(src, { window: w });
  return w.testQuestions[n - 1];
};
const norm = (x) => String(x).split(/\s+/).filter(Boolean).join(" ");
expect("pedagogika savol, 4 variant va to'g'ri javob asl fayl bilan aynan bir xil", ped.every((q) => {
  const [, f, n] = q.id.match(/^PED-(\d\d)-(\d\d)$/);
  const src = pedSrc(Number(f), Number(n));
  return norm(q.question[0].text) === norm(src.question) && q.options.every((o, i) => norm(o.blocks[0].text) === norm(src.answers[i]))
    && k.answers[q.id] === "ABCD"[src.correct];
}));
// deterministiklik va javobsiz reja
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
expect("reja fayli (commit uchun) javobsiz: faqat ID/hisoblar", !leak.test(JSON.stringify(plan)) && plan.questionIds.join() === t.questionIds.join() && plan.maxScore === 100);

// ---------------------------------------------------------------- vaqt chegarasi (2 soat)
{
  const st = Date.parse("2099-01-01T10:00:00Z");
  const lm = { ...mock, timeLimitSeconds: 7200, solutionAvailableAt: TS("2099-01-02T00:00:00Z") };
  const at = { testId: lm.id, kind: "official", status: "in_progress", testVersion: 1, startedAt: { seconds: st / 1000, nanoseconds: 5 }, answers: { Q1: "A" } };
  expect("timeLimitOf: 7200 / yo'q / noto'g'ri", timeLimitOf(lm) === 7200 && timeLimitOf(day) === null && timeLimitOf({ timeLimitSeconds: 30 }) === null && timeLimitOf({ timeLimitSeconds: "7200" }) === null);
  expect("limitEndMs/isLimited/attemptEndMs", limitEndMs(at, lm) === st + 7200000 && isLimited(at, lm) && attemptEndMs(at, lm) === st + 7200000 && !isLimited(at, day));
  expect("limit yechim vaqtidan keyin tugasa — yechim vaqti hisobga olinadi", (() => {
    const late = { ...lm, solutionAvailableAt: TS("2099-01-01T11:00:00Z") };
    return !isLimited(at, late) && attemptEndMs(at, late) === Date.parse("2099-01-01T11:00:00Z");
  })());
  expect("remainingSeconds: boshida 7200, 1 soatdan keyin 3600, oxirida 0 (manfiy emas)", remainingSeconds(at, lm, st) === 7200 && remainingSeconds(at, lm, st + 3600000) === 3600 && remainingSeconds(at, lm, st + 9e6) === 0);
  expect("remainingSeconds: chegarasiz kunlik testda yechim vaqtigacha", remainingSeconds(at, { ...day, solutionAvailableAt: TS("2099-01-01T11:00:00Z") }, st) === 3600);
  expect("autoFromMs = limit + 60 s grace", autoFromMs(at, lm) === st + 7200000 + 60000 && autoFromMs(at, day) === Date.parse("2099-01-01T00:00:00Z"));
  expect("isOverdue: grace tugamaguncha yo'q, keyin ha", !isOverdue(at, lm, st + 7200000 + 59000) && isOverdue(at, lm, st + 7200000 + 60000) && !isOverdue(at, lm, st + 1000));
  const p = autoSubmitPatch(at, lm);
  expect("autoSubmitPatch: completedAt = startedAt + 7200 (nanosoniyalar bilan), javoblar o'zgarmaydi", p.completedAt.seconds === st / 1000 + 7200 && p.completedAt.nanoseconds === 5 && p.answers.Q1 === "A" && p.autoFinalized === true && p.status === "submitted");
  expect("autoSubmitPatch: kunlik testda completedAt = solutionAvailableAt", autoSubmitPatch(at, day).completedAt === day.solutionAvailableAt);
  expect("formatLimit", formatLimit(7200) === "2 soat" && formatLimit(5400) === "1 soat 30 daqiqa" && formatLimit(2700) === "45 daqiqa");
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
