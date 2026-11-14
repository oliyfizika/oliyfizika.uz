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

## Yozma yechimlar

Natija sahifasida har bir savol ostida «Yechimni ko‘rish» bo‘limi chiqadi (KaTeX formulalar bilan), agar
`data/solutions/mock-test-N.json` mavjud bo‘lsa (`js/solutions.js`). To‘g‘ri javoblar yashirilgan testda
(`review.showCorrectAnswers: false`, hozir Mock №11–12) yechimlar ham ko‘rsatilmaydi; javoblar ochilsa, yechimlar
ham avtomatik chiqadi. Fayl qo‘lda yozilmaydi:

1. Manba: `tools/milliy-sertifikat/solutions/mock-test-N.txt` (`@N` — savol, `G:` berilgan, `P:` matn,
   `M:` formula, `A:` javob, `S:` kalitdagi xato izohi, `U:` shart noaniq izohi).
2. `python3 tools/milliy-sertifikat/build_solutions.py` — JSON yaratadi va har bir test savolidagi javob
   harfi kalit bilan mosligini tekshiradi.

## Yopiq rejim: sessiyalar va Rasch natijasi

Barcha mocklar sukut bo‘yicha **yopiq**. Admin `admin/milliy-sertifikat-sessiyalar.html` sahifasida:

1. **Sessiya ochadi** — mock, ochilish/yopilish vaqti (Toshkent), har bir ishtirokchiga vaqt (daqiqa). Shu oraliqda test
   barcha kirgan foydalanuvchilarga ochiladi (`msMockSessions/{id}`). Ishtirokchi bir marta yechadi; javoblar serverda
   saqlanib boradi (`msMockAttempts/{sessionId}__{uid}`), topshirganda **natija ko‘rsatilmaydi**.
2. Sessiya yopilgach **«Yakunlash va natijani hisoblash»** — `js/finalize-core.js` barcha javoblarni `gradeLocal()` bilan
   baholab, `js/rasch.js` (JMLE) orqali ball hisoblaydi: T = 50 + 10·Z, [0; 75]; daraja 70+ A+, 65 A, 60 B+, 55 B, 50 C+, 46 C;
   foiz = ball / 70 (100% bilan cheklangan); bo‘limlar bo‘yicha taqsimot `js/sections.js` (savolda `"section"` bo‘lmasa —
   kalit so‘zlar bo‘yicha). Natija har bir urinishga yoziladi, darajasi borlarga `msMockCertificates/{OFyy-NNNNNN}` yaratiladi.
   Kamida 5 ta javob bergan ishtirokchi kerak; 30 tadan kam bo‘lsa ogohlantiriladi. Qayta hisoblash mumkin (sertifikat raqamlari saqlanadi).
3. Ishtirokchi natijani test sahifasida ko‘radi; `sertifikat.html?session=…` da rasm (3×4, Firestore `msMockProfiles/{uid}`)
   va otasining ismini kiritib, sertifikatni PNG/PDF yuklaydi. QR kod `sertifikat.html?cert=…` (ommaviy tekshirish) ga olib boradi.

**Erkin mashq**: admin belgilagan mocklar (`msMockSettings/config.practiceTests`) eski rejimda ochiq — natija darhol.
Foydalanuvchilarning avvalgi mashq natijalari (qurilmadagi holat + `mockTestAttempts`) o‘chmaydi va test yopiq bo‘lsa ham ko‘rinadi.

Testlar: `node tools/milliy-sertifikat/tests/test_rasch.mjs`, `node tools/milliy-sertifikat/tests/test_finalize_core.mjs`,
`python3 tools/milliy-sertifikat/tests/test_ms_session_rules.py`, E2E: `tools/milliy-sertifikat/e2e_ms_sessions.mjs`.
