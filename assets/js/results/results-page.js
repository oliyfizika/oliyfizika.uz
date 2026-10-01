// ==========================================================================
// Mening natijalarim — shaxsiy o'qish natijalari
//
// So'rovlar: 1 ta profil (session.js) + 1 ta `results` so'rovi (progress-service.loadResults, keshlanadi).
// Hammasi shu ikki manbadan hisoblanadi: progress, statistika, test tarixi, yutuqlar, faollik.
// Hech narsa yozilmaydi. Faqat joriy foydalanuvchining ma'lumoti o'qiladi (where uid == auth.uid).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";
import { onSession, firstName } from "../core/session.js";
import { getLearningSummary, loadResults } from "../progress/progress-service.js";
import { esc, progressBar, fillBars, courseItem } from "../progress/progress-ui.js";
import { prepareResults, deriveAchievements, levelInfo, formatDate } from "./results-data.js";
import { COURSES } from "../../../umumiy-fizika/data/courses.js";
import { LEVELS } from "../../../js/services/xp-service.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (n) => new Intl.NumberFormat("uz-UZ").format(n).replace(/,/g, "\u202f"); // 1 000
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/\s+/g, " ").trim();
const PAGE_SIZE = 10;

const state = {
  results: [],
  summary: null,
  achievements: [],
  filter: { course: "", status: "", query: "" },
  shown: PAGE_SIZE,
};

function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = "1"; } });
}

// ------------------------------------------------------------ Qisqa ko'rsatkichlar
function renderSummary(profile) {
  const { progress, stats } = state.summary;
  const set = (key, html) => { $(`[data-sum="${key}"]`).innerHTML = html; };
  set("overall", `${progress.overall.percent}%`);
  set("topics", `${fmt(stats.topicsDone)}<small>/ ${fmt(stats.topicsTotal)}</small>`);
  set("tests", `${fmt(stats.testsTaken)}${stats.testsTaken ? `<small>${fmt(stats.testsPassed)} tasi ≥80%</small>` : ""}`);
  set("xp", fmt(stats.xp));

  const lv = levelInfo(stats.xp, profile?.level ?? stats.level, LEVELS);
  set("level", `${lv.level}<small>/ ${LEVELS.length}</small>`);
  $("[data-level-label]").textContent = lv.max ? "Daraja · eng yuqori" : `Daraja · keyingisigacha ${fmt(lv.toNext)} XP`;
  $("[data-level-bar]").innerHTML = progressBar(lv.percent, lv.max ? "Eng yuqori daraja" : `${lv.level + 1}-darajagacha progress`);
  $("[data-summary]").removeAttribute("aria-busy");
  fillBars($("[data-summary]"));
}

// ------------------------------------------------------------ Kurslarim
function renderCourses() {
  const list = $("[data-courses]");
  list.innerHTML = state.summary.progress.courses.map((c) => courseItem(c, { showNextTitle: true })).join("");
  list.removeAttribute("aria-busy");
  fillBars(list);
}

// ------------------------------------------------------------ Yutuqlar
function renderAchievements() {
  const list = $("[data-achievements]");
  const earned = state.achievements.filter((a) => a.earned).length;
  $("[data-ach-count]").textContent = `${earned} / ${state.achievements.length} ochilgan`;
  list.innerHTML = state.achievements.map((a) => {
    const prog = !a.earned && a.progress ? `<span class="of-ach__prog">${fmt(a.progress[0])} / ${fmt(a.progress[1])}</span>` : "";
    return `
      <li class="of-ach" data-earned="${a.earned}" data-search-item data-search-text="${esc(`${a.title} ${a.description} yutuq`)}">
        <span class="of-ach__icon" aria-hidden="true">${icon(a.earned ? a.icon : "lock")}</span>
        <div class="of-ach__body">
          <h3 class="of-ach__title">${esc(a.title)}</h3>
          <p class="of-ach__desc">${esc(a.description)}</p>
          <p class="of-ach__state">${a.earned
            ? `${icon("check")}<span>Ochilgan${a.date ? ` · ${formatDate(a.date)}` : ""}</span>`
            : `<span>Hali ochilmagan</span>${prog}`}</p>
        </div>
      </li>`;
  }).join("");
  list.removeAttribute("aria-busy");
  revealOnScroll(list.children, { maxIndex: 6 });
}

// ------------------------------------------------------------ Oxirgi faoliyat (faqat mavjud ma'lumotdan)
function renderActivity() {
  const latest = state.results[0];
  if (!latest || !latest.date) return; // ishonchli sana yo'q bo'lsa — bo'lim ko'rsatilmaydi
  const lastPass = state.results.find((r) => r.passed);
  const items = [
    `<li>${icon("clipboard")}<div><p class="of-subtle">Oxirgi test · ${formatDate(latest.date)}</p><p><b>${esc(latest.label)}</b> — ${esc(latest.title)}</p><p class="of-subtle">${latest.percent ?? "—"}% · ${latest.passed ? "O‘tdi" : "O‘tmadi"}</p></div></li>`,
  ];
  if (lastPass && lastPass !== latest) {
    items.push(`<li>${icon("checkCircle")}<div><p class="of-subtle">Oxirgi yakunlangan mavzu · ${formatDate(lastPass.date)}</p><p><b>${esc(lastPass.label)}</b> — ${esc(lastPass.title)}</p></div></li>`);
  }
  $("[data-activity]").innerHTML = `<ul class="of-activity__list">${items.join("")}</ul>`;
  $("[data-activity-wrap]").hidden = false;
}

// ------------------------------------------------------------ Test natijalari
function filteredResults() {
  const { course, status, query } = state.filter;
  return state.results.filter((r) =>
    (!course || r.courseId === course) &&
    (!status || (status === "passed" ? r.passed : !r.passed)) &&
    (!query || norm(`${r.label} ${r.title} ${r.courseTitle} ${r.passed ? "o'tdi" : "o'tmadi qayta"}`).includes(query))
  );
}

function resultRow(r) {
  const status = r.passed
    ? `<span class="of-res-status of-res-status--ok">${icon("checkCircle")}O‘tdi</span>`
    : `<span class="of-res-status of-res-status--fail">${icon("alert")}O‘tmadi</span>${r.href ? `<a class="of-link-btn" href="${esc(r.href)}">Qayta topshirish</a>` : ""}`;
  return `
    <tr>
      <th scope="row" data-label="Mavzu"><span class="of-res-topic"><b>${esc(r.label)}</b> ${esc(r.title)}</span>${r.courseTitle ? `<span class="of-subtle">${esc(r.courseTitle)}</span>` : ""}</th>
      <td data-label="Natija"><b class="of-num">${r.percent ?? "—"}%</b></td>
      <td data-label="To‘g‘ri javoblar" class="of-num">${r.score ?? "—"} / ${r.total ?? "—"}</td>
      <td data-label="Sana" class="of-num">${formatDate(r.date)}</td>
      <td data-label="Holat"><span class="of-res-status-wrap">${status}</span></td>
    </tr>`;
}

function renderTests() {
  const box = $("[data-tests]");
  box.removeAttribute("aria-busy");

  if (!state.results.length) {
    const cur = state.summary.progress.current;
    const href = cur ? cur.next.href : new URL("../../../umumiy-fizika/umumiy-fizika.html", import.meta.url).href;
    box.innerHTML = `
      <div class="of-res-first">
        <span class="of-res-first__icon" aria-hidden="true">${icon("clipboard")}</span>
        <div><p><b>Test topshirganingizdan so‘ng natijalaringiz shu yerda ko‘rinadi.</b></p>
        <p class="of-subtle">Har bir mavzu videosidan keyin testni ishlang — kamida 80% natija keyingi mavzuni ochadi.</p></div>
        <a class="of-btn of-btn--primary" href="${esc(href)}">Umumiy fizikani boshlash ${icon("arrowRight")}</a>
      </div>`;
    $("[data-tests-count]").textContent = "";
    $("[data-filters]").hidden = true;
    $("[data-more-wrap]").hidden = true;
    return;
  }

  $("[data-filters]").hidden = false;
  const rows = filteredResults();
  const visible = rows.slice(0, state.shown);
  $("[data-tests-count]").textContent = rows.length === state.results.length
    ? `${fmt(state.results.length)} ta natija`
    : `${fmt(rows.length)} / ${fmt(state.results.length)} ta natija`;

  box.innerHTML = rows.length
    ? `<table class="of-res-table">
        <caption class="of-sr-only">Test natijalari, eng yangisi birinchi</caption>
        <thead><tr><th scope="col">Mavzu</th><th scope="col">Natija</th><th scope="col">To‘g‘ri javoblar</th><th scope="col">Sana</th><th scope="col">Holat</th></tr></thead>
        <tbody>${visible.map(resultRow).join("")}</tbody>
      </table>`
    : `<p class="of-res-none">Tanlangan filtr bo‘yicha natija topilmadi.</p>`;

  const more = $("[data-more-wrap]");
  more.hidden = rows.length <= state.shown;
  if (!more.hidden) $("[data-more]").textContent = `Ko‘proq ko‘rsatish (${fmt(rows.length - state.shown)} ta qoldi)`;
}

function bindFilters() {
  const courseSel = $("[data-filter-course]");
  courseSel.insertAdjacentHTML("beforeend", COURSES.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join(""));
  courseSel.addEventListener("change", () => { state.filter.course = courseSel.value; state.shown = PAGE_SIZE; renderTests(); });
  $$("[data-filter-status] button").forEach((btn) => btn.addEventListener("click", () => {
    $$("[data-filter-status] button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    state.filter.status = btn.dataset.value;
    state.shown = PAGE_SIZE;
    renderTests();
  }));
  $("[data-more]").addEventListener("click", () => {
    const before = state.shown;
    state.shown += PAGE_SIZE;
    renderTests();
    // Fokusni birinchi yangi qatorga o'tkazish (klaviatura foydalanuvchilari uchun)
    $$(".of-res-table tbody tr")[before]?.querySelector("th")?.setAttribute("tabindex", "-1");
    $$(".of-res-table tbody tr")[before]?.querySelector("th")?.focus();
  });
}

// ------------------------------------------------------------ Kontekstli qidiruv: kurslar, yutuqlar, natijalar
function setupSearch() {
  const apply = () => window.OFShell?.setSearch({
    placeholder: "Kurs, test yoki yutuqni qidirish…",
    label: "Natijalarim bo‘yicha qidirish",
    onQuery: (q) => {
      let count = 0;
      $$("[data-courses] [data-search-item], [data-achievements] [data-search-item]").forEach((el) => {
        const match = !q || norm(el.dataset.searchText).includes(q);
        el.hidden = !match;
        if (match) count++;
      });
      state.filter.query = q;
      state.shown = PAGE_SIZE;
      if (state.summary) renderTests();
      return count + filteredResults().length;
    },
  });
  if (window.OFShell) apply();
  else document.addEventListener("of:shell-ready", apply, { once: true });
}

function renderError() {
  const msg = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Natijalarni yuklab bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.</span></div>`;
  $("[data-tests]").innerHTML = msg;
  $("[data-courses]").innerHTML = "";
  $$("[data-sum]").forEach((el) => { if (el.querySelector(".of-skeleton")) el.textContent = "—"; });
  $$("[aria-busy]").forEach((el) => el.removeAttribute("aria-busy"));
}

// ------------------------------------------------------------ Ishga tushirish
function init() {
  hydrateIcons();
  bindFilters();
  setupSearch();

  let loadedFor = null;
  onSession(async (s) => {
    if (s.status !== "authenticated" || !s.profileLoaded || loadedFor === s.user.uid) return;
    loadedFor = s.user.uid;
    $("[data-res-greeting]").textContent = `${firstName(s)}, o‘qish natijalaringiz, testlar va yutuqlaringiz bir joyda.`;
    try {
      state.summary = await getLearningSummary(s);          // 1 ta results so'rovi
      const raw = await loadResults(s.user.uid);            // keshdan — qayta so'rov yo'q
      state.results = prepareResults(raw);
      state.achievements = deriveAchievements({ results: state.results, progress: state.summary.progress, xp: state.summary.stats.xp });
      renderSummary(s.profile);
      renderCourses();
      renderAchievements();
      renderActivity();
      renderTests();
    } catch (error) {
      console.error("[natijalar] yuklanmadi:", error);
      renderError();
    }
  });
}

init();
