#!/usr/bin/env python3
"""Real imtihonlar — PHASE 3 dataset + audited solutions (+ V3 answer keys + editorial overlay) -> application data (LOCAL ONLY).

    python3 tools/real-imtihonlar/export_app_data.py [--out DIR] [--spec PATH] [--overlay PATH]

PHASE 7C-1:
  • V3 javob kaliti (audit/answer-key-spec-v3.draft.json) -> solutions.json "answerKey" (faqat private/solutions; questions'da javob yo'q).
  • Tasdiqlangan tahrirlar (editorial/question-edits-v1.json): asl matn sha256 dataset bilan mos bo'lsagina qo'llanadi;
    mos kelmasa eksport TO'XTAYDI. Asl matn va tahrir metama'lumoti "editorial" maydonida saqlanadi.
  • Barcha hujjatlar avval xotirada quriladi va tekshiriladi; xato bo'lsa hech bir fayl yozilmaydi.

Reads (never modifies):
  _private/real-imtihonlar/dataset/REAL-*.json          (source of truth: questions, provenance, verification)
  _private/real-imtihonlar/audit/NN_<examId>-SOLUTIONS.md (audited solutions, statuses)
Writes (gitignored, never deployed):
  _private/real-imtihonlar/app-data/catalog.json
  _private/real-imtihonlar/app-data/exams/<examId>/questions.json
  _private/real-imtihonlar/app-data/exams/<examId>/solutions.json

The same document shapes are used for the future Firestore model (see docs/real-imtihonlar/):
  realExams/{examId}                     <- catalog entry
  realExams/{examId}/content/questions   <- questions.json
  realExams/{examId}/private/solutions   <- solutions.json
Nothing is written to Firebase by this script.
"""
import argparse
import copy
import datetime
import glob
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
DS = os.path.join(PRIV, "dataset")
AUDIT = os.path.join(PRIV, "audit")
OUT = os.path.join(PRIV, "app-data")
SPEC = os.path.join(AUDIT, "answer-key-spec-v3.draft.json")
OVERLAY = os.path.join(PRIV, "editorial", "question-edits-v1.json")
READY_STATUSES = ("READY", "READY_ENGINE_FEATURE_REQUIRED")
sys.path.insert(0, HERE)
from solution_md import parse_file  # noqa: E402

AUDIT_STATUS = {
    "READY": ("FINAL", []),
    "KEY-CORRECTED": ("FINAL", ["SOURCE_KEY_CORRECTED"]),
    "OCR-CORRECTED": ("FINAL", ["SOURCE_OPTION_LABEL_MISPRINT"]),
    "VERIFIED — SOURCE KEY ERROR / MODEL INCONSISTENCY": ("FINAL", ["SOURCE_KEY_ERROR"]),
    "VERIFIED — SIGN CONVENTION NOTE": ("FINAL", ["SIGN_CONVENTION_NOTE"]),
    "VERIFIED — ASSUMPTION STATED": ("FINAL", ["ASSUMPTION_STATED"]),
    "SOURCE ERROR — NO CORRECT OPTION": ("NO_CORRECT_OPTION", ["SOURCE_ERROR"]),
    "NEEDS MANUAL REVIEW": ("NEEDS_MANUAL_REVIEW", []),
    "EXCLUDED — ORG, not an official exam question": ("EXCLUDED_ORG", []),
}
FIRESTORE_DOC_LIMIT = 1_048_576
SAFE_DOC_BYTES = 900_000


def has_nested_array(v, in_array=False):
    if isinstance(v, list):
        return in_array or any(has_nested_array(x, True) for x in v)
    if isinstance(v, dict):
        return any(has_nested_array(x, False) for x in v.values())
    return False


def table_out(t):
    # Firestore does not allow nested arrays: rows -> [{"c": [...]}]
    return {"tableId": t.get("tableId"), "sourcePage": t.get("sourcePage"), "caption": t.get("caption"),
            "rows": [{"c": [str(c) for c in row]} for row in t.get("rows") or []], "status": t.get("status")}


def question_out(q, sol):
    figs = [{"figureId": f["figureId"], "questionNumber": f["questionNumber"], "sourcePage": f["sourcePage"],
             "role": f["role"], "bbox150": f["bbox150"], "sha256": f["sha256"], "status": f["status"],
             "localFile": f["file"],  # relative to _private/real-imtihonlar/
             "storagePath": f"real-exams/{q['examId']}/figures/{f['figureId']}.png"} for f in q["figures"]]
    return {
        "id": q["id"], "examId": q["examId"], "questionNumber": q["questionNumber"], "type": q["type"],
        "included": q["included"], "exclusionReason": q["exclusionReason"],
        "sourcePage": q["sourcePage"], "sourcePages": q["sourcePages"],
        "questionText": q["questionText"], "options": q["options"], "parts": q["parts"], "matchGroup": q["matchGroup"],
        "tables": [table_out(t) for t in q["tables"]], "figures": figs,
        "formulas": [{"id": m["id"], "location": m["location"], "tex": m["tex"], "status": m["status"]} for m in q["formulas"]],
        "sourceStatus": q["sourceStatus"], "sourceNotes": q["sourceNotes"],
        "verification": {
            "aiVerified": q["verification"]["aiVerified"],
            "humanSignOff": q["humanSignOff"],
            "aiMethod": q["verification"]["method"],
            "humanReviewStatus": q["humanReview"]["status"],
            "humanReviewer": q["humanReview"].get("reviewer"),
        },
        "solutionStatus": sol["solutionStatus"],
    }


def solution_status(entry):
    if entry["partAuditStatuses"]:
        parts = {k: AUDIT_STATUS[s][0] for k, s in entry["partAuditStatuses"].items()}
        flags = sorted({f for s in entry["partAuditStatuses"].values() for f in AUDIT_STATUS[s][1]})
        order = ["EXCLUDED_ORG", "NEEDS_MANUAL_REVIEW", "NO_CORRECT_OPTION", "FINAL"]
        worst = min(parts.values(), key=order.index)
        return worst, parts, flags
    st, flags = AUDIT_STATUS[entry["auditStatuses"][0]]
    return st, {}, list(flags)


def answer_out(entry, n, qtype, status):
    text = entry["answerText"]
    ans = {"text": text, "choice": None, "tail": entry["answerTail"]}
    if status in ("NEEDS_MANUAL_REVIEW", "NO_CORRECT_OPTION", "EXCLUDED_ORG") or text is None:
        return ans  # no final choice is created here
    if qtype == "mc" and re.fullmatch(r"[A-D]", text):
        ans["choice"] = text
    elif qtype == "match":
        m = re.search(rf"\b{n}\s*—\s*([A-F])\b", text)
        ans["choice"] = m.group(1) if m else None
    return ans


def sha_text(t):
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


def sha_file(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


class ExportError(SystemExit):
    pass


def load_overlay(path, dataset_questions):
    """Tahrirlarni yuklaydi va asl matn hash'ini dataset bilan tekshiradi. Mos kelmasa — ExportError."""
    if not path:
        return {}, None
    doc = json.load(open(path, encoding="utf-8"))
    edits = {}
    for e in doc["edits"]:
        qid = e["questionId"]
        q = dataset_questions.get(qid)
        if q is None:
            raise ExportError(f"overlay: {qid} datasetda yo'q")
        if e.get("status") != "APPROVED_BY_SARVAR":
            raise ExportError(f"overlay: {qid} tasdiqlanmagan (status={e.get('status')})")
        if sha_text(q["questionText"]) != e["originalTextSha256"] or q["questionText"] != e["originalQuestionText"]:
            raise ExportError(f"overlay: {qid} asl matn hash'i dataset bilan mos emas — eksport to'xtatildi")
        dparts = {p["key"]: p["text"] for p in q["parts"]}
        if set(dparts) != {p["key"] for p in e["parts"]}:
            raise ExportError(f"overlay: {qid} qismlar to'plami dataset bilan mos emas")
        for p in e["parts"]:
            if dparts[p["key"]] != p["originalText"]:
                raise ExportError(f"overlay: {qid}{p['key']} asl qism matni dataset bilan mos emas — eksport to'xtatildi")
        if qid in edits:
            raise ExportError(f"overlay: {qid} takroriy tahrir")
        edits[qid] = e
    return edits, sha_file(path)


def load_spec(path):
    doc = json.load(open(path, encoding="utf-8"))
    specs = {}
    for sp in doc["specs"]:
        if sp["partId"] in specs:
            raise ExportError(f"spec: takroriy qism {sp['partId']}")
        specs[sp["partId"]] = sp
    return specs, sha_file(path), doc.get("schemaVersion")


def apply_edit(qout, e):
    """questions.json yozuviga tahrirni qo'llaydi (asl matn editorial ichida saqlanadi)."""
    qout["questionText"] = e["editedQuestionText"]
    edited = {p["key"]: p["editedText"] for p in e["parts"]}
    qout["parts"] = [dict(p, text=edited[p["key"]]) for p in qout["parts"]]
    qout["editorial"] = {
        "edited": True, "badge": "Tahrirlangan shart", "badgeNote": e["displayBadge"],
        "originalQuestionText": e["originalQuestionText"], "originalTextSha256": e["originalTextSha256"],
        "originalParts": [{"key": p["key"], "text": p["originalText"]} for p in e["parts"]],
        "changedParts": [p["key"] for p in e["parts"] if p["changed"]], "stemChanged": e["stemChanged"],
        "reason": e["reason"], "editor": e["editor"], "date": e["date"], "decisionNo": e["decisionNo"],
        "linkedHighReview": e["linkedHighReview"], "overlay": "editorial/question-edits-v1.json",
    }


def edited_solution(sol, e, original_answer_text):
    """Tahrirlangan shart uchun yechim yozuvi; asl yechim originalSolution ichida saqlanadi."""
    orig_parts = {}
    m = re.match(r"^\s*a\)\s*(.*?);\s*b\)\s*(.*)$", original_answer_text or "", re.S)
    if m:
        orig_parts = {"a": m.group(1).strip(), "b": m.group(2).strip()}
    blocks = [{"t": "note", "label": "Tahrirlangan shart", "text": e["reason"]}]
    answers = {}
    for p in e["parts"]:
        k = p["key"]
        steps = e["editedSolution"].get(k)
        if steps:
            for st in steps:
                if st.startswith("Javob"):
                    answers[k] = st.split(":", 1)[1].strip()
                else:
                    blocks.append({"t": "step", "label": f"{k})", "text": st})
            if k not in answers:
                raise ExportError(f"{e['questionId']}{k}: tahrirlangan yechimda 'Javob' yo'q")
        else:
            answers[k] = orig_parts.get(k) or "—"
            blocks.append({"t": "step", "label": f"{k})", "text": f"Bu qism javobi tahrirdan o'zgarmagan: {answers[k]}"})
    text = "; ".join(f"{k}) {answers[k]}" for k in sorted(answers))
    blocks.append({"t": "answer", "label": "Javob", "text": text})
    new = dict(sol)
    new["originalSolution"] = {"solutionStatus": sol["solutionStatus"], "partSolutionStatus": sol["partSolutionStatus"],
                               "answer": sol["answer"], "blocks": sol["blocks"], "solutionFlags": sol["solutionFlags"]}
    new.update({"answer": {"text": text, "choice": None, "tail": None}, "blocks": blocks,
                "solutionFlags": sorted(set(sol["solutionFlags"]) | {"EDITORIAL_EDIT"}), "editorial": {"edited": True, "overlay": "editorial/question-edits-v1.json"}})
    return new


def key_part(sp, spec_sha):
    """V3 spetsifikatsiya qismi -> app-data answerKey qismi (qiymatlar o'zgartirilmaydi)."""
    targets = copy.deepcopy(sp["targets"])
    reqs = sorted(set(sp.get("engineRequirements", [])) | ({"MULTI_VALUE"} if len(targets) > 1 else set()))
    scale = None
    if targets and targets[0]["variant"] == "mantissa":
        mt = re.match(r"^10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*(.*)$", targets[0]["unit"])
        exp = int(mt.group(1).translate(str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")))
        scale = {"factor": 10.0 ** exp, "baseUnit": mt.group(2), "input": "mantissa"}
    unit_display = None
    if sp.get("uiUnitLabel"):
        unit_display = sp["uiUnitLabel"]["display"]
    elif sp.get("normalizationGroup") == "COEFFICIENT_OF_GIVEN":
        mm = re.match(r"^(\S+) birligida", " ".join(sp.get("notes", [])))
        unit_display = f"× {mm.group(1)}" if mm else None
    elif targets and targets[0].get("unit"):
        unit_display = targets[0]["unit"]
    scientific = any(t["value"] < 0 or (t["value"] != 0 and (abs(t["value"]) >= 1e5 or abs(t["value"]) < 1e-3)) for t in targets)
    return {
        "status": sp["status"], "targets": targets, "acceptText": list(sp.get("acceptText") or []),
        "signRequired": bool(sp.get("signRequired")), "inputFormat": sp.get("inputFormat"),
        "unitDisplay": unit_display, "uiUnitLabel": sp.get("uiUnitLabel"), "scale": scale,
        "inputHints": {"scientific": scientific}, "normalizationGroup": sp.get("normalizationGroup"),
        "policies": list(dict.fromkeys(sp.get("policiesApplied") or [])), "engineRequirements": reqs,
        "audit": {"specFile": "audit/answer-key-spec-v3.draft.json", "specSha256": spec_sha, "partId": sp["partId"],
                  "v2Status": sp.get("v2Status"), "phase6aStatus": sp.get("phase6aStatus"), "editorialPart": bool(sp.get("editorial")),
                  "notes": list(sp.get("v2Notes") or [])},
    }


def write_json(path, doc):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)


def label(ex):
    d = datetime.date.fromisoformat(ex["date"]).strftime("%d.%m.%Y")
    if ex.get("variant"):
        return d, f"Variant {ex['variant']}"
    if ex.get("session"):
        return d, ex["session"]
    return d, None


def build(spec_path=SPEC, overlay_path=OVERLAY):
    """Hamma hujjatlarni xotirada quradi va tekshiradi. Faylga hech narsa yozmaydi."""
    exam_files = sorted(glob.glob(os.path.join(DS, "REAL-*.json")))
    ds_all = {}
    for f in exam_files:
        for q in json.load(open(f, encoding="utf-8"))["questions"]:
            ds_all[q["id"]] = q
    edits, overlay_sha = load_overlay(overlay_path, ds_all)
    specs, spec_sha, spec_ver = load_spec(spec_path)
    open_parts = {q["id"] + p["key"] for q in ds_all.values() if q["type"] == "open" for p in q["parts"]}
    if set(specs) != open_parts:
        raise ExportError(f"spec: qismlar dataset ochiq qismlari bilan mos emas (spec {len(specs)}, dataset {len(open_parts)})")
    used_edits = set()
    files_out = {}
    catalog = {"schemaVersion": 1, "generatedAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
               "status": "LOCAL APP DATA — not for production", "exams": []}
    report = []
    for f in exam_files:
        d = json.load(open(f, encoding="utf-8"))
        ex = d["exam"]; eid = ex["examId"]
        sol_file = [p for p in glob.glob(os.path.join(AUDIT, f"*_{eid}-SOLUTIONS.md"))]
        if len(sol_file) != 1:
            raise SystemExit(f"{eid}: audit solution file not found uniquely: {sol_file}")
        parsed = parse_file(sol_file[0])
        qs_out, sols_out = [], []
        summary = {"FINAL": 0, "NO_CORRECT_OPTION": 0, "NEEDS_MANUAL_REVIEW": 0, "EXCLUDED_ORG": 0}
        review_parts = 0
        for q in d["questions"]:
            n = q["questionNumber"]
            entry = parsed.get(n)
            if entry is None:
                raise SystemExit(f"{eid} #{n}: no audit solution section")
            st, parts, flags = solution_status(entry)
            ds_status = (q.get("solutionRef") or {}).get("solutionStatus")
            if ds_status != st:
                raise SystemExit(f"{eid} #{n}: solution status mismatch dataset={ds_status} audit={st}")
            sol = {"questionNumber": n, "solutionStatus": st, "partSolutionStatus": parts, "solutionFlags": flags,
                   "auditStatuses": entry["auditStatuses"], "headingNote": entry["headingNote"],
                   "group": f"{entry['from']}-{entry['to']}" if entry["from"] != entry["to"] else None,
                   "answer": answer_out(entry, n, q["type"], st), "blocks": entry["blocks"],
                   "auditRef": f"audit/{os.path.basename(sol_file[0])}", "editorial": None, "answerKey": None}
            qo = question_out(q, sol)
            qo["editorial"] = None
            e = edits.get(q["id"])
            if e:
                apply_edit(qo, e)
                sol = edited_solution(sol, e, sol["answer"]["text"])
                used_edits.add(q["id"])
            if q["type"] == "open":
                kp = {p["key"]: key_part(specs[q["id"] + p["key"]], spec_sha) for p in q["parts"]}
                sol["answerKey"] = {"specVersion": f"v{spec_ver}", "parts": kp}
                all_ready = all(k["status"] in READY_STATUSES for k in kp.values())
                if e:
                    # tahrir faqat V3 kalitlari tayyor bo'lsa FINAL ga o'tadi; aks holda asl holat saqlanadi (PENDING -> READY emas)
                    sol["solutionStatus"] = "FINAL" if all_ready else sol["originalSolution"]["solutionStatus"]
                    sol["partSolutionStatus"] = {} if all_ready else sol["originalSolution"]["partSolutionStatus"]
                    st, parts = sol["solutionStatus"], sol["partSolutionStatus"]
                elif not all_ready and st == "FINAL":
                    raise ExportError(f"{q['id']}: V3 kalit READY emas, lekin yechim FINAL")
            elif e:
                raise ExportError(f"{q['id']}: tahrir ochiq bo'lmagan savolga — qo'llab-quvvatlanmaydi")
            qo["solutionStatus"] = sol["solutionStatus"]
            summary[st] += 1
            if parts:
                review_parts += sum(1 for v in parts.values() if v == "NEEDS_MANUAL_REVIEW")
            elif st == "NEEDS_MANUAL_REVIEW":
                review_parts += max(1, len(q["parts"]))
            qs_out.append(qo)
            sols_out.append(sol)
        qdoc = {"schemaVersion": 1, "examId": eid, "questions": qs_out}
        sdoc = {"schemaVersion": 1, "examId": eid, "solutions": sols_out}
        for name, doc in (("questions", qdoc), ("solutions", sdoc)):
            if has_nested_array(doc):
                raise SystemExit(f"{eid} {name}: nested arrays (not storable in Firestore)")
            size = len(json.dumps(doc, ensure_ascii=False).encode("utf-8"))
            if size > SAFE_DOC_BYTES:
                raise SystemExit(f"{eid} {name}: {size} bytes > safe Firestore document size")
            report.append((eid, name, size))
        dd, sub = label(ex)
        included = sum(1 for q in qs_out if q["included"])
        catalog["exams"].append({
            "examId": eid, "date": ex["date"], "displayDate": dd, "session": ex["session"], "variant": ex["variant"],
            "subtitle": sub, "sourceGroup": ex["sourceGroup"], "sourceType": ex["sourceType"],
            "sourceFile": ex["sourceFile"], "sourceDate": ex["sourceDate"], "sourceProvenance": ex["sourceProvenance"],
            "officialSource": ex["officialSource"], "warnings": ex["warnings"], "pageCount": ex["pageCount"],
            "questionCount": len(qs_out), "includedCount": included, "excludedCount": len(qs_out) - included,
            "solutionSummary": summary, "reviewParts": review_parts,
            "humanSignOffCount": sum(1 for q in qs_out if q["verification"]["humanSignOff"]),
            "editedQuestionCount": sum(1 for q in qs_out if q["editorial"]), "answerKeySpec": f"v{spec_ver}",
            "pdf": {"storagePath": f"real-exams/{eid}.pdf", "available": False},
            "published": True,
        })
        files_out[os.path.join("exams", eid, "questions.json")] = qdoc
        files_out[os.path.join("exams", eid, "solutions.json")] = sdoc
    if used_edits != set(edits):
        raise ExportError(f"overlay: qo'llanmagan tahrirlar {sorted(set(edits) - used_edits)}")
    catalog["answerKey"] = {"spec": "audit/answer-key-spec-v3.draft.json", "specSha256": spec_sha, "parts": len(specs)}
    catalog["editorial"] = {"overlay": "editorial/question-edits-v1.json", "overlaySha256": overlay_sha, "editedQuestions": len(used_edits)}
    catalog["exams"].sort(key=lambda e: (e["session"] or "", e["variant"] or ""))
    catalog["exams"].sort(key=lambda e: e["date"], reverse=True)  # newest first; stable within a date
    if has_nested_array(catalog):
        raise SystemExit("catalog: nested arrays")
    files_out["catalog.json"] = catalog
    return files_out, report, {"exams": len(catalog["exams"]), "editedQuestions": len(used_edits), "answerKeyParts": len(specs)}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--spec", default=SPEC)
    ap.add_argument("--overlay", default=OVERLAY)
    a = ap.parse_args(argv)
    files_out, report, stats = build(a.spec, a.overlay)   # xato bo'lsa shu yerda to'xtaydi — hech narsa yozilmaydi
    for rel, doc in files_out.items():
        write_json(os.path.join(a.out, rel), doc)
    print(f"exported {stats['exams']} exams, {stats['editedQuestions']} edited questions, {stats['answerKeyParts']} answer-key parts -> {a.out}")
    print("largest documents:", sorted(report, key=lambda r: -r[2])[:3], f"(Firestore limit {FIRESTORE_DOC_LIMIT})")


if __name__ == "__main__":
    main()
