// OliyFizika.uz — umumiy Mock test engine.
// Barcha testlar shu bitta kod orqali ishlaydi; savollar data/*.json fayllaridan olinadi.
// Sahifa: test.html?id=mock-test-1
import { SITE, CATALOG_URL } from "./config.js";
import { $, $$, h, clear, toast, confirmDialog, authorFooter } from "./dom.js";
import { loadState, saveState, clearState } from "./storage.js";
import { createTimer } from "./timer.js";
import { initCalculator } from "./calculator.js";
import { initFormulaSheet } from "./formula.js";
import { sanitizeNumInput, isAnswered, isPartial, itemCount, countFilledItems } from "./scoring.js";
import { submitAttempt, isLocalMode, ATTEMPT_STATUS } from "./attempt-service.js";
import { gradeLocal } from "./scoring.js";
import { recordAttempt } from "./attempt-record.js";
import { renderResult, renderPending, renderSessionPending, renderSessionResult } from "./result.js";
import * as ss from "./session-service.js";
import { checkMockAccess } from "./access-gate.js";
import { goToLogin } from "./session.js";
import { initTheme } from "./theme.js";
import { fetchOverlay, applyOverlay } from "./i18n-content.js";
import { t } from "../../../assets/js/core/i18n.js";

const BASE_URL = new URL("../", import.meta.url); // mock-testlar/ papkasi
const resolveUrl = (path) => new URL(path, BASE_URL).href;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let test = null;
let state = null;
let session = null; // { uid, name, email } — saytdagi akkaunt
let timer = null;
let calculator = null;
let navButtons = [];
// Rejim: { kind: "practice" } — erkin mashq (eski oqim, natija darhol);
//        { kind: "session", session, attempt } — admin ochgan rasmiy sessiya (natija Rasch bo'yicha keyinroq).
let mode = { kind: "practice" };
let storeId = null; // localStorage kaliti: mashqda test.id, sessiyada "session-<id>"
const isSession = () => mode.kind === "session";

const screens = ["#loadingScreen", "#messageScreen", "#startScreen", "#examScreen", "#resultScreen"];
function show(id) {
  screens.forEach((s) => { $(s).hidden = s !== id; });
  $("#tools").hidden = id !== "#examScreen";
  document.body.classList.toggle("in-exam", id === "#examScreen");
}

function showMessage(title, text, actions = []) {
  clear($("#messageScreen")).append(
    h("div", { class: "card glass message-card" }, h("h2", {}, title), h("p", {}, text), h("div", { class: "result-actions" }, actions)));
  show("#messageScreen");
}

/* ---------------- Yuklash ---------------- */

async function loadTest(id) {
  const catalog = await fetch(resolveUrl(CATALOG_URL), { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`Katalog yuklanmadi (${r.status})`);
    return r.json();
  });
  const entry = catalog.tests.find((t) => t.id === id); // faqat katalogdagi fayllarga ruxsat
  if (!entry) return null;
  const res = await fetch(resolveUrl(entry.file), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Test fayli yuklanmadi (${res.status})`);
  const data = await res.json();
  validateTest(data);
  return applyOverlay(data, await fetchOverlay(entry.file));
}

function validateTest(t) {
  if (!t || !Array.isArray(t.questions) || !t.questions.length) throw new Error("Test ma’lumotida savollar yo‘q");
  t.questions.forEach((q, i) => {
    if (q.type === "mcq" && !(Array.isArray(q.options) && q.options.length)) throw new Error(`${i + 1}-savolda variantlar yo‘q`);
    if (q.type === "open2" && !(Array.isArray(q.parts) && q.parts.length)) throw new Error(`${i + 1}-savolda qismlar yo‘q`);
    if (!["mcq", "open2"].includes(q.type)) throw new Error(`${i + 1}-savol turi noma’lum: ${q.type}`);
  });
}

const newAttemptId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`);
function persist() {
  saveState(storeId, session.uid, state);
  if (isSession() && state && !state.submitted) scheduleDraft();
}

/* ---------------- Sessiya: javoblarni Firestore'ga qoralama sifatida saqlash ---------------- */

let draftTimer = null;
let draftSig = "";
function scheduleDraft(delay = 15000) {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(flushDraft, delay);
}
async function flushDraft() {
  clearTimeout(draftTimer);
  if (!isSession() || !state || state.submitted) return;
  const answers = ss.cleanAnswers(test, state.answers);
  const sig = JSON.stringify(answers) + "|" + (state.focusLoss || 0);
  if (sig === draftSig) return;
  try {
    await ss.saveDraft(mode.session.id, session.uid, answers, { focusLoss: state.focusLoss || 0 });
    draftSig = sig;
  } catch (error) {
    console.warn("[ms] qoralamani saqlab bo‘lmadi:", error?.code || error);
  }
}

const fmtDate = (ms) => ss.fmtTashkent(ms);

/* ---------------- Boshlash ekrani ---------------- */

function renderStart(saved) {
  const total = test.questions.length;
  const mcq = test.questions.filter((q) => q.type === "mcq").length;
  const bands = itemCount(test.questions);

  const chip = (b, s) => h("div", { class: "info-chip" }, h("b", {}, b), h("span", {}, s));
  const buttons = [];
  if (isSession() && saved && !saved.submitted) {
    buttons.push(h("button", { type: "button", class: "btn btn-primary btn-big", onclick: () => resume() }, t("ms.e.resume", "▶ Saqlangan testni davom ettirish")));
  } else if (isSession()) {
    buttons.push(h("button", { type: "button", class: "btn btn-primary btn-big", onclick: () => startSessionAttempt() }, t("ms.e.begin", "TESTNI BOSHLASH")));
  } else if (saved && !saved.submitted) {
    buttons.push(
      h("button", { type: "button", class: "btn btn-primary btn-big", onclick: () => resume() }, t("ms.e.resume", "▶ Saqlangan testni davom ettirish")),
      h("button", { type: "button", class: "btn btn-danger-ghost btn-big", onclick: async () => {
        if (await confirmDialog({ title: t("ms.e.deleteTitle", "Saqlangan test o‘chirilsinmi?"), message: t("ms.e.deleteMsg", "Kiritilgan barcha javoblar va vaqt o‘chiriladi."), confirmText: t("ms.e.deleteOk", "O‘chirish"), danger: true })) {
          clearState(test.id, session.uid);
          renderStart(null);
        }
      } }, t("ms.e.deleteSaved", "Saqlangan testni o‘chirish")));
  } else {
    buttons.push(h("button", { type: "button", class: "btn btn-primary btn-big", onclick: () => startNew() }, t("ms.e.begin", "TESTNI BOSHLASH")));
  }

  clear($("#startScreen")).append(
    h("section", { class: "start-card glass" },
      h("div", { class: "hero" },
        h("span", { class: "eyebrow" }, t("ms.e.eyebrow", "OLIYFIZIKA.UZ • MILLIY SERTIFIKAT")),
        h("h1", {}, test.title),
        h("p", {}, test.subtitle || "")),
      h("div", { class: "start-body" },
        h("div", { class: "info-grid" },
          chip(String(total), t("ms.e.tasks", "topshiriq")),
          chip(String(bands), t("ms.e.bands", "baholanadigan band")),
          chip(t("ms.e.min", `${test.durationMinutes} min`, { n: test.durationMinutes }), t("ms.e.totalTime", "umumiy vaqt")),
          chip(`${mcq} + ${total - mcq}`, t("ms.e.kinds", "test + ochiq savol"))),
        h("div", { class: "participant" },
          h("span", { class: "participant__avatar", "aria-hidden": "true" }, (session.name || "?").trim().charAt(0).toUpperCase()),
          h("div", {},
            h("span", { class: "participant__label" }, t("ms.e.participant", "Ishtirokchi")),
            h("b", { class: "participant__name", id: "participantName" }, session.name),
            session.email && session.email !== session.name ? h("span", { class: "participant__email" }, session.email) : null)),
        isSession() ? h("div", { class: "notice session-notice" },
          h("b", {}, "Rasmiy sessiya. "),
          `Test ${fmtDate(ss.toMs(mode.session.closesAt))} gacha ochiq; boshlaganingizdan keyin ${mode.session.durationMinutes} daqiqa vaqt beriladi. `,
          "Faqat bitta urinish. Natija darhol ko‘rsatilmaydi: barcha ishtirokchilar javoblari asosida Rasch modeli bo‘yicha hisoblanib, admin yakunlagandan so‘ng e’lon qilinadi. Javoblaringiz serverda ham saqlanib boradi.") : null,
        h("div", { class: "rules" },
          h("b", {}, t("ms.e.noteLabel", "Eslatma: ")),
          t("ms.e.note1", "test boshlanganidan keyin vaqt to‘xtamaydi. Javoblar qurilmada avtomatik saqlanadi. Ochiq savollarning "),
          h("b", {}, "a"), t("ms.e.note2", " va "), h("b", {}, "b"),
          isSession() ? " qismlari alohida baholanadi. 33–35-topshiriqlarda A–F javoblar orasidan moslashtirish amalga oshiriladi." : t("ms.e.note3", " qismlari alohida baholanadi. 33–35-topshiriqlarda A–F javoblar orasidan moslashtirish amalga oshiriladi. Yakunda Rasch balli hisoblanmaydi — tahlil uchun natija kodi beriladi.")),
        saved && !saved.submitted ? h("p", { class: "notice" }, t("ms.e.savedNotice", `Saqlangan urinish. Javob berilgan: ${countFilledItems(test.questions, saved.answers || {})} / ${bands} band.`, { a: countFilledItems(test.questions, saved.answers || {}), b: bands })) : null,
        h("div", { class: "start-actions" }, buttons))));
  show("#startScreen");
}

function startNew() {
  // Ism so'ralmaydi: saytda ro'yxatdan o'tgan nom (users/{uid}.fullName) olinadi.
  const now = Date.now();
  state = {
    schemaVersion: 1, testId: test.id, attemptId: newAttemptId(), status: ATTEMPT_STATUS.IN_PROGRESS,
    uid: session.uid, name: session.name, email: session.email, startTs: now, deadlineTs: now + test.durationMinutes * 60 * 1000, endTs: null,
    current: 0, answers: {}, marked: {}, focusLoss: 0, submitted: false, autoSubmitted: false,
  };
  persist();
  enterExam();
}

function resume() {
  state.name = session.name; // profildagi ism yangilangan bo'lsa
  if (Date.now() >= state.deadlineTs) { submit(true); return; }
  enterExam();
}

/** Sessiya: START (server vaqti) — urinish hujjati yaratiladi, vaqt startedAt dan hisoblanadi. */
async function startSessionAttempt() {
  let attempt;
  try {
    attempt = await ss.startAttempt(mode.session, session);
  } catch (error) {
    console.error("[ms] sessiyani boshlab bo‘lmadi:", error);
    showMessage("Testni boshlab bo‘lmadi", error?.code === "permission-denied"
      ? "Sessiya hozir ochiq emas (vaqti tugagan yoki hali boshlanmagan). Sahifani yangilang."
      : "Internet aloqasini tekshirib, qayta urinib ko‘ring.", [h("a", { class: "btn btn-primary", href: "./" }, "← Testlar ro‘yxati")]);
    return;
  }
  mode.attempt = attempt;
  state = sessionState(attempt, null);
  persist();
  enterExam();
}

/** Firestore urinishi (+ qurilmadagi nusxa) → engine holati. Javoblar: qurilmadagi yangiroq bo'lsa o'sha. */
function sessionState(attempt, saved) {
  const startTs = ss.toMs(attempt.startedAt) || Date.now();
  const deadlineTs = startTs + mode.session.durationMinutes * 60 * 1000;
  const local = saved && saved.attemptId === attempt.id ? saved : null;
  return {
    schemaVersion: 1, testId: test.id, sessionId: mode.session.id, attemptId: attempt.id,
    status: attempt.status === "in_progress" ? ATTEMPT_STATUS.IN_PROGRESS : ATTEMPT_STATUS.SUBMITTED,
    uid: session.uid, name: session.name, email: session.email, startTs, deadlineTs,
    endTs: local?.endTs || ss.toMs(attempt.submittedAt) || null,
    current: local?.current || 0,
    answers: local?.answers || ss.restoreAnswers(attempt.answers),
    marked: local?.marked || {}, focusLoss: Math.max(local?.focusLoss || 0, attempt.focusLoss || 0),
    submitted: attempt.status !== "in_progress", autoSubmitted: !!attempt.autoSubmitted, recorded: true,
  };
}

/* ---------------- Imtihon ekrani ---------------- */

function enterExam() {
  buildNav();
  show("#examScreen");
  renderQuestion();
  timer?.stop();
  timer = createTimer({
    element: $("#timer"),
    getEndTs: () => state.deadlineTs,
    onWarn: () => toast(t("ms.e.warn", "Diqqat: 10 daqiqadan kam vaqt qoldi")),
    onExpire: () => submit(true),
  });
  timer.start();
}

function buildNav() {
  const grid = clear($("#navgrid"));
  navButtons = test.questions.map((q, i) => {
    const b = h("button", { type: "button", class: "navbtn", "aria-label": t("ms.t.qAria", `${q.n}-savol`, { n: q.n }), onclick: () => { goTo(i); closeSide(); } }, String(q.n));
    grid.append(b);
    return b;
  });
  updateNav();
}

function updateNav() {
  test.questions.forEach((q, i) => {
    const b = navButtons[i];
    const a = state.answers[i];
    b.classList.toggle("answered", isAnswered(q, a));
    b.classList.toggle("partial", isPartial(q, a));
    b.classList.toggle("marked", !!state.marked[i]);
    b.classList.toggle("current", i === state.current);
    if (i === state.current) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
  const done = test.questions.filter((q, i) => isAnswered(q, state.answers[i])).length;
  $("#answerCount").textContent = `${done} / ${test.questions.length}`;
  $("#progress").style.width = `${(done / test.questions.length) * 100}%`;
}

function goTo(i) {
  if (i < 0 || i >= test.questions.length) return;
  state.current = i;
  persist();
  renderQuestion();
}

function move(d) {
  const n = state.current + d;
  if (n >= test.questions.length) confirmFinish();
  else goTo(n);
}

function renderQuestion() {
  const i = state.current;
  const q = test.questions[i];
  $("#qNumber").textContent = String(q.n);
  $("#qMeta").textContent = `${i + 1} / ${test.questions.length} • ${q.type === "mcq" ? t("ms.e.mcq", "Test savoli") : t("ms.e.open", "Ochiq savol")}`;
  $("#qTitle").textContent = test.title.toUpperCase();

  const box = clear($("#qContent"));
  if (q.note) box.append(h("div", { class: "shared-note" }, q.note));
  box.append(h("div", { class: "qtext" }, q.text));
  if (q.reaction) box.append(h("div", { class: "reaction" }, q.reaction));
  if (q.image) box.append(h("div", { class: "diagram-wrap" }, h("img", { src: resolveUrl(q.image), alt: t("ms.e.imgAlt", `${q.n}-savol rasmi`, { n: q.n }), decoding: "async" })));

  if (q.type === "mcq") renderOptions(box, q, i);
  else renderOpen(box, q, i);

  const markBtn = $("#markBtn");
  markBtn.classList.toggle("active", !!state.marked[i]);
  markBtn.textContent = state.marked[i] ? t("ms.t.marked", "★ Belgilangan") : t("ms.t.mark", "☆ Belgilash");
  markBtn.setAttribute("aria-pressed", String(!!state.marked[i]));
  $("#prevBtn").disabled = i === 0;
  $("#nextBtn").textContent = i === test.questions.length - 1 ? t("ms.t.finishArrow", "Yakunlash →") : t("ms.t.next", "Keyingi →");
  updateNav();
  $("#questionCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderOptions(box, q, i) {
  const list = h("div", { class: "options", role: "radiogroup", "aria-label": t("ms.e.options", "Javob variantlari") });
  const current = state.answers[i] || "";
  q.options.forEach((opt, k) => {
    const L = LETTERS[k];
    const selected = current === L;
    list.append(h("button", {
      type: "button", class: `option${selected ? " selected" : ""}`, role: "radio", "aria-checked": String(selected),
      onclick: () => { state.answers[i] = L; persist(); renderQuestion(); },
    }, h("span", { class: "letter" }, L), optionBody(opt)));
  });
  box.append(list);
  if (current) {
    box.append(h("button", { type: "button", class: "link-btn", onclick: () => { delete state.answers[i]; persist(); renderQuestion(); } }, t("ms.e.clear", "Tanlovni bekor qilish")));
  }
}

/** Variant: matn yoki rasm (+ ixtiyoriy izoh). */
function optionBody(opt) {
  if (typeof opt === "string") return h("span", { class: "optext" }, opt);
  return h("span", { class: "optext" },
    opt.image ? h("img", { class: "option-img", src: resolveUrl(opt.image), alt: opt.text || t("ms.e.optImgAlt", "Variant rasmi"), decoding: "async" }) : null,
    opt.image ? null : opt.text || "");
}

function renderOpen(box, q, i) {
  const hasNumeric = q.parts.some((p) => p.kind !== "text");
  const wrap = h("div", { class: "open-parts" },
    hasNumeric ? h("div", { class: "number-note" }, t("ms.e.numberNote", "⚠️ Son so‘ralgan joyga faqat son kiriting. Birlik avtomatik ko‘rsatiladi. O‘nli kasr: 1,5 yoki 1.5; juda kichik/katta son: 7e-27 yoki 7*10^-27.")) : null);
  q.parts.forEach((p) => {
    const id = `open-${p.key}`;
    const isText = p.kind === "text";
    const input = h("input", {
      id, type: "text", inputmode: isText || p.scientific ? "text" : "decimal", autocomplete: "off", spellcheck: "false",
      placeholder: p.hint || (isText ? t("ms.e.answerText", "Javobni yozing") : t("ms.e.answerNum", "Faqat son")), "aria-label": t("ms.e.partAria", `${p.key}) qism javobi`, { k: p.key }), value: state.answers[i]?.[p.key] ?? "",
      maxlength: "60",
    });
    input.addEventListener("input", () => {
      const v = isText ? input.value : sanitizeNumInput(input.value);
      if (v !== input.value) input.value = v;
      if (!state.answers[i] || typeof state.answers[i] !== "object") state.answers[i] = {};
      state.answers[i][p.key] = v;
      persist();
      updateNav();
    });
    wrap.append(h("div", { class: "part" },
      h("div", { class: "part-title" }, t("ms.e.part", `${p.key}) qism`, { k: p.key })),
      h("p", {}, p.text),
      h("div", { class: "answerbox" }, input, p.unit ? h("span", { class: "unit" }, p.unit) : null)));
  });
  box.append(wrap);
}

/* ---------------- Yakunlash ---------------- */

async function confirmFinish() {
  const total = itemCount(test.questions);
  const miss = total - countFilledItems(test.questions, state.answers);
  const marked = Object.values(state.marked).filter(Boolean).length;
  let message = miss ? t("ms.e.missing", `${miss} ta baholanadigan band javobsiz qolgan.`, { n: miss }) : t("ms.e.allDone", "Barcha bandlarga javob berilgan.");
  if (marked) message += t("ms.e.markedN", ` ${marked} ta savol belgilangan.`, { n: marked });
  message += t("ms.e.noChange", " Yakunlangandan so‘ng javoblarni o‘zgartirib bo‘lmaydi.");
  const ok = await confirmDialog({ title: t("ms.e.finishTitle", "Testni yakunlaysizmi?"), message, confirmText: t("ms.e.finishYes", "Ha, yakunlash"), danger: true });
  if (ok) submit(false);
}

async function submit(auto) {
  if (!state || state.submitted) return;
  timer?.stop();
  state.endTs = Math.min(Date.now(), state.deadlineTs || Date.now());
  state.autoSubmitted = !!auto;
  state.submitted = true;
  state.status = ATTEMPT_STATUS.SUBMITTED;
  persist();
  closeAllModals();
  if (isSession()) { submitSession(auto); return; }
  try {
    const res = await submitAttempt(test, state);
    state.status = res.status;
    persist();
    showFinal(res.grade);
    syncRecord(res.grade);
    if (auto) toast(t("ms.e.autoDone", "Vaqt tugadi — test avtomatik yakunlandi"));
  } catch (error) {
    console.error("Urinishni topshirishda xato:", error);
    state.submitted = false;
    state.status = ATTEMPT_STATUS.IN_PROGRESS;
    persist();
    showMessage(t("ms.e.sendFailTitle", "Javoblarni yuborib bo‘lmadi"), t("ms.e.sendFailText", "Internet aloqasini tekshirib, qayta urinib ko‘ring. Javoblaringiz qurilmada saqlangan."), [
      h("button", { type: "button", class: "btn btn-primary", onclick: () => submit(auto) }, t("ms.e.retry", "Qayta yuborish")),
    ]);
  }
}

/** Sessiya: javoblarni yuborish (natijasiz). Muddat o'tib ketgan bo'lsa — oxirgi saqlangan qoralama hisobga olinadi. */
async function submitSession(auto) {
  clearTimeout(draftTimer);
  try {
    await ss.submitAttempt(mode.session.id, session.uid, ss.cleanAnswers(test, state.answers), { autoSubmitted: auto, focusLoss: state.focusLoss });
  } catch (error) {
    if (error?.code === "permission-denied") {
      // Rules: muddat (startedAt + limit + 5 daqiqa) o'tgan yoki sessiya yakunlangan — serverdagi oxirgi qoralama baholanadi.
      console.warn("[ms] topshirish rad etildi (muddat o‘tgan):", error.code);
      state.lateSubmit = true;
    } else {
      console.error("[ms] javoblarni yuborib bo‘lmadi:", error);
      state.submitted = false;
      state.status = ATTEMPT_STATUS.IN_PROGRESS;
      persist();
      showMessage(t("ms.e.sendFailTitle", "Javoblarni yuborib bo‘lmadi"), t("ms.e.sendFailText", "Internet aloqasini tekshirib, qayta urinib ko‘ring. Javoblaringiz qurilmada saqlangan."), [
        h("button", { type: "button", class: "btn btn-primary", onclick: () => submit(auto) }, t("ms.e.retry", "Qayta yuborish")),
      ]);
      return;
    }
  }
  persist();
  showFinal(null);
  if (auto) toast(t("ms.e.autoDone", "Vaqt tugadi — test avtomatik yakunlandi"));
}

/** Admin statistikasi uchun yozuv (fon rejimida; natija ekranini kutmaydi). Muvaffaqiyatsiz bo'lsa keyingi ochilishda qayta. */
function syncRecord(grade) {
  if (isSession() || !state || !state.submitted || state.recorded || !isLocalMode()) return;
  const id = state.attemptId;
  recordAttempt(test, state, grade || gradeLocal(test, state.answers)).then((ok) => {
    if (ok && state && state.attemptId === id) { state.recorded = true; persist(); }
  });
}

function showFinal(grade) {
  const onNewAttempt = async () => {
    if (!practiceAllowed) { showClosed(h("a", { class: "btn btn-primary", href: "./" }, t("ms.e.backList", "← Testlar ro‘yxati")), false); return; }
    if (await confirmDialog({ title: t("ms.e.newTitle", "Yangi urinish"), message: t("ms.e.newMsg", "Joriy natija yopiladi va test boshidan boshlanadi."), confirmText: t("ms.e.newOk", "Yangi urinish") })) {
      clearState(test.id, session.uid);
      state = null;
      renderStart(null);
    }
  };
  const root = $("#resultScreen");
  if (isSession()) {
    const a = mode.attempt;
    if (a?.status === "published" && a.result) renderSessionResult(root, { test, state, attempt: a, session: mode.session, grade: gradeLocal(test, state.answers), resolveUrl });
    else renderSessionPending(root, { test, state, session: mode.session, late: !!state.lateSubmit });
    show("#resultScreen");
    return;
  }
  if (isLocalMode()) renderResult(root, { test, state, grade: grade || gradeLocal(test, state.answers), resolveUrl, onNewAttempt });
  else renderPending(root, { test, state, onNewAttempt });
  show("#resultScreen");
}

/* ---------------- Modallar va yordamchi UI ---------------- */

function openModal(id) {
  const m = $(`#${id}`);
  m.hidden = false;
  m.querySelector(".closebtn")?.focus();
}
function closeModal(id) { $(`#${id}`).hidden = true; }
function closeAllModals() { $$(".modal[data-static]").forEach((m) => { m.hidden = true; }); }
const anyModalOpen = () => $$(".modal").some((m) => !m.hidden);
function closeSide() { $("#side").classList.remove("open"); $("#sideBackdrop").hidden = true; }

function bindUi() {
  $("#prevBtn").addEventListener("click", () => move(-1));
  $("#nextBtn").addEventListener("click", () => move(1));
  $("#markBtn").addEventListener("click", () => { state.marked[state.current] = !state.marked[state.current]; persist(); renderQuestion(); });
  $("#finishBtn").addEventListener("click", confirmFinish);
  $("#formulaBtn").addEventListener("click", () => openModal("formulaModal"));
  $("#calcBtn").addEventListener("click", () => openModal("calcModal"));
  $("#mobileNavBtn").addEventListener("click", () => {
    const open = $("#side").classList.toggle("open");
    $("#sideBackdrop").hidden = !open;
  });
  $("#sideBackdrop").addEventListener("click", closeSide);
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.close)));
  $$(".modal[data-static]").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); }));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $$(".modal[data-static]").forEach((m) => { m.hidden = true; }); closeSide(); return; }
    if (!$("#calcModal").hidden && calculator?.handleKey(e)) return;
    if (!state || state.submitted || $("#examScreen").hidden || anyModalOpen()) return;
    if (e.target.matches("input, textarea")) return;
    if (e.key === "ArrowRight") move(1);
    if (e.key === "ArrowLeft") move(-1);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state && !state.submitted && !$("#examScreen").hidden) {
      state.focusLoss = (state.focusLoss || 0) + 1;
      persist();
      if (isSession()) flushDraft();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (state && !state.submitted && !$("#examScreen").hidden) { persist(); e.preventDefault(); e.returnValue = ""; }
  });
}

/* ---------------- Ishga tushirish ---------------- */

async function init() {
  initTheme($("#themeBtn"));
  $("#footerSlot").replaceWith(authorFooter(SITE));
  show("#loadingScreen");

  const id = new URLSearchParams(location.search).get("id") || "";
  const back = h("a", { class: "btn btn-primary", href: "./" }, t("ms.e.backList", "← Testlar ro‘yxati"));

  const access = await checkMockAccess();
  if (!access.allowed) {
    if (access.reason === "login") {
      showMessage(t("ms.e.loginTitle", "Saytga kiring"), t("ms.e.loginText", "Mock testni boshlash uchun OliyFizika.uz saytidagi akkauntingiz bilan kiring. Natijalar shu akkauntdagi ism bilan saqlanadi. Bosh sahifada “Kirish” tugmasini bosing — kirgandan so‘ng shu testga avtomatik qaytasiz."), [
        h("button", { type: "button", class: "btn btn-primary", onclick: () => goToLogin() }, t("ms.e.loginBtn", "Kirish / Ro‘yxatdan o‘tish")), back]);
      return;
    }
    const text = access.reason === "access" ? t("ms.e.accessDenied", "Bu bo‘lim uchun sizda ruxsat mavjud emas.") : t("ms.e.accessFail", "Ruxsatni tekshirib bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.");
    showMessage(t("ms.e.accessTitle", "Ruxsat talab qilinadi"), text, [back]);
    return;
  }
  session = access.session;

  try {
    test = await loadTest(id);
  } catch (error) {
    console.error("Testni yuklab bo‘lmadi:", error);
    showMessage(t("ms.e.loadFailTitle", "Testni yuklab bo‘lmadi"), t("ms.e.loadFailText", "Sahifani yangilab ko‘ring. Muammo takrorlansa, muallifga Telegram orqali xabar bering."), [back]);
    return;
  }
  if (!test) {
    showMessage(t("ms.e.notFoundTitle", "Test topilmadi"), t("ms.e.notFoundText", "Bunday mock test mavjud emas."), [back]);
    return;
  }

  document.title = `${test.title} | ${SITE.name}`;
  $("#brandTitle").textContent = test.title;
  initFormulaSheet($("#formulaBody"), test.formulaSheet, resolveUrl);
  calculator = initCalculator($("#calcBody"));
  bindUi();

  let resolved;
  try {
    resolved = await resolveMode(new URLSearchParams(location.search).get("session"));
  } catch (error) {
    console.error("[ms] test holatini aniqlab bo‘lmadi:", error);
    showMessage(t("ms.e.loadFailTitle", "Testni yuklab bo‘lmadi"), "Test holatini tekshirib bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.", [back]);
    return;
  }
  if (resolved === "session") { initSession(back); return; }

  storeId = test.id;
  practiceAllowed = resolved === "practice";
  const saved = loadState(test.id, session.uid);
  const hasSaved = saved && saved.testId === test.id && saved.attemptId;
  // Avval yechilgan mashq natijasi test yopiq bo'lsa ham ko'rinadi (eski natijalar saqlanadi).
  if (hasSaved && saved.submitted) { state = saved; showFinal(null); syncRecord(null); return; }
  if (resolved === "closed") { showClosed(back, hasSaved); return; }
  if (hasSaved) {
    state = saved;
    if (Date.now() >= saved.deadlineTs) { submit(true); return; }
    renderStart(saved);
    return;
  }
  renderStart(null);
}

/* ---------------- Yopiq rejim: sessiya / erkin mashq / yopiq ---------------- */

let upcoming = null;
let practiceAllowed = false; // erkin mashq rejimi (admin ochgan) — yangi urinish faqat shunda
/** "session" | "practice" | "closed". Sessiya: ochiq sessiya yoki foydalanuvchi qatnashgan sessiya. */
async function resolveMode(sessionParam) {
  const [settings, sessions] = await Promise.all([ss.getSettings(), ss.listSessions()]);
  const mine = sessions.filter((s) => s.testId === test.id);
  let chosen = sessionParam ? mine.find((s) => s.id === sessionParam) : null;
  if (!chosen) {
    const open = mine.find((s) => ss.sessionPhase(s) === "open");
    if (open) chosen = open;
  }
  if (!chosen) {
    // Ochiq sessiya yo'q: foydalanuvchi qatnashgan oxirgi sessiya (natijani ko'rish uchun)
    const sorted = mine.slice().sort((a, b) => ss.toMs(b.opensAt) - ss.toMs(a.opensAt));
    for (const s of sorted) {
      if (ss.sessionPhase(s) === "upcoming") continue;
      const a = await ss.getMyAttempt(s.id, session.uid);
      if (a) { chosen = s; mode = { kind: "session", session: s, attempt: a }; return "session"; }
    }
  }
  if (chosen) {
    mode = { kind: "session", session: chosen, attempt: await ss.getMyAttempt(chosen.id, session.uid) };
    return "session";
  }
  upcoming = ss.pickSession(mine.filter((s) => ss.sessionPhase(s) === "upcoming"), test.id);
  return (settings.practiceTests || []).includes(test.id) ? "practice" : "closed";
}

function showClosed(back, hasSaved) {
  const when = upcoming ? ` Keyingi sessiya: ${fmtDate(ss.toMs(upcoming.opensAt))} — ${fmtDate(ss.toMs(upcoming.closesAt))} (Toshkent vaqti).` : "";
  showMessage("Bu mock test hozircha yopiq",
    `Mock testlar admin belgilagan kunlarda ochiladi — hamma bir vaqtda yechadi va natijalar Rasch modeli asosida hisoblanadi.${when} E’lonlarni Telegram kanalimizda kuzatib boring: ${SITE.telegram}.${hasSaved ? " Avval boshlagan urinishingiz qurilmada saqlanib turibdi." : ""}`,
    [h("a", { class: "btn btn-ghost", href: SITE.telegramUrl, target: "_blank", rel: "noopener" }, "Telegram kanal"), back]);
}

function initSession(back) {
  storeId = `session-${mode.session.id}`;
  const a = mode.attempt;
  const phase = ss.sessionPhase(mode.session);
  const saved = loadState(storeId, session.uid);
  if (!a) {
    if (phase === "open") { renderStart(null); return; }
    if (phase === "upcoming") {
      showMessage("Sessiya hali boshlanmagan", `Bu mock test ${fmtDate(ss.toMs(mode.session.opensAt))} da ochiladi va ${fmtDate(ss.toMs(mode.session.closesAt))} gacha davom etadi (Toshkent vaqti).`, [back]);
      return;
    }
    showMessage("Sessiya yakunlangan", "Bu mock test sessiyasi tugagan. Keyingi sessiyalar haqida Telegram kanalimizda e’lon qilinadi.", [
      h("a", { class: "btn btn-ghost", href: SITE.telegramUrl, target: "_blank", rel: "noopener" }, "Telegram kanal"), back]);
    return;
  }
  state = sessionState(a, saved);
  draftSig = JSON.stringify(ss.cleanAnswers(test, state.answers)) + "|" + (state.focusLoss || 0);
  saveState(storeId, session.uid, state);
  if (a.status !== "in_progress" || mode.session.status === "finalized") { state.submitted = true; showFinal(null); return; }
  if (Date.now() >= state.deadlineTs) { submit(true); return; }
  renderStart(state);
}

init();
