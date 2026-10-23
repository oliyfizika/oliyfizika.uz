#!/usr/bin/env python3
"""Real imtihonlar — muammoli savollar ro'yxati (manual review uchun). FAQAT O'QIYDI.

  python3 tools/real-imtihonlar/audit/build_manual_review.py

Manba (o'zgartirilmaydi): _private/real-imtihonlar/app-data (dataset + audit yechimlari proyeksiyasi),
dataset sourceNotes, audit yechim sarlavhalari, 00_SOLUTIONS_SUMMARY.md dagi qayd etilgan holatlar.
Natija:
  _private/real-imtihonlar/audit/manual-review-questions.json   (to'liq: savol, variantlar, javob, yechim)
  _private/real-imtihonlar/audit/manual-review-questions.full.md (to'liq, maxfiy)
  docs/real-imtihonlar/04_manual_review_questions.md            (ommaviy repo uchun xavfsiz: javob/yechim/savol matnisiz)
Har bir savol bitta yozuv (bir nechta muammo — bitta yozuvda, TOTAL da bir marta sanaladi).
Hech qanday status, javob yoki baholash siyosati o'zgartirilmaydi.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
APP = os.path.join(PRIV, "app-data")
PRIO = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
LABEL = {}

# Audit hujjatlarida (00_SOLUTIONS_SUMMARY.md, PHASE 3/3.5) qayd etilgan, lekin strukturali maydonda bo'lmagan holatlar.
KNOWN = [
    # (examId, n, category, priority, problem, whatToCheck)
    ("REAL-2026-09-29-1", 2, "ambiguous_finalized", "MEDIUM", "Audit: AMBIGUOUS qayta ko'rilib finalizatsiya qilingan (D).", "Yakuniy javob D ni tasdiqlang."),
    ("REAL-2026-09-29-1", 39, "ambiguous_finalized", "MEDIUM", "Audit: b qismi AMBIGUOUS qayta ko'rilib finalizatsiya qilingan (≈1520 nJ).", "b qismi javobi va talqinni tasdiqlang."),
    ("REAL-2024-12-01", 25, "ambiguous_finalized", "MEDIUM", "Audit: AMBIGUOUS qayta ko'rilib finalizatsiya qilingan (B).", "Yakuniy javob B ni tasdiqlang."),
    ("REAL-2026-04-06-1", 40, "ambiguous_finalized", "MEDIUM", "Audit: AMBIGUOUS qayta ko'rilib finalizatsiya qilingan (a ≈997 J/K; b ≈59,8 kJ).", "Ikkala qism javobini tasdiqlang."),
    ("REAL-2026-04-06-2", 10, "ambiguous_finalized", "MEDIUM", "Audit: AMBIGUOUS finalizatsiya (D); manbada savol cm so'raydi, grafik o'qi 'y, m'.", "Birlik ziddiyatini va D javobini tasdiqlang."),
    ("REAL-2026-04-06-2", 44, "assumption_stated", "MEDIUM", "b qismi faraz bilan yechilgan: A dagi sirt gorizontal (7,56 lx).", "Farazni qabul qilasizmi."),
    ("REAL-2026-01-18", 1, "assumption_stated", "MEDIUM", "Yechimda 'Qabul qilingan faraz': '4 s dan keyingi' iborasi talqini.", "Talqin va javobni tasdiqlang."),
    ("REAL-2026-04-06-1", 2, "assumption_stated", "MEDIUM", "Yechimda 'Qabul qilingan faraz': '4 s dan keyingi' iborasi talqini.", "Talqin va javobni tasdiqlang."),
    ("REAL-2025-11-30", 10, "source_inconsistency", "MEDIUM", "Manba ziddiyati: shartda 'kerosinda', keyin 'yarmi suvga botgan'; yechim faraz bilan (kerosin).", "Qaysi suyuqlik nazarda tutilganini tasdiqlang."),
    ("REAL-2025-11-30", 41, "sign_convention", "LOW", "b qismi ishora konvensiyasi: |A| = 1080 nJ (maydon ishi −1080, tashqi kuch ishi +1080).", "Qaysi ishorali javob qabul qilinishini belgilang."),
    ("REAL-2025-02-22", 42, "source_key_mismatch", "MEDIUM", "b qismi manba kaliti (1,35·10⁻⁷ Pa) boshqa modelga asoslangan; audit 2,4·10⁻⁷ Pa.", "Audit javobini tasdiqlang."),
    ("REAL-2025-05-13-1", 16, "answer_solution_mismatch", "LOW", "Hisob 87,8; variant 88 (yaxlitlash).", "Yaxlitlash bilan variant tanlovini tasdiqlang."),
    ("REAL-2025-11-30", 30, "answer_solution_mismatch", "LOW", "Hisob 1497; variant 1496 (yaxlitlash).", "Variant tanlovini tasdiqlang."),
    ("REAL-2026-01-18", 23, "answer_solution_mismatch", "MEDIUM", "Hisob 2,12; variant 2,16.", "Variant tanlovini tasdiqlang."),
    ("REAL-2026-04-06-1", 19, "answer_solution_mismatch", "LOW", "Hisob 9,5; variant 10 (yaxlitlash).", "Variant tanlovini tasdiqlang."),
    ("REAL-2026-04-06-2", 20, "answer_solution_mismatch", "LOW", "Hisob 9,5; variant 10 (yaxlitlash).", "Variant tanlovini tasdiqlang."),
    # manba matni / birlik muammolari (sourceNotes asosida)
    ("REAL-2025-02-22", 3, "questionable_source_option", "MEDIUM", "C variant manbada 'μ3 > μ2 > μ2' (μ2 takrorlangan).", "C variant xato bosilganmi; javobga ta'siri."),
    ("REAL-2025-02-22", 7, "questionable_unit", "MEDIUM", "Shartda '30 m/s' (km/s emas) bosilgan; yechim izohida birlik xatosi qayd etilgan.", "Birlik va javobni tasdiqlang."),
    ("REAL-2025-02-22", 13, "questionable_unit", "MEDIUM", "Shartda 'MPa', javob birligi '(mPa)'.", "So'ralgan birlikni tasdiqlang."),
    ("REAL-2025-05-13-1", 11, "questionable_unit", "LOW", "So'ralgan tezlik birligi berilmagan.", "Javob birligini belgilang."),
    ("REAL-2025-05-13-1", 4, "questionable_unit", "LOW", "Zichlik birligi berilmagan.", "Shart yetarlimi."),
    ("REAL-2026-04-06-2", 11, "questionable_unit", "MEDIUM", "Erkin tushish tezlanishi '(N/m)' da so'ralgan (manba xatosi).", "Javob/birlikni tasdiqlang."),
    ("REAL-2026-04-06-2", 23, "questionable_source_option", "HIGH", "A variant manbada BO'SH bosilgan (faqat 'A)').", "Savolni testga qanday kiritish (javob D)."),
    ("REAL-2026-04-06-2", 33, "questionable_source_option", "LOW", "33–35 da C va F variantlari ikkalasi '2,4' (kalit A, D, B — ta'sir qilmaydi).", "Takroriy variant muammo emasligini tasdiqlang."),
    ("REAL-2025-11-30", 44, "source_inconsistency", "LOW", "Shartda 'zarra', qismlarda 'Zarracha'.", "Muammo emasligini tasdiqlang."),
    ("REAL-2026-01-18", 41, "source_inconsistency", "LOW", "Shartda 'halqa', qismlarda 'Ramkada'.", "Muammo emasligini tasdiqlang."),
    ("REAL-2026-09-29-1", 45, "questionable_transcription", "LOW", "Manbada ro'yxatdan keyin ortiqcha ibora: 'bo’lgan fotonlar bilan nurlaydi.' (so'zma-so'z saqlangan).", "Matnda qoldirish yoki yo'qligi."),
    ("REAL-2024-12-01", 42, "figure_issue", "LOW", "Barcha sonli ma'lumot (X_C, X_L, R, u(t)) faqat chizma ichida.", "Chizma o'qilishi yetarlimi."),
    ("REAL-2026-04-06-2", 39, "questionable_transcription", "LOW", "Rasmdan ℃ va °C ni farqlab bo'lmaydi (ma'no o'zgarmaydi).", "Ko'rinish muammo emasligini tasdiqlang."),
]
WATERMARK_FIG = [("REAL-2024-12-01", 2), ("REAL-2025-11-30", 4), ("REAL-2025-11-30", 6), ("REAL-2025-11-30", 22),
                 ("REAL-2025-11-30", 37), ("REAL-2025-05-13-2", 39), ("REAL-2026-04-06-1", 36)]
EXAM_LEVEL = [
    {"examId": "REAL-2026-09-30-B", "category": "secondary_source", "priority": "HIGH",
     "problem": "PDF ning o'zida 'Shartlar qayta bayon qilingan, chizma va grafiklar qaytadan chizilgan' — asl imtihon matni emas (officialSource=false).",
     "whatToCheck": "Variant B ni testda qanday belgilash (ogohlantirish bilan / chiqarish)."},
    {"examId": "REAL-2026-09-29-1", "category": "source_label", "priority": "LOW", "problem": "Sarlavha 'Fizika ORG' (tuzuvchi Xolmirza Fizika).", "whatToCheck": "—"},
    {"examId": "REAL-2026-09-29-2", "category": "source_label", "priority": "LOW", "problem": "Sarlavha 'Fizika ORG'.", "whatToCheck": "—"},
    {"examId": "REAL-2026-09-30-A", "category": "source_label", "priority": "LOW", "problem": "Sarlavha 'Fizika ORG'.", "whatToCheck": "—"},
    {"examId": "REAL-2025-05-13-1", "category": "date_warning", "priority": "LOW", "problem": "Muqovada 22.02.2025, savollar sahifasida 13.05.2025.", "whatToCheck": "—"},
    {"examId": "REAL-2025-05-13-2", "category": "date_warning", "priority": "LOW", "problem": "Muqovada 22.02.2025, savollar sahifasida 13.05.2025.", "whatToCheck": "—"},
    {"examId": "REAL-2025-11-30", "category": "date_warning", "priority": "LOW", "problem": "Fayl nomi 'Fevral 2025', sana 30.11.2025.", "whatToCheck": "—"},
]


def simple_open(text):
    """Avtomatik baholashga to'g'ridan-to'g'ri yaroqlimi: 'a) <son> <birlik>; b) <son> <birlik>' (≈, simvol, so'z yo'q)."""
    m = re.match(r"^a\)\s*(.+?);\s*b\)\s*(.+)$", text or "")
    if not m:
        return False
    num = re.compile(r"^-?−?\d[\d\s]*(?:[.,]\d+)?\s*[A-Za-zµμΩ°%/·²³⁻¹ ]*$")
    return all(num.match(x.strip()) for x in m.groups())


def main():
    cat = json.load(open(os.path.join(APP, "catalog.json"), encoding="utf-8"))
    entries = {}

    def add(eid, n, category, priority, problem, what, ref):
        key = (eid, n)
        e = entries.setdefault(key, {"examId": eid, "questionNumber": n, "problems": []})
        e["problems"].append({"category": category, "priority": priority, "problem": problem, "whatToCheck": what, "sourceReference": ref})

    data = {}
    for ex in cat["exams"]:
        eid = ex["examId"]
        qs = {q["questionNumber"]: q for q in json.load(open(os.path.join(APP, "exams", eid, "questions.json"), encoding="utf-8"))["questions"]}
        ss = {s["questionNumber"]: s for s in json.load(open(os.path.join(APP, "exams", eid, "solutions.json"), encoding="utf-8"))["solutions"]}
        data[eid] = (ex, qs, ss)
        for n, s in ss.items():
            q = qs[n]
            ref = f"{s['auditRef']} · {n}-savol · PDF sahifa {', '.join(map(str, q['sourcePages']))}"
            if s["solutionStatus"] == "NEEDS_MANUAL_REVIEW":
                parts = [k for k, v in s["partSolutionStatus"].items() if v == "NEEDS_MANUAL_REVIEW"] or [p["key"] for p in q["parts"]] or ["—"]
                add(eid, n, "needs_manual_review", "HIGH", f"Yakuniy javob yo'q (qism: {', '.join(parts)}). Audit: {s['answer']['text']} {s['answer'].get('tail') or ''}".strip(),
                    "Yakuniy javobni belgilang yoki siyosat tanlang (FINAL / EXCLUDE / HAMMAGA_BALL).", ref)
            if s["solutionStatus"] == "NO_CORRECT_OPTION":
                add(eid, n, "no_correct_option", "HIGH", f"Variantlarning birortasi to'g'ri emas. Audit natijasi: {s['answer']['text']}.",
                    "Siyosat: EXCLUDE / HAMMAGA_BALL / boshqa.", ref)
            if "SOURCE_KEY_CORRECTED" in s["solutionFlags"]:
                add(eid, n, "source_key_mismatch", "MEDIUM", f"Manba kaliti tuzatilgan {s['headingNote'] or ''}; audit javobi {s['answer']['text']}.",
                    "Audit javobini tasdiqlang.", ref)
            if "SOURCE_OPTION_LABEL_MISPRINT" in s["solutionFlags"]:
                add(eid, n, "questionable_source_option", "MEDIUM", f"Variant harflari manbada xato bosilgan {s['headingNote'] or ''}; javob {s['answer']['text']} (pozitsiya bo'yicha).",
                    "Pozitsion kalitni tasdiqlang.", ref)
            if q["type"] == "open" and s["solutionStatus"] == "FINAL" and not simple_open(s["answer"]["text"]):
                add(eid, n, "open_answer_normalization", "LOW",
                    f"Javob avtomatik baholash uchun to'g'ridan-to'g'ri yaroqsiz (simvolik / so'z / taxminiy ≈): {s['answer']['text']}",
                    "Strukturali kalit (qiymat, birlik, tolerans yoki qabul qilinadigan matn) — PHASE H da.", ref)
            if not s["blocks"] and s["solutionStatus"] != "EXCLUDED_ORG":
                add(eid, n, "missing_solution", "HIGH", "Yozma yechim yo'q.", "Yechim yozilishi kerak.", ref)
    for eid, n, c, p, prob, what in KNOWN:
        ex, qs, ss = data[eid]
        add(eid, n, c, p, prob, what, f"{ss[n]['auditRef']} · {n}-savol · PDF sahifa {', '.join(map(str, qs[n]['sourcePages']))}")
    for eid, n in WATERMARK_FIG:
        ex, qs, ss = data[eid]
        add(eid, n, "figure_issue", "LOW", "Chizma ichida uchinchi tomon watermark'i ('Shavkat Azimov'/'@tvfizika') — to'rtburchak qirqim bilan ajratib bo'lmaydi.",
            "Chizma o'qilishiga xalaqit beradimi.", f"figures/{eid}/q{n:02d}-f*.png · PDF sahifa {', '.join(map(str, qs[n]['sourcePages']))}")

    out = []
    for i, ((eid, n), e) in enumerate(sorted(entries.items(), key=lambda kv: (min(PRIO[p["priority"]] for p in kv[1]["problems"]), kv[0][0], kv[0][1])), 1):
        ex, qs, ss = data[eid]
        q, s = qs[n], ss[n]
        prio = min((p["priority"] for p in e["problems"]), key=PRIO.get)
        out.append({
            "reviewId": f"RE-REVIEW-{i:03d}",
            "examId": eid,
            "exam": (f"{ex['displayDate']} — {ex['subtitle']}" if ex["subtitle"] else ex["displayDate"]),
            "questionNumber": n,
            "type": q["type"],
            "category": sorted({p["category"] for p in e["problems"]}),
            "priority": prio,
            "question": q["questionText"],
            "options": [{"key": o["key"], "sourceLabel": o["sourceLabel"], "text": o["text"]} for o in q["options"]],
            "parts": [{"key": p["key"], "text": p["text"]} for p in q["parts"]],
            "currentAnswer": {"solutionStatus": s["solutionStatus"], "partSolutionStatus": s["partSolutionStatus"], "text": s["answer"]["text"], "choice": s["answer"]["choice"]},
            "currentSolution": s["blocks"],
            "problem": [p["problem"] for p in e["problems"]],
            "problems": e["problems"],
            "sourceReference": sorted({p["sourceReference"] for p in e["problems"]}),
            "whatToCheck": [p["whatToCheck"] for p in e["problems"]],
            "status": "PENDING_SARVAR_REVIEW",
        })
    summary = {
        "totalQuestions": len(out),
        "byPriority": {k: sum(1 for x in out if x["priority"] == k) for k in PRIO},
        "byCategory": {},
        "examLevelItems": len(EXAM_LEVEL),
    }
    for x in out:
        for c in x["category"]:
            summary["byCategory"][c] = summary["byCategory"].get(c, 0) + 1
    doc = {"schemaVersion": 1, "status": "PENDING_SARVAR_REVIEW", "note": "Hech qanday status/javob/baholash siyosati o'zgartirilmagan. Bitta savol — bitta yozuv.",
           "summary": summary, "examLevel": [{**x, "status": "PENDING_SARVAR_REVIEW"} for x in EXAM_LEVEL], "questions": out}
    json.dump(doc, open(os.path.join(PRIV, "audit", "manual-review-questions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc, os.path.join(ROOT, "docs", "real-imtihonlar", "04_manual_review_questions.md"), full=False)
    write_md(doc, os.path.join(PRIV, "audit", "manual-review-questions.full.md"), full=True)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


PUBLIC_TEXT = {
    "needs_manual_review": ("Yakuniy javob yo'q (NEEDS_MANUAL_REVIEW).", "Yakuniy javob yoki siyosat (FINAL / EXCLUDE / HAMMAGA_BALL)."),
    "no_correct_option": ("Manba variantlarining birortasi to'g'ri emas.", "Siyosat (EXCLUDE / HAMMAGA_BALL / boshqa)."),
    "source_key_mismatch": ("Manba kaliti audit natijasidan farq qiladi.", "Audit javobini tasdiqlash."),
    "questionable_source_option": ("Manbadagi variant(lar) shubhali (bo'sh / takror / harf xato).", "Savolni testga kiritish usuli."),
    "ambiguous_finalized": ("Audit AMBIGUOUS holatni finalizatsiya qilgan.", "Yakuniy javobni tasdiqlash."),
    "assumption_stated": ("Yechim 'Qabul qilingan faraz' bilan.", "Farazni tasdiqlash."),
    "source_inconsistency": ("Manba matnida ichki ziddiyat.", "Talqinni tasdiqlash."),
    "sign_convention": ("Javob ishora konvensiyasiga bog'liq.", "Qabul qilinadigan ishorani belgilash."),
    "answer_solution_mismatch": ("Hisob natijasi va tanlangan variant orasida yaxlitlash farqi.", "Variant tanlovini tasdiqlash."),
    "questionable_unit": ("Birlik shubhali yoki berilmagan.", "Birlik/javobni tasdiqlash."),
    "questionable_transcription": ("Transkripsiya yoki belgi bo'yicha eslatma.", "Muammo emasligini tasdiqlash."),
    "figure_issue": ("Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada).", "O'qilishini tasdiqlash."),
    "open_answer_normalization": ("Ochiq javob avtomatik baholash uchun normallashtirilmagan.", "PHASE H: qiymat / birlik / tolerans."),
    "missing_solution": ("Yozma yechim yo'q.", "Yechim yozish."),
}


def write_md(doc, path, full):
    s = doc["summary"]
    L = ["# Real imtihonlar — manual review ro'yxati", "",
         "Holat: **PENDING_SARVAR_REVIEW**. Hech qanday status, javob yoki baholash siyosati o'zgartirilmagan.",
         "Bitta savol — bitta yozuv (bir nechta muammo bo'lsa ham TOTAL da bir marta sanaladi).", ""]
    if not full:
        L += ["> Bu fayl ommaviy repo uchun: savol matni, javoblar va yechimlar **kiritilmagan**.",
              "> To'liq ma'lumot (savol, variantlar, joriy javob va yechim): `_private/real-imtihonlar/audit/manual-review-questions.json`",
              "> va `_private/real-imtihonlar/audit/manual-review-questions.full.md` (gitignored).", ""]
    L += ["## Jami", "", f"- Savollar: **{s['totalQuestions']}**",
          f"- Ustuvorlik: HIGH {s['byPriority']['HIGH']} · MEDIUM {s['byPriority']['MEDIUM']} · LOW {s['byPriority']['LOW']}",
          f"- Imtihon darajasidagi yozuvlar: {s['examLevelItems']} (alohida, TOTAL ga kirmaydi)", "",
          "| Kategoriya | Savollar |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byCategory"].items(), key=lambda kv: -kv[1])] + [""]
    L += ["## Imtihon darajasida", "", "| examId | Kategoriya | Ustuvorlik | Muammo | Status |", "|---|---|---|---|---|"]
    L += [f"| {x['examId']} | {x['category']} | {x['priority']} | {x['problem']} | {x['status']} |" for x in doc["examLevel"]] + [""]
    L += ["## Savollar", "", "| reviewId | Imtihon | № | Tur | Ustuvorlik | Kategoriya | Muammo | Nimani tekshirish | Status |", "|---|---|---:|---|---|---|---|---|---|"]
    for x in doc["questions"]:
        if full:
            prob = " · ".join(x["problem"]).replace("|", "\\|")
            what = " · ".join(dict.fromkeys(x["whatToCheck"])).replace("|", "\\|")
        else:  # ommaviy: javob/yechim/savol matni yo'q — faqat kategoriya tavsifi
            prob = " · ".join(dict.fromkeys(PUBLIC_TEXT[c][0] for c in x["category"]))
            what = " · ".join(dict.fromkeys(PUBLIC_TEXT[c][1] for c in x["category"]))
        L.append(f"| {x['reviewId']} | {x['exam']} | {x['questionNumber']} | {x['type']} | {x['priority']} | {', '.join(x['category'])} | {prob} | {what} | {x['status']} |")
    if full:
        L += ["", "## Tafsilotlar", ""]
        for x in doc["questions"]:
            L += [f"### {x['reviewId']} — {x['exam']} / {x['questionNumber']} ({x['type']}, {x['priority']})", "",
                  f"**Savol.** {x['question']}", ""]
            if x["options"]:
                L += ["**Variantlar.** " + " · ".join(f"{o['key']}) {o['text']}" + (f" [PDF: {o['sourceLabel']})]" if o['sourceLabel'] != o['key'] else "") for o in x["options"]), ""]
            if x["parts"]:
                L += ["**Qismlar.** " + " · ".join(f"{p['key']}) {p['text']}" for p in x["parts"]), ""]
            L += [f"**Joriy javob.** {x['currentAnswer']['text']} (status: {x['currentAnswer']['solutionStatus']})", "",
                  "**Joriy yechim.**", ""] + [f"- *{b.get('label') or ''}* {b.get('text') or ''}" + ("".join(f"\n  - {it}" for it in b.get("items") or [])) for b in x["currentSolution"]] + [
                  "", "**Muammo.** " + " · ".join(x["problem"]), "", "**Manba.** " + " · ".join(x["sourceReference"]), "",
                  "**Nimani tekshirish.** " + " · ".join(dict.fromkeys(x["whatToCheck"])), "", f"**Status.** {x['status']}", ""]
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
