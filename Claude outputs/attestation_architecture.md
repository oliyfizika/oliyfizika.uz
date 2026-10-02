# Attestatsiya → Fizika: arxitektura tahlili (1-bosqich)

Sana: 2026-10-02 · Branch: `redesign/oliyfizika-2.0` (HEAD `519037c`) · Holat: **faqat tahlil, sayt kodi o'zgartirilmagan**

Bog'liq hujjatlar: `attestation_daily_test_plan.md` · `attestation_data_model.md` · `attestation_import_plan.md` · `attestation_implementation_plan.md`

---

## 1. Qisqa xulosa

| Savol | Javob |
|---|---|
| Fizika hozir qanday ishlaydi? | **Ishlamaydi.** `attestatsiya/fizikaattestatsiya.html` — 0 bayt bo'sh fayl. Hub sahifasidagi "Fizika" kartasi bo'sh sahifaga olib boradi. |
| Pedagogika qanday ishlaydi? | Mustaqil statik test: `pedagogika-testlari/index.html` → `test.html?test=N` → `quiz.js` `data/testN.js` ni `<script>` orqali yuklaydi. Firebase, natija saqlash, 2.0 qobiq yo'q. |
| 1027 savol qayerda? | `attestatsiya/fizika/ATT_EST solutions/_build/solutions_src/problems.json` (savollar, LaTeX) + `C*.sol` (19 fayl, 1027 yechim) + `_build/extract/F*.qtx` (qiyinlik, manba sahifasi). Git'da **kuzatilmaydi** (untracked). |
| Test engine bormi? | 3 ta: Milliy sertifikat mock engine (**muzlatilgan**, matnni oddiy matn sifatida chiqaradi, LaTeX yo'q), Umumiy fizika `js/multiple-choice-test.js` (darslarga + XP'ga bog'langan), Pedagogika `quiz.js` (mustaqil). Hech biri attestatsiya Daily Test uchun to'g'ridan-to'g'ri mos emas. |
| Natijalar qanday saqlanadi? | Firestore `results` (addDoc). Rules: `lessonId` son, `passed == percent >= 80`, update taqiqlangan. `progress-service` shu kolleksiyani `uid` bo'yicha o'qib, **Umumiy fizika darslarini** ochadi. |
| Progress? | Umumiy fizika: localStorage `mechanicsUnlockedLesson` + Firestore `results` dan hisoblanadi. Alohida progress kolleksiyasi yo'q (qaror: yaratilmaydi). |
| Firestore? | `users/{uid}`, `users/{uid}/xpGrants/L{n}`, `results/{id}`. Qolgani default deny. |
| Admin panel? | `admin/*.html` (6 sahifa) + `assets/js/admin/*`. Kirish: `users/{uid}.role == 'admin'` (`requireAdmin()`). Admin faqat `role/fullAccess/mockTestsAccess` ni yoza oladi. |
| Notification? | Bor, lekin **saqlanmaydi**: `notification-service.js` har safar `results`/progress/yutuqlardan hosil qiladi; o'qilgan holati localStorage'da. |
| KaTeX/MathJax? | Saytda **yo'q**. Yangidan qo'shiladi (faqat Fizika attestatsiya sahifalarida). |

**Asosiy arxitektura qarori:** Fizika attestatsiyasi uchun **alohida Firestore kolleksiyalari** kerak (`attestationTests`, `attestationAttempts`, `attestationBank`, `config/attestationFizika`). Mavjud `results` kolleksiyasidan foydalanib bo'lmaydi — u Umumiy fizika darslarini ochish va XP bilan bog'langan (§6.1). Bu avvalgi "yangi kolleksiya yaratilmaydi" qaroriga (progress/bildirishnomalar uchun berilgan) zid emas, lekin **sizning tasdig'ingiz kerak**.

---

## 2. Attestatsiya bo'limi — mavjud fayllar

```
attestatsiya/
├── attestatsiya.html            HUB (Fizika + Pedagogika kartalari) — UMUMIY, tegilmaydi
├── attestatsiya.css             HUB uslubi — UMUMIY, tegilmaydi
├── fizikaattestatsiya.html      FIZIKA kirish sahifasi — 0 bayt, bo'sh  ← yangi tizim shu yerga
├── pedagogika.html              PEDAGOGIKA (eski 3 ta karta, hubdan bog'lanmagan) — tegilmaydi
├── pedagogika-testlari/         PEDAGOGIKA — tegilmaydi
│   ├── index.html, test.html, quiz.js, style.css
│   └── data/test1.js … test13.js
└── fizika/                      FIZIKA xom materiallari (git'da YO'Q, ~149 MB)
    ├── ATT_EST/                 asosiy kitob (01_main.pdf/tex, boblar, 136 PNG rasm, hisobotlar)
    └── ATT_EST solutions/       asosiy kitob + yechimlar kitobi + _build (problems.json, *.sol, *.qtx, skriptlar)
```

Sayt navigatsiyasi: `assets/js/shell/nav-config.js` → `attestatsiya/attestatsiya.html` (`protected: true`); bosh sahifa `index.html:145` va `sitemap.xml:13` ham hubga ishora qiladi. Hub sahifasi 2.0 qobig'iga (app-shell) hali ulanmagan — eski qorong'i dizayn.

### 2.1 Fizikaga tegishli fayllar

| Fayl/papka | Rol | 1-bosqichdagi holat |
|---|---|---|
| `attestatsiya/fizikaattestatsiya.html` | Hub "Fizika" kartasi shu yerga olib boradi | O'zgartirilmadi. Keyingi bosqichda Fizika kurs sahifasi shu faylda quriladi — **hub faylini o'zgartirish shart bo'lmaydi** |
| `attestatsiya/fizika/ATT_EST*/**` | Ma'lumot manbai (faqat o'qiladi) | O'zgartirilmadi |
| `tools/attestatsiya-fizika/plan_daily_tests.py` | **Yangi**: audit + Daily Test rejasi generatori | Qo'shildi |
| `docs/attestatsiya-fizika/*` | **Yangi**: shu hisobotlar, `daily_test_plan.json`, `_audit.json` | Qo'shildi |

### 2.2 Tegilmaydigan fayllar (QAT'IY)

Pedagogika (kod, JSON/JS ma'lumot, CSS, routing, UI):

```
attestatsiya/pedagogika.html
attestatsiya/pedagogika-testlari/index.html
attestatsiya/pedagogika-testlari/test.html
attestatsiya/pedagogika-testlari/quiz.js
attestatsiya/pedagogika-testlari/style.css
attestatsiya/pedagogika-testlari/data/test1.js … test13.js   (13 fayl)
```

Umumiy (Fizika ham, Pedagogika ham ishlatadi) — o'zgartirilmaydi, chunki Pedagogika routingiga ta'sir qiladi:

```
attestatsiya/attestatsiya.html   (Pedagogika kartasi shu yerda)
attestatsiya/attestatsiya.css
```

Nazorat: 20 faylning SHA-256 xeshlari 1-bosqich boshida olindi va oxirida qayta tekshirildi — **20/20 o'zgarmagan** (`attestation_implementation_plan.md` §QA). Pedagogika hech qanday Firestore yo'li, localStorage kaliti yoki umumiy JS modulidan foydalanmaydi — yangi Fizika tizimi unga texnik jihatdan ham ta'sir qila olmaydi.

Shuningdek tegilmaydi (boshqa bo'limlar, avvalgi qarorlar): Milliy sertifikat mock engine (`milliy-sertifikat/mock-testlar/js/*`, MUZLATILGAN), `results` kolleksiyasi sxemasi, XP tizimi.

---

## 3. Mavjud tizimlar va ularni qayta ishlatish

| Mavjud modul | Nima qiladi | Fizika attestatsiyasida |
|---|---|---|
| `assets/js/core/session.js` | Firebase'ni dinamik yuklaydi, `onSession`, `users/{uid}` profili | **To'g'ridan-to'g'ri qayta ishlatiladi** (auth, `fullName`, `role`, kelajakda `attestationAccess`) |
| `assets/js/shell/app-shell.js` + `nav-config.js` | 2.0 qobiq, sidebar, himoyalangan sahifa | **Qayta ishlatiladi** (`data-shell-title`, `protected`) |
| `assets/js/ui/{modal,feedback,icons,reveal}.js` | Modal, toast, ikonlar | **Qayta ishlatiladi** |
| `assets/js/admin/admin-common.js` | `requireAdmin`, `confirmAction`, `formatDateTime`, `stateBox`, `esc` | **Qayta ishlatiladi** (admin "Kunlik testlar" sahifasi) |
| `assets/js/results/results-data.js` | `toDate`, `formatDate` | Yordamchilar qayta ishlatiladi |
| `assets/js/notifications/notification-service.js` | Hosila bildirishnomalar, deterministik ID (`hash`) | **Kengaytiriladi**: "Bugungi test chiqdi", "Kecha testi yechimi ochildi" — yangi kolleksiyasiz, `attestationTests` dan hosil qilinadi |
| `milliy-sertifikat/mock-testlar/js/test-engine.js` | Mock imtihon engine | **Qayta ishlatilmaydi**: muzlatilgan; matnni oddiy matn qiladi (KaTeX yo'q); 180 daq. taymer, Rasch modeli. G'oyalar (deadline asosidagi taymer, `storage.js` dagi localStorage qoralama, `calculator.js`) namuna sifatida olinadi, fayllar import qilinmaydi/o'zgartirilmaydi |
| `js/multiple-choice-test.js`, `js/services/result-service.js`, `xp-service.js` | Umumiy fizika dars testi → `results` + XP | **Qayta ishlatilmaydi** (`lessonId`, 80% o'tish, XP grant semantikasi attestatsiyaga mos emas) |
| `progress-service.js` | Umumiy fizika progressi | Tegilmaydi; attestatsiya statistikasi alohida modulda |
| `firestore.rules` | Xavfsizlik | **Qo'shimcha bloklar** qo'shiladi (mavjud qoidalar o'zgarmaydi) |

---

## 4. 1027 savol: mavjud format

| Manba | Mazmuni |
|---|---|
| `problems.json` (1027 obyekt) | `id` (manba kodi `F06-001`), `ch` (1–6 bob), `num` (bob ichidagi raqam), `section` (= mavzu, 41 ta), `tex` (shart + variantlar LaTeX), `answer`, `answer_src`, `check` (TEKSHIRISH KERAK sababi), `fixes`, `fingerprint`, `type` (mcq/open/match/multi), `nopts` (0/4/5) |
| `C*.sol` (19 fayl, 1027 blok) | `status` (full/theory/undetermined/source_error), `result` (yechim natijasi), `verify` (OK/NEW/XATO/NONE), `note` + LaTeX yechim tanasi (`\shart`, `\yechimsarlavha`, `\javob`, `\tekshiruv`, ...) |
| `_build/extract/F*.qtx` (1167 blok) | `difficulty` (1–4), `score`, `src_no`, `page` — 1027 tasining hammasida qiyinlik bor |
| `images/masala_NNN*.png` (136) | 128 ta savoldagi rasmlar (`\rasm{...}`) |
| TikZ/circuitikz | 220 savol + 7 yechimda vektor chizma — web uchun SVG'ga aylantiriladi (qurilmada `pdflatex` + `dvisvgm` bor) |

Talab qilingan maydonlar bilan moslik: `id, section, topic, question, options, correctAnswer, solution, difficulty, source` — **hammasi mavjud ma'lumotdan olinadi**, faqat formati o'zgaradi (LaTeX → web bloklar + KaTeX). Bo'lim (`section`) = kitob bobi (6 ta), mavzu (`topic`) = hozirgi `section` maydoni (41 ta). Batafsil: `attestation_data_model.md`.

Sifat ko'rsatkichlari (`_audit.json`):

- 1167 ajratilgan → 140 takror birlashtirilgan → **1027** (qolgan aniq takror: 0, fingerprint takror: 0)
- Avtomatik baholanadigan: **865**; variantsiz ochiq savol (o'zini tekshirish): **81**; javobi ishonchsiz (manba xatosi 55, aniqlanmagan 26): **81** — bular ham kunlik testda qoladi, lekin ballga kirmaydi
- 1 ta "MUHIM XATO" (kitob javobi yechimga zid) — u ham baholanmaydiganlar ro'yxatida

---

## 5. Yangi tizim (yuqori daraja)

```
            ┌────────────── OFFLINE (qurilmada, bir marta) ──────────────┐
problems.json + *.sol + *.qtx + PNG/TikZ
            │  tools/attestatsiya-fizika/build_bank.py  (2-bosqich)
            ▼
  _private/attestatsiya-fizika/bank.json   ← javob+yechim bilan, GIT'GA KIRMAYDI
  assets/attestatsiya-fizika/fig/*.svg|webp ← faqat rasmlar (ommaviy)
            │  admin/attestatsiya.html → "Import" (admin faylni tanlaydi)
            ▼
┌──────────────────────────── FIRESTORE ────────────────────────────┐
│ config/attestationFizika        accessMode: open|paid             │
│ attestationBank/{qid}           admin-only master (javob+yechim)   │
│ attestationTests/{testId}       Day meta, status, publishDate      │
│   └ content/questions           savollar (javobsiz) — published'da │
│   └ content/key                 javob+yechim — solutionAvailableAt │
│ attestationAttempts/{uid_test}  startedAt/completedAt/javoblar/ball│
└────────────────────────────────────────────────────────────────────┘
            ▲                                   ▲
   attestatsiya/fizikaattestatsiya.html    admin/attestatsiya.html
   (Bugungi test, arxiv, natijalar,        (Kunlik testlar jadvali,
    statistika; KaTeX)                      [PUBLISH], import)
```

Kun tsikli (global kalendar):

```
Admin [PUBLISH] Day N ──► published=true, publishDate=now, solutionAvailableAt=ertasi 00:00 (Toshkent)
  Foydalanuvchi: "Bugungi test" = Day N  →  boshlaydi (startedAt) → topshiradi (completedAt)
Ertasi kuni 00:00 ──► Day N kaliti ochiladi → natija (ball, vaqt) + yechimlar
Admin [PUBLISH] Day N+1 ──► yangi "Bugungi test"
```

Hech qachon o'chirilmaydi: testlar `archived` bo'ladi, Rules'da `delete: if false`.

---

## 6. Integratsiya xavflari va qarorlar

### 6.1 `results` kolleksiyasi ishlatilmaydi
`progress-service.loadResults()` foydalanuvchining **barcha** `results` hujjatlarini o'qiydi va `lessonId` bo'yicha Umumiy fizika darslarini ochadi; Rules `lessonId is number`, `passed == percent >= 80` ni talab qiladi; XP grant `results` ga bog'langan. Attestatsiya natijasini shu yerga yozish darslarni noto'g'ri ochishi, "Mening natijalarim" va bildirishnomalarni chalkashtirishi mumkin. → alohida `attestationAttempts`.

### 6.2 Javoblar statik faylda bo'lmasligi kerak
Sayt statik (GitHub Pages). Repo'ga qo'yilgan har qanday fayl ommaviy yuklab olinadi. Shuning uchun `correctAnswer` va `solution` faqat Firestore'da, Rules bilan `solutionAvailableAt` dan keyin ochiladi.

**DIQQAT (hozirgi xavf):** `attestatsiya/fizika/` (149 MB: javob kaliti, yechimlar PDF, LaTeX) hozir untracked. Agar `git add .` qilinib push qilinsa, **barcha javoblar va yechimlar saytda ommaviy bo'ladi**. Tavsiya: bu papkani repo'dan tashqariga ko'chirish yoki `.gitignore` ga `attestatsiya/fizika/ATT_EST*/` va `_private/` qo'shish (2-bosqichning birinchi qadami; tasdig'ingiz bilan).

### 6.3 Natija "ertasi kuni" ko'rsatiladi
Spetsifikatsiyangiz (test kuni — TEST; ertasi — NATIJA + YECHIM) javob kalitini test vaqtida yashirish imkonini beradi. Shuning uchun ball topshirish paytida emas, kalit ochilgandan keyin hisoblanadi. Javoblar topshirishda o'zgarmas qilib saqlanadi, `startedAt`/`completedAt` server vaqti (`request.time`) — vaqtni soxtalashtirib bo'lmaydi.

### 6.4 Matematik matn
Mock engine matnni `textContent` bilan chiqaradi va muzlatilgan. Fizika attestatsiyasi uchun alohida yengil renderer: savol matni xavfsiz bloklarga (paragraf, ro'yxat, jadval, rasm) ajratiladi, formulalar KaTeX bilan (`trust: false`, `throwOnError: false`). `innerHTML` ma'lumotdan to'g'ridan-to'g'ri ishlatilmaydi.

### 6.5 Boshqa topilmalar
- LaTeX preambulasidagi suv belgisi `@Fizika_Pro` (eski kanal). Web versiyada ishlatilmaydi; PDF kitoblar qayta yig'ilsa `@oliyfizika_uz` ga almashtirish kerak.
- "Maxsus mavzular"dagi 75 ta "Fizika o'qitish metodikasi" savoli 50 talik testlarning pedagogika/metodika qismidan. Ular 1027 tarkibida — rejaga kiritildi (Day 30–32). Xohlasangiz Pedagogika bo'limiga **ko'chirilmaydi**, Fizika kursida qoladi.
- `attestatsiya/pedagogika.html` → `pedagogika-testlari/test1.html` (mavjud emas) — eski, hubdan bog'lanmagan sahifa. Pedagogika bo'lgani uchun tegilmadi, faqat qayd etildi.
