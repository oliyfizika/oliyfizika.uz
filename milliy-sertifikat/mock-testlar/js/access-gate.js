// Ruxsat tekshiruvi: test yechish uchun saytga kirgan bo'lish shart (ism profildan olinadi).
// config.js -> REQUIRE_MOCK_ACCESS=true bo'lsa, qo'shimcha ravishda Firestore
// users/{uid}.mockTestsAccess === true ham tekshiriladi (video/PDF tizimidagi bilan bir xil).
import { REQUIRE_MOCK_ACCESS } from "./config.js";
import { getSession } from "./session.js";

export async function checkMockAccess() {
  try {
    const session = await getSession();
    if (!session.user) return { allowed: false, reason: "login" };
    if (REQUIRE_MOCK_ACCESS && session.profile?.mockTestsAccess !== true) return { allowed: false, reason: "access", session };
    return { allowed: true, session };
  } catch (error) {
    console.error("Mock test ruxsatini tekshirib bo‘lmadi:", error);
    return { allowed: false, reason: "error" };
  }
}
