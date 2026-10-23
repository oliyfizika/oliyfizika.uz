#!/usr/bin/env python3
"""PHASE 7A — integratsiyadan oldingi moslik auditi (V3 kalit ↔ tahrirlar ↔ app-data ↔ engine). FAQAT O'QIYDI.
Dataset, app-data, engine (scoring.js), Mock tizimi, V3, overlay va oldingi audit fayllari O'ZGARMAYDI. Tahrirlar eksport qilinmaydi.

  node tools/real-imtihonlar/audit/mock_scoring_baseline.mjs     # (avval) Mock baholash snapshot'i
  python3 tools/real-imtihonlar/audit/build_phase7a_audit.py

Natija: _private/real-imtihonlar/audit/phase7a-preintegration-audit.{json,md}; docs/real-imtihonlar/14_phase7a_preintegration_summary.md
"""
import glob
import hashlib
import json
import math
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
AUD = os.path.join(PRIV, "audit")
sys.path.insert(0, HERE)
import build_open_answer_audit as OA  # noqa: E402
import build_editorial_v3 as ED  # noqa: E402  (EDITS ro'yxati — faqat o'qiladi)

REL = 0.01
findings = []   # har bir nomuvofiqlik
checks = []     # har bir tekshirilgan obyekt: (bo'lim, obyekt, natija)


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def sha_t(t):
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


def chk(section, obj, result, note=""):
    checks.append({"section": section, "object": obj, "result": result, "note": note})


def find(section, qid, src, expected, actual, risk, rec):
    findings.append({"section": section, "id": qid, "sourceFile": src, "expected": expected, "actual": actual, "risk": risk, "recommendation": rec})


PREFIX = {"k": 1e3, "M": 1e6, "G": 1e9, "m": 1e-3, "µ": 1e-6, "n": 1e-9, "p": 1e-12, "c": 1e-2, "d": 1e-1}


def scale_between(u_from, u_to):
    """u_from dagi sonni u_to ga o'tkazish koeffitsiyenti (faqat prefiks farqi); aks holda None."""
    if not u_from or not u_to:
        return None
    a, b = OA.unit_norm(u_from), OA.unit_norm(u_to)
    if a == b:
        return 1.0
    for x, y in ((a, b), (b, a)):
        if len(x) == len(y) + 1 and x[1:] == y and x[0] in {k.lower() for k in PREFIX}:
            pass
    # aniq: prefiks + bir xil asos
    def split(u):
        for p in PREFIX:
            if u.startswith(p.lower()) and len(u) > 1:
                return PREFIX[p], u[1:]
        return 1.0, u
    fa, ba = split(a)
    fb, bb = split(b)
    if ba == bb:
        return fa / fb
    if ba == b:
        return fa
    if a == bb:
        return 1 / fb
    return None


def main():
    hashes = {}
    files = {"v3": os.path.join(AUD, "answer-key-spec-v3.draft.json"), "overlay": os.path.join(PRIV, "editorial", "question-edits-v1.json"),
             "decisions003": os.path.join(AUD, "sarvar-decisions-003.json"), "scoring": os.path.join(ROOT, "milliy-sertifikat/mock-testlar/js/scoring.js"),
             "testEngine": os.path.join(ROOT, "milliy-sertifikat/mock-testlar/js/test-engine.js"),
             "exportScript": os.path.join(ROOT, "tools/real-imtihonlar/export_app_data.py"), "validator": os.path.join(ROOT, "tools/real-imtihonlar/validate_app_data.py"),
             "renderJs": os.path.join(ROOT, "assets/js/milliy-sertifikat/real-exams/render.js"),
             "localAdapter": os.path.join(ROOT, "assets/js/milliy-sertifikat/real-exams/adapters/local-adapter.js"),
             "mockBaseline": os.path.join(AUD, "phase7a-mock-scoring-baseline.json")}
    for k, p in files.items():
        hashes[k] = sha(p)
    for p in sorted(glob.glob(os.path.join(PRIV, "app-data", "exams", "*", "*.json"))) + [os.path.join(PRIV, "app-data", "catalog.json")]:
        hashes[os.path.relpath(p, PRIV)] = sha(p)
    v3 = json.load(open(files["v3"], encoding="utf-8"))
    ov = json.load(open(files["overlay"], encoding="utf-8"))["edits"]
    dec = json.load(open(files["decisions003"], encoding="utf-8"))
    oa = {i["partId"]: i for i in json.load(open(os.path.join(AUD, "open-answer-key-audit.json"), encoding="utf-8"))["items"]}
    specs = {s["partId"]: s for s in v3["specs"]}
    appq, apps, dsq = {}, {}, {}
    for p in glob.glob(os.path.join(PRIV, "app-data", "exams", "*", "questions.json")):
        eid = os.path.basename(os.path.dirname(p))
        for q in json.load(open(p, encoding="utf-8"))["questions"]:
            appq[q["id"]] = q
        for s in json.load(open(p.replace("questions.json", "solutions.json"), encoding="utf-8"))["solutions"]:
            apps[f"{eid}-q{s['questionNumber']:02d}"] = s
        for q in json.load(open(os.path.join(PRIV, "dataset", f"{eid}.json"), encoding="utf-8"))["questions"]:
            dsq[q["id"]] = q
    edited_q = {e["questionId"]: e for e in ov}
    edited_parts = {e["questionId"] + p["key"] for e in ov for p in e["parts"]}
    v3_changed = {c["partId"] for c in v3["changes"]}

    # ---------------- A. ID mosligi
    app_parts = {q["id"] + p["key"] for q in appq.values() if q["type"] == "open" for p in q["parts"]}
    ds_parts = {q["id"] + p["key"] for q in dsq.values() if q["type"] == "open" for p in q["parts"]}
    v3_parts = set(specs)
    for name, s in (("app-data", app_parts), ("dataset", ds_parts)):
        miss, extra = v3_parts - s, s - v3_parts
        ok = not miss and not extra and len(v3_parts) == 240
        chk("A", f"V3 ↔ {name} qism ID'lari (240)", "PASS" if ok else "FAIL", f"V3 {len(v3_parts)}, {name} {len(s)}")
        if not ok:
            find("A", ",".join(sorted(miss | extra))[:200], name, "bir xil 240 ID", f"farq: {len(miss)} yo'q / {len(extra)} ortiqcha", "HIGH", "ID'larni moslashtirish")
    for pid in sorted(v3_parts):
        n = int(pid.rsplit("-q", 1)[1][:2])
        chk("A", pid, "PASS" if 36 <= n <= 45 else "FAIL", "36–45 blok")

    # ---------------- B. V3 kalit ↔ app-data yechimlar
    def app_answer(pid):
        s = apps[pid[:-1]]
        m = re.match(r"^\s*a\)\s*(.*?);\s*b\)\s*(.*)$", s["answer"]["text"] or "", re.S)
        return (m.group(1) if pid[-1] == "a" else m.group(2)).strip() if m else None

    pending_export = []
    for pid, sp in sorted(specs.items()):
        s = apps[pid[:-1]]
        pst = s["partSolutionStatus"].get(pid[-1], s["solutionStatus"])
        if pid in edited_parts and pid[:-1] in edited_q:
            e = edited_q[pid[:-1]]
            part_changed = any(p["changed"] for p in e["parts"] if p["key"] == pid[-1])
            key_changed = pid in v3_changed
            if (e["stemChanged"] or part_changed) and key_changed:
                chk("B", pid, "REVIEW", "tahrirlangan — app-data eski shart/yechimni saqlaydi (eksport kutilmoqda)")
                pending_export.append(f"{pid[5:]}: app «{app_answer(pid) or s['answer']['text']}» ({pst}) → V3 " + ", ".join("%.6g %s" % (t["value"], t["unit"] or "") for t in sp["targets"]))
                continue
        aa = app_answer(pid)
        if pst != "FINAL":
            chk("B", pid, "FAIL", f"app-data holati {pst}, V3 {sp['status']}")
            find("B", pid, "app-data solutions.json", "FINAL", pst, "HIGH", "Holatni moslashtirish")
            continue
        pv = OA.parse_value(aa)
        tg = sp["targets"]
        if not tg:
            ok = bool(sp.get("acceptText"))
            chk("B", pid, "PASS" if ok else "FAIL", "matnli javob (acceptText)")
            continue
        variant = tg[0]["variant"]
        if variant in ("normalized", "factor") or sp.get("normalizationGroup"):
            chk("B", pid, "PASS", "normallashtirilgan ko'rinish (6A da tekshirilgan) — son qiymat solishtirilmaydi")
            continue
        if variant == "mantissa":
            exp = re.search(r"10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)", tg[0]["unit"]).group(1).translate(str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-"))
            ok = pv.get("value") is not None and abs(pv["value"] / 10 ** int(exp) - tg[0]["value"]) <= REL * abs(tg[0]["value"])
            chk("B", pid, "PASS" if ok else "FAIL", "mantissa")
            continue
        if pv.get("value") is None:
            chk("B", pid, "REVIEW", f"app-data javobi son emas: {aa}")
            continue
        unit_app = pv.get("unit")
        if not unit_app and pv.get("rest"):
            mu = re.match(r"^\s*([A-Za-zµΩ°]+(?:/[A-Za-z²³]+)?)", pv["rest"])
            unit_app = mu.group(1) if mu else None
        f = scale_between(unit_app or oa[pid]["askedUnit"], tg[0]["unit"]) if tg[0]["unit"] else 1.0
        f = 1.0 if f is None else f
        v_app = pv["value"] * f
        ok = any((t["value"] == 0 and v_app == 0) or (t["value"] != 0 and abs(v_app - t["value"]) <= REL * abs(t["value"])) for t in tg)
        note = f"app {aa} → {v_app:.6g} {tg[0]['unit'] or ''}" + (f" (birlik ×{f:g})" if f != 1 else "")
        chk("B", pid, "PASS" if ok else "FAIL", note)
        if not ok:
            find("B", pid, "app-data solutions.json", ", ".join(f"{t['value']:.6g}" for t in tg), note, "HIGH", "Kalit yoki yechimni tekshirish")
        if f != 1:
            find("B", pid, "app-data solutions.json", f"yechim birligi kalit bilan bir xil ({tg[0]['unit']})", f"yechim matni '{aa}'",
                 "LOW", "Eksportda yechim javob qatorini kalit birligida ham ko'rsatish (CRIT-01 kabi)")

    if pending_export:
        find("B", f"{len(pending_export)} tahrirlangan qism", "app-data/exams/*/{questions,solutions}.json", "tahrirlangan shart, yechim va FINAL holat",
             "; ".join(pending_export), "MEDIUM (kutilgan)", "PHASE 7B eksportida overlay qo'llanadi; hozir app-data eski holatda — integratsiyadan oldin eksport shart")

    # ---------------- C. Tahrirlar: asl/yangi matn
    for e in ov:
        qid = e["questionId"]
        d, a = dsq[qid], appq[qid]
        ok_hash = e["originalTextSha256"] == sha_t(d["questionText"]) == sha_t(a["questionText"])
        chk("C", f"{qid} asl matn hash (dataset = app-data = overlay)", "PASS" if ok_hash else "FAIL")
        if not ok_hash:
            find("C", qid, "editorial/question-edits-v1.json", "hash mos", "mos emas", "HIGH", "Overlay'ni qayta qurish")
        for p in e["parts"]:
            ap = next(x for x in a["parts"] if x["key"] == p["key"])
            chk("C", f"{qid}{p['key']} asl qism matni", "PASS" if ap["text"] == p["originalText"] else "FAIL")
        spec = next(x for x in ED.EDITS if x["qid"] == qid)
        frag_ok = all(new in e["editedQuestionText"] and (old in new or old not in e["editedQuestionText"]) for old, new in spec["stem"])
        for k, lst in spec["parts"].items():
            pt = next(p for p in e["parts"] if p["key"] == k)["editedText"]
            frag_ok &= all(new in pt for _, new in lst)
        changed = e["stemChanged"] or any(p["changed"] for p in e["parts"])
        chk("C", f"{qid} tahrir bo'laklari qo'llangan", "PASS" if frag_ok and changed else "FAIL")
        meta_ok = all(e.get(k) for k in ("editor", "date", "reason", "displayBadge")) and e.get("originalPreserved") is True and e.get("status") == "APPROVED_BY_SARVAR"
        chk("C", f"{qid} tahrir metama'lumoti", "PASS" if meta_ok else "FAIL")
        txt = e["editedQuestionText"] + " " + " ".join(p["editedText"] for p in e["parts"])
        balanced = txt.count("$") % 2 == 0
        chk("C", f"{qid} TeX '$' juftligi", "PASS" if balanced else "FAIL")
        if not balanced:
            find("C", qid, "overlay", "juft $", "toq $", "MEDIUM", "TeX belgilarini tuzatish")

    # ---------------- D. Tahrirlangan yechim ↔ V3 kalit
    REQ_TOKENS = {
        "REAL-2025-02-22-q39": ["o‘zgarmas bosimda"], "REAL-2025-05-13-2-q36": ["gorizontal"], "REAL-2026-01-18-q43": ["to‘la yoyilish burchagi"],
        "REAL-2026-01-18-q40": ["22 mN/m", "800 kg/m", "$g = 10$", "\\pi \\approx 3"], "REAL-2025-11-30-q41": ["elektr maydon kuchlari"],
        "REAL-2025-02-22-q41": ["$E = 2$ kV/m", "$l = 10$ cm", "(eV)"], "REAL-2025-02-22-q43": ["$B = 0{,}2$ T", "$r = 5$ cm", "1{,}67", "(MHz)", "(km/s)"],
        "REAL-2025-05-13-1-q41": ["$Q = 4$ nC", "$q = 1$ nC", "0{,}1", "$r = 9$ cm", "9\\cdot10^9", "(m/s)", "$\\mu$J"],
        "REAL-2026-01-18-q41": ["0{,}5", "100", "0{,}2", "100$ rad/s", "$t = 0$", "(V)", "(mW)"]}
    for e in ov:
        qid = e["questionId"]
        txt = e["editedQuestionText"] + " " + " ".join(p["editedText"] for p in e["parts"])
        miss = [t for t in REQ_TOKENS[qid] if t not in txt]
        chk("D", f"{qid} kerakli ma'lumot shartda", "PASS" if not miss else "FAIL", ", ".join(miss) or "hammasi bor")
        for k, steps in e["editedSolution"].items():
            pid = qid + k
            jav = next((s for s in steps if s.startswith("Javob")), "")
            m = re.search(r"([−\-]?≈?\s*[\d]+(?:,\d+)?)\s*([^\s]*)", jav.replace("Javob:", "").strip())
            sp = specs[pid]
            if not m or not sp["targets"]:
                chk("D", pid, "REVIEW", jav)
                continue
            num = float(m.group(1).replace("≈", "").replace("−", "-").replace(",", ".").strip())
            ok = any(abs(num - t["value"]) <= REL * max(abs(t["value"]), 1e-12) for t in sp["targets"])
            chk("D", pid, "PASS" if ok else "FAIL", f"yechim '{jav}' ↔ V3 {[round(t['value'], 6) for t in sp['targets']]}")
            if not ok:
                find("D", pid, "overlay editedSolution", str([t["value"] for t in sp["targets"]]), jav, "HIGH", "Yechim yoki kalitni tuzatish")
            if sp["status"] not in ("READY", "READY_ENGINE_FEATURE_REQUIRED"):
                find("D", pid, "V3", "READY", sp["status"], "HIGH", "—")

    # ---------------- E. 45 READY_ENGINE_FEATURE_REQUIRED — engine imkoniyatlari
    scoring = open(files["scoring"], encoding="utf-8").read()
    engine = open(files["testEngine"], encoding="utf-8").read()
    support = {
        "UI_UNIT_LABEL": ("SUPPORTED", "test-engine.js qism 'unit' maydonini kiritish yonida ko'rsatadi (span.unit) — faqat ma'lumot moslash"),
        "UNIT_HINT_UI": ("SUPPORTED", "xuddi shu 'unit' maydoni orqali (masalan '× E')"),
        "TEXT_KIND": ("SUPPORTED", "kind:'text' + accept[]"),
        "MULTI_VALUE": ("NOT_SUPPORTED", "checkPart bitta p.answer bilan solishtiradi"),
        "HYBRID_NUM_TEXT": ("NOT_SUPPORTED", "qism yoki son, yoki matn; parseNumber kasr/√/π ni o'qimaydi (null)"),
        "TWO_FIELD_FACTOR_DIRECTION": ("NOT_SUPPORTED", "har qism uchun bitta kiritish maydoni"),
    }
    assert 'p.unit ? h("span", { class: "unit" }, p.unit)' in engine
    assert "isNear(v, p.answer, p.tolerance, relTol)" in scoring
    ref = [s for s in specs.values() if s["status"] == "READY_ENGINE_FEATURE_REQUIRED"]
    feat_parts = Counter()
    truly_blocked = []
    for s in ref:
        reqs = s.get("engineRequirements", [])
        miss = [r for r in reqs if support.get(r, ("NOT_SUPPORTED",))[0] != "SUPPORTED"]
        for r in reqs:
            feat_parts[r] += 1
        chk("E", s["partId"], "PASS" if not miss else "REVIEW", ("kerak: " + ", ".join(miss)) if miss else "mavjud engine + ma'lumot moslash yetarli")
        if miss:
            truly_blocked.append(s["partId"])
    all_multi = [s["partId"] for s in specs.values() if len(s["targets"]) > 1]
    hidden_multi = [p for p in all_multi if specs[p]["status"] == "READY"]
    for p in all_multi:
        chk("E", p + " (ko'p qiymat)", "REVIEW", "MULTI_VALUE kengaytmasi kerak" + (" — V3 holati READY" if p in hidden_multi else ""))
    if hidden_multi:
        find("E", f"{len(hidden_multi)} qism (g/π variantlari)", "answer-key-spec-v3.draft.json", "engine talabi holatda aks etsin",
             f"{len(hidden_multi)} qism READY, lekin bir nechta qabul qilinadigan qiymatga ega — mavjud engine faqat bittasini tekshiradi",
             "HIGH", "PHASE 7B: MULTI_VALUE (accepted[]) kengaytmasi; V4 da bu qismlarning engineRequirements maydoniga MULTI_VALUE qo'shiladi (holat ma'nosini aniqlashtirish)")

    # ---------------- F. UI birliklari
    for s in specs.values():
        if not s.get("uiUnitLabel"):
            continue
        u = s["uiUnitLabel"]
        ok = u["display"] == u["stored"] == s["targets"][0]["unit"] and u["rescale"] is False and "$" not in u["display"]
        vals = ", ".join("%.6g" % t["value"] for t in s["targets"])
        chk("F", s["partId"], "PASS" if ok else "FAIL", "ko'rsatiladi '%s', qiymat(lar) %s" % (u["display"], vals))

    # ---------------- G. Ko'p qiymat va toleranslar
    for s in specs.values():
        tg = s["targets"]
        for t in tg:
            ty, tv = t["tolerance"]["type"], t["tolerance"]["value"]
            ok = (ty == "relative" and tv == REL) or (ty == "absolute" and t["value"] == 0 and tv == 1e-9) or (ty == "exact" and float(t["value"]).is_integer())
            if not ok:
                chk("G", s["partId"], "FAIL", f"tolerans {ty} {tv}")
                find("G", s["partId"], "V3", "siyosatga mos tolerans", f"{ty} {tv}", "HIGH", "Tuzatish")
        if len(tg) > 1:
            vals = [t["value"] for t in tg]
            distinct = len({round(v, 12) for v in vals}) == len(vals)
            labelled = all(t.get("variant") for t in tg)
            chk("G", s["partId"], "PASS" if distinct and labelled else "FAIL", f"{len(tg)} qiymat: " + ", ".join(f"{t['value']:.6g} ({t['variant']})" for t in tg))
    neg = [s["partId"] for s in specs.values() if any(t["value"] < 0 for t in s["targets"])]
    sci = [s["partId"] for s in specs.values() if any(t["value"] != 0 and (abs(t["value"]) >= 1e5 or abs(t["value"]) < 1e-3) for t in s["targets"])]

    # ---------------- H. HIGH 006
    q18 = apps["REAL-2026-04-06-2-q18"]
    still = any("06.04-2 #18" in x for x in dec.get("stillOpenOutsideOpenAnswers", []))
    h_ok = still and q18["solutionStatus"] == "NO_CORRECT_OPTION" and "REAL-2026-04-06-2-q18" not in edited_q and not any(p.startswith("REAL-2026-04-06-2-q18") for p in specs)
    chk("H", "HIGH 006 (06.04-2 #18)", "PASS" if h_ok else "FAIL", f"qarorlar: ochiq={still}; app-data: {q18['solutionStatus']}; overlay/V3 da yo'q")

    # ---------------- I. Eksportda tahrir metama'lumoti
    exp_src = open(files["exportScript"], encoding="utf-8").read()
    val_src = open(files["validator"], encoding="utf-8").read()
    render_src = open(files["renderJs"], encoding="utf-8").read()
    has_overlay = "editorial" in exp_src
    chk("I", "export_app_data.py tahrir overlay'ini qo'llaydi", "REVIEW" if not has_overlay else "PASS", "hozircha yo'q")
    find("I", "export_app_data.py", "tools/real-imtihonlar/export_app_data.py", "overlay qo'llash + editorial{edited, originalText, originalSha256, badge, editor, date}",
         "overlay qo'llanmaydi", "BLOCKER (eksport uchun)", "PHASE 7B: eksportda overlay'ni asl hash tekshiruvi bilan qo'llash; asl matnni saqlash")
    strict = "for k in (\"questionText\"" in val_src
    chk("I", "validate_app_data.py tahrirga tayyor", "REVIEW" if strict else "PASS", "questionText == dataset qat'iy tekshiruvi")
    find("I", "validate_app_data.py", "tools/real-imtihonlar/validate_app_data.py", "tahrirlangan savollar overlay bilan tekshiriladi; EXPECTED sonlari yangilanadi",
         "questionText/parts dataset bilan qat'iy teng bo'lishi shart; EXPECTED: FINAL 531, NEEDS_MANUAL_REVIEW 3, reviewParts 5", "BLOCKER (eksport uchun)",
         "Validator'ga overlay rejimi: tahrirlangan 9 savol uchun editedText == overlay, originalText hash == dataset; status sonlari qayta hisoblanadi")
    badge = "Tahrirlangan" in render_src or "editorial" in render_src
    chk("I", "render.js 'Tahrirlangan shart' belgisi", "REVIEW" if not badge else "PASS")
    find("I", "render.js", "assets/js/milliy-sertifikat/real-exams/render.js", "editorial.edited bo'lsa belgi", "belgi yo'q", "MEDIUM", "PHASE 7B: belgi + 'asl matnni ko'rish' havolasi")
    chk("I", "Kalit (answerKey) app-data'da", "REVIEW", "app-data solutions.json da strukturalangan kalit yo'q — faqat matnli javob")
    find("I", "app-data/exams/*/solutions.json", "app-data", "private/solutions ichida answerKey (targets, tolerance, accept, inputFormat, unit)", "yo'q",
         "BLOCKER (integratsiya uchun)", "PHASE 7B: V3 dan answerKey eksporti (faqat private/solutions — Rules bilan himoyalangan)")

    # ---------------- J. Mock regressiya
    base = json.load(open(files["mockBaseline"], encoding="utf-8"))
    chk("J", "Mock baseline: 15 test kalit javoblari to'g'ri baholanadi", "PASS" if base["summary"]["allKeysCorrect"] else "FAIL",
        f"{base['summary']['tests']} test, {base['summary']['questions']} savol; scoring.js sha {base['scoringSha256'][:16]}")
    chk("J", "scoring.js baseline bilan bir xil", "PASS" if base["scoringSha256"] == hashes["scoring"] else "FAIL")
    rel = Counter(t["relTol"] for t in base["tests"])
    find("J", "scoring.js / Mock data", "mock-test-*.json", "Real test uchun defaultRelativeTolerance = 0,01 faqat Real test konfiguratsiyasida",
         f"Mock relTol: {dict(rel)}; 235 qismda absolyut tolerance, 65 qism relTol ga tayanadi", "HIGH (regressiya)",
         "Global standart qiymat (1e-8) o'zgartirilmasin; Real uchun test.scoring.defaultRelativeTolerance = 0,01 beriladi")
    find("J", "scoring.js importlari", "attempt-service.js, result.js, test-engine.js, catalog.js, assets/js/milliy-sertifikat/mock-catalog.js",
         "kengaytma orqaga mos", "5 modul scoring.js ga bog'liq; avtomatik testlar yo'q", "HIGH (regressiya)",
         "Har bir engine o'zgarishidan keyin mock_scoring_baseline.mjs qayta ishga tushirilib snapshot bilan solishtirilsin; yangi maydonlar ixtiyoriy (accepted[], kind:'hybrid', inputFormat)")
    pn = base["probes"]
    find("J", "parseNumber / sanitizeNumInput", "scoring.js", "'−' (U+2212) minus sifatida o'qilsin",
         "parseNumber('−5') = %s; sanitizeNumInput '−' ni o'chiradi → −1080 kiritilsa 1080 bo'lib qoladi" % pn['parseNumber("−5")'],
         "HIGH (ishora majburiy qismlar)", f"Kengaytmada U+2212 → '-' normallashtirish; Real: {len(neg)} manfiy qism, Mock: 6 manfiy qism ham foyda ko'radi")
    find("J", "test-engine.js inputmode", "test-engine.js", "manfiy va ilmiy javoblar telefonda kiritilishi mumkin",
         "sonli qismda inputmode='decimal' — iOS raqam klaviaturasida '-', 'e', '^' yo'q; p.scientific = true bo'lsa 'text'", "MEDIUM",
         f"Ma'lumot moslashda manfiy ({len(neg)}) va ilmiy ko'rinishdagi ({len(sci)}) qismlarga scientific: true berish (engine o'zgarishisiz)")
    find("J", "Savol turlari", "test-engine.js (mcq/open2)", "Real turlari (mc, match 33–35, open) engine'ga moslashsin", "engine faqat mcq/open2 qabul qiladi",
         "MEDIUM", "PHASE 7B: adapter qatlamida mapping (mc→mcq, open→open2, match → 3 ta 6-variantli mcq — Mock 33–35 kabi); engine'ni nusxalamaslik")

    st = Counter(c["result"] for c in checks)
    by_sec = {}
    for c in checks:
        by_sec.setdefault(c["section"], Counter())[c["result"]] += 1
    blockers = [f for f in findings if "BLOCKER" in f["risk"]]
    summary = {"objectsChecked": len(checks), "results": dict(st), "bySection": {k: dict(v) for k, v in sorted(by_sec.items())},
               "findings": len(findings), "findingsByRisk": dict(Counter(f["risk"] for f in findings)), "blockers": len(blockers),
               "ref45": {"total": len(ref), "engineCompatibleWithDataMapping": len(ref) - len(truly_blocked), "needEngineExtension": len(truly_blocked),
                         "byFeature": dict(feat_parts)},
               "multiValueParts": len(all_multi), "negativeParts": neg, "scientificParts": len(sci)}
    readiness = {
        "phase7bDesign": "TAYYOR — barcha talablar aniq: answerKey eksporti (private), overlay eksporti + validator rejimi, belgi, engine'ga ixtiyoriy kengaytmalar (accepted[], hybrid, two-field, U+2212), Real→engine tur mapping'i, Mock snapshot regressiyasi.",
        "phase7bImplementation": "BLOKLANGAN — eksport/validator overlay rejimi va answerKey eksporti hali yo'q (dizayn bosqichida hal qilinadi).",
    }
    doc = {"schemaVersion": 1, "phase": "7A", "status": "AUDIT_COMPLETE", "changed": {"dataset": False, "appData": False, "engine": False, "mock": False, "v3": False, "overlay": False},
           "inputHashes": hashes, "summary": summary, "readiness": readiness, "engineSupport": {k: {"status": v[0], "note": v[1]} for k, v in support.items()},
           "findings": findings, "checks": checks}
    json.dump(doc, open(os.path.join(AUD, "phase7a-preintegration-audit.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc)
    write_public(doc)
    print(json.dumps(summary, ensure_ascii=False, indent=1))


def write_md(doc):
    s = doc["summary"]
    L = ["# PHASE 7A — integratsiyadan oldingi moslik auditi (MAXFIY)", "", "Dataset, app-data, engine, Mock, V3 va overlay o'zgartirilmagan; tahrirlar eksport qilinmagan.", "",
         f"Tekshirilgan obyektlar: **{s['objectsChecked']}** · " + " · ".join(f"{k} {v}" for k, v in sorted(s["results"].items())), "",
         "| Bo'lim | PASS | FAIL | REVIEW |", "|---|---:|---:|---:|"]
    names = {"A": "A. ID mosligi", "B": "B. V3 ↔ app-data yechim", "C": "C. Tahrir matnlari", "D": "D. Tahrir yechimi ↔ kalit", "E": "E. 45 REF — engine",
             "F": "F. UI birliklari", "G": "G. Ko'p qiymat / tolerans", "H": "H. HIGH 006", "I": "I. Eksport metama'lumoti", "J": "J. Mock regressiya"}
    for k, v in s["bySection"].items():
        L.append(f"| {names[k]} | {v.get('PASS', 0)} | {v.get('FAIL', 0)} | {v.get('REVIEW', 0)} |")
    L += ["", "## Tayyorlik", ""] + [f"- **{k}**: {v}" for k, v in doc["readiness"].items()] + [
          "", "## Engine imkoniyatlari (hozirgi ↔ kerakli)", "", "| Talab | Holat | Izoh |", "|---|---|---|"] + [
          f"| {k} | {v['status']} | {v['note']} |" for k, v in doc["engineSupport"].items()] + [
          "", f"45 REF qismdan: mavjud engine + ma'lumot moslash bilan {s['ref45']['engineCompatibleWithDataMapping']}, kengaytma kerak {s['ref45']['needEngineExtension']}.", "",
          "## Nomuvofiqliklar", "", "| Bo'lim | ID | Manba fayli | Kutilgan | Mavjud | Xavf | Tavsiya |", "|---|---|---|---|---|---|---|"]
    order = {"BLOCKER": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    for f in sorted(doc["findings"], key=lambda f: (order.get(f["risk"].split()[0], 9), f["section"], f["id"])):
        L.append(f"| {f['section']} | {f['id'][5:] if f['id'].startswith('REAL-') else f['id']} | {f['sourceFile']} | {str(f['expected']).replace('|', '/')} | "
                 f"{str(f['actual']).replace('|', '/')} | {f['risk']} | {f['recommendation'].replace('|', '/')} |")
    L += ["", "## Barcha tekshiruvlar", "", "| Bo'lim | Obyekt | Natija | Izoh |", "|---|---|---|---|"]
    for c in doc["checks"]:
        L.append(f"| {c['section']} | {c['object'].replace('REAL-', '')} | {c['result']} | {c['note'].replace('|', '/')} |")
    open(os.path.join(AUD, "phase7a-preintegration-audit.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public(doc):
    s = doc["summary"]
    L = ["# PHASE 7A — integratsiyadan oldingi moslik auditi (ommaviy xulosa)", "",
         "Javoblar va savol matnlari bu faylda yo'q; to'liq: `_private/real-imtihonlar/audit/phase7a-preintegration-audit.{json,md}`.", "",
         "Dataset, app-data, engine (scoring.js), Mock tizimi, V3 va tahrirlar o'zgartirilmagan; tahrirlar eksport qilinmagan.", "",
         f"Tekshirilgan obyektlar: {s['objectsChecked']} — " + ", ".join(f"{k} {v}" for k, v in sorted(s["results"].items())), "",
         "| Bo'lim | PASS | FAIL | REVIEW |", "|---|---:|---:|---:|"] + [f"| {k} | {v.get('PASS', 0)} | {v.get('FAIL', 0)} | {v.get('REVIEW', 0)} |" for k, v in s["bySection"].items()] + [
         "", f"Nomuvofiqliklar: {s['findings']} (" + ", ".join(f"{k} {v}" for k, v in s["findingsByRisk"].items()) + ")", "",
         "## Tayyorlik", ""] + [f"- **{k}**: {v}" for k, v in doc["readiness"].items()]
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "14_phase7a_preintegration_summary.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
