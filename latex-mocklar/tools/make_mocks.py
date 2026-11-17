#!/usr/bin/env python3
"""10 ta mock test (LaTeX) — dtm-variantlari/data/baza.json dan 1–32-savollar, 33–45 ochiq shablonlar.
Ishga tushirish:  python3 latex-mocklar/tools/make_mocks.py   (xelatex kerak: mock-XX.pdf ni o‘zi yig‘adi)"""
import json, random, re, math, subprocess, sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import open_tasks as ot
import mid_tasks as mt
import open_pool as op
from figs import FIG

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "latex-mocklar"
BANK = json.load(open(ROOT / "dtm-variantlari/data/baza.json"))["questions"]
N_MOCKS = 10
# BMBA namunasidagi taqsimot: 1–10 Mexanika, 11–15 MF, 16–25 Elektr, 26–28 Optika, 29–31 Atom, 32 Mexanika
SLOTS = [("M", range(1, 11)), ("MF", range(11, 16)), ("E", range(16, 26)), ("O", range(26, 29)), ("A", range(29, 32)), ("M", [32])]
MAX_IMG = 5

# ------------------------------------------------------------ matn -> LaTeX
SUBS = dict(zip("₀₁₂₃₄₅₆₇₈₉", "0123456789"))
SUPS = dict(zip("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-"))
SYM = {"°": r"^\circ", "µ": r"\mu", "Ω": r"\Omega", "π": r"\pi", "α": r"\alpha", "β": r"\beta", "γ": r"\gamma", "λ": r"\lambda",
       "ε": r"\varepsilon", "σ": r"\sigma", "ρ": r"\rho", "φ": r"\varphi", "ω": r"\omega", "ℓ": r"\ell", "≈": r"\approx", "−": "-",
       "·": r"\cdot", "×": r"\times", "→": r"\rightarrow", "←": r"\leftarrow", "↑": r"\uparrow", "↓": r"\downarrow", "≥": r"\ge", "≤": r"\le",
       "Δ": r"\Delta", "≠": r"\ne", "θ": r"\theta", "τ": r"\tau", "η": r"\eta", "ħ": r"\hbar", "√": r"\surd", "∞": r"\infty", "Σ": r"\Sigma",
       "ψ": r"\psi", "Φ": r"\Phi", "Ψ": r"\Psi", "Θ": r"\Theta", "Λ": r"\Lambda", "μ": r"\mu", "ν": r"\nu", "κ": r"\kappa", "δ": r"\delta", "υ": r"\upsilon", "ϕ": r"\phi", "…": r"\ldots", "\u2126": r"\Omega", "∥": r"\parallel", "⊥": r"\perp"}
ESC = {"%": r"\%", "&": r"\&", "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}", "\\": r"\textbackslash{}", "<": r"\textless{}", ">": r"\textgreater{}"}
unknown = set()

def turk(t):
    """Savol matnida: o‘→ö, g‘→ğ, sh→ş, ch→ç (matematikadan tashqarida)."""
    for a, b in [("o‘", "ö"), ("O‘", "Ö"), ("g‘", "ğ"), ("G‘", "Ğ"), ("sh", "ş"), ("Sh", "Ş"), ("SH", "Ş"), ("ch", "ç"), ("Ch", "Ç"), ("CH", "Ç")]:
        t = t.replace(a, b)
    return t

def plain_to_tex(t):
    t = turk(t)
    out, i = [], 0
    while i < len(t):
        c = t[i]
        if c in SUBS:
            j = i
            while j < len(t) and t[j] in SUBS: j += 1
            out.append(("m", "_{" + "".join(SUBS[x] for x in t[i:j]) + "}")); i = j
        elif c in SUPS:
            j = i
            while j < len(t) and t[j] in SUPS: j += 1
            out.append(("m", "^{" + "".join(SUPS[x] for x in t[i:j]) + "}")); i = j
        elif c in SYM:
            out.append(("m", SYM[c])); i += 1
        elif c in ESC:
            out.append(("t", ESC[c])); i += 1
        elif c == "\n":
            out.append(("t", r"\\ ")); i += 1
        else:
            if ord(c) > 0x2FF and c not in "‘’–—“”«»": unknown.add(c)
            out.append(("t", c)); i += 1
    # yaqin math bo'laklarni birlashtirish (a$_1$ kabi)
    res, buf = "", ""
    for k, v in out:
        if k == "m": buf += v
        else:
            if buf: res += "$" + buf + "$"; buf = ""
            res += v
    if buf: res += "$" + buf + "$"
    return res

def tex(s):
    parts = re.split(r"(\$[^$]+\$)", s)
    return "".join(p if (i % 2) else plain_to_tex(p) for i, p in enumerate(parts))

# ------------------------------------------------------------ banktan tanlash
UNITCONV = re.compile(r"necha\s+\S+\s+(ga\s+)?teng|birligi|birlikda|XBS|SI\s+da|ko‘rsating\.?$", re.I)
FIGREF = re.compile(r"rasm|chizma|grafik|jadval|sxema", re.I)

# Bankdagi bo‘lim belgisi ba’zan noto‘g‘ri — kalit so‘zlar bilan tekshiriladi (sayt sections.js ga o‘xshash)
_A = r"[‘'’ʻ]?"
KW = {
  "E": [r"zaryad", r"\btok\b", r"kuchlanish", r"qarshilik", r"kondensator", r"sig"+_A+"im", r"eyuk", r"magnit", r"induksiya", r"induktiv",
        r"elektr", r"potensial", r"kulon", r"amperm", r"voltm", r"rezistor", r"lorens", r"solenoid", r"transformator", r"o"+_A+"tkazgich",
        r"Ω", r"galvanometr", r"lampa", r"zanjir", r"dielektrik", r"g"+_A+"altak", r"elektroliz", r"\bvolt\b", r"μf|mkf|\bpf\b|\bnf\b"],
  "MF": [r"\bgaz", r"harorat", r"temperatura", r"issiqlik", r"molekula", r"izobar", r"izoterm", r"izoxor", r"adiabat", r"termodinamik", r"kapillyar",
         r"sirt taranglik", r"namlik", r"erish", r"bug"+_A, r"\bmol\b", r"kelvin", r"°c", r"entropiya", r"ideal gaz", r"avogadro",
         r"qaynash", r"\bmuz", r"kristall", r"diffuziya", r"ichki energiya", r"karno", r"solishtirma issiqlik"],
  "O": [r"linza", r"\bnur", r"yorug"+_A+"lik", r"ko"+_A+"zgu", r"sindirish", r"difraksi", r"interferen", r"tasvir", r"prizma", r"qutblan",
        r"dioptriya", r"dptr", r"fokus", r"lupa", r"mikroskop", r"to"+_A+"lqin uzunligi"],
  "A": [r"\batom", r"yadro", r"radioaktiv", r"yemiril", r"foton", r"fotoeffekt", r"kvant", r"proton", r"neytron", r"izotop", r"nuklon",
        r"relyativ", r"spektr", r"orbita", r"broyl", r"chiqish ishi", r"qizil chegara", r"plank", r"α|β|γ-|alfa|beta", r"elektron",
        r"massa defekt", r"\b0,\d+\s?c\b", r"\d\s?c tezlik", r"zarracha", r"bog"+_A+"lanish energiya", r"annigilyatsiya", r"yorug"+_A+"lik tezligi"],
}
def _hits(t, k): return sum(1 for r in KW[k] if re.search(r, t))
def topic_ok(q):
    t = (q["text"] + " " + " ".join(q["answers"])).lower()
    t = re.sub(r"havo\w*\s+qarshilig\w*|ishqalanish\w*|potensial energiya\w*|mexanik kuchlanish\w*", " ", t)
    h = {k: _hits(t, k) for k in KW}
    tp = q["topic"]
    if tp == "M":
        return h["E"] == 0 and h["MF"] == 0 and h["O"] == 0 and h["A"] == 0
    if tp == "A":
        return h["A"] > 0 and h["A"] >= max(h["E"], h["MF"])
    if tp == "O":
        return h["O"] > 0 and h["O"] >= max(h["E"], h["MF"])
    if tp == "E" and _hits(re.sub(r"qarshilik", " ", t), "E") == 0: return False
    return h[tp] > 0 and h[tp] >= max(v for k, v in h.items() if k != tp)

def usable(q):
    if not topic_ok(q): return False
    if re.search(r"\b\d{2,3} \d{1,2} [A-Z][a-z]?\b", q["text"]): return False   # buzilgan yadro belgilari
    if all(a == "ABCD"[i] for i, a in enumerate(q["answers"])): return False
    imgs = q.get("images") or ([q["image"]] if q.get("image") else [])
    if any(i.split('/',1)[-1].rsplit('.',1)[0] not in FIG for i in imgs): return False
    if FIGREF.search(q["text"]) and not imgs: return False
    if UNITCONV.search(q["text"]): return False
    if len(q["text"]) < 45: return False
    if len(q["answers"]) != 4 or len(set(q["answers"])) < 4: return False
    if q["id"] == "1929944-22": return False   # kalit shubhali
    return True

def pick(mock):
    rng = random.Random(1000 + mock)
    pools = {t: [q for q in BANK if q["topic"] == t and usable(q)] for t in ("M", "MF", "E", "O", "A")}
    for p in pools.values(): rng.shuffle(p)
    return pools, rng

def build_selection():
    used_ids, used_text = set(), set()
    sel = []
    for m in range(N_MOCKS):
        pools, rng = pick(m)
        chosen, nimg = {}, 0
        for topic, nums in SLOTS:
            for n in nums:
                while True:
                    q = pools[topic].pop()
                    key = re.sub(r"\W+", "", q["text"].lower())[:60]
                    if q["id"] in used_ids or key in used_text: continue
                    im = bool(q.get("image") or q.get("images"))
                    if im and nimg >= MAX_IMG: continue
                    nimg += im; used_ids.add(q["id"]); used_text.add(key); chosen[n] = q; break
        sel.append(chosen)
    return sel

# ------------------------------------------------------------ LaTeX bo'laklari
PRE = r"""\documentclass[11pt,a4paper]{article}
\usepackage[margin=18mm,top=22mm,bottom=20mm]{geometry}
\usepackage{fontspec}\setmainfont{Latin Modern Roman}
\usepackage{amsmath,amssymb,tikz,graphicx,fancyhdr,array,needspace}
\usetikzlibrary{patterns,arrows.meta,decorations.pathmorphing,calc}
\setlength{\headheight}{14pt}
\usetikzlibrary{arrows.meta}
\pagestyle{fancy}\fancyhf{}\renewcommand{\headrulewidth}{0.4pt}
\fancyhead[L]{\textbf{\MOCK}}\fancyhead[C]{\itshape Fizika (OliyFizika.uz mock test)}\fancyhead[R]{\textbf{Mock №\MOCKNO}}
\fancyfoot[C]{\thepage}
\setlength{\parindent}{0pt}\setlength{\parskip}{3pt}
\newcommand{\opt}[2]{\hspace*{4mm}#1)\ #2\par}
\newcommand{\blank}{\rule{5cm}{0.4pt}}
\begin{document}
"""
AUTHOR = re.compile(r"^\s*\([A-ZÖĞŞÇ‘’'][^()]{2,40}\)\s*")
def clean_text(t): return AUTHOR.sub("", t)

def qblock(n, q):
    body = [r"\noindent\begin{minipage}{\linewidth}", r"\textbf{%d.}\ %s\par\smallskip" % (n, tex(clean_text(q["text"])))]
    imgs = q.get("images") or ([q["image"]] if q.get("image") else [])
    for im in imgs:
        body.append(r"\noindent\hspace*{4mm}" + FIG[im.split('/',1)[-1].rsplit('.',1)[0]] + r"\par\smallskip")
    for L, a in zip("ABCD", q["answers"]): body.append(r"\opt{%s}{%s}" % (L, tex(a)))
    body.append(r"\end{minipage}\vspace{9pt}\par")
    return "\n".join(body)

def bridge_fig(U, R):
    R1, R2, R3, R4 = R
    def res(x, y, lab): return rf"\draw[fill=white] ({x-0.14},{y-0.3}) rectangle ({x+0.14},{y+0.3}); \node[right] at ({x+0.16},{y}) {{\small ${lab}\,\Omega$}};"
    def amp(x, y, lab): return rf"\draw[fill=white] ({x},{y}) circle (0.26); \node at ({x},{y}) {{\small $A_{lab}$}};"
    return "\n".join([
        r"\begin{tikzpicture}[line width=0.5pt]",
        r"\draw (0,0)--(0,1.3) (0,1.7)--(0,3)--(3,3);",
        r"\draw (-0.25,1.3)--(0.25,1.3); \draw (-0.12,1.7)--(0.12,1.7);",
        rf"\node[left] at (-0.3,1.5) {{\small ${U}\,\mathrm{{V}},\ r=0$}};",
        r"\draw (1.5,3)--(1.5,2.9); \draw (1.5,0)--(0,0); \draw (3,3)--(3,2.4); \draw (3,0)--(1.5,0);",
        r"\draw (1.5,1.8)--(1.5,1.5)--(1.5,1.2); \draw (3,1.8)--(3,1.5)--(3,1.2);",
        r"\draw (1.5,0.6)--(1.5,0)  (3,0.6)--(3,0);",
        r"\draw (1.5,1.5)--(1.99,1.5) (2.51,1.5)--(3,1.5);",
        r"\draw (1.5,2.9)--(1.5,2.64);",
        r"\draw (1.5,2.12)--(1.5,1.8); \draw (3,2.4)--(3,2.4);",
        amp(1.5, 2.9, 1).replace("2.9", "2.9"), res(1.5, 2.1, R1) if False else "",
        res(1.5, 2.1 - 0.0, R1), res(1.5, 0.9, R3), res(3, 2.1, R2), res(3, 0.9, R4),
        amp(2.25, 1.5, 2), amp(0.75, 0, 3),
        r"\end{tikzpicture}"])

def bridge_fig2(U, R):
    """Aniq, bog'langan chizma (A1 chap yuqori shoxda, A2 ko'prikda, A3 umumiy tokda)."""
    R1, R2, R3, R4 = R
    r = lambda x, y, lab: rf"\draw[fill=white] ({x-0.14},{y-0.3}) rectangle ({x+0.14},{y+0.3}); \node[right] at ({x+0.17},{y}) {{\small ${lab}\,\Omega$}};"
    a = lambda x, y, lab: rf"\draw[fill=white] ({x},{y}) circle (0.28); \node at ({x},{y}) {{\small $A_{lab}$}};"
    L = [r"\begin{tikzpicture}[line width=0.5pt]",
         r"\draw (0,0)--(0,1.35); \draw (0,1.65)--(0,3)--(3,3)--(3,2.4); \draw (-0.25,1.35)--(0.25,1.35); \draw (-0.12,1.65)--(0.12,1.65);",
         rf"\node[left] at (-0.3,1.5) {{\small ${U}\,\mathrm{{V}}$}};",
         r"\draw (1.5,3)--(1.5,2.72); \draw (1.5,2.44)--(1.5,2.4);",
         r"\draw (1.5,1.8)--(1.5,1.2); \draw (1.5,0.6)--(1.5,0)--(0.28,0); \draw (-0.28,0)--(0,0);",
         r"\draw (3,1.8)--(3,1.2); \draw (3,0.6)--(3,0)--(1.5,0);",
         r"\draw (1.5,1.5)--(1.97,1.5); \draw (2.53,1.5)--(3,1.5);",
         a(1.5, 2.58, 1), r(1.5, 2.1, R1), r(1.5, 0.9, R3), r(3, 2.1, R2), r(3, 0.9, R4), a(2.25, 1.5, 2), a(0.0, 0.0, 3),
         r"\end{tikzpicture}"]
    return "\n".join(L)

def open_block(n, st, parts, fig):
    L = [r"\Needspace{9\baselineskip}", r"\noindent\textbf{%d.}\ %s\par\smallskip" % (n, tex(st))]
    if fig: L.append(r"\begin{center}" + fig + r"\end{center}")
    for lab, (qt, _) in zip("ab", parts):
        L.append(r"\medskip\noindent\textbf{%s)\ %s}\par" % (lab, tex(qt)))
        L.append(r"\noindent\textit{Javob}: %s)\ \blank\par" % lab)
    L.append(r"\medskip\noindent\textbf{Diqqat!} %s\par\vspace{10pt}" % tex("Javoblaringizni javoblar varaqasiga ko‘chirib yozing."))
    return "\n".join(L)

def doc(m, sel, bt, opens):
    L = [PRE.replace(r"\MOCKNO", str(m + 1)).replace(r"\MOCK", f"M-{m+1:02d}"),
         r"\begin{center}{\Large\textbf{FİZİKA}}\end{center}"]
    for n in range(1, 33): L.append(qblock(n, sel[n]))
    L.append(r"\newpage\noindent\textbf{" + tex("33–35-test topshiriqlariga mos keluvchi javoblarni (A–F) javob variantlaridan tanlang.") + r"}\par\smallskip")
    L.append(tex(bt["intro"]) + r"\par\medskip")
    L.append(r"\begin{center}" + bt["fig"] + r"\end{center}")
    rows = list(zip((33, 34, 35), bt["qs"]))
    opt = r"\\".join(f"{L_})\\ {o}" for L_, o in zip("ABCDEF", bt["opts"]))
    left = r"\\[6pt]".join(rf"\textbf{{{n}.}}\ {tex(t)}" for n, t in rows)
    L.append(r"\noindent\fbox{\begin{minipage}{0.64\linewidth}\vspace{4pt}" + left + r"\vspace{4pt}\end{minipage}\vrule\hspace{6pt}\begin{minipage}{0.28\linewidth}\vspace{4pt}" + opt + r"\vspace{4pt}\end{minipage}}\par\vspace{14pt}")
    for i, (st, parts, fig) in enumerate(opens): L.append(open_block(36 + i, st, parts, fig))
    L.append(r"\end{document}")
    s = "\n".join(L)
    return s.replace("FİZİKA", "FIZIKA")

def keys_doc(allkeys, srcs):
    L = [PRE.replace(r"\MOCKNO", "1–10").replace(r"\MOCK", "Kalitlar"), r"\begin{center}{\Large\textbf{Javoblar kalitlari}}\end{center}"]
    for m, k in enumerate(allkeys):
        L.append(rf"\Needspace{{16\baselineskip}}\subsection*{{Mock №{m+1}}}")
        row = lambda a, b: " ".join(f"{i}-{k['mcq'][i]}" for i in range(a, b))
        L.append(r"\noindent\textbf{1–32:} " + r"\\ ".join(row(a, a + 8) for a in (1, 9, 17, 25)) + r"\par")
        L.append(r"\noindent\textbf{33–35:} 33-%s, 34-%s, 35-%s \quad (javoblar: %s; %s; %s)\par" % (*k["bridge_key"], *k["bridge_ans"]))
        for i, (a, b) in enumerate(k["open"]): L.append(rf"\noindent\textbf{{{36+i}.}}\ a) {a}\quad b) {b}\par")
        L.append(r"\noindent{\footnotesize Manba (bazadagi id, 1–32): " + ", ".join(srcs[m]) + r"}\par\bigskip")
    L.append(r"\end{document}")
    return "\n".join(L).replace("\\_", "\\_")

def main():
    OUT.mkdir(exist_ok=True)
    sel = build_selection()
    allkeys, srcs = [], []
    for m in range(N_MOCKS):
        rng = random.Random(m)
        bt = ot.bridge_task(m, rng)
        if m == 0:
            bt.update(fig=bridge_fig2(bt["U"], bt["R"]), intro="Rasmda elektr zanjir tasvirlangan. Batareyaning ichki qarshiligi nolga teng, ampermetrlar ideal.",
                      qs=[f"$A_{i}$ ampermetrning ko‘rsatishini (A) aniqlang." for i in (1, 2, 3)])
        else:
            bt = mt.mid_task(m)
        opens = op.opens_for(m)
        s = doc(m, sel[m], bt, opens)
        (OUT / f"mock-{m+1:02d}.tex").write_text(s, encoding="utf-8")
        allkeys.append(dict(mcq={n: "ABCD"[sel[m][n]["correct"]] for n in range(1, 33)}, bridge_key=bt["key"], bridge_ans=bt["ans"],
                            open=[(tex(parts[0][1]), tex(parts[1][1])) for _, parts, _ in opens]))
        srcs.append([f"{n}:{sel[m][n]['id']}".replace("_", r"\_") for n in range(1, 33)])
    (OUT / "kalitlar.tex").write_text(keys_doc(allkeys, srcs), encoding="utf-8")
    if unknown: print("Noma'lum belgilar:", "".join(sorted(unknown)))
    if "--nopdf" not in sys.argv:
        for f in sorted(OUT.glob("*.tex")):
            for _ in range(1):
                r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error", f.name], cwd=OUT, capture_output=True, text=True)
                if r.returncode: print("XATO", f.name, r.stdout[-1500:]); break
        for e in ("aux", "log"):
            for f in OUT.glob(f"*.{e}"): f.unlink()
    print("tayyor")
if __name__ == "__main__": main()
