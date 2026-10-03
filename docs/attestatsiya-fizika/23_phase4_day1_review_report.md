# 23 — 4-bosqich (4A–4D): Day 1 canonical versiya + natijani ko‘rib chiqish — hisobot

Holat: lokal implementatsiya, testlar va migratsiya dry-run tayyor. **Production'ga yozilmagan, publish qilinmagan, natijalar o‘chirilmagan, commit/push yo‘q.** 4E (production) — alohida tasdiq bilan.

## 1. O‘zgargan fayllar

| Fayl | O‘zgarish |
|---|---|
| `assets/js/attestatsiya-fizika/test-page.js` | Natija sahifasi: «Javoblarni ko‘rib chiqish» kartalari; urinish versiyasi snapshot'i; eski sxema (`selectedAnswers`, `testVersion` yo‘q); kalit o‘qilmasa ham xatosiz |
| `assets/js/attestatsiya-fizika/core.js` | `questionStatus` — `correctIds/wrongIds` bo‘lmagan eski urinishlarga chidamli (1 qator) |
| `assets/js/attestatsiya-fizika/solutions-page.js` | Har bir yechim kartasiga `id="sol-<savol>"` (review'dan to‘g‘ridan-to‘g‘ri havola) |
| `assets/css/attestatsiya.css` | Review kartasi, saralash, variant belgilari, mobil (faqat qo‘shimcha qoidalar) |
| `admin/attestatsiya-fizika.html`, `assets/js/admin/attestation-fizika.js` | «3. Canonical yangilanish (migratsiya)»: preflight (format, ruxsat etilgan yo‘llar, nested array, published kun urinishlari: soni/userlar/holat) va idempotent qo‘llash |
| `tools/attestatsiya-fizika/migration_plan.py` | Published kun uchun versiyalash (v{n+1} + meta patch, rollback v{n+2}); kengaytirilgan dry-run |
| `tools/attestatsiya-fizika/e2e/e2e.mjs` | Review markup'iga moslash; sekundomer tolerantligi ±1 s |
| `tools/attestatsiya-fizika/e2e/e2e_review.mjs` (yangi) | A–O ssenariylari (38 tekshiruv) |
| `docs/attestatsiya-fizika/22_…`, `23_…` | Reja va hisobot |

Oldingi qadamdagi (17–21) o‘zgarishlar ham hali commit qilinmagan: `api.js`, admin rasm manbai tugmasi, tools va docs.

## 2. Himoyalangan (o‘zgarmagan) fayllar

`firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `render.js`, `texconv.py`, `plan_daily_tests.py`, `daily_test_plan.json`, test engine (savol ishlash, submit, baholash — `api.js` grade/submit o‘zgarmagan), Pedagogika **20/20**, nested-array fix. Canonical LaTeX bu qadamda o‘zgartirilmadi (62 ta tiklash 4-bosqichda qilingan).

## 3. Day 1 migratsiya ta’siri

- **Rules published testni draft'ga qaytarishga ruxsat bermaydi** va o‘chirishni taqiqlaydi. Rules'ga tegmasdan yagona yo‘l — **versiya**: `versions/keys/solutions/v2` (canonical) + meta `currentVersion: 2`.
- v2 farqi: 8 ta tiklangan savol (AF-1-005, 009, 010, 014, 024, 025, 026, 031) — A–D variantlar va kalit. Scorable **23 → 31**. AF-1-018 `TEKSHIRISH_KERAK` (ballga kirmaydi). Rasmlar o‘zgarmagan (16 ta).
- Yechim vaqti: qayta e’lon vaqtidan keyingi 00:00 (Toshkent). Admin'da belgilash bilan (standart — yoqilgan). Aks holda v1 muddati o‘tgan bo‘lsa, Day 1 rasmiy topshirishga yopiq qolardi.
- **Mavjud urinishlar o‘zgarmaydi va o‘chirilmaydi.** Ular v1 da qoladi va review v1 snapshot bilan ko‘rsatiladi (ball ham o‘zgarmaydi). Real userlar bo‘lsa ham shu yo‘l xavfsiz — boshqa strategiya kerak emas.
- **Production'dagi Day 1 urinishlari hali sanalmagan:** Rules urinishlar ro‘yxatini faqat admin'ga beradi, men esa faqat oddiy user sessiyasini ko‘rdim (u akkauntda Day 1 urinishi yo‘q). Admin sahifadagi migratsiya preflight'i qo‘llashdan oldin buni avtomatik ko‘rsatadi: urinishlar soni, userlar soni, holatlar va uid oxiri. Jadvaldagi «Urinishlar» ustuni ham shuni beradi.
- Rasmiy urinish bitta: v1 ni topshirgan akkaunt v2 ni qayta topshira olmaydi (`{uid}__{testId}`). Day 1 v2 ni sinash uchun **Day 1 ni topshirmagan akkaunt** kerak.

## 4. Natijani ko‘rib chiqish (result review)

- Xulosa: ball, foiz, to‘g‘ri / noto‘g‘ri / javobsiz, sarflangan vaqt.
- **«Javoblarni ko‘rib chiqish»** — har savol ochiq karta:
  - «N-savol», mavzu, holat: «✓ To‘g‘ri» / «✗ Noto‘g‘ri» / «Siz javob bermadingiz» / «Ballga kirmaydi»;
  - savol matni, formulalar, jadval, rasm, barcha variantlar;
  - foydalanuvchi variantida «Sizning javobingiz» (ko‘k chegara, noto‘g‘ri bo‘lsa qizil), to‘g‘ri variantda «To‘g‘ri javob» (yashil);
  - pastda «Sizning javobingiz: X · To‘g‘ri javob: Y» (yoki «Siz javob bermadingiz»);
  - «🔒 To‘liq yechim · 4-oktabr, 00:00 da ochiladi», ochilgach — shu savol yechimiga havola.
- Saralash: Hammasi / Noto‘g‘ri / Javobsiz / To‘g‘ri. Karta ichi ko‘rinishga yaqinlashganda chiziladi (32 savol, rasmlar lazy).
- **Xavfsizlik:**
  - test davomida kalit so‘ralmaydi va DOM'da belgi yo‘q (E2E: 0 so‘rov, 0 belgi);
  - kalitni faqat o‘z urinishi `submitted|graded` bo‘lganda Rules beradi;
  - to‘liq yechim so‘ralmaydi (Rules uni `solutionAvailableAt` gacha baribir rad etadi).
- Holat va ball urinishda saqlangan Rules tasdiqlagan qiymatlardan olinadi, qayta hisoblanmaydi.
- **Versiya va eski natijalar:**
  - review urinish topshirilgan versiya snapshot'ini (`testVersion`) ishlatadi, shuning uchun savol keyin o‘zgarsa ham eski review buzilmaydi;
  - `selectedAnswers` sxemasi qo‘llab-quvvatlanadi;
  - `testVersion` yo‘q urinish joriy versiya bilan ko‘rsatiladi; Rules kalit bermaydi, shuning uchun «to‘g‘ri javob ma’lumoti mavjud emas» deb yoziladi va ball o‘zgarmaydi.
- **Yangi urinishlar:** `testVersion` allaqachon saqlanadi (Rules start'da talab qiladi). Alohida savol nusxasi saqlash shart emas, chunki versiya snapshot'lari o‘zgarmas (Rules).

## 5. Rasm tuzatishi

17-hisobotdagi root cause: production'da `figureBackend = "storage"`, Storage ishlamaydi. Kodda tuzatilganlar:

- Storage 15 s timeout;
- admin tugmasi aniq maqsadni ko‘rsatadi va Firestore rasm hujjatlarini oldindan tekshiradi;
- 20 ta qayta ishlatilgan yechim rasmi qo‘shildi.

Review savollarni test bilan bir xil `renderBlocks` + `figureUrl` orqali chizadi. E2E'da Firestore manbasi bilan review rasmlari **16/16**.

**Production'da kerak:** admin sahifada rasm manbaini `firestore` ga o‘tkazish (tasdiqingiz bilan).

## 6. Answer key tiklash

865 valid + 62 tiklangan (canonical LaTeX'da) + **100 `TEKSHIRISH_KERAK` — tegilmagan**, ballga kirmaydi (E2E: 100/100 kalitsiz). Day 1 dagi 8 tasi v2 orqali production'ga chiqadi, qolgan 54 tasi draft kunlarga migratsiya bilan.

## 7. Test natijalari

| To‘plam | Natija |
|---|---|
| prepare gate'lari | **40/40** (bundle `a2f1ffd1678265e2`, o‘zgarmagan) |
| salbiy testlar | **21/21** |
| Rules | **127/127** |
| E2E asosiy | **76/76** |
| E2E rasmlar | **13/13** |
| **E2E review + Day 1 migratsiya (yangi)** | **38/38** |
| migratsiya dry-run (Python, Rules) | **PASS** |
| Pedagogika | **20/20** |

Yangi talablar va tekshiruvlar (`e2e_review.mjs`):

- **A–B:** user Day 1 v2 ni topshiradi, natija sahifasi ochiladi.
- **C:** 32/32 karta, variantlari bilan.
- **D:** «Sizning javobingiz» matni va variant belgisi.
- **E:** to‘g‘ri javob faqat submit'dan keyin; test davomida kalit so‘rovi 0.
- **F:** holatlar — 11 to‘g‘ri / 11 noto‘g‘ri / 9 javobsiz / 1 ballga kirmaydi; hammasi kutilgan bilan mos.
- **G:** yechim qulf, so‘rov yo‘q.
- **H:** yechim 4-okt 00:00 dan keyin ochiladi va havola savolga olib boradi.
- **I:** review'dagi rasmlar 16/16.
- **J:** review'da 228 ta KaTeX formula.
- **K:** mobil (390 px), overflow 0.
- **L:** qayta ochilganda natija ko‘rsatiladi; 2-urinishni Rules rad etadi.
- **M:** eski v1, `selectedAnswers` va `testVersion` yo‘q natijalar — ball o‘zgarmagan.
- **N:** v2 = canonical (savollar, kalit 31).
- **O:** 100 ta `TEKSHIRISH_KERAK` kalitsiz qoldi.
- **P:** Pedagogika hash 20/20.

## 8. Production migratsiya bosqichlari (tasdiqingizdan keyin)

1. Kodni chiqarish: yuqoridagi fayllar + 17–21 dagi fayllar (`git add` faqat ro‘yxatdagi fayllar; `git add .` yo‘q; `.DS_Store` emas) → PR → main. Jonli faylda yangi kod borligini tekshirish (kesh 10 daqiqa).
2. Admin → rasm manbai → «storage → firestore ga o‘tkazish» (tugma hujjatlarni tekshiradi). Natija: Day 1 rasmlari ko‘rinadi.
3. Admin → «3. Canonical yangilanish» → `migration/migration.json` ni tanlash → **preflight'ni o‘qish**: Day 1 urinishlari soni va userlar. Shundan keyin sizning qaroringiz.
4. «Migratsiyani qo‘llash» (1205 amal; qayta ishga tushirish xavfsiz).
5. Smoke-test: Day 1 ni topshirmagan akkaunt bilan Day 1 v2 (tiklangan savollar A–D), natija sahifasi va review, rasmlar; avvalgi urinish egasi — eski natija o‘zgarmaganini ko‘rish.

## 9. Rollback

| Qatlam | Rollback |
|---|---|
| Draft kunlar va savollar bankasi | `migration/rollback.json` — baseline holatiga update (dry-run: to‘liq tiklandi) |
| Day 1 | Rules versiyani kamaytirishga ruxsat bermaydi → `rollback.json` **v3 = v1 nusxasi** yaratib, `currentVersion: 3` qiladi (dry-run: v3 = v1). Urinishlar o‘zgarmaydi |
| Yangi rasm hujjatlari (20) | qoladi (Rules delete'ni taqiqlaydi; zararsiz) |
| Rasm manbai | admin tugmasi bilan qaytarish |
| Kod | commit'lar → `git revert` |
| Canonical LaTeX | `_private/…/_staging/latex-backup-*` |
