// Attestatsiya → Fizika: «testni yakunlagan zahoti yechimlar ochiladi» — sof qism unit testlari (core.js).
//   node tools/attestatsiya-fizika/tests/test_early_solutions.mjs
import { isFinished, solutionOpen, solutionOpenFor } from "../../../assets/js/attestatsiya-fizika/core.js";

const results = [];
const expect = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const TS = (iso) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 });
const NOW = Date.parse("2026-10-10T08:00:00Z");
const open = (over = {}) => ({ id: "att-fizika-day-05", dayNumber: 5, status: "published", published: true, solutionAvailableAt: TS("2026-10-10T19:00:00Z"), ...over });   // yechim vaqti hali kelmagan
const past = open({ solutionAvailableAt: TS("2026-10-09T19:00:00Z") });
const att = (status, over = {}) => ({ testId: "att-fizika-day-05", kind: "official", status, ...over });

expect("isFinished: submitted/graded — ha; in_progress, yo'q, null — yo'q",
  isFinished(att("submitted")) && isFinished(att("graded")) && !isFinished(att("in_progress")) && !isFinished(null) && !isFinished(undefined) && !isFinished({}));
expect("yakunlamagan (urinish yo'q): yechim vaqtigacha yopiq", !solutionOpenFor(open(), null, NOW) && !solutionOpen(open(), NOW));
expect("in_progress: yechim vaqtigacha yopiq", !solutionOpenFor(open(), att("in_progress"), NOW));
expect("submitted: yechim vaqtidan OLDIN ochiq", solutionOpenFor(open(), att("submitted"), NOW));
expect("graded: yechim vaqtidan oldin ochiq", solutionOpenFor(open(), att("graded"), NOW));
expect("yechim vaqti kelgach: hamma uchun ochiq (urinishsiz ham)", solutionOpenFor(past, null, NOW) && solutionOpenFor(past, att("in_progress"), NOW));
expect("boshqa testning urinishi ochmaydi", !solutionOpenFor(open(), att("graded", { testId: "att-fizika-day-06" }), NOW));
expect("draft (e'lon qilinmagan) test — urinish bo'lsa ham yopiq", !solutionOpenFor(open({ status: "draft", published: false }), att("graded"), NOW));
expect("archived (ko'rinadigan) test — yakunlangan user uchun ochiq", solutionOpenFor(open({ status: "archived" }), att("graded"), NOW));
expect("mock test uchun ham ishlaydi", solutionOpenFor(open({ id: "att-fizika-mock-01", kind: "mock", dayNumber: 101 }), att("submitted", { testId: "att-fizika-mock-01" }), NOW));
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
