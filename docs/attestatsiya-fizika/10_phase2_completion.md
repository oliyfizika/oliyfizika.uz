# 10 — 2-bosqich yakuni (Attestatsiya → Fizika: Data + Security + Import foundation)

Sana: 2026-10-02 · Branch: **`redesign/oliyfizika-2.0`** · HEAD `519037c` ("oliyfizika.uz 2.0") · Commit/push qilinmadi.

## 1. Bajarilgan ishlar

1. 1-bosqichning 5 hujjati va `daily_test_plan.json` source of truth sifatida olindi. Reja o'zgarmagan (planHash `00035719f689704f` qayta tekshirildi).
2. Repo tahlil qilindi: statik sayt (GitHub Pages), Firebase faqat Auth + Firestore, backend/Functions yo'q, `firebase.json` faqat rules/indexes.
3. 1027 savol manbalari to'liq topildi va 1:1 moslandi: `problems.json`, `.sol`, `.qtx`, `map.txt`, `% Also in`, rasmlar.
4. Normalization pipeline yaratildi: LaTeX → xavfsiz bloklar, `$…$` standarti, KaTeX validatsiya, TikZ → SVG, PNG → WebP.
5. Canonical bank: public (1027) va private (1027) alohida.
6. 32 Daily Test import-ready: meta + o'zgarmas snapshot + kalit + yechim (v1), `timeLimitSeconds 3600`, status `draft`.
7. Firestore Rules foundation (faqat qo'shimcha blok) va 3 indeks.
8. Lokal Rules interpretatori + 105 ssenariy + 32 kunlik simulyatsiya + dry-run import.
9. Raw material himoyasi: `.gitignore`.
10. Hisobotlar 06–10.

## 2. Yaratilgan fayllar

| Fayl | Git |
|---|---|
| `.gitignore` | yangi (untracked) |
| `tools/attestatsiya-fizika/texconv.py` | yangi |
| `tools/attestatsiya-fizika/prepare_attestation_data.py` | yangi |
| `tools/attestatsiya-fizika/rules/attestation_physics.rules.in` | yangi |
| `tools/attestatsiya-fizika/rules/build_rules.py` | yangi |
| `tools/attestatsiya-fizika/rules/rules_eval.py` | yangi |
| `tools/attestatsiya-fizika/rules/test_rules.py` | yangi |
| `assets/attestatsiya-fizika/fig/*` (407 rasm, 8.6 MB) | yangi, faqat savol rasmlari |
| `docs/attestatsiya-fizika/06_data_preparation_report.md` … `10_phase2_completion.md` | yangi |
| `docs/attestatsiya-fizika/pedagogika_baseline.sha256` | yangi (20 fayl hash bazasi) |
| `_private/attestatsiya-fizika/*` (questions.public/private, daily-tests, firestore-import, validation-report, rules-test-report, figures-manifest, solution-figures/, vendor/katex, .fig-cache/, _staging/) | **gitignored** |

## 3. O'zgartirilgan fayllar

| Fayl | O'zgarish |
|---|---|
| `firestore.rules` | **faqat qo'shimcha** (+282 qator, 0 o'chirilgan) — `>>> attestation-physics` blok; mavjud qoidalar baytma-bayt o'zgarmagan |
| `firestore.indexes.json` | **faqat qo'shimcha** (+3 indeks), mavjud 3 indeks o'zgarmagan |

Boshqa hech qanday tracked fayl o'zgartirilmadi. `.DS_Store` o'zgarishi macOS Finder'dan, oldindan bor edi.

## 4. Tegilmagan fayllar

- **Pedagogika (20 fayl):** `attestatsiya/pedagogika.html`, `attestatsiya/pedagogika-testlari/**` (index, test, quiz.js, style.css, data/test1–13.js), umumiy hub `attestatsiya/attestatsiya.html`, `attestatsiya/attestatsiya.css`.
- `attestatsiya/fizikaattestatsiya.html` (bo'sh, 3-bosqichda quriladi).
- `tools/attestatsiya-fizika/plan_daily_tests.py`, `docs/attestatsiya-fizika/` dagi 1-bosqich fayllari (md5 bir xil).
- Xom materiallar `attestatsiya/fizika/ATT_EST*` (faqat o'qildi).
- Mock test engine (`milliy-sertifikat/mock-testlar/**`), `results` kolleksiyasi va qoidasi, XP, progress, notification, admin, auth kodi, `firebase.json`, `js/firebase.js`.
- `Claude outputs/` (untracked, oldingi sessiyadan), `attestatsiya/.DS_Store`.

## 5. Acceptance criteria

| Mezon | Natija | Dalil |
|---|---|---|
| 1027 questions normalized | **PASS** | gate `questions_total_1027`, `conversion_errors_0`, KaTeX 16146/0 |
| 1027 unique IDs | **PASS** | `unique_ids_1027` (`AF-x-nnn`) |
| 865 auto | **PASS** | `eval_auto_865` |
| 81 open | **PASS** | `eval_open_81` |
| 81 unreliable | **PASS** | `eval_unreliable_81` |
| 32 Daily Tests | **PASS** | `daily_tests_32` |
| 1027/1027 assigned | **PASS** | `assigned_1027` |
| 0 duplicate assignments | **PASS** | `duplicate_assignment_0` |
| 0 missing questions | **PASS** | `missing_ids_0`, `unassigned_0` |
| all Daily Tests valid | **PASS** | 28/28 gate, dry-run 2183/2183 |
| all Daily Tests 26–38 questions | **PASS** | min 26, max 38 |
| all Daily Tests belong to one section | **PASS** | `tests_one_section` |
| public/private answer separation | **PASS** | `public_has_no_answer_fields`, alohida hujjatlar, Rules `attNoSecrets` |
| correctAnswer not exposed before submit | **PASS** | keys `in_progress` paytida DENY; snapshotda javob yo'q |
| solutions protected until solutionAvailableAt | **PASS** | 1 daqiqa oldin DENY, keyin ALLOW; submit'dan keyin ham DENY |
| draft Daily Tests protected | **PASS** | get/list/versions/savol — DENY |
| user can only access own attempts | **PASS** | boshqa user get/list/submit/grade — DENY |
| accessMode = open | **PASS** | settings + Rules `attCanAccess` |
| timezone = Asia/Tashkent | **PASS** | settings; solutionAvailableAt = 00:00 Toshkent |
| default time limit = 3600 | **PASS** | 32/32 test `timeLimitSeconds: 3600` |
| Pedagogy unchanged | **PASS** | 20/20 SHA-256 OK (§7) |
| dry-run import successful | **PASS** | §6 |
| Git status reported | **PASS** | §8 |
| raw solution/answer files not exposed publicly | **PASS** | `.gitignore` + `check-ignore` + leak grep (§8) |

## 6. Dry-run natijasi

```
Questions 1027 · Daily Tests 32 · Auto 865 · Open 81 · Unreliable 81
Assigned 1027 · Missing 0 · Duplicates 0 · Operations 2183/2183 · Validation PASS
Rules: 105/105 PASS · simulyatsiya 90/90 to'g'ri baholash qabul, 270/270 soxta natija rad
```

## 7. Pedagogika hash verification

1-bosqich boshida olingan bazaga nisbatan (`shasum -a 256 -c`), 2-bosqich oxirida: **20/20 UNCHANGED**.

```
attestatsiya/attestatsiya.css OK · attestatsiya/attestatsiya.html OK · attestatsiya/pedagogika.html OK
attestatsiya/pedagogika-testlari/{index.html, test.html, quiz.js, style.css} OK
attestatsiya/pedagogika-testlari/data/test1.js … test13.js OK (13/13)
```

Baza endi repo'da ham saqlandi: `docs/attestatsiya-fizika/pedagogika_baseline.sha256` (`shasum -a 256 -c` bilan tekshiriladi).

## 8. Git holati

- Branch: `redesign/oliyfizika-2.0`, HEAD `519037c`. Commit qilinmadi. Oldingi uncommitted holat saqlandi (`.DS_Store`, `Claude outputs/`).
- `git diff --stat`: `firestore.rules +282`, `firestore.indexes.json +24`, `.DS_Store` (macOS).
- Untracked (commit qilinishi mumkin, xavfsiz): `.gitignore`, `docs/attestatsiya-fizika/*`, `tools/attestatsiya-fizika/*`, `assets/attestatsiya-fizika/fig/*` (407).
- Ignored (commit qilinmaydi): `attestatsiya/fizika/ATT_EST/`, `attestatsiya/fizika/ATT_EST solutions/`, `_private/`, `__pycache__/`.
- `git log --all -- attestatsiya/fizika _private` → 0 commit: maxfiy materiallar Git tarixiga hech qachon tushmagan.

## 9. 3-bosqich: aniq vazifalar

**A. Deploy tayyorgarligi (siz bilan birga)**
1. Rules Playground'da 6 ta asosiy holatni sinash (08 §6.3). So'ng `firestore.rules` + indekslarni qo'lda deploy qilish.
2. `attestationAccess` ni admin "Kirish huquqlari" sahifasiga qo'shish (`adminAccessUpdate`) — PAID uchun, hozir shart emas.

**B. Admin "Attestatsiya → Fizika → Kunlik testlar"** (`admin/attestatsiya.html`, `assets/js/admin/attestation-*.js`)
3. Import: fayl tanlash → validatsiya (1027/32/865/81/81) → farq jadvali → batch yozish → read-back.
4. Jadval: Day · Mavzu · Savollar · Status · Publish date · Solution date · **[PUBLISH]** (tasdiq modali). `solutionAvailableAt` = ertasi 00:00 Toshkent avtomatik. Faqat keyingi Day'ni publish qilishga ruxsat (UI).
5. Archive, vaqt limitini o'zgartirish, natijalarni ko'rish va baholanmagan urinishlarni qayta baholash.

**C. Foydalanuvchi sahifalari** (`attestatsiya/fizikaattestatsiya.html` — hozir bo'sh, hub o'zgarmaydi)
6. Global kalendar: published testlar ro'yxati, "Bugungi test" (`now < solutionAvailableAt`), arxiv.
7. Test sahifasi: KaTeX (cdnjs) + blok renderer (`textContent`, `innerHTML` yo'q), 60 daqiqalik deadline taymer, javoblar localStorage qoralamasi, avto-submit.
8. Oqim: START → SUBMIT → kalitni o'qish → GRADE yozish → darhol natija (ball, to'g'ri/noto'g'ri, to'g'ri javob, "yechim ertaga 00:00 da ochiladi"). Ertasi kuni yechimlar.
9. Statistika: kunlik natijalar, bo'lim/mavzu foizi (`correctIds` + snapshot topic), o'rtacha/eng yuqori/eng past, jami/o'rtacha vaqt.

**D. Integratsiya va QA**
10. Bildirishnoma: published testlardan hosila "Bugungi attestatsiya testi tayyor!" (mavjud `notification-service` ga qo'shimcha manba, yangi kolleksiyasiz).
11. Yechimdagi 7 ta private chizmani `solutions` hujjatiga inline (data URI) qo'shish.
12. Regressiya, mobil, accessibility, Pedagogika hash, Rules testlari.

**Siz qaror qilishingiz kerak:** (1) savol rasmlari ommaviy URL'da qolsinmi yoki Firebase Storage'ga o'tkazilsinmi (08 §6.2); (2) vaqt limiti tugaganda submit qilinmagan urinish nima bo'lsin — hozir rasmiy natija bo'lmaydi, avto-submit buni oldini oladi.
