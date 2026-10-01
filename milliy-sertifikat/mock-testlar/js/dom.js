// Xavfsiz DOM yordamchilari: matn har doim textContent orqali qo'yiladi (innerHTML ishlatilmaydi).

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * h("div", { class: "x", onclick: fn, dataset: { i: 1 } }, "matn", childNode, [..])
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (key in el && typeof value !== "string") el[key] = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

let toastTimer = null;
export function toast(message) {
  let t = $("#toast");
  if (!t) {
    t = h("div", { id: "toast", class: "toast", role: "status", "aria-live": "polite" });
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

/** Tasdiqlash oynasi (window.confirm o'rniga). Promise<boolean> qaytaradi. */
export function confirmDialog({ title, message, confirmText = "Ha", cancelText = "Bekor qilish", danger = false }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const close = (value) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      if (previous && previous.focus) previous.focus();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(false); }
    };
    const okBtn = h("button", { type: "button", class: danger ? "btn btn-danger" : "btn btn-primary", onclick: () => close(true) }, confirmText);
    const overlay = h("div", { class: "modal confirm-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirmTitle", onclick: (e) => { if (e.target === overlay) close(false); } },
      h("div", { class: "modal-card modal-card--small" },
        h("div", { class: "modal-body confirm-body" },
          h("h3", { id: "confirmTitle" }, title),
          h("p", {}, message),
          h("div", { class: "confirm-actions" },
            h("button", { type: "button", class: "btn btn-ghost", onclick: () => close(false) }, cancelText),
            okBtn))));
    document.body.append(overlay);
    document.addEventListener("keydown", onKey, true);
    okBtn.focus();
  });
}

export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, "0")).join(":");
}

/** Sahifa pastidagi muallif ma'lumoti. */
export function authorFooter(site) {
  return h("footer", { class: "site-footer" },
    h("span", {}, "Muallif: ", h("b", {}, site.author)),
    h("span", { class: "dot", "aria-hidden": "true" }, "•"),
    h("span", {}, "Telegram: ", h("a", { href: site.telegramUrl, target: "_blank", rel: "noopener noreferrer" }, site.telegram)),
    h("span", { class: "dot", "aria-hidden": "true" }, "•"),
    h("span", {}, site.name));
}
