import { auth, db } from "../firebase.js";

import {
  doc,
  getDoc,
  updateDoc,
  collection,
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
 * XP berish
 */
export async function awardXP({

  lessonId,
  percent

}) {

  const user = auth.currentUser;

  if (!user) return;

  // 80% dan past bo'lsa XP yo'q
  if (percent < 80) return;

  // Shu mavzu uchun oldin o'tganmi?
  const q = query(
    collection(db, "results"),
    where("uid", "==", user.uid),
    where("lessonId", "==", lessonId),
    where("passed", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  // Oldin o'tgan bo'lsa XP bermaymiz
  if (!snapshot.empty) {

    console.log("XP oldin berilgan.");

    return;

  }

  const xp = calculateXP(percent);

  if (xp === 0) return;

  const userRef = doc(db, "users", user.uid);

  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return;

  const data = userSnap.data();

  const currentXP = data.xp || 0;

  const newXP = currentXP + xp;

  const newLevel = calculateLevel(newXP);

  await updateDoc(userRef, {

    xp: newXP,

    level: newLevel

  });

  console.log(`+${xp} XP berildi.`);
}