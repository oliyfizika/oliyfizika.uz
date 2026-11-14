#!/usr/bin/env python3
"""
Milliy sertifikat: yopiq (sessiyali) mock testlar — Firestore Rules testlari (lokal, Firestore'ga hech narsa yuborilmaydi).

  python3 tools/milliy-sertifikat/tests/test_ms_session_rules.py

msMockSettings / msMockSessions / msMockAttempts / msMockCertificates / msMockProfiles qoidalari.
"""
import datetime as dt
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "attestatsiya-fizika", "rules"))
import rules_eval as R  # noqa: E402
from test_rules import DB, auth_of  # noqa: E402

SERVER = R.SERVER_TIME
UTC = dt.timezone.utc
OPEN = dt.datetime(2026, 11, 20, 4, 0, tzinfo=UTC)      # 09:00 Toshkent
CLOSE = OPEN + dt.timedelta(hours=12)


def user(name, **extra):
    return {"fullName": name, "email": f"{name}@example.com", "xp": 0, "level": 1, "fullAccess": False, **extra}


def main():
    engine = R.Engine(open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read())
    db = DB(engine)
    checks = []

    def expect(name, got, want=True):
        checks.append((name, got == want, got, want))

    session = {"testId": "mock-test-3", "testNumber": 3, "testTitle": "Fizika Mock Test №3", "opensAt": OPEN, "closesAt": CLOSE,
               "durationMinutes": 180, "status": "scheduled", "createdAt": OPEN - dt.timedelta(days=1), "createdBy": "ms"}
    db.docs.update({
        "users/owner": user("owner", role="admin", adminRole="owner"),
        "users/ms": user("ms", role="admin", adminSections=["milliy-sertifikat"]),
        "users/att": user("att", role="admin", adminSections=["attestatsiya-fizika"]),
        "users/u1": user("u1"),
        "users/u2": user("u2"),
    })
    OWNER, MS, ATT, U1, U2 = (auth_of(x) for x in ("owner", "ms", "att", "u1", "u2"))
    S = "msMockSessions/sess1"
    before = OPEN - dt.timedelta(hours=1)

    # ------------------------------------------------------------ sessiyalar
    expect("sessiya: 'milliy-sertifikat' admini yaratadi", db.write(MS, S, session, before), True)
    expect("sessiya: boshqa bo'lim admini — rad", db.write(ATT, "msMockSessions/s2", session, before, apply=False), False)
    expect("sessiya: foydalanuvchi — rad", db.write(U1, "msMockSessions/s2", session, before, apply=False), False)
    expect("sessiya: closesAt <= opensAt — rad", db.write(MS, "msMockSessions/s2", {**session, "closesAt": OPEN}, before, apply=False), False)
    expect("sessiya: noto'g'ri testId — rad", db.write(MS, "msMockSessions/s2", {**session, "testId": "../x"}, before, apply=False), False)
    expect("sessiya: ortiqcha maydon — rad", db.write(MS, "msMockSessions/s2", {**session, "x": 1}, before, apply=False), False)
    expect("sessiya: mehmon o'qiydi (katalog)", db.read(None, S, before), True)
    expect("sessiya: mehmon ro'yxatni o'qiydi", db.query(None, "msMockSessions", before)[0], True)
    expect("sozlama: admin practiceTests yozadi",
           db.write(MS, "msMockSettings/config", {"practiceTests": ["mock-test-1"], "updatedAt": SERVER, "updatedBy": "ms"}, before), True)
    expect("sozlama: foydalanuvchi yoza olmaydi", db.write(U1, "msMockSettings/config", {"practiceTests": []}, before, apply=False), False)
    expect("sozlama: hamma o'qiydi", db.read(None, "msMockSettings/config", before), True)

    # ------------------------------------------------------------ urinish: START
    A1 = "msMockAttempts/sess1__u1"
    start = {"uid": "u1", "name": "u1", "sessionId": "sess1", "testId": "mock-test-3", "status": "in_progress",
             "startedAt": SERVER, "updatedAt": SERVER, "answers": {}}
    t_in = OPEN + dt.timedelta(hours=1)
    expect("start: oyna ochilmasdan — rad", db.write(U1, A1, start, before, apply=False), False)
    expect("start: oyna yopilgandan keyin — rad", db.write(U1, A1, start, CLOSE + dt.timedelta(seconds=1), apply=False), False)
    expect("start: boshqa uid nomidan — rad", db.write(U2, A1, start, t_in, apply=False), False)
    expect("start: ID boshqa sessiya — rad", db.write(U1, "msMockAttempts/s9__u1", {**start, "sessionId": "s9"}, t_in, apply=False), False)
    expect("start: testId mos emas — rad", db.write(U1, A1, {**start, "testId": "mock-test-4"}, t_in, apply=False), False)
    expect("start: klient startedAt — rad", db.write(U1, A1, {**start, "startedAt": t_in - dt.timedelta(hours=2)}, t_in, apply=False), False)
    expect("start: darhol submitted — rad", db.write(U1, A1, {**start, "status": "submitted"}, t_in, apply=False), False)
    expect("start: natija bilan — rad", db.write(U1, A1, {**start, "result": {"score": 75}}, t_in, apply=False), False)
    expect("start: oyna ichida — ruxsat", db.write(U1, A1, start, t_in), True)
    expect("start: ikkinchi marta (create) — rad", db.write(U1, A1, start, t_in, op="create", apply=False), False)

    # ------------------------------------------------------------ urinish: javoblar va topshirish
    draft = {"answers": {"0": "A", "35": {"a": "8", "b": "50"}}, "updatedAt": SERVER}
    t_mid = t_in + dt.timedelta(minutes=90)
    expect("draft: vaqt ichida — ruxsat", db.write(U1, A1, draft, t_mid), True)
    expect("draft: boshqa foydalanuvchi — rad", db.write(U2, A1, draft, t_mid, apply=False), False)
    expect("draft: startedAt ni o'zgartirish — rad", db.write(U1, A1, {**draft, "startedAt": t_mid}, t_mid, apply=False), False)
    expect("draft: result yozish — rad", db.write(U1, A1, {**draft, "result": {"score": 75}}, t_mid, apply=False), False)
    expect("draft: status=published — rad", db.write(U1, A1, {**draft, "status": "published"}, t_mid, apply=False), False)
    late = t_in + dt.timedelta(minutes=186)
    expect("draft: limit + 5 daqiqadan keyin — rad", db.write(U1, A1, draft, late, apply=False), False)
    expect("submit: limit + 5 daqiqadan keyin — rad",
           db.write(U1, A1, {**draft, "status": "submitted", "submittedAt": SERVER}, late, apply=False), False)
    expect("submit: limit ichida (grace) — ruxsat",
           db.write(U1, A1, {**draft, "status": "submitted", "submittedAt": SERVER, "autoSubmitted": True}, t_in + dt.timedelta(minutes=183), apply=False), True)
    expect("submit: klient submittedAt — rad",
           db.write(U1, A1, {**draft, "status": "submitted", "submittedAt": t_in}, t_mid, apply=False), False)
    expect("submit: ruxsat", db.write(U1, A1, {**draft, "status": "submitted", "submittedAt": SERVER}, t_mid), True)
    expect("submit dan keyin javob o'zgartirish — rad", db.write(U1, A1, {"answers": {"0": "B"}, "updatedAt": SERVER}, t_mid, apply=False), False)
    expect("submit dan keyin qaytadan in_progress — rad",
           db.write(U1, A1, {"status": "in_progress", "updatedAt": SERVER}, t_mid, apply=False), False)
    expect("egasi o'z urinishini o'qiydi", db.read(U1, A1, t_mid), True)
    expect("boshqa foydalanuvchi o'qiy olmaydi", db.read(U2, A1, t_mid), False)
    expect("egasi o'z uid filtri bilan ro'yxat", db.query(U1, "msMockAttempts", t_mid, where=("uid", "u1"))[0], True)
    expect("admin ro'yxat", db.query(MS, "msMockAttempts", t_mid, where=("sessionId", "sess1"))[0], True)
    expect("boshqa bo'lim admini ro'yxat — rad", db.query(ATT, "msMockAttempts", t_mid, where=("sessionId", "sess1"))[0], False)
    expect("urinishni o'chirib bo'lmaydi (admin ham)", db.delete(MS, A1, t_mid), False)

    # u2 boshlab, topshirmay qoldi (in_progress)
    A2 = "msMockAttempts/sess1__u2"
    expect("u2 start", db.write(U2, A2, {**start, "uid": "u2", "name": "u2"}, t_in), True)
    expect("filtrsiz ro'yxat — foydalanuvchiga rad", db.query(U1, "msMockAttempts", t_mid)[0], False)

    # ------------------------------------------------------------ admin: natijani e'lon qilish
    pub = {"status": "published", "result": {"score": 70.07, "level": "A+", "percent": 100, "raw": 50, "maxRaw": 55}, "publishedAt": SERVER}
    t_fin = CLOSE + dt.timedelta(hours=4)
    expect("publish: foydalanuvchi o'zi — rad", db.write(U1, A1, pub, t_fin, apply=False), False)
    expect("publish: boshqa bo'lim admini — rad", db.write(ATT, A1, pub, t_fin, apply=False), False)
    expect("publish: admin javoblarni o'zgartira olmaydi", db.write(MS, A1, {**pub, "answers": {"0": "C"}}, t_fin, apply=False), False)
    expect("publish: admin — ruxsat", db.write(MS, A1, pub, t_fin), True)
    expect("publish: topshirilmagan (in_progress) urinish — ruxsat", db.write(MS, A2, pub, t_fin), True)
    expect("sessiya finalized", db.write(MS, S, {"status": "finalized", "finalizedAt": SERVER, "finalizedBy": "ms",
                                                 "stats": {"participants": 2}}, t_fin), True)
    expect("finalized dan keyin: egasi yangi sessiyaga start — rad",
           db.write(U1, "msMockAttempts/sess1__u9", {**start, "uid": "u1"}, t_fin, apply=False), False)

    # ------------------------------------------------------------ sertifikatlar
    cert = {"certNo": "OF26-123456", "uid": "u1", "sessionId": "sess1", "testId": "mock-test-3", "testNumber": 3, "testTitle": "M3",
            "lastName": "Amirov", "firstName": "Sarvar", "fullName": "Amirov Sarvar", "score": 70.07, "level": "A+", "percent": 100,
            "sections": [{"id": "mexanika", "score": 22.8}], "issuedAt": SERVER}
    C = "msMockCertificates/OF26-123456"
    expect("sertifikat: foydalanuvchi yarata olmaydi", db.write(U1, C, cert, t_fin, apply=False), False)
    expect("sertifikat: noto'g'ri raqam — rad", db.write(MS, "msMockCertificates/X1", {**cert, "certNo": "X1"}, t_fin, apply=False), False)
    expect("sertifikat: admin yaratadi", db.write(MS, C, cert, t_fin), True)
    expect("sertifikat: mehmon tekshiradi (get)", db.read(None, C, t_fin), True)
    expect("sertifikat: mehmon ro'yxat — rad", db.query(None, "msMockCertificates", t_fin)[0], False)

    # ------------------------------------------------------------ rasm (sertifikat uchun)
    P = "msMockProfiles/u1"
    photo = "data:image/jpeg;base64," + "A" * 1000
    expect("rasm: egasi yuklaydi", db.write(U1, P, {"photo": photo, "patronymic": "Erkin o‘g‘li", "updatedAt": SERVER}, t_fin), True)
    expect("rasm: PNG/SVG data URL — rad", db.write(U1, P, {"photo": "data:image/svg+xml;base64,AAAA", "updatedAt": SERVER}, t_fin, apply=False), False)
    expect("rasm: juda katta — rad", db.write(U1, P, {"photo": "data:image/jpeg;base64," + "A" * 360000, "updatedAt": SERVER}, t_fin, apply=False), False)
    expect("rasm: boshqa foydalanuvchiga — rad", db.write(U2, P, {"photo": photo, "updatedAt": SERVER}, t_fin, apply=False), False)
    expect("rasm: begona maydon — rad", db.write(U1, P, {"photo": photo, "updatedAt": SERVER, "score": 75}, t_fin, apply=False), False)
    expect("rasm: egasi o'qiydi", db.read(U1, P, t_fin), True)
    expect("rasm: admin o'qiydi", db.read(MS, P, t_fin), True)
    expect("rasm: boshqa foydalanuvchi o'qiy olmaydi", db.read(U2, P, t_fin), False)

    # ------------------------------------------------------------ eski mockTestAttempts o'zgarmagan
    old = "mockTestAttempts/u1__abcdefgh"
    db.docs[old] = {"uid": "u1", "testId": "mock-test-1"}
    expect("eski mashq natijasi: egasi o'qiydi (saqlanadi)", db.read(U1, old, t_fin), True)
    expect("eski mashq natijasi: update yo'q", db.write(U1, old, {"correct": 1}, t_fin, apply=False), False)

    # ------------------------------------------------------------ import qilingan mock (msMockTests)
    TM = "msMockTests/mock-test-16"
    meta = {"number": 16, "title": "Fizika Mock Test №16", "durationMinutes": 180, "questionCount": 45, "mcqCount": 35, "itemCount": 55,
            "figureCount": 1, "source": "import", "reviewOpen": False}
    q16 = {"schemaVersion": 1, "questions": [{"n": 1, "type": "mcq", "text": "?", "options": ["1", "2"]}]}
    key16 = {"answers": {"0": "A"}}
    fig = {"data": "data:image/png;base64,AAAA"}
    tq = dt.datetime(2026, 12, 1, 4, 0, tzinfo=UTC)
    expect("import: foydalanuvchi meta yoza olmaydi", db.write(U1, TM, meta, tq, apply=False), False)
    expect("import: boshqa bo'lim admini — rad", db.write(ATT, TM, meta, tq, apply=False), False)
    expect("import: admin meta yozadi", db.write(MS, TM, meta, tq), True)
    expect("import: noto'g'ri test ID — rad", db.write(MS, "msMockTests/x16", meta, tq, apply=False), False)
    expect("import: admin savollar", db.write(MS, TM + "/content/questions", q16, tq), True)
    expect("import: admin kalit", db.write(MS, TM + "/content/key", key16, tq), True)
    expect("import: admin rasm", db.write(MS, TM + "/figures/q01", fig, tq), True)
    expect("import: rasm emas (data:text) — rad", db.write(MS, TM + "/figures/q02", {"data": "data:text/html;base64,AAAA"}, tq, apply=False), False)
    expect("import: begona content hujjati — rad", db.write(MS, TM + "/content/x", key16, tq, apply=False), False)
    expect("meta: mehmon o'qiydi (katalog)", db.read(None, TM, tq), True)
    expect("yopiq: foydalanuvchi savollarni o'qiy olmaydi", db.read(U1, TM + "/content/questions", tq), False)
    expect("yopiq: foydalanuvchi rasmni o'qiy olmaydi", db.read(U1, TM + "/figures/q01", tq), False)
    expect("yopiq: foydalanuvchi kalitni o'qiy olmaydi", db.read(U1, TM + "/content/key", tq), False)
    expect("admin savol va kalitni o'qiydi", db.read(MS, TM + "/content/questions", tq) and db.read(MS, TM + "/content/key", tq), True)
    db.write(MS, TM, {"openFrom": tq, "openUntil": tq + dt.timedelta(hours=16)}, tq)
    t_open = tq + dt.timedelta(hours=2)
    expect("oyna ichida: savollar ochiq", db.read(U1, TM + "/content/questions", t_open), True)
    expect("oyna ichida: rasm ochiq", db.read(U1, TM + "/figures/q01", t_open), True)
    expect("oyna ichida: kalit YOPIQ", db.read(U1, TM + "/content/key", t_open), False)
    expect("oyna ichida: mehmon savollarni o'qiy olmaydi", db.read(None, TM + "/content/questions", t_open), False)
    expect("oynadan keyin: savollar yopiq", db.read(U1, TM + "/content/questions", tq + dt.timedelta(hours=17)), False)
    expect("oynadan oldin: savollar yopiq", db.read(U1, TM + "/content/questions", tq - dt.timedelta(minutes=1)), False)
    db.write(MS, TM, {"reviewOpen": True}, tq + dt.timedelta(hours=20))
    t_rev = tq + dt.timedelta(hours=21)
    expect("natija e'lon qilingach: savol va kalit ochiq", db.read(U1, TM + "/content/questions", t_rev) and db.read(U1, TM + "/content/key", t_rev), True)
    expect("content ro'yxatini o'qib bo'lmaydi", db.query(U1, TM + "/content", t_rev)[0], False)

    fails = [c for c in checks if not c[1]]
    for name, ok, got, want in checks:
        print(("OK   " if ok else "XATO ") + name + ("" if ok else f"  (natija {got}, kutilgan {want})"))
    print(f"\n{len(checks) - len(fails)}/{len(checks)} o'tdi")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
