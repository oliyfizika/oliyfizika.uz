#!/usr/bin/env python3
"""PHASE 6D — Sarvar qarorlari (2026-10-09): savol shartlariga TAHRIRIY qo'shimchalar + kalit spetsifikatsiyasi V3.

Buzilmaydigan (non-destructive) yondashuv:
  • dataset / app-data / V2 / oldingi audit fayllari O'ZGARMAYDI;
  • tahrirlar alohida "overlay" faylida: asl matn (+ sha256) va tahrirlangan matn yonma-yon, tahrirlovchi, sana, sabab;
  • sahifada tahrirlangan savol "Tahrirlangan shart" belgisi bilan ko'rsatilishi kerak (asl PDF matni saqlanadi).

  python3 tools/real-imtihonlar/audit/build_editorial_v3.py

Natija:
  _private/real-imtihonlar/editorial/question-edits-v1.{json,md}
  _private/real-imtihonlar/audit/sarvar-decisions-003.{json,md}
  _private/real-imtihonlar/audit/answer-key-spec-v3.draft.{json,md}
  docs/real-imtihonlar/12_editorial_edits_v3_summary.md
  docs/real-imtihonlar/13_ui_unit_label_policy.md
"""
import copy
import hashlib
import json
import math
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
AUD = os.path.join(PRIV, "audit")
EDIT_DIR = os.path.join(PRIV, "editorial")
sys.path.insert(0, HERE)
import build_open_answer_audit as OA  # noqa: E402

REL, ABS0 = 0.01, 1e-9
DATE, EDITOR = "2026-10-09", "Sarvar Amirov (qaror), Claude (matn loyihasi)"
PI = math.pi


def tgt(v, unit, variant, ttype="relative", tval=REL):
    return {"value": v, "unit": unit, "variant": variant, "tolerance": {"type": ttype, "value": tval}}


# ------------------------------------------------------------------ tahrirlar (savol darajasida)
# stem: (eski bo'lak, yangi bo'lak) — aniq almashtirish; asl matnda bo'lak topilmasa skript to'xtaydi.
EDITS = [
    dict(qid="REAL-2025-02-22-q39", decision="1", high="RE-REVIEW-002",
         reason="Jarayon turi qo'shildi (izobarik) — shart yetarli bo'ldi; manba kaliti (3 marta ortgan; 24 kJ) bilan mos.",
         stem=[("ideal gazga 60 kJ", "ideal gazga o‘zgarmas bosimda 60 kJ")], parts={},
         solution={"a": ["Izobarik: $V/T=\\mathrm{const}$ → $T_2/T_1=V_2/V_1=3$", "Javob: 3 marta ortgan"],
                   "b": ["$Q=\\tfrac52p\\Delta V$, $A=p\\Delta V=\\tfrac25Q=\\tfrac25\\cdot60=24$ kJ", "Javob: 24 kJ"]}),
    dict(qid="REAL-2025-05-13-2-q36", decision="2", high="RE-REVIEW-003",
         reason="Otish yo'nalishi qo'shildi (gorizontal) — t = 4 s.",
         stem=[("boshlang‘ich tezlik bilan otildi", "boshlang‘ich tezlik bilan gorizontal otildi")], parts={},
         solution={"a": ["Gorizontal otilganda tik tezlik 0: $h=\\dfrac{gt^2}{2}\\Rightarrow t=\\sqrt{\\dfrac{2h}{g}}=\\sqrt{\\dfrac{160}{10}}=4$ s", "Javob: 4 s"],
                   "b": ["$\\Delta p=mgt=1{,}2\\cdot10\\cdot3=36$ kg·m/s (3 s < 4 s — jism havoda)", "Javob: 36 kg·m/s"]}),
    dict(qid="REAL-2026-01-18-q43", decision="3", high="RE-REVIEW-004",
         reason="'Yoyilish burchagi' to'liq (konus uchidagi) burchak ekani aniqlandi — D = 8 m, I ≈ 3,98 W/m².",
         stem=[("Nurning yoyilish burchagi", "Nurning to‘la yoyilish burchagi (konus uchidagi burchak)")], parts={},
         solution={"a": ["$D=2L\\,\\mathrm{tg}\\dfrac\\alpha2\\approx L\\alpha=8000\\cdot10^{-3}=8$ m", "Javob: 8 m"],
                   "b": ["$I=\\dfrac{P}{\\pi D^2/4}=\\dfrac{200}{16\\pi}\\approx3{,}98\\ \\mathrm{W/m^2}$", "Javob: ≈3,98 W/m²"]}),
    dict(qid="REAL-2026-01-18-q40", decision="4", high=None,
         reason="Hisob oson bo'lishi uchun jadval kattaliklari va g shartga qo'shildi: σ = 22 mN/m, ρ = 800 kg/m³, g = 10 m/s² — tomchilar soni butun (2000).",
         stem=[("bo‘lgan spirt bor. $\\pi \\approx 3$.",
                "bo‘lgan spirt bor. Spirtning sirt taranglik koeffitsiyenti 22 mN/m, zichligi 800 kg/m$^3$. $g = 10$ m/s$^2$, $\\pi \\approx 3$.")], parts={},
         solution={"a": ["Uzilish sharti: $mg=\\sigma\\pi d$ → $m=\\dfrac{0{,}022\\cdot3\\cdot0{,}004}{10}=2{,}64\\cdot10^{-5}$ kg", "Javob: 26,4 mg"],
                   "b": ["Spirt massasi $M=\\rho V=800\\cdot66\\cdot10^{-6}=52{,}8\\cdot10^{-3}$ kg; $N=\\dfrac{M}{m}=\\dfrac{52{,}8\\cdot10^{-3}}{2{,}64\\cdot10^{-5}}=2000$", "Javob: 2000"]}),
    dict(qid="REAL-2025-11-30-q41", decision="5", high=None,
         reason="Kimning ishi so'ralgani aniqlandi: elektr maydon kuchlari ishi → −1080 nJ (ishora majburiy).",
         stem=[], parts={"b": [("ko‘chirishda bajarilgan ishni", "ko‘chirishda elektr maydon kuchlari bajargan ishni")]},
         solution={"b": ["$\\varphi_2=k\\dfrac{(8-4)\\cdot10^{-9}}{0{,}1}=360$ V (tomon o'rtasi)", "$A=q_0(\\varphi_1-\\varphi_2)=6\\cdot10^{-9}\\cdot(180-360)=-1{,}08\\cdot10^{-6}$ J", "Javob: −1080 nJ"]}),
    # 7 — formula javoblar: shartga son qiymatlar qo'shildi, javob son bo'ldi
    dict(qid="REAL-2025-02-22-q41", decision="7", high=None,
         reason="E va l son qiymatlari berildi; ΔK eV da so'raladi (rasm: AB maydon yo'nalishiga perpendikulyardan 30° og'gan).",
         stem=[("bir jinsli E elektr maydonda", "kuchlanganligi $E = 2$ kV/m bo‘lgan bir jinsli elektr maydonda"),
               ("bo‘lgan $l$ masofaga", "bo‘lgan $l = 10$ cm masofaga")],
         parts={"a": [("Kinetik energiya o‘zgarishini aniqlang.", "Kinetik energiya o‘zgarishini (eV) aniqlang.")]},
         solution={"a": ["Maydon bo'ylab siljish $d=l\\sin30^\\circ=5$ cm", "$\\Delta K=eEd=e\\cdot2000\\cdot0{,}05=100$ eV", "Javob: 100 eV"]}),
    dict(qid="REAL-2025-02-22-q43", decision="7", high=None,
         reason="B, r va proton kattaliklari son bilan berildi; javoblar MHz va km/s da.",
         stem=[("Proton induksiyasi B ga teng", "Proton induksiyasi $B = 0{,}2$ T ga teng"),
               ("va $r$ radiusli aylana", "va $r = 5$ cm radiusli aylana"),
               ("$e-$elekentar zaryad. $m-$ protonning massasi.", "$e = 1{,}6\\cdot10^{-19}$ C — elementar zaryad, $m = 1{,}67\\cdot10^{-27}$ kg — protonning massasi.")],
         parts={"a": [("Aylanish chastotasini aniqlang.", "Aylanish chastotasini (MHz) aniqlang.")],
                "b": [("Protonning tezligini aniqlang.", "Protonning tezligini (km/s) aniqlang.")]},
         solution={"a": ["$\\nu=\\dfrac{eB}{2\\pi m}=\\dfrac{1{,}6\\cdot10^{-19}\\cdot0{,}2}{2\\pi\\cdot1{,}67\\cdot10^{-27}}\\approx3{,}05\\cdot10^6$ Hz", "Javob: ≈3,05 MHz"],
                   "b": ["$\\upsilon=\\dfrac{eBr}{m}=\\dfrac{1{,}6\\cdot10^{-19}\\cdot0{,}2\\cdot0{,}05}{1{,}67\\cdot10^{-27}}\\approx9{,}58\\cdot10^5$ m/s", "Javob: ≈958 km/s"]}),
    dict(qid="REAL-2025-05-13-1-q41", decision="7", high=None,
         reason="Q, q, m, r, k son bilan berildi; υ = 2 m/s, K = 0,2 µJ.",
         stem=[("va o‘zaro gravitatsion ta’sirni inobatga olmang.",
                "va o‘zaro gravitatsion ta’sirni inobatga olmang. $Q = 4$ nC, $q = 1$ nC, $m = 0{,}1$ mg, $r = 9$ cm, $k = 9\\cdot10^9$ N·m$^2$/C$^2$.")],
         parts={"a": [("$-q$ zaryadning tezligini aniqlang.", "$-q$ zaryadning tezligini (m/s) aniqlang.")],
                "b": [("$-q$ zaryadning kinetik energiyasini toping.", "$-q$ zaryadning kinetik energiyasini ($\\mu$J) toping.")]},
         solution={"a": ["$\\dfrac{kQq}{r^2}=\\dfrac{m\\upsilon^2}{r}\\Rightarrow\\upsilon=\\sqrt{\\dfrac{kQq}{mr}}=\\sqrt{\\dfrac{9\\cdot10^9\\cdot4\\cdot10^{-9}\\cdot10^{-9}}{10^{-7}\\cdot0{,}09}}=2$ m/s", "Javob: 2 m/s"],
                   "b": ["$K=\\dfrac{m\\upsilon^2}{2}=\\dfrac{kQq}{2r}=\\dfrac{3{,}6\\cdot10^{-8}}{0{,}18}=2\\cdot10^{-7}$ J", "Javob: 0,2 µJ"]}),
    dict(qid="REAL-2026-01-18-q41", decision="7", high=None,
         reason="Kamchilik to'ldirildi: aylanish o'qi va boshlang'ich holat (rasmga mos: B vertikal, o'q gorizontal, t = 0 da halqa tekisligi B ga perpendikulyar), "
                "son qiymatlar berildi; 'ifoda' o'rniga maksimal EYuK va maksimal quvvat so'raladi; 'ramka' → 'halqa'.",
         stem=[("Qarshiligi $R$ bo‘lgan tokli halqa gorizontal tekislikda doimiy $\\omega$ burchak tezlik bilan aylanmoqda. Magnit maydon induksiyasi $B$ ga, halqa yuzasi esa $S$ ga teng.",
                "Qarshiligi $R = 0{,}5\\ \\Omega$, yuzasi $S = 100$ cm$^2$ bo‘lgan halqa induksiyasi $B = 0{,}2$ T bo‘lgan vertikal yo‘nalgan bir jinsli magnit maydonda "
                "gorizontal o‘q atrofida doimiy $\\omega = 100$ rad/s burchak tezlik bilan aylanmoqda. $t = 0$ da halqa tekisligi magnit induksiya chiziqlariga perpendikulyar.")],
         parts={"a": [("Ramkada hosil bo‘layotgan induksion EYuK ning ifodasini aniqlang.", "Halqada hosil bo‘ladigan induksion EYuK ning maksimal qiymatini (V) aniqlang.")],
                "b": [("Ramkada hosil bo‘layotgan quvvat ifodasini aniqlang.", "Halqada ajraladigan maksimal quvvatni (mW) aniqlang.")]},
         solution={"a": ["$\\Phi=BS\\cos\\omega t$, $\\mathcal E=BS\\omega\\sin\\omega t$; $\\mathcal E_{\\max}=BS\\omega=0{,}2\\cdot0{,}01\\cdot100=0{,}2$ V", "Javob: 0,2 V"],
                   "b": ["$P_{\\max}=\\dfrac{\\mathcal E_{\\max}^2}{R}=\\dfrac{0{,}04}{0{,}5}=0{,}08$ W", "Javob: 80 mW"]}),
]

# ------------------------------------------------------------------ V3 maqsadlari (hisob bilan)
e, mp = 1.6e-19, 1.67e-27
V3_TARGETS = {
    "REAL-2025-02-22-q39a": dict(targets=[tgt(3, "", "normalized", "exact", 0)], acceptText=["3", "3 marta ortgan", "3 marta ortdi"], group="FACTOR_INCREASE",
                                 policies=["NON_NUMERIC_QUALIFIER"], eng=["HYBRID_NUM_TEXT"]),
    "REAL-2025-02-22-q39b": dict(targets=[tgt(24.0, "kJ", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2025-05-13-2-q36a": dict(targets=[tgt(4.0, "s", "g = 10"), tgt(math.sqrt(160 / 9.8), "s", "g = 9.8")], policies=["G_VALUE_VARIANT"], eng=["MULTI_VALUE"]),
    "REAL-2026-01-18-q43a": dict(targets=[tgt(8.0, "m", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2026-01-18-q43b": dict(targets=[tgt(200 / (16 * PI), "W/m²", "standart π")], policies=["SIMPLE_NUMERIC"],
                                 note="Shartda π ≈ 3 yo'q — faqat standart π (π = 3 bilan 4,17 qabul qilinmaydi)"),
    "REAL-2026-01-18-q40a": dict(targets=[tgt(0.022 * 3 * 0.004 / 10 * 1e6, "mg", "π = 3"), tgt(0.022 * PI * 0.004 / 10 * 1e6, "mg", "π = π")],
                                 policies=["PI_APPROX_3"], eng=["MULTI_VALUE"], note="g = 10 shartda berildi — g varianti endi yo'q"),
    "REAL-2026-01-18-q40b": dict(targets=[tgt(2000, "", "π = 3", "exact", 0)], policies=["INTEGER_EXACT"],
                                 note="Standart π bilan N ≈ 1909,9 (butun emas) — INTEGER_EXACT bo'yicha qabul qilinmaydi; shartda π ≈ 3 berilgan"),
    "REAL-2025-11-30-q41b": dict(targets=[tgt(-1080.0, "nJ", "base")], policies=["NEGATIVE_VALUE"], sign=True),
    "REAL-2025-02-22-q41a": dict(targets=[tgt(2000 * 0.1 * 0.5, "eV", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2025-02-22-q43a": dict(targets=[tgt(e * 0.2 / (2 * PI * mp) / 1e6, "MHz", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2025-02-22-q43b": dict(targets=[tgt(e * 0.2 * 0.05 / mp / 1e3, "km/s", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2025-05-13-1-q41a": dict(targets=[tgt(math.sqrt(9e9 * 4e-9 * 1e-9 / (1e-7 * 0.09)), "m/s", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2025-05-13-1-q41b": dict(targets=[tgt(9e9 * 4e-9 * 1e-9 / (2 * 0.09) * 1e6, "µJ", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2026-01-18-q41a": dict(targets=[tgt(0.2 * 0.01 * 100, "V", "base")], policies=["SIMPLE_NUMERIC"]),
    "REAL-2026-01-18-q41b": dict(targets=[tgt((0.2 * 0.01 * 100) ** 2 / 0.5 * 1e3, "mW", "base")], policies=["SIMPLE_NUMERIC"]),
}
TWO_FIELD = {"REAL-2025-02-22-q45b": (2, "kamaygan"), "REAL-2025-05-13-1-q39b": (1.25, "kamaygan")}
UI_PRECISE = {"REAL-2026-09-30-B-q41a": 1.1 / 9e9 * 1e12, "REAL-2026-09-30-B-q42a": 0.6 / (12.3 * 40)}


def sha_text(t):
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def main():
    os.makedirs(EDIT_DIR, exist_ok=True)
    inputs = {f: sha(os.path.join(AUD, f)) for f in ["answer-key-spec-v2.draft.json", "phase6c-decision-review.json", "sarvar-decisions.md",
                                                       "sarvar-decisions-002-tolerance-policy.json"]}
    ds_cache = {}
    overlay = []
    for ed in EDITS:
        eid = ed["qid"].rsplit("-q", 1)[0]
        n = int(ed["qid"].rsplit("-q", 1)[1])
        if eid not in ds_cache:
            p = os.path.join(PRIV, "dataset", f"{eid}.json")
            ds_cache[eid] = (json.load(open(p, encoding="utf-8")), sha(p))
        q = next(x for x in ds_cache[eid][0]["questions"] if x["questionNumber"] == n)
        stem = q["questionText"]
        for old, new in ed["stem"]:
            assert stem.count(old) == 1, f"{ed['qid']}: stem bo'lagi topilmadi/takror: {old}"
            stem = stem.replace(old, new)
        parts = []
        for p in q["parts"]:
            t = p["text"]
            for old, new in ed["parts"].get(p["key"], []):
                assert t.count(old) == 1, f"{ed['qid']}{p['key']}: qism bo'lagi topilmadi: {old}"
                t = t.replace(old, new)
            parts.append({"key": p["key"], "originalText": p["text"], "editedText": t, "changed": t != p["text"]})
        overlay.append({"questionId": ed["qid"], "examId": eid, "questionNumber": n, "decisionNo": ed["decision"], "linkedHighReview": ed["high"],
                        "originalQuestionText": q["questionText"], "originalTextSha256": sha_text(q["questionText"]),
                        "datasetFileSha256": ds_cache[eid][1], "editedQuestionText": stem, "stemChanged": stem != q["questionText"],
                        "parts": parts, "editedSolution": ed["solution"], "reason": ed["reason"],
                        "editor": EDITOR, "date": DATE, "displayBadge": "Tahrirlangan shart (asl PDF matnidan farq qiladi)",
                        "originalPreserved": True, "status": "APPROVED_BY_SARVAR"})
    json.dump({"schemaVersion": 1, "note": "Overlay — dataset o'zgartirilmagan. Eksportda tahrirlangan matn asl matn hash'i mos kelsa qo'llanadi.",
               "edits": overlay}, open(os.path.join(EDIT_DIR, "question-edits-v1.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_edits_md(overlay)

    # ---------------- V3
    v2 = json.load(open(os.path.join(AUD, "answer-key-spec-v2.draft.json"), encoding="utf-8"))
    oa = {i["partId"]: i for i in json.load(open(os.path.join(AUD, "open-answer-key-audit.json"), encoding="utf-8"))["items"]}
    edited_parts = {}
    for o in overlay:
        for p in o["parts"]:
            edited_parts[o["questionId"] + p["key"]] = {"stemChanged": o["stemChanged"], "partChanged": p["changed"], "partText": p["editedText"]}
    specs, changes = [], []
    for s2 in v2["specs"]:
        pid = s2["partId"]
        s = copy.deepcopy(s2)
        s["v2Status"] = s2["status"]
        s["editorial"] = edited_parts.get(pid)
        prev = {"status": s2["status"], "targets": copy.deepcopy(s2["targets"])}
        reason = None
        if pid in V3_TARGETS:
            d = V3_TARGETS[pid]
            s["targets"] = d["targets"]
            s["acceptText"] = d.get("acceptText", [])
            s["signRequired"] = d.get("sign", False)
            s["policiesApplied"] = d["policies"]
            s["engineRequirements"] = d.get("eng", [])
            if d.get("group"):
                s["normalizationGroup"] = d["group"]
            if d.get("note"):
                s["v2Notes"] = s.get("v2Notes", []) + [d["note"]]
            s["status"] = "READY_ENGINE_FEATURE_REQUIRED" if {"HYBRID_NUM_TEXT"} & set(s["engineRequirements"]) else "READY"
            s["askedUnitV3"] = (s["targets"][0]["unit"] or None)
            reason = "Tahrirlangan shart bo'yicha yangi kalit" if pid in edited_parts and (edited_parts[pid]["stemChanged"] or edited_parts[pid]["partChanged"]) else "Kalit yangilandi"
        elif pid in TWO_FIELD:
            f, dirn = TWO_FIELD[pid]
            s["inputFormat"] = {"fields": [{"name": "factor", "type": "number", "target": f,
                                            "tolerance": {"type": "exact", "value": 0} if float(f).is_integer() else {"type": "relative", "value": REL}},
                                           {"name": "direction", "type": "choice", "options": ["ortgan", "kamaygan", "o‘zgarmagan"], "target": dirn}],
                                "scoring": "ikkala maydon to'g'ri bo'lsa — to'g'ri"}
            s["targets"] = [tgt(f, "", "factor", *(("exact", 0) if float(f).is_integer() else ("relative", REL)))]
            s["engineRequirements"] = ["TWO_FIELD_FACTOR_DIRECTION"]
            s["status"] = "READY_ENGINE_FEATURE_REQUIRED"
            reason = "Son va yo'nalish ikki alohida maydonda (6-qaror)"
        elif s2["status"] == "PENDING_UI_UNIT_LABEL":
            unit = s2["uiProposal"]["showExpectedUnit"]
            base = s2.get("proposedTargets") or s2["targets"]
            if pid in UI_PRECISE:
                s["targets"] = [tgt(UI_PRECISE[pid], unit, "aniq qiymat (APPROX)")]
            else:
                s["targets"] = [dict(t, tolerance={"type": "relative", "value": REL}) for t in base]
            s["uiUnitLabel"] = {"display": unit, "stored": unit, "rescale": False, "inputUnit": "kiritilmaydi"}
            s["engineRequirements"] = sorted(set(s.get("engineRequirements", [])) | {"UI_UNIT_LABEL"} | ({"MULTI_VALUE"} if len(s["targets"]) > 1 else set()))
            s["status"] = "READY_ENGINE_FEATURE_REQUIRED"
            reason = "UI birlik siyosati (8-qaror): kalit birligi ko'rsatiladi, masshtablash yo'q"
        if reason:
            changes.append({"partId": pid, "previous": prev, "v3": {"status": s["status"], "targets": s["targets"]}, "reason": reason,
                            "approval": f"APPROVED — Sarvar, {DATE}"})
        specs.append(s)
    checks = validate(specs, oa, edited_parts)
    st = Counter(x["status"] for x in specs)
    eng = Counter(r for x in specs for r in x.get("engineRequirements", []))
    doc = {"schemaVersion": 3, "phase": "6D", "status": "V3_DRAFT", "appliedToDataset": False, "engineChanged": False,
           "editorialOverlay": "_private/real-imtihonlar/editorial/question-edits-v1.json", "inputHashes": inputs,
           "summary": {"parts": len(specs), "byStatus": dict(st), "changes": len(changes), "engineRequirements": dict(eng),
                       "editedQuestions": len(overlay), "editedParts": sum(1 for v in edited_parts.values() if v["stemChanged"] or v["partChanged"])},
           "validation": checks, "changes": changes, "specs": specs}
    json.dump(doc, open(os.path.join(AUD, "answer-key-spec-v3.draft.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_v3_md(doc)
    write_decisions(overlay, doc)
    write_public(doc, overlay)
    write_ui_policy(specs)
    print(json.dumps({"summary": doc["summary"], "validation": {k: v["pass"] for k, v in checks.items()}}, ensure_ascii=False, indent=1))
    if not all(v["pass"] for v in checks.values()):
        sys.exit(1)


def validate(specs, oa, edited):
    c = {}
    ids = [s["partId"] for s in specs]
    c["uniqueIds"] = {"pass": len(set(ids)) == len(ids) == 240, "detail": len(set(ids))}
    bad = []
    for s in specs:
        asked = oa[s["partId"]]["askedUnit"]
        if s["partId"] in V3_TARGETS:
            asked = V3_TARGETS[s["partId"]]["targets"][0]["unit"] or None  # tahrirlangan qism birligi
        if s["partId"] == "REAL-2024-12-01-q43b":
            asked = "J"
        for t in s["targets"]:
            if t["variant"] in ("mantissa", "factor", "normalized") or not asked or not t["unit"]:
                continue
            if OA.unit_norm(asked) != OA.unit_norm(t["unit"]) and not (asked == "C" and t["unit"] == "°C") and not (OA.unit_norm(asked) == "l" and t["unit"] == "ℓ"):
                bad.append(f"{s['partId']}: {asked} ≠ {t['unit']}")
    c["unitsMatch"] = {"pass": not bad, "detail": bad or "OK"}
    tb = []
    for s in specs:
        for t in s["targets"]:
            ty, tv = t["tolerance"]["type"], t["tolerance"]["value"]
            if (ty == "relative" and tv != REL) or (ty == "absolute" and not (t["value"] == 0 and tv == ABS0)) or (ty == "exact" and not float(t["value"]).is_integer()):
                tb.append(s["partId"])
    c["toleranceTypes"] = {"pass": not tb, "detail": tb or "OK"}
    open_ = [s["partId"] for s in specs if not s["status"].startswith("READY")]
    empty = [s["partId"] for s in specs if s["status"].startswith("READY") and not s["targets"] and not s.get("acceptText")]
    c["allResolvedHaveTargets"] = {"pass": not empty, "detail": {"open": open_, "readyWithoutTarget": empty}}
    # tahrirlangan qismlarda maqsad yangi kalitdan (V3_TARGETS) bo'lishi shart
    miss = [p for p, v in edited.items() if (v["stemChanged"] or v["partChanged"]) and p not in V3_TARGETS and p not in ("REAL-2025-02-22-q41b", "REAL-2025-05-13-2-q36b")]
    c["editedPartsHaveNewKeys"] = {"pass": not miss, "detail": miss or "OK (22.02 #41b — yopiq yo'l ishi 0; 13.05-2 #36b — Δp = mgt yo'nalishga bog'liq emas, mavjud kalit 36 / 35,28 saqlanadi)"}
    c["totals240"] = {"pass": len(specs) == 240, "detail": dict(Counter(s["status"] for s in specs))}
    return c


def fmt(ts):
    out = []
    for t in ts or []:
        tol = t["tolerance"]
        tt = {"relative": "±1 %", "absolute": f"±{tol['value']:g}", "exact": "aniq"}[tol["type"]]
        out.append(f"{t['value']:.6g} {t['unit'] or ''} ({t['variant']}; {tt})".replace("  ", " "))
    return "<br>".join(out) or "—"


def write_edits_md(overlay):
    L = ["# Savol shartlariga tahrirlar — overlay v1 (MAXFIY)", "",
         "Dataset o'zgartirilmagan. Har bir tahrir asl matn hash'i bilan bog'langan. Sahifada **'Tahrirlangan shart'** belgisi ko'rsatilishi kerak.", ""]
    for o in overlay:
        L += [f"## {o['questionId']} — {o['reason'].split(' — ')[0]}", "", f"- Qaror: {o['decisionNo']}" + (f" ({o['linkedHighReview']})" if o["linkedHighReview"] else ""),
              f"- Sabab: {o['reason']}", "", "**Asl shart:**", "", "> " + o["originalQuestionText"].replace("\n", " "), "",
              "**Tahrirlangan shart:**", "", "> " + o["editedQuestionText"].replace("\n", " "), ""]
        for p in o["parts"]:
            if p["changed"]:
                L += [f"- {p['key']}) ~~{p['originalText']}~~ → **{p['editedText']}**"]
            else:
                L += [f"- {p['key']}) {p['originalText']} (o'zgarmagan)"]
        L += ["", "**Yechim (tahrirlangan shart bo'yicha):**", ""]
        for k, steps in o["editedSolution"].items():
            L.append(f"- {k}) " + " → ".join(steps))
        L.append("")
    open(os.path.join(EDIT_DIR, "question-edits-v1.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_v3_md(doc):
    s = doc["summary"]
    L = ["# Ochiq javoblar kaliti — V3 QORALAMASI (MAXFIY)", "", f"Holat: **V3_DRAFT**. Tahrirlar: `{doc['editorialOverlay']}`. Dataset va engine o'zgarmagan.", "",
         "| Holat | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byStatus"].items())] + [
         "", "Engine talablari: " + ", ".join(f"{k} {v}" for k, v in sorted(s["engineRequirements"].items())), "",
         "## Tekshiruvlar", ""] + [f"- **{k}**: {'PASS' if v['pass'] else 'FAIL'}" for k, v in doc["validation"].items()] + [
         "", f"## O'zgarishlar (V2 → V3) — {s['changes']}", "", "| Qism | V2 | V3 | Sabab |", "|---|---|---|---|"]
    for c in doc["changes"]:
        L.append(f"| {c['partId'][5:]} | {c['previous']['status']}<br>{fmt(c['previous']['targets'])} | {c['v3']['status']}<br>{fmt(c['v3']['targets'])} | {c['reason']} |")
    open(os.path.join(AUD, "answer-key-spec-v3.draft.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_decisions(overlay, doc):
    dec = {"date": DATE, "by": "Sarvar Amirov", "decisionNo": 3, "appliedToDataset": False,
           "items": [
               {"no": 1, "item": "HIGH 002 — 22.02 #39a/b", "decision": "Shartga jarayon turi qo'shildi (o'zgarmas bosim)", "result": "FINAL (tahrirlangan shart): 3 marta ortgan; 24 kJ"},
               {"no": 2, "item": "HIGH 003 — 13.05-2 #36a", "decision": "Otish yo'nalishi: gorizontal", "result": "FINAL: 4 s (g = 9,8 varianti 4,04 s ham)"},
               {"no": 3, "item": "HIGH 004 — 18.01 #43a/b", "decision": "To'liq (konus uchidagi) yoyilish burchagi", "result": "FINAL: 8 m; ≈3,98 W/m²"},
               {"no": 4, "item": "18.01 #40", "decision": "σ, ρ, g shartga qo'shildi — hisob oson", "result": "a) 26,4 mg (π = 3; standart π 27,65); b) 2000"},
               {"no": 5, "item": "30.11 #41b", "decision": "'elektr maydon kuchlari bajargan ish'", "result": "−1080 nJ, ishora majburiy"},
               {"no": 6, "item": "22.02 #45b, 13.05-1 #39b", "decision": "Son va yo'nalish ikki alohida maydonda", "result": "READY (engine: TWO_FIELD)"},
               {"no": 7, "item": "7 formula qism", "decision": "Shart to'ldirildi, son qiymatlar berildi — baholanadi",
                "result": "22.02 #41a 100 eV; #43a ≈3,05 MHz; #43b ≈958 km/s; 13.05-1 #41a 2 m/s; #41b 0,2 µJ; 18.01 #41a 0,2 V; #41b 80 mW"},
               {"no": 8, "item": "UI birlik siyosati (20 qism)", "decision": "Kalit birligi kiritish maydoni yonida ko'rsatiladi; masshtablash yo'q",
                "result": "READY (engine: UI_UNIT_LABEL); hujjat: docs/real-imtihonlar/13_ui_unit_label_policy.md"}],
           "stillOpenOutsideOpenAnswers": ["HIGH 006 (06.04-2 #18, MCQ) — 1-qaror bo'yicha PENDING_SARVAR_REVIEW; avtomatik tuzatilmaydi"],
           "editorialNote": "Tahrirlangan 9 savol endi asl PDF matni bilan so'zma-so'z bir xil emas — sahifada 'Tahrirlangan shart' belgisi bilan ko'rsatiladi; asl matn overlay'da saqlanadi."}
    json.dump(dec, open(os.path.join(AUD, "sarvar-decisions-003.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    L = [f"# Sarvar qarorlari — 3 ({DATE}, dataset'ga YOZILMAGAN)", "", "| № | Savol | Qaror | Natija |", "|---|---|---|---|"]
    for i in dec["items"]:
        L.append(f"| {i['no']} | {i['item']} | {i['decision']} | {i['result']} |")
    L += ["", "Ochiq qolgan (ochiq javoblardan tashqari): " + "; ".join(dec["stillOpenOutsideOpenAnswers"]), "", dec["editorialNote"]]
    open(os.path.join(AUD, "sarvar-decisions-003.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public(doc, overlay):
    s = doc["summary"]
    L = ["# Tahrirlangan shartlar va kalit spetsifikatsiyasi V3 (ommaviy xulosa)", "",
         "Savol matnlari va javoblar bu faylda yo'q; to'liq: `_private/real-imtihonlar/editorial/question-edits-v1.{json,md}` va `_private/real-imtihonlar/audit/answer-key-spec-v3.draft.{json,md}`.", "",
         f"- Tahrirlangan savollar: {s['editedQuestions']} (qismlar: {s['editedParts']}). Asl matn saqlangan; sahifada 'Tahrirlangan shart' belgisi.",
         "- Dataset, app-data va engine o'zgartirilmagan.", "", "| V3 holati | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byStatus"].items())] + [
         "", "| Engine talabi | Qismlar |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["engineRequirements"].items())] + [
         "", "Tekshiruvlar: " + ", ".join(f"{k} {'PASS' if v['pass'] else 'FAIL'}" for k, v in doc["validation"].items())]
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "12_editorial_edits_v3_summary.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_ui_policy(specs):
    rows = [s for s in specs if s.get("uiUnitLabel")]
    L = ["# UI birlik belgisi siyosati (Real imtihonlar, ochiq javoblar)", "", f"Tasdiqlangan: Sarvar Amirov, {DATE} (8-qaror). Engine'da hali amalga oshirilmagan.", "",
         "## Qoidalar", "",
         "1. Savol matnida javob birligi ko'rsatilmagan qismlarda kiritish maydoni yonida **kutilgan birlik** belgisi ko'rsatiladi (masalan: `[      ] cm`).",
         "2. Ko'rsatiladigan birlik = kalitda saqlanadigan birlik. **Qayta masshtablash yo'q** — o'quvchi kiritgan son to'g'ridan-to'g'ri kalit bilan solishtiriladi.",
         "3. O'quvchi birlik yozmaydi (UNIT_NOT_ASKED siyosati). Birlik belgisi o'zgartirib bo'lmaydigan matn sifatida ko'rsatiladi.",
         "4. Ilmiy yozuv qo'llanadi: `1,22·10^-3`, `1.22e-3`, `3,6·10^17` (mavjud parseNumber shu formatlarni o'qiydi).",
         "5. 10ⁿ ekvivalentlar avtomatik qabul qilinmaydi (masalan, `0,2` m o'rniga `20` cm) — bu 1000 marta xatoni ham qabul qilib yuborardi.",
         "6. Belgi savol matnining bir qismi emas: savol matni o'zgarmaydi; belgi faqat kiritish maydoni interfeysida.",
         "7. Tolerans va boshqa baholash qoidalari o'zgarmaydi (±1 %, g/π variantlari va h.k.).",
         "8. Xuddi shu mexanizm koeffitsiyent ko'rinishidagi javoblarda ham ishlatiladi (belgi: `× E`, `× p`, `× c`, `× A` — 8 qism, MED-02).", "",
         f"## Qo'llanadigan qismlar — {len(rows)}", "", "| Qism | Ko'rsatiladigan birlik | Saqlanadigan birlik | Qayta masshtablash |", "|---|---|---|---|"]
    for s in rows:
        u = s["uiUnitLabel"]
        L.append(f"| {s['partId'][5:]} | {u['display']} | {u['stored']} | yo'q |")
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "13_ui_unit_label_policy.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
