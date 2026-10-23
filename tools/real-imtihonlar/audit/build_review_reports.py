#!/usr/bin/env python3
"""Sarvar ko'rib chiqishi uchun ikki hisobot. FAQAT O'QIYDI — mavjud fayllar o'zgarmaydi, faqat yangi fayllar yoziladi.

  python3 tools/real-imtihonlar/audit/build_review_reports.py

1) HIGH 7 savol: to'liq savol + variantlar/qismlar + manba kaliti (PDF) + mustaqil audit javobi + joriy yechim + manba metadata.
   -> _private/real-imtihonlar/audit/high-review-detail.{md,json}
2) Qo'shimcha nomzodlar (29.09): #31/#32 qisqa ro'yxatining to'liq jadvali, rasmga bog'liqlar alohida,
   rasm bo'yicha qo'shimcha takror tekshiruvi (bitta nusxa qoidasi saqlanadi).
   -> _private/real-imtihonlar/audit/supplement-shortlist-review.{md,json}
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
AUD = os.path.join(PRIV, "audit")
STATUS_RE = re.compile(r"^(KEY MISSING|VERIFIED|NEEDS MANUAL REVIEW|AMBIGUOUS|KEY ERROR|OCR|SOURCE ERROR|NO CORRECT|EXCLUDED)")


def key_rows(eid):
    """Javob kaliti auditi jadvalidan (NN_REAL-…md) shu imtihon qatorlari."""
    out = {}
    for f in glob.glob(os.path.join(AUD, f"[01][0-9]_{eid}.md")):
        for line in open(f, encoding="utf-8"):
            m = re.match(r"^\| ?(\d{1,2}[ab]?) \|(.*)\|\s*$", line)
            if not m:
                continue
            cells = [c.strip() for c in m.group(2).split("|")]
            i = next((k for k in range(1, len(cells)) if STATUS_RE.match(cells[k])), None)
            if i is None:
                continue
            out[m.group(1)] = {"pdfKey": cells[0], "independent": "|".join(cells[1:i]).strip(), "auditStatus": cells[i],
                               "note": "|".join(cells[i + 1:]).strip(), "file": "audit/" + os.path.basename(f)}
    return out


# ---------------- 1) HIGH ----------------
def high_report():
    mr = json.load(open(os.path.join(AUD, "manual-review-questions.json"), encoding="utf-8"))
    high = [q for q in mr["questions"] if q["priority"] == "HIGH"]
    items = []
    for h in high:
        eid, n = h["examId"], h["questionNumber"]
        ds = json.load(open(os.path.join(PRIV, "dataset", f"{eid}.json"), encoding="utf-8"))
        dq = next(q for q in ds["questions"] if q["questionNumber"] == n)
        kr = key_rows(eid)
        keys = [k for k in kr if re.fullmatch(fr"{n}[ab]?", k)]
        items.append({
            "reviewId": h["reviewId"], "examId": eid, "exam": h["exam"], "questionNumber": n, "type": h["type"],
            "category": h["category"], "question": h["question"], "options": h["options"], "parts": h["parts"],
            "sourceKeyRows": {k: kr[k] for k in sorted(keys)},
            "examHasSourceKey": ds["exam"].get("answerKeyInSource", None),
            "currentAnswer": h["currentAnswer"], "currentSolution": h["currentSolution"],
            "problem": h["problem"], "whatToCheck": h["whatToCheck"], "sourceReference": h["sourceReference"],
            "source": {"sourcePage": dq.get("sourcePage"), "sourceStatus": dq.get("sourceStatus"), "sourceNotes": dq.get("sourceNotes"),
                       "reviewReasons": dq.get("reviewReasons"), "humanSignOff": dq.get("humanSignOff"),
                       "figures": [f["figureId"] + " (" + f.get("status", "") + ")" for f in dq.get("figures") or []],
                       "sourceFile": ds["exam"].get("sourceFile"), "officialSource": ds["exam"].get("officialSource")},
            "decisionOptions": ["FINAL (tuzatilgan matn/variant bilan — tuzatishni siz aytasiz)", "EXCLUDE", "HAMMAGA_BALL"],
            "status": "PENDING_SARVAR_REVIEW",
        })
    json.dump({"schemaVersion": 1, "status": "PENDING_SARVAR_REVIEW", "items": items},
              open(os.path.join(AUD, "high-review-detail.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    L = ["# HIGH ustuvorlikdagi 7 savol — to'liq ma'lumot (MAXFIY)", "",
         "Holat: **PENDING_SARVAR_REVIEW**. Hech narsa o'zgartirilmagan. Qaror variantlari: FINAL / EXCLUDE / HAMMAGA_BALL.", ""]
    for it in items:
        L += [f"## {it['reviewId']} — {it['exam']} · #{it['questionNumber']} ({it['type']})", "",
              f"- Kategoriya: {', '.join(it['category'])}",
              f"- Manba: `{it['source']['sourceFile']}` · sahifa {it['source']['sourcePage']} · sourceStatus {it['source']['sourceStatus']} · "
              f"humanSignOff {it['source']['humanSignOff']} · officialSource {it['source']['officialSource']}"]
        if it["source"]["figures"]:
            L.append(f"- Rasm(lar): {', '.join(it['source']['figures'])}")
        if it["source"]["sourceNotes"]:
            L.append(f"- Manba izohlari: {'; '.join(map(str, it['source']['sourceNotes']))}")
        L += ["", "**Savol:**", "", it["question"], ""]
        for o in it["options"]:
            lab = o["key"] + (f" (manbada '{o['sourceLabel']}')" if o.get("sourceLabel") and o["sourceLabel"] != o["key"] else "")
            L.append(f"- {lab}) {o['text'] or '∅ (bo‘sh)'}")
        for p in it["parts"]:
            L.append(f"- {p['key']}) {p['text']}")
        L += ["", "**Manba kaliti va audit:**", ""]
        if it["sourceKeyRows"]:
            L += ["| Qism | PDF kaliti | Mustaqil javob | Audit holati | Izoh |", "|---|---|---|---|---|"]
            for k, r in it["sourceKeyRows"].items():
                L.append(f"| {k} | {r['pdfKey']} | {r['independent']} | {r['auditStatus']} | {r['note']} |")
        else:
            L.append("- kalit jadvalida qator topilmadi")
        ca = it["currentAnswer"]
        L += ["", f"**Joriy javob:** {ca.get('text')} · solutionStatus `{ca.get('solutionStatus')}`"
              + (f" · qismlar {ca.get('partSolutionStatus')}" if ca.get("partSolutionStatus") else ""), "", "**Joriy yechim:**", ""]
        for b in it["currentSolution"]:
            L.append(f"- *{b.get('label') or b.get('t')}*: {b.get('text', '')}")
            for x in b.get("items") or []:
                L.append(f"    - {x}")
        L += ["", "**Muammo:** " + " ".join(it["problem"]), "", "**Tekshirish kerak:** " + " ".join(it["whatToCheck"]), "",
              "**Manba havolasi:** " + "; ".join(it["sourceReference"]), "", "**Qaror:** ☐ FINAL ☐ EXCLUDE ☐ HAMMAGA_BALL — izoh: ______", ""]
    open(os.path.join(AUD, "high-review-detail.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    return items


# ---------------- 2) Supplement shortlist ----------------
# Rasmga bog'liq nomzodlar — Claude rasmni ko'rib chiqdi (Sarvar tasdiqlashi kerak).
IMAGE_REVIEW = {
    "mock-test-1#31": ("TEKSHIRILDI (rasm)", "K–P: 3C ∥ (4C–12C = 3C) = 6C; Q–L: 8C ∥ (5C–20C = 4C) = 12C; P–Q: 12C. Ketma-ket: 1/C = 1/6 + 1/12 + 1/12 → 3C → A; kalitga mos"),
    "mock-test-1#32": ("TEKSHIRIB BO'LMADI", "Rasm ko'rildi, lekin o'q (arrow) chiziqlari yurak konturiga qaysi nuqtalarda ulanishi rasmda bir ma'noli emas. "
                       "Bitta mumkin bo'lgan o'qishda 4 Ω (A) chiqadi, lekin bu tasdiqlangan hisob emas — Sarvar rasmni ko'rib, sxemani tasdiqlashi kerak"),
    "mock-test-5#32": ("TEKSHIRILDI (rasm)", "Grafik: A = 30·10⁴ Bq o'zgarmas. N = A·t = 3·10⁵ · 15 = 4,5·10⁶ = 4,5 mln → D; kalitga mos. "
                       "Izoh: grafik o'qi minutda, savol sekundda — hisobga ta'sir qilmaydi (A o'zgarmas)"),
    "mock-test-9#31": ("TEKSHIRILDI (rasm)", "Rasm: C — devorda, CB gorizontal, A — C dan pastda, burchak C da to'g'ri. AC = √(1 − 0,36) = 0,8 m. "
                       "B tugunida vertikal muvozanat: F_AB·(AC/AB) = mg → F = 392/0,8 = 490 N → C; kalitga mos"),
    "mock-test-9#32": ("TAKROR", "Rasm va savol mock-test-1 #31 bilan bir xil (perseptiv rasm taqqoslash + ko'rib chiqish); javob ham bir xil (3C). "
                       "Bitta nusxa qoidasi: asosiy nusxa mock-test-1 #31 → mock-test-9 #32 poolda qolmaydi"),
}
EXTRA_IMAGE_DUPS = {"mock-test-9#32": "mock-test-1#31"}  # rasm bo'yicha topilgan, matn o'xshashligi o'tkazib yuborgan takror
# Pool ichida (1–30) rasm bo'yicha topilgan, kaliti bir-biriga ZID takrorlar — faqat qayd (shortlistda emas)
POOL_KEY_CONFLICTS = [
    ("mock-test-3#8", "mock-test-9#15", "bir xil savol va variantlar, kalit A vs B — qaysi biri to'g'ri, tekshirish kerak"),
    ("mock-test-3#9", "mock-test-9#22", "bir xil shart va rasm, variantlar farqli (kalit 45 vs 16) — tekshirish kerak"),
]


def supplement_report():
    sc = json.load(open(os.path.join(AUD, "supplement-candidates.json"), encoding="utf-8"))
    short = sc["positionalShortlist"]
    rows = []
    for c in short:
        c = dict(c)
        mc = c.get("manualCheck") or {}
        iv = IMAGE_REVIEW.get(c["candidateId"])
        eligible = c["eligible"]
        reasons = list(c["excludeReasons"])
        if c["candidateId"] in EXTRA_IMAGE_DUPS and eligible:
            eligible = False
            reasons.append(f"rasm bo'yicha takror: {EXTRA_IMAGE_DUPS[c['candidateId']]} (asosiy nusxa)")
        group = ("IMAGE" if c.get("image") else "CALC") if eligible or c["candidateId"] in EXTRA_IMAGE_DUPS else "EXCLUDED"
        if c["candidateId"] in EXTRA_IMAGE_DUPS:
            c["duplicateStatus"] = "DUPLICATE (rasm bo'yicha)"
        rows.append({**c, "eligibleAfterReview": eligible, "excludeReasonsAfterReview": reasons, "group": group,
                     "physicsCheck": ({"status": iv[0], "note": iv[1], "by": "Claude (rasm ko'rildi), Sarvar tasdiqlashi kerak"} if iv
                                      else {"status": mc.get("status"), "note": mc.get("note"), "by": mc.get("by")} if mc else None)})
    calc = [r for r in rows if r["group"] == "CALC"]
    img = [r for r in rows if r["group"] == "IMAGE"]
    excl = [r for r in rows if r["group"] == "EXCLUDED"]
    org = sc["removedOrgQuestions"]
    doc = {"schemaVersion": 1, "status": "PENDING_SARVAR_REVIEW",
           "note": "Final tanlov qilinmagan; topic/difficulty yozilmagan; Mock fayllari o'zgartirilmagan. Bitta nusxa qoidasi saqlangan.",
           "summary": {"shortlist": len(rows), "calcChecked": len(calc), "imageDependent": len(img),
                       "eligibleAfterReview": sum(r["eligibleAfterReview"] for r in rows), "excluded": len(excl)},
           "calc": calc, "image": img, "excluded": excl, "poolKeyConflicts": POOL_KEY_CONFLICTS, "removedOrgQuestions": org}
    json.dump(doc, open(os.path.join(AUD, "supplement-shortlist-review.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    def opts(r):
        return "<br>".join(f"{'ABCD'[i]}) {o}" for i, o in enumerate(r["options"]))

    def q(r):
        return (r["questionText"] + (f" Reaksiya: {r['reaction']}" if r.get("reaction") else "")).replace("|", "\\|")

    L = ["# 29.09 qo'shimcha savollar — #31/#32 qisqa ro'yxati, to'liq jadval (MAXFIY)", "",
         "Holat: **PENDING_SARVAR_REVIEW**. Final tanlov qilinmagan. topic / difficulty yozilmagan. Mock fayllari o'zgartirilmagan.", "",
         "Kerak: 29.09-1 — 1 ta (#32 o'rni), 29.09-2 — 2 ta (#31, #32 o'rinlari). Hammasi 1–32 MCQ (A/B/C/D) blokidan.", "",
         "Chiqarilgan ORG savollar (kontekst uchun):", ""]
    for o in org:
        L.append(f"- {o['examId']} #{o['questionNumber']}: {o['questionText'][:160]}… · variantlar: {' · '.join(o['options'])}")
    L += ["", f"## A. Hisob bilan tekshirilgan nomzodlar (rasmsiz) — {len(calc)} ta", "",
          "| # | Nomzod | Savol | Variantlar | Mock kaliti | Manba (sourceVariant) | Tur | Takror holati | AI | Fizik tekshiruv | Mosligi |",
          "|---|---|---|---|---|---|---|---|---|---|---|"]
    for i, r in enumerate(calc, 1):
        pc = r["physicsCheck"] or {}
        fit = "mos" + (" — lekin so'z noaniq" if pc.get("status") == "NOANIQ" else "")
        L.append(f"| {i} | {r['candidateId']} | {q(r)} | {opts(r)} | **{r['answer']}** | {r['mockTestId']} ({r['sourceVariant'] or '—'}) | {r['type']} | "
                 f"{r['duplicateStatus']} | {'ha' if r['aiGenerated'] else 'yo‘q'} | {pc.get('status')}: {pc.get('note')} | {fit} |")
    L += ["", f"## B. Rasmga bog'liq nomzodlar — {len(img)} ta (shulardan 1 tasi rasm bo'yicha takror — poolda qolmaydi)", "",
          "| # | Nomzod | Savol | Variantlar | Mock kaliti | Rasm | Takror holati | AI | Rasm bo'yicha tekshiruv | Mosligi |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for i, r in enumerate(img, 1):
        pc = r["physicsCheck"] or {}
        fit = ("mos" if pc.get("status", "").startswith("TEKSHIRILDI") else "chiqarildi (takror, bitta nusxa qoidasi)"
               if pc.get("status") == "TAKROR" else "Sarvar tasdig'i kerak")
        L.append(f"| {i} | {r['candidateId']} | {q(r)} | {opts(r)} | **{r['answer']}** | `{r['image']}` | {r['duplicateStatus']} | "
                 f"{'ha' if r['aiGenerated'] else 'yo‘q'} | {pc.get('status')}: {pc.get('note')} | {fit} |")
    L += ["", f"## C. Chiqarilganlar — {len(excl)} ta", "", "| Nomzod | Kalit | Sabab |", "|---|---|---|"]
    for r in excl:
        L.append(f"| {r['candidateId']} | {r['answer']} | {'; '.join(r['excludeReasonsAfterReview']).replace('|', '/')} |")
    L += ["", "## D. Pool (1–30) ichida rasm bo'yicha topilgan, kaliti zid takrorlar — faqat qayd", ""]
    for a, b, t in POOL_KEY_CONFLICTS:
        L.append(f"- {a} ↔ {b}: {t}")
    open(os.path.join(AUD, "supplement-shortlist-review.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    return doc


if __name__ == "__main__":
    h = high_report()
    s = supplement_report()
    print("HIGH:", [x["reviewId"] for x in h])
    print("SUPPLEMENT:", json.dumps(s["summary"], ensure_ascii=False))
