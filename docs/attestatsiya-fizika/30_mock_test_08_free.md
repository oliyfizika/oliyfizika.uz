# 30 — Mock test 8 (bepul): «Attestatsiya 2026 (bahor), 2-test»

## Tarkib
- 50 savol = **35 fizika** (2026 bahor attestatsiyasining 2-testi, manbadagi tartibda, 21 ta rasm bilan) + **15 pedagogika**.
- Har savol 2 ball → 100 ball; `dayNumber` 108, `mockNumber` 8, draft holatida yoziladi.
- **Bepul**: test hujjatida `paidOnly` yo‘q → hamma kirgan foydalanuvchi (paid rejimda ham, `attestationAccess`siz ham).
- **Mexanizm pullik mocklar bilan bir xil** (Rules o‘zgarmadi): istalgan vaqtda 1 marta, boshlagandan 2 soat
  (`timeLimitSeconds` 7200, server `startedAt` bo‘yicha), kalit va yechimlar faqat o‘z urinishi yakunlangach.
- Manbadagi kalit xato bo‘lgan 3 savolda (11, 13, 33) yechim ostida «Manba xatosi» izohi bor; javob — fizik jihatdan to‘g‘risi.

## Fayllar
| | |
|---|---|
| `tools/attestatsiya-fizika/build_mock_test_08.py` | builder: `_private/attestatsiya-fizika/bahor-2026-test2/items.json` + `figures/qNN.png` → `mock-import-08.json` |
| `_private/…/bahor-2026-test2/items.py` | 35 masala (savol, variant, javob, yechim) — gitga kirmaydi |
| `_private/attestatsiya-fizika/mocks-used.json` | ixtiyoriy: mavjud mocklar savollari `[{id, text}]` — pedagogika ular bilan takrorlanmasin |
| `docs/attestatsiya-fizika/mock_test_08_plan.json` | javobsiz reja (ID’lar) |

Pedagogika tanlovi `mock-generator.js` funksiyalari bilan (`pedagogyPool`, Jaccard < 0,8, turli fayllardan, seed `mock-8`).

## Admin importida yangi ogohlantirish
`admin/attestatsiya-fizika.html` → «Mock test importi»: fayl tanlanganda uning savollari **mavjud barcha mocklar** bilan
solishtiriladi (bir xil ID yoki matn o‘xshashligi ≥ 0,8). Takror topilsa: «Diqqat: N ta savol mavjud mocklarda bor (…)».
Import to‘xtatilmaydi — qaror adminniki.

## Ishga tushirish
1. `python3 tools/attestatsiya-fizika/build_mock_test_08.py` → `_private/attestatsiya-fizika/mock-import-08.json`.
2. Admin → Import → «Mock test importi» → `mock-import-08.json` → «hamma uchun bepul» yozuvini va takror ogohlantirishini tekshiring → Import (draft).
3. Jadvalda **Mock test 8** → PUBLISH. Rules deploy kerak emas.

## Tekshiruvlar
- Builder validatsiyasi PASS; KaTeX: barcha formulalar `throwOnError` bilan xatosiz.
- `E2E_PORT=8811 node tools/attestatsiya-fizika/e2e/e2e_mock_08.mjs` — 16/16: admin import (21 rasm, «bepul», takror ogohlantirishi),
  PUBLISH, paid rejimda ruxsatsiz foydalanuvchi — karta ochiq, 2 soat hisoblagich, 21 rasm yuklanadi, 100/100, 50 yechim;
  ikkinchi foydalanuvchiga kalit/yechim urinishsiz yopiq (Rules).
- `test_mock_generator.mjs` 30/30.
