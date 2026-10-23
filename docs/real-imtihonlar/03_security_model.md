# Real imtihonlar — xavfsizlik modeli (PHASE 5A, deploy qilinmagan)

## 1. Ruxsat modeli (yagona)

| Foydalanuvchi | Natija |
|---|---|
| tizimga kirmagan | DENY |
| kirgan, `users/{uid}.mockTestsAccess != true` (false yoki maydon yo'q) | DENY |
| kirgan, `mockTestsAccess == true` | READ (faqat `published == true`), WRITE — DENY |
| admin, `mockTestsAccess == false` | DENY (alohida admin istisnosi yo'q) |
| admin, `mockTestsAccess == true` | READ (faqat `published == true`), WRITE — DENY |

- Mavjud Mock testlar / Video yechimlar modeli qayta ishlatiladi. Yangi `realExamAccess` maydoni yo'q.
- Frontend darvoza (`access.js`) va Rules taklifi bir xil modelda.
- Frontend darvoza faqat UX uchun; haqiqiy himoya — Rules.

## 2. `published`

- `realExams/{examId}.published == true` bo'lmasa, katalog, savollar, yechimlar, PDF va rasmlar oddiy foydalanuvchiga ham, adminga ham yopiq.
- Import `published:false` bilan qilinadi va tekshiruvdan keyin `true` ga o'tkaziladi. Bu Admin vositasi bilan qilinadi; client yozish rad etiladi.

## 3. Firestore Rules taklifi (repo `firestore.rules` ga qo'shimcha blok; mavjud qatorlar o'zgarmagan)

```
function rxAccess() {
  return signedIn() && exists(userPath(request.auth.uid))
    && get(userPath(request.auth.uid)).data.get('mockTestsAccess', false) == true;
}
function rxPublished(examId) {
  return exists(/databases/$(database)/documents/realExams/$(examId))
    && get(/databases/$(database)/documents/realExams/$(examId)).data.get('published', false) == true;
}
match /realExams/{examId} {
  allow get, list: if rxAccess() && resource.data.get('published', false) == true;
  allow create, update, delete: if false;
  match /content/{docId} {
    allow get: if rxAccess() && docId == 'questions' && rxPublished(examId);
    allow list, create, update, delete: if false;
  }
  match /private/{docId} {
    allow get: if rxAccess() && docId == 'solutions' && rxPublished(examId);
    allow list, create, update, delete: if false;
  }
}
```

- `list`: faqat `published == true` filtrli so'rov o'tadi (Rules har bir natija hujjatiga qo'llanadi).
- `get()` soni: bitta so'rovda ko'pi bilan 3 ta (users, ota exam) — Firestore chegarasi 10.
- `users/{uid}` qoidalariga **tegilmagan**:
  - client o'z `role`, `fullAccess`, `mockTestsAccess` maydonini o'zgartira olmaydi;
  - bu maydonlarni faqat admin yangilaydi (mavjud `adminAccessUpdate`, admin UI).

## 4. Storage Rules taklifi (repo `storage.rules` ga qo'shimcha blok, `{allPaths=**}` dan oldin)

```
function rxAccess() { return signedIn() && userDoc().get('mockTestsAccess', false) == true; }
function rxPublished(examId) {
  return firestore.exists(/databases/(default)/documents/realExams/$(examId))
    && firestore.get(/databases/(default)/documents/realExams/$(examId)).data.get('published', false) == true;
}
match /real-exams/{fileName} {
  allow get: if fileName.matches('REAL-[0-9A-Za-z-]+[.]pdf')
    && rxAccess() && rxPublished(fileName.split('[.]')[0]);
  allow list, create, update, delete: if false;
}
match /real-exams/{examId}/figures/{fileName} {
  allow get: if rxAccess() && rxPublished(examId);
  allow list, create, update, delete: if false;
}
```

- Storage'dan Firestore'ga cross-service `firestore.get()` — mavjud Attestatsiya qoidalaridagi uslub.
- PDF nomi qat'iy formatda bo'lishi shart. Boshqa fayl turlari va chuqur yo'llar rad etiladi.
- Ommaviy o'qish yo'q. `getDownloadURL` ishlatilmaydi (token URL Rules'ni chetlab o'tadi).

## 5. Yechimlar maxfiyligi

| Ma'lumot | Joy | Kim o'qiydi |
|---|---|---|
| exam metadata (sana, smena/variant, provenance, holatlar soni) | `realExams/{id}` | access + published |
| savol matni, variantlar, figures havolalari (javobsiz) | `realExams/{id}/content/questions` | access + published |
| javoblar, yechimlar | `realExams/{id}/private/solutions` | access + published |
| PDF, chizmalar | Storage `real-exams/…` | access + published |

- Javob kaliti va yechimlar frontend bundle'ida (repo JS/HTML) **yo'q**: ular faqat `_private/` (gitignored) va keyinchalik Firestore'da saqlanadi.
- `content/questions` hujjatida javob maydoni yo'q (`validate_app_data.py` va eksport sxemasi).
- Barcha Real Exam kontenti access bilan himoyalangan. "Ommaviy metadata" yo'q: katalog ham faqat access + published bilan o'qiladi.

## 6. Mahalliy tekshiruvlar (PHASE 5A)

- `tools/real-imtihonlar/rules/test_real_exam_rules.py` — o'qish matritsasi (published true/false), barcha client yozuvlari, noto'g'ri yo'llar va `users` maydonlarini o'zgartirish. Hammasi taklif va repo qoidalari bilan solishtiriladi.
- `tools/attestatsiya-fizika/rules/test_rules.py` — mavjud 199 ta test: dry-run import, Attestatsiya ssenariylari, `users`/`results` regressiyasi va Storage. Repo va taklif qilingan qoidalar bilan bir xil natija.
- `tools/real-imtihonlar/e2e/e2e_real_exams.mjs` — frontend + mock Firebase (taklif qoidalari) E2E.
