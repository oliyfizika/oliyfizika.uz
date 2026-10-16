// Attestatsiya → Fizika: kun bo'yicha kirish — UI qatlami (access.js) unit testlari. Haqiqiy tekshiruv — Rules (test_rules.py, 15-bo'lim).
//   node tools/attestatsiya-fizika/tests/test_access.mjs
import { FREE_DAYS, isFreeDay, accessContext, dayOpen, contentOpen, isPaidMock, accessText, ACCESS_TEXT, ACCESS_TEXT_MOCK, COURSE_URL } from "../../../assets/js/attestatsiya-fizika/access.js";

const results = [];
const expect = (name, cond) => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"} ${name}`); };
const T = (d) => ({ id: `d${d}`, dayNumber: d });
const paid = accessContext({ accessMode: "paid" }, { fullName: "x" });
const granted = accessContext({ accessMode: "paid" }, { attestationAccess: true });
const admin = accessContext({ accessMode: "paid" }, { role: "admin" });
const open = accessContext({ accessMode: "open" }, null);

expect("FREE_DAYS = 3", FREE_DAYS === 3);
expect("A–C: Day 1/2/3 — ruxsatsiz ham ochiq", [1, 2, 3].every((d) => dayOpen(T(d), paid)));
expect("D–F: Day 4/5/9 — ruxsatsiz yopiq", [4, 5, 9].every((d) => !dayOpen(T(d), paid)));
expect("umumiy qoida: Day 10…32 ham yopiq (hard-code emas)", Array.from({ length: 23 }, (_, i) => i + 10).every((d) => !dayOpen(T(d), paid)));
expect("G–I: attestationAccess=true — Day 4/5/9 ochiq", [4, 5, 9, 32].every((d) => dayOpen(T(d), granted)));
expect("N: admin — ochiq", dayOpen(T(9), admin));
expect("open rejim — hammasi ochiq (avvalgi xatti-harakat)", [1, 4, 9, 32].every((d) => dayOpen(T(d), open)));
expect("attestationAccess faqat aynan true (\"true\"/1 — yo'q)", !dayOpen(T(4), accessContext({ accessMode: "paid" }, { attestationAccess: "true" })) && !dayOpen(T(4), accessContext({ accessMode: "paid" }, { attestationAccess: 1 })));
expect("fullAccess / mockTestsAccess attestatsiyani ochmaydi", !dayOpen(T(4), accessContext({ accessMode: "paid" }, { fullAccess: true, mockTestsAccess: true })));
expect("kontekst yo'q / settings yo'q — eng qattiq (faqat bepul kunlar)", dayOpen(T(2), null) && !dayOpen(T(4), null) && !dayOpen(T(4), accessContext({}, null)));
expect("dayNumber butun son emas — bepul emas", !isFreeDay({ dayNumber: "2" }) && !isFreeDay({}) && !dayOpen(null, open));
expect("tarix: o'z urinishi bor — kontent ochiq (natija/ko'rib chiqish/yechim)", contentOpen(T(4), paid, { status: "graded" }) && !contentOpen(T(4), paid, null));
expect("CTA: https://t.me/oliy_fizik", COURSE_URL === "https://t.me/oliy_fizik");

// PULLIK MOCK (paidOnly): faqat admin | attestationAccess; accessMode "open" ham ochmaydi. paidOnly yo'q mock — hamma uchun.
const M = (extra = {}) => ({ id: "att-fizika-mock-02", kind: "mock", dayNumber: 102, ...extra });
expect("mock (paidOnly yo'q) — ruxsatsiz ham ochiq (avvalgidek)", dayOpen(M(), paid) && dayOpen(M(), null));
expect("paidOnly mock — ruxsatsiz yopiq", !dayOpen(M({ paidOnly: true }), paid) && !dayOpen(M({ paidOnly: true }), null));
expect("paidOnly mock — accessMode open ham ochmaydi", !dayOpen(M({ paidOnly: true }), open));
expect("paidOnly mock — attestationAccess=true va admin uchun ochiq", dayOpen(M({ paidOnly: true }), granted) && dayOpen(M({ paidOnly: true }), admin));
expect("paidOnly faqat aynan true (\"true\"/1 — pullik emas)", !isPaidMock(M({ paidOnly: "true" })) && !isPaidMock(M({ paidOnly: 1 })) && isPaidMock(M({ paidOnly: true })));
expect("paidOnly kunlik testga ta'sir qilmaydi (kind mock emas)", !isPaidMock({ dayNumber: 5, paidOnly: true }) && !dayOpen({ dayNumber: 5, paidOnly: true }, paid));
expect("paidOnly mock: o'z urinishi bor — tarix ochiq", contentOpen(M({ paidOnly: true }), paid, { status: "graded" }) && !contentOpen(M({ paidOnly: true }), paid, null));
expect("yopiq kartada pullik mock uchun alohida matn", accessText(M({ paidOnly: true })) === ACCESS_TEXT_MOCK && accessText(T(4)) === ACCESS_TEXT && ACCESS_TEXT_MOCK.includes("pullik"));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} — ${passed === results.length ? "PASS" : "FAIL"}`);
process.exit(passed === results.length ? 0 : 1);
