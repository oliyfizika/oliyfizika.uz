#!/usr/bin/env python3
"""PHASE 6A — ochiq javoblar kalit spetsifikatsiyasining YAKUNIY AUDITI. FAQAT O'QIYDI.
Dataset, engine kodi, savol/yechim matni, oldingi audit va qarorlar jurnali O'ZGARMAYDI — faqat yangi fayllar yoziladi.

  python3 tools/real-imtihonlar/audit/build_phase6a_audit.py

Kirish: answer-key-spec.draft.json, open-answer-key-audit.json, sarvar-decisions-002-tolerance-policy.json,
        milliy-sertifikat/mock-testlar/js/scoring.js (engine imkoniyatlarini aniqlash uchun, faqat o'qiladi)
Natija: _private/real-imtihonlar/audit/phase6a-answer-key-final-audit.{json,md}  (MAXFIY)
        docs/real-imtihonlar/09_phase6a_answer_key_audit_summary.md               (ommaviy, javobsiz)

Tekshiruv usuli (har bir KEY_SPEC_READY qism):
  1) savol matni + yechim bo'yicha qo'lda qayta hisob (Claude, 3-mustaqil tekshiruv; 1-2 — oldingi audit pass1/pass2);
  2) g/π variantlari — formula bilan dasturiy qayta hisob (build_answer_key_spec.py CALC) va qo'lda solishtirish;
  3) maqsad birligi ↔ savolda so'ralgan birlik (avtomatik), maqsad ↔ yakuniy javob nisbati (10ⁿ xatosi uchun);
  4) tolerans turi siyosatga mosligi; variant oynalari ziddiyati; engine (scoring.js) bilan moslik.
Rasmga bog'liq qismlarda kirish ma'lumotlari audit rasm o'qishidan olingan (FIGURE_DEPENDENT) — arifmetika tekshirildi.
"""
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
AUD = os.path.join(ROOT, "_private", "real-imtihonlar", "audit")
sys.path.insert(0, HERE)
import build_open_answer_audit as OA  # noqa: E402  (faqat unit_norm uchun)

FIGURE_DEPENDENT = {"2024-12-01-q42a", "2024-12-01-q42b", "2025-02-22-q41b", "2025-05-13-2-q39a", "2025-05-13-2-q39b",
                    "2025-11-30-q37a", "2025-11-30-q37b", "2026-04-06-1-q36a", "2026-04-06-1-q36b", "2026-04-06-2-q36a",
                    "2026-04-06-2-q36b", "2026-04-06-2-q44a", "2026-04-06-2-q44b", "2026-09-29-1-q45a", "2026-09-29-1-q45b",
                    "2026-09-30-A-q40a", "2026-09-30-A-q40b"}

# ---------------- topilmalar (qo'lda) ----------------
CRITICAL = [
    {"id": "CRIT-01", "partId": "REAL-2024-12-01-q41b", "severity": "CRITICAL",
     "issue": "Maqsad qiymat km da (7,5398), savol esa metr so'raydi (m). O'quvchi to'g'ri 7540 kiritsa — 1000 marta farq, rad etiladi.",
     "proposal": "Spetsifikatsiyada maqsad: 7539,8 m (±1 %); aniq ko'rinish '2400π' (m) saqlanadi. π berilmagan — faqat standart π.",
     "whyNotAuto": "Kalit qiymatini o'zgartirish — spetsifikatsiya tuzatishi; Sarvar tasdig'idan keyin keyingi spec versiyasida qo'llanadi."},
    {"id": "CRIT-02", "partId": "REAL-2026-04-06-2-q41b", "severity": "CRITICAL",
     "issue": "INTEGER_EXACT (aniq moslik) 8·10⁹ ta elektronga qo'llangan. Bu son doimiylardan hisoblanadi: e = 1,602·10⁻¹⁹ yoki k = 8,99·10⁹ bilan 7,99·10⁹ chiqadi — to'g'ri yechim rad etiladi.",
     "proposal": "Bu qismni SIMPLE_NUMERIC (±1 %) deb qayta tasniflash; INTEGER_EXACT faqat sanaladigan butun sonlar (tartib, nuklon soni, n) uchun.",
     "whyNotAuto": "INTEGER_EXACT siyosatini o'zgartirmaslik talab qilingan — qo'llanish doirasini faqat Sarvar belgilaydi."},
    {"id": "BLOCKER-01", "partId": None, "severity": "INTEGRATION_BLOCKER",
     "issue": "Mock engine (scoring.js) har bir qism uchun BITTA 'answer' va absolyut 'tolerance' (yoki test darajasidagi nisbiy relTol) qabul qiladi. "
              "Nisbiy 1 % (test darajasida defaultRelativeTolerance) va aniq/nol (qism 'tolerance' maydoni) — mavjud engine bilan qilinadi. "
              "Lekin spetsifikatsiyada: bir nechta qabul qilinadigan qiymat (g/π variantlari — 51 qism) va son + matn aralash qabul "
              "(aniq ko'rinish '3√2', '7/6'; 'N marta' matni — 22 qism) bor; parseNumber kasr va √ ni o'qimaydi.",
     "proposal": "Engine'ga ixtiyoriy hook: accepted[] ro'yxati (har biri value + tolerance{type,value}), kind:'hybrid' (avval son, keyin normallashtirilgan matn), "
                 "kasr 'a/b' va '√' parse. Engine nusxasi emas — Mock engine'ga orqaga mos kengaytma (alohida tasdiqlangan bosqichda).",
     "whyNotAuto": "Engine kodini o'zgartirish bu bosqichda taqiqlangan."},
]
MEDIUM = [
    {"id": "MED-01", "partId": "REAL-2024-12-01-q43b", "severity": "MEDIUM",
     "issue": "Parser xatosi: qism matnida '($J$)' bor, lekin oxirgi qavs '(relyativistik)' olingani uchun UNIT_NOT_ASKED deb belgilangan.",
     "proposal": "SIMPLE_NUMERIC: 2,25·10⁸ J (±1 %) — mavjud siyosat bilan hal bo'ladi.", "whyNotAuto": "Holat o'zgarishi spec versiyasida qo'llanadi."},
    {"id": "MED-02", "partId": None, "severity": "MEDIUM",
     "issue": "Koeffitsiyent ko'rinishidagi javoblar (4E/3 → 4/3, 0,2c → 0,2, √15·p/c → 3,873 va h.k., 8 qism) faqat UI'da 'javobni E (p, c, A) birligida kiriting' degan ko'rsatma bo'lsa ishlaydi.",
     "proposal": "Engine kiritish maydoni yonida kutilgan birlik/ifoda belgisini ko'rsatsin (savol matni o'zgarmaydi).", "whyNotAuto": "UI qarori."},
]
WARNINGS = [
    ("WARN-01", "REAL-2026-01-18-q38a", "Yuqori sezgirlik: g 2 % o'zgarganda a 20 % o'zgaradi (0,5 ↔ 0,6 m/s²) — ayirma kichik sonlar orasida. Ikkala variant qabul qilinadi; boshqa yaxlitlashlar rad bo'lishi mumkin."),
    ("WARN-02", "REAL-2026-09-29-1-q39a/b", "g_ef = g − a: g = 9,8 da 2,3, g = 10 da 2,5 → natija 8,7 % farq; 4 ta variant (g × π) qabul qilinadi."),
    ("WARN-03", "REAL-2026-09-29-2-q37b", "g = 10 da javob 0 (absolyut 1e-9), g = 9,8 da 0,2 m/s² — ikki xil 'to'g'ri' javob; siyosatga mos."),
    ("WARN-04", "TABLE_CONSTANT (10 qism)", "Faqat audit jadval qiymati qabul qilinadi (σ(spirt) = 22 mN/m, c(oltin) = 130, q(gaz) = 44 MJ/kg, p₀ = 100 kPa, σ(suv) = 73 mN/m). Boshqa darslik jadvallaridagi qiymat >1 % farq qilsa (masalan c(oltin) = 126) — rad etiladi. Siyosat bo'yicha tasdiqlanmagan konstanta qo'shilmadi."),
    ("WARN-05", "PI_APPROX_3 (savolda π ≈ 3 berilgan 7 qism)", "Savol π ≈ 3 deb aytgan bo'lsa ham siyosat π = 3,14 natijasini ham qabul qiladi — ataylab yumshoq qoida, ma'lumot uchun."),
    ("WARN-06", "REAL-2024-12-01-q39a, REAL-2026-09-29-1-q40b", "Ishora majburiy: 'Gaz qancha ish bajargan?' (−60 J) — 'qancha' so'zi o'quvchini modul yozishga undashi mumkin; 29.09-1 #40b 'algebraik qiymat' deb aniq so'raydi."),
    ("WARN-07", "REAL-2024-12-01-q36a", "Talqin: 30° → 60° fazaga eng qisqa o'tish (T/12) olingan; 30° → 120° o'tishda ham U = 3 mJ, lekin 'kamaydi/ortdi' monoton jarayonni bildiradi — past xavf."),
    ("WARN-08", "REAL-2025-11-30-q36a", "Talqin: 'ikkinchi bo'lak' = katta (3,2 kg) bo'lak (K = 4 kJ). Kichik bo'lakning yerdagi K = 6,4 kJ — boshqa talqin."),
    ("WARN-09", "REAL-2026-04-06-2-q44b", "Audit farazi (ko'zgu holati) 1-bosqich qarorlari bilan qabul qilingan — faraz rasmga bog'liq."),
    ("WARN-10", "REAL-2026-04-06-1-q39a/b", "p₀ = 100 kPa (jadval) olingan; p₀ = 101,3 kPa bilan natija ≈0,8 % farq — ±1 % ichida."),
]

# ---------------- qolgan qismlar: guruh va masala ----------------
APPROX_PROPOSAL = "Yaxlitlanmagan aniq qiymat ±1 % (SIMPLE siyosatining kengaytmasi); ko'rsatilgan yaxlitlangan javob ham shu oynaga tushadi."
REMAINING = {
    # A — mavjud siyosat bilan hal bo'ladi
    "REAL-2026-09-30-A-q42a": ("A_EXISTING_POLICY", "Birlik '10⁻³ K⁻¹'", "SCALED_UNIT: mantissa 4 (±1 %)", "—"),
    "REAL-2026-09-30-A-q44b": ("A_EXISTING_POLICY", "Birlik '10¹⁷ J'", "SCALED_UNIT: mantissa 1,8 (±1 %)", "—"),
    "REAL-2024-12-01-q43b": ("A_EXISTING_POLICY", "Parser xatosi (MED-01): J so'ralgan", "SIMPLE_NUMERIC: 2,25·10⁸ J (±1 %)", "—"),
    # C — fizik/matematik qo'lda tekshiruv
    "REAL-2026-01-18-q40b": ("C_MANUAL_PHYSICS", "Tomchilar soni: π = 3 bilan 2000 / 1960 (butun), π = 3,14 bilan ≈1909,9 / ≈1871,7 (butun emas)",
                             "π = 3 bilan butun natijalarni aniq qabul qilish; π = 3,14 natijalari uchun pastga/yaqin butunlash qoidasini Sarvar tanlasin",
                             "INTEGER_EXACT butun bo'lmagan hisob natijasiga qo'llanmaydi; butunlash usuli (floor/round) — fizik talqin"),
    # E — manba xatosi
    "REAL-2025-02-22-q39a": ("E_SOURCE_DEFECT", "Jarayon turi berilmagan (HIGH 002)", "HIGH 002 qaroridan keyin; siyosat bo'yicha PENDING", "Bir nechta fizik javob mumkin (3 marta / o'zgarmaydi / 9 marta)"),
    "REAL-2025-02-22-q39b": ("E_SOURCE_DEFECT", "Jarayon turi berilmagan (HIGH 002)", "HIGH 002 qaroridan keyin; siyosat bo'yicha PENDING", "24 / 60 / 15 kJ — shartga bog'liq"),
    "REAL-2025-05-13-2-q36a": ("E_SOURCE_DEFECT", "Otish yo'nalishi berilmagan (HIGH 003)", "HIGH 003 qaroridan keyin; PENDING", "4 s / ≈4,53 s / ≈3,53 s"),
    "REAL-2026-01-18-q43a": ("E_SOURCE_DEFECT", "Yoyilish burchagi talqini (HIGH 004)", "HIGH 004 qaroridan keyin; PENDING", "8 m yoki 16 m — 2 marta farq"),
    "REAL-2026-01-18-q43b": ("E_SOURCE_DEFECT", "Yoyilish burchagi talqini (HIGH 004)", "HIGH 004 qaroridan keyin; PENDING", "≈3,98 yoki ≈0,99 W/m² — 4 marta farq"),
    "REAL-2025-11-30-q41b": ("E_SOURCE_DEFECT", "|A| = 1080 nJ — kimning ishi (maydonmi, tashqi kuchmi) so'ralgani shartda yo'q",
                             "Variant 1: −1080 nJ (maydon ishi) va +1080 nJ (tashqi kuch ishi) ikkalasini qabul qilish; variant 2: qismni avtomatik baholashdan chiqarish",
                             "'Ishora majburiy' siyosati bilan ziddiyat: shart ishorani aniqlamaydi"),
    # D — format / birlik siyosati
    "REAL-2025-02-22-q45b": ("D_FORMAT_UNCLEAR", "'2 marta kamayadi'", "Kiritish formati: nisbat r = yangi/eski = 0,5 (yoki 'son + yo'nalish' tanlovi)", "'2' kiritilsa o'sishmi, kamayishmi — aniqlab bo'lmaydi"),
    "REAL-2025-05-13-1-q39b": ("D_FORMAT_UNCLEAR", "'1,25 marta kamaygan'", "Nisbat r = 0,8 (yoki 'son + yo'nalish')", "'1,25' yo'nalishsiz noaniq"),
    "REAL-2026-01-18-q36b": ("D_FORMAT_UNCLEAR", "Burchak, birlik so'ralmagan (30°; g = 9,8 da 29,75°)", "UNIT_NOT_ASKED: kanonik birlik — gradus; UI'da '°' belgisi", "Radian (0,524) kiritilsa rad etiladi — kanonik birlik ko'rsatilmasa"),
}
for pid in ["REAL-2025-02-22-q41a", "REAL-2025-02-22-q43a", "REAL-2025-02-22-q43b", "REAL-2025-05-13-1-q41a", "REAL-2025-05-13-1-q41b",
            "REAL-2026-01-18-q41a", "REAL-2026-01-18-q41b"]:
    REMAINING[pid] = ("D_FORMAT_UNCLEAR", "Ko'p belgili formula javob", "Avtomatik baholashdan chiqarish yoki qo'lda baholash (yoki koeffitsiyent shakliga keltirish — faqat bitta berilgan kattalik bo'lsa)",
                      "Formula tengligini (simvolik ekvivalentlik) xavfsiz tekshirib bo'lmaydi; noto'g'ri ijobiy/salbiy natija xavfi")
B30 = {"36a": ("30 m", "m", "LOW"), "36b": ("10 m", "m", "LOW"), "37a": ("2 m/s²", "m/s²", "LOW"), "37b": ("4,8 N", "N", "LOW"),
       "38a": ("400 N/m", "N/m", "LOW"), "38b": ("20 cm", "cm (yoki 0,2 m)", "HIGH"), "39a": ("5,6 m³", "m³ (yoki 5600 l)", "MEDIUM"),
       "39b": ("160 kJ", "kJ (yoki 160 000 J)", "HIGH"), "40a": ("70 J", "J", "LOW"), "40b": ("220 J", "J", "LOW"),
       "41a": ("≈122 pF", "pF (yoki 1,22·10⁻¹⁰ F)", "HIGH"), "41b": ("≈330 nC", "nC (yoki 3,3·10⁻⁷ C)", "HIGH"),
       "42a": ("≈1,22·10⁻³ K⁻¹", "K⁻¹", "MEDIUM"), "42b": ("≈27,3 Ω", "Ω", "LOW"), "43a": ("10 cm", "cm (yoki 0,1 m)", "HIGH"),
       "43b": ("7,5 dptr", "dptr", "LOW"), "44a": ("7,2 m", "m", "LOW"), "44b": ("3,6·10¹⁷ J", "J", "LOW"), "45b": ("10,2 eV", "eV (yoki J)", "MEDIUM")}
for k, (ans, unit, risk) in B30.items():
    REMAINING[f"REAL-2026-09-30-B-q{k}"] = ("D_FORMAT_UNCLEAR", f"Birlik so'ralmagan; javob {ans}; mumkin bo'lgan birlik(lar): {unit}; adashish xavfi {risk}",
                                            "UNIT_NOT_ASKED (birlik kiritilmaydi) + kanonik birlik = kalit birligi, UI'da kiritish maydoni yonida ko'rsatiladi",
                                            "Kanonik birlik ko'rsatilmasa bir xil to'g'ri natija 10³–10¹⁰ marta farqli son bo'lib kiritilishi mumkin; 10ⁿ ekvivalentlarni avtomatik qabul qilish 1000× xatolarni ham qabul qiladi")


def main():
    spec = json.load(open(os.path.join(AUD, "answer-key-spec.draft.json"), encoding="utf-8"))
    oa = {i["partId"]: i for i in json.load(open(os.path.join(AUD, "open-answer-key-audit.json"), encoding="utf-8"))["items"]}
    scoring = open(os.path.join(ROOT, "milliy-sertifikat", "mock-testlar", "js", "scoring.js"), encoding="utf-8").read()
    engine = {"singleAnswerPerPart": "isNear(v, p.answer" in scoring, "absoluteToleranceField": "p.tolerance" in scoring,
              "textKindWithAccept": 'p.kind === "text"' in scoring,
              "parsesFraction": False,  # parseNumber: faqat o'nlik va a·10^n (kod o'qib tekshirildi)
              "parsesSqrt": "√" in scoring, "multiValueAccept": "accepted[" in scoring or "p.accepted" in scoring}
    crit_ids = {c["partId"]: c["id"] for c in CRITICAL + MEDIUM if c["partId"]}
    rows, auto_checks = [], []
    for s in spec["specs"]:
        pid = s["partId"]
        short = pid[5:]
        a = oa[pid]
        r = {"partId": pid, "previousStatus": s["status"], "finalAnswerText": s["finalAnswerText"], "targets": s["targets"],
             "acceptText": s["acceptText"], "policies": list(dict.fromkeys(s["policiesApplied"])), "findings": [], "engineNeeds": []}
        if s["status"] == "KEY_SPEC_READY":
            r["verification"] = "FIGURE_DEPENDENT (arifmetika tekshirildi)" if short in FIGURE_DEPENDENT else "RECOMPUTED"
            if s.get("calc"):
                r["verification"] += " + g/π formula"
            # avtomatik: birlik va nisbat
            for t in s["targets"]:
                if a["askedUnit"] and t["unit"] and OA.unit_norm(a["askedUnit"]) != OA.unit_norm(t["unit"]) and not (a["askedUnit"] == "C" and t["unit"] == "°C"):
                    r["findings"].append(f"BIRLIK: so'ralgan {a['askedUnit']}, maqsad {t['unit']}")
            if len(s["targets"]) > 1:
                r["engineNeeds"].append("MULTI_VALUE")
            if s["acceptText"] and s["targets"]:
                r["engineNeeds"].append("HYBRID_NUM_TEXT")
            if s["acceptText"] and not s["targets"]:
                r["engineNeeds"].append("TEXT_KIND")
            if s.get("normalizationGroup") in ("COEFFICIENT_OF_GIVEN",):
                r["engineNeeds"].append("UNIT_HINT_UI")
            if any(t["tolerance"]["type"] != "relative" for t in s["targets"]):
                r["engineNeeds"].append("NON_RELATIVE_TOLERANCE")
            if pid in crit_ids:
                r["findings"].append(crit_ids[pid])
            if pid == "REAL-2026-04-06-2-q41b":
                r["auditStatus"] = "NEEDS_SARVAR_DECISION"
                r["group"] = "B_SARVAR_DECISION"
                r["issue"] = "INTEGER_EXACT doimiylardan hisoblangan songa qo'llangan (CRIT-02)"
                r["proposal"] = CRITICAL[1]["proposal"]
                r["whyNotAuto"] = CRITICAL[1]["whyNotAuto"]
            elif pid == "REAL-2024-12-01-q41b":
                r["auditStatus"] = "PASS_AFTER_SPEC_CORRECTION"
            elif {"HYBRID_NUM_TEXT", "UNIT_HINT_UI"} & set(r["engineNeeds"]):
                r["auditStatus"] = "PASS_ENGINE_FEATURE_REQUIRED"
            else:
                r["auditStatus"] = "PASS"
        else:
            g = REMAINING.get(pid)
            if g is None:  # APPROX — siyosat yo'q
                note = next((n for n in s["notes"] if "aniq qiymat" in n or "±1 %" in n), "")
                g = ("B_SARVAR_DECISION", "≈ bilan berilgan javob — APPROX siyosati berilmagan" + (f" ({note})" if note else ""), APPROX_PROPOSAL,
                     "Siyosat yo'q: qaysi qiymat (aniq yoki yaxlitlangan) maqsad bo'lishini Sarvar belgilashi kerak")
            r["group"], r["issue"], r["proposal"], r["whyNotAuto"] = g
            r["auditStatus"] = {"A_EXISTING_POLICY": "RESOLVABLE_EXISTING_POLICY", "B_SARVAR_DECISION": "NEEDS_SARVAR_DECISION",
                                "C_MANUAL_PHYSICS": "NEEDS_MANUAL_CHECK", "D_FORMAT_UNCLEAR": "FORMAT_POLICY_UNCLEAR",
                                "E_SOURCE_DEFECT": "SOURCE_DEFECT_UNSAFE"}[g[0]]
            if s["status"] == "PENDING_HIGH_REVIEW":
                r["auditStatus"] = "SOURCE_DEFECT_UNSAFE (PENDING_HIGH_REVIEW)"
        rows.append(r)
    st = Counter(r["auditStatus"] for r in rows)
    grp = Counter(r.get("group") for r in rows if r.get("group"))
    needs = Counter(n for r in rows if r["previousStatus"] == "KEY_SPEC_READY" for n in set(r["engineNeeds"]))
    ready = [r for r in rows if r["previousStatus"] == "KEY_SPEC_READY"]
    summary = {
        "parts": len(rows), "byAuditStatus": dict(st), "remainingByGroup": dict(grp),
        "readyAudited": len(ready),
        "readyVerification": dict(Counter(r["verification"].split(" (")[0].split(" +")[0] for r in ready)),
        "readyPass": sum(r["auditStatus"] == "PASS" for r in ready),
        "readyPassEngineFeature": sum(r["auditStatus"] == "PASS_ENGINE_FEATURE_REQUIRED" for r in ready),
        "readyPassAfterCorrection": sum(r["auditStatus"] == "PASS_AFTER_SPEC_CORRECTION" for r in ready),
        "readyMovedToDecision": sum(r["auditStatus"] == "NEEDS_SARVAR_DECISION" for r in ready),
        "engineNeedsAmongReady": dict(needs),
        "engineCompatibleNow": sum(1 for r in ready if r["auditStatus"] in ("PASS",) and not ({"MULTI_VALUE", "HYBRID_NUM_TEXT", "UNIT_HINT_UI"} & set(r["engineNeeds"]))),
        "needsMultiValueHook": sum(1 for r in ready if "MULTI_VALUE" in r["engineNeeds"]),
        "needsHybridOrUiHint": sum(1 for r in ready if {"HYBRID_NUM_TEXT", "UNIT_HINT_UI"} & set(r["engineNeeds"])),
        "critical": len(CRITICAL), "medium": len(MEDIUM), "warnings": len(WARNINGS), "engineCapabilities": engine,
    }
    readiness = {
        "data": "SHARTLI TAYYOR — 185/240 qism kaliti tasdiqlandi (1 tasi spec tuzatishi bilan); 55 qism qaror/format kutmoqda",
        "engine": "QISMAN — mavjud scoring.js ko'p qiymatli qabul va son+matn aralash tekshiruvni qo'llamaydi, kasr/√ ni o'qimaydi (BLOCKER-01)",
        "overall": "Integratsiyaga HALI TAYYOR EMAS. Keyingi shartlar: (1) CRIT-01/02 va MED-01 bo'yicha qaror va spec v2; (2) qolgan 55 qism qarorlari; (3) engine hook'lari (alohida tasdiqlangan bosqich).",
        "engineFit": (f"Mavjud engine bilan hozir ishlaydigan: {summary['engineCompatibleNow']} qism (defaultRelativeTolerance = 0,01; aniq/nol uchun absolyut 'tolerance'; matn — kind:'text'). "
                      f"Ko'p qiymat hook'i kerak: {summary['needsMultiValueHook']}. Son+matn / UI birlik belgisi kerak: {summary['needsHybridOrUiHint']}."),
    }
    doc = {"schemaVersion": 1, "phase": "6A", "status": "AUDIT_COMPLETE_PENDING_SARVAR", "appliedToDataset": False, "engineChanged": False,
           "inputs": {"spec": "answer-key-spec.draft.json", "policy": "sarvar-decisions-002-tolerance-policy.json"},
           "policyUnchanged": ["SIMPLE_NUMERIC ±1%", "G_VALUE_VARIANT 9.8/10", "INTEGER_EXACT", "ZERO_VALUE 1e-9", "NEGATIVE sign mandatory",
                               "SCALED_UNIT mantissa only", "UNIT_NOT_ASKED no unit input", "BLOCKED pending HIGH", "TABLE_CONSTANT no unconfirmed constants"],
           "summary": summary, "readiness": readiness, "critical": CRITICAL, "medium": MEDIUM,
           "warnings": [{"id": i, "scope": s, "note": n} for i, s, n in WARNINGS], "parts": rows}
    json.dump(doc, open(os.path.join(AUD, "phase6a-answer-key-final-audit.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc)
    write_public(doc)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


def fmt_targets(r):
    out = []
    for t in r["targets"]:
        tol = t["tolerance"]
        tt = {"relative": "±1 %", "absolute": f"±{tol['value']:g}", "exact": "aniq"}[tol["type"]]
        out.append(f"{t['value']:.5g} {t['unit'] or ''} ({tt})".replace("  ", " "))
    return "<br>".join(out) or "—"


def write_md(doc):
    s = doc["summary"]
    L = ["# PHASE 6A — ochiq javoblar kaliti: yakuniy audit (MAXFIY)", "",
         "Holat: **AUDIT_COMPLETE_PENDING_SARVAR**. Dataset, engine, savol/yechim matni va oldingi fayllar o'zgarmagan.", "",
         "## 1. Statuslar (240 qism)", "", "| Audit holati | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byAuditStatus"].items())] + [
         "", "## 2. Integratsiyaga tayyorlik", ""] + [f"- **{k}**: {v}" for k, v in doc["readiness"].items()] + [
         "", "## 3. Kritik topilmalar", ""]
    for c in doc["critical"] + doc["medium"]:
        L += [f"### {c['id']} ({c['severity']}) — {c['partId'] or 'umumiy'}", "", f"- Muammo: {c['issue']}", f"- Taklif: {c['proposal']}", f"- Nega avtomatik emas: {c['whyNotAuto']}", ""]
    L += ["## 4. Ogohlantirishlar", ""] + [f"- **{w['id']}** ({w['scope']}): {w['note']}" for w in doc["warnings"]]
    L += ["", f"## 5. KEY_SPEC_READY — {s['readyAudited']} qism auditi", "",
          f"PASS {s['readyPass']} · PASS (engine imkoniyati kerak) {s['readyPassEngineFeature']} · spec tuzatishi bilan {s['readyPassAfterCorrection']} · qarorga o'tkazildi {s['readyMovedToDecision']}", "",
          "Engine ehtiyojlari: " + ", ".join(f"{k} {v}" for k, v in sorted(s["engineNeedsAmongReady"].items())), "",
          "| Qism | Yakuniy javob | Maqsad(lar) | Tekshiruv | Engine ehtiyoji | Audit | Izoh |", "|---|---|---|---|---|---|---|"]
    for r in doc["parts"]:
        if r["previousStatus"] != "KEY_SPEC_READY":
            continue
        L.append(f"| {r['partId'][5:]} | {(r['finalAnswerText'] or '—').replace('|', '/')} | {fmt_targets(r)} | {r['verification']} | "
                 f"{', '.join(r['engineNeeds']) or '—'} | {r['auditStatus']} | {'; '.join(r['findings']) or '—'} |")
    L += ["", "## 6. Qolgan qismlar — har biri alohida", "", "| Qism | Guruh | Mavjud javob | Muammo | Taklif | Nega avtomatik qaror xavfli |", "|---|---|---|---|---|---|"]
    for r in sorted((r for r in doc["parts"] if r.get("group")), key=lambda r: (r["group"], r["partId"])):
        L.append(f"| {r['partId'][5:]} | {r['group']} | {(r['finalAnswerText'] or '—').replace('|', '/')} | {r['issue'].replace('|', '/')} | "
                 f"{r['proposal'].replace('|', '/')} | {r['whyNotAuto'].replace('|', '/')} |")
    open(os.path.join(AUD, "phase6a-answer-key-final-audit.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public(doc):
    s = doc["summary"]
    L = ["# PHASE 6A — ochiq javoblar kaliti: yakuniy audit (ommaviy xulosa)", "",
         "Javoblar bu faylda yo'q. To'liq: `_private/real-imtihonlar/audit/phase6a-answer-key-final-audit.{json,md}`.", "",
         "| Audit holati | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byAuditStatus"].items())] + [
         "", "| Qolgan qismlar guruhi | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["remainingByGroup"].items())] + [
         "", f"Kritik: {s['critical']} (shundan 1 ta integratsiya blokeri) · o'rta: {s['medium']} · ogohlantirish: {s['warnings']}", "",
         "## Tayyorlik", ""] + [f"- **{k}**: {v}" for k, v in doc["readiness"].items()]
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "09_phase6a_answer_key_audit_summary.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
