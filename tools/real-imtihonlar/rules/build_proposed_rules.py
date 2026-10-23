#!/usr/bin/env python3
"""Build PROPOSED rules (repo firestore.rules / storage.rules + Real imtihonlar block) for local validation.

    python3 tools/real-imtihonlar/rules/build_proposed_rules.py

Writes ONLY to _private/real-imtihonlar/rules-proposed/ (gitignored): firestore.rules, storage.rules and
*.diff against the repo files. The repo firestore.rules / storage.rules are NOT modified and nothing is deployed.
The change is purely additive (one isolated block per file, no existing line edited).
"""
import difflib
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "_private", "real-imtihonlar", "rules-proposed")


def build_firestore():
    src = open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read()
    block = open(os.path.join(HERE, "real_exams.firestore.rules.in"), encoding="utf-8").read()
    if ">>> real-exams" in src:
        raise SystemExit("firestore.rules already contains a real-exams block")
    end = src.rstrip().rfind("}")             # service
    end2 = src.rstrip()[:end].rstrip().rfind("}")  # match /databases/{database}/documents
    return src, src[:end2].rstrip() + "\n\n" + block.rstrip() + "\n  }\n}\n"


def build_storage():
    src = open(os.path.join(ROOT, "storage.rules"), encoding="utf-8").read()
    block = open(os.path.join(HERE, "real_exams.storage.rules.in"), encoding="utf-8").read()
    anchor = "    match /{allPaths=**} {"
    if anchor not in src or ">>> real-exams" in src:
        raise SystemExit("storage.rules anchor not found or block already present")
    return src, src.replace(anchor, block.rstrip() + "\n\n" + anchor, 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (old, new) in (("firestore.rules", build_firestore()), ("storage.rules", build_storage())):
        open(os.path.join(OUT, name), "w", encoding="utf-8").write(new)
        diff = "".join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), f"a/{name}", f"b/{name}"))
        open(os.path.join(OUT, name + ".diff"), "w", encoding="utf-8").write(diff)
        removed = [l for l in diff.splitlines() if l.startswith("-") and not l.startswith("---")]
        added = [l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++")]
        print(f"{name}: +{len(added)} / -{len(removed)} lines (existing lines removed: {len(removed)})")
        if removed:
            raise SystemExit(f"{name}: proposal would modify existing lines — STOP")


if __name__ == "__main__":
    main()
