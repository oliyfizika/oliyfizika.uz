# 20 — LaTeX ↔ JSON ↔ Firestore izchilligi

**LATEX_JSON_CONSISTENCY = PASS**

Canonical manba: `chapters/*.tex` (savol, variantlar, `% Answer:`) + `_build/solutions_src/*.sol` (yechim). `problems.json` — hosila: `latex_canonical.py sync` uni LaTeX'dan qayta yozadi, `check` esa har prepare boshida solishtiradi (id to‘plami, bob/raqam, bo‘lim, matn, javob, javob manbasi, variantlar soni, tip).

| Tekshiruv | Natija | Tafsilot |
|---|---|---|
| `public_has_no_answer_fields` | PASS | set() |
| `canonical_roundtrip_exact` | PASS | 2182 hujjat |
| `plaintext_preserved_1027` | PASS | 1027/1027 |
| `versions_solutions_match_bank` | PASS | versions 1027, solutions 1027 |
| `reconstruction_reaches_bundle` | PASS | 62/62 |
| `image_refs_resolved` | PASS | 435 havola · topilmadi 0 · meta 0 |
| `LATEX_JSON_CONSISTENCY` | PASS | 1027 savol |

Zanjir: LaTeX → (sync) problems.json → texconv bloklar → public savol/variantlar + private yechim/kalit → versions/keys/solutions (bir xil canonical transform `fs_canonical`) → Firestore. Har bo‘g‘in yuqoridagi gate bilan yopilgan; salbiy testlar: `tools/attestatsiya-fizika/tests/test_pipeline_gates.py` (masalan problems.json'da 1 bo‘sh joy qo‘shilsa — FAIL).

Mismatch'lar: **0**.
