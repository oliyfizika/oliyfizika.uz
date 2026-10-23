# 36–45 ochiq javoblar — kalit spetsifikatsiyasi (ommaviy xulosa)

Holat: **DRAFT_PENDING_SARVAR**. Javoblar bu faylda yo'q; to'liq: `_private/real-imtihonlar/audit/answer-key-spec.draft.{json,md}`.

## Siyosat (Sarvar, 08.10.2026)

- **SIMPLE_NUMERIC**: default relative tolerance = ±1%
- **G_VALUE_VARIANT**: g = 9.8 and g = 10 are both accepted when the problem does not specify g
- **INTEGER_EXACT**: exact normalized integer match
- **ZERO_VALUE**: absolute tolerance = 1e-9
- **NEGATIVE_VALUE**: sign is mandatory
- **UNIT_MISMATCH**: equivalent unit conversion is accepted
- **EXACT_FORM_GIVEN**: exact symbolic form OR numerically equivalent value
- **PI_APPROX_3**: accept answers derived using π≈3 and standard π, subject to the corresponding calculated result
- **TABLE_CONSTANT**: accept results corresponding to the explicitly applicable table constant(s)
- **SOURCE_KEY_DIFFERS**: audited final answer takes precedence over source answer key
- **BLOCKED**: remains PENDING until HIGH review is resolved
- **UNIT_NOT_ASKED_30_09_B**: remains PENDING until input-unit policy is decided
- **NON_NUMERIC_QUALIFIER**: group-specific normalization; unsafe cases remain manual review

## Holatlar

| Holat | Soni |
|---|---:|
| KEY_SPEC_READY | 186 |
| NEEDS_MANUAL_REVIEW | 11 |
| PENDING_HIGH_REVIEW | 5 |
| PENDING_INPUT_UNIT_POLICY | 19 |
| PENDING_NO_POLICY | 19 |

## Qo'llangan siyosatlar

| Siyosat | Qismlar |
|---|---:|
| BLOCKED | 5 |
| EXACT_FORM_GIVEN | 7 |
| G_VALUE_VARIANT | 49 |
| INTEGER_EXACT | 10 |
| NEGATIVE_VALUE | 2 |
| NON_NUMERIC_QUALIFIER | 30 |
| PI_APPROX_3 | 8 |
| SOURCE_KEY_DIFFERS | 1 |
| TABLE_CONSTANT | 10 |
| UNIT_MISMATCH | 1 |
| UNIT_NOT_ASKED_30_09_B | 19 |
| ZERO_VALUE | 3 |
