// ==========================================================================
// Sozlamalar sahifasi (dashboard/settings.html) — OliyFizika 2.0.
//
// XAVFSIZLIK QOIDALARI:
// - O'qish: faqat session.js dagi bitta users/{uid} o'qishi (joriy foydalanuvchi). Results so'rovi yo'q.
// - Profil yozish: faqat maydon darajasida updateDoc({ firstName, lastName, fullName }).
//   email, phone, xp, level, fullAccess, mockTestsAccess, createdAt, uid — HECH QACHON yozilmaydi.
//   Hujjat umuman bo'lmasa — mavjud ensureUserProfile() (faqat yo'q maydonlarni to'ldiradi).
// - Parol: faqat Firebase Auth (mavjud changePassword: reauthenticate + updatePassword). Firestore'ga yozilmaydi.
//   Faqat Google orqali kiradiganlar uchun forma o'rniga izoh (provayderlar o'zgartirilmaydi).
// - Mavzu: mavjud prefs.js (localStorage "oliyfizika:theme").
// - Chiqish: qobiqdagi mavjud [data-logout] ishlovchisi (signOutUser + bildirishnoma keshi + yo'naltirish).
// ==========================================================================

import { onSession, refreshProfile, loadFirebase, getSessionState } from "../core/session.js";
import { getThemePref, setThemePref } from "../core/prefs.js";
import {
  validateName, normalizeName, passwordStatus, PASSWORD_RULES,
  changePassword, sendPasswordReset, ensureUserProfile, authErrorMessage,
} from "../auth/auth-service.js";
import { icon } from "../ui/icons.js";
import { toast } from "../ui/feedback.js";
import { $, $$, fillIcons, splitName, providers } from "./account-common.js";

const page = $("#settingsPage");
fillIcons(page);

// --------------------------------------------------------------------------
// Umumiy UI yordamchilar
// --------------------------------------------------------------------------
function setFieldError(input, message) {
  const err = document.getElementById(`${input.id}-err`);
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (err) err.textContent = message || "";
  return !message;
}

function setMessage(box, message, type = "success") {
  if (!box) return;
  if (!message) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  box.className = `of-alert ${type === "success" ? "of-alert--success" : type === "info" ? "" : "of-alert--error"}`;
  box.setAttribute("role", type === "error" ? "alert" : "status");
  box.innerHTML = `${icon(type === "success" ? "checkCircle" : type === "info" ? "info" : "alert")}<span></span>`;
  box.querySelector("span").textContent = message;
}

function setLoading(button, loading) {
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
  button.setAttribute("aria-busy", String(loading));
}

// --------------------------------------------------------------------------
// ACCOUNT → Profil (Ism, Familiya; Email faqat ko'rish uchun)
// --------------------------------------------------------------------------
const form = $("#profileForm");
const firstInput = $("#setFirstName");
const lastInput = $("#setLastName");
const emailInput = $("#setEmail");
const saveBtn = $("#profileSave");
const profileMsg = $("[data-profile-msg]");
let profileFilledFor = null; // uid — forma faqat bir marta to'ldiriladi (yozayotgan matn o'chmasin)
let saving = false;

function fillProfileForm(state) {
  const { firstName, lastName } = splitName(state.profile, state.user);
  firstInput.value = firstName;
  lastInput.value = lastName;
  emailInput.value = state.user?.email || state.profile?.email || "";
  [firstInput, lastInput].forEach((i) => { i.disabled = false; setFieldError(i, ""); });
  saveBtn.disabled = false;
  form.setAttribute("aria-busy", "false");
}

function resetProfileForm() {
  profileFilledFor = null;
  firstInput.value = ""; lastInput.value = ""; emailInput.value = "";
  [firstInput, lastInput].forEach((i) => { i.disabled = true; setFieldError(i, ""); });
  saveBtn.disabled = true;
  form.setAttribute("aria-busy", "true");
  setMessage(profileMsg, "");
}

[firstInput, lastInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") setFieldError(input, "");
    setMessage(profileMsg, "");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saving) return; // ikki marta yuborishning oldini olish
  const state = getSessionState();
  if (state.status !== "authenticated" || !state.user) return;

  const firstName = normalizeName(firstInput.value);
  const lastName = normalizeName(lastInput.value);
  const okFirst = setFieldError(firstInput, validateName(firstName, "Ism"));
  const okLast = setFieldError(lastInput, validateName(lastName, "Familiya"));
  if (!okFirst || !okLast) {
    (okFirst ? lastInput : firstInput).focus();
    setMessage(profileMsg, "");
    return;
  }

  const fullName = `${firstName} ${lastName}`;
  const current = state.profile;
  if (current && current.firstName === firstName && current.lastName === lastName && current.fullName === fullName) {
    setMessage(profileMsg, "O‘zgarish yo‘q — ma’lumotlar allaqachon saqlangan.", "info");
    return;
  }

  saving = true;
  setLoading(saveBtn, true);
  setMessage(profileMsg, "");
  try {
    if (current) {
      // Faqat shu uch maydon — boshqa hech narsa yozilmaydi (field-level update).
      const fb = await loadFirebase();
      const { doc, updateDoc } = fb.fsSdk;
      await updateDoc(doc(fb.db, "users", state.user.uid), { firstName, lastName, fullName });
    } else {
      // Hujjat yo'q (eski/yarim hisob): mavjud xavfsiz yaratuvchi — faqat yo'q maydonlarni to'ldiradi.
      await ensureUserProfile(state.user, { fullName, firstName, lastName });
    }
    await refreshProfile(); // header va sahifadagi ism yangilanadi
    firstInput.value = firstName;
    lastInput.value = lastName;
    setMessage(profileMsg, "Ma’lumotlar saqlandi.", "success");
  } catch (error) {
    setMessage(profileMsg, authErrorMessage(error, "Ma’lumotlarni saqlashda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring."), "error");
  } finally {
    saving = false;
    setLoading(saveBtn, false);
  }
});

// --------------------------------------------------------------------------
// ACCOUNT → Parol (faqat Firebase Auth)
// --------------------------------------------------------------------------
const securityBox = $("[data-security]");
let securityMode = null; // "password" | "google" | "unknown"

function pwField(id, label, autocomplete, extraDescribedBy = "") {
  return `
    <div class="of-field">
      <label class="of-label" for="${id}">${label}</label>
      <div class="of-input-wrap">
        <input class="of-input" id="${id}" type="password" autocomplete="${autocomplete}" spellcheck="false" autocapitalize="off"
          aria-describedby="${`${id}-err ${extraDescribedBy}`.trim()}">
        <button type="button" class="of-icon-btn of-input-action" data-toggle-pw="${id}" aria-controls="${id}"
          aria-pressed="false" aria-label="Parolni ko‘rsatish">${icon("eye")}</button>
      </div>
      <p class="of-field-error" id="${id}-err" role="alert"></p>
    </div>`;
}

function renderPasswordForm(email) {
  securityBox.innerHTML = `
    <form class="of-acc-form" id="passwordForm" novalidate>
      <input type="email" autocomplete="username" value="" hidden aria-hidden="true" tabindex="-1" data-username>
      ${pwField("pwCurrent", "Joriy parol", "current-password")}
      ${pwField("pwNew", "Yangi parol", "new-password", "pwRules")}
      <ul class="of-pw-rules" id="pwRules" aria-label="Parol talablari">
        ${PASSWORD_RULES.map((r) => `<li data-rule="${r.id}" data-ok="false">${icon("check")}<span>${r.label}</span><span class="of-sr-only" data-rule-state> — bajarilmagan</span></li>`).join("")}
      </ul>
      ${pwField("pwConfirm", "Yangi parolni takrorlang", "new-password", "pwMatch")}
      <p class="of-pw-match" id="pwMatch" aria-live="polite"></p>
      <div class="of-alert" data-pw-msg role="status" hidden></div>
      <div class="of-acc-form__foot">
        <button type="submit" class="of-btn of-btn--primary" id="pwSave">Parolni o‘zgartirish</button>
        <button type="button" class="of-link-btn of-acc-forgot" data-pw-reset>Parolni unutdingizmi?</button>
      </div>
    </form>`;
  securityBox.querySelector("[data-username]").value = email || "";
  bindPasswordForm(email);
}

function renderGoogleOnly() {
  securityBox.innerHTML = `
    <div class="of-alert of-acc-note" role="note">
      ${icon("info")}
      <div>
        <p><strong>Siz Google hisobi orqali kirasiz.</strong></p>
        <p>Parolingiz Google hisobingizda boshqariladi, shu sababli OliyFizika.uz’da parol o‘rnatilmagan.
           Parolni Google hisobingiz sozlamalarida o‘zgartirishingiz mumkin.</p>
        <a class="of-acc-link" href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Google hisobi xavfsizligi ${icon("external")}<span class="of-sr-only"> (yangi oynada)</span></a>
      </div>
    </div>`;
}

function renderSecurity(state) {
  const p = providers(state.user);
  const mode = p.hasPassword ? "password" : p.googleOnly ? "google" : "unknown";
  if (mode === securityMode) return;
  securityMode = mode;
  securityBox.setAttribute("aria-busy", "false");
  if (mode === "password") renderPasswordForm(state.user.email);
  else if (mode === "google") renderGoogleOnly();
  else securityBox.innerHTML = `<p class="of-muted">Bu hisob uchun parolni o‘zgartirish mavjud emas.</p>`;
}

function resetSecurity() {
  securityMode = null;
  securityBox.setAttribute("aria-busy", "true");
  securityBox.innerHTML = '<span class="of-skeleton of-skeleton--text"></span>';
}

function bindPasswordForm(email) {
  const pwForm = $("#passwordForm");
  const cur = $("#pwCurrent");
  const next = $("#pwNew");
  const conf = $("#pwConfirm");
  const match = $("#pwMatch");
  const msg = $("[data-pw-msg]", pwForm);
  const btn = $("#pwSave");
  const resetBtn = $("[data-pw-reset]", pwForm);
  let busy = false;

  $$("[data-toggle-pw]", pwForm).forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.togglePw);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Parolni yashirish" : "Parolni ko‘rsatish");
      toggle.innerHTML = icon(show ? "eyeOff" : "eye");
      input.focus({ preventScroll: true });
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch { /* ignore */ }
    });
  });

  const updateRules = () => {
    const status = passwordStatus(next.value);
    status.rules.forEach((r) => {
      const li = pwForm.querySelector(`[data-rule="${r.id}"]`);
      li.dataset.ok = String(r.ok);
      li.querySelector("[data-rule-state]").textContent = r.ok ? " — bajarildi" : " — bajarilmagan";
    });
    return status.valid;
  };
  const updateMatch = () => {
    if (!conf.value) { match.textContent = ""; delete match.dataset.ok; return false; }
    const same = conf.value === next.value;
    match.dataset.ok = String(same);
    match.textContent = same ? "Parollar mos keldi." : "Parollar mos kelmadi.";
    return same;
  };

  [cur, next, conf].forEach((input) => input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") setFieldError(input, "");
    setMessage(msg, "");
    if (input !== cur) { updateRules(); updateMatch(); }
  }));

  pwForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    setMessage(msg, "");
    const okCur = setFieldError(cur, cur.value ? "" : "Joriy parolni kiriting.");
    let newErr = "";
    if (!next.value) newErr = "Yangi parolni kiriting.";
    else if (!updateRules()) newErr = "Parol talablarga javob bermaydi.";
    else if (next.value === cur.value) newErr = "Yangi parol joriy paroldan farq qilishi kerak.";
    const okNew = setFieldError(next, newErr);
    const okConf = setFieldError(conf, !conf.value ? "Yangi parolni takrorlang." : !updateMatch() ? "Parollar mos kelmadi." : "");
    if (!okCur || !okNew || !okConf) {
      (!okCur ? cur : !okNew ? next : conf).focus();
      return;
    }

    busy = true;
    setLoading(btn, true);
    try {
      await changePassword(cur.value, next.value); // Firebase Auth: reauthenticate + updatePassword
      [cur, next, conf].forEach((i) => { i.value = ""; i.type = "password"; setFieldError(i, ""); });
      $$("[data-toggle-pw]", pwForm).forEach((t) => { t.setAttribute("aria-pressed", "false"); t.setAttribute("aria-label", "Parolni ko‘rsatish"); t.innerHTML = icon("eye"); });
      updateRules(); updateMatch();
      setMessage(msg, "Parol muvaffaqiyatli o‘zgartirildi.", "success");
      toast("Parol muvaffaqiyatli o‘zgartirildi.");
    } catch (error) {
      const code = error?.code;
      if (["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials"].includes(code)) {
        setFieldError(cur, "Joriy parol noto‘g‘ri.");
        cur.focus();
      } else if (code === "auth/weak-password") {
        setFieldError(next, "Parol talablarga javob bermaydi.");
        next.focus();
      } else if (code === "auth/requires-recent-login") {
        console.error("[settings]", error);
        setMessage(msg, "Xavfsizlik uchun hisobdan chiqib, qayta kiring va parolni yana o‘zgartirib ko‘ring.", "error");
      } else {
        setMessage(msg, authErrorMessage(error, "Parolni o‘zgartirib bo‘lmadi. Iltimos, qayta urinib ko‘ring."), "error");
      }
    } finally {
      busy = false;
      setLoading(btn, false);
    }
  });

  // Parolni unutgan bo'lsa — mavjud tiklash xati (Firebase Auth), faqat joriy email'ga
  let resetBusy = false;
  resetBtn.addEventListener("click", async () => {
    if (resetBusy || !email) return;
    resetBusy = true;
    resetBtn.disabled = true;
    try {
      await sendPasswordReset(email);
      setMessage(msg, `Parolni tiklash havolasi ${email} manziliga yuborildi. Pochtangizni tekshiring.`, "success");
    } catch (error) {
      setMessage(msg, authErrorMessage(error, "Havolani yuborib bo‘lmadi. Iltimos, qayta urinib ko‘ring."), "error");
    } finally {
      // Takroriy yuborishni cheklash
      setTimeout(() => { resetBusy = false; resetBtn.disabled = false; }, 30000);
    }
  });
}

// --------------------------------------------------------------------------
// APPEARANCE → Mavzu (mavjud prefs.js, kalit o'zgarmaydi)
// --------------------------------------------------------------------------
const themeRadios = $$("[data-theme-group] input[name='theme']");
const syncTheme = () => {
  const pref = getThemePref();
  themeRadios.forEach((r) => { r.checked = r.value === pref; });
};
syncTheme();
themeRadios.forEach((r) => r.addEventListener("change", () => {
  if (r.checked) setThemePref(r.value);
}));
document.addEventListener("of:themechange", syncTheme);
window.addEventListener("storage", (e) => { if (e.key === "oliyfizika:theme") syncTheme(); });

// --------------------------------------------------------------------------
// SESSION → Chiqish (qobiqdagi mavjud ishlovchi aynan chaqiriladi)
// --------------------------------------------------------------------------
const logoutBtn = $("[data-session-logout]");
const sessionText = $("[data-session-text]");
logoutBtn.addEventListener("click", () => {
  const shellLogout = document.querySelector("#of-user-menu [data-logout]");
  if (!shellLogout) return;
  logoutBtn.disabled = true;
  logoutBtn.classList.add("is-loading");
  shellLogout.click();
});

// --------------------------------------------------------------------------
// Sessiya holati
// --------------------------------------------------------------------------
let hashHandled = false;
function focusHashSection() {
  if (hashHandled) return;
  const id = decodeURIComponent(location.hash.slice(1));
  if (!["profile", "security", "appearance", "session"].includes(id)) return;
  hashHandled = true;
  const section = document.getElementById(id);
  requestAnimationFrame(() => {
    section.scrollIntoView({ block: "start", behavior: "auto" });
    section.focus({ preventScroll: true });
  });
}
window.addEventListener("hashchange", () => { hashHandled = false; focusHashSection(); });

let slowTimer = null;
onSession((state) => {
  clearTimeout(slowTimer);
  if (state.status === "loading") return;
  if (state.status !== "authenticated" || !state.user) {
    // Mehmon yoki chiqqan: shaxsiy ma'lumot DOM'da qoldirilmaydi
    resetProfileForm();
    resetSecurity();
    logoutBtn.disabled = true;
    sessionText.textContent = "Shu qurilmadagi sessiyangiz yakunlanadi.";
    return;
  }
  logoutBtn.disabled = false;
  logoutBtn.classList.remove("is-loading");
  sessionText.textContent = `Siz ${state.user.email || "hisobingiz"} bilan kirgansiz. Chiqsangiz, shu qurilmadagi sessiya yakunlanadi.`;
  renderSecurity(state);
  if (state.profileLoaded && profileFilledFor !== state.user.uid && !saving) {
    profileFilledFor = state.user.uid;
    setMessage(profileMsg, "");
    fillProfileForm(state);
  } else if (!state.profileLoaded) {
    // Profil o'qilmasa — forma yopiq qoladi, tushunarli xabar ko'rsatiladi
    slowTimer = setTimeout(() => setMessage(profileMsg, "Profil ma’lumotlarini yuklab bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.", "error"), 8000);
  }
  focusHashSection();
});
