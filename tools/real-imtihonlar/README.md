# tools/real-imtihonlar

Real imtihonlar moduli uchun lokal vositalar. Hech biri Firebase production'ga ulanmaydi.

```bash
# 1) dataset + audit -> lokal app-data (_private/real-imtihonlar/app-data, gitignored)
python3 tools/real-imtihonlar/export_app_data.py
# 2) PHASE 4 validator (12 / 540 / 537 / 3 ORG / 531 FINAL / 3 / 3 (5 qism) / 105 / 1307 / 68 / 472)
python3 tools/real-imtihonlar/validate_app_data.py
# 3) Rules taklifi (faqat _private/real-imtihonlar/rules-proposed/ ga yoziladi; repo Rules o'zgarmaydi)
python3 tools/real-imtihonlar/rules/build_proposed_rules.py
# 4) E2E: mock Firebase (taklif Rules) + repo Rules bilan solishtirish uchun ikkinchi server
python3 tools/real-imtihonlar/e2e/run_mock.py --port 8797 &
python3 tools/real-imtihonlar/e2e/run_mock.py --port 8798 --rules repo &
E2E_PORT=8797 REPO_PORT=8798 node tools/real-imtihonlar/e2e/e2e_real_exams.mjs
# 5) PDF ko'ruvchi — HEADED (to'liq) Chromium, Xvfb displeyida; render OS darajasidagi skrinshot bilan tekshiriladi
E2E_PORT=8797 xvfb-run -a -s "-screen 0 1280x900x24" node tools/real-imtihonlar/e2e/pdf_headed_check.mjs
```

Lokal ko'rish: istalgan statik server (repo ildizida) → `http://127.0.0.1:PORT/milliy-sertifikat/real-imtihonlar/`.
Lokal adapter faqat `localhost` / `127.0.0.1` da yoqiladi.

**Eslatma:** haqiqiy Firebase Auth bilan kirilgan holda sahifa ochilsa, mavjud `core/session.js` foydalanuvchi faolligini (`users/{uid}.lastActiveAt`) yangilaydi. Bu saytning hamma sahifalarida bor odatiy xatti-harakat. Production'ga umuman tegmaslik uchun lokal sinovni yuqoridagi mock server orqali qiling.

Batafsil: `docs/real-imtihonlar/01_architecture.md`.
