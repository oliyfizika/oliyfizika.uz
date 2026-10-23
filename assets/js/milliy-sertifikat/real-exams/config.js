// ==========================================================================
// Real imtihonlar — modul sozlamalari (yagona boshqaruv nuqtasi).
//
// Ma'lumot manbai (data adapter):
//   "local"     — faqat lokal ishlab chiqish: _private/real-imtihonlar/app-data/ (gitignored, deploy qilinmaydi).
//                 Faqat localhost / 127.0.0.1 / *.localhost da yoqiladi.
//   "firestore" — production: realExams/{examId} (+ content/questions, private/solutions) va
//                 Storage real-exams/{examId}.pdf, real-exams/{examId}/figures/{figureId}.png.
//
// FIRESTORE_ENABLED=false: production'da hali ma'lumot yuklanmagan va Rules deploy qilinmagan
// (PHASE 4 — faqat arxitektura). Bu holatda sahifa "tez orada" holatini ko'rsatadi va Firestore'ga
// hech qanday so'rov yubormaydi. Yoqish — alohida tasdiqlangan bosqichda.
// ==========================================================================

const host = typeof location !== "undefined" ? location.hostname : "";
export const IS_LOCAL_HOST = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || host.endsWith(".localhost");

export const DATA_SOURCE = IS_LOCAL_HOST ? "local" : "firestore";
export const FIRESTORE_ENABLED = false;

// Ruxsat: mavjud users/{uid}.mockTestsAccess === true (Mock testlar video/PDF bilan bir xil). Yangi maydon yo'q.
export const ACCESS_FIELD = "mockTestsAccess";

// Firestore / Storage nomlari (Rules dizayni bilan bir xil — docs/real-imtihonlar/).
export const FIRESTORE = {
  collection: "realExams",
  questionsDoc: ["content", "questions"],
  solutionsDoc: ["private", "solutions"],
};
export const STORAGE = {
  pdf: (examId) => `real-exams/${examId}.pdf`,
  figure: (examId, figureId) => `real-exams/${examId}/figures/${figureId}.png`,
};

export const TELEGRAM_URL = "https://t.me/oliyfizika_uz";
