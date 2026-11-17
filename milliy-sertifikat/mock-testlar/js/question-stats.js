// ==========================================================================
// Milliy sertifikat: sessiya bo'yicha savollar statistikasi — sof hisob (DOM/Firebase yo'q, Node'da testlanadi).
// Admin sahifasi (assets/js/admin/ms-sessions.js) urinishlarni o'qib shu funksiyaga beradi.
// ==========================================================================
import { gradeLocal, countFilledItems } from "./scoring.js";
import { itemSections, sectionLabel } from "./sections.js";
import { restoreAnswers } from "./session-service.js";

export function questionStats(test, attempts) {
  const secOf = itemSections(test);
  const items = [];
  test.questions.forEach((q) => {
    if (q.type === "mcq") items.push({ label: String(q.n), q, key: null, correctAnswer: q.answer, picks: {} });
    else q.parts.forEach((p) => items.push({ label: `${q.n}${p.key}`, q, key: p.key, correctAnswer: p.answer, picks: null }));
  });
  items.forEach((it, i) => Object.assign(it, { section: secOf[i], correct: 0, blank: 0 }));
  let n = 0, submitted = 0, rawSum = 0;
  const raws = [];
  attempts.forEach((a) => {
    const answers = restoreAnswers(a.answers);
    if (!countFilledItems(test.questions, answers)) return;
    n++;
    if (a.status !== "in_progress") submitted++;
    const g = gradeLocal(test, answers);
    let k = 0;
    g.rows.forEach((r, qi) => {
      if (r.type === "mcq") {
        const it = items[k++];
        if (g.atomic[k - 1]) it.correct++;
        const pick = answers[qi];
        if (!pick) it.blank++; else it.picks[pick] = (it.picks[pick] || 0) + 1;
      } else {
        r.parts.forEach((p) => { const it = items[k++]; if (p.ok) it.correct++; if (p.empty) it.blank++; });
      }
    });
    const raw = g.atomic.reduce((x, y) => x + y, 0);
    rawSum += raw; raws.push(raw);
  });
  const pct = (x) => (n ? Math.round((x / n) * 1000) / 10 : 0);
  items.forEach((it) => {
    it.pCorrect = pct(it.correct); it.pBlank = pct(it.blank);
    if (it.picks) {
      const top = Object.entries(it.picks).sort((a, b) => b[1] - a[1])[0];
      it.topPick = top ? { letter: top[0], p: pct(top[1]) } : null;
    }
  });
  const secIds = [...new Set(items.map((it) => it.section))];
  const sections = secIds.map((id) => {
    const list = items.filter((it) => it.section === id);
    return { id, label: sectionLabel(id), items: list.length, pCorrect: list.length ? Math.round(list.reduce((s, it) => s + it.pCorrect, 0) / list.length * 10) / 10 : 0 };
  });
  raws.sort((a, b) => a - b);
  const median = raws.length ? (raws.length % 2 ? raws[(raws.length - 1) / 2] : (raws[raws.length / 2 - 1] + raws[raws.length / 2]) / 2) : 0;
  return { participants: n, submitted, maxRaw: items.length, meanRaw: n ? Math.round((rawSum / n) * 100) / 100 : 0, median, items, sections };
}
