// Admin: Milliy sertifikat mock test natijalari (admin/mock-results.html).
// Manba: Firestore "mockTestAttempts" (milliy-sertifikat/mock-testlar/js/attempt-record.js yozadi).
// So'rov: [testId ==] + submittedAt oralig'i + orderBy(submittedAt desc) + limit(MAX_DOCS).
//   testId filtri + tartib — kompozit indeks (firestore.indexes.json). Indeks yo'q bo'lsa — Firebase havolasi.
// Yuklangan ro'yxat brauzerda: foydalanuvchi qidiruvi, "eng yaxshi/birinchi urinish" ko'rinishi, xulosa, eksport.
// Faqat o'qish. Kirish huquqlari (mockTestsAccess) va pullik yechimlarga aloqasi yo'q.
import { requireAdmin, $, esc, fillIcons, formatDateTime, stateBox, errorText, indexLink, num } from "./admin-common.js";
import { buildXlsx, XLSX_MIME } from "./xlsx-writer.js";
import { toast } from "../ui/feedback.js";

const MAX_DOCS = 3000;
const PAGE = 50;

fillIcons($("#adminPage"));
const { fb } = await requireAdmin();
const { collection, query, where, orderBy, limit, getDocs } = fb.fsSdk;
const col = collection(fb.db, "mockTestAttempts");

const f = { user: $("#mrUser"), test: $("#mrTest"), view: $("#mrView"), from: $("#mrFrom"), to: $("#mrTo") };
const bodyEl = $("[data-mock-body]");
const stateEl = $("[data-mock-state]");
const summaryEl = $("[data-mock-summary]");
const more = $("[data-mock-more]");
const countEl = $("[data-mock-count]");
const exportBtns = [...document.querySelectorAll("[data-mock-export]")];

let loaded = [];   // Firestore'dan (test + sana filtri bilan)
let view = [];     // brauzer filtrlaridan keyin
let shown = 0;
let token = 0;
let truncated = false;

// ------------------------------------------------------------------ yordamchilar
const dec1 = (v) => (Number.isFinite(v) ? v.toFixed(1).replace(".", ",") : "—");
const testNo = (r) => Number(r.testNumber) || Number(String(r.testId || "").replace(/\D+/g, "")) || 0;
const testLabel = (r) => `Mock №${testNo(r) || "?"}`;
const whoOf = (r) => String(r.name || "").trim() || r.email || r.uid || "—";
const tsOf = (r) => Number(r.finishedAtMs) || (r.submittedAt?.toMillis ? r.submittedAt.toMillis() : 0);
function fmtDur(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} soat ${m} daq` : `${m} daq`;
}
function median(arr) {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y), mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN);
const noteOf = (r) => [r.autoSubmitted ? "vaqt tugab avtomatik yakunlangan" : "", Number(r.focusLoss) > 0 ? `oynadan ${r.focusLoss} marta chiqqan` : ""].filter(Boolean).join("; ");

// ------------------------------------------------------------------ mock ro'yxati (select)
async function loadTestOptions() {
  try {
    const res = await fetch("../milliy-sertifikat/mock-testlar/data/tests.json", { cache: "no-cache" });
    const data = await res.json();
    const ids = (data.tests || []).map((t) => t.id).filter(Boolean);
    f.test.insertAdjacentHTML("beforeend", ids.map((id) => `<option value="${esc(id)}">Mock №${esc(id.replace(/\D+/g, ""))}</option>`).join(""));
  } catch (error) {
    console.warn("[admin] tests.json o'qilmadi", error);
  }
  const p = new URLSearchParams(location.search);
  if (p.get("test")) f.test.value = p.get("test");
  if (p.get("uid")) f.user.value = p.get("uid");
}

// ------------------------------------------------------------------ ko'rinish
function applyLocal() {
  const q = f.user.value.trim().toLowerCase();
  let list = loaded.filter((r) => !q || [r.name, r.email, r.uid].some((v) => String(v || "").toLowerCase().includes(q)));
  if (f.view.value !== "all") {
    const pick = new Map();
    for (const r of list) {
      const k = `${r.uid}|${r.testId}`;
      const cur = pick.get(k);
      const better = !cur || (f.view.value === "best"
        ? r.percent > cur.percent || (r.percent === cur.percent && tsOf(r) < tsOf(cur))
        : tsOf(r) < tsOf(cur));
      if (better) pick.set(k, r);
    }
    list = [...pick.values()];
  }
  view = list.sort((a, b) => tsOf(b) - tsOf(a));
}

function renderStats() {
  const pct = view.map((r) => Number(r.percent) || 0);
  const set = (k, v) => { $(`[data-mstat="${k}"]`).textContent = v; };
  set("attempts", num(view.length));
  set("users", num(new Set(view.map((r) => r.uid)).size));
  set("avg", view.length ? `${dec1(avg(pct))}%` : "—");
  set("best", view.length ? `${Math.max(...pct)}%` : "—");
  $("[data-mock-stats]").setAttribute("aria-busy", "false");

  const groups = new Map();
  for (const r of view) {
    const g = groups.get(r.testId) || { r, list: [] };
    g.list.push(r);
    groups.set(r.testId, g);
  }
  const rows = [...groups.values()].sort((a, b) => testNo(a.r) - testNo(b.r));
  summaryEl.innerHTML = rows.length ? rows.map(({ r, list }) => {
    const p = list.map((x) => Number(x.percent) || 0);
    return `<tr>
      <td data-label="Mock test"><b>${esc(testLabel(r))}</b></td>
      <td data-label="Urinishlar" class="of-num">${num(list.length)}</td>
      <td data-label="Foydalanuvchilar" class="of-num">${num(new Set(list.map((x) => x.uid)).size)}</td>
      <td data-label="O‘rtacha" class="of-num">${dec1(avg(p))}%</td>
      <td data-label="Mediana" class="of-num">${dec1(median(p))}%</td>
      <td data-label="Eng yuqori" class="of-num">${Math.max(...p)}%</td>
      <td data-label="O‘rtacha vaqt" class="of-num">${esc(fmtDur(avg(list.map((x) => Number(x.durationSec) || 0))))}</td></tr>`;
  }).join("") : `<tr><td colspan="7">${stateBox("empty", "Ma’lumot yo‘q.")}</td></tr>`;
}

function rowHtml(r, i) {
  const who = whoOf(r);
  const cells = [
    ["№", String(i + 1)],
    ["Foydalanuvchi", `<a href="user.html?id=${encodeURIComponent(r.uid || "")}"><b>${esc(who)}</b></a>${r.email && r.email !== who ? `<br><span class="of-admin-sub of-admin-break">${esc(r.email)}</span>` : ""}`],
    ["Mock test", esc(testLabel(r))],
    ["Ball", esc(`${r.correct ?? "—"}/${r.maxScore ?? "—"}`)],
    ["Foiz", `<b>${esc(`${r.percent ?? "—"}%`)}</b>`],
    ["To‘liq / qisman / bo‘sh", esc(`${r.full ?? "—"} / ${r.partial ?? "—"} / ${r.blank ?? "—"}`)],
    ["Vaqt", esc(fmtDur(r.durationSec))],
    ["Sana", esc(formatDateTime(tsOf(r) || r.submittedAt))],
    ["Izoh", `<span class="of-admin-sub">${esc(noteOf(r) || "—")}</span>`],
  ];
  return `<tr>${cells.map(([l, v], k) => `<td data-label="${l}"${[0, 3, 4, 5, 6].includes(k) ? ' class="of-num"' : ""}>${v}</td>`).join("")}</tr>`;
}

function showMore() {
  const slice = view.slice(shown, shown + PAGE);
  bodyEl.insertAdjacentHTML("beforeend", slice.map((r, k) => rowHtml(r, shown + k)).join(""));
  shown += slice.length;
  more.hidden = shown >= view.length;
}

function render() {
  applyLocal();
  bodyEl.innerHTML = "";
  shown = 0;
  renderStats();
  showMore();
  countEl.textContent = view.length ? `${num(view.length)} ta qator` : "";
  stateEl.innerHTML = view.length ? "" : stateBox("empty", "Natija topilmadi.", loaded.length ? "Filtrlarni o‘zgartirib ko‘ring." : "Hali bu filtr bo‘yicha topshirilgan mock urinish yo‘q.");
  if (truncated) stateEl.insertAdjacentHTML("beforeend", stateBox("info", `Faqat eng yangi ${num(MAX_DOCS)} ta urinish yuklandi.`, "Aniqroq natija uchun mock test yoki sana oralig‘ini tanlang."));
  exportBtns.forEach((b) => { b.disabled = !view.length; });
}

// ------------------------------------------------------------------ yuklash
async function load() {
  const my = ++token;
  bodyEl.innerHTML = "";
  bodyEl.setAttribute("aria-busy", "true");
  exportBtns.forEach((b) => { b.disabled = true; });
  more.hidden = true;
  stateEl.innerHTML = `<div class="of-admin-loading"><span class="of-skeleton of-skeleton--text"></span><span class="of-skeleton of-skeleton--text"></span></div>`;
  const from = f.from.value ? new Date(`${f.from.value}T00:00:00`) : null;
  const to = f.to.value ? new Date(new Date(`${f.to.value}T00:00:00`).getTime() + 86400000) : null;
  const cons = [];
  if (f.test.value) cons.push(where("testId", "==", f.test.value));
  if (from) cons.push(where("submittedAt", ">=", from));
  if (to) cons.push(where("submittedAt", "<", to));
  cons.push(orderBy("submittedAt", "desc"), limit(MAX_DOCS));
  try {
    const snap = await getDocs(query(col, ...cons));
    if (my !== token) return;
    loaded = snap.docs.map((d) => d.data());
    truncated = snap.docs.length >= MAX_DOCS;
    render();
  } catch (error) {
    if (my !== token) return;
    loaded = []; view = [];
    renderStats();
    const link = error?.code === "failed-precondition" ? indexLink(error) : null;
    stateEl.innerHTML = stateBox("error", "Mock natijalarini yuklab bo‘lmadi.", errorText(error))
      + (link ? `<p class="of-admin-note"><a class="of-admin-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Firebase’da indeks yaratish</a></p>` : "");
  } finally {
    if (my === token) bodyEl.setAttribute("aria-busy", "false");
  }
}

// ------------------------------------------------------------------ eksport
const HEADER = ["№", "F.I.Sh.", "Email", "UID", "Mock test", "To‘g‘ri bandlar", "Jami bandlar", "Foiz", "To‘liq", "Qisman", "Bo‘sh", "Vaqt (daqiqa)", "Sana", "Izoh"];
const exportRows = () => view.map((r, i) => [
  i + 1, whoOf(r), r.email || "", r.uid || "", testLabel(r), Number(r.correct) || 0, Number(r.maxScore) || 0, Number(r.percent) || 0,
  Number(r.full) || 0, Number(r.partial) || 0, Number(r.blank) || 0, Math.round((Number(r.durationSec) || 0) / 60),
  formatDateTime(tsOf(r) || r.submittedAt), noteOf(r),
]);

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function fileBase() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `mock-natijalari${f.test.value ? `-${f.test.value}` : ""}-${ymd}`;
}

function exportAs(kind) {
  const rows = exportRows();
  if (!rows.length) return;
  if (kind === "xlsx") {
    const name = `${fileBase()}.xlsx`;
    download(new Blob([buildXlsx({ sheetName: "Mock natijalari", header: HEADER, rows, widths: [6, 28, 28, 30, 12, 10, 10, 8, 8, 8, 8, 10, 18, 34] })], { type: XLSX_MIME }), name);
    toast(`${name} — ${rows.length} ta qator.`);
  } else {
    // Excel (uz/ru lokal) uchun ";" ajratgich va UTF-8 BOM.
    const q = (v) => { const s = String(v ?? ""); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [HEADER, ...rows].map((r) => r.map(q).join(";")).join("\r\n");
    const name = `${fileBase()}.csv`;
    download(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), name);
    toast(`${name} — ${rows.length} ta qator.`);
  }
}

// ------------------------------------------------------------------ hodisalar
$("[data-mock-form]").addEventListener("submit", (e) => { e.preventDefault(); load(); });
$("[data-mock-reset]").addEventListener("click", () => { Object.values(f).forEach((el) => { el.value = el.tagName === "SELECT" ? el.options[0].value : ""; }); load(); });
f.user.addEventListener("input", () => { if (loaded.length) render(); });
f.view.addEventListener("change", () => { if (loaded.length) render(); });
more.addEventListener("click", showMore);
exportBtns.forEach((b) => b.addEventListener("click", () => exportAs(b.dataset.mockExport)));

await loadTestOptions();
load();
