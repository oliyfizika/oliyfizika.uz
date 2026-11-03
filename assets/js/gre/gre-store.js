// GRE bo'limi — eng yaxshi natijalarni brauzerda saqlash (faqat qulaylik uchun; xato bo'lsa jim o'tadi).
const KEY = "of-gre-best";

export function readBest() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}

export function saveBest(id, percent) {
  try {
    const all = readBest();
    if (!(String(id) in all) || percent > all[id]) {
      all[id] = percent;
      localStorage.setItem(KEY, JSON.stringify(all));
    }
  } catch { /* localStorage yopiq — natija saqlanmaydi */ }
}
