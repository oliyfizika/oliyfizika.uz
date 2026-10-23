"""Parse the audited solution markdown files (audit/NN_<examId>-SOLUTIONS.md) into
render blocks for the Real imtihonlar solution viewer.

Format conversion only — the audited solution text is copied unchanged.
Question text / options are NOT taken from these files ("Savol.", "Savol (original matn).",
"Variantlar." lines are skipped): the source of truth for them is the PHASE 3 dataset.
"""
import re

HEAD_RE = re.compile(r"^### (\d+)(?:–(\d+))?-savol(?:lar)?(.*)$")
LABEL_RE = re.compile(r"^\*\*(.+?)([.:])\*\*\s?(.*)$")
SKIP_LABELS = ("Savol", "Savol (original matn)", "Variantlar")


def kind_of(label):
    l = label.lower()
    if l.startswith("javob"):
        return "answer"
    if l.startswith("berilgan"):
        return "given"
    if l.startswith(("izoh", "muammo", "qabul qilingan faraz", "muqobil talqinlar")):
        return "note"
    return "step"  # Formula, Hisoblash, Fizik mulohaza, Topish kerak, Rasm, ...


def parse_heading(rest):
    """rest = text after 'N-savol' in the heading. Returns statuses, part statuses, note, answer text."""
    statuses = re.findall(r"`([^`]+)`", rest)
    parts = dict(re.findall(r"([ab])\) `([^`]+)`", rest))
    answer = None
    m = re.search(r"· Javob: \*\*(.+?)\*\*(.*)$", rest)
    if m:
        answer = m.group(1).strip()
        tail = m.group(2).strip()
    else:
        tail = ""
    # free text between the last status and "· Javob" (e.g. "(manba kaliti A → D)")
    note = None
    nm = re.search(r"`[^`]+`\s*(\([^)]*\))\s*(?:·|$)", rest)
    if nm:
        note = nm.group(1).strip()
    return statuses, parts, note, answer, (tail or None)


def parse_file(path):
    lines = open(path, encoding="utf-8").read().split("\n")
    out = {}
    cur = None
    skipping = False
    for ln in lines:
        m = HEAD_RE.match(ln)
        if m:
            a, b = int(m.group(1)), int(m.group(2) or m.group(1))
            statuses, parts, note, answer, tail = parse_heading(m.group(3))
            cur = {"from": a, "to": b, "heading": ln[4:], "auditStatuses": statuses, "partAuditStatuses": parts,
                   "headingNote": note, "answerText": answer, "answerTail": tail, "blocks": []}
            for q in range(a, b + 1):
                out[q] = cur
            skipping = False
            continue
        if cur is None or ln.startswith("# ") or ln.startswith("## "):
            if ln.startswith("## ") or ln.startswith("# "):
                cur = None
            continue
        if not ln.strip():
            continue
        lm = LABEL_RE.match(ln)
        if lm:
            label = lm.group(1).strip()
            if label in SKIP_LABELS:
                skipping = True
                continue
            skipping = False
            cur["blocks"].append({"t": kind_of(label), "label": label, "text": lm.group(3).strip()})
            continue
        if skipping:
            continue
        if ln.startswith("- "):
            last = cur["blocks"][-1] if cur["blocks"] else None
            if last is not None and last["t"] != "plain":
                last.setdefault("items", []).append(ln[2:].strip())
            else:
                cur["blocks"].append({"t": "plain", "label": None, "text": "", "items": [ln[2:].strip()]})
            continue
        cur["blocks"].append({"t": "plain", "label": None, "text": ln.strip()})
    return out
