# 11 — 3-bosqich: implementatsiya hisoboti

Sana: 2026-10-02 · Branch: `redesign/oliyfizika-2.0` (HEAD 519037c) · **Commit/push qilinmagan.**
Firebase project: `oliy-fizika` (yagona manba: `js/firebase.js`; `.firebaserc` yo‘q → deploy buyruqlarida `--project oliy-fizika` aniq beriladi).

## 1. Arxitektura (qisqa)

Statik sayt (GitHub Pages) + Firebase Auth/Firestore/Storage, backend yo‘q. Ishonchli baholash Firestore Rules ichida:

1. **START** — `attestationPhysicsAttempts/{uid}__{testId}` yaratiladi, `startedAt == request.time`.
2. **SAVE** — qoralama javoblar (`answers` map, `savedAt`); faqat `in_progress` holatda.
3. **SUBMIT** — `status: submitted`, `completedAt == request.time`, javoblar muzlatiladi.
4. **KEY** — submit’dan keyingina `.../keys/v1` o‘qiladi (oldin Rules rad etadi).
5. **GRADE** — klient natijani yozadi, Rules `answers.diff(key.answers)` bilan tekshiradi: `unchangedKeys` = to‘g‘ri, `changedKeys` = noto‘g‘ri, `removedKeys` = javobsiz; `scorePercent`, `correctIds/wrongIds`, `timeSpentSeconds == (completedAt − startedAt).seconds()` aynan mos bo‘lmasa — rad.

Vaqt chegarasi **yo‘q**: faqat sekundomer, auto-submit va countdown yo‘q. To‘liq yechim `solutionAvailableAt` (publish’dan keyingi kun 00:00, Asia/Tashkent = UTC+5) dan keyin ochiladi — Rules va UI ikkalasi ham tekshiradi.

## 2. Yaratilgan fayllar (52)

| Fayl | Vazifa |
|---|---|
| `attestatsiya/index.html` | 2.0 Attestatsiya landing (Fizika + Pedagogika kartalari). Eski `attestatsiya.html` tegilmagan (Pedagogika baseline’da). |
| `attestatsiya/fizika-test.html` | Test engine sahifasi |
| `attestatsiya/fizika-yechimlar.html` | Yechimlar bo‘limi |
| `attestatsiya/fizika-natijalar.html` | «Mening attestatsiya testlarim» — tarix + statistika |
| `admin/attestatsiya-fizika.html` | Admin: Attestatsiya → Fizika → Kunlik testlar |
| `assets/css/attestatsiya.css` | Barcha `att-*` stillar, faqat `--of-*` tokenlar, dark/responsive/reduced-motion |
| `assets/js/attestatsiya-fizika/core.js` | Konstantalar, vaqt (Toshkent), formatlash, `gradeAnswers` (Rules bilan bir xil algoritm), statistika |
| `assets/js/attestatsiya-fizika/api.js` | Firestore/Storage chaqiruvlari (start/save/submit/grade, publish/archive, figure blob) |
| `assets/js/attestatsiya-fizika/render.js` | Bloklar renderi, KaTeX (lazy), rasmlar (lazy, IntersectionObserver, zoom) |
| `assets/js/attestatsiya-fizika/ui.js` | Ikonlar, tablar, holat bloklari, xato matnlari |
| `assets/js/attestatsiya-fizika/{landing,dashboard,test-page,solutions-page,results-page,notify}.js` | Sahifa skriptlari, bildirishnoma |
| `assets/js/admin/attestation-fizika.js` | Admin jadval, PUBLISH/Archive, import, rasm yuklash |
| `assets/vendor/katex/*` (24) | KaTeX 0.16.47 (MIT) lokal — CDN’ga bog‘liq emas |
| `storage.rules` | Storage xavfsizlik qoidalari |
| `tools/attestatsiya-fizika/e2e/*` | Mock Firebase server (Rules bilan) + Playwright E2E |

## 3. O‘zgartirilgan mavjud fayllar (11)

| Fayl | O‘zgarish |
|---|---|
| `attestatsiya/fizikaattestatsiya.html` | Bo‘sh edi → Fizika dashboard |
| `firestore.rules` | `build_rules.py` orqali faqat attestation bloki qo‘shildi; mavjud qoidalar bayt-bayt bir xil |
| `firebase.json` | `"storage": {"rules": "storage.rules"}` qo‘shildi |
| `assets/js/notifications/notification-center.js` | 1 qator: profil yuklangach `notify.js` lazy import (mavjud `of:notifications` kengaytma nuqtasi) |
| `assets/js/shell/nav-config.js` | Attestatsiya havolasi → `attestatsiya/index.html`; admin menyuga «Attestatsiya — Fizika» |
| `index.html`, `sitemap.xml` | `attestatsiya/attestatsiya.html` → `attestatsiya/index.html` (1 tadan) |
| `tools/.../prepare_attestation_data.py` | Storage staging, `timeLimit: none`, figure manifest |
| `tools/.../rules/{attestation_physics.rules.in, rules_eval.py, test_rules.py}` | Save/Storage/figures qoidalari va testlari |

## 4. Kolleksiyalar

- `attestationPhysicsSettings/config` — `accessMode: "open"`, `timezone: Asia/Tashkent`, `totalDays: 32`, `timeLimit: "none"`, `figureBackend: "storage"`, `solutionRelease`, `officialAttemptsPerTest: 1`.
- `attestationPhysicsQuestions/{AF-x-nnn}` (+ `private/answer`) — faqat admin.
- `attestationPhysicsDailyTests/{att-fizika-day-NN}` — meta; `versions/v1` (savollar, javobsiz), `keys/v1` (submit’dan keyin), `solutions/v1` (`solutionAvailableAt` dan keyin), `figures/{hash}`, `solutionFigures/{hash}` (Firestore muqobili).
- `attestationPhysicsAttempts/{uid}__{testId}` — urinish/natija. `results` kolleksiyasiga **yozilmaydi**, XP/progress/unlock’ga ta’sir qilmaydi.

## 5. Storage tuzilmasi

```
attestation-physics/questions/{testId}/{hash}.(webp|svg)   408 fayl
attestation-physics/solutions/{testId}/{hash}.(webp|svg)     7 fayl
```
Frontend `getBlob()` → Blob URL ishlatadi; `getDownloadURL` (doimiy public token-URL) **ishlatilmaydi**. Lokal manbalar `_private/attestatsiya-fizika/figures/{question,solution}` ga ko‘chirildi (avval `assets/attestatsiya-fizika/fig` da edi — saytga chiqib ketishi mumkin edi). Agar Storage (Blaze) yoki bucket CORS mavjud bo‘lmasa, admin sahifasida `figureBackend: "firestore"` ga o‘tkazish mumkin — xuddi shu Rules bilan himoyalangan base64 hujjatlar.

## 6. Ma’lumot tekshiruvi (qurilmada qayta ishga tushirildi)

`prepare_attestation_data.py --figures reuse`: 28/28 gate PASS · 1027 savol · 865 auto-baholanadigan · 32 test · KaTeX 16146 formula / 0 xato · Firestore max hujjat 41 048 bayt · rasmlar 415 · bundle 2183 op · contentHash `cc7363c8b5cd3974` (bulut nusxasi bilan bir xil).

## 7. Deploy holati

Hech narsa deploy qilinmagan. Chrome kengaytmasi ulanmagani uchun Firebase Console tekshiruvlari (tarif/Storage, mavjud Storage rules, Rules Playground) va deploy foydalanuvchi tasdig‘i bilan keyingi qadamda bajariladi — 15-hisobotdagi ro‘yxatga qarang.
