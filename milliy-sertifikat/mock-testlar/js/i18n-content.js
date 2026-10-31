// Mock test matnlarini tanlangan tilga o'tkazish (ru | en).
// O'zbekcha manba fayl (data/mock-test-N.json) o'zgarmaydi: javoblar, ballar va tekshiruv shu faylga tayanadi.
// Tarjima `data/i18n/<til>/mock-test-N.json` da — faqat matnli maydonlar: savollar `n` bo'yicha,
// variantlar tartib raqami bo'yicha, ochiq savol qismlari `key` bo'yicha qo'shiladi.
// Tarjima fayli topilmasa — o'zbekcha matn ko'rsatiladi.
import { currentLang } from "../../../assets/js/core/i18n.js";

const I18N_BASE = new URL("../data/i18n/", import.meta.url);

/** Tarjima faylini yuklaydi (o'zbek tilida yoki fayl bo'lmasa — null). */
export async function fetchOverlay(entryFile) {
  if (currentLang === "uz") return null;
  const name = String(entryFile).split("/").pop();
  try {
    const res = await fetch(new URL(`${currentLang}/${name}`, I18N_BASE).href, { cache: "no-cache" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const str = (v) => (typeof v === "string" && v.trim() ? v : null);

function mergeOption(orig, tr) {
  const text = typeof tr === "string" ? tr : tr?.text;
  if (!str(text)) return orig;
  return typeof orig === "string" ? text : { ...orig, text };
}

/** Manba testga tarjimani qo'shadi (o'zgartirilgan nusxa qaytaradi). */
export function applyOverlay(test, overlay) {
  if (!overlay || !test) return test;
  const out = { ...test };
  for (const k of ["title", "subtitle", "sourceVariant"]) if (str(overlay[k])) out[k] = overlay[k];
  if (test.formulaSheet && overlay.formulaSheet?.cards) {
    out.formulaSheet = {
      ...test.formulaSheet,
      cards: test.formulaSheet.cards.map((card, i) => {
        const tr = overlay.formulaSheet.cards[i];
        if (!tr) return card;
        return {
          ...card,
          title: str(tr.title) || card.title,
          formulas: card.formulas.map((f, k) => str(tr.formulas?.[k]) || f),
        };
      }),
    };
  }
  const byN = new Map((overlay.questions || []).map((q) => [q.n, q]));
  out.questions = test.questions.map((q) => {
    const tr = byN.get(q.n);
    if (!tr) return q;
    const next = { ...q };
    for (const k of ["text", "note", "reaction"]) if (str(tr[k])) next[k] = tr[k];
    if (q.options && Array.isArray(tr.options)) next.options = q.options.map((o, i) => mergeOption(o, tr.options[i]));
    if (q.parts && Array.isArray(tr.parts)) {
      next.parts = q.parts.map((p) => {
        const tp = tr.parts.find((x) => x.key === p.key);
        if (!tp) return p;
        const np = { ...p };
        for (const k of ["text", "hint"]) if (str(tp[k])) np[k] = tp[k];
        if (typeof tp.unit === "string" && p.unit) np.unit = tp.unit;
        return np;
      });
    }
    return next;
  });
  return out;
}
