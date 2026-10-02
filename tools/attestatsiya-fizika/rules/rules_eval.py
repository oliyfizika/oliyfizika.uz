"""
Firestore Security Rules uchun LOKAL mini-interpretator (rasmiy emulyator EMAS).

Nega: bu muhitda Firebase Emulator (Java jar Google Storage'dan yuklanadi) mavjud emas.
Loyiha firestore.rules faylida ishlatiladigan til qismini qo'llaydi:
  match/allow/function/let/return, path literal $(...), && || ! ?: in is, + - * / %,
  map: keys() get() diff().affectedKeys() size(); list/set: size() hasOnly hasAll hasAny removeAll [i];
  string: size() matches(); string() int(); timestamp ± duration; duration.value(n,'s'); duration.seconds();
  get/exists/getAfter/existsAfter; request.auth/time/resource; resource.data.
Xato semantikasi (CEL): xato -> deny; `err || true` = true, `err && false` = false.
Natija Rules Playground'dagi asosiy holatlarda ham tekshirilishi kerak (08_security_report.md).
"""
import datetime as _dt
import re

UTC = _dt.timezone.utc


class RulesError(Exception):
    pass


class Path(str):
    pass


class Duration:
    def __init__(self, seconds):
        self.s = seconds

    def __eq__(self, o):
        return isinstance(o, Duration) and o.s == self.s


SERVER_TIME = object()   # klient serverTimestamp() — request.time ga aylanadi


# ------------------------------------------------------------------ lexer
TOKEN = re.compile(r"""
  (?P<ws>\s+|//[^\n]*)
 |(?P<str>'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")
 |(?P<num>\d+\.\d+|\d+)
 |(?P<op>&&|\|\||==|!=|<=|>=|[{}()\[\],;:.?!<>+\-*/%=])
 |(?P<id>[A-Za-z_][A-Za-z0-9_]*)
""", re.X)


def scan_path(src, i):
    """'/' dan boshlanadigan path literal: segmentlar nom, {var}, {var=**} yoki $(ichma-ich ifoda)."""
    parts, j = [], i
    while j < len(src) and src[j] == "/" and j + 1 < len(src) and (src[j + 1].isalnum() or src[j + 1] in "_-${("):
        parts.append(("lit", "/"))
        j += 1
        if src.startswith("$(", j):
            depth, k = 0, j + 1
            while True:
                if src[k] == "(":
                    depth += 1
                elif src[k] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                k += 1
            parts.append(("expr", src[j + 2:k]))
            j = k + 1
        else:
            m = re.match(r"\(default\)|[A-Za-z0-9_\-]+|\{[A-Za-z0-9_=*]+\}", src[j:])
            seg = m.group(0)
            parts.append(("lit", seg))
            j += len(seg)
    return parts, j


def lex(src):
    out, i = [], 0
    prev = None
    while i < len(src):
        if src[i] == "/" and not src.startswith("//", i) and i + 1 < len(src) \
                and (src[i + 1].isalnum() or src[i + 1] in "_${") \
                and not (prev is not None and ((prev[0] in ("num", "str") or (prev[0] == "id" and prev[1] not in ("return", "if", "match", "in", "is")))
                                          or prev[1] in (")", "]"))):
            parts, i = scan_path(src, i)
            out.append(("path", parts))
            prev = out[-1]
            continue
        m = TOKEN.match(src, i)
        if not m:
            raise RulesError(f"lex: {src[i:i+30]!r}")
        i = m.end()
        kind = m.lastgroup
        if kind == "ws":
            continue
        out.append((kind, m.group(kind)))
        prev = out[-1]
    out.append(("eof", None))
    return out


# ------------------------------------------------------------------ parser (AST = tuple)
class Parser:
    def __init__(self, toks):
        self.t, self.i = toks, 0

    def peek(self, k=0):
        return self.t[self.i + k]

    def next(self):
        tok = self.t[self.i]
        self.i += 1
        return tok

    def accept(self, val):
        if self.peek()[1] == val and self.peek()[0] in ("op", "id"):
            self.i += 1
            return True
        return False

    def expect(self, val):
        if not self.accept(val):
            raise RulesError(f"'{val}' kutilgan, {self.peek()} topildi")

    # ---- top level
    def file(self):
        while not (self.peek()[0] == "id" and self.peek()[1] == "service"):
            self.next()
        self.expect("service")
        while self.peek()[1] != "{":
            self.next()
        self.expect("{")
        body = self.block()
        return body

    def block(self):
        funcs, matches, allows = {}, [], []
        while not self.accept("}"):
            tok = self.peek()
            if tok[1] == "function":
                self.next()
                name = self.next()[1]
                self.expect("(")
                params = []
                while not self.accept(")"):
                    params.append(self.next()[1])
                    self.accept(",")
                self.expect("{")
                lets = []
                while self.peek()[1] == "let":
                    self.next()
                    vn = self.next()[1]
                    self.expect("=")
                    lets.append((vn, self.expr()))
                    self.expect(";")
                self.expect("return")
                body = self.expr()
                self.accept(";")
                self.expect("}")
                funcs[name] = (params, lets, body)
            elif tok[1] == "match":
                self.next()
                pat = self.next()
                if pat[0] != "path":
                    raise RulesError(f"match path kutilgan: {pat}")
                self.expect("{")
                matches.append(("".join(v for _, v in pat[1]), self.block()))
            elif tok[1] == "allow":
                self.next()
                methods = [self.next()[1]]
                while self.accept(","):
                    methods.append(self.next()[1])
                cond = ("lit", True)
                if self.accept(":"):
                    self.expect("if")
                    cond = self.expr()
                self.expect(";")
                allows.append((methods, cond))
            else:
                raise RulesError(f"kutilmagan: {tok}")
        return {"funcs": funcs, "matches": matches, "allows": allows}

    # ---- expressions
    def expr(self):
        c = self.orx()
        if self.accept("?"):
            a = self.expr()
            self.expect(":")
            b = self.expr()
            return ("?:", c, a, b)
        return c

    def orx(self):
        l = self.andx()
        while self.accept("||"):
            l = ("||", l, self.andx())
        return l

    def andx(self):
        l = self.cmp()
        while self.accept("&&"):
            l = ("&&", l, self.cmp())
        return l

    def cmp(self):
        l = self.add()
        while True:
            tok = self.peek()
            if tok[1] in ("==", "!=", "<", "<=", ">", ">=") and tok[0] == "op":
                self.next()
                l = (tok[1], l, self.add())
            elif tok == ("id", "in"):
                self.next()
                l = ("in", l, self.add())
            elif tok == ("id", "is"):
                self.next()
                l = ("is", l, self.next()[1])
            else:
                return l

    def add(self):
        l = self.mul()
        while self.peek()[1] in ("+", "-") and self.peek()[0] == "op":
            op = self.next()[1]
            l = (op, l, self.mul())
        return l

    def mul(self):
        l = self.unary()
        while self.peek()[1] in ("*", "/", "%") and self.peek()[0] == "op":
            op = self.next()[1]
            l = (op, l, self.unary())
        return l

    def unary(self):
        if self.accept("!"):
            return ("!", self.unary())
        if self.peek() == ("op", "-"):
            self.next()
            return ("neg", self.unary())
        return self.postfix()

    def postfix(self):
        e = self.primary()
        while True:
            if self.accept("."):
                name = self.next()[1]
                if self.accept("("):
                    args = self.args(")")
                    e = ("call", e, name, args)
                else:
                    e = ("attr", e, name)
            elif self.accept("["):
                idx = self.expr()
                self.expect("]")
                e = ("idx", e, idx)
            else:
                return e

    def args(self, close):
        out = []
        while not self.accept(close):
            out.append(self.expr())
            self.accept(",")
        return out

    def primary(self):
        kind, val = self.next()
        if kind == "num":
            return ("lit", float(val) if "." in val else int(val))
        if kind == "str":
            return ("lit", bytes(val[1:-1], "utf-8").decode("unicode_escape"))
        if kind == "path":
            return ("path", [("lit", v) if t == "lit" else Parser(lex(v)).expr() for t, v in val])
        if kind == "op" and val == "(":
            e = self.expr()
            self.expect(")")
            return e
        if kind == "op" and val == "[":
            return ("list", self.args("]"))
        if kind == "id":
            if val in ("true", "false"):
                return ("lit", val == "true")
            if val == "null":
                return ("lit", None)
            if self.accept("("):
                return ("fn", val, self.args(")"))
            return ("var", val)
        raise RulesError(f"primary: {(kind, val)}")


# ------------------------------------------------------------------ evaluator
TYPES = {
    "string": lambda v: isinstance(v, str),
    "int": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "float": lambda v: isinstance(v, float),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "bool": lambda v: isinstance(v, bool),
    "list": lambda v: isinstance(v, list),
    "map": lambda v: isinstance(v, dict),
    "timestamp": lambda v: isinstance(v, _dt.datetime),
    "duration": lambda v: isinstance(v, Duration),
    "path": lambda v: isinstance(v, Path),
    "null": lambda v: v is None,
}


class MapDiff:
    def __init__(self, a, b):
        self.a, self.b = a, b

    # caller.diff(arg): self.b = caller, self.a = arg (Firebase rules.MapDiff semantikasi)
    def affectedKeys(self):
        keys = set(self.a) | set(self.b)
        return {k for k in keys if k not in self.a or k not in self.b or self.a[k] != self.b[k]}

    def addedKeys(self):
        return {k for k in self.b if k not in self.a}

    def removedKeys(self):
        return {k for k in self.a if k not in self.b}

    def changedKeys(self):
        return {k for k in self.b if k in self.a and self.a[k] != self.b[k]}

    def unchangedKeys(self):
        return {k for k in self.b if k in self.a and self.a[k] == self.b[k]}


class Ctx:
    def __init__(self, engine, vars_, funcs):
        self.engine, self.vars, self.funcs = engine, vars_, funcs
        self.ops = 0


class Engine:
    def __init__(self, rules_src):
        self.root = Parser(lex(rules_src)).file()

    # ---- path matching
    @staticmethod
    def match_seg(pattern, segs):
        pparts = [p for p in pattern.strip("/").split("/")]
        if len(pparts) > len(segs):
            return None
        binds = {}
        for i, p in enumerate(pparts):
            m = re.fullmatch(r"\{([A-Za-z0-9_]+)(=\*\*)?\}", p)
            if m:
                if m.group(2):
                    binds[m.group(1)] = "/".join(segs[i:])
                    return binds, len(segs)
                binds[m.group(1)] = segs[i]
            elif p != segs[i]:
                return None
        return binds, len(pparts)

    def find(self, block, segs, binds, funcs, out):
        funcs = {**funcs, **block["funcs"]}
        if not segs:
            out.append((block, binds, funcs))
            return
        for pat, sub in block["matches"]:
            r = self.match_seg(pat, segs)
            if r:
                b, used = r
                self.find(sub, segs[used:], {**binds, **b}, funcs, out)

    # ---- evaluation
    def ev(self, n, c):
        c.ops += 1
        if c.ops > 20000:
            raise RulesError("juda ko'p hisob")
        k = n[0]
        if k == "lit":
            return n[1]
        if k == "var":
            if n[1] in c.vars:
                return c.vars[n[1]]
            raise RulesError(f"noma'lum o'zgaruvchi {n[1]}")
        if k == "list":
            return [self.ev(x, c) for x in n[1]]
        if k == "path":
            return Path("".join(str(self.ev(p, c)) for p in n[1]))
        if k == "||" or k == "&&":
            try:
                l = self.ev(n[1], c)
                lerr = None
            except RulesError as e:
                l, lerr = None, e
            if lerr is None:
                self.need_bool(l)
                if k == "||" and l:
                    return True
                if k == "&&" and not l:
                    return False
            r = self.ev(n[2], c) if lerr is None else self.try_ev(n[2], c)
            if lerr is not None:
                if isinstance(r, RulesError):
                    raise lerr
                self.need_bool(r)
                if (k == "||" and r) or (k == "&&" and not r):
                    return r
                raise lerr
            self.need_bool(r)
            return r
        if k == "?:":
            cond = self.ev(n[1], c)
            self.need_bool(cond)
            return self.ev(n[2] if cond else n[3], c)
        if k == "!":
            v = self.ev(n[1], c)
            self.need_bool(v)
            return not v
        if k == "neg":
            v = self.ev(n[1], c)
            return -v
        if k == "is":
            return TYPES[n[2]](self.ev(n[1], c))
        if k == "in":
            l, r = self.ev(n[1], c), self.ev(n[2], c)
            if isinstance(r, dict):
                return l in r
            if isinstance(r, (list, set)):
                return l in r
            raise RulesError("in: noto'g'ri tur")
        if k in ("==", "!="):
            l, r = self.ev(n[1], c), self.ev(n[2], c)
            eq = self.eq(l, r)
            return eq if k == "==" else not eq
        if k in ("<", "<=", ">", ">="):
            l, r = self.ev(n[1], c), self.ev(n[2], c)
            if type(l) != type(r) and not (isinstance(l, (int, float)) and isinstance(r, (int, float))):
                raise RulesError(f"taqqoslash turi: {type(l)} {type(r)}")
            if l is None or r is None:
                raise RulesError("null taqqoslash")
            return {"<": l < r, "<=": l <= r, ">": l > r, ">=": l >= r}[k]
        if k in ("+", "-", "*", "/", "%"):
            l, r = self.ev(n[1], c), self.ev(n[2], c)
            return self.arith(k, l, r)
        if k == "attr":
            obj = self.ev(n[1], c)
            if isinstance(obj, dict):
                if n[2] not in obj:
                    raise RulesError(f"maydon yo'q: {n[2]}")
                return obj[n[2]]
            raise RulesError(f"attr {n[2]} on {type(obj)}")
        if k == "idx":
            obj, i = self.ev(n[1], c), self.ev(n[2], c)
            if isinstance(obj, list):
                if not isinstance(i, int) or i < 0 or i >= len(obj):
                    raise RulesError("indeks chegaradan tashqarida")
                return obj[i]
            if isinstance(obj, dict):
                if i not in obj:
                    raise RulesError(f"kalit yo'q {i}")
                return obj[i]
            raise RulesError("indeks turi")
        if k == "call":
            return self.method(self.ev(n[1], c), n[2], [self.ev(a, c) for a in n[3]])
        if k == "fn":
            return self.fn(n[1], n[2], c)
        raise RulesError(f"noma'lum tugun {k}")

    def try_ev(self, n, c):
        try:
            return self.ev(n, c)
        except RulesError as e:
            return e

    @staticmethod
    def need_bool(v):
        if not isinstance(v, bool):
            raise RulesError(f"bool kutilgan: {v!r}")

    @staticmethod
    def eq(l, r):
        if isinstance(l, bool) != isinstance(r, bool):
            return False
        return l == r

    @staticmethod
    def arith(op, l, r):
        if isinstance(l, _dt.datetime) and isinstance(r, Duration):
            return l + _dt.timedelta(seconds=r.s) if op == "+" else l - _dt.timedelta(seconds=r.s)
        if isinstance(l, _dt.datetime) and isinstance(r, _dt.datetime) and op == "-":
            return Duration((l - r).total_seconds())
        if isinstance(l, str) and isinstance(r, str) and op == "+":
            return l + r
        if isinstance(l, list) and isinstance(r, list) and op == "+":
            return l + r
        if not (isinstance(l, (int, float)) and isinstance(r, (int, float))) or isinstance(l, bool) or isinstance(r, bool):
            raise RulesError(f"arifmetika turi {op}: {l!r} {r!r}")
        if op == "+":
            return l + r
        if op == "-":
            return l - r
        if op == "*":
            return l * r
        if op == "/":
            if r == 0:
                raise RulesError("nolga bo'lish")
            return l // r if isinstance(l, int) and isinstance(r, int) else l / r
        if op == "%":
            return l % r

    def method(self, obj, name, args):
        if isinstance(obj, dict) and obj.get("__fs") and name in ("get", "exists"):
            # Storage Rules: firestore.get()/exists() — Firestore xotira modeliga murojaat
            p = str(args[0]).split("/documents/", 1)[1]
            doc = obj["store"].get(p)
            obj["gets"].add(p)
            if name == "exists":
                return doc is not None
            if doc is None:
                raise RulesError(f"firestore.get: hujjat yo'q {p}")
            return {"data": doc, "id": p.split("/")[-1]}
        if isinstance(obj, dict):
            if name == "keys":
                return list(obj.keys())
            if name == "get":
                return obj.get(args[0], args[1])
            if name == "size":
                return len(obj)
            if name == "diff":
                return MapDiff(args[0], obj)
            if name == "values":
                return list(obj.values())
        if isinstance(obj, MapDiff):
            if name in ("affectedKeys", "addedKeys", "removedKeys", "changedKeys", "unchangedKeys"):
                return getattr(obj, name)()
        if isinstance(obj, (list, set)):
            if name == "size":
                return len(obj)
            if name == "hasOnly":
                return all(x in args[0] for x in obj)
            if name == "hasAll":
                return all(x in obj for x in args[0])
            if name == "hasAny":
                return any(x in obj for x in args[0])
            if name == "removeAll" and isinstance(obj, list):
                return [x for x in obj if x not in args[0]]
            if name == "toSet":
                return set(obj)
        if isinstance(obj, str):
            if name == "split":
                return re.split(args[0], obj)
            if name == "size":
                return len(obj)
            if name == "matches":
                return re.fullmatch(args[0], obj) is not None
        if isinstance(obj, Duration):
            if name == "seconds":
                return int(obj.s // 1)
        raise RulesError(f"metod {name} {type(obj)}")

    def fn(self, name, argn, c):
        e = self
        if name in ("get", "exists", "getAfter", "existsAfter"):
            path = self.ev(argn[0], c)
            store = c.vars["__after"] if name.endswith("After") else c.vars["__before"]
            c.vars["__gets"].add(str(path))
            p = str(path).split("/documents/", 1)[1]
            doc = store.get(p)
            if name.startswith("exists"):
                return doc is not None
            if doc is None:
                raise RulesError(f"get: hujjat yo'q {p}")
            return {"data": doc, "id": p.split("/")[-1]}
        if name == "string":
            v = self.ev(argn[0], c)
            if isinstance(v, bool):
                return "true" if v else "false"
            return str(v)
        if name == "int":
            return int(self.ev(argn[0], c))
        if name in c.funcs:
            params, lets, body = c.funcs[name]
            vals = [self.ev(a, c) for a in argn]
            sub = Ctx(e, {**c.vars, **dict(zip(params, vals))}, c.funcs)
            sub.ops = c.ops
            for vn, ex in lets:
                sub.vars[vn] = self.ev(ex, sub)
            r = self.ev(body, sub)
            c.ops = sub.ops
            return r
        raise RulesError(f"noma'lum funksiya {name}")

    def eval_attr_chain(self):
        pass

    # ---- public
    def allowed_storage(self, method, path, auth, firestore_docs, now, resource=None, new_meta=None,
                        bucket="oliy-fizika.firebasestorage.app"):
        """Storage Rules: method read|get|list|create|update|delete; path 'a/b/c'; firestore_docs — cross-service."""
        segs = ["b", bucket, "o"] + path.split("/")
        found = []
        self.find_root(segs, found)
        request = {"auth": auth, "time": now, "method": method}
        if new_meta is not None:
            request["resource"] = new_meta
        aliases = {"read": ("get", "list"), "write": ("create", "update", "delete")}
        gets = set()
        for block, binds, funcs in found:
            for methods, cond in block["allows"]:
                ms = set()
                for m in methods:
                    ms |= set(aliases.get(m, (m,)))
                if method not in ms:
                    continue
                vars_ = {"request": request, "resource": resource, "__gets": gets, "duration": {"__dur": True},
                         "firestore": {"__fs": True, "store": firestore_docs, "gets": gets}, **binds}
                ctx = Ctx(self, vars_, funcs)
                try:
                    if self.ev(cond, ctx) is True:
                        return True, len(gets), ctx.ops
                except RulesError:
                    continue
        return False, len(gets), 0

    def allowed(self, method, path, auth, before, after, now, new_data=None):
        """method: get|list|create|update|delete. path: 'col/doc/...'. before/after: {path: data}."""
        segs = ["databases", "(default)", "documents"] + path.split("/")
        found = []
        self.find_root(segs, found)
        req_res = {"data": new_data} if new_data is not None else None
        resource = {"data": before.get(path), "id": path.split("/")[-1]} if before.get(path) is not None else None
        request = {"auth": auth, "time": now, "method": method}
        if req_res is not None:
            request["resource"] = req_res
        aliases = {"read": ("get", "list"), "write": ("create", "update", "delete")}
        gets = set()
        for block, binds, funcs in found:
            for methods, cond in block["allows"]:
                ms = set()
                for m in methods:
                    ms |= set(aliases.get(m, (m,)))
                if method not in ms:
                    continue
                vars_ = {"request": request, "resource": resource, "__before": before, "__after": after,
                         "__gets": gets, "duration": {"__dur": True}, **binds}
                ctx = Ctx(self, vars_, funcs)
                try:
                    if self.ev(cond, ctx) is True:
                        return True, len(gets), ctx.ops
                except RulesError:
                    continue
        return False, len(gets), 0

    def find_root(self, segs, out):
        root = self.root
        for pat, sub in root["matches"]:
            r = self.match_seg(pat, segs)
            if r:
                b, used = r
                self.find(sub, segs[used:], b, root["funcs"], out)


# duration.value(n, 's') — "duration" o'zgaruvchisi ustida metod
_orig_method = Engine.method


def _method(self, obj, name, args):
    if isinstance(obj, dict) and obj.get("__dur") and name == "value":
        n, unit = args
        mult = {"s": 1, "m": 60, "h": 3600, "d": 86400, "ms": 0.001}[unit]
        return Duration(n * mult)
    return _orig_method(self, obj, name, args)


Engine.method = _method
