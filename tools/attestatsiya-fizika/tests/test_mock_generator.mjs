// Attestatsiya → Fizika: pullik mock generatori (mock-03..05) — birlik testi.
//   node tools/attestatsiya-fizika/tests/test_mock_generator.mjs
// Fizika banki — sun'iy (haqiqiy bank _private'da, repoda yo'q); pedagogika — haqiqiy test*.js fayllari (faqat o'qiladi).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateMocks, parsePedagogyFile, pedagogyPool, tokens, similarity, SIMILAR, MOCK_GEN } from "../../../assets/js/attestatsiya-fizika/mock-generator.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };

// ---- pedagogika (haqiqiy fayllar)
const pedagogy = [];
for (let f = 1; f <= 13; f++) pedagogy.push(...parsePedagogyFile(fs.readFileSync(path.join(ROOT, `attestatsiya/pedagogika-testlari/data/test${f}.js`), "utf8"), f));
const pedPool = pedagogyPool(pedagogy);
ok("pedagogika fayllari o'qildi", pedagogy.length > 200, `${pedagogy.length} savol, takrorsiz ${pedPool.length}`);

// ---- sun'iy fizika banki: 5 bob × 4 mavzu × 12 savol (+ har mavzuda bitta deyarli takror, rasmli, review.check, kalitsiz)
const W = "jism tezlik kuch massa energiya impuls zaryad maydon tok kuchlanish linza nur yadro foton gaz bosim harorat issiqlik tebranish to'lqin".split(" ");
const days = [];
const privates = new Map();
let dn = 0;
for (const [sec] of MOCK_GEN.physicsSections) {
  for (let t = 0; t < 4; t++) {
    const questions = [], answers = {}, items = [];
    for (let i = 0; i < 14; i++) {
      const id = `AF-${sec}-${t}-${i}`;
      const words = Array.from({ length: 12 }, (_, k) => `${W[(i * 7 + k * 3 + t) % W.length]}${sec.slice(0, 3)}${t}${i}x${k}`);
      let text = `${sec} ${words.join(" ")} = ${i + 1},${t} m/s`;
      if (i === 13) text = `${sec} ${Array.from({ length: 12 }, (_, k) => `${W[(0 * 7 + k * 3 + t) % W.length]}${sec.slice(0, 3)}${t}0x${k}`).join(" ")} = 1,${t} m/s ga`;   // AF-…-0 ning deyarli takrori
      const letter = "ABCD"[(i + t) % 4];
      const q = { id, section: sec, sectionTitle: sec, topic: `T${t}`, type: "mcq", evaluationType: "auto", difficulty: "medium", difficultyLevel: 1 + (i % 3),
                  question: [{ t: "p", text }], options: "ABCD".split("").map((k) => ({ key: k, blocks: [{ t: "p", text: `$${k}${sec.slice(0, 3)}${t}${i === 13 ? 0 : i}$` }] })), optionCount: 4 };
      if (i === 10) q.question.push({ t: "figure", id: "x.webp" });
      questions.push(q);
      if (i !== 11) answers[id] = letter;
      items.push({ id, evaluationType: "auto", correctAnswer: letter, solutionResult: letter, solutionStatus: "full", solution: [{ t: "p", text: "yechim" }] });
      privates.set(id, { keyStatus: "valid", review: { check: i === 12 ? "tekshirish" : null } });
    }
    dn++;
    days.push({ test: { id: `d${dn}`, dayNumber: dn }, version: { questions }, key: { answers }, solutions: { items } });
  }
}
// avvalgi mocklar: mock-01 (bank savollaridan bittasi + pedagogika), mock-02 (pedagogika)
const existingMocks = [
  { testId: "att-fizika-mock-01", questions: [days[0].version.questions[0], { id: "PED-01-01", question: [{ t: "p", text: pedagogy[0].question }], options: pedagogy[0].answers.map((a, i) => ({ key: "ABCD"[i], blocks: [{ t: "p", text: a }] })) }] },
  { testId: "att-fizika-mock-02", questions: [{ id: "PED-10-12", question: [{ t: "p", text: pedagogy.find((p) => p.file === 10 && p.n === 12).question }], options: pedagogy.find((p) => p.file === 10 && p.n === 12).answers.map((a, i) => ({ key: "ABCD"[i], blocks: [{ t: "p", text: a }] })) }] },
];

const res = generateMocks({ numbers: [3, 4, 5], days, privates, pedagogy, existingMocks });
ok("tekshiruvlar xatosiz", res.errors.length === 0, res.errors.slice(0, 5).join("; "));
ok("3 ta bundle", res.bundles.length === 3 && res.bundles.map((b) => b.testId).join() === "att-fizika-mock-03,att-fizika-mock-04,att-fizika-mock-05");
const all = res.bundles.flatMap((b) => b.ops[0].data.questionIds);
ok("150 ta savol, hammasi noyob", all.length === 150 && new Set(all).size === 150);
ok("avvalgi mock savollari kirmagan", !all.includes("AF-mexanika-0-0") && !all.includes("PED-01-01") && !all.includes("PED-10-12"));
ok("deyarli takror (…-13) va AF-…-0 bir mockda/mocklarda birga emas", !MOCK_GEN.physicsSections.some(([s]) => [0, 1, 2, 3].some((t) => all.includes(`AF-${s}-${t}-0`) && all.includes(`AF-${s}-${t}-13`))));
ok("avvalgi mockdagi savolning deyarli takrori ham kirmagan", !all.includes("AF-mexanika-0-13"));
ok("rasmli / kalitsiz / review.check savollar kirmagan", !all.some((id) => /^AF-.*-(10|11|12)$/.test(id)));
for (const b of res.bundles) {
  const [t, ver, key, sol] = b.ops.map((o) => o.data);
  ok(`${b.testId}: tarkib 35 + 15, paidOnly, 100 ball, 2 soat`, t.physicsCount === 35 && t.pedagogyCount === 15 && t.paidOnly === true && t.maxScore === 100
    && t.timeLimitSeconds === 7200 && t.kind === "mock" && t.dayNumber === 100 + t.mockNumber && t.status === "draft" && t.composition.fizika === 35 && t.composition.pedagogika === 15);
  ok(`${b.testId}: admin import tekshiruvidan o'tadi`, b.format === "oliyfizika-attestation-mock-import" && b.ops.length === 4 && t.questionIds.length === 50
    && Object.keys(key.answers).length === 50 && key.scorableCount === 50 && ver.questions.length === 50 && sol.items.length === 50);
  ok(`${b.testId}: public versiyada javob yo'q`, !/"(correctAnswer|solution|answers)"/.test(JSON.stringify(ver)));
  const letters = {};
  Object.values(key.answers).forEach((l) => { letters[l] = (letters[l] || 0) + 1; });
  ok(`${b.testId}: javob harflari muvozanatli`, Math.max(...Object.values(letters)) - Math.min(...Object.values(letters)) <= 6, JSON.stringify(letters));
  const pedQ = ver.questions.filter((q) => q.section === "pedagogika");
  ok(`${b.testId}: pedagogika ${new Set(pedQ.map((q) => q.bookNumber.split(".")[0])).size} ta turli fayldan`, new Set(pedQ.map((q) => q.bookNumber.split(".")[0])).size >= 10);
}
// mocklar orasida matn bo'yicha takror yo'q
const qs = res.bundles.flatMap((b) => b.ops[1].data.questions);
let dup = 0;
for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) {
  const a = tokens(JSON.stringify(qs[i].question) + JSON.stringify(qs[i].options)), c = tokens(JSON.stringify(qs[j].question) + JSON.stringify(qs[j].options));
  if (qs[i].section === "pedagogika" && similarity(a, c) >= SIMILAR) dup++;
}
ok("pedagogika savollari 3 mock bo'yicha matnan takrorlanmaydi", dup === 0, `${dup}`);
// deterministik
const res2 = generateMocks({ numbers: [3, 4, 5], days, privates, pedagogy, existingMocks });
ok("deterministik (bir xil kirish → bir xil mock)", JSON.stringify(res2.bundles) === JSON.stringify(res.bundles));
// yetishmasa — aniq xato
let threw = "";
try { generateMocks({ numbers: [3, 4, 5, 6, 7, 8, 9, 10, 11], days, privates, pedagogy, existingMocks }); } catch (e) { threw = e.message; }
ok("bank yetmasa aniq xato beradi", /yetmadi/.test(threw), threw);

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
