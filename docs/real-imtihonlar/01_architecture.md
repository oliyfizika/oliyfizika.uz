# Real imtihonlar — arxitektura (PHASE 4, lokal)

Holat: **faqat lokal arxitektura.** Firebase production'ga hech narsa yozilmagan, Rules deploy qilinmagan,
Storage'ga hech narsa yuklanmagan. Production'da modul `FIRESTORE_ENABLED=false` sababli "tez orada"
holatini ko'rsatadi va Firestore'ga so'rov yubormaydi.

## 1. Fayllar

| Joy | Vazifasi |
|---|---|
| `milliy-sertifikat/real-imtihonlar/index.html` | ro'yxat (katalog metadata'sidan, data-driven) |
| `milliy-sertifikat/real-imtihonlar/imtihon.html?id=…` | bitta variant: manba ma'lumoti, ogohlantirishlar, PDF |
| `milliy-sertifikat/real-imtihonlar/yechimlar.html?id=…&q=N` | yechimlar ko'ruvchisi + navigatsiya |
| `assets/js/milliy-sertifikat/real-exams/config.js` | ma'lumot manbai, `FIRESTORE_ENABLED`, yo'l nomlari |
| `…/real-exams/data.js` | adapter tanlash (UI faqat shu interfeysni biladi) |
| `…/real-exams/adapters/local-adapter.js` | LocalDataAdapter — `_private/real-imtihonlar/app-data/` (faqat localhost) |
| `…/real-exams/adapters/firestore-adapter.js` | FirestoreDataAdapter — faqat o'qish, `getBlob()` |
| `…/real-exams/access.js` | ruxsat darvozasi: mavjud `users/{uid}.mockTestsAccess === true` |
| `…/real-exams/render.js` | yupqa renderer (KaTeX lokal vendor; manba matni markdown sifatida talqin qilinmaydi) |
| `…/real-exams/{list,exam,solutions}-page.js`, `pdf-viewer.js`, `labels.js`, `ui.js` | sahifalar |
| `assets/css/real-imtihonlar.css` | modul uslublari (`.rx-` prefiksi, faqat token'lar; yorug'/qorong'i) |
| `tools/real-imtihonlar/export_app_data.py` | dataset + audit yechimlari → app-data (lokal) |
| `tools/real-imtihonlar/solution_md.py` | audit yechim markdown → bloklar (matn o'zgarmaydi) |
| `tools/real-imtihonlar/validate_app_data.py` | PHASE 4 validator |
| `tools/real-imtihonlar/rules/*` | Rules TAKLIFI (alohida blok) + quruvchi skript |
| `tools/real-imtihonlar/e2e/*` | mock Firebase (mavjud emulyatsiya ustida) + Playwright E2E |
| `tools/real-imtihonlar/fixtures/local-fixture.pdf` | DUMMY PDF (haqiqiy imtihon emas) |

Mavjud fayllar (Milliy sertifikat, Mock testlar, Video yechimlar, Attestatsiya, shell, CSS, Rules) **o'zgartirilmagan.**
Navigatsiya: `nav-config.js` dagi `milliy-sertifikat/` mosligi yangi papkani ham qamraydi.
PHASE 4.5: `milliy-sertifikat.html` ga bitta "Real imtihonlar" kartochkasi qo'shildi (+10 qator, faqat HTML; mavjud CSS/JS o'zgarmagan).

## 2. Ma'lumot oqimi

```
_private/real-imtihonlar/dataset/REAL-*.json      (PHASE 3 manba: savol matni, provenance, verification)
_private/real-imtihonlar/audit/*-SOLUTIONS.md      (audit yechimlari va statuslar)
        │  tools/real-imtihonlar/export_app_data.py   (format o'zgarishi; matn o'zgarmaydi)
        ▼
_private/real-imtihonlar/app-data/                 (gitignored — hech qachon commit/deploy qilinmaydi)
  catalog.json · exams/{id}/questions.json · exams/{id}/solutions.json
        │
        ├── LocalDataAdapter (localhost)   ─┐
        └── (keyingi bosqich) import →      ├─► data.js ─► UI
            Firestore/Storage → FirestoreDataAdapter ─┘
```

## 3. Firestore modeli (taklif)

| Hujjat | Mazmuni | Eng katta hajm (12 variant) |
|---|---|---|
| `realExams/{examId}` | katalog yozuvi: sana, smena/variant, `subtitle`, `sourceType`, `sourceFile`, `sourceDate`, `sourceProvenance`, `officialSource:false`, `warnings`, savollar soni, `solutionSummary`, `reviewParts`, `pdf.storagePath`, `published` | ~1,1 KB |
| `realExams/{examId}/content/questions` | 45 savol: `questionText`, `options`, `parts`, `matchGroup`, `tables`, `figures`, `formulas`, `sourcePage(s)`, `sourceStatus`, `sourceNotes`, `verification{aiVerified, humanSignOff, …}`, `solutionStatus` — **javobsiz** | 66,6 KB |
| `realExams/{examId}/private/solutions` | 45 yechim: `solutionStatus`, `partSolutionStatus`, `solutionFlags`, `answer{text, choice, tail}`, `blocks` | 34,3 KB |

Tekshiruvlar (`export_app_data.py` har eksportda tekshiradi):
- **Hujjat hajmi:** Firestore chegarasi 1 MiB. Eng katta hujjat 66,6 KB, shuning uchun har bir variant uchun bitta savollar hujjati va bitta yechimlar hujjati yetarli. Attestatsiyadagi `versions` va `solutions` ham shu uslubda.
- **Ichma-ich massiv:** Firestore ruxsat bermaydi, shuning uchun jadval qatorlari `rows: [{c: [...]}]` shaklida saqlanadi. Bunday massiv yo'qligi avtomatik tekshiriladi.
- **Figures:**
  - har biri `figureId`, `questionNumber`, `sourcePage`, `sha256` maydonlariga ega;
  - `storagePath`: `real-exams/{examId}/figures/{figureId}.png`;
  - `localFile`: faqat lokal adapter uchun.
- **33–35 moslashtirish:** har biri alohida savol, ular uchun umumiy `matchGroup`. Yechim bitta, `group: "33-35"`. Javob `choice` savol raqami bo'yicha ajratib olinadi.
- **36–45:** `parts[a,b]`. NEEDS_MANUAL_REVIEW qismlari `partSolutionStatus` da saqlanadi.
- **Javob ajratilgan:** to'g'ri javob faqat `private/solutions` hujjatida; savollar hujjatida javob yo'q.

## 4. Ruxsat

- **Frontend (UX):**
  - `access.js` mavjud `core/session.js` profilini o'qiydi va `mockTestsAccess === true` ni tekshiradi;
  - holatlar: mehmon → `login`, ruxsatsiz → `access`, xato → `error`;
  - ruxsat bo'lmasa kontent so'rovi umuman yuborilmaydi;
  - to'g'ridan-to'g'ri URL'da ham ishlaydi, chunki darvoza har sahifaning boshida turadi.
- **Admin (PHASE 4.5 qarori):** alohida admin istisnosi yo'q. Admin + `mockTestsAccess=false` → rad, admin + `mockTestsAccess=true` → ruxsat. Frontend va Rules taklifi bir xil modelda (mavjud Mock/Video yechimlar modeli).
- **Haqiqiy himoya — Rules** (5-bo'lim). Frontend darvoza xavfsizlik vositasi emas.

## 5. Rules taklifi (DEPLOY QILINMAGAN)

Bloklar `tools/real-imtihonlar/rules/real_exams.{firestore,storage}.rules.in` fayllarida.
`build_proposed_rules.py` ularni repo qoidalariga qo'shib, natijani faqat `_private/real-imtihonlar/rules-proposed/` ga yozadi:
qoidalar fayli va `.diff`. O'zgarish faqat qo'shimcha: firestore +33 / −0 qator, storage +24 / −0 qator.

- `realExams/{id}`:
  - get/list: faqat `mockTestsAccess == true` va `published == true` (admin istisnosi yo'q);
  - yozish: hech kim.
- `…/content/questions` va `…/private/solutions`:
  - get: access va `published` (ota hujjat);
  - list va yozish: hech kim.
- Storage `real-exams/{id}.pdf` va `real-exams/{id}/figures/*`:
  - get: access va `published`;
  - list va yozish: hech kim.
- Ma'lumot yuklash keyingi bosqichda. Kerakli vosita (Admin SDK yoki admin UI) va Blaze — alohida infratuzilma tasdig'i bilan.

Lokal tekshiruv: mavjud `rules_eval.py` emulyatsiyasi.
- A, B: hamma narsa rad etiladi.
- C va D (admin, flag=true): published o'qiladi, unpublished va yozish rad etiladi.
- E (admin, flag=false): hamma narsa rad etiladi.
- Repo qoidalarining o'zi bilan `realExams` rad etiladi.
- Attestatsiya xatti-harakati taklif va repo qoidalarida bir xil.

## 6. PDF va rasmlar

- **Production:** Storage `getBlob()` (Rules tekshiradi) → Blob → `URL.createObjectURL` → `<iframe>`. Object URL `pagehide` da bekor qilinadi. `getDownloadURL` ishlatilmaydi.
- **Lokal:** `tools/real-imtihonlar/fixtures/local-fixture.pdf`. Haqiqiy PDF lar hech qayerga nusxalanmagan.
- **Rasmlar:** lokalda `_private/real-imtihonlar/figures/` dan, production'da `getBlob()` → Blob URL.

## 7. Production'ga o'tish (keyingi bosqichlar — har biri alohida tasdiq bilan)

1. Blaze va Storage bucket'ni yoqish (infratuzilma tasdig'i).
2. Rules taklifini ko'rib chiqish, so'ng deploy qilish.
3. Import: katalog, savollar va yechimlar hujjatlari; PDF va rasmlarni yuklash.
4. `config.js` da `FIRESTORE_ENABLED = true` qilish.
5. (PHASE 4.5 da bajarildi: kirish kartochkasi.)
