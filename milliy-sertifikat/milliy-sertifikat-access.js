import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const link = document.querySelector("#mockTestsLink");
const message = document.querySelector("#mockTestsAccessMessage");
const telegramLink = document.querySelector("#telegramAccessLink");
onAuthStateChanged(auth, async (user) => { try { if (!user) { message.textContent = "Mock testlar uchun tizimga kiring va ruxsatga ega bo‘ling."; telegramLink.hidden = false; return; } const profile = await getDoc(doc(db, "users", user.uid)); if (profile.exists() && profile.data()?.mockTestsAccess === true) { link.hidden = false; message.remove(); return; } message.textContent = "Mock testlar faqat ruxsat berilgan foydalanuvchilar uchun ochiq."; telegramLink.hidden = false; } catch (error) { console.error("Mock testlar ruxsatini tekshirib bo‘lmadi:", error); message.textContent = "Ruxsatni tekshirib bo‘lmadi. Iltimos, keyinroq urinib ko‘ring."; } });
