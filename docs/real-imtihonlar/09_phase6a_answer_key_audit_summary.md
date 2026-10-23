# PHASE 6A — ochiq javoblar kaliti: yakuniy audit (ommaviy xulosa)

Javoblar bu faylda yo'q. To'liq: `_private/real-imtihonlar/audit/phase6a-answer-key-final-audit.{json,md}`.

| Audit holati | Soni |
|---|---:|
| FORMAT_POLICY_UNCLEAR | 29 |
| NEEDS_MANUAL_CHECK | 1 |
| NEEDS_SARVAR_DECISION | 16 |
| PASS | 163 |
| PASS_AFTER_SPEC_CORRECTION | 1 |
| PASS_ENGINE_FEATURE_REQUIRED | 21 |
| RESOLVABLE_EXISTING_POLICY | 3 |
| SOURCE_DEFECT_UNSAFE | 1 |
| SOURCE_DEFECT_UNSAFE (PENDING_HIGH_REVIEW) | 5 |

| Qolgan qismlar guruhi | Soni |
|---|---:|
| A_EXISTING_POLICY | 3 |
| B_SARVAR_DECISION | 16 |
| C_MANUAL_PHYSICS | 1 |
| D_FORMAT_UNCLEAR | 29 |
| E_SOURCE_DEFECT | 6 |

Kritik: 3 (shundan 1 ta integratsiya blokeri) · o'rta: 2 · ogohlantirish: 10

## Tayyorlik

- **data**: SHARTLI TAYYOR — 185/240 qism kaliti tasdiqlandi (1 tasi spec tuzatishi bilan); 55 qism qaror/format kutmoqda
- **engine**: QISMAN — mavjud scoring.js ko'p qiymatli qabul va son+matn aralash tekshiruvni qo'llamaydi, kasr/√ ni o'qimaydi (BLOCKER-01)
- **overall**: Integratsiyaga HALI TAYYOR EMAS. Keyingi shartlar: (1) CRIT-01/02 va MED-01 bo'yicha qaror va spec v2; (2) qolgan 55 qism qarorlari; (3) engine hook'lari (alohida tasdiqlangan bosqich).
- **engineFit**: Mavjud engine bilan hozir ishlaydigan: 113 qism (defaultRelativeTolerance = 0,01; aniq/nol uchun absolyut 'tolerance'; matn — kind:'text'). Ko'p qiymat hook'i kerak: 51. Son+matn / UI birlik belgisi kerak: 22.
