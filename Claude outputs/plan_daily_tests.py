#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: 1027 savol auditi va Daily Test rejasi (1-bosqich).

Kirish (o'zgartirilmaydi, faqat o'qiladi):
  attestatsiya/fizika/ATT_EST solutions/_build/solutions_src/problems.json   (1027 savol, LaTeX)
  attestatsiya/fizika/ATT_EST solutions/_build/solutions_src/C*.sol          (1027 yechim)

Chiqish (javob/yechim YO'Q — faqat ID va hisoblar, ommaga chiqsa ham xavfsiz):
  docs/attestatsiya-fizika/daily_test_plan.json
  docs/attestatsiya-fizika/_audit.json

Ishga tushirish (repo ildizidan):  python3 tools/attestatsiya-fizika/plan_daily_tests.py
Deterministik: bir xil kirish -> bir xil reja.
"""
import glob
import hashlib
import json
import os
import re
import sys
from collections import Counter, OrderedDict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "attestatsiya", "fizika", "ATT_EST solutions", "_build", "solutions_src")
OUT = os.path.join(ROOT, "docs", "attestatsiya-fizika")

MIN_Q, MAX_Q, TARGET_Q = 25, 40, 33

SECTIONS = OrderedDict([
    (1, ("mexanika", "Mexanika")),
    (2, ("molekulyar", "Molekulyar fizika va termodinamika")),
    (3, ("elektromagnetizm", "Elektromagnetizm")),
    (4, ("optika", "Optika")),
    (5, ("atom-yadro", "Atom va yadro fizikasi")),
    (6, ("maxsus", "Maxsus mavzular")),
])

# Mavzular tartibi = asosiy kitobdagi tartib (problems.json `num` bo'yicha tekshiriladi).
# Qo'shni mavzular orasidagi "mantiqiy bog'liqlik narxi": 1 — juda yaqin, 3 — maqbul, 6+ — kuchsiz.
# Ikki mavzu bir kunga birlashtirilsa, shu narx to'lanadi -> algoritm mantiqsiz birikmalardan qochadi.
LINK = {
    ("Kinematika", "Dinamika"): 1,
    ("Dinamika", "Statika"): 2,
    ("Statika", "Ish, energiya, quvvat"): 4,
    ("Ish, energiya, quvvat", "Impuls"): 1,            # saqlanish qonunlari
    ("Impuls", "Gravitatsiya"): 3,
    ("Gravitatsiya", "Suyuqlik va gazlar mexanikasi"): 4,
    ("Suyuqlik va gazlar mexanikasi", "Tebranish va to‘lqinlar"): 5,
    ("Molekulyar-kinetik nazariya", "Ideal gaz va gaz qonunlari"): 1,
    ("Ideal gaz va gaz qonunlari", "Termodinamika"): 1,
    ("Termodinamika", "Issiqlik mashinalari"): 1,
    ("Issiqlik mashinalari", "Entropiya"): 1,
    ("Entropiya", "Issiqlik almashinuvi"): 3,
    ("Elektrostatika", "Doimiy tok va elektr zanjirlari"): 2,
    ("Doimiy tok va elektr zanjirlari", "Magnit maydon"): 2,
    ("Magnit maydon", "Elektromagnit induksiya"): 1,
    ("Elektromagnit induksiya", "O‘zgaruvchan tok"): 1,
    ("O‘zgaruvchan tok", "Elektromagnit tebranishlar va to‘lqinlar"): 1,
    ("Geometrik optika", "Yorug‘likning qaytishi va sinishi"): 1,
    ("Yorug‘likning qaytishi va sinishi", "Linzalar"): 2,
    ("Linzalar", "Ko‘zgular"): 1,
    ("Ko‘zgular", "Interferensiya"): 5,
    ("Interferensiya", "Difraksiya"): 1,
    ("Difraksiya", "Polarizatsiya"): 1,
    ("Atom fizikasi", "Kvant fizikasi"): 2,
    ("Kvant fizikasi", "Fotoeffekt"): 1,
    ("Fotoeffekt", "Kompton effekti"): 1,
    ("Kompton effekti", "Bor modeli"): 3,
    ("Bor modeli", "Spektrlar"): 1,
    ("Spektrlar", "Radioaktivlik"): 4,
    ("Radioaktivlik", "Yadro reaksiyalari"): 1,
    ("Yadro reaksiyalari", "Yadro fizikasi"): 1,
    ("Maxsus nisbiylik nazariyasi", "Astronomiya"): 3,
    ("Astronomiya", "O‘lchash va birliklar"): 6,
    ("O‘lchash va birliklar", "Fizika o‘qitish metodikasi"): 3,
    ("Fizika o‘qitish metodikasi", "Boshqa mavzular"): 2,
}

# Mavzu ichida kesish narxi (kun chegarasi mavzu o'rtasidan o'tsa):
CUT_BIG = 1      # mavzu > 40 — bo'linishi shart, arzon
CUT_SMALL = 6    # mavzu < 25 — kichik mavzuni ikkiga ajratish istalmaydi
CUT_FIT = 14     # mavzu 25–40 — u o'zi bitta kun bo'lishi kerak edi, eng qimmat
MERGE_WEIGHT = 2
BALANCE_WEIGHT = 1 / 40


def load():
    problems = json.load(open(os.path.join(SRC, "problems.json"), encoding="utf-8"))
    sol = {}
    for f in sorted(glob.glob(os.path.join(SRC, "*.sol"))):
        for block in open(f, encoding="utf-8").read().split("%%% S ")[1:]:
            head, _, body = block.partition("%%% BODY")
            lines = head.split("\n")
            meta = {}
            for line in lines[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.split("#")[0].strip()
            meta["bookNumber"] = lines[0].strip()
            meta["hasBody"] = bool(body.split("%%% END")[0].strip())
            if meta["id"] in sol:
                sys.exit(f"Yechim ikki marta: {meta['id']}")
            sol[meta["id"]] = meta
    # Qiyinlik va manba raqami — ajratib olish bosqichidagi .qtx fayllardan (problems.json'da yo'q)
    qtx = {}
    for f in sorted(glob.glob(os.path.join(SRC, "..", "extract", "F*.qtx"))):
        for block in open(f, encoding="utf-8").read().split("%%% Q")[1:]:
            head = block.split("%%% BODY")[0]
            meta = {}
            for line in head.strip().split("\n"):
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.split("  #")[0].strip()
            if "id" in meta:
                qtx[meta["id"]] = meta
    for p in problems:
        m = qtx.get(p["id"], {})
        try:
            p["difficulty"] = int(m.get("difficulty", ""))
        except ValueError:
            p["difficulty"] = None
    return problems, sol


def qid(p):
    return f"AF-{p['ch']}-{p['num']:03d}"


def norm_text(tex):
    t = re.sub(r"\\begin\{tikzpicture\}.*?\\end\{tikzpicture\}", " ", tex, flags=re.S)
    t = re.sub(r"\\[a-zA-Z]+|[{}$\\\[\]()~,.;:!?«»\"'’‘`-]", " ", t)
    return re.sub(r"\s+", " ", t).strip().lower()


def scoring_of(p, s):
    """Avtomatik baholash mumkinmi? (mumkin bo'lmasa savol yo'qolmaydi — 'baholanmaydi' bo'ladi)."""
    letters = "ABCDE"[: p["nopts"]]
    result = s.get("result", "none")
    if p["nopts"] == 0:
        return "self-check", "variantsiz (ochiq) savol — yechim bilan o'zini tekshiradi"
    if s["status"] in ("undetermined", "source_error"):
        return "excluded", f"yechim holati: {s['status']}"
    if s.get("verify") == "XATO":
        return "excluded", "kitob javobi yechim bilan mos emas (MUHIM XATO)"
    if len(result) != 1 or result not in letters:
        return "excluded", f"bir qiymatli harf javob yo'q ({result})"
    return "auto", ""


def topic_order(problems):
    order = OrderedDict()
    for p in sorted(problems, key=lambda p: (p["ch"], p["num"])):
        order.setdefault(p["ch"], [])
        if not order[p["ch"]] or order[p["ch"]][-1] != p["section"]:
            if p["section"] in order[p["ch"]]:
                sys.exit(f"Mavzu kitobda uzluksiz emas: {p['section']}")
            order[p["ch"]].append(p["section"])
    return order


def plan_chapter(items, sizes):
    """items: savollar (kitob tartibida), har birida 'topic'. DP: kesish nuqtalarini topadi."""
    n = len(items)
    INF = float("inf")
    topic_at = [it["topic"] for it in items]

    def seg_cost(i, j):  # [i, j)
        L = j - i
        if L < MIN_Q or L > MAX_Q:
            return INF
        cost = (L - TARGET_Q) ** 2 * BALANCE_WEIGHT
        for k in range(i + 1, j):
            if topic_at[k] != topic_at[k - 1]:
                pair = (topic_at[k - 1], topic_at[k])
                if pair not in LINK:
                    sys.exit(f"LINK jadvalida yo'q: {pair}")
                cost += LINK[pair] * MERGE_WEIGHT
        if j < n and topic_at[j] == topic_at[j - 1]:  # kesish mavzu ichidan o'tdi
            size = sizes[topic_at[j]]
            cost += CUT_BIG if size > MAX_Q else CUT_FIT if size >= MIN_Q else CUT_SMALL
        return cost

    best = [INF] * (n + 1)
    prev = [-1] * (n + 1)
    best[0] = 0
    for j in range(1, n + 1):
        for i in range(max(0, j - MAX_Q), j - MIN_Q + 1):
            if best[i] == INF:
                continue
            c = best[i] + seg_cost(i, j)
            if c < best[j]:
                best[j], prev[j] = c, i
    if best[n] == INF:
        sys.exit("Bo'limni 25–40 oralig'ida bo'lib bo'lmadi")
    cuts, j = [], n
    while j > 0:
        cuts.append((prev[j], j))
        j = prev[j]
    return list(reversed(cuts)), best[n]


def main():
    problems, sol = load()
    report = OrderedDict()
    ids = [p["id"] for p in problems]

    # ---------------- audit
    exact = Counter(norm_text(p["tex"]) for p in problems)
    exact_dups = sum(c - 1 for c in exact.values() if c > 1)
    fp = Counter(p["fingerprint"].strip().lower() for p in problems)
    report["input_extracted_from_pdfs"] = 1167          # 00_fayllar_tahlili.md
    report["merged_duplicates_before_book"] = 140        # 02_duplicates_report.md
    report["input_questions"] = len(problems)
    report["unique_source_ids"] = len(set(ids))
    report["solutions"] = len(sol)
    report["missing_solution"] = [i for i in ids if i not in sol]
    report["solution_without_problem"] = [i for i in sol if i not in set(ids)]
    report["exact_text_duplicates_remaining"] = exact_dups
    report["fingerprint_duplicates_remaining"] = sum(c - 1 for c in fp.values() if c > 1)

    order = topic_order(problems)
    for p in problems:
        p["qid"] = qid(p)
        p["topic"] = p["section"]
        p["scoring"], p["scoringNote"] = scoring_of(p, sol[p["id"]])
    report["scoring"] = Counter(p["scoring"] for p in problems)
    report["types"] = Counter(p["type"] for p in problems)
    report["difficulty"] = Counter(str(p["difficulty"]) for p in problems)

    # ---------------- plan
    days, assigned = [], []
    day_no = 0
    for ch, topics in order.items():
        items = sorted([p for p in problems if p["ch"] == ch], key=lambda p: p["num"])
        sizes = Counter(p["topic"] for p in items)
        segs, _ = plan_chapter(items, sizes)
        sec_key, sec_name = SECTIONS[ch]
        for i, j in segs:
            day_no += 1
            chunk = items[i:j]
            tcount = OrderedDict()
            for p in chunk:
                tcount[p["topic"]] = tcount.get(p["topic"], 0) + 1
            parts = []
            for t, c in tcount.items():
                parts.append({"topic": t, "count": c, "topicTotal": sizes[t],
                              "whole": c == sizes[t]})
            days.append(OrderedDict([
                ("id", f"att-fizika-day-{day_no:02d}"),
                ("dayNumber", day_no),
                ("section", sec_key),
                ("sectionTitle", sec_name),
                ("topics", list(tcount.keys())),
                ("topicParts", parts),
                ("questionIds", [p["qid"] for p in chunk]),
                ("sourceIds", [p["id"] for p in chunk]),
                ("questionCount", len(chunk)),
                ("scoredCount", sum(p["scoring"] == "auto" for p in chunk)),
                ("unscoredCount", sum(p["scoring"] != "auto" for p in chunk)),
                ("difficulty", OrderedDict((str(k), sum(p["difficulty"] == k for p in chunk)) for k in (1, 2, 3, 4))),
                ("bookRange", f"{ch}.{chunk[0]['num']}–{ch}.{chunk[-1]['num']}"),
                ("status", "draft"),
                ("published", False),
                ("publishDate", None),
                ("solutionAvailableAt", None),
            ]))
            assigned += [p["qid"] for p in chunk]

    # ---------------- tekshiruvlar
    allq = [p["qid"] for p in problems]
    checks = OrderedDict()
    checks["every_day_25_40"] = all(MIN_Q <= d["questionCount"] <= MAX_Q for d in days)
    checks["assigned_total"] = len(assigned)
    checks["assigned_unique"] = len(set(assigned))
    checks["unassigned"] = sorted(set(allq) - set(assigned))
    checks["used_twice"] = sorted(q for q, c in Counter(assigned).items() if c > 1)
    checks["days"] = len(days)
    # bo'lingan mavzu kunlari ketma-ketmi?
    seen = {}
    for d in days:
        for t in d["topics"]:
            seen.setdefault(t, []).append(d["dayNumber"])
    checks["split_topics_consecutive"] = all(v == list(range(v[0], v[0] + len(v))) for v in seen.values())
    report["checks"] = checks
    ok = (checks["every_day_25_40"] and not checks["unassigned"] and not checks["used_twice"]
          and checks["assigned_total"] == len(allq) == 1027 and checks["split_topics_consecutive"]
          and not report["missing_solution"])
    report["ok"] = ok

    digest = hashlib.sha256(json.dumps([d["questionIds"] for d in days]).encode()).hexdigest()[:16]
    plan = OrderedDict([("version", 1), ("course", "attestatsiya-fizika"), ("planHash", digest),
                        ("generatedBy", "tools/attestatsiya-fizika/plan_daily_tests.py"),
                        ("totalQuestions", len(assigned)), ("days", days)])
    excluded = [OrderedDict([("qid", p["qid"]), ("sourceId", p["id"]), ("type", p["type"]),
                             ("scoring", p["scoring"]), ("note", p["scoringNote"])])
                for p in sorted(problems, key=lambda p: (p["ch"], p["num"])) if p["scoring"] != "auto"]
    report["unscored_list"] = excluded

    os.makedirs(OUT, exist_ok=True)
    json.dump(plan, open(os.path.join(OUT, "daily_test_plan.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(OUT, "_audit.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    write_plan_md(plan, report, order, problems)
    print(json.dumps({k: v for k, v in report.items() if k != "unscored_list"}, ensure_ascii=False, indent=1))
    for d in days:
        print(f"{d['dayNumber']:>2} | {d['sectionTitle'][:22]:22} | {d['questionCount']:>2} ({d['scoredCount']:>2}) | "
              + " + ".join(f"{p['topic']} {p['count']}/{p['topicTotal']}" for p in d["topicParts"]))
    if not ok:
        sys.exit("TEKSHIRUV O'TMADI")


def write_plan_md(plan, report, order, problems):
    days, c = plan["days"], report["checks"]
    sc = report["scoring"]
    L = []
    w = L.append
    w("# Attestatsiya → Fizika: Daily Test rejasi")
    w("")
    w("> Avtomatik yaratilgan: `python3 tools/attestatsiya-fizika/plan_daily_tests.py` "
      f"(planHash `{plan['planHash']}`). Qo'lda tahrirlamang — skriptni qayta ishga tushiring.")
    w("")
    w("## Xulosa")
    w("")
    w(f"- Jami savollar: **{report['input_questions']}** (PDF'lardan ajratilgan {report['input_extracted_from_pdfs']}, "
      f"kitob tuzilishida {report['merged_duplicates_before_book']} ta takror birlashtirilgan)")
    w(f"- Daily Testlar soni: **{c['days']}** (har biri {MIN_Q}–{MAX_Q} savol)")
    w(f"- Biriktirilgan: **{c['assigned_total']}**, takrorsiz: **{c['assigned_unique']}**, "
      f"biriktirilmagan: **{len(c['unassigned'])}**, ikki marta ishlatilgan: **{len(c['used_twice'])}**")
    w(f"- Qolgan takrorlar: aniq matn bo'yicha {report['exact_text_duplicates_remaining']}, "
      f"fingerprint bo'yicha {report['fingerprint_duplicates_remaining']}")
    w(f"- Baholash: avtomatik **{sc['auto']}**, o'z-o'zini tekshirish (variantsiz) **{sc['self-check']}**, "
      f"baholanmaydigan (javob ishonchsiz) **{sc['excluded']}**")
    w(f"- Bo'lingan mavzular ketma-ket kunlarda: **{'ha' if c['split_topics_consecutive'] else 'YO‘Q'}**")
    w("")
    w("## Kunlar")
    w("")
    w("| Day | Section | Topic | Questions | Baholanadi | Qiyinlik 1/2/3/4 | Kitob |")
    w("|---:|---|---|---:|---:|---|---|")
    for d in days:
        topic = " + ".join(p["topic"] + ("" if p["whole"] else f" ({p['count']}/{p['topicTotal']})")
                           for p in d["topicParts"])
        diff = "/".join(str(v) for v in d["difficulty"].values())
        w(f"| {d['dayNumber']} | {d['sectionTitle']} | {topic} | {d['questionCount']} | {d['scoredCount']} | {diff} | {d['bookRange']} |")
    w("")
    w("`(a/b)` — mavzuning b ta savolidan a tasi shu kunda. Baholanadi — avtomatik tekshiriladigan savollar soni. "
      "Qiyinlik — 1 oson, 2 o'rta, 3 murakkab, 4 juda murakkab (.qtx ajratib olish ma'lumoti). "
      "Kitobda har bir mavzu ichida savollar qiyinlik bo'yicha tartiblangan, shuning uchun bo'lingan mavzuning "
      "birinchi kuni osonroq, keyingisi murakkabroq.")
    w("")
    w("## Bo'limlar bo'yicha")
    w("")
    w("| Section | Savollar | Kunlar |")
    w("|---|---:|---:|")
    for ch, (key, name) in SECTIONS.items():
        ds = [d for d in days if d["section"] == key]
        w(f"| {name} | {sum(d['questionCount'] for d in ds)} | {len(ds)} |")
    w(f"| **Jami** | **{sum(d['questionCount'] for d in days)}** | **{len(days)}** |")
    w("")
    w("## Mavzular bo'yicha (kitob tartibi)")
    w("")
    w("| Section | Topic | Savollar | Qoida | Kun(lar) |")
    w("|---|---|---:|---|---|")
    for ch, topics in order.items():
        for t in topics:
            n = sum(p["topic"] == t for p in problems)
            dn = [str(d["dayNumber"]) for d in days if t in d["topics"]]
            if n > MAX_Q:
                rule = "katta (>40) → ketma-ket kunlarga bo'lindi"
            elif n >= MIN_Q:
                rule = ("25–40 → o'zi bir kun" if len(dn) == 1 else
                        "25–40, lekin qo'shni kichik mavzular 25 ga yetishi uchun ikki kunga bo'lindi")
            else:
                rule = "kichik (<25) → qo'shni mavzu bilan birlashtirildi" + ("" if len(dn) == 1 else " (2 kunga)")
            w(f"| {SECTIONS[ch][1]} | {t} | {n} | {rule} | {', '.join(dn)} |")
    w("")
    w("## Baholanmaydigan savollar (yo'qolmaydi — kunlik testda qoladi, ballga kirmaydi)")
    w("")
    w("| qid | Manba | Turi | Holat | Sabab |")
    w("|---|---|---|---|---|")
    for x in report["unscored_list"]:
        w(f"| {x['qid']} | {x['sourceId']} | {x['type']} | {x['scoring']} | {x['note']} |")
    w("")
    open(os.path.join(OUT, "attestation_daily_test_plan.md"), "w", encoding="utf-8").write("\n".join(L))


if __name__ == "__main__":
    main()
