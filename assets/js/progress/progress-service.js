// ==========================================================================
// OliyFizika.uz — Progress (o'qish natijalari) xizmati
//
// YANGI progress tizimi EMAS — mavjud manbalarni o'qiydi va birlashtiradi:
//   1) localStorage "mechanicsUnlockedLesson" — js/mechanics-progress.js (dars ochish tizimi)
//   2) Firestore `results` — js/services/result-service.js yozadigan test natijalari
//      (lessonId = o'tilgan mavzu raqami, passed = natija >= 80%)
//   3) users/{uid}: xp, level, fullAccess — session.js orqali (qayta o'qilmaydi)
//   4) Mavzular ro'yxati — umumiy-fizika/data/courses.js (kurs sahifalari bilan umumiy)
//
// Sinxronlash: Firestore'da o'tilgan eng katta mavzu shu qurilmadagi ochilgan
// darsdan katta bo'lsa, mavjud unlockMechanicsLesson() orqali shu qurilmada ham ochiladi.
// ==========================================================================

import { loadFirebase } from "../core/session.js";
import { COURSES } from "../../../umumiy-fizika/data/courses.js";
import { getMechanicsUnlockedLesson, unlockMechanicsLesson, replaceMechanicsUnlockedLesson, lessonAnchorId } from "../../../js/mechanics-progress.js";

// "mechanicsUnlockedLesson" qurilma darajasida saqlanadi (foydalanuvchi bo'yicha emas).
// Shu brauzerda qaysi hisobga tegishli ekanini belgilaymiz: boshqa hisob kirsa, oldingi hisobning
// ochilgan darslari unga o'tib qolmaydi — qiymat uning o'z Firestore natijalaridan tiklanadi.
// Egasi belgilanmagan eski qiymat (mehmon yoki avvalgi versiya) birinchi kirgan hisobga qoldiriladi.
const UNLOCK_OWNER_KEY = "oliyfizika:unlock-owner";
function readOwner() { try { return localStorage.getItem(UNLOCK_OWNER_KEY); } catch { return null; } }
function writeOwner(uid) { try { localStorage.setItem(UNLOCK_OWNER_KEY, uid); } catch { /* ignore */ } }

const ROOT = new URL("../../../", import.meta.url);

/** Bir sahifada natijalar faqat bir marta o'qiladi. */
const resultsCache = new Map();

/** Sahifada natijalar allaqachon so'ralganmi (qayta so'rov qilmaslik uchun). */
export function hasLoadedResults(uid) {
  return resultsCache.has(uid);
}

export function loadResults(uid) {
  if (!uid) return Promise.resolve([]);
  if (!resultsCache.has(uid)) {
    const promise = loadFirebase()
      .then(async ({ db, fsSdk }) => {
        const { collection, query, where, getDocs } = fsSdk;
        const snap = await getDocs(query(collection(db, "results"), where("uid", "==", uid)));
        // `_ref` — faqat ichki barqaror identifikator (bildirishnoma ID'si uchun xeshlanadi, UI'da ko'rsatilmaydi)
        return snap.docs.map((d) => ({ ...d.data(), _ref: d.id }));
      })
      .catch((error) => {
        resultsCache.delete(uid);
        throw error;
      });
    resultsCache.set(uid, promise);
  }
  return resultsCache.get(uid);
}

/** Ochilish sharti: (n-1)-mavzu testi. 15 va 15.1 kabi bir raqamli mavzularda birinchisining nomi olinadi. */
function prerequisiteLabel(courses, number) {
  for (const c of courses) {
    const l = c.lessons.find((x) => x.number === number - 1);
    if (l) return l.numberLabel || `${l.number}-mavzu`;
  }
  return null;
}

/**
 * Sof hisob-kitob (Firebase'siz) — test qilish oson.
 * @param {{ unlocked: number, passedNumbers: Iterable<number>, fullAccess?: boolean, courses?: typeof COURSES }} input
 */
export function computeProgress({ unlocked, passedNumbers, fullAccess = false, courses = COURSES }) {
  const passed = new Set([...passedNumbers].map(Number).filter(Number.isFinite));
  const maxPassed = passed.size ? Math.max(...passed) : 0;
  const effectiveUnlocked = Math.max(1, Number(unlocked) || 1, maxPassed + 1);

  // Mavzu yakunlangan: testidan o'tilgan yoki ketma-ket ochish zanjirida undan keyingisi ochilgan
  const isDone = (n) => passed.has(n) || n < (Number(unlocked) || 1);
  const isOpen = (n) => fullAccess || n <= effectiveUnlocked;

  let totalAll = 0;
  let doneAll = 0;

  const list = courses.map((course) => {
    const total = course.lessons.length;
    const done = course.lessons.filter((l) => isDone(l.number)).length;
    totalAll += total;
    doneAll += done;

    const nextLesson = course.lessons.find((l) => !isDone(l.number) && isOpen(l.number)) || null;
    const firstLesson = course.lessons[0];
    let status;
    if (done === total) status = "done";
    else if (nextLesson) status = done > 0 ? "active" : "available";
    else status = "locked";

    // Qulflangan kurs uchun: qaysi kurs yakunlanishi kerak
    const blockedBy = status === "locked"
      ? courses.find((c) => c.lessons.some((l) => l.number < firstLesson.number && !isDone(l.number)))
      : null;

    // Har bir mavzu holati: done | current | available | locked
    const lessons = course.lessons.map((l) => {
      let state;
      if (isDone(l.number)) state = "done";
      else if (nextLesson && l === nextLesson) state = "current";
      else if (isOpen(l.number)) state = "available";
      else state = "locked";
      const prereq = state === "locked" ? prerequisiteLabel(courses, l.number) : null;
      return {
        number: l.number,
        label: l.numberLabel || `${l.number}-mavzu`,
        title: l.title,
        youtubeId: l.youtubeId,
        testUrl: l.testUrl || null,
        anchor: lessonAnchorId(l),
        href: new URL(`${course.page}#${lessonAnchorId(l)}`, ROOT).href,
        state,
        lockedReason: prereq ? `Avval ${prereq} testidan kamida 80% natija oling.` : null,
      };
    });

    return {
      id: course.id,
      title: course.title,
      icon: course.icon,
      chapters: course.chapters || null,
      lessons,
      firstHref: new URL(`${course.page}#${lessonAnchorId(firstLesson)}`, ROOT).href,
      description: course.description,
      page: new URL(course.page, ROOT).href,
      total,
      done,
      percent: total ? Math.round((done / total) * 100) : 0,
      status,
      blockedBy: blockedBy ? { id: blockedBy.id, title: blockedBy.title } : null,
      next: nextLesson
        ? {
            number: nextLesson.number,
            label: nextLesson.numberLabel || `${nextLesson.number}-mavzu`,
            title: nextLesson.title,
            href: new URL(`${course.page}#${lessonAnchorId(nextLesson)}`, ROOT).href,
          }
        : null,
    };
  });

  return {
    effectiveUnlocked,
    overall: { total: totalAll, done: doneAll, percent: totalAll ? Math.round((doneAll / totalAll) * 100) : 0 },
    courses: list,
    // Hozir o'qilayotgan kurs: boshlangan va tugallanmagan birinchi kurs, bo'lmasa birinchi ochiq kurs
    current: list.find((c) => c.status === "active") || list.find((c) => c.status === "available") || null,
  };
}

/** Mehmon uchun: shaxsiy progressiz tuzilma (barcha mavzular "available" emas — faqat ro'yxat). */
export function courseStructure(courses = COURSES) {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    icon: c.icon,
    description: c.description,
    page: new URL(c.page, ROOT).href,
    total: c.lessons.length,
    lessons: c.lessons.map((l) => ({ label: l.numberLabel || `${l.number}-mavzu`, title: l.title, anchor: lessonAnchorId(l), href: new URL(`${c.page}#${lessonAnchorId(l)}`, ROOT).href })),
  }));
}

/**
 * Kirgan foydalanuvchining to'liq statistikasi.
 * @param {{ user: {uid:string}, profile: object|null }} session
 */
export async function getLearningSummary(session) {
  const results = await loadResults(session.user?.uid);
  const passedNumbers = results.filter((r) => r.passed === true).map((r) => Number(r.lessonId));

  const uid = session.user?.uid;
  const owner = readOwner();
  const foreign = Boolean(owner && uid && owner !== uid);
  const localUnlocked = foreign ? 1 : getMechanicsUnlockedLesson();
  const progress = computeProgress({
    unlocked: localUnlocked,
    passedNumbers,
    fullAccess: session.profile?.fullAccess === true,
  });

  // Boshqa qurilmada o'tilgan mavzularni shu qurilmada ham ochish (mavjud funksiya orqali)
  if (foreign) {
    replaceMechanicsUnlockedLesson(progress.effectiveUnlocked);
  } else if (progress.effectiveUnlocked > localUnlocked) {
    unlockMechanicsLesson(progress.effectiveUnlocked);
  }

  if (uid) writeOwner(uid);

  return {
    progress,
    stats: {
      topicsDone: progress.overall.done,
      topicsTotal: progress.overall.total,
      testsTaken: results.length,
      testsPassed: results.filter((r) => r.passed === true).length,
      xp: Number(session.profile?.xp) || 0,
      level: Number(session.profile?.level) || 1,
    },
  };
}

export function totalLessons() {
  return COURSES.reduce((sum, c) => sum + c.lessons.length, 0);
}
