// OliyFizika.uz — ko'p tillilik (uz | ru | en). Standart: o'zbek (lotin).
//
// Matnlar HTML da o'zbekcha qoladi; rus/ingliz tarjimalari `i18n-strings.js` lug'atida.
//   <h2 data-i18n="home.sections">Bo‘limlar</h2>                    — textContent almashtiriladi
//   <button data-i18n-attr="aria-label:home.pause">…</button>         — atributlar (vergul bilan bir nechta)
//   JS: t("nav.home", "Bosh sahifa")  — tarjima topilmasa, o'zbekcha matn (fallback) qaytadi.
// Til almashtirilganda sahifa qayta yuklanadi (eski matnlarni tiklash shart emas).

import { readPref, writePref } from "./prefs.js";
import { STRINGS } from "./i18n-strings.js";
import { STRINGS_UF } from "./i18n-uf.js";
import { STRINGS_MS } from "./i18n-ms.js";

export const LANGS = [
  { code: "uz", short: "O‘z", label: "O‘zbekcha" },
  { code: "ru", short: "Ру", label: "Русский" },
  { code: "en", short: "En", label: "English" },
];

export function getLang() {
  const value = readPref("lang", "uz");
  return LANGS.some((l) => l.code === value) ? value : "uz";
}

export function setLang(code) {
  if (!LANGS.some((l) => l.code === code) || code === getLang()) return;
  writePref("lang", code);
  location.reload();
}

const lang = getLang();
const dict = { ...(STRINGS[lang] || {}), ...(STRINGS_UF[lang] || {}), ...(STRINGS_MS[lang] || {}) };

/** Tarjima. `{name}` ko'rinishidagi o'rinlar `vars` dan to'ldiriladi. */
export function t(key, fallback = "", vars) {
  let text = lang === "uz" ? fallback : (dict[key] ?? fallback);
  if (vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return text;
}

/** [data-i18n] va [data-i18n-attr] elementlarini tanlangan tilga o'tkazadi. */
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  if (lang === "uz") return;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = dict[el.dataset.i18n];
    if (text != null) el.textContent = text;
  });
  // Ishonchli (o'zimizning lug'at) HTML kerak bo'lgan joylar: <b> kabi belgilar bilan
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const text = dict[el.dataset.i18nHtml];
    if (text != null) el.innerHTML = text;
  });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(",").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && dict[key] != null) el.setAttribute(attr, dict[key]);
    });
  });
}

export const currentLang = lang;

/** Mavzu belgisi: «5-mavzu» / «Тема 5» / «Topic 5». */
export function topicLabel(number) {
  return lang === "ru" ? `Тема ${number}` : lang === "en" ? `Topic ${number}` : `${number}-mavzu`;
}
