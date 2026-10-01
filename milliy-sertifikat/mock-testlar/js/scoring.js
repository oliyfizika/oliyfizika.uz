// Lokal baholash. Kelajakda server-side scoring'ga o'tilganda bu modul faqat
// "local" rejimda ishlatiladi; server rejimida frontend to'g'ri javoblarni bilishi shart emas.

const STATUS = { OK: "To‘g‘ri", BAD: "Noto‘g‘ri", PART: "Qisman to‘g‘ri", BLANK: "Javobsiz" };
export { STATUS };

/** Kiritish maydonini tozalash: raqam, e/E, +, -, ., vergul, ×, *, ^, · */
export function sanitizeNumInput(value) {
  return String(value).replace(/\s+/g, "").replace(/[^0-9eE+.,×*^·\-]/g, "").replace(/,/g, ".");
}

/** "1,5" | "1.5" | "7e-27" | "7*10^-27" | "7×10^-27" | "7·10^-27" -> Number | null */
export function parseNumber(value) {
  if (value === null || value === undefined) return null;
  let s = String(value).trim().replace(/,/g, ".").replace(/\s+/g, "");
  if (!s) return null;
  s = s.replace(/×|·/g, "*");
  const sci = s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\*?10\^([+-]?\d+)$/i);
  if (sci) s = `${sci[1]}e${sci[2]}`;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Matnli javobni solishtirish uchun normallashtirish: katta-kichik harf, apostrof turlari,
 *  bo'shliqlar, daraja belgilari (t² → t^2), ko'paytirish belgilari. */
export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "'")
    .replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/[·*×]/g, "")
    .replace(/−/g, "-")
    .replace(/,/g, ".")
    .replace(/\s+/g, "");
}

/** Qism javobini tekshirish (son yoki matn). */
export function checkPart(p, raw, relTol) {
  if (p.kind === "text") {
    const v = normalizeText(raw);
    if (!v) return { ok: false, empty: true };
    const accepted = (p.accept && p.accept.length ? p.accept : [p.answer]).map(normalizeText);
    return { ok: accepted.includes(v), empty: false };
  }
  const v = parseNumber(raw);
  return { ok: isNear(v, p.answer, p.tolerance, relTol), empty: v === null };
}

/** Variant matni: oddiy satr yoki { text, image } obyekti. */
export const optionText = (o) => (typeof o === "string" ? o : o?.text || "");

/** tolerance berilgan bo'lsa — absolyut farq; aks holda testning nisbiy toleransi. */
export function isNear(value, expected, tolerance, relTol = 1e-8) {
  if (value === null || value === undefined) return false;
  const t = tolerance !== undefined && tolerance !== null
    ? Number(tolerance)
    : Math.max(relTol, Math.abs(Number(expected)) * relTol);
  return Math.abs(Number(value) - Number(expected)) <= t;
}

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

export function isAnswered(q, answer) {
  if (q.type === "mcq") return !!answer;
  return q.parts.every((p) => filled(answer?.[p.key]));
}

export function isPartial(q, answer) {
  if (q.type === "mcq") return false;
  const n = q.parts.filter((p) => filled(answer?.[p.key])).length;
  return n > 0 && n < q.parts.length;
}

/** Baholanadigan bandlar soni (MCQ = 1, ochiq savol = qismlar soni). */
export const itemCount = (questions) => questions.reduce((s, q) => s + (q.type === "mcq" ? 1 : q.parts.length), 0);

export function countFilledItems(questions, answers) {
  return questions.reduce((s, q, i) => {
    const a = answers[i];
    if (q.type === "mcq") return s + (a ? 1 : 0);
    return s + q.parts.filter((p) => filled(a?.[p.key])).length;
  }, 0);
}

/** Butun testni baholash. */
export function gradeLocal(test, answers) {
  const relTol = test.scoring?.defaultRelativeTolerance ?? 1e-8;
  const atomic = [];
  const rows = [];
  let correct = 0, wrong = 0, blank = 0, full = 0, partial = 0;

  test.questions.forEach((q, i) => {
    const a = answers[i];
    if (q.type === "mcq") {
      const ok = a === q.answer;
      atomic.push(ok ? 1 : 0);
      if (ok) { correct++; full++; } else if (!a) blank++; else wrong++;
      rows.push({ n: q.n, type: "mcq", answer: a || "—", correctAnswer: q.answer, status: ok ? STATUS.OK : !a ? STATUS.BLANK : STATUS.BAD, score: `${ok ? 1 : 0}/1` });
      return;
    }
    const parts = q.parts.map((p) => {
      const raw = a?.[p.key];
      const { ok, empty } = checkPart(p, raw, relTol);
      atomic.push(ok ? 1 : 0);
      if (ok) correct++; else if (empty) blank++; else wrong++;
      return { key: p.key, raw: filled(raw) ? String(raw) : "—", unit: p.unit, ok, empty, expected: p.answer };
    });
    const okCount = parts.filter((p) => p.ok).length;
    if (okCount === parts.length) full++; else if (okCount > 0) partial++;
    const status = okCount === parts.length ? STATUS.OK : okCount > 0 ? STATUS.PART : parts.every((p) => p.empty) ? STATUS.BLANK : STATUS.BAD;
    rows.push({
      n: q.n, type: "open", parts, status, score: `${okCount}/${parts.length}`,
      answer: parts.map((p) => `${p.key}: ${p.raw} ${p.unit || ""}`.trim()).join("; "),
    });
  });

  return { atomic, rows, correct, wrong, blank, full, partial, maxScore: atomic.length, questionCount: test.questions.length };
}
