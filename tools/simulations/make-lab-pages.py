#!/usr/bin/env python3
"""Maktab virtual laboratoriyalari sahifalarini (simulations/lab-*.html) yaratadi.

Sahifa faqat sarlavha va <div data-lab-body> dan iborat — qolgan qismini assets/js/simulations/lab-core.js quradi.
Yangi lab qo‘shish: LABS ro‘yxatiga yozuv qo‘shing va `python3 tools/simulations/make-lab-pages.py` ni ishga tushiring.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# (fayl, js modul, sinf yorlig‘i, badge rangi, sarlavha (h1), qisqa nom (shell), formula (sarlavha yonida), meta tavsif)
LABS = [
    ("lab-ortacha-tezlik", "lab-speed", "7-sinf", "blue", "Notekis harakatning o‘rtacha tezligi", "O‘rtacha tezlik", "v = s / t",
     "Virtual laboratoriya ishi (7-sinf): qiya novdan dumalayotgan sharcha, fotodatchiklar va elektron sekundomer. Yo‘l va vaqtni o‘lchab, yo‘l bo‘laklaridagi va butun yo‘ldagi o‘rtacha tezlikni hisoblang."),
    ("lab-zichlik", "lab-density", "7-sinf", "blue", "Jismlarning zichligini aniqlash", "Zichlikni aniqlash", "ρ = m / V",
     "Virtual laboratoriya ishi (7-sinf): richagli tarozi va toshlar bilan massani, menzurka bilan hajmni o‘lchab, jism zichligini va moddasini aniqlang."),
    ("lab-om-qonuni", "lab-om", "7–8-sinf", "green", "Tok kuchi va kuchlanishni o‘lchash. Om qonuni", "Om qonuni", "I = U / R",
     "Virtual laboratoriya ishi (7–8-sinf): zanjir yig‘ish, ampermetr va voltmetr bilan tok kuchi va kuchlanishni o‘lchash, I(U) grafigi, qarshilikni aniqlash va Om qonunini tekshirish."),
    ("lab-ketma-ket-parallel", "lab-series", "8-sinf", "green", "O‘tkazgichlarni ketma-ket va parallel ulash", "Ketma-ket va parallel ulash", "R = R₁ + R₂",
     "Virtual laboratoriya ishi (8-sinf): ikki rezistorni ketma-ket va parallel ulab, tok kuchi va kuchlanishlarni o‘lchang, umumiy qarshilik formulalarini tekshiring."),
    ("lab-lampochka-quvvati", "lab-lamp", "8-sinf", "green", "Lampochka quvvatini aniqlash", "Lampochka quvvati", "P = U·I",
     "Virtual laboratoriya ishi (8-sinf): cho‘g‘lanma lampochkadagi kuchlanish va tok kuchini o‘lchab, quvvat va qarshilikni hisoblang, nominal quvvat bilan solishtiring."),
    ("lab-issiqlik-sigimi", "lab-heat", "9-sinf", "orange", "Issiqlik miqdorlarini taqqoslash. Solishtirma issiqlik sig‘imi", "Solishtirma issiqlik sig‘imi", "Q = cmΔt",
     "Virtual laboratoriya ishi (9-sinf): kalorimetrda issiq va sovuq suvni aralashtirib issiqlik balansini tekshiring, qizdirilgan metall silindr bilan moddaning solishtirma issiqlik sig‘imini aniqlang."),
    ("lab-sirt-taranglik", "lab-surface", "9-sinf", "orange", "Suyuqlikning sirt taranglik koeffitsiyentini aniqlash", "Sirt taranglik", "σ = mg / (πdN)",
     "Virtual laboratoriya ishi (9-sinf): tomchilar usuli — byuretkadan tomgan tomchilarni sanab, massasini tarozida o‘lchab, sirt taranglik koeffitsiyentini toping."),
    ("lab-namlik", "lab-humidity", "9-sinf", "orange", "Havoning nisbiy namligini aniqlash", "Havo namligi", "φ = p / p₀ · 100 %",
     "Virtual laboratoriya ishi (9-sinf): psixrometr (quruq va ho‘l termometr) va psixrometrik jadval bilan, shudring nuqtasi usulida havoning nisbiy namligini aniqlang."),
    ("lab-sindirish", "lab-refraction", "9-sinf", "purple", "Shishaning sindirish ko‘rsatkichini aniqlash", "Sindirish ko‘rsatkichi", "n = sin α / sin β",
     "Virtual laboratoriya ishi (9-sinf): shisha plastinkaga tushgan nur, transportir bilan tushish va sinish burchaklarini o‘lchab, shishaning sindirish ko‘rsatkichini aniqlang."),
    ("lab-linza", "lab-lens", "9-sinf", "purple", "Yig‘uvchi linzaning fokus masofasi va optik kuchi", "Linzaning optik kuchi", "1/F = 1/d + 1/f",
     "Virtual laboratoriya ishi (9-sinf): optik skamyada buyum, linza va ekran — aniq tasvir hosil qilib d va f ni o‘lchang, fokus masofasi va optik kuchni hisoblang."),
    ("lab-qiya-tekislik", "lab-incline", "10-sinf", "blue", "Qiya tekislikning foydali ish koeffitsiyenti", "Qiya tekislik FIKi", "η = Ph / (Fl)",
     "Virtual laboratoriya ishi (10-sinf): dinamometr bilan brusokni qiya tekislik bo‘ylab tekis tortib, foydali va to‘liq ishni hisoblang, FIKning qiyalikka bog‘liqligini o‘rganing."),
    ("lab-mayatnik", "lab-pendulum", "10-sinf", "blue", "Matematik mayatnik yordamida erkin tushish tezlanishini aniqlash", "Mayatnik bilan g", "T = 2π√(l/g)",
     "Virtual laboratoriya ishi (10-sinf): ip uzunligini o‘zgartirib, sekundomer bilan N ta tebranish vaqtini o‘lchang; T²(l) grafigidan erkin tushish tezlanishi g ni toping."),
    ("lab-eyuk", "lab-emf", "10-sinf", "green", "Tok manbaining EYuK va ichki qarshiligini aniqlash", "EYuK va ichki qarshilik", "U = ε − Ir",
     "Virtual laboratoriya ishi (10-sinf): reostat bilan tok kuchini o‘zgartirib, manba qisqichlaridagi kuchlanishni o‘lchang; U(I) grafigidan EYuK va ichki qarshilikni toping."),
    ("lab-diod", "lab-diode", "10-sinf", "green", "Yarimo‘tkazgichli diodning volt-amper xarakteristikasi", "Diod VAXi", "I = f(U)",
     "Virtual laboratoriya ishi (10-sinf): diodni to‘g‘ri va teskari yo‘nalishda ulab, volt-amper xarakteristikasini o‘lchang, ochilish kuchlanishi va dinamik qarshilikni toping."),
    ("lab-rezonans", "lab-resonance", "11-sinf", "green", "O‘zgaruvchan tok zanjirida rezonans", "AC zanjirda rezonans", "ν₀ = 1 / (2π√(LC))",
     "Virtual laboratoriya ishi (11-sinf): ketma-ket RLC zanjirda generator chastotasini o‘zgartirib tok kuchini o‘lchang, rezonans chastotasini toping va g‘altak induktivligini hisoblang."),
    ("lab-difraksion-panjara", "lab-grating", "11-sinf", "purple", "Difraksion panjara yordamida yorug‘lik to‘lqin uzunligini aniqlash", "Difraksion panjara", "d sin φ = kλ",
     "Virtual laboratoriya ishi (11-sinf): lazer va difraksion panjara, ekrandagi maksimumlar orasidagi masofani o‘lchab, yorug‘lik to‘lqin uzunligini aniqlang."),
    ("lab-yoritilganlik", "lab-illuminance", "11-sinf", "purple", "Yoritilganlikning masofaga va tushish burchagiga bog‘liqligi", "Yoritilganlik", "E = I cos α / r²",
     "Virtual laboratoriya ishi (11-sinf): optik skamyada lampa va lyuksmetr — yoritilganlikni masofa va burchakka qarab o‘lchang, lampaning yorug‘lik kuchini toping."),
]

TPL = """<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{h1} — virtual laboratoriya | OliyFizika.uz</title>
<meta name="description" content="{desc}">
<script src="../assets/js/core/theme-boot.js"></script>
<link rel="stylesheet" href="../assets/css/app.css">
<link rel="stylesheet" href="../assets/css/simulation.css">
<link rel="stylesheet" href="../assets/css/sim-lab.css">
<link rel="stylesheet" href="../assets/css/lab-notebook.css">
<script type="module" src="../assets/js/shell/app-shell.js"></script>
<script type="module" src="../assets/js/simulations/{js}.js"></script>
</head>
<!-- Sahifa tools/simulations/make-lab-pages.py bilan yaratilgan. Tana (sahna, panel, qaydlar, daftar) — lab-core.js. -->
<body class="of-ui of-sim-page" data-shell-title="{short}" data-shell-public="true">

<div class="of-page of-container sim-page sim-page--compact">

  <a class="of-sim-back" href="labs.html"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 18-6-6 6-6"/></svg>Virtual laboratoriyalarga qaytish</a>

  <header class="sim-head sim-head--compact">
    <div class="sim-head__text">
      <span class="of-badge of-badge--{badge}">{grade} · Laboratoriya ishi</span>
      <h1>{h1}</h1>
    </div>
    <div class="sim-formula">{formula}</div>
  </header>

  <div data-lab-body></div>
</div>

</body>
</html>
"""

if __name__ == "__main__":
    for f, js, grade, badge, h1, short, formula, desc in LABS:
        html = TPL.format(h1=h1, desc=desc, js=js, short=short, badge=badge, grade=grade, formula=formula)
        (ROOT / "simulations" / f"{f}.html").write_text(html, encoding="utf-8")
        print("✓", f)
