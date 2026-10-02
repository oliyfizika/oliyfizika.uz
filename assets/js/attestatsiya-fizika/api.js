// ==========================================================================
// Attestatsiya → Fizika: Firestore / Storage qatlami.
// Barcha o'qish/yozish shu yerda — xavfsizlik Rules'da (firestore.rules, storage.rules), bu yerda emas.
//
// Yuklash tamoyillari (performance):
//  • 1027 savol hech qachon birdan yuklanmaydi — faqat ochilgan kunning snapshot hujjati (versions/v{N}).
//  • Kalit (keys) faqat SUBMIT'dan keyin, yechimlar (solutions) faqat solutionAvailableAt'dan keyin so'raladi.
//  • Real-time subscription yo'q: oddiy get/getDocs (32 ta kichik test meta hujjati).
//  • Rasmlar getBlob() (Storage) yoki figures/* (Firestore) orqali, faqat ko'rinadigan bo'lganda.
// ==========================================================================
import { loadFirebase } from "../core/session.js";
import { COL, SETTINGS_DOC, STORAGE_ROOT, attemptId, gradeAnswers, durationSeconds } from "./core.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
let storagePromise = null;

export async function fb() {
  return loadFirebase();
}

const snapData = (snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null);

// ------------------------------------------------------------------ settings / tests
let settingsCache = null;
export async function getSettings() {
  if (settingsCache) return settingsCache;
  const { db, fsSdk } = await fb();
  try {
    settingsCache = snapData(await fsSdk.getDoc(fsSdk.doc(db, COL.settings, SETTINGS_DOC))) || {};
  } catch (e) {
    console.warn("[att] settings:", e?.code || e);
    settingsCache = {};
  }
  return settingsCache;
}

/** Foydalanuvchi uchun: faqat published/archived (Rules filtrsiz so'rovni rad etadi). */
export async function listVisibleTests() {
  const { db, fsSdk } = await fb();
  const { collection, query, where, getDocs } = fsSdk;
  const snap = await getDocs(query(collection(db, COL.tests), where("published", "==", true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.dayNumber - b.dayNumber);
}

/** Admin: barcha kunlar (draft ham). */
export async function listAllTests() {
  const { db, fsSdk } = await fb();
  const snap = await fsSdk.getDocs(fsSdk.collection(db, COL.tests));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.dayNumber - b.dayNumber);
}

export async function getTest(testId) {
  const { db, fsSdk } = await fb();
  return snapData(await fsSdk.getDoc(fsSdk.doc(db, COL.tests, testId)));
}

export async function getTestByDay(day) {
  const tests = await listVisibleTests();
  return tests.find((t) => t.dayNumber === Number(day)) || null;
}

const vId = (n) => `v${n}`;

/** Javobsiz snapshot: savollar, variantlar, rasm ID'lari. */
export async function getSnapshot(testId, version) {
  const { db, fsSdk } = await fb();
  return snapData(await fsSdk.getDoc(fsSdk.doc(db, COL.tests, testId, "versions", vId(version))));
}

/** Kalit: faqat o'z urinishi topshirilgandan keyin (yoki yechim vaqtida) Rules ruxsat beradi. */
export async function getKey(testId, version) {
  const { db, fsSdk } = await fb();
  return snapData(await fsSdk.getDoc(fsSdk.doc(db, COL.tests, testId, "keys", vId(version))));
}

/** To'liq yechimlar: faqat request.time >= solutionAvailableAt. */
export async function getSolutions(testId, version) {
  const { db, fsSdk } = await fb();
  return snapData(await fsSdk.getDoc(fsSdk.doc(db, COL.tests, testId, "solutions", vId(version))));
}

// ------------------------------------------------------------------ attempts
export async function getMyAttempt(uid, testId) {
  const { db, fsSdk } = await fb();
  return snapData(await fsSdk.getDoc(fsSdk.doc(db, COL.attempts, attemptId(uid, testId))));
}

export async function listMyAttempts(uid) {
  const { db, fsSdk } = await fb();
  const { collection, query, where, getDocs } = fsSdk;
  const snap = await getDocs(query(collection(db, COL.attempts), where("userId", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.dayNumber - b.dayNumber);
}

/** START — server vaqti (startedAt). Mavjud bo'lsa — qaytaradi (bitta rasmiy urinish). */
export async function startAttempt(uid, test) {
  const { db, fsSdk } = await fb();
  const ref = fsSdk.doc(db, COL.attempts, attemptId(uid, test.id));
  const existing = await fsSdk.getDoc(ref);
  if (existing.exists()) return { id: existing.id, ...existing.data() };
  await fsSdk.setDoc(ref, {
    userId: uid,
    testId: test.id,
    dayNumber: test.dayNumber,
    testVersion: test.currentVersion,
    attemptNumber: 1,
    kind: "official",
    status: "in_progress",
    startedAt: fsSdk.serverTimestamp(),
    questionCount: test.questionCount,
  });
  return snapData(await fsSdk.getDoc(ref));
}

/** Qoralama saqlash (boshqa qurilmada davom etish uchun). */
export async function saveDraft(uid, testId, answers) {
  const { db, fsSdk } = await fb();
  await fsSdk.updateDoc(fsSdk.doc(db, COL.attempts, attemptId(uid, testId)), {
    answers: { ...answers },
    savedAt: fsSdk.serverTimestamp(),
  });
}

/** SUBMIT — javoblar qulflanadi. Natija maydonlari bu yerda YOZILMAYDI (Rules taqiqlaydi). */
export async function submitAttempt(uid, testId, answers) {
  const { db, fsSdk } = await fb();
  const ref = fsSdk.doc(db, COL.attempts, attemptId(uid, testId));
  await fsSdk.updateDoc(ref, { status: "submitted", completedAt: fsSdk.serverTimestamp(), answers: { ...answers } });
  return snapData(await fsSdk.getDoc(ref));
}

/**
 * GRADE — kalit o'qiladi, natija hisoblanadi va yoziladi. Rules har bir qiymatni kalit bilan
 * solishtiradi (soxta qiymat rad etiladi). Qaytaradi: { attempt, key }.
 */
export async function gradeAttempt(attempt) {
  const { db, fsSdk } = await fb();
  const key = await getKey(attempt.testId, attempt.testVersion);
  if (!key) throw new Error("Javob kalitini o‘qib bo‘lmadi.");
  if (attempt.status === "graded") return { attempt, key };
  const g = gradeAnswers(attempt.answers || {}, key, attempt.questionCount);
  const ref = fsSdk.doc(db, COL.attempts, attempt.id);
  await fsSdk.updateDoc(ref, {
    status: "graded",
    gradedAt: fsSdk.serverTimestamp(),
    timeSpentSeconds: durationSeconds(attempt.startedAt, attempt.completedAt),
    ...g,
  });
  return { attempt: snapData(await fsSdk.getDoc(ref)), key };
}

// ------------------------------------------------------------------ admin
export async function publishTest(test, solutionAvailableAt) {
  const { db, fsSdk, auth } = await fb();
  await fsSdk.updateDoc(fsSdk.doc(db, COL.tests, test.id), {
    status: "published",
    published: true,
    publishedAt: fsSdk.serverTimestamp(),
    publishedBy: auth.currentUser.uid,
    solutionAvailableAt: fsSdk.Timestamp.fromDate(solutionAvailableAt),
  });
}

export async function archiveTest(test) {
  const { db, fsSdk } = await fb();
  await fsSdk.updateDoc(fsSdk.doc(db, COL.tests, test.id), { status: "archived", archivedAt: fsSdk.serverTimestamp() });
}

export async function listAttemptsForTest(testId) {
  const { db, fsSdk } = await fb();
  const { collection, query, where, getDocs } = fsSdk;
  const snap = await getDocs(query(collection(db, COL.attempts), where("testId", "==", testId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ------------------------------------------------------------------ rasmlar
async function storage() {
  if (!storagePromise) {
    storagePromise = Promise.all([fb(), import(`${SDK}/firebase-storage.js`)]).then(([, st]) => ({ st, storage: st.getStorage() }));
  }
  return storagePromise;
}

const blobCache = new Map();

/**
 * Rasm (Blob URL). scope: "question" | "solution".
 * Storage: getBlob() — har bir so'rov storage.rules dan o'tadi; doimiy ommaviy token-URL ishlatilmaydi.
 * Firestore muqobili: attestationPhysicsDailyTests/{t}/figures|solutionFigures/{id} (base64).
 */
export async function figureUrl(testId, figId, scope = "question") {
  const cacheKey = `${scope}:${testId}:${figId}`;
  if (blobCache.has(cacheKey)) return blobCache.get(cacheKey);
  const p = (async () => {
    const settings = await getSettings();
    let blob;
    if (settings.figureBackend === "firestore") {
      const { db, fsSdk } = await fb();
      const col = scope === "solution" ? "solutionFigures" : "figures";
      const snap = await fsSdk.getDoc(fsSdk.doc(db, COL.tests, testId, col, figId));
      if (!snap.exists()) throw new Error("not-found");
      const d = snap.data();
      const bin = atob(d.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: d.mime });
    } else {
      const { st, storage: s } = await storage();
      const folder = scope === "solution" ? "solutions" : "questions";
      blob = await st.getBlob(st.ref(s, `${settings.storageRoot || STORAGE_ROOT}/${folder}/${testId}/${figId}`));
    }
    return URL.createObjectURL(blob);
  })();
  blobCache.set(cacheKey, p);
  p.catch(() => blobCache.delete(cacheKey));
  return p;
}

export async function uploadFigure(path, file, contentType) {
  const { st, storage: s } = await storage();
  const r = st.ref(s, path);
  try {
    await st.getMetadata(r);
    return "exists";
  } catch { /* yo'q — yuklaymiz */ }
  await st.uploadBytes(r, file, { contentType, cacheControl: "private, max-age=86400" });
  return "uploaded";
}
