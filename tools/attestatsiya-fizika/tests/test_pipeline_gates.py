#!/usr/bin/env python3
"""
Attestatsiya → Fizika: pipeline gate'larining SALBIY testlari — har bir tekshiruv buzilgan ma'lumotni haqiqatan ushlaydimi.
Canonical fayllarga yozmaydi (hammasi xotirada).   python3 tools/attestatsiya-fizika/tests/test_pipeline_gates.py
"""
import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, TOOLS)
import latex_canonical as L  # noqa: E402
import answer_keys as AK  # noqa: E402
import prepare_attestation_data as PREP  # noqa: E402

ROOT = L.ROOT
PRIV = os.path.join(ROOT, "_private", "attestatsiya-fizika")
results = []


def expect(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))


chapters, sols = L.parse_chapters(), L.parse_solutions()
problems = json.load(open(L.PROBLEMS, encoding="utf-8"))

# ---------------------------------------------------------------- L. LaTeX ↔ problems.json
expect("L: joriy LaTeX ↔ problems.json — mos", not L.compare(chapters, problems))
p2 = copy.deepcopy(problems); p2[0]["tex"] += " "
expect("L: problems.json'da savol matni o'zgartirilsa — FAIL", any("tex" in e for e in L.compare(chapters, p2)))
p2 = copy.deepcopy(problems); p2[5]["answer"] = "Z"
expect("L: javob o'zgartirilsa — FAIL", any("answer" in e for e in L.compare(chapters, p2)))
p2 = copy.deepcopy(problems); p2.pop(3)
expect("L: savol yo'qolsa — FAIL", any("yo'q" in e for e in L.compare(chapters, p2)))
c2 = copy.deepcopy(chapters); sid = next(iter(c2)); c2[sid]["nopts"] = 0
expect("L: variantlar soni mos kelmasa — FAIL", any("nopts" in e for e in L.compare(c2, problems)))

# ---------------------------------------------------------------- H/I. answer key va distraktorlar
items = AK.load_decisions()
expect("H/I: joriy 62 qaror — PASS", not AK.validate_all(items, chapters, sols), f"{len(items)} qaror")
by_id = {i["id"]: i for i in items}


def broken(qid, mutate):
    it = copy.deepcopy(by_id[qid]); mutate(it)
    return AK.validate_all([it], chapters, sols)


e = broken("AF-1-005", lambda it: it["distractors"][0].update(tex=it["correct"]))
expect("I: takroriy variant — FAIL", any("takror" in x for x in e))
# qiymatlar maxfiy qarorlardan olinadi (repo'da to'g'ri javob yozilmaydi)
near = round(by_id["AF-1-005"]["value"] * 1.003, 3)
e = broken("AF-1-005", lambda it: it["distractors"][0].update(tex=rf"${near}\,\mathrm{{m}}$", value=near))
expect("I: to'g'ri javobga juda yaqin distraktor (0.3 %) — FAIL", any("yaqin" in x for x in e))
e = broken("AF-1-005", lambda it: it.update(value=330))
expect("H: to'g'ri variant yechim natijasiga mos emas — FAIL", any("mos emas" in x for x in e))
e = broken("AF-1-068", lambda it: it["distractors"][1].update(tex=r"$15\,\mathrm{N}$", value=15))
expect("H: oraliqli savolda ikkinchi to'g'ri javob — FAIL", any("oraliqqa tushadi" in x for x in e))
e = broken("AF-1-005", lambda it: it["distractors"][2].update(tex=r"$3.2\,\mathrm{km}$"))
expect("I: birliklar har xil — FAIL", any("birlik" in x for x in e))
e = broken("AF-1-005", lambda it: it["distractors"][0].update(why=""))
expect("I: distraktor sababi yo'q — FAIL", any("sababi" in x for x in e))
e = broken("AF-1-115", lambda it: it.update(assumption=None))
expect("H: medium ishonch farazsiz — FAIL", any("faraz" in x for x in e))
e = broken("AF-1-005", lambda it: it.update(confidence="low"))
expect("H: past ishonch qo'llanmaydi — FAIL", any("ishonch" in x for x in e))
# boshqa savoldan ko'chirilgan variantlar to'plami
src = next(c for c in chapters.values() if c["nopts"] == 4 and c["answer_src"] == "computed")
env = L.OPT_ENV_RE.findall(src["tex"])[-1]
import re  # noqa: E402
opts = [x.strip() for x in re.split(r"\\item\b", env)[1:]]
e = broken("AF-1-036", lambda it: (it.update(correct=opts[0], value=None, unit=None, order="fixed", pos=0),
                                   it.update(distractors=[dict(tex=o, value=None, why="x") for o in opts[1:]])))
expect("I: boshqa savoldan ko'chirilgan variantlar — FAIL", any("boshqa savolda" in x for x in e))
# eskirgan ibora qolsa
q = "AF-6-053"
sid = next(s for s, c in chapters.items() if AK.qid_of(c) == q)
s2 = copy.deepcopy(sols); s2[sid]["body"] += " (variantlar berilmagan)"
expect("H: yechimda «variantlar berilmagan» qolsa — FAIL", AK.validate_all([by_id[q]], chapters, s2))

# ---------------------------------------------------------------- E. nested arrays
expect("E: list items=[[…]] — topiladi", PREP.nested_array_paths({"q": [{"t": "list", "items": [[{"t": "p"}]]}]}))
expect("E: canonical items=[{blocks}] — toza", not PREP.nested_array_paths(PREP.fs_canonical({"q": [{"t": "list", "items": [[{"t": "p"}]]}]})))

# ---------------------------------------------------------------- J. rasm havolalari: production baseline vs yangi
base_dir = os.path.join(PRIV, "_staging", "production-baseline")


def missing_refs(bundle, figs):
    have = {tuple(o["path"].split("/")[1:4]) for o in figs["ops"]}
    miss = 0

    def walk(bs, out):
        for b in bs or []:
            if b.get("t") == "figure":
                out.append(b["id"])
            walk(b.get("blocks"), out)
            for it in b.get("items", []) if b.get("t") == "list" else []:
                walk(it["blocks"] if isinstance(it, dict) else it, out)
            for r in b.get("rows", []) if b.get("t") == "table" else []:
                for c in (r["cells"] if isinstance(r, dict) else r):
                    walk(c.get("blocks"), out)
        return out
    for o in bundle["ops"]:
        p = o["path"].split("/")
        if len(p) == 4 and p[2] == "versions":
            for qq in o["data"]["questions"]:
                for f in walk(qq["question"], []) + [x for op in qq["options"] for x in walk(op["blocks"], [])]:
                    miss += (p[1], "figures", f) not in have
        if len(p) == 4 and p[2] == "solutions":
            for it in o["data"]["items"]:
                for f in walk(it["solution"], []):
                    miss += (p[1], "solutionFigures", f) not in have
    return miss


if os.path.exists(base_dir):
    bb = json.load(open(os.path.join(base_dir, "firestore-import.json"), encoding="utf-8"))
    bf = json.load(open(os.path.join(base_dir, "firestore-figures.json"), encoding="utf-8"))
    expect("J: production baseline'da yechim rasmlari topilmaydi (eski xato aniqlanadi)", missing_refs(bb, bf) == 20, str(missing_refs(bb, bf)))
nb = json.load(open(os.path.join(PRIV, "firestore-import.json"), encoding="utf-8"))
nf = json.load(open(os.path.join(PRIV, "firestore-figures.json"), encoding="utf-8"))
expect("J: yangi bundle'da barcha rasm havolalari bor", missing_refs(nb, nf) == 0)

# ---------------------------------------------------------------- M. public/private ajratish (yangi bundle)
leak = {"correctAnswer", "solution", "bookAnswer", "solutionResult", "answers", "review", "verify", "keyStatus", "keySource", "keyValue"}


def keys(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from keys(v)
    elif isinstance(o, list):
        for v in o:
            yield from keys(v)


pubdocs = [o["data"] for o in nb["ops"] if (o["path"].startswith("attestationPhysicsQuestions/") and o["path"].count("/") == 1)
           or o["path"].endswith("/versions/v1") or (o["path"].startswith("attestationPhysicsDailyTests/") and o["path"].count("/") == 1)]
expect("M: public hujjatlarda javob/yechim/kalit maydoni yo'q", not (set(keys(pubdocs)) & leak), str(set(keys(pubdocs)) & leak))

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{len(results)} — {'PASS' if passed == len(results) else 'FAIL'}")
sys.exit(0 if passed == len(results) else 1)
