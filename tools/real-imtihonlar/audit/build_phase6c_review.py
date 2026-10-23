#!/usr/bin/env python3
"""PHASE 6C — V2 da ochiq qolgan 36 qism bo'yicha Sarvar uchun qaror hisoboti. FAQAT O'QIYDI — yangi fayllar yozadi.
Dataset, V2 draft, savol/yechim matni, scoring.js va Mock tizimi O'ZGARMAYDI. Manbada yo'q ma'lumot taxmin qilinmaydi.

  python3 tools/real-imtihonlar/audit/build_phase6c_review.py

Natija: _private/real-imtihonlar/audit/phase6c-decision-review.{json,md} (MAXFIY: savol matni va javoblar)
        docs/real-imtihonlar/11_phase6c_decision_review_summary.md       (ommaviy: faqat sonlar va holatlar)
"""
import glob
import hashlib
import json
import math
import os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
AUD = os.path.join(PRIV, "audit")
INPUTS = ["answer-key-spec-v2.draft.json", "phase6a-answer-key-final-audit.json", "sarvar-decisions.md", "sarvar-decisions-002-tolerance-policy.json"]

# ---------------------------------------------------------------- A. PENDING_HIGH_REVIEW
A = {
    "REAL-2025-02-22-q39a": dict(
        high="RE-REVIEW-002", reason="Shartda jarayon turi (izobarik/izotermik/…) berilmagan — Q = ΔU + A da ikki noma'lum, shart fizik jihatdan yetarli emas.",
        evidence=["Manba (PDF) kaliti: '3 marta ortgan' — faqat izobarik jarayonda to'g'ri (audit 05_REAL-2025-02-22.md, 39a).",
                  "Mustaqil audit: NEEDS MANUAL REVIEW, likely intended — VERIFIED emas."],
        options=["FINAL — manba kaliti (izobarik faraz rasmiy qabul qilinadi): '3 marta ortgan' (T₂/T₁ = 3)",
                 "HAMMAGA_BALL", "EXCLUDE (avtomatik baholashdan chiqarish)",
                 "Ko'p talqinli qabul: 3 (izobarik), 1/o'zgarmaydi (izotermik), 9 (p ∝ V) — shart yetarli emasligi sababli"],
        rec="Sarvar qarori: tavsiya — HAMMAGA_BALL yoki EXCLUDE (shart yetarli emas). FINAL faqat izobarik farazni rasmiy qabul qilsangiz.",
        auto="TAYYOR EMAS — HIGH qarori kerak"),
    "REAL-2025-02-22-q39b": dict(
        high="RE-REVIEW-002", reason="39a bilan bir xil: jarayon turi berilmagan.",
        evidence=["Manba kaliti: 24 kJ (A = 2Q/5, faqat izobarik).", "Izotermik: 60 kJ; p ∝ V: 15 kJ."],
        options=["FINAL — 24 kJ (izobarik faraz)", "HAMMAGA_BALL", "EXCLUDE", "Ko'p talqinli qabul: 24 / 60 / 15 kJ"],
        rec="39a bilan bitta qaror (bir savolning ikki qismi).", auto="TAYYOR EMAS — HIGH qarori kerak"),
    "REAL-2025-05-13-2-q36a": dict(
        high="RE-REVIEW-003", reason="Otish yo'nalishi berilmagan (manba izohi: 'Throw direction not specified in PDF').",
        evidence=["Manba kaliti yo'q (13.05-2 da kalit yo'q).", "Talqinlar (g = 10): gorizontal 4 s; tik yuqoriga ≈4,53 s; tik pastga ≈3,53 s.",
                  "g = 9,8 bilan: 4,04 / 4,58 / 3,56 s.", "36b (Δp = 36 kg·m/s) yo'nalishga bog'liq emas — FINAL va READY."],
        options=["FINAL — bitta talqin (masalan gorizontal 4 s) — tanlash uchun manbada asos yo'q", "Ko'p talqinli qabul (3 talqin × g varianti, har biri ±1 %)",
                 "HAMMAGA_BALL (faqat 36a)", "EXCLUDE (faqat 36a)"],
        rec="Sarvar qarori: tavsiya — 36a uchun HAMMAGA_BALL yoki EXCLUDE; bitta talqinni tanlash manbaga asoslanmaydi.",
        auto="TAYYOR EMAS — HIGH qarori kerak (36b tayyor)"),
    "REAL-2026-01-18-q43a": dict(
        high="RE-REVIEW-004", reason="'Yoyilish burchagi' to'liq konus burchagimi yoki yarim burchakmi — shartda aniqlanmagan.",
        evidence=["Manba kaliti yo'q.", "To'liq burchak: D = Lα = 8 m; yarim burchak: D = 2Lα = 16 m (2 marta farq)."],
        options=["FINAL — 8 m (to'liq burchak)", "FINAL — 16 m (yarim burchak)", "Ikkala talqinni qabul qilish (8 va 16 m, ±1 %)", "HAMMAGA_BALL", "EXCLUDE"],
        rec="Sarvar qarori: atama talqinini manba (darslik) bo'yicha siz belgilang; aniqlanmasa — ikkala talqinni qabul qilish yoki EXCLUDE.",
        auto="TAYYOR EMAS — HIGH qarori kerak"),
    "REAL-2026-01-18-q43b": dict(
        high="RE-REVIEW-004", reason="43a ga bog'liq: diametr 2 marta farq → intensivlik 4 marta farq.",
        evidence=["To'liq burchak: I = 200/(π·4²) ≈ 3,98 W/m² (π = 3: 4,17).", "Yarim burchak: I = 200/(π·8²) ≈ 0,99 W/m² (π = 3: 1,04).",
                  "Shartda π ≈ 3 berilmagan — PI_APPROX_3 siyosati bu qismga avtomatik qo'llanmagan."],
        options=["43a qaroriga mos bitta qiymat", "Ikkala talqin (3,98 va 0,99, ±1 %)", "HAMMAGA_BALL", "EXCLUDE"],
        rec="43a bilan bitta qaror.", auto="TAYYOR EMAS — HIGH qarori kerak"),
}

# ---------------------------------------------------------------- B. NEEDS_MANUAL_REVIEW
FORMULA_COMMON = dict(
    reason="Javob ko'p belgili formula. Mavjud engine faqat son yoki aniq matnni tekshiradi; formula ekvivalentligini (masalan eEl/2 = 0,5·e·E·l) xavfsiz tekshirib bo'lmaydi.",
    options=["Avtomatik baholashdan chiqarish, natijada 'o'z-o'zini tekshirish' sifatida to'g'ri ifodani ko'rsatish", "Qo'lda baholash (admin)",
             "Kelajakda simvolik ifoda parseri (alohida bosqich, xavf yuqori)"],
    rec="NEEDS_MANUAL_REVIEW qoladi; engine dizaynida 'baholanmaydigan, javobi ko'rsatiladigan qism' turi taklif qilinadi.",
    auto="TAYYOR EMAS")
B = {
    "REAL-2025-02-22-q41a": dict(FORMULA_COMMON, evidence=["Yechim: d = l·sin30° → ΔK = eEl/2 (rasm bo'yicha, audit VERIFIED).", "Manba kaliti: eEl/2."]),
    "REAL-2025-02-22-q43a": dict(FORMULA_COMMON, evidence=["ν = eB/(2πm) — manba kaliti bilan mos."]),
    "REAL-2025-02-22-q43b": dict(FORMULA_COMMON, evidence=["υ = eBr/m — manba kaliti bilan mos."]),
    "REAL-2025-05-13-1-q41a": dict(FORMULA_COMMON, evidence=["kQq/r² = mυ²/r → υ = √(kQq/(mr)); manba kaliti yo'q."]),
    "REAL-2025-05-13-1-q41b": dict(FORMULA_COMMON, evidence=["K = mυ²/2 = kQq/(2r); manba kaliti yo'q."]),
    "REAL-2026-01-18-q41a": dict(FORMULA_COMMON, evidence=["Φ = BS·cosωt → ℰ = BSω·sinωt; boshlang'ich faza shartda berilmagan — cos ko'rinishi ham to'g'ri bo'lishi mumkin.",
                                                            "Manba izohi: savolda 'halqa', qismlarda 'ramka'."]),
    "REAL-2026-01-18-q41b": dict(FORMULA_COMMON, evidence=["P = ℰ²/R = B²S²ω²sin²ωt/R; o'rtacha qiymat B²S²ω²/(2R) — qaysi biri so'ralgani noaniq."]),
    "REAL-2025-02-22-q45b": dict(
        reason="Javob 'son + yo'nalish' (2 marta kamayadi). Faqat son kiritilsa ('2') o'sishmi yoki kamayishmi — aniqlab bo'lmaydi.",
        evidence=["υ ∝ 1/n; n: 2 → 4 → υ'/υ = 1/2 (manba kaliti '2 marta kamayadi' bilan mos)."],
        options=["Ikki maydon: son 2 (±1 %) + yo'nalish tanlovi ('ortdi'/'kamaydi') — V2 tasviri tayyor", "Nisbat r = yangi/eski = 0,5 kiritish (UI ko'rsatmasi bilan)",
                 "Qo'lda baholash"],
        rec="UI 'son + yo'nalish' maydonlarini qo'llasa — READY; aks holda NEEDS_MANUAL_REVIEW.", auto="TAYYOR EMAS — UI qarori kerak"),
    "REAL-2025-05-13-1-q39b": dict(
        reason="'1,25 marta kamaygan' — 45b bilan bir xil format muammosi.",
        evidence=["Izoxorik: p₂/p₁ = 320/400 = 0,8 → 1,25 marta kamaygan. Manba kaliti yo'q."],
        options=["Ikki maydon: son 1,25 (±1 %) + yo'nalish 'kamaydi'", "Nisbat r = 0,8", "Qo'lda baholash"],
        rec="22.02 #45b bilan bitta UI qarori.", auto="TAYYOR EMAS — UI qarori kerak"),
    "REAL-2026-01-18-q40b": dict(
        reason="Tomchilar soni butun son. π = 3 bilan butun natija chiqadi, standart π bilan chiqmaydi; INTEGER_EXACT butun bo'lmagan hisobga qo'llanmaydi.",
        evidence=["Savolda π ≈ 3 ANIQ berilgan.", "g = 10, π = 3: N = 2000; g = 9,8, π = 3: N = 1960 (ikkalasi butun).",
                  "π = 3,14159: ≈1909,9 (g = 10), ≈1871,7 (g = 9,8) — butun emas.", "σ(spirt) = 22 mN/m — audit jadval qiymati (muqobil qo'shilmagan)."],
        options=["Faqat π = 3 natijalari (2000; 1960) — aniq moslik (savolda π ≈ 3 berilgani asos)", "π = 3,14 natijalarini ham butunlash bilan qabul qilish (floor/round — usulni Sarvar tanlaydi)",
                 "Qo'lda baholash"],
        rec="Sarvar qarori: tavsiya — savolda π ≈ 3 berilgani uchun 2000 va 1960 (aniq); π = 3,14 natijalari uchun butunlash usuli tanlanmaguncha qabul qilinmaydi.",
        auto="QAROR BILAN TAYYOR BO'LADI (1-variant tanlansa)"),
    "REAL-2025-11-30-q41b": dict(
        reason="Kimning ishi so'ralgani (maydon kuchlarimi yoki tashqi kuchmi) shartda aytilmagan; 'ishora majburiy' siyosati bilan ziddiyat.",
        evidence=["φ₁ = 180 V (uch), φ₂ = 360 V (tomon o'rtasi); A_maydon = q(φ₁ − φ₂) = −1080 nJ, A_tashqi = +1080 nJ (audit hisobi).",
                  "Manba kaliti yo'q (30.11 da kalit yo'q)."],
        options=["Ikkala ishorani qabul qilish: −1080 va +1080 nJ (±1 %)", "Faqat modulni qabul qilish (1080) — ishora majburiy siyosatidan istisno",
                 "Faqat maydon ishi (−1080) — shartda asos yo'q", "Qo'lda baholash"],
        rec="Sarvar qarori: tavsiya — ikkala ishorani qabul qilish (−1080 va +1080), chunki shart ishorani belgilamaydi.",
        auto="QAROR BILAN TAYYOR BO'LADI"),
}

# ---------------------------------------------------------------- C. PENDING_UI_UNIT_LABEL
C_PRECISE = {  # ≈ bilan berilganlar — APPROX qarori (aniq qiymat ±1 %)
    "REAL-2026-09-30-B-q41a": (1.1 / 9e9 * 1e12, "C = R/k = 1,1/9·10⁹ F → pF"),
    "REAL-2026-09-30-B-q41b": (1.1 / 9e9 * 2700 * 1e9, "Q = C·φ = 1,2222·10⁻¹⁰·2700 C → nC"),
    "REAL-2026-09-30-B-q42a": (0.6 / (12.3 * 40), "α = ΔR/(R₀·Δt) = 0,6/(12,3·40)"),
    "REAL-2026-09-30-B-q42b": (12.3 * (1 + 0.6 / (12.3 * 40) * 1000), "R = R₀(1 + α·1000)"),
}
C_RISK = {"38b": "0,2 (m) kiritilishi mumkin", "39a": "5600 (ℓ) kiritilishi mumkin", "39b": "160 000 (J) kiritilishi mumkin",
          "41a": "1,22·10⁻¹⁰ (F) kiritilishi mumkin", "41b": "3,3·10⁻⁷ (C) kiritilishi mumkin", "43a": "0,1 (m) kiritilishi mumkin",
          "42a": "1,22 (10⁻³ K⁻¹ ko'rinishida) kiritilishi mumkin", "45b": "J da kiritilishi mumkin", "44b": "ilmiy ko'rinishda kiritish kerak (3,6·10^17)"}


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def main():
    hashes = {f: sha(os.path.join(AUD, f)) for f in INPUTS}
    v2 = json.load(open(os.path.join(AUD, "answer-key-spec-v2.draft.json"), encoding="utf-8"))
    qs, ss = {}, {}
    for p in glob.glob(os.path.join(PRIV, "app-data", "exams", "*", "questions.json")):
        for q in json.load(open(p, encoding="utf-8"))["questions"]:
            qs[q["id"]] = q
        e = os.path.basename(os.path.dirname(p))
        for s in json.load(open(p.replace("questions.json", "solutions.json"), encoding="utf-8"))["solutions"]:
            ss[f"{e}-q{s['questionNumber']:02d}"] = s
    groups = {"A_PENDING_HIGH_REVIEW": [], "B_NEEDS_MANUAL_REVIEW": [], "C_PENDING_UI_UNIT_LABEL": []}
    ui_table = []
    for sp in v2["specs"]:
        pid, st = sp["partId"], sp["status"]
        if st not in ("PENDING_HIGH_REVIEW", "NEEDS_MANUAL_REVIEW", "PENDING_UI_UNIT_LABEL"):
            continue
        qid, pk = pid[:-1], pid[-1]
        q, s = qs[qid], ss[qid]
        part = next(p["text"] for p in q["parts"] if p["key"] == pk)
        sol = " · ".join((b.get("text") or "") for b in s["blocks"] if b["t"] in ("step",) and b.get("text"))[:600]
        base = {"partId": pid, "exam": sp["examId"], "questionNumber": sp["questionNumber"], "part": pk, "v2Status": st,
                "questionText": q["questionText"], "partText": part, "currentAnswer": sp["finalAnswerText"],
                "solutionSummary": sol, "solutionStatus": s["solutionStatus"]}
        if st == "PENDING_HIGH_REVIEW":
            d = A[pid]
            groups["A_PENDING_HIGH_REVIEW"].append({**base, "linkedHighReview": d["high"], "ambiguity": d["reason"], "evidence": d["evidence"],
                                                    "options": d["options"], "recommendation": d["rec"], "autoGradable": d["auto"],
                                                    "decisionStatus": "PENDING_SARVAR (HIGH)"})
        elif st == "NEEDS_MANUAL_REVIEW":
            d = B[pid]
            groups["B_NEEDS_MANUAL_REVIEW"].append({**base, "ambiguity": d["reason"], "evidence": d["evidence"], "options": d["options"],
                                                    "recommendation": d["rec"], "autoGradable": d["auto"], "decisionStatus": "PENDING_SARVAR"})
        else:
            tg = sp.get("proposedTargets") or sp["targets"]
            unit = sp["uiProposal"]["showExpectedUnit"]
            k = pid.rsplit("-q", 1)[1]
            prec = C_PRECISE.get(pid)
            targets = [{"value": prec[0], "unit": unit, "variant": "aniq qiymat (APPROX qarori)"}] if prec else \
                [{"value": t["value"], "unit": t["unit"], "variant": t["variant"]} for t in tg]
            v2diff = None
            if prec and abs(tg[0]["value"] - prec[0]) > 1e-12 * max(1, abs(prec[0])):
                v2diff = f"V2 da yaxlitlangan {tg[0]['value']:g} saqlangan; APPROX qaroriga ko'ra aniq {prec[0]:.6g} bo'lishi kerak (farq {abs(tg[0]['value'] / prec[0] - 1) * 100:.2f} % — ±1 % ichida)"
            evid = ["Savolda birlik ko'rsatilmagan (UNIT_NOT_ASKED)."]
            if sp["examId"] == "REAL-2026-09-30-B":
                evid.append("Imtihon ko'rsatmasida g = 10 m/s² — g varianti yo'q.")
            if prec:
                evid.append("Aniq hisob: " + prec[1] + f" = {prec[0]:.6g}")
            if pid == "REAL-2026-01-18-q36b":
                evid.append("g berilmagan → G_VALUE_VARIANT: 30° (g = 10) va 29,75° (g = 9,8).")
            row = {**base, "ambiguity": "Kiritish birligi savolda yo'q — bir xil to'g'ri natija turli birlikda turli son bo'ladi.",
                   "evidence": evid,
                   "options": ["Kalit birligini kiritish maydoni yonida ko'rsatish (son o'zgarmaydi)", "SI ga keltirib saqlash va boshqa birlikda ko'rsatish (qayta masshtablash kerak)",
                               "Har qanday 10ⁿ ekvivalentni qabul qilish (TAVSIYA ETILMAYDI — 1000× xatoni ham qabul qiladi)"],
                   "recommendation": "Kalit birligini UI'da ko'rsatish; qayta masshtablash yo'q. UI birlik siyosati tasdiqlansa — READY.",
                   "autoGradable": "UI BIRLIK SIYOSATI TASDIQLANSA TAYYOR", "decisionStatus": "PENDING_SARVAR (bitta umumiy UI qarori)",
                   "proposedTargets": targets, "v2Correction": v2diff}
            groups["C_PENDING_UI_UNIT_LABEL"].append(row)
            ui_table.append({"partId": pid, "currentAnswer": sp["finalAnswerText"],
                             "userEnters": " / ".join(f"{t['value']:.6g}" for t in targets),
                             "displayedUnit": unit, "storedUnit": unit, "rescale": "yo'q",
                             "alternative": ("10⁻³ K⁻¹ ko'rinishida ko'rsatish (30.09-A #42a kabi) — mantissa saqlanadi" if k == "42a"
                                             else "10¹⁷ J ko'rinishida (30.09-A #44b kabi) — mantissa saqlanadi" if k == "44b" else "—"),
                             "riskIfUnitHidden": C_RISK.get(k, "past")})
    cnt = {g: len(v) for g, v in groups.items()}
    corrections = [r["partId"] for r in groups["C_PENDING_UI_UNIT_LABEL"] if r["v2Correction"]]
    summary = {
        "total": sum(cnt.values()), "byGroup": cnt,
        "resolvedInThisPhase": 0,
        "recommendationReady": {"A": "5 — tavsiya bor, HIGH qarori Sarvarda", "B": "11 — 2 tasi qaror bilan tayyor bo'ladi (18.01 #40b, 30.11 #41b), 9 tasi UI/format",
                                "C": "20 — bitta umumiy UI birlik qarori bilan tayyor bo'ladi"},
        "decisionsNeeded": [
            "HIGH 002 (22.02 #39a/b): FINAL izobarik / HAMMAGA_BALL / EXCLUDE / ko'p talqin",
            "HIGH 003 (13.05-2 #36a): bitta talqin / ko'p talqin / HAMMAGA_BALL / EXCLUDE",
            "HIGH 004 (18.01 #43a/b): to'liq yoki yarim burchak / ikkalasi / HAMMAGA_BALL / EXCLUDE",
            "18.01 #40b: π = 3 natijalari (2000; 1960) aniq — ha/yo'q; π = 3,14 uchun butunlash usuli",
            "30.11 #41b: ikkala ishora (−1080/+1080) — ha/yo'q",
            "'Marta kamaygan' (2 qism): son + yo'nalish maydonlari yoki nisbat — UI qarori",
            "Formula javoblar (7 qism): baholanmaydigan 'o'z-o'zini tekshirish' turi — ha/yo'q",
            "UI birlik siyosati (20 qism): kalit birligini ko'rsatish, qayta masshtablashsiz — ha/yo'q; 30.09-B #42a/#44b uchun ko'rinish"],
        "v2ChangeNeeded": {"now": False, "afterDecisions": True,
                           "items": [f"{p}: proposedTargets — aniq qiymat (APPROX qarori)" for p in corrections] +
                                    ["Sarvar qarorlaridan keyin A/B/C holatlari V3 da yangilanadi"]},
        "engineDesignReadiness": "TAYYOR (dizayn uchun): talablar aniq — MULTI_VALUE (51), HYBRID son+matn (22), UI birlik belgisi (20+8), "
                                 "son+yo'nalish maydoni (2), baholanmaydigan formula turi (7). Implementatsiya uchun — Sarvar qarorlari va V3 kerak.",
    }
    doc = {"schemaVersion": 1, "phase": "6C", "status": "DECISION_REVIEW_PENDING_SARVAR", "appliedToDataset": False, "v2Changed": False,
           "inputHashes": hashes, "summary": summary, "groups": groups, "uiUnitTable": ui_table}
    json.dump(doc, open(os.path.join(AUD, "phase6c-decision-review.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc)
    write_public(doc)
    print(json.dumps({"byGroup": cnt, "v2Corrections": corrections}, ensure_ascii=False))


def write_md(doc):
    s = doc["summary"]
    L = ["# PHASE 6C — ochiq qolgan javob qarorlari (MAXFIY)", "",
         "Holat: **DECISION_REVIEW_PENDING_SARVAR**. Dataset, V2 draft, savol/yechim matni, engine o'zgarmagan. Manbada yo'q ma'lumot taxmin qilinmagan.", "",
         "Kirish fayllari (sha256): " + "; ".join(f"`{k}` {v[:16]}…" for k, v in doc["inputHashes"].items()), "",
         "## Xulosa", "", "| Guruh | Qismlar | Holat |", "|---|---:|---|"]
    for g, n in s["byGroup"].items():
        L.append(f"| {g} | {n} | {s['recommendationReady'][g[0]]} |")
    L += ["", "**Sarvar qarori kerak:**", ""] + [f"{i}. {d}" for i, d in enumerate(s["decisionsNeeded"], 1)]
    L += ["", f"**V2 o'zgarishi:** hozir yo'q; qarorlardan keyin V3 da — " + "; ".join(s["v2ChangeNeeded"]["items"]), "",
          f"**Engine dizayniga tayyorlik:** {s['engineDesignReadiness']}", ""]
    titles = {"A_PENDING_HIGH_REVIEW": "A. PENDING_HIGH_REVIEW", "B_NEEDS_MANUAL_REVIEW": "B. NEEDS_MANUAL_REVIEW", "C_PENDING_UI_UNIT_LABEL": "C. PENDING_UI_UNIT_LABEL"}
    for g, rows in doc["groups"].items():
        L += [f"## {titles[g]} — {len(rows)} qism", ""]
        if g == "C_PENDING_UI_UNIT_LABEL":
            L += ["Barcha 20 qism uchun umumiy: noaniqlik — kiritish birligi; variantlar — (1) kalit birligini UI'da ko'rsatish, (2) SI da saqlab qayta masshtablash, "
                  "(3) 10ⁿ ekvivalentlarni qabul qilish (tavsiya etilmaydi). Tavsiya — (1).", "",
                  "| Qism | Savol (tegishli qism) | Mavjud javob | Dalillar | Maqsad | V2 izohi | Avto-baholash |", "|---|---|---|---|---|---|---|"]
            for r in rows:
                tg = "<br>".join(f"{t['value']:.6g} {t['unit']}" for t in r["proposedTargets"])
                L.append(f"| {r['partId'][5:]} | {r['partText'].replace('|', '/')} | {(r['currentAnswer'] or '—').replace('|', '/')} | "
                         f"{'; '.join(r['evidence']).replace('|', '/')} | {tg} | {r['v2Correction'] or '—'} | {r['autoGradable']} |")
            L += ["", "### UI birliklari jadvali", "", "| Qism | Mavjud javob | Foydalanuvchi kiritadi | Ko'rsatiladigan birlik | Kalitdagi birlik | Qayta masshtablash | Muqobil | Birlik ko'rsatilmasa xavf |",
                  "|---|---|---|---|---|---|---|---|"]
            for u in doc["uiUnitTable"]:
                L.append(f"| {u['partId'][5:]} | {(u['currentAnswer'] or '').replace('|', '/')} | {u['userEnters']} | {u['displayedUnit']} | {u['storedUnit']} | "
                         f"{u['rescale']} | {u['alternative']} | {u['riskIfUnitHidden']} |")
            L.append("")
            continue
        for r in rows:
            L += [f"### {r['partId'][5:]} — {r['exam']} #{r['questionNumber']}{r['part']}" + (f" ({r['linkedHighReview']})" if r.get("linkedHighReview") else ""), "",
                  f"- **Savol:** {r['questionText']}", f"- **Qism:** {r['partText']}",
                  f"- **Mavjud javob:** {r['currentAnswer'] or '—'} · yechim holati `{r['solutionStatus']}`",
                  f"- **Yechim (qisqa):** {r['solutionSummary'] or '—'}", f"- **Noaniqlik sababi:** {r['ambiguity']}",
                  "- **Dalillar:**"] + [f"  - {e}" for e in r["evidence"]] + ["- **Variantlar:**"] + [f"  - {o}" for o in r["options"]] + [
                  f"- **Tavsiya:** {r['recommendation']}", f"- **Avtomatik baholash:** {r['autoGradable']}",
                  f"- **Qaror:** ☐ ______ (holat: {r['decisionStatus']})", ""]
    open(os.path.join(AUD, "phase6c-decision-review.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public(doc):
    s = doc["summary"]
    L = ["# PHASE 6C — ochiq qolgan javob qarorlari (ommaviy xulosa)", "",
         "Savol matnlari va javoblar bu faylda yo'q; to'liq: `_private/real-imtihonlar/audit/phase6c-decision-review.{json,md}`.", "",
         "Dataset, V2 draft, savol/yechim matni va engine o'zgartirilmagan.", "",
         "| Guruh | Qismlar | Holat |", "|---|---:|---|"] + [f"| {g} | {n} | {s['recommendationReady'][g[0]]} |" for g, n in s["byGroup"].items()] + [
         "", f"Bu bosqichda hal qilingan: {s['resolvedInThisPhase']} (hammasi Sarvar qarorini kutadi).", "",
         "## Qaror kerak bo'lgan masalalar", ""] + [f"{i}. {d.split(':')[0]}" for i, d in enumerate(s["decisionsNeeded"], 1)] + [
         "", "## V2 va engine", "", f"- V2 o'zgarishi: hozir yo'q; qarorlardan keyin V3 ({len(s['v2ChangeNeeded']['items'])} band).",
         f"- Engine dizayniga tayyorlik: {s['engineDesignReadiness']}"]
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "11_phase6c_decision_review_summary.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
