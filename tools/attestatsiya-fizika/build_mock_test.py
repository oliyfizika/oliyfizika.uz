#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: 50 talik MOCK TEST (40 fizika + 10 pedagogika) import to'plamini tayyorlaydi.

Qoidalar (foydalanuvchi talabi):
  • 40 fizika savoli — mavjud savollar bankidan; 5 bob bo'yicha TENG: Mexanika, Molekulyar fizika,
    Elektr va magnetizm, Optika, Atom va yadro fizikasi — har biridan 8 tadan; "Maxsus mavzular" kirmaydi.
  • 10 pedagogika savoli — attestatsiya/pedagogika-testlari/data/test*.js dan (FAQAT O'QILADI, fayllar o'zgarmaydi).
  • Har bir savol 2 ball -> jami 100 ball (scorePercent == ball, chunki 50 savol).
  • Vaqt: boshlangandan 2 soat (timeLimitSeconds = 7200); tugagach javoblar avtomatik topshiriladi.
  • Yechim/natija/kalit — kunlik testlar bilan bir xil hujjat shakli (versions / keys / solutions) va
    bir xil Rules (e'lon qilish -> ertasi kuni 00:00 Toshkent vaqtida yechim va natija).

Tanlash mezoni (deterministik, tasodifiy emas — bir xil kirish -> bir xil mock):
  fizika: evaluationType=auto, keyStatus=valid, solutionStatus in (full, theory), review.check yo'q, type=mcq,
          savol/variant/yechimda RASM yo'q (rasm fayllari kunlik testga bog'langan, mockka ko'chirilmaydi),
          bob ichida mavzular bo'yicha navbatma-navbat (turli mavzular), qiyinlik ~3 oson / 3 o'rta / 2 murakkab.
  pedagogika: 4 variantli, takrorlanmagan matn, 10 ta turli faylga bo'lib, to'g'ri javob harflari muvozanatli.

Kirish : _private/attestatsiya-fizika/firestore-import.json  (gitignored)
Chiqish: _private/attestatsiya-fizika/mock-import-NN.json      (gitignored — javob kalitini o'z ichiga oladi)
         docs/attestatsiya-fizika/mock_test_NN_plan.json       (faqat ID'lar va hisoblar — javobsiz, commit qilinadi)

Ishga tushirish (repo ildizidan):
  python3 tools/attestatsiya-fizika/build_mock_test.py [--number 1] [--seed mock-1] [--check]
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from collections import Counter, OrderedDict, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PRIV = os.path.join(ROOT, "_private", "attestatsiya-fizika")
BUNDLE = os.path.join(PRIV, "firestore-import.json")
PED_DIR = os.path.join(ROOT, "attestatsiya", "pedagogika-testlari", "data")
DOCS = os.path.join(ROOT, "docs", "attestatsiya-fizika")

PER_SECTION = 8
PED_COUNT = 10
POINTS = 2
TIME_LIMIT = 7200                      # 2 soat — testni BOSHLAGANDAN (startedAt, server vaqti) hisoblanadi; kunlik testlarda null
SECTIONS = [  # (bob kaliti, sarlavha) — foydalanuvchi ko'rsatgan 5 bob
    ("mexanika", "Mexanika"),
    ("molekulyar", "Molekulyar fizika va termodinamika"),
    ("elektromagnetizm", "Elektr va magnetizm"),
    ("optika", "Optika"),
    ("atom-yadro", "Atom va yadro fizikasi"),
]
DIFF_TARGET = {1: 3, 2: 3, 3: 2}      # bob ichida (8 ta): oson 3, o'rta 3, murakkab 2
DIFF_NAME = {1: "easy", 2: "medium", 3: "hard", 4: "expert"}
FIRST_MOCK_DAY = 101                   # kurs kunlari 1..100; mock testlar 101+ (kunlik statistika va kalendardan ajratilgan)
LETTERS = "ABCDE"

PED_NODE = r"""
const vm=require("vm"),fs=require("fs"),path=require("path");
const dir=process.argv[1],out=[];
for(let i=1;i<=13;i++){
  let s=fs.readFileSync(path.join(dir,`test${i}.js`),"utf8");
  s="window"+s.slice(s.indexOf(".testQuestions"));        // test8.js boshida 'indow' xatosi bor — faqat o'qishda tuzatiladi
  const w={};vm.runInNewContext(s,{window:w});
  w.testQuestions.forEach((q,j)=>out.push({file:i,n:j+1,question:q.question,answers:q.answers,correct:q.correct}));
}
process.stdout.write(JSON.stringify(out));
"""


def h(*parts):
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:12], 16)


def has_figure(x):
    return '"t": "figure"' in json.dumps(x, ensure_ascii=False)


def load_bundle():
    if not os.path.exists(BUNDLE):
        sys.exit(f"Topilmadi: {BUNDLE} (avval prepare_attestation_data.py)")
    b = json.load(open(BUNDLE, encoding="utf-8"))
    pub, priv, vq, sol = {}, {}, {}, {}
    for o in b["ops"]:
        p = o["path"].split("/")
        if p[0] == "attestationPhysicsQuestions" and len(p) == 2:
            pub[p[1]] = o["data"]
        elif p[0] == "attestationPhysicsQuestions" and len(p) == 4:
            priv[p[1]] = o["data"]
        elif p[0] == "attestationPhysicsDailyTests" and len(p) == 4 and p[2] == "versions":
            for q in o["data"]["questions"]:
                vq[q["id"]] = q
        elif p[0] == "attestationPhysicsDailyTests" and len(p) == 4 and p[2] == "solutions":
            for it in o["data"]["items"]:
                sol[it["id"]] = it
    return b, pub, priv, vq, sol


def pick_physics(pub, priv, seed):
    """Har bob uchun 8 savol: mavzular bo'yicha navbatma-navbat, qiyinlik maqsadiga yaqin."""
    chosen = OrderedDict()
    letters = Counter()
    for key, _title in SECTIONS:
        pool = [q for q in pub if pub[q]["section"] == key
                and pub[q]["evaluationType"] == "auto" and priv[q]["keyStatus"] == "valid"
                and priv[q]["solutionStatus"] in ("full", "theory") and priv[q]["solution"]
                and not (priv[q].get("review") or {}).get("check")
                and pub[q]["type"] == "mcq"
                and not has_figure([pub[q]["question"], pub[q]["options"]]) and not has_figure(priv[q]["solution"])]
        by_topic = defaultdict(list)
        for q in sorted(pool, key=lambda q: h(seed, "q", q)):
            by_topic[pub[q]["topic"]].append(q)
        topics = sorted(by_topic, key=lambda t: h(seed, "t", key, t))
        picked, used_topic, need = [], Counter(), dict(DIFF_TARGET)
        while len(picked) < PER_SECTION:
            progress = False
            for t in topics:
                if len(picked) >= PER_SECTION:
                    break
                # shu mavzudan eng kam ishlatilgan, maqsad qiyinlikka mos, javob harfi kam uchragan savol
                cands = [q for q in by_topic[t] if q not in picked]
                if not cands:
                    continue
                if min(used_topic[x] for x in topics if by_topic[x]) < used_topic[t]:
                    continue
                want = [q for q in cands if need.get(pub[q]["difficultyLevel"], 0) > 0] or cands
                want.sort(key=lambda q: (letters[priv[q]["correctAnswer"]], h(seed, "p", q)))
                q = want[0]
                picked.append(q)
                used_topic[t] += 1
                need[pub[q]["difficultyLevel"]] = need.get(pub[q]["difficultyLevel"], 0) - 1
                letters[priv[q]["correctAnswer"]] += 1
                progress = True
            if not progress:
                sys.exit(f"{key}: yetarli savol yo'q ({len(picked)}/{PER_SECTION})")
        picked.sort(key=lambda q: (pub[q]["difficultyLevel"], h(seed, "o", q)))     # oson -> murakkab
        chosen[key] = picked
    return chosen


def load_pedagogy():
    r = subprocess.run(["node", "-e", PED_NODE, PED_DIR], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def pick_pedagogy(ped, seed, letters):
    seen, pool = set(), []
    for q in sorted(ped, key=lambda q: h(seed, "ped", q["file"], q["n"])):
        txt = " ".join(q["question"].split())
        if len(q["answers"]) != 4 or txt in seen or not (0 <= q["correct"] < 4):
            continue
        seen.add(txt)
        pool.append(q)
    files = sorted({q["file"] for q in pool}, key=lambda f: h(seed, "pf", f))[:PED_COUNT]
    picked = []
    for f in files:                                                  # har fayldan bittadan
        cands = [q for q in pool if q["file"] == f]
        cands.sort(key=lambda q: (letters[LETTERS[q["correct"]]], h(seed, "pq", f, q["n"])))
        picked.append(cands[0])
        letters[LETTERS[cands[0]["correct"]]] += 1
    picked.sort(key=lambda q: (q["file"], q["n"]))
    return picked


def para(text):
    return [{"t": "p", "text": " ".join(str(text).split())}]


def ped_docs(q):
    qid = f"PED-{q['file']:02d}-{q['n']:02d}"
    letter = LETTERS[q["correct"]]
    pubq = OrderedDict([
        ("id", qid), ("section", "pedagogika"), ("sectionTitle", "Pedagogika"), ("topic", "Pedagogika"),
        ("type", "mcq"), ("evaluationType", "auto"), ("difficulty", "medium"), ("difficultyLevel", 2),
        ("question", para(q["question"])),
        ("options", [OrderedDict([("key", LETTERS[i]), ("blocks", para(a))]) for i, a in enumerate(q["answers"])]),
        ("optionCount", 4), ("position", 0), ("bookNumber", f"P{q['file']}.{q['n']}"), ("contentVersion", 1),
    ])
    sol = OrderedDict([
        ("id", qid), ("evaluationType", "auto"), ("correctAnswer", letter), ("solutionResult", letter),
        ("solutionStatus", "theory"),
        ("solution", [{"t": "answer", "blocks": para(f"{letter}) {q['answers'][q['correct']]}")}]),
    ])
    return qid, letter, pubq, sol


def build(number, seed):
    b, pub, priv, vq, sol = load_bundle()
    chosen = pick_physics(pub, priv, seed)
    letters = Counter(priv[q]["correctAnswer"] for qs in chosen.values() for q in qs)
    ped = pick_pedagogy(load_pedagogy(), seed, letters)

    ids, questions, answers, solutions, topic_idx = [], [], OrderedDict(), [], []
    topics = [t for _k, t in SECTIONS] + ["Pedagogika"]
    for si, (key, _t) in enumerate(SECTIONS):
        for q in chosen[key]:
            e = OrderedDict(vq[q])
            e["position"] = len(ids) + 1
            e["bookNumber"] = vq[q].get("bookNumber", "")
            # mock testda bob nomi mock sarlavhasi bilan bir xil bo'lsin (foydalanuvchi ko'rsatgan 5 bob)
            e["sectionTitle"] = topics[si]
            ids.append(q); questions.append(e); answers[q] = priv[q]["correctAnswer"]; topic_idx.append(si)
            solutions.append(sol[q])
    for q in ped:
        qid, letter, pubq, s = ped_docs(q)
        pubq["position"] = len(ids) + 1
        ids.append(qid); questions.append(pubq); answers[qid] = letter; topic_idx.append(5)
        solutions.append(s)

    n = len(ids)
    day = FIRST_MOCK_DAY + number - 1
    tid = f"att-fizika-mock-{number:02d}"
    diff = Counter(q.get("difficultyLevel", 2) for q in questions)
    plan_hash = hashlib.sha256(json.dumps([ids, list(answers.values())], ensure_ascii=False).encode()).hexdigest()[:16]
    comp = OrderedDict((k, len(chosen[k])) for k, _ in SECTIONS)
    comp["pedagogika"] = len(ped)
    test = OrderedDict([
        ("id", tid), ("course", "fizika"), ("kind", "mock"), ("schemaVersion", 1), ("dayNumber", day),
        ("mockNumber", number), ("section", "mock"), ("sectionTitle", "Mock test"),
        ("topics", topics), ("topicParts", []), ("questionIds", ids), ("questionCount", n),
        ("questionTopicIdx", topic_idx), ("questionEval", ["a"] * n), ("scorableCount", n), ("openCount", 0),
        ("unreliableCount", 0), ("difficulty", OrderedDict((str(i), diff.get(i, 0)) for i in (1, 2, 3, 4))),
        ("bookRange", ""), ("pointsPerQuestion", POINTS), ("maxScore", n * POINTS),
        ("physicsCount", n - len(ped)), ("pedagogyCount", len(ped)), ("composition", comp),
        ("status", "draft"), ("published", False), ("publishAt", None), ("publishedAt", None), ("publishedBy", None),
        ("solutionAvailableAt", None), ("archivedAt", None), ("timeLimitSeconds", TIME_LIMIT), ("currentVersion", 1),
        ("planHash", plan_hash),
        ("notification", OrderedDict([("title", "Mock test tayyor!"),
                                      ("body", f"{n} savol · {n - len(ped)} fizika + {len(ped)} pedagogika · {n * POINTS} ball"),
                                      ("href", f"attestatsiya/fizika-test.html?day={day}")])),
        ("figureCount", 0),
    ])
    docs = OrderedDict([
        (f"attestationPhysicsDailyTests/{tid}", ("set", test)),
        (f"attestationPhysicsDailyTests/{tid}/versions/v1",
         ("create", OrderedDict([("testId", tid), ("version", 1), ("dayNumber", day), ("questionIds", ids), ("questions", questions)]))),
        (f"attestationPhysicsDailyTests/{tid}/keys/v1",
         ("create", OrderedDict([("testId", tid), ("version", 1), ("questionIds", ids), ("answers", answers), ("scorableCount", n)]))),
        (f"attestationPhysicsDailyTests/{tid}/solutions/v1",
         ("create", OrderedDict([("testId", tid), ("version", 1), ("questionIds", ids), ("items", solutions)]))),
    ])
    return tid, day, test, docs, chosen, ped, pub


def nested(v, in_arr=False, path=""):
    if isinstance(v, list):
        if in_arr:
            return path
        for i, x in enumerate(v):
            r = nested(x, True, f"{path}[{i}]")
            if r:
                return r
    elif isinstance(v, dict):
        for k, x in v.items():
            r = nested(x, False, f"{path}.{k}")
            if r:
                return r
    return None


def validate(test, docs, chosen, ped, pub):
    errs = []
    ids = test["questionIds"]
    key = docs[f"attestationPhysicsDailyTests/{test['id']}/keys/v1"][1]
    ver = docs[f"attestationPhysicsDailyTests/{test['id']}/versions/v1"][1]
    sol = docs[f"attestationPhysicsDailyTests/{test['id']}/solutions/v1"][1]
    ok = lambda c, m: None if c else errs.append(m)
    ok(len(ids) == 50 and len(set(ids)) == 50, "50 ta noyob savol bo'lishi shart")
    ok(test["maxScore"] == 100 and test["pointsPerQuestion"] == 2, "100 ball = 50 x 2")
    ok(test["timeLimitSeconds"] == 7200, "vaqt chegarasi 2 soat")
    ok(all(len(chosen[k]) == 8 for k, _ in SECTIONS), "har bobdan 8 ta")
    ok(sum(len(v) for v in chosen.values()) == 40 and len(ped) == 10, "40 fizika + 10 pedagogika")
    ok(all(pub[q]["section"] != "maxsus" for v in chosen.values() for q in v), "maxsus mavzular kirmaydi")
    ok(list(key["answers"]) == ids and key["scorableCount"] == len(key["answers"]) == 50, "kalit 50 ta, tartibda")
    ok(all(a in LETTERS[:4] or a in LETTERS for a in key["answers"].values()), "kalit harflari")
    ok([q["id"] for q in ver["questions"]] == ids and [i["id"] for i in sol["items"]] == ids, "version/solution tartibi")
    ok(all(i["correctAnswer"] == key["answers"][i["id"]] for i in sol["items"]), "yechim javobi kalit bilan bir xil")
    leak = {"correctAnswer", "solution", "bookAnswer", "solutionResult", "answers", "review", "verify"}
    ok(not any(f'"{k}"' in json.dumps(ver) for k in leak), "version (public) javob maydonlarisiz")
    ok(not has_figure([ver, sol]), "rasm yo'q")
    for q in ver["questions"]:
        ok(q["optionCount"] == len(q["options"]) and key["answers"][q["id"]] in [o["key"] for o in q["options"]],
           f"{q['id']}: javob variantlar ichida")
    for p, (_op, d) in docs.items():
        ok(not nested(d), f"{p}: ichma-ich massiv")
        ok(len(json.dumps(d, ensure_ascii=False).encode()) < 900_000, f"{p}: hajm")
    ok(Counter(test["questionTopicIdx"]) == Counter({0: 8, 1: 8, 2: 8, 3: 8, 4: 8, 5: 10}), "bob taqsimoti")
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--number", type=int, default=1)
    ap.add_argument("--seed", default=None)
    ap.add_argument("--check", action="store_true", help="faqat tekshiradi, fayl yozmaydi")
    a = ap.parse_args()
    seed = a.seed or f"mock-{a.number}"
    tid, day, test, docs, chosen, ped, pub = build(a.number, seed)
    errs = validate(test, docs, chosen, ped, pub)
    key = docs[f"attestationPhysicsDailyTests/{tid}/keys/v1"][1]["answers"]
    print(f"{tid} · dayNumber {day} · {test['questionCount']} savol · {test['maxScore']} ball · planHash {test['planHash']}")
    for k, t in SECTIONS:
        tp = Counter(pub[q]["topic"] for q in chosen[k])
        print(f"  {t}: 8 ta · {len(tp)} mavzu · qiyinlik {dict(Counter(pub[q]['difficultyLevel'] for q in chosen[k]))}")
    print(f"  Pedagogika: {len(ped)} ta (fayllar {[q['file'] for q in ped]})")
    print(f"  kalit harflari: {dict(sorted(Counter(key.values()).items()))}")
    if errs:
        print("XATO:\n  " + "\n  ".join(errs))
        sys.exit(1)
    print("tekshiruvlar: PASS")
    if a.check:
        return
    bundle = OrderedDict([
        ("format", "oliyfizika-attestation-mock-import"), ("schemaVersion", 1), ("testId", tid), ("dayNumber", day),
        ("counts", OrderedDict([("questions", 50), ("physics", 40), ("pedagogy", 10), ("maxScore", 100)])),
        ("planHash", test["planHash"]),
        ("ops", [OrderedDict([("op", op), ("path", p), ("data", d)]) for p, (op, d) in docs.items()]),
    ])
    os.makedirs(PRIV, exist_ok=True)
    out = os.path.join(PRIV, f"mock-import-{a.number:02d}.json")
    json.dump(bundle, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # javobsiz reja (commit qilish xavfsiz): faqat ID'lar va hisoblar
    plan = OrderedDict([
        ("testId", tid), ("dayNumber", day), ("seed", seed), ("planHash", test["planHash"]),
        ("composition", test["composition"]), ("pointsPerQuestion", POINTS), ("maxScore", test["maxScore"]),
        ("questionIds", test["questionIds"]),
        ("physicsTopics", OrderedDict((t, sorted(Counter(pub[q]["topic"] for q in chosen[k]).items()))
                                      for k, t in SECTIONS)),
    ])
    os.makedirs(DOCS, exist_ok=True)
    json.dump(plan, open(os.path.join(DOCS, f"mock_test_{a.number:02d}_plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"yozildi: {os.path.relpath(out, ROOT)}  +  docs/attestatsiya-fizika/mock_test_{a.number:02d}_plan.json")


if __name__ == "__main__":
    main()
