// ==========================================================================
// Real imtihonlar — FirestoreDataAdapter (production; FAQAT O'QISH).
//
// Model (docs/real-imtihonlar/01_architecture.md):
//   realExams/{examId}                    katalog yozuvi (metadata, provenance, holatlar soni)
//   realExams/{examId}/content/questions  savollar (manba matni, variantlar, figures havolalari)
//   realExams/{examId}/private/solutions  yechimlar va javoblar
//   Storage: real-exams/{examId}.pdf, real-exams/{examId}/figures/{figureId}.png
// Har bir so'rov Firestore/Storage Rules orqali users/{uid}.mockTestsAccess bilan tekshiriladi
// (frontend gate — faqat UX). getDownloadURL ishlatilmaydi: fayllar getBlob() -> Blob URL.
//
// config.FIRESTORE_ENABLED=false bo'lsa bu adapter hech qanday so'rov yubormaydi.
// Bu modul hech qachon YOZMAYDI.
// ==========================================================================
import { loadFirebase } from "../../../core/session.js";
import { FIRESTORE, STORAGE, FIRESTORE_ENABLED } from "../config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
let storagePromise = null;

function disabled() {
  return Object.assign(new Error("Real imtihonlar hali e’lon qilinmagan"), { code: "not-enabled" });
}

async function fs() {
  if (!FIRESTORE_ENABLED) throw disabled();
  return loadFirebase();
}

async function storage() {
  if (!FIRESTORE_ENABLED) throw disabled();
  if (!storagePromise) {
    storagePromise = Promise.all([loadFirebase(), import(`${SDK}/firebase-storage.js`)]).then(([, st]) => {
      const s = st.getStorage(); // mavjud js/firebase.js dagi default ilova (Attestatsiya api.js bilan bir xil)
      try { s.maxOperationRetryTime = 15000; } catch { /* eski SDK */ }
      return { st, s };
    });
  }
  return storagePromise;
}

const safeId = (id) => {
  if (!/^REAL-[0-9A-Za-z-]{4,40}$/.test(String(id || ""))) throw Object.assign(new Error("Noto‘g‘ri imtihon identifikatori"), { code: "not-found" });
  return id;
};

const objectUrls = new Map();

export const firestoreAdapter = {
  name: "firestore",
  async listExams() {
    const fb = await fs();
    const { collection, query, where, getDocs } = fb.fsSdk;
    const snap = await getDocs(query(collection(fb.db, FIRESTORE.collection), where("published", "==", true)));
    return snap.docs.map((d) => ({ examId: d.id, ...d.data() }));
  },
  async getExam(examId) {
    const fb = await fs();
    const snap = await fb.fsSdk.getDoc(fb.fsSdk.doc(fb.db, FIRESTORE.collection, safeId(examId)));
    if (!snap.exists()) throw Object.assign(new Error("Imtihon topilmadi"), { code: "not-found" });
    return { examId: snap.id, ...snap.data() };
  },
  async getQuestions(examId) {
    const fb = await fs();
    const snap = await fb.fsSdk.getDoc(fb.fsSdk.doc(fb.db, FIRESTORE.collection, safeId(examId), ...FIRESTORE.questionsDoc));
    if (!snap.exists()) throw Object.assign(new Error("Savollar topilmadi"), { code: "not-found" });
    return snap.data().questions || [];
  },
  async getSolutions(examId) {
    const fb = await fs();
    const snap = await fb.fsSdk.getDoc(fb.fsSdk.doc(fb.db, FIRESTORE.collection, safeId(examId), ...FIRESTORE.solutionsDoc));
    if (!snap.exists()) throw Object.assign(new Error("Yechimlar topilmadi"), { code: "not-found" });
    return snap.data().solutions || [];
  },
  async figureUrl(figure) {
    const path = figure.storagePath || STORAGE.figure(figure.examId, figure.figureId);
    if (objectUrls.has(path)) return objectUrls.get(path);
    const { st, s } = await storage();
    const blob = await st.getBlob(st.ref(s, path));
    const url = URL.createObjectURL(blob);
    objectUrls.set(path, url);
    return url;
  },
  async getPdfBlob(examId) {
    const { st, s } = await storage();
    return { blob: await st.getBlob(st.ref(s, STORAGE.pdf(safeId(examId)))), fixture: false };
  },
};
