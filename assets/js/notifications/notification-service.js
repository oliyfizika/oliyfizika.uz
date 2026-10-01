// ==========================================================================
// Bildirishnomalar xizmati — SOF funksiyalar (Firebase ham, DOM ham yo'q).
//
// Bildirishnomalar saqlanmaydi: har safar foydalanuvchining mavjud ma'lumotidan hosil qilinadi
// (Firestore `results`, progress, yutuqlar, users/{uid}.level). Shu sababli:
//  • ID deterministik — bir xil hodisa har doim bir xil ID (dublikat yo'q);
//  • sana faqat haqiqiy hodisa sanasidan (test sanasi) olinadi, o'ylab topilmaydi.
// ==========================================================================

/** Qisqa barqaror xesh (FNV-1a) — ichki identifikatorlarni UI/ID'da ochiq ko'rsatmaslik uchun. */
export function hash(value) {
  let h = 0x811c9dc5;
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const MAX_ITEMS = 30;
const MAX_RESULT_ITEMS = 20;

// Kurs bildirishnomalari bilan takrorlanmasligi uchun bu yutuqlar alohida chiqarilmaydi
const ACHIEVEMENTS_COVERED_ELSEWHERE = new Set(["course-started", "course-done"]);

/**
 * @param {object} input
 * @param {Array}  input.results      results-data.prepareResults() natijasi (faqat joriy foydalanuvchi)
 * @param {object} input.progress     progress-service.computeProgress() natijasi
 * @param {Array}  input.achievements results-data.deriveAchievements() natijasi
 * @param {number} input.level        users/{uid}.level
 * @param {(path:string)=>string} input.url  sayt ildiziga nisbatan to'liq URL
 * @returns {Array<{id,type,icon,tone,title,body,href,action,time}>}
 */
export function buildNotifications({ results = [], progress, achievements = [], level = 1, url }) {
  const out = [];
  const resultsPage = url("dashboard/natijalar.html");

  // --- Test natijalari (eng yangi MAX_RESULT_ITEMS ta) ---
  results
    .filter((r) => r.number != null)
    .slice(0, MAX_RESULT_ITEMS)
    .forEach((r) => {
      const id = `result:${hash(r.ref || `${r.number}|${r.time}|${r.percent}|${r.score}`)}`;
      const where = r.courseTitle ? `${r.courseTitle} — ${r.label}` : r.label;
      if (r.passed) {
        out.push({
          id, type: "test-passed", icon: "checkCircle", tone: "success",
          title: "Testdan muvaffaqiyatli o‘tdingiz",
          body: `${where}: ${r.percent ?? "—"}%`,
          href: `${resultsPage}#test-natijalari`, action: "Natijani ko‘rish",
          time: r.time || null,
        });
      } else {
        out.push({
          id, type: "test-result", icon: "target", tone: "info",
          title: "Test natijasi",
          body: `${r.label} testidan ${r.percent ?? "—"}% natija oldingiz. Mavzuni takrorlab, yana urinib ko‘ring — 80% yetarli.`,
          href: r.href || `${resultsPage}#test-natijalari`, action: r.href ? "Mavzuga o‘tish" : "Natijani ko‘rish",
          time: r.time || null,
        });
      }
    });

  // --- Kurslar: boshlandi / yakunlandi ---
  const firstPass = new Map();
  [...results].sort((a, b) => a.time - b.time).forEach((r) => {
    if (r.passed && r.number != null && !firstPass.has(r.number)) firstPass.set(r.number, r.time || null);
  });
  (progress?.courses || []).forEach((c) => {
    if (c.done > 0) {
      const times = c.lessons.map((l) => firstPass.get(l.number)).filter(Boolean);
      out.push({
        id: `course-start:${c.id}`, type: "course-start", icon: "book", tone: "primary",
        title: "Yangi kurs",
        body: `${c.title} kursini boshladingiz.`,
        href: c.page, action: "Kursga o‘tish",
        time: times.length ? Math.min(...times) : null,
      });
    }
    if (c.status === "done") {
      const times = c.lessons.map((l) => firstPass.get(l.number));
      out.push({
        id: `course-done:${c.id}`, type: "course-done", icon: "trophy", tone: "success",
        title: "Kurs yakunlandi!",
        body: `${c.title} kursini yakunladingiz!`,
        href: resultsPage, action: "Natijalarim",
        time: times.every(Boolean) ? Math.max(...times) : null,
      });
    }
  });

  // --- Yutuqlar (faqat haqiqatan ochilganlari) ---
  achievements
    .filter((a) => a.earned && !ACHIEVEMENTS_COVERED_ELSEWHERE.has(a.id))
    .forEach((a) => {
      out.push({
        id: `achievement:${a.id}`, type: "achievement", icon: "medal", tone: "special",
        title: "Yangi yutuq!",
        body: `Siz «${a.title}» yutug‘ini ochdingiz.`,
        href: resultsPage, action: "Natijalarim",
        time: a.date ? a.date.getTime() : null,
      });
    });

  // --- Daraja: faqat joriy (saqlangan) daraja; tarix o'ylab topilmaydi ---
  const lvl = Number(level) || 1;
  if (lvl >= 2) {
    out.push({
      id: `level:${lvl}`, type: "level", icon: "sparkles", tone: "special",
      title: "Yangi daraja!",
      body: `Siz ${lvl}-darajaga erishdingiz.`,
      href: resultsPage, action: "Natijalarim",
      time: null,
    });
  }

  return out;
}

/**
 * Tartiblash: haqiqiy sana bo'yicha (yangisi birinchi). Sanasi yo'qlar uchun — shu qurilmada
 * birinchi ko'rilgan vaqt (faqat tartib uchun, foydalanuvchiga sana sifatida ko'rsatilmaydi).
 * Teng bo'lsa — ID bo'yicha (deterministik).
 */
export function sortNotifications(items, firstSeen = {}) {
  const key = (n) => n.time ?? firstSeen[n.id] ?? 0;
  return [...items].sort((a, b) => key(b) - key(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Nisbiy sana: "Bugun", "Kecha", "3 kun oldin", aks holda dd.mm.yyyy. */
export function relativeDate(time, now = Date.now()) {
  if (!time) return "";
  const d = new Date(time);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date(now)) - startOf(d)) / 86400000);
  if (days <= 0) return "Bugun";
  if (days === 1) return "Kecha";
  if (days < 7) return `${days} kun oldin`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
