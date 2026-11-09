#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: PULLIK MOCK TESTLAR 09 va 10 — «Attestatsiya 2026 (bahor)» 3- va 4-testlari asosida.

  --test 3  ->  att-fizika-mock-09 (dayNumber 109)      --test 4  ->  att-fizika-mock-10 (dayNumber 110)

Tarkib: 50 savol = 35 fizika (testning 35 masalasi, manbadagi tartibda) + 15 pedagogika; har savol 2 ball -> 100 ball.
Mexanizm mock-03…08 bilan bir xil: istalgan vaqtda 1 marta, boshlagandan 2 soat (timeLimitSeconds = 7200),
kalit va yechimlar o'z urinishi yakunlangach. paidOnly: true -> faqat attestationAccess bor foydalanuvchilar (va admin).

Manba (gitignored, javoblar bor):
  _private/attestatsiya-fizika/bahor-2026-testN/items.json   (items.py dan; savol, variant, javob, yechim)
  _private/attestatsiya-fizika/bahor-2026-testN/figures/qNN.png
  _private/attestatsiya-fizika/mocks-used.json   (ixtiyoriy: mavjud mocklardagi savollar [{id, text}])
Pedagogika: attestatsiya/pedagogika-testlari/data/test*.js (FAQAT O'QILADI), mock-generator.js qoidalari bilan;
        docs/attestatsiya-fizika/mock_test_*_plan.json dagi (01, 02, 08, 09 …) pedagogika savollari qayta olinmaydi.
        mock-03…07 admin generatorida yaratilgan — ular bilan ustma-ustlikni admin import sahifasi ogohlantiradi.
Chiqish: _private/attestatsiya-fizika/mock-import-NN.json  (admin «Mock test importi» formati)
         docs/attestatsiya-fizika/mock_test_NN_plan.json    (javobsiz reja — commit qilish xavfsiz)

Ishga tushirish (repo ildizidan, avval 3, keyin 4):
  python3 tools/attestatsiya-fizika/build_mock_test_bahor.py --test 3 [--check]
  python3 tools/attestatsiya-fizika/build_mock_test_bahor.py --test 4 [--check]
"""
import argparse, base64, glob, hashlib, json, os, re, subprocess, sys
from collections import Counter, OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mock_test as b1                      # PED_NODE, PED_DIR, nested, FIRST_MOCK_DAY (o'zgarmaydi)
import build_mock_test_02 as b2                   # text_blocks, webp, walk, sha (o'zgarmaydi)

ROOT, PRIV = b1.ROOT, b1.PRIV
USED = os.path.join(PRIV, "mocks-used.json")
BAHOR = {3: 9, 4: 10}                              # manba testi -> mock raqami
_ap = argparse.ArgumentParser()
_ap.add_argument("--test", type=int, choices=sorted(BAHOR), required=True)
_ap.add_argument("--check", action="store_true")
ARGS = _ap.parse_args()
TEST = ARGS.test
SRC = os.path.join(PRIV, f"bahor-2026-test{TEST}")
NUMBER = BAHOR[TEST]
TID = f"att-fizika-mock-{NUMBER:02d}"
DAY = b1.FIRST_MOCK_DAY + NUMBER - 1
POINTS, TIME_LIMIT, N_PED = 2, 7200, 15
LETTERS = "ABCD"
SECTIONS = [("mexanika", "Mexanika"), ("molekulyar", "Molekulyar fizika va termodinamika"), ("elektromagnetizm", "Elektr va magnetizm"),
            ("optika", "Optika"), ("atom-yadro", "Atom va yadro fizikasi")]
PED_TITLE = "Pedagogika"
TOPICS = [t for _k, t in SECTIONS] + [PED_TITLE]
SEC_IDX = {k: i for i, (k, _t) in enumerate(SECTIONS)}
SOURCE_NOTE = f"Attestatsiya 2026 (bahor), {TEST}-test"

# Pedagogika tanlovi — mock-generator.js funksiyalari bilan (pedagogyPool, tokens, similarity, hash): admin generatori bilan bir xil mezon.
PED_PICK_NODE = r"""
const [genPath, pedJson, usedJson, physJson, n, seed] = process.argv.slice(1);
const g = await import(genPath);
const ped = g.pedagogyPool(JSON.parse(pedJson));
const used = JSON.parse(usedJson).map((u) => g.tokens(u.text));
const usedIds = new Set(JSON.parse(usedJson).map((u) => u.id));
const phys = JSON.parse(physJson).map((t) => g.tokens(t));
const toks = [...used, ...phys];
const free = (p) => !usedIds.has(p.id) && !toks.some((t) => g.similarity(t, p.tok) >= g.SIMILAR);
const letters = {};
for (const l of JSON.parse(process.argv[7])) letters[l] = (letters[l] || 0) + 1;
const files = [...new Set(ped.map((p) => p.file))].sort((a, b) => g.hash(seed, "pf", a) - g.hash(seed, "pf", b));
const out = [];
let progress = true;
while (out.length < +n && progress) {
  progress = false;
  for (const f of files) {
    if (out.length >= +n) break;
    const c = ped.filter((p) => p.file === f && free(p))
      .sort((a, b) => (letters[a.letter] || 0) - (letters[b.letter] || 0) || g.hash(seed, "pq", a.id) - g.hash(seed, "pq", b.id))[0];
    if (!c) continue;
    out.push(c); toks.push(c.tok); letters[c.letter] = (letters[c.letter] || 0) + 1; progress = true;
  }
}
out.sort((a, b) => a.file - b.file || a.n - b.n);
console.log(JSON.stringify({ total: ped.length, picked: out.map(({ tok, ...r }) => r) }));
"""


def sol_blocks(lines):
    """Yechim qatorlari -> bloklar: "$$...$$" alohida formula; qator ichidagi $$...$$ ham ajratiladi."""
    out = [{"t": "heading", "text": "Yechim"}]
    for line in lines:
        for i, part in enumerate(re.split(r"\$\$(.+?)\$\$", line)):
            part = part.strip()
            if not part:
                continue
            out.append({"t": "math", "tex": part} if i % 2 else {"t": "p", "text": " ".join(part.split())})
    return out


def figure_doc(name):
    raw, w, h = b2.webp(os.path.join(SRC, "figures", name))
    fid = b2.sha("fig", TID, name, hashlib.sha256(raw).hexdigest())[:16] + ".webp"
    doc = OrderedDict([("testId", TID), ("id", fid), ("mime", "image/webp"), ("bytes", len(raw)), ("data", base64.b64encode(raw).decode())])
    return fid, w, h, doc


def plain(s):
    return re.sub(r"\s+", " ", s)


def load_used():
    used = []
    for p in sorted(glob.glob(os.path.join(b1.DOCS, "mock_test_*_plan.json"))):
        if os.path.basename(p) != f"mock_test_{NUMBER:02d}_plan.json":
            used += [{"id": i, "text": ""} for i in json.load(open(p, encoding="utf-8"))["questionIds"]]
    if not os.path.exists(USED):
        print(f"OGOHLANTIRISH: {os.path.relpath(USED, ROOT)} yo'q — pedagogika faqat repo rejalaridagi mocklar bilan solishtirildi.")
        return used, False
    extra = json.load(open(USED, encoding="utf-8"))
    assert isinstance(extra, list) and all("id" in u and "text" in u for u in extra), "mocks-used.json: [{id, text}]"
    return used + extra, True


def pick_pedagogy(phys_texts, phys_letters, used):
    r = subprocess.run(["node", "-e", b1.PED_NODE, b1.PED_DIR], capture_output=True, text=True, check=True)
    gen = "file://" + os.path.join(ROOT, "assets", "js", "attestatsiya-fizika", "mock-generator.js")
    r2 = subprocess.run(["node", "--input-type=module", "-e", PED_PICK_NODE, gen, r.stdout, json.dumps(used, ensure_ascii=False),
                         json.dumps(phys_texts, ensure_ascii=False), str(N_PED), f"mock-{NUMBER}", json.dumps(phys_letters)],
                        capture_output=True, text=True)
    if r2.returncode:
        sys.exit(r2.stderr)
    res = json.loads(r2.stdout)
    if len(res["picked"]) < N_PED:
        sys.exit(f"takrorlanmaydigan pedagogika savoli yetmadi ({len(res['picked'])}/{N_PED})")
    return res["picked"]


def build():
    items = json.load(open(os.path.join(SRC, "items.json"), encoding="utf-8"))
    assert [i["n"] for i in items] == list(range(1, 36)), "items.json: 1..35"
    used, used_full = load_used()
    ids, questions, answers, solutions, topic_idx = [], [], OrderedDict(), [], []
    figures = OrderedDict()
    phys_texts = []
    for it in items:
        n = it["n"]
        qid = f"BH26-{TEST}-{n:02d}"
        letter = LETTERS[it["ans"]]
        qb = b2.text_blocks(it["q"])
        if it.get("fig"):
            fid, w, h, doc = figure_doc(it["fig"])
            figures[("figures", fid)] = doc
            qb.insert(1, {"t": "figure", "fig": it["fig"].rsplit(".", 1)[0], "id": fid, "w": w, "h": h})
        e = OrderedDict([("id", qid), ("section", it["sec"]), ("sectionTitle", TOPICS[SEC_IDX[it["sec"]]]), ("topic", it["topic"]), ("type", "mcq"),
                         ("evaluationType", "auto"), ("difficulty", "medium"), ("difficultyLevel", 2), ("question", qb),
                         ("options", [OrderedDict([("key", LETTERS[i]), ("blocks", b2.text_blocks(o))]) for i, o in enumerate(it["opts"])]),
                         ("optionCount", 4), ("position", n), ("bookNumber", f"BH26-{TEST}.{n}"), ("contentVersion", 1)])
        sb = sol_blocks(it["sol"])
        if it.get("note"):
            sb.append({"t": "status", "kind": "source_error", "blocks": [{"t": "p", "text": it["note"]}]})   # «Manba xatosi» qutisi
        sb.append({"t": "answer", "blocks": [{"t": "p", "text": f"{letter}) {it['opts'][it['ans']]}"}]})
        s = OrderedDict([("id", qid), ("evaluationType", "auto"), ("correctAnswer", letter), ("solutionResult", letter),
                         ("solutionStatus", "full"), ("solution", sb)])
        ids.append(qid); questions.append(e); answers[qid] = letter; solutions.append(s); topic_idx.append(SEC_IDX[it["sec"]])
        phys_texts.append(plain(it["q"] + " " + " ".join(it["opts"])))
    peds = pick_pedagogy(phys_texts, list(answers.values()), used)
    for p in peds:
        pid = p["id"]
        para = lambda t: [{"t": "p", "text": " ".join(str(t).split())}]
        questions.append(OrderedDict([("id", pid), ("section", "pedagogika"), ("sectionTitle", PED_TITLE), ("topic", PED_TITLE), ("type", "mcq"),
                                      ("evaluationType", "auto"), ("difficulty", "medium"), ("difficultyLevel", 2), ("question", para(p["question"])),
                                      ("options", [OrderedDict([("key", LETTERS[i]), ("blocks", para(a))]) for i, a in enumerate(p["answers"])]),
                                      ("optionCount", 4), ("position", len(ids) + 1), ("bookNumber", f"P{p['file']}.{p['n']}"), ("contentVersion", 1)]))
        solutions.append(OrderedDict([("id", pid), ("evaluationType", "auto"), ("correctAnswer", p["letter"]), ("solutionResult", p["letter"]),
                                      ("solutionStatus", "theory"),
                                      ("solution", [{"t": "answer", "blocks": para(f"{p['letter']}) {p['answers'][p['correct']]}")}])]))
        ids.append(pid); answers[pid] = p["letter"]; topic_idx.append(len(TOPICS) - 1)
    plan_hash = hashlib.sha256(json.dumps([ids, list(answers.values())], ensure_ascii=False).encode()).hexdigest()[:16]
    comp = OrderedDict([("fizika", 35), ("pedagogika", N_PED)])
    test = OrderedDict([
        ("id", TID), ("course", "fizika"), ("kind", "mock"), ("schemaVersion", 1), ("dayNumber", DAY), ("mockNumber", NUMBER),
        ("section", "mock"), ("sectionTitle", f"Mock test {NUMBER}"), ("topics", TOPICS), ("topicParts", []), ("questionIds", ids), ("questionCount", 50),
        ("questionTopicIdx", topic_idx), ("questionEval", ["a"] * 50), ("scorableCount", 50), ("openCount", 0), ("unreliableCount", 0),
        ("difficulty", OrderedDict([("1", 0), ("2", 50), ("3", 0), ("4", 0)])), ("bookRange", ""), ("pointsPerQuestion", POINTS),
        ("maxScore", 100), ("physicsCount", 35), ("pedagogyCount", N_PED), ("composition", comp), ("source", SOURCE_NOTE), ("paidOnly", True),
        ("status", "draft"), ("published", False), ("publishAt", None), ("publishedAt", None), ("publishedBy", None),
        ("solutionAvailableAt", None), ("archivedAt", None), ("timeLimitSeconds", TIME_LIMIT), ("currentVersion", 1), ("planHash", plan_hash),
        ("notification", OrderedDict([("title", f"Mock test {NUMBER} tayyor"),
                                      ("body", f"Attestatsiya 2026 (bahor) {TEST}-test asosida · 35 fizika + 15 pedagogika · 100 ball"),
                                      ("href", f"attestatsiya/fizika-test.html?day={DAY}")])),
        ("figureCount", len(figures)),
    ])
    base = f"attestationPhysicsDailyTests/{TID}"
    ops = [OrderedDict([("op", "set"), ("path", base), ("data", test)]),
           OrderedDict([("op", "create"), ("path", f"{base}/versions/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("dayNumber", DAY), ("questionIds", ids), ("questions", questions)]))]),
           OrderedDict([("op", "create"), ("path", f"{base}/keys/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("questionIds", ids), ("answers", answers), ("scorableCount", 50)]))]),
           OrderedDict([("op", "create"), ("path", f"{base}/solutions/v1"), ("data", OrderedDict([("testId", TID), ("version", 1), ("questionIds", ids), ("items", solutions)]))])]
    for (col, fid), d in sorted(figures.items()):
        ops.append(OrderedDict([("op", "create"), ("path", f"{base}/{col}/{fid}"), ("data", d)]))
    return test, ops, figures, used_full


def validate(test, ops, figures):
    errs = []
    ok = lambda c, m: None if c else errs.append(m)
    ids = test["questionIds"]; ver, key, sol = ops[1]["data"], ops[2]["data"], ops[3]["data"]
    ok(len(ids) == 50 == len(set(ids)), "50 ta noyob savol")
    ok(test["maxScore"] == 100 and test["timeLimitSeconds"] == 7200 and test.get("paidOnly") is True, "100 ball / 2 soat / pullik (paidOnly: true)")
    ok(test["kind"] == "mock" and test["dayNumber"] == 101 + NUMBER - 1 and test["status"] == "draft" and test["published"] is False, "mock / draft")
    ok(Counter(test["questionTopicIdx"])[len(TOPICS) - 1] == N_PED and len(test["questionTopicIdx"]) == 50, "35 fizika + 15 pedagogika")
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
    b2.walk([q["question"] for q in ver["questions"]] + [q["options"] for q in ver["questions"]], lambda d: qrefs.add(d["id"]) if d.get("t") == "figure" else None)
    b2.walk([i["solution"] for i in sol["items"]], lambda d: srefs.add(d["id"]) if d.get("t") == "figure" else None)
    ok(qrefs == {k[1] for k in figures if k[0] == "figures"} and not srefs, "rasmlar: bloklar <-> figure hujjatlari bir xil")
    for (col, fid), d in figures.items():
        ok(d["testId"] == TID and d["id"] == fid and d["mime"] == "image/webp" and 0 < d["bytes"] <= b2.MAX_FIG_BYTES, f"{col}/{fid}: hujjat")
        ok(len(base64.b64decode(d["data"])) == d["bytes"], f"{col}/{fid}: bayt soni")
    # matnda LaTeX buyrug'i $...$ dan tashqarida qolmasin (KaTeX faqat $ ichini chizadi)
    def f(d):
        for k in ("text",):
            if isinstance(d.get(k), str):
                outside = re.sub(r"\$[^$]*\$", "", d[k])
                ok(not re.search(r"\\[a-zA-Z]", outside) and d[k].count("$") % 2 == 0, f"$ tashqarisida LaTeX yoki juft bo'lmagan $: {d[k][:60]}")
    b2.walk([ver, sol], f)
    return errs


def main():
    a = ARGS
    test, ops, figures, used_full = build()
    errs = validate(test, ops, figures)
    key = ops[2]["data"]["answers"]
    print(f"{TID} · dayNumber {DAY} · 50 savol · 100 ball · PULLIK · planHash {test['planHash']}")
    print(f"  Fizika 35 (2026 bahor, {TEST}-test) · Pedagogika {N_PED} · rasmlar {len(figures)} · kalit harflari {dict(sorted(Counter(key.values()).items()))}")
    print(f"  pedagogika: {', '.join(i for i in test['questionIds'] if i.startswith('PED-'))}")
    if errs:
        print("XATO:\n  " + "\n  ".join(errs)); sys.exit(1)
    print("tekshiruvlar: PASS" + ("" if used_full else " (mocks-used.json siz)"))
    if a.check:
        return
    bundle = OrderedDict([("format", "oliyfizika-attestation-mock-import"), ("schemaVersion", 1), ("testId", TID), ("dayNumber", DAY),
                          ("counts", OrderedDict([("questions", 50), ("physics", 35), ("pedagogy", N_PED), ("maxScore", 100),
                                                  ("figures", len(figures)), ("solutionFigures", 0)])), ("planHash", test["planHash"]), ("ops", ops)])
    out = os.path.join(PRIV, f"mock-import-{NUMBER:02d}.json")
    json.dump(bundle, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    plan = OrderedDict([("testId", TID), ("dayNumber", DAY), ("planHash", test["planHash"]), ("paidOnly", True), ("source", SOURCE_NOTE),
                        ("composition", test["composition"]), ("pointsPerQuestion", POINTS), ("maxScore", 100), ("questionIds", test["questionIds"]),
                        ("figures", OrderedDict([("question", len(figures)), ("solution", 0)]))])
    json.dump(plan, open(os.path.join(b1.DOCS, f"mock_test_{NUMBER:02d}_plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"yozildi: {os.path.relpath(out, ROOT)}  +  docs/attestatsiya-fizika/mock_test_{NUMBER:02d}_plan.json")


if __name__ == "__main__":
    main()
