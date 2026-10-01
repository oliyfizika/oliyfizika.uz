// Qulay (accessible) modal: role="dialog", fokus tuzog'i, Esc, fokusni qaytarish.
import { icon } from "./icons.js";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let idSeq = 0;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.text]
 * @param {string} [opts.iconName]
 * @param {HTMLElement|string} [opts.content]   qo'shimcha kontent (DOM yoki xavfsiz HTML)
 * @param {{label:string, variant?:string, onClick?:Function, href?:string}[]} [opts.actions]
 * @param {boolean} [opts.dismissible=true]
 * @param {Function} [opts.onClose]
 * @returns {{ close: Function, dialog: HTMLElement }}
 */
export function openModal({ title, text = "", iconName, content, actions = [], dismissible = true, onClose, className = "" }) {
  const previousFocus = document.activeElement;
  const id = `of-modal-${++idSeq}`;

  const root = document.createElement("div");
  root.className = `of-modal of-chrome ${className}`.trim();
  root.innerHTML = `
    <div class="of-modal__backdrop" data-close></div>
    <div class="of-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-title" ${text ? `aria-describedby="${id}-text"` : ""}>
      ${dismissible ? `<button type="button" class="of-icon-btn of-modal__close" data-close aria-label="Yopish">${icon("close")}</button>` : ""}
      ${iconName ? `<div class="of-modal__icon">${icon(iconName)}</div>` : ""}
      <h2 class="of-modal__title" id="${id}-title"></h2>
      ${text ? `<p class="of-modal__text" id="${id}-text"></p>` : ""}
      <div class="of-modal__body"></div>
      ${actions.length ? '<div class="of-modal__actions"></div>' : ""}
    </div>`;

  root.querySelector(".of-modal__title").textContent = title;
  if (text) root.querySelector(".of-modal__text").textContent = text;

  const body = root.querySelector(".of-modal__body");
  if (content instanceof HTMLElement) body.append(content);
  else if (typeof content === "string") body.innerHTML = content;
  else body.remove();

  const actionsBox = root.querySelector(".of-modal__actions");
  actions.forEach((action) => {
    const el = document.createElement(action.href ? "a" : "button");
    el.className = `of-btn of-btn--lg of-btn--block ${action.variant ? `of-btn--${action.variant}` : ""}`;
    el.textContent = action.label;
    if (action.href) el.href = action.href;
    else el.type = "button";
    el.addEventListener("click", (event) => action.onClick?.(event, api));
    actionsBox.append(el);
  });

  const dialog = root.querySelector(".of-modal__dialog");
  let closed = false;

  function close(reason = "api") {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    root.remove();
    if (!document.querySelector(".of-modal")) document.body.classList.remove("of-scroll-lock");
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus({ preventScroll: true });
    onClose?.(reason);
  }

  function onKey(event) {
    if (event.key === "Escape" && dismissible) {
      event.stopPropagation();
      close("escape");
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (dismissible) root.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", () => close("dismiss")));
  document.addEventListener("keydown", onKey, true);
  document.body.append(root);
  document.body.classList.add("of-scroll-lock");

  const firstAction = actionsBox?.querySelector(".of-btn") || dialog.querySelector(FOCUSABLE);
  requestAnimationFrame(() => (firstAction || dialog).focus({ preventScroll: true }));

  const api = { close, dialog };
  return api;
}
