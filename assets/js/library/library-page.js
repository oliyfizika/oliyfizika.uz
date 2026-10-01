// ==========================================================================
// Kutubxona — katalog (kutubxona/kutubxona.html) va bo'lim sahifalari (kutubxona/<bo'lim>.html).
// Ma'lumot: kutubxona/data/manifest.json — mavjud sahifalardagi kartalardan olingan (nom, muallif/yil,
// tavsif va URL o'zgartirilmagan). Fayllar Google Drive'da: bu sahifa ularning mazmunini YUKLAMAYDI,
// iframe/preview yo'q — fayl faqat foydalanuvchi "PDF ochish"/"Yuklab olish" bosganda ochiladi.
//   <body data-library="landing">             — katalog: bo'limlar + barcha materiallar, filtr, qidiruv
//   <body data-library-category="darsliklar">  — bitta bo'lim materiallari, bo'lim ichida qidiruv
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const CATEGORY_ICON = { darsliklar: "book", maruzalar: "lecture", masalalar: "target", laboratoriya: "flask", prezentatsiyalar: "slides" };
const TYPE_ICON = { PDF: "file", PPTX: "slides" };

const body = document.body;
const pageCategory = body.dataset.libraryCategory || "";
const state = { data: null, category: pageCategory, query: "" };

function resourceCard(r, cats, { showCategory }) {
  const cat = cats.get(r.category);
  const text = [r.title, r.byline, r.description, cat?.title, r.type].join(" ");
  const who = r.byline && r.byline !== "Prezentatsiya" ? ` (${r.byline})` : "";
  const aria = `${r.actionLabel}: ${r.title}${who} — ${r.type}, ${r.host}, yangi oynada ochiladi`;
  return `
    <li data-category="${esc(r.category)}" data-search-text="${esc(text)}">
      <article class="of-card of-res" data-type="${esc(r.type)}" aria-labelledby="res-${esc(r.id)}">
        <div class="of-res__top">
          <span class="of-res__type"><span class="of-sr-only">Fayl turi: </span>${icon(TYPE_ICON[r.type] || "file")}${esc(r.type)}</span>
          ${showCategory ? `<span class="of-badge">${esc(cat?.title || "")}</span>` : ""}
        </div>
        <h3 class="of-res__title" id="res-${esc(r.id)}">${esc(r.title)}</h3>
        ${r.byline ? `<p class="of-res__by">${esc(r.byline)}</p>` : ""}
        ${r.description ? `<p class="of-res__desc">${esc(r.description)}</p>` : ""}
        <div class="of-res__foot">
          <span class="of-res__host">${icon("external")}${esc(r.host)}</span>
          <a class="of-btn of-btn--soft" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(aria)}">${esc(r.actionLabel)}</a>
        </div>
      </article>
    </li>`;
}

function counts() {
  const m = new Map();
  state.data.resources.forEach((r) => m.set(r.category, (m.get(r.category) || 0) + 1));
  return m;
}

// ------------------------------------------------------------ katalog: bo'lim kartalari
function renderCategoryCards() {
  const box = $("[data-lib-cats]");
  if (!box) return;
  const n = counts();
  box.innerHTML = state.data.categories.filter((c) => n.get(c.id)).map((c) => `
    <li>
      <a class="of-card of-lib-cat" href="${esc(c.href)}">
        <span class="of-lib-cat__icon" aria-hidden="true">${icon(CATEGORY_ICON[c.id] || "book")}</span>
        <span class="of-lib-cat__body">
          <span class="of-lib-cat__title">${esc(c.title)}</span>
          <span class="of-lib-cat__count">${n.get(c.id)} ta material</span>
        </span>
      </a>
    </li>`).join("");
}

// ------------------------------------------------------------ katalog: filtr chiplari
function renderChips() {
  const box = $("[data-chips]");
  if (!box) return;
  const n = counts();
  const chips = [{ id: "", title: "Barchasi", n: state.data.resources.length }, ...state.data.categories.map((c) => ({ ...c, n: n.get(c.id) || 0 }))]
    .filter((c) => c.n > 0);
  box.innerHTML = chips
    .map((c) => `<li><button type="button" class="of-chip" data-category="${esc(c.id)}" aria-pressed="${c.id === state.category}">${esc(c.title)} <small>${c.n}</small></button></li>`)
    .join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".of-chip");
    if (!b) return;
    state.category = b.dataset.category;
    $$(".of-chip", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const shown = applyFilters();
    const status = document.querySelector("[data-search-status]");
    if (status) status.textContent = `${shown} ta material ko‘rsatilmoqda`;
  });
}

// ------------------------------------------------------------ bo'lim sahifasi: boshqa bo'limlarga havolalar
function renderSectionNav() {
  const box = $("[data-lib-sections]");
  if (!box) return;
  const n = counts();
  box.innerHTML = state.data.categories.filter((c) => n.get(c.id)).map((c) => `
    <li><a class="of-chip" href="${esc(c.href)}" ${c.id === pageCategory ? 'aria-current="page"' : ""}>${esc(c.title)} <small>${n.get(c.id)}</small></a></li>`).join("");
  // Joriy bo'lim chipi mobilda ko'rinadigan joyda bo'lsin (sahifani aylantirmasdan)
  const cur = box.querySelector("[aria-current]");
  if (cur && box.scrollWidth > box.clientWidth) box.scrollLeft = Math.max(0, cur.parentElement.offsetLeft - (box.clientWidth - cur.offsetWidth) / 2);
}

function renderList() {
  const cats = new Map(state.data.categories.map((c) => [c.id, c]));
  const items = pageCategory ? state.data.resources.filter((r) => r.category === pageCategory) : state.data.resources;
  const list = $("[data-resources]");
  list.innerHTML = items.map((r) => resourceCard(r, cats, { showCategory: !pageCategory })).join("");
  list.removeAttribute("aria-busy");
  applyFilters();
  revealOnScroll(list.children, { maxIndex: 6 });
}

function applyFilters() {
  let visible = 0;
  const lis = $$("[data-resources] > li");
  lis.forEach((li) => {
    const match = (!state.category || li.dataset.category === state.category) && (!state.query || norm(li.dataset.searchText).includes(state.query));
    li.hidden = !match;
    if (match) visible++;
  });
  const total = lis.length;
  const count = $("[data-lib-count]");
  if (count) count.textContent = visible === total ? `${total} ta material` : `${visible} / ${total} ta material`;
  let note = $("[data-resources] + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      note.setAttribute("role", "status");
      $("[data-resources]").after(note);
    }
    note.textContent = "Qidiruv bo‘yicha material topilmadi. Boshqa so‘z bilan urinib ko‘ring yoki boshqa bo‘limni tanlang.";
  } else note?.remove();
  return visible;
}

function setupSearch() {
  const cat = pageCategory ? state.data?.categories.find((c) => c.id === pageCategory) : null;
  const apply = () => window.OFShell?.setSearch({
    placeholder: pageCategory ? "Shu bo‘limdan qidirish…" : "Kutubxonadan qidirish…",
    label: pageCategory ? `${cat?.title || "Bo‘lim"} bo‘yicha qidirish` : "Kutubxona materiallari bo‘yicha qidirish",
    onQuery: (q) => { state.query = q; return state.data ? applyFilters() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  $$("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  try {
    const res = await fetch(new URL("data/manifest.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    state.data = await res.json();
  } catch (error) {
    console.error("[kutubxona] katalog yuklanmadi:", error);
    $("[data-resources]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Kutubxona ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    setupSearch();
    return;
  }
  setupSearch();
  renderCategoryCards();
  renderChips();
  renderSectionNav();
  renderList();
}

init();
