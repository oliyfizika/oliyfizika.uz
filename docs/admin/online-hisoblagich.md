# «Hozir online» hisoblagichi (admin dashboard)

`admin/index.html` dagi karta so‘nggi 6 daqiqada saytni ochiq (ko‘rinib turgan) holda ishlatganlarni sanaydi.
Har qanday admin ko‘radi; har daqiqada yangilanadi (sahifa yashirin bo‘lsa — to‘xtaydi).

| Kim | Qayerdan sanaladi | Yozuv |
| --- | --- | --- |
| Tizimga kirganlar | `users/{uid}.lastActiveAt` | Avvaldan bor edi (`core/session.js`, ~5 daqiqada bir). Endi faqat sahifa ko‘rinib turganda yoziladi. |
| Mehmonlar | `presence/{g_…}.at` | Yangi (`core/presence.js`): ko‘rinib turgan sahifada ~5 daqiqada bir. ID brauzer bo‘yicha (localStorage). |

Hisoblash `getCountFromServer` bilan — hujjatlar yuklanmaydi. «Kimlar online?» tugmasi tizimga kirganlarning
ro‘yxatini (eng ko‘pi 50 ta) ochadi. Mehmonlar haqida shaxsiy ma’lumot saqlanmaydi (faqat `at` va `expireAt`).

## Qo‘lda bajariladigan qadamlar

1. **Rules deploy** (majburiy, aks holda «Mehmonlar» `—` ko‘rinadi): toza nusxadan
   `firebase deploy --only firestore:rules --project oliy-fizika`.
2. **TTL siyosati** (ixtiyoriy, eski mehmon hujjatlarini avtomatik o‘chiradi): Firebase Console → Firestore →
   TTL → *Create policy* → collection group `presence`, field `expireAt`.
   Yoki: `gcloud firestore fields ttls update expireAt --collection-group=presence --enable-ttl --project=oliy-fizika`.

Indeks kerak emas (bitta maydon bo‘yicha diapazon — avtomatik indeks).

## Cheklovlar

- Sahifani yopgan foydalanuvchi 6 daqiqagacha «online» ko‘rinib turishi mumkin (serverda onDisconnect yo‘q).
- Mehmon hisobini qasddan sun’iy oshirish mumkin (autentifikatsiyasiz yozuv) — bu faqat ko‘rsatkich, hech qanday
  kirish huquqiga ta’sir qilmaydi.
- `core/session.js` ni yuklamaydigan sahifalar (masalan, Pedagogika testlari) hisobga kirmaydi.

Testlar: `python3 tools/admin/test_admin_rules.py`, `tools/admin/e2e_online.mjs`.
