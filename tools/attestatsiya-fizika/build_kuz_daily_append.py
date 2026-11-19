#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: «Attestatsiya 2026 (kuz)» 1-test savollarini 32 kunlik kursning mos mavzuli kunlariga QO‘SHISH fayli.

Har bir savol items.json dagi `day` maydoni bo‘yicha shu kunning oxiriga qo‘shiladi (day = None — kursda allaqachon bor,
o‘tkazib yuboriladi). Savol `topic` i kunning mavzularidan biri bo‘lishi shart (docs/attestatsiya-fizika/daily_test_plan.json).

Chiqish: _private/attestatsiya-fizika/kuz-2026-1-daily-append.json — admin sahifasidagi «Kunlik testlarga savol qo‘shish»
bo‘limi o‘qiydi. U har bir kunning JORIY versiyasini (vN) Firestore'dan o‘qib, v{N+1} = eski savollar + yangilari ni yozadi,
so‘ng test meta’sini yangilaydi. Eski urinishlar o‘z versiyasida qoladi. Hech narsa o‘chirilmaydi.

  python3 tools/attestatsiya-fizika/build_kuz_daily_append.py [--check]
"""
import argparse, base64, hashlib, json, os, sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mock_test as b1
import build_mock_test_02 as b2
import kuz_common as K

OUT = os.path.join(K.PRIV, "kuz-2026-1-daily-append.json")
MAX_PER_DAY = 50


def plan_days():
    p = json.load(open(os.path.join(K.DOCS, "daily_test_plan.json"), encoding="utf-8"))
    return {d["dayNumber"]: d for d in p["days"]}


def build():
    items = K.load_items()
    days = plan_days()
    out = OrderedDict()
    skipped = []
    for it in items:
        if it.get("day") is None:
            skipped.append(it["n"]); continue
        d = days[it["day"]]
        tid = d["id"]
        assert it["topic"] in d["topics"], f"{it['n']}: «{it['topic']}» {it['day']}-kun mavzulari ichida yo‘q ({d['topics']})"
        e = out.setdefault(tid, OrderedDict([("testId", tid), ("dayNumber", d["dayNumber"]), ("section", d["section"]),
                                              ("planQuestionCount", d["questionCount"]), ("questions", []), ("solutions", []),
                                              ("answers", OrderedDict()), ("figures", [])]))
        figs = OrderedDict()
        q, s, letter = K.build_question(it, tid, 0, figs)          # position — admin sahifasida qayta raqamlanadi
        q["section"], q["sectionTitle"] = d["section"], d["sectionTitle"]
        e["questions"].append(q); e["solutions"].append(s); e["answers"][q["id"]] = letter
        for (_col, fid), doc in figs.items():
            e["figures"].append(OrderedDict((k, v) for k, v in doc.items() if k != "testId"))
    days_out = list(out.values())
    h = hashlib.sha256(json.dumps([[d["testId"], [q["id"] for q in d["questions"]], list(d["answers"].values())] for d in days_out]).encode()).hexdigest()[:16]
    bundle = OrderedDict([("format", "oliyfizika-attestation-append"), ("schemaVersion", 1), ("source", K.SOURCE_NOTE), ("hash", h),
                          ("counts", OrderedDict([("days", len(days_out)), ("questions", sum(len(d["questions"]) for d in days_out)),
                                                  ("figures", sum(len(d["figures"]) for d in days_out))])),
                          ("skipped", skipped), ("days", days_out)])
    return bundle


def validate(bundle):
    errs = []
    ok = lambda c, m: None if c else errs.append(m)
    seen = set()
    leak = {"correctAnswer", "solution", "bookAnswer", "solutionResult", "answers", "review", "verify"}
    for d in bundle["days"]:
        ids = [q["id"] for q in d["questions"]]
        ok(len(ids) == len(set(ids)) and not seen & set(ids), f"{d['testId']}: savol ID takrorlanmasin")
        seen |= set(ids)
        ok(d["planQuestionCount"] + len(ids) <= MAX_PER_DAY, f"{d['testId']}: 50 savoldan oshmasin")
        ok(list(d["answers"]) == ids == [s["id"] for s in d["solutions"]], f"{d['testId']}: kalit/yechim tartibi")
        ok(all(s["correctAnswer"] == d["answers"][s["id"]] for s in d["solutions"]), f"{d['testId']}: yechim javobi kalit bilan bir xil")
        ok(not any(f'"{k}"' in json.dumps(q) for q in d["questions"] for k in leak), f"{d['testId']}: public savolda javob maydoni yo‘q")
        refs = set()
        b2.walk(d["questions"], lambda x: refs.add(x["id"]) if x.get("t") == "figure" else None)
        ok(refs == {f["id"] for f in d["figures"]}, f"{d['testId']}: rasm bloklari <-> rasm hujjatlari")
        for f in d["figures"]:
            ok(f["mime"] == "image/webp" and 0 < f["bytes"] <= b2.MAX_FIG_BYTES and len(base64.b64decode(f["data"])) == f["bytes"], f"{f['id']}: rasm")
        for q in d["questions"]:
            ok(q["optionCount"] == 4 and d["answers"][q["id"]] in "ABCD", f"{q['id']}: variantlar")
        ok(not b1.nested(d), f"{d['testId']}: ichma-ich massiv")
        ok(len(json.dumps(d["questions"], ensure_ascii=False).encode()) < 600_000, f"{d['testId']}: hajm")
        K.latex_outside_dollars([d["questions"], d["solutions"]], errs)
    return errs


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); a = ap.parse_args()
    bundle = build()
    errs = validate(bundle)
    print(f"{K.SOURCE_NOTE}: {bundle['counts']['questions']} savol -> {bundle['counts']['days']} kun · rasmlar {bundle['counts']['figures']} · "
          f"o‘tkazildi (kursda bor): {bundle['skipped']} · hash {bundle['hash']}")
    for d in bundle["days"]:
        print(f"  {d['dayNumber']:>2}-kun: +{len(d['questions'])} ({', '.join(q['id'] for q in d['questions'])})")
    if errs:
        print("XATO:\n  " + "\n  ".join(errs)); sys.exit(1)
    print("tekshiruvlar: PASS")
    if a.check:
        return
    json.dump(bundle, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"yozildi: {os.path.relpath(OUT, K.ROOT)}")


if __name__ == "__main__":
    main()
