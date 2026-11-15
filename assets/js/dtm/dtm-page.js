// ==========================================================================
// DTM variantlari — bo'lim sahifasi (dtm-variantlari/index.html)
// Bazadagi savollar soni bo'limlar bo'yicha (data/baza.json), variant tuzilishi va so'nggi natijalar.
// ==========================================================================
import { icon } from "../ui/icons.js";
import { bindProtectedLinks } from "../auth/auth-gate.js";
import { QUOTA, POINTS, TOPIC_ORDER, VARIANT_SIZE, loadBank, readHistory } from "./dtm-store.js";

const root = document.getElementById("dtmPage");
const $ = (s) => root.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function hydrateIcons() {
  root.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}

function renderRules() {
  const rules = [
    `Har safar bazadan <b>${VARIANT_SIZE} ta</b> savol tasodifiy tanlanadi — barcha bo‘limlardan.`,
    `Har bir to‘g‘ri javob <b>${POINTS} ball</b>, maksimal natija <b>${VARIANT_SIZE * POINTS} ball</b>.`,
    "Savollar orasida erkin o‘tish, kalkulyator va javobni bekor qilish mumkin.",
    "Yakunlagach — ball, bo‘limlar bo‘yicha natija va har bir savolning to‘g‘ri javobi ko‘rsatiladi.",
  ];
  $("[data-rules]").innerHTML = rules.map((r) => `<li>${icon("checkCircle")}<span>${r}</span></li>`).join("");
}

function renderTopics(bank) {
  const counts = {};
  bank.questions.forEach((q) => { counts[q.topic] = (counts[q.topic] || 0) + 1; });
  const list = $("[data-topics]");
  list.innerHTML = TOPIC_ORDER.map((k) => `
    <li class="dtm-topic"><span>${esc(bank.topics[k])}</span><b>${QUOTA[k]} ta</b>
      <span class="dtm-topic__bar" aria-hidden="true"><span style="width:${(QUOTA[k] / VARIANT_SIZE) * 100}%"></span></span>
      <small>Bazada ${counts[k] || 0} ta savol</small></li>`).join("");
  list.removeAttribute("aria-busy");
  $("[data-dtm-count]").textContent = `Bazada ${bank.questions.length} ta savol`;
}

function renderHistory() {
  const hist = readHistory().slice(0, 5);
  if (!hist.length) return;
  const fmt = new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  $("[data-history]").innerHTML = hist.map((h) => `
    <li><span>${esc(fmt.format(new Date(h.at)))}<br><small>${h.score} / ${h.total} to‘g‘ri</small></span><b>${h.ball} <small>/ ${h.maxBall} ball</small></b></li>`).join("");
  $("[data-history-card]").hidden = false;
}

async function init() {
  hydrateIcons();
  renderRules();
  bindProtectedLinks(root, "a[data-dtm-start]");
  renderHistory();
  try {
    renderTopics(await loadBank());
  } catch (e) {
    console.error("[dtm] baza yuklanmadi:", e);
    $("[data-topics]").outerHTML = `<div class="of-alert of-alert--error" role="alert">${icon("alert")}<span>Savollar bazasini yuklab bo‘lmadi. Sahifani yangilang.</span></div>`;
  }
}

init();
