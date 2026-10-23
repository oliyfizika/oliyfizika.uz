# Real imtihonlar — manual review ro'yxati

Holat: **PENDING_SARVAR_REVIEW**. Hech qanday status, javob yoki baholash siyosati o'zgartirilmagan.
Bitta savol — bitta yozuv (bir nechta muammo bo'lsa ham TOTAL da bir marta sanaladi).

> Bu fayl ommaviy repo uchun: savol matni, javoblar va yechimlar **kiritilmagan**.
> To'liq ma'lumot (savol, variantlar, joriy javob va yechim): `_private/real-imtihonlar/audit/manual-review-questions.json`
> va `_private/real-imtihonlar/audit/manual-review-questions.full.md` (gitignored).

## Jami

- Savollar: **83**
- Ustuvorlik: HIGH 7 · MEDIUM 23 · LOW 53
- Imtihon darajasidagi yozuvlar: 7 (alohida, TOTAL ga kirmaydi)

| Kategoriya | Savollar |
|---|---:|
| open_answer_normalization | 43 |
| figure_issue | 8 |
| source_key_mismatch | 7 |
| questionable_source_option | 5 |
| ambiguous_finalized | 5 |
| questionable_unit | 5 |
| answer_solution_mismatch | 5 |
| no_correct_option | 3 |
| needs_manual_review | 3 |
| source_inconsistency | 3 |
| assumption_stated | 3 |
| questionable_transcription | 2 |
| sign_convention | 1 |

## Imtihon darajasida

| examId | Kategoriya | Ustuvorlik | Muammo | Status |
|---|---|---|---|---|
| REAL-2026-09-30-B | secondary_source | HIGH | PDF ning o'zida 'Shartlar qayta bayon qilingan, chizma va grafiklar qaytadan chizilgan' — asl imtihon matni emas (officialSource=false). | PENDING_SARVAR_REVIEW |
| REAL-2026-09-29-1 | source_label | LOW | Sarlavha 'Fizika ORG' (tuzuvchi Xolmirza Fizika). | PENDING_SARVAR_REVIEW |
| REAL-2026-09-29-2 | source_label | LOW | Sarlavha 'Fizika ORG'. | PENDING_SARVAR_REVIEW |
| REAL-2026-09-30-A | source_label | LOW | Sarlavha 'Fizika ORG'. | PENDING_SARVAR_REVIEW |
| REAL-2025-05-13-1 | date_warning | LOW | Muqovada 22.02.2025, savollar sahifasida 13.05.2025. | PENDING_SARVAR_REVIEW |
| REAL-2025-05-13-2 | date_warning | LOW | Muqovada 22.02.2025, savollar sahifasida 13.05.2025. | PENDING_SARVAR_REVIEW |
| REAL-2025-11-30 | date_warning | LOW | Fayl nomi 'Fevral 2025', sana 30.11.2025. | PENDING_SARVAR_REVIEW |

## Savollar

| reviewId | Imtihon | № | Tur | Ustuvorlik | Kategoriya | Muammo | Nimani tekshirish | Status |
|---|---|---:|---|---|---|---|---|---|
| RE-REVIEW-001 | 01.12.2024 | 14 | mc | HIGH | no_correct_option | Manba variantlarining birortasi to'g'ri emas. | Siyosat (EXCLUDE / HAMMAGA_BALL / boshqa). | PENDING_SARVAR_REVIEW |
| RE-REVIEW-002 | 22.02.2025 | 39 | open | HIGH | needs_manual_review | Yakuniy javob yo'q (NEEDS_MANUAL_REVIEW). | Yakuniy javob yoki siyosat (FINAL / EXCLUDE / HAMMAGA_BALL). | PENDING_SARVAR_REVIEW |
| RE-REVIEW-003 | 13.05.2025 — 2-smena | 36 | open | HIGH | needs_manual_review | Yakuniy javob yo'q (NEEDS_MANUAL_REVIEW). | Yakuniy javob yoki siyosat (FINAL / EXCLUDE / HAMMAGA_BALL). | PENDING_SARVAR_REVIEW |
| RE-REVIEW-004 | 18.01.2026 | 43 | open | HIGH | needs_manual_review | Yakuniy javob yo'q (NEEDS_MANUAL_REVIEW). | Yakuniy javob yoki siyosat (FINAL / EXCLUDE / HAMMAGA_BALL). | PENDING_SARVAR_REVIEW |
| RE-REVIEW-005 | 06.04.2026 — 2-smena | 3 | mc | HIGH | no_correct_option | Manba variantlarining birortasi to'g'ri emas. | Siyosat (EXCLUDE / HAMMAGA_BALL / boshqa). | PENDING_SARVAR_REVIEW |
| RE-REVIEW-006 | 06.04.2026 — 2-smena | 18 | mc | HIGH | no_correct_option | Manba variantlarining birortasi to'g'ri emas. | Siyosat (EXCLUDE / HAMMAGA_BALL / boshqa). | PENDING_SARVAR_REVIEW |
| RE-REVIEW-007 | 06.04.2026 — 2-smena | 23 | mc | HIGH | questionable_source_option | Manbadagi variant(lar) shubhali (bo'sh / takror / harf xato). | Savolni testga kiritish usuli. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-008 | 01.12.2024 | 25 | mc | MEDIUM | ambiguous_finalized | Audit AMBIGUOUS holatni finalizatsiya qilgan. | Yakuniy javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-009 | 22.02.2025 | 3 | mc | MEDIUM | questionable_source_option | Manbadagi variant(lar) shubhali (bo'sh / takror / harf xato). | Savolni testga kiritish usuli. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-010 | 22.02.2025 | 5 | mc | MEDIUM | source_key_mismatch | Manba kaliti audit natijasidan farq qiladi. | Audit javobini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-011 | 22.02.2025 | 7 | mc | MEDIUM | questionable_unit | Birlik shubhali yoki berilmagan. | Birlik/javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-012 | 22.02.2025 | 13 | mc | MEDIUM | questionable_unit | Birlik shubhali yoki berilmagan. | Birlik/javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-013 | 22.02.2025 | 42 | open | MEDIUM | open_answer_normalization, source_key_mismatch | Ochiq javob avtomatik baholash uchun normallashtirilmagan. · Manba kaliti audit natijasidan farq qiladi. | PHASE H: qiymat / birlik / tolerans. · Audit javobini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-014 | 30.11.2025 | 10 | mc | MEDIUM | source_inconsistency | Manba matnida ichki ziddiyat. | Talqinni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-015 | 18.01.2026 | 1 | mc | MEDIUM | assumption_stated | Yechim 'Qabul qilingan faraz' bilan. | Farazni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-016 | 18.01.2026 | 23 | mc | MEDIUM | answer_solution_mismatch | Hisob natijasi va tanlangan variant orasida yaxlitlash farqi. | Variant tanlovini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-017 | 06.04.2026 — 1-smena | 2 | mc | MEDIUM | assumption_stated | Yechim 'Qabul qilingan faraz' bilan. | Farazni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-018 | 06.04.2026 — 1-smena | 17 | mc | MEDIUM | questionable_source_option | Manbadagi variant(lar) shubhali (bo'sh / takror / harf xato). | Savolni testga kiritish usuli. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-019 | 06.04.2026 — 1-smena | 22 | mc | MEDIUM | questionable_source_option | Manbadagi variant(lar) shubhali (bo'sh / takror / harf xato). | Savolni testga kiritish usuli. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-020 | 06.04.2026 — 1-smena | 40 | open | MEDIUM | ambiguous_finalized, open_answer_normalization | Audit AMBIGUOUS holatni finalizatsiya qilgan. · Ochiq javob avtomatik baholash uchun normallashtirilmagan. | Yakuniy javobni tasdiqlash. · PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-021 | 06.04.2026 — 2-smena | 10 | mc | MEDIUM | ambiguous_finalized | Audit AMBIGUOUS holatni finalizatsiya qilgan. | Yakuniy javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-022 | 06.04.2026 — 2-smena | 11 | mc | MEDIUM | questionable_unit | Birlik shubhali yoki berilmagan. | Birlik/javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-023 | 06.04.2026 — 2-smena | 44 | open | MEDIUM | assumption_stated | Yechim 'Qabul qilingan faraz' bilan. | Farazni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-024 | 29.09.2026 — 1-smena | 2 | mc | MEDIUM | ambiguous_finalized | Audit AMBIGUOUS holatni finalizatsiya qilgan. | Yakuniy javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-025 | 29.09.2026 — 1-smena | 39 | open | MEDIUM | ambiguous_finalized, open_answer_normalization | Audit AMBIGUOUS holatni finalizatsiya qilgan. · Ochiq javob avtomatik baholash uchun normallashtirilmagan. | Yakuniy javobni tasdiqlash. · PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-026 | 30.09.2026 — Variant A | 11 | mc | MEDIUM | source_key_mismatch | Manba kaliti audit natijasidan farq qiladi. | Audit javobini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-027 | 30.09.2026 — Variant A | 16 | mc | MEDIUM | source_key_mismatch | Manba kaliti audit natijasidan farq qiladi. | Audit javobini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-028 | 30.09.2026 — Variant A | 18 | mc | MEDIUM | source_key_mismatch | Manba kaliti audit natijasidan farq qiladi. | Audit javobini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-029 | 30.09.2026 — Variant A | 25 | mc | MEDIUM | source_key_mismatch | Manba kaliti audit natijasidan farq qiladi. | Audit javobini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-030 | 30.09.2026 — Variant A | 27 | mc | MEDIUM | source_key_mismatch | Manba kaliti audit natijasidan farq qiladi. | Audit javobini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-031 | 01.12.2024 | 2 | mc | LOW | figure_issue | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). | O'qilishini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-032 | 01.12.2024 | 38 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-033 | 01.12.2024 | 39 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-034 | 01.12.2024 | 40 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-035 | 01.12.2024 | 41 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-036 | 01.12.2024 | 42 | open | LOW | figure_issue, open_answer_normalization | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). · Ochiq javob avtomatik baholash uchun normallashtirilmagan. | O'qilishini tasdiqlash. · PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-037 | 01.12.2024 | 43 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-038 | 01.12.2024 | 44 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-039 | 22.02.2025 | 38 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-040 | 22.02.2025 | 41 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-041 | 22.02.2025 | 43 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-042 | 13.05.2025 — 1-smena | 4 | mc | LOW | questionable_unit | Birlik shubhali yoki berilmagan. | Birlik/javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-043 | 13.05.2025 — 1-smena | 11 | mc | LOW | questionable_unit | Birlik shubhali yoki berilmagan. | Birlik/javobni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-044 | 13.05.2025 — 1-smena | 16 | mc | LOW | answer_solution_mismatch | Hisob natijasi va tanlangan variant orasida yaxlitlash farqi. | Variant tanlovini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-045 | 13.05.2025 — 1-smena | 37 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-046 | 13.05.2025 — 1-smena | 39 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-047 | 13.05.2025 — 1-smena | 41 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-048 | 13.05.2025 — 1-smena | 43 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-049 | 13.05.2025 — 1-smena | 44 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-050 | 13.05.2025 — 1-smena | 45 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-051 | 13.05.2025 — 2-smena | 39 | open | LOW | figure_issue | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). | O'qilishini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-052 | 13.05.2025 — 2-smena | 40 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-053 | 13.05.2025 — 2-smena | 43 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-054 | 13.05.2025 — 2-smena | 44 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-055 | 13.05.2025 — 2-smena | 45 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-056 | 30.11.2025 | 4 | mc | LOW | figure_issue | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). | O'qilishini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-057 | 30.11.2025 | 6 | mc | LOW | figure_issue | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). | O'qilishini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-058 | 30.11.2025 | 22 | mc | LOW | figure_issue | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). | O'qilishini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-059 | 30.11.2025 | 30 | mc | LOW | answer_solution_mismatch | Hisob natijasi va tanlangan variant orasida yaxlitlash farqi. | Variant tanlovini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-060 | 30.11.2025 | 37 | open | LOW | figure_issue | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). | O'qilishini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-061 | 30.11.2025 | 39 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-062 | 30.11.2025 | 40 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-063 | 30.11.2025 | 41 | open | LOW | open_answer_normalization, sign_convention | Ochiq javob avtomatik baholash uchun normallashtirilmagan. · Javob ishora konvensiyasiga bog'liq. | PHASE H: qiymat / birlik / tolerans. · Qabul qilinadigan ishorani belgilash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-064 | 30.11.2025 | 42 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-065 | 30.11.2025 | 44 | open | LOW | open_answer_normalization, source_inconsistency | Ochiq javob avtomatik baholash uchun normallashtirilmagan. · Manba matnida ichki ziddiyat. | PHASE H: qiymat / birlik / tolerans. · Talqinni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-066 | 18.01.2026 | 41 | open | LOW | open_answer_normalization, source_inconsistency | Ochiq javob avtomatik baholash uchun normallashtirilmagan. · Manba matnida ichki ziddiyat. | PHASE H: qiymat / birlik / tolerans. · Talqinni tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-067 | 18.01.2026 | 42 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-068 | 18.01.2026 | 44 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-069 | 06.04.2026 — 1-smena | 19 | mc | LOW | answer_solution_mismatch | Hisob natijasi va tanlangan variant orasida yaxlitlash farqi. | Variant tanlovini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-070 | 06.04.2026 — 1-smena | 36 | open | LOW | figure_issue, open_answer_normalization | Chizma bo'yicha eslatma (watermark / ma'lumot faqat chizmada). · Ochiq javob avtomatik baholash uchun normallashtirilmagan. | O'qilishini tasdiqlash. · PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-071 | 06.04.2026 — 1-smena | 39 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-072 | 06.04.2026 — 1-smena | 45 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-073 | 06.04.2026 — 2-smena | 20 | mc | LOW | answer_solution_mismatch | Hisob natijasi va tanlangan variant orasida yaxlitlash farqi. | Variant tanlovini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-074 | 06.04.2026 — 2-smena | 33 | match | LOW | questionable_source_option | Manbadagi variant(lar) shubhali (bo'sh / takror / harf xato). | Savolni testga kiritish usuli. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-075 | 06.04.2026 — 2-smena | 39 | open | LOW | open_answer_normalization, questionable_transcription | Ochiq javob avtomatik baholash uchun normallashtirilmagan. · Transkripsiya yoki belgi bo'yicha eslatma. | PHASE H: qiymat / birlik / tolerans. · Muammo emasligini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-076 | 06.04.2026 — 2-smena | 40 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-077 | 06.04.2026 — 2-smena | 41 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-078 | 29.09.2026 — 1-smena | 45 | open | LOW | open_answer_normalization, questionable_transcription | Ochiq javob avtomatik baholash uchun normallashtirilmagan. · Transkripsiya yoki belgi bo'yicha eslatma. | PHASE H: qiymat / birlik / tolerans. · Muammo emasligini tasdiqlash. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-079 | 30.09.2026 — Variant A | 42 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-080 | 30.09.2026 — Variant A | 44 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-081 | 30.09.2026 — Variant B | 41 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-082 | 30.09.2026 — Variant B | 42 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
| RE-REVIEW-083 | 30.09.2026 — Variant B | 44 | open | LOW | open_answer_normalization | Ochiq javob avtomatik baholash uchun normallashtirilmagan. | PHASE H: qiymat / birlik / tolerans. | PENDING_SARVAR_REVIEW |
