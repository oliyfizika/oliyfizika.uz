// ==========================================================================
// GRE Physics — mashq testi (gre/test.html?bob=N, N=0 — aralash)
//
// Savollar: gre/data/bob-N.json  { id, title, area, questions:[{ q, a:[5 ta], c, e }] }
// Ro'yxat: gre/data/manifest.json (aralash testdagi savollar soni — `mixedCount`,
// GRE tezligi — `secondsPerQuestion`: 170 daqiqa / 100 savol ≈ 102 soniya).
//
// Qoidalar: bob testida bobning barcha savollari, aralash testda `mixedCount` ta tasodifiy savol;
// variantlar aralashtiriladi; javob tanlangach to'g'ri javob va yechim izohi ko'rsatiladi.
//
// TIL: GRE testlari faqat ingliz tilida (savollar ham, test sahifasi matnlari ham).
// Tarjima qatlami yo'q; #grePage da lang="en" va translate="no" — brauzer avto-tarjimasi ham o'chirilgan.
// Sidebar qobig'i (app-shell) va GRE katalog sahifasi o'zbekcha qoladi.
// Har savolga majburiy timer yo'q — umumiy vaqt GRE tezligi bilan solishtirib ko'rsatiladi.
// ==========================================================================
import { icon } from "../ui/icons.js";
import { onSession } from "../core/session.js";
import { saveBest } from "./gre-store.js";

const LETTERS = ["A", "B", "C", "D", "E"];
const DATA_BASE = new URL("data/", location.href);
const KATEX_BASE = new URL("../../vendor/katex/", import.meta.url).href;
const CLOCK = '<svg class="of-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>';

const root = document.getElementById("grePage");
const view = root.querySelector("[data-view]");
const chapterId = new URLSearchParams(location.search).get("bob");
const isMixed = chapterId === "0";

let manifest = null;
let title = "";
let pool = [];
let questions = [];   // { q, e, opts:[{ text, correct }] }
let results = [];     // { picked, status: "correct"|"wrong" }
let current = 0;
let answered = false;
let startedAt = 0;
let tickId = null;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pace = () => Number(manifest?.secondsPerQuestion) || 102;

// ------------------------------------------------------------------ KaTeX (lokal)
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

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setShellTitle(text) {
  document.title = `${text} | OliyFizika.uz`;
  const apply = () => window.OFShell?.setTitle?.(text);
  if (window.OFShell) apply(); else document.addEventListener("of:shell-ready", apply, { once: true });
}

function stateHtml(iconName, heading, text = "", action = "") {
  return `<div class="of-card qz-state" role="status">${icon(iconName)}<h2>${esc(heading)}</h2>${text ? `<p>${esc(text)}</p>` : ""}${action}</div>`;
}

const backLink = (variant = "of-btn--primary") => `<a class="of-btn ${variant}" href="gre.html">${icon("chevronLeft")}Back to GRE chapters</a>`;
const crumbs = (last) => `
  <ol class="qz-crumbs" aria-label="Breadcrumb">
    <li><a href="gre.html">GRE Physics</a></li>
    <li aria-current="page">${esc(last)}</li>
  </ol>`;

async function fetchJson(name) {
  const res = await fetch(new URL(name, DATA_BASE), { cache: "no-cache" });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

const isValid = (item) => item && typeof item.q === "string" && Array.isArray(item.a) && item.a.length >= 2
  && Number.isInteger(item.c) && item.c >= 0 && item.c < item.a.length;

// ------------------------------------------------------------------ ma'lumot
async function loadData() {
  manifest = await fetchJson("manifest.json").catch((e) => {
    console.warn("[gre] manifest yuklanmadi:", e);
    return null;
  });
  if (isMixed) {
    const ids = manifest?.chapters?.map((c) => c.id) || [];
    const files = await Promise.allSettled(ids.map((id) => fetchJson(`bob-${id}.json`)));
    files.forEach((r, i) => {
      if (r.status === "fulfilled") pool.push(...(r.value.questions || []).map((q) => ({ ...q, bob: r.value.id })));
      else console.warn(`[gre] bob-${ids[i]}.json yuklanmadi`, r.reason);
    });
    title = "Mixed GRE Practice";
  } else {
    const data = await fetchJson(`bob-${chapterId}.json`);
    pool = data.questions || [];
    title = `Chapter ${data.id}. ${data.title}`;
  }
}

function newRound() {
  const list = isMixed ? shuffle([...pool]).slice(0, Number(manifest?.mixedCount) || 25) : [...pool];
  questions = list.map((item) => ({
    q: item.q,
    e: item.e || "",
    bob: item.bob,
    opts: shuffle(item.a.map((text, i) => ({ text, correct: i === item.c }))),
  }));
  results = [];
  current = 0;
  startedAt = performance.now();
}

// ------------------------------------------------------------------ test
function renderRunner() {
  view.innerHTML = `
    ${crumbs(isMixed ? "Mixed practice" : `Chapter ${chapterId}`)}
    <div class="of-card qz-bar">
      <div class="qz-bar__title"><small>GRE Physics</small><b>${esc(title)}</b></div>
      <span class="gre-clock" data-clock title="Time spent / time at GRE pace">${CLOCK}<b data-elapsed>0:00</b><span data-budget></span></span>
      <span class="qz-bar__count of-num" data-count></span>
      <div class="of-progress" role="progressbar" aria-label="Test progress" aria-valuemin="0" aria-valuemax="${questions.length}" data-bar><span></span></div>
    </div>
    <article class="of-card qz-q" data-q tabindex="-1" aria-labelledby="qzNum"></article>`;
  renderQuestion();
  startClock();
}

function renderQuestion() {
  const n = questions.length;
  const q = questions[current];
  answered = false;
  const card = view.querySelector("[data-q]");
  card.innerHTML = `
    <div class="qz-q__head">
      <span class="qz-q__num of-num" id="qzNum">Question ${current + 1}${isMixed && q.bob ? ` · Chapter ${q.bob}` : ""}</span>
    </div>
    <div class="qz-q__body" data-body></div>
    <ul class="qz-opts" data-opts></ul>
    <p class="qz-feedback" data-feedback aria-live="polite"></p>
    <div class="gre-explain" data-explain hidden><b>Solution</b><div data-explain-body></div></div>
    <div class="qz-q__nav">
      <span class="qz-hint">Keyboard: <kbd>A</kbd>–<kbd>E</kbd> or <kbd>1</kbd>–<kbd>5</kbd></span>
      <button type="button" class="of-btn of-btn--primary of-btn--lg" data-next hidden>
        ${current < n - 1 ? `Next question${icon("arrowRight")}` : `See results${icon("check")}`}
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
}

function updateProgress() {
  const n = questions.length;
  const done = results.length;
  view.querySelector("[data-count]").textContent = `${current + 1} / ${n}`;
  const bar = view.querySelector("[data-bar]");
  bar.style.setProperty("--value", Math.round((done * 100) / n));
  bar.setAttribute("aria-valuenow", done);
  bar.setAttribute("aria-valuetext", `${done} of ${n} questions answered`);
}

// ------------------------------------------------------------------ umumiy vaqt (GRE tezligi bilan solishtirish)
function startClock() {
  stopClock();
  view.querySelector("[data-budget]").textContent = `/ ${fmtTime(questions.length * pace())}`;
  renderClock();
  tickId = setInterval(renderClock, 1000);
}
function stopClock() { clearInterval(tickId); tickId = null; }
function elapsedSec() { return (performance.now() - startedAt) / 1000; }
function renderClock() {
  const el = view.querySelector("[data-clock]");
  if (!el) return stopClock();
  const sec = elapsedSec();
  el.querySelector("[data-elapsed]").textContent = fmtTime(sec);
  // Shu paytgacha GRE tezligida ketishi kerak bo'lgan vaqtdan oshib ketsa — ogohlantiruvchi rang.
  el.dataset.slow = String(sec > (results.length + 1) * pace());
}

// ------------------------------------------------------------------ javob
function choose(i) {
  if (answered) return;
  answered = true;
  const q = questions[current];
  const ok = q.opts[i].correct;
  results[current] = { picked: i, status: ok ? "correct" : "wrong" };
  const card = view.querySelector("[data-q]");
  card.querySelectorAll(".qz-opt").forEach((b) => {
    const j = Number(b.dataset.i);
    b.disabled = true;
    if (q.opts[j].correct) b.dataset.state = "correct";
    else if (j === i) b.dataset.state = "wrong";
  });
  const fb = card.querySelector("[data-feedback]");
  fb.dataset.ok = String(ok);
  fb.innerHTML = ok
    ? `${icon("checkCircle")}<span>Correct!</span>`
    : `${icon("alert")}<span>Incorrect. The correct answer is <b>${LETTERS[q.opts.findIndex((o) => o.correct)]}</b></span>`;
  if (q.e) {
    const ex = card.querySelector("[data-explain]");
    ex.querySelector("[data-explain-body]").append(richText(q.e));
    ex.hidden = false;
  }
  updateProgress();
  const btn = card.querySelector("[data-next]");
  btn.hidden = false;
  btn.focus({ preventScroll: true });
  btn.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
}

function next() {
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
    let i = LETTERS.indexOf(e.key.toUpperCase());
    if (i < 0 && /^[1-5]$/.test(e.key)) i = Number(e.key) - 1;
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
  stopClock();
  const spent = elapsedSec();
  const n = questions.length;
  const ok = results.filter((r) => r?.status === "correct").length;
  const bad = n - ok;
  const percent = Math.round((ok / n) * 100);
  const level = percent >= 80 ? "high" : percent >= 50 ? "mid" : "low";
  const message = {
    high: "Excellent! You have mastered this material at GRE level.",
    mid: "Good work! Go through the solutions and review your mistakes.",
    low: "Review the topic once more and try again.",
  }[level];
  const perQ = spent / n;
  const paceText = perQ <= pace()
    ? `You spent ${fmtTime(perQ)} per question on average, which is within GRE pace (${fmtTime(pace())}).`
    : `You spent ${fmtTime(perQ)} per question on average; the GRE allows about ${fmtTime(pace())}, so try to work faster.`;
  saveBest(isMixed ? 0 : chapterId, percent);

  view.innerHTML = `
    ${crumbs("Results")}
    <section class="of-card qz-result" aria-labelledby="qzResTitle">
      <div class="qz-ring" style="--p:${percent}" data-level="${level}" role="img" aria-label="Score: ${percent}%">
        <div class="qz-ring__inner"><b class="of-num">${percent}%</b><span>${ok} / ${n}</span></div>
      </div>
      <div class="qz-result__text">
        <h1 id="qzResTitle" tabindex="-1">Practice complete</h1>
        <p><b>${esc(title)}</b> — ${esc(message)}</p>
        <p class="gre-note">${esc(paceText)}</p>
        <div class="qz-counts">
          <div class="qz-count qz-count--ok"><span>Correct</span><b class="of-num">${ok}</b></div>
          <div class="qz-count qz-count--bad"><span>Incorrect</span><b class="of-num">${bad}</b></div>
          <div class="qz-count qz-count--skip"><span>Time</span><b class="of-num">${fmtTime(spent)}</b></div>
        </div>
        <div class="qz-actions">
          <button type="button" class="of-btn of-btn--primary of-btn--lg" data-restart>${icon("reset")}Try again</button>
          ${backLink("of-btn--lg")}
        </div>
      </div>
    </section>
    <section class="qz-review-wrap" aria-labelledby="qzRevTitle">
      <h2 id="qzRevTitle">Question review</h2>
      <ol class="qz-review" data-review></ol>
    </section>`;

  const list = view.querySelector("[data-review]");
  questions.forEach((q, i) => {
    const r = results[i];
    const correctIdx = q.opts.findIndex((o) => o.correct);
    const li = document.createElement("li");
    li.className = "of-card qz-rev";
    li.dataset.status = r.status;
    const verdict = r.status === "correct" ? ["checkCircle", "Correct"] : ["alert", "Incorrect"];
    li.innerHTML = `
      <div class="qz-rev__head"><span class="qz-q__num of-num">${i + 1}</span><span class="qz-rev__verdict">${icon(verdict[0])}${verdict[1]}</span></div>
      <div class="qz-q__body" data-body></div>
      <dl class="qz-rev__ans"></dl>`;
    li.querySelector("[data-body]").append(richText(q.q));
    const dl = li.querySelector("dl");
    const row = (label, idx, cls) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.className = cls;
      dd.append(`${LETTERS[idx]}) `, richText(q.opts[idx].text));
      dl.append(dt, dd);
    };
    if (r.status !== "correct") row("Your answer", r.picked, "is-wrong");
    row("Correct answer", correctIdx, "is-correct");
    if (q.e) {
      const ex = document.createElement("div");
      ex.className = "gre-explain";
      const b = document.createElement("b");
      b.textContent = "Solution";
      const body = document.createElement("div");
      body.append(richText(q.e));
      ex.append(b, body);
      li.append(ex);
    }
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
  if (!isMixed && !/^\d+$/.test(chapterId || "")) {
    setShellTitle("Chapter not found");
    view.innerHTML = stateHtml("alert", "Chapter not found", "The link does not specify a chapter number.", backLink());
    return;
  }
  try {
    await loadData();
    const bad = pool.filter((q) => !isValid(q));
    if (bad.length) console.warn(`[gre] noto'g'ri tuzilgan ${bad.length} ta savol o'tkazib yuborildi:`, bad);
    pool = pool.filter(isValid);
    if (!pool.length) throw new Error("savollar yo'q");
    await loadKatex().catch((e) => console.warn("[gre]", e));
  } catch (error) {
    console.error("[gre] ma'lumot yuklanmadi:", error);
    setShellTitle("GRE Practice");
    view.innerHTML = stateHtml("alert", "Could not load the test data", "Check your internet connection and reload the page.", backLink());
    return;
  }
  setShellTitle(title);
  newRound();

  // Sahifa himoyalangan — test foydalanuvchi kirgandan keyin boshlanadi.
  let started = false;
  onSession((s) => {
    if (started || s.status !== "authenticated") return;
    started = true;
    newRound();
    renderRunner();
  });
}

init();
