# 16 — 4-bosqich rejasi: data sifati, rasm pipeline, LaTeX canonical sinxron

Sana: 2026-10-03 · Branch: `redesign/oliyfizika-2.0` (HEAD e396c94) · Holat: **AUDIT → PLAN** (kod hali o'zgartirilmagan).
Hisobot raqamlari: so'rovdagi `07_/08_/09_` nomlari mavjud fayllar (07_daily_test_validation, 08_security_report, 09_firestore_import_report) bilan to'qnashadi, shuning uchun 16–21 ishlatiladi.

## 0. Audit natijasi (kodga tegmasdan)

| Narsa | Joyi | Topilgan holat |
|---|---|---|
| Canonical LaTeX — savollar | `attestatsiya/fizika/ATT_EST solutions/chapters/*.tex` (masalablok + `% Answer:` sarlavhasi) | 1027 blok; `problems.json` `tex` maydoni bilan **1027/1027 bir xil** |
| Canonical LaTeX — yechimlar | `…/_build/solutions_src/C*.sol` (`%%% S` sarlavha: status/result/book/verify + `%%% BODY`) | 1027/1027, pipeline to'g'ridan-to'g'ri o'qiydi |
| Oraliq JSON | `…/_build/solutions_src/problems.json` | Hozir pipeline **savol matnini shu yerdan** o'qiydi — LaTeX'dan hosil qilingan nusxa, lekin sinxronligi tekshirilmaydi |
| Xom ajratma | `…/_build/extract/F*.qtx` (1167 blok, dublikatlar bilan) | Canonical emas (tahrirdan oldingi matn); faqat qiyinlik/sahifa metadata uchun |
| Parser | `tools/attestatsiya-fizika/texconv.py` | LaTeX → bloklar |
| Generator | `tools/attestatsiya-fizika/prepare_attestation_data.py` | gate'lar, bundle, rasm staging |
| Rasm | `ATT_EST solutions/images` (136 png) + TikZ (271+7) → `_private/…/figures/{question,solution}` (408+7) | Firestore fallback: `attestationPhysicsDailyTests/{t}/{figures|solutionFigures}/{hash}` (`data` base64, `mime`) |
| Render | `assets/js/attestatsiya-fizika/render.js` → `api.figureUrl()` | `figureBackend` sozlamasi bo'yicha Storage `getBlob` yoki Firestore `getDoc` → Blob → `URL.createObjectURL` |
| Answer key | `.sol` `result` (harf) → `scoring_of()` → `correctAnswer` faqat `auto` savollarda | |

**Answer key holati (1027):** 865 `auto` — hammasi izchil (yechim natijasi = kalit, 856 tasi kitob kaliti bilan ham mos, 9 tasi yangi hisoblangan). 81 `open` (variantsiz, kalitsiz). 81 `unreliable` (variant bor, lekin manba xatosi yoki aniqlanmagan).

**Rasm muammosi:** kod yo'li mock'da to'liq ishlaydi (Firestore fallback, Day 1: 16/16 rasm, desktop + mobil). Jonli JS/CSS repo bilan bayt-bayt bir xil, CSP yo'q. Sabab faqat tizimga kirilgan production sessiyada ko'rinadi → faqat o'qiydigan diagnostika (17-hisobot) kerak. **Root cause topilmaguncha render/rasm kodi o'zgartirilmaydi.**

## 1. Root cause (hozirgacha)

1. Rasm: hali aniqlanmagan — production diagnostikasi kutilmoqda (17-hisobot).
2. Answer key: 81 savol manbada variantsiz berilgan va pipeline ularni `open` qiladi (ballga kirmaydi). 81 savolda esa manba variantlari/kaliti xato yoki noaniq.
3. LaTeX canonical: pipeline savol matnini LaTeX'dan emas, oraliq `problems.json` dan oladi va ular orasidagi sinxronlik tekshirilmaydi. LaTeX'da tuzatish qilinsa, `problems.json` eskirib qolishi mumkin.

## 2. O'zgartiriladigan fayllar

| Fayl | O'zgarish |
|---|---|
| `tools/attestatsiya-fizika/latex_canonical.py` (yangi) | chapters/*.tex + .sol parser; `check` (LaTeX ↔ problems.json) va `sync` (LaTeX → problems.json, faqat bir yo'nalish) |
| `tools/attestatsiya-fizika/apply_answer_keys.py` (yangi) | Tasdiqlangan qarorlarni canonical LaTeX'ga yozadi (zaxira nusxa + diff), so'ng `sync` |
| `tools/attestatsiya-fizika/prepare_attestation_data.py` | Yangi gate'lar: `latex_json_consistency`, `answer_key_*`, `distractor_*`, `image_refs_*`; kutilgan hisoblar qattiq kodlangan emas, qarorlardan olinadi |
| `tools/attestatsiya-fizika/migration_plan.py` (yangi) | Production baseline bundle ↔ yangi bundle diff → additive migratsiya operatsiyalari + Rules dry-run |
| `tools/attestatsiya-fizika/rules/test_rules.py` | Dry-run hisoblari validation report'dan olinadi |
| `assets/js/admin/attestation-fizika.js` | Import tekshiruvi 865 ni qattiq kodlamaydi (bundle'dagi hisob bilan solishtiradi) |
| `tools/attestatsiya-fizika/e2e/*` | Firestore fallback rejimi E2E; hisoblar dinamik |
| Canonical source (gitignore, `_private` emas): `chapters/*.tex`, `chapters/answers.tex`, `_build/solutions_src/*.sol`, `problems.json` | Faqat tasdiqlangan answer-key tiklashlari (zaxira nusxa bilan) |
| `render.js` / `api.js` | **Faqat** rasm root cause'i shu fayllarda bo'lsa, minimal tuzatish |

## 3. O'zgartirilmaydigan fayllar

Pedagogika (20 fayl, `pedagogika_baseline.sha256`); `firestore.rules`; `storage.rules`; `firestore.indexes.json`; `firebase.json`; `texconv.py` (parser xatti-harakati); `plan_daily_tests.py` va `daily_test_plan.json` (planHash `00035719f689704f`); nested-array fix (`fs_canonical`, `itemBlocks/rowCells`, preflight, mock SDK validator); test engine, natija, statistika va yechim vaqti mantig'i; boshqa kurslar, `results`, XP.

## 4. Data migratsiya ta'siri

- Savol ID'lari o'zgarmaydi (`AF-{bob}-{nnn}`). Kun taqsimoti o'zgarmaydi.
- Faqat additive/update: tiklangan savollarda `options` qo'shiladi, `evaluationType: open → auto`, `correctAnswer` faqat private/key'da.
- **Day 1 (published)**: Rules v1 snapshot'ni qulflaydi. Day 1'da 8 ta tiklanadigan savol bor. Tavsiya: Day 1 v1 o'zgarmaydi (topshirilgan urinishlar shu versiyaga bog'liq). Ixtiyoriy v2 faqat alohida tasdiq bilan.
- Day 2–32 (draft): `versions/keys/solutions v1` va test meta Rules bo'yicha yangilanadi (draft → draft).
- `attestationPhysicsQuestions/{id}` va `private/answer`: `set` bilan yangilanadi (o'chirish yo'q).
- `attestationPhysicsAttempts` — **tegilmaydi**.
- Production'ga hech narsa yozilmaydi: migratsiya fayli yaratiladi va mock + Rules'da dry-run qilinadi.

## 5. Answer key tiklash strategiyasi

Kategoriyalar (har savol aniq bittasiga): **A** valid · **B** kalit yo'q + yechim bor · **C** kalit yo'q + yechim yo'q · **D** noaniq · **E** kalit/yechim/shart ziddiyatli · **F** savol/variant noto'g'ri · **G** rasmga bog'liq va hal qilinmagan.

- **B → tiklanadi**: faqat yechim natijasi bir qiymatli bo'lsa va faqat shartdagi ma'lumot hamda standart konstantalar (g, Yer radiusi, e, h, c, N_A, k, jadvaldagi E po'lat) ishlatilgan bo'lsa.
- Variantlar: to'g'ri javob + 3 ta distraktor. Har distraktor uchun aniq sabab yoziladi: tipik hisob xatosi (½ tushib qolgan, sin/cos almashgan, birlik o'tkazish, ishora) yoki konseptual xato (massa ↔ og'irlik, I qonun ↔ II qonun). Tasodifiy son yo'q, boshqa savoldan ko'chirma yo'q.
- Avtomatik tekshiruv: 4 ta noyob variant; birliklar bir xil; to'g'ri variant yechimdagi qiymatga teng; raqamli distraktorlar to'g'ridan ≥3 % farq qiladi va o'zaro farqli; boshqa savol variantlari bilan aynan mos emas; KaTeX toza.
- Yechimdagi «variantlar berilmagan» degan iboralar yangilanadi; `\javob{}` qatoriga harf qo'shiladi; asl qiymat `.sol` sarlavhasida (`keySource: reconstructed`, `keyValue`) saqlanadi.
- **D/E/F/G va C → tiklanmaydi**: `TEKSHIRISH_KERAK`, ID va sabab bilan hisobotda; taklif (masalan, variant birligini tuzatish) faqat sizning tasdig'ingizdan keyin qo'llanadi.

## 6. Rasm pipeline tuzatish

1. Production'da faqat o'qiydigan diagnostika (siz tizimga kirgandan keyin): `settings.figureBackend`, test holati, `figures/{hash}` mavjudligi va hajmi, Rules natijasi, Blob → `<img>` yuklanishi.
2. Root cause bo'yicha minimal tuzatish va unga regression test.
3. Firestore fallback arxitektura bahosi: hujjat hajmi (eng kattasi 326 KB, jami 11.6 MB), Day bo'yicha yuklanish hajmi, kesh (Blob kesh faqat sahifa ichida), mobil yuklanish narxi; Storage audit — alohida.

## 7. LaTeX canonical sinxron

- Yo'nalish faqat: `chapters/*.tex` + `.sol` → `latex_canonical.py sync` → `problems.json` → `prepare` → bundle → (tasdiqdan keyin) Firestore.
- `prepare` boshida gate: `LATEX_JSON_CONSISTENCY` (LaTeX ↔ problems.json ↔ public ↔ private: matn, formulalar, variantlar, rasm havolalari, ID, `correctAnswer`, yechim, manba metadata). FAIL bo'lsa bundle yozilmaydi.
- Firestore yoki admin paneldagi qo'lda tahrir canonical hisoblanmaydi. Keyingi importda LaTeX'dagi qiymat yoziladi.

## 8. Validatsiya

So'rovdagi A–P testlarining hammasi `prepare` gate'lari, `test_rules.py` va E2E'ga qo'shiladi, keyin hammasi qayta ishga tushiriladi. Pedagogika hash'i oldin va keyin tekshiriladi.

## 9. Rollback

- Canonical LaTeX: tahrirdan oldingi to'liq nusxa `_private/attestatsiya-fizika/_staging/latex-backup-<sana>/` ga olinadi + diff. Qaytarish = nusxani joyiga qo'yish va `sync`.
- Bundle: production baseline (`82732ed6914f0fe5`) saqlanadi.
- Kod: kichik, alohida commit'lar (`git add .` yo'q). Revert faqat shu commit'lar.
- Production: migratsiya faqat `set`/update qiladi. Baseline bundle'dan teskari migratsiya fayli yaratiladi (oldingi hujjat holatlari). Attempts'ga tegilmaydi.
