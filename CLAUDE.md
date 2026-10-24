# OliyFizika.uz — Claude Code uchun qo‘llanma

O‘zbek tilidagi fizika ta’lim sayti (GitHub Pages, `main` → oliyfizika.uz). Muallif: Amirov Sarvar.
Aloqa: Telegram @oliyfizika_uz, email oliyfizika@gmail.com. Saytda hech qayerda telefon raqami bo‘lmaydi.

## Texnologiya
- Statik HTML + ES modullar (bundler, npm, build bosqichi yo‘q). Fayllar to‘g‘ridan-to‘g‘ri brauzerda ishlaydi.
- Firebase Auth (email-link) + Firestore (progress, kirish bayroqlari `mockTestsAccess`, `attestationAccess`).
- Dizayn: OliyFizika 2.0 (oq + ko‘k + yashil, sidebar qobiq `assets/js/shell/app-shell.js`, tokenlar `assets/css/app.css`).
  Ranglar faqat CSS tokenlari orqali (`--of-*`); yorug‘ va qorong‘i rejim ikkalasi ham ishlashi shart.

## Qat’iy qoidalar
- **Attestatsiya → Pedagogika** bo‘limiga hech qachon tegilmaydi.
- **Milliy sertifikat**dagi pullik video/PDF yechimlar va kirish tizimi o‘zgartirilmaydi.
- `/_private/` va `attestatsiya/fizika/ATT_EST*` — maxfiy, gitga kirmaydi (`.gitignore`).
- Barcha matn o‘zbek (lotin) tilida, o‘nlik vergul bilan (`1,5`), to‘g‘ri tutuq belgilari (`o‘`, `g‘`, `’`).
- Saytdagi statistikalar real bo‘ladi, sun’iy oshirilmaydi.
- O‘zgartirishdan oldin eski faylning nusxasini `_private/_staging/backup-sim/<nom>/` ga qo‘yish odat bo‘lgan.
- Ish branchda bajariladi va PR orqali `main` ga qo‘shiladi.

## Bo‘limlar
- `umumiy-fizika/` — Mexanika, Molekulyar fizika, Elektr va magnetizm, Optika, Atom va yadro; darslik testlari.
- `milliy-sertifikat/` — modulli JSON mock testlar.
- `attestatsiya/` — Fizika: admin e’lon qiladigan kunlik testlar (1–3-kun bepul, 4+ `attestationAccess`).
- `simulations/` — simulyatsiyalar va virtual laboratoriyalar. **Batafsil: [`simulations/CLAUDE.md`](simulations/CLAUDE.md).**
