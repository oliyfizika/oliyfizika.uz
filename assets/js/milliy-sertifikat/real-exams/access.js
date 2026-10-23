// ==========================================================================
// Real imtihonlar — frontend ruxsat darvozasi (UX). HAQIQIY HIMOYA — Firestore/Storage Rules.
// Mavjud model qayta ishlatiladi: users/{uid}.mockTestsAccess === true (Mock testlar video/PDF bilan bir xil).
// Yangi realExamAccess maydoni YO'Q. Profil mavjud core/session.js orqali bir marta o'qiladi.
//   { allowed:false, reason:"login" }   — mehmon
//   { allowed:false, reason:"access" }  — kirgan, lekin mockTestsAccess !== true
//   { allowed:false, reason:"error" }   — sessiya/profil o'qilmadi
//   { allowed:true }                    — ruxsat bor
// ==========================================================================
import { onSession, whenReady } from "../../core/session.js";
import { ACCESS_FIELD } from "./config.js";

const PROFILE_TIMEOUT_MS = 12000;

function waitProfile() {
  return new Promise((resolve) => {
    let off = () => {};
    const timer = setTimeout(() => { off(); resolve(null); }, PROFILE_TIMEOUT_MS);
    off = onSession((s) => {
      if (s.status !== "authenticated") { clearTimeout(timer); queueMicrotask(() => off()); resolve(s); return; }
      if (s.profileLoaded) { clearTimeout(timer); queueMicrotask(() => off()); resolve(s); }
    });
  });
}

export async function checkRealExamAccess() {
  try {
    const first = await whenReady();
    if (first.status === "offline") return { allowed: false, reason: "error" };
    if (first.status !== "authenticated" || !first.user) return { allowed: false, reason: "login" };
    const s = await waitProfile();
    if (!s) return { allowed: false, reason: "error" };
    if (s.status !== "authenticated") return { allowed: false, reason: "login" };
    if (s.profile?.[ACCESS_FIELD] === true) return { allowed: true, session: s };
    return { allowed: false, reason: "access", session: s };
  } catch (error) {
    console.error("[real-imtihonlar] ruxsatni tekshirib bo'lmadi:", error);
    return { allowed: false, reason: "error" };
  }
}
