// Simulyatsiyalar katalogi ma'lumotini (manifest.json, curriculum.json) tanlangan tilga o'tkazish.
// O'zbekcha manba o'zgarmaydi; tarjima `simulations/data/i18n/<til>/<fayl>.json` da. Topilmasa — o'zbekcha matn.
import { currentLang } from "../core/i18n.js";

const BASE = new URL("../../../simulations/data/i18n/", import.meta.url);

async function overlay(name) {
  if (currentLang === "uz") return null;
  try {
    const res = await fetch(new URL(`${currentLang}/${name}`, BASE).href, { cache: "no-cache" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const str = (v) => (typeof v === "string" && v.trim() ? v : null);

/** manifest.json -> tarjima qo'shilgan nusxa. */
export async function localizeManifest(data) {
  const ov = await overlay("manifest.json");
  if (!ov) return data;
  return {
    ...data,
    topics: data.topics.map((t) => ({ ...t, title: str(ov.topics?.[t.id]) || t.title })),
    simulations: data.simulations.map((s) => {
      const o = ov.simulations?.[s.id];
      if (!o) return s;
      return {
        ...s,
        title: str(o.title) || s.title,
        description: str(o.description) || s.description,
        keywords: str(o.keywords) ? `${o.keywords} ${s.keywords || ""}` : s.keywords,
        params: Array.isArray(o.params) && o.params.length === (s.params || []).length ? o.params : s.params,
      };
    }),
  };
}

/** curriculum.json -> tarjima qo'shilgan nusxa (sinf/bob/mavzu tartibi bo'yicha). */
export async function localizeCurriculum(cur) {
  const ov = cur && (await overlay("curriculum.json"));
  if (!ov) return cur;
  return {
    ...cur,
    sinflar: cur.sinflar.map((g, gi) => {
      const og = ov.sinflar?.[gi];
      if (!og || og.sinf !== g.sinf) return g;
      return {
        ...g,
        fan: str(og.fan) || g.fan,
        boblar: g.boblar.map((b, bi) => {
          const ob = og.boblar?.[bi];
          if (!ob) return b;
          return {
            ...b,
            nom: str(ob.nom) || b.nom,
            mavzular: b.mavzular.map((m, mi) => {
              const om = ob.mavzular?.[mi];
              return om && om.raqam === m.raqam && str(om.nom) ? { ...m, nom: om.nom } : m;
            }),
          };
        }),
      };
    }),
  };
}
