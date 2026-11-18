"""Fizika olimpiadasi uchun 30 talik test (shablon: Fizikauzb.pdf, 2-betdan boshlab).
1–17 yopiq (A–D), 18–27 ochiq (javob yoziladi), 28–30 moslashtirish (A–F).
Ballar: 10 ta 0,9 + 10 ta 1,7 + 10 ta 2,4 = 50. Savollar dtm-variantlari/data/baza.json dan,
10 ta mockda ishlatilmaganlari; har birining kaliti qo‘lda yechib tekshirilgan.
Ishga tushirish: python3 make_olimpiada.py [--nopdf]"""
import re, sys, subprocess
from pathlib import Path
import make_mocks as mm

mm.turk = lambda t: t          # bu shablonda o‘, g‘ saqlanadi
tex = mm.tex
OUT = mm.OUT / "olimpiada"
BY = {q["id"]: q for q in mm.BANK}

# (id, ball) — tartib bo‘yicha. Yopiq 1–17, ochiq 18–27.
CLOSED = [("1923945-13", "1,7"), ("T10-03", "1,7"), ("MS18_1-01", "2,4"), ("8000777-01", "0,9"), ("T03-13", "1,7"),
          ("8000393-26", "0,9"), ("8001185-23", "2,4"), ("T17-13", "0,9"), ("T24-15", "1,7"), ("8000897-24", "2,4"),
          ("Y06-17", "2,4"), ("1922945-12", "0,9"), ("Y06-23", "0,9"), ("8000681-20", "1,7"), ("8000177-24", "2,4"),
          ("MS22_1-20", "0,9"), ("8000537-23", "2,4")]
OPEN = [("8000081-09", "2,4"), ("T11-04", "1,7"), ("MS15_1-08", "1,7"), ("MS18_1-17", "1,7"), ("T18-17", "0,9"),
        ("8001089-26", "2,4"), ("T15-23", "2,4"), ("T20-28", "0,9"), ("Y01-27", "1,7"), ("T17-29", "0,9")]
# Manbadagi aniq yozuv xatolari (ma’no o‘zgarmaydi)
TEXTFIX = {"T11-04": [("22,50 burchak", "22,5° burchak")]}

# 28–30: moslashtirish (javoblar kodda hisoblanadi)
C1, U1, C2, U2 = 2, 30, 4, 15                       # µF, V
W1 = C1 * U1**2 / 2                                  # 900 µJ
U = (C1 * U1 + C2 * U2) / (C1 + C2)                  # 20 V
W2f = C2 * U**2 / 2                                  # 800 µJ
Q = C1 * U1**2 / 2 + C2 * U2**2 / 2 - (C1 + C2) * U**2 / 2   # 150 µJ
MATCH_ANS = [W1, W2f, Q]
MATCH_OPTS = sorted(MATCH_ANS + [C2 * U2**2 / 2, (C1 + C2) * U**2 / 2, W1 + C2 * U2**2 / 2])   # 450, 1200, 1350
MATCH_KEY = ["ABCDEF"[MATCH_OPTS.index(v)] for v in MATCH_ANS]
MATCH_FIG = r"""\begin{tikzpicture}[line width=0.5pt,font=\small]
\draw (0,0)--(0,0.85) (0,1.15)--(0,2)--(1.6,2); \draw (-0.35,0.85)--(0.35,0.85) (-0.35,1.15)--(0.35,1.15);
\node[left] at (-0.4,1) {$C_1$}; \node at (0.6,1.35) {\scriptsize $+$}; \node at (0.6,0.65) {\scriptsize $-$};
\draw (1.6,2)--(1.9,2.25); \fill (1.6,2) circle(1.2pt) (2.2,2) circle(1.2pt); \node[above] at (1.9,2.25) {K};
\draw (2.2,2)--(2.8,2); \draw[fill=white] (2.8,1.85) rectangle (3.8,2.15); \node[above] at (3.3,2.15) {$R$}; \draw (3.8,2)--(4.6,2)--(4.6,1.15);
\draw (4.6,0.85)--(4.6,0)--(0,0); \draw (4.25,0.85)--(4.95,0.85) (4.25,1.15)--(4.95,1.15);
\node[right] at (5,1) {$C_2$}; \node at (4.0,1.35) {\scriptsize $+$}; \node at (4.0,0.65) {\scriptsize $-$};
\end{tikzpicture}"""
MATCH_INTRO = ("Sig‘imi $C_1$=2 µF bo‘lgan kondensator 30 V kuchlanishgacha, sig‘imi $C_2$=4 µF bo‘lgan kondensator esa 15 V "
               "kuchlanishgacha zaryadlangan. Kondensatorlar rezistor va kalit orqali rasmdagidek bir xil ishorali qoplamalari "
               "bilan tutashtirildi. Kalit ulangach, zaryad qayta taqsimlanib, zanjirda tok to‘xtadi. Simlarning qarshiligini va "
               "nurlanishni hisobga olmang.")
MATCH_QS = [("0,9", "Kalit ulanguncha birinchi kondensatorda to‘plangan elektr maydon energiyasini (µJ) aniqlang."),
            ("1,7", "Zaryad qayta taqsimlangandan so‘ng ikkinchi kondensatorning energiyasini (µJ) toping."),
            ("2,4", "Zaryad qayta taqsimlanishi davomida rezistorda ajralib chiqqan issiqlik miqdorini (µJ) toping.")]

QW = re.compile(r"aniqlang|toping|topilsin|hisoblang|qanday|qancha|necha|\?|keltiring|bo‘ladi", re.I)
def split_q(t):
    """Matnni o‘zgartirmasdan: (shart, savol jumlasi, qolgan qism)."""
    sents = re.split(r"(?<=[.?])\s+(?=[A-ZÀ-ÿ‘$(0-9])", t.strip())
    k = max((i for i, s in enumerate(sents) if QW.search(s)), default=len(sents) - 1)
    qs, rest = sents[k], " ".join(sents[k + 1:])
    m = re.match(r"^(.*?[.?])\s+([A-Za-zπλμ][\w/]*\s*=.*)$", qs)   # savol jumlasidan keyingi doimiylar (g=10 ...)
    if m: qs, rest = m.group(1), (m.group(2) + " " + rest).strip()
    return " ".join(sents[:k]), qs, rest

PRE = r"""% !TEX TS-program = xelatex
% !TEX encoding = UTF-8 Unicode
\documentclass[11pt,a4paper]{article}
\usepackage[margin=20mm,top=24mm,bottom=22mm]{geometry}
\usepackage{fontspec}   % standart shrift: Latin Modern (TeX Live ichida, nom bilan qidirilmaydi)
\usepackage{amsmath,amssymb,tikz,fancyhdr,needspace,array}
\usetikzlibrary{arrows.meta,patterns}
\setlength{\headheight}{14pt}
\pagestyle{fancy}\fancyhf{}\renewcommand{\headrulewidth}{0.4pt}
\fancyhead[C]{\itshape Fizika}\fancyfoot[C]{\thepage}
\setcounter{page}{2}
\setlength{\parindent}{0pt}\setlength{\parskip}{3pt}\emergencystretch=3em
\newcommand{\ball}[1]{\hfill\texttt{[#1 ball]}}
\newcommand{\qhead}[2]{\Needspace{10\baselineskip}\noindent\textbf{#1.}\ball{#2}\par\nopagebreak}
\newcommand{\opt}[2]{\hspace*{8mm}#1)\ #2\par}
\newenvironment{qbody}{\begin{list}{}{\leftmargin=8mm\rightmargin=0pt\topsep=0pt\itemsep=0pt\parsep=3pt}\item\relax}{\end{list}}
\begin{document}
"""
INSTR = r"""\noindent\fbox{\begin{minipage}{\dimexpr\linewidth-2\fboxsep-2\fboxrule}\sffamily\small\vspace{3pt}
Ushbu test varianti 30 ta (1$-$30) topshiriqdan iborat. Test topshirig‘i uchun ajratilgan ball har bir test topshirig‘ida aks ettirilgan.\par
Kitobda yopiq va ochiq turdagi test topshiriqlari mavjud:\par
-- yopiq turdagi test topshiriqlarida bitta javobni (A, B, C yoki D) tanlang va javoblar varaqasidagi topshiriq raqamiga mos qatorga yozing;\par
-- ochiq turdagi test topshiriqlarining javobini javoblar varaqasidagi topshiriq raqamiga mos qatorga aniq va tushunarli tarzda yozing;\par
-- moslashtirishni talab qiluvchi yopiq test topshiriqlari uchun umumiy oltita (A$-$F) javob varianti berilgan, uchta topshiriqqa (28-, 29-, 30-test topshiriqlariga) ushbu javoblar orasidan mos ravishda bittadan javob tanlang va javoblar varaqasiga belgilang.\vspace{3pt}
\end{minipage}}\par\vspace{14pt}
"""

def body(q):
    t = mm.clean_text(q["text"])
    for a, b in TEXTFIX.get(q["id"], []): t = t.replace(a, b)
    st, qs, rest = split_q(t)
    L = []
    if st: L.append(tex(st) + r"\par")
    imgs = q.get("images") or ([q["image"]] if q.get("image") else [])
    for im in imgs: L.append(r"\begin{center}" + mm.FIG[im.split('/', 1)[-1].rsplit('.', 1)[0]] + r"\end{center}")
    L.append(r"\textbf{" + tex(qs) + "}" + ((" " + tex(rest)) if rest else "") + r"\par")
    return L

# To‘g‘ri javob harflari teng taqsimlanishi uchun variantlar aylantiriladi (matn o‘zgarmaydi)
TARGET = "BCADDACBDCABDBCAD"
def placed(q, n):
    a, c, t = q["answers"], q["correct"], "ABCD".index(TARGET[n - 1])
    k = (c - t) % 4
    return {**q, "answers": a[k:] + a[:k], "correct": t}

def opts_row(ans):
    """A–D variantlar yonma-yon: qisqa bo‘lsa 4 ustun, uzunroq bo‘lsa 2×2."""
    plain = [re.sub(r"\\[a-z]+|[${}^_ ]", "", a) for a in ans]
    cols = 4 if max(map(len, plain)) <= 14 else 2
    w = r"%.3f\linewidth" % (0.96 / cols)
    cells = [r"%s)\ %s" % (Lt, tex(a)) for Lt, a in zip("ABCD", ans)]
    rows = [" & ".join(cells[i:i + cols]) for i in range(0, 4, cols)]
    return (r"\noindent\begin{tabular}{@{}" + ("p{%s}" % w) * cols + "@{}}" + r"\\[4pt]".join(rows) + r"\end{tabular}\par")

def closed(n, q, pts):
    L = [r"\noindent\begin{minipage}{\linewidth}", r"\qhead{%d}{%s}" % (n, pts), r"\begin{qbody}"] + body(q) + [r"\smallskip"]
    L.append(opts_row(q["answers"]))
    L.append(r"\end{qbody}\end{minipage}\par\vspace{16pt}")
    return "\n".join(L)

def opened(n, q, pts):
    L = [r"\qhead{%d}{%s}" % (n, pts), r"\begin{qbody}"] + body(q)
    L += [r"\medskip\textbf{Javob:}\ \rule{5cm}{0.4pt}\par", r"\textbf{Diqqat!} Javobingizni javoblar varaqasiga ko‘chirib yozing.\par",
          r"\end{qbody}\vspace{18pt}"]
    return "\n".join(L)

def matching():
    num = lambda v: mm.tex(f"{v:g}".replace(".", ","))
    left = r"\\[14pt]".join(r"\textbf{%d.}\hfill\texttt{[%s ball]}\\ %s" % (28 + i, p, tex(s)) for i, (p, s) in enumerate(MATCH_QS))
    right = r"\\[12pt]".join(f"{L})\\ {num(v)}" for L, v in zip("ABCDEF", MATCH_OPTS))
    return "\n".join([r"\Needspace{30\baselineskip}\noindent\textbf{28--30.}\par",
        r"\begin{qbody}", tex("Berilgan ma’lumotlar asosida quyidagi uchta 28-, 29-, 30-test topshiriqlarini bajaring.") + r"\par",
        tex(MATCH_INTRO) + r"\par", r"\begin{center}" + MATCH_FIG + r"\end{center}", r"\end{qbody}",
        r"\begin{center}\begin{tabular}{|p{0.62\linewidth}|p{0.22\linewidth}|}\hline",
        r"\centering\textbf{Topshiriqlar} & \centering\textbf{Javoblar}\tabularnewline\hline",
        r"\begin{minipage}[t]{\linewidth}\vspace{4pt}" + left + r"\vspace{6pt}\end{minipage} & \begin{minipage}[t]{\linewidth}\vspace{4pt}" + right + r"\vspace{6pt}\end{minipage}\tabularnewline\hline",
        r"\end{tabular}\end{center}"])

def ans_open(q): return q["answers"][q["correct"]].strip("$")

def main():
    OUT.mkdir(exist_ok=True)
    pts = [p for _, p in CLOSED + OPEN] + [p for p, _ in MATCH_QS]
    tot = sum(float(p.replace(",", ".")) for p in pts)
    assert len(pts) == 30 and abs(tot - 50) < 1e-9 and all(pts.count(p) == 10 for p in ("0,9", "1,7", "2,4")), (len(pts), tot)
    used = {q["id"] for s in mm.build_selection() for q in s.values()}
    ids = [i for i, _ in CLOSED + OPEN]
    assert not (set(ids) & used) and len(set(ids)) == 27
    L = [PRE, INSTR]
    for n, (i, p) in enumerate(CLOSED, 1): BY[i] = placed(BY[i], n); L.append(closed(n, BY[i], p))
    for n, (i, p) in enumerate(OPEN, 18): L.append(opened(n, BY[i], p))
    L.append(matching())
    for _ in range(2): L.append(r"\newpage\begin{center}\textit{Topshiriqlarni bajarish uchun}\end{center}\thispagestyle{empty}\mbox{}")
    L.append(r"\end{document}")
    (OUT / "olimpiada-01.tex").write_text("\n".join(L), encoding="utf-8")
    # kalit: 3 ta ustun yonma-yon (1–10, 11–20, 21–30)
    rows = []
    for n, (i, p) in enumerate(CLOSED, 1): rows.append((n, "ABCD"[BY[i]["correct"]], p, i))
    for n, (i, p) in enumerate(OPEN, 18): rows.append((n, tex(ans_open(BY[i])), p, i))
    for k, (p, _) in enumerate(MATCH_QS): rows.append((28 + k, MATCH_KEY[k], p, "moslashtirish"))
    def block(rs):
        T = [r"\begin{tabular}[t]{|c|c|c|}\hline \textbf{№} & \textbf{Javob} & \textbf{Ball}\\\hline"]
        T += [r"%d & %s & %s\\\hline" % (n, a, p) for n, a, p, _ in rs]
        return "\n".join(T + [r"\end{tabular}"])
    K = [PRE.replace(r"\setcounter{page}{2}", ""), r"\begin{center}{\Large\textbf{Fizika olimpiadasi testi — javoblar kaliti}}\end{center}\bigskip",
         r"\begin{center}" + r"\hspace{8mm}".join(block(rows[j:j + 10]) for j in (0, 10, 20)) + r"\end{center}",
         r"\begin{center}Jami: 10$\times$0,9 + 10$\times$1,7 + 10$\times$2,4 = 50 ball\end{center}\bigskip",
         r"\noindent{\footnotesize\textbf{Manba (baza id):} " + "; ".join(f"{n}~{i}".replace("_", r"\_") for n, _, _, i in rows[:27]) + r"}\par",
         r"\end{document}"]
    (OUT / "olimpiada-01-kalit.tex").write_text("\n".join(K), encoding="utf-8")
    if mm.unknown: print("Noma'lum belgilar:", "".join(sorted(mm.unknown)))
    if "--nopdf" not in sys.argv:
        for f in ("olimpiada-01.tex", "olimpiada-01-kalit.tex"):
            r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error", f], cwd=OUT, capture_output=True, text=True)
            if r.returncode: print("XATO", f, r.stdout[-1500:])
        for e in ("aux", "log"):
            for f in OUT.glob(f"*.{e}"): f.unlink()
    print("tayyor", tot, MATCH_KEY)
if __name__ == "__main__": main()
