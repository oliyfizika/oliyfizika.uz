#!/usr/bin/env python3
"""curriculum.json bo'yicha qamrov hisoboti (Markdown): python3 tools/simulations/curriculum-coverage.py"""
import json, pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
cur = json.loads((ROOT / "simulations/data/curriculum.json").read_text(encoding="utf-8"))

print("| Sinf | Mavzular | Simulyatsiya qilinadigan (sim + lab) | Bog‘langan | Bo‘sh | Lab. ishlari (vaqtincha sim / bo‘sh) | Masala (sim bilan) | Matn |")
print("|---|---|---|---|---|---|---|---|")
tot = defaultdict(int)
empty = defaultdict(list)
for g in cur["sinflar"]:
    ms = [m for b in g["boblar"] for m in b["mavzular"]]
    c = defaultdict(int)
    c["all"] = len(ms)
    for m in ms:
        t = m["tur"]
        if t in ("sim", "lab"):
            c["simlab"] += 1
            if m.get("sim") or m.get("lab"): c["linked"] += 1
            else:
                c["empty"] += 1
                empty[m.get("oila") or "yangi"].append(f'{g["sinf"]}§{m["raqam"]}')
        if t == "lab":
            c["lab"] += 1
            if m.get("lab"): c["labready"] += 1
            elif m.get("sim"): c["labsim"] += 1
            else: c["labempty"] += 1
        if t == "masala":
            c["masala"] += 1
            if m.get("sim"): c["masalasim"] += 1
        if t == "matn": c["matn"] += 1
    for k, v in c.items(): tot[k] += v
    print(f'| {g["sinf"]} | {c["all"]} | {c["simlab"]} | **{c["linked"]}** ({round(100*c["linked"]/c["simlab"])} %) | {c["empty"]} | {c["lab"]} ({c["labsim"]} / {c["labempty"]}) | {c["masala"]} ({c["masalasim"]}) | {c["matn"]} |')
c = tot
print(f'| **Jami** | **{c["all"]}** | **{c["simlab"]}** | **{c["linked"]}** ({round(100*c["linked"]/c["simlab"])} %) | **{c["empty"]}** | **{c["lab"]}** ({c["labsim"]} / {c["labempty"]}) | **{c["masala"]}** ({c["masalasim"]}) | **{c["matn"]}** |')
print()
print("| Oila | Bo‘sh mavzular | Soni |")
print("|---|---|---|")
for f, lst in sorted(empty.items(), key=lambda kv: (-len(kv[1]), kv[0])):
    print(f"| {f} | {', '.join(lst)} | {len(lst)} |")
