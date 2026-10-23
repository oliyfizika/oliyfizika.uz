#!/usr/bin/env python3
"""Real imtihonlar E2E — mavjud lokal "Firebase" emulyatsiyasi (tools/attestatsiya-fizika/e2e/mock_server.py)
ustiga yupqa o'ram. Rasmiy emulyator emas; production'ga hech qanday ulanish yo'q.

  python3 tools/real-imtihonlar/e2e/run_mock.py --port 8796 [--rules proposed|repo]

  --rules proposed (standart): Firestore/Storage so'rovlari _private/real-imtihonlar/rules-proposed/ dagi
      TAKLIF qilingan qoidalar bilan tekshiriladi (repo firestore.rules + real-exams bloki).
      Avval: python3 tools/real-imtihonlar/rules/build_proposed_rules.py
  --rules repo: hozirgi repo qoidalari (real-exams bloki yo'q -> hammasi permission-denied bo'lishi kerak).

Ishga tushishda mock xotiraga yuklanadi (faqat test uchun, Rules chetlab — xuddi Admin SDK importi kabi):
  realExams/{id} (katalog), realExams/{id}/content/questions, realExams/{id}/private/solutions,
  Storage: real-exams/{id}.pdf (DUMMY fixture), real-exams/{id}/figures/{figureId}.png (lokal crop'lar),
  hamda bitta e'lon qilinmagan (published:false) test imtihoni: REAL-TEST-UNPUBLISHED.
Mavjud mock_server.py o'zgartirilmaydi.
"""
import argparse
import importlib.util
import json
import os
import sys
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PRIV = os.path.join(ROOT, "_private", "real-imtihonlar")
MOCK = os.path.join(ROOT, "tools", "attestatsiya-fizika", "e2e", "mock_server.py")

spec = importlib.util.spec_from_file_location("att_mock_server", MOCK)
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)


def preload():
    app = os.path.join(PRIV, "app-data")
    cat = json.load(open(os.path.join(app, "catalog.json"), encoding="utf-8"))
    fixture = open(os.path.join(ROOT, "tools", "real-imtihonlar", "fixtures", "local-fixture.pdf"), "rb").read()
    for e in cat["exams"]:
        eid = e["examId"]
        meta = {k: v for k, v in e.items() if k != "examId"}
        M.STATE["docs"][f"realExams/{eid}"] = meta
        M.STATE["docs"][f"realExams/{eid}/content/questions"] = json.load(open(os.path.join(app, "exams", eid, "questions.json"), encoding="utf-8"))
        M.STATE["docs"][f"realExams/{eid}/private/solutions"] = json.load(open(os.path.join(app, "exams", eid, "solutions.json"), encoding="utf-8"))
        M.STATE["files"][f"real-exams/{eid}.pdf"] = {"data": fixture, "contentType": "application/pdf"}
        for q in M.STATE["docs"][f"realExams/{eid}/content/questions"]["questions"]:
            for f in q["figures"]:
                M.STATE["files"][f["storagePath"]] = {"data": open(os.path.join(PRIV, f["localFile"]), "rb").read(), "contentType": "image/png"}
    first = cat["exams"][0]
    M.STATE["docs"]["realExams/REAL-TEST-UNPUBLISHED"] = {**{k: v for k, v in first.items() if k != "examId"}, "published": False, "displayDate": "TEST"}
    M.STATE["docs"]["realExams/REAL-TEST-UNPUBLISHED/content/questions"] = {"questions": []}
    M.STATE["docs"]["realExams/REAL-TEST-UNPUBLISHED/private/solutions"] = {"solutions": []}
    M.STATE["files"]["real-exams/REAL-TEST-UNPUBLISHED.pdf"] = {"data": fixture, "contentType": "application/pdf"}
    return len(cat["exams"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8796)
    ap.add_argument("--rules", choices=["proposed", "repo"], default="proposed")
    a = ap.parse_args()
    if a.rules == "proposed":
        d = os.path.join(PRIV, "rules-proposed")
        M.FS = M.R.Engine(open(os.path.join(d, "firestore.rules"), encoding="utf-8").read())
        M.ST = M.R.Engine(open(os.path.join(d, "storage.rules"), encoding="utf-8").read())
    n = preload()

    # /__mock/reset mock_server'da xotirani tozalaydi — real-exams ma'lumotlari qayta yuklanadi
    orig_post = M.H.do_POST

    def do_post(self):
        if self.path == "/__mock/reset":
            M.STATE.update({"docs": {}, "files": {}, "offset": M.dt.timedelta(0), "log": []})
            preload()
            return self._json(200, {"ok": True})
        return orig_post(self)

    M.H.do_POST = do_post
    print(f"real-exams mock firebase ({a.rules} rules, {n} exams): http://127.0.0.1:{a.port}/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", a.port), M.H).serve_forever()


if __name__ == "__main__":
    main()
