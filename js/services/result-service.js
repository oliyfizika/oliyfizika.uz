import { auth, db } from "../firebase.js";

import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Test natijasini Firestore'ga saqlaydi
 */

export async function saveResult({
  lessonId,
  lessonTitle,
  course,
  score,
  totalQuestions,
  percent,
  passed,
  attempt = 1,
}) {

  const user = auth.currentUser;

  if (!user) {
    console.warn("Foydalanuvchi tizimga kirmagan.");
    return;
  }

  try {

    await addDoc(collection(db, "results"), {

      uid: user.uid,

      lessonId,
      lessonTitle,
      course,

      score,
      totalQuestions,
      percent,

      passed,

      attempt,

      completedAt: serverTimestamp()

    });

    console.log("✅ Natija saqlandi");

  } catch (error) {

    console.error("❌ Natijani saqlashda xatolik:", error);

  }

}