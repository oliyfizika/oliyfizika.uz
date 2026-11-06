// ==========================================================================
// Olimpiada bo'limi (olimpiada/olimpiada.html) — OliyFizika 2.0.
// Ma'lumot: olimpiada/data/manifest.json  { olympiads:[{id,title,description,icon}], items:[...] }
// Fayllar saytning o'zida (olimpiada/fayllar/...): PDF brauzerda ochiladi, istalgan fayl yuklab olinadi.
// Tuzilma papkalar kabi: olimpiada turi -> yil -> bosqich (yoki sinf) -> materiallar.
// Tanlov URL xeshida: #<olimpiada>/<yil>  (yilsiz materiallar uchun yil = "umumiy").
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const GENERAL = "umumiy";
const STAGE_ORDER = ["I bosqich", "II bosqich", "III bosqich", "Tuman bosqichi", "Viloyat bosqichi", "Respublika bosqichi"];
const state = { data: null, olympiad: "", year: "", query: "" };

const yearKey = (it) => it.year || GENERAL;
const yearLabel = (y) => (y === GENERAL ? "Umumiy" : `${y}-yil`);
const sizeLabel = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const dateLabel = (d) => (d ? d.split("-").reverse().join(".") : "");

function stageRank(s) {
  if (!s) return -1;
  const i = STAGE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const g = parseInt(s, 10); // "7-sinf"
  return Number.isFinite(g) ? 100 + g : 1000;
}

function itemsOf(olympiad) { return state.data.items.filter((it) => it.olympiad === olympiad); }

function yearsOf(olympiad) {
  const n = new Map();
  itemsOf(olympiad).forEach((it) => n.set(yearKey(it), (n.get(yearKey(it)) || 0) + 1));
  return [...n.entries()]
    .sort((a, b) => (a[0] === GENERAL) - (b[0] === GENERAL) || b[0].localeCompare(a[0]))
    .map(([id, count]) => ({ id, count }));
}

// ------------------------------------------------------------ material kartasi
function card(it, { context = false } = {}) {
  const ol = state.data.olympiads.find((o) => o.id === it.olympiad);
  const url = encodeURI(it.file);
  const name = it.file.split("/").pop();
  const ctx = context ? [ol?.title, it.year ? `${it.year}-yil` : "", it.stage].filter(Boolean).join(" · ") : "";
  return `
    <li>
      <article class="of-card of-res of-ol-res" data-type="${esc(it.type)}" aria-labelledby="ol-${esc(it.id)}">
        <div class="of-res__top">
          <span class="of-res__type"><span class="of-sr-only">Fayl turi: </span>${icon(it.type === "PDF" ? "file" : "list")}${esc(it.type)}</span>
          ${it.lang ? `<span class="of-badge" title="Til">${esc(it.lang)}</span>` : ""}
        </div>
        ${ctx ? `<p class="of-res__by">${esc(ctx)}</p>` : ""}
        <h3 class="of-res__title" id="ol-${esc(it.id)}">${esc(it.title)}</h3>
        ${it.description && norm(it.description) !== norm(it.title) ? `<p class="of-res__desc">${esc(it.description)}</p>` : ""}
        <p class="of-ol-meta">${esc(sizeLabel(it.size))}${it.date ? ` · ${esc(dateLabel(it.date))}` : ""} · <a href="${esc(it.source)}" target="_blank" rel="noopener noreferrer">Manba${icon("external")}</a></p>
        <div class="of-res__foot of-ol-actions">
          ${it.type === "PDF" ? `<a class="of-btn of-btn--soft" href="${url}" target="_blank" rel="noopener" aria-label="Ochish: ${esc(it.title)} (yangi oynada)">${icon("eye")}Ochish</a>` : ""}
          <a class="of-btn" href="${url}" download="${esc(name)}" aria-label="Yuklab olish: ${esc(it.title)}">${icon("download")}Yuklab olish</a>
        </div>
      </article>
    </li>`;
}

// ------------------------------------------------------------ olimpiada turlari (tugmalar)
function renderTypes() {
  const box = $("[data-ol-types]");
  box.innerHTML = state.data.olympiads.map((o) => {
    const items = itemsOf(o.id);
    if (!items.length) return "";
    const years = [...new Set(items.map((it) => it.year).filter(Boolean))].sort();
    const span = years.length ? (years.length > 1 ? `${years[0]}–${years.at(-1)}` : years[0]) : "";
    return `
      <li>
        <button type="button" class="of-card of-lib-cat of-ol-type" data-olympiad="${esc(o.id)}" aria-pressed="false">
          <span class="of-lib-cat__icon" aria-hidden="true">${icon(o.icon || "trophy")}</span>
          <span class="of-lib-cat__body">
            <span class="of-lib-cat__title">${esc(o.title)}</span>
            <span class="of-lib-cat__count">${items.length} ta material${span ? ` · ${span}` : ""}</span>
          </span>
        </button>
      </li>`;
  }).join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-olympiad]");
    if (!b) return;
    select(b.dataset.olympiad, "", { scroll: true });
  });
  revealOnScroll(box.children, { maxIndex: 8 });
}

// ------------------------------------------------------------ tanlangan olimpiada: yillar + bosqichlar
function renderPanel() {
  const ol = state.data.olympiads.find((o) => o.id === state.olympiad);
  const panel = $("[data-ol-panel]");
  document.querySelectorAll("[data-olympiad]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.olympiad === state.olympiad)));
  if (state.query) return renderSearch();
  if (!ol) { panel.hidden = true; return; }
  panel.hidden = false;
  $("[data-ol-title]").textContent = ol.title;
  $("[data-ol-desc]").textContent = ol.description || "";

  const years = yearsOf(ol.id);
  const yearsBox = $("[data-ol-years]");
  yearsBox.parentElement.hidden = false;
  yearsBox.innerHTML = years.map((y) => `
    <li><button type="button" class="of-chip" data-year="${esc(y.id)}" aria-pressed="${y.id === state.year}">${esc(yearLabel(y.id))} <small>${y.count}</small></button></li>`).join("");
  const cur = yearsBox.querySelector('[aria-pressed="true"]');
  if (cur && yearsBox.scrollWidth > yearsBox.clientWidth) yearsBox.scrollLeft = Math.max(0, cur.parentElement.offsetLeft - 16);

  const items = itemsOf(ol.id).filter((it) => yearKey(it) === state.year);
  const groups = new Map();
  items.forEach((it) => {
    const k = it.stage || "";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  });
  const html = [...groups.entries()]
    .sort((a, b) => stageRank(a[0]) - stageRank(b[0]))
    .map(([stage, list]) => `
      <section class="of-ol-group">
        ${stage ? `<h3 class="of-ol-group__title">${esc(stage)} <small>${list.length} ta</small></h3>` : ""}
        <ul class="of-res-grid">${list.map((it) => card(it)).join("")}</ul>
      </section>`).join("");
  const box = $("[data-ol-groups]");
  box.innerHTML = html;
  revealOnScroll(box.querySelectorAll(".of-res-grid > li"), { maxIndex: 6 });
  setCount(items.length, `${ol.title}, ${yearLabel(state.year)}`);
}

function renderSearch() {
  const panel = $("[data-ol-panel]");
  panel.hidden = false;
  $("[data-ol-title]").textContent = "Qidiruv natijalari";
  $("[data-ol-desc]").textContent = "Barcha olimpiadalar bo‘yicha";
  $("[data-ol-years]").parentElement.hidden = true;
  const words = state.query.split(" ");
  const found = state.data.items.filter((it) => {
    const ol = state.data.olympiads.find((o) => o.id === it.olympiad);
    const text = norm([ol?.title, it.year, it.stage, it.title, it.description, it.lang, it.type].join(" "));
    return words.every((w) => text.includes(w));
  });
  $("[data-ol-groups]").innerHTML = found.length
    ? `<ul class="of-res-grid">${found.map((it) => card(it, { context: true })).join("")}</ul>`
    : `<p class="of-search-empty of-subtle" role="status">Qidiruv bo‘yicha material topilmadi. Boshqa so‘z bilan urinib ko‘ring.</p>`;
  setCount(found.length);
  return found.length;
}

function setCount(n) {
  $("[data-ol-count]").textContent = `${n} ta material`;
}

// ------------------------------------------------------------ tanlov va URL xeshi
function select(olympiad, year, { scroll = false, push = true } = {}) {
  if (!state.data.olympiads.some((o) => o.id === olympiad)) return;
  const years = yearsOf(olympiad);
  state.olympiad = olympiad;
  state.year = years.some((y) => y.id === year) ? year : years[0]?.id || "";
  if (push) history.replaceState(null, "", `#${state.olympiad}/${state.year}`);
  renderPanel();
  if (scroll) $("[data-ol-panel]").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function fromHash() {
  const [o, y] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (o) select(o, y || "", { push: false });
  else select(state.data.olympiads.find((x) => itemsOf(x.id).length)?.id, "", { push: false });
}

function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: "Olimpiada materiallaridan qidirish…",
    label: "Olimpiada materiallari bo‘yicha qidirish",
    onQuery: (q) => {
      state.query = norm(q);
      if (!state.data) return 0;
      if (state.query) return renderSearch();
      renderPanel();
      return itemsOf(state.olympiad).filter((it) => yearKey(it) === state.year).length;
    },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  try {
    const res = await fetch(new URL("data/manifest.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    state.data = await res.json();
  } catch (error) {
    console.error("[olimpiada] ro'yxat yuklanmadi:", error);
    $("[data-ol-types]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Olimpiada materiallari ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    setupSearch();
    return;
  }
  setupSearch();
  renderTypes();
  $("[data-ol-years]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-year]");
    if (b) select(state.olympiad, b.dataset.year);
  });
  window.addEventListener("hashchange", fromHash);
  fromHash();
}

init();
