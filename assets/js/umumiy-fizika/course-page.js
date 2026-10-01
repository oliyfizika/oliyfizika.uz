// ==========================================================================
// Umumiy fizika — kurs sahifasi (mexanika.html, molekulyar.html, elektr.html, optika.html, atom.html)
//
// Mavzular: umumiy-fizika/data/courses.js (yagona manba)
// Holatlar: progress-service.js computeProgress() — Home va bo'lim sahifasi bilan bir xil.
//   Ochilish qoidasi o'zgarmagan: N-mavzu ochiq, agar N <= mechanicsUnlockedLesson (yoki fullAccess).
// Videolar: YouTube (avvalgi ID'lar), faqat bosilganda yuklanadi.
// Testlar: avvalgi testUrl havolalari; test fayli hali yo'q bo'lsa — "tayyorlanmoqda" holati.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { onSession } from "../core/session.js";
import { getLearningSummary } from "../progress/progress-service.js";
import { COURSES, getCourse } from "../../../umumiy-fizika/data/courses.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shortLabel = (label) => String(label).replace(/-?mavzu$/i, "");

const courseId = document.body.dataset.course;
const COURSE = getCourse(courseId);
const root = document.getElementById("coursePage");
let courseData = null;

// ------------------------------------------------------------ Kurslar navigatsiyasi (statik)
function renderSwitch() {
  const i = COURSES.findIndex((c) => c.id === courseId);
  const prev = COURSES[i - 1];
  const next = COURSES[i + 1];
  const nav = $("[data-course-switch]");
  nav.innerHTML = `
    <a class="of-btn of-btn--ghost of-btn--sm of-cp-switch__arrow" ${prev ? `href="${prev.id}.html"` : 'aria-disabled="true" tabindex="-1"'} aria-label="${prev ? `Oldingi kurs: ${esc(prev.title)}` : "Oldingi kurs yo‘q"}">${icon("chevronLeft")}<span class="of-sr-only">Oldingi</span></a>
    <ul class="of-cp-switch__list">
      ${COURSES.map((c) => `<li><a href="${c.id}.html" ${c.id === courseId ? 'aria-current="page"' : ""}>${icon(c.icon)}${esc(c.title)}</a></li>`).join("")}
    </ul>
    <a class="of-btn of-btn--ghost of-btn--sm of-cp-switch__arrow" ${next ? `href="${next.id}.html"` : 'aria-disabled="true" tabindex="-1"'} aria-label="${next ? `Keyingi kurs: ${esc(next.title)}` : "Keyingi kurs yo‘q"}"><span class="of-sr-only">Keyingi</span>${icon("chevronRight")}</a>`;
  // Faol kursni ko'rinadigan joyga surish (mobil)
  requestAnimationFrame(() => $("[aria-current='page']", nav)?.scrollIntoView({ block: "nearest", inline: "center" }));
}

// ------------------------------------------------------------ Sarlavha
function renderHero() {
  const hero = $("[data-course-hero]");
  const c = courseData;
  const action = !c
    ? ""
    : c.status === "done"
      ? `<a class="of-btn of-btn--soft" href="#${c.lessons[0].anchor}" data-open-lesson="${c.lessons[0].anchor}">Takrorlash</a><p>Barcha mavzular yakunlangan.</p>`
      : c.status === "locked"
        ? `<p class="of-uf-locknote">${icon("lock")}<span>Kurs qulflangan — avval «${esc(c.blockedBy?.title || "oldingi kurs")}» kursini yakunlang.</span></p>`
        : `<a class="of-btn of-btn--primary" href="#${lessonAnchor(c.next)}" data-open-lesson="${lessonAnchor(c.next)}">${c.done === 0 ? "Boshlash" : "Davom etish"} ${icon("arrowRight")}</a><p>Keyingi: <b>${esc(c.next.label)}</b> · ${esc(c.next.title)}</p>`;

  hero.innerHTML = `
    <div class="of-cp-hero__top">
      <span class="of-cp-hero__icon">${icon(COURSE.icon)}</span>
      <div class="of-cp-hero__text">
        <h1>${esc(COURSE.title)}</h1>
        <p>${esc(COURSE.description)} Video darslar, testlar va bosqichma-bosqich ochiladigan mavzular.</p>
      </div>
    </div>
    ${c ? `
    <div class="of-cp-hero__progress">
      <p><b>${c.done}</b> / ${c.total} mavzu yakunlangan</p>
      <strong class="of-num">${c.percent}%</strong>
      <div class="of-progress of-progress--lg" role="progressbar" aria-label="${esc(COURSE.title)} progressi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.percent}" style="--value:0" data-to="${c.percent}"><span></span></div>
    </div>
    <div class="of-cp-hero__actions">${action}</div>` : `
    <div class="of-cp-hero__progress" aria-hidden="true"><span class="of-skeleton of-skeleton--text" style="width:40%"></span><span></span><span class="of-skeleton" style="height:12px;grid-column:1/-1"></span></div>`}`;
  requestAnimationFrame(() => requestAnimationFrame(() => $$(".of-progress[data-to]", hero).forEach((b) => b.style.setProperty("--value", b.dataset.to))));
}

const lessonAnchor = (next) => courseData.lessons.find((l) => l.number === next.number && l.label === next.label)?.anchor;

// ------------------------------------------------------------ Mavzular
const STATE_TEXT = {
  done: ["checkCircle", "Yakunlangan"],
  current: ["play", "Joriy mavzu"],
  available: ["info", "Ochiq"],
  locked: ["lock", "Qulflangan"],
};
const ACTION = { done: "Takrorlash", current: "Davom etish", available: "Boshlash" };

function lessonItem(l) {
  const [ic, text] = STATE_TEXT[l.state];
  const panelId = `${l.anchor}-panel`;
  const action = l.state === "locked"
    ? `<span class="of-lesson__lock" aria-hidden="true">${icon("lock")}</span>`
    : `<button type="button" class="of-btn ${l.state === "current" ? "of-btn--primary" : l.state === "done" ? "of-btn--soft" : ""} of-lesson__action"
         aria-expanded="false" aria-controls="${panelId}" data-toggle-lesson>${ACTION[l.state]} ${icon("chevronDown")}</button>`;
  return `
    <li class="of-lesson" id="${l.anchor}" data-state="${l.state}" tabindex="-1"
        data-search-item data-search-text="${esc(`${l.label} ${l.title}`)}">
      <div class="of-lesson__row">
        <span class="of-lesson__num" aria-hidden="true">${esc(shortLabel(l.label))}</span>
        <div class="of-lesson__main">
          <h3 class="of-lesson__title"><span class="of-sr-only">${esc(l.label)}: </span>${esc(l.title)}</h3>
          <p class="of-lesson__meta"><span class="of-lesson__status">${icon(ic)}${text}</span>${l.state === "locked" && l.lockedReason ? `<span>${esc(l.lockedReason)}</span>` : ""}</p>
        </div>
        ${action}
      </div>
      ${l.state === "locked" ? "" : `<div class="of-lesson__panel" id="${panelId}" hidden></div>`}
    </li>`;
}

function renderLessons() {
  const box = $("[data-lessons]");
  const lessons = courseData.lessons;
  const chapters = courseData.chapters;
  let html;
  if (Array.isArray(chapters) && chapters.length) {
    html = chapters.map((ch, i) => {
      const items = lessons.filter((l) => l.number >= ch.from && l.number <= ch.to);
      const done = items.filter((l) => l.state === "done").length;
      return `<details class="of-cp-chapter" ${items.some((l) => l.state === "current") || i === 0 ? "open" : ""}>
        <summary><span>${esc(ch.title)}</span><span class="of-badge">${done} / ${items.length}</span></summary>
        <ol class="of-lesson-list">${items.map(lessonItem).join("")}</ol></details>`;
    }).join("");
  } else {
    html = `<ol class="of-lesson-list">${lessons.map(lessonItem).join("")}</ol>`;
  }
  box.innerHTML = `<div class="of-section-title"><h2>Mavzular <span class="of-subtle">(${lessons.length})</span></h2></div>${html}`;
  box.removeAttribute("aria-busy");
  revealOnScroll($$(".of-lesson", box), { maxIndex: 6 });
}

// ------------------------------------------------------------ Mavzu paneli: video + test
// Mavjud testlar ro'yxati: umumiy-fizika/test/manifest.json (bitta so'rov, keshlanadi).
// Manifest bo'lmasa — test fayli HEAD so'rovi bilan tekshiriladi.
let manifestPromise = null;
function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(new URL("test/manifest.json", location.href), { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && Array.isArray(d.available) ? new Set(d.available.map(Number)) : null))
      .catch(() => null);
  }
  return manifestPromise;
}
function testId(testUrl) {
  return new URL(testUrl, location.href).searchParams.get("id");
}
async function testExists(testUrl) {
  const id = testId(testUrl);
  if (!id) return false;
  const available = await loadManifest();
  if (available) return available.has(Number(id));
  const r = await fetch(new URL(`test/test-${id}.json`, location.href), { method: "HEAD" }).catch(() => null);
  return r ? r.ok : null;
}

async function fillPanel(li, lesson) {
  const panel = $(".of-lesson__panel", li);
  if (panel.dataset.ready) return;
  panel.dataset.ready = "1";
  panel.innerHTML = `
    <div class="of-video" data-video>
      <button type="button" class="of-video__poster" aria-label="Videoni ko‘rish: ${esc(lesson.label)} — ${esc(lesson.title)}">
        <img src="https://i.ytimg.com/vi/${encodeURIComponent(lesson.youtubeId)}/hqdefault.jpg" alt="" loading="lazy" decoding="async">
        <span class="of-video__play">${icon("play")}</span>
      </button>
    </div>
    <div class="of-lesson__side">
      <h4>${esc(lesson.label)} testi</h4>
      <div data-test-slot><span class="of-skeleton" style="height:42px;width:180px"></span></div>
      <p>Kamida 80% natija keyingi mavzuni ochadi va XP beradi.</p>
    </div>`;

  $(".of-video__poster", panel).addEventListener("click", () => {
    const box = $("[data-video]", panel);
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(lesson.youtubeId)}?autoplay=1`;
    iframe.title = `${lesson.label} | ${lesson.title}`;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    box.replaceChildren(iframe);
    iframe.focus();
  });

  const slot = $("[data-test-slot]", panel);
  const missing = `<p class="of-lesson__note">${icon("info")}<span>Bu mavzu testi tayyorlanmoqda. Test qo‘shilgach, shu yerda paydo bo‘ladi.</span></p>`;
  if (!lesson.testUrl) { slot.innerHTML = missing; return; }
  const exists = await testExists(lesson.testUrl);
  slot.innerHTML = exists === false
    ? missing
    : `<a class="of-btn of-btn--primary" href="${esc(lesson.testUrl)}">${lesson.state === "done" ? "Testni qayta ishlash" : "Testni boshlash"} ${icon("arrowRight")}</a>`;
}

function toggleLesson(li, open, { focus = false } = {}) {
  const btn = $("[data-toggle-lesson]", li);
  const panel = $(".of-lesson__panel", li);
  if (!btn || !panel) return;
  const lesson = courseData.lessons.find((l) => l.anchor === li.id);
  const willOpen = open ?? panel.hidden;
  btn.setAttribute("aria-expanded", String(willOpen));
  panel.hidden = !willOpen;
  if (willOpen) {
    panel.classList.remove("is-opening");
    void panel.offsetWidth;
    panel.classList.add("is-opening");
    fillPanel(li, lesson);
    if (focus) li.focus({ preventScroll: true });
  }
}

function goToLesson(anchor, { open = true } = {}) {
  const li = document.getElementById(anchor);
  if (!li) return;
  li.hidden = false;
  li.classList.remove("is-pending");
  if (open && li.dataset.state !== "locked") toggleLesson(li, true);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  li.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  li.focus({ preventScroll: true });
  li.classList.add("is-target");
  setTimeout(() => li.classList.remove("is-target"), 2600);
}

function bindInteractions() {
  root.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-toggle-lesson]");
    if (toggle) { toggleLesson(toggle.closest(".of-lesson")); return; }
    const opener = e.target.closest("[data-open-lesson]");
    if (opener) {
      e.preventDefault();
      history.replaceState(null, "", `#${opener.dataset.openLesson}`);
      goToLesson(opener.dataset.openLesson);
    }
  });
  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id.startsWith("mavzu-")) goToLesson(id);
  });
}

function handleInitialHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id.startsWith("mavzu-")) goToLesson(id);
}

// ------------------------------------------------------------ Qidiruv (faqat shu kurs mavzulari)
function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: `${COURSE.title} mavzularini qidirish…`,
    label: `${COURSE.title} mavzulari bo‘yicha qidirish`,
    target: "[data-lessons]",
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

// ------------------------------------------------------------ Ishga tushirish
function init() {
  if (!COURSE) {
    console.error("[kurs] noma'lum kurs:", courseId);
    return;
  }
  document.title = `${COURSE.title} | OliyFizika.uz`;
  window.OFShell?.setTitle?.(COURSE.title);
  renderSwitch();
  renderHero();
  setupSearch();
  bindInteractions();

  let loadedFor = null;
  onSession(async (state) => {
    if (state.status !== "authenticated" || !state.profileLoaded || loadedFor === state.user.uid) return;
    loadedFor = state.user.uid;
    try {
      const summary = await getLearningSummary(state);
      courseData = summary.progress.courses.find((c) => c.id === courseId);
      renderHero();
      renderLessons();
      handleInitialHash();
    } catch (error) {
      console.error("[kurs] progress yuklanmadi:", error);
      $("[data-lessons]").innerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Mavzularni yuklab bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.</span></div>`;
    }
  });
}

init();
