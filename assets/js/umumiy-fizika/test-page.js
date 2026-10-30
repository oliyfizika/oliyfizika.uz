// ==========================================================================
// Umumiy fizika — mavzu testi (umumiy-fizika/test/test.html?id=N)
//
// Yangi OliyFizika 2.0 dizayni: qobiq (sidebar/sarlavha), savol kartasi, savollar to'ri, kalkulyator,
// sekin harakatlanuvchi «oliyfizika.uz» suv belgisi (CSS: .ut-wm), formulalar — KaTeX.
//
// MANTIQ O'ZGARMAGAN (eski js/multiple-choice-test.js bilan bir xil):
//   • o'tish foizi 80%; o'tilsa — unlockMechanicsLesson(unlockLesson)
//   • natija — saveResult(...), XP — awardXP(...) (bitta mavzu uchun bir marta)
//   • savol fayli: test-N.json  { title, backUrl, unlockLesson, questions:[{text, answers[], correct, image(s)?}] }
// Qo'shimcha: json'da `pick: K` bo'lsa va savollar K dan ko'p bo'lsa — har urinishda tasodifiy K ta savol beriladi.
// ==========================================================================
import { icon } from "../ui/icons.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/feedback.js";
import { bindCalculatorButton, CALC_ICON } from "../attestatsiya-fizika/calculator-panel.js";
import { unlockMechanicsLesson } from "../../../js/mechanics-progress.js";
import { saveResult } from "../../../js/services/result-service.js";
import { awardXP } from "../../../js/services/xp-service.js";
import { COURSES } from "../../../umumiy-fizika/data/courses.js";
import { t, currentLang, applyI18n, topicLabel } from "../core/i18n.js";

const PASS_PERCENT = 80;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const KATEX_BASE = new URL("../../vendor/katex/", import.meta.url).href;

const root = document.getElementById("utPage");
const view = root.querySelector("[data-view]");
const params = new URLSearchParams(location.search);
const testId = params.get("id");

let data = null;        // test-N.json
let lesson = null;      // courses.js dagi mavzu
let course = null;
let questions = [];     // shu urinishdagi savollar (pick bo'lsa — tanlanganlari)
let answers = {};       // savol indeksi -> variant indeksi
let current = 0;
let finished = false;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const draftKey = () => `oliyfizika:ut:${testId}`;

// ------------------------------------------------------------------ KaTeX (lokal, faqat kerak bo'lganda)
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

// ------------------------------------------------------------------ yordamchilar
function findLesson(unlockLesson) {
  const n = Number(unlockLesson) - 1;
  for (const c of COURSES) {
    const l = c.lessons.find((x) => x.number === n && String(x.testUrl || "").includes(`id=${testId}`)) || c.lessons.find((x) => x.number === n);
    if (l) return { course: c, lesson: l };
  }
  return { course: null, lesson: null };
}

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readDraft() {
  try { return JSON.parse(sessionStorage.getItem(draftKey()) || "null"); } catch { return null; }
}
function writeDraft() {
  try { sessionStorage.setItem(draftKey(), JSON.stringify({ order: questions.map((q) => q._i), answers, at: Date.now() })); } catch { /* ignore */ }
}
function clearDraft() {
  try { sessionStorage.removeItem(draftKey()); } catch { /* ignore */ }
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
  const items = [`<li><a href="../umumiy-fizika.html">${t("uf.generalPhysics", "Umumiy fizika")}</a></li>`];
  if (course) items.push(`<li><a href="../${esc(course.id)}.html">${esc(course.title)}</a></li>`);
  items.push(`<li aria-current="page">${esc(lesson?.numberLabel || t("ut.test", "Test"))}</li>`);
  return `<ol class="ut-crumbs" aria-label="${t("ut.breadcrumb", "Sahifa yo‘li")}">${items.join("")}</ol>`;
}

// ------------------------------------------------------------------ test ishlash
function renderRunner() {
  const n = questions.length;
  const label = lesson?.numberLabel || topicLabel(data.unlockLesson - 1);
  const title = lesson?.title || data.title;
  view.innerHTML = `
    ${crumbs()}
    <div class="ut-layout">
      <div class="ut-main">
        <div class="of-card ut-bar">
          <div class="ut-bar__title"><small>${esc(t("uf.lessonTest", "{label} testi", { label }))}</small><b>${esc(title)}</b></div>
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
        <p class="ut-pass-note">${t("ut.passNote", "Kamida <b>{pct}%</b> natija keyingi mavzuni ochadi va XP beradi.", { pct: PASS_PERCENT })}</p>
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

function figuresOf(q) {
  const src = q.images || q.image;
  return Array.isArray(src) ? src : src ? [src] : [];
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
  const figs = card.querySelector("[data-figs]");
  figuresOf(q).forEach((src) => {
    const box = document.createElement("div");
    box.className = "ut-q__fig";
    const img = document.createElement("img");
    img.src = new URL(src, location.href).href;
    img.alt = t("ut.figure", "Savolga chizma");
    img.loading = "lazy";
    box.append(img);
    figs.append(box);
  });
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
    btn.setAttribute("aria-label", `${LETTERS[i]}) ${plain(a)}`);
    const key = document.createElement("span");
    key.className = "ut-opt__key";
    key.textContent = LETTERS[i];
    const content = document.createElement("span");
    content.className = "ut-opt__content";
    content.append(richText(a));
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

// ------------------------------------------------------------------ yakunlash (mantiq — eski test bilan bir xil)
async function finish() {
  if (finished) return;
  finished = true;
  let score = 0;
  questions.forEach((q, i) => { if (answers[i] === q.correct) score++; });
  const total = questions.length;
  const percent = Math.round((score / total) * 100);
  const passed = percent >= PASS_PERCENT;
  const unlockLesson = Number(data.unlockLesson);
  const lessonId = unlockLesson - 1;

  view.innerHTML = stateHtml("check", t("ut.saving", "Natija saqlanmoqda…"), t("ut.wait", "Iltimos, kuting."));
  let xpAward = null;
  let saved = true;
  try {
    const resultId = await saveResult({
      lessonId,
      lessonTitle: currentLang === "uz" ? document.title : `${lessonId}-mavzu testi | OliyFizika.uz`, // saqlanadigan qiymat til-neytral
      course: "mechanics",
      score,
      totalQuestions: total,
      percent,
      passed,
    });
    xpAward = await awardXP({ lessonId, percent, resultId });
    if (!resultId) saved = false;
  } catch (e) {
    console.error("[test] natijani saqlashda xato:", e);
    saved = false;
  }
  if (passed) unlockMechanicsLesson(unlockLesson);
  clearDraft();
  renderResult({ score, total, percent, passed, unlockLesson, xpAward, saved });
}

const VERDICT = {
  correct: ["checkCircle", t("ut.correct", "To‘g‘ri")],
  wrong: ["alert", t("ut.wrong", "Noto‘g‘ri")],
  unanswered: ["info", t("ut.notAnswered", "Javob berilmagan")],
};

function renderResult({ score, total, percent, passed, unlockLesson, xpAward, saved }) {
  const wrong = questions.filter((q, i) => answers[i] != null && answers[i] !== q.correct).length;
  const skipped = questions.filter((_, i) => answers[i] == null).length;
  const backUrl = data.backUrl || "../umumiy-fizika.html";
  const xpLine = xpAward?.status === "awarded"
    ? `<p>${t("ut.xpAdded", "<b>+{xp} XP</b> qo‘shildi.", { xp: xpAward.xp })}</p>`
    : xpAward?.status === "already-awarded" ? `<p>${t("ut.xpAlready", "Bu mavzu uchun XP avval berilgan.")}</p>` : "";
  view.innerHTML = `
    ${crumbs()}
    <section class="of-card ut-result" aria-labelledby="utResTitle">
      <div class="ut-ring" data-pass="${passed}" style="--p:0" data-p="${percent}" role="img" aria-label="${t("ut.resultPct", "Natija {p} foiz", { p: percent })}">
        <div class="ut-ring__inner"><div><b>${percent}%</b><br><span>${score}/${total}</span></div></div>
      </div>
      <div class="ut-result__text">
        <h1 id="utResTitle">${passed ? t("ut.passedTitle", "Test muvaffaqiyatli yakunlandi") : t("ut.doneTitle", "Test yakunlandi")}</h1>
        <p class="ut-result__msg" data-ok="${passed}">${icon(passed ? "checkCircle" : "alert")}<span>${passed
          ? t("ut.unlocked", "{label} ochildi.", { label: topicLabel(unlockLesson) })
          : t("ut.needPct", "Keyingi mavzuni ochish uchun kamida {pct}% talab qilinadi.", { pct: PASS_PERCENT })}</span></p>
        ${xpLine}
        ${saved ? "" : `<p class="of-subtle">${t("ut.notSaved", "Natijani serverga saqlab bo‘lmadi (tizimga kirmagan bo‘lishingiz yoki internet uzilgan bo‘lishi mumkin).")}</p>`}
        <div class="ut-counts">
          <div class="ut-count ut-count--ok"><span>${t("ut.correct", "To‘g‘ri")}</span><b>${score}</b></div>
          <div class="ut-count ut-count--bad"><span>${t("ut.wrong", "Noto‘g‘ri")}</span><b>${wrong}</b></div>
          <div class="ut-count ut-count--skip"><span>${t("ut.unanswered", "Javobsiz")}</span><b>${skipped}</b></div>
        </div>
        <div class="ut-actions">
          <a class="of-btn of-btn--primary" href="${esc(backUrl)}">${t("ut.backToTopics", "Mavzularga qaytish")}</a>
          <button type="button" class="of-btn" data-retry>${t("uf.retakeTest", "Testni qayta ishlash")}</button>
        </div>
      </div>
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
    li.innerHTML = `<div class="ut-rev__head"><span class="ut-q__num">${i + 1}</span><span class="ut-rev__verdict">${icon(ic)}${text}</span></div>
      <div class="ut-q__body" data-body></div><div data-figs></div><ul class="ut-opts" data-opts></ul>`;
    li.querySelector("[data-body]").append(richText(q.text));
    figuresOf(q).forEach((src) => {
      const box = document.createElement("div");
      box.className = "ut-q__fig";
      const img = document.createElement("img");
      img.src = new URL(src, location.href).href;
      img.alt = t("ut.figure", "Savolga chizma");
      img.loading = "lazy";
      box.append(img);
      li.querySelector("[data-figs]").append(box);
    });
    q.answers.forEach((a, j) => {
      const o = document.createElement("li");
      const b = document.createElement("div");
      b.className = "ut-opt";
      if (j === q.correct) b.dataset.review = "correct";
      else if (j === answers[i]) b.dataset.review = "wrong";
      const key = document.createElement("span");
      key.className = "ut-opt__key";
      key.textContent = LETTERS[j];
      const content = document.createElement("span");
      content.className = "ut-opt__content";
      content.append(richText(a));
      b.append(key, content);
      o.append(b);
      li.querySelector("[data-opts]").append(o);
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

// ------------------------------------------------------------------ tarjima (rus / ingliz)
// test/i18n/<til>/test-N.json: { title?, questions: [{ text, answers[] }] } — savollar tartib bo'yicha qo'shiladi.
// To'g'ri javob indeksi, rasmlar va `pick` asl (o'zbekcha) faylda qoladi; fayl yo'q yoki mos kelmasa — o'zbekcha.
async function applyTestTranslation() {
  if (currentLang === "uz") return;
  let tr = null;
  try {
    const res = await fetch(`i18n/${currentLang}/test-${testId}.json`, { cache: "no-cache" });
    tr = res.ok ? await res.json() : null;
  } catch { /* tarjima yo'q */ }
  if (!tr || !Array.isArray(tr.questions)) return;
  data.questions = (data.questions || []).map((q, i) => {
    const x = tr.questions[i];
    const sameShape = x && Array.isArray(x.answers) && x.answers.length === q.answers.length;
    return sameShape ? { ...q, text: x.text ?? q.text, answers: x.answers } : q;
  });
  if (tr.title) data.title = tr.title;
}

// ------------------------------------------------------------------ ishga tushirish
async function init() {
  applyI18n();
  if (!/^\d+$/.test(String(testId || ""))) {
    view.innerHTML = stateHtml("alert", t("ut.notFound", "Test topilmadi"), t("ut.badLink", "Havola noto‘g‘ri. Mavzular ro‘yxatidan testni qayta oching."),
      `<a class="of-btn of-btn--primary" href="../umumiy-fizika.html">${t("ut.backToTopics", "Mavzularga qaytish")}</a>`);
    return;
  }
  try {
    const [res] = await Promise.all([fetch(`test-${testId}.json`, { cache: "no-cache" }), loadKatex().catch(() => null)]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    await applyTestTranslation();
  } catch (e) {
    console.error("[test] yuklanmadi:", e);
    view.innerHTML = stateHtml("alert", t("ut.loadFail", "Test yuklanmadi"), t("ut.loadFailText", "Bu mavzu testi hali tayyor emas yoki internet aloqasi yo‘q."),
      `<a class="of-btn of-btn--primary" href="../umumiy-fizika.html">${t("ut.backToTopics", "Mavzularga qaytish")}</a>`);
    return;
  }
  ({ course, lesson } = findLesson(data.unlockLesson));
  setShellTitle(lesson ? t("uf.lessonTest", "{label} testi", { label: lesson.numberLabel }) : t("ut.pageTitle", "Mavzu testi"));

  const all = data.questions || [];
  const draft = readDraft();
  let order = null;
  if (draft && Array.isArray(draft.order) && draft.order.every((i) => Number.isInteger(i) && i >= 0 && i < all.length)) {
    order = draft.order;
    answers = draft.answers || {};
  } else if (data.pick && all.length > data.pick) {
    order = shuffled(all.length).slice(0, data.pick);
  } else {
    order = all.map((_, i) => i);
  }
  questions = order.map((i) => ({ ...all[i], _i: i }));
  if (!questions.length) {
    view.innerHTML = stateHtml("info", t("ut.noQuestions", "Savollar topilmadi"), t("ut.noQuestionsText", "Bu testda hali savollar yo‘q."));
    return;
  }
  writeDraft();
  renderRunner();
}

init();
