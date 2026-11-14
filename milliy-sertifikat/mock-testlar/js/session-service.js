// ==========================================================================
// Milliy sertifikat: yopiq (sessiyali) mock testlar — Firestore qatlami (foydalanuvchi tomoni).
//
// Model (xavfsizlik — firestore.rules, «Milliy sertifikat: yopiq (sessiyali) mock testlar» bo'limi):
//   • Barcha mocklar sukut bo'yicha YOPIQ. Test faqat ikki holatda ochiladi:
//       1) admin ochgan sessiya (msMockSessions/{id}): opensAt ≤ hozir < closesAt — rasmiy urinish, natija Rasch bo'yicha
//          admin «Yakunlash va natijani hisoblash» ni bosgandan keyin e'lon qilinadi;
//       2) erkin mashq (msMockSettings/config.practiceTests) — eski rejim: natija darhol, faqat statistika uchun.
//   • Rasmiy urinish: msMockAttempts/{sessionId}__{uid}. START — server vaqti; javoblar qoralama sifatida saqlanadi
//     (boshqa qurilmada davom ettirish va topshirilmay qolgan urinishni ham baholash uchun); SUBMIT — natijasiz.
//   • Avval yechilgan mashq natijalari (localStorage + mockTestAttempts) o'zgarmaydi va ko'rinib turadi.
// ==========================================================================

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
export const COL = Object.freeze({
  settings: "msMockSettings",
  sessions: "msMockSessions",
  attempts: "msMockAttempts",
  certificates: "msMockCertificates",
  profiles: "msMockProfiles",
});

let fbPromise = null;
export function fb() {
  if (!fbPromise) {
    fbPromise = Promise.all([import("../../../js/firebase.js"), import(SDK)])
      .then(([{ db, auth }, fs]) => ({ db, auth, fs }))
      .catch((e) => { fbPromise = null; throw e; });
  }
  return fbPromise;
}

const data = (snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null);
export const toMs = (v) => (v == null ? null : typeof v.toMillis === "function" ? v.toMillis() : v instanceof Date ? v.getTime() : typeof v === "number" ? v : null);
/** Toshkent vaqti (UTC+5): "20.11.2026, 09:00" (year=false — "20.11, 09:00"). */
export function fmtTashkent(ms, { year = true, time = true } = {}) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const d = new Date(ms + 5 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  const date = `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}${year ? `.${d.getUTCFullYear()}` : ""}`;
  return time ? `${date}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : date;
}
export const attemptDocId = (sessionId, uid) => `${sessionId}__${uid}`;

/** Sessiya holati (klient soati bo'yicha — faqat UI uchun; qaror Rules'da). */
export function sessionPhase(s, now = Date.now()) {
  if (!s) return "none";
  if (s.status === "finalized") return "finalized";
  const o = toMs(s.opensAt);
  const c = toMs(s.closesAt);
  if (o != null && now < o) return "upcoming";
  if (c != null && now >= c) return "closed";
  return "open";
}

export async function getSettings() {
  const { db, fs } = await fb();
  try {
    return data(await fs.getDoc(fs.doc(db, COL.settings, "config"))) || { practiceTests: [] };
  } catch (e) {
    console.warn("[ms] sozlamalar:", e?.code || e);
    return { practiceTests: [] };
  }
}

export async function listSessions() {
  const { db, fs } = await fb();
  const snap = await fs.getDocs(fs.collection(db, COL.sessions));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSession(sessionId) {
  const { db, fs } = await fb();
  return data(await fs.getDoc(fs.doc(db, COL.sessions, sessionId)));
}

/** Test uchun foydalanuvchiga tegishli sessiya: avval ochiq, keyin kelgusi, so'ng eng oxirgisi. */
export function pickSession(sessions, testId, now = Date.now()) {
  const list = sessions.filter((s) => s.testId === testId);
  const open = list.filter((s) => sessionPhase(s, now) === "open").sort((a, b) => toMs(a.closesAt) - toMs(b.closesAt));
  if (open.length) return open[0];
  const upcoming = list.filter((s) => sessionPhase(s, now) === "upcoming").sort((a, b) => toMs(a.opensAt) - toMs(b.opensAt));
  if (upcoming.length) return upcoming[0];
  return list.sort((a, b) => toMs(b.opensAt) - toMs(a.opensAt))[0] || null;
}

export async function getMyAttempt(sessionId, uid) {
  const { db, fs } = await fb();
  try {
    return data(await fs.getDoc(fs.doc(db, COL.attempts, attemptDocId(sessionId, uid))));
  } catch (e) {
    if (e?.code === "permission-denied") return null; // hujjat yo'q (Rules resource.data ni tekshira olmaydi)
    throw e;
  }
}

export async function listMyAttempts(uid) {
  const { db, fs } = await fb();
  const snap = await fs.getDocs(fs.query(fs.collection(db, COL.attempts), fs.where("uid", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Javoblarni Firestore uchun tozalash: { "0": "A", "35": { a: "8", b: "50" } } (faqat matn, ≤ 60 belgi). */
export function cleanAnswers(test, answers) {
  const out = {};
  test.questions.forEach((q, i) => {
    const a = answers?.[i];
    if (q.type === "mcq") {
      if (typeof a === "string" && /^[A-Z]$/.test(a)) out[String(i)] = a;
      return;
    }
    if (!a || typeof a !== "object") return;
    const parts = {};
    q.parts.forEach((p) => {
      const v = a[p.key];
      if (v != null && String(v).trim() !== "") parts[p.key] = String(v).slice(0, 60);
    });
    if (Object.keys(parts).length) out[String(i)] = parts;
  });
  return out;
}

/** Firestore'dagi javoblarni engine formatiga (indeks → javob). */
export function restoreAnswers(stored) {
  const out = {};
  Object.entries(stored || {}).forEach(([k, v]) => {
    if (/^\d+$/.test(k)) out[Number(k)] = v && typeof v === "object" ? { ...v } : v;
  });
  return out;
}

/** START: mavjud bo'lsa — qaytaradi. */
export async function startAttempt(session, user) {
  const { db, fs } = await fb();
  const ref = fs.doc(db, COL.attempts, attemptDocId(session.id, user.uid));
  const existing = await getMyAttempt(session.id, user.uid);
  if (existing) return existing;
  const doc = {
    uid: user.uid,
    name: String(user.name || "").slice(0, 200),
    sessionId: session.id,
    testId: session.testId,
    status: "in_progress",
    startedAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
    answers: {},
  };
  if (user.email) doc.email = user.email;
  await fs.setDoc(ref, doc);
  return data(await fs.getDoc(ref));
}

export async function saveDraft(sessionId, uid, answers, extra = {}) {
  const { db, fs } = await fb();
  await fs.updateDoc(fs.doc(db, COL.attempts, attemptDocId(sessionId, uid)), { answers, updatedAt: fs.serverTimestamp(), ...extra });
}

export async function submitAttempt(sessionId, uid, answers, { autoSubmitted = false, focusLoss = 0 } = {}) {
  const { db, fs } = await fb();
  await fs.updateDoc(fs.doc(db, COL.attempts, attemptDocId(sessionId, uid)), {
    answers,
    status: "submitted",
    submittedAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
    autoSubmitted: !!autoSubmitted,
    focusLoss: Math.max(0, Math.floor(focusLoss || 0)),
  });
}

// ------------------------------------------------------------------ sertifikat profili (rasm, otasining ismi)
export async function getProfile(uid) {
  const { db, fs } = await fb();
  try {
    return data(await fs.getDoc(fs.doc(db, COL.profiles, uid)));
  } catch (e) {
    if (e?.code === "permission-denied") return null;
    throw e;
  }
}

export async function saveProfile(uid, patch) {
  const { db, fs } = await fb();
  await fs.setDoc(fs.doc(db, COL.profiles, uid), { ...patch, updatedAt: fs.serverTimestamp() }, { merge: true });
}

export async function getCertificate(certNo) {
  const { db, fs } = await fb();
  try {
    return data(await fs.getDoc(fs.doc(db, COL.certificates, certNo)));
  } catch (e) {
    if (e?.code === "permission-denied") return null;
    throw e;
  }
}
