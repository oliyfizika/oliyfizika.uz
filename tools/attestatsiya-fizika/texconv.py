r"""
LaTeX (attestatsiya kitobi) -> xavfsiz web bloklari.

Blok turlari (JSON):
  {"t":"p",      "text": INLINE}
  {"t":"math",   "tex": "..."}                         display formula ($$…$$ ekvivalenti)
  {"t":"list",   "ordered": bool, "label": "1)"|"a)"|"•", "items": [[Block…], …]}
  {"t":"table",  "rows": [[{"blocks":[Block…], "colspan": n?}, …], …]}
  {"t":"figure", "fig": "<figure key>"}                 rasm (TikZ->SVG yoki PNG->WebP); key -> manifest
  {"t":"given"|"answer"|"check"|"status", "kind"?:..., "blocks":[Block…]}   (faqat yechimlarda)
  {"t":"heading","text": "Yechim"}

INLINE format (bitta qat'iy standart):
  * formulalar faqat  $ … $  ichida (KaTeX inline); display formulalar alohida "math" blok;
  * **qalin**, *kursiv*; "\n" — qator uzilishi;
  * matndagi \ $ * belgilar "\" bilan ekranlanadi.
"""
import hashlib
import re

# KaTeX qo'llamaydigan yoki boshqacha nomlangan makrolar (formulalar ichida)
MATH_MACROS = [
    (r"\upmu", r"\mu"),
    (r"\upOmega", r"\Omega"),
    (r"\uppi", r"\pi"),
    (r"\upalpha", r"\alpha"),
    (r"\upbeta", r"\beta"),
    (r"\upgamma", r"\gamma"),
]

TEXT_DROP_ARG = ["vspace*", "vspace", "hspace*", "hspace", "phantom", "needspace", "toifa", "label"]
TEXT_DROP = ["tekshir", "small", "footnotesize", "scriptsize", "normalsize", "large", "centering",
             "raggedright", "noindent", "smallskip", "medskip", "bigskip", "par", "arraybackslash", "hfill",
             "newpage", "linebreak", "nopagebreak", "displaystyle"]


class ConvError(Exception):
    pass


def read_group(s, i, open_="{", close="}"):
    """s[i] == open_ -> (ichki matn, keyingi indeks)."""
    if i >= len(s) or s[i] != open_:
        raise ConvError(f"'{open_}' kutilgan: {s[i:i+40]!r}")
    depth, j = 0, i
    while j < len(s):
        c = s[j]
        if c == "\\":
            j += 2
            continue
        if c == open_:
            depth += 1
        elif c == close:
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
        j += 1
    raise ConvError(f"yopilmagan '{open_}': {s[i:i+60]!r}")


def skip_ws(s, i):
    while i < len(s) and s[i] in " \t":
        i += 1
    return i


def read_opt(s, i):
    i2 = skip_ws(s, i)
    if i2 < len(s) and s[i2] == "[":
        inner, j = read_group(s, i2, "[", "]")
        return inner, j
    return None, i


def find_env_end(s, i, env):
    """s[i:] '\\begin{env}' dan keyingi joy; mos '\\end{env}' ni topadi (ichma-ich hisobga olinadi)."""
    depth = 1
    pat = re.compile(r"\\(begin|end)\{" + re.escape(env) + r"\}")
    for m in pat.finditer(s, i):
        depth += 1 if m.group(1) == "begin" else -1
        if depth == 0:
            return m.start(), m.end()
    raise ConvError(f"yopilmagan muhit {env}")


def strip_comments(s):
    out = []
    for line in s.split("\n"):
        m = re.search(r"(?<!\\)%", line)
        out.append(line[:m.start()] if m else line)
    return "\n".join(out)


def norm_math(tex):
    for a, b in MATH_MACROS:
        tex = re.sub(re.escape(a) + r"(?![a-zA-Z])", lambda _m, b=b: b, tex)
    return tex.strip()


def split_top(s, sep_regex):
    """Chuqurlik 0 dagi (qavslar, $…$, muhitlar tashqarisidagi) ajratgich bo'yicha bo'lish."""
    parts, depth, env, inmath, last, i = [], 0, 0, False, 0, 0
    rx = re.compile(sep_regex)
    while i < len(s):
        c = s[i]
        if c == "\\":
            if s.startswith("\\begin{", i):
                env += 1
            elif s.startswith("\\end{", i):
                env -= 1
            if depth == 0 and env == 0 and not inmath:
                m = rx.match(s, i)
                if m:
                    parts.append(s[last:i])
                    last = i = m.end()
                    continue
            i += 2
            continue
        if c == "$":
            inmath = not inmath
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif depth == 0 and env == 0 and not inmath:
            m = rx.match(s, i)
            if m:
                parts.append(s[last:i])
                last = i = m.end()
                continue
        i += 1
    parts.append(s[last:])
    return parts


class Converter:
    def __init__(self, figure_cb, image_cb):
        self.figure_cb = figure_cb      # (kind, source) -> figure key   (kind: tikz|circuitikz|tikzinline)
        self.image_cb = image_cb        # (filename) -> figure key
        self.warnings = []

    # ------------------------------------------------------------ inline
    def inline(self, s):
        out, i = [], 0
        s = s.replace("\r", "")
        while i < len(s):
            c = s[i]
            if c == "$":
                j = s.find("$", i + 1)
                if j < 0:
                    raise ConvError(f"yopilmagan $: {s[i:i+40]!r}")
                out.append("$" + norm_math(s[i + 1:j]) + "$")
                i = j + 1
                continue
            if c == "\\":
                m = re.match(r"\\([a-zA-Z]+\*?|.)", s[i:])
                name = m.group(1)
                i += len(m.group(0))
                if name == "\\":
                    _, i = read_opt(s, i)
                    out.append("\n")
                elif name in ("textbf", "textit", "emph", "underline", "text", "textrm", "textsf", "mbox"):
                    i = skip_ws(s, i)
                    inner, i = read_group(s, i)
                    t = self.inline(inner)
                    if name == "textbf":
                        out.append("**" + t + "**" if t.strip() else t)
                    elif name in ("textit", "emph"):
                        out.append("*" + t + "*" if t.strip() else t)
                    elif name == "underline" and not t.strip():
                        out.append("________")
                    else:
                        out.append(t)
                elif name in TEXT_DROP_ARG:
                    i = skip_ws(s, i)
                    if i < len(s) and s[i] == "{":
                        _, i = read_group(s, i)
                elif name in TEXT_DROP:
                    pass
                elif name in ("ldots", "dots"):
                    out.append("…")
                elif name in ("quad", "qquad"):
                    out.append("  ")
                elif name in (",", ";", " ", "thinspace"):
                    out.append(" ")
                elif name in ("%", "&", "#", "_", "{", "}"):
                    out.append(name)
                elif name == "$":
                    out.append("\\$")
                elif name == "newline":
                    out.append("\n")
                elif name == "raisebox":
                    i = skip_ws(s, i)
                    _, i = read_group(s, i)
                    _, i = read_opt(s, i)
                    _, i = read_opt(s, i)
                    i = skip_ws(s, i)
                    inner, i = read_group(s, i)
                    out.append(self.inline(inner))
                else:
                    raise ConvError(f"noma'lum matn makrosi \\{name}")
                continue
            if c == "~":
                out.append("\u00a0")
            elif c in "{}":
                pass
            elif c == "*":
                out.append("\\*")
            else:
                out.append(c)
            i += 1
        text = "".join(out)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n[ \t]+", "\n", text)
        text = re.sub(r"[ \t]{3,}", "  ", text)
        return text.strip(" \n")

    # ------------------------------------------------------------ blocks
    def blocks(self, s, allow_options=False, solution=False):
        """LaTeX parchasi -> bloklar. allow_options=True bo'lsa \\Alph enumerate 'options' sifatida qaytadi."""
        s = strip_comments(s)
        out, options, buf = [], None, []
        i = 0

        def flush():
            text = "".join(buf)
            buf.clear()
            for para in re.split(r"\n\s*\n", text):
                if para.strip():
                    t = self.inline(para)
                    if t:
                        out.append({"t": "p", "text": t})

        box_macros = {"shart": "given", "javob": "answer", "tekshiruv": "check",
                      "aniqlanmagan": "undetermined", "manbaxato": "source_error", "muhimxato": "critical"}
        figure_envs = ("tikzpicture", "circuitikz")
        while i < len(s):
            if s.startswith("\\begin{", i):
                env, j = read_group(s, i + 6)
                if env in figure_envs:
                    a, b = find_env_end(s, j, env)
                    flush()
                    out.append({"t": "figure", "fig": self.figure_cb(env, s[i:b])})
                    i = b
                    continue
                if env in ("chizma", "center", "flushleft"):
                    a, b = find_env_end(s, j, env)
                    flush()
                    out.extend(self.blocks(s[j:a], solution=solution))
                    i = b
                    continue
                if env in ("enumerate", "itemize"):
                    opt, j2 = read_opt(s, j)
                    a, b = find_env_end(s, j2, env)
                    items = [it for it in split_top(s[j2:a], r"\\item(?![a-zA-Z])")]
                    if items and items[0].strip():
                        raise ConvError(f"\\item dan oldin matn: {items[0][:40]!r}")
                    items = items[1:]
                    flush()
                    if env == "enumerate" and opt and "\\Alph" in opt and allow_options:
                        if options is not None:
                            raise ConvError("ikkinchi variantlar ro'yxati")
                        options = [self.blocks(it, solution=solution) for it in items]
                    else:
                        label = "•"
                        if env == "enumerate":
                            label = "a)" if opt and "\\alph" in opt else "1)"
                            if opt and "\\Alph" in opt:
                                label = "A)"
                        out.append({"t": "list", "ordered": env == "enumerate", "label": label,
                                    "items": [self.blocks(it, solution=solution) for it in items]})
                    i = b
                    continue
                if env in ("tabular", "tabularx"):
                    j2 = j
                    if env == "tabularx":
                        _, j2 = read_group(s, skip_ws(s, j2))
                    _, j2 = read_group(s, skip_ws(s, j2))   # colspec
                    a, b = find_env_end(s, j2, env)
                    flush()
                    out.append(self.table(s[j2:a], solution))
                    i = b
                    continue
                if env in ("align*", "align", "equation*", "equation", "gather*"):
                    a, b = find_env_end(s, j, env)
                    flush()
                    body = s[j:a].strip()
                    tex = body if env.startswith("equation") else "\\begin{aligned}" + body + "\\end{aligned}"
                    if env.startswith("gather"):
                        tex = "\\begin{gathered}" + body + "\\end{gathered}"
                    out.append({"t": "math", "tex": norm_math(tex)})
                    i = b
                    continue
                raise ConvError(f"noma'lum muhit {env}")
            if s.startswith("\\[", i):
                j = s.find("\\]", i + 2)
                if j < 0:
                    raise ConvError("yopilmagan \\[")
                flush()
                out.append({"t": "math", "tex": norm_math(s[i + 2:j])})
                i = j + 2
                continue
            m = re.match(r"\\(rasm|includegraphics)(?![a-zA-Z])", s[i:])
            if m:
                k = i + len(m.group(0))
                _, k = read_opt(s, k)
                fname, k = read_group(s, skip_ws(s, k))
                flush()
                out.append({"t": "figure", "fig": self.image_cb(fname.strip())})
                i = k
                continue
            m = re.match(r"\\raisebox(?![a-zA-Z])", s[i:])
            if m and "\\includegraphics" in s[i:i + 200]:
                k = skip_ws(s, i + len(m.group(0)))
                _, k = read_group(s, k)
                _, k = read_opt(s, k)
                _, k = read_opt(s, k)
                inner, k = read_group(s, skip_ws(s, k))
                flush()
                out.extend(self.blocks(inner, solution=solution))
                i = k
                continue
            m = re.match(r"\\tikz(?![a-zA-Z])", s[i:])
            if m:
                k = i + len(m.group(0))
                opt, k = read_opt(s, k)
                body, k = read_group(s, skip_ws(s, k))
                src = "\\begin{tikzpicture}" + (f"[{opt}]" if opt else "") + body + "\\end{tikzpicture}"
                flush()
                out.append({"t": "figure", "fig": self.figure_cb("tikzpicture", src), "inline": True})
                i = k
                continue
            if solution:
                m = re.match(r"\\(" + "|".join(box_macros) + r")(?![a-zA-Z])", s[i:])
                if m:
                    k = skip_ws(s, i + len(m.group(0)))
                    inner, k = read_group(s, k)
                    flush()
                    kind = box_macros[m.group(1)]
                    blk = {"t": kind if kind in ("given", "answer", "check") else "status",
                           "blocks": self.blocks(inner, solution=True)}
                    if blk["t"] == "status":
                        blk["kind"] = kind
                    out.append(blk)
                    i = k
                    continue
                if re.match(r"\\yechimsarlavha(?![a-zA-Z])", s[i:]):
                    flush()
                    out.append({"t": "heading", "text": "Yechim"})
                    i += len("\\yechimsarlavha")
                    continue
            if s.startswith("\\renewcommand", i):
                k = i + len("\\renewcommand")
                _, k = read_group(s, skip_ws(s, k))
                _, k = read_group(s, skip_ws(s, k))
                i = k
                continue
            if s[i] == "$":
                j = s.find("$", i + 1)
                if j < 0:
                    raise ConvError("yopilmagan $")
                buf.append(s[i:j + 1])
                i = j + 1
                continue
            buf.append(s[i])
            i += 1
        flush()
        if allow_options:
            return out, options
        return out

    def table(self, body, solution):
        body = re.sub(r"\\(hline|toprule|midrule|bottomrule)(?![a-zA-Z])", "", body)
        body = re.sub(r"\\cline\{[^}]*\}", "", body)
        body = re.sub(r"\\renewcommand\{\\arraystretch\}\{[^}]*\}", "", body)
        rows = []
        for raw in split_top(body, r"\\\\(\[[^\]]*\])?"):
            if not raw.strip():
                continue
            cells = []
            for cell in split_top(raw, r"&"):
                cell = cell.strip()
                colspan = 1
                m = re.match(r"\\multicolumn\s*\{(\d+)\}", cell)
                if m:
                    colspan = int(m.group(1))
                    k = m.end()
                    _, k = read_group(cell, skip_ws(cell, k))
                    inner, k = read_group(cell, skip_ws(cell, k))
                    cell = inner + cell[k:]
                c = {"blocks": self.blocks(cell, solution=solution)}
                if colspan > 1:
                    c["colspan"] = colspan
                cells.append(c)
            rows.append(cells)
        return {"t": "table", "rows": rows}


def walk_text(blocks):
    """Barcha inline matnlar va formulalarni beradi (validatsiya uchun)."""
    for b in blocks:
        if "text" in b and b["t"] != "heading":
            yield "text", b["text"]
        if b["t"] == "math":
            yield "math", b["tex"]
        for key in ("blocks",):
            if key in b:
                yield from walk_text(b[key])
        if b["t"] == "list":
            for it in b["items"]:
                yield from walk_text(it)
        if b["t"] == "table":
            for row in b["rows"]:
                for c in row:
                    yield from walk_text(c["blocks"])


def walk_figs(blocks):
    for b in blocks:
        if b["t"] == "figure":
            yield b["fig"]
        if "blocks" in b:
            yield from walk_figs(b["blocks"])
        if b["t"] == "list":
            for it in b["items"]:
                yield from walk_figs(it)
        if b["t"] == "table":
            for row in b["rows"]:
                for c in row:
                    yield from walk_figs(c["blocks"])


def inline_math_segments(text):
    """INLINE matndagi $…$ formulalar (ekranlangan \\$ hisobga olinadi)."""
    segs, i = [], 0
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == "$":
            j = i + 1
            while j < len(text) and text[j] != "$":
                j += 2 if text[j] == "\\" else 1
            segs.append(text[i + 1:j])
            i = j + 1
            continue
        i += 1
    return segs


def sha16(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()[:16]
