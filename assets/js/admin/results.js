// Admin: test natijalari (admin/results.html).
// So'rov rejimlari:
//  1) Foydalanuvchi bo'yicha (UID yoki email): where(==) — indekssiz; shu foydalanuvchining natijalari (≤500)
//     brauzerda filtrlanadi, tartiblanadi va 20 tadan ko'rsatiladi.
//  2) Umumiy: orderBy(completedAt desc) + sahifalash. Sana oralig'i — shu maydonda (indekssiz).
//     Holat/Kurs filtri + completedAt tartibi KOMPOZIT indeks talab qiladi (firestore.indexes.json).
//     Indeks yo'q bo'lsa — aniq xabar va Firebase bergan indeks havolasi (workaround yo'q).
// Natijani o'zgartirish yo'q (Rules: update — hech kim). O'chirish UI'da taqdim etilmaydi.
import { requireAdmin, $, esc, fillIcons, formatDateTime, stateBox, errorText, indexLink, PAGE_SIZE } from "./admin-common.js";

fillIcons($("#adminPage"));
const { fb } = await requireAdmin();
const { collection, query, where, orderBy, limit, startAfter, getDocs } = fb.fsSdk;
const col = collection(fb.db, "results");

const form = $("[data-results-form]");
const bodyEl = $("[data-results-body]");
const stateEl = $("[data-results-state]");
const more = $("[data-results-more]");
const hint = $("[data-results-hint]");
const f = { user: $("#resUser"), passed: $("#resPassed"), course: $("#resCourse"), from: $("#resFrom"), to: $("#resTo") };

let cursor = null;
let local = null; // foydalanuvchi rejimi: brauzerdagi to'liq ro'yxat
let shown = 0;
let token = 0;

const params = new URLSearchParams(location.search);
if (params.get("uid")) f.user.value = params.get("uid");
else if (params.get("email")) f.user.value = params.get("email");

function row(r) {
  const who = r.fullName || r.email || r.uid || "—";
  const cells = [
    ["Foydalanuvchi", `<a href="user.html?id=${encodeURIComponent(r.uid || "")}"><b>${esc(who)}</b></a>${r.email && r.email !== who ? `<br><span class="of-admin-sub of-admin-break">${esc(r.email)}</span>` : ""}`],
    ["Mavzu", `${esc(`${r.lessonId ?? "?"}-mavzu`)}${r.lessonTitle ? `<br><span class="of-admin-sub">${esc(String(r.lessonTitle).replace(/\s*\|\s*OliyFizika\.uz\s*$/, ""))}</span>` : ""}`],
    ["Kurs", esc(r.course || "—")],
    ["Ball", esc(`${r.score ?? "—"}/${r.totalQuestions ?? "—"}`)],
    ["Foiz", esc(`${r.percent ?? "—"}%`)],
    ["Holat", r.passed ? '<span class="of-badge of-badge--green">O‘tgan</span>' : '<span class="of-badge of-admin-badge--off">O‘tmagan</span>'],
    ["Urinish", esc(r.attempt ?? "—")],
    ["Sana", esc(formatDateTime(r.completedAt))],
  ];
  return `<tr>${cells.map(([l, v], i) => `<td data-label="${l}"${[3, 4, 6].includes(i) ? ' class="of-num"' : ""}>${v}</td>`).join("")}</tr>`;
}

function range() {
  const from = f.from.value ? new Date(`${f.from.value}T00:00:00`) : null;
  const to = f.to.value ? new Date(new Date(`${f.to.value}T00:00:00`).getTime() + 86400000) : null;
  return { from, to };
}

function localFilter(list) {
  const { from, to } = range();
  const ts = (r) => (r.completedAt?.seconds ? r.completedAt.seconds * 1000 : r.completedAt?.toDate ? r.completedAt.toDate().getTime() : 0);
  return list
    .filter((r) => !f.passed.value || String(r.passed === true) === f.passed.value)
    .filter((r) => !f.course.value || r.course === f.course.value)
    .filter((r) => (!from || ts(r) >= from.getTime()) && (!to || ts(r) < to.getTime()))
    .sort((a, b) => ts(b) - ts(a));
}

function showLocal() {
  const slice = local.slice(shown, shown + PAGE_SIZE);
  bodyEl.insertAdjacentHTML("beforeend", slice.map(row).join(""));
  shown += slice.length;
  more.hidden = shown >= local.length;
  stateEl.innerHTML = local.length ? "" : stateBox("empty", "Natija topilmadi.", "Filtrlarni o‘zgartirib ko‘ring.");
}

async function run({ reset = true } = {}) {
  const my = ++token;
  if (reset) { cursor = null; local = null; shown = 0; bodyEl.innerHTML = ""; }
  more.disabled = true;
  bodyEl.setAttribute("aria-busy", "true");
  if (reset) stateEl.innerHTML = `<div class="of-admin-loading"><span class="of-skeleton of-skeleton--text"></span><span class="of-skeleton of-skeleton--text"></span></div>`;
  const user = f.user.value.trim();
  try {
    if (user) {
      if (reset) {
        hint.textContent = "Foydalanuvchi natijalari to‘liq yuklanib, filtrlar brauzerda qo‘llanadi.";
        const q = user.includes("@")
          ? query(col, where("email", "in", [...new Set([user, user.toLowerCase()])]), limit(500))
          : query(col, where("uid", "==", user), limit(500));
        const snap = await getDocs(q);
        if (my !== token) return;
        local = localFilter(snap.docs.map((d) => d.data()));
      }
      showLocal();
    } else {
      hint.textContent = "Eng yangi natijalar birinchi. Holat yoki kurs filtri Firestore kompozit indeksini talab qiladi.";
      const { from, to } = range();
      const cons = [];
      if (f.passed.value) cons.push(where("passed", "==", f.passed.value === "true"));
      if (f.course.value) cons.push(where("course", "==", f.course.value));
      if (from) cons.push(where("completedAt", ">=", from));
      if (to) cons.push(where("completedAt", "<", to));
      cons.push(orderBy("completedAt", "desc"));
      if (cursor) cons.push(startAfter(cursor));
      cons.push(limit(PAGE_SIZE));
      const snap = await getDocs(query(col, ...cons));
      if (my !== token) return;
      bodyEl.insertAdjacentHTML("beforeend", snap.docs.map((d) => row(d.data())).join(""));
      cursor = snap.docs[snap.docs.length - 1] || cursor;
      more.hidden = snap.docs.length < PAGE_SIZE;
      stateEl.innerHTML = bodyEl.children.length ? "" : stateBox("empty", "Natija topilmadi.", "Filtrlarni o‘zgartirib ko‘ring.");
    }
  } catch (error) {
    if (my !== token) return;
    const link = error?.code === "failed-precondition" ? indexLink(error) : null;
    stateEl.innerHTML = stateBox("error", "Natijalarni yuklab bo‘lmadi.", errorText(error))
      + (link ? `<p class="of-admin-note"><a class="of-admin-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Firebase’da indeks yaratish</a></p>` : "");
    more.hidden = true;
  } finally {
    if (my === token) { more.disabled = false; bodyEl.setAttribute("aria-busy", "false"); }
  }
}

form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
$("[data-results-reset]").addEventListener("click", () => { Object.values(f).forEach((el) => { el.value = ""; }); run(); });
more.addEventListener("click", () => (local ? showLocal() : run({ reset: false })));
run();
