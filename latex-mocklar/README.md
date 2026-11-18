# Milliy sertifikat — BMBA shabloni bo‘yicha 10 ta mock test (LaTeX)

- `mock-01 … mock-10` (`.tex` + `.pdf`) — har biri 45 savol: 1–32 oddiy A–D test, 33–35 (bitta masala, 3 qiymat, 6 variant A–F), 36–45 (a va b ochiq javob).
- `kalitlar.tex/.pdf` — barcha javoblar (o‘qituvchi uchun, talabalarga bermang).
- 1–32-savollar `dtm-variantlari/data/baza.json` bankidan olinadi (BMBA taqsimoti: 1–10 Mexanika, 11–15 Molekulyar fizika, 16–25 Elektr va magnetizm, 26–28 Optika, 29–31 Atom va yadro, 32 Mexanika). Mocklar orasida savol takrorlanmaydi; manba id lari `kalitlar` da.
- Bank rasmlari TikZ da qayta chizilgan (`tools/figs.py`); rasmi chizilmagan savollar tanlanmaydi.
- 33–35 — har mockda boshqa masala (`tools/mid_tasks.py`, hammasi Elektr bo‘limidan: ko‘prik, aralash ulanish, kondensatorlar, isitgichlar, ikki manba, galvanometr, kondensatorli zanjir, RLC, dipol, sterjen); 36–45 — `tools/open_pool.py` (har bir raqam uchun 10 xil masala, bo‘limlar BMBA bo‘yicha: 36–38 Mexanika, 39–40 MF, 41–42 Elektr, 43–44 Optika, 45 Atom). Javoblar kodda hisoblanadi.
- Matnda o‘→ö, g‘→ğ, sh→ş, ch→ç.
- `yechimlar/yechim-01 … 10` (`.tex` + `.pdf`) — har bir savol, to‘g‘ri javob va yozma yechim. Manba: `yechimlar/manba/mXX.txt`
  (`@N X` — savol raqami va javob harfi, keyingi qatorlar — yechim; `>>` bilan boshlangan qator — alohida formula).
  Generator javob harflarini kalit bilan solishtiradi. Shu yechimlar saytdagi Mock №16–25 import fayliga ham qo‘shiladi (`export_site.py`).
- Yechimlarni yozishda topilgan bank xatolari `make_mocks.py` dagi `FIXES` da tuzatilgan (T02-19, T16-17, T07-23, Y09-30, Y04-30).

Qayta yig‘ish (XeLaTeX kerak):

    python3 latex-mocklar/tools/make_mocks.py          # .tex + .pdf
    python3 latex-mocklar/tools/make_mocks.py --nopdf  # faqat .tex
    python3 latex-mocklar/tools/make_solutions.py      # yechimlar (.tex + .pdf)

## Olimpiada testi (`olimpiada/`)
`tools/make_olimpiada.py` — fizika olimpiadasi uchun 30 talik test (shablon: 2-betdan boshlab, muqovasiz).
1–17 yopiq (A–D), 18–27 ochiq (javob yoziladi), 28–30 moslashtirish (A–F, kondensatorlar masalasi, javoblar kodda hisoblanadi).
Ballar: 10×0,9 + 10×1,7 + 10×2,4 = 50 (skript tekshiradi). Savollar bazadan, 10 ta mockda ishlatilmaganlar; kalitlar qo‘lda yechib tekshirilgan.
Natija: `olimpiada/olimpiada-01.tex/.pdf` va `olimpiada-01-kalit.tex/.pdf`.
Yechimlar: `olimpiada/manba/olimpiada-01.txt` (@N javob + yechim) → `olimpiada-01-yechim.tex/.pdf` (skript javoblarni kalit bilan solishtiradi).
