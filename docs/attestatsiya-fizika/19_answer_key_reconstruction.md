# 19 — Answer key tiklash (62 savol)

Faqat **B** kategoriya: manbada variant va kalit yo‘q, yechim natijasi bir qiymatli. Har biriga A–D variant: to‘g‘ri javob + 3 distraktor, har distraktorning fizik sababi bor (tipik hisob xatosi yoki konseptual xato). Tasodifiy son yo‘q, boshqa savoldan ko‘chirma yo‘q.
Tuzatishlar **canonical LaTeX**'ga yozildi (`chapters/*.tex` — variantlar va `% Answer: X (reconstructed)`; `.sol` — `result`, `keySource`, `keyValue` (asl natija), `\javob{X) …}`; `answers.tex`), so‘ng `latex_canonical.py sync` → `problems.json`.
**To‘g‘ri javoblar va distraktorlar bu faylda yo‘q.** To‘liq: `_private/attestatsiya-fizika/reports/reconstruction_full.md`.

## Avtomatik tekshiruvlar (`answer_keys.py validate`, prepare gate'lari)

- 4 ta noyob variant; birliklar bir xil; to‘g‘ri variant yechim natijasiga teng (±1 %); raqamli variantlar o‘zaro ≥3 % farq;
- oraliqli javobda (AF-1-068) faqat bitta variant oraliqqa tushadi; boshqa savol variantlari bilan aynan mos to‘plam yo‘q;
- yechimda «variantlar berilmagan» kabi eskirgan iboralar qolmagan; har distraktor uchun sabab yozilgan;
- `medium` ishonchli savollarda faraz yozilgan; bundle'da `correctAnswer` = qaror harfi, variantlar = qaror tartibi (62/62).

## Ro‘yxat

| ID | Kun | Yechim holati | Ishonch | Faraz |
|---|---|---|---|---|
| AF-1-005 | 1 | full | high | — |
| AF-1-009 | 1 | full | high | — |
| AF-1-010 | 1 | full | high | — |
| AF-1-014 | 1 | full | high | — |
| AF-1-024 | 1 | full | high | — |
| AF-1-025 | 1 | full | high | — |
| AF-1-026 | 1 | full | high | — |
| AF-1-031 | 1 | full | high | — |
| AF-1-036 | 2 | full | high | — |
| AF-1-068 | 3 | full | high | — |
| AF-1-069 | 3 | full | high | — |
| AF-1-073 | 3 | full | high | — |
| AF-1-101 | 4 | full | high | — |
| AF-1-115 | 4 | full | medium | bor |
| AF-1-134 | 5 | full | high | — |
| AF-1-176 | 6 | full | high | — |
| AF-1-181 | 6 | theory | high | — |
| AF-1-193 | 6 | full | high | bor |
| AF-1-229 | 7 | full | high | — |
| AF-1-237 | 8 | full | high | — |
| AF-1-249 | 8 | full | high | bor |
| AF-1-250 | 8 | full | high | — |
| AF-2-003 | 9 | full | high | — |
| AF-2-006 | 9 | full | high | — |
| AF-2-019 | 9 | full | high | — |
| AF-2-025 | 9 | full | medium | bor |
| AF-2-046 | 10 | full | high | — |
| AF-2-048 | 10 | full | high | — |
| AF-2-075 | 10 | theory | high | — |
| AF-2-078 | 11 | theory | high | — |
| AF-2-080 | 11 | theory | high | — |
| AF-2-082 | 11 | theory | high | — |
| AF-2-099 | 11 | full | high | — |
| AF-2-100 | 11 | full | high | bor |
| AF-3-003 | 12 | theory | high | — |
| AF-3-007 | 12 | full | high | — |
| AF-3-011 | 12 | full | high | — |
| AF-3-025 | 12 | full | high | — |
| AF-3-040 | 13 | full | high | — |
| AF-3-041 | 13 | full | high | — |
| AF-3-066 | 14 | theory | high | — |
| AF-3-074 | 14 | full | high | — |
| AF-3-079 | 14 | full | high | — |
| AF-3-133 | 16 | theory | high | — |
| AF-3-144 | 16 | full | high | — |
| AF-3-244 | 19 | full | high | — |
| AF-3-268 | 20 | full | high | — |
| AF-4-018 | 21 | theory | high | — |
| AF-4-040 | 22 | theory | high | — |
| AF-4-062 | 22 | full | high | — |
| AF-5-008 | 24 | full | high | — |
| AF-5-024 | 24 | full | high | — |
| AF-5-060 | 26 | theory | high | — |
| AF-5-067 | 26 | theory | high | — |
| AF-5-068 | 26 | full | high | — |
| AF-5-104 | 27 | theory | high | — |
| AF-6-008 | 28 | full | high | — |
| AF-6-043 | 29 | full | high | — |
| AF-6-044 | 29 | theory | high | — |
| AF-6-045 | 29 | theory | high | — |
| AF-6-050 | 29 | theory | high | — |
| AF-6-053 | 29 | theory | high | — |

Kunlar bo‘yicha: Day 1: 8, Day 2: 1, Day 3: 3, Day 4: 2, Day 5: 1, Day 6: 3, Day 7: 1, Day 8: 3, Day 9: 4, Day 10: 3, Day 11: 5, Day 12: 4, Day 13: 2, Day 14: 3, Day 16: 2, Day 19: 1, Day 20: 1, Day 21: 1, Day 22: 2, Day 24: 2, Day 26: 3, Day 27: 1, Day 28: 1, Day 29: 5.
Day 1 (published) dagi 8 ta savol canonical manbada tuzatildi, lekin production'dagi Day 1 v1 snapshot'i o‘zgartirilmaydi (21-hisobot).
