// ==========================================================================
// OliyFizika.uz — Bosh sahifa (dashboard)
// Qayta ishlatiladi: session.js (sessiya/profil), auth-gate.js (kirish talabi),
// progress-service.js (mavjud unlock + results), app-shell.js (qidiruv, header, bildirishnomalar).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { onSession, firstName } from "../core/session.js";
import { showAuthGate, openAuth } from "../auth/auth-gate.js";
import { getLearningSummary, totalLessons } from "../progress/progress-service.js";
import { COURSES } from "../../../umumiy-fizika/data/courses.js";
import { mountProjectileSim } from "./projectile-sim.js";
import { progressBar, courseItem, fillBars } from "../progress/progress-ui.js";

const home = document.getElementById("home");
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const fmt = (n) => new Intl.NumberFormat("uz-UZ").format(n);

// ------------------------------------------------------------ ikonlar
function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => {
    if (el.dataset.iconDone) return;
    el.innerHTML = icon(el.dataset.icon);
    el.dataset.iconDone = "1";
  });
}

// ------------------------------------------------------------ kartalar animatsiyasi
function animateFeatureCards() {
  const items = $$("[data-feature-grid] > li");
  items.forEach((li, i) => li.style.setProperty("--i", i));
  if (!("IntersectionObserver" in window)) {
    items.forEach((li) => li.classList.add("of-animate-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.remove("is-pending");
      e.target.classList.add("of-animate-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((li) => { li.classList.add("is-pending"); io.observe(li); });
}

// ------------------------------------------------------------ himoyalangan kartalar
let signedIn = false;
function bindProtected() {
  home.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-protected]");
    if (!link || signedIn) return;
    event.preventDefault();
    showAuthGate(link.href);
  });
  $$("[data-auth-open]").forEach((btn) => btn.addEventListener("click", () => openAuth(btn.dataset.authOpen)));
}

// ------------------------------------------------------------ mehmon / kirgan holat
function setMode(mode) {
  home.dataset.authState = mode;
  $$("[data-auth-only]").forEach((el) => { el.hidden = mode !== "authenticated"; });
  $$("[data-guest-only]").forEach((el) => { el.hidden = mode === "authenticated"; });
  $$("[data-protected]").forEach((a) => {
    const action = $(".of-feature__action", a);
    if (!action) return;
    let lock = $(".of-feature__lock", a);
    if (mode !== "authenticated" && !lock) {
      lock = document.createElement("span");
      lock.className = "of-feature__lock";
      lock.innerHTML = `${icon("lock")}<span class="of-sr-only">Kirish talab qilinadi</span>`;
      lock.title = "Kirish talab qilinadi";
      action.before(lock);
    } else if (mode === "authenticated" && lock) {
      lock.remove();
    }
  });
}

function renderHero(state, summary) {
  const title = $("[data-hero-title]");
  const lead = $("[data-hero-lead]");
  if (state.status !== "authenticated") {
    title.textContent = "Fizikani o‘rganing, sinang va tajriba qiling.";
    lead.textContent = "Video darslar, testlar, interaktiv simulyatsiyalar va milliy sertifikatga tayyorgarlik — barchasi bir joyda.";
    return;
  }
  title.textContent = `Xush kelibsiz, ${firstName(state)}!`;
  if (!summary) {
    lead.textContent = "Bugun fizikaning qaysi sirini ochamiz?";
    return;
  }
  const { progress } = summary;
  const cur = progress.current;
  if (progress.overall.done === 0) {
    lead.textContent = "Birinchi mavzudan boshlang — har bir test natijangiz shu yerda ko‘rinadi.";
  } else if (!cur) {
    lead.textContent = "Ajoyib! Umumiy fizikaning barcha ochiq mavzularini yakunladingiz.";
  } else {
    lead.textContent = `${cur.title} kursining ${cur.percent}% qismini yakunladingiz. Keyingi: ${cur.next.label} — ${cur.next.title}.`;
  }
}

// ------------------------------------------------------------ statistika
function renderStats(summary) {
  const box = $("[data-stats]");
  const s = summary.stats;
  const set = (key, value, hint) => {
    const el = $(`[data-stat="${key}"]`, box);
    el.innerHTML = `${esc(value)}${hint ? `<small>${esc(hint)}</small>` : ""}`;
  };
  set("topics", fmt(s.topicsDone), `/ ${fmt(s.topicsTotal)}`);
  set("tests", fmt(s.testsTaken), s.testsTaken ? `${fmt(s.testsPassed)} tasi ≥80%` : "");
  set("xp", fmt(s.xp));
  set("level", fmt(s.level), "/ 10");
  box.removeAttribute("aria-busy");
}

function renderStatsError() {
  const box = $("[data-stats]");
  $$("[data-stat]", box).forEach((el) => { if (el.querySelector(".of-skeleton")) el.textContent = "—"; });
  box.removeAttribute("aria-busy");
}

// ------------------------------------------------------------ progress (umumiy UI: progress-ui.js)
function renderProgress(summary) {
  const { progress } = summary;
  const box = $("[data-progress]");
  const cur = progress.current;
  const totalAction = cur
    ? `<a class="of-btn of-btn--primary" href="${esc(cur.next.href)}" aria-label="Umumiy fizika: ${cur.done === 0 && progress.overall.done === 0 ? "Boshlash" : "Davom etish"} — ${esc(cur.title)}, ${esc(cur.next.label)}">${progress.overall.done === 0 ? "Boshlash" : "Davom etish"} ${icon("arrowRight")}</a>`
    : `<a class="of-btn of-btn--soft" href="umumiy-fizika/umumiy-fizika.html">Kurslarni ko‘rish</a>`;

  box.innerHTML = `
    <article class="of-card of-card--pad of-course-total" data-search-item data-search-text="umumiy fizika progress">
      <div class="of-course-total__head">
        <span class="of-course-total__icon">${icon("atom")}</span>
        <div>
          <h3>Umumiy fizika</h3>
          <p class="of-subtle">${fmt(progress.overall.done)} / ${fmt(progress.overall.total)} mavzu yakunlangan</p>
        </div>
        <strong class="of-course-total__pct of-num">${progress.overall.percent}%</strong>
      </div>
      ${progressBar(progress.overall.percent, "Umumiy fizika progressi")}
      <div class="of-course-total__foot">
        <p class="of-subtle">${cur ? `Keyingi: <b>${esc(cur.next.label)}</b> · ${esc(cur.next.title)}` : "Barcha ochiq mavzular yakunlangan."}</p>
        ${totalAction}
      </div>
    </article>
    <ul class="of-course-list">
      ${progress.courses.map((c) => courseItem(c)).join("")}
    </ul>`;
  box.removeAttribute("aria-busy");

  fillBars(box);
}

function renderProgressError() {
  const box = $("[data-progress]");
  box.innerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Progressni yuklab bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.</span></div>`;
  box.removeAttribute("aria-busy");
}

// ------------------------------------------------------------ platforma faktlari (haqiqiy sonlar)
async function renderFacts() {
  $('[data-fact="lessons"]').textContent = fmt(totalLessons());
  $('[data-fact="courses"]').textContent = fmt(COURSES.length);
  try {
    const res = await fetch("milliy-sertifikat/mock-testlar/data/tests.json", { cache: "force-cache" });
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.tests;
    if (!Array.isArray(list) || !list.length) return;
    $('[data-fact="mock"]').textContent = fmt(list.length);
    $('[data-fact-wrap="mock"]').hidden = false;
  } catch {
    /* ixtiyoriy ma'lumot */
  }
}

// ------------------------------------------------------------ ishga tushirish
function init() {
  hydrateIcons();
  bindProtected();
  animateFeatureCards();
  renderFacts();

  const simRoot = $("[data-sim]");
  if (simRoot) {
    try { window.__ofSim = mountProjectileSim(simRoot); } catch (error) { console.error("[home] simulyatsiya:", error); }
  }

  let loadedFor = null;
  onSession(async (state) => {
    signedIn = state.status === "authenticated";
    if (state.status === "loading") return;
    setMode(state.status === "authenticated" ? "authenticated" : "guest");

    if (state.status !== "authenticated") {
      loadedFor = null;
      renderHero(state);
      return;
    }
    renderHero(state);
    // Profil to'liq o'qilgach bir marta yuklaymiz (qayta-qayta so'rov yo'q)
    if (!state.profileLoaded || loadedFor === state.user.uid) return;
    loadedFor = state.user.uid;
    // Ro'yxatdan o'tish yakunlanmagan bo'lsa (parol yo'q) — qobiq parol bosqichini taklif qiladi;
    // statistika baribir 0 qiymatlar bilan ko'rsatiladi.
    try {
      const summary = await getLearningSummary(state);
      renderHero(state, summary);
      renderStats(summary);
      renderProgress(summary);
    } catch (error) {
      console.error("[home] progress yuklanmadi:", error);
      renderStatsError();
      renderProgressError();
    }
  });
}

init();
