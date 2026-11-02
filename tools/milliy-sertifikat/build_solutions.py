#!/usr/bin/env python3
"""Milliy sertifikat mock testlari: yozma yechimlar manbasi (.txt) -> data/solutions/mock-test-N.json.

Manba formati (tools/milliy-sertifikat/solutions/mock-test-N.txt):
  @N            yangi savol (N — savol raqami)
  G: ...        «Berilgan» qutisi
  P: ...        oddiy paragraf ($...$ — KaTeX inline, **qalin**)
  M: ...        alohida qatordagi formula (TeX)
  A: ...        «Javob» qutisi
  S: ...        «Manba xatosi» izohi (javoblar kalitidagi nomuvofiqlik)
  U: ...        «Yechim holati: aniqlanmagan» izohi (rasm/shart noaniq)
  # ...         izoh (e'tiborga olinmaydi)
Matnda (formuladan tashqari) o' g' -> o‘ g‘, qolgan ' -> ’ ga almashtiriladi.
Blok formati attestatsiya render.js (renderBlocks) bilan bir xil.

  python3 tools/milliy-sertifikat/build_solutions.py          # barcha manbalar
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "tools", "milliy-sertifikat", "solutions")
OUT = os.path.join(ROOT, "milliy-sertifikat", "mock-testlar", "data", "solutions")


def fix_text(s):
    parts = re.split(r"(\$[^$]*\$)", s)
    out = []
    for p in parts:
        if p.startswith("$") and p.endswith("$") and len(p) > 1:
            out.append(p)
            continue
        p = re.sub(r"([oOgG])'", lambda m: m.group(1) + "‘", p)
        p = p.replace("'", "’")
        out.append(p)
    return "".join(out)


def para(text):
    return {"t": "p", "text": fix_text(text)}


def build(path):
    items, cur, n = {}, None, None
    for ln, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith("@"):
            n = line[1:].strip()
            if n in items:
                sys.exit(f"{path}:{ln}: takroriy savol {n}")
            cur = items[n] = []
            continue
        if cur is None:
            sys.exit(f"{path}:{ln}: @N dan oldin matn")
        tag, _, body = line.partition(":")
        body = body.strip()
        if tag == "P":
            cur.append(para(body))
        elif tag == "M":
            cur.append({"t": "math", "tex": body})
        elif tag == "G":
            cur.append({"t": "given", "blocks": [para(body)]})
        elif tag == "A":
            cur.append({"t": "answer", "blocks": [para(body)]})
        elif tag == "S":
            cur.append({"t": "status", "kind": "source_error", "blocks": [para(body)]})
        elif tag == "U":
            cur.append({"t": "status", "kind": "undetermined", "blocks": [para(body)]})
        else:
            sys.exit(f"{path}:{ln}: noma'lum teg {tag!r}")
    return items


def main():
    os.makedirs(OUT, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(SRC, "mock-test-*.txt"))):
        test_id = os.path.basename(path)[:-4]
        data = json.load(open(os.path.join(ROOT, "milliy-sertifikat", "mock-testlar", "data", f"{test_id}.json"), encoding="utf-8"))
        items = build(path)
        nums = {str(q["n"]) for q in data["questions"]}
        extra, missing = set(items) - nums, nums - set(items)
        if extra:
            sys.exit(f"{test_id}: testda yo'q savollar: {sorted(extra, key=int)}")
        qmap = {str(q["n"]): q for q in data["questions"]}
        for k, blocks in items.items():
            ans = [b for b in blocks if b["t"] == "answer"]
            if not ans:
                sys.exit(f"{test_id}: {k}-savolda «Javob» (A:) yo'q")
            q = qmap[k]
            if q["type"] == "mcq":   # yechimdagi variant harfi javoblar kaliti bilan mos bo'lishi shart
                m = re.match(r"\*\*([A-F])\)\*\*", ans[-1]["blocks"][0]["text"])
                if not m or m.group(1) != q["answer"]:
                    sys.exit(f"{test_id}: {k}-savol — yechimdagi javob ({m.group(1) if m else '?'}) kalit ({q['answer']}) bilan mos emas")
        out = {"schemaVersion": 1, "testId": test_id, "items": {k: items[k] for k in sorted(items, key=int)}}
        with open(os.path.join(OUT, f"{test_id}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"{test_id}: {len(items)} ta yechim" + (f" (yo'q: {sorted(missing, key=int)})" if missing else ""))


if __name__ == "__main__":
    main()
