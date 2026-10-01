// Himoyalangan bo'limga mehmon kirmoqchi bo'lganda ko'rsatiladigan oyna.
// Qobiq (app-shell.js) va eski sahifalar (js/auth.js) uchun umumiy.

import { openModal } from "../ui/modal.js";
import { getSessionState, whenReady } from "../core/session.js";
import { setPendingDestination } from "./auth-service.js";

export const AUTH_REQUIRED_TEXT = "Ushbu bo‘limdan foydalanish uchun hisobingizga kiring yoki ro‘yxatdan o‘ting.";

export async function openAuth(view = "login", opts = {}) {
  const mod = await import("./auth-ui.js");
  return mod.openAuthDialog(view, opts);
}

/**
 * @param {string} destination  kirgandan keyin qaytiladigan manzil
 * @param {{ onDismiss?: Function }} [opts]  natijasiz yopilganda (mehmon qolganda)
 */
export function showAuthGate(destination, { onDismiss } = {}) {
  if (destination) setPendingDestination(destination);
  const afterAuth = (reason) => {
    if (reason !== "success" && getSessionState().status !== "authenticated") onDismiss?.();
  };
  return openModal({
    title: "Hisobingizga kiring",
    text: AUTH_REQUIRED_TEXT,
    iconName: "lock",
    actions: [
      { label: "Ro‘yxatdan o‘tish", variant: "primary", onClick: (_, m) => { m.close("action"); openAuth("register", { onClose: afterAuth }); } },
      { label: "Kirish", onClick: (_, m) => { m.close("action"); openAuth("login", { onClose: afterAuth }); } },
    ],
    onClose: (reason) => { if (reason !== "action" && reason !== "auth") onDismiss?.(); },
  });
}

/**
 * Konteyner ichidagi himoyalangan havolalarni ulaydi: mehmon bosganda kirish oynasi ochiladi,
 * kirgandan keyin aynan shu havolaga qaytiladi. Sessiya hali aniqlanmagan bo'lsa — kutiladi.
 * @param {HTMLElement} root
 * @param {string} selector  masalan: "a[data-quiz-start]"
 */
export function bindProtectedLinks(root, selector) {
  root.addEventListener("click", async (event) => {
    const link = event.target.closest(selector);
    if (!link) return;
    const status = getSessionState().status;
    if (status === "authenticated") return; // odatdagi o'tish
    event.preventDefault();
    const s = status === "loading" ? await whenReady() : getSessionState();
    if (s.status === "authenticated") location.assign(link.href);
    else showAuthGate(link.href);
  });
}
