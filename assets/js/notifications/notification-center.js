// ==========================================================================
// Bildirishnomalar markazi — header qo'ng'irog'i va paneli (barcha qobiq sahifalari uchun bitta).
//
// Ma'lumot: session.js (profil) + progress-service.loadResults() — sahifa allaqachon yuklagan bo'lsa
// o'sha keshdan foydalaniladi (qo'shimcha so'rov yo'q). Natijalarni ishlatmaydigan sahifalarda
// hosil qilingan ro'yxat sessionStorage'da 5 daqiqa keshlanadi.
//
// Kelajakdagi tizim e'lonlari uchun ulanish nuqtasi (saqlanadi):
//   document.dispatchEvent(new CustomEvent("of:notifications", {
//     detail: { source: "system", items: [{ id, title, body?, href?, action?, time?, icon? }] }
//   }));
// ==========================================================================

import { icon } from "../ui/icons.js";
import { getLearningSummary, loadResults, hasLoadedResults } from "../progress/progress-service.js";
import { prepareResults, deriveAchievements } from "../results/results-data.js";
import { buildNotifications, sortNotifications, relativeDate, MAX_ITEMS } from "./notification-service.js";
import { reconcile, markRead } from "./notification-store.js";

const ROOT = new URL("../../../", import.meta.url);
const url = (p) => new URL(p, ROOT).href;
const CACHE_PREFIX = "oliyfizika:notif-cache:";
const CACHE_TTL = 5 * 60 * 1000;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let uid = null;
let status = "idle"; // idle | loading | ready | error
let derived = [];    // foydalanuvchi ma'lumotidan
let system = [];     // tashqi e'lonlar (hozircha manba yo'q)
let readSet = new Set();
let seen = {};
let els = null;
let lastState = null;

// ------------------------------------------------------------ markup
export function notificationMarkup() {
  return `
    <div class="of-notify" data-notify>
      <button type="button" class="of-icon-btn of-notify__bell" data-popover aria-controls="of-notify-panel" aria-expanded="false" aria-haspopup="dialog" aria-label="Bildirishnomalar" data-notify-bell>
        ${icon("bell")}<span class="of-notify-dot" data-notify-dot hidden aria-hidden="true"></span>
      </button>
      <div class="of-popover of-notify__panel" id="of-notify-panel" role="dialog" aria-modal="false" aria-labelledby="of-notify-title" hidden>
        <div class="of-notify__head">
          <h2 id="of-notify-title" tabindex="-1">Bildirishnomalar</h2>
          <div class="of-row" style="gap:4px">
            <button type="button" class="of-link-btn of-notify__all" data-notify-all hidden>Barchasini o‘qilgan deb belgilash</button>
            <button type="button" class="of-icon-btn of-notify__close" data-notify-close aria-label="Bildirishnomalarni yopish">${icon("close")}</button>
          </div>
        </div>
        <p class="of-sr-only" aria-live="polite" data-notify-live></p>
        <div class="of-notify__list" data-notify-list></div>
      </div>
    </div>`;
}

// ------------------------------------------------------------ yordamchilar
function cacheKey() { return CACHE_PREFIX + uid; }
function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(cacheKey()) || "null");
    return c && Date.now() - c.at < CACHE_TTL && Array.isArray(c.items) ? c.items : null;
  } catch { return null; }
}
function writeCache(items) {
  try { sessionStorage.setItem(cacheKey(), JSON.stringify({ at: Date.now(), items })); } catch { /* ignore */ }
}
export function clearNotificationCache() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

function allItems() {
  // O'qilmaganlar birinchi, keyin sana bo'yicha (yangisi birinchi)
  const sorted = sortNotifications([...derived, ...system], seen);
  return [...sorted.filter((n) => !readSet.has(n.id)), ...sorted.filter((n) => readSet.has(n.id))].slice(0, MAX_ITEMS);
}

// ------------------------------------------------------------ yuklash
async function compute(state) {
  const summary = await getLearningSummary(state);            // keshlangan results
  const results = prepareResults(await loadResults(state.user.uid));
  const achievements = deriveAchievements({ results, progress: summary.progress, xp: summary.stats.xp });
  return buildNotifications({ results, progress: summary.progress, achievements, level: state.profile?.level, url });
}

async function load(state) {
  status = "loading";
  render();
  if (state.user?.uid !== uid) return;
  try {
    let items = !hasLoadedResults(uid) ? readCache() : null;
    if (!items) {
      items = await compute(state);
      writeCache(items);
    }
    if (state.user?.uid !== uid) return; // foydalanuvchi almashgan
    derived = items;
    ({ read: readSet, seen } = reconcile(uid, [...derived, ...system]));
    status = "ready";
  } catch (error) {
    console.error("[bildirishnomalar] yuklanmadi:", error?.code || error);
    status = "error";
  }
  render();
}

// ------------------------------------------------------------ chizish
function itemMarkup(n) {
  const unread = !readSet.has(n.id);
  const when = relativeDate(n.time);
  return `
    <li class="of-notice" data-unread="${unread}" data-tone="${esc(n.tone || "primary")}">
      <a class="of-notice__link" href="${esc(n.href || url("dashboard/natijalar.html"))}" data-notice-id="${esc(n.id)}">
        <span class="of-notice__icon" aria-hidden="true">${icon(n.icon || "bell")}</span>
        <span class="of-notice__body">
          <span class="of-notice__title">${unread ? '<span class="of-sr-only">O‘qilmagan: </span>' : ""}${esc(n.title)}</span>
          <span class="of-notice__text">${esc(n.body || "")}</span>
          <span class="of-notice__meta">${when ? `<span>${esc(when)}</span>` : ""}${n.action ? `<span class="of-notice__action">${esc(n.action)} →</span>` : ""}</span>
        </span>
        ${unread ? '<span class="of-notice__dot" aria-hidden="true"></span>' : ""}
      </a>
    </li>`;
}

function render() {
  if (!els) return;
  const items = allItems();
  const unread = items.filter((n) => !readSet.has(n.id)).length;

  els.dot.hidden = !(status === "ready" && unread > 0);
  els.bell.setAttribute("aria-label", status === "ready" && unread
    ? `Bildirishnomalar — ${unread} ta o‘qilmagan`
    : "Bildirishnomalar");
  els.all.hidden = !(status === "ready" && unread > 0);

  if (status === "loading" || status === "idle") {
    els.list.setAttribute("aria-busy", "true");
    els.list.innerHTML = `<div class="of-notify__loading">${'<div class="of-notice__skel"><span class="of-skeleton of-skeleton--circle" style="width:36px;height:36px"></span><div style="flex:1;display:grid;gap:8px"><span class="of-skeleton of-skeleton--text" style="width:60%"></span><span class="of-skeleton of-skeleton--text"></span></div></div>'.repeat(3)}</div>`;
    return;
  }
  els.list.removeAttribute("aria-busy");
  if (status === "error") {
    els.list.innerHTML = `<div class="of-notify__note"><p>Bildirishnomalarni yuklab bo‘lmadi.</p><button type="button" class="of-btn of-btn--sm" data-notify-retry>Qayta urinish</button></div>`;
    return;
  }
  els.list.innerHTML = items.length
    ? `<ul class="of-notice-list">${items.map(itemMarkup).join("")}</ul>`
    : '<p class="of-notify__note">Yangi bildirishnomalar yo‘q.</p>';
}

// ------------------------------------------------------------ ulanish
/** Header'da hisob qismi chizilgandan keyin chaqiriladi. */
export function mountNotifications(root, state) {
  els = {
    root,
    bell: root.querySelector("[data-notify-bell]"),
    dot: root.querySelector("[data-notify-dot]"),
    panel: root.querySelector("#of-notify-panel"),
    list: root.querySelector("[data-notify-list]"),
    all: root.querySelector("[data-notify-all]"),
    live: root.querySelector("[data-notify-live]"),
  };

  els.list.addEventListener("click", (e) => {
    if (e.target.closest("[data-notify-retry]")) { load(lastState); return; }
    const link = e.target.closest("[data-notice-id]");
    if (!link) return;
    markRead(uid, link.dataset.noticeId);
    readSet.add(link.dataset.noticeId);
    render();
    // Havola odatdagidek ochiladi (mavjud sahifalar)
  });
  els.all.addEventListener("click", () => {
    const ids = allItems().map((n) => n.id);
    markRead(uid, ids);
    ids.forEach((id) => readSet.add(id));
    render();
    els.live.textContent = "Barcha bildirishnomalar o‘qilgan deb belgilandi.";
    // Tugma yashirildi — fokusni panel ichida qoldiramiz (mobilda "Yopish", aks holda sarlavha)
    const close = els.panel.querySelector("[data-notify-close]");
    if (close && close.offsetParent !== null) close.focus();
    else els.panel.querySelector("#of-notify-title")?.focus();
  });
  root.querySelector("[data-notify-close]").addEventListener("click", () => {
    els.bell.click();
    els.bell.focus();
  });
  // Mobil pastki panel ochiq bo'lganda sahifa orqasini qorong'ilash / aylantirishni to'xtatish
  new MutationObserver(() => {
    const open = !els.panel.hidden;
    if (open) document.documentElement.dataset.notifyOpen = "true";
    else delete document.documentElement.dataset.notifyOpen;
  }).observe(els.panel, { attributes: true, attributeFilter: ["hidden"] });

  updateSession(state);
}

/** Sessiya o'zgarganda (profil yuklangan va h.k.). */
export function updateSession(state) {
  lastState = state;
  if (state.status !== "authenticated") {
    uid = null; derived = []; readSet = new Set(); seen = {}; status = "idle";
    return;
  }
  if (state.user.uid !== uid) {
    uid = state.user.uid; derived = []; readSet = new Set(); seen = {}; status = "idle";
  }
  if (!state.profileLoaded) { render(); return; }
  // Attestatsiya → Fizika: e'lon qilingan kunlik test / ochilgan yechimlar (mavjud "of:notifications" ulanish nuqtasi orqali)
  import("../attestatsiya-fizika/notify.js").then((m) => m.refresh(state)).catch(() => {});
  if (status === "idle") {
    status = "loading";
    render();
    // Sahifa modullari ham shu sessiya hodisasida natijalarni so'raydi — ular so'rovni boshlashiga
    // imkon beramiz, keyin o'sha keshlangan so'rovdan foydalanamiz (qo'shimcha so'rov yo'q).
    setTimeout(() => load(state), 0);
  } else render();
}

// Tizim e'lonlari uchun ulanish nuqtasi (hozircha manba yo'q)
document.addEventListener("of:notifications", (event) => {
  const items = Array.isArray(event.detail?.items) ? event.detail.items : [];
  system = items
    .filter((n) => n && n.id && n.title)
    .map((n) => ({ ...n, id: `system:${n.id}`, type: "system", tone: n.tone || "primary", icon: n.icon || "info", time: n.time ? new Date(n.time).getTime() : null }));
  if (uid && status === "ready") ({ read: readSet, seen } = reconcile(uid, [...derived, ...system]));
  render();
});
