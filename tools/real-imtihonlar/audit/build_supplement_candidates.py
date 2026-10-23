#!/usr/bin/env python3
"""29.09 variantlari uchun qo'shimcha MCQ nomzodlari (Mock test bazasidan). FAQAT O'QIYDI, HECH NIMANI TANLAMAYDI.

  python3 tools/real-imtihonlar/audit/build_supplement_candidates.py

Qoidalar (Sarvar ko'rsatmasi):
  • faqat 1–32 MCQ blok formati (A/B/C/D, 4 variant) — chiqarilgan ORG savollar #32 (29.09-1) va #31, #32 (29.09-2)
    1–32 blokidan bo'lgani uchun;
  • chiqariladi: mock-test-11, -12, -14, -15; origin "ai-generated"; Mock ichida takror; Real Exam savoliga o'xshash;
  • topic / difficulty TAXMIN QILINMAYDI va yozilmaydi;
  • final tanlov qilinmaydi — ro'yxat Sarvar tekshiruvi uchun.
Natija: _private/real-imtihonlar/audit/supplement-candidates.json, docs/real-imtihonlar/05_supplement_candidates.md
"""
import difflib
import glob
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MOCK = os.path.join(ROOT, "milliy-sertifikat", "mock-testlar", "data")
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
EXCLUDED_TESTS = {
    "mock-test-11": "mock-test-2 bilan takror (Sarvar ro'yxati)",
    "mock-test-12": "mock-test-6 bilan takror; sourceVariant 2023-yil 02.04.2023 (Sarvar ro'yxati)",
    "mock-test-14": "30.09.2026 Variant B kontentidan olingan (Sarvar ro'yxati)",
    "mock-test-15": "29.09.2026 2-smena kontentidan olingan — to'ldiriladigan imtihonning o'zi (Sarvar ro'yxati)",
}
# Pozitsion qisqa ro'yxat uchun QO'LDA fizik tekshiruv (Claude hisobi, Sarvar tasdiqlashi kerak). Mock fayllari O'ZGARTIRILMAYDI.
MANUAL_CHECK = {
    "mock-test-3#31": ("MANBA_XATOSI_EHTIMOLI", "3 mm³ suv → N ≈ 1·10²⁰; variantlar (10²³…) 3 cm³ ga mos. Birlik yoki variantlar xato — hozirgi holda yaroqsiz"),
    "mock-test-10#31": ("MANBA_XATOSI_EHTIMOLI", "hisob: E = hc/λ − A ≈ 3,2·10⁻¹⁹ J ≈ 2 eV; variantlar 200/300/600/500 (mock-test-2 #31 variantlariga o'xshaydi). Kalit A=200 fizik jihatdan noto'g'ri ko'rinadi — hozirgi holda yaroqsiz"),
    "mock-test-10#32": ("NOANIQ", "1 − 1/n² = 8/9 → n = 3; kalit D=3. Lekin 'qo'zg'atilgan holat tartibi' n=3 ni 2-qo'zg'atilgan holat deb ham tushunish mumkin — so'z noaniq"),
    "mock-test-3#32": ("TEKSHIRILDI", "I = F/(BL) = 0,5 A → D; kalitga mos"),
    "mock-test-4#31": ("TEKSHIRILDI", "I = pc/(1+ρ) = 37,5 MW/m² → B; kalitga mos"),
    "mock-test-4#32": ("TEKSHIRILDI", "⁹Be + ¹H → ⁶Li + ⁴He; q = 3e = 4,8·10⁻¹⁰ nC → C; kalitga mos"),
    "mock-test-5#31": ("TEKSHIRILDI", "2T — butun davr, tok o'zgarmaydi: −i₀/3 → A; kalitga mos"),
    "mock-test-7#31": ("TEKSHIRILDI", "13,6·(1/4 − 1/16) = 2,55 eV → A; kalitga mos"),
    "mock-test-7#32": ("TEKSHIRILDI", "0,005/17,2 ≈ 0,029 % ≈ 0,03 → D; kalitga mos"),
    "mock-test-8#31": ("TEKSHIRILDI", "har bir γ: 132·0,511 MeV ≈ 67,4 MeV; ν ≈ 1,64·10²² Hz → B; kalitga mos"),
    "mock-test-8#32": ("TEKSHIRILDI", "2hν−A = 3(hν−A) → ν₀ = ν/2 = 0,6·10¹⁵ Hz → λ = 500 nm → C; kalitga mos"),
    "mock-test-9#31": ("TEKSHIRILDI_RASMGA_BOG'LIQ", "C da to'g'ri burchak deb: F = mg·l₂/√(l₂²−l₁²) = 392/0,8 = 490 N → C; rasm geometriyasini Sarvar tasdiqlashi kerak"),
    "mock-test-13#32": ("TEKSHIRILDI", "A: 4+1+16−12 = 9, Z: 2+0+8−6 = 4 → ⁹Be → A; kalitga mos"),
    "mock-test-2#31": ("TEKSHIRILDI", "λ = h/p = 600 nm → C; kalitga mos"),
    "mock-test-2#32": ("TEKSHIRILDI", "A: 4+1+34−12 = 27, Z: 2+0+17−6 = 13 → ²⁷Al → D; kalitga mos"),
    "mock-test-6#31": ("TEKSHIRILDI", "λ = hc/E ≈ 690 nm → 687 nm (A); kalitga mos"),
    "mock-test-6#32": ("MANBA_XATOSI_EHTIMOLI", "⁷Li + X → ¹⁰B + n: A = 4, Z = 2 → α zarracha (C). Mock kaliti D (proton) — noto'g'ri ko'rinadi; mock-test-12 #32 da xuddi shu savol kaliti C. Hozirgi holda yaroqsiz"),
    "mock-test-1#31": ("RASMGA_BOG'LIQ", "javob faqat sxema bo'yicha tekshiriladi — Claude rasmni ko'rmagan"),
    "mock-test-1#32": ("RASMGA_BOG'LIQ", "javob faqat rasm bo'yicha tekshiriladi — Claude rasmni ko'rmagan"),
    "mock-test-5#32": ("RASMGA_BOG'LIQ", "javob faqat grafik bo'yicha tekshiriladi — Claude rasmni ko'rmagan"),
    "mock-test-9#32": ("RASMGA_BOG'LIQ", "javob faqat sxema bo'yicha tekshiriladi — Claude rasmni ko'rmagan"),
}
SUP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻₀₁₂₃₄₅₆₇₈₉", "0123456789-0123456789")


def norm(t):
    t = unicodedata.normalize("NFKC", str(t or "")).translate(SUP).lower()
    t = re.sub(r"\\[a-z]+", " ", t)
    t = re.sub(r"[‘’ʻʼ`´']", "", t)
    t = re.sub(r"[^0-9a-zа-яёўқғҳ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def opt_text(o):
    return o if isinstance(o, str) else (o or {}).get("text", "")


def main():
    tests = sorted(glob.glob(os.path.join(MOCK, "mock-test-*.json")), key=lambda p: int(re.findall(r"(\d+)\.json$", p)[0]))
    mock = []
    for p in tests:
        d = json.load(open(p, encoding="utf-8"))
        for q in d["questions"]:
            mock.append({"test": d["id"], "sourceVariant": d.get("sourceVariant"), "q": q,
                         "norm": norm(q["text"] + " " + (q.get("reaction") or "") + " " + " ".join(opt_text(o) for o in q.get("options") or [])),
                         "optset": frozenset(norm(opt_text(o)).replace(" ", "") for o in q.get("options") or [])})
    real = []
    for p in sorted(glob.glob(os.path.join(PRIV, "app-data", "exams", "*", "questions.json"))):
        for q in json.load(open(p, encoding="utf-8"))["questions"]:
            real.append({"id": q["id"], "included": q["included"], "norm": norm(q["questionText"] + " " + " ".join(o["text"] for o in q["options"]))})
    # ORG (chiqarilgan) savollar — kontekst uchun (matn faqat maxfiy JSON da)
    org = []
    for eid, n in (("REAL-2026-09-29-1", 32), ("REAL-2026-09-29-2", 31), ("REAL-2026-09-29-2", 32)):
        q = json.load(open(os.path.join(PRIV, "app-data", "exams", eid, "questions.json"), encoding="utf-8"))["questions"][n - 1]
        org.append({"examId": eid, "questionNumber": n, "type": q["type"], "optionCount": len(q["options"]), "questionText": q["questionText"],
                    "options": [o["text"] for o in q["options"]]})

    def order(x):
        return (int(x["test"].rsplit("-", 1)[1]), x["q"]["n"])

    def similar(a, b):
        return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()

    out = []
    for m in mock:
        q = m["q"]
        n = q["n"]
        if not (1 <= n <= 32):
            continue
        reasons_out, notes = [], []
        if m["test"] in EXCLUDED_TESTS:
            reasons_out.append("test chiqarilgan: " + EXCLUDED_TESTS[m["test"]])
        ai = q.get("origin") == "ai-generated"
        if ai:
            reasons_out.append('origin: "ai-generated"')
        opts = q.get("options") or []
        fmt_ok = q["type"] == "mcq" and len(opts) == 4 and q.get("answer") in ("A", "B", "C", "D")
        if not fmt_ok:
            reasons_out.append(f"format mos emas (type={q['type']}, variantlar={len(opts)})")
        # Mock ichida takror: matn o'xshashligi ≥ 0,85 YOKI variantlar to'plami bir xil + matn ≥ 0,6 (raqam formati/tartib farqi).
        # Guruhda ruxsat etilgan testlardagi birinchi nusxa (test raqami, savol raqami bo'yicha) "asosiy" — u qoladi, qolganlari chiqariladi.
        # Chiqarilgan testdagi (11/12/14/15) nusxa asosiy savolni chiqarib yubormaydi.
        dup_mock, dup_primary = [], True
        for o in mock:
            if o is m or not (1 <= o["q"]["n"] <= 45):
                continue
            r = similar(m["norm"], o["norm"])
            sem = len(m["optset"]) == 4 and m["optset"] == o["optset"] and r >= 0.6
            if r >= 0.85 or sem:
                dup_mock.append(f"{o['test']} #{o['q']['n']} ({r:.2f}{', variantlar bir xil' if sem and r < 0.85 else ''})")
                if o["test"] not in EXCLUDED_TESTS and order(o) < order(m):
                    dup_primary = False
        # Real Exam bilan o'xshashlik
        best = max(((similar(m["norm"], r["norm"]), r["id"]) for r in real), default=(0, None))
        dup_real = best[0] >= 0.75
        if dup_mock and not dup_primary:
            reasons_out.append("Mock ichida takror (asosiy nusxa emas): " + ", ".join(dup_mock))
        elif dup_mock:
            notes.append("takror guruhining asosiy nusxasi; boshqa nusxalar: " + ", ".join(dup_mock))
        if dup_real:
            reasons_out.append(f"Real Exam savoliga o'xshash: {best[1]} ({best[0]:.2f})")
        elif best[0] >= 0.55:
            notes.append(f"Real Exam bilan qisman o'xshashlik: {best[1]} ({best[0]:.2f}) — qo'lda tekshirish kerak")
        if q.get("image") or any(not isinstance(o, str) and (o or {}).get("image") for o in opts):
            notes.append("rasm bor (Mock assets yo'lida)")
        mc = MANUAL_CHECK.get(f"{m['test']}#{n}")
        if mc and mc[0] == "MANBA_XATOSI_EHTIMOLI":
            reasons_out.append("qo'lda tekshiruv: " + mc[1])
        if q.get("note"):
            notes.append("umumiy izoh (note) bor")
        out.append({
            "candidateId": f"{m['test']}#{n}",
            "mockTestId": m["test"],
            "originalQuestionId": f"{m['test']}-q{n:02d}",
            "questionNumber": n,
            "sourceVariant": m["sourceVariant"],
            "type": q["type"],
            "formatBlock": "1-32 MCQ (A/B/C/D)" if fmt_ok else "mos emas",
            "questionText": q["text"],
            "reaction": q.get("reaction"),
            "options": [opt_text(o) for o in opts],
            "answer": q.get("answer"),
            "image": q.get("image"),
            "aiGenerated": ai,
            "duplicateStatus": ("UNIQUE_IN_MOCK" if not dup_mock else "DUPLICATE_GROUP_PRIMARY" if dup_primary else "DUPLICATE"),
            "duplicateOf": dup_mock,
            "manualCheck": ({"status": mc[0], "note": mc[1], "by": "Claude (Sarvar tasdiqlashi kerak)"} if mc else None),
            "realExamSimilarity": {"bestMatch": best[1], "ratio": round(best[0], 3)},
            "eligible": not reasons_out,
            "excludeReasons": reasons_out,
            "notes": notes,
            "positionalSlot": n in (31, 32),
            "topic": None,
            "difficulty": None,
            "status": "CANDIDATE_PENDING_SARVAR_REVIEW" if not reasons_out else "EXCLUDED",
        })
    eligible = [c for c in out if c["eligible"]]
    short = [c for c in out if c["positionalSlot"]]
    doc = {"schemaVersion": 1, "status": "PENDING_SARVAR_REVIEW",
           "rules": ["1–32 MCQ formati", "mock-test-11/12/14/15 chiqarilgan", "ai-generated chiqarilgan", "Mock ichida takror chiqarilgan (matn ≥ 0,85 yoki variantlar bir xil + matn ≥ 0,6); guruhning birinchi nusxasi (ruxsat etilgan testda) qoladi",
                     "pozitsion qisqa ro'yxat (#31/#32) qo'lda fizik tekshirilgan; manba xatosi ehtimoli bo'lsa chiqarilgan; qolgan 1–30 nomzodlar fizik tekshirilmagan",
                     "Real Exam savoliga o'xshash chiqarilgan (≥ 0,75)", "topic/difficulty yozilmagan", "final tanlov qilinmagan"],
           "need": {"REAL-2026-09-29-1": {"slots": [32], "count": 1}, "REAL-2026-09-29-2": {"slots": [31, 32], "count": 2}},
           "removedOrgQuestions": org,
           "summary": {"mockQuestionsBlock1_32": len(out), "eligible": len(eligible), "positionalShortlist": len(short),
                       "positionalEligible": sum(1 for c in short if c["eligible"])},
           "positionalShortlist": short, "allCandidates": out}
    json.dump(doc, open(os.path.join(PRIV, "audit", "supplement-candidates.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc, os.path.join(ROOT, "docs", "real-imtihonlar", "05_supplement_candidates.md"))
    print(json.dumps(doc["summary"], ensure_ascii=False))


def write_md(doc, path):
    s = doc["summary"]
    L = ["# 29.09 variantlari uchun qo'shimcha MCQ nomzodlari (Mock bazasidan)", "",
         "Holat: **PENDING_SARVAR_REVIEW**. Final tanlov QILINMAGAN. topic / difficulty yozilmagan.", "",
         "Kerak: 29.09.2026 1-smena — 1 ta (o'rni #32), 29.09.2026 2-smena — 2 ta (o'rinlari #31, #32). Hammasi 1–32 MCQ blokidan.",
         "Chiqarilgan ORG savollarning matni maxfiy faylda: `_private/real-imtihonlar/audit/supplement-candidates.json`.", "",
         "## Filtr qoidalari", ""] + [f"- {r}" for r in doc["rules"]] + ["",
         f"Mock 1–32 blok savollari: **{s['mockQuestionsBlock1_32']}** · mos (eligible): **{s['eligible']}** · "
         f"pozitsion qisqa ro'yxat (#31/#32): **{s['positionalShortlist']}**, ulardan mos: **{s['positionalEligible']}**.", "",
         "## Pozitsion qisqa ro'yxat (#31 / #32, barcha Mock testlar)", ""]
    for c in doc["positionalShortlist"]:
        L += [f"### {c['candidateId']} — {'MOS' if c['eligible'] else 'CHIQARILGAN'}", "",
              f"- Manba: `{c['mockTestId']}` (sourceVariant: {c['sourceVariant'] or '—'}) · originalQuestionId `{c['originalQuestionId']}`",
              f"- Tur: {c['type']} · format: {c['formatBlock']} · AI-generated: {'ha' if c['aiGenerated'] else 'yo‘q'} · takror: {c['duplicateStatus']}",
              f"- Real Exam bilan eng yaqin o'xshashlik: {c['realExamSimilarity']['bestMatch']} ({c['realExamSimilarity']['ratio']})",
              f"- Savol: {c['questionText']}" + (f" Reaksiya: {c['reaction']}" if c.get("reaction") else "")]
        if c["options"]:
            L.append("- Variantlar: " + " · ".join(f"{'ABCD'[i]}) {o}" for i, o in enumerate(c["options"])))
        L.append(f"- Javob (Mock kaliti): {c['answer']}")
        if c["image"]:
            L.append(f"- Rasm: `{c['image']}`")
        if c.get("manualCheck"):
            L.append(f"- Qo'lda tekshiruv ({c['manualCheck']['status']}): {c['manualCheck']['note']}")
        if c["excludeReasons"]:
            L.append("- Nega chiqarilgan: " + "; ".join(c["excludeReasons"]))
        else:
            L.append("- Nega mos: 1–32 MCQ formati (4 variant, A–D kalit), takror emas, AI-generated emas, ruxsat etilgan testdan, Real Exam savoliga o'xshamaydi" + (" — " + "; ".join(c["notes"]) if c["notes"] else ""))
        L.append("")
    L += ["## Barcha mos nomzodlar (1–32 blok, qisqacha)", "", "| Nomzod | Rasm | Real o'xshashlik | Izoh |", "|---|---|---|---|"]
    for c in doc["allCandidates"]:
        if c["eligible"]:
            L.append(f"| {c['candidateId']} | {'ha' if c['image'] else '—'} | {c['realExamSimilarity']['ratio']} | {'; '.join(c['notes']) or '—'} |")
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
