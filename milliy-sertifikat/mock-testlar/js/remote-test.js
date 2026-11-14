// ==========================================================================
// Admin import qilgan mock testlar (Firestore: msMockTests) — engine formatiga yig'ish.
//   msMockTests/{id}                   — meta (hamma o'qiydi)
//   msMockTests/{id}/content/questions — savollar javobsiz (sessiya oynasida yoki natija e'lon qilingach)
//   msMockTests/{id}/content/key       — kalit (admin; natija e'lon qilingach ishtirokchilar)
//   msMockTests/{id}/content/solutions — yozma yechimlar (kalit bilan bir xil qoida)
//   msMockTests/{id}/figures/{figId}   — rasmlar (data URL); savolda "fig:<figId>"
// Repodagi data/mock-test-N.json bilan bir xil id bo'lsa — Firestore'dagi ustun (import qilingan versiya).
// ==========================================================================
import { fb } from "./session-service.js";

const DEFAULT_FORMULA = { pages: ["assets/formulas/formula-sheet-1.png", "assets/formulas/formula-sheet-2.png"] };
const denied = (e) => e?.code === "permission-denied";

export async function listImportedTests() {
  const { db, fs } = await fb();
  try {
    const snap = await fs.getDocs(fs.collection(db, "msMockTests"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("[ms] import qilingan testlar:", e?.code || e);
    return [];
  }
}

export async function getImportedMeta(id) {
  const { db, fs } = await fb();
  try {
    const s = await fs.getDoc(fs.doc(db, "msMockTests", id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch (e) {
    console.warn("[ms] test meta:", e?.code || e);
    return null;
  }
}

/** Kalitni savollarga qo'shish (engine/gradeLocal formati). */
export function mergeKey(questions, answers) {
  return questions.map((q, i) => {
    const k = answers?.[String(i)];
    if (q.type === "mcq") return k ? { ...q, answer: k } : { ...q };
    return { ...q, parts: q.parts.map((p) => ({ ...p, ...(k?.[p.key] || {}) })) };
  });
}

async function attachFigures(db, fs, id, questions) {
  const ids = new Set();
  const scan = (v) => { if (typeof v === "string" && v.startsWith("fig:")) ids.add(v.slice(4)); };
  questions.forEach((q) => { scan(q.image); (q.options || []).forEach((o) => scan(o?.image)); });
  const map = new Map();
  await Promise.all([...ids].map(async (fid) => {
    try {
      const s = await fs.getDoc(fs.doc(db, "msMockTests", id, "figures", fid));
      if (s.exists()) map.set(fid, s.data().data);
    } catch (e) { console.warn("[ms] rasm:", fid, e?.code || e); }
  }));
  const res = (v) => (typeof v === "string" && v.startsWith("fig:") ? map.get(v.slice(4)) || null : v);
  return questions.map((q) => ({
    ...q,
    ...(q.image ? { image: res(q.image) } : {}),
    ...(q.options ? { options: q.options.map((o) => (o && typeof o === "object" && o.image ? { ...o, image: res(o.image) } : o)) } : {}),
  }));
}

/**
 * Import qilingan testni yuklash. Savollar yopiq bo'lsa — { locked: true, ...meta }.
 * @param {{figures?: boolean}} opts — admin hisobida rasmlar kerak emas
 */
export async function loadImportedTest(meta, { figures = true } = {}) {
  const { db, fs } = await fb();
  const id = meta.id;
  const base = {
    schemaVersion: 1, id, number: meta.number, title: meta.title, subtitle: meta.subtitle || "", sourceVariant: meta.sourceVariant || null,
    durationMinutes: meta.durationMinutes || 180, imported: true, meta,
    resultCode: { prefix: `OFMT${meta.number}`, version: 2 },
  };
  let qdoc;
  try {
    const s = await fs.getDoc(fs.doc(db, "msMockTests", id, "content", "questions"));
    if (!s.exists()) return { ...base, locked: true, questions: null };
    qdoc = s.data();
  } catch (e) {
    if (denied(e)) return { ...base, locked: true, questions: null };
    throw e;
  }
  let questions = qdoc.questions || [];
  let keyed = false;
  let solutionsData = null;
  try {
    const k = await fs.getDoc(fs.doc(db, "msMockTests", id, "content", "key"));
    if (k.exists()) { questions = mergeKey(questions, k.data().answers); keyed = true; }
  } catch (e) { if (!denied(e)) console.warn("[ms] kalit:", e?.code || e); }
  if (keyed) {
    try {
      const s = await fs.getDoc(fs.doc(db, "msMockTests", id, "content", "solutions"));
      solutionsData = s.exists() ? s.data() : null;
    } catch (e) { if (!denied(e)) console.warn("[ms] yechimlar:", e?.code || e); }
  }
  if (figures) questions = await attachFigures(db, fs, id, questions);
  return {
    ...base, locked: false, keyed, questions,
    scoring: qdoc.scoring || { defaultRelativeTolerance: 1e-6 },
    review: { enabled: true, showCorrectAnswers: keyed },
    formulaSheet: qdoc.formulaSheet || DEFAULT_FORMULA,
    solutionsData,
  };
}
