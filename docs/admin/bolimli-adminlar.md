# Bo‘limli adminlar (Admin System 2.0)

Sayt egasi (owner) yangi admin tayinlayotganda u qaysi bo‘limlarni boshqarishini belgilaydi.
Ruxsatlar faqat interfeysda emas, **Firestore Rules**da ham tekshiriladi.

## Rollar

| Kim | Qanday belgilanadi | Nima qila oladi |
|---|---|---|
| **Owner** (sayt egasi) | `users/UID`: `role = "admin"` **va** `adminRole = "owner"` (faqat Firebase Console’da) | Hamma bo‘limlar, admin tayinlash/olib tashlash, bo‘limlarni o‘zgartirish, amallar jurnalini ko‘rish, profilni o‘chirish |
| **Bo‘limli admin** | Owner «Adminlar» sahifasidan tayinlaydi: `role = "admin"`, `adminSections = [...]` | Faqat belgilangan bo‘limlar |
| **Eski (to‘liq) admin** | `role = "admin"`, `adminSections` maydoni **yo‘q** | Barcha bo‘limlar (avvalgidek), lekin admin tayinlay olmaydi |

## Bo‘limlar

| ID (`adminSections`) | Bo‘lim | Nima beradi |
|---|---|---|
| `umumiy-fizika` | Umumiy fizika | «Natijalar» sahifasi (darslik testlari natijalari) |
| `milliy-sertifikat` | Milliy sertifikat | «Mock natijalari» sahifasi |
| `attestatsiya-fizika` | Attestatsiya — Fizika | Kunlik/mock testlar: import, e’lon qilish, arxivlash, urinishlar, sozlamalar |
| `foydalanuvchilar` | Foydalanuvchilar | Foydalanuvchilar ro‘yxati va profillari |
| `kirish-huquqlari` | Kirish huquqlari | Full Access, Mock Test Access, Attestatsiya ruxsatini berish/olish |
| `simulyatsiyalar` | Simulyatsiyalar | Hozircha admin sahifasi yo‘q (oldindan biriktirish mumkin) |
| `olimpiada` | Olimpiada | Hozircha admin sahifasi yo‘q (oldindan biriktirish mumkin) |

Attestatsiya → **Pedagogika** ro‘yxatda yo‘q va unga tegilmagan.
Pullik kontent bayroqlari (`mockTestsAccess`, `attestationAccess`, `fullAccess`) va Milliy sertifikat yechimlari kirish tizimi o‘zgarmagan.

## Migratsiya (bir martalik)

1. **PR’ni `main` ga qo‘shing.**
2. **Owner’ni belgilang** (Firebase Console → Firestore Database → `users` → o‘z UID’ingiz hujjati):
   `adminRole` maydonini qo‘shing — turi *string*, qiymati `owner`. `role` qiymati `admin` bo‘lib qolsin.
   UID’ni admin paneldagi «Sozlamalar» sahifasida ko‘rish mumkin.
3. **Firestore Rules’ni deploy qiling** (toza `main` nusxasidan):
   ```bash
   firebase deploy --only firestore:rules --project oliy-fizika
   ```
   (Storage ishlatilmayotgan bo‘lsa, `storage.rules` ni deploy qilish shart emas.)
4. Admin panelda **«Adminlar»** sahifasi paydo bo‘ladi. Mavjud adminlar «Barcha bo‘limlar (eski to‘liq admin)» deb ko‘rinadi —
   ularni «Tahrirlash» orqali kerakli bo‘limlarga cheklang yoki adminlikdan oling.

> Muhim: 2-qadam deploy’dan **oldin** bajarilsin. Aks holda deploy’dan keyin hech kim admin tayinlay olmaydi
> (eski adminlar boshqa hamma ishni avvalgidek bajaraveradi).

## Amallar jurnali

`adminAuditLog` kolleksiyasi: kim (`actorUid`, email, ism), qachon (`at` — server vaqti), nima (`action`, `summary`),
qaysi bo‘limda, kimga nisbatan. Yoziladigan amallar: admin tayinlash/bo‘lim o‘zgartirish/olib tashlash, kirish huquqini
berish/olish, Attestatsiya testini e’lon qilish/arxivlash/arxivdan chiqarish, import, kirish rejimi va rasm manbai o‘zgarishi.
Jurnalni faqat owner o‘qiydi; hech kim o‘zgartira yoki o‘chira olmaydi.

## Testlar

```bash
python3 tools/admin/test_admin_rules.py                       # Rules: 48 ssenariy
python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8799 &
E2E_PORT=8799 node tools/admin/e2e_admin_sections.mjs          # brauzer E2E: 23 tekshiruv
```

## Kod

- Rules: `firestore.rules` — `adminSectionIds()`, `isSiteOwner()`, `canManage(section)`, `ownerAdminUpdate()`, `adminAuditLog`.
  Attestatsiya bloki generator orqali: `tools/attestatsiya-fizika/rules/attestation_physics.rules.in` (`attAdmin()`).
- UI: `assets/js/admin/permissions.js` (bo‘limlar ro‘yxati — Rules bilan bir xil), `admin-common.js` (`requireAdmin({ section })`,
  `setAdminRole`, `updateAccess`), `audit-log.js`, `admins.js` + `admin/admins.html`, menyu: `nav-config.js` (`section`, `owner`).
- Yangi bo‘lim qo‘shish: ID’ni `permissions.js` dagi `ADMIN_SECTIONS` ga va `firestore.rules` dagi `adminSectionIds()` ga qo‘shing,
  sahifada `requireAdmin({ section: "<id>" })`, Rules’da `canManage('<id>')`.
