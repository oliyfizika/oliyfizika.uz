// ==========================================================================
// Attestatsiya → Fizika: kunlik test (attestatsiya/fizika-test.html?day=N)
//
// Oqim: START (startedAt — server) → savollar (faqat shu kun snapshoti) → sekundomer (VAQT CHEGARASI YO'Q,
// avto-submit yo'q) → TESTNI YAKUNLASH (tasdiq) → SUBMIT (javoblar qulflanadi) → kalit o'qiladi → GRADE
// (Rules har bir qiymatni tekshiradi) → darhol natija + to'g'ri/noto'g'ri + to'g'ri javob.
// To'liq yechim bu sahifada ko'rsatilmaydi — u fizika-yechimlar.html da: testni yakunlagan zahoti (yoki ertasi kuni 00:00, Toshkent) ochiladi.
// Frozen Mock Test engine ishlatilmaydi.
// ==========================================================================
import { listVisibleTests, getMyAttempt, startAttempt, getSnapshot, saveDraft, submitAttempt, gradeAttempt, getKey } from "./api.js";
import { isOverdue, finalizeIfOverdue } from "./finalize.js";
import { bindCalculatorButton, CALC_ICON } from "./calculator-panel.js";
import { loadAccessContext, dayOpen, accessText, ACCESS_TITLE, COURSE_URL } from "./access.js";
import { esc, toMs, timeLimitOf, attemptEndMs, remainingSeconds, formatLimit, serverSkewMs, isMock, mockCompositionText, dayLabel, dayLabelOf, mockPoints, mockMax, officialOpen, solutionOpen, solutionOpenFor, formatTashkent, formatClock, formatDuration, questionStatus, precisePercent, gradeAnswers } from "./core.js";
import { renderBlocks, loadKatex, plainText } from "./render.js";
import { ic, fillIcons, whenUser, stateHtml, errorMessage } from "./ui.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/feedback.js";
import { t } from "../core/i18n.js";

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
let skewMs = 0;                       // server soati − brauzer soati (hisoblagich haqiqiy vaqtni ko'rsatsin)
let timeUpFired = false;
const nowMs = () => Date.now() + skewMs;

const draftKey = () => `oliyfizika:att:draft:${uid}:${test.id}`;
const LETTERS = ["A", "B", "C", "D", "E"];

function setTitle(text) {
  document.title = `${text} — ${t("att.t.titleSuffix", "Attestatsiya — Fizika")} | OliyFizika.uz`;
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
    if (label) label.textContent = t("att.t.saved", "Javoblar saqlandi");
  } catch (e) {
    dirty = true;
    console.warn("[att] qoralama:", e?.code || e);
    if (label) label.textContent = t("att.t.savedLocal", "Javoblar shu qurilmada saqlandi");
  }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });

// ------------------------------------------------------------------ sekundomer (faqat o'tgan vaqt)
function startClock() {
  stopClock();
  const el = view.querySelector("[data-clock]");
  if (timeLimitOf(test)) return startCountdown(el);
  const startMs = toMs(attempt.startedAt);
  const tick = () => {
    if (!el.isConnected) return stopClock();
    const sec = Math.max(0, Math.floor((nowMs() - startMs) / 1000));
    el.textContent = formatClock(sec);
    el.parentElement.setAttribute("aria-label", t("att.t.elapsedAria", "Sarflangan vaqt: {d}", { d: formatDuration(sec) }));
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

/** Yechim vaqti vaqt chegarasidan oldin kelsa (kechqurun boshlangan) — chegara = yechim vaqti */
function limitedBySolution() {
  const lim = timeLimitOf(test);
  const sol = toMs(test.solutionAvailableAt);
  return isMock(test) && !!lim && sol != null && !attempt && nowMs() + lim * 1000 > sol;
}

// ------------------------------------------------------------------ teskari hisoblagich (vaqt chegarasi: mock — 2 soat)
// Hisob: startedAt (SERVER vaqti, urinish hujjatida) + limit → sahifa yangilansa ham hisoblagich qolgan joyidan davom etadi.
const ANNOUNCE = [1800, 600, 300, 60];          // soniya: ekran o'qigichlar uchun e'lon
function startCountdown(el) {
  const box = el.closest("[data-countdown]");
  const live = view.querySelector("[data-time-live]");
  const said = new Set();
  const tick = () => {
    if (!el.isConnected) return stopClock();
    const left = remainingSeconds(attempt, test, nowMs());
    if (left == null) return;
    el.textContent = formatClock(left);
    box.dataset.level = left <= 60 ? "danger" : left <= 600 ? "warn" : "ok";
    box.setAttribute("aria-label", t("att.t.leftAria", "Qolgan vaqt: {d}", { d: formatDuration(left) }));
    const crossed = ANNOUNCE.filter((t) => left <= t);
    if (left > 0 && crossed.some((t) => !said.has(t))) {         // yangi chegaradan o'tildi: bitta e'lon
      crossed.forEach((t) => said.add(t));
      if (live) live.textContent = t("att.t.leftAria", "Qolgan vaqt: {d}", { d: formatDuration(left) });
    }
    if (left <= 0) timeUp();
  };
  tick();
  if (!timeUpFired) clockTimer = setInterval(tick, 1000);
}

/** Vaqt tugadi: joriy javoblar bilan avtomatik topshiriladi (tasdiqsiz). Server tekshiradi (Rules: attInTime). */
function timeUp() {
  if (timeUpFired) return;
  timeUpFired = true;
  stopClock();
  toast(t("att.t.timeUp", "Vaqt tugadi — javoblaringiz avtomatik topshirilmoqda."));
  finish();
}
function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

// ------------------------------------------------------------------ kirish (start) ekrani
function renderIntro() {
  const resumable = attempt?.status === "in_progress";
  const startLabel = resumable ? t("att.t.resume", "Davom ettirish") : t("att.t.start", "Testni boshlash");
  show(`
    <section class="of-card att-intro" aria-labelledby="attIntroTitle">
      <p class="att-eyebrow">${ic("atom")}${t("att.t.eyebrow", "Attestatsiya — Fizika · {day}", { day: esc(dayLabel(test)) })}</p>
      <h1 id="attIntroTitle">${isMock(test)
        ? t("att.t.mockTitle", "Mock test: {c}", { c: esc(mockCompositionText(test, "ta ")) })
        : `${esc(test.sectionTitle)}: ${esc(test.topics.join(", "))}`}</h1>
      <ul class="att-facts">
        <li>${ic("list")}<span><b>${test.questionCount}</b>${t("att.t.qWord", "savol")}</span></li>
        <li>${ic("target")}<span><b>${isMock(test) ? t("att.t.pointsN", "{n} ball", { n: mockMax(test) }) : test.scorableCount}</b>${isMock(test) ? t("att.t.perQ", "har savol {p} ball", { p: test.pointsPerQuestion || 2 }) : t("att.t.scored", "ballga kiradi")}</span></li>
        <li>${ic("clock")}<span>${timeLimitOf(test) ? `<b>${esc(formatLimit(timeLimitOf(test)))}</b>${resumable ? t("att.t.leftIs", "qolgan vaqt: {c}", { c: esc(formatClock(remainingSeconds(attempt, test, nowMs()))) }) : t("att.t.countsFromStart", "boshlagandan hisoblanadi")}` : t("att.t.noLimit", "<b>Chegarasiz</b>faqat sekundomer")}</span></li>
        <li>${ic("calendar")}<span>${isMock(test)
          ? t("att.t.solAtMock", "<b>{at}</b>yechimlar ochiladi (testni yakunlasangiz — darhol)", { at: esc(formatTashkent(test.solutionAvailableAt)) })
          : t("att.t.solOnFinish", "<b>Yakunlaganda</b>yechimlar shu zahoti ochiladi")}</span></li>
      </ul>
      <p class="of-muted">${t("att.t.introNote", "Test faqat <b>bir marta rasmiy</b> topshiriladi{any}. Javoblaringiz avtomatik saqlanadi — sahifani yopsangiz, keyin davom ettirishingiz mumkin. Topshirgan zahoti natija va to‘g‘ri javoblar ko‘rinadi.", { any: isMock(test) ? "" : t("att.t.anyDay", " — uni xohlagan kuningizda boshlashingiz mumkin") })}</p>
      ${timeLimitOf(test) ? `<p class="att-limit-note">${ic("clock")}<span>${t("att.t.limitNote", "«{btn}» bosilgan zahoti <b>{lim}</b> hisoblanadi. Sahifani yangilasangiz yoki yopsangiz ham vaqt to‘xtamaydi — qolgan vaqtdan davom etasiz. Vaqt tugaganda javoblaringiz <b>avtomatik topshiriladi</b>.{sol}", { btn: startLabel, lim: esc(formatLimit(timeLimitOf(test))), sol: limitedBySolution() ? t("att.t.limitSol", " Yechimlar {at} da ochilgani uchun bugun sizda atigi <b>{left}</b> qolgan.", { at: esc(formatTashkent(test.solutionAvailableAt)), left: esc(formatLimit(Math.max(60, Math.floor((toMs(test.solutionAvailableAt) - nowMs()) / 1000)))) }) : "" })}</span></p>` : ""}
      ${isMock(test) ? `<p class="of-subtle">${test.composition?.kasbiyStandart != null ? t("att.t.orderKasbiy", "Bo‘limlar tartibi: Fizika, Kasbiy standart, Pedagogik mahorat.") : t("att.t.orderPhysics", "Fizika: Mexanika, Molekulyar fizika, Elektr va magnetizm, Optika, Atom va yadro fizikasi — har bobdan 8 tadan; so‘ng Pedagogika bo‘limi.")}</p>` : ""}
      ${test.questionCount - test.scorableCount > 0 ? `<p class="of-subtle">${t("att.t.unscoredNote", "{n} ta savol (variantsiz yoki manbasida noaniqlik bor) testda qoladi, lekin ballga kirmaydi.", { n: test.questionCount - test.scorableCount })}</p>` : ""}
      <div class="of-row" style="flex-wrap:wrap">
        <button type="button" class="of-btn of-btn--primary of-btn--lg" data-start>${ic("play")}${startLabel}</button>
        <a class="of-btn of-btn--ghost of-btn--lg" href="fizikaattestatsiya.html">${t("att.t.back", "Orqaga")}</a>
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
  if (!snapshot) snapshot = await getSnapshot(test.id, attemptVersion(attempt));
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
          <span class="att-bar__title">${esc(dayLabel(test))}</span>
          <span class="att-bar__count of-num" data-count aria-live="polite"></span>
          <div class="of-progress" role="progressbar" aria-label="${t("att.t.answeredBar", "Javob berilgan savollar")}" aria-valuemin="0" aria-valuemax="${n}" data-bar><span></span></div>
          ${timeLimitOf(test)
            ? `<span class="att-clock att-clock--left" role="timer" aria-live="off" data-level="ok" data-countdown>${ic("clock")}<span class="att-clock__label">${t("att.t.timeLeft", "Qolgan vaqt")}</span><span class="of-sr-only">:</span><span data-clock>--:--</span></span>
          <span class="of-sr-only" role="status" aria-live="polite" data-time-live></span>`
            : `<span class="att-clock" role="timer" aria-live="off">${ic("clock")}<span class="of-sr-only">${t("att.t.elapsed", "Sarflangan vaqt:")}</span><span data-clock>00:00</span></span>`}
          <button type="button" class="of-btn of-btn--sm att-calc-btn" data-calc title="${t("att.t.calc", "Kalkulyator")}" aria-label="${t("att.t.calc", "Kalkulyator")}">${CALC_ICON}<span class="att-calc-btn__label">${t("att.t.calc", "Kalkulyator")}</span></button>
        </div>
        <article class="of-card att-q" data-q aria-labelledby="attQNum"></article>
      </div>
      <aside class="of-card att-side" aria-labelledby="attNavTitle">
        <h2 id="attNavTitle">${t("att.t.questions", "Savollar")}</h2>
        <ol class="att-grid" data-grid></ol>
        <ul class="att-legend"><li><i data-k="answered"></i>${t("att.t.legendAnswered", "Javob berilgan")}</li><li><i></i>${t("att.t.f.unanswered", "Javobsiz")}</li><li><i data-k="unscored"></i>${t("att.t.v.unscored", "Ballga kirmaydi")}</li></ul>
        <div class="att-side__summary"><span data-sum-answered></span><span data-sum-left></span></div>
        <button type="button" class="of-btn of-btn--success of-btn--lg of-btn--block" data-finish>${ic("flag")}${t("att.t.finish", "Testni yakunlash")}</button>
        <p class="att-saved" data-saved aria-live="polite"></p>
      </aside>
    </div>`);
  const grid = view.querySelector("[data-grid]");
  grid.innerHTML = snapshot.questions.map((q, i) =>
    `<li><button type="button" data-go="${i}" aria-label="${t("att.t.qN", "{n}-savol", { n: i + 1 })}"${q.evaluationType !== "auto" ? ' data-status="unscored"' : ""}>${i + 1}</button></li>`).join("");
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) go(Number(b.dataset.go), true);
  });
  view.querySelector("[data-finish]").addEventListener("click", confirmFinish);
  bindCalculatorButton(view.querySelector("[data-calc]"));      // mock test kalkulyatori (faqat brauzerda, holatga ta'sirsiz)
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
    ? `<span class="of-badge">${t("att.t.openUnscored", "Variantsiz · ballga kirmaydi")}</span>`
    : q.evaluationType === "unreliable" ? `<span class="of-badge of-badge--orange">${t("att.t.v.unscored", "Ballga kirmaydi")}</span>` : "";
  card.innerHTML = `
    <div class="att-q__head">
      <span class="att-q__num" id="attQNum">${current + 1} / ${n}</span>
      <span class="of-badge of-badge--blue">${esc(q.topic)}</span>
      ${evalNote}
    </div>
    <div class="att-q__body" data-qbody></div>
    <div data-opts></div>
    <div class="att-q__nav">
      <button type="button" class="of-btn" data-prev ${current === 0 ? "disabled" : ""}>${ic("chevronLeft")}${t("att.t.prev", "Oldingi")}</button>
      ${answers[q.id] ? `<button type="button" class="of-btn of-btn--ghost" data-clear>${t("att.t.clear", "Javobni bekor qilish")}</button>` : ""}
      ${current < n - 1
        ? `<button type="button" class="of-btn of-btn--primary" data-next>${t("att.t.next", "Keyingi")}${ic("chevronRight")}</button>`
        : `<button type="button" class="of-btn of-btn--success" data-finish2>${ic("flag")}${t("att.t.finishShort", "Yakunlash")}</button>`}
    </div>`;
  card.querySelector("[data-qbody]").append(renderBlocks(q.question, { testId: test.id, scope: "question" }));
  const optsBox = card.querySelector("[data-opts]");
  if (!q.optionCount) {
    optsBox.innerHTML = `<p class="att-open-note">${t("att.t.openNote", "Bu savol variantsiz (ochiq). Javobingizni daftarga yozib qo‘ying — bosqichma-bosqich yechimi ertaga «Yechimlar» bo‘limida ochiladi.")}</p>`;
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
  bar.setAttribute("aria-valuetext", t("att.t.barValue", "{a} / {n} savolga javob berilgan", { a: answered, n: answerable }));
  view.querySelectorAll("[data-go]").forEach((b) => {
    const q = qs[Number(b.dataset.go)];
    b.dataset.answered = String(Boolean(answers[q.id]));
    if (Number(b.dataset.go) === current) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    b.setAttribute("aria-label", t("att.t.qState", "{n}-savol: {s}", { n: Number(b.dataset.go) + 1, s: answers[q.id] ? t("att.t.answerIs", "javob {a}", { a: answers[q.id] }) : q.optionCount ? t("att.t.unansLower", "javobsiz") : t("att.t.noOptsLower", "variantsiz") }));
  });
  view.querySelector("[data-sum-answered]").textContent = t("att.t.sumAnswered", "Javob berilgan: {n}", { n: answered });
  view.querySelector("[data-sum-left]").textContent = t("att.t.sumLeft", "Javobsiz: {n}", { n: answerable - answered });
}

function confirmFinish() {
  const qs = snapshot.questions;
  const answerable = qs.filter((q) => q.optionCount);
  const left = answerable.filter((q) => !answers[q.id]).length;
  openModal({
    title: t("att.t.confirmTitle", "Testni yakunlashni xohlaysizmi?"),
    text: t("att.t.confirmText", "Javoblaringiz tekshiriladi va natija darhol ko‘rsatiladi. Rasmiy urinish bitta — yakunlagandan keyin javoblarni o‘zgartirib bo‘lmaydi.{left}", { left: left ? t("att.t.confirmLeft", " Javob berilmagan savollar: {n} ta.", { n: left }) : "" }),
    iconName: "flag",
    actions: [
      { label: t("att.t.confirmYes", "Ha, yakunlash"), variant: "success", onClick: (_e, m) => { m.close(); finish(); } },
      { label: t("att.t.confirmNo", "Davom etish"), onClick: (_e, m) => m.close() },
    ],
  });
}

async function finish() {
  clearTimeout(saveTimer);
  stopClock();
  show(stateHtml("check", t("att.t.grading", "Javoblar tekshirilmoqda…"), t("att.t.pleaseWait", "Iltimos, kuting.")));
  try {
    attempt = await submitAttempt(uid, test.id, answers);
    clearLocalDraft();
    const { attempt: graded, key } = await gradeAttempt(attempt);
    attempt = graded;
    renderResult(key);
    toast(t("att.t.done", "Test yakunlandi. Natija saqlandi."));
  } catch (e) {
    // Yechim vaqti kelib qolgan bo'lsa qo'lda SUBMIT rad etiladi — urinish oxirgi saqlangan javoblar bilan avtomatik yakunlanadi
    if (e?.code === "permission-denied") {
      try {
        const r = await finalizeIfOverdue(await getMyAttempt(uid, test.id), test, Date.now(), { serverDecides: true });
        if (r.attempt?.status === "graded") {
          attempt = r.attempt;
          clearLocalDraft();
          renderResult(r.key || await getKey(test.id, attemptVersion(attempt)).catch(() => null));
          toast(t("att.t.autoDone", "Yechim vaqti keldi — test oxirgi saqlangan javoblar bilan avtomatik yakunlandi."));
          return;
        }
      } catch (e2) { console.warn("[att] avtomatik yakunlash:", e2?.code || e2); }
    }
    console.error("[att] submit/grade:", e);
    show(stateHtml("alert", t("att.t.saveFail", "Natijani saqlab bo‘lmadi"), `${errorMessage(e)} ${t("att.t.savedOnDevice", "Javoblaringiz shu qurilmada saqlangan.")}`,
      `<button type="button" class="of-btn of-btn--primary" data-retry>${t("att.t.retry", "Qayta urinish")}</button>`));
    view.querySelector("[data-retry]").addEventListener("click", () => location.reload());
  }
}

// ------------------------------------------------------------------ natija + javoblarni ko'rib chiqish
// Ma'lumot: savollar — urinish topshirilgan versiya snapshot'i (versions/v{testVersion}); javoblar — urinishning o'zi;
// to'g'ri javob — keys/v{testVersion} (Rules faqat submit'dan keyin beradi); holat/ball — urinishda saqlangan (qayta
// hisoblanmaydi). To'liq yechim bu yerda so'ralmaydi — faqat qulf va ochilish vaqti (yechim sahifasida, Rules bilan).
const VERDICT = {
  correct: ["checkCircle", t("att.t.v.correct", "To‘g‘ri")],
  wrong: ["xCircle", t("att.t.v.wrong", "Noto‘g‘ri")],
  unanswered: ["circle", t("att.t.v.unanswered", "Siz javob bermadingiz")],
  unscored: ["minusCircle", t("att.t.v.unscored", "Ballga kirmaydi")],
};
const FILTERS = [["all", t("att.t.f.all", "Hammasi")], ["wrong", t("att.t.v.wrong", "Noto‘g‘ri")], ["unanswered", t("att.t.f.unanswered", "Javobsiz")], ["correct", t("att.t.v.correct", "To‘g‘ri")]];

/** Eski sxemalar: javoblar `answers` yoki `selectedAnswers` da bo'lishi mumkin. */
function attemptAnswers(a) {
  return a.answers || a.selectedAnswers || {};
}
function attemptVersion(a) {
  return a.testVersion || test.currentVersion || 1;
}

let reviewObserver = null;
function lazyCard(el, render) {
  if (!("IntersectionObserver" in window)) return render();
  if (!reviewObserver) {
    reviewObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { reviewObserver.unobserve(e.target); e.target._render?.(); }
      }
    }, { rootMargin: "600px 0px" });
  }
  el._render = render;
  reviewObserver.observe(el);
}

async function renderResult(key) {
  const version = attemptVersion(attempt);
  if (!snapshot || snapshot.version !== version) snapshot = await getSnapshot(test.id, version);
  await loadKatex().catch(() => {});
  const a = attempt;
  const ans = attemptAnswers(a);
  const g = a.status === "graded" ? a : { ...a, ...gradeAnswers(ans, key, a.questionCount) };
  const mock = isMock(test);
  const solOpen = solutionOpenFor(test, a);
  const solAt = esc(formatTashkent(test.solutionAvailableAt));
  const unscored = snapshot.questions.filter((q) => q.evaluationType !== "auto").length;
  const statuses = snapshot.questions.map((q) => questionStatus(q.id, q.evaluationType, ans, g));
  const count = (st) => statuses.filter((x) => x === st).length;
  setTitle(t("att.t.resultTitle", "{day} — natija", { day: dayLabel(test) }));
  show(`
    <section class="of-card att-result" aria-labelledby="attResTitle">
      <div class="att-result__score">
        <div class="att-ring" style="--p:${g.scorePercent}" role="img" aria-label="${mock ? t("att.t.ringAriaMock", "Natija {p} ball, {m} balldan", { p: mockPoints(g.correctAnswers, test), m: mockMax(test) }) : t("att.t.ringAria", "Natija {p} foiz", { p: precisePercent(g.correctAnswers, g.scorableQuestions) })}">
          <div class="att-ring__inner"><div><b>${mock ? mockPoints(g.correctAnswers, test) : `${precisePercent(g.correctAnswers, g.scorableQuestions)}%`}</b><br><span>${mock ? t("att.t.unitPoints", "ball") : t("att.t.unitResult", "natija")}</span></div></div>
        </div>
        <div>
          <p class="att-eyebrow">${t("att.t.resultEyebrow", "Natija · {day}", { day: esc(dayLabel(test)) })}</p>
          <h1 id="attResTitle" class="att-result__big of-num">${mock ? mockPoints(g.correctAnswers, test) : g.correctAnswers} <small>/ ${mock ? t("att.t.pointsN", "{n} ball", { n: mockMax(test) }) : g.scorableQuestions}</small></h1>
          <p class="of-subtle">${mock ? t("att.t.mockSummary", "{c} / {s} to‘g‘ri · har bir to‘g‘ri javob {p} ball", { c: g.correctAnswers, s: g.scorableQuestions, p: test.pointsPerQuestion || 2 }) : `${esc(test.sectionTitle)} · ${esc(test.topics.join(", "))}`}</p>
        </div>
      </div>
      <div class="att-counts">
        <div class="att-count att-count--ok"><span>${ic("checkCircle")}${t("att.t.v.correct", "To‘g‘ri")}</span><b class="of-num">${g.correctAnswers}</b></div>
        <div class="att-count att-count--bad"><span>${ic("xCircle")}${t("att.t.v.wrong", "Noto‘g‘ri")}</span><b class="of-num">${g.wrongAnswers}</b></div>
        <div class="att-count att-count--skip"><span>${ic("circle")}${t("att.t.f.unanswered", "Javobsiz")}</span><b class="of-num">${g.unanswered}</b></div>
      </div>
      <div class="att-result__meta">
        <span>${ic("clock")}${t("att.t.spent", "Sarflangan vaqt: <b>{d}</b>", { d: esc(formatDuration(g.timeSpentSeconds)) })}</span>
        <span>${ic("calendar")}${t("att.t.submittedAt", "Topshirilgan: {at}", { at: esc(formatTashkent(a.completedAt)) })}</span>
        ${unscored ? `<span>${ic("info")}${t("att.t.unscoredMeta", "{n} ta savol (variantsiz/noaniq) ballga kiritilmadi", { n: unscored })}</span>` : ""}
      </div>
    </section>
    ${solOpen
      ? `<p class="att-lock-note">${ic("unlock")}<span>${t("att.t.solOpen", "To‘liq bosqichma-bosqich yechimlar ochiq. <a href=\"{href}\">Yechimlarni ko‘rish</a>", { href: `fizika-yechimlar.html?day=${test.dayNumber}` })}</span></p>`
      : `<p class="att-lock-note">${ic("lock")}<span>${t("att.t.solLocked", "Javoblaringiz va to‘g‘ri javoblar hozir ochiq. To‘liq yechimlar <b>{at}</b> da (Toshkent vaqti) ochiladi.", { at: solAt })}</span></p>`}
    <section aria-labelledby="attRevTitle" class="att att-review-wrap">
      <div class="of-section-title att-review-head">
        <h2 id="attRevTitle">${t("att.t.review", "Javoblarni ko‘rib chiqish")}</h2>
        <div class="att-filter" role="group" aria-label="${t("att.t.filterAria", "Savollarni saralash")}">
          ${FILTERS.map(([f, label], i) => `<button type="button" class="of-btn of-btn--sm ${i ? "of-btn--ghost" : "of-btn--soft"}" data-filter="${f}" aria-pressed="${i ? "false" : "true"}">${label}${f === "all" ? "" : ` <span class="of-num">${count(f)}</span>`}</button>`).join("")}
        </div>
      </div>
      <ol class="att-review" data-review></ol>
    </section>
    <div class="of-row" style="flex-wrap:wrap">
      <a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">${t("att.t.dashboard", "Dashboard")}</a>
      <a class="of-btn" href="fizika-natijalar.html">${t("att.t.resultsStats", "Natijalar va statistika")}</a>
    </div>`);
  const list = view.querySelector("[data-review]");
  snapshot.questions.forEach((q, i) => {
    const st = statuses[i];
    const [icn, label] = VERDICT[st];
    const mine = ans[q.id] || null;
    // Kalit bo'lmasa (eski urinish): to'g'ri belgilangan savolda to'g'ri javob — foydalanuvchining o'z javobi
    const correctKey = key?.answers?.[q.id] || (st === "correct" ? mine : null);
    const li = document.createElement("li");
    li.dataset.status = st;
    li.innerHTML = `
      <article class="of-card att-rev" data-status="${st}" data-qid="${esc(q.id)}" aria-labelledby="rev${i}">
        <header class="att-rev__head">
          <b class="att-rev__num of-num" id="rev${i}">${t("att.t.qN", "{n}-savol", { n: i + 1 })}</b>
          <span class="of-badge of-badge--blue">${esc(q.topic)}</span>
          <span class="att-rev__verdict">${ic(icn)}${label}</span>
        </header>
        <div class="att-rev__body" data-body><span class="of-skeleton of-skeleton--text"></span></div>
        <footer class="att-rev__foot">
          <span class="att-rev__answers">
            ${q.optionCount
              ? (mine ? `<span>${t("att.t.yourAnswer", "Sizning javobingiz: <b>{a}</b>", { a: esc(mine) })}</span>` : `<span>${t("att.t.v.unanswered", "Siz javob bermadingiz")}</span>`)
              : `<span>${t("att.t.noOptQ", "Variantsiz savol")}</span>`}
            ${correctKey ? `<span>${t("att.t.correctAnswer", "To‘g‘ri javob: <b>{a}</b>", { a: esc(correctKey) })}</span>`
              : (st === "unscored" ? `<span>${t("att.t.unscoredChecking", "Bu savol ballga kirmaydi — javob kaliti tekshirilmoqda")}</span>`
                : (!key && q.optionCount ? `<span>${t("att.t.oldNoKey", "To‘g‘ri javob ma’lumoti bu eski natijada mavjud emas")}</span>` : ""))}
          </span>
          ${solOpen
            ? `<a class="att-rev__sol" href="fizika-yechimlar.html?day=${test.dayNumber}#sol-${encodeURIComponent(q.id)}">${ic("book")}${t("att.t.fullSolution", "To‘liq yechim")}</a>`
            : `<span class="att-rev__sol att-rev__sol--locked">${ic("lock")}${t("att.t.fullSolutionAt", "To‘liq yechim · {at} da ochiladi", { at: solAt })}</span>`}
        </footer>
      </article>`;
    const card = li.querySelector("article");
    lazyCard(card, () => {
      const body = card.querySelector("[data-body]");
      body.textContent = "";
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
          else if (o.key === mine) d.dataset.review = "wrong";
          if (o.key === mine) d.dataset.mine = "1";
          const k = document.createElement("span");
          k.className = "att-opt__key";
          k.textContent = o.key;
          const c = document.createElement("span");
          c.className = "att-opt__content";
          c.append(renderBlocks(o.blocks, { testId: test.id, scope: "question" }));
          d.append(k, c);
          if (o.key === mine || o.key === correctKey) {
            const tag = document.createElement("span");
            tag.className = "att-opt__tag";
            tag.textContent = o.key === mine && o.key === correctKey ? t("att.t.tagMineCorrect", "Sizning javobingiz · to‘g‘ri")
              : o.key === mine ? t("att.t.tagMine", "Sizning javobingiz") : t("att.t.tagCorrect", "To‘g‘ri javob");
            d.append(tag);
          }
          liO.append(d);
          ul.append(liO);
        });
        body.append(ul);
      }
      fillIcons(body);
    });
    list.append(li);
  });
  fillIcons(view);
  view.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.filter;
    view.querySelectorAll("[data-filter]").forEach((x) => {
      const on = x === b;
      x.setAttribute("aria-pressed", String(on));
      x.classList.toggle("of-btn--soft", on);
      x.classList.toggle("of-btn--ghost", !on);
    });
    list.querySelectorAll(":scope > li").forEach((li) => { li.hidden = f !== "all" && li.dataset.status !== f; });
  }));
}

// ------------------------------------------------------------------ yuklash
(async () => {
  const s = await whenUser();
  uid = s.user.uid;
  if (!Number.isInteger(day) || day < 1) {
    show(stateHtml("alert", t("att.t.noDay", "Kun ko‘rsatilmagan"), t("att.t.pickDay", "Dashboard’dan kerakli kunni tanlang."), `<a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">${t("att.t.dashboard", "Dashboard")}</a>`));
    return;
  }
  setTitle(`${dayLabelOf(day)} — ${day >= 101 ? t("att.t.mockLower", "mock test") : t("att.t.dailyLower", "kunlik test")}`);
  try {
    const [tests, access, skew] = await Promise.all([listVisibleTests(), loadAccessContext(uid), serverSkewMs()]);
    skewMs = skew;
    test = tests.find((t) => t.dayNumber === day) || null;
    if (!test) {
      show(stateHtml("lock", t("att.t.notPublished", "{day} hali e’lon qilinmagan", { day: dayLabelOf(day) }), t("att.t.notPublishedText", "Test administrator e’lon qilgandan keyin shu yerda ochiladi."), `<a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">${t("att.t.dashboard", "Dashboard")}</a>`));
      return;
    }
    attempt = await getMyAttempt(uid, test.id);
    // Day 4+ ruxsatsiz: start ekrani ko'rsatilmaydi, urinish yaratilmaydi (Rules ham rad etadi). O'z urinishi bo'lsa — tarix.
    if (!attempt && !dayOpen(test, access)) {
      show(stateHtml("lock", `${dayLabelOf(day)}: ${ACCESS_TITLE.toLowerCase()}`, esc(accessText(test)),
        `<div class="of-row" style="justify-content:center;flex-wrap:wrap"><a class="of-btn of-btn--primary" href="${COURSE_URL}" target="_blank" rel="noopener noreferrer">📲 ${t("att.t.enroll", "Kursga yozilish")}</a><a class="of-btn" href="fizikaattestatsiya.html">${t("att.t.dashboard", "Dashboard")}</a></div>`));
      return;
    }
    // Yechim vaqti kelgan, lekin yakunlanmagan rasmiy urinish — oxirgi saqlangan javoblar bilan avtomatik yakunlanadi
    if (isOverdue(attempt, test, nowMs())) {
      attempt = (await finalizeIfOverdue(attempt, test, nowMs()).catch((e) => { console.warn("[att] avtomatik yakunlash:", e?.code || e); return { attempt }; })).attempt;
    }
    if (attempt?.status === "graded") {
      // Eski sxemadagi urinish (testVersion yo'q) uchun Rules kalitni bermaydi — review saqlangan natija bilan chiziladi
      const key = await getKey(test.id, attemptVersion(attempt)).catch((e) => { console.warn("[att] kalit:", e?.code || e); return null; });
      return renderResult(key);
    }
    if (attempt?.status === "submitted") {
      const r = await gradeAttempt(attempt);
      attempt = r.attempt;
      return renderResult(r.key);
    }
    // Vaqt chegarasi (mock: 2 soat) tugagan, lekin hali topshirilmagan (avto-yakunlash grace'i ichida): saqlangan javoblar bilan topshiriladi
    if (attempt?.status === "in_progress" && timeLimitOf(test) && remainingSeconds(attempt, test, nowMs()) === 0) {
      await openRunner();
      return;
    }
    if (!officialOpen(test)) {
      const solLink = solutionOpenFor(test, attempt) ? `<a class="of-btn of-btn--primary" href="fizika-yechimlar.html?day=${day}">${t("att.t.viewSolutions", "Yechimlarni ko‘rish")}</a>` : "";
      show(stateHtml("lock", t("att.t.closed", "{day}: rasmiy muddat tugagan", { day: dayLabelOf(day) }),
        attempt ? t("att.t.closedNoSubmit", "Bu testni topshirmagansiz — rasmiy natija saqlanmadi.") : t("att.t.closedText", "Bu kunning rasmiy testi yopilgan. To‘liq yechimlar bilan tanishishingiz mumkin."),
        `<div class="of-row" style="justify-content:center;flex-wrap:wrap">${solLink}<a class="of-btn" href="fizikaattestatsiya.html">${t("att.t.dashboard", "Dashboard")}</a></div>`));
      return;
    }
    renderIntro();
  } catch (e) {
    console.error("[att] test:", e);
    show(stateHtml("alert", t("att.t.loadFail", "Testni yuklab bo‘lmadi"), errorMessage(e), `<a class="of-btn of-btn--primary" href="fizikaattestatsiya.html">${t("att.t.dashboard", "Dashboard")}</a>`));
  }
})();
