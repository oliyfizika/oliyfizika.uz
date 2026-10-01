// ==========================================================================
// OliyFizika.uz 2.0 — Ilova qobig'i (Sidebar + Header + Mobil navigatsiya)
//
// Ulanishi (har bir sahifa <head> ida):
//   <script src="{root}/assets/js/core/theme-boot.js"></script>
//   <link rel="stylesheet" href="{root}/assets/css/app.css">
//   <script type="module" src="{root}/assets/js/shell/app-shell.js"></script>
//
// Sahifa sozlamalari (<body> atributlari, hammasi ixtiyoriy):
//   data-shell="off"                 — qobiqni o'chirish (masalan, imtihon rejimi)
//   data-shell-title="..."           — header sarlavhasi
//   data-shell-search="Placeholder"  — kontekstli qidiruvni yoqish
//   data-search-target="#selector"   — qidiruv shu konteyner ichidagi [data-search-item] larni filtrlaydi
//   data-shell-public="true"         — himoyalangan bo'limdagi sahifani ochiq qilish
//
// JS API: window.OFShell.{ setSearch, setTitle, toast, requireAuth, openAuth }
// Sahifa kontenti va mavjud skriptlar o'zgartirilmaydi — faqat qobiq ichiga joylanadi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { toast, friendlyError } from "../ui/feedback.js";
import { NAV_GROUPS, BOTTOM_NAV, ALL_ITEMS, ADMIN_NAV_GROUPS, ADMIN_BOTTOM_NAV, ADMIN_ENTRY } from "./nav-config.js";
import { applyTheme, writePref } from "../core/prefs.js";
import { onSession, displayName, initials, signOutUser } from "../core/session.js";
import { showAuthGate } from "../auth/auth-gate.js";
import { notificationMarkup, mountNotifications, clearNotificationCache } from "../notifications/notification-center.js";

const ROOT = new URL("../../../", import.meta.url);

const url = (path) => new URL(path, ROOT).href;
const body = document.body;
const html = document.documentElement;

// Admin System 1.0: <body data-shell-mode="admin"> — alohida admin menyusi (talaba menyusi bilan aralashmaydi).
const ADMIN_MODE = body.dataset.shellMode === "admin";
const GROUPS = ADMIN_MODE ? ADMIN_NAV_GROUPS : NAV_GROUPS;
const ITEMS = GROUPS.flatMap((group) => group.items);
const BOTTOM = ADMIN_MODE ? ADMIN_BOTTOM_NAV : BOTTOM_NAV;
const isAdminProfile = (state) => state.status === "authenticated" && state.profile?.role === "admin";

// ---------------------------------------------------------------------------
function currentRelPath() {
  let rel = decodeURI(location.pathname);
  const rootPath = decodeURI(ROOT.pathname);
  if (rel.startsWith(rootPath)) rel = rel.slice(rootPath.length);
  return rel.replace(/^\/+/, "");
}

function findActiveItem(rel) {
  let best = null;
  let bestLen = -1;
  for (const item of ITEMS) {
    for (const m of item.match) {
      const hit = m.endsWith("/") ? rel.startsWith(m) : rel === m;
      if (hit && m.length > bestLen) {
        best = item;
        bestLen = m.length;
      }
    }
  }
  return best;
}

function pageTitle(active, rel) {
  if (body.dataset.shellTitle) return body.dataset.shellTitle;
  if (active && rel === active.href) return active.label;
  const h1 = document.querySelector(".of-page-host h1");
  const fromH1 = h1?.textContent.replace(/\s+/g, " ").trim();
  if (fromH1 && fromH1.length < 80) return fromH1;
  const fromTitle = document.title.split("|")[0].trim();
  return fromTitle || active?.label || "OliyFizika.uz";
}

// ---------------------------------------------------------------------------
function mount() {
  applyTheme();
  const rel = currentRelPath();
  const active = findActiveItem(rel);
  const isProtectedPage = Boolean(active?.protected) && body.dataset.shellPublic !== "true";

  // 1) Mavjud kontentni ko'chirish
  const host = document.createElement("div");
  host.className = "of-page-host";
  while (body.firstChild) host.append(body.firstChild);

  // Agar sahifada allaqachon <main> bo'lsa, ikkinchi "main" landmark yaratmaymiz
  const main = document.createElement(host.querySelector("main") ? "div" : "main");
  main.id = "of-main";
  main.className = "of-main";
  main.tabIndex = -1;
  main.append(host);

  // 2) Qobiq qismlari
  const skip = document.createElement("a");
  skip.className = "of-skip-link";
  skip.href = "#of-main";
  skip.textContent = "Asosiy kontentga o‘tish";

  const sidebar = buildSidebar(active);
  const backdrop = document.createElement("div");
  backdrop.className = "of-backdrop";
  backdrop.hidden = true;

  const header = buildHeader(active, rel);
  const app = document.createElement("div");
  app.className = "of-app";
  app.append(header, main);

  const bottomNav = buildBottomNav(active);

  body.append(skip, sidebar, backdrop, app, bottomNav);
  body.classList.add("of-has-shell");
  html.classList.add("of-shell");
  if (ADMIN_MODE) html.classList.add("of-admin-mode");

  // Sarlavhani kontent ko'chirilgandan keyin aniqlaymiz
  setTitle(pageTitle(active, rel));

  bindSidebar(sidebar, backdrop);
  bindHeader(header);
  bindSearch(header);
  bindTooltips(sidebar);

  // 3) Sessiya
  let guardModal = null;
  onSession((state) => {
    renderAccount(header, state);
    sidebar.dataset.auth = state.status;
    // "Admin panel" havolasi faqat role == "admin" uchun ko'rinadi (UI; himoya — firestore.rules)
    const adminEntry = sidebar.querySelector("[data-admin-entry]");
    if (adminEntry) adminEntry.hidden = !isAdminProfile(state);

    maybeResumeRegistration(state);

    if (!isProtectedPage) return;
    if (state.status === "guest" || state.status === "offline") {
      html.dataset.guard = "locked";
      if (!guardModal) {
        guardModal = showAuthGate(location.href, {
          onDismiss: () => location.assign(url("index.html")),
        });
      }
    } else if (state.status === "authenticated") {
      delete html.dataset.guard;
      guardModal?.close("auth");
      guardModal = null;
    }
  });

  // ?auth=login|register — tashqi havolalardan kirish oynasini ochish
  const authParam = new URLSearchParams(location.search).get("auth");
  if (["login", "register", "reset"].includes(authParam)) {
    const clean = new URL(location.href);
    clean.searchParams.delete("auth");
    history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
    openAuth(authParam);
  }
  // Google redirect (mobil) orqali qaytgan bo'lsa — profilni ta'minlash
  import("../auth/auth-service.js").then((m) => m.completeGoogleRedirect()).catch((e) => console.warn("[shell] Google redirect:", e?.code || e));

  // 4) Tashqi API
  window.OFShell = { setSearch, setTitle, toast, requireAuth, openAuth, url };
  if (window.OFShellConfig?.search) setSearch(window.OFShellConfig.search);
  document.dispatchEvent(new CustomEvent("of:shell-ready"));
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function logoMarkup() {
  if (ADMIN_MODE) {
    return `<a class="of-logo" href="${url("admin/index.html")}" aria-label="OliyFizika.uz — Admin panel">
      <span class="of-logo__mark">${icon("atom")}</span>
      <span class="of-logo__text"><b>Oliy</b>Fizika<i>.uz</i></span>
      <span class="of-admin-badge">Admin</span>
    </a>`;
  }
  return `<a class="of-logo" href="${url("index.html")}" aria-label="OliyFizika.uz — bosh sahifa">
      <span class="of-logo__mark">${icon("atom")}</span>
      <span class="of-logo__text"><b>Oliy</b>Fizika<i>.uz</i></span>
    </a>`;
}

function adminEntryMarkup() {
  return `
    <div class="of-nav-group" role="group" aria-labelledby="of-nav-admin-entry" data-admin-entry hidden>
      <p class="of-nav-group__label" id="of-nav-admin-entry">Administrator</p>
      <ul><li>
        <a class="of-nav-link" href="${url(ADMIN_ENTRY.href)}" data-nav-id="${ADMIN_ENTRY.id}" data-label="${ADMIN_ENTRY.label}">
          ${icon(ADMIN_ENTRY.icon)}<span class="of-nav-link__label">${ADMIN_ENTRY.label}</span>
        </a>
      </li></ul>
    </div>`;
}

function buildSidebar(active) {
  const aside = document.createElement("aside");
  aside.className = "of-sidebar of-chrome";
  aside.id = "of-sidebar";
  aside.setAttribute("aria-label", "Asosiy navigatsiya");

  const groups = GROUPS.map((group) => `
    <div class="of-nav-group" role="group" aria-labelledby="of-nav-${group.id}">
      <p class="of-nav-group__label" id="of-nav-${group.id}">${group.label}</p>
      <ul>
        ${group.items.map((item) => `
          <li>
            <a class="of-nav-link" href="${url(item.href)}" data-nav-id="${item.id}" data-label="${item.label}"
               ${item.protected && !item.publicLanding ? 'data-of-protected="true"' : ""}
               ${active?.id === item.id ? 'aria-current="page"' : ""}>
              ${icon(item.icon)}
              <span class="of-nav-link__label">${item.label}</span>
              ${item.protected && !item.publicLanding ? icon("lock", { className: "of-nav-link__lock" }) : ""}
            </a>
          </li>`).join("")}
      </ul>
    </div>`).join("");

  aside.innerHTML = `
    <div class="of-sidebar__brand">
      ${logoMarkup()}
      <button type="button" class="of-icon-btn of-drawer-close" data-drawer-close aria-label="Menyuni yopish">${icon("close")}</button>
    </div>
    <nav class="of-sidebar__scroll" aria-label="Bo‘limlar">${groups}${ADMIN_MODE ? "" : adminEntryMarkup()}</nav>
    <div class="of-sidebar__footer">
      <button type="button" class="of-btn of-btn--ghost of-collapse-btn" data-sidebar-toggle aria-controls="of-sidebar">
        ${icon("chevronLeft")}<span>Yig‘ish</span>
      </button>
    </div>`;
  return aside;
}

function bindSidebar(sidebar, backdrop) {
  // Desktop: yig'ish / yoyish
  const toggle = sidebar.querySelector("[data-sidebar-toggle]");
  const syncToggle = () => {
    const collapsed = html.dataset.sidebar === "collapsed";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Menyuni yoyish" : "Menyuni yig‘ish");
  };
  syncToggle();
  toggle.addEventListener("click", () => {
    const collapsed = html.dataset.sidebar !== "collapsed";
    if (collapsed) html.dataset.sidebar = "collapsed";
    else delete html.dataset.sidebar;
    writePref("sidebarCollapsed", collapsed);
    syncToggle();
  });

  // Mehmon: himoyalangan bo'limga bosganda — kirish modali
  sidebar.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-of-protected='true']");
    if (link && !isSignedIn()) {
      event.preventDefault();
      closeDrawer();
      showAuthGate(link.href);
    } else if (event.target.closest("a")) {
      closeDrawer();
    }
  });

  backdrop.addEventListener("click", closeDrawer);
  sidebar.querySelector("[data-drawer-close]").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && html.dataset.drawer === "open") closeDrawer();
  });
  matchMedia("(min-width: 900px)").addEventListener("change", (e) => e.matches && closeDrawer());
}

let drawerOpener = null;
function openDrawer(opener) {
  drawerOpener = opener || document.activeElement;
  html.dataset.drawer = "open";
  document.querySelector(".of-backdrop").hidden = false;
  document.querySelectorAll("[data-drawer-open]").forEach((b) => b.setAttribute("aria-expanded", "true"));
  body.classList.add("of-scroll-lock");
  requestAnimationFrame(() => document.querySelector(".of-sidebar [aria-current='page'], .of-sidebar .of-nav-link")?.focus());
}
function closeDrawer() {
  if (html.dataset.drawer !== "open") return;
  delete html.dataset.drawer;
  document.querySelector(".of-backdrop").hidden = true;
  document.querySelectorAll("[data-drawer-open]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  body.classList.remove("of-scroll-lock");
  drawerOpener?.focus?.();
}

function bindTooltips(sidebar) {
  let tip = null;
  const isCompact = () => sidebar.getBoundingClientRect().width < 120;
  const show = (link) => {
    if (!isCompact()) return;
    hide();
    const r = link.getBoundingClientRect();
    tip = document.createElement("div");
    tip.className = "of-tooltip of-chrome";
    tip.setAttribute("role", "tooltip");
    tip.textContent = link.dataset.label;
    tip.style.left = `${r.right + 10}px`;
    tip.style.top = `${r.top + r.height / 2 - 14}px`;
    body.append(tip);
  };
  const hide = () => { tip?.remove(); tip = null; };
  sidebar.querySelectorAll(".of-nav-link").forEach((link) => {
    link.addEventListener("mouseenter", () => show(link));
    link.addEventListener("focus", () => show(link));
    link.addEventListener("mouseleave", hide);
    link.addEventListener("blur", hide);
  });
  sidebar.addEventListener("scroll", hide, { passive: true });
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function buildHeader(active, rel) {
  const header = document.createElement("header");
  header.className = "of-header of-chrome";

  // Ixtiyoriy: <body data-shell-parent="home"> — bo'lim ildiz sahifasida ham "Ota bo'lim › Sahifa" ko'rsatiladi
  const parent = body.dataset.shellParent ? [...ITEMS, ...ALL_ITEMS].find((item) => item.id === body.dataset.shellParent) : null;
  const crumbItem = parent || active;
  const showCrumb = Boolean(parent) || (active && active.id !== "home" && rel !== active.href);
  header.innerHTML = `
    <button type="button" class="of-icon-btn of-header__menu" data-drawer-open aria-controls="of-sidebar" aria-expanded="false" aria-label="Menyuni ochish">${icon("menu")}</button>
    <div class="of-header__context">
      ${showCrumb ? `<nav class="of-breadcrumb" aria-label="Joylashuv">
          <a href="${url(crumbItem.href)}">${crumbItem.label}</a>${icon("chevronRight")}<span aria-current="page" data-crumb-current></span>
        </nav>` : ""}
      <p class="of-header__title" data-of-title></p>
    </div>
    <div class="of-header__search" data-of-search hidden>
      <label class="of-search">
        ${icon("search")}
        <span class="of-sr-only" data-search-label>Qidirish</span>
        <input type="search" autocomplete="off" spellcheck="false" enterkeyhint="search">
      </label>
      <p class="of-sr-only" aria-live="polite" data-search-status></p>
    </div>
    <div class="of-header__actions">
      <button type="button" class="of-icon-btn of-header__search-toggle" data-search-toggle aria-label="Qidiruvni ochish" hidden>${icon("search")}</button>
      <div class="of-row" data-account>
        <span class="of-skeleton of-header__skeleton" aria-hidden="true"></span>
      </div>
    </div>`;
  return header;
}

function bindHeader(header) {
  header.querySelector("[data-drawer-open]").addEventListener("click", (e) => openDrawer(e.currentTarget));
  document.querySelectorAll(".of-bottom-nav [data-drawer-open]").forEach((b) => b.addEventListener("click", (e) => openDrawer(e.currentTarget)));

  const searchToggle = header.querySelector("[data-search-toggle]");
  searchToggle.addEventListener("click", () => {
    const open = html.dataset.mobileSearch !== "open";
    if (open) html.dataset.mobileSearch = "open";
    else delete html.dataset.mobileSearch;
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) header.querySelector("[data-of-search] input").focus();
  });

  // Tashqariga bosilganda / Esc — ochiq popoverlarni yopish
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".of-header [aria-expanded='true'][data-popover]").forEach((btn) => {
      const pop = document.getElementById(btn.getAttribute("aria-controls"));
      if (!btn.contains(event.target) && !pop?.contains(event.target)) setPopover(btn, false);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".of-header [aria-expanded='true'][data-popover]").forEach((btn) => {
      setPopover(btn, false);
      btn.focus();
    });
  });
}

function setPopover(button, open) {
  const pop = document.getElementById(button.getAttribute("aria-controls"));
  if (!pop) return;
  button.setAttribute("aria-expanded", String(open));
  pop.hidden = !open;
  if (open) pop.querySelector("a, button")?.focus({ preventScroll: true });
}

function renderAccount(header, state) {
  const box = header.querySelector("[data-account]");
  if (state.status === "loading") return;

  if (state.status !== "authenticated") {
    box.innerHTML = `
      <div class="of-guest-actions">
        <button type="button" class="of-btn of-btn--ghost" data-auth="login">${icon("login")}Kirish</button>
        <button type="button" class="of-btn of-btn--primary" data-auth="register">Ro‘yxatdan o‘tish</button>
      </div>`;
    box.querySelectorAll("[data-auth]").forEach((b) => b.addEventListener("click", () => openAuth(b.dataset.auth)));
    return;
  }

  const name = displayName(state);
  const email = state.user?.email || state.profile?.email || "";
  // Faqat Google orqali kiradiganlarda parol yo'q — "Parolni o'zgartirish" bandi ko'rsatilmaydi
  const hasPassword = (state.user?.providerData || []).some((p) => p?.providerId === "password");
  box.innerHTML = `
    ${notificationMarkup()}
    <div class="of-user">
      <button type="button" class="of-user__btn" data-popover aria-controls="of-user-menu" aria-expanded="false" aria-haspopup="menu" aria-label="Profil menyusi: ${escapeAttr(name)}">
        <span class="of-avatar" aria-hidden="true">${escapeHtml(initials(state))}</span>
        <span class="of-user__name">${escapeHtml(name)}</span>
        ${icon("chevronDown")}
      </button>
      <div class="of-popover" id="of-user-menu" role="menu" hidden>
        <div class="of-user-card">
          <span class="of-avatar of-avatar--lg" aria-hidden="true">${escapeHtml(initials(state))}</span>
          <div><p class="of-user-card__name">${escapeHtml(name)}</p><p class="of-user-card__email">${escapeHtml(email)}</p></div>
        </div>
        <div class="of-menu-sep"></div>
        <a class="of-menu-item" role="menuitem" href="${url("dashboard/profile.html")}">${icon("user")}Profil</a>
        <a class="of-menu-item" role="menuitem" href="${url("dashboard/natijalar.html")}">${icon("chart")}Mening natijalarim</a>
        ${hasPassword ? `<a class="of-menu-item" role="menuitem" href="${url("dashboard/settings.html#security")}">${icon("key")}Parolni o‘zgartirish</a>` : ""}
        <a class="of-menu-item" role="menuitem" href="${url("dashboard/settings.html")}">${icon("settings")}Sozlamalar</a>
        ${ADMIN_MODE ? `<a class="of-menu-item" role="menuitem" href="${url("index.html")}">${icon("home")}Saytga qaytish</a>`
          : isAdminProfile(state) ? `<a class="of-menu-item" role="menuitem" href="${url(ADMIN_ENTRY.href)}" data-admin-menu>${icon(ADMIN_ENTRY.icon)}${ADMIN_ENTRY.label}</a>` : ""}
        <div class="of-menu-sep"></div>
        <button type="button" class="of-menu-item of-menu-item--danger" role="menuitem" data-logout>${icon("logout")}Chiqish</button>
      </div>
    </div>`;

  box.querySelectorAll("[data-popover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      box.querySelectorAll("[data-popover]").forEach((other) => other !== btn && setPopover(other, false));
      setPopover(btn, open);
    });
  });

  // Menyu ichida strelkalar bilan harakatlanish
  const menu = box.querySelector("#of-user-menu");
  menu.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const items = [...menu.querySelectorAll("[role='menuitem']")];
    const i = items.indexOf(document.activeElement);
    const next = event.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  });

  box.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await signOutUser();
      clearNotificationCache();
      toast("Hisobdan chiqdingiz.");
      const active = findActiveItem(currentRelPath());
      if (active?.protected) location.assign(url("index.html"));
    } catch (error) {
      toast(friendlyError(error));
    }
  });

  mountNotifications(box.querySelector("[data-notify]"), state);
  document.dispatchEvent(new CustomEvent("of:account-rendered", { detail: state }));
}

// ---------------------------------------------------------------------------
// Kontekstli qidiruv
// ---------------------------------------------------------------------------
let searchHandler = null;

function bindSearch(header) {
  const input = header.querySelector("[data-of-search] input");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value), 140);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      input.value = "";
      runSearch("");
    }
  });

  // Deklarativ sozlama: <body data-shell-search="..." data-search-target="#list">
  if (body.dataset.shellSearch) {
    setSearch({
      placeholder: body.dataset.shellSearch,
      target: body.dataset.searchTarget || null,
    });
  }
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function runSearch(query) {
  const q = normalize(query);
  const status = document.querySelector("[data-search-status]");
  if (typeof searchHandler === "function") {
    const count = searchHandler(q, query);
    if (status && typeof count === "number") status.textContent = q ? `${count} ta natija topildi` : "";
    return;
  }
}

/**
 * Sahifa uchun kontekstli qidiruvni yoqadi.
 * @param {{ placeholder?: string, label?: string, target?: string|HTMLElement, onQuery?: (q:string, raw:string)=>number|void }} opts
 *   `target` berilsa: shu konteyner ichidagi [data-search-item] elementlar matn bo'yicha filtrlanadi.
 */
export function setSearch({ placeholder = "Qidirish…", label, target, onQuery } = {}) {
  const box = document.querySelector(".of-header [data-of-search]");
  if (!box) return;
  box.hidden = false;
  document.querySelector(".of-header [data-search-toggle]").hidden = false;
  const input = box.querySelector("input");
  input.placeholder = placeholder;
  box.querySelector("[data-search-label]").textContent = label || placeholder.replace(/…|\.\.\.$/, "");

  if (onQuery) {
    searchHandler = onQuery;
  } else if (target) {
    searchHandler = (q) => filterItems(target, q);
  }
}

function filterItems(target, q) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) return 0;
  let visible = 0;
  container.querySelectorAll("[data-search-item]").forEach((el) => {
    const text = normalize(el.dataset.searchText || el.textContent);
    const match = !q || text.includes(q);
    el.hidden = !match;
    if (match) visible++;
  });
  let note = container.querySelector(":scope > .of-search-empty");
  if (q && visible === 0) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      container.append(note);
    }
    note.textContent = "Hech narsa topilmadi. Boshqa so‘z bilan urinib ko‘ring.";
  } else {
    note?.remove();
  }
  return visible;
}

export function setTitle(title) {
  const el = document.querySelector(".of-header [data-of-title]");
  if (el) el.textContent = title;
  const crumb = document.querySelector("[data-crumb-current]");
  if (crumb) crumb.textContent = title;
}

// ---------------------------------------------------------------------------
// Mobil pastki navigatsiya
// ---------------------------------------------------------------------------
function buildBottomNav(active) {
  const nav = document.createElement("nav");
  nav.className = "of-bottom-nav of-chrome";
  nav.setAttribute("aria-label", "Tezkor navigatsiya");
  const short = { home: "Bosh sahifa", "umumiy-fizika": "Fizika", "milliy-sertifikat": "Sertifikat", natijalar: "Natijalar",
    "admin-dashboard": "Dashboard", "admin-users": "Userlar", "admin-results": "Natijalar", "admin-access": "Access" };
  nav.innerHTML = BOTTOM.map((id) => {
    const item = ITEMS.find((i) => i.id === id);
    return `<a href="${url(item.href)}" ${item.protected && !item.publicLanding ? 'data-of-protected="true"' : ""} ${active?.id === id ? 'aria-current="page"' : ""}>
        ${icon(item.icon)}<span>${short[id] || item.label}</span></a>`;
  }).join("") + `<button type="button" data-drawer-open aria-controls="of-sidebar" aria-expanded="false">${icon("menu")}<span>Menyu</span></button>`;

  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-of-protected='true']");
    if (link && !isSignedIn()) {
      event.preventDefault();
      showAuthGate(link.href);
    }
  });
  return nav;
}

// ---------------------------------------------------------------------------
// Kirish talabi (auth gate)
// ---------------------------------------------------------------------------
let sessionStatus = "loading";
onSession((s) => { sessionStatus = s.status; });
function isSignedIn() { return sessionStatus === "authenticated"; }

// Email havolasi bosilgan, lekin parol hali yaratilmagan bo'lsa — parol bosqichini taklif qilamiz
let resumeOffered = false;
function maybeResumeRegistration(state) {
  if (resumeOffered || state.status !== "authenticated" || !state.profileLoaded || !state.user?.emailVerified) return;
  if (state.profile && (state.profile.fullName || state.profile.createdAt || typeof state.profile.xp === "number")) return;
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem("oliyfizika:pendingRegistration") || "null"); } catch { /* ignore */ }
  if (!pending || (pending.email || "").toLowerCase() !== (state.user.email || "").toLowerCase()) return;
  if (location.pathname.endsWith("/auth/tasdiqlash.html")) return;
  resumeOffered = true;
  openAuth("password");
}

/** Himoyalangan harakatdan oldin chaqiriladi. Kirgan bo'lsa true qaytaradi. */
export function requireAuth(destination = location.href) {
  if (isSignedIn()) return true;
  showAuthGate(destination);
  return false;
}

/**
 * Kirish / ro'yxatdan o'tish oynasini ochadi.
 * auth-ui.js dinamik yuklanadi (kerak bo'lgandagina). Yuklab bo'lmasa bosh sahifaga yo'naltiriladi.
 */
export async function openAuth(view = "login", opts = {}) {
  try {
    const mod = await import("../auth/auth-ui.js");
    mod.openAuthDialog(view, opts);
  } catch (error) {
    if (!/Failed to fetch|Importing a module script failed|error loading dynamically/i.test(String(error?.message))) {
      console.error("[shell] auth-ui xatosi:", error);
    }
    location.assign(`${url("index.html")}?auth=${encodeURIComponent(view)}`);
  }
}

// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(value) { return escapeHtml(value); }

// Tema o'zgarsa (boshqa tabda) — sinxronlash
window.addEventListener("storage", (event) => {
  if (event.key === "oliyfizika:theme") applyTheme();
});

// Ishga tushirish (barcha modul o'zgaruvchilari e'lon qilingandan keyin)
if (body.dataset.shell !== "off" && !body.classList.contains("of-has-shell")) {
  mount();
}
