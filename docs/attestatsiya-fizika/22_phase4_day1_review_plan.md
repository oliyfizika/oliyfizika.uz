# 22 — 4-bosqich qo‘shimchasi: Day 1 canonical versiya + natijani ko‘rib chiqish (reja)

Sana: 2026-10-03. Tartib: 4A → 4B → 4C → 4D → 4E (4E — faqat sizning tasdig‘ingizdan keyin).

## 4A. Rasm backend + review arxitekturasi

- Rasm tuzatishi (17-hisobot) review'da ham ishlaydi: review savollarni xuddi test kabi `renderBlocks(…, {testId, scope:"question"})` bilan chizadi, ya’ni bir xil `figureUrl` (Firestore fallback) va KaTeX ishlatiladi.
- Review ma’lumot manbalari (yangi kolleksiya yoki maydon yo‘q):
  - savollar va variantlar: `versions/v{attempt.testVersion}` — urinish qaysi versiyada topshirilgan bo‘lsa, aynan o‘sha snapshot;
  - foydalanuvchi javobi: `attempt.answers` (eski sxemalar uchun `selectedAnswers` ham o‘qiladi);
  - to‘g‘ri javob: `keys/v{testVersion}`. Rules uni faqat o‘z urinishi `submitted|graded` bo‘lgandan keyin beradi; test davomida so‘rov ham yuborilmaydi;
  - holat va son: urinishda saqlangan `correctIds/wrongIds/score` (Rules tasdiqlagan). Qayta hisoblanmaydi, eski natija o‘zgarmaydi.
- To‘liq yechim alohida: `solutions/v{n}` faqat `solutionAvailableAt` dan keyin (Rules). Review uni so‘ramaydi, faqat qulf va sanani ko‘rsatadi.
- Eski urinishda `testVersion` bo‘lmasa, `test.currentVersion` olinadi; ball va javoblar baribir urinishning o‘zidan.

## 4B. Day 1 canonical versiya

Rules published testni draft'ga qaytarishga ruxsat bermaydi. O‘chirish ham taqiqlangan, shuning uchun «qayta draft» yo‘q. Rules'dagi yo‘l — **versiya**:

1. `versions/v2`, `keys/v2`, `solutions/v2` canonical bundle'dan yaratiladi. Farq — 8 ta tiklangan savol (AF-1-005, 009, 010, 014, 024, 025, 026, 031); scorable 23 → 31; AF-1-018 `TEKSHIRISH_KERAK` bo‘lib qoladi.
2. Day 1 meta: `currentVersion: 2`, `scorableCount`, `openCount`, `questionEval`. Ixtiyoriy: `solutionAvailableAt` = qayta e’lon vaqtidan keyingi 00:00 (Toshkent). Hozirgi muddat o‘tgan bo‘lsa, busiz Day 1 rasmiy topshirishga yopiq qoladi.
3. Mavjud urinishlar o‘zgarmaydi: ular v1 ga bog‘langan, review v1 snapshot bilan ko‘rsatiladi. Yangi urinishlar v2 da.
4. Rasmiy urinish bitta (`{uid}__{testId}`). Day 1 v1 ni topshirgan akkaunt v2 ni qayta topshira olmaydi, buning uchun boshqa test akkaunti kerak. Urinishlarni o‘chirish Rules'da taqiqlangan va qilinmaydi.
5. Migratsiyadan oldin admin sahifasi Day 1 bo‘yicha urinishlar sonini, userlar sonini va holatini ko‘rsatadi. Real userlar bo‘lsa ham hech narsa o‘chirilmaydi: ular v1 natijasini saqlaydi, versiyalash aynan shu holat uchun.

## 4C. Result review UI

Xulosa (ball, foiz, to‘g‘ri/noto‘g‘ri/javobsiz, vaqt) → **«Javoblarni ko‘rib chiqish»**. Har savol ochiq karta ko‘rinishida:

- raqam, savol, formula, rasm, barcha variantlar;
- «Sizning javobingiz» yoki «Siz javob bermadingiz»;
- «To‘g‘ri javob»;
- holat: ✓ To‘g‘ri / ✗ Noto‘g‘ri / Siz javob bermadingiz / Ballga kirmaydi;
- «To‘liq yechim 🔒 — <sana> 00:00 da ochiladi» yoki ochiq bo‘lsa, shu savol yechimiga havola.

Saralash: Hammasi / Noto‘g‘ri / Javobsiz / To‘g‘ri. Kartalarning ichi ko‘rinishga yaqinlashganda chiziladi (32 savol, rasmlar lazy). Mobil va qorong‘i rejim mavjud dizayn tokenlari bilan.

## 4D. Validatsiya

Yangi E2E (`e2e_review.mjs`), production holati simulyatsiyasida:

- baseline import → Day 1 v1 publish → user1 v1 ni topshiradi;
- admin migratsiya faylini qo‘llaydi (Day 1 v2 + draft kunlar + bank);
- user1 ning v1 review'i o‘zgarmagan; user2 v2 ni topshiradi — A–N talablari;
- eski sxemadagi urinish (`testVersion` yo‘q, `selectedAnswers`);
- yechim 00:00 gacha qulf, keyin ochiq; mobil; Firestore rasm backend.

Mavjud to‘plamlar (40/40, 21/21, 127/127, 76/76, 13/13, Pedagogika 20/20) qayta ishga tushiriladi.

## 4E. Production (alohida tasdiq bilan)

Admin sahifada «Migratsiyani qo‘llash» bo‘limi:

- preflight: format; ruxsat etilgan yo‘llar (attempts/settings/users/delete — yo‘q); nested array; Day 1 urinishlar hisoboti;
- tasdiqdan keyin bosqichma-bosqich yozish, idempotent.

Rollback: draft/bank uchun `rollback.json` (update). Day 1 uchun Rules versiyani kamaytirishga ruxsat bermaydi, shuning uchun rollback **v3 = v1 nusxasi** (`currentVersion: 3`).
