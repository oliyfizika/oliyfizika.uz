// Attestatsiya → Fizika dashboard (attestatsiya/fizikaattestatsiya.html)
// So'rovlar: settings (1), published testlar (≤32 kichik meta hujjat), o'z urinishlari (where userId == uid).
// Savollar, kalitlar va yechimlar bu sahifada YUKLANMAYDI.
import { getSettings, listVisibleTests, listMyAttempts } from "./api.js";
import { esc, pickToday, officialOpen, solutionOpen, formatTashkent, formatDuration, computeStats, SECTION_ICON, TOTAL_DAYS_DEFAULT } from "./core.js";
import { ic, fillIcons, whenUser, tabsHtml, stateHtml, errorMessage } from "./ui.js";

const root = document.getElementById("attDash");
fillIcons(root);
root.querySelector("[data-tabs]").innerHTML = tabsHtml(location.hash === "#kunlik" ? "days" : "home");

const todayEl = root.querySelector("[data-today]");
const daysEl = root.querySelector("[data-days]");

const testHref = (t) => `fizika-test.html?day=${t.dayNumber}`;
const solHref = (t) => `fizika-yechimlar.html?day=${t.dayNumber}`;

function dayState(test, attempt, now) {
  if (!test) return "locked";
  if (attempt?.status === "graded") return "done";
  if (attempt?.status === "submitted") return "submitted";
  if (officialOpen(test, now)) return attempt ? "progress" : "open";
  return "closed";
}

function solutionChip(test, now) {
  if (solutionOpen(test, now)) return `<span class="of-badge of-badge--green">${ic("unlock")} Yechimlar ochiq</span>`;
  return `<span class="of-badge of-badge--orange">${ic("lock")} Yechim: ${esc(formatTashkent(test.solutionAvailableAt))}</span>`;
}

function renderToday(today, attempt, now) {
  todayEl.removeAttribute("aria-busy");
  if (!today) {
    todayEl.dataset.state = "none";
    todayEl.innerHTML = `
      <span class="att-daybadge" aria-hidden="true"><small>Day</small><b>—</b></span>
      <div class="att-today__body">
        <span class="att-today__label">Attestatsiya — Fizika</span>
        <p class="att-today__title">Bugungi test hali e’lon qilinmagan.</p>
        <p class="att-today__meta">Administrator yangi kunni e’lon qilganda shu yerda paydo bo‘ladi. Oldingi kunlarning yechimlari pastda.</p>
      </div>`;
    return;
  }
  const st = dayState(today, attempt, now);
  todayEl.dataset.state = st === "done" || st === "submitted" ? "done" : "open";
  const status = {
    open: '<span class="of-badge of-badge--blue">Yangi</span>',
    progress: '<span class="of-badge of-badge--orange">Davom etmoqda</span>',
    submitted: '<span class="of-badge of-badge--green">Topshirilgan</span>',
    done: `<span class="of-badge of-badge--green">${ic("check")} Bajarilgan · ${attempt?.scorePercent ?? "—"}%</span>`,
  }[st] || "";
  const action = {
    open: `<a class="of-btn of-btn--primary of-btn--lg" href="${testHref(today)}">${ic("play")}Boshlash</a>`,
    progress: `<a class="of-btn of-btn--primary of-btn--lg" href="${testHref(today)}">${ic("play")}Davom ettirish</a>`,
    submitted: `<a class="of-btn of-btn--soft of-btn--lg" href="${testHref(today)}">Natijani ko‘rish</a>`,
    done: `<a class="of-btn of-btn--soft of-btn--lg" href="${testHref(today)}">Natijani ko‘rish</a>`,
  }[st];
  todayEl.innerHTML = `
    <span class="att-daybadge" aria-hidden="true"><small>Day</small><b>${today.dayNumber}</b></span>
    <div class="att-today__body">
      <span class="att-today__label">Bugungi test · Attestatsiya — Fizika</span>
      <p class="att-today__title">Day ${today.dayNumber} — ${esc(today.sectionTitle)}</p>
      <div class="att-today__meta">
        <span>${ic(SECTION_ICON[today.section] || "atom")}${esc(today.topics.join(", "))}</span>
        <span>${ic("list")}${today.questionCount} savol</span>
        <span>${ic("clock")}Vaqt chegarasi yo‘q</span>
        ${status}
      </div>
    </div>
    <div class="att-today__actions">${action}</div>`;
}

function renderDays(totalDays, tests, attemptsByTest, now) {
  const byDay = new Map(tests.map((t) => [t.dayNumber, t]));
  const items = [];
  const locked = [];
  for (let day = 1; day <= totalDays; day++) {
    const t = byDay.get(day);
    const a = t ? attemptsByTest.get(t.id) : null;
    const st = dayState(t, a, now);
    if (st === "locked") {
      locked.push(day);
      continue;
    }
    const chips = [];
    let foot = "";
    if (st === "done") {
      chips.push(`<span class="of-badge of-badge--green">${ic("check")} Bajarilgan</span>`);
      chips.push(`<span class="of-badge">To‘g‘ri ${a.correctAnswers} · Noto‘g‘ri ${a.wrongAnswers} · Javobsiz ${a.unanswered}</span>`);
      chips.push(`<span class="of-badge">${ic("clock")} ${esc(formatDuration(a.timeSpentSeconds))}</span>`);
      foot = `<a class="of-btn of-btn--soft of-btn--sm" href="${testHref(t)}">Natija</a>`;
    } else if (st === "submitted") {
      chips.push('<span class="of-badge of-badge--green">Topshirilgan</span>');
      foot = `<a class="of-btn of-btn--soft of-btn--sm" href="${testHref(t)}">Natijani ko‘rish</a>`;
    } else if (st === "open" || st === "progress") {
      chips.push(st === "open" ? '<span class="of-badge of-badge--blue">Ochiq</span>' : '<span class="of-badge of-badge--orange">Davom etmoqda</span>');
      foot = `<a class="of-btn of-btn--primary of-btn--sm" href="${testHref(t)}">${st === "open" ? "Boshlash" : "Davom ettirish"}</a>`;
    } else {
      chips.push('<span class="of-badge">Rasmiy muddat tugagan</span>');
    }
    chips.push(solutionChip(t, now));
    if (solutionOpen(t, now)) foot += `<a class="of-btn of-btn--ghost of-btn--sm" href="${solHref(t)}">${ic("book")}Yechimlar</a>`;
    items.push(`<li><article class="of-card att-day" data-state="${st === "done" || st === "submitted" ? "done" : "open"}" aria-labelledby="attDay${day}">
      <div class="att-day__head">
        <span class="att-day__num">${day}</span>
        <div><p class="att-day__title" id="attDay${day}">Day ${day} · ${esc(t.sectionTitle)}</p><p class="att-day__sub">${t.questionCount} savol${t.status === "archived" ? " · arxiv" : ""}</p></div>
        ${st === "done" ? `<span class="att-score of-num" aria-label="Natija ${a.scorePercent} foiz">${a.scorePercent}%</span>` : ""}
      </div>
      <p class="att-day__topics">${esc(t.topics.join(", "))}</p>
      <div class="att-day__stats">${chips.join("")}</div>
      <div class="att-day__foot">${foot}</div>
    </article></li>`);
  }
  daysEl.innerHTML = items.join("") || `<li class="of-subtle">Hali birorta kun e’lon qilinmagan.</li>`;
  const lockedEl = root.querySelector("[data-locked]");
  lockedEl.hidden = !locked.length;
  lockedEl.querySelector("[data-locked-title]").textContent = `Hali e’lon qilinmagan kunlar (${locked.length})`;
  lockedEl.querySelector("ul").innerHTML = locked.map((d) => `<li aria-label="Day ${d}: e’lon qilinmagan">${ic("lock")}Day ${d}</li>`).join("");
  daysEl.removeAttribute("aria-busy");
}

function renderHero(stats) {
  const num = root.querySelector("[data-progress-num]");
  num.textContent = `${stats.completed}/${stats.totalDays}`;
  const bar = root.querySelector("[data-progress-bar]");
  bar.style.setProperty("--value", stats.progressPercent);
  bar.setAttribute("aria-valuemax", stats.totalDays);
  bar.setAttribute("aria-valuenow", stats.completed);
  bar.setAttribute("aria-valuetext", `${stats.completed} / ${stats.totalDays} kun bajarilgan`);
  root.querySelector("[data-avg]").textContent = stats.averageScore == null ? "—" : `${stats.averageScore}%`;
  root.querySelector("[data-best]").textContent = stats.bestScore == null ? "—" : `${stats.bestScore}%`;
}

(async () => {
  const s = await whenUser();
  try {
    const [settings, tests, attempts] = await Promise.all([getSettings(), listVisibleTests(), listMyAttempts(s.user.uid)]);
    const now = Date.now();
    const totalDays = settings.totalDays || TOTAL_DAYS_DEFAULT;
    const attemptsByTest = new Map(attempts.map((a) => [a.testId, a]));
    const testsById = new Map(tests.map((t) => [t.id, t]));
    renderHero(computeStats(attempts, testsById, totalDays));
    const today = pickToday(tests, now);
    renderToday(today, today ? attemptsByTest.get(today.id) : null, now);
    renderDays(totalDays, tests, attemptsByTest, now);
    if (location.hash === "#kunlik") document.getElementById("kunlik").focus();
  } catch (e) {
    console.error("[att] dashboard:", e);
    todayEl.removeAttribute("aria-busy");
    todayEl.innerHTML = stateHtml("alert", "Ma’lumotni yuklab bo‘lmadi", errorMessage(e));
    daysEl.innerHTML = "";
  }
})();
