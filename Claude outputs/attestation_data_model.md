# Attestatsiya → Fizika: data model

Holat: **taklif** (1-bosqich). Firestore'ga hali hech narsa yozilmagan, `firestore.rules` o'zgartirilmagan.

Tamoyillar:

1. Javob va yechim ommaviy statik faylda bo'lmaydi — faqat Firestore'da, vaqt bo'yicha Rules bilan ochiladi.
2. Hech narsa o'chirilmaydi: test `archived` bo'ladi; Rules'da `delete: if false`.
3. Global kurs kalendari: kun raqami = admin publish qilgan Day; individual `courseStartDate` yo'q.
4. Access hozir OPEN; PAID ga o'tish = bitta config maydonini o'zgartirish.
5. Vaqtlar server vaqti (`serverTimestamp()` / Rules'da `== request.time`).

---

## 1. Savol (bank yozuvi)

`attestationBank/{qid}` — admin-only master nusxa. Build skripti `bank.json` da ham shu shakl.

| Maydon | Tur | Manba / izoh |
|---|---|---|
| `id` | string | `AF-{bob}-{nnn}`, masalan `AF-1-001` = kitobdagi 1-bob 1-masala. Barqaror, kitob raqami bilan 1:1 |
| `sourceId` | string | `F06-001` (asl PDF kodi + savol tartibi) |
| `source` | map | `{ file: "AT-11.pdf", number: 1, page: 1, alsoIn: ["F03-004", …] }` (`map.txt`, `.qtx`, `% Also in`) |
| `bookNumber` | string | `"1.1"` — PDF kitob bilan moslik |
| `section` | string | `mexanika` · `molekulyar` · `elektromagnetizm` · `optika` · `atom-yadro` · `maxsus` |
| `sectionTitle` | string | "Mexanika" … |
| `topic` | string | 41 mavzudan biri (`problems.json.section`), masalan "Kinematika" |
| `type` | string | `mcq` · `match` · `multi` · `open` (match/multi ham bitta harf javobli) |
| `question` | array<Block> | §5 dagi xavfsiz bloklar (LaTeX'dan konvertatsiya) |
| `options` | array<Block[]> | 4 yoki 5 variant (A…E); `open` uchun `[]` |
| `figure` | string \| null | `assets/attestatsiya-fizika/fig/AF-1-001.svg` (TikZ) yoki `.webp` (PNG) |
| `correctAnswer` | string \| null | `"B"`; aniqlanmagan bo'lsa `null` |
| `scoring` | string | `auto` (865) · `self-check` (81, variantsiz) · `excluded` (81, javob ishonchsiz) |
| `solution` | array<Block> | `.sol` tanasidan (`\shart` → "Berilgan", `\javob`, `\tekshiruv`) |
| `solutionStatus` | string | `full` · `theory` · `undetermined` · `source_error` |
| `difficulty` | int 1–4 | `.qtx` (1 oson … 4 juda murakkab) |
| `review` | map | `{ check: "TEKSHIRISH KERAK sababi", fixes, verify: OK/NEW/XATO/NONE, note }` — faqat admin |
| `version` | int | kontent versiyasi (admin tahrir qilsa +1) |
| `dayNumber` | int | rejadagi Day (1 savol → 1 kun) |

---

## 2. Daily Test

`attestationTests/{testId}`, `testId = "fizika-day-01"` … `"fizika-day-32"`.

| Maydon | Tur | Izoh |
|---|---|---|
| `id` | string | `fizika-day-NN` |
| `course` | string | `"fizika"` (kelajakda boshqa fanlar uchun) |
| `dayNumber` | int | 1…32 |
| `section` / `sectionTitle` | string | bitta kun doim bitta bo'lim ichida |
| `topics` | string[] | masalan `["Ish, energiya, quvvat", "Impuls", "Gravitatsiya"]` |
| `questionIds` | string[] | tartiblangan `AF-…` ID'lar |
| `questionCount` | int | 25–40 |
| `scoredCount` | int | ballga kiradigan savollar soni |
| `publishDate` | Timestamp \| null | admin PUBLISH bosgan payt (`request.time`) |
| `published` | bool | |
| `solutionAvailableAt` | Timestamp \| null | publishda hisoblanadi: publish kunining ertasi 00:00 Asia/Tashkent (config bilan sozlanadi) |
| `status` | string | `draft` → `published` → `archived` |
| `planHash` | string | `daily_test_plan.json` versiyasi |
| `contentVersion` | int | |
| `createdAt`, `updatedAt`, `publishedBy` | | audit |

Status mashinasi (faqat admin; orqaga qaytish va o'chirish yo'q):

```
draft ──PUBLISH──► published ──(ixtiyoriy)──► archived
```

`archived` test "Bugungi test"da ko'rinmaydi, lekin natija va yechimlar o'qiladi.

Kontent sub-hujjatlari (ID'lari parent `testId` path o'zgaruvchisi orqali tekshiriladi — Rules'da `get()` arzon va list so'rovlar muammosiz):

| Hujjat | Kim o'qiydi | Mazmuni |
|---|---|---|
| `attestationTests/{testId}/content/questions` | access bor + test `published` (yoki admin) | `{ questions: [{ id, n, type, topic, difficulty, scoring, question, options, figure }], version }` — **javobsiz** |
| `attestationTests/{testId}/content/key` | admin, yoki access bor + `published` + `request.time >= solutionAvailableAt` | `{ answers: { "AF-1-001": "A", … }, solutions: { "AF-1-001": { blocks, status } }, version }` |

Hajm: 40 savol × ~1.5 KB yechim ≈ 60–80 KB — 1 MB chegarasidan ancha past.

---

## 3. Global kurs kalendari

Individual sana yo'q. Hamma uchun bir xil:

```
currentDay      = max(dayNumber) published testlar ichida
todayTest       = published && now < solutionAvailableAt         (odatda bitta)
reviewTests     = published && now >= solutionAvailableAt        (natija + yechim)
upcoming        = draft (foydalanuvchiga ko'rinmaydi)
```

Yangi foydalanuvchi bugun qo'shilsa — `todayTest` ni ko'radi, oldingi kunlar arxivda (yechimlari ochiq). O'tib ketgan kun testini **rasmiy** topshirib bo'lmaydi (kalit ochilgan); arxivda mashq rejimi (ball saqlanmaydi) — 2-bosqichda tasdiqlanadi.

`config/attestationFizika`:

```js
{
  accessMode: "open",            // "open" | "paid"
  solutionRelease: "nextDayMidnight", // yoki "plus24h"
  timezone: "Asia/Tashkent",
  title: "Attestatsiya — Fizika",
  updatedAt, updatedBy
}
```

---

## 4. Urinish va natija

`attestationAttempts/{uid}_{testId}` — **bitta foydalanuvchi + bitta test = bitta rasmiy urinish** (deterministik ID; qayta ishlash — faqat mashq rejimi, saqlanmaydi).

| Maydon | Qachon | Tekshiruv (Rules) |
|---|---|---|
| `userId` | create | `== request.auth.uid` |
| `testId`, `dayNumber`, `section` | create | test mavjud, `published`, `request.time < solutionAvailableAt` |
| `startedAt` | create | `== request.time` |
| `status` | create: `in_progress` → submit: `submitted` → baholash: `graded` | faqat shu tartibda |
| `answers` | submit | map `{ qid: "A"…"E" \| null }`, kalitlar ⊆ `questionIds`, ≤ 40 |
| `completedAt` | submit | `== request.time`, `< solutionAvailableAt` |
| `timeSpentSec` | submit | `== (completedAt − startedAt).seconds()` — Rules hisoblab tekshiradi |
| `totalQuestions` | grade | `== test.scoredCount` |
| `correctAnswers` | grade | `0 ≤ … ≤ totalQuestions` |
| `wrongAnswers` | grade | `== totalQuestions − correctAnswers − unanswered` |
| `unanswered` | grade | |
| `scorePercent` | grade | `round(correct/total·100)` (Rules butun sonli tekshiruv, `results` dagi kabi) |
| `byTopic` | grade | `{ "Kinematika": { total, correct } }` — mavzu statistikasi uchun |
| `gradedAt` | grade | `== request.time`, `>= test.solutionAvailableAt` |

Javoblar topshirilgunga qadar faqat brauzerda (localStorage qoralama, mock engine `storage.js` kabi) — Firestore'ga 2 ta yozuv: start va submit (+ baholash).

**Ball hisoblash.** Kalit ochilgach (ertasi kuni) sahifa `content/key` ni o'qib, o'zgarmas `answers` dan ballni hisoblaydi va `graded` maydonlarini **bir marta** yozadi. Vaqt (`startedAt`, `completedAt`, `timeSpentSec`) va javoblar server tomonidan qat'iy; `correctAnswers` hozircha klient hisoblaydi (avvalgi 19C/19D bilan bir xil cheklov). Admin sahifasi har bir urinishni kalit bilan **qayta hisoblab** tekshiradi; kelajakda Cloud Function (19D) bilan server-authoritative bo'ladi — model o'zgarmaydi.

Ko'rinish: `Day 10 · 92% · 24 daq 31 son` = `dayNumber`, `scorePercent`, `timeSpentSec`.

---

## 5. Savol/yechim matni (bloklar)

LaTeX to'g'ridan-to'g'ri brauzerga berilmaydi. Build skripti xavfsiz bloklarga aylantiradi:

```json
[
  { "t": "p",     "text": "Jism $v_0=20\\,\\mathrm{m/s}$ tezlik bilan otildi." },
  { "t": "list",  "style": "1)", "items": ["Poyezd Toshkentdan Termizga bordi;", "…"] },
  { "t": "table", "rows": [["$t$, s", "0", "2"], ["$v$, m/s", "4", "8"]] },
  { "t": "math",  "tex": "h_{\\max}=\\frac{v_0^2}{2g}" },
  { "t": "img",   "src": "assets/attestatsiya-fizika/fig/AF-1-005.svg", "alt": "Chizma" },
  { "t": "note",  "kind": "answer", "text": "B)" }
]
```

Renderer `textContent` bilan yozadi, `$…$`/`\[…\]` qismlarini KaTeX (`trust:false`) bilan chizadi. KaTeX qo'llamaydigan makrolar build vaqtida almashtiriladi: `\upmu`→`\mu`, `\AA`→`\text{Å}`, `\tekshir`, `\vspace`, `\small` olib tashlanadi; har bir formula build paytida KaTeX bilan sinovdan o'tkaziladi.

---

## 6. Statistika (hisoblanadigan, alohida kolleksiyasiz)

Foydalanuvchida ko'pi bilan 32 ta urinish — statistika `attestationAttempts where userId == uid` dan brauzerda hisoblanadi:

| Ko'rsatkich | Formula |
|---|---|
| Kunlik natijalar | har bir `graded` urinish: Day, %, vaqt |
| Jami ishlangan testlar | `count(status in [submitted, graded])` |
| O'rtacha / eng yuqori / eng past | `avg/max/min(scorePercent)` (`graded`) |
| Jami vaqt / o'rtacha vaqt | `sum/avg(timeSpentSec)` |
| Bo'lim bo'yicha (Mexanika 87% …) | `Σ byTopic.correct / Σ byTopic.total`, mavzular bo'limga guruhlanadi |
| Mavzu bo'yicha | `byTopic` to'g'ridan-to'g'ri |

Admin uchun umumiy statistika (hamma foydalanuvchilar): admin `attestationAttempts` ni `testId` bo'yicha o'qiydi (indeks: `testId ASC, completedAt DESC`).

---

## 7. Access modeli

```
// firestore.rules (taklif — hali qo'llanmagan)
function attCfg() { return get(/databases/$(database)/documents/config/attestationFizika).data; }
function canAccessAttestation() {
  return signedIn() && (
    attCfg().accessMode == 'open'
    || isAdmin()
    || get(userPath(request.auth.uid)).data.get('fullAccess', false) == true
    || get(userPath(request.auth.uid)).data.get('attestationAccess', false) == true
  );
}
```

- **Hozir (OPEN):** `accessMode: "open"` — har bir autentifikatsiyadan o'tgan foydalanuvchi. `users` hujjatiga hech qanday majburiy maydon qo'shilmaydi.
- **Kelajak (PAID):** admin `accessMode: "paid"` qiladi; `attestationAccess` ni faqat admin yozadi (`adminAccessUpdate` ga `attestationAccess` qo'shiladi; `validNewProfile`/`ownerProfileUpdate` uni ruxsat etmaydi — o'ziga yozib ololmaydi). Admin "Kirish huquqlari" sahifasiga bitta ustun qo'shiladi (`ACCESS_LABEL`). To'lov tizimi alohida loyiha.
- Klient UI ham shu funksiyani takrorlaydi (qulf ekrani), lekin haqiqiy himoya Rules'da.

---

## 8. Rules qoidalari (taklif, qisqa)

| Yo'l | read | create | update | delete |
|---|---|---|---|---|
| `config/attestationFizika` | signedIn | admin | admin | **false** |
| `attestationBank/{qid}` | admin | admin | admin | **false** |
| `attestationTests/{t}` | admin, yoki access + `published` | admin | admin (status faqat oldinga) | **false** |
| `…/content/questions` | admin, yoki access + parent `published` | admin | admin, faqat parent `draft` | **false** |
| `…/content/key` | admin, yoki access + parent `published` + `request.time >= solutionAvailableAt` | admin | admin | **false** |
| `attestationAttempts/{uid_t}` | egasi, admin | egasi (§4) | egasi: submit (bir marta), grade (bir marta) | **false** |

Indekslar (`firestore.indexes.json` ga qo'shiladi): `attestationTests (published ASC, dayNumber DESC)`, `attestationAttempts (userId ASC, dayNumber ASC)`, `attestationAttempts (testId ASC, completedAt DESC)`.
