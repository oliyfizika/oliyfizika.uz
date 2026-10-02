// ==========================================================================
// Attestatsiya → Fizika: blok renderer (savol, variant, yechim) + KaTeX.
//
// Ma'lumot formati (06_data_preparation_report.md §6):
//   bloklar: p | math | list | table | figure | given | heading | answer | check | status
//   inline:  $…$ formula, **qalin**, *kursiv*, \n — matndagi \ $ * ekranlangan
// XAVFSIZLIK: ma'lumotdan kelgan matn hech qachon innerHTML ga berilmaydi — faqat textContent va KaTeX
// (trust: false). Rasmlar Blob URL orqali (Rules tekshiruvidan keyin).
// ==========================================================================
import { figureUrl } from "./api.js";
import { openModal } from "../ui/modal.js";

const KATEX_BASE = new URL("../../vendor/katex/", import.meta.url).href;
let katexPromise = null;

/** KaTeX (lokal, assets/vendor/katex — MIT) faqat kerak bo'lganda yuklanadi. */
export function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexPromise) {
    katexPromise = new Promise((resolve, reject) => {
      if (!document.querySelector("link[data-katex]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = KATEX_BASE + "katex.min.css";
        link.dataset.katex = "";
        document.head.append(link);
      }
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

function mathNode(tex, display) {
  const el = document.createElement(display ? "div" : "span");
  el.className = display ? "att-math att-math--display" : "att-math";
  try {
    window.katex.render(tex, el, { displayMode: display, throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
  } catch {
    el.textContent = tex;
  }
  return el;
}

/** INLINE matn -> DocumentFragment */
export function inline(text) {
  const frag = document.createDocumentFragment();
  let buf = "";
  let bold = false;
  let italic = false;
  let target = frag;
  const stack = [frag];
  const flush = () => {
    if (!buf) return;
    const parts = buf.split("\n");
    parts.forEach((part, i) => {
      if (i) target.append(document.createElement("br"));
      if (part) target.append(document.createTextNode(part));
    });
    buf = "";
  };
  const open = (tag) => {
    flush();
    const el = document.createElement(tag);
    target.append(el);
    stack.push(el);
    target = el;
  };
  const close = () => {
    flush();
    stack.pop();
    target = stack[stack.length - 1];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\" && i + 1 < text.length && "\\$*".includes(text[i + 1])) {
      buf += text[i + 1];
      i++;
    } else if (c === "$") {
      let j = i + 1;
      while (j < text.length && text[j] !== "$") j += text[j] === "\\" ? 2 : 1;
      flush();
      target.append(mathNode(text.slice(i + 1, j), false));
      i = j;
    } else if (c === "*" && text[i + 1] === "*") {
      if (bold) close(); else open("strong");
      bold = !bold;
      i++;
    } else if (c === "*") {
      if (italic) close(); else open("em");
      italic = !italic;
    } else {
      buf += c;
    }
  }
  flush();
  return frag;
}

const BOX_LABEL = { given: "Berilgan", answer: "Javob", check: "Tekshiruv" };
const STATUS_LABEL = { undetermined: "Yechim holati: aniqlanmagan", source_error: "Manba xatosi", critical: "Muhim xato" };

/**
 * @param {Array} blocks
 * @param {{testId:string, scope:"question"|"solution"}} ctx  rasm manzili uchun
 * @returns {DocumentFragment}
 */
export function renderBlocks(blocks, ctx) {
  const frag = document.createDocumentFragment();
  for (const b of blocks || []) frag.append(renderBlock(b, ctx));
  return frag;
}

function renderBlock(b, ctx) {
  switch (b.t) {
    case "p": {
      const p = document.createElement("p");
      p.className = "att-p";
      p.append(inline(b.text));
      return p;
    }
    case "math":
      return mathNode(b.tex, true);
    case "list": {
      const list = document.createElement(b.ordered ? "ol" : "ul");
      list.className = "att-list";
      if (b.label === "a)") list.dataset.style = "alpha";
      if (b.label === "A)") list.dataset.style = "upper";
      for (const it of b.items) {
        const li = document.createElement("li");
        li.append(renderBlocks(it, ctx));
        list.append(li);
      }
      return list;
    }
    case "table": {
      const wrap = document.createElement("div");
      wrap.className = "att-table-wrap";
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", "Jadval (gorizontal aylantirish mumkin)");
      const table = document.createElement("table");
      table.className = "att-table";
      for (const row of b.rows) {
        const tr = document.createElement("tr");
        for (const cell of row) {
          const td = document.createElement("td");
          if (cell.colspan) td.colSpan = cell.colspan;
          td.append(renderBlocks(cell.blocks, ctx));
          tr.append(td);
        }
        table.append(tr);
      }
      wrap.append(table);
      return wrap;
    }
    case "figure":
      return figureNode(b, ctx);
    case "heading": {
      const h = document.createElement("h4");
      h.className = "att-sol-heading";
      h.textContent = b.text;
      return h;
    }
    case "given":
    case "answer":
    case "check":
    case "status": {
      const box = document.createElement("div");
      box.className = `att-box att-box--${b.t}${b.kind ? ` att-box--${b.kind}` : ""}`;
      const label = document.createElement("p");
      label.className = "att-box__label";
      label.textContent = b.t === "status" ? STATUS_LABEL[b.kind] || "Izoh" : BOX_LABEL[b.t];
      box.append(label, renderBlocks(b.blocks, ctx));
      return box;
    }
    default: {
      const span = document.createElement("span");
      return span;
    }
  }
}

// ------------------------------------------------------------------ rasmlar (lazy + zoom + holatlar)
let observer = null;
function lazy(el, load) {
  if (!("IntersectionObserver" in window)) return load();
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          observer.unobserve(e.target);
          e.target._load?.();
        }
      }
    }, { rootMargin: "300px 0px" });
  }
  el._load = load;
  observer.observe(el);
}

function figureNode(b, ctx) {
  const fig = document.createElement("figure");
  fig.className = `att-fig${b.inline ? " att-fig--inline" : ""}`;
  fig.dataset.state = "loading";
  // SVG o'lchami pt'da — ekranda biroz kattaroq; maksimal kenglik CSS'da (overflow yo'q)
  const w = b.w ? Math.round(b.w * (b.id?.endsWith(".svg") ? 1.45 : 0.75)) : null;
  if (w) fig.style.setProperty("--att-fig-w", `${Math.min(w, 760)}px`);
  if (b.w && b.h) fig.style.setProperty("--att-fig-ratio", `${b.w} / ${b.h}`);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "att-fig__btn";
  btn.setAttribute("aria-label", "Rasmni kattalashtirish");
  btn.disabled = true;
  const img = document.createElement("img");
  img.alt = "Savolga oid rasm";
  img.decoding = "async";
  const status = document.createElement("span");
  status.className = "att-fig__status";
  status.textContent = "Rasm yuklanmoqda…";
  btn.append(img);
  fig.append(btn, status);
  lazy(fig, async () => {
    try {
      img.src = await figureUrl(ctx.testId, b.id, ctx.scope || "question");
      await img.decode().catch(() => {});
      fig.dataset.state = "ready";
      status.textContent = "";
      btn.disabled = false;
    } catch (e) {
      console.warn("[att] rasm:", b.id, e?.code || e);
      fig.dataset.state = "error";
      status.textContent = "Rasmni yuklab bo‘lmadi. Sahifani yangilang.";
    }
  });
  btn.addEventListener("click", () => {
    const big = document.createElement("img");
    big.src = img.src;
    big.alt = img.alt;
    big.className = "att-zoom__img";
    openModal({ title: "Rasm", content: big, className: "att-zoom" });
  });
  return fig;
}

/** Variant harflari bilan ro'yxat tugmalari uchun matn (ekran o'quvchilar) */
export function plainText(blocks) {
  const out = [];
  const walk = (bs) => (bs || []).forEach((b) => {
    if (b.text) out.push(b.text.replace(/\$([^$]*)\$/g, "$1").replace(/[*\\]/g, ""));
    if (b.t === "math") out.push(b.tex);
    if (b.t === "figure") out.push("[rasm]");
    if (b.blocks) walk(b.blocks);
    if (b.items) b.items.forEach(walk);
  });
  walk(blocks);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
