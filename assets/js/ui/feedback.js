// Toast xabarlar va foydalanuvchiga tushunarli xato matnlari.

let region = null;

export function toast(message, { timeout = 3800 } = {}) {
  if (!region) {
    region = document.createElement("div");
    region.className = "of-toast-region of-chrome";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const el = document.createElement("div");
  el.className = "of-toast";
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), timeout);
}

// Firebase va tarmoq xatolarini foydalanuvchi uchun qisqa, tushunarli matnga aylantiradi.
// Texnik tafsilot faqat konsolga yoziladi.
const FRIENDLY = {
  "auth/network-request-failed": "Internet aloqasi bilan muammo yuz berdi. Iltimos, qayta urinib ko‘ring.",
  "auth/too-many-requests": "Juda ko‘p urinish bo‘ldi. Birozdan so‘ng qayta urinib ko‘ring.",
  "auth/invalid-email": "Email manzil noto‘g‘ri kiritilgan.",
  "auth/invalid-credential": "Email yoki parol noto‘g‘ri.",
  "auth/wrong-password": "Email yoki parol noto‘g‘ri.",
  "auth/user-not-found": "Bu email bilan hisob topilmadi.",
  "auth/email-already-in-use": "Bu email bilan hisob allaqachon mavjud. Kirish bo‘limidan foydalaning.",
  "auth/weak-password": "Parol talablarga javob bermaydi.",
  "auth/popup-closed-by-user": "Google oynasi yopildi. Qayta urinib ko‘ring.",
  "auth/popup-blocked": "Brauzer oynani blokladi. Qalqib chiquvchi oynalarga ruxsat bering.",
  "auth/cancelled-popup-request": "Google orqali kirish bekor qilindi.",
  "auth/account-exists-with-different-credential": "Bu email boshqa usul bilan ro‘yxatdan o‘tgan. Email va parol bilan kiring.",
  "auth/requires-recent-login": "Xavfsizlik uchun qayta kirishingiz kerak.",
  "auth/invalid-action-code": "Havola eskirgan yoki allaqachon ishlatilgan. Yangi havola so‘rang.",
  "auth/expired-action-code": "Havolaning muddati tugagan. Yangi havola so‘rang.",
  "permission-denied": "Bu amal uchun ruxsat yo‘q.",
  "unavailable": "Server vaqtincha mavjud emas. Birozdan so‘ng urinib ko‘ring.",
};

export function friendlyError(error, fallback = "Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.") {
  if (error) console.error("[OliyFizika]", error);
  const code = error?.code || "";
  return FRIENDLY[code] || (navigator.onLine === false ? FRIENDLY["auth/network-request-failed"] : fallback);
}
