# 24 — Mock test (50 savol = 40 fizika + 10 pedagogika, 100 ball)

Holat: **lokal, commit/push/deploy qilinmagan.** Production Firestore'ga hech narsa yozilmagan.

## Nima qo'shildi

| | |
|---|---|
| Tarkib | 40 fizika (Mexanika, Molekulyar fizika, Elektr va magnetizm, Optika, Atom va yadro fizikasi — **8 tadan**) + 10 pedagogika |
| Ball | har savol 2 ball, jami 100. `scorePercent == ball` (50 savol × 2), shuning uchun Rules'dagi mavjud baholash tekshiruvi o'zgarmadi |
| Kirish | **hamma kirgan foydalanuvchiga bepul** (paid rejimda ham, `attestationAccess`siz ham) |
| E'lon / yechim / natija | kunlik testlar bilan **bir xil**: admin PUBLISH → ertasi 00:00 (Toshkent) yechim va kalit ochiladi; natija topshirgan zahoti; avto-yakunlash (`attValidAutoSubmit`) ham ishlaydi |
| Kalendar | kurs kunlari (1..100) kalendari, «Bugungi test», progress va kunlik statistikaga **aralashmaydi** |

## Arxitektura (yangi kolleksiya yo'q)

Mock — oddiy kunlik test hujjati: `attestationPhysicsDailyTests/att-fizika-mock-01` + `versions|keys|solutions/v1`.

- `kind: "mock"`, `dayNumber: 101` (mock testlar 101+; kurs kunlari 1..100), `mockNumber`, `pointsPerQuestion: 2`, `maxScore: 100`,
  `physicsCount: 40`, `pedagogyCount: 10`, `section: "mock"`, `topics` = 5 bob + «Pedagogika», `questionTopicIdx` har savol uchun.
- URL'lar mavjud shaklda: `fizika-test.html?day=101`, `fizika-yechimlar.html?day=101`.
- Urinish: `attestationPhysicsAttempts/{uid}__att-fizika-mock-01` (mavjud start → submit → grade).

### Rules (`attestation_physics.rules.in`)
- `attIsMock(t)`: `t.get('kind','daily') == 'mock'`; `attDayOpen` = signedIn && (bepul kun || **mock** || attCanAccess).
- `attValidTestShape`: `questionCount <= 50` (avval 40); `kind in ['daily','mock']`; mock ⇔ `dayNumber >= 101` (aralashib ketmaydi); `dayNumber <= 199`.
- `attContentUnchanged`: e'londan keyin `kind` ham o'zgarmaydi.
- Kunlik testlar uchun Day 1–3 bepul / Day 4+ ruxsat qoidasi **o'zgarmagan** (regressiya testlari bilan tasdiqlangan).
- `test_rules.py` 256 → **292** tekshiruv (§16 mock).

## Savollar qanday tanlangan (`tools/attestatsiya-fizika/build_mock_test.py`)

Deterministik (seed `mock-1`), mavjud savollar bankidan:

- fizika: `evaluationType=auto`, `keyStatus=valid`, yechim `full|theory`, `review.check` yo'q, `type=mcq`, **rasmsiz** (savol/variant/yechimda rasm yo'q — rasm fayllari kunlik testga bog'langan);
- har bobda mavzular bo'yicha navbatma-navbat (har bobda 6–8 xil mavzu), qiyinlik ≈ 3 oson / 3 o'rta / 2 murakkab; oson → murakkab tartibda;
- pedagogika: `attestatsiya/pedagogika-testlari/data/test*.js` dan (**faqat o'qiladi**), 10 ta turli fayldan bittadan, takrorlanmagan matn; ID `PED-{fayl}-{n}`; to'g'ri javob harflari muvozanatli;
- tartib: 5 fizika bobi (8+8+8+8+8), so'ng Pedagogika (10).

Chiqish: `_private/attestatsiya-fizika/mock-import-01.json` (gitignored — javob kalitini o'z ichiga oladi) va javobsiz reja
`docs/attestatsiya-fizika/mock_test_01_plan.json` (faqat ID'lar).

Yangi mock: `python3 tools/attestatsiya-fizika/build_mock_test.py --number 2 --seed <boshqa>` (dayNumber 102).

## Admin

`admin/attestatsiya-fizika.html` → «Import» ro'yxatidagi **Mock test** qadami: `mock-import-01.json` ni tanlash → «Mock testni import qilish» (draft; mavjud mock qayta yozilmaydi) → jadvaldagi **Mock** qatorida PUBLISH. «Keyingi kun» eslatmasi mock'ni sanamaydi. Urinishlar, Savollar statistikasi va Excel — mavjud modullar (yorliq «Mock test»).

## Foydalanuvchi

- Dashboard: «Mock test» bo'limi (kunlik jadvaldan alohida) — Boshlash / Davom ettirish / Natija / Yechimlar; ball `74/100`.
- Test: «Mock test: 40 ta fizika + 10 ta pedagogika», 50 savol, kalkulyator, **2 soatlik teskari hisoblagich** (pastga qarang).
- Natija: halqada **ball** («74 ball»), `74 / 100 ball`, to'g'ri/noto'g'ri/javobsiz, 50 kartali review (bob/«Pedagogika» yorlig'i).
- Yechimlar: ro'yxatda «M · Mock test»; mock ichida oldingi/keyingi tugmalari faqat mock'lar orasida.
- Natijalar sahifasi: tarixda «Mock test — 74 / 100 ball»; kurs progressi, o'rtacha/eng yuqori natija va grafiklar mock'siz.

## Vaqt chegarasi: 2 soat

- Mock hujjatida `timeLimitSeconds: 7200` (kunlik testlarda yo'q → chegarasiz, o'zgarmagan). Hisob «Testni boshlash» bosilib `startedAt` (server vaqti) yozilgan zahotidan boshlanadi.
- **Yangilaganda davom etadi**: hisoblagich brauzer holatiga emas, serverdagi `startedAt` ga tayanadi; sahifa yangilansa/yopilib qayta ochilsa ham qolgan vaqtdan davom etadi («Davom ettirish»). Brauzer soati noto'g'ri bo'lsa, sayt javobidagi `Date` sarlavhasi bilan tuzatiladi.
- **Ko'rinishi**: test panelida «Qolgan vaqt H:MM:SS» (oxirgi 10 daqiqa — sariq, 1 daqiqa — qizil; ekran o'qigichlar uchun 30/10/5/1 daqiqada e'lon), kirish sahifasida va dashboard kartasida ham.
- **0 bo'lganda** javoblar avtomatik topshiriladi va baholanadi. Foydalanuvchi sahifani yopib ketsa — keyingi kirishda (yoki admin «Urinishlar»da) lazy avto-yakunlash: `completedAt = startedAt + 2 soat`.
- Yechim vaqti 2 soatdan oldin kelsa — oldingi qoida (yechim vaqti) ustun.
- **Rules (server)**: `attHasLimit/attLimitEnd/attLimited/attEndAt/attAutoFrom/attInTime`. Saqlash/topshirish `startedAt + 2 soat + 60 s` gacha; avto-yakunlash shu vaqtdan keyin va faqat `completedAt == startedAt + limit` bilan. Shuning uchun `timeSpentSeconds` ≤ 2 soat + 60 s. `test_rules.py` 309/309.
- Mock importi (`build_mock_test.py`, admin tekshiruvi) `timeLimitSeconds == 7200` ni talab qiladi. Rules deploy kerak.

## Ishga tushirish tartibi (production)

1. `build_mock_test.py` → `mock-import-01.json`.
2. **Firestore Rules deploy** (yangi `attIsMock`, 50 savol chegarasi — shundan oldin mock hujjatini yozib bo'lmaydi).
3. Admin → Import → Mock test → PUBLISH.

## Eslatma (o'zgartirilmadi)

`attestatsiya/pedagogika-testlari/data/test8.js` boshida `indow.testQuestions` (w harfi tushib qolgan) — Pedagogika sahifasi 8-testni yuklay olmasligi mumkin. Pedagogika qismiga tegilmadi (hash 20/20); mock builder shu faylni faqat o'qishda chetlab o'tadi.
