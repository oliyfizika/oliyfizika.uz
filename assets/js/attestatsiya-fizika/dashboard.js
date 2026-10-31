// Attestatsiya → Fizika dashboard (attestatsiya/fizikaattestatsiya.html)
// So'rovlar: settings (1), published testlar (≤32 kichik meta hujjat), o'z urinishlari (where userId == uid).
// Savollar, kalitlar va yechimlar bu sahifada YUKLANMAYDI.
import { t as tr } from "../core/i18n.js";
import { getSettings, listVisibleTests, listMyAttempts } from "./api.js";
import { finalizeOverdueList } from "./finalize.js";
import { esc, pickToday, officialOpen, solutionOpenFor, formatTashkent, formatDuration, computeStats, SECTION_ICON, TOTAL_DAYS_DEFAULT, isMock, mockCompositionText, mockPoints, mockMax, timeLimitOf, formatLimit, formatClock, remainingSeconds, sectionLabel } from "./core.js";
import { ic, fillIcons, whenUser, tabsHtml, stateHtml, errorMessage } from "./ui.js";
import { loadAccessContext, dayOpen, accessText, isPaidMock, ACCESS_TITLE, ACCESS_TEXT, COURSE_URL } from "./access.js";

const root = document.getElementById("attDash");
fillIcons(root);
root.querySelector("[data-tabs]").innerHTML = tabsHtml(location.hash === "#kunlik" ? "days" : "home");

const todayEl = root.querySelector("[data-today]");
const daysEl = root.querySelector("[data-days]");

const testHref = (t) => `fizika-test.html?day=${t.dayNumber}`;
const solHref = (t) => `fizika-yechimlar.html?day=${t.dayNumber}`;

// Kirish konteksti (accessContext): Day 1–3 bepul, 4+ — ruxsat. O'z urinishi bor kun (tarix) — odatdagidek.
let access = null;

function dayState(test, attempt, now) {
  if (!test) return "locked";
  if (!attempt && !dayOpen(test, access)) return "restricted";
  if (attempt?.status === "graded") return "done";
  if (attempt?.status === "submitted") return "submitted";
  if (officialOpen(test, now)) return attempt ? "progress" : "open";
  return "closed";
}

function solutionChip(test, now, attempt) {
  if (solutionOpenFor(test, attempt, now)) return `<span class="of-badge of-badge--green">${ic("unlock")} ${tr("att.d.solOpen", "Yechimlar ochiq")}</span>`;
  // Kunlik testda yechim vaqt bilan ochilmaydi — faqat testni yakunlagach; mock'da — sana ham ko'rsatiladi
  return isMock(test)
    ? `<span class="of-badge of-badge--orange">${ic("lock")} ${esc(tr("att.d.solAt", "Yechim: {when}", { when: formatTashkent(test.solutionAvailableAt) }))}</span>`
    : `<span class="of-badge of-badge--orange">${ic("lock")} ${tr("att.d.solAfter", "Yechim: testdan keyin")}</span>`;
}

function renderToday(today, attempt, now) {
  todayEl.removeAttribute("aria-busy");
  if (!today) {
    todayEl.dataset.state = "none";
    todayEl.innerHTML = `
      <span class="att-daybadge" aria-hidden="true"><small>${tr("att.d.dayWord", "Day")}</small><b>—</b></span>
      <div class="att-today__body">
        <span class="att-today__label">${tr("att.d.course", "Attestatsiya — Fizika")}</span>
        <p class="att-today__title">${tr("att.d.noToday", "Bugungi test hali e’lon qilinmagan.")}</p>
        <p class="att-today__meta">${tr("att.d.noTodayMeta", "Administrator yangi kunni e’lon qilganda shu yerda paydo bo‘ladi. Oldingi kunlarning yechimlari pastda.")}</p>
      </div>`;
    return;
  }
  const st = dayState(today, attempt, now);
  if (st === "restricted") {
    todayEl.dataset.state = "restricted";
    todayEl.innerHTML = `
      <span class="att-daybadge" aria-hidden="true"><small>${tr("att.d.dayWord", "Day")}</small><b>${today.dayNumber}</b></span>
      <div class="att-today__body">
        <span class="att-today__label">${tr("att.d.todayLabel", "Bugungi test · Attestatsiya — Fizika")}</span>
        <p class="att-today__title">${esc(tr("att.d.dayTitle", "Day {n} — {section}", { n: today.dayNumber, section: sectionLabel(today) }))}</p>
        <div class="att-today__meta">
          <span>${ic(SECTION_ICON[today.section] || "atom")}${esc(today.topics.join(", "))}</span>
          <span>${ic("list")}${tr("att.d.qCount", "{n} savol", { n: today.questionCount })}</span>
          <span class="of-badge att-badge-lock">${ic("lock")} ${esc(ACCESS_TITLE)}</span>
        </div>
        <p class="att-access-note">${esc(ACCESS_TEXT)}</p>
      </div>
      <div class="att-today__actions"><a class="of-btn of-btn--primary of-btn--lg" href="${COURSE_URL}" target="_blank" rel="noopener noreferrer">${tr("att.d.enroll", "📲 Kursga yozilish")}</a></div>`;
    return;
  }
  todayEl.dataset.state = st === "done" || st === "submitted" ? "done" : "open";
  const status = {
    open: `<span class="of-badge of-badge--blue">${tr("att.d.stNew", "Yangi")}</span>`,
    progress: `<span class="of-badge of-badge--orange">${tr("att.d.stProgress", "Davom etmoqda")}</span>`,
    submitted: `<span class="of-badge of-badge--green">${tr("att.d.stSubmitted", "Topshirilgan")}</span>`,
    done: `<span class="of-badge of-badge--green">${ic("check")} ${esc(tr("att.d.stDoneScore", "Bajarilgan · {p}%", { p: attempt?.scorePercent ?? "—" }))}</span>`,
  }[st] || "";
  const action = {
    open: `<a class="of-btn of-btn--primary of-btn--lg" href="${testHref(today)}">${ic("play")}${tr("att.d.start", "Boshlash")}</a>`,
    progress: `<a class="of-btn of-btn--primary of-btn--lg" href="${testHref(today)}">${ic("play")}${tr("att.d.resume", "Davom ettirish")}</a>`,
    submitted: `<a class="of-btn of-btn--soft of-btn--lg" href="${testHref(today)}">${tr("att.d.viewResult", "Natijani ko‘rish")}</a>`,
    done: `<a class="of-btn of-btn--soft of-btn--lg" href="${testHref(today)}">${tr("att.d.viewResult", "Natijani ko‘rish")}</a>`,
  }[st] + (solutionOpenFor(today, attempt, now) ? `<a class="of-btn of-btn--ghost of-btn--lg" href="${solHref(today)}">${ic("book")}${tr("att.d.solutions", "Yechimlar")}</a>` : "");
  todayEl.innerHTML = `
    <span class="att-daybadge" aria-hidden="true"><small>${tr("att.d.dayWord", "Day")}</small><b>${today.dayNumber}</b></span>
    <div class="att-today__body">
      <span class="att-today__label">${tr("att.d.todayLabel", "Bugungi test · Attestatsiya — Fizika")}</span>
      <p class="att-today__title">${esc(tr("att.d.dayTitle", "Day {n} — {section}", { n: today.dayNumber, section: sectionLabel(today) }))}</p>
      <div class="att-today__meta">
        <span>${ic(SECTION_ICON[today.section] || "atom")}${esc(today.topics.join(", "))}</span>
        <span>${ic("list")}${tr("att.d.qCount", "{n} savol", { n: today.questionCount })}</span>
        <span>${ic("clock")}${esc(formatLimit(timeLimitOf(today) || 7200))}</span>
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
    if (st === "restricted") {
      // To'liq karta, lekin yopiq: start yo'q, urinish yaratilmaydi (Rules ham rad etadi)
      items.push(`<li><article class="of-card att-day" data-state="restricted" data-day="${day}" aria-labelledby="attDay${day}">
        <div class="att-day__head">
          <span class="att-day__num">${day}</span>
          <div><p class="att-day__title" id="attDay${day}">${esc(tr("att.d.dayDot", "Day {n} · {section}", { n: day, section: sectionLabel(t) }))}</p><p class="att-day__sub">${tr("att.d.qCount", "{n} savol", { n: t.questionCount })}${t.status === "archived" ? tr("att.d.arch", " · arxiv") : ""}</p></div>
          <span class="att-day__lock" aria-hidden="true">${ic("lock")}</span>
        </div>
        <p class="att-day__topics">${esc(t.topics.join(", "))}</p>
        <div class="att-day__stats"><span class="of-badge att-badge-lock">${ic("lock")} ${esc(ACCESS_TITLE)}</span></div>
        <p class="att-access-note">${esc(ACCESS_TEXT)}</p>
        <div class="att-day__foot"><a class="of-btn of-btn--soft of-btn--sm" href="${COURSE_URL}" target="_blank" rel="noopener noreferrer" data-access-cta>${tr("att.d.enroll", "📲 Kursga yozilish")}</a></div>
      </article></li>`);
      continue;
    }
    if (st === "done") {
      chips.push(`<span class="of-badge of-badge--green">${ic("check")} ${tr("att.d.done", "Bajarilgan")}</span>`);
      chips.push(`<span class="of-badge">${esc(tr("att.d.counts", "To‘g‘ri {c} · Noto‘g‘ri {w} · Javobsiz {u}", { c: a.correctAnswers, w: a.wrongAnswers, u: a.unanswered }))}</span>`);
      chips.push(`<span class="of-badge">${ic("clock")} ${esc(formatDuration(a.timeSpentSeconds))}</span>`);
      foot = `<a class="of-btn of-btn--soft of-btn--sm" href="${testHref(t)}">${tr("att.d.result", "Natija")}</a>`;
    } else if (st === "submitted") {
      chips.push(`<span class="of-badge of-badge--green">${tr("att.d.stSubmitted", "Topshirilgan")}</span>`);
      foot = `<a class="of-btn of-btn--soft of-btn--sm" href="${testHref(t)}">${tr("att.d.viewResult", "Natijani ko‘rish")}</a>`;
    } else if (st === "open" || st === "progress") {
      chips.push(st === "open" ? `<span class="of-badge of-badge--blue">${tr("att.d.stOpen", "Ochiq")}</span>` : `<span class="of-badge of-badge--orange">${tr("att.d.stProgress", "Davom etmoqda")}</span>`);
      chips.push(`<span class="of-badge">${ic("clock")} ${esc(formatLimit(timeLimitOf(t)))}</span>`);
      if (st === "progress") chips.push(`<span class="of-badge of-badge--orange">${ic("clock")} ${esc(tr("att.d.timeLeft", "Qolgan vaqt: {t}", { t: formatClock(remainingSeconds(a, t, now)) }))}</span>`);
      foot = `<a class="of-btn of-btn--primary of-btn--sm" href="${testHref(t)}">${st === "open" ? tr("att.d.start", "Boshlash") : tr("att.d.resume", "Davom ettirish")}</a>`;
    } else {
      chips.push(`<span class="of-badge">${tr("att.d.closed", "Test yopilgan (arxiv)")}</span>`);
    }
    chips.push(solutionChip(t, now, a));
    if (solutionOpenFor(t, a, now)) foot += `<a class="of-btn of-btn--ghost of-btn--sm" href="${solHref(t)}">${ic("book")}${tr("att.d.solutions", "Yechimlar")}</a>`;
    items.push(`<li><article class="of-card att-day" data-state="${st === "done" || st === "submitted" ? "done" : "open"}" aria-labelledby="attDay${day}">
      <div class="att-day__head">
        <span class="att-day__num">${day}</span>
        <div><p class="att-day__title" id="attDay${day}">${esc(tr("att.d.dayDot", "Day {n} · {section}", { n: day, section: sectionLabel(t) }))}</p><p class="att-day__sub">${tr("att.d.qCount", "{n} savol", { n: t.questionCount })}${t.status === "archived" ? tr("att.d.arch", " · arxiv") : ""}</p></div>
        ${st === "done" ? `<span class="att-score of-num" aria-label="${esc(tr("att.d.scoreAria", "Natija {p} foiz", { p: a.scorePercent }))}">${a.scorePercent}%</span>` : ""}
      </div>
      <p class="att-day__topics">${esc(t.topics.join(", "))}</p>
      <div class="att-day__stats">${chips.join("")}</div>
      <div class="att-day__foot">${foot}</div>
    </article></li>`);
  }
  daysEl.innerHTML = items.join("") || `<li class="of-subtle">${tr("att.d.noDays", "Hali birorta kun e’lon qilinmagan.")}</li>`;
  const lockedEl = root.querySelector("[data-locked]");
  lockedEl.hidden = !locked.length;
  lockedEl.querySelector("[data-locked-title]").textContent = tr("att.d.lockedTitle", "Hali e’lon qilinmagan kunlar ({n})", { n: locked.length });
  lockedEl.querySelector("ul").innerHTML = locked.map((d) => `<li aria-label="${esc(tr("att.d.lockedAria", "Day {n}: e’lon qilinmagan", { n: d }))}">${ic("lock")}${esc(tr("att.d.day", "Day {n}", { n: d }))}</li>`).join("");
  daysEl.removeAttribute("aria-busy");
}

// Karta tagidagi qisqa tavsif: tarkib (composition) bo'yicha — mock-01: 40 fizika + 10 pedagogika; mock-02: 35 fizika + 5 kasbiy standart + 10 pedagogik mahorat.
const mockTitle = (t) => (t.mockNumber > 1 ? tr("att.d.mockN", "Mock test {n}", { n: t.mockNumber }) : tr("att.d.mock", "Mock test"));

function mockSubtitle(t) {
  const text = mockCompositionText(t);
  return `${text}${isPaidMock(t) ? tr("att.d.paidGroup", " · pullik guruh") : ""}${t.status === "archived" ? tr("att.d.arch", " · arxiv") : ""}`;
}

// Mock test (50 savol, 100 ball): kurs kunlaridan alohida bo'lim. paidOnly bo'lmasa — hamma kirgan foydalanuvchi uchun bepul; paidOnly — faqat pullik guruh.
function renderMock(tests, attemptsByTest, now) {
  const section = root.querySelector("[data-mock-section]");
  const list = tests.filter(isMock).sort((a, b) => b.dayNumber - a.dayNumber);
  section.hidden = !list.length;
  if (!list.length) return;
  root.querySelector("[data-mock]").innerHTML = list.map((t) => {
    const a = attemptsByTest.get(t.id);
    const sub = mockSubtitle(t);
    if (!a && !dayOpen(t, access)) {
      // Pullik mock, ruxsatsiz: to'liq karta, lekin yopiq (start yo'q; Rules ham rad etadi)
      return `<li><article class="of-card att-day" data-state="restricted" data-mock-card data-mock-restricted aria-labelledby="attMock${t.dayNumber}">
      <div class="att-day__head">
        <span class="att-day__num">M</span>
        <div><p class="att-day__title" id="attMock${t.dayNumber}">${esc(mockTitle(t))}</p><p class="att-day__sub">${esc(sub)}</p></div>
        <span class="att-day__lock" aria-hidden="true">${ic("lock")}</span>
      </div>
      <p class="att-day__topics">${esc((t.topics || []).join(", "))}</p>
      <div class="att-day__stats"><span class="of-badge">${ic("list")} ${tr("att.d.qCount", "{n} savol", { n: t.questionCount })}</span><span class="of-badge">${tr("att.d.points", "{n} ball", { n: mockMax(t) })}</span><span class="of-badge att-badge-lock">${ic("lock")} ${esc(ACCESS_TITLE)}</span></div>
      <p class="att-access-note">${esc(accessText(t))}</p>
      <div class="att-day__foot"><a class="of-btn of-btn--soft of-btn--sm" href="${COURSE_URL}" target="_blank" rel="noopener noreferrer" data-access-cta>${tr("att.d.enroll", "📲 Kursga yozilish")}</a></div>
    </article></li>`;
    }
    const st = a?.status === "graded" ? "done" : a?.status === "submitted" ? "submitted"
      : officialOpen(t, now) ? (a ? "progress" : "open") : "closed";
    const chips = [`<span class="of-badge">${ic("list")} ${tr("att.d.qCount", "{n} savol", { n: t.questionCount })}</span>`, `<span class="of-badge">${tr("att.d.points", "{n} ball", { n: mockMax(t) })}</span>`];
    if (timeLimitOf(t)) chips.push(`<span class="of-badge">${ic("clock")} ${esc(formatLimit(timeLimitOf(t)))}</span>`);
    let foot = "";
    if (st === "done") {
      chips.push(`<span class="of-badge of-badge--green">${ic("check")} ${tr("att.d.done", "Bajarilgan")}</span>`);
      chips.push(`<span class="of-badge">${esc(tr("att.d.counts", "To‘g‘ri {c} · Noto‘g‘ri {w} · Javobsiz {u}", { c: a.correctAnswers, w: a.wrongAnswers, u: a.unanswered }))}</span>`);
      foot = `<a class="of-btn of-btn--soft of-btn--sm" href="${testHref(t)}">${tr("att.d.result", "Natija")}</a>`;
    } else if (st === "submitted") {
      chips.push(`<span class="of-badge of-badge--green">${tr("att.d.stSubmitted", "Topshirilgan")}</span>`);
      foot = `<a class="of-btn of-btn--soft of-btn--sm" href="${testHref(t)}">${tr("att.d.viewResult", "Natijani ko‘rish")}</a>`;
    } else if (st === "open" || st === "progress") {
      chips.push(st === "open" ? `<span class="of-badge of-badge--blue">${tr("att.d.stOpen", "Ochiq")}</span>` : `<span class="of-badge of-badge--orange">${tr("att.d.stProgress", "Davom etmoqda")}</span>`);
      if (st === "progress" && timeLimitOf(t)) chips.push(`<span class="of-badge of-badge--orange" data-mock-left>${ic("clock")} ${esc(tr("att.d.timeLeft", "Qolgan vaqt: {t}", { t: formatClock(remainingSeconds(a, t, now)) }))}</span>`);
      foot = `<a class="of-btn of-btn--primary of-btn--sm" href="${testHref(t)}">${st === "open" ? tr("att.d.start", "Boshlash") : tr("att.d.resume", "Davom ettirish")}</a>`;
    } else {
      chips.push(`<span class="of-badge">${tr("att.d.deadline", "Rasmiy muddat tugagan")}</span>`);
    }
    chips.push(solutionChip(t, now, a));
    if (solutionOpenFor(t, a, now)) foot += `<a class="of-btn of-btn--ghost of-btn--sm" href="${solHref(t)}">${ic("book")}${tr("att.d.solutions", "Yechimlar")}</a>`;
    return `<li><article class="of-card att-day" data-state="${st === "done" || st === "submitted" ? "done" : "open"}" data-mock-card aria-labelledby="attMock${t.dayNumber}">
      <div class="att-day__head">
        <span class="att-day__num">M</span>
        <div><p class="att-day__title" id="attMock${t.dayNumber}">${esc(mockTitle(t))}</p><p class="att-day__sub">${esc(sub)}</p></div>
        ${st === "done" ? `<span class="att-score of-num" aria-label="${esc(tr("att.d.scorePtsAria", "Natija {n} ball", { n: mockPoints(a.correctAnswers, t) }))}">${mockPoints(a.correctAnswers, t)}<small>/${mockMax(t)}</small></span>` : ""}
      </div>
      <p class="att-day__topics">${esc((t.topics || []).join(", "))}</p>
      <div class="att-day__stats">${chips.join("")}</div>
      <div class="att-day__foot">${foot}</div>
    </article></li>`;
  }).join("");
}

function renderHero(stats) {
  const num = root.querySelector("[data-progress-num]");
  num.textContent = `${stats.completed}/${stats.totalDays}`;
  const bar = root.querySelector("[data-progress-bar]");
  bar.style.setProperty("--value", stats.progressPercent);
  bar.setAttribute("aria-valuemax", stats.totalDays);
  bar.setAttribute("aria-valuenow", stats.completed);
  bar.setAttribute("aria-valuetext", tr("att.d.progressText", "{a} / {b} kun bajarilgan", { a: stats.completed, b: stats.totalDays }));
  root.querySelector("[data-avg]").textContent = stats.averageScore == null ? "—" : `${stats.averageScore}%`;
  root.querySelector("[data-best]").textContent = stats.bestScore == null ? "—" : `${stats.bestScore}%`;
}

(async () => {
  const s = await whenUser();
  try {
    const [settings, tests, loaded, ctx] = await Promise.all([getSettings(), listVisibleTests(), listMyAttempts(s.user.uid), loadAccessContext(s.user.uid)]);
    access = ctx;
    const now = Date.now();
    const totalDays = settings.totalDays || TOTAL_DAYS_DEFAULT;
    const testsById = new Map(tests.map((t) => [t.id, t]));
    const { attempts } = await finalizeOverdueList(loaded, testsById, now);   // muddati o'tgan in_progress → graded
    const attemptsByTest = new Map(attempts.map((a) => [a.testId, a]));
    renderHero(computeStats(attempts, testsById, totalDays));
    const today = pickToday(tests, now);
    renderToday(today, today ? attemptsByTest.get(today.id) : null, now);
    renderDays(totalDays, tests, attemptsByTest, now);
    renderMock(tests, attemptsByTest, now);
    if (location.hash === "#kunlik") document.getElementById("kunlik").focus();
  } catch (e) {
    console.error("[att] dashboard:", e);
    todayEl.removeAttribute("aria-busy");
    todayEl.innerHTML = stateHtml("alert", tr("att.d.loadError", "Ma’lumotni yuklab bo‘lmadi"), errorMessage(e));
    daysEl.innerHTML = "";
  }
})();
