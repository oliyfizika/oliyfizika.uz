// ==========================================================================
// O'qilgan/o'qilmagan holati — faqat shu brauzerda (localStorage), foydalanuvchi UID'i bo'yicha ajratilgan.
// Kalit: "oliyfizika:notifications:<uid>"
// Saqlanadi: faqat bildirishnoma ID'lari va vaqt belgilari (hech qanday shaxsiy ma'lumot yo'q).
// Eslatma: holat qurilmalar o'rtasida sinxronlanmaydi.
// ==========================================================================

const PREFIX = "oliyfizika:notifications:";
const BASELINE_FRESH_MS = 3 * 24 * 60 * 60 * 1000; // birinchi ochilishda 3 kundan eski hodisalar "o'qilgan"

function key(uid) {
  return PREFIX + uid;
}

export function loadState(uid) {
  if (!uid) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) || "null");
    if (raw && raw.v === 1 && Array.isArray(raw.read) && raw.seen && typeof raw.seen === "object") return raw;
  } catch { /* buzilgan qiymat — qaytadan boshlanadi */ }
  return null;
}

function saveState(uid, state) {
  try { localStorage.setItem(key(uid), JSON.stringify(state)); } catch { /* storage mavjud emas */ }
}

/**
 * Joriy bildirishnomalarni holat bilan birlashtiradi.
 * - Birinchi marta (holat yo'q): eski yoki sanasiz hodisalar o'qilgan deb belgilanadi,
 *   shunda eski natijalar birdaniga o'nlab "yangi" bildirishnoma bo'lib chiqmaydi.
 * - Hozir mavjud bo'lmagan ID'lar holatdan o'chiriladi (hajm o'smaydi).
 */
export function reconcile(uid, items, now = Date.now()) {
  let state = loadState(uid);
  const isFirstRun = !state;
  if (!state) state = { v: 1, read: [], seen: {}, since: now };

  const read = new Set(state.read);
  const seen = {};
  items.forEach((n) => {
    seen[n.id] = state.seen[n.id] || now;
    if (isFirstRun && (!n.time || now - n.time > BASELINE_FRESH_MS)) read.add(n.id);
  });
  const ids = new Set(items.map((n) => n.id));
  const next = { v: 1, read: [...read].filter((id) => ids.has(id)), seen, since: state.since };
  saveState(uid, next);
  return { read: new Set(next.read), seen };
}

export function markRead(uid, ids) {
  const state = loadState(uid);
  if (!state) return;
  const read = new Set(state.read);
  [].concat(ids).forEach((id) => read.add(id));
  state.read = [...read];
  saveState(uid, state);
}
