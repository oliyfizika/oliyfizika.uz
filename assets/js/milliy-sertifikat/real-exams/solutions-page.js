// ==========================================================================
// Real imtihonlar — yechimlar ko'ruvchisi (yechimlar.html?id=EXAM_ID&q=N).
//   • Savol matni/variantlar — manba dataset (PDF dan so'zma-so'z); yechim — audit fayli (o'zgarmagan).
//   • Navigatsiya: birinchi · oldingi · keyingi · oxirgi · raqam bo'yicha. Faqat included=true savollar.
//     ORG (included=false) savollar standart holatda navigatsiyada yo'q; "ORG savollarni ko'rsatish"
//     belgilansa, ular alohida belgi bilan ko'rinadi (ballga/yechimga kirmaydi).
//   • NEEDS_MANUAL_REVIEW yashirilmaydi; yakuniy javob yaratilmaydi.
//   • NO_CORRECT_OPTION — manba xatosi sifatida tushuntiriladi.
// ==========================================================================
import { getAdapter } from "./data.js";
import { runGate, fillIcons, ic } from "./ui.js";
import { loadKatex, renderQuestion, renderSolutionBlocks, inline } from "./render.js";
import { esc, examTitle, SOLUTION_STATUS, SOLUTION_FLAG, PART_STATUS } from "./labels.js";

fillIcons();
const params = new URLSearchParams(location.search);
const examId = params.get("id");

let state = null; // { exam, questions, solutions, list, idx, showOrg, adapter }

function navList() {
  return state.questions.filter((q) => q.included || state.showOrg);
}

function setUrl(n, push) {
  const u = new URL(location.href);
  u.searchParams.set("q", String(n));
  if (state.showOrg) u.searchParams.set("org", "1"); else u.searchParams.delete("org");
  history[push ? "pushState" : "replaceState"]({ n }, "", u);
}

function badge(text, tone) {
  return `<span class="of-badge${tone ? ` of-badge--${tone}` : ""}">${esc(text)}</span>`;
}

function renderNav() {
  const list = navList();
  const grid = document.querySelector("[data-grid]");
  grid.innerHTML = list.map((q, i) => {
    const sol = state.solById.get(q.questionNumber);
    const st = sol?.solutionStatus || "FINAL";
    return `<li><button type="button" class="rx-num" data-i="${i}" data-status="${st}" ${i === state.idx ? 'aria-current="true"' : ""}
      aria-label="${q.questionNumber}-savol${st !== "FINAL" ? `, ${esc(SOLUTION_STATUS[st].label)}` : ""}">${q.questionNumber}</button></li>`;
  }).join("");
  const at = (sel, dis) => { const b = document.querySelector(sel); b.disabled = dis; };
  at("[data-first]", state.idx <= 0);
  at("[data-prev]", state.idx <= 0);
  at("[data-next]", state.idx >= list.length - 1);
  at("[data-last]", state.idx >= list.length - 1);
  document.querySelector("[data-pos]").textContent = `${state.idx + 1} / ${list.length}`;
}

function renderCurrent(focus) {
  const list = navList();
  const q = list[state.idx];
  const sol = state.solById.get(q.questionNumber);
  const st = SOLUTION_STATUS[sol?.solutionStatus || "FINAL"];
  const host = document.querySelector("[data-question]");
  const v = q.verification || {};
  host.innerHTML = `
    <header class="rx-qhead">
      <h2 class="rx-qhead__title" id="rxQTitle" tabindex="-1">${q.questionNumber}-savol</h2>
      <div class="rx-qhead__badges">
        ${badge(st.label, st.tone)}
        ${(sol?.solutionFlags || []).filter((f) => SOLUTION_FLAG[f] && f !== "SOURCE_ERROR").map((f) => badge(SOLUTION_FLAG[f], "blue")).join("")}
        ${!q.included ? badge("Ballga kirmaydi", "red") : ""}
      </div>
      <p class="rx-qhead__meta">PDF sahifa: ${q.sourcePages.join(", ")} ·
        <span title="AI ikki bosqichli tekshiruv">AI tekshiruvi: ${v.aiVerified ? "ha" : "yo‘q"}</span> ·
        <span title="Inson tekshiruvi (PHASE 3.5 sample)">Inson tekshiruvi: ${v.humanSignOff ? "tasdiqlangan" : "tanlanmagan"}</span></p>
    </header>
    <section class="rx-panel" aria-label="Savol (manba matni)"><p class="rx-panel__label">Savol</p><div data-q></div></section>
    <section class="rx-panel rx-panel--sol" aria-label="Yechim"><p class="rx-panel__label">Yechim</p><div data-sol></div></section>`;
  host.querySelector("[data-q]").append(renderQuestion(q, { figureUrl: (f) => state.adapter.figureUrl({ ...f, examId: q.examId }) }));
  const solBox = host.querySelector("[data-sol]");
  solBox.closest(".rx-panel--sol").dataset.status = sol?.solutionStatus || "FINAL";
  if (st.help) {
    const h = document.createElement("p");
    h.className = `rx-status rx-status--${sol.solutionStatus}`;
    h.setAttribute("role", "note");
    h.textContent = st.help;
    solBox.append(h);
  }
  if (sol) {
    solBox.append(answerBox(q, sol));
    if (sol.group) {
      const g = document.createElement("p");
      g.className = "rx-muted rx-groupnote";
      g.textContent = `Yechim ${sol.group.replace("-", "–")}-savollar uchun umumiy.`;
      solBox.append(g);
    }
    solBox.append(renderSolutionBlocks(sol.blocks));
  } else {
    solBox.append(Object.assign(document.createElement("p"), { textContent: "Yechim mavjud emas." }));
  }
  // variantlarda to'g'ri javobni belgilash (faqat FINAL va parse qilingan javob bo'lsa)
  if (sol?.solutionStatus === "FINAL" && sol.answer?.choice) {
    host.querySelector(`.rx-opt[data-key="${sol.answer.choice}"]`)?.classList.add("rx-opt--correct");
  }
  renderNav();
  if (focus) host.querySelector("#rxQTitle").focus({ preventScroll: false });
}

function answerBox(q, sol) {
  const box = document.createElement("div");
  box.className = "rx-answer";
  box.dataset.status = sol.solutionStatus;
  const label = document.createElement("p");
  label.className = "rx-answer__label";
  const val = document.createElement("p");
  val.className = "rx-answer__value";
  if (sol.solutionStatus === "NEEDS_MANUAL_REVIEW" && !Object.keys(sol.partSolutionStatus || {}).length) {
    label.textContent = "Javob";
    val.textContent = "Yakuniy javob berilmagan — qo‘shimcha tekshiruv talab etiladi.";
  } else {
    label.textContent = sol.solutionStatus === "NO_CORRECT_OPTION" ? "Audit natijasi (variantlarda yo‘q)" : "Javob";
    val.append(inline(sol.answer?.text || "—", { markdown: true }));
  }
  box.append(label, val);
  const parts = Object.entries(sol.partSolutionStatus || {});
  if (parts.length) {
    const ul = document.createElement("ul");
    ul.className = "rx-answer__parts";
    for (const [k, s] of parts) {
      const li = document.createElement("li");
      li.dataset.status = s;
      li.textContent = `${k}) ${PART_STATUS[s] || s}`;
      ul.append(li);
    }
    box.append(ul);
  }
  if (sol.headingNote) {
    const n = document.createElement("p");
    n.className = "rx-muted";
    n.append(inline(`Audit izohi: ${sol.headingNote}`, { markdown: true }));
    box.append(n);
  }
  if (sol.answer?.tail) {
    const n = document.createElement("p");
    n.className = "rx-muted";
    n.append(inline(`Tasdiqlanmagan taxmin (yakuniy javob emas): ${sol.answer.tail.replace(/^\(|\)$/g, "")}`, { markdown: true }));
    box.append(n);
  }
  return box;
}

function go(i, push = true, focus = true) {
  const list = navList();
  state.idx = Math.max(0, Math.min(list.length - 1, i));
  setUrl(list[state.idx].questionNumber, push);
  renderCurrent(focus);
}

function bind() {
  // Kichik ekranda raqamlar paneli yig'ilgan holda (savol darhol ko'rinadi); oldingi/keyingi har doim ochiq
  const more = document.querySelector("[data-nav-more]");
  if (more && matchMedia("(max-width: 1023px)").matches) more.open = false;
  document.querySelector("[data-first]").addEventListener("click", () => go(0));
  document.querySelector("[data-prev]").addEventListener("click", () => go(state.idx - 1));
  document.querySelector("[data-next]").addEventListener("click", () => go(state.idx + 1));
  document.querySelector("[data-last]").addEventListener("click", () => go(navList().length - 1));
  document.querySelector("[data-grid]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b) go(Number(b.dataset.i));
  });
  const jump = document.querySelector("[data-jump]");
  jump.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = Number(new FormData(jump).get("n"));
    const i = navList().findIndex((q) => q.questionNumber === n);
    const msg = jump.querySelector("[data-jump-msg]");
    if (i === -1) { msg.textContent = `${n || "?"}-savol navigatsiyada yo‘q.`; return; }
    msg.textContent = "";
    go(i);
  });
  const org = document.querySelector("[data-show-org]");
  org.checked = state.showOrg;
  org.disabled = !state.questions.some((q) => !q.included);
  org.closest("label").hidden = org.disabled;
  org.addEventListener("change", () => {
    const cur = navList()[state.idx].questionNumber;
    state.showOrg = org.checked;
    const list = navList();
    let i = list.findIndex((q) => q.questionNumber === cur);
    if (i === -1) i = Math.max(0, list.findIndex((q) => q.questionNumber > cur) - 1);
    go(i, false, false);
  });
  addEventListener("popstate", () => {
    const n = Number(new URLSearchParams(location.search).get("q"));
    const i = navList().findIndex((q) => q.questionNumber === n);
    if (i !== -1) { state.idx = i; renderCurrent(false); }
  });
  addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, [contenteditable]") || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") go(state.idx + 1);
    else if (e.key === "ArrowLeft") go(state.idx - 1);
  });
}

runGate(async () => {
  const adapter = await getAdapter();
  const [exam, questions, solutions] = await Promise.all([
    adapter.getExam(examId), adapter.getQuestions(examId), adapter.getSolutions(examId), loadKatex().catch(() => null),
  ]);
  const title = examTitle(exam);
  document.title = `${title} — Yechimlar — Real imtihonlar | OliyFizika.uz`;
  const setTitle = () => window.OFShell?.setTitle?.(`${title} — yechimlar`);
  if (window.OFShell) setTitle(); else document.addEventListener("of:shell-ready", setTitle, { once: true });
  questions.sort((a, b) => a.questionNumber - b.questionNumber);
  state = { exam, questions, solById: new Map(solutions.map((s) => [s.questionNumber, s])), idx: 0, showOrg: params.get("org") === "1", adapter };
  const view = document.querySelector("[data-view]");
  view.querySelector("[data-title]").textContent = title;
  view.querySelector("[data-pdf-link]").href = `imtihon.html?id=${encodeURIComponent(exam.examId)}`;
  view.querySelector("[data-sub]").textContent = `${exam.includedCount} ta savol${exam.excludedCount ? ` · ${exam.excludedCount} ta ORG savol navigatsiyadan chiqarilgan` : ""}`;
  bind();
  const n = Number(params.get("q"));
  const start = navList().findIndex((q) => q.questionNumber === n);
  go(start === -1 ? 0 : start, false, false);
});
