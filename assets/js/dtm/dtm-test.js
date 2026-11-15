// ==========================================================================
// DTM variantlari — test (dtm-variantlari/test.html)
//
// Savollar bazasi: dtm-variantlari/data/baza.json (DTM fizika variantlaridan, aynan takrorlanganlari olib tashlangan).
// Har urinishda bazadan tasodifiy 25 ta savol — barcha bo'limlardan (QUOTA), har biri 2 ball, jami 50 ball.
// Ishlash rejimi umumiy fizika mavzu testi bilan bir xil (umumiy-test.css, kalkulyator, savollar to'ri,
// yakunlash oynasi, natija va javoblarni ko'rib chiqish). Natija faqat shu brauzerda saqlanadi (dtm-store.js).
// ==========================================================================
import { icon } from "../ui/icons.js";
import { openModal } from "../ui/modal.js";
import { bindCalculatorButton, CALC_ICON } from "../attestatsiya-fizika/calculator-panel.js";
import { t, applyI18n } from "../core/i18n.js";
import { QUOTA, POINTS, TOPIC_ORDER, loadBank, pushHistory } from "./dtm-store.js";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const KATEX_BASE = new URL("../../vendor/katex/", import.meta.url).href;
const DRAFT_KEY = "oliyfizika:dtm:draft";

const root = document.getElementById("dtmPage");
const view = root.querySelector("[data-view]");

let bank = null;        // baza.json
let questions = [];     // shu variant savollari
let answers = {};       // savol indeksi -> variant indeksi
let current = 0;
let finished = false;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------------ KaTeX (lokal)
let katexPromise = null;
function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexPromise) {
    katexPromise = new Promise((resolve, reject) => {
      if (!document.querySelector("link[data-katex]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = KATEX_BASE + "katex.min.css";
        link.dataset.katex = "";
        document.head.append(link);
      }
      const s = document.createElement("script");
      s.src = KATEX_BASE + "katex.min.js";
      s.async = true;
      s.onload = () => resolve(window.katex);
      s.onerror = () => reject(new Error("KaTeX yuklanmadi"));
      document.head.append(s);
    });
  }
  return katexPromise;
}

/** Matn ($…$ — formula) -> DocumentFragment. Matn hech qachon innerHTML ga berilmaydi. */
function richText(text) {
  const frag = document.createDocumentFragment();
  String(text ?? "").split(/(\$[^$]+\$)/).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1 && part.length > 2) {
      const span = document.createElement("span");
      const tex = part.slice(1, -1);
      try {
        window.katex.render(tex, span, { throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
      } catch {
        span.textContent = tex;
      }
      frag.append(span);
      return;
    }
    part.split("\n").forEach((line, j) => {
      if (j) frag.append(document.createElement("br"));
      if (line) frag.append(document.createTextNode(line));
    });
  });
  return frag;
}
const plain = (text) => String(text ?? "").replace(/\$/g, "");

/** Javoblari rasmdagi A–D bo'lgan savollar (grafik/chizma variantlari). */
const isFigureChoice = (q) => q.answers.every((a, i) => a === LETTERS[i]);
const answerText = (q, a) => (isFigureChoice(q) ? `Rasmdagi ${a}) variant` : a);

// ------------------------------------------------------------------ yordamchilar
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Har bo'limdan QUOTA bo'yicha tasodifiy savollar; bir xil manba-shablon takrorlanmasin deb matn boshini ham tekshiradi. */
function buildVariant(all) {
  const picked = [];
  const seenStems = new Set();
  TOPIC_ORDER.forEach((topic) => {
    const pool = shuffle(all.filter((q) => q.topic === topic));
    const need = QUOTA[topic] || 0;
    const chosen = [];
    for (const q of pool) {
      if (chosen.length >= need) break;
      const stem = plain(q.text).replace(/[\d.,]+/g, "#").slice(0, 70);
      if (seenStems.has(stem)) continue; // raqamlari o'zgartirilgan bir xil masala bitta variantga ikki marta tushmasin
      seenStems.add(stem);
      chosen.push(q);
    }
    for (const q of pool) { // shablon cheklovi tufayli yetmasa — qolganidan to'ldirish
      if (chosen.length >= need) break;
      if (!chosen.includes(q)) chosen.push(q);
    }
    picked.push(...chosen);
  });
  return shuffle(picked);
}

function readDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}
function writeDraft() {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ids: questions.map((q) => q.id), answers, at: Date.now() })); } catch { /* ignore */ }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function setShellTitle(text) {
  document.title = `${text} | OliyFizika.uz`;
  const apply = () => window.OFShell?.setTitle?.(text);
  if (window.OFShell) apply(); else document.addEventListener("of:shell-ready", apply, { once: true });
}

function stateHtml(iconName, title, text = "", action = "") {
  return `<div class="of-card ut-state" role="status">${icon(iconName)}<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}${action}</div>`;
}

function crumbs() {
  return `<ol class="ut-crumbs" aria-label="${t("ut.breadcrumb", "Sahifa yo‘li")}"><li><a href="index.html">DTM variantlari</a></li><li aria-current="page">Test</li></ol>`;
}

function figuresOf(q) {
  const src = q.images || q.image;
  return Array.isArray(src) ? src : src ? [src] : [];
}

function figureNodes(q) {
  return figuresOf(q).map((src) => {
    const box = document.createElement("div");
    box.className = "ut-q__fig";
    const img = document.createElement("img");
    img.src = new URL(src, bank.base).href;
    img.alt = t("ut.figure", "Savolga chizma");
    img.loading = "lazy";
    box.append(img);
    return box;
  });
}

function reviewOption(q, a, j, review) {
  const o = document.createElement("li");
  const b = document.createElement("div");
  b.className = "ut-opt";
  if (review) b.dataset.review = review;
  const key = document.createElement("span");
  key.className = "ut-opt__key";
  key.textContent = LETTERS[j];
  const content = document.createElement("span");
  content.className = "ut-opt__content";
  content.append(richText(answerText(q, a)));
  b.append(key, content);
  o.append(b);
  return o;
}

// ------------------------------------------------------------------ test ishlash
function renderRunner() {
  const n = questions.length;
  view.innerHTML = `
    ${crumbs()}
    <div class="ut-layout">
      <div class="ut-main">
        <div class="of-card ut-bar">
          <div class="ut-bar__title"><small>DTM variantlari</small><b>Fizika — ${n} ta savol, ${n * POINTS} ball</b></div>
          <span class="ut-bar__count of-num" data-count aria-live="polite"></span>
          <div class="of-progress" role="progressbar" aria-label="${t("ut.answeredQuestions", "Javob berilgan savollar")}" aria-valuemin="0" aria-valuemax="${n}" data-bar><span></span></div>
          <button type="button" class="of-btn of-btn--sm ut-calc-btn" data-calc title="${t("ut.calc", "Kalkulyator")}" aria-label="${t("ut.calc", "Kalkulyator")}">${CALC_ICON}<span class="ut-calc-btn__label">${t("ut.calc", "Kalkulyator")}</span></button>
        </div>
        <article class="of-card ut-q" data-q tabindex="-1" aria-labelledby="utQNum"></article>
      </div>
      <aside class="of-card ut-side" aria-labelledby="utNavTitle">
        <h2 id="utNavTitle">${t("ut.questions", "Savollar")}</h2>
        <ol class="ut-grid" data-grid></ol>
        <ul class="ut-legend"><li><i data-k="answered"></i>${t("ut.answered", "Javob berilgan")}</li><li><i></i>${t("ut.unanswered", "Javobsiz")}</li></ul>
        <div class="ut-side__summary"><span data-sum-answered></span><span data-sum-left></span></div>
        <button type="button" class="of-btn of-btn--success of-btn--lg of-btn--block" data-finish>${icon("check")}${t("ut.finishTest", "Testni yakunlash")}</button>
        <p class="ut-pass-note">Har bir to‘g‘ri javob — <b>${POINTS} ball</b>, jami <b>${n * POINTS} ball</b>.</p>
      </aside>
    </div>`;
  const grid = view.querySelector("[data-grid]");
  grid.innerHTML = questions.map((_, i) => `<li><button type="button" data-go="${i}" aria-label="${t("ut.questionN", "{n}-savol", { n: i + 1 })}">${i + 1}</button></li>`).join("");
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) go(Number(b.dataset.go), true);
  });
  view.querySelector("[data-finish]").addEventListener("click", confirmFinish);
  bindCalculatorButton(view.querySelector("[data-calc]"));
  renderQuestion();
  updateProgress();
}

function renderQuestion() {
  const q = questions[current];
  const n = questions.length;
  const card = view.querySelector("[data-q]");
  card.innerHTML = `
    <div class="ut-q__head"><span class="ut-q__num" id="utQNum">${current + 1} / ${n}</span></div>
    <div class="ut-q__body" data-body></div>
    <div data-figs></div>
    <ul class="ut-opts" role="radiogroup" aria-labelledby="utQNum" data-opts></ul>
    <div class="ut-q__nav">
      <button type="button" class="of-btn" data-prev ${current === 0 ? "disabled" : ""}>${icon("chevronLeft")}${t("uf.prev", "Oldingi")}</button>
      ${answers[current] != null ? `<button type="button" class="of-btn of-btn--ghost" data-clear>${t("ut.clearAnswer", "Javobni bekor qilish")}</button>` : ""}
      ${current < n - 1
        ? `<button type="button" class="of-btn of-btn--primary" data-next>${t("uf.nextWord", "Keyingi")}${icon("chevronRight")}</button>`
        : `<button type="button" class="of-btn of-btn--success" data-finish2>${icon("check")}${t("ut.finish", "Yakunlash")}</button>`}
    </div>`;
  card.querySelector("[data-body]").append(richText(q.text));
  card.querySelector("[data-figs]").append(...figureNodes(q));
  const list = card.querySelector("[data-opts]");
  q.answers.forEach((a, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ut-opt";
    btn.setAttribute("role", "radio");
    const checked = answers[current] === i;
    btn.setAttribute("aria-checked", String(checked));
    btn.tabIndex = checked || (answers[current] == null && i === 0) ? 0 : -1;
    btn.dataset.i = String(i);
    btn.setAttribute("aria-label", `${LETTERS[i]}) ${plain(answerText(q, a))}`);
    const key = document.createElement("span");
    key.className = "ut-opt__key";
    key.textContent = LETTERS[i];
    const content = document.createElement("span");
    content.className = "ut-opt__content";
    content.append(richText(answerText(q, a)));
    btn.append(key, content);
    li.append(btn);
    list.append(li);
  });
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".ut-opt");
    if (b) choose(Number(b.dataset.i));
  });
  list.addEventListener("keydown", (e) => {
    const btns = [...list.querySelectorAll(".ut-opt")];
    const idx = btns.indexOf(document.activeElement);
    if (idx < 0) return;
    let next = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % btns.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + btns.length) % btns.length;
    if (next != null) {
      e.preventDefault();
      btns[next].focus();
      choose(Number(btns[next].dataset.i), false);
    }
  });
  card.querySelector("[data-prev]").addEventListener("click", () => go(current - 1));
  card.querySelector("[data-next]")?.addEventListener("click", () => go(current + 1));
  card.querySelector("[data-finish2]")?.addEventListener("click", confirmFinish);
  card.querySelector("[data-clear]")?.addEventListener("click", () => {
    delete answers[current];
    writeDraft();
    renderQuestion();
    updateProgress();
  });
}

function choose(i, rerender = true) {
  answers[current] = i;
  writeDraft();
  if (rerender) {
    renderQuestion();
    view.querySelector(`.ut-opt[data-i="${i}"]`)?.focus();
  } else {
    view.querySelectorAll(".ut-opt").forEach((b) => {
      const on = Number(b.dataset.i) === i;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  updateProgress();
}

function go(i, focus = false) {
  current = Math.max(0, Math.min(questions.length - 1, i));
  renderQuestion();
  updateProgress();
  const card = view.querySelector("[data-q]");
  if (focus) card.focus({ preventScroll: true });
  card.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function updateProgress() {
  const n = questions.length;
  const answered = questions.filter((_, i) => answers[i] != null).length;
  view.querySelector("[data-count]").textContent = `${current + 1} / ${n}`;
  const bar = view.querySelector("[data-bar]");
  bar.style.setProperty("--value", Math.round((answered * 100) / n));
  bar.setAttribute("aria-valuenow", answered);
  bar.setAttribute("aria-valuetext", t("ut.answeredOf", "{a} / {n} savolga javob berilgan", { a: answered, n }));
  view.querySelectorAll("[data-go]").forEach((b) => {
    const i = Number(b.dataset.go);
    b.dataset.answered = String(answers[i] != null);
    if (i === current) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    b.setAttribute("aria-label", `${t("ut.questionN", "{n}-savol", { n: i + 1 })}: ${answers[i] != null ? t("ut.answerLetter", "javob {l}", { l: LETTERS[answers[i]] }) : t("ut.unansweredLc", "javobsiz")}`);
  });
  view.querySelector("[data-sum-answered]").textContent = `${t("ut.answered", "Javob berilgan")}: ${answered}`;
  view.querySelector("[data-sum-left]").textContent = `${t("ut.unanswered", "Javobsiz")}: ${n - answered}`;
}

function confirmFinish() {
  const left = questions.filter((_, i) => answers[i] == null).length;
  openModal({
    title: t("ut.confirmTitle", "Testni yakunlashni xohlaysizmi?"),
    text: left
      ? t("ut.confirmLeft", "Siz {n} ta savolni javobsiz qoldirdingiz. Baribir testni yakunlamoqchimisiz?", { n: left })
      : t("ut.confirmText", "Haqiqatan ham testni yakunlamoqchimisiz?"),
    iconName: "check",
    actions: [
      { label: t("ut.yesFinish", "Ha, yakunlash"), variant: "success", onClick: (_e, m) => { m.close(); finish(); } },
      { label: t("home.continue", "Davom etish"), onClick: (_e, m) => m.close() },
    ],
  });
}

// ------------------------------------------------------------------ yakunlash
function finish() {
  if (finished) return;
  finished = true;
  let score = 0;
  questions.forEach((q, i) => { if (answers[i] === q.correct) score++; });
  const total = questions.length;
  const ball = score * POINTS;
  const maxBall = total * POINTS;
  const percent = Math.round((score / total) * 100);
  const byTopic = {};
  questions.forEach((q, i) => {
    const s = byTopic[q.topic] || (byTopic[q.topic] = { total: 0, correct: 0 });
    s.total++;
    if (answers[i] === q.correct) s.correct++;
  });
  pushHistory({ at: Date.now(), score, total, ball, maxBall, byTopic });
  clearDraft();
  renderResult({ score, total, ball, maxBall, percent, byTopic });
}

const VERDICT = {
  correct: ["checkCircle", t("ut.correct", "To‘g‘ri")],
  wrong: ["alert", t("ut.wrong", "Noto‘g‘ri")],
  unanswered: ["info", t("ut.notAnswered", "Javob berilmagan")],
};

function renderResult({ score, total, ball, maxBall, percent, byTopic }) {
  const wrong = questions.filter((q, i) => answers[i] != null && answers[i] !== q.correct).length;
  const skipped = questions.filter((_, i) => answers[i] == null).length;
  const good = percent >= 60;
  const topicRows = TOPIC_ORDER.filter((k) => byTopic[k]).map((k) => {
    const s = byTopic[k];
    return `<li class="dtm-topic"><span>${esc(bank.topics[k])}</span><b>${s.correct}/${s.total}</b>
      <span class="dtm-topic__bar" aria-hidden="true"><span style="width:${(s.correct / s.total) * 100}%"></span></span></li>`;
  }).join("");
  view.innerHTML = `
    ${crumbs()}
    <section class="of-card ut-result" aria-labelledby="utResTitle">
      <div class="ut-ring" data-pass="${good}" style="--p:0" data-p="${percent}" role="img" aria-label="${ball} ball, ${maxBall} balldan">
        <div class="ut-ring__inner"><div><b>${ball}</b><br><span>${maxBall} balldan</span></div></div>
      </div>
      <div class="ut-result__text">
        <h1 id="utResTitle">Test yakunlandi: ${ball} ball</h1>
        <p class="ut-result__msg" data-ok="${good}">${icon(good ? "checkCircle" : "alert")}<span>${score} ta to‘g‘ri javob × ${POINTS} ball = <b>${ball}</b> / ${maxBall} ball (${percent}%).</span></p>
        <div class="ut-counts">
          <div class="ut-count ut-count--ok"><span>${t("ut.correct", "To‘g‘ri")}</span><b>${score}</b></div>
          <div class="ut-count ut-count--bad"><span>${t("ut.wrong", "Noto‘g‘ri")}</span><b>${wrong}</b></div>
          <div class="ut-count ut-count--skip"><span>${t("ut.unanswered", "Javobsiz")}</span><b>${skipped}</b></div>
        </div>
        <div class="ut-actions">
          <button type="button" class="of-btn of-btn--primary" data-retry>${icon("shuffle")}Yangi variant</button>
          <a class="of-btn" href="index.html">DTM variantlariga qaytish</a>
        </div>
      </div>
    </section>
    <section class="of-card dtm-topics-card" aria-labelledby="dtmTopicsTitle">
      <h2 id="dtmTopicsTitle">Bo‘limlar bo‘yicha natija</h2>
      <ul class="dtm-topics">${topicRows}</ul>
    </section>
    <div class="ut-review-title">
      <h2>${t("ut.reviewTitle", "Javoblarni ko‘rib chiqish")}</h2>
      <div class="ut-filters" role="group" aria-label="${t("ut.filter", "Filtr")}">
        ${[["all", t("ut.all", "Hammasi")], ["wrong", t("ut.wrong", "Noto‘g‘ri")], ["unanswered", t("ut.unanswered", "Javobsiz")], ["correct", t("ut.correct", "To‘g‘ri")]]
          .map(([k, label]) => `<button type="button" data-filter="${k}" aria-pressed="${k === "all"}">${label}</button>`).join("")}
      </div>
    </div>
    <ol class="ut-review" data-review></ol>`;
  requestAnimationFrame(() => requestAnimationFrame(() => view.querySelector(".ut-ring")?.style.setProperty("--p", String(percent))));
  view.querySelector("[data-retry]").addEventListener("click", () => location.reload());

  const list = view.querySelector("[data-review]");
  questions.forEach((q, i) => {
    const status = answers[i] == null ? "unanswered" : answers[i] === q.correct ? "correct" : "wrong";
    const [ic, text] = VERDICT[status];
    const li = document.createElement("li");
    li.className = "of-card ut-rev";
    li.dataset.status = status;
    li.innerHTML = `<div class="ut-rev__head"><span class="ut-q__num">${i + 1}</span><span class="dtm-rev__topic">${esc(bank.topics[q.topic] || "")}</span><span class="ut-rev__verdict">${icon(ic)}${text}</span></div>
      <div class="ut-q__body" data-body></div><div data-figs></div><ul class="ut-opts" data-opts></ul>`;
    li.querySelector("[data-body]").append(richText(q.text));
    li.querySelector("[data-figs]").append(...figureNodes(q));
    q.answers.forEach((a, j) => {
      const review = j === q.correct ? "correct" : j === answers[i] ? "wrong" : null;
      li.querySelector("[data-opts]").append(reviewOption(q, a, j, review));
    });
    list.append(li);
  });
  view.querySelector(".ut-filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    view.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    list.querySelectorAll(".ut-rev").forEach((li) => { li.hidden = b.dataset.filter !== "all" && li.dataset.status !== b.dataset.filter; });
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

// ------------------------------------------------------------------ ishga tushirish
async function init() {
  applyI18n();
  setShellTitle("DTM varianti");
  try {
    [bank] = await Promise.all([loadBank(), loadKatex().catch(() => null)]);
  } catch (e) {
    console.error("[dtm] baza yuklanmadi:", e);
    view.innerHTML = stateHtml("alert", "Savollar bazasi yuklanmadi", "Internet aloqasini tekshirib, sahifani yangilang.",
      `<a class="of-btn of-btn--primary" href="index.html">DTM variantlariga qaytish</a>`);
    return;
  }
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const draft = readDraft();
  if (draft && Array.isArray(draft.ids) && draft.ids.length && draft.ids.every((id) => byId.has(id))) {
    questions = draft.ids.map((id) => byId.get(id));
    answers = draft.answers || {};
  } else {
    questions = buildVariant(bank.questions);
  }
  if (!questions.length) {
    view.innerHTML = stateHtml("info", t("ut.noQuestions", "Savollar topilmadi"), "Bazada savollar yo‘q.");
    return;
  }
  writeDraft();
  renderRunner();
}

init();
