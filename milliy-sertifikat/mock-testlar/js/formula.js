// Formula jadvali: rasm sahifalar (kattalashtirish bilan) va/yoki matnli formula kartalari.
import { h, clear } from "./dom.js";

export function initFormulaSheet(root, sheet, resolveUrl) {
  const pages = sheet?.pages || [];
  const cards = sheet?.cards || [];
  clear(root);
  if (!pages.length && !cards.length) {
    root.append(h("p", { class: "muted" }, "Bu test uchun formula jadvali mavjud emas."));
    return;
  }

  const pagesView = h("div", { class: "formula-pages" },
    pages.map((src, i) => h("img", { class: "formula-img", src: resolveUrl(src), alt: `Formula jadvali — ${i + 1}-sahifa`, loading: "lazy", decoding: "async" })));

  const cardsView = h("div", { class: "formula-grid" },
    cards.map((group) => h("div", { class: "formula-card" },
      h("h4", {}, group.title),
      group.formulas.map((f) => h("p", {}, f)))));

  let zoomed = false;
  const zoomBtn = h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => {
    zoomed = !zoomed;
    pagesView.classList.toggle("zoomed", zoomed);
    zoomBtn.textContent = zoomed ? "↙ Moslashtirish" : "🔎 Kattalashtirish";
  } }, "🔎 Kattalashtirish");

  const toolbar = h("div", { class: "formula-toolbar" });
  const views = [];
  if (pages.length) views.push({ label: "📄 Formula jadvali", el: pagesView, tools: [zoomBtn] });
  if (cards.length) views.push({ label: "🧾 Qisqa formulalar", el: cardsView, tools: [] });

  const tabs = views.map((v, i) => h("button", { type: "button", class: "tab", role: "tab", "aria-selected": String(i === 0), onclick: () => select(i) }, v.label));
  const toolSlot = h("div", { class: "formula-tools" });
  if (views.length > 1) toolbar.append(h("div", { class: "tabs", role: "tablist" }, tabs));
  toolbar.append(toolSlot);

  function select(i) {
    views.forEach((v, k) => { v.el.hidden = k !== i; tabs[k].setAttribute("aria-selected", String(k === i)); });
    toolSlot.replaceChildren(...views[i].tools);
  }

  root.append(toolbar, ...views.map((v) => v.el));
  select(0);
}
