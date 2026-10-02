// ==========================================================================
// Attestatsiya → Fizika: kunlik test (attestatsiya/fizika-test.html?day=N)
//
// Oqim: START (startedAt — server) → savollar (faqat shu kun snapshoti) → sekundomer (VAQT CHEGARASI YO'Q,
// avto-submit yo'q) → TESTNI YAKUNLASH (tasdiq) → SUBMIT (javoblar qulflanadi) → kalit o'qiladi → GRADE
// (Rules har bir qiymatni tekshiradi) → darhol natija + to'g'ri/noto'g'ri + to'g'ri javob.
// To'liq yechim bu sahifada ko'rsatilmaydi — u ertasi kuni 00:00 (Toshkent) fizika-yechimlar.html da ochiladi.
// Frozen Mock Test engine ishlatilmaydi.
// ==========================================================================
import { listVisibleTests, getMyAttempt, startAttempt, getSnapshot, saveDraft, submitAttempt, gradeAttempt, getKey } from "./api.js";
import { esc, toMs, officialOpen, solutionOpen, formatTashkent, formatClock, formatDuration, questionStatus, precisePercent, gradeAnswers } from "./core.js";
import { renderBlocks, loadKatex, plainText } from "./render.js";
import { ic, fillIcons, whenUser, stateHtml, errorMessage } from "./ui.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/feedback.js";

const root = document.getElementById("attTest");
const view = root.querySelector("[data-view]");
const day = Number(new URLSearchParams(location.search).get("day"));

let uid = null;
let test = null;
let attempt = null;
let snapshot = null;
let answers = {};
let current = 0;
let clockTimer = null;
let saveTimer = null;
let dirty = false;

const draftKey = () => `oliyfizika:att:draft:${uid}:${test.id}`;
const LETTERS = ["A", "B", "C", "D", "E"];

function setTitle(text) {
  document.title = `${text} — Attestatsiya — Fizika | OliyFizika.uz`;
  const apply = () => window.OFShell?.setTitle?.(text);
  if (window.OFShell) apply(); else document.addEventListener("of:shell-ready", apply, { once: true });
}

function show(html) {
  stopClock();
  view.innerHTML = html;
  fillIcons(view);
}

// ------------------------------------------------------------------ qoralama (localStorage + Firestore)
function readLocalDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey()) || "null");
    return d && typeof d.answers === "object" ? d : null;
  } catch { return null; }
}
function writeLocalDraft() {
  try { localStorage.setItem(draftKey(), JSON.stringify({ answers, at: Date.now() })); } catch { /* ignore */ }
}
function clearLocalDraft() {
  try { localStorage.removeItem(draftKey()); } catch { /* ignore */ }
}
function scheduleSave() {
  dirty = true;
  writeLocalDraft();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 6000);
}
async function flushSave() {
  if (!dirty || !attempt || attempt.status !== "in_progress") return;
  dirty = false;
  const label = view.querySelector("[data-saved]");
  try {
    await saveDraft(uid, test.id, answers);
    if (label) label.textContent = "Javoblar saqlandi";
  } catch (e) {
    dirty = true;
    console.warn("[att] qoralama:", e?.code || e);
    if (label) label.textContent = "Javoblar shu qurilmada saqlandi";
  }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });

// ------------------------------------------------------------------ sekundomer (faqat o'tgan vaqt)
function startClock() {
  stopClock();
  const startMs = toMs(attempt.startedAt);
  const el = view.querySelector("[data-clock]");
  const tick = () => {
    if (!el.isConnected) return stopClock();
    const sec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    el.textContent = formatClock(sec);
    el.parentElement.setAttribute("aria-label", `Sarflangan vaqt: ${formatDuration(sec)}`);
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}
function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

// ------------------------------------------------------------------ kirish (start) ekrani
function renderIntro() {
  const resumable = attempt?.status === "in_progress";
  show(`
    <section class="of-card att-intro" aria-labelledby="attIntroTitle">
      <p class="att-eyebrow">${ic("atom")}Attestatsiya — Fizika · Day ${test.dayNumber}</p>
      <h1 id="attIntroTitle">${esc(test.sectionTitle)}: ${esc(test.topics.join(", "))}</h1>
      <ul class="att-facts">
        <li>${ic("list")}<span><b>${test.questionCount}</b>savol</span></li>
        <li>${ic("target")}<span><b>${test.scorableCount}</b>ballga kiradi</span></li>
        <li>${ic("clock")}<span><b>Chegarasiz</b>faqat sekundomer</span></li>
        <li>${ic("calendar")}<span><b>${esc(formatTashkent(test.solutionAvailableAt))}</b>yechimlar ochiladi</span></li>
      </ul>
      <p class="of-muted">Test faqat <b>bir marta rasmiy</b> topshiriladi. Javoblaringiz avtomatik saqlanadi — sahifani yopsangiz, keyin davom ettirishingiz mumkin. Topshirgan zahoti natija va to‘g‘ri javoblar ko‘rinadi.</p>
      ${test.questionCount - test.scorableCount > 0 ? `<p class="of-subtle">${test.questionCount - test.scorableCount} ta savol (variantsiz yoki manbasida noaniqlik bor) testda qoladi, lekin ballga kirmaydi.</p>` : ""}
      <div class="of-row" style="flex-wrap:wrap">
        <button type="button" class="of-btn of-btn--primary of-btn--lg" data-start>${ic("play")}${resumable ? "Davom ettirish" : "Testni boshlash"}</button>
        <a class="of-btn of-btn--ghost of-btn--lg" href="fizikaattestatsiya.html">Orqaga</a>
      </div>
    </section>`);
  view.querySelector("[data-start]").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.classList.add("is-loading");
    try {
      attempt = await startAttempt(uid, test);
      await openRunner();
    } catch (e) {
      console.error("[att] start:", e);
      btn.classList.remove("is-loading");
      toast(errorMessage(e));
    }
  });
}

// ------------------------------------------------------------------ test ishlash
async function openRunner() {
  if (!snapshot) snapshot = await getSnapshot(test.id, attempt.testVersion);
  await loadKatex().catch(() => {});
  const local = readLocalDraft();
  answers = { ...(attempt.answers || {}), ...(local?.answers || {}) };
  for (const q of Object.keys(answers)) if (!snapshot.questionIds.includes(q) || !LETTERS.includes(answers[q])) delete answers[q];
  const firstUnanswered = snapshot.questions.findIndex((q) => q.optionCount && !answers[q.id]);
  current = firstUnanswered >= 0 ? firstUnanswered : 0;
  const n = snapshot.questions.length;
  show(`
    <div class="att-test">
      <div class="att-test__main">
        <div class="of-card att-bar">
          <span class="att-bar__title">Day ${test.dayNumber}</span>
          <span class="att-bar__count of-num" data-count aria-live="polite"></span>
          <div class="of-progress" role="progressbar" aria-label="Javob berilgan savollar" aria-valuemin="0" aria-valuemax="${n}" data-bar><span></span></div>
          <span class="att-clock" role="timer" aria-live="off">${ic("clock")}<span class="of-sr-only">Sarflangan vaqt:</span><span data-clock>00:00</span></span>
        </div>
        <article class="of-card att-q" data-q aria-labelledby="attQNum"></article>
      </div>
      <aside class="of-card att-side" aria-labelledby="attNavTitle">
        <h2 id="attNavTitle">Savollar</h2>
        <ol class="att-grid" data-grid></ol>
        <ul class="att-legend"><li><i data-k="answered"></i>Javob berilgan</li><li><i></i>Javobsiz</li><li><i data-k="unscored"></i>Ballga kirmaydi</li></ul>
        <div class="att-side__summary"><span data-sum-answered></span><span data-sum-left></span></div>
        <button type="button" class="of-btn of-btn--success of-btn--lg of-btn--block" data-finish>${ic("flag")}Testni yakunlash</button>
        <p class="att-saved" data-saved aria-live="polite"></p>
      </aside>
    </div>`);
  const grid = view.querySelector("[data-grid]");
  grid.innerHTML = snapshot.questions.map((q, i) =>
    `<li><button type="button" data-go="${i}" aria-label="${i + 1}-savol"${q.evaluationType !== "auto" ? ' data-status="unscored"' : ""}>${i + 1}</button></li>`).join("");
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) go(Number(b.dataset.go), true);
  });
  view.querySelector("[data-finish]").addEventListener("click", confirmFinish);
  renderQuestion();
  updateProgress();
  startClock();
}

function go(i, focus = false) {
  current = Math.max(0, Math.min(snapshot.questions.length - 1, i));
  renderQuestion();
  updateProgress();
  if (focus) view.querySelector("[data-q]").focus?.();
  view.querySelector("[data-q]").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function renderQuestion() {
  const q = snapshot.questions[current];
  const n = snapshot.questions.length;
  const card = view.querySelector("[data-q]");
  card.tabIndex = -1;
  const evalNote = q.evaluationType === "open"
    ? '<span class="of-badge">Variantsiz · ballga kirmaydi</span>'
    : q.evaluationType === "unreliable" ? '<span class="of-badge of-badge--orange">Ballga kirmaydi</span>' : "";
  card.innerHTML = `
    <div class="att-q__head">
      <span class="att-q__num" id="attQNum">${current + 1} / ${n}</span>
      <span class="of-badge of-badge--blue">${esc(q.topic)}</span>
      ${evalNote}
    </div>
    <div class="att-q__body" data-qbody></div>
    <div data-opts></div>
    <div class="att-q__nav">
      <button type="button" class="of-btn" data-prev ${current === 0 ? "disabled" : ""}>${ic("chevronLeft")}Oldingi</button>
      ${answers[q.id] ? '<button type="button" class="of-btn of-btn--ghost" data-clear>Javobni bekor qilish</button>' : ""}
      ${current < n - 1
        ? `<button type="button" class="of-btn of-btn--primary" data-next>Keyingi${ic("chevronRight")}</button>`
        : `<button type="button" class="of-btn of-btn--success" data-finish2>${ic("flag")}Yakunlash</button>`}
    </div>`;
  card.querySelector("[data-qbody]").append(renderBlocks(q.question, { testId: test.id, scope: "question" }));
  const optsBox = card.querySelector("[data-opts]");
  if (!q.optionCount) {
    optsBox.innerHTML = '<p class="att-open-note">Bu savol variantsiz (ochiq). Javobingizni daftarga yozib qo‘ying — bosqichma-bosqich yechimi ertaga «Yechimlar» bo‘limida ochiladi.</p>';
  } else {
    const list = document.createElement("ul");
    list.className = "att-opts";
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-labelledby", "attQNum");
    q.options.forEach((o, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "att-opt";
      btn.setAttribute("role", "radio");
      const checked = answers[q.id] === o.key;
      btn.setAttribute("aria-checked", String(checked));
      btn.tabIndex = checked || (!answers[q.id] && i === 0) ? 0 : -1;
      btn.dataset.key = o.key;
      btn.setAttribute("aria-label", `${o.key}) ${plainText(o.blocks)}`);
      const key = document.createElement("span");
      key.className = "att-opt__key";
      key.textContent = o.key;
      const content = document.createElement("span");
      content.className = "att-opt__content";
      content.append(renderBlocks(o.blocks, { testId: test.id, scope: "question" }));
      btn.append(key, content);
      li.append(btn);
      list.append(li);
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest(".att-opt");
      if (b) choose(q, b.dataset.key);
    });
    list.addEventListener("keydown", (e) => {
      const btns = [...list.querySelectorAll(".att-opt")];
      const idx = btns.indexOf(document.activeElement);
      if (idx < 0) return;
      let next = null;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % btns.length;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + btns.length) % btns.length;
      if (next != null) {
        e.preventDefault();
        btns[next].focus();
        choose(q, btns[next].dataset.key, false);
      }
    });
    optsBox.append(list);
  }
  card.querySelector("[data-prev]").addEventListener("click", () => go(current - 1));
  card.querySelector("[data-next]")?.addEventListener("click", () => go(current + 1));
  card.querySelector("[data-finish2]")?.addEventListener("click", confirmFinish);
  card.querySelector("[data-clear]")?.addEventListener("click", () => {
    delete answers[q.id];
    scheduleSave();
    renderQuestion();
    updateProgress();
  });
}

function choose(q, key, rerender = true) {
  answers[q.id] = key;
  scheduleSave();
  if (rerender) {
    renderQuestion();
    view.querySelector(`.att-opt[data-key="${key}"]`)?.focus();
  } else {
    view.querySelectorAll(".att-opt").forEach((b) => {
      const on = b.dataset.key === key;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  updateProgress();
}

function updateProgress() {
  const qs = snapshot.questions;
  const answerable = qs.filter((q) => q.optionCount).length;
  const answered = qs.filter((q) => answers[q.id]).length;
  view.querySelector("[data-count]").textContent = `${current + 1} / ${qs.length}`;
  const bar = view.querySelector("[data-bar]");
  bar.style.setProperty("--value", Math.round((answered * 100) / (answerable || 1)));
  bar.setAttribute("aria-valuenow", answered);
  bar.setAttribute("aria-valuemax", answerable);
  bar.setAttribute("aria-valuetext", `${answered} / ${answerable} savolga javob berilgan`);
  view.querySelectorAll("[data-go]").forEach((b) => {
    const q = qs[Number(b.dataset.go)];
    b.dataset.answered = String(Boolean(answers[q.id]));
    if (Number(b.dataset.go) === current) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    b.setAttribute("aria-label", `${Number(b.dataset.go) + 1}-savol: ${answers[q.id] ? `javob ${answers[q.id]}` : q.optionCount ? "javobsiz" : "variantsiz"}`);
  });
  view.querySelector("[data-sum-answered]").textContent = `Javob berilgan: ${answered}`;
  view.querySelector("[data-sum-left]").textContent = `Javobsiz: ${answerable - answered}`;
}

function confirmFinish() {
  const qs = snapshot.questions;
  const answerable = qs.filter((q) => q.optionCount);
  const left = answerable.filter((q) => !answers[q.id]).length;
  openModal({
    title: "Testni yakunlashni xohlaysizmi?",
    text: `Javoblaringiz tekshiriladi va natija darhol ko‘rsatiladi. Rasmiy urinish bitta — yakunlagandan keyin javoblarni o‘zgartirib bo‘lmaydi.${left ? ` Javob berilmagan savollar: ${left} ta.` : ""}`,
    iconName: "flag",
    actions: [
      { label: "Ha, yakunlash", variant: "success", onClick: (_e, m) => { m.close(); finish(); } },
      { label: "Davom etish", onClick: (_e, m) => m.close() },
    ],
  });
}

async function finish() {
  clearTimeout(saveTimer);
  stopClock();
  show(stateHtml("check", "Javoblar tekshirilmoqda…", "Iltimos, kuting."));
  try {
    attempt = await submitAttempt(uid, test.id, answers);
    clearLocalDraft();
    const { attempt: graded, key } = await gradeAttempt(attempt);
    attempt = graded;
    renderResult(key);
    toast("Test yakunlandi. Natija saqlandi.");
  } catch (e) {
    console.error("[att] submit/grade:", e);
    show(stateHtml("alert", "Natijani saqlab bo‘lmadi", `${errorMessage(e)} Javoblaringiz shu qurilmada saqlangan.`,
      '<button type="button" class="of-btn of-btn--primary" data-retry>Qayta urinish</button>'));
    view.querySelector("[data-retry]").addEventListener("click", () => location.reload());
  }
}

// ------------------------------------------------------------------ natija
const VERDICT = {
  correct: ["checkCircle", "To‘g‘ri"],
  wrong: ["xCircle", "Noto‘g‘ri"],
  unanswered: ["circle", "Javobsiz"],
  unscored: ["minusCircle", "Ballga kirmaydi"],
};

async function renderResult(key) {
  if (!snapshot) snapshot = await getSnapshot(test.id, attempt.testVersion);
  await loadKatex().catch(() => {});
  const a = attempt;
  const g = a.status === "graded" ? a : { ...a, ...gradeAnswers(a.answers || {}, key, a.questionCount) };
  const ans = a.answers || {};
  const solOpen = solutionOpen(test);
  const unscored = snapshot.questions.filter((q) => q.evaluationType !== "auto").length;
  setTitle(`Day ${test.dayNumber} — natija`);
  show(`
    <section class="of-card att-result" aria-labelledby="attResTitle">
      <div class="att-result__score">
        <div class="att-ring" style="--p:${g.scorePercent}" role="img" aria-label="Natija ${precisePercent(g.correctAnswers, g.scorableQuestions)} foiz">
          <div class="att-ring__inner"><div><b>${precisePercent(g.correctAnswers, g.scorableQuestions)}%</b><br><span>natija</span></div></div>
        </div>
        <div>
          <p class="att-eyebrow">Natija · Day ${test.dayNumber}</p>
          <h1 id="attResTitle" class="att-result__big of-num">${g.correctAnswers} <small>/ ${g.scorableQuestions}</small></h1>
          <p class="of-subtle">${esc(test.sectionTitle)} · ${esc(test.topics.join(", "))}</p>
        </div>
      </div>
      <div class="att-counts">
        <div class="att-count att-count--ok"><span>${ic("checkCircle")}To‘g‘ri</span><b class="of-num">${g.correctAnswers}</b></div>
        <div class="att-count att-count--bad"><span>${ic("xCircle")}Noto‘g‘ri</span><b class="of-num">${g.wrongAnswers}</b></div>
        <div class="att-count att-count--skip"><span>${ic("circle")}Javobsiz</span><b class="of-num">${g.unanswered}</b></div>
      </div>
      <div class="att-result__meta">
        <span>${ic("clock")}Sarflangan vaqt: <b>${esc(formatDuration(g.timeSpentSeconds))}</b></span>
        <span>${ic("calendar")}Topshirilgan: ${esc(formatTashkent(a.completedAt))}</span>
        ${unscored ? `<span>${ic("info")}${unscored} ta savol (variantsiz/noaniq) ballga kiritilmadi</span>` : ""}
      </div>
    </section>
    ${solOpen
      ? `<p class="att-lock-note">${ic("unlock")}<span>To‘liq bosqichma-bosqich yechimlar ochiq. <a href="fizika-yechimlar.html?day=${test.dayNumber}">Yechimlarni ko‘rish</a></span></p>`
      : `<p class="att-lock-note">${ic("lock")}<span>To‘liq yechimlar <b>${esc(formatTashkent(test.solutionAvailableAt))}</b> da (Toshkent vaqti) «Yechimlar» bo‘limida ochiladi. Hozir har bir savol bo‘yicha natija va to‘g‘ri javob ko‘rsatilgan.</span></p>`}
    <section aria-labelledby="attRevTitle" class="att">
      <div class="of-section-title"><h2 id="attRevTitle">Savollar bo‘yicha natija</h2></div>
      <ol class="att-review" data-review></ol>
    </section>
    <div class="of-row" style="flex-wrap:wrap">
      <a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">Dashboard</a>
      <a class="of-btn" href="fizika-natijalar.html">Natijalar va statistika</a>
    </div>`);
  const list = view.querySelector("[data-review]");
  snapshot.questions.forEach((q, i) => {
    const st = questionStatus(q.id, q.evaluationType, ans, g);
    const [icn, label] = VERDICT[st];
    const correctKey = key?.answers?.[q.id];
    const li = document.createElement("li");
    li.innerHTML = `
      <details class="of-card att-rev" data-status="${st}">
        <summary>
          <b class="of-num">${i + 1}.</b>
          <span class="att-rev__verdict">${ic(icn)}${label}</span>
          <span class="of-subtle">${esc(q.topic)}</span>
          <span class="att-rev__answers">
            ${q.optionCount ? `<span>Sizning javobingiz: <b>${esc(ans[q.id] || "—")}</b></span>` : "<span>Variantsiz savol</span>"}
            ${correctKey && st !== "correct" ? `<span>To‘g‘ri javob: <b>${esc(correctKey)}</b></span>` : ""}
          </span>
        </summary>
        <div data-body></div>
      </details>`;
    const det = li.querySelector("details");
    det.addEventListener("toggle", () => {
      if (!det.open || det.dataset.rendered) return;
      det.dataset.rendered = "1";
      const body = det.querySelector("[data-body]");
      const qb = document.createElement("div");
      qb.className = "att-q__body";
      qb.append(renderBlocks(q.question, { testId: test.id, scope: "question" }));
      body.append(qb);
      if (q.optionCount) {
        const ul = document.createElement("ul");
        ul.className = "att-opts";
        q.options.forEach((o) => {
          const liO = document.createElement("li");
          const d = document.createElement("div");
          d.className = "att-opt";
          if (o.key === correctKey) d.dataset.review = "correct";
          else if (o.key === ans[q.id] && st === "wrong") d.dataset.review = "wrong";
          const k = document.createElement("span");
          k.className = "att-opt__key";
          k.textContent = o.key;
          const c = document.createElement("span");
          c.className = "att-opt__content";
          c.append(renderBlocks(o.blocks, { testId: test.id, scope: "question" }));
          d.append(k, c);
          liO.append(d);
          ul.append(liO);
        });
        body.append(ul);
      }
    });
    list.append(li);
  });
}

// ------------------------------------------------------------------ yuklash
(async () => {
  const s = await whenUser();
  uid = s.user.uid;
  if (!Number.isInteger(day) || day < 1) {
    show(stateHtml("alert", "Kun ko‘rsatilmagan", "Dashboard’dan kerakli kunni tanlang.", '<a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">Dashboard</a>'));
    return;
  }
  setTitle(`Day ${day} — kunlik test`);
  try {
    const tests = await listVisibleTests();
    test = tests.find((t) => t.dayNumber === day) || null;
    if (!test) {
      show(stateHtml("lock", `Day ${day} hali e’lon qilinmagan`, "Test administrator e’lon qilgandan keyin shu yerda ochiladi.", '<a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">Dashboard</a>'));
      return;
    }
    attempt = await getMyAttempt(uid, test.id);
    if (attempt?.status === "graded") {
      const key = await getKey(test.id, attempt.testVersion);
      return renderResult(key);
    }
    if (attempt?.status === "submitted") {
      const r = await gradeAttempt(attempt);
      attempt = r.attempt;
      return renderResult(r.key);
    }
    if (!officialOpen(test)) {
      const solLink = solutionOpen(test) ? `<a class="of-btn of-btn--primary" href="fizika-yechimlar.html?day=${day}">Yechimlarni ko‘rish</a>` : "";
      show(stateHtml("lock", `Day ${day}: rasmiy muddat tugagan`,
        attempt ? "Bu testni topshirmagansiz — rasmiy natija saqlanmadi." : "Bu kunning rasmiy testi yopilgan. To‘liq yechimlar bilan tanishishingiz mumkin.",
        `<div class="of-row" style="justify-content:center;flex-wrap:wrap">${solLink}<a class="of-btn" href="fizikaattestatsiya.html">Dashboard</a></div>`));
      return;
    }
    renderIntro();
  } catch (e) {
    console.error("[att] test:", e);
    show(stateHtml("alert", "Testni yuklab bo‘lmadi", errorMessage(e), '<a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">Dashboard</a>'));
  }
})();
