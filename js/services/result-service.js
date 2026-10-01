import { auth, db } from "../firebase.js";

import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
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
    console.warn("❌ Foydalanuvchi tizimga kirmagan.");
    return null;
  }

  try {
    // users kolleksiyasidan foydalanuvchi ma'lumotlarini olish
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let fullName = "";
    let phone = "";

    if (userSnap.exists()) {
      const data = userSnap.data();

      fullName = data.fullName || "";
      phone = data.phone || "";
    }

    // Natijani saqlash
    const ref = await addDoc(collection(db, "results"), {
      uid: user.uid,

      fullName,
      email: user.email || "",
      phone,

      lessonId,
      lessonTitle,
      course,

      score,
      totalQuestions,
      percent,

      passed,
      attempt,

      completedAt: serverTimestamp(),
    });

    console.log("✅ Natija muvaffaqiyatli saqlandi.");

    // Yangi natija: bildirishnomalar keshini yangilash (OliyFizika 2.0 header'i)
    try {
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith("oliyfizika:notif-cache:"))
        .forEach((key) => sessionStorage.removeItem(key));
    } catch (e) { /* storage mavjud emas */ }

    // Phase 19C: XP mukofoti shu natijaga bog'lanadi (xp-service.awardXP → resultId)
    return ref.id;
  } catch (error) {
    console.error("❌ Natijani saqlashda xatolik:", error);
    return null;
  }
}