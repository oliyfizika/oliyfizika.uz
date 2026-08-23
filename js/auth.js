import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PENDING_DESTINATION_KEY = "oliyFizikaPendingDestination";

const PROTECTED_ACCESS_MESSAGE =
  "Ushbu bo‘limdan foydalanish uchun tizimga kiring yoki ro‘yxatdan o‘ting.";

// ==================================================
// FOYDALANUVCHI AKTIVLIGINI KUZATISH
// ==================================================

const ACTIVITY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 daqiqa

let activityInterval = null;

const AUTH_TEXT = {
  login: {
    title: "Kirish",
    subtitle: "Hisobingizga email va parol orqali kiring."
  },
  register: {
    title: "Ro'yxatdan o'tish",
    subtitle: "Yangi hisob yaratish uchun ma'lumotlaringizni kiriting."
  },
  reset: {
    title: "Parolni tiklash",
    subtitle: "Email manzilingizni kiriting, parolni tiklash havolasini yuboramiz."
  }
};

const ERROR_MESSAGES = {
  "auth/email-already-in-use": "Bu email bilan hisob allaqachon mavjud.",
  "auth/invalid-email": "Email manzil noto'g'ri kiritilgan.",
  "auth/invalid-credential": "Email yoki parol noto'g'ri.",
  "auth/missing-email": "Email manzilni kiriting.",
  "auth/missing-password": "Parolni kiriting.",
  "auth/network-request-failed":
    "Tarmoqda muammo yuz berdi. Internet aloqangizni tekshirib, qayta urinib ko'ring.",
  "auth/too-many-requests":
    "Juda ko'p urinish bo'ldi. Birozdan keyin qayta urinib ko'ring.",
  "auth/user-not-found": "Bunday email bilan hisob topilmadi.",
  "auth/weak-password":
    "Parol kamida 6 ta belgidan iborat bo'lishi kerak.",
  "auth/wrong-password": "Email yoki parol noto'g'ri."
};

let authNav;
let authModal;
let closeAuthModalButton;
let authTabs;
let authTitle;
let authSubtitle;
let authMessage;
let loginForm;
let passwordResetForm;
let registerForm;

function initAuth() {
  authNav = document.getElementById("authNav");
  authModal = document.getElementById("authModal");
  closeAuthModalButton = document.getElementById("closeAuthModal");
  authTabs = document.getElementById("authTabs");
  authTitle = document.getElementById("authTitle");
  authSubtitle = document.getElementById("authSubtitle");
  authMessage = document.getElementById("authMessage");
  loginForm = document.getElementById("loginForm");
  passwordResetForm = document.getElementById("passwordResetForm");
  registerForm = document.getElementById("registerForm");

  bindNavbarEvents();
  bindModalEvents();
  bindFormEvents();
  bindProtectedLinks();
  listenForAuthState();
}

function bindNavbarEvents() {
  if (!authNav) return;

  authNav.addEventListener("click", async (event) => {
    const loginButton = event.target.closest("#openLogin");
    const registerButton = event.target.closest("#openRegister");
    const menuButton = event.target.closest("#userMenuBtn");
    const menuAction = event.target.closest("[data-menu-action]");

    if (loginButton) {
      openAuthModal("login");
      return;
    }

    if (registerButton) {
      openAuthModal("register");
      return;
    }

    if (menuButton) {
      toggleUserMenu();
      return;
    }

    if (!menuAction) return;

    if (menuAction.dataset.menuAction === "logout") {
      await logoutUser();
      return;
    }

    if (menuAction.dataset.menuAction === "profile") {
      window.location.href = new URL(
        "../dashboard/profile.html",
        import.meta.url
      ).href;
      return;
    }

    if (menuAction.dataset.menuAction === "settings") {
      window.location.href = new URL(
        "../dashboard/settings.html",
        import.meta.url
      ).href;
      return;
    }

    closeUserMenu();
  });

  document.addEventListener("click", (event) => {
    if (!authNav.contains(event.target)) {
      closeUserMenu();
    }
  });
}

function bindModalEvents() {
  if (!authModal) return;

  authModal.addEventListener("click", (event) => {
    const switchButton = event.target.closest("[data-auth-switch]");

    if (switchButton) {
      setAuthView(switchButton.dataset.authSwitch);
      return;
    }

    if (event.target === authModal) {
      closeAuthModal();
    }
  });

  closeAuthModalButton?.addEventListener("click", closeAuthModal);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (authModal && !authModal.hidden) {
      closeAuthModal();
      return;
    }

    closeUserMenu();
  });
}

function bindFormEvents() {
  loginForm?.addEventListener("submit", loginUser);
  passwordResetForm?.addEventListener("submit", resetPassword);
  registerForm?.addEventListener("submit", registerUser);
}

function bindProtectedLinks() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-requires-auth='true']");

    if (!link || auth.currentUser) return;

    const destination = link.getAttribute("href");

    if (!destination || destination === "#") return;

    event.preventDefault();
    setPendingDestination(destination);
    openAuthModal("login", PROTECTED_ACCESS_MESSAGE);
  });
}

// ==================================================
// AUTH STATE
// ==================================================

function listenForAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      stopActivityTracking();
      renderGuestNavbar();
      return;
    }

    // Foydalanuvchi saytga kirgan zahoti aktivligini yozamiz
    await updateUserActivity(user.uid);

    // Keyingi aktivliklarni kuzatishni boshlaymiz
    startActivityTracking(user.uid);

    const profile = await getUserProfile(user.uid);
    renderAuthenticatedNavbar(user, profile);
  });
}

// ==================================================
// FOYDALANUVCHI AKTIVLIGI
// ==================================================

async function updateUserActivity(uid) {
  if (!uid) return;

  try {
    await setDoc(
      doc(db, "users", uid),
      {
        lastActiveAt: serverTimestamp()
      },
      {
        merge: true
      }
    );

    console.log("User activity updated:", uid);
  } catch (error) {
    console.error("Could not update user activity:", error);
  }
}

function startActivityTracking(uid) {
  // Agar oldingi interval mavjud bo'lsa, avval to'xtatamiz
  stopActivityTracking();

  // Har 5 daqiqada yangilash
  activityInterval = window.setInterval(() => {
    if (!auth.currentUser) {
      stopActivityTracking();
      return;
    }

    updateUserActivity(uid);
  }, ACTIVITY_UPDATE_INTERVAL);

  // Foydalanuvchi boshqa tabdan qaytganida yangilash
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Foydalanuvchi sahifaga qaytganda yangilash
  window.addEventListener("focus", handleWindowFocus);
}

function stopActivityTracking() {
  if (activityInterval !== null) {
    window.clearInterval(activityInterval);
    activityInterval = null;
  }

  document.removeEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.removeEventListener("focus", handleWindowFocus);
}

function handleVisibilityChange() {
  if (document.visibilityState !== "visible") return;

  const user = auth.currentUser;

  if (user) {
    updateUserActivity(user.uid);
  }
}

function handleWindowFocus() {
  const user = auth.currentUser;

  if (user) {
    updateUserActivity(user.uid);
  }
}

// ==================================================
// AUTH MODAL
// ==================================================

function openAuthModal(view = "login", message = "") {
  if (!authModal) return;

  setAuthView(view);

  if (message) {
    showAuthMessage(message);
  }

  authModal.hidden = false;
  authModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-modal-open");

  window.setTimeout(() => {
    getActiveForm()?.querySelector("input, select, button")?.focus();
  }, 0);
}

function closeAuthModal() {
  if (!authModal) return;

  authModal.hidden = true;
  authModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-modal-open");
  clearAuthMessage();
}

function setAuthView(view) {
  const nextView =
    view === "register" || view === "reset" ? view : "login";

  const isRegister = nextView === "register";
  const isReset = nextView === "reset";
  const text = AUTH_TEXT[nextView];

  if (loginForm) loginForm.hidden = nextView !== "login";
  if (passwordResetForm) passwordResetForm.hidden = !isReset;
  if (registerForm) registerForm.hidden = !isRegister;
  if (authTabs) authTabs.hidden = isReset;
  if (authTitle) authTitle.textContent = text.title;
  if (authSubtitle) authSubtitle.textContent = text.subtitle;

  document
    .querySelectorAll(".auth-tab[data-auth-switch]")
    .forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.authSwitch === nextView
      );
    });

  clearAuthMessage();
}

// ==================================================
// PAROLNI TIKLASH
// ==================================================

async function resetPassword(event) {
  event.preventDefault();

  const email =
    document.getElementById("passwordResetEmail")?.value.trim() || "";

  if (!email) {
    showAuthMessage("Email manzilni kiriting.");
    return;
  }

  setFormLoading(passwordResetForm, true);

  try {
    await sendPasswordResetEmail(auth, email);

    passwordResetForm.reset();

    showAuthMessage(
      "Parolni tiklash havolasi emailingizga yuborildi.",
      "success"
    );
  } catch (error) {
    showAuthMessage(getErrorMessage(error));
  } finally {
    setFormLoading(passwordResetForm, false);
  }
}

// ==================================================
// RO'YXATDAN O'TISH
// ==================================================

async function registerUser(event) {
  event.preventDefault();

  const formData = getRegisterFormData();
  const validationError = validateRegistration(formData);

  if (validationError) {
    showAuthMessage(validationError);
    return;
  }

  setFormLoading(registerForm, true);

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      formData.email,
      formData.password
    );

    try {
      await createUserProfile(credential.user.uid, {
        fullName: formData.fullName,
        phone: formData.phone,
        email: credential.user.email || formData.email
      });
    } catch (profileError) {
      await rollbackCreatedUser(credential.user);
      throw profileError;
    }

    // Yangi foydalanuvchining birinchi aktivligini yozamiz
    await updateUserActivity(credential.user.uid);

    registerForm.reset();
    closeAuthModal();

    renderAuthenticatedNavbar(credential.user, {
      fullName: formData.fullName
    });

    // Aktivlik kuzatuvini boshlash
    startActivityTracking(credential.user.uid);

    continueToPendingDestination();
  } catch (error) {
    showAuthMessage(getErrorMessage(error));
  } finally {
    setFormLoading(registerForm, false);
  }
}

// ==================================================
// LOGIN
// ==================================================

async function loginUser(event) {
  event.preventDefault();

  const email =
    document.getElementById("loginEmail")?.value.trim() || "";

  const password =
    document.getElementById("loginPassword")?.value || "";

  if (!email || !password) {
    showAuthMessage("Email va parolni kiriting.");
    return;
  }

  setFormLoading(loginForm, true);

  try {
    await signInWithEmailAndPassword(auth, email, password);

    loginForm.reset();
    closeAuthModal();
    continueToPendingDestination();
  } catch (error) {
    showAuthMessage(getErrorMessage(error));
  } finally {
    setFormLoading(loginForm, false);
  }
}

// ==================================================
// LOGOUT
// ==================================================

async function logoutUser() {
  try {
    // Aktivlik kuzatuvini to'xtatamiz
    stopActivityTracking();

    await signOut(auth);

    closeUserMenu();
    renderGuestNavbar();
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

// ==================================================
// EMAIL VERIFICATION
// ==================================================

export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user) {
    throw new Error(
      "Email verification requires an authenticated user."
    );
  }

  await sendEmailVerification(user);
}

// ==================================================
// USER PROFILE
// ==================================================

async function createUserProfile(uid, profile) {
  await setDoc(doc(db, "users", uid), {
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    xp: 0,
    level: 1,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  });
}

async function rollbackCreatedUser(user) {
  try {
    await deleteUser(user);
  } catch (error) {
    console.error(
      "Could not roll back Auth user after profile creation failed:",
      error
    );
  }
}

async function getUserProfile(uid) {
  try {
    const snapshot = await getDoc(doc(db, "users", uid));

    return snapshot.exists()
      ? snapshot.data()
      : null;
  } catch (error) {
    console.error("Could not load user profile:", error);
    return null;
  }
}

// ==================================================
// NAVBAR
// ==================================================

function renderGuestNavbar() {
  if (!authNav) return;

  const loginButton = createButton({
    id: "openLogin",
    className: "btn btn-outline",
    text: "Kirish"
  });

  const registerButton = createButton({
    id: "openRegister",
    className: "btn btn-primary",
    text: "Ro'yxatdan o'tish"
  });

  authNav.replaceChildren(loginButton, registerButton);
}

function renderAuthenticatedNavbar(user, profile) {
  if (!authNav) return;

  const displayName = getDisplayName(user, profile);

  const userMenu = document.createElement("div");
  userMenu.className = "user-menu";

  const menuButton = createButton({
    id: "userMenuBtn",
    className: "btn user-menu-btn",
    text: ""
  });

  menuButton.setAttribute("aria-haspopup", "true");
  menuButton.setAttribute("aria-expanded", "false");

  const icon = document.createElement("span");

  icon.className = "user-menu-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "\uD83D\uDC64";

  const name = document.createElement("span");

  name.className = "user-menu-name";
  name.textContent = displayName;

  menuButton.append(icon, name);

  const dropdown = document.createElement("div");

  dropdown.className = "user-dropdown";
  dropdown.id = "userDropdown";
  dropdown.hidden = true;

  dropdown.append(
    createMenuItem("profile", "Profil"),
    createMenuItem("settings", "Sozlamalar"),
    createMenuItem("logout", "Chiqish")
  );

  userMenu.append(menuButton, dropdown);
  authNav.replaceChildren(userMenu);
}

function createButton({ id, className, text }) {
  const button = document.createElement("button");

  button.type = "button";
  button.id = id;
  button.className = className;
  button.textContent = text;

  return button;
}

function createMenuItem(action, text) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "user-dropdown-item";
  button.dataset.menuAction = action;
  button.textContent = text;

  return button;
}

function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  const menuButton = document.getElementById("userMenuBtn");

  if (!dropdown || !menuButton) return;

  dropdown.hidden = !dropdown.hidden;

  menuButton.setAttribute(
    "aria-expanded",
    String(!dropdown.hidden)
  );
}

function closeUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  const menuButton = document.getElementById("userMenuBtn");

  if (!dropdown || !menuButton) return;

  dropdown.hidden = true;

  menuButton.setAttribute(
    "aria-expanded",
    "false"
  );
}

// ==================================================
// REGISTER FORM
// ==================================================

function getRegisterFormData() {
  return {
    fullName:
      document.getElementById("registerFullName")?.value.trim() || "",

    phone:
      document.getElementById("registerPhone")?.value.trim() || "",

    email:
      document.getElementById("registerEmail")?.value.trim() || "",

    password:
      document.getElementById("registerPassword")?.value || "",

    confirmPassword:
      document.getElementById("registerConfirmPassword")?.value || ""
  };
}

function validateRegistration(formData) {
  if (
    !formData.fullName ||
    !formData.phone ||
    !formData.email ||
    !formData.password ||
    !formData.confirmPassword
  ) {
    return "Barcha maydonlarni to'ldiring.";
  }

  if (formData.password.length < 6) {
    return "Parol kamida 6 ta belgidan iborat bo'lishi kerak.";
  }

  if (formData.password !== formData.confirmPassword) {
    return "Parollar mos emas.";
  }

  return "";
}

// ==================================================
// FORM UTILITIES
// ==================================================

function getActiveForm() {
  if (passwordResetForm && !passwordResetForm.hidden) {
    return passwordResetForm;
  }

  if (registerForm && !registerForm.hidden) {
    return registerForm;
  }

  return loginForm;
}

function getDisplayName(user, profile) {
  const fullName = profile?.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  return user.email || "Foydalanuvchi";
}

function setPendingDestination(destination) {
  const resolvedDestination = new URL(
    destination,
    window.location.href
  ).href;

  sessionStorage.setItem(
    PENDING_DESTINATION_KEY,
    resolvedDestination
  );
}

function getPendingDestination() {
  return sessionStorage.getItem(
    PENDING_DESTINATION_KEY
  );
}

function clearPendingDestination() {
  sessionStorage.removeItem(
    PENDING_DESTINATION_KEY
  );
}

function continueToPendingDestination() {
  const destination = getPendingDestination();

  if (!destination) return;

  clearPendingDestination();

  window.location.href = destination;
}

function setFormLoading(form, isLoading) {
  const submitButton =
    form?.querySelector(".auth-submit");

  if (!submitButton) return;

  if (isLoading) {
    submitButton.dataset.defaultText =
      submitButton.textContent;

    submitButton.textContent = "Kutilmoqda...";
    submitButton.disabled = true;

    return;
  }

  submitButton.textContent =
    submitButton.dataset.defaultText ||
    submitButton.textContent;

  submitButton.disabled = false;
}

// ==================================================
// AUTH MESSAGES
// ==================================================

function showAuthMessage(message, type = "error") {
  if (!authMessage) return;

  authMessage.textContent = message;

  authMessage.className =
    `auth-message ${
      type === "success" ? "success" : ""
    }`.trim();
}

function clearAuthMessage() {
  if (!authMessage) return;

  authMessage.textContent = "";
  authMessage.className = "auth-message";
}

function getErrorMessage(error) {
  return (
    ERROR_MESSAGES[error.code] ||
    "Amalni bajarishda xatolik yuz berdi."
  );
}

// ==================================================
// INIT
// ==================================================

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initAuth
  );
} else {
  initAuth();
}