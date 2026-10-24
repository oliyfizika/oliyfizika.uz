# Simulyatsiyalar va virtual laboratoriyalar — ish qoidalari

Bu fayl `simulations/` ustida ishlashda Claude Code uchun asosiy qo‘llanma. Yangi simulyatsiya yoki laboratoriya
yasashdan oldin shu faylni va [`OILALAR.md`](OILALAR.md) (48 oila rejasi va holati) ni o‘qing, so‘ng eng yaqin
mavjud namunani oching va uning tuzilmasidan nusxa oling.

## Ish tartibi (muallif talabi)
1. **Bitta oila — bitta ish.** Oilalar birma-bir yasaladi; muallif ko‘rib tasdiqlamaguncha keyingisiga o‘tilmaydi.
2. Ish oxirida qisqa hisobot: nima qilindi, fizik tekshiruv natijalari, o‘zgargan umumiy fayllar, `git add` ro‘yxati.
3. `OILALAR.md` dagi holat yangilanadi (✅, fayl nomi, sana).
4. Umumiy modul (`labnotebook.js`, `labreport.js`, `sim-kit.js`, `sim-lab.css`) o‘zgarsa — uni ishlatadigan
   oldingi sahifalar ham qayta tekshiriladi.

## Dizayn qoidalari (har bir sahifada majburiy)
- **Ixcham sahna.** Tajriba maydoni katta bo‘lmasin: sahna va (bo‘lsa) grafik bitta ekranga sig‘sin.
  `createStage(..., { height: (cw) => ... })` bilan balandlikni `innerHeight` ga nisbatan cheklang (~0,46·vh, 300–340 px).
- **Parametrlar ustuni alohida aylanadi.** `.sim-panel` keng ekranda sticky va o‘z scroll’iga ega (`sim-lab.css`) —
  pastdagi parametrni o‘zgartirganda sahna ko‘rinishda qoladi. Buni buzmang.
- **Boshqaruv sahnaning o‘zida.** Asosiy o‘zgaruvchilar sahnada sudrab o‘zgartiriladi (jismni, vektor uchini,
  dastakni, detektorni, ekranni surish). Panel slayderlari — qo‘shimcha va sahna bilan sinxron (`bindRange().set()`).
  Pastdagi `of-subtle` izohida qaysi narsani surish mumkinligi yoziladi.
- **Ko‘p funksiyali.** Odatda 2–3 rejim (`.sim-modebar` + `data-mode-value`), har rejimga `data-ctl` guruh,
  8–15 ta «Tayyor tajriba» (preset) guruhlab, `?preset=<id>` URL orqali ochiladi.
- **Grafik faqat kerak bo‘lsa.** Grafik ko‘rinayotgan fizikani tushunishga yordam bersa qo‘shiladi, aks holda
  `data-graph-card hidden` qoladi. Bir nechta grafik — `.sim-graph__tabs` bilan. Grafikda kursor bilan qiymat o‘qish.
- **Vizual va fizik jihatdan to‘g‘ri.** Masshtab, yo‘nalish, ishora, birliklar to‘g‘ri; vektor uchi bilan;
  sxemada masshtab buzilsa (masalan, optikada vertikal) — izohda aytiladi.
- **Readout’lar** (`.sim-readouts--3/--4`, `labkit.readouts`) — eng muhim 3–9 kattalik, birlik bilan.
- **«Nima bo‘lyapti?» va «Formulalar»** kartochkalari (`.sim-explain`) — jonli izoh va asosiy formulalar.
- Yorug‘/qorong‘i rejim (ranglar `readColors()` dan), 390 px mobil ekran, `prefers-reduced-motion`.
- Matn o‘zbekcha, son formati `fmt()` / `sci()` (o‘nlik vergul, `−` belgisi).

## Fayl tuzilmasi
Har simulyatsiya `<nom>`:
- `simulations/<nom>.html` — sahifa (shablon: `photoeffect.html` lab uchun, `fluid.html` oddiy sim uchun).
  `<body class="of-ui of-sim-page" data-shell-title="..." data-shell-public="true">`, CSS: `app.css`, `simulation.css`,
  `sim-lab.css` (+ lab bo‘lsa `lab-notebook.css`), JS: `app-shell.js` + `<nom>.js` (module).
- `assets/js/simulations/<nom>.js` — UI, chizish, sahna bilan ishlash.
- `assets/js/simulations/<nom>-physics.js` — **DOM’siz** fizika (Node’da import qilinadigan sof funksiyalar).
- `<nom>-plots.js` — grafiklar (kerak bo‘lsa).
- Lab bo‘lsa: `<nom>-lab.js` (DOM’siz natijalarni qayta ishlash: `check`, `analyze`, `match`), `<nom>-report.js`
  (hisobot mazmuni → `labreport.js`).

Umumiy yadro:
| Fayl | Vazifasi |
|---|---|
| `sim-kit.js` | `createStage` (DPR, ResizeObserver, tema), `createLoop` (real vaqt dt ≤ 1/30, yashirilsa to‘xtaydi), `arrow`, `angleArc`, `tag`, `bindRange`, `fmt`, `sci`, `drawGraph` |
| `labkit.js` | Asbob chizish: `lcd`, `knob`, `chipBtn`, `chipGrid`, `tagIn`, `readouts`, `noise` (deterministik shovqin) |
| `labnotebook.js` | `createNotebook(root, cfg)` — laboratoriya daftari (cfg sxemasi faylning boshida) |
| `labreport.js` | Bitta hujjat modeli → KaTeX’li A4 HTML (brauzerda PDF) va to‘liq `.tex` (pdfLaTeX) ; `fx`, `sx`, `svgPlot`, `svgQr` |
| `lab-qr.js` | Hisobot uchun QR kod |
| `sim-lab.css` | 2.0 maket: `.sim-head`, `.sim-layout`, `.sim-stage`, `.sim-panel`, `.sim-readouts`, `.sim-explain`, `.sim-bin` |

## Virtual laboratoriya (lab ishi) qoidalari
- Foydalanuvchi asbob bilan **o‘zi o‘lchaydi** (sichqoncha bilan ROI, chizg‘ich, lupa, sekundomer, nonius…),
  qiymatni daftarga yozadi; daftar hisoblaydi va `match()` bilan qurilmadagi haqiqiy qiymatga solishtiradi (✓ / ? va sababi).
- **Natija jadval qiymatidan biroz farq qilishi kerak** — real tajribadagidek tizimli xato (kontakt potensiali, fon,
  apertura, issiqlik yoyilishi…) va statistik xato (Puasson, Broun). Odatda 1–3 % farq; sababi hisobotda tushuntiriladi.
- Daftar: bajaruvchi → jadvallar (kamida bittasi `req: true`) → jonli xulosa kartochkalari → xulosa matni →
  «Ko‘rib chiqish», «PDF», «LaTeX (.tex)». Ma’lumot `localStorage` da (`of-nb-<key>-v1`).
- Hisobot (LaTeX sifatida): maqsad, qisqacha nazariya (raqamlangan formulalar), jihozlar, ish tartibi, jadvallar,
  grafiklar (o‘lchangan nuqtalar + EKK chizig‘i), raqamli hisoblashlar, xulosa, imzolar, sayt havolasi va QR.
  `.tex` pdfLaTeX’da xatosiz kompilyatsiya bo‘lishi shart (yangi Unicode belgisi bo‘lsa `labreport.js` preambulasiga qo‘shing).

## Katalogga qo‘shish
1. `simulations/data/manifest.json` → `simulations[]`: `id`, `title`, `href`, `topic` (`mexanika`, `issiqlik`, `elektr`,
   `optika`, `atom`, `kvant`), `description`, `params`, `keywords`.
2. `assets/js/simulations/simulations-page.js` → `ART` ga 160×90 sxematik SVG (`.a` asosiy, `.b` ikkinchi, `.m` yordamchi, `.f` to‘ldirilgan).
3. Yangi mavzu bo‘lsa — `manifest.topics` va `assets/css/catalog.css` rang qoidalari.
4. Eski manzil o‘zgarsa — eski HTML yo‘naltiruvchi sahifa bo‘lib qoladi (masalan, `ohm-law.html` → `circuit.html?preset=ohm`).

Kelajakdagi reja: barcha oilalar tayyor bo‘lgach katalog sinflar bo‘yicha (7–11-sinf tugmalari, ostida 6 ustunli to‘r).
Bir oila ikki sinf darsligida bo‘lsa — bitta simulyatsiya, sinfga qarab turli preset/sahifa.

## Tekshiruv (har ish oxirida)
- **Fizika:** `<nom>-physics.js` Node’da analitik qiymatlarga solishtiriladi (davr, energiya saqlanishi, chegaraviy
  holatlar, formulalar). Test skriptlarini `tools/simulations/tests/t_<nom>.mjs` ga qo‘ying.
- **Brauzer:** Playwright (o‘rnatilgan): sahifa xatosiz yuklanadi, konsolda xato yo‘q, yorug‘/qorong‘i, 390 px.
  Lab uchun to‘liq zanjir: o‘lchash → daftar → ko‘rib chiqish → PDF/.tex; `.tex` ni pdfLaTeX’da kompilyatsiya qilish.
- Lokal server: repo ildizida `python3 -m http.server 8000` → `http://localhost:8000/simulations/<nom>.html`.
