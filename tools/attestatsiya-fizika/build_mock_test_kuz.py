#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: MOCK TEST 11 — «Attestatsiya 2026 (kuz)» 1-testi asosida (att-fizika-mock-11, dayNumber 111).

Tarkib: 50 savol = manbadagi 34 ta fizika savoli + 35-o‘ringa kurs bazasidan AF-2-064 + 15 pedagogika;
har savol 2 ball -> 100 ball. Mexanizm mock-03…10 bilan bir xil: istalgan vaqtda 1 marta, boshlagandan 2 soat,
kalit va yechimlar o‘z urinishi yakunlangach. Standart: pullik (paidOnly: true); --free — hamma uchun bepul.

Manba: kuz_common.py (items.json + figures). Pedagogika: attestatsiya/pedagogika-testlari/data/test*.js (FAQAT O‘QILADI),
mock-generator.js qoidalari bilan; docs/attestatsiya-fizika/mock_test_*_plan.json va (bo‘lsa)
_private/attestatsiya-fizika/mocks-used.json ([{id, text}] — barcha mavjud mocklardagi pedagogika savollari) qayta olinmaydi.
Chiqish: _private/attestatsiya-fizika/mock-import-11.json (admin «Mock test importi») + docs/attestatsiya-fizika/mock_test_11_plan.json

  python3 tools/attestatsiya-fizika/build_mock_test_kuz.py [--free] [--check]
"""
import argparse, base64, glob, hashlib, json, os, subprocess, sys
from collections import Counter, OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mock_test as b1
import build_mock_test_02 as b2
import kuz_common as K

NUMBER = 11
TID = f"att-fizika-mock-{NUMBER:02d}"
DAY = b1.FIRST_MOCK_DAY + NUMBER - 1
POINTS, TIME_LIMIT, TOTAL = 2, 7200, 50
USED = os.path.join(K.PRIV, "mocks-used.json")
PED_TITLE = "Pedagogika"
TOPICS = list(K.SECTION_TITLES.values()) + [PED_TITLE]
SEC_IDX = {k: i for i, k in enumerate(K.SECTION_TITLES)}


def load_used():
    used = []
    for p in sorted(glob.glob(os.path.join(K.DOCS, "mock_test_*_plan.json"))):
        if os.path.basename(p) != f"mock_test_{NUMBER:02d}_plan.json":
            used += [{"id": i, "text": ""} for i in json.load(open(p, encoding="utf-8"))["questionIds"]]
    if not os.path.exists(USED):
        print(f"OGOHLANTIRISH: {os.path.relpath(USED, K.ROOT)} yo‘q — pedagogika faqat repo rejalaridagi mocklar bilan solishtirildi.")
        return used, False
    extra = json.load(open(USED, encoding="utf-8"))
    assert isinstance(extra, list) and all("id" in u and "text" in u for u in extra), "mocks-used.json: [{id, text}]"
    return used + extra, True


def pick_pedagogy(phys_texts, phys_letters, used, n_ped):
    r = subprocess.run(["node", "-e", b1.PED_NODE, b1.PED_DIR], capture_output=True, text=True, check=True)
    gen = "file://" + os.path.join(K.ROOT, "assets", "js", "attestatsiya-fizika", "mock-generator.js")
    r2 = subprocess.run(["node", "--input-type=module", "-e", K.PED_PICK_NODE, gen, r.stdout, json.dumps(used, ensure_ascii=False),
                         json.dumps(phys_texts, ensure_ascii=False), str(n_ped), f"mock-{NUMBER}", json.dumps(phys_letters)],
                        capture_output=True, text=True)
    if r2.returncode:
        sys.exit(r2.stderr)
    res = json.loads(r2.stdout)
    if len(res["picked"]) < n_ped:
        sys.exit(f"takrorlanmaydigan pedagogika savoli yetmadi ({len(res['picked'])}/{n_ped})")
    return res["picked"]


def build(paid):
    items = K.load_items()
    n_phys = len(items)
    n_ped = TOTAL - n_phys
    used, used_full = load_used()
    ids, questions, answers, solutions, topic_idx, figures = [], [], OrderedDict(), [], [], OrderedDict()
    for pos, it in enumerate(items, 1):
        q, s, letter = K.build_question(it, TID, pos, figures)
        ids.append(q["id"]); questions.append(q); answers[q["id"]] = letter; solutions.append(s); topic_idx.append(SEC_IDX[it["sec"]])
    peds = pick_pedagogy([K.plain(it) for it in items], list(answers.values()), used, n_ped)
    para = lambda t: [{"t": "p", "text": " ".join(str(t).split())}]
    for p in peds:
        pid = p["id"]
        questions.append(OrderedDict([("id", pid), ("section", "pedagogika"), ("sectionTitle", PED_TITLE), ("topic", PED_TITLE), ("type", "mcq"),
                                      ("evaluationType", "auto"), ("difficulty", "medium"), ("difficultyLevel", 2), ("question", para(p["question"])),
                                      ("options", [OrderedDict([("key", K.LETTERS[i]), ("blocks", para(a))]) for i, a in enumerate(p["answers"])]),
                                      ("optionCount", 4), ("position", len(ids) + 1), ("bookNumber", f"P{p['file']}.{p['n']}"), ("contentVersion", 1)]))
        solutions.append(OrderedDict([("id", pid), ("evaluationType", "auto"), ("correctAnswer", p["letter"]), ("solutionResult", p["letter"]),
                                      ("solutionStatus", "theory"),
                                      ("solution", [{"t": "answer", "blocks": para(f"{p['letter']}) {p['answers'][p['correct']]}")}])]))
        ids.append(pid); answers[pid] = p["letter"]; topic_idx.append(len(TOPICS) - 1)
    plan_hash = hashlib.sha256(json.dumps([ids, list(answers.values())], ensure_ascii=False).encode()).hexdigest()[:16]
    comp = OrderedDict([("fizika", n_phys), ("pedagogika", n_ped)])
    test = OrderedDict([
        ("id", TID), ("course", "fizika"), ("kind", "mock"), ("schemaVersion", 1), ("dayNumber", DAY), ("mockNumber", NUMBER),
        ("section", "mock"), ("sectionTitle", f"Mock test {NUMBER}"), ("topics", TOPICS), ("topicParts", []), ("questionIds", ids), ("questionCount", TOTAL),
        ("questionTopicIdx", topic_idx), ("questionEval", ["a"] * TOTAL), ("scorableCount", TOTAL), ("openCount", 0), ("unreliableCount", 0),
        ("difficulty", OrderedDict([("1", 0), ("2", TOTAL), ("3", 0), ("4", 0)])), ("bookRange", ""), ("pointsPerQuestion", POINTS),
        ("maxScore", 100), ("physicsCount", n_phys), ("pedagogyCount", n_ped), ("composition", comp), ("source", K.SOURCE_NOTE),
        ("status", "draft"), ("published", False), ("publishAt", None), ("publishedAt", None), ("publishedBy", None),
        ("solutionAvailableAt", None), ("archivedAt", None), ("timeLimitSeconds", TIME_LIMIT), ("currentVersion", 1), ("planHash", plan_hash),
        ("notification", OrderedDict([("title", f"Mock test {NUMBER} tayyor"),
                                      ("body", f"Attestatsiya 2026 (kuz) 1-test asosida · {n_phys} fizika + {n_ped} pedagogika · 100 ball"),
                                      ("href", f"attestatsiya/fizika-test.html?day={DAY}")])),
        ("figureCount", len(figures)),
    ])
    if paid:
        test["paidOnly"] = True
    base = f"attestationPhysicsDailyTests/{TID}"
    ops = [OrderedDict([("op", "set"), ("path", base), ("data", test)]),
           OrderedDict([("op", "create"), ("path", f"{base}/versions/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("dayNumber", DAY), ("questionIds", ids), ("questions", questions)]))]),
           OrderedDict([("op", "create"), ("path", f"{base}/keys/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("questionIds", ids), ("answers", answers), ("scorableCount", TOTAL)]))]),
           OrderedDict([("op", "create"), ("path", f"{base}/solutions/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("questionIds", ids), ("items", solutions)]))])]
    for (col, fid), d in sorted(figures.items()):
        ops.append(OrderedDict([("op", "create"), ("path", f"{base}/{col}/{fid}"), ("data", d)]))
    return test, ops, figures, used_full


def validate(test, ops, figures, paid):
    errs = []
    ok = lambda c, m: None if c else errs.append(m)
    ids = test["questionIds"]; ver, key, sol = ops[1]["data"], ops[2]["data"], ops[3]["data"]
    n_ped = test["pedagogyCount"]
    ok(len(ids) == TOTAL == len(set(ids)), "50 ta noyob savol")
    ok(test["maxScore"] == 100 and test["timeLimitSeconds"] == 7200 and (test.get("paidOnly") is True) == paid, "100 ball / 2 soat / paidOnly")
    ok(test["kind"] == "mock" and test["dayNumber"] == 101 + NUMBER - 1 and test["status"] == "draft" and test["published"] is False, "mock / draft")
    ok(Counter(test["questionTopicIdx"])[len(TOPICS) - 1] == n_ped and test["physicsCount"] + n_ped == TOTAL, "fizika + pedagogika = 50")
    ok(list(key["answers"]) == ids and key["scorableCount"] == TOTAL, "kalit tartibi")
    ok([q["id"] for q in ver["questions"]] == ids and [i["id"] for i in sol["items"]] == ids, "version/solution tartibi")
    ok(all(i["correctAnswer"] == key["answers"][i["id"]] for i in sol["items"]), "yechim javobi kalit bilan bir xil")
    leak = {"correctAnswer", "solution", "bookAnswer", "solutionResult", "answers", "review", "verify"}
    ok(not any(f'"{k}"' in json.dumps(ver) for k in leak), "version (public) javob maydonlarisiz")
    for q in ver["questions"]:
        ok(q["optionCount"] == len(q["options"]) == 4 and key["answers"][q["id"]] in [o["key"] for o in q["options"]], f"{q['id']}: javob variantlar ichida")
        ok(len({json.dumps(o["blocks"]) for o in q["options"]}) == 4, f"{q['id']}: variantlar takrorlanmasin")
    for o in ops:
        ok(not b1.nested(o["data"]), f"{o['path']}: ichma-ich massiv")
        ok(len(json.dumps(o["data"], ensure_ascii=False).encode()) < 900_000, f"{o['path']}: hajm (<900KB)")
    qrefs, srefs = set(), set()
    b2.walk([q["question"] for q in ver["questions"]] + [q["options"] for q in ver["questions"]], lambda d: qrefs.add(d["id"]) if d.get("t") == "figure" else None)
    b2.walk([i["solution"] for i in sol["items"]], lambda d: srefs.add(d["id"]) if d.get("t") == "figure" else None)
    ok(qrefs == {k[1] for k in figures if k[0] == "figures"} and not srefs, "rasmlar: bloklar <-> figure hujjatlari bir xil")
    for (col, fid), d in figures.items():
        ok(d["testId"] == TID and d["id"] == fid and d["mime"] == "image/webp" and 0 < d["bytes"] <= b2.MAX_FIG_BYTES, f"{col}/{fid}: hujjat")
        ok(len(base64.b64decode(d["data"])) == d["bytes"], f"{col}/{fid}: bayt soni")
    K.latex_outside_dollars([ver, sol], errs)
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--free", action="store_true", help="hamma uchun bepul (paidOnly yo‘q)")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    paid = not a.free
    test, ops, figures, used_full = build(paid)
    errs = validate(test, ops, figures, paid)
    key = ops[2]["data"]["answers"]
    print(f"{TID} · dayNumber {DAY} · 50 savol · 100 ball · {'PULLIK' if paid else 'BEPUL'} · planHash {test['planHash']}")
    print(f"  Fizika {test['physicsCount']} (2026 kuz, 1-test) · Pedagogika {test['pedagogyCount']} · rasmlar {len(figures)} · kalit harflari {dict(sorted(Counter(key.values()).items()))}")
    print(f"  pedagogika: {', '.join(i for i in test['questionIds'] if i.startswith('PED-'))}")
    if errs:
        print("XATO:\n  " + "\n  ".join(errs)); sys.exit(1)
    print("tekshiruvlar: PASS" + ("" if used_full else " (mocks-used.json siz)"))
    if a.check:
        return
    bundle = OrderedDict([("format", "oliyfizika-attestation-mock-import"), ("schemaVersion", 1), ("testId", TID), ("dayNumber", DAY),
                          ("counts", OrderedDict([("questions", TOTAL), ("physics", test["physicsCount"]), ("pedagogy", test["pedagogyCount"]),
                                                  ("maxScore", 100), ("figures", len(figures)), ("solutionFigures", 0)])),
                          ("planHash", test["planHash"]), ("ops", ops)])
    out = os.path.join(K.PRIV, f"mock-import-{NUMBER:02d}.json")
    json.dump(bundle, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    plan = OrderedDict([("testId", TID), ("dayNumber", DAY), ("planHash", test["planHash"]), ("paidOnly", paid), ("source", K.SOURCE_NOTE),
                        ("composition", test["composition"]), ("pointsPerQuestion", POINTS), ("maxScore", 100), ("questionIds", test["questionIds"]),
                        ("figures", OrderedDict([("question", len(figures)), ("solution", 0)]))])
    json.dump(plan, open(os.path.join(K.DOCS, f"mock_test_{NUMBER:02d}_plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"yozildi: {os.path.relpath(out, K.ROOT)}  +  docs/attestatsiya-fizika/mock_test_{NUMBER:02d}_plan.json")


if __name__ == "__main__":
    main()
