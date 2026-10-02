#!/usr/bin/env python3
"""
firestore.rules ga Attestatsiya -> Fizika blokini qo'shadi (yoki yangilaydi).

- attestation_physics.rules.in shablonini markerlar orasiga joylaydi.
- Faqat BEGIN/END markerlari orasidagi qism yoziladi; fayldagi boshqa qatorlar o'zgarmaydi (skript tekshiradi).
- Deploy QILMAYDI. Production'ga qo'yish — loyiha egasi tomonidan qo'lda (Rules Playground sinovidan keyin).

  python3 tools/attestatsiya-fizika/rules/build_rules.py            # yozadi
  python3 tools/attestatsiya-fizika/rules/build_rules.py --check    # faqat farqni tekshiradi
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
RULES = os.path.join(ROOT, "firestore.rules")
BEGIN = "    // >>> attestation-physics (generated — tools/attestatsiya-fizika/rules/build_rules.py)"
END = "    // <<< attestation-physics"


def block():
    tpl = open(os.path.join(HERE, "attestation_physics.rules.in"), encoding="utf-8").read()
    return BEGIN + "\n" + tpl.rstrip() + "\n" + END + "\n"


def main():
    src = open(RULES, encoding="utf-8").read()
    if BEGIN in src:
        a = src.index("\n" + BEGIN)
        b = src.index(END) + len(END) + 1
        base = src[:a] + src[b:]
    else:
        base = src
    # bazaviy qism: '  }\n}\n' — documents match va service yopilishi
    tail = "  }\n}\n"
    if not base.endswith(tail):
        sys.exit("firestore.rules oxiri kutilgan ko'rinishda emas — qo'lda tekshiring")
    new = base[: -len(tail)] + "\n" + block() + tail
    if base[: -len(tail)].rstrip("\n") != (new[: len(base) - len(tail)]).rstrip("\n"):
        sys.exit("ichki xato: mavjud qoidalar o'zgarib qoladi")
    if "--check" in sys.argv:
        print("OK" if new == src else "FARQ BOR")
        return
    open(RULES, "w", encoding="utf-8").write(new)
    print(f"firestore.rules: +{len(new) - len(base)} bayt (Attestatsiya Fizika bloki)")


if __name__ == "__main__":
    main()
