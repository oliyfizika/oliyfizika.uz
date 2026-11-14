#!/usr/bin/env python3
"""
Milliy sertifikat mock testi → admin import fayli (Attestatsiya mock importi kabi).

  python3 tools/milliy-sertifikat/build_mock_import.py SRC.json [--images-root DIR] [--solutions SOL.json]
         [--number N] [--out ms-mock-import-NN.json]

SRC.json — mock-test-N.json formatida (milliy-sertifikat/mock-testlar/README.md): savollar, javoblar, rasm yo'llari.
Natija — bitta JSON fayl. Admin uni «Mock sessiyalar» sahifasidagi «Mock testni import qilish» orqali Firestore'ga yuklaydi:
  msMockTests/{id}                 — meta (hamma ko'radi: nom, savollar soni, vaqt)
  msMockTests/{id}/content/questions — savollar JAVOBSIZ (faqat sessiya oynasida va natija e'lon qilingach ochiladi)
  msMockTests/{id}/content/key       — to'g'ri javoblar (faqat admin; natija e'lon qilingach ishtirokchilarga)
  msMockTests/{id}/content/solutions — yozma yechimlar (ixtiyoriy; kalit bilan bir xil qoida)
  msMockTests/{id}/figures/{figId}   — rasmlar (base64 data URL)
Fayl ichida javoblar bor — uni repoga QO'YMANG (maxfiy joyda saqlang).
"""
import argparse
import base64
import json
import mimetypes
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MOCK_DIR = os.path.join(ROOT, "milliy-sertifikat", "mock-testlar")
FORMAT = "oliyfizika-ms-mock-import"
MAX_FIG = 700_000            # bitta rasm hujjati (data URL belgilari) — Firestore 1 MiB chegarasidan past
MAX_DOC = 900_000            # savollar hujjati


def fail(msg):
    print(f"XATO: {msg}", file=sys.stderr)
    sys.exit(1)


def nested_array(v, path="", in_array=False):
    if isinstance(v, list):
        if in_array:
            return path
        for i, x in enumerate(v):
            p = nested_array(x, f"{path}[{i}]", True)
            if p:
                return p
        return None
    if isinstance(v, dict):
        for k, x in v.items():
            p = nested_array(x, f"{path}.{k}" if path else k, False)
            if p:
                return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--images-root", default=None, help="rasm yo'llari shu papkaga nisbatan (standart: SRC papkasi, keyin mock-testlar/)")
    ap.add_argument("--solutions", default=None, help="data/solutions/mock-test-N.json formatidagi yozma yechimlar")
    ap.add_argument("--number", type=int, default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    src = json.load(open(a.src, encoding="utf-8"))
    number = a.number or src.get("number")
    if not isinstance(number, int) or not 1 <= number <= 999:
        fail("mock raqami (number) 1–999 bo'lsin")
    test_id = f"mock-test-{number}"
    qs = src.get("questions")
    if not isinstance(qs, list) or not qs:
        fail("savollar yo'q")

    roots = [a.images_root] if a.images_root else [os.path.dirname(os.path.abspath(a.src)), MOCK_DIR]
    figures = {}

    def fig(path):
        if not path:
            return None
        if path.startswith("fig:"):
            return path
        for r in roots:
            f = os.path.join(r, path)
            if os.path.isfile(f):
                break
        else:
            fail(f"rasm topilmadi: {path}")
        mime = mimetypes.guess_type(f)[0] or ""
        if mime not in ("image/png", "image/jpeg", "image/webp", "image/svg+xml"):
            fail(f"rasm turi qo'llanmaydi: {path} ({mime})")
        data = f"data:{mime};base64,{base64.b64encode(open(f, 'rb').read()).decode()}"
        if len(data) > MAX_FIG:
            fail(f"rasm juda katta ({len(data)} belgi > {MAX_FIG}): {path} — siqing yoki kichraytiring")
        fid = re.sub(r"[^A-Za-z0-9_-]", "_", os.path.splitext(os.path.basename(path))[0])[:40] or f"f{len(figures)}"
        base_id = fid
        k = 2
        while fid in figures and figures[fid] != data:
            fid = f"{base_id}_{k}"
            k += 1
        figures[fid] = data
        return f"fig:{fid}"

    public_qs, key = [], {}
    mcq = items = 0
    for i, q in enumerate(qs):
        t = q.get("type")
        if t not in ("mcq", "open2"):
            fail(f"{i + 1}-savol turi noma'lum: {t}")
        pq = {k: v for k, v in q.items() if k not in ("answer", "parts", "options", "image")}
        if q.get("image"):
            pq["image"] = fig(q["image"])
        if t == "mcq":
            opts = q.get("options") or []
            if not opts:
                fail(f"{q.get('n')}-savolda variantlar yo'q")
            letters = "ABCDEFGHIJ"[:len(opts)]
            if q.get("answer") not in letters:
                fail(f"{q.get('n')}-savol javobi noto'g'ri: {q.get('answer')}")
            out_opts = []
            for o in opts:
                if isinstance(o, dict):
                    oo = dict(o)
                    if oo.get("image"):
                        oo["image"] = fig(oo["image"])
                    out_opts.append(oo)
                else:
                    out_opts.append(o)
            pq["options"] = out_opts
            key[str(i)] = q["answer"]
            mcq += 1
            items += 1
        else:
            parts = q.get("parts") or []
            if not parts:
                fail(f"{q.get('n')}-savolda qismlar yo'q")
            pparts, kparts = [], {}
            for p in parts:
                if "answer" not in p:
                    fail(f"{q.get('n')}{p.get('key')} javobsiz")
                pparts.append({k: v for k, v in p.items() if k not in ("answer", "accept", "tolerance")})
                kparts[p["key"]] = {k: p[k] for k in ("answer", "accept", "tolerance") if k in p}
                items += 1
            pq["parts"] = pparts
            key[str(i)] = kparts
        public_qs.append(pq)

    meta = {
        "number": number,
        "title": (src.get("title") if src.get("number") == number else None) or f"Fizika Mock Test №{number}",
        "subtitle": src.get("subtitle") or "",
        "durationMinutes": int(src.get("durationMinutes") or 180),
        "questionCount": len(qs),
        "mcqCount": mcq,
        "itemCount": items,
        "figureCount": len(figures),
        "source": "import",
    }
    if src.get("sourceVariant"):
        meta["sourceVariant"] = src["sourceVariant"]
    questions_doc = {
        "schemaVersion": 1,
        "questions": public_qs,
        "scoring": src.get("scoring") or {"defaultRelativeTolerance": 1e-6},
        "review": {"enabled": True, "showCorrectAnswers": True},
    }
    if src.get("formulaSheet"):
        questions_doc["formulaSheet"] = src["formulaSheet"]

    ops = [
        {"path": f"msMockTests/{test_id}", "data": meta},
        {"path": f"msMockTests/{test_id}/content/questions", "data": questions_doc},
        {"path": f"msMockTests/{test_id}/content/key", "data": {"answers": key}},
    ]
    if a.solutions:
        sol = json.load(open(a.solutions, encoding="utf-8"))
        if not isinstance(sol.get("items"), dict):
            fail("yechimlar fayli formati noto'g'ri (items yo'q)")
        ops.append({"path": f"msMockTests/{test_id}/content/solutions", "data": {"items": sol["items"]}})
    for fid, data in sorted(figures.items()):
        ops.append({"path": f"msMockTests/{test_id}/figures/{fid}", "data": {"data": data}})

    for o in ops:
        p = nested_array(o["data"])
        if p:
            fail(f"Firestore massiv ichida massivni qabul qilmaydi: {o['path']} → {p}")
        size = len(json.dumps(o["data"], ensure_ascii=False).encode("utf-8"))
        if size > MAX_DOC:
            fail(f"hujjat juda katta ({size} bayt): {o['path']}")

    bundle = {"format": FORMAT, "version": 1, "testId": test_id, "number": number, "title": meta["title"],
              "counts": {"questions": len(qs), "mcq": mcq, "items": items, "figures": len(figures)}, "ops": ops}
    out = a.out or f"ms-mock-import-{number:02d}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False)
    print(f"{out}: {test_id} — {len(qs)} savol ({mcq} test, {items} band), {len(figures)} rasm, {len(ops)} hujjat,"
          f" {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    main()
