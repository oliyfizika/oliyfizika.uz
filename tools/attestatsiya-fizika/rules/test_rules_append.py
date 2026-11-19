#!/usr/bin/env python3
"""
Attestatsiya -> Fizika: e’lon qilingan KURS KUNIGA yangi savollar qo‘shish (yangi versiya) — Rules testlari.
Kichik sun’iy ma’lumot bilan ishlaydi (_private bundle kerak emas), Firestore'ga hech narsa yubormaydi.

  python3 tools/attestatsiya-fizika/rules/test_rules_append.py
"""
import copy
import datetime as dt
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import rules_eval as R  # noqa: E402
from test_rules import DB, auth_of, SERVER  # noqa: E402

UTC = dt.timezone.utc
COL = "attestationPhysicsDailyTests"


def main():
    db = DB(R.Engine(open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read()))
    checks = []

    def expect(name, got, want=True):
        checks.append((name, got == want, got, want))

    t0 = dt.datetime(2026, 11, 19, 5, 0, tzinfo=UTC)
    sol_at = dt.datetime(2026, 11, 19, 19, 0, tzinfo=UTC)
    ADMIN, U1, U2 = auth_of("admin1"), auth_of("user1"), auth_of("user2")
    db.docs["users/admin1"] = {"fullName": "Admin", "email": "admin1@example.com", "role": "admin", "xp": 0, "level": 1, "fullAccess": False}
    for u in ("user1", "user2"):
        db.docs[f"users/{u}"] = {"fullName": u, "email": f"{u}@example.com", "xp": 0, "level": 1, "fullAccess": False}
    db.docs["attestationPhysicsSettings/config"] = {"accessMode": "open", "timezone": "Asia/Tashkent", "totalDays": 32}

    def make_test(tid, day, ids, kind=None):
        meta = {"id": tid, "dayNumber": day, "section": "mexanika", "questionIds": list(ids), "questionCount": len(ids),
                "timeLimitSeconds": None, "currentVersion": 1, "status": "published", "published": True,
                "publishedAt": t0, "publishedBy": "admin1", "solutionAvailableAt": sol_at, "archivedAt": None,
                "questionEval": ["a"] * len(ids), "questionTopicIdx": [0] * len(ids), "scorableCount": len(ids)}
        if kind:
            meta["kind"] = kind
        db.docs[f"{COL}/{tid}"] = meta
        db.docs[f"{COL}/{tid}/versions/v1"] = {"testId": tid, "version": 1, "dayNumber": day, "questionIds": list(ids),
                                               "questions": [{"id": q} for q in ids]}
        db.docs[f"{COL}/{tid}/keys/v1"] = {"testId": tid, "version": 1, "questionIds": list(ids),
                                           "answers": {q: "A" for q in ids}, "scorableCount": len(ids)}
        db.docs[f"{COL}/{tid}/solutions/v1"] = {"testId": tid, "version": 1, "questionIds": list(ids), "items": [{"id": q} for q in ids]}

    old = [f"Q{i}" for i in range(1, 6)]
    new = old + ["KZ1", "KZ2"]
    D = f"{COL}/att-fizika-day-05"
    make_test("att-fizika-day-05", 5, old)
    # user1 — v1 da urinishni boshlagan
    start = {"userId": "user1", "testId": "att-fizika-day-05", "dayNumber": 5, "testVersion": 1, "attemptNumber": 1,
             "kind": "official", "status": "in_progress", "startedAt": SERVER, "questionCount": 5}
    expect("v1 da urinish boshlash — ruxsat", db.write(U1, "attestationPhysicsAttempts/user1__att-fizika-day-05", start, t0, op="create"), True)

    patch = {"currentVersion": 2, "questionIds": new, "questionCount": 7, "questionEval": ["a"] * 7, "questionTopicIdx": [0] * 7,
             "scorableCount": 7}
    expect("v2 hujjatlarisiz savol qo‘shish — rad", db.write(ADMIN, D, patch, t0, apply=False), False)

    def make_v2(ids, tag=""):
        db.docs[f"{D}/versions/v2"] = {"testId": "att-fizika-day-05", "version": 2, "dayNumber": 5, "questionIds": list(ids),
                                       "questions": [{"id": q} for q in ids]}
        db.docs[f"{D}/keys/v2"] = {"testId": "att-fizika-day-05", "version": 2, "questionIds": list(ids),
                                   "answers": {q: "A" for q in ids}, "scorableCount": len(ids)}
        db.docs[f"{D}/solutions/v2"] = {"testId": "att-fizika-day-05", "version": 2, "questionIds": list(ids), "items": [{"id": q} for q in ids]}

    expect("user v2 versiya hujjatini yarata olmaydi",
           db.write(U1, f"{D}/versions/v2", {"testId": "att-fizika-day-05", "version": 2, "questionIds": new}, t0, op="create", apply=False), False)
    make_v2(old + ["KZ1"])
    expect("v2 hujjatidagi ro‘yxat meta bilan farq qilsa — rad", db.write(ADMIN, D, patch, t0, apply=False), False)
    make_v2(new)
    expect("user meta’ni o‘zgartira olmaydi", db.write(U1, D, patch, t0, apply=False), False)
    expect("eski savolni olib tashlash — rad",
           db.write(ADMIN, D, {**patch, "questionIds": old[1:] + ["KZ1", "KZ2", "KZ3"]}, t0, apply=False), False)
    expect("yechim vaqtini birga o‘zgartirish — rad",
           db.write(ADMIN, D, {**patch, "solutionAvailableAt": dt.datetime(2026, 11, 20, 19, 0, tzinfo=UTC)}, t0, apply=False), False)
    expect("versiyani +2 ga sakratish — rad", db.write(ADMIN, D, {**patch, "currentVersion": 3}, t0, apply=False), False)
    expect("questionCount ro‘yxatga mos bo‘lmasa — rad", db.write(ADMIN, D, {**patch, "questionCount": 6}, t0, apply=False), False)
    expect("savollarsiz versiya +1 (eski yo‘l) baribir ishlaydi", db.write(ADMIN, D, {"currentVersion": 2}, t0, apply=False), True)
    expect("savol qo‘shish (v2 tayyor, ro‘yxat mos) — ruxsat", db.write(ADMIN, D, patch, t0), True)
    expect("meta yangilandi", db.docs[D]["questionCount"] == 7 and db.docs[D]["currentVersion"] == 2)
    expect("eski urinish v1 da qoladi", db.docs["attestationPhysicsAttempts/user1__att-fizika-day-05"]["testVersion"] == 1)
    expect("user1 v1 kalitini (topshirgach) o‘qiy oladi, v2 ni emas — v1 urinish bog‘langan",
           db.read(U1, f"{D}/keys/v2", t0), False)
    start2 = {**start, "userId": "user2", "testVersion": 2, "questionCount": 7}
    expect("yangi urinish v2 va 7 savol bilan — ruxsat",
           db.write(U2, "attestationPhysicsAttempts/user2__att-fizika-day-05", start2, t0, op="create", apply=False), True)
    expect("yangi urinish eski savollar soni bilan — rad",
           db.write(U2, "attestationPhysicsAttempts/user2__att-fizika-day-05", {**start2, "questionCount": 5}, t0, op="create", apply=False), False)

    # mock testga bu yo‘l bilan savol qo‘shib bo‘lmaydi
    make_test("att-fizika-mock-05", 105, old, kind="mock")
    M = f"{COL}/att-fizika-mock-05"
    for col in ("versions", "keys", "solutions"):
        d = copy.deepcopy(db.docs[f"{D}/{col}/v2"]); d["testId"] = "att-fizika-mock-05"
        db.docs[f"{M}/{col}/v2"] = d
    expect("mock testga savol qo‘shish — rad", db.write(ADMIN, M, patch, t0, apply=False), False)

    # 50 savoldan oshmaydi
    make_test("att-fizika-day-09", 9, [f"P{i}" for i in range(1, 50)])
    D9 = f"{COL}/att-fizika-day-09"
    big = [f"P{i}" for i in range(1, 52)]
    for col in ("versions", "keys", "solutions"):
        db.docs[f"{D9}/{col}/v2"] = {"testId": "att-fizika-day-09", "version": 2, "questionIds": big,
                                     "answers": {q: "A" for q in big}, "scorableCount": len(big)}
    expect("50 dan ortiq savol — rad",
           db.write(ADMIN, D9, {"currentVersion": 2, "questionIds": big, "questionCount": 51}, t0, apply=False), False)

    bad = [c for c in checks if not c[1]]
    for name, ok, got, want in checks:
        print(("PASS " if ok else "FAIL ") + name + ("" if ok else f" (got {got}, want {want})"))
    print(f"{len(checks) - len(bad)}/{len(checks)} PASS")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
