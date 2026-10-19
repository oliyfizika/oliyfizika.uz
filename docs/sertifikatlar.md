# Umumiy fizika sertifikatlari

Bo'lim (Mexanika, Molekulyar fizika, Elektr va magnetizm, Optika) va butun «Umumiy fizika» kursi uchun bepul sertifikat.
Atom bo'limi testlari yo'q — sertifikat berilmaydi («Tez orada»). Sertifikat **o'quv rag'bati** uchun, davlat hujjati emas.

## Sahifalar
- `certificates/index.html` — «Sertifikatlarim» (menyuda, profilda, kurs sahifasida havola).
- `certificates/verify.html?id=OF-MEX-XXXX-XXXX-XXXX` — ommaviy tekshirish (QR shu manzilga olib boradi).

## Ma'lumotlar modeli (Firestore)
| Yo'l | Mazmuni |
|---|---|
| `users/{uid}/courseProgress/{courseId}` | `lessons{"<mavzu>": {p, r(resultId), t}}`, `count`, `sum`, `firstAt`, `lastAt` |
| `users/{uid}/certificateIndex/{courseId}` | `certId`, `count`, `sum` — bir kurs, bir sertifikat |
| `certificates/{raqam}` | o'zgarmas: ism, kurs, mavzular soni, `avgX10`, sana, `revoked` |

## Xavfsizlik va adolatlilik (firestore.rules → «Sertifikatlar»)
1. **Natijaga bog'liqlik.** Jamlanmadagi har bir mavzu yozuvi haqiqiy `results` hujjatiga bog'lanadi (uid, mavzu, `passed`, foiz, `completedAt` rules ichida `get()` bilan tekshiriladi). Bir yozuvda aynan bitta mavzu qo'shiladi; `count/sum/firstAt/lastAt` shu yozuvlardan kelib chiqadi.
2. **To'liqlik.** Bo'lim sertifikati uchun bo'limning BARCHA talab qilingan mavzulari bo'lishi shart (`certRequired`, `certLessonOk`).
3. **Tezlik cheklovi.** Birinchi va oxirgi natija orasida kamida *mavzu soni × 60 s* (server vaqti) — skript bilan bir zumda to'ldirib bo'lmaydi.
4. **Bir kurs — bir sertifikat.** Indeks hujjati sertifikat bilan atomik yoziladi, o'zgarmas.
5. **O'zgarmaslik.** Sertifikatni foydalanuvchi o'zgartira/o'chira olmaydi; admin faqat `revoked` belgilashi yoki o'chirishi mumkin (qayta berish uchun indeks ham o'chiriladi).
6. **Raqam.** Tasodifiy (`crypto.getRandomValues`), 12 belgi ≈ 59 bit; ro'yxatni ko'rib bo'lmaydi, faqat aniq raqam bo'yicha o'qiladi.
7. **Ism** profildagi ism bilan bir xil bo'lishi shart; kurs nomi/kod/ball formulasi rules'da tekshiriladi.
8. **To'liq kurs** sertifikati to'rttala bo'lim indeksiga tayanadi; mavzular va ball shulardan yig'iladi.

## Ma'lum cheklov
Testlar klient tomonida baholanadi va javob kalitlari ochiq JSON, `results` ni klient yozadi. Texnik jihatdan malakali foydalanuvchi natijani soxtalashtirishi mumkin; yuqoridagi qoidalar faqat tuzilma butunligi, to'liqlik, takrorlanmaslik va tezlikni kafolatlaydi. Rasmiy/pullik sertifikatga o'tishdan oldin server tomonida baholash (Cloud Functions yoki Attestatsiya'dagi kabi rules-gated kalitlar) kerak.

## Qo'llab-quvvatlash
- **Deploy:** `firestore.rules` ni egasi qo'lda qo'yadi (avtomatik emas).
- **Yangi test qo'shilganda** (14-mavzu, Atom): `umumiy-fizika/data/certificates.js` va `firestore.rules` dagi `certLessonOk / certRequired / certTitle / certCode` (hamda to'liq kurs uchun `certFullOk`) ni birga yangilang.
- **Xato ismli sertifikat:** admin `certificates/{raqam}` va `users/{uid}/certificateIndex/{courseId}` ni o'chiradi; foydalanuvchi profilni to'g'rilab qayta oladi.
- **Bekor qilish:** admin `certificates/{raqam}` da `revoked: true` (+ ixtiyoriy `revokedReason`).
- QR: `assets/js/certificates/qr.js` (tashqi kutubxonasiz, M darajasi, versiya 1–9).
