# Attestatsiya → Fizika: import strategiyasi

Maqsad: 1027 savolni **qo'lda HTML yozmasdan**, takrorlanuvchi skript bilan Firestore'ga o'tkazish; javob/yechim ommaviy faylga tushmasin; hech bir savol yo'qolmasin.

## 1. Manba (o'zgartirilmaydi)

| Fayl | Nima olinadi |
|---|---|
| `attestatsiya/fizika/ATT_EST solutions/_build/solutions_src/problems.json` | shart, variantlar, javob, tur, mavzu, bob, `check`, `fixes` |
| `…/_build/solutions_src/C*.sol` (19) | yechim tanasi, `status`, `result`, `verify`, `note` |
| `…/_build/extract/F*.qtx` (30) | `difficulty`, `score`, `src_no`, `page` |
| `…/_build/map.txt` | `F01` → asl PDF nomi |
| `…/chapters/*.tex` (`% Also in:`) | takror nusxalar manbalari (`source.alsoIn`) |
| `…/images/masala_*.png` (136) | savol rasmlari |
| `…/preamble.tex` | TikZ kutubxonalari/sozlamalari (SVG kompilyatsiya uchun) |
| `docs/attestatsiya-fizika/daily_test_plan.json` | qaysi savol qaysi kunga (1-bosqich natijasi) |

## 2. Bosqichlar

### A. Build (offline, qurilmada) — `tools/attestatsiya-fizika/build_bank.py`

1. `problems.json` + `.sol` + `.qtx` ni `id` bo'yicha birlashtirish; har birida 1:1 moslik (aks holda to'xtaydi).
2. LaTeX → bloklar (`attestation_data_model.md` §5):
   - `\begin{enumerate}[label=\Alph*)…]` → `options[]` (hozir 946 savolda, hammasi aniqlangan);
   - `\begin{enumerate}[label=\arabic*)]` → `list`; `tabular/tabularx` (70) → `table`; `\textbf/\textit` → belgilar;
   - `\rasm{images/masala_NNN.png}` (128) → `img` (PNG → WebP, kenglik ≤ 1200 px);
   - `tikzpicture`/`circuitikz` (220 savol + 7 yechim) → alohida `standalone` hujjat → `pdflatex` → `dvisvgm --pdf` → SVG (qurilmada ikkalasi ham bor). Qorong'i mavzu uchun SVG oq fonli kartochkada ko'rsatiladi;
   - KaTeX'ga mos emas makrolar almashtiriladi (`\upmu`, `\AA`, `\tekshir`, `\vspace`, `\small` …).
3. Yechim: `\shart{}` → "Berilgan" bloki, `\yechimsarlavha` → "Yechim", `\javob{}` → javob bloki, `\tekshiruv{}`, `\aniqlanmagan{}`, `\manbaxato{}` → izoh bloklari; `\toifa{}` (ichki belgi) olib tashlanadi.
4. `scoring` (auto/self-check/excluded) — `plan_daily_tests.py` dagi bir xil qoida bilan.
5. **Validatsiya (har biri muvaffaqiyatsiz bo'lsa build to'xtaydi):**
   - savollar = 1027, ID'lar takrorlanmaydi, har biri rejadagi aynan 1 kunda;
   - `options.length == nopts`; `correctAnswer ∈ options` (`auto` uchun);
   - har bir formula `katex.renderToString(…, {throwOnError:true})` dan o'tadi (Node + `katex` npm, qurilmada);
   - har bir rasm/SVG fayli mavjud va > 0 bayt;
   - `planHash` `daily_test_plan.json` bilan mos.
6. Chiqish:
   - `_private/attestatsiya-fizika/bank.json` — to'liq (javob+yechim). **`.gitignore` da, hech qachon deploy qilinmaydi.**
   - `_private/attestatsiya-fizika/build_report.md` — statistikalar, ogohlantirishlar.
   - `assets/attestatsiya-fizika/fig/*.svg|webp` — faqat rasmlar (ommaviy bo'lishi xavfsiz).
   - Ko'rib chiqish uchun lokal preview sahifa (`_private/…/preview.html`): har bir savol + yechim KaTeX bilan — import oldidan ko'z bilan tekshirish.

### B. Import (admin panel orqali)

Service account talab qilmaslik uchun import **admin sahifasida**, administratorning o'z sessiyasi va Rules orqali:

1. `admin/attestatsiya.html` → "Import" bo'limi → admin `bank.json` ni kompyuteridan tanlaydi (fayl serverga yuklanmaydi, brauzerda o'qiladi).
2. **Dry-run**: Firestore'dagi hozirgi holat bilan farq jadvali (yangi / o'zgargan / o'zgarmagan / published — tegilmaydi).
3. Tasdiqlangach `writeBatch` (≤ 400 operatsiya/batch), deterministik ID'lar bilan:
   - `attestationBank/{qid}` — 1027 hujjat;
   - `attestationTests/fizika-day-NN` — 32 hujjat (`status: draft`), `content/questions`, `content/key`;
   - `config/attestationFizika` — mavjud bo'lmasa `{ accessMode: "open", … }`.
4. Idempotent: qayta import faqat o'zgarganlarni yozadi. **Published test savollari import bilan o'zgartirilmaydi** (Rules ham ruxsat bermaydi) — tuzatish faqat `version` oshirilgan alohida "kontent tuzatish" amali bilan va audit izi bilan.
5. Hech qanday `delete` chaqiruvi yo'q.

Muqobil (ixtiyoriy): Node + Firebase Admin SDK skripti — service account kalitini qurilmada saqlashni talab qiladi, shuning uchun asosiy yo'l emas.

### C. Tekshiruv (import'dan keyin)

- Admin sahifasi: 32 test, 1027 bank hujjati, har bir test `questionCount` = `content/questions.length`, kalitlar soni = `scoredCount`;
- read-back xeshi `planHash` bilan solishtiriladi;
- oddiy (admin bo'lmagan) test foydalanuvchi bilan: draft testlar ko'rinmaydi, kalit ochilmaydi.

## 3. Takror (duplicate) siyosati

- PDF darajasidagi 140 takror kitob tuzishda allaqachon birlashtirilgan (`02_duplicates_report.md`); ularning manbalari `source.alsoIn` da saqlanadi — **yo'qolmaydi**.
- Hozirgi 1027 ichida aniq matn bo'yicha 0, fingerprint bo'yicha 0 takror (`_audit.json`).
- "Boshqa sonlar bilan berilgan variant" va "o'xshash" savollar — alohida masala (kitob qarori), alohida savol sifatida qoladi.
- Build har safar takror tekshiruvini qayta bajaradi; yangi takror topilsa — to'xtaydi, avtomatik o'chirmaydi.

## 4. Baholanmaydigan 162 savol

| Guruh | Soni | Kunlik testda | Ball |
|---|---:|---|---|
| Variantsiz ochiq savol (`open`, F27 esdan yozilgan ro'yxat va b.) | 81 | ha, "O'zingizni tekshiring" kartasi | yo'q |
| Manba xatosi (`source_error`) | 55 | ha, "Manbada xato bor" belgisi bilan | yo'q |
| Aniqlanmagan (`undetermined`) / kitobga zid | 26 | ha | yo'q |

Ro'yxat: `attestation_daily_test_plan.md` oxirida. Admin keyinchalik savolni tuzatsa (`review` + `version`), `scoring` → `auto` bo'lishi mumkin; draft testlarda bu avtomatik, published testda — faqat keyingi urinishlar uchun.

## 5. Xavfsizlik nazorati (import oldidan majburiy)

- [ ] `attestatsiya/fizika/ATT_EST*/` va `_private/` `.gitignore` da (yoki repo tashqarisida)
- [ ] `git ls-files | grep -iE 'bank.json|\.sol$|problems.json|01_solutions.pdf'` → bo'sh
- [ ] `assets/attestatsiya-fizika/` da faqat rasm fayllari
- [ ] Rules (§8 data model) Playground'da sinalgan va qo'lda deploy qilingan
