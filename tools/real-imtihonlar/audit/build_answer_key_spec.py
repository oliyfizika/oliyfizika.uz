#!/usr/bin/env python3
"""36–45 ochiq javoblar: Sarvar tolerans siyosatini (08.10.2026, 2-qaror) qo'llab, har bir qism uchun KALIT SPETSIFIKATSIYASI QORALAMASI.
FAQAT O'QIYDI — dataset / app-data / oldingi audit fayllari o'zgarmaydi; faqat yangi fayllar yoziladi. Engine'ga ulanmagan.

  python3 tools/real-imtihonlar/audit/build_answer_key_spec.py

Kirish: open-answer-key-audit.json, open-answer-tolerance-proposal.json, sarvar-decisions.json
Natija:
  _private/real-imtihonlar/audit/sarvar-decisions-002-tolerance-policy.json   — siyosat matni (qaror jurnali)
  _private/real-imtihonlar/audit/answer-key-spec.draft.{json,md}             — har bir qism: maqsad qiymat(lar), tolerans, holat (MAXFIY)
  docs/real-imtihonlar/08_answer_key_spec_summary.md                        — ommaviy xulosa (javobsiz)

Variant qiymatlar (g = 9,8; π = 3,14159…) quyidagi CALC jadvalida yechimdagi formulaning o'zi bilan hisoblanadi —
har bir formula md faylda ko'rsatiladi, Sarvar tekshiradi. Jadval doimiylarining MUQOBIL qiymatlari qo'shilmagan
(qaysi jadval "explicitly applicable" ekanini Sarvar aytishi kerak) — taxmin qilinmaydi.
"""
import json
import math
import os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
AUD = os.path.join(ROOT, "_private", "real-imtihonlar", "audit")
REL = 0.01
ABS0 = 1e-9
PI = math.pi
sq = math.sqrt

POLICY = {
    "date": "2026-10-08", "by": "Sarvar Amirov", "decisionNo": 2, "appliedToDataset": False,
    "SIMPLE_NUMERIC": "default relative tolerance = ±1%",
    "G_VALUE_VARIANT": "g = 9.8 and g = 10 are both accepted when the problem does not specify g",
    "INTEGER_EXACT": "exact normalized integer match",
    "ZERO_VALUE": "absolute tolerance = 1e-9",
    "NEGATIVE_VALUE": "sign is mandatory",
    "UNIT_MISMATCH": "equivalent unit conversion is accepted",
    "EXACT_FORM_GIVEN": "exact symbolic form OR numerically equivalent value",
    "PI_APPROX_3": "accept answers derived using π≈3 and standard π, subject to the corresponding calculated result",
    "TABLE_CONSTANT": "accept results corresponding to the explicitly applicable table constant(s)",
    "SOURCE_KEY_DIFFERS": "audited final answer takes precedence over source answer key",
    "BLOCKED": "remains PENDING until HIGH review is resolved",
    "UNIT_NOT_ASKED_30_09_B": "remains PENDING until input-unit policy is decided",
    "NON_NUMERIC_QUALIFIER": "group-specific normalization; unsafe cases remain manual review",
}

# ---------------------------------------------------------------- g / π variantlari (yechim formulasi bilan)
# kalit: partId (REAL- siz) -> (formula matni, f(g, pi) -> qiymat, birlik, qaysi o'zgaruvchilar: "g", "pi" yoki "g,pi")
CALC = {
    "2024-12-01-q37a": ("p = ρk·g·hk + ρs·g·hs = (800·0,006 + 1000·0,004)·g", lambda g, p: (800 * .006 + 1000 * .004) * g, "Pa", "g"),
    "2024-12-01-q37b": ("F = p·S = 8,8·g·10⁻⁴ N → mN", lambda g, p: (800 * .006 + 1000 * .004) * g * 1e-4 * 1e3, "mN", "g"),
    "2024-12-01-q38a": ("σ = m·g/S = 1,6·10⁶·g/0,08", lambda g, p: 1.6e6 * g / 0.08, "Pa", "g"),
    "2024-12-01-q38b": ("ε = σ/E = (1,6·10⁶·g/0,08)/1,9·10¹¹ · 100 %", lambda g, p: 1.6e6 * g / 0.08 / 1.9e11 * 100, "%", "g"),
    "2024-12-01-q40a": ("ΔU = m·g·h = 0,042·g·120", lambda g, p: 0.042 * g * 120, "J", "g"),
    "2024-12-01-q40b": ("ΔT = g·h/c, c = 130 J/(kg·K) (audit jadval qiymati)", lambda g, p: g * 120 / 130, "K", "g"),
    "2025-02-22-q36a": ("p = m·g/S = 0,06·g/0,005", lambda g, p: 0.06 * g / 0.005, "Pa", "g"),
    "2025-02-22-q36b": ("F = m·g = 0,06·g", lambda g, p: 0.06 * g, "N", "g"),
    "2025-02-22-q37b": ("p = 1000·g·0,04 + 800·g·0,15", lambda g, p: (1000 * .04 + 800 * .15) * g, "Pa", "g"),
    "2025-02-22-q38a": ("υ = √(2·g·4,8)", lambda g, p: sq(2 * g * 4.8), "m/s", "g"),
    "2025-02-22-q38b": ("A = m·g·h = 20·g·4,8", lambda g, p: 20 * g * 4.8, "J", "g"),
    "2025-05-13-1-q36a": ("η = (υ²/2)/(g·h) = 18/(3·g) · 100 %", lambda g, p: 18 / (3 * g) * 100, "%", "g"),
    "2025-05-13-1-q36b": ("μ = (g·h − υ²/2)/(g·cosα·L) = (3g − 18)/(4g)", lambda g, p: (3 * g - 18) / (g * 0.8 * 5), "", "g"),
    "2025-05-13-2-q36b": ("Δp = m·g·t = 1,2·g·3", lambda g, p: 1.2 * g * 3, "kg·m/s", "g"),
    "2025-05-13-2-q37a": ("υ₀² = g·(2H + L²/(8H)) = 2,5·g", lambda g, p: sq(g * (2 * .8 + 2.4 ** 2 / (8 * .8))), "m/s", "g"),
    "2025-05-13-2-q37b": ("K = ½·m·υx² = ½·0,8·g·L²/(8H) = 0,36·g", lambda g, p: 0.5 * 0.8 * g * 2.4 ** 2 / (8 * .8), "J", "g"),
    "2025-11-30-q36a": ("K = ½·3,2·(30² + 2·g·80) → kJ", lambda g, p: 0.5 * 3.2 * (900 + 2 * g * 80) / 1000, "kJ", "g"),
    "2025-11-30-q36b": ("s = (120 + 30)·√(2·80/g)", lambda g, p: 150 * sq(160 / g), "m", "g"),
    "2025-11-30-q37a": ("F_A = ρs·V·√(g² + a²) = 1000·0,006·√(g² + 7,5²)", lambda g, p: 1000 * .006 * sq(g * g + 56.25), "N", "g"),
    "2025-11-30-q37b": ("T = (ρAl − ρs)·V·√(g² + a²) = 1700·0,006·√(g² + 7,5²)", lambda g, p: 1700 * .006 * sq(g * g + 56.25), "N", "g"),
    "2025-11-30-q38a": ("T = 2π·√(m/(ρ·g·S)) = 2π·√(0,2/(1000·g·0,008))", lambda g, p: 2 * p * sq(0.2 / (1000 * g * .008)), "s", "g,pi"),
    "2025-11-30-q38b": ("υmax = A·√(ρ·g·S/m) = 0,05·√(1000·g·0,008/0,2)", lambda g, p: 0.05 * sq(1000 * g * .008 / 0.2), "m/s", "g"),
    "2026-01-18-q36a": ("t = √(2·60/g), x = 30t, s = √(x² + 60²)", lambda g, p: sq((30 * sq(120 / g)) ** 2 + 3600), "m", "g"),
    "2026-01-18-q36b": ("θ = arctg(60/x), x = 30·√(2·60/g)", lambda g, p: math.degrees(math.atan(60 / (30 * sq(120 / g)))), "°", "g"),
    "2026-01-18-q37a": ("t = Δp/(m·g) = 18/(0,6·g)", lambda g, p: 18 / (0.6 * g), "s", "g"),
    "2026-01-18-q37b": ("R = υx²/g, υy = Δp/(2m) = 15 (g ga bog'liq emas) → R = 675/g", lambda g, p: 675 / g, "m", "g"),
    "2026-01-18-q38a": ("a = (F·cosα − μ(m·g − F·sinα) − μ·m·g)/(2m) = (16 − 0,5(2g − 12) − 0,5·2g)/4", lambda g, p: (16 - 0.5 * (2 * g - 12) - 0.5 * 2 * g) / 4, "m/s²", "g"),
    "2026-01-18-q38b": ("k·x = μ·m·g + m·a → x (cm)", lambda g, p: (0.5 * 2 * g + 2 * ((16 - 0.5 * (2 * g - 12) - 0.5 * 2 * g) / 4)) / 200 * 100, "cm", "g"),
    "2026-01-18-q40a": ("m = σ·π·d/g = 0,022·π·0,004/g → mg (σ = 22 mN/m — audit jadval qiymati)", lambda g, p: 0.022 * p * 0.004 / g * 1e6, "mg", "g,pi"),
    "2026-01-18-q40b": ("N = 52,8 g / m_tomchi", lambda g, p: 52.8e-3 / (0.022 * p * 0.004 / g), "", "g,pi"),
    "2026-04-06-1-q36a": ("T = √2·(μ·m·g + m·a)/(1 + μ), a = (F − 2μmg)/(2m) → T = √2·(F/2)/(1,5) (g ga bog'liq emas)", lambda g, p: sq(2) * (0.5 * 4 * g + 4 * (60 - 2 * .5 * 4 * g) / 8) / 1.5, "N", "g"),
    "2026-04-06-1-q36b": ("a = (F − 2·μ·m·g)/(2m) = (60 − 4g)/8", lambda g, p: (60 - 2 * .5 * 4 * g) / 8, "m/s²", "g"),
    "2026-04-06-1-q37a": ("a↑ = g + F/m, a↓ = g − F/m; υ₀(1/a↑ + 1/√(a↑·a↓)) = 3", lambda g, p: 3 / (1 / (g + 6) + 1 / sq((g + 6) * (g - 6))), "m/s", "g"),
    "2026-04-06-1-q37b": ("h = υ₀²/(2·a↑)", lambda g, p: (3 / (1 / (g + 6) + 1 / sq((g + 6) * (g - 6)))) ** 2 / (2 * (g + 6)), "m", "g"),
    "2026-04-06-1-q38a": ("E = ½·0,5·10² + 0,5·g·4; h = (E − 9)/(0,5·g)", lambda g, p: (25 + 0.5 * g * 4 - 9) / (0.5 * g), "m", "g"),
    "2026-04-06-1-q38b": ("t = 2υ/g, υ = √(2·g·h)", lambda g, p: 2 * sq(2 * g * ((25 + 2 * g - 9) / (0.5 * g))) / g, "s", "g"),
    "2026-04-06-1-q39a": ("p₁ = p₀ + ρ·g·h (p₀ = 100 kPa), S₂ = S₁·(p₁/p₀)^(2/3)", lambda g, p: 0.8 * ((1e5 + 1000 * g * 70) / 1e5) ** (2 / 3), "cm²", "g"),
    "2026-04-06-1-q39b": ("ΔE = σ·(S₂ − S₁), σ = 73 mN/m → µJ", lambda g, p: 0.073 * (0.8 * ((1e5 + 1000 * g * 70) / 1e5) ** (2 / 3) - 0.8) * 1e-4 * 1e6, "µJ", "g"),
    "2026-04-06-1-q43a": ("Φ = 4·π·I = 4·π·500", lambda g, p: 4 * p * 500, "lm", "pi"),
    "2026-04-06-2-q36b": ("F_pr = (1 + M + 4)·g/2 = 7·g/2 (M = 2 kg, g ga bog'liq emas)", lambda g, p: 7 * g / 2, "N", "g"),
    "2026-04-06-2-q44a": ("Φ = 4·π·I = 4·π·320", lambda g, p: 4 * p * 320, "lm", "pi"),
    "2026-09-29-1-q37b": ("S = 4·2π·R = 32π; 0,5t² + 2t − S = 0", lambda g, p: -2 + sq(4 + 2 * 32 * p), "s", "pi"),
    "2026-09-29-1-q38a": ("υ = √(υ₁² + 2·g·h) = √(1 + 8g)", lambda g, p: sq(1 + 2 * g * 4), "m/s", "g"),
    "2026-09-29-1-q38b": ("S = S₁·υ₁/υ = 45/√(1 + 8g)", lambda g, p: 45 / sq(1 + 8 * g), "cm²", "g"),
    "2026-09-29-1-q39a": ("h = 2σ/(ρ·(g − a)·r), σ = 22 mN/m, ρ = 800 (audit jadval) → mm", lambda g, p: 2 * .022 / (800 * (g - 7.5) * 5e-4) * 1e3, "mm", "g"),
    "2026-09-29-1-q39b": ("A = 2π·σ²/(ρ·(g − a)) → nJ", lambda g, p: 2 * p * .022 ** 2 / (800 * (g - 7.5)) * 1e9, "nJ", "g,pi"),
    "2026-09-29-2-q37a": ("T = F/2 = 100; a₁ = T/m₁ − g, a₂ = T/m₂ − g; a_blok = (a₁ + a₂)/2", lambda g, p: ((10 - g) + (20 - g)) / 2, "m/s²", "g"),
    "2026-09-29-2-q37b": ("a₁ = T/m₁ − g = 10 − g", lambda g, p: 10 - g, "m/s²", "g"),
    "2026-09-29-2-q39b": ("N = ρ·Q·(g·h + υ²/2) = 800·0,04·(45g + 50) → kW", lambda g, p: 800 * .04 * (45 * g + 50) / 1000, "kW", "g"),
    "2026-09-29-2-q42b": ("H = √(2w/μ₀), μ₀ = 4π·10⁻⁷", lambda g, p: sq(2 * 2.4e-4 / (4 * p * 1e-7)), "A/m", "pi"),
    "2026-09-30-A-q36a": ("y = x·tgα − g·x²/(2υ₀²cos²α) = 60 − g·3600/900", lambda g, p: 60 - g * 3600 / 900, "m", "g"),
    "2026-09-30-A-q36b": ("L = υ₀²/g; ikki nuqta orasidagi masofa = 60 − (L − 60)", lambda g, p: 60 - (900 / g - 60), "m", "g"),
    "2026-09-30-A-q37a": ("k' = m·g/0,03; k = ¾·k'", lambda g, p: 0.75 * 2 * g / 0.03, "N/m", "g"),
    "2026-09-30-A-q37b": ("x = m·g/k; l₀ = 30 − x (g ga bog'liq emas)", lambda g, p: 30 - (2 * g / (0.75 * 2 * g / 0.03)) * 100, "cm", "g"),
    "2026-09-30-A-q38a": ("a = (m₁ − m₂)·g/(m₁ + m₂) = 0,4·g", lambda g, p: 0.4 * g, "m/s²", "g"),
    "2026-09-30-A-q38b": ("T = m₂·(g + a) = 0,3·1,4·g", lambda g, p: 0.3 * 1.4 * g, "N", "g"),
}
# Faqat π ≈ 3 bilan bog'liq (savolda π ≈ 3 berilgan) yoki g + π — CALC da "pi" belgisi bilan.
PI_GIVEN_IN_QUESTION = {"2025-11-30-q38a", "2026-01-18-q40a", "2026-01-18-q40b", "2026-04-06-1-q43a", "2026-04-06-2-q44a",
                        "2026-09-29-1-q37b", "2026-09-29-2-q42b"}  # 2026-09-29-1-q39b da π berilmagan — audit π≈3 va 3,14 ni ko'rsatgan
TABLE_CONST = {
    "2024-12-01-q40b": "c(oltin) = 130 J/(kg·K)", "2026-01-18-q40a": "σ(spirt) = 22 mN/m", "2026-01-18-q40b": "σ(spirt) = 22 mN/m",
    "2026-04-06-1-q40a": "Dyulong–Pti (C = 3R) — 1-qaror bilan finalized; jadvaldagi c(mis) varianti qo'shilmagan",
    "2026-04-06-1-q40b": "Dyulong–Pti (C = 3R) — 1-qaror bilan finalized; jadvaldagi c(mis) varianti qo'shilmagan",
    "2026-04-06-2-q40b": "q(tabiiy gaz) = 44 MJ/kg", "2026-09-29-1-q39a": "σ(spirt) = 22 mN/m, ρ = 800 kg/m³",
    "2026-09-29-1-q39b": "σ(spirt) = 22 mN/m, ρ = 800 kg/m³", "2026-04-06-1-q39a": "p₀ = 100 kPa", "2026-04-06-1-q39b": "p₀ = 100 kPa, σ(suv) = 73 mN/m",
}
EXAM_G_GIVEN = {"REAL-2026-09-30-B"}           # imtihon ko'rsatmasida g = 10
Q_G_GIVEN = {"2026-09-29-1-q36a", "2026-09-29-1-q36b"}  # savol matnida g = 10

# EXACT_FORM: aniq ko'rinish -> son (qabul qilinadigan matn shakllari normalizatsiyadan keyin)
EXACT_FORM = {
    "2024-12-01-q42a": ("3√2", 3 * sq(2), "A", ["3√2", "3sqrt2", "3sqrt(2)", "3*sqrt(2)"]),
    "2025-02-22-q38a": ("√96 (g = 10); √94,08 (g = 9,8)", sq(96), "m/s", ["√96", "sqrt96", "sqrt(96)", "4√6"]),
    "2025-05-13-1-q37a": ("10/3", 10 / 3, "m/s", ["10/3"]),
    "2025-11-30-q40b": ("7/6", 7 / 6, "marta", ["7/6"]),
    "2026-04-06-1-q36a": ("20√2", 20 * sq(2), "N", ["20√2", "20sqrt2", "20sqrt(2)", "20*sqrt(2)"]),
    "2024-12-01-q41b": ("2400π m", 2400 * PI / 1000, "km", ["2400π", "2400pi"]),
    "2025-11-30-q42a": ("2/3", 2 / 3, "", ["2/3"]),
}
# APPROX (≈) — siyosat BERILMAGAN: aniq (yaxlitlanmagan) qiymat, faqat taklif uchun.
PRECISE = {
    "2024-12-01-q38b": 1.6e6 * 10 / 0.08 / 1.9e11 * 100, "2024-12-01-q40b": 1200 / 130, "2024-12-01-q41a": 1e6 / (8 * PI),
    "2024-12-01-q41b": 2400 * PI / 1000, "2024-12-01-q39b": 60 / (1.5 * 3 * 8.31), "2025-05-13-1-q37b": 20.5 - 25 / 3,
    "2025-05-13-1-q43a": 13 / 5 * 12 / 13 * 1.67e-27 * 3e8, "2025-05-13-1-q43b": 13 / 5 * 12 / 13 * 1.67e-27 * 3e8 / 2e-9,
    "2025-05-13-1-q45b": math.log(2) / 90, "2025-05-13-2-q40b": 300 / 700 * 100,
    "2025-05-13-2-q45a": 13.6 * (1 / 9 - 1 / 16) * 1.6e-19 / 6.6e-34, "2025-05-13-2-q45b": 13.6 * (1 / 9 - 1 / 16) * 1.6e-19 / 3e8,
    "2025-11-30-q39b": 2.5 * 1250 * 8.31 * 100 / 1000, "2026-01-18-q42b": (500 / 30 - 1) / 0.005,
    "2026-01-18-q44b": 8e-10 * 0.8 / 3e8, "2026-04-06-1-q39b": 0.073 * 2.4e-4 * 1e6, "2026-04-06-1-q40a": 3 * 40 * 8.31,
    "2026-04-06-1-q40b": 3 * 40 * 8.31 * 60 / 1000, "2026-04-06-2-q39b": 6 * 8.31 * 300 / 1.2e5 * 1000, "2026-04-06-2-q40b": 40 * 4200 * 60 / 44e6,
    "2026-09-29-1-q39b": 2 * PI * .022 ** 2 / 2000 * 1e9,
}
# NON_NUMERIC / QUALIFIER guruhlari: (guruh, xavfsizmi, normallashtirilgan maqsad, izoh)
GROUPS = {
    # koeffitsiyent × berilgan kattalik (UI'da "javobni E / p / c / A birligida kiriting" degan ko'rsatma bilan)
    "2024-12-01-q44a": ("COEFFICIENT_OF_GIVEN", True, 4 / 3, "E birligida: 4/3 ≈ 1,333", ["4/3", "4E/3"]),
    "2024-12-01-q44b": ("COEFFICIENT_OF_GIVEN", True, 16 / 9, "p birligida: 16/9 ≈ 1,778", ["16/9", "16p/9"]),
    "2025-05-13-2-q43a": ("COEFFICIENT_OF_GIVEN", True, 0.2, "c birligida: 0,2", ["0,2c", "0.2c"]),
    "2025-05-13-2-q43b": ("COEFFICIENT_OF_GIVEN", True, 5 / 13, "c birligida: 5/13 ≈ 0,385", ["5c/13", "5/13"]),
    "2025-05-13-2-q44a": ("COEFFICIENT_OF_GIVEN", True, 7 / 12, "E/c birligida: 7/12 ≈ 0,583", ["7E/(12c)", "7/12"]),
    "2025-05-13-1-q44a": ("COEFFICIENT_OF_GIVEN", True, sq(15), "p/c birligida: √15 ≈ 3,873", ["√15", "sqrt15", "√15p/c"]),
    "2025-05-13-1-q44b": ("COEFFICIENT_OF_GIVEN", True, sq(19), "pc birligida: √19 ≈ 4,359", ["√19", "sqrt19", "√19pc"]),
    "2026-04-06-1-q45a": ("COEFFICIENT_OF_GIVEN", True, 0.8, "A birligida: 0,8", ["0,8A", "0.8A"]),
    "2026-04-06-1-q45b": ("RATIO", True, 0.5, "N₁/N₂ = 1/2", ["1/2", "0,5", "1:2"]),
    "2025-11-30-q42a": ("RATIO", True, 2 / 3, "cosφ = 2/3", ["2/3"]),
    # "N marta" — o'sish: nisbat r = yangi/eski
    "2024-12-01-q45a": ("FACTOR_INCREASE", True, 16, "r = 16 (ortgan)", ["16", "16 marta ortgan"]),
    "2024-12-01-q45b": ("FACTOR_INCREASE", True, 64, "r = 64 (ortgan)", ["64", "64 marta ortgan"]),
    "2025-05-13-1-q38b": ("FACTOR_INCREASE", True, 2, "r = 2 (tezlik ortadi)", ["2", "2 marta"]),
    "2025-05-13-2-q44b": ("FACTOR_INCREASE", True, 8 / 3, "r = 8/3 (ortadi)", ["8/3", "8/3 marta ortadi"]),
    "2025-11-30-q40b": ("FACTOR_INCREASE", True, 7 / 6, "r = 7/6 ≈ 1,167 (EXACT_FORM ham)", ["7/6", "1,17"]),
    "2026-04-06-2-q45a": ("FACTOR_INCREASE", True, 27, "r = 27", ["27", "27 marta"]),
    "2024-12-01-q39b": ("SIGNED_CHANGE", True, 60 / (1.5 * 3 * 8.31), "ΔT = +1,60 K (ortgan = musbat)", ["1,6", "1,6 K ga ortgan"]),
    # "N marta kamaygan" — faqat son kiritilsa yo'nalish noaniq → XAVFLI
    "2025-02-22-q45b": ("FACTOR_DECREASE", False, None, "'2' kiritilsa o'sishmi, kamayishmi — noaniq; kiritish formati qarori kerak", ["2 marta kamayadi"]),
    "2025-05-13-1-q39b": ("FACTOR_DECREASE", False, None, "'1,25' kiritilsa yo'nalish noaniq; kiritish formati qarori kerak", ["1,25 marta kamaygan"]),
    # matnli tanlov
    "2025-05-13-1-q39a": ("TEXT_CHOICE", True, None, "faqat imlo variantlari (semantik sinonim qo'shilmagan)", ["o'zgarmagan", "o‘zgarmagan", "o`zgarmagan", "ozgarmagan"]),
    "2026-09-29-1-q45a": ("TEXT_CHOICE", True, None, "nur raqami", ["2", "2-nur", "2 nur"]),
    "2026-09-29-1-q45b": ("TEXT_CHOICE", True, None, "faqat imlo variantlari", ["hech qaysi", "hechqaysi", "hech qaysisi"]),
    # ko'p belgili formula — XAVFLI
    "2025-02-22-q41a": ("SYMBOLIC_FORMULA", False, None, "eEl/2 — formula kiritish xavfsiz tekshirilmaydi", []),
    "2025-02-22-q43a": ("SYMBOLIC_FORMULA", False, None, "eB/(2πm)", []),
    "2025-02-22-q43b": ("SYMBOLIC_FORMULA", False, None, "eBr/m", []),
    "2025-05-13-1-q41a": ("SYMBOLIC_FORMULA", False, None, "√(kQq/(mr))", []),
    "2025-05-13-1-q41b": ("SYMBOLIC_FORMULA", False, None, "kQq/(2r)", []),
    "2026-01-18-q41a": ("SYMBOLIC_FORMULA", False, None, "ℰ(t) = BSω·sinωt", []),
    "2026-01-18-q41b": ("SYMBOLIC_FORMULA", False, None, "P(t) = B²S²ω²sin²ωt/R", []),
    "2025-11-30-q41b": ("SIGN_AMBIGUOUS", False, None, "|A| = 1080 nJ — kimning ishi so'ralgani noaniq; 'ishora majburiy' siyosati bilan ziddiyat", []),
}


def g_variants(pid, eid):
    """(g, π) kombinatsiyalari: qaysi g va π qiymatlari qabul qilinadi."""
    c = CALC.get(pid)
    if not c:
        return None
    gs = [10.0] if (eid in EXAM_G_GIVEN or pid in Q_G_GIVEN or "g" not in c[3]) else [10.0, 9.8]
    ps = [3.0, PI] if "pi" in c[3] else [3.0 if pid in PI_GIVEN_IN_QUESTION else PI]
    if "pi" not in c[3] and pid in PI_GIVEN_IN_QUESTION:
        ps = [3.0]
    out = []
    for g in gs:
        for p in ps:
            v = c[1](g, p)
            out.append({"g": g, "pi": "3" if p == 3.0 else "π", "value": v, "vars": c[3]})
    # bir xil qiymatlarni birlashtirish
    uniq = []
    for o in out:
        if not any(abs(o["value"] - u["value"]) <= 1e-9 * max(1, abs(u["value"])) for u in uniq):
            uniq.append(o)
    return {"formula": c[0], "unit": c[2], "variants": uniq, "independentOfG": len({round(o['value'], 9) for o in out if o['pi'] == out[0]['pi']}) == 1 and "g" in c[3]}


def main():
    audit = json.load(open(os.path.join(AUD, "open-answer-key-audit.json"), encoding="utf-8"))
    prop = {p["partId"]: p for p in json.load(open(os.path.join(AUD, "open-answer-tolerance-proposal.json"), encoding="utf-8"))["proposal"]}
    specs = []
    for it in audit["items"]:
        pid = it["partId"][5:]
        eid = it["examId"]
        pv = it["parsed"]
        flags = set(it["flags"])
        s = {"partId": it["partId"], "examId": eid, "questionNumber": it["questionNumber"], "part": it["part"],
             "finalAnswerText": it["finalAnswerText"], "category": it["category"], "policiesApplied": [], "targets": [],
             "acceptText": [], "signRequired": False, "notes": [], "status": None}
        unit = pv.get("unit") or it.get("askedUnit")

        def target(v, label, tol=("relative", REL), u=None):
            s["targets"].append({"value": v, "unit": u if u is not None else unit, "variant": label,
                                 "tolerance": {"type": tol[0], "value": tol[1]}})

        # 1) bloklangan / 30.09-B birliksiz / siyosatsiz holatlar
        if it["category"] == "BLOCKED":
            s["status"] = "PENDING_HIGH_REVIEW"
            s["policiesApplied"].append("BLOCKED")
            specs.append(s)
            continue
        if eid == "REAL-2026-09-30-B" and it.get("unitStatus") == "UNIT_NOT_ASKED":
            s["status"] = "PENDING_INPUT_UNIT_POLICY"
            s["policiesApplied"].append("UNIT_NOT_ASKED_30_09_B")
            if pv.get("value") is not None:
                s["notes"].append(f"qiymat tayyor: {pv['value']:.6g} {pv.get('unit') or ''} — faqat kiritish birligi kutilmoqda")
            specs.append(s)
            continue
        if pid in GROUPS:
            grp, safe, val, note, acc = GROUPS[pid]
            s["policiesApplied"].append("NON_NUMERIC_QUALIFIER")
            s["normalizationGroup"] = grp
            s["acceptText"] = acc
            s["notes"].append(note)
            if pid in EXACT_FORM:
                s["policiesApplied"].append("EXACT_FORM_GIVEN")
            if safe and val is not None:
                tol = ("exact", 0) if grp == "FACTOR_INCREASE" and float(val).is_integer() else ("relative", REL)
                target(val, "normalized", tol, u="")
                s["status"] = "KEY_SPEC_READY"
            elif safe:
                s["status"] = "KEY_SPEC_READY"  # matnli tanlov — acceptText bilan
            else:
                s["status"] = "NEEDS_MANUAL_REVIEW"
            specs.append(s)
            continue
        # 2) raqamli qismlar
        gv = g_variants(pid, eid)
        if pid in EXACT_FORM and pid not in GROUPS:
            form, val, u, acc = EXACT_FORM[pid]
            s["policiesApplied"].append("EXACT_FORM_GIVEN")
            s["acceptText"] = acc
            s["notes"].append(f"aniq ko'rinish: {form}")
            if not gv:
                target(val, "exact form → son", u=u)
        if gv:
            pol = []
            if any(v["g"] == 9.8 for v in gv["variants"]):
                pol.append("G_VALUE_VARIANT")
            if any(v["pi"] == "3" for v in gv["variants"]) and any(v["pi"] == "π" for v in gv["variants"]):
                pol.append("PI_APPROX_3")
            elif "PI_APPROX_3" in flags:
                pol.append("PI_APPROX_3")
            s["policiesApplied"] += pol
            s["calc"] = {"formula": gv["formula"]}
            if gv["independentOfG"]:
                s["notes"].append("natija g ga bog'liq emas (formula bo'yicha) — bitta qiymat")
            for v in gv["variants"]:
                parts = []
                if "g" in v["vars"]:
                    parts.append(f"g = {v['g']:g}")
                if "pi" in v["vars"] or pid in PI_GIVEN_IN_QUESTION:
                    parts.append(f"π = {v['pi']}")
                lbl = ", ".join(parts)
                if abs(v["value"]) < ABS0:
                    target(0.0, lbl, ("absolute", ABS0), u=gv["unit"])
                    s["policiesApplied"].append("ZERO_VALUE")
                else:
                    target(v["value"], lbl, u=gv["unit"])
            if pid == "2026-01-18-q40b":  # tomchilar soni — butun son
                s["policiesApplied"].append("INTEGER_EXACT")
                s["notes"].append("tomchilar soni: π = 3 bilan butun (2000; 1960), π = 3,14 bilan butun emas (≈1909,9; ≈1871,7) — butunlash qoidasi yo'q")
                s["targets"] = [t for t in s["targets"] if abs(t["value"] - round(t["value"])) < 1e-6]
                for t in s["targets"]:
                    t["value"] = round(t["value"])
                    t["tolerance"] = {"type": "exact", "value": 0}
                s["status"] = "NEEDS_MANUAL_REVIEW"
                s["notes"].append("π = 3,14 variantlari butun emas → qo'lda ko'rib chiqish (faqat butun variantlar ro'yxatda)")
        elif pid not in EXACT_FORM and pv.get("value") is not None:
            v = pv["value"]
            if v == 0:
                target(0.0, "base", ("absolute", ABS0))
                s["policiesApplied"].append("ZERO_VALUE")
            elif it.get("unitStatus") == "NO_UNIT" and float(v).is_integer():
                target(v, "base", ("exact", 0))
                s["policiesApplied"].append("INTEGER_EXACT")
            else:
                target(PRECISE.get(pid, v) if "APPROX_SIGN" in flags else v, "base")
        if "NEGATIVE_VALUE" in flags:
            s["signRequired"] = True
            s["policiesApplied"].append("NEGATIVE_VALUE")
        if it.get("unitStatus") == "MISMATCH":
            s["policiesApplied"].append("UNIT_MISMATCH")
            s["notes"].append(f"so'ralgan '{it['askedUnit']}' = javobdagi '{pv.get('unit')}' (ekvivalent birlik qabul qilinadi)")
        if "SOURCE_KEY_DIFFERS" in flags:
            s["policiesApplied"].append("SOURCE_KEY_DIFFERS")
            s["notes"].append(f"manba kaliti {it['sourceKey']} — audit yakuniy javobi ustun")
        if pid in TABLE_CONST:
            s["policiesApplied"].append("TABLE_CONSTANT")
            s["notes"].append("jadval doimiysi: " + TABLE_CONST[pid] + " — muqobil jadval qiymatlari QO'SHILMAGAN (Sarvar aniq jadvalni aytsa qo'shiladi)")
        if "PI_APPROX_3" in flags and "PI_APPROX_3" not in s["policiesApplied"]:
            s["policiesApplied"].append("PI_APPROX_3")
        # holat
        if s["status"] is None:
            pending = []
            if "APPROX_SIGN" in flags and pid not in CALC and pid not in EXACT_FORM:
                pending.append("APPROX_ANSWER (siyosat berilmagan) — taklif: aniq qiymat ±1 %")
            if it.get("unitStatus") == "UNIT_NOT_ASKED":
                pending.append("UNIT_NOT_ASKED (30.09-B dan tashqari) — kiritish birligi siyosati kutilmoqda")
            if it.get("unitStatus") == "SCALED_UNIT":
                pending.append("SCALED_UNIT (siyosat berilmagan) — mantissa kiritiladimi")
            if "AUDIT_NOTE_STATUS" in flags and "SOURCE_KEY_DIFFERS" not in flags:
                s["notes"].append("audit: VERIFIED — ASSUMPTION STATED (1-bosqich qarorlari bilan qabul qilingan faraz)")
            if not s["targets"] and not s["acceptText"]:
                pending.append("maqsad qiymat aniqlanmadi")
            if pending:
                s["status"] = "PENDING_NO_POLICY"
                s["notes"] += pending
            else:
                s["status"] = "KEY_SPEC_READY"
        if "APPROX_SIGN" in flags and pid in PRECISE:
            shown = pv.get("value")
            s["precise"] = PRECISE[pid]
            if shown and abs(shown - PRECISE[pid]) <= REL * abs(PRECISE[pid]):
                s["notes"].append(f"ko'rsatilgan {shown:.6g} aniq qiymatning ±1 % ichida")
            elif shown:
                s["notes"].append(f"DIQQAT: ko'rsatilgan {shown:.6g} aniq qiymat {PRECISE[pid]:.6g} ning ±1 % idan tashqarida")
        specs.append(s)
    cnt = Counter(x["status"] for x in specs)
    pol = Counter(p for x in specs for p in set(x["policiesApplied"]))
    doc = {"schemaVersion": 1, "status": "DRAFT_PENDING_SARVAR", "appliedToDataset": False, "engineIntegrated": False,
           "policy": POLICY, "summary": {"parts": len(specs), "byStatus": dict(cnt), "byPolicy": dict(pol)}, "specs": specs}
    json.dump(POLICY, open(os.path.join(AUD, "sarvar-decisions-002-tolerance-policy.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(doc, open(os.path.join(AUD, "answer-key-spec.draft.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(doc)
    write_public(doc)
    print(json.dumps(doc["summary"], ensure_ascii=False, indent=1))


def fmt_t(t):
    tol = t["tolerance"]
    tt = {"relative": f"±{tol['value'] * 100:g} %", "absolute": f"±{tol['value']:g}", "exact": "aniq"}[tol["type"]]
    return f"{t['value']:.6g} {t['unit'] or ''} ({t['variant']}; {tt})".replace("  ", " ")


def write_md(doc):
    s = doc["summary"]
    L = ["# 36–45 ochiq javoblar — kalit spetsifikatsiyasi QORALAMASI (MAXFIY)", "",
         "Holat: **DRAFT_PENDING_SARVAR**. Dataset'ga yozilmagan, engine'ga ulanmagan. Siyosat: 08.10.2026, 2-qaror.", "",
         f"Qismlar: **{s['parts']}** · holatlar: " + ", ".join(f"{k} {v}" for k, v in sorted(s["byStatus"].items())), "",
         "Qo'llangan siyosatlar: " + ", ".join(f"{k} {v}" for k, v in sorted(s["byPolicy"].items())), "",
         "## 1. g / π variantlari — hisob formulalari (tekshirish uchun)", "",
         "| Qism | Yakuniy javob | Formula | Qabul qilinadigan qiymatlar |", "|---|---|---|---|"]
    for x in doc["specs"]:
        if x.get("calc"):
            L.append(f"| {x['partId'][5:]} | {(x['finalAnswerText'] or '—').replace('|', '/')} | {x['calc']['formula'].replace('|', '/')} | "
                     + "<br>".join(fmt_t(t) for t in x["targets"]) + " |")
    order = ["KEY_SPEC_READY", "NEEDS_MANUAL_REVIEW", "PENDING_NO_POLICY", "PENDING_INPUT_UNIT_POLICY", "PENDING_HIGH_REVIEW"]
    for st in order:
        rows = [x for x in doc["specs"] if x["status"] == st]
        L += ["", f"## {st} — {len(rows)} ta", "", "| Qism | Yakuniy javob | Maqsad(lar) | Matn shakllari | Siyosatlar | Izoh |", "|---|---|---|---|---|---|"]
        for x in rows:
            L.append(f"| {x['partId'][5:]} | {(x['finalAnswerText'] or '—').replace('|', '/')} | {'<br>'.join(fmt_t(t) for t in x['targets']) or '—'} | "
                     f"{', '.join(x['acceptText']) or '—'} | {', '.join(dict.fromkeys(x['policiesApplied'])) or 'SIMPLE_NUMERIC'}"
                     f"{' · ishora majburiy' if x['signRequired'] else ''} | {'; '.join(x['notes']).replace('|', '/') or '—'} |")
    open(os.path.join(AUD, "answer-key-spec.draft.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def write_public(doc):
    s = doc["summary"]
    L = ["# 36–45 ochiq javoblar — kalit spetsifikatsiyasi (ommaviy xulosa)", "",
         "Holat: **DRAFT_PENDING_SARVAR**. Javoblar bu faylda yo'q; to'liq: `_private/real-imtihonlar/audit/answer-key-spec.draft.{json,md}`.", "",
         "## Siyosat (Sarvar, 08.10.2026)", ""] + [f"- **{k}**: {v}" for k, v in doc["policy"].items() if k.isupper() or "_" in k] + [
         "", "## Holatlar", "", "| Holat | Soni |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byStatus"].items())] + [
         "", "## Qo'llangan siyosatlar", "", "| Siyosat | Qismlar |", "|---|---:|"] + [f"| {k} | {v} |" for k, v in sorted(s["byPolicy"].items())]
    open(os.path.join(ROOT, "docs", "real-imtihonlar", "08_answer_key_spec_summary.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
