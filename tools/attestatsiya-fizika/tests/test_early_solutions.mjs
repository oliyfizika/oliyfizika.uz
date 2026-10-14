// Attestatsiya → Fizika: «testni yakunlagan zahoti yechimlar ochiladi» — sof qism unit testlari (core.js).
//   node tools/attestatsiya-fizika/tests/test_early_solutions.mjs
import { isFinished, solutionOpen, solutionOpenFor, limitExpired } from "../../../assets/js/attestatsiya-fizika/core.js";

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
expect("KUNLIK test: yechim vaqti kelsa ham yakunlamaganlarga yopiq (vaqt bo'yicha ochilmaydi)", !solutionOpenFor(past, null, NOW) && !solutionOpenFor(past, att("in_progress"), NOW) && !solutionOpen(past, NOW));
const mockPast = { ...past, id: "att-fizika-mock-01", kind: "mock", dayNumber: 101 };
expect("MOCK test: yechim vaqti kelgach hamma uchun ochiq (urinishsiz ham)", solutionOpenFor(mockPast, null, NOW) && solutionOpen(mockPast, NOW));
const lim = { ...att("in_progress"), startedAt: TS("2026-10-10T05:00:00Z") };      // start 05:00, +2 soat +60 s = 07:01 < NOW 08:00
expect("KUNLIK: 2 soatlik vaqt tugagan (in_progress) — yechim ochiq (avto-yakunlash sahifa ochilganda)", solutionOpenFor(open(), lim, NOW) && limitExpired(lim, open(), NOW));
expect("KUNLIK: vaqt tugamagan in_progress — yopiq", !solutionOpenFor(open(), { ...att("in_progress"), startedAt: TS("2026-10-10T07:00:00Z") }, NOW));
expect("KUNLIK: vaqt tugashiga grace ichida (start+2 soat+30 s) — hali yopiq", !limitExpired({ ...att("in_progress"), startedAt: TS("2026-10-10T05:59:30Z") }, open(), NOW));
expect("boshqa testning urinishi ochmaydi", !solutionOpenFor(open(), att("graded", { testId: "att-fizika-day-06" }), NOW));
expect("draft (e'lon qilinmagan) test — urinish bo'lsa ham yopiq", !solutionOpenFor(open({ status: "draft", published: false }), att("graded"), NOW));
expect("archived (ko'rinadigan) test — yakunlangan user uchun ochiq", solutionOpenFor(open({ status: "archived" }), att("graded"), NOW));
expect("mock test uchun ham ishlaydi", solutionOpenFor(open({ id: "att-fizika-mock-01", kind: "mock", dayNumber: 101 }), att("submitted", { testId: "att-fizika-mock-01" }), NOW));
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
