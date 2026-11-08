// «Bu bo‘lim qanday ishlaydi?» — qayta ishlatiladigan yordam tugmasi + modal.
//
// Sahifada (app-shell.js barcha sahifalarda bu modulni yuklaydi):
//   <button type="button" class="of-help-btn" data-section-help="attestatsiya"></button>          — ikonka + matn
//   <button type="button" class="of-help-btn of-help-btn--icon" data-section-help="att-fizika"></button>  — faqat ikonka
//   Ixtiyoriy: data-help-label="O‘z matni" data-help-label-key="i18n.kalit" — standart matn o‘rniga.
// Tugma matni/ikonkasi shu yerda qo'yiladi (uz/ru/en). Bosilganda section-help-content.js dagi
// tushuntirish modal oynada ochiladi (kontent faqat birinchi bosilganda yuklanadi).
import { t, currentLang } from "../core/i18n.js";
import { icon } from "./icons.js";
import { openModal } from "./modal.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let contentPromise = null;
const loadContent = () => (contentPromise ||= import("./section-help-content.js").then((m) => m.SECTION_HELP));

function decorate(root = document) {
  const label = t("help.how", "Bu bo‘lim qanday ishlaydi?");
  root.querySelectorAll("[data-section-help]:not([data-help-ready])").forEach((btn) => {
    btn.dataset.helpReady = "1";
    if (btn.tagName === "BUTTON" && !btn.getAttribute("type")) btn.type = "button";
    btn.setAttribute("aria-haspopup", "dialog");
    if (btn.classList.contains("of-help-btn--icon")) {
      const own = btn.dataset.helpLabel ? t(btn.dataset.helpLabelKey, btn.dataset.helpLabel) : label;
      btn.innerHTML = icon("info");
      btn.setAttribute("aria-label", own);
      btn.title = own;
    } else {
      btn.innerHTML = `${icon("info")}<span>${esc(btn.dataset.helpLabel ? t(btn.dataset.helpLabelKey, btn.dataset.helpLabel) : label)}</span>`;
    }
  });
}

/** Bitta bo'lim uchun yordam oynasini ochadi (JS'dan ham chaqirish mumkin). */
export async function openSectionHelp(key) {
  const all = await loadContent();
  const entry = all[key];
  if (!entry) return null;
  const c = entry[currentLang] || entry.uz;

  const box = document.createElement("div");
  box.className = "of-help";
  let html = "";
  if (c.steps?.length) {
    html += `<section class="of-help__block"><h3>${esc(c.stepsTitle || t("help.steps", "Qanday boshlash kerak"))}</h3>
      <ol class="of-help__steps">${c.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>`;
  }
  (c.groups || []).forEach((g) => {
    html += `<section class="of-help__block${g.tone ? ` of-help__block--${g.tone}` : ""}">
      <h3>${g.icon ? icon(g.icon) : ""}<span>${esc(g.title)}</span></h3>
      <ul class="of-help__list">${g.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>`;
  });
  if (c.note) html += `<p class="of-help__note">${icon("info")}<span>${esc(c.note)}</span></p>`;
  box.innerHTML = html;

  const actions = [];
  if (c.cta) {
    actions.push({
      label: c.cta.label,
      variant: "primary",
      href: c.cta.href,
      onClick: (e, api) => { if (c.cta.external) { e.preventDefault(); window.open(c.cta.href, "_blank", "noopener"); } api.close(); },
    });
  }
  actions.push({ label: t("help.ok", "Tushunarli"), variant: c.cta ? "ghost" : "primary", onClick: (e, api) => api.close() });

  return openModal({ title: c.title, text: c.lead, iconName: "info", content: box, actions, className: "of-help-modal" });
}

document.addEventListener("click", (event) => {
  const btn = event.target.closest?.("[data-section-help]");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  openSectionHelp(btn.dataset.sectionHelp);
});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => decorate());
else decorate();

export { decorate as decorateSectionHelp };
