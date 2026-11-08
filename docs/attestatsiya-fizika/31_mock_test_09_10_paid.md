# 31 — Mock test 9 va 10 (pullik): «Attestatsiya 2026 (bahor)», 3- va 4-testlar

## Tarkib
| | Mock test 9 | Mock test 10 |
|---|---|---|
| Manba | 2026 bahor, 3-test | 2026 bahor, 4-test |
| `testId` / `dayNumber` | `att-fizika-mock-09` / 109 | `att-fizika-mock-10` / 110 |
| Fizika | 35 masala, 15 ta rasm | 35 masala, 21 ta rasm |
| Pedagogika | 15 | 15 |
| «Manba xatosi» izohi | 1 ta (20-savol) | 2 ta (12, 31) |

- Har savol 2 ball → 100 ball; draft holatida yoziladi.
- **Pullik**: test hujjatida `paidOnly: true` → faqat `attestationAccess` bor foydalanuvchilar (va admin) ochadi; boshqalarga karta qulflangan, savollar Rules bilan yopiq.
- Mexanizm mock-03…08 bilan bir xil (Rules o‘zgarmadi): istalgan vaqtda 1 marta, boshlagandan 2 soat, kalit va yechimlar o‘z urinishi yakunlangach.
- Manba xatolari:
  - 9/20: shartda $t^2$ oldidagi koeffitsient tushib qolgan ($x=8-4t+t^2$ da javob variantlarda yo‘q) → $x=8-4t+2t^2$ deb tuzatildi.
  - 10/12: manbada C va D rasmlar bir xil edi → D boshqa (teskari) rasm bilan almashtirildi; javob o‘zgarmaydi (A).
  - 10/31: manba kalitida A; ko‘zgu bergan teskari tasvir linzada to‘g‘ri tasvir beradi → to‘g‘ri javob B («teskari va to‘g‘ri»).

## Fayllar
| | |
|---|---|
| `tools/attestatsiya-fizika/build_mock_test_bahor.py` | builder: `--test 3` → mock-09, `--test 4` → mock-10 (`paidOnly: true`) |
| `_private/…/bahor-2026-test3/`, `bahor-2026-test4/` | `items.py` (35 masala, javob, yechim) + `figures/qNN.png` — gitga kirmaydi |
| `docs/attestatsiya-fizika/mock_test_09_plan.json`, `mock_test_10_plan.json` | javobsiz reja (ID’lar) |
| `tools/attestatsiya-fizika/e2e/e2e_mock_bahor.mjs` | pullik mock E2E (`MOCK=09` yoki `MOCK=10`) |

Pedagogika: `mock-generator.js` qoidalari bilan; repo’dagi barcha `mock_test_*_plan.json` (01, 02, 08, 09) savollari qayta olinmaydi,
shuning uchun builder avval `--test 3`, keyin `--test 4` bilan ishga tushiriladi. Mock 3–7 bilan takrorni admin import sahifasi ogohlantiradi.

## Ishga tushirish
1. `python3 tools/attestatsiya-fizika/build_mock_test_bahor.py --test 3`, so‘ng `--test 4` → `_private/attestatsiya-fizika/mock-import-09.json`, `mock-import-10.json`.
2. Admin → «Mock test importi» → faylni tanlang → «FAQAT PULLIK GURUH» yozuvini va takror ogohlantirishini tekshiring → Import (draft).
3. Jadvalda **Mock test 9** / **Mock test 10** → PUBLISH. Rules deploy kerak emas.

## Tekshiruvlar
- Builder validatsiyasi PASS (ikkalasi); KaTeX: 468 + 342 formula, xatosiz.
- `E2E_PORT=8811 MOCK=09|10 node tools/attestatsiya-fizika/e2e/e2e_mock_bahor.mjs` — har biri 19/19: import (pullik, rasmlar, takror ogohlantirishi),
  PUBLISH; ruxsatsiz foydalanuvchi — karta qulflangan, start yo‘q, `versions/v1` yopiq; ruxsatli foydalanuvchi — 2 soat, barcha rasmlar, 100/100,
  50 yechim va «Manba xatosi» izohlari; ikkinchi ruxsatli foydalanuvchiga kalit/yechim urinishsiz yopiq.
