# 17 — Rasm pipeline auditi va root cause

Sana: 2026-10-03. Production diagnostikasi: oddiy user akkaunti (Day 1 boshlanmagan), Claude ilovasidagi brauzer, **faqat o‘qish** (hech narsa yozilmadi, test boshlanmadi). Skript: `tools/attestatsiya-fizika/diag/figure_diagnostic.js`.

## 1. Root cause (asosiy) — production sozlamasi Storage'ni ko‘rsatmoqda, Storage esa ishlamaydi

| Tekshiruv (production) | Natija |
|---|---|
| `attestationPhysicsSettings/config.figureBackend` | **`"storage"`** (kutilgan: `"firestore"`) |
| Storage `getBlob(attestation-physics/questions/att-fizika-day-01/…)` | tarmoq so‘rovi ham chiqmaydi, **10 s ichida javob yo‘q** (SDK standarti — 2 daqiqagacha qayta urinish) |
| Sahifa yo‘li `api.figureUrl()` (sozlama bo‘yicha) | **10 s timeout** → rasm «Rasm yuklanmoqda…» holatida qotib qoladi |
| Firestore muqobili `attestationPhysicsDailyTests/att-fizika-day-01/figures/{id}` | **16/16 mavjud**, `bytes` = base64 dekodlangan uzunlik (16/16), `<img>` **16/16 yuklandi** |

Xulosa: Firestore fallback ma’lumotlari production'da to‘liq va to‘g‘ri; foydalanuvchi sahifasi ularni **ishlatmaydi**, chunki sozlama `storage`. Storage bucket ishlamagani uchun `getBlob` cheksiz kutadi.

Sozlama nega `storage` qolgan: admin sahifadagi tugma «almashtirish» (flip) edi — har bosish qiymatni teskarisiga o‘tkazadi. Ikki marta bosilsa yoki sozlama hujjati import'dan oldin o‘zgartirilgan bo‘lsa (import mavjud sozlamani o‘tkazib yuboradi), qiymat `storage` bo‘lib qoladi. Qaysi biri bo‘lgani Firestore'da tarix yo‘qligi uchun aniqlanmaydi; natija — yuqoridagi jadval.

### End-to-end diagnostika — bitta real rasm

| Bo‘g‘in | Qiymat |
|---|---|
| questionId | `AF-1-003` (Day 1) |
| figureId | `4187f1337f73d5e7.webp` (kontent-xesh) |
| sourcePath (canonical) | `ATT_EST solutions/images/masala_003.png` (`\rasm{masala_003.png}`), blok kaliti `img-masala_003` |
| normalizedPath | `_private/attestatsiya-fizika/figures/question/4187f1337f73d5e7.webp` (530×125, 6656 bayt) |
| Firestore path | `attestationPhysicsDailyTests/att-fizika-day-01/figures/4187f1337f73d5e7.webp` |
| stored field | `{testId, id, mime: "image/webp", bytes: 6656, data: <base64, 8876 belgi>}` |
| Storage path (sozlama bo‘yicha so‘ralgan) | `attestation-physics/questions/att-fizika-day-01/4187f1337f73d5e7.webp` — **javob yo‘q** |
| rendered src | `figureBackend=storage` → `getBlob` hech qachon tugamaydi → `img.src` o‘rnatilmaydi |
| final DOM src | bo‘sh; `figure[data-state="loading"]` |
| load | **FAIL** (Storage yo‘li) · Firestore yo‘li bilan **OK** (530×125) |

## 2. Qo‘shimcha topilgan nuqson — yechim rasmlari (20 havola)

`prepare` yechim rasmlarini `sf − qf` (faqat yechimda bo‘lganlar) deb yozardi. Yechim savoldagi rasmni qayta ishlatsa (20 holat: Day 4, 5, 6, 10, 13, 15, 17–21, 25, 29), yechim sahifasi uni `solutionFigures/{id}` (Storage: `solutions/…`) dan so‘raydi, u esa yo‘q edi — rasm chiqmaydi. Day 1'ga ta’sir qilmaydi. Production baseline'da tekshirildi: **20 ta havola topilmaydi**; yangi bundle'da **0**.

## 3. Tuzatishlar (minimal, production-safe)

| # | Tuzatish | Fayl |
|---|---|---|
| 1 | **Sozlama:** production'da `figureBackend` ni `firestore` ga o‘tkazish — kod deploy'i shart emas, bitta maydon. *Siz tasdiqlagandan keyin, admin sahifadan.* | — (ma’lumot) |
| 2 | Admin tugmasi: joriy (serverdagi) qiymat va aniq maqsadni ko‘rsatadi («storage → «firestore» ga o‘tkazish»); bosilganda avval serverdan qayta o‘qiydi; `firestore` ga o‘tishdan oldin har kun uchun `figures` hujjatlari sonini `figureCount` bilan solishtiradi (yetishmasa — rad); saqlangandan keyin serverdagi qiymatni ko‘rsatadi | `assets/js/admin/attestation-fizika.js` |
| 3 | Storage yo‘li cheksiz kutmaydi: `maxOperationRetryTime = 15 s` + 15 s timeout → rasm «Rasmni yuklab bo‘lmadi» holatiga o‘tadi | `assets/js/attestatsiya-fizika/api.js` |
| 4 | Yechim rasmlari: har bir yechim havolasi `solutionFigures`/`solutions` ga yoziladi (+20 hujjat, Storage 435 fayl) | `tools/attestatsiya-fizika/prepare_attestation_data.py` |
| 5 | Yangi gate'lar: `image_refs_resolved` (435 havola: id/w/h + fallback hujjat mavjud), `image_render_data_valid` (base64 = `bytes`, MIME imzosi WEBP/PNG/SVG, hujjat < 1 MB) | prepare |
| 6 | E2E: Firestore fallback rejimi (desktop + mobil, Day 1: 16/16), himoya (hujjatsiz o‘tkazish rad), Day 4 qayta ishlatilgan yechim rasmlari | `tools/attestatsiya-fizika/e2e/e2e_figures.mjs` |

`render.js` o‘zgartirilmadi — root cause unda emas. Avtomatik «Storage ishlamasa Firestore'ga o‘tish» qo‘shilmadi: u konfiguratsiya xatosini yashirib, har rasmga 15 s kechikish qo‘shardi.

## 4. Firestore fallback — arxitektura bahosi

| Ko‘rsatkich | Qiymat |
|---|---|
| Hujjatlar | 435 (408 savol + 27 yechim), mime: 263 SVG, 172 WEBP |
| Hajm | xom 9.0 MB, base64 bilan 11.5 MB (+34 %) |
| Hujjat hajmi | median 19.7 KB, p95 71 KB, max **326 KB** (SVG) — 1 MiB chegarasidan uzoq |
| Bir kun (savol rasmlari) | median 0.33 MB, max 0.91 MB (Day 21, 26 rasm); Day 1: 16 rasm, 0.32 MB |
| Yuklash | lazy (IntersectionObserver, 300 px oldindan) — test sahifasi bir vaqtda 1 savol ko‘rsatadi, ya’ni bir vaqtda 1–2 hujjat |
| Kesh | Blob URL faqat sahifa ichida; sahifa qayta ochilsa qayta o‘qiladi (Firestore read narxi: kuniga user boshiga ≈ rasm soni) |
| Xavfsizlik | Rules: draft — faqat admin; published — kirgan user; yechim rasmlari — `solutionAvailableAt` dan keyin (Storage bilan bir xil) |

Xulosa: hozirgi hajmda Firestore fallback production uchun **yaroqli**: hujjatlar kichik, yuklanish lazy, xavfsizlik bir xil. Kamchiliklari: base64 hisobiga +34 % trafik va HTTP keshi yo‘q. Masshtab o‘ssa (masalan, minglab faol user), Storage (CDN keshi bilan) afzal.

## 5. Storage auditi (alohida)

`getBlob` so‘rovi tarmoqqa umuman chiqmadi va timeout bo‘ldi. Bu odatda bucket yo‘qligi yoki yaratilmaganini (yangi `*.firebasestorage.app` bucket Blaze tarifini talab qiladi), CORS sozlanmaganini yoki `storage.rules` deploy qilinmaganini bildiradi. Tekshirish uchun Console → Storage kerak. Storage tayyor bo‘lguncha `figureBackend = firestore` qoladi; Storage majburiy emas.
