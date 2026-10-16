#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: MOCK TEST 02 (demo-test asosida) — 50 savol, 3 bo'lim, RASMLAR bilan, FAQAT PULLIK GURUH uchun.

Bo'limlar (demotest.uzedu.uz tartibida): Fizika 1–35, Kasbiy standart 36–40, Pedagogik mahorat 41–50. Har savol 2 ball -> 100 ball.
Vaqt: boshlagandan 2 soat (timeLimitSeconds = 7200). test.paidOnly = true  -> faqat admin | users/{uid}.attestationAccess == true.

Manba (gitignored, javoblar bor):  _private/attestatsiya-fizika/demo-mock-02/items.json  (+ figures/*.png)
  • bank savollari (source == "bank")  — matn, rasm, kalit va yechim mavjud bankdan (firestore-import.json / firestore-figures.json);
  • yangi savollar (source == "yangi") — items.json dan; rasmlar figures/demo_qNN.png -> WebP -> Firestore figure hujjati;
  • 50-savol — mavjud pedagogika bazasidan (attestatsiya/pedagogika-testlari/data/test10.js, FAQAT O'QILADI).
Chiqish: _private/attestatsiya-fizika/mock-import-02.json  (admin importi: test + versions + keys + solutions + figures/solutionFigures)
         docs/attestatsiya-fizika/mock_test_02_plan.json   (javobsiz reja — commit qilish xavfsiz)

Ishga tushirish (repo ildizidan):  python3 tools/attestatsiya-fizika/build_mock_test_02.py [--check]
"""
import argparse, base64, hashlib, io, json, os, re, subprocess, sys
from collections import Counter, OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mock_test as b1                      # load_bundle, nested, has_figure, PED_NODE ... (o'zgarmaydi)

ROOT = b1.ROOT
PRIV = b1.PRIV
DEMO = os.path.join(PRIV, "demo-mock-02")
FIG_JSON = os.path.join(PRIV, "firestore-figures.json")
NUMBER = 2
TID = f"att-fizika-mock-{NUMBER:02d}"
DAY = b1.FIRST_MOCK_DAY + NUMBER - 1
POINTS, TIME_LIMIT = 2, 7200
SECTIONS = [("fizika", "Fizika", 35), ("kasbiy-standart", "Kasbiy standart", 5), ("pedagogik-mahorat", "Pedagogik mahorat", 10)]
LETTERS = "ABCD"
PED_Q = ("PED-10-12", 10, 12)                     # 50-savol: mavjud pedagogika bazasidan (test10.js, 12-savol)
MAX_FIG_BYTES = 700 * 1024
PED50_SOL = ("Topshiriq murakkabligi o‘quvchilarning bilim darajasiga mos bo‘lishi kerak. Turli darajadagi ikki o‘quvchiga "
             "bir xil murakkablikdagi topshiriq berish — ularning individual imkoniyatlari hisobga olinmaganini bildiradi, "
             "ya’ni differensial yondashuv tamoyiliga amal qilinmagan.")


def sha(*p):
    return hashlib.sha256("|".join(map(str, p)).encode()).hexdigest()


def fix_tex(s):
    return s.replace("\\mathrm{\\AA}", "\\text{\\AA}").replace("\\mathrm{\\\\AA}", "\\text{\\AA}")


MARK = re.compile(r"(?:(?<=\s)|^)([1-5]\.|[1-5]\)|[a-d]\))\s")


def text_blocks(text):
    """Matnni bloklarga: har bir qator — paragraf; qator ichidagi 1./1)/a) bandlar — ro'yxat (bank formatiga o'xshash)."""
    out = []
    for line in [l.strip() for l in fix_tex(text).split("\n") if l.strip()]:
        ms = list(MARK.finditer(line))
        ok = len(ms) >= 2 and len({m.group(1)[-1] for m in ms}) == 1
        if not ok:
            out.append({"t": "p", "text": " ".join(line.split())}); continue
        if line[:ms[0].start()].strip():
            out.append({"t": "p", "text": " ".join(line[:ms[0].start()].split())})
        items = []
        for i, m in enumerate(ms):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(line)
            items.append({"blocks": [{"t": "p", "text": " ".join(line[m.end():end].split())}]})
        label = ms[0].group(1)
        out.append({"t": "list", "ordered": True, "label": label, "items": items})
    return out


def webp(png_path):
    from PIL import Image
    im = Image.open(png_path).convert("RGB")
    if im.width > 1100:
        im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    for q in (88, 80, 70, 60):
        buf = io.BytesIO(); im.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= MAX_FIG_BYTES:
            return buf.getvalue(), im.width, im.height
    sys.exit(f"{png_path}: rasm juda katta")


def walk(x, f):
    if isinstance(x, list):
        for i in x: walk(i, f)
    elif isinstance(x, dict):
        f(x)
        for v in x.values(): walk(v, f)


def load_fig_index():
    idx = {}
    for o in json.load(open(FIG_JSON, encoding="utf-8"))["ops"]:
        p = o["path"].split("/")
        idx[(p[1], p[2], p[3])] = o["data"]
    return idx


def ped50():
    r = subprocess.run(["node", "-e", b1.PED_NODE, b1.PED_DIR], capture_output=True, text=True, check=True)
    q = next(x for x in json.loads(r.stdout) if x["file"] == PED_Q[1] and x["n"] == PED_Q[2])
    assert len(q["answers"]) == 4 and 0 <= q["correct"] < 4
    return q


def build():
    items = json.load(open(os.path.join(DEMO, "items.json"), encoding="utf-8"))
    by_n = {i["n"]: i for i in items}
    _b, pub, priv, vq, sol = b1.load_bundle()
    figidx = load_fig_index()
    ids, questions, answers, solutions = [], [], OrderedDict(), []
    figures = OrderedDict()                       # (collection, id) -> doc data
    topic_idx = []
    for n in range(1, 51):
        si = 0 if n <= 35 else 1 if n <= 40 else 2
        key, title, _c = SECTIONS[si]
        it = by_n.get(n)
        if n == 50:
            p = ped50()
            qid, letter = PED_Q[0], LETTERS[p["correct"]]
            e = OrderedDict([("id", qid), ("section", key), ("sectionTitle", title), ("topic", "Didaktika"), ("type", "mcq"),
                             ("evaluationType", "auto"), ("difficulty", "medium"), ("difficultyLevel", 2),
                             ("question", text_blocks(p["question"])),
                             ("options", [OrderedDict([("key", LETTERS[i]), ("blocks", text_blocks(a))]) for i, a in enumerate(p["answers"])]),
                             ("optionCount", 4), ("position", n), ("bookNumber", f"P{PED_Q[1]}.{PED_Q[2]}"), ("contentVersion", 1)])
            s = OrderedDict([("id", qid), ("evaluationType", "auto"), ("correctAnswer", letter), ("solutionResult", letter), ("solutionStatus", "full"),
                             ("solution", [{"t": "heading", "text": "Yechim"}, {"t": "p", "text": PED50_SOL},
                                           {"t": "answer", "blocks": [{"t": "p", "text": f"{letter}) {p['answers'][p['correct']]}"}]}])])
        elif it["source"] == "bank":
            qid = it["bankId"]
            e = OrderedDict(vq[qid]); e["position"] = n; e["sectionTitle"] = title
            letter = priv[qid]["correctAnswer"]; s = sol[qid]
            def need(scope, node):
                def f(d):
                    if d.get("t") == "figure":
                        d_ = figidx[(it["bankTest"], scope, d["id"])]
                        figures[(scope, d["id"])] = {**d_, "testId": TID}
                walk(node, f)
            need("figures", [e["question"], e["options"]])
        else:
            qid = f"DM2-{n:02d}"
            letter = LETTERS[it["ans"]]
            qb = text_blocks(it["q"])
            if it.get("fig"):
                raw, w, h = webp(os.path.join(DEMO, "figures", it["fig"]))
                fid = sha("fig", TID, it["fig"], hashlib.sha256(raw).hexdigest())[:16] + ".webp"
                figures[("figures", fid)] = OrderedDict([("testId", TID), ("id", fid), ("mime", "image/webp"), ("bytes", len(raw)),
                                                         ("data", base64.b64encode(raw).decode())])
                qb.insert(1, {"t": "figure", "fig": it["fig"].replace(".png", ""), "id": fid, "w": w, "h": h})   # savol matnidan keyin, ro'yxat/variantlardan oldin
            e = OrderedDict([("id", qid), ("section", key), ("sectionTitle", title), ("topic", it["topic"]), ("type", "mcq"),
                             ("evaluationType", "auto"), ("difficulty", "medium"), ("difficultyLevel", 2), ("question", qb),
                             ("options", [OrderedDict([("key", LETTERS[i]), ("blocks", text_blocks(o))]) for i, o in enumerate(it["opts"])]),
                             ("optionCount", 4), ("position", n), ("bookNumber", f"D{n}"), ("contentVersion", 1)])
            s = OrderedDict([("id", qid), ("evaluationType", "auto"), ("correctAnswer", letter), ("solutionResult", letter), ("solutionStatus", "full"),
                             ("solution", [{"t": "heading", "text": "Yechim"}, {"t": "p", "text": fix_tex(it["sol"])},
                                           {"t": "answer", "blocks": [{"t": "p", "text": f"{letter}) {fix_tex(it['opts'][it['ans']])}"}]}])])
        # bank savolining yechim rasmlari (bo'lsa)
        if n != 50 and it["source"] == "bank":
            def f2(d):
                if d.get("t") == "figure":
                    figures[("solutionFigures", d["id"])] = {**figidx[(it["bankTest"], "solutionFigures", d["id"])], "testId": TID}
            walk(s["solution"], f2)
        ids.append(qid); questions.append(e); answers[qid] = letter; solutions.append(s); topic_idx.append(si)
    qfig_ids = {k[1] for k in figures if k[0] == "figures"}
    plan_hash = hashlib.sha256(json.dumps([ids, list(answers.values())], ensure_ascii=False).encode()).hexdigest()[:16]
    diff = Counter(q.get("difficultyLevel", 2) for q in questions)
    comp = OrderedDict([("fizika", 35), ("kasbiyStandart", 5), ("pedagogikMahorat", 10)])
    topics = [t for _k, t, _c in SECTIONS]
    test = OrderedDict([
        ("id", TID), ("course", "fizika"), ("kind", "mock"), ("schemaVersion", 1), ("dayNumber", DAY), ("mockNumber", NUMBER),
        ("section", "mock"), ("sectionTitle", "Mock test 2"), ("topics", topics), ("topicParts", []), ("questionIds", ids), ("questionCount", 50),
        ("questionTopicIdx", topic_idx), ("questionEval", ["a"] * 50), ("scorableCount", 50), ("openCount", 0), ("unreliableCount", 0),
        ("difficulty", OrderedDict((str(i), diff.get(i, 0)) for i in (1, 2, 3, 4))), ("bookRange", ""), ("pointsPerQuestion", POINTS),
        ("maxScore", 100), ("physicsCount", 35), ("pedagogyCount", 10), ("composition", comp), ("paidOnly", True),
        ("status", "draft"), ("published", False), ("publishAt", None), ("publishedAt", None), ("publishedBy", None),
        ("solutionAvailableAt", None), ("archivedAt", None), ("timeLimitSeconds", TIME_LIMIT), ("currentVersion", 1), ("planHash", plan_hash),
        ("notification", OrderedDict([("title", "Mock test 2 tayyor!"), ("body", "50 savol · 35 fizika + 5 kasbiy standart + 10 pedagogik mahorat · 100 ball"),
                                      ("href", f"attestatsiya/fizika-test.html?day={DAY}")])),
        ("figureCount", len(qfig_ids)),
    ])
    base = f"attestationPhysicsDailyTests/{TID}"
    ops = [OrderedDict([("op", "set"), ("path", base), ("data", test)]),
           OrderedDict([("op", "create"), ("path", f"{base}/versions/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("dayNumber", DAY), ("questionIds", ids), ("questions", questions)]))]),
           OrderedDict([("op", "create"), ("path", f"{base}/keys/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("questionIds", ids), ("answers", answers), ("scorableCount", 50)]))]),
           OrderedDict([("op", "create"), ("path", f"{base}/solutions/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("questionIds", ids), ("items", solutions)]))])]
    for (col, fid), d in sorted(figures.items()):
        ops.append(OrderedDict([("op", "create"), ("path", f"{base}/{col}/{fid}"), ("data", OrderedDict([(k, d[k]) for k in ("testId", "id", "mime", "bytes", "data")]))]))
    return test, ops, figures, questions, solutions, by_n


def validate(test, ops, figures, questions, solutions):
    errs = []
    ok = lambda c, m: None if c else errs.append(m)
    ids = test["questionIds"]; key = ops[2]["data"]; ver = ops[1]["data"]; sol = ops[3]["data"]
    ok(len(ids) == 50 == len(set(ids)), "50 ta noyob savol")
    ok(test["maxScore"] == 100 and test["timeLimitSeconds"] == 7200 and test["paidOnly"] is True, "100 ball / 2 soat / paidOnly")
    ok(Counter(test["questionTopicIdx"]) == Counter({0: 35, 1: 5, 2: 10}), "35 + 5 + 10")
    ok(list(key["answers"]) == ids and key["scorableCount"] == 50, "kalit tartibi")
    ok([q["id"] for q in ver["questions"]] == ids and [i["id"] for i in sol["items"]] == ids, "version/solution tartibi")
    ok(all(i["correctAnswer"] == key["answers"][i["id"]] for i in sol["items"]), "yechim javobi kalit bilan bir xil")
    leak = {"correctAnswer", "solution", "bookAnswer", "solutionResult", "answers", "review", "verify"}
    ok(not any(f'"{k}"' in json.dumps(ver) for k in leak), "version (public) javob maydonlarisiz")
    for q in ver["questions"]:
        ok(q["optionCount"] == len(q["options"]) == 4 and key["answers"][q["id"]] in [o["key"] for o in q["options"]], f"{q['id']}: javob variantlar ichida")
    for o in ops:
        ok(not b1.nested(o["data"]), f"{o['path']}: ichma-ich massiv")
        ok(len(json.dumps(o["data"], ensure_ascii=False).encode()) < 900_000, f"{o['path']}: hajm (<900KB)")
    qrefs, srefs = set(), set()
    walk([q["question"] for q in ver["questions"]] + [q["options"] for q in ver["questions"]], lambda d: qrefs.add(d["id"]) if d.get("t") == "figure" else None)
    walk([i["solution"] for i in sol["items"]], lambda d: srefs.add(d["id"]) if d.get("t") == "figure" else None)
    ok(qrefs == {k[1] for k in figures if k[0] == "figures"}, "savol rasmlari: bloklar <-> figure hujjatlari bir xil")
    ok(srefs == {k[1] for k in figures if k[0] == "solutionFigures"}, "yechim rasmlari: bloklar <-> figure hujjatlari bir xil")
    for (col, fid), d in figures.items():
        ok(d["testId"] == TID and d["id"] == fid and d["mime"] in ("image/webp", "image/png", "image/svg+xml") and 0 < d["bytes"] <= MAX_FIG_BYTES, f"{col}/{fid}: hujjat")
        ok(len(base64.b64decode(d["data"])) == d["bytes"], f"{col}/{fid}: bayt soni")
    return errs


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); a = ap.parse_args()
    test, ops, figures, questions, solutions, by_n = build()
    errs = validate(test, ops, figures, questions, solutions)
    key = ops[2]["data"]["answers"]
    nq = sum(1 for k in figures if k[0] == "figures"); ns = len(figures) - nq
    print(f"{TID} · dayNumber {DAY} · 50 savol · 100 ball · paidOnly · planHash {test['planHash']}")
    print(f"  Fizika 35 · Kasbiy standart 5 · Pedagogik mahorat 10 · rasmlar: savol {nq}, yechim {ns} · kalit harflari {dict(sorted(Counter(key.values()).items()))}")
    if errs:
        print("XATO:\n  " + "\n  ".join(errs)); sys.exit(1)
    print("tekshiruvlar: PASS")
    if a.check:
        return
    bundle = OrderedDict([("format", "oliyfizika-attestation-mock-import"), ("schemaVersion", 1), ("testId", TID), ("dayNumber", DAY),
                          ("counts", OrderedDict([("questions", 50), ("physics", 35), ("kasbiyStandart", 5), ("pedagogikMahorat", 10), ("maxScore", 100),
                                                  ("figures", nq), ("solutionFigures", ns)])), ("planHash", test["planHash"]), ("ops", ops)])
    out = os.path.join(PRIV, f"mock-import-{NUMBER:02d}.json")
    json.dump(bundle, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    plan = OrderedDict([("testId", TID), ("dayNumber", DAY), ("planHash", test["planHash"]), ("paidOnly", True), ("composition", test["composition"]),
                        ("pointsPerQuestion", POINTS), ("maxScore", 100), ("questionIds", test["questionIds"]),
                        ("figures", OrderedDict([("question", nq), ("solution", ns)]))])
    os.makedirs(b1.DOCS, exist_ok=True)
    json.dump(plan, open(os.path.join(b1.DOCS, f"mock_test_{NUMBER:02d}_plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"yozildi: {os.path.relpath(out, ROOT)}  +  docs/attestatsiya-fizika/mock_test_{NUMBER:02d}_plan.json")


if __name__ == "__main__":
    main()
