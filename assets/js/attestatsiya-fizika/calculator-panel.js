// ==========================================================================
// Attestatsiya → Fizika: kunlik test sahifasidagi ilmiy kalkulyator — Milliy sertifikat mock testidagi
// MAVJUD kalkulyatorning yupqa adaptori (mantiq qayta yozilmagan, nusxa ko'chirilmagan):
//   milliy-sertifikat/mock-testlar/js/calculator.js → initCalculator(root) / handleKey(e)
// Mock testdagi xatti-harakat saqlanadi: bir marta ishga tushiriladi (ifoda yopib-ochganda saqlanadi), klaviatura
// faqat oyna ochiq bo'lganda, Esc yopadi. Oyna — OliyFizika 2.0 modal komponenti (fokus tuzog'i, fokusni qaytarish).
// Faqat brauzer xotirasi: Firestore, urinish, javoblar, taymer va baholashga hech qanday aloqasi yo'q.
// ==========================================================================
import { initCalculator } from "../../../milliy-sertifikat/mock-testlar/js/calculator.js";
import { openModal } from "../ui/modal.js";

// Mock testdagi #calcBtn ikonkasining o'zi
export const CALC_ICON = '<svg class="of-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>';

let body = null;          // kalkulyator DOM (bir marta yaratiladi)
let calc = null;          // { handleKey }
let modal = null;         // ochiq modal api

function onKey(e) {
  if (!modal) return;
  if (e.key === "Escape" || e.key === "Tab") return;   // modal komponenti boshqaradi
  if (calc.handleKey(e)) e.stopPropagation();          // test sahifasining tugmalariga yetib bormaydi
}

export function openCalculator(trigger) {
  if (modal) return modal;
  if (!body) {
    body = document.createElement("div");
    body.className = "att-calc";
    calc = initCalculator(body);
  }
  trigger?.setAttribute("aria-expanded", "true");
  modal = openModal({
    title: "Ilmiy kalkulyator",
    content: body,
    className: "att-calc-modal",
    onClose: () => {
      document.removeEventListener("keydown", onKey, true);
      trigger?.setAttribute("aria-expanded", "false");
      modal = null;
    },
  });
  document.addEventListener("keydown", onKey, true);
  return modal;
}

export function closeCalculator() {
  modal?.close("api");
}

/** Tugmani ulaydi (bosish — ochish; oyna ochiq bo'lsa — yopish). */
export function bindCalculatorButton(button) {
  if (!button) return;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => (modal ? closeCalculator() : openCalculator(button)));
}
