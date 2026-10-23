#!/usr/bin/env python3
"""Real imtihonlar — Rules matritsasi (lokal; mavjud rules_eval.py emulyatori). Firebase'ga ulanmaydi.

  python3 tools/real-imtihonlar/rules/test_real_exam_rules.py [--rules proposed|repo]

  proposed (standart): _private/real-imtihonlar/rules-proposed/{firestore,storage}.rules
  repo:                repo firestore.rules / storage.rules (real-exams bloki yo'q -> hammasi DENY bo'lishi kerak)

Tekshiriladi:
  • o'qish matritsasi: A mehmon · B access=false · C access=true · D admin+true · E admin+false,
    published=true / published=false; katalog, content/questions, private/solutions, list so'rovi;
    Storage: real-exams/{id}.pdf, real-exams/{id}/figures/{figureId}.png
  • barcha client yozuvlari (create/update/delete) — DENY (admin ham)
  • users/{uid}: o'z role / fullAccess / mockTestsAccess maydonini o'zgartirish — DENY
    (mavjud model: faqat admin access maydonlarini yangilaydi — o'zgarmaganligi tekshiriladi)
  • noto'g'ri yo'llar: boshqa nomdagi content/private hujjatlari, PDF bo'lmagan fayl, chuqur yo'llar — DENY
Natija: _private/real-imtihonlar/rules-proposed/real-exam-rules-report.json
"""
import datetime as dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "attestatsiya-fizika", "rules"))
import rules_eval as R  # noqa: E402

MODE = sys.argv[sys.argv.index("--rules") + 1] if "--rules" in sys.argv else "proposed"
RDIR = os.path.join(ROOT, "_private", "real-imtihonlar", "rules-proposed") if MODE == "proposed" else ROOT
FS = R.Engine(open(os.path.join(RDIR, "firestore.rules"), encoding="utf-8").read())
ST = R.Engine(open(os.path.join(RDIR, "storage.rules"), encoding="utf-8").read())
NOW = dt.datetime(2026, 10, 7, 9, 0, tzinfo=dt.timezone.utc)

PUB, UNPUB = "REAL-2026-01-18", "REAL-2026-09-30-B"
FIG = f"{PUB}-q03-f1"
USERS = {
    "B": {"fullName": "B", "xp": 0, "level": 1, "fullAccess": False, "mockTestsAccess": False},
    "C": {"fullName": "C", "xp": 0, "level": 1, "fullAccess": False, "mockTestsAccess": True},
    "D": {"fullName": "D", "xp": 0, "level": 1, "fullAccess": False, "mockTestsAccess": True, "role": "admin"},
    "E": {"fullName": "E", "xp": 0, "level": 1, "fullAccess": False, "mockTestsAccess": False, "role": "admin"},
    "F": {"fullName": "F", "xp": 0, "level": 1, "fullAccess": True},  # mockTestsAccess maydoni umuman yo'q
}
DOCS = {f"users/{u}": d for u, d in USERS.items()}
for eid, pub in ((PUB, True), (UNPUB, False)):
    DOCS[f"realExams/{eid}"] = {"date": "2026-01-18", "published": pub, "questionCount": 45}
    DOCS[f"realExams/{eid}/content/questions"] = {"examId": eid, "questions": []}
    DOCS[f"realExams/{eid}/private/solutions"] = {"examId": eid, "solutions": []}


def auth(u):
    return None if u is None else {"uid": u, "token": {"email": f"{u}@example.com", "email_verified": True}}


def fs(method, path, u, new=None):
    after = dict(DOCS)
    if method in ("create", "update"):
        after[path] = new
    elif method == "delete":
        after.pop(path, None)
    ok, _, _ = FS.allowed(method, path, auth(u), DOCS, after, NOW, new_data=new)
    return ok


def fs_list(col, u, matching):
    """list: Rules har bir qaytariladigan hujjat uchun bajariladi (so'rov published==true bilan)."""
    return all(FS.allowed("list", p, auth(u), DOCS, DOCS, NOW)[0] for p in matching) if matching else False


def st(method, path, u, meta=None):
    ok, _, _ = ST.allowed_storage(method, path, auth(u), DOCS, NOW, new_meta=meta)
    return ok


checks = []


def ok(name, cond, detail=""):
    checks.append({"name": name, "pass": bool(cond), "detail": str(detail)})
    print(f"{'PASS' if cond else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}")


ALL = [None, "B", "C", "D", "E", "F"]
EXPECT_READ = {None: False, "B": False, "C": True, "D": True, "E": False, "F": False}
LBL = {None: "A mehmon", "B": "B access=false", "C": "C access=true", "D": "D admin+access=true", "E": "E admin+access=false", "F": "F fullAccess, access maydoni yo'q"}

for u in ALL:
    exp = EXPECT_READ[u] if MODE == "proposed" else False
    r = {
        "meta": fs("get", f"realExams/{PUB}", u),
        "questions": fs("get", f"realExams/{PUB}/content/questions", u),
        "solutions": fs("get", f"realExams/{PUB}/private/solutions", u),
        "list": fs_list("realExams", u, [f"realExams/{PUB}"]),
        "pdf": st("get", f"real-exams/{PUB}.pdf", u),
        "figure": st("get", f"real-exams/{PUB}/figures/{FIG}.png", u),
    }
    ok(f"READ published=true · {LBL[u]} -> {'ALLOW' if exp else 'DENY'}", all(v == exp for v in r.values()), json.dumps(r))
    r2 = {
        "meta": fs("get", f"realExams/{UNPUB}", u),
        "questions": fs("get", f"realExams/{UNPUB}/content/questions", u),
        "solutions": fs("get", f"realExams/{UNPUB}/private/solutions", u),
        "list": fs_list("realExams", u, [f"realExams/{UNPUB}"]),
        "pdf": st("get", f"real-exams/{UNPUB}.pdf", u),
        "figure": st("get", f"real-exams/{UNPUB}/figures/{UNPUB}-q04-f1.png", u),
    }
    ok(f"READ published=false · {LBL[u]} -> DENY", not any(r2.values()), json.dumps(r2))
    # yozish — hammasi DENY
    w = {
        "createExam": fs("create", "realExams/REAL-2099-01-01", u, {"published": True}),
        "updateExam": fs("update", f"realExams/{PUB}", u, {**DOCS[f'realExams/{PUB}'], "published": False}),
        "deleteExam": fs("delete", f"realExams/{PUB}", u),
        "writeQuestions": fs("update", f"realExams/{PUB}/content/questions", u, {"questions": [1]}),
        "writeSolutions": fs("update", f"realExams/{PUB}/private/solutions", u, {"solutions": [1]}),
        "createSolutions": fs("create", f"realExams/{UNPUB}/private/answers", u, {"x": 1}),
        "uploadPdf": st("create", f"real-exams/{PUB}.pdf", u, {"size": 1000, "contentType": "application/pdf"}),
        "overwritePdf": st("update", f"real-exams/{PUB}.pdf", u, {"size": 1000, "contentType": "application/pdf"}),
        "uploadFigure": st("create", f"real-exams/{PUB}/figures/{FIG}.png", u, {"size": 1000, "contentType": "image/png"}),
        "deleteFigure": st("delete", f"real-exams/{PUB}/figures/{FIG}.png", u),
    }
    ok(f"WRITE (Firestore + Storage) · {LBL[u]} -> DENY", not any(w.values()), json.dumps({k: v for k, v in w.items() if v}) or "hammasi rad")

# noto'g'ri yo'llar (C — ruxsatli foydalanuvchi uchun ham)
bad = {
    "content/other": fs("get", f"realExams/{PUB}/content/answers", "C"),
    "private/other": fs("get", f"realExams/{PUB}/private/questions", "C"),
    "listContent": fs_list("x", "C", [f"realExams/{PUB}/content/questions"]),
    "listPrivate": fs_list("x", "C", [f"realExams/{PUB}/private/solutions"]),
    "nonPdf": st("get", f"real-exams/{PUB}.txt", "C"),
    "pdfBadName": st("get", "real-exams/evil.pdf", "C"),
    "deepPath": st("get", f"real-exams/{PUB}/other/x.png", "C"),
    "storageList": st("list", "real-exams/x", "C"),
}
ok("noto‘g‘ri yo‘llar / list (C) -> DENY", not any(bad.values()), json.dumps({k: v for k, v in bad.items() if v}) or "hammasi rad")

# users: client tomonidan role / fullAccess / mockTestsAccess o'zgartirish
for u in ["B", "C", "F"]:
    base = DOCS[f"users/{u}"]
    for field, val in (("role", "admin"), ("fullAccess", True), ("mockTestsAccess", True), ("mockTestsAccess", False)):
        if base.get(field) == val:
            continue
        allowed = fs("update", f"users/{u}", u, {**base, field: val})
        ok(f"users/{u}: o‘z '{field}'={val} -> DENY", not allowed)
# boshqa foydalanuvchining maydonini o'zgartirish
ok("users/C -> users/B.mockTestsAccess=true -> DENY", not fs("update", "users/B", "C", {**USERS["B"], "mockTestsAccess": True}))
ok("users/E (admin, flag=false) -> o‘z mockTestsAccess emas, Real Exam o‘qiy olmaydi", not fs("get", f"realExams/{PUB}/private/solutions", "E"))
# mavjud admin modeli (o'zgarmagan): admin access maydonlarini yangilay oladi — Real Exam bloki buni o'zgartirmaydi
BASE_FS = R.Engine(open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read())
for actor, target, patch in (("D", "B", {"mockTestsAccess": True}), ("D", "C", {"mockTestsAccess": False}), ("E", "B", {"fullAccess": True}),
                             ("C", "C", {"xp": 0, "fullName": "C2"}), ("B", "B", {"mockTestsAccess": True})):
    new = {**USERS[target], **patch}
    after = {**DOCS, f"users/{target}": new}
    prop = FS.allowed("update", f"users/{target}", auth(actor), DOCS, after, NOW, new_data=new)[0]
    base = BASE_FS.allowed("update", f"users/{target}", auth(actor), DOCS, after, NOW, new_data=new)[0]
    ok(f"users regressiya: {actor} -> users/{target} {patch}: taklif = repo ({'ALLOW' if base else 'DENY'})", prop == base, f"taklif={prop} repo={base}")

failed = [c for c in checks if not c["pass"]]
out = os.path.join(ROOT, "_private", "real-imtihonlar", "rules-proposed", f"real-exam-rules-report.{MODE}.json")
json.dump({"mode": MODE, "total": len(checks), "failed": len(failed), "checks": checks}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\n{len(checks) - len(failed)}/{len(checks)} PASS ({MODE})")
sys.exit(1 if failed else 0)
