// Natija sahifasi: statistikalar, savollar jadvali, Rasch kodi va savollarni ko'rib chiqish.
import { h, clear, toast, fmtDuration } from "./dom.js";
import { STATUS, optionText } from "./scoring.js";
import { makeResultCode } from "./attempt-service.js";

/** To'g'ri javobni ko'rsatish: uzun kasrlarni yaxlitlash (3√3 → 5,196), vergul bilan. */
function fmtAnswer(v) {
  if (typeof v !== "number") return String(v);
  if (Number.isInteger(v)) return String(v);
  const abs = Math.abs(v);
  const s = abs !== 0 && (abs < 1e-3 || abs >= 1e6) ? v.toExponential(3).replace(/\.?0+e/, "e") : String(Number(v.toPrecision(4)));
  return s.replace(".", ",");
}

const statusClass = (s) => (s === STATUS.OK ? "ok" : s === STATUS.PART ? "part" : s === STATUS.BLANK ? "blank" : "bad");

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  }
  toast("Natija kodi nusxalandi");
}

/** Server rejimi: ball ko'rsatilmaydi, faqat topshirilgan holati. */
export function renderPending(root, { test, state, onNewAttempt }) {
  clear(root).append(
    h("div", { class: "result-hero glass" },
      h("span", { class: "eyebrow" }, test.title),
      h("h2", {}, "Javoblaringiz qabul qilindi"),
      h("p", {}, "Holat: ", h("b", {}, "SUBMITTED"), ". Yakuniy natija barcha ishtirokchilar javoblari Rasch modeli asosida hisoblanib, admin tomonidan tasdiqlangandan so‘ng e’lon qilinadi."),
      h("p", { class: "muted" }, `Urinish ID: ${state.attemptId}`)),
    h("div", { class: "result-actions" },
      h("button", { type: "button", class: "btn btn-ghost", onclick: onNewAttempt }, "↻ Yangi urinish")));
}

export function renderResult(root, { test, state, grade, resolveUrl, onNewAttempt }) {
  const code = makeResultCode(test, state, grade);
  const duration = fmtDuration((state.endTs - state.startTs) / 1000);

  const stat = (value, label) => h("div", { class: "stat" }, h("b", {}, value), h("span", {}, label));

  const hero = h("div", { class: "result-hero glass" },
    h("span", { class: "eyebrow" }, test.title),
    h("h2", {}, "Test yakunlandi"),
    h("div", { class: "result-name" }, state.name),
    state.autoSubmitted ? h("div", { class: "notice-inline" }, "⏱ Vaqt tugadi — test avtomatik yakunlandi.") : null,
    h("div", { class: "stats" },
      stat(`${grade.correct}/${grade.maxScore}`, "to‘g‘ri band"),
      stat(String(grade.wrong), "noto‘g‘ri band"),
      stat(String(grade.blank), "javobsiz band"),
      stat(`${grade.full}/${grade.questionCount}`, "to‘liq to‘g‘ri topshiriq"),
      stat(duration, "sarflangan vaqt")));

  const actions = h("div", { class: "result-actions" },
    h("button", { type: "button", class: "btn btn-primary", onclick: () => copyText(code) }, "📋 Natija kodini nusxalash"),
    h("button", { type: "button", class: "btn btn-ghost", onclick: () => window.print() }, "🖨 Chop etish / PDF"),
    h("button", { type: "button", class: "btn btn-danger-ghost", onclick: onNewAttempt }, "↻ Yangi urinish"),
    h("a", { class: "btn btn-ghost", href: "./" }, "← Testlar ro‘yxati"));

  const table = h("div", { class: "card glass" },
    h("h3", {}, "Savollar bo‘yicha natija"),
    h("div", { class: "table-wrap" },
      h("table", { class: "rtable" },
        h("thead", {}, h("tr", {}, h("th", {}, "№"), h("th", {}, "Sizning javobingiz"), h("th", {}, "Natija"), h("th", {}, "Band"))),
        h("tbody", {}, grade.rows.map((r) => h("tr", {},
          h("td", {}, h("b", {}, String(r.n))),
          h("td", {}, r.answer),
          h("td", { class: `status-${statusClass(r.status)}` }, r.status),
          h("td", {}, r.score)))))));

  const codeCard = h("div", { class: "card glass" },
    h("h3", {}, "Rasch tahlili uchun natija kodi"),
    h("div", { class: "codebox" }, code),
    h("p", { class: "notice" }, `Ushbu kodda Rasch balli yo‘q. Kod keyinchalik barcha ishtirokchilar natijalarini birgalikda Rasch modeli asosida tahlil qilish uchun mo‘ljallangan. Ochiq savollarning a/b qismlari alohida band sifatida kodlangan (${grade.maxScore} ta band).`));

  clear(root).append(hero, actions, table, codeCard);
  if (test.review?.enabled) root.append(renderReview(test, state, grade, resolveUrl));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderReview(test, state, grade, resolveUrl) {
  const showCorrect = !!test.review?.showCorrectAnswers;
  const nav = h("div", { class: "review-nav" }, test.questions.map((q) => h("a", { href: `#reviewQ${q.n}` }, String(q.n))));
  const cards = test.questions.map((q, i) => {
    const r = grade.rows[i];
    const ans = state.answers[i];
    const body = [];
    if (q.note) body.push(h("div", { class: "shared-note" }, q.note));
    body.push(h("div", { class: "qtext" }, q.text));
    if (q.reaction) body.push(h("div", { class: "reaction" }, q.reaction));
    if (q.image) body.push(h("div", { class: "diagram-wrap" }, h("img", { src: resolveUrl(q.image), alt: `${q.n}-savol rasmi`, loading: "lazy" })));
    if (q.type === "mcq") {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      body.push(h("div", { class: "review-options" }, q.options.map((o, k) => {
        const L = letters[k];
        const chosen = ans === L;
        const correct = showCorrect && q.answer === L;
        return h("div", { class: `review-option${chosen ? " chosen" : ""}${correct ? " correct" : ""}` },
          h("span", { class: "letter" }, L),
          h("span", { class: "optext" }, typeof o === "string" ? o : [o.image ? h("img", { class: "option-img", src: resolveUrl(o.image), alt: optionText(o), loading: "lazy" }) : null, o.image ? null : optionText(o)], chosen ? h("b", {}, " — Siz tanlagansiz") : null, correct ? h("b", {}, " — To‘g‘ri javob") : null));
      })));
      if (!ans) body.push(h("div", { class: "review-part" }, h("b", {}, "Sizning javobingiz: "), "—"));
    } else {
      q.parts.forEach((p, k) => {
        const pr = r.parts[k];
        body.push(h("div", { class: `review-part ${pr.ok ? "ok" : pr.empty ? "blank" : "bad"}` },
          h("b", {}, `${p.key}) qism: `), p.text, h("br"),
          h("b", {}, "Sizning javobingiz: "), `${ans?.[p.key] || "—"} ${p.unit || ""}`,
          showCorrect ? [h("br"), h("b", {}, "To‘g‘ri javob: "), `${fmtAnswer(p.answer)} ${p.unit || ""}`] : null));
      });
    }
    return h("article", { class: "review-q", id: `reviewQ${q.n}` },
      h("div", { class: "review-qhead" },
        h("div", { class: "review-qnum" }, h("i", {}, String(q.n)), h("span", {}, q.type === "mcq" ? "Test savoli" : "Ochiq savol")),
        h("span", { class: `review-status ${statusClass(r.status)}` }, `${r.status} • ${r.score}`)),
      body);
  });
  return h("div", { class: "card glass" },
    h("h3", {}, "Yakunlangan test savollari"),
    h("p", { class: "notice" }, showCorrect
      ? "Savollar, siz kiritgan javoblar va to‘g‘ri javoblar. Javoblarni bu bosqichda o‘zgartirib bo‘lmaydi."
      : "Savollar va siz kiritgan javoblar test yakunlangandan keyin ham ko‘rinadi. Javoblarni bu bosqichda o‘zgartirib bo‘lmaydi."),
    nav,
    h("div", { class: "review-list" }, cards));
}
