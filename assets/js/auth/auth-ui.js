// ==========================================================================
// OliyFizika.uz — Kirish / Ro'yxatdan o'tish oynasi (UI)
// Mantiq auth-service.js da; bu fayl faqat interfeys va qadamlar oqimi.
//
// Ko'rinishlar: login · reset · register (1) · verify (2) · password (3)
// ==========================================================================

import { icon } from "../ui/icons.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/feedback.js";
import { onSession, getSessionState, isProfileComplete } from "../core/session.js";
import {
  validateName, validateEmail, passwordStatus, PASSWORD_RULES,
  startRegistration, resendRegistrationLink, resendAvailableIn, getPendingRegistration, clearPendingRegistration,
  finishRegistration, onRegistrationCompleteElsewhere,
  loginWithPassword, loginWithGoogle, sendPasswordReset,
  takePendingDestination, setPendingDestination, authErrorMessage,
} from "./auth-service.js";

const ROOT = new URL("../../../", import.meta.url);

const GOOGLE_LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --------------------------------------------------------------------------
// Kichik UI yordamchilar
// --------------------------------------------------------------------------
function field({ id, label, type = "text", autocomplete, value = "", placeholder = "", inputmode }) {
  return `
    <div class="of-field">
      <label class="of-label" for="${id}">${label}</label>
      <input class="of-input" id="${id}" name="${id}" type="${type}" value="${esc(value)}"
        ${autocomplete ? `autocomplete="${autocomplete}"` : ""} ${placeholder ? `placeholder="${esc(placeholder)}"` : ""}
        ${inputmode ? `inputmode="${inputmode}"` : ""} aria-describedby="${id}-err" spellcheck="false">
      <p class="of-field-error" id="${id}-err" role="alert"></p>
    </div>`;
}

function passwordField({ id, label, autocomplete = "new-password", describedBy = "" }) {
  const described = `${id}-err ${describedBy}`.trim();
  return `
    <div class="of-field">
      <label class="of-label" for="${id}">${label}</label>
      <div class="of-input-wrap">
        <input class="of-input" id="${id}" name="${id}" type="password" autocomplete="${autocomplete}"
          aria-describedby="${described}" spellcheck="false" autocapitalize="off">
        <button type="button" class="of-icon-btn of-input-action" data-toggle-pw="${id}" aria-controls="${id}"
          aria-pressed="false" aria-label="Parolni ko‘rsatish">${icon("eye")}</button>
      </div>
      <p class="of-field-error" id="${id}-err" role="alert"></p>
    </div>`;
}

function bindPasswordToggles(root) {
  root.querySelectorAll("[data-toggle-pw]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = root.querySelector(`#${btn.dataset.togglePw}`);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Parolni yashirish" : "Parolni ko‘rsatish");
      btn.innerHTML = icon(show ? "eyeOff" : "eye");
      input.focus({ preventScroll: true });
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch { /* ignore */ }
    });
  });
}

function setFieldError(root, id, message) {
  const input = root.querySelector(`#${id}`);
  const err = root.querySelector(`#${id}-err`);
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
  if (err) err.textContent = message || "";
  return !message;
}

function showAlert(root, message, type = "error") {
  const box = root.querySelector("[data-alert]");
  if (!box) return;
  if (!message) { box.hidden = true; box.textContent = ""; return; }
  box.hidden = false;
  box.className = `of-alert ${type === "success" ? "of-alert--success" : type === "info" ? "" : "of-alert--error"}`;
  box.innerHTML = `${icon(type === "success" ? "checkCircle" : type === "info" ? "info" : "alert")}<span></span>`;
  box.querySelector("span").textContent = message;
}

function setLoading(button, loading) {
  if (!button) return;
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
  button.setAttribute("aria-busy", String(loading));
}

function steps(current) {
  const names = ["Ma’lumotlar", "Tasdiqlash", "Parol"];
  return `<ol class="of-steps" aria-label="Ro‘yxatdan o‘tish bosqichlari">${names
    .map((n, i) => {
      const state = i + 1 < current ? "done" : i + 1 === current ? "current" : "todo";
      return `<li data-state="${state}" ${state === "current" ? 'aria-current="step"' : ""}>${i + 1}. ${n}</li>`;
    })
    .join("")}</ol>`;
}

function focusFirst(root) {
  requestAnimationFrame(() => root.querySelector("input:not([type=hidden]), button.of-btn--primary")?.focus({ preventScroll: true }));
}

function formatWait(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// --------------------------------------------------------------------------
// Muvaffaqiyatli kirishdan keyin — asl so'ralgan bo'limga qaytish
// --------------------------------------------------------------------------
export function goToDestination({ fallback = null } = {}) {
  const dest = takePendingDestination() || fallback;
  if (dest && dest !== location.href) {
    location.assign(dest);
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// 3-qadam: parol yaratish (dialog va tasdiqlash sahifasida umumiy)
// --------------------------------------------------------------------------
export function renderPasswordStep(container, { reg, onDone, showSteps = true }) {
  const needNames = !reg?.firstName || !reg?.lastName;
  const pw = nextId("pw");
  const pw2 = nextId("pw2");
  const rulesId = nextId("rules");
  const fn = nextId("fn");
  const ln = nextId("ln");

  container.innerHTML = `
    ${showSteps ? steps(3) : ""}
    <p class="of-auth__subtitle">Email tasdiqlandi. Endi hisobingiz uchun xavfsiz parol yarating.</p>
    <form class="of-auth__form" novalidate>
      ${needNames ? `<div class="of-auth__row">
          ${field({ id: fn, label: "Ism", autocomplete: "given-name", value: reg?.firstName || "" })}
          ${field({ id: ln, label: "Familiya", autocomplete: "family-name", value: reg?.lastName || "" })}
        </div>` : ""}
      ${passwordField({ id: pw, label: "Parol", describedBy: rulesId })}
      <ul class="of-pw-rules" id="${rulesId}" aria-label="Parol talablari">
        ${PASSWORD_RULES.map((r) => `<li data-rule="${r.id}" data-ok="false">${icon("close")}<span>${r.label}</span><span class="of-sr-only" data-sr>— bajarilmagan</span></li>`).join("")}
      </ul>
      ${passwordField({ id: pw2, label: "Parolni takrorlang" })}
      <p class="of-pw-match" data-match aria-live="polite"></p>
      <div class="of-alert of-alert--error" data-alert role="alert" hidden></div>
      <button type="submit" class="of-btn of-btn--primary of-btn--lg of-btn--block" disabled>Hisobni yaratish</button>
    </form>`;

  const form = container.querySelector("form");
  const submit = form.querySelector("[type=submit]");
  const p1 = form.querySelector(`#${pw}`);
  const p2 = form.querySelector(`#${pw2}`);
  const matchEl = form.querySelector("[data-match]");
  bindPasswordToggles(form);

  const update = () => {
    const status = passwordStatus(p1.value);
    status.rules.forEach((r) => {
      const li = form.querySelector(`[data-rule="${r.id}"]`);
      if (li.dataset.ok === String(r.ok)) return;
      li.dataset.ok = String(r.ok);
      li.firstElementChild.outerHTML = icon(r.ok ? "checkCircle" : "close");
      li.querySelector("[data-sr]").textContent = r.ok ? "— bajarildi" : "— bajarilmagan";
    });
    const matches = p2.value.length > 0 && p1.value === p2.value;
    if (!p2.value) { matchEl.textContent = ""; delete matchEl.dataset.ok; }
    else { matchEl.dataset.ok = String(matches); matchEl.textContent = matches ? "✓ Parollar mos keladi" : "✗ Parollar mos emas"; }
    submit.disabled = !(status.valid && matches);
    return status.valid && matches;
  };
  p1.addEventListener("input", update);
  p2.addEventListener("input", update);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showAlert(form, "");
    let firstName = reg?.firstName;
    let lastName = reg?.lastName;
    if (needNames) {
      firstName = form.querySelector(`#${fn}`).value;
      lastName = form.querySelector(`#${ln}`).value;
      const ok1 = setFieldError(form, fn, validateName(firstName, "Ism"));
      const ok2 = setFieldError(form, ln, validateName(lastName, "Familiya"));
      if (!ok1 || !ok2) return;
    }
    if (!update()) return;
    setLoading(submit, true);
    try {
      await finishRegistration({ password: p1.value, firstName, lastName });
      onDone?.();
    } catch (error) {
      showAlert(form, authErrorMessage(error));
      // Havola bosilganidan beri ko'p vaqt o'tgan bo'lsa Firebase qayta tasdiqlashni talab qiladi
      if (error?.code === "auth/requires-recent-login" && getPendingRegistration() && !form.querySelector("[data-relink]")) {
        const relink = document.createElement("button");
        relink.type = "button";
        relink.className = "of-btn of-btn--soft of-btn--block";
        relink.dataset.relink = "";
        relink.textContent = "Yangi tasdiqlash havolasini yuborish";
        relink.addEventListener("click", async () => {
          setLoading(relink, true);
          try {
            await resendRegistrationLink();
            showAlert(form, "Yangi havola yuborildi. Uni bosing — parol yaratish shu yerdan davom etadi.", "success");
            relink.remove();
          } catch (e) {
            showAlert(form, e?.code === "of/cooldown" ? `Qayta yuborish uchun ${formatWait(e.wait)} kuting.` : authErrorMessage(e));
            setLoading(relink, false);
          }
        });
        submit.before(relink);
      }
    } finally {
      setLoading(submit, false);
      update();
    }
  });
  focusFirst(form);
}

// --------------------------------------------------------------------------
// Dialog
// --------------------------------------------------------------------------
let current = null;

/**
 * Kirish oynasini ochadi.
 * @param {"login"|"register"|"reset"|"verify"|"password"} view
 * @param {{ destination?: string, onClose?: (reason:string)=>void }} [opts]
 */
export function openAuthDialog(view = "login", opts = {}) {
  if (opts.destination) setPendingDestination(opts.destination);

  // Tugallanmagan ro'yxatdan o'tish bo'lsa — davom ettiramiz
  const reg = getPendingRegistration();
  const s = getSessionState();
  if (view === "register" && reg) view = "verify";
  if (s.status === "authenticated" && s.profileLoaded && s.user?.emailVerified && reg && !isProfileComplete(s.profile)) view = "password";

  if (current) {
    current.show(view);
    return current;
  }

  const body = document.createElement("div");
  let succeeded = false;
  let offElsewhere = null;
  let cleanup = [];

  const modal = openModal({
    title: "",
    className: "of-auth",
    content: body,
    onClose: (reason) => {
      offElsewhere?.();
      cleanup.forEach((fn) => fn());
      cleanup = [];
      current = null;
      opts.onClose?.(succeeded ? "success" : reason);
    },
  });
  const titleEl = modal.dialog.querySelector(".of-modal__title");

  const finish = (message) => {
    succeeded = true;
    toast(message);
    modal.close("success");
    goToDestination();
  };

  function show(next) {
    cleanup.forEach((fn) => fn());
    cleanup = [];
    ({ login, register, reset, verify, password }[next] || login)();
  }

  // ---------------- login ----------------
  function login() {
    titleEl.textContent = "Kirish";
    const email = nextId("email");
    const pw = nextId("pw");
    body.innerHTML = `
      <p class="of-auth__subtitle">Hisobingizga email va parol orqali kiring.</p>
      <form class="of-auth__form" novalidate>
        ${field({ id: email, label: "Email", type: "email", autocomplete: "email", inputmode: "email", placeholder: "siz@example.com" })}
        ${passwordField({ id: pw, label: "Parol", autocomplete: "current-password" })}
        <div class="of-auth__between"><span></span><button type="button" class="of-link-btn" data-go="reset">Parolni unutdingizmi?</button></div>
        <div class="of-alert of-alert--error" data-alert role="alert" hidden></div>
        <button type="submit" class="of-btn of-btn--primary of-btn--lg of-btn--block">Kirish</button>
        <div class="of-auth__divider">yoki</div>
        <button type="button" class="of-btn of-btn--lg of-btn--block of-google-btn" data-google>${GOOGLE_LOGO}Google bilan davom etish</button>
      </form>
      <p class="of-auth__foot">Hisobingiz yo‘qmi? <button type="button" data-go="register">Ro‘yxatdan o‘tish</button></p>`;
    const form = body.querySelector("form");
    bindPasswordToggles(form);
    bindCommon();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showAlert(form, "");
      const e = form.querySelector(`#${email}`).value;
      const p = form.querySelector(`#${pw}`).value;
      const okE = setFieldError(form, email, validateEmail(e));
      const okP = setFieldError(form, pw, p ? "" : "Parolni kiriting.");
      if (!okE || !okP) return;
      const btn = form.querySelector("[type=submit]");
      setLoading(btn, true);
      try {
        await loginWithPassword(e, p);
        finish("Xush kelibsiz!");
      } catch (error) {
        showAlert(form, authErrorMessage(error));
        setLoading(btn, false);
      }
    });
    focusFirst(form);
  }

  // ---------------- reset ----------------
  function reset() {
    titleEl.textContent = "Parolni tiklash";
    const email = nextId("email");
    body.innerHTML = `
      <p class="of-auth__subtitle">Email manzilingizni kiriting — parolni tiklash havolasini yuboramiz.</p>
      <form class="of-auth__form" novalidate>
        ${field({ id: email, label: "Email", type: "email", autocomplete: "email", inputmode: "email" })}
        <div class="of-alert of-alert--error" data-alert role="alert" hidden></div>
        <button type="submit" class="of-btn of-btn--primary of-btn--lg of-btn--block">Havolani yuborish</button>
      </form>
      <p class="of-auth__foot"><button type="button" data-go="login">← Kirishga qaytish</button></p>`;
    const form = body.querySelector("form");
    bindCommon();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const e = form.querySelector(`#${email}`).value;
      if (!setFieldError(form, email, validateEmail(e))) return;
      const btn = form.querySelector("[type=submit]");
      setLoading(btn, true);
      try {
        await sendPasswordReset(e);
        // Email mavjudligini oshkor qilmaslik uchun har doim bir xil javob
        showAlert(form, "Agar bu email bilan hisob mavjud bo‘lsa, parolni tiklash havolasi yuborildi. Pochtangizni tekshiring.", "success");
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          showAlert(form, "Agar bu email bilan hisob mavjud bo‘lsa, parolni tiklash havolasi yuborildi. Pochtangizni tekshiring.", "success");
        } else {
          showAlert(form, authErrorMessage(error));
        }
      } finally {
        setLoading(btn, false);
      }
    });
    focusFirst(form);
  }

  // ---------------- register (1) ----------------
  function register(prefill = getPendingRegistration() || {}) {
    titleEl.textContent = "Ro‘yxatdan o‘tish";
    const fn = nextId("fn");
    const ln = nextId("ln");
    const email = nextId("email");
    body.innerHTML = `
      ${steps(1)}
      <p class="of-auth__subtitle">Ma’lumotlaringizni kiriting. Emailingizga tasdiqlash havolasini yuboramiz.</p>
      <form class="of-auth__form" novalidate>
        <div class="of-auth__row">
          ${field({ id: fn, label: "Ism", autocomplete: "given-name", value: prefill.firstName || "" })}
          ${field({ id: ln, label: "Familiya", autocomplete: "family-name", value: prefill.lastName || "" })}
        </div>
        ${field({ id: email, label: "Email", type: "email", autocomplete: "email", inputmode: "email", placeholder: "siz@example.com", value: prefill.email || "" })}
        <div class="of-alert of-alert--error" data-alert role="alert" hidden></div>
        <button type="submit" class="of-btn of-btn--primary of-btn--lg of-btn--block">Davom etish</button>
        <div class="of-auth__divider">yoki</div>
        <button type="button" class="of-btn of-btn--lg of-btn--block of-google-btn" data-google>${GOOGLE_LOGO}Google bilan davom etish</button>
      </form>
      <p class="of-auth__foot">Hisobingiz bormi? <button type="button" data-go="login">Kirish</button></p>`;
    const form = body.querySelector("form");
    bindCommon();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showAlert(form, "");
      const data = {
        firstName: form.querySelector(`#${fn}`).value,
        lastName: form.querySelector(`#${ln}`).value,
        email: form.querySelector(`#${email}`).value,
      };
      const ok = [
        setFieldError(form, fn, validateName(data.firstName, "Ism")),
        setFieldError(form, ln, validateName(data.lastName, "Familiya")),
        setFieldError(form, email, validateEmail(data.email)),
      ].every(Boolean);
      if (!ok) {
        form.querySelector("[aria-invalid=true]")?.focus();
        return;
      }
      const btn = form.querySelector("[type=submit]");
      setLoading(btn, true);
      try {
        await startRegistration(data);
        verify();
      } catch (error) {
        showAlert(form, authErrorMessage(error));
        setLoading(btn, false);
      }
    });
    focusFirst(form);
  }

  // ---------------- verify (2) ----------------
  function verify() {
    const reg = getPendingRegistration();
    if (!reg) return register({});
    titleEl.textContent = "Emailingizni tasdiqlang";
    body.innerHTML = `
      ${steps(2)}
      <div class="of-verify">
        <div class="of-verify__icon">${icon("mail")}</div>
        <p class="of-verify__email">${esc(reg.email)}</p>
        <p class="of-verify__text">Email manzilingizga tasdiqlash havolasi yuborildi. Emailingizni oching va tasdiqlash havolasini bosing.</p>
        <div class="of-alert" data-alert role="status" hidden></div>
        <div class="of-verify__actions">
          <button type="button" class="of-btn of-btn--soft of-btn--lg of-btn--block" data-resend>Emailni qayta yuborish</button>
          <button type="button" class="of-btn of-btn--ghost of-btn--block" data-change>Emailni o‘zgartirish</button>
        </div>
        <p class="of-verify__waiting" aria-live="polite">Tasdiqlash kutilmoqda — havolani bosganingizdan so‘ng davom etamiz</p>
        <p class="of-verify__hint">Xat kelmadimi? “Spam” yoki “Reklama” papkasini tekshiring.</p>
      </div>`;

    const resendBtn = body.querySelector("[data-resend]");
    let timer = null;
    const tick = () => {
      const wait = resendAvailableIn();
      resendBtn.disabled = wait > 0;
      resendBtn.textContent = wait > 0 ? `Emailni qayta yuborish (${formatWait(wait)})` : "Emailni qayta yuborish";
      if (wait <= 0) { clearInterval(timer); timer = null; }
    };
    const startTimer = () => { tick(); if (!timer) timer = setInterval(tick, 1000); };
    startTimer();
    cleanup.push(() => clearInterval(timer));

    resendBtn.addEventListener("click", async () => {
      showAlert(body, "");
      setLoading(resendBtn, true);
      try {
        await resendRegistrationLink();
        showAlert(body, "Yangi tasdiqlash havolasi yuborildi. Eng so‘nggi xatdagi havoladan foydalaning.", "success");
      } catch (error) {
        showAlert(body, error?.code === "of/cooldown" ? `Qayta yuborish uchun ${formatWait(error.wait)} kuting.` : authErrorMessage(error));
      } finally {
        setLoading(resendBtn, false);
        startTimer();
      }
    });

    body.querySelector("[data-change]").addEventListener("click", () => {
      const prev = getPendingRegistration();
      clearPendingRegistration();
      register({ firstName: prev?.firstName, lastName: prev?.lastName, email: "" });
      requestAnimationFrame(() => body.querySelector("input[type=email]")?.focus());
    });

    // Havola boshqa tabda bosilsa — Firebase sessiyasi shu tabga ham keladi
    const off = onSession((s) => {
      if (s.status !== "authenticated" || !s.user?.emailVerified) return;
      if ((s.user.email || "").toLowerCase() !== reg.email) return;
      if (!s.profileLoaded) return; // profil hali o'qilmoqda
      if (isProfileComplete(s.profile)) {
        clearPendingRegistration();
        finish("Bu email bilan hisobingiz allaqachon mavjud edi — tizimga kirdingiz.");
      } else {
        password();
      }
    });
    cleanup.push(off);
    focusFirst(body);
  }

  // ---------------- password (3) ----------------
  function password() {
    titleEl.textContent = "Parol yarating";
    renderPasswordStep(body, {
      reg: getPendingRegistration(),
      onDone: () => finish("Hisobingiz yaratildi. Xush kelibsiz!"),
    });
  }

  function bindCommon() {
    body.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));
    body.querySelectorAll("[data-google]").forEach((b) =>
      b.addEventListener("click", async () => {
        const form = b.closest("form") || body;
        showAlert(form, "");
        setLoading(b, true);
        try {
          const res = await loginWithGoogle();
          if (res?.redirected) return; // sahifa Google'ga o'tadi
          clearPendingRegistration();
          finish("Xush kelibsiz!");
        } catch (error) {
          if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error?.code)) {
            showAlert(form, authErrorMessage(error));
          }
          setLoading(b, false);
        }
      })
    );
  }

  // Boshqa tabda (tasdiqlash sahifasida) ro'yxatdan o'tish yakunlansa
  offElsewhere = onRegistrationCompleteElsewhere(() => {
    if (current) finish("Hisobingiz yaratildi. Xush kelibsiz!");
  });

  current = { show, close: modal.close };
  show(view);
  return current;
}

export function closeAuthDialog() {
  current?.close("api");
}

export { ROOT as AUTH_ROOT };
