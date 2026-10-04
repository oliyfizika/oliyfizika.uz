// ==========================================================================
// Admin → Attestatsiya → Fizika: «Urinishlar» — sof hisob (DOM/Firebase yo'q, Node'da testlanadi).
// Ism: users/{uid} — mavjud admin qoidasi fullNameOf() bilan bir xil (firstName + lastName, bo'lmasa fullName);
// profil yoki ism yo'q bo'lsa — userId (fallback).
// Asosiy statistika: testId + testVersion + kind == "official" + status == "graded".
// ==========================================================================
import { toMs, formatTashkent, durationSeconds } from "../attestatsiya-fizika/core.js";

/** Profil → ko'rsatiladigan ism (admin-common.fullNameOf bilan bir xil tartib); bo'lmasa userId. */
export function displayName(profile, uid) {
  const n = [profile?.firstName, profile?.lastName].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
  const f = typeof profile?.fullName === "string" ? profile.fullName.trim() : "";
  return { name: n || f || String(uid || "—"), fallback: !(n || f) };
}

/** Unikal userId'lar (bo'sh/yaroqsizlar tashlanadi). */
export function uniqueUserIds(attempts) {
  return [...new Set((attempts || []).map((a) => a?.userId).filter((u) => typeof u === "string" && u))];
}

/** Firestore `in` cheklovi (30) bo'yicha bo'laklar. */
export function chunks(list, size = 30) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export const isGradedOfficial = (a, testId, version) =>
  !!a && a.testId === testId && a.testVersion === version && a.kind === "official" && a.status === "graded";

const STATUS_LABEL = { graded: "Baholangan", submitted: "Topshirilgan (baholanmagan)", in_progress: "Jarayonda" };
export const statusLabel = (s, auto = false) => (STATUS_LABEL[s] || String(s || "—")) + (auto ? " (avtomatik)" : "");

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const spent = (a) => num(a.timeSpentSeconds) ?? durationSeconds(a.startedAt, a.completedAt);

/**
 * Tanlangan test + versiya uchun jadval qatorlari.
 * @returns {{graded: object[], other: object[]}} graded — natija bo'yicha kamayish (teng: vaqt o'sish, ism);
 *          other — shu versiyaning baholanmagan/rasmiy bo'lmagan urinishlari (alohida ko'rsatish uchun).
 */
export function buildAttemptRows(test, version, attempts, names) {
  const nameOf = (uid) => names?.get?.(uid) || displayName(null, uid);
  const list = (Array.isArray(attempts) ? attempts : []).filter((a) => a && a.testId === test.id && a.testVersion === version);
  const graded = list.filter((a) => isGradedOfficial(a, test.id, version)).map((a) => {
    const nm = nameOf(a.userId);
    return {
      userId: a.userId || "",
      name: nm.name,
      fallback: nm.fallback,
      score: num(a.scorePercent),
      correct: num(a.correctAnswers),
      wrong: num(a.wrongAnswers),
      unanswered: num(a.unanswered),
      seconds: spent(a),
      startedMs: toMs(a.startedAt),
      completedMs: toMs(a.completedAt),
      status: a.status,
      auto: a.autoFinalized === true,
    };
  }).sort((x, y) => (y.score ?? -1) - (x.score ?? -1) || (x.seconds ?? Infinity) - (y.seconds ?? Infinity) || x.name.localeCompare(y.name));
  graded.forEach((r, i) => { r.n = i + 1; });
  const other = list.filter((a) => !isGradedOfficial(a, test.id, version)).map((a) => {
    const nm = nameOf(a.userId);
    return { userId: a.userId || "", name: nm.name, fallback: nm.fallback, status: a.status, kind: a.kind, startedMs: toMs(a.startedAt) };
  }).sort((x, y) => x.name.localeCompare(y.name));
  return { graded, other };
}

/** 5075 → "01:24:35" (soat:daqiqa:soniya) */
export function hms(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
export const fmtTime = (sec) => (sec == null ? "—" : hms(sec));
export const fmtDate = (ms) => (ms == null ? "—" : formatTashkent(ms, { year: true }));

export const EXCEL_HEADER = ["№", "F.I.Sh.", "Test", "Kun", "Test versiyasi", "Natija (%)", "To‘g‘ri javoblar", "Noto‘g‘ri javoblar",
  "Javobsiz", "Sarflangan vaqt", "Boshlangan vaqt", "Tugallangan vaqt", "Holat", "User ID"];
export const EXCEL_WIDTHS = [5, 30, 22, 6, 9, 10, 10, 10, 9, 12, 20, 20, 14, 30];

/** Excel: faqat tanlangan test + versiyaning baholangan rasmiy urinishlari (jadvaldagi tartib). */
export function excelData(test, version, graded) {
  const testName = `Day ${test.dayNumber}${test.sectionTitle ? ` — ${test.sectionTitle}` : ""}`;
  return {
    sheetName: `Day ${test.dayNumber} v${version}`,
    fileName: `attestatsiya-day-${test.dayNumber}-v${version}-statistika.xlsx`,
    header: EXCEL_HEADER,
    widths: EXCEL_WIDTHS,
    rows: graded.map((r) => [r.n, r.name, testName, test.dayNumber, version, r.score, r.correct, r.wrong, r.unanswered,
      r.seconds == null ? "" : hms(r.seconds), r.startedMs == null ? "" : fmtDate(r.startedMs),
      r.completedMs == null ? "" : fmtDate(r.completedMs), statusLabel(r.status, r.auto), r.userId]),
  };
}
