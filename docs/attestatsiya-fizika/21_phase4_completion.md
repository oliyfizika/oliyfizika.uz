# 21 — 4-bosqich yakuni: test natijalari, production migratsiya rejasi, rollback

Holat: **AUDIT → PLAN → IMPLEMENT → VALIDATE → DRY RUN bajarildi.** Production'ga hech narsa yozilmagan, hech narsa publish qilinmagan, commit/push qilinmagan.

## 1. Asosiy statistika

| Ko‘rsatkich | Qiymat |
|---|---|
| Savollar | 1027 (missing 0, duplicate 0) |
| Kunlik testlar | 32 (planHash `00035719f689704f` o‘zgarmagan) |
| Valid answer key | 865 |
| Tiklangan answer key | 62 (60 high, 2 medium — faraz yozilgan) |
| Hal qilinmagan (`TEKSHIRISH_KERAK`) | 100 — C 14 · D 24 · E 43 · F 12 · G 7 (18-hisobot) |
| Ballga kiradigan (`auto`) | 927 |
| KaTeX | 16 377 formula, 0 xato |
| Nested array | 0 |
| Rasm havolalari | 435 (408 savol + 27 yechim), topilmagan 0; render ma’lumoti 435/435 valid |
| LaTeX ↔ JSON mismatch | 0 |
| Yangi bundle | 2183 operatsiya, contentHash `a2f1ffd1678265e2` (production baseline `82732ed6914f0fe5`) |

## 2. Testlar

| To‘plam | Natija |
|---|---|
| `prepare_attestation_data.py` gate'lari | **40/40 PASS** |
| `tests/test_pipeline_gates.py` (salbiy testlar: buzilgan ma’lumotni ushlash) | **21/21 PASS** |
| `rules/test_rules.py` (Rules, dry-run import, simulyatsiya) | **127/127 PASS** |
| `e2e/e2e.mjs` (to‘liq user/admin oqimi, Storage rejimi) | **76/76 PASS** |
| `e2e/e2e_figures.mjs` (Firestore fallback, himoya, tiklangan savol, yechim rasmlari) | **13/13 PASS** |
| `migration_plan.py` (Rules dry-run + rollback) | **PASS** |
| Pedagogika hash | **20/20 OK** |

A–P talablari: A–D (1027/32/0/0) va F (KaTeX) — prepare; E (nested) — prepare + e2e + mock SDK; G–I (kalit, tiklash, distraktor) — prepare + salbiy testlar; J–K (rasm) — prepare + e2e_figures; L (LaTeX ↔ JSON) — `LATEX_JSON_CONSISTENCY`; M (public/private) — prepare + salbiy test; N–O (draft/published) — test_rules + e2e + migratsiya dry-run; P (Pedagogika) — hash.

## 3. Production migratsiya rejasi (tasdiqingizdan keyin)

Migratsiya fayli: `_private/attestatsiya-fizika/migration/migration.json` (1201 op, hash `2aeacee7708660da`). Hisobot: `…/migration/report.json`.

| Hujjatlar | Amal | Soni |
|---|---|---|
| `attestationPhysicsQuestions/{id}` (tiklangan savollar: variantlar, `evaluationType: auto`) | update | 62 |
| `…/private/answer` (`keyStatus` maydoni — additive; tiklanganlarda `correctAnswer`) | update | 1027 |
| `attestationPhysicsDailyTests/{t}` draft meta (scorable/open sonlari) | update | 23 |
| draft `versions/v1`, `keys/v1`, `solutions/v1` | update | 23 × 3 |
| `solutionFigures/{id}` (qayta ishlatilgan yechim rasmlari) | create | 20 |
| **Day 1 (published)** — meta, v1 snapshot/kalit/yechim | **tegilmaydi** | 4 |
| `attestationPhysicsSettings` | **tegilmaydi** | — |
| `attestationPhysicsAttempts` | **tegilmaydi** | — |

Dry-run (production holati simulyatsiyasi: baseline import + rasm hujjatlari + Day 1 published + real urinish; Rules orqali, admin):
1201/1201 ruxsat · Day 1 hujjatlari o‘zgarmadi · urinishlar o‘zgarmadi · sozlama o‘zgarmadi · hech narsa o‘chirilmadi · draft kunlar va savollar bankasi yangi bundle'ga teng · Day 1 v1 ni almashtirish Rules tomonidan rad etiladi · user Day 1 ni o‘qiydi, draft'ni o‘qiy olmaydi.

Day 1: canonical manbada 8 ta savol tiklandi, lekin production'dagi Day 1 v1 o‘zgarmaydi — u allaqachon e’lon qilingan va topshirilmoqda. Bankadagi savol hujjatlari yangilanadi; Day 1 sahifasi esa v1 snapshot'ni o‘qiydi, shuning uchun foydalanuvchiga ta’siri yo‘q. Day 1 uchun v2 ixtiyoriy va alohida tasdiq bilan qilinadi.

**Bajarish tartibi (keyingi bosqich):**

1. Kod deploy: `api.js` va `attestation-fizika.js` (git; quyidagi ro‘yxat).
2. Admin sahifada rasm manbaini `firestore` ga o‘tkazish: yangi tugma avval rasm hujjatlarini tekshiradi. Shu bilan Day 1 rasmlari darhol tuzaladi.
3. Migratsiyani qo‘llash. Admin sahifada migratsiya faylini yuklash funksiyasi hali yo‘q; tasdiqlansa, alohida, preflight + Rules dry-run bilan qo‘shiladi.
4. Smoke-test: user Day 1 rasmlari; draft kun admin preview; e2e ro‘yxati bo‘yicha.

## 4. Rollback rejasi

| Qatlam | Rollback |
|---|---|
| Firestore | `_private/attestatsiya-fizika/migration/rollback.json` — 1181 update (baseline holati). Dry-run'da baseline'ga to‘liq qaytdi. 20 ta yangi `solutionFigures` hujjati qoladi (Rules delete'ni taqiqlaydi; zararsiz) |
| Sozlama | admin tugmasi bilan `figureBackend` ni qaytarish (bitta maydon) |
| Canonical LaTeX | `_private/attestatsiya-fizika/_staging/latex-backup-<vaqt>/` (chapters, *.sol, problems.json) → joyiga nusxa → `latex_canonical.py check` |
| Kod | alohida commit'lar → `git revert` |

## 5. O‘zgargan fayllar (git'ga tushadiganlar)

`assets/js/attestatsiya-fizika/api.js`, `assets/js/admin/attestation-fizika.js`, `tools/attestatsiya-fizika/{prepare_attestation_data.py, latex_canonical.py (yangi), answer_keys.py (yangi), migration_plan.py (yangi), reports_phase4.py (yangi), diag/figure_diagnostic.js (yangi), tests/test_pipeline_gates.py (yangi), rules/test_rules.py, e2e/e2e.mjs, e2e/e2e_figures.mjs (yangi), e2e/sdk/firebase-firestore.js}`, `docs/attestatsiya-fizika/16–21`.

Git'ga tushmaydigan (gitignore): canonical LaTeX (`attestatsiya/fizika/ATT_EST solutions/…` — chapters/*.tex, answers.tex, *.sol, problems.json), `_private/…` (qarorlar, bundle, migratsiya, maxfiy hisobotlar).

**Diqqat:** canonical LaTeX manba git'da emas. Uni alohida xususiy repoda yoki zaxira bilan saqlash tavsiya etiladi.

## 6. O‘zgarmagan muhim fayllar

`firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `render.js`, `texconv.py`, `plan_daily_tests.py`, `daily_test_plan.json`, Pedagogika (20/20), test engine, natija/statistika, yechim ochilish vaqti, nested-array fix (`fs_canonical`, `itemBlocks/rowCells`, preflight, mock validator).

## 7. Hal qilinmagan (yashirilmaydi)

100 ta savol `TEKSHIRISH_KERAK` holatida: ballga kirmaydi, `correctAnswer` yo‘q, sababi ID bilan 18-hisobotda. Ularni avtomatik tuzatib bo‘lmaydi: manba sharti to‘liq emas, variantlarda to‘g‘ri qiymat yo‘q, ikki talqin bor yoki rasm talqiniga bog‘liq. Har biri uchun taklif (masalan, variant birligini tuzatish) maxfiy hisobotda; qo‘llash faqat sizning tasdig‘ingiz bilan, LaTeX'da.
