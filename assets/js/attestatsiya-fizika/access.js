// ==========================================================================
// Attestatsiya → Fizika: kun bo'yicha kirish (UI qatlami). HAQIQIY tekshiruv — Firestore Rules (attDayOpen,
// attContentAccess); bu modul faqat nima ko'rsatilishini hal qiladi (yopiq karta, start tugmasi yo'q).
//
// Umumiy qoida (kun raqami hard-code qilinmagan):
//   dayNumber <= FREE_DAYS (3)  — har bir kirgan foydalanuvchiga ochiq;
//   dayNumber >  FREE_DAYS      — admin | settings.accessMode == "open" | users/{uid}.attestationAccess == true.
// O'z urinishi bor kun (tarix) — natija/ko'rib chiqish/yechim ochiq qoladi (yangi start emas).
// Mavjud arxitektura: attestationPhysicsSettings/config.accessMode (open|paid) + users/{uid}.attestationAccess.
// ==========================================================================
export const FREE_DAYS = 3;

export const isFreeDay = (test) => Number.isInteger(test?.dayNumber) && test.dayNumber <= FREE_DAYS;

/** @param {{accessMode?:string}} settings  @param {object|null} profile users/{uid} */
export function accessContext(settings, profile) {
  return {
    open: settings?.accessMode === "open",
    admin: profile?.role === "admin",
    granted: profile?.attestationAccess === true,
  };
}

/** Yangi urinish boshlash / kontentni ko'rish mumkinmi (Rules: attDayOpen). */
export function dayOpen(test, ctx) {
  if (!test) return false;
  return isFreeDay(test) || !!(ctx && (ctx.open || ctx.admin || ctx.granted));
}

/** Kontent (natija, ko'rib chiqish, yechim) — kun ochiq yoki o'z urinishi bor (Rules: attContentAccess). */
export function contentOpen(test, ctx, attempt) {
  return dayOpen(test, ctx) || !!attempt;
}

export const ACCESS_TITLE = "Kirish uchun ruxsat kerak";
export const ACCESS_TEXT = "Bu kun «Attestatsiya — Fizika» kursi ishtirokchilari uchun. Day 1–3 hamma uchun bepul.";
export const COURSE_URL = "https://t.me/oliy_fizik";

/**
 * settings + o'z users/{uid} hujjati (Rules: egasi o'qiydi). api.js dinamik yuklanadi — modul Node'da ham testlanadi.
 * Xato bo'lsa — eng qattiq kontekst (faqat bepul kunlar / o'z urinishlari); Rules baribir yakuniy hakam.
 */
export async function loadAccessContext(uid) {
  const { fb, getSettings } = await import("./api.js");
  try {
    const [settings, prof] = await Promise.all([
      getSettings(),
      fb().then(({ db, fsSdk }) => fsSdk.getDoc(fsSdk.doc(db, "users", uid))).then((s) => (s.exists() ? s.data() : null)),
    ]);
    return accessContext(settings, prof);
  } catch (err) {
    console.warn("[att] access:", err?.code || err);
    return { open: false, admin: false, granted: false };
  }
}
