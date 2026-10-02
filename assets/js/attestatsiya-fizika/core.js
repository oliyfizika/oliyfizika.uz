// ==========================================================================
// Attestatsiya → Fizika: umumiy konstantalar va sof yordamchi funksiyalar (Firebase yo'q, DOM yo'q).
// Ma'lumot modeli: docs/attestatsiya-fizika/09_firestore_import_report.md
// ==========================================================================

export const COL = {
  settings: "attestationPhysicsSettings",
  questions: "attestationPhysicsQuestions",
  tests: "attestationPhysicsDailyTests",
  attempts: "attestationPhysicsAttempts",
};
export const SETTINGS_DOC = "config";
export const TOTAL_DAYS_DEFAULT = 32;
export const TZ_OFFSET_MIN = 300; // Asia/Tashkent (UTC+5, yozgi vaqt yo'q)
export const STORAGE_ROOT = "attestation-physics";

export const SECTION_ICON = {
  mexanika: "trajectory",
  molekulyar: "thermometer",
  elektromagnetizm: "magnet",
  optika: "prism",
  "atom-yadro": "atom",
  maxsus: "globe",
};

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------------ vaqt
/** Firestore Timestamp | Date | {seconds,nanoseconds} | ms -> ms (yoki null) */
export function toMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return null;
}

/** Rules'dagi (completedAt - startedAt).seconds() bilan bir xil: butun soniyalar (pastga yaxlitlash). */
export function durationSeconds(start, end) {
  const s = splitTs(start);
  const e = splitTs(end);
  if (!s || !e) return null;
  const nanos = (e.sec - s.sec) * 1e9 + (e.nanos - s.nanos);
  return Math.floor(nanos / 1e9);
}
function splitTs(v) {
  if (v == null) return null;
  if (typeof v.seconds === "number") return { sec: v.seconds, nanos: v.nanoseconds || 0 };
  const ms = toMs(v);
  return ms == null ? null : { sec: Math.floor(ms / 1000), nanos: (ms % 1000) * 1e6 };
}

/** Toshkent vaqti bo'yicha keyingi kun 00:00 (UTC Date). Admin publish qilganda solutionAvailableAt. */
export function nextMidnightTashkent(from = new Date()) {
  const local = new Date(from.getTime() + TZ_OFFSET_MIN * 60000);
  const midnightLocalUtcMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  return new Date(midnightLocalUtcMs - TZ_OFFSET_MIN * 60000);
}

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** "3-oktabr, 00:00" — Toshkent vaqtida (brauzer qaysi zonada bo'lishidan qat'i nazar). */
export function formatTashkent(v, { time = true, year = false } = {}) {
  const ms = toMs(v);
  if (ms == null) return "—";
  const d = new Date(ms + TZ_OFFSET_MIN * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  let s = `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`;
  if (year) s += ` ${d.getUTCFullYear()}`;
  if (time) s += `, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return s;
}

/** 1647 -> "27:27", 4047 -> "1:07:27" (sekundomer) */
export function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

/** 2847 -> "47 daqiqa 27 soniya" */
export function formatDuration(sec) {
  if (sec == null) return "—";
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const parts = [];
  if (h) parts.push(`${h} soat`);
  if (m || h) parts.push(`${m} daqiqa`);
  parts.push(`${r} soniya`);
  return parts.join(" ");
}

// ------------------------------------------------------------------ test holati (global kalendar)
export function isVisible(test) {
  return test && test.published === true && (test.status === "published" || test.status === "archived");
}
export function solutionOpen(test, now = Date.now()) {
  const at = toMs(test?.solutionAvailableAt);
  return isVisible(test) && at != null && now >= at;
}
/** Rasmiy urinish mumkinmi: published (archived emas) va yechim hali ochilmagan. */
export function officialOpen(test, now = Date.now()) {
  const at = toMs(test?.solutionAvailableAt);
  return test?.status === "published" && test?.published === true && at != null && now < at;
}
/** "Bugungi test": rasmiy urinish ochiq bo'lgan eng katta kun raqami. */
export function pickToday(tests, now = Date.now()) {
  return tests.filter((t) => officialOpen(t, now)).sort((a, b) => b.dayNumber - a.dayNumber)[0] || null;
}
export function attemptId(uid, testId) {
  return `${uid}__${testId}`;
}

// ------------------------------------------------------------------ baholash (Rules bilan bir xil algoritm)
/**
 * @param {Record<string,string>} answers  {questionId: 'A'..'E'}
 * @param {{answers: Record<string,string>, scorableCount: number}} key  — faqat auto savollar
 * Rules: answers.diff(key.answers) → unchanged = to'g'ri, changed = noto'g'ri, removed = javobsiz.
 */
export function gradeAnswers(answers, key, totalQuestions) {
  const auto = key.answers || {};
  const correctIds = [];
  const wrongIds = [];
  for (const [q, a] of Object.entries(auto)) {
    if (!(q in answers)) continue;
    if (answers[q] === a) correctIds.push(q);
    else wrongIds.push(q);
  }
  const s = key.scorableCount;
  const c = correctIds.length;
  return {
    totalQuestions,
    scorableQuestions: s,
    correctAnswers: c,
    wrongAnswers: wrongIds.length,
    unanswered: s - c - wrongIds.length,
    scorePercent: s ? Math.round((c * 100) / s) : 0,
    correctIds,
    wrongIds,
  };
}

/** Savol bo'yicha holat: correct | wrong | unanswered | unscored */
export function questionStatus(qid, evaluationType, answers, grade) {
  if (evaluationType !== "auto") return "unscored";
  if (grade.correctIds.includes(qid)) return "correct";
  if (grade.wrongIds.includes(qid)) return "wrong";
  return answers?.[qid] ? "wrong" : "unanswered";
}

/** Natija foizi ko'rsatish uchun (81.25% kabi aniqlik) */
export function precisePercent(correct, scorable) {
  if (!scorable) return "0";
  const v = (correct * 100) / scorable;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

// ------------------------------------------------------------------ statistika
const SECTION_TITLES = {
  mexanika: "Mexanika",
  molekulyar: "Molekulyar fizika",
  elektromagnetizm: "Elektromagnetizm",
  optika: "Optika",
  "atom-yadro": "Atom va yadro",
  maxsus: "Maxsus mavzular",
};
export const sectionTitle = (key, fallback) => SECTION_TITLES[key] || fallback || key;

/**
 * Faqat foydalanuvchining REAL ishlagan (graded) rasmiy testlaridan.
 * @param {Array} attempts  attestationPhysicsAttempts (o'zi)
 * @param {Map<string,object>} testsById  test meta (questionIds, questionTopicIdx, questionEval, topics, section)
 */
export function computeStats(attempts, testsById, totalDays = TOTAL_DAYS_DEFAULT) {
  const graded = attempts.filter((a) => a.status === "graded").sort((a, b) => a.dayNumber - b.dayNumber);
  const done = attempts.filter((a) => a.status === "graded" || a.status === "submitted");
  const scores = graded.map((a) => a.scorePercent);
  const times = graded.map((a) => a.timeSpentSeconds).filter((v) => typeof v === "number");
  const sum = (arr) => arr.reduce((x, y) => x + y, 0);
  const bySection = new Map();
  const byTopic = new Map();
  const bump = (map, key, label, correct, total) => {
    const cur = map.get(key) || { key, label, correct: 0, total: 0 };
    cur.correct += correct;
    cur.total += total;
    map.set(key, cur);
  };
  for (const a of graded) {
    const t = testsById.get(a.testId);
    if (!t) continue;
    bump(bySection, t.section, sectionTitle(t.section, t.sectionTitle), a.correctAnswers, a.scorableQuestions);
    const correct = new Set(a.correctIds || []);
    (t.questionIds || []).forEach((q, i) => {
      if ((t.questionEval || [])[i] !== "a") return;
      const topic = (t.topics || [])[(t.questionTopicIdx || [])[i]] || "—";
      bump(byTopic, topic, topic, correct.has(q) ? 1 : 0, 1);
    });
  }
  const pct = (x) => (x.total ? Math.round((x.correct * 100) / x.total) : 0);
  return {
    completed: done.length,
    graded: graded.length,
    totalDays,
    progressPercent: Math.round((done.length * 100) / (totalDays || 1)),
    averageScore: scores.length ? Math.round(sum(scores) / scores.length) : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    worstScore: scores.length ? Math.min(...scores) : null,
    totalTime: sum(times),
    averageTime: times.length ? Math.round(sum(times) / times.length) : null,
    days: graded.map((a) => ({ day: a.dayNumber, score: a.scorePercent, time: a.timeSpentSeconds, testId: a.testId })),
    sections: [...bySection.values()].map((x) => ({ ...x, percent: pct(x) })),
    topics: [...byTopic.values()].map((x) => ({ ...x, percent: pct(x) })).sort((a, b) => a.percent - b.percent),
  };
}
