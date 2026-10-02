# 14 — 3-bosqich: end-to-end test

Buyruq: `python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8771` + `E2E_PORT=8771 node tools/attestatsiya-fizika/e2e/e2e.mjs`
Natija: **71/71 PASS** (oxirgi ishga tushirish, 2026-10-02). Hisobot: `_private/attestatsiya-fizika/e2e/report.json`.

Muhit: haqiqiy sayt sahifalari (Chromium), Firebase SDK URL’lari lokal mock SDK’ga yo‘naltiriladi; mock server har bir o‘qish/yozishni **xuddi shu `firestore.rules` / `storage.rules`** bilan `rules_eval.py` orqali baholaydi; soat (`request.time`) boshqariladi. Haqiqiy Firebase emas — production’da qo‘lda smoke-test kerak (15-hisobot).

## Ssenariy

1. **Admin**: import fayli (1027 savol / 865 auto / 32 test) → 32 Day draft jadvalda → 415 rasm Storage’ga → Day 1 PUBLISH, tasdiq oynasi «Day 1 testini foydalanuvchilarga e’lon qilishni xohlaysizmi?» → `status=published`, `publishedAt` server vaqti, `solutionAvailableAt` = ertasi 00:00 Toshkent (19:00 UTC) → bildirishnoma payload tayyor.
2. **Xavfsizlik** (12-hisobot): mehmon/user/draft/kalit/yechim/publish/archive/rasm.
3. **User**: bosh sahifa → yangi Attestatsiya landing → Fizika dashboard: Bugungi test = Day 1, 31 kun qulf (mavzular ko‘rinmaydi) → Start (urinish yaratildi, `timeLimitSeconds` yo‘q) → 32 savol UI orqali → soat +47:27 → sekundomer «47:27», test hali ochiq (auto-submit yo‘q) → submit’dan oldin kalit/yechim so‘rovi 0 → tasdiq oynasi «Testni yakunlashni xohlaysizmi? …» → **darhol natija**: 17/23, To‘g‘ri/Noto‘g‘ri/Javobsiz, «47 daqiqa 28 soniya», har savolda ✓/✕/○/baholanmaydi, «Sizning javobingiz» + «To‘g‘ri javob», to‘liq yechim yopiq eslatmasi.
4. **Soxtalashtirish**: scorePercent / correctAnswers / timeSpentSeconds / isCorrect / boshqa user urinishi — rad.
5. **Ertasi kun** (soat → keyingi kun): admin Day 2 PUBLISH; qayta import mavjud 32 testni o‘tkazib yuboradi (hech narsa o‘chirilmaydi); dashboard: Bugungi test = Day 2; Day 1 tarixda; yechimlar ochiq — 32 savol, 291 KaTeX formula; rasmlar lazy (16/16 ko‘rinmaguncha yuklanmagan) va Storage `getBlob` orqali (16/16 tayyor).
6. **Tarix va statistika**: progress 1/32, o‘rtacha 74%, eng yuqori/past, o‘rtacha/jami vaqt, kunlar bo‘yicha natija va vaqt, bo‘lim va mavzular.
7. **Sifat**: konsol xatolari 0; overflow yo‘q (3 o‘lcham × 2 tema × 5 sahifa); klaviatura radiogroup; ARIA.

## Tuzatilgan test muammolari

- Vaqt tekshiruvi aniq «27 soniya» ni kutardi; setClock → submit orasida real vaqt ham o‘tadi (1–3 s) → 27–35 s oralig‘i qabul qilinadi; server `timeSpentSeconds` Rules tomonidan aynan tekshiriladi.
