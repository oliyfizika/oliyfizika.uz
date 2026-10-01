# Interaktiv mock testlar — OliyFizika.uz

Manzil: `/milliy-sertifikat/mock-testlar/` (katalog) va `/milliy-sertifikat/mock-testlar/test.html?id=mock-test-N` (test).

```
mock-testlar/
├── index.html            katalog (test kartochkalari)
├── test.html             umumiy test sahifasi (engine)
├── css/mock-testlar.css  dizayn (qorong'i/yorug' mavzu, watermark)
├── js/
│   ├── config.js          sozlamalar: muallif, ruxsat, lokal/API rejim
│   ├── test-engine.js     boshlash, navigatsiya, savollar, yakunlash
│   ├── timer.js           180 daqiqalik taymer (deadline asosida)
│   ├── calculator.js      ilmiy kalkulyator (xavfsiz parser)
│   ├── formula.js         formula jadvali oynasi
│   ├── scoring.js         lokal baholash, tolerans, son formatlari
│   ├── attempt-service.js submitAttempt() — backend/Rasch ulanish nuqtasi
│   ├── result.js          natija, Rasch kodi, savollarni ko'rib chiqish
│   ├── storage.js         localStorage (progress saqlash)
│   ├── access-gate.js     ixtiyoriy mockTestsAccess tekshiruvi
│   ├── catalog.js, dom.js, theme.js
├── data/
│   ├── tests.json         testlar ro'yxati (katalog)
│   └── mock-test-N.json   har bir testning savollari
└── assets/
    ├── images/test-N/qNN.png
    └── formulas/formula-sheet-1.png, formula-sheet-2.png
```

## Yangi test qo'shish (masalan №4)

1. `data/mock-test-3.json` dan nusxa olib `data/mock-test-4.json` yarating; `id`, `number`, `title`, `subtitle`, `resultCode.prefix` va `questions` ni o'zgartiring.
2. Rasmlarni `assets/images/test-4/` ga qo'ying (`q01.png` ...) va savolda `"image": "assets/images/test-4/q01.png"` deb yozing.
3. `data/tests.json` ga bitta qator qo'shing: `{ "id": "mock-test-4", "file": "data/mock-test-4.json" }`.

JS kodiga tegish shart emas. Savollar soni, bandlar va vaqt kartochkada avtomatik hisoblanadi.

### Savol formati

```json
{ "n": 1, "type": "mcq", "text": "...", "options": ["20", "40", "60", "10"], "answer": "A",
  "image": "assets/images/test-4/q01.png", "note": "(ixtiyoriy umumiy izoh)" }

{ "n": 36, "type": "open2", "text": "...",
  "parts": [
    { "key": "a", "text": "...", "answer": 8,  "unit": "s" },
    { "key": "b", "text": "...", "answer": 50, "unit": "m/s", "tolerance": 0.1, "hint": "Masalan: 7e-27", "scientific": true }
  ] }
```

- `tolerance` — absolyut ruxsat etilgan farq. Berilmasa `scoring.defaultRelativeTolerance` (nisbiy) ishlatiladi.
- Matnlar oddiy matn sifatida chiqariladi (HTML ishlamaydi). Yadro reaksiyasi kabi alohida qator uchun `"reaction": "..."`.
- `review.showCorrectAnswers` — yakunda to'g'ri javoblar ko'rsatilsinmi.
- Ism so'ralmaydi: test faqat saytga kirgan foydalanuvchiga ochiladi, ism `users/{uid}.fullName` dan olinadi.

## Rasch backendga o'tish

`js/config.js` da `ATTEMPT_CONFIG.mode = "api"` va `endpoint` berilsa, `submitAttempt()` javoblarni
`POST` qiladi (`buildAttemptPayload()` formatida, to'g'ri javoblarsiz) va foydalanuvchiga ball o'rniga
"SUBMITTED — natija e'lon qilinadi" ekrani ko'rsatiladi. Server rejimida JSON fayllardan `answer`
maydonlarini olib tashlash mumkin (va kerak) — ular serverda saqlanadi.

Eslatma: sahifalar `fetch()` ishlatadi, shuning uchun ularni `file://` orqali emas, veb-server orqali oching.
