// ==========================================================================
// Admin System 1.0 — umumiy qatlam: admin gate, Firestore kirish, formatlash, tasdiqlash oynasi.
//
// MUHIM: frontend gate XAVFSIZLIK EMAS — u faqat oddiy foydalanuvchiga admin UI'ni ko'rsatmaydi va
// admin so'rovlarini yubormaydi. Haqiqiy himoya — firestore.rules (isAdmin(), field-level update).
//
// Profil faqat bir marta o'qiladi (session.js) — role shu hujjatdan olinadi; qayta o'qilmaydi.
// Firestore listener (onSnapshot) ishlatilmaydi; barcha ro'yxatlar limit + sahifalash bilan.
// ==========================================================================

import { onSession, loadFirebase } from "../core/session.js";
import { icon } from "../ui/icons.js";
import { openModal } from "../ui/modal.js";
import { formatDate } from "../account/account-common.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export { formatDate };

export const PAGE_SIZE = 20;

export function fillIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon); });
}

// ------------------------------------------------------------------ admin gate
let gatePromise = null;
/**
 * Sahifa kontenti ([data-admin-root]) faqat role == "admin" bo'lganda ko'rsatiladi va shundan keyingina
 * admin so'rovlari boshlanadi. Mehmonga qobiqning mavjud auth gate'i (kirgandan keyin shu URL'ga qaytadi).
 * @returns {Promise<{ state, fb }>}
 */
export function requireAdmin() {
  if (gatePromise) return gatePromise;
  const gate = $("[data-admin-gate]");
  const root = $("[data-admin-root]");
  let resolved = false;
  let slow = null;
  const show = (html) => { gate.hidden = false; gate.innerHTML = html; fillIcons(gate); };
  gatePromise = new Promise((resolve) => {
    onSession(async (state) => {
      clearTimeout(slow);
      const isAdmin = state.status === "authenticated" && state.profileLoaded && state.profile?.role === "admin";
      if (isAdmin) {
        if (resolved) return;
        resolved = true;
        gate.hidden = true;
        root.hidden = false;
        resolve({ state, fb: await loadFirebase() });
        return;
      }
      // Admin bo'lmagan holat: kontent yashiriladi va (agar yuklangan bo'lsa) tozalanadi
      if (resolved) { root.hidden = true; root.replaceChildren(); }
      root.hidden = true;
      if (state.status === "loading" || (state.status === "authenticated" && !state.profileLoaded)) {
        show(`<div class="of-admin-gate__box"><span class="of-skeleton of-skeleton--circle of-admin-gate__sk"></span><p>Administrator huquqi tekshirilmoqda…</p></div>`);
        slow = setTimeout(() => show(`<div class="of-admin-gate__box" role="alert"><span data-icon="alert" class="of-admin-gate__icon of-admin-gate__icon--warn"></span>
          <h1>Profilni yuklab bo‘lmadi</h1><p>Internet aloqasini tekshirib, sahifani yangilang.</p></div>`), 10000);
        return;
      }
      if (state.status !== "authenticated") {
        show(`<div class="of-admin-gate__box"><span data-icon="lock" class="of-admin-gate__icon"></span>
          <h1>Tizimga kiring</h1><p>Admin panel faqat administrator hisobi bilan ochiladi.</p>
          <div class="of-admin-gate__actions"><button type="button" class="of-btn of-btn--primary" data-gate-login>Kirish</button>
          <a class="of-btn of-btn--ghost" href="../index.html">Bosh sahifaga qaytish</a></div></div>`);
        gate.querySelector("[data-gate-login]")?.addEventListener("click", () => window.OFShell?.openAuth("login"));
        return;
      }
      show(`<div class="of-admin-gate__box" role="alert"><span data-icon="shield" class="of-admin-gate__icon of-admin-gate__icon--warn"></span>
        <h1>Ruxsat yo‘q</h1><p>Sizda administrator huquqi mavjud emas.</p>
        <div class="of-admin-gate__actions"><a class="of-btn of-btn--primary" href="../index.html">Bosh sahifaga qaytish</a></div></div>`);
    });
  });
  return gatePromise;
}

// ------------------------------------------------------------------ formatlash
export function fullNameOf(d) {
  const n = [d?.firstName, d?.lastName].filter(Boolean).join(" ").trim();
  return n || String(d?.fullName || "").trim() || "—";
}
export function splitNames(d) {
  if (d?.firstName || d?.lastName) return { first: d.firstName || "—", last: d.lastName || "—" };
  const parts = String(d?.fullName || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "—", last: parts.slice(1).join(" ") || "—" };
}
export function toDateObj(v) {
  if (!v) return null;
  try {
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    if (v.iso) return new Date(v.iso);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}
export function formatDateTime(v) {
  const d = toDateObj(v);
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hh}:${mm}`;
}
export const fmtDate = (v) => formatDate(v) || "—";
export const num = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("uz-UZ").replace(/,/g, " ") : "—");

export function yesNo(v, { yes = "Ha", no = "Yo‘q" } = {}) {
  return v === true
    ? `<span class="of-badge of-badge--green">${icon("check")}${yes}</span>`
    : `<span class="of-badge of-admin-badge--off">${no}</span>`;
}
export function roleBadge(role) {
  return role === "admin"
    ? `<span class="of-badge of-badge--purple">${icon("shield")}Admin</span>`
    : `<span class="of-badge of-admin-badge--off">Foydalanuvchi</span>`;
}

// ------------------------------------------------------------------ xatolar
export function errorText(error, fallback = "Ma’lumotlarni yuklab bo‘lmadi. Iltimos, qayta urinib ko‘ring.") {
  if (error) console.error("[admin]", error?.code || "", error);
  const code = error?.code || "";
  if (code === "permission-denied") return "Bu amal uchun ruxsat yo‘q. Firestore Rules administrator huquqini tasdiqlamadi.";
  if (code === "failed-precondition") return "Bu filtr uchun Firestore indeksi kerak. Repositorydagi firestore.indexes.json indekslarini Firebase'da yarating.";
  if (code === "unavailable" || navigator.onLine === false) return "Server bilan aloqa yo‘q. Internetni tekshirib, qayta urinib ko‘ring.";
  if (code === "not-found") return "Hujjat topilmadi.";
  return fallback;
}
export function indexLink(error) {
  const m = /https:\/\/console\.firebase\.google\.com\/[^\s)]+/.exec(String(error?.message || ""));
  return m ? m[0] : null;
}

export function stateBox(kind, title, text = "") {
  const ic = kind === "error" ? "alert" : kind === "empty" ? "info" : "info";
  return `<div class="of-admin-state of-admin-state--${kind}" ${kind === "error" ? 'role="alert"' : 'role="status"'}>
    ${icon(ic)}<div><p class="of-admin-state__title">${esc(title)}</p>${text ? `<p>${esc(text)}</p>` : ""}</div></div>`;
}

// ------------------------------------------------------------------ tasdiqlash
/** Tasdiqlash oynasi (mavjud modal.js: fokus tuzog'i, Esc, fokusni qaytarish). true — tasdiqlandi. */
export function confirmAction({ title, text, confirmLabel = "Tasdiqlash", danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, m) => { if (done) return; done = true; m?.close("action"); resolve(v); };
    const modal = openModal({
      title, text, iconName: danger ? "alert" : "shield", className: "of-admin-confirm",
      actions: [
        { label: confirmLabel, variant: danger ? "danger" : "primary", onClick: (_, m) => finish(true, m) },
        { label: "Bekor qilish", variant: "ghost", onClick: (_, m) => finish(false, m) },
      ],
      onClose: () => finish(false),
    });
    // Asosiy harakat emas, "Bekor qilish" birinchi fokusda bo'lmasin — tasdiqlash tugmasiga fokus
    modal.dialog.querySelector(".of-modal__actions .of-btn")?.focus();
  });
}

// ------------------------------------------------------------------ yozish (faqat ruxsat etilgan maydonlar)
const ACCESS_FIELDS = ["role", "fullAccess", "mockTestsAccess"];
/** Admin: faqat role / fullAccess / mockTestsAccess. Boshqa maydon yuborilmaydi (Rules ham rad etadi). */
export async function updateAccess(fb, uid, field, value) {
  if (!ACCESS_FIELDS.includes(field)) throw new Error(`Ruxsat etilmagan maydon: ${field}`);
  if (field === "role" && !["user", "admin"].includes(value)) throw new Error("Noto‘g‘ri role");
  if (field !== "role" && typeof value !== "boolean") throw new Error("Qiymat true/false bo‘lishi kerak");
  const { doc, updateDoc } = fb.fsSdk;
  await updateDoc(doc(fb.db, "users", uid), { [field]: value });
}

export const ACCESS_LABEL = { role: "Administrator", fullAccess: "Full Access", mockTestsAccess: "Mock Test Access" };
