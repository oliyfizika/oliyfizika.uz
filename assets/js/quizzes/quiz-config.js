// ==========================================================================
// Quizlar — umumiy sozlamalar (yagona joy)
// Timer yoki boshqa qiymatni o'zgartirish uchun faqat shu faylni tahrirlang:
// quiz o'yini (quiz-page.js) ham, katalog matni (quizzes-page.js) ham shu yerdan o'qiydi.
// ==========================================================================

export const QUIZ_CONFIG = Object.freeze({
  /** Har bir savolga beriladigan vaqt (soniya). Tugasa — savol javobsiz hisoblanadi va keyingisiga o'tiladi. */
  secondsPerQuestion: 20,
  /** Qolgan vaqt shu soniyadan kam bo'lsa, timer qizil (ogohlantirish) holatga o'tadi. */
  warnAtSeconds: 5,
  /** Bir o'yindagi savollar soni — manifest.json dagi `perPlay` bo'lmasa ishlatiladi. */
  questionsPerPlay: 15,
});
