// ==========================================================================
// Sertifikat xizmati — Firestore bilan ishlash (rules: firestore.rules → "Sertifikatlar").
//
//   users/{uid}/courseProgress/{courseId}   o'tilgan mavzular jamlanmasi (har yozuv — haqiqiy `results` hujjatiga bog'langan)
//   users/{uid}/certificateIndex/{courseId} bir kurs — bir sertifikat (sertifikat bilan atomik yoziladi)
//   certificates/{raqam}                    o'zgarmas sertifikat; raqam tasodifiy (OF-MEX-XXXX-XXXX-XXXX)
//
// Barcha nomzodlik tekshiruvlari Firestore rules ichida — bu fayl faqat to'g'ri ma'lumotni yozadi va o'qiydi.
// ==========================================================================

import { loadFirebase } from "../core/session.js";
import {
  CERT_SECTIONS, CERT_FULL, MIN_SECONDS_PER_LESSON, sectionOfLesson, sectionById, titleOf, codeOf,
} from "../../../umumiy-fizika/data/certificates.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 belgi; I va O yo'q (rules: [A-HJ-NP-Z2-9])
export const NUMBER_RE = /^OF-(MEX|MOL|ELE|OPT|UMU)-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** Kriptografik tasodifiy raqam (rejection sampling kerak emas: 256 % 32 == 0). */
export function newCertNumber(courseId) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31]);
  const g = (i) => chars.slice(i, i + 4).join("");
  return `OF-${codeOf(courseId)}-${g(0)}-${g(4)}-${g(8)}`;
}

async function fb() {
  const { auth, db, fsSdk } = await loadFirebase();
  return { auth, db, ...fsSdk };
}

function currentUid(auth) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Object.assign(new Error("Tizimga kirmagansiz"), { code: "unauthenticated" });
  return uid;
}

// ------------------------------------------------------------ Jamlanma (courseProgress)
export async function getProgress(courseId) {
  const { auth, db, doc, getDoc } = await fb();
  const snap = await getDoc(doc(db, "users", currentUid(auth), "courseProgress", courseId));
  return snap.exists() ? snap.data() : null;
}

/** Bitta mavzuni jamlanmaga qo'shadi/yaxshilaydi (tranzaksiya; rules natijani qayta tekshiradi). */
async function addEntry(courseId, lessonId, { resultId, percent, completedAt }) {
  const { auth, db, doc, runTransaction, serverTimestamp } = await fb();
  const ref = doc(db, "users", currentUid(auth), "courseProgress", courseId);
  const key = String(lessonId);
  const entry = { p: percent, r: resultId, t: completedAt };
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, {
        courseId, lessons: { [key]: entry }, lastLesson: key, count: 1, sum: percent,
        firstAt: completedAt, lastAt: completedAt, updatedAt: serverTimestamp(),
      });
      return "added";
    }
    const d = snap.data();
    const old = d.lessons?.[key];
    if (old) {
      if (!(percent > old.p && completedAt.toMillis() > old.t.toMillis())) return "same";
      tx.update(ref, { [`lessons.${key}`]: entry, lastLesson: key, sum: d.sum + percent - old.p, updatedAt: serverTimestamp() });
      return "improved";
    }
    tx.update(ref, {
      [`lessons.${key}`]: entry, lastLesson: key, count: d.count + 1, sum: d.sum + percent,
      firstAt: completedAt.toMillis() < d.firstAt.toMillis() ? completedAt : d.firstAt,
      lastAt: completedAt.toMillis() > d.lastAt.toMillis() ? completedAt : d.lastAt,
      updatedAt: serverTimestamp(),
    });
    return "added";
  });
}

/** Test muvaffaqiyatli topshirilgandan keyin chaqiriladi (jim, xato bo'lsa sahifani buzmaydi). */
export async function recordPass({ lessonId, resultId, percent }) {
  try {
    const section = sectionOfLesson(lessonId);
    if (!section || !resultId || !(percent >= 80)) return null;
    const { db, doc, getDoc } = await fb();
    const snap = await getDoc(doc(db, "results", resultId));
    const completedAt = snap.exists() ? snap.data().completedAt : null;
    if (!completedAt?.toMillis) return null;
    return await addEntry(section.id, lessonId, { resultId, percent, completedAt });
  } catch (error) {
    console.warn("[sertifikat] jamlanma yangilanmadi:", error?.code || error);
    return null;
  }
}

/**
 * Avvalgi (jamlanma joriy qilinishidan oldingi) natijalarni jamlanmaga o'tkazadi.
 * Har mavzu uchun eng yaxshi o'tgan natija olinadi. Faqat yetishmayotganlari yoziladi.
 * @returns {Promise<{added:number, failed:number}>}
 */
export async function syncProgress({ onStep } = {}) {
  const { auth, db, collection, query, where, getDocs } = await fb();
  const uid = currentUid(auth);
  const snap = await getDocs(query(collection(db, "results"), where("uid", "==", uid), where("passed", "==", true)));

  const best = new Map(); // "courseId:lesson" -> eng yaxshi natija
  snap.docs.forEach((d) => {
    const r = d.data();
    const lesson = Number(r.lessonId);
    const section = sectionOfLesson(lesson);
    if (!section || !Number.isInteger(lesson) || !r.completedAt?.toMillis || !Number.isInteger(r.percent)) return;
    if ((r.course ?? "mechanics") !== "mechanics") return;
    const key = `${section.id}:${lesson}`;
    const cur = best.get(key);
    const better = !cur || r.percent > cur.percent || (r.percent === cur.percent && r.completedAt.toMillis() < cur.completedAt.toMillis());
    if (better) best.set(key, { courseId: section.id, lesson, resultId: d.id, percent: r.percent, completedAt: r.completedAt });
  });

  const progress = {};
  await Promise.all(CERT_SECTIONS.map(async (s) => { progress[s.id] = await getProgress(s.id); }));

  const todo = [...best.values()]
    .filter((b) => {
      const old = progress[b.courseId]?.lessons?.[String(b.lesson)];
      return !old || (b.percent > old.p && b.completedAt.toMillis() > old.t.toMillis());
    })
    .sort((a, b) => a.completedAt.toMillis() - b.completedAt.toMillis());

  let added = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i++) {
    const b = todo[i];
    try {
      await addEntry(b.courseId, b.lesson, b);
      added++;
    } catch (error) {
      failed++;
      console.warn("[sertifikat] mavzu qo'shilmadi:", b.lesson, error?.code || error);
    }
    onStep?.(i + 1, todo.length);
  }
  return { added, failed };
}

// ------------------------------------------------------------ Holat (UI uchun)
/** Bo'lim holati: jamlanma + sertifikat indeksidan. */
export function sectionStatus(section, progress) {
  const required = section.lessons.length;
  const count = Math.min(progress?.count || 0, required);
  const spanMs = progress ? progress.lastAt.toMillis() - progress.firstAt.toMillis() : 0;
  const minMs = required * MIN_SECONDS_PER_LESSON * 1000;
  const complete = (progress?.count || 0) >= required;
  return {
    id: section.id, title: section.title, required, count, complete,
    percent: Math.round((count / required) * 100),
    avg: progress && progress.count ? progress.sum / progress.count : null,
    tooFast: complete && spanMs < minMs,
    missing: section.lessons.filter((n) => !progress?.lessons?.[String(n)]),
  };
}

// ------------------------------------------------------------ Sertifikatlar
export async function getIndexes() {
  const { auth, db, collection, getDocs } = await fb();
  const snap = await getDocs(collection(db, "users", currentUid(auth), "certificateIndex"));
  const out = {};
  snap.docs.forEach((d) => { out[d.id] = d.data(); });
  return out;
}

/** Ommaviy tekshirish: faqat aniq raqam bo'yicha. null — topilmadi. */
export async function getCertificate(number) {
  const id = String(number || "").trim().toUpperCase();
  if (!NUMBER_RE.test(id)) return null;
  const { db, doc, getDoc } = await fb();
  const snap = await getDoc(doc(db, "certificates", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listMyCertificates() {
  const { auth, db, collection, query, where, getDocs } = await fb();
  const snap = await getDocs(query(collection(db, "certificates"), where("uid", "==", currentUid(auth))));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.issuedAt?.toMillis?.() || 0) - (a.issuedAt?.toMillis?.() || 0));
}

/** Profildagi ism (rules: fullName yoki firstName + " " + lastName bilan bir xil bo'lishi shart). */
export function profileFullName(profile) {
  const full = String(profile?.fullName || "");
  if (full.trim().includes(" ") && full.trim().length >= 5) return full;
  const joined = `${profile?.firstName || ""} ${profile?.lastName || ""}`;
  if (profile?.firstName && profile?.lastName && joined.length >= 5) return joined;
  return "";
}

/**
 * Sertifikat beradi (bo'lim yoki to'liq kurs). Mavjud bo'lsa — shuni qaytaradi.
 * Rules nomzodlikni qayta tekshiradi; shartlar bajarilmasa yozuv rad etiladi.
 */
export async function issueCertificate(courseId, profile) {
  const { auth, db, doc, getDoc, writeBatch, serverTimestamp } = await fb();
  const uid = currentUid(auth);
  const isFull = courseId === CERT_FULL.id;

  const indexRef = doc(db, "users", uid, "certificateIndex", courseId);
  const existing = await getDoc(indexRef);
  if (existing.exists()) {
    const cert = await getCertificate(existing.data().certId);
    if (cert) return { cert, created: false };
  }

  const fullName = profileFullName(profile);
  if (!fullName) throw Object.assign(new Error("Profilda ism va familiya to'liq emas"), { code: "profile-name" });

  let lessonCount = 0;
  let sumPercent = 0;
  if (isFull) {
    for (const id of CERT_FULL.sections) {
      const snap = await getDoc(doc(db, "users", uid, "certificateIndex", id));
      if (!snap.exists()) throw Object.assign(new Error("Avval barcha bo'lim sertifikatlarini oling"), { code: "sections-missing" });
      lessonCount += snap.data().count;
      sumPercent += snap.data().sum;
    }
  } else {
    const progress = await getProgress(courseId);
    const section = sectionById(courseId);
    if (!section || !progress || progress.count < section.lessons.length) {
      throw Object.assign(new Error("Bo'lim hali yakunlanmagan"), { code: "incomplete" });
    }
    lessonCount = progress.count;
    sumPercent = progress.sum;
  }
  const avgX10 = Math.round((sumPercent * 10) / lessonCount);

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = newCertNumber(courseId);
    const batch = writeBatch(db);
    batch.set(doc(db, "certificates", number), {
      uid, number, kind: isFull ? "full" : "section", courseId, courseTitle: titleOf(courseId),
      fullName, lessonCount, sumPercent, avgX10, issuedAt: serverTimestamp(), revoked: false, v: 1,
    });
    batch.set(indexRef, { certId: number, courseId, count: lessonCount, sum: sumPercent, createdAt: serverTimestamp() });
    try {
      await batch.commit();
      const cert = await getCertificate(number);
      return { cert, created: true };
    } catch (error) {
      lastError = error; // raqam to'qnashuvi juda kam; rules rad etsa (shart bajarilmagan) ham shu yerga tushadi
      if (error?.code !== "permission-denied") break;
    }
  }
  throw lastError || new Error("Sertifikat berilmadi");
}

export { titleOf };
