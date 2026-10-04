// ==========================================================================
// Admin → Attestatsiya → Fizika: kun bo'yicha «Urinishlar» (faqat o'qish) + Excel eksport.
// Har bir kun qatorining O'Z details qatori bor: <tr data-test-attempts="ID">. Tugma:
// [data-action="view-attempts"][data-test-id="ID"] → aynan shu ID ning containeri (umumiy birinchi element emas).
// So'rovlar: urinishlar — testId + testVersion (api.listAttemptsForVersion); ismlar — users, unikal userId'lar
// bo'yicha `documentId() in [≤30]` bo'laklari (N+1 yo'q, kesh). Excel — yuklangan ma'lumotdan (qo'shimcha so'rov yo'q).
// Ruxsat: Firestore Rules — boshqa userlarning urinishlari va profillari faqat admin uchun.
// ==========================================================================
import { esc, stateBox, errorText } from "./admin-common.js";
import { toast } from "../ui/feedback.js";
import { fb, listAttemptsForVersion } from "../attestatsiya-fizika/api.js";
import { displayName, uniqueUserIds, chunks, buildAttemptRows, fmtTime, fmtDate, statusLabel, excelData } from "./attestation-attempts-core.js";
import { buildXlsx, XLSX_MIME } from "./xlsx-writer.js";

const names = new Map();                 // uid → {name, fallback} (sessiya keshi)
const state = new Map();                 // testId → {version, rows, token}

async function loadNames(uids) {
  const missing = uids.filter((u) => !names.has(u));
  if (!missing.length) return;
  const { db, fsSdk } = await fb();
  const { collection, query, where, getDocs, documentId } = fsSdk;
  const snaps = await Promise.all(chunks(missing, 30).map((ids) =>
    getDocs(query(collection(db, "users"), where(documentId(), "in", ids)))));
  const found = new Map();
  for (const s of snaps) s.docs.forEach((d) => found.set(d.id, d.data()));
  for (const u of missing) names.set(u, displayName(found.get(u), u));
}

const cellOf = (row) => `<span><a href="user.html?id=${encodeURIComponent(row.userId)}" title="${esc(row.userId)}">${esc(row.name)}</a>`
  + (row.fallback ? ' <span class="of-admin-sub">(profil/ism topilmadi)</span>' : "") + "</span>";
const n = (v) => (v == null ? "—" : v);

function renderBody(test, version, { graded, other }) {
  if (!graded.length && !other.length) {
    return stateBox("empty", "Hali urinish yo‘q", `Day ${test.dayNumber} v${version} bo‘yicha urinish mavjud emas.`);
  }
  const avg = graded.length && graded.every((r) => r.score != null)
    ? Math.round(graded.reduce((s, r) => s + r.score, 0) / graded.length) : null;
  const main = graded.length ? `
    <div class="of-admin-table-wrap"><table class="of-admin-table att-attempts__table" data-att-rows="${esc(test.id)}">
      <caption class="of-sr-only">Day ${test.dayNumber} v${version}: baholangan rasmiy urinishlar</caption>
      <thead><tr><th scope="col">№</th><th scope="col">F.I.Sh.</th><th scope="col">Natija</th><th scope="col">To‘g‘ri</th><th scope="col">Xato</th>
        <th scope="col">Javobsiz</th><th scope="col">Vaqt</th><th scope="col">Topshirilgan</th><th scope="col">Holat</th></tr></thead>
      <tbody>${graded.map((r) => `<tr data-att-user="${esc(r.userId)}">
        <td data-label="№" class="of-num">${r.n}</td>
        <td data-label="F.I.Sh." class="att-attempts__name">${cellOf(r)}</td>
        <td data-label="Natija" class="of-num"><b>${r.score == null ? "—" : `${r.score}%`}</b></td>
        <td data-label="To‘g‘ri" class="of-num">${n(r.correct)}</td>
        <td data-label="Xato" class="of-num">${n(r.wrong)}</td>
        <td data-label="Javobsiz" class="of-num">${n(r.unanswered)}</td>
        <td data-label="Vaqt" class="of-num">${esc(fmtTime(r.seconds))}</td>
        <td data-label="Topshirilgan">${esc(fmtDate(r.completedMs))}</td>
        <td data-label="Holat">${esc(statusLabel(r.status, r.auto))}</td></tr>`).join("")}</tbody></table></div>`
    : stateBox("empty", "Baholangan urinish yo‘q", "Statistika va Excel faqat baholangan rasmiy urinishlar bo‘yicha.");
  const rest = other.length ? `
    <details class="att-attempts__other" data-att-other="${esc(test.id)}"><summary>Hisobga olinmagan urinishlar (${other.length}) — jarayonda yoki baholanmagan</summary>
      <ul class="of-admin-mini">${other.map((r) => `<li><span>${cellOf(r)}</span><span class="of-admin-sub">${esc(statusLabel(r.status))}${r.kind && r.kind !== "official" ? ` · ${esc(r.kind)}` : ""} · ${esc(fmtDate(r.startedMs))}</span></li>`).join("")}</ul>
    </details>` : "";
  return `<p class="of-subtle" data-att-summary>Baholangan rasmiy urinishlar: <b>${graded.length}</b>${avg == null ? "" : ` · o‘rtacha natija <b>${avg}%</b>`} · versiya v${version}</p>${main}${rest}`;
}

function shell(test) {
  const nV = Number(test.currentVersion) || 1;
  const opts = Array.from({ length: nV }, (_, i) => nV - i).map((v) => `<option value="${v}">v${v}${v === nV ? " (joriy)" : ""}</option>`).join("");
  return `<div class="att-attempts" role="region" aria-label="Day ${test.dayNumber} — urinishlar">
    <div class="att-attempts__head">
      <h3>Day ${test.dayNumber} — urinishlar</h3>
      <div class="att-attempts__tools">
        <label class="att-attempts__version"><span class="of-subtle">Versiya</span>
          <select class="of-input of-admin-select" data-att-version="${esc(test.id)}" aria-label="Day ${test.dayNumber}: test versiyasi">${opts}</select></label>
        <button type="button" class="of-btn of-btn--sm" data-att-export="${esc(test.id)}" disabled>Excel yuklash</button>
      </div>
    </div>
    <div data-att-body="${esc(test.id)}" aria-live="polite"></div>
  </div>`;
}

const q = (root, sel) => root.querySelector(sel);

async function load(test, row) {
  const st = state.get(test.id);
  const my = ++st.token;
  const body = q(row, `[data-att-body="${CSS.escape(test.id)}"]`);
  const btn = q(row, `[data-att-export="${CSS.escape(test.id)}"]`);
  btn.disabled = true;
  st.rows = null;
  body.innerHTML = '<p class="of-subtle">Yuklanmoqda…</p>';
  body.setAttribute("aria-busy", "true");
  try {
    const attempts = await listAttemptsForVersion(test.id, st.version);
    await loadNames(uniqueUserIds(attempts));
    if (my !== st.token) return;
    st.rows = buildAttemptRows(test, st.version, attempts, names);
    body.innerHTML = renderBody(test, st.version, st.rows);
    btn.disabled = !st.rows.graded.length;
    btn.title = st.rows.graded.length ? `Day ${test.dayNumber} v${st.version} — ${st.rows.graded.length} ta urinish` : "Eksport uchun baholangan urinish yo‘q";
  } catch (err) {
    if (my === st.token) body.innerHTML = stateBox("error", "Urinishlarni yuklab bo‘lmadi", errorText(err));
  } finally {
    if (my === st.token) body.removeAttribute("aria-busy");
  }
}

/** «Ko‘rish» — shu kunning o'z details qatorini ochadi/yopadi. */
export function toggleAttempts(test, button, tbody) {
  if (!test || !button) return;
  const row = tbody.querySelector(`tr[data-test-attempts="${CSS.escape(test.id)}"]`);
  if (!row) return;
  const open = row.hidden;
  row.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (!open) return;
  if (!state.has(test.id) || !q(row, ".att-attempts")) {
    state.set(test.id, { version: Number(test.currentVersion) || 1, rows: null, token: 0 });
    q(row, "td").innerHTML = shell(test);
  }
  const st = state.get(test.id);
  q(row, `[data-att-version="${CSS.escape(test.id)}"]`).value = String(st.version);
  if (!st.rows) load(test, row);
}

export function changeVersion(test, select) {
  const st = state.get(test.id);
  if (!st) return;
  st.version = Number(select.value);
  load(test, select.closest("tr[data-test-attempts]"));
}

export function exportExcel(test, button) {
  const st = state.get(test.id);
  if (!st?.rows?.graded.length) {
    toast("Eksport uchun baholangan urinish yo‘q.");
    return;
  }
  const x = excelData(test, st.version, st.rows.graded);
  const blob = new Blob([buildXlsx(x)], { type: XLSX_MIME });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = x.fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`${x.fileName} — ${x.rows.length} ta urinish.`);
  button.blur?.();
}

/** Jadval qayta chizilganda: eski holat tashlanadi (ochiq panellar yopiladi, ma'lumot keyingi ochilishda qayta o'qiladi). */
export function resetAttempts() {
  state.clear();
}

/** Kun qatoridan keyingi details qatori (yopiq). */
export const detailsRow = (test, cols) =>
  `<tr class="att-attempts-row" data-test-attempts="${esc(test.id)}" hidden><td colspan="${cols}" class="att-attempts-cell"></td></tr>`;
