import { auth, db } from "../firebase.js";

import {
  doc,
  getDoc,
  collection,
  runTransaction,
  serverTimestamp,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * XP chegaralari
 */
const LEVELS = [
  { level: 10, xp: 4000 },
  { level: 9, xp: 3000 },
  { level: 8, xp: 2300 },
  { level: 7, xp: 1700 },
  { level: 6, xp: 1200 },
  { level: 5, xp: 800 },
  { level: 4, xp: 500 },
  { level: 3, xp: 250 },
  { level: 2, xp: 100 },
  { level: 1, xp: 0 }
];

/**
 * Natijaga qarab XP hisoblash
 */
function calculateXP(percent) {

  if (percent === 100) return 20;

  if (percent >= 90) return 15;

  if (percent >= 80) return 10;

  return 0;

}

/**
 * XP ga qarab Level hisoblash
 */
function calculateLevel(xp) {

  for (const item of LEVELS) {

    if (xp >= item.xp) {

      return item.level;

    }

  }

  return 1;

}

/**
 * XP berish — Phase 19C: idempotent + atomik + audit.
 *
 * Mukofot identifikatori: users/{uid}/xpGrants/L{lessonId}
 *   (mavjud semantika saqlangan: mavzu uchun XP faqat BIRINCHI muvaffaqiyatli topshirishda beriladi;
 *    qayta topshirish yangi result yaratadi, lekin yangi XP bermaydi).
 * Grant hujjati natijaga (resultId) bog'lanadi va users.xp/level/lastXpGrant bilan BITTA tranzaksiyada yoziladi.
 * firestore.rules: grant o'zgarmas, ikkinchi marta yaratib bo'lmaydi; XP faqat shu grant bilan birga oshadi.
 * Parallel chaqiruvlar: tranzaksiya qayta o'qiydi va grant mavjudligini ko'radi; Rules ham ikkinchi yozuvni rad etadi.
 *
 * @returns {Promise<{status: "awarded"|"already-awarded"|"not-passed"|"no-result"|"no-profile"|"signed-out"|"error", xp?: number, newXp?: number, level?: number}>}
 */
export async function awardXP({

  lessonId,
  percent,
  resultId

}) {

  const user = auth.currentUser;

  if (!user) return { status: "signed-out" };

  // 80% dan past bo'lsa XP yo'q
  const xp = calculateXP(percent);
  if (xp === 0) return { status: "not-passed" };

  // XP aniq bir natijaga bog'lanadi (natija saqlanmagan bo'lsa — XP ham berilmaydi)
  if (!resultId) return { status: "no-result" };

  const userRef = doc(db, "users", user.uid);
  const grantRef = doc(db, "users", user.uid, "xpGrants", `L${lessonId}`);

  try {
    // Phase 19C'gacha (grant jurnalisiz) o'tilgan mavzular: avvalgidek qayta XP berilmaydi.
    const grantSnap = await getDoc(grantRef);
    if (grantSnap.exists()) return { status: "already-awarded" };
    const earlier = await getDocs(query(
      collection(db, "results"),
      where("uid", "==", user.uid),
      where("lessonId", "==", lessonId),
      where("passed", "==", true),
      limit(5)
    ));
    if (earlier.docs.some((d) => d.id !== resultId)) return { status: "already-awarded" };

    return await runTransaction(db, async (tx) => {
      const grant = await tx.get(grantRef);
      if (grant.exists()) return { status: "already-awarded" };

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) return { status: "no-profile" };

      const data = userSnap.data();
      const previousXp = typeof data.xp === "number" ? data.xp : 0;
      const newXp = previousXp + xp;
      const level = calculateLevel(newXp);

      tx.set(grantRef, {
        uid: user.uid,
        lessonId,
        resultId,
        percent,
        xp,
        previousXp,
        newXp,
        level,
        createdAt: serverTimestamp(),
      });
      tx.update(userRef, { xp: newXp, level, lastXpGrant: grantRef.id });

      return { status: "awarded", xp, newXp, level };
    });
  } catch (error) {
    // Rules rad etsa (masalan, parallel so'rov allaqachon yozgan) — XP o'zgarmaydi
    console.warn("[xp] XP berilmadi:", error?.code || error);
    return { status: "error" };
  }
}

// Daraja jadvali va formulasi boshqa sahifalarda (Mening natijalarim) qayta ishlatiladi —
// formula nusxalanmaydi.
export { LEVELS, calculateLevel };
