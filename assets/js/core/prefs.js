// Foydalanuvchi sozlamalari (faqat shu brauzer uchun) — xavfsiz localStorage o'rami.
// Maxfiy rejim yoki bloklangan storage'da ham xato bermaydi.

const PREFIX = "oliyfizika:";

export function readPref(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage mavjud emas — jim o'tkazamiz */
  }
}

/* ---------------- Tema: light | dark | system (standart: light) ---------------- */

const THEME_KEY = "theme";
const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

export function getThemePref() {
  const value = readPref(THEME_KEY, "light");
  return ["light", "dark", "system"].includes(value) ? value : "light";
}

export function resolveTheme(pref = getThemePref()) {
  if (pref === "system") return media?.matches ? "dark" : "light";
  return pref;
}

export function applyTheme(pref = getThemePref()) {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setThemePref(pref) {
  writePref(THEME_KEY, pref);
  applyTheme(pref);
  document.dispatchEvent(new CustomEvent("of:themechange", { detail: { pref } }));
}

media?.addEventListener?.("change", () => {
  if (getThemePref() === "system") applyTheme("system");
});
