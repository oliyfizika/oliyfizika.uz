#!/usr/bin/env python3
"""PHASE 4 validator — Real imtihonlar application data vs. the PHASE 3 dataset.

    python3 tools/real-imtihonlar/validate_app_data.py

Checks the expected totals and that app-data is a faithful, unmodified projection of the dataset
(questionText, options, parts, matchGroup, formulas, figures, sourcePage, verification, statuses).
Exit code 1 on any failure.
"""
import glob
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
APP = os.path.join(PRIV, "app-data")

EXPECTED = {
    "exams": 12, "questions": 540, "included": 537, "org": 3,
    "FINAL": 531, "NO_CORRECT_OPTION": 3, "NEEDS_MANUAL_REVIEW": 3, "reviewParts": 5, "EXCLUDED_ORG": 3,
    "figures": 105, "formulas": 1307, "humanTrue": 68, "humanFalse": 472,
}
ORG = {("REAL-2026-09-29-1", 32), ("REAL-2026-09-29-2", 31), ("REAL-2026-09-29-2", 32)}
errors = []


def E(msg):
    errors.append(msg)


def main():
    cat = json.load(open(os.path.join(APP, "catalog.json"), encoding="utf-8"))
    got = {k: 0 for k in EXPECTED}
    got["exams"] = len(cat["exams"])
    ids = set()
    for ex in cat["exams"]:
        eid = ex["examId"]
        if ex.get("officialSource") is not False:
            E(f"{eid}: officialSource must stay false")
        for k in ("sourceType", "sourceFile", "sourceDate", "sourceProvenance", "warnings"):
            if k not in ex:
                E(f"{eid}: catalog missing {k}")
        if eid.startswith("REAL-2026-09-30") and ex.get("session"):
            E(f"{eid}: 30.09 exam must not carry a session (Variant only)")
        ds = json.load(open(os.path.join(PRIV, "dataset", f"{eid}.json"), encoding="utf-8"))
        qd = json.load(open(os.path.join(APP, "exams", eid, "questions.json"), encoding="utf-8"))
        sd = json.load(open(os.path.join(APP, "exams", eid, "solutions.json"), encoding="utf-8"))
        if ds["exam"]["warnings"] != ex["warnings"] or ds["exam"]["sourceProvenance"] != ex["sourceProvenance"]:
            E(f"{eid}: provenance/warnings differ from dataset")
        dsq = {q["questionNumber"]: q for q in ds["questions"]}
        sols = {s["questionNumber"]: s for s in sd["solutions"]}
        if sorted(dsq) != list(range(1, 46)) or sorted(q["questionNumber"] for q in qd["questions"]) != list(range(1, 46)):
            E(f"{eid}: question numbers not 1..45")
        for q in qd["questions"]:
            n = q["questionNumber"]; src = dsq[n]
            got["questions"] += 1
            if q["id"] in ids:
                E(f"duplicate id {q['id']}")
            ids.add(q["id"])
            for k in ("questionText", "options", "parts", "matchGroup", "sourcePage", "sourcePages", "sourceStatus", "sourceNotes", "type", "included", "exclusionReason"):
                if q[k] != src[k]:
                    E(f"{q['id']}: field '{k}' differs from dataset")
            if [m["tex"] for m in q["formulas"]] != [m["tex"] for m in src["formulas"]]:
                E(f"{q['id']}: formulas differ from dataset")
            for t, ts in zip(q["tables"], src["tables"]):
                if [r["c"] for r in t["rows"]] != [[str(c) for c in row] for row in ts["rows"]]:
                    E(f"{q['id']}: table differs from dataset")
            if len(q["tables"]) != len(src["tables"]):
                E(f"{q['id']}: table count differs")
            if [f["figureId"] for f in q["figures"]] != [f["figureId"] for f in src["figures"]]:
                E(f"{q['id']}: figure list differs")
            for f in q["figures"]:
                p = os.path.join(PRIV, f["localFile"])
                if not os.path.exists(p):
                    E(f"{q['id']}: figure file missing {f['localFile']}")
                elif hashlib.sha256(open(p, "rb").read()).hexdigest() != f["sha256"]:
                    E(f"{q['id']}: figure sha mismatch {f['figureId']}")
                if f["questionNumber"] != n or not f["figureId"].startswith(f"{eid}-q{n:02d}-"):
                    E(f"{q['id']}: figure mapping wrong {f['figureId']}")
                if f["sourcePage"] not in q["sourcePages"]:
                    E(f"{q['id']}: figure page not in sourcePages")
            got["figures"] += len(q["figures"])
            got["formulas"] += len(q["formulas"])
            v = q["verification"]
            if not isinstance(v.get("aiVerified"), bool) or not isinstance(v.get("humanSignOff"), bool):
                E(f"{q['id']}: aiVerified/humanSignOff must be separate booleans")
            if v["aiVerified"] != src["verification"]["aiVerified"] or v["humanSignOff"] != src["humanSignOff"]:
                E(f"{q['id']}: verification differs from dataset")
            got["humanTrue" if v["humanSignOff"] else "humanFalse"] += 1
            is_org = (eid, n) in ORG
            if is_org != (not q["included"]) or (is_org and q["exclusionReason"] != "ORG"):
                E(f"{q['id']}: ORG exclusion wrong")
            if q["included"]:
                got["included"] += 1
            else:
                got["org"] += 1
            s = sols.get(n)
            if not s:
                E(f"{q['id']}: no solution entry"); continue
            st = s["solutionStatus"]
            if st != (src.get("solutionRef") or {}).get("solutionStatus") or st != q["solutionStatus"]:
                E(f"{q['id']}: solution status differs from dataset")
            got[st] += 1
            if s["partSolutionStatus"]:
                got["reviewParts"] += sum(1 for x in s["partSolutionStatus"].values() if x == "NEEDS_MANUAL_REVIEW")
            elif st == "NEEDS_MANUAL_REVIEW":
                got["reviewParts"] += max(1, len(q["parts"]))
            if st in ("NEEDS_MANUAL_REVIEW", "NO_CORRECT_OPTION", "EXCLUDED_ORG") and s["answer"]["choice"]:
                E(f"{q['id']}: {st} must not carry a final choice")
            if st == "FINAL" and q["type"] in ("mc", "match") and not s["answer"]["choice"]:
                E(f"{q['id']}: FINAL {q['type']} without a parsed answer choice")
            if not s["blocks"] and st != "EXCLUDED_ORG":
                E(f"{q['id']}: empty solution")
    for k, exp in EXPECTED.items():
        if got[k] != exp:
            E(f"total {k}: expected {exp}, got {got[k]}")
    print(json.dumps(got, ensure_ascii=False))
    for e in errors:
        print("ERR", e)
    print("PHASE 4 VALIDATION:", "PASS" if not errors else f"FAIL ({len(errors)} errors)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
