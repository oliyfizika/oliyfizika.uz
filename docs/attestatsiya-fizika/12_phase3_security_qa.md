# 12 — 3-bosqich: xavfsizlik QA

Ikki mustaqil qatlamda tekshirildi:

1. **Rules unit testlari** — `tools/attestatsiya-fizika/rules/test_rules.py` (lokal Rules interpretatori `rules_eval.py`, Firestore + Storage, cross-service `firestore.get`): **126/126 PASS**, max `get()` = 4 (limit 10), max eval tugunlari 306. Simulyatsiya: Day 3–32 × 3 user — 90 ta to‘g‘ri baholash qabul qilindi, 270/270 soxta natija rad etildi.
2. **Brauzer E2E** — haqiqiy sahifalar + mock Firebase server (har so‘rov o‘sha Rules bilan baholanadi): 24 ta xavfsizlik tekshiruvi PASS (14-hisobot).

> ⚠️ Bu **rasmiy Firebase emulator emas**. Production’dan oldin Firebase Console → Rules Playground’da quyidagi jadval ssenariylari qo‘lda tasdiqlanishi shart (Chrome kengaytmasi ulanmagani uchun hali bajarilmagan). Playground’da PASS bo‘lmagan holat chiqsa — deploy qilinmaydi.

## 15 ta talab qilingan ssenariy

| # | Ssenariy | Kutilgan | Rules test | E2E |
|---|---|---|---|---|
| 1 | Mehmon → published test | rad | PASS | PASS |
| 2 | Mehmon → draft test | rad | PASS | PASS |
| 3 | User → draft test / snapshot / filtrsiz ro‘yxat | rad | PASS | PASS |
| 4 | User → published test | ruxsat | PASS | PASS |
| 5 | User2 → User1 urinishi | rad | PASS | PASS |
| 6 | User2 → barcha urinishlar so‘rovi | rad | PASS | PASS |
| 7 | User → javob kaliti (urinishsiz / in_progress) | rad | PASS | PASS |
| 8 | User → yechim `solutionAvailableAt` dan oldin (submit’dan keyin ham) | rad | PASS | PASS |
| 8b | User → yechim ertasi kuni | ruxsat | PASS | PASS |
| 9 | Soxta `scorePercent` | rad | PASS | PASS |
| 10 | Soxta `correctAnswers` / `wrongAnswers` / `unanswered` | rad | PASS | PASS |
| 11 | Soxta `timeSpentSeconds` | rad | PASS | PASS |
| 12 | Oddiy user → publish | rad | PASS | PASS |
| 13 | Oddiy user → archive | rad | PASS | PASS |
| 14 | Draft kun rasmi (Storage) — user/mehmon | rad | PASS | PASS |
| 15 | Published kun rasmi — user ruxsat, mehmon rad | ruxsat/rad | PASS | PASS |

Qo‘shimcha: `isCorrect` kabi ortiqcha maydon, javoblarni submit’dan keyin o‘zgartirish, `startedAt/completedAt` klient vaqti, 2-rasmiy urinish, yechim ochilgach start, urinish/test/savolni o‘chirish (admin ham), published snapshot’ni tahrirlash, archived→draft, `courseStartDate` qo‘shish, user’ning `accessMode`/`attestationAccess` ni o‘zgartirishi — barchasi rad. Mavjud qoidalar regressiyasi (`results` create, `fullAccess` o‘zgartirib bo‘lmasligi, ism yangilash) — o‘zgarmagan.

## Klientga nima yuboriladi

- Submit’dan oldin: faqat `versions/v1` (savol matni + variantlar). E2E: submit’dan oldin `/keys/` yoki `/solutions/` so‘rovi **0 ta**; snapshotda `correctAnswer`/`solution` kalitlari yo‘q (test bilan tasdiqlangan).
- Submit’dan keyin: `keys/v1` (to‘g‘ri javob harflari) — darhol natija uchun.
- `solutionAvailableAt` dan keyin: `solutions/v1` + yechim rasmlari.
- Rasmlar: `getBlob()` → vaqtinchalik Blob URL; doimiy public URL yo‘q. Storage Rules: draft → faqat admin; published → kirgan user; yechim rasmlari → vaqtdan keyin; yozish faqat admin, ≤2 MB, `image/(webp|svg+xml|png)`; update/delete taqiqlangan; qolgan yo‘llar — rad.

## Maxfiy ma’lumotlar auditi (qurilmada)

- `.gitignore`: `/attestatsiya/fizika/ATT_EST/`, `/attestatsiya/fizika/ATT_EST solutions/`, `/_private/`, `__pycache__/`.
- Git’ga qo‘shilishi mumkin bo‘lgan 77 untracked fayl orasida PDF/.sol/.qtx/answer fayl **yo‘q** (`attestatsiya/fizika/` dan faqat `.DS_Store`).
- `correctAnswer: "A–D"` qiymati faqat `test_rules.py` dagi sintetik fixture’da.
- 407 savol rasmi `assets/attestatsiya-fizika/fig` → `_private/attestatsiya-fizika/figures/question`, 7 yechim rasmi → `.../figures/solution` ko‘chirildi; bo‘sh `assets/attestatsiya-fizika` papkasi o‘chirildi.

## Ma’lum cheklovlar

- Kalit submit’dan keyin klientga beriladi (darhol to‘g‘ri javobni ko‘rsatish talabi uchun zarur). Bu yechim matnini ochmaydi.
- Bir user bir nechta akkaunt bilan kalitni ko‘rib, boshqa akkauntda yechishi mumkin — har qanday backend’siz tizimda shunday; reyting/sertifikat yo‘q bo‘lgani uchun xavf past.
- Rasmiy emulator/Playground natijasi hali yo‘q (yuqoridagi ogohlantirish).
