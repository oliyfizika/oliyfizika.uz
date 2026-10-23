// Real imtihonlar — umumiy UI: ruxsat darvozasi holatlari, ikonlar, xato holatlari.
import { icon } from "../../ui/icons.js";
import { showAuthGate } from "../../auth/auth-gate.js";
import { checkRealExamAccess } from "./access.js";
import { TELEGRAM_URL, DATA_SOURCE } from "./config.js";
import { esc } from "./labels.js";

export const ic = (name) => icon(name);

export function fillIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((n) => { n.innerHTML = icon(n.dataset.icon); });
}

const GATE_TEXT = {
  login: { title: "Tizimga kiring", text: "Real imtihonlar faqat ruxsat berilgan foydalanuvchilar uchun ochiq. Davom etish uchun hisobingizga kiring." },
  access: { title: "Ruxsat mavjud emas", text: "Bu bo‘lim Milliy sertifikat (mock testlar) ruxsati bor foydalanuvchilar uchun ochiq. Ruxsat olish uchun Telegram orqali murojaat qiling." },
  error: { title: "Ruxsatni tekshirib bo‘lmadi", text: "Iltimos, internet aloqasini tekshirib, sahifani qayta yuklang." },
};

/**
 * Sahifa ruxsat darvozasi: [data-gate] (holat qutisi) va [data-protected] (kontent) elementlari.
 * Ruxsat bo'lmasa kontent umuman yuklanmaydi (onAllowed chaqirilmaydi).
 */
export async function runGate(onAllowed) {
  const gate = document.querySelector("[data-gate]");
  const protectedEl = document.querySelector("[data-protected]");
  gate.dataset.state = "checking";
  const res = await checkRealExamAccess();
  document.documentElement.dataset.rxAccess = res.allowed ? "allowed" : res.reason;
  if (!res.allowed) {
    const t = GATE_TEXT[res.reason] || GATE_TEXT.error;
    gate.dataset.state = res.reason;
    gate.innerHTML = `
      <span class="rx-gate__icon" aria-hidden="true">${ic(res.reason === "error" ? "alert" : "lock")}</span>
      <div class="rx-gate__body">
        <h2 class="rx-gate__title">${esc(t.title)}</h2>
        <p class="rx-gate__text" role="status">${esc(t.text)}</p>
        <div class="rx-gate__actions">
          ${res.reason === "login" ? `<button type="button" class="of-btn of-btn--primary" data-login>${ic("login")}Kirish</button>` : ""}
          ${res.reason !== "error" ? `<a class="of-btn of-btn--soft" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">${ic("telegram")}Telegram orqali ruxsat olish</a>` : ""}
          <a class="of-btn of-btn--ghost" href="../milliy-sertifikat.html">${ic("chevronLeft")}Milliy sertifikat</a>
        </div>
      </div>`;
    gate.querySelector("[data-login]")?.addEventListener("click", () => showAuthGate(location.href));
    protectedEl.hidden = true;
    return res;
  }
  gate.hidden = true;
  protectedEl.hidden = false;
  if (DATA_SOURCE === "local") {
    const note = document.createElement("p");
    note.className = "rx-devnote";
    note.textContent = "Lokal rejim: ma’lumot _private/real-imtihonlar/app-data dan, PDF — test fixture. Production’ga ulanmagan.";
    protectedEl.prepend(note);
  }
  try {
    await onAllowed(res);
  } catch (error) {
    showError(protectedEl, error);
  }
  return res;
}

export function showError(container, error) {
  console.error("[real-imtihonlar]", error);
  const notEnabled = error?.code === "not-enabled";
  const notFound = error?.code === "not-found";
  const box = document.createElement("div");
  box.className = "of-card rx-state";
  box.setAttribute("role", "status");
  box.innerHTML = `<span class="rx-state__icon" aria-hidden="true">${ic(notEnabled ? "info" : "alert")}</span>
    <h2>${notEnabled ? "Real imtihonlar tez orada" : notFound ? "Ma’lumot topilmadi" : "Yuklab bo‘lmadi"}</h2>
    <p>${notEnabled ? "Bo‘lim tayyorlanmoqda. E’lon qilinganda shu sahifada paydo bo‘ladi."
      : notFound ? "So‘ralgan imtihon yoki savol mavjud emas." : "Iltimos, keyinroq qayta urinib ko‘ring."}</p>
    <a class="of-btn of-btn--ghost" href="./">${ic("chevronLeft")}Real imtihonlar</a>`;
  container.replaceChildren(box);
}
