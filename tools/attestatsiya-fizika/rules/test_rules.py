#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: Firestore Rules testlari + DRY-RUN import (lokal, Firestore'ga hech narsa yuborilmaydi).

  python3 tools/attestatsiya-fizika/rules/test_rules.py [--bundle _private/attestatsiya-fizika/firestore-import.json]

1) DRY-RUN: import bundle'dagi har bir operatsiya admin sifatida repo firestore.rules orqali "yoziladi"
   (xotiradagi Firestore modeli). Validatsiya + Rules ruxsati + hujjat o'lchami + get() chegarasi tekshiriladi.
2) Xavfsizlik ssenariylari: draft/published, kalit/yechim vaqti, urinishlar, soxta natija, paid rejim, versiya,
   mavjud users/results qoidalari regressiyasi.
3) 32 kun bo'yicha tasodifiy foydalanuvchi javoblari: to'g'ri baholash qabul qilinadi, har qanday buzilgan
   qiymat rad etiladi.
Natija: _private/attestatsiya-fizika/rules-test-report.json
"""
import copy
import datetime as dt
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import rules_eval as R  # noqa: E402

UTC = dt.timezone.utc
TASHKENT = dt.timezone(dt.timedelta(hours=5))
SERVER = R.SERVER_TIME


def next_midnight_tashkent(t):
    local = t.astimezone(TASHKENT)
    nxt = dt.datetime(local.year, local.month, local.day, tzinfo=TASHKENT) + dt.timedelta(days=1)
    return nxt.astimezone(UTC)


class DB:
    def __init__(self, engine):
        self.e = engine
        self.docs = {}
        self.log = []
        self.max_gets = 0
        self.max_ops = 0

    @staticmethod
    def resolve(data, now):
        if data is SERVER:
            return now
        if isinstance(data, dict):
            return {k: DB.resolve(v, now) for k, v in data.items()}
        if isinstance(data, list):
            return [DB.resolve(v, now) for v in data]
        return data

    def read(self, auth, path, now):
        ok, g, ops = self.e.allowed("get", path, auth, self.docs, self.docs, now)
        self.max_gets = max(self.max_gets, g)
        return ok

    def query(self, auth, col, now, where=None):
        """List: Firestore so'rov natijasidagi HAR BIR hujjat uchun qoida bajarilishi shart."""
        prefix = col + "/"
        res = [p for p in self.docs if p.startswith(prefix) and "/" not in p[len(prefix):]]
        if where:
            k, v = where
            res = [p for p in res if self.docs[p].get(k) == v]
        for p in res:
            ok, g, _ = self.e.allowed("list", p, auth, self.docs, self.docs, now)
            if not ok:
                return False, len(res)
        return True, len(res)

    def write(self, auth, path, data, now, merge=True, op=None, apply=True):
        """set(merge) / update / create. Rules ga to'liq post-write hujjat beriladi."""
        exists = path in self.docs
        method = op or ("update" if exists else "create")
        if method == "create" and exists:
            return False
        if method == "update" and not exists:
            return False
        new = copy.deepcopy(self.docs.get(path, {})) if (merge and exists) else {}
        new.update(self.resolve(data, now))
        after = dict(self.docs)
        after[path] = new
        ok, g, ops = self.e.allowed(method, path, auth, self.docs, after, now, new_data=new)
        self.max_gets = max(self.max_gets, g)
        self.max_ops = max(self.max_ops, ops)
        if ok and apply:
            self.docs[path] = new
        return ok

    def delete(self, auth, path, now):
        return self.e.allowed("delete", path, auth, self.docs, {k: v for k, v in self.docs.items() if k != path},
                              now)[0]


def auth_of(uid, email=None):
    return None if uid is None else {"uid": uid, "token": {"email": email or f"{uid}@example.com"}}


def grade_of(answers, key, total):
    """Mos yozuvlar: klient tomonidagi baholash (frontend shu algoritmni ishlatadi)."""
    auto = key["answers"]
    correct = [q for q, a in auto.items() if answers.get(q) == a]
    wrong = [q for q, a in auto.items() if q in answers and answers[q] != a]
    s = key["scorableCount"]
    c = len(correct)
    pct = int(c * 100 / s + 0.5) if s else 0
    return {"status": "graded", "gradedAt": SERVER, "totalQuestions": total, "scorableQuestions": s,
            "correctAnswers": c, "wrongAnswers": len(wrong), "unanswered": s - c - len(wrong),
            "scorePercent": pct, "correctIds": correct, "wrongIds": wrong}


def random_answers(rnd, qids, key, p_right=0.5, p_skip=0.15):
    out = {}
    for q in qids:
        r = rnd.random()
        if r < p_skip:
            continue
        if q in key["answers"] and r < p_skip + p_right:
            out[q] = key["answers"][q]
        else:
            out[q] = rnd.choice("ABCDE")
    return out


def main():
    bundle_path = os.path.join(ROOT, "_private", "attestatsiya-fizika", "firestore-import.json")
    if "--bundle" in sys.argv:
        bundle_path = sys.argv[sys.argv.index("--bundle") + 1]
    bundle = json.load(open(bundle_path, encoding="utf-8"))
    engine = R.Engine(open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read())
    db = DB(engine)
    checks = []

    def expect(name, got, want=True):
        checks.append({"name": name, "pass": got == want, "got": got, "want": want})

    t0 = dt.datetime(2026, 10, 5, 4, 0, tzinfo=UTC)          # 09:00 Toshkent
    ADMIN, U1, U2, U3 = auth_of("admin1"), auth_of("user1"), auth_of("user2"), auth_of("user3")
    db.docs["users/admin1"] = {"fullName": "Admin", "email": "admin1@example.com", "role": "admin", "xp": 0, "level": 1,
                               "fullAccess": False}
    for u in ("user1", "user2", "user3"):
        db.docs[f"users/{u}"] = {"fullName": u, "email": f"{u}@example.com", "xp": 0, "level": 1, "fullAccess": False}

    # ------------------------------------------------------------ 1. DRY-RUN IMPORT (admin)
    dry = {"operations": 0, "allowed": 0, "denied": [], "maxDocBytes": 0}
    order = sorted(bundle["ops"], key=lambda o: (0 if "Settings" in o["path"] else 1,
                                                 o["path"].count("/")))   # parent hujjat oldin
    # Testlar draft ekan, versiya/kalit/yechim yaratiladi; publish keyin.
    for o in order:
        dry["operations"] += 1
        size = len(json.dumps(o["data"], ensure_ascii=False).encode())
        dry["maxDocBytes"] = max(dry["maxDocBytes"], size)
        ok = db.write(ADMIN, o["path"], o["data"], t0, merge=False, op=None if o["op"] == "set" else "create")
        if ok:
            dry["allowed"] += 1
        else:
            dry["denied"].append(o["path"])
    fig_bundle = json.load(open(os.path.join(os.path.dirname(bundle_path), "firestore-figures.json"), encoding="utf-8"))
    fig_dry = {"operations": 0, "allowed": 0}
    for o in fig_bundle["ops"]:
        fig_dry["operations"] += 1
        if db.write(ADMIN, o["path"], o["data"], t0, merge=False, op="create"):
            fig_dry["allowed"] += 1
    dry["figureDocs"] = fig_dry
    expect(f"dry-run: Firestore figure hujjatlari (muqobil) admin tomonidan yoziladi ({fig_dry['operations']})",
           fig_dry["allowed"] == fig_dry["operations"] > 0)
    storage_engine = R.Engine(open(os.path.join(ROOT, "storage.rules"), encoding="utf-8").read())
    upload = json.load(open(os.path.join(os.path.dirname(bundle_path), "storage-upload.json"), encoding="utf-8"))

    def stor(auth, path, now, method="get", meta=None):
        return storage_engine.allowed_storage(method, path, auth, db.docs, now, new_meta=meta)[0]

    st_up = sum(stor(ADMIN, u["path"], t0, "create", {"size": u["bytes"], "contentType": u["mime"]})
                for u in upload["items"])
    expect(f"Storage: admin {len(upload['items'])} ta rasmni yuklay oladi (create)", st_up == len(upload["items"]) > 0)
    expect("Storage: user rasm yuklay olmaydi",
           stor(auth_of("user1"), upload["items"][0]["path"], t0, "create", {"size": 100, "contentType": "image/webp"}), False)
    expect("Storage: admin ham PDF/katta fayl yuklay olmaydi",
           stor(ADMIN, upload["items"][0]["path"], t0, "create", {"size": 3 * 1024 * 1024, "contentType": "application/pdf"}),
           False)
    tests = sorted([p for p in db.docs if p.startswith("attestationPhysicsDailyTests/") and p.count("/") == 1],
                   key=lambda p: db.docs[p]["dayNumber"])
    qdocs = [p for p in db.docs if p.startswith("attestationPhysicsQuestions/") and p.count("/") == 1]
    dry["collections"] = {
        "attestationPhysicsSettings": sum(p.startswith("attestationPhysicsSettings/") for p in db.docs),
        "attestationPhysicsQuestions": len(qdocs),
        "attestationPhysicsQuestions/*/private": sum(p.endswith("/private/answer") for p in db.docs),
        "attestationPhysicsDailyTests": len(tests),
        "…/versions": sum("/versions/" in p for p in db.docs),
        "…/keys": sum("/keys/" in p for p in db.docs),
        "…/solutions": sum("/solutions/" in p for p in db.docs),
    }
    ev = {"auto": 0, "open": 0, "unreliable": 0}
    for p in qdocs:
        ev[db.docs[p]["evaluationType"]] += 1
    assigned = [q for p in tests for q in db.docs[p]["questionIds"]]
    dry["summary"] = {"questions": len(qdocs), "dailyTests": len(tests), **ev, "assigned": len(assigned),
                      "missing": len(set(p.split("/")[1] for p in qdocs) - set(assigned)),
                      "duplicates": len(assigned) - len(set(assigned))}
    cnt = bundle.get("counts") or {"auto": 865, "open": 81, "unreliable": 81}
    dry_ok = (not dry["denied"] and dry["summary"] == {"questions": 1027, "dailyTests": 32, "auto": cnt["auto"], "open": cnt["open"],
                                                       "unreliable": cnt["unreliable"], "assigned": 1027, "missing": 0,
                                                       "duplicates": 0}
              and all(db.docs[p]["status"] == "draft" for p in tests))
    dry["status"] = "PASS" if dry_ok else "FAIL"
    expect("dry-run import: barcha operatsiyalar Rules'dan o'tdi va hisoblar to'g'ri", dry_ok)

    def _nested(v, in_arr=False):
        if isinstance(v, list):
            return in_arr or any(_nested(x, True) for x in v)
        if isinstance(v, dict):
            return any(_nested(x, False) for x in v.values())
        return False
    nested_ops = [o["path"] for o in bundle["ops"] if _nested(o["data"])]
    dry["nestedArrays"] = len(nested_ops)
    expect("dry-run: Firestore formati — massiv ichida massiv yo'q (batch.set() rad etmaydi)", not nested_ops)
    # Oddiy foydalanuvchi import qila olmaydi
    expect("user import qila olmaydi (dailyTest create)",
           db.write(U1, "attestationPhysicsDailyTests/x", {"id": "x"}, t0, apply=False), False)
    expect("user savol yozolmaydi", db.write(U1, qdocs[0], {"topic": "x"}, t0, apply=False), False)

    D1, D2 = tests[0], tests[1]
    d1id, d2id = D1.split("/")[1], D2.split("/")[1]
    q_d1 = db.docs[D1]["questionIds"][0]
    q_d2 = db.docs[D2]["questionIds"][0]

    # ------------------------------------------------------------ 2. draft himoyasi
    expect("mehmon settings o'qiy olmaydi", db.read(None, "attestationPhysicsSettings/config", t0), False)
    expect("mehmon draft testni o'qiy olmaydi", db.read(None, D1, t0), False)
    expect("user draft testni o'qiy olmaydi", db.read(U1, D1, t0), False)
    expect("user draft versiyani o'qiy olmaydi", db.read(U1, D1 + "/versions/v1", t0), False)
    expect("user draft savolni o'qiy olmaydi", db.read(U1, f"attestationPhysicsQuestions/{q_d1}", t0), False)
    expect("admin draft testni o'qiydi", db.read(ADMIN, D1, t0), True)
    d1_fig_q = next(u for u in upload["items"] if u["testId"] == d1id and u["scope"] == "question")
    sol_items = [u for u in upload["items"] if u["scope"] == "solution"]
    sol_fig = sol_items[0]
    sol_test = sol_fig["testId"]
    expect("Storage: mehmon draft rasmni ko'ra olmaydi", stor(None, d1_fig_q["path"], t0), False)
    expect("Storage: user draft kun rasmini ko'ra olmaydi", stor(U1, d1_fig_q["path"], t0), False)
    expect("Storage: admin draft rasmni ko'radi", stor(ADMIN, d1_fig_q["path"], t0), True)
    expect("Storage: ro'yxatda yo'q yo'l — rad", stor(ADMIN, "other/secret.png", t0), False)
    fig_doc_d1 = f"attestationPhysicsDailyTests/{d1id}/figures/{d1_fig_q['path'].rsplit('/', 1)[1]}"
    expect("Firestore figure: user draft rasmini o'qiy olmaydi", db.read(U1, fig_doc_d1, t0), False)
    expect("user published-filtrli so'rov (0 natija) — ruxsat",
           db.query(U1, "attestationPhysicsDailyTests", t0, ("published", True))[0], True)
    expect("user filtrsiz test so'rovi — rad", db.query(U1, "attestationPhysicsDailyTests", t0)[0], False)
    expect("user private javobni o'qiy olmaydi", db.read(U1, f"attestationPhysicsQuestions/{q_d1}/private/answer", t0), False)
    expect("user savollar ro'yxatini (list) ololmaydi", db.query(U1, "attestationPhysicsQuestions", t0)[0], False)

    # ------------------------------------------------------------ 3. ADMIN PUBLISH (push) Day 1
    sol_at = next_midnight_tashkent(t0)
    pub = {"status": "published", "published": True, "publishedAt": SERVER, "publishedBy": "admin1",
           "solutionAvailableAt": sol_at}
    expect("user publish qila olmaydi", db.write(U1, D1, pub, t0, apply=False), False)
    expect("publish: o'tgan solutionAvailableAt — rad",
           db.write(ADMIN, D1, {**pub, "solutionAvailableAt": t0 - dt.timedelta(hours=1)}, t0, apply=False), False)
    expect("publish: publishedAt server vaqti emas — rad",
           db.write(ADMIN, D1, {**pub, "publishedAt": t0 - dt.timedelta(minutes=5)}, t0, apply=False), False)
    expect("publish: savollar ro'yxatini o'zgartirib — rad",
           db.write(ADMIN, D1, {**pub, "questionIds": db.docs[D1]["questionIds"][:-1],
                                "questionCount": db.docs[D1]["questionCount"] - 1}, t0, apply=False), False)
    db.docs["attestationPhysicsDailyTests/zz-test"] = {**db.docs[D2], "id": "zz-test"}
    expect("publish: versiya hujjatlarisiz — rad",
           db.write(ADMIN, "attestationPhysicsDailyTests/zz-test", pub, t0, apply=False), False)
    del db.docs["attestationPhysicsDailyTests/zz-test"]
    expect("ADMIN PUBLISH Day 1", db.write(ADMIN, D1, pub, t0), True)
    expect("Day 1: status=published, publishedAt=server vaqt",
           db.docs[D1]["status"] == "published" and db.docs[D1]["publishedAt"] == t0)
    expect("solutionAvailableAt = ertasi 00:00 Toshkent (19:00 UTC)",
           db.docs[D1]["solutionAvailableAt"].astimezone(TASHKENT).strftime("%H:%M") == "00:00")

    t1 = t0 + dt.timedelta(minutes=30)
    expect("user published Day 1 ni o'qiydi", db.read(U1, D1, t1), True)
    expect("user published-filtrli so'rov — ruxsat (1 natija)",
           db.query(U1, "attestationPhysicsDailyTests", t1, ("published", True)), (True, 1))
    expect("user Day 1 snapshot (javobsiz savollar) ni o'qiydi", db.read(U1, D1 + "/versions/v1", t1), True)
    snap = db.docs[D1 + "/versions/v1"]
    expect("snapshotda correctAnswer/solution yo'q",
           not any(k in json.dumps(snap) for k in ('"correctAnswer"', '"solution"', '"answers"')))
    expect("user Day 1 savol hujjatini o'qiydi", db.read(U1, f"attestationPhysicsQuestions/{q_d1}", t1), True)
    expect("user Day 2 (draft) hali yopiq", db.read(U1, D2, t1), False)
    expect("user Day 2 savoli yopiq", db.read(U1, f"attestationPhysicsQuestions/{q_d2}", t1), False)
    expect("kalit: urinishsiz — rad", db.read(U1, D1 + "/keys/v1", t1), False)
    expect("yechim: vaqtidan oldin — rad", db.read(U1, D1 + "/solutions/v1", t1), False)
    expect("mehmon published testni ham o'qiy olmaydi", db.read(None, D1, t1), False)
    expect("Storage: user published kun rasmini ko'radi", stor(U1, d1_fig_q["path"], t1), True)
    expect("Storage: mehmon published rasmni ham ko'ra olmaydi", stor(None, d1_fig_q["path"], t1), False)
    expect("Firestore figure: user published rasmini o'qiydi", db.read(U1, fig_doc_d1, t1), True)
    d2_fig = next((u for u in upload["items"] if u["testId"] == d2id and u["scope"] == "question"), None)
    if d2_fig:
        expect("Storage: Day 2 (draft) rasmi hali yopiq", stor(U1, d2_fig["path"], t1), False)

    # ------------------------------------------------------------ 4. ATTEMPT: start
    T = db.docs[D1]
    A1 = f"attestationPhysicsAttempts/user1__{d1id}"
    start = {"userId": "user1", "testId": d1id, "dayNumber": T["dayNumber"], "testVersion": 1, "attemptNumber": 1,
             "kind": "official", "status": "in_progress", "startedAt": SERVER,
             "questionCount": T["questionCount"]}
    expect("start: boshqa user nomidan — rad",
           db.write(U2, A1, start, t1, op="create", apply=False), False)
    expect("start: noto'g'ri attemptId — rad",
           db.write(U1, f"attestationPhysicsAttempts/user1__x{d1id}", start, t1, op="create", apply=False), False)
    expect("start: startedAt klient vaqti — rad",
           db.write(U1, A1, {**start, "startedAt": t1 - dt.timedelta(minutes=40)}, t1, op="create", apply=False), False)
    expect("start: attemptNumber 2 — rad", db.write(U1, A1, {**start, "attemptNumber": 2}, t1, op="create", apply=False), False)
    expect("start: oldindan scorePercent bilan — rad",
           db.write(U1, A1, {**start, "scorePercent": 100}, t1, op="create", apply=False), False)
    expect("start: draft Day 2 — rad",
           db.write(U1, f"attestationPhysicsAttempts/user1__{d2id}",
                    {**start, "testId": d2id, "dayNumber": 2}, t1, op="create", apply=False), False)
    expect("start: to'g'ri — ruxsat", db.write(U1, A1, start, t1, op="create"), True)
    expect("start: qayta (2-rasmiy urinish) — rad", db.write(U1, A1, start, t1 + dt.timedelta(seconds=5)), False)
    expect("kalit: in_progress paytida — rad (DevTools orqali oldindan olib bo'lmaydi)",
           db.read(U1, D1 + "/keys/v1", t1), False)
    expect("user2 user1 urinishini o'qiy olmaydi", db.read(U2, A1, t1), False)
    expect("user1 o'z urinishini o'qiydi", db.read(U1, A1, t1), True)
    expect("user2 barcha urinishlar so'rovi — rad", db.query(U2, "attestationPhysicsAttempts", t1)[0], False)
    expect("user1 o'z urinishlari so'rovi (userId filtri) — ruxsat",
           db.query(U1, "attestationPhysicsAttempts", t1, ("userId", "user1"))[0], True)
    expect("admin barcha urinishlarni ko'radi", db.query(ADMIN, "attestationPhysicsAttempts", t1)[0], True)

    # ------------------------------------------------------------ 5. SUBMIT
    key = db.docs[D1 + "/keys/v1"]
    n = T["questionCount"]
    rnd = random.Random(42)
    answers = random_answers(rnd, T["questionIds"], key)
    t2 = t1 + dt.timedelta(minutes=24, seconds=31)
    sub = {"status": "submitted", "completedAt": SERVER, "answers": answers}
    q0 = T["questionIds"][0]
    expect("submit: noto'g'ri harf — rad", db.write(U1, A1, {**sub, "answers": {**answers, q0: "F"}}, t2, apply=False), False)
    expect("submit: begona savol ID — rad",
           db.write(U1, A1, {**sub, "answers": {**answers, q_d2: "A"}}, t2, apply=False), False)
    expect("submit: answers ro'yxat (map emas) — rad",
           db.write(U1, A1, {**sub, "answers": list(answers.values())}, t2, apply=False), False)
    expect("submit: correctAnswers/scorePercent'ni o'zi yozish — rad",
           db.write(U1, A1, {**sub, "correctAnswers": n, "scorePercent": 100}, t2, apply=False), False)
    expect("submit: completedAt klient vaqti — rad",
           db.write(U1, A1, {**sub, "completedAt": t1}, t2, apply=False), False)
    expect("submit: vaqt chegarasi YO'Q — 5 soatdan keyin ham ruxsat (yechim ochilishidan oldin)",
           db.write(U1, A1, sub, t1 + dt.timedelta(hours=5), apply=False), True)
    expect("start: timeLimitSeconds maydoni bilan — rad (vaqt chegarasi yo'q)",
           db.write(U1, f"attestationPhysicsAttempts/user3__{d1id}", {**start, "userId": "user3", "timeLimitSeconds": 3600},
                    t1, op="create", apply=False), False)
    expect("save: qoralama javoblar — ruxsat",
           db.write(U1, A1, {"answers": {q0: "A"}, "savedAt": SERVER}, t1 + dt.timedelta(minutes=3), apply=False), True)
    expect("save: qoralama bilan status/natija yozish — rad",
           db.write(U1, A1, {"answers": {q0: "A"}, "savedAt": SERVER, "correctAnswers": 5}, t1 + dt.timedelta(minutes=3),
                    apply=False), False)
    expect("save: boshqa user — rad",
           db.write(U2, A1, {"answers": {q0: "A"}, "savedAt": SERVER}, t1 + dt.timedelta(minutes=3), apply=False), False)
    expect("get: o'z (hali yo'q) urinish hujjati — ruxsat (mavjud emas javobi)",
           db.read(U3, f"attestationPhysicsAttempts/user3__{d1id}", t1), True)
    expect("get: boshqa userning (yo'q) urinish yo'li — rad",
           db.read(U3, f"attestationPhysicsAttempts/user1x__{d1id}", t1), False)
    expect("submit: boshqa user — rad", db.write(U2, A1, sub, t2, apply=False), False)
    expect("submit: to'g'ri — ruxsat", db.write(U1, A1, sub, t2), True)
    expect("submit: javoblarni keyin o'zgartirish — rad",
           db.write(U1, A1, {"answers": dict(key["answers"])}, t2 + dt.timedelta(seconds=10), apply=False), False)
    expect("kalit: submit'dan keyin — ruxsat (darhol natija va to'g'ri javob)", db.read(U1, D1 + "/keys/v1", t2), True)
    expect("kalit: boshqa user (urinishsiz) — rad", db.read(U2, D1 + "/keys/v1", t2), False)
    expect("yechim: submit'dan keyin ham hali yopiq", db.read(U1, D1 + "/solutions/v1", t2), False)

    # ------------------------------------------------------------ 6. GRADE (Rules ichida tekshiriladi)
    t3 = t2 + dt.timedelta(seconds=2)
    g = grade_of(answers, key, n)
    g["timeSpentSeconds"] = int((t2 - t1).total_seconds())
    non_auto = [q for q in T["questionIds"] if q not in key["answers"]]
    forged = [
        ("correctAnswers +1", {**g, "correctAnswers": g["correctAnswers"] + 1}),
        ("scorePercent 100", {**g, "scorePercent": 100}),
        ("scorePercent +1", {**g, "scorePercent": g["scorePercent"] + 1}),
        ("noto'g'ri javob correctIds'ga ko'chirilgan",
         {**g, "correctIds": g["correctIds"] + g["wrongIds"][:1], "correctAnswers": g["correctAnswers"] + 1,
          "wrongIds": g["wrongIds"][1:], "wrongAnswers": g["wrongAnswers"] - 1}),
        ("baholanmaydigan savol correctIds'da",
         {**g, "correctIds": g["correctIds"][:-1] + non_auto[:1]}),
        ("wrongAnswers noto'g'ri", {**g, "wrongAnswers": g["wrongAnswers"] - 1}),
        ("unanswered noto'g'ri", {**g, "unanswered": g["unanswered"] + 1}),
        ("timeSpentSeconds kamaytirilgan", {**g, "timeSpentSeconds": 60}),
        ("scorableQuestions noto'g'ri", {**g, "scorableQuestions": n}),
        ("qo'shimcha maydon (isCorrect)", {**g, "isCorrect": True}),
        ("answers'ni grade bilan o'zgartirish", {**g, "answers": dict(key["answers"])}),
    ]
    for name, data in forged:
        expect(f"grade soxta: {name} — rad", db.write(U1, A1, data, t3, apply=False), False)
    expect("grade: user2 boshqa urinishni baholay olmaydi", db.write(U2, A1, g, t3, apply=False), False)
    expect("grade: to'g'ri — ruxsat", db.write(U1, A1, g, t3), True)
    a = db.docs[A1]
    expect("natija: Day/ball/vaqt saqlandi",
           a["status"] == "graded" and a["timeSpentSeconds"] == 1471 and a["scorePercent"] == g["scorePercent"])
    expect("grade: qayta (graded) — rad", db.write(U1, A1, {**g, "scorePercent": 0}, t3, apply=False), False)
    expect("user urinishni o'chira olmaydi", db.delete(U1, A1, t3), False)
    expect("admin ham urinishni o'chira olmaydi", db.delete(ADMIN, A1, t3), False)
    expect("admin testni o'chira olmaydi", db.delete(ADMIN, D1, t3), False)
    expect("admin savolni o'chira olmaydi", db.delete(ADMIN, qdocs[0], t3), False)

    # Admin baholashi (foydalanuvchi grade yozmagan holat)
    A2 = f"attestationPhysicsAttempts/user2__{d1id}"
    db.write(U2, A2, {**start, "userId": "user2"}, t1, op="create")
    ans2 = dict(key["answers"])
    db.write(U2, A2, {**sub, "answers": ans2}, t2)
    g2 = {**grade_of(ans2, key, n), "timeSpentSeconds": int((t2 - t1).total_seconds())}
    expect("admin boshqa userning topshirilgan urinishini baholaydi", db.write(ADMIN, A2, g2, t3), True)
    expect("100% natija to'g'ri hisoblandi (faqat auto savollar)", db.docs[A2]["scorePercent"] == 100
           and db.docs[A2]["correctAnswers"] == key["scorableCount"])

    # ------------------------------------------------------------ 7. ertasi kun: yechim ochiladi
    t4 = sol_at + dt.timedelta(minutes=1)
    expect("yechim: solutionAvailableAt'dan oldin 1 daqiqa — rad", db.read(U1, D1 + "/solutions/v1", sol_at - dt.timedelta(minutes=1)), False)
    expect("yechim: ertasi kuni — ruxsat", db.read(U1, D1 + "/solutions/v1", t4), True)
    expect("yechim: urinishsiz user ham ertasi kuni ko'radi", db.read(U3, D1 + "/solutions/v1", t4), True)
    expect("rasmiy urinish: yechim ochilgach start — rad",
           db.write(U3, f"attestationPhysicsAttempts/user3__{d1id}", {**start, "userId": "user3"}, t4, op="create",
                    apply=False), False)
    d1_sol = [u for u in sol_items if u["testId"] == d1id]
    if d1_sol:
        expect("Storage: yechim rasmi ertasi kuni ochiq", stor(U1, d1_sol[0]["path"], t4), True)
        expect("user private javob hujjatini ertasi kuni ham o'qiy olmaydi",
           db.read(U1, f"attestationPhysicsQuestions/{q_d1}/private/answer", t4), False)

    # ------------------------------------------------------------ 8. versiya
    v2 = copy.deepcopy(db.docs[D1 + "/versions/v1"])
    v2["version"] = 2
    expect("published v1 snapshot'ni tahrirlash — rad", db.write(ADMIN, D1 + "/versions/v1", {"questions": []}, t4, apply=False), False)
    for col in ("versions", "keys", "solutions"):
        d = copy.deepcopy(db.docs[f"{D1}/{col}/v1"])
        d["version"] = 2
        db.write(ADMIN, f"{D1}/{col}/v2", d, t4, op="create")
    expect("currentVersion +1 (v2 tayyor) — ruxsat", db.write(ADMIN, D1, {"currentVersion": 2}, t4), True)
    expect("eski urinish v1 bilan qoladi", db.docs[A1]["testVersion"] == 1)
    expect("user1 v1 kalitini o'qiydi, v2 ni emas (urinish v1)",
           (db.read(U1, D1 + "/keys/v1", t2), db.read(U1, D1 + "/keys/v2", t2)) == (True, False))

    # ------------------------------------------------------------ 9. archive
    expect("archive — ruxsat", db.write(ADMIN, D1, {"status": "archived", "archivedAt": SERVER}, t4), True)
    expect("archived test user'ga ko'rinadi (natija/yechim uchun)", db.read(U1, D1, t4), True)

    # ------------------------------------------------------------ 9b. UNARCHIVE (archived -> draft, faqat admin)
    UN = {"status": "draft", "published": False}
    meta0 = copy.deepcopy(db.docs[D1])
    sub0 = {p: copy.deepcopy(v) for p, v in db.docs.items() if p.startswith(D1 + "/")}
    att0 = {p: copy.deepcopy(v) for p, v in db.docs.items() if p.startswith("attestationPhysicsAttempts/")}
    graded0 = [p for p, v in att0.items() if p.endswith("__" + d1id) and v.get("status") == "graded"]
    expect("unarchive: user — rad", db.write(U1, D1, UN, t4, apply=False), False)
    expect("unarchive: mehmon — rad", db.write(None, D1, UN, t4, apply=False), False)
    expect("unarchive: published=true qoldirib — rad", db.write(ADMIN, D1, {"status": "draft"}, t4, apply=False), False)
    expect("unarchive: questionIds o'zgartirib — rad",
           db.write(ADMIN, D1, {**UN, "questionIds": meta0["questionIds"][:-1], "questionCount": meta0["questionCount"] - 1},
                    t4, apply=False), False)
    expect("unarchive: currentVersion o'zgartirib — rad",
           db.write(ADMIN, D1, {**UN, "currentVersion": meta0["currentVersion"] + 1}, t4, apply=False), False)
    expect("unarchive: publishedAt=null — rad", db.write(ADMIN, D1, {**UN, "publishedAt": None}, t4, apply=False), False)
    expect("unarchive: solutionAvailableAt=null — rad",
           db.write(ADMIN, D1, {**UN, "solutionAvailableAt": None}, t4, apply=False), False)
    expect("unarchive: yangi maydon (unarchivedAt) — rad",
           db.write(ADMIN, D1, {**UN, "unarchivedAt": SERVER}, t4, apply=False), False)
    expect("unarchive: archived -> published to'g'ridan-to'g'ri — rad",
           db.write(ADMIN, D1, {"status": "published"}, t4, apply=False), False)
    expect("UNARCHIVE: admin archived -> draft — ruxsat", db.write(ADMIN, D1, UN, t4), True)
    m1 = db.docs[D1]
    expect("unarchive: faqat status va published o'zgardi",
           {k for k in set(meta0) | set(m1) if meta0.get(k) != m1.get(k)} == {"status", "published"})
    expect("unarchive: questionIds o'zgarmagan", m1["questionIds"] == meta0["questionIds"])
    expect("unarchive: versiya o'zgarmagan (v2)", m1["currentVersion"] == meta0["currentVersion"] == 2)
    expect("unarchive: publishedAt / solutionAvailableAt o'zgarmagan",
           (m1["publishedAt"], m1["solutionAvailableAt"]) == (meta0["publishedAt"], meta0["solutionAvailableAt"]))
    expect("unarchive: versions/keys/solutions/figures o'zgarmagan",
           {p: v for p, v in db.docs.items() if p.startswith(D1 + "/")} == sub0)
    expect("unarchive: barcha urinishlar o'zgarmagan",
           {p: v for p, v in db.docs.items() if p.startswith("attestationPhysicsAttempts/")} == att0)
    expect("unarchive: graded urinish o'zgarmagan (ball, holat, testVersion)",
           bool(graded0) and all(db.docs[p] == att0[p] for p in graded0))
    for col in ("versions", "keys", "solutions"):
        for v in ("v1", "v2"):
            expect(f"unarchive'dan keyin {col}/{v} ni tahrirlash — rad",
                   db.write(ADMIN, f"{D1}/{col}/{v}", {"note": "x"}, t4, apply=False), False)
    expect("unarchive'dan keyin draft tahriri (kontent) — rad",
           db.write(ADMIN, D1, {"timeLimitSeconds": 3600}, t4, apply=False), False)
    expect("unarchive'dan keyin user draft testni o'qiy olmaydi", db.read(U1, D1, t4), False)
    expect("unarchive'dan keyin user published-so'rovida Day 1 yo'q",
           db.query(U1, "attestationPhysicsDailyTests", t4, ("published", True))[0] and db.docs[D1]["published"] is False)
    expect("unarchive'dan keyin yangi rasmiy urinish — rad",
           db.write(U3, f"attestationPhysicsAttempts/user3__{d1id}", {**start, "userId": "user3", "testVersion": 2},
                    t4, op="create", apply=False), False)
    expect("draft -> archived to'g'ridan-to'g'ri — rad",
           db.write(ADMIN, D1, {"status": "archived", "published": True}, t4, apply=False), False)
    drafts = [p for p in tests if db.docs[p]["status"] == "draft" and db.docs[p].get("publishedAt") is None]
    expect("hech qachon e'lon qilinmagan draft: versions/keys/solutions tahriri — ruxsat (migratsiya o'zgarmagan)",
           all(db.write(ADMIN, f"{drafts[0]}/{c}/v1", {"note": "x"}, t4, apply=False) for c in ("versions", "keys", "solutions")))
    sol_re = next_midnight_tashkent(t4)
    expect("unarchive'dan keyin PUBLISH (mavjud logika) — ruxsat",
           db.write(ADMIN, D1, {**pub, "solutionAvailableAt": sol_re}, t4), True)
    expect("qayta publish: versiya va savollar o'zgarmagan",
           db.docs[D1]["currentVersion"] == 2 and db.docs[D1]["questionIds"] == meta0["questionIds"])
    expect("qayta publish: urinishlar o'zgarmagan",
           {p: v for p, v in db.docs.items() if p.startswith("attestationPhysicsAttempts/")} == att0)
    expect("published -> draft — rad", db.write(ADMIN, D1, UN, t4, apply=False), False)
    expect("published -> draft (faqat status) — rad", db.write(ADMIN, D1, {"status": "draft"}, t4, apply=False), False)
    expect("qayta archive — ruxsat", db.write(ADMIN, D1, {"status": "archived", "archivedAt": SERVER}, t4), True)

    # ------------------------------------------------------------ 10. PAID rejim (kelajak)
    db.write(ADMIN, D2, {**pub, "solutionAvailableAt": next_midnight_tashkent(t4)}, t4)
    expect("settings: user accessMode'ni o'zgartira olmaydi",
           db.write(U1, "attestationPhysicsSettings/config", {"accessMode": "open"}, t4, apply=False), False)
    expect("settings: courseStartDate qo'shib bo'lmaydi",
           db.write(ADMIN, "attestationPhysicsSettings/config", {"courseStartDate": t4}, t4, apply=False), False)
    expect("admin accessMode=paid", db.write(ADMIN, "attestationPhysicsSettings/config", {"accessMode": "paid"}, t4), True)
    expect("paid: ruxsatsiz user — rad", db.read(U3, D2, t4), False)
    expect("paid: user attestationAccess ni o'ziga yozolmaydi",
           db.write(U3, "users/user3", {"attestationAccess": True}, t4, apply=False), False)
    db.docs["users/user3"]["attestationAccess"] = True        # (kelajakda admin access sahifasidan)
    expect("paid: attestationAccess=true user — ruxsat", db.read(U3, D2, t4), True)
    expect("paid: admin — ruxsat", db.read(ADMIN, D2, t4), True)
    db.write(ADMIN, "attestationPhysicsSettings/config", {"accessMode": "open"}, t4)
    expect("open rejimga qaytdi", db.docs["attestationPhysicsSettings/config"]["accessMode"] == "open")
    del db.docs["users/user3"]["attestationAccess"]

    # ------------------------------------------------------------ 11. admin xatosidan himoya
    expect("public savolga correctAnswer yozish — rad",
           db.write(ADMIN, qdocs[0], {"correctAnswer": "A"}, t4, apply=False), False)

    # ------------------------------------------------------------ 12. mavjud qoidalar regressiyasi
    res = {"uid": "user1", "lessonId": 1, "score": 9, "totalQuestions": 10, "percent": 90, "passed": True,
           "completedAt": SERVER, "email": "user1@example.com"}
    expect("regress: results create (mavjud qoida) — ruxsat", db.write(U1, "results/r1", res, t4, op="create"), True)
    expect("regress: o'ziga fullAccess yozish — rad", db.write(U1, "users/user1", {"fullAccess": True}, t4, apply=False), False)
    expect("regress: ism yangilash — ruxsat", db.write(U1, "users/user1", {"firstName": "Ali"}, t4, apply=False), True)

    # ------------------------------------------------------------ 13. 32 kun — tasodifiy baholash
    sim = {"days": 0, "gradesAccepted": 0, "forgeriesRejected": 0, "forgeriesTried": 0}
    tt = t4
    for p in tests:
        tid = p.split("/")[1]
        T = db.docs[p]
        if T["status"] != "draft":       # Day 1–2 yuqorida ishlatilgan (archived / muddati o'tgan)
            continue
        ok = db.write(ADMIN, p, {**pub, "solutionAvailableAt": next_midnight_tashkent(tt)}, tt)
        if not ok:
            expect(f"sim publish {tid}", False)
            continue
        T = db.docs[p]
        k = db.docs[f"{p}/keys/v{T['currentVersion']}"]
        for ui in range(3):
            uid = f"sim{ui}"
            db.docs.setdefault(f"users/{uid}", {"fullName": uid, "email": f"{uid}@example.com", "xp": 0, "level": 1,
                                                "fullAccess": False})
            au = auth_of(uid)
            aid = f"attestationPhysicsAttempts/{uid}__{tid}"
            st = {**start, "userId": uid, "testId": tid, "dayNumber": T["dayNumber"],
                  "testVersion": T["currentVersion"],
                  "questionCount": T["questionCount"]}
            s0 = tt + dt.timedelta(minutes=1 + ui)
            if not db.write(au, aid, st, s0, op="create"):
                expect(f"sim start {tid} {uid}", False)
                continue
            ans = random_answers(rnd, T["questionIds"], k, p_right=rnd.random(), p_skip=rnd.random() * 0.3)
            s1 = s0 + dt.timedelta(seconds=rnd.randint(60, 3500))
            if not db.write(au, aid, {"status": "submitted", "completedAt": SERVER, "answers": ans}, s1):
                expect(f"sim submit {tid} {uid}", False)
                continue
            gg = {**grade_of(ans, k, T["questionCount"]), "timeSpentSeconds": int((s1 - s0).total_seconds())}
            for _ in range(3):
                bad = copy.deepcopy(gg)
                field = rnd.choice(["correctAnswers", "wrongAnswers", "unanswered", "scorePercent", "swap"])
                if field == "swap":
                    others = [q for q in T["questionIds"] if q not in bad["correctIds"]]
                    bad["correctIds"] = bad["correctIds"][:-1] + [rnd.choice(others)] if bad["correctIds"] \
                        else [rnd.choice(others)]
                    bad["correctAnswers"] = len(bad["correctIds"])
                else:
                    bad[field] += rnd.choice([-1, 1])
                sim["forgeriesTried"] += 1
                if not db.write(au, aid, bad, s1 + dt.timedelta(seconds=1), apply=False):
                    sim["forgeriesRejected"] += 1
            if db.write(au, aid, gg, s1 + dt.timedelta(seconds=1)):
                sim["gradesAccepted"] += 1
        if tid == sol_test:
            sp = sol_fig["path"]
            expect("Storage: yechim rasmi solutionAvailableAt dan oldin yopiq", stor(au, sp, s1), False)
            expect("Storage: yechim rasmi solutionAvailableAt dan keyin ochiq",
                   stor(au, sp, db.docs[p]["solutionAvailableAt"] + dt.timedelta(seconds=1)), True)
            fd = f"attestationPhysicsDailyTests/{tid}/solutionFigures/{sp.rsplit('/', 1)[1]}"
            expect("Firestore yechim rasmi: vaqtidan oldin rad / keyin ruxsat",
                   (db.read(au, fd, s1), db.read(au, fd, db.docs[p]["solutionAvailableAt"] + dt.timedelta(seconds=1))),
                   (False, True))
        sim["days"] += 1
        tt = next_midnight_tashkent(tt) + dt.timedelta(hours=4)
    expect("simulyatsiya: Day 3–32 (30 kun) × 3 user baholash qabul qilindi",
           sim["gradesAccepted"] == 30 * 3 and sim["days"] == 30)
    expect("simulyatsiya: barcha soxta results rad etildi", sim["forgeriesRejected"] == sim["forgeriesTried"])

    expect("Rules get() chegarasi (≤10) saqlangan", db.max_gets <= 10)
    report = {"status": "PASS" if all(c["pass"] for c in checks) else "FAIL",
              "passed": sum(c["pass"] for c in checks), "total": len(checks),
              "dryRun": {k: v for k, v in dry.items() if k != "denied"} | {"denied": dry["denied"][:20]},
              "simulation": sim, "maxGetsPerRequest": db.max_gets, "maxEvalNodesPerRequest": db.max_ops,
              "checks": checks}
    out = os.path.join(ROOT, "_private", "attestatsiya-fizika", "rules-test-report.json")
    json.dump(report, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
    print("DRY-RUN:", json.dumps(dry["summary"]), dry["status"], f"({dry['allowed']}/{dry['operations']} ops)")
    for c in checks:
        print(("PASS " if c["pass"] else "FAIL ") + c["name"] + ("" if c["pass"] else f"  got={c['got']}"))
    print(f"{report['passed']}/{report['total']} — {report['status']}; max get()={db.max_gets}; "
          f"max eval nodes={db.max_ops}; sim={sim}")
    sys.exit(0 if report["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()
