// Topshirilgan mock urinishni admin statistikasi uchun Firestore'ga yozish (mockTestAttempts).
//
// - Hujjat ID: `${uid}__${attemptId}` — bitta urinish faqat bir marta yoziladi (qayta urinishda dublikat yo'q).
// - Faqat xulosa yoziladi (ball, to'liq/qisman/bo'sh, vaqt) — xom javoblar va to'g'ri javoblar yuborilmaydi.
// - Yozuv test natijasini ko'rsatishni to'xtatmaydi: xato bo'lsa konsolga yoziladi, keyingi ochilishda qayta urinadi.
// - Ruxsat: firestore.rules → mockTestAttempts (egasi yaratadi, o'zgartirib bo'lmaydi; ro'yxatni faqat admin o'qiydi).
// - Kirish tizimi (mockTestsAccess) va pullik yechimlarga aloqasi yo'q.

const clip = (v, max) => String(v ?? "").slice(0, max);
const int = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

/** @returns {Promise<boolean>} true — Firestore'da yozuv bor (yangi yozildi yoki avval yozilgan). */
export async function recordAttempt(test, state, grade) {
  if (!state?.uid || !state.attemptId || !grade) return false;
  try {
    const [{ db }, { doc, setDoc, getDoc, serverTimestamp }] = await Promise.all([
      import("../../../js/firebase.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    ]);
    const ref = doc(db, "mockTestAttempts", `${state.uid}__${state.attemptId}`);
    const maxScore = int(grade.maxScore);
    const correct = Math.min(int(grade.correct), maxScore);
    const data = {
      schemaVersion: 1,
      uid: state.uid,
      name: clip(state.name, 200),
      testId: test.id,
      testNumber: int(test.number),
      testTitle: clip(test.title, 200),
      attemptId: clip(state.attemptId, 64),
      correct,
      maxScore,
      percent: maxScore ? Math.round((correct / maxScore) * 100) : 0,
      full: int(grade.full),
      partial: int(grade.partial),
      blank: int(grade.blank),
      questionCount: int(grade.questionCount),
      durationSec: Math.max(0, Math.floor(((state.endTs || 0) - (state.startTs || 0)) / 1000)),
      autoSubmitted: !!state.autoSubmitted,
      focusLoss: int(state.focusLoss),
      startedAtMs: int(state.startTs),
      finishedAtMs: int(state.endTs),
      submittedAt: serverTimestamp(),
    };
    if (state.email) data.email = state.email;
    try {
      await setDoc(ref, data);
      return true;
    } catch (error) {
      // Avval yozilgan bo'lsa (qayta yuborish) — Rules update'ni rad etadi; mavjudligini tekshiramiz.
      const snap = await getDoc(ref).catch(() => null);
      if (snap?.exists()) return true;
      throw error;
    }
  } catch (error) {
    console.warn("Mock urinishini statistikaga yozib bo‘lmadi:", error?.code || error);
    return false;
  }
}
