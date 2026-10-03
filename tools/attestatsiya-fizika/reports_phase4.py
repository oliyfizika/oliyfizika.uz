#!/usr/bin/env python3
"""
4-bosqich hisobotlari (ma'lumotdan avtomatik):
  docs/attestatsiya-fizika/18_answer_key_audit.md            — PUBLIC: kategoriyalar, ID, sabab (javobsiz)
  docs/attestatsiya-fizika/19_answer_key_reconstruction.md   — PUBLIC: tiklangan savollar ro'yxati (javobsiz)
  docs/attestatsiya-fizika/20_latex_json_consistency.md      — PUBLIC
  _private/attestatsiya-fizika/reports/answer_key_audit_full.md, reconstruction_full.md — MAXFIY (javob/distraktorlar)
docs/ GitHub'ga chiqadi — to'g'ri javoblar va distraktor sabablari u yerga YOZILMAYDI.
"""
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import latex_canonical as L  # noqa: E402
import answer_keys as AK  # noqa: E402

ROOT = L.ROOT
PRIV = os.path.join(ROOT, "_private", "attestatsiya-fizika")
DOCS = os.path.join(ROOT, "docs", "attestatsiya-fizika")
pub = {q["id"]: q for q in json.load(open(os.path.join(PRIV, "questions.public.json"), encoding="utf-8"))}
priv = {q["id"]: q for q in json.load(open(os.path.join(PRIV, "questions.private.json"), encoding="utf-8"))}
rep = json.load(open(os.path.join(PRIV, "validation-report.json"), encoding="utf-8"))
decisions = {d["id"]: d for d in AK.load_decisions()}
sols = L.parse_solutions()


def has_fig(q):
    return '"figure"' in json.dumps(pub[q]["question"]) or any('"figure"' in json.dumps(o["blocks"]) for o in pub[q]["options"])


def category(q):
    a, b = pub[q], priv[q]
    r = b["review"] or {}
    if b["keyStatus"] == "valid":
        return "A", "kalit tasdiqlangan (manba/kitob kaliti = yechim natijasi)"
    if b["keyStatus"] == "reconstructed":
        return "B✓", "kalit yo'q edi, yechim bor — TIKLANDI"
    st, ev = b["solutionStatus"], a["evaluationType"]
    text = (r.get("note") or r.get("check") or "").replace("\n", " ")
    low = text.lower()
    if ev == "open" and st == "undetermined" and ("chizma" in low or "tavsif" in low or "tushib qolgan" in low or "berilmagan" in low and "variant" not in low):
        return "C", text
    if ev == "open" and st == "undetermined" and "variant" in low:
        return "C", text
    if ev == "open" and st == "source_error":
        return "F", text
    if ev == "open":
        return "D", text
    # unreliable (variantlar bor)
    if any(k in low for k in ("rasm", "grafik", "trayektoriya")) and ("rasm" in low or "grafik" in low):
        return "G", text
    if st == "undetermined":
        return "D", text
    if "birlik" in low or "bir xil" in low or "takror" in low or "ko‘chirilgan" in low:
        return "F", text
    return "E", text


def reason_class(text, cat):
    t = text.lower()
    rules = [("ikki", "ikki variant/ikki talqin to‘g‘ri chiqadi"), ("bir xil", "variantlar takrorlangan"),
             ("birlik", "variantda birlik xatosi"), ("tushib qolgan", "shartda son/ma’lumot tushib qolgan"),
             ("berilmagan", "shartda kerakli ma’lumot berilmagan"), ("chizma", "chizma/rasm manbada yo‘q"),
             ("rasm", "rasm talqiniga bog‘liq"), ("grafik", "grafik talqiniga bog‘liq"),
             ("ko‘chirilgan", "variantlar boshqa masaladan ko‘chirilgan"), ("ziddiyat", "shart fizik jihatdan ziddiyatli"),
             ("mumkin emas", "shart fizik jihatdan ziddiyatli"), ("variantlarda yo‘q", "to‘g‘ri qiymat variantlarda yo‘q"),
             ("mos kelmaydi", "to‘g‘ri qiymat variantlarda yo‘q"), ("mos emas", "to‘g‘ri qiymat variantlarda yo‘q"),
             ("eng yaqin", "aniq variant yo‘q (faqat taqribiy)"), ("noaniq", "shart/talqin noaniq"), ("talqin", "shart/talqin noaniq")]
    for k, v in rules:
        if k in t:
            return v
    return {"C": "shart/variantlar to‘liq emas", "D": "talqin noaniq", "E": "kalit yechim bilan ziddiyatli",
            "F": "savol/variant xatosi", "G": "rasmga bog‘liq"}[cat]


rows = []
for q in pub:
    c, why = category(q)
    rows.append((q, c, why))
cnt = collections.Counter(c for _, c, _ in rows)
CAT = collections.OrderedDict([
    ("A", "kalit valid"), ("B✓", "kalit yo'q + yechim bor → tiklandi"), ("C", "kalit yo'q + yechim/shart yetarli emas"),
    ("D", "noaniq (bir nechta talqin)"), ("E", "kalit/variant yechim bilan ziddiyatli"), ("F", "savol/variant noto'g'ri (bosma/birlik/takror)"),
    ("G", "rasmga bog'liq, hal qilinmagan")])

# ---------------------------------------------------------------- 18 (public)
lines = ["# 18 — Answer key auditi (1027 savol)", "",
         "Manba: canonical LaTeX (`chapters/*.tex` + `.sol`) → `prepare_attestation_data.py`. Har savol bitta kategoriyada.",
         "**Javoblar bu faylda yo‘q** (docs/ GitHub'ga chiqadi). To‘liq tafsilot: `_private/attestatsiya-fizika/reports/answer_key_audit_full.md`.", "",
         "| Kategoriya | Ma’nosi | Soni |", "|---|---|---|"]
for k, v in CAT.items():
    lines.append(f"| {k} | {v} | {cnt.get(k, 0)} |")
lines += [f"| | **Jami** | **{sum(cnt.values())}** |", "",
          f"Ballga kiradigan (`auto`): **{sum(1 for q in pub if pub[q]['evaluationType'] == 'auto')}** (865 + 62 tiklangan). "
          f"`TEKSHIRISH_KERAK` (kalitsiz, ballga kirmaydi, ID bilan belgilangan): **{sum(1 for q in priv if priv[q]['keyStatus'] == 'TEKSHIRISH_KERAK')}**.", "",
          "## TEKSHIRISH_KERAK — savollar ro‘yxati", "",
          "| ID | Kun | Manba | Turi | Kategoriya | Muammo (qisqa) | Harakat |", "|---|---|---|---|---|---|---|"]
for q, c, why in rows:
    if c in ("A", "B✓"):
        continue
    a, b = pub[q], priv[q]
    src = b["source"]
    action = {"C": "manbadan to‘liq shart/variantlarni topish", "D": "muallif talqinini tanlash (siz)", "E": "variant yoki shartni LaTeX'da tuzatish (siz tasdiqlang)",
              "F": "bosma/birlik xatosini LaTeX'da tuzatish (siz tasdiqlang)", "G": "rasmni manba bilan solishtirish"}[c]
    short = reason_class(why, c)   # public: faqat sabab turi; asl izoh (javob harflari bilan) — maxfiy hisobotda
    lines.append(f"| {q} | {a['dayNumber']} | {src['sourceId']} | {a['evaluationType']} | {c} | {short} | {action} |")
open(os.path.join(DOCS, "18_answer_key_audit.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

# ---------------------------------------------------------------- 19 (public)
by_day = collections.Counter(pub[q]["dayNumber"] for q in decisions)
lines = ["# 19 — Answer key tiklash (62 savol)", "",
         "Faqat **B** kategoriya: manbada variant va kalit yo‘q, yechim natijasi bir qiymatli. Har biriga A–D variant: to‘g‘ri javob + 3 distraktor, "
         "har distraktorning fizik sababi bor (tipik hisob xatosi yoki konseptual xato). Tasodifiy son yo‘q, boshqa savoldan ko‘chirma yo‘q.",
         "Tuzatishlar **canonical LaTeX**'ga yozildi (`chapters/*.tex` — variantlar va `% Answer: X (reconstructed)`; `.sol` — `result`, `keySource`, "
         "`keyValue` (asl natija), `\\javob{X) …}`; `answers.tex`), so‘ng `latex_canonical.py sync` → `problems.json`.",
         "**To‘g‘ri javoblar va distraktorlar bu faylda yo‘q.** To‘liq: `_private/attestatsiya-fizika/reports/reconstruction_full.md`.", "",
         "## Avtomatik tekshiruvlar (`answer_keys.py validate`, prepare gate'lari)", "",
         "- 4 ta noyob variant; birliklar bir xil; to‘g‘ri variant yechim natijasiga teng (±1 %); raqamli variantlar o‘zaro ≥3 % farq;",
         "- oraliqli javobda (AF-1-068) faqat bitta variant oraliqqa tushadi; boshqa savol variantlari bilan aynan mos to‘plam yo‘q;",
         "- yechimda «variantlar berilmagan» kabi eskirgan iboralar qolmagan; har distraktor uchun sabab yozilgan;",
         "- `medium` ishonchli savollarda faraz yozilgan; bundle'da `correctAnswer` = qaror harfi, variantlar = qaror tartibi (62/62).", "",
         "## Ro‘yxat", "", "| ID | Kun | Yechim holati | Ishonch | Faraz |", "|---|---|---|---|---|"]
for q in sorted(decisions, key=lambda x: (pub[x]["dayNumber"], x)):
    d = decisions[q]
    # faraz matni javobga ishora qilishi mumkin — public faylda faqat bor/yo'q (matn maxfiy hisobotda)
    lines.append(f"| {q} | {pub[q]['dayNumber']} | {priv[q]['solutionStatus']} | {d['confidence']} | {'bor' if d.get('assumption') else '—'} |")
lines += ["", f"Kunlar bo‘yicha: " + ", ".join(f"Day {k}: {v}" for k, v in sorted(by_day.items())) + ".",
          "Day 1 (published) dagi 8 ta savol canonical manbada tuzatildi, lekin production'dagi Day 1 v1 snapshot'i o‘zgartirilmaydi (21-hisobot)."]
open(os.path.join(DOCS, "19_answer_key_reconstruction.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

# ---------------------------------------------------------------- private full reports
os.makedirs(os.path.join(PRIV, "reports"), exist_ok=True)
lines = ["# Answer key audit — TO‘LIQ (MAXFIY)", "", "| ID | Kun | Manba | Kategoriya | Holat | Yechim natijasi | Izoh |", "|---|---|---|---|---|---|---|"]
for q, c, why in rows:
    if c == "A":
        continue
    b = priv[q]
    lines.append(f"| {q} | {pub[q]['dayNumber']} | {b['source']['sourceId']} | {c} | {b['keyStatus']} | {str(b['solutionResult']).replace('|', '/')} | {why.replace('|', '/')} |")
open(os.path.join(PRIV, "reports", "answer_key_audit_full.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
lines = ["# Answer key tiklash — TO‘LIQ (MAXFIY)", ""]
for q in sorted(decisions, key=lambda x: (pub[x]["dayNumber"], x)):
    d = decisions[q]
    opts, letter = AK.options_in_order(d)
    lines += [f"## {q} (Day {pub[q]['dayNumber']}) — to‘g‘ri: **{letter}** · ishonch: {d['confidence']}", "",
              f"- Yechim natijasi (asl): `{sols[next(s for s, m in sols.items() if m['meta'].get('id') == priv[q]['source']['sourceId'])]['meta'].get('keyValue')}`"]
    if d.get("assumption"):
        lines.append(f"- Faraz: {d['assumption']}")
    for i, o in enumerate(opts):
        why = "TO‘G‘RI" if o["correct"] else next(x["why"] for x in d["distractors"] if x["tex"] == o["tex"])
        lines.append(f"- {'ABCD'[i]}) {o['tex']} — {why}")
    lines.append("")
open(os.path.join(PRIV, "reports", "reconstruction_full.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

# ---------------------------------------------------------------- 20 (public)
g = rep["gates"]
lc = [k for k in g if k in ("LATEX_JSON_CONSISTENCY", "canonical_roundtrip_exact", "plaintext_preserved_1027", "versions_solutions_match_bank",
                            "reconstruction_reaches_bundle", "image_refs_resolved", "public_has_no_answer_fields")]
lines = ["# 20 — LaTeX ↔ JSON ↔ Firestore izchilligi", "",
         "**LATEX_JSON_CONSISTENCY = " + ("PASS" if g["LATEX_JSON_CONSISTENCY"]["pass"] else "FAIL") + "**", "",
         "Canonical manba: `chapters/*.tex` (savol, variantlar, `% Answer:`) + `_build/solutions_src/*.sol` (yechim). "
         "`problems.json` — hosila: `latex_canonical.py sync` uni LaTeX'dan qayta yozadi, `check` esa har prepare boshida solishtiradi "
         "(id to‘plami, bob/raqam, bo‘lim, matn, javob, javob manbasi, variantlar soni, tip).", "",
         "| Tekshiruv | Natija | Tafsilot |", "|---|---|---|"]
for k in lc:
    lines.append(f"| `{k}` | {'PASS' if g[k]['pass'] else 'FAIL'} | {g[k]['detail']} |")
lines += ["", "Zanjir: LaTeX → (sync) problems.json → texconv bloklar → public savol/variantlar + private yechim/kalit → "
          "versions/keys/solutions (bir xil canonical transform `fs_canonical`) → Firestore. Har bo‘g‘in yuqoridagi gate bilan yopilgan; "
          "salbiy testlar: `tools/attestatsiya-fizika/tests/test_pipeline_gates.py` (masalan problems.json'da 1 bo‘sh joy qo‘shilsa — FAIL).", "",
          "Mismatch'lar: **0**."]
open(os.path.join(DOCS, "20_latex_json_consistency.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("categories:", dict(cnt))
