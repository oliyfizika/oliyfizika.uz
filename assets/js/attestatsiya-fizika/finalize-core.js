// ==========================================================================
// Attestatsiya → Fizika: avtomatik yakunlashning sof qismi (DOM/Firebase yo'q, Node'da testlanadi).
// Yakuniy qaror — Firestore Rules (attValidAutoSubmit, server vaqti). Bu yerdagi vaqt tekshiruvi faqat ishora.
// ==========================================================================
import { autoFromMs, isLimited } from "./core.js";

/** Avtomatik yakunlashga nomzodmi: rasmiy, in_progress, testVersion butun son (taxmin qilinmaydi), yechim vaqti kelgan. */
export function isOverdue(attempt, test, now = Date.now()) {
  // Chegara yo'q (kunlik) — solutionAvailableAt; vaqt chegarasi bor (mock) — min(startedAt + limit, yechim vaqti) (+ grace, Rules: attAutoFrom)
  const at = attempt && test ? autoFromMs(attempt, test) : null;
  return !!attempt && attempt.status === "in_progress" && attempt.kind === "official"
    && Number.isInteger(attempt.testVersion) && !!test && attempt.testId === test.id && at != null && now >= at;
}

/**
 * in_progress → submitted yozuvi (Rules bilan aynan mos): javoblar o'zgarmaydi (yo'q bo'lsa {}),
 * completedAt = tugash vaqti: solutionAvailableAt, yoki (vaqt chegarasi bor testda) startedAt + limit — sarflangan vaqt
 * shu chegara bilan cheklanadi. autoFinalized = true.
 * Natija maydonlari YO'Q — baholash mavjud gradeAttempt()/gradeAnswers() orqali.
 */
export function autoSubmitPatch(attempt, test) {
  const a = attempt?.answers;
  let completedAt = test.solutionAvailableAt;
  if (isLimited(attempt, test)) {
    // aynan startedAt + limit (nanosoniyalar bilan) — Rules: n.completedAt == o.startedAt + duration.value(limit, 's')
    completedAt = { seconds: attempt.startedAt.seconds + test.timeLimitSeconds, nanoseconds: attempt.startedAt.nanoseconds || 0 };
  }
  return {
    status: "submitted",
    completedAt,
    answers: a && typeof a === "object" && !Array.isArray(a) ? { ...a } : {},
    autoFinalized: true,
  };
}
