# Attestatsiya → Fizika: amalga oshirish rejasi

Har bir bosqichdan keyin to'xtab, tasdiq kutiladi (loyiha qoidasi). Commit/push — faqat siz.

## 0. 1-bosqich natijasi (shu hisobot)

Qo'shilgan fayllar (sayt kodiga tegilmagan):

```
tools/attestatsiya-fizika/plan_daily_tests.py      audit + reja generatori (deterministik)
docs/attestatsiya-fizika/attestation_architecture.md
docs/attestatsiya-fizika/attestation_daily_test_plan.md   (generator chiqishi)
docs/attestatsiya-fizika/attestation_data_model.md
docs/attestatsiya-fizika/attestation_import_plan.md
docs/attestatsiya-fizika/attestation_implementation_plan.md
docs/attestatsiya-fizika/daily_test_plan.json              (ID'lar, javobsiz)
docs/attestatsiya-fizika/_audit.json
```

## 1. Grouping algoritmi (qisqacha)

1. Savollar kitob tartibida (bob → mavzu → qiyinlik): bo'linadigan mavzuda avval osonroq qism.
2. Har bir bob alohida (bitta kun hech qachon ikki bo'limni aralashtirmaydi).
3. Dinamik dasturlash bob ichidagi barcha mumkin bo'lgan kesishlarni ko'rib chiqadi; har bir kun **qat'iy 25–40**. Narx:
   - ikki mavzu bir kunda → ular orasidagi "mantiqiy bog'liqlik" narxi (`LINK` jadvali: Kinematika–Dinamika 1, Elektromagnit induksiya–O'zgaruvchan tok 1, Ko'zgular–Interferensiya 5 …);
   - 25–40 lik mavzuni bo'lish — eng qimmat (14), kichik mavzuni bo'lish — 6, katta (>40) mavzuni bo'lish — 1;
   - 33 savoldan og'ish — kichik jarima (muvozanat).
4. Natija tekshiruvlari skript ichida: 1027 = biriktirilgan, takrorsiz, biriktirilmagan 0, har kun 25–40, bo'lingan mavzu kunlari ketma-ket. Bittasi buzilsa skript xato bilan to'xtaydi.

Natija: **32 kun**. Qoidadan istisnolar (mavjud mavzu hajmlari sababli boshqacha qilib bo'lmaydi, algoritm eng kam "zarar"li variantni tanladi):

| Mavzu | Nega bo'lindi |
|---|---|
| Ideal gaz (30) → Day 9 (26) + Day 10 (4) | MKN (12) va Termodinamika guruhi (34) yolg'iz qolmasligi uchun; MKN+Ideal gaz = 42 > 40 |
| O'zgaruvchan tok (33) → Day 19 (19) + Day 20 (14) | Induksiya (42) ikkiga 25 dan bo'linmaydi (21+21), EM tebranishlar (17) yolg'iz qolardi |
| Yadro reaksiyalari (19) → Day 26 + 27 | Atom-yadro bobining oxirgi uch kichik mavzusi (18+19+15=52) — ikki kun |
| Optika Day 23: Ko'zgular + to'lqin optikasi | To'lqin optikasi (23) < 25, Linzalar+Ko'zgular = 40 bilan sig'maydi |

Mavzu tartibini yoki `LINK` vaznini o'zgartirsangiz — skriptni qayta ishga tushirish kifoya.

## 2. Keyingi bosqichlar

| # | Bosqich | Nima qilinadi | O'zgaradigan fayllar | Tegilmaydi |
|---|---|---|---|---|
| **2** | Xavfsizlik + build | `.gitignore` (`attestatsiya/fizika/ATT_EST*/`, `_private/`); `build_bank.py` (LaTeX→bloklar, TikZ→SVG, PNG→WebP, KaTeX validatsiya); lokal preview | `.gitignore`, `tools/attestatsiya-fizika/*`, `assets/attestatsiya-fizika/fig/*` (yangi) | sayt sahifalari |
| **3** | Firestore Rules + indekslar | §8 data model qoidalari; `canAccessAttestation()`; mavjud bloklar o'zgarmaydi. Lokal rules-evaluator testlari (draft yashirin, kalit vaqtdan oldin yopiq, vaqt soxtalashtirilmaydi, delete yo'q) | `firestore.rules` (qo'shimcha blok), `firestore.indexes.json` | `users`/`results`/`xpGrants` qoidalari mazmuni |
| **4** | Admin: Kunlik testlar | `admin/attestatsiya.html`: Day · Mavzu · Savollar · Status · Publish date · Solution date · **[PUBLISH]** (+ tasdiq modali, faqat keyingi Day'ni publish qilishga ruxsat), Import (dry-run → yozish), urinishlarni qayta hisoblash | `admin/attestatsiya.html`, `assets/js/admin/attestation*.js` (yangi); admin sidebar'ga 1 havola | boshqa admin sahifalar mantig'i |
| **5** | Foydalanuvchi UI | `attestatsiya/fizikaattestatsiya.html` (hozir bo'sh) — 2.0 qobiq: "Bugungi test", arxiv (natija + yechim), statistikam. Test sahifasi: savollar paneli, qoralama (localStorage), topshirish, KaTeX renderer | `attestatsiya/fizikaattestatsiya.html`, `attestatsiya/fizika-test.html` (yangi), `assets/js/attestatsiya-fizika/*`, `assets/css/attestatsiya-fizika.css` | `attestatsiya.html` hub (Fizika kartasi allaqachon `fizikaattestatsiya.html` ga ishora qiladi), barcha Pedagogika fayllari |
| **6** | Statistika + integratsiya | Bo'lim/mavzu statistikasi; bildirishnomalar ("Bugungi test", "Yechim ochildi") — mavjud `notification-service` ga qo'shimcha manba; "Mening natijalarim" da attestatsiya kartasi | `notification-service.js`, `results-page.js` (qo'shimcha, mavjud mantiq o'zgarmaydi) | `results` kolleksiyasi, XP |
| **7** | QA | To'liq regressiya, Pedagogika SHA-256 tekshiruvi, mobil, accessibility, Rules testlari, 1 hafta "soya" rejimi (admin o'zi publish/yechish) | — | — |
| **8** | (Kelajak) PAID | `config.accessMode = "paid"`, admin `attestationAccess` ustuni; to'lov alohida | `firestore.rules` (`adminAccessUpdate`), `admin/access.js` | — |

## 3. Admin Publish workflow (kelajak)

1. Import'dan keyin 32 test `draft`.
2. Har kuni admin "Kunlik testlar" sahifasida keyingi Day qatorida **[PUBLISH]** → modal: "Day 5 · Ish, energiya, quvvat · 32 savol · yechim ertaga 00:00 da ochiladi" → tasdiq.
3. Yozuv: `published: true`, `status: "published"`, `publishDate: serverTimestamp()`, `solutionAvailableAt` (config bo'yicha), `publishedBy`.
4. Foydalanuvchilarda "Bugungi test" paydo bo'ladi (bildirishnoma ham).
5. Ertasi 00:00 — oldingi kun kaliti Rules bo'yicha avtomatik ochiladi; foydalanuvchi sahifasi natijani hisoblaydi va ko'rsatadi (ball + vaqt + yechimlar).
6. Admin yangi Day'ni publish qiladi. Unutilsa — "Bugungi test" bo'sh, oldingi kun yechimi baribir ochiladi.
7. Xato topilsa: test `archived` (yashiriladi, o'chirilmaydi) yoki kontent tuzatish (versiya bilan).

Kelajakda avtomatik publish (jadval bo'yicha) — Cloud Scheduler/Functions bilan; model o'zgarmaydi.

## 4. Siz qaror qilishingiz kerak bo'lgan savollar

1. **Yangi Firestore kolleksiyalari** (`attestationTests`, `attestationAttempts`, `attestationBank`, `config`) — roziligingiz? (`results` ni ishlatish Umumiy fizika progressini buzadi.)
2. **Natija vaqti**: ball ertasi kuni (kalit bilan birga) ko'rsatiladi — spetsifikatsiyangizga mos va kalitni yashiradi. Topshirgan zahoti ball kerakmi? (Unda kalit test vaqtida brauzerga tushadi.)
3. **Yechim ochilish vaqti**: ertasi kuni 00:00 (Toshkent) yoki publish + 24 soat?
4. **Urinishlar**: bitta rasmiy urinish + arxivda mashq rejimi (saqlanmaydi) — ma'qulmi?
5. **Taymer**: Daily Test vaqt chegarasisiz (faqat sarflangan vaqt o'lchanadi) — yoki limit kerakmi?
6. **Metodika savollari** (75 ta, Day 30–32) Fizika kursida qolsinmi?
7. **Xom materiallar** (`attestatsiya/fizika/ATT_EST*`, 149 MB) — repo tashqarisiga ko'chiramizmi yoki `.gitignore`?

## 5. 1-bosqich QA

| Tekshiruv | Natija |
|---|---|
| Pedagogika fayllari aniqlangan | ✅ 18 fayl + 2 umumiy hub fayli (`attestation_architecture.md` §2.2) |
| Pedagogikaga tegilmagan | ✅ 20/20 SHA-256 o'zgarmagan; `git diff -- attestatsiya/` bo'sh |
| 1027 ta Fizika savoli tahlil qilingan | ✅ `problems.json` 1027, `.sol` 1027, `.qtx` qiyinlik 1027 |
| Duplicate policy hisobga olingan | ✅ 1167 → 140 birlashtirilgan → 1027; qolgan takror 0/0 |
| Barcha savollar mavzularga biriktirilgan | ✅ 6 bo'lim, 41 mavzu |
| 25–40 savollik Daily Testlar | ✅ 32 kun, min 26, max 38 |
| Kichik mavzular mantiqan birlashtirilgan | ✅ `LINK` vaznlari bilan (istisnolar §1) |
| Katta mavzular optimal bo'lingan | ✅ ketma-ket, teng (32/33, 31/32, 31/31 …) |
| Birorta savol yo'qolmagan | ✅ biriktirilmagan 0 |
| Birorta savol ikki marta ishlatilmagan | ✅ 0 |
| Daily Test plan tayyor | ✅ `attestation_daily_test_plan.md` + `.json` |
| Natija modeli | ✅ `attestation_data_model.md` §4 |
| Time tracking modeli | ✅ `startedAt`/`completedAt` = `request.time`, `timeSpentSec` Rules'da tekshiriladi |
| Global course day modeli | ✅ §3 data model |
| Open access modeli | ✅ `config.accessMode = "open"` |
| Paid access kengaytirish | ✅ `attestationAccess` + `accessMode = "paid"` |
| Admin Publish workflow | ✅ §3 yuqorida |
