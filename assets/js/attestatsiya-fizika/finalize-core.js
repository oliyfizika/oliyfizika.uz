// ==========================================================================
// Attestatsiya → Fizika: avtomatik yakunlashning sof qismi (DOM/Firebase yo'q, Node'da testlanadi).
// Yakuniy qaror — Firestore Rules (attValidAutoSubmit, server vaqti). Bu yerdagi vaqt tekshiruvi faqat ishora.
// ==========================================================================
import { toMs } from "./core.js";

/** Avtomatik yakunlashga nomzodmi: rasmiy, in_progress, testVersion butun son (taxmin qilinmaydi), yechim vaqti kelgan. */
export function isOverdue(attempt, test, now = Date.now()) {
  const at = toMs(test?.solutionAvailableAt);
  return !!attempt && attempt.status === "in_progress" && attempt.kind === "official"
    && Number.isInteger(attempt.testVersion) && !!test && attempt.testId === test.id && at != null && now >= at;
}

/**
 * in_progress → submitted yozuvi (Rules bilan aynan mos): javoblar o'zgarmaydi (yo'q bo'lsa {}),
 * completedAt = solutionAvailableAt (sarflangan vaqt shu chegara bilan cheklanadi), autoFinalized = true.
 * Natija maydonlari YO'Q — baholash mavjud gradeAttempt()/gradeAnswers() orqali.
 */
export function autoSubmitPatch(attempt, test) {
  const a = attempt?.answers;
  return {
    status: "submitted",
    completedAt: test.solutionAvailableAt,
    answers: a && typeof a === "object" && !Array.isArray(a) ? { ...a } : {},
    autoFinalized: true,
  };
}
