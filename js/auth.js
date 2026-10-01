// ==================================================
// OliyFizika.uz — js/auth.js (moslik qatlami)
//
// Avval bu fayl butun autentifikatsiyani o'zi bajarardi (1714 qator).
// Endi u YAGONA yangi tizimga ulanadi — parallel tizim yo'q:
//   • Firebase: js/firebase.js (o'zgarmagan)
//   • Sessiya/profil/faollik: assets/js/core/session.js
//   • Kirish/ro'yxatdan o'tish: assets/js/auth/auth-service.js + auth-ui.js
//
// Saqlangan xatti-harakatlar (eski sahifalar uchun):
//   • #authNav ichida "Kirish" / "Ro'yxatdan o'tish" tugmalari yoki foydalanuvchi menyusi
//   • a[data-requires-auth="true"] — mehmon uchun kirish oynasi + asl manzilga qaytish
//     (sessionStorage "oliyFizikaPendingDestination" — o'sha kalit)
//   • users/{uid}.lastActiveAt faolligini yangilash
//   • export: hasFullAccess(), sendVerificationEmail()
// ==================================================

import { auth, db } from "./firebase.js";
import { sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { onSession, displayName, signOutUser, isProfileComplete } from "../assets/js/core/session.js";
import { showAuthGate, openAuth } from "../assets/js/auth/auth-gate.js";
import { completeGoogleRedirect, getPendingRegistration } from "../assets/js/auth/auth-service.js";
import { toast } from "../assets/js/ui/feedback.js";

const ROOT = new URL("../", import.meta.url);

// ==================================================
// EKSPORTLAR (oldingi API saqlangan)
// ==================================================

export async function hasFullAccess(user = auth.currentUser) {
  if (!user) return false;
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    return snapshot.exists() && snapshot.data()?.fullAccess === true;
  } catch (error) {
    console.error("Could not check full access:", error);
    return false;
  }
}

export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user) throw new Error("Email verification requires an authenticated user.");
  await sendEmailVerification(user);
}

// ==================================================
// NAVBAR (#authNav) — eski sahifa stillari bilan
// ==================================================

let authNav = null;
let isSignedIn = false;

function button({ id, className, text }) {
  const el = document.createElement("button");
  el.type = "button";
  if (id) el.id = id;
  el.className = className;
  el.textContent = text;
  return el;
}

function renderGuestNavbar() {
  if (!authNav) return;
  authNav.replaceChildren(
    button({ id: "openLogin", className: "btn btn-outline", text: "Kirish" }),
    button({ id: "openRegister", className: "btn btn-primary", text: "Ro'yxatdan o'tish" })
  );
}

function renderAuthenticatedNavbar(state) {
  if (!authNav) return;
  const wrap = document.createElement("div");
  wrap.className = "user-menu";

  const menuButton = button({ id: "userMenuBtn", className: "btn user-menu-btn", text: "" });
  menuButton.setAttribute("aria-haspopup", "true");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-controls", "userDropdown");
  const iconEl = document.createElement("span");
  iconEl.className = "user-menu-icon";
  iconEl.setAttribute("aria-hidden", "true");
  iconEl.textContent = "👤";
  const name = document.createElement("span");
  name.className = "user-menu-name";
  name.textContent = displayName(state);
  menuButton.append(iconEl, name);

  const dropdown = document.createElement("div");
  dropdown.className = "user-dropdown";
  dropdown.id = "userDropdown";
  dropdown.hidden = true;
  [["profile", "Profil"], ["results", "Mening natijalarim"], ["settings", "Sozlamalar"], ["logout", "Chiqish"]].forEach(([action, text]) => {
    const item = button({ className: "user-dropdown-item", text });
    item.dataset.menuAction = action;
    dropdown.append(item);
  });

  wrap.append(menuButton, dropdown);
  authNav.replaceChildren(wrap);
}

function setMenu(open) {
  const dropdown = document.getElementById("userDropdown");
  const btn = document.getElementById("userMenuBtn");
  if (!dropdown || !btn) return;
  dropdown.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}

function bindNavbar() {
  if (!authNav) return;
  authNav.addEventListener("click", async (event) => {
    if (event.target.closest("#openLogin")) return void openAuth("login");
    if (event.target.closest("#openRegister")) return void openAuth("register");
    if (event.target.closest("#userMenuBtn")) {
      setMenu(document.getElementById("userDropdown")?.hidden);
      return;
    }
    const action = event.target.closest("[data-menu-action]")?.dataset.menuAction;
    if (!action) return;
    setMenu(false);
    if (action === "logout") {
      try {
        await signOutUser();
        toast("Hisobdan chiqdingiz.");
      } catch (error) {
        console.error("Logout failed:", error);
      }
      return;
    }
    const target = { profile: "dashboard/profile.html", results: "dashboard/natijalar.html", settings: "dashboard/settings.html" }[action];
    if (target) location.href = new URL(target, ROOT).href;
  });
  document.addEventListener("click", (event) => {
    if (!authNav.contains(event.target)) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });
}

// ==================================================
// HIMOYALANGAN HAVOLALAR
// ==================================================

function bindProtectedLinks() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-requires-auth='true']");
    if (!link || isSignedIn) return;
    const destination = link.getAttribute("href");
    if (!destination || destination === "#") return;
    event.preventDefault();
    showAuthGate(new URL(destination, location.href).href);
  });
}

// ==================================================
// INIT
// ==================================================

function init() {
  authNav = document.getElementById("authNav");
  bindNavbar();
  bindProtectedLinks();

  let resumeOffered = false;
  onSession((state) => {
    isSignedIn = state.status === "authenticated";
    if (state.status === "loading") return;
    if (!isSignedIn) return renderGuestNavbar();
    renderAuthenticatedNavbar(state);

    // Email tasdiqlangan, lekin parol yaratilmagan — ro'yxatdan o'tishni davom ettirish
    const reg = getPendingRegistration();
    if (!resumeOffered && state.profileLoaded && state.user?.emailVerified && reg &&
        reg.email === (state.user.email || "").toLowerCase() && !isProfileComplete(state.profile)) {
      resumeOffered = true;
      openAuth("password");
    }
  });

  // ?auth=login|register|reset — boshqa sahifalardan yo'naltirilganda
  const view = new URLSearchParams(location.search).get("auth");
  if (["login", "register", "reset"].includes(view)) {
    const clean = new URL(location.href);
    clean.searchParams.delete("auth");
    history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
    openAuth(view);
  }

  completeGoogleRedirect().catch((error) => console.warn("Google redirect:", error?.code || error));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
