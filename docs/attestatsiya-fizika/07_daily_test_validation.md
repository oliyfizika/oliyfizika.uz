# 07 — Daily Test validatsiyasi (Attestatsiya → Fizika, 2-bosqich)

Sana: 2026-10-02 · Manba: `_private/attestatsiya-fizika/validation-report.json` (`prepare_attestation_data.py`) va `rules-test-report.json` (`test_rules.py`). Reja **o'zgartirilmagan**: `daily_test_plan.json` planHash `00035719f689704f` qayta hisoblandi va mos keldi.

**Umumiy holat: PASS**

## 1. Coverage va audit

| Ko'rsatkich | Qiymat | Kutilgan | Natija |
|---|---:|---:|---|
| Savollar (bank) | 1027 | 1027 | PASS |
| Unique ID | 1027 | 1027 | PASS |
| Daily Testlar | 32 | 32 | PASS |
| Biriktirilgan | 1027 | 1027 | PASS |
| Biriktirilmagan (missing) | 0 | 0 | PASS |
| Ikki marta biriktirilgan | 0 | 0 | PASS |
| auto | 865 | 865 | PASS |
| open | 81 | 81 | PASS |
| unreliable | 81 | 81 | PASS |
| auto + open + unreliable | 1027 | 1027 | PASS |
| KaTeX bilan tekshirilgan formulalar | 16146 | — | PASS (0 xato) |

Takrorlar: PDF'lardan ajratilgan 1167 savoldan 140 tasi 1-bosqichdan oldin birlashtirilgan; ularning manbalari har bir savolning `source.alsoIn` maydonida saqlangan (jami 140 yozuv, 126 savolda). Hozirgi bankda aniq matn va fingerprint bo'yicha takror: 0.

## 2. Validatsiya darvozalari (import oldidan majburiy)

| Gate | Natija | Izoh |
|---|---|---|
| `questions_total_1027` | PASS | 1027 |
| `unique_ids_1027` | PASS | 1027 |
| `missing_ids_0` | PASS | [] |
| `duplicate_ids_0` | PASS |  |
| `eval_auto_865` | PASS | 865 |
| `eval_open_81` | PASS | 81 |
| `eval_unreliable_81` | PASS | 81 |
| `eval_sum_1027` | PASS |  |
| `daily_tests_32` | PASS | 32 |
| `assigned_1027` | PASS | 1027 |
| `duplicate_assignment_0` | PASS |  |
| `unassigned_0` | PASS | [] |
| `all_question_ids_in_bank` | PASS |  |
| `keys_auto_only_865` | PASS |  |
| `tests_26_38` | PASS |  |
| `tests_one_section` | PASS |  |
| `day_numbers_1_32` | PASS |  |
| `plan_unchanged` | PASS | 00035719f689704f |
| `auto_has_valid_answer` | PASS |  |
| `non_auto_not_scored` | PASS |  |
| `every_question_has_solution` | PASS |  |
| `difficulty_mapped` | PASS |  |
| `source_traceable` | PASS |  |
| `public_has_no_answer_fields` | PASS | set() |
| `public_figures_only_from_questions` | PASS |  |
| `conversion_errors_0` | PASS | 0 |
| `katex_all_formulas_ok` | PASS | 16146 formula, 0 xato |
| `firestore_doc_size_ok` | PASS | max 41085 bayt |

Bittasi FAIL bo'lsa skript nol bo'lmagan kod bilan to'xtaydi va `firestore-import.json` yozilmaydi.

## 3. 32 kun

| Day | testId | Bo'lim | Mavzular | Savol | auto | open | unreliable | Qiyinlik e/m/h/x | Limit | Status |
|---:|---|---|---|---:|---:|---:|---:|---|---:|---|
| 1 | `att-fizika-day-01` | Mexanika | Kinematika | 32 | 23 | 8 | 1 | 20/12/0/0 | 60 daq | draft |
| 2 | `att-fizika-day-02` | Mexanika | Kinematika | 33 | 28 | 1 | 4 | 0/18/13/2 | 60 daq | draft |
| 3 | `att-fizika-day-03` | Mexanika | Dinamika | 35 | 30 | 4 | 1 | 6/16/13/0 | 60 daq | draft |
| 4 | `att-fizika-day-04` | Mexanika | Statika | 32 | 30 | 2 | 0 | 6/17/8/1 | 60 daq | draft |
| 5 | `att-fizika-day-05` | Mexanika | Ish, energiya, quvvat | 32 | 29 | 1 | 2 | 6/21/5/0 | 60 daq | draft |
| 6 | `att-fizika-day-06` | Mexanika | Ish, energiya, quvvat, Impuls, Gravitatsiya | 33 | 27 | 4 | 2 | 10/8/13/2 | 60 daq | draft |
| 7 | `att-fizika-day-07` | Mexanika | Suyuqlik va gazlar mexanikasi, Tebranish va to‘lqinlar | 36 | 29 | 3 | 4 | 16/13/6/1 | 60 daq | draft |
| 8 | `att-fizika-day-08` | Mexanika | Tebranish va to‘lqinlar | 36 | 31 | 3 | 2 | 2/23/9/2 | 60 daq | draft |
| 9 | `att-fizika-day-09` | Molekulyar fizika va termodinamika | Molekulyar-kinetik nazariya, Ideal gaz va gaz qonunlari | 38 | 33 | 4 | 1 | 15/15/8/0 | 60 daq | draft |
| 10 | `att-fizika-day-10` | Molekulyar fizika va termodinamika | Ideal gaz va gaz qonunlari, Termodinamika, Issiqlik mashinalari, Entropiya | 38 | 30 | 4 | 4 | 8/12/13/5 | 60 daq | draft |
| 11 | `att-fizika-day-11` | Molekulyar fizika va termodinamika | Issiqlik almashinuvi | 33 | 26 | 5 | 2 | 13/12/8/0 | 60 daq | draft |
| 12 | `att-fizika-day-12` | Elektromagnetizm | Elektrostatika | 32 | 25 | 5 | 2 | 17/15/0/0 | 60 daq | draft |
| 13 | `att-fizika-day-13` | Elektromagnetizm | Elektrostatika | 33 | 29 | 3 | 1 | 0/13/19/1 | 60 daq | draft |
| 14 | `att-fizika-day-14` | Elektromagnetizm | Doimiy tok va elektr zanjirlari | 31 | 28 | 3 | 0 | 17/14/0/0 | 60 daq | draft |
| 15 | `att-fizika-day-15` | Elektromagnetizm | Doimiy tok va elektr zanjirlari | 32 | 29 | 2 | 1 | 0/17/13/2 | 60 daq | draft |
| 16 | `att-fizika-day-16` | Elektromagnetizm | Magnit maydon | 31 | 27 | 3 | 1 | 20/11/0/0 | 60 daq | draft |
| 17 | `att-fizika-day-17` | Elektromagnetizm | Magnit maydon | 31 | 27 | 1 | 3 | 0/6/16/9 | 60 daq | draft |
| 18 | `att-fizika-day-18` | Elektromagnetizm | Elektromagnit induksiya | 30 | 28 | 0 | 2 | 11/12/7/0 | 60 daq | draft |
| 19 | `att-fizika-day-19` | Elektromagnetizm | Elektromagnit induksiya, O‘zgaruvchan tok | 31 | 28 | 2 | 1 | 18/1/8/4 | 60 daq | draft |
| 20 | `att-fizika-day-20` | Elektromagnetizm | O‘zgaruvchan tok, Elektromagnit tebranishlar va to‘lqinlar | 31 | 27 | 2 | 2 | 9/14/8/0 | 60 daq | draft |
| 21 | `att-fizika-day-21` | Optika | Geometrik optika, Yorug‘likning qaytishi va sinishi | 38 | 30 | 2 | 6 | 13/11/13/1 | 60 daq | draft |
| 22 | `att-fizika-day-22` | Optika | Linzalar | 27 | 25 | 2 | 0 | 9/11/6/1 | 60 daq | draft |
| 23 | `att-fizika-day-23` | Optika | Ko‘zgular, Interferensiya, Difraksiya, Polarizatsiya | 36 | 32 | 1 | 3 | 10/8/16/2 | 60 daq | draft |
| 24 | `att-fizika-day-24` | Atom va yadro fizikasi | Atom fizikasi, Kvant fizikasi, Fotoeffekt, Kompton effekti | 31 | 26 | 2 | 3 | 18/9/4/0 | 60 daq | draft |
| 25 | `att-fizika-day-25` | Atom va yadro fizikasi | Bor modeli, Spektrlar | 28 | 26 | 0 | 2 | 9/14/5/0 | 60 daq | draft |
| 26 | `att-fizika-day-26` | Atom va yadro fizikasi | Radioaktivlik, Yadro reaksiyalari | 26 | 22 | 3 | 1 | 19/6/1/0 | 60 daq | draft |
| 27 | `att-fizika-day-27` | Atom va yadro fizikasi | Yadro reaksiyalari, Yadro fizikasi | 26 | 18 | 1 | 7 | 12/9/5/0 | 60 daq | draft |
| 28 | `att-fizika-day-28` | Maxsus mavzular | Maxsus nisbiylik nazariyasi, Astronomiya | 32 | 29 | 1 | 2 | 23/6/2/1 | 60 daq | draft |
| 29 | `att-fizika-day-29` | Maxsus mavzular | Astronomiya | 33 | 21 | 9 | 3 | 29/4/0/0 | 60 daq | draft |
| 30 | `att-fizika-day-30` | Maxsus mavzular | O‘lchash va birliklar, Fizika o‘qitish metodikasi | 30 | 28 | 0 | 2 | 26/4/0/0 | 60 daq | draft |
| 31 | `att-fizika-day-31` | Maxsus mavzular | Fizika o‘qitish metodikasi | 30 | 27 | 0 | 3 | 30/0/0/0 | 60 daq | draft |
| 32 | `att-fizika-day-32` | Maxsus mavzular | Fizika o‘qitish metodikasi, Boshqa mavzular | 30 | 17 | 0 | 13 | 23/7/0/0 | 60 daq | draft |
| **Jami** | | | | **1027** | **865** | **81** | **81** | | | |

- Har bir kun 26–38 oralig'ida: min 26, max 38 — PASS
- Har bir kun bitta bo'lim ichida (savollarning `section` maydoni bo'yicha qayta tekshirildi) — PASS
- 1-bosqich istisnolari saqlangan: Ideal gaz (Day 9–10), O'zgaruvchan tok (Day 19–20), Day 23 Ko'zgular + to'lqin optikasi — reja fayli o'zgarmagan
- Day 32 da 13 ta baholanmaydigan (unreliable) savol bor — bu kunda ball 17 ta savoldan hisoblanadi; 3-bosqichda admin bu savollarni ko'rib chiqsa, v2 orqali `auto` ga o'tkazish mumkin

## 4. Firestore hujjat o'lchamlari

Eng katta hujjatlar (1 MiB chegara):

- `att-fizika-day-21/solutions/v1` — 40.1 KB
- `att-fizika-day-17/solutions/v1` — 36.2 KB
- `att-fizika-day-23/solutions/v1` — 35.8 KB
- `att-fizika-day-10/solutions/v1` — 35.5 KB
- `att-fizika-day-21/versions/v1` — 34.5 KB

## 5. Dry-run import va Rules testlari

- Dry-run: **PASS** — 2183/2183 operatsiya admin sifatida repo `firestore.rules` orqali o'tdi; rad etilgan: 0.
- Yaratiladigan hujjatlar: `attestationPhysicsSettings` 1, `attestationPhysicsQuestions` 1027, `attestationPhysicsQuestions/*/private` 1027, `attestationPhysicsDailyTests` 32, `…/versions` 32, `…/keys` 32, `…/solutions` 32
- Rules ssenariylari: **105/105 PASS**; bitta so'rovdagi eng ko'p get(): 4 (chegara 10); eng og'ir so'rov ≈284 ifoda tuguni (chegara 1000).
- Simulyatsiya: 30 kun × 3 foydalanuvchi — to'g'ri baholash 90/90 qabul qilindi; soxta natija 270/270 rad etildi.

Batafsil ssenariylar: `09_firestore_import_report.md` §6.
