// ==========================================================================
// Attestatsiya → Fizika: bildirishnomalar manbai (mavjud bildirishnomalar markaziga ulanadi).
// Yangi infratuzilma YO'Q: admin PUBLISH qilganda test hujjatida publishedAt + notification payload paydo
// bo'ladi; shu modul ularni o'qib, mavjud "of:notifications" ulanish nuqtasiga yuboradi.
// Performance: real-time subscription yo'q; bitta so'rov (published testlar) 5 daqiqaga sessionStorage'da keshlanadi.
// ==========================================================================
import { listVisibleTests } from "./api.js";
import { toMs, solutionOpen, officialOpen, dayLabel } from "./core.js";

const ROOT = new URL("../../../", import.meta.url);
const KEY = "oliyfizika:att-notif:";
const TTL = 5 * 60 * 1000;
const RECENT = 3 * 24 * 60 * 60 * 1000;

async function items(uid) {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY + uid) || "null");
    if (c && Date.now() - c.at < TTL) return c.items;
  } catch { /* ignore */ }
  const now = Date.now();
  const tests = await listVisibleTests();
  const out = [];
  for (const t of tests) {
    const pub = toMs(t.publishedAt);
    const sol = toMs(t.solutionAvailableAt);
    if (pub && now - pub < RECENT && officialOpen(t, now)) {
      out.push({
        id: `att-fizika-published:${t.id}`,
        title: t.notification?.title || "Bugungi attestatsiya testi tayyor!",
        body: t.notification?.body || `${dayLabel(t)} · ${t.questionCount} savol`,
        href: new URL(`attestatsiya/fizika-test.html?day=${t.dayNumber}`, ROOT).href,
        action: "Testni boshlash", icon: "clipboard", tone: "primary", time: pub,
      });
    }
    if (sol && solutionOpen(t, now) && now - sol < RECENT) {
      out.push({
        id: `att-fizika-solution:${t.id}`,
        title: `${dayLabel(t)} yechimlari ochildi`,
        body: "Bosqichma-bosqich yechimlar bilan tanishing.",
        href: new URL(`attestatsiya/fizika-yechimlar.html?day=${t.dayNumber}`, ROOT).href,
        action: "Yechimlar", icon: "book", tone: "success", time: sol,
      });
    }
  }
  try { sessionStorage.setItem(KEY + uid, JSON.stringify({ at: Date.now(), items: out })); } catch { /* ignore */ }
  return out;
}

let lastUid = null;
/** notification-center.js chaqiradi (sessiya autentifikatsiya qilinganda). Xato — jim (bildirishnomalar ixtiyoriy). */
export async function refresh(state) {
  const uid = state?.user?.uid;
  if (!uid || uid === lastUid) return;
  lastUid = uid;
  try {
    const list = await items(uid);
    document.dispatchEvent(new CustomEvent("of:notifications", { detail: { source: "attestatsiya-fizika", items: list } }));
  } catch (e) {
    console.info("[att] bildirishnomalar:", e?.code || e);
  }
}
