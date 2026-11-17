# Milliy sertifikat — BMBA shabloni bo‘yicha 10 ta mock test (LaTeX)

- `mock-01 … mock-10` (`.tex` + `.pdf`) — har biri 45 savol: 1–32 oddiy A–D test, 33–35 (bitta masala, 3 qiymat, 6 variant A–F), 36–45 (a va b ochiq javob).
- `kalitlar.tex/.pdf` — barcha javoblar (o‘qituvchi uchun, talabalarga bermang).
- 1–32-savollar `dtm-variantlari/data/baza.json` bankidan olinadi (BMBA taqsimoti: 1–10 Mexanika, 11–15 Molekulyar fizika, 16–25 Elektr va magnetizm, 26–28 Optika, 29–31 Atom va yadro, 32 Mexanika). Mocklar orasida savol takrorlanmaydi; manba id lari `kalitlar` da.
- Bank rasmlari TikZ da qayta chizilgan (`tools/figs.py`); rasmi chizilmagan savollar tanlanmaydi.
- 33–35 — har mockda boshqa masala (`tools/mid_tasks.py`: ko‘prik, aralash ulanish, kondensatorlar, ip-blok, gorizontal otish, Atvud, p–V sikl, linza, dipol, sterjen); 36–45 — `tools/open_tasks.py`. Javoblar kodda hisoblanadi.
- Matnda o‘→ö, g‘→ğ, sh→ş, ch→ç.

Qayta yig‘ish (XeLaTeX kerak):

    python3 latex-mocklar/tools/make_mocks.py          # .tex + .pdf
    python3 latex-mocklar/tools/make_mocks.py --nopdf  # faqat .tex
