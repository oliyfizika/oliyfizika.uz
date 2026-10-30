// ==========================================================================
// Progress UI — kurs progress kartalari (Bosh sahifa va "Mening natijalarim" uchun umumiy).
// Ma'lumot faqat progress-service.js computeProgress() natijasidan olinadi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { t } from "../core/i18n.js";

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function progressBar(percent, label, extraClass = "") {
  return `<div class="of-progress ${extraClass}" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-valuetext="${percent}%" style="--value:0" data-to="${percent}"><span></span></div>`;
}

/** Progress chiziqlarini silliq to'ldirish (reduced-motion'da CSS darhol ko'rsatadi). */
export function fillBars(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll(".of-progress[data-to]").forEach((bar) => bar.style.setProperty("--value", bar.dataset.to));
  }));
}

const STATUS = {
  done: ["of-badge--green", () => t("uf.statusDone", "Yakunlangan")],
  active: ["of-badge--blue", () => t("uf.statusActive", "Jarayonda")],
  available: ["", () => t("uf.statusAvailable", "Boshlanmagan")],
  locked: ["", () => t("uf.statusLocked", "Qulflangan")],
};

export function statusBadge(c) {
  const [cls, text] = STATUS[c.status];
  return `<span class="of-badge ${cls}">${text()}</span>`;
}

/** Boshlash / Davom etish / Takrorlash — Home, Umumiy fizika va Natijalar'da bir xil. */
export function courseAction(c, { size = "of-btn--sm" } = {}) {
  if (c.status === "locked") {
    return `<p class="of-course__locked">${icon("lock")}<span>${t("uf.statusLocked", "Qulflangan")}${c.blockedBy ? ` — ${t("uf.finishFirst", "avval «{title}» kursini yakunlang", { title: esc(c.blockedBy.title) })}` : ""}</span></p>`;
  }
  if (c.status === "done") {
    return `<a class="of-btn of-btn--soft ${size}" href="${esc(c.firstHref)}" aria-label="${esc(t("uf.repeatCourse", "{title} kursini takrorlash", { title: c.title }))}">${t("uf.repeat", "Takrorlash")}</a>`;
  }
  const verb = c.done === 0 ? t("home.start", "Boshlash") : t("home.continue", "Davom etish");
  return `<a class="of-btn of-btn--primary ${size}" href="${esc(c.next.href)}" aria-label="${esc(c.title)}: ${verb} — ${esc(c.next.label)}, ${esc(c.next.title)}">${verb} ${icon("arrowRight")}</a>`;
}

/** Bitta kurs kartasi (<li>). */
export function courseItem(c, { showNextTitle = false } = {}) {
  const nextText = c.next && c.status !== "locked"
    ? ` · ${showNextTitle ? t("uf.current", "Joriy") : t("home.nextShort", "Keyingi")}: ${esc(c.next.label)}${showNextTitle ? ` — ${esc(c.next.title)}` : ""}`
    : "";
  return `
    <li class="of-card of-course" data-status="${c.status}" data-course="${c.id}" data-search-item data-search-text="${esc(`${c.title} ${c.description} progress`)}">
      <div class="of-course__head">
        <h3>${esc(c.title)}</h3>
        ${statusBadge(c)}
      </div>
      <div class="of-course__bar">
        ${progressBar(c.percent, t("uf.progressOf", "{title} progressi", { title: c.title }))}
        <span class="of-course__pct of-num">${c.percent}%</span>
      </div>
      <div class="of-course__foot">
        <p class="of-subtle">${t("uf.topicsCount", "{done} / {total} mavzu", { done: c.done, total: c.total })}${nextText}</p>
        ${courseAction(c)}
      </div>
    </li>`;
}
