# Mock test 02 — faqat pullik guruh uchun, rasmli savollar bilan

## Nima o'zgardi
- Test hujjatida `paidOnly: true` maydoni: bunday mock'ga faqat admin yoki `users/{uid}.attestationAccess == true` bo'lgan foydalanuvchi kira oladi. `accessMode` ("open"/"paid") bunga ta'sir qilmaydi. Maydoni yo'q mock (mock-01) hamma kirgan foydalanuvchiga bepul qoladi.
- Himoya 3 qatlamda: Firestore Rules (`firestore.rules`, manba `rules/attestation_physics.rules.in`), Storage Rules (`storage.rules`), mijoz (`access.js`, `dashboard.js`, `test-page.js`, `solutions-page.js`). Ruxsatsiz foydalanuvchi dashboard'da qulflangan karta ko'radi.
- Mock import (admin sahifasi) endi rasmli savollarni qabul qiladi: `figures/{id}` va `solutionFigures/{id}` hujjatlari (base64). Import qayta ishga tushirilsa, faqat yetishmagan hujjatlar yoziladi (draft holatida). Mock rasmlari `figureBackend`dan qat'i nazar Firestore'dan o'qiladi (`api.js`).
- Tuzatish: rasmli variant (A–D rasm) ustiga bosganda rasm tugmasi bosishni yutib yuborardi — `.att-opt .att-fig__btn { pointer-events: none }`.

## Mock-02 tarkibi
50 savol: 35 fizika + 5 kasbiy standart + 10 pedagogik mahorat, 100 ball, 22 ta rasm. 50-savol (demo-testda rasmi yo'q edi) o'rniga mavjud pedagogika savoli `PED-10-12` (test10.js, 12-savol, to'g'ri javob D «Differensial yondashuv tamoyili») qo'yilgan. Haqiqiy 50-savol rasmi topilsa, `build_mock_test_02.py` da almashtiriladi.

## Qadamlar
1. `python3 tools/attestatsiya-fizika/build_mock_test_02.py` → `_private/attestatsiya-fizika/mock-import-02.json` (gitignored, javoblar bor) va `docs/attestatsiya-fizika/mock_test_02_plan.json`.
2. Rules'ni deploy qiling: `firebase deploy --only firestore:rules --project oliy-fizika` (Storage rules ixtiyoriy: mock rasmlari Firestore'da).
3. Admin → Attestatsiya Fizika → «Mock test importi» → `mock-import-02.json` → Import (draft).
4. Tekshirib, o'zingiz PUBLISH qilasiz. Pullik guruh a'zolariga Access sahifasida ruxsat bering.

## Tekshiruvlar
Rules testlari 352/352, test_access 21/21, boshqa JS testlar PASS; E2E: `e2e_mock_paid.mjs` 15/15 (admin import 22 rasm bilan, ruxsatsiz — qulf, pullik user — rasmlar yuklanadi, 100/100, yechimlar rasmlari), `e2e_mock` 64/64, `e2e` 77/77, `e2e_access` 53/53, `e2e_home_promo` 37/37, `e2e_unarchive` 32/32.
