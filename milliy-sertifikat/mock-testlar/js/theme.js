// Yorug'/qorong'i mavzu (sayt uslubiga mos ravishda standart: qorong'i).
import { readPref, writePref } from "./storage.js";

export function initTheme(button) {
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    if (button) {
      button.textContent = theme === "dark" ? "☀️" : "🌙";
      button.setAttribute("aria-label", theme === "dark" ? "Yorug‘ rejim" : "Qorong‘i rejim");
      button.title = button.getAttribute("aria-label");
    }
  };
  apply(readPref("theme", "dark"));
  button?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    writePref("theme", next);
    apply(next);
  });
}
