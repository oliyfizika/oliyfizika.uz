// ==========================================================================
// Admin System 2.0 — amallar jurnali (adminAuditLog/{id}).
// Har qanday admin faqat o'z nomidan yozadi (actorUid == auth.uid, at == server vaqti — Rules tekshiradi).
// O'qish — faqat owner (admin/admins.html → «Amallar jurnali»). Jurnal o'zgarmas: update/delete — hech kim.
//
//   auditEntry(...)  — writeBatch ichiga qo'shish uchun {ref, data} (o'zgarish va yozuv bitta atomik yozuvda);
//   logAdminAction() — mustaqil yozuv (best-effort): asosiy amal bajarilgandan keyin, xato bo'lsa faqat konsolga.
// ==========================================================================

const nameOf = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || String(p?.fullName || "").trim();

function base(state, fsSdk, e) {
  const data = {
    actorUid: state.user.uid,
    action: String(e.action),
    section: String(e.section || "umumiy"),
    summary: String(e.summary || "").slice(0, 500),
    at: fsSdk.serverTimestamp(),
  };
  const email = state.user.email;
  if (email) data.actorEmail = email;
  const name = nameOf(state.profile);
  if (name) data.actorName = name.slice(0, 200);
  if (e.targetUid) data.targetUid = String(e.targetUid).slice(0, 128);
  if (e.targetLabel) data.targetLabel = String(e.targetLabel).slice(0, 300);
  if (e.details && typeof e.details === "object") data.details = Object.fromEntries(Object.entries(e.details).slice(0, 20));
  return data;
}

/** writeBatch uchun: { ref, data }. */
export function auditEntry(fb, state, e) {
  const { doc, collection } = fb.fsSdk;
  return { ref: doc(collection(fb.db, "adminAuditLog")), data: base(state, fb.fsSdk, e) };
}

/** Mustaqil yozuv (best-effort). Asosiy amalni to'xtatmaydi. */
export async function logAdminAction(fb, state, e) {
  try {
    const { ref, data } = auditEntry(fb, state, e);
    await fb.fsSdk.setDoc(ref, data);
  } catch (error) {
    console.warn("[admin] amallar jurnaliga yozib bo‘lmadi:", error?.code || error);
  }
}
