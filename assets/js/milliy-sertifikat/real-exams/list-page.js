// ==========================================================================
// Real imtihonlar — ro'yxat (milliy-sertifikat/real-imtihonlar/index.html).
// Hamma kartochkalar katalog metadata'sidan quriladi (12 ta yoki 13-chi — kod o'zgarmaydi).
// ==========================================================================
import { getAdapter } from "./data.js";
import { runGate, fillIcons, ic } from "./ui.js";
import { esc, examTitle, examYear, summaryText, SOURCE_GROUP } from "./labels.js";

fillIcons();

function card(e) {
  const hasReview = e.solutionSummary.NEEDS_MANUAL_REVIEW > 0;
  const hasErr = e.solutionSummary.NO_CORRECT_OPTION > 0;
  const q = encodeURIComponent(e.examId);
  return `<li data-search-text="${esc(`${examTitle(e)} ${e.date} ${e.subtitle || ""}`)}">
    <article class="of-card rx-card" aria-labelledby="rx-t-${esc(e.examId)}" data-exam="${esc(e.examId)}">
      <p class="rx-card__eyebrow">${ic("certificate")} Milliy sertifikat · Fizika</p>
      <h3 class="rx-card__title" id="rx-t-${esc(e.examId)}">${esc(examTitle(e))}</h3>
      <ul class="rx-card__facts">
        <li><b>${e.includedCount}</b> ta savol${e.excludedCount ? ` <span class="rx-muted">(+${e.excludedCount} ORG chiqarilgan)</span>` : ""}</li>
        <li>${esc(summaryText(e.solutionSummary))}</li>
      </ul>
      <div class="rx-card__badges">
        ${hasErr ? `<span class="of-badge of-badge--orange">Manba xatosi bor</span>` : ""}
        ${hasReview ? `<span class="of-badge of-badge--purple">Qo‘shimcha tekshiruv</span>` : ""}
        ${e.officialSource === false ? `<span class="of-badge" title="${esc(SOURCE_GROUP[e.sourceGroup] || "")}">Norasmiy manba</span>` : ""}
        ${(e.warnings || []).length ? `<span class="of-badge of-badge--red" title="${esc(e.warnings.join("\n"))}">${ic("alert")} ${e.warnings.length} ta ogohlantirish</span>` : ""}
      </div>
      <div class="rx-card__actions">
        <a class="of-btn of-btn--soft of-btn--sm" href="imtihon.html?id=${q}">${ic("file")}PDF ko‘rish</a>
        <a class="of-btn of-btn--primary of-btn--sm" href="yechimlar.html?id=${q}">${ic("book")}Yechimlarni ko‘rish</a>
      </div>
    </article>
  </li>`;
}

runGate(async () => {
  const adapter = await getAdapter();
  const exams = await adapter.listExams();
  const root = document.querySelector("[data-list]");
  const years = [...new Set(exams.map(examYear))];
  root.innerHTML = years.map((y) => `
    <section class="rx-year" aria-labelledby="rx-y-${y}">
      <h2 class="rx-year__title" id="rx-y-${y}">${esc(y)}</h2>
      <ul class="rx-grid">${exams.filter((e) => examYear(e) === y).map(card).join("")}</ul>
    </section>`).join("") || `<p class="of-subtle">Hozircha real imtihonlar yo‘q.</p>`;
  const total = exams.reduce((s, e) => s + e.includedCount, 0);
  document.querySelector("[data-count]").textContent = `${exams.length} ta variant · ${total} ta savol`;
});
