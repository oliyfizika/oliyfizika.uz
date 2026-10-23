// ==========================================================================
// Quizlar — quiz o'yini (quizs/quiz.html?id=N, N=0 — aralash quiz)
//
// OliyFizika 2.0 dizayni: qobiq (sidebar/sarlavha), savol kartasi, timer, natija va tahlil.
// Savollar: quizs/data/mavzu-N.json  { title, questions:[{ q, a:[...], c }] }  — fayllar o'zgarmaydi.
// Ro'yxat: quizs/data/manifest.json (aralash quiz va bir o'yindagi savollar soni — `perPlay`).
// Timer va boshqa qiymatlar: ./quiz-config.js (yagona joy).
//
// Qoidalar (eski quiz-engine.js bilan bir xil): savollar va variantlar aralashtiriladi,
// har o'yinda `perPlay` ta savol; javob tanlangach to'g'ri javob ko'rsatiladi;
// vaqt tugasa savol javobsiz hisoblanadi va avtomatik keyingisiga o'tiladi.
// ==========================================================================
import { icon } from "../ui/icons.js";
import { toast } from "../ui/feedback.js";
import { onSession } from "../core/session.js";
import { QUIZ_CONFIG } from "./quiz-config.js";

const SECONDS = QUIZ_CONFIG.secondsPerQuestion;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const DATA_BASE = new URL("data/", location.href);
const KATEX_BASE = new URL("../../vendor/katex/", import.meta.url).href;
const CLOCK = '<svg class="of-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>';

const root = document.getElementById("quizPage");
const view = root.querySelector("[data-view]");
const topicId = new URLSearchParams(location.search).get("id");
const isMixed = topicId === "0";

let manifest = null;
let quizTitle = "";
let pool = [];          // mavzudagi (yoki aralash quizdagi) barcha savollar
let questions = [];     // shu o'yindagi savollar: { q, opts:[{ text, correct }] }
let results = [];       // savol indeksi -> { picked: variant indeksi | null, status: "correct"|"wrong"|"timeout" }
let current = 0;
let answered = false;
let deadline = 0;
let tickId = null;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------ KaTeX (lokal, faqat $…$ bo'lsa)
let katexPromise = null;
function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexPromise) {
    katexPromise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = KATEX_BASE + "katex.min.css";
      document.head.append(link);
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

/** Matn ($…$ — formula) -> DocumentFragment. Matn innerHTML ga berilmaydi. */
function richText(text) {
  const frag = document.createDocumentFragment();
  String(text ?? "").split(/(\$[^$]+\$)/).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1 && part.length > 2 && window.katex) {
      const span = document.createElement("span");
      try {
        window.katex.render(part.slice(1, -1), span, { throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
      } catch {
        span.textContent = part;
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
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setShellTitle(text) {
  document.title = `${text} | OliyFizika.uz`;
  const apply = () => window.OFShell?.setTitle?.(text);
  if (window.OFShell) apply(); else document.addEventListener("of:shell-ready", apply, { once: true });
}

function stateHtml(iconName, title, text = "", action = "") {
  return `<div class="of-card qz-state" role="status">${icon(iconName)}<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}${action}</div>`;
}

const backLink = (variant = "of-btn--primary") => `<a class="of-btn ${variant}" href="quizs.html">${icon("chevronLeft")}Quizlarga qaytish</a>`;

async function fetchJson(name) {
  const res = await fetch(new URL(name, DATA_BASE), { cache: "no-cache" });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------ ma'lumot
async function loadData() {
  manifest = await fetchJson("manifest.json").catch((e) => {
    console.warn("[quiz] manifest yuklanmadi:", e);
    return null;
  });
  if (isMixed) {
    const ids = manifest?.quizzes?.map((q) => q.id) || [];
    const files = await Promise.allSettled(ids.map((id) => fetchJson(`mavzu-${id}.json`)));
    files.forEach((r, i) => {
      if (r.status === "fulfilled") pool.push(...(r.value.questions || []));
      else console.warn(`[quiz] mavzu-${ids[i]}.json yuklanmadi`, r.reason);
    });
    quizTitle = "Umumiy fizika — aralash quiz";
  } else {
    const data = await fetchJson(`mavzu-${topicId}.json`);
    pool = data.questions || [];
    quizTitle = data.title || `${topicId}-quiz`;
  }
}

/** Faqat to'g'ri tuzilgan savollar: { q: matn, a: [variantlar], c: to'g'ri variant indeksi }. */
const isValid = (item) => item && typeof item.q === "string" && Array.isArray(item.a) && item.a.length >= 2
  && Number.isInteger(item.c) && item.c >= 0 && item.c < item.a.length;

function newRound() {
  const perPlay = Number(manifest?.perPlay) || QUIZ_CONFIG.questionsPerPlay;
  questions = shuffle([...pool]).slice(0, perPlay).map((item) => ({
    q: item.q,
    opts: shuffle(item.a.map((text, i) => ({ text, correct: i === item.c }))),
  }));
  results = [];
  current = 0;
}

// ------------------------------------------------------------------ o'yin
function renderRunner() {
  view.innerHTML = `
    <ol class="qz-crumbs" aria-label="Sahifa yo‘li">
      <li><a href="quizs.html">Quizlar</a></li>
      <li aria-current="page">${esc(isMixed ? "Aralash quiz" : `${topicId}-quiz`)}</li>
    </ol>
    <div class="of-card qz-bar">
      <div class="qz-bar__title"><small>Quiz</small><b>${esc(quizTitle)}</b></div>
      <span class="qz-bar__count of-num" data-count></span>
      <div class="of-progress" role="progressbar" aria-label="Quiz jarayoni" aria-valuemin="0" aria-valuemax="${questions.length}" data-bar><span></span></div>
    </div>
    <article class="of-card qz-q" data-q tabindex="-1" aria-labelledby="qzNum"></article>`;
  renderQuestion();
}

function renderQuestion() {
  const n = questions.length;
  const q = questions[current];
  answered = false;
  const card = view.querySelector("[data-q]");
  card.innerHTML = `
    <div class="qz-q__head">
      <span class="qz-q__num of-num" id="qzNum">${current + 1}-savol</span>
      <div class="qz-timer" data-timer role="timer" aria-label="Qolgan vaqt">
        ${CLOCK}<b class="of-num" data-sec>${SECONDS}</b><span>soniya</span>
        <i class="qz-timer__bar" aria-hidden="true"><span data-timebar></span></i>
      </div>
    </div>
    <div class="qz-q__body" data-body></div>
    <ul class="qz-opts" data-opts></ul>
    <p class="qz-feedback" data-feedback aria-live="polite"></p>
    <div class="qz-q__nav">
      <span class="qz-hint">Klaviatura: <kbd>A</kbd>–<kbd>${LETTERS[q.opts.length - 1]}</kbd> yoki <kbd>1</kbd>–<kbd>${q.opts.length}</kbd></span>
      <button type="button" class="of-btn of-btn--primary of-btn--lg" data-next hidden>
        ${current < n - 1 ? `Keyingi savol${icon("arrowRight")}` : `Natijani ko‘rish${icon("check")}`}
      </button>
    </div>`;
  card.querySelector("[data-body]").append(richText(q.q));
  const list = card.querySelector("[data-opts]");
  q.opts.forEach((opt, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qz-opt";
    btn.dataset.i = String(i);
    btn.setAttribute("aria-label", `${LETTERS[i]}) ${plain(opt.text)}`);
    const key = document.createElement("span");
    key.className = "qz-opt__key";
    key.textContent = LETTERS[i];
    const content = document.createElement("span");
    content.className = "qz-opt__content";
    content.append(richText(opt.text));
    btn.append(key, content);
    li.append(btn);
    list.append(li);
  });
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".qz-opt");
    if (b) choose(Number(b.dataset.i));
  });
  card.querySelector("[data-next]").addEventListener("click", next);
  updateProgress();
  startTimer();
}

function updateProgress() {
  const n = questions.length;
  const done = results.length;
  view.querySelector("[data-count]").textContent = `${current + 1} / ${n}`;
  const bar = view.querySelector("[data-bar]");
  bar.style.setProperty("--value", Math.round((done * 100) / n));
  bar.setAttribute("aria-valuenow", done);
  bar.setAttribute("aria-valuetext", `${done} / ${n} savol yakunlangan`);
}

// ------------------------------------------------------------------ timer
function startTimer() {
  stopTimer();
  deadline = performance.now() + SECONDS * 1000;
  renderTimer();
  tickId = setInterval(renderTimer, 200);
}

function stopTimer() {
  clearInterval(tickId);
  tickId = null;
}

function renderTimer() {
  const ms = Math.max(0, deadline - performance.now());
  const left = Math.ceil(ms / 1000);
  const timer = view.querySelector("[data-timer]");
  if (!timer) return stopTimer();
  timer.querySelector("[data-sec]").textContent = String(left);
  timer.querySelector("[data-timebar]").style.width = `${(ms / (SECONDS * 1000)) * 100}%`;
  timer.dataset.warn = String(left <= QUIZ_CONFIG.warnAtSeconds);
  if (ms <= 0) {
    stopTimer();
    timeUp();
  }
}

function timeUp() {
  if (answered) return;
  answered = true;
  results[current] = { picked: null, status: "timeout" };
  toast(`${current + 1}-savolga vaqt tugadi — javobsiz hisoblandi.`, { timeout: 2600 });
  next();
}

// ------------------------------------------------------------------ javob
function choose(i) {
  if (answered) return;
  answered = true;
  stopTimer();
  const q = questions[current];
  const ok = q.opts[i].correct;
  results[current] = { picked: i, status: ok ? "correct" : "wrong" };
  const card = view.querySelector("[data-q]");
  card.querySelector("[data-timer]").dataset.stopped = "true";
  card.querySelectorAll(".qz-opt").forEach((b) => {
    const j = Number(b.dataset.i);
    b.disabled = true;
    if (q.opts[j].correct) b.dataset.state = "correct";
    else if (j === i) b.dataset.state = "wrong";
  });
  const fb = card.querySelector("[data-feedback]");
  fb.dataset.ok = String(ok);
  fb.innerHTML = ok
    ? `${icon("checkCircle")}<span>To‘g‘ri javob!</span>`
    : `${icon("alert")}<span>Noto‘g‘ri. To‘g‘ri javob: <b>${LETTERS[q.opts.findIndex((o) => o.correct)]}</b></span>`;
  updateProgress();
  const btn = card.querySelector("[data-next]");
  btn.hidden = false;
  btn.focus({ preventScroll: true });
  btn.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
}

function next() {
  stopTimer();
  if (current < questions.length - 1) {
    current++;
    renderQuestion();
    const card = view.querySelector("[data-q]");
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  } else {
    renderResult();
  }
}

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || !view.querySelector("[data-q]")) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable='true'], .of-modal")) return;
  const q = questions[current];
  if (!answered) {
    const k = e.key.toUpperCase();
    let i = LETTERS.indexOf(k);
    if (i < 0 && /^[1-9]$/.test(e.key)) i = Number(e.key) - 1;
    if (i >= 0 && i < q.opts.length) {
      e.preventDefault();
      choose(i);
    }
  } else if (e.key === "Enter" && e.target === document.body) {
    e.preventDefault();
    view.querySelector("[data-next]:not([hidden])")?.click();
  }
});

// ------------------------------------------------------------------ natija
function renderResult() {
  stopTimer();
  const n = questions.length;
  const count = (s) => results.filter((r) => r?.status === s).length;
  const ok = count("correct");
  const bad = count("wrong");
  const skip = n - ok - bad;
  const percent = Math.round((ok / n) * 100);
  const level = percent >= 80 ? "high" : percent >= 50 ? "mid" : "low";
  const message = {
    high: "Ajoyib natija! Mavzuni yaxshi o‘zlashtirgansiz.",
    mid: "Yaxshi! Xato qilingan savollarni ko‘rib chiqing.",
    low: "Mavzuni yana bir bor takrorlab, qayta urinib ko‘ring.",
  }[level];

  view.innerHTML = `
    <ol class="qz-crumbs" aria-label="Sahifa yo‘li">
      <li><a href="quizs.html">Quizlar</a></li>
      <li aria-current="page">Natija</li>
    </ol>
    <section class="of-card qz-result" aria-labelledby="qzResTitle">
      <div class="qz-ring" style="--p:${percent}" data-level="${level}" role="img" aria-label="Natija: ${percent}%">
        <div class="qz-ring__inner"><b class="of-num">${percent}%</b><span>${ok} / ${n}</span></div>
      </div>
      <div class="qz-result__text">
        <h1 id="qzResTitle" tabindex="-1">Quiz yakunlandi</h1>
        <p><b>${esc(quizTitle)}</b> — ${esc(message)}</p>
        <div class="qz-counts">
          <div class="qz-count qz-count--ok"><span>To‘g‘ri</span><b class="of-num">${ok}</b></div>
          <div class="qz-count qz-count--bad"><span>Noto‘g‘ri</span><b class="of-num">${bad}</b></div>
          <div class="qz-count qz-count--skip"><span>Vaqti tugagan</span><b class="of-num">${skip}</b></div>
        </div>
        <div class="qz-actions">
          <button type="button" class="of-btn of-btn--primary of-btn--lg" data-restart>${icon("reset")}Qayta ishlash</button>
          ${backLink("of-btn--lg")}
        </div>
      </div>
    </section>
    <section class="qz-review-wrap" aria-labelledby="qzRevTitle">
      <h2 id="qzRevTitle">Savollar tahlili</h2>
      <ol class="qz-review" data-review></ol>
    </section>`;

  const list = view.querySelector("[data-review]");
  questions.forEach((q, i) => {
    const r = results[i] || { picked: null, status: "timeout" };
    const correctIdx = q.opts.findIndex((o) => o.correct);
    const li = document.createElement("li");
    li.className = "of-card qz-rev";
    li.dataset.status = r.status;
    const verdict = { correct: ["checkCircle", "To‘g‘ri"], wrong: ["alert", "Noto‘g‘ri"], timeout: [null, "Vaqt tugagan"] }[r.status];
    li.innerHTML = `
      <div class="qz-rev__head"><span class="qz-q__num of-num">${i + 1}</span><span class="qz-rev__verdict">${verdict[0] ? icon(verdict[0]) : CLOCK}${verdict[1]}</span></div>
      <div class="qz-q__body" data-body></div>
      <dl class="qz-rev__ans"></dl>`;
    li.querySelector("[data-body]").append(richText(q.q));
    const dl = li.querySelector("dl");
    const row = (label, idx, cls) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.className = cls;
      if (idx == null) dd.textContent = "—";
      else dd.append(`${LETTERS[idx]}) `, richText(q.opts[idx].text));
      dl.append(dt, dd);
    };
    if (r.status !== "correct") row("Sizning javobingiz", r.picked, "is-wrong");
    row("To‘g‘ri javob", correctIdx, "is-correct");
    list.append(li);
  });

  view.querySelector("[data-restart]").addEventListener("click", () => {
    newRound();
    renderRunner();
    window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
  });
  view.querySelector(".qz-result").scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
  view.querySelector("h1").focus({ preventScroll: true });
}

// ------------------------------------------------------------------ ishga tushirish
async function init() {
  if (!isMixed && !/^\d+$/.test(topicId || "")) {
    setShellTitle("Quiz topilmadi");
    view.innerHTML = stateHtml("alert", "Quiz topilmadi", "Havolada mavzu raqami ko‘rsatilmagan.", backLink());
    return;
  }
  try {
    await loadData();
    const bad = pool.filter((q) => !isValid(q));
    if (bad.length) console.warn(`[quiz] noto'g'ri tuzilgan ${bad.length} ta savol o'tkazib yuborildi:`, bad);
    pool = pool.filter(isValid);
    if (!pool.length) throw new Error("savollar yo'q");
    if (pool.some((q) => /\$[^$]+\$/.test([q.q, ...q.a].join(" ")))) await loadKatex().catch((e) => console.warn("[quiz]", e));
  } catch (error) {
    console.error("[quiz] ma'lumot yuklanmadi:", error);
    setShellTitle("Quiz");
    view.innerHTML = stateHtml("alert", "Quiz ma’lumotlarini yuklab bo‘lmadi", "Internet aloqasini tekshirib, sahifani yangilang.", backLink());
    return;
  }
  setShellTitle(quizTitle);
  newRound();

  // Sahifa himoyalangan (qobiq kirish oynasini ko'rsatadi) — timer faqat foydalanuvchi kirgandan keyin boshlanadi.
  let started = false;
  onSession((s) => {
    if (started || s.status !== "authenticated") return;
    started = true;
    renderRunner();
  });
}

init();
