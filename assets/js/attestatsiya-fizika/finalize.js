// ==========================================================================
// Attestatsiya → Fizika: yakunlanmagan rasmiy urinishni yechim ochilish vaqtida AVTOMATIK yakunlash (lazy).
//
// Backend/scheduler yo'q (statik sayt + Firestore Rules), shuning uchun yakunlash ma'lumot o'qilganda bajariladi:
//   • egasi qaytganda (dashboard, test, natijalar, yechimlar sahifasi);
//   • admin «Attestatsiya — Fizika» sahifasini ochganda (barcha muddati o'tgan in_progress urinishlar).
// Qaror Rules'da (attValidAutoSubmit): request.time (SERVER vaqti) >= solutionAvailableAt — yechim ochilishi bilan
// BIR XIL chegara. Klient soati faqat «urinib ko'rish kerakmi» degan ishora; erta urinish Rules tomonidan rad etiladi.
//
// Qadamlar (ikkalasi ham idempotent, Rules o.status bo'yicha ketma-ketlikni kafolatlaydi):
//   1) in_progress → submitted: javoblar o'zgarmaydi (yo'q bo'lsa {}), completedAt = solutionAvailableAt
//      (sarflangan vaqt shu chegara bilan cheklanadi), autoFinalized = true;
//   2) submitted → graded: mavjud gradeAttempt() (gradeAnswers — Rules bilan bir xil algoritm, urinish versiyasining kaliti).
// Poyga: qo'lda SUBMIT faqat request.time < solutionAvailableAt, avtomatik — faqat >= : ikkalasi bir vaqtda o'tolmaydi.
// ==========================================================================
import { fb, gradeAttempt } from "./api.js";
import { COL } from "./core.js";
import { isOverdue, autoSubmitPatch } from "./finalize-core.js";

export { isOverdue };

async function reread(id) {
  const { db, fsSdk } = await fb();
  const s = await fsSdk.getDoc(fsSdk.doc(db, COL.attempts, id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/**
 * Muddati o'tgan in_progress urinishni yakunlaydi va baholaydi. Boshqa holatlarda urinishni o'zgarishsiz qaytaradi.
 * @returns {Promise<{attempt: object, key: object|null, finalized: boolean}>}
 */
export async function finalizeIfOverdue(attempt, test, now = Date.now(), { serverDecides = false } = {}) {
  if (!attempt || (attempt.status !== "in_progress" && attempt.status !== "submitted")) return { attempt, key: null, finalized: false };
  let a = attempt;
  let finalized = false;
  if (a.status === "in_progress") {
    // serverDecides: qo'lda SUBMIT Rules tomonidan rad etilgan (server vaqti S dan o'tgan bo'lishi mumkin) — klient soatiga
    // qaramasdan urinib ko'riladi; erta bo'lsa Rules rad etadi va urinish o'zgarmaydi.
    if (!isOverdue(a, test, serverDecides ? Number.MAX_SAFE_INTEGER : now)) return { attempt: a, key: null, finalized: false };
    const { db, fsSdk } = await fb();
    try {
      await fsSdk.updateDoc(fsSdk.doc(db, COL.attempts, a.id), autoSubmitPatch(a, test));   // completedAt: Firestore Timestamp
      finalized = true;
    } catch (err) {
      if (err?.code !== "permission-denied") throw err;
      // Boshqa jarayon (qo'lda submit / admin / boshqa qurilma) allaqachon yakunlagan — yoki server vaqti hali yetmagan
    }
    a = (await reread(a.id)) || a;
    if (a.status === "in_progress") return { attempt: a, key: null, finalized: false };
  }
  if (a.status === "submitted") {
    try {
      const r = await gradeAttempt(a);
      return { attempt: r.attempt, key: r.key, finalized };
    } catch (err) {
      if (err?.code !== "permission-denied") throw err;
      a = (await reread(a.id)) || a;                       // boshqa jarayon baholab bo'lgan (graded → graded yo'q)
    }
  }
  return { attempt: a, key: null, finalized };
}

/**
 * Ro'yxat uchun (dashboard, natijalar, admin). Yechim vaqti kelgan:
 *   • in_progress → avtomatik yakunlanadi va baholanadi;
 *   • submitted (baholash uzilib qolgan) → mavjud GRADE bilan baholanadi.
 * @returns {{attempts: object[], finalized: number, graded: number}}
 */
export async function finalizeOverdueList(attempts, testsById, now = Date.now()) {
  const out = [];
  let finalized = 0;
  let graded = 0;
  for (const a of attempts || []) {
    const t = testsById?.get?.(a?.testId);
    const due = isOverdue(a, t, now)
      || (a?.status === "submitted" && Number.isInteger(a.testVersion) && isOverdue({ ...a, status: "in_progress" }, t, now));
    if (!due) { out.push(a); continue; }
    try {
      const r = await finalizeIfOverdue(a, t, now);
      if (r.finalized) finalized++;
      else if (a.status === "submitted" && r.attempt?.status === "graded") graded++;
      out.push(r.attempt);
    } catch (err) {
      console.warn("[att] avtomatik yakunlash:", a.id, err?.code || err);
      out.push(a);
    }
  }
  return { attempts: out, finalized, graded };
}
