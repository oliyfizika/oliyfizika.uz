#!/usr/bin/env python3
"""36–45 ochiq savollar javob kaliti auditi (a/b qismlar). FAQAT O'QIYDI — dataset / app-data / audit fayllari o'zgarmaydi.

  python3 tools/real-imtihonlar/audit/build_open_answer_audit.py

Har bir qism uchun: manba kaliti (PDF) → mustaqil audit javobi → hozirgi yakuniy javob (app-data) → parse (son, daraja, birlik)
→ so'ralgan birlik (savol matnidan) → muvofiqlik → bayroqlar → holat.
TOLERANS VA MOSLASH QOIDASI YOZILMAYDI (null, PENDING_SARVAR_DECISION). Noaniq har qanday holat → NEEDS_MANUAL_REVIEW.
Natija: _private/real-imtihonlar/audit/open-answer-key-audit.json, open-answer-key-audit.md (maxfiy, javoblar bor),
        docs/real-imtihonlar/06_open_answer_key_audit.md (ommaviy: faqat sonlar va kategoriyalar, javobsiz).
"""
import glob
import json
import os
import re
import unicodedata
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
STATUS_RE = re.compile(r"^(KEY MISSING|VERIFIED|NEEDS MANUAL REVIEW|AMBIGUOUS|KEY ERROR|OCR)")
SUPMAP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
NUM_RE = re.compile(
    r"^(?P<approx>[≈~]\s*)?(?P<sign>[−\-+])?\s*(?P<mant>\d+(?:[.,]\d+)?)"
    r"(?:\s*[·×x*]\s*10(?P<exp>[⁻−\-]?[⁰¹²³⁴⁵⁶⁷⁸⁹\d]+))?\s*(?P<rest>.*)$")
UNIT_WORDS = re.compile(r"^[A-Za-zΩµμ°%/·²³⁻¹\s\-().]*$")  # birlikka o'xshash qoldiq (so'zsiz)
SIGN_WORDS = re.compile(r"(ortgan|kamaygan|ortadi|kamayadi|marta|ga|dan|holat|nur|hech|yo'q|yo‘q)", re.I)


def tex_unit(t):
    """Savol qismidagi oxirgi (…) ichidagi birlik; TeX belgilarini tozalaydi."""
    m = re.findall(r"\(([^()]*(?:\([^()]*\)[^()]*)*)\)", t or "")
    if not m:
        return None
    u = m[-1]
    u = re.sub(r"\\(mathrm|text|operatorname)\{([^}]*)\}", r"\2", u)
    u = u.replace("$", "").replace("{", "").replace("}", "").replace("\\cdot", "·").replace("\\Omega", "Ω").replace("\\mu", "µ")
    u = u.replace("\\ell", "l").replace("\\%", "%").replace("^\\circ", "°").replace("\\circ", "°").replace("\\,", " ").replace("\\ ", " ")
    u = re.sub(r"\^\s*(-?\d+)", lambda mm: mm.group(1).translate(str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")), u)
    u = u.strip()
    # birlik bo'lmasa (masalan "(tinch holatda)") — None
    if not u or len(u) > 16 or re.search(r"[a-z]{5,}", u) and not re.search(r"(kelvin|marta)", u):
        return None
    return u


def unit_norm(u):
    if u is None:
        return None
    u = unicodedata.normalize("NFKC", u).replace("μ", "µ").replace(" ", "").replace("·", "").replace("*", "")
    u = u.replace("Om", "Ω").replace("ohm", "Ω").replace("°C", "°C").replace("º", "°")
    u = re.sub(r"^1/([a-zµ]+)$", r"\1−1", u)
    return u.lower()


SUPD = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")


def detex(s):
    """Javobdagi oddiy TeX ni matnga aylantiradi (faqat parse uchun; asl matn o'zgarmaydi)."""
    s = s.replace("$", "")
    s = re.sub(r"\\(mathrm|text)\{([^}]*)\}", r"\2", s)
    s = s.replace("{,}", ",").replace("\\cdot", "·").replace("\\approx", "≈").replace("\\,", " ").replace("\\ ", " ")
    s = s.replace("\\ell", "l").replace("\\Omega", "Ω").replace("\\mu", "µ")
    s = re.sub(r"\^\{?(-?\d+)\}?", lambda m: m.group(1).translate(SUPD), s)
    return re.sub(r"\s+", " ", s).strip()


def parse_value(s):
    s = detex((s or "").strip())
    exact = None
    if "≈" in s and not s.startswith("≈"):
        left, right = s.split("≈", 1)
        if re.search(r"[A-Za-z√/\\πc]", left.split("=")[-1]) or "/" in left or "√" in left:
            exact, s = left.strip(), "≈" + right.strip()
    if not s or "javob yo" in s:
        return {"kind": "NONE"}
    m = NUM_RE.match(s)
    if not m:
        return {"kind": "SYMBOLIC_OR_TEXT", "raw": s}
    mant = m.group("mant")
    val = float(mant.replace(",", "."))
    exp = m.group("exp")
    e = int(exp.translate(SUPMAP).replace("−", "-")) if exp else 0
    sign = -1 if (m.group("sign") or "") in ("−", "-") else 1
    rest = m.group("rest").strip()
    digits = re.sub(r"[^\d]", "", mant).lstrip("0") or "0"
    out = {"value": sign * val * 10 ** e, "mantissa": mant, "exp10": e, "approx": bool(m.group("approx")),
           "signed": (m.group("sign") or "") in ("−", "-", "+"), "sigDigitsShown": len(digits), "rest": rest}
    if exact:
        out["exactForm"] = exact
    if re.match(r"^[A-Za-zα-ωΑ-Ω]", m.group("rest")) and not re.search(r"\s", s[m.start("rest") - 1:m.start("rest")]) \
            and not re.match(r"^(m|s|J|N|K|W|V|A|C|Hz|Pa|g|l|cm|mm|km|kg|eV|dptr|lm|lx|Ω)\b", m.group("rest")) or re.match(r"^[A-Za-z]{1,2}/\d", m.group("rest")):
        return {"kind": "SYMBOLIC_OR_TEXT", "raw": s}
    if re.match(r"^\s*0,\d+[Ac]$|^\d+(,\d+)?[cE]$", s):
        return {"kind": "SYMBOLIC_OR_TEXT", "raw": s}
    if rest and (SIGN_WORDS.search(rest) or not UNIT_WORDS.match(rest)):
        out["kind"] = "NUMERIC_WITH_QUALIFIER"
        out["unit"] = None
    else:
        out["kind"] = "NUMERIC"
        out["unit"] = rest or None
    return out


def key_rows():
    rows = {}
    for f in sorted(glob.glob(os.path.join(PRIV, "audit", "[01][0-9]_REAL-*.md"))):
        if "SOLUTIONS" in f:
            continue
        eid = re.search(r"_(REAL-[0-9A-B-]+)\.md$", f).group(1)
        for line in open(f, encoding="utf-8"):
            m = re.match(r"^\| ?((3[6-9]|4[0-5])([ab])) \|(.*)\|\s*$", line)
            if not m:
                continue
            cells = [c.strip() for c in m.group(4).split("|")]
            i = next(k for k in range(1, len(cells)) if STATUS_RE.match(cells[k]))
            rows[(eid, int(m.group(2)), m.group(3))] = {
                "sourceKey": None if cells[0] in ("—", "-", "") else cells[0],
                "independentAnswer": "|".join(cells[1:i]).strip(),
                "auditStatus": cells[i],
                "auditNote": "|".join(cells[i + 1:]).strip(),
                "auditFile": "audit/" + os.path.basename(f),
            }
    return rows


def split_answer(t):
    m = re.match(r"^\s*a\)\s*(.*?);\s*b\)\s*(.*)$", t or "", re.S)
    return {"a": m.group(1).strip(), "b": m.group(2).strip()} if m else {"a": None, "b": None}


def main():
    keys = key_rows()
    items = []
    for qp in sorted(glob.glob(os.path.join(PRIV, "app-data", "exams", "*", "questions.json"))):
        eid = os.path.basename(os.path.dirname(qp))
        qs = {q["questionNumber"]: q for q in json.load(open(qp, encoding="utf-8"))["questions"]}
        ss = {s["questionNumber"]: s for s in json.load(open(qp.replace("questions.json", "solutions.json"), encoding="utf-8"))["solutions"]}
        for n in range(36, 46):
            q, s = qs[n], ss[n]
            ans = split_answer(s["answer"]["text"])
            for part in q["parts"]:
                pk = part["key"]
                k = keys.get((eid, n, pk), {})
                final = ans.get(pk)
                pv = parse_value(final)
                asked = tex_unit(part["text"])
                flags, reasons = [], []
                st_sol = s["partSolutionStatus"].get(pk, s["solutionStatus"])
                if st_sol != "FINAL":
                    flags.append("SOLUTION_NOT_FINAL")
                    reasons.append(f"yechim holati {st_sol}")
                if "NEEDS MANUAL" in k.get("auditStatus", "") or "AMBIG" in k.get("auditStatus", ""):
                    flags.append("AUDIT_MANUAL_OR_AMBIGUOUS")
                    reasons.append("audit holati: " + k["auditStatus"])
                if "finalized" in k.get("auditStatus", ""):
                    flags.append("FINALIZED_BY_DECISION")
                if "ASSUMPTION" in k.get("auditStatus", "") or "SIGN CONVENTION" in k.get("auditStatus", "") or "SOURCE KEY ERROR" in k.get("auditStatus", ""):
                    flags.append("AUDIT_NOTE_STATUS")
                    reasons.append("audit holati: " + k["auditStatus"])
                if k.get("sourceKey") is None:
                    flags.append("SOURCE_KEY_MISSING")
                elif k.get("sourceKey") and "SOURCE KEY ERROR" in k.get("auditStatus", ""):
                    flags.append("SOURCE_KEY_DIFFERS")
                    reasons.append(f"manba kaliti ({k['sourceKey']}) yakuniy javobdan farq qiladi")
                note = k.get("auditNote", "") + " " + " ".join(b.get("text", "") for b in s.get("blocks", []))
                if "π" in note and re.search(r"π\s*[≈=]\s*3(?![,.]\d)", note):
                    flags.append("PI_APPROX_3")
                    reasons.append("yechimda π ≈ 3 olingan — π = 3,14 bilan javob boshqacha chiqadi")
                if re.search(r"jadval", k.get("auditNote", ""), re.I):
                    flags.append("TABLE_CONSTANT")
                    reasons.append("javob jadval doimiysiga bog'liq (qiymat manbaga qarab farq qilishi mumkin)")
                if pv["kind"] == "NONE":
                    reasons.append("yakuniy javob yo'q")
                elif pv["kind"] == "SYMBOLIC_OR_TEXT":
                    reasons.append("javob son emas (formula yoki matn) — moslash qoidasi kerak")
                elif pv["kind"] == "NUMERIC_WITH_QUALIFIER":
                    reasons.append(f"son + izoh ('{pv['rest']}') — sonmi, matnmi qabul qilinadi, aniqlash kerak")
                if pv.get("exactForm"):
                    flags.append("EXACT_FORM_GIVEN")
                    reasons.append(f"aniq ko'rinish ({pv['exactForm']}) va taqribiy son berilgan — qaysi biri qabul qilinadi")
                if pv.get("approx"):
                    flags.append("APPROX_SIGN")
                    reasons.append("javobda ≈ — yaxlitlash darajasi aniqlanishi kerak")
                if pv.get("signed") and pv.get("value", 0) < 0:
                    flags.append("NEGATIVE_VALUE")
                    reasons.append("manfiy qiymat — ishora talab qilinadimi, aniqlash kerak")
                unit_status = None
                if pv["kind"] == "NUMERIC":
                    au, qu = unit_norm(pv.get("unit")), unit_norm(asked)
                    if qu is None and au is None:
                        unit_status = "NO_UNIT"
                    elif qu is None:
                        unit_status = "UNIT_NOT_ASKED"
                    elif au is None:
                        unit_status = "UNIT_ONLY_IN_QUESTION"
                    elif au == qu:
                        unit_status = "MATCH"
                    elif re.match(r"^10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+", asked or ""):
                        unit_status = "SCALED_UNIT"
                        reasons.append(f"savolda birlik '{asked}' (10ⁿ ko'paytuvchi bilan) — o'quvchi mantissani kiritadi, kalit shunga moslanishi kerak")
                    else:
                        unit_status = "MISMATCH"
                        reasons.append(f"birlik farqi: so'ralgan '{asked}', javobda '{pv.get('unit')}'")
                    if unit_status == "UNIT_NOT_ASKED":
                        reasons.append(f"savolda birlik ko'rsatilmagan, javobda '{pv.get('unit')}' — o'quvchi qaysi birlikda kiritadi, aniqlash kerak")
                simple = (pv["kind"] == "NUMERIC" and unit_status in ("MATCH", "UNIT_ONLY_IN_QUESTION", "NO_UNIT")
                          and not set(flags) & {"SOLUTION_NOT_FINAL", "AUDIT_MANUAL_OR_AMBIGUOUS", "AUDIT_NOTE_STATUS", "SOURCE_KEY_DIFFERS",
                                                 "PI_APPROX_3", "TABLE_CONSTANT", "APPROX_SIGN", "NEGATIVE_VALUE"})
                if simple:
                    category = "SIMPLE_NUMERIC"
                elif pv["kind"] in ("NONE",) or set(flags) & {"SOLUTION_NOT_FINAL", "AUDIT_MANUAL_OR_AMBIGUOUS"}:
                    category = "BLOCKED"
                elif pv["kind"] == "SYMBOLIC_OR_TEXT":
                    category = "NON_NUMERIC"
                elif pv["kind"] == "NUMERIC_WITH_QUALIFIER":
                    category = "NUMERIC_WITH_QUALIFIER"
                else:
                    category = "NUMERIC_NEEDS_DECISION"
                items.append({
                    "examId": eid, "questionNumber": n, "part": pk, "partId": f"{eid}-q{n:02d}{pk}",
                    "partText": part["text"],
                    "sourceKey": k.get("sourceKey"), "independentAnswer": k.get("independentAnswer"),
                    "auditStatus": k.get("auditStatus"), "auditNote": k.get("auditNote"), "auditFile": k.get("auditFile"),
                    "finalAnswerText": final, "solutionStatus": st_sol,
                    "parsed": pv, "askedUnit": asked, "unitStatus": unit_status,
                    "normalized": ({"value": pv["value"], "unit": pv.get("unit") or asked} if category == "SIMPLE_NUMERIC" else None),
                    "tolerance": None, "matchRule": None, "toleranceStatus": "PENDING_SARVAR_DECISION",
                    "category": category, "flags": flags, "reasons": reasons,
                    "status": "KEY_SPEC_READY_TOLERANCE_PENDING" if category == "SIMPLE_NUMERIC" else "NEEDS_MANUAL_REVIEW",
                })
    cats = Counter(i["category"] for i in items)
    fl = Counter(f for i in items for f in i["flags"])
    doc = {"schemaVersion": 1, "status": "PENDING_SARVAR_REVIEW",
           "rules": ["dataset / app-data / audit fayllari o'zgartirilmagan", "tolerans va moslash qoidasi yozilmagan (null)",
                     "noaniq har qanday holat NEEDS_MANUAL_REVIEW", "normalized faqat SIMPLE_NUMERIC uchun (javobdagi son va birlik, qayta hisoblanmagan)"],
           "summary": {"parts": len(items), "byCategory": dict(cats), "byFlag": dict(fl),
                       "byStatus": dict(Counter(i["status"] for i in items))},
           "items": items}
    os.makedirs(os.path.join(PRIV, "audit"), exist_ok=True)
    json.dump(doc, open(os.path.join(PRIV, "audit", "open-answer-key-audit.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_private_md(doc, os.path.join(PRIV, "audit", "open-answer-key-audit.md"))
    write_public_md(doc, os.path.join(ROOT, "docs", "real-imtihonlar", "06_open_answer_key_audit.md"))
    print(json.dumps(doc["summary"], ensure_ascii=False, indent=1))


CAT_TXT = {
    "SIMPLE_NUMERIC": "bitta son, birlik so'ralganga mos, bayroq yo'q — faqat tolerans qarori kerak",
    "NUMERIC_NEEDS_DECISION": "son, lekin ≈ / π≈3 / jadval doimiysi / manfiy / birlik farqi kabi bayroq bor",
    "NUMERIC_WITH_QUALIFIER": "son + so'z (masalan 'marta kamayadi', 'ga ortgan') — kiritish formati qarori kerak",
    "NON_NUMERIC": "formula yoki matn javob — moslash qoidasi (text/accept) kerak",
    "BLOCKED": "yakuniy javob yo'q yoki NEEDS_MANUAL_REVIEW / AMBIGUOUS — avval mazmun qarori kerak",
}


def write_private_md(doc, path):
    s = doc["summary"]
    L = ["# 36–45 ochiq savollar — javob kaliti auditi (MAXFIY: javoblar bor)", "",
         "Holat: **PENDING_SARVAR_REVIEW**. Tolerans va moslash qoidasi yozilmagan. Dataset o'zgartirilmagan.", "",
         f"Qismlar: **{s['parts']}**. Kategoriyalar: " + ", ".join(f"{k} {v}" for k, v in sorted(s["byCategory"].items())), "",
         "Bayroqlar: " + ", ".join(f"{k} {v}" for k, v in sorted(s["byFlag"].items())), ""]
    for cat in ("BLOCKED", "NON_NUMERIC", "NUMERIC_WITH_QUALIFIER", "NUMERIC_NEEDS_DECISION", "SIMPLE_NUMERIC"):
        rows = [i for i in doc["items"] if i["category"] == cat]
        L += [f"## {cat} — {len(rows)} ta", "", CAT_TXT[cat], "",
              "| Qism | Manba kaliti | Mustaqil javob | Yakuniy javob | So'ralgan birlik | Birlik holati | Bayroqlar / sabab |",
              "|---|---|---|---|---|---|---|"]
        for i in rows:
            r = "; ".join(i["reasons"]) or ", ".join(i["flags"]) or "—"
            cell = lambda x: (x or "—").replace("|", "\\|")
            L.append(f"| {i['examId'][5:]} #{i['questionNumber']}{i['part']} | {cell(i['sourceKey'])} | {cell(i['independentAnswer'])} | "
                     f"{cell(i['finalAnswerText'])} | {cell(i['askedUnit'])} | {i['unitStatus'] or '—'} | {cell(r)} |")
        L.append("")
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public_md(doc, path):
    s = doc["summary"]
    L = ["# 36–45 ochiq savollar — javob kaliti auditi (ommaviy xulosa)", "",
         "Holat: **PENDING_SARVAR_REVIEW**. Bu faylda javoblar yo'q; to'liq jadval maxfiy: "
         "`_private/real-imtihonlar/audit/open-answer-key-audit.{json,md}`.", "",
         "Tolerans va moslash qoidasi **yozilmagan** — har biri Sarvar qarori bilan.", "",
         f"Jami qismlar: **{s['parts']}** (12 imtihon × 10 savol × a/b).", "",
         "| Kategoriya | Soni | Ma'nosi |", "|---|---:|---|"]
    for cat in ("SIMPLE_NUMERIC", "NUMERIC_NEEDS_DECISION", "NUMERIC_WITH_QUALIFIER", "NON_NUMERIC", "BLOCKED"):
        L.append(f"| {cat} | {s['byCategory'].get(cat, 0)} | {CAT_TXT[cat]} |")
    L += ["", "| Imtihon | SIMPLE | NEEDS_DECISION | QUALIFIER | NON_NUMERIC | BLOCKED |", "|---|---:|---:|---:|---:|---:|"]
    by = {}
    for i in doc["items"]:
        by.setdefault(i["examId"], Counter())[i["category"]] += 1
    for e, c in sorted(by.items()):
        L.append(f"| {e} | {c['SIMPLE_NUMERIC']} | {c['NUMERIC_NEEDS_DECISION']} | {c['NUMERIC_WITH_QUALIFIER']} | {c['NON_NUMERIC']} | {c['BLOCKED']} |")
    L += ["", "Bayroqlar: " + ", ".join(f"{k} {v}" for k, v in sorted(s["byFlag"].items()))]
    open(path, "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
