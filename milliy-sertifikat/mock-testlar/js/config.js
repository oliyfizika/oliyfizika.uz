// OliyFizika.uz — Mock testlar umumiy sozlamalari.
// Bu fayl yagona "boshqaruv paneli": test engine kodini o'zgartirmasdan
// xatti-harakatni shu yerdan boshqaring.

export const SITE = {
  name: "OliyFizika.uz",
  author: "Amirov Sarvar",
  telegram: "@oliyfizika_uz",
  telegramUrl: "https://t.me/oliyfizika_uz",
};

// Testlar katalogi (yangi test qo'shish uchun data/tests.json ga qator qo'shing).
export const CATALOG_URL = "data/tests.json";

// Test yechish uchun saytga kirish har doim shart (ism profildan olinadi).
// true bo'lsa, interaktiv testlar ham Firestore `users/{uid}.mockTestsAccess === true`
// bo'lgan foydalanuvchilarga ochiladi (video/PDF tizimidagi bilan bir xil tekshiruv).
export const REQUIRE_MOCK_ACCESS = false;

// Urinishlarni topshirish rejimi:
//  "local" — natija brauzerda hisoblanadi va darhol ko'rsatiladi (hozirgi rejim).
//  "api"   — javoblar serverga yuboriladi (SUBMITTED). Natija faqat server
//            Rasch hisob-kitobidan va admin tasdiqlashidan so'ng (PUBLISHED) ko'rsatiladi.
export const ATTEMPT_CONFIG = {
  mode: "local",
  endpoint: null, // masalan: "https://api.oliyfizika.uz/v1/attempts"
  statusEndpoint: null, // masalan: "https://api.oliyfizika.uz/v1/attempts/{id}"
};

export const STORAGE_PREFIX = "oliyfizika:mock:";
