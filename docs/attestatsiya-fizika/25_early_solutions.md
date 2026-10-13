# 25 — Yechimlar: testni yakunlagan zahoti ochiladi

Holat: **lokal, commit/push/deploy qilinmagan** (Firestore Rules va Storage Rules deploy kerak).

## Qoida

| Foydalanuvchi | Yechimlar (to'liq, bosqichma-bosqich) |
|---|---|
| Rasmiy urinishini **yakunlagan** (`submitted` / `graded` — qo'lda topshirgan yoki avto-yakunlangan) | **darhol** — yechim vaqtini kutmaydi |
| Yakunlamagan (urinish yo'q yoki `in_progress`) | avvalgidek: `solutionAvailableAt` (e'londan keyingi kun 00:00, Toshkent) |

Barcha testlarga (kunlik 1..N va mock) qo'llanadi. Natija va javob kaliti avval ham topshirgan zahoti ochilar edi — o'zgarmagan.
`solutionAvailableAt`, `testVersion`, urinishlar, tarixiy statistika, `fullAccess`/`attestationAccess` modeli o'zgarmagan.

## Server (Rules)

- `firestore.rules`: `attOwnFinished(testId)`, `attOwnFinishedVersion(testId, v)` (kalit qoidasi shu helperga ko'chirildi — xatti-harakat o'zgarmagan), `attSolutionReadable(testId, v)`.
  - `solutions/v{N}` — `attVisible && ((solutionOpen && contentAccess) || o'z urinishi yakunlangan va testVersion == N)`.
  - `solutionFigures/{id}` — shu qoida (versiyasiz).
  - Foydalanuvchi o'ziga ruxsat bera olmaydi: `status`ni faqat Rules ruxsat etgan o'tishlar (start → submit → grade) bilan o'zgartiradi; boshqa foydalanuvchining urinishi hisobga olinmaydi (hujjat ID = `{uid}__{testId}`).
- `storage.rules`: `ownFinished(testId)` — yechim rasmlari (faqat `figureBackend == "storage"` bo'lsa; Firestore backend uchun yuqoridagi qoida yetarli). **Storage Rules alohida deploy qilinadi.**
- `test_rules.py` 315 tekshiruv (yangi: yakunlagan — ruxsat, boshqa user/in_progress/draft — rad, boshqa versiya — rad, paid rejim, rasmlar, 32 kunlik simulyatsiya).

## Klient

- `core.js`: `isFinished(attempt)`, `solutionOpenFor(test, attempt, now)`.
- Dashboard (Bugungi test, kunlik kartalar, mock kartasi): «Yechimlar ochiq» chip + «Yechimlar» tugmasi yakunlagan zahoti.
- Test natija sahifasi: «To'liq bosqichma-bosqich yechimlar ochiq» + har savolda «To'liq yechim» havolasi.
- `fizika-yechimlar.html`: ro'yxat va kun sahifasi (yakunlamagan `in_progress` foydalanuvchiga «… da yoki testni topshirganingiz zahoti» deyiladi); oldingi/keyingi tugmalari ham.
- Natijalar tarixi: «Ochiq» havolasi.
- Matnlar yangilandi (dashboard, `attestatsiya/index.html`, admin PUBLISH tasdig'i).

## Testlar

`test_early_solutions.mjs` (10), `test_rules.py` (315), E2E: `e2e.mjs`, `e2e_review.mjs`, `e2e_mock.mjs` (yangi tekshiruvlar: topshirgan — ochiq, `in_progress`/urinishsiz — yopiq, to'g'ridan-to'g'ri Firestore o'qish).

## Eslatma

- Erta topshirgan foydalanuvchi yechimlarni boshqalarga ulashishi mumkin (bu qoidaning o'zida bor; rasmiy urinish bitta, qayta topshirib bo'lmaydi).
- Deploy tartibi: Firestore Rules (`firebase deploy --only firestore:rules --project oliy-fizika`) → sayt kodi (merge) → (kerak bo'lsa) Storage Rules.
