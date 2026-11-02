# 29 — Mock test 3, 4, 5 (pullik, takrorlanmaydigan savollar, pedagogika bilan)

## Tarkib (har biri)
- 50 savol = **35 fizika** (Mexanika, Molekulyar fizika, Elektr va magnetizm, Optika, Atom va yadro fizikasi — har bobdan 7 tadan) + **15 pedagogika**.
- Har savol 2 ball → 100 ball; vaqt — boshlagandan 2 soat; `paidOnly: true` (faqat admin yoki `attestationAccess == true`).
- `composition: { fizika: 35, pedagogika: 15 }`, `dayNumber` 103, 104, 105 (`mockNumber` 3–5), draft holatida yoziladi.

## Savollar qayerdan
- Fizika — mavjud savollar banki, **Firestore’dan** (kunlik testlarning joriy versiyasi: `versions`/`keys`/`solutions` + `attestationPhysicsQuestions/{id}/private/answer`).
  Mezon: auto, mcq, kalit bor, `keyStatus = valid`, `review.check` yo‘q, yechim `full|theory`, rasmsiz; bob ichida mavzular navbatma-navbat, qiyinlik ≈ 2 oson / 3 o‘rta / 2 murakkab.
- Pedagogika — `attestatsiya/pedagogika-testlari/data/test*.js` (**faqat o‘qiladi**, fayllar o‘zgarmaydi), 4 variantli, turli fayllardan, javob harflari muvozanatli.

## Takrorlanmaslik
Bitta mock ichida, mock 3–5 orasida va avvalgi mocklar (1, 2) bilan: bir xil ID yo‘q va matni o‘xshash savol yo‘q
(savol + variantlar so‘zlari bo‘yicha Jaccard ≥ 0,8 — raqamlari biroz farq qiladigan “egizak” savollar ham takror hisoblanadi).
Pedagogika bazasining o‘zidagi takrorlar (260 dan 6 tasi) ham chiqarib tashlanadi. Tanlov deterministik (seed `mock-N`).

## Admin
`admin/attestatsiya-fizika.html` → Import → **«Yangi pullik mock testlar (3 ta, avtomatik)»**:
1. «Mocklarni tayyorlash» — bank o‘qiladi, 3 ta mock tuziladi va tekshiriladi (hech narsa yozilmaydi).
2. «Draft sifatida yozish» — mavjud mock importi yo‘li bilan yoziladi (qayta bosish xavfsiz: faqat yetishmagan hujjatlar).
3. Har birini jadvaldan alohida PUBLISH qilasiz. Fayl (`_private`) kerak emas.

Kod: `assets/js/attestatsiya-fizika/mock-generator.js` (sof funksiyalar), `assets/js/admin/attestation-fizika.js`.
Rules o‘zgarmadi (mock-02 dagi `paidOnly` himoyasi ishlatiladi).

## Tekshiruvlar
- `node tools/attestatsiya-fizika/tests/test_mock_generator.mjs` — 26/26 (sun’iy fizika banki + haqiqiy pedagogika fayllari).
- `E2E_PORT=8811 node tools/attestatsiya-fizika/e2e/e2e_mock_generator.mjs` (mock_server, repo Rules bilan) — 14/14: tayyorlash yozmaydi,
  3 mock Rules’dan o‘tib yoziladi, 150 savol noyob, mock-01/02 savollari yo‘q, PUBLISH, pullik user — ochiq, ruxsatsiz — qulf, test sahifasi matni.
