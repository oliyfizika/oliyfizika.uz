// ==========================================================================
// Real imtihonlar — LocalDataAdapter (faqat lokal ishlab chiqish uchun).
// Ma'lumot: _private/real-imtihonlar/app-data/ (tools/real-imtihonlar/export_app_data.py yaratadi).
// Rasmlar: _private/real-imtihonlar/figures/. PDF: tools/real-imtihonlar/fixtures/ dagi DUMMY fixture
// (haqiqiy imtihon PDF lari lokal adapterda ham ishlatilmaydi).
// Interfeys firestore-adapter.js bilan bir xil — UI qaysi adapter ekanini bilmaydi.
// ==========================================================================

const ROOT = new URL("../../../../../", import.meta.url);
const PRIV = new URL("_private/real-imtihonlar/", ROOT);
const APP = new URL("app-data/", PRIV);
const PDF_FIXTURE = new URL("tools/real-imtihonlar/fixtures/local-fixture.pdf", ROOT);

const cache = new Map();

async function getJson(url) {
  const key = url.href;
  if (!cache.has(key)) {
    cache.set(key, fetch(url, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { code: res.status === 404 ? "not-found" : "unavailable" });
      return res.json();
    }));
  }
  try {
    return await cache.get(key);
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

const safeId = (id) => {
  if (!/^REAL-[0-9A-Za-z-]{4,40}$/.test(String(id || ""))) throw Object.assign(new Error("Noto‘g‘ri imtihon identifikatori"), { code: "not-found" });
  return id;
};

export const localAdapter = {
  name: "local",
  async listExams() {
    const cat = await getJson(new URL("catalog.json", APP));
    return (cat.exams || []).filter((e) => e.published !== false);
  },
  async getExam(examId) {
    const id = safeId(examId);
    const list = await this.listExams();
    const exam = list.find((e) => e.examId === id);
    if (!exam) throw Object.assign(new Error("Imtihon topilmadi"), { code: "not-found" });
    return exam;
  },
  async getQuestions(examId) {
    return (await getJson(new URL(`exams/${safeId(examId)}/questions.json`, APP))).questions;
  },
  async getSolutions(examId) {
    return (await getJson(new URL(`exams/${safeId(examId)}/solutions.json`, APP))).solutions;
  },
  /** Rasm uchun brauzer ishlata oladigan URL. */
  async figureUrl(figure) {
    return new URL(figure.localFile, PRIV).href;
  },
  /** PDF Blob (lokal: dummy fixture). */
  async getPdfBlob(examId) {
    safeId(examId);
    const res = await fetch(PDF_FIXTURE, { cache: "no-cache" });
    if (!res.ok) throw Object.assign(new Error("PDF fixture topilmadi"), { code: "not-found" });
    return { blob: await res.blob(), fixture: true };
  },
};
