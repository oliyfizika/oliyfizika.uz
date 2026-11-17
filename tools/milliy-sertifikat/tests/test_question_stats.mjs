// Savollar statistikasi (question-stats.js) — Mock №3 kaliti va qo'lda tuzilgan 4 ishtirokchi bilan.
//   node tools/milliy-sertifikat/tests/test_question_stats.mjs
import fs from "node:fs";
import { questionStats } from "../../../milliy-sertifikat/mock-testlar/js/question-stats.js";

let fails = 0;
const ok = (name, cond, detail = "") => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const test = JSON.parse(fs.readFileSync(new URL("../../../milliy-sertifikat/mock-testlar/data/mock-test-3.json", import.meta.url)));
const qi = test.questions.findIndex((q) => q.type === "open2");
const open = test.questions[qi];
const wrong = (l) => (l === "A" ? "B" : "A");

const all = {}; // hammasi to'g'ri
test.questions.forEach((q, i) => { all[i] = q.type === "mcq" ? q.answer : Object.fromEntries(q.parts.map((p) => [p.key, String(p.answer).replace(".", ",")])); });
const half = { 0: test.questions[0].answer, 1: wrong(test.questions[1].answer), [qi]: { [open.parts[0].key]: String(open.parts[0].answer) } };
const one = { 0: wrong(test.questions[0].answer) };
const attempts = [
  { id: "s__a", status: "submitted", answers: all },
  { id: "s__b", status: "in_progress", answers: half },
  { id: "s__c", status: "submitted", answers: one },
  { id: "s__d", status: "submitted", answers: {} }, // javobsiz — hisobga olinmaydi
];
const st = questionStats(test, attempts);
const item = (label) => st.items.find((x) => x.label === label);
const n1 = String(test.questions[0].n), n2 = String(test.questions[1].n);
ok("ishtirokchilar: javobsiz chiqarildi", st.participants === 3, st.participants);
ok("topshirganlar", st.submitted === 2, st.submitted);
ok("bandlar soni = 55", st.items.length === 55 && st.maxRaw === 55, st.items.length);
ok("1-savol: 2/3 to'g'ri", Math.abs(item(n1).pCorrect - 66.7) < 0.01, item(n1).pCorrect);
ok("1-savol: eng ko'p tanlangan — to'g'ri javob", item(n1).topPick.letter === test.questions[0].answer && Math.abs(item(n1).topPick.p - 66.7) < 0.01);
ok("2-savol: 1/3 to'g'ri, 1/3 javobsiz", Math.abs(item(n2).pCorrect - 33.3) < 0.01 && Math.abs(item(n2).pBlank - 33.3) < 0.01, `${item(n2).pCorrect} / ${item(n2).pBlank}`);
const oa = item(`${open.n}${open.parts[0].key}`), ob = item(`${open.n}${open.parts[1].key}`);
ok("ochiq savol a: 2/3 to'g'ri", Math.abs(oa.pCorrect - 66.7) < 0.01, oa.pCorrect);
ok("ochiq savol b: 1/3 to'g'ri, 2/3 javobsiz", Math.abs(ob.pCorrect - 33.3) < 0.01 && Math.abs(ob.pBlank - 66.7) < 0.01, `${ob.pCorrect} / ${ob.pBlank}`);
ok("o'rtacha xom ball", Math.abs(st.meanRaw - (55 + 2 + 0) / 3) < 0.01, st.meanRaw);
ok("mediana", st.median === 2, st.median);
ok("bo'limlar ro'yxati", st.sections.length >= 3 && st.sections.every((x) => x.items > 0), st.sections.map((x) => `${x.id}:${x.pCorrect}`).join(" "));
ok("bo'sh ro'yxat", questionStats(test, []).participants === 0);
console.log(fails ? `\n${fails} ta xato` : "\nHammasi o'tdi");
process.exit(fails ? 1 : 0);
