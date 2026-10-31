// Formula jadvali: rasm sahifalar (kattalashtirish bilan) va/yoki matnli formula kartalari.
import { h, clear } from "./dom.js";
import { t } from "../../../assets/js/core/i18n.js";

export function initFormulaSheet(root, sheet, resolveUrl) {
  const pages = sheet?.pages || [];
  const cards = sheet?.cards || [];
  clear(root);
  if (!pages.length && !cards.length) {
    root.append(h("p", { class: "muted" }, t("ms.f.none", "Bu test uchun formula jadvali mavjud emas.")));
    return;
  }

  const pagesView = h("div", { class: "formula-pages" },
    pages.map((src, i) => h("img", { class: "formula-img", src: resolveUrl(src), alt: t("ms.f.page", `Formula jadvali — ${i + 1}-sahifa`, { n: i + 1 }), loading: "lazy", decoding: "async" })));

  const cardsView = h("div", { class: "formula-grid" },
    cards.map((group) => h("div", { class: "formula-card" },
      h("h4", {}, group.title),
      group.formulas.map((f) => h("p", {}, f)))));

  let zoomed = false;
  const zoomBtn = h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => {
    zoomed = !zoomed;
    pagesView.classList.toggle("zoomed", zoomed);
    zoomBtn.textContent = zoomed ? t("ms.f.zoomOut", "↙ Moslashtirish") : t("ms.f.zoomIn", "🔎 Kattalashtirish");
  } }, t("ms.f.zoomIn", "🔎 Kattalashtirish"));

  const toolbar = h("div", { class: "formula-toolbar" });
  const views = [];
  if (pages.length) views.push({ label: t("ms.f.tabPages", "📄 Formula jadvali"), el: pagesView, tools: [zoomBtn] });
  if (cards.length) views.push({ label: t("ms.f.tabCards", "🧾 Qisqa formulalar"), el: cardsView, tools: [] });

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
