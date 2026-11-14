// Sessiyani yakunlash hisobi (finalize-core.js) — haqiqiy Mock №3 kaliti va sintetik ishtirokchilar bilan.
//   node tools/milliy-sertifikat/tests/test_finalize_core.mjs
import fs from "node:fs";
import { computeSessionResults } from "../../../milliy-sertifikat/mock-testlar/js/finalize-core.js";
import { levelOf } from "../../../milliy-sertifikat/mock-testlar/js/rasch.js";

let fails = 0;
const ok = (name, cond, detail = "") => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const test = JSON.parse(fs.readFileSync(new URL("../../../milliy-sertifikat/mock-testlar/data/mock-test-3.json", import.meta.url)));

let seed = 11;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
// Rasch bo'yicha sintetik javoblar: θ ~ U(-2.5, 2.5), band qiyinligi tartib bo'yicha −2..2
const L = 55;
const bTrue = Array.from({ length: L }, (_, i) => -2 + (4 * i) / (L - 1));
function attempt(id, theta, status = "submitted") {
  const answers = {};
  let k = 0;
  test.questions.forEach((q, i) => {
    const hit = () => rnd() < 1 / (1 + Math.exp(-(theta - bTrue[k++])));
    if (q.type === "mcq") { answers[i] = hit() ? q.answer : (q.answer === "A" ? "C" : "A"); return; }
    const parts = {};
    q.parts.forEach((p) => { parts[p.key] = hit() ? String(p.answer).replace(".", ",") : "0,000123"; });
    answers[i] = parts;
  });
  return { id, uid: id.split("__")[1], status, answers };
}
const attempts = Array.from({ length: 200 }, (_, n) => attempt(`s__u${n}`, -2.5 + 5 * rnd(), n % 17 === 0 ? "in_progress" : "submitted"));
attempts.push({ id: "s__empty", uid: "empty", status: "submitted", answers: {} });

const { rows, stats, warnings } = computeSessionResults(test, attempts);
ok("201 qator (200 baholangan + 1 chiqarilgan)", rows.length === 201 && stats.participants === 200 && stats.excluded === 1);
ok("ogohlantirish yo‘q (200 ≥ 30)", warnings.length === 0, warnings.join("; "));
const scored = rows.filter((r) => !r.result.excluded).map((r) => r.result);
ok("barcha ball [0;75], daraja jadvalga mos", scored.every((r) => r.score >= 0 && r.score <= 75 && r.level === levelOf(r.score)));
ok("o‘rtacha ≈ 50", Math.abs(scored.reduce((s, r) => s + r.score, 0) / scored.length - 50) < 0.6);
ok("bo‘limlar yig‘indisi = ball", scored.every((r) => Math.abs(r.sections.reduce((s, x) => s + x.score, 0) - r.score) < 0.002));
ok("o‘rin: eng yuqori ball — 1-o‘rin", scored.find((r) => r.rank === 1).score === Math.max(...scored.map((r) => r.score)));
ok("ochiq savol vergulli javob qabul qilinadi (raw > 0)", scored.some((r) => r.raw > 40));
ok("topshirilmagan qoralama ham baholanadi", rows.filter((r) => r.result.submitted === false && !r.result.excluded).length > 0);
ok("ishonchlilik > 0,8", stats.reliability > 0.8, String(stats.reliability));
let threw = "";
try { computeSessionResults(test, attempts.slice(0, 3)); } catch (e) { threw = e.message; }
ok("5 tadan kam ishtirokchi — xato", /kamida 5/.test(threw), threw);
const few = computeSessionResults(test, attempts.slice(0, 12));
ok("12 ishtirokchi — ogohlantirish", few.warnings.length === 1, few.warnings[0]);
console.log(fails ? `\n${fails} ta FAIL` : "\nHammasi PASS");
process.exit(fails ? 1 : 0);
