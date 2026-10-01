// ==========================================================================
// Profil va Sozlamalar sahifalari uchun umumiy yordamchilar (faqat o'qish/ko'rsatish).
// Ma'lumot manbai — session.js dagi bitta users/{uid} o'qishi (qo'shimcha so'rov yo'q).
// ==========================================================================

import { icon } from "../ui/icons.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function fillIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => {
    if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon);
  });
}

/** Ism/Familiya: yangi foydalanuvchilarda firstName/lastName, eski hisoblarda fullName bo'linadi. */
export function splitName(profile, user) {
  const first = String(profile?.firstName || "").trim();
  const last = String(profile?.lastName || "").trim();
  if (first || last) return { firstName: first, lastName: last };
  const full = String(profile?.fullName || user?.displayName || "").replace(/\s+/g, " ").trim();
  if (!full) return { firstName: "", lastName: "" };
  const [head, ...rest] = full.split(" ");
  return { firstName: head, lastName: rest.join(" ") };
}

/** Firestore Timestamp / {seconds} / ISO / Date -> "12-sentabr, 2026". Noma'lum bo'lsa "". */
export function formatDate(value) {
  let date = null;
  try {
    if (value?.toDate) date = value.toDate();
    else if (typeof value?.seconds === "number") date = new Date(value.seconds * 1000);
    else if (value?.iso) date = new Date(value.iso);
    else if (value instanceof Date) date = value;
    else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  } catch { date = null; }
  if (!date || Number.isNaN(date.getTime())) return "";
  // Brauzerlarda uz-UZ oy nomlari bir xil emas ("2025 M01 1") — shuning uchun aniq o'zbekcha format
  return `${date.getDate()}-${UZ_MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** Kirish usullari (Firebase Auth providerData) — hech narsa o'zgartirilmaydi, faqat o'qiladi. */
export function providers(user) {
  const ids = (user?.providerData || []).map((p) => p?.providerId).filter(Boolean);
  return {
    hasPassword: ids.includes("password"),
    hasGoogle: ids.includes("google.com"),
    googleOnly: ids.includes("google.com") && !ids.includes("password"),
  };
}

export function methodLabel(user) {
  const p = providers(user);
  if (p.hasPassword && p.hasGoogle) return "Email va parol, Google";
  if (p.hasGoogle) return "Google hisobi";
  if (p.hasPassword) return "Email va parol";
  return "—";
}

export function initialsOf(first, last, fallback = "") {
  const a = (first || "")[0] || "";
  const b = (last || "")[0] || "";
  return (a + b).toUpperCase() || (fallback[0] || "O").toUpperCase();
}
