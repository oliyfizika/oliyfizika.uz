# Real imtihonlar — Firebase arxitekturasi (PHASE 5A, deploy qilinmagan)

Holat: **tayyorlangan, deploy qilinmagan.** Firestore'ga yozilmagan, Storage'ga yuklanmagan, Rules va indekslar
deploy qilinmagan, Blaze yoqilmagan. Frontend `FIRESTORE_ENABLED=false` holatida qoladi.

## 1. Firebase loyihasi (repo konfiguratsiyasidan)

| Element | Qiymat | Manba |
|---|---|---|
| projectId | `oliy-fizika` | `js/firebase.js` (ommaviy web config) |
| authDomain | `oliy-fizika.firebaseapp.com` | `js/firebase.js` |
| storageBucket | `oliy-fizika.firebasestorage.app` | `js/firebase.js` |
| `firebase.json` | `firestore.rules`, `firestore.indexes.json`, `storage.rules` (hosting yo'q) | repo |
| `.firebaserc` | **yo'q** — CLI uchun loyiha aliasi sozlanmagan | repo |
| Hosting | GitHub Pages (`CNAME` → oliyfizika.uz), Firebase Hosting emas | repo |

## 2. Firestore sxemasi

Yo'llar Firestore sintaksisiga mos: **kolleksiya / hujjat / kolleksiya / hujjat** — segmentlar soni juft, oxirgisi hujjat.

| Yo'l | Segmentlar | Turi | Mazmuni |
|---|---|---|---|
| `realExams/{examId}` | 2 | hujjat | katalog/meta: `date`, `displayDate`, `session`, `variant`, `subtitle`, `sourceGroup`, `sourceType`, `sourceFile`, `sourceDate`, `sourceProvenance`, `officialSource` (=false), `warnings`, `pageCount`, `questionCount`, `includedCount`, `excludedCount`, `solutionSummary`, `reviewParts`, `humanSignOffCount`, `pdf.storagePath`, **`published`** |
| `realExams/{examId}/content/questions` | 4 | hujjat (`content` subkolleksiyasi) | savollar massivi (manba matni, variantlar, qismlar, jadvallar, figures havolalari, formulalar, `verification{aiVerified, humanSignOff}`, `solutionStatus`). **Javob va yechim yo'q.** |
| `realExams/{examId}/private/solutions` | 4 | hujjat (`private` subkolleksiyasi) | yechimlar: `solutionStatus`, `partSolutionStatus`, `solutionFlags`, `answer{text, choice, tail}`, `blocks` |

- `content` va `private` — subkolleksiya nomlari, `questions` va `solutions` — ulardagi yagona hujjatlar ID'si. Bu Attestatsiyadagi `attestationPhysicsQuestions/{qid}/private/answer` uslubiga mos.
- Boshqa ID'li hujjatlar (masalan, `content/answers`) Rules bilan rad etiladi.
- **Hajm:**
  - eng katta savollar hujjati 66,6 KB (REAL-2026-09-29-1);
  - eng katta yechimlar hujjati 34,3 KB;
  - katalog yozuvi taxminan 1,1 KB;
  - Firestore chegarasi 1 MiB. `export_app_data.py` 900 KB dan oshsa to'xtaydi.
- **Massivlar:** ichma-ich massiv yo'q (jadval qatorlari `{c:[…]}` shaklida); `export_app_data.py` buni tekshiradi.
- **Indekslar:** katalog so'rovi `where("published","==",true)`, ya'ni bitta maydonli tenglik. Avtomatik indeks yetarli, `firestore.indexes.json` ga qo'shimcha kerak emas.

## 3. Storage yo'llari

| Yo'l | Mazmuni | Soni |
|---|---|---:|
| `real-exams/{examId}.pdf` | imtihon PDF (asl fayl, o'zgartirilmagan) | 12 |
| `real-exams/{examId}/figures/{figureId}.png` | savol chizmalari (`figureId` = `{examId}-qNN-fK`) | 105 |

- Har bir figure `examId`, `questionNumber`, `figureId`, `sourcePage` va `sha256` bilan `content/questions` ichida bog'langan; `storagePath` maydoni yuqoridagi yo'lga teng.
- Frontend fayllarni faqat `getBlob()` orqali oladi. `getDownloadURL` (doimiy ommaviy token URL) ishlatilmaydi.
- PDF ommaviy Drive URL orqali berilmaydi.

## 4. Storage holati (PHASE 5A tekshiruvi)

| Savol | Natija |
|---|---|
| Repo konfiguratsiyasidagi bucket | `oliy-fizika.firebasestorage.app` (`js/firebase.js`) |
| Bucket production'da ishlaydimi | **Tasdiqlanmagan.** Oxirgi ma'lum holat (Attestatsiya auditi, `docs/attestatsiya-fizika/17_image_pipeline_audit.md`): `getBlob` tarmoqqa chiqmaydi, Attestatsiya shu sabab `figureBackend=firestore` da ishlaydi |
| PHASE 5A dagi tekshiruv | Faqat o'qish uchun autentifikatsiyasiz `GET firebasestorage.googleapis.com/v0/b/{bucket}/o` so'rovi ham sessiya konteyneridan, ham qurilma VM'idan yuborildi. Ikkalasi ham tarmoq proksisida bloklandi (`CONNECT 403`), Google'gacha yetib bormadi |
| Firebase tarif rejasi (Spark/Blaze) | **Aniqlab bo'lmaydi:** buning uchun Console yoki billing API kerak, bu sessiyada ularga ruxsat yo'q |
| Kerakli harakat | Firebase Console → Storage sahifasini egasi ochishi kerak: bucket bormi, "Get started" so'rayaptimi, Blaze talab qilinyaptimi |
| Oqibat | Storage ishlamasa, PDF va 105 ta rasmni yuklab bo'lmaydi. Firestore qismi (katalog, savollar, yechimlar) Storage'siz ham ishlaydi |

`*.firebasestorage.app` nomli bucketlar uchun Firebase odatda Blaze tarifini talab qiladi. Bu holat Console'da tasdiqlanishi kerak. Blaze yoqilmagan va yoqilmaydi — bu alohida qaror.

## 5. Ma'lumot oqimi (keyingi bosqichlar uchun)

```
_private/real-imtihonlar/app-data/catalog.json         -> realExams/{examId}
_private/real-imtihonlar/app-data/exams/{id}/questions -> realExams/{id}/content/questions
_private/real-imtihonlar/app-data/exams/{id}/solutions -> realExams/{id}/private/solutions
milliy-sertifikat/Real imtihonlar/*.pdf (gitignored)   -> real-exams/{id}.pdf
_private/real-imtihonlar/figures/{id}/qNN-fK.png       -> real-exams/{id}/figures/{figureId}.png
```

Client tomonidan yozish Rules bilan butunlay yopiq. Import faqat server/Admin vositasi bilan, alohida tasdiqlangan bosqichda.

## 6. Deploy shartlari (hammasi alohida tasdiq bilan)

1. **Storage:** Console'da bucket holatini tekshirish. Kerak bo'lsa Blaze — infratuzilma va billing tasdig'i.
2. **Rules:** `_private/real-imtihonlar/rules-proposed/` dagi taklifni ko'rib chiqish. Deploydan oldin Console'dagi joriy qoidalar bilan solishtirish: repo fayli Console bilan bir xil ekanligi tasdiqlanmagan.
3. **CLI:** `.firebaserc` yoki `firebase use oliy-fizika` sozlanishi kerak. Deploy faqat `--only firestore:rules` / `--only storage`, alohida tasdiq bilan.
4. **Import:** katalog, savollar va yechimlar (Admin SDK yoki Console). Har bir hujjat 1 MiB dan kichik, ichma-ich massiv yo'q. Hamma yozuvlar `published:false` bilan import qilinadi va tekshiruvdan keyin `true` qilinadi.
5. **Fayllar:** PDF va 105 ta rasm, sha256 bilan tekshiriladi.
6. **Frontend:** `FIRESTORE_ENABLED=true` — production smoke testidan keyin.
