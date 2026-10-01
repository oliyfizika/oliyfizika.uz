// ==========================================================================
// OliyFizika.uz — Autentifikatsiya xizmati (Firebase Auth + users/{uid})
//
// Mavjud tizim bilan bitta: js/firebase.js dagi o'sha `auth` va `db`,
// o'sha `users/{uid}` hujjat tuzilmasi (fullName, email, xp, level, fullAccess, createdAt, lastActiveAt)
// va o'sha `oliyFizikaPendingDestination` kaliti ishlatiladi.
//
// Ro'yxatdan o'tish (email havola orqali tasdiqlash):
//   1) ism, familiya, email  -> sendSignInLinkToEmail (Firebase'ning xavfsiz email havolasi)
//   2) foydalanuvchi havolani bosadi -> signInWithEmailLink (email egasi ekanligi isbotlanadi)
//   3) faqat shundan keyin parol yaratiladi -> updatePassword + users/{uid} profili
// ==========================================================================

import { loadFirebase, refreshProfile, isProfileComplete } from "../core/session.js";

const ROOT = new URL("../../../", import.meta.url);
export const PENDING_DESTINATION_KEY = "oliyFizikaPendingDestination"; // js/auth.js bilan bir xil
const REGISTRATION_KEY = "oliyfizika:pendingRegistration";
const COMPLETE_SIGNAL_KEY = "oliyfizika:registrationComplete";
export const RESEND_COOLDOWN_MS = 60 * 1000;
const REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;

export const VERIFY_PAGE_PATH = "auth/tasdiqlash.html";

// --------------------------------------------------------------------------
// Validatsiya
// --------------------------------------------------------------------------
const NAME_RE = /^[\p{L}][\p{L}'‘’ʻʼ`\- ]{1,39}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function validateName(value, label) {
  const v = normalizeName(value);
  if (!v) return `${label}ni kiriting.`;
  if (v.length < 2) return `${label} kamida 2 ta harfdan iborat bo‘lishi kerak.`;
  if (!NAME_RE.test(v)) return `${label} faqat harflardan iborat bo‘lishi kerak.`;
  return "";
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateEmail(value) {
  const v = normalizeEmail(value);
  if (!v) return "Email manzilni kiriting.";
  if (!EMAIL_RE.test(v) || v.length > 254) return "Email manzil noto‘g‘ri kiritilgan.";
  return "";
}

export const PASSWORD_RULES = [
  { id: "length", label: "Kamida 8 ta belgi", test: (p) => p.length >= 8 },
  { id: "upper", label: "Kamida 1 ta katta harf", test: (p) => /\p{Lu}/u.test(p) },
  { id: "digit", label: "Kamida 1 ta raqam", test: (p) => /\d/.test(p) },
  { id: "special", label: "Kamida 1 ta maxsus belgi", test: (p) => /[^\p{L}\d\s]/u.test(p) },
];

export function passwordStatus(password) {
  const p = String(password || "");
  const rules = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(p) }));
  return { rules, valid: rules.every((r) => r.ok) };
}

// --------------------------------------------------------------------------
// Qaytish manzili (asl so'ralgan bo'lim)
// --------------------------------------------------------------------------
export function safeDestination(href) {
  if (!href) return null;
  try {
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) return null; // open-redirect himoyasi
    if (u.pathname.endsWith(`/${VERIFY_PAGE_PATH}`)) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function setPendingDestination(href) {
  const safe = safeDestination(href);
  if (!safe) return;
  try { sessionStorage.setItem(PENDING_DESTINATION_KEY, safe); } catch { /* ignore */ }
}

export function peekPendingDestination() {
  try { return safeDestination(sessionStorage.getItem(PENDING_DESTINATION_KEY)); } catch { return null; }
}

export function takePendingDestination() {
  const dest = peekPendingDestination();
  try { sessionStorage.removeItem(PENDING_DESTINATION_KEY); } catch { /* ignore */ }
  return dest;
}

// --------------------------------------------------------------------------
// Ro'yxatdan o'tish holati (havola boshqa tabda ochilgani uchun localStorage)
// --------------------------------------------------------------------------
export function getPendingRegistration() {
  try {
    const data = JSON.parse(localStorage.getItem(REGISTRATION_KEY) || "null");
    if (!data || !data.email) return null;
    if (Date.now() - (data.sentAt || 0) > REGISTRATION_TTL_MS) {
      localStorage.removeItem(REGISTRATION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function savePendingRegistration(data) {
  try { localStorage.setItem(REGISTRATION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function clearPendingRegistration() {
  try { localStorage.removeItem(REGISTRATION_KEY); } catch { /* ignore */ }
}

export function resendAvailableIn(reg = getPendingRegistration()) {
  if (!reg?.sentAt) return 0;
  return Math.max(0, reg.sentAt + RESEND_COOLDOWN_MS - Date.now());
}

function verifyUrl(next) {
  const url = new URL(VERIFY_PAGE_PATH, ROOT);
  const safeNext = safeDestination(next);
  if (safeNext) url.searchParams.set("next", new URL(safeNext).pathname + new URL(safeNext).search + new URL(safeNext).hash);
  return url.href;
}

/** 1-qadam: tasdiqlash havolasini yuborish. */
export async function startRegistration({ firstName, lastName, email }) {
  const fb = await loadFirebase();
  const cleanEmail = normalizeEmail(email);
  const next = peekPendingDestination() || getPendingRegistration()?.next || null;
  await fb.authSdk.sendSignInLinkToEmail(fb.auth, cleanEmail, {
    url: verifyUrl(next),
    handleCodeInApp: true,
  });
  const reg = {
    firstName: normalizeName(firstName),
    lastName: normalizeName(lastName),
    email: cleanEmail,
    next,
    sentAt: Date.now(),
  };
  savePendingRegistration(reg);
  return reg;
}

/** "Emailni qayta yuborish" — cooldown bilan. */
export async function resendRegistrationLink() {
  const reg = getPendingRegistration();
  if (!reg) throw Object.assign(new Error("no pending registration"), { code: "of/no-registration" });
  const wait = resendAvailableIn(reg);
  if (wait > 0) throw Object.assign(new Error("cooldown"), { code: "of/cooldown", wait });
  return startRegistration(reg);
}

export async function isEmailLink(href = location.href) {
  const fb = await loadFirebase();
  return fb.authSdk.isSignInWithEmailLink(fb.auth, href);
}

/**
 * 2-qadam: havola bosilgandan keyin — email egaligini tasdiqlab tizimga kiritadi.
 * @returns {{ user, profile, existingAccount: boolean }}
 */
export async function completeEmailLink(email, href = location.href) {
  const fb = await loadFirebase();
  const cred = await fb.authSdk.signInWithEmailLink(fb.auth, normalizeEmail(email), href);
  const snap = await fb.fsSdk.getDoc(fb.fsSdk.doc(fb.db, "users", cred.user.uid));
  const profile = snap.exists() ? snap.data() : null;
  // URL'dagi bir martalik kodni manzil satridan olib tashlaymiz
  try {
    const clean = new URL(location.href);
    ["apiKey", "oobCode", "mode", "lang", "continueUrl", "tenantId"].forEach((k) => clean.searchParams.delete(k));
    history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
  } catch { /* ignore */ }
  return { user: cred.user, profile, existingAccount: isProfileComplete(profile) };
}

/** 3-qadam: parol yaratish va hisobni yakunlash. */
export async function finishRegistration({ password, firstName, lastName }) {
  const fb = await loadFirebase();
  const user = fb.auth.currentUser;
  if (!user) throw Object.assign(new Error("no session"), { code: "of/no-session" });
  if (!user.emailVerified) throw Object.assign(new Error("not verified"), { code: "of/not-verified" });
  if (!passwordStatus(password).valid) throw Object.assign(new Error("weak"), { code: "auth/weak-password" });

  await fb.authSdk.updatePassword(user, password);

  const fullName = [normalizeName(firstName), normalizeName(lastName)].filter(Boolean).join(" ");
  if (fullName) {
    try { await fb.authSdk.updateProfile(user, { displayName: fullName }); } catch (e) { console.warn("[auth] displayName:", e?.code); }
  }
  await ensureUserProfile(user, { fullName, firstName: normalizeName(firstName), lastName: normalizeName(lastName) });

  clearPendingRegistration();
  try { localStorage.setItem(COMPLETE_SIGNAL_KEY, String(Date.now())); } catch { /* ignore */ }
  await refreshProfile();
  return user;
}

/** Boshqa tabda ro'yxatdan o'tish yakunlanganini tinglash. */
export function onRegistrationCompleteElsewhere(callback) {
  const handler = (event) => { if (event.key === COMPLETE_SIGNAL_KEY) callback(); };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * users/{uid} hujjatini yaratadi — faqat yo'q maydonlarni yozadi.
 * Mavjud ma'lumot (xp, level, fullAccess, mockTestsAccess, phone ...) HECH QACHON ustiga yozilmaydi.
 */
export async function ensureUserProfile(user, { fullName = "", firstName = "", lastName = "" } = {}) {
  const fb = await loadFirebase();
  const { doc, getDoc, setDoc, serverTimestamp } = fb.fsSdk;
  const ref = doc(fb.db, "users", user.uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};

  const defaults = {
    fullName: fullName || user.displayName || "",
    email: user.email || "",
    xp: 0,
    level: 1,
    fullAccess: false,
    createdAt: serverTimestamp(),
  };
  if (firstName) defaults.firstName = firstName;
  if (lastName) defaults.lastName = lastName;

  const patch = {};
  for (const [key, value] of Object.entries(defaults)) {
    const current = existing[key];
    if (current === undefined || current === null || current === "") patch[key] = value;
  }
  patch.lastActiveAt = serverTimestamp();
  await setDoc(ref, patch, { merge: true });
  return { ...existing, ...patch };
}

// --------------------------------------------------------------------------
// Kirish / Google / parolni tiklash / chiqish
// --------------------------------------------------------------------------
export async function loginWithPassword(email, password) {
  const fb = await loadFirebase();
  const cred = await fb.authSdk.signInWithEmailAndPassword(fb.auth, normalizeEmail(email), password);
  return cred.user;
}

function isMobileLike() {
  return matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Google bilan davom etish.
 * Firebase "bitta email — bitta hisob" rejimida ishlaydi, shuning uchun Google hisobi
 * shu emaildagi mavjud hisobga (o'sha UID) ulanadi — dublikat profil yaratilmaydi.
 */
export async function loginWithGoogle() {
  const fb = await loadFirebase();
  const provider = new fb.authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await fb.authSdk.signInWithPopup(fb.auth, provider);
    await ensureUserProfile(cred.user, { fullName: cred.user.displayName || "" });
    await refreshProfile();
    return { user: cred.user };
  } catch (error) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error?.code) && isMobileLike()) {
      try { sessionStorage.setItem("oliyfizika:googleRedirect", "1"); } catch { /* ignore */ }
      await fb.authSdk.signInWithRedirect(fb.auth, provider);
      return { redirected: true };
    }
    throw error;
  }
}

/** Google redirect orqali qaytgan bo'lsa — profilni ta'minlaydi. Har sahifada xavfsiz chaqiriladi. */
export async function completeGoogleRedirect() {
  let flagged = false;
  try { flagged = sessionStorage.getItem("oliyfizika:googleRedirect") === "1"; } catch { /* ignore */ }
  if (!flagged) return null;
  try { sessionStorage.removeItem("oliyfizika:googleRedirect"); } catch { /* ignore */ }
  const fb = await loadFirebase();
  const result = await fb.authSdk.getRedirectResult(fb.auth);
  if (!result?.user) return null;
  await ensureUserProfile(result.user, { fullName: result.user.displayName || "" });
  await refreshProfile();
  return result.user;
}

export async function sendPasswordReset(email) {
  const fb = await loadFirebase();
  await fb.authSdk.sendPasswordResetEmail(fb.auth, normalizeEmail(email), {
    url: new URL("index.html", ROOT).href,
  });
}

/** Joriy parolni tekshirib, yangisiga almashtirish (Profil / Sozlamalar uchun). */
export async function changePassword(currentPassword, newPassword) {
  const fb = await loadFirebase();
  const user = fb.auth.currentUser;
  if (!user?.email) throw Object.assign(new Error("no session"), { code: "of/no-session" });
  if (!passwordStatus(newPassword).valid) throw Object.assign(new Error("weak"), { code: "auth/weak-password" });
  const credential = fb.authSdk.EmailAuthProvider.credential(user.email, currentPassword);
  await fb.authSdk.reauthenticateWithCredential(user, credential);
  await fb.authSdk.updatePassword(user, newPassword);
}

// --------------------------------------------------------------------------
// Xato matnlari (o'zbekcha, qisqa, amaliy). Texnik tafsilot faqat konsolda.
// --------------------------------------------------------------------------
const AUTH_ERRORS = {
  "auth/network-request-failed": "Internet aloqasi bilan muammo yuz berdi. Iltimos, qayta urinib ko‘ring.",
  "auth/too-many-requests": "Juda ko‘p urinish bo‘ldi. Birozdan so‘ng qayta urinib ko‘ring.",
  "auth/quota-exceeded": "Bugun juda ko‘p xat yuborildi. Birozdan so‘ng qayta urinib ko‘ring.",
  "auth/invalid-email": "Email manzil noto‘g‘ri kiritilgan.",
  "auth/missing-email": "Email manzilni kiriting.",
  "auth/missing-password": "Parolni kiriting.",
  "auth/invalid-credential": "Email yoki parol noto‘g‘ri.",
  "auth/invalid-login-credentials": "Email yoki parol noto‘g‘ri.",
  "auth/wrong-password": "Email yoki parol noto‘g‘ri.",
  "auth/user-not-found": "Email yoki parol noto‘g‘ri.",
  "auth/user-disabled": "Bu hisob bloklangan. Yordam uchun biz bilan bog‘laning.",
  "auth/weak-password": "Parol talablarga javob bermaydi.",
  "auth/email-already-in-use": "Bu email bilan hisob allaqachon mavjud. “Kirish” orqali kiring.",
  "auth/invalid-action-code": "Tasdiqlash havolasi yaroqsiz yoki allaqachon ishlatilgan. Yangi havola so‘rang.",
  "auth/expired-action-code": "Tasdiqlash havolasining muddati tugagan. Yangi havola so‘rang.",
  "auth/argument-error": "Tasdiqlash havolasi to‘liq emas. Xatdagi havolani qayta oching.",
  "auth/requires-recent-login": "Xavfsizlik uchun qayta tasdiqlash kerak. Yangi havola so‘rang yoki qayta kiring.",
  "auth/popup-closed-by-user": "Google oynasi yopildi. Qayta urinib ko‘ring.",
  "auth/cancelled-popup-request": "Google orqali kirish bekor qilindi.",
  "auth/popup-blocked": "Brauzer Google oynasini blokladi. Qalqib chiquvchi oynalarga ruxsat bering.",
  "auth/account-exists-with-different-credential": "Bu email boshqa usul bilan ro‘yxatdan o‘tgan. Email va parol bilan kiring.",
  "auth/operation-not-allowed": "Bu kirish usuli hozircha yoqilmagan. Keyinroq urinib ko‘ring.",
  "auth/unauthorized-domain": "Bu sahifadan kirishga ruxsat berilmagan. Iltimos, oliyfizika.uz orqali kiring.",
  "auth/unauthorized-continue-uri": "Bu sahifadan kirishga ruxsat berilmagan. Iltimos, oliyfizika.uz orqali kiring.",
  "auth/internal-error": "Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.",
  "permission-denied": "Ma’lumotni saqlashga ruxsat berilmadi. Iltimos, qayta urinib ko‘ring.",
  "unavailable": "Server vaqtincha mavjud emas. Birozdan so‘ng urinib ko‘ring.",
  "of/no-session": "Sessiya tugagan. Iltimos, tasdiqlash havolasini qayta so‘rang.",
  "of/not-verified": "Avval emailingizni tasdiqlang.",
  "of/no-registration": "Ro‘yxatdan o‘tish ma’lumotlari topilmadi. Qaytadan boshlang.",
};

export function authErrorMessage(error, fallback = "Amalni bajarib bo‘lmadi. Iltimos, qayta urinib ko‘ring.") {
  if (error) console.error("[auth]", error?.code || "", error);
  if (navigator.onLine === false) return AUTH_ERRORS["auth/network-request-failed"];
  return AUTH_ERRORS[error?.code] || fallback;
}
