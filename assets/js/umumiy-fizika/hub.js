// ==========================================================================
// Umumiy fizika — bo'lim bosh sahifasi
// Ma'lumot: umumiy-fizika/data/courses.js (yagona manba)
// Progress: progress-service.js (Home bilan aynan bir xil hisob-kitob)
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { onSession } from "../core/session.js";
import { showAuthGate, openAuth } from "../auth/auth-gate.js";
import { getLearningSummary, courseStructure } from "../progress/progress-service.js";
import { esc, progressBar, fillBars, statusBadge, courseAction as sharedCourseAction } from "../progress/progress-ui.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();

const STRUCTURE = courseStructure();
let signedIn = false;
let summary = null;

function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = "1"; } });
}

function courseAction(c) {
  // Umumiy tugma (Home va Natijalar bilan bir xil) + qulflangan kurs uchun ko'rish havolasi
  const main = sharedCourseAction(c, { size: "" });
  return c.status === "locked"
    ? `${main}<a class="of-btn of-btn--ghost of-btn--sm" href="${esc(c.page)}">Mavzularni ko‘rish</a>`
    : main;
}

function renderCourses() {
  const list = $("[data-courses]");
  const byId = new Map((summary?.progress.courses || []).map((c) => [c.id, c]));
  list.innerHTML = STRUCTURE.map((s) => {
    const c = byId.get(s.id);
    const searchText = `${s.title} ${s.description} ${s.lessons.map((l) => l.title).join(" ")}`;
    if (!c) {
      // Mehmon: faqat tuzilma
      return `<li data-course-id="${s.id}" data-search-text="${esc(searchText)}">
        <article class="of-card of-uf-course">
          <div class="of-uf-course__head"><span class="of-uf-course__icon">${icon(s.icon)}</span>
            <h3 class="of-uf-course__title"><a href="${esc(s.page)}" data-protected>${esc(s.title)}</a></h3></div>
          <p class="of-uf-course__desc">${esc(s.description)}</p>
          <p class="of-uf-course__stats"><span><b>${s.total}</b> ta mavzu · video dars va test</span></p>
          <div class="of-uf-course__foot"><a class="of-btn of-btn--soft" href="${esc(s.page)}" data-protected>Mavzularni ko‘rish ${icon("arrowRight")}</a>
            ${signedIn ? "" : `<span class="of-uf-locknote">${icon("lock")}<span>Kirish talab qilinadi</span></span>`}</div>
        </article></li>`;
    }
    return `<li data-course-id="${c.id}" data-search-text="${esc(searchText)}">
      <article class="of-card of-uf-course" data-status="${c.status}">
        <div class="of-uf-course__head"><span class="of-uf-course__icon">${icon(c.icon)}</span>
          <h3 class="of-uf-course__title"><a href="${esc(c.page)}">${esc(c.title)}</a></h3>
          ${statusBadge(c)}</div>
        <p class="of-uf-course__desc">${esc(c.description)}</p>
        <p class="of-uf-course__stats"><span><b>${c.done}</b> / ${c.total} mavzu yakunlangan</span>${c.next && c.status !== "locked" ? `<span>Keyingi: ${esc(c.next.label)}</span>` : ""}</p>
        <div class="of-uf-course__bar">${progressBar(c.percent, `${c.title} progressi`)}<span class="of-num">${c.percent}%</span></div>
        <div class="of-uf-course__foot">${courseAction(c)}</div>
      </article></li>`;
  }).join("");
  list.removeAttribute("aria-busy");
  revealOnScroll(list.children);
  fillBars(list);
}

function renderOverall() {
  const p = summary.progress;
  $("[data-overall-pct]").textContent = `${p.overall.percent}%`;
  const b = $("[data-overall-bar]");
  b.setAttribute("aria-valuenow", p.overall.percent);
  b.dataset.to = p.overall.percent;
  $("[data-overall-text]").innerHTML = `<b>${p.overall.done}</b> / ${p.overall.total} mavzu yakunlangan${p.current ? ` · Keyingi: ${esc(p.current.next.label)} — ${esc(p.current.next.title)}` : ""}`;
  const cur = p.current;
  $("[data-overall-action]").innerHTML = cur
    ? `<a class="of-btn of-btn--primary" href="${esc(cur.next.href)}">${p.overall.done === 0 ? "Boshlash" : "Davom etish"} ${icon("arrowRight")}</a>`
    : "";
  fillBars($(".of-uf-hero"));
}

// ------------------------------------------------------------ Qidiruv: kurslar + mavzular
function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: "Kurs yoki mavzuni qidirish…",
    label: "Umumiy fizika bo‘yicha qidirish",
    onQuery: (q) => {
      const results = $("[data-results]");
      const list = $("[data-results-list]");
      let visible = 0;
      $$("[data-courses] > li").forEach((li) => {
        const match = !q || norm(li.dataset.searchText).includes(q);
        li.hidden = !match;
        if (match) visible++;
      });
      if (!q) { results.hidden = true; list.innerHTML = ""; return visible; }
      const hits = [];
      STRUCTURE.forEach((c) => c.lessons.forEach((l) => {
        if (norm(`${l.label} ${l.title}`).includes(q)) hits.push({ c, l });
      }));
      results.hidden = false;
      list.innerHTML = hits.length
        ? hits.slice(0, 30).map(({ c, l }) => `<li><a href="${esc(l.href)}" ${signedIn ? "" : "data-protected"}><b>${esc(l.label)}</b><span>${esc(l.title)}</span><small>${esc(c.title)}</small></a></li>`).join("")
        : `<li class="of-subtle">Hech narsa topilmadi. Boshqa so‘z bilan urinib ko‘ring.</li>`;
      return visible + hits.length;
    },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

// ------------------------------------------------------------ Mehmon: himoyalangan havolalar
function bindGuestGate() {
  document.getElementById("ufHub").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-protected]");
    if (!a || signedIn) return;
    e.preventDefault();
    showAuthGate(a.href);
  });
  $$("[data-auth-open]").forEach((b) => b.addEventListener("click", () => openAuth(b.dataset.authOpen)));
}

function setMode(auth) {
  $$("[data-auth-only]").forEach((el) => { el.hidden = !auth; });
  $$("[data-guest-only]").forEach((el) => { el.hidden = auth; });
}

function init() {
  hydrateIcons();
  bindGuestGate();
  setupSearch();

  let loadedFor = null;
  onSession(async (state) => {
    if (state.status === "loading") return;
    const auth = state.status === "authenticated";
    signedIn = auth;
    setMode(auth);
    if (!auth) { summary = null; loadedFor = null; renderCourses(); return; }
    if (!state.profileLoaded || loadedFor === state.user.uid) return;
    loadedFor = state.user.uid;
    try {
      summary = await getLearningSummary(state);
      renderOverall();
      renderCourses();
    } catch (error) {
      console.error("[umumiy-fizika] progress yuklanmadi:", error);
      $("[data-overall-text]").textContent = "Progressni yuklab bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.";
      $("[data-overall-pct]").textContent = "—";
      renderCourses();
    }
  });
}

init();
