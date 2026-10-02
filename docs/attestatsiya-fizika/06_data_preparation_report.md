# 06 — Data preparation (Attestatsiya → Fizika, 2-bosqich)

Sana: 2026-10-02 · Branch: `redesign/oliyfizika-2.0` · Source of truth: 1-bosqichning 5 hujjati + `daily_test_plan.json` (planHash `00035719f689704f`, o'zgartirilmagan).

## 1. Pipeline

```
raw source ─► normalize ─► validate ─► canonical bank ─► daily tests ─► import-ready
problems.json   texconv.py    28 gate +     questions.public   32 test +       firestore-import.json
C*.sol          (LaTeX→blok)  KaTeX (16146  questions.private  versions/keys/   (2183 operatsiya)
F*.qtx, map.txt               formula)      figures            solutions v1
chapters/*.tex (Also in)
images/*.png, TikZ
```

| Fayl | Vazifa |
|---|---|
| `tools/attestatsiya-fizika/plan_daily_tests.py` | 1-bosqich skripti — **o'zgartirilmagan**, modul sifatida qayta ishlatiladi (`load`, `scoring_of`, `qid`, `SECTIONS`) |
| `tools/attestatsiya-fizika/texconv.py` | LaTeX → xavfsiz web bloklari (yangi) |
| `tools/attestatsiya-fizika/prepare_attestation_data.py` | butun pipeline + validatsiya + import bundle (yangi) |

Ishga tushirish (repo ildizidan):

```
python3 tools/attestatsiya-fizika/prepare_attestation_data.py                  # rasmlar qayta ishlatiladi
python3 tools/attestatsiya-fizika/prepare_attestation_data.py --figures build  # TikZ/PNG qayta yig'iladi (xelatex + pdftocairo kerak)
```

Pipeline deterministik: bir xil manba → bir xil chiqish (`contentHash 0f25934873d22fe1`). Qurilmadagi (Mac) va bulutdagi ishga tushirish bir xil xesh berdi.

## 2. Manba fayllar va moslik

| Manba | Yozuvlar | Moslash kaliti | Natija |
|---|---:|---|---|
| `problems.json` | 1027 | `id` (`F06-001`) | 1027 |
| `C*.sol` (19 fayl) | 1027 | `id:` qatori + `%%% S {bob}.{raqam}` | 1027/1027, kitob raqami ham tekshirildi |
| `extract/F*.qtx` (30) | 1167 | `id` | 1027 tasida qiyinlik, manba raqami, sahifa bor |
| `map.txt` | 30 | `F01`…`F30` | asl PDF nomi |
| `chapters/*.tex` `% Also in:` | 140 | `% Masala … id …` | takror nusxalar manbasi (126 savolda) |
| `images/*.png` | 136 | `\rasm{…}`, `\includegraphics{…}` | barchasi topildi |

Moslashda birorta noaniqlik bo'lmadi (`problems.json` ↔ `.sol` ↔ `.qtx` — 1:1).

## 3. ID strategiyasi

- **Savol ID: `AF-{bob}-{nnn}`** (masalan `AF-1-001` … `AF-6-155`). 1-bosqichda (`daily_test_plan.json`) allaqachon shu ID'lar ishlatilgan — **saqlandi**, yangi ID yaratilmadi.
- Barqarorlik: ID kitobdagi masala raqamiga bog'langan (`AF-3-161` = kitobdagi 3.161). Kitob va yechimlar to'plami raqamlari bir xil, shuning uchun ID PDF kitob, yechim, Daily Test, urinish va natijalar o'rtasida bir xil.
- O'zgarmaslik: savol tuzatilsa ID o'zgarmaydi, `contentVersion` oshadi (09 hisobot §4 — versiyalash).
- Manba ID (`F06-001`) alohida `source.sourceId` da saqlanadi.
- Daily Test ID: `att-fizika-day-01` … `att-fizika-day-32` (1-bosqich rejasidagi ID).
- Urinish ID: `{uid}__{testId}` (bitta rasmiy urinish).

## 4. Field mapping

### Public savol (`questions.public.json`, Firestore `attestationPhysicsQuestions/{id}` va test snapshot)

| Canonical | Manba | Izoh |
|---|---|---|
| `id` | `qid(ch,num)` | `AF-1-001` |
| `section` / `sectionTitle` | `ch` → `SECTIONS` | `mexanika` … `maxsus` |
| `topic` | `problems.json.section` | 41 mavzu |
| `type` | `type` | mcq 893 · open 81 · match 47 · multi 6 (match/multi ham bitta harf javobli) |
| `evaluationType` | `scoring_of()` | **auto 865 · open 81 · unreliable 81** |
| `difficulty` / `difficultyLevel` | `.qtx difficulty` | §5 |
| `question` | `tex` (variantlarsiz qism) | bloklar |
| `options[]` | `tex` dagi `\Alph` ro'yxat | `{key:"A", blocks:[…]}`; matn, formula yoki rasm |
| `optionCount` | `nopts` | tekshirildi: 0/4/5 |
| `testId`, `dayNumber`, `position` | reja | |
| `bookNumber` | `ch.num` | PDF kitob bilan moslik |
| `contentVersion` | — | 1 |

### Private (`questions.private.json`, Firestore `…/{id}/private/answer` — faqat admin)

| Canonical | Manba |
|---|---|
| `correctAnswer` | `.sol result` — faqat `auto` uchun (A–E); open/unreliable → `null` |
| `bookAnswer` | `problems.json answer` (kitobdagi javob, `none` → null) |
| `solutionResult` | `.sol result` (ochiq savollarda qiymat, masalan `320 m`) |
| `solution` | `.sol` tanasi → bloklar |
| `solutionStatus` | full 734 · theory 195 · source_error 58 · undetermined 40 |
| `verify` | OK / NEW / XATO / NONE |
| `evaluationNote` | nega baholanmaydi |
| `source` | `{sourceId, code, file, number, page, taxonomy, alsoIn[]}` |
| `difficultyRaw` | `{level, labelUz, score}` — asl qiymatlar yo'qolmaydi |
| `review` | `check` (TEKSHIRISH KERAK sababi), `fixes`, `answerSource`, `note`, `category` |

## 5. Difficulty mapping

Manbada qiymatlar easy/medium/hard emas, 1–4 son. Aniq mapping:

| `.qtx` | Ma'nosi (manbada) | `difficulty` | Soni |
|---:|---|---|---:|
| 1 | oson | `easy` | 415 |
| 2 | o'rta | `medium` | 359 |
| 3 | murakkab | `hard` | 219 |
| 4 | juda murakkab | `expert` | 34 |

`unknown` kerak bo'lmadi — 1027 tasining hammasida qiymat bor. Asl son (`difficultyLevel`) va `.qtx score` (`difficultyRaw.score`) saqlanadi.

## 6. Matn va formula standarti

Bitta qat'iy format (frontend shu formatni KaTeX bilan chizadi):

- **inline formula:** faqat `$…$` (matn ichida);
- **display formula:** alohida `{"t":"math","tex":"…"}` blok (`\[…\]`, `align*` → `\begin{aligned}…\end{aligned}`);
- matn belgilari: `**qalin**`, `*kursiv*`, `\n` qator; matndagi `\ $ *` ekranlangan;
- bloklar: `p`, `math`, `list`, `table` (`colspan`), `figure`; yechimda `given` (Berilgan), `heading` (Yechim), `answer` (Javob), `check` (Tekshiruv), `status` (aniqlanmagan / manba xatosi / muhim xato).

KaTeX'ga moslash: `\upmu → \mu` (va boshqa `\up…`), qolgan barcha makrolar KaTeX'da bor. Unicode (o‘, ’, «», °, Å) va birliklar (`\mathrm{m/s^2}`, `\,`) o'zgarishsiz qoldi. **16 146 formula** KaTeX 0.16.47 bilan `throwOnError: true` holatda tekshirildi — 0 xato. Konvertatsiyadan keyin matnda birorta LaTeX buyrug'i qolmagani avtomatik tekshiriladi.

Vizual tekshiruv: tasodifiy savollar (jadval, rasmli variant, TikZ chizma, ochiq savol) KaTeX bilan brauzerda render qilinib ko'rildi — formulalar, jadvallar, rasmlar to'g'ri.

## 7. Rasmlar

| Tur | Soni | Joyi | Format |
|---|---:|---|---|
| Savol/variant rasmlari (PNG) | 136 | `assets/attestatsiya-fizika/fig/` | WebP (≤1400 px) |
| Savol TikZ/circuitikz chizmalari | 271 | `assets/attestatsiya-fizika/fig/` | SVG (255); 250 KB dan katta 16 tasi WebP (220 dpi) |
| Faqat yechimdagi TikZ | 7 | `_private/attestatsiya-fizika/solution-figures/` | SVG — ommaviy papkaga **qo'yilmaydi** |

- Fayl nomi = kontent xeshi (`a3bc8de16178ae09.webp`) — savol ID'sidan taxmin qilib bo'lmaydi.
- Public rasmlar jami 8.6 MB. Yechimdagi 20 ta PNG savol rasmlari bilan bir xil (yangi ma'lumot ochmaydi).
- TikZ asl kitob preambulasi bilan (`xelatex` + `pdftocairo`) kompilyatsiya qilinadi; 278 ta chizmaning hammasi muvaffaqiyatli.

## 8. Evaluation turlari

| Tur | Soni | Qoida | Kunlik testda | Ballda |
|---|---:|---|---|---|
| `auto` | 865 | variantli, yechim `full/theory`, `verify ≠ XATO`, bir harf javob | ha | ha |
| `open` | 81 | variantsiz | ha — "o'zingizni tekshiring" | yo'q |
| `unreliable` | 81 | `source_error` 55 + `undetermined` 26 (1 ta MUHIM XATO shu ichida) | ha — "baholanmaydi" belgisi | yo'q |
| **Jami** | **1027** | | | |

Hech bir savol olib tashlanmadi.

## 9. Chiqish fayllari (`_private/attestatsiya-fizika/`, gitignored)

| Fayl | Hajm | Mazmun |
|---|---:|---|
| `questions.public.json` | 1.3 MB | 1027 public savol (javobsiz) |
| `questions.private.json` | 1.7 MB | 1027 javob + yechim + manba + review |
| `daily-tests.json` | 50 KB | 32 test meta |
| `firestore-import.json` | 6.5 MB | 2183 Firestore operatsiyasi |
| `validation-report.json` | | 28 gate + kunlar + o'lchamlar |
| `figures-manifest.json` | | 414 rasm: xesh, o'lcham, public/private |
| `rules-test-report.json` | | 105 Rules ssenariysi + dry-run |
| `vendor/katex.min.js` | | validatsiya uchun (MIT) |

Nega `data/attestation-fizika/` emas: repo ichidagi har qanday kuzatiladigan fayl GitHub Pages orqali ommaviy bo'ladi. Public savollar ham draft kunlar uchun yashirin bo'lishi kerak, shuning uchun **barcha** import ma'lumotlari `_private/` da (`.gitignore`). Saytga faqat rasmlar chiqadi.
