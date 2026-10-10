// ==========================================================================
// Attestatsiya → Fizika: Mening attestatsiya testlarim + statistika (attestatsiya/fizika-natijalar.html)
// Manba: FAQAT attestationPhysicsAttempts (where userId == uid) + published test meta. `results` ishlatilmaydi.
// Kurs progressi (bajarilgan kunlar) va natija (foiz) — alohida tushunchalar.
// ==========================================================================
import { getSettings, listVisibleTests, listMyAttempts } from "./api.js";
import { finalizeOverdueList } from "./finalize.js";
import { esc, computeStats, solutionOpen, formatDuration, formatTashkent, TOTAL_DAYS_DEFAULT, isMock, isMockDay, dayLabelOf, mockPoints, mockMax } from "./core.js";
import { ic, fillIcons, whenUser, tabsHtml, stateHtml, errorMessage } from "./ui.js";

const root = document.getElementById("attRes");
const view = root.querySelector("[data-view]");
root.querySelector("[data-tabs]").innerHTML = tabsHtml("results");
fillIcons(root);

const bar = (label, value, max, suffix = "%") => `<li><span title="${esc(label)}">${esc(label)}</span>
  <div class="of-progress" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}" style="--value:${Math.round((value * 100) / (max || 1))}"><span></span></div>
  <b>${value}${suffix}</b></li>`;

function columns(days, field, max, cls, fmt) {
  if (!days.length) return '<p class="of-subtle">Hali ma’lumot yo‘q.</p>';
  return `<div class="att-cols" role="img" aria-label="${days.map((d) => `Day ${d.day}: ${fmt(d[field])}`).join("; ")}">${days.map((d) =>
    `<div class="att-col ${cls}" title="Day ${d.day}: ${esc(fmt(d[field]))}"><i style="height:${Math.max(2, Math.round(((d[field] || 0) * 100) / (max || 1)))}%"></i><small>${d.day}</small></div>`).join("")}</div>`;
}

(async () => {
  const s = await whenUser();
  try {
    const [settings, tests, loaded] = await Promise.all([getSettings(), listVisibleTests(), listMyAttempts(s.user.uid)]);
    const testsById = new Map(tests.map((t) => [t.id, t]));
    const { attempts } = await finalizeOverdueList(loaded, testsById);    // muddati o'tgan in_progress → graded
    const st = computeStats(attempts, testsById, settings.totalDays || TOTAL_DAYS_DEFAULT);
    if (!attempts.length) {
      view.innerHTML = stateHtml("chart", "Hali test topshirmagansiz", "Bugungi testni ishlang — natijalar va statistika shu yerda paydo bo‘ladi.",
        '<a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">Bugungi test</a>');
      fillIcons(view);
      return;
    }
    const maxTime = Math.max(...st.days.map((d) => d.time || 0), 1);
    const history = attempts.slice().sort((a, b) => isMockDay(a.dayNumber) - isMockDay(b.dayNumber) || b.dayNumber - a.dayNumber);   // avval kunlar, so'ng mock
    view.innerHTML = `
      <ul class="att-tiles" aria-label="Umumiy ko‘rsatkichlar">
        <li class="of-card att-tile"><span>Kurs progressi</span><b class="of-num">${st.completed}/${st.totalDays}</b><small>bajarilgan kunlar</small></li>
        <li class="of-card att-tile"><span>O‘rtacha natija</span><b class="of-num">${st.averageScore ?? "—"}${st.averageScore == null ? "" : "%"}</b><small>${st.graded} ta test bo‘yicha</small></li>
        <li class="of-card att-tile"><span>Eng yuqori / eng past</span><b class="of-num">${st.bestScore ?? "—"}${st.bestScore == null ? "" : "%"} / ${st.worstScore ?? "—"}${st.worstScore == null ? "" : "%"}</b><small>foiz natija</small></li>
        <li class="of-card att-tile"><span>Vaqt</span><b class="of-num">${st.averageTime == null ? "—" : formatDuration(st.averageTime).replace(/ daqiqa/, " daq").replace(/ soniya$/, " s")}</b><small>o‘rtacha · jami ${esc(formatDuration(st.totalTime))}</small></li>
      </ul>
      <div class="att-panels">
        <section class="of-card att-panel" aria-labelledby="pDayScore"><h2 id="pDayScore">Kunlar bo‘yicha natija (%)</h2>${columns(st.days, "score", 100, "", (v) => `${v}%`)}</section>
        <section class="of-card att-panel" aria-labelledby="pDayTime"><h2 id="pDayTime">Kunlar bo‘yicha sarflangan vaqt</h2>${columns(st.days, "time", maxTime, "att-col--time", (v) => formatDuration(v))}</section>
        <section class="of-card att-panel" aria-labelledby="pSec"><h2 id="pSec">Bo‘limlar bo‘yicha</h2>
          <ul class="att-bars">${st.sections.map((x) => bar(x.label, x.percent, 100)).join("") || '<li class="of-subtle">Hali ma’lumot yo‘q.</li>'}</ul></section>
        <section class="of-card att-panel" aria-labelledby="pTopic"><h2 id="pTopic">Mavzular bo‘yicha (avval zaifroqlari)</h2>
          <ul class="att-bars">${st.topics.map((x) => bar(x.label, x.percent, 100)).join("") || '<li class="of-subtle">Hali ma’lumot yo‘q.</li>'}</ul></section>
      </div>
      <section class="of-card att-panel" aria-labelledby="pHist">
        <h2 id="pHist">Mening attestatsiya testlarim</h2>
        <div style="overflow-x:auto"><table class="att-history">
          <caption class="of-sr-only">Topshirilgan rasmiy testlar: kun, bo‘lim, natija, to‘g‘ri/noto‘g‘ri/javobsiz, vaqt, yechim holati</caption>
          <thead><tr><th scope="col">Kun</th><th scope="col">Natija</th><th scope="col">To‘g‘ri / Noto‘g‘ri / Javobsiz</th><th scope="col">Vaqt</th><th scope="col">Topshirilgan</th><th scope="col">Yechim</th></tr></thead>
          <tbody>${history.map((a) => {
            const t = testsById.get(a.testId);
            const solLink = t && solutionOpen(t)
              ? `<a href="fizika-yechimlar.html?day=${a.dayNumber}">Ochiq</a>`
              : t ? `<span class="of-subtle">${esc(formatTashkent(t.solutionAvailableAt))}</span>` : "—";
            const mock = isMock(t) || isMockDay(a.dayNumber);
            const res = a.status === "graded" ? `<b class="of-num">${mock ? `${mockPoints(a.correctAnswers, t)} / ${mockMax(t)} ball` : `${a.scorePercent}%`}</b>` : a.status === "submitted" ? '<a href="fizika-test.html?day=' + a.dayNumber + '">Natijani ko‘rish</a>' : '<span class="of-badge of-badge--orange">Davom etmoqda</span>';
            return `<tr><td><a href="fizika-test.html?day=${a.dayNumber}"><b>${esc(dayLabelOf(a.dayNumber))}</b></a>${t ? `<br><span class="of-subtle">${mock ? "50 savol · 100 ball" : esc(t.sectionTitle)}</span>` : ""}</td>
              <td>${res}</td>
              <td class="of-num">${a.status === "graded" ? `${a.correctAnswers} / ${a.wrongAnswers} / ${a.unanswered}` : "—"}</td>
              <td class="of-num">${a.status === "graded" ? esc(formatDuration(a.timeSpentSeconds)) : "—"}</td>
              <td>${a.completedAt ? esc(formatTashkent(a.completedAt)) : "—"}</td>
              <td>${solLink}</td></tr>`;
          }).join("")}</tbody>
        </table></div>
      </section>`;
    fillIcons(view);
  } catch (e) {
    console.error("[att] natijalar:", e);
    view.innerHTML = stateHtml("alert", "Natijalarni yuklab bo‘lmadi", errorMessage(e));
    fillIcons(view);
  }
})();
