#!/usr/bin/env python3
"""latex-mocklar dagi 10 ta mockni saytga import fayliga aylantirish (Mock №16–25).

  python3 latex-mocklar/tools/export_site.py [--start 16] [--out _private/ms-mock-import-16-25.json]

Har bir mock: mock-test-N.json manbasi (matn Unicode, formulalar oddiy matn, TikZ chizmalar PNG) →
tools/milliy-sertifikat/build_mock_import.py → hammasi bitta «to‘plam» faylga yig‘iladi
(format: oliyfizika-ms-mock-import-set). Admin → Mock sessiyalar → «Mock testni import qilish» da shu
bitta fayl tanlanadi; testlar draft holida saqlanadi. Fayl ichida javoblar bor — repoga qo‘ymang."""
import argparse, json, random, re, subprocess, sys, tempfile, shutil
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import make_mocks as mm
import open_tasks as ot
import mid_tasks as mt
import open_pool as op
from figs import FIG

ROOT = mm.ROOT
BUILD = ROOT / "tools/milliy-sertifikat/build_mock_import.py"

# ------------------------------------------------------------------ LaTeX → Unicode matn
SYM = {"alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "Delta": "Δ", "varepsilon": "ε", "epsilon": "ε", "lambda": "λ",
       "mu": "μ", "nu": "ν", "pi": "π", "rho": "ρ", "sigma": "σ", "tau": "τ", "varphi": "φ", "phi": "φ", "omega": "ω", "Omega": "Ω",
       "theta": "θ", "vartheta": "ϑ", "eta": "η", "kappa": "κ", "psi": "ψ", "Phi": "Φ", "Sigma": "Σ", "upsilon": "υ", "hbar": "ħ", "ell": "ℓ", "Lambda": "Λ", "Psi": "Ψ", "Theta": "Θ", "Gamma": "Γ", "chi": "χ", "zeta": "ζ", "xi": "ξ",
       "cdot": "·", "times": "×", "circ": "°", "approx": "≈", "ne": "≠", "le": "≤", "ge": "≥", "gg": "≫", "ll": "≪", "infty": "∞",
       "to": "→", "rightarrow": "→", "Rightarrow": "⇒", "longrightarrow": "⟶", "leftarrow": "←", "pm": "±", "perp": "⊥", "parallel": "∥",
       "ldots": "…", "dots": "…", "sin": "sin", "cos": "cos", "tg": "tg", "ln": "ln", "arcsin": "arcsin", "arccos": "arccos", "lg": "lg",
       "quad": " ", "qquad": "  ", "%": "%", "{": "{", "}": "}", ",": " ", ";": " ", " ": " ", "!": "", "_": "_"}
SUP = dict(zip("0123456789+-−=()ni°", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁿⁱ°"))
SUB = dict(zip("0123456789+-=()aehijklmnoprstuvx", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ"))
bad = set()

def _group(s, i):
    """s[i] dan bitta argument: {...} yoki bitta belgi/buyruq. (matn, yangi_i)"""
    while i < len(s) and s[i] == " ": i += 1
    if i >= len(s): return "", i
    if s[i] == "{":
        d, j = 0, i
        while j < len(s):
            if s[j] == "{": d += 1
            elif s[j] == "}":
                d -= 1
                if d == 0: return s[i + 1:j], j + 1
            j += 1
        return s[i + 1:], len(s)
    if s[i] == "\\":
        m = re.match(r"\\([A-Za-z]+|.)", s[i:])
        return m.group(0), i + len(m.group(0))
    return s[i], i + 1

def _wrap(x):
    return x if re.fullmatch(r"[\w.,²³⁰¹⁴-⁹ⁿ°√π]+", x) else f"({x})"

def math(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "\\":
            m = re.match(r"\\([A-Za-z]+|.)", s[i:]); name = m.group(1); i += len(m.group(0))
            if name in ("frac", "dfrac", "tfrac"):
                a, i = _group(s, i); b, i = _group(s, i); out.append(f"{_wrap(math(a))}/{_wrap(math(b))}")
            elif name == "sqrt":
                a, i = _group(s, i); out.append("√" + _wrap(math(a)))
            elif name in ("vec", "bar"):
                a, i = _group(s, i); out.append(math(a) + ("⃗" if name == "vec" else "̄"))
            elif name in ("mathrm", "text", "textrm", "mathit", "operatorname", "mathbf"):
                a, i = _group(s, i); out.append(math(a))
            elif name in ("left", "right", "displaystyle"):
                pass
            elif name in SYM:
                out.append(SYM[name])
            else:
                bad.add(name); out.append(name)
        elif c in "^_":
            a, i = _group(s, i + 1); a = math(a)
            mp = SUP if c == "^" else SUB
            if a and all(ch in mp for ch in a): out.append("".join(mp[ch] for ch in a))
            elif c == "^": out.append("^" + (a if len(a) == 1 else f"({a})"))
            else: out.append("_" + a)
        elif c == "{":
            a, i = _group(s, i); out.append(math(a))
        elif c == "}":
            i += 1
        elif c == "~":
            out.append(" "); i += 1
        else:
            out.append(c); i += 1
    return "".join(out)

def plain(s):
    """Savol matni: $…$ ichi — formula, tashqarisi — turk harflari bilan (o‘→ö, g‘→ğ, sh→ş, ch→ç)."""
    parts = re.split(r"(\$[^$]+\$)", s)
    res = "".join(math(p[1:-1]) if i % 2 else mm.turk(p.replace("\\%", "%")) for i, p in enumerate(parts))
    res = re.sub(r"[ \t]+", " ", res).replace(" ,", ",").strip()
    if "\\" in res or "{" in res or "}" in res: bad.add(res[:60])
    return res

def number(ans):
    s = ans.replace("−", "-").replace(",", ".").replace("$", "").strip()
    m = re.fullmatch(r"([-+]?[\d.]+)\s*\\cdot\s*10\^\{?([-+]?\d+)\}?", s)
    if m: return float(m.group(1)) * 10 ** int(m.group(2))
    return float(s)

UNIT = re.compile(r"\(([^()]{1,24})\)[^()]*$")
def unit_of(text):
    m = UNIT.search(text)
    if not m: return None
    u = m.group(1).strip()
    if re.search(r"o‘nli|ö‘nli|nli kasr|ishora|gradusda", u) or not re.search(r"[A-Za-zΩμ%°]", u): return None
    return u

# ------------------------------------------------------------------ TikZ → PNG
STAND = r"""\documentclass[border=6pt]{standalone}
\usepackage{fontspec}\setmainfont{Latin Modern Roman}
\usepackage{amsmath,amssymb,tikz}
\usetikzlibrary{patterns,arrows.meta,decorations.pathmorphing,calc}
\begin{document}%s\end{document}"""
def render(tikz, name, outdir, work):
    (work / f"{name}.tex").write_text(STAND % tikz, encoding="utf-8")
    r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error", f"{name}.tex"], cwd=work, capture_output=True, text=True)
    if r.returncode: sys.exit(f"XATO chizma {name}: {r.stdout[-800:]}")
    subprocess.run(["pdftoppm", "-r", "190", "-png", "-singlefile", f"{name}.pdf", str(outdir / name)], cwd=work, check=True)
    return f"{name}.png"

SEC = {"M": "mexanika", "MF": "molekulyar", "E": "elektr", "O": "optika", "A": "optika"}
OPEN_SEC = ["mexanika"] * 3 + ["molekulyar"] * 2 + ["elektr"] * 2 + ["optika"] * 3

def build(start):
    sel = mm.build_selection()
    tmp = Path(tempfile.mkdtemp(prefix="msexp-"))
    srcs = []
    for m in range(mm.N_MOCKS):
        N = start + m
        d = tmp / f"m{N}"; d.mkdir(); w = tmp / f"w{N}"; w.mkdir()
        rng = random.Random(m)
        bt = ot.bridge_task(m, rng)
        if m == 0:
            bt.update(fig=mm.bridge_fig2(bt["U"], bt["R"]), intro="Rasmda elektr zanjir tasvirlangan. Batareyaning ichki qarshiligi nolga teng, ampermetrlar ideal.",
                      qs=[f"$A_{i}$ ampermetrning ko‘rsatishini (A) aniqlang." for i in (1, 2, 3)])
        else:
            bt = mt.mid_task(m)
        qs = []
        for n in range(1, 33):
            q = sel[m][n]
            item = {"n": n, "type": "mcq", "section": SEC[q["topic"]], "text": plain(mm.clean_text(q["text"])),
                    "options": [plain(a) for a in q["answers"]], "answer": "ABCD"[q["correct"]]}
            imgs = q.get("images") or ([q["image"]] if q.get("image") else [])
            if imgs:
                tz = r"\quad".join(FIG[i.split("/", 1)[-1].rsplit(".", 1)[0]] for i in imgs)
                item["image"] = render(tz, f"q{n:02d}", d, w)
            qs.append(item)
        fig33 = render(bt["fig"], "q33", d, w)
        note = plain("33–35-topshiriqlar uchun umumiy shart. " + bt["intro"] + " Topshiriqlar (33–35) va javob variantlari (A–F) ni o‘zaro moslashtiring.")
        for j, (qt, k) in enumerate(zip(bt["qs"], bt["key"])):
            qs.append({"n": 33 + j, "type": "mcq", "section": "elektr", "note": note, "text": plain(qt), "image": fig33,
                       "options": list(bt["opts"]), "answer": k})
        for j, (st, parts, fig) in enumerate(op.opens_for(m)):
            item = {"n": 36 + j, "type": "open2", "section": OPEN_SEC[j], "text": plain(st), "parts": []}
            if fig: item["image"] = render(fig, f"q{36 + j}", d, w)
            for key, (pt, ans) in zip("ab", parts):
                v = number(ans)
                p = {"key": key, "text": plain(pt), "answer": v, "tolerance": float(f"{abs(v) * 0.02:.3g}") if v else 0.005}
                u = unit_of(p["text"])
                if u: p["unit"] = u
                item["parts"].append(p)
            qs.append(item)
        src = {"schemaVersion": 1, "id": f"mock-test-{N}", "number": N, "title": f"Fizika Mock Test №{N}",
               "subtitle": "BMBA namunasi asosida • 45 ta topshiriq • 55 ta baholanadigan band • 3 soat",
               "durationMinutes": 180, "questions": qs,
               "scoring": {"mode": "local", "maxScore": 55, "defaultRelativeTolerance": 1e-6}}
        (d / f"mock-test-{N}.json").write_text(json.dumps(src, ensure_ascii=False, indent=1), encoding="utf-8")
        srcs.append((N, d))
    return srcs, tmp

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=16)
    ap.add_argument("--out", default=None)
    ap.add_argument("--keep", default=None, help="manba JSON va PNG larni shu papkaga nusxalash (tekshirish uchun)")
    a = ap.parse_args()
    srcs, tmp = build(a.start)
    if bad: sys.exit(f"O‘girilmagan LaTeX qoldi: {sorted(bad)[:20]}")
    bundles = []
    for N, d in srcs:
        out = d / f"ms-mock-import-{N:02d}.json"
        subprocess.run([sys.executable, str(BUILD), str(d / f"mock-test-{N}.json"), "--images-root", str(d), "--out", str(out)], check=True)
        bundles.append(json.loads(out.read_text(encoding="utf-8")))
    first, last = srcs[0][0], srcs[-1][0]
    outp = Path(a.out or ROOT / "_private" / f"ms-mock-import-{first}-{last}.json")
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(json.dumps({"format": "oliyfizika-ms-mock-import-set", "version": 1, "bundles": bundles}, ensure_ascii=False), encoding="utf-8")
    print(f"{outp}: {len(bundles)} ta mock (№{first}–{last}), {outp.stat().st_size // 1024} KB")
    if a.keep:
        k = Path(a.keep); k.mkdir(parents=True, exist_ok=True)
        for N, d in srcs:
            shutil.copytree(d, k / f"mock-test-{N}", dirs_exist_ok=True)
    shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__": main()
