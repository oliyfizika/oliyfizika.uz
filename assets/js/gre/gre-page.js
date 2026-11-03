// ==========================================================================
// GRE Physics — katalog sahifasi (gre/gre.html)
// Ma'lumot: gre/data/manifest.json. Test: test.html?bob=N (0 — aralash) + gre-test.js.
// ==========================================================================
import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { onSession } from "../core/session.js";
import { bindProtectedLinks } from "../auth/auth-gate.js";
import { readBest } from "./gre-store.js";

const root = document.getElementById("grePage");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const state = { data: null, area: "", query: "", signedIn: false };

function hydrateIcons(r = document) {
  $$("[data-icon]", r).forEach((el) => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = "1"; } });
}

function card(ch, areas, best) {
  const area = areas.get(ch.area);
  const score = best[ch.id];
  return `
    <li data-area="${esc(ch.area)}" data-search-text="${esc(`${ch.id} ${ch.title} ${area?.title || ""}`)}">
      <article class="of-card of-quiz">
        <div class="of-quiz__top">
          <span class="of-quiz__num" aria-hidden="true">${ch.id}</span>
          <span class="of-badge">${esc(area?.title || "")}</span>
        </div>
        <h3 class="of-quiz__title"><span class="of-sr-only">${ch.id}-bob: </span>${esc(ch.title)}</h3>
        <p class="of-quiz__meta">${icon("quiz")}<span>${ch.questions} ta savol</span>${score != null ? `<span class="gre-best" title="Eng yaxshi natijangiz">${icon("medal")}${score}%</span>` : ""}</p>
        <div class="of-quiz__foot">
          <a class="of-btn of-btn--soft" href="test.html?bob=${ch.id}" data-gre-start aria-label="Boshlash: ${esc(ch.title)}">Boshlash ${icon("arrowRight")}</a>
          ${state.signedIn ? "" : `<span class="of-quiz__lock">${icon("lock")}<span>Kirish talab qilinadi</span></span>`}
        </div>
      </article>
    </li>`;
}

function renderAreas() {
  const max = Math.max(...state.data.areas.map((a) => a.weight));
  const row = (title, weight) => `
    <li class="gre-area"><span>${esc(title)}</span><b>${weight}%</b>
      <span class="gre-area__bar" aria-hidden="true"><span style="width:${(weight / max) * 100}%"></span></span></li>`;
  $("[data-areas]").innerHTML = state.data.areas.map((a) => row(a.title, a.weight)).join("")
    + (state.data.extraAreas || []).map((a) => row(a.title, a.weight)).join("");
}

function renderChips() {
  const counts = new Map();
  state.data.chapters.forEach((c) => counts.set(c.area, (counts.get(c.area) || 0) + 1));
  const chips = [{ id: "", title: "Barchasi", n: state.data.chapters.length }, ...state.data.areas.map((a) => ({ ...a, n: counts.get(a.id) || 0 }))]
    .filter((c) => c.n > 0);
  $("[data-chips]").innerHTML = chips
    .map((c) => `<li><button type="button" class="of-chip" data-area="${c.id}" aria-pressed="${c.id === state.area}">${esc(c.title)} <small>${c.n}</small></button></li>`)
    .join("");
  $$("[data-chips] .of-chip").forEach((b) => b.addEventListener("click", () => {
    state.area = b.dataset.area;
    $$("[data-chips] .of-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    applyFilters();
  }));
}

function renderList() {
  const areas = new Map(state.data.areas.map((a) => [a.id, a]));
  const best = readBest();
  const list = $("[data-chapters]");
  list.innerHTML = state.data.chapters.map((c) => card(c, areas, best)).join("");
  list.removeAttribute("aria-busy");
  applyFilters();
  revealOnScroll(list.children, { maxIndex: 6 });
}

function applyFilters() {
  let visible = 0;
  $$("[data-chapters] > li").forEach((li) => {
    const match = (!state.area || li.dataset.area === state.area) && (!state.query || norm(li.dataset.searchText).includes(state.query));
    li.hidden = !match;
    if (match) visible++;
  });
  const featured = $(".of-quiz-featured");
  featured.hidden = Boolean(state.area) || Boolean(state.query && !norm(featured.dataset.searchText).includes(state.query));
  const total = state.data.chapters.length;
  $("[data-gre-count]").textContent = visible === total ? `${total} ta bob` : `${visible} / ${total} ta bob`;
  let note = $("[data-chapters] + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      $("[data-chapters]").after(note);
    }
    note.textContent = "Bu so‘rov bo‘yicha bob topilmadi. Boshqa so‘z bilan urinib ko‘ring.";
  } else note?.remove();
  return visible;
}

function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: "Bob yoki mavzuni qidirish…",
    label: "GRE boblari bo‘yicha qidirish",
    onQuery: (q) => { state.query = q; return state.data ? applyFilters() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  hydrateIcons();
  setupSearch();
  bindProtectedLinks(root, "a[data-gre-start]");
  try {
    const res = await fetch(new URL("data/manifest.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    state.data = await res.json();
  } catch (error) {
    console.error("[gre] ro'yxat yuklanmadi:", error);
    $("[data-chapters]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Boblar ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  const totalQ = state.data.chapters.reduce((s, c) => s + c.questions, 0);
  $("[data-mixed-meta]").textContent = `Barcha ${state.data.chapters.length} ta bobdan tasodifiy ${state.data.mixedCount} ta savol (bazada ${totalQ} ta savol), GRE tezligida.`;
  renderAreas();
  renderChips();
  renderList();

  onSession((s) => {
    if (s.status === "loading") return;
    const signed = s.status === "authenticated";
    if (signed !== state.signedIn) {
      state.signedIn = signed;
      renderList();
    }
  });
}

init();
