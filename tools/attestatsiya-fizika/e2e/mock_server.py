#!/usr/bin/env python3
"""
E2E uchun lokal "Firebase" (Firestore + Storage + Auth emulyatsiyasi) — rasmiy emulyator EMAS.

• Statik sayt: repo ildizi (http://127.0.0.1:PORT/...)
• /__sdk/*.js — Firebase JS SDK o'rnini bosuvchi modullar (Playwright gstatic URL'larini shu yerga yo'naltiradi)
• /__mock/api — Firestore/Storage so'rovlari. HAR BIR so'rov repo firestore.rules / storage.rules orqali
  (tools/attestatsiya-fizika/rules/rules_eval.py) tekshiriladi: ruxsat yo'q bo'lsa — permission-denied.
• /__mock/clock — server vaqtini siljitish (ertasi kun 00:00 ni sinash uchun)

  python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8765
"""
import argparse
import base64
import copy
import datetime as dt
import json
import os
import sys
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(HERE, "..", "rules"))
import rules_eval as R  # noqa: E402

UTC = dt.timezone.utc
LOCK = threading.Lock()
STATE = {"docs": {}, "files": {}, "offset": dt.timedelta(0), "log": []}
FS = R.Engine(open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read())
ST = R.Engine(open(os.path.join(ROOT, "storage.rules"), encoding="utf-8").read())


def now():
    return dt.datetime.now(UTC) + STATE["offset"]


class Denied(Exception):
    code = "permission-denied"


class NotFound(Exception):
    code = "not-found"


# ------------------------------------------------------------------ wire <-> python
def dec(v, t):
    if isinstance(v, dict):
        if "__server" in v:
            return t
        if "__ts" in v:
            s, n = v["__ts"]
            return dt.datetime.fromtimestamp(s, UTC) + dt.timedelta(microseconds=n // 1000)
        if "__delete" in v:
            return R.SERVER_TIME  # sentinel (field delete) — kerak bo'lsa
        return {k: dec(x, t) for k, x in v.items()}
    if isinstance(v, list):
        return [dec(x, t) for x in v]
    return v


def enc(v):
    if isinstance(v, dt.datetime):
        ts = v.timestamp()
        s = int(ts // 1)
        return {"__ts": [s, v.microsecond * 1000]}
    if isinstance(v, dict):
        return {k: enc(x) for k, x in v.items()}
    if isinstance(v, list):
        return [enc(x) for x in v]
    return v


def auth_of(uid):
    if not uid:
        return None
    u = STATE["docs"].get(f"users/{uid}", {})
    return {"uid": uid, "token": {"email": u.get("email", f"{uid}@example.com"), "email_verified": True}}


def deep_merge(a, b):
    out = copy.deepcopy(a)
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict) and not k.startswith("__"):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def apply_update(doc, data):
    out = copy.deepcopy(doc)
    for k, v in data.items():
        parts = k.split(".")
        cur = out
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = v
    return out


# ------------------------------------------------------------------ firestore
def fs_get(uid, path):
    ok, _, _ = FS.allowed("get", path, auth_of(uid), STATE["docs"], STATE["docs"], now())
    if not ok:
        raise Denied(path)
    d = STATE["docs"].get(path)
    return {"exists": d is not None, "data": enc(d) if d is not None else None}


def match(doc, f):
    field, op, val = f
    if field == "__name__":
        v = doc["__id"]
    else:
        v = doc
        for p in field.split("."):
            v = v.get(p) if isinstance(v, dict) else None
    if op == "==":
        return v == val
    if op == "!=":
        return v != val
    if op == "in":
        return v in val
    if op == "array-contains":
        return isinstance(v, list) and val in v
    if v is None:
        return False
    return {"<": v < val, "<=": v <= val, ">": v > val, ">=": v >= val}[op]


def fs_query(uid, col, filters, order, limit):
    t = now()
    prefix = col + "/"
    res = []
    for p, d in STATE["docs"].items():
        if p.startswith(prefix) and "/" not in p[len(prefix):]:
            res.append((p, d))
    filters = [(f[0], f[1], dec(f[2], t)) for f in filters]
    res = [(p, d) for p, d in res if all(match({**d, "__id": p.rsplit("/", 1)[1]}, f) for f in filters)]
    for field, direction in reversed(order or []):
        res.sort(key=lambda x: (x[1].get(field) is None, x[1].get(field)), reverse=direction == "desc")
    if limit:
        res = res[:limit]
    a = auth_of(uid)
    for p, _ in res:
        ok, _, _ = FS.allowed("list", p, a, STATE["docs"], STATE["docs"], t)
        if not ok:
            raise Denied(f"list {col}")
    # Haqiqiy Firestore: so'rov "isbotlanmasa" natija bo'sh bo'lsa ham rad etiladi — taxminiy model:
    if not res:
        probe = {"published": True, "userId": uid, "testId": "x"}
        for f in filters:
            probe[f[0]] = f[2]
        tmp = dict(STATE["docs"])
        tmp[prefix + "__probe__"] = probe
        ok, _, _ = FS.allowed("list", prefix + "__probe__", a, tmp, tmp, t)
        if not ok:
            raise Denied(f"list {col} (filtr)")
    return [{"id": p.rsplit("/", 1)[1], "path": p, "data": enc(d)} for p, d in res]


def fs_commit(uid, writes):
    t = now()
    before = STATE["docs"]
    after = dict(before)
    plan = []
    for w in writes:
        p = w["path"]
        data = dec(w.get("data") or {}, t)
        exists = p in after
        if w["type"] == "delete":
            plan.append(("delete", p, None))
            after.pop(p, None)
            continue
        if w["type"] == "update":
            if not exists:
                raise NotFound(p)
            new = apply_update(after[p], data)
        elif w.get("merge") and exists:
            new = deep_merge(after[p], data)
        else:
            new = data
        plan.append(("update" if p in before else "create", p, new))
        after[p] = new
    a = auth_of(uid)
    for method, p, new in plan:
        ok, _, _ = FS.allowed(method, p, a, before, after, t, new_data=new)
        if not ok:
            STATE["log"].append({"denied": method, "path": p, "uid": uid})
            raise Denied(f"{method} {p}")
    STATE["docs"] = after
    return {"ok": True, "time": enc(t)}


# ------------------------------------------------------------------ storage
def st_allowed(uid, method, path, meta=None):
    ok, _, _ = ST.allowed_storage(method, path, auth_of(uid), STATE["docs"], now(), new_meta=meta)
    return ok


def st_get(uid, path):
    if not st_allowed(uid, "get", path):
        raise Denied(path)
    f = STATE["files"].get(path)
    if not f:
        raise NotFound(path)
    return {"contentType": f["contentType"], "data": base64.b64encode(f["data"]).decode()}


def st_meta(uid, path):
    if not st_allowed(uid, "get", path):
        raise Denied(path)
    f = STATE["files"].get(path)
    if not f:
        raise NotFound(path)
    return {"contentType": f["contentType"], "size": len(f["data"])}


def st_upload(uid, path, data_b64, content_type):
    data = base64.b64decode(data_b64)
    method = "update" if path in STATE["files"] else "create"
    if not st_allowed(uid, method, path, {"size": len(data), "contentType": content_type}):
        raise Denied(path)
    STATE["files"][path] = {"data": data, "contentType": content_type}
    return {"ok": True}


# ------------------------------------------------------------------ http
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def translate_path(self, path):
        if path.startswith("/__sdk/"):
            return os.path.join(HERE, "sdk", path.split("?")[0][len("/__sdk/"):])
        return super().translate_path(path)

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        req = json.loads(self.rfile.read(n) or b"{}")
        try:
            with LOCK:
                if self.path == "/__mock/api":
                    op, uid = req["op"], req.get("uid")
                    if op == "get":
                        out = fs_get(uid, req["path"])
                    elif op == "query":
                        out = fs_query(uid, req["col"], req.get("filters", []), req.get("order"), req.get("limit"))
                    elif op == "commit":
                        out = fs_commit(uid, req["writes"])
                    elif op == "st_get":
                        out = st_get(uid, req["path"])
                    elif op == "st_meta":
                        out = st_meta(uid, req["path"])
                    elif op == "st_upload":
                        out = st_upload(uid, req["path"], req["data"], req["contentType"])
                    elif op == "now":
                        out = {"time": enc(now())}
                    else:
                        raise ValueError(op)
                    return self._json(200, {"ok": True, "result": out})
                if self.path == "/__mock/clock":
                    target = dt.datetime.fromisoformat(req["iso"].replace("Z", "+00:00"))
                    STATE["offset"] = target - dt.datetime.now(UTC)
                    return self._json(200, {"ok": True, "now": now().isoformat()})
                if self.path == "/__mock/seed":
                    for p, d in req.get("docs", {}).items():
                        STATE["docs"][p] = dec(d, now())
                    return self._json(200, {"ok": True})
                if self.path == "/__mock/dump":
                    prefix = req.get("prefix", "")
                    return self._json(200, {"docs": {p: enc(d) for p, d in STATE["docs"].items() if p.startswith(prefix)},
                                            "files": len(STATE["files"]), "log": STATE["log"][-50:]})
                if self.path == "/__mock/reset":
                    STATE.update({"docs": {}, "files": {}, "offset": dt.timedelta(0), "log": []})
                    return self._json(200, {"ok": True})
        except (Denied, NotFound) as e:
            return self._json(200, {"ok": False, "code": e.code, "message": str(e)})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"ok": False, "code": "internal", "message": repr(e)})
        self._json(404, {"ok": False})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    print(f"mock firebase: http://127.0.0.1:{a.port}/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", a.port), H).serve_forever()
