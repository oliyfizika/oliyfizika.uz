// Real imtihonlar — metadata -> matn (data-driven; hech qanday imtihon nomi kodda yozilmagan).

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** "30.09.2026 — Variant A" / "06.04.2026 — 1-smena" / "18.01.2026". Smena metadata'da bo'lmasa taxmin qilinmaydi. */
export function examTitle(exam) {
  return exam.subtitle ? `${exam.displayDate} — ${exam.subtitle}` : exam.displayDate;
}

export function examYear(exam) {
  return String(exam.date || "").slice(0, 4);
}

export const SOLUTION_STATUS = {
  FINAL: { label: "Yakuniy yechim", tone: "green" },
  NO_CORRECT_OPTION: { label: "Manba xatosi: to‘g‘ri variant yo‘q", tone: "orange",
    help: "Imtihon manbasidagi variantlarning birortasi ham to‘g‘ri emas. Quyida audit qilingan fizik yechim va to‘g‘ri natija keltirilgan; variantlardan biri javob sifatida belgilanmagan." },
  NEEDS_MANUAL_REVIEW: { label: "Qo‘shimcha tekshiruv talab etiladi", tone: "purple",
    help: "Bu savol (yoki uning qismi) bo‘yicha yakuniy javob hali tasdiqlanmagan. Quyidagi mulohazalar faqat ma’lumot uchun; yakuniy javob sifatida qabul qilinmasin." },
  EXCLUDED_ORG: { label: "ORG savoli — modulga kiritilmagan", tone: "red",
    help: "Manbada «ORG — savol emas» deb belgilangan. Rasmiy imtihon savoli hisoblanmaydi." },
};

export const SOLUTION_FLAG = {
  SOURCE_KEY_CORRECTED: "Manba kaliti tuzatilgan",
  SOURCE_OPTION_LABEL_MISPRINT: "Manbada variant harfi xato bosilgan",
  SOURCE_KEY_ERROR: "Manba kaliti boshqa modelga asoslangan",
  SIGN_CONVENTION_NOTE: "Ishora konvensiyasi izohi",
  ASSUMPTION_STATED: "Faraz bilan yechilgan",
  SOURCE_ERROR: "Manba xatosi",
};

export const PART_STATUS = { FINAL: "yakuniy", NEEDS_MANUAL_REVIEW: "qo‘shimcha tekshiruv", NO_CORRECT_OPTION: "to‘g‘ri variant yo‘q" };

export const SOURCE_GROUP = {
  A: "LaTeX PDF (matn qatlami bor)",
  B: "Word’dan eksport qilingan PDF",
  C: "Faqat rasm (skan) PDF",
};

export function summaryText(s) {
  const parts = [];
  if (s.FINAL) parts.push(`${s.FINAL} ta yakuniy`);
  if (s.NO_CORRECT_OPTION) parts.push(`${s.NO_CORRECT_OPTION} ta manba xatosi`);
  if (s.NEEDS_MANUAL_REVIEW) parts.push(`${s.NEEDS_MANUAL_REVIEW} ta qo‘shimcha tekshiruvda`);
  return parts.join(" · ");
}
