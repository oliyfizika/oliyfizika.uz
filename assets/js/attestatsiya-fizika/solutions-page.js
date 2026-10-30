// ==========================================================================
// Attestatsiya → Fizika: Yechimlar (attestatsiya/fizika-yechimlar.html[?day=N])
// Yechim hujjati faqat solutionAvailableAt'dan keyin YOKI o'z urinishi yakunlangach so'raladi (Rules: attSolutionReadable).
// Yopiq kun uchun hech qanday yechim ma'lumoti yuklanmaydi.
// ==========================================================================
import { t as tr } from "../core/i18n.js";
import { listVisibleTests, getSnapshot, getSolutions, getMyAttempt, listMyAttempts } from "./api.js";
import { loadAccessContext, contentOpen, accessText, ACCESS_TITLE, COURSE_URL } from "./access.js";
import { isOverdue, finalizeIfOverdue } from "./finalize.js";
import { esc, solutionOpenFor, formatTashkent, isMock, mockCompositionText, dayLabel, dayLabelOf, mockPoints, mockMax } from "./core.js";
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

let access = null;
const lockHtml = (d, t) => stateHtml("lock", tr("att.sol.lockTitle", "{day}: {title}", { day: dayLabelOf(d), title: ACCESS_TITLE.toLowerCase() }), esc(accessText(t)),
  `<div class="of-row" style="justify-content:center;flex-wrap:wrap"><a class="of-btn of-btn--primary" href="${COURSE_URL}" target="_blank" rel="noopener noreferrer">📲 ${tr("att.sol.enroll", "Kursga yozilish")}</a><a class="of-btn" href="fizika-yechimlar.html">${tr("att.sol.allSolutions", "Barcha yechimlar")}</a></div>`);

function renderList(tests, mine = new Map()) {          // mine: testId → o'z urinishi (yakunlangan bo'lsa yechim darhol ochiq)
  if (!tests.length) {
    show(stateHtml("book", tr("att.sol.emptyTitle", "Hali yechimlar yo‘q"), tr("att.sol.emptyText", "Testni yakunlaganingiz zahoti (kunlik testlar), mock testda esa yechim vaqtida ham yechimlar shu yerda paydo bo‘ladi.")));
    return;
  }
  show(`<ul class="att-days">${tests.slice().sort((a, b) => isMock(a) - isMock(b) || a.dayNumber - b.dayNumber).map((t) => {
    const allowed = contentOpen(t, access, mine.has(t.id));
    const open = solutionOpenFor(t, mine.get(t.id)) && allowed;
    return `<li><article class="of-card att-day" data-state="${!allowed ? "restricted" : open ? "done" : "open"}" aria-labelledby="solD${t.dayNumber}">
      <div class="att-day__head"><span class="att-day__num">${isMock(t) ? "M" : t.dayNumber}</span>
        <div><p class="att-day__title" id="solD${t.dayNumber}">${isMock(t) ? esc(dayLabel(t)) : `${esc(dayLabel(t))} · ${esc(t.sectionTitle)}`}</p><p class="att-day__sub">${tr("att.sol.qCount", "{n} savol", { n: t.questionCount })}${isMock(t) ? ` · ${tr("att.sol.ballCount", "{n} ball", { n: mockMax(t) })}` : ""}</p></div></div>
      <p class="att-day__topics">${isMock(t) ? esc(mockCompositionText(t, "ta ")) : esc(t.topics.join(", "))}</p>
      <div class="att-day__stats">${!allowed ? `<span class="of-badge att-badge-lock">${ic("lock")} ${ACCESS_TITLE}</span>` : open
        ? `<span class="of-badge of-badge--green">${ic("unlock")} ${tr("att.sol.open", "Yechimlar ochiq")}</span>`
        : isMock(t) ? `<span class="of-badge of-badge--orange">${ic("lock")} ${tr("att.sol.opensAt", "{date} da ochiladi", { date: esc(formatTashkent(t.solutionAvailableAt)) })}</span>`
          : `<span class="of-badge of-badge--orange">${ic("lock")} ${tr("att.sol.opensAfter", "Testni yakunlagach ochiladi")}</span>`}</div>
      <div class="att-day__foot">${open ? `<a class="of-btn of-btn--primary of-btn--sm" href="fizika-yechimlar.html?day=${t.dayNumber}">${ic("book")}${tr("att.sol.openBtn", "Yechimlarni ochish")}</a>` : ""}</div>
    </article></li>`;
  }).join("")}</ul>`);
}

async function renderDay(tests, uid) {
  const t = tests.find((x) => x.dayNumber === day);
  window.OFShell?.setTitle?.(tr("att.sol.shellTitle", "{day} — yechimlar", { day: dayLabelOf(day) }));
  document.title = tr("att.sol.docTitle", "{day} — Yechimlar — Attestatsiya — Fizika | OliyFizika.uz", { day: dayLabelOf(day) });
  if (!t) {
    show(stateHtml("lock", tr("att.sol.notPublished", "{day} hali e’lon qilinmagan", { day: dayLabelOf(day) }), "", `<a class="of-btn of-btn--primary" href="fizika-yechimlar.html">${tr("att.sol.allSolutions", "Barcha yechimlar")}</a>`));
    return;
  }
  const [firstAttempt, myList] = await Promise.all([getMyAttempt(uid, t.id).catch(() => null), listMyAttempts(uid).catch(() => [])]);
  const mine = new Map(myList.map((x) => [x.testId, x]));
  if (!contentOpen(t, access, firstAttempt)) { show(lockHtml(day, t)); return; }   // Day 4+ ruxsatsiz: avval kirish xabari
  if (!solutionOpenFor(t, firstAttempt)) {
    show(stateHtml("lock", tr("att.sol.closedTitle", "{day} yechimlari hali yopiq", { day: dayLabelOf(day) }),
      isMock(t)
        ? tr("att.sol.closedMock", "To‘liq yechimlar <b>{date}</b> da (Toshkent vaqti) ochiladi{extra}.", {
          date: esc(formatTashkent(t.solutionAvailableAt)),
          extra: firstAttempt?.status === "in_progress" ? tr("att.sol.orOnSubmit", " yoki testni topshirganingiz zahoti") : "",
        })
        : tr("att.sol.closedDaily", "Yechimlar testni yakunlaganingizda (topshirganda yoki 2 soatlik vaqt tugaganda) ochiladi.{extra}", {
          extra: firstAttempt?.status === "in_progress" ? tr("att.sol.inProgress", " Testingiz davom etmoqda.") : tr("att.sol.doTestFirst", " Avval testni bajaring."),
        }),
      `<a class="of-btn of-btn--primary" href="fizika-yechimlar.html">${tr("att.sol.allSolutions", "Barcha yechimlar")}</a>`));
    return;
  }
  let attempt = firstAttempt;
  await loadKatex().catch(() => {});
  if (!contentOpen(t, access, attempt)) { show(lockHtml(day, t)); return; }   // Day 4+ ruxsatsiz (Rules ham rad etadi)
  if (isOverdue(attempt, t)) attempt = (await finalizeIfOverdue(attempt, t).catch(() => ({ attempt }))).attempt;
  const version = attempt?.testVersion || t.currentVersion;
  const [snap, sol] = await Promise.all([getSnapshot(t.id, version), getSolutions(t.id, version)]);
  const solById = new Map(sol.items.map((x) => [x.id, x]));
  const my = attempt?.answers || {};
  const mock = isMock(t);
  const sameKind = tests.filter((x) => isMock(x) === mock);          // Day 1..N va Mock testlar o'zaro aralashmaydi
  const prev = sameKind.filter((x) => x.dayNumber < day && solutionOpenFor(x, mine.get(x.id))).pop();
  const next = sameKind.find((x) => x.dayNumber > day && solutionOpenFor(x, mine.get(x.id)));
  const label = (x) => dayLabel(x);
  show(`
    <section class="of-card att-hero" aria-labelledby="solTitle">
      <div class="att-hero__text">
        <p class="att-eyebrow">${ic("book")}${tr("att.sol.eyebrow", "Yechimlar · {label}", { label: esc(label(t)) })}</p>
        <h1 id="solTitle">${mock ? tr("att.sol.mockSolutions", "Mock test yechimlari") : esc(t.sectionTitle)}</h1>
        <p>${mock ? esc(mockCompositionText(t, "ta ")) : esc(t.topics.join(", "))} · ${tr("att.sol.qCount", "{n} savol", { n: t.questionCount })}${attempt?.status === "graded"
          ? tr("att.sol.yourResult", " · sizning natijangiz: <b>{v}</b>", { v: mock ? tr("att.sol.points", "{n} / {max} ball", { n: mockPoints(attempt.correctAnswers, t), max: mockMax(t) }) : `${attempt.scorePercent}%` }) : ""}</p>
      </div>
      <div class="att-hero__side">
        <div class="of-row" style="flex-wrap:wrap">
          ${prev ? `<a class="of-btn" href="fizika-yechimlar.html?day=${prev.dayNumber}">${ic("chevronLeft")}${esc(label(prev))}</a>` : ""}
          ${next ? `<a class="of-btn" href="fizika-yechimlar.html?day=${next.dayNumber}">${esc(label(next))}${ic("chevronRight")}</a>` : ""}
          <a class="of-btn of-btn--ghost" href="fizika-yechimlar.html">${mock ? tr("att.sol.allSolutions", "Barcha yechimlar") : tr("att.sol.allDays", "Barcha kunlar")}</a>
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
    card.id = `sol-${q.id}`;   // natija sahifasidagi «To‘liq yechim» havolasi shu yerga olib keladi
    card.setAttribute("aria-labelledby", `sq${i}`);
    const head = document.createElement("div");
    head.className = "att-q__head";
    head.innerHTML = `<span class="att-q__num" id="sq${i}">${tr("att.sol.qNum", "{n}-savol", { n: i + 1 })}</span><span class="of-badge of-badge--blue">${esc(q.topic)}</span>${
      q.evaluationType !== "auto" ? `<span class="of-badge of-badge--orange">${tr("att.sol.unscored", "Ballga kirmagan")}</span>` : ""}`;
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
    ans.innerHTML = `${s.correctAnswer ? `<span class="of-badge of-badge--green">${ic("check")} ${tr("att.sol.correctAnswer", "To‘g‘ri javob: {a}", { a: esc(s.correctAnswer) })}</span>` : ""}${
      !s.correctAnswer && s.solutionResult && s.solutionResult !== "none" ? `<span class="of-badge of-badge--green">${tr("att.sol.answer", "Javob: {a}", { a: esc(s.solutionResult) })}</span>` : ""}${
      my[q.id] ? `<span class="of-badge">${tr("att.sol.yourAnswer", "Sizning javobingiz: {a}", { a: esc(my[q.id]) })}</span>` : ""}`;
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
    const [tests, ctx] = await Promise.all([listVisibleTests(), loadAccessContext(s.user.uid)]);
    access = ctx;
    if (day) await renderDay(tests, s.user.uid);
    else renderList(tests, new Map((await listMyAttempts(s.user.uid).catch(() => [])).map((a) => [a.testId, a])));
  } catch (e) {
    console.error("[att] yechimlar:", e);
    show(stateHtml("alert", tr("att.sol.loadError", "Yechimlarni yuklab bo‘lmadi"), errorMessage(e)));
  }
})();
