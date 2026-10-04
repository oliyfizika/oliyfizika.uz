// Attestatsiya → Fizika: kalkulyator — Milliy sertifikat mock testidagi kalkulyator modulining o'zi qayta ishlatilishi.
//   node tools/attestatsiya-fizika/tests/test_calculator_reuse.mjs
// 1) mock test kalkulyatori (evaluate) regressiyasi; 2) adaptor ikkinchi implementatsiya emasligi (statik tekshiruv).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "../../../milliy-sertifikat/mock-testlar/js/calculator.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const results = [];
const expect = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const err = (e, deg = true) => { try { const v = evaluate(e, deg); return !Number.isFinite(v); } catch { return true; } };

// ---------------------------------------------------------------- mock test kalkulyatori (o'zgarmagan modul)
expect("2+3×4 = 14 (amallar tartibi)", evaluate("2+3×4") === 14);
expect("(2+3)×4 = 20", evaluate("(2+3)×4") === 20);
expect("2^10 = 1024, 2^3^2 = 512 (o'ngdan)", evaluate("2^10") === 1024 && evaluate("2^3^2") === 512);
expect("÷ va −: 10÷4−1 = 1.5", evaluate("10÷4−1") === 1.5);
expect("DEG: sin(30) = 0.5, cos(60) = 0.5, tan(45) = 1", near(evaluate("sin(30)"), 0.5) && near(evaluate("cos(60)"), 0.5) && near(evaluate("tan(45)"), 1));
expect("RAD: sin(π÷2) = 1", near(evaluate("sin(π÷2)", false), 1));
expect("√(16) = 4, √16 = 4", evaluate("√(16)") === 4 && evaluate("√16") === 4);
expect("ln(e) = 1, log(1000) = 3", near(evaluate("ln(e)"), 1) && near(evaluate("log(1000)"), 3));
expect("yashirin ko'paytirish: 2π, 3(4), 2sin(30)", near(evaluate("2π"), 2 * Math.PI) && evaluate("3(4)") === 12 && near(evaluate("2sin(30)"), 1));
expect("ilmiy yozuv: 6.67e-11×2", near(evaluate("6.67e-11×2"), 1.334e-10));
expect("yopilmagan qavs: (2+3 = 5", evaluate("(2+3") === 5);
expect("unary minus: −3^2 = −9, 2×−3 = −6", evaluate("−3^2") === -9 && evaluate("2×−3") === -6);
expect("xato: 1÷0, 2++, abc, bo'sh", err("1÷0") && err("2++") && err("abc") && err(""));
expect("xavfsiz: alert(1) / constructor — bajarilmaydi", err("alert(1)") && err("constructor"));

// ---------------------------------------------------------------- adaptor: ikkinchi implementatsiya yo'q
const adapter = fs.readFileSync(path.join(ROOT, "assets/js/attestatsiya-fizika/calculator-panel.js"), "utf8");
expect("adaptor mock test modulini import qiladi", /from "\.\.\/\.\.\/\.\.\/milliy-sertifikat\/mock-testlar\/js\/calculator\.js"/.test(adapter));
expect("adaptorda o'z hisob mantig'i yo'q (evaluate/parser/eval/Function yo'q)", !/function evaluate|tokenize|\beval\(|new Function|Math\.(sin|cos|log|pow)/.test(adapter));
expect("adaptor Firestore/urinish/javoblarga tegmaydi", !/firebase|firestore|updateDoc|setDoc|saveDraft|submitAttempt|answers|localStorage/.test(adapter));
const page = fs.readFileSync(path.join(ROOT, "assets/js/attestatsiya-fizika/test-page.js"), "utf8");
expect("test sahifasi faqat adaptorni ulaydi", /import \{ bindCalculatorButton, CALC_ICON \} from "\.\/calculator-panel\.js";/.test(page) && !/calculator\.js"/.test(page));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
