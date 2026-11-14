// Yozma yechimlar (data/solutions/<testId>.json) — natija sahifasidagi har bir savol ostida «Yechimni ko‘rish».
// Blok formati Attestatsiya → Fizika bilan bir xil: p | math | given | answer | check | status (+ inline $…$, **qalin**, *kursiv*).
// Manba: tools/milliy-sertifikat/solutions/*.txt → tools/milliy-sertifikat/build_solutions.py.
// XAVFSIZLIK: matn faqat textContent va KaTeX (trust: false) orqali chiqariladi, innerHTML ishlatilmaydi.
import { h } from "./dom.js";
import { t } from "../../../assets/js/core/i18n.js";

const KATEX_BASE = new URL("../../../assets/vendor/katex/", import.meta.url).href;
let katexPromise = null;

function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexPromise) {
    katexPromise = new Promise((resolve, reject) => {
      if (!document.querySelector("link[data-katex]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${KATEX_BASE}katex.min.css`;
        link.dataset.katex = "";
        document.head.append(link);
      }
      const s = document.createElement("script");
      s.src = `${KATEX_BASE}katex.min.js`;
      s.onload = () => resolve(window.katex);
      s.onerror = () => { katexPromise = null; reject(new Error("KaTeX yuklanmadi")); };
      document.head.append(s);
    });
  }
  return katexPromise;
}

function mathNode(tex, display) {
  const el = document.createElement(display ? "div" : "span");
  el.className = display ? "sol-math sol-math--display" : "sol-math";
  try {
    if (!window.katex) throw new Error("no katex");
    window.katex.render(tex, el, { displayMode: display, throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
  } catch {
    el.textContent = tex;
  }
  return el;
}

/** Inline matn: $…$ formula, **qalin**, *kursiv*; \$ \* \\ — ekranlangan belgilar. */
function inline(text) {
  const frag = document.createDocumentFragment();
  const stack = [frag];
  let target = frag, buf = "", bold = false, italic = false;
  const flush = () => { if (buf) { target.append(document.createTextNode(buf)); buf = ""; } };
  const open = (tag) => { flush(); const el = document.createElement(tag); target.append(el); stack.push(el); target = el; };
  const close = () => { flush(); stack.pop(); target = stack[stack.length - 1]; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\" && "\\$*".includes(text[i + 1] || "")) { buf += text[i + 1]; i++; }
    else if (c === "$") {
      let j = i + 1;
      while (j < text.length && text[j] !== "$") j += text[j] === "\\" ? 2 : 1;
      flush();
      target.append(mathNode(text.slice(i + 1, j), false));
      i = j;
    } else if (c === "*" && text[i + 1] === "*") { if (bold) close(); else open("strong"); bold = !bold; i++; }
    else if (c === "*") { if (italic) close(); else open("em"); italic = !italic; }
    else buf += c;
  }
  flush();
  return frag;
}

const BOX_LABEL = {
  given: () => t("att.r.given", "Berilgan"),
  answer: () => t("att.r.answer", "Javob"),
  check: () => t("att.r.check", "Tekshiruv"),
};
const STATUS_LABEL = {
  undetermined: () => t("ms.sol.undetermined", "Izoh: shart noaniq"),
  source_error: () => t("ms.sol.sourceError", "Javoblar kalitidagi xato"),
};

function renderBlocks(blocks) {
  const frag = document.createDocumentFragment();
  for (const b of blocks || []) {
    if (b.t === "p") { const p = h("p", { class: "sol-p" }); p.append(inline(b.text || "")); frag.append(p); }
    else if (b.t === "math") frag.append(mathNode(b.tex || "", true));
    else if (b.t in BOX_LABEL || b.t === "status") {
      const label = b.t === "status" ? (STATUS_LABEL[b.kind] || (() => t("att.r.note", "Izoh")))() : BOX_LABEL[b.t]();
      const box = h("div", { class: `sol-box sol-box--${b.t === "status" ? `status sol-box--${b.kind}` : b.t}` }, h("p", { class: "sol-box__label" }, label));
      box.append(renderBlocks(b.blocks));
      frag.append(box);
    }
  }
  return frag;
}

const cache = new Map();
/** data/solutions/<testId>.json → { items: { "<n>": blocks[] } } yoki null (yechim tayyorlanmagan). */
export function loadSolutions(testId, resolveUrl) {
  if (!cache.has(testId)) {
    cache.set(testId, fetch(resolveUrl(`data/solutions/${encodeURIComponent(testId)}.json`), { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null));
  }
  return cache.get(testId);
}

/**
 * Natija sahifasidagi savol kartalariga (article.review-q#reviewQ<n>) yechimlarni qo'shadi.
 * Yechim fayli bo'lmasa — hech narsa qilmaydi. To'g'ri javoblar yashirilgan testda
 * (review.showCorrectAnswers: false) yechimlar ham ko'rsatilmaydi, chunki ular javobni ochib qo'yadi.
 */
export async function attachSolutions(container, test, resolveUrl) {
  if (!test.review?.showCorrectAnswers) return 0;
  const data = test.imported ? test.solutionsData : await loadSolutions(test.id, resolveUrl); // import qilingan test — Firestore'dan
  if (!data?.items || !container.isConnected) return 0;
  await loadKatex().catch(() => {});
  let n = 0;
  for (const q of test.questions) {
    const blocks = data.items[String(q.n)];
    const card = container.querySelector(`#reviewQ${q.n}`);
    if (!blocks || !card || card.querySelector(".review-solution")) continue;
    const body = h("div", { class: "sol-body" });
    body.append(renderBlocks(blocks));
    card.append(h("details", { class: "review-solution" },
      h("summary", {}, t("ms.sol.show", "Yechimni ko‘rish")),
      body));
    n++;
  }
  if (n) container.querySelector("[data-sol-note]")?.removeAttribute("hidden");
  return n;
}
