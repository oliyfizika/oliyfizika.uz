// ==========================================================================
// Attestatsiya → Fizika: Yechimlar (attestatsiya/fizika-yechimlar.html[?day=N])
// Yechim hujjati faqat solutionAvailableAt'dan keyin so'raladi (Rules ham shu vaqtgacha rad etadi).
// Yopiq kun uchun hech qanday yechim ma'lumoti yuklanmaydi.
// ==========================================================================
import { listVisibleTests, getSnapshot, getSolutions, getMyAttempt } from "./api.js";
import { esc, solutionOpen, formatTashkent } from "./core.js";
import { renderBlocks, loadKatex } from "./render.js";
import { ic, fillIcons, whenUser, tabsHtml, stateHtml, errorMessage } from "./ui.js";

const root = document.getElementById("attSol");
const view = root.querySelector("[data-view]");
const day = Number(new URLSearchParams(location.search).get("day")) || null;
root.querySelector("[data-tabs]").innerHTML = tabsHtml("solutions");
fillIcons(root);

function show(html) {
  view.innerHTML = html;
  fillIcons(view);
}

function renderList(tests) {
  if (!tests.length) {
    show(stateHtml("book", "Hali yechimlar yo‘q", "Birinchi test e’lon qilinib, ertasi kuni 00:00 bo‘lganda yechimlar shu yerda paydo bo‘ladi."));
    return;
  }
  show(`<ul class="att-days">${tests.map((t) => {
    const open = solutionOpen(t);
    return `<li><article class="of-card att-day" data-state="${open ? "done" : "open"}" aria-labelledby="solD${t.dayNumber}">
      <div class="att-day__head"><span class="att-day__num">${t.dayNumber}</span>
        <div><p class="att-day__title" id="solD${t.dayNumber}">Day ${t.dayNumber} · ${esc(t.sectionTitle)}</p><p class="att-day__sub">${t.questionCount} savol</p></div></div>
      <p class="att-day__topics">${esc(t.topics.join(", "))}</p>
      <div class="att-day__stats">${open
        ? `<span class="of-badge of-badge--green">${ic("unlock")} Yechimlar ochiq</span>`
        : `<span class="of-badge of-badge--orange">${ic("lock")} ${esc(formatTashkent(t.solutionAvailableAt))} da ochiladi</span>`}</div>
      <div class="att-day__foot">${open ? `<a class="of-btn of-btn--primary of-btn--sm" href="fizika-yechimlar.html?day=${t.dayNumber}">${ic("book")}Yechimlarni ochish</a>` : ""}</div>
    </article></li>`;
  }).join("")}</ul>`);
}

async function renderDay(tests, uid) {
  const t = tests.find((x) => x.dayNumber === day);
  window.OFShell?.setTitle?.(`Day ${day} — yechimlar`);
  document.title = `Day ${day} — Yechimlar — Attestatsiya — Fizika | OliyFizika.uz`;
  if (!t) {
    show(stateHtml("lock", `Day ${day} hali e’lon qilinmagan`, "", '<a class="of-btn of-btn--primary" href="fizika-yechimlar.html">Barcha yechimlar</a>'));
    return;
  }
  if (!solutionOpen(t)) {
    show(stateHtml("lock", `Day ${day} yechimlari hali yopiq`,
      `To‘liq yechimlar <b>${esc(formatTashkent(t.solutionAvailableAt))}</b> da (Toshkent vaqti) ochiladi.`,
      '<a class="of-btn of-btn--primary" href="fizika-yechimlar.html">Barcha yechimlar</a>'));
    return;
  }
  const [attempt] = await Promise.all([getMyAttempt(uid, t.id).catch(() => null), loadKatex().catch(() => {})]);
  const version = attempt?.testVersion || t.currentVersion;
  const [snap, sol] = await Promise.all([getSnapshot(t.id, version), getSolutions(t.id, version)]);
  const solById = new Map(sol.items.map((x) => [x.id, x]));
  const my = attempt?.answers || {};
  const prev = tests.filter((x) => x.dayNumber < day && solutionOpen(x)).pop();
  const next = tests.find((x) => x.dayNumber > day && solutionOpen(x));
  show(`
    <section class="of-card att-hero" aria-labelledby="solTitle">
      <div class="att-hero__text">
        <p class="att-eyebrow">${ic("book")}Yechimlar · Day ${t.dayNumber}</p>
        <h1 id="solTitle">${esc(t.sectionTitle)}</h1>
        <p>${esc(t.topics.join(", "))} · ${t.questionCount} savol${attempt?.status === "graded" ? ` · sizning natijangiz: <b>${attempt.scorePercent}%</b>` : ""}</p>
      </div>
      <div class="att-hero__side">
        <div class="of-row" style="flex-wrap:wrap">
          ${prev ? `<a class="of-btn" href="fizika-yechimlar.html?day=${prev.dayNumber}">${ic("chevronLeft")}Day ${prev.dayNumber}</a>` : ""}
          ${next ? `<a class="of-btn" href="fizika-yechimlar.html?day=${next.dayNumber}">Day ${next.dayNumber}${ic("chevronRight")}</a>` : ""}
          <a class="of-btn of-btn--ghost" href="fizika-yechimlar.html">Barcha kunlar</a>
        </div>
      </div>
    </section>
    <ol class="att-review" data-list></ol>`);
  const list = view.querySelector("[data-list]");
  snap.questions.forEach((q, i) => {
    const s = solById.get(q.id) || {};
    const li = document.createElement("li");
    const card = document.createElement("article");
    card.className = "of-card att-solq";
    card.setAttribute("aria-labelledby", `sq${i}`);
    const head = document.createElement("div");
    head.className = "att-q__head";
    head.innerHTML = `<span class="att-q__num" id="sq${i}">${i + 1}-savol</span><span class="of-badge of-badge--blue">${esc(q.topic)}</span>${
      q.evaluationType !== "auto" ? '<span class="of-badge of-badge--orange">Ballga kirmagan</span>' : ""}`;
    const qb = document.createElement("div");
    qb.className = "att-q__body";
    qb.append(renderBlocks(q.question, { testId: t.id, scope: "question" }));
    card.append(head, qb);
    if (q.optionCount) {
      const ul = document.createElement("ul");
      ul.className = "att-opts";
      q.options.forEach((o) => {
        const liO = document.createElement("li");
        const d = document.createElement("div");
        d.className = "att-opt";
        if (o.key === s.correctAnswer) d.dataset.review = "correct";
        else if (o.key === my[q.id] && s.correctAnswer) d.dataset.review = "wrong";
        const k = document.createElement("span");
        k.className = "att-opt__key";
        k.textContent = o.key;
        const c = document.createElement("span");
        c.className = "att-opt__content";
        c.append(renderBlocks(o.blocks, { testId: t.id, scope: "question" }));
        d.append(k, c);
        liO.append(d);
        ul.append(liO);
      });
      card.append(ul);
    }
    const ans = document.createElement("div");
    ans.className = "att-solq__answer";
    ans.innerHTML = `${s.correctAnswer ? `<span class="of-badge of-badge--green">${ic("check")} To‘g‘ri javob: ${esc(s.correctAnswer)}</span>` : ""}${
      !s.correctAnswer && s.solutionResult && s.solutionResult !== "none" ? `<span class="of-badge of-badge--green">Javob: ${esc(s.solutionResult)}</span>` : ""}${
      my[q.id] ? `<span class="of-badge">Sizning javobingiz: ${esc(my[q.id])}</span>` : ""}`;
    const sep = document.createElement("div");
    sep.className = "att-solq__sep";
    const solBox = document.createElement("div");
    solBox.className = "att-sol";
    solBox.append(renderBlocks(s.solution || [], { testId: t.id, scope: "solution" }));
    card.append(ans, sep, solBox);
    li.append(card);
    list.append(li);
  });
  fillIcons(view);
}

(async () => {
  const s = await whenUser();
  try {
    const tests = await listVisibleTests();
    if (day) await renderDay(tests, s.user.uid);
    else renderList(tests);
  } catch (e) {
    console.error("[att] yechimlar:", e);
    show(stateHtml("alert", "Yechimlarni yuklab bo‘lmadi", errorMessage(e)));
  }
})();
