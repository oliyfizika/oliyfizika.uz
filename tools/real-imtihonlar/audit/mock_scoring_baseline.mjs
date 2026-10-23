// PHASE 7A — Mock test baholashining BAZAVIY SNAPSHOT'i (regressiya uchun). FAQAT O'QIYDI.
// scoring.js va Mock ma'lumotlari o'zgartirilmaydi; natija yangi audit fayliga yoziladi.
//   node tools/real-imtihonlar/audit/mock_scoring_baseline.mjs
// Keyingi bosqichda scoring.js kengaytirilsa, shu skript qayta ishga tushirilib natija shu snapshot bilan solishtiriladi.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const scoringPath = path.join(ROOT, "milliy-sertifikat/mock-testlar/js/scoring.js");
const { gradeLocal, checkPart, parseNumber, normalizeText } = await import(scoringPath);
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const catalog = JSON.parse(readFileSync(path.join(ROOT, "milliy-sertifikat/mock-testlar/data/tests.json"), "utf8"));
const out = { scoringSha256: sha(scoringPath), tests: [], probes: {} };

for (const t of catalog.tests) {
  const file = path.join(ROOT, "milliy-sertifikat/mock-testlar/data", `${t.id}.json`);
  const test = JSON.parse(readFileSync(file, "utf8"));
  const relTol = test.scoring?.defaultRelativeTolerance ?? 1e-8;
  // 1) kalit javoblar — hammasi to'g'ri bo'lishi kerak
  const keyAnswers = test.questions.map((q) => (q.type === "mcq" ? q.answer : Object.fromEntries(q.parts.map((p) => [p.key, String(p.answer)]))));
  const gKey = gradeLocal(test, keyAnswers);
  // 2) bo'sh javoblar
  const gBlank = gradeLocal(test, test.questions.map(() => undefined));
  // 3) perturbatsiya: har bir sonli qism uchun kalit × (1 + δ) — qabul qilinadimi (tolerans xulq-atvori snapshot'i)
  const perturb = {};
  for (const d of [0.001, 0.005, 0.02, 0.1]) {
    let acc = 0, tot = 0;
    test.questions.forEach((q) => {
      if (q.type === "mcq") return;
      q.parts.forEach((p) => {
        if (p.kind === "text") return;
        tot++;
        if (checkPart(p, String(Number(p.answer) * (1 + d)), relTol).ok) acc++;
      });
    });
    perturb[`+${d * 100}%`] = { accepted: acc, of: tot };
  }
  out.tests.push({
    id: t.id, fileSha256: sha(file), relTol, questions: test.questions.length,
    keyGrade: { correct: gKey.correct, wrong: gKey.wrong, blank: gKey.blank, maxScore: gKey.maxScore },
    blankGrade: { correct: gBlank.correct, blank: gBlank.blank },
    allKeysCorrect: gKey.correct === gKey.maxScore, perturbation: perturb,
  });
}
// 4) parser/normalizator probalari (hozirgi xulq-atvor)
for (const s of ["1,5", "1.5", "7e-27", "7*10^-27", "7×10^-27", "7·10^-27", "10/3", "3√2", "2400π", "−5", "-5", " 12 ", "1 000"]) {
  out.probes[`parseNumber(${JSON.stringify(s)})`] = parseNumber(s);
}
for (const s of ["O‘zgarmagan", "o'zgarmagan", "hech qaysi", "2-nur", "t²"]) out.probes[`normalizeText(${JSON.stringify(s)})`] = normalizeText(s);
out.summary = {
  tests: out.tests.length, questions: out.tests.reduce((a, t) => a + t.questions, 0),
  allKeysCorrect: out.tests.every((t) => t.allKeysCorrect),
};
const dest = path.join(ROOT, "_private/real-imtihonlar/audit/phase7a-mock-scoring-baseline.json");
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.summary), JSON.stringify(out.probes));
