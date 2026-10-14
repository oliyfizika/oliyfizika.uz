# 26 — Kunlik testlar: istalgan kunda 1 marta, 2 soat, yechim yakunlaganda

Holat: lokal; Firestore Rules deploy kerak (Storage Rules — faqat `figureBackend == "storage"` bo'lsa). 25-hujjatni qisman almashtiradi.

## Qoida (faqat kunlik testlar; mock o'zgarmagan)

- Foydalanuvchi e'lon qilingan istalgan kunlik testni **istalgan kunda, 1 marta** boshlaydi (yechim vaqti start'ni to'smaydi).
- Start'dan **2 soat** (7200 s) limit. Qolgan vaqt server `startedAt` bo'yicha — sahifa yangilansa davom etadi.
- Yechimlar va javob kaliti **faqat o'z urinishi yakunlangach** ochiladi: qo'lda topshirish yoki vaqt tugaganda avto-yakun (`completedAt = startedAt + 2 soat`, grace 60 s).
- Vaqt bo'yicha ochilish kunlik testlarda yo'q. `solutionAvailableAt` maydoni saqlanadi (mock uchun).
- Mock: avvalgidek (24-hujjat): oyna `solutionAvailableAt` gacha, limit `min(start+2 soat, solutionAvailableAt)`, yechim yakunlanganda yoki yechim vaqtida.

## Rules / klient
`attLimitSec`, `attLimitEnd`, `attLimited`, `attAutoFrom`, `attValidStart` (mock-only vaqt cheklovi); `attKeyReadable`/`attSolutionReadable`/`solutionFigures` — kunlik: faqat `attOwnFinished*`. `core.js`: `timeLimitOf` (kunlik default 7200), `solutionOpenFor`, `officialOpen`; `finalize-core.js`: `completedAt = startedAt + timeLimitOf`.

## Oqibat
Day'ni yakunlamagan foydalanuvchilar avvalgi vaqt bo'yicha ochilishni yo'qotadi. 2 soatdan oshgan `in_progress` urinishlar keyingi kirishda avto-yakunlanadi.

## Testlar
Rules 331, unit (auto_finalize 21, mock 39, early 14), E2E: barcha suite PASS.
