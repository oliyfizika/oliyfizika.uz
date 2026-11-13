// Mehmonlar (tizimga kirmagan tashrifchilar) uchun yengil «online» belgisi.
// Admin dashboard'dagi «Hozir online» kartasi uchun: presence/{id} hujjatiga
// faqat sahifa KO'RINIB turganda, eng ko'pi bilan har 5 daqiqada bir marta yoziladi.
//
// - id brauzer bo'yicha (localStorage): bir mehmonning bir nechta tabi bitta deb sanaladi.
// - Hujjatda shaxsiy ma'lumot yo'q: faqat server vaqti (at) va TTL uchun muddat (expireAt).
// - Tizimga kirgan foydalanuvchilar bu yerga yozilmaydi — ular users/{uid}.lastActiveAt orqali
//   sanaladi (core/session.js, qo'shimcha yozuvsiz).
// - Qoidalar: firestore.rules → match /presence/{sid}.

export const PRESENCE_INTERVAL = 5 * 60 * 1000;
const MIN_GAP = 60 * 1000;
const TTL_MS = 60 * 60 * 1000; // expireAt: Firestore TTL siyosati yoqilsa, eski hujjatlar o'zi o'chadi
const ID_KEY = "oliyfizika:presence-id";

let fbRef = null;
let timer = null;
let lastWrite = 0;

function presenceId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id || !/^g_[A-Za-z0-9]{20,40}$/.test(id)) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      id = "g_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return null; // localStorage yopiq (maxfiy rejim va h.k.) — sanalmaydi, sahifa buzilmaydi
  }
}

async function touch() {
  if (!fbRef || document.visibilityState !== "visible") return;
  const now = Date.now();
  if (now - lastWrite < MIN_GAP) return;
  const id = presenceId();
  if (!id) return;
  lastWrite = now;
  const { doc, setDoc, serverTimestamp, Timestamp } = fbRef.fsSdk;
  try {
    await setDoc(doc(fbRef.db, "presence", id), {
      at: serverTimestamp(),
      expireAt: Timestamp.fromMillis(now + TTL_MS),
    });
  } catch (error) {
    console.warn("[presence] yozib bo'lmadi:", error?.code || error);
  }
}

function onVisible() {
  if (document.visibilityState === "visible") touch();
}

/** Mehmon holatida chaqiriladi (core/session.js). */
export function startGuestPresence(fb) {
  fbRef = fb;
  if (timer) return;
  touch();
  timer = setInterval(touch, PRESENCE_INTERVAL);
  document.addEventListener("visibilitychange", onVisible);
}

/** Foydalanuvchi tizimga kirganda to'xtatiladi. */
export function stopGuestPresence() {
  clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
}
