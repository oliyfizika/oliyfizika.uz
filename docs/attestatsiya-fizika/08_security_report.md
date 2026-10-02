# 08 — Xavfsizlik hisoboti (Attestatsiya → Fizika, 2-bosqich)

Sana: 2026-10-02 · Holat: Rules repo'da tayyor va lokal sinovdan o'tgan (105/105), **production'ga deploy QILINMAGAN**.

## 1. Asosiy qaror: backend'siz, Rules bilan ishonchli baholash

Repozitoriya tahlili: sayt statik (GitHub Pages, `CNAME`), `firebase.json` da faqat `firestore` bo'limi bor — Cloud Functions, Express yoki boshqa server yo'q. Yangi backend qo'shish Blaze tarifi va deploy infratuzilmasini talab qiladi. Shuning uchun **mavjud arxitektura ichida** xavfsiz yechim tanlandi:

1. **Javob kaliti alohida hujjatda**, oddiy foydalanuvchi uni test vaqtida o'qiy olmaydi. Firestore'da field-level himoya yo'q, shuning uchun public va private ma'lumotlar alohida hujjatlarga ajratilgan.
2. **Javoblar avval qulflanadi (submit)**, kalit faqat shundan keyin o'qiladi.
3. **Natijani klient yozadi, lekin Rules har bir sonni kalit bilan solishtiradi.** Rules `get()` orqali kalitni o'qiy oladi (foydalanuvchi o'qiy olmasa ham) va `answers.diff(key)` bilan to'g'ri/noto'g'ri/javobsiz to'plamlarini aniq hisoblaydi. Bitta noto'g'ri qiymat → butun yozuv rad etiladi. Natijada klient xohlagan `correctAnswers`, `scorePercent` yoki `correctIds` ni yozib qo'ya olmaydi.

Bu "server-side evaluation" bilan bir xil kafolat beradi (natija faqat haqiqiy qiymatga teng bo'lishi mumkin), backend talab qilmaydi. Kelajakda Cloud Function qo'shilsa, data model o'zgarmaydi.

## 2. Ma'lumot qayerda saqlanadi

| Ma'lumot | Joyi | Kim o'qiydi |
|---|---|---|
| Savol matni, variantlar, qiyinlik, mavzu | `attestationPhysicsQuestions/{id}` va `…DailyTests/{t}/versions/v{N}` | admin; foydalanuvchi — faqat kun **published** bo'lsa |
| `correctAnswer` (bank) | `attestationPhysicsQuestions/{id}/private/answer` | **faqat admin** |
| To'liq yechim (bank) | shu private hujjat | **faqat admin** |
| Test kaliti (auto savollar `{id: harf}`) | `…DailyTests/{t}/keys/v{N}` | admin; foydalanuvchi — **o'z rasmiy urinishini topshirgandan keyin** yoki `solutionAvailableAt` dan keyin |
| Test yechimlari | `…DailyTests/{t}/solutions/v{N}` | admin; foydalanuvchi — **faqat `request.time ≥ solutionAvailableAt`** |
| Urinish (javoblar, vaqt, natija) | `attestationPhysicsAttempts/{uid}__{testId}` | egasi va admin |
| Faqat yechimdagi chizmalar (7) | `_private/…/solution-figures/` → keyin Firestore/Storage | ommaviy emas |
| Savol rasmlari | `assets/attestatsiya-fizika/fig/<xesh>` | ommaviy (javob yo'q) |
| Xom materiallar, PDF javoblar, `.sol`, `problems.json` | `attestatsiya/fizika/ATT_EST*` | `.gitignore` — git'ga, saytga chiqmaydi |
| Import fayllari (public + private JSON) | `_private/attestatsiya-fizika/` | `.gitignore` |

## 3. Klientga nima yuboriladi

| Bosqich | Brauzer oladi | Brauzer olmaydi |
|---|---|---|
| Test ochilganda | test meta, snapshot (savollar, variantlar, `evaluationType`), rasmlar | kalit, yechim, private |
| Test davomida | o'z urinish hujjati (`startedAt`, limit) | kalit, yechim |
| SUBMIT dan keyin | kalit (`keys/v{N}`) → ball, to'g'ri/noto'g'ri, to'g'ri javob | to'liq yechim |
| `solutionAvailableAt` (ertasi 00:00 Toshkent) | `solutions/v{N}` — bosqichma-bosqich yechim | bank private hujjati (hech qachon) |

## 4. Firestore Rules modeli

`firestore.rules` ga **faqat yangi blok qo'shildi** (markerlar `>>> attestation-physics` … `<<<`). Mavjud `users`, `xpGrants`, `results` qoidalari baytma-bayt o'zgarmagan (`git diff` — 282 qo'shilgan qator, 0 o'chirilgan). Blok `tools/attestatsiya-fizika/rules/build_rules.py` bilan generatsiya qilinadi. Mavjud `signedIn()`, `isAdmin()` (`users/{uid}.role == 'admin'`) va `userPath()` funksiyalari qayta ishlatiladi.

| Yo'l | read | create | update | delete |
|---|---|---|---|---|
| `attestationPhysicsSettings/config` | signedIn | admin (`accessMode` open/paid, timezone `Asia/Tashkent`, `courseStartDate` **taqiqlangan**) | admin | false |
| `attestationPhysicsQuestions/{id}` | get: admin yoki access + kun visible; list: admin | admin (`correctAnswer`/`solution` maydonlari **taqiqlangan**) | admin | false |
| `…/{id}/private/answer` | admin | admin | admin | false |
| `attestationPhysicsDailyTests/{t}` | get: admin yoki access + `published`; list: `where('published','==',true)` | admin, faqat `draft` | admin: draft tahriri · PUBLISH · versiya +1 · ARCHIVE | false |
| `…/versions/v{N}` | admin yoki access + visible | admin | admin, faqat draft paytida | false |
| `…/keys/v{N}` | admin · o'z urinishi `submitted/graded` (shu versiya) · yoki yechim vaqti | admin | admin, faqat draft | false |
| `…/solutions/v{N}` | admin yoki access + `request.time ≥ solutionAvailableAt` | admin | admin, faqat draft | false |
| `attestationPhysicsAttempts/{uid}__{t}` | egasi, admin | egasi — START | egasi — SUBMIT, keyin GRADE (admin ham grade qila oladi) | false |

### 4.1 Access (OPEN → PAID)

```
attCanAccess() = signedIn() && ( isAdmin()
                                 || settings.accessMode == 'open'
                                 || users/{uid}.attestationAccess == true )
```

Hozir `accessMode: "open"`. PAID ga o'tish uchun admin bitta maydonni o'zgartiradi. `attestationAccess` ni foydalanuvchi o'ziga yoza olmaydi: mavjud `users` qoidalaridagi `hasOnly` ro'yxatlarida bu maydon yo'q (test bilan tasdiqlandi). Admin uni yozishi uchun 8-bosqichda `adminAccessUpdate` ga qo'shiladi. Mehmon (autentifikatsiyasiz) hech narsani o'qiy olmaydi.

### 4.2 Draft himoyasi (Admin Push)

- Draft test, uning snapshoti, savollari, kaliti va yechimi — oddiy foydalanuvchi uchun **DENY** (`get` ham, `list` ham).
- Filtrsiz `list` so'rovi rad etiladi. Foydalanuvchi faqat `where('published','==',true)` bilan so'ray oladi.
- PUBLISH faqat admin tomonidan va shartlar bilan: `publishedAt == request.time`, `publishedBy == auth.uid`, `solutionAvailableAt` kelajakda, savollar ro'yxati va versiya o'zgarmagan, `versions/keys/solutions v{N}` mavjud.
- Published → draft qaytarish yo'q. Archive — yashirish, o'chirmaslik.

### 4.3 Urinish (official attempt) hayot sikli

```
START  (create)  status=in_progress, startedAt=request.time, attemptNumber=1, kind=official,
                 testVersion = test.currentVersion, faqat published (archived emas) va yechim ochilmasdan oldin
SUBMIT (update)  status=submitted, completedAt=request.time, answers={id:'A'..'E'} (faqat shu test savollari),
                 startedAt + timeLimitSeconds + 120 s gacha, yechim ochilmasdan oldin; natija maydonlari TAQIQLANGAN
GRADE  (update)  status=graded, gradedAt=request.time; Rules tekshiradi:
                 d = answers.diff(key.answers)
                 correctAnswers == |d.unchanged|   wrongAnswers == |d.changed|   unanswered == |d.removed|
                 correctIds ⊆ d.unchanged (soni teng)   wrongIds ⊆ d.changed (soni teng)
                 scorableQuestions == key.scorableCount   totalQuestions == questionCount
                 timeSpentSeconds == (completedAt − startedAt).seconds()
                 scorePercent == round(100·correct/scorable)
```

Ikkinchi rasmiy urinish yaratib bo'lmaydi (ID deterministik, qayta yozish rad etiladi). Javoblarni submit'dan keyin o'zgartirib bo'lmaydi. Hech kim (admin ham) urinishni o'chira olmaydi. Practice (mashq) urinishlari keyingi bosqichda alohida yo'lda saqlanadi va rasmiy statistikaga ta'sir qilmaydi.

### 4.4 Vaqt

- Barcha vaqtlar server vaqti (`serverTimestamp()` → Rules'da `== request.time`). Klient soatini o'zgartirish ta'sir qilmaydi.
- `timeSpentSeconds` server timestamplaridan hisoblanadi va Rules'da tekshiriladi (`Day 1 · 1471 s = 24 daq 31 son` sinovdan o'tdi).
- `solutionAvailableAt` = test kunining ertasi 00:00 Asia/Tashkent (UTC 19:00). Firestore'da UTC timestamp sifatida saqlanadi.

## 5. DevTools orqali javobni oldindan olish — oldi olingan

| Hujum | Natija |
|---|---|
| Network/DevTools'da test hujjatlarini ko'rish | snapshot va savollarda `correctAnswer`/`solution` yo'q (pipeline gate + Rules `attNoSecrets`) |
| `keys/v1` ni test paytida to'g'ridan-to'g'ri o'qish | rad (urinish `in_progress`) |
| `solutions/v1` ni o'qish | rad (`solutionAvailableAt` gacha) |
| `private/answer` ni o'qish | rad (faqat admin, har doim) |
| Draft keyingi kun testini oldindan o'qish | rad |
| Statik fayllardan javob topish | repo'da javob fayli yo'q; xom materiallar `.gitignore` da; rasm nomlari xesh |
| Rules'ni "oracle" sifatida ishlatish (har xil natija yozib, qaysi biri qabul qilinishini sinash) | ishlamaydi: GRADE faqat SUBMIT dan keyin, javoblar o'shanda qulflangan; submit bosqichida natija maydonlari umuman taqiqlangan |
| `scorePercent: 100` yoki `correctAnswers` ni o'zi yozish | rad (10 xil soxta variant va 270 tasodifiy buzilgan natija sinovdan o'tdi) |
| Boshqa userning urinishini o'qish/yozish | rad |
| Muddat o'tgach rasmiy urinish boshlash (yechim ochilgach) | rad |

## 6. Qolgan xavflar (attack surface) va cheklovlar

1. **Bir nechta akkaunt (sybil).** Talab bo'yicha foydalanuvchi submit'dan keyin darhol to'g'ri javobni ko'radi, shuning uchun ikkinchi akkaunt bilan bo'sh topshirib, kalitni ko'rib, asosiy akkauntda yechish mumkin. Bu "submit'dan keyin to'g'ri javob ko'rsatish" talabining o'zidan kelib chiqadi va hech qanday arxitektura buni to'liq yopolmaydi. Yumshatish: email tasdiqlash (mavjud), admin statistikada g'ayritabiiy tez/100% natijalarni ko'rish, kerak bo'lsa PAID rejim.
2. **Savol rasmlari ommaviy.** `assets/…/fig/` dagi rasmlar draft kun uchun ham URL orqali ochiq (nomi xesh, ro'yxati yo'q). Agar GitHub repo public bo'lsa, rasmlarni repo ichida ko'rish mumkin. Rasmlarda javob yo'q. To'liq yopish kerak bo'lsa — Firebase Storage + Rules (3-bosqichda variant).
3. **Lokal Rules sinovi rasmiy emulyator emas.** Bu muhitda Firebase Emulator yuklab olinmaydi (Google Storage bloklangan). Sinovlar `tools/attestatsiya-fizika/rules/rules_eval.py` (loyiha uchun yozilgan mini-interpretator) bilan o'tkazildi. **Deploy'dan oldin majburiy:** Firebase Console → Rules Playground'da asosiy holatlar (draft get, keys get in_progress/submitted, grade to'g'ri/soxta) yoki `firebase emulators:exec` bilan `test_rules.py` ssenariylarini takrorlash. Ayniqsa tekshirilishi kerak: `MapDiff.unchangedKeys/changedKeys/removedKeys` yo'nalishi, `Duration.seconds()`, `timestamp + duration.value(…)`.
4. **Vaqt limiti qat'iy.** Limit + 120 s o'tgach submit rad etiladi; urinish `in_progress` qoladi va rasmiy natija bo'lmaydi. Frontend taymer tugaganda avtomatik submit qilishi va javoblarni localStorage'da saqlab turishi kerak (3-bosqich).
5. **GRADE yozilmasa.** Foydalanuvchi submit'dan keyin sahifani yopsa, urinish `submitted` qoladi; keyingi kirishda frontend yoki admin `grade` qiladi (Rules ruxsat beradi). Statistikada `submitted` holat ham hisobga olinadi.
6. **Mavjud `results` kolleksiyasi** ishlatilmaydi va o'zgartirilmagan. Attestatsiya natijalari XP va Umumiy fizika progressiga aralashmaydi.
7. **Git tarixi:** `attestatsiya/fizika` va `_private` hech qachon commit qilinmagan (`git log --all` — 0). History rewrite kerak emas.

## 7. Raw material xavfsizligi

- `.gitignore` (yangi): `/attestatsiya/fizika/ATT_EST/`, `/attestatsiya/fizika/ATT_EST solutions/`, `/_private/`, `__pycache__/`.
- `git check-ignore` bilan tasdiqlandi. `git status -uall` da xom/private fayllar ko'rinmaydi, faqat `attestatsiya/fizika/.DS_Store` qoldi (macOS fayli, xavfsiz).
- Kuzatiladigan (tracked/untracked) fayllarda `"correctAnswer"` qidirildi — faqat skript kodida maydon nomi sifatida uchradi, ma'lumot sifatida yo'q.
- Xom materiallar o'z joyida qoldi, ko'chirilmadi. Ixtiyoriy: ularni repo tashqarisiga ko'chirish yanada xavfsiz (masalan, boshqa vosita `.gitignore` ni hisobga olmasa).
- Diqqat: repo ildizidagi `Claude outputs/` papkasi (oldingi sessiya nusxalari, javobsiz) untracked holatda. Uni commit qilish yoki qilmaslik — sizning qaroringiz.
