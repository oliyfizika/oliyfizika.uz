#!/usr/bin/env python3
"""Mock test import faylidan (mock-import-01.json) oflayn ko'rib chiqish sahifasi: savollar, variantlar, to'g'ri javob, yechim.
Chiqish _private/ ichida (gitignored — javob kalitini o'z ichiga oladi). Faqat o'qiydi; Firestore/saytga tegmaydi.
  python3 tools/attestatsiya-fizika/build_mock_preview.py [--number 1]"""
import argparse, html, json, os, re, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ap = argparse.ArgumentParser(); ap.add_argument("--number", type=int, default=1)
n = ap.parse_args().number
src = os.path.join(ROOT, "_private", "attestatsiya-fizika", f"mock-import-{n:02d}.json")
out = os.path.join(ROOT, "_private", "attestatsiya-fizika", f"mock-preview-{n:02d}.html")
d = json.load(open(src, encoding="utf-8"))
test, ver, key, sol = (o["data"] for o in d["ops"])
sols = {i["id"]: i for i in sol["items"]}

def inline(s):
    parts = re.split(r"(\$[^$]+\$)", s)
    res = []
    for p in parts:
        if p.startswith("$") and p.endswith("$") and len(p) > 1:
            res.append(html.escape(p, quote=False))
        else:
            e = html.escape(p, quote=False)
            res.append(re.sub(r"\*([^*\n]+)\*", r"<em>\1</em>", e))
    return "".join(res)

def blocks(bs):
    o = []
    for b in bs:
        t = b.get("t")
        if t == "p": o.append(f"<p>{inline(b['text'])}</p>")
        elif t == "heading": o.append(f"<h4>{inline(b['text'])}</h4>")
        elif t == "math": o.append(f"<div class='math'>$${html.escape(b['tex'], quote=False)}$$</div>")
        elif t == "list":
            items = "".join(f"<li>{blocks(it['blocks'])}</li>" for it in b["items"])
            o.append(f"<ol class='lst'>{items}</ol>")
        elif t in ("given", "answer", "check"):
            lab = {"given": "Berilgan", "answer": "Javob", "check": "Tekshiruv"}[t]
            o.append(f"<div class='box {t}'><b>{lab}:</b> {blocks(b['blocks'])}</div>")
        else: o.append(f"<p class='unk'>[noma'lum blok: {html.escape(str(t))}]</p>")
    return "".join(o)

cards, counts, letters = [], collections.Counter(), collections.Counter()
for i, q in enumerate(ver["questions"], 1):
    qid = q["id"]; ans = key["answers"][qid]; s = sols[qid]
    assert s["correctAnswer"] == ans, qid
    counts[q["sectionTitle"]] += 1; letters[ans] += 1
    opts = "".join(f"<li class='opt{' ok' if o['key'] == ans else ''}'><span class='k'>{o['key']}</span><div>{blocks(o['blocks'])}</div></li>" for o in q["options"])
    ped = qid.startswith("PED")
    cards.append(f"""<article class="q" id="q{i}" data-sec="{html.escape(q['sectionTitle'])}">
<header><span class="no">{i}</span><span class="chip">{html.escape(q['sectionTitle'])}</span><span class="chip g">{html.escape(q.get('topic') or '')}</span>
<span class="chip g">{html.escape(str(q.get('difficulty') or ''))}</span><span class="id">{qid}{'' if ped else ' · kitob ' + html.escape(str(q.get('bookNumber', '')))}</span></header>
<div class="body">{blocks(q['question'])}</div><ul class="opts">{opts}</ul>
<div class="ans">To'g'ri javob: <b>{ans}</b> <span class="id">· yechim holati: {html.escape(str(s['solutionStatus']))}</span></div>
<details><summary>Yechim</summary><div class="sol">{blocks(s['solution'])}</div></details></article>""")

summary = " · ".join(f"{k}: <b>{v}</b>" for k, v in counts.items())
lt = " ".join(f"{k}={v}" for k, v in sorted(letters.items()))
nav = "".join(f"<a href='#q{i}'>{i}</a>" for i in range(1, len(cards) + 1))
page = f"""<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock test {n} — oldindan ko'rish (maxfiy)</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<style>body{{font:16px/1.55 system-ui,sans-serif;margin:0;background:#f5f6f8;color:#1b1f2a}}main{{max-width:860px;margin:0 auto;padding:16px}}
.top{{background:#fff;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 1px 3px #0001}}.warn{{background:#fff4e5;color:#7a4b00}}
nav.n{{display:flex;flex-wrap:wrap;gap:4px}}nav.n a{{padding:3px 8px;border-radius:6px;background:#e8ecf4;color:#1b1f2a;text-decoration:none;font-size:13px}}
.q{{background:#fff;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 1px 3px #0001}}.q header{{display:flex;flex-wrap:wrap;gap:6px;align-items:center}}
.no{{font-weight:700;font-size:18px;margin-right:4px}}.chip{{background:#e3edff;color:#0b3b9e;border-radius:99px;padding:1px 10px;font-size:12px}}.chip.g{{background:#eef0f4;color:#4b5565}}
.id{{color:#7b8494;font-size:12px;margin-left:auto}}.ans .id{{margin-left:6px}}.opts{{list-style:none;padding:0;margin:10px 0}}
.opt{{display:flex;gap:10px;padding:8px 10px;border:1px solid #dde1ea;border-radius:8px;margin:6px 0;align-items:flex-start}}.opt p{{margin:0}}
.opt.ok{{background:#e8f7ee;border-color:#2e9e5b}}.k{{font-weight:700;background:#eef0f4;border-radius:6px;padding:0 8px}}.opt.ok .k{{background:#2e9e5b;color:#fff}}
.ans{{margin:6px 0;color:#1d6b3e}}summary{{cursor:pointer;color:#0b3b9e;font-weight:600}}.sol{{border-left:3px solid #c9d3ea;padding-left:12px;margin-top:8px}}
.box{{border-radius:8px;padding:6px 10px;margin:8px 0;background:#f2f4f8}}.box p{{margin:2px 0}}.box.answer{{background:#e8f7ee}}.box.check{{background:#fff8e1}}.math{{overflow-x:auto}}
.lst{{margin:6px 0 6px 18px}}.unk{{color:#b00020}}h4{{margin:10px 0 4px}}</style></head><body><main>
<div class="top"><h2 style="margin:0 0 6px">Mock test {n} — oldindan ko'rish</h2>
<div>{len(cards)} savol · {test['maxScore']} ball · har savol {test['pointsPerQuestion']} ball · vaqt: {test.get('timeLimitSeconds', 0)//3600} soat · hujjat: <code>{test['id']}</code></div>
<div style="margin-top:6px">{summary}</div><div>To'g'ri javob harflari: {lt}</div></div>
<div class="top warn"><b>MAXFIY:</b> bu faylda to'g'ri javoblar bor. Hech kimga yubormang, GitHub'ga yuklamang. Savol raqami testdagi tartibga mos (1–40 fizika, 41–50 pedagogika).</div>
<div class="top"><nav class="n">{nav}</nav></div>{''.join(cards)}</main>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js" onload="renderMathInElement(document.body,{{delimiters:[{{left:'$$',right:'$$',display:true}},{{left:'$',right:'$',display:false}}],throwOnError:false}})"></script>
</body></html>"""
open(out, "w", encoding="utf-8").write(page)
print("yozildi:", os.path.relpath(out, ROOT), f"({len(page)//1024} KB)", dict(counts), dict(letters))
