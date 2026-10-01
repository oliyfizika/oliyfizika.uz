// Sessiya qatlami: Firebase Auth holati + users/{uid} profili.
// - Firebase modullari dinamik yuklanadi (xato bo'lsa sahifa buzilmaydi).
// - Profil bir sahifada faqat bir marta o'qiladi va barcha tinglovchilarga ulashiladi.
// - Mavjud js/firebase.js ishlatiladi — yangi Firebase ilova yaratilmaydi.

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const ROOT = new URL("../../../", import.meta.url);
const PROFILE_CACHE_KEY = "oliyfizika:profile-cache";

let firebasePromise = null;
let state = { status: "loading", user: null, profile: null, profileLoaded: false };
const listeners = new Set();

export function loadFirebase() {
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import(new URL("js/firebase.js", ROOT).href),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]).then(([app, authSdk, fsSdk]) => ({ auth: app.auth, db: app.db, authSdk, fsSdk }));
  }
  return firebasePromise;
}

function emit(next) {
  state = { ...state, ...next };
  listeners.forEach((fn) => {
    try { fn(state); } catch (error) { console.error("[session] listener xatosi:", error); }
  });
}

/** Holat o'zgarishini tinglash. Darhol joriy holat bilan chaqiriladi. */
export function onSession(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getSessionState() {
  return state;
}

/** Holat aniqlanguncha kutadi (loading tugaguncha). */
export function whenReady() {
  if (state.status !== "loading") return Promise.resolve(state);
  return new Promise((resolve) => {
    const off = onSession((s) => {
      if (s.status !== "loading") {
        queueMicrotask(() => off());
        resolve(s);
      }
    });
  });
}

function readCachedProfile(uid) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(PROFILE_CACHE_KEY) || "null");
    return cached && cached.uid === uid ? cached.profile : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(uid, profile) {
  try {
    // Faqat UI uchun zarur maydonlar keshlanadi (maxfiy ma'lumot yo'q).
    const safe = profile ? { fullName: profile.fullName || "", email: profile.email || "", xp: profile.xp ?? 0, level: profile.level ?? 1 } : null;
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, profile: safe }));
  } catch { /* ignore */ }
}

export function clearProfileCache() {
  try { sessionStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
}

async function fetchProfile(fb, uid) {
  const snap = await fb.fsSdk.getDoc(fb.fsSdk.doc(fb.db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/** Profilni qayta o'qish (masalan, ism o'zgartirilgandan keyin). */
export async function refreshProfile() {
  const fb = await loadFirebase();
  const user = fb.auth.currentUser;
  if (!user) return null;
  const profile = await fetchProfile(fb, user.uid);
  writeCachedProfile(user.uid, profile);
  emit({ profile, profileLoaded: true });
  if (isProfileComplete(profile)) startActivity();
  return profile;
}

export async function signOutUser() {
  const fb = await loadFirebase();
  stopActivity();
  clearProfileCache();
  await fb.authSdk.signOut(fb.auth);
}

/** Profil haqiqiy (ro'yxatdan o'tish yakunlangan) hujjatmi? Faqat lastActiveAt bo'lgan hujjat hisoblanmaydi. */
export function isProfileComplete(profile) {
  return Boolean(profile && (profile.fullName || profile.createdAt || typeof profile.xp === "number"));
}

// ---------------------------------------------------------------------------
// Foydalanuvchi faolligi (js/auth.js dan ko'chirildi — endi barcha sahifalarda ishlaydi)
// users/{uid}.lastActiveAt — kirishda, har 5 daqiqada va sahifaga qaytilganda yangilanadi.
// ---------------------------------------------------------------------------
const ACTIVITY_INTERVAL = 5 * 60 * 1000;
const ACTIVITY_MIN_GAP = 60 * 1000;
let activityTimer = null;
let lastActivityWrite = 0;

async function touchActivity(force = false) {
  const now = Date.now();
  if (!force && now - lastActivityWrite < ACTIVITY_MIN_GAP) return;
  const fb = await loadFirebase();
  const user = fb.auth.currentUser;
  if (!user || !isProfileComplete(state.profile)) return;
  lastActivityWrite = now;
  try {
    await fb.fsSdk.setDoc(fb.fsSdk.doc(fb.db, "users", user.uid), { lastActiveAt: fb.fsSdk.serverTimestamp() }, { merge: true });
  } catch (error) {
    console.warn("[session] faollikni yozib bo'lmadi:", error?.code || error);
  }
}

function onVisible() {
  if (document.visibilityState === "visible") touchActivity();
}

function startActivity() {
  if (activityTimer) return;
  touchActivity(true);
  activityTimer = setInterval(() => touchActivity(true), ACTIVITY_INTERVAL);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
}

function stopActivity() {
  clearInterval(activityTimer);
  activityTimer = null;
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("focus", onVisible);
}

export function displayName(s = state) {
  const name = s.profile?.fullName?.trim();
  if (name) return name;
  if (s.user?.displayName) return s.user.displayName;
  if (s.user?.email) return s.user.email.split("@")[0];
  return "Foydalanuvchi";
}

export function firstName(s = state) {
  return displayName(s).split(/\s+/)[0];
}

export function initials(s = state) {
  const parts = displayName(s).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "O";
}

// ---- Ishga tushirish ----
loadFirebase()
  .then((fb) => {
    fb.authSdk.onAuthStateChanged(fb.auth, async (user) => {
      if (!user) {
        stopActivity();
        clearProfileCache();
        emit({ status: "guest", user: null, profile: null, profileLoaded: false });
        return;
      }
      const cached = readCachedProfile(user.uid);
      emit({ status: "authenticated", user, profile: cached, profileLoaded: false });
      try {
        const profile = await fetchProfile(fb, user.uid);
        writeCachedProfile(user.uid, profile);
        emit({ profile, profileLoaded: true });
        if (isProfileComplete(profile)) startActivity();
      } catch (error) {
        console.error("[session] profilni o'qib bo'lmadi:", error);
      }
    });
  })
  .catch((error) => {
    console.error("[session] Firebase yuklanmadi:", error);
    emit({ status: "offline", user: null, profile: null, profileLoaded: false });
  });
