// ==========================================================================
// "Mening natijalarim" uchun ma'lumotlarni tayyorlash (sof funksiyalar — Firebase'siz).
// Manba: Firestore `results` (result-service.js yozadi), courses.js, progress-service natijasi,
// users/{uid}.xp va level. Hech qanday ma'lumot yozilmaydi yoki o'ylab topilmaydi.
// ==========================================================================

import { COURSES } from "../../../umumiy-fizika/data/courses.js";
import { lessonAnchorId } from "../../../js/mechanics-progress.js";

const ROOT = new URL("../../../", import.meta.url);

const LESSON_INDEX = new Map();
COURSES.forEach((course) => course.lessons.forEach((l) => {
  if (!LESSON_INDEX.has(l.number)) LESSON_INDEX.set(l.number, { lesson: l, course });
}));

/** Firestore Timestamp | {seconds} | ISO | Date -> Date | null */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 28.09.2026 ko'rinishi (brauzerdagi mahalliy vaqt bo'yicha). */
export const formatDate = (d) => (d
  ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
  : "—");

/**
 * Natija hujjatini ko'rsatish uchun tayyorlaydi. Faqat kerakli maydonlar
 * (uid, email, ism, hujjat ID kabi texnik maydonlar tashqariga chiqarilmaydi).
 */
export function normalizeResult(raw, index) {
  // Mavzu raqami: test sarlavhasidan ("51-Mavzu | …"), bo'lmasa lessonId dan
  const fromTitle = String(raw.lessonTitle || "").match(/^\s*(\d+)\s*-\s*mavzu/i);
  const number = fromTitle ? Number(fromTitle[1]) : Number(raw.lessonId);
  const known = LESSON_INDEX.get(number);
  const cleanTitle = String(raw.lessonTitle || "")
    .replace(/\|\s*OliyFizika\.uz\s*$/i, "")
    .replace(/^\s*\d+\s*-\s*mavzu\s*\|\s*/i, "")
    .trim();
  const percent = Number.isFinite(Number(raw.percent)) ? Math.round(Number(raw.percent)) : null;
  const date = toDate(raw.completedAt);
  return {
    key: `r${index}`,
    ref: raw._ref || null, // ichki; UI'da ko'rsatilmaydi
    number: Number.isFinite(number) ? number : null,
    label: Number.isFinite(number) ? `${number}-mavzu` : "Mavzu",
    title: known?.lesson.title || cleanTitle || "Mavzu testi",
    courseId: known?.course.id || null,
    courseTitle: known?.course.title || "",
    href: known ? new URL(`${known.course.page}#${lessonAnchorId(known.lesson)}`, ROOT).href : null,
    score: Number.isFinite(Number(raw.score)) ? Number(raw.score) : null,
    total: Number.isFinite(Number(raw.totalQuestions)) ? Number(raw.totalQuestions) : null,
    percent,
    passed: raw.passed === true,
    date,
    time: date ? date.getTime() : 0,
  };
}

export function prepareResults(rawResults) {
  return rawResults.map(normalizeResult).sort((a, b) => b.time - a.time);
}

/** Har bir mavzu bo'yicha birinchi muvaffaqiyatli topshirish sanasi. */
function firstPasses(results) {
  const map = new Map();
  [...results].sort((a, b) => a.time - b.time).forEach((r) => {
    if (r.passed && r.number != null && !map.has(r.number)) map.set(r.number, r.time || null);
  });
  return map;
}

/**
 * Yutuqlar — faqat mavjud ma'lumotdan hisoblanadi, hech qayerga saqlanmaydi.
 * Sana faqat haqiqiy test sanasidan aniqlansa ko'rsatiladi.
 */
export function deriveAchievements({ results, progress, xp }) {
  const passes = firstPasses(results);
  const passTimes = [...passes.values()].filter(Boolean).sort((a, b) => a - b);
  const nthPass = (n) => (passes.size >= n && passTimes.length >= n ? new Date(passTimes[n - 1]) : null);
  const coursesStarted = progress.courses.filter((c) => c.done > 0);
  const coursesDone = progress.courses.filter((c) => c.status === "done");

  // Kurs yakunlangan sana: kursning barcha mavzulari testlar orqali o'tilgan bo'lsa, eng oxirgisi
  const courseDoneDate = (c) => {
    const times = c.lessons.map((l) => passes.get(l.number));
    return times.every(Boolean) ? new Date(Math.max(...times)) : null;
  };
  // Agar yakunlangan kurslardan birining sanasi noma'lum bo'lsa (masalan, mavzu testsiz ochilgan),
  // yutuq qachon olinganini aniq bilib bo'lmaydi — sana ko'rsatilmaydi.
  const rawDoneDates = coursesDone.map(courseDoneDate);
  const allDated = rawDoneDates.every(Boolean);
  const doneDates = allDated ? rawDoneDates.sort((a, b) => a - b) : [];

  const list = [
    { id: "first-step", icon: "trajectory", title: "Birinchi qadam", description: "Birinchi mavzuni yakunlang.",
      earned: progress.overall.done >= 1, date: nthPass(1) },
    { id: "first-test", icon: "checkCircle", title: "Birinchi test", description: "Birinchi testdan muvaffaqiyatli o‘ting (≥80%).",
      earned: passes.size >= 1, date: nthPass(1) },
    { id: "tests-5", icon: "clipboard", title: "5 ta test", description: "5 ta turli mavzu testidan o‘ting.",
      earned: passes.size >= 5, date: nthPass(5), progress: [Math.min(passes.size, 5), 5] },
    { id: "tests-10", icon: "clipboard", title: "10 ta test", description: "10 ta turli mavzu testidan o‘ting.",
      earned: passes.size >= 10, date: nthPass(10), progress: [Math.min(passes.size, 10), 10] },
    { id: "tests-25", icon: "medal", title: "25 ta test", description: "25 ta turli mavzu testidan o‘ting.",
      earned: passes.size >= 25, date: nthPass(25), progress: [Math.min(passes.size, 25), 25] },
    { id: "course-started", icon: "play", title: "Kurs boshlandi", description: "Istalgan kursda birinchi mavzuni yakunlang.",
      earned: coursesStarted.length >= 1, date: nthPass(1) },
    { id: "course-done", icon: "trophy", title: "Kurs yakunlandi", description: "Bitta kursning barcha mavzularini yakunlang.",
      earned: coursesDone.length >= 1, date: doneDates[0] || null },
    { id: "explorer", icon: "globe", title: "Fizika tadqiqotchisi", description: "Ikki xil fizika bo‘limini to‘liq yakunlang.",
      earned: coursesDone.length >= 2, date: doneDates.length >= 2 ? doneDates[1] : null, progress: [Math.min(coursesDone.length, 2), 2] },
    { id: "xp-100", icon: "bolt", title: "100 XP", description: "100 XP to‘plang.", earned: xp >= 100, date: null, progress: [Math.min(xp, 100), 100] },
    { id: "xp-500", icon: "bolt", title: "500 XP", description: "500 XP to‘plang.", earned: xp >= 500, date: null, progress: [Math.min(xp, 500), 500] },
    { id: "xp-1000", icon: "sparkles", title: "1000 XP", description: "1000 XP to‘plang.", earned: xp >= 1000, date: null, progress: [Math.min(xp, 1000), 1000] },
  ];
  return list;
}

/**
 * Daraja bo'yicha holat — xp-service.js dagi LEVELS jadvali va calculateLevel() dan.
 * Joriy daraja users/{uid}.level dan (xp-service yozgan qiymat) olinadi.
 */
export function levelInfo(xp, storedLevel, LEVELS) {
  const asc = [...LEVELS].sort((a, b) => a.level - b.level);
  const level = Number(storedLevel) || 1;
  const current = asc.find((l) => l.level === level) || asc[0];
  const next = asc.find((l) => l.level === level + 1) || null;
  if (!next) return { level, max: true, current: current.xp, next: null, toNext: 0, percent: 100 };
  const span = next.xp - current.xp;
  const into = Math.max(0, Math.min(span, xp - current.xp));
  return { level, max: false, current: current.xp, next: next.xp, toNext: Math.max(0, next.xp - xp), percent: span ? Math.round((into / span) * 100) : 0 };
}
