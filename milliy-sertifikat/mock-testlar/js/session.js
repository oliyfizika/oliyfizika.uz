// Joriy foydalanuvchi sessiyasi (sayt Firebase Auth + Firestore profili).
// Ism saytda ro'yxatdan o'tishda kiritilgan `users/{uid}.fullName` maydonidan olinadi
// (js/auth.js dagi getDisplayName() bilan bir xil mantiq).

// js/auth.js dagi kalit bilan bir xil: kirgandan so'ng foydalanuvchi shu sahifaga qaytariladi.
const PENDING_DESTINATION_KEY = "oliyFizikaPendingDestination";

let cached = null;

/** { user, uid, name, email, profile } yoki user=null qaytaradi. */
export function getSession() {
  if (cached) return cached;
  cached = (async () => {
    const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }] = await Promise.all([
      import("../../../js/firebase.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    ]);
    const user = await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
    });
    if (!user) return { user: null };
    let profile = null;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      profile = snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error("Foydalanuvchi profilini o‘qib bo‘lmadi:", error);
    }
    const name = profile?.fullName?.trim() || user.displayName?.trim() || user.email || "Foydalanuvchi";
    return { user, uid: user.uid, name, email: user.email || null, profile };
  })().catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}

/** Kirish uchun bosh sahifaga yuborish; kirgandan so'ng auth.js foydalanuvchini shu sahifaga qaytaradi. */
export function goToLogin(destination = window.location.href) {
  try { sessionStorage.setItem(PENDING_DESTINATION_KEY, new URL(destination, window.location.href).href); } catch { /* ignore */ }
  window.location.href = new URL("../../../index.html", import.meta.url).href;
}
