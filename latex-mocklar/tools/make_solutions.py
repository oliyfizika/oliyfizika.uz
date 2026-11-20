#!/usr/bin/env python3
"""Har bir mock uchun LaTeX yechimlar: latex-mocklar/yechimlar/yechim-XX.tex (+ .pdf).
Manba: yechimlar/manba/mXX.txt —
    @N X        (1–32: N — savol raqami, X — to‘g‘ri variant harfi; kalit bilan solishtiriladi)
    @33 X Y Z   (33–35: uchta harf)
    @36 … @45   (ochiq savollar; javoblar kodda hisoblangan qiymatdan olinadi)
  Keyingi qatorlar — yechim matni: matematika $…$ ichida; «>> …» qatori — alohida formula (\\[ … \\]).
Ishga tushirish:  python3 latex-mocklar/tools/make_solutions.py [--nopdf]"""
import re, sys, random, subprocess
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import make_mocks as mm, mid_tasks as mt, open_pool as op, open_tasks as ot

OUT = mm.OUT / "yechimlar"
SRC = OUT / "manba"

def parse(path):
    blocks, cur = {}, None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^@(\d+)\s*(.*)$", line)
        if m:
            cur = int(m.group(1)); blocks[cur] = {"ans": m.group(2).split(), "lines": []}
        elif cur is not None:
            blocks[cur]["lines"].append(line)
    return blocks

def sol_tex(lines):
    out, para = [], []
    def flush():
        if para: out.append(mm.tex(" ".join(para)) + r"\par"); para.clear()
    for ln in lines:
        s = ln.strip()
        if not s: flush(); continue
        if s.startswith(">>"): flush(); out.append(r"\[" + s[2:].strip() + r"\]")
        else: para.append(s)
    flush()
    return "\n".join(out)

def ybox(ans, body):
    return (r"\noindent\colorbox{gray!12}{\parbox{\dimexpr\linewidth-2\fboxsep}{\textbf{Javob: " + ans + r"}}}\par\smallskip"
            + "\n" + r"\noindent\textit{Yechim.}\ " + body + r"\par\medskip\hrule\medskip")

PRE = mm.PRE.replace(r"\usepackage{amsmath", r"\usepackage{xcolor}\usepackage{amsmath").replace(
    r"\itshape Fizika (OliyFizika.uz mock test)", r"\itshape Fizika — yechimlar (OliyFizika.uz)")

def doc(m, sel, bt, opens, B, errs):
    L = [PRE.replace(r"\MOCKNO", str(m + 1)).replace(r"\MOCK", f"M-{m+1:02d}"),
         r"\begin{center}{\Large\textbf{FIZIKA — YECHIMLAR}}\\[2pt]{\large Mock №%d}\end{center}" % (m + 1)]
    for n in range(1, 33):
        q = sel[n]; key = "ABCD"[q["correct"]]
        b = B.get(n)
        if not b: errs.append(f"M{m+1} #{n}: yechim yo‘q"); b = {"ans": [key], "lines": ["(yechim yozilmagan)"]}
        if b["ans"][:1] != [key]: errs.append(f"M{m+1} #{n}: yechimdagi javob {b['ans']} != kalit {key}")
        L.append(r"\Needspace{10\baselineskip}" + mm.qblock(n, q).replace(r"\vspace{9pt}", r"\vspace{2pt}"))
        L.append(ybox(f"{key}) {mm.tex(q['answers'][q['correct']])}", sol_tex(b["lines"])))
    # 33–35
    L.append(r"\newpage\noindent\textbf{33–35.}\ " + mm.tex(bt["intro"]) + r"\par\medskip")
    L.append(r"\begin{center}" + bt["fig"] + r"\end{center}")
    for n, t in zip((33, 34, 35), bt["qs"]): L.append(rf"\noindent\textbf{{{n}.}}\ {mm.tex(t)}\par")
    L.append(r"\noindent Variantlar: " + r";\quad ".join(f"{a}) {o}" for a, o in zip("ABCDEF", bt["opts"])) + r"\par\smallskip")
    b = B.get(33) or {"ans": [], "lines": ["(yechim yozilmagan)"]}
    if tuple(b["ans"]) != tuple(bt["key"]): errs.append(f"M{m+1} #33–35: {b['ans']} != kalit {bt['key']}")
    L.append(ybox("; ".join(f"{n}--{k}) {a}" for n, k, a in zip((33, 34, 35), bt["key"], bt["ans"])), sol_tex(b["lines"])))
    # 36–45
    for i, (st, parts, fig) in enumerate(opens):
        n = 36 + i
        L.append(r"\Needspace{12\baselineskip}\noindent\textbf{%d.}\ %s\par" % (n, mm.tex(st)))
        if fig: L.append(r"\begin{center}" + fig + r"\end{center}")
        for lab, (qt, _) in zip("ab", parts): L.append(r"\noindent\hspace*{4mm}%s)\ %s\par" % (lab, mm.tex(qt)))
        b = B.get(n)
        if not b: errs.append(f"M{m+1} #{n}: yechim yo‘q"); b = {"ans": [], "lines": ["(yechim yozilmagan)"]}
        L.append(ybox(r"a)\ %s;\quad b)\ %s" % (mm.tex(parts[0][1]), mm.tex(parts[1][1])), sol_tex(b["lines"])))
    L.append(r"\end{document}")
    return "\n".join(L)

def main():
    OUT.mkdir(exist_ok=True)
    sel = mm.build_selection()
    errs, made = [], []
    only = [int(a) for a in sys.argv[1:] if a.isdigit()]
    for m in range(mm.N_MOCKS):
        if only and m + 1 not in only: continue
        src = SRC / f"m{m+1:02d}.txt"
        if not src.exists(): continue
        bt = ot.bridge_task(m, random.Random(m)) if m == 0 else mt.mid_task(m)
        if m == 0:
            bt.update(fig=mm.bridge_fig2(bt["U"], bt["R"]), intro="Rasmda elektr zanjir tasvirlangan. Batareyaning ichki qarshiligi nolga teng, ampermetrlar ideal.",
                      qs=[f"$A_{i}$ ampermetrning ko‘rsatishini (A) aniqlang." for i in (1, 2, 3)])
        f = OUT / f"yechim-{m+1:02d}.tex"
        f.write_text(doc(m, sel[m], bt, op.opens_for(m), parse(src), errs), encoding="utf-8")
        made.append(f)
    for e in errs: print("!!", e)
    if "--nopdf" not in sys.argv:
        for f in made:
            r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error", f.name], cwd=OUT, capture_output=True, text=True)
            if r.returncode: print("XATO", f.name, r.stdout[-2500:])
        for e in ("aux", "log"):
            for f in OUT.glob(f"*.{e}"): f.unlink()
    print("tayyor:", ", ".join(f.name for f in made), "| xatolar:", len(errs))
if __name__ == "__main__": main()

# ------------------------------------------------------------ saytdagi «Yechimni ko‘rish» uchun (export_site.py ishlatadi)
def _turk_out(s):
    """$…$ dan tashqarida o‘→ö, g‘→ğ, sh→ş, ch→ç (savol matnlari bilan bir xil)."""
    parts = re.split(r"(\$[^$]+\$)", s)
    return "".join(p if i % 2 else mm.turk(p) for i, p in enumerate(parts))

def _blocks(lines):
    out, para = [], []
    def flush():
        if para: out.append({"t": "p", "text": _turk_out(" ".join(para))}); para.clear()
    for ln in lines:
        s = ln.strip()
        if not s: flush(); continue
        if s.startswith(">>"): flush(); out.append({"t": "math", "tex": s[2:].strip()})
        else: para.append(s)
    flush()
    return out

def site_items(m, sel_m, bt, opens, plain):
    """Mock m (0 dan) uchun {"<n>": blocks[]} — manba bo‘lmasa None. plain — export_site.plain (LaTeX → matn)."""
    src = SRC / f"m{m+1:02d}.txt"
    if not src.exists(): return None
    B = parse(src)
    items = {}
    for n in range(1, 33):
        q = sel_m[n]; k = q["correct"]
        ans = {"t": "answer", "blocks": [{"t": "p", "text": f"**{'ABCD'[k]})** " + plain(q["answers"][k]).replace("*", "\\*")}]}
        items[str(n)] = _blocks(B[n]["lines"]) + [ans]
    b33 = _blocks(B[33]["lines"])
    for j, (k, a) in enumerate(zip(bt["key"], bt["ans"])):
        items[str(33 + j)] = b33 + [{"t": "answer", "blocks": [{"t": "p", "text": f"**{k})** {a}"}]}]
    for i, (_, parts, _) in enumerate(opens):
        n = 36 + i
        txt = f"a) {plain(parts[0][1])}; b) {plain(parts[1][1])}"
        items[str(n)] = _blocks(B[n]["lines"]) + [{"t": "answer", "blocks": [{"t": "p", "text": txt}]}]
    return items
