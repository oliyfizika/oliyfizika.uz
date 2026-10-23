// Real imtihonlar — adapter tanlash. UI faqat shu moduldan foydalanadi (Firebase implementatsiyasiga bog'lanmaydi).
// Yangi manba (masalan, REST API) qo'shish: shu interfeysdagi adapter yozib, shu yerda ulang.
//   listExams() · getExam(id) · getQuestions(id) · getSolutions(id) · figureUrl(fig) · getPdfBlob(id)
import { DATA_SOURCE } from "./config.js";

let adapterPromise = null;

export function getAdapter() {
  if (!adapterPromise) {
    adapterPromise = DATA_SOURCE === "local"
      ? import("./adapters/local-adapter.js").then((m) => m.localAdapter)
      : import("./adapters/firestore-adapter.js").then((m) => m.firestoreAdapter);
  }
  return adapterPromise;
}
