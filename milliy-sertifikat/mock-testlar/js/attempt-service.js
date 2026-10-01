// Urinishni topshirish qatlami (backend / Rasch tizimiga ulanish nuqtasi).
//
// Kelajakdagi oqim:
//   User -> answers -> API (POST) -> PostgreSQL -> Rasch -> admin -> publication
//   Holatlar: SUBMITTED -> SCORED -> PUBLISHED
//
// Hozir ATTEMPT_CONFIG.mode === "local": natija brauzerda hisoblanadi.
// "api" rejimida frontend faqat xom javoblarni yuboradi va natija
// PUBLISHED bo'lgunicha foydalanuvchiga ball ko'rsatilmaydi.
import { ATTEMPT_CONFIG } from "./config.js";
import { gradeLocal } from "./scoring.js";
import { appendAttempt } from "./storage.js";

export const ATTEMPT_STATUS = Object.freeze({
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  SCORED: "SCORED",
  PUBLISHED: "PUBLISHED",
});

/** Serverga yuboriladigan normallashtirilgan payload (to'g'ri javoblarsiz). */
export function buildAttemptPayload(test, state) {
  return {
    schemaVersion: 1,
    testId: test.id,
    attemptId: state.attemptId,
    student: { uid: state.uid, name: state.name, email: state.email || null },
    startedAt: new Date(state.startTs).toISOString(),
    submittedAt: new Date(state.endTs).toISOString(),
    durationSec: Math.max(0, Math.floor((state.endTs - state.startTs) / 1000)),
    autoSubmitted: !!state.autoSubmitted,
    focusLoss: state.focusLoss || 0,
    // Har bir savol uchun xom javob: MCQ -> "A"; ochiq -> { a: "8", b: "50" }
    answers: test.questions.map((q, i) => ({
      n: q.n,
      type: q.type,
      value: q.type === "mcq" ? state.answers[i] || null : Object.fromEntries(q.parts.map((p) => [p.key, state.answers[i]?.[p.key] ?? null])),
    })),
  };
}

/**
 * Testni topshirish. Har doim { status, attemptId, grade? } qaytaradi.
 * - local: grade (lokal natija) bilan
 * - api:   faqat status (SUBMITTED); grade qaytarilmaydi
 */
export async function submitAttempt(test, state) {
  const payload = buildAttemptPayload(test, state);

  if (ATTEMPT_CONFIG.mode === "api" && ATTEMPT_CONFIG.endpoint) {
    const res = await fetch(ATTEMPT_CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server xatosi: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    appendAttempt(test.id, state.uid, { attemptId: payload.attemptId, submittedAt: payload.submittedAt, status: data.status || ATTEMPT_STATUS.SUBMITTED });
    return { status: data.status || ATTEMPT_STATUS.SUBMITTED, attemptId: payload.attemptId };
  }

  const grade = gradeLocal(test, state.answers);
  appendAttempt(test.id, state.uid, {
    attemptId: payload.attemptId,
    submittedAt: payload.submittedAt,
    status: ATTEMPT_STATUS.SUBMITTED,
    localScore: `${grade.correct}/${grade.maxScore}`,
  });
  return { status: ATTEMPT_STATUS.SUBMITTED, attemptId: payload.attemptId, grade, payload };
}

/** Kelajak uchun: urinish holatini serverdan so'rash (PUBLISHED bo'lsa natija qaytadi). */
export async function fetchAttemptStatus(attemptId) {
  if (ATTEMPT_CONFIG.mode !== "api" || !ATTEMPT_CONFIG.statusEndpoint) return null;
  const res = await fetch(ATTEMPT_CONFIG.statusEndpoint.replace("{id}", encodeURIComponent(attemptId)));
  if (!res.ok) return null;
  return res.json();
}

export const isLocalMode = () => !(ATTEMPT_CONFIG.mode === "api" && ATTEMPT_CONFIG.endpoint);

/** Rasch tahlili uchun nusxalanadigan natija kodi (asl testlardagi V=2 formatiga mos). */
export function makeResultCode(test, state, grade) {
  const clean = (s) => String(s || "").replace(/[|\n\r]/g, " ").trim();
  const duration = Math.max(0, Math.floor((state.endTs - state.startTs) / 1000));
  const ans = test.questions.map((q, i) => {
    const a = state.answers[i];
    if (q.type === "mcq") return `${q.n}:${a || "-"}`;
    return q.parts.map((p) => `${q.n}${p.key}:${a?.[p.key] || "-"}`).join(",");
  }).join(";");
  const prefix = test.resultCode?.prefix || test.id;
  return [
    prefix, `V=${test.resultCode?.version || 2}`, `ID=${state.attemptId}`, `UID=${clean(state.uid)}`, `N=${clean(state.name)}`,
    `SEC=${duration}`, `S=${grade.correct}/${grade.maxScore}`, `QFULL=${grade.full}/${grade.questionCount}`,
    `PART=${grade.partial}`, `BLANK=${grade.blank}`, `FOCUS=${state.focusLoss || 0}`, `BIN=${grade.atomic.join("")}`, `ANS=${ans}`,
  ].join("|");
}
