// ==========================================================================
// Real imtihonlar — yupqa (thin) renderer.
//
// Nega Attestatsiya render.js to'g'ridan-to'g'ri ishlatilmaydi:
//   • u api.js ni import qiladi (Attestatsiya Firestore/Storage yo'llariga bog'langan figureUrl);
//   • uning inline() funksiyasi *…* va **…** ni markdown deb talqin qiladi — manba savol matni
//     (PDF dan so'zma-so'z) hech qanday belgisi o'zgarmasdan chiqishi kerak.
// Shu sabab shu yerda kichik, mustaqil renderer: KaTeX lokal vendor'dan (Attestatsiya loadKatex bilan
// bir xil yo'l va sozlamalar), matn faqat textContent orqali (innerHTML yo'q), KaTeX trust:false.
// Attestatsiya production kodi o'zgartirilmagan.
// ==========================================================================

const KATEX_BASE = new URL("../../../vendor/katex/", import.meta.url).href;
let katexPromise = null;

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

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function mathNode(tex) {
  const span = el("span", "rx-math");
  if (window.katex) {
    try {
      window.katex.render(tex, span, { displayMode: false, throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
      return span;
    } catch { /* pastda matn */ }
  }
  span.textContent = `$${tex}$`;
  return span;
}

/**
 * Inline matn -> DocumentFragment.
 *  source  (standart): faqat $…$ formula va \n. Boshqa hech bir belgi talqin qilinmaydi (manba matni).
 *  markdown:true (faqat audit yechim matni uchun): qo'shimcha **qalin** va `kod`.
 */
export function inline(text, { markdown = false } = {}) {
  const frag = document.createDocumentFragment();
  const s = String(text ?? "");
  let buf = "";
  let target = frag;
  const stack = [frag];
  const flush = () => {
    if (!buf) return;
    buf.split("\n").forEach((part, i) => {
      if (i) target.append(document.createElement("br"));
      if (part) target.append(document.createTextNode(part));
    });
    buf = "";
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "$") {
      const j = s.indexOf("$", i + 1);
      if (j === -1) { buf += s.slice(i); break; }
      flush();
      target.append(mathNode(s.slice(i + 1, j)));
      i = j;
    } else if (markdown && c === "*" && s[i + 1] === "*") {
      flush();
      if (target !== frag && target.tagName === "STRONG") { stack.pop(); target = stack[stack.length - 1]; }
      else { const b = el("strong"); target.append(b); stack.push(b); target = b; }
      i++;
    } else if (markdown && c === "`") {
      const j = s.indexOf("`", i + 1);
      if (j === -1) { buf += c; continue; }
      flush();
      target.append(el("code", "rx-code", s.slice(i + 1, j)));
      i = j;
    } else {
      buf += c;
    }
  }
  flush();
  return frag;
}

function para(text, cls, opts) {
  const p = el("p", cls);
  p.append(inline(text, opts));
  return p;
}

/**
 * Manba savoli (PDF dan so'zma-so'z): matn, jadval, chizmalar, variantlar, qismlar.
 * @param {object} q  questions.json elementi
 * @param {{ figureUrl:(fig)=>Promise<string> }} ctx
 */
export function renderQuestion(q, ctx) {
  const box = el("div", "rx-q");
  if (q.matchGroup?.stem) {
    const g = el("div", "rx-q__group");
    g.append(el("p", "rx-q__group-label", "Umumiy shart (33–35)"));
    g.append(para(q.matchGroup.stem, "rx-q__text"));
    box.append(g);
  }
  box.append(para(q.questionText, "rx-q__text"));
  for (const t of q.tables || []) box.append(renderTable(t));
  const stemFigs = (q.figures || []).filter((f) => !/^option-|^part-/.test(f.role));
  if (stemFigs.length) box.append(renderFigures(stemFigs, ctx));
  if (q.options?.length) {
    const ol = el("ol", "rx-opts");
    ol.setAttribute("aria-label", "Variantlar");
    for (const o of q.options) {
      const li = el("li", "rx-opt");
      li.dataset.key = o.key;
      const k = el("span", "rx-opt__key", `${o.key})`);
      const body = el("span", "rx-opt__text");
      body.append(inline(o.text));
      li.append(k, body);
      if (o.sourceLabel && o.sourceLabel !== o.key) {
        li.append(el("span", "rx-opt__label-note", `PDF da «${o.sourceLabel})» deb bosilgan`));
      }
      const figs = (q.figures || []).filter((f) => f.role === `option-${o.key}`);
      if (figs.length) li.append(renderFigures(figs, ctx));
      ol.append(li);
    }
    box.append(ol);
  }
  if (q.parts?.length) {
    const ol = el("ol", "rx-parts");
    for (const p of q.parts) {
      const li = el("li", "rx-part");
      li.append(el("span", "rx-opt__key", `${p.key})`));
      const body = el("span", "rx-opt__text");
      body.append(inline(p.text));
      li.append(body);
      const figs = (q.figures || []).filter((f) => f.role === `part-${p.key}`);
      if (figs.length) li.append(renderFigures(figs, ctx));
      ol.append(li);
    }
    box.append(ol);
  }
  return box;
}

function renderTable(t) {
  const wrap = el("div", "rx-table-wrap");
  const table = el("table", "rx-table");
  if (t.caption) table.append(el("caption", null, t.caption));
  const tb = el("tbody");
  for (const row of t.rows || []) {
    const tr = el("tr");
    for (const cell of row.c || []) {
      const td = el("td");
      td.append(inline(cell));
      tr.append(td);
    }
    tb.append(tr);
  }
  table.append(tb);
  wrap.append(table);
  return wrap;
}

function renderFigures(figs, ctx) {
  const wrap = el("div", "rx-figs");
  for (const f of figs) {
    const fig = el("figure", "rx-fig");
    fig.dataset.figureId = f.figureId;
    const img = el("img");
    img.alt = `${f.questionNumber}-savol chizmasi`;
    img.loading = "lazy";
    img.decoding = "async";
    fig.append(img);
    wrap.append(fig);
    Promise.resolve(ctx?.figureUrl?.(f)).then((url) => {
      if (url) img.src = url; else throw new Error("no url");
    }).catch(() => {
      fig.classList.add("rx-fig--error");
      fig.textContent = "Chizmani yuklab bo‘lmadi.";
    });
  }
  return wrap;
}

const BLOCK_CLASS = { given: "rx-b rx-b--given", answer: "rx-b rx-b--answer", note: "rx-b rx-b--note", step: "rx-b", plain: "rx-b" };

/** Audit yechim bloklari (matn o'zgarmagan holda). */
export function renderSolutionBlocks(blocks) {
  const frag = document.createDocumentFragment();
  for (const b of blocks || []) {
    const div = el("div", BLOCK_CLASS[b.t] || "rx-b");
    if (b.label) div.append(el("p", "rx-b__label", b.label));
    if (b.text) div.append(para(b.text, "rx-b__text", { markdown: true }));
    if (b.items?.length) {
      const ul = el("ul", "rx-b__list");
      for (const it of b.items) {
        const li = el("li");
        li.append(inline(it, { markdown: true }));
        ul.append(li);
      }
      div.append(ul);
    }
    frag.append(div);
  }
  return frag;
}
