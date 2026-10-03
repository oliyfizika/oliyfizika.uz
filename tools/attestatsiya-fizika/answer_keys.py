#!/usr/bin/env python3
"""
Attestatsiya → Fizika: answer-key tiklash (faqat tasdiqlangan qarorlar) — CANONICAL LaTeX'ga yoziladi.

Qarorlar fayli (MAXFIY, to'g'ri javoblar bor — git'ga tushmaydi):
  _private/attestatsiya-fizika/answer-key/decisions.json

  python3 tools/attestatsiya-fizika/answer_keys.py validate   # qarorlar + distraktorlarni tekshirish (hech narsa yozilmaydi)
  python3 tools/attestatsiya-fizika/answer_keys.py apply      # zaxira nusxa → chapters/*.tex, *.sol, answers.tex → sync

Har bir tiklangan savol uchun canonical manbada:
  chapters/*.tex : masalablokga A–D variantlar; `% Answer: <harf> (reconstructed)`
  *.sol          : `result: <harf>`, `keySource: reconstructed`, `keyValue: <asl natija>`; \\javob{<harf>) …}
  answers.tex    : kitob javoblar jadvalida harf
Qayta ishga tushirish xavfsiz (idempotent): allaqachon qo'llangan savol o'tkazib yuboriladi.
"""
import datetime
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import latex_canonical as L  # noqa: E402

ROOT = L.ROOT
PRIV = os.path.join(ROOT, "_private", "attestatsiya-fizika")
DECISIONS = os.path.join(PRIV, "answer-key", "decisions.json")
ANSWERS_TEX = os.path.join(L.CHAPTERS, "answers.tex")
LETTERS = "ABCD"
OPT_ENV = "\\begin{enumerate}[label=\\Alph*),itemsep=1.1em,leftmargin=2.2em,topsep=8pt]"
MIN_REL_GAP = 0.03          # raqamli distraktor to'g'ri javobdan va bir-biridan kamida 3 % farq qiladi
STALE_PHRASES = [r"aniq variantni ko‘rsatib bo‘lmaydi", r"variantsiz holda", r"ifoda ko‘rinishida berildi",
                 r"\(\s*variantlar[^)]*berilmagan\s*\)", r"\(\s*variantsiz savol\s*\)", r"Variantlar berilmagan\.\)"]


def qid_of(c):
    return f"AF-{c['ch']}-{c['num']:03d}"


def load_decisions(path=DECISIONS):
    d = json.load(open(path, encoding="utf-8"))
    return d["items"]


def norm_opt(t):
    return re.sub(r"\s+", "", t or "")


def options_in_order(item):
    """Variantlar tartibi va to'g'ri harf. asc — raqam bo'yicha; fixed — to'g'ri javob `pos` ga qo'yiladi."""
    opts = [dict(tex=item["correct"], value=item.get("value"), correct=True)] + \
           [dict(tex=d["tex"], value=d["value"], correct=False) for d in item["distractors"]]
    if item["order"] == "asc":
        key = lambda o: o["value"][0] if isinstance(o["value"], list) else o["value"]
        opts.sort(key=key)
    else:
        rest = [o for o in opts if not o["correct"]]
        opts = rest[:item["pos"]] + [opts[0]] + rest[item["pos"]:]
    letter = LETTERS[[o["correct"] for o in opts].index(True)]
    return opts, letter


def numbers_in(s):
    s = (s or "").replace("√6", "2.449").replace("−", "-")
    m = re.match(r"^\s*(-?\d+)/(\d+)", s)
    if m:
        return [int(m.group(1)) / int(m.group(2))]
    return [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?(?:e[-+]?\d+)?", s)]


def rel(a, b):
    return abs(a - b) / max(abs(a), abs(b), 1e-300)


def validate_item(item, chapter, sol, bank_option_sets):
    """→ (xatolar, ogohlantirishlar)."""
    errs, warns = [], []
    qid = item["id"]
    if chapter is None or sol is None:
        return [f"{qid}: canonical manbada topilmadi"], warns
    applied = chapter["answer_src"] == "reconstructed"
    if not applied and chapter["nopts"] != 0:
        errs.append(f"{qid}: savolda allaqachon {chapter['nopts']} variant bor — tiklash faqat variantsiz savolga")
    if sol["meta"].get("status") not in ("full", "theory"):
        errs.append(f"{qid}: yechim holati {sol['meta'].get('status')} — bir qiymatli emas")
    ds = item["distractors"]
    if len(ds) != 3:
        errs.append(f"{qid}: distraktorlar soni {len(ds)} (3 kerak)")
    texts = [item["correct"]] + [d["tex"] for d in ds]
    if len({norm_opt(t) for t in texts}) != 4:
        errs.append(f"{qid}: variantlar takrorlangan")
    for d in ds:
        if not d.get("why"):
            errs.append(f"{qid}: distraktor sababi yozilmagan: {d['tex']}")
    # birliklar bir xil
    units = {re.findall(r"\\mathrm\{([^}]*)\}", t)[-1] if re.findall(r"\\mathrm\{([^}]*)\}", t) else None for t in texts}
    if item.get("unit") and len(units) != 1:
        errs.append(f"{qid}: variant birliklari har xil: {units}")
    # raqamli: to'g'ri qiymat yechim natijasiga teng, distraktorlar yetarlicha uzoq
    v = item.get("value")
    if v is not None:
        vals = v if isinstance(v, list) else [v]
        res_key = sol["meta"].get("keyValue") if applied else sol["meta"].get("result")
        got = numbers_in(res_key)
        if item.get("range"):
            lo, hi = item["range"]
            ok_res = len(got) >= 2 and abs(got[0] - lo) < 1e-9 and abs(got[-1] - hi) < 1e-9
            if not ok_res or not (lo <= vals[0] <= hi):
                errs.append(f"{qid}: to‘g‘ri variant {vals[0]} yechimdagi oraliqqa [{lo}; {hi}] ({res_key!r}) mos emas")
            for d in ds:
                if d["value"] is not None and lo <= d["value"] <= hi:
                    errs.append(f"{qid}: distraktor {d['value']} ham oraliqqa tushadi — ikki to‘g‘ri javob")
        elif len(vals) == 1:
            if not any(rel(vals[0], g) <= 0.01 for g in got):
                errs.append(f"{qid}: to‘g‘ri variant qiymati {vals} yechim natijasiga ({res_key!r}) mos emas")
        elif len(got) < len(vals) or any(rel(a, b) > 0.01 for a, b in zip(vals, got)):
            errs.append(f"{qid}: to‘g‘ri variant qiymati {vals} yechim natijasiga ({res_key!r}) mos emas")
        allv = [vals] + [d["value"] if isinstance(d["value"], list) else [d["value"]] for d in ds]
        if any(x is None or None in x for x in allv):
            errs.append(f"{qid}: raqamli savolda distraktor qiymati yo‘q")
        else:
            for i in range(4):
                for j in range(i + 1, 4):
                    if all(rel(a, b) < MIN_REL_GAP for a, b in zip(allv[i], allv[j])):
                        errs.append(f"{qid}: variantlar juda yaqin: {allv[i]} ~ {allv[j]}")
    elif item.get("result_text") is not None:
        res_key = sol["meta"].get("keyValue") if applied else sol["meta"].get("result")
        if res_key != item["result_text"]:
            errs.append(f"{qid}: kutilgan natija {item['result_text']!r}, yechimda {res_key!r}")
    # boshqa savoldan ko'chirilmagan (to'liq variantlar to'plami)
    s = frozenset(norm_opt(t) for t in texts)
    if s in bank_option_sets:
        errs.append(f"{qid}: variantlar to‘plami boshqa savolda aynan bor ({bank_option_sets[s]})")
    # yechimdagi eskirgan iboralar (qo'llangandan keyin)
    if applied:
        for pat in STALE_PHRASES:
            if re.search(pat, sol["body"]):
                errs.append(f"{qid}: yechimda eskirgan ibora qoldi: /{pat}/")
    if item.get("confidence") not in ("high", "medium"):
        errs.append(f"{qid}: ishonch darajasi {item.get('confidence')} — qo‘llanmaydi")
    if item.get("confidence") == "medium" and not item.get("assumption"):
        errs.append(f"{qid}: medium ishonch uchun faraz yozilmagan")
    return errs, warns


def bank_sets(chapters, exclude=()):
    out = {}
    for sid, c in chapters.items():
        q = qid_of(c)
        if q in exclude or c["nopts"] == 0:
            continue
        env = L.OPT_ENV_RE.findall(c["tex"])
        if not env:
            continue
        items = [norm_opt(x) for x in re.split(r"\\item\b", env[-1])[1:]]
        out[frozenset(items)] = q
    return out


def validate_all(items=None, chapters=None, sols=None):
    items = items if items is not None else load_decisions()
    chapters = chapters or L.parse_chapters()
    sols = sols or L.parse_solutions()
    by_q = {qid_of(c): (sid, c) for sid, c in chapters.items()}
    ids = [i["id"] for i in items]
    errs = [f"takroriy qaror: {x}" for x in set(ids) if ids.count(x) > 1]
    banks = bank_sets(chapters, exclude=set(ids))
    for item in items:
        sid, c = by_q.get(item["id"], (None, None))
        e, _ = validate_item(item, c, sols.get(sid), banks)
        errs += e
    return errs


# ----------------------------------------------------------------------------- apply
def backup():
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = os.path.join(PRIV, "_staging", f"latex-backup-{stamp}")
    os.makedirs(dst, exist_ok=True)
    shutil.copytree(L.CHAPTERS, os.path.join(dst, "chapters"))
    os.makedirs(os.path.join(dst, "solutions_src"), exist_ok=True)
    for f in os.listdir(L.SOLDIR):
        if f.endswith(".sol") or f == "problems.json":
            shutil.copy2(os.path.join(L.SOLDIR, f), os.path.join(dst, "solutions_src", f))
    return dst


def replace_once(text, old, new, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{what}: kutilgan matn {n} marta topildi (1 kerak): {old[:80]!r}")
    return text.replace(old, new)


def apply_item(item, sid, c, sol, files):
    opts, letter = options_in_order(item)
    # --- chapters/*.tex
    path = os.path.join(L.CHAPTERS, c["file"])
    text = files.setdefault(path, open(path, encoding="utf-8").read())
    head_old = f"% Answer: {c['answer']} ({c['answer_src']}) | difficulty {c['difficulty']} | score {c['score']}"
    head_new = f"% Answer: {letter} (reconstructed) | difficulty {c['difficulty']} | score {c['score']}"
    block_old = "\\begin{masalablok}\n\\masala\n" + c["tex"] + "\n\\end{masalablok}"
    env = OPT_ENV + "\n" + "\n".join(f"    \\item {o['tex']}" for o in opts) + "\n\\end{enumerate}"
    block_new = "\\begin{masalablok}\n\\masala\n" + c["tex"] + "\n" + env + "\n\\end{masalablok}"
    seg_old = head_old + "\n" + block_old
    i = text.find(f"| id {sid} |")
    j = text.find("\\end{masalablok}", i) + len("\\end{masalablok}")
    seg = text[i:j]
    if head_old not in seg or block_old not in seg:
        raise SystemExit(f"{item['id']}: LaTeX bloki kutilgan ko‘rinishda emas")
    files[path] = text[:i] + seg.replace(head_old, head_new).replace(block_old, block_new) + text[j:]
    # --- *.sol
    spath = os.path.join(L.SOLDIR, sol["file"])
    stext = files.setdefault(spath, open(spath, encoding="utf-8").read())
    a = stext.find(f"\nid: {sid}\n")
    b = stext.find("%%% END", a)
    blk = stext[a:b]
    head, _, body = blk.partition("%%% BODY")
    old_result = sol["meta"]["result"]
    head = replace_once(head, f"\nresult: {old_result}\n",
                        f"\nresult: {letter}\nkeySource: reconstructed\nkeyValue: {old_result}\n", f"{item['id']} result")
    note = "Javob kaliti yechim asosida tiklandi (A–D variantlar qo‘shildi)."
    if item.get("assumption"):
        note += " Faraz: " + item["assumption"]
    if sol["meta"].get("note"):
        note += " Oldingi izoh: " + sol["meta"]["note"]
    head = re.sub(r"\nnote:[^\n]*\n", "\nnote: " + note.replace("\\", "\\\\") + "\n", head, count=1)
    for old, new in item.get("sol_edits", []):
        body = replace_once(body, old, new, f"{item['id']} sol_edit")
    jm = list(re.finditer(r"\\javob\{", body))
    if len(jm) != 1:
        raise SystemExit(f"{item['id']}: \\javob{{}} {len(jm)} ta")
    k0 = jm[0].end()
    depth, k = 1, k0
    while depth:
        depth += {"{": 1, "}": -1}.get(body[k], 0)
        k += 1
    content = item.get("javob") or body[k0:k - 1]
    body = body[:jm[0].start()] + "\\javob{" + f"{letter}) " + content + "}" + body[k:]
    files[spath] = stext[:a] + head + "%%% BODY" + body + stext[b:]
    # --- answers.tex (kitob jadvali)
    atext = files.setdefault(ANSWERS_TEX, open(ANSWERS_TEX, encoding="utf-8").read())
    secs = [m.start() for m in re.finditer(r"\\section\*\{", atext)] + [len(atext)]
    s0, s1 = secs[c["ch"] - 1], secs[c["ch"]]
    sec = atext[s0:s1]
    m = re.search(rf"(?m)^{c['num']}\.~(.*)\\par$", sec)
    if not m:
        raise SystemExit(f"{item['id']}: answers.tex qatori topilmadi")
    sec = sec[:m.start()] + f"{c['num']}.~{letter}$^{{*}}$\\par" + sec[m.end():]
    files[ANSWERS_TEX] = atext[:s0] + sec + atext[s1:]
    return letter


def apply_all():
    items = load_decisions()
    errs = validate_all(items)
    if errs:
        for e in errs:
            print("INVALID", e)
        sys.exit(f"Qarorlar tekshiruvdan o‘tmadi ({len(errs)}) — hech narsa yozilmadi")
    chapters, sols = L.parse_chapters(), L.parse_solutions()
    by_q = {qid_of(c): (sid, c) for sid, c in chapters.items()}
    todo = [i for i in items if by_q[i["id"]][1]["answer_src"] != "reconstructed"]
    if not todo:
        print("Barcha qarorlar allaqachon qo‘llangan.")
        return
    dst = backup()
    print("Zaxira nusxa:", os.path.relpath(dst, ROOT))
    files, applied = {}, []
    for item in todo:
        sid, c = by_q[item["id"]]
        applied.append((item["id"], apply_item(item, sid, c, sols[sid], files)))
    for path, text in files.items():
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
    print(f"Qo‘llandi: {len(applied)} ta savol;", ", ".join(f"{q}={l}" for q, l in applied[:8]), "…")
    # LaTeX → problems.json (bir yo'nalish)
    new, changed = L.sync(L.parse_chapters(), json.load(open(L.PROBLEMS, encoding="utf-8")))
    with open(L.PROBLEMS, "w", encoding="utf-8") as f:
        f.write("[\n" + ",\n".join(json.dumps(p, ensure_ascii=False, indent=0) for p in new) + "\n]")
    print(f"problems.json sync: {len(changed)} yozuv")
    post = validate_all(items)
    print("Qo‘llashdan keyingi tekshiruv:", "PASS" if not post else post[:5])
    sys.exit(1 if post else 0)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "validate"
    if cmd == "validate":
        e = validate_all()
        for x in e:
            print("INVALID", x)
        print("DECISIONS =", "PASS" if not e else f"FAIL ({len(e)})")
        sys.exit(1 if e else 0)
    if cmd == "apply":
        apply_all()
    else:
        sys.exit(f"noma'lum buyruq: {cmd}")
