// DTM variantlari — umumiy sozlamalar, savollar bazasini yuklash va natijalar tarixi (faqat shu brauzerda).
export const POINTS = 2;                 // har bir to'g'ri javob uchun ball
export const TOPIC_ORDER = ["M", "MF", "E", "O", "A"];
// Bitta variantdagi savollar soni bo'limlar bo'yicha (jami 25 ta → 50 ball).
export const QUOTA = { M: 9, MF: 4, E: 7, O: 2, A: 3 };
export const VARIANT_SIZE = Object.values(QUOTA).reduce((s, n) => s + n, 0);

const BASE = new URL("../../../dtm-variantlari/", import.meta.url);
const HISTORY_KEY = "oliyfizika:dtm:history";

/** baza.json → { topics, questions[], base } (rasm yo'llari `base` ga nisbatan). */
export async function loadBank() {
  const res = await fetch(new URL("data/baza.json", BASE), { cache: "no-cache" });
  if (!res.ok) throw new Error(`baza.json ${res.status}`);
  const data = await res.json();
  return { ...data, base: BASE.href };
}

export function readHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function pushHistory(entry) {
  try {
    const list = [entry, ...readHistory()].slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch { /* localStorage yopiq — tarix saqlanmaydi */ }
}
