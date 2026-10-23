#!/usr/bin/env python3
"""36–45 ochiq javoblar: SIMPLE_NUMERIC uchun default nisbiy tolerans TAKLIFI + barcha istisnolar (exception) ro'yxati
+ Sarvar qarorlari jurnali. FAQAT O'QIYDI — dataset / app-data / audit fayllari o'zgarmaydi; faqat yangi fayllar yoziladi.

  python3 tools/real-imtihonlar/audit/build_tolerance_proposal.py

Kirish: _private/real-imtihonlar/audit/open-answer-key-audit.json (+ app-data savol/yechim matni)
Natija:
  _private/real-imtihonlar/audit/sarvar-decisions.{json,md}               — 08.10.2026 qarorlari (dataset'ga yozilmagan)
  _private/real-imtihonlar/audit/open-answer-tolerance-proposal.{json,md} — taklif jadvali + istisnolar (MAXFIY)
  docs/real-imtihonlar/07_open_answer_tolerance_proposal.md               — ommaviy xulosa (javobsiz)
Hech qanday tolerans dataset'ga yozilmaydi: hamma yozuv status=PROPOSAL_PENDING_SARVAR yoki PENDING_SARVAR_REVIEW.
"""
import glob
import json
import math
import os
import re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
AUD = os.path.join(PRIV, "audit")
DEFAULT_REL_TOL = 0.01  # TAKLIF (1 %), Sarvar tasdiqlamagan

DECISIONS = {
    "date": "2026-10-08",
    "by": "Sarvar Amirov",
    "appliedToDataset": False,
    "highReview": [
        {"reviewId": "RE-REVIEW-001", "item": "REAL-2024-12-01 #14", "decision": "PROBLEM_FLAGGED",
         "note": "muammo sifatida belgilanadi (variantlarda to'g'ri javob yo'q); EXCLUDE / HAMMAGA_BALL tanlanmagan"},
        {"reviewId": "RE-REVIEW-005", "item": "REAL-2026-04-06-2 #3", "decision": "PROBLEM_FLAGGED",
         "note": "muammo sifatida belgilanadi (variantlarda to'g'ri tartib yo'q); EXCLUDE / HAMMAGA_BALL tanlanmagan"},
        {"reviewId": "RE-REVIEW-007", "item": "REAL-2026-04-06-2 #23", "decision": "FINAL",
         "note": "javob D (44,8 Ω); A varianti manbadagidek bo'sh qoladi — matn o'zgartirilmaydi"},
        {"reviewId": "RE-REVIEW-002", "item": "REAL-2025-02-22 #39", "decision": "PENDING_SARVAR_REVIEW", "note": ""},
        {"reviewId": "RE-REVIEW-003", "item": "REAL-2025-05-13-2 #36", "decision": "PENDING_SARVAR_REVIEW", "note": ""},
        {"reviewId": "RE-REVIEW-004", "item": "REAL-2026-01-18 #43", "decision": "PENDING_SARVAR_REVIEW", "note": ""},
        {"reviewId": "RE-REVIEW-006", "item": "REAL-2026-04-06-2 #18", "decision": "PENDING_SARVAR_REVIEW",
         "note": "10⁻¹⁸ ga AVTOMATIK TUZATILMAYDI"},
    ],
    "supplements": {
        "rejected": [{"candidateId": "mock-test-1#32", "reason": "rasm noaniq — supplement sifatida ishlatilmaydi"}],
        "reservedForSelection": [
            {"candidateId": "mock-test-2#31", "originalQuestionId": "mock-test-2-q31", "mockKey": "C"},
            {"candidateId": "mock-test-4#31", "originalQuestionId": "mock-test-4-q31", "mockKey": "B"},
            {"candidateId": "mock-test-8#32", "originalQuestionId": "mock-test-8-q32", "mockKey": "C"},
        ],
        "assignment": "QILINMAGAN — qaysi biri 29.09-1 #32, qaysi ikkitasi 29.09-2 #31/#32 ekani hali belgilanmagan",
        "status": "RESERVED_NOT_FINAL (final dataset'ga yozilmagan)",
    },
    "openAnswers": {
        "unitlessExam": "REAL-2026-09-30-B: savolda birlik ko'rsatilmagan qismlar PENDING_SARVAR_REVIEW",
        "tolerance": "SIMPLE_NUMERIC uchun default nisbiy tolerans taklifi alohida jadvalda; har bir istisno alohida belgilanadi",
    },
}


def sol_text(s):
    return " ".join((b.get("text") or "") + " " + " ".join(b.get("items") or []) for b in s.get("blocks", []))


def uses_g(t):
    return bool(re.search(r"(?<![A-Za-z\\])g(?![A-Za-z])|\bmg\b|gh\b|gt\b", t))


def gives_g(t):
    return bool(re.search(r"g\s*=|g\s*\\approx|9[,.]8\s*m/s|10\s*m/s\$?\^?\{?2", t))


def half_step_rel(pv):
    """Ko'rsatilgan qiymatning yarim yaxlitlash qadami / qiymat (yaxlitlangan bo'lsa, maksimal nisbiy xato)."""
    v = abs(pv["value"])
    if v == 0:
        return None
    mant = pv["mantissa"].replace(",", ".")
    dec = len(mant.split(".")[1]) if "." in mant else 0
    step = 10 ** (-dec) * 10 ** pv["exp10"]
    return 0.5 * step / v


def main():
    audit = json.load(open(os.path.join(AUD, "open-answer-key-audit.json"), encoding="utf-8"))
    qs, ss = {}, {}
    for p in glob.glob(os.path.join(PRIV, "app-data", "exams", "*", "questions.json")):
        eid = os.path.basename(os.path.dirname(p))
        for q in json.load(open(p, encoding="utf-8"))["questions"]:
            qs[(eid, q["questionNumber"])] = q
        for s in json.load(open(p.replace("questions.json", "solutions.json"), encoding="utf-8"))["solutions"]:
            ss[(eid, s["questionNumber"])] = s
    exam_gives_g = {}
    for p in glob.glob(os.path.join(PRIV, "dataset", "REAL-*.json")):
        e = json.load(open(p, encoding="utf-8"))["exam"]
        exam_gives_g[e.get("id") or os.path.basename(p)[:-5]] = bool(re.search(r"g\s*=\s*(10|9[,.]8)", json.dumps(e, ensure_ascii=False)))
    high_pending = {"REAL-2025-02-22": [39], "REAL-2025-05-13-2": [36], "REAL-2026-01-18": [43]}

    proposal, exceptions = [], []

    def add_exc(item, etype, what, extra=None):
        exceptions.append({"exceptionId": None, "partId": item["partId"], "examId": item["examId"], "questionNumber": item["questionNumber"],
                           "part": item["part"], "category": item["category"], "type": etype, "finalAnswerText": item["finalAnswerText"],
                           "whatToDecide": what, **(extra or {}), "status": "PENDING_SARVAR_REVIEW"})

    for it in audit["items"]:
        key = (it["examId"], it["questionNumber"])
        q, s = qs[key], ss[key]
        qtext = q["questionText"] + " " + " ".join(p["text"] for p in q["parts"])
        stext = sol_text(s) + " " + (it.get("auditNote") or "")
        pv = it["parsed"]
        # --- har bir toifadagi istisnolar ---
        if it["examId"] == "REAL-2026-09-30-B" and it.get("unitStatus") == "UNIT_NOT_ASKED":
            add_exc(it, "UNIT_NOT_ASKED_30_09_B", "savolda birlik yo'q — o'quvchi qaysi birlikda kiritadi (Sarvar qarori bilan PENDING)")
        elif it.get("unitStatus") == "UNIT_NOT_ASKED":
            add_exc(it, "UNIT_NOT_ASKED", f"savolda birlik yo'q, javob '{pv.get('unit')}' da — kiritish birligi qarori")
        if it.get("unitStatus") == "MISMATCH":
            add_exc(it, "UNIT_MISMATCH", f"so'ralgan '{it['askedUnit']}', javob '{pv.get('unit')}' — qaysi birlik qabul qilinadi")
        if it.get("unitStatus") == "SCALED_UNIT":
            add_exc(it, "SCALED_UNIT", f"birlik '{it['askedUnit']}' — o'quvchi mantissani kiritadi; kalit mantissaga moslanishi kerak")
        if it["category"] == "BLOCKED":
            linked = it["questionNumber"] in high_pending.get(it["examId"], [])
            add_exc(it, "BLOCKED_NO_FINAL_ANSWER", "yakuniy javob yo'q — avval mazmun qarori" + (" (HIGH qarori: PENDING_SARVAR_REVIEW)" if linked else ""))
        if it["category"] == "NON_NUMERIC":
            add_exc(it, "NON_NUMERIC", "formula/matn javob — engine'da qanday tekshiriladi (text accept ro'yxati / qo'lda / hisobdan chiqarish)")
        if it["category"] == "NUMERIC_WITH_QUALIFIER":
            add_exc(it, "NUMERIC_WITH_QUALIFIER", f"son + so'z ('{pv.get('rest')}') — faqat son kiritiladimi yoki matn variantlarimi")
        for f, etype, what in (("APPROX_SIGN", "APPROX_ANSWER", "≈ bilan berilgan — aniq qiymat va tolerans qarori"),
                               ("PI_APPROX_3", "PI_APPROX_3", "π ≈ 3 va π = 3,14 natijalari farqli — ikkalasi qabul qilinadimi"),
                               ("TABLE_CONSTANT", "TABLE_CONSTANT", "jadval doimiysiga bog'liq — qaysi qiymat va qanday tolerans"),
                               ("NEGATIVE_VALUE", "NEGATIVE_VALUE", "manfiy javob — ishora majburiymi yoki modul ham qabul qilinadimi"),
                               ("EXACT_FORM_GIVEN", "EXACT_FORM_GIVEN", "aniq ko'rinish va taqribiy son — qaysi biri kiritiladi"),
                               ("SOURCE_KEY_DIFFERS", "SOURCE_KEY_DIFFERS", "manba kaliti boshqa — qaysi kalit"),
                               ("AUDIT_NOTE_STATUS", "AUDIT_NOTE_STATUS", "audit izohli holat (faraz / ishora / model) — kalit qarori")):
            if f in it["flags"]:
                add_exc(it, etype, what)
        if it["category"] != "SIMPLE_NUMERIC":
            continue
        # --- SIMPLE_NUMERIC: default taklif + shu toifa ichidagi istisnolar ---
        v = pv["value"]
        hs = half_step_rel(pv)
        rounded_note = "≈" in (it.get("auditNote") or "") or "≈" in (it.get("independentAnswer") or "")
        is_int_count = it.get("unitStatus") == "NO_UNIT" and float(v).is_integer()
        exc_types = []
        if v == 0:
            exc_types.append("ZERO_VALUE")
            add_exc(it, "ZERO_VALUE", "javob 0 — nisbiy tolerans ishlamaydi; absolyut qoida (masalan, aynan 0) Sarvar qarori")
        if is_int_count:
            exc_types.append("INTEGER_EXACT")
            add_exc(it, "INTEGER_EXACT", "birliksiz butun son (soni / tartibi / nisbat) — aniq moslik (tolerans 0) taklif qilinadi, 1 % emas")
        if rounded_note:
            exc_types.append("ROUNDED_IN_AUDIT")
            add_exc(it, "ROUNDED_IN_AUDIT", "audit izohida ≈ bor — ko'rsatilgan javob yaxlitlangan; 1 % to'g'ri hisobni rad etishi mumkin, aniq qiymatni tekshirish kerak",
                    {"auditNote": it.get("auditNote")})
        # Past ko'rsatilgan aniqlik — ISTISNO EMAS, faqat ma'lumot: audit konvensiyasida yaxlitlangan qiymat ≈ bilan yoziladi,
        # SIMPLE toifasida ≈ yo'q. Yaxlitlangan bo'lsa 1 % yetmasligi mumkin — ustunda ko'rsatiladi.
        precision_info = bool(hs is not None and hs > DEFAULT_REL_TOL and not is_int_count)
        if uses_g(stext) and not gives_g(qtext) and not exam_gives_g.get(it["examId"]):
            exc_types.append("G_NOT_IN_QUESTION")
            add_exc(it, "G_NOT_IN_QUESTION", "yechimda g ishlatilgan, savol matnida g qiymati yo'q — g = 9,8 va g = 10 natijasi ≈2 % farq qiladi; 1 % ikkalasini qabul qilmaydi")
        proposal.append({
            "partId": it["partId"], "examId": it["examId"], "questionNumber": it["questionNumber"], "part": it["part"],
            "finalAnswerText": it["finalAnswerText"], "value": v, "unit": pv.get("unit") or it.get("askedUnit"),
            "askedUnit": it.get("askedUnit"), "sourceKey": it.get("sourceKey"),
            "halfStepRel": None if hs is None else round(hs, 5),
            "proposedRule": ("EXACT" if is_int_count else "ABSOLUTE_PENDING" if v == 0 else "RELATIVE"),
            "proposedRelTol": (0 if is_int_count else None if v == 0 else DEFAULT_REL_TOL),
            "proposedRange": (None if v == 0 or is_int_count else [round(v * (1 - DEFAULT_REL_TOL), 12), round(v * (1 + DEFAULT_REL_TOL), 12)]),
            "lowShownPrecisionInfo": precision_info,
            "exceptions": exc_types,
            "status": "PROPOSAL_PENDING_SARVAR",
        })
    order = {t: i for i, t in enumerate(["BLOCKED_NO_FINAL_ANSWER", "UNIT_NOT_ASKED_30_09_B", "UNIT_NOT_ASKED", "UNIT_MISMATCH", "SCALED_UNIT",
                                         "SOURCE_KEY_DIFFERS", "AUDIT_NOTE_STATUS", "NON_NUMERIC", "NUMERIC_WITH_QUALIFIER", "EXACT_FORM_GIVEN",
                                         "PI_APPROX_3", "TABLE_CONSTANT", "APPROX_ANSWER", "NEGATIVE_VALUE", "ZERO_VALUE", "INTEGER_EXACT",
                                         "ROUNDED_IN_AUDIT", "G_NOT_IN_QUESTION"])}
    exceptions.sort(key=lambda e: (order[e["type"]], e["partId"]))
    for i, e in enumerate(exceptions, 1):
        e["exceptionId"] = f"OA-EXC-{i:03d}"
    clean = [p for p in proposal if not p["exceptions"]]
    summ = {"simpleNumeric": len(proposal), "simpleWithoutException": len(clean),
            "simpleWithException": len(proposal) - len(clean), "exceptionsTotal": len(exceptions),
            "partsWithException": len({e["partId"] for e in exceptions}),
            "byType": dict(Counter(e["type"] for e in exceptions)), "defaultRelTolProposed": DEFAULT_REL_TOL,
            "lowShownPrecisionInfo": sum(p["lowShownPrecisionInfo"] for p in proposal)}
    doc = {"schemaVersion": 1, "status": "PROPOSAL_PENDING_SARVAR", "appliedToDataset": False,
           "rationale": RATIONALE, "summary": summ, "proposal": proposal, "exceptions": exceptions}
    json.dump(doc, open(os.path.join(AUD, "open-answer-tolerance-proposal.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(DECISIONS, open(os.path.join(AUD, "sarvar-decisions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc)
    write_decisions_md()
    write_public(doc)
    print(json.dumps(summ, ensure_ascii=False, indent=1))


RATIONALE = [
    "Default nisbiy tolerans TAKLIFI: 1 % (|kiritilgan − kalit| ≤ 0,01·|kalit|).",
    "Asos: javoblar 2–3 qiymatli raqam bilan berilgan; standart doimiylarning keng tarqalgan yozilishi (h = 6,6 / 6,63; e = 1,6 / 1,602; R = 8,31 / 8,314; c = 3·10⁸) natijani ≲ 0,5 % o'zgartiradi — 1 % ularni qabul qiladi.",
    "1 % qo'pol xatoni (masalan, birlik/daraja xatosi, noto'g'ri formula) rad etadi.",
    "1 % QOPLAMAYDI: g = 9,8 va 10 farqi (≈2 %), π ≈ 3 va 3,14 farqi (≈4,5 %), yaxlitlangan kalit — bular alohida istisno.",
    "Birliksiz butun sonlar (soni, tartibi, nisbat) uchun aniq moslik taklif qilinadi; javob 0 bo'lsa nisbiy tolerans ishlamaydi — absolyut qoida kerak.",
    "g: 12 imtihondan faqat 30.09-B da umumiy ko'rsatma bor (g = 10 m/s²); boshqalarida savol matnida g deyarli berilmagan. Shu sabab G_NOT_IN_QUESTION istisnolarini yagona siyosat bilan hal qilish taklif qilinadi (masalan: g = 10 konvensiyasi yoki ikkala qiymatni qabul qilish).",
    "Past ko'rsatilgan aniqlik (yarim qadam > 1 %) istisno emas, faqat ma'lumot: audit yaxlitlangan qiymatlarni ≈ bilan yozgan, SIMPLE toifasida ≈ yo'q.",
    "Hech bir qiymat dataset'ga yozilmagan; har biri Sarvar tasdig'idan keyin.",
]


def write_md(doc):
    s = doc["summary"]
    L = ["# 36–45 ochiq javoblar — tolerans taklifi va istisnolar (MAXFIY: javoblar bor)", "",
         "Holat: **PROPOSAL_PENDING_SARVAR**. Dataset'ga hech narsa yozilmagan.", "", "## Asos", ""] + [f"- {r}" for r in doc["rationale"]] + [
         "", f"SIMPLE_NUMERIC: **{s['simpleNumeric']}** · istisnosiz (1 % to'g'ridan-to'g'ri qo'llanadi): **{s['simpleWithoutException']}** · "
         f"istisnoli: **{s['simpleWithException']}**", "",
         f"Istisnolar jami: **{s['exceptionsTotal']}** yozuv, **{s['partsWithException']}** qism. Turlar: "
         + ", ".join(f"{k} {v}" for k, v in sorted(s["byType"].items())), "",
         "## 1. SIMPLE_NUMERIC — default taklif jadvali", "",
         "| Qism | Yakuniy javob | Qiymat | Birlik | Manba kaliti | Yarim qadam (ma'lumot) | Taklif | Qabul oralig'i | Istisno |", "|---|---|---|---|---|---|---|---|---|"]
    for p in doc["proposal"]:
        rule = {"RELATIVE": "nisbiy 1 %", "EXACT": "aniq", "ABSOLUTE_PENDING": "absolyut — qaror kerak"}[p["proposedRule"]]
        rng = "—" if not p["proposedRange"] else f"{p['proposedRange'][0]:.6g} … {p['proposedRange'][1]:.6g}"
        hs = "—" if p["halfStepRel"] is None else f"{p['halfStepRel'] * 100:.2f} %" + (" ⓘ" if p["lowShownPrecisionInfo"] else "")
        L.append(f"| {p['partId'][5:]} | {p['finalAnswerText'].replace('|', '/')} | {p['value']:.6g} | {p['unit'] or '—'} | {p['sourceKey'] or '—'} | {hs} | {rule} | {rng} | "
                 f"{', '.join(p['exceptions']) or '—'} |")
    L += ["", "## 2. Istisnolar — har biri alohida", "", "| ID | Qism | Tur | Kategoriya | Yakuniy javob | Nima hal qilinadi | Holat |", "|---|---|---|---|---|---|---|"]
    for e in doc["exceptions"]:
        L.append(f"| {e['exceptionId']} | {e['partId'][5:]} | {e['type']} | {e['category']} | {(e['finalAnswerText'] or '—').replace('|', '/')} | "
                 f"{e['whatToDecide'].replace('|', '/')} | {e['status']} |")
    open(os.path.join(AUD, "open-answer-tolerance-proposal.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_decisions_md():
    d = DECISIONS
    L = [f"# Sarvar qarorlari — {d['date']} (dataset'ga YOZILMAGAN)", "", "## HIGH savollar", "", "| ID | Savol | Qaror | Izoh |", "|---|---|---|---|"]
    for h in d["highReview"]:
        L.append(f"| {h['reviewId']} | {h['item']} | **{h['decision']}** | {h['note'] or '—'} |")
    sp = d["supplements"]
    L += ["", "## Qo'shimcha savollar (29.09)", "", "Rad etildi:"] + [f"- {r['candidateId']} — {r['reason']}" for r in sp["rejected"]] + [
          "", "Tanlov uchun ajratildi (final emas):"] + [f"- {r['candidateId']} (`{r['originalQuestionId']}`, Mock kaliti {r['mockKey']})" for r in sp["reservedForSelection"]] + [
          "", f"Taqsimot: {sp['assignment']}.", f"Holat: {sp['status']}.", "", "## Ochiq javoblar", "",
          f"- {d['openAnswers']['unitlessExam']}", f"- {d['openAnswers']['tolerance']}"]
    open(os.path.join(AUD, "sarvar-decisions.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public(doc):
    s = doc["summary"]
    L = ["# 36–45 ochiq javoblar — tolerans taklifi (ommaviy xulosa)", "",
         "Holat: **PROPOSAL_PENDING_SARVAR**. Javoblar bu faylda yo'q; to'liq jadval: `_private/real-imtihonlar/audit/open-answer-tolerance-proposal.{json,md}`.", "",
         "## Asos", ""] + [f"- {r}" for r in doc["rationale"]] + ["",
         f"- SIMPLE_NUMERIC: {s['simpleNumeric']} (istisnosiz {s['simpleWithoutException']}, istisnoli {s['simpleWithException']})",
         f"- Istisno yozuvlari: {s['exceptionsTotal']} ({s['partsWithException']} qism)", "", "| Istisno turi | Soni |", "|---|---:|"]
    for k, v in sorted(s["byType"].items(), key=lambda x: -x[1]):
        L.append(f"| {k} | {v} |")
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "07_open_answer_tolerance_proposal.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
