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
import { renderResult, renderPending } from "./result.js";
import { checkMockAccess } from "./access-gate.js";
import { goToLogin } from "./session.js";
import { initTheme } from "./theme.js";

const BASE_URL = new URL("../", import.meta.url); // mock-testlar/ papkasi
const resolveUrl = (path) => new URL(path, BASE_URL).href;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let test = null;
let state = null;
let session = null; // { uid, name, email } — saytdagi akkaunt
let timer = null;
let calculator = null;
let navButtons = [];

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
  return data;
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
const persist = () => saveState(test.id, session.uid, state);

/* ---------------- Boshlash ekrani ---------------- */

function renderStart(saved) {
  const total = test.questions.length;
  const mcq = test.questions.filter((q) => q.type === "mcq").length;
  const bands = itemCount(test.questions);

  const chip = (b, s) => h("div", { class: "info-chip" }, h("b", {}, b), h("span", {}, s));
  const buttons = [];
  if (saved && !saved.submitted) {
    buttons.push(
      h("button", { type: "button", class: "btn btn-primary btn-big", onclick: () => resume() }, "▶ Saqlangan testni davom ettirish"),
      h("button", { type: "button", class: "btn btn-danger-ghost btn-big", onclick: async () => {
        if (await confirmDialog({ title: "Saqlangan test o‘chirilsinmi?", message: "Kiritilgan barcha javoblar va vaqt o‘chiriladi.", confirmText: "O‘chirish", danger: true })) {
          clearState(test.id, session.uid);
          renderStart(null);
        }
      } }, "Saqlangan testni o‘chirish"));
  } else {
    buttons.push(h("button", { type: "button", class: "btn btn-primary btn-big", onclick: () => startNew() }, "TESTNI BOSHLASH"));
  }

  clear($("#startScreen")).append(
    h("section", { class: "start-card glass" },
      h("div", { class: "hero" },
        h("span", { class: "eyebrow" }, "OLIYFIZIKA.UZ • MILLIY SERTIFIKAT"),
        h("h1", {}, test.title),
        h("p", {}, test.subtitle || "")),
      h("div", { class: "start-body" },
        h("div", { class: "info-grid" },
          chip(String(total), "topshiriq"),
          chip(String(bands), "baholanadigan band"),
          chip(`${test.durationMinutes} min`, "umumiy vaqt"),
          chip(`${mcq} + ${total - mcq}`, "test + ochiq savol")),
        h("div", { class: "participant" },
          h("span", { class: "participant__avatar", "aria-hidden": "true" }, (session.name || "?").trim().charAt(0).toUpperCase()),
          h("div", {},
            h("span", { class: "participant__label" }, "Ishtirokchi"),
            h("b", { class: "participant__name", id: "participantName" }, session.name),
            session.email && session.email !== session.name ? h("span", { class: "participant__email" }, session.email) : null)),
        h("div", { class: "rules" },
          h("b", {}, "Eslatma: "),
          "test boshlanganidan keyin vaqt to‘xtamaydi. Javoblar qurilmada avtomatik saqlanadi. Ochiq savollarning ",
          h("b", {}, "a"), " va ", h("b", {}, "b"),
          " qismlari alohida baholanadi. 33–35-topshiriqlarda A–F javoblar orasidan moslashtirish amalga oshiriladi. Yakunda Rasch balli hisoblanmaydi — tahlil uchun natija kodi beriladi."),
        saved && !saved.submitted ? h("p", { class: "notice" }, `Saqlangan urinish. Javob berilgan: ${countFilledItems(test.questions, saved.answers || {})} / ${bands} band.`) : null,
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

/* ---------------- Imtihon ekrani ---------------- */

function enterExam() {
  buildNav();
  show("#examScreen");
  renderQuestion();
  timer?.stop();
  timer = createTimer({
    element: $("#timer"),
    getEndTs: () => state.deadlineTs,
    onWarn: () => toast("Diqqat: 10 daqiqadan kam vaqt qoldi"),
    onExpire: () => submit(true),
  });
  timer.start();
}

function buildNav() {
  const grid = clear($("#navgrid"));
  navButtons = test.questions.map((q, i) => {
    const b = h("button", { type: "button", class: "navbtn", "aria-label": `${q.n}-savol`, onclick: () => { goTo(i); closeSide(); } }, String(q.n));
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
  $("#qMeta").textContent = `${i + 1} / ${test.questions.length} • ${q.type === "mcq" ? "Test savoli" : "Ochiq savol"}`;
  $("#qTitle").textContent = test.title.toUpperCase();

  const box = clear($("#qContent"));
  if (q.note) box.append(h("div", { class: "shared-note" }, q.note));
  box.append(h("div", { class: "qtext" }, q.text));
  if (q.reaction) box.append(h("div", { class: "reaction" }, q.reaction));
  if (q.image) box.append(h("div", { class: "diagram-wrap" }, h("img", { src: resolveUrl(q.image), alt: `${q.n}-savol rasmi`, decoding: "async" })));

  if (q.type === "mcq") renderOptions(box, q, i);
  else renderOpen(box, q, i);

  const markBtn = $("#markBtn");
  markBtn.classList.toggle("active", !!state.marked[i]);
  markBtn.textContent = state.marked[i] ? "★ Belgilangan" : "☆ Belgilash";
  markBtn.setAttribute("aria-pressed", String(!!state.marked[i]));
  $("#prevBtn").disabled = i === 0;
  $("#nextBtn").textContent = i === test.questions.length - 1 ? "Yakunlash →" : "Keyingi →";
  updateNav();
  $("#questionCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderOptions(box, q, i) {
  const list = h("div", { class: "options", role: "radiogroup", "aria-label": "Javob variantlari" });
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
    box.append(h("button", { type: "button", class: "link-btn", onclick: () => { delete state.answers[i]; persist(); renderQuestion(); } }, "Tanlovni bekor qilish"));
  }
}

/** Variant: matn yoki rasm (+ ixtiyoriy izoh). */
function optionBody(opt) {
  if (typeof opt === "string") return h("span", { class: "optext" }, opt);
  return h("span", { class: "optext" },
    opt.image ? h("img", { class: "option-img", src: resolveUrl(opt.image), alt: opt.text || "Variant rasmi", decoding: "async" }) : null,
    opt.image ? null : opt.text || "");
}

function renderOpen(box, q, i) {
  const hasNumeric = q.parts.some((p) => p.kind !== "text");
  const wrap = h("div", { class: "open-parts" },
    hasNumeric ? h("div", { class: "number-note" }, "⚠️ Son so‘ralgan joyga faqat son kiriting. Birlik avtomatik ko‘rsatiladi. O‘nli kasr: 1,5 yoki 1.5; juda kichik/katta son: 7e-27 yoki 7*10^-27.") : null);
  q.parts.forEach((p) => {
    const id = `open-${p.key}`;
    const isText = p.kind === "text";
    const input = h("input", {
      id, type: "text", inputmode: isText || p.scientific ? "text" : "decimal", autocomplete: "off", spellcheck: "false",
      placeholder: p.hint || (isText ? "Javobni yozing" : "Faqat son"), "aria-label": `${p.key}) qism javobi`, value: state.answers[i]?.[p.key] ?? "",
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
      h("div", { class: "part-title" }, `${p.key}) qism`),
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
  let message = miss ? `${miss} ta baholanadigan band javobsiz qolgan.` : "Barcha bandlarga javob berilgan.";
  if (marked) message += ` ${marked} ta savol belgilangan.`;
  message += " Yakunlangandan so‘ng javoblarni o‘zgartirib bo‘lmaydi.";
  const ok = await confirmDialog({ title: "Testni yakunlaysizmi?", message, confirmText: "Ha, yakunlash", danger: true });
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
  try {
    const res = await submitAttempt(test, state);
    state.status = res.status;
    persist();
    showFinal(res.grade);
    if (auto) toast("Vaqt tugadi — test avtomatik yakunlandi");
  } catch (error) {
    console.error("Urinishni topshirishda xato:", error);
    state.submitted = false;
    state.status = ATTEMPT_STATUS.IN_PROGRESS;
    persist();
    showMessage("Javoblarni yuborib bo‘lmadi", "Internet aloqasini tekshirib, qayta urinib ko‘ring. Javoblaringiz qurilmada saqlangan.", [
      h("button", { type: "button", class: "btn btn-primary", onclick: () => submit(auto) }, "Qayta yuborish"),
    ]);
  }
}

function showFinal(grade) {
  const onNewAttempt = async () => {
    if (await confirmDialog({ title: "Yangi urinish", message: "Joriy natija yopiladi va test boshidan boshlanadi.", confirmText: "Yangi urinish" })) {
      clearState(test.id, session.uid);
      state = null;
      renderStart(null);
    }
  };
  const root = $("#resultScreen");
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
  const back = h("a", { class: "btn btn-primary", href: "./" }, "← Testlar ro‘yxati");

  const access = await checkMockAccess();
  if (!access.allowed) {
    if (access.reason === "login") {
      showMessage("Saytga kiring", "Mock testni boshlash uchun OliyFizika.uz saytidagi akkauntingiz bilan kiring. Natijalar shu akkauntdagi ism bilan saqlanadi. Bosh sahifada “Kirish” tugmasini bosing — kirgandan so‘ng shu testga avtomatik qaytasiz.", [
        h("button", { type: "button", class: "btn btn-primary", onclick: () => goToLogin() }, "Kirish / Ro‘yxatdan o‘tish"), back]);
      return;
    }
    const text = access.reason === "access" ? "Bu bo‘lim uchun sizda ruxsat mavjud emas." : "Ruxsatni tekshirib bo‘lmadi. Internet aloqasini tekshirib, sahifani yangilang.";
    showMessage("Ruxsat talab qilinadi", text, [back]);
    return;
  }
  session = access.session;

  try {
    test = await loadTest(id);
  } catch (error) {
    console.error("Testni yuklab bo‘lmadi:", error);
    showMessage("Testni yuklab bo‘lmadi", "Sahifani yangilab ko‘ring. Muammo takrorlansa, muallifga Telegram orqali xabar bering.", [back]);
    return;
  }
  if (!test) {
    showMessage("Test topilmadi", "Bunday mock test mavjud emas.", [back]);
    return;
  }

  document.title = `${test.title} | ${SITE.name}`;
  $("#brandTitle").textContent = test.title;
  initFormulaSheet($("#formulaBody"), test.formulaSheet, resolveUrl);
  calculator = initCalculator($("#calcBody"));
  bindUi();

  const saved = loadState(test.id, session.uid);
  if (saved && saved.testId === test.id && saved.attemptId) {
    state = saved;
    if (saved.submitted) { showFinal(null); return; }
    if (Date.now() >= saved.deadlineTs) { submit(true); return; }
    renderStart(saved);
    return;
  }
  renderStart(null);
}

init();
