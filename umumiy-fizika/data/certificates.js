// ==========================================================================
// Umumiy fizika — sertifikat sozlamalari (YAGONA MANBA, klient tomoni).
//
// DIQQAT: bu ro'yxat firestore.rules ichidagi certLessonOk / certRequired / certTitle / certCode
// funksiyalari bilan MOS bo'lishi shart. Mavzu testi qo'shilganda (masalan, 14-mavzu yoki Atom bo'limi)
// ikkala joyni birga yangilang va rules'ni qayta deploy qiling. Hujjat: docs/sertifikatlar.md
// ==========================================================================

/** Faqat testi bor mavzular talab qilinadi (14-mavzu testi hozircha yo'q). */
const range = (from, to, skip = []) => {
  const out = [];
  for (let n = from; n <= to; n++) if (!skip.includes(n)) out.push(n);
  return out;
};

export const CERT_SECTIONS = [
  { id: "mexanika", code: "MEX", title: "Mexanika", lessons: range(1, 34, [14]) },
  { id: "molekulyar", code: "MOL", title: "Molekulyar fizika", lessons: range(35, 50) },
  { id: "elektr", code: "ELE", title: "Elektr va magnetizm", lessons: range(51, 72) },
  { id: "optika", code: "OPT", title: "Optika", lessons: range(73, 81) },
];

/** Atom va yadro fizikasi: testlar hali yo'q — sertifikat berilmaydi ("tez orada"). */
export const CERT_PENDING_SECTIONS = [{ id: "atom", title: "Atom va yadro fizikasi" }];

export const CERT_FULL = {
  id: "umumiy",
  code: "UMU",
  title: "Umumiy fizika",
  sections: CERT_SECTIONS.map((s) => s.id),
};

/** Birinchi va oxirgi natija orasida kamida (mavzu soni × shu soniya) o'tishi kerak — rules ham tekshiradi. */
export const MIN_SECONDS_PER_LESSON = 60;
export const MIN_PERCENT = 80;

export const SITE_NAME = "oliyfizika.uz";
export const VERIFY_URL = "https://oliyfizika.uz/certificates/verify.html";

export const sectionById = (id) => CERT_SECTIONS.find((s) => s.id === id) || null;
export const sectionOfLesson = (n) => CERT_SECTIONS.find((s) => s.lessons.includes(Number(n))) || null;
export const titleOf = (id) => (id === CERT_FULL.id ? CERT_FULL.title : sectionById(id)?.title || "");
export const codeOf = (id) => (id === CERT_FULL.id ? CERT_FULL.code : sectionById(id)?.code || "UMU");
