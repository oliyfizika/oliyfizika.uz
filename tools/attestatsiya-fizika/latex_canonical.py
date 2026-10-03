#!/usr/bin/env python3
"""
Attestatsiya → Fizika: CANONICAL LaTeX manba (savollar + yechimlar) va undan hosil qilinadigan problems.json.

Canonical (inson tahrir qiladigan) manba:
  attestatsiya/fizika/ATT_EST solutions/chapters/*.tex        — savol matni, variantlar, `% Answer:` sarlavhasi
  attestatsiya/fizika/ATT_EST solutions/_build/solutions_src/*.sol — yechim LaTeX'i va holati (status/result/…)

Hosila (qo'lda tahrir QILINMAYDI):
  …/_build/solutions_src/problems.json  — `sync` buyrug'i chapters/*.tex dan qayta yozadi.

Yo'nalish faqat bitta: LaTeX → problems.json → prepare_attestation_data.py → bundle → Firestore.

  python3 tools/attestatsiya-fizika/latex_canonical.py check   # LaTeX ↔ problems.json (exit 1 — mos emas)
  python3 tools/attestatsiya-fizika/latex_canonical.py sync    # problems.json ni LaTeX'dan yangilash
"""
import glob
import json
import os
import re
import sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BOOK = os.path.join(ROOT, "attestatsiya", "fizika", "ATT_EST solutions")
CHAPTERS = os.path.join(BOOK, "chapters")
SOLDIR = os.path.join(BOOK, "_build", "solutions_src")
PROBLEMS = os.path.join(SOLDIR, "problems.json")

CHAPTER_FILES = ["mechanics.tex", "molecular.tex", "electromagnetism.tex", "optics.tex", "nuclear.tex", "special.tex"]

HEAD_RE = re.compile(r"^% Masala (\d+)\.(\d+) \| id (\S+) \| Source: (.*)$")
ANS_RE = re.compile(r"^% Answer: (.+?) \((\S+)\) \| difficulty (\S+) \| score (\S+)$")
OPT_ENV_RE = re.compile(r"\\begin\{enumerate\}\[label=\\Alph\*\)[^\]]*\](.*?)\\end\{enumerate\}", re.S)


def count_options(tex):
    """Javob variantlari: masalablok ichidagi `label=\\Alph*)` ro'yxatining yuqori darajadagi \\item lari."""
    envs = OPT_ENV_RE.findall(tex)
    if not envs:
        return 0
    body = envs[-1]
    depth, n = 0, 0
    for tok in re.finditer(r"\\begin\{(enumerate|itemize)\}|\\end\{(enumerate|itemize)\}|\\item\b", body):
        t = tok.group(0)
        if t.startswith("\\begin"):
            depth += 1
        elif t.startswith("\\end"):
            depth -= 1
        elif depth == 0:
            n += 1
    return n


def parse_chapters():
    """chapters/*.tex → OrderedDict[sourceId] = record (tartib — kitob tartibi)."""
    out = OrderedDict()
    for fname in CHAPTER_FILES:
        path = os.path.join(CHAPTERS, fname)
        lines = open(path, encoding="utf-8").read().split("\n")
        section = None
        i = 0
        while i < len(lines):
            line = lines[i]
            m = re.match(r"^\\section\{(.+)\}$", line)
            if m:
                section = m.group(1)
            m = HEAD_RE.match(line)
            if m:
                ch, num, sid, source = int(m.group(1)), int(m.group(2)), m.group(3), m.group(4)
                j = i + 1
                also, original, ans = [], None, None
                while not lines[j].startswith("\\begin{masalablok}"):
                    if lines[j].startswith("% Also in: "):
                        also.append(lines[j][len("% Also in: "):])
                    elif lines[j].startswith("% Original: "):
                        original = lines[j][len("% Original: "):]
                    else:
                        a = ANS_RE.match(lines[j])
                        if a:
                            ans = a
                    j += 1
                if lines[j + 1] != "\\masala":
                    raise SystemExit(f"{fname}:{j + 2}: \\masala kutilgan ({sid})")
                k = j + 2
                while lines[k] != "\\end{masalablok}":
                    k += 1
                tex = "\n".join(lines[j + 2:k])
                if sid in out:
                    raise SystemExit(f"Takroriy id LaTeX'da: {sid}")
                if ans is None:
                    raise SystemExit(f"{fname}: `% Answer:` sarlavhasi yo'q ({sid})")
                out[sid] = OrderedDict([
                    ("id", sid), ("ch", ch), ("num", num), ("section", section), ("file", fname),
                    ("line", i + 1), ("source", source), ("also", also), ("original", original),
                    ("answer", ans.group(1)), ("answer_src", ans.group(2)),
                    ("difficulty", ans.group(3)), ("score", ans.group(4)),
                    ("tex", tex), ("nopts", count_options(tex)),
                ])
                i = k
            i += 1
    return out


def parse_solutions():
    """*.sol → OrderedDict[sourceId] = {file, bookNumber, meta(OrderedDict), body}."""
    out = OrderedDict()
    for path in sorted(glob.glob(os.path.join(SOLDIR, "*.sol"))):
        for block in open(path, encoding="utf-8").read().split("%%% S ")[1:]:
            head, _, rest = block.partition("%%% BODY")
            hl = head.split("\n")
            meta = OrderedDict()
            for line in hl[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.split("#")[0].strip()
            sid = meta["id"]
            if sid in out:
                raise SystemExit(f"Takroriy yechim: {sid}")
            out[sid] = OrderedDict([("file", os.path.basename(path)), ("bookNumber", hl[0].strip()),
                                    ("meta", meta), ("body", rest.split("%%% END")[0].strip())])
    return out


def compare(chapters, problems):
    """LaTeX ↔ problems.json: id to'plami, tartib, matn, javob, variantlar soni, bo'lim, tip. → xatolar ro'yxati."""
    errs = []
    pj = OrderedDict((p["id"], p) for p in problems)
    if len(pj) != len(problems):
        errs.append("problems.json: takroriy id")
    for sid in chapters.keys() - pj.keys():
        errs.append(f"{sid}: LaTeX'da bor, problems.json'da yo'q")
    for sid in pj.keys() - chapters.keys():
        errs.append(f"{sid}: problems.json'da bor, LaTeX'da yo'q")
    for sid, c in chapters.items():
        p = pj.get(sid)
        if not p:
            continue
        for key in ("ch", "num", "tex", "answer", "answer_src", "nopts", "section"):
            if c[key] != p.get(key):
                errs.append(f"{sid}: {key} mos emas (LaTeX={str(c[key])[:60]!r} · JSON={str(p.get(key))[:60]!r})")
        if (p["type"] == "open") != (c["nopts"] == 0):
            errs.append(f"{sid}: tip {p['type']} va variantlar soni {c['nopts']} ziddiyatli")
    return errs


def sync(chapters, problems):
    """problems.json'ni LaTeX'dan yangilash (metadata — check/fixes/fingerprint/chcode — saqlanadi)."""
    pj = OrderedDict((p["id"], p) for p in problems)
    out, changed = [], []
    for sid, c in chapters.items():
        p = OrderedDict(pj.get(sid) or {})
        before = json.dumps(p, ensure_ascii=False, sort_keys=True)
        p["ch"], p["num"], p["id"], p["section"] = c["ch"], c["num"], sid, c["section"]
        p["tex"], p["answer"], p["answer_src"], p["nopts"] = c["tex"], c["answer"], c["answer_src"], c["nopts"]
        if c["nopts"] == 0:
            p["type"] = "open"
        elif p.get("type") in (None, "open"):
            p["type"] = "mcq"
        if json.dumps(p, ensure_ascii=False, sort_keys=True) != before:
            changed.append(sid)
        out.append(p)
    return out, changed


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    chapters = parse_chapters()
    sols = parse_solutions()
    problems = json.load(open(PROBLEMS, encoding="utf-8"))
    missing_sol = [s for s in chapters if s not in sols]
    if cmd == "check":
        errs = compare(chapters, problems) + [f"{s}: .sol yechim yo'q" for s in missing_sol]
        print(f"LaTeX: {len(chapters)} savol, {len(sols)} yechim · problems.json: {len(problems)}")
        for e in errs[:50]:
            print("MISMATCH", e)
        print("LATEX_JSON_CONSISTENCY =", "PASS" if not errs else f"FAIL ({len(errs)})")
        sys.exit(1 if errs else 0)
    if cmd == "sync":
        new, changed = sync(chapters, problems)
        if changed:
            with open(PROBLEMS, "w", encoding="utf-8") as f:
                f.write("[\n" + ",\n".join(json.dumps(p, ensure_ascii=False, indent=0) for p in new) + "\n]")
        print(f"sync: {len(changed)} yozuv yangilandi")
        errs = compare(chapters, json.load(open(PROBLEMS, encoding="utf-8")))
        print("LATEX_JSON_CONSISTENCY =", "PASS" if not errs else f"FAIL ({len(errs)})")
        sys.exit(1 if errs else 0)
    sys.exit(f"noma'lum buyruq: {cmd}")


if __name__ == "__main__":
    main()
