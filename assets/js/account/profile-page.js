// ==========================================================================
// Profil sahifasi (dashboard/profile.html) — OliyFizika 2.0.
// - Himoya: sahifa qobiqda "protected" (mehmonga mavjud kirish oynasi, kirgandan keyin shu sahifaga qaytadi).
// - Ma'lumot: session.js allaqachon o'qigan users/{uid} (qo'shimcha Firestore so'rovi YO'Q, yozish YO'Q).
// - Ko'rsatiladi: Ism, Familiya, Email, ro'yxatdan o'tgan sana, kirish usuli, XP va daraja (avvalgidek).
//   Telefon raqami UI'da ko'rsatilmaydi (ma'lumotlar bazasidagi maydon esa o'zgarmaydi).
// ==========================================================================

import { onSession, refreshProfile } from "../core/session.js";
import { icon } from "../ui/icons.js";
import { $, $$, fillIcons, splitName, formatDate, providers, methodLabel, initialsOf } from "./account-common.js";

const page = $("#profilePage");
const alertBox = $("[data-profile-alert]", page);
const SKELETON_TEXT = '<span class="of-skeleton of-skeleton--text"></span>';
const SKELETON_TITLE = '<span class="of-skeleton of-skeleton--title"></span>';
let slowTimer = null;

fillIcons(page);

const setText = (el, text) => { if (el) el.textContent = text; };
const busy = (value) => $$("[aria-busy]", page).forEach((el) => el.setAttribute("aria-busy", String(value)));

function showAlert(message, { retry = false } = {}) {
  if (!message) { alertBox.hidden = true; alertBox.textContent = ""; return; }
  alertBox.hidden = false;
  alertBox.innerHTML = `${icon("alert")}<span></span>`;
  alertBox.querySelector("span").textContent = message;
  if (retry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "of-btn of-btn--sm of-btn--ghost of-acc-retry";
    btn.textContent = "Qayta urinish";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { await refreshProfile(); } catch (error) { console.error("[profile]", error); btn.disabled = false; }
    }, { once: true });
    alertBox.append(btn);
  }
}

/** Mehmon/chiqish holati: shaxsiy ma'lumot DOM'da qolmaydi. */
function renderSkeleton() {
  busy(true);
  $("[data-profile-avatar]", page).innerHTML = '<span class="of-skeleton of-skeleton--circle"></span>';
  $("[data-profile-name]", page).innerHTML = SKELETON_TITLE;
  $("[data-profile-email-line]", page).innerHTML = SKELETON_TEXT;
  $("[data-profile-badges]", page).innerHTML = "";
  $$("[data-profile-info] [data-f]", page).forEach((dd) => { dd.innerHTML = SKELETON_TEXT; });
  $$("[data-profile-stats] [data-f]", page).forEach((el) => { el.innerHTML = SKELETON_TITLE; });
  $("[data-profile-security]", page).innerHTML = SKELETON_TEXT;
  $("[data-profile-pw-link]", page).hidden = true;
}

function badge(text, tone, iconName) {
  const b = document.createElement("span");
  b.className = `of-badge of-badge--${tone}`;
  b.innerHTML = icon(iconName);
  b.append(document.createTextNode(text));
  return b;
}

function render(state) {
  const { user, profile } = state;
  const { firstName, lastName } = splitName(profile, user);
  const email = user?.email || profile?.email || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || profile?.fullName || email.split("@")[0] || "Foydalanuvchi";
  const p = providers(user);

  setText($("[data-profile-avatar]", page), initialsOf(firstName, lastName, fullName));
  setText($("[data-profile-name]", page), fullName);
  setText($("[data-profile-email-line]", page), email);

  const badges = $("[data-profile-badges]", page);
  badges.replaceChildren();
  if (p.hasGoogle) badges.append(badge("Google hisobi", "blue", "globe"));
  if (p.hasPassword) badges.append(badge("Email va parol", "blue", "mail"));
  if (user?.emailVerified) badges.append(badge("Email tasdiqlangan", "green", "checkCircle"));

  const info = {
    firstName: firstName || "—",
    lastName: lastName || "—",
    email: email || "—",
    createdAt: formatDate(profile?.createdAt) || "—",
    method: methodLabel(user),
  };
  $$("[data-profile-info] [data-f]", page).forEach((dd) => setText(dd, info[dd.dataset.f]));

  // XP va daraja — faqat mavjud maydonlar (yangi hisob: 0 XP, 1-daraja — avvalgi sahifadagidek)
  const xp = Number.isFinite(Number(profile?.xp)) ? Number(profile.xp) : 0;
  const level = Number.isFinite(Number(profile?.level)) && Number(profile?.level) > 0 ? Number(profile.level) : 1;
  setText($("[data-profile-stats] [data-f='xp']", page), xp.toLocaleString("uz-UZ").replace(/,/g, " "));
  setText($("[data-profile-stats] [data-f='level']", page), `${level}-daraja`);

  const sec = $("[data-profile-security]", page);
  const pwLink = $("[data-profile-pw-link]", page);
  if (p.hasPassword) {
    sec.textContent = "Hisobingiz email va parol bilan himoyalangan. Parolni istalgan vaqtda Sozlamalarda o‘zgartirishingiz mumkin.";
    pwLink.hidden = false;
  } else if (p.hasGoogle) {
    sec.textContent = "Siz Google hisobi orqali kirasiz. Parolingiz Google hisobingizda boshqariladi.";
    pwLink.hidden = true;
  } else {
    sec.textContent = "Kirish usuli aniqlanmadi.";
    pwLink.hidden = true;
  }

  if (!profile) showAlert("Profil ma’lumotlari hali saqlanmagan. Sozlamalar sahifasida ism va familiyangizni saqlang.");
  else showAlert("");
  busy(false);
}

onSession((state) => {
  clearTimeout(slowTimer);
  if (state.status === "loading") return;
  if (state.status !== "authenticated") { showAlert(""); renderSkeleton(); return; }
  if (!state.profileLoaded) {
    renderSkeleton();
    // Profil o'qilmasa (tarmoq xatosi) — cheksiz skelet o'rniga tushunarli xabar
    slowTimer = setTimeout(() => showAlert("Profil ma’lumotlarini yuklab bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.", { retry: true }), 8000);
    return;
  }
  render(state);
});
