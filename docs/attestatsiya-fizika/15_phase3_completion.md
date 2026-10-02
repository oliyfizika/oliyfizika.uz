# 15 — 3-bosqich: yakuniy hisobot

Holat: **kod tayyor va lokal tekshirilgan; production’ga deploy qilinmagan; commit/push qilinmagan.**

## Bajarildi

- Attestatsiya 2.0 landing, Fizika dashboard, Kunlik topshiriqlar, test engine (vaqt chegarasisiz, sekundomer), tasdiq oynasi, darhol natija, ertasi kun 00:00 yechimlar, tarix va statistika, admin «Kunlik testlar» jadvali (PUBLISH / Archive), bildirishnoma, KaTeX (lokal), rasmlar (Storage + Firestore muqobili).
- Firestore Rules (attestation bloki) + `storage.rules` + `firebase.json` storage yozuvi.
- Tekshiruvlar: ma’lumot 28/28 gate · Rules 126/126 · E2E 71/71 · dizayn QA (13-hisobot).
- Pedagogika baseline: **20/20 OK** (oxirgi tekshiruv qurilmada, 3-bosqich fayllari ko‘chirilgandan keyin).
- `results`, XP, progress, Mock Test, quiz engine, auth, boshqa kurslar fayllari — o‘zgartirilmagan (`git diff` ro‘yxatida yo‘q).

## Production uchun qolgan qadamlar (har biri sizning tasdig‘ingiz bilan)

Firebase project: **`oliy-fizika`** (`js/firebase.js`). `.firebaserc` yo‘q, shuning uchun har buyruqda `--project oliy-fizika`.

1. **Console tekshiruvi**: tarif (Spark/Blaze), Storage yoqilganmi, mavjud Storage rules (agar bo‘lsa — `storage.rules` bilan solishtirish; hozir saytda Storage boshqa joyda ishlatilmaydi).
2. **Rules Playground** (Firestore va Storage) — 12-hisobotdagi 15 ssenariy. Biror PASS bo‘lmasa — to‘xtash.
3. **Deploy**:
   ```
   firebase deploy --only firestore:rules,firestore:indexes --project oliy-fizika
   firebase deploy --only storage --project oliy-fizika      # faqat Storage mavjud bo‘lsa
   ```
4. **CORS** (`getBlob` uchun, Storage ishlatilsa):
   `gsutil cors set tools/attestatsiya-fizika/storage-cors.json gs://oliy-fizika.firebasestorage.app`
   Storage/Blaze bo‘lmasa: admin sahifada «Firestore’ga yozish» + `figureBackend: "firestore"`.
5. **Import**: admin → Attestatsiya — Fizika → `_private/attestatsiya-fizika/firestore-import.json` → Import; so‘ng rasmlar (`_private/attestatsiya-fizika/storage/`).
6. **Smoke-test**: test akkaunt bilan Day 1 publish → test → natija; ertasi kuni yechim.
7. **Git**: siz ko‘rib chiqqach commit/push (Claude avtomatik qilmaydi). `.DS_Store` fayllarini commit’ga qo‘shmaslik tavsiya etiladi.

## Ma’lum cheklovlar

- Rules lokal interpretatorda tekshirilgan, rasmiy emulator/Playground’da hali emas.
- Kalit submit’dan keyin klientga beriladi (darhol to‘g‘ri javob uchun); ko‘p akkauntli «ko‘chirish» backend’siz to‘liq to‘silmaydi.
- Bildirishnoma — sayt ichidagi notification center (push/email emas).
- `writeBatch` hajmi 10 (Rules `get()` limitiga ehtiyot); import ~2 daqiqa.
- Firestore indekslari deploy qilinmaguncha tarix so‘rovi indeks xatosini berishi mumkin.

## Ixtiyoriy yaxshilashlar (keyingi bosqich)

To‘lov/obuna (accessMode `paid` Rules’da tayyor), sertifikat, kogorta, admin uchun kunlik tahlil, PWA offline, yechimlarni PDF eksport.
