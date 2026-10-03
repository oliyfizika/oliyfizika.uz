#!/usr/bin/env python3
"""
Attestatsiya -> Fizika, 2-bosqich: data preparation pipeline.

  raw source -> normalize -> validate -> canonical question bank -> daily tests -> import-ready data

Manba (faqat o'qiladi):
  attestatsiya/fizika/ATT_EST solutions/_build/solutions_src/problems.json, C*.sol
  attestatsiya/fizika/ATT_EST solutions/_build/extract/F*.qtx, map.txt
  attestatsiya/fizika/ATT_EST solutions/chapters/*.tex   (% Also in: — takror manbalar)
  attestatsiya/fizika/ATT_EST solutions/images/*.png
  docs/attestatsiya-fizika/daily_test_plan.json            (1-bosqich rejasi — SOURCE OF TRUTH, o'zgartirilmaydi)

Chiqish:
  _private/attestatsiya-fizika/            (.gitignore — hech qachon commit/deploy qilinmaydi)
      questions.public.json   questions.private.json   daily-tests.json
      firestore-import.json   validation-report.json   figures-manifest.json
      solution-figures/       (yechim chizmalari — faqat Firestore orqali beriladi)
  assets/attestatsiya-fizika/fig/<sha16>.svg|webp     (faqat savol rasmlari, javobsiz)

Rejimlar:
  --figures build   TikZ->SVG (xelatex+pdftocairo) va PNG->WebP yaratadi (TeX kerak)
  --figures reuse   (default) mavjud figures-manifest.json dan foydalanadi, fayllar mavjudligini tekshiradi
  --katex PATH      katex.js yo'li — har bir formula KaTeX bilan tekshiriladi (node kerak)

Validatsiyadan birortasi o'tmasa — skript nol bo'lmagan kod bilan to'xtaydi va import fayli YOZILMAYDI.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import plan_daily_tests as P  # noqa: E402  (1-bosqich skripti — qayta ishlatiladi, o'zgartirilmaydi)
from texconv import Converter, ConvError, walk_text, walk_figs, inline_math_segments, sha16  # noqa: E402

ROOT = P.ROOT
BOOK = os.path.join(ROOT, "attestatsiya", "fizika", "ATT_EST solutions")
PLAN = os.path.join(ROOT, "docs", "attestatsiya-fizika", "daily_test_plan.json")
PRIV = os.path.join(ROOT, "_private", "attestatsiya-fizika")
# 3-bosqich: rasmlar endi saytda ommaviy emas. Manba fayllar _private da; brauzerga faqat Firebase
# (Storage yoki Firestore figure hujjatlari) orqali, Rules tekshiruvidan keyin beriladi.
FIG_PUBLIC_DIR = os.path.join(PRIV, "figures", "question")   # savol rasmlari ("public" = published kundan keyin)
FIG_PRIVATE_DIR = os.path.join(PRIV, "figures", "solution")  # faqat yechimdagi rasmlar
STORAGE_ROOT = "attestation-physics"

SCHEMA_VERSION = 1
DEFAULT_TIME_LIMIT = None   # 3-bosqich: kunlik testlarda vaqt chegarasi YO'Q (faqat sekundomer)
SVG_MAX_BYTES = 250_000
TIMEZONE = "Asia/Tashkent"
EXPECTED = {"questions": 1027, "auto": 865, "open": 81, "unreliable": 81, "days": 32, "minQ": 26, "maxQ": 38}
# 865/81/81 — tiklashdan OLDINGI holat. Tiklangan (answer_src=reconstructed) savollar open → auto o'tadi:
#   auto = 865 + R, open = 81 − R, unreliable = 81 (o'zgarmaydi).
ANSWER_DECISIONS = os.path.join(PRIV, "answer-key", "decisions.json")

DIFFICULTY = {1: "easy", 2: "medium", 3: "hard", 4: "expert"}
DIFFICULTY_UZ = {1: "oson", 2: "o'rta", 3: "murakkab", 4: "juda murakkab"}
EVAL_MAP = {"auto": "auto", "self-check": "open", "excluded": "unreliable"}

FIG_PREAMBLE = r"""\documentclass[border=3pt]{standalone}
\usepackage{amsmath,amssymb,mathtools}
\usepackage{fontspec}
\usepackage[math-style=ISO,bold-style=ISO]{unicode-math}
\usepackage{siunitx}
\usepackage{xcolor}
\usepackage{graphicx}
\usepackage{tikz,pgfplots}
\pgfplotsset{compat=1.18}
\usepackage[european,siunitx]{circuitikz}
\usetikzlibrary{arrows.meta,calc,patterns,decorations.pathmorphing,decorations.markings,angles,quotes,positioning,shapes.geometric,3d}
\definecolor{accent}{HTML}{1F4E79}\definecolor{accentlight}{HTML}{DCE6F0}\definecolor{inkgray}{HTML}{555555}
\setlength{\textwidth}{16cm}\setlength{\linewidth}{16cm}
\begin{document}
"""


# ---------------------------------------------------------------- source loading
def load_sources():
    problems, sol_meta = P.load()          # problems.json + .sol meta + difficulty (.qtx)
    bodies = {}
    for f in sorted(glob.glob(os.path.join(P.SRC, "*.sol"))):
        for block in open(f, encoding="utf-8").read().split("%%% S ")[1:]:
            head, _, body = block.partition("%%% BODY")
            sid = re.search(r"^id:\s*(\S+)", head, re.M).group(1)
            bodies[sid] = body.split("%%% END")[0].strip()
    qtx = {}
    for f in sorted(glob.glob(os.path.join(P.SRC, "..", "extract", "F*.qtx"))):
        for block in open(f, encoding="utf-8").read().split("%%% Q")[1:]:
            head = block.split("%%% BODY")[0]
            meta = {}
            for line in head.strip().split("\n"):
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = re.split(r"\s{2,}#", v)[0].strip()
            qtx[meta["id"]] = meta
    files = {}
    for line in open(os.path.join(P.SRC, "..", "map.txt"), encoding="utf-8"):
        if "|" in line:
            code, name = line.strip().split("|", 1)
            files[code] = name
    also = {}
    for f in sorted(glob.glob(os.path.join(BOOK, "chapters", "*.tex"))):
        cur = None
        for line in open(f, encoding="utf-8"):
            m = re.match(r"% Masala (\d+)\.(\d+) \| id (\S+)", line)
            if m:
                cur = m.group(3)
                continue
            m = re.match(r"% Also in: (\S+) \| (.*?), (\S+)-savol, (\S+)-bet", line)
            if m and cur:
                also.setdefault(cur, []).append({"sourceId": m.group(1), "file": m.group(2),
                                                 "number": m.group(3), "page": m.group(4)})
    return problems, sol_meta, bodies, qtx, files, also


# ---------------------------------------------------------------- figures
class Figures:
    def __init__(self, mode):
        self.mode = mode
        self.items = OrderedDict()      # key -> {kind, source|file, scope}
        mf = os.path.join(PRIV, "figures-manifest.json")
        self.manifest = json.load(open(mf, encoding="utf-8")) if os.path.exists(mf) else {}

    def tikz(self, env, src, scope):
        key = "tikz-" + sha16(src)
        it = self.items.setdefault(key, {"kind": "tikz", "env": env, "source": src, "scopes": set()})
        it["scopes"].add(scope)
        return key

    def image(self, fname, scope):
        path = os.path.join(BOOK, "images", fname)
        if not os.path.exists(path):
            raise ConvError(f"rasm topilmadi: {fname}")
        key = "img-" + os.path.splitext(fname)[0]
        it = self.items.setdefault(key, {"kind": "png", "file": fname, "scopes": set()})
        it["scopes"].add(scope)
        return key

    def build(self):
        """TikZ -> SVG, PNG -> WebP. Fayl nomi = kontent xeshi (taxmin qilib bo'lmaydi)."""
        from PIL import Image
        os.makedirs(FIG_PUBLIC_DIR, exist_ok=True)
        os.makedirs(FIG_PRIVATE_DIR, exist_ok=True)
        tmp = tempfile.mkdtemp(prefix="attfig-")
        out, failed = {}, []
        for key, it in self.items.items():
            public = "question" in it["scopes"]
            if it["kind"] == "tikz":
                tex = FIG_PREAMBLE + it["source"] + "\n\\end{document}\n"
                d = os.path.join(tmp, key)
                os.makedirs(d)
                cache = os.path.join(PRIV, ".fig-cache", key + ".pdf")
                if os.path.exists(cache):
                    shutil.copy(cache, os.path.join(d, "f.pdf"))
                else:
                    open(os.path.join(d, "f.tex"), "w", encoding="utf-8").write(tex)
                    r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error", "f.tex"],
                                       cwd=d, capture_output=True, text=True, timeout=120)
                    if r.returncode != 0 or not os.path.exists(os.path.join(d, "f.pdf")):
                        failed.append((key, [l for l in r.stdout.split("\n") if l.startswith("!")][:3]))
                        continue
                    os.makedirs(os.path.dirname(cache), exist_ok=True)
                    shutil.copy(os.path.join(d, "f.pdf"), cache)
                subprocess.run(["pdftocairo", "-svg", "f.pdf", "f.svg"], cwd=d, check=True)
                data = open(os.path.join(d, "f.svg"), "rb").read()
                ext, mime = "svg", "image/svg+xml"
                m = re.search(rb'width="([\d.]+)(?:pt)?" height="([\d.]+)(?:pt)?"', data)
                w, h = (float(m.group(1)), float(m.group(2))) if m else (None, None)
                if len(data) > SVG_MAX_BYTES:
                    # Soyalash/naqshlar SVG ni shishiradi -> yuqori sifatli rastr (WebP)
                    subprocess.run(["pdftocairo", "-png", "-r", "220", "-singlefile", "f.pdf", "f"],
                                   cwd=d, check=True)
                    im = Image.open(os.path.join(d, "f.png"))
                    im.load()
                    from io import BytesIO
                    bio = BytesIO()
                    im.save(bio, "WEBP", quality=88, method=6)
                    data, ext, mime = bio.getvalue(), "webp", "image/webp"
            else:
                im = Image.open(os.path.join(BOOK, "images", it["file"]))
                im.load()
                if im.width > 1400:
                    im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
                if im.mode not in ("RGB", "RGBA"):
                    im = im.convert("RGBA")
                from io import BytesIO
                bio = BytesIO()
                im.save(bio, "WEBP", quality=86, method=6)
                data, ext, mime = bio.getvalue(), "webp", "image/webp"
                w, h = im.width, im.height
            name = sha16(data) + "." + ext
            target = FIG_PUBLIC_DIR if public else FIG_PRIVATE_DIR
            open(os.path.join(target, name), "wb").write(data)
            out[key] = {"file": name, "public": public, "mime": mime, "bytes": len(data),
                        "width": round(w, 1) if w else None, "height": round(h, 1) if h else None,
                        "kind": it["kind"], "sourceHash": sha16(it.get("source", it.get("file", "")))}
        shutil.rmtree(tmp, ignore_errors=True)
        if failed:
            for k, e in failed:
                print("FIGURE FAIL", k, e)
            sys.exit(f"{len(failed)} ta chizma kompilyatsiya bo'lmadi")
        self.manifest = out
        json.dump(out, open(os.path.join(PRIV, "figures-manifest.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1, sort_keys=True)

    def resolve(self, key):
        m = self.manifest.get(key)
        if not m:
            return None
        # Blokda faqat kontent-xesh fayl nomi; joylashuv (Storage/Firestore yo'li) testId bo'yicha frontendda
        return {"id": m["file"], "w": m["width"], "h": m["height"]}


def attach_figures(blocks, figs, missing):
    for b in blocks:
        if b["t"] == "figure":
            r = figs.resolve(b["fig"])
            if r is None:
                missing.append(b["fig"])
            else:
                b.update(r)
        for k in ("blocks",):
            if k in b:
                attach_figures(b[k], figs, missing)
        if b["t"] == "list":
            for it in b["items"]:
                attach_figures(it, figs, missing)
        if b["t"] == "table":
            for row in b["rows"]:
                for c in row:
                    attach_figures(c["blocks"], figs, missing)


# ---------------------------------------------------------------- Firestore serializatsiya (canonical)
# Firestore massiv ichida massivni saqlamaydi ("Nested arrays are not supported"). Ichki (texconv) format:
#   list : {"t":"list",  "items": [[Block…], …]}
#   table: {"t":"table", "rows":  [[Cell…], …]}        Cell = {"blocks":[Block…], "colspan"?}
# Firestore'ga ketadigan YAGONA canonical shakl (public savol, private javob, versions, solutions — hammasi shu):
#   list : {"t":"list",  "items": [{"blocks": [Block…]}, …]}
#   table: {"t":"table", "rows":  [{"cells": [Cell…]}, …]}
# Faqat konteyner shakli o'zgaradi: matn, formula, variant, javob, yechim, ID — bayt-bayt o'sha.
# Transform idempotent (allaqachon canonical bo'lsa o'zgarmaydi); legacy_blocks — teskari transform (tekshiruv uchun).
def fs_canonical(v):
    if isinstance(v, list):
        return [fs_canonical(x) for x in v]
    if not isinstance(v, dict):
        return v
    out = OrderedDict()
    for k, x in v.items():
        if v.get("t") == "list" and k == "items" and isinstance(x, list):
            out[k] = [OrderedDict([("blocks", fs_canonical(it))]) if isinstance(it, list) else fs_canonical(it) for it in x]
        elif v.get("t") == "table" and k == "rows" and isinstance(x, list):
            out[k] = [OrderedDict([("cells", fs_canonical(r))]) if isinstance(r, list) else fs_canonical(r) for r in x]
        else:
            out[k] = fs_canonical(x)
    return out


def legacy_blocks(v):
    if isinstance(v, list):
        return [legacy_blocks(x) for x in v]
    if not isinstance(v, dict):
        return v
    out = OrderedDict()
    for k, x in v.items():
        if v.get("t") == "list" and k == "items" and isinstance(x, list):
            out[k] = [legacy_blocks(it["blocks"]) if isinstance(it, dict) else legacy_blocks(it) for it in x]
        elif v.get("t") == "table" and k == "rows" and isinstance(x, list):
            out[k] = [legacy_blocks(r["cells"]) if isinstance(r, dict) else legacy_blocks(r) for r in x]
        else:
            out[k] = legacy_blocks(x)
    return out


def nested_array_paths(v, path="", in_array=False):
    """Firestore qoidasi: massivning bevosita elementi massiv bo'lishi mumkin emas."""
    found = []
    if isinstance(v, list):
        if in_array:
            found.append(path)
        for i, x in enumerate(v):
            found += nested_array_paths(x, f"{path}[{i}]", True)
    elif isinstance(v, dict):
        for k, x in v.items():
            found += nested_array_paths(x, f"{path}.{k}" if path else k, False)
    return found


def plain_text(blocks):
    """Bloklarning to'liq matni (p/heading/math/list/table/figure; ikkala format ham) — mazmun tengligini tekshirish uchun."""
    out = []

    def walk(bs):
        for b in bs or []:
            if not isinstance(b, dict):
                continue
            if b.get("text"):
                out.append(b["text"])
            if b.get("t") == "math":
                out.append("$$" + b.get("tex", "") + "$$")
            if b.get("t") == "figure":
                out.append("[fig:" + str(b.get("id") or b.get("fig")) + "]")
            if "blocks" in b:
                walk(b["blocks"])
            for it in b.get("items", []) if b.get("t") == "list" else []:
                walk(it["blocks"] if isinstance(it, dict) else it)
            for r in b.get("rows", []) if b.get("t") == "table" else []:
                for c in (r["cells"] if isinstance(r, dict) else r):
                    walk(c.get("blocks"))
    walk(blocks)
    return "\n".join(out)


def question_plain_text(pubq, privq):
    parts = [plain_text(pubq["question"])]
    parts += [o["key"] + ") " + plain_text(o["blocks"]) for o in pubq.get("options", [])]
    parts.append(plain_text(privq.get("solution")))
    return "\n§\n".join(parts)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--figures", choices=["build", "reuse"], default="reuse")
    default_katex = os.path.join(PRIV, "vendor", "katex.min.js")
    ap.add_argument("--katex", default=os.environ.get("KATEX_JS") or (default_katex if os.path.exists(default_katex) else None))
    args = ap.parse_args()

    problems, sol_meta, bodies, qtx, files, also = load_sources()
    plan = json.load(open(PLAN, encoding="utf-8"))
    errors, warnings = [], []

    def check(cond, msg):
        if not cond:
            errors.append(msg)
        return cond

    # ---- plan (1-bosqich) o'zgarmaganini tekshirish
    plan_hash = hashlib.sha256(json.dumps([d["questionIds"] for d in plan["days"]]).encode()).hexdigest()[:16]
    check(plan_hash == plan["planHash"], f"planHash mos emas: {plan_hash} != {plan['planHash']}")
    day_of = {}
    for d in plan["days"]:
        for pos, q in enumerate(d["questionIds"]):
            check(q not in day_of, f"savol ikki kunda: {q}")
            day_of[q] = (d, pos)

    figs = Figures(args.figures)
    conv = Converter(None, None)
    pub, priv = OrderedDict(), OrderedDict()
    for p in sorted(problems, key=lambda p: (p["ch"], p["num"])):
        qid = P.qid(p)
        s = sol_meta.get(p["id"])
        check(s is not None, f"yechim yo'q: {p['id']}")
        check(p["id"] in bodies, f"yechim tanasi yo'q: {p['id']}")
        check(s["bookNumber"] == f"{p['ch']}.{p['num']}", f"kitob raqami mos emas: {p['id']} {s['bookNumber']}")
        q = qtx.get(p["id"], {})
        check(p["difficulty"] in DIFFICULTY, f"qiyinlik noma'lum: {p['id']}")
        scoring, note = P.scoring_of(p, s)
        ev = EVAL_MAP[scoring]
        d, pos = day_of.get(qid, (None, None))
        check(d is not None, f"rejada yo'q: {qid}")
        try:
            conv.figure_cb = lambda env, src: figs.tikz(env, src, "question")
            conv.image_cb = lambda f: figs.image(f, "question")
            qblocks, opts = conv.blocks(p["tex"], allow_options=True)
            conv.figure_cb = lambda env, src: figs.tikz(env, src, "solution")
            conv.image_cb = lambda f: figs.image(f, "solution")
            sblocks = conv.blocks(bodies[p["id"]], solution=True)
        except ConvError as e:
            errors.append(f"{qid} ({p['id']}): {e}")
            continue
        opts = opts or []
        check(len(opts) == p["nopts"], f"{qid}: variantlar soni {len(opts)} != {p['nopts']}")
        letters = "ABCDE"[:len(opts)]
        correct = s["result"] if ev == "auto" else None
        if ev == "auto":
            check(correct in letters, f"{qid}: auto savol javobi variantlarda yo'q ({correct})")
        if ev == "open":
            check(len(opts) == 0, f"{qid}: open savolda variant bor")
        src_code = p["id"].split("-")[0]
        pub[qid] = OrderedDict([
            ("id", qid),
            ("schemaVersion", SCHEMA_VERSION),
            ("section", P.SECTIONS[p["ch"]][0]),
            ("sectionTitle", P.SECTIONS[p["ch"]][1]),
            ("topic", p["section"]),
            ("type", p["type"]),
            ("evaluationType", ev),
            ("difficulty", DIFFICULTY[p["difficulty"]]),
            ("difficultyLevel", p["difficulty"]),
            ("question", qblocks),
            ("options", [OrderedDict([("key", letters[k]), ("blocks", ob)]) for k, ob in enumerate(opts)]),
            ("optionCount", len(opts)),
            ("testId", d["id"] if d else None),
            ("dayNumber", d["dayNumber"] if d else None),
            ("position", pos + 1 if d else None),
            ("bookNumber", f"{p['ch']}.{p['num']}"),
            ("contentVersion", 1),
        ])
        priv[qid] = OrderedDict([
            ("id", qid),
            ("evaluationType", ev),
            ("evaluationNote", note),
            ("correctAnswer", correct),
            # valid — manba/kitob kaliti tasdiqlangan; reconstructed — yechimdan tiklangan; TEKSHIRISH_KERAK — kalit yo'q
            ("keyStatus", ("reconstructed" if p.get("answer_src") == "reconstructed" else "valid") if ev == "auto"
             else "TEKSHIRISH_KERAK"),
            # Tiklangan kalit kitob/manba kaliti emas — bookAnswer bo'sh qoladi (asl qiymat .sol keyValue'da)
            ("bookAnswer", None if p["answer"] in ("none", "") or p.get("answer_src") == "reconstructed" else p["answer"]),
            ("solutionResult", s.get("result")),
            ("solution", sblocks),
            ("solutionStatus", s["status"]),
            ("verify", s.get("verify") or None),
            ("source", OrderedDict([
                ("sourceId", p["id"]),
                ("code", src_code),
                ("file", files.get(src_code)),
                ("number", q.get("src_no")),
                ("page", q.get("page")),
                ("taxonomy", q.get("section")),
                ("alsoIn", also.get(p["id"], [])),
            ])),
            ("difficultyRaw", OrderedDict([("level", p["difficulty"]), ("labelUz", DIFFICULTY_UZ[p["difficulty"]]),
                                           ("score", q.get("score"))])),
            ("review", OrderedDict([("check", p.get("check") or None), ("fixes", p.get("fixes") or None),
                                    ("answerSource", p.get("answer_src")), ("note", s.get("note") or None),
                                    ("category", s.get("category") or None)])),
            ("contentVersion", 1),
        ])
    conv_errors = len(errors)
    if conv_errors:
        for e in errors[:60]:
            print("ERR", e)
        sys.exit(f"KONVERTATSIYA XATOSI ({conv_errors}) — to'xtatildi, hech narsa yozilmadi")

    # ---- figures
    if args.figures == "build" and not conv_errors:
        figs.build()
    missing = []
    for qid in pub:
        attach_figures(pub[qid]["question"], figs, missing)
        for o in pub[qid]["options"]:
            attach_figures(o["blocks"], figs, missing)
        attach_figures(priv[qid]["solution"], figs, missing)
    check(not missing, f"rasmlar topilmadi: {sorted(set(missing))[:10]} ({len(set(missing))})")
    for key, m in figs.manifest.items():
        path = os.path.join(FIG_PUBLIC_DIR if m["public"] else FIG_PRIVATE_DIR, m["file"])
        check(os.path.exists(path) and os.path.getsize(path) == m["bytes"], f"rasm fayli yo'q/buzilgan: {m['file']}")
    # Savolda ishlatilgan rasm public, faqat yechimdagi rasm — private
    for key, it in figs.items.items():
        m = figs.manifest.get(key)
        if m:
            check(m["public"] == ("question" in it["scopes"]), f"rasm ko'rinish doirasi noto'g'ri: {key}")

    # ---- matn tekshiruvi: konvertatsiyadan keyin LaTeX makrolar qolmasligi kerak
    math_all = []
    for qid in pub:
        groups = [pub[qid]["question"]] + [o["blocks"] for o in pub[qid]["options"]] + [priv[qid]["solution"]]
        for g in groups:
            for kind, val in walk_text(g):
                if kind == "math":
                    math_all.append((qid, "display", val))
                else:
                    stripped = re.sub(r"\$(?:\\.|[^$\\])*\$", "", val)
                    if re.search(r"\\[a-zA-Z]", stripped):
                        errors.append(f"{qid}: matnda LaTeX qoldi: {stripped[:80]!r}")
                    for m in inline_math_segments(val):
                        math_all.append((qid, "inline", m))

    # ---- KaTeX
    katex_report = {"checked": 0, "failed": []}
    if args.katex:
        payload = json.dumps([[q, k, t] for q, k, t in math_all])
        js = r"""
const katex = require(process.argv[1]); let buf='';
process.stdin.on('data', d => buf += d).on('end', () => {
  const items = JSON.parse(buf); const bad = [];
  for (const [q, k, t] of items) {
    try { katex.renderToString(t, {displayMode: k === 'display', throwOnError: true, strict: 'ignore', trust: false}); }
    catch (e) { bad.push([q, t.slice(0, 120), String(e.message).slice(0, 160)]); }
  }
  process.stdout.write(JSON.stringify(bad));
});"""
        r = subprocess.run(["node", "-e", js, os.path.abspath(args.katex)], input=payload,
                           capture_output=True, text=True, timeout=300)
        if r.returncode != 0:
            errors.append("KaTeX tekshiruvi ishga tushmadi: " + r.stderr[:300])
        else:
            bad = json.loads(r.stdout)
            katex_report = {"checked": len(math_all), "failed": bad}
            for q, t, e in bad:
                errors.append(f"{q}: KaTeX xato: {t!r} — {e}")
    else:
        warnings.append("KaTeX tekshiruvi o'tkazilmadi (--katex berilmagan)")

    # ---- Daily Tests (reja o'zgarmaydi)
    tests, versions, keys, solutions = [], {}, {}, {}
    for d in plan["days"]:
        qids = d["questionIds"]
        evs = [pub[q]["evaluationType"] for q in qids if q in pub]
        secs = {pub[q]["section"] for q in qids if q in pub}
        check(len(secs) == 1 and d["section"] in secs, f"Day {d['dayNumber']}: bir nechta bo'lim {secs}")
        check(EXPECTED["minQ"] <= len(qids) <= EXPECTED["maxQ"], f"Day {d['dayNumber']}: {len(qids)} savol")
        tid = d["id"]
        test = OrderedDict([
            ("id", tid),
            ("course", "fizika"),
            ("schemaVersion", SCHEMA_VERSION),
            ("dayNumber", d["dayNumber"]),
            ("section", d["section"]),
            ("sectionTitle", d["sectionTitle"]),
            ("topics", d["topics"]),
            ("topicParts", d["topicParts"]),
            ("questionIds", qids),
            ("questionCount", len(qids)),
            # Statistika uchun (maxfiy emas): har bir savolning mavzu indeksi (topics[]) va baholash turi
            ("questionTopicIdx", [d["topics"].index(pub[q]["topic"]) for q in qids]),
            ("questionEval", [pub[q]["evaluationType"][0] for q in qids]),   # a=auto, o=open, u=unreliable
            ("scorableCount", evs.count("auto")),
            ("openCount", evs.count("open")),
            ("unreliableCount", evs.count("unreliable")),
            ("difficulty", d["difficulty"]),
            ("bookRange", d["bookRange"]),
            ("status", "draft"),
            ("published", False),
            ("publishAt", None),
            ("publishedAt", None),
            ("publishedBy", None),
            ("solutionAvailableAt", None),
            ("archivedAt", None),
            ("timeLimitSeconds", DEFAULT_TIME_LIMIT),
            ("currentVersion", 1),
            ("planHash", plan["planHash"]),
            ("notification", OrderedDict([
                ("title", "Bugungi attestatsiya testi tayyor!"),
                ("body", f"Day {d['dayNumber']} · " + ", ".join(d["topics"]) + f" · {len(qids)} savol"),
                ("href", f"attestatsiya/fizikaattestatsiya.html?day={d['dayNumber']}"),
            ])),
        ])
        tests.append(test)
        versions[tid] = OrderedDict([
            ("testId", tid), ("version", 1), ("dayNumber", d["dayNumber"]), ("questionIds", qids),
            ("questions", [OrderedDict((k, v) for k, v in pub[q].items()
                                       if k not in ("testId", "dayNumber", "schemaVersion")) for q in qids]),
        ])
        keys[tid] = OrderedDict([
            ("testId", tid), ("version", 1), ("questionIds", qids),
            # FAQAT auto savollar: {questionId: harf}. open/unreliable — kalitda yo'q (ballga kirmaydi).
            ("answers", OrderedDict((q, priv[q]["correctAnswer"]) for q in qids
                                    if pub[q]["evaluationType"] == "auto")),
            ("scorableCount", evs.count("auto")),
        ])
        solutions[tid] = OrderedDict([
            ("testId", tid), ("version", 1), ("questionIds", qids),
            ("items", [OrderedDict([("id", q), ("evaluationType", priv[q]["evaluationType"]),
                                    ("correctAnswer", priv[q]["correctAnswer"]),
                                    ("solutionResult", priv[q]["solutionResult"]),
                                    ("solutionStatus", priv[q]["solutionStatus"]),
                                    ("solution", priv[q]["solution"])]) for q in qids]),
        ])

    # ---- rasmlar: har bir test uchun (Storage yo'li yoki Firestore figure hujjati)
    fig_by_file = {m["file"]: m for m in figs.manifest.values()}
    test_figs = {}
    for t in tests:
        qf, sf = set(), set()
        for q in t["questionIds"]:
            for g in [pub[q]["question"]] + [o["blocks"] for o in pub[q]["options"]]:
                qf |= {figs.manifest[k]["file"] for k in walk_figs(g)}
            sf |= {figs.manifest[k]["file"] for k in walk_figs(priv[q]["solution"])}
        # Yechim sahifasi yechim bloklarini "solution" doirasidan oladi — savoldagi rasm yechimda ham ishlatilsa,
        # u solutionFigures/solutions ga ham yoziladi (avval sf − qf edi: 20 ta havola topilmasdi).
        test_figs[t["id"]] = {"question": sorted(qf), "solution": sorted(sf)}
        t["figureCount"] = len(qf)

    # Rasm to'plamlari xotirada quriladi; fayllar faqat barcha gate'lar o'tgandan keyin yoziladi
    import base64
    upload, fig_ops, fig_copies = [], [], []
    for tid, groups in test_figs.items():
        for scope, files in groups.items():
            folder = "questions" if scope == "question" else "solutions"
            for f in files:
                m = fig_by_file[f]
                src = os.path.join(FIG_PUBLIC_DIR if m["public"] else FIG_PRIVATE_DIR, f)
                rel = f"{STORAGE_ROOT}/{folder}/{tid}/{f}"
                fig_copies.append((src, rel))
                upload.append({"path": rel, "mime": m["mime"], "bytes": m["bytes"], "testId": tid, "scope": scope})
                data = base64.b64encode(open(src, "rb").read()).decode()
                col = "figures" if scope == "question" else "solutionFigures"
                fig_ops.append({"op": "create", "path": f"attestationPhysicsDailyTests/{tid}/{col}/{f}",
                                "data": {"testId": tid, "id": f, "mime": m["mime"], "bytes": m["bytes"], "data": data}})

    # ---- umumiy validatsiya
    ids = list(pub)
    ev_count = Counter(pub[q]["evaluationType"] for q in pub)
    assigned = [q for t in tests for q in t["questionIds"]]
    results = OrderedDict()

    def gate(name, ok, detail=""):
        results[name] = {"pass": bool(ok), "detail": detail}
        if not ok:
            errors.append(f"VALIDATION FAIL: {name} {detail}")

    gate("questions_total_1027", len(pub) == EXPECTED["questions"], str(len(pub)))
    gate("unique_ids_1027", len(set(ids)) == EXPECTED["questions"], str(len(set(ids))))
    gate("missing_ids_0", not (set(day_of) - set(pub)), str(sorted(set(day_of) - set(pub))[:5]))
    gate("duplicate_ids_0", len(ids) == len(set(ids)))
    n_rec = sum(1 for q in priv if priv[q]["keyStatus"] == "reconstructed")
    gate("eval_auto_865_plus_reconstructed", ev_count["auto"] == EXPECTED["auto"] + n_rec, f"{ev_count['auto']} = 865 + {n_rec}")
    gate("eval_open_81_minus_reconstructed", ev_count["open"] == EXPECTED["open"] - n_rec, f"{ev_count['open']} = 81 − {n_rec}")
    gate("eval_unreliable_81", ev_count["unreliable"] == EXPECTED["unreliable"], str(ev_count["unreliable"]))
    gate("eval_sum_1027", sum(ev_count.values()) == EXPECTED["questions"])
    gate("daily_tests_32", len(tests) == EXPECTED["days"], str(len(tests)))
    gate("assigned_1027", len(assigned) == EXPECTED["questions"], str(len(assigned)))
    gate("duplicate_assignment_0", len(assigned) == len(set(assigned)))
    gate("unassigned_0", set(assigned) == set(pub), str(sorted(set(pub) - set(assigned))[:5]))
    gate("all_question_ids_in_bank", all(q in pub for q in assigned))
    gate("keys_auto_only", sum(len(k["answers"]) for k in keys.values()) == ev_count["auto"]
         and all(len(keys[t]["answers"]) == keys[t]["scorableCount"] for t in keys))
    gate("tests_26_38", all(EXPECTED["minQ"] <= t["questionCount"] <= EXPECTED["maxQ"] for t in tests))
    gate("tests_one_section", all(len({pub[q]["section"] for q in t["questionIds"]}) == 1 for t in tests))
    gate("day_numbers_1_32", [t["dayNumber"] for t in tests] == list(range(1, 33)))
    gate("plan_unchanged", plan_hash == plan["planHash"], plan_hash)
    gate("auto_has_valid_answer", all(priv[q]["correctAnswer"] in "ABCDE"[:pub[q]["optionCount"]]
                                      for q in pub if pub[q]["evaluationType"] == "auto"))
    gate("non_auto_not_scored", all(priv[q]["correctAnswer"] is None for q in pub
                                    if pub[q]["evaluationType"] != "auto"))
    gate("every_question_has_solution", all(priv[q]["solution"] for q in priv))
    gate("difficulty_mapped", all(pub[q]["difficulty"] in DIFFICULTY.values() for q in pub))
    gate("source_traceable", all(priv[q]["source"]["file"] and priv[q]["source"]["number"] for q in priv))
    # Public ma'lumotda javob/yechim bo'lmasligi
    leak_keys = {"correctAnswer", "solution", "bookAnswer", "solutionResult", "answers", "review", "verify"}

    def keys_of(o):
        if isinstance(o, dict):
            for k, v in o.items():
                yield k
                yield from keys_of(v)
        elif isinstance(o, list):
            for v in o:
                yield from keys_of(v)
    pub_keys = set(keys_of(list(pub.values()))) | set(keys_of(list(versions.values()))) | set(keys_of(tests))
    gate("public_has_no_answer_fields", not (pub_keys & leak_keys), str(pub_keys & leak_keys))
    gate("public_figures_only_from_questions",
         all(figs.manifest[k]["public"] for q in pub for g in [pub[q]["question"]] + [o["blocks"] for o in pub[q]["options"]]
             for k in walk_figs(g) if k in figs.manifest))
    gate("conversion_errors_0", conv_errors == 0, str(conv_errors))
    gate("katex_all_formulas_ok", bool(args.katex) and not katex_report["failed"],
         f"{katex_report['checked']} formula, {len(katex_report['failed'])} xato")

    # ---- Firestore canonical serializatsiya (bitta transform — barcha Firestore hujjatlari uchun)
    fpub = OrderedDict((q, fs_canonical(pub[q])) for q in pub)
    fpriv = OrderedDict((q, fs_canonical(priv[q])) for q in priv)
    fversions = OrderedDict((tid, fs_canonical(versions[tid])) for tid in versions)
    fsolutions = OrderedDict((tid, fs_canonical(solutions[tid])) for tid in solutions)
    fkeys = OrderedDict((tid, fs_canonical(keys[tid])) for tid in keys)
    ftests = [fs_canonical(t) for t in tests]

    # ---- Firestore hujjat o'lchamlari (1 MiB chegara, zaxira bilan 900 KB)
    sizes = {}
    for tid in fversions:
        for name, doc in (("versions", fversions[tid]), ("keys", fkeys[tid]), ("solutions", fsolutions[tid])):
            sizes[f"{tid}/{name}/v1"] = len(json.dumps(doc, ensure_ascii=False).encode())
    gate("firestore_doc_size_ok", max(sizes.values()) < 900_000, f"max {max(sizes.values())} bayt")

    settings = OrderedDict([
        ("accessMode", "open"),
        ("timezone", TIMEZONE),
        ("utcOffsetMinutes", 300),
        ("totalDays", len(tests)),
        ("defaultTimeLimitSeconds", None),
        ("timeLimit", "none"),
        ("figureBackend", "storage"),
        ("storageRoot", STORAGE_ROOT),
        ("solutionRelease", "nextCourseDayMidnight"),
        ("officialAttemptsPerTest", 1),
        ("schemaVersion", SCHEMA_VERSION),
        ("planHash", plan["planHash"]),
    ])

    # Firestore import rejasi: deterministik yo'llar, faqat create/set (delete yo'q). Faqat canonical (f*) hujjatlar.
    ops = [{"op": "set", "path": "attestationPhysicsSettings/config", "data": settings}]
    for q in fpub:
        ops.append({"op": "set", "path": f"attestationPhysicsQuestions/{q}", "data": fpub[q]})
        ops.append({"op": "set", "path": f"attestationPhysicsQuestions/{q}/private/answer", "data": fpriv[q]})
    for t in ftests:
        tid = t["id"]
        ops.append({"op": "set", "path": f"attestationPhysicsDailyTests/{tid}", "data": t})
        ops.append({"op": "create", "path": f"attestationPhysicsDailyTests/{tid}/versions/v1", "data": fversions[tid]})
        ops.append({"op": "create", "path": f"attestationPhysicsDailyTests/{tid}/keys/v1", "data": fkeys[tid]})
        ops.append({"op": "create", "path": f"attestationPhysicsDailyTests/{tid}/solutions/v1", "data": fsolutions[tid]})

    nested = [f"{o['path']}:{p}" for o in ops for p in nested_array_paths(o["data"])]
    gate("firestore_no_nested_arrays", not nested, f"{len(nested)} ta" + (f" · {nested[:3]}" if nested else ""))
    # Teskari transform asl (ichki) hujjatni bayt-bayt qaytarishi shart — mazmun o'zgarmaganining eng qat'iy isboti
    pairs = ([(pub[q], fpub[q]) for q in pub] + [(priv[q], fpriv[q]) for q in priv]
             + [(versions[t], fversions[t]) for t in versions] + [(solutions[t], fsolutions[t]) for t in solutions]
             + [(keys[t], fkeys[t]) for t in keys] + list(zip(tests, ftests)))
    same = lambda a, b: json.dumps(a, ensure_ascii=False, sort_keys=True) == json.dumps(b, ensure_ascii=False, sort_keys=True)
    gate("canonical_roundtrip_exact", all(same(legacy_blocks(f), o) for o, f in pairs), f"{len(pairs)} hujjat")
    pt_ok = sum(question_plain_text(pub[q], priv[q]) == question_plain_text(fpub[q], fpriv[q]) for q in pub)
    gate("plaintext_preserved_1027", pt_ok == len(pub) == EXPECTED["questions"], f"{pt_ok}/{len(pub)}")
    vq = {qq["id"]: qq for v in fversions.values() for qq in v["questions"]}
    sq = {it["id"]: it for v in fsolutions.values() for it in v["items"]}
    gate("versions_solutions_match_bank",
         all(same(vq[q]["question"], fpub[q]["question"]) and same(vq[q]["options"], fpub[q]["options"]) for q in fpub)
         and all(same(sq[q]["solution"], fpriv[q]["solution"]) for q in fpriv if q in sq),
         f"versions {len(vq)}, solutions {len(sq)}")

    # ---- Answer key (G, H, I)
    gate("answer_key_valid", all(priv[q]["correctAnswer"] in "ABCDE"[:pub[q]["optionCount"]]
                                 and priv[q]["keyStatus"] in ("valid", "reconstructed")
                                 for q in pub if pub[q]["evaluationType"] == "auto"))
    unresolved = [q for q in pub if pub[q]["evaluationType"] != "auto"]
    gate("unresolved_marked_TEKSHIRISH_KERAK", all(priv[q]["keyStatus"] == "TEKSHIRISH_KERAK" and priv[q]["correctAnswer"] is None
                                                  for q in unresolved), f"{len(unresolved)} savol")
    if os.path.exists(ANSWER_DECISIONS):
        import answer_keys as AK
        decisions = AK.load_decisions(ANSWER_DECISIONS)
        dec_errs = AK.validate_all(decisions)
        gate("distractors_validated", not dec_errs, f"{len(decisions)} qaror" + (f" · {dec_errs[:2]}" if dec_errs else ""))
        rec_ids = {q for q in priv if priv[q]["keyStatus"] == "reconstructed"}
        gate("reconstructed_equals_decisions", rec_ids == {d["id"] for d in decisions}, f"{len(rec_ids)}/{len(decisions)}")
        bad = []
        for d in decisions:
            opts, letter = AK.options_in_order(d)
            q = pub.get(d["id"])
            got = [o["blocks"] for o in q["options"]] if q else []
            want = [conv.blocks(o["tex"]) for o in opts]
            if not q or priv[d["id"]]["correctAnswer"] != letter or plain_text(sum(got, [])) != plain_text(sum(want, [])):
                bad.append(d["id"])
        gate("reconstruction_reaches_bundle", not bad, f"{len(decisions) - len(bad)}/{len(decisions)}" + (f" · {bad[:3]}" if bad else ""))
    else:
        warnings.append("answer-key decisions.json yo'q — tiklash gate'lari o'tkazib yuborildi")

    # ---- Rasm havolalari va render ma'lumotlari (J, K)
    def fig_ids(bs, out):
        for b in bs or []:
            if b.get("t") == "figure":
                out.append((b.get("id"), b.get("w"), b.get("h")))
            fig_ids(b.get("blocks"), out)
            for it in b.get("items", []) if b.get("t") == "list" else []:
                fig_ids(it["blocks"] if isinstance(it, dict) else it, out)
            for r in b.get("rows", []) if b.get("t") == "table" else []:
                for c in (r["cells"] if isinstance(r, dict) else r):
                    fig_ids(c.get("blocks"), out)
        return out
    have = {tuple(o["path"].split("/")[1:4]) for o in fig_ops}
    ref_total, ref_missing, ref_badmeta = 0, [], []
    for t in ftests:
        tid = t["id"]
        for qq in fversions[tid]["questions"]:
            for fid, w, h in fig_ids(qq["question"], []) + [x for o in qq["options"] for x in fig_ids(o["blocks"], [])]:
                ref_total += 1
                if (tid, "figures", fid) not in have:
                    ref_missing.append(f"{qq['id']}:{fid}")
                if not (fid and w and h):
                    ref_badmeta.append(f"{qq['id']}:{fid}")
        for it in fsolutions[tid]["items"]:
            for fid, w, h in fig_ids(it["solution"], []):
                ref_total += 1
                if (tid, "solutionFigures", fid) not in have:
                    ref_missing.append(f"{it['id']}:sol:{fid}")
                if not (fid and w and h):
                    ref_badmeta.append(f"{it['id']}:{fid}")
    gate("image_refs_resolved", not ref_missing and not ref_badmeta,
         f"{ref_total} havola · topilmadi {len(ref_missing)} · meta {len(ref_badmeta)}" + (f" · {ref_missing[:3]}" if ref_missing else ""))
    SIG = {"image/webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP", "image/png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
           "image/svg+xml": lambda b: b.lstrip()[:5] in (b"<?xml", b"<svg ") or b.lstrip()[:4] == b"<svg"}
    bad_data = []
    for o in fig_ops:
        d = o["data"]
        raw = base64.b64decode(d["data"])
        size = len(json.dumps(d))
        if len(raw) != d["bytes"] or not SIG.get(d["mime"], lambda b: False)(raw) or size > 1_000_000:
            bad_data.append(o["path"])
    gate("image_render_data_valid", not bad_data,
         f"{len(fig_ops)} hujjat · max {max(len(json.dumps(o['data'])) for o in fig_ops)} bayt" + (f" · {bad_data[:3]}" if bad_data else ""))

    # ---- LaTeX ↔ JSON (L)
    import latex_canonical as LC
    lc_errs = LC.compare(LC.parse_chapters(), problems)
    gate("LATEX_JSON_CONSISTENCY", not lc_errs, f"{len(problems)} savol" + (f" · {lc_errs[:2]}" if lc_errs else ""))

    report = OrderedDict([
        ("status", "PASS" if not errors else "FAIL"),
        ("summary", OrderedDict([
            ("questions", len(pub)), ("dailyTests", len(tests)),
            ("auto", ev_count["auto"]), ("open", ev_count["open"]), ("unreliable", ev_count["unreliable"]),
            ("assigned", len(assigned)), ("missing", len(set(pub) - set(assigned))),
            ("duplicates", len(assigned) - len(set(assigned))),
            ("figures", Counter(("public" if m["public"] else "private") + ":" + m["kind"]
                                for m in figs.manifest.values())),
            ("formulas", len(math_all)),
        ])),
        ("gates", results),
        ("tests", [OrderedDict([("dayNumber", t["dayNumber"]), ("id", t["id"]), ("section", t["section"]),
                                ("questionCount", t["questionCount"]), ("scorable", t["scorableCount"]),
                                ("open", t["openCount"]), ("unreliable", t["unreliableCount"]),
                                ("topics", t["topics"])]) for t in tests]),
        ("docSizesTop", sorted(sizes.items(), key=lambda x: -x[1])[:5]),
        ("katex", katex_report),
        ("warnings", warnings + conv.warnings),
        ("errors", errors[:200]),
    ])
    os.makedirs(PRIV, exist_ok=True)
    dump = lambda name, obj: json.dump(obj, open(os.path.join(PRIV, name), "w", encoding="utf-8"),
                                       ensure_ascii=False, indent=1)
    dump("validation-report.json", report)
    print(json.dumps(report["summary"], ensure_ascii=False))
    for k, v in results.items():
        print(("PASS " if v["pass"] else "FAIL ") + k + (f"  ({v['detail']})" if v["detail"] else ""))
    if errors:
        for e in errors[:40]:
            print("ERR", e)
        sys.exit(f"VALIDATION FAIL ({len(errors)} xato) — import fayllari yozilmadi")

    dump("questions.public.json", list(fpub.values()))
    dump("questions.private.json", list(fpriv.values()))
    dump("daily-tests.json", ftests)
    bundle = OrderedDict([("format", "oliyfizika-attestation-import"), ("schemaVersion", SCHEMA_VERSION),
                          ("planHash", plan["planHash"]), ("operations", len(ops)),
                          ("counts", OrderedDict([("questions", len(pub)), ("dailyTests", len(tests)),
                                                  ("auto", ev_count["auto"]), ("open", ev_count["open"]),
                                                  ("unreliable", ev_count["unreliable"]),
                                                  ("reconstructed", n_rec)])),
                          ("contentHash", sha16(json.dumps(ops, ensure_ascii=False, sort_keys=True))),
                          ("ops", ops)])
    dump("firestore-import.json", bundle)

    # ---- Storage yuklash to'plami (admin sahifasi papkani tanlab yuklaydi) va Firestore muqobili
    stage_root = os.path.join(PRIV, "storage")
    shutil.rmtree(stage_root, ignore_errors=True)
    for src, rel in fig_copies:
        os.makedirs(os.path.dirname(os.path.join(stage_root, rel)), exist_ok=True)
        shutil.copyfile(src, os.path.join(stage_root, rel))
    dump("storage-upload.json", {"root": STORAGE_ROOT, "files": len(upload),
                                 "question": sum(u["scope"] == "question" for u in upload),
                                 "solution": sum(u["scope"] == "solution" for u in upload), "items": upload})
    dump("firestore-figures.json", {"format": "oliyfizika-attestation-figures", "operations": len(fig_ops),
                                    "planHash": plan["planHash"], "ops": fig_ops})
    print(f"FIGURES: Storage {len(upload)} fayl ({sum(u['scope']=='question' for u in upload)} savol, "
          f"{sum(u['scope']=='solution' for u in upload)} yechim); Firestore muqobili {len(fig_ops)} hujjat")
    print(f"IMPORT BUNDLE: {len(ops)} operatsiya, contentHash {bundle['contentHash']}")


if __name__ == "__main__":
    main()
