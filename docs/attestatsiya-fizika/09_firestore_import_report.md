# 09 — Firestore import hisoboti (Attestatsiya → Fizika, 2-bosqich)

Holat: **DRY-RUN PASS**. Production Firestore'ga hech narsa yuborilmagan. Rules va indekslar repo'da, deploy qilinmagan.

## 1. Kolleksiyalar

| Kolleksiya / yo'l | Hujjatlar | Vazifa |
|---|---:|---|
| `attestationPhysicsSettings/config` | 1 | global sozlamalar |
| `attestationPhysicsQuestions/{AF-x-nnn}` | 1027 | public savol banki (javobsiz) |
| `attestationPhysicsQuestions/{id}/private/answer` | 1027 | javob, yechim, manba, review — faqat admin |
| `attestationPhysicsDailyTests/{att-fizika-day-NN}` | 32 | Day meta, status, publish/yechim vaqti |
| `…/{testId}/versions/v{N}` | 32 | o'zgarmas public snapshot: test savollari tartibda, javobsiz |
| `…/{testId}/keys/v{N}` | 32 | auto savollar kaliti `{id: harf}` + `scorableCount` |
| `…/{testId}/solutions/v{N}` | 32 | yechimlar (vaqt bo'yicha ochiladi) |
| `attestationPhysicsAttempts/{uid}__{testId}` | (foydalanuvchilar) | rasmiy urinish va natija |

Siz so'ragan 4 ta kolleksiyadan tashqari qo'shilgan yo'llar va sababi:

- **`private/answer` sub-hujjati.** Firestore'da maydon darajasidagi himoya yo'q. `correctAnswer` va `solution` public savol hujjatida tursa, uni o'qigan foydalanuvchi ularni ham oladi.
- **`versions/keys/solutions` sub-kolleksiyalari** uch xil o'qish shartiga ega: published bo'lsa; submit'dan keyin; ertasi kuni. Har biri alohida hujjat bo'lgani uchun Rules ularni alohida ochadi. Versiyalash ham shu yerda (§4). Ular yangi top-level kolleksiya emas, `attestationPhysicsDailyTests` ichida joylashgan.

## 2. Hujjat sxemalari

**`attestationPhysicsSettings/config`**

```json
{ "accessMode": "open", "timezone": "Asia/Tashkent", "utcOffsetMinutes": 300, "totalDays": 32,
  "defaultTimeLimitSeconds": 3600, "submitGraceSeconds": 120, "solutionRelease": "nextCourseDayMidnight",
  "officialAttemptsPerTest": 1, "schemaVersion": 1, "planHash": "00035719f689704f" }
```

`courseStartDate` yo'q va Rules uni qo'shishga ruxsat bermaydi.

**`attestationPhysicsQuestions/{id}`** (public): `id, schemaVersion, section, sectionTitle, topic, type, evaluationType (auto|open|unreliable), difficulty (easy|medium|hard|expert), difficultyLevel, question[], options[{key, blocks}], optionCount, testId, dayNumber, position, bookNumber, contentVersion`.

**`…/private/answer`**: `id, evaluationType, evaluationNote, correctAnswer, bookAnswer, solutionResult, solution[], solutionStatus, verify, source{sourceId, code, file, number, page, taxonomy, alsoIn[]}, difficultyRaw{level, labelUz, score}, review{check, fixes, answerSource, note, category}, contentVersion`.

**`attestationPhysicsDailyTests/{testId}`**

```
id, course: "fizika", schemaVersion, dayNumber, section, sectionTitle, topics[], topicParts[],
questionIds[], questionCount, scorableCount, openCount, unreliableCount, difficulty{1..4}, bookRange,
status: "draft"|"published"|"archived", published: bool,
publishAt (rejalashtirilgan, ixtiyoriy), publishedAt, publishedBy, solutionAvailableAt, archivedAt,
timeLimitSeconds: 3600, currentVersion: 1, planHash,
notification { title: "Bugungi attestatsiya testi tayyor!", body: "Day N · mavzular · K savol", href }
```

**`versions/v{N}`**: `testId, version, dayNumber, questionIds[], questions[]` (public savol maydonlari, tartib bilan).
**`keys/v{N}`**: `testId, version, questionIds[], answers{id: "A".."E"}` (faqat auto), `scorableCount`.
**`solutions/v{N}`**: `testId, version, questionIds[], items[{id, evaluationType, correctAnswer, solutionResult, solutionStatus, solution[]}]`.

**`attestationPhysicsAttempts/{uid}__{testId}`**

| Maydon | START | SUBMIT | GRADE |
|---|:-:|:-:|:-:|
| `userId, testId, dayNumber, testVersion, attemptNumber(1), kind("official"), timeLimitSeconds, questionCount` | ✓ | | |
| `status` | in_progress | submitted | graded |
| `startedAt` | server | | |
| `completedAt` | | server | |
| `answers {questionId: "A".."E"}` (javobsiz savol yozilmaydi) | | ✓ | |
| `gradedAt, timeSpentSeconds, totalQuestions, scorableQuestions, correctAnswers, wrongAnswers, unanswered, scorePercent, correctIds[], wrongIds[]` | | | ✓ (Rules tekshiradi) |

Har bir savol bo'yicha holat (`selectedAnswer`, `isCorrect`, `evaluationType`, to'g'ri javob) `answers` + `correctIds/wrongIds` + kalit + snapshotdan hosil qilinadi. Shu sababli hujjat kichik qoladi (≤ 40 yozuv) va har bir qiymatni Rules tekshira oladi. Mavzu/bo'lim statistikasi `correctIds` + snapshotdagi `topic` dan hisoblanadi; kalitni qayta o'qish shart emas.

## 3. Indekslar (`firestore.indexes.json`, qo'shildi, mavjudlari o'zgarmagan)

| Kolleksiya | Maydonlar | So'rov |
|---|---|---|
| `attestationPhysicsDailyTests` | `published ASC, dayNumber ASC` | foydalanuvchi: published testlar, kun tartibida |
| `attestationPhysicsAttempts` | `userId ASC, dayNumber ASC` | "mening natijalarim", statistika |
| `attestationPhysicsAttempts` | `testId ASC, completedAt DESC` | admin: kun bo'yicha natijalar |

Admin draft ro'yxati (`orderBy dayNumber`) single-field indeks bilan ishlaydi.

## 4. Versiyalash (immutable snapshot)

- Test `currentVersion` ga ishora qiladi. `versions/v1`, `keys/v1`, `solutions/v1` — birinchi versiya.
- Test **published** bo'lgach, v1 hujjatlarini tahrirlash Rules bilan taqiqlanadi.
- Savol tuzatilsa: admin `v2` (snapshot + kalit + yechim) yaratadi va `currentVersion: 2` qiladi. Rules buni faqat v2 hujjatlari mavjud bo'lsa qabul qiladi.
- Urinish `testVersion` ni saqlaydi va har doim **o'z versiyasining kaliti** bilan baholanadi. Eski natijalar buzilmaydi. Sinovda v1 urinish egasi v1 kalitini o'qiydi, v2 ni o'qiy olmaydi.
- Bank darajasida savol `contentVersion` ga ega (tarix uchun).

## 5. Import strategiyasi

1. **Build:** `prepare_attestation_data.py` → `_private/attestatsiya-fizika/firestore-import.json` (2183 operatsiya, `contentHash 0f25934873d22fe1`). Validatsiya FAIL bo'lsa fayl yozilmaydi.
2. **Dry-run:** `tools/attestatsiya-fizika/rules/test_rules.py` bundle'ni xotiradagi Firestore modeliga admin sifatida, repo `firestore.rules` orqali yozadi.
3. **Real import (3-bosqich):** admin panelda "Import" — admin `firestore-import.json` ni o'z kompyuteridan tanlaydi, brauzerda o'qiladi (serverga fayl yuklanmaydi). Avval farq jadvali ko'rsatiladi, keyin `writeBatch` (≤ 400 operatsiya/batch) bilan yoziladi. Service account kerak emas, admin sessiyasi va Rules ishlatiladi.
4. **Idempotent:** deterministik yo'llar. Snapshot/kalit/yechim `create` (bor bo'lsa o'tkazib yuboriladi). Published testga import tegmaydi. `delete` operatsiyasi umuman yo'q.
5. **Tartib:** settings → savollar (+private) → test (draft) → versions/keys/solutions. Publish importdan keyin, admin tugmasi bilan.
6. **Tekshiruv:** import'dan keyin admin sahifasi hujjatlar sonini (1 + 1027 + 1027 + 32 + 96) va `planHash` ni read-back qiladi.

## 6. Dry-run natijasi

```
Questions     1027      Daily Tests   32
Auto          865       Open          81       Unreliable  81
Assigned      1027      Missing       0        Duplicates  0
Operations    2183/2183 allowed (admin, repo firestore.rules)
Max doc size  41.1 KB   (att-fizika-day-21/solutions/v1; chegara 1 MiB)
Validation    PASS (28/28 gate, KaTeX 16146/16146)
Rules tests   105/105 PASS · max get() per request 4 (chegara 10)
```

Ssenariylar ro'yxati (hammasi PASS):

- [x] dry-run import: barcha operatsiyalar Rules'dan o'tdi va hisoblar to'g'ri
- [x] user import qila olmaydi (dailyTest create) · user savol yozolmaydi
- [x] mehmon settings o'qiy olmaydi · mehmon draft testni o'qiy olmaydi · mehmon published testni ham o'qiy olmaydi
- [x] user draft testni / draft versiyani / draft savolni o'qiy olmaydi · admin draft testni o'qiydi
- [x] user published-filtrli so'rov — ruxsat · user filtrsiz test so'rovi — rad
- [x] user private javobni o'qiy olmaydi (ertasi kuni ham) · user savollar ro'yxatini (list) ololmaydi
- [x] user publish qila olmaydi · publish: o'tgan solutionAvailableAt / klient publishedAt / savollar ro'yxati o'zgargan / versiya hujjatlarisiz — rad
- [x] ADMIN PUBLISH Day 1 · status=published, publishedAt=server vaqt · solutionAvailableAt = ertasi 00:00 Toshkent (19:00 UTC)
- [x] user published Day 1, snapshot va savol hujjatini o'qiydi · snapshotda correctAnswer/solution yo'q
- [x] user Day 2 (draft) testi va savoli hali yopiq
- [x] kalit: urinishsiz — rad · kalit: in_progress paytida — rad (DevTools orqali oldindan olib bo'lmaydi)
- [x] yechim: vaqtidan oldin — rad · submit'dan keyin ham hali yopiq
- [x] start: boshqa user nomidan / noto'g'ri attemptId / klient startedAt / attemptNumber 2 / oldindan scorePercent / draft Day 2 — rad
- [x] start: to'g'ri — ruxsat · qayta (2-rasmiy urinish) — rad
- [x] user2 user1 urinishini o'qiy olmaydi · user1 o'z urinishini o'qiydi · user2 barcha urinishlar so'rovi — rad · user1 userId filtri bilan — ruxsat · admin hammasini ko'radi
- [x] submit: noto'g'ri harf / begona savol ID / answers ro'yxat (map emas) / correctAnswers-scorePercent'ni o'zi yozish / klient completedAt / vaqt limiti (+120 s) o'tgach / boshqa user — rad
- [x] submit: to'g'ri — ruxsat · javoblarni keyin o'zgartirish — rad
- [x] kalit: submit'dan keyin — ruxsat (darhol natija va to'g'ri javob) · boshqa user (urinishsiz) — rad
- [x] grade soxta — rad: correctAnswers +1 · scorePercent 100 · scorePercent +1 · noto'g'ri javob correctIds'ga ko'chirilgan · baholanmaydigan savol correctIds'da · wrongAnswers · unanswered · timeSpentSeconds · scorableQuestions · qo'shimcha maydon (isCorrect) · answers'ni grade bilan o'zgartirish
- [x] grade: user2 boshqa urinishni baholay olmaydi · to'g'ri grade — ruxsat · Day/ball/vaqt saqlandi · qayta grade — rad
- [x] admin boshqa userning topshirilgan urinishini baholaydi · 100% natija to'g'ri (faqat auto savollar)
- [x] user ham, admin ham urinishni o'chira olmaydi · admin test va savolni o'chira olmaydi
- [x] yechim: solutionAvailableAt'dan 1 daqiqa oldin — rad · ertasi kuni — ruxsat · urinishsiz user ham ertasi kuni ko'radi
- [x] rasmiy urinish: yechim ochilgach start — rad
- [x] published v1 snapshot'ni tahrirlash — rad · currentVersion +1 (v2 tayyor) — ruxsat · eski urinish v1 bilan qoladi · user1 v1 kalitini o'qiydi, v2 ni emas
- [x] archive — ruxsat · archived test user'ga ko'rinadi · archived → draft — rad
- [x] settings: user accessMode'ni o'zgartira olmaydi · courseStartDate qo'shib bo'lmaydi
- [x] PAID: admin accessMode=paid · ruxsatsiz user — rad · user attestationAccess'ni o'ziga yozolmaydi · attestationAccess=true user — ruxsat · admin — ruxsat · open rejimga qaytdi
- [x] public savolga correctAnswer yozish (admin xatosi) — rad
- [x] regressiya: results create (mavjud qoida) — ruxsat · o'ziga fullAccess yozish — rad · ism yangilash — ruxsat
- [x] simulyatsiya: Day 3–32 (30 kun) × 3 user — 90/90 baholash qabul, 270/270 soxta natija rad
- [x] Rules get() chegarasi (≤10) saqlangan (max 4)

To'liq ro'yxat (105 ta): `_private/attestatsiya-fizika/rules-test-report.json`.

## 7. Deploy (3-bosqichda, qo'lda)

1. Firebase Console → Firestore → Rules → repo `firestore.rules` ni Playground'da sinash (08 hisobot §6.3), so'ng Publish. Yoki `firebase deploy --only firestore:rules,firestore:indexes`.
2. Indekslar qurilishini kutish.
3. Admin panel orqali import.
