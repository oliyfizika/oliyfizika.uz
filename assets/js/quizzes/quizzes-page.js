// ==========================================================================
// Quizlar — katalog sahifasi (quizs/quizs.html)
// Ma'lumot: quizs/data/manifest.json (bitta kichik fayl; savollar fayllari bu sahifada YUKLANMAYDI).
// Quiz o'yini o'zgarmagan: quiz.html?id=N + js/quiz-engine.js.
// Mehmon quizni boshlamoqchi bo'lsa — mavjud kirish oynasi (auth-gate), keyin aynan shu quizga qaytish.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { onSession } from "../core/session.js";
import { bindProtectedLinks } from "../auth/auth-gate.js";

const root = document.getElementById("quizzesPage");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const state = { data: null, subject: "", query: "", signedIn: false };

function hydrateIcons(r = document) {
  $$("[data-icon]", r).forEach((el) => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = "1"; } });
}

function card(q, subjects) {
  const subj = subjects.get(q.subject);
  const perPlay = Math.min(state.data.perPlay, q.questions);
  return `
    <li data-subject="${esc(q.subject)}" data-search-text="${esc(`${q.id} ${q.title} ${subj?.title || ""}`)}">
      <article class="of-card of-quiz">
        <div class="of-quiz__top">
          <span class="of-quiz__num" aria-hidden="true">${q.id}</span>
          <span class="of-badge">${esc(subj?.title || "")}</span>
        </div>
        <h3 class="of-quiz__title"><span class="of-sr-only">${q.id}-quiz: </span>${esc(q.title)}</h3>
        <p class="of-quiz__meta">${icon("quiz")}<span>${perPlay} ta savol${q.questions > perPlay ? ` · bazada ${q.questions} ta` : ""}</span></p>
        <div class="of-quiz__foot">
          <a class="of-btn of-btn--soft" href="quiz.html?id=${q.id}" data-quiz-start aria-label="Boshlash: ${esc(q.title)}">Boshlash ${icon("arrowRight")}</a>
          ${state.signedIn ? "" : `<span class="of-quiz__lock">${icon("lock")}<span>Kirish talab qilinadi</span></span>`}
        </div>
      </article>
    </li>`;
}

function renderChips() {
  const counts = new Map();
  state.data.quizzes.forEach((q) => counts.set(q.subject, (counts.get(q.subject) || 0) + 1));
  const chips = [{ id: "", title: "Barchasi", n: state.data.quizzes.length }, ...state.data.subjects.map((s) => ({ ...s, n: counts.get(s.id) || 0 }))]
    .filter((c) => c.n > 0);
  $("[data-chips]").innerHTML = chips
    .map((c) => `<li><button type="button" class="of-chip" data-subject="${c.id}" aria-pressed="${c.id === state.subject}">${esc(c.title)} <small>${c.n}</small></button></li>`)
    .join("");
  $$("[data-chips] .of-chip").forEach((b) => b.addEventListener("click", () => {
    state.subject = b.dataset.subject;
    $$("[data-chips] .of-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    applyFilters();
  }));
}

function renderList() {
  const subjects = new Map(state.data.subjects.map((s) => [s.id, s]));
  const list = $("[data-quizzes]");
  list.innerHTML = state.data.quizzes.map((q) => card(q, subjects)).join("");
  list.removeAttribute("aria-busy");
  applyFilters();
  revealOnScroll(list.children, { maxIndex: 6 });
}

function applyFilters() {
  let visible = 0;
  $$("[data-quizzes] > li").forEach((li) => {
    const match = (!state.subject || li.dataset.subject === state.subject) && (!state.query || norm(li.dataset.searchText).includes(state.query));
    li.hidden = !match;
    if (match) visible++;
  });
  const featured = $(".of-quiz-featured");
  featured.hidden = Boolean(state.subject) || (state.query && !norm(featured.dataset.searchText).includes(state.query));
  const total = state.data.quizzes.length;
  $("[data-quiz-count]").textContent = visible === total ? `${total} ta mavzu` : `${visible} / ${total} ta mavzu`;
  let note = $("[data-quizzes] + .of-search-empty");
  if (!visible) {
    if (!note) {
      note = document.createElement("p");
      note.className = "of-search-empty of-subtle";
      $("[data-quizzes]").after(note);
    }
    note.textContent = "Bu so‘rov bo‘yicha quiz topilmadi. Boshqa so‘z bilan urinib ko‘ring.";
  } else note?.remove();
  return visible;
}

function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: "Quiz yoki mavzuni qidirish…",
    label: "Quizlar bo‘yicha qidirish",
    onQuery: (q) => { state.query = q; return state.data ? applyFilters() : 0; },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

async function init() {
  hydrateIcons();
  setupSearch();
  bindProtectedLinks(root, "a[data-quiz-start]");
  try {
    const res = await fetch(new URL("data/manifest.json", location.href), { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    state.data = await res.json();
  } catch (error) {
    console.error("[quizlar] ro'yxat yuklanmadi:", error);
    $("[data-quizzes]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Quizlar ro‘yxatini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
    return;
  }
  const totalQ = state.data.quizzes.reduce((s, q) => s + q.questions, 0);
  $("[data-mixed-meta]").textContent = `Barcha ${state.data.quizzes.length} ta mavzudan tasodifiy ${state.data.perPlay} ta savol (bazada ${totalQ} ta savol).`;
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
