# 36–45 ochiq javoblar — tolerans taklifi (ommaviy xulosa)

Holat: **PROPOSAL_PENDING_SARVAR**. Javoblar bu faylda yo'q; to'liq jadval: `_private/real-imtihonlar/audit/open-answer-tolerance-proposal.{json,md}`.

## Asos

- Default nisbiy tolerans TAKLIFI: 1 % (|kiritilgan − kalit| ≤ 0,01·|kalit|).
- Asos: javoblar 2–3 qiymatli raqam bilan berilgan; standart doimiylarning keng tarqalgan yozilishi (h = 6,6 / 6,63; e = 1,6 / 1,602; R = 8,31 / 8,314; c = 3·10⁸) natijani ≲ 0,5 % o'zgartiradi — 1 % ularni qabul qiladi.
- 1 % qo'pol xatoni (masalan, birlik/daraja xatosi, noto'g'ri formula) rad etadi.
- 1 % QOPLAMAYDI: g = 9,8 va 10 farqi (≈2 %), π ≈ 3 va 3,14 farqi (≈4,5 %), yaxlitlangan kalit — bular alohida istisno.
- Birliksiz butun sonlar (soni, tartibi, nisbat) uchun aniq moslik taklif qilinadi; javob 0 bo'lsa nisbiy tolerans ishlamaydi — absolyut qoida kerak.
- g: 12 imtihondan faqat 30.09-B da umumiy ko'rsatma bor (g = 10 m/s²); boshqalarida savol matnida g deyarli berilmagan. Shu sabab G_NOT_IN_QUESTION istisnolarini yagona siyosat bilan hal qilish taklif qilinadi (masalan: g = 10 konvensiyasi yoki ikkala qiymatni qabul qilish).
- Past ko'rsatilgan aniqlik (yarim qadam > 1 %) istisno emas, faqat ma'lumot: audit yaxlitlangan qiymatlarni ≈ bilan yozgan, SIMPLE toifasida ≈ yo'q.
- Hech bir qiymat dataset'ga yozilmagan; har biri Sarvar tasdig'idan keyin.

- SIMPLE_NUMERIC: 146 (istisnosiz 101, istisnoli 45)
- Istisno yozuvlari: 161 (139 qism)

| Istisno turi | Soni |
|---|---:|
| G_NOT_IN_QUESTION | 35 |
| APPROX_ANSWER | 30 |
| UNIT_NOT_ASKED_30_09_B | 19 |
| NON_NUMERIC | 19 |
| NUMERIC_WITH_QUALIFIER | 12 |
| INTEGER_EXACT | 10 |
| PI_APPROX_3 | 7 |
| TABLE_CONSTANT | 6 |
| BLOCKED_NO_FINAL_ANSWER | 5 |
| EXACT_FORM_GIVEN | 5 |
| AUDIT_NOTE_STATUS | 3 |
| UNIT_NOT_ASKED | 2 |
| SCALED_UNIT | 2 |
| NEGATIVE_VALUE | 2 |
| ZERO_VALUE | 2 |
| UNIT_MISMATCH | 1 |
| SOURCE_KEY_DIFFERS | 1 |
