# PHASE 6C — ochiq qolgan javob qarorlari (ommaviy xulosa)

Savol matnlari va javoblar bu faylda yo'q; to'liq: `_private/real-imtihonlar/audit/phase6c-decision-review.{json,md}`.

Dataset, V2 draft, savol/yechim matni va engine o'zgartirilmagan.

| Guruh | Qismlar | Holat |
|---|---:|---|
| A_PENDING_HIGH_REVIEW | 5 | 5 — tavsiya bor, HIGH qarori Sarvarda |
| B_NEEDS_MANUAL_REVIEW | 11 | 11 — 2 tasi qaror bilan tayyor bo'ladi (18.01 #40b, 30.11 #41b), 9 tasi UI/format |
| C_PENDING_UI_UNIT_LABEL | 20 | 20 — bitta umumiy UI birlik qarori bilan tayyor bo'ladi |

Bu bosqichda hal qilingan: 0 (hammasi Sarvar qarorini kutadi).

## Qaror kerak bo'lgan masalalar

1. HIGH 002 (22.02 #39a/b)
2. HIGH 003 (13.05-2 #36a)
3. HIGH 004 (18.01 #43a/b)
4. 18.01 #40b
5. 30.11 #41b
6. 'Marta kamaygan' (2 qism)
7. Formula javoblar (7 qism)
8. UI birlik siyosati (20 qism)

## V2 va engine

- V2 o'zgarishi: hozir yo'q; qarorlardan keyin V3 (3 band).
- Engine dizayniga tayyorlik: TAYYOR (dizayn uchun): talablar aniq — MULTI_VALUE (51), HYBRID son+matn (22), UI birlik belgisi (20+8), son+yo'nalish maydoni (2), baholanmaydigan formula turi (7). Implementatsiya uchun — Sarvar qarorlari va V3 kerak.
