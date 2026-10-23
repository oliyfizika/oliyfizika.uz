#!/usr/bin/env python3
"""PHASE 6B — ochiq javoblar kalit spetsifikatsiyasi V2 QORALAMASI. FAQAT O'QIYDI — yangi fayllar yozadi.
Dataset, savol/yechim matni, engine (scoring.js), Mock tizimi, V1 draft, 6A audit va qarorlar jurnali O'ZGARMAYDI.

  python3 tools/real-imtihonlar/audit/build_answer_key_spec_v2.py

Kirish : answer-key-spec.draft.json (V1), phase6a-answer-key-final-audit.json, sarvar-decisions-002-tolerance-policy.json,
         sarvar-decisions.md, dataset/*.json (CRIT-01 savol ma'lumotini tasdiqlash uchun), open-answer-key-audit.json
Natija : _private/real-imtihonlar/audit/answer-key-spec-v2.draft.{json,md}, docs/real-imtihonlar/10_answer_key_spec_v2_summary.md
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
sys.path.insert(0, HERE)
import build_open_answer_audit as OA  # noqa: E402  (unit_norm)

REL = 0.01
ABS0 = 1e-9
INPUTS = ["answer-key-spec.draft.json", "phase6a-answer-key-final-audit.json", "sarvar-decisions-002-tolerance-policy.json",
          "sarvar-decisions.md", "answer-key-spec.draft.md", "open-answer-key-audit.json"]
DECISION_SRC = "Sarvar, PHASE 6B ko'rsatmasi (2026-10-09)"

# APPROX — 15 qism: aniq (yaxlitlanmagan) qiymat, formula bilan (har biri qayta hisoblandi)
APPROX = {
    "REAL-2024-12-01-q41a": ("ν = 1/(2π√(LC)), √(LC) = 4·10⁻⁶ s", 1 / (2 * math.pi * 4e-6), "Hz"),
    "REAL-2025-05-13-1-q37b": ("ΔK = K₀ − p²/(2M) = 20,5 − 25/3", 20.5 - 25 / 3, "J"),
    "REAL-2025-05-13-1-q43a": ("p = γ·mₚ·υ = (13/5)·1,67·10⁻²⁷·(12/13)·3·10⁸", 13 / 5 * 1.67e-27 * 12 / 13 * 3e8, "kg·m/s"),
    "REAL-2025-05-13-1-q43b": ("υ = p/m = 1,2024·10⁻¹⁸ / 2·10⁻⁹", 13 / 5 * 1.67e-27 * 12 / 13 * 3e8 / 2e-9, "m/s"),
    "REAL-2025-05-13-1-q45b": ("λ = ln2/T, T = 90 s", math.log(2) / 90, "1/s"),
    "REAL-2025-05-13-2-q40b": ("η = 1 − T₂/T₁ = 3/7", 3 / 7 * 100, "%"),
    "REAL-2025-05-13-2-q45a": ("ν = 13,6·(1/9 − 1/16)·1,6·10⁻¹⁹ / 6,6·10⁻³⁴", 13.6 * (1 / 9 - 1 / 16) * 1.6e-19 / 6.6e-34, "Hz"),
    "REAL-2025-05-13-2-q45b": ("p = ΔE/c = 13,6·(1/9 − 1/16)·1,6·10⁻¹⁹ / 3·10⁸", 13.6 * (1 / 9 - 1 / 16) * 1.6e-19 / 3e8, "kg·m/s"),
    "REAL-2025-11-30-q39b": ("Q = (5/2)·ν·R·ΔT = 2,5·1250·8,31·100 → kJ", 2.5 * 1250 * 8.31 * 100 / 1000, "kJ"),
    "REAL-2026-01-18-q42b": ("t = (R/R₀ − 1)/α = (500/30 − 1)/0,005", (500 / 30 - 1) / 0.005, "℃"),
    "REAL-2026-01-18-q44b": ("p = E·υ/c² = 8·10⁻¹⁰·0,8/3·10⁸", 8e-10 * 0.8 / 3e8, "kg·m/s"),
    "REAL-2026-04-06-1-q40a": ("C = 3·ν·R = 3·40·8,31 (Dyulong–Pti; 1-qaror bilan finalized)", 3 * 40 * 8.31, "J/K"),
    "REAL-2026-04-06-1-q40b": ("Q = C·ΔT = 997,2·60 → kJ", 3 * 40 * 8.31 * 60 / 1000, "kJ"),
    "REAL-2026-04-06-2-q39b": ("V = ν·R·T/p = 6·8,31·300/1,2·10⁵ → ℓ", 6 * 8.31 * 300 / 1.2e5 * 1000, "ℓ"),
    "REAL-2026-04-06-2-q40b": ("m = Q/q = 10,08·10⁶/44·10⁶ (q — audit jadval qiymati)", 40 * 4200 * 60 / 44e6, "kg"),
}
APPROX_SENSITIVITY = {
    "REAL-2025-05-13-2-q45a": "h = 6,63·10⁻³⁴ bilan 1,595·10¹⁴ — ±1 % oyna ichida",
    "REAL-2025-05-13-1-q43a": "mₚ = 1,6726·10⁻²⁷ bilan 1,204·10⁻¹⁸ — ±1 % ichida",
    "REAL-2025-11-30-q39b": "R = 8,314 bilan 2598,1 kJ — ±1 % ichida",
}
UNIT_LABEL_PARTS = {f"REAL-2026-09-30-B-q{k}" for k in ["36a", "36b", "37a", "37b", "38a", "38b", "39a", "39b", "40a", "40b", "41a", "41b",
                                                         "42a", "42b", "43a", "43b", "44a", "44b", "45b"]} | {"REAL-2026-01-18-q36b"}
FORMULA_PARTS = {"REAL-2025-02-22-q41a", "REAL-2025-02-22-q43a", "REAL-2025-02-22-q43b", "REAL-2025-05-13-1-q41a", "REAL-2025-05-13-1-q41b",
                 "REAL-2026-01-18-q41a", "REAL-2026-01-18-q41b"}
DECREASE_PARTS = {"REAL-2025-02-22-q45b": (2, "kamayadi"), "REAL-2025-05-13-1-q39b": (1.25, "kamaygan")}
SCALED = {"REAL-2026-09-30-A-q42a": (4.0, "10⁻³ K⁻¹", "α = 2/(20·25) = 0,004 K⁻¹ → mantissa 4"),
          "REAL-2026-09-30-A-q44b": (1.8, "10¹⁷ J", "K = Δm·c² = 2·9·10¹⁶ = 1,8·10¹⁷ J → mantissa 1,8")}


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def tgt(v, unit, variant, ttype="relative", tval=REL):
    return {"value": v, "unit": unit, "variant": variant, "tolerance": {"type": ttype, "value": tval}}


def main():
    hashes = {f: sha(os.path.join(AUD, f)) for f in INPUTS}
    v1 = json.load(open(os.path.join(AUD, "answer-key-spec.draft.json"), encoding="utf-8"))
    a6 = {p["partId"]: p for p in json.load(open(os.path.join(AUD, "phase6a-answer-key-final-audit.json"), encoding="utf-8"))["parts"]}
    oa = {i["partId"]: i for i in json.load(open(os.path.join(AUD, "open-answer-key-audit.json"), encoding="utf-8"))["items"]}
    ds = json.load(open(os.path.join(PRIV, "dataset", "REAL-2024-12-01.json"), encoding="utf-8"))
    q41 = next(q for q in ds["questions"] if q["questionNumber"] == 41)
    specs, changes = [], []

    def change(pid, prev, new, reason, approval):
        changes.append({"partId": pid, "previous": prev, "v2": new, "reason": reason, "approval": approval})

    for s1 in v1["specs"]:
        pid = s1["partId"]
        a = a6[pid]
        s = copy.deepcopy(s1)
        s["v1Status"] = s1["status"]
        s["phase6aStatus"] = a["auditStatus"]
        s["engineRequirements"] = sorted(set(a.get("engineNeeds", [])) - {"NON_RELATIVE_TOLERANCE"})
        s["v2Notes"] = []
        prev = {"status": s1["status"], "targets": copy.deepcopy(s1["targets"]), "acceptText": s1["acceptText"]}
        status = None
        # ---------- qarorlar ----------
        if pid == "REAL-2024-12-01-q41b":
            # tasdiqlash: savol (L = 2 H, C = 8 pF, birlik m) + mustaqil audit (≈7,5·10³ m) + qayta hisob
            L, C = 2.0, 8e-12
            lam = 3e8 * 2 * math.pi * math.sqrt(L * C)
            confirmed = ("2 $H$" in q41["questionText"] and "8 $pF$" in q41["questionText"]
                         and "($m$)" in [p for p in q41["parts"] if p["key"] == "b"][0]["text"] and abs(lam - 7539.8) < 0.1)
            s["targets"] = [tgt(lam, "m", "standart π")]
            s["acceptText"] = ["2400π", "2400pi"]
            s["v2Notes"].append(f"Birlik km → m. Savol: L = 2 H, C = 8 pF, '(m)' so'ralgan; audit: ≈7,5·10³ m (2400π m); qayta hisob: {lam:.1f} m. "
                                f"Savol transkripsiyasi AI pass1+pass2 bilan VERIFIED (humanSignOff yo'q).")
            status = "READY" if confirmed else "REVIEW"
            change(pid, prev, {"status": status, "targets": s["targets"], "acceptText": s["acceptText"]}, "CRIT-01: maqsad birligi savolda so'ralgan birlikka (m) moslandi",
                   "CONFIRMED_BY_QUESTION_AND_AUDIT" if confirmed else "REVIEW — tasdiqlanmadi")
        elif pid == "REAL-2026-04-06-2-q41b":
            v = s1["targets"][0]["value"]
            s["targets"] = [tgt(v, None, "base")]
            s["policyOverride"] = {"rule": "INTEGER_EXACT o'rniga ±1 % nisbiy (faqat shu qism)", "general INTEGER_EXACT": "o'zgarmagan"}
            s["v2Notes"].append("Son doimiylardan hisoblanadi (q = φR/k, N = q/e) — e, k yozilishiga qarab ≈0,1–0,2 % farq.")
            status = "READY"
            change(pid, prev, {"status": status, "targets": s["targets"]}, "CRIT-02: qismga xos ±1 % (INTEGER_EXACT umumiy qoidasi o'zgarmagan)", "APPROVED — " + DECISION_SRC)
        elif pid == "REAL-2024-12-01-q43b":
            v = oa[pid]["parsed"]["value"]
            s["targets"] = [tgt(v, "J", "base")]
            s["v2Notes"].append("Savolda '($J$)' bor (parser oxirgi qavsni olgan edi). Qayta hisob: (γ − 1)mc² = 0,25·10⁻⁸·9·10¹⁶ = 2,25·10⁸ J.")
            status = "READY"
            change(pid, prev, {"status": status, "targets": s["targets"]}, "MED-01: kutilgan birlik J, ±1 %", "APPROVED — " + DECISION_SRC)
        elif pid in APPROX:
            formula, v, unit = APPROX[pid]
            if v == 0:  # faqat haqiqiy nol (kichik sonlar nolga tenglashtirilmaydi)
                s["targets"] = [tgt(0.0, unit, "aniq qiymat", "absolute", ABS0)]
            else:
                s["targets"] = [tgt(v, unit, "aniq qiymat")]
            shown = oa[pid]["parsed"].get("value")
            inside = shown is not None and abs(shown - v) <= REL * abs(v)
            s["calc"] = {"formula": formula}
            s["v2Notes"].append(f"Aniq qiymat {v:.6g} {unit}; ko'rsatilgan {shown:.6g} {'±1 % ichida' if inside else 'TASHQARIDA'}"
                                + (f"; {APPROX_SENSITIVITY[pid]}" if pid in APPROX_SENSITIVITY else "") + "; g/π varianti yo'q")
            status = "READY" if inside else "REVIEW"
            change(pid, prev, {"status": status, "targets": s["targets"]}, "APPROX_ANSWER: aniq hisoblangan qiymat ±1 %", "APPROVED — " + DECISION_SRC)
        elif pid in SCALED:
            mant, unit, why = SCALED[pid]
            s["targets"] = [tgt(mant, unit, "mantissa")]
            s["v2Notes"].append(why)
            status = "READY"
            change(pid, prev, {"status": status, "targets": s["targets"]}, "SCALED_UNIT (mavjud siyosat): faqat mantissa kiritiladi",
                   "APPROVED — mavjud siyosat (6A da tasdiqlangan)")
        elif pid == "REAL-2026-01-18-q40b":
            status = "NEEDS_MANUAL_REVIEW"
            s["v2Notes"].append("Butun sonli javob manbasiz taxmin qilinmaydi: π = 3 bilan 2000/1960, π = 3,14 bilan butun emas.")
            change(pid, prev, {"status": status}, "18.01 #40b — qo'lda ko'rib chiqish", "APPROVED — " + DECISION_SRC)
        elif pid in UNIT_LABEL_PARTS:
            status = "PENDING_UI_UNIT_LABEL"
            unit = (s1["targets"][0]["unit"] if s1["targets"] else None) or oa[pid]["parsed"].get("unit")
            s["uiProposal"] = {"showExpectedUnit": unit, "inputUnit": "kiritilmaydi (UNIT_NOT_ASKED)", "engineChange": "hozircha yo'q"}
            if not s["targets"] and oa[pid]["parsed"].get("value") is not None:
                s["proposedTargets"] = [tgt(oa[pid]["parsed"]["value"], unit, "base")]
            s["v2Notes"].append(f"UI taklifi: kiritish maydoni yonida kutilgan birlik '{unit}' ko'rsatilsin (savol matni o'zgarmaydi).")
            change(pid, prev, {"status": status, "uiProposal": s["uiProposal"]}, "UNIT_NOT_ASKED: kutilgan birlikni UI'da ko'rsatish taklifi qayd etildi",
                   "PROPOSAL — UI/engine bosqichida")
        elif pid in FORMULA_PARTS:
            status = "NEEDS_MANUAL_REVIEW"
            s["v2Notes"].append("Formula javob — matematik ifoda parseri bu bosqichda yo'q.")
            change(pid, prev, {"status": status}, "FORMULA_ANSWER: qo'lda ko'rib chiqish", "APPROVED — " + DECISION_SRC)
        elif pid in DECREASE_PARTS:
            f, d = DECREASE_PARTS[pid]
            status = "NEEDS_MANUAL_REVIEW"
            s["v2Representation"] = {"factor": {"value": f, "tolerance": {"type": "relative", "value": REL}}, "direction": d,
                                     "ratioEquivalent": round(1 / f, 6)}
            s["v2Notes"].append("Son va yo'nalish alohida maydonlarda; UI ikki maydonni qo'llab-quvvatlasa → READY, aks holda qo'lda.")
            change(pid, prev, {"status": status, "v2Representation": s["v2Representation"]}, "NUMERIC_WITH_QUALIFIER: son + yo'nalish alohida",
                   "APPROVED — UI qo'llamaguncha manual review")
        # ---------- qolganlar (6A natijasi) ----------
        if status is None:
            st6 = a["auditStatus"]
            if st6 == "PASS":
                status = "READY"
            elif st6 == "PASS_ENGINE_FEATURE_REQUIRED":
                status = "READY_ENGINE_FEATURE_REQUIRED"
            elif st6.startswith("SOURCE_DEFECT_UNSAFE (PENDING_HIGH_REVIEW)"):
                status = "PENDING_HIGH_REVIEW"
            elif pid == "REAL-2025-11-30-q41b":
                status = "NEEDS_MANUAL_REVIEW"
            else:
                status = "UNCLASSIFIED"
        if status == "READY" and {"HYBRID_NUM_TEXT", "UNIT_HINT_UI"} & set(s["engineRequirements"]):
            status = "READY_ENGINE_FEATURE_REQUIRED"
        if pid == "REAL-2024-12-01-q41b" and status == "READY":
            s["engineRequirements"] = ["HYBRID_NUM_TEXT"]
            status = "READY_ENGINE_FEATURE_REQUIRED"
            changes[-1]["v2"]["status"] = status
        s["status"] = status
        if any(t["tolerance"]["type"] != "relative" for t in s["targets"]) and "NON_RELATIVE_TOLERANCE" not in s["engineRequirements"]:
            pass
        if len(s["targets"]) > 1 and "MULTI_VALUE" not in s["engineRequirements"]:
            s["engineRequirements"].append("MULTI_VALUE")
        specs.append(s)

    checks = validate(specs, oa, a6, hashes)
    st = Counter(x["status"] for x in specs)
    trans = Counter((x["phase6aStatus"], x["status"]) for x in specs)
    doc = {"schemaVersion": 2, "phase": "6B", "status": "V2_DRAFT_PENDING_SARVAR", "appliedToDataset": False, "engineChanged": False,
           "inputHashes": hashes, "summary": {"parts": len(specs), "byStatus": dict(st), "changes": len(changes),
                                               "changesByReason": dict(Counter(c["reason"].split(":")[0] for c in changes)),
                                               "transitions6Ato6B": {f"{k[0]} → {k[1]}": v for k, v in sorted(trans.items())}},
           "validation": checks, "changes": changes, "specs": specs}
    out = os.path.join(AUD, "answer-key-spec-v2.draft.json")
    json.dump(doc, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc)
    write_public(doc)
    print(json.dumps({"summary": doc["summary"], "validation": {k: v["pass"] for k, v in checks.items()}}, ensure_ascii=False, indent=1))
    if not all(v["pass"] for v in checks.values()):
        sys.exit(1)


def validate(specs, oa, a6, hashes):
    c = {}
    ids = [s["partId"] for s in specs]
    c["uniqueIds"] = {"pass": len(ids) == len(set(ids)) == 240, "detail": f"{len(set(ids))} noyob / {len(ids)}"}
    bad_units = []
    for s in specs:
        if s["status"] not in ("READY", "READY_ENGINE_FEATURE_REQUIRED"):
            continue
        asked = oa[s["partId"]]["askedUnit"]
        if s["partId"] == "REAL-2024-12-01-q43b":
            asked = "J"
        for t in s["targets"]:
            if t["variant"] == "mantissa" or not asked or not t["unit"]:
                continue
            if OA.unit_norm(asked) != OA.unit_norm(t["unit"]) and not (asked == "C" and t["unit"] == "°C") \
                    and not (OA.unit_norm(asked) == "l" and t["unit"] == "ℓ") and not (asked == "1/s" and t["unit"] == "1/s"):
                bad_units.append(f"{s['partId']}: so'ralgan {asked}, maqsad {t['unit']}")
    c["unitsMatch"] = {"pass": not bad_units, "detail": bad_units or "READY maqsadlarining hammasi so'ralgan birlikda (mantissa — SCALED_UNIT)"}
    bad_tol = []
    for s in specs:
        for t in s["targets"]:
            ty, tv = t["tolerance"]["type"], t["tolerance"]["value"]
            if ty == "relative" and tv != REL:
                bad_tol.append(f"{s['partId']}: nisbiy {tv}")
            if ty == "absolute" and not (t["value"] == 0 and tv == ABS0):
                bad_tol.append(f"{s['partId']}: absolyut faqat 0 uchun 1e-9")
            if ty == "exact" and not float(t["value"]).is_integer():
                bad_tol.append(f"{s['partId']}: aniq moslik butun bo'lmagan songa")
            if s["partId"] == "REAL-2026-04-06-2-q41b" and ty != "relative":
                bad_tol.append("CRIT-02 override qo'llanmagan")
    zero_bad = []
    for s in specs:
        for t in s["targets"]:
            if t["value"] == 0:
                fv = oa[s["partId"]]["parsed"].get("value")
                if not (fv == 0 or (s.get("calc") and "g = 10" in t["variant"])):
                    zero_bad.append(s["partId"])
    c["zeroTargetsOnlyForZeroAnswers"] = {"pass": not zero_bad, "detail": zero_bad or "nol maqsad faqat yakuniy javobi 0 bo'lgan qismlarda"}
    c["toleranceTypes"] = {"pass": not bad_tol, "detail": bad_tol or "nisbiy = 1 %; absolyut faqat nol (1e-9); aniq faqat butun; CRIT-02 = nisbiy"}
    must_not_ready = UNIT_LABEL_PARTS | FORMULA_PARTS | set(DECREASE_PARTS) | {"REAL-2026-01-18-q40b", "REAL-2025-11-30-q41b"} | \
        {p for p, v in a6.items() if "PENDING_HIGH_REVIEW" in v["auditStatus"]}
    leaked = [s["partId"] for s in specs if s["partId"] in must_not_ready and s["status"].startswith("READY")]
    empty_ready = [s["partId"] for s in specs if s["status"].startswith("READY") and not s["targets"] and not s["acceptText"]]
    uncl = [s["partId"] for s in specs if s["status"] in ("UNCLASSIFIED", "REVIEW")]
    c["noHiddenReady"] = {"pass": not leaked and not empty_ready, "detail": {"unresolvedMarkedReady": leaked, "readyWithoutTarget": empty_ready,
                                                                             "checkedUnresolved": len(must_not_ready)}}
    c["noUnclassified"] = {"pass": not uncl, "detail": uncl or "hammasi tasniflangan"}
    st = Counter(s["status"] for s in specs)
    c["totals240"] = {"pass": sum(st.values()) == 240 and len(a6) == 240, "detail": dict(st)}
    c["inputHashesRecorded"] = {"pass": len(hashes) == len(INPUTS), "detail": hashes}
    return c


def fmt(ts):
    out = []
    for t in ts or []:
        tol = t["tolerance"]
        tt = {"relative": "±1 %", "absolute": f"±{tol['value']:g}", "exact": "aniq"}[tol["type"]]
        out.append(f"{t['value']:.6g} {t['unit'] or ''} ({t['variant']}; {tt})".replace("  ", " "))
    return "<br>".join(out) or "—"


def write_md(doc):
    s = doc["summary"]
    L = ["# Ochiq javoblar kaliti — spetsifikatsiya V2 QORALAMASI (MAXFIY)", "",
         "Holat: **V2_DRAFT_PENDING_SARVAR**. Dataset, engine, Mock tizimi, V1 va 6A fayllari o'zgarmagan.", "",
         "## Kirish fayllari (sha256)", ""] + [f"- `{k}`: `{v}`" for k, v in doc["inputHashes"].items()] + [
         "", "## Holatlar (240)", "", "| Holat | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byStatus"].items())] + [
         "", "## 6A → V2 o'tishlar", "", "| 6A holati → V2 holati | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in s["transitions6Ato6B"].items()] + [
         "", "## Tekshiruvlar", ""] + [f"- **{k}**: {'PASS' if v['pass'] else 'FAIL'} — {v['detail'] if not isinstance(v['detail'], dict) or k != 'inputHashesRecorded' else 'qayd etildi'}" for k, v in doc["validation"].items()] + [
         "", f"## O'zgarishlar — {s['changes']} ta", "", "| Qism | Oldingi (V1) | V2 | Sabab | Tasdiq |", "|---|---|---|---|---|"]
    for c in doc["changes"]:
        prev = f"{c['previous']['status']}<br>{fmt(c['previous']['targets'])}"
        new = c["v2"]
        v2 = f"{new['status']}<br>{fmt(new.get('targets'))}"
        if new.get("uiProposal"):
            v2 += f"<br>UI: birlik '{new['uiProposal']['showExpectedUnit']}'"
        if new.get("v2Representation"):
            r = new["v2Representation"]
            v2 += f"<br>son {r['factor']['value']} (±1 %) + yo'nalish '{r['direction']}'"
        L.append(f"| {c['partId'][5:]} | {prev} | {v2} | {c['reason']} | {c['approval']} |")
    L += ["", "## To'liq V2 jadvali", "", "| Qism | V2 holati | Maqsad(lar) | Matn shakllari | Engine talabi | Izoh |", "|---|---|---|---|---|---|"]
    for x in doc["specs"]:
        L.append(f"| {x['partId'][5:]} | {x['status']} | {fmt(x['targets'])} | {', '.join(x['acceptText']) or '—'} | {', '.join(x['engineRequirements']) or '—'} | "
                 f"{'; '.join(x['v2Notes']).replace('|', '/') or '—'} |")
    open(os.path.join(AUD, "answer-key-spec-v2.draft.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public(doc):
    s = doc["summary"]
    L = ["# Ochiq javoblar kaliti — spetsifikatsiya V2 (ommaviy xulosa)", "",
         "Holat: **V2_DRAFT_PENDING_SARVAR**. Javoblar bu faylda yo'q; to'liq: `_private/real-imtihonlar/audit/answer-key-spec-v2.draft.{json,md}`.", "",
         "Dataset, savol/yechim matni, test engine va Mock tizimi o'zgartirilmagan.", "",
         "## Holatlar (240 qism)", "", "| Holat | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byStatus"].items())] + [
         "", "## Qo'llangan o'zgarishlar", "", "| Sabab | Qismlar |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["changesByReason"].items())] + [
         "", "## Tekshiruvlar", ""] + [f"- {k}: {'PASS' if v['pass'] else 'FAIL'}" for k, v in doc["validation"].items()]
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "10_answer_key_spec_v2_summary.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
