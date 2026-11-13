#!/usr/bin/env python3
"""
Admin System 2.0 (bo'limli adminlar) — Firestore Rules testlari (lokal, Firestore'ga hech narsa yuborilmaydi).

  python3 tools/admin/test_admin_rules.py

Repo firestore.rules ni tools/attestatsiya-fizika/rules/rules_eval.py (xotiradagi Rules modeli) orqali tekshiradi:
owner / eski (to'liq) admin / bo'limli admin / oddiy foydalanuvchi uchun ruxsatlar.
"""
import datetime as dt
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "attestatsiya-fizika", "rules"))
import rules_eval as R  # noqa: E402
from test_rules import DB, auth_of  # noqa: E402

SERVER = R.SERVER_TIME
UTC = dt.timezone.utc
T = dt.datetime(2026, 11, 8, 6, 0, tzinfo=UTC)


def user(name, **extra):
    return {"fullName": name, "email": f"{name}@example.com", "xp": 0, "level": 1, "fullAccess": False, **extra}


def main():
    engine = R.Engine(open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read())
    db = DB(engine)
    checks = []

    def expect(name, got, want=True):
        checks.append((name, got == want, got, want))

    db.docs.update({
        "users/owner": user("owner", role="admin", adminRole="owner"),
        "users/legacy": user("legacy", role="admin"),                                   # eski admin — adminSections yo'q
        "users/att": user("att", role="admin", adminSections=["attestatsiya-fizika"]),
        "users/ms": user("ms", role="admin", adminSections=["milliy-sertifikat", "kirish-huquqlari"]),
        "users/none": user("none", role="admin", adminSections=[]),
        "users/u1": user("u1"),
        "users/u2": user("u2"),
        "results/r1": {"uid": "u1", "lessonId": 1, "percent": 80},
        "mockTestAttempts/u1__abcdefgh": {"uid": "u1", "testId": "mock-test-1"},
        "attestationPhysicsSettings/config": {"accessMode": "open", "timezone": "Asia/Tashkent", "totalDays": 32},
    })
    OWNER, LEGACY, ATT, MS, NONE, U1 = (auth_of(x) for x in ("owner", "legacy", "att", "ms", "none", "u1"))
    CFG = "attestationPhysicsSettings/config"
    cfg_paid = {"accessMode": "paid"}

    # ------------------------------------------------------------ owner: admin tayinlash
    appoint = {"role": "admin", "adminSections": ["umumiy-fizika", "olimpiada"], "adminUpdatedAt": SERVER, "adminUpdatedBy": "owner"}
    expect("owner: u2 ni bo'limli admin qiladi", db.write(OWNER, "users/u2", appoint, T, apply=False), True)
    expect("owner: noma'lum bo'lim — rad", db.write(OWNER, "users/u2", {**appoint, "adminSections": ["pedagogika"]}, T, apply=False), False)
    expect("owner: adminSections ro'yxat bo'lmasa — rad", db.write(OWNER, "users/u2", {**appoint, "adminSections": "umumiy-fizika"}, T, apply=False), False)
    expect("owner: adminUpdatedBy boshqa uid — rad", db.write(OWNER, "users/u2", {**appoint, "adminUpdatedBy": "x"}, T, apply=False), False)
    expect("owner: adminRole=owner yozib bo'lmaydi", db.write(OWNER, "users/u2", {**appoint, "adminRole": "owner"}, T, apply=False), False)
    expect("owner: role bilan birga xp — rad", db.write(OWNER, "users/u2", {**appoint, "xp": 5}, T, apply=False), False)
    expect("owner: o'zini o'zgartira olmaydi", db.write(OWNER, "users/owner", {**appoint}, T, apply=False), False)
    expect("owner: bo'sh bo'lim ro'yxati — ruxsat", db.write(OWNER, "users/u2", {**appoint, "adminSections": []}, T, apply=False), True)
    expect("owner: eski adminga bo'limlar biriktiradi",
           db.write(OWNER, "users/legacy", {"adminSections": ["umumiy-fizika"], "adminUpdatedAt": SERVER, "adminUpdatedBy": "owner"}, T, apply=False), True)
    # adminlikdan olish: role=user va adminSections o'chiriladi
    demote = {k: v for k, v in db.docs["users/att"].items() if k != "adminSections"}
    demote.update({"role": "user", "adminUpdatedAt": SERVER, "adminUpdatedBy": "owner"})
    expect("owner: adminlikdan oladi (adminSections o'chiriladi)", db.write(OWNER, "users/att", demote, T, merge=False, op="update", apply=False), True)
    expect("owner: role=user, lekin adminSections qolsa — rad",
           db.write(OWNER, "users/att", {"role": "user", "adminUpdatedAt": SERVER, "adminUpdatedBy": "owner"}, T, apply=False), False)
    expect("owner: role=owner qiymati — rad", db.write(OWNER, "users/u2", {**appoint, "role": "owner"}, T, apply=False), False)

    # ------------------------------------------------------------ boshqa adminlar admin tayinlay olmaydi
    expect("eski admin: admin tayinlay olmaydi", db.write(LEGACY, "users/u2", appoint | {"adminUpdatedBy": "legacy"}, T, apply=False), False)
    expect("eski admin: role ni o'zgartira olmaydi", db.write(LEGACY, "users/u2", {"role": "admin"}, T, apply=False), False)
    expect("bo'limli admin: o'ziga bo'lim qo'sha olmaydi",
           db.write(MS, "users/ms", {"adminSections": ["milliy-sertifikat", "kirish-huquqlari", "attestatsiya-fizika"]}, T, apply=False), False)
    expect("foydalanuvchi: o'zini admin qila olmaydi", db.write(U1, "users/u1", {"role": "admin"}, T, apply=False), False)
    expect("foydalanuvchi: adminRole yoza olmaydi", db.write(U1, "users/u1", {"adminRole": "owner"}, T, apply=False), False)
    expect("eski admin: owner'ni adminlikdan ololmaydi", db.write(LEGACY, "users/owner", {"role": "user"}, T, apply=False), False)

    # ------------------------------------------------------------ kirish huquqlari (pullik bayroqlar)
    expect("owner: attestationAccess beradi", db.write(OWNER, "users/u1", {"attestationAccess": True}, T, apply=False), True)
    expect("eski admin: mockTestsAccess beradi (avvalgidek)", db.write(LEGACY, "users/u1", {"mockTestsAccess": True}, T, apply=False), True)
    expect("'kirish-huquqlari' admini: fullAccess beradi", db.write(MS, "users/u1", {"fullAccess": True}, T, apply=False), True)
    expect("'kirish-huquqlari' admini: bool bo'lmasa — rad", db.write(MS, "users/u1", {"fullAccess": "ha"}, T, apply=False), False)
    expect("attestatsiya admini: kirish huquqini bera olmaydi", db.write(ATT, "users/u1", {"attestationAccess": True}, T, apply=False), False)
    expect("bo'limsiz admin: kirish huquqini bera olmaydi", db.write(NONE, "users/u1", {"mockTestsAccess": True}, T, apply=False), False)

    # ------------------------------------------------------------ bo'limlar: o'qish / yozish
    expect("umumiy: eski admin natijalarni o'qiydi", db.read(LEGACY, "results/r1", T), True)
    expect("umumiy: attestatsiya admini natijalarni o'qiy olmaydi", db.read(ATT, "results/r1", T), False)
    expect("umumiy: foydalanuvchi o'z natijasini o'qiydi", db.read(U1, "results/r1", T), True)
    expect("umumiy: milliy admini natijani o'chira olmaydi", db.delete(MS, "results/r1", T), False)
    expect("milliy: ms admini mock urinishlar ro'yxatini ko'radi", db.query(MS, "mockTestAttempts", T)[0], True)
    expect("milliy: attestatsiya admini mock urinishlarni ko'ra olmaydi", db.query(ATT, "mockTestAttempts", T)[0], False)
    expect("milliy: owner mock urinishlarni ko'radi", db.query(OWNER, "mockTestAttempts", T)[0], True)
    expect("attestatsiya: att admini sozlamani o'zgartiradi", db.write(ATT, CFG, cfg_paid, T, apply=False), True)
    expect("attestatsiya: eski admin sozlamani o'zgartiradi", db.write(LEGACY, CFG, cfg_paid, T, apply=False), True)
    expect("attestatsiya: milliy admini sozlamani o'zgartira olmaydi", db.write(MS, CFG, cfg_paid, T, apply=False), False)
    expect("attestatsiya: bo'limsiz admin — rad", db.write(NONE, CFG, cfg_paid, T, apply=False), False)
    expect("users: har qanday admin profillar ro'yxatini o'qiydi (ism ko'rsatish uchun)", db.query(NONE, "users", T)[0], True)
    expect("users: foydalanuvchi ro'yxatni o'qiy olmaydi", db.query(U1, "users", T)[0], False)
    expect("users: eski admin profilni o'chira olmaydi (faqat owner)", db.delete(LEGACY, "users/u2", T), False)
    expect("users: owner profilni o'chira oladi", db.delete(OWNER, "users/u2", T), True)

    # ------------------------------------------------------------ amallar jurnali
    log = {"actorUid": "att", "actorEmail": "att@example.com", "action": "attestatsiya.publish", "section": "attestatsiya-fizika",
           "summary": "Day 4 e'lon qilindi", "targetLabel": "Day 4", "details": {"testId": "day-04"}, "at": SERVER}
    expect("jurnal: admin o'z nomidan yozadi", db.write(ATT, "adminAuditLog/a1", log, T), True)
    expect("jurnal: boshqa admin nomidan — rad", db.write(MS, "adminAuditLog/a2", log, T, apply=False), False)
    expect("jurnal: klient vaqti — rad", db.write(ATT, "adminAuditLog/a3", {**log, "at": T - dt.timedelta(hours=1)}, T, apply=False), False)
    expect("jurnal: noma'lum bo'lim — rad", db.write(ATT, "adminAuditLog/a4", {**log, "section": "pedagogika"}, T, apply=False), False)
    expect("jurnal: oddiy foydalanuvchi yoza olmaydi", db.write(U1, "adminAuditLog/a5", {**log, "actorUid": "u1", "actorEmail": "u1@example.com"}, T, apply=False), False)
    expect("jurnal: owner o'qiydi", db.query(OWNER, "adminAuditLog", T)[0], True)
    expect("jurnal: eski admin o'qiy olmaydi", db.query(LEGACY, "adminAuditLog", T)[0], False)
    expect("jurnal: o'zgartirib bo'lmaydi", db.write(OWNER, "adminAuditLog/a1", {"summary": "x"}, T, apply=False), False)
    expect("jurnal: o'chirib bo'lmaydi", db.delete(OWNER, "adminAuditLog/a1", T), False)

    # ------------------------------------------------------------ presence («Hozir online» — mehmonlar)
    GID = "presence/g_" + "a1b2c3d4" * 4
    pres = {"at": SERVER, "expireAt": T + dt.timedelta(hours=1)}
    expect("presence: mehmon o'z belgisini yozadi", db.write(None, GID, pres, T, merge=False), True)
    expect("presence: mehmon belgisini yangilaydi", db.write(None, GID, pres, T + dt.timedelta(minutes=5), merge=False, apply=False), True)
    expect("presence: kirgan foydalanuvchi ham yoza oladi (zarar yo'q)", db.write(U1, "presence/g_" + "b" * 32, pres, T, merge=False, apply=False), True)
    expect("presence: klient vaqti — rad", db.write(None, GID, {**pres, "at": T - dt.timedelta(minutes=1)}, T, merge=False, apply=False), False)
    expect("presence: ortiqcha maydon — rad", db.write(None, GID, {**pres, "email": "x@y.z"}, T, merge=False, apply=False), False)
    expect("presence: uzoq expireAt — rad", db.write(None, GID, {**pres, "expireAt": T + dt.timedelta(days=1)}, T, merge=False, apply=False), False)
    expect("presence: noto'g'ri ID — rad", db.write(None, "presence/users", pres, T, merge=False, apply=False), False)
    expect("presence: bo'limsiz admin ham sanay oladi", db.query(NONE, "presence", T)[0], True)
    expect("presence: foydalanuvchi ro'yxatni o'qiy olmaydi", db.query(U1, "presence", T)[0], False)
    expect("presence: mehmon ro'yxatni o'qiy olmaydi", db.query(None, "presence", T)[0], False)
    expect("presence: hujjatni o'qib bo'lmaydi", db.read(None, GID, T), False)
    expect("presence: o'chirib bo'lmaydi", db.delete(OWNER, GID, T), False)

    fails = [c for c in checks if not c[1]]
    for name, ok, got, want in checks:
        print(("OK   " if ok else "XATO ") + name + ("" if ok else f"  (natija {got}, kutilgan {want})"))
    print(f"\n{len(checks) - len(fails)}/{len(checks)} o'tdi")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
