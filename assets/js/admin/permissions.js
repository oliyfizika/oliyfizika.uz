// ==========================================================================
// Admin System 2.0 — bo'limli adminlar (faqat UI mantiqi; Firebase'ga bog'liq emas).
//
//   users/{uid}.role == "admin"       — har qanday administrator (eski kod shu maydonga tayanadi).
//   users/{uid}.adminRole == "owner"  — sayt egasi: hamma narsa + adminlarni tayinlash + amallar jurnali.
//                                       Faqat Firebase Console'da qo'yiladi.
//   users/{uid}.adminSections: [...]  — owner biriktirgan bo'limlar. Maydon YO'Q — eski (to'liq) admin.
//
// MUHIM: bu fayl XAVFSIZLIK EMAS. Haqiqiy tekshiruv — firestore.rules (canManage / isSiteOwner).
// ADMIN_SECTIONS id'lari firestore.rules dagi adminSectionIds() bilan AYNAN bir xil bo'lishi shart.
// Attestatsiya → Pedagogika bu ro'yxatga kirmaydi (u bo'limga tegilmaydi).
// ==========================================================================

export const ADMIN_SECTIONS = [
  { id: "umumiy-fizika", label: "Umumiy fizika", icon: "book", desc: "Darslik testlari natijalari (Natijalar sahifasi)." },
  { id: "milliy-sertifikat", label: "Milliy sertifikat", icon: "certificate", desc: "Mock test natijalari va statistikasi." },
  { id: "attestatsiya-fizika", label: "Attestatsiya — Fizika", icon: "clipboard", desc: "Kunlik va mock testlar: import, e’lon qilish, arxivlash, urinishlar." },
  { id: "foydalanuvchilar", label: "Foydalanuvchilar", icon: "users", desc: "Foydalanuvchilar ro‘yxati va profillarini ko‘rish." },
  { id: "kirish-huquqlari", label: "Kirish huquqlari", icon: "key", desc: "Full Access, Mock Test Access va Attestatsiya ruxsatini berish/olish (to‘lovdan keyin)." },
  { id: "simulyatsiyalar", label: "Simulyatsiyalar", icon: "atom", desc: "Hozircha alohida admin sahifasi yo‘q — oldindan biriktirish mumkin.", planned: true },
  { id: "olimpiada", label: "Olimpiada", icon: "trophy", desc: "Hozircha alohida admin sahifasi yo‘q — oldindan biriktirish mumkin.", planned: true },
];

export const SECTION_IDS = ADMIN_SECTIONS.map((s) => s.id);
export const sectionLabel = (id) => ADMIN_SECTIONS.find((s) => s.id === id)?.label || id;

/**
 * Profil bo'yicha ruxsatlar.
 * @returns {{ isAdmin: boolean, owner: boolean, legacy: boolean, sections: string[], can: (id: string) => boolean }}
 */
export function adminPerms(profile) {
  const isAdmin = profile?.role === "admin";
  const owner = isAdmin && profile?.adminRole === "owner";
  const hasList = Array.isArray(profile?.adminSections);
  const legacy = isAdmin && !owner && !hasList;
  const sections = !isAdmin ? [] : (owner || legacy) ? [...SECTION_IDS] : profile.adminSections.filter((s) => SECTION_IDS.includes(s));
  return { isAdmin, owner, legacy, sections, can: (id) => sections.includes(id) };
}

/** Admin turi matni: "Owner" / "To‘liq admin" / "Bo‘limli admin" / "Foydalanuvchi". */
export function adminKindLabel(profile) {
  const p = adminPerms(profile);
  if (!p.isAdmin) return "Foydalanuvchi";
  if (p.owner) return "Owner (sayt egasi)";
  if (p.legacy) return "To‘liq admin (barcha bo‘limlar)";
  return "Bo‘limli admin";
}
