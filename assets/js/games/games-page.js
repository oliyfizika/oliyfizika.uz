// ==========================================================================
// Interaktiv o'yinlar — katalog sahifasi. O'yin kodlari bu yerda YUKLANMAYDI.
// Faqat ikonlar, kirish animatsiyasi va o'yinlarning o'zi shu brauzerda saqlagan rekordlari
// (kartadagi data-record kaliti: Formulani top, Birlikni top, Formula qur — eng yaxshi foiz;
//  Nishonga ur va Muvozanat — bosqichlarda yig‘ilgan jami yulduzlar).
// Qidiruv — qobiqning deklarativ qidiruvi (data-shell-search, [data-search-item]).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { revealOnScroll } from "../ui/reveal.js";

document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

document.querySelectorAll("[data-record]").forEach((el) => {
  let value = 0;
  try { value = parseInt(localStorage.getItem(el.dataset.record), 10) || 0; } catch { /* storage yo'q */ }
  if (value > 0) {
    el.textContent = `Rekord: ${value}${el.dataset.recordUnit ? ` ${el.dataset.recordUnit}` : ""}`;
    el.hidden = false;
  }
});

revealOnScroll(document.querySelectorAll("#gamesList > li"));
