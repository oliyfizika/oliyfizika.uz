// ==========================================================================
// auth/tasdiqlash.html — email havolasi bosilgandan keyingi sahifa
//   havola -> signInWithEmailLink (email tasdiqlandi) -> parol yaratish -> hisob -> asl bo'limga qaytish
// ==========================================================================

import { icon } from "../ui/icons.js";
import { whenReady, isProfileComplete, getSessionState } from "../core/session.js";
import {
  isEmailLink, completeEmailLink, getPendingRegistration, clearPendingRegistration,
  resendRegistrationLink, resendAvailableIn, validateEmail, safeDestination, takePendingDestination,
  authErrorMessage,
} from "./auth-service.js";
import { renderPasswordStep } from "./auth-ui.js";

const ROOT = new URL("../../../", import.meta.url);
const root = document.getElementById("verifyRoot");
const title = document.getElementById("verifyTitle");
const params = new URLSearchParams(location.search);

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function destination() {
  const fromParam = params.get("next") ? safeDestination(params.get("next")) : null;
  return fromParam || getPendingRegistration()?.next || takePendingDestination() || new URL("index.html", ROOT).href;
}

function setTitle(text) {
  title.textContent = text;
  document.title = `${text} | OliyFizika.uz`;
}

// ---------------- Ekranlar ----------------
function showSuccess(message, dest) {
  setTitle("Tayyor!");
  root.innerHTML = `
    <div class="of-verify">
      <div class="of-verify__icon of-verify__icon--ok">${icon("checkCircle")}</div>
      <p class="of-verify__text">${esc(message)}</p>
      <div class="of-verify__actions">
        <a class="of-btn of-btn--primary of-btn--lg of-btn--block" href="${esc(dest)}">Davom etish ${icon("arrowRight")}</a>
      </div>
      <p class="of-verify__waiting">Avtomatik yo‘naltirilmoqda…</p>
    </div>`;
  root.querySelector("a").focus();
  setTimeout(() => location.replace(dest), 1800);
}

function showError({ heading, message, allowResend = true, askEmail = false }) {
  setTitle(heading);
  const reg = getPendingRegistration();
  root.innerHTML = `
    <div class="of-verify">
      <div class="of-verify__icon of-verify__icon--error">${icon("alert")}</div>
      <p class="of-verify__text">${esc(message)}</p>
      <div class="of-alert" data-alert role="status" hidden></div>
      <div class="of-verify__actions">
        ${askEmail ? '<button type="button" class="of-btn of-btn--primary of-btn--lg of-btn--block" data-ask>Emailni kiritish</button>' : ""}
        ${allowResend && reg ? '<button type="button" class="of-btn of-btn--primary of-btn--lg of-btn--block" data-resend>Yangi havola yuborish</button>' : ""}
        <a class="of-btn of-btn--lg of-btn--block" href="${new URL(`index.html${reg ? "" : "?auth=register"}`, ROOT).href}">${reg ? "Bosh sahifaga qaytish" : "Qaytadan ro‘yxatdan o‘tish"}</a>
      </div>
    </div>`;

  root.querySelector("[data-ask]")?.addEventListener("click", () => askForEmail());
  const resend = root.querySelector("[data-resend]");
  if (resend) {
    const alertBox = root.querySelector("[data-alert]");
    const tick = () => {
      const wait = resendAvailableIn();
      resend.disabled = wait > 0;
      resend.textContent = wait > 0 ? `Yangi havola yuborish (${Math.ceil(wait / 1000)} s)` : "Yangi havola yuborish";
      return wait;
    };
    let timer = setInterval(() => { if (tick() <= 0) clearInterval(timer); }, 1000);
    tick();
    resend.addEventListener("click", async () => {
      resend.classList.add("is-loading");
      try {
        await resendRegistrationLink();
        alertBox.hidden = false;
        alertBox.className = "of-alert of-alert--success";
        alertBox.textContent = `Yangi tasdiqlash havolasi ${reg.email} manziliga yuborildi. Eng so‘nggi xatdagi havolani bosing.`;
      } catch (error) {
        alertBox.hidden = false;
        alertBox.className = "of-alert of-alert--error";
        alertBox.textContent = authErrorMessage(error);
      } finally {
        resend.classList.remove("is-loading");
        clearInterval(timer);
        timer = setInterval(() => { if (tick() <= 0) clearInterval(timer); }, 1000);
        tick();
      }
    });
  }
}

/** Havola boshqa qurilmada/brauzerda ochilgan — xavfsizlik uchun emailni so'raymiz (Firebase tavsiyasi). */
function askForEmail(prefill = "") {
  setTitle("Emailingizni tasdiqlang");
  root.innerHTML = `
    <p class="of-auth__subtitle">Xavfsizlik uchun ro‘yxatdan o‘tishda kiritgan email manzilingizni qayta kiriting.</p>
    <form class="of-auth__form" novalidate>
      <div class="of-field">
        <label class="of-label" for="confirmEmail">Email</label>
        <input class="of-input" id="confirmEmail" type="email" autocomplete="email" inputmode="email" value="${esc(prefill)}" aria-describedby="confirmEmail-err">
        <p class="of-field-error" id="confirmEmail-err" role="alert"></p>
      </div>
      <button type="submit" class="of-btn of-btn--primary of-btn--lg of-btn--block">Tasdiqlash</button>
    </form>`;
  const form = root.querySelector("form");
  const input = form.querySelector("input");
  input.focus();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const err = validateEmail(input.value);
    input.setAttribute("aria-invalid", err ? "true" : "false");
    form.querySelector("#confirmEmail-err").textContent = err;
    if (!err) complete(input.value);
  });
}

function showPasswordStep() {
  setTitle("Parol yarating");
  renderPasswordStep(root, {
    reg: getPendingRegistration(),
    showSteps: true,
    onDone: () => showSuccess("Hisobingiz yaratildi. Xush kelibsiz!", destination()),
  });
}

async function complete(email) {
  setTitle("Email tasdiqlanmoqda…");
  const dest = destination(); // reg o'chirilishidan oldin olamiz
  try {
    const { existingAccount } = await completeEmailLink(email);
    if (existingAccount) {
      clearPendingRegistration();
      showSuccess("Bu email bilan hisobingiz allaqachon mavjud — tizimga muvaffaqiyatli kirdingiz.", dest);
      return;
    }
    showPasswordStep();
  } catch (error) {
    const code = error?.code;
    if (code === "auth/invalid-email") {
      showError({
        heading: "Email mos kelmadi",
        message: "Bu havola boshqa email manzil uchun yuborilgan. Havola yuborilgan emailni kiriting yoki eng so‘nggi xatdagi havoladan foydalaning.",
        askEmail: true,
      });
    } else if (["auth/invalid-action-code", "auth/expired-action-code", "auth/argument-error"].includes(code)) {
      showError({
        heading: "Havola yaroqsiz",
        message: "Tasdiqlash havolasi eskirgan, allaqachon ishlatilgan yoki noto‘liq. Yangi havola so‘rang va eng so‘nggi xatdagi havolani bosing.",
      });
    } else {
      showError({ heading: "Tasdiqlab bo‘lmadi", message: authErrorMessage(error) });
    }
  }
}

// ---------------- Ishga tushirish ----------------
async function start() {
  let isLink = false;
  try {
    isLink = await isEmailLink(location.href);
  } catch (error) {
    showError({ heading: "Ulanishda xatolik", message: authErrorMessage(error), allowResend: false });
    return;
  }

  if (isLink) {
    const reg = getPendingRegistration();
    if (reg?.email) complete(reg.email);
    else askForEmail();
    return;
  }

  // Havolasiz ochilgan (masalan, parol bosqichida sahifa yangilangan)
  const s = await whenReady();
  if (s.status === "authenticated" && s.user?.emailVerified) {
    await new Promise((r) => {
      if (getSessionState().profileLoaded) return r();
      const t = setInterval(() => { if (getSessionState().profileLoaded) { clearInterval(t); r(); } }, 100);
      setTimeout(() => { clearInterval(t); r(); }, 5000);
    });
    if (!isProfileComplete(getSessionState().profile)) return showPasswordStep();
    return showSuccess("Siz allaqachon tizimdasiz.", destination());
  }
  showError({
    heading: "Havola topilmadi",
    message: "Bu sahifa email orqali yuborilgan tasdiqlash havolasi bilan ochiladi. Iltimos, xatdagi havolani bosing.",
  });
}

start();
