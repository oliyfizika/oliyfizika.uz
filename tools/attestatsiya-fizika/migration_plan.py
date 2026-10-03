#!/usr/bin/env python3
"""
Attestatsiya → Fizika: production migratsiya rejasi (additive) + Rules dry-run. PRODUCTION'GA HECH NARSA YOZMAYDI.

  python3 tools/attestatsiya-fizika/migration_plan.py \
      [--baseline _private/attestatsiya-fizika/_staging/production-baseline] [--published att-fizika-day-01,...]

Baseline — production'ga import qilingan bundle (firestore-import.json + firestore-figures.json).
Yangi    — _private/attestatsiya-fizika/{firestore-import,firestore-figures}.json (prepare natijasi).

Qoidalar:
  • published/archived testlar (va ularning versions/keys/solutions/figures) TEGILMAYDI — v1 Rules bo'yicha qulflangan,
    topshirilgan urinishlar shu versiyaga bog'liq. Farqlari hisobotda ko'rsatiladi.
  • attestationPhysicsSettings TEGILMAYDI (production'dagi figureBackend va boshqa sozlamalar saqlanadi).
  • attestationPhysicsAttempts TEGILMAYDI. Hech narsa o'chirilmaydi.
  • Faqat o'zgargan hujjatlar: update (to'liq set) yoki yangi hujjat (create).
Natija: _private/attestatsiya-fizika/migration/{migration,rollback,report}.json
"""
import copy
import datetime as dt
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "rules"))
import rules_eval as R  # noqa: E402
import test_rules as TR  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PRIV = os.path.join(ROOT, "_private", "attestatsiya-fizika")
OUT = os.path.join(PRIV, "migration")
J = lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True, default=str)


def load(dirpath):
    b = json.load(open(os.path.join(dirpath, "firestore-import.json"), encoding="utf-8"))
    f = json.load(open(os.path.join(dirpath, "firestore-figures.json"), encoding="utf-8"))
    return b, f


def test_of(path):
    p = path.split("/")
    return p[1] if p[0] == "attestationPhysicsDailyTests" else None


PROTECTED_META = ("id", "dayNumber", "section", "questionIds", "questionCount", "publishedAt", "publishedBy",
                  "status", "published", "solutionAvailableAt", "currentVersion", "archivedAt")
SUB = ("versions", "keys", "solutions")


def plan(base, base_figs, new, new_figs, published):
    """→ mig, rollback, pub_report, unchanged, settings_skipped, removed.
    Draft/bank: update/create. Published: versions|keys|solutions/v{n+1} create + meta patch (currentVersion n+1).
    Rollback published: v{n+2} = baseline v{n} nusxasi (Rules versiyani kamaytirishga ruxsat bermaydi)."""
    bops = {o["path"]: o for o in base["ops"] + base_figs["ops"]}
    nops = [o for o in new["ops"] + new_figs["ops"]]
    nmap = {o["path"]: o for o in nops}
    mig, rollback, pub_report, unchanged, settings_skipped = [], [], {}, 0, []
    for o in nops:
        path = o["path"]
        if path.startswith("attestationPhysicsSettings/"):
            settings_skipped.append(path)
            continue
        t = test_of(path)
        if t in published:
            continue                       # quyida alohida (versiyalash)
        old = bops.get(path)
        if old is not None and J(old["data"]) == J(o["data"]):
            unchanged += 1
            continue
        if old is None:
            mig.append({"op": "create", "path": path, "data": o["data"]})
        else:
            if "/figures/" in path or "/solutionFigures/" in path:
                raise SystemExit(f"rasm hujjati o'zgargan ({path}) — Rules update'ni taqiqlaydi; yangi id kerak")
            mig.append({"op": "update", "path": path, "data": o["data"]})
            rollback.append({"op": "update", "path": path, "data": old["data"]})
    for tid in sorted(published):
        mp = f"attestationPhysicsDailyTests/{tid}"
        bm, nm = bops[mp]["data"], nmap[mp]["data"]
        n = bm["currentVersion"]
        if J(nm["questionIds"]) != J(bm["questionIds"]):
            raise SystemExit(f"{tid}: savollar ro'yxati o'zgargan — published testda Rules ruxsat bermaydi")
        changed = [s for s in SUB if J(bops[f"{mp}/{s}/v{n}"]["data"]) != J(nmap[f"{mp}/{s}/v1"]["data"])]
        # rasmlar: yangi versiyadagi havolalar uchun yangi rasm hujjatlari (create) — mavjudlari o'zgarmaydi
        for o in nops:
            if test_of(o["path"]) == tid and ("/figures/" in o["path"] or "/solutionFigures/" in o["path"]):
                if o["path"] not in bops:
                    mig.append({"op": "create", "path": o["path"], "data": o["data"]})
                elif J(bops[o["path"]]["data"]) != J(o["data"]):
                    raise SystemExit(f"rasm hujjati o'zgargan ({o['path']})")
        if not changed:
            pub_report[tid] = {"changed": False}
            continue
        for s in SUB:
            d = copy.deepcopy(nmap[f"{mp}/{s}/v1"]["data"])
            d["version"] = n + 1
            mig.append({"op": "create", "path": f"{mp}/{s}/v{n + 1}", "data": d})
            r = copy.deepcopy(bops[f"{mp}/{s}/v{n}"]["data"])
            r["version"] = n + 2
            rollback.append({"op": "create", "path": f"{mp}/{s}/v{n + 2}", "data": r})
        patch = {k: v for k, v in nm.items() if k not in PROTECTED_META and J(v) != J(bm.get(k))}
        mig.append({"op": "patch", "path": mp, "requires": {"currentVersion": n},
                    "data": {**patch, "currentVersion": n + 1}, "solutionAvailableAt": "nextMidnightTashkent"})
        rpatch = {k: bm.get(k) for k in patch}
        rollback.append({"op": "patch", "path": mp, "requires": {"currentVersion": n + 1},
                         "data": {**rpatch, "currentVersion": n + 2}})
        bv, nv = bops[f"{mp}/versions/v{n}"]["data"], nmap[f"{mp}/versions/v1"]["data"]
        pub_report[tid] = {"changed": True, "fromVersion": n, "toVersion": n + 1, "metaPatch": sorted(patch),
                           "changedQuestions": [a["id"] for a, b in zip(bv["questions"], nv["questions"]) if J(a) != J(b)],
                           "scorable": [bops[f"{mp}/keys/v{n}"]["data"]["scorableCount"], nmap[f"{mp}/keys/v1"]["data"]["scorableCount"]]}
    removed = [p for p in bops if p not in nmap]
    # tartib: versiya hujjatlari meta patch'dan OLDIN (attVersionReady), qolganlari ota → bola
    rank = lambda o: (1 if o["op"] == "patch" else 0, o["path"].count("/"), o["path"])
    mig.sort(key=rank)
    rollback.sort(key=rank)
    return mig, rollback, pub_report, unchanged, settings_skipped, removed


def apply_ops(db, auth, ops, now):
    """Admin sahifasidagi qo'llash mantig'ining Python nusxasi (idempotent): create — mavjud bo'lsa o'tkaziladi;
    update — to'liq set; patch — `requires` mos bo'lsa merge (aks holda o'tkaziladi)."""
    denied, skipped = [], []
    for o in ops:
        if o["op"] == "create":
            if o["path"] in db.docs:
                skipped.append(o["path"])
                continue
            ok = db.write(auth, o["path"], o["data"], now, merge=False, op="create")
        elif o["op"] == "update":
            ok = db.write(auth, o["path"], o["data"], now, merge=False, op="update")
        else:
            cur = db.docs.get(o["path"], {})
            if any(cur.get(k) != v for k, v in o.get("requires", {}).items()):
                skipped.append(o["path"])
                continue
            data = dict(o["data"])
            if o.get("solutionAvailableAt") == "nextMidnightTashkent":
                data["solutionAvailableAt"] = TR.next_midnight_tashkent(now)
            ok = db.write(auth, o["path"], data, now, merge=True, op="update")
        if not ok:
            denied.append(o["path"])
    return denied, skipped


def dry_run(base, base_figs, new, new_figs, mig, rollback, published):
    engine = R.Engine(open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read())
    db = TR.DB(engine)
    t0 = dt.datetime(2026, 10, 3, 4, 0, tzinfo=TR.UTC)
    ADMIN, U1, U2 = TR.auth_of("admin1"), TR.auth_of("user1"), TR.auth_of("user2")
    db.docs["users/admin1"] = {"fullName": "Admin", "email": "admin1@example.com", "role": "admin", "xp": 0, "level": 1,
                               "fullAccess": False}
    for u in ("user1", "user2"):
        db.docs[f"users/{u}"] = {"fullName": u, "email": f"{u}@example.com", "xp": 0, "level": 1, "fullAccess": False}
    # Production holati: baseline import + rasm hujjatlari (Rules orqali, admin)
    for o in sorted(base["ops"], key=lambda o: (0 if "Settings" in o["path"] else 1, o["path"].count("/"))):
        assert db.write(ADMIN, o["path"], o["data"], t0, merge=False, op=None if o["op"] == "set" else "create"), o["path"]
    for o in base_figs["ops"]:
        assert db.write(ADMIN, o["path"], o["data"], t0, merge=False, op="create"), o["path"]
    db.docs["attestationPhysicsSettings/config"]["figureBackend"] = "firestore"
    for tid in published:
        pub = {"status": "published", "published": True, "publishedAt": TR.SERVER, "publishedBy": "admin1",
               "solutionAvailableAt": TR.next_midnight_tashkent(t0)}
        assert db.write(ADMIN, f"attestationPhysicsDailyTests/{tid}", pub, t0), f"publish {tid}"
    d1 = sorted(published)[0]
    mp = f"attestationPhysicsDailyTests/{d1}"
    attempt_path = f"attestationPhysicsAttempts/user1__{d1}"
    db.docs[attempt_path] = {"userId": "user1", "testId": d1, "dayNumber": 1, "testVersion": 1, "status": "graded",
                             "answers": {"AF-1-001": "A"}, "scorePercent": 50, "startedAt": t0, "completedAt": t0}
    before = copy.deepcopy(db.docs)
    t1 = t0 + dt.timedelta(days=1, hours=2)            # v1 yechimi allaqachon ochilgan (production holati)
    denied, skipped = apply_ops(db, ADMIN, mig, t1)
    res = {"operations": len(mig), "allowed": len(mig) - len(denied) - len(skipped), "denied": denied[:20], "skipped": skipped}
    after = copy.deepcopy(db.docs)
    v1_paths = [p for p in before if test_of(p) == d1 and p != mp]
    res["published_v1_docs_untouched"] = all(J(before[p]) == J(after[p]) for p in v1_paths)
    res["published_meta_version_bumped"] = after[mp]["currentVersion"] == before[mp]["currentVersion"] + 1 \
        and after[mp]["status"] == "published" and after[mp]["publishedAt"] == before[mp]["publishedAt"]
    res["published_solution_reopened_next_midnight"] = after[mp]["solutionAvailableAt"] == TR.next_midnight_tashkent(t1)
    nmap = {o["path"]: o["data"] for o in new["ops"]}
    res["published_v2_equals_canonical"] = all(
        J({**after[f"{mp}/{s}/v2"], "version": 1}) == J(nmap[f"{mp}/{s}/v1"]) for s in SUB)
    res["attempts_untouched"] = J(before[attempt_path]) == J(after[attempt_path])
    res["settings_untouched"] = J(before["attestationPhysicsSettings/config"]) == J(after["attestationPhysicsSettings/config"])
    res["nothing_deleted"] = set(before) <= set(after)
    want = {o["path"]: o["data"] for o in new["ops"] + new_figs["ops"]
            if test_of(o["path"]) not in published and not o["path"].startswith("attestationPhysicsSettings/")}
    res["drafts_and_bank_equal_new_bundle"] = all(J(after[p]) == J(d) for p, d in want.items())
    # v1 ni joyida almashtirish — Rules rad etadi (versiyalash yagona yo'l)
    res["published_v1_locked_by_rules"] = not db.write(ADMIN, f"{mp}/versions/v1", nmap[f"{mp}/versions/v1"], t1,
                                                       merge=False, op="update", apply=False)
    # Eski urinish (user1, v1): o'z v1 kalitini o'qiydi, v2 kalitini emas; qayta topshira olmaydi
    res["old_attempt_reads_own_v1_key"] = db.read(U1, f"{mp}/keys/v1", t1) and not db.read(U1, f"{mp}/keys/v2", t1)
    start = {"userId": "user2", "testId": d1, "dayNumber": 1, "testVersion": 2, "attemptNumber": 1, "kind": "official",
             "status": "in_progress", "startedAt": TR.SERVER, "questionCount": after[mp]["questionCount"]}
    res["new_user_starts_on_v2"] = db.write(U2, f"attestationPhysicsAttempts/user2__{d1}", start, t1, op="create", apply=False)
    res["new_user_cannot_start_on_v1"] = not db.write(U2, f"attestationPhysicsAttempts/user2__{d1}", {**start, "testVersion": 1},
                                                      t1, op="create", apply=False)
    res["new_user_no_key_before_submit"] = not db.read(U2, f"{mp}/keys/v2", t1)
    res["solution_locked_until_midnight"] = not db.read(U2, f"{mp}/solutions/v2", t1)
    draft = next(p for p in want if p.endswith("/versions/v1"))
    res["user_cannot_read_draft"] = not db.read(U1, draft, t1)
    # Qayta ishga tushirish xavfsiz (idempotent)
    d2, s2 = apply_ops(db, ADMIN, mig, t1)
    res["reapply_idempotent"] = not d2 and J(db.docs) == J(after)
    # Rollback → draft/bank baseline; Day 1 → v3 (= v1 mazmuni)
    rb_denied, rb_skipped = apply_ops(db, ADMIN, rollback, t1)
    created = {o["path"] for o in mig if o["op"] == "create"} | {o["path"] for o in rollback if o["op"] == "create"}
    restored = all(J(db.docs[p]) == J(before[p]) for p in before if p != mp)
    v3_ok = all(J({**db.docs[f"{mp}/{s}/v3"], "version": 1}) == J(before[f"{mp}/{s}/v1"]) for s in SUB) \
        and db.docs[mp]["currentVersion"] == 3
    res["rollback"] = {"operations": len(rollback), "denied": rb_denied[:10], "restored_equals_baseline": restored,
                       "published_v3_equals_v1": v3_ok, "extra_docs_after_rollback": sorted(set(db.docs) - set(before)) == sorted(created)}
    return res


def main():
    base_dir = os.path.join(PRIV, "_staging", "production-baseline")
    if "--baseline" in sys.argv:
        base_dir = sys.argv[sys.argv.index("--baseline") + 1]
    published = {"att-fizika-day-01"}
    if "--published" in sys.argv:
        published = set(sys.argv[sys.argv.index("--published") + 1].split(","))
    base, base_figs = load(base_dir)
    new, new_figs = load(PRIV)
    mig, rollback, pub_report, unchanged, settings_skipped, removed = plan(base, base_figs, new, new_figs, published)
    by_kind = {}
    for o in mig:
        p = o["path"].split("/")
        kind = p[0] if len(p) == 2 else ("question.private" if p[0] == "attestationPhysicsQuestions" else f"test.{p[2]}")
        if len(p) == 2 and p[0] == "attestationPhysicsDailyTests":
            kind = "test.meta"
        by_kind.setdefault(f"{kind}:{o['op']}", 0)
        by_kind[f"{kind}:{o['op']}"] += 1
    dry = dry_run(base, base_figs, new, new_figs, mig, rollback, published)
    os.makedirs(OUT, exist_ok=True)
    meta = {"format": "oliyfizika-attestation-migration", "from": base["contentHash"], "to": new["contentHash"],
            "published": sorted(published), "operations": len(mig)}
    meta["hash"] = hashlib.sha256(J(mig).encode()).hexdigest()[:16]
    json.dump({**meta, "ops": mig}, open(os.path.join(OUT, "migration.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump({**meta, "format": "oliyfizika-attestation-rollback", "operations": len(rollback), "ops": rollback},
              open(os.path.join(OUT, "rollback.json"), "w", encoding="utf-8"), ensure_ascii=False)
    report = {**meta, "byKind": by_kind, "unchanged": unchanged, "published": pub_report,
              "settingsSkipped": settings_skipped, "removedInNew": removed, "dryRun": dry}
    json.dump(report, open(os.path.join(OUT, "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(report, ensure_ascii=False, indent=1, default=str))
    flags = [v for k, v in dry.items() if isinstance(v, bool)]
    ok = (not dry["denied"] and not dry["skipped"] and all(flags) and not dry["rollback"]["denied"]
          and dry["rollback"]["restored_equals_baseline"] and dry["rollback"]["published_v3_equals_v1"]
          and dry["rollback"]["extra_docs_after_rollback"] and not removed)
    print("MIGRATION DRY-RUN =", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
