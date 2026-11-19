"""
«Attestatsiya 2026 (kuz)» savollari uchun umumiy yordamchilar (mock va kunlik testlarga qo‘shish skriptlari ishlatadi).

Manba (gitignored, javob va yechimlar bor):
  _private/attestatsiya-fizika/kuz-2026-test1/items.json   (items.py dan)
  _private/attestatsiya-fizika/kuz-2026-test1/figures/qNN.png
items.json maydonlari: n, sec, topic, day, q ("[[TABLE]]" qatori — jadval o‘rni), table, fig, opts, ans (0..3), sol, note.
"""
import base64, hashlib, json, os, re, sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mock_test as b1                      # ROOT, PRIV, DOCS, nested (o‘zgarmaydi)
import build_mock_test_02 as b2                   # text_blocks, webp, walk, sha, MAX_FIG_BYTES (o‘zgarmaydi)

ROOT, PRIV, DOCS = b1.ROOT, b1.PRIV, b1.DOCS
SRC = os.path.join(PRIV, "kuz-2026-test1")
LETTERS = "ABCD"
SECTION_TITLES = OrderedDict([("mexanika", "Mexanika"), ("molekulyar", "Molekulyar fizika va termodinamika"),
                              ("elektromagnetizm", "Elektr va magnetizm"), ("optika", "Optika"), ("atom-yadro", "Atom va yadro fizikasi")])
SOURCE_NOTE = "Attestatsiya 2026 (kuz), 1-test"
TABLE_MARK = "[[TABLE]]"

# Pedagogika tanlovi — build_mock_test_bahor.py dagi bilan aynan bir xil (u modul import qilinganda argumentlarni o‘qigani uchun nusxa).
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


def qid(n):
    return f"KZ26-1-{n:02d}"


def load_items():
    items = json.load(open(os.path.join(SRC, "items.json"), encoding="utf-8"))
    ns = [i["n"] for i in items]
    assert ns == sorted(set(ns)), "items.json: n takrorlanmasin, tartib bilan"
    for it in items:
        assert it["sec"] in SECTION_TITLES and len(it["opts"]) == 4 and 0 <= it["ans"] <= 3, f"{it['n']}: maydonlar"
        assert (TABLE_MARK in it["q"]) == bool(it.get("table")), f"{it['n']}: jadval belgisi va table birga bo‘lsin"
    return items


def table_block(rows):
    return {"t": "table", "rows": [{"cells": [{"blocks": [{"t": "p", "text": c}] if c else []} for c in r]} for r in rows]}


def question_blocks(it):
    """Savol matni -> bloklar; [[TABLE]] o‘rniga jadval. Rasm (bo‘lsa) birinchi paragrafdan keyin qo‘yiladi (chaqiruvchi)."""
    out = []
    for part in it["q"].split("\n"):
        if part.strip() == TABLE_MARK:
            out.append(table_block(it["table"]))
        elif part.strip():
            out += b2.text_blocks(part)
    return out


def figure_doc(test_id, name):
    raw, w, h = b2.webp(os.path.join(SRC, "figures", name))
    fid = b2.sha("fig", test_id, name, hashlib.sha256(raw).hexdigest())[:16] + ".webp"
    doc = OrderedDict([("testId", test_id), ("id", fid), ("mime", "image/webp"), ("bytes", len(raw)), ("data", base64.b64encode(raw).decode())])
    return fid, w, h, doc


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


def build_question(it, test_id, position, figures):
    """-> (public savol, yechim yozuvi, javob harfi). figures — {("figures", fid): doc} ga qo‘shiladi."""
    n = it["n"]
    letter = LETTERS[it["ans"]]
    qb = question_blocks(it)
    if it.get("fig"):
        fid, w, h, doc = figure_doc(test_id, it["fig"])
        figures[("figures", fid)] = doc
        qb.insert(1, {"t": "figure", "fig": it["fig"].rsplit(".", 1)[0], "id": fid, "w": w, "h": h})
    q = OrderedDict([("id", qid(n)), ("section", it["sec"]), ("sectionTitle", SECTION_TITLES[it["sec"]]), ("topic", it["topic"]), ("type", "mcq"),
                     ("evaluationType", "auto"), ("difficulty", "medium"), ("difficultyLevel", 2), ("question", qb),
                     ("options", [OrderedDict([("key", LETTERS[i]), ("blocks", b2.text_blocks(o))]) for i, o in enumerate(it["opts"])]),
                     ("optionCount", 4), ("position", position), ("bookNumber", f"KZ26-1.{n}"), ("contentVersion", 1)])
    sb = sol_blocks(it["sol"])
    if it.get("note"):
        sb.append({"t": "status", "kind": "source_error", "blocks": [{"t": "p", "text": it["note"]}]})   # «Manba xatosi» qutisi
    sb.append({"t": "answer", "blocks": [{"t": "p", "text": f"{letter}) {it['opts'][it['ans']]}"}]})
    s = OrderedDict([("id", qid(n)), ("evaluationType", "auto"), ("correctAnswer", letter), ("solutionResult", letter),
                     ("solutionStatus", "full"), ("solution", sb)])
    return q, s, letter


def plain(it):
    return re.sub(r"\s+", " ", it["q"].replace(TABLE_MARK, " ".join(c for r in (it.get("table") or []) for c in r)) + " " + " ".join(it["opts"]))


def latex_outside_dollars(obj, errs):
    """Matnda LaTeX buyrug‘i $...$ dan tashqarida qolmasin (KaTeX faqat $ ichini chizadi)."""
    def f(d):
        t = d.get("text")
        if isinstance(t, str):
            outside = re.sub(r"\$[^$]*\$", "", t)
            if re.search(r"\\[a-zA-Z]", outside) or t.count("$") % 2:
                errs.append(f"$ tashqarisida LaTeX yoki juft bo‘lmagan $: {t[:70]}")
    b2.walk(obj, f)
