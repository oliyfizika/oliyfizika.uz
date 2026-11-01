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
import { STRINGS_ATT_A } from "./i18n-att-a.js";
import { STRINGS_ATT_B } from "./i18n-att-b.js";
import { STRINGS_ATT_C } from "./i18n-att-c.js";
import { STRINGS_SIM } from "./i18n-sim.js";
import { STRINGS_AUTH } from "./i18n-auth.js";

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
const dict = { ...(STRINGS_AUTH[lang] || {}), ...(STRINGS[lang] || {}), ...(STRINGS_UF[lang] || {}), ...(STRINGS_MS[lang] || {}),
  ...(STRINGS_ATT_A[lang] || {}), ...(STRINGS_ATT_B[lang] || {}), ...(STRINGS_ATT_C[lang] || {}), ...(STRINGS_SIM[lang] || {}) };

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

/**
 * Katta sahifalar (simulyatsiyalar) uchun: kalit — o'zbekcha matnning o'zi.
 *   tr("Gidravlik press")  /  tr("Kuch {F} N", { F: 12 })  — tarjima topilmasa, o'zbekcha matn.
 * Lug'at: assets/i18n/<til>/<nom>.json ({ "o'zbekcha matn": "tarjima" }), `loadNs(nom)` bilan yuklanadi.
 */
export function tr(uz, vars) {
  let text = lang === "uz" ? uz : (dict[uz] ?? uz);
  if (vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return text;
}

const DOM_ATTRS = ["aria-label", "title", "placeholder", "alt"];
const norm = (v) => v.replace(/\s+/g, " ").trim();

/** Sahifadagi statik matn va atributlarni (kalit — o'zbekcha matn) tarjima lug'ati bo'yicha almashtiradi. */
export function translateDom(root = document.body) {
  if (lang === "uz" || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && !/^(SCRIPT|STYLE|CANVAS)$/.test(n.parentElement.tagName) && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const hit = dict[norm(n.nodeValue)];
    if (hit != null) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), hit);
  }
  root.querySelectorAll(DOM_ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => {
    for (const a of DOM_ATTRS) {
      const v = el.getAttribute(a);
      if (v && dict[norm(v)] != null) el.setAttribute(a, dict[norm(v)]);
    }
  });
  const title = dict[norm(document.title)];
  if (title != null) document.title = title;
}

/**
 * Sahifaga xos tarjima lug'atini yuklaydi: assets/i18n/<til>/<nom>.json (kalit -> matn).
 * Katta simulyatsiya sahifalari uchun: modul boshida `await loadNs("sim-fluid")`.
 * O'zbek tilida yoki fayl bo'lmasa — hech narsa qilmaydi (t() o'zbekcha fallback qaytaradi).
 */
export async function loadNs(...names) {
  if (lang === "uz") return;
  await Promise.all(names.map(async (name) => {
    try {
      const res = await fetch(new URL(`../../i18n/${lang}/${name}.json`, import.meta.url).href, { cache: "no-cache" });
      if (res.ok) Object.assign(dict, await res.json());
    } catch { /* tarjima yo'q — o'zbekcha */ }
  }));
  applyI18n();
  translateDom();
}

/** Mavzu belgisi: «5-mavzu» / «Тема 5» / «Topic 5». */
export function topicLabel(number) {
  return lang === "ru" ? `Тема ${number}` : lang === "en" ? `Topic ${number}` : `${number}-mavzu`;
}
