# Domenlar: oliyfizika.uz va onlinefizika.uz

## Hozirgi tuzilma

| Domen | Qayerda turadi | Vazifasi |
|---|---|---|
| `oliyfizika.uz` | GitHub Pages (`main`, `CNAME` fayli) | Asosiy sayt |
| `onlinefizika.uz`, `www.onlinefizika.uz` | Firebase Hosting, alohida sayt `onlinefizika-uz` | Har qanday sahifani 301 bilan `oliyfizika.uz` dagi xuddi shu yo‘lga yuboradi |

Masalan: `https://onlinefizika.uz/attestatsiya/index.html` → `https://oliyfizika.uz/attestatsiya/index.html`.

GitHub Pages bitta repo uchun faqat bitta domenni qabul qiladi, shuning uchun ikkinchi domen
Firebase loyihasidagi (`oliy-fizika`) alohida hosting sayti orqali yo‘naltiriladi.
Asosiy Firebase sayti (`oliy-fizika.firebaseapp.com`) ataylab ishlatilmaydi: u Google bilan
kirish oynasi uchun kerak, unga yo‘naltirish qo‘yilsa, kirish buziladi.

Sozlamalar:
- `firebase.json` → `hosting` (target `onlinefizika`, 301 yo‘naltirish qoidasi);
- `.firebaserc` → `onlinefizika` target’i `onlinefizika-uz` saytiga bog‘langan;
- `tools/onlinefizika-redirect/` — hosting uchun bo‘sh papka (faqat zaxira `index.html`).

## Bir martalik sozlash (Mac’da, Terminal)

```bash
firebase hosting:sites:create onlinefizika-uz --project oliy-fizika
firebase deploy --only hosting:onlinefizika --project oliy-fizika
```

So‘ng Firebase Console → Hosting → `onlinefizika-uz` sayti → **Add custom domain**:
`onlinefizika.uz` va `www.onlinefizika.uz`. Console ko‘rsatgan A va TXT yozuvlarini domen
registratoridagi DNS bo‘limiga kiriting. SSL sertifikat odatda bir necha soatdan 24 soatgacha chiqadi.

Firebase Console → Authentication → Settings → **Authorized domains** ga `onlinefizika.uz`
qo‘shib qo‘yish zarar qilmaydi (yo‘naltirish ishlayotgan paytda foydalanuvchi baribir `oliyfizika.uz` da kiradi).

Mavjud buyruq `firebase deploy --only firestore:rules --project oliy-fizika` avvalgidek ishlaydi.

## Asosiy domenni almashtirish (agar keyin `onlinefizika.uz` asosiy bo‘lsa)

1. `CNAME` faylida `onlinefizika.uz` yozing (GitHub Pages shu domenga o‘tadi; DNS’ni GitHub Pages’ga qarating).
2. `firebase.json` dagi `destination` ni `https://onlinefizika.uz/:path` ga o‘zgartiring,
   Firebase’dagi custom domenni `oliyfizika.uz` ga almashtiring va qayta deploy qiling.
3. `sitemap.xml`, `robots.txt` va laboratoriya hisobotlaridagi `SITE` manzillarini yangilang.
4. Authorized domains’da ikkala domen ham bo‘lsin.
