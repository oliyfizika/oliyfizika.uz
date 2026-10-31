// Attestatsiya → Fizika: kichik UI yordamchilari (umumiy 2.0 ikonlari + bo'limga xos bir nechta ikon).
import { icon } from "../ui/icons.js";
import { onSession } from "../core/session.js";
import { t } from "../core/i18n.js";

// Umumiy icons.js o'zgartirilmaydi — qo'shimcha ikonlar shu yerda, bir xil uslubda (24px, stroke 1.8).
const EXTRA = {
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  minusCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.6-1.7"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4M12 8v4l3 2"/>',
};

export function ic(name, opts = {}) {
  if (EXTRA[name]) {
    const a11y = opts.label ? ` role="img" aria-label="${opts.label}"` : ' aria-hidden="true" focusable="false"';
    return `<svg class="of-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${a11y}>${EXTRA[name]}</svg>`;
  }
  return icon(name, opts);
}

export function fillIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.firstElementChild) el.innerHTML = ic(el.dataset.icon);
  });
}

/** Autentifikatsiyadan o'tgan foydalanuvchini kutadi (mehmonga qobiq o'zi kirish oynasini ko'rsatadi). */
export function whenUser() {
  return new Promise((resolve) => {
    onSession((s) => {
      if (s.status === "authenticated" && s.user) resolve(s);
    });
  });
}

export function stateHtml(iconName, title, text = "", actionHtml = "") {
  return `<div class="att-state" role="status">${ic(iconName)}<h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${actionHtml}</div>`;
}

export function errorMessage(e) {
  const code = e?.code || "";
  if (code.includes("permission-denied")) return t("att.ui.errDenied", "Bu ma’lumotga ruxsat yo‘q (test hali e’lon qilinmagan yoki muddati o‘tgan bo‘lishi mumkin).");
  if (code.includes("unavailable") || code.includes("network")) return t("att.ui.errNetwork", "Internet aloqasini tekshirib, sahifani yangilang.");
  return t("att.ui.errLoad", "Ma’lumotni yuklab bo‘lmadi. Iltimos, qayta urinib ko‘ring.");
}

/** Fizika bo'limi ichki navigatsiyasi (tablar) */
export function tabsHtml(active) {
  const tabs = [
    ["fizikaattestatsiya.html", "home", t("att.ui.tabHome", "Bosh sahifa"), "home"],
    ["fizikaattestatsiya.html#kunlik", "calendar", t("att.ui.tabDays", "Kunlik topshiriqlar"), "days"],
    ["fizika-yechimlar.html", "book", t("att.ui.tabSolutions", "Yechimlar"), "solutions"],
    ["fizika-natijalar.html", "chart", t("att.ui.tabResults", "Natijalar va statistika"), "results"],
  ];
  return `<nav class="att-tabs" aria-label="${t("att.ui.tabsAria", "Attestatsiya — Fizika bo‘limlari")}">${tabs
    .map(([href, i, label, id]) => `<a href="${href}"${id === active ? ' aria-current="page"' : ""}>${ic(i)}<span>${label}</span></a>`)
    .join("")}</nav>`;
}
