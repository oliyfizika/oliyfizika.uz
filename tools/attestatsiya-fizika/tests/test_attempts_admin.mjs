// Attestatsiya → Fizika: admin «Urinishlar» (ism, filtr, tartib) va XLSX yozuvchi unit testlari (sintetik ma'lumot).
//   node tools/attestatsiya-fizika/tests/test_attempts_admin.mjs
// openpyxl mavjud bo'lsa, .xlsx fayl Python'da ham ochib tekshiriladi (bo'lmasa — ZIP/XML tuzilmasi tekshiriladi).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { displayName, uniqueUserIds, chunks, buildAttemptRows, excelData, hms, EXCEL_HEADER } from "../../../assets/js/admin/attestation-attempts-core.js";
import { buildXlsx } from "../../../assets/js/admin/xlsx-writer.js";

const results = [];
const expect = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = JSON.stringify;
const ts = (iso) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 });

// ---------------------------------------------------------------- ism
expect("ism: firstName + lastName", displayName({ firstName: "Sarvar", lastName: "Amirov", fullName: "X" }, "u1").name === "Sarvar Amirov");
expect("ism: faqat fullName", displayName({ fullName: " Ali Valiyev " }, "u2").name === "Ali Valiyev");
const fb = displayName(undefined, "KZICK83wgyGO7nJzKaVuDRhRrfo2");
expect("ism: profil yo'q → userId fallback", fb.name === "KZICK83wgyGO7nJzKaVuDRhRrfo2" && fb.fallback);
expect("ism: bo'sh ism → userId fallback", displayName({ fullName: "  ", firstName: "" }, "u9").name === "u9");
expect("ism: satr bo'lmagan maydon e'tiborsiz", displayName({ fullName: 42, firstName: null }, "u8").name === "u8");

// ---------------------------------------------------------------- N+1 yo'q
const many = Array.from({ length: 65 }, (_, i) => ({ userId: `u${i % 61}` })).concat([{ userId: "" }, null, { userId: 7 }]);
const ids = uniqueUserIds(many);
expect("unikal userId (takror/bo'sh/yaroqsiz tashlanadi)", ids.length === 61);
expect("bo'laklar ≤ 30 (61 user → 3 so'rov)", J(chunks(ids, 30).map((c) => c.length)) === J([30, 30, 1]));

// ---------------------------------------------------------------- qatorlar
const T2 = { id: "day-2", dayNumber: 2, sectionTitle: "Mexanika", currentVersion: 2 };
const A = (uid, v, over = {}) => ({ userId: uid, testId: "day-2", testVersion: v, kind: "official", status: "graded", scorePercent: 50,
  correctAnswers: 10, wrongAnswers: 5, unanswered: 5, timeSpentSeconds: 1200, startedAt: ts("2026-10-04T04:00:00Z"),
  completedAt: ts("2026-10-04T04:20:00Z"), ...over });
const names = new Map([["uid1", displayName({ fullName: "Sarvar Amirov" }, "uid1")], ["uid2", displayName({ fullName: "Ali Valiyev" }, "uid2")]]);
const list = [
  A("uid1", 2, { scorePercent: 95, correctAnswers: 29, wrongAnswers: 1, unanswered: 1, timeSpentSeconds: 5075 }),
  A("uid2", 2, { scorePercent: 88, timeSpentSeconds: 3000 }),
  A("uid3", 2, { scorePercent: 88, timeSpentSeconds: 2000 }),               // profil yo'q
  A("uid4", 1, { scorePercent: 100 }),                                        // v1 — kirmaydi
  A("uid5", 2, { testId: "day-1" }),                                          // boshqa kun — kirmaydi
  A("uid6", 2, { status: "in_progress", scorePercent: undefined }),          // alohida
  A("uid7", 2, { status: "submitted" }),                                      // alohida
  A("uid8", 2, { kind: "practice" }),                                         // alohida
  A("uid9", undefined),                                                       // versiyasiz — kirmaydi
];
const { graded, other } = buildAttemptRows(T2, 2, list, names);
expect("A: ismlar — Sarvar Amirov, Ali Valiyev", graded[0].name === "Sarvar Amirov" && graded.some((r) => r.name === "Ali Valiyev"));
expect("B: profil yo'q → userId", graded.some((r) => r.name === "uid3" && r.fallback));
expect("F: faqat Day 2 v2, official + graded (3 ta)", graded.length === 3 && graded.every((r) => r.userId !== "uid4" && r.userId !== "uid5"));
expect("tartib: natija ↓, teng natijada vaqt ↑ (95, 88/2000 s, 88/3000 s)", J(graded.map((r) => r.userId)) === J(["uid1", "uid3", "uid2"]));
expect("raqamlash 1..n", J(graded.map((r) => r.n)) === J([1, 2, 3]));
expect("hisobga olinmaganlar alohida (in_progress, submitted, practice)", J(other.map((r) => r.userId).sort()) === J(["uid6", "uid7", "uid8"]));
expect("vaqt: 5075 s → 01:24:35", hms(5075) === "01:24:35" && hms(59) === "00:00:59");
expect("vaqt: timeSpentSeconds yo'q → completedAt − startedAt", buildAttemptRows(T2, 2, [A("u", 2, { timeSpentSeconds: undefined })], names).graded[0].seconds === 1200);
const z = buildAttemptRows(T2, 2, [], names);
expect("I: 0 urinish → bo'sh ro'yxatlar", !z.graded.length && !z.other.length);
let crash = false;
try { buildAttemptRows(T2, 2, null, null); buildAttemptRows(T2, 2, [null, {}, { testId: "day-2", testVersion: 2 }], undefined); } catch { crash = true; }
expect("buzilgan urinishlar — crash yo'q", !crash);

// ---------------------------------------------------------------- Excel
const x = excelData(T2, 2, graded);
expect("G: fayl nomi — attestatsiya-day-2-v2-statistika.xlsx", x.fileName === "attestatsiya-day-2-v2-statistika.xlsx");
expect("H: ustunlar (№, F.I.Sh., …, Holat, User ID oxirida)", J(x.header) === J(EXCEL_HEADER) && x.header[1] === "F.I.Sh." && x.header.at(-1) === "User ID");
expect("H: 1-qator qiymatlari", J(x.rows[0].slice(0, 10)) === J([1, "Sarvar Amirov", "Day 2 — Mexanika", 2, 2, 95, 29, 1, 1, "01:24:35"]), J(x.rows[0]));
expect("H: vaqtlar Toshkent bo'yicha", x.rows[0][10] === "4-oktabr 2026, 09:00" && x.rows[0][11] === "4-oktabr 2026, 09:20", `${x.rows[0][10]} | ${x.rows[0][11]}`);
const bytes = buildXlsx(x);
const s = Buffer.from(bytes).toString("latin1");
expect("XLSX: ZIP imzosi va OOXML qismlari", s.startsWith("PK\u0003\u0004") && ["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/styles.xml"].every((n) => s.includes(n)));
const tmp = path.join(os.tmpdir(), `att-xlsx-${process.pid}.xlsx`);
fs.writeFileSync(tmp, bytes);
let py = null;
try {
  py = execFileSync("python3", ["-c", `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.active
print(json.dumps({"title":ws.title,"rows":[list(r) for r in ws.iter_rows(values_only=True)],"bold":ws["A1"].font.b}))`, tmp], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch { py = null; }
if (py) {
  const o = JSON.parse(py);
  expect("XLSX (openpyxl): varaq «Day 2 v2», sarlavha qalin", o.title === "Day 2 v2" && o.bold === true);
  expect("XLSX (openpyxl): 1 sarlavha + 3 qator, qiymatlar mos", o.rows.length === 4 && J(o.rows[1].slice(0, 6)) === J([1, "Sarvar Amirov", "Day 2 — Mexanika", 2, 2, 95]));
  expect("XLSX (openpyxl): unicode (‘ ’, —) saqlangan", o.rows[0][6] === "To‘g‘ri javoblar");
} else {
  console.log("SKIP openpyxl mavjud emas — ZIP/XML tekshiruvi yetarli");
}
const evil = buildXlsx({ sheetName: "a/b:c*?[x]", header: ["<x>&"], rows: [["=HYPERLINK(\"x\")\u0001"]] });
const all = Buffer.from(evil).toString("utf8");
const es = all.slice(all.indexOf("<worksheet"), all.indexOf("</worksheet>"));      // faqat varaq XML (ZIP sarlavhalari emas)
expect("XLSX: XML escape, boshqaruv belgisi olib tashlanadi, formula matn bo'lib qoladi",
       es.includes("&lt;x&gt;&amp;") && !es.includes("\u0001") && es.includes('t="inlineStr"') && !es.includes("<f>"));
fs.rmSync(tmp, { force: true });

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
